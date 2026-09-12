# Tech-stack & code-structure deck (PowerPoint)

## Goal
An editable `.pptx` file (`senddot_tech_stack.pptx`) giving a buyer or new developer a clear picture of the platform's technology stack and code structure. ~10 slides, 16:9.

## Slides

1. **Cover** — "Senddot — Technology Stack & Architecture" dark slide, platform tagline.
2. **Stack at a glance** — four-column overview: Frontend / Backend / Serverless / Integrations.
3. **Frontend** — React 18, TypeScript 5, Vite 5, Tailwind CSS v3, shadcn/ui (Radix), React Router 6, TanStack Query, React Hook Form + Zod, TipTap rich-text editor, Recharts, PapaParse (CSV), Lucide icons, date-fns.
4. **Backend (Lovable Cloud)** — Managed Supabase: PostgreSQL database, Row-Level Security for per-agency data isolation, email/password auth, storage, analytics logs, pg_cron scheduler (queue runs every minute).
5. **Serverless edge functions** — 13 Deno functions grouped by purpose:
   - Sending engine: process-queue (SMTP rotation, custom TCP/TLS SMTP client)
   - Tracking: track-open (1x1 pixel), track-click (link rewrite)
   - Lead gen: scrape-leads (Firecrawl), generate-outreach + ai-write-email (Lovable AI)
   - Money/ops: razorpay (orders + HMAC verification), trigger-webhook, zapier-inbound
   - Compliance: unsubscribe, verify-domain, manage-smtp, manage-ses-identity
6. **Integrations & payments** — Razorpay (India), PayPal link (international), Firecrawl, ElevenLabs chat widget, AWS SES, custom SMTP accounts.
7. **Sending architecture diagram** — ASCII-style flow drawn with shapes: Campaign wizard → email queue → per-minute cron worker → rotation pool (12 SMTP accounts) → open/click tracking → CRM updates.
8. **Code structure** — real folder map from the repo:
   ```text
   src/
     pages/          24 routes (Dashboard, CRM, Campaigns, admin/, ...)
     components/     auth, dashboard, editor, email, landing, layout, ops, ui
     hooks/          useSubscription, useAdminCheck, useSendingTimeline, ...
     contexts/       AuthContext, ClientContext
     integrations/   supabase client (auto-generated)
   supabase/
     functions/      13 Deno edge functions
     migrations/     36 SQL migrations, RLS + triggers
   ```
9. **Security & data isolation** — RLS on every table, role table with has_role() security-definer checks, per-client workspace isolation, no client-side role checks.
10. **Closing** — what this stack means for an owner: zero servers to run, self-hostable, scales with managed infrastructure; contact details.

## Design
- Charcoal Minimal palette: charcoal `36454F` dominant, off-white `F2F2F2` content slides, one terracotta accent `B85042`.
- Fonts: Arial Black titles, Calibri body; mono (Consolas) for the code-structure slide.
- Visual motif: small rounded squares with numbers/icons per section; every slide has a shape/diagram element, no plain bullet slides.
- 0.5" margins, 40pt+ titles, 20-24pt body.

## Technical notes
- Generate with pptxgenjs from `/tmp`, save to `/mnt/documents/senddot_tech_stack.pptx`.
- Validate with the PPTX skill (schema validation + auto-repair, markitdown text check), render slides to images and visually inspect at least one fix-and-verify cycle.
- Content is drawn only from the actual repo (package.json, supabase/functions, src layout) — no invented claims.
- No changes to any app code or database. (Note: the earlier login issue is separate — the hosted database is still paused and needs resuming whenever you want to sign in.)
