const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { createLoader } = require('./helpers/load-ts.cjs');
const wallet = `0x${'a'.repeat(40)}`;
const load = createLoader();
const { GET } = load('src/app/api/wallet/[address]/og/route.tsx');
afterEach(() => mock.restoreAll());
const invoke = (address = wallet) => GET(new NextRequest(`http://localhost/api/wallet/${address}/og`), { params: Promise.resolve({ address }) });

function position(token, status, overrides = {}) {
  return {
    proxy_wallet: wallet, token_id: token, condition_id: `0x${'c'.repeat(64)}`, status,
    current_size: 10, avg_price: 0.5, entry_cost_usdc: 5, current_price: 0.7,
    current_value: 7, total_size: 10, realized_pnl: 1, unrealized_pnl: 2,
    percent_pnl: 40, percent_realized_pnl: 20, redeemable: false,
    mergeable: false, negative_risk: false, ...overrides,
  };
}
function validUpstream(url) {
  if (url.pathname.endsWith('/value')) return { data: { proxy_wallet: wallet, value: 7 } };
  const status = url.searchParams.get('status');
  const rows = status === 'OPEN' ? [position('1', 'OPEN')]
    : status === 'REDEEMABLE_LOST' ? [position('2', 'REDEEMABLE_LOST', { current_value: 0, realized_pnl: 0, unrealized_pnl: -3 })]
    : [position('3', 'CLOSED', { current_value: 0, realized_pnl: 4, unrealized_pnl: -5 })];
  return { data: rows, pagination: { has_more: false, next_cursor: null } };
}
test('share statistics use v2 lifecycle accounting including zero-mark holdings', async () => {
  const calls = [];
  mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input); calls.push(url); return Response.json(validUpstream(url));
  });
  const stats = await load('src/lib/walletShareStats.ts').readWalletShareStats(wallet);
  assert.equal(stats.totalPnl, (1 + 2) + (-3) + 4);
  assert.equal(stats.openValue, 7);
  assert.equal(stats.positions, 3);
  assert.equal(stats.winRate, 2 / 3 * 100);
  assert.equal(stats.truncated, false);
  assert.ok(calls.every(url => url.pathname.startsWith('/v2/')));
});
test('share statistics propagate lifecycle sample truncation instead of lifetime claims', async () => {
  mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input); const result = validUpstream(url);
    if (url.searchParams.get('status') === 'OPEN') result.pagination = { has_more: true, next_cursor: url.searchParams.has('cursor') ? 'third-page' : 'second-page' };
    return Response.json(result);
  });
  const stats = await load('src/lib/walletShareStats.ts').readWalletShareStats(wallet);
  assert.equal(stats.truncated, true);
  assert.equal(stats.positions, 3);
});
test('rate-limited OG returns 503 with retry guidance, not a share PNG', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 429, headers: { 'Retry-After': '30' } }));
  const res = await invoke();
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('retry-after'), '30');
});

test('wallet OG does not publish a zero-PnL PNG during an upstream outage', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 503 }));
  const res = await invoke();
  assert.equal(res.status, 502);
  assert.match(res.headers.get('cache-control'), /no-store/);
  assert.equal(Object.hasOwn(await res.json(), 'totalPnl'), false);
});
test('wallet OG rejects invalid address without upstream reads', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 503 }));
  assert.equal((await invoke('not-a-wallet')).status, 400);
  assert.equal(fetch.mock.callCount(), 0);
});
