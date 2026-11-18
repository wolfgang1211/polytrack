'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  THEME_STORAGE_KEY,
  getServerThemePreferenceSnapshot,
  getThemePreferenceSnapshot,
  normalizeThemePreference,
  setThemePreference,
  subscribeThemePreference,
  type ThemePreference,
} from '@/lib/theme';

const OPTIONS: { value: ThemePreference; label: string; title: string }[] = [
  { value: 'dark', label: 'Dark', title: 'Always use the dark theme' },
  { value: 'light', label: 'Light', title: 'Always use the light theme' },
  { value: 'system', label: 'System', title: 'Auto: follow your device light/dark setting' },
];

function subscribe(callback: () => void) {
  const unsubscribe = subscribeThemePreference(callback);
  // Fallback for cross-tab sync where MutationObserver is unavailable; the inline
  // init script already repaints on these events, this only refreshes the control.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_STORAGE_KEY) callback();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    unsubscribe();
    window.removeEventListener('storage', onStorage);
  };
}

/** Native, keyboard/mobile friendly 3-option theme select (Dark / Light / System). */
export default function ThemeSelect({ className = '' }: { className?: string }) {
  // Server snapshot is 'system'; the real preference is read after hydration, so
  // markup never mismatches. Paint is already correct via THEME_INIT_SCRIPT.
  const preference = useSyncExternalStore(subscribe, getThemePreferenceSnapshot, getServerThemePreferenceSnapshot);
  const onChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setThemePreference(normalizeThemePreference(event.target.value));
  }, []);

  return (
    <span className={`relative inline-flex flex-shrink-0 ${className}`}>
      <select
        aria-label="Theme"
        title="Theme: Dark, Light or System (Auto follows your device)"
        value={preference}
        onChange={onChange}
        className="min-h-11 w-[86px] cursor-pointer appearance-none rounded-xl py-2 pl-3 pr-7 text-xs font-semibold text-ink/80 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)' }}
      >
        {OPTIONS.map(option => (
          <option key={option.value} value={option.value} title={option.title}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-ink/60"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd" />
      </svg>
    </span>
  );
}
