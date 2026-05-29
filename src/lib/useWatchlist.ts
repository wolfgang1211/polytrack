'use client';

import { useState, useCallback, useEffect } from 'react';

const KEY = 'polytrack_watchlist';

interface WatchedWallet {
  address: string;
  label?: string;
  addedAt: number;
}

function loadList(): WatchedWallet[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); }
  catch { return []; }
}

function saveList(list: WatchedWallet[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function useWatchlist() {
  const [list, setList] = useState<WatchedWallet[]>([]);

  useEffect(() => {
    setList(loadList());
    function onStorage(e: StorageEvent) {
      if (e.key === KEY) setList(loadList());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isWatched = useCallback(
    (address: string) => list.some(w => w.address === address.toLowerCase()),
    [list],
  );

  const toggle = useCallback((address: string, label?: string) => {
    const addr = address.toLowerCase();
    setList(prev => {
      const next = prev.some(w => w.address === addr)
        ? prev.filter(w => w.address !== addr)
        : [...prev, { address: addr, label, addedAt: Date.now() }];
      saveList(next);
      return next;
    });
  }, []);

  return { isWatched, toggle };
}
