'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import RewardFarms from './RewardFarms';
import { KalshiFarmsTable, KalshiPoolRankings, KalshiScoringFormula, useKalshiRewards } from './KalshiRewardFarms';

/* Reward farms for both venues: a side-by-side summary, then one platform's screener at a time.
   The Polymarket screener is rendered unchanged; Kalshi uses the same view, ranking and metrics. */

type Platform = 'polymarket' | 'kalshi';
interface PolySummary { farms: { estApr: number }[] }
interface PolyUniverse { totalDailyRewards: number; marketsWithRewards: number }

function Summary({ label, active, daily, markets, bestApr, loading, note }: {
  label: string; active: boolean; daily: number | null; markets: number | null; bestApr: number | null; loading: boolean; note: string;
}) {
  const v = (x: string | null) => (loading ? '…' : x ?? '—');
  return (
    <div className="flex-1 min-w-[240px] rounded-2xl p-4" data-platform-summary={label}
      style={{ background: active ? 'var(--accent-fill)' : 'rgba(var(--ink-rgb),0.02)', border: `1px solid ${active ? 'var(--accent-border-md)' : 'rgba(var(--ink-rgb),0.07)'}` }}>
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-ink/60">{label}</p>
      <dl className="flex flex-wrap gap-x-5 gap-y-2">
        <div><dt className="text-[10px] text-ink/55">Daily pools</dt><dd className="text-sm font-black tabular-nums text-ink">{v(daily != null ? `${formatCurrency(daily, true)}/d` : null)}</dd></div>
        <div><dt className="text-[10px] text-ink/55">Markets</dt><dd className="text-sm font-black tabular-nums text-ink">{v(markets != null ? markets.toLocaleString('en-US') : null)}</dd></div>
        <div><dt className="text-[10px] text-ink/55">Top est. APR</dt><dd className="text-sm font-black tabular-nums text-ink">{v(bestApr != null ? (bestApr >= 1000 ? '>999%' : `${bestApr.toFixed(0)}%`) : null)}</dd></div>
      </dl>
      <p className="mt-2 text-[10px] text-ink/55">{note}</p>
    </div>
  );
}

export default function RewardFarmsCompare() {
  const [platform, setPlatform] = useState<Platform>('polymarket');
  const [poly, setPoly] = useState<PolySummary | null>(null);
  const [polyLoading, setPolyLoading] = useState(true);
  const [universe, setUniverse] = useState<PolyUniverse | null>(null);
  const [universeLoading, setUniverseLoading] = useState(true);
  const kalshi = useKalshiRewards();

  useEffect(() => {
    fetch('/api/liquidity/rewards')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.farms)) setPoly(d); })
      .catch(() => {})
      .finally(() => setPolyLoading(false));
    fetch('/api/liquidity/rewards/universe')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && typeof d.totalDailyRewards === 'number') setUniverse(d); })
      .catch(() => {})
      .finally(() => setUniverseLoading(false));
  }, []);

  // Top est. APR leaves out thin / uncontested markets (≥ 1,000%) on both sides, so the comparison is like for like.
  const maxApr = (farms: { estApr: number }[] | undefined) => {
    const normal = (farms ?? []).map(f => f.estApr).filter(a => a < 1000);
    return normal.length ? Math.max(...normal) : null;
  };
  const tab = (p: Platform, label: string) => (
    <button type="button" role="tab" aria-selected={platform === p} onClick={() => setPlatform(p)}
      className={`inline-flex min-h-[44px] items-center rounded-lg px-3 text-xs font-semibold transition-colors ${platform === p ? 'text-ink' : 'text-ink/55 hover:text-ink/80'}`}
      style={platform === p ? { background: 'var(--accent-fill)', border: '1px solid var(--accent-border-md)' } : { border: '1px solid transparent' }}>
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4" data-reward-compare="">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-widest text-ink/55">Reward farms</span>
        <div role="tablist" aria-label="Reward farm platform" className="flex gap-1 rounded-xl glass p-1">
          {tab('polymarket', 'Polymarket')}
          {tab('kalshi', 'Kalshi')}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Summary label="Polymarket" active={platform === 'polymarket'} loading={universeLoading || polyLoading}
          daily={universe?.totalDailyRewards ?? null} markets={universe?.marketsWithRewards ?? null} bestApr={maxApr(poly?.farms)}
          note="Pools: every market with an active reward. Top APR: from the screener's top ~400 markets by liquidity and volume, thin markets excluded." />
        <Summary label="Kalshi" active={platform === 'kalshi'} loading={kalshi.loading}
          daily={kalshi.data?.totalDailyRewards ?? null} markets={kalshi.data?.marketsWithRewards ?? null} bestApr={maxApr(kalshi.data?.farms)}
          note="Pools: every active liquidity program. Top APR: thin markets (est. 1,000%+) excluded." />
      </div>
      {platform === 'polymarket' ? <RewardFarms /> : (
        <section>
          <div className="flex items-center gap-3 mb-5">
            <span className="font-mono text-[10px] font-black tracking-widest" style={{ color: 'var(--text-muted)' }}>[03b]</span>
            <div className="h-px w-12" style={{ background: 'var(--accent-border)' }} />
            <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)' }}>Reward Farming — Kalshi Pools</span>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--accent-border), transparent)' }} />
          </div>
          <KalshiFarmsTable data={kalshi.data} loading={kalshi.loading} />
          <KalshiPoolRankings data={kalshi.data} />
          <KalshiScoringFormula />
        </section>
      )}
    </div>
  );
}
