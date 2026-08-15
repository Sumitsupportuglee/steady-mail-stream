import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TimelinePoint {
  date: string;      // ISO day
  label: string;     // "Aug 12"
  sent: number;
  failed: number;
  opens: number;
  clicks: number;
}

export interface TimelineTotals {
  sent: number;
  failed: number;
  pending: number;
  opens: number;
  clicks: number;
}

const DAYS = 30;

function dayKey(d: string | null | undefined) {
  return d ? d.slice(0, 10) : null;
}

/**
 * Read-only aggregation of the last 30 days of sending activity.
 * Purely presentational data — no writes, no side effects on sending logic.
 */
export function useSendingTimeline(userId: string | undefined, campaignIds?: string[] | null) {
  const [points, setPoints] = useState<TimelinePoint[]>([]);
  const [totals, setTotals] = useState<TimelineTotals>({ sent: 0, failed: 0, pending: 0, opens: 0, clicks: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (DAYS - 1));
    const sinceIso = since.toISOString();

    // Pre-seed the 30 buckets
    const buckets = new Map<string, TimelinePoint>();
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, {
        date: key,
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        sent: 0,
        failed: 0,
        opens: 0,
        clicks: 0,
      });
    }

    try {
      let queueQ = supabase
        .from('email_queue')
        .select('id, status, sent_at, created_at')
        .eq('user_id', userId)
        .gte('created_at', sinceIso)
        .limit(5000);
      let opensQ = supabase
        .from('email_opens')
        .select('opened_at')
        .eq('user_id', userId)
        .gte('opened_at', sinceIso)
        .limit(5000);
      let clicksQ = supabase
        .from('email_clicks')
        .select('clicked_at')
        .eq('user_id', userId)
        .gte('clicked_at', sinceIso)
        .limit(5000);

      if (campaignIds && campaignIds.length) {
        queueQ = queueQ.in('campaign_id', campaignIds);
        opensQ = opensQ.in('campaign_id', campaignIds);
        clicksQ = clicksQ.in('campaign_id', campaignIds);
      }

      const [queueRes, opensRes, clicksRes] = await Promise.all([queueQ, opensQ, clicksQ]);

      const t: TimelineTotals = { sent: 0, failed: 0, pending: 0, opens: 0, clicks: 0 };

      (queueRes.data || []).forEach((r: any) => {
        const key = dayKey(r.sent_at || r.created_at);
        const b = key ? buckets.get(key) : undefined;
        if (r.status === 'sent') {
          t.sent++;
          if (b) b.sent++;
        } else if (r.status === 'failed') {
          t.failed++;
          if (b) b.failed++;
        } else {
          t.pending++;
        }
      });
      (opensRes.data || []).forEach((r: any) => {
        t.opens++;
        const b = buckets.get(dayKey(r.opened_at) || '');
        if (b) b.opens++;
      });
      (clicksRes.data || []).forEach((r: any) => {
        t.clicks++;
        const b = buckets.get(dayKey(r.clicked_at) || '');
        if (b) b.clicks++;
      });

      setPoints([...buckets.values()]);
      setTotals(t);
    } catch (e) {
      console.error('Timeline load failed', e);
    } finally {
      setLoading(false);
    }
  }, [userId, campaignIds ? campaignIds.join(',') : '']);

  useEffect(() => {
    load();
  }, [load]);

  return { points, totals, loading, reload: load };
}
