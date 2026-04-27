# Add SPF & DMARC Authentication (Optional, Recommended)

## Why this matters

Mailbox providers (Gmail, Outlook, Yahoo) use three records to authenticate a sender:

- **DKIM** (already implemented) — cryptographically signs the email
- **SPF** — declares which servers are allowed to send for your domain
- **DMARC** — tells receivers what to do if SPF/DKIM fail

Adding all three typically lifts inbox placement by 20–40% and is **required** by Gmail/Yahoo's 2024 bulk-sender rules. Missing SPF/DMARC is the #1 reason cold-outreach emails land in spam.

## What changes (custom-domain identities only)

Free providers (Gmail / Yahoo / Outlook) keep working exactly as today — no DNS UI, auto-verified.

For **"Other (Custom Domain)"** identities, the DNS Configuration panel will show **three sections** instead of one:

1. **DKIM (CNAME)** — required, already exists
2. **SPF (TXT)** — recommended, optional
3. **DMARC (TXT)** — recommended, optional

Each section gets its own status badge (Verified / Not Set), copy buttons, and individual "Verify" button. The user can skip SPF/DMARC and still send — only DKIM is required to enable sending. A friendly banner explains the deliverability benefit.

### Records that will be shown

```text
SPF   Host: @          Value: v=spf1 include:amazonses.com ~all
DMARC Host: _dmarc     Value: v=DMARC1; p=none; rua=mailto:dmarc@<domain>; pct=100; aspf=r; adkim=r
```

DMARC starts at `p=none` (monitor-only) — the safe default that won't break legitimate mail. We'll mention in the UI that they can tighten to `quarantine` or `reject` later once they're confident.

## Technical changes

**Database migration** — add to `sender_identities`:
- `spf_status text default 'not_set'` ('not_set' | 'verified' | 'failed')
- `dmarc_status text default 'not_set'`
- `spf_verified_at timestamptz`
- `dmarc_verified_at timestamptz`

**Edge function `verify-domain`** — extend to accept `record_type: 'dkim' | 'spf' | 'dmarc'`:
- DKIM: existing CNAME check (unchanged)
- SPF: DoH TXT query on root domain, look for `v=spf1` containing `amazonses.com` (or `include:` directive)
- DMARC: DoH TXT query on `_dmarc.<domain>`, look for `v=DMARC1`
- Update the matching `*_status` column

**Frontend `src/pages/SenderIdentities.tsx`**:
- Replace the single CNAME card with a 3-record layout (DKIM / SPF / DMARC), each with Host + Value + Copy + Verify button + status badge
- Add an "Optional but recommended" banner explaining the deliverability lift
- Update the help accordion with a new "Why SPF & DMARC?" section
- Update `SenderIdentity` interface and `fetchIdentities` to read new columns

**No changes** to:
- `process-queue` (sending logic) — DKIM remains the only hard requirement
- Free-provider flow (Gmail/Yahoo/Outlook)
- Existing identities — they continue working; SPF/DMARC just show as "Not Set" until the user opts in

## Files touched

- `supabase/migrations/<new>_add_spf_dmarc_columns.sql` (new)
- `supabase/functions/verify-domain/index.ts` (extend with SPF + DMARC checks)
- `src/pages/SenderIdentities.tsx` (UI for 3 records)
