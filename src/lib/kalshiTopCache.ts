import { unstable_cache } from 'next/cache';
import { scanKalshiTopMarkets, type KalshiTopScan } from '@/lib/kalshiTop';

/* Shared data cache (Vercel Data Cache): one full scan serves every visitor for 15 minutes, then it is refreshed in
   the background while the previous result is still served. Errors are never cached. */
export const KALSHI_TOP_REVALIDATE_S = 900;

export const getCachedKalshiTop: () => Promise<KalshiTopScan> = unstable_cache(
  () => scanKalshiTopMarkets(),
  ['kalshi-top-events-v2'],
  { revalidate: KALSHI_TOP_REVALIDATE_S, tags: ['kalshi-top'] },
);
