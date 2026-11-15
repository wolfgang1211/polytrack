const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { createLoader } = require('./helpers/load-ts.cjs');
const load = createLoader();
const kv = load('src/lib/kv.ts');
const originalEnabled = kv.kvEnabled;
const wallet = `0x${'a'.repeat(40)}`;
afterEach(() => { mock.restoreAll(); kv.kvEnabled = originalEnabled; });
const request = address => new NextRequest(`http://localhost/api/liquidity/validate?address=${address}`);

test('model validation rejects invalid wallet before disabled-store or source checks', async () => {
  kv.kvEnabled = false;
  const { GET } = load('src/app/api/liquidity/validate/route.ts');
  assert.equal((await GET(request('not-a-wallet'))).status, 400);
});
test('unavailable maker feed is a 503 error, never zero realized PnL in a 200 response', async () => {
  kv.kvEnabled = true;
  mock.method(load('src/lib/lpSnapshots.ts'), 'readLpSnapshots', async () => []);
  mock.method(load('src/lib/dataApiFills.ts'), 'fetchRecentMakerFills', async () => null);
  const { GET } = load('src/app/api/liquidity/validate/route.ts');
  const res = await GET(request(wallet));
  assert.equal(res.status, 503);
  assert.match(res.headers.get('cache-control'), /no-store/);
  const body = await res.json();
  assert.equal(typeof body.error, 'string');
  assert.equal(body.real, undefined);
});
test('snapshot failure returns a sanitized unavailable response without diagnostics', async () => {
  kv.kvEnabled = true;
  mock.method(load('src/lib/lpSnapshots.ts'), 'readLpSnapshots', async () => { throw new Error('must-not-leak-private-diagnostic'); });
  const { GET } = load('src/app/api/liquidity/validate/route.ts');
  const res = await GET(request(wallet));
  assert.equal(res.status, 503);
  assert.match(res.headers.get('cache-control'), /no-store/);
  assert.doesNotMatch(JSON.stringify(await res.json()), /must-not-leak-private-diagnostic/);
});
