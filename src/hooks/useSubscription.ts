import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Subscription {
  id: string;
  plan: string;
  status: string;
  amount: number;
  started_at: string | null;
  expires_at: string | null;
}

// Demo accounts that get free access to all features
const DEMO_ACCOUNTS = ['admin@personacraft.in'];

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const isDemoAccount = user?.email ? DEMO_ACCOUNTS.includes(user.email) : false;

  const fetchSubscription = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Demo accounts always have active subscription
    if (isDemoAccount) {
      setSubscription({
        id: 'demo',
        plan: 'yearly',
        status: 'active',
        amount: 0,
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('id, plan, status, amount, started_at, expires_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && data.expires_at && new Date(data.expires_at) < new Date()) {
        setSubscription(null);
      } else {
        setSubscription(data);
      }
    } catch (err) {
      console.error('Error fetching subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [user]);

  const isActive = !!subscription && subscription.status === 'active';

  const daysRemaining = subscription?.expires_at
    ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return { subscription, loading, isActive, daysRemaining, refetch: fetchSubscription };
}
