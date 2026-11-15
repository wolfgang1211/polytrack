import { NextResponse } from 'next/server';
import type { LeaderboardEntry, RecentTrade, TimeWindow } from '@/types';

const BASE = 'https://data-api.polymarket.com/v2/';
const WINDOWS: Record<TimeWindow, string> = { allTime: 'all', '1d': 'day', '1w': 'week', '1m': 'month' };
type Row = Record<string, unknown>;
export interface DataPage<T> { data: T[]; truncated: boolean; nextCursor: string | null }
export interface NormalizedTrade extends RecentTrade {
  proxyWallet: string;
  side: 'BUY' | 'SELL';
  asset: string;
  conditionId?: string;
  sourceConditionId: string;
  marketMetadataAvailable: boolean;
  transactionHash: string;
  size: number;
  price: number;
  usdcSize: number;
  timestamp: number;
}

export class PublicDataUnavailable extends Error {
  constructor(public readonly retryAfter?: string) {
    super('Market data is temporarily unavailable. Please try again.');
  }
}

export function dataFailure(error: unknown) {
  const retry = error instanceof PublicDataUnavailable ? error.retryAfter : undefined;
  return NextResponse.json({ error: 'Market data is temporarily unavailable. Please try again.' }, {
    status: retry ? 503 : 502,
    headers: { 'Cache-Control': 'no-store', ...(retry ? { 'Retry-After': retry } : {}) },
  });
}

export const NO_STORE = { 'Cache-Control': 'no-store' };
export function isWallet(value: unknown): value is string {
  return typeof value === 'string' && /^0x[\da-f]{40}$/i.test(value);
}
export function isWindow(value: string): value is TimeWindow { return Object.hasOwn(WINDOWS, value); }
export function record(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PublicDataUnavailable();
  return value as Row;
}
export function numeric(row: Row, key: string, nonnegative = false): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || (nonnegative && value < 0)) throw new PublicDataUnavailable();
  return value;
}
function text(row: Row, key: string): string { return typeof row[key] === 'string' ? row[key] as string : ''; }

// Fixed-origin internal reader. Never forward an upstream body, URL or diagnostics to clients.
export async function readDataJson(path: 'leaderboard' | 'trades' | 'activity' | 'user-pnl', params: URLSearchParams, signal?: AbortSignal): Promise<Row> {
  const url = new URL(path, BASE);
  url.search = params.toString();
  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': 'AlphaBoard/1.0' }, cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8_000)]) : AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      if ([408, 425, 429].includes(response.status)) {
        const raw = response.headers.get('retry-after');
        throw new PublicDataUnavailable(raw && /^\d{1,5}$/.test(raw) ? raw : '30');
      }
      throw new PublicDataUnavailable();
    }
    return record(await response.json());
  } catch (error) {
    if (error instanceof PublicDataUnavailable) throw error;
    throw new PublicDataUnavailable();
  }
}

export function parsePage<T>(body: Row, normalize: (row: unknown) => T): DataPage<T> {
  if (!Array.isArray(body.data) || body.data.length > 1000) throw new PublicDataUnavailable();
  const pagination = record(body.pagination);
  if (typeof pagination.has_more !== 'boolean') throw new PublicDataUnavailable();
  const cursor = pagination.next_cursor;
  if (pagination.has_more && (typeof cursor !== 'string' || !cursor.trim() || cursor.length > 16_384)) throw new PublicDataUnavailable();
  if (!pagination.has_more && cursor != null && cursor !== '') throw new PublicDataUnavailable();
  if (pagination.has_more && body.data.length === 0) throw new PublicDataUnavailable();
  return { data: body.data.map(normalize), truncated: pagination.has_more, nextCursor: pagination.has_more ? cursor as string : null };
}

function trader(value: unknown): LeaderboardEntry {
  const row = record(value);
  if (!isWallet(row.user_id) || typeof row.verified !== 'boolean') throw new PublicDataUnavailable();
  const rank = numeric(row, 'rank', true);
  if (!Number.isInteger(rank) || rank < 1) throw new PublicDataUnavailable();
  return {
    rank: String(rank), proxyWallet: row.user_id, userName: text(row, 'user_name'),
    xUsername: text(row, 'x_username'), verifiedBadge: row.verified,
    vol: numeric(row, 'volume', true), volumeUnit: 'shares', pnl: numeric(row, 'pnl'), profileImage: text(row, 'profile_image'),
  };
}

export function normalizeTrade(value: unknown): NormalizedTrade {
  const row = record(value);
  if (!isWallet(row.proxy_wallet) || !['BUY', 'SELL'].includes(row.side as string)
    || typeof row.token_id !== 'string' || !/^\d+$/.test(row.token_id)
    || typeof row.condition_id !== 'string' || !/^0x(?:[\da-f]{2}){1,32}$/i.test(row.condition_id)
    || typeof row.transaction_hash !== 'string' || !/^0x[\da-f]{64}$/i.test(row.transaction_hash)) throw new PublicDataUnavailable();
  const size = numeric(row, 'size', true);
  const price = numeric(row, 'price', true);
  const timestamp = numeric(row, 'timestamp', true);
  if (price > 1 || !Number.isSafeInteger(timestamp) || timestamp > Math.floor(Date.now() / 1000) + 60
    || !Number.isFinite(size * price)) throw new PublicDataUnavailable();
  // The live feed also carries short opaque condition metadata. Preserve it
  // exactly, but NEVER pad it or expose it as a validated on-chain CTF ID.
  // Financial fields have their own strict validation above. CTF consumers
  // must require conditionId and cannot use sourceConditionId for lookups.
  const marketMetadataAvailable = /^0x[\da-f]{64}$/i.test(row.condition_id);
  return {
    proxyWallet: row.proxy_wallet, side: row.side as 'BUY' | 'SELL', asset: row.token_id,
    conditionId: marketMetadataAvailable ? row.condition_id : undefined,
    sourceConditionId: row.condition_id, marketMetadataAvailable, transactionHash: row.transaction_hash,
    size, price, usdcSize: size * price, timestamp, title: text(row, 'title'), slug: text(row, 'slug'),
    eventSlug: text(row, 'event_slug'), icon: text(row, 'icon'), outcome: text(row, 'outcome'),
    outcomeIndex: typeof row.outcome_index === 'number' && Number.isInteger(row.outcome_index) ? row.outcome_index : undefined,
  };
}

export async function readLeaderboard(window: TimeWindow, limit: number, signal?: AbortSignal): Promise<DataPage<LeaderboardEntry>> {
  const params = new URLSearchParams({ time_period: WINDOWS[window], category: 'overall', sort_by: 'PNL', limit: String(limit) });
  return parsePage(await readDataJson('leaderboard', params, signal), trader);
}

export async function readTrades(params = new URLSearchParams({ limit: '500', taker_only: 'true' }), signal?: AbortSignal): Promise<DataPage<NormalizedTrade>> {
  return parsePage(await readDataJson('trades', params, signal), normalizeTrade);
}
