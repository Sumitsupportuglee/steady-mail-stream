export interface PlanConfig {
  id: 'starter' | 'business';
  name: string;
  description: string;
  maxSmtp: number;
  maxSenderIdentities: number;
  features: string[];
  pricing: {
    inr: { monthly: number; yearly: number };
    usd: { monthly: number; yearly: number };
  };
}

export const PLANS: PlanConfig[] = [
  {
    id: 'starter',
    name: 'Monthly Subscription',
    description: 'Full premium access on a simple monthly plan — no deployment required',
    maxSmtp: 5,
    maxSenderIdentities: 5,
    features: [
      'Unlimited contact extraction',
      'Up to 5 email sending accounts (SMTP)',
      'Up to 5 sender identities',
      'Unlimited AI credits for composing & editing emails',
      'Email campaigns with rotation pool',
      'Lead Finder with web scraping',
      'Open & click tracking',
      'Domain verification (SPF/DKIM/DMARC)',
      'Real-time analytics',
    ],
    pricing: {
      inr: { monthly: 3499, yearly: 34999 },
      usd: { monthly: 49, yearly: 499 },
    },
  },

  {
    id: 'business',
    name: 'Business',
    description: 'Best for agencies and teams scaling their outreach with advanced features',
    maxSmtp: 8,
    maxSenderIdentities: 8,
    features: [
      'Up to 8 SMTP accounts',
      'Up to 8 sender identities',
      'Everything in Starter',
      'Priority support',
      'Advanced analytics',
      'Dedicated onboarding',
      'CRM integration',
      'Webhook & Zapier support',
    ],
    pricing: {
      inr: { monthly: 7999, yearly: 79999 },
      usd: { monthly: 139, yearly: 1399 },
    },
  },
];

export function getPlanById(planId: string): PlanConfig | undefined {
  if (planId.startsWith('starter')) return PLANS[0];
  if (planId.startsWith('business')) return PLANS[1];
  // Legacy plan mapping
  if (planId === 'monthly' || planId === 'yearly') return PLANS[0];
  return undefined;
}

export function getPlanLimits(planId: string | undefined | null) {
  const plan = planId ? getPlanById(planId) : undefined;
  return {
    maxSmtp: plan?.maxSmtp ?? 3,
    maxSenderIdentities: plan?.maxSenderIdentities ?? 3,
  };
}
