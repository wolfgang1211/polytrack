'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import type { KalshiRewardFarm, KalshiRewardsScan } from '@/lib/kalshiRewards';

/* ── Kalshi Reward Farming Screener ─────────────────────────────
   Same view, ranking and metrics as the Polymarket screener (RewardFarms.tsx), fed by Kalshi's public
   liquidity incentive programs. Kalshi's program terms are Target Size + Discount Factor instead of
   Polymarket's Max Spread + Min Size, so those two columns carry Kalshi's own parameters. */

const STAB_COLOR: Record<KalshiRewardFarm['stability'], string> = { A: '#34d399', B: '#a3e635', C: '#fbbf24', D: '#fb7185' };
const COMP_COLOR: Record<KalshiRewardFarm['competition'], string> = { Low: '#34d399', Medium: '#fbbf24', High: '#fb7185' };
const COLS = 'sm:grid-cols-[1fr_90px_90px_90px_100px_90px_90px]';

export function KalshiFarmsTable({ data, loading }: { data: KalshiRewardsScan | null; loading: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const farms = data?.farms ?? [];
  const shown = showAll ? farms : farms.slice(0, 10);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-xs text-ink/55 max-w-2xl">
          Kalshi pays makers a <span className="text-ink/70 font-semibold">real USD reward pool</span> per market for
          resting two-sided orders near the best price. These are the actual program numbers — pools are set per period
          and shown here per day.
        </p>
        {data && (
          <span className="ml-auto rounded-full px-3 py-1 text-[11px] font-bold"
            style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}>
            {formatCurrency(data.totalDailyRewards, true)}/day across {data.marketsWithRewards.toLocaleString()} markets
          </span>
        )}
      </div>

      <div className="glass rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(var(--ink-rgb),0.07)' }}>
        <div className={`hidden sm:grid ${COLS} gap-2 px-4 py-3 glass-strong`} style={{ borderBottom: '1px solid rgba(var(--ink-rgb),0.06)' }}>
          {['Market', 'Daily Pool', 'Discount', 'Target Size', 'Liquidity', 'Crowding', 'Est. APR*'].map((h, i) => (
            <span key={h} className={`text-[10px] font-semibold uppercase tracking-widest text-ink/55 ${i > 0 ? 'text-right' : ''}`}>{h}</span>
          ))}
        </div>

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`grid grid-cols-2 ${COLS} gap-2 px-4 py-3.5`} style={{ borderBottom: '1px solid rgba(var(--ink-rgb),0.04)' }}>
              {Array.from({ length: 7 }).map((_, j) => <div key={j} className="h-4 rounded animate-shimmer" />)}
            </div>
          ))
        ) : farms.length === 0 ? (
          <div className="px-4 py-12 text-center text-xs text-ink/55">
            {data ? 'No active Kalshi reward pools found right now — check back soon.' : 'Kalshi reward pools could not be loaded right now.'}
          </div>
        ) : shown.map(f => (
          <Link key={f.ticker} href={`/markets/kalshi/${encodeURIComponent(f.ticker)}`} data-kalshi-farm=""
            className={`grid grid-cols-2 ${COLS} gap-2 px-4 py-3.5 transition-colors hover:bg-ink/[0.03]`}
            style={{ borderBottom: '1px solid rgba(var(--ink-rgb),0.04)' }}>
            <div className="col-span-2 sm:col-span-1 flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs" style={{ background: 'var(--accent-grad-25)' }}>💰</div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink/75 truncate">
                  {f.isNew && (
                    <span className="mr-1.5 rounded px-1 py-px text-[10px] font-black uppercase align-middle"
                      style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>New</span>
                  )}
                  {f.endsSoon && (
                    <span className="mr-1.5 rounded px-1 py-px text-[10px] font-black uppercase align-middle"
                      style={{ background: 'rgba(251,113,133,0.15)', color: '#fb7185', border: '1px solid rgba(251,113,133,0.3)' }}>Ends soon</span>
                  )}
                  {f.question}
                </p>
                <p className="text-[10px] text-ink/55">
                  {f.daysToResolve != null ? `resolves in ${f.daysToResolve}d` : 'open-ended'}
                  {' · '}spread {(f.spread * 100).toFixed(1)}¢
                  {' · '}24h move {f.priceVol.toFixed(1)}%
                  {' · '}{formatCurrency(f.periodReward, true)} per {f.periodDays >= 1.5 ? `${Math.round(f.periodDays)}d` : 'day'}
                </p>
              </div>
            </div>
            <span className="self-center text-right text-xs font-black text-emerald-400 tabular-nums">{formatCurrency(f.dailyRate, true)}/d</span>
            <span className="self-center text-right text-xs text-ink/55 tabular-nums">{f.discountFactor != null ? f.discountFactor.toFixed(2) : '—'}</span>
            <span className="self-center text-right text-xs text-ink/55 tabular-nums">{f.targetSize != null ? f.targetSize.toLocaleString() : '—'}</span>
            <span className="self-center text-right text-xs text-ink/55 tabular-nums">{formatCurrency(f.liquidity, true)}</span>
            <span className="self-center text-right">
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: `${COMP_COLOR[f.competition]}14`, border: `1px solid ${COMP_COLOR[f.competition]}33`, color: COMP_COLOR[f.competition] }}>
                {f.competition}
              </span>
            </span>
            <span className="self-center text-right">
              <span className="text-xs font-black tabular-nums"
                style={{ color: f.estApr >= 20 ? '#34d399' : f.estApr >= 5 ? '#fbbf24' : 'rgba(var(--ink-rgb),0.5)' }}>
                {f.estApr >= 1000 ? '>999' : f.estApr.toFixed(1)}%
              </span>
              <span className="ml-1 rounded px-1 py-px text-[10px] font-black align-middle"
                title={`Stability ${f.stability} — 24h price move ${f.priceVol.toFixed(1)}%`}
                style={{ background: `${STAB_COLOR[f.stability]}18`, color: STAB_COLOR[f.stability], border: `1px solid ${STAB_COLOR[f.stability]}35` }}>
                {f.stability}
              </span>
            </span>
          </Link>
        ))}

        {!loading && farms.length > 10 && (
          <button onClick={() => setShowAll(s => !s)} className="w-full py-3 text-[11px] font-semibold text-ink/55 transition-colors hover:text-ink/70">
            {showAll ? 'Show less' : `Show all ${farms.length} reward markets`}
          </button>
        )}
      </div>

      <p className="mt-2 text-[10px] text-ink/55">
        * Ranked by risk-adjusted APR (APR × stability grade), the same rule as the Polymarket list. Est. APR assumes $1K
        split across both sides at the best bids (Yes and No), earning a pro-rata share of each side&apos;s pool against
        the larger of the Target Size and the size already at the best price. Liquidity is the dollar size resting at the
        best Yes and No bids. Kalshi scores resting orders every second and discounts orders away from the reference
        price by the Discount Factor per tick, so actual payouts depend on uptime, price placement and competition.
        Not financial advice.
      </p>
    </>
  );
}

export function useKalshiRewards() {
  const [data, setData] = useState<KalshiRewardsScan | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/liquidity/kalshi/rewards')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.farms)) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return { data, loading };
}
