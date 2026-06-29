import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const sections = [
  { id: "overview", title: "Overview" },
  { id: "domain-reputation", title: "Domain Reputation" },
  { id: "sender-rotation", title: "Sender Rotation" },
  { id: "bounce-rate", title: "Bounce Rate" },
  { id: "open-rate", title: "Open Rate" },
  { id: "click-tracking", title: "Click Tracking" },
  { id: "crm", title: "In-built CRM" },
  { id: "lead-finder", title: "Lead Finder" },
  { id: "campaign-wizard", title: "Campaign Wizard" },
  { id: "queue-limits", title: "Queue & Sending Limits" },
  { id: "warmup", title: "Email Warmup" },
  { id: "integrations", title: "Integrations" },
  { id: "compliance", title: "Unsubscribe & Compliance" },
  { id: "glossary", title: "Glossary" },
];

const Section = ({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) => (
  <section id={id} className="scroll-mt-24 border-b border-border py-10">
    <div className="ops-mono-label">// {id}</div>
    <h2 className="mt-2 font-mono text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
    <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
  </section>
);

const Docs = () => {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Documentation · senddot";
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute("content") ?? "";
    meta?.setAttribute(
      "content",
      "Senddot documentation: domain reputation, sender rotation, bounce & open rate, in-built CRM, lead finder, campaign wizard, warmup, integrations and compliance.",
    );
    return () => {
      document.title = prevTitle;
      if (prevDesc) meta?.setAttribute("content", prevDesc);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card">
              <span className="status-dot" />
            </div>
            <span className="font-mono text-sm font-bold tracking-tight">senddot</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Link>
          </Button>
        </div>
      </nav>

      <header className="border-b border-border py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="ops-mono-label">// documentation</div>
          <h1 className="mt-3 flex items-center gap-3 font-mono text-4xl font-bold tracking-tight md:text-5xl">
            <BookOpen className="h-8 w-8 text-primary" />
            Senddot Documentation
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-muted-foreground md:text-base">
            Everything you need to run reliable, high-deliverability cold email
            campaigns with senddot — from domain reputation to the in-built CRM.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-[220px_1fr]">
        {/* Sub-nav / TOC */}
        <aside className="md:sticky md:top-20 md:self-start">
          <div className="ops-mono-label mb-3">// contents</div>
          <ul className="space-y-1.5">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        <main>
          <Section id="overview" title="Overview">
            <p>
              Senddot is a cold-email and outbound platform built for agencies
              and operators. It combines a campaign engine, a multi-SMTP sending
              layer, a lead finder, and an in-built CRM in one console.
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Multi-client / agency workspace with strict data isolation.</li>
              <li>Queue-first sending via pg_cron — no manual blast triggers.</li>
              <li>Open, click, bounce and reply tracking out of the box.</li>
            </ul>
          </Section>

          <Section id="domain-reputation" title="Domain Reputation">
            <p>
              Your sending domain's reputation is the single biggest factor in
              inbox placement. Senddot expects every sender identity to ship
              from a properly authenticated domain.
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li><strong>SPF</strong> — authorize the SMTP host that sends on your behalf.</li>
              <li><strong>DKIM</strong> — cryptographically sign messages so recipients can verify the sender.</li>
              <li><strong>DMARC</strong> — publish a policy (start at <code>p=none</code>, move to <code>quarantine</code>).</li>
              <li>Use a dedicated sending subdomain (e.g. <code>mail.yourbrand.com</code>) so marketing traffic does not pollute your root domain reputation.</li>
              <li>Senddot auto-verifies major providers (Google, Microsoft) and runs DNS-over-HTTPS checks for custom domains.</li>
            </ul>
          </Section>

          <Section id="sender-rotation" title="Sender Rotation">
            <p>
              Senddot rotates across the SMTP accounts and sender identities
              configured for the campaign so no single mailbox burns out.
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Add multiple SMTP accounts under <Link to="/settings" className="underline">Settings</Link> and multiple sender identities under <Link to="/identities" className="underline">Sender Identities</Link>.</li>
              <li>Each user has configurable daily and hourly quotas — the queue worker respects both.</li>
              <li>If one SMTP fails its quota or auth check, the worker falls back to the next available identity.</li>
              <li>Recommended: at least 2–3 warmed inboxes per active campaign.</li>
            </ul>
          </Section>

          <Section id="bounce-rate" title="Bounce Rate">
            <p>
              Keep bounce rate under <strong>2%</strong>. Above 5% mailbox
              providers start throttling or blocking your domain.
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li><strong>Hard bounce</strong> — invalid mailbox; address is auto-added to the suppression list and never retried.</li>
              <li><strong>Soft bounce</strong> — temporary failure (full mailbox, greylisting); retried with backoff.</li>
              <li>Always verify lists before importing. The CSV importer flags obvious syntax issues, but pre-validation with an external verifier is strongly recommended.</li>
              <li>Suppressed addresses are excluded from every future send across the workspace.</li>
            </ul>
          </Section>

          <Section id="open-rate" title="Open Rate">
            <p>
              Senddot injects a 1×1 tracking pixel before the closing{" "}
              <code>&lt;/body&gt;</code> tag of every HTML email. When the
              recipient's client loads images, the pixel hits{" "}
              <code>/track-open</code> and the open is recorded.
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Healthy B2B cold email open rates land in the <strong>30–55%</strong> range.</li>
              <li>Key drivers: subject line, sender name, send time, and domain reputation.</li>
              <li>Apple Mail Privacy Protection inflates opens — treat opens as directional, not exact.</li>
              <li>Plain-text-only campaigns won't record opens (no pixel).</li>
            </ul>
          </Section>

          <Section id="click-tracking" title="Click Tracking">
            <p>
              All outbound links are rewritten to route through{" "}
              <code>/track-click</code>, which records the click and 302-redirects
              to the original URL. Tracking is per-recipient per-link.
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Unsubscribe and mailto: links are never rewritten.</li>
              <li>Click data feeds the CRM and contact graph automatically.</li>
            </ul>
          </Section>

          <Section id="crm" title="In-built CRM">
            <p>
              The CRM is a Kanban-style pipeline that sits on top of your
              contact graph. Contacts flow from Lead Finder → Contacts →
              Campaigns → CRM stages based on their engagement.
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Auto-classification: <em>active</em>, <em>bounced</em>, <em>replied</em>, <em>unsubscribed</em>.</li>
              <li>Drag deals across stages; activity timeline aggregates opens, clicks and replies per contact.</li>
              <li>Scoped per active client when running in agency workspace mode.</li>
            </ul>
          </Section>

          <Section id="lead-finder" title="Lead Finder">
            <p>
              The Lead Finder uses Firecrawl to discover prospects via web
              search or by scraping a target URL. Results are persisted to a
              private business directory you can re-import any time.
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Adaptive batching keeps API usage predictable.</li>
              <li>Promote any directory entry into Contacts with one click.</li>
              <li>Admins can browse the global master directory of all scraped leads.</li>
            </ul>
          </Section>

          <Section id="campaign-wizard" title="Campaign Wizard">
            <p>A 3-step flow keeps each campaign correctly configured before it can queue.</p>
            <ul className="ml-5 list-disc space-y-1">
              <li><strong>Compose</strong> — rich-text editor (TipTap) with <code>{`{{name}}`}</code> and <code>{`{{email}}`}</code> variables, subject and preview text.</li>
              <li><strong>Audience</strong> — pick contact lists or filters; suppressed and unsubscribed addresses are auto-excluded.</li>
              <li><strong>Review &amp; Queue</strong> — confirm sender identity, schedule and send — the campaign moves <code>Queued → Sending → Completed</code>.</li>
            </ul>
          </Section>

          <Section id="queue-limits" title="Queue & Sending Limits">
            <p>
              Every send goes through a queue processed by pg_cron in batches
              of 50. You never trigger a blast — the worker respects per-user
              quotas and per-SMTP rate limits.
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Daily and hourly limits are configurable per user.</li>
              <li>Failed sends retry with backoff before being marked permanently failed.</li>
              <li>Campaign status is fully managed by the backend — the UI reflects it in real time.</li>
            </ul>
          </Section>

          <Section id="warmup" title="Email Warmup">
            <p>
              New mailboxes ramp up gradually. Senddot exposes a warmup tracker
              with three stages tied to account age:
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li><strong>Stage 1 (0–14 days)</strong> — cap at ~20 sends/day, focus on engagement.</li>
              <li><strong>Stage 2 (15–30 days)</strong> — ramp toward 50–100 sends/day.</li>
              <li><strong>Stage 3 (30+ days)</strong> — full sending volume per your plan limits.</li>
            </ul>
          </Section>

          <Section id="integrations" title="Integrations">
            <p>
              Connect senddot to your existing stack via webhooks and tokens
              from the <Link to="/integrations" className="underline">Integrations</Link> hub.
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Outbound webhooks fire on key events (sent, opened, clicked, replied, bounced, unsubscribed).</li>
              <li>Compatible with Zapier, n8n, HubSpot, Make and any HTTP endpoint.</li>
              <li>Inbound Zapier endpoint lets external tools push contacts into senddot.</li>
            </ul>
          </Section>

          <Section id="compliance" title="Unsubscribe & Compliance">
            <p>
              Every outgoing email includes a one-click unsubscribe link.
              Unsubscribed addresses are added to the workspace suppression list
              instantly and excluded from all future sends.
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Comply with CAN-SPAM, GDPR and India's DPDP — only email contacts who fit your legitimate-interest basis.</li>
              <li>Include a physical address and clear sender identification in every campaign.</li>
              <li>Honour replies asking to stop — process them within 10 days.</li>
            </ul>
          </Section>

          <Section id="glossary" title="Glossary">
            <ul className="ml-5 list-disc space-y-1">
              <li><strong>SPF / DKIM / DMARC</strong> — DNS-based email authentication standards.</li>
              <li><strong>Sender identity</strong> — the From-address + display name pair used on a campaign.</li>
              <li><strong>Suppression list</strong> — addresses permanently excluded from sends.</li>
              <li><strong>Warmup</strong> — gradual ramp of sending volume on a new mailbox.</li>
              <li><strong>Queue worker</strong> — pg_cron job that processes the send queue in batches of 50.</li>
            </ul>
          </Section>

          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Still stuck? We're happy to help.</p>
            <Button asChild className="mt-4">
              <Link to="/contact">Contact support</Link>
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Docs;
