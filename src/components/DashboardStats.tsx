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

function StatCard({
  label, value, sub, icon, gradient, loading,
}: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; gradient: string; loading: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3.5 animate-fade-in-up"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ background: gradient, border: '1px solid rgba(255,255,255,0.08)' }}>
        {icon}
      </div>
      <div className="min-w-0">
        {loading ? (
          <div className="h-5 w-16 rounded animate-shimmer mb-1" />
        ) : (
          <p className="text-base font-black text-white leading-none">{value}</p>
        )}
        <p className="text-[10px] uppercase tracking-widest text-white/30 mt-0.5 truncate">{label}</p>
        {sub && !loading && (
          <p className="text-[10px] text-white/20 truncate">{sub}</p>
        )}
      </div>
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
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">

      {/* Active Markets */}
      <StatCard
        label="Active Markets"
        value={loading ? '—' : `${stats?.activeMarkets ?? 0}+`}
        loading={loading}
        gradient="rgba(147,51,234,0.18)"
        icon={
          <svg style={{ width: 16, height: 16 }} className="text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        }
      />

      {/* 24h Volume */}
      <StatCard
        label="24h Volume"
        value={loading ? '—' : formatCurrency(stats?.volume24h ?? 0, true)}
        loading={loading}
        gradient="var(--vi-fill)"
        icon={
          <svg style={{ width: 16, height: 16 }} className="text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }
      />

      {/* 1h Trades */}
      <StatCard
        label="Trades (1h)"
        value={loading ? '—' : String(stats?.trades1h ?? 0)}
        loading={loading}
        gradient="rgba(245,158,11,0.15)"
        icon={
          <svg style={{ width: 16, height: 16 }} className="text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        }
      />

      {/* Top Category */}
      <StatCard
        label="Hottest Category"
        value={loading ? '—' : (stats?.topCategory ?? '—')}
        sub={stats ? `${stats.topCategoryCount} trades` : undefined}
        loading={loading}
        gradient={`${catColor}22`}
        icon={
          <svg style={{ width: 16, height: 16, color: catColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
          </svg>
        }
      />
    </div>
  );
}
