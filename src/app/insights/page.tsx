'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { LeaderboardEntry } from '@/types';
import { formatCurrency, formatAddress } from '@/lib/utils';
import { profileUrl } from '@/lib/builder';

function StatBlock({ label, value, sub, icon, gradient }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; gradient: string;
}) {
  return (
    <div className="glass glass-hover gradient-border rounded-2xl p-5 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: gradient, border: '1px solid rgba(255,255,255,0.08)' }}>
          {icon}
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">{label}</p>
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-white/30">{sub}</p>}
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

      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block h-1 w-8 rounded-full"
            style={{ background: 'linear-gradient(90deg,#f59e0b,#ef4444)' }} />
          <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Analytics</span>
        </div>
        <h1 className="text-4xl font-black leading-none tracking-tight sm:text-5xl">
          <span className="text-white">Market</span>{' '}
          <span style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            Insights
          </span>
        </h1>
        <p className="mt-3 text-sm text-white/40 max-w-lg">
          Global statistics and analytics for top Polymarket traders.
        </p>
      </div>

      {/* Global stats */}
      {!loading && data.length > 0 && (
        <section>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-white/25">Global Overview</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBlock
              label="Total Volume"
              value={formatCurrency(totalVol, true)}
              sub="across top traders"
              gradient="rgba(37,99,235,0.18)"
              icon={<svg style={{width:16,height:16}} className="text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>}
            />
            <StatBlock
              label="Total P&L"
              value={(totalPnl >= 0 ? '+' : '') + formatCurrency(totalPnl, true)}
              sub="net profit"
              gradient={totalPnl >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(251,113,133,0.15)'}
              icon={<svg style={{width:16,height:16}} className="text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>}
            />
            <StatBlock
              label="Top Traders"
              value={`${data.length}`}
              sub="ranked by all-time P&L"
              gradient="rgba(251,191,36,0.15)"
              icon={<svg style={{width:16,height:16}} className="text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>}
            />
            <StatBlock
              label="Avg P&L / Trader"
              value={(avgPnl >= 0 ? '+' : '') + formatCurrency(avgPnl, true)}
              sub="per ranked trader"
              gradient="rgba(139,92,246,0.15)"
              icon={<svg style={{width:16,height:16}} className="text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
            />
          </div>
        </section>
      )}

      {/* Top 3 traders */}
      {!loading && top3.length > 0 && (
        <section>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-white/25">Top Performers — All Time</p>
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

      {/* Coming soon features */}
      <section className="animate-fade-in-up">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-white/25">Coming Soon</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: '📊', title: 'Category Analytics',   desc: 'Win rates by market category — Politics, Crypto, Sports, and more.' },
            { icon: '🔥', title: 'Trend Detection',       desc: 'Traders with the fastest-growing PnL over the last 7 days.' },
            { icon: '🤖', title: 'AI Trade Signals',      desc: 'Pattern-based signals derived from whale wallet activity.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="glass rounded-2xl p-5"
              style={{ opacity: 0.5 }}>
              <p className="text-2xl mb-3">{icon}</p>
              <p className="text-sm font-bold text-white mb-1">{title}</p>
              <p className="text-xs text-white/35 leading-relaxed">{desc}</p>
              <span className="mt-3 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(139,92,246,0.15)', color: 'rgba(167,139,250,0.7)', border: '1px solid rgba(139,92,246,0.2)' }}>
                Coming Soon
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
