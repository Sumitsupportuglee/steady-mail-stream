import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Flame, ShieldCheck, TrendingUp, Info, Mail, AlertTriangle, Activity } from 'lucide-react';

interface SmtpAccount {
  id: string;
  label: string;
  smtp_username: string;
  created_at: string;
  is_default: boolean;
}

interface HealthMetrics {
  daysActive: number;
  sent7d: number;
  sent24h: number;
  failed7d: number;
  totalSent: number;
  totalFailed: number;
  uniqueOpens7d: number;
  uniqueClicks7d: number;
  bounceRate: number; // 0..1
  openRate: number;   // 0..1
  clickRate: number;  // 0..1
}

interface StageInfo {
  name: string;
  description: string;
  recommendation: string;
  maxDaily: number;
  icon: React.ReactNode;
  color: string;
  badgeClass: string;
  progressPercent: number;
}

function computeHealthScore(m: HealthMetrics): number {
  // Score out of 100. Combines age, volume sent, bounce rate, open rate.
  const ageScore = Math.min(m.daysActive / 28, 1) * 30; // up to 30 pts for 28+ days
  const volumeScore = Math.min(m.totalSent / 200, 1) * 25; // up to 25 pts for 200+ sent
  const bouncePenalty = Math.min(m.bounceRate * 100, 40); // up to -40 for high bounce
  const bounceScore = Math.max(0, 25 - bouncePenalty * 0.625); // 25 pts if 0 bounce
  const engagementScore = Math.min(m.openRate * 100, 20); // up to 20 pts for opens

  return Math.round(Math.max(0, Math.min(100, ageScore + volumeScore + bounceScore + engagementScore)));
}

function deriveStage(m: HealthMetrics, score: number): StageInfo {
  // Critical state: high bounce rate overrides everything
  if (m.totalSent >= 20 && m.bounceRate > 0.1) {
    return {
      name: 'At Risk',
      description: `High bounce rate detected (${(m.bounceRate * 100).toFixed(1)}%). Pause sending and clean your contact list.`,
      recommendation: 'Stop bulk sending. Verify email addresses, remove invalid contacts, and resume slowly.',
      maxDaily: 10,
      icon: <AlertTriangle className="h-5 w-5" />,
      color: 'text-red-500',
      badgeClass: 'bg-red-100 text-red-700 border-red-200',
      progressPercent: Math.max(10, score),
    };
  }

  if (score < 35 || m.daysActive < 14) {
    return {
      name: 'Warming Up',
      description: 'This SMTP account is new or has limited history. Send small volumes to build sender reputation.',
      recommendation: 'Send 10–20 personalized emails per day. Focus on engaged recipients with valid addresses.',
      maxDaily: 20,
      icon: <Flame className="h-5 w-5" />,
      color: 'text-orange-500',
      badgeClass: 'bg-orange-100 text-orange-700 border-orange-200',
      progressPercent: Math.max(15, Math.min(40, score)),
    };
  }

  if (score < 70 || m.daysActive < 28) {
    return {
      name: 'Building Reputation',
      description: 'This SMTP account is gaining trust with mailbox providers. Gradually increase sending volume.',
      recommendation: 'Send 50–75 emails per day. Monitor open rates and bounce rates closely.',
      maxDaily: 75,
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'text-blue-500',
      badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
      progressPercent: Math.max(45, Math.min(75, score)),
    };
  }

  return {
    name: 'Ready for Campaigns',
    description: 'This SMTP account has a strong sending reputation. You can run full-volume campaigns.',
    recommendation: 'Maintain list hygiene and avoid sudden volume spikes to keep deliverability high.',
    maxDaily: 500,
    icon: <ShieldCheck className="h-5 w-5" />,
    color: 'text-green-500',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    progressPercent: Math.max(80, score),
  };
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export function WarmupStatus() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SmtpAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('smtp_accounts')
        .select('id, label, smtp_username, created_at, is_default')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (!error && data) {
        setAccounts(data);
        const stored = localStorage.getItem('warmupSelectedSmtpId');
        const initial = data.find(a => a.id === stored)?.id
          ?? data.find(a => a.is_default)?.id
          ?? data[0]?.id
          ?? null;
        setSelectedId(initial);
      }
      setLoading(false);
    })();
  }, [user]);

  const selected = useMemo(
    () => accounts.find(a => a.id === selectedId) ?? accounts[0] ?? null,
    [accounts, selectedId]
  );

  useEffect(() => {
    if (!user || !selected) {
      setMetrics(null);
      return;
    }

    let cancelled = false;
    setMetricsLoading(true);

    (async () => {
      const created = new Date(selected.created_at);
      const now = new Date();
      const daysActive = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      // Pull all queue rows for this SMTP account (RLS limits to user)
      const baseQuery = supabase
        .from('email_queue')
        .select('id, status, sent_at, created_at, error_log', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('smtp_account_id', selected.id);

      const [totalsRes, sent7Res, sent24Res, failed7Res] = await Promise.all([
        supabase
          .from('email_queue')
          .select('status', { count: 'exact', head: false })
          .eq('user_id', user.id)
          .eq('smtp_account_id', selected.id),
        supabase
          .from('email_queue')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('smtp_account_id', selected.id)
          .eq('status', 'sent')
          .gte('sent_at', since7d),
        supabase
          .from('email_queue')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('smtp_account_id', selected.id)
          .eq('status', 'sent')
          .gte('sent_at', since24h),
        supabase
          .from('email_queue')
          .select('id, error_log', { count: 'exact', head: false })
          .eq('user_id', user.id)
          .eq('smtp_account_id', selected.id)
          .eq('status', 'failed')
          .gte('created_at', since7d),
      ]);

      // Compute totals from totalsRes payload
      const totalRows = totalsRes.data ?? [];
      const totalSent = totalRows.filter(r => r.status === 'sent').length;
      const totalFailed = totalRows.filter(r => r.status === 'failed').length;

      // Heuristic: bounce-like failures are those whose error_log mentions bounce/invalid/rejected/blocked/no such user
      const failed7Rows = failed7Res.data ?? [];
      const bounceLike = failed7Rows.filter(r => {
        const e = (r.error_log ?? '').toLowerCase();
        return /bounce|invalid|rejected|blocked|no such user|user unknown|recipient|550|553|554|mailbox/.test(e);
      }).length;

      const sent7d = sent7Res.count ?? 0;
      const sent24h = sent24Res.count ?? 0;
      const failed7d = failed7Res.count ?? failed7Rows.length;

      // For opens/clicks in last 7 days, pull queue ids that were sent in window then count distinct
      const { data: recentSentRows } = await supabase
        .from('email_queue')
        .select('id')
        .eq('user_id', user.id)
        .eq('smtp_account_id', selected.id)
        .eq('status', 'sent')
        .gte('sent_at', since7d)
        .limit(2000);

      const queueIds = (recentSentRows ?? []).map(r => r.id);
      let uniqueOpens7d = 0;
      let uniqueClicks7d = 0;

      if (queueIds.length > 0) {
        const [opensRes, clicksRes] = await Promise.all([
          supabase
            .from('email_opens')
            .select('email_queue_id')
            .in('email_queue_id', queueIds),
          supabase
            .from('email_clicks')
            .select('email_queue_id')
            .in('email_queue_id', queueIds),
        ]);
        uniqueOpens7d = new Set((opensRes.data ?? []).map(o => o.email_queue_id)).size;
        uniqueClicks7d = new Set((clicksRes.data ?? []).map(c => c.email_queue_id)).size;
      }

      const denom7 = sent7d + bounceLike;
      const bounceRate = denom7 > 0 ? bounceLike / denom7 : 0;
      const openRate = sent7d > 0 ? Math.min(uniqueOpens7d / sent7d, 1) : 0;
      const clickRate = sent7d > 0 ? Math.min(uniqueClicks7d / sent7d, 1) : 0;

      if (cancelled) return;

      setMetrics({
        daysActive,
        sent7d,
        sent24h,
        failed7d,
        totalSent,
        totalFailed,
        uniqueOpens7d,
        uniqueClicks7d,
        bounceRate,
        openRate,
        clickRate,
      });
      setMetricsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, selected]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    localStorage.setItem('warmupSelectedSmtpId', id);
  };

  if (loading) return null;

  if (accounts.length === 0) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            Email Account Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add an SMTP account in Settings to track sender reputation and warmup progress.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!selected) return null;

  const score = metrics ? computeHealthScore(metrics) : 0;
  const stage = metrics
    ? deriveStage(metrics, score)
    : {
        name: 'Loading…',
        description: 'Calculating sender reputation from your sending history.',
        recommendation: '',
        maxDaily: 0,
        icon: <Activity className="h-5 w-5" />,
        color: 'text-muted-foreground',
        badgeClass: 'bg-muted text-muted-foreground border-border',
        progressPercent: 0,
      };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span className={stage.color}>{stage.icon}</span>
            Email Account Health
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selected.id} onValueChange={handleSelect}>
              <SelectTrigger className="h-8 w-[240px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    {a.label} — {a.smtp_username}
                    {a.is_default ? ' (default)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge className={`${stage.badgeClass} border font-medium`}>{stage.name}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Health Score</span>
            <span className="font-medium">{metricsLoading && !metrics ? '—' : `${score}/100`}</span>
          </div>
          <Progress value={stage.progressPercent} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
            <span>Day {metrics?.daysActive ?? 0} since added</span>
            <span>
              {metrics ? `${metrics.sent24h} sent in last 24h · ${metrics.sent7d} in 7d` : 'Loading metrics…'}
            </span>
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
          <p className="text-sm text-foreground">{stage.description}</p>
          {stage.recommendation && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <p>{stage.recommendation}</p>
            </div>
          )}
        </div>

        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Total Sent</p>
              <p className="text-lg font-semibold">{metrics.totalSent}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Bounce Rate (7d)</p>
              <p className={`text-lg font-semibold ${metrics.bounceRate > 0.05 ? 'text-red-500' : ''}`}>
                {pct(metrics.bounceRate)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Open Rate (7d)</p>
              <p className="text-lg font-semibold">{pct(metrics.openRate)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Click Rate (7d)</p>
              <p className="text-lg font-semibold">{pct(metrics.clickRate)}</p>
            </div>
          </div>
        )}

        {stage.maxDaily > 0 && (
          <div className="flex items-center justify-between text-sm rounded-lg border border-border p-3">
            <span className="text-muted-foreground">Recommended daily limit</span>
            <span className="font-semibold">{stage.maxDaily} emails/day</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
