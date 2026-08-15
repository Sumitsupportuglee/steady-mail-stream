import { LucideIcon } from 'lucide-react';
import { Sparkline } from './Sparkline';
import { cn } from '@/lib/utils';

interface MetricTileProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  accent?: string;
  series?: number[];
  delta?: number | null;
  className?: string;
}

/** Dense ops-console KPI tile: label, big number, trend delta and sparkline. */
export function MetricTile({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'hsl(var(--primary))',
  series,
  delta = null,
  className,
}: MetricTileProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border bg-card p-4 transition-colors hover:border-primary/40',
        className,
      )}
    >
      <span className="absolute left-0 top-0 h-full w-[3px]" style={{ background: accent }} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-bold tabular-nums leading-none">{value}</span>
        {delta !== null && (
          <span
            className="text-[11px] font-semibold tabular-nums"
            style={{
              color:
                delta >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))',
            }}
          >
            {delta >= 0 ? '+' : ''}
            {delta}%
          </span>
        )}
      </div>
      {sub && <p className="mt-1 text-xs text-muted-foreground truncate">{sub}</p>}
      {series && series.length > 1 && (
        <div className="mt-3 -mx-1">
          <Sparkline data={series} color={accent} height={26} />
        </div>
      )}
    </div>
  );
}
