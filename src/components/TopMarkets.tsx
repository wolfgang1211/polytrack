'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { TopMarket } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';

function parseJson(s: string | undefined): string[] {
  if (!s) return [];
  try { return JSON.parse(s); } catch { return []; }
}

function yesPrice(market: TopMarket): number | null {
  const prices = parseJson(market.outcomePrices);
  const outcomes = parseJson(market.outcomes);
  if (!prices.length) return null;
  const idx = outcomes.findIndex(o => /yes/i.test(o));
  const raw = prices[idx >= 0 ? idx : 0];
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
}

function vol24h(m: TopMarket): number {
  if (m.volume24hrNum != null) return m.volume24hrNum;
  const v = Number(m.volume24hr);
  return isNaN(v) ? 0 : v;
}

/** Drop resolved/closed markets: YES price pinned at 0¢ or 100¢, or end date past. */
function isLive(m: TopMarket): boolean {
  const p = yesPrice(m);
  if (p != null && (p <= 0.005 || p >= 0.995)) return false;
  if (m.endDate) {
    const end = new Date(m.endDate).getTime();
    if (!isNaN(end) && end < Date.now()) return false;
  }
  return true;
}

function MarketCard({ market, index }: { market: TopMarket; index: number }) {
  const price = yesPrice(market);
  const volume = vol24h(market);
  const href = marketUrl(market.eventSlug, market.slug);

  const priceColor =
    price == null ? 'text-white/40'
    : price >= 0.7  ? 'text-grad-profit'
    : price <= 0.3  ? 'text-grad-loss'
    : 'text-white';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group glass glass-hover gradient-border flex min-w-0 flex-col gap-3 rounded-2xl p-3 animate-fade-in-up sm:p-4"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start gap-3">
        {market.image ? (
          <img
            src={market.image}
            alt=""
            className="h-9 w-9 rounded-xl object-cover flex-shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="h-9 w-9 rounded-xl flex-shrink-0 flex items-center justify-center text-sm"
            style={{ background: 'var(--vi-grad-30)', border: '1px solid var(--vi-border-xs)' }}>
            📈
          </div>
        )}
        <p className="min-w-0 flex-1 text-xs font-semibold leading-relaxed text-white/80 line-clamp-2 transition-colors group-hover:text-white">
          {market.question}
        </p>
      </div>

      <div className="flex items-end justify-between mt-auto">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/25">YES</p>
          <p className={`text-xl font-black ${priceColor}`}>
            {price != null ? `${(price * 100).toFixed(0)}¢` : '—'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-white/25">24h Vol</p>
          <p className="text-sm font-bold text-white/60">{formatCurrency(volume, true)}</p>
        </div>
      </div>
    </a>
  );
}

interface TopMarketsProps {
  /** how many cards to render */
  limit?: number;
  /** show a "View All Markets →" button under the grid */
  showViewAll?: boolean;
}

export default function TopMarkets({ limit = 5, showViewAll = false }: TopMarketsProps) {
  const [markets, setMarkets] = useState<TopMarket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/markets/top')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMarkets(d.filter(isLive)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && markets.length === 0) return null;

  const shown = markets.slice(0, limit);
  const gridCols = limit > 6
    ? 'sm:grid-cols-3 lg:grid-cols-4'
    : 'sm:grid-cols-5';

  return (
    <section className="min-w-0 max-w-full animate-fade-in-up" style={{ animationDelay: '100ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1 w-6 rounded-full"
            style={{ background: 'linear-gradient(90deg,#7c3aed,#9333ea)' }} />
          <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">Top Markets</h2>
        </div>
        <span className="text-[10px] text-white/25 uppercase tracking-widest">24h Volume</span>
      </div>

      {loading ? (
        <div className={`grid grid-cols-2 gap-3 ${gridCols}`}>
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-4 h-28 animate-shimmer" />
          ))}
        </div>
      ) : (
        <div className={`grid grid-cols-2 gap-3 ${gridCols}`}>
          {shown.map((m, i) => <MarketCard key={m.id ?? i} market={m} index={i} />)}
        </div>
      )}

      {showViewAll && !loading && (
        <div className="mt-4 flex justify-center">
          <Link href="/markets"
            className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold text-white/80 transition-all hover:text-white hover:scale-[1.02]"
            style={{ background: 'var(--vi-tint)', border: '1px solid var(--vi-border-md)' }}>
            View All Markets →
          </Link>
        </div>
      )}
    </section>
  );
}
