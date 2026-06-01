'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RecentTrade } from '@/types';
import { formatCurrency, formatAddress } from '@/lib/utils';
import { marketUrl } from '@/lib/builder';

const REFRESH_MS = 2_000;

/* ── helpers ──────────────────────────────────────────── */
function tsOf(t: RecentTrade): number {
  const n = Number(t.timestamp ?? t.createdAt ?? 0);
  return n > 1e12 ? Math.floor(n / 1000) : n; // normalize ms → s
}
// Pull trade objects out of an RTDS websocket message (wrapped, array, or bare).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTrades(msg: any): RecentTrade[] {
  const out: RecentTrade[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visit = (x: any) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach(visit); return; }
    if (x.payload) visit(x.payload);
    if (x.asset && (x.price != null || x.size != null)) out.push(x as RecentTrade);
  };
  visit(msg);
  return out;
}
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

/* ── section header ───────────────────────────────────── */
function SectionHeader({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="font-mono text-[10px] font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.20)' }}>{index}</span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--vi-border), transparent)' }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.25)' }}>{label}</span>
    </div>
  );
}

/* ── data cell ─────────────────────────────────────────── */
function DataCell({ label, value, accent, dot }: { label: string; value: string; accent?: string; dot?: boolean }) {
  return (
    <div className="flex-1 flex flex-col justify-center px-5 py-4 min-w-[110px]">
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] mb-1.5 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
        {dot && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />}
        {label}
      </p>
      <p className="font-mono text-xl font-black tabular-nums leading-none" style={{ color: accent ?? 'rgba(255,255,255,0.88)' }}>{value}</p>
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
  const [session, setSession] = useState({ volume: 0, trades: 0, buys: 0, sells: 0 });
  const startedAt = useRef(Date.now());
  const seenRef = useRef<Map<string, RecentTrade>>(new Map());
  const firstRef = useRef(true);

  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Merge incoming trades into a continuously-growing, deduped feed (newest 500).
  const mergeTrades = useCallback((incoming: RecentTrade[]) => {
    if (!Array.isArray(incoming) || !incoming.length) return;
    const fresh = new Set<string>();
    let addV = 0, addT = 0, addB = 0, addS = 0;
    for (const t of incoming) {
      if (!t || !t.asset) continue;
      const k = keyOf(t);
      if (!seenRef.current.has(k)) {
        seenRef.current.set(k, t);
        // session totals count every trade ever seen (not just the 500 window)
        addV += usd(t); addT += 1; if (isBuy(t)) addB += 1; else addS += 1;
        if (!firstRef.current) fresh.add(k);
      }
    }
    firstRef.current = false;
    const merged = [...seenRef.current.values()].sort((a, b) => tsOf(b) - tsOf(a)).slice(0, 500);
    seenRef.current = new Map(merged.map(t => [keyOf(t), t]));
    setTrades(merged);
    setLastUpdate(new Date());
    if (addT) setSession(s => ({ volume: s.volume + addV, trades: s.trades + addT, buys: s.buys + addB, sells: s.sells + addS }));
    if (fresh.size) {
      setFlashKeys(prev => new Set([...prev, ...fresh]));
      setTimeout(() => setFlashKeys(new Set()), 1500);
    }
  }, []);

  // Initial seed + slow polling fallback (direct from data-api, no cache).
  useEffect(() => {
    let live = true;
    const load = () => {
      if (pausedRef.current) return;
      fetch('https://data-api.polymarket.com/trades?limit=500', { cache: 'no-store' })
        .then(r => r.json())
        .then(d => (Array.isArray(d) ? d : (d?.trades ?? [])))
        .catch(() => fetch(`/api/activity?t=${Date.now()}`, { cache: 'no-store' }).then(r => r.json()).then(d => d?.trades ?? []))
        .then((rows: RecentTrade[]) => { if (live) { mergeTrades(rows); setLoading(false); } })
        .catch(() => { if (live) setLoading(false); });
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { live = false; clearInterval(id); };
  }, [mergeTrades]);

  // Real-time WebSocket: Polymarket RTDS pushes every trade the instant it happens.
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let ping: ReturnType<typeof setInterval> | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      try { ws = new WebSocket('wss://ws-live-data.polymarket.com'); } catch { return; }
      ws.onopen = () => {
        ws?.send(JSON.stringify({ action: 'subscribe', subscriptions: [{ topic: 'activity', type: 'trades' }] }));
        ping = setInterval(() => { try { ws?.send('ping'); } catch { /* noop */ } }, 10_000);
      };
      ws.onmessage = (ev) => {
        if (pausedRef.current) return;
        let parsed: unknown;
        try { parsed = JSON.parse(typeof ev.data === 'string' ? ev.data : ''); } catch { return; }
        const rows = extractTrades(parsed);
        if (rows.length) mergeTrades(rows);
      };
      ws.onclose = () => {
        if (ping) clearInterval(ping);
        if (!closed) reconnect = setTimeout(connect, 2000);
      };
      ws.onerror = () => { try { ws?.close(); } catch { /* noop */ } };
    };
    connect();
    return () => {
      closed = true;
      if (ping) clearInterval(ping);
      if (reconnect) clearTimeout(reconnect);
      try { ws?.close(); } catch { /* noop */ }
    };
  }, [mergeTrades]);

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

      {/* ── [01] Header ── */}
      <div className="animate-fade-in-up">
        <SectionHeader index="[01]" label="Live Activity" />
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl mb-2">
          <span className="text-white">Live Trading </span><span className="text-grad">Activity</span>
        </h1>
        <p className="text-sm text-white/40">Real-time market trades and volume from Polymarket</p>
      </div>

      {/* ── [02] Session Stats strip ── */}
      <div>
        <SectionHeader index="[02]" label="Session Stats" />
        <div className="flex overflow-x-auto animate-fade-in-up" style={{ animationDelay: '60ms',
          background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <DataCell label="Status" value={paused ? 'Paused' : 'Live'} accent={paused ? '#fbbf24' : '#34d399'} dot={!paused} />
          <div className="w-px self-stretch flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <DataCell label="Volume" value={formatCurrency(session.volume, true)} accent="rgba(139,92,246,0.95)" />
          <div className="w-px self-stretch flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <DataCell label="Trades" value={session.trades.toLocaleString('en-US')} />
          <div className="w-px self-stretch flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <DataCell label="Buys" value={session.buys.toLocaleString('en-US')} accent="#34d399" />
          <div className="w-px self-stretch flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <DataCell label="Sells" value={session.sells.toLocaleString('en-US')} accent="#fb7185" />
          <div className="w-px self-stretch flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <DataCell label="Session" value={fmtClock(elapsed)} />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 animate-fade-in-up" style={{ animationDelay: '90ms' }}>
        <div className="relative">
          <select
            value={sizeFilter}
            onChange={e => setSizeFilter(e.target.value as SizeFilter)}
            className="appearance-none rounded-xl glass py-2 pl-3 pr-8 text-[11px] font-semibold text-white/70 outline-none cursor-pointer"
            style={{ border: '1px solid var(--vi-border)' }}>
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

      {/* ── [03] Heatmap ── */}
      <section className="glass rounded-2xl p-4 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
        <SectionHeader index="[03]" label="Market Heatmap" />
        <p className="mb-3 text-[11px] text-white/35" style={{ marginTop: '-12px' }}>Cards scale by volume · colors show buy/sell pressure · labels show dominant outcome</p>

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

      {/* ── [04] Trade Feed ── */}
      <section className="glass rounded-2xl p-4 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <SectionHeader index="[04]" label="Trade Feed" />
            <p className="text-[11px] text-white/30" style={{ marginTop: '-12px' }}>Last {filtered.length} trades</p>
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
