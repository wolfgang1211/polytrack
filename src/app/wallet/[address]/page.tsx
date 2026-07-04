'use client';

import { useEffect, useState, use, useMemo } from 'react';
import Link from 'next/link';
import type { WalletData, Position } from '@/types';
import { formatCurrency, formatAddress, detectCategory, positionPnl } from '@/lib/utils';
import { profileUrl } from '@/lib/builder';
import StatsCard from '@/components/StatsCard';
import PositionCard from '@/components/PositionCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import TelegramModal from '@/components/TelegramModal';
import { useWatchlist } from '@/lib/useWatchlist';
import WalletCharts from '@/components/WalletCharts';
import LatestMoves from '@/components/LatestMoves';
import WalletActivity from '@/components/WalletActivity';
import PnlTimeline from '@/components/PnlTimeline';
import WalletSidebar from '@/components/WalletSidebar';
import CopyAddress from '@/components/CopyAddress';

type Tab = 'open' | 'closed';

interface Insights {
  winRate: number;
  winCount: number;
  totalTrades: number;
  bestCategory: string;
  bestCategoryWinRate: number;
  bestCategoryCount: number;
  avgPositionSize: number;
  biggestWin: Position;
  biggestLoss: Position;
}

function computeInsights(positions: Position[]): Insights | null {
  if (positions.length < 2) return null;

  const winCount = positions.filter(p => positionPnl(p) > 0).length;

  const catMap: Record<string, { wins: number; total: number }> = {};
  for (const p of positions) {
    const cat = detectCategory(p.title);
    if (!catMap[cat]) catMap[cat] = { wins: 0, total: 0 };
    catMap[cat].total++;
    if (positionPnl(p) > 0) catMap[cat].wins++;
  }

  // Require a meaningful sample so a lucky 2/2 category doesn't outrank a
  // 60%-over-200 one. Min sample scales with how many positions we have.
  const minSample = Math.max(5, Math.floor(positions.length * 0.04));
  let bestCategory = 'N/A';
  let bestCategoryWinRate = 0;
  let bestCategoryCount = 0;
  let bestWr = -1;
  for (const [cat, s] of Object.entries(catMap)) {
    if (s.total < minSample) continue;
    const wr = s.wins / s.total;
    // tie-break toward the larger sample
    if (wr > bestWr || (wr === bestWr && s.total > bestCategoryCount)) {
      bestWr = wr; bestCategory = cat;
      bestCategoryWinRate = Math.round(wr * 100); bestCategoryCount = s.total;
    }
  }
  if (bestCategory === 'N/A' && Object.keys(catMap).length > 0) {
    const [cat, s] = Object.entries(catMap).sort((a, b) => b[1].total - a[1].total)[0];
    bestCategory = cat;
    bestCategoryWinRate = Math.round((s.wins / s.total) * 100);
    bestCategoryCount = s.total;
  }

  const avgPositionSize = positions.reduce((s, p) => s + p.initialValue, 0) / positions.length;

  const sorted = [...positions].sort((a, b) => positionPnl(b) - positionPnl(a));
  const biggestWin  = sorted[0];
  const biggestLoss = sorted[sorted.length - 1];

  return { winRate: (winCount / positions.length) * 100, winCount, totalTrades: positions.length, bestCategory, bestCategoryWinRate, bestCategoryCount, avgPositionSize, biggestWin, biggestLoss };
}

interface TimelineData { points: { t: number; pnl: number }[]; realized: number; trades: number; ceiling?: boolean; source?: 'user-pnl-api' | 'graph' | 'data-api' }

export default function WalletPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('open');
  const [showTelegram, setShowTelegram] = useState(false);
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const { isWatched, toggle } = useWatchlist();

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    setError(null);
    fetch(`/api/wallet/${address}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: WalletData) => setData(d))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [address]);

  useEffect(() => {
    if (!address) return;
    let live = true;
    setTimelineLoading(true);
    setTimelineData(null);

    fetch(`/api/wallet/${address}/timeline`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: TimelineData) => { if (live && Array.isArray(d?.points)) setTimelineData(d); })
      .catch(() => {})
      .finally(() => { if (live) setTimelineLoading(false); });

    return () => { live = false; };
  }, [address]);

  const all = data?.positions ?? [];
  const open   = all.filter(p => p.currentValue > 0);
  const closed = all.filter(p => !(p.currentValue > 0));
  const shown  = tab === 'open' ? open : closed;

  // Single source of truth for P&L (matches WalletSidebar):
  //  realized   = lifetime realized P&L across ALL positions (realizedPnl)
  //  unrealized = mark-to-market of OPEN positions only (cashPnl on closed/redeemed
  //               positions is reported as -costBasis, so summing it over all
  //               positions double-counts losses — we exclude closed ones).
  const realizedTotal  = all.reduce((s, p) => s + (Number(p.realizedPnl) || 0), 0);
  const unrealizedOpen = open.reduce((s, p) => s + (Number(p.cashPnl) || 0), 0);
  const cappedTotalPnl = realizedTotal + unrealizedOpen;
  const officialTotalPnl = timelineData?.source === 'user-pnl-api' ? timelineData.realized : null;
  const totalPnl = officialTotalPnl ?? cappedTotalPnl;
  const invested   = all.reduce((s, p) => s + (p.initialValue ?? 0), 0);
  // ROI from capped positions is misleading on huge wallets, so hide it when
  // official full-history PnL is available but positions are capped.
  const roi        = invested > 0 && !(officialTotalPnl != null && data?.truncated) ? (totalPnl / invested) * 100 : null;
  const openVal    = data?.totalValue ?? 0;
  const shownPnl   = tab === 'open'
    ? open.reduce((s, p) => s + (Number(p.realizedPnl) || 0) + (Number(p.cashPnl) || 0), 0)
    : closed.reduce((s, p) => s + (Number(p.realizedPnl) || 0), 0);
  const insights   = useMemo(() => computeInsights(all), [all]);

  const short = formatAddress(address, 8);

  return (
    <>
    {showTelegram && <TelegramModal onClose={() => setShowTelegram(false)} />}
    <div className="flex flex-col gap-5">

      {/* Back */}
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors w-fit animate-fade-in">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Leaderboard
      </Link>

      {loading && <LoadingSpinner text="Loading wallet data…" />}

      {error && (
        <div className="animate-scale-in rounded-2xl p-8 text-center"
          style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)' }}>
          <p className="text-sm text-rose-400">{error}</p>
          <Link href="/" className="mt-4 inline-block text-xs text-white/40 hover:text-white/70">
            ← Go back
          </Link>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── Hero header ── */}
          <div className="animate-fade-in-up relative overflow-hidden rounded-3xl p-6 sm:p-8"
            style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(147,51,234,0.08) 50%, rgba(168,85,247,0.06) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
            {/* glow behind avatar */}
            <div className="absolute top-0 left-0 h-48 w-48 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 40% 40%, rgba(124,58,237,0.25), transparent 70%)', filter:'blur(30px)' }} />
            {/* grid texture */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.3]"
              style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
                maskImage: 'radial-gradient(ellipse at 80% 50%, #000 0%, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(ellipse at 80% 50%, #000 0%, transparent 70%)',
              }} />

            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white"
                    style={{
                      background: 'linear-gradient(135deg, #7c3aed, #9333ea)',
                      boxShadow: '0 0 0 2px var(--vi-border-xl), 0 0 40px rgba(124,58,237,0.35)',
                    }}>
                    {short[0]?.toUpperCase()}
                  </div>
                  <div className="absolute -inset-1 rounded-2xl pointer-events-none animate-glow-pulse"
                    style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.25),rgba(147,51,234,0.2))', filter:'blur(8px)', zIndex:-1 }} />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Wallet</span>
                  </div>
                  <h1 className="text-xl font-black text-white sm:text-2xl">{short}</h1>
                  <div className="flex items-start gap-1.5 mt-0.5">
                    <p className="font-mono text-[11px] text-white/25 break-all max-w-xs">{address}</p>
                    <CopyAddress address={address} className="mt-0.5" />
                  </div>

                  {/* at-a-glance pills */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={totalPnl >= 0
                        ? { background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }
                        : { background: 'rgba(251,113,133,0.12)', border: '1px solid rgba(251,113,133,0.25)', color: '#fb7185' }}>
                      {totalPnl >= 0 ? '▲' : '▼'} {(totalPnl >= 0 ? '+' : '') + formatCurrency(totalPnl, true)}
                      {roi != null && <span className="opacity-70"> · {roi >= 0 ? '+' : ''}{roi.toFixed(0)}%</span>}
                    </span>
                    {insights && (
                      <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white/55"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {insights.winRate.toFixed(0)}% win rate
                      </span>
                    )}
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white/55"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {open.length} open · {formatCurrency(openVal, true)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick links */}
              <div className="flex flex-wrap gap-2">
                <a
                  href={profileUrl(address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white/70 transition-all hover:text-white hover:scale-[1.02]"
                  style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)' }}
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open on Polymarket
                </a>
                {/* Share on X — the link unfurls with the wallet's P&L card */}
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${short} on Polymarket — tracked with @alphaboardxyz`)}&url=${encodeURIComponent(`https://www.alphaboard.xyz/wallet/${address}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white/70 transition-all hover:text-white hover:scale-[1.02]"
                  style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)' }}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Share Card
                </a>
                {/* Watchlist */}
                <button
                  onClick={() => toggle(address)}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all hover:scale-[1.02]"
                  style={isWatched(address)
                    ? { background:'rgba(251,191,36,0.15)', border:'1px solid rgba(251,191,36,0.35)', color:'#fbbf24' }
                    : { background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.55)' }}
                >
                  <span className="text-sm leading-none">{isWatched(address) ? '⭐' : '☆'}</span>
                  {isWatched(address) ? 'Watching' : 'Add to Watchlist'}
                </button>

                <button
                  onClick={() => setShowTelegram(true)}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white/70 transition-all hover:text-white hover:scale-[1.02]"
                  style={{ background:'rgba(34,197,94,0.10)', border:'1px solid rgba(34,197,94,0.3)' }}
                >
                  <svg className="h-3.5 w-3.5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.478 13.9l-2.95-.924c-.643-.204-.657-.643.136-.953l11.57-4.46c.537-.194 1.006.131.66.658z"/>
                  </svg>
                  Get Wallet Alerts on Telegram
                </button>
              </div>
            </div>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatsCard
              label={officialTotalPnl != null ? "Polymarket P&L" : "Total P&L"}
              value={(totalPnl >= 0 ? '+' : '') + formatCurrency(totalPnl, true)}
              sub={officialTotalPnl != null ? 'Polymarket official P&L' : (roi != null ? `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}% ROI` : undefined)}
              valueClass={totalPnl > 0 ? 'text-grad-profit' : totalPnl < 0 ? 'text-grad-loss' : 'text-white/50'}
              gradient={totalPnl >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(251,113,133,0.15)'}
              icon={<svg style={{width:14,height:14}} className={totalPnl>=0?'text-emerald-400':'text-rose-400'} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>}
              delay={0}
            />
            <StatsCard
              label="Open Value"
              value={formatCurrency(openVal, true)}
              gradient="var(--vi-tint)"
              icon={<svg style={{width:14,height:14}} className="text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>}
              delay={60}
            />
            <StatsCard
              label="Open Pos."
              value={String(open.length)}
              sub={`${closed.length} closed`}
              gradient="rgba(59,130,246,0.15)"
              icon={<svg style={{width:14,height:14}} className="text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>}
              delay={120}
            />
            <StatsCard
              label="Total Pos."
              value={all.length > 0
                ? String(all.length)
                : timelineData && timelineData.trades > 0 ? `${timelineData.trades}` : '—'}
              sub={all.length > 0
                ? (data?.truncated ? `${all.length}+ (capped)` : 'all time')
                : timelineData && timelineData.trades > 0 ? 'trades (from history)' : 'position data unavailable'}
              gradient="rgba(168,85,247,0.15)"
              icon={<svg style={{width:14,height:14}} className="text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
              delay={180}
            />
          </div>

          {/* ── Trading Insights ── */}
          {insights && (
            <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">Trading Insights</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

                {/* Win Rate */}
                <StatsCard
                  label="Win Rate"
                  value={`${insights.winRate.toFixed(0)}%`}
                  sub={`${insights.winCount} wins / ${insights.totalTrades} trades`}
                  valueClass={insights.winRate >= 50 ? 'text-grad-profit' : 'text-grad-loss'}
                  gradient={insights.winRate >= 50 ? 'rgba(251,191,36,0.15)' : 'rgba(251,113,133,0.12)'}
                  icon={<svg style={{width:14,height:14}} className="text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>}
                  delay={0}
                />

                {/* Best Category */}
                <StatsCard
                  label="Best Category"
                  value={insights.bestCategory}
                  sub={insights.bestCategory !== 'N/A' ? `${insights.bestCategoryWinRate}% over ${insights.bestCategoryCount} trades` : 'Not enough data'}
                  gradient="rgba(249,115,22,0.15)"
                  icon={<svg style={{width:14,height:14}} className="text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/></svg>}
                  delay={60}
                />

                {/* Avg Position Size */}
                <StatsCard
                  label="Avg Position"
                  value={formatCurrency(insights.avgPositionSize, true)}
                  sub="per trade"
                  gradient="rgba(99,102,241,0.15)"
                  icon={<svg style={{width:14,height:14}} className="text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>}
                  delay={120}
                />

                {/* Best / Worst trade */}
                <div
                  className="glass glass-hover gradient-border rounded-2xl p-5 animate-fade-in-up"
                  style={{ animationDelay: '180ms' }}
                >
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/35">Best / Worst</p>
                  <div className="flex flex-col gap-2.5">
                    <div>
                      <p className={`text-base font-black leading-none ${positionPnl(insights.biggestWin) > 0 ? 'text-grad-profit' : 'text-white/40'}`}>
                        {positionPnl(insights.biggestWin) >= 0 ? '+' : ''}{formatCurrency(positionPnl(insights.biggestWin), true)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-white/25 line-clamp-1">{insights.biggestWin.title}</p>
                    </div>
                    <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <div>
                      <p className={`text-base font-black leading-none ${positionPnl(insights.biggestLoss) < 0 ? 'text-grad-loss' : 'text-white/40'}`}>
                        {positionPnl(insights.biggestLoss) >= 0 ? '+' : ''}{formatCurrency(positionPnl(insights.biggestLoss), true)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-white/25 line-clamp-1">{insights.biggestLoss.title}</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── Two-column: sidebar + main analytics panel ── */}
          <div className="grid gap-4 lg:grid-cols-[280px_1fr] items-start">
            {/* Left sidebar */}
            <div className="animate-fade-in-up" style={{ animationDelay: '120ms' }}>
              <WalletSidebar address={address} positions={all} openValue={openVal} officialPnl={officialTotalPnl} />
            </div>

            {/* Main panel — everything fits in this column */}
            <div className="flex min-w-0 flex-col gap-4">
              <div className="animate-fade-in-up" style={{ animationDelay: '140ms' }}>
                {/* Anchor only when the curve comes from an incomplete trade replay
                    AND we actually have position data to anchor to. The official
                    user-pnl-api curve is already authoritative — anchoring it to a
                    positions-derived total (which can be 0 for old wallets whose
                    positions the data-api no longer returns) flattens the chart. */}
                <PnlTimeline
                  address={address}
                  data={timelineData}
                  loading={timelineLoading}
                  anchor={timelineData?.source === 'user-pnl-api' || all.length === 0 ? null : realizedTotal}
                />
              </div>
              <WalletCharts positions={all} />
              <WalletActivity address={address} positions={all} />
              <LatestMoves address={address} />
            </div>
          </div>

          {/* ── Positions ── */}
          <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            {/* Tab header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex gap-1 rounded-2xl glass p-1">
                {(['open','closed'] as Tab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`relative rounded-xl px-5 py-1.5 text-xs font-bold transition-all duration-200
                      ${tab === t ? 'text-white' : 'text-white/30 hover:text-white/55'}`}
                  >
                    {tab === t && (
                      <span className="absolute inset-0 rounded-xl"
                        style={{ background:'linear-gradient(135deg,rgba(124,58,237,0.55),rgba(147,51,234,0.55))', border:'1px solid var(--vi-border-xl)' }} />
                    )}
                    <span className="relative">
                      {t === 'open' ? `Open (${open.length})` : `Closed (${closed.length})`}
                    </span>
                  </button>
                ))}
              </div>

              {shown.length > 0 && (
                <div className="text-right">
                  <p className="text-[10px] text-white/25 uppercase tracking-wider">Tab P&L</p>
                  <p className={`text-sm font-black ${shownPnl > 0 ? 'text-grad-profit' : shownPnl < 0 ? 'text-grad-loss' : 'text-white/40'}`}>
                    {shownPnl >= 0 ? '+' : ''}{formatCurrency(shownPnl, true)}
                  </p>
                </div>
              )}
            </div>

            {/* Cards grid */}
            {shown.length === 0 ? (
              <div className="glass rounded-2xl py-20 text-center">
                <p className="text-3xl mb-3">{tab === 'open' ? '📭' : '📂'}</p>
                <p className="text-sm text-white/25">
                  {tab === 'open' ? 'No open positions' : 'No closed positions'}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {shown.map((p, i) => (
                  <PositionCard key={`${p.asset}-${p.outcome}`} position={p} delay={i * 35} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
    </>
  );
}
