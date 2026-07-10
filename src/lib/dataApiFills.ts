/* Recent fills via Polymarket data-api (LH-C.1 / LH-D).
 *
 * The orderbook subgraph (graphFills.ts) stopped indexing around 2026-04-25,
 * so windowed queries ("last 7 days") return nothing for every wallet. The
 * public data-api is fresh and — with takerOnly=false — includes fills where
 * the queried wallet was the MAKER. The API doesn't label roles, so we fetch
 * the same window twice (all fills vs taker-only) and subtract: whatever is
 * in `all` but not in `taker` was a maker fill.
 *
 * Side semantics match the subgraph: `side` is the TAKER's direction, so for
 * maker rows the wallet's own direction is the inverse (taker BUY ⇒ maker
 * sold). Bonus over the subgraph: conditionId, title and outcome arrive with
 * each fill, so no gamma lookups are needed downstream.
 *
 * HARD LIMIT: data-api rejects offset > 3000 with HTTP 400 (no cursor or
 * timestamp param bypasses it — see the timeline route's Path 2 notes), so a
 * window can return at most ~3,500 fills per role. Results carry a
 * `truncated` flag when that ceiling cut the window short; callers should
 * surface it instead of silently presenting partial data as complete.
 */

import type { GraphFill } from '@/lib/graphFills';

const BASE = 'https://data-api.polymarket.com/trades';
const PAGE = 500;
const MAX_OFFSET = 3000;                     // offset > 3000 → HTTP 400
const MAX_PAGES = MAX_OFFSET / PAGE + 1;     // pages 0..6 → 3,500 rows/role
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

/** Rich maker-fill shape for consumers that want market metadata (LH-C). */
export interface MakerFill {
  tokenId: string;       // clob token id (data-api `asset`)
  conditionId: string;
  title: string | null;
  outcome: string | null;
  ts: number;            // unix seconds
  takerSide: 'BUY' | 'SELL';  // taker's direction — maker's is the inverse
  shares: number;
  price: number;         // 0-1
}

/** GraphFill-compatible shape so subgraph consumers (LP earnings, timeline)
 * can append a fresh data-api tail without changing their replay code. */
export type RecentFill = GraphFill & { isTaker: boolean };

interface RawTrade {
  proxyWallet: string;
  side: 'BUY' | 'SELL';
  asset: string;
  conditionId: string;
  size: number;
  price: number;
  timestamp: number;
  title?: string;
  outcome?: string;
  transactionHash?: string;
}

/** Identity key for the taker-set subtraction. A tx can carry several fills,
 * so include everything that distinguishes one fill from another. */
const tradeKey = (t: RawTrade) =>
  `${t.transactionHash ?? ''}|${t.asset}|${t.side}|${t.size}|${t.price}|${t.timestamp}`;

async function fetchTradePage(
  user: string,
  takerOnly: boolean,
  offset: number,
): Promise<RawTrade[] | null> {
  const url = `${BASE}?user=${user}&takerOnly=${takerOnly}&limit=${PAGE}&offset=${offset}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS, cache: 'no-store' });
      if (!res.ok) continue;
      const json = await res.json();
      if (Array.isArray(json)) return json as RawTrade[];
    } catch { /* retry transient failures */ }
  }
  return null;
}

interface PagedRows { rows: RawTrade[]; truncated: boolean }

/** Page one role newest-first until the window start — or the offset ceiling,
 * in which case `truncated` is set. */
async function fetchSince(
  user: string,
  takerOnly: boolean,
  sinceTsSec: number,
): Promise<PagedRows | null> {
  const rows: RawTrade[] = [];
  let complete = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await fetchTradePage(user, takerOnly, page * PAGE);
    if (batch === null) {
      if (rows.length === 0) return null;
      return { rows, truncated: true }; // partial beats nothing — but say so
    }
    for (const t of batch) {
      if (Number(t.timestamp) >= sinceTsSec) rows.push(t);
    }
    const oldest = batch.length ? Number(batch[batch.length - 1].timestamp) : 0;
    if (batch.length < PAGE || oldest < sinceTsSec) { complete = true; break; }
  }

  return { rows, truncated: !complete };
}

interface Classified { rows: Array<RawTrade & { isTaker: boolean }>; truncated: boolean }

/** Fetch both role views and label each fill maker/taker via subtraction. */
async function fetchClassified(user: string, sinceTsSec: number): Promise<Classified | null> {
  const [all, taker] = await Promise.all([
    fetchSince(user, false, sinceTsSec),
    fetchSince(user, true, sinceTsSec),
  ]);
  if (all === null) return null;

  // Multiset of taker fills — decrement as we match so duplicate-looking
  // fills (same tx, asset, size, price) are only cancelled once each.
  const takerCount = new Map<string, number>();
  for (const t of taker?.rows ?? []) {
    const k = tradeKey(t);
    takerCount.set(k, (takerCount.get(k) ?? 0) + 1);
  }

  const rows: Array<RawTrade & { isTaker: boolean }> = [];
  for (const t of all.rows) {
    if (!t.asset || !(t.size > 0)) continue;
    const k = tradeKey(t);
    const n = takerCount.get(k) ?? 0;
    if (n > 0) takerCount.set(k, n - 1);
    rows.push({ ...t, isTaker: n > 0 });
  }

  rows.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  return { rows, truncated: all.truncated || (taker?.truncated ?? false) };
}

/**
 * Maker fills for a wallet since `sinceTsSec`, oldest first, with market
 * metadata. Returns null only if the data-api was unreachable.
 */
export async function fetchRecentMakerFills(
  address: string,
  sinceTsSec: number,
): Promise<{ fills: MakerFill[]; truncated: boolean } | null> {
  const res = await fetchClassified(address.toLowerCase(), sinceTsSec);
  if (res === null) return null;

  const fills: MakerFill[] = [];
  for (const t of res.rows) {
    if (t.isTaker || !t.conditionId) continue;
    fills.push({
      tokenId: String(t.asset),
      conditionId: String(t.conditionId),
      title: typeof t.title === 'string' ? t.title : null,
      outcome: typeof t.outcome === 'string' ? t.outcome : null,
      ts: Number(t.timestamp),
      takerSide: t.side === 'BUY' ? 'BUY' : 'SELL',
      shares: Number(t.size),
      price: Number(t.price),
    });
  }
  return { fills, truncated: res.truncated };
}

/**
 * Both-role fills since `sinceTsSec` in the subgraph's GraphFill shape, so
 * they can be concatenated onto stale subgraph history before a replay.
 * `side` stays taker-perspective for maker rows — same convention as the
 * subgraph — and `isTaker` marks the wallet's role.
 */
export async function fetchRecentFills(
  address: string,
  sinceTsSec: number,
): Promise<{ fills: RecentFill[]; truncated: boolean } | null> {
  const user = address.toLowerCase();
  const res = await fetchClassified(user, sinceTsSec);
  if (res === null) return null;

  const fills: RecentFill[] = res.rows.map((t, i) => ({
    id: `dapi-${t.transactionHash ?? i}-${t.asset}-${i}`,
    timestamp: String(t.timestamp),
    side: t.side === 'BUY' ? 'Buy' : 'Sell',
    size: String(Math.round(Number(t.size) * 1e6)),
    price: String(t.price),
    market: { id: String(t.asset) },
    maker: { id: t.isTaker ? '' : user },
    taker: { id: t.isTaker ? user : '' },
    isTaker: t.isTaker,
  }));
  return { fills, truncated: res.truncated };
}
