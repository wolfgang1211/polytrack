'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import type { OverviewStats } from '@/app/api/stats/overview/route';
import { useLanguage } from '@/components/LanguageProvider';

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
    <div className="flex min-w-0 flex-col justify-center px-3 py-4 sm:px-5">
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
  const { t } = useLanguage();

  useEffect(() => {
    fetch('/api/stats/overview')
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const catColor = stats ? (CAT_COLOR[stats.topCategory] ?? '#94a3b8') : '#94a3b8';
  const categoryLabel = stats ? t(`categories.${stats.topCategory}`, stats.topCategory) : '—';

  return (
    <div data-testid="dashboard-stats" className="grid min-w-0 grid-cols-2 overflow-hidden animate-fade-in-up sm:grid-cols-4"
      style={{
        background: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>

      <div className="min-w-0 border-b border-r sm:border-b-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <DataCell label={t('common.activeMarkets')} value={stats ? `${stats.activeMarkets}+` : '—'} loading={loading} />
      </div>
      <div className="min-w-0 border-b sm:border-b-0 sm:border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <DataCell label={t('common.volume24h')} value={stats ? formatCurrency(stats.volume24h, true) : '—'} accent="rgba(139,92,246,0.95)" loading={loading} />
      </div>
      <div className="min-w-0 border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <DataCell label={t('common.trades1h')} value={stats ? String(stats.trades1h) : '—'} accent="rgba(251,191,36,0.88)" loading={loading} />
      </div>
      <div className="min-w-0">
        <DataCell label={t('common.topCategory')} value={loading ? '—' : categoryLabel} sub={stats ? `${stats.topCategoryCount} ${t('common.trades')}` : undefined} accent={catColor} loading={loading} />
      </div>
    </div>
  );
}
