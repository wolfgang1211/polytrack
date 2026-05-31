'use client';

import WalletSearch from '@/components/WalletSearch';
import HomeLeaderboard from '@/components/HomeLeaderboard';
import TopMarkets from '@/components/TopMarkets';
import RecentBigTrades from '@/components/RecentBigTrades';
import RisingTraders from '@/components/RisingTraders';
import LiveTicker from '@/components/LiveTicker';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">

      {/* ── Live trade ticker (thin strip) ── */}
      <LiveTicker />

      {/* ── Compact hero: value prop + wallet search ── */}
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

        <div className="relative grid gap-6 lg:grid-cols-[1fr_minmax(300px,420px)] lg:items-center">
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

            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
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
              Discover, track and copy the most profitable traders on Polymarket.
              Paste any wallet or jump straight into the leaderboard below.
            </p>
          </div>

          {/* Wallet search — primary action, front and center */}
          <div className="glass rounded-2xl p-4" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
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
      </div>

      {/* ── PRIMARY: Trader leaderboard ── */}
      <HomeLeaderboard />

      {/* ── Discovery + copy signal ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <RecentBigTrades />
        <RisingTraders />
      </div>

      {/* ── Markets (secondary context) ── */}
      <TopMarkets />

    </div>
  );
}
