'use client';

import WalletSearch from '@/components/WalletSearch';
import HomeLeaderboard from '@/components/HomeLeaderboard';
import HotBets from '@/components/HotBets';
import RecentBigTrades from '@/components/RecentBigTrades';
import RisingTraders from '@/components/RisingTraders';
import LiveTicker from '@/components/LiveTicker';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">

      {/* ── Live trade ticker (real-time pulse, top of page) ── */}
      <LiveTicker />

      {/* ── Hero: centered headline + wallet search ── */}
      <div className="relative overflow-hidden rounded-2xl px-4 py-10 sm:px-6 sm:py-14 animate-fade-in-up"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(147,51,234,0.06))',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
        <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            <span className="text-white">Track Polymarket&apos;s</span>{' '}
            <span className="text-grad">sharpest money</span>
          </h1>
          <p className="mt-3 text-base font-medium text-white/45 sm:text-lg">
            Discover, follow and copy the most profitable traders.
          </p>

          {/* Search — directly under the headline */}
          <div className="mt-7 w-full max-w-lg">
            <WalletSearch />
          </div>
        </div>
      </div>

      {/* ── PRIMARY: profitable wallets ── */}
      <HomeLeaderboard />

      {/* ── Live activity rail (big trades) + rising traders ── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px] items-start">
        <RecentBigTrades />
        <div className="lg:sticky lg:top-4">
          <RisingTraders />
        </div>
      </div>

      {/* ── Hot Markets ── */}
      <HotBets />

    </div>
  );
}
