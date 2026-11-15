/* Recent fills via Polymarket data-api v2.
 *
 * v2 `side` is the queried wallet's own side. GraphFill/MakerFill retain their
 * historical taker-perspective side, so maker rows are inverted at this
 * boundary. Role inference is fail-closed: both complete same-window
 * snapshots are required and matched as an exact multiset.
 */
import type { GraphFill } from '@/lib/graphFills';
import { isWallet, normalizeTrade, parsePage, PublicDataUnavailable, readDataJson } from '@/lib/publicDataApi';

const MAX_PAGES = 20;
const PAGE = 1000;
const DEADLINE_MS = 10_000;
type WalletSide = 'BUY' | 'SELL';
interface RawTrade { proxyWallet: string; side: WalletSide; asset: string; conditionId: string; transactionHash: string; size: number; price: number; timestamp: number; title?: string; outcome?: string }

export interface MakerFill { tokenId: string; conditionId: string; title: string | null; outcome: string | null; ts: number; takerSide: WalletSide; shares: number; price: number }
export type RecentFill = GraphFill & { isTaker: boolean };
const inverse = (side: WalletSide): WalletSide => side === 'BUY' ? 'SELL' : 'BUY';

function rawTrade(value: unknown, wallet: string, since: number, end: number): RawTrade {
  const t = normalizeTrade(value);
  if (t.proxyWallet.toLowerCase() !== wallet || t.timestamp < since || t.timestamp > end) throw new PublicDataUnavailable();
  if (!t.conditionId || !t.transactionHash || !t.asset || !(t.size > 0)) throw new PublicDataUnavailable();
  return { proxyWallet: t.proxyWallet.toLowerCase(), side: t.side as WalletSide, asset: t.asset, conditionId: t.conditionId.toLowerCase(), transactionHash: t.transactionHash.toLowerCase(), size: t.size, price: t.price, timestamp: t.timestamp, title: t.title, outcome: t.outcome };
}
const key = (t: RawTrade) => [t.proxyWallet, t.conditionId, t.asset, t.transactionHash, t.side, t.size, t.price, t.timestamp].join('|');

function sameSnapshot(a: RawTrade[], b: RawTrade[]): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const row of a) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  for (const row of b) {
    const count = counts.get(key(row)) ?? 0;
    if (!count) return false;
    counts.set(key(row), count - 1);
  }
  return true;
}

async function fetchSince(wallet: string, since: number, end: number, takerOnly: boolean, signal: AbortSignal): Promise<RawTrade[]> {
  const rows: RawTrade[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    signal.throwIfAborted();
    // v2 treats filter_amount=0 as its 0.01-share default, NOT as disabled.
    // Request the on-chain micro-share quantum explicitly on BOTH snapshots.
    const params = new URLSearchParams({ user: wallet, start: String(since), end: String(end), taker_only: String(takerOnly), limit: String(PAGE), filter_type: 'TOKENS', filter_amount: '0.000001' });
    if (cursor !== null) params.set('cursor', cursor);
    const parsed = parsePage(await readDataJson('trades', params, signal), value => rawTrade(value, wallet, since, end));
    rows.push(...parsed.data);
    if (!parsed.truncated) return rows;
    if (!parsed.nextCursor || seen.has(parsed.nextCursor)) throw new PublicDataUnavailable();
    seen.add(parsed.nextCursor); cursor = parsed.nextCursor;
  }
  throw new PublicDataUnavailable();
}

async function fetchClassified(address: string, sinceTsSec: number): Promise<Array<RawTrade & { isTaker: boolean }>> {
  const wallet = address.toLowerCase();
  if (!isWallet(wallet) || !Number.isSafeInteger(sinceTsSec) || sinceTsSec < 1) throw new PublicDataUnavailable();
  const end = Math.floor(Date.now() / 1000);
  if (sinceTsSec > end) throw new PublicDataUnavailable();
  const signal = AbortSignal.timeout(DEADLINE_MS);
  const [all, taker] = await Promise.all([fetchSince(wallet, sinceTsSec, end, false, signal), fetchSince(wallet, sinceTsSec, end, true, signal)]);
  // These feeds have no atomic cross-role snapshot token. Reject observable
  // indexing changes in EITHER stream before inferring all-minus-taker roles.
  // Stability is a bounded consistency check, not on-chain role attestation.
  const [allAgain, takerAgain] = await Promise.all([fetchSince(wallet, sinceTsSec, end, false, signal), fetchSince(wallet, sinceTsSec, end, true, signal)]);
  if (!sameSnapshot(all, allAgain) || !sameSnapshot(taker, takerAgain)) throw new PublicDataUnavailable();
  const counts = new Map<string, number>();
  for (const row of taker) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  const rows: Array<RawTrade & { isTaker: boolean }> = [];
  for (const row of all) {
    const count = counts.get(key(row)) ?? 0;
    if (count > 0) counts.set(key(row), count - 1);
    rows.push({ ...row, isTaker: count > 0 });
  }
  if ([...counts.values()].some(count => count !== 0)) throw new PublicDataUnavailable();
  return rows.sort((a, b) => a.timestamp - b.timestamp);
}

export async function fetchRecentMakerFills(address: string, sinceTsSec: number): Promise<{ fills: MakerFill[]; truncated: boolean } | null> {
  try {
    const rows = await fetchClassified(address, sinceTsSec);
    return { truncated: false, fills: rows.filter(row => !row.isTaker).map(row => ({ tokenId: row.asset, conditionId: row.conditionId, title: row.title ?? null, outcome: row.outcome ?? null, ts: row.timestamp, takerSide: inverse(row.side), shares: row.size, price: row.price })) };
  } catch { return null; }
}

export async function fetchRecentFills(address: string, sinceTsSec: number): Promise<{ fills: RecentFill[]; truncated: boolean } | null> {
  try {
    const wallet = address.toLowerCase();
    const rows = await fetchClassified(wallet, sinceTsSec);
    return { truncated: false, fills: rows.map((row, i) => { const side = row.isTaker ? row.side : inverse(row.side); return { id: `dapi-${row.transactionHash}-${row.asset}-${i}`, timestamp: String(row.timestamp), side: side === 'BUY' ? 'Buy' : 'Sell', size: String(Math.round(row.size * 1e6)), price: String(row.price), market: { id: row.asset }, maker: { id: row.isTaker ? '' : wallet }, taker: { id: row.isTaker ? wallet : '' }, isTaker: row.isTaker }; }) };
  } catch { return null; }
}
