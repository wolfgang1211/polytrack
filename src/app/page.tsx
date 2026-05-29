'use client';

import { useState, useEffect, useCallback } from 'react';
import LeaderboardTable from '@/components/LeaderboardTable';
import WalletSearch from '@/components/WalletSearch';
import TopMarkets from '@/components/TopMarkets';
import RecentBigTrades from '@/components/RecentBigTrades';
import RisingTraders from '@/components/RisingTraders';
import LiveTicker from '@/components/LiveTicker';
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
    <div className="flex flex-col gap-8">

      {/* ── Live trade ticker ── */}
      <LiveTicker />

      {/* ── Hero ── */}
      <div className="relative animate-fade-in-up overflow-hidden rounded-3xl px-6 py-7 sm:px-8 sm:py-9"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.10) 0%, rgba(37,99,235,0.06) 40%, rgba(6,182,212,0.05) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>

        {/* Aurora orbs */}
        <div className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full animate-orb"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.30) 0%, transparent 70%)', filter: 'blur(50px)' }} />
        <div className="pointer-events-none absolute -bottom-28 right-10 h-72 w-72 rounded-full animate-orb"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.22) 0%, transparent 70%)', filter: 'blur(55px)', animationDelay: '6s' }} />
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(37,99,235,0.10) 0%, transparent 60%)' }} />

        {/* Title row */}
        <div className="relative mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2.5 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                Live
              </span>
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
                style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)', color: 'rgba(196,181,253,0.85)' }}>
                PolyTrack Intelligence
              </span>
            </div>
            <h1 className="text-3xl font-black leading-[1.05] tracking-tight sm:text-[2.6rem]">
              <span className="animate-gradient bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(110deg,#fff 10%,#c4b5fd 40%,#38bdf8 70%,#fff 95%)' }}>
                Alpha Board
              </span>
            </h1>
            <p className="mt-2 max-w-lg text-sm text-white/45">
              Where Polymarket&apos;s sharpest money moves — live P&amp;L, positions &amp; win rates, ranked in real time.
            </p>
          </div>
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
