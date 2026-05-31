'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import LeaderboardTable from '@/components/LeaderboardTable';
import type { LeaderboardEntry, TimeWindow } from '@/types';

const LIMIT = 15;

/**
 * Homepage hero section: the ranked list of profitable traders is the core of
 * the product, so it lives front-and-center (not as a 4-row teaser). Reuses the
 * full LeaderboardTable (window tabs + per-row Track) and shows the top 15,
 * with a link through to the full board.
 */
export default function HomeLeaderboard() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('1w');

  const load = useCallback(async (w: TimeWindow) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leaderboard?window=${w}&limit=${LIMIT}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json)) throw new Error('Unexpected response format');
      setData(json.slice(0, LIMIT));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(timeWindow); }, [timeWindow, load]);

  return (
    <div className="animate-fade-in-up">
      <div className="mb-4 flex items-end justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1 w-8 rounded-full"
            style={{ background: 'linear-gradient(90deg,#7c3aed,#2563eb)' }} />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">Trader Leaderboard</h2>
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
      />
    </div>
  );
}
