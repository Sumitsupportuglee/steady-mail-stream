import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription, TRIAL_DAYS } from '@/hooks/useSubscription';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ReviewForm } from '@/components/reviews/ReviewForm';
import { WarmupStatus } from '@/components/dashboard/WarmupStatus';
import { SenderHealthOverview } from '@/components/dashboard/SenderHealthOverview';
import { MetricTile } from '@/components/ops/MetricTile';
import { DonutGauge } from '@/components/ops/DonutGauge';
import { VolumeChart } from '@/components/ops/VolumeChart';
import { useSendingTimeline } from '@/hooks/useSendingTimeline';
import { 
  Crown,
  Mail, 
  MousePointerClick, 
  Eye, 
  Plus, 
  Users,
  Send,
  Loader2,
  AlertTriangle,
  CalendarDays,
  MessageSquareReply,
  TrendingUp,
} from 'lucide-react';

interface DashboardStats {
  emailsSent: number;
  openRate: number;
  replyRate: number;
  conversionRate: number;
}

interface RecentCampaign {
  id: string;
  subject: string;
  status: string;
  recipient_count: number;
  created_at: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { isActive, subscription, daysRemaining, isPilotAccount, planLimits, loading: subLoading, isTrial, trialDaysRemaining, trialEndsAt, trialClaimed, canClaimTrial, claiming, claimTrial } = useSubscription();
  const [stats, setStats] = useState<DashboardStats>({ emailsSent: 0, openRate: 0, replyRate: 0, conversionRate: 0 });
  const [recentCampaigns, setRecentCampaigns] = useState<RecentCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const timeline = useSendingTimeline(user?.id);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  // Realtime subscriptions for live stats
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('dashboard-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_opens' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_clicks' }, () => fetchDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_queue' }, () => fetchDashboardData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const [emailsSentRes, totalSentRes, totalOpensRes, totalClicksRes, campaignsRes] = await Promise.all([
        supabase.from('email_queue').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).eq('status', 'sent').gte('sent_at', thirtyDaysAgo.toISOString()),
        supabase.from('email_queue').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).eq('status', 'sent'),
        supabase.from('email_opens').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('email_clicks').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('campaigns').select('id, subject, status, recipient_count, created_at').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(5),
      ]);

      const totalSent = totalSentRes.count || 0;
      const openRate = totalSent > 0 ? ((totalOpensRes.count || 0) / totalSent) * 100 : 0;
      const clickRate = totalSent > 0 ? ((totalClicksRes.count || 0) / totalSent) * 100 : 0;

      setStats({
        emailsSent: emailsSentRes.count || 0,
        openRate: Math.round(openRate * 10) / 10,
        replyRate: 0, // Reply tracking coming soon
        conversionRate: Math.round(clickRate * 10) / 10,
      });
      setRecentCampaigns(campaignsRes.data || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'secondary', queued: 'outline', sending: 'default', completed: 'default',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  if (loading || subLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const isYearly = subscription?.plan?.includes('yearly');
  const totalDays = isYearly ? 365 : 30;
  const progressPercent = isActive ? Math.max(0, (daysRemaining / totalDays) * 100) : 0;
  const planLabel = subscription?.plan?.startsWith('business') ? 'Business' : 'Starter';

  // Presentational aggregates for the ops console (read-only)
  const sentSeries = timeline.points.map(p => p.sent);
  const failSeries = timeline.points.map(p => p.failed);
  const openSeries = timeline.points.map(p => p.opens);
  const clickSeries = timeline.points.map(p => p.clicks);
  const attempts = timeline.totals.sent + timeline.totals.failed;
  const deliveryRate = attempts > 0 ? Math.round((timeline.totals.sent / attempts) * 100) : 0;
  const failureRate = attempts > 0 ? Math.round((timeline.totals.failed / attempts) * 1000) / 10 : 0;
  const peakDay = timeline.points.reduce(
    (best, p) => (p.sent > best.sent ? { sent: p.sent, label: p.label } : best),
    { sent: 0, label: '—' },
  );
  const dailyAvg = timeline.points.length
    ? Math.round(timeline.totals.sent / timeline.points.length)
    : 0;
  const lastWeek = sentSeries.slice(-7).reduce((a, b) => a + b, 0);
  const prevWeek = sentSeries.slice(-14, -7).reduce((a, b) => a + b, 0);
  const sentDelta = prevWeek > 0 ? Math.round(((lastWeek - prevWeek) / prevWeek) * 100) : null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Overview of your email marketing performance</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link to="/contacts"><Users className="mr-2 h-4 w-4" />Add Contacts</Link>
            </Button>
            <Button asChild>
              <Link to="/campaigns/new"><Plus className="mr-2 h-4 w-4" />New Campaign</Link>
            </Button>
          </div>
        </div>

        {/* Pilot Account Banner */}
        {isPilotAccount && isActive && (
          <Card className="bg-gradient-to-br from-amber-500/15 to-orange-500/10 border-amber-500/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Crown className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="font-semibold text-amber-700 dark:text-amber-400">Pilot Account — Free Trial</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {daysRemaining} days remaining
                      {subscription?.expires_at && (
                        <span> · Expires {new Date(subscription.expires_at).toLocaleDateString()}</span>
                      )}
                    </p>
                  </div>
                </div>
                <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">Pilot</Badge>
              </div>
              <Progress value={Math.max(0, (daysRemaining / 30) * 100)} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                Limits: {planLimits.maxSenderIdentities} sender identities · {planLimits.maxSmtp} SMTP accounts
              </p>
            </CardContent>
          </Card>
        )}

        {/* Subscription Status */}
        {!isPilotAccount && !isTrial && isActive && (
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Crown className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">
                      {planLabel} {isYearly ? 'Yearly' : 'Monthly'} Plan
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {daysRemaining} days remaining
                      {subscription?.expires_at && (
                        <span> · Expires {new Date(subscription.expires_at).toLocaleDateString()}</span>
                      )}
                    </p>
                  </div>
                </div>
                <Badge variant="default">Active</Badge>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </CardContent>
          </Card>
        )}
        {/* Free Trial Status */}
        {isTrial && (
          <Card className="bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border-emerald-500/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Crown className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="font-semibold">14-Day Free Trial — Premium Access</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} remaining
                      {trialEndsAt && <span> · Ends {new Date(trialEndsAt).toLocaleDateString()}</span>}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/pricing">Subscribe</Link>
                </Button>
              </div>
              <Progress value={Math.max(0, (trialDaysRemaining / TRIAL_DAYS) * 100)} className="h-2" />
            </CardContent>
          </Card>
        )}

        {!isActive && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-semibold">
                    {canClaimTrial ? 'Start your 14-day free trial' : trialClaimed ? 'Free trial ended' : 'No Active Subscription'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {canClaimTrial
                      ? 'Get full premium access for 14 days — no payment required'
                      : 'Subscribe to unlock lead generation and email campaigns'}
                  </p>
                </div>
              </div>
              {canClaimTrial ? (
                <Button onClick={() => claimTrial()} disabled={claiming}>
                  {claiming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Claim Free Trial
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/pricing">Subscribe Now</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}


        {/* Email Account Warmup Status */}
        <WarmupStatus />

        {/* Sender Health (Deliverability + Risk per SMTP) */}
        <SenderHealthOverview />

        {/* Outbound Volume & Health Console */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Send Volume · 30 days
                  </CardTitle>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums">
                      {timeline.totals.sent.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">emails delivered to MTA</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ background: 'hsl(var(--primary))' }} /> Sent
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ background: 'hsl(var(--destructive))' }} /> Failed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3.5" style={{ background: 'hsl(var(--success))' }} /> Open rate
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3.5" style={{ background: 'hsl(var(--info))' }} /> Click rate
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <VolumeChart points={timeline.points} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Pipeline Health
              </CardTitle>
              <CardDescription className="text-xs">
                Delivery outcome mix across the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DonutGauge
                size={132}
                centerValue={`${deliveryRate}%`}
                centerLabel="delivered"
                segments={[
                  { label: 'Sent', value: timeline.totals.sent, color: 'hsl(var(--primary))' },
                  { label: 'Pending', value: timeline.totals.pending, color: 'hsl(var(--warning))' },
                  { label: 'Failed', value: timeline.totals.failed, color: 'hsl(var(--destructive))' },
                ]}
              />
              <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Total opens</p>
                  <p className="font-semibold tabular-nums">{timeline.totals.opens.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total clicks</p>
                  <p className="font-semibold tabular-nums">{timeline.totals.clicks.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Peak day</p>
                  <p className="font-semibold tabular-nums">{peakDay.sent.toLocaleString()} · {peakDay.label}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Daily avg</p>
                  <p className="font-semibold tabular-nums">{dailyAvg.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricTile
            label="Emails Sent"
            value={stats.emailsSent.toLocaleString()}
            sub="Last 30 days"
            icon={Mail}
            accent="hsl(var(--primary))"
            series={sentSeries}
            delta={sentDelta}
          />
          <MetricTile
            label="Open Rate"
            value={`${stats.openRate}%`}
            sub={`${timeline.totals.opens.toLocaleString()} opens tracked`}
            icon={Eye}
            accent="hsl(var(--success))"
            series={openSeries}
          />
          <MetricTile
            label="Conversion"
            value={`${stats.conversionRate}%`}
            sub={`${timeline.totals.clicks.toLocaleString()} link clicks`}
            icon={TrendingUp}
            accent="hsl(var(--info))"
            series={clickSeries}
          />
          <MetricTile
            label="Reply Rate"
            value={`${stats.replyRate}%`}
            sub="Tracking coming soon"
            icon={MessageSquareReply}
            accent="hsl(var(--accent))"
          />
          <MetricTile
            label="Bounce / Failed"
            value={timeline.totals.failed.toLocaleString()}
            sub={`${failureRate}% of attempts`}
            icon={AlertTriangle}
            accent="hsl(var(--destructive))"
            series={failSeries}
          />
          <MetricTile
            label="In Queue"
            value={timeline.totals.pending.toLocaleString()}
            sub="Scheduled / awaiting rotation"
            icon={Send}
            accent="hsl(var(--warning))"
          />
        </div>


        {/* Recent Campaigns */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Campaigns</CardTitle>
                <CardDescription>Your latest email campaigns</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/campaigns">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentCampaigns.length === 0 ? (
              <div className="text-center py-8">
                <Send className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-lg">No campaigns yet</h3>
                <p className="text-muted-foreground mt-1 mb-4">Create your first campaign to start reaching your audience</p>
                <Button asChild>
                  <Link to="/campaigns/new"><Plus className="mr-2 h-4 w-4" />Create Campaign</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentCampaigns.map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <Link to={`/campaigns/${campaign.id}`} className="font-medium hover:text-primary transition-colors truncate block">
                        {campaign.subject}
                      </Link>
                      <p className="text-sm text-muted-foreground mt-1">
                        {campaign.recipient_count} recipients • {new Date(campaign.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {getStatusBadge(campaign.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Review Form */}
        <ReviewForm />
      </div>
    </AppLayout>
  );
}
