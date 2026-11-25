import { unstable_cache } from 'next/cache';
import { scanKalshiTopMarkets, type KalshiTopScan } from '@/lib/kalshiTop';

/* Bump the key whenever the scan's shape or budget changes: the data cache outlives a deployment.
   Shared data cache (Vercel Data Cache): one full scan serves every visitor for 15 minutes, then it is refreshed in
   the background while the previous result is still served.
   Only complete scans are cached. A partial scan (time budget or Kalshi rate limit) throws inside the cached function:
   on a background refresh Next keeps serving the previous complete scan; with no cache entry at all the caller still
   gets the partial scan, labelled as partial, uncached. Errors are never cached. */
export const KALSHI_TOP_REVALIDATE_S = 900;

export class PartialKalshiScan extends Error {
  constructor(readonly scan: KalshiTopScan) {
    super(`partial Kalshi scan (${scan.stopReason}, ${scan.pages} pages)`);
    this.name = 'PartialKalshiScan';
  }
}

export async function completeScanOrThrow(scan: () => Promise<KalshiTopScan> = scanKalshiTopMarkets): Promise<KalshiTopScan> {
  const result = await scan();
  if (!result.complete) throw new PartialKalshiScan(result);
  return result;
}

const cachedCompleteScan: () => Promise<KalshiTopScan> = unstable_cache(
  () => completeScanOrThrow(),
  ['kalshi-top-events-v6'],
  { revalidate: KALSHI_TOP_REVALIDATE_S, tags: ['kalshi-top'] },
);

export async function readKalshiTop(cached: () => Promise<KalshiTopScan>): Promise<KalshiTopScan> {
  try {
    return await cached();
  } catch (e) {
    if (e instanceof PartialKalshiScan) return e.scan;
    throw e;
  }
}

export const getCachedKalshiTop = (): Promise<KalshiTopScan> => readKalshiTop(cachedCompleteScan);
