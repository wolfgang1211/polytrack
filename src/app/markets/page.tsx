import type { TopMarket } from '@/types';
import { fetchMarketsList } from '@/lib/markets';
import MarketsClient from './MarketsClient';

/* Server component: fetches the default market list so crawlers and the
   first paint see real data instead of an empty shell. The client component
   takes over for sorting/filtering/refreshing. Revalidates every 2 minutes. */

export const revalidate = 120;

export default async function MarketsPage() {
  let initialMarkets: TopMarket[];
  try {
    initialMarkets = await fetchMarketsList('vol24h', 200);
  } catch {
    initialMarkets = [];
  }
  return <MarketsClient initialMarkets={initialMarkets} />;
}
