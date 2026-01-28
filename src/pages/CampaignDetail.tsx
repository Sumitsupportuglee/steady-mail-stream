import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  Loader2, 
  Mail, 
  Eye, 
  MousePointerClick,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

interface Campaign {
  id: string;
  subject: string;
  body_html: string | null;
  status: 'draft' | 'queued' | 'sending' | 'completed';
  recipient_count: number;
  created_at: string;
  sender_identities: {
    from_name: string;
    from_email: string;
  } | null;
}

interface EmailStats {
  total: number;
  sent: number;
  pending: number;
  failed: number;
}

interface TrackingStats {
  opens: number;
  clicks: number;
  openRate: number;
  clickRate: number;
}

export default function CampaignDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [emailStats, setEmailStats] = useState<EmailStats>({ total: 0, sent: 0, pending: 0, failed: 0 });
  const [trackingStats, setTrackingStats] = useState<TrackingStats>({ opens: 0, clicks: 0, openRate: 0, clickRate: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      fetchCampaignData();
    }
  }, [user, id]);

  const fetchCampaignData = async () => {
    try {
      // Fetch campaign
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select(`
          *,
          sender_identities (
            from_name,
            from_email
          )
        `)
        .eq('id', id)
        .eq('user_id', user!.id)
        .single();

      if (campaignError) throw campaignError;
      setCampaign(campaignData);

      // Fetch email queue stats
      const { data: queueData } = await supabase
        .from('email_queue')
        .select('status')
        .eq('campaign_id', id);

      if (queueData) {
        const stats = {
          total: queueData.length,
          sent: queueData.filter(e => e.status === 'sent').length,
          pending: queueData.filter(e => e.status === 'pending').length,
          failed: queueData.filter(e => e.status === 'failed').length,
        };
        setEmailStats(stats);
      }

      // Fetch tracking stats
      const { count: openCount } = await supabase
        .from('email_opens')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', id);

      const { count: clickCount } = await supabase
        .from('email_clicks')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', id);

      const sentCount = queueData?.filter(e => e.status === 'sent').length || 0;
      setTrackingStats({
        opens: openCount || 0,
        clicks: clickCount || 0,
        openRate: sentCount > 0 ? Math.round(((openCount || 0) / sentCount) * 100 * 10) / 10 : 0,
        clickRate: sentCount > 0 ? Math.round(((clickCount || 0) / sentCount) * 100 * 10) / 10 : 0,
      });
    } catch (error) {
      console.error('Error fetching campaign:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { variant: 'default' | 'secondary' | 'outline'; className: string }> = {
      draft: { variant: 'secondary', className: '' },
      queued: { variant: 'outline', className: 'border-yellow-500 text-yellow-600' },
      sending: { variant: 'default', className: 'bg-blue-500' },
      completed: { variant: 'default', className: 'bg-green-500' },
    };
    const config = configs[status] || configs.draft;
    return <Badge variant={config.variant} className={config.className}>{status}</Badge>;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!campaign) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Campaign not found</h2>
          <Button asChild className="mt-4">
            <Link to="/campaigns">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Campaigns
            </Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const deliveryProgress = emailStats.total > 0 
    ? Math.round((emailStats.sent / emailStats.total) * 100) 
    : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/campaigns">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{campaign.subject}</h1>
              {getStatusBadge(campaign.status)}
            </div>
            <p className="text-muted-foreground mt-1">
              Created {new Date(campaign.created_at).toLocaleDateString()}
              {campaign.sender_identities && (
                <> • From {campaign.sender_identities.from_name} &lt;{campaign.sender_identities.from_email}&gt;</>
              )}
            </p>
          </div>
        </div>

        {/* Delivery Progress */}
        {(campaign.status === 'queued' || campaign.status === 'sending') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Delivery Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{emailStats.sent} of {emailStats.total} sent</span>
                  <span>{deliveryProgress}%</span>
                </div>
                <Progress value={deliveryProgress} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Recipients</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{emailStats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{emailStats.sent}</div>
              {emailStats.pending > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" />
                  {emailStats.pending} pending
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{trackingStats.openRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {trackingStats.opens} opens
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{trackingStats.clickRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {trackingStats.clicks} clicks
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Failed Emails */}
        {emailStats.failed > 0 && (
          <Card className="border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-lg">Failed Deliveries</CardTitle>
              </div>
              <CardDescription>
                {emailStats.failed} emails failed to send
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Email Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Email Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-6 bg-white">
              <div className="border-b pb-4 mb-4">
                <div className="text-sm text-muted-foreground">Subject</div>
                <div className="font-medium">{campaign.subject}</div>
              </div>
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: campaign.body_html || '' }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
