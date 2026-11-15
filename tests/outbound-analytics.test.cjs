const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { createLoader } = require('./helpers/load-ts.cjs');
const load = createLoader();
const { outboundEvent, parseOutboundEvent } = load('src/lib/outboundAnalytics.ts');
test('outbound click records campaign placement but no wallet, full URL, ref or query data', () => {
  const result = outboundEvent(`https://polymarket.com/event/example?ref=private-value&utm_content=wallet_positions&wallet=0x${'a'.repeat(40)}`);
  assert.deepEqual(result, { event: 'polymarket_outbound_click', kind: 'market', placement: 'wallet_positions' });
  assert.doesNotMatch(JSON.stringify(result), /private-value|0x|https|example/);
});
test('profile clicks are not recorded as builder volume or matched trades', () => {
  assert.deepEqual(outboundEvent(`https://polymarket.com/profile/0x${'a'.repeat(40)}`), { event: 'polymarket_outbound_click', kind: 'profile', placement: 'unattributed' });
});
test('unknown campaign strings cannot leak arbitrary user data into analytics', () => {
  assert.equal(outboundEvent('https://polymarket.com/event/example?utm_content=private-wallet-value').placement, 'unattributed');
});
test('event transport accepts only the fixed privacy-safe contract', () => {
  const valid = { event: 'polymarket_outbound_click', kind: 'market', placement: 'home_recent_trades' };
  assert.deepEqual(parseOutboundEvent(valid), valid);
  for (const value of [null, [], { ...valid, wallet: 'must-not-log' }, { ...valid, placement: 'private-value' }, { ...valid, event: 'builder_volume' }]) assert.equal(parseOutboundEvent(value), null);
});
test('non-Polymarket links and deceptive origins never emit an outbound event', () => {
  for (const href of ['javascript:alert(1)', 'https://polymarket.com.evil.test/event/example', 'http://polymarket.com/event/example', 'https://user:pass@polymarket.com/event/example']) assert.equal(outboundEvent(href), null);
});

afterEach(() => mock.restoreAll());
const { NextRequest } = require('next/server');
const { POST } = load('src/app/api/analytics/outbound/route.ts');
const payload = { event: 'polymarket_outbound_click', kind: 'market', placement: 'home_recent_trades' };
const request = (body = payload, origin = 'http://127.0.0.1:3016') => new NextRequest('http://127.0.0.1:3016/api/analytics/outbound', {
  method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
  headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
});
test('actual event route logs exactly the sanitized event and returns 204', async () => {
  const log = mock.method(console, 'info', () => {});
  const res = await POST(request());
  assert.equal(res.status, 204);
  assert.match(res.headers.get('cache-control'), /no-store/);
  assert.deepEqual(log.mock.calls[0].arguments, ['alphaboard_outbound', JSON.stringify(payload)]);
});
test('missing or forged origins cannot produce server event logs', async () => {
  const log = mock.method(console, 'info', () => {});
  for (const origin of [null, 'https://evil.test', 'https://www.alphaboard.xyz']) assert.equal((await POST(request(payload, origin))).status, 403);
  assert.equal(log.mock.callCount(), 0);
});
test('oversized, malformed or extra sensitive fields never enter telemetry', async () => {
  const log = mock.method(console, 'info', () => {});
  assert.equal((await POST(request('x'.repeat(513)))).status, 413);
  assert.equal((await POST(request('not JSON'))).status, 400);
  assert.equal((await POST(request({ ...payload, wallet: 'must-not-log' }))).status, 400);
  assert.equal(log.mock.callCount(), 0);
});
test('actual delegated click handler emits one beacon without preventing navigation', async () => {
  const originals = Object.fromEntries(['Element', 'navigator', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const calls = [];
  class FakeElement { closest() { return { href: 'https://polymarket.com/event/example?utm_content=home_recent_trades' }; } }
  try {
    Object.defineProperty(globalThis, 'Element', { configurable: true, value: FakeElement });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { sendBeacon: (...args) => { calls.push(args); return true; } } });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
    const fetch = mock.method(globalThis, 'fetch', () => { throw new Error('No network allowed in this fixture'); });
    let prevented = false;
    const { handleOutboundClick } = load('src/components/OutboundAnalytics.tsx');
    handleOutboundClick({ type: 'click', button: 0, target: new FakeElement(), preventDefault() { prevented = true; } });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], '/api/analytics/outbound');
    assert.deepEqual(JSON.parse(await calls[0][1].text()), payload);
    assert.equal(prevented, false);
    assert.equal(fetch.mock.callCount(), 0);
  } finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
