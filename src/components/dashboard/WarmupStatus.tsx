import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { Flame, ShieldCheck, TrendingUp, Info } from 'lucide-react';

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
    description: 'Your email account is new. Send small volumes to build sender reputation with providers.',
    recommendation: 'Send 10–20 personalized emails per day. Focus on high-quality, engaged recipients.',
    maxDaily: 20,
    icon: <Flame className="h-5 w-5" />,
    color: 'text-orange-500',
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-200',
    progressPercent: 33,
  },
  {
    name: 'Building Reputation',
    description: 'Your account is gaining trust. You can gradually increase sending volume.',
    recommendation: 'Send 50–75 emails per day. Monitor open rates and bounce rates closely.',
    maxDaily: 75,
    icon: <TrendingUp className="h-5 w-5" />,
    color: 'text-blue-500',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    progressPercent: 66,
  },
  {
    name: 'Ready for Campaigns',
    description: 'Your email account has a solid reputation. You can send at full capacity.',
    recommendation: 'You can now run bulk campaigns. Maintain good list hygiene to keep deliverability high.',
    maxDaily: 0,
    icon: <ShieldCheck className="h-5 w-5" />,
    color: 'text-green-500',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    progressPercent: 100,
  },
];

function getWarmupStage(accountCreatedAt: string): { stage: WarmupStage; daysActive: number; daysToNext: number | null } {
  const created = new Date(accountCreatedAt);
  const now = new Date();
  const daysActive = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

  if (daysActive < 14) {
    return { stage: STAGES[0], daysActive, daysToNext: 14 - daysActive };
  } else if (daysActive < 28) {
    return { stage: STAGES[1], daysActive, daysToNext: 28 - daysActive };
  } else {
    return { stage: STAGES[2], daysActive, daysToNext: null };
  }
}

export function WarmupStatus() {
  const { user } = useAuth();
  const [warmup, setWarmup] = useState<ReturnType<typeof getWarmupStage> | null>(null);

  useEffect(() => {
    if (user?.created_at) {
      setWarmup(getWarmupStage(user.created_at));
    }
  }, [user]);

  if (!warmup) return null;

  const { stage, daysActive, daysToNext } = warmup;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span className={stage.color}>{stage.icon}</span>
            Email Account Health
          </CardTitle>
          <Badge className={`${stage.badgeClass} border font-medium`}>
            {stage.name}
          </Badge>
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
            <span>Day {daysActive}</span>
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
