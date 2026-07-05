'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';

/* ── Reward Farming Screener ─────────────────────────────────────
   Polymarket pays real daily USD reward pools to makers quoting
   inside each market's qualifying band. This section surfaces those
   pools directly (no estimates from volume heuristics) and ranks
   them by estimated APR on $1K of quoting capital. */

interface RewardFarm {
  conditionId: string;
  question: string;
  slug: string;
  eventSlug?: string;
  image?: string;
  volume24h: number;
  liquidity: number;
  spread: number;
  dailyRate: number;
  minSize: number | null;
  maxSpread: number | null;
  estDailyReward: number;
  estApr: number;
  daysToResolve: number | null;
  competition: 'Low' | 'Medium' | 'High';
}

interface RewardsResponse {
  farms: RewardFarm[];
  totalDailyRewards: number;
  marketsWithRewards: number;
  scanned: number;
}

const COMP_COLOR: Record<RewardFarm['competition'], string> = {
  Low: '#34d399',
  Medium: '#fbbf24',
  High: '#fb7185',
};

function SectionHeader({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-mono text-[10px] font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.20)' }}>{index}</span>
      <div className="h-px w-12" style={{ background: 'var(--vi-border)' }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.25)' }}>{label}</span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--vi-border), transparent)' }} />
    </div>
  );
}

export default function RewardFarms() {
  const [data, setData] = useState<RewardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch('/api/liquidity/rewards')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.farms)) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const farms = data?.farms ?? [];
  const shown = showAll ? farms : farms.slice(0, 10);

  return (
    <section>
      <SectionHeader index="[03b]" label="Reward Farming — Real Daily Pools" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-xs text-white/40 max-w-2xl">
          Polymarket pays makers a <span className="text-white/70 font-semibold">real daily USD reward pool</span> per
          market for quoting inside the qualifying band. These are the actual program numbers — not volume-based estimates.
        </p>
        {data && (
          <span className="ml-auto rounded-full px-3 py-1 text-[11px] font-bold"
            style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}>
            {formatCurrency(data.totalDailyRewards, true)}/day across {data.marketsWithRewards} markets
          </span>
        )}
      </div>

      <div className="glass rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Header */}
        <div className="hidden sm:grid grid-cols-[1fr_90px_90px_90px_100px_90px_90px] gap-2 px-4 py-3 glass-strong"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {['Market', 'Daily Pool', 'Max Spread', 'Min Size', 'Liquidity', 'Crowding', 'Est. APR*'].map((h, i) => (
            <span key={h} className={`text-[10px] font-semibold uppercase tracking-widest text-white/30 ${i > 0 ? 'text-right' : ''}`}>{h}</span>
          ))}
        </div>

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[1fr_90px_90px_90px_100px_90px_90px] gap-2 px-4 py-3.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              {Array.from({ length: 7 }).map((_, j) => <div key={j} className="h-4 rounded animate-shimmer" />)}
            </div>
          ))
        ) : farms.length === 0 ? (
          <div className="px-4 py-12 text-center text-xs text-white/25">
            No active reward pools found right now — check back soon.
          </div>
        ) : shown.map(f => (
          <a key={f.conditionId}
            href={marketUrl(f.eventSlug, f.slug)}
            target="_blank" rel="noopener noreferrer"
            className="grid grid-cols-2 sm:grid-cols-[1fr_90px_90px_90px_100px_90px_90px] gap-2 px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="col-span-2 sm:col-span-1 flex items-center gap-2 min-w-0">
              {f.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.image} alt="" className="h-7 w-7 rounded-lg object-cover flex-shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="h-7 w-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs"
                  style={{ background: 'var(--vi-grad-25)' }}>💰</div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white/75 truncate">{f.question}</p>
                <p className="text-[10px] text-white/25">
                  {f.daysToResolve != null ? `resolves in ${f.daysToResolve}d` : 'open-ended'}
                  {' · '}spread {(f.spread * 100).toFixed(1)}¢
                </p>
              </div>
            </div>
            <span className="self-center text-right text-xs font-black text-emerald-400 tabular-nums">
              {formatCurrency(f.dailyRate, true)}/d
            </span>
            <span className="self-center text-right text-xs text-white/50 tabular-nums">
              {f.maxSpread != null ? `${f.maxSpread}¢` : '—'}
            </span>
            <span className="self-center text-right text-xs text-white/50 tabular-nums">
              {f.minSize != null ? f.minSize.toLocaleString() : '—'}
            </span>
            <span className="self-center text-right text-xs text-white/50 tabular-nums">
              {formatCurrency(f.liquidity, true)}
            </span>
            <span className="self-center text-right">
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: `${COMP_COLOR[f.competition]}14`, border: `1px solid ${COMP_COLOR[f.competition]}33`, color: COMP_COLOR[f.competition] }}>
                {f.competition}
              </span>
            </span>
            <span className="self-center text-right text-xs font-black tabular-nums"
              style={{ color: f.estApr >= 20 ? '#34d399' : f.estApr >= 5 ? '#fbbf24' : 'rgba(255,255,255,0.5)' }}>
              {f.estApr >= 1000 ? '>999' : f.estApr.toFixed(1)}%
            </span>
          </a>
        ))}

        {!loading && farms.length > 10 && (
          <button onClick={() => setShowAll(s => !s)}
            className="w-full py-3 text-[11px] font-semibold text-white/40 transition-colors hover:text-white/70">
            {showAll ? 'Show less' : `Show all ${farms.length} reward markets`}
          </button>
        )}
      </div>

      <p className="mt-2 text-[10px] text-white/25">
        * Est. APR assumes $1K of qualifying two-sided quotes earning a pro-rata share of the daily pool,
        against at least $10K of competing maker capital (thin books attract bots fast). Actual payouts
        depend on Polymarket&apos;s scoring (spread tightness, uptime, two-sidedness) and competition. Not financial advice.
      </p>
    </section>
  );
}
