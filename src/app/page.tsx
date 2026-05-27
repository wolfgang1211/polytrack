'use client';

import { useState, useEffect, useCallback } from 'react';
import LeaderboardTable from '@/components/LeaderboardTable';
import WalletSearch from '@/components/WalletSearch';
import type { LeaderboardEntry, TimeWindow } from '@/types';
import { formatCurrency } from '@/lib/utils';

function HeroStat({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <div className="animate-fade-in-up text-center sm:text-left" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-xl font-black text-grad sm:text-2xl">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-white/30 mt-0.5">{label}</p>
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
      const res = await fetch(`/api/leaderboard?window=${w}&limit=100`);
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

  const totalPnl    = data.reduce((s, e) => s + e.pnl, 0);
  const totalVol    = data.reduce((s, e) => s + e.vol, 0);
  const topTrader   = data[0];

  return (
    <div className="flex flex-col gap-10">

      {/* ── Hero ── */}
      <div className="animate-fade-in-up">
        {/* Heading */}
        <div className="flex flex-col gap-1 mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block h-1 w-8 rounded-full"
              style={{ background: 'linear-gradient(90deg,#7c3aed,#2563eb)' }} />
            <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Live Rankings</span>
          </div>
          <h1 className="text-4xl font-black leading-none tracking-tight sm:text-5xl">
            <span className="text-white">Trader</span>{' '}
            <span className="text-grad">Leaderboard</span>
          </h1>
          <p className="mt-2 text-sm text-white/35 max-w-xl">
            Track the top prediction market traders on Polymarket in real time
          </p>
        </div>

        {/* Hero stats + wallet search */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* Stats */}
          {!loading && data.length > 0 && (
            <div className="glass rounded-2xl px-6 py-4 flex flex-wrap items-center gap-6 divide-x divide-white/[0.06]">
              <HeroStat label="Total Traders" value={data.length.toString()} delay={150} />
              <div className="pl-6">
                <HeroStat label="Total Volume" value={formatCurrency(totalVol, true)} delay={200} />
              </div>
              <div className="pl-6">
                <HeroStat label="Total P&L" value={(totalPnl >= 0 ? '+' : '') + formatCurrency(totalPnl, true)} delay={250} />
              </div>
              {topTrader && (
                <div className="pl-6">
                  <HeroStat label="Top Trader P&L" value={'+' + formatCurrency(topTrader.pnl, true)} delay={300} />
                </div>
              )}
            </div>
          )}

          {/* Wallet search card */}
          <div className="glass rounded-2xl p-5 lg:w-80 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg flex items-center justify-center text-xs"
                style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.4),rgba(37,99,235,0.4))', border:'1px solid rgba(139,92,246,0.3)' }}>
                🔍
              </div>
              <p className="text-xs font-semibold text-white/60">Track a Wallet</p>
            </div>
            <WalletSearch />
          </div>
        </div>
      </div>

      {/* ── Table ── */}
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
