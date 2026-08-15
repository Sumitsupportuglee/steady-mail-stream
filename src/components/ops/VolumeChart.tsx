import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TimelinePoint } from '@/hooks/useSendingTimeline';

interface VolumeChartProps {
  points: TimelinePoint[];
  height?: number;
}

/** 30-day send volume bars with engagement-rate overlay lines. */
export function VolumeChart({ points, height = 240 }: VolumeChartProps) {
  const data = points.map((p) => ({
    ...p,
    openRate: p.sent > 0 ? Math.round((p.opens / p.sent) * 1000) / 10 : 0,
    clickRate: p.sent > 0 ? Math.round((p.clicks / p.sent) * 1000) / 10 : 0,
  }));

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="label"
            interval={Math.max(0, Math.floor(data.length / 7) - 1)}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            unit="%"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
              color: 'hsl(var(--popover-foreground))',
            }}
          />
          <Bar
            yAxisId="left"
            dataKey="sent"
            name="Sent"
            fill="hsl(var(--primary))"
            radius={[2, 2, 0, 0]}
            maxBarSize={16}
          />
          <Bar
            yAxisId="left"
            dataKey="failed"
            name="Failed"
            fill="hsl(var(--destructive))"
            radius={[2, 2, 0, 0]}
            maxBarSize={16}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="openRate"
            name="Open rate"
            stroke="hsl(var(--success))"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="clickRate"
            name="Click rate"
            stroke="hsl(var(--info))"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
