/* Shared World Cup data fetchers — used by both the API routes (no-store)
   and the /worldcup server page (ISR) so the page ships with data in the HTML. */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

const WINNER_EVENT_SLUG = 'world-cup-winner';

export interface WcTeamRow {
  team: string;
  price: number;
  change24h: number;
  volume24hr: number;
  volume: number;
  image?: string;
  slug?: string;
  clobTokenYes?: string;
}

export interface WcWinner {
  event: { title: string; slug: string; volume: number; volume24hr: number; liquidity: number; endDate?: string };
  teams: WcTeamRow[];
}

export interface WcMarketRow {
  question?: string;
  groupItemTitle?: string;
  outcomes?: string;
  outcomePrices?: string;
  volume24hr: number;
  gameStartTime: string | null;
  slug?: string;
  closed: boolean;
  oneDayPriceChange: number;
  lastTradePrice: number | null;
}

export interface WcEventRow {
  id: string;
  title: string;
  slug: string;
  image?: string;
  volume24hr: number;
  volume: number;
  liquidity: number;
  endDate?: string;
  gameStartTime: string | null;
  isMatch: boolean;
  markets: WcMarketRow[];
}

function parseJsonArr(s: unknown): string[] {
  if (typeof s !== 'string') return [];
  try { return JSON.parse(s); } catch { return []; }
}

/** revalidate == null → no-store (API routes); number → ISR cache (server page). */
function fetchInit(revalidate?: number): RequestInit {
  return revalidate == null
    ? { headers: HEADERS, cache: 'no-store' }
    : ({ headers: HEADERS, next: { revalidate } } as RequestInit);
}

type Obj = Record<string, unknown>;

export async function fetchWinnerData(revalidate?: number): Promise<WcWinner | null> {
  try {
    const res = await fetch(
      `https://gamma-api.polymarket.com/events?slug=${WINNER_EVENT_SLUG}`,
      fetchInit(revalidate)
    );
    if (!res.ok) return null;

    const json = await res.json();
    const event = Array.isArray(json) ? json[0] : json;
    if (!event) return null;

    const rawMarkets: Obj[] = Array.isArray(event.markets) ? event.markets : [];

    const teams: WcTeamRow[] = rawMarkets
      .filter(m => m.closed !== true)
      .map(m => {
        const prices = parseJsonArr(m.outcomePrices);
        const yes = parseFloat(prices[0] ?? '');
        const clobTokens = parseJsonArr(m.clobTokenIds);
        return {
          clobTokenYes: clobTokens[0],
          team: (m.groupItemTitle as string) || String(m.question ?? '').replace(/^Will\s+/i, '').replace(/\s+win.*$/i, ''),
          price: isNaN(yes) ? 0 : yes,
          change24h: m.oneDayPriceChange != null ? Number(m.oneDayPriceChange) : 0,
          volume24hr: m.volume24hr != null ? Number(m.volume24hr) : 0,
          volume: m.volumeNum != null ? Number(m.volumeNum) : (m.volume != null ? Number(m.volume) : 0),
          image: (m.image ?? m.icon) as string | undefined,
          slug: m.slug as string | undefined,
        };
      })
      .sort((a, b) => b.price - a.price);

    return {
      event: {
        title: String(event.title ?? ''),
        slug: String(event.slug ?? ''),
        volume: event.volume != null ? Number(event.volume) : 0,
        volume24hr: event.volume24hr != null ? Number(event.volume24hr) : 0,
        liquidity: event.liquidity != null ? Number(event.liquidity) : 0,
        endDate: event.endDate as string | undefined,
      },
      teams,
    };
  } catch {
    return null;
  }
}

function slimMarket(m: Obj): WcMarketRow {
  return {
    question: m.question as string | undefined,
    groupItemTitle: m.groupItemTitle as string | undefined,
    outcomes: m.outcomes as string | undefined,
    outcomePrices: m.outcomePrices as string | undefined,
    volume24hr: m.volume24hr != null ? Number(m.volume24hr) : 0,
    gameStartTime: (m.gameStartTime as string | null) ?? null,
    slug: m.slug as string | undefined,
    closed: m.closed === true,
    oneDayPriceChange: m.oneDayPriceChange != null ? Number(m.oneDayPriceChange) : 0,
    lastTradePrice: m.lastTradePrice != null ? Number(m.lastTradePrice) : null,
  };
}

export async function fetchWcEvents(revalidate?: number): Promise<WcEventRow[]> {
  try {
    const res = await fetch(
      'https://gamma-api.polymarket.com/events?tag_slug=fifa-world-cup&closed=false&active=true&order=volume24hr&ascending=false&limit=100',
      fetchInit(revalidate)
    );
    if (!res.ok) return [];

    const json = await res.json();
    const raw: Obj[] = Array.isArray(json) ? json : (json.value ?? []);

    return raw
      .filter(e => e.slug !== WINNER_EVENT_SLUG)
      .map(e => {
        const markets = (Array.isArray(e.markets) ? (e.markets as Obj[]) : [])
          .filter(m => m.closed !== true)
          .map(slimMarket);
        const gameStartTime = markets.find(m => m.gameStartTime)?.gameStartTime ?? null;
        return {
          id: String(e.id ?? ''),
          title: String(e.title ?? ''),
          slug: String(e.slug ?? ''),
          image: (e.image ?? e.icon) as string | undefined,
          volume24hr: e.volume24hr != null ? Number(e.volume24hr) : 0,
          volume: e.volume != null ? Number(e.volume) : 0,
          liquidity: e.liquidity != null ? Number(e.liquidity) : 0,
          endDate: e.endDate as string | undefined,
          gameStartTime,
          isMatch: typeof e.title === 'string' && / vs\.? /i.test(e.title as string),
          markets,
        };
      })
      .filter(e => e.markets.length > 0);
  } catch {
    return [];
  }
}
