import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type RouteContext<T extends string> = { params: Promise<Record<T extends `/api/wallet/[${infer P}]/cash-flows` ? P : 'address', string>> };

type AlchemyTransfer = {
  from?: string;
  to?: string;
  value?: number | string | null;
  asset?: string;
  hash?: string;
  metadata?: { blockTimestamp?: string };
};

type Direction = 'in' | 'out';

type TransferFetchResult = {
  transfers: AlchemyTransfer[];
  hasMore: boolean;
  rangesScanned?: number;
  latestBlock?: number;
  failedRanges?: { fromBlock: number; toBlock: number; error: string }[];
};

type AddressKind = 'contract' | 'external-wallet' | 'unknown';

type CounterpartySummary = {
  address: string;
  count: number;
  total: number;
  kind?: AddressKind;
  label?: string;
};

const USDC_CONTRACTS = [
  // Native USDC on Polygon
  '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
  // Bridged USDC.e on Polygon — older Polymarket flows often use this symbol as USDCE
  '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
];

// Conservative diagnostic labels. These are NOT final accounting rules.
const KNOWN_POLYMARKET_LIKE_CONTRACTS: Record<string, string> = {
  '0x4d97dcd97ec945f40cf65f87097ace5ea0476045': 'Polymarket-like internal/trading contract',
  '0x3a3bd7bb9528e159577f7c2e685cc81a765002e2': 'Polymarket-like internal/trading contract',
  '0x4bfb41d5b3570defd03c39a9a4d8de6bd8b8982e': 'Polymarket-like internal/trading contract',
};

function isAddress(x: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(x);
}

function normalize(x?: string) {
  return (x || '').toLowerCase();
}

function roundUsd(x: number) {
  return Math.round(x * 100) / 100;
}

async function alchemyRpc<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      if (!res.ok) throw new Error(`Alchemy HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error.message || 'Alchemy RPC error');
      return json.result as T;
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Alchemy RPC failed');
}

async function latestBlockNumber(rpcUrl: string): Promise<number> {
  const hex = await alchemyRpc<string>(rpcUrl, 'eth_blockNumber', []);
  return Number.parseInt(hex, 16);
}

async function addressKind(rpcUrl: string, address: string): Promise<AddressKind> {
  if (!isAddress(address)) return 'unknown';
  try {
    const code = await alchemyRpc<string>(rpcUrl, 'eth_getCode', [address, 'latest']);
    return code && code !== '0x' ? 'contract' : 'external-wallet';
  } catch {
    return 'unknown';
  }
}

async function fetchTransfers(
  rpcUrl: string,
  address: string,
  direction: Direction,
  maxPages: number,
  blockRange?: { fromBlock: number; toBlock: number }
): Promise<TransferFetchResult> {
  let pageKey: string | undefined;
  const transfers: AlchemyTransfer[] = [];

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, unknown> = {
      fromBlock: blockRange ? `0x${blockRange.fromBlock.toString(16)}` : '0x0',
      toBlock: blockRange ? `0x${blockRange.toBlock.toString(16)}` : 'latest',
      category: ['erc20'],
      contractAddresses: USDC_CONTRACTS,
      maxCount: '0x64',
      withMetadata: true,
      excludeZeroValue: true,
    };
    if (direction === 'in') params.toAddress = address;
    else params.fromAddress = address;
    if (pageKey) params.pageKey = pageKey;

    const result = await alchemyRpc<{ transfers?: AlchemyTransfer[]; pageKey?: string }>(
      rpcUrl,
      'alchemy_getAssetTransfers',
      [params]
    );

    transfers.push(...(result.transfers || []));
    pageKey = result.pageKey;
    if (!pageKey) break;
  }

  return { transfers, hasMore: Boolean(pageKey) };
}

async function fetchTransfersByRecentBlockRanges(
  rpcUrl: string,
  address: string,
  direction: Direction,
  opts: { maxRanges: number; rangeSize: number; pagesPerRange: number }
): Promise<TransferFetchResult> {
  const latest = await latestBlockNumber(rpcUrl);
  const all: AlchemyTransfer[] = [];
  let hasMore = false;
  let scanned = 0;
  const failedRanges: { fromBlock: number; toBlock: number; error: string }[] = [];

  for (let toBlock = latest; toBlock > 0 && scanned < opts.maxRanges; toBlock -= opts.rangeSize) {
    const fromBlock = Math.max(0, toBlock - opts.rangeSize + 1);
    try {
      const result = await fetchTransfers(rpcUrl, address, direction, opts.pagesPerRange, { fromBlock, toBlock });
      all.push(...result.transfers);
      hasMore = hasMore || result.hasMore;
    } catch (err) {
      failedRanges.push({
        fromBlock,
        toBlock,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
    scanned += 1;
  }

  return { transfers: all, hasMore: hasMore || scanned >= opts.maxRanges, rangesScanned: scanned, latestBlock: latest, failedRanges };
}

function summarize(transfers: AlchemyTransfer[], counterpartyKey: 'from' | 'to') {
  const byCounterparty = new Map<string, { count: number; total: number }>();
  let total = 0;

  for (const t of transfers) {
    const value = Number(t.value || 0);
    if (!Number.isFinite(value) || value <= 0) continue;
    total += value;
    const cp = normalize(t[counterpartyKey]);
    const prev = byCounterparty.get(cp) || { count: 0, total: 0 };
    prev.count += 1;
    prev.total += value;
    byCounterparty.set(cp, prev);
  }

  const topCounterparties: CounterpartySummary[] = Array.from(byCounterparty.entries())
    .map(([address, v]) => ({ address, count: v.count, total: roundUsd(v.total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  return {
    count: transfers.length,
    total: roundUsd(total),
    topCounterparties,
  };
}

async function classifyTopCounterparties(rpcUrl: string, topCounterparties: CounterpartySummary[]) {
  const classified: CounterpartySummary[] = [];
  for (const item of topCounterparties) {
    const lower = normalize(item.address);
    const kind = await addressKind(rpcUrl, lower);
    classified.push({
      ...item,
      address: lower,
      kind,
      label: KNOWN_POLYMARKET_LIKE_CONTRACTS[lower] || (kind === 'contract' ? 'Unlabeled contract' : kind === 'external-wallet' ? 'External wallet / EOA' : 'Unknown'),
    });
  }
  return classified;
}

function classificationTotals(items: CounterpartySummary[]) {
  const buckets = {
    contract: { count: 0, total: 0 },
    externalWallet: { count: 0, total: 0 },
    unknown: { count: 0, total: 0 },
    knownPolymarketLike: { count: 0, total: 0 },
  };

  for (const item of items) {
    if (item.kind === 'contract') {
      buckets.contract.count += item.count;
      buckets.contract.total += item.total;
    } else if (item.kind === 'external-wallet') {
      buckets.externalWallet.count += item.count;
      buckets.externalWallet.total += item.total;
    } else {
      buckets.unknown.count += item.count;
      buckets.unknown.total += item.total;
    }

    if (KNOWN_POLYMARKET_LIKE_CONTRACTS[normalize(item.address)]) {
      buckets.knownPolymarketLike.count += item.count;
      buckets.knownPolymarketLike.total += item.total;
    }
  }

  return {
    contract: { ...buckets.contract, total: roundUsd(buckets.contract.total) },
    externalWallet: { ...buckets.externalWallet, total: roundUsd(buckets.externalWallet.total) },
    unknown: { ...buckets.unknown, total: roundUsd(buckets.unknown.total) },
    knownPolymarketLike: { ...buckets.knownPolymarketLike, total: roundUsd(buckets.knownPolymarketLike.total) },
  };
}

export async function GET(
  req: NextRequest,
  ctx: RouteContext<'/api/wallet/[address]/cash-flows'>
) {
  const { address } = await ctx.params;
  if (!isAddress(address)) return NextResponse.json({ error: 'Invalid address' }, { status: 400 });

  const rpcUrl = process.env.ALCHEMY_POLYGON_RPC_URL;
  if (!rpcUrl) return NextResponse.json({ error: 'Missing ALCHEMY_POLYGON_RPC_URL' }, { status: 500 });

  const maxPages = Math.max(1, Math.min(20, Number(req.nextUrl.searchParams.get('pages') || 2)));
  const scan = req.nextUrl.searchParams.get('scan') || 'range';
  const maxRanges = Math.max(1, Math.min(100, Number(req.nextUrl.searchParams.get('ranges') || 5)));
  const rangeSize = Math.max(10_000, Math.min(2_000_000, Number(req.nextUrl.searchParams.get('rangeSize') || 500_000)));
  const started = Date.now();

  try {
    const incoming = scan === 'range'
      ? await fetchTransfersByRecentBlockRanges(rpcUrl, address, 'in', { maxRanges, rangeSize, pagesPerRange: maxPages })
      : await fetchTransfers(rpcUrl, address, 'in', maxPages);
    const outgoing = scan === 'range'
      ? await fetchTransfersByRecentBlockRanges(rpcUrl, address, 'out', { maxRanges, rangeSize, pagesPerRange: maxPages })
      : await fetchTransfers(rpcUrl, address, 'out', maxPages);

    const incomingSummary = summarize(incoming.transfers, 'from');
    const outgoingSummary = summarize(outgoing.transfers, 'to');
    const [classifiedIncoming, classifiedOutgoing] = await Promise.all([
      classifyTopCounterparties(rpcUrl, incomingSummary.topCounterparties),
      classifyTopCounterparties(rpcUrl, outgoingSummary.topCounterparties),
    ]);
    const incomingTotals = classificationTotals(classifiedIncoming);
    const outgoingTotals = classificationTotals(classifiedOutgoing);

    return NextResponse.json({
      address,
      source: 'alchemy_getAssetTransfers',
      mode: 'diagnostic',
      note: 'Raw USDC/USDC.e transfers only. External-wallet totals are possible deposits/withdrawals, not final Net PnL yet. Contract flows are likely internal/trading and must be excluded or classified before accounting.',
      scan,
      maxPages,
      maxRanges: scan === 'range' ? maxRanges : undefined,
      rangeSize: scan === 'range' ? rangeSize : undefined,
      elapsedMs: Date.now() - started,
      latestBlock: incoming.latestBlock || outgoing.latestBlock,
      rangesScanned: { incoming: incoming.rangesScanned, outgoing: outgoing.rangesScanned },
      failedRanges: { incoming: incoming.failedRanges, outgoing: outgoing.failedRanges },
      incoming: {
        ...incomingSummary,
        topCounterparties: classifiedIncoming,
        classificationTotals: incomingTotals,
        possibleDepositsFromExternalWallets: incomingTotals.externalWallet.total,
        hasMore: incoming.hasMore,
      },
      outgoing: {
        ...outgoingSummary,
        topCounterparties: classifiedOutgoing,
        classificationTotals: outgoingTotals,
        possibleWithdrawalsToExternalWallets: outgoingTotals.externalWallet.total,
        hasMore: outgoing.hasMore,
      },
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unknown error',
      source: 'alchemy_getAssetTransfers',
    }, { status: 502 });
  }
}
