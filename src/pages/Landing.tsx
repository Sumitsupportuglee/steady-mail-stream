import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
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
  Clock,
} from 'lucide-react';

const features = [
  {
    icon: Send,
    title: 'Campaign Builder',
    description:
      'Create, schedule, and send cold email campaigns with a powerful drag-and-drop editor. Personalize at scale with merge tags.',
  },
  {
    icon: Search,
    title: 'Lead Finder',
    description:
      'Discover high-quality leads by scraping the web or searching by industry. Extract emails, phone numbers, and company details instantly.',
  },
  {
    icon: Users,
    title: 'Contact Management',
    description:
      'Import, organize, and segment your contacts. Track statuses like active, bounced, and unsubscribed automatically.',
  },
  {
    icon: Shield,
    title: 'Domain Verification',
    description:
      'Verify sender identities with DKIM records. Protect your domain reputation and maximize deliverability.',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Analytics',
    description:
      'Track opens, clicks, and deliveries in real time. Understand what works and optimize every campaign.',
  },
  {
    icon: Globe,
    title: 'Sender Identities',
    description:
      'Manage multiple sender identities and domains from one dashboard. Switch between brands effortlessly.',
  },
];

const stats = [
  { value: '99%', label: 'Deliverability' },
  { value: '10x', label: 'Faster Outreach' },
  { value: '50%', label: 'More Replies' },
  { value: '0', label: 'Spam Complaints' },
];

const steps = [
  {
    icon: Target,
    step: '01',
    title: 'Find Leads',
    description: 'Use our Lead Finder to discover prospects by industry, location, or URL.',
  },
  {
    icon: Mail,
    step: '02',
    title: 'Craft Campaigns',
    description: 'Write compelling emails with our rich editor and personalization tokens.',
  },
  {
    icon: Zap,
    step: '03',
    title: 'Send & Track',
    description: 'Launch campaigns and monitor opens, clicks, and replies in real time.',
  },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Mail className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">AgencyMail</span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              How It Works
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <Button asChild>
                <Link to="/dashboard">
                  Dashboard <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/auth">Login</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth">Get Started Free</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-24 text-center md:pt-32">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-primary" />
            Cold email infrastructure built for agencies
          </div>

          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Send Cold Emails That{' '}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Actually Get Replies
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            AgencyMail gives you everything you need to find leads, build campaigns, and land in the
            primary inbox — all from one dashboard.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="h-12 px-8 text-base" asChild>
              <Link to="/auth">
                Start Sending for Free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
              <a href="#features">See All Features</a>
            </Button>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-card p-5">
                <div className="text-3xl font-bold text-primary">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border bg-muted/40 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Everything You Need to Scale Outreach
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              From lead generation to campaign analytics — AgencyMail is the all-in-one cold email
              platform built for agencies and sales teams.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-lg"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Three Steps to More Meetings
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Get up and running in minutes — no complicated setup required.
            </p>
          </div>

          <div className="mt-16 grid gap-10 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.step} className="relative text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-primary">
                  Step {step.step}
                </span>
                <h3 className="mt-2 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Trust */}
      <section className="border-t border-border bg-muted/40 py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Built for Deliverability
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            AgencyMail handles domain verification, DKIM setup, and rate limiting so your emails
            land in the primary inbox — not spam.
          </p>

          <div className="mt-12 grid gap-4 text-left sm:grid-cols-2">
            {[
              'Automatic DKIM & domain verification',
              'Smart rate limiting per hour & day',
              'Bounce & unsubscribe tracking',
              'Open & click tracking pixels',
              'SMTP configuration per sender',
              'Admin-level user & identity management',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="text-sm font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 p-12">
            <Clock className="mx-auto h-10 w-10 text-primary" />
            <h2 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">
              Ready to Fill Your Pipeline?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Join agencies already using AgencyMail to book more meetings with less effort. Start
              free — no credit card required.
            </p>
            <Button size="lg" className="mt-8 h-12 px-10 text-base" asChild>
              <Link to="/auth">
                Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Mail className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">AgencyMail</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} AgencyMail. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
