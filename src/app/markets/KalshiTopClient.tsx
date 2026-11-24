'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useNow } from '@/lib/useNow';
import { KALSHI_CHIPS, chipFor, type KalshiChip, type KalshiTopEvent, type KalshiTopScan } from '@/lib/kalshiTop';
import { ExplorerCard, ExplorerDetails, ExplorerHeader, ExplorerToolbar } from './MarketExplorerUI';

/* Kalshi explorer in the same frame as the Polymarket one: one card per event, ranked by 24h volume across ALL open
   Kalshi markets (full scan, refreshed every 15 minutes). Units: Kalshi volume/open interest are contract counts. */

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const contracts = (n: number) => `${compact.format(n)}`;

/** Price in cents; sub-cent quotes keep one decimal, missing quotes are '—' (never 0¢). */
export function cents(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return '—';
  const c = p * 100;
  return c > 0 && c < 1 ? `${c.toFixed(1)}¢` : `${Math.round(c)}¢`;
}

/** No ask derived from the Yes bid (buying No at 1 − p takes the other side of a Yes bid at p). */
export const noAsk = (yesBid: number | null) => (yesBid === null ? null : Math.round((1 - yesBid) * 1e4) / 1e4);

function closesIn(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const end = Date.parse(iso);
  if (!Number.isFinite(end)) return null;
  const ms = end - now;
  if (ms <= 0) return 'Closed';
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d`;
  const hrs = Math.floor(ms / 3_600_000);
  if (hrs >= 1) return `${hrs}h`;
  return `${Math.max(1, Math.floor(ms / 60_000))}m`;
}

function ago(iso: string, now: number): string {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  return min < 1 ? 'just now' : min < 60 ? `${min} min ago` : `${Math.round(min / 60)} h ago`;
}

/* The shared cache refreshes in the background on the first visit after it expires, so after a quiet period the
   first visitor is served the previous scan. When the scan is older than this, the page says so, polls the API until
   the background scan lands, and swaps it in. */
export const STALE_AFTER_MS = 30 * 60_000;
const POLL_EVERY_MS = 20_000;
const POLL_FOR_MS = 4 * 60_000;

export function isStale(receivedAt: string, now: number): boolean {
  const t = Date.parse(receivedAt);
  return Number.isFinite(t) && now - t > STALE_AFTER_MS;
}

const CHIP_COLOR: Record<Exclude<KalshiChip, 'All'>, string> = {
  Politics: 'var(--cat-politics)', Sports: 'var(--cat-sports)', Economy: 'var(--info)', Crypto: 'var(--cat-crypto)',
  Tech: 'var(--cat-tech)', Entertainment: 'var(--cat-entertainment)', World: 'var(--text-secondary)', Other: 'var(--cat-other)',
};

// Same sorts, in the same order, as the Polymarket explorer. Kalshi publishes no liquidity figure, so that slot is
// Open Interest (contracts outstanding), and it is labelled as such.
const SORTS = [
  { key: 'vol24h', label: '24h Volume' },
  { key: 'volume', label: 'Total Volume' },
  { key: 'oi', label: 'Open Interest' },
  { key: 'ending', label: 'Closing Soon' },
  { key: 'newest', label: 'Newest' },
] as const;
type SortKey = typeof SORTS[number]['key'];

/** Shows the ask (price to buy); when no one is selling, the best bid is shown and labelled as a bid instead. */
function Tile({ label, ask, bid, yes }: { label: string; ask: number | null; bid: number | null; yes: boolean }) {
  const useBid = ask === null && bid !== null;
  const price = useBid ? bid : ask;
  return (
    <div className="min-w-0 flex-1 rounded-xl px-3 py-2 text-center"
      title={useBid ? 'No ask right now: showing the best bid' : 'Current ask: the price to buy one contract'}
      style={yes
        ? { background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }
        : { background: 'rgba(251,113,133,0.08)', border: '1px solid rgba(251,113,133,0.2)' }}>
      <p className="truncate text-xs font-semibold text-ink/55">{label}</p>
      <p className={`text-base font-black ${yes ? 'text-grad-profit' : 'text-grad-loss'}`}>
        {cents(price)}{useBid && <span className="ml-1 text-xs font-semibold text-ink/70">bid</span>}
      </p>
    </div>
  );
}

function EventCard({ event, now }: { event: KalshiTopEvent; now: number }) {
  const chip = chipFor(event.category);
  const color = CHIP_COLOR[chip];
  const close = closesIn(event.closeTime, now);
  const single = event.outcomes.length === 1;
  const shown = single ? [] : event.outcomes.slice(0, 2);
  const more = event.tradedMarkets - shown.length;
  const href = single
    ? `/markets/kalshi/${encodeURIComponent(event.outcomes[0].ticker)}`
    : `/markets/kalshi/events/${encodeURIComponent(event.eventTicker)}`;

  return (
    <ExplorerCard className="group glass-hover gradient-border h-full gap-4 p-5 animate-fade-in-up">
      <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink/85 transition-colors group-hover:text-ink">{event.title}</p>

      <div className="-mt-1 flex items-center gap-2">
        <span className="rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider"
          style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 20%, transparent)` }}>
          {chip}
        </span>
        {close && (
          <span className="flex items-center gap-1 text-xs font-semibold text-ink/55">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {close === 'Closed' ? 'Closed' : `${close} left`}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {single ? (
          <>
            <Tile label="Yes" ask={event.outcomes[0].yesAsk} bid={event.outcomes[0].yesBid} yes />
            <Tile label="No" ask={noAsk(event.outcomes[0].yesBid)} bid={noAsk(event.outcomes[0].yesAsk)} yes={false} />
          </>
        ) : (
          shown.map((o, i) => <Tile key={o.ticker} label={o.label} ask={o.yesAsk} bid={o.yesBid} yes={i === 0} />)
        )}
      </div>
      {!single && more > 0 && <p className="-mt-2 text-xs text-ink/55">+{more} more outcome{more === 1 ? '' : 's'} · prices are Yes asks</p>}

      <div className="mt-auto flex items-center justify-between pt-1" style={{ borderTop: '1px solid rgba(var(--ink-rgb),0.05)' }}>
        <div>
          <p className="text-xs uppercase tracking-wider text-ink/55">24h Vol</p>
          <p className="text-sm font-bold text-ink/70">{contracts(event.volume24hContracts)} <span className="text-xs font-semibold text-ink/55">contracts</span></p>
        </div>
        {event.openInterestContracts > 0 && (
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-ink/55">Open interest</p>
            <p className="text-sm font-bold text-ink/70">{contracts(event.openInterestContracts)}</p>
          </div>
        )}
      </div>
      <div className="pt-3" style={{ borderTop: '1px solid rgba(var(--ink-rgb),0.06)' }}>
        <Link href={href} data-kalshi-details-link=""
          className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold text-[var(--text-primary)] transition-all hover:-translate-y-0.5 hover:text-ink"
          style={{ background: 'var(--accent-tint)', border: '1px solid var(--accent-border-md)' }}>
          {single ? 'View market & order book' : 'View all outcomes'}
        </Link>
      </div>
    </ExplorerCard>
  );
}

export default function KalshiTopClient({ scan: initialScan, error, serverNow }: { scan: KalshiTopScan | null; error: string | null; serverNow: number }) {
  const now = useNow(serverNow);
  const [scan, setScan] = useState(initialScan);
  const [refresh, setRefresh] = useState<'idle' | 'polling' | 'gave_up'>('idle');

  useEffect(() => {
    if (!initialScan || !isStale(initialScan.receivedAt, Date.now())) return;
    const since = Date.parse(initialScan.receivedAt);
    const started = Date.now();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const r = await fetch('/api/kalshi/top', { cache: 'no-store' });
        if (r.ok) {
          const next = (await r.json()) as KalshiTopScan;
          if (!stopped && Array.isArray(next.events) && Date.parse(next.receivedAt) > since) { setScan(next); setRefresh('idle'); return; }
        }
      } catch { /* keep showing the previous scan */ }
      if (stopped) return;
      if (Date.now() - started > POLL_FOR_MS) { setRefresh('gave_up'); return; }
      timer = setTimeout(tick, POLL_EVERY_MS);
    };
    timer = setTimeout(() => { if (!stopped) { setRefresh('polling'); void tick(); } }, 1_000);
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [initialScan]);
  const [sort, setSort] = useState<SortKey>('vol24h');
  const [chip, setChip] = useState<KalshiChip>('All');
  const [q, setQ] = useState('');
  const events = useMemo(() => scan?.events ?? [], [scan]);

  const counts = useMemo(() => {
    const c = new Map<KalshiChip, number>([['All', events.length]]);
    for (const e of events) c.set(chipFor(e.category), (c.get(chipFor(e.category)) ?? 0) + 1);
    return c;
  }, [events]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = events.filter(e => {
      // The list is cached for up to 15 minutes: events that have closed since are hidden, as on the Polymarket view.
      if (e.closeTime && Date.parse(e.closeTime) <= now) return false;
      if (chip !== 'All' && chipFor(e.category) !== chip) return false;
      if (!query) return true;
      return `${e.title} ${e.category ?? ''} ${e.outcomes.map(o => o.label).join(' ')}`.toLowerCase().includes(query);
    });
    if (sort === 'volume') list.sort((a, b) => b.totalVolumeContracts - a.totalVolumeContracts);
    if (sort === 'newest') list.sort((a, b) => Date.parse(b.openedAt ?? '1970-01-01') - Date.parse(a.openedAt ?? '1970-01-01'));
    if (sort === 'oi') list.sort((a, b) => b.openInterestContracts - a.openInterestContracts);
    if (sort === 'ending') list.sort((a, b) => Date.parse(a.closeTime ?? '9999-12-31') - Date.parse(b.closeTime ?? '9999-12-31'));
    return list;
  }, [events, chip, q, sort, now]);

  const totalVol = useMemo(() => filtered.reduce((s, e) => s + e.volume24hContracts, 0), [filtered]);

  return (
    <div className="flex flex-col gap-6">
      <ExplorerHeader
        provider="Kalshi"
        title={<><span className="text-ink">Markets</span>{' '}<span className="text-grad">Explorer</span></>}
        description={scan
          ? `The ${events.length} most-traded Kalshi events right now, ranked by 24h volume across all ${compact.format(scan.listableMarkets)} open markets. Search, filter by category and sort.`
          : 'The most-traded Kalshi events, ranked by 24h volume across all open markets.'}
      />

      {scan && (
        <ExplorerDetails
          className="glass rounded-2xl px-4"
          summary={<span>{scan.complete ? 'Full scan' : 'Partial scan'} · updated {ago(scan.receivedAt, now)}{refresh === 'polling' ? ' · refreshing…' : refresh === 'gave_up' ? ' · refresh pending, reload later' : ''} · About this ranking</span>}>
          <div className="space-y-2 pb-4 text-xs text-ink/60">
            <p>
              Every open Kalshi market ({scan.scannedMarkets.toLocaleString('en-US')} rows, {scan.pages} pages) is read and ranked by 24h volume.
              Combo (multivariate) markets are excluded. {scan.tradedMarkets.toLocaleString('en-US')} markets in {scan.tradedEvents.toLocaleString('en-US')} events traded in the last 24 hours.
              The list refreshes every 15 minutes.
            </p>
            {!scan.complete && (
              <p className="font-semibold text-[var(--warning)]">
                This scan stopped early ({scan.stopReason === 'rate_limited' ? 'Kalshi rate limit' : 'time limit'}), so markets after that point are missing from the ranking.
              </p>
            )}
            <p>Volume and open interest are contract counts, not dollars. Kalshi publishes no liquidity figure, so Open Interest takes that place in sorting. Sorting applies to the {events.length} events shown. Prices are current asks: the price to buy one contract. Category is as Kalshi publishes it, grouped into the chips above.</p>
            <p>Retrieved {new Date(scan.receivedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC. Kalshi provides no quote timestamp, so quotes may be older.</p>
          </div>
        </ExplorerDetails>
      )}

      <ExplorerToolbar label="Search and sort Kalshi events" className="lg:items-center">
        <div className="relative flex min-w-0 max-w-md flex-1 items-center rounded-xl glass">
          <svg className="absolute left-3 h-4 w-4 text-ink/55" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search events or outcomes…" aria-label="Search Kalshi events"
            className="min-h-[44px] w-full bg-transparent py-2.5 pl-9 pr-3 text-sm text-ink/80 placeholder-ink/25 outline-none" />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="hidden text-xs uppercase tracking-widest text-ink/55 sm:inline">Sort</span>
          <div className="flex min-w-0 flex-wrap gap-1 rounded-xl glass p-1">
            {SORTS.map(s => (
              <button key={s.key} type="button" onClick={() => setSort(s.key)}
                className={`min-h-[44px] rounded-lg px-2.5 text-xs font-semibold transition-all ${sort === s.key ? 'text-ink' : 'text-ink/55 hover:text-ink/80'}`}
                style={sort === s.key ? { background: 'var(--accent-fill)', border: '1px solid var(--accent-border-md)' } : { border: '1px solid transparent' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </ExplorerToolbar>

      <div className="flex flex-wrap items-center gap-2">
        {KALSHI_CHIPS.filter(c => c === 'All' || (counts.get(c) ?? 0) > 0).map(c => (
          <button key={c} type="button" onClick={() => setChip(c)}
            className={`min-h-[44px] rounded-full px-3 text-xs font-semibold transition-all ${chip === c ? 'text-ink' : 'text-ink/55 hover:text-ink/80'}`}
            style={chip === c
              ? { background: 'var(--accent-fill)', border: '1px solid var(--accent-border-lg)' }
              : { background: 'rgba(var(--ink-rgb),0.03)', border: '1px solid rgba(var(--ink-rgb),0.07)' }}>
            {c}
          </button>
        ))}
        <span className="ml-auto text-xs text-ink/55">{filtered.length} events · {contracts(totalVol)} contracts 24h vol</span>
      </div>

      {error && !scan ? (
        <div className="glass rounded-2xl py-16 text-center">
          <p className="text-sm text-ink/70">{error}</p>
          <p className="mt-2 text-xs text-ink/55">Please try again in a few minutes.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl py-24 text-center">
          <p className="text-sm text-ink/55">No events match your filters</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e, i) => (
            <div key={e.eventTicker} className="min-w-0" style={{ animationDelay: `${Math.min(i, 12) * 50}ms` }}>
              <EventCard event={e} now={now} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
