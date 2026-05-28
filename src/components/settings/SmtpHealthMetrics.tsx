import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ShieldCheck, ShieldAlert, ShieldQuestion, Activity, Loader2 } from 'lucide-react';

interface Props {
  smtpAccountId: string;
  userId: string;
}

interface Stats {
  sent: number;
  failed: number;
  opens: number;
  unsubscribes: number;
}

const WINDOW_DAYS = 30;

export function SmtpHealthMetrics({ smtpAccountId, userId }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const since = new Date();
    since.setDate(since.getDate() - WINDOW_DAYS);
    const sinceIso = since.toISOString();

    (async () => {
      try {
        // Fetch sent queue ids for this SMTP in the window (single round trip)
        const { data: sentRows } = await supabase
          .from('email_queue')
          .select('id, status')
          .eq('user_id', userId)
          .eq('smtp_account_id', smtpAccountId)
          .gte('created_at', sinceIso)
          .limit(5000);

        const rows = sentRows || [];
        const sent = rows.filter(r => r.status === 'sent').length;
        const failed = rows.filter(r => r.status === 'failed').length;
        const sentIds = rows.filter(r => r.status === 'sent').map(r => r.id);

        let opens = 0;
        let unsubscribes = 0;
        if (sentIds.length) {
          const [opensRes, unsubRes] = await Promise.all([
            supabase
              .from('email_opens')
              .select('id', { count: 'exact', head: true })
              .in('email_queue_id', sentIds.slice(0, 1000)),
            supabase
              .from('email_unsubscribes')
              .select('id', { count: 'exact', head: true })
              .in('email_queue_id', sentIds.slice(0, 1000)),
          ]);
          opens = opensRes.count || 0;
          unsubscribes = unsubRes.count || 0;
        }

        if (!cancelled) setStats({ sent, failed, opens, unsubscribes });
      } catch (e) {
        if (!cancelled) setStats({ sent: 0, failed: 0, opens: 0, unsubscribes: 0 });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [smtpAccountId, userId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Calculating health…
      </div>
    );
  }

  const { sent, failed, opens, unsubscribes } = stats!;
  const attempted = sent + failed;

  // Not enough data
  if (attempted < 5) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldQuestion className="h-3.5 w-3.5" />
        Not enough recent activity to score health (need ≥5 sends in last {WINDOW_DAYS}d).
      </div>
    );
  }

  const deliveryRate = sent / attempted;            // 0..1
  const openRate = sent > 0 ? opens / sent : 0;     // 0..1
  const unsubRate = sent > 0 ? unsubscribes / sent : 0;

  // Deliverability confidence: 70% weight on delivery, 30% on engagement
  const confidence = Math.round(Math.min(100, Math.max(0, (deliveryRate * 70) + (Math.min(openRate, 0.5) / 0.5) * 30)));

  // Risk score: failures + unsubscribes drive risk up; low opens raise it slightly
  let risk = 0;
  risk += (1 - deliveryRate) * 70;        // each 1% failure adds risk
  risk += Math.min(unsubRate, 0.1) * 200; // unsub > 1% is harmful, capped at 10%
  if (openRate < 0.05 && sent >= 20) risk += 15;
  risk = Math.round(Math.min(100, Math.max(0, risk)));

  const confTone =
    confidence >= 80 ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30' :
    confidence >= 60 ? 'text-amber-600 bg-amber-500/10 border-amber-500/30' :
    'text-destructive bg-destructive/10 border-destructive/30';

  const riskLabel = risk < 25 ? 'Low' : risk < 55 ? 'Medium' : 'High';
  const riskTone =
    risk < 25 ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30' :
    risk < 55 ? 'text-amber-600 bg-amber-500/10 border-amber-500/30' :
    'text-destructive bg-destructive/10 border-destructive/30';

  const RiskIcon = risk < 25 ? ShieldCheck : risk < 55 ? ShieldAlert : ShieldAlert;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
        {/* Deliverability confidence */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`rounded-md border px-3 py-2 ${confTone} cursor-help`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium uppercase tracking-wide flex items-center gap-1">
                  <Activity className="h-3 w-3" /> Deliverability confidence
                </span>
                <span className="text-sm font-bold">{confidence}%</span>
              </div>
              <div className="h-1.5 w-full bg-background/60 rounded-full overflow-hidden">
                <div className="h-full bg-current opacity-70" style={{ width: `${confidence}%` }} />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-[260px] text-xs">
            Based on the last {WINDOW_DAYS} days: {sent} delivered / {failed} failed,
            {' '}{(deliveryRate * 100).toFixed(1)}% success and {(openRate * 100).toFixed(1)}% open rate.
          </TooltipContent>
        </Tooltip>

        {/* Sender risk */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`rounded-md border px-3 py-2 ${riskTone} cursor-help`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium uppercase tracking-wide flex items-center gap-1">
                  <RiskIcon className="h-3 w-3" /> Sender risk
                </span>
                <Badge variant="outline" className="text-[10px] h-5 border-current text-current bg-transparent">
                  {riskLabel}
                </Badge>
              </div>
              <div className="h-1.5 w-full bg-background/60 rounded-full overflow-hidden">
                <div className="h-full bg-current opacity-70" style={{ width: `${risk}%` }} />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-[260px] text-xs">
            Failures: {failed} · Unsubscribes: {unsubscribes} ({(unsubRate * 100).toFixed(2)}%).
            {risk >= 55 && ' Consider pausing this account or warming it up before sending more volume.'}
            {risk >= 25 && risk < 55 && ' Slow down sends and review bounce/reply feedback.'}
            {risk < 25 && ' This sender is performing well — safe to scale gradually.'}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
