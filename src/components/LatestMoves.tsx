'use client';

import { useEffect, useState } from 'react';
import type { RecentTrade } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';

function timeAgo(ts: number | undefined): string {
  if (!ts) return '';
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)    return `${diff}s`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
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
  const priceC = trade.price != null ? Math.round(Number(trade.price) * 100) : null;
  const isYes  = (trade.outcome ?? '').toLowerCase() === 'yes' || trade.outcomeIndex === 0;
  const outcomeColor = trade.outcome
    ? (isYes ? '#34d399' : '#fb7185')
    : 'rgba(255,255,255,0.5)';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.035]"
    >
      {/* direction rail */}
      <span
        className="h-9 w-1 flex-shrink-0 rounded-full"
        style={{ background: isBuy ? '#34d399' : '#fb7185', opacity: 0.8 }}
      />

      {/* market icon */}
      <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06]">
        {trade.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={trade.icon} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-white/30">◧</div>
        )}
      </div>

      {/* market + meta */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-white/75 group-hover:text-white transition-colors">
          {trade.title ?? trade.asset ?? 'Unknown market'}
        </p>
        <div className="mt-1 flex items-center gap-2 text-[10px]">
          <span className="font-bold uppercase tracking-wide" style={{ color: isBuy ? '#34d399' : '#fb7185' }}>
            {isBuy ? 'Bought' : 'Sold'}
          </span>
          {trade.outcome && (
            <span className="font-semibold" style={{ color: outcomeColor }}>{trade.outcome}</span>
          )}
          {priceC != null && <span className="text-white/30">@ {priceC}¢</span>}
        </div>
      </div>

      {/* amount + time */}
      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-black tabular-nums text-white">{formatCurrency(amount, true)}</p>
        <p className="mt-0.5 text-[10px] text-white/25">{timeAgo(ts)} ago</p>
      </div>
    </a>
  );
}

export default function LatestMoves({ address }: { address: string }) {
  const [trades, setTrades] = useState<RecentTrade[]>([]);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch(`/api/trades/user/${address}`)
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : (d?.trades ?? []);
        if (Array.isArray(list)) { setTrades(list); setStale(Boolean(d?.stale)); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  if (!loading && trades.length === 0) return null;

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: '160ms' }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1 w-6 rounded-full" style={{ background: 'linear-gradient(90deg,#7c3aed,#2563eb)' }} />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">Latest Moves</h2>
          <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
            style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
            Copy-trade signal
          </span>
        </div>
        <span className="text-[10px] text-white/25">{stale ? 'Most recent activity' : 'Last 30 days'}</span>
      </div>

      <div className="glass rounded-2xl p-2">
        {loading ? (
          <div className="flex flex-col gap-2 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl animate-shimmer" />
            ))}
          </div>
        ) : (
          <div className="flex max-h-96 flex-col divide-y divide-white/[0.04] overflow-y-auto">
            {trades.map((t, i) => <MoveRow key={t.id ?? `${t.asset}-${i}`} trade={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}
