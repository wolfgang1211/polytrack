import { BUILDER_CODE } from './builder';

export const CLOB_BASE = 'https://clob.polymarket.com';

// ─── EIP-712 Order Types ──────────────────────────────────────────────────────

export interface ClobOrder {
  salt: string;
  maker: string;       // proxy wallet address
  signer: string;      // signing key address
  taker: string;       // "0x0000000000000000000000000000000000000000"
  tokenId: string;     // asset ID (condition token)
  makerAmount: string; // USDC amount, 6 decimals
  takerAmount: string; // outcome token amount
  expiration: string;  // unix timestamp or "0"
  nonce: string;
  feeRateBps: string;
  side: 'BUY' | 'SELL';
  signatureType: 0 | 1 | 2; // 0=EOA, 1=POLY_PROXY, 2=POLY_GNOSIS_SAFE
}

export type OrderType = 'FOK' | 'GTC' | 'GTD';

/**
 * POST /order payload — builder code her zaman dahil edilir
 */
export interface ClobOrderPayload {
  order: ClobOrder;
  signature: string;
  owner: string;
  orderType: OrderType;
  builderAddress: string; // PolyTrack builder code
}

/**
 * Verilen order ve signature ile POST /order gövdesini oluşturur.
 * builderAddress her zaman BUILDER_CODE olarak ayarlanır.
 */
export function buildOrderPayload(
  order: ClobOrder,
  signature: string,
  owner: string,
  orderType: OrderType = 'GTC'
): ClobOrderPayload {
  return {
    order,
    signature,
    owner,
    orderType,
    builderAddress: BUILDER_CODE,
  };
}

/**
 * CLOB API'ye order gönderir.
 * L2 auth header'ı (API key + secret ile imzalı) dışarıdan verilmelidir.
 */
export async function submitOrder(
  payload: ClobOrderPayload,
  authHeader: string
): Promise<unknown> {
  const res = await fetch(`${CLOB_BASE}/order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`CLOB order failed (${res.status}): ${err}`);
  }

  return res.json();
}

// ─── Read-only CLOB helpers ───────────────────────────────────────────────────

export interface OrderBook {
  market: string;
  asset_id: string;
  bids: { price: string; size: string }[];
  asks: { price: string; size: string }[];
  hash: string;
}

/** Belirli bir token için order book'u getirir */
export async function fetchOrderBook(tokenId: string): Promise<OrderBook> {
  const res = await fetch(`${CLOB_BASE}/book?token_id=${tokenId}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Order book fetch failed: ${res.status}`);
  return res.json();
}

/** Belirli bir token için son fiyatı getirir */
export async function fetchMidpoint(tokenId: string): Promise<number> {
  const res = await fetch(`${CLOB_BASE}/midpoint?token_id=${tokenId}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Midpoint fetch failed: ${res.status}`);
  const data: { mid: string } = await res.json();
  return parseFloat(data.mid);
}
