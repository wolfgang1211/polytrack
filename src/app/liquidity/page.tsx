'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { formatCurrency, formatAddress } from '@/lib/utils';
import { marketUrl, withBuilderCode } from '@/lib/builder';
import type { LPOpportunity } from '@/app/api/liquidity/opportunities/route';
import type { MarketDepth } from '@/app/api/liquidity/depth/route';

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

/* ═══════════════════════════════════════════════════════════════
   1) LP OPPORTUNITIES
════════════════════════════════════════════════════════════════ */

function OpportunityCard({ opp, rank }: { opp: LPOpportunity; rank: number }) {
  const href = withBuilderCode(`https://polymarket.com/event/${opp.eventSlug ?? opp.slug}`);
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
          <p className="text-[10px] text-white/25">{pct(opp.spreadPct)}</p>
        </div>
        <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">24h Vol</p>
          <p className="text-sm font-black text-white">{formatCurrency(opp.volume24h, true)}</p>
          <p className="text-[10px] text-white/25">Liquidity {formatCurrency(opp.liquidity, true)}</p>
        </div>
        <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Bid Depth</p>
          <p className="text-sm font-black text-white/80">{formatCurrency(opp.bidDepth, true)}</p>
          <p className="text-[10px] text-white/25">Best {(opp.bestBid * 100).toFixed(1)}¢</p>
        </div>
        <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">Ask Depth</p>
          <p className="text-sm font-black text-white/80">{formatCurrency(opp.askDepth, true)}</p>
          <p className="text-[10px] text-white/25">Best {(opp.bestAsk * 100).toFixed(1)}¢</p>
        </div>
      </div>

      {/* Score + CTA */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/30 uppercase tracking-wider">LP Score</span>
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-black"
            style={{ background: `${scoreColor(sc)}20`, color: scoreColor(sc), border: `1px solid ${scoreColor(sc)}40` }}>
            {scoreLabel(sc)}
          </span>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white transition-all hover:scale-[1.03] hover:brightness-110"
          style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.6),rgba(37,99,235,0.6))', border: '1px solid rgba(139,92,246,0.4)' }}
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
      <SectionHeader
        accent="rgba(139,92,246,0.8)"
        title="LP Opportunities"
        sub="Markets ranked by spread × volume — wider spread + high volume = higher fee potential"
        icon={
          <svg className="h-4 w-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        }
      />
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

/* ═══════════════════════════════════════════════════════════════
   2) LP LEADERBOARD
════════════════════════════════════════════════════════════════ */

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
      <SectionHeader
        accent="rgba(52,211,153,0.8)"
        title="LP Leaderboard"
        sub="Highest-volume traders — market makers and liquidity providers ranked by trading volume"
        icon={
          <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        }
        controls={
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
        }
      />

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
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)' }}>
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

/* ═══════════════════════════════════════════════════════════════
   3) MARKET DEPTH ANALYSIS
════════════════════════════════════════════════════════════════ */

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

  return (
    <section>
      <SectionHeader
        accent="rgba(56,189,248,0.8)"
        title="Market Depth Analysis"
        sub="Live orderbook depth, bid/ask spread and liquidity quality score from CLOB API"
        icon={
          <svg className="h-4 w-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
          </svg>
        }
        controls={
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
        }
      />

      <div className="glass rounded-2xl p-5" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {loading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-5 rounded animate-shimmer" />)}
          </div>
        )}

        {!loading && depth && (
          <div className="flex flex-col gap-6">
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
                  {depth.qualityScore}/100 — {scoreLabel(depth.qualityScore)}
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
                  Bids — Total {formatCurrency(depth.bidDepthTotal, true)}
                </p>
                <DepthBar levels={depth.bids} best={depth.bestBid} side="bid" maxTotal={maxTotal} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-400/70 mb-2">
                  Asks — Total {formatCurrency(depth.askDepthTotal, true)}
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

/* ═══════════════════════════════════════════════════════════════
   4) REWARD SIMULATOR
════════════════════════════════════════════════════════════════ */

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
      <SectionHeader
        accent="rgba(251,191,36,0.8)"
        title="Reward Simulator"
        sub='Estimate your daily maker rebate: "If I add $X of liquidity, how much can I earn?"'
        icon={
          <svg className="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10H9m3-10v10M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
          </svg>
        }
      />

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
                  style={{ border: '1px solid rgba(139,92,246,0.3)' }}
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
            Estimates only — actual rewards depend on spread, fill rate, and Polymarket&apos;s reward program.
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

/* ─────────────────────────── shared UI ─────────────────────────── */

function SectionHeader({ accent, title, sub, icon, controls }: {
  accent: string; title: string; sub: string;
  icon: React.ReactNode; controls?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${accent}20`, border: `1px solid ${accent}40` }}>
          {icon}
        </div>
        <div>
          <h2 className="text-base font-black text-white">{title}</h2>
          <p className="text-[11px] text-white/35 mt-0.5 max-w-lg leading-relaxed">{sub}</p>
        </div>
      </div>
      {controls && <div className="flex-shrink-0">{controls}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════════════ */

export default function LiquidityPage() {
  const [opps, setOpps]     = useState<LPOpportunity[]>([]);
  const [oppsLoading, setOppsLoading] = useState(true);

  const loadOpps = useCallback(() => {
    setOppsLoading(true);
    fetch('/api/liquidity/opportunities')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setOpps(d); })
      .catch(() => {})
      .finally(() => setOppsLoading(false));
  }, []);

  useEffect(() => { loadOpps(); }, [loadOpps]);

  return (
    <div className="flex flex-col gap-12">

      {/* Page header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block h-1 w-8 rounded-full"
            style={{ background: 'linear-gradient(90deg,#7c3aed,#2563eb)' }} />
          <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Market Making</span>
        </div>
        <h1 className="text-4xl font-black leading-none tracking-tight sm:text-5xl">
          <span className="text-white">Liquidity</span>{' '}
          <span className="text-grad">Hub</span>
        </h1>
        <p className="mt-3 text-sm text-white/40 max-w-xl">
          Discover LP opportunities, analyze market depth, and simulate maker rewards on Polymarket.
        </p>

        {/* Quick stats */}
        {!oppsLoading && opps.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-4 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            {[
              { label: 'Markets Analyzed', value: String(opps.length) },
              { label: 'Avg Spread', value: `${(opps.reduce((s, o) => s + o.spread, 0) / opps.length * 100).toFixed(1)}¢` },
              { label: 'Total 24h Vol', value: formatCurrency(opps.reduce((s, o) => s + o.volume24h, 0), true) },
            ].map(s => (
              <div key={s.label} className="glass rounded-xl px-4 py-2.5 flex items-center gap-2.5">
                <div>
                  <p className="text-sm font-black text-white">{s.value}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <LPOpportunitiesSection opps={opps} loading={oppsLoading} />
      <LPLeaderboardSection />
      <MarketDepthSection opps={opps} />
      <RewardSimulator opps={opps} />
    </div>
  );
}
