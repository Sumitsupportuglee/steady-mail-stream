# Fix Bulk Email Delivery Failures

## Diagnosis of the 4 errors in your screenshot

| Error | Root cause | Fix category |
|---|---|---|
| `MAIL FROM failed: 503 Bad sequence of commands` | After a previous recipient failed (RCPT/DATA error), we go straight into the next email's `MAIL FROM` without sending `RSET`. The server is still mid-transaction → 503. Also our `readResponse()` reads a single 4 KB chunk, so a stray banner/late line from a prior command can leak into the next read and look like a "bad sequence". | SMTP protocol bug |
| `SMTP connection error: AUTH PLAIN failed: 535 Authentication credentials invalid` | The user's stored SMTP password is wrong / expired / app-password revoked. There's no fallback to `AUTH LOGIN` and no friendly signal back to the user. | User config + UX |
| `RCPT TO failed: 550 ... invalid DNS MX or A/AAAA resource record` (×2) | The recipient address belongs to a domain with no MX. We send to it, get a hard bounce, and then keep trying it (and the *next* sends fail with 503 because the session is poisoned — see row 1). | Address hygiene + auto-suppression |

So the headline issue is: **one bad recipient corrupts the SMTP session, and every subsequent email in that session fails with 503**. This is why you see 98 failures — most are collateral damage, not 98 independently broken emails.

## What we will change

### 1. `supabase/functions/process-queue/index.ts` — SMTP session hardening
- **Send `RSET` after every failed `MAIL FROM` / `RCPT TO` / `DATA`**, before moving to the next email. This clears the transaction and eliminates the cascading `503 Bad sequence of commands`.
- **Reconnect the session if `RSET` itself fails** or if we see `503` / `421` — the connection is unrecoverable, open a fresh one for the rest of the chunk.
- **Fix `readResponse()`** to read full multi-line SMTP replies properly (loop until the line with `XYZ ` space-separator, drain the socket between commands). Today a single `read()` can return a partial frame, which intermittently presents as 503 on the next command.
- **Use a real hostname in `EHLO`** instead of `EHLO localhost`. Some providers (Hostinger, Zoho, Outlook) penalise or reject `localhost`. We'll use the sender's domain (from `from_email`).
- **Lower `PER_SESSION_LIMIT`** from 20 → 15 and add a clean `RSET` between sends even on success, which most providers prefer in long sessions.

### 2. Auto-suppress permanently bad recipients
- When we get a **5xx on RCPT TO** (e.g. `550 invalid DNS MX`, `550 mailbox unavailable`, `550 user unknown`, `553 ...`), insert the address into `email_unsubscribes` (or a new `bounced_emails` reason) and mark the contact `status = 'bounced'` in `contacts`. Future campaigns will skip them automatically (the queue already checks `email_unsubscribes`).
- This stops the same dead address from burning attempts on every campaign and protects sender reputation.

### 3. Pre-flight recipient validation (cheap, optional but big win)
- Before queueing a campaign in `CampaignWizard.tsx`, run a lightweight syntactic + MX check on contacts and warn the user. Either:
  - **(default)** Just validate the email format strictly and skip obviously broken ones, OR
  - Add an admin-triggered "Verify list" button in `Contacts.tsx` that runs an Edge Function doing DNS MX lookups (via DNS-over-HTTPS — same pattern already used for domain verification) and marks bad contacts as `bounced`.

We'll go with (1) auto-suppression on bounce + strict format check at queue time. List-wide MX verification can be a follow-up if you want.

### 4. Auth failure → clear user-facing signal
- When `AUTH PLAIN/LOGIN` returns `535`, mark **all** queued emails for that SMTP account as `failed` with a single, human-readable message: *"SMTP login rejected (535). Update your SMTP password in Settings → SMTP Accounts."*
- Surface a banner on the Dashboard and Campaigns page when any of the user's SMTP accounts has a recent `535` so the user knows immediately and re-enters credentials.

### 5. Better error analytics on the failed-deliveries panel
- Group identical errors and show counts (e.g. "550 invalid DNS MX × 47") instead of repeating the same line — makes the actual problem obvious at a glance.
- Add a tiny "Why?" tooltip per error type explaining the cause and the fix.

## Files to change

- `supabase/functions/process-queue/index.ts` — SMTP client (`RSET`, EHLO hostname, response reader, auto-suppress on 5xx RCPT, classify 535 distinctly)
- `src/pages/CampaignWizard.tsx` — strict email format validation before insert
- `src/pages/Campaigns.tsx` (or wherever the "Failed Deliveries" card lives — will locate during implementation) — group/count errors, add tooltips, add 535-banner
- Possibly a small migration to add a `bounce_reason` column to `email_unsubscribes` (or use existing `reason` field if present) so auto-suppressed addresses are distinguishable from user-initiated unsubscribes

## What you should expect after the fix

- The cascading **503** errors disappear → success rate on large sends jumps significantly even before any list cleaning.
- Repeat sends to the same dead address stop after the first bounce.
- A `535` on one account no longer silently retries 98 times — you see one clear "fix your password" message.
- Failed-deliveries panel becomes actionable: you see *what* failed and *why*, grouped.

Approve this plan and I'll implement it.