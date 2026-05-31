'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RecentTrade } from '@/types';
import { formatCurrency, formatAddress } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';

const REFRESH_MS = 2_000;

/* ── helpers ──────────────────────────────────────────── */
function tsOf(t: RecentTrade): number { return Number(t.timestamp ?? t.createdAt ?? 0); }
function usd(t: RecentTrade): number {
  if (t.usdcSize != null) return Number(t.usdcSize);
  if (t.size != null && t.price != null) return Number(t.size) * Number(t.price);
  if (t.amount != null) return Number(t.amount);
  return 0;
}
function isBuy(t: RecentTrade): boolean { return (t.side ?? '').toUpperCase() === 'BUY'; }
function keyOf(t: RecentTrade): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = (t as any).transactionHash ?? t.id ?? '';
  return `${tx}-${t.asset ?? ''}-${t.outcomeIndex ?? ''}-${tsOf(t)}`;
}
function timeAgo(ts: number): string {
  if (!ts) return '';
  const d = Math.floor(Date.now() / 1000) - ts;
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}
function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

type SizeFilter = 'all' | 'lt100' | '100-1k' | '1k-10k' | '10k';
const SIZE_FILTERS: { key: SizeFilter; label: string; min: number; max: number }[] = [
  { key: 'all',    label: 'All Sizes',  min: 0,      max: Infinity },
  { key: 'lt100',  label: '< $100',     min: 0,      max: 100 },
  { key: '100-1k', label: '$100 - 1K',  min: 100,    max: 1_000 },
  { key: '1k-10k', label: '$1K - 10K',  min: 1_000,  max: 10_000 },
  { key: '10k',    label: '$10K+',      min: 10_000, max: Infinity },
];

interface MarketAgg {
  title: string;
  icon?: string;
  total: number;
  buy: number;
  sell: number;
  outcome: string;
  href: string;
}

/* ── stat card ────────────────────────────────────────── */
function Stat({ label, value, valueClass, dot }: { label: string; value: string; valueClass?: string; dot?: boolean }) {
  return (
    <div className="glass rounded-2xl px-4 py-3">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/35">
        {dot && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />}
        {label}
      </p>
      <p className={`mt-1 text-lg font-black tabular-nums ${valueClass ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

export default function ActivityPage() {
  const [trades, setTrades] = useState<RecentTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>('all');
  const [q, setQ] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set());
  const startedAt = useRef(Date.now());
  const seenRef = useRef<Map<string, RecentTrade>>(new Map());
  const firstRef = useRef(true);

  useEffect(() => {
    let live = true;
    const load = () => {
      // Fetch DIRECTLY from Polymarket's data-api in the browser — bypasses our
      // Vercel route and any edge/CDN caching, so the feed is genuinely live.
      // Falls back to our own route if the direct call is blocked (CORS).
      const direct = `https://data-api.polymarket.com/trades?limit=500&_=${Date.now()}`;
      fetch(direct, { cache: 'no-store' })
        .then(r => r.json())
        .then(d => (Array.isArray(d) ? d : (d?.trades ?? [])))
        .catch(() => fetch(`/api/activity?t=${Date.now()}`, { cache: 'no-store' }).then(r => r.json()).then(d => d?.trades ?? []))
        .then((incomingRaw: RecentTrade[]) => {
          if (!live || !Array.isArray(incomingRaw)) return;
          const incoming = incomingRaw;
          const fresh = new Set<string>();
          for (const t of incoming) {
            const k = keyOf(t);
            if (!seenRef.current.has(k)) {
              if (!firstRef.current) fresh.add(k);
              seenRef.current.set(k, t);
            }
          }
          firstRef.current = false;
          // keep a continuously-growing feed: newest 500 across all polls
          const merged = [...seenRef.current.values()].sort((a, b) => tsOf(b) - tsOf(a)).slice(0, 500);
          seenRef.current = new Map(merged.map(t => [keyOf(t), t]));
          setTrades(merged);
          setLastUpdate(new Date());
          if (fresh.size) {
            setFlashKeys(fresh);
            setTimeout(() => setFlashKeys(new Set()), 1500);
          }
        })
        .catch(() => {})
        .finally(() => { if (live) setLoading(false); });
    };
    load();
    const id = setInterval(() => { if (!paused) load(); }, REFRESH_MS);
    return () => { live = false; clearInterval(id); };
  }, [paused]);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const range = SIZE_FILTERS.find(s => s.key === sizeFilter)!;
  const filtered = useMemo(
    () => trades.filter(t => { const u = usd(t); return u >= range.min && u < range.max; })
      .sort((a, b) => tsOf(b) - tsOf(a)),
    [trades, range.min, range.max]
  );

  const stats = useMemo(() => {
    let volume = 0, buys = 0, sells = 0;
    for (const t of filtered) {
      volume += usd(t);
      if (isBuy(t)) buys++; else sells++;
    }
    return { volume, buys, sells, count: filtered.length };
  }, [filtered]);

  // aggregate by market for the treemap
  const treemap = useMemo<MarketAgg[]>(() => {
    const map = new Map<string, MarketAgg>();
    for (const t of filtered) {
      const title = t.title ?? t.asset ?? '—';
      const u = usd(t);
      const a = map.get(title) ?? {
        title, icon: t.icon, total: 0, buy: 0, sell: 0,
        outcome: t.outcome ?? '', href: marketUrl(t.eventSlug, t.slug),
      };
      a.total += u;
      if (isBuy(t)) a.buy += u; else a.sell += u;
      if (!a.icon && t.icon) a.icon = t.icon;
      map.set(title, a);
    }
    return [...map.values()].sort((x, y) => y.total - x.total).slice(0, 24);
  }, [filtered]);

  const maxTotal = treemap[0]?.total ?? 1;

  const tableRows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const rows = query
      ? filtered.filter(t =>
          (t.title ?? '').toLowerCase().includes(query) ||
          (t.proxyWallet ?? '').toLowerCase().includes(query))
      : filtered;
    return rows.slice(0, 60);
  }, [filtered, q]);

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.3),rgba(147,51,234,0.3))', border: '1px solid rgba(139,92,246,0.25)' }}>
            <svg className="h-4 w-4 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              <span className="text-white">Live Trading </span><span className="text-grad">Activity</span>
            </h1>
            <p className="text-xs text-white/40">Real-time market trades and volume from Polymarket</p>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
        <Stat label="Status" value={paused ? 'Paused' : 'Live'} valueClass={paused ? 'text-amber-400' : 'text-emerald-400'} dot={!paused} />
        <Stat label="Volume" value={formatCurrency(stats.volume, true)} valueClass="text-grad" />
        <Stat label="Trades" value={String(stats.count)} />
        <Stat label="Buys" value={String(stats.buys)} valueClass="text-emerald-400" />
        <Stat label="Sells" value={String(stats.sells)} valueClass="text-rose-400" />
        <Stat label="Session" value={fmtClock(elapsed)} />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 animate-fade-in-up" style={{ animationDelay: '90ms' }}>
        <div className="relative">
          <select
            value={sizeFilter}
            onChange={e => setSizeFilter(e.target.value as SizeFilter)}
            className="appearance-none rounded-xl glass py-2 pl-3 pr-8 text-[11px] font-semibold text-white/70 outline-none cursor-pointer"
            style={{ border: '1px solid rgba(139,92,246,0.25)' }}>
            {SIZE_FILTERS.map(s => (
              <option key={s.key} value={s.key} style={{ background: '#0f0a1e', color: '#fff' }}>{s.label}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <button onClick={() => setPaused(p => !p)}
          className="flex items-center gap-1.5 rounded-xl glass px-3 py-2 text-[11px] font-semibold text-white/60 transition-colors hover:text-white"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          {paused ? '▶ Resume' : '❚❚ Pause'}
        </button>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : `Updating every ${REFRESH_MS / 1000}s`}
        </span>
      </div>

      {/* Treemap */}
      <section className="glass rounded-2xl p-4 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-block h-1 w-6 rounded-full" style={{ background: 'linear-gradient(90deg,#7c3aed,#9333ea)' }} />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">Dynamic Treemap Activity</h2>
        </div>
        <p className="mb-3 text-[11px] text-white/35">Cards scale by volume · colors show buy/sell pressure · labels show dominant outcome</p>

        {loading ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-24 rounded-xl animate-shimmer" />)}
          </div>
        ) : (
          <div className="grid auto-rows-[92px] grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {treemap.map((m, i) => {
              const ratio = m.total > 0 ? m.buy / m.total : 0.5; // 1 = all buys
              const buyDom = ratio >= 0.5;
              const intensity = 0.18 + Math.abs(ratio - 0.5) * 1.2; // 0.18..0.78
              const bg = buyDom
                ? `rgba(16,185,129,${Math.min(0.85, intensity)})`
                : `rgba(244,63,94,${Math.min(0.85, intensity)})`;
              // big tiles for the top few by volume
              const share = m.total / maxTotal;
              const span = i === 0 || share > 0.6 ? 'col-span-2 row-span-2'
                : share > 0.28 ? 'col-span-2 row-span-1'
                : 'col-span-1 row-span-1';
              return (
                <a key={m.title} href={m.href} target="_blank" rel="noopener noreferrer"
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-xl p-2.5 transition-transform hover:scale-[1.02] ${span}`}
                  style={{ background: bg, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-start gap-1.5">
                    {m.icon && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.icon} alt="" className="h-5 w-5 flex-shrink-0 rounded object-cover" />
                    )}
                    <p className="text-[11px] font-semibold leading-tight text-white line-clamp-2 drop-shadow">{m.title}</p>
                  </div>
                  <div>
                    {m.outcome && (
                      <p className="truncate text-[9px] font-bold uppercase tracking-wide text-white/80">
                        {buyDom ? 'BUY' : 'SELL'} {m.outcome}
                      </p>
                    )}
                    <p className="text-sm font-black tabular-nums text-white drop-shadow">{formatCurrency(m.total, true)}</p>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent trades table */}
      <section className="glass rounded-2xl p-4 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-1 w-6 rounded-full" style={{ background: 'linear-gradient(90deg,#7c3aed,#9333ea)' }} />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">Recent Trades</h2>
            </div>
            <p className="mt-0.5 text-[11px] text-white/30">Last {filtered.length} trades</p>
          </div>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search trades…"
              className="glass rounded-xl pl-8 pr-3 py-2 text-xs text-white/70 placeholder-white/20 outline-none w-full sm:w-56" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-[1fr_140px_120px_70px_80px_90px_64px] px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/30"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span>Market</span><span>Trader</span><span>Outcome</span><span className="text-center">Side</span>
              <span className="text-right">Price</span><span className="text-right">Size</span><span className="text-right">Time</span>
            </div>

            {loading ? (
              Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-11 animate-shimmer rounded my-1" />)
            ) : tableRows.map((t) => {
              const buy = isBuy(t);
              const name = t.proxyWallet ? formatAddress(t.proxyWallet, 6) : '—';
              const price = t.price != null ? `${(Number(t.price) * 100).toFixed(1)}%` : '—';
              const flashing = flashKeys.has(keyOf(t));
              return (
                <div key={keyOf(t)} className={`grid grid-cols-[1fr_140px_120px_70px_80px_90px_64px] items-center px-3 py-2 text-xs transition-colors hover:bg-white/[0.03] ${flashing ? 'animate-flash' : ''}`}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <a href={marketUrl(t.eventSlug, t.slug)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 min-w-0 hover:text-white">
                    {t.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.icon} alt="" className="h-6 w-6 flex-shrink-0 rounded object-cover" />
                    ) : <span className="h-6 w-6 flex-shrink-0 rounded bg-white/5" />}
                    <span className="truncate text-white/70">{t.title ?? t.asset ?? '—'}</span>
                  </a>
                  <a href={t.proxyWallet ? `/wallet/${t.proxyWallet.toLowerCase()}` : undefined}
                    className="truncate font-mono text-[11px] text-white/45 hover:text-violet-300">{name}</a>
                  <span className="truncate text-white/55">{t.outcome ?? '—'}</span>
                  <span className="flex justify-center">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-black uppercase"
                      style={buy ? { background: 'rgba(16,185,129,0.14)', color: '#34d399' } : { background: 'rgba(244,63,94,0.14)', color: '#fb7185' }}>
                      {buy ? 'BUY' : 'SELL'}
                    </span>
                  </span>
                  <span className="text-right tabular-nums text-white/55">{price}</span>
                  <span className="text-right font-bold tabular-nums text-white/80">{formatCurrency(usd(t), true)}</span>
                  <span className="text-right text-[10px] text-white/30">{timeAgo(tsOf(t))}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
