import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AppUpdate {
  id: string;
  title: string;
  description: string;
  version: string | null;
  created_at: string;
}

export function UpdatesSection() {
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUpdates = async () => {
      const { data } = await supabase
        .from('app_updates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      if (data) setUpdates(data);
      setLoading(false);
    };
    fetchUpdates();
  }, []);

  if (loading) return null;
  if (updates.length === 0) return null;

  return (
    <section className="py-24">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            What's New
          </div>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Latest Updates
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            We're constantly improving Senddot. Here's what's new.
          </p>
        </div>

        <div className="mt-12 space-y-0">
          {updates.map((update, index) => (
            <div key={update.id} className="relative flex gap-6">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary/10">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                {index < updates.length - 1 && (
                  <div className="w-px flex-1 bg-border" />
                )}
              </div>

              {/* Content */}
              <div className="pb-10">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold">{update.title}</h3>
                  {update.version && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {update.version}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {update.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
