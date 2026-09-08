# Migrate off Lovable Cloud → Your own external Supabase

## Goal & context
This project runs on **Lovable Cloud** (a managed Supabase instance). Cloud usage is billed in Lovable credits, and you want to stop that drain by hosting the database yourself on an external Supabase project, billed directly by Supabase. You want a **new project** approach and need to **keep all existing data** (users, campaigns, contacts, CRM leads, SMTP accounts, etc.).

The repo already contains everything needed: **36 migrations** (~1,300 SQL lines, 24 tables, enums, functions, triggers, RLS) and **13 edge functions**. So this is a migration, not a rebuild.

## Reality check (important)
- **Cloud cannot be cleanly disconnected without losing data.** Disconnecting via Cloud → Advanced → Disconnect is *irreversible* and deletes all DB, storage, and functions. So we export data **first**, while Cloud is still alive.
- **Auth users can't be moved with passwords intact.** Supabase stores password hashes in the `auth` schema, which is not exportable and not portable. Existing users keep their email and all their business data, but each will set a fresh password on the new project (via invite/reset).
- **External Supabase free tier limits**: 500 MB DB, 1 GB storage, paused after inactivity. A sending platform can outgrow this — recommend the Supabase **Pro** tier (~$25/mo) for production.
- **Cost trade-off**: external Supabase stops the Lovable Cloud credit drain, but migration itself uses some build credits, and you'll pay Supabase directly going forward.

## Plan (phased)

### Phase 1 — Provision external Supabase (you do, I guide)
1. Create a Supabase project at supabase.com (region close to your users; Pro tier recommended).
2. In the dashboard, enable **pg_cron**: SQL Editor → `CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;` and ensure `pg_net` is available (it is by default).
3. Note down: Project URL, anon key, service role key, database password.

### Phase 2 — Recreate the schema (I prepare, you run)
1. I concatenate all 36 migration files into a single ordered `schema.sql` (no project-specific values — already verified clean).
2. You run `schema.sql` in the new project's SQL Editor. This creates all 24 tables, enums, functions, triggers, RLS policies, and GRANTs.
3. You set up the auth-user-creation trigger (`handle_new_user`) and `on_auth_user_created` trigger — included in the concatenated SQL.

### Phase 3 — Migrate data (I export; remap users; you import)
Order matters because of foreign keys.

1. **Export from Cloud** (while it's alive): I query each table via the read tool and write CSV/INSERT dumps to a local folder, table by table.
2. **Auth users** (the hard part):
   - I extract `auth.users` rows: id, email, created_at, etc. (no password).
   - In the new project, recreate each user via the Supabase Admin API (`auth.admin.createUser`) with the same email. This assigns a **new UUID** to each user.
   - I build an **old-UUID → new-UUID mapping** keyed by email.
   - All `user_id` foreign keys across tables (`profiles`, `campaigns`, `contacts`, `crm_leads`, `smtp_accounts`, `email_queue`, `subscriptions`, `sender_identities`, etc.) are remapped to the new UUIDs during import.
   - Each recreated user receives a password-reset/invite email so they set a fresh password.
3. **Import order** (respecting FKs): `profiles` → `clients` → `contacts` / `contact_categories` → `sender_identities` → `smtp_accounts` → `campaigns` → `email_queue` → `email_opens` / `email_clicks` / `email_unsubscribes` → `crm_leads` → `integrations` / `integration_tokens` / `webhook_logs` / `reviews` / `lead_searches` / `business_directory` / `master_business_directory` / `app_updates` / `partnership_inquiries` → `user_roles`.
   - I provide remapped INSERT scripts per table; you run them in the SQL Editor (or I deliver one consolidated `data.sql`).
4. **Primary keys**: I preserve original UUIDs for all non-auth tables so internal FKs (campaign→smtp, queue→campaign/contact/smtp, opens/clicks→queue) stay valid. Only `user_id` values change (per the mapping), plus `auth.users`-linked `profiles.id`.

### Phase 4 — Recreate backend functions + secrets (you do)
1. Deploy all 13 edge functions to the new project (via Supabase CLI `supabase functions deploy`, or dashboard). The Deno source is in `supabase/functions/`.
2. Re-create every secret in the new project's Edge Function secrets / Vault:
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
   - `FIRECRAWL_API_KEY`
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SES_REGION`
   - `SMTP_ENCRYPTION_KEY`
   - Supabase URL / service role / anon keys (auto-present in the new project)
3. Recreate the **pg_cron** scheduled job that invokes `process-queue` (the queue sender), pointing the job's URL at the new project.

### Phase 5 — Repoint the Lovable app (new project)
1. Create a **new Lovable project** from this repo (import / duplicate), and connect it to your external Supabase in project settings (Supabase connector). This sets `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` to the external project.
2. Reconfigure auth providers on the new Supabase:
   - Email/password (on, auto-confirm as currently configured)
   - Google OAuth (if used) — update the redirect URI to the new project's callback URL, and point the app's OAuth redirect to `window.location.origin`.
3. Update webhook endpoints in external services:
   - Razorpay webhook → new project's `razorpay` function URL
   - Any Zapier/n8n inbound → new `zapier-inbound` URL
4. Re-point any custom domain (`senddot...`) to the new Lovable project.

### Phase 6 — Validate & cut over
1. Smoke-test on the new project: sign in (password reset flow), create a test campaign, send a small batch, confirm opens/clicks tracking, CRM lead auto-creation, unsubscribe trigger, payment flow (Razorpay/PayPal).
2. Verify data integrity: row counts per table match the old project.
3. Cut over DNS / domain to the new project and decommission Cloud usage on the old project (leave it read-only or disconnect only after you've confirmed the new one).

## What I can do from here vs. what you must do
- **I can**: build `schema.sql`; export and remap all data into import scripts; guide each external step; deploy functions / set secrets only if the *new* project becomes the connected one in a follow-up session.
- **You must** (requires your accounts): create the external Supabase project and new Lovable project; run SQL in the Supabase dashboard; provision Razorpay/Google/Firecrawl credentials; update DNS and webhook URLs.

## Open item to confirm before starting
- **User count & appetite for password resets**: every migrated end-user will need to set a new password on the new project (Supabase won't export password hashes). If that's unacceptable, the only alternative is to keep auth on Cloud — but that defeats the goal, so we proceed with resets unless you say otherwise.
