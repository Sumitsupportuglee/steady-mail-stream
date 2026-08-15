interface Segment {
  label: string;
  value: number;
  color: string;
}

interface DonutGaugeProps {
  segments: Segment[];
  centerValue: string | number;
  centerLabel: string;
  size?: number;
  thickness?: number;
}

/** Multi-segment donut gauge (domain/sender health breakdown). */
export function DonutGauge({
  segments,
  centerValue,
  centerLabel,
  size = 150,
  thickness = 14,
}: DonutGaugeProps) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={thickness}
          />
          {total > 0 &&
            segments.map((s) => {
              const len = (s.value / total) * c;
              const dash = `${len} ${c - len}`;
              const el = (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += len;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums leading-none">{centerValue}</span>
          <span className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {centerLabel}
          </span>
        </div>
      </div>
      <ul className="space-y-2 min-w-0">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-muted-foreground truncate">{s.label}</span>
            <span className="ml-auto font-semibold tabular-nums">{s.value.toLocaleString()}</span>
            <span className="w-10 text-right text-muted-foreground tabular-nums">
              {total > 0 ? `${Math.round((s.value / total) * 100)}%` : '0%'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
