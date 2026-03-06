import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, Crown, Loader2, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const plans = [
  {
    id: 'monthly' as const,
    name: 'Monthly',
    price: '₹2,499',
    priceNum: 2499,
    period: '/month',
    description: 'Perfect for getting started with cold email outreach',
    features: [
      'Unlimited email campaigns',
      'Lead Finder with web scraping',
      'Contact management',
      'Open & click tracking',
      'Domain verification',
      'SMTP configuration',
      'Real-time analytics',
    ],
  },
  {
    id: 'yearly' as const,
    name: 'Yearly',
    price: '₹24,999',
    priceNum: 24999,
    period: '/year',
    badge: 'Save ₹4,989',
    description: 'Best value for agencies scaling their outreach',
    features: [
      'Everything in Monthly',
      'Priority support',
      '2 months free',
      'Unlimited email campaigns',
      'Lead Finder with web scraping',
      'Advanced analytics',
      'Dedicated onboarding',
    ],
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const { isActive, subscription, daysRemaining } = useSubscription();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubscribe = async (plan: 'monthly' | 'yearly') => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setLoadingPlan(plan);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Failed to load payment gateway');

      // Create order
      const { data, error } = await supabase.functions.invoke('razorpay', {
        body: { action: 'create_order', plan },
      });

      if (error) throw error;

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: 'Senddot',
        description: `${plan === 'yearly' ? 'Yearly' : 'Monthly'} Subscription`,
        order_id: data.order_id,
        handler: async (response: any) => {
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('razorpay', {
              body: {
                action: 'verify_payment',
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });

            if (verifyError) throw verifyError;

            toast({
              title: '🎉 Subscription Activated!',
              description: `Your ${plan} plan is now active. Enjoy all features!`,
            });

            navigate('/dashboard');
          } catch (err: any) {
            toast({
              title: 'Verification Failed',
              description: err.message || 'Payment verification failed. Contact support.',
              variant: 'destructive',
            });
          }
        },
        prefill: {
          email: user.email,
        },
        theme: {
          color: '#6366f1',
        },
        modal: {
          ondismiss: () => setLoadingPlan(null),
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to initiate payment',
        variant: 'destructive',
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Choose Your Plan</h1>
          <p className="text-muted-foreground mt-2">
            Unlock lead generation, bulk email campaigns, and powerful analytics
          </p>
        </div>

        {isActive && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">
                    Active {subscription?.plan === 'yearly' ? 'Yearly' : 'Monthly'} Plan
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {daysRemaining} days remaining
                  </p>
                </div>
              </div>
              <Badge variant="default">Active</Badge>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((plan) => {
            const isCurrent = isActive && subscription?.plan === plan.id;
            return (
              <Card
                key={plan.id}
                className={`relative transition-shadow hover:shadow-lg ${
                  plan.id === 'yearly' ? 'border-primary/50 shadow-md' : ''
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-3 py-1">
                      <Zap className="mr-1 h-3 w-3" />
                      {plan.badge}
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pt-8">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.id === 'yearly' ? 'default' : 'outline'}
                    disabled={isCurrent || !!loadingPlan}
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    {loadingPlan === plan.id ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                    ) : isCurrent ? (
                      'Current Plan'
                    ) : (
                      'Subscribe Now'
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
