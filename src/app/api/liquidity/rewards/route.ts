import { NextResponse } from 'next/server';
import { rewardsOf } from '@/lib/rewards';

const G_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

/* Assumed LP capital for the per-market APR estimate (matches the simulator). */
const DEFAULT_CAPITAL = 1_000;

/* Reward pools attract competing makers fast — assume at least this much
   qualifying capital is (or will be) competing, so thin books don't show
   absurd ">999%" APRs that vanish the moment a bot shows up. */
const COMPETING_FLOOR = 10_000;

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
  minSize: number | null;         // min qualifying order size (shares)
  maxSpread: number | null;       // qualifying band around mid (¢)
  estDailyReward: number;         // $1K capital's est. share of the pool
  estApr: number;                 // est. annualised return on $1K (%)
  endDate?: string;
  daysToResolve: number | null;
  competition: 'Low' | 'Medium' | 'High'; // how crowded the pool is (rate vs liquidity)
}

function parseJson(s: string | undefined): string[] {
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

export async function GET() {
  try {
    // Scan a wide pool: top by liquidity AND top by 24h volume, deduped.
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

    const farms: RewardFarm[] = [];
    for (const m of all) {
      const rw = rewardsOf(m);
      if (rw.dailyRate <= 0) continue;
      if (!parseJson(m.clobTokenIds).length) continue;

      const liquidity = m.liquidityNum ?? Number(m.liquidity ?? 0);
      const volume24h = m.volume24hrNum ?? Number(m.volume24hr ?? 0);
      const spread = Math.max(0, Number(m.spread ?? 0)) || 0;

      // Share of the reward pool ≈ your capital vs. capital already competing
      // (floored — thin books won't stay thin once rewards are visible).
      const poolShare = DEFAULT_CAPITAL / (Math.max(liquidity, COMPETING_FLOOR) + DEFAULT_CAPITAL);
      const estDailyReward = poolShare * rw.dailyRate;
      const estApr = (estDailyReward * 365 / DEFAULT_CAPITAL) * 100;

      const endDate = m.endDate ?? m.endDateIso ?? undefined;
      const daysToResolve = endDate
        ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000))
        : null;

      // $ of reward per $ of resting liquidity — higher means less crowded.
      const ratePerLiq = liquidity > 0 ? rw.dailyRate / liquidity : 1;
      const competition: RewardFarm['competition'] =
        ratePerLiq >= 0.002 ? 'Low' : ratePerLiq >= 0.0005 ? 'Medium' : 'High';

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
      });
    }

    farms.sort((a, b) => b.estApr - a.estApr);

    const totalDailyRewards = farms.reduce((s, f) => s + f.dailyRate, 0);

    return NextResponse.json(
      { farms: farms.slice(0, 30), totalDailyRewards, marketsWithRewards: farms.length, scanned: all.length, updatedAt: Date.now() },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
