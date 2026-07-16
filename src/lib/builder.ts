// Public Polymarket builder identifier. It is attached to CLOB orders for
// Builder attribution and reused as the configured outbound referral value.
export const BUILDER_CODE =
  '0x3de582e958417cb3a2ed5ac595fae482af3dc1706d2a683d0a0a7230d4c2aa7e';

const POLYMARKET = 'https://polymarket.com';

export type MarketCampaignContext =
  | 'activity_feed'
  | 'home_hot_bets'
  | 'home_live_ticker'
  | 'home_recent_trades'
  | 'home_top_markets'
  | 'liquidity_backtester'
  | 'liquidity_opportunities'
  | 'liquidity_reward_farms'
  | 'markets_explorer'
  | 'markets_featured'
  | 'wallet_latest_moves'
  | 'wallet_positions'
  | 'world_cup_board'
  | 'world_cup_hub';

/**
 * Polymarket profil URL'si, builder code ile
 */
export function profileUrl(address: string): string {
  return `${POLYMARKET}/profile/${address}?ref=${BUILDER_CODE}`;
}

/**
 * Builds a Polymarket market URL with the configured referral value and
 * standard campaign parameters. Requiring a placement context prevents new
 * outbound market links from silently losing attribution.
 */
export function marketUrl(eventSlug: string | undefined, slug: string | undefined, campaignContext: MarketCampaignContext): string {
  const path = eventSlug ? `/event/${eventSlug}` : slug ? `/market/${slug}` : '';
  const url = new URL(path, POLYMARKET);
  url.searchParams.set('ref', BUILDER_CODE);
  url.searchParams.set('utm_source', 'alphaboard');
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', 'market_outbound');
  url.searchParams.set('utm_content', campaignContext);
  return url.toString();
}

/**
 * Herhangi bir Polymarket URL'sine builder code query param ekler
 * Zaten ref parametresi varsa üzerine yazar
 */
export function withBuilderCode(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('ref', BUILDER_CODE);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}ref=${BUILDER_CODE}`;
  }
}
