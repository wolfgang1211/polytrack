'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { formatCents, formatContracts, formatUtc, type KalshiMarket } from '@/lib/kalshi';
import { isDiscoveryPage, type KalshiDiscoveryGroup, type KalshiDiscoveryPage } from '@/lib/kalshiDiscovery';
import {
  CLOSING_OPTIONS, DEFAULT_FILTERS, SIZE_OPTIONS, SPREAD_OPTIONS, filterDiscoveryGroups, hasActiveFilters, parseDiscoveryFilters,
  serializeDiscoveryFilters, type DiscoveryFilters, type ParsedDiscoveryFilters,
} from '@/lib/kalshiDiscoveryFilters';
import KalshiQuoteSummary, { KalshiQuotePolicyNote } from './KalshiQuoteSummary';
import { ExplorerCard, ExplorerDetails, ExplorerHeader, ExplorerToolbar } from './MarketExplorerUI';

const ALL = '';
const CLOSING_LABEL = { '24h': '24 hours', '7d': '7 days' } as const;

/** Native history only (no Next navigation, no refetch). An unserializable draft leaves the URL as is. */
function writeUrl(f: DiscoveryFilters, mode: 'push' | 'replace') {
  if (typeof window === 'undefined') return;
  let params: URLSearchParams;
  try { params = serializeDiscoveryFilters(f, new URLSearchParams(window.location.search)); } catch { return; }
  const url = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
}

/** Automatic category reset: drops ONLY `category` from the current URL. Other keys (incl. invalid or repeated values) and
    the hash stay as they are, so a still-blocked bad link is not canonicalized into a valid, broader one. */
function resetCategoryUrl() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  params.delete('category');
  const qs = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
}
const VISIBLE_ROWS = 4;
const VISIBLE_GROUPS = 12;
const GROUPS_ID = 'kalshi-discover-groups';
const EMPTY_GROUPS: readonly KalshiDiscoveryGroup[] = [];
const n = (v: number) => v.toLocaleString('en-US');
/** Second-resolution UTC: sampled trades often span only seconds or minutes. */
const utcSeconds = (iso: string | null) =>
  iso && Number.isFinite(Date.parse(iso)) ? `${new Date(iso).toISOString().slice(0, 19).replace('T', ' ')} UTC` : 'Unavailable';

async function loadDiscovery(signal: AbortSignal): Promise<KalshiDiscoveryPage> {
  const res = await fetch('/api/kalshi/discovery', { signal, cache: 'no-store' });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = typeof (body as { error?: unknown })?.error === 'string' ? (body as { error: string }).error : `Request failed (HTTP ${res.status}).`;
    throw new Error(msg);
  }
  // The whole page is validated so a corrupted success never replaces the current sample.
  if (!isDiscoveryPage(body)) throw new Error('Received a malformed discovery sample.');
  return body;
}

const hasNumericFilter = (f: DiscoveryFilters) => !!(f.maxSpread || f.minSize || f.closing);
const categoryOf = (g: KalshiDiscoveryGroup) => g.event?.category ?? null;
const categoriesOf = (p: KalshiDiscoveryPage | null) =>
  [...new Set((p?.groups ?? []).map(categoryOf).filter((c): c is string => c !== null))].sort((a, b) => a.localeCompare(b));

function MarketRow({ m }: { m: KalshiMarket }) {
  return (
    <li className="flex min-w-0 flex-col rounded-xl px-3 pt-2" style={{ background: 'rgba(var(--ink-rgb),0.03)' }}>
      {/* One primary link per row: outcome + published Yes ask first; Yes bid and 24h contracts wrap underneath. */}
      <Link href={`/markets/kalshi/${encodeURIComponent(m.ticker)}`}
        className="glass-hover grid min-h-[44px] grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 rounded-lg text-xs transition-colors">
        <span className="min-w-0 font-semibold text-ink/80 line-clamp-2">{m.yesLabel ?? m.title ?? m.ticker}</span>
        <span className="text-right"><span className="block text-xs text-ink/55">Yes ask</span><span className="text-sm font-black text-ink/85">{formatCents(m.yesAsk)}</span></span>
        <span className="col-span-full flex min-w-0 flex-wrap gap-x-4 gap-y-0.5 text-ink/55">
          <span>Yes bid {formatCents(m.yesBid)}</span>
          <span>24h volume {formatContracts(m.volume24hContracts)}</span>
        </span>
      </Link>
      <ExplorerDetails summary="Quote details">
        <div className="flex flex-col gap-1.5 pb-2">
          <KalshiQuoteSummary yesBid={m.yesBid} yesAsk={m.yesAsk} yesBidSize={m.yesBidSize} yesAskSize={m.yesAskSize} />
          <p className="font-mono text-xs text-ink/55 break-all">{m.ticker}</p>
        </div>
      </ExplorerDetails>
    </li>
  );
}

function GroupCard({ g, sampled, filtered, open, onToggle }: {
  g: KalshiDiscoveryGroup; sampled: number; filtered: boolean; open: boolean; onToggle: () => void;
}) {
  const eventHref = `/markets/kalshi/events/${encodeURIComponent(g.eventTicker)}`;
  const rows = open ? g.markets : g.markets.slice(0, VISIBLE_ROWS);
  const hidden = g.markets.length - VISIBLE_ROWS;
  const listId = `kalshi-discover-markets-${g.eventTicker}`; // TICKER_RE chars are valid id chars
  return (
    <ExplorerCard className="p-4 gap-3">
      <header>
        {g.event ? (
          <>
            <Link href={eventHref} className="text-sm font-semibold text-ink/85 leading-snug hover:underline">{g.event.title}</Link>
            {g.event.subTitle && <p className="mt-1 text-xs text-ink/55 line-clamp-1">{g.event.subTitle}</p>}
            <p className="mt-1 text-xs text-ink/55">Category: {g.event.category ?? 'Unavailable'}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-ink/60">
              {g.metadataStatus === 'unavailable' ? 'Event details unavailable' : 'Event details not loaded'}
            </p>
            <p className="mt-1 text-xs text-ink/55">
              {g.metadataStatus === 'unavailable'
                ? 'Event details could not be loaded.'
                : 'Details are fetched only for the first groups in this sample.'}{' '}
              <Link href={eventHref} className="underline underline-offset-2">Open event page</Link>
            </p>
          </>
        )}
        <p className="mt-1 font-mono text-xs text-ink/55 truncate">{g.event ? `${g.event.seriesTicker} · ` : ''}{g.eventTicker}</p>
      </header>
      <p className="text-xs text-ink/55">
        {filtered
          ? `${g.markets.length} of ${sampled} sampled open market${sampled === 1 ? '' : 's'} match the filters.`
          : `${g.markets.length} sampled open market${g.markets.length === 1 ? '' : 's'}.`} The event may have more; open the event page for its open markets.
      </p>
      <ul id={listId} className="flex flex-col gap-1.5">{rows.map(m => <MarketRow key={m.ticker} m={m} />)}</ul>
      {hidden > 0 && (
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={listId}
          className="self-start min-h-[44px] text-xs font-semibold text-ink/55 hover:text-ink/80">
          {open ? 'Show fewer' : `Show ${hidden} more sampled market${hidden === 1 ? '' : 's'}`}
        </button>
      )}
    </ExplorerCard>
  );
}

/* Generation + abort drop late responses; a failed refresh keeps the previous good sample. */
export default function KalshiDiscoveryClient({ initial, initialError, initialFilters }: {
  initial: KalshiDiscoveryPage | null; initialError: string | null; initialFilters?: ParsedDiscoveryFilters;
}) {
  const start = initialFilters?.filters ?? DEFAULT_FILTERS;
  const [page, setPage] = useState<KalshiDiscoveryPage | null>(initial);
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState<DiscoveryFilters>(start);
  // Raw search text: keeps spaces while typing; filters.q is the trimmed canonical value used for matching and the URL.
  const [draft, setDraft] = useState(start.q);
  const [invalidKeys, setInvalidKeys] = useState<string[]>(initialFilters?.invalidKeys ?? []);
  const [resetNote, setResetNote] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [allGroups, setAllGroups] = useState(false);
  // "More filters" mirrors the URL on load and on back/forward only; a new key remounts the native <details> so the URL
  // state wins even after the user toggled it. User edits never change it, so clearing a filter never collapses the panel.
  const [more, setMore] = useState({ open: hasNumericFilter(start), key: 0 });

  const generation = useRef(0);
  const inflight = useRef<AbortController | null>(null);
  // Mirrors the filters synchronously so a refresh that resolves later checks the CURRENT choice.
  const filtersRef = useRef<DiscoveryFilters>(start);
  useEffect(() => () => {
    inflight.current?.abort();
    generation.current++; // a late result that ignored the abort is still dropped after unmount
  }, []);

  // Stable identity (only refs and state setters inside) so the popstate effect can list it as a dependency.
  // useMemo rather than useCallback: the existing component-handler harnesses shim useMemo but not useCallback.
  const setAll = useMemo(() => (next: DiscoveryFilters, nextDraft: string, invalid: string[]) => {
    filtersRef.current = next;
    setFilters(next);
    setDraft(nextDraft);
    setInvalidKeys(invalid);
    setResetNote(null);
    setAllGroups(false);
    setExpanded([]);
  }, []);

  // Back/forward: re-read the URL; never writes history and never refetches.
  useEffect(() => {
    const onPop = () => {
      const parsed = parseDiscoveryFilters(new URLSearchParams(window.location.search));
      setAll(parsed.filters, parsed.filters.q, parsed.invalidKeys);
      setMore(m => ({ open: hasNumericFilter(parsed.filters), key: m.key + 1 }));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setAll]);

  /** Any explicit user edit (search included) clears an invalid-link block; the bad fields were already parsed to defaults. */
  function change(patch: Partial<DiscoveryFilters>, mode: 'push' | 'replace', nextDraft = draft) {
    const next = { ...filtersRef.current, ...patch };
    setAll(next, nextDraft, []);
    writeUrl(next, mode);
  }
  const chooseCategory = (value: string) => change({ category: value }, 'push');

  async function refresh() {
    inflight.current?.abort();
    inflight.current = new AbortController();
    const { signal } = inflight.current;
    const gen = ++generation.current;
    setBusy(true);
    setError(null);
    try {
      const next = await loadDiscovery(signal);
      if (gen !== generation.current || signal.aborted) return;
      setPage(next);
      setExpanded([]);
      setAllGroups(false);
      // A category missing from the new sample resets to All, visibly.
      const current = filtersRef.current;
      if (current.category !== ALL && !categoriesOf(next).includes(current.category)) {
        // Only the category changes; current q/numeric filters and any invalid-link block are kept.
        const kept = { ...current, category: ALL };
        filtersRef.current = kept;
        setFilters(kept);
        setResetNote(`Category "${current.category}" is not in the new sample; showing all categories.`);
        resetCategoryUrl();
      } else setResetNote(null);
    } catch (e) {
      if (gen !== generation.current || signal.aborted) return;
      setError(e instanceof Error ? e.message : 'Refresh failed.');
    } finally {
      if (gen === generation.current) setBusy(false);
    }
  }

  const categories = useMemo(() => categoriesOf(page), [page]);
  const groups = page?.groups ?? EMPTY_GROUPS;
  const blocked = invalidKeys.length > 0; // an explicit bad link shows nothing rather than quietly broadening
  const active = hasActiveFilters(filters);
  const sampledCount = useMemo(() => new Map(groups.map(g => [g.eventTicker, g.markets.length])), [groups]);
  const shown = useMemo(
    () => (blocked || !page ? [] : filterDiscoveryGroups(groups, filters, page.receivedAt)),
    [blocked, page, groups, filters],
  );
  const missingCategory = filters.category !== ALL && !categories.includes(filters.category) ? filters.category : null;
  // All groups stay in state; only the rendered list is compact by default.
  const visible = allGroups ? shown : shown.slice(0, VISIBLE_GROUPS);

  const c = page?.coverage;
  const partial = !!c && (c.moreTradesAvailable || c.truncated);
  const btn = 'min-h-[44px] rounded-lg px-3 py-1.5 text-xs font-semibold text-ink/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const btnStyle = { background: 'rgba(var(--ink-rgb),0.05)', border: '1px solid rgba(var(--ink-rgb),0.1)' };
  const selectCls = 'min-h-[44px] rounded-xl glass bg-transparent px-3 py-2 text-xs text-ink/80 outline-none';

  return (
    <section className="flex flex-col gap-5" aria-labelledby="kalshi-discover-heading">
      {/* Short scope stays visible; the longer explanations moved, unchanged in substance, into "About this sample". */}
      <ExplorerHeader id="kalshi-discover-heading" title="Discover Kalshi activity" provider="Kalshi" description={<>
        <p>
          Open binary $1 markets found in a sample of recent Kalshi trades, grouped by event. This is not the full catalog and not a volume ranking.
          Volumes are contract counts, not dollars.
        </p>
        {c && c.tradesScanned > 0 && (
          <p className="mt-2 text-xs text-ink/55">Sampled trades span {utcSeconds(c.oldestTradeAt)} to {utcSeconds(c.newestTradeAt)}.</p>
        )}
        <p className="mt-2 text-xs text-ink/55">
          {page
            ? `Retrieved ${formatUtc(page.receivedAt)}. Retrieval time only; Kalshi provides no quote timestamp, so quotes may be older.`
            : 'No data retrieved yet.'}
        </p>
        {partial && (
          <p className="mt-2 text-xs text-amber-400/80">
            Partial sample: {c!.moreTradesAvailable ? 'more recent trades exist beyond the scanned pages' : ''}
            {c!.moreTradesAvailable && c!.truncated ? '; ' : ''}{c!.truncated ? 'a ticker or market-page limit was reached' : ''}.
          </p>
        )}
      </>}>
        <ExplorerDetails summary="About this sample" className="max-w-2xl">
          <div className="flex flex-col gap-2 pb-2 text-xs text-ink/55">
            <p>
              Only markets that traded in the scanned sample appear, and each event lists only its sampled markets.
              Volumes are contract counts, not dollars.
            </p>
            {c && c.tradesScanned > 0 && (
              <p>
                Sampled trades span {utcSeconds(c.oldestTradeAt)} to {utcSeconds(c.newestTradeAt)} (the window is up to 24 hours, but on busy
                days often only seconds or minutes). Groups are ordered by the highest known 24h market volume within this sample, not by event volume across Kalshi.
              </p>
            )}
            <p>
              Samples may be reused for up to 20 seconds; the retrieval time shown stays unchanged, so a quick repeat Refresh may return
              the same snapshot. Source freshness is unknown.
            </p>
          </div>
        </ExplorerDetails>
      </ExplorerHeader>

      <ExplorerToolbar label="Search and filter the discovered sample">
        <label className="flex min-w-0 flex-col gap-1 max-w-md flex-1">
          <span className="text-xs uppercase tracking-widest text-ink/55">Search discovered sample</span>
          <input value={draft} maxLength={120} onChange={e => {
              // Pasted ASCII controls become visible spaces so the box, filters and URL agree (the URL parser stays strict).
              const raw = e.target.value.replace(/[\u0000-\u001f\u007f]/g, ' ');
              change({ q: raw.trim() }, 'replace', raw);
            }}
            placeholder="Event, outcome, series or ticker"
            className="min-h-[44px] rounded-xl glass w-full bg-transparent px-3 py-2 text-sm text-ink/80 placeholder-ink/25 outline-none" />
        </label>
        <div className="flex min-w-0 flex-wrap items-end gap-3">
          {/* Category stays the first select. */}
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-widest text-ink/55">Category (as published)</span>
            <select value={filters.category} onChange={e => chooseCategory(e.target.value)} className={selectCls}>
              <option value={ALL}>All</option>
              {missingCategory && <option value={missingCategory}>{`${missingCategory} (not in this sample)`}</option>}
              {categories.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          {(active || blocked) && (
            <button type="button" onClick={() => change({ ...DEFAULT_FILTERS }, 'push', '')} className={btn} style={btnStyle}>Reset filters</button>
          )}
          <button type="button" onClick={refresh} disabled={busy} className={btn} style={btnStyle}>
            {busy ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </ExplorerToolbar>

      {/* Opens on load and on back/forward when the URL carries any numeric filter, so an active filter is never hidden. */}
      <ExplorerDetails key={more.key} summary="More filters" open={more.open || undefined}>
        <div className="flex min-w-0 flex-wrap items-end gap-3 pb-1">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-widest text-ink/55">Max spread (¢)</span>
            <select value={filters.maxSpread} onChange={e => change({ maxSpread: e.target.value as DiscoveryFilters['maxSpread'] }, 'push')} className={selectCls}>
              <option value="">Any</option>
              {SPREAD_OPTIONS.map(x => <option key={x} value={x}>{`≤ ${x}¢`}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-widest text-ink/55">Min displayed size (contracts, both sides)</span>
            <select value={filters.minSize} onChange={e => change({ minSize: e.target.value as DiscoveryFilters['minSize'] }, 'push')} className={selectCls}>
              <option value="">Any</option>
              {SIZE_OPTIONS.map(x => <option key={x} value={x}>{`≥ ${n(Number(x))}`}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-widest text-ink/55">Closes within</span>
            <select value={filters.closing} onChange={e => change({ closing: e.target.value as DiscoveryFilters['closing'] }, 'push')} className={selectCls}>
              <option value="">Any time</option>
              {CLOSING_OPTIONS.map(x => <option key={x} value={x}>{CLOSING_LABEL[x]}</option>)}
            </select>
          </label>
        </div>
      </ExplorerDetails>

      {blocked && (
        <p role="status" className="rounded-xl px-3 py-2 text-xs text-amber-400/90" style={{ background: 'rgba(251,191,36,0.07)' }}>
          {`This link has invalid filter values (${invalidKeys.join(', ')}), so no results are shown. Reset filters or choose new values.`}
        </p>
      )}
      <p className="text-xs text-ink/55" aria-live="polite">
        Search and filters apply to the discovered sample only. Showing {visible.length} of {shown.length} event groups
        {shown.length !== groups.length ? ` (filtered from ${groups.length} in the sample)` : ''}.
        {resetNote ? ` ${resetNote}` : ''}
      </p>
      {(filters.maxSpread || filters.minSize || filters.closing) && (
        <p className="text-xs text-ink/55">
          {filters.maxSpread || filters.minSize
            ? 'Spread and size filters keep only rows with a coherent two-sided quote; missing, one-sided or crossed quotes are hidden while they are on. '
            : ''}
          {page && filters.closing
            ? `"Closes within" counts from this sample's retrieval time (${formatUtc(page.receivedAt)}), not from now; markets with an unknown close time are hidden while it is on.`
            : ''}
        </p>
      )}
      {active && (
        <p className="text-xs text-ink/55">Shared links keep these filters, not this sample: opening the link may load a different sample.</p>
      )}
      <KalshiQuotePolicyNote />

      {error && (
        <div role="alert" className="rounded-2xl p-4 text-sm flex flex-wrap items-center justify-between gap-3"
          style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)' }}>
          <span className="text-rose-400">
            {error}
            {page ? ` Showing the previous sample retrieved ${formatUtc(page.receivedAt)}.` : ''}
          </span>
          <button type="button" onClick={refresh} disabled={busy} className={btn} style={btnStyle}>Retry</button>
        </div>
      )}

      {page && groups.length === 0 ? (
        <div className="glass rounded-2xl py-16 text-center text-sm text-ink/55">
          {page.coverage.tradesScanned === 0
            ? 'No recent trades in the scanned window.'
            : 'No open binary $1 markets among the sampled tickers.'}
        </div>
      ) : shown.length === 0 && groups.length > 0 ? (
        <div className="glass rounded-2xl py-16 text-center text-sm text-ink/55">No event groups in the sample match these filters.</div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div id={GROUPS_ID} className="grid w-full gap-3 lg:grid-cols-2">
            {visible.map(g => (
              <GroupCard key={g.eventTicker} g={g} sampled={sampledCount.get(g.eventTicker) ?? g.markets.length} filtered={active}
                open={expanded.includes(g.eventTicker)}
                onToggle={() => setExpanded(x => (x.includes(g.eventTicker) ? x.filter(t => t !== g.eventTicker) : [...x, g.eventTicker]))} />
            ))}
          </div>
          {shown.length > VISIBLE_GROUPS && (
            <button type="button" onClick={() => setAllGroups(v => !v)} aria-expanded={allGroups} aria-controls={GROUPS_ID}
              className={btn} style={btnStyle}>
              {allGroups ? 'Show fewer event groups' : `View all ${shown.length} event groups`}
            </button>
          )}
        </div>
      )}

      {c && (
        <details className="glass rounded-2xl p-4 text-xs text-ink/55">
          <summary className="cursor-pointer font-semibold text-ink/55">Sample coverage</summary>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
            {([
              ['Trade window', `${formatUtc(c.windowStart)} – ${formatUtc(c.windowEnd)}`],
              ['Trades scanned', n(c.tradesScanned)],
              ['Trade pages', n(c.tradePages)],
              ['Rejected trade rows', n(c.rejectedTrades)],
              ['Oldest scanned trade', formatUtc(c.oldestTradeAt)],
              ['Newest scanned trade', formatUtc(c.newestTradeAt)],
              ['Unique tickers in sample', n(c.uniqueTickers)],
              ['Tickers checked', n(c.selectedTickers)],
              ['Market pages', n(c.marketPages)],
              ['Rejected market rows', n(c.rejectedMarkets)],
              ['Event details requested', n(c.eventMetadataRequested)],
              ['Event details failed', n(c.eventMetadataFailed)],
            ] as const).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2"><dt>{label}</dt><dd className="font-mono text-ink/65">{value}</dd></div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}
