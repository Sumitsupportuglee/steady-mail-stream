import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClient } from '@/contexts/ClientContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Mail,
  Eye,
  MousePointerClick,
  Users,
  Send,
  Loader2,
  Building2,
  BarChart3,
} from 'lucide-react';

interface ClientStats {
  totalCampaigns: number;
  totalContacts: number;
  emailsSent: number;
  opens: number;
  clicks: number;
  openRate: number;
  clickRate: number;
}

interface CampaignRow {
  id: string;
  subject: string;
  status: string;
  recipient_count: number;
  created_at: string;
}

export default function ClientReport() {
  const { user } = useAuth();
  const { clients, activeClientId, setActiveClientId } = useClient();
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && activeClientId) {
      fetchReport();
    } else {
      setStats(null);
      setCampaigns([]);
    }
  }, [user, activeClientId]);

  const fetchReport = async () => {
    if (!activeClientId) return;
    setLoading(true);

    try {
      const [campaignsRes, contactsRes, emailsSentRes, opensRes, clicksRes] = await Promise.all([
        supabase.from('campaigns').select('id, subject, status, recipient_count, created_at').eq('user_id', user!.id).eq('client_id', activeClientId).order('created_at', { ascending: false }),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).eq('client_id', activeClientId),
        supabase.from('email_queue').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).eq('status', 'sent'),
        supabase.from('email_opens').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('email_clicks').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
      ]);

      const campaignIds = (campaignsRes.data || []).map(c => c.id);
      setCampaigns(campaignsRes.data || []);

      const totalSent = emailsSentRes.count || 0;
      const totalOpens = opensRes.count || 0;
      const totalClicks = clicksRes.count || 0;

      setStats({
        totalCampaigns: campaignsRes.data?.length || 0,
        totalContacts: contactsRes.count || 0,
        emailsSent: totalSent,
        opens: totalOpens,
        clicks: totalClicks,
        openRate: totalSent > 0 ? Math.round((totalOpens / totalSent) * 1000) / 10 : 0,
        clickRate: totalSent > 0 ? Math.round((totalClicks / totalSent) * 1000) / 10 : 0,
      });
    } catch (error) {
      console.error('Error fetching client report:', error);
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Client Report</h1>
            <p className="text-muted-foreground mt-1">Performance analytics per client</p>
          </div>
          <Select value={activeClientId || ''} onValueChange={(v) => setActiveClientId(v || null)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3" />
                    {c.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!activeClientId ? (
          <div className="text-center py-16">
            <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold">Select a Client</h2>
            <p className="text-muted-foreground mt-1">Choose a client to view their performance report</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : stats && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
                  <Send className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">{stats.totalCampaigns}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Contacts</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-3xl font-bold">{stats.totalContacts}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.openRate}%</div>
                  <p className="text-xs text-muted-foreground">{stats.opens} opens</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
                  <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.clickRate}%</div>
                  <p className="text-xs text-muted-foreground">{stats.clicks} clicks</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Campaigns</CardTitle>
                <CardDescription>{campaigns.length} campaigns for this client</CardDescription>
              </CardHeader>
              <CardContent>
                {campaigns.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No campaigns yet for this client</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Recipients</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.subject}</TableCell>
                          <TableCell>{getStatusBadge(c.status)}</TableCell>
                          <TableCell>{c.recipient_count}</TableCell>
                          <TableCell className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
