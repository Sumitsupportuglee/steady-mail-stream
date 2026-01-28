import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Coins, 
  Mail, 
  MousePointerClick, 
  Eye, 
  Plus, 
  Users,
  Send,
  Loader2
} from 'lucide-react';

interface DashboardStats {
  emailsSent: number;
  openRate: number;
  clickRate: number;
  credits: number;
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
  const [stats, setStats] = useState<DashboardStats>({
    emailsSent: 0,
    openRate: 0,
    clickRate: 0,
    credits: 999999,
  });
  const [recentCampaigns, setRecentCampaigns] = useState<RecentCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch profile for credits
      const { data: profile } = await supabase
        .from('profiles')
        .select('email_credits')
        .eq('id', user!.id)
        .single();

      // Fetch emails sent in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { count: emailsSent } = await supabase
        .from('email_queue')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('status', 'sent')
        .gte('sent_at', thirtyDaysAgo.toISOString());

      // Fetch open and click counts for rate calculation
      const { count: totalSent } = await supabase
        .from('email_queue')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('status', 'sent');

      const { count: totalOpens } = await supabase
        .from('email_opens')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id);

      const { count: totalClicks } = await supabase
        .from('email_clicks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id);

      // Fetch recent campaigns
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, subject, status, recipient_count, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const openRate = totalSent && totalSent > 0 ? ((totalOpens || 0) / totalSent) * 100 : 0;
      const clickRate = totalSent && totalSent > 0 ? ((totalClicks || 0) / totalSent) * 100 : 0;

      setStats({
        emailsSent: emailsSent || 0,
        openRate: Math.round(openRate * 10) / 10,
        clickRate: Math.round(clickRate * 10) / 10,
        credits: profile?.email_credits || 999999,
      });

      setRecentCampaigns(campaigns || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'secondary',
      queued: 'outline',
      sending: 'default',
      completed: 'default',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Overview of your email marketing performance
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link to="/contacts">
                <Users className="mr-2 h-4 w-4" />
                Add Contacts
              </Link>
            </Button>
            <Button asChild>
              <Link to="/campaigns/new">
                <Plus className="mr-2 h-4 w-4" />
                New Campaign
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Credit Balance</CardTitle>
              <Coins className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {stats.credits === 999999 ? '∞' : stats.credits.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Unlimited credits (Beta)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.emailsSent.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.openRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">Average open rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.clickRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">Average click rate</p>
            </CardContent>
          </Card>
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
                <p className="text-muted-foreground mt-1 mb-4">
                  Create your first campaign to start reaching your audience
                </p>
                <Button asChild>
                  <Link to="/campaigns/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Campaign
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <Link 
                        to={`/campaigns/${campaign.id}`}
                        className="font-medium hover:text-primary transition-colors truncate block"
                      >
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
      </div>
    </AppLayout>
  );
}
