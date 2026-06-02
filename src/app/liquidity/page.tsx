'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { formatCurrency, formatAddress } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';
import TelegramModal from '@/components/TelegramModal';
import type { LPOpportunity } from '@/app/api/liquidity/opportunities/route';
import type { MarketDepth } from '@/app/api/liquidity/depth/route';
import type { PriceHistory } from '@/app/api/liquidity/price-history/route';

/* ─────────────────────────── helpers ─────────────────────────── */

function pct(n: number, d = 2) { return `${(n * 100).toFixed(d)}%`; }

function scoreColor(s: number) {
  if (s >= 70) return '#34d399';
  if (s >= 40) return '#fbbf24';
  return '#fb7185';
}
function scoreLabel(s: number) {
  if (s >= 70) return 'High';
  if (s >= 40) return 'Medium';
  return 'Low';
}

const LP_PERIODS = ['DAY', 'WEEK', 'MONTH'] as const;
type LPPeriod = typeof LP_PERIODS[number];

/* ═══════════════════════════════════════════════════════════════
   1) LP OPPORTUNITIES
════════════════════════════════════════════════════════════════ */

function OpportunityCard({ opp, rank }: { opp: LPOpportunity; rank: number }) {
  const href = marketUrl(opp.eventSlug, opp.slug);
  const sc   = opp.score;

  return (
    <div className="glass glass-hover gradient-border rounded-2xl p-5 flex flex-col gap-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 text-[10px] font-black text-white/20 w-5 mt-0.5">#{rank}</span>
        {opp.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={opp.image} alt="" className="h-8 w-8 rounded-lg object-cover flex-shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        )}
        <p className="flex-1 text-xs font-semibold text-white/80 line-clamp-2 leading-relaxed">
          {opp.question}
        </p>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Spread</p>
          <p className="text-sm font-black text-white">{(opp.spread * 100).toFixed(1)}¢</p>
          <p className="text-[10px] text-white/25">{pct(opp.spreadPct, 1)} of mid</p>
        </div>
        <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">24h Vol</p>
          <p className="text-sm font-black text-white">{formatCurrency(opp.volume24h, true)}</p>
          <p className="text-[10px] text-white/25">Liquidity {formatCurrency(opp.liquidity, true)}</p>
        </div>
        <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Bid Depth</p>
          {opp.depthKnown && opp.bidDepth != null ? (
            <>
              <p className="text-sm font-black text-emerald-300/90">{formatCurrency(opp.bidDepth, true)}</p>
              <p className="text-[10px] text-white/25">Best {(opp.bestBid * 100).toFixed(1)}¢</p>
            </>
          ) : (
            <>
              <p className="text-sm font-black text-white/30">—</p>
              <p className="text-[10px] text-white/20">orderbook n/a</p>
            </>
          )}
        </div>
        <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Ask Depth</p>
          {opp.depthKnown && opp.askDepth != null ? (
            <>
              <p className="text-sm font-black text-rose-300/90">{formatCurrency(opp.askDepth, true)}</p>
              <p className="text-[10px] text-white/25">Best {(opp.bestAsk * 100).toFixed(1)}¢</p>
            </>
          ) : (
            <>
              <p className="text-sm font-black text-white/30">—</p>
              <p className="text-[10px] text-white/20">orderbook n/a</p>
            </>
          )}
        </div>
      </div>

      {/* Fee potential */}
      <div className="flex items-center justify-between rounded-xl px-3 py-2"
        style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)' }}>
        <span className="text-[10px] uppercase tracking-wider text-amber-300/70">Est. spread capture / day</span>
        <span className="text-sm font-black text-amber-300">{formatCurrency(opp.estDailyFee, true)}</span>
      </div>

      {/* Risk metrics */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {/* Days to resolve */}
          <div>
            <p className="text-[9px] uppercase tracking-wider text-white/30 mb-0.5">Resolves in</p>
            {opp.daysToResolve != null ? (
              <p className={`text-xs font-bold ${opp.daysToResolve < 5 ? 'text-rose-400' : 'text-white/70'}`}>
                {opp.daysToResolve === 0 ? '<1d' : `${opp.daysToResolve}d`}
                {opp.daysToResolve < 5 && <span className="ml-1 text-[10px]">⚠</span>}
              </p>
            ) : (
              <p className="text-xs font-bold text-white/30">—</p>
            )}
          </div>
          {/* Spread volatility */}
          <div>
            <p className="text-[9px] uppercase tracking-wider text-white/30 mb-0.5">Spread vol 24h</p>
            <p className={`text-xs font-bold ${opp.spreadVol > 30 ? 'text-rose-400' : opp.spreadVol > 10 ? 'text-amber-300' : 'text-white/70'}`}>
              {opp.spreadVol.toFixed(1)}%
            </p>
          </div>
        </div>
        {/* Risk badge */}
        <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
          style={
            opp.risk === 'High'
              ? { background: 'rgba(244,63,94,0.15)', color: '#fb7185', border: '1px solid rgba(251,113,133,0.3)' }
              : opp.risk === 'Medium'
              ? { background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }
              : { background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }
          }>
          {opp.risk} Risk
        </span>
      </div>

      {/* Score + CTA */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/30 uppercase tracking-wider">LP Score</span>
          <span className="group relative cursor-help rounded-full px-2.5 py-0.5 text-[11px] font-black"
            style={{ background: `${scoreColor(sc)}20`, color: scoreColor(sc), border: `1px solid ${scoreColor(sc)}40` }}>
            {sc} · {scoreLabel(sc)}
            {/* Score breakdown tooltip */}
            <span
              className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-xl p-3 text-left opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100"
              style={{ background: 'rgba(13,13,26,0.97)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Score Breakdown
              </span>
              <span className="flex items-center justify-between py-0.5 text-[11px]">
                <span className="text-white/50">Spread</span>
                <span className="font-bold text-amber-300">{opp.scoreBreakdown.spread}/35</span>
              </span>
              <span className="flex items-center justify-between py-0.5 text-[11px]">
                <span className="text-white/50">Volume</span>
                <span className="font-bold text-sky-300">{opp.scoreBreakdown.volume}/45</span>
              </span>
              <span className="flex items-center justify-between py-0.5 text-[11px]">
                <span className="text-white/50">Depth</span>
                <span className="font-bold text-emerald-300">{opp.scoreBreakdown.depth}/20</span>
              </span>
              <span className="mt-1.5 flex items-center justify-between border-t border-white/10 pt-1.5 text-[11px]">
                <span className="font-semibold text-white/60">Total</span>
                <span className="font-black text-white">
                  {opp.scoreBreakdown.spread}+{opp.scoreBreakdown.volume}+{opp.scoreBreakdown.depth} = {sc}/100
                </span>
              </span>
            </span>
          </span>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white transition-all hover:scale-[1.03] hover:brightness-110"
          style={{ background: 'var(--vi-grad-60)', border: '1px solid var(--vi-border-xl)' }}
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Liquidity
        </a>
      </div>
    </div>
  );
}

function LPOpportunitiesSection({ opps, loading }: { opps: LPOpportunity[]; loading: boolean }) {
  return (
    <section>
      <SectionHeader index="[03]" label="LP Opportunities" />
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass rounded-2xl h-52 animate-shimmer" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {opps.map((o, i) => <OpportunityCard key={o.conditionId} opp={o} rank={i + 1} />)}
        </div>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   2) LP LEADERBOARD
════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LPLeaderboardSection() {
  const [period, setPeriod] = useState<LPPeriod>('DAY');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [traders, setTraders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?window=${period === 'DAY' ? '1d' : period === 'WEEK' ? '1w' : '1m'}&limit=20`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          // Sort by volume (highest vol = most active traders/LPs)
          setTraders([...d].sort((a, b) => (b.vol ?? 0) - (a.vol ?? 0)));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  const labels: Record<LPPeriod, string> = { DAY: '24H', WEEK: '1W', MONTH: '1M' };

  return (
    <section>
      <SectionHeader index="[09]" label="LP Leaderboard" controls={
        <div className="flex gap-0.5 rounded-xl glass p-0.5">
          {LP_PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`relative rounded-lg px-3 py-1 text-[11px] font-bold transition-all
                ${period === p ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>
              {period === p && (
                <span className="absolute inset-0 rounded-lg"
                  style={{ background: 'linear-gradient(135deg,rgba(52,211,153,0.4),rgba(16,185,129,0.4))', border: '1px solid rgba(52,211,153,0.3)' }} />
              )}
              <span className="relative">{labels[p]}</span>
            </button>
          ))}
        </div>
      } />

      <div className="glass rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Table header */}
        <div className="grid grid-cols-[40px_1fr_140px_140px] px-4 py-3 glass-strong"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">#</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Trader</span>
          <span className="text-right text-[10px] font-semibold uppercase tracking-widest text-white/30">Volume</span>
          <span className="text-right text-[10px] font-semibold uppercase tracking-widest text-white/30">P&amp;L</span>
        </div>
        <div>
          {loading ? Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[40px_1fr_140px_140px] gap-2 px-4 py-3.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="h-4 rounded animate-shimmer" />
              <div className="h-4 rounded animate-shimmer" />
              <div className="h-4 rounded animate-shimmer" />
              <div className="h-4 rounded animate-shimmer" />
            </div>
          )) : traders.map((t, i) => (
            <Link key={t.proxyWallet} href={`/wallet/${t.proxyWallet}`}
              className="grid grid-cols-[40px_1fr_140px_140px] px-4 py-3.5 transition-colors hover:bg-white/[0.03] cursor-pointer"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span className="font-mono text-xs text-white/25">#{i + 1}</span>
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#9333ea)' }}>
                  {(t.userName || t.proxyWallet)?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white/75 truncate">{t.userName || formatAddress(t.proxyWallet)}</p>
                  <p className="font-mono text-[10px] text-white/20 truncate">{formatAddress(t.proxyWallet)}</p>
                </div>
              </div>
              <div className="flex items-center justify-end">
                <span className="text-xs font-bold text-white/50">{formatCurrency(t.vol ?? 0, true)}</span>
              </div>
              <div className="flex items-center justify-end">
                <span className={`text-xs font-black ${(t.pnl ?? 0) >= 0 ? 'text-grad-profit' : 'text-grad-loss'}`}>
                  {(t.pnl ?? 0) >= 0 ? '+' : ''}{formatCurrency(t.pnl ?? 0, true)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   3) MARKET DEPTH ANALYSIS
════════════════════════════════════════════════════════════════ */

function DepthBar({ levels, best, side, maxTotal }: {
  levels: { price: number; size: number; total: number }[];
  best: number; side: 'bid' | 'ask'; maxTotal: number;
}) {
  const color = side === 'bid' ? '#34d399' : '#fb7185';
  const bg    = side === 'bid' ? 'rgba(52,211,153,0.08)' : 'rgba(251,113,133,0.08)';

  return (
    <div className="flex flex-col gap-0.5">
      {levels.slice(0, 10).map((l, i) => {
        const barW = maxTotal > 0 ? (l.total / maxTotal) * 100 : 0;
        const dist = Math.abs(l.price - best) * 100;
        return (
          <div key={i} className="flex items-center gap-2 text-[10px]">
            <span className="w-10 text-right tabular-nums text-white/35">{(l.price * 100).toFixed(1)}¢</span>
            <div className="flex-1 relative h-5 rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="absolute inset-y-0 h-full rounded-sm transition-all duration-500"
                style={{ width: `${barW}%`, background: bg, borderRight: `2px solid ${color}40`,
                  [side === 'bid' ? 'right' : 'left']: 0 }} />
              <span className="absolute inset-0 flex items-center px-2 text-white/40 tabular-nums" style={{ fontSize: 9 }}>
                {l.size.toFixed(0)} ({dist.toFixed(1)}¢ away)
              </span>
            </div>
            <span className="w-14 tabular-nums text-white/25">${l.total.toFixed(0)}</span>
          </div>
        );
      })}
    </div>
  );
}

function MarketDepthSection({ opps }: { opps: LPOpportunity[] }) {
  const [selected, setSelected] = useState<LPOpportunity | null>(null);
  const [depth, setDepth]       = useState<MarketDepth | null>(null);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (opps.length > 0 && !selected) setSelected(opps[0]);
  }, [opps, selected]);

  useEffect(() => {
    if (!selected?.tokenId) return;
    setLoading(true);
    setDepth(null);
    fetch(`/api/liquidity/depth?tokenId=${selected.tokenId}`)
      .then(r => r.json())
      .then(d => setDepth(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selected]);

  const maxTotal = Math.max(
    depth?.bids[depth.bids.length - 1]?.total ?? 0,
    depth?.asks[depth.asks.length - 1]?.total ?? 0,
  );

  // Cumulative depth curve: bid side (green) on the left, ask side (red) on the
  // right, sorted by price ascending so the two halves meet at the mid price.
  const depthCurve = useMemo(() => {
    if (!depth) return [];
    const bids = [...depth.bids]
      .sort((a, b) => a.price - b.price)
      .map(l => ({ price: +(l.price * 100).toFixed(1), bid: +l.total.toFixed(2), ask: null as number | null }));
    const asks = [...depth.asks]
      .sort((a, b) => a.price - b.price)
      .map(l => ({ price: +(l.price * 100).toFixed(1), bid: null as number | null, ask: +l.total.toFixed(2) }));
    return [...bids, ...asks];
  }, [depth]);

  return (
    <section>
      <SectionHeader index="[06]" label="Market Depth" controls={
        opps.length > 0 ? (
          <select
            value={selected?.conditionId ?? ''}
            onChange={e => setSelected(opps.find(o => o.conditionId === e.target.value) ?? null)}
            className="rounded-xl glass px-3 py-1.5 text-xs text-white/70 outline-none max-w-xs truncate"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {opps.map(o => (
              <option key={o.conditionId} value={o.conditionId} className="bg-[#0d0d1a]">
                {o.question.slice(0, 50)}…
              </option>
            ))}
          </select>
        ) : null
      } />

      <div className="glass rounded-2xl p-5" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {loading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-5 rounded animate-shimmer" />)}
          </div>
        )}

        {!loading && depth && (
          <div className="flex flex-col gap-6">
            {/* Cumulative depth curve */}
            {depthCurve.length > 1 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-2">
                  Cumulative Depth Curve
                </p>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={depthCurve} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bidFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="askFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb7185" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#fb7185" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="price" type="number" domain={['dataMin', 'dataMax']}
                      tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${v}¢`}
                    />
                    <YAxis
                      tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }}
                      axisLine={false} tickLine={false} width={52}
                      tickFormatter={(v) => formatCurrency(v as number, true)}
                    />
                    <Tooltip
                      contentStyle={{ background: 'rgba(13,13,26,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                      labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
                      labelFormatter={(v) => `${v}¢`}
                      formatter={(v, n) => [formatCurrency(Number(v), true), n === 'bid' ? 'Bid depth' : 'Ask depth'] as [string, string]}
                    />
                    <ReferenceLine
                      x={+(depth.midPrice * 100).toFixed(1)} stroke="#a78bfa" strokeDasharray="4 4"
                      label={{ value: `Mid ${(depth.midPrice * 100).toFixed(1)}¢`, position: 'top', fill: '#a78bfa', fontSize: 10 }}
                    />
                    <Area type="stepAfter" dataKey="bid" stroke="#34d399" strokeWidth={2} fill="url(#bidFill)" connectNulls={false} isAnimationActive={false} dot={false} />
                    <Area type="stepBefore" dataKey="ask" stroke="#fb7185" strokeWidth={2} fill="url(#askFill)" connectNulls={false} isAnimationActive={false} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Best Bid', value: `${(depth.bestBid * 100).toFixed(1)}¢`, color: '#34d399' },
                { label: 'Best Ask', value: `${(depth.bestAsk * 100).toFixed(1)}¢`, color: '#fb7185' },
                { label: 'Spread',   value: `${(depth.spread * 100).toFixed(2)}¢ (${pct(depth.spreadPct)})`, color: '#fbbf24' },
                { label: 'Mid Price',value: `${(depth.midPrice * 100).toFixed(1)}¢`, color: '#a78bfa' },
              ].map(m => (
                <div key={m.label} className="rounded-xl px-4 py-3"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{m.label}</p>
                  <p className="text-sm font-black" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Liquidity score + imbalance */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/40">Liquidity Quality</span>
                <span className="rounded-full px-3 py-0.5 text-sm font-black"
                  style={{ background: `${scoreColor(depth.qualityScore)}20`, color: scoreColor(depth.qualityScore), border: `1px solid ${scoreColor(depth.qualityScore)}40` }}>
                  {depth.qualityScore}/100, {scoreLabel(depth.qualityScore)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/40">Order Imbalance</span>
                <span className={`text-xs font-bold ${depth.imbalance > 0.1 ? 'text-emerald-400' : depth.imbalance < -0.1 ? 'text-rose-400' : 'text-white/50'}`}>
                  {depth.imbalance > 0 ? 'Bid Heavy' : depth.imbalance < 0 ? 'Ask Heavy' : 'Balanced'} ({pct(Math.abs(depth.imbalance))})
                </span>
              </div>
            </div>

            {/* Depth visualization */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400/70 mb-2">
                  Bids · Total {formatCurrency(depth.bidDepthTotal, true)}
                </p>
                <DepthBar levels={depth.bids} best={depth.bestBid} side="bid" maxTotal={maxTotal} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-400/70 mb-2">
                  Asks · Total {formatCurrency(depth.askDepthTotal, true)}
                </p>
                <DepthBar levels={depth.asks} best={depth.bestAsk} side="ask" maxTotal={maxTotal} />
              </div>
            </div>
          </div>
        )}

        {!loading && !depth && (
          <p className="text-center text-sm text-white/25 py-8">Select a market to view orderbook</p>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   4) REWARD SIMULATOR
════════════════════════════════════════════════════════════════ */

// Maker rebate: ~0.1% of notional volume traded against your orders
// Your share = amount / (total_liquidity + amount)
// daily_reward ≈ your_share × daily_volume × 0.001
const MAKER_REBATE_RATE = 0.001;

function RewardSimulator({ opps }: { opps: LPOpportunity[] }) {
  const [selected, setSelected] = useState<LPOpportunity | null>(null);
  const [amount, setAmount]     = useState('1000');

  useEffect(() => {
    if (opps.length > 0 && !selected) setSelected(opps[0]);
  }, [opps, selected]);

  const amt = parseFloat(amount) || 0;
  const totalLiquidity = (selected?.liquidity ?? 0) || 10_000;
  const yourShare      = amt / (totalLiquidity + amt);
  const dailyVol       = selected?.volume24h ?? 0;
  const dailyReward    = yourShare * dailyVol * MAKER_REBATE_RATE;
  const monthlyReward  = dailyReward * 30;
  const yearlyReward   = dailyReward * 365;
  const apr            = amt > 0 ? (yearlyReward / amt) * 100 : 0;

  return (
    <section>
      <SectionHeader index="[07]" label="Reward Simulator" />

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Inputs */}
        <div className="glass rounded-2xl p-6 flex flex-col gap-5" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <label className="block text-xs font-semibold text-white/50 mb-2">Select Market</label>
            <select
              value={selected?.conditionId ?? ''}
              onChange={e => setSelected(opps.find(o => o.conditionId === e.target.value) ?? null)}
              className="w-full rounded-xl glass px-4 py-2.5 text-xs text-white/75 outline-none"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {opps.map(o => (
                <option key={o.conditionId} value={o.conditionId} className="bg-[#0d0d1a]">
                  {o.question.slice(0, 60)}
                </option>
              ))}
            </select>
            {selected && (
              <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-white/30">
                <span>Spread: <span className="text-white/60">{(selected.spread * 100).toFixed(1)}¢</span></span>
                <span>24h Vol: <span className="text-white/60">{formatCurrency(selected.volume24h, true)}</span></span>
                <span>Total Liquidity: <span className="text-white/60">{formatCurrency(selected.liquidity, true)}</span></span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/50 mb-2">Your Liquidity Amount (USDC)</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/30 font-bold">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  min="0"
                  className="w-full rounded-xl glass pl-7 pr-4 py-2.5 text-sm font-bold text-white outline-none"
                  style={{ border: '1px solid var(--vi-border-md)' }}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              {[500, 1000, 5000, 10000].map(v => (
                <button key={v} onClick={() => setAmount(String(v))}
                  className="rounded-lg px-2.5 py-1 text-[10px] font-semibold text-white/40 transition-all hover:text-white/70"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  ${v >= 1000 ? `${v / 1000}K` : v}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl px-4 py-3 text-[10px] text-white/25 leading-relaxed"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <strong className="text-white/40">Formula:</strong> your_share × daily_volume × {(MAKER_REBATE_RATE * 100).toFixed(1)}% maker rebate rate.
            Estimates only; actual rewards depend on spread, fill rate, and Polymarket&apos;s reward program.
          </div>
        </div>

        {/* Results */}
        <div className="flex flex-col gap-3">
          {[
            { label: 'Daily Reward',    value: formatCurrency(dailyReward),   sub: 'estimated maker rebate',   color: '#34d399', gradient: 'rgba(52,211,153,0.15)' },
            { label: 'Monthly Reward',  value: formatCurrency(monthlyReward), sub: '30 days × daily estimate',  color: '#60a5fa', gradient: 'rgba(96,165,250,0.15)'  },
            { label: 'Annual Reward',   value: formatCurrency(yearlyReward),  sub: '365 days × daily estimate', color: '#a78bfa', gradient: 'rgba(167,139,250,0.15)' },
            { label: 'Estimated APR',   value: `${apr.toFixed(2)}%`,          sub: 'annualised return on capital', color: '#fbbf24', gradient: 'rgba(251,191,36,0.15)'  },
          ].map(r => (
            <div key={r.label} className="flex items-center gap-4 rounded-2xl px-5 py-4"
              style={{ background: r.gradient, border: `1px solid ${r.color}33` }}>
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-widest text-white/35">{r.label}</p>
                <p className="text-2xl font-black mt-0.5" style={{ color: r.color }}>{r.value}</p>
                <p className="text-[10px] text-white/25 mt-0.5">{r.sub}</p>
              </div>
            </div>
          ))}

          {/* Your share */}
          <div className="rounded-2xl px-5 py-3 glass flex items-center justify-between">
            <span className="text-xs text-white/40">Your pool share</span>
            <span className="text-sm font-black text-white">{pct(yourShare, 3)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   5) PRICE / SPREAD HISTORY
════════════════════════════════════════════════════════════════ */

const PH_WINDOWS = [
  { key: '1d', label: '1D' },
  { key: '1w', label: '1W' },
  { key: '1m', label: '1M' },
  { key: 'max', label: 'MAX' },
] as const;
type PHWindow = typeof PH_WINDOWS[number]['key'];

function PriceHistorySection({ opps }: { opps: LPOpportunity[] }) {
  const [selected, setSelected] = useState<LPOpportunity | null>(null);
  const [win, setWin]           = useState<PHWindow>('1w');
  const [hist, setHist]         = useState<PriceHistory | null>(null);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState(false);

  useEffect(() => {
    if (opps.length > 0 && !selected) setSelected(opps[0]);
  }, [opps, selected]);

  useEffect(() => {
    if (!selected?.tokenId) return;
    setLoading(true); setErr(false); setHist(null);
    fetch(`/api/liquidity/price-history?tokenId=${selected.tokenId}&interval=${win}`)
      .then(r => r.json())
      .then(d => { if (d?.points) setHist(d); else setErr(true); })
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  }, [selected, win]);

  const data = useMemo(
    () => (hist?.points ?? []).map(p => ({ t: p.t, price: +(p.p * 100).toFixed(2) })),
    [hist],
  );

  const up = (hist?.changePct ?? 0) >= 0;
  const lineColor = up ? '#34d399' : '#fb7185';

  return (
    <section>
      <SectionHeader index="[04]" label="Price History" controls={
        <div className="flex gap-0.5 rounded-xl glass p-0.5">
          {PH_WINDOWS.map(w => (
            <button key={w.key} onClick={() => setWin(w.key)}
              className={`relative rounded-lg px-3 py-1 text-[11px] font-bold transition-all
                ${win === w.key ? 'text-white' : 'text-white/30 hover:text-white/60'}`}>
              {win === w.key && (
                <span className="absolute inset-0 rounded-lg"
                  style={{ background: 'linear-gradient(135deg,rgba(96,165,250,0.4),rgba(147,51,234,0.4))', border: '1px solid rgba(96,165,250,0.3)' }} />
              )}
              <span className="relative">{w.label}</span>
            </button>
          ))}
        </div>
      } />

      <div className="glass rounded-2xl p-4" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Market selector */}
        {opps.length > 0 && (
          <select
            value={selected?.conditionId ?? ''}
            onChange={e => setSelected(opps.find(o => o.conditionId === e.target.value) ?? null)}
            className="mb-3 w-full max-w-sm rounded-xl glass px-3 py-2 text-xs text-white/75 outline-none truncate"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {opps.map(o => (
              <option key={o.conditionId} value={o.conditionId} className="bg-[#0d0d1a]">
                {o.question.slice(0, 60)}
              </option>
            ))}
          </select>
        )}

        {/* Stat row */}
        {selected && (
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Current Mid', value: `${(selected.mid * 100).toFixed(1)}¢`, color: '#a78bfa' },
              { label: 'Current Spread', value: `${(selected.spread * 100).toFixed(1)}¢`, color: '#fbbf24' },
              { label: 'Period Change', value: hist?.changePct != null ? `${up ? '+' : ''}${(hist.changePct * 100).toFixed(1)}%` : '—', color: lineColor },
              { label: 'Range', value: hist?.min != null && hist?.max != null ? `${(hist.min * 100).toFixed(0)}–${(hist.max * 100).toFixed(0)}¢` : '—', color: '#60a5fa' },
            ].map(s => (
              <div key={s.label} className="rounded-lg px-2.5 py-1.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[9px] text-white/30 uppercase tracking-wider mb-0.5">{s.label}</p>
                <p className="text-xs font-black" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Chart */}
        <div className="h-52 w-full">
          {loading ? (
            <div className="h-full w-full rounded-xl animate-shimmer" />
          ) : err || data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-white/25">
              No price history available for this market
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="phFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                  axisLine={false} tickLine={false} minTickGap={40}
                />
                <YAxis
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={v => `${v}¢`}
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                  axisLine={false} tickLine={false} width={42}
                />
                <Tooltip
                  contentStyle={{ background: 'rgba(13,13,26,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                  labelFormatter={t => new Date(t as number).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  formatter={(v) => [`${v}¢`, 'Price'] as [string, string]}
                />
                <Area type="monotone" dataKey="price" stroke={lineColor} strokeWidth={2} fill="url(#phFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   6) LP CALCULATOR — compare markets for the same capital
════════════════════════════════════════════════════════════════ */

function LPCalculator({ opps }: { opps: LPOpportunity[] }) {
  const [amount, setAmount] = useState('1000');
  const [picked, setPicked] = useState<string[]>([]);

  // Default-select the top 3 opportunities once they load.
  useEffect(() => {
    if (opps.length > 0 && picked.length === 0) {
      setPicked(opps.slice(0, 3).map(o => o.conditionId));
    }
  }, [opps, picked.length]);

  const amt = parseFloat(amount) || 0;

  const rows = useMemo(() => {
    return opps
      .filter(o => picked.includes(o.conditionId))
      .map(o => {
        const totalLiquidity = (o.liquidity || 0) || 10_000;
        const yourShare      = amt / (totalLiquidity + amt);
        const dailyReward    = yourShare * (o.volume24h ?? 0) * MAKER_REBATE_RATE;
        const monthly        = dailyReward * 30;
        const apr            = amt > 0 ? (dailyReward * 365 / amt) * 100 : 0;
        return { o, yourShare, dailyReward, monthly, apr };
      })
      .sort((a, b) => b.dailyReward - a.dailyReward);
  }, [opps, picked, amt]);

  const best = rows[0];

  function toggle(id: string) {
    setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  return (
    <section>
      <SectionHeader index="[05]" label="LP Calculator" />

      <div className="glass rounded-2xl p-5 flex flex-col gap-5" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Capital input */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-white/50 mb-2">Capital to deploy (USDC)</label>
            <div className="relative w-44">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/30 font-bold">$</span>
              <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full rounded-xl glass pl-7 pr-4 py-2.5 text-sm font-bold text-white outline-none"
                style={{ border: '1px solid rgba(167,139,250,0.3)' }} />
            </div>
          </div>
          <div className="flex gap-2">
            {[500, 1000, 5000, 10000].map(v => (
              <button key={v} onClick={() => setAmount(String(v))}
                className="rounded-lg px-2.5 py-1 text-[10px] font-semibold text-white/40 transition-all hover:text-white/70"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                ${v >= 1000 ? `${v / 1000}K` : v}
              </button>
            ))}
          </div>
        </div>

        {/* Market multi-select chips */}
        <div>
          <p className="text-xs font-semibold text-white/50 mb-2">Markets to compare ({picked.length} selected)</p>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
            {opps.map(o => {
              const on = picked.includes(o.conditionId);
              return (
                <button key={o.conditionId} onClick={() => toggle(o.conditionId)}
                  className="rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-all max-w-[220px] truncate text-left"
                  style={{
                    background: on ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${on ? 'rgba(167,139,250,0.45)' : 'rgba(255,255,255,0.07)'}`,
                    color: on ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                  }}>
                  {on ? '✓ ' : ''}{o.question.slice(0, 38)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Comparison table */}
        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="grid grid-cols-[1fr_90px_90px_100px_80px] px-4 py-2.5 glass-strong"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Market', 'Pool Share', 'Daily', 'Monthly', 'APR'].map((h, i) => (
                <span key={h} className={`text-[10px] font-semibold uppercase tracking-widest text-white/30 ${i === 0 ? '' : 'text-right'}`}>{h}</span>
              ))}
            </div>
            {rows.map(({ o, yourShare, dailyReward, monthly, apr }, i) => {
              const isBest = best && o.conditionId === best.o.conditionId;
              return (
                <div key={o.conditionId} className="grid grid-cols-[1fr_90px_90px_100px_80px] px-4 py-3 items-center"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isBest ? 'rgba(52,211,153,0.05)' : 'transparent' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    {isBest && <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: 'rgba(52,211,153,0.2)', color: '#34d399' }}>BEST</span>}
                    <span className="text-xs font-semibold text-white/70 truncate">{o.question.slice(0, 48)}</span>
                  </div>
                  <span className="text-right text-xs font-bold text-white/50 tabular-nums">{pct(yourShare, 2)}</span>
                  <span className="text-right text-xs font-black tabular-nums" style={{ color: isBest ? '#34d399' : 'rgba(255,255,255,0.8)' }}>{formatCurrency(dailyReward)}</span>
                  <span className="text-right text-xs font-bold text-white/60 tabular-nums">{formatCurrency(monthly)}</span>
                  <span className="text-right text-xs font-bold text-amber-300/80 tabular-nums">{apr.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-sm text-white/25 py-6">Select markets above to compare</p>
        )}

        {best && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-2"
            style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)' }}>
            <span className="text-xs text-white/50">Best for ${amt.toLocaleString()}:</span>
            <span className="text-xs font-black text-emerald-300 truncate">{best.o.question.slice(0, 50)}</span>
            <span className="text-xs text-white/40 ml-auto flex-shrink-0">≈ {formatCurrency(best.dailyReward)}/day</span>
          </div>
        )}

        <p className="text-[10px] text-white/25 leading-relaxed">
          Estimates use your_share × 24h_volume × {(MAKER_REBATE_RATE * 100).toFixed(1)}% maker rebate. Actual rewards depend on spread, fill rate and Polymarket&apos;s reward program.
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   7) MARKET ALERT
════════════════════════════════════════════════════════════════ */

function MarketAlertSection({ opps }: { opps: LPOpportunity[] }) {
  const [selected, setSelected] = useState<LPOpportunity | null>(null);
  const [threshold, setThreshold] = useState('3');
  const [showTelegram, setShowTelegram] = useState(false);

  useEffect(() => {
    if (opps.length > 0 && !selected) setSelected(opps[0]);
  }, [opps, selected]);

  const thr = parseFloat(threshold) || 0;
  const currentSpread = selected ? selected.spread * 100 : 0;
  const wouldFire = selected ? currentSpread >= thr : false;

  return (
    <section>
      {showTelegram && <TelegramModal onClose={() => setShowTelegram(false)} />}
      <SectionHeader index="[08]" label="Market Alert" />

      <div className="glass rounded-2xl p-5 flex flex-col gap-5" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-white/50 mb-2">Market</label>
            <select
              value={selected?.conditionId ?? ''}
              onChange={e => setSelected(opps.find(o => o.conditionId === e.target.value) ?? null)}
              className="w-full rounded-xl glass px-4 py-2.5 text-xs text-white/75 outline-none truncate"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {opps.map(o => (
                <option key={o.conditionId} value={o.conditionId} className="bg-[#0d0d1a]">
                  {o.question.slice(0, 60)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/50 mb-2">Alert when spread ≥ (¢)</label>
            <div className="flex gap-2">
              <input type="number" min="0" step="0.5" value={threshold} onChange={e => setThreshold(e.target.value)}
                className="w-24 rounded-xl glass px-4 py-2.5 text-sm font-bold text-white outline-none"
                style={{ border: '1px solid rgba(34,197,94,0.3)' }} />
              {[1, 2, 3, 5].map(v => (
                <button key={v} onClick={() => setThreshold(String(v))}
                  className="rounded-lg px-2.5 py-1 text-[10px] font-semibold text-white/40 transition-all hover:text-white/70"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  {v}¢
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live status against threshold */}
        {selected && (
          <div className="rounded-xl px-4 py-3 flex items-center justify-between"
            style={{
              background: wouldFire ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${wouldFire ? 'rgba(52,211,153,0.25)' : 'rgba(255,255,255,0.06)'}`,
            }}>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Current spread</p>
              <p className="text-lg font-black" style={{ color: wouldFire ? '#34d399' : '#fbbf24' }}>{currentSpread.toFixed(1)}¢</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Status</p>
              <p className="text-xs font-bold" style={{ color: wouldFire ? '#34d399' : 'rgba(255,255,255,0.45)' }}>
                {wouldFire ? `✓ Above ${thr}¢, would alert now` : `Below ${thr}¢ threshold`}
              </p>
            </div>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => setShowTelegram(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white transition-all hover:scale-[1.01] hover:brightness-110"
          style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 24px rgba(34,197,94,0.3)' }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.478 13.9l-2.95-.924c-.643-.204-.657-.643.136-.953l11.57-4.46c.537-.194 1.006.131.66.658z"/>
          </svg>
          Set up alert on Telegram
        </button>
        <p className="text-[10px] text-white/25 text-center leading-relaxed">
          Connect via our Telegram bot to receive spread alerts. Per-market threshold pushes are rolling out; for now you&apos;ll get whale &amp; liquidity alerts on join.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────── shared UI ─────────────────────────── */

function SectionHeader({ index, label, controls }: { index: string; label: string; controls?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-mono text-[10px] font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.20)' }}>{index}</span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--vi-border), transparent)' }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.25)' }}>{label}</span>
      {controls && <div className="flex-shrink-0 ml-2">{controls}</div>}
    </div>
  );
}

function DataCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex-1 flex flex-col justify-center px-5 py-4 min-w-[140px]">
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] mb-1.5" style={{ color: 'rgba(255,255,255,0.28)' }}>{label}</p>
      <p className="font-mono text-xl font-black tabular-nums leading-none" style={{ color: accent ?? 'rgba(255,255,255,0.88)' }}>{value}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════════════ */

export default function LiquidityPage() {
  const [opps, setOpps]     = useState<LPOpportunity[]>([]);
  const [oppsLoading, setOppsLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const loadOpps = useCallback(() => {
    setOppsLoading(true);
    fetch('/api/liquidity/opportunities')
      .then(r => r.json())
      .then(d => {
        // Supports both the new { opportunities, updatedAt } shape and a bare array.
        const list: LPOpportunity[] = Array.isArray(d) ? d : (d?.opportunities ?? []);
        setOpps(list);
        setUpdatedAt(d?.updatedAt ?? Date.now());
      })
      .catch(() => {})
      .finally(() => setOppsLoading(false));
  }, []);

  useEffect(() => { loadOpps(); }, [loadOpps]);

  // Auto-refresh every 60s + tick a clock for the "updated Xs ago" label.
  useEffect(() => {
    const refresh = setInterval(loadOpps, 60_000);
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => { clearInterval(refresh); clearInterval(tick); };
  }, [loadOpps]);

  const agoSec = updatedAt ? Math.max(0, Math.floor((now - updatedAt) / 1000)) : null;

  return (
    <div className="flex flex-col gap-8">

      {/* ── [01] Header ── */}
      <div className="animate-fade-in-up">
        <SectionHeader index="[01]" label="Liquidity Hub" />
        <h1 className="text-4xl font-black leading-none tracking-tight sm:text-5xl mb-3">
          <span className="text-white">Liquidity</span>{' '}
          <span className="text-grad">Hub</span>
        </h1>
        <p className="text-sm text-white/40 max-w-xl">
          Discover LP opportunities, analyze market depth, and simulate maker rewards on Polymarket.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            Live
          </span>
          <span className="text-[11px] text-white/30">
            {agoSec == null ? 'Loading…' : agoSec < 5 ? 'Updated just now' : `Updated ${agoSec}s ago`}
          </span>
          <button onClick={loadOpps}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white/50 transition-colors hover:text-white"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <svg className={`h-3 w-3 ${oppsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* ── [02] Quick Stats strip ── */}
      <div>
        <SectionHeader index="[02]" label="Market Overview" />
        <div className="flex overflow-x-auto animate-fade-in-up"
          style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <DataCell label="Markets Analyzed" value={oppsLoading ? '—' : String(opps.length)} accent="rgba(167,139,250,0.95)" />
          <div className="w-px self-stretch flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <DataCell
            label="Avg Spread"
            value={oppsLoading || !opps.length ? '—' : `${(opps.reduce((s, o) => s + o.spread, 0) / opps.length * 100).toFixed(1)}¢`}
            accent="rgba(251,191,36,0.95)"
          />
          <div className="w-px self-stretch flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <DataCell
            label="Total 24h Vol"
            value={oppsLoading ? '—' : formatCurrency(opps.reduce((s, o) => s + o.volume24h, 0), true)}
            accent="rgba(139,92,246,0.95)"
          />
        </div>
      </div>

      <LPOpportunitiesSection opps={opps} loading={oppsLoading} />
      <PriceHistorySection opps={opps} />
      <LPCalculator opps={opps} />
      <MarketDepthSection opps={opps} />
      <RewardSimulator opps={opps} />
      <MarketAlertSection opps={opps} />
      <LPLeaderboardSection />
    </div>
  );
}
