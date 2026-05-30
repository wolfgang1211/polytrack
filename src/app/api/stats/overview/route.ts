import { NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

const CATEGORY_PATTERNS: [string, RegExp][] = [
  ['Crypto',        /bitcoin|btc|eth(?:ereum)?|crypto|solana|sol\b|doge|token|defi|nft|web3|blockchain|binance|xrp|avax|chainlink/i],
  ['Politics',      /trump|biden|harris|election|president|congress|senate|democrat|republican|ballot|vote|minister|parliament|white\s*house/i],
  ['Sports',        /nfl|nba|nhl|mlb|soccer|football|basketball|baseball|tennis|golf|champion(?:ship)?|super\s*bowl|world\s*cup|league|playoff|ufc|boxing|olympics/i],
  ['Entertainment', /oscar|grammy|emmy|movie|film|show|tv\b|music|celebrity|award|actor|actress|netflix|album|spotify/i],
  ['Tech',          /\bai\b|gpt|openai|spacex|nasa|apple|google|microsoft|meta\b|amazon|tesla|nvidia|startup|ipo/i],
  ['World',         /war|conflict|ceasefire|sanction|russia|ukraine|israel|china|taiwan|climate|hurricane|earthquake/i],
];

function detectCat(title: string): string {
  for (const [cat, re] of CATEGORY_PATTERNS) {
    if (re.test(title)) return cat;
  }
  return 'Other';
}

export interface OverviewStats {
  activeMarkets: number;
  volume24h: number;
  trades1h: number;
  topCategory: string;
  topCategoryCount: number;
}

export async function GET() {
  const since1h = Math.floor(Date.now() / 1000) - 3_600;

  const [marketsRes, tradesRes] = await Promise.allSettled([
    fetch(
      'https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume24hr&ascending=false&limit=200',
      { headers: HEADERS, next: { revalidate: 120 } }
    ),
    fetch(
      'https://data-api.polymarket.com/trades?limit=500',
      { headers: HEADERS, cache: 'no-store' }
    ),
  ]);

  /* ── Markets ── */
  let activeMarkets = 0;
  let volume24h = 0;

  if (marketsRes.status === 'fulfilled' && marketsRes.value.ok) {
    const json = await marketsRes.value.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markets: any[] = Array.isArray(json) ? json : (json.value ?? json.markets ?? []);
    activeMarkets = markets.length;
    for (const m of markets) {
      const v = m.volume24hrNum ?? Number(m.volume24hr ?? 0);
      if (!isNaN(v)) volume24h += v;
    }
  }

  /* ── Trades ── */
  let trades1h = 0;
  let topCategory = 'Crypto';
  let topCategoryCount = 0;

  if (tradesRes.status === 'fulfilled' && tradesRes.value.ok) {
    const json = await tradesRes.value.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trades: any[] = Array.isArray(json) ? json : (json.value ?? json.data ?? []);

    const catMap: Record<string, number> = {};

    for (const t of trades) {
      const ts = Number(t.timestamp ?? 0);
      if (ts >= since1h) trades1h++;

      const cat = detectCat(t.title ?? '');
      catMap[cat] = (catMap[cat] ?? 0) + 1;
    }

    const top = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
    if (top) { topCategory = top[0]; topCategoryCount = top[1]; }
  }

  const stats: OverviewStats = { activeMarkets, volume24h, trades1h, topCategory, topCategoryCount };
  return NextResponse.json(stats, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}
