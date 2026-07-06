/* Shared The Graph (Polymarket orderbook subgraph) fill fetching.
   Used by /api/wallet/[address]/timeline (full P&L replay, both roles) and
   /api/wallet/[address]/lp (maker-side spread earnings — LH-8). */

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'application/json',
};

export interface GraphFill {
  id: string;
  timestamp: string;
  side: string;        // 'Buy' | 'Sell' — from taker's perspective
  size: string;        // micro-shares (÷ 1e6)
  price: string;       // decimal 0-1
  market: { id: string };
  maker: { id: string };
  taker: { id: string };
}

export const SUBGRAPH_URL = (key: string) =>
  `https://gateway-arbitrum.network.thegraph.com/api/${key}/subgraphs/id/81Dm16JjuFSrqz813HysXoUPvzTwE7fsfPk2RTf66nyC`;

export const TAKER_QUERY = `
  query TakerFills($wallet: String!, $skip: Int!) {
    enrichedOrderFilleds(
      first: 1000
      skip: $skip
      where: { taker: $wallet }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id timestamp side size price
      market { id }
      maker { id }
      taker { id }
    }
  }
`;

export const MAKER_QUERY = `
  query MakerFills($wallet: String!, $skip: Int!) {
    enrichedOrderFilleds(
      first: 1000
      skip: $skip
      where: { maker: $wallet }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id timestamp side size price
      market { id }
      maker { id }
      taker { id }
    }
  }
`;

export async function fetchFillPage(
  url: string,
  query: string,
  wallet: string,
  skip: number,
): Promise<GraphFill[] | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': HEADERS['User-Agent'],
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables: { wallet, skip } }),
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (json?.errors?.length) continue;
      return (json?.data?.enrichedOrderFilleds ?? []) as GraphFill[];
    } catch {
      // Retry transient Graph/indexer/network failures.
    }
  }
  return null;
}

/** Paginate one role (taker or maker). Pages are fetched in small parallel
 * windows so high-volume wallets do not leave the UI stuck on a blank
 * loading skeleton for a long time. */
export async function fetchSide(
  url: string,
  wallet: string,
  asMaker: boolean,
): Promise<Array<GraphFill & { isTaker: boolean }>> {
  const query = asMaker ? MAKER_QUERY : TAKER_QUERY;
  const out: Array<GraphFill & { isTaker: boolean }> = [];
  const WINDOW = 8;

  for (let base = 0; base < 500; base += WINDOW) {
    const pages = await Promise.all(
      Array.from({ length: WINDOW }, (_, i) => fetchFillPage(url, query, wallet, (base + i) * 1000))
    );

    let shouldStop = false;
    for (const batch of pages) {
      if (batch === null) continue;
      for (const f of batch) out.push({ ...f, isTaker: !asMaker });
      if (batch.length < 1000) {
        shouldStop = true;
        break;
      }
    }
    if (shouldStop) break;
  }

  return out;
}

/** Fetch every fill for a wallet (both maker and taker roles), deduped by id. */
export async function fetchAllGraphFills(
  address: string,
  apiKey: string,
): Promise<Array<GraphFill & { isTaker: boolean }>> {
  const url = SUBGRAPH_URL(apiKey);
  const wallet = address.toLowerCase();

  // Both sides are independent — run concurrently; each paginates sequentially.
  const [takerFills, makerFills] = await Promise.all([
    fetchSide(url, wallet, false),
    fetchSide(url, wallet, true),
  ]);

  const seen = new Set<string>();
  const fills: Array<GraphFill & { isTaker: boolean }> = [];
  for (const f of [...takerFills, ...makerFills]) {
    if (!seen.has(f.id)) { seen.add(f.id); fills.push(f); }
  }
  return fills;
}

/** Fetch only the maker-side fills for a wallet (LP activity). */
export async function fetchMakerGraphFills(
  address: string,
  apiKey: string,
): Promise<GraphFill[]> {
  return fetchSide(SUBGRAPH_URL(apiKey), address.toLowerCase(), true);
}
