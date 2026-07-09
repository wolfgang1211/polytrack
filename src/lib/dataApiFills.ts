/* Recent maker fills via Polymarket data-api (LH-C.1).
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
 */

const BASE = 'https://data-api.polymarket.com/trades';
const PAGE = 500;          // data-api max page size
const MAX_PAGES = 10;      // per role — 5 000 fills per role per window
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

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

/** Page one role newest-first until the window start (or page budget) is hit. */
async function fetchSince(
  user: string,
  takerOnly: boolean,
  sinceTsSec: number,
): Promise<RawTrade[] | null> {
  const out: RawTrade[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await fetchTradePage(user, takerOnly, page * PAGE);
    if (batch === null) return out.length ? out : null; // partial beats nothing
    for (const t of batch) {
      if (Number(t.timestamp) >= sinceTsSec) out.push(t);
    }
    const oldest = batch.length ? Number(batch[batch.length - 1].timestamp) : 0;
    if (batch.length < PAGE || oldest < sinceTsSec) break;
  }
  return out;
}

/**
 * Maker fills for a wallet since `sinceTsSec`, oldest first.
 * Returns null only if the data-api was unreachable for the primary fetch.
 */
export async function fetchRecentMakerFills(
  address: string,
  sinceTsSec: number,
): Promise<MakerFill[] | null> {
  const user = address.toLowerCase();

  const [all, takerRows] = await Promise.all([
    fetchSince(user, false, sinceTsSec),
    fetchSince(user, true, sinceTsSec),
  ]);
  if (all === null) return null;

  // Multiset of taker fills — decrement as we match so duplicate-looking
  // fills (same tx, asset, size, price) are only cancelled once each.
  const takerCount = new Map<string, number>();
  for (const t of takerRows ?? []) {
    const k = tradeKey(t);
    takerCount.set(k, (takerCount.get(k) ?? 0) + 1);
  }

  const fills: MakerFill[] = [];
  for (const t of all) {
    const k = tradeKey(t);
    const n = takerCount.get(k) ?? 0;
    if (n > 0) { takerCount.set(k, n - 1); continue; } // taker fill — skip
    if (!t.asset || !t.conditionId || !(t.size > 0)) continue;
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

  fills.sort((a, b) => a.ts - b.ts);
  return fills;
}
