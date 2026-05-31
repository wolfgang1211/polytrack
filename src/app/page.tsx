'use client';

import SmartMoneyCard from '@/components/SmartMoneyCard';
import DashboardStats from '@/components/DashboardStats';
import TopMarkets from '@/components/TopMarkets';
import HotBets from '@/components/HotBets';
import RecentBigTrades from '@/components/RecentBigTrades';
import RisingTraders from '@/components/RisingTraders';
import LiveTicker from '@/components/LiveTicker';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">

      {/* ── Live trade ticker (real-time pulse, top of page) ── */}
      <LiveTicker />

      {/* ── Hero: headline (left) + Smart Money preview (right) ── */}
      <div className="relative overflow-hidden rounded-3xl px-6 py-8 sm:px-8 sm:py-10 animate-fade-in-up"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(147,51,234,0.06))',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
        {/* Aurora orbs */}
        <div className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full animate-orb"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.28) 0%, transparent 70%)', filter: 'blur(50px)' }} />
        <div className="pointer-events-none absolute -bottom-28 right-10 h-72 w-72 rounded-full animate-orb"
          style={{ background: 'radial-gradient(circle, rgba(147,51,234,0.20) 0%, transparent 70%)', filter: 'blur(55px)', animationDelay: '6s' }} />

        <div className="relative grid gap-8 lg:grid-cols-[1fr_minmax(300px,380px)] lg:items-center">
          <div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              <span className="text-white">Track Polymarket&apos;s</span>{' '}
              <span className="text-grad">Sharpest Money Moves</span>
            </h1>
            <p className="mt-4 max-w-lg text-base font-medium text-white/45 sm:text-lg">
              Discover, follow and copy the most profitable traders on Polymarket in real time.
            </p>
          </div>

          {/* Smart Money preview card */}
          <SmartMoneyCard />
        </div>
      </div>

      {/* ── Stats ── */}
      <DashboardStats />

      {/* ── Live activity rail (big trades) + rising traders ── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px] items-start">
        <RecentBigTrades />
        <div className="lg:sticky lg:top-4">
          <RisingTraders />
        </div>
      </div>

      {/* ── Top Markets (12) ── */}
      <TopMarkets limit={12} showViewAll />

      {/* ── Hot Markets ── */}
      <HotBets />

    </div>
  );
}
