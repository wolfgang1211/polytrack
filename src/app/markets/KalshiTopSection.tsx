import KalshiTopClient from './KalshiTopClient';
import { getCachedKalshiTop } from '@/lib/kalshiTopCache';
import type { KalshiTopScan } from '@/lib/kalshiTop';

/** Timestamp shared with the client so relative "time left" labels hydrate identically. */
const renderedAt = () => Date.now();

/* Streams inside a Suspense boundary: the page frame and the loading state show at once, so a click on "Kalshi"
   never looks dead while a cold cache runs the full scan (~50 s). */
export default async function KalshiTopSection() {
  let scan: KalshiTopScan | null = null;
  let error: string | null = null;
  try {
    scan = await getCachedKalshiTop();
  } catch {
    error = 'Kalshi markets could not be loaded right now.';
  }
  return <KalshiTopClient scan={scan} error={error} serverNow={renderedAt()} />;
}

export function KalshiTopLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" data-kalshi-loading="" className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-ink">Loading Kalshi markets…</p>
        <p className="mt-1 text-sm text-ink/70">
          The first load after a refresh scans every open Kalshi market and can take up to a minute.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-36 animate-pulse rounded-2xl" style={{ background: 'var(--accent-fill)' }} />
        ))}
      </div>
    </div>
  );
}
