import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SmtpHealthMetrics } from '@/components/settings/SmtpHealthMetrics';
import { Server, Loader2, ShieldCheck } from 'lucide-react';

interface SmtpRow {
  id: string;
  label: string;
  smtp_username: string;
  is_active: boolean;
}

export function SenderHealthOverview() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SmtpRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('smtp_accounts')
        .select('id, label, smtp_username, is_active')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      setAccounts((data as any[]) || []);
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading sender health…
        </CardContent>
      </Card>
    );
  }

  if (accounts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Sender Health & Domain Status
            </CardTitle>
            <CardDescription>
              Deliverability confidence and risk per SMTP account — based on the last 30 days.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/settings">Manage</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {accounts.map(acct => (
            <div key={acct.id} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Server className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{acct.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{acct.smtp_username}</p>
                </div>
              </div>
              <SmtpHealthMetrics smtpAccountId={acct.id} userId={user!.id} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
