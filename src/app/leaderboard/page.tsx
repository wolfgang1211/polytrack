'use client';

import { useState, useEffect, useCallback } from 'react';
import LeaderboardTable from '@/components/LeaderboardTable';
import type { LeaderboardEntry, TimeWindow } from '@/types';
import { formatCurrency } from '@/lib/utils';

function SectionHeader({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-mono text-[10px] font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.20)' }}>{index}</span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--vi-border), transparent)' }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.25)' }}>{label}</span>
    </div>
  );
}

function DataCell({ label, value, accent, loading }: { label: string; value: string; accent?: string; loading?: boolean }) {
  return (
    <div className="flex-1 flex flex-col justify-center px-5 py-4 min-w-[130px]">
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] mb-1.5" style={{ color: 'rgba(255,255,255,0.28)' }}>{label}</p>
      {loading ? (
        <div className="h-6 w-20 rounded animate-shimmer" />
      ) : (
        <p className="font-mono text-xl font-black tabular-nums leading-none" style={{ color: accent ?? 'rgba(255,255,255,0.88)' }}>{value}</p>
      )}
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

      {/* ── [01] Header ── */}
      <div className="animate-fade-in-up">
        <SectionHeader index="[01]" label="Leaderboard" />
        <h1 className="text-4xl font-black leading-none tracking-tight sm:text-5xl mb-3">
          <span className="text-white">Trader</span>{' '}
          <span className="text-grad">Leaderboard</span>
        </h1>
        <p className="text-sm text-white/40 max-w-lg">
          Top prediction market traders ranked by P&amp;L, volume and Smart Score.
        </p>
      </div>

      {/* ── [02] Stats strip ── */}
      <div>
        <SectionHeader index="[02]" label="Session Stats" />
        <div className="flex overflow-x-auto animate-fade-in-up"
          style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <DataCell label="Traders" value={loading ? '—' : String(data.length)} accent="rgba(167,139,250,0.95)" loading={loading} />
          <div className="w-px self-stretch flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <DataCell label="Total Vol" value={loading ? '—' : formatCurrency(totalVol, true)} accent="rgba(96,165,250,0.95)" loading={loading} />
          <div className="w-px self-stretch flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <DataCell
            label="Net P&L"
            value={loading ? '—' : (totalPnl >= 0 ? '+' : '') + formatCurrency(totalPnl, true)}
            accent={totalPnl >= 0 ? 'rgba(52,211,153,0.95)' : 'rgba(251,113,133,0.95)'}
            loading={loading}
          />
          <div className="w-px self-stretch flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <DataCell
            label="Top Earner"
            value={loading || !topTrader ? '—' : '+' + formatCurrency(topTrader.pnl, true)}
            accent="rgba(251,191,36,0.95)"
            loading={loading}
          />
        </div>
      </div>

      {/* ── [03] Rankings ── */}
      <div>
        <SectionHeader index="[03]" label="Rankings" />
        <LeaderboardTable
          data={data}
          loading={loading}
          error={error}
          window={timeWindow}
          onWindowChange={setTimeWindow}
        />
      </div>
    </div>
  );
}
