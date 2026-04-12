import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useIsIndianUser } from '@/hooks/useGeoLocation';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, Crown, Loader2, Zap, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PLANS, type PlanConfig } from '@/config/plans';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function Pricing() {
  const { user } = useAuth();
  const { isActive, subscription, daysRemaining } = useSubscription();
  const isIndian = useIsIndianUser();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const navigate = useNavigate();

  if (isIndian === null) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const formatPrice = (plan: PlanConfig) => {
    const prices = isIndian ? plan.pricing.inr : plan.pricing.usd;
    const price = billingCycle === 'monthly' ? prices.monthly : prices.yearly;
    const currency = isIndian ? '₹' : '$';
    return `${currency}${price.toLocaleString()}`;
  };

  const getSavings = (plan: PlanConfig) => {
    const prices = isIndian ? plan.pricing.inr : plan.pricing.usd;
    const savings = (prices.monthly * 12) - prices.yearly;
    const currency = isIndian ? '₹' : '$';
    return savings > 0 ? `Save ${currency}${savings.toLocaleString()}` : null;
  };

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

  const handleSubscribe = async (planId: 'starter' | 'business') => {
    if (!user) {
      navigate('/auth');
      return;
    }

    const fullPlanId = `${planId}_${billingCycle}`;
    setLoadingPlan(fullPlanId);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Failed to load payment gateway');

      const { data, error } = await supabase.functions.invoke('razorpay', {
        body: { action: 'create_order', plan: fullPlanId, is_indian: isIndian },
      });

      if (error) throw error;

      const planConfig = PLANS.find(p => p.id === planId)!;

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: 'Senddot',
        description: `${planConfig.name} ${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} Subscription`,
        order_id: data.order_id,
        handler: async (response: any) => {
          try {
            const { error: verifyError } = await supabase.functions.invoke('razorpay', {
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
              description: `Your ${planConfig.name} ${billingCycle} plan is now active!`,
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
        prefill: { email: user.email },
        theme: { color: '#6366f1' },
        modal: { ondismiss: () => setLoadingPlan(null) },
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

  const getCurrentPlanTier = () => {
    if (!subscription?.plan) return null;
    if (subscription.plan.startsWith('business')) return 'business';
    return 'starter';
  };

  const currentTier = getCurrentPlanTier();

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
                    Active {currentTier === 'business' ? 'Business' : 'Starter'} Plan
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

        {/* Billing Toggle */}
        <div className="flex justify-center">
          <Tabs value={billingCycle} onValueChange={(v) => setBillingCycle(v as 'monthly' | 'yearly')}>
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly" className="gap-1">
                Yearly <Badge variant="secondary" className="text-xs ml-1">Save more</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {PLANS.map((plan) => {
            const isCurrent = isActive && currentTier === plan.id;
            const fullPlanId = `${plan.id}_${billingCycle}`;
            const savings = billingCycle === 'yearly' ? getSavings(plan) : null;

            return (
              <Card
                key={plan.id}
                className={`relative transition-shadow hover:shadow-lg ${
                  plan.id === 'business' ? 'border-primary/50 shadow-md' : ''
                }`}
              >
                {plan.id === 'business' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-3 py-1">
                      <Rocket className="mr-1 h-3 w-3" />
                      Most Popular
                    </Badge>
                  </div>
                )}
                {savings && (
                  <div className="absolute -top-3 right-4">
                    <Badge className="bg-green-600 text-white px-2 py-0.5 text-xs">
                      <Zap className="mr-1 h-3 w-3" />
                      {savings}
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pt-8">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{formatPrice(plan)}</span>
                    <span className="text-muted-foreground">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
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
                    variant={plan.id === 'business' ? 'default' : 'outline'}
                    disabled={isCurrent || !!loadingPlan}
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    {loadingPlan === fullPlanId ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                    ) : isCurrent ? (
                      'Current Plan'
                    ) : isActive && currentTier === 'starter' && plan.id === 'business' ? (
                      'Upgrade to Business'
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
