'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import type { OverviewStats } from '@/app/api/stats/overview/route';

const CAT_COLOR: Record<string, string> = {
  Crypto:        '#fbbf24',
  Politics:      '#fb7185',
  Sports:        '#34d399',
  Entertainment: '#f472b6',
  Tech:          '#38bdf8',
  World:         'var(--text-secondary)',
  Other:         '#94a3b8',
};

function DataCell({ label, value, sub, accent, loading }: {
  label: string; value: string; sub?: string; accent?: string; loading: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col justify-center px-3 py-4 sm:px-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] mb-1.5" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      {loading ? (
        <div className="h-6 w-20 rounded animate-shimmer" />
      ) : (
        <p className="font-mono text-xl font-black tabular-nums leading-none"
          style={{ color: accent ?? 'rgba(var(--ink-rgb),0.88)' }}>
          {value}
        </p>
      )}
      {sub && !loading && (
        <p className="font-mono text-[10px] mt-1 truncate" style={{ color: 'var(--text-muted)' }}>{sub}</p>
      )}
    </div>
  );
}

export default function DashboardStats() {
  const [stats, setStats]     = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats/overview')
      .then(r => { if (!r.ok) throw new Error('Statistics unavailable'); return r.json(); })
      .then(d => setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const catColor = stats ? (CAT_COLOR[stats.topCategory] ?? '#94a3b8') : '#94a3b8';

  return (
    <div data-testid="dashboard-stats" className="grid min-w-0 grid-cols-2 overflow-hidden animate-fade-in-up sm:grid-cols-4"
      style={{
        background: 'rgba(var(--ink-rgb),0.02)',
        borderTop: '1px solid rgba(var(--ink-rgb),0.07)',
        borderBottom: '1px solid rgba(var(--ink-rgb),0.07)',
      }}>

      <div className="min-w-0 border-b border-r sm:border-b-0" style={{ borderColor: 'rgba(var(--ink-rgb),0.06)' }}>
        <DataCell label="Tracked Markets" value={stats ? String(stats.activeMarkets) : '—'} sub="Up to 200 active markets" loading={loading} />
      </div>
      <div className="min-w-0 border-b sm:border-b-0 sm:border-r" style={{ borderColor: 'rgba(var(--ink-rgb),0.06)' }}>
        <DataCell label="Tracked 24h Volume" value={stats ? formatCurrency(stats.volume24h, true) : '—'} sub="Tracked market sample only" accent="rgba(242,240,233,0.95)" loading={loading} />
      </div>
      <div className="min-w-0 border-r" style={{ borderColor: 'rgba(var(--ink-rgb),0.06)' }}>
        <DataCell label="Trades (1h sample)" value={stats ? String(stats.trades1h) : '—'} sub="From latest 500 trades" accent="rgba(251,191,36,0.88)" loading={loading} />
      </div>
      <div className="min-w-0">
        <DataCell label="Top Category" value={stats?.topCategory ?? '—'} sub={stats ? `${stats.topCategoryCount} trades` : undefined} accent={catColor} loading={loading} />
      </div>
    </div>
  );
}
