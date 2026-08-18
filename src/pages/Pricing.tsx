import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useIsIndianUser } from '@/hooks/useGeoLocation';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, Crown, Loader2, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PLANS } from '@/config/plans';

const PAYPAL_PAYMENT_LINK = 'https://www.paypal.com/ncp/payment/2KQ4JZNT2E8P2';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function Pricing() {
  const { user } = useAuth();
  const { isActive, daysRemaining } = useSubscription();
  const isIndian = useIsIndianUser();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const navigate = useNavigate();

  // Single, consistent subscription plan across the platform
  const plan = PLANS[0];

  if (isIndian === null) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const priceLabel = isIndian
    ? `₹${plan.pricing.inr.monthly.toLocaleString('en-IN')}`
    : `$${plan.pricing.usd.monthly.toLocaleString()}`;

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

  const handleSubscribe = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    // Non-Indian users pay via PayPal payment link
    if (!isIndian) {
      window.open(PAYPAL_PAYMENT_LINK, '_blank', 'noopener,noreferrer');
      toast({
        title: 'Redirecting to PayPal',
        description: 'Complete your payment on PayPal. Your account is activated once payment is confirmed.',
      });
      return;
    }

    const fullPlanId = 'starter_monthly';
    setLoadingPlan(fullPlanId);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Failed to load payment gateway');

      const { data, error } = await supabase.functions.invoke('razorpay', {
        body: { action: 'create_order', plan: fullPlanId, is_indian: isIndian },
      });

      if (error) throw error;

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: 'Senddot',
        description: `${plan.name} — Monthly`,
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
              description: `Your ${plan.name} is now active!`,
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

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Monthly Subscription</h1>
          <p className="text-muted-foreground mt-2">
            One simple plan — full premium access to lead generation, bulk campaigns, and analytics
          </p>
        </div>

        {isActive && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Active subscription</p>
                  <p className="text-sm text-muted-foreground">{daysRemaining} days remaining</p>
                </div>
              </div>
              <Badge variant="default">Active</Badge>
            </CardContent>
          </Card>
        )}

        <Card className="relative border-primary/50 shadow-md transition-shadow hover:shadow-lg">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="bg-primary text-primary-foreground px-3 py-1">
              <Rocket className="mr-1 h-3 w-3" />
              14-day free trial
            </Badge>
          </div>
          <CardHeader className="text-center pt-8">
            <CardTitle className="text-xl">{plan.name}</CardTitle>
            <CardDescription>{plan.description}</CardDescription>
            <div className="mt-4">
              <span className="text-4xl font-bold">{priceLabel}</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isIndian ? 'Secure payment via Razorpay' : 'Secure payment via PayPal'} · cancel anytime
            </p>
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
              disabled={isActive || !!loadingPlan}
              onClick={handleSubscribe}
            >
              {loadingPlan ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
              ) : isActive ? (
                'Current Plan'
              ) : (
                'Subscribe Now'
              )}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Looking to own the platform outright? See deployment pricing on the{' '}
          <button className="underline" onClick={() => navigate('/')}>home page</button>.
        </p>
      </div>
    </AppLayout>
  );
}
