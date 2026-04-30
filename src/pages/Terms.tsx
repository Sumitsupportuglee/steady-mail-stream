import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Mail className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">Senddot</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" /> Back to Home</Link>
          </Button>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-6 py-16 prose prose-neutral dark:prose-invert">
        <h1 className="text-3xl font-bold tracking-tight">Terms and Conditions</h1>
        <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <p>Welcome to Senddot by OdishaBajar.com ("we," "us," or "our"). By accessing or using our platform at senddot.odishabajar.com (the "Service"), you agree to be bound by these Terms and Conditions.</p>

        <h2 className="text-xl font-semibold mt-8">1. Acceptance of Terms</h2>
        <p>By creating an account or using the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree, you must not use the Service.</p>

        <h2 className="text-xl font-semibold mt-8">2. Description of Service</h2>
        <p>Senddot is a cold email outreach platform that provides lead generation, email campaign management, contact management, sender identity verification, and analytics tools. Access to core features requires an active paid subscription.</p>

        <h2 className="text-xl font-semibold mt-8">3. Account Registration</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>You must provide accurate and complete information during registration.</li>
          <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
          <li>You must be at least 18 years old to use the Service.</li>
          <li>One person or legal entity may maintain only one account.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8">4. Subscription and Payments</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>The Service offers Monthly (₹2,499/month) and Yearly (₹24,999/year) subscription plans.</li>
          <li>Payments are processed securely through Razorpay. By subscribing, you also agree to Razorpay's terms of service.</li>
          <li>Subscriptions auto-expire at the end of the billing period. There are no automatic renewals at this time.</li>
          <li>All payments are non-refundable unless otherwise required by applicable law.</li>
          <li>We reserve the right to change pricing with 30 days' prior notice.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8">5. Acceptable Use Policy</h2>
        <p>You agree NOT to use the Service to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Send unsolicited bulk emails (spam) in violation of applicable anti-spam laws including CAN-SPAM Act, GDPR, and India's IT Act.</li>
          <li>Transmit malware, phishing attempts, or fraudulent content.</li>
          <li>Harvest email addresses or personal data without consent.</li>
          <li>Impersonate any person or entity.</li>
          <li>Violate any applicable local, state, national, or international law.</li>
          <li>Exceed rate limits or attempt to circumvent platform restrictions.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8">6. Email Sending & Compliance</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>You are solely responsible for the content of emails sent through the platform.</li>
          <li>You must include a valid physical address and an unsubscribe mechanism in all marketing emails.</li>
          <li>You must honor unsubscribe requests within 10 business days.</li>
          <li>We reserve the right to suspend or terminate accounts that generate excessive bounce rates or spam complaints.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8">7. Data Privacy</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>We collect and process personal data as necessary to provide the Service.</li>
          <li>Your SMTP credentials are stored securely and used only for sending emails on your behalf.</li>
          <li>We do not sell, rent, or share your personal data with third parties for marketing purposes.</li>
          <li>You are responsible for ensuring that your use of contact data complies with applicable data protection laws.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8">8. Intellectual Property</h2>
        <p>All content, trademarks, and technology associated with the Service are owned by OdishaBajar.com. You may not copy, modify, distribute, or reverse-engineer any part of the Service without prior written consent.</p>

        <h2 className="text-xl font-semibold mt-8">9. Service Availability</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>We strive to maintain 99.9% uptime but do not guarantee uninterrupted access.</li>
          <li>We may perform scheduled maintenance with reasonable prior notice.</li>
          <li>We are not liable for any loss arising from service interruptions beyond our control.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8">10. Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, Senddot by OdishaBajar.com shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities, arising from your use of the Service.</p>

        <h2 className="text-xl font-semibold mt-8">11. Termination</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>We may suspend or terminate your account at any time for violation of these Terms.</li>
          <li>You may close your account at any time by contacting support.</li>
          <li>Upon termination, your data will be retained for 30 days before permanent deletion.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8">12. Governing Law</h2>
        <p>These Terms shall be governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Odisha, India.</p>

        <h2 className="text-xl font-semibold mt-8">13. Changes to Terms</h2>
        <p>We reserve the right to update these Terms at any time. Changes will be effective upon posting to the Service. Continued use after changes constitutes acceptance of the updated Terms.</p>

        <h2 className="text-xl font-semibold mt-8">14. Contact Us</h2>
        <p>If you have any questions about these Terms, please contact us at:</p>
        <p className="font-medium">Email: support@senddot.in</p>

        <div className="mt-12 border-t border-border pt-8">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Senddot by OdishaBajar.com. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
