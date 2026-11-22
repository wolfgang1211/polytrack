'use client';

import { useSyncExternalStore } from 'react';

/* A shared, minute-granular clock for "time left" labels.
   Server render and hydration both use the server's timestamp (getServerSnapshot),
   so the markup always matches; after hydration React switches to the browser clock. */

const MINUTE = 60_000;
const floorMinute = (t: number) => Math.floor(t / MINUTE) * MINUTE;

let current = floorMinute(Date.now());
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  const next = floorMinute(Date.now());
  if (next !== current) {
    current = next;
    listeners.forEach(fn => fn());
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  tick();
  if (!timer) timer = setInterval(tick, 15_000);
  return () => {
    listeners.delete(fn);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => current;

export function useNow(serverNow: number): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverNow);
}
