'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Position, RecentTrade } from '@/types';
import { formatCurrency, positionPnl } from '@/lib/utils';

function Row({ label, value, valueClass = 'text-white/75' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-white/35">{label}</span>
      <span className={`text-xs font-bold ${valueClass}`}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-3.5">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/35">{title}</p>
      {children}
    </div>
  );
}

export default function WalletSidebar({
  address, positions, openValue,
}: { address: string; positions: Position[]; openValue: number }) {
  const [trades, setTrades] = useState<RecentTrade[] | null>(null);

  useEffect(() => {
    if (!address) return;
    let live = true;
    fetch(`/api/wallet/${address}/activity`)
      .then(r => r.json())
      .then(d => { if (live && Array.isArray(d?.trades)) setTrades(d.trades); })
      .catch(() => {});
    return () => { live = false; };
  }, [address]);

  const stats = useMemo(() => {
    let realized = 0, unrealized = 0, invested = 0, wins = 0, losses = 0;
    const markets = new Set<string>();
    for (const p of positions) {
      realized += p.realizedPnl ?? 0;
      unrealized += p.cashPnl ?? 0;
      invested += p.initialValue ?? 0;
      const pnl = positionPnl(p);
      if (pnl > 0) wins++; else if (pnl < 0) losses++;
      if (p.conditionId) markets.add(p.conditionId);
    }
    const avgBet = positions.length ? invested / positions.length : 0;
    const totalPnl = realized + unrealized;
    const equity = openValue + realized;

    let buys = 0, sells = 0, buyVol = 0, sellVol = 0;
    if (trades) {
      for (const t of trades) {
        const side = String(t.side ?? '').toUpperCase();
        const usd = Number(t.usdcSize ?? 0) || (Number(t.size ?? 0) * Number(t.price ?? 0));
        if (side === 'SELL') { sells++; sellVol += usd; }
        else { buys++; buyVol += usd; }
      }
    }
    const totalSides = buys + sells;
    const buyPct = totalSides ? (buys / totalSides) * 100 : 0;

    return {
      realized, unrealized, totalPnl, equity, avgBet, wins, losses,
      positions: positions.length, markets: markets.size,
      buys, sells, buyPct, buyVol, sellVol, hasTrades: !!trades,
    };
  }, [positions, openValue, trades]);

  const sign = (v: number) => (v >= 0 ? '+' : '');
  const cls = (v: number) => (v > 0 ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-white/50');

  return (
    <div className="flex flex-col gap-3">
      <Section title="Portfolio Equity">
        <p className={`text-2xl font-black leading-none ${stats.equity >= 0 ? 'text-grad-profit' : 'text-grad-loss'}`}>
          {formatCurrency(stats.equity, true)}
        </p>
        <p className="mt-1 text-[10px] text-white/30">Open value + realized P&amp;L</p>
      </Section>

      <Section title="PnL Breakdown">
        <Row label="Realized" value={`${sign(stats.realized)}${formatCurrency(stats.realized, true)}`} valueClass={cls(stats.realized)} />
        <Row label="Unrealized" value={`${sign(stats.unrealized)}${formatCurrency(stats.unrealized, true)}`} valueClass={cls(stats.unrealized)} />
        <div className="my-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <Row label="Total P&L" value={`${sign(stats.totalPnl)}${formatCurrency(stats.totalPnl, true)}`} valueClass={cls(stats.totalPnl)} />
        <Row label="Position Value" value={formatCurrency(openValue, true)} />
      </Section>

      <Section title="Core Stats">
        <Row label="Avg Bet" value={formatCurrency(stats.avgBet, true)} />
        <Row label="Win / Loss" value={`${stats.wins} / ${stats.losses}`} />
        <Row label="Positions" value={String(stats.positions)} />
        <Row label="Unique Markets" value={String(stats.markets)} />
      </Section>

      <Section title="Buy / Sell Ratio">
        {!stats.hasTrades ? (
          <div className="h-2 w-full rounded-full animate-shimmer" />
        ) : stats.buys + stats.sells === 0 ? (
          <p className="text-[11px] text-white/25">No trade data</p>
        ) : (
          <>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ width: `${stats.buyPct}%`, background: '#34d399' }} />
              <div style={{ width: `${100 - stats.buyPct}%`, background: '#fb7185' }} />
            </div>
            <div className="mt-2 flex justify-between text-[10px]">
              <span className="text-emerald-400 font-semibold">{stats.buys} buys</span>
              <span className="text-rose-400 font-semibold">{stats.sells} sells</span>
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
