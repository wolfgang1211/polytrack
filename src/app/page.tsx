'use client';

import { useState, useEffect, useCallback } from 'react';
import LeaderboardTable from '@/components/LeaderboardTable';
import WalletSearch from '@/components/WalletSearch';
import TopMarkets from '@/components/TopMarkets';
import RecentBigTrades from '@/components/RecentBigTrades';
import RisingTraders from '@/components/RisingTraders';
import type { LeaderboardEntry, TimeWindow } from '@/types';
import { formatCurrency } from '@/lib/utils';

function HeroStat({
  label, value, icon, gradient, delay,
}: {
  label: string; value: string;
  icon: React.ReactNode; gradient: string; delay: number;
}) {
  return (
    <div className="flex items-center gap-3 animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ background: gradient, border: '1px solid rgba(255,255,255,0.08)' }}>
        {icon}
      </div>
      <div>
        <p className="text-base font-black text-white sm:text-lg">{value}</p>
        <p className="text-[10px] uppercase tracking-widest text-white/30">{label}</p>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('allTime');

  const load = useCallback(async (w: TimeWindow) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leaderboard?window=${w}&limit=50`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json)) throw new Error('Unexpected response format');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(timeWindow); }, [timeWindow, load]);

  const totalPnl  = data.reduce((s, e) => s + e.pnl, 0);
  const totalVol  = data.reduce((s, e) => s + e.vol, 0);
  const topTrader = data[0];

  return (
    <div className="flex flex-col gap-10">

      {/* ── Hero ── */}
      <div className="relative animate-fade-in-up">

        {/* Hero glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[600px] h-40 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center,rgba(124,58,237,0.18) 0%,transparent 70%)', filter: 'blur(40px)' }} />

        {/* Live badge */}
        <div className="flex items-center gap-2 mb-5">
          <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            Live · Polymarket Data
          </span>
          <span className="hidden sm:inline text-[10px] text-white/20 uppercase tracking-widest">
            Updated every 60s
          </span>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="font-black leading-[0.9] tracking-tight text-5xl sm:text-6xl lg:text-7xl">
            <span className="text-white">Trader</span>
            <br />
            <span className="text-grad">Leaderboard</span>
          </h1>
          <p className="mt-4 text-sm text-white/40 max-w-lg leading-relaxed">
            Track the top prediction market traders on Polymarket — positions, P&amp;L, and win rates, all in real time.
          </p>
        </div>

        {/* Stats bar + search */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

          {!loading && data.length > 0 && (
            <div className="glass rounded-2xl px-5 py-4 grid grid-cols-2 gap-x-8 gap-y-4 sm:flex sm:flex-wrap sm:items-center sm:gap-8"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <HeroStat
                label="Top Traders"
                value={data.length.toString()}
                delay={100}
                gradient="rgba(139,92,246,0.18)"
                icon={
                  <svg className="h-4.5 w-4.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{width:18,height:18}}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              />
              <HeroStat
                label="Total Volume"
                value={formatCurrency(totalVol, true)}
                delay={150}
                gradient="rgba(37,99,235,0.18)"
                icon={
                  <svg className="h-4.5 w-4.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{width:18,height:18}}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              />
              <HeroStat
                label="Total P&L"
                value={(totalPnl >= 0 ? '+' : '') + formatCurrency(totalPnl, true)}
                delay={200}
                gradient={totalPnl >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(251,113,133,0.15)'}
                icon={
                  <svg className="h-4.5 w-4.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{width:18,height:18}}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                }
              />
              {topTrader && (
                <HeroStat
                  label="Top Trader P&L"
                  value={'+' + formatCurrency(topTrader.pnl, true)}
                  delay={250}
                  gradient="rgba(251,191,36,0.15)"
                  icon={
                    <svg className="h-4.5 w-4.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{width:18,height:18}}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  }
                />
              )}
            </div>
          )}

          {/* Wallet search card */}
          <div className="glass rounded-2xl p-5 lg:w-72 animate-fade-in-up flex-shrink-0" style={{ animationDelay: '200ms' }}>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.4),rgba(37,99,235,0.4))', border: '1px solid rgba(139,92,246,0.3)' }}>
                <svg className="h-3.5 w-3.5 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-white/60">Track a Wallet</p>
            </div>
            <WalletSearch />
          </div>
        </div>
      </div>

      {/* ── Top Markets ── */}
      <TopMarkets />

      {/* ── Trades + Rising Traders ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <RecentBigTrades />
        <RisingTraders />
      </div>

      {/* ── Leaderboard Table ── */}
      <LeaderboardTable
        data={data}
        loading={loading}
        error={error}
        window={timeWindow}
        onWindowChange={setTimeWindow}
      />
    </div>
  );
}
