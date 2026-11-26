import { unstable_cache } from 'next/cache';
import { scanKalshiRewardFarms, type KalshiRewardsScan } from '@/lib/kalshiRewards';

/* Shared data cache: one scan (~70 market batches) serves every visitor for 5 minutes, refreshed in the background.
   Only complete scans are cached; a partial one is returned uncached on a cold cache and never replaces a complete one.
   Bump the key when the shape changes: the data cache outlives a deployment. */
export class PartialKalshiRewards extends Error {
  constructor(readonly scan: KalshiRewardsScan) { super('partial Kalshi rewards scan'); this.name = 'PartialKalshiRewards'; }
}

export async function completeOrThrow(scan: () => Promise<KalshiRewardsScan> = scanKalshiRewardFarms): Promise<KalshiRewardsScan> {
  const result = await scan();
  if (!result.complete) throw new PartialKalshiRewards(result);
  return result;
}

const cached = unstable_cache(() => completeOrThrow(), ['kalshi-rewards-v3'], { revalidate: 300, tags: ['kalshi-rewards'] });

export async function readKalshiRewards(get: () => Promise<KalshiRewardsScan> = cached): Promise<KalshiRewardsScan> {
  try { return await get(); } catch (e) {
    if (e instanceof PartialKalshiRewards) return e.scan;
    throw e;
  }
}
