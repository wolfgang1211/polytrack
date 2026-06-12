'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { RecentTrade } from '@/types';
import { formatCurrency, formatAddress } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';
import { teamFlag, textMentionsTeam } from '@/lib/wcTeams';

/* ── types ─────────────────────────────────────────────── */

interface WinnerTeam {
  team: string;
  price: number;
  change24h: number;
  volume24hr: number;
  volume: number;
  image?: string;
  slug?: string;
  clobTokenYes?: string;
}

interface WinnerData {
  event: { title: string; slug: string; volume: number; volume24hr: number; liquidity: number; endDate?: string };
  teams: WinnerTeam[];
}

interface WcMarket {
  question?: string;
  groupItemTitle?: string;
  outcomes?: string;
  outcomePrices?: string;
  volume24hr: number;
  gameStartTime: string | null;
  slug?: string;
  oneDayPriceChange?: number;
  lastTradePrice?: number | null;
  clobTokenYes?: string;
}

interface WcEvent {
  id: string;
  title: string;
  slug: string;
  image?: string;
  volume24hr: number;
  volume: number;
  liquidity: number;
  endDate?: string;
  gameStartTime: string | null;
  isMatch: boolean;
  markets: WcMarket[];
}

interface ProPick {
  title: string;
  outcome: string;
  eventSlug?: string;
  slug?: string;
  icon?: string;
  totalValue: number;
  proCount: number;
  wallets: { address: string; name?: string; value: number }[];
}

/* ── helpers ───────────────────────────────────────────── */

function parseJsonArr(s: string | undefined): string[] {
  if (!s) return [];
  try { return JSON.parse(s); } catch { return []; }
}

function yesPrice(m: WcMarket): number | null {
  const p = parseFloat(parseJsonArr(m.outcomePrices)[0] ?? '');
  return isNaN(p) ? null : p;
}

function timeAgo(ts: number | undefined): string {
  if (!ts) return '';
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

function usdcSize(t: RecentTrade): number {
  if (t.usdcSize != null) return Number(t.usdcSize);
  if (t.size != null && t.price != null) return Number(t.size) * Number(t.price);
  if (t.amount != null) return Number(t.amount);
  return 0;
}

function parseKickoff(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso.replace(' ', 'T')).getTime();
  return isNaN(t) ? null : t;
}

function kickoffLabel(iso: string | null): string | null {
  const t = parseKickoff(iso);
  if (t == null) return null;
  const ms = t - Date.now();
  if (ms < -2.5 * 3_600_000) return 'Ended';
  if (ms <= 0) return 'LIVE';
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d ${Math.floor((ms % 86_400_000) / 3_600_000)}h`;
  const hrs = Math.floor(ms / 3_600_000);
  if (hrs >= 1) return `${hrs}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m`;
}

function SectionHeader({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-mono text-[10px] font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.20)' }}>{index}</span>
      <div className="h-px w-12" style={{ background: 'var(--vi-border)' }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.25)' }}>{label}</span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--vi-border), transparent)' }} />
    </div>
  );
}

/* ── pitch backdrop ────────────────────────────────────── */

function PitchLines() {
  return (
    <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 800 260" preserveAspectRatio="xMidYMid slice"
      style={{ opacity: 0.06 }}>
      <rect x="20" y="10" width="760" height="240" rx="8" fill="none" stroke="white" strokeWidth="2" />
      <line x1="400" y1="10" x2="400" y2="250" stroke="white" strokeWidth="2" />
      <circle cx="400" cy="130" r="55" fill="none" stroke="white" strokeWidth="2" />
      <circle cx="400" cy="130" r="4" fill="white" />
      <rect x="20" y="55" width="90" height="150" fill="none" stroke="white" strokeWidth="2" />
      <rect x="690" y="55" width="90" height="150" fill="none" stroke="white" strokeWidth="2" />
      <rect x="20" y="95" width="35" height="70" fill="none" stroke="white" strokeWidth="2" />
      <rect x="745" y="95" width="35" height="70" fill="none" stroke="white" strokeWidth="2" />
    </svg>
  );
}

/* ── countdown ─────────────────────────────────────────── */

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function Countdown({ target, title }: { target: number; title: string }) {
  const now = useNow(1000);
  const ms = target - now;

  if (ms <= 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-mono text-xs font-black text-emerald-400 uppercase tracking-wider">Live now</span>
        <span className="text-xs text-white/40 truncate">{title}</span>
      </div>
    );
  }

  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const cell = (v: number, unit: string) => (
    <div className="flex flex-col items-center rounded-lg px-2.5 py-1.5 min-w-[46px]"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <span className="font-mono text-lg font-black tabular-nums text-white/90">{String(v).padStart(2, '0')}</span>
      <span className="font-mono text-[8px] uppercase tracking-widest text-white/30">{unit}</span>
    </div>
  );

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/30 mb-2">
        Next kickoff · <span className="text-white/50">{title}</span>
      </p>
      <div className="flex items-center gap-1.5">
        {d > 0 && <>{cell(d, 'day')}<span className="text-white/20 font-black">:</span></>}
        {cell(h, 'hrs')}<span className="text-white/20 font-black">:</span>
        {cell(m, 'min')}<span className="text-white/20 font-black">:</span>
        {cell(s, 'sec')}
      </div>
    </div>
  );
}

/* ── country selector ──────────────────────────────────── */

function CountrySelector({
  teams, selected, onSelect,
}: { teams: WinnerTeam[]; selected: string | null; onSelect: (t: string | null) => void }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return teams;
    return teams.filter(t => t.team.toLowerCase().includes(query) || textMentionsTeam(query, t.team));
  }, [teams, q]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-white/40">
          Pick a nation to see <span className="text-white/70 font-semibold">only their markets</span> — odds, matches, futures and money flow.
        </p>
        <div className="relative flex items-center rounded-xl glass sm:w-64">
          <svg className="absolute left-3 h-3.5 w-3.5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search nation… (e.g. Türkiye)"
            className="w-full bg-transparent py-2 pl-9 pr-3 text-xs text-white/80 placeholder-white/25 outline-none"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mb-1" style={{ scrollbarWidth: 'thin' }}>
        <button
          onClick={() => onSelect(null)}
          className={`flex-shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${!selected ? 'text-white' : 'text-white/45 hover:text-white/75'}`}
          style={!selected
            ? { background: 'var(--vi-fill)', border: '1px solid var(--vi-border-lg)' }
            : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          🌍 All Nations
        </button>
        {filtered.map((t, i) => {
          const active = selected === t.team;
          return (
            <button
              key={t.team + i}
              onClick={() => onSelect(active ? null : t.team)}
              title={`${t.team} — ${(t.price * 100).toFixed(1)}% implied`}
              className={`flex-shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${active ? 'text-white' : 'text-white/45 hover:text-white/75'}`}
              style={active
                ? { background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.45)' }
                : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-sm leading-none">{teamFlag(t.team)}</span>
              {t.team}
              <span className="font-mono text-[10px]" style={{ color: active ? '#c4b5fd' : 'rgba(255,255,255,0.25)' }}>
                {t.price * 100 < 1 ? '<1' : (t.price * 100).toFixed(0)}%
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <span className="text-xs text-white/30 py-1.5">No nation matches “{q}” — they may not have markets yet.</span>
        )}
      </div>
    </div>
  );
}

/* ── odds history chart ────────────────────────────────── */

type HistoryInterval = '1d' | '1w' | '1m' | 'max';

function OddsHistoryChart({ token, team, defaultInterval = '1m' }: { token?: string; team: string; defaultInterval?: HistoryInterval }) {
  const [interval, setIntervalSel] = useState<HistoryInterval>(defaultInterval);
  const [points, setPoints] = useState<{ t: number; p: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/worldcup/history?token=${token}&interval=${interval}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.points)) setPoints(d.points); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, interval]);

  const data = useMemo(
    () => points.map(pt => ({ x: pt.t * 1000, y: +(pt.p * 100).toFixed(2) })),
    [points]
  );

  const delta = data.length >= 2 ? data[data.length - 1].y - data[0].y : 0;
  const deltaColor = delta >= 0 ? '#34d399' : '#fb7185';

  return (
    <div className="glass gradient-border rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">
            {team} · Championship odds over time
          </span>
          {data.length >= 2 && (
            <span className="font-mono text-[10px] font-black" style={{ color: deltaColor }}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}pp
            </span>
          )}
        </div>
        <div className="flex gap-1 rounded-lg glass p-0.5">
          {(['1d', '1w', '1m', 'max'] as HistoryInterval[]).map(k => (
            <button key={k} onClick={() => setIntervalSel(k)}
              className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase transition-all ${interval === k ? 'text-white' : 'text-white/35 hover:text-white/65'}`}
              style={interval === k ? { background: 'var(--vi-fill)', border: '1px solid var(--vi-border-md)' } : { border: '1px solid transparent' }}>
              {k}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-48 rounded-xl animate-shimmer" />
      ) : !token || data.length < 2 ? (
        <div className="h-48 flex items-center justify-center">
          <p className="text-sm text-white/25">No price history available yet</p>
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="oddsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="x" type="number" domain={['dataMin', 'dataMax']} scale="time"
                tickFormatter={(v: number) => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={48}
              />
              <YAxis
                tickFormatter={(v: number) => `${v}%`} width={48}
                tick={{ fill: 'rgba(255,255,255,0.30)', fontSize: 10 }} tickLine={false} axisLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{ background: '#16121f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                labelFormatter={v => new Date(Number(v)).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                formatter={value => [`${value}%`, 'Implied odds']}
              />
              <Area type="monotone" dataKey="y" stroke="#a855f7" strokeWidth={2} fill="url(#oddsFill)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ── pros' picks ───────────────────────────────────────── */

function ProsPicks({ team }: { team: string | null }) {
  const [picks, setPicks] = useState<ProPick[]>([]);
  const [scanned, setScanned] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/worldcup/pros')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d?.picks)) setPicks(d.picks);
        if (typeof d?.scanned === 'number') setScanned(d.scanned);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    const base = team
      ? picks.filter(p => textMentionsTeam(p.title, team) || textMentionsTeam(p.outcome, team))
      : picks;
    return base.slice(0, team ? 10 : 8);
  }, [picks, team]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-xl animate-shimmer" />)}
      </div>
    );
  }

  if (shown.length === 0) {
    return (
      <div className="glass rounded-2xl py-12 text-center">
        <p className="text-2xl mb-2">🕵️</p>
        <p className="text-sm text-white/25">
          {team ? `None of the top ${scanned || 'monthly'} traders hold ${team} positions right now` : 'No pro World Cup positions detected right now'}
        </p>
      </div>
    );
  }

  const maxValue = shown.reduce((m, p) => Math.max(m, p.totalValue), 0);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-white/35">
        Open World Cup positions held by this month&apos;s <span className="text-white/60 font-semibold">top {scanned} traders</span> on the P&L leaderboard.
      </p>
      <div className="glass gradient-border rounded-2xl p-2 sm:p-3">
        {shown.map((p, i) => {
          const barPct = maxValue > 0 ? (p.totalValue / maxValue) * 100 : 0;
          return (
            <a key={p.title + p.outcome + i} href={marketUrl(p.eventSlug, p.slug)} target="_blank" rel="noopener noreferrer"
              className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]">
              <div className="absolute inset-y-1 left-0 rounded-xl pointer-events-none"
                style={{ width: `${barPct}%`, background: 'linear-gradient(90deg, rgba(251,191,36,0.10), rgba(251,191,36,0.01))' }} />

              {p.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.icon} alt="" className="relative h-8 w-8 rounded-lg object-cover flex-shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <span className="relative h-8 w-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: 'var(--vi-grad-25)', border: '1px solid var(--vi-border-xs)' }}>⚽</span>
              )}

              <div className="relative flex-1 min-w-0">
                <p className="text-sm font-semibold text-white/80 truncate group-hover:text-white transition-colors">{p.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-[9px] font-bold rounded px-1.5 py-0.5 uppercase"
                    style={{ background: 'rgba(168,85,247,0.12)', color: '#c4b5fd', border: '1px solid rgba(168,85,247,0.25)' }}>
                    {p.outcome}
                  </span>
                  <span className="text-[10px] text-white/30 truncate hidden sm:inline">
                    {p.wallets.map(w => w.name || formatAddress(w.address, 4)).slice(0, 3).join(' · ')}
                  </span>
                </div>
              </div>

              <span className="relative flex-shrink-0 font-mono text-[10px] font-black rounded-full px-2 py-1"
                style={{ background: 'rgba(251,191,36,0.10)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                {p.proCount} pro{p.proCount > 1 ? 's' : ''}
              </span>

              <span className="relative flex-shrink-0 font-mono text-sm font-black tabular-nums w-20 text-right text-white/85">
                {formatCurrency(p.totalValue, true)}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

/* ── upset radar ───────────────────────────────────────── */

function scoreColor(score: number): string {
  if (score >= 70) return '#fb7185';
  if (score >= 40) return '#fbbf24';
  return 'rgba(255,255,255,0.45)';
}

function UpsetRadar({ events, winner }: { events: WcEvent[]; winner: WinnerData | null }) {
  const [trades, setTrades] = useState<RecentTrade[]>([]);

  useEffect(() => {
    fetch('/api/worldcup/trades')
      .then(r => r.json())
      .then(d => { const list = d?.trades; if (Array.isArray(list)) setTrades(list); })
      .catch(() => {});
  }, []);

  /* biggest 24h odds swings on match markets, scored 0–100
     (60% odds move magnitude + 40% relative volume) */
  const movers = useMemo(() => {
    const rows: { label: string; eventTitle: string; change: number; last: number | null; vol: number; eventSlug: string; marketSlug?: string }[] = [];
    for (const e of events) {
      if (!e.isMatch) continue;
      for (const m of e.markets) {
        const ch = m.oneDayPriceChange ?? 0;
        if (Math.abs(ch) < 0.04) continue;
        rows.push({
          label: m.groupItemTitle || m.question || e.title,
          eventTitle: e.title,
          change: ch,
          last: m.lastTradePrice ?? yesPrice(m),
          vol: m.volume24hr ?? 0,
          eventSlug: e.slug,
          marketSlug: m.slug,
        });
      }
    }
    const top = rows.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 6);
    const maxVol = top.reduce((mx, r) => Math.max(mx, r.vol), 0);
    return top.map(r => ({
      ...r,
      score: Math.min(100, Math.round(
        Math.min(60, Math.abs(r.change) * 100 * 4) +
        (maxVol > 0 ? Math.min(40, (r.vol / maxVol) * 40) : 0)
      )),
    }));
  }, [events]);

  /* longshot nations with the most action — shown when swings are quiet */
  const longshots = useMemo(() => {
    const teams = winner?.teams ?? [];
    return teams
      .filter(t => t.price > 0 && t.price <= 0.10)
      .sort((a, b) => b.volume24hr - a.volume24hr)
      .slice(0, 5);
  }, [winner]);

  /* big money on longshots (≤35¢) */
  const underdogMoney = useMemo(
    () => trades
      .filter(t => (t.side ?? '').toUpperCase() === 'BUY' && t.price != null && Number(t.price) <= 0.35 && usdcSize(t) >= 1_000)
      .sort((a, b) => usdcSize(b) - usdcSize(a))
      .slice(0, 6),
    [trades]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Odds swings (or longshot watch when quiet) */}
      <div className="glass gradient-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">
            {movers.length > 0 ? '⚡ Biggest 24h odds swings' : '👀 Longshot watch'}
          </p>
          {movers.length > 0 && (
            <a href="/api/worldcup/card?type=upset" target="_blank" rel="noopener noreferrer"
              title="Open shareable image card"
              className="text-[10px] font-semibold text-white/30 hover:text-white/70 transition-colors">
              📸 Card
            </a>
          )}
        </div>
        {movers.length > 0 ? (
          <div className="flex flex-col gap-1">
            {movers.map((m, i) => {
              const up = m.change > 0;
              return (
                <a key={m.label + i} href={marketUrl(m.eventSlug, m.marketSlug)} target="_blank" rel="noopener noreferrer"
                  className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/[0.04]">
                  <span title="Upset Score: odds move + volume" className="font-mono text-[10px] font-black rounded-md px-1.5 py-1 flex-shrink-0 w-11 text-center"
                    style={{ background: `${scoreColor(m.score)}1a`, color: scoreColor(m.score), border: `1px solid ${scoreColor(m.score)}40` }}>
                    {m.score}
                  </span>
                  <span className="font-mono text-[11px] font-black w-14 flex-shrink-0" style={{ color: up ? '#34d399' : '#fb7185' }}>
                    {up ? '▲' : '▼'} {(Math.abs(m.change) * 100).toFixed(0)}pp
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white/75 truncate group-hover:text-white transition-colors">{m.label}</p>
                    <p className="text-[10px] text-white/30 truncate">{m.eventTitle}</p>
                  </div>
                  {m.last != null && (
                    <span className="font-mono text-xs font-black text-white/60 flex-shrink-0">{(m.last * 100).toFixed(0)}¢</span>
                  )}
                </a>
              );
            })}
          </div>
        ) : longshots.length > 0 ? (
          <>
            <p className="text-[10px] text-white/30 mb-2">No big swings today — these low-odds nations are seeing the most action:</p>
            <div className="flex flex-col gap-1">
              {longshots.map(t => (
                <a key={t.team} href={marketUrl('world-cup-winner', t.slug)} target="_blank" rel="noopener noreferrer"
                  className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/[0.04]">
                  <span className="text-base leading-none flex-shrink-0">{teamFlag(t.team)}</span>
                  <span className="flex-1 min-w-0 truncate text-xs font-semibold text-white/75 group-hover:text-white transition-colors">{t.team}</span>
                  <span className="font-mono text-[10px] text-white/30">{formatCurrency(t.volume24hr, true)} 24h</span>
                  <span className="font-mono text-xs font-black text-grad w-10 text-right">{(t.price * 100).toFixed(0)}¢</span>
                </a>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-white/25 py-6 text-center">Loading radar…</p>
        )}
      </div>

      {/* Longshot money */}
      <div className="glass gradient-border rounded-2xl p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/35 mb-3">🎯 Big money on longshots (≤35¢)</p>
        {underdogMoney.length === 0 ? (
          <p className="text-sm text-white/25 py-6 text-center px-4">
            Whale longshot buys land here — usually right around kickoff.
            Keep an eye on the <a href="#smart-money" className="text-white/50 underline hover:text-white/80">live money feed</a> below.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {underdogMoney.map((t, i) => (
              <a key={String(t.id ?? i)} href={marketUrl(t.eventSlug, t.slug)} target="_blank" rel="noopener noreferrer"
                className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/[0.04]">
                <span className="font-mono text-xs font-black text-grad w-14 flex-shrink-0 text-right">{formatCurrency(usdcSize(t), true)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/75 truncate group-hover:text-white transition-colors">{t.title ?? '—'}</p>
                  <p className="text-[10px] text-white/30 truncate">
                    {t.outcome} @ {t.price != null ? `${(Number(t.price) * 100).toFixed(0)}¢` : '—'} · {timeAgo(t.timestamp ?? t.createdAt)} ago
                  </p>
                </div>
                <span className="font-mono text-[9px] font-black uppercase rounded px-1.5 py-0.5 flex-shrink-0"
                  style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                  BUY
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── match center ──────────────────────────────────────── */

interface MatchGroup {
  key: string;
  teamA: string;
  teamB: string;
  kickoff: number | null;
  status: 'live' | 'upcoming' | 'ended';
  main: WcEvent | null;
  extras: WcEvent[];
  volume24hr: number;
  slugs: string[];
}

function buildMatchGroups(events: WcEvent[]): MatchGroup[] {
  const map = new Map<string, MatchGroup>();
  const now = Date.now();

  for (const e of events) {
    if (!e.isMatch) continue;
    const base = e.title.split(' - ')[0].trim();
    const teams = base.split(/ vs\.? /i);
    if (teams.length !== 2) continue;

    let g = map.get(base);
    if (!g) {
      g = {
        key: base,
        teamA: teams[0].trim(),
        teamB: teams[1].trim(),
        kickoff: null,
        status: 'upcoming',
        main: null,
        extras: [],
        volume24hr: 0,
        slugs: [],
      };
      map.set(base, g);
    }
    const k = parseKickoff(e.gameStartTime);
    if (k != null && g.kickoff == null) g.kickoff = k;
    if (e.title.trim() === base) g.main = e; else g.extras.push(e);
    g.volume24hr += e.volume24hr;
    g.slugs.push(e.slug);
  }

  const groups = [...map.values()];
  for (const g of groups) {
    if (g.kickoff == null) continue;
    const ms = g.kickoff - now;
    g.status = ms <= 0 ? (ms > -2.5 * 3_600_000 ? 'live' : 'ended') : 'upcoming';
  }

  return groups
    .filter(g => g.status !== 'ended')
    .sort((a, b) =>
      (a.status === 'live' ? 0 : 1) - (b.status === 'live' ? 0 : 1) ||
      (a.kickoff ?? Infinity) - (b.kickoff ?? Infinity)
    );
}

/** Moneyline outcomes ordered teamA / draw / teamB. */
function moneylineChips(g: MatchGroup): { label: string; price: number }[] {
  const rows: { label: string; price: number }[] = [];
  for (const m of g.main?.markets ?? []) {
    const p = yesPrice(m);
    const t = (m.groupItemTitle ?? '').replace(/\s*\(.*\)\s*$/, '').trim();
    if (p == null || !t) continue;
    rows.push({ label: t, price: p });
  }
  const find = (name: string) => rows.find(r => r.label.toLowerCase() === name.toLowerCase());
  const a = find(g.teamA);
  const b = find(g.teamB);
  const draw = rows.find(r => /^draw$/i.test(r.label));
  const ordered = [a, draw, b].filter(Boolean) as { label: string; price: number }[];
  return ordered.length >= 2 ? ordered : rows.slice(0, 3);
}

function MatchDetail({ group, trades }: { group: MatchGroup; trades: RecentTrade[] }) {
  const mainTeamMarket = group.main?.markets.find(
    m => (m.groupItemTitle ?? '').toLowerCase().startsWith(group.teamA.toLowerCase())
  );
  const slugSet = useMemo(() => new Set(group.slugs), [group.slugs]);
  const matchTrades = useMemo(
    () => trades.filter(t => t.eventSlug && slugSet.has(t.eventSlug)).slice(0, 8),
    [trades, slugSet]
  );
  const maxAmount = matchTrades.reduce((m, t) => Math.max(m, usdcSize(t)), 0);

  return (
    <div className="flex flex-col gap-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      {/* In-match odds movement */}
      <OddsHistoryChart
        token={mainTeamMarket?.clobTokenYes}
        team={`${group.teamA} to win`}
        defaultInterval="1d"
      />

      {/* Side markets */}
      {group.extras.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/35 mb-2">More markets</p>
          <div className="flex flex-col gap-1.5">
            {group.extras.map(e => {
              const suffix = e.title.includes(' - ') ? e.title.split(' - ').slice(1).join(' - ') : e.title;
              const chips = e.markets
                .map(m => ({ label: (m.groupItemTitle ?? '').replace(/\s*\(.*\)\s*$/, '') || m.question || '', price: yesPrice(m) }))
                .filter(c => c.label && c.price != null)
                .sort((x, y) => (y.price ?? 0) - (x.price ?? 0))
                .slice(0, 4);
              return (
                <a key={e.id} href={marketUrl(e.slug, e.markets[0]?.slug)} target="_blank" rel="noopener noreferrer"
                  className="group flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.04]"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-xs font-semibold text-white/70 group-hover:text-white transition-colors min-w-[120px]">{suffix}</span>
                  <span className="ml-auto flex flex-wrap gap-1.5">
                    {chips.map((c, i) => (
                      <span key={c.label + i} className="font-mono text-[10px] rounded-md px-1.5 py-0.5"
                        style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {c.label} <span className="font-black text-white/80">{((c.price ?? 0) * 100).toFixed(0)}¢</span>
                      </span>
                    ))}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Match money flow */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/35 mb-2">Money on this match</p>
        {matchTrades.length === 0 ? (
          <p className="text-xs text-white/25 py-3 text-center rounded-xl"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            No large trades on this match yet
          </p>
        ) : (
          <div className="rounded-xl overflow-hidden p-1"
            style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
            {matchTrades.map((t, i) => (
              <WcTradeRow key={String(t.id ?? i)} trade={t} maxAmount={maxAmount} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MatchCenterCard({ group, expanded, onToggle, trades }: {
  group: MatchGroup; expanded: boolean; onToggle: () => void; trades: RecentTrade[];
}) {
  const chips = moneylineChips(group);
  const isLive = group.status === 'live';
  const kickoff = group.kickoff ? kickoffLabel(group.main?.gameStartTime ?? null) : null;

  return (
    <div className="glass gradient-border rounded-2xl p-5 animate-fade-in-up">
      {/* Header row */}
      <button onClick={onToggle} className="w-full text-left">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xl leading-none">{teamFlag(group.teamA)}</span>
          <span className="text-sm font-black text-white/90">{group.teamA}</span>
          <span className="font-mono text-[10px] text-white/30">vs</span>
          <span className="text-2xl leading-none">{teamFlag(group.teamB)}</span>
          <span className="text-sm font-black text-white/90">{group.teamB}</span>

          <span className="ml-auto flex items-center gap-2">
            {isLive ? (
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
                style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            ) : kickoff && (
              <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}>
                ⏱ {kickoff}
              </span>
            )}
            <svg className={`h-4 w-4 text-white/30 transition-transform ${expanded ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd" />
            </svg>
          </span>
        </div>

        {/* Implied probability bars */}
        {chips.length > 0 && (
          <div className="mt-4 flex flex-col gap-1.5">
            {chips.map((c, i) => {
              const isDraw = /^draw$/i.test(c.label);
              const color = isDraw ? 'rgba(255,255,255,0.35)' : i === 0 ? '#a855f7' : '#38bdf8';
              return (
                <div key={c.label + i} className="flex items-center gap-2">
                  <span className="w-24 sm:w-32 truncate text-[11px] font-semibold text-white/60 flex-shrink-0">{c.label}</span>
                  <div className="relative flex-1 h-4 rounded-md overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="absolute inset-y-0 left-0 rounded-md"
                      style={{ width: `${c.price * 100}%`, background: `${color}55`, borderRight: `2px solid ${color}`, transition: 'width 0.8s ease' }} />
                  </div>
                  <span className="w-10 text-right font-mono text-xs font-black tabular-nums text-white/85 flex-shrink-0">
                    {(c.price * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] text-white/30">{formatCurrency(group.volume24hr, true)} 24h vol · {group.extras.length + (group.main ? 1 : 0)} markets</span>
          <span className="text-[10px] font-semibold text-white/35">{expanded ? 'Hide details ▲' : 'Match details ▼'}</span>
        </div>
      </button>

      {group.main && (
        <div className="mt-2 flex justify-end gap-1.5">
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
              `${teamFlag(group.teamA)} ${group.teamA} vs ${teamFlag(group.teamB)} ${group.teamB} — live market odds on AlphaBoard`
            )}&url=${encodeURIComponent(`https://www.alphaboard.xyz/worldcup?match=${group.main.slug}`)}`}
            target="_blank" rel="noopener noreferrer"
            title="Share on X — the live odds card renders in the tweet"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-white/40 transition-colors hover:text-white/80"
            style={{ background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.2)' }}>
            🐦 Share on X
          </a>
          <a href={`/api/worldcup/card?type=match&event=${encodeURIComponent(group.main.slug)}`}
            target="_blank" rel="noopener noreferrer"
            title="Open the image — save it to attach natively to a post"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-white/35 transition-colors hover:text-white/75"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            📸 Image
          </a>
        </div>
      )}

      {expanded && <MatchDetail group={group} trades={trades} />}
    </div>
  );
}

function MatchCenter({ events }: { events: WcEvent[] }) {
  const [liveEvents, setLiveEvents] = useState<WcEvent[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [trades, setTrades] = useState<RecentTrade[]>([]);

  /* fresher polling for live/imminent matches */
  useEffect(() => {
    const load = () => {
      fetch('/api/worldcup/live')
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setLiveEvents(d); })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch('/api/worldcup/trades')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.trades)) setTrades(d.trades); })
      .catch(() => {});
  }, []);

  const merged = useMemo(() => {
    if (!liveEvents) return events;
    const byId = new Map(events.map(e => [e.id, e]));
    for (const e of liveEvents) byId.set(e.id, e);
    return [...byId.values()];
  }, [events, liveEvents]);

  const groups = useMemo(() => buildMatchGroups(merged).slice(0, 8), [merged]);
  const liveCount = groups.filter(g => g.status === 'live').length;

  if (groups.length === 0) {
    return (
      <div className="glass rounded-2xl py-12 text-center">
        <p className="text-2xl mb-2">🏟️</p>
        <p className="text-sm text-white/25">Match markets open closer to kickoff — check back soon</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {liveCount > 0 && (
        <p className="text-xs text-white/35">
          <span className="font-bold text-emerald-400">{liveCount} live</span> — implied win probabilities update every ~20s from Polymarket order flow.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map(g => (
          <MatchCenterCard
            key={g.key}
            group={g}
            trades={trades}
            expanded={expanded === g.key}
            onToggle={() => setExpanded(e => (e === g.key ? null : g.key))}
          />
        ))}
      </div>
    </div>
  );
}

/* ── share button ──────────────────────────────────────── */

function ShareButtons({ team }: { team: string }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/worldcup?team=${encodeURIComponent(team)}`
    : `https://www.alphaboard.xyz/worldcup?team=${encodeURIComponent(team)}`;
  const tweet = `${teamFlag(team)} ${team} at the 2026 World Cup — live Polymarket odds & smart money on AlphaBoard`;

  const copy = () => {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  };

  return (
    <div className="flex items-center gap-2">
      <button onClick={copy}
        className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white/70 transition-all hover:text-white"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}>
        {copied ? '✓ Copied!' : (
          <>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Copy link
          </>
        )}
      </button>
      <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(shareUrl)}`}
        target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white/70 transition-all hover:text-white"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Share
      </a>
    </div>
  );
}

/* ── odds race row ─────────────────────────────────────── */

function OddsRow({ team, rank, maxPrice, highlight }: { team: WinnerTeam; rank: number; maxPrice: number; highlight?: boolean }) {
  const pct = team.price * 100;
  const barPct = maxPrice > 0 ? (team.price / maxPrice) * 100 : 0;
  const change = team.change24h * 100;
  const href = marketUrl('world-cup-winner', team.slug);
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
      style={highlight ? { background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.30)' } : undefined}>
      <div className="absolute inset-y-1 left-0 rounded-xl pointer-events-none"
        style={{ width: `${barPct}%`, background: 'linear-gradient(90deg, rgba(124,58,237,0.16), rgba(124,58,237,0.03))', transition: 'width 0.6s ease' }} />

      <span className="relative w-7 text-center font-mono text-[11px] font-black flex-shrink-0"
        style={{ color: rank <= 3 ? '#fbbf24' : 'rgba(255,255,255,0.30)' }}>
        {medal ?? rank}
      </span>

      <span className="relative text-lg leading-none flex-shrink-0 w-7 text-center">{teamFlag(team.team)}</span>

      <span className="relative flex-1 min-w-0 truncate text-sm font-semibold text-white/80 group-hover:text-white transition-colors">
        {team.team}
      </span>

      <span className="relative hidden sm:block font-mono text-[10px] text-white/25 w-20 text-right">
        {formatCurrency(team.volume24hr, true)} 24h
      </span>

      {Math.abs(change) >= 0.5 && (
        <span className="relative font-mono text-[10px] font-bold w-12 text-right"
          style={{ color: change > 0 ? '#34d399' : '#fb7185' }}>
          {change > 0 ? '▲' : '▼'}{Math.abs(change).toFixed(1)}
        </span>
      )}

      <span className="relative font-mono text-base font-black tabular-nums w-16 text-right text-grad">
        {pct < 1 ? '<1' : pct.toFixed(0)}%
      </span>
    </a>
  );
}

function ChampionshipOdds({ data, loading, highlightTeam }: { data: WinnerData | null; loading: boolean; highlightTeam?: string | null }) {
  const [showAll, setShowAll] = useState(false);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 rounded-xl animate-shimmer" />)}
      </div>
    );
  }
  if (!data || data.teams.length === 0) {
    return (
      <div className="glass rounded-2xl py-16 text-center">
        <p className="text-3xl mb-3">🏆</p>
        <p className="text-sm text-white/25">Championship odds unavailable right now</p>
      </div>
    );
  }

  const visible = showAll ? data.teams : data.teams.slice(0, 12);
  const maxPrice = data.teams[0]?.price ?? 0;

  return (
    <div className="glass gradient-border rounded-2xl p-3 sm:p-4">
      <div className="flex flex-col gap-1">
        {visible.map((t, i) => (
          <OddsRow key={t.team + i} team={t} rank={i + 1} maxPrice={maxPrice} highlight={highlightTeam === t.team} />
        ))}
      </div>
      {data.teams.length > 12 && (
        <button onClick={() => setShowAll(s => !s)}
          className="mt-3 w-full rounded-xl py-2 text-xs font-semibold text-white/40 hover:text-white/80 transition-colors"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {showAll ? 'Show less' : `Show all ${data.teams.length} teams`}
        </button>
      )}
    </div>
  );
}

function MoversStrip({ teams }: { teams: WinnerTeam[] }) {
  const movers = useMemo(
    () => [...teams].filter(t => Math.abs(t.change24h) >= 0.005).sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 4),
    [teams]
  );
  if (movers.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {movers.map(t => {
        const up = t.change24h > 0;
        return (
          <div key={t.team} className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: up ? 'rgba(52,211,153,0.07)' : 'rgba(251,113,133,0.07)', border: `1px solid ${up ? 'rgba(52,211,153,0.2)' : 'rgba(251,113,133,0.2)'}` }}>
            <span className="text-base leading-none">{teamFlag(t.team)}</span>
            <span className="text-xs font-bold text-white/75">{t.team}</span>
            <span className="font-mono text-[11px] font-black" style={{ color: up ? '#34d399' : '#fb7185' }}>
              {up ? '▲' : '▼'} {(Math.abs(t.change24h) * 100).toFixed(1)}pp
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── match card ────────────────────────────────────────── */

function MatchCard({ event }: { event: WcEvent }) {
  const href = marketUrl(event.slug, event.markets[0]?.slug);
  const kickoff = kickoffLabel(event.gameStartTime);
  const isLive = kickoff === 'LIVE';

  const chips: { label: string; price: number }[] = [];
  if (event.markets.length > 1) {
    for (const m of event.markets.slice(0, 3)) {
      const p = yesPrice(m);
      if (m.groupItemTitle && p != null) chips.push({ label: m.groupItemTitle, price: p });
    }
  } else if (event.markets[0]) {
    const m = event.markets[0];
    const outcomes = parseJsonArr(m.outcomes);
    const prices = parseJsonArr(m.outcomePrices);
    outcomes.slice(0, 3).forEach((o, i) => {
      const p = parseFloat(prices[i] ?? '');
      if (!isNaN(p)) chips.push({ label: o, price: p });
    });
  }
  chips.sort((a, b) => b.price - a.price);

  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="group glass glass-hover gradient-border rounded-2xl p-5 flex flex-col gap-4 animate-fade-in-up">
      <div className="flex items-start gap-3">
        {event.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.image} alt="" className="h-10 w-10 rounded-xl object-cover flex-shrink-0"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center text-base"
            style={{ background: 'var(--vi-grad-25)', border: '1px solid var(--vi-border-xs)' }}>⚽</div>
        )}
        <p className="text-sm font-semibold text-white/85 line-clamp-2 leading-snug flex-1 group-hover:text-white transition-colors">
          {event.title}
        </p>
      </div>

      <div className="flex items-center gap-2 -mt-1">
        {kickoff && (
          <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={isLive
              ? { background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }
              : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.40)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {isLive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />}
            {isLive ? 'Live' : kickoff === 'Ended' ? 'Ended' : `Kickoff ${kickoff}`}
          </span>
        )}
        <span className="ml-auto text-[10px] font-semibold text-white/30">
          {formatCurrency(event.volume24hr, true)} 24h vol
        </span>
      </div>

      {chips.length > 0 && (
        <div className="flex gap-2">
          {chips.map((c, i) => (
            <div key={c.label + i} className="flex-1 rounded-xl px-2 py-2 text-center min-w-0"
              style={i === 0
                ? { background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.28)' }
                : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[11px] font-semibold text-white/40 truncate">{c.label}</p>
              <p className={`text-base font-black ${i === 0 ? 'text-grad' : 'text-white/70'}`}>
                {(c.price * 100).toFixed(0)}¢
              </p>
            </div>
          ))}
        </div>
      )}
    </a>
  );
}

/* ── team spotlight ────────────────────────────────────── */

interface TeamFuture {
  eventTitle: string;
  question?: string;
  price: number | null;
  volume24hr: number;
  eventSlug: string;
  marketSlug?: string;
}

function TeamSpotlight({
  team, winner, matches, futures,
}: {
  team: string;
  winner: WinnerData | null;
  matches: WcEvent[];
  futures: TeamFuture[];
}) {
  const entry = winner?.teams.find(t => t.team === team) ?? null;
  const rank = entry && winner ? winner.teams.indexOf(entry) + 1 : null;
  const pct = entry ? entry.price * 100 : null;
  const change = entry ? entry.change24h * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Identity card */}
      <div className="relative glass gradient-border rounded-2xl p-6 overflow-hidden">
        <div className="absolute -right-6 -top-10 text-[140px] leading-none select-none pointer-events-none" style={{ opacity: 0.08 }}>
          {teamFlag(team)}
        </div>
        <div className="relative flex flex-wrap items-center gap-5">
          <span className="text-6xl leading-none">{teamFlag(team)}</span>
          <div className="flex-1 min-w-[180px]">
            <h2 className="text-2xl font-black text-white">{team}</h2>
            <p className="text-xs text-white/40 mt-1">
              {rank ? <>Ranked <span className="text-white/70 font-bold">#{rank}</span> by the market to lift the trophy</> : 'No championship market found for this nation'}
            </p>
            <div className="mt-3"><ShareButtons team={team} /></div>
          </div>
          <div className="flex gap-3">
            <div className="rounded-xl px-4 py-3 text-center" style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.3)' }}>
              <p className="text-[10px] uppercase tracking-wider text-white/30">Win World Cup</p>
              <p className="text-2xl font-black text-grad">{pct == null ? '—' : pct < 1 ? '<1%' : `${pct.toFixed(1)}%`}</p>
              {Math.abs(change) >= 0.1 && (
                <p className="font-mono text-[10px] font-bold" style={{ color: change > 0 ? '#34d399' : '#fb7185' }}>
                  {change > 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}pp 24h
                </p>
              )}
            </div>
            <div className="rounded-xl px-4 py-3 text-center glass">
              <p className="text-[10px] uppercase tracking-wider text-white/30">24h Volume</p>
              <p className="text-2xl font-black text-white/85">{entry ? formatCurrency(entry.volume24hr, true) : '—'}</p>
              <p className="font-mono text-[10px] text-white/25">on winner mkt</p>
            </div>
          </div>
        </div>
      </div>

      {/* Odds history */}
      <OddsHistoryChart token={entry?.clobTokenYes} team={team} />

      {/* Their matches */}
      <div>
        <SectionHeader index="[A]" label={`${team} · Matches`} />
        {matches.length === 0 ? (
          <div className="glass rounded-2xl py-12 text-center">
            <p className="text-2xl mb-2">📅</p>
            <p className="text-sm text-white/25">No open match markets for {team} yet — they appear closer to kickoff</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((e, i) => (
              <div key={e.id ?? i} style={{ animationDelay: `${Math.min(i, 12) * 50}ms` }}>
                <MatchCard event={e} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team futures */}
      <div>
        <SectionHeader index="[B]" label={`${team} · Futures & Specials`} />
        {futures.length === 0 ? (
          <div className="glass rounded-2xl py-12 text-center">
            <p className="text-2xl mb-2">🎯</p>
            <p className="text-sm text-white/25">No futures markets mention {team} right now</p>
          </div>
        ) : (
          <div className="glass gradient-border rounded-2xl p-2 sm:p-3">
            {futures.map((f, i) => (
              <a key={f.eventTitle + i} href={marketUrl(f.eventSlug, f.marketSlug)} target="_blank" rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.04]">
                <span className="text-base leading-none flex-shrink-0">{teamFlag(team)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white/80 truncate group-hover:text-white transition-colors">{f.eventTitle}</p>
                  {f.question && <p className="text-[11px] text-white/30 truncate">{f.question}</p>}
                </div>
                <span className="hidden sm:block font-mono text-[10px] text-white/25 w-20 text-right">
                  {formatCurrency(f.volume24hr, true)} 24h
                </span>
                <span className="font-mono text-base font-black tabular-nums w-14 text-right text-grad">
                  {f.price == null ? '—' : `${(f.price * 100).toFixed(0)}¢`}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── smart money feed ──────────────────────────────────── */

function WcTradeRow({ trade, maxAmount }: { trade: RecentTrade; maxAmount: number }) {
  const amount = usdcSize(trade);
  const isBuy = (trade.side ?? '').toUpperCase() === 'BUY';
  const ts = trade.timestamp ?? trade.createdAt;
  const href = marketUrl(trade.eventSlug, trade.slug);
  const wallet = trade.proxyWallet ? formatAddress(trade.proxyWallet, 6) : '—';
  const isWhale = amount >= 10_000;
  const accent = isBuy ? '#34d399' : '#fb7185';
  const barPct = maxAmount > 0 ? Math.min((amount / maxAmount) * 100, 100) : 0;

  return (
    <div className="group relative flex items-center gap-2 py-1.5 pl-3 pr-2 rounded-md transition-colors hover:bg-white/[0.03] animate-fade-in">
      <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full" style={{ background: accent }} />
      <div className="absolute inset-y-0 left-0 rounded-md pointer-events-none"
        style={{ width: `${barPct}%`, background: `${accent}09`, transition: 'width 0.6s ease' }} />

      <span className="relative flex-shrink-0 font-mono text-[9px] font-black uppercase w-9 text-center rounded px-1 py-0.5"
        style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}38` }}>
        {isBuy ? 'BUY' : 'SELL'}
      </span>

      <span className="relative flex-shrink-0 flex items-center gap-1 w-[76px] justify-end text-right">
        {isWhale && <span title="Whale" className="text-[10px]">🐋</span>}
        <span className={`font-mono text-xs font-black tabular-nums ${isWhale ? 'text-grad' : ''}`}
          style={{ color: isWhale ? undefined : 'rgba(255,255,255,0.88)' }}>
          {formatCurrency(amount, true)}
        </span>
      </span>

      {trade.outcome && (
        <span className="relative flex-shrink-0 hidden md:inline font-mono text-[9px] rounded px-1.5 py-0.5 max-w-[90px] truncate"
          style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {trade.outcome}
        </span>
      )}

      <a href={href} target="_blank" rel="noopener noreferrer"
        className="relative flex-1 min-w-0 text-[11px] transition-colors truncate hover:opacity-80"
        style={{ color: 'rgba(255,255,255,0.48)' }}>
        {trade.title ?? '—'}
      </a>

      <div className="relative flex-shrink-0 text-right hidden sm:block w-[52px]">
        <a href={trade.proxyWallet ? `/wallet/${trade.proxyWallet.toLowerCase()}` : undefined}
          className="font-mono text-[9px] block truncate hover:opacity-80"
          style={{ color: 'rgba(255,255,255,0.28)' }}>
          {wallet}
        </a>
        <p className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.18)' }}>{timeAgo(ts)}</p>
      </div>
    </div>
  );
}

function WcSmartMoney({ team }: { team: string | null }) {
  const [trades, setTrades] = useState<RecentTrade[]>([]);
  const [belowThreshold, setBelowThreshold] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    fetch('/api/worldcup/trades')
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : (d?.trades ?? []);
        if (!Array.isArray(list)) return;
        setBelowThreshold(Boolean(d?.belowThreshold));
        setTrades(list);
        setLastUpdate(new Date());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 15_000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [load]);

  const shown = useMemo(() => {
    if (!team) return trades;
    return trades.filter(t =>
      textMentionsTeam(t.title, team) ||
      textMentionsTeam(t.outcome, team) ||
      textMentionsTeam(t.eventSlug, team)
    );
  }, [trades, team]);

  const maxAmount = shown.reduce((m, t) => Math.max(m, usdcSize(t)), 0);

  return (
    <section className="flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] font-bold"
            style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.20)' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            Live
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {team ? `${team} Money Flow` : 'WC Smart Money'} {!belowThreshold && <span style={{ color: 'rgba(255,255,255,0.20)' }}>$250+</span>}
          </span>
        </div>
        <span className="flex items-center gap-3">
          <a href="/api/worldcup/card?type=whale" target="_blank" rel="noopener noreferrer"
            title="Open shareable whale card"
            className="text-[10px] font-semibold text-white/30 hover:text-white/70 transition-colors">
            📸 Whale card
          </a>
          {lastUpdate && (
            <span className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.18)' }}>
              {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </span>
      </div>

      <div className="rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
        {loading ? (
          <div className="flex flex-col gap-1.5 p-2">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-8 rounded-md animate-shimmer" />)}
          </div>
        ) : shown.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-2xl mb-2">⚽</p>
            <p className="font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
              {team ? `No recent large trades on ${team} markets` : 'No recent World Cup trades — check back at kickoff'}
            </p>
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto p-1.5">
            {shown.map((t, i) => (
              <WcTradeRow key={String(t.id ?? `${t.proxyWallet}-${t.timestamp}-${i}`)} trade={t} maxAmount={maxAmount} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── page client ───────────────────────────────────────── */

type Tab = 'matches' | 'futures';

export default function WorldCupClient({
  initialTeam, initialWinner = null, initialEvents = [],
}: {
  initialTeam: string | null;
  initialWinner?: WinnerData | null;
  initialEvents?: WcEvent[];
}) {
  const [winner, setWinner] = useState<WinnerData | null>(initialWinner);
  const [winnerLoading, setWinnerLoading] = useState(initialWinner == null);
  const [events, setEvents] = useState<WcEvent[]>(initialEvents);
  const [eventsLoading, setEventsLoading] = useState(initialEvents.length === 0);
  const [tab, setTab] = useState<Tab>('matches');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(initialTeam);

  /* keep URL shareable: /worldcup?team=Türkiye */
  const selectTeam = useCallback((team: string | null) => {
    setSelectedTeam(team);
    if (typeof window !== 'undefined') {
      const url = team ? `/worldcup?team=${encodeURIComponent(team)}` : '/worldcup';
      window.history.replaceState(null, '', url);
    }
  }, []);

  useEffect(() => {
    // Only fetch what the server didn't already provide.
    if (winnerLoading) {
      fetch('/api/worldcup/winner')
        .then(r => r.json())
        .then(d => { if (d?.teams) setWinner(d); })
        .catch(() => {})
        .finally(() => setWinnerLoading(false));
    }
    if (eventsLoading) {
      fetch('/api/worldcup/matches')
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setEvents(d); })
        .catch(() => {})
        .finally(() => setEventsLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matches = useMemo(() => {
    const ms = events.filter(e => e.isMatch);
    return ms.sort((a, b) => {
      const ta = parseKickoff(a.gameStartTime) ?? Infinity;
      const tb = parseKickoff(b.gameStartTime) ?? Infinity;
      return ta - tb;
    });
  }, [events]);

  const futures = useMemo(
    () => events.filter(e => !e.isMatch).sort((a, b) => b.volume24hr - a.volume24hr),
    [events]
  );

  const teamMatches = useMemo(
    () => (selectedTeam ? matches.filter(e => textMentionsTeam(e.title, selectedTeam)) : []),
    [matches, selectedTeam]
  );

  const teamFutures = useMemo<TeamFuture[]>(() => {
    if (!selectedTeam) return [];
    const out: TeamFuture[] = [];
    for (const e of futures) {
      const titleHit = textMentionsTeam(e.title, selectedTeam);
      const m = e.markets.find(mk =>
        textMentionsTeam(mk.groupItemTitle, selectedTeam) || textMentionsTeam(mk.question, selectedTeam)
      );
      if (!titleHit && !m) continue;
      const market = m ?? (titleHit ? e.markets[0] : undefined);
      out.push({
        eventTitle: e.title,
        question: market?.question !== e.title ? market?.question : undefined,
        price: market ? yesPrice(market) : null,
        volume24hr: e.volume24hr,
        eventSlug: e.slug,
        marketSlug: market?.slug,
      });
    }
    return out.sort((a, b) => b.volume24hr - a.volume24hr);
  }, [futures, selectedTeam]);

  const nextMatch = useMemo(() => {
    const now = Date.now();
    return matches.find(e => {
      const t = parseKickoff(e.gameStartTime);
      return t != null && t > now;
    }) ?? null;
  }, [matches]);

  const liveCount = useMemo(
    () => matches.filter(e => kickoffLabel(e.gameStartTime) === 'LIVE').length,
    [matches]
  );

  const shown = tab === 'matches' ? matches : futures;
  const totalWcVol = winner?.event.volume ?? 0;
  const favorite = winner?.teams[0];

  return (
    <div className="flex flex-col gap-8">

      {/* ── [01] Hero ── */}
      <div className="relative animate-fade-in-up">
        <SectionHeader index="[01]" label="World Cup 2026 · Special Coverage" />

        <div className="relative glass gradient-border rounded-2xl px-6 py-7 overflow-hidden">
          <PitchLines />
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at top right, rgba(124,58,237,0.12), transparent 60%)' }} />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h1 className="text-3xl font-black leading-none tracking-tight sm:text-4xl mb-3">
                <span className="text-white">World Cup</span>{' '}
                <span className="text-grad">2026 Hub</span> <span className="align-middle">🏆</span>
              </h1>
              <p className="text-sm text-white/40">
                Track every World Cup 2026 market before the crowd does — odds, smart money
                and nation-by-nation momentum in one dashboard.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href="#nation-picker"
                  className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white transition-all hover:scale-[1.02]"
                  style={{ background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.45)' }}>
                  🌍 Pick your nation
                </a>
                <a href="#match-center"
                  className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white/70 transition-all hover:text-white"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
                  🏟️ Match center
                </a>
                <a href="#smart-money"
                  className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white/70 transition-all hover:text-white"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
                  🐋 View smart money
                </a>
                <a href="#upset-radar"
                  className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white/70 transition-all hover:text-white"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
                  📡 Upset radar
                </a>
              </div>
              {liveCount > 0 && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                  style={{ background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {liveCount} match{liveCount > 1 ? 'es' : ''} live now
                </p>
              )}
            </div>

            {nextMatch && parseKickoff(nextMatch.gameStartTime) != null && (
              <Countdown target={parseKickoff(nextMatch.gameStartTime)!} title={nextMatch.title} />
            )}
          </div>

          {/* Stats strip */}
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Winner Mkt Volume', value: totalWcVol ? formatCurrency(totalWcVol, true) : '—' },
              { label: '24h Volume', value: winner ? formatCurrency(winner.event.volume24hr, true) : '—' },
              { label: 'Market Favorite', value: favorite ? `${teamFlag(favorite.team)} ${favorite.team}` : '—' },
              { label: 'Implied Odds', value: favorite ? `${(favorite.price * 100).toFixed(0)}%` : '—' },
            ].map(s => (
              <div key={s.label} className="rounded-xl px-4 py-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] uppercase tracking-wider text-white/25">{s.label}</p>
                <p className="text-lg font-black text-white/85 truncate">
                  {winnerLoading
                    ? <span className="animate-pulse text-sm font-semibold text-white/30">Loading live data…</span>
                    : s.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── [02] Nation picker ── */}
      <div id="nation-picker" className="scroll-mt-24">
        <SectionHeader index="[02]" label="Pick Your Nation" />
        {winnerLoading ? (
          <div className="h-10 rounded-xl animate-shimmer" />
        ) : (
          <CountrySelector teams={winner?.teams ?? []} selected={selectedTeam} onSelect={selectTeam} />
        )}
      </div>

      {selectedTeam ? (
        /* ── Team mode ── */
        <>
          <div>
            <SectionHeader index="[03]" label={`Team Spotlight · ${selectedTeam}`} />
            <TeamSpotlight team={selectedTeam} winner={winner} matches={teamMatches} futures={teamFutures} />
          </div>
          <div>
            <SectionHeader index="[04]" label={`Pros Holding ${selectedTeam}`} />
            <ProsPicks team={selectedTeam} />
          </div>
          <div id="smart-money" className="scroll-mt-24">
            <SectionHeader index="[05]" label={`${selectedTeam} · Money Flow`} />
            <WcSmartMoney team={selectedTeam} />
          </div>
        </>
      ) : (
        /* ── All-nations mode ── */
        <>
          <div id="match-center" className="scroll-mt-24">
            <SectionHeader index="[03]" label="Match Center · Live & Upcoming" />
            <MatchCenter events={events} />
          </div>

          <div>
            <SectionHeader index="[04]" label="Championship Odds Race" />
            {winner && winner.teams.length > 0 && (
              <div className="mb-4"><MoversStrip teams={winner.teams} /></div>
            )}
            <ChampionshipOdds data={winner} loading={winnerLoading} highlightTeam={selectedTeam} />
          </div>

          <div>
            <SectionHeader index="[05]" label="What The Pros Are Holding" />
            <ProsPicks team={null} />
          </div>

          <div id="upset-radar" className="scroll-mt-24">
            <SectionHeader index="[06]" label="Upset Radar" />
            <UpsetRadar events={events} winner={winner} />
          </div>

          <div>
            <SectionHeader index="[07]" label="Tournament Markets" />
            <div className="flex items-center gap-2 mb-4">
              <div className="flex gap-1 rounded-xl glass p-1">
                {([['matches', `Matches (${matches.length})`], ['futures', `Futures (${futures.length})`]] as [Tab, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => setTab(key)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${tab === key ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
                    style={tab === key ? { background: 'var(--vi-fill)', border: '1px solid var(--vi-border-md)' } : { border: '1px solid transparent' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {eventsLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass rounded-2xl h-48 animate-shimmer" />)}
              </div>
            ) : shown.length === 0 ? (
              <div className="glass rounded-2xl py-16 text-center">
                <p className="text-3xl mb-3">⚽</p>
                <p className="text-sm text-white/25">No {tab} markets right now</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shown.slice(0, 24).map((e, i) => (
                  <div key={e.id ?? i} style={{ animationDelay: `${Math.min(i, 12) * 50}ms` }}>
                    <MatchCard event={e} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div id="smart-money" className="scroll-mt-24">
            <SectionHeader index="[08]" label="World Cup Smart Money" />
            <WcSmartMoney team={null} />
          </div>
        </>
      )}
    </div>
  );
}
