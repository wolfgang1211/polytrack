'use client';

import { useSyncExternalStore } from 'react';
import { LP_REWARDS_STALE_MINUTES } from '@/lib/lpRewardsPage';

const noopSubscribe = () => () => {};

/** Client-only notice when the cached page is older than expected. Renders nothing on the server, so it cannot cause a hydration mismatch. */
export default function SnapshotAge({ generatedAt }: { generatedAt: string }) {
  const t = new Date(generatedAt).getTime();
  // Server snapshot is null (nothing rendered), so hydration always matches; the browser then reads its own clock.
  const minutes = useSyncExternalStore(
    noopSubscribe,
    () => (Number.isFinite(t) ? Math.floor((Date.now() - t) / 60_000) : null),
    () => null,
  );
  if (minutes === null || minutes < LP_REWARDS_STALE_MINUTES) return null;
  const age = minutes < 120 ? `${minutes} minutes` : `${Math.floor(minutes / 60)} hours`;
  return (
    <p role="status" className="mt-3 rounded-lg px-3 py-2 text-xs text-amber-400" style={{ border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.06)' }}>
      This snapshot is {age} old; the latest refresh may have failed. Check Polymarket for current values.
    </p>
  );
}
