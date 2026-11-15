/* Node test runner and actual TypeScript route loader. */
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { createLoader } = require('./helpers/load-ts.cjs');
const load = createLoader();
const wallet = `0x${'a'.repeat(40)}`;
// Explicit synthetic v2 contract fixtures; not live observations.
const trader = { rank: 1, user_id: wallet, user_name: 'Fixture trader', x_username: '', profile_image: '', verified: true, pnl: 120, volume: 1000 };
const trade = { proxy_wallet: wallet, token_id: '101', condition_id: `0x${'b'.repeat(64)}`, side: 'BUY', size: 100, price: 0.5, timestamp: Math.floor(Date.now() / 1000) - 60, transaction_hash: `0x${'c'.repeat(64)}`, title: 'Fixture market', slug: 'fixture-market', event_slug: 'fixture-event', icon: '', outcome: 'Yes', outcome_index: 0 };
const page = (data, cursor = null) => ({ data, pagination: { has_more: cursor !== null, next_cursor: cursor } });
const routes = {
  leaderboard: 'src/app/api/leaderboard/route.ts',
  recent: 'src/app/api/trades/recent/route.ts',
  activity: 'src/app/api/activity/route.ts',
  rising: 'src/app/api/traders/rising/route.ts',
  hot: 'src/app/api/markets/hot/route.ts',
  overview: 'src/app/api/stats/overview/route.ts',
};
function upstream(fn) {
  const calls = [];
  mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    const result = await fn(url, init);
    return result instanceof Response ? result : Response.json(result);
  });
  return calls;
}
async function invoke(name, search = '') {
  const { GET } = load(routes[name]);
  const res = await GET(new NextRequest(`http://localhost/api/${name}${search}`));
  return { res, body: await res.json() };
}
afterEach(() => mock.restoreAll());

// Observed upstream metadata edge case; all financial fixture values remain synthetic.
const opaqueCondition = '0x038f06f1c8f6769a942f2c32bc1bfb9aa40000000000000000000000000000';
test('short upstream condition metadata is preserved literally, never padded or treated as a CTF id', async () => {
  upstream(() => page([{ ...trade, condition_id: opaqueCondition, outcome_index: 999 }]));
  const { res, body } = await invoke('activity');
  assert.equal(res.status, 200);
  assert.equal(body.trades.length, 1);
  assert.equal(body.trades[0].conditionId, undefined);
  assert.equal(body.trades[0].sourceConditionId, opaqueCondition);
  assert.equal(body.trades[0].marketMetadataAvailable, false);
  assert.equal(body.trades[0].usdcSize, 50);
});
test('hot-market fallback keys use distinct token IDs, not matching titles or fabricated condition IDs', async () => {
  upstream(() => page([
    { ...trade, condition_id: opaqueCondition, token_id: '101' },
    { ...trade, condition_id: opaqueCondition, token_id: '102' },
  ]));
  const { res, body } = await invoke('hot');
  assert.equal(res.status, 200);
  assert.equal(body.length, 2);
  assert.deepEqual(body.map(row => row.marketKey).sort(), ['token:101','token:102']);
  assert.ok(body.every(row => row.conditionId === undefined && row.marketMetadataAvailable === false));
});

for (const [window, period] of Object.entries({ allTime: 'all', '1d': 'day', '1w': 'week', '1m': 'month' })) {
  test(`leaderboard uses v2 ${period} contract and preserves shares units`, async () => {
    const calls = upstream(() => page([trader]));
    const { res, body } = await invoke('leaderboard', `?window=${window}&limit=3`);
    assert.equal(res.status, 200);
    assert.equal(body.length, 1);
    assert.equal(body[0].proxyWallet, wallet);
    assert.equal(body[0].rank, '1');
    assert.equal(body[0].userName, trader.user_name);
    assert.equal(body[0].verifiedBadge, true);
    assert.equal(body[0].vol, 1000);
    assert.equal(body[0].volumeUnit, 'shares');
    assert.equal(calls[0].url.pathname, '/v2/leaderboard');
    assert.equal(calls[0].url.searchParams.get('time_period'), period);
    assert.equal(calls[0].url.searchParams.has('offset'), false);
  });
}

for (const query of ['?limit=NaN', '?limit=-1', '?limit=1.5', '?window=invalid']) {
  test(`leaderboard rejects invalid public parameters: ${query}`, async () => {
    const calls = upstream(() => page([trader]));
    const { res } = await invoke('leaderboard', query);
    assert.equal(res.status, 400);
    assert.equal(calls.length, 0);
  });
}

for (const name of ['leaderboard', 'recent', 'activity', 'rising', 'hot']) {
  test(`${name}: retired/malformed upstream is not a successful empty dataset`, async () => {
    upstream(() => Response.json({ error: 'diagnostic-must-not-leak' }, { status: 410 }));
    const { res, body } = await invoke(name);
    assert.equal(res.status, 502);
    assert.equal(typeof body.error, 'string');
    assert.doesNotMatch(JSON.stringify(body), /diagnostic-must-not-leak/);
    assert.match(res.headers.get('cache-control'), /no-store/);
  });
}

for (const data of [null, [{ ...trader, volume: null }], [{ ...trader, pnl: '120' }], [{ ...trader, user_id: 'not-a-wallet' }]]) {
  test(`leaderboard schema validation: ${JSON.stringify(data).slice(0, 70)}`, async () => {
    upstream(() => page(data));
    assert.equal((await invoke('leaderboard')).res.status, 502);
  });
}

test('recent feed maps real v2 names and calculates USDC using size times price', async () => {
  const calls = upstream(() => page([{ ...trade, size: 10000 }]));
  const { res, body } = await invoke('recent');
  assert.equal(res.status, 200);
  assert.equal(body.trades.length, 1);
  assert.equal(body.trades[0].proxyWallet, wallet);
  assert.equal(body.trades[0].asset, '101');
  assert.equal(body.trades[0].conditionId, trade.condition_id);
  assert.equal(body.trades[0].eventSlug, 'fixture-event');
  assert.equal(body.trades[0].usdcSize, 5000);
  assert.equal(calls[0].url.pathname, '/v2/trades');
});

test('activity returns normalised rows and explicit sample truncation', async () => {
  upstream(() => page([trade], 'remaining-history'));
  const { res, body } = await invoke('activity');
  assert.equal(res.status, 200);
  assert.equal(body.trades[0].asset, '101');
  assert.equal(body.count, 1);
  assert.equal(body.truncated, true);
});

test('rising trader mapping uses weekly board and cannot drop the data envelope', async () => {
  const calls = upstream(() => page([trader]));
  const { res, body } = await invoke('rising');
  assert.equal(res.status, 200);
  assert.equal(body[0].proxyWallet, wallet);
  assert.equal(calls[0].url.searchParams.get('time_period'), 'week');
});

test('hot market group sums normalized USDC and preserves condition identity', async () => {
  const recent = { ...trade, timestamp: Math.floor(Date.now() / 1000) };
  upstream(() => page([recent, { ...recent, size: 40 }]));
  const { res, body } = await invoke('hot');
  assert.equal(res.status, 200);
  assert.equal(body[0].conditionId, trade.condition_id);
  assert.equal(body[0].tradeCount, 2);
  assert.equal(body[0].volume, 70);
});

test('overview cannot turn a missing trade feed into zero healthy statistics', async () => {
  upstream(url => url.hostname.startsWith('gamma-api') ? [] : Response.json({}, { status: 503 }));
  const { res, body } = await invoke('overview');
  assert.equal(res.status, 502);
  assert.equal(Object.hasOwn(body, 'trades1h'), false);
});

test('overview cannot turn unavailable market data into zero healthy statistics', async () => {
  upstream(url => url.hostname.startsWith('gamma-api') ? Response.json({}, { status: 500 }) : page([trade]));
  assert.equal((await invoke('overview')).res.status, 502);
});

test('future trade timestamps beyond a small clock-skew allowance fail closed', async () => {
  upstream(() => page([{ ...trade, timestamp: Math.floor(Date.now() / 1000) + 86_400 }]));
  assert.equal((await invoke('activity')).res.status, 502);
});
test('hot window excludes even small future clock-skew trades from observed totals', async () => {
  upstream(() => page([{ ...trade, timestamp: Math.floor(Date.now() / 1000) + 20 }]));
  const { res, body } = await invoke('hot', '?period=1h');
  assert.equal(res.status, 200);
  assert.deepEqual(body, []);
});
test('overview one-hour sample excludes future trades and cannot invent a category', async () => {
  upstream(url => url.hostname.startsWith('gamma-api') ? [] : page([{ ...trade, timestamp: Math.floor(Date.now() / 1000) + 20 }]));
  const { res, body } = await invoke('overview');
  assert.equal(res.status, 200);
  assert.equal(body.trades1h, 0);
  assert.equal(body.topCategoryCount, 0);
  assert.equal(body.topCategory, 'No trades');
});

test('share-volume efficiency is USDC per share, not a percentage ROI', () => {
  const { roiLeaders } = load('src/lib/insights.ts');
  const [row] = roiLeaders([{ pnl: 120, vol: 1000 }], 1, 0);
  assert.equal(row.pnlPerShare, 120 / 1000);
  assert.equal(Object.hasOwn(row, 'roiPct'), false);
});

test('new share-based volume formatter never prefixes dollar currency', () => {
  const { formatShares } = load('src/lib/utils.ts');
  assert.doesNotMatch(formatShares(1000), /\$/);
  assert.match(formatShares(1000), /shares/);
});
