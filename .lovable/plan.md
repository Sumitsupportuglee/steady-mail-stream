## Goal

On the Campaign Detail page, when a campaign uses the SMTP rotation pool, show a live per-account breakdown of how many emails each SMTP account has sent, is pending, or has failed — so the user can verify the load is distributing evenly.

## What the user will see

In `src/pages/CampaignDetail.tsx`, only when `campaign.smtp_rotation_pool` has 2+ accounts, render a new **"Rotation Pool Distribution"** card below the existing stats grid:

```text
Rotation Pool Distribution
─────────────────────────────────────────────────────────────
Account                  Sent   Pending  Failed   Share
─────────────────────────────────────────────────────────────
info@periodicity.in       248      52      0      33% ████
hr@periodicity.in         247      53      1      33% ████
sales@periodicity.in      245      54      2      33% ████
support@periodicity.in      0       0      0       0%  (unused)
─────────────────────────────────────────────────────────────
```

Each row shows:
- SMTP label + linked from-email
- Sent / Pending / Failed counts
- A small share bar (% of total sent) so uneven distribution is visible at a glance
- A muted note when a pool member sent 0 (quota exhausted, disabled, or no linked identity)

Single-account campaigns: card is hidden — the existing "From …" header already covers it.

## How it's built

### 1. Data fetch in `fetchCampaignData`

Reuse the existing `email_queue` query (already pulls all rows for the campaign) — just add `smtp_account_id` to the select. Group in JS:

```ts
const perAccount = new Map<string, { sent: number; pending: number; failed: number }>();
for (const row of queueData ?? []) {
  const key = row.smtp_account_id ?? 'unassigned';
  const agg = perAccount.get(key) ?? { sent: 0, pending: 0, failed: 0 };
  if (row.status === 'sent') agg.sent++;
  else if (row.status === 'pending') agg.pending++;
  else if (row.status === 'failed') agg.failed++;
  perAccount.set(key, agg);
}
```

Then resolve labels for the pool members:
```ts
const { data: accounts } = await supabase
  .from('smtp_accounts')
  .select('id, label, smtp_username, sender_identities(from_email)')
  .in('id', campaign.smtp_rotation_pool);
```

Merge into a sorted array (by sent desc) → store in `rotationStats` state.

### 2. UI

A new `<Card>` using the existing `<Table>` component. Share bar = inline div with `bg-primary` and width set to the share %.

### 3. Live updates

Poll `fetchCampaignData` every 5s while `campaign.status` is `'queued'` or `'sending'`; clear interval on completion or unmount. Keeps it simple, no schema change, no realtime subscription.

## Files affected

- `src/pages/CampaignDetail.tsx` — add `smtp_account_id` to queue select, add `rotationStats` state, polling effect, and the new card.

No database migration, no edge function changes.

## Out of scope

- Historical charts (current totals only).
- Per-account quota usage (already in Settings → SMTP Accounts).

Confirm and I'll implement.