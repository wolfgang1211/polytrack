/* Polymarket liquidity-rewards helpers — parse the real reward-program
   fields gamma attaches to markets (clobRewards / rewardsMinSize /
   rewardsMaxSpread). Used by the Liquidity Hub APIs. */

export interface MarketRewards {
  dailyRate: number;            // USD paid out per day to makers
  minSize: number | null;       // min qualifying order size (shares)
  maxSpread: number | null;     // max distance from mid to qualify (¢)
}

/* Match-type markets (single games, O/U, spreads, exact scores…) resolve in
   hours and get run over by in-play moves — structurally bad LP inventory,
   whatever the sport. Season-long futures are allowed through. */
const MATCH_PATTERNS =
  /\bvs\.?\s|\bO\/U\b|over\/under|^spread:|exact score|halftime|half time|both teams to score|total (?:corners|rounds|goals|points)|team to advance|win on \d{4}-\d{2}-\d{2}|\bmap \d|\(bo\d\)|end in a draw|leading at/i;
const MATCH_SLUGS = /^(?:mlb|nba|nhl|nfl|lol|cs2?|csgo|val|dota|fifwc)-|-(?:\d{4}-\d{2}-\d{2})(?:-|$)/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isMatchMarket(m: any): boolean {
  const q = String(m?.question ?? '');
  const slug = String(m?.slug ?? '');
  return MATCH_PATTERNS.test(q) || MATCH_SLUGS.test(slug);
}

/* Sum the active daily reward pools attached to a gamma market. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rewardsOf(m: any): MarketRewards {
  let dailyRate = 0;
  const now = Date.now();
  if (Array.isArray(m?.clobRewards)) {
    for (const r of m.clobRewards) {
      const rate = Number(r?.rewardsDailyRate ?? r?.rewards_daily_rate ?? 0) || 0;
      const start = r?.startDate ? new Date(r.startDate).getTime() : null;
      const end = r?.endDate ? new Date(r.endDate).getTime() : null;
      const active = (start == null || isNaN(start) || start <= now)
        && (end == null || isNaN(end) || end >= now - 86_400_000);
      if (active) dailyRate += rate;
    }
  }
  const minSizeRaw = m?.rewardsMinSize != null ? Number(m.rewardsMinSize) : NaN;
  const maxSpreadRaw = m?.rewardsMaxSpread != null ? Number(m.rewardsMaxSpread) : NaN;
  return {
    dailyRate,
    minSize: Number.isFinite(minSizeRaw) && minSizeRaw > 0 ? minSizeRaw : null,
    maxSpread: Number.isFinite(maxSpreadRaw) && maxSpreadRaw > 0 ? maxSpreadRaw : null,
  };
}
