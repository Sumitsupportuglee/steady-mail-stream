import { useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Handshake } from 'lucide-react';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Invalid email').max(255),
  contact_number: z.string().trim().min(5, 'Contact number is required').max(30),
  country: z.string().trim().min(1, 'Country is required').max(80),
});

export default function PartnershipInquiry() {
  const [form, setForm] = useState({ name: '', email: '', contact_number: '', country: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: 'Invalid input', description: parsed.error.errors[0].message, variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('partnership_inquiries').insert(parsed.data as any);
    setSubmitting(false);
    if (error) {
      toast({ title: 'Submission failed', description: error.message, variant: 'destructive' });
      return;
    }
    setSubmitted(true);
    setForm({ name: '', email: '', contact_number: '', country: '' });
    toast({ title: 'Inquiry submitted', description: 'Thanks! We will reach out shortly.' });
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Home
        </Link>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Handshake className="w-6 h-6 text-primary" />
              <CardTitle>Inquire for Partnership</CardTitle>
            </div>
            <CardDescription>
              Interested in collaborating with us? Share your details and we'll get in touch.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="text-center py-8">
                <h3 className="text-lg font-semibold mb-2">Thank you!</h3>
                <p className="text-muted-foreground mb-6">Your inquiry has been received. We will contact you soon.</p>
                <Button onClick={() => setSubmitted(false)} variant="outline">Submit another</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" value={form.name} maxLength={100}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input id="email" type="email" value={form.email} maxLength={255}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_number">Contact Number *</Label>
                  <Input id="contact_number" type="tel" value={form.contact_number} maxLength={30}
                    onChange={(e) => setForm({ ...form, contact_number: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <Input id="country" value={form.country} maxLength={80}
                    onChange={(e) => setForm({ ...form, country: e.target.value })} required />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Inquiry'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
