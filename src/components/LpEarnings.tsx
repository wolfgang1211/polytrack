'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';

/* LP Earnings (LH-8) — realized spread capture from the wallet's MAKER fills.
   Data: /api/wallet/[address]/lp (Graph maker-fill replay). The whole section
   renders nothing when the wallet has no maker activity, so regular taker
   wallets keep a clean page. */

interface LpMarketRow {
  id: string;
  title: string | null;
  outcome: string | null;
  realized: number;
  volume: number;
  fills: number;
  invShares: number;
  invCost: number;
  lastTs: number;
}

interface LpData {
  available: boolean;
  realized: number;
  makerVolume: number;
  fills: number;
  marketCount: number;
  buyVolume: number;
  sellVolume: number;
  firstTs: number | null;
  lastTs: number | null;
  markets: LpMarketRow[];
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 3600)   return `${Math.max(1, Math.floor(diff / 60))}m`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function pnlClass(v: number): string {
  return v > 0 ? 'text-grad-profit' : v < 0 ? 'text-grad-loss' : 'text-white/40';
}

export default function LpEarnings({ address }: { address: string }) {
  const [data, setData] = useState<LpData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    let live = true;
    setLoading(true);
    setData(null);

    fetch(`/api/wallet/${address}/lp`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: LpData) => { if (live && d?.available) setData(d); })
      .catch(() => {})
      .finally(() => { if (live) setLoading(false); });

    return () => { live = false; };
  }, [address]);

  // No maker fills → not an LP wallet → keep the page clean.
  if (!loading && (!data || data.fills === 0)) return null;

  const bps = data && data.makerVolume > 0 ? (data.realized / data.makerVolume) * 10000 : null;

  return (
    <div className="glass gradient-border animate-fade-in-up rounded-2xl p-5" style={{ animationDelay: '160ms' }}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">LP Earnings</p>
          <p className="mt-0.5 text-[10px] text-white/25">
            Realized spread from maker fills · excludes liquidity reward payouts
          </p>
        </div>
        {data?.lastTs != null && (
          <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-white/45"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            last fill {timeAgo(data.lastTs)} ago
          </span>
        )}
      </div>

      {loading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-white/[0.04]" />
          ))}
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] uppercase tracking-wider text-white/30">Spread P&L</p>
              <p className={`mt-1 text-lg font-black tabular-nums ${pnlClass(data.realized)}`}>
                {data.realized >= 0 ? '+' : ''}{formatCurrency(data.realized, true)}
              </p>
              {bps != null && (
                <p className="text-[10px] text-white/25">{bps >= 0 ? '+' : ''}{bps.toFixed(1)} bps of volume</p>
              )}
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] uppercase tracking-wider text-white/30">Maker Volume</p>
              <p className="mt-1 text-lg font-black tabular-nums text-white">{formatCurrency(data.makerVolume, true)}</p>
              <p className="text-[10px] text-white/25">
                {formatCurrency(data.buyVolume, true)} buy · {formatCurrency(data.sellVolume, true)} sell
              </p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] uppercase tracking-wider text-white/30">Maker Fills</p>
              <p className="mt-1 text-lg font-black tabular-nums text-white">{data.fills.toLocaleString()}</p>
              <p className="text-[10px] text-white/25">orders filled as maker</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] uppercase tracking-wider text-white/30">Markets</p>
              <p className="mt-1 text-lg font-black tabular-nums text-white">{data.marketCount.toLocaleString()}</p>
              <p className="text-[10px] text-white/25">quoted with resting orders</p>
            </div>
          </div>

          {/* Per-market breakdown */}
          {data.markets.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                Top markets by maker volume
              </p>
              <div className="flex flex-col gap-1">
                {data.markets.map(m => {
                  const share = data.makerVolume > 0 ? (m.volume / data.makerVolume) * 100 : 0;
                  return (
                    <div key={m.id} className="rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.035]">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-white/75">
                            {m.title ?? `Token …${m.id.slice(-8)}`}
                            {m.outcome && (
                              <span className="ml-1.5 font-semibold"
                                style={{ color: m.outcome.toLowerCase() === 'yes' ? '#34d399' : '#fb7185' }}>
                                {m.outcome}
                              </span>
                            )}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-white/30">
                            <span>{m.fills.toLocaleString()} fills</span>
                            <span>·</span>
                            <span>{formatCurrency(m.volume, true)} vol</span>
                            {m.invShares > 0 && (
                              <>
                                <span>·</span>
                                <span>{formatCurrency(m.invCost, true)} open inventory</span>
                              </>
                            )}
                            <span>·</span>
                            <span>{timeAgo(m.lastTs)} ago</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className={`text-sm font-black tabular-nums ${pnlClass(m.realized)}`}>
                            {m.realized >= 0 ? '+' : ''}{formatCurrency(m.realized, true)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-white/25">{share.toFixed(0)}% of vol</p>
                        </div>
                      </div>
                      {/* volume share bar */}
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="h-full rounded-full"
                          style={{
                            width: `${Math.max(2, share)}%`,
                            background: m.realized >= 0
                              ? 'linear-gradient(90deg, rgba(52,211,153,0.7), rgba(52,211,153,0.35))'
                              : 'linear-gradient(90deg, rgba(251,113,133,0.7), rgba(251,113,133,0.35))',
                          }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
