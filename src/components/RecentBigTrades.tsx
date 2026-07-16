'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { RecentTrade } from '@/types';
import { formatCurrency, formatAddress } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';

const REFRESH_MS = 15_000;
const WHALE = 10_000;

function timeAgo(ts: number | undefined): string {
  if (!ts) return '';
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)   return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

function usdcSize(t: RecentTrade): number {
  if (t.usdcSize != null) return Number(t.usdcSize);
  if (t.size != null && t.price != null) return Number(t.size) * Number(t.price);
  if (t.amount   != null) return Number(t.amount);
  return 0;
}

function TradeRow({ trade, fresh, maxAmount }: { trade: RecentTrade; fresh: boolean; maxAmount: number }) {
  const amount  = usdcSize(trade);
  const isBuy   = (trade.side ?? '').toUpperCase() === 'BUY';
  const ts      = trade.timestamp ?? trade.createdAt;
  const href    = marketUrl(trade.eventSlug, trade.slug, 'home_recent_trades');
  const wallet  = trade.proxyWallet ? formatAddress(trade.proxyWallet, 6) : '—';
  const isWhale = amount >= WHALE;
  const accent  = isBuy ? '#34d399' : '#fb7185';
  const barPct  = maxAmount > 0 ? Math.min((amount / maxAmount) * 100, 100) : 0;

  return (
    <div className={`group relative flex min-w-0 items-center gap-2 py-1.5 pl-3 pr-2 rounded-md transition-colors hover:bg-white/[0.03] ${fresh ? 'animate-flash' : 'animate-fade-in'}`}>
      {/* side strip */}
      <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full" style={{ background: accent }} />

      {/* Amount bar — subtle background layer */}
      <div className="absolute inset-y-0 left-0 rounded-md pointer-events-none"
        style={{ width: `${barPct}%`, background: `${accent}09`, transition: 'width 0.6s ease' }} />

      {/* BUY / SELL badge */}
      <span className="relative flex-shrink-0 font-mono text-[9px] font-black uppercase w-9 text-center rounded px-1 py-0.5"
        style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}38` }}>
        {isBuy ? 'BUY' : 'SELL'}
      </span>

      {/* Amount */}
      <span className="relative flex-shrink-0 flex items-center gap-1 w-[76px] justify-end text-right">
        {isWhale && <span title="Whale" className="text-[10px]">🐋</span>}
        <span className={`font-mono text-xs font-black tabular-nums ${isWhale ? 'text-grad' : ''}`}
          style={{ color: isWhale ? undefined : 'rgba(255,255,255,0.88)' }}>
          {formatCurrency(amount, true)}
        </span>
      </span>

      {/* Market title */}
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="relative flex-1 min-w-0 text-[11px] transition-colors truncate hover:opacity-80"
        style={{ color: 'rgba(255,255,255,0.48)' }}>
        {trade.title ?? trade.asset ?? '—'}
      </a>

      {/* Wallet + time */}
      <div className="relative flex-shrink-0 text-right hidden sm:block w-[52px]">
        <a href={trade.proxyWallet ? `/wallet/${trade.proxyWallet.toLowerCase()}` : undefined}
          className="font-mono text-[9px] block truncate hover:opacity-80"
          style={{ color: 'rgba(255,255,255,0.28)' }}>
          {wallet}
        </a>
        <p className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.18)' }}>{timeAgo(ts)}</p>
      </div>
    </div>
  );
}

export default function RecentBigTrades() {
  const [trades, setTrades]         = useState<RecentTrade[]>([]);
  const [belowThreshold, setBelowThreshold] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [freshIds, setFreshIds]     = useState<Set<string>>(new Set());
  const seen       = useRef<Set<string>>(new Set());
  const firstLoad  = useRef(true);

  const keyOf = (t: RecentTrade, i: number) =>
    String(t.id ?? `${t.proxyWallet ?? ''}-${t.timestamp ?? t.createdAt ?? ''}-${i}`);

  const load = useCallback(() => {
    fetch('/api/trades/recent')
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : (d?.trades ?? []);
        if (!Array.isArray(list)) return;
        setBelowThreshold(Array.isArray(d) ? false : Boolean(d?.belowThreshold));
        setLastUpdate(new Date());

        const fresh = new Set<string>();
        list.forEach((t: RecentTrade, i: number) => {
          const k = keyOf(t, i);
          if (!firstLoad.current && !seen.current.has(k)) fresh.add(k);
          seen.current.add(k);
        });
        firstLoad.current = false;
        setTrades(list);
        if (fresh.size) {
          setFreshIds(fresh);
          setTimeout(() => setFreshIds(new Set()), 1200);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const maxAmount = trades.reduce((m, t) => Math.max(m, usdcSize(t)), 0);

  return (
    <section className="flex min-w-0 max-w-full flex-col animate-fade-in-up" style={{ animationDelay: '150ms' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] font-bold"
            style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.20)' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            Live
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Activity {belowThreshold ? '' : <span style={{ color: 'rgba(255,255,255,0.20)' }}>$1K+</span>}
          </span>
        </div>
        {lastUpdate && (
          <span className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.18)' }}>
            {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
        {loading ? (
          <div className="flex flex-col gap-1.5 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-8 rounded-md animate-shimmer" />
            ))}
          </div>
        ) : trades.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-2xl mb-2">📭</p>
            <p className="font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.22)' }}>No recent trades</p>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto p-1.5">
            {trades.map((t, i) => {
              const k = keyOf(t, i);
              return <TradeRow key={k} trade={t} fresh={freshIds.has(k)} maxAmount={maxAmount} />;
            })}
          </div>
        )}
      </div>
    </section>
  );
}
