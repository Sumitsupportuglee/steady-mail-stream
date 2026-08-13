import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getPlanLimits } from '@/config/plans';

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

// Pilot accounts with premium access
const PILOT_ACCOUNTS = ['info@budfi.in'];

// Pilot account start date (renewed on 2026-05-09 for additional 30 days)
const PILOT_START_DATE = new Date('2026-05-09T00:00:00Z');

export const TRIAL_DAYS = 14;

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTrial, setIsTrial] = useState(false);
  const [trialClaimed, setTrialClaimed] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

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
        plan: 'business_yearly',
        status: 'active',
        amount: 0,
        started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
      setIsTrial(false);
      setLoading(false);
      return;
    }

    // Pilot accounts get 30-day premium access from renewal date
    if (user.email && PILOT_ACCOUNTS.includes(user.email)) {
      const expiresAt = new Date(PILOT_START_DATE);
      expiresAt.setDate(expiresAt.getDate() + 30);

      if (expiresAt > new Date()) {
        setSubscription({
          id: 'pilot',
          plan: 'business_monthly',
          status: 'active',
          amount: 0,
          started_at: PILOT_START_DATE.toISOString(),
          expires_at: expiresAt.toISOString(),
        });
        setIsTrial(false);
        setLoading(false);
        return;
      }
    }

    try {
      const [{ data }, { data: profile }] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('id, plan, status, amount, started_at, expires_at')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('trial_started_at, trial_ends_at')
          .eq('id', user.id)
          .maybeSingle() as unknown as Promise<{ data: { trial_started_at: string | null; trial_ends_at: string | null } | null }>,
      ]);

      const paid = data && (!data.expires_at || new Date(data.expires_at) >= new Date()) ? data : null;

      const trialStart = profile?.trial_started_at ?? null;
      const trialEnd = profile?.trial_ends_at ?? null;
      const trialActive = !!trialEnd && new Date(trialEnd) > new Date();

      setTrialClaimed(!!trialStart);
      setTrialEndsAt(trialEnd);

      if (paid) {
        setSubscription(paid);
        setIsTrial(false);
      } else if (trialActive) {
        // Trial users get full premium (monthly plan) access
        setSubscription({
          id: 'trial',
          plan: 'starter_monthly',
          status: 'active',
          amount: 0,
          started_at: trialStart,
          expires_at: trialEnd,
        });
        setIsTrial(true);
      } else {
        setSubscription(null);
        setIsTrial(false);
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

  const claimTrial = async () => {
    if (!user) return false;
    setClaiming(true);
    try {
      const { error } = await (supabase as any).rpc('claim_free_trial');
      if (error) throw error;
      await fetchSubscription();
      return true;
    } catch (err) {
      console.error('Error claiming free trial:', err);
      return false;
    } finally {
      setClaiming(false);
    }
  };

  const isPilotAccount = user?.email ? PILOT_ACCOUNTS.includes(user.email) : false;
  const isActive = !!subscription && subscription.status === 'active';

  const daysRemaining = subscription?.expires_at
    ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const planLimits = getPlanLimits(subscription?.plan);

  return {
    subscription,
    loading,
    isActive,
    daysRemaining,
    isPilotAccount,
    planLimits,
    isTrial,
    trialClaimed,
    trialEndsAt,
    trialDaysRemaining: isTrial ? daysRemaining : 0,
    canClaimTrial: !!user && !trialClaimed && !isDemoAccount && !isPilotAccount,
    claiming,
    claimTrial,
    refetch: fetchSubscription,
  };
}
