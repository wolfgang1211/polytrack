import type { ReactNode } from 'react';
import type { TopMarket } from '@/types';
import { fetchMarketsList } from '@/lib/markets';
import { TICKER_RE, fetchKalshiMarkets, type KalshiMarketsPage } from '@/lib/kalshi';
import { DEFAULT_EVENT_LIMIT, fetchKalshiEvents, type KalshiEventsPage } from '@/lib/kalshiEvents';
import type { KalshiDiscoveryPage } from '@/lib/kalshiDiscovery';
import { getCachedKalshiDiscovery } from '@/lib/kalshiDiscoveryCache';
import { parseDiscoveryFilters } from '@/lib/kalshiDiscoveryFilters';
import Link from 'next/link';
import MarketsClient from './MarketsClient';
import KalshiMarketsClient from './KalshiMarketsClient';
import KalshiEventsClient from './KalshiEventsClient';
import KalshiDiscoveryClient from './KalshiDiscoveryClient';
import KalshiTopClient from './KalshiTopClient';
import { getCachedKalshiTop } from '@/lib/kalshiTopCache';
import type { KalshiTopScan } from '@/lib/kalshiTop';
import MarketPlatformSelect, { DISCOVER_HREF, KalshiViewSelect, resolveKalshiView, resolvePlatform } from './MarketPlatformSelect';

/* Server component: fetches the default market list so crawlers and the
   first paint see real data instead of an empty shell. The client component
   takes over for sorting/filtering/refreshing. Revalidates every 2 minutes.
   ?platform=kalshi switches to the read-only Kalshi provider; Polymarket stays the default.
   ?platform=kalshi&view=events lists open Kalshi events; ?series=<TICKER> filters them (exact scalar only).
   ?platform=kalshi&view=top ranks every open Kalshi market by 24h volume (full scan, cached 15 min) — the Kalshi default.
   ?platform=kalshi&view=discover shows a bounded recent-trade SAMPLE grouped by event (not a global ranking). */

export const revalidate = 120;
// The Kalshi Top view may run the (cached, 15 min) full open-market scan when its cache entry is refreshed.
export const maxDuration = 60;

/* Provider + view navigation share one wrapping row; the client stays a sibling at the same level. */
const NavRow = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{children}</div>;

/** Timestamp shared with the client so relative "time left" labels hydrate identically. */
const renderedAt = () => Date.now();

export default async function MarketsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const platform = resolvePlatform(sp.platform);
  const view = resolveKalshiView(sp.view);

  if (platform === 'kalshi' && view === 'top') {
    let scan: KalshiTopScan | null = null;
    let error: string | null = null;
    try {
      scan = await getCachedKalshiTop();
    } catch {
      error = 'Kalshi markets could not be loaded right now.';
    }
    return (
      <div className="flex flex-col gap-6">
        <NavRow><MarketPlatformSelect active="kalshi" /><KalshiViewSelect active="top" /></NavRow>
        <KalshiTopClient scan={scan} error={error} serverNow={renderedAt()} />
      </div>
    );
  }

  if (platform === 'kalshi' && view === 'discover') {
    // Every entry (incl. repeated values) is kept so the strict parser can reject duplicates; filters never go upstream.
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) params.append(k, x);
    const initialFilters = parseDiscoveryFilters(params);
    let initial: KalshiDiscoveryPage | null = null;
    let initialError: string | null = null;
    try {
      initial = await getCachedKalshiDiscovery();
    } catch {
      initialError = 'Kalshi discovery could not be loaded right now.';
    }
    return (
      <div className="flex flex-col gap-6">
        <NavRow><MarketPlatformSelect active="kalshi" /><KalshiViewSelect active="discover" /></NavRow>
        {/* Key = server-parsed filters only: a server navigation to different filters remounts instead of keeping stale
            useState; foreign query keys and the client's own native-history updates never change it. */}
        <KalshiDiscoveryClient key={JSON.stringify(initialFilters)} initial={initial} initialError={initialError} initialFilters={initialFilters} />
      </div>
    );
  }

  if (platform === 'kalshi' && view === 'events') {
    // Invalid or repeated series is never forwarded upstream; the list falls back to unfiltered.
    const series = typeof sp.series === 'string' && TICKER_RE.test(sp.series) ? sp.series : null;
    const ignoredSeries = sp.series !== undefined && sp.series !== '' && series === null;
    let initial: KalshiEventsPage | null = null;
    let initialError: string | null = null;
    try {
      initial = await fetchKalshiEvents({ limit: DEFAULT_EVENT_LIMIT, ...(series ? { seriesTicker: series } : {}) });
    } catch {
      initialError = 'Kalshi events could not be loaded right now.';
    }
    return (
      <div className="flex flex-col gap-6">
        <NavRow><MarketPlatformSelect active="kalshi" /><KalshiViewSelect active="events" /></NavRow>
        <form method="get" action="/markets" className="flex flex-wrap items-end gap-2" aria-label="Filter events by series">
          <input type="hidden" name="platform" value="kalshi" />
          <input type="hidden" name="view" value="events" />
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-widest text-ink/55">Series ticker</span>
            <input name="series" defaultValue={series ?? ''} placeholder="e.g. KXFEDDECISION" autoComplete="off"
              className="rounded-xl glass bg-transparent px-3 py-2 text-sm font-mono text-ink/80 placeholder-ink/25 outline-none" />
          </label>
          <button type="submit" className="rounded-lg px-3 py-2 text-xs font-semibold text-ink/70"
            style={{ background: 'rgba(var(--ink-rgb),0.05)', border: '1px solid rgba(var(--ink-rgb),0.1)' }}>
            Apply
          </button>
          {ignoredSeries && <p className="w-full text-xs text-ink/55">Series filter ignored: not a valid single Kalshi ticker. Showing all open events.</p>}
        </form>
        <KalshiEventsClient key={series ?? '*'} initial={initial} initialError={initialError} seriesTicker={series} />
      </div>
    );
  }

  if (platform === 'kalshi') {
    let initial: KalshiMarketsPage | null = null;
    let initialError: string | null = null;
    try {
      initial = await fetchKalshiMarkets({ limit: 100 });
    } catch {
      initialError = 'Kalshi markets could not be loaded right now.';
    }
    return (
      <div className="flex flex-col gap-6">
        <NavRow><MarketPlatformSelect active="kalshi" /><KalshiViewSelect active="markets" /></NavRow>
        <p className="rounded-2xl glass px-4 py-3 text-xs text-ink/55 max-w-3xl">
          This list shows Kalshi&apos;s newest listings first, as the source returns them. It is not a volume ranking of all Kalshi markets.{' '}
          <Link href={DISCOVER_HREF} className="font-semibold text-ink/80 underline underline-offset-2">Open Discover (recent trading activity)</Link>
        </p>
        <KalshiMarketsClient key="kalshi" initial={initial} initialError={initialError} />
      </div>
    );
  }

  let initialMarkets: TopMarket[];
  try {
    initialMarkets = await fetchMarketsList('vol24h', 200);
  } catch {
    initialMarkets = [];
  }
  return (
    <div className="flex flex-col gap-6">
      <NavRow><MarketPlatformSelect active="polymarket" /></NavRow>
      <MarketsClient key="polymarket" initialMarkets={initialMarkets} serverNow={renderedAt()} />
    </div>
  );
}
