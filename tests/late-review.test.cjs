const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createLoader } = require('./helpers/load-ts.cjs');
const load = createLoader();
const wallet = `0x${'a'.repeat(40)}`;
afterEach(() => mock.restoreAll());

test('Graph history never skips a failed early page and returns later sells as complete history', async () => {
  mock.method(globalThis, 'fetch', async (_input, init) => {
    const { skip } = JSON.parse(init.body).variables;
    if (skip === 0) return Response.json({ error: 'controlled outage' }, { status: 503 });
    return Response.json({ data: { enrichedOrderFilleds: skip === 1000 ? [{ id: 'later-sell' }] : [] } });
  });
  await assert.rejects(() => load('src/lib/graphFills.ts').fetchSide('https://fixture.invalid/graphql', wallet, true));
});
test('Graph missing page data is unavailable, not a successful empty page', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ data: {} }));
  await assert.rejects(() => load('src/lib/graphFills.ts').fetchSide('https://fixture.invalid/graphql', wallet, true));
});
test('Graph valid empty page remains genuine empty history', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ data: { enrichedOrderFilleds: [] } }));
  assert.deepEqual(await load('src/lib/graphFills.ts').fetchSide('https://fixture.invalid/graphql', wallet, true), []);
});
test('wallet sidebar never turns historical losses into negative portfolio equity', () => {
  const Sidebar = load('src/components/WalletSidebar.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Sidebar, { address: wallet, openValue: 10, positions: [{ status: 'CLOSED', realizedPnl: -1000000, cashPnl: 0, initialValue: 0 }] }));
  assert.doesNotMatch(html, /Portfolio Equity|Open value \+ realized/);
  const top = html.split('PnL Breakdown')[0];
  assert.match(top, /Position Value/);
  assert.match(top, /\$10/);
  assert.doesNotMatch(top, /999/);
});
test('liquidity trader board formats shares with shares units, never currency', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/liquidity/page.tsx'), 'utf8');
  assert.doesNotMatch(source, /formatCurrency\(t\.vol/);
  assert.match(source, /formatShares\(t\.vol/);
  assert.match(source, /Volume \(shares\)/);
});
test('role classification rejects a taker row indexed between the first and second snapshots', async () => {
  let takerReads = 0;
  const row = { proxy_wallet: wallet, side: 'BUY', token_id: '101', condition_id: `0x${'b'.repeat(64)}`, transaction_hash: `0x${'c'.repeat(64)}`, size: 100, price: 0.6, timestamp: 100 };
  mock.method(globalThis, 'fetch', async input => {
    const isTaker = new URL(input).searchParams.get('taker_only') === 'true';
    if (isTaker) takerReads++;
    return Response.json({ data: isTaker && takerReads === 1 ? [] : [row], pagination: { has_more: false, next_cursor: null } });
  });
  const result = await load('src/lib/dataApiFills.ts').fetchRecentMakerFills(wallet, 1);
  assert.equal(result, null);
});
