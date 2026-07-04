'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

interface TimelinePoint { t: number; pnl: number }
interface TimelineResponse { points: TimelinePoint[]; realized: number; trades: number; ceiling?: boolean }

interface TipProps {
  active?: boolean;
  payload?: { value?: number; payload?: TimelinePoint }[];
}

function TimelineTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  const v = (payload[0].value ?? 0) as number;
  const date = pt ? new Date(pt.t * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return (
    <div className="glass-strong rounded-lg px-3 py-2 text-xs">
      <p className="text-white/45">{date}</p>
      <p className={`font-bold ${v >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
        {v >= 0 ? '+' : ''}{formatCurrency(v, true)}
      </p>
    </div>
  );
}

export default function PnlTimeline({
  address,
  data: externalData,
  loading: externalLoading,
  anchor,
}: {
  address: string;
  data?: TimelineResponse | null;
  loading?: boolean;
  /** Authoritative realized P&L to anchor the curve's endpoint to. The trade
   *  replay can be incomplete for very high-volume wallets, so when provided we
   *  shift the whole curve so its last point equals this value. */
  anchor?: number | null;
}) {
  const [internalData, setInternalData] = useState<TimelineResponse | null>(null);
  const [internalLoading, setInternalLoading] = useState(externalData === undefined);

  // Only self-fetch when the parent hasn't supplied data
  useEffect(() => {
    if (externalData !== undefined) return;
    if (!address) return;
    let live = true;
    setInternalLoading(true);
    fetch(`/api/wallet/${address}/timeline`)
      .then(r => r.json())
      .then((d: TimelineResponse) => { if (live && Array.isArray(d?.points)) setInternalData(d); })
      .catch(() => {})
      .finally(() => { if (live) setInternalLoading(false); });
    return () => { live = false; };
  }, [address, externalData]);

  const data = externalData !== undefined ? externalData : internalData;
  const loading = externalData !== undefined ? (externalLoading ?? false) : internalLoading;

  const rawPoints = [...(data?.points ?? [])].sort((a, b) => a.t - b.t);
  const rawLast = rawPoints.length ? rawPoints[rawPoints.length - 1].pnl : 0;
  const offset = (anchor != null && rawPoints.length) ? anchor - rawLast : 0;
  const points = offset ? rawPoints.map(p => ({ ...p, pnl: p.pnl + offset })) : rawPoints;
  const current = anchor != null ? anchor : (data?.realized ?? 0);
  const positive = current >= 0;
  const stroke = positive ? '#34d399' : '#fb7185';

  // Inactive wallets: the P&L series can be flat across the whole window the
  // API returns (all profit was made earlier). Flag it so the flat line does
  // not read like a broken chart.
  const isFlat = points.length > 1 && (() => {
    let min = points[0].pnl, max = points[0].pnl;
    for (const p of points) { if (p.pnl < min) min = p.pnl; if (p.pnl > max) max = p.pnl; }
    return (max - min) <= Math.max(1, Math.abs(current) * 0.001);
  })();

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">PnL Timeline</p>
          <p className="text-[10px] text-white/25 mt-0.5">
            {isFlat
              ? 'No P&L change in the period covered by available history — this wallet has been inactive'
              : data?.ceiling
                ? `Last 3,500 trades · public API limit`
                : data?.trades
                  ? `${data.trades.toLocaleString()} trades · full history`
                  : 'Cumulative realized P&L from trade history'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-wider text-white/25">Current</p>
          <p className={`text-lg font-black leading-none ${positive ? 'text-grad-profit' : 'text-grad-loss'}`}>
            {positive ? '+' : ''}{formatCurrency(current, true)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-xl animate-shimmer text-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
          <div>
            <p className="text-xs font-semibold text-white/45">Building full-history PnL chart…</p>
            <p className="mt-1 text-[10px] text-white/25">Large wallets can take a few seconds</p>
          </div>
        </div>
      ) : points.length < 2 ? (
        <div className="flex h-56 items-center justify-center text-xs text-white/25">
          Not enough trade history to chart
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={224}>
          <AreaChart data={points} margin={{ top: 6, right: 8, left: -6, bottom: 0 }}>
            <defs>
              <linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="t"
              tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }}
              axisLine={false} tickLine={false} minTickGap={40}
              tickFormatter={(v) => new Date((v as number) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }}
              axisLine={false} tickLine={false} width={52}
              tickFormatter={(v) => formatCurrency(v as number, true)}
            />
            <Tooltip content={<TimelineTooltip />} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
            <Area type="linear" dataKey="pnl" stroke={stroke} strokeWidth={3} fill="url(#pnlFill)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
