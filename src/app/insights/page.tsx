'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { LeaderboardEntry } from '@/types';
import { formatCurrency, formatAddress } from '@/lib/utils';
import { profileUrl } from '@/lib/builder';

function SectionHeader({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-mono text-[10px] font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.20)' }}>{index}</span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--vi-border), transparent)' }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.25)' }}>{label}</span>
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

  const totalPnl  = data.reduce((s, e) => s + e.pnl, 0);
  const totalVol  = data.reduce((s, e) => s + e.vol, 0);
  const avgPnl    = data.length ? totalPnl / data.length : 0;
  const top3      = data.slice(0, 3);

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
          Global statistics and analytics for top Polymarket traders.
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
          <DataCell label="Top Traders" value={loading ? '—' : String(data.length)} accent="rgba(251,191,36,0.95)" loading={loading} />
          <div className="w-px self-stretch flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <DataCell
            label="Avg P&L / Trader"
            value={loading ? '—' : (avgPnl >= 0 ? '+' : '') + formatCurrency(avgPnl, true)}
            accent="rgba(167,139,250,0.95)"
            loading={loading}
          />
        </div>
      </section>

      {/* ── [03] Top Performers ── */}
      {!loading && top3.length > 0 && (
        <section>
          <SectionHeader index="[03]" label="Top Performers, All Time" />
          <div className="grid gap-4 sm:grid-cols-3">
            {top3.map((e, i) => {
              const medals = ['🥇', '🥈', '🥉'];
              const rings  = ['rgba(251,191,36,0.4)', 'rgba(148,163,184,0.3)', 'rgba(234,88,12,0.35)'];
              const bgs    = ['rgba(251,191,36,0.08)', 'rgba(148,163,184,0.06)', 'rgba(234,88,12,0.08)'];
              const name   = e.userName || formatAddress(e.proxyWallet);
              return (
                <Link key={e.proxyWallet} href={`/wallet/${e.proxyWallet.toLowerCase()}`}
                  className="glass glass-hover gradient-border rounded-2xl p-5 flex flex-col gap-3 animate-fade-in-up"
                  style={{ animationDelay: `${i * 60}ms`, borderLeft: `2px solid ${rings[i]}`, background: bgs[i] }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{medals[i]}</span>
                    <div>
                      <p className="text-sm font-bold text-white">{name}</p>
                      <p className="text-[10px] font-mono text-white/25">{formatAddress(e.proxyWallet)}</p>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <div>
                      <p className="text-[10px] text-white/25 uppercase tracking-wider">P&L</p>
                      <p className="text-lg font-black text-grad-profit">+{formatCurrency(e.pnl, true)}</p>
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

      {/* ── [04] Coming Soon ── */}
      <section className="animate-fade-in-up">
        <SectionHeader index="[04]" label="Coming Soon" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: '📊', title: 'Category Analytics',   desc: 'Win rates by market category: Politics, Crypto, Sports, and more.' },
            { icon: '🔥', title: 'Trend Detection',       desc: 'Traders with the fastest-growing PnL over the last 7 days.' },
            { icon: '🤖', title: 'AI Trade Signals',      desc: 'Pattern-based signals derived from whale wallet activity.' },
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
    </div>
  );
}
