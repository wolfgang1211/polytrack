'use client';

import { useEffect, useState } from 'react';
import type { RecentTrade } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';

function timeAgo(ts: number | undefined): string {
  if (!ts) return '';
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function usdcSize(t: RecentTrade): number {
  if (t.usdcSize != null) return Number(t.usdcSize);
  if (t.size != null && t.price != null) return Number(t.size) * Number(t.price);
  if (t.amount != null) return Number(t.amount);
  return 0;
}

function MoveRow({ trade }: { trade: RecentTrade }) {
  const amount = usdcSize(trade);
  const isBuy  = (trade.side ?? '').toUpperCase() === 'BUY';
  const ts     = trade.timestamp ?? trade.createdAt;
  const href   = marketUrl(trade.eventSlug, trade.slug);

  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0"
      style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <span
        className="flex-shrink-0 rounded-md px-2 py-0.5 text-[10px] font-black uppercase"
        style={isBuy
          ? { background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }
          : { background: 'rgba(251,113,133,0.12)', color: '#fb7185', border: '1px solid rgba(251,113,133,0.25)' }}
      >
        {isBuy ? 'BUY' : 'SELL'}
      </span>

      {trade.outcome && (
        <span className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white/55"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {trade.outcome}
        </span>
      )}

      <span className="flex-shrink-0 text-sm font-black text-white w-20 text-right">
        {formatCurrency(amount, true)}
      </span>

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0 text-xs text-white/50 hover:text-white/80 transition-colors truncate"
      >
        {trade.title ?? trade.asset ?? '—'}
      </a>

      <span className="flex-shrink-0 text-[10px] text-white/20 hidden sm:block">{timeAgo(ts)}</span>
    </div>
  );
}

export default function LatestMoves({ address }: { address: string }) {
  const [trades, setTrades] = useState<RecentTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch(`/api/trades/user/${address}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setTrades(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  if (!loading && trades.length === 0) return null;

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: '160ms' }}>
      <div className="mb-3 flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Latest Moves</p>
        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white/30"
          style={{ background: 'rgba(255,255,255,0.05)' }}>copy-trade signal</span>
      </div>
      <div className="glass rounded-2xl px-4 py-1">
        {loading ? (
          <div className="flex flex-col gap-3 py-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-7 rounded-lg animate-shimmer" />
            ))}
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {trades.map((t, i) => <MoveRow key={t.id ?? i} trade={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}
