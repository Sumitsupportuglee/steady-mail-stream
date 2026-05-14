## The actual problem

Your screenshot shows the SMTP server rejecting messages with:
> `553 5.7.1 <info@periodicity.in>: Sender address rejected: not owned by user hr@periodicity.in`

This is **not** a rotation bug — it's an SMTP authorization rule. Most providers (Zoho, Google Workspace, cPanel, Outlook) only let an SMTP login send mail **From:** its own mailbox (or an explicit alias). Today the wizard locks the campaign to **one** sender identity (`info@periodicity.in`), but the SMTP rotation pool logs in as different mailboxes (`hr@`, `sales@`, `support@`). Every message routed through a non-`info@` account is rejected at RCPT TO.

So the fix is to **pair each SMTP account with its own matching sender identity** and rotate them together — not to keep one identity for all accounts.

## Plan: SMTP ↔ Identity pairing

### 1. Settings → SMTP Accounts: add "Linked sender identity"
- Add a new column `smtp_accounts.sender_identity_id uuid` (nullable, FK to `sender_identities`, ON DELETE SET NULL).
- In `src/pages/Settings.tsx` SMTP Accounts editor, add a dropdown **"Send From identity"** next to each SMTP row, listing the user's sender identities. Default suggestion: the identity whose `from_email` matches `smtp_username` (auto-pair on first load).
- Show a small warning badge on any SMTP account that has no linked identity — those will be skipped during rotation.

### 2. Campaign Wizard Step 2: change behavior
- **Single account mode** (unchanged): one SMTP + one sender identity, exactly as today.
- **Rotation pool mode**: remove the single "Sender Identity" dropdown at the top. Instead, show each pool member as `SMTP label → linked identity (from_email)`. The identity used for each email is whatever is linked to the SMTP account that sends it.
  - If an SMTP in the pool has no linked identity, disable its checkbox and show "Link an identity in Settings".
- Keep the existing weighted round-robin / `scheduled_for` staggering — no change to queue mechanics.

### 3. Queue processor: use the pair
In `supabase/functions/process-queue/index.ts`:
- When sending each email, look up `smtp_accounts.sender_identity_id` for the chosen SMTP and override `from_email` / `from_name` from that identity (instead of the campaign's single `sender_identity_id`).
- For single-account campaigns, behavior is unchanged (campaign's sender_identity wins).
- Cache identity lookups per batch (already done for `from_name`) so we don't hit the DB per email.

### 4. Campaign detail: clearer failure surfacing
- In the "Failed Deliveries" panel, when we see `553 ... Sender address rejected: not owned by user X`, add a one-line hint: "SMTP account `X` is not authorized to send From this address. Link a matching sender identity in Settings → SMTP Accounts."

### What stays the same
- "Do not rotate identity per SMTP" rule from earlier — **revised by this request**: rotation is now required, but only because the SMTP server demands it. Single-account campaigns still use one identity.
- Quota counters, `scheduled_for` staggering, RPCs, suppression handling, bounce parsing — all unchanged.
- No change to Lead Finder or any other module.

### Files affected
- **Migration**: add `sender_identity_id` column + FK on `smtp_accounts`; backfill by matching `smtp_username = sender_identities.from_email` per `user_id`.
- `src/pages/Settings.tsx` — linked-identity dropdown per SMTP row.
- `src/pages/CampaignWizard.tsx` — Step 2 rotation UI shows pairs; hide top identity selector in rotation mode; validation requires every pool member to have a linked identity.
- `supabase/functions/process-queue/index.ts` — read `sender_identity_id` from the chosen SMTP and override From for that send.
- `src/pages/CampaignDetail.tsx` — friendlier hint for the "not owned by user" error class.

### Expected outcome
- `hr@`, `sales@`, `support@`, `info@` each send From their own address. No more `553 not owned by user` rejections.
- `Recipient has unsubscribed` (112 in your screenshot) is expected and correct — those are the suppression list doing its job, not a bug.

Confirm and I'll implement.
