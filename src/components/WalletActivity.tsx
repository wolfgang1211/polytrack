'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid,
} from 'recharts';
import type { RecentTrade, Position } from '@/types';
import { detectCategory, formatCurrency, positionPnl } from '@/lib/utils';

/* ─────────────────────────── helpers ─────────────────────────── */

function tsOf(t: RecentTrade): number {
  return Number(t.timestamp ?? t.createdAt ?? 0);
}
function isBuy(t: RecentTrade): boolean {
  return (t.side ?? '').toUpperCase() === 'BUY';
}
function isYes(t: RecentTrade): boolean {
  return (t.outcome ?? '').toLowerCase() === 'yes' || t.outcomeIndex === 0;
}
function usd(t: RecentTrade): number {
  if (t.usdcSize != null) return Number(t.usdcSize);
  if (t.size != null && t.price != null) return Number(t.size) * Number(t.price);
  if (t.amount != null) return Number(t.amount);
  return 0;
}
function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const h = seconds / 3600;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

const CAT_COLOR: Record<string, string> = {
  Politics: '#60a5fa', Crypto: '#fbbf24', Sports: '#34d399',
  Tech: '#a78bfa', World: '#f472b6', Entertainment: '#fb923c', Other: '#94a3b8',
};
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// JS getDay(): 0=Sun..6=Sat → map to Mon-first index
const dayIdx = (d: number) => (d + 6) % 7;

/* ─────────────────────────── sub-section shell ─────────────────────────── */

function Panel({ accent, title, sub, children }: {
  accent: string; title: string; sub: string; children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-3.5" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="mb-2.5 flex items-start gap-2">
        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: accent }} />
        <div>
          <h3 className="text-xs font-black text-white">{title}</h3>
          <p className="text-[10px] text-white/35 mt-0.5 leading-snug">{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

const tooltipStyle = {
  background: 'rgba(13,13,26,0.95)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12, fontSize: 12,
};

/* ═══════════════════════════════════════════════════════════════ */

export default function WalletActivity({ address, positions }: { address: string; positions: Position[] }) {
  const [trades, setTrades] = useState<RecentTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch(`/api/wallet/${address}/activity`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.trades)) setTrades(d.trades); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  /* 1 — Trades by hour of day (local time) */
  const byHour = useMemo(() => {
    const buckets = HOURS.map(h => ({ hour: h, label: `${h}:00`, count: 0 }));
    for (const t of trades) {
      const ts = tsOf(t); if (!ts) continue;
      const h = new Date(ts * 1000).getHours();
      buckets[h].count++;
    }
    return buckets;
  }, [trades]);

  const peakHour = useMemo(() => {
    let best = byHour[0];
    for (const b of byHour) if (b.count > best.count) best = b;
    return best.count > 0 ? best : null;
  }, [byHour]);

  /* 2 — Win rate by category (from positions) */
  const byCategory = useMemo(() => {
    const map: Record<string, { wins: number; total: number }> = {};
    for (const p of positions) {
      const cat = detectCategory(p.title);
      if (!map[cat]) map[cat] = { wins: 0, total: 0 };
      map[cat].total++;
      if (positionPnl(p) > 0) map[cat].wins++;
    }
    return Object.entries(map)
      .filter(([, s]) => s.total >= 3)
      .map(([cat, s]) => ({ cat, winRate: Math.round((s.wins / s.total) * 100), total: s.total }))
      .sort((a, b) => b.winRate - a.winRate);
  }, [positions]);

  /* 3 — Average hold time (round-trips: first buy → last sell per asset) */
  const holdStats = useMemo(() => {
    const byAsset: Record<string, { firstBuy: number; lastSell: number }> = {};
    for (const t of trades) {
      const key = t.asset ?? '';
      const ts = tsOf(t);
      if (!key || !ts) continue;
      if (!byAsset[key]) byAsset[key] = { firstBuy: Infinity, lastSell: 0 };
      if (isBuy(t)) byAsset[key].firstBuy = Math.min(byAsset[key].firstBuy, ts);
      else byAsset[key].lastSell = Math.max(byAsset[key].lastSell, ts);
    }
    const durations: number[] = [];
    for (const { firstBuy, lastSell } of Object.values(byAsset)) {
      if (firstBuy !== Infinity && lastSell > firstBuy) durations.push(lastSell - firstBuy);
    }
    if (!durations.length) return null;
    durations.sort((a, b) => a - b);
    const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
    const median = durations[Math.floor(durations.length / 2)];
    return { avg, median, shortest: durations[0], longest: durations[durations.length - 1], n: durations.length };
  }, [trades]);

  /* 4 — Outcome bias (Yes vs No buys, count + $ weighted) */
  const bias = useMemo(() => {
    let yesN = 0, noN = 0, yesUsd = 0, noUsd = 0;
    for (const t of trades) {
      if (!isBuy(t)) continue;
      if (isYes(t)) { yesN++; yesUsd += usd(t); }
      else { noN++; noUsd += usd(t); }
    }
    const totalN = yesN + noN;
    return { yesN, noN, totalN, yesUsd, noUsd, yesPct: totalN ? (yesN / totalN) * 100 : 0 };
  }, [trades]);

  /* 5 — Activity heatmap (7 days × 24 hours of trade counts) */
  const heat = useMemo(() => {
    const grid = DAY_LABELS.map(() => HOURS.map(() => 0));
    let max = 0;
    for (const t of trades) {
      const ts = tsOf(t); if (!ts) continue;
      const d = new Date(ts * 1000);
      const row = dayIdx(d.getDay());
      const col = d.getHours();
      grid[row][col]++;
      if (grid[row][col] > max) max = grid[row][col];
    }
    return { grid, max };
  }, [trades]);

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass rounded-2xl h-64 animate-shimmer" />)}
      </div>
    );
  }
  if (trades.length === 0) return null;

  return (
    <div className="animate-fade-in-up flex flex-col gap-2.5" style={{ animationDelay: '180ms' }}>
      <div className="flex items-center gap-2">
        <span className="inline-block h-1 w-6 rounded-full" style={{ background: 'linear-gradient(90deg,#7c3aed,#9333ea)' }} />
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">Behaviour &amp; Activity</h2>
        <span className="text-[10px] text-white/25">{trades.length} trades analyzed</span>
      </div>

      <div className="grid gap-2.5 lg:grid-cols-2">

        {/* 1 — Trades by hour */}
        <Panel accent="#60a5fa" title="Trades by Hour"
          sub={peakHour ? `Most active around ${peakHour.label} (local time)` : 'Trade count per hour of day'}>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byHour} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                  axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  labelFormatter={(h) => `${h}:00–${h}:59`} formatter={(v) => [v, 'Trades'] as [number, string]} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {byHour.map((b, i) => (
                    <Cell key={i} fill={peakHour && b.hour === peakHour.hour ? '#60a5fa' : 'rgba(96,165,250,0.45)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* 2 — Win rate by category */}
        <Panel accent="#34d399" title="Win Rate by Category"
          sub="Profitable position share per market category (min 3 positions)">
          {byCategory.length === 0 ? (
            <p className="flex h-36 items-center justify-center text-sm text-white/25">Not enough data per category</p>
          ) : (
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                    axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="cat" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                    axisLine={false} tickLine={false} width={84} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    formatter={(v, _n, p) => [`${v}% (${p.payload.total} pos)`, 'Win rate'] as [string, string]} />
                  <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                    {byCategory.map((c, i) => <Cell key={i} fill={CAT_COLOR[c.cat] ?? CAT_COLOR.Other} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        {/* 3 — Avg hold time */}
        <Panel accent="#a78bfa" title="Avg Hold Time"
          sub="How long positions are held from first buy to last sell (closed round-trips)">
          {!holdStats ? (
            <p className="flex h-36 items-center justify-center text-sm text-white/25">No closed round-trips found</p>
          ) : (
            <div className="flex h-36 flex-col justify-center gap-3">
              <div className="text-center">
                <p className="text-2xl font-black text-grad">{fmtDuration(holdStats.avg)}</p>
                <p className="mt-0.5 text-[10px] text-white/30 uppercase tracking-wider">average across {holdStats.n} round-trips</p>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: 'Median', value: fmtDuration(holdStats.median), color: '#a78bfa' },
                  { label: 'Shortest', value: fmtDuration(holdStats.shortest), color: '#34d399' },
                  { label: 'Longest', value: fmtDuration(holdStats.longest), color: '#fb7185' },
                ].map(s => (
                  <div key={s.label} className="rounded-lg px-2 py-1.5 text-center"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-xs font-black" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[8px] text-white/30 uppercase tracking-wider mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        {/* 4 — Outcome bias */}
        <Panel accent="#fbbf24" title="Outcome Bias"
          sub="Yes vs No share of buy orders — does this wallet lean optimistic or contrarian?">
          {bias.totalN === 0 ? (
            <p className="flex h-36 items-center justify-center text-sm text-white/25">No buy orders found</p>
          ) : (
            <div className="flex h-36 flex-col justify-center gap-3.5">
              {/* split bar */}
              <div>
                <div className="mb-1.5 flex justify-between text-[11px] font-black">
                  <span className="text-emerald-400">YES {bias.yesPct.toFixed(0)}%</span>
                  <span className="text-rose-400">NO {(100 - bias.yesPct).toFixed(0)}%</span>
                </div>
                <div className="flex h-5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div style={{ width: `${bias.yesPct}%`, background: 'linear-gradient(90deg,#10b981,#34d399)' }} />
                  <div style={{ width: `${100 - bias.yesPct}%`, background: 'linear-gradient(90deg,#fb7185,#f43f5e)' }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
                  <p className="text-[9px] uppercase tracking-wider text-emerald-300/70">Yes buys</p>
                  <p className="text-base font-black text-emerald-300">{bias.yesN}</p>
                  <p className="text-[9px] text-white/30">{formatCurrency(bias.yesUsd, true)}</p>
                </div>
                <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.2)' }}>
                  <p className="text-[9px] uppercase tracking-wider text-rose-300/70">No buys</p>
                  <p className="text-base font-black text-rose-300">{bias.noN}</p>
                  <p className="text-[9px] text-white/30">{formatCurrency(bias.noUsd, true)}</p>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* 5 — Activity heatmap (full width) */}
      <Panel accent="#f472b6" title="Activity Heatmap"
        sub="Weekly trading rhythm — darker cells mean more trades in that day/hour slot (local time)">
        <div className="overflow-x-auto">
          <div className="min-w-[480px]">
            {/* hour axis */}
            <div className="mb-1 flex pl-7">
              {HOURS.map(h => (
                <div key={h} className="flex-1 text-center text-[8px] text-white/25">{h % 3 === 0 ? h : ''}</div>
              ))}
            </div>
            {heat.grid.map((row, ri) => (
              <div key={ri} className="mb-0.5 flex items-center">
                <span className="w-7 text-[8px] font-semibold uppercase text-white/35">{DAY_LABELS[ri]}</span>
                <div className="flex flex-1 gap-px">
                  {row.map((c, ci) => {
                    const intensity = heat.max > 0 ? c / heat.max : 0;
                    return (
                      <div key={ci} title={`${DAY_LABELS[ri]} ${ci}:00 — ${c} trade${c === 1 ? '' : 's'}`}
                        className="aspect-square flex-1 rounded-sm"
                        style={{
                          background: c === 0 ? 'rgba(255,255,255,0.03)'
                            : `rgba(244,114,182,${0.18 + intensity * 0.8})`,
                        }} />
                    );
                  })}
                </div>
              </div>
            ))}
            {/* legend */}
            <div className="mt-2 flex items-center justify-end gap-1.5 pr-1">
              <span className="text-[9px] text-white/25">Less</span>
              {[0.03, 0.25, 0.5, 0.75, 1].map((v, i) => (
                <span key={i} className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: v <= 0.03 ? 'rgba(255,255,255,0.03)' : `rgba(244,114,182,${0.18 + v * 0.8})` }} />
              ))}
              <span className="text-[9px] text-white/25">More</span>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
