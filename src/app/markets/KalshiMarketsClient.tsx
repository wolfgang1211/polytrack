'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { formatCents, formatContracts, formatUtc, isMarketsPage, type KalshiMarket, type KalshiMarketsPage } from '@/lib/kalshi';
import KalshiQuoteSummary, { KalshiQuotePolicyNote } from './KalshiQuoteSummary';
import { ExplorerCard, ExplorerDetails, ExplorerHeader, ExplorerToolbar } from './MarketExplorerUI';

const PAGE_LIMIT = 100;
const MAX_PAGES = 20; // bounded: at most ~2000 markets held client-side

const SORTS = [
  { key: 'vol24h', label: '24h volume (contracts)' },
  { key: 'closing', label: 'Closing soon' },
  { key: 'name', label: 'Name' },
] as const;
type SortKey = typeof SORTS[number]['key'];
type Busy = null | 'more' | 'refresh';

const nullsLast = (a: number | null, b: number | null, dir: 1 | -1) =>
  a === null ? (b === null ? 0 : 1) : b === null ? -1 : (a - b) * dir;

async function loadPage(cursor: string | null, signal: AbortSignal, eventTicker: string | null): Promise<KalshiMarketsPage> {
  // Every page request (initial, load more, refresh, Retry) carries the same event binding.
  const qs = `limit=${PAGE_LIMIT}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}${eventTicker ? `&event_ticker=${encodeURIComponent(eventTicker)}` : ''}`;
  const res = await fetch(`/api/kalshi/markets?${qs}`, { signal, cache: 'no-store' });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = typeof (body as { error?: unknown })?.error === 'string' ? (body as { error: string }).error : `Request failed (HTTP ${res.status}).`;
    throw new Error(msg);
  }
  // Full envelope + row validation so a corrupted success never renders NaN/undefined or loses the current cursor.
  if (!isMarketsPage(body)) throw new Error('Received a malformed market page. Previously loaded data is unchanged.');
  if (eventTicker && body.markets.some(m => m.eventTicker !== eventTicker)) {
    throw new Error('Received markets for a different event. Previously loaded data is unchanged.');
  }
  return body;
}

function dedupe(prev: KalshiMarket[], next: KalshiMarket[]): KalshiMarket[] {
  const seen = new Set(prev.map(m => m.ticker));
  return [...prev, ...next.filter(m => !seen.has(m.ticker) && seen.add(m.ticker))];
}

/* One primary link per market (question, prices, main metrics); quote quality and technical fields fold below it. */
function MarketCard({ m }: { m: KalshiMarket }) {
  return (
    <ExplorerCard className="h-full gap-2 p-4">
      <Link href={`/markets/kalshi/${encodeURIComponent(m.ticker)}`}
        className="glass-hover -m-2 flex min-w-0 flex-1 flex-col gap-3 rounded-xl p-2 transition-colors">
        <p className="text-sm font-semibold text-ink/85 line-clamp-2 leading-snug">{m.title ?? m.ticker}</p>
        <div className="grid grid-cols-2 gap-2">
          {([['Yes bid', m.yesBid], ['Yes ask', m.yesAsk]] as const).map(([label, p]) => (
            <div key={label} className="rounded-xl px-3 py-2 text-center"
              style={{ background: 'rgba(var(--ink-rgb),0.04)', border: '1px solid rgba(var(--ink-rgb),0.08)' }}>
              <p className="text-xs uppercase tracking-wider text-ink/55">{label}</p>
              <p className={`text-sm font-black ${p === null ? 'text-ink/55' : 'text-ink/80'}`}>{formatCents(p)}</p>
            </div>
          ))}
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2 pt-2 text-xs" style={{ borderTop: '1px solid rgba(var(--ink-rgb),0.06)' }}>
          <div className="min-w-0"><p className="text-xs uppercase tracking-wider text-ink/55">24h volume</p><p className="font-semibold text-ink/75">{formatContracts(m.volume24hContracts)}</p></div>
          <div className="min-w-0 text-right"><p className="text-xs uppercase tracking-wider text-ink/55">Closes</p><p className="font-semibold text-ink/75">{formatUtc(m.closeTime)}</p></div>
        </div>
        <span className="text-xs font-semibold text-ink/70">View market</span>
      </Link>
      <ExplorerDetails summary="Quote details">
        <div className="flex flex-col gap-2 pb-1 text-xs">
          <KalshiQuoteSummary yesBid={m.yesBid} yesAsk={m.yesAsk} yesBidSize={m.yesBidSize} yesAskSize={m.yesAskSize} />
          <p className="text-ink/55 break-words">Yes ={m.yesLabel ?? 'Unavailable'}</p>
          <div><p className="uppercase tracking-wider text-ink/55">Open interest</p><p className="font-semibold text-ink/75">{formatContracts(m.openInterestContracts)}</p></div>
          <p className="font-mono text-ink/55 break-all">{m.eventTicker} · {m.ticker}</p>
        </div>
      </ExplorerDetails>
    </ExplorerCard>
  );
}

export default function KalshiMarketsClient({ initial, initialError, eventTicker = null }: {
  initial: KalshiMarketsPage | null; initialError: string | null; eventTicker?: string | null;
}) {
  const [markets, setMarkets] = useState<KalshiMarket[]>(initial?.markets ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initial?.nextCursor ?? null);
  const [pages, setPages] = useState(initial ? 1 : 0);
  const [rejected, setRejected] = useState(initial?.rejectedCount ?? 0);
  // Retrieval times of the first and latest loaded page — not quote freshness.
  const [received, setReceived] = useState<{ first: string; last: string } | null>(
    initial ? { first: initial.receivedAt, last: initial.receivedAt } : null,
  );
  const [error, setError] = useState<{ kind: 'initial' | 'more' | 'refresh'; message: string } | null>(
    initialError ? { kind: 'initial', message: initialError } : null,
  );
  const [stalled, setStalled] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [q, setQ] = useState('');
  const [quotedOnly, setQuotedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('vol24h');

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
      const page = await loadPage(cursor, signal, eventTicker);
      if (gen !== generation.current) return;
      usedCursors.current.add(cursor);
      setMarkets(prev => dedupe(prev, page.markets));
      setRejected(r => r + page.rejectedCount);
      setPages(p => p + 1);
      setReceived(r => ({ first: r?.first ?? page.receivedAt, last: page.receivedAt }));
      const repeat = page.nextCursor !== null && (page.nextCursor === cursor || usedCursors.current.has(page.nextCursor));
      setStalled(repeat);
      setNextCursor(repeat ? null : page.nextCursor);
    } catch (e) {
      if (gen !== generation.current || signal.aborted) return;
      setError({ kind: 'more', message: e instanceof Error ? e.message : 'Could not load more markets.' });
    } finally {
      if (gen === generation.current) setBusy(null);
    }
  }

  async function refresh() {
    const { gen, signal } = start(); // supersedes any in-flight load-more
    setBusy('refresh');
    setError(null);
    try {
      const page = await loadPage(null, signal, eventTicker);
      if (gen !== generation.current) return;
      usedCursors.current = new Set();
      setMarkets(dedupe([], page.markets));
      setNextCursor(page.nextCursor);
      setRejected(page.rejectedCount);
      setPages(1);
      setStalled(false);
      setReceived({ first: page.receivedAt, last: page.receivedAt });
    } catch (e) {
      if (gen !== generation.current || signal.aborted) return;
      setError({ kind: markets.length ? 'refresh' : 'initial', message: e instanceof Error ? e.message : 'Refresh failed.' });
    } finally {
      if (gen === generation.current) setBusy(null);
    }
  }

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    const out = markets.filter(m => {
      if (quotedOnly && m.yesBid === null && m.yesAsk === null) return false;
      if (!query) return true;
      return [m.title, m.ticker, m.eventTicker, m.yesLabel, m.noLabel].some(s => s?.toLowerCase().includes(query));
    });
    const time = (s: string | null) => (s ? Date.parse(s) : null);
    const cmp: Record<SortKey, (a: KalshiMarket, b: KalshiMarket) => number> = {
      vol24h: (a, b) => nullsLast(a.volume24hContracts, b.volume24hContracts, -1),
      closing: (a, b) => nullsLast(time(a.closeTime), time(b.closeTime), 1),
      name: (a, b) => (a.title ?? a.ticker).localeCompare(b.title ?? b.ticker),
    };
    return out.sort(cmp[sort]);
  }, [markets, q, quotedOnly, sort]);

  const btn = 'min-h-[44px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const btnStyle = { background: 'rgba(var(--ink-rgb),0.05)', border: '1px solid rgba(var(--ink-rgb),0.1)' };
  const loaded = pages > 0;
  const retrieval = (
    <p className="mt-2 text-xs text-ink/55">
      {received
        ? `Retrieved ${formatUtc(received.first)}${received.last !== received.first ? ` – ${formatUtc(received.last)}` : ''}. Retrieval time only; Kalshi provides no quote timestamp, so quotes may be older.`
        : 'No data retrieved yet.'}
    </p>
  );

  return (
    <section className="flex flex-col gap-5" aria-labelledby="kalshi-heading">
      {eventTicker ? (
        // Event detail page keeps its own h1; no reskin of that page in this slice.
        <div>
          <h2 id="kalshi-heading" className="text-xl font-black leading-none tracking-tight mb-3 text-ink">Open binary $1 markets</h2>
          <p className="text-sm text-ink/55 max-w-2xl">
            Open binary $1 markets for this event on the loaded pages only. Closed, settled or unsupported markets are not shown,
            so this is not a complete list of the event&apos;s outcomes. Volume and open interest are contract counts, not dollars.
          </p>
          {retrieval}
        </div>
      ) : (
        <ExplorerHeader id="kalshi-heading" title="Kalshi markets" provider="Kalshi" description={<>
          <p>
            Read-only open binary markets from Kalshi&apos;s public API, loaded in pages. Volume and open interest are contract counts, not dollars.
            Prices are USD per $1 contract.
          </p>
          {retrieval}
        </>} />
      )}

      <ExplorerToolbar label="Search, sort and refresh loaded markets">
        <label className="flex min-w-0 flex-col gap-1 max-w-md flex-1">
          <span className="text-xs uppercase tracking-widest text-ink/55">Search loaded markets</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Title, ticker, event or outcome"
            className="min-h-[44px] rounded-xl glass w-full bg-transparent px-3 py-2 text-sm text-ink/80 placeholder-ink/25 outline-none" />
        </label>
        <div className="flex min-w-0 flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-widest text-ink/55">Sort</span>
            <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
              className="min-h-[44px] rounded-xl glass bg-transparent px-3 py-2 text-xs text-ink/80 outline-none">
              {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
          <label className="flex min-h-[44px] items-center gap-2 text-xs text-ink/60">
            <input type="checkbox" checked={quotedOnly} onChange={e => setQuotedOnly(e.target.checked)} />
            Quoted only
          </label>
          <button type="button" onClick={refresh} disabled={busy !== null} className={`${btn} text-ink/70`} style={btnStyle}>
            {busy === 'refresh' ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </ExplorerToolbar>

      <p className="text-xs text-ink/55" aria-live="polite">
        Sorting and filters apply to loaded markets only. Showing {shown.length} of {markets.length} loaded
        {rejected > 0 ? ` · ${rejected} source rows not shown (malformed, closed, unsupported${eventTicker ? ' or from another event' : ''})` : ''}.
      </p>
      <KalshiQuotePolicyNote />

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

      {loaded && markets.length === 0 && !error ? (
        <div className="glass rounded-2xl py-16 text-center text-sm text-ink/55">
          No open binary markets on the loaded pages.{nextCursor ? ' More pages may still be available.' : ''}
        </div>
      ) : shown.length === 0 && markets.length > 0 ? (
        <div className="glass rounded-2xl py-16 text-center text-sm text-ink/55">No loaded markets match your search or filter.</div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(m => <li key={m.ticker} className="min-w-0"><MarketCard m={m} /></li>)}
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
