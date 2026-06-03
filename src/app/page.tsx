'use client';

import SmartMoneyCard from '@/components/SmartMoneyCard';
import DashboardStats from '@/components/DashboardStats';
import TopMarkets from '@/components/TopMarkets';
import HotBets from '@/components/HotBets';
import RecentBigTrades from '@/components/RecentBigTrades';
import RisingTraders from '@/components/RisingTraders';
import LiveTicker from '@/components/LiveTicker';

function SectionHeader({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-mono text-[10px] font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.20)' }}>{index}</span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--vi-border), transparent)' }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.25)' }}>{label}</span>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-10">

      {/* ── Live trade ticker ── */}
      <LiveTicker />

      {/* ── [01] Hero ── */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-3 mb-8">
          <span className="font-mono text-[10px] font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.20)' }}>[01]</span>
          <div className="h-px w-12" style={{ background: 'var(--vi-border)' }} />
          <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.22)' }}>Terminal Intelligence</span>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_minmax(280px,340px)] lg:items-start">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <h1
              className="text-4xl font-black leading-[1.12] lg:text-5xl"
              style={{ fontFamily: 'var(--font-serif-display, Georgia, serif)' }}
            >
              <span className="text-white">Real time</span>
              <span className="text-grad">alpha</span>
              <span className="text-white"> from the best</span>
            </h1>
            <p className="mt-5 max-w-sm text-sm font-medium leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
              Discover, follow and copy the most profitable traders on Polymarket in real time.
            </p>
          </div>
          <SmartMoneyCard />
        </div>
      </div>

      {/* ── [02] Platform Stats ── */}
      <div>
        <SectionHeader index="[02]" label="Platform Stats" />
        <DashboardStats />
      </div>

      {/* ── [03] Live Feed + Rising Traders ── */}
      <div>
        <SectionHeader index="[03]" label="Live Feed" />
        <div className="grid gap-5 lg:grid-cols-[1fr_360px] items-start">
          <RecentBigTrades />
          <div className="lg:sticky lg:top-4">
            <RisingTraders />
          </div>
        </div>
      </div>

      {/* ── [04] Top Markets ── */}
      <div>
        <SectionHeader index="[04]" label="Top Markets" />
        <TopMarkets limit={12} showViewAll />
      </div>

      {/* ── [05] Hot Bets ── */}
      <div>
        <SectionHeader index="[05]" label="Hot Bets" />
        <HotBets />
      </div>

    </div>
  );
}
