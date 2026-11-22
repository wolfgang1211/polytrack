export interface OutboundEvent {
  event: 'polymarket_outbound_click';
  kind: 'market' | 'profile' | 'other';
  placement: string;
}
const PLACEMENTS = new Set([
  'activity_feed', 'home_hot_bets', 'home_live_ticker', 'home_recent_trades', 'home_top_markets',
  'liquidity_backtester', 'liquidity_farm_changes', 'liquidity_opportunities', 'liquidity_reward_farms', 'lp_rewards_page',
  'markets_explorer', 'markets_featured', 'wallet_latest_moves', 'wallet_positions',
  'world_cup_board', 'world_cup_hub', 'unattributed',
]);

/** Excludes URLs, wallets, referrals, user IDs and amounts. A click is NOT a
 * signup, matched trade or builder-attributed volume. */
export function outboundEvent(href: string): OutboundEvent | null {
  try {
    const url = new URL(href);
    if (url.origin !== 'https://polymarket.com' || url.username || url.password) return null;
    const context = url.searchParams.get('utm_content') ?? '';
    return {
      event: 'polymarket_outbound_click',
      kind: /^\/(event|market)\//.test(url.pathname) ? 'market' : url.pathname.startsWith('/profile/') ? 'profile' : 'other',
      placement: PLACEMENTS.has(context) ? context : 'unattributed',
    };
  } catch { return null; }
}

/** Input is freshly JSON-decoded transport data, not an arbitrary task object. */
export function parseOutboundEvent(value: unknown): OutboundEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== 3 || row.event !== 'polymarket_outbound_click'
    || !['market', 'profile', 'other'].includes(row.kind as string)
    || typeof row.placement !== 'string' || !PLACEMENTS.has(row.placement)) return null;
  return { event: 'polymarket_outbound_click', kind: row.kind as OutboundEvent['kind'], placement: row.placement };
}
