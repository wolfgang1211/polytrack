import { NextResponse } from 'next/server';
import { dataFailure, NO_STORE, PublicDataUnavailable, readTrades, record } from '@/lib/publicDataApi';

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
  sampled: true;
  marketSampleLimit: number;
  tradeSampleSize: number;
  truncated: boolean;
}

export async function GET() {
  try {
    const since1h = Math.floor(Date.now() / 1000) - 3_600;
    const [response, tradePage] = await Promise.all([
      fetch('https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume24hr&ascending=false&limit=200', {
        headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(8_000),
      }),
      readTrades(),
    ]);
    if (!response.ok) throw new PublicDataUnavailable();
    const markets: unknown = await response.json();
    if (!Array.isArray(markets)) throw new PublicDataUnavailable();
    let volume24h = 0;
    for (const value of markets) {
      const market = record(value);
      const raw = market.volume24hrNum ?? market.volume24hr;
      // Gamma can legitimately omit 24h volume on a new market.
      const volume = raw == null ? 0 : typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
      if (!Number.isFinite(volume) || volume < 0) throw new PublicDataUnavailable();
      volume24h += volume;
    }
    const now = Math.floor(Date.now() / 1000);
    const inWindow = tradePage.data.filter(t => (t.timestamp ?? 0) >= since1h && (t.timestamp ?? 0) <= now);
    const categories = new Map<string, number>();
    for (const trade of inWindow) {
      const category = detectCat(trade.title ?? '');
      categories.set(category, (categories.get(category) ?? 0) + 1);
    }
    const top = [...categories].sort((a, b) => b[1] - a[1])[0];
    const stats: OverviewStats = {
      activeMarkets: markets.length, volume24h, trades1h: inWindow.length,
      topCategory: top?.[0] ?? 'No trades', topCategoryCount: top?.[1] ?? 0,
      sampled: true, marketSampleLimit: 200, tradeSampleSize: tradePage.data.length,
      truncated: tradePage.truncated || markets.length === 200,
    };
    return NextResponse.json(stats, { headers: NO_STORE });
  } catch (error) { return dataFailure(error); }
}
