'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { formatUtc } from '@/lib/kalshi';
import { DEFAULT_EVENT_LIMIT, isEventsPage, type KalshiEvent, type KalshiEventsPage } from '@/lib/kalshiEvents';
import { ExplorerHeader, ExplorerToolbar } from './MarketExplorerUI';

const MAX_PAGES = 20; // bounded: at most ~1000 events held client-side
const ALL = '';
type Busy = null | 'more' | 'refresh';

async function loadPage(cursor: string | null, signal: AbortSignal, seriesTicker: string | null): Promise<KalshiEventsPage> {
  const qs = `limit=${DEFAULT_EVENT_LIMIT}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}${seriesTicker ? `&series_ticker=${encodeURIComponent(seriesTicker)}` : ''}`;
  const res = await fetch(`/api/kalshi/events?${qs}`, { signal, cache: 'no-store' });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = typeof (body as { error?: unknown })?.error === 'string' ? (body as { error: string }).error : `Request failed (HTTP ${res.status}).`;
    throw new Error(msg);
  }
  // Envelope, rows and series binding are validated so a corrupted success never replaces good state.
  if (!isEventsPage(body)) throw new Error('Received a malformed event page. Previously loaded data is unchanged.');
  if (seriesTicker && body.events.some(e => e.seriesTicker !== seriesTicker)) {
    throw new Error('Received events from a different series. Previously loaded data is unchanged.');
  }
  return body;
}

function dedupe(prev: KalshiEvent[], next: KalshiEvent[]): KalshiEvent[] {
  const seen = new Set(prev.map(e => e.eventTicker));
  return [...prev, ...next.filter(e => !seen.has(e.eventTicker) && seen.add(e.eventTicker))];
}

const mutualLabel = (v: boolean | null) => (v === null ? 'Unavailable' : v ? 'Yes' : 'No');

function EventCard({ e }: { e: KalshiEvent }) {
  return (
    <Link href={`/markets/kalshi/events/${encodeURIComponent(e.eventTicker)}`}
      className="glass glass-hover rounded-2xl p-4 flex flex-col gap-3 h-full transition-colors">
      <div>
        <p className="text-sm font-semibold text-ink/85 line-clamp-2 leading-snug">{e.title}</p>
        {e.subTitle && <p className="mt-1 text-xs text-ink/55 line-clamp-1">{e.subTitle}</p>}
        <p className="mt-1 font-mono text-xs text-ink/55 truncate">{e.seriesTicker} · {e.eventTicker}</p>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-2 text-xs" style={{ borderTop: '1px solid rgba(var(--ink-rgb),0.06)' }}>
        <div><p className="text-xs uppercase tracking-wider text-ink/55">Category</p><p className="font-semibold text-ink/65 truncate">{e.category ?? 'Unavailable'}</p></div>
        <div className="text-right"><p className="text-xs uppercase tracking-wider text-ink/55">Mutually exclusive</p><p className="font-semibold text-ink/65">{mutualLabel(e.mutuallyExclusive)}</p></div>
        <div className="col-span-2"><p className="text-xs uppercase tracking-wider text-ink/55">Strike date</p><p className="font-semibold text-ink/65">{formatUtc(e.strikeDate)}</p></div>
      </div>
    </Link>
  );
}

/* Remounted per series by the page (key); generation + abort additionally drop late responses within one mount. */
export default function KalshiEventsClient({ initial, initialError, seriesTicker = null }: {
  initial: KalshiEventsPage | null; initialError: string | null; seriesTicker?: string | null;
}) {
  const [events, setEvents] = useState<KalshiEvent[]>(initial?.events ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initial?.nextCursor ?? null);
  const [pages, setPages] = useState(initial ? 1 : 0);
  const [rejected, setRejected] = useState(initial?.rejectedCount ?? 0);
  // Retrieval times of the first and latest loaded page — not source freshness.
  const [received, setReceived] = useState<{ first: string; last: string } | null>(
    initial ? { first: initial.receivedAt, last: initial.receivedAt } : null,
  );
  const [error, setError] = useState<{ kind: 'initial' | 'more' | 'refresh'; message: string } | null>(
    initialError ? { kind: 'initial', message: initialError } : null,
  );
  const [stalled, setStalled] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState(ALL);

  const usedCursors = useRef(new Set<string>());
  const generation = useRef(0);
  const inflight = useRef<AbortController | null>(null);
  useEffect(() => () => inflight.current?.abort(), []);

  function start(): { gen: number; signal: AbortSignal } {
    inflight.current?.abort();
    inflight.current = new AbortController();
    return { gen: ++generation.current, signal: inflight.current.signal };
  }

  async function loadMore() {
    const cursor = nextCursor;
    if (!cursor || busy || pages >= MAX_PAGES) return;
    if (usedCursors.current.has(cursor)) { setStalled(true); return; } // repeated cursor: stop, never spin
    const { gen, signal } = start();
    setBusy('more');
    setError(null);
    try {
      const page = await loadPage(cursor, signal, seriesTicker);
      if (gen !== generation.current) return;
      usedCursors.current.add(cursor);
      setEvents(prev => dedupe(prev, page.events));
      setRejected(r => r + page.rejectedCount);
      setPages(p => p + 1);
      setReceived(r => ({ first: r?.first ?? page.receivedAt, last: page.receivedAt }));
      const repeat = page.nextCursor !== null && (page.nextCursor === cursor || usedCursors.current.has(page.nextCursor));
      setStalled(repeat);
      setNextCursor(repeat ? null : page.nextCursor);
    } catch (e) {
      if (gen !== generation.current || signal.aborted) return;
      // nextCursor is untouched, so Retry re-requests the same cursor.
      setError({ kind: 'more', message: e instanceof Error ? e.message : 'Could not load more events.' });
    } finally {
      if (gen === generation.current) setBusy(null);
    }
  }

  async function refresh() {
    const { gen, signal } = start(); // supersedes any in-flight load-more
    setBusy('refresh');
    setError(null);
    try {
      const page = await loadPage(null, signal, seriesTicker);
      if (gen !== generation.current) return;
      usedCursors.current = new Set();
      setEvents(dedupe([], page.events));
      setNextCursor(page.nextCursor);
      setRejected(page.rejectedCount);
      setPages(1);
      setStalled(false);
      setReceived({ first: page.receivedAt, last: page.receivedAt });
    } catch (e) {
      if (gen !== generation.current || signal.aborted) return;
      setError({ kind: events.length ? 'refresh' : 'initial', message: e instanceof Error ? e.message : 'Refresh failed.' });
    } finally {
      if (gen === generation.current) setBusy(null);
    }
  }

  // Categories exactly as published on the loaded rows; nothing inferred.
  const categories = useMemo(
    () => [...new Set(events.map(e => e.category).filter((c): c is string => c !== null))].sort((a, b) => a.localeCompare(b)),
    [events],
  );
  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return events.filter(e => {
      if (category !== ALL && e.category !== category) return false;
      if (!query) return true;
      return [e.title, e.subTitle, e.eventTicker, e.seriesTicker, e.category].some(s => s?.toLowerCase().includes(query));
    });
  }, [events, q, category]);

  const btn = 'min-h-[44px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const btnStyle = { background: 'rgba(var(--ink-rgb),0.05)', border: '1px solid rgba(var(--ink-rgb),0.1)' };
  const loaded = pages > 0;

  return (
    <section className="flex flex-col gap-5" aria-labelledby="kalshi-events-heading">
      <ExplorerHeader id="kalshi-events-heading" title={`Kalshi events${seriesTicker ? ` · ${seriesTicker}` : ''}`} provider="Kalshi" description={<>
        <p>
          Read-only open events from Kalshi&apos;s public API, loaded in pages. An event groups related markets; open one to see its open binary $1 markets.
        </p>
        <p className="mt-2 text-xs text-ink/55">
          {received
            ? `Retrieved ${formatUtc(received.first)}${received.last !== received.first ? ` – ${formatUtc(received.last)}` : ''}. Retrieval time only, not a source update time.`
            : 'No data retrieved yet.'}
        </p>
      </>} />

      <ExplorerToolbar label="Search, filter and refresh loaded events">
        <label className="flex min-w-0 flex-col gap-1 max-w-md flex-1">
          <span className="text-xs uppercase tracking-widest text-ink/55">Search loaded events</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Title, ticker, series or category"
            className="min-h-[44px] rounded-xl glass w-full bg-transparent px-3 py-2 text-sm text-ink/80 placeholder-ink/25 outline-none" />
        </label>
        <div className="flex min-w-0 flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-widest text-ink/55">Category (as published)</span>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="min-h-[44px] rounded-xl glass bg-transparent px-3 py-2 text-xs text-ink/80 outline-none">
              <option value={ALL}>All</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <button type="button" onClick={refresh} disabled={busy !== null} className={`${btn} text-ink/70`} style={btnStyle}>
            {busy === 'refresh' ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </ExplorerToolbar>

      <p className="text-xs text-ink/55" aria-live="polite">
        Filters apply to loaded events only. Showing {shown.length} of {events.length} loaded
        {rejected > 0 ? ` · ${rejected} source rows not shown (malformed${seriesTicker ? ' or from another series' : ''})` : ''}.
      </p>

      {error && (
        <div role="alert" className="rounded-2xl p-4 text-sm flex flex-wrap items-center justify-between gap-3"
          style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)' }}>
          <span className="text-rose-400">
            {error.message}
            {error.kind === 'refresh' && received ? ` Showing previously loaded data retrieved ${formatUtc(received.last)}.` : ''}
          </span>
          <button type="button" onClick={error.kind === 'more' ? loadMore : refresh} disabled={busy !== null} className={`${btn} text-ink/70`} style={btnStyle}>
            Retry
          </button>
        </div>
      )}

      {loaded && events.length === 0 && !error ? (
        <div className="glass rounded-2xl py-16 text-center text-sm text-ink/55">
          No open events on the loaded pages.{nextCursor ? ' More pages may still be available.' : ''}
        </div>
      ) : shown.length === 0 && events.length > 0 ? (
        <div className="glass rounded-2xl py-16 text-center text-sm text-ink/55">No loaded events match your search or category.</div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(e => <li key={e.eventTicker}><EventCard e={e} /></li>)}
        </ul>
      )}

      <div className="flex flex-col items-center gap-2 text-xs text-ink/55">
        {nextCursor && pages < MAX_PAGES && (
          <button type="button" onClick={loadMore} disabled={busy !== null} className={`${btn} text-ink/70`} style={btnStyle}>
            {busy === 'more' ? 'Loading…' : 'Load more'}
          </button>
        )}
        {stalled && <p>Paging stopped: the source repeated a cursor. Refresh to start over.</p>}
        {nextCursor && pages >= MAX_PAGES && <p>Load limit reached ({MAX_PAGES} pages). Refresh to start over.</p>}
        {loaded && !nextCursor && !stalled && <p>End of results for the loaded sequence.</p>}
      </div>
    </section>
  );
}
