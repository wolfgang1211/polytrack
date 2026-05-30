'use client';

import WalletSearch from '@/components/WalletSearch';
import DashboardStats from '@/components/DashboardStats';
import TopMarkets from '@/components/TopMarkets';
import RecentBigTrades from '@/components/RecentBigTrades';
import RisingTraders from '@/components/RisingTraders';
import LiveTicker from '@/components/LiveTicker';
import HotBets from '@/components/HotBets';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">

      {/* ── Live trade ticker ── */}
      <LiveTicker />

      {/* ── Hero ── */}
      <div className="relative animate-fade-in-up overflow-hidden rounded-3xl px-6 py-7 sm:px-8 sm:py-9"
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

        {/* Title row */}
        <div className="relative mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                Live
              </span>
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
                style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)', color: 'rgba(196,181,253,0.85)' }}>
                PolyTrack Intelligence
              </span>
            </div>
            <h1 className="flex items-baseline gap-3 text-4xl font-black leading-[1.0] tracking-tight sm:text-[3.1rem]">
              <span className="animate-gradient bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(110deg,#fff 8%,#c4b5fd 38%,#60a5fa 60%,#38bdf8 78%,#fff 96%)',
                  filter: 'drop-shadow(0 4px 30px rgba(124,58,237,0.45))',
                }}>
                Alpha&nbsp;Board
              </span>
            </h1>
            <div className="mt-2 h-[3px] w-40 rounded-full animate-gradient"
              style={{ backgroundImage: 'linear-gradient(90deg,#7c3aed,#2563eb,#06b6d4,#7c3aed)' }} />
            <p className="mt-3 max-w-lg text-sm text-white/45">
              Where Polymarket&apos;s sharpest money moves — live P&amp;L, positions &amp; win rates, ranked in real time.
            </p>
          </div>

          {/* Decorative sparkline */}
          <div className="hidden flex-shrink-0 md:block" aria-hidden>
            <svg width="200" height="84" viewBox="0 0 200 84" fill="none">
              <defs>
                <linearGradient id="heroSpark" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#7c3aed" />
                  <stop offset="0.5" stopColor="#38bdf8" />
                  <stop offset="1" stopColor="#34d399" />
                </linearGradient>
                <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="rgba(56,189,248,0.25)" />
                  <stop offset="1" stopColor="rgba(56,189,248,0)" />
                </linearGradient>
              </defs>
              <path d="M0 64 L24 58 L48 62 L72 44 L96 50 L120 30 L144 36 L168 16 L200 8 L200 84 L0 84 Z" fill="url(#heroFill)" />
              <path d="M0 64 L24 58 L48 62 L72 44 L96 50 L120 30 L144 36 L168 16 L200 8"
                fill="none" stroke="url(#heroSpark)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="200" cy="8" r="4" fill="#34d399">
                <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>
        </div>

        {/* Stats grid */}
        <div className="relative mb-4">
          <DashboardStats />
        </div>

        {/* Wallet search */}
        <div className="relative glass rounded-2xl p-4 sm:max-w-sm">
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
