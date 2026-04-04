

## Plan: Email Provider Selection, SMTP Presets Expansion, and Setup Instructions

### Overview
Three changes: (1) Add email provider dropdown to Sender Identities dialog that controls whether DNS verification is needed, (2) expand SMTP presets with more US providers, (3) add expandable instruction cards to both pages.

### 1. Sender Identities — Email Provider Dropdown (`src/pages/SenderIdentities.tsx`)

- Add a `Select` dropdown in the "Add Identity" dialog with options: **Gmail**, **Yahoo**, **Outlook**, **Other**
- Store the selected provider in a new state variable `emailProvider`
- Save the provider value to a new column `email_provider` on the `sender_identities` table (migration needed)
- **Gmail/Yahoo/Outlook**: After adding, show a success message: "No DNS configuration is needed for this provider. Your identity is ready to use." Auto-set `domain_status` to `verified`.
- **Other**: Show the existing DNS verification flow (CNAME record + verify button). Set `domain_status` to `unverified`.
- In the DNS Configuration panel on the right, conditionally show: if provider is Gmail/Yahoo/Outlook, show "No DNS setup required" info card instead of DNS records.

**Database migration**: Add `email_provider` text column (nullable, default null) to `sender_identities`.

### 2. SMTP Presets Expansion (`src/pages/Settings.tsx`)

Add these providers to `SMTP_PRESETS`:
- **IONOS** — `smtp.ionos.com`, SSL 465, TLS 587
- **iCloud Mail** — `smtp.mail.me.com`, SSL 0, TLS 587
- **AOL** — `smtp.aol.com`, SSL 465, TLS 587
- **Fastmail** — `smtp.fastmail.com`, SSL 465, TLS 587
- **ProtonMail Bridge** — `127.0.0.1`, SSL 0, TLS 1025
- **Rackspace** — `secure.emailsrvr.com`, SSL 465, TLS 587
- **Amazon SES** — `email-smtp.us-east-1.amazonaws.com`, SSL 465, TLS 587

Add corresponding `SelectItem` entries in the dropdown.

### 3. Expandable Instruction Cards (Both Pages)

Use the existing `Accordion` component from `src/components/ui/accordion.tsx`.

**Settings page** — Add an accordion above the SMTP form with items:
- "How to find your SMTP credentials" — step-by-step for Gmail (App Password), Outlook, Zoho, IONOS, etc.
- "Which encryption should I use?" — TLS vs SSL explanation
- "Troubleshooting connection issues" — common fixes

**Sender Identities page** — Add an accordion at the top:
- "What is a Sender Identity?" — explains from-name/from-email concept
- "Do I need DNS verification?" — explains Gmail/Yahoo/Outlook skip vs custom domains
- "How to add DNS records" — step-by-step guide for popular registrars

### Files Modified
- `src/pages/SenderIdentities.tsx` — provider dropdown, conditional DNS flow, instruction accordion
- `src/pages/Settings.tsx` — expanded presets, instruction accordion
- Database migration — add `email_provider` column to `sender_identities`

