interface SparklineProps {
  data: number[];
  color?: string;
  className?: string;
  height?: number;
}

/** Tiny inline SVG sparkline with soft area fill — no deps, cheap to render. */
export function Sparkline({ data, color = 'hsl(var(--primary))', className, height = 28 }: SparklineProps) {
  const series = data.length ? data : [0, 0];
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const range = max - min || 1;
  const w = 100;
  const pts = series.map((v, i) => {
    const x = series.length === 1 ? w : (i / (series.length - 1)) * w;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ height, width: '100%', display: 'block' }}
      aria-hidden="true"
    >
      <polygon points={`0,${height} ${pts.join(' ')} ${w},${height}`} fill={color} opacity={0.12} />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
