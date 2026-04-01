import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClient } from '@/contexts/ClientContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, MailOpen, CheckCircle, MousePointerClick } from 'lucide-react';

interface CampaignStats {
  contacted: number;
  delivered: number;
  opened: number;
  clicked: number;
  contactedEmails: string[];
  openedEmails: string[];
  clickedEmails: string[];
}

export default function CRM() {
  const { user } = useAuth();
  const { activeClientId } = useClient();
  const [stats, setStats] = useState<CampaignStats>({
    contacted: 0, delivered: 0, opened: 0, clicked: 0,
    contactedEmails: [], openedEmails: [], clickedEmails: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      // Contacted: all emails sent
      let queueQuery = supabase
        .from('email_queue')
        .select('to_email, status')
        .eq('user_id', user.id)
        .eq('status', 'sent');
      if (activeClientId) {
        const { data: campaigns } = await supabase
          .from('campaigns')
          .select('id')
          .eq('user_id', user.id)
          .eq('client_id', activeClientId);
        if (campaigns && campaigns.length > 0) {
          queueQuery = queueQuery.in('campaign_id', campaigns.map(c => c.id));
        }
      }
      const { data: sentEmails } = await queueQuery;

      // Opened: unique contacts who opened
      let opensQuery = supabase
        .from('email_opens')
        .select('email_queue_id')
        .eq('user_id', user.id);
      const { data: opens } = await opensQuery;

      // Get emails for opened queue IDs
      let openedEmails: string[] = [];
      if (opens && opens.length > 0) {
        const uniqueQueueIds = [...new Set(opens.map(o => o.email_queue_id))];
        const { data: openedQueue } = await supabase
          .from('email_queue')
          .select('to_email')
          .in('id', uniqueQueueIds);
        openedEmails = [...new Set((openedQueue || []).map(q => q.to_email))];
      }

      // Clicked: unique contacts who clicked
      let clicksQuery = supabase
        .from('email_clicks')
        .select('email_queue_id')
        .eq('user_id', user.id);
      const { data: clicks } = await clicksQuery;

      let clickedEmails: string[] = [];
      if (clicks && clicks.length > 0) {
        const uniqueClickQueueIds = [...new Set(clicks.map(c => c.email_queue_id))];
        const { data: clickedQueue } = await supabase
          .from('email_queue')
          .select('to_email')
          .in('id', uniqueClickQueueIds);
        clickedEmails = [...new Set((clickedQueue || []).map(q => q.to_email))];
      }

      const contactedEmails = [...new Set((sentEmails || []).map(e => e.to_email))];

      setStats({
        contacted: contactedEmails.length,
        delivered: (sentEmails || []).length,
        opened: openedEmails.length,
        clicked: clickedEmails.length,
        contactedEmails,
        openedEmails,
        clickedEmails,
      });
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
      supabase.channel('crm-opens').on('postgres_changes', { event: '*', schema: 'public', table: 'email_opens' }, () => fetchStats()).subscribe(),
      supabase.channel('crm-clicks').on('postgres_changes', { event: '*', schema: 'public', table: 'email_clicks' }, () => fetchStats()).subscribe(),
    ];

    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [fetchStats]);

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
      items: null, // numbers only
    },
    {
      title: 'Opened',
      description: 'Contacts who opened the email',
      value: stats.opened,
      icon: MailOpen,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      items: stats.openedEmails,
    },
    {
      title: 'Clicked',
      description: 'Contacts who clicked a link',
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
