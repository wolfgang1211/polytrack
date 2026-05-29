'use client';

import { useState, useEffect, useCallback } from 'react';
import LeaderboardTable from '@/components/LeaderboardTable';
import type { LeaderboardEntry, TimeWindow } from '@/types';
import { formatCurrency } from '@/lib/utils';

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="animate-fade-in-up text-center sm:text-left">
      <p className="text-lg font-black sm:text-xl" style={{ color }}>{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-white/30 mt-0.5">{label}</p>
    </div>
  );
}

export default function LeaderboardPage() {
  const [data, setData]           = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
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

      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block h-1 w-8 rounded-full"
            style={{ background: 'linear-gradient(90deg,#7c3aed,#2563eb)' }} />
          <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Polymarket</span>
        </div>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-black leading-none tracking-tight sm:text-5xl">
              <span className="text-white">Trader</span>{' '}
              <span className="text-grad">Leaderboard</span>
            </h1>
            <p className="mt-3 text-sm text-white/40 max-w-lg">
              Top prediction market traders ranked by P&amp;L, volume and Smart Score.
            </p>
          </div>

          {/* Live stats strip */}
          {!loading && data.length > 0 && (
            <div className="glass rounded-2xl px-5 py-3 flex flex-wrap items-center gap-6
              divide-x divide-white/[0.06] animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <StatPill label="Traders" value={String(data.length)} color="#a78bfa" />
              <div className="pl-6">
                <StatPill label="Total Vol" value={formatCurrency(totalVol, true)} color="#60a5fa" />
              </div>
              <div className="pl-6">
                <StatPill
                  label="Net P&L"
                  value={(totalPnl >= 0 ? '+' : '') + formatCurrency(totalPnl, true)}
                  color={totalPnl >= 0 ? '#34d399' : '#fb7185'}
                />
              </div>
              {topTrader && (
                <div className="pl-6">
                  <StatPill label="Top Earner" value={'+' + formatCurrency(topTrader.pnl, true)} color="#fbbf24" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
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
