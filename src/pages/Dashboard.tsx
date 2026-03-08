import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ReviewForm } from '@/components/reviews/ReviewForm';
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
  const { isActive, subscription, daysRemaining, loading: subLoading } = useSubscription();
  const [stats, setStats] = useState<DashboardStats>({ emailsSent: 0, openRate: 0, replyRate: 0, conversionRate: 0 });
  const [recentCampaigns, setRecentCampaigns] = useState<RecentCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchDashboardData();
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
        clickRate: Math.round(clickRate * 10) / 10,
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

  const totalDays = subscription?.plan === 'yearly' ? 365 : 30;
  const progressPercent = isActive ? Math.max(0, (daysRemaining / totalDays) * 100) : 0;

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

        {/* Subscription Status */}
        {isActive ? (
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Crown className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">
                      {subscription?.plan === 'yearly' ? 'Yearly' : 'Monthly'} Plan
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
        ) : (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-semibold">No Active Subscription</p>
                  <p className="text-sm text-muted-foreground">
                    Subscribe to unlock lead generation and email campaigns
                  </p>
                </div>
              </div>
              <Button asChild>
                <Link to="/pricing">Subscribe Now</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
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
