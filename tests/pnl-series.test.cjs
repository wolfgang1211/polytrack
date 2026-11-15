/* focused route contract tests. */
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { createLoader } = require('./helpers/load-ts.cjs');
const load = createLoader();

const wallet = `0x${'a'.repeat(40)}`;
const otherWallet = `0x${'b'.repeat(40)}`;
const points = [
  { timestamp: 1700000000, trade_pnl: -12.5, realized_pnl: -10, trade_count: 2 },
  { timestamp: 1700086400, trade_pnl: 4.25, realized_pnl: 6, trade_count: 3 },
];
const series = (proxy_wallet = wallet, pnlPoints = points) => ({
  data: { proxy_wallet, interval: 'all', fidelity: '1d', source_fidelity: '1d', points: pnlPoints },
});

function upstream(result) {
  const calls = [];
  mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    const value = typeof result === 'function' ? result(url, init) : result;
    return value instanceof Response ? value : Response.json(value);
  });
  return calls;
}
async function invokeTimeline(address = wallet) {
  const { GET } = load('src/app/api/wallet/[address]/timeline/route.ts');
  const req = new NextRequest(`http://localhost/api/wallet/${address}/timeline`);
  const res = await GET(req, { params: Promise.resolve({ address }) });
  return { res, body: await res.json() };
}
async function invokeSparkline(query) {
  const { GET } = load('src/app/api/leaderboard/sparkline/route.ts');
  const req = new NextRequest(`http://localhost/api/leaderboard/sparkline?${query}`);
  const res = await GET(req);
  return { res, body: await res.json() };
}
afterEach(() => mock.restoreAll());

test('timeline reads verified v2 cumulative trade_pnl series and binds wallet/query', async () => {
  const calls = upstream(series());
  const { res, body } = await invokeTimeline();
  assert.equal(res.status, 200);
  assert.deepEqual(body.points, points.map(p => ({ t: p.timestamp, pnl: p.trade_pnl })));
  assert.equal(body.latestPnl, 4.25);
  assert.equal(body.metric, 'trade_pnl');
  assert.equal(body.tradeCount, 3);
  assert.equal(body.source, 'data-api-v2');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.hostname, 'data-api.polymarket.com');
  assert.equal(calls[0].url.pathname, '/v2/user-pnl');
  assert.equal(calls[0].url.searchParams.get('user'), wallet);
  assert.equal(calls[0].url.searchParams.get('interval'), 'all');
  assert.equal(calls[0].url.searchParams.get('fidelity'), '1d');
});

test('timeline preserves a genuine empty v2 series without inventing a point', async () => {
  upstream(series(wallet, []));
  const { res, body } = await invokeTimeline();
  assert.equal(res.status, 200);
  assert.deepEqual(body.points, []);
  assert.equal(body.latestPnl, null);
  assert.equal(body.tradeCount, null);
});

test('timeline rejects wrong source wallet and malformed financial points', async () => {
  upstream(series(otherWallet));
  assert.equal((await invokeTimeline()).res.status, 502);
  mock.restoreAll();
  upstream(series(wallet, [{ timestamp: 1700000000, trade_pnl: null }]));
  assert.equal((await invokeTimeline()).res.status, 502);
});

test('sparkline requests actual one-week v2 series and preserves map shape', async () => {
  const calls = upstream(url => ({ data: { ...series(url.searchParams.get('user')).data, interval: '1w' } }));
  const { res, body } = await invokeSparkline(`wallets=${wallet},${otherWallet}`);
  assert.equal(res.status, 200);
  assert.deepEqual(body, { [wallet]: [-12.5, 4.25], [otherWallet]: [-12.5, 4.25] });
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.url.pathname, '/v2/user-pnl');
    assert.equal(call.url.searchParams.get('interval'), '1w');
    assert.equal(call.url.searchParams.get('fidelity'), '1d');
  }
});

test('sparkline rejects invalid or over-limit wallet lists before upstream', async () => {
  const calls = upstream(series());
  const invalid = await invokeSparkline(`wallets=${wallet},not-a-wallet`);
  assert.equal(invalid.res.status, 400);
  assert.equal(calls.length, 0);
  const many = Array.from({ length: 21 }, (_, i) => `0x${String(i + 1).padStart(40, '0')}`).join(',');
  const over = await invokeSparkline(`wallets=${many}`);
  assert.equal(over.res.status, 400);
  assert.equal(calls.length, 0);
});

test('sparkline does not convert an unavailable v2 series into a healthy empty map', async () => {
  upstream(Response.json({ error: 'upstream unavailable' }, { status: 503 }));
  const { res, body } = await invokeSparkline(`wallets=${wallet}`);
  assert.ok([502, 503].includes(res.status));
  assert.equal(Object.keys(body).length, 1);
  assert.equal(typeof body.error, 'string');
});
