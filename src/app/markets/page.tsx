'use client';

import { useEffect, useState } from 'react';
import type { TopMarket } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';

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

function MarketCard({ market }: { market: TopMarket }) {
  const price    = yesPrice(market);
  const volume   = vol24h(market);
  const liquidity = market.liquidityNum ?? 0;
  const href     = marketUrl(market.eventSlug, market.slug);
  const outcomes = parseJson(market.outcomes);
  const prices   = parseJson(market.outcomePrices);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group glass glass-hover gradient-border rounded-2xl p-5 flex flex-col gap-4 animate-fade-in-up"
    >
      <div className="flex items-start gap-3">
        {market.image ? (
          <img src={market.image} alt="" className="h-10 w-10 rounded-xl object-cover flex-shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center text-base"
            style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.25),rgba(37,99,235,0.25))', border: '1px solid rgba(139,92,246,0.2)' }}>
            📈
          </div>
        )}
        <p className="text-sm font-semibold text-white/85 line-clamp-2 leading-snug flex-1 group-hover:text-white transition-colors">
          {market.question}
        </p>
      </div>

      {/* Outcome prices */}
      {outcomes.length > 0 && prices.length > 0 && (
        <div className="flex gap-2">
          {outcomes.slice(0, 2).map((o, i) => {
            const p = parseFloat(prices[i] ?? '0');
            const isYes = /yes/i.test(o);
            return (
              <div key={o} className="flex-1 rounded-xl px-3 py-2 text-center"
                style={isYes
                  ? { background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }
                  : { background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.2)' }}>
                <p className={`text-xs font-semibold ${isYes ? 'text-white/40' : 'text-white/40'}`}>{o}</p>
                <p className={`text-base font-black ${isYes ? 'text-grad-profit' : 'text-grad-loss'}`}>
                  {isNaN(p) ? '—' : `${(p * 100).toFixed(0)}¢`}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Metrics */}
      <div className="flex items-center justify-between pt-1"
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

export default function MarketsPage() {
  const [markets, setMarkets] = useState<TopMarket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/markets/top')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMarkets(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-8">

      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block h-1 w-8 rounded-full"
            style={{ background: 'linear-gradient(90deg,#7c3aed,#2563eb)' }} />
          <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Polymarket</span>
        </div>
        <h1 className="text-4xl font-black leading-none tracking-tight sm:text-5xl">
          <span className="text-white">Top</span>{' '}
          <span className="text-grad">Markets</span>
        </h1>
        <p className="mt-3 text-sm text-white/40 max-w-lg">
          Highest-volume prediction markets on Polymarket right now, sorted by 24h trading volume.
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl h-52 animate-shimmer" />
          ))}
        </div>
      ) : markets.length === 0 ? (
        <div className="glass rounded-2xl py-24 text-center">
          <p className="text-3xl mb-3">📭</p>
          <p className="text-sm text-white/25">No market data available</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((m, i) => (
            <div key={m.id ?? i} style={{ animationDelay: `${i * 60}ms` }}>
              <MarketCard market={m} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
