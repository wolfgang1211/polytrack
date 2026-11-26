/* Kalshi LP opportunity cards — the same shape, score weights and risk rules as the Polymarket cards
   (src/app/api/liquidity/opportunities/route.ts), built from Kalshi reward-program candidates plus their live
   order books. Kalshi publishes volume in contracts, so 24h volume here is contracts × mid (labelled est.). */
import type { LPOpportunity } from '@/app/api/liquidity/opportunities/route';
import type { KalshiOrderbook } from '@/lib/kalshi';
import { dollarVolume, DEFAULT_CAPITAL, type KalshiRewardFarm } from '@/lib/kalshiRewards';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** $ resting within 5¢ of the best price on each side (asks are implied from No bids), like the Polymarket card. */
export function depthWithin5c(book: KalshiOrderbook): { bestBid: number; bestAsk: number; bidDepth: number; askDepth: number } | null {
  if (book.bestYesBid == null || book.bestYesAsk == null) return null;
  const bestBid = book.bestYesBid, bestAsk = book.bestYesAsk;
  const bidDepth = book.yesBids.reduce((s, l) => (bestBid - l.price <= 0.05 + 1e-9 ? s + l.price * l.size : s), 0);
  const askDepth = book.yesAsks.reduce((s, l) => (l.price - bestAsk <= 0.05 + 1e-9 ? s + l.price * l.size : s), 0);
  return { bestBid, bestAsk, bidDepth, askDepth };
}

export function buildKalshiOpportunity(f: KalshiRewardFarm, book: KalshiOrderbook | null): LPOpportunity {
  const d = book ? depthWithin5c(book) : null;
  const bestBid = d?.bestBid ?? f.yesBid;
  const bestAsk = d?.bestAsk ?? f.yesAsk;
  const spread = Math.max(0, bestAsk - bestBid);
  const mid = (bestBid + bestAsk) / 2 || 0.5;
  const spreadPct = clamp01(mid > 0 ? spread / mid : 0);
  const vol24h = dollarVolume(f);
  // Kalshi has no single "liquidity" figure: use the $ depth within 5¢ (or the top of book without a book).
  const liquidity = d ? d.bidDepth + d.askDepth : f.liquidity;
  const poolShare = DEFAULT_CAPITAL / (liquidity + DEFAULT_CAPITAL || DEFAULT_CAPITAL);
  const estDailyFee = poolShare * vol24h * spread * 0.5;

  const daysToResolve = f.daysToResolve;
  const spreadVol = f.priceVol;
  let riskPts = 0;
  if (daysToResolve != null) { if (daysToResolve < 5) riskPts += 3; else if (daysToResolve < 14) riskPts += 1; }
  if (spreadVol > 30) riskPts += 2; else if (spreadVol > 10) riskPts += 1;
  const risk: LPOpportunity['risk'] = riskPts >= 3 ? 'High' : riskPts >= 1 ? 'Medium' : 'Low';

  const rewardsPts = Math.round(25 * Math.min(1, f.dailyRate / 100));
  const volumePts = Math.round(20 * Math.min(1, Math.log10(Math.max(1, vol24h)) / 7));
  const spreadPts = Math.round(15 * Math.min(1, spread / 0.05));
  const stabilityPts = Math.round(15 * (1 - Math.min(1, spreadVol / 30)));
  const horizonPts = Math.round(15 * (daysToResolve == null ? 1 : Math.min(1, daysToResolve / 30)));
  const balancePts = Math.round(10 * (1 - Math.min(1, Math.abs(mid - 0.5) * 2)));

  return {
    conditionId: f.ticker,
    question: f.question,
    slug: f.ticker,
    volume24h: vol24h,
    liquidity,
    tokenId: f.ticker,
    bestBid, bestAsk, mid, spread, spreadPct,
    bidDepth: d ? d.bidDepth : null,
    askDepth: d ? d.askDepth : null,
    depthKnown: d != null,
    estDailyFee,
    score: rewardsPts + volumePts + spreadPts + stabilityPts + horizonPts + balancePts,
    scoreBreakdown: { rewards: rewardsPts, volume: volumePts, spread: spreadPts, stability: stabilityPts, horizon: horizonPts, balance: balancePts },
    endDate: f.endDate ?? undefined,
    daysToResolve,
    spreadVol,
    risk,
    hasRewards: f.dailyRate > 0,
    rewardsDailyRate: f.dailyRate,
    rewardsMinSize: f.targetSize,
    rewardsMaxSpread: null,
    estDailyReward: f.estDailyReward,
  };
}
