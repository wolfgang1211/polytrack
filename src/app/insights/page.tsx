'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { LeaderboardEntry } from '@/types';
import { formatCurrency, formatAddress } from '@/lib/utils';
import { medianPnl, roiLeaders, pnlHistogram, concentration, ROI_MIN_VOLUME } from '@/lib/insights';
import { profileUrl } from '@/lib/builder';
import RisingTraders from '@/components/RisingTraders';

function SectionHeader({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-mono text-[10px] font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.20)' }}>{index}</span>
      <div className="h-px w-12" style={{ background: 'var(--vi-border)' }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.25)' }}>{label}</span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--vi-border), transparent)' }} />
    </div>
  );
}

function DataCell({ label, value, accent, loading }: { label: string; value: string; accent?: string; loading?: boolean }) {
  return (
    <div className="flex-1 flex flex-col justify-center px-5 py-4 min-w-[140px]">
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] mb-1.5" style={{ color: 'rgba(255,255,255,0.28)' }}>{label}</p>
      {loading ? (
        <div className="h-6 w-20 rounded animate-shimmer" />
      ) : (
        <p className="font-mono text-xl font-black tabular-nums leading-none" style={{ color: accent ?? 'rgba(255,255,255,0.88)' }}>{value}</p>
      )}
    </div>
  );
}

function HBar({ label, pct, detail, color }: { label: string; pct: number; detail: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-wider w-24 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
      <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div className="h-full rounded transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
      </div>
      <span className="font-mono text-xs font-bold tabular-nums w-24 text-right flex-shrink-0" style={{ color: 'rgba(255,255,255,0.7)' }}>{detail}</span>
    </div>
  );
}

export default function InsightsPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch('/api/leaderboard?window=allTime&limit=50')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalPnl = data.reduce((s, e) => s + e.pnl, 0);
  const totalVol = data.reduce((s, e) => s + e.vol, 0);
  const avgPnl   = data.length ? totalPnl / data.length : 0;

  const median   = useMemo(() => medianPnl(data), [data]);
  const roiTop   = useMemo(() => roiLeaders(data, 3), [data]);
  const hist     = useMemo(() => pnlHistogram(data), [data]);
  const conc     = useMemo(() => concentration(data), [data]);

  const maxBucket = Math.max(1, ...hist.map(b => b.count));

  return (
    <div className="flex flex-col gap-10">

      {/* ── [01] Header ── */}
      <div className="animate-fade-in-up">
        <SectionHeader index="[01]" label="Insights" />
        <h1 className="text-4xl font-black leading-none tracking-tight sm:text-5xl mb-3">
          <span className="text-white">Market</span>{' '}
          <span className="text-grad">Insights</span>
        </h1>
        <p className="text-sm text-white/40 max-w-lg">
          Derived analytics for top Polymarket traders — efficiency, distribution and concentration metrics you won&apos;t find on the leaderboard.
        </p>
      </div>

      {/* ── [02] Global Overview strip ── */}
      <section>
        <SectionHeader index="[02]" label="Global Overview" />
        <div className="flex overflow-x-auto animate-fade-in-up"
          style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <DataCell label="Total Volume" value={loading ? '—' : formatCurrency(totalVol, true)} accent="rgba(96,165,250,0.95)" loading={loading} />
          <div className="w-px self-stretch flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <DataCell
            label="Total P&L"
            value={loading ? '—' : (totalPnl >= 0 ? '+' : '') + formatCurrency(totalPnl, true)}
            accent={totalPnl >= 0 ? 'rgba(52,211,153,0.95)' : 'rgba(251,113,133,0.95)'}
            loading={loading}
          />
          <div className="w-px self-stretch flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <DataCell
            label="Avg P&L / Trader"
            value={loading ? '—' : (avgPnl >= 0 ? '+' : '') + formatCurrency(avgPnl, true)}
            accent="rgba(167,139,250,0.95)"
            loading={loading}
          />
          <div className="w-px self-stretch flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <DataCell
            label="Median P&L / Trader"
            value={loading ? '—' : (median >= 0 ? '+' : '') + formatCurrency(median, true)}
            accent="rgba(251,191,36,0.95)"
            loading={loading}
          />
        </div>
        {!loading && data.length > 0 && avgPnl > 0 && median > 0 && avgPnl / median > 1.5 && (
          <p className="mt-2 font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Average is {(avgPnl / median).toFixed(1)}× the median — profits are heavily concentrated at the top.
          </p>
        )}
      </section>

      {/* ── [03] Efficiency Leaders (ROI) ── */}
      {!loading && roiTop.length > 0 && (
        <section>
          <SectionHeader index="[03]" label="Efficiency Leaders — P&L per Dollar Traded" />
          <div className="grid gap-4 sm:grid-cols-3">
            {roiTop.map((e, i) => {
              const rings = ['rgba(52,211,153,0.4)', 'rgba(52,211,153,0.25)', 'rgba(52,211,153,0.18)'];
              const name  = e.userName || formatAddress(e.proxyWallet);
              return (
                <Link key={e.proxyWallet} href={`/wallet/${e.proxyWallet.toLowerCase()}`}
                  className="glass glass-hover gradient-border rounded-2xl p-5 flex flex-col gap-3 animate-fade-in-up"
                  style={{ animationDelay: `${i * 60}ms`, borderLeft: `2px solid ${rings[i]}` }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">{name}</p>
                      <p className="text-[10px] font-mono text-white/25">{formatAddress(e.proxyWallet)}</p>
                    </div>
                    <span className="font-mono text-[9px] uppercase tracking-wider rounded-full px-2 py-0.5"
                      style={{ background: 'rgba(52,211,153,0.08)', color: 'rgba(52,211,153,0.8)', border: '1px solid rgba(52,211,153,0.2)' }}>
                      #{i + 1} ROI
                    </span>
                  </div>
                  <p className="text-3xl font-black text-grad-profit leading-none">{e.roiPct.toFixed(1)}%</p>
                  <div className="flex justify-between">
                    <div>
                      <p className="text-[10px] text-white/25 uppercase tracking-wider">P&L</p>
                      <p className="text-sm font-bold" style={{ color: 'rgba(52,211,153,0.9)' }}>+{formatCurrency(e.pnl, true)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/25 uppercase tracking-wider">Volume</p>
                      <p className="text-sm font-bold text-white/60">{formatCurrency(e.vol, true)}</p>
                    </div>
                  </div>
                  <a href={profileUrl(e.proxyWallet)} target="_blank" rel="noopener noreferrer"
                    onClick={ev => ev.stopPropagation()}
                    className="text-[10px] text-white/25 hover:text-white/50 transition-colors">
                    View on Polymarket →
                  </a>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── [04] Distribution & Concentration ── */}
      {!loading && data.length > 0 && (
        <section>
          <SectionHeader index="[04]" label="Distribution & Concentration" />
          <div className="grid gap-4 lg:grid-cols-2">

            {/* P&L distribution histogram */}
            <div className="glass rounded-2xl p-5 animate-fade-in-up">
              <p className="text-sm font-bold text-white mb-1">P&L Distribution</p>
              <p className="text-xs text-white/35 mb-5">How profits are spread across the top {data.length} traders.</p>
              <div className="flex flex-col gap-3">
                {hist.map(b => (
                  <HBar
                    key={b.label}
                    label={b.label}
                    pct={(b.count / maxBucket) * 100}
                    detail={`${b.count} trader${b.count === 1 ? '' : 's'}`}
                    color="linear-gradient(90deg, rgba(167,139,250,0.55), rgba(96,165,250,0.55))"
                  />
                ))}
              </div>
            </div>

            {/* Concentration */}
            <div className="glass rounded-2xl p-5 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
              <p className="text-sm font-bold text-white mb-1">Whale Concentration</p>
              <p className="text-xs text-white/35 mb-5">Share of total volume and P&L held by the biggest traders.</p>
              <div className="flex flex-col gap-3">
                <HBar label="Top 3 · Vol"   pct={conc.top3VolPct}  detail={`${conc.top3VolPct.toFixed(1)}%`}  color="rgba(96,165,250,0.55)" />
                <HBar label="Top 10 · Vol"  pct={conc.top10VolPct} detail={`${conc.top10VolPct.toFixed(1)}%`} color="rgba(96,165,250,0.35)" />
                <HBar label="Top 3 · P&L"   pct={conc.top3PnlPct}  detail={`${conc.top3PnlPct.toFixed(1)}%`}  color="rgba(52,211,153,0.55)" />
                <HBar label="Top 10 · P&L"  pct={conc.top10PnlPct} detail={`${conc.top10PnlPct.toFixed(1)}%`} color="rgba(52,211,153,0.35)" />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── [05] Trend Detection ── */}
      <section className="animate-fade-in-up">
        <SectionHeader index="[05]" label="Trend Detection — Rising Traders" />
        <RisingTraders />
      </section>

      {/* ── [06] Coming Soon ── */}
      <section className="animate-fade-in-up">
        <SectionHeader index="[06]" label="Coming Soon" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: '📈', title: 'Trend Timeline',        desc: 'Daily snapshots of volume, P&L and rank movement — who is climbing, who is fading.' },
            { icon: '🧠', title: 'Smart Money Consensus', desc: 'Markets where multiple top-50 traders hold the same position right now.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="glass rounded-2xl p-5"
              style={{ opacity: 0.5 }}>
              <p className="text-2xl mb-3">{icon}</p>
              <p className="text-sm font-bold text-white mb-1">{title}</p>
              <p className="text-xs text-white/35 leading-relaxed">{desc}</p>
              <span className="mt-3 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                style={{ background: 'var(--vi-tint)', color: 'rgba(167,139,250,0.7)', border: '1px solid var(--vi-border-xs)' }}>
                Coming Soon
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Methodology note ── */}
      <p className="font-mono text-[10px] leading-relaxed max-w-2xl" style={{ color: 'rgba(255,255,255,0.22)' }}>
        Methodology: all metrics are derived from the Polymarket all-time top-50 leaderboard (refreshed every 60s).
        ROI = P&amp;L ÷ traded volume; wallets below {formatCurrency(ROI_MIN_VOLUME, true)} volume are excluded from ROI ranking.
        Concentration percentages rank traders within each metric independently.
      </p>
    </div>
  );
}
