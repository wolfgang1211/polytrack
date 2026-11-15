/*
 * Read-only Polymarket CTF Exchange V2 receipt verifier.
 * Provenance: https://docs.polymarket.com/resources/contracts and
 * https://github.com/Polymarket/ctf-exchange-v2/blob/main/src/exchange/mixins/Events.sol
 * Scope is deliberately Polygon mainnet / chain 137 and the two official V2
 * CTF exchange entry contracts. No RPC, wallet, or transaction side effects.
 */

export type VerificationStatus = 'supported' | 'unsupported';
export type Role = 'maker' | 'taker';
export type Side = 'BUY' | 'SELL';

export const POLYGON_CHAIN_ID = 137;
export const EXCHANGE_ADDRESSES = Object.freeze({
  ctf: '0xe111180000d2663c0091e4f400237545b87b996b',
  negRiskCtf: '0xe2222d279d744050d28e00520010520000310f59',
});

// keccak256 values are copied from the official Events.sol source.
export const EVENT_TOPICS = Object.freeze({
  orderFilled: '0xd543adfd945773f1a62f74f0ee55a5e3b9b1a28262980ba90b1a89f2ea84d8ee',
  ordersMatched: '0x174b3811690657c217184f89418266767c87e4805d09680c39fc9c031c0cab7c',
});

export interface ReceiptLog { address: string; topics: string[]; data: string; logIndex?: string | number; }
export interface ReceiptLike { transactionHash: string; status: string | number; blockNumber: string; blockHash: string; logs: ReceiptLog[]; }
export interface VerificationRequest { chainId: number; wallet: string; transactionHash: string; tokenId: string | bigint; side: Side; size: string | bigint; }
export interface VerificationResult {
  status: VerificationStatus;
  reason: string;
  chainId: number;
  exchange?: string;
  transactionHash?: string;
  blockNumber?: string;
  blockHash?: string;
  role?: Role;
  counterparty?: string;
  tokenId?: string;
  size?: string;
  side?: Side;
  matchedEventCount: number;
  rawEvent?: { address: string; topics: string[]; data: string; logIndex?: string | number };
}

const ZERO = BigInt(0);
const ONE = BigInt(1);
const unsupported = (reason: string, count = 0): VerificationResult => ({ status: 'unsupported', reason, chainId: POLYGON_CHAIN_ID, matchedEventCount: count });
const hex = (value: unknown): value is string => typeof value === 'string' && /^0x[0-9a-fA-F]*$/.test(value);
const address = (value: unknown): string | null => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value) ? value.toLowerCase() : null;
const bytes32 = (value: unknown): string | null => typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value) ? value.toLowerCase() : null;
const indexedAddress = (value: unknown): string | null => { const padded = bytes32(value); return padded && /^0x0{24}[0-9a-f]{40}$/.test(padded) ? `0x${padded.slice(-40)}` : null; };
const word = (data: string, index: number): string | null => hex(data) && data.length >= 2 + (index + 1) * 64 ? `0x${data.slice(2 + index * 64, 2 + (index + 1) * 64)}`.toLowerCase() : null;
const bigint = (value: string | bigint): bigint | null => {
  try { if (typeof value === 'bigint') return value >= ZERO ? value : null; if (typeof value === 'string' && value.length <= 78 && /^(0|[1-9][0-9]*)$/.test(value)) return BigInt(value); } catch { /* invalid */ }
  return null;
};
const asHexBigint = (value: string): bigint | null => { try { return /^0x[0-9a-f]+$/i.test(value) ? BigInt(value) : null; } catch { return null; } };
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const eventData = (data: unknown, words: number): boolean => typeof data === 'string' && data.length === 2 + words * 64 && /^0x[0-9a-fA-F]*$/.test(data);

interface Filled { log: ReceiptLog; exchange: string; orderHash: string; maker: string; taker: string; side: Side; tokenId: bigint; makerAmount: bigint; takerAmount: bigint; }
interface Matched { log: ReceiptLog; exchange: string; orderHash: string; taker: string; }

function parseFilled(log: ReceiptLog): Filled | null {
  if (!address(log?.address) || !Array.isArray(log?.topics) || log.topics.length !== 4 || !same(log.topics[0], EVENT_TOPICS.orderFilled) || !eventData(log?.data, 7)) return null;
  const orderHash = bytes32(log.topics[1]); const maker = indexedAddress(log.topics[2]); const taker = indexedAddress(log.topics[3]);
  const sideWord = word(log.data, 0); const tokenWord = word(log.data, 1); const makerAmountWord = word(log.data, 2); const takerAmountWord = word(log.data, 3);
  const sideNum = sideWord ? asHexBigint(sideWord) : null; const tokenId = tokenWord ? asHexBigint(tokenWord) : null;  const makerAmount = makerAmountWord ? asHexBigint(makerAmountWord) : null; const takerAmount = takerAmountWord ? asHexBigint(takerAmountWord) : null;
  if (!orderHash || !maker || !taker || sideNum === null || (sideNum !== ZERO && sideNum !== ONE) || tokenId === null || makerAmount === null || takerAmount === null) return null;
  return { log, exchange: log.address.toLowerCase(), orderHash, maker, taker, side: sideNum === ZERO ? 'BUY' : 'SELL', tokenId, makerAmount, takerAmount };
}
function parseMatched(log: ReceiptLog): Matched | null {
  if (!address(log?.address) || !Array.isArray(log?.topics) || log.topics.length !== 3 || !same(log.topics[0], EVENT_TOPICS.ordersMatched) || !eventData(log?.data, 4)) return null;
  const orderHash = bytes32(log.topics[1]); const taker = indexedAddress(log.topics[2]); return orderHash && taker ? { log, exchange: log.address.toLowerCase(), orderHash, taker } : null;
}

export function verifyOnchainRole(receipt: ReceiptLike, request: VerificationRequest): VerificationResult {
  try {
    if (!receipt || typeof receipt !== 'object' || !request || typeof request !== 'object') return unsupported('malformed-input');
    const wallet = address(request.wallet); const tx = bytes32(request.transactionHash);
    const tokenId = bigint(request.tokenId); const size = bigint(request.size);
    if (request.chainId !== POLYGON_CHAIN_ID) return unsupported('wrong-chain');
    if (!wallet || !tx || tokenId === null || size === null || size === ZERO || (request.side !== 'BUY' && request.side !== 'SELL')) return unsupported('invalid-identifier-or-amount');
    if (typeof receipt.transactionHash !== 'string' || !same(receipt.transactionHash, tx) || typeof receipt.blockNumber !== 'string' || !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]{0,63})$/.test(receipt.blockNumber) || !bytes32(receipt.blockHash) || !(['0x1', '1', 1].includes(receipt.status))) return unsupported('receipt-pending-reverted-or-unbound');
    if (!Array.isArray(receipt.logs) || receipt.logs.length > 2048) return unsupported('malformed-or-oversized-receipt-logs');
    const known = new Set<string>(Object.values(EXCHANGE_ADDRESSES));
    const knownLogs = receipt.logs.filter(log => known.has(address(log?.address) ?? ''));
    const filled = knownLogs.map(parseFilled).filter((x): x is Filled => x !== null);
    const matched = knownLogs.map(parseMatched).filter((x): x is Matched => x !== null);
    if (filled.length === 0) return unsupported('no-supported-order-filled-event');
    const filledHashes = new Set(filled.map(x => x.orderHash));
    const matchedHashes = new Set(matched.map(x => x.orderHash));
    if (filledHashes.size !== filled.length || matchedHashes.size !== matched.length) return unsupported('duplicate-order-hash');
    if (new Set(filled.map(x => x.exchange)).size > 1 || new Set(matched.map(x => x.exchange)).size > 1 || filled.some(x => matched.some(m => m.orderHash === x.orderHash && m.exchange !== x.exchange))) return unsupported('ambiguous-cross-exchange-receipt');
    const matchedByHash = new Map(matched.map(x => [x.orderHash, x]));
    // Both taker emissions are produced from the SAME p in Events.sol.
    if (matched.some(m => {
      const f = filled.find(x => x.exchange === m.exchange && x.orderHash === m.orderHash);
      return !f || f.maker !== m.taker || f.taker !== f.exchange
        || f.log.data.slice(0, 2 + 4 * 64).toLowerCase() !== m.log.data.toLowerCase();
    })) return unsupported('contradictory-taker-event-binding');
    const candidates = filled.filter(event => {
      const matchedEvent = matchedByHash.get(event.orderHash);
      const isMaker = event.maker === wallet;
      const isTaker = matchedEvent?.exchange === event.exchange && matchedEvent.taker === wallet && event.taker === event.exchange;
      const shareAmount = event.side === 'BUY' ? event.takerAmount : event.makerAmount;
      return (isMaker || isTaker) && event.tokenId === tokenId && shareAmount === size && event.side === request.side;
    });
    if (candidates.length !== 1) return unsupported(candidates.length ? 'ambiguous-multifill' : 'token-side-size-or-wallet-not-bound', candidates.length);
    const event = candidates[0];
    const matchedEvent = matchedByHash.get(event.orderHash);
    const isMaker = event.maker === wallet && event.taker !== event.exchange;
    const isTaker = event.maker === wallet && matchedEvent?.exchange === event.exchange && matchedEvent.taker === wallet && event.taker === event.exchange;
    if (event.taker === event.exchange && !isTaker) return unsupported('taker-binding-missing');
    if (isMaker === isTaker) return unsupported('role-binding-ambiguous');
    const role: Role = isMaker ? 'maker' : 'taker';
    const counterparty = role === 'maker' ? event.taker : filled.filter(x => x.exchange === event.exchange && x.taker === wallet && x.maker !== wallet
      && x.tokenId === event.tokenId && x.side !== event.side && (x.side === 'BUY' ? x.takerAmount : x.makerAmount) === size).map(x => x.maker);
    if (role === 'maker' && event.taker === event.exchange) return unsupported('taker-binding-missing');
    if (role === 'taker' && (!Array.isArray(counterparty) || counterparty.length !== 1)) return unsupported('counterparty-ambiguous');
    const cp = role === 'maker' ? event.taker : counterparty[0];
    return { status: 'supported', reason: 'exact-v2-order-filled-receipt-event', chainId: POLYGON_CHAIN_ID, exchange: event.exchange, transactionHash: receipt.transactionHash.toLowerCase(), blockNumber: receipt.blockNumber, blockHash: receipt.blockHash.toLowerCase(), role, counterparty: cp, tokenId: tokenId.toString(), size: size.toString(), side: request.side, matchedEventCount: 1, rawEvent: event.log };
  } catch { return unsupported('malformed-input'); }
}
