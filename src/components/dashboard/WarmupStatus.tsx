import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Flame, ShieldCheck, TrendingUp, Info, Mail } from 'lucide-react';

interface WarmupStage {
  name: string;
  description: string;
  recommendation: string;
  maxDaily: number;
  icon: React.ReactNode;
  color: string;
  badgeClass: string;
  progressPercent: number;
}

const STAGES: WarmupStage[] = [
  {
    name: 'Warming Up',
    description: 'This SMTP account is new. Send small volumes to build sender reputation with providers.',
    recommendation: 'Send 10–20 personalized emails per day. Focus on high-quality, engaged recipients.',
    maxDaily: 20,
    icon: <Flame className="h-5 w-5" />,
    color: 'text-orange-500',
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-200',
    progressPercent: 33,
  },
  {
    name: 'Building Reputation',
    description: 'This SMTP account is gaining trust. You can gradually increase sending volume.',
    recommendation: 'Send 50–75 emails per day. Monitor open rates and bounce rates closely.',
    maxDaily: 75,
    icon: <TrendingUp className="h-5 w-5" />,
    color: 'text-blue-500',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    progressPercent: 66,
  },
  {
    name: 'Ready for Campaigns',
    description: 'This SMTP account has a solid reputation. You can send at full capacity.',
    recommendation: 'You can now run bulk campaigns. Maintain good list hygiene to keep deliverability high.',
    maxDaily: 0,
    icon: <ShieldCheck className="h-5 w-5" />,
    color: 'text-green-500',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    progressPercent: 100,
  },
];

function getWarmupStage(createdAt: string): { stage: WarmupStage; daysActive: number; daysToNext: number | null } {
  const created = new Date(createdAt);
  const now = new Date();
  const daysActive = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

  if (daysActive < 14) return { stage: STAGES[0], daysActive, daysToNext: 14 - daysActive };
  if (daysActive < 28) return { stage: STAGES[1], daysActive, daysToNext: 28 - daysActive };
  return { stage: STAGES[2], daysActive, daysToNext: null };
}

interface SmtpAccount {
  id: string;
  label: string;
  smtp_username: string;
  created_at: string;
  is_default: boolean;
}

export function WarmupStatus() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SmtpAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('smtp_accounts')
        .select('id, label, smtp_username, created_at, is_default')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (!error && data) {
        setAccounts(data);
        const stored = localStorage.getItem('warmupSelectedSmtpId');
        const initial = data.find(a => a.id === stored)?.id
          ?? data.find(a => a.is_default)?.id
          ?? data[0]?.id
          ?? null;
        setSelectedId(initial);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    localStorage.setItem('warmupSelectedSmtpId', id);
  };

  if (loading) return null;

  if (accounts.length === 0) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            Email Account Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Add an SMTP account in Settings to track sender reputation and warmup progress.
          </p>
        </CardContent>
      </Card>
    );
  }

  const selected = accounts.find(a => a.id === selectedId) ?? accounts[0];
  const { stage, daysActive, daysToNext } = getWarmupStage(selected.created_at);

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span className={stage.color}>{stage.icon}</span>
            Email Account Health
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selected.id} onValueChange={handleSelect}>
              <SelectTrigger className="h-8 w-[240px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    {a.label} — {a.smtp_username}
                    {a.is_default ? ' (default)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge className={`${stage.badgeClass} border font-medium`}>{stage.name}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Warmup Progress</span>
            <span className="font-medium">{stage.progressPercent}%</span>
          </div>
          <Progress value={stage.progressPercent} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
            <span>Day {daysActive} since added</span>
            {daysToNext !== null ? (
              <span>{daysToNext} days to next stage</span>
            ) : (
              <span>Fully warmed</span>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
          <p className="text-sm text-foreground">{stage.description}</p>
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>{stage.recommendation}</p>
          </div>
        </div>

        {stage.maxDaily > 0 && (
          <div className="flex items-center justify-between text-sm rounded-lg border border-border p-3">
            <span className="text-muted-foreground">Recommended daily limit</span>
            <span className="font-semibold">{stage.maxDaily} emails/day</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
