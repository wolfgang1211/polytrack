'use client';

import { useEffect, useState } from 'react';
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
      className="group glass glass-hover gradient-border rounded-2xl p-4 flex flex-col gap-3 min-w-[220px] sm:min-w-0 animate-fade-in-up"
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
            style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.3),rgba(147,51,234,0.3))', border:'1px solid rgba(139,92,246,0.2)' }}>
            📈
          </div>
        )}
        <p className="text-xs font-semibold text-white/80 line-clamp-2 leading-relaxed flex-1 group-hover:text-white transition-colors">
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

export default function TopMarkets() {
  const [markets, setMarkets] = useState<TopMarket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/markets/top')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMarkets(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && markets.length === 0) return null;

  return (
    <section className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1 w-6 rounded-full"
            style={{ background: 'linear-gradient(90deg,#7c3aed,#9333ea)' }} />
          <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">Top Markets</h2>
        </div>
        <span className="text-[10px] text-white/25 uppercase tracking-widest">24h Volume</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-4 h-28 animate-shimmer" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-5 sm:overflow-visible scrollbar-hide">
          {markets.map((m, i) => <MarketCard key={m.id ?? i} market={m} index={i} />)}
        </div>
      )}
    </section>
  );
}
