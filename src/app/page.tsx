'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import WalletSearch from '@/components/WalletSearch';
import DashboardStats from '@/components/DashboardStats';
import TopMarkets from '@/components/TopMarkets';
import RecentBigTrades from '@/components/RecentBigTrades';
import RisingTraders from '@/components/RisingTraders';
import LiveTicker from '@/components/LiveTicker';
import HotBets from '@/components/HotBets';
import { formatCurrency, formatAddress } from '@/lib/utils';

interface LbEntry { proxyWallet: string; userName?: string | null; profileImage?: string | null; pnl: number }

function SmartMoneyPreview() {
  const [rows, setRows] = useState<LbEntry[] | null>(null);

  useEffect(() => {
    fetch('/api/leaderboard?window=1w&limit=4')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRows(d.slice(0, 4)); })
      .catch(() => {});
  }, []);

  return (
    <div className="relative w-full rounded-2xl p-4 glass-strong"
      style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          <span className="text-xs font-bold text-white/80">Smart Money</span>
        </div>
        <Link href="/leaderboard"
          className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300 transition-colors hover:text-violet-200"
          style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}>
          View all →
        </Link>
      </div>

      <div className="flex flex-col gap-1.5">
        {(rows ?? Array.from({ length: 4 })).map((e, i) => {
          const entry = e as LbEntry | undefined;
          if (!entry) return <div key={i} className="h-10 rounded-xl animate-shimmer" />;
          const name = entry.userName || formatAddress(entry.proxyWallet);
          return (
            <Link key={entry.proxyWallet} href={`/wallet/${entry.proxyWallet.toLowerCase()}`}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/5">
              <span className="w-4 flex-shrink-0 text-center text-[11px] font-black text-white/25">{i + 1}</span>
              {entry.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={entry.profileImage} alt="" className="h-7 w-7 flex-shrink-0 rounded-full object-cover" />
              ) : (
                <span className="h-7 w-7 flex-shrink-0 rounded-full"
                  style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.5),rgba(37,99,235,0.5))' }} />
              )}
              <span className="flex-1 truncate text-xs font-semibold text-white/70">{name}</span>
              <span className={`text-xs font-black ${entry.pnl >= 0 ? 'text-grad-profit' : 'text-grad-loss'}`}>
                {entry.pnl >= 0 ? '+' : ''}{formatCurrency(entry.pnl, true)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">

      {/* ── Live trade ticker ── */}
      <LiveTicker />

      {/* ── Hero ── */}
      <div className="relative animate-fade-in-up overflow-hidden rounded-3xl px-6 py-6 sm:px-8 sm:py-7"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.10) 0%, rgba(37,99,235,0.06) 40%, rgba(6,182,212,0.05) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>

        {/* Grid texture */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '34px 34px',
            maskImage: 'radial-gradient(ellipse at 30% 40%, #000 0%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 30% 40%, #000 0%, transparent 75%)',
          }} />

        {/* Aurora orbs */}
        <div className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full animate-orb"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.30) 0%, transparent 70%)', filter: 'blur(50px)' }} />
        <div className="pointer-events-none absolute -bottom-28 right-10 h-72 w-72 rounded-full animate-orb"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.22) 0%, transparent 70%)', filter: 'blur(55px)', animationDelay: '6s' }} />
        <div className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 70% 0%, rgba(37,99,235,0.10) 0%, transparent 60%)' }} />

        {/* Hero content: headline + buttons (left) · smart money (right) */}
        <div className="relative grid gap-8 lg:grid-cols-[1fr_minmax(280px,360px)] lg:items-center">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                Live
              </span>
              <span className="rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase tracking-widest"
                style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)', color: 'rgba(196,181,253,0.9)' }}>
                AlphaBoard Intelligence
              </span>
            </div>

            <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
              <span className="text-white">Track Polymarket&apos;s</span>
              <br />
              <span className="animate-gradient bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(110deg,#c4b5fd 5%,#a78bfa 35%,#818cf8 65%,#60a5fa 95%)',
                  filter: 'drop-shadow(0 4px 30px rgba(124,58,237,0.45))',
                }}>
                sharpest money.
              </span>
            </h1>

            <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/50">
              Real-time P&amp;L and smart money tracking. Follow Polymarket&apos;s top wallets,
              positions and win rates as they move, live.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href="#wallet-search"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all hover:scale-[1.03] hover:brightness-110"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)', border: '1px solid rgba(139,92,246,0.4)' }}>
                Track a Wallet
              </a>
              <Link href="/liquidity"
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white/75 transition-all hover:text-white hover:scale-[1.02]"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}>
                Set Alerts
              </Link>
            </div>
          </div>

          {/* Smart money preview */}
          <SmartMoneyPreview />
        </div>

        {/* Stats grid */}
        <div className="relative mt-8">
          <DashboardStats />
        </div>

        {/* Wallet search */}
        <div id="wallet-search" className="relative mt-4 glass rounded-2xl p-4 sm:max-w-sm">
          <div className="mb-2.5 flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.4),rgba(37,99,235,0.4))', border: '1px solid rgba(139,92,246,0.3)' }}>
              <svg className="h-3 w-3 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-white/55">Track a Wallet</p>
          </div>
          <WalletSearch />
        </div>
      </div>

      {/* ── Top Markets ── */}
      <TopMarkets />

      {/* ── Hot Bets ── */}
      <HotBets />

      {/* ── Recent Trades + Rising Traders ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <RecentBigTrades />
        <RisingTraders />
      </div>

    </div>
  );
}
