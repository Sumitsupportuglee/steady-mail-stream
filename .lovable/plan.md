## Goal
Replace the "How" link in the landing nav with a "Documentation" link that routes to a new standalone `/docs` page. Keep the existing "How It Works" section on the landing page intact (only the nav entry is removed). New nav order: Features, Pricing, Partners, Contact, Documentation.

## Changes

### 1. New page: `src/pages/Docs.tsx`
A standalone documentation page styled to match Landing/Contact (mono font, sticky nav, bordered sections). Content organized into sections with anchored sub-nav (table of contents):

- **Overview** — what senddot is, who it's for
- **Domain Reputation** — SPF/DKIM/DMARC, warm-up, why custom domains matter, how senddot tracks domain health
- **Sender Rotation** — how multiple sender identities/SMTP accounts are rotated, daily/hourly per-sender quotas, fallback config
- **Bounce Rate** — hard vs soft bounces, suppression list, recommended thresholds, how to keep it under 2%
- **Open Rate** — 1×1 tracking pixel, benchmarks, factors (subject line, sender name, timing), privacy notes
- **Click Tracking** — href rewriting, how `/track-click` works
- **In-built CRM** — Kanban pipeline, contact graph, lead → contact → campaign flow
- **Lead Finder** — Firecrawl-powered web search & URL scraping, business directory persistence
- **Campaign Wizard** — 3-step flow (Compose, Audience, Review & Queue), {{name}} / {{email}} variables
- **Queue & Sending Limits** — pg_cron batches of 50, daily/hourly quotas per user
- **Email Warmup** — 3-stage health progression
- **Integrations** — webhooks, tokens, Zapier/n8n/HubSpot
- **Unsubscribe & Compliance** — one-click unsubscribe, suppression handling
- **Glossary** — quick terms reference

Each section gets a short paragraph + bullet list of best practices. Single `<h1>` ("Senddot Documentation"); each topic uses `<h2>`. Includes `<title>` and meta description via document.title for basic SEO.

### 2. Route registration: `src/App.tsx`
- Add `const Docs = lazyWithRetry(() => import("./pages/Docs"));`
- Add `<Route path="/docs" element={<Docs />} />` in the public routes block.

### 3. Landing nav update: `src/pages/Landing.tsx`
- Remove the `#how-it-works` anchor link from the nav (line 78).
- Append `<Link to="/docs">Documentation</Link>` after Contact.
- Final nav order: Features, Pricing, Partners, Contact, Documentation.
- The "How It Works" section itself (line 273) stays on the page — only the nav entry is replaced.

### 4. Sitemap: `public/sitemap.xml`
Add `/docs` entry (priority 0.7, changefreq monthly).

## Out of scope
- No backend changes, no schema changes.
- No rewriting of the existing "How It Works" section content (the section remains; only the nav link changes).
- Per-route SEO via react-helmet-async is still deferred (consistent with prior decision); the new page sets `document.title` on mount instead.

## Confirm
Should the mobile nav (if present) mirror the same order? Currently the landing nav is desktop-only (`hidden md:flex`), so mobile users see no nav links — I'll leave that as-is unless you want a mobile menu added.
