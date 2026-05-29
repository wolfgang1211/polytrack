'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RisingTrader } from '@/types';
import { formatCurrency, formatAddress } from '@/lib/utils';

const MEDALS = ['🥇', '🥈', '🥉'];

function TraderRow({ trader, index }: { trader: RisingTrader; index: number }) {
  const name    = trader.userName || (trader.xUsername ? `@${trader.xUsername}` : null) || formatAddress(trader.proxyWallet, 6);
  const pnl     = trader.pnl ?? 0;
  const rank    = parseInt(trader.rank ?? String(index + 1), 10);

  return (
    <Link
      href={`/wallet/${trader.proxyWallet}`}
      className="flex items-center gap-3 py-3 border-b last:border-0 group transition-opacity hover:opacity-80"
      style={{ borderColor: 'rgba(255,255,255,0.05)', animationDelay: `${index * 50}ms` }}
    >
      {/* Rank */}
      <span className="flex-shrink-0 text-base w-7 text-center">
        {rank <= 3 ? MEDALS[rank - 1] : (
          <span className="text-xs font-bold text-white/30">#{rank}</span>
        )}
      </span>

      {/* Name / address */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white/75 truncate group-hover:text-white transition-colors">{name}</p>
        {trader.userName || trader.xUsername ? (
          <p className="text-[10px] font-mono text-white/25 truncate">{formatAddress(trader.proxyWallet, 6)}</p>
        ) : null}
      </div>

      {/* Weekly PnL */}
      <div className="flex-shrink-0 text-right">
        <p className={`text-sm font-black ${pnl > 0 ? 'text-grad-profit' : pnl < 0 ? 'text-grad-loss' : 'text-white/40'}`}>
          {pnl >= 0 ? '+' : ''}{formatCurrency(pnl, true)}
        </p>
        <p className="text-[10px] text-white/25">this week</p>
      </div>
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

  return (
    <section className="flex flex-col animate-fade-in-up" style={{ animationDelay: '200ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1 w-6 rounded-full"
            style={{ background: 'linear-gradient(90deg,#f59e0b,#ef4444)' }} />
          <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">Rising Traders</h2>
        </div>
        <span className="text-[10px] text-white/25 uppercase tracking-widest">This Week</span>
      </div>

      <div className="glass rounded-2xl px-4 py-1 flex-1">
        {loading ? (
          <div className="flex flex-col gap-3 py-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg animate-shimmer" />
            ))}
          </div>
        ) : (
          <div>
            {traders.map((t, i) => <TraderRow key={t.proxyWallet} trader={t} index={i} />)}
          </div>
        )}
      </div>
    </section>
  );
}
