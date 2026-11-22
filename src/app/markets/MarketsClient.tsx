'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TopMarket } from '@/types';
import { formatCurrency, resolveCategory } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';
import TopMarkets from '@/components/TopMarkets';
import PolymarketTradeLink from '@/components/PolymarketTradeLink';
import { ExplorerCard, ExplorerDetails, ExplorerHeader, ExplorerToolbar } from './MarketExplorerUI';

/* ── helpers ───────────────────────────────────────────── */

function parseJson(s: string | undefined): string[] {
  if (!s) return [];
  try { return JSON.parse(s); } catch { return []; }
}

function vol24h(m: TopMarket): number {
  if (m.volume24hrNum != null) return m.volume24hrNum;
  const v = Number(m.volume24hr);
  return isNaN(v) ? 0 : v;
}

function closesIn(endDate?: string): string | null {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  if (isNaN(end)) return null;
  const ms = end - Date.now();
  if (ms <= 0) return 'Closed';
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hrs = Math.floor(ms / 3_600_000);
  if (hrs >= 1) return `${hrs}h`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m`;
}

const CATS = ['All', 'Politics', 'Crypto', 'Sports', 'Tech', 'World', 'Entertainment', 'Other'] as const;
type Cat = typeof CATS[number];

const SORTS = [
  { key: 'vol24h',    label: '24h Volume' },
  { key: 'volume',    label: 'Total Volume' },
  { key: 'liquidity', label: 'Liquidity' },
  { key: 'ending',    label: 'Closing Soon' },
  { key: 'newest',    label: 'Newest' },
] as const;
type SortKey = typeof SORTS[number]['key'];

const CAT_COLOR: Record<string, string> = {
  Politics: '#fb7185', Crypto: '#fbbf24', Sports: '#34d399',
  Tech: '#38bdf8', World: 'var(--text-secondary)', Entertainment: '#f472b6', Other: '#94a3b8',
};

function categoryText(m: Pick<TopMarket, 'category' | 'question' | 'slug' | 'eventSlug'>): string {
  return resolveCategory(m.category, m.question ?? '', `${m.slug ?? ''} ${m.eventSlug ?? ''}`);
}

/* ── card ──────────────────────────────────────────────── */

function MarketCard({ market }: { market: TopMarket & { category?: string } }) {
  const volume    = vol24h(market);
  const liquidity = market.liquidityNum ?? 0;
  const href      = marketUrl(market.eventSlug, market.slug, 'markets_explorer');
  const outcomes  = parseJson(market.outcomes);
  const prices    = parseJson(market.outcomePrices);
  const cat       = categoryText(market);
  const close     = closesIn(market.endDate);

  return (
    <ExplorerCard className="group glass-hover gradient-border h-full p-5 gap-4 animate-fade-in-up">
      <div className="flex items-start gap-3">
        {market.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={market.image} alt="" className="h-10 w-10 rounded-xl object-cover flex-shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center text-base"
            style={{ background: 'var(--accent-grad-25)', border: '1px solid var(--accent-border-xs)' }}>
            📈
          </div>
        )}
        <p className="text-sm font-semibold text-ink/85 line-clamp-2 leading-snug flex-1 group-hover:text-ink transition-colors">
          {market.question}
        </p>
      </div>

      {/* Tags */}
      <div className="flex items-center gap-2 -mt-1">
        <span className="rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider"
          style={{ background: `${CAT_COLOR[cat] ?? '#94a3b8'}1a`, color: CAT_COLOR[cat] ?? '#94a3b8', border: `1px solid ${CAT_COLOR[cat] ?? '#94a3b8'}33` }}>
          {cat}
        </span>
        {close && (
          <span className="flex items-center gap-1 text-xs font-semibold text-ink/55">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {close === 'Closed' ? 'Closed' : `${close} left`}
          </span>
        )}
      </div>

      {/* Outcome prices */}
      {outcomes.length > 0 && prices.length > 0 && (
        <div className="flex gap-2">
          {outcomes.slice(0, 2).map((o, i) => {
            const p = parseFloat(prices[i] ?? '0');
            const isYes = /yes/i.test(o) || i === 0;
            return (
              <div key={o + i} className="min-w-0 flex-1 rounded-xl px-3 py-2 text-center"
                style={isYes
                  ? { background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }
                  : { background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.2)' }}>
                <p className="text-xs font-semibold text-ink/55 truncate">{o}</p>
                <p className={`text-base font-black ${isYes ? 'text-grad-profit' : 'text-grad-loss'}`}>
                  {isNaN(p) ? '—' : `${(p * 100).toFixed(0)}¢`}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Metrics */}
      <div className="flex items-center justify-between pt-1 mt-auto"
        style={{ borderTop: '1px solid rgba(var(--ink-rgb),0.05)' }}>
        <div>
          <p className="text-xs text-ink/55 uppercase tracking-wider">24h Vol</p>
          <p className="text-sm font-bold text-ink/70">{formatCurrency(volume, true)}</p>
        </div>
        {liquidity > 0 && (
          <div className="text-right">
            <p className="text-xs text-ink/55 uppercase tracking-wider">Liquidity</p>
            <p className="text-sm font-bold text-ink/70">{formatCurrency(liquidity, true)}</p>
          </div>
        )}
      </div>
      <PolymarketTradeLink href={href} />
    </ExplorerCard>
  );
}

/* ── client view ───────────────────────────────────────── */

export default function MarketsClient({ initialMarkets }: { initialMarkets: TopMarket[] }) {
  const [markets, setMarkets] = useState<TopMarket[]>(initialMarkets);
  const [loading, setLoading] = useState(initialMarkets.length === 0);
  const [sort, setSort] = useState<SortKey>('vol24h');
  const [cat, setCat] = useState<Cat>('All');
  const [q, setQ] = useState('');
  // Deep pool fetched once (top by total volume) so category filters aren't
  // starved when one hot event dominates 24h volume.
  const [extra, setExtra] = useState<TopMarket[] | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (cat === 'All' || extra !== null) return;
    fetch('/api/markets/list?sort=volume&limit=200')
      .then(r => r.json())
      .then(d => setExtra(Array.isArray(d) ? d : []))
      .catch(() => setExtra([]));
  }, [cat, extra]);

  useEffect(() => {
    // Server already rendered the default sort — skip the duplicate fetch.
    if (firstRun.current) {
      firstRun.current = false;
      if (initialMarkets.length > 0 && sort === 'vol24h') return;
    }
    setLoading(true);
    fetch(`/api/markets/list?sort=${sort}&limit=120`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMarkets(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  // Merge the sorted list with the deep pool (deduped by id).
  const pool = useMemo(() => {
    if (!extra || extra.length === 0) return markets;
    const seen = new Set(markets.map(m => String(m.id)));
    return [...markets, ...extra.filter(m => !seen.has(String(m.id)))];
  }, [markets, extra]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const nowMs = Date.now();
    const result = pool.filter(m => {
      if (m.endDate) {
        const end = new Date(m.endDate).getTime();
        if (!isNaN(end) && end < nowMs - 3_600_000) return false;
      }
      const resolvedCat = categoryText(m);
      if (cat !== 'All' && resolvedCat !== cat) {
        return false;
      }
      const haystack = `${m.question ?? ''} ${m.slug ?? ''} ${m.eventSlug ?? ''} ${resolvedCat}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;
      return true;
    });
    // When the deep pool is merged in, re-sort client-side so appended
    // markets don't break the selected ordering ('newest' relies on the
    // server order — startDate isn't in the slim payload).
    if (extra && extra.length > 0 && sort !== 'newest') {
      const cmp: Record<Exclude<SortKey, 'newest'>, (a: TopMarket, b: TopMarket) => number> = {
        vol24h:    (a, b) => vol24h(b) - vol24h(a),
        volume:    (a, b) => (b.volumeNum ?? 0) - (a.volumeNum ?? 0),
        liquidity: (a, b) => (b.liquidityNum ?? 0) - (a.liquidityNum ?? 0),
        ending:    (a, b) => new Date(a.endDate ?? '9999-12-31').getTime() - new Date(b.endDate ?? '9999-12-31').getTime(),
      };
      result.sort(cmp[sort]);
    }
    return result;
  }, [pool, cat, q, sort, extra]);

  const totalVol = useMemo(() => filtered.reduce((s, m) => s + vol24h(m), 0), [filtered]);

  return (
    <div className="flex flex-col gap-6">

      <ExplorerHeader
        provider="Polymarket"
        title={<><span className="text-ink">Markets</span>{' '}<span className="text-grad">Explorer</span></>}
        description={`Browse ${pool.length || 'all'} active prediction markets. Search, filter by category, and sort by volume, liquidity or closing time.`}
      />

      {/* Featured stays one tap away but no longer pushes search and results below the fold. */}
      <ExplorerDetails summary="Featured markets" className="glass rounded-2xl px-4">
        <div className="pb-4">
          <TopMarkets campaignContext="markets_featured" />
        </div>
      </ExplorerDetails>

      <ExplorerToolbar label="Search and sort markets" className="lg:items-center">
        {/* Search */}
        <div className="relative flex min-w-0 items-center rounded-xl glass max-w-md flex-1">
          <svg className="absolute left-3 h-4 w-4 text-ink/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search markets…"
            aria-label="Search markets"
            className="min-h-[44px] w-full bg-transparent py-2.5 pl-9 pr-3 text-sm text-ink/80 placeholder-ink/25 outline-none"
          />
        </div>

        {/* Sort: wraps on narrow screens instead of overflowing. */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-ink/55 hidden sm:inline">Sort</span>
          <div className="flex min-w-0 flex-wrap gap-1 rounded-xl glass p-1">
            {SORTS.map(s => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={`min-h-[44px] rounded-lg px-2.5 text-xs font-semibold transition-all ${sort === s.key ? 'text-ink' : 'text-ink/55 hover:text-ink/80'}`}
                style={sort === s.key ? { background: 'var(--accent-fill)', border: '1px solid var(--accent-border-md)' } : { border: '1px solid transparent' }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </ExplorerToolbar>

      {/* Category chips + count */}
      <div className="flex flex-wrap items-center gap-2 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        {CATS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`min-h-[44px] rounded-full px-3 text-xs font-semibold transition-all ${cat === c ? 'text-ink' : 'text-ink/55 hover:text-ink/80'}`}
            style={cat === c
              ? { background: 'var(--accent-fill)', border: '1px solid var(--accent-border-lg)' }
              : { background: 'rgba(var(--ink-rgb),0.03)', border: '1px solid rgba(var(--ink-rgb),0.07)' }}
          >
            {c}
          </button>
        ))}
        <span className="ml-auto text-xs text-ink/55">
          {filtered.length} markets · {formatCurrency(totalVol, true)} 24h vol
        </span>
      </div>

      {/* Grid */}
      {loading || (cat !== 'All' && extra === null) ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl h-56 animate-shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl py-24 text-center">
          <p className="text-3xl mb-3">🔍</p>
          <p className="text-sm text-ink/55">No markets match your filters</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m, i) => (
            <div key={m.id ?? i} className="min-w-0" style={{ animationDelay: `${Math.min(i, 12) * 50}ms` }}>
              <MarketCard market={m} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
