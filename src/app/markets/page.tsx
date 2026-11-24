import type { ReactNode } from 'react';
import type { TopMarket } from '@/types';
import { fetchMarketsList } from '@/lib/markets';
import { permanentRedirect } from 'next/navigation';
import MarketsClient from './MarketsClient';
import KalshiTopClient from './KalshiTopClient';
import { getCachedKalshiTop } from '@/lib/kalshiTopCache';
import type { KalshiTopScan } from '@/lib/kalshiTop';
import MarketPlatformSelect, { KALSHI_HREF, resolvePlatform } from './MarketPlatformSelect';

/* Server component: fetches the default market list so crawlers and the
   first paint see real data instead of an empty shell. The client component
   takes over for sorting/filtering/refreshing. Revalidates every 2 minutes.
   ?platform=kalshi shows every open Kalshi market ranked by 24h volume (full scan, cached 15 min), in the same frame
   as Polymarket. Legacy ?view= / ?series= URLs (Discover, Newest, Events lists) redirect permanently to it. */

export const revalidate = 120;
// The Kalshi Top view may run the (cached, 15 min) full open-market scan when its cache entry is refreshed.
export const maxDuration = 120;

/* Provider navigation row; the client stays a sibling at the same level. */
const NavRow = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{children}</div>;

/** Timestamp shared with the client so relative "time left" labels hydrate identically. */
const renderedAt = () => Date.now();

export default async function MarketsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const platform = resolvePlatform(sp.platform);

  if (platform === 'kalshi') {
    // One Kalshi view, in the same frame as Polymarket. The former Discover / Newest / Events list URLs land here.
    if (sp.view !== undefined || sp.series !== undefined) permanentRedirect(KALSHI_HREF);
    let scan: KalshiTopScan | null = null;
    let error: string | null = null;
    try {
      scan = await getCachedKalshiTop();
    } catch {
      error = 'Kalshi markets could not be loaded right now.';
    }
    return (
      <div className="flex flex-col gap-6">
        <NavRow><MarketPlatformSelect active="kalshi" /></NavRow>
        <KalshiTopClient scan={scan} error={error} serverNow={renderedAt()} />
      </div>
    );
  }

  // The 24h-volume list plus a deep pool (top by total volume), both server-side, so the market count and the
  // category filters are the same from the first paint (no jump when the pool used to load on the first chip click).
  const [initialMarkets, initialExtra] = await Promise.all([
    fetchMarketsList('vol24h', 200).catch((): TopMarket[] => []),
    fetchMarketsList('volume', 200).catch((): TopMarket[] => []),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <NavRow><MarketPlatformSelect active="polymarket" /></NavRow>
      <MarketsClient key="polymarket" initialMarkets={initialMarkets} initialExtra={initialExtra} serverNow={renderedAt()} />
    </div>
  );
}
