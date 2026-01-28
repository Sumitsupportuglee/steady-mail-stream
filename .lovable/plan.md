

# AgencyMail - Complete Build Plan

## Overview
A managed cold email infrastructure SaaS with a queue-first architecture for safe email delivery. Clean, light modern design with real email tracking capabilities.

---

## Phase 1: Foundation & Database Setup

### Database Schema (5 Tables with RLS)
- **profiles** - User accounts with organization name, email credits (unlimited for now), and tier
- **sender_identities** - Custom domains with verification status and DKIM records
- **contacts** - Lead management with email, name, and status tracking
- **campaigns** - Email campaigns with subject, body, status, and recipient counts
- **email_queue** - The throttling engine with pending/sent/failed status tracking

### Security & RLS Policies
- All tables will have Row Level Security enabled
- Users can only access their own data across all tables
- Security definer functions for role-based access patterns

---

## Phase 2: Core UI Components

### Navigation & Layout
- Clean sidebar navigation with:
  - Dashboard
  - Sender Identities
  - Contacts
  - Campaigns
  - Settings (placeholder)
- Light, modern design with subtle shadows and clean typography

### Dashboard Page
- **Credit Balance Display** - Large, prominent card showing available credits
- **Quick Stats Cards** - Emails sent (30 days), Open rate, Click rate
- **Recent Activity** - Last 5 campaigns with status indicators
- **Quick Actions** - "New Campaign" and "Add Contacts" buttons

---

## Phase 3: Sender Identity Management

### Domain Setup Flow
- **Add Identity Form** - Name and email address input
- **Verification Card** - Displays after adding an identity:
  - DNS configuration instructions
  - CNAME record details (Host: `em123`, Value: placeholder for provider)
  - Copy-to-clipboard functionality
  - Status badge (Unverified/Verified)
- **Identity List** - Table of all sender identities with verification status

---

## Phase 4: Contact Manager

### Contact List
- Sortable, searchable table of all contacts
- Columns: Name, Email, Status, Date Added
- Inline status indicators (Active, Bounced, Unsubscribed)
- Bulk actions: Delete selected

### CSV Import Feature (Critical)
- **Step 1**: File upload with drag-and-drop
- **Step 2**: Column mapping interface (auto-detect "Email" and "Name")
- **Step 3**: Preview imported data
- **Step 4**: Bulk insert with progress indicator
- Validation: Email format checking, duplicate detection

---

## Phase 5: Campaign Wizard

### 3-Step Campaign Creation
**Step 1: Compose**
- Subject line input
- Rich text editor (TipTap) for HTML email body
- Template variable support: `{{name}}`, `{{email}}`

**Step 2: Select Audience**
- Choose from: All Active Contacts, or specific contacts
- Preview recipient count
- Sender identity selection (from verified identities only)

**Step 3: Review & Queue**
- Campaign summary with cost calculation
- Credit balance check
- "Queue Campaign" button triggers:
  1. Credit deduction (when payment added later)
  2. Campaign creation with status 'queued'
  3. Bulk insert into `email_queue` table
  4. Success message: "Campaign Queued. Sending will start automatically."

---

## Phase 6: Email Tracking System

### Tracking Implementation
- **Open Tracking**: Transparent 1x1 pixel image embedded in emails
- **Click Tracking**: URL rewriting through tracking endpoint
- **Tracking Tables**: 
  - `email_opens` - Logs each open event with timestamp
  - `email_clicks` - Logs each click with URL and timestamp

### Analytics Dashboard Updates
- Real open rates calculated from tracking data
- Click-through rates per campaign
- Timeline charts for email activity

---

## Phase 7: Backend - Queue Processor

### Edge Function: `process-queue`
- **Trigger**: Cron job (every minute)
- **Batch Size**: 50 pending emails per run
- **Process**:
  1. Fetch 50 rows with status 'pending'
  2. Authenticate with `MASTER_SMTP_KEY` (env variable)
  3. For each email:
     - Inject List-Unsubscribe header
     - Inject tracking pixel
     - Rewrite links for click tracking
     - Send via SMTP provider
     - Update status to 'sent' or 'failed'
     - Log errors if failed
  4. Return summary: `{ processed: 50, success: 49, errors: 1 }`

### Supporting Edge Functions
- **track-open**: Records email opens from tracking pixel requests
- **track-click**: Records clicks and redirects to original URL

---

## Phase 8: Polish & Final Features

### Campaign Management
- Campaign list with status filters (Draft, Queued, Sending, Completed)
- Campaign detail view with delivery stats
- Queue progress indicator for active campaigns

### Error Handling & UX
- Toast notifications for all actions
- Loading states throughout
- Empty states with helpful prompts
- Form validation with clear error messages

---

## Tech Stack Summary
- **Frontend**: React + TypeScript + Tailwind CSS
- **UI Components**: Shadcn/ui + TipTap Editor
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **Email Provider**: Flexible design (credentials added later)
- **Scheduling**: Supabase Cron for queue processing

