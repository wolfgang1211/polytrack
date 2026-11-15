/* focused v2 fill regressions. */
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { createLoader } = require('./helpers/load-ts.cjs');
const load = createLoader();
const wallet = `0x${'a'.repeat(40)}`;
const other = `0x${'b'.repeat(40)}`;
const condition = `0x${'c'.repeat(64)}`;
const tx = n => `0x${String(n).padStart(64, '0')}`;
const row = (overrides = {}) => ({
  proxy_wallet: wallet, token_id: '101', condition_id: condition, side: 'BUY',
  size: 10, price: 0.5, timestamp: 100, transaction_hash: tx(1),
  title: 'Fixture', outcome: 'Yes', ...overrides,
});
const page = (data, next = null) => ({ data, pagination: { has_more: next !== null, next_cursor: next } });
const json = (value, status = 200) => value instanceof Response ? value : Response.json(value, { status });

afterEach(() => mock.restoreAll());

test('v2 fill pagination uses cursor and converts maker wallet side at the boundary', async () => {
  const calls = [];
  mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input); calls.push(url);
    if (url.searchParams.get('cursor') === 'next') return json(url.searchParams.get('taker_only') === 'true'
      ? page([]) : page([row({ transaction_hash: tx(2), timestamp: 99 })]));
    return json(page([row()], 'next'));
  });
  const { fetchRecentMakerFills } = load('src/lib/dataApiFills.ts');
  const result = await fetchRecentMakerFills(wallet, 1);
  assert.deepEqual(result.fills.map(f => f.takerSide), ['SELL']);
  assert.equal(result.fills.length, 1);
  assert.ok(calls.every(url => !url.searchParams.has('offset') && url.pathname === '/v2/trades'));
  assert.ok(calls.every(url => url.searchParams.get('filter_type') === 'TOKENS' && url.searchParams.get('filter_amount') === '0.000001'));
});

test('maker classification fails closed on incomplete or mismatched role snapshots', async () => {
  mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input);
    return json(url.searchParams.get('taker_only') === 'true' ? page([row({ transaction_hash: tx(99) })]) : page([row()]));
  });
  const { fetchRecentMakerFills, fetchRecentFills } = load('src/lib/dataApiFills.ts');
  assert.equal(await fetchRecentMakerFills(wallet, 1), null);
  assert.equal(await fetchRecentFills(wallet, 1), null);
});

test('maker rows retain GraphFill taker perspective while wallet-side rows stay wallet-side', async () => {
  mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input);
    return json(url.searchParams.get('taker_only') === 'true' ? page([]) : page([row()]));
  });
  const { fetchRecentFills } = load('src/lib/dataApiFills.ts');
  const result = await fetchRecentFills(wallet, 1);
  assert.equal(result.fills[0].side, 'Sell');
  assert.equal(result.fills[0].maker.id, wallet);
  assert.equal(result.fills[0].taker.id, '');
});

test('user and activity routes validate wallet before any upstream request', async () => {
  let calls = 0;
  mock.method(globalThis, 'fetch', async () => { calls += 1; return json(page([])); });
  const recent = load('src/app/api/trades/user/[address]/route.ts');
  const activity = load('src/app/api/wallet/[address]/activity/route.ts');
  const bad = 'not-a-wallet';
  const ctx = { params: Promise.resolve({ address: bad }) };
  assert.equal((await recent.GET(new NextRequest(`http://localhost/api/trades/user/${bad}`), ctx)).status, 400);
  assert.equal((await activity.GET(new NextRequest(`http://localhost/api/wallet/${bad}/activity`), ctx)).status, 400);
  assert.equal(calls, 0);
});

test('activity follows v2 cursor continuation and reports intentional truncation', async () => {
  const calls = [];
  mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input); calls.push(url);
    return json(url.searchParams.has('cursor') ? page([row({ transaction_hash: tx(2), timestamp: 99 })]) : page([row()], 'next'));
  });
  const activity = load('src/app/api/wallet/[address]/activity/route.ts');
  const res = await activity.GET(new NextRequest(`http://localhost/api/wallet/${wallet}/activity`), { params: Promise.resolve({ address: wallet }) });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.count, 2);
  assert.equal(body.truncated, false);
  assert.equal(calls[0].searchParams.get('limit'), '1000');
  assert.equal(calls[1].searchParams.get('cursor'), 'next');
  assert.ok(calls.every(url => !url.searchParams.has('offset')));
});

test('latest user trades reject other wallets and out-of-window rows', async () => {
  const route = load('src/app/api/trades/user/[address]/route.ts');
  for (const badRow of [row({ proxy_wallet: other, timestamp: Math.floor(Date.now() / 1000) - 60 }), row()]) {
    const fetch = mock.method(globalThis, 'fetch', async () => json(page([badRow])));
    const res = await route.GET(new NextRequest(`http://localhost/api/trades/user/${wallet}`), { params: Promise.resolve({ address: wallet }) });
    assert.equal(res.status, 502);
    fetch.mock.restore();
  }
});
test('wallet activity rejects rows outside its pinned start/end window', async () => {
  mock.method(globalThis, 'fetch', async () => json(page([row({ timestamp: 0 })])));
  const route = load('src/app/api/wallet/[address]/activity/route.ts');
  assert.equal((await route.GET(new NextRequest(`http://localhost/api/wallet/${wallet}/activity`), { params: Promise.resolve({ address: wallet }) })).status, 502);
});
test('LP earnings cannot present stale graph data as healthy when the maker tail is unavailable', async () => {
  mock.method(globalThis, 'fetch', async () => json({}, 503));
  const route = load('src/app/api/wallet/[address]/lp/route.ts');
  const res = await route.GET(new NextRequest(`http://localhost/api/wallet/${wallet}/lp`), { params: Promise.resolve({ address: wallet }) });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.available, false);
  assert.equal(Object.hasOwn(body, 'realized'), false);
  assert.match(res.headers.get('cache-control'), /no-store/);
});

test('upstream failure is unavailable, never a successful empty fill feed', async () => {
  mock.method(globalThis, 'fetch', async () => json({ error: 'secret diagnostic' }, 503));
  const recent = load('src/app/api/trades/user/[address]/route.ts');
  const res = await recent.GET(new NextRequest(`http://localhost/api/trades/user/${wallet}`), { params: Promise.resolve({ address: wallet }) });
  assert.equal(res.status, 502);
  assert.doesNotMatch(await res.text(), /secret diagnostic/);
});
