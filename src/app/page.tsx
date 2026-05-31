'use client';

import WalletSearch from '@/components/WalletSearch';
import HomeLeaderboard from '@/components/HomeLeaderboard';
import TopMarkets from '@/components/TopMarkets';
import RecentBigTrades from '@/components/RecentBigTrades';
import RisingTraders from '@/components/RisingTraders';
import LiveTicker from '@/components/LiveTicker';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">

      {/* ── Live trade ticker (real-time pulse, top of page) ── */}
      <LiveTicker />

      {/* ── Command bar: brand tagline + wallet search (dashboard, not landing) ── */}
      <div className="relative overflow-hidden rounded-2xl px-4 py-3.5 sm:px-5 animate-fade-in-up"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(37,99,235,0.06))',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
              style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Live
            </span>
            <p className="text-sm font-semibold text-white/70">
              Tracking Polymarket&apos;s <span className="text-grad font-bold">sharpest money</span> — discover, follow, copy.
            </p>
          </div>

          {/* Search — primary action, always in reach */}
          <div className="w-full lg:max-w-md">
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

      {/* ── Markets — secondary context, below all trader activity ── */}
      <div className="mt-2">
        <TopMarkets />
      </div>

    </div>
  );
}
