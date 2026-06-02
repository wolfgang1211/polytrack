'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie,
} from 'recharts';
import type { Position } from '@/types';
import { detectCategory, formatCurrency } from '@/lib/utils';

const CAT_COLORS: Record<string, string> = {
  Crypto: '#f59e0b',
  Politics: '#7c3aed',
  Sports: '#10b981',
  Entertainment: '#ec4899',
  Tech: '#38bdf8',
  World: '#f43f5e',
  Other: '#64748b',
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-3.5">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/35">{title}</p>
      {children}
    </div>
  );
}

interface TipProps {
  active?: boolean;
  payload?: { name?: string; value?: number; payload?: { name?: string; value?: number } }[];
}

function MoneyTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const name = p.payload?.name ?? p.name ?? '';
  const value = (p.value ?? p.payload?.value ?? 0) as number;
  return (
    <div className="glass-strong rounded-lg px-3 py-2 text-xs">
      <p className="text-white/70 font-semibold">{name}</p>
      <p className={value >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
        {value >= 0 ? '+' : ''}{formatCurrency(value, true)}
      </p>
    </div>
  );
}

export default function WalletCharts({ positions }: { positions: Position[] }) {
  const { catData, splitData, hasData } = useMemo(() => {
    const cat: Record<string, number> = {};
    let realized = 0;
    let unrealized = 0;
    for (const p of positions) {
      const isOpen = p.currentValue > 0;
      // True P&L: realized for all, unrealized (cashPnl) only for open positions —
      // closed/redeemed report cashPnl as -costBasis and would double-count losses.
      const pnl = (Number(p.realizedPnl) || 0) + (isOpen ? (Number(p.cashPnl) || 0) : 0);
      const c = detectCategory(p.title);
      cat[c] = (cat[c] ?? 0) + pnl;
      realized += Number(p.realizedPnl) || 0;
      if (isOpen) unrealized += Number(p.cashPnl) || 0;
    }
    const catData = Object.entries(cat)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const splitData = [
      { name: 'Realized', value: realized, fill: '#34d399' },
      { name: 'Unrealized', value: unrealized, fill: '#a78bfa' },
    ].filter(d => Math.abs(d.value) > 0.01);

    return { catData, splitData, hasData: positions.length >= 2 };
  }, [positions]);

  if (!hasData) return null;

  return (
    <div className="animate-fade-in-up" style={{ animationDelay: '120ms' }}>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">Performance Breakdown</p>
      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">

        {/* P&L by category */}
        <ChartCard title="P&L by Category">
          <ResponsiveContainer width="100%" height={168}>
            <BarChart data={catData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => formatCurrency(v as number, true)} width={56} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<MoneyTooltip />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {catData.map((d) => (
                  <Cell key={d.name} fill={d.value >= 0 ? (CAT_COLORS[d.name] ?? '#64748b') : '#f43f5e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Realized vs unrealized */}
        <ChartCard title="Realized vs Unrealized">
          {splitData.length > 0 ? (
            <ResponsiveContainer width="100%" height={168}>
              <PieChart>
                <Pie
                  data={splitData.map(d => ({ ...d, value: Math.abs(d.value) }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  stroke="none"
                >
                  {splitData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                </Pie>
                <Tooltip content={<MoneyTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[168px] items-center justify-center text-xs text-white/25">No data</div>
          )}
          <div className="mt-2 flex justify-center gap-4">
            {splitData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: d.fill }} />
                <span className="text-[10px] text-white/40">{d.name}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
