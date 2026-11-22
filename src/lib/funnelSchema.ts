import { parseOutboundEvent } from '@/lib/outboundAnalytics';

export const PAGE_GROUPS = ['home', 'leaderboard', 'wallet', 'markets', 'liquidity', 'compare', 'activity', 'insights', 'blog', 'watchlist', 'checker', 'info'] as const;
export type PageGroup = typeof PAGE_GROUPS[number];
export type FunnelEvent = { event: 'page_view'; page: PageGroup }
  | { event: 'polymarket_outbound_click'; page: PageGroup; kind: 'market' | 'profile' | 'other'; placement: string };

/** Route category only. Never return or transmit a wallet, slug or query. */
export function pageGroup(pathname: string): PageGroup | null {
  if (pathname === '/') return 'home';
  if (/^\/wallet\/0x[\da-f]{40}\/?$/i.test(pathname)) return 'wallet';
  if (/^\/blog\/[a-z0-9-]+\/?$/.test(pathname)) return 'blog';
  const fixed: Record<string, PageGroup> = {
    '/leaderboard': 'leaderboard', '/markets': 'markets', '/liquidity': 'liquidity',
    '/polymarket-lp-rewards': 'liquidity', '/how-polymarket-liquidity-rewards-work': 'liquidity', '/compare': 'compare', '/activity': 'activity', '/insights': 'insights',
    '/blog': 'blog', '/watchlist': 'watchlist', '/checker': 'checker',
    '/faq': 'info', '/privacy': 'info', '/terms': 'info', '/disclaimer': 'info', '/api-docs': 'info',
  };
  return Object.hasOwn(fixed, pathname) ? fixed[pathname] : null;
}
export function parseFunnelEvent(value: unknown): FunnelEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.page !== 'string' || !(PAGE_GROUPS as readonly string[]).includes(row.page)) return null;
  if (row.event === 'page_view' && Object.keys(row).length === 2) return { event: 'page_view', page: row.page as PageGroup };
  if (Object.keys(row).length !== 4) return null;
  const outbound = parseOutboundEvent({ event: row.event, kind: row.kind, placement: row.placement });
  return outbound ? { ...outbound, page: row.page as PageGroup } : null;
}

export function permitsAnalytics(preference: { doNotTrack?: string | null; globalPrivacyControl?: boolean }): boolean {
  return preference.doNotTrack !== '1' && preference.globalPrivacyControl !== true;
}
