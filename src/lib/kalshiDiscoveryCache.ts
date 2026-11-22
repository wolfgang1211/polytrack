import { KalshiError, type KalshiErrorStatus } from './kalshi';
import { fetchKalshiDiscovery, isDiscoveryPage, type KalshiDiscoveryPage } from '@/lib/kalshiDiscovery';

/* Process-local, single-entry cache for the read-only Discover sample. Freshness is a strict 20 s from load COMPLETION on a
   monotonic clock; no stale serving, no stale fallback, errors and invalid payloads are never retained. Not shared across
   server instances. Timestamps/coverage are kept exactly as loaded; a hit never claims newer data. */
export const DISCOVERY_CACHE_TTL_MS = 20_000;

export function createKalshiDiscoveryCache(
  fetcher: () => Promise<unknown>,
  now: () => number = () => performance.now(),
): () => Promise<KalshiDiscoveryPage> {
  let entry: { value: KalshiDiscoveryPage; at: number } | null = null;
  let inflight: Promise<KalshiDiscoveryPage> | null = null;

  return async function getKalshiDiscovery() {
    if (entry) {
      const age = now() - entry.at;
      // Negative age = clock went backwards: invalidate rather than extend freshness.
      if (age >= 0 && age < DISCOVERY_CACHE_TTL_MS) return structuredClone(entry.value);
      entry = null;
    }
    if (!inflight) {
      // async IIFE turns a synchronous fetcher throw into a rejection shared by every waiter.
      const flight = (async () => {
        const raw = await fetcher();
        if (!isDiscoveryPage(raw)) throw new KalshiError(502, 'Kalshi discovery returned an unexpected response shape.');
        const value = structuredClone(raw); // detach from the loader's object before storing
        entry = { value, at: now() };
        return value;
      })();
      inflight = flight;
      // Cleared only after assignment and settlement (never synchronously), so a sync throw cannot leave a stuck rejection.
      const clear = () => { if (inflight === flight) inflight = null; };
      flight.then(clear, clear);
    }
    return structuredClone(await inflight); // per-caller copy so callers never share or poison the entry
  };
}

/* Next bundles the SSR page and the API route as separate module graphs in one server process, so a module-scope
   instance would be duplicated. The single default getter lives in one versioned process-global slot instead. */
const SLOT = Symbol.for('alphaboard.kalshi.discovery-cache.v1');
const STATUSES: ReadonlySet<number> = new Set<KalshiErrorStatus>([400, 404, 422, 502, 503, 504]);
const sharedGetter = () => {
  const g = globalThis as unknown as Record<symbol, (() => Promise<KalshiDiscoveryPage>) | undefined>;
  return (g[SLOT] ??= createKalshiDiscoveryCache(fetchKalshiDiscovery));
};

export async function getCachedKalshiDiscovery(): Promise<KalshiDiscoveryPage> {
  try {
    return await sharedGetter()();
  } catch (e) {
    if (e instanceof KalshiError) throw e;
    // Another graph's KalshiError class: keep only a validated status, as this graph's class, with a fixed message.
    const status = (e as { status?: unknown } | null)?.status;
    if (e instanceof Error && e.name === 'KalshiError' && typeof status === 'number' && STATUSES.has(status)) {
      throw new KalshiError(status as KalshiErrorStatus, 'Kalshi discovery is unavailable right now.');
    }
    throw e;
  }
}
