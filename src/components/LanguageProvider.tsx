'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LOCALE, type Locale, normalizeLocale, translate } from '@/lib/i18n';

const STORAGE_KEY = 'alphaboard-locale';
const COOKIE_KEY = 'alphaboard_locale';

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readCookieLocale(): Locale | null {
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${COOKIE_KEY}=`));

  if (!match) return null;
  return normalizeLocale(decodeURIComponent(match.split('=')[1] ?? ''));
}

function readStoredLocale(): Locale | null {
  try {
    return normalizeLocale(window.localStorage.getItem(STORAGE_KEY))
      ?? readCookieLocale()
      ?? normalizeLocale(window.navigator.language);
  } catch {
    return null;
  }
}

function persistLocale(locale: Locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.cookie = `${COOKIE_KEY}=${locale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = locale;
  } catch {
    // No-op: private mode / disabled storage should not break the UI.
  }
}

export default function LanguageProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const stored = readStoredLocale();
    // Must run after mount to avoid SSR/client text mismatches when a saved locale exists.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setLocaleState(stored);
  }, []);

  useEffect(() => {
    persistLocale(locale);
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => translate(locale, key, fallback),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return context;
}
