import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { PLANS } from '@/config/plans';
import { useIsIndianUser } from '@/hooks/useGeoLocation';

const ReviewsSection = lazy(() =>
  import('@/components/reviews/ReviewsSection').then((m) => ({ default: m.ReviewsSection }))
);
const UpdatesSection = lazy(() =>
  import('@/components/landing/UpdatesSection').then((m) => ({ default: m.UpdatesSection }))
);
const ElevenLabsWidget = lazy(() =>
  import('@/components/ElevenLabsWidget').then((m) => ({ default: m.ElevenLabsWidget }))
);
import {
  Mail,
  Search,
  Users,
  BarChart3,
  Shield,
  Zap,
  Globe,
  ArrowRight,
  CheckCircle2,
  Send,
  Target,
  Activity,
  Shuffle,
  Sparkles,
  Server,
  GitBranch,
  Gauge,
} from 'lucide-react';

const features = [
  { icon: Send, title: 'Multi-Client Campaigns', description: 'Run outbound sequences for every client from one workspace — isolated data, isolated identities, one operator console.' },
  { icon: Search, title: 'Built-in Lead Finder', description: 'Source verified prospects for each client without paying for a separate scraping stack. Industry, geo, and URL pipelines included.' },
  { icon: Users, title: 'Client-Scoped CRM', description: 'A CRM per client with contact status, replies, and unsubscribes — no external tools, no data leaving your deployment.' },
  { icon: Shield, title: 'Own Your Domains', description: 'Provision unlimited sending domains and identities with SPF, DKIM, and DMARC verification built in.' },
  { icon: BarChart3, title: 'Agency Telemetry', description: 'Per-client dashboards for opens, clicks, deliveries, and bounces — reportable to clients directly from your brand.' },
  { icon: Globe, title: 'White-Label & Self-Host', description: 'Deploy under your own domain and brand. You own the infrastructure, the data, and the client relationship.' },
];

const stats = [
  { value: '99%', label: 'Inbox placement' },
  { value: '10x', label: 'Throughput' },
  { value: '50%', label: 'Reply lift' },
  { value: '0', label: 'Per-seat fees' },
];

const steps = [
  { icon: Target, step: '01', title: 'Deploy', description: 'One-time deployment into your environment, re-branded to your agency.' },
  { icon: Mail, step: '02', title: 'Onboard clients', description: 'Add unlimited client workspaces, sending domains, and inboxes.' },
  { icon: Zap, step: '03', title: 'Send & scale', description: 'Rotate SMTPs, pace sends, and report deliverability per client.' },
];

export default function Landing() {
  const { user } = useAuth();
  const isIndian = useIsIndianUser();
  const standardPrice = isIndian ? '₹25,00,000' : '$30,000';
  const priceNote = isIndian ? 'One-time deployment fee' : 'One-time deployment fee';

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card">
              <span className="status-dot" />
            </div>
            <div className="leading-none">
              <div className="font-mono text-base font-bold tracking-tight">senddot</div>
              <div className="ops-mono-label mt-0.5">agency · outbound · owned</div>
            </div>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">Features</a>
            <a href="#pricing" className="font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">Pricing</a>
            <Link to="/partnership" className="font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">Partners</Link>
            <Link to="/contact" className="font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">Contact</Link>
            <Link to="/docs" className="font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">Documentation</Link>
          </div>



          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild><Link to="/dashboard">Console <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
            ) : (
              <>
                <Button variant="ghost" asChild><Link to="/auth">Login</Link></Button>
                <Button asChild><Link to="/auth">Get Started</Link></Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 ops-grid opacity-25 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        <div className="absolute inset-0 bg-radial-fade" />
        <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-20 md:pt-28">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Headline block */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 backdrop-blur">
                <span className="status-dot" />
                <span className="ops-mono-label text-foreground/80">AGENCY-FIRST · SELF-HOSTED</span>
              </div>

              <h1 className="mt-6 font-mono text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
                The outbound platform<br />
                <span className="text-primary">agencies own.</span>
              </h1>

              <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
                Senddot is the agency-first outbound email infrastructure — deployed into your own environment, re-branded as yours, and built to run unlimited clients, sending domains, and campaigns from one platform. One-time deployment, small monthly maintenance. No per-seat SaaS.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="h-12 px-6 font-mono text-sm uppercase tracking-wider" asChild>
                  <Link to="/contact">Book deployment call <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-6 font-mono text-sm uppercase tracking-wider" asChild>
                  <a href="#features">See the platform</a>
                </Button>
              </div>

              {/* Mini metrics row */}
              <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-md border border-border bg-card/50 p-3 backdrop-blur">
                    <div className="font-mono text-2xl font-bold text-foreground">{s.value}</div>
                    <div className="ops-mono-label mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rotation visualization panel */}
            <div className="lg:col-span-5">
              <div className="ops-glow relative h-full overflow-hidden rounded-xl border border-border bg-card/80 p-5 backdrop-blur">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shuffle className="h-4 w-4 text-primary" />
                    <span className="font-mono text-xs font-semibold uppercase tracking-wider">Rotation Pool</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                    <Sparkles className="h-3 w-3" /> New
                  </span>
                </div>

                <p className="mt-2 text-sm text-muted-foreground">
                  Live load distribution across SMTP nodes &amp; matching sender identities.
                </p>

                <div className="mt-5 space-y-3">
                  {[
                    { label: 'smtp-01 · ses-us-east', share: 28, sent: 1240 },
                    { label: 'smtp-02 · postmark', share: 24, sent: 1060 },
                    { label: 'smtp-03 · sendgrid', share: 22, sent: 970 },
                    { label: 'smtp-04 · custom-relay', share: 16, sent: 710 },
                    { label: 'smtp-05 · zoho', share: 10, sent: 440 },
                  ].map((n) => (
                    <div key={n.label}>
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="flex items-center gap-2 text-foreground/80">
                          <Server className="h-3 w-3 text-primary" />
                          {n.label}
                        </span>
                        <span className="text-muted-foreground">{n.sent.toLocaleString()} · {n.share}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${n.share}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
                  <span>throughput · 4,420 / hr</span>
                  <span className="flex items-center gap-1.5 text-primary"><span className="status-dot" /> healthy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features — bento grid */}
      <section id="features" className="border-b border-border py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div>
              <div className="ops-mono-label">// platform.modules</div>
              <h2 className="mt-2 font-mono text-3xl font-bold tracking-tight md:text-4xl">
                Everything your agency runs outbound on — in one platform you own
              </h2>
            </div>
            <p className="max-w-md text-sm text-muted-foreground">
              Multi-client workspaces, sending domains, CRM, lead sourcing, and deliverability tooling — deployed under your brand, priced as infrastructure, not per seat.
            </p>
          </div>

          <div className="mt-12 grid auto-rows-[minmax(180px,_auto)] grid-cols-1 gap-4 md:grid-cols-6">
            {/* Big tile — rotation pool (NEW) */}
            <div className="ops-glow relative overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-6 md:col-span-4 md:row-span-2">
              <div className="absolute inset-0 ops-grid opacity-30 [mask-image:radial-gradient(ellipse_at_bottom_right,black,transparent_70%)]" />
              <div className="relative">
                <div className="flex items-center gap-2">
                  <Shuffle className="h-5 w-5 text-primary" />
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider">SMTP Rotation Pool</span>
                  <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">New</span>
                </div>
                <h3 className="mt-4 font-mono text-2xl font-bold tracking-tight">Deliverability-aware scaling</h3>
                <p className="mt-3 max-w-md text-sm text-muted-foreground">
                  Distribute volume across a pool of SMTP accounts and sender identities. Senddot synchronizes rotation during dispatch — flattening spikes, respecting provider quotas, and keeping every node within its warm-up curve.
                </p>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[
                    { k: 'spike control', v: 'on' },
                    { k: 'identity sync', v: 'paired' },
                    { k: 'quota guard', v: 'live' },
                  ].map((c) => (
                    <div key={c.k} className="rounded-md border border-border bg-background/40 p-3">
                      <div className="ops-mono-label">{c.k}</div>
                      <div className="mt-1 font-mono text-sm font-semibold text-primary">{c.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Throughput tile */}
            <div className="rounded-xl border border-border bg-card p-5 md:col-span-2">
              <Gauge className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-mono text-lg font-semibold">Throttling engine</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Hourly &amp; daily caps per identity. Adaptive pacing as warm-up progresses.
              </p>
            </div>

            {/* Telemetry tile */}
            <div className="rounded-xl border border-border bg-card p-5 md:col-span-2">
              <Activity className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-mono text-lg font-semibold">Live telemetry</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Stream opens, clicks, and deliveries into the campaign console in real time.
              </p>
            </div>

            {/* Remaining feature tiles */}
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className={`group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 ${
                  i === 0 ? 'md:col-span-3' : i === 1 ? 'md:col-span-3' : 'md:col-span-2'
                }`}
              >
                <div className="flex items-center gap-2">
                  <feature.icon className="h-5 w-5 text-primary" />
                  <span className="ops-mono-label">module / 0{i + 1}</span>
                </div>
                <h3 className="mt-3 font-mono text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-b border-border py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="ops-mono-label">// how.it.works</div>
          <h2 className="mt-2 font-mono text-3xl font-bold tracking-tight md:text-4xl">
            From deployment to sending, in your name
          </h2>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.step} className="relative rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-background">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="font-mono text-3xl font-bold text-muted-foreground/40">{step.step}</span>
                </div>
                <h3 className="mt-4 font-mono text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
                {i < steps.length - 1 && (
                  <GitBranch className="absolute -right-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-border md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deliverability */}
      <section className="border-b border-border bg-card/30 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <div className="ops-mono-label">// deliverability</div>
              <h2 className="mt-2 font-mono text-3xl font-bold tracking-tight md:text-4xl">
                Deliverability engineered for agency scale
              </h2>
              <p className="mt-4 max-w-lg text-muted-foreground">
                Authentication, SMTP rotation, throttling, and reputation monitoring — wired into one pipeline so every client's messages land in the inbox, not the spam folder.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                'Automatic DKIM &amp; domain verification',
                'Hourly &amp; daily rate limiting',
                'Bounce &amp; unsubscribe tracking',
                'Open &amp; click telemetry',
                'Per-identity SMTP routing',
                'Admin user &amp; identity controls',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-md border border-border bg-card p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm" dangerouslySetInnerHTML={{ __html: item }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <ReviewsSection />
        <UpdatesSection />
      </Suspense>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-16">
            <div className="ops-mono-label">// pricing.tiers</div>
            <h2 className="mt-2 font-mono text-3xl font-bold tracking-tight md:text-4xl">Simple, transparent pricing</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Choose the plan that fits your fleet. Cancel anytime.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
            {PLANS.map((plan) => {
              const isBusiness = plan.id === 'business';
              const monthly = plan.pricing.inr.monthly;
              const yearly = plan.pricing.inr.yearly;
              const savings = monthly * 12 - yearly;
              return (
                <div key={plan.id} className={isBusiness ? 'ops-glow relative rounded-xl border border-primary bg-card p-8' : 'rounded-xl border border-border bg-card p-8'}>
                  {isBusiness && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground font-mono text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">Most Popular</span>
                    </div>
                  )}
                  <h3 className="font-mono text-xl font-semibold">{plan.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground min-h-[40px]">{plan.description}</p>
                  <div className="mt-4">
                    <span className="font-mono text-4xl font-bold">₹{monthly.toLocaleString('en-IN')}</span>
                    <span className="text-muted-foreground"> / month</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">or ₹{yearly.toLocaleString('en-IN')}/year · save ₹{savings.toLocaleString('en-IN')}</p>
                  <ul className="mt-6 space-y-3 text-left text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button size="lg" variant={isBusiness ? 'default' : 'outline'} className="w-full mt-8 font-mono text-sm uppercase tracking-wider" asChild>
                    <Link to="/auth">Get Started</Link>
                  </Button>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">Prices shown in INR. USD pricing available at checkout based on your location.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card">
              <span className="status-dot" />
            </div>
            <span className="font-mono font-semibold">senddot</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/partnership" className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">Partnership</Link>
            <Link to="/contact" className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            <Link to="/terms" className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">Terms</Link>

          </div>
          <p className="font-mono text-xs text-muted-foreground">© {new Date().getFullYear()} senddot · OdishaBajar.com</p>
        </div>
      </footer>

      <Suspense fallback={null}>
        <ElevenLabsWidget />
      </Suspense>
    </div>
  );
}
