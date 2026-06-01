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
  World:         '#a78bfa',
  Other:         '#94a3b8',
};

function DataCell({ label, value, sub, accent, loading }: {
  label: string; value: string; sub?: string; accent?: string; loading: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col justify-center px-5 py-4 min-w-[130px]">
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] mb-1.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
        {label}
      </p>
      {loading ? (
        <div className="h-6 w-20 rounded animate-shimmer" />
      ) : (
        <p className="font-mono text-xl font-black tabular-nums leading-none"
          style={{ color: accent ?? 'rgba(255,255,255,0.88)' }}>
          {value}
        </p>
      )}
      {sub && !loading && (
        <p className="font-mono text-[9px] mt-1 truncate" style={{ color: 'rgba(255,255,255,0.20)' }}>{sub}</p>
      )}
    </div>
  );
}

export default function DashboardStats() {
  const [stats, setStats]     = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats/overview')
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const catColor = stats ? (CAT_COLOR[stats.topCategory] ?? '#94a3b8') : '#94a3b8';

  return (
    <div className="flex animate-fade-in-up overflow-x-auto"
      style={{
        background: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>

      <DataCell
        label="Active Markets"
        value={loading ? '—' : `${stats?.activeMarkets ?? 0}+`}
        loading={loading}
      />

      <div className="w-px self-stretch flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />

      <DataCell
        label="24h Volume"
        value={loading ? '—' : formatCurrency(stats?.volume24h ?? 0, true)}
        accent="rgba(139,92,246,0.95)"
        loading={loading}
      />

      <div className="w-px self-stretch flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />

      <DataCell
        label="Trades (1h)"
        value={loading ? '—' : String(stats?.trades1h ?? 0)}
        accent="rgba(251,191,36,0.88)"
        loading={loading}
      />

      <div className="w-px self-stretch flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />

      <DataCell
        label="Top Category"
        value={loading ? '—' : (stats?.topCategory ?? '—')}
        sub={stats ? `${stats.topCategoryCount} trades` : undefined}
        accent={catColor}
        loading={loading}
      />
    </div>
  );
}
