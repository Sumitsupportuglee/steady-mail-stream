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

        <p>Welcome to Senddot by OdishaBajar.com ("we," "us," or "our"). Senddot is an agency-first outbound email infrastructure that agencies license, own, and self-host under their own brand. By accessing our website, engaging us for deployment, or using a Senddot instance, you ("Agency," "Customer," or "you") agree to these Terms and Conditions.</p>

        <h2 className="text-xl font-semibold mt-8">1. Acceptance of Terms</h2>
        <p>By signing a deployment order, making payment, or using any Senddot instance we deploy for you, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree, you must not engage the Service.</p>

        <h2 className="text-xl font-semibold mt-8">2. Description of Service</h2>
        <p>Senddot is a self-hosted, white-label outbound email platform designed for agencies to run outbound campaigns for multiple clients from a single owned environment. Modules include campaign builder, multi-client workspaces, sending domain and sender identity management, SMTP rotation pool, deliverability telemetry, lead finder, and an in-built CRM. We deliver Senddot as a one-time deployment onto your own infrastructure, followed by an optional monthly maintenance and support subscription.</p>

        <h2 className="text-xl font-semibold mt-8">3. Commercials</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Standard tier:</strong> a one-time deployment fee (USD 30,000 / INR 25,00,000, jurisdiction-dependent) that includes onboarding, re-branding of the platform to the Agency's identity, deployment into the Agency's environment, white-label rights, the bundled contact finder, and no per-seat or per-send usage limits imposed by us. Standard tier does not include re-selling rights.</li>
          <li><strong>Custom tier:</strong> negotiated commercials for larger agencies requiring exclusivity, deeper customization, or re-selling rights. Terms, price, and scope are set out in the signed order for that engagement.</li>
          <li><strong>Monthly maintenance:</strong> a small recurring fee covers updates, patches, and support as scoped in the order. Maintenance is optional but recommended; instances without an active maintenance agreement will not receive updates or support from us.</li>
          <li>Pricing shown on the website in INR applies to customers in India; USD pricing applies elsewhere. Applicable taxes are additional.</li>
          <li>Deployment fees are non-refundable once deployment work has commenced, except as required by applicable law.</li>
          <li>We may revise published pricing with 30 days' prior notice; signed orders honor their agreed price.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8">4. License and Ownership</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Upon full payment of the deployment fee, you receive a perpetual, non-exclusive license to operate the deployed Senddot instance within your own environment and under your own brand.</li>
          <li>Standard tier does not grant the right to re-sell, sub-license, or redistribute the Senddot software as a product. Re-selling rights are only available under a Custom tier order that expressly grants them.</li>
          <li>Underlying source code, trademarks (excluding your applied re-brand), architecture, and platform know-how remain the intellectual property of OdishaBajar.com. You may not reverse-engineer or redistribute the platform outside the terms of your order.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8">5. Deployment, Hosting, and Client Data</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Senddot is deployed into infrastructure that you own or control. You are the operator of the deployed instance and the data controller for all data your team and your clients put into it.</li>
          <li>You are responsible for hosting costs, third-party services (SMTP, DNS, storage, AI providers), backups, security hardening, and lawful handling of end-client data.</li>
          <li>We do not have standing access to your production data. Any support access requires your explicit invitation and is limited to what is needed to resolve the issue.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8">6. Acceptable Use</h2>
        <p>You, and any client workspace on your instance, agree not to use Senddot to:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Send unsolicited bulk email (spam) in violation of applicable anti-spam laws, including CAN-SPAM, CASL, GDPR/PECR, and India's IT Act and rules.</li>
          <li>Transmit malware, phishing content, fraudulent offers, or content that impersonates a person or entity.</li>
          <li>Harvest email addresses or personal data without a lawful basis or consent where required.</li>
          <li>Circumvent rate limits, deliverability safeguards, or authentication (SPF/DKIM/DMARC) requirements of receiving providers.</li>
          <li>Violate any applicable local, national, or international law.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8">7. Deliverability and Compliance Responsibility</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>You are solely responsible for the content, targeting, and legality of emails sent through your instance and by any client workspace hosted on it.</li>
          <li>All marketing emails sent through Senddot must include a valid physical address and a working unsubscribe mechanism, and unsubscribe requests must be honored within 10 business days.</li>
          <li>You are responsible for configuring sending domains correctly (SPF, DKIM, DMARC) and for the reputation of the sending accounts and domains you connect.</li>
          <li>We may refuse continued support for any instance that repeatedly generates excessive bounce or complaint rates, or is used to send unlawful content.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8">8. Website Accounts</h2>
        <p>Accounts created on senddot.odishabajar.com (this marketing and evaluation site) are for evaluation, partnership inquiries, and communication with us. They do not by themselves grant a license to the Senddot platform. Licensed use is governed by your signed deployment order.</p>

        <h2 className="text-xl font-semibold mt-8">9. Service Availability and Support</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Because Senddot runs in your environment, availability of the deployed instance is your responsibility.</li>
          <li>Our support obligations (response times, update cadence, incident support) are those set out in the maintenance subscription associated with your order.</li>
          <li>We are not liable for downtime, deliverability outcomes, or losses caused by third-party providers, misconfiguration, or events outside our reasonable control.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8">10. Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, Senddot by OdishaBajar.com shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, revenue, data, goodwill, or business opportunities, arising from your use of the Service. Our aggregate liability under any order shall not exceed the fees actually paid by you under that order in the 12 months preceding the claim.</p>

        <h2 className="text-xl font-semibold mt-8">11. Termination</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Either party may terminate the maintenance subscription in accordance with the order. Termination of maintenance ends future updates and support but does not revoke your license to continue operating the already-deployed instance, subject to Section 4.</li>
          <li>We may suspend or terminate maintenance for material breach of these Terms, including unlawful use of the platform, that is not cured within a reasonable notice period.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8">12. Governing Law</h2>
        <p>These Terms shall be governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Odisha, India, unless a signed order expressly agrees to a different jurisdiction.</p>

        <h2 className="text-xl font-semibold mt-8">13. Changes to Terms</h2>
        <p>We may update these Terms from time to time. Changes take effect when posted. Continued engagement of the Service after changes are posted constitutes acceptance of the updated Terms. Commercial terms in a signed order prevail over these general Terms to the extent of any conflict.</p>

        <h2 className="text-xl font-semibold mt-8">14. Contact Us</h2>
        <p>
          For questions about these Terms, deployment, or partnerships, visit our{' '}
          <Link to="/contact" className="text-primary underline-offset-4 hover:underline">Contact page</Link>{' '}
          or reach us at support@senddot.in / ssingh2100.2100@gmail.com / +91-7609933502.
        </p>

        <div className="mt-12 border-t border-border pt-8">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Senddot by OdishaBajar.com. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
