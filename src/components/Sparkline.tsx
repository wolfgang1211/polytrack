'use client';

/** Tiny axis-less SVG sparkline for dense table rows (Dexscreener-style).
 *  Colors green/red by whether the series ends up or down. */
export default function Sparkline({
  data, width = 88, height = 28,
}: { data?: number[]; width?: number; height?: number }) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="rounded animate-shimmer opacity-40" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const up = data[data.length - 1] >= data[0];
  const stroke = up ? '#34d399' : '#fb7185';
  const id = `sg-${stroke.slice(1)}-${width}-${height}`;

  const stepX = width / (data.length - 1);
  const y = (v: number) => height - 2 - ((v - min) / range) * (height - 4);
  const pts = data.map((v, i) => `${(i * stepX).toFixed(1)},${y(v).toFixed(1)}`);
  const line = `M ${pts.join(' L ')}`;
  const area = `${line} L ${width},${height} L 0,${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
