/* Polymarket liquidity-rewards helpers — parse the real reward-program
   fields gamma attaches to markets (clobRewards / rewardsMinSize /
   rewardsMaxSpread). Used by the Liquidity Hub APIs. */

export interface MarketRewards {
  dailyRate: number;            // USD paid out per day to makers
  minSize: number | null;       // min qualifying order size (shares)
  maxSpread: number | null;     // max distance from mid to qualify (¢)
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
