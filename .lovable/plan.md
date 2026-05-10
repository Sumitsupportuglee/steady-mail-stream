# Plan: Add 25-lead option + improve Lead Finder yield

## Why current 50-lead requests under-deliver

In `supabase/functions/scrape-leads/index.ts`:
- Search candidate pool is capped at `Math.min(limit*2, 20)` — never more than 20 URLs even when 50 are requested.
- Per-URL scrape timeout drops to **4s** when `limit > 10` — most business sites need 6–8s, so the majority abort silently.
- Single Firecrawl `/search` call → narrow candidate pool, low contact-page hit rate.
- Whole job must finish inside one Edge Function invocation (~30s budget after search).

Result: a request for 50 realistically returns 5–10. A 25-lead target is achievable within one invocation if we widen the pool and rebalance timeouts.

## Frontend changes — `src/pages/LeadFinder.tsx`

1. Add a new dropdown option **"25 leads (recommended for bulk)"** between 10 and 50.
2. Reword the 50-lead option to **"50 leads (best-effort, may return fewer)"** so expectations are clear.
3. Default remains 5. No other UI changes.

## Edge function changes — `supabase/functions/scrape-leads/index.ts`

(All Deno/TypeScript — no Python is involved; the project's scraping runs in Deno Edge Functions per the [Scraping Limitations](mem://constraints/scraping-automation-limitations) memory.)

### 1. Lift the candidate-URL cap intelligently
- Replace `Math.min(limit * 2, 20)` with a tier-based cap:
  - `limit ≤ 10` → fetch up to **20** URLs (unchanged).
  - `limit = 25` → fetch up to **60** URLs.
  - `limit = 50` → fetch up to **100** URLs.
- Use Firecrawl `/v2/search` with `limit: candidatePool` (v2 supports up to 100 per call, well within Google-compliant search-API usage since Firecrawl is the search provider, not us scraping Google directly).

### 2. Multi-query expansion (better contact-page hit rate)
- For `limit ≥ 25`, fan out 2 search variants in parallel:
  - `"<query> contact email"`
  - `"<query> about us"`
- Merge + dedupe by registrable hostname so we don't scrape the same domain twice.

### 3. Rebalance timeouts and concurrency
- Per-URL timeout: **8s** for all sizes (drop the punishing 4s).
- Batch size: increase from 5 → **10** parallel scrapes.
- Search timeout: keep 12s.
- Stop early once `leads.length >= limit` (already implemented; keep).

### 4. Faster scrape mode
- For `limit ≥ 25`, request Firecrawl scrape with `onlyMainContent: true` and `formats: ['markdown']` only — smaller responses, faster completion, still preserves emails/phones.

### 5. Yield telemetry (optional but cheap)
- Log a one-line summary at the end: `pool=60 attempted=60 success=27 timeout=18 no_contact=15`. Helps us tune later.

## What stays the same

- Firecrawl-only scraping (still respects [Scraping Limitations](mem://constraints/scraping-automation-limitations)).
- AI email validation pass remains.
- Master + user business directory persistence unchanged.
- No new database columns, no new secrets.
- 50-lead path still works — just doesn't promise a hard 50.

## Expected outcome

| Requested | Today  | After fix    |
|-----------|--------|--------------|
| 5         | 5      | 5            |
| 10        | 8–10   | 8–10         |
| **25**    | n/a    | **18–25**    |
| 50        | 5–10   | 25–40        |

## Files affected

- `supabase/functions/scrape-leads/index.ts` — pool cap, multi-query, timeouts, batch size, telemetry.
- `src/pages/LeadFinder.tsx` — add `25 leads` option, reword `50 leads`.

No DB migration. No new packages. No client-side polling architecture (kept simple — single invocation still finishes well under timeout for 25).
