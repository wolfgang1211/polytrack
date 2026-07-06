/* Polymarket liquidity-rewards helpers — parse the real reward-program
   fields gamma attaches to markets (clobRewards / rewardsMinSize /
   rewardsMaxSpread) and scan the market universe for active farms.
   Used by the Liquidity Hub APIs and the snapshot recorder. */

const G_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

const DEFAULT_CAPITAL = 1_000;
const COMPETING_FLOOR = 10_000;

export interface MarketRewards {
  dailyRate: number;            // USD paid out per day to makers
  minSize: number | null;       // min qualifying order size (shares)
  maxSpread: number | null;     // max distance from mid to qualify (¢)
  start: string | null;         // earliest active pool start (ISO)
  end: string | null;           // latest active pool end (ISO)
}

export interface RewardFarm {
  conditionId: string;
  question: string;
  slug: string;
  eventSlug?: string;
  image?: string;
  volume24h: number;
  liquidity: number;
  spread: number;                 // fraction (e.g. 0.02 = 2¢)
  dailyRate: number;              // USD/day reward pool (real program data)
  minSize: number | null;
  maxSpread: number | null;
  estDailyReward: number;         // $1K capital's est. share of the pool
  estApr: number;                 // est. annualised return on $1K (%)
  endDate?: string;
  daysToResolve: number | null;
  competition: 'Low' | 'Medium' | 'High';
  /* Calendar + risk layer */
  rewardStart: string | null;
  rewardEnd: string | null;
  isNew: boolean;                 // pool started within the last 7 days
  endsSoon: boolean;              // pool (or market) ends within 7 days
  priceVol: number;               // 24h |price move| relative to mid (%)
  stability: 'A' | 'B' | 'C' | 'D';
  riskAdjApr: number;             // APR discounted by price instability
}

/* Match-type markets (single games, O/U, spreads, exact scores…) resolve in
   hours and get run over by in-play moves — structurally bad LP inventory,
   whatever the sport. Season-long futures are allowed through. */
const MATCH_PATTERNS =
  /\bvs\.?\s|\bO\/U\b|over\/under|^spread:|exact score|halftime|half time|both teams to score|total (?:corners|rounds|goals|points)|team to advance|win on \d{4}-\d{2}-\d{2}|\bmap \d|\(bo\d\)|end in a draw|leading at|rescheduled/i;
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
  let start: string | null = null;
  let end: string | null = null;
  const now = Date.now();
  if (Array.isArray(m?.clobRewards)) {
    for (const r of m.clobRewards) {
      const rate = Number(r?.rewardsDailyRate ?? r?.rewards_daily_rate ?? 0) || 0;
      const s = r?.startDate ? new Date(r.startDate).getTime() : null;
      const e = r?.endDate ? new Date(r.endDate).getTime() : null;
      const active = (s == null || isNaN(s) || s <= now)
        && (e == null || isNaN(e) || e >= now - 86_400_000);
      if (active) {
        dailyRate += rate;
        if (s != null && !isNaN(s) && (start == null || s < new Date(start).getTime())) start = String(r.startDate);
        if (e != null && !isNaN(e) && (end == null || e > new Date(end).getTime())) end = String(r.endDate);
      }
    }
  }
  const minSizeRaw = m?.rewardsMinSize != null ? Number(m.rewardsMinSize) : NaN;
  const maxSpreadRaw = m?.rewardsMaxSpread != null ? Number(m.rewardsMaxSpread) : NaN;
  return {
    dailyRate,
    minSize: Number.isFinite(minSizeRaw) && minSizeRaw > 0 ? minSizeRaw : null,
    maxSpread: Number.isFinite(maxSpreadRaw) && maxSpreadRaw > 0 ? maxSpreadRaw : null,
    start,
    end,
  };
}

function parseJsonArr(s: string | undefined): string[] {
  try { return JSON.parse(s ?? '[]'); } catch { return []; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchGamma(order: string, limit: number): Promise<any[]> {
  const res = await fetch(
    `https://gamma-api.polymarket.com/markets?active=true&closed=false&order=${order}&ascending=false&limit=${limit}`,
    { headers: G_HEADERS, next: { revalidate: 300 } }
  );
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json) ? json : (json.markets ?? json.value ?? []);
}

/* Scan the market universe for LP-suitable reward farms. */
export async function scanRewardFarms(): Promise<{ farms: RewardFarm[]; scanned: number }> {
  const [byLiq, byVol] = await Promise.all([
    fetchGamma('liquidity', 200),
    fetchGamma('volume24hr', 200),
  ]);
  const seen = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = [];
  for (const m of [...byLiq, ...byVol]) {
    const id = String(m?.conditionId ?? m?.id ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    all.push(m);
  }

  const now = Date.now();
  const farms: RewardFarm[] = [];
  for (const m of all) {
    const rw = rewardsOf(m);
    if (rw.dailyRate <= 0) continue;
    if (!parseJsonArr(m.clobTokenIds).length) continue;
    // LP-suitability: skip match-type markets and anything resolving < 3 days out.
    if (isMatchMarket(m)) continue;
    const endRaw = m.endDate ?? m.endDateIso;
    if (endRaw) {
      const t = new Date(endRaw).getTime();
      if (!isNaN(t) && t - now < 3 * 86_400_000) continue;
    }

    const liquidity = m.liquidityNum ?? Number(m.liquidity ?? 0);
    const volume24h = m.volume24hrNum ?? Number(m.volume24hr ?? 0);
    const spread = Math.max(0, Number(m.spread ?? 0)) || 0;

    const poolShare = DEFAULT_CAPITAL / (Math.max(liquidity, COMPETING_FLOOR) + DEFAULT_CAPITAL);
    const estDailyReward = poolShare * rw.dailyRate;
    const estApr = (estDailyReward * 365 / DEFAULT_CAPITAL) * 100;

    const endDate = endRaw ?? undefined;
    const daysToResolve = endDate
      ? Math.max(0, Math.ceil((new Date(endDate).getTime() - now) / 86_400_000))
      : null;

    const ratePerLiq = liquidity > 0 ? rw.dailyRate / liquidity : 1;
    const competition: RewardFarm['competition'] =
      ratePerLiq >= 0.002 ? 'Low' : ratePerLiq >= 0.0005 ? 'Medium' : 'High';

    // Price stability — 24h move relative to mid.
    const prices = parseJsonArr(m.outcomePrices);
    const mid = Math.min(1, Math.max(0, Number(m.lastTradePrice ?? (prices.length ? prices[0] : 0.5)) || 0.5));
    const odc = Math.abs(Number(m.oneDayPriceChange ?? 0));
    const priceVol = mid > 0 ? Math.min(100, (odc / mid) * 100) : 0;
    const stability: RewardFarm['stability'] =
      priceVol < 2 ? 'A' : priceVol < 5 ? 'B' : priceVol < 12 ? 'C' : 'D';
    const stabilityWeight = { A: 1, B: 0.85, C: 0.6, D: 0.3 }[stability];
    const riskAdjApr = estApr * stabilityWeight;

    // Calendar flags.
    const startT = rw.start ? new Date(rw.start).getTime() : NaN;
    const rewardEndT = rw.end ? new Date(rw.end).getTime() : NaN;
    const marketEndT = endDate ? new Date(endDate).getTime() : NaN;
    const isNew = !isNaN(startT) && now - startT < 7 * 86_400_000;
    const endsSoon =
      (!isNaN(rewardEndT) && rewardEndT - now < 7 * 86_400_000) ||
      (!isNaN(marketEndT) && marketEndT - now < 7 * 86_400_000);

    const eventSlug = m.eventSlug
      ?? (Array.isArray(m.events) && m.events[0] ? m.events[0].slug : undefined);

    farms.push({
      conditionId: String(m.conditionId ?? m.id ?? ''),
      question: m.question ?? 'Unknown',
      slug: m.slug ?? '',
      eventSlug,
      image: m.image,
      volume24h,
      liquidity,
      spread,
      dailyRate: rw.dailyRate,
      minSize: rw.minSize,
      maxSpread: rw.maxSpread,
      estDailyReward,
      estApr,
      endDate,
      daysToResolve,
      competition,
      rewardStart: rw.start,
      rewardEnd: rw.end,
      isNew,
      endsSoon,
      priceVol,
      stability,
      riskAdjApr,
    });
  }

  // Default order: risk-adjusted APR — juicy AND holdable.
  farms.sort((a, b) => b.riskAdjApr - a.riskAdjApr);
  return { farms, scanned: all.length };
}
