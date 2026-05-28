import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Mail, Phone, MessageSquare } from 'lucide-react';

const EMAILS = ['support@senddot.in', 'ssingh2100.2100@gmail.com'];
const PHONE = '+91-7609933502';

export default function Contact() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card">
              <span className="status-dot" />
            </div>
            <span className="font-mono text-base font-bold tracking-tight">senddot</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" /> Back to Home</Link>
          </Button>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10 text-center">
          <div className="ops-mono-label">// contact</div>
          <h1 className="mt-2 font-mono text-3xl font-bold tracking-tight md:text-4xl">Get in touch</h1>
          <p className="mt-3 text-muted-foreground">
            Questions, partnerships, or support — we&apos;re a message away.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="mb-2 flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg font-mono">Email</CardTitle>
              </div>
              <CardDescription>Reach our team directly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {EMAILS.map((e) => (
                <a
                  key={e}
                  href={`mailto:${e}`}
                  className="block rounded-md border border-border bg-card px-3 py-2 font-mono text-sm transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {e}
                </a>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg font-mono">Phone</CardTitle>
              </div>
              <CardDescription>Call us during business hours (IST).</CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href={`tel:${PHONE.replace(/[^+\d]/g, '')}`}
                className="block rounded-md border border-border bg-card px-3 py-2 font-mono text-sm transition-colors hover:border-primary/40 hover:text-primary"
              >
                {PHONE}
              </a>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <div className="mb-2 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-mono">Partnerships</CardTitle>
            </div>
            <CardDescription>
              Exploring collaborations, integrations, or ownership opportunities?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/partnership">Open partnership inquiry</Link>
            </Button>
          </CardContent>
        </Card>

        <p className="mt-10 text-center font-mono text-xs text-muted-foreground">
          © {new Date().getFullYear()} senddot · OdishaBajar.com
        </p>
      </div>
    </div>
  );
}
