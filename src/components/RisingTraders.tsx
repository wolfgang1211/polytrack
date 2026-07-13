'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RisingTrader } from '@/types';
import { formatCurrency, formatAddress } from '@/lib/utils';

function TraderRow({ trader, index, maxPnl }: { trader: RisingTrader; index: number; maxPnl: number }) {
  const name  = trader.userName || (trader.xUsername ? `@${trader.xUsername}` : null) || formatAddress(trader.proxyWallet, 6);
  const pnl   = trader.pnl ?? 0;
  const rank  = parseInt(trader.rank ?? String(index + 1), 10);
  const barW  = maxPnl > 0 && pnl > 0 ? Math.min((pnl / maxPnl) * 100, 100) : 0;
  const isTop = rank <= 3;

  return (
    <Link
      href={`/wallet/${trader.proxyWallet}`}
      className="group flex flex-col py-2.5 transition-opacity hover:opacity-80"
      style={{
        borderBottom: 'none',
        animationDelay: `${index * 50}ms`,
      }}
    >
      <div className="flex items-center gap-2.5">
        {/* Rank */}
        <span className="flex-shrink-0 font-mono text-[11px] font-black tabular-nums w-5 text-right"
          style={{ color: isTop ? 'rgba(139,92,246,0.85)' : 'rgba(255,255,255,0.22)' }}>
          {String(rank).padStart(2, '0')}
        </span>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate transition-colors"
            style={{ color: 'rgba(255,255,255,0.72)' }}>
            {name}
          </p>
          {(trader.userName || trader.xUsername) && (
            <p className="font-mono text-[9px] truncate" style={{ color: 'rgba(255,255,255,0.22)' }}>
              {formatAddress(trader.proxyWallet, 6)}
            </p>
          )}
        </div>

        {/* PnL */}
        <div className="flex-shrink-0 text-right">
          <p className={`text-xs font-black tabular-nums font-mono ${pnl > 0 ? 'text-grad-profit' : pnl < 0 ? 'text-grad-loss' : ''}`}
            style={pnl === 0 ? { color: 'rgba(255,255,255,0.35)' } : undefined}>
            {pnl >= 0 ? '+' : ''}{formatCurrency(pnl, true)}
          </p>
        </div>
      </div>

      {/* PnL performance bar */}
      {barW > 0 && (
        <div className="mt-1.5 ml-7 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${barW}%`,
              background: isTop
                ? 'linear-gradient(90deg, rgba(139,92,246,0.75), rgba(139,92,246,0.30))'
                : 'linear-gradient(90deg, rgba(255,255,255,0.25), rgba(255,255,255,0.08))',
            }} />
        </div>
      )}
    </Link>
  );
}

export default function RisingTraders() {
  const [traders, setTraders] = useState<RisingTrader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/traders/rising')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setTraders(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && traders.length === 0) return null;

  const maxPnl = traders.reduce((m, t) => Math.max(m, t.pnl ?? 0), 0);

  return (
    <section className="flex min-w-0 max-w-full flex-col animate-fade-in-up" style={{ animationDelay: '200ms' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-1 w-5 rounded-full"
            style={{ background: 'linear-gradient(90deg,#f59e0b,#ef4444)' }} />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Rising Traders
          </span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.18)' }}>
          This Week
        </span>
      </div>

      <div className="rounded-xl px-4 py-1"
        style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
        {loading ? (
          <div className="flex flex-col gap-3 py-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg animate-shimmer" />
            ))}
          </div>
        ) : (
          <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
            {traders.map((t, i) => (
              <TraderRow key={t.proxyWallet} trader={t} index={i} maxPnl={maxPnl} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
