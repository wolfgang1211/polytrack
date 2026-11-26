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
            {formatCurrency(data.totalDailyRewards, true)}/day across {data.marketsWithRewards.toLocaleString('en-US')} markets
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
                  {f.thin && (
                    <span className="mr-1.5 rounded px-1 py-px text-[10px] font-black uppercase align-middle" data-thin=""
                      title="Estimated APR of 1,000% or more: little or no competing size right now. Pools this rich on thin books attract makers fast."
                      style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>Thin market</span>
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
            <span className="self-center text-right text-xs text-ink/55 tabular-nums">{f.targetSize != null ? f.targetSize.toLocaleString('en-US') : '—'}</span>
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
        * Ranked by risk-adjusted APR (APR × stability grade), the same rule as the Polymarket list. Markets with an
        estimated APR of 1,000% or more are labelled <span className="font-semibold">Thin market</span> (little or no competing size) and listed
        after the ranked rows, never above them. Est. APR assumes $1K
        split across both sides at the best bids (Yes and No), scored up to the Target Size per side, earning a pro-rata share of each side&apos;s pool against
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

const per = (days: number) => (days >= 1.5 ? `${Math.round(days)}d` : 'day');

/* Kalshi publishes no maker leaderboard (trader data is private), so the closest useful ranking is where the
   pools are: the series and single markets paying the most per day across every active program. */
export function KalshiPoolRankings({ data }: { data: KalshiRewardsScan | null }) {
  if (!data || (!data.topSeries?.length && !data.topMarkets?.length)) return null;
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2" data-kalshi-rankings="">
      <div className="glass rounded-2xl p-4" style={{ border: '1px solid rgba(var(--ink-rgb),0.07)' }}>
        <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-ink/70">Top series by daily pools</h3>
        <ol className="flex flex-col gap-2">
          {data.topSeries.map((s, i) => (
            <li key={s.seriesTicker} className="flex items-baseline gap-2 text-xs">
              <span className="w-5 text-right font-mono text-ink/55">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-ink/80">{s.title ?? s.seriesTicker}</span>
                <span className="block truncate text-[10px] text-ink/55">
                  {s.markets.toLocaleString('en-US')} markets · e.g.{' '}
                  <Link href={`/markets/kalshi/${encodeURIComponent(s.exampleTicker)}`} className="underline decoration-dotted hover:text-ink/80">{s.exampleTitle ?? s.exampleTicker}</Link>
                </span>
              </span>
              <span className="font-black tabular-nums text-emerald-400">{formatCurrency(s.dailyRate, true)}/d</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="glass rounded-2xl p-4" style={{ border: '1px solid rgba(var(--ink-rgb),0.07)' }}>
        <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-ink/70">Largest single-market pools</h3>
        <ol className="flex flex-col gap-2">
          {data.topMarkets.map((m, i) => (
            <li key={m.ticker} className="flex items-baseline gap-2 text-xs">
              <span className="w-5 text-right font-mono text-ink/55">{i + 1}</span>
              <Link href={`/markets/kalshi/${encodeURIComponent(m.ticker)}`} className="min-w-0 flex-1 truncate font-semibold text-ink/80 hover:text-ink">{m.title ?? m.ticker}</Link>
              <span className="text-[10px] text-ink/55 tabular-nums">{formatCurrency(m.periodReward, true)}/{per(m.periodDays)}</span>
              <span className="font-black tabular-nums text-emerald-400">{formatCurrency(m.dailyRate, true)}/d</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="lg:col-span-2 text-[10px] text-ink/55">
        Kalshi does not publish who earns its liquidity rewards, so there is no maker leaderboard here. These rankings show where
        the pools are, across all {data.marketsWithRewards.toLocaleString('en-US')} active programs.
      </p>
    </div>
  );
}

/* Kalshi's published scoring rule, so readers can check the estimate against the source. */
export function KalshiScoringFormula() {
  return (
    <details className="mt-6 glass rounded-2xl p-4" style={{ border: '1px solid rgba(var(--ink-rgb),0.07)' }} data-kalshi-formula="">
      <summary className="cursor-pointer text-xs font-black uppercase tracking-widest text-ink/70">How Kalshi scores liquidity rewards</summary>
      <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-xs text-ink/70">
        <li><span className="font-semibold text-ink/80">Snapshots.</span> Kalshi samples the order book every second during trading hours. Each program period has a Target Size, a Discount Factor and a reward.</li>
        <li><span className="font-semibold text-ink/80">Qualifying orders.</span> Walking away from the best price, resting orders count until their combined size reaches the Target Size on that side. A snapshot counts only when both sides of the book have liquidity.</li>
        <li><span className="font-semibold text-ink/80">Order score.</span> Each qualifying order scores its size times the Discount Factor raised to the number of ticks it sits from the reference price. Orders at the reference price get full credit.</li>
        <li><span className="font-semibold text-ink/80">Payout.</span> Your share of a period&apos;s reward is your scores added up over the period divided by everyone&apos;s.</li>
      </ol>
      <pre className="mt-3 overflow-x-auto rounded-lg p-3 font-mono text-[11px] text-ink/80" style={{ background: 'rgba(var(--ink-rgb),0.04)' }}>
{`order score  = size × DiscountFactor ^ ticks_from_reference
your payout  = period reward × (Σ your scores ÷ Σ all scores)`}
      </pre>
      <p className="mt-3 text-[10px] text-ink/55">
        Source: Kalshi&apos;s{' '}
        <a href="https://help.kalshi.com/en/articles/13823851-liquidity-incentive-program" target="_blank" rel="noopener noreferrer" className="underline">Liquidity Incentive Program</a>
        {' '}help article and the program terms filed with the CFTC. Programs and their parameters:{' '}
        <a href="https://kalshi.com/incentives" target="_blank" rel="noopener noreferrer" className="underline">kalshi.com/incentives</a>.
        AlphaBoard&apos;s estimate simplifies this to one snapshot at the best bids.
      </p>
    </details>
  );
}
