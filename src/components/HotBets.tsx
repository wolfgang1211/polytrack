'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';
import type { HotMarket } from '@/app/api/markets/hot/route';

const PERIODS = ['1H', '6H', '12H', '24H'] as const;
type Period = typeof PERIODS[number];

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function HotMarketRow({ market, rank }: { market: HotMarket; rank: number }) {
  const href = marketUrl(market.eventSlug, market.slug);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 py-2.5 border-b last:border-0 transition-opacity hover:opacity-80 animate-fade-in"
      style={{ borderColor: 'rgba(255,255,255,0.05)' }}
    >
      {/* Rank */}
      <span className="flex-shrink-0 w-5 text-center text-[11px] font-black text-white/20 tabular-nums">
        {rank}
      </span>

      {/* Icon */}
      {market.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={market.icon} alt="" className="h-7 w-7 rounded-lg object-cover flex-shrink-0"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <div className="h-7 w-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs"
          style={{ background: 'var(--vi-tint)', border: '1px solid var(--vi-border-xs)' }}>
          🔥
        </div>
      )}

      {/* Title */}
      <span className="flex-1 min-w-0 text-xs text-white/70 truncate group-hover:text-white transition-colors">
        {market.title}
      </span>

      {/* Trade count */}
      <span
        className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums"
        style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}
      >
        {market.tradeCount} trades
      </span>

      {/* Volume */}
      <span className="flex-shrink-0 text-xs font-bold text-white/50 tabular-nums w-16 text-right">
        {formatCurrency(market.volume, true)}
      </span>

      {/* Last trade */}
      <span className="flex-shrink-0 text-[10px] text-white/20 w-12 text-right hidden sm:block">
        {timeAgo(market.lastTrade)}
      </span>
    </a>
  );
}

export default function HotBets() {
  const [period, setPeriod] = useState<Period>('24H');
  const [markets, setMarkets] = useState<HotMarket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/markets/hot?period=${period.toLowerCase()}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMarkets(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  if (!loading && markets.length === 0) return null;

  return (
    <section className="animate-fade-in-up" style={{ animationDelay: '120ms' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1 w-6 rounded-full"
            style={{ background: 'linear-gradient(90deg,#f59e0b,#ef4444)' }} />
          <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">
            Hot Bets
          </h2>
          <span className="text-base leading-none">🔥</span>
        </div>

        {/* Period tabs */}
        <div className="flex gap-0.5 rounded-xl glass p-0.5">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`relative rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all duration-150
                ${period === p ? 'text-white' : 'text-white/30 hover:text-white/60'}`}
            >
              {period === p && (
                <span className="absolute inset-0 rounded-lg"
                  style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.5),rgba(239,68,68,0.5))', border: '1px solid rgba(245,158,11,0.35)' }} />
              )}
              <span className="relative">{p}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table header */}
      <div className="glass rounded-2xl px-4 py-1">
        <div className="flex items-center gap-3 py-2 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <span className="w-5" />
          <span className="w-7" />
          <span className="flex-1 text-[10px] uppercase tracking-widest text-white/20 font-semibold">Market</span>
          <span className="text-[10px] uppercase tracking-widest text-white/20 font-semibold">Trades</span>
          <span className="w-16 text-right text-[10px] uppercase tracking-widest text-white/20 font-semibold">Vol</span>
          <span className="w-12 text-right text-[10px] uppercase tracking-widest text-white/20 font-semibold hidden sm:block">Last</span>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2 py-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 rounded-lg animate-shimmer" />
            ))}
          </div>
        ) : (
          <div>
            {markets.map((m, i) => (
              <HotMarketRow key={m.conditionId} market={m} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
