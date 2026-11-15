import type { Position, WalletData } from '@/types';

const BASE = 'https://data-api.polymarket.com/v2/';
const PAGE_SIZE = 500;
// Bound each lifecycle independently so a busy open book cannot starve history.
// Three lifecycle reads, up to 1,000 rows each; at most 3,000 before deduplication.
const PAGES_PER_STATUS = 2;
const STATUSES = ['OPEN', 'REDEEMABLE_LOST', 'CLOSED'] as const;
const POSITION_STATUSES = new Set(['OPEN', 'REDEEMABLE', 'REDEEMABLE_LOST', 'MERGEABLE', 'CLOSED']);

type RecordValue = Record<string, unknown>;

export class DataApiUnavailable extends Error {
  constructor(public readonly retryAfter?: string) {
    super('Wallet data is temporarily unavailable. Please try again.');
  }
}

function object(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DataApiUnavailable();
  return value as RecordValue;
}

function number(row: RecordValue, key: string, nonnegative = false): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || (nonnegative && value < 0)) {
    throw new DataApiUnavailable();
  }
  return value;
}

function text(row: RecordValue, key: string): string {
  return typeof row[key] === 'string' ? row[key] as string : '';
}

function flag(row: RecordValue, key: string): boolean {
  if (typeof row[key] !== 'boolean') throw new DataApiUnavailable();
  return row[key] as boolean;
}

function assertWallet(row: RecordValue, address: string) {
  if (typeof row.proxy_wallet !== 'string' || row.proxy_wallet.toLowerCase() !== address.toLowerCase()) {
    throw new DataApiUnavailable();
  }
}

function position(value: unknown, address: string): Position {
  const row = object(value);
  assertWallet(row, address);
  if (typeof row.token_id !== 'string' || !/^\d+$/.test(row.token_id)
    || typeof row.condition_id !== 'string' || !/^0x[\da-f]{64}$/i.test(row.condition_id)
    || typeof row.status !== 'string' || !POSITION_STATUSES.has(row.status)) {
    throw new DataApiUnavailable();
  }
  return {
    proxyWallet: row.proxy_wallet as string,
    asset: row.token_id,
    conditionId: row.condition_id,
    status: row.status as NonNullable<Position['status']>,
    size: number(row, 'current_size', true),
    avgPrice: number(row, 'avg_price', true),
    // v2 entry_cost_usdc is fee-exclusive; do not subtract entry_fees_usdc again.
    initialValue: number(row, 'entry_cost_usdc', true),
    currentValue: number(row, 'current_value', true),
    cashPnl: number(row, 'unrealized_pnl'),
    percentPnl: number(row, 'percent_pnl'),
    totalBought: number(row, 'total_size', true),
    realizedPnl: number(row, 'realized_pnl'),
    percentRealizedPnl: number(row, 'percent_realized_pnl'),
    curPrice: number(row, 'current_price', true),
    redeemable: flag(row, 'redeemable'),
    mergeable: flag(row, 'mergeable'),
    negativeRisk: flag(row, 'negative_risk'),
    title: text(row, 'title'),
    slug: text(row, 'slug'),
    icon: text(row, 'icon'),
    eventId: text(row, 'event_id'),
    eventSlug: text(row, 'event_slug'),
    outcome: text(row, 'outcome'),
    outcomeIndex: typeof row.outcome_index === 'number' && Number.isInteger(row.outcome_index)
      ? row.outcome_index : 999,
    oppositeOutcome: text(row, 'opposite_outcome'),
    oppositeAsset: text(row, 'opposite_token_id'),
    endDate: text(row, 'end_date') || undefined,
  };
}

async function read(path: string, params: URLSearchParams, signal: AbortSignal): Promise<RecordValue> {
  const url = new URL(path, BASE);
  url.search = params.toString();
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });
  } catch {
    throw new DataApiUnavailable();
  }
  if (!response.ok) {
    const retry = response.headers.get('Retry-After');
    throw new DataApiUnavailable(response.status === 429
      ? (retry && /^\d+$/.test(retry) ? String(Math.max(1, Math.min(300, Number(retry)))) : '60')
      : undefined);
  }
  try {
    return object(await response.json());
  } catch {
    throw new DataApiUnavailable();
  }
}

async function readPositions(address: string, status: typeof STATUSES[number], signal: AbortSignal) {
  const positions: Position[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  for (let i = 0; i < PAGES_PER_STATUS; i++) {
    const params = new URLSearchParams({
      user: address, status, limit: String(PAGE_SIZE),
      filter_type: 'TOKENS', filter_amount: '0',
    });
    if (status !== 'CLOSED') params.set('include_archived', 'true');
    if (cursor !== null) params.set('cursor', cursor);
    const body = await read('positions', params, signal);
    if (!Array.isArray(body.data) || body.data.length > PAGE_SIZE) throw new DataApiUnavailable();
    const paging = object(body.pagination);
    if (typeof paging.has_more !== 'boolean'
      || !(paging.next_cursor === null || (typeof paging.next_cursor === 'string' && paging.next_cursor.length > 0))
      || paging.has_more !== (paging.next_cursor !== null)) {
      throw new DataApiUnavailable();
    }
    for (const raw of body.data) {
      const item = position(raw, address);
      if ((status === 'CLOSED') !== (item.status === 'CLOSED')) throw new DataApiUnavailable();
      positions.push(item);
    }
    cursor = paging.next_cursor as string | null;
    if (cursor === null) return { positions, truncated: false };
    if (seenCursors.has(cursor)) throw new DataApiUnavailable();
    seenCursors.add(cursor);
  }
  return { positions, truncated: true };
}

async function readValue(address: string, signal: AbortSignal) {
  const body = await read('value', new URLSearchParams({ user: address }), signal);
  const data = object(body.data);
  assertWallet(data, address);
  return number(data, 'value', true);
}

export async function readWalletV2(address: string): Promise<WalletData> {
  // One deadline covers all streams and their continuation requests.
  const signal = AbortSignal.timeout(12_000);
  const [totalValue, ...streams] = await Promise.all([
    readValue(address, signal),
    ...STATUSES.map(status => readPositions(address, status, signal)),
  ] as const);
  const unique = new Map<string, Position>();
  for (const stream of streams) {
    for (const item of stream.positions) {
      const identity = `${item.conditionId.toLowerCase()}:${item.asset}`;
      if (!unique.has(identity)) unique.set(identity, item);
    }
  }
  return {
    positions: [...unique.values()],
    totalValue,
    truncated: streams.some(stream => stream.truncated),
  };
}
