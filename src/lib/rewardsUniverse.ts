/* Every Polymarket market with an active liquidity-reward pool, from the CLOB rewards API,
   plus Gamma metadata for the markets we display. Fetch is injectable for tests. */

const CLOB_REWARDS = 'https://clob.polymarket.com/rewards/markets/current';
const GAMMA_MARKETS = 'https://gamma-api.polymarket.com/markets';
const END_CURSOR = 'LTE=';
const MAX_PAGES = 60; // 500 per page: room for 30,000 markets
const PAGE_TRIES = 3;
const PAGE_TIMEOUT_MS = 10_000;

type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface RewardMarket {
  conditionId: string;
  dailyRate: number;          // total_daily_rate (USD/day, includes sponsored rewards)
  maxSpread: number | null;   // cents
  minSize: number | null;     // shares
}

export interface RewardUniverse {
  markets: RewardMarket[];
  pages: number;
  /** false when a page still failed after retries: totals are then a lower bound. */
  complete: boolean;
}

export interface MarketMeta {
  question: string;
  slug: string;
  eventSlug?: string;
  endDate: string | null;
  /** Sports only: kick-off time. Polymarket's endDate for games is the kick-off, not the close. */
  gameStart: string | null;
  liquidity: number | null;
}

/** Gamma sends "2026-11-22 18:00:00+00"; returns ISO or null. */
function parseGameStart(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const t = new Date(v.trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

async function getJson(fetchFn: FetchLike, url: string): Promise<unknown> {
  let lastErr: unknown;
  for (let i = 0; i < PAGE_TRIES; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PAGE_TIMEOUT_MS);
    try {
      const res = await fetchFn(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
      if (res.ok) return await res.json();
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

/** Walks every page of the CLOB rewards list. Returns null if not even the first page loads. */
export async function fetchRewardUniverse(fetchFn: FetchLike = fetch as unknown as FetchLike): Promise<RewardUniverse | null> {
  const byId = new Map<string, RewardMarket>();
  let cursor = '';
  let pages = 0;
  let complete = true;
  while (pages < MAX_PAGES) {
    let body: { data?: unknown[]; next_cursor?: string } ;
    try {
      body = (await getJson(fetchFn, cursor ? `${CLOB_REWARDS}?next_cursor=${encodeURIComponent(cursor)}` : CLOB_REWARDS)) as typeof body;
    } catch {
      if (pages === 0) return null;
      complete = false;
      break;
    }
    pages++;
    const rows = Array.isArray(body?.data) ? body.data : [];
    for (const raw of rows) {
      const r = raw as Record<string, unknown>;
      const id = typeof r.condition_id === 'string' ? r.condition_id.toLowerCase() : '';
      const rate = num(r.total_daily_rate) ?? num(r.native_daily_rate);
      if (!id || rate === null) continue;
      const spread = num(r.rewards_max_spread);
      const size = num(r.rewards_min_size);
      byId.set(id, { conditionId: id, dailyRate: rate, maxSpread: spread !== null && spread > 0 ? spread : null, minSize: size !== null && size > 0 ? size : null });
    }
    const next = typeof body?.next_cursor === 'string' ? body.next_cursor : '';
    if (!rows.length || !next || next === END_CURSOR || next === cursor) break;
    cursor = next;
  }
  if (pages >= MAX_PAGES) complete = false;
  return { markets: [...byId.values()], pages, complete };
}

/** Gamma metadata for up to ~100 condition ids in one request; missing ids are simply absent. */
export async function fetchMarketMeta(conditionIds: string[], fetchFn: FetchLike = fetch as unknown as FetchLike): Promise<Map<string, MarketMeta>> {
  const out = new Map<string, MarketMeta>();
  if (!conditionIds.length) return out;
  const qs = conditionIds.map(id => `condition_ids=${encodeURIComponent(id)}`).join('&');
  let list: unknown;
  try {
    list = await getJson(fetchFn, `${GAMMA_MARKETS}?limit=${conditionIds.length}&${qs}`);
  } catch {
    return out;
  }
  for (const raw of Array.isArray(list) ? list : []) {
    const m = raw as Record<string, unknown>;
    const id = typeof m.conditionId === 'string' ? m.conditionId.toLowerCase() : '';
    if (!id) continue;
    const events = Array.isArray(m.events) ? (m.events as Array<Record<string, unknown>>) : [];
    const liq = num(m.liquidityNum) ?? num(m.liquidity);
    out.set(id, {
      question: typeof m.question === 'string' && m.question ? m.question : 'Untitled market',
      slug: typeof m.slug === 'string' ? m.slug : '',
      eventSlug: typeof m.eventSlug === 'string' ? m.eventSlug : typeof events[0]?.slug === 'string' ? (events[0].slug as string) : undefined,
      endDate: typeof m.endDate === 'string' ? m.endDate : typeof m.endDateIso === 'string' ? m.endDateIso : null,
      gameStart: parseGameStart(m.gameStartTime),
      liquidity: liq !== null && liq > 0 ? liq : null,
    });
  }
  return out;
}
