import { NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

const TOP_WALLETS = 12;       // how many leaderboard wallets to scan
const WC_PATTERN = /world cup|fifa/i;

type Obj = Record<string, unknown>;

function isWcPosition(p: Obj): boolean {
  if (typeof p.eventSlug === 'string' && (p.eventSlug as string).startsWith('fifwc')) return true;
  if (typeof p.title === 'string' && WC_PATTERN.test(p.title as string)) return true;
  if (typeof p.eventSlug === 'string' && WC_PATTERN.test(p.eventSlug as string)) return true;
  return false;
}

export async function GET() {
  try {
    // 1. Monthly top traders (most relevant "pros" right now)
    const lbRes = await fetch(
      'https://data-api.polymarket.com/v1/leaderboard?timePeriod=MONTH&limit=' + TOP_WALLETS,
      { headers: HEADERS, cache: 'no-store' }
    );
    if (!lbRes.ok) return NextResponse.json({ error: `Leaderboard HTTP ${lbRes.status}` }, { status: lbRes.status });
    const lbJson = await lbRes.json();
    const traders: Obj[] = (Array.isArray(lbJson) ? lbJson : (lbJson.value ?? []))
      .filter((t: Obj) => typeof t.proxyWallet === 'string')
      .slice(0, TOP_WALLETS);

    // 2. Their open positions, in parallel (open positions only: sizeThreshold default)
    const positionLists = await Promise.all(
      traders.map(t =>
        fetch(`https://data-api.polymarket.com/positions?user=${t.proxyWallet}&limit=300`, { headers: HEADERS })
          .then(r => (r.ok ? r.json() : []))
          .then((j): Obj[] => (Array.isArray(j) ? j : (j.value ?? [])))
          .catch((): Obj[] => [])
      )
    );

    // 3. Aggregate World Cup positions per (title, outcome)
    interface Agg {
      title: string;
      outcome: string;
      eventSlug?: string;
      slug?: string;
      icon?: string;
      totalValue: number;
      wallets: { address: string; name?: string; value: number }[];
    }
    const byKey = new Map<string, Agg>();

    traders.forEach((trader, i) => {
      const wcPositions = positionLists[i].filter(isWcPosition);
      for (const p of wcPositions) {
        const value = Number(p.currentValue ?? 0);
        if (!(value >= 50)) continue; // ignore dust
        const title = String(p.title ?? '');
        const outcome = String(p.outcome ?? '');
        const key = `${title}::${outcome}`;
        let agg = byKey.get(key);
        if (!agg) {
          agg = {
            title, outcome,
            eventSlug: p.eventSlug as string | undefined,
            slug: p.slug as string | undefined,
            icon: (p.icon ?? p.image) as string | undefined,
            totalValue: 0,
            wallets: [],
          };
          byKey.set(key, agg);
        }
        agg.totalValue += value;
        agg.wallets.push({
          address: String(trader.proxyWallet),
          name: (trader.userName ?? trader.name ?? trader.pseudonym) as string | undefined,
          value,
        });
      }
    });

    const picks = [...byKey.values()]
      .map(a => ({ ...a, wallets: a.wallets.sort((x, y) => y.value - x.value).slice(0, 5), proCount: a.wallets.length }))
      .sort((a, b) => b.proCount - a.proCount || b.totalValue - a.totalValue)
      .slice(0, 25);

    return NextResponse.json(
      { scanned: traders.length, picks },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to fetch pro positions' }, { status: 500 });
  }
}
