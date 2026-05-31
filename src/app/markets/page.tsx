'use client';

import { useEffect, useMemo, useState } from 'react';
import type { TopMarket } from '@/types';
import { formatCurrency, resolveCategory } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';

/* ── helpers ───────────────────────────────────────────── */

function parseJson(s: string | undefined): string[] {
  if (!s) return [];
  try { return JSON.parse(s); } catch { return []; }
}

function yesPrice(m: TopMarket): number | null {
  const prices   = parseJson(m.outcomePrices);
  const outcomes = parseJson(m.outcomes);
  if (!prices.length) return null;
  const idx = outcomes.findIndex(o => /yes/i.test(o));
  const n = parseFloat(prices[idx >= 0 ? idx : 0]);
  return isNaN(n) ? null : n;
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
  Tech: '#38bdf8', World: '#a78bfa', Entertainment: '#f472b6', Other: '#94a3b8',
};

/* ── card ──────────────────────────────────────────────── */

function MarketCard({ market }: { market: TopMarket & { category?: string } }) {
  const price     = yesPrice(market);
  const volume    = vol24h(market);
  const liquidity = market.liquidityNum ?? 0;
  const href      = marketUrl(market.eventSlug, market.slug);
  const outcomes  = parseJson(market.outcomes);
  const prices    = parseJson(market.outcomePrices);
  const cat       = resolveCategory(market.category, market.question ?? '');
  const close     = closesIn(market.endDate);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group glass glass-hover gradient-border rounded-2xl p-5 flex flex-col gap-4 animate-fade-in-up"
    >
      <div className="flex items-start gap-3">
        {market.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={market.image} alt="" className="h-10 w-10 rounded-xl object-cover flex-shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center text-base"
            style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.25),rgba(147,51,234,0.25))', border: '1px solid rgba(139,92,246,0.2)' }}>
            📈
          </div>
        )}
        <p className="text-sm font-semibold text-white/85 line-clamp-2 leading-snug flex-1 group-hover:text-white transition-colors">
          {market.question}
        </p>
      </div>

      {/* Tags */}
      <div className="flex items-center gap-2 -mt-1">
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: `${CAT_COLOR[cat] ?? '#94a3b8'}1a`, color: CAT_COLOR[cat] ?? '#94a3b8', border: `1px solid ${CAT_COLOR[cat] ?? '#94a3b8'}33` }}>
          {cat}
        </span>
        {close && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-white/35">
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
              <div key={o + i} className="flex-1 rounded-xl px-3 py-2 text-center"
                style={isYes
                  ? { background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }
                  : { background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.2)' }}>
                <p className="text-[11px] font-semibold text-white/40 truncate">{o}</p>
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
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <p className="text-[10px] text-white/25 uppercase tracking-wider">24h Vol</p>
          <p className="text-sm font-bold text-white/70">{formatCurrency(volume, true)}</p>
        </div>
        {liquidity > 0 && (
          <div className="text-right">
            <p className="text-[10px] text-white/25 uppercase tracking-wider">Liquidity</p>
            <p className="text-sm font-bold text-white/70">{formatCurrency(liquidity, true)}</p>
          </div>
        )}
        <svg className="h-4 w-4 text-white/20 group-hover:text-white/50 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </div>
    </a>
  );
}

/* ── page ──────────────────────────────────────────────── */

export default function MarketsPage() {
  const [markets, setMarkets] = useState<TopMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>('vol24h');
  const [cat, setCat] = useState<Cat>('All');
  const [q, setQ] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/markets/list?sort=${sort}&limit=120`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMarkets(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sort]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const nowMs = Date.now();
    return markets.filter(m => {
      if (m.endDate) {
        const end = new Date(m.endDate).getTime();
        if (!isNaN(end) && end < nowMs - 3_600_000) return false;
      }
      if (cat !== 'All' && resolveCategory(m.category, m.question ?? '') !== cat) return false;
      if (query && !(m.question ?? '').toLowerCase().includes(query)) return false;
      return true;
    });
  }, [markets, cat, q]);

  const totalVol = useMemo(() => filtered.reduce((s, m) => s + vol24h(m), 0), [filtered]);

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block h-1 w-8 rounded-full"
            style={{ background: 'linear-gradient(90deg,#7c3aed,#9333ea)' }} />
          <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Polymarket · Live</span>
        </div>
        <h1 className="text-3xl font-black leading-none tracking-tight sm:text-4xl">
          <span className="text-white">Markets</span>{' '}
          <span className="text-grad">Explorer</span>
        </h1>
        <p className="mt-2 text-sm text-white/40 max-w-lg">
          Browse {markets.length || '120+'} active prediction markets — search, filter by category, and sort by volume, liquidity or closing time.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between animate-fade-in-up" style={{ animationDelay: '60ms' }}>
        {/* Search */}
        <div className="relative flex items-center rounded-xl glass max-w-md flex-1">
          <svg className="absolute left-3 h-4 w-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search markets…"
            className="w-full bg-transparent py-2.5 pl-9 pr-3 text-sm text-white/80 placeholder-white/25 outline-none"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] uppercase tracking-widest text-white/30 hidden sm:inline">Sort</span>
          <div className="flex gap-1 rounded-xl glass p-1">
            {SORTS.map(s => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all ${sort === s.key ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
                style={sort === s.key ? { background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.3)' } : { border: '1px solid transparent' }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category chips + count */}
      <div className="flex flex-wrap items-center gap-2 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        {CATS.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${cat === c ? 'text-white' : 'text-white/45 hover:text-white/75'}`}
            style={cat === c
              ? { background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.35)' }
              : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {c}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-white/30">
          {filtered.length} markets · {formatCurrency(totalVol, true)} 24h vol
        </span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl h-56 animate-shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl py-24 text-center">
          <p className="text-3xl mb-3">🔍</p>
          <p className="text-sm text-white/25">No markets match your filters</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m, i) => (
            <div key={m.id ?? i} style={{ animationDelay: `${Math.min(i, 12) * 50}ms` }}>
              <MarketCard market={m} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
