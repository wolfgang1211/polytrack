'use client';

import { useEffect, useState, useCallback } from 'react';
import type { RecentTrade } from '@/types';
import { formatCurrency, formatAddress } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';

const REFRESH_MS = 30_000;

function timeAgo(ts: number | undefined): string {
  if (!ts) return '';
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function usdcSize(t: RecentTrade): number {
  if (t.usdcSize != null) return Number(t.usdcSize);
  if (t.size != null && t.price != null) return Number(t.size) * Number(t.price);
  if (t.amount   != null) return Number(t.amount);
  return 0;
}

function TradeRow({ trade }: { trade: RecentTrade }) {
  const amount = usdcSize(trade);
  const isBuy  = (trade.side ?? '').toUpperCase() === 'BUY';
  const ts     = trade.timestamp ?? trade.createdAt;
  const href   = marketUrl(trade.eventSlug, trade.slug);
  const wallet = trade.proxyWallet ? formatAddress(trade.proxyWallet, 6) : '—';

  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0 animate-fade-in"
      style={{ borderColor: 'rgba(255,255,255,0.05)' }}>

      {/* BUY / SELL badge */}
      <span
        className="flex-shrink-0 rounded-md px-2 py-0.5 text-[10px] font-black uppercase"
        style={isBuy
          ? { background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }
          : { background: 'rgba(251,113,133,0.12)', color: '#fb7185', border: '1px solid rgba(251,113,133,0.25)' }}
      >
        {isBuy ? 'BUY' : 'SELL'}
      </span>

      {/* Amount */}
      <span className="flex-shrink-0 text-sm font-black text-white w-20 text-right">
        {formatCurrency(amount, true)}
      </span>

      {/* Market title */}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0 text-xs text-white/50 hover:text-white/80 transition-colors truncate"
      >
        {trade.title ?? trade.asset ?? '—'}
      </a>

      {/* Wallet + time */}
      <div className="flex-shrink-0 text-right hidden sm:block">
        <p className="text-[10px] font-mono text-white/30">{wallet}</p>
        <p className="text-[10px] text-white/20">{timeAgo(ts)}</p>
      </div>
    </div>
  );
}

export default function RecentBigTrades() {
  const [trades, setTrades]   = useState<RecentTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(() => {
    fetch('/api/trades/recent')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) { setTrades(d); setLastUpdate(new Date()); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <section className="flex flex-col animate-fade-in-up" style={{ animationDelay: '150ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1 w-6 rounded-full"
            style={{ background: 'linear-gradient(90deg,#7c3aed,#2563eb)' }} />
          <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">Recent Trades <span className="normal-case text-white/30 font-normal">$1K+</span></h2>
          <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            Live
          </span>
        </div>
        {lastUpdate && (
          <span className="text-[10px] text-white/20">
            {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="glass rounded-2xl px-4 py-1 flex-1">
        {loading ? (
          <div className="flex flex-col gap-3 py-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-7 rounded-lg animate-shimmer" />
            ))}
          </div>
        ) : trades.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-xs text-white/25">No $1K+ trades found</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {trades.map((t, i) => <TradeRow key={t.id ?? i} trade={t} />)}
          </div>
        )}
      </div>
    </section>
  );
}
