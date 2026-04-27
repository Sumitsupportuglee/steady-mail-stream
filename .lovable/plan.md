## Goal

Every campaign email gets a working unsubscribe link. When a recipient clicks it, they are recorded as opted-out, blocked from any future sends, and shown clearly in the CRM as "Unsubscribed" — so no further outreach is made by mistake.

## What the user will see

- Each outgoing email has an "Unsubscribe" footer link.
- Clicking it opens a confirmation page that records the opt-out (no login needed).
- In the CRM, those contacts get a red "Unsubscribed" badge and move to a new "Unsubscribed" stage. They are filterable, and excluded from any new campaign by default.
- A new "Unsubscribed" stat card on the CRM and a "Recent Unsubscribes" feed (mirroring "Recent Clicks").
- When building a new campaign in the wizard, unsubscribed contacts are automatically skipped from the recipient count, with a notice "X contacts skipped (unsubscribed)".

## Implementation

### 1. Database (migration)
- Add `unsubscribed` value to the existing `crm_stage_type` enum.
- Create a new `email_unsubscribes` table:
  - `id`, `user_id`, `contact_id` (nullable), `campaign_id` (nullable), `email_queue_id` (nullable), `email` (text, indexed), `reason` (text, optional), `ip_address`, `user_agent`, `unsubscribed_at`.
  - RLS: users can SELECT their own rows; service role can INSERT.
- Add trigger `auto_unsubscribe_on_optout`: on insert into `email_unsubscribes`, set the matching `contacts.status` to `'unsubscribed'` and the matching `crm_leads.stage` to `'unsubscribed'` (scoped to that user_id + email).
- Enable realtime on `email_unsubscribes` so the CRM updates live.

### 2. New edge function: `unsubscribe`
- Public (no JWT). GET `/unsubscribe?id=<email_queue_id>&token=<hmac>`.
- Validates token (HMAC of `email_queue_id` using `SUPABASE_SERVICE_ROLE_KEY` as secret) to prevent spoofed opt-outs.
- Looks up the `email_queue` row → resolves `user_id`, `to_email`, `campaign_id`, `contact_id`.
- Inserts a row into `email_unsubscribes` (idempotent on `user_id + email`).
- Returns a clean branded HTML confirmation page ("You have been unsubscribed from <Sender>. You won't receive any more emails from us.").
- Also handles POST for List-Unsubscribe-Post (one-click RFC 8058) which Gmail/Apple Mail use.

### 3. Update `process-queue` edge function
Before sending each email, two changes:

a) **Suppression check**: skip the row and mark it `failed` with `error_log = 'Recipient unsubscribed'` if `email_unsubscribes` already has a row for `(user_id, to_email)`.

b) **Inject unsubscribe footer + headers**:
- Append a footer to the HTML body just before `</body>`:
  ```
  <hr><p style="font-size:12px;color:#888;text-align:center">
    Don't want these emails? <a href="<UNSUB_URL>">Unsubscribe</a>
  </p>
  ```
- Replace the existing `List-Unsubscribe` header with the real per-message URL:
  - `List-Unsubscribe: <https://.../functions/v1/unsubscribe?id=...&token=...>, <mailto:unsubscribe@...>`
  - `List-Unsubscribe-Post: List-Unsubscribe=One-Click`

### 4. CRM page (`src/pages/CRM.tsx`)
- Add new stat card "Unsubscribed" (count of unique unsubscribed recipients).
- Add "Recent Unsubscribes" feed (same pattern as Recent Clicks): subscribes via realtime to `email_unsubscribes`, shows email + timestamp + campaign.
- Update the lead list to show a red "Unsubscribed" badge for leads at that stage.
- Add an "Unsubscribed" filter tab.

### 5. Campaign Wizard (`src/pages/CampaignWizard.tsx`)
- In step 2 (Audience), when computing eligible recipients, exclude any contact whose email exists in `email_unsubscribes` for the current user.
- Show a small notice: "X contacts excluded (unsubscribed)".

### 6. Files touched
- New: `supabase/migrations/<timestamp>_add_unsubscribe.sql`
- New: `supabase/functions/unsubscribe/index.ts`
- Edited: `supabase/functions/process-queue/index.ts` (suppression check + footer injection + headers)
- Edited: `src/pages/CRM.tsx` (stats card, feed, badge, filter)
- Edited: `src/pages/CampaignWizard.tsx` (exclude unsubscribed in audience step)
- Deploy: `process-queue`, `unsubscribe`

### Notes
- Token uses HMAC-SHA256 so opt-out links cannot be forged or guessed.
- Opt-out is per user_id (per agency) — one client's unsubscribe doesn't affect another agency's outreach to the same address.
- Existing `auto_create_crm_lead_from_email` trigger continues to work; the new trigger just overrides stage to `unsubscribed` afterwards.
