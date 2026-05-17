import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  ArrowLeft, 
  Loader2, 
  Mail, 
  Eye, 
  MousePointerClick,
  CheckCircle,
  XCircle,
  Clock,
  Shuffle
} from 'lucide-react';

interface Campaign {
  id: string;
  subject: string;
  body_html: string | null;
  status: 'draft' | 'queued' | 'sending' | 'completed';
  recipient_count: number;
  created_at: string;
  smtp_rotation_pool: string[] | null;
  sender_identities: {
    from_name: string;
    from_email: string;
  } | null;
}

interface RotationStat {
  id: string;
  label: string;
  fromEmail: string;
  sent: number;
  pending: number;
  failed: number;
  share: number;
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
  const [failedErrors, setFailedErrors] = useState<string[]>([]);
  const [rotationStats, setRotationStats] = useState<RotationStat[]>([]);

  useEffect(() => {
    if (user && id) {
      fetchCampaignData();
    }
  }, [user, id]);

  // Poll for live updates while the campaign is actively sending
  useEffect(() => {
    if (!user || !id) return;
    if (campaign?.status !== 'queued' && campaign?.status !== 'sending') return;
    const interval = setInterval(() => fetchCampaignData(), 5000);
    return () => clearInterval(interval);
  }, [user, id, campaign?.status]);

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
      setCampaign(campaignData as any);

      // Fetch email queue stats with error details
      const { data: queueData } = await supabase
        .from('email_queue')
        .select('status, error_log, smtp_account_id')
        .eq('campaign_id', id);

      if (queueData) {
        const stats = {
          total: queueData.length,
          sent: queueData.filter(e => e.status === 'sent').length,
          pending: queueData.filter(e => e.status === 'pending').length,
          failed: queueData.filter(e => e.status === 'failed').length,
        };
        setEmailStats(stats);

        const errorCounts = new Map<string, number>();
        for (const e of queueData) {
          if (e.status === 'failed' && e.error_log) {
            const key = (e.error_log as string).trim();
            errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
          }
        }
        const grouped = Array.from(errorCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([msg, count]) => (count > 1 ? `[${count}×] ${msg}` : msg));
        setFailedErrors(grouped);

        // Rotation pool per-account distribution
        const pool = (campaignData as any)?.smtp_rotation_pool as string[] | null;
        if (pool && pool.length > 1) {
          const perAccount = new Map<string, { sent: number; pending: number; failed: number }>();
          for (const pid of pool) perAccount.set(pid, { sent: 0, pending: 0, failed: 0 });
          for (const row of queueData) {
            const key = row.smtp_account_id ?? 'unassigned';
            const agg = perAccount.get(key) ?? { sent: 0, pending: 0, failed: 0 };
            if (row.status === 'sent') agg.sent++;
            else if (row.status === 'pending') agg.pending++;
            else if (row.status === 'failed') agg.failed++;
            perAccount.set(key, agg);
          }

          const { data: accounts } = await supabase
            .from('smtp_accounts')
            .select('id, label, smtp_username, sender_identities(from_email)')
            .in('id', pool);

          const totalSent = Array.from(perAccount.values()).reduce((s, v) => s + v.sent, 0);
          const rows: RotationStat[] = (accounts ?? []).map((a: any) => {
            const agg = perAccount.get(a.id) ?? { sent: 0, pending: 0, failed: 0 };
            return {
              id: a.id,
              label: a.label || 'SMTP',
              fromEmail: a.sender_identities?.from_email || a.smtp_username || '',
              sent: agg.sent,
              pending: agg.pending,
              failed: agg.failed,
              share: totalSent > 0 ? Math.round((agg.sent / totalSent) * 100) : 0,
            };
          }).sort((a, b) => b.sent - a.sent);
          setRotationStats(rows);
        } else {
          setRotationStats([]);
        }
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

        {/* Rotation Pool Distribution */}
        {rotationStats.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shuffle className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Rotation Pool Distribution</CardTitle>
              </div>
              <CardDescription>
                Live breakdown of how emails are distributed across SMTP accounts in this campaign's rotation pool.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead className="w-[200px]">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rotationStats.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.label}</div>
                        <div className="text-xs text-muted-foreground">{r.fromEmail}</div>
                        {r.sent === 0 && r.pending === 0 && r.failed === 0 && (
                          <div className="text-xs text-muted-foreground mt-1 italic">
                            Unused — check quota, status, or linked identity
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">{r.sent}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{r.pending}</TableCell>
                      <TableCell className="text-right font-mono text-destructive">{r.failed}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${r.share}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right">{r.share}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

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
            {failedErrors.length > 0 && (
              <CardContent>
                <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                  <p className="font-semibold mb-1">Common causes:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li><b>535 Authentication credentials invalid</b> — your SMTP password is wrong or expired. Update it in Settings → SMTP Accounts.</li>
                    <li><b>550 invalid DNS MX / mailbox unavailable</b> — the recipient address is dead. We auto-suppress these so you won't email them again.</li>
                    <li><b>503 Bad sequence of commands</b> — server-side hiccup; affected emails are automatically retried.</li>
                    <li><b>451 / 421 mails per session</b> — provider rate-limit. We back off and retry on the next cycle.</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  {failedErrors.map((err, i) => (
                    <div key={i} className="text-sm text-destructive bg-destructive/10 rounded p-3 font-mono break-all">
                      {err}
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
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
