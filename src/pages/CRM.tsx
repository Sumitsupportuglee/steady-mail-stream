import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClient } from '@/contexts/ClientContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, MailOpen, CheckCircle, MousePointerClick, ExternalLink, UserMinus } from 'lucide-react';

interface CampaignStats {
  contacted: number;
  delivered: number;
  opened: number;       // unique openers
  clicked: number;      // unique clickers
  unsubscribed: number; // unique unsubscribers
  totalOpens: number;   // every open event
  totalClicks: number;  // every click event
  contactedEmails: string[];
  openedEmails: string[];
  clickedEmails: string[];
  unsubscribedEmails: string[];
}

interface ClickEvent {
  id: string;
  to_email: string;
  original_url: string;
  clicked_at: string;
}

interface UnsubEvent {
  id: string;
  email: string;
  unsubscribed_at: string;
  campaign_id: string | null;
}

export default function CRM() {
  const { user } = useAuth();
  const { activeClientId } = useClient();
  const [stats, setStats] = useState<CampaignStats>({
    contacted: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0,
    totalOpens: 0, totalClicks: 0,
    contactedEmails: [], openedEmails: [], clickedEmails: [], unsubscribedEmails: [],
  });
  const [clickFeed, setClickFeed] = useState<ClickEvent[]>([]);
  const [unsubFeed, setUnsubFeed] = useState<UnsubEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      // Optional client scoping
      let scopedCampaignIds: string[] | null = null;
      if (activeClientId) {
        const { data: campaigns } = await supabase
          .from('campaigns')
          .select('id')
          .eq('user_id', user.id)
          .eq('client_id', activeClientId);
        scopedCampaignIds = (campaigns || []).map(c => c.id);
        if (scopedCampaignIds.length === 0) {
          setStats({
            contacted: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0,
            totalOpens: 0, totalClicks: 0,
            contactedEmails: [], openedEmails: [], clickedEmails: [], unsubscribedEmails: [],
          });
          setClickFeed([]);
          setUnsubFeed([]);
          setLoading(false);
          return;
        }
      }

      // Sent emails
      let queueQuery = supabase
        .from('email_queue')
        .select('id, to_email, status')
        .eq('user_id', user.id)
        .eq('status', 'sent');
      if (scopedCampaignIds) queueQuery = queueQuery.in('campaign_id', scopedCampaignIds);
      const { data: sentEmails } = await queueQuery;

      // Opens
      let opensQuery = supabase
        .from('email_opens')
        .select('email_queue_id')
        .eq('user_id', user.id);
      if (scopedCampaignIds) opensQuery = opensQuery.in('campaign_id', scopedCampaignIds);
      const { data: opens } = await opensQuery;

      let openedEmails: string[] = [];
      if (opens && opens.length > 0) {
        const uniqueQueueIds = [...new Set(opens.map(o => o.email_queue_id))];
        const { data: openedQueue } = await supabase
          .from('email_queue')
          .select('to_email')
          .in('id', uniqueQueueIds);
        openedEmails = [...new Set((openedQueue || []).map(q => q.to_email))];
      }

      // Clicks (every event, ordered most recent first)
      let clicksQuery = supabase
        .from('email_clicks')
        .select('id, email_queue_id, original_url, clicked_at')
        .eq('user_id', user.id)
        .order('clicked_at', { ascending: false })
        .limit(100);
      if (scopedCampaignIds) clicksQuery = clicksQuery.in('campaign_id', scopedCampaignIds);
      const { data: clicks } = await clicksQuery;

      let clickedEmails: string[] = [];
      let feed: ClickEvent[] = [];
      if (clicks && clicks.length > 0) {
        const uniqueClickQueueIds = [...new Set(clicks.map(c => c.email_queue_id))];
        const { data: clickedQueue } = await supabase
          .from('email_queue')
          .select('id, to_email')
          .in('id', uniqueClickQueueIds);
        const idToEmail = new Map((clickedQueue || []).map(q => [q.id, q.to_email]));
        clickedEmails = [...new Set((clickedQueue || []).map(q => q.to_email))];
        feed = clicks.map(c => ({
          id: c.id,
          to_email: idToEmail.get(c.email_queue_id) || 'unknown',
          original_url: c.original_url,
          clicked_at: c.clicked_at,
        }));
      }

      // Totals (head:true for accurate counts even past 1000-row default)
      let totalOpensQ = supabase.from('email_opens').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      let totalClicksQ = supabase.from('email_clicks').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      if (scopedCampaignIds) {
        totalOpensQ = totalOpensQ.in('campaign_id', scopedCampaignIds);
        totalClicksQ = totalClicksQ.in('campaign_id', scopedCampaignIds);
      }
      const [{ count: totalOpens }, { count: totalClicks }] = await Promise.all([totalOpensQ, totalClicksQ]);

      // Unsubscribes
      let unsubQuery = supabase
        .from('email_unsubscribes')
        .select('id, email, unsubscribed_at, campaign_id')
        .eq('user_id', user.id)
        .order('unsubscribed_at', { ascending: false })
        .limit(100);
      if (scopedCampaignIds) unsubQuery = unsubQuery.in('campaign_id', scopedCampaignIds);
      const { data: unsubs } = await unsubQuery;
      const unsubFeedData: UnsubEvent[] = (unsubs || []).map(u => ({
        id: u.id, email: u.email, unsubscribed_at: u.unsubscribed_at, campaign_id: u.campaign_id,
      }));
      const unsubscribedEmails = [...new Set(unsubFeedData.map(u => u.email))];

      const contactedEmails = [...new Set((sentEmails || []).map(e => e.to_email))];

      setStats({
        contacted: contactedEmails.length,
        delivered: (sentEmails || []).length,
        opened: openedEmails.length,
        clicked: clickedEmails.length,
        unsubscribed: unsubscribedEmails.length,
        totalOpens: totalOpens || 0,
        totalClicks: totalClicks || 0,
        contactedEmails,
        openedEmails,
        clickedEmails,
        unsubscribedEmails,
      });
      setClickFeed(feed);
      setUnsubFeed(unsubFeedData);
    } catch (error) {
      console.error('Error fetching CRM stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user, activeClientId]);

  useEffect(() => {
    fetchStats();

    // Realtime subscriptions for live updates
    const channels = [
      supabase.channel('crm-queue').on('postgres_changes', { event: '*', schema: 'public', table: 'email_queue' }, () => fetchStats()).subscribe(),
      supabase.channel('crm-opens').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'email_opens' }, () => fetchStats()).subscribe(),
      supabase.channel('crm-clicks').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'email_clicks' }, () => fetchStats()).subscribe(),
    ];

    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [fetchStats]);

  const openRate = stats.delivered > 0 ? ((stats.totalOpens / stats.delivered) * 100).toFixed(1) : '0.0';
  const clickRate = stats.delivered > 0 ? ((stats.totalClicks / stats.delivered) * 100).toFixed(1) : '0.0';

  const CARDS = [
    {
      title: 'Contacted',
      description: 'Personas whom emails were sent',
      value: stats.contacted,
      icon: Send,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      items: stats.contactedEmails,
    },
    {
      title: 'Delivered',
      description: 'Emails delivered to mailbox',
      value: stats.delivered,
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
      items: null,
    },
    {
      title: 'Opened',
      description: `${stats.totalOpens} total opens • ${openRate}% rate`,
      value: stats.opened,
      icon: MailOpen,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      items: stats.openedEmails,
    },
    {
      title: 'Clicked',
      description: `${stats.totalClicks} total clicks • ${clickRate}% rate`,
      value: stats.clicked,
      icon: MousePointerClick,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
      items: stats.clickedEmails,
    },
  ];

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM Pipeline</h1>
          <p className="text-muted-foreground mt-1">
            Real-time campaign engagement metrics
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {CARDS.map((card) => (
            <Card key={card.title} className={`border ${card.borderColor}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${card.color}`}>
                  {card.value.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Live Click Feed */}
        <Card className="border border-purple-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-purple-500" />
              Recent Clicks (live)
              <Badge variant="secondary" className="ml-auto text-xs">
                {clickFeed.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {clickFeed.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No clicks yet</p>
            ) : (
              <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
                {clickFeed.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 text-sm py-2 px-3 rounded-md bg-muted/50"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                    <span className="font-medium truncate min-w-0 flex-1">{c.to_email}</span>
                    <a
                      href={c.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-purple-500 truncate max-w-[40%]"
                      title={c.original_url}
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{c.original_url}</span>
                    </a>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(c.clicked_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Lists */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CARDS.filter(c => c.items !== null).map((card) => (
            <Card key={card.title} className={`border ${card.borderColor}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                  {card.title}
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {card.items!.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {card.items!.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No data yet</p>
                ) : (
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {card.items!.map((email, i) => (
                      <div
                        key={`${email}-${i}`}
                        className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md bg-muted/50"
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${card.color.replace('text-', 'bg-')}`} />
                        <span className="truncate">{email}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
