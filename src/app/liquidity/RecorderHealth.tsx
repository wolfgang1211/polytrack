'use client';

import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from 'recharts';
import type { RecorderHealthResponse, RecorderStatus } from '@/app/api/liquidity/recorder-health/route';

/* Recorder Health (LH-10) — is the 10-minute snapshot recorder alive, how much
   replayable history has it built, and how gappy is it? Feeds off
   /api/liquidity/recorder-health. This is the diagnostic layer under the
   Backtester: it explains WHY a 7-day backtest is or isn't trustworthy yet. */

const STATUS_META: Record<RecorderStatus, { label: string; color: string; dot: boolean }> = {
  healthy:  { label: 'Recording',   color: '#34d399', dot: true },
  delayed:  { label: 'Delayed',     color: '#fbbf24', dot: true },
  stale:    { label: 'Stalled',     color: '#fb7185', dot: false },
  empty:    { label: 'No data yet',  color: '#94a3b8', dot: false },
  disabled: { label: 'Disabled',    color: '#94a3b8', dot: false },
};

function SectionHeader({ index, label, controls }: { index: string; label: string; controls?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-mono text-[10px] font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.20)' }}>{index}</span>
      <div className="h-px w-12" style={{ background: 'var(--vi-border)' }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.25)' }}>{label}</span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--vi-border), transparent)' }} />
      {controls && <div className="flex-shrink-0 ml-2">{controls}</div>}
    </div>
  );
}

function ago(min: number | null): string {
  if (min == null) return '—';
  if (min < 1) return 'just now';
  if (min < 60) return `${Math.round(min)}m ago`;
  const h = min / 60;
  if (h < 24) return `${h.toFixed(1)}h ago`;
  return `${(h / 24).toFixed(1)}d ago`;
}

function span(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl px-3.5 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-black tabular-nums" style={{ color: color ?? 'rgba(255,255,255,0.88)' }}>{value}</p>
      {sub && <p className="text-[10px] text-white/25 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function RecorderHealth() {
  const [data, setData] = useState<RecorderHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    const load = () => {
      fetch('/api/liquidity/recorder-health')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((d: RecorderHealthResponse) => { if (live) setData(d); })
        .catch(() => { if (live) setData(null); })
        .finally(() => { if (live) setLoading(false); });
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { live = false; clearInterval(t); };
  }, []);

  const meta = STATUS_META[data?.status ?? 'empty'];

  const chartData = useMemo(
    () => (data?.buckets ?? []).map(b => ({ t: b.t, count: b.count })),
    [data],
  );
  const maxCount = useMemo(
    () => chartData.reduce((m, b) => Math.max(m, b.count), 0),
    [chartData],
  );

  // Rough ETA to a full replayable 7-day window, assuming the recorder keeps
  // running at cadence from now on.
  const remainingDays = data && data.coveredHours < data.targetHours
    ? Math.ceil((data.targetHours - data.coveredHours) / 24)
    : 0;

  return (
    <section>
      <SectionHeader index="[08b]" label="Recorder Health" controls={
        <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: `${meta.color}14`, border: `1px solid ${meta.color}40`, color: meta.color }}>
          {meta.dot && <span className="h-1.5 w-1.5 rounded-full inline-block animate-pulse" style={{ background: meta.color }} />}
          {meta.label}
        </span>
      } />

      <div className="glass rounded-2xl p-5 flex flex-col gap-5" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {loading && (
          <div className="grid gap-3 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-xl animate-shimmer" />)}
          </div>
        )}

        {!loading && data?.enabled === false && (
          <p className="text-center text-sm text-white/25 py-6">
            Snapshot storage isn&apos;t configured — the recorder needs the KV history store (UPSTASH_REDIS_REST_URL / _TOKEN).
          </p>
        )}

        {!loading && data?.enabled && data.snapshots === 0 && (
          <p className="text-center text-sm text-white/25 py-6">
            No snapshots recorded yet. Once the 10-minute recorder runs, coverage and cadence stats appear here.
          </p>
        )}

        {!loading && data?.enabled && data.snapshots > 0 && (
          <>
            {/* Key stats */}
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="Snapshots" value={data.snapshots.toLocaleString()} sub={`${data.marketsLatest} markets tracked`} color="#a78bfa" />
              <Stat label="History Span" value={span(data.historyHours)} sub={`${span(data.coveredHours)} replayable`} color="#60a5fa" />
              <Stat label="Last Recorded" value={ago(data.lastAgeMin)}
                sub={data.status === 'healthy' ? 'on schedule' : data.status === 'delayed' ? 'a beat behind' : 'recorder may be down'}
                color={meta.color} />
              <Stat label="Cadence" value={data.medianIntervalMin != null ? `${data.medianIntervalMin}m` : '—'} sub={`target ${data.cadenceMin}m`} color="#34d399" />
              <Stat label="Gaps" value={`${data.gapsOverCap}`} sub={data.gapsOverCap === 0 ? 'no coverage breaks' : `>3h breaks · ${data.gapsOverMiss} missed`}
                color={data.gapsOverCap > 0 ? '#fb7185' : 'rgba(255,255,255,0.88)'} />
            </div>

            {/* 7-day coverage progress */}
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="font-semibold uppercase tracking-widest text-white/35">Replayable coverage → 7-day window</span>
                <span className="font-black tabular-nums" style={{ color: data.coveragePct >= 100 ? '#34d399' : '#fbbf24' }}>
                  {data.coveragePct.toFixed(0)}%
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(2, data.coveragePct)}%`,
                    background: data.coveragePct >= 100
                      ? 'linear-gradient(90deg,#34d399,#10b981)'
                      : 'linear-gradient(90deg,#fbbf24,#f97316)',
                  }} />
              </div>
              <p className="mt-1.5 text-[10px] text-white/30">
                {(data.coveredHours / 24).toFixed(1)}d of {(data.targetHours / 24).toFixed(1)}d recorded
                {remainingDays > 0
                  ? ` · ~${remainingDays} more day${remainingDays > 1 ? 's' : ''} of recording for a full 7-day backtest`
                  : ' · full 7-day backtest available'}
                {data.longestGapHours >= 3 && ` · longest gap ${data.longestGapHours.toFixed(1)}h`}
              </p>
            </div>

            {/* Hourly density — empty bars are hours with no snapshot (gaps) */}
            {chartData.length > 1 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/35">
                  Snapshots per hour <span className="text-white/20 normal-case tracking-normal">· empty columns = gaps</span>
                </p>
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={chartData} margin={{ top: 2, right: 4, left: 4, bottom: 0 }} barCategoryGap={1}>
                    <XAxis dataKey="t" type="category"
                      tickFormatter={t => new Date(t as number).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                      axisLine={false} tickLine={false} minTickGap={48} interval="preserveStartEnd" />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={{ background: 'rgba(13,13,26,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                      labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                      labelFormatter={t => new Date(t as number).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit' })}
                      formatter={(v) => [`${v} snapshot${Number(v) === 1 ? '' : 's'}`, 'Recorded'] as [string, string]} />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                      {chartData.map((b, i) => (
                        <Cell key={i} fill={b.count === 0 ? 'rgba(251,113,133,0.18)' : maxCount > 0 && b.count >= maxCount * 0.5 ? '#34d399' : '#60a5fa'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <p className="text-[10px] text-white/25 leading-relaxed">
              {`The recorder snapshots reward-farm liquidity, spread and daily pool every ${data.cadenceMin} minutes into KV. `}
              {`"Replayable" coverage counts only observed time — gaps beyond 3h aren't credited, matching the Backtester. `}
              {`If cadence drifts far above ${data.cadenceMin}m or status shows Stalled, the cron pinger likely needs attention.`}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
