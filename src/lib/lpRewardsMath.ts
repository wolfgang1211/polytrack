/* Polymarket liquidity-reward formulas as documented at
   https://docs.polymarket.com/market-makers/liquidity-rewards — used to compute the worked examples on the explainer page. */

/** Scaling factor for single-sided liquidity; documented as "currently 3.0 on all markets". */
export const REWARD_C = 3;

/** S(v, s) = ((v − s) / v)² × b. v = max spread in cents, s = order distance from the (size-adjusted) midpoint in cents. */
export function orderScore(maxSpreadCents: number, spreadCents: number, b = 1): number {
  if (!(maxSpreadCents > 0) || spreadCents < 0 || spreadCents >= maxSpreadCents) return 0;
  const r = (maxSpreadCents - spreadCents) / maxSpreadCents;
  return r * r * b;
}

/**
 * Two-sided rule. Midpoint in [0.10, 0.90]: max(min(Qone, Qtwo), max(Qone / c, Qtwo / c)),
 * so single-sided liquidity still scores at 1/c. Outside that range: min(Qone, Qtwo), so it must be two-sided.
 */
export function qMin(qOne: number, qTwo: number, midpoint: number, c = REWARD_C): number {
  if (midpoint >= 0.1 && midpoint <= 0.9) return Math.max(Math.min(qOne, qTwo), Math.max(qOne / c, qTwo / c));
  return Math.min(qOne, qTwo);
}
