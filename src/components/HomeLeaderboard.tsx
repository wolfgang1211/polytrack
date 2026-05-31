'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import LeaderboardTable from '@/components/LeaderboardTable';
import type { LeaderboardEntry, TimeWindow } from '@/types';

const LIMIT = 15;
const REFRESH_MS = 15_000;

/**
 * Homepage hero: the ranked list of profitable traders, kept *live*.
 * Auto-refreshes every 15s, flashes rows whose P&L changed, and shows a
 * per-row 7-day sparkline. Reuses the full LeaderboardTable (window tabs +
 * per-row Track), top 15, with a link through to the full board.
 */
export default function HomeLeaderboard() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('1w');
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set());
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());
  const [tick, setTick] = useState(0); // re-render for "updated Xs ago"

  const prevPnl = useRef<Record<string, number>>({});

  const fetchSparklines = useCallback(async (entries: LeaderboardEntry[]) => {
    const wallets = entries.map(e => e.proxyWallet).join(',');
    if (!wallets) return;
    try {
      const res = await fetch(`/api/leaderboard/sparkline?wallets=${wallets}`);
      if (!res.ok) return;
      const map = await res.json();
      if (map && typeof map === 'object') {
        const lower: Record<string, number[]> = {};
        for (const [k, v] of Object.entries(map)) lower[k.toLowerCase()] = v as number[];
        setSparklines(lower);
      }
    } catch { /* ignore */ }
  }, []);

  const load = useCallback(async (w: TimeWindow, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leaderboard?window=${w}&limit=${LIMIT}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json)) throw new Error('Unexpected response format');
      const next: LeaderboardEntry[] = json.slice(0, LIMIT);

      // diff P&L vs previous snapshot → flash changed rows
      const changed = new Set<string>();
      for (const e of next) {
        const key = e.proxyWallet.toLowerCase();
        const prev = prevPnl.current[key];
        if (prev !== undefined && Math.abs(prev - e.pnl) > 0.5) changed.add(e.proxyWallet);
        prevPnl.current[key] = e.pnl;
      }
      setData(next);
      setUpdatedAt(Date.now());
      if (silent && changed.size) {
        setFlashKeys(new Set([...changed].map(k => k.toLowerCase())));
        setTimeout(() => setFlashKeys(new Set()), 1200);
      }
      fetchSparklines(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      if (!silent) setData([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [fetchSparklines]);

  // initial + window change
  useEffect(() => { load(timeWindow); }, [timeWindow, load]);

  // live polling
  useEffect(() => {
    const id = setInterval(() => load(timeWindow, true), REFRESH_MS);
    return () => clearInterval(id);
  }, [timeWindow, load]);

  // "updated Xs ago" ticker
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const secsAgo = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  void tick;

  return (
    <div className="animate-fade-in-up">
      <div className="mb-4 flex items-end justify-between">
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-1 w-8 rounded-full"
            style={{ background: 'linear-gradient(90deg,#7c3aed,#2563eb)' }} />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">Trader Leaderboard</h2>
          <span className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            Live · {secsAgo}s
          </span>
        </div>
        <Link href="/leaderboard"
          className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-300 transition-colors hover:text-violet-200"
          style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}>
          View full board →
        </Link>
      </div>

      <LeaderboardTable
        data={data}
        loading={loading}
        error={error}
        window={timeWindow}
        onWindowChange={setTimeWindow}
        sparklines={sparklines}
        flashKeys={flashKeys}
      />
    </div>
  );
}
