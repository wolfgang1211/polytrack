const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createLoader } = require('./helpers/load-ts.cjs');
const load = createLoader();
const scratch = path.join(process.env.TMPDIR || require('node:os').tmpdir(), 'alphaboard-funnel-tests');
function directory() { fs.mkdirSync(scratch, { recursive: true }); return fs.mkdtempSync(path.join(scratch, 'fixture-')); }

test('page groups never retain wallet identifiers, queries, dashboard or API paths', () => {
  const { pageGroup } = load('src/lib/funnelSchema.ts');
  assert.equal(pageGroup('/'), 'home');
  assert.equal(pageGroup('/wallet/0x' + 'a'.repeat(40)), 'wallet');
  assert.equal(pageGroup('/blog/example-post'), 'blog');
  for (const value of ['/analytics','/api/analytics/summary','/wallet/not-a-wallet','/?wallet=secret','https://evil.test/']) assert.equal(pageGroup(value), null);
});
test('strict funnel schema excludes identifiers and client timestamps', () => {
  const { parseFunnelEvent } = load('src/lib/funnelSchema.ts');
  const event = { event: 'page_view', page: 'home' };
  assert.deepEqual(parseFunnelEvent(event), event);
  for (const extra of [{ wallet: 'private' }, { timestamp: 1 }, { url: 'https://example.test' }]) assert.equal(parseFunnelEvent({ ...event, ...extra }), null);
  assert.equal(parseFunnelEvent({ event:'page_view', page:'__proto__' }), null);
  assert.equal(parseFunnelEvent({ event:'polymarket_outbound_click', page:'home', kind:'market', placement:'unknown-referral' }), null);
});
test('durable aggregate survives close/reopen and separates UTC days', () => {
  const { FunnelStore } = load('src/lib/funnelStore.ts');
  const dir = directory();
  let now = Date.parse('2026-11-14T23:59:59Z');
  let store = new FunnelStore(dir, () => now);
  store.record({ event:'page_view', page:'home' });
  store.record({ event:'polymarket_outbound_click', page:'home', kind:'market', placement:'home_recent_trades' });
  store.record({ event:'polymarket_outbound_click', page:'home', kind:'market', placement:'home_recent_trades' });
  store.close();
  now = Date.parse('2026-11-15T00:00:01Z');
  store = new FunnelStore(dir, () => now);
  store.record({ event:'page_view', page:'wallet' });
  const summary = store.summary(3);
  assert.equal(summary.scope, 'local-qa');
  assert.equal(summary.totals.views, 2);
  assert.equal(summary.totals.clicks, 2);
  assert.equal(summary.daily[0].views, null);
  assert.equal(summary.daily[0].coverage, 'not-collected');
  assert.equal(summary.daily[1].views, 1);
  assert.equal(summary.daily[2].views, 1);
  const home = summary.pages.find(row => row.page === 'home');
  assert.equal(home.clicksPer100Views, 200);
  assert.equal(summary.placements[0].clicks, 2);
  assert.equal(summary.placements[0].clicksPer100Views, undefined);
  store.close();
});
test('independent connections increment atomically without lost counts', () => {
  const { FunnelStore } = load('src/lib/funnelStore.ts');
  const dir = directory();
  const a = new FunnelStore(dir), b = new FunnelStore(dir);
  for (let i=0;i<20;i++) { a.record({ event:'page_view', page:'home' }); b.record({ event:'page_view', page:'home' }); }
  assert.equal(a.summary(1).totals.views, 40);
  a.close(); b.close();
});
test('zero views produce unavailable rate, not a made-up zero percent conversion', () => {
  const { FunnelStore } = load('src/lib/funnelStore.ts');
  const store = new FunnelStore(directory());
  store.record({ event:'polymarket_outbound_click', page:'wallet', kind:'profile', placement:'wallet_positions' });
  assert.equal(store.summary(1).totals.clicksPer100Views, null);
  for (const days of [0,32,1.5,NaN]) assert.throws(() => store.summary(days));
  assert.throws(() => store.record({ event:'page_view', page:'home', wallet:'must-not-store' }));
  store.close();
});
