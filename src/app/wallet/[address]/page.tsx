'use client';

import { useEffect, useState, use, useMemo } from 'react';
import Link from 'next/link';
import type { WalletData, Position } from '@/types';
import { formatCurrency, formatAddress, detectCategory } from '@/lib/utils';
import { profileUrl } from '@/lib/builder';
import StatsCard from '@/components/StatsCard';
import PositionCard from '@/components/PositionCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import TelegramModal from '@/components/TelegramModal';
import WalletCharts from '@/components/WalletCharts';

type Tab = 'open' | 'closed';

interface Insights {
  winRate: number;
  winCount: number;
  totalTrades: number;
  bestCategory: string;
  bestCategoryWinRate: number;
  avgPositionSize: number;
  biggestWin: Position;
  biggestLoss: Position;
}

function computeInsights(positions: Position[]): Insights | null {
  if (positions.length < 2) return null;

  const winCount = positions.filter(p => p.cashPnl > 0).length;

  const catMap: Record<string, { wins: number; total: number }> = {};
  for (const p of positions) {
    const cat = detectCategory(p.title);
    if (!catMap[cat]) catMap[cat] = { wins: 0, total: 0 };
    catMap[cat].total++;
    if (p.cashPnl > 0) catMap[cat].wins++;
  }

  let bestCategory = 'N/A';
  let bestCategoryWinRate = 0;
  let bestWr = -1;
  for (const [cat, s] of Object.entries(catMap)) {
    if (s.total < 2) continue;
    const wr = s.wins / s.total;
    if (wr > bestWr) { bestWr = wr; bestCategory = cat; bestCategoryWinRate = Math.round(wr * 100); }
  }
  if (bestCategory === 'N/A' && Object.keys(catMap).length > 0) {
    const [cat, s] = Object.entries(catMap).sort((a, b) => b[1].total - a[1].total)[0];
    bestCategory = cat;
    bestCategoryWinRate = Math.round((s.wins / s.total) * 100);
  }

  const avgPositionSize = positions.reduce((s, p) => s + p.initialValue, 0) / positions.length;

  const sorted = [...positions].sort((a, b) => b.cashPnl - a.cashPnl);
  const biggestWin  = sorted[0];
  const biggestLoss = sorted[sorted.length - 1];

  return { winRate: (winCount / positions.length) * 100, winCount, totalTrades: positions.length, bestCategory, bestCategoryWinRate, avgPositionSize, biggestWin, biggestLoss };
}

export default function WalletPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('open');
  const [showTelegram, setShowTelegram] = useState(false);

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

  const all = data?.positions ?? [];
  const open   = all.filter(p => p.currentValue > 0 || p.curPrice > 0);
  const closed = all.filter(p => p.currentValue === 0 && p.curPrice === 0);
  const shown  = tab === 'open' ? open : closed;

  const totalPnl   = all.reduce((s, p) => s + p.cashPnl, 0);
  const openVal    = data?.totalValue ?? 0;
  const shownPnl   = shown.reduce((s, p) => s + p.cashPnl, 0);
  const insights   = useMemo(() => computeInsights(all), [all]);

  const short = formatAddress(address, 8);

  return (
    <>
    {showTelegram && <TelegramModal onClose={() => setShowTelegram(false)} />}
    <div className="flex flex-col gap-8">

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
              background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(37,99,235,0.08) 50%, rgba(6,182,212,0.06) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
            {/* glow behind avatar */}
            <div className="absolute top-0 left-0 h-48 w-48 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 40% 40%, rgba(124,58,237,0.25), transparent 70%)', filter:'blur(30px)' }} />

            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white"
                    style={{
                      background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
                      boxShadow: '0 0 0 2px rgba(139,92,246,0.4), 0 0 40px rgba(124,58,237,0.35)',
                    }}>
                    {short[0]?.toUpperCase()}
                  </div>
                  <div className="absolute -inset-1 rounded-2xl pointer-events-none animate-glow-pulse"
                    style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.25),rgba(37,99,235,0.2))', filter:'blur(8px)', zIndex:-1 }} />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Wallet</span>
                  </div>
                  <h1 className="text-xl font-black text-white sm:text-2xl">{short}</h1>
                  <p className="font-mono text-[11px] text-white/25 mt-0.5 break-all max-w-xs">{address}</p>
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
              label="Total P&L"
              value={(totalPnl >= 0 ? '+' : '') + formatCurrency(totalPnl, true)}
              valueClass={totalPnl > 0 ? 'text-grad-profit' : totalPnl < 0 ? 'text-grad-loss' : 'text-white/50'}
              icon="📊"
              delay={0}
            />
            <StatsCard
              label="Open Value"
              value={formatCurrency(openVal, true)}
              icon="💼"
              delay={60}
            />
            <StatsCard
              label="Open Pos."
              value={String(open.length)}
              sub={`${closed.length} closed`}
              icon="⚡"
              delay={120}
            />
            <StatsCard
              label="Total Pos."
              value={String(all.length)}
              sub="all time"
              icon="🎯"
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
                  icon="🎯"
                  delay={0}
                />

                {/* Best Category */}
                <StatsCard
                  label="Best Category"
                  value={insights.bestCategory}
                  sub={insights.bestCategory !== 'N/A' ? `${insights.bestCategoryWinRate}% win rate` : 'Not enough data'}
                  icon="🏆"
                  delay={60}
                />

                {/* Avg Position Size */}
                <StatsCard
                  label="Avg Position"
                  value={formatCurrency(insights.avgPositionSize, true)}
                  sub="per trade"
                  icon="📐"
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
                      <p className={`text-base font-black leading-none ${insights.biggestWin.cashPnl > 0 ? 'text-grad-profit' : 'text-white/40'}`}>
                        {insights.biggestWin.cashPnl >= 0 ? '+' : ''}{formatCurrency(insights.biggestWin.cashPnl, true)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-white/25 line-clamp-1">{insights.biggestWin.title}</p>
                    </div>
                    <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <div>
                      <p className={`text-base font-black leading-none ${insights.biggestLoss.cashPnl < 0 ? 'text-grad-loss' : 'text-white/40'}`}>
                        {insights.biggestLoss.cashPnl >= 0 ? '+' : ''}{formatCurrency(insights.biggestLoss.cashPnl, true)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-white/25 line-clamp-1">{insights.biggestLoss.title}</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── Performance charts ── */}
          <WalletCharts positions={all} />

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
                        style={{ background:'linear-gradient(135deg,rgba(124,58,237,0.55),rgba(37,99,235,0.55))', border:'1px solid rgba(139,92,246,0.4)' }} />
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
