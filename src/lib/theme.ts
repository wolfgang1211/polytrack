/**
 * Theme preference (Dark / Light / System). The preference is the user's choice;
 * the resolved theme is what is actually painted. Default is `system`.
 *
 * Source of truth at runtime is `<html data-theme-preference>` (set first by the
 * inline THEME_INIT_SCRIPT before paint, then by setThemePreference). Storage is a
 * best-effort persistence layer only: blocked storage never prevents applying.
 */
export const THEME_STORAGE_KEY = 'alphaboard-theme';
export const THEME_PREFERENCES = ['dark', 'light', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = 'dark' | 'light';
export const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system' ? value : 'system';
}

export function resolveTheme(preference: unknown, systemDark: boolean): ResolvedTheme {
  const p = normalizeThemePreference(preference);
  if (p === 'system') return systemDark ? 'dark' : 'light';
  return p;
}

/**
 * Standalone ES5 script rendered inline in <head>. No module system, no
 * CustomEvent, every browser API guarded. Missing/failing matchMedia => dark.
 * OS changes apply only while the *current* preference (read from the DOM) is
 * system, so choices made by the React control stay fixed even without storage.
 */
export const THEME_INIT_SCRIPT = `(function(){
var K=${JSON.stringify(THEME_STORAGE_KEY)},d,mq=null;
try{d=document.documentElement;}catch(e){return;}
function n(v){return v==='dark'||v==='light'||v==='system'?v:'system';}
function sys(){try{if(!mq&&typeof window.matchMedia==='function'){mq=window.matchMedia(${JSON.stringify(THEME_MEDIA_QUERY)});}return mq?!!mq.matches:true;}catch(e){return true;}}
function apply(v){var p=n(v),t=p==='system'?(sys()?'dark':'light'):p;try{d.dataset.theme=t;d.dataset.themePreference=p;}catch(e){try{d.setAttribute('data-theme',t);d.setAttribute('data-theme-preference',p);}catch(e2){}}try{d.style.colorScheme=t;}catch(e){}}
var s=null;try{s=window.localStorage.getItem(K);}catch(e){s=null;}
sys();
apply(s);
try{if(mq){var h=function(){var c=null;try{c=d.dataset.themePreference;}catch(e){}if(n(c)==='system'){apply('system');}};if(typeof mq.addEventListener==='function'){mq.addEventListener('change',h);}else if(typeof mq.addListener==='function'){mq.addListener(h);}}}catch(e){}
try{window.addEventListener('storage',function(e){if(!e){return;}if(e.key===null){apply(null);}else if(e.key===K){apply(e.newValue);}});}catch(e){}
})();`;

/* ---------- client helpers (SSR-safe; no-ops on the server) ---------- */

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.documentElement;
}

export function getSystemPrefersDark(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(THEME_MEDIA_QUERY).matches
      : true;
  } catch {
    return true;
  }
}

/** Paints a preference immediately (dataset + color-scheme). Never touches storage. */
export function applyThemePreference(value: unknown): ResolvedTheme {
  const preference = normalizeThemePreference(value);
  const theme = resolveTheme(preference, getSystemPrefersDark());
  const el = rootElement();
  if (el) {
    el.dataset.theme = theme;
    el.dataset.themePreference = preference;
    el.style.colorScheme = theme;
  }
  return theme;
}

/** Applies first, then persists best-effort. Returns whether persistence succeeded. */
export function setThemePreference(value: unknown): boolean {
  const preference = normalizeThemePreference(value);
  applyThemePreference(preference);
  let persisted = false;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    persisted = true;
  } catch {
    persisted = false;
  }
  notify();
  return persisted;
}

export function getThemePreferenceSnapshot(): ThemePreference {
  const el = rootElement();
  return normalizeThemePreference(el ? el.dataset.themePreference : undefined);
}

export function getServerThemePreferenceSnapshot(): ThemePreference {
  return 'system';
}

const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;
function notify() {
  for (const fn of Array.from(listeners)) fn();
}

/**
 * useSyncExternalStore subscription: fires on same-tab changes (setThemePreference
 * and any DOM attribute change, e.g. from the init script's storage listener).
 */
export function subscribeThemePreference(callback: () => void): () => void {
  listeners.add(callback);
  const el = rootElement();
  if (!observer && el && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(notify);
    observer.observe(el, { attributes: true, attributeFilter: ['data-theme-preference'] });
  }
  return () => {
    listeners.delete(callback);
    if (!listeners.size && observer) {
      observer.disconnect();
      observer = null;
    }
  };
}
