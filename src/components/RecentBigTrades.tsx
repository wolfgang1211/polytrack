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

function TradeRow({ trade, fresh }: { trade: RecentTrade; fresh: boolean }) {
  const amount = usdcSize(trade);
  const isBuy  = (trade.side ?? '').toUpperCase() === 'BUY';
  const ts     = trade.timestamp ?? trade.createdAt;
  const href   = marketUrl(trade.eventSlug, trade.slug);
  const wallet = trade.proxyWallet ? formatAddress(trade.proxyWallet, 6) : '—';
  const isWhale = amount >= WHALE;
  const accent = isBuy ? '#34d399' : '#fb7185';

  return (
    <div
      className={`group relative flex items-center gap-2.5 py-2 pl-3 pr-2 rounded-lg transition-colors hover:bg-white/[0.03] ${fresh ? 'animate-flash' : 'animate-fade-in'}`}
    >
      {/* side strip */}
      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full" style={{ background: accent }} />

      {/* market icon */}
      {trade.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={trade.icon} alt="" className="h-7 w-7 flex-shrink-0 rounded-lg object-cover"
          style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.08)' }} />
      ) : (
        <span className="h-7 w-7 flex-shrink-0 rounded-lg"
          style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.4),rgba(147,51,234,0.4))' }} />
      )}

      {/* BUY / SELL */}
      <span className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase w-11 text-center"
        style={{ background: `${accent}1f`, color: accent, border: `1px solid ${accent}40` }}>
        {isBuy ? 'BUY' : 'SELL'}
      </span>

      {/* Amount + whale */}
      <span className="flex-shrink-0 flex items-center gap-1 w-[88px] justify-end text-right">
        {isWhale && <span title="Whale trade" className="text-[11px]">🐋</span>}
        <span className={`text-sm font-black tabular-nums ${isWhale ? 'text-grad' : 'text-white/90'}`}>
          {formatCurrency(amount, true)}
        </span>
      </span>

      {/* Market title */}
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="flex-1 min-w-0 text-xs text-white/50 hover:text-white/85 transition-colors truncate">
        {trade.title ?? trade.asset ?? '—'}
      </a>

      {/* Wallet + time */}
      <a
        href={trade.proxyWallet ? `/wallet/${trade.proxyWallet.toLowerCase()}` : undefined}
        className="flex-shrink-0 text-right hidden sm:block hover:opacity-80"
      >
        <p className="text-[10px] font-mono text-white/35">{wallet}</p>
        <p className="text-[10px] text-white/20">{timeAgo(ts)}</p>
      </a>
    </div>
  );
}

export default function RecentBigTrades() {
  const [trades, setTrades]   = useState<RecentTrade[]>([]);
  const [belowThreshold, setBelowThreshold] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

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

  return (
    <section className="flex flex-col animate-fade-in-up" style={{ animationDelay: '150ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1 w-6 rounded-full"
            style={{ background: 'linear-gradient(90deg,#7c3aed,#9333ea)' }} />
          <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">Live Activity <span className="normal-case text-white/30 font-normal">{belowThreshold ? 'top recent' : '$1K+'}</span></h2>
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

      <div className="glass rounded-2xl px-2 py-1.5 flex-1">
        {loading ? (
          <div className="flex flex-col gap-2 py-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-9 rounded-lg animate-shimmer" />
            ))}
          </div>
        ) : trades.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-xs text-white/25">No recent trades available</p>
          </div>
        ) : (
          <div className="max-h-[380px] overflow-y-auto pr-0.5">
            {trades.map((t, i) => {
              const k = keyOf(t, i);
              return <TradeRow key={k} trade={t} fresh={freshIds.has(k)} />;
            })}
          </div>
        )}
      </div>
    </section>
  );
}
