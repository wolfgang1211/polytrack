/* CommonJS Node test runner with an in-memory TS loader. */
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');

// Compile the actual TS route and local dependencies in memory. Only the
// upstream fetch boundary is mocked; NextResponse and route handling are real.
const cache = new Map();
function loadTs(filename) {
  filename = path.resolve(__dirname, '..', filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loadedModule = { exports: {} };
  cache.set(filename, loadedModule);
  const nativeRequire = createRequire(filename);
  const localRequire = name => name.startsWith('@/')
    ? loadTs(`src/${name.slice(2)}.ts`)
    : nativeRequire(name);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  new Function('exports', 'require', 'module', '__filename', '__dirname', code)(
    loadedModule.exports, localRequire, loadedModule, filename, path.dirname(filename),
  );
  return loadedModule.exports;
}
const { GET } = loadTs('src/app/api/wallet/[address]/route.ts');
const wallet = `0x${'a'.repeat(40)}`;
const otherWallet = `0x${'b'.repeat(40)}`;
// Explicit synthetic contract fixtures, not claimed live market observations.
function row(overrides = {}) {
  return {
    proxy_wallet: wallet, token_id: '101', condition_id: `0x${'c'.repeat(64)}`,
    current_size: 10, avg_price: 0.5, entry_cost_usdc: 5,
    entry_fees_usdc: 0.1, total_cost_usdc: 5.1, current_price: 0.7,
    current_value: 7, total_size: 10, realized_pnl: 1,
    unrealized_pnl: 2, total_pnl: 3, percent_pnl: 40,
    percent_realized_pnl: 20, status: 'OPEN', redeemable: false,
    mergeable: false, negative_risk: false, archived: false,
    title: 'Synthetic test market', slug: 'test-market', icon: '',
    event_id: '1', event_slug: 'test-event', outcome: 'Yes',
    outcome_index: 0, opposite_outcome: 'No', opposite_token_id: '102',
    end_date: '2027-01-01', ...overrides,
  };
}
function page(data = [], next = null) {
  return { data, pagination: { has_more: next !== null, next_cursor: next } };
}
const json = (value, status = 200, headers = {}) => Response.json(value, { status, headers });
function upstream(handler = () => page()) {
  const calls = [];
  mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    const value = await handler(url, init, calls);
    return value instanceof Response ? value : json(value);
  });
  return calls;
}
function normal(url) {
  if (url.pathname.endsWith('/value')) return { data: { proxy_wallet: wallet, value: 7 } };
  return page(url.searchParams.get('status') === 'OPEN' ? [row()] : []);
}
async function invoke(address = wallet) {
  const response = await GET(new Request(`http://localhost/api/wallet/${address}`), {
    params: Promise.resolve({ address }),
  });
  return { response, body: await response.json() };
}
function unavailable(result) {
  assert.equal(result.response.status, 502);
  assert.equal(typeof result.body.error, 'string');
  assert.equal(Object.hasOwn(result.body, 'totalValue'), false);
  assert.equal(Object.hasOwn(result.body, 'positions'), false);
  assert.match(result.response.headers.get('cache-control'), /no-store/);
}
afterEach(() => mock.restoreAll());

test('retired upstream 410 is unavailable, never a successful zero portfolio', async () => {
  upstream(() => json({ error: 'retired; private diagnostic must not leak' }, 410));
  const result = await invoke();
  unavailable(result);
  assert.doesNotMatch(JSON.stringify(result.body), /private diagnostic/);
});

test('positions failure is not returned as an empty successful wallet', async () => {
  upstream(url => url.pathname.endsWith('/value') ? normal(url) : json({}, 503));
  unavailable(await invoke());
});

test('value failure cannot leave a default zero balance', async () => {
  upstream(url => url.pathname.endsWith('/value') ? json({}, 500) : normal(url));
  unavailable(await invoke());
});

test('transport rejection is unavailable', async () => {
  upstream(() => { throw new Error('network failure secret=do-not-return'); });
  const result = await invoke();
  unavailable(result);
  assert.doesNotMatch(JSON.stringify(result.body), /secret/);
});

for (const [name, value] of Object.entries({
  nullEnvelope: null,
  missingData: {},
  nullValue: { data: { proxy_wallet: wallet, value: null } },
  missingValue: { data: { proxy_wallet: wallet } },
  stringValue: { data: { proxy_wallet: wallet, value: '7' } },
  negativeValue: { data: { proxy_wallet: wallet, value: -1 } },
  wrongWallet: { data: { proxy_wallet: otherWallet, value: 7 } },
})) {
  test(`invalid value contract fails closed: ${name}`, async () => {
    upstream(url => url.pathname.endsWith('/value') ? value : normal(url));
    unavailable(await invoke());
  });
}

for (const [name, value] of Object.entries({
  nullData: { data: null, pagination: { has_more: false, next_cursor: null } },
  missingPagination: { data: [] },
  contradictoryCursor: { data: [], pagination: { has_more: true, next_cursor: null } },
  hiddenCursor: { data: [], pagination: { has_more: false, next_cursor: 'next' } },
  malformedRow: page([row({ current_value: null })]),
  missingRealized: page([row({ realized_pnl: undefined })]),
  wrongWallet: page([row({ proxy_wallet: otherWallet })]),
  invalidStatus: page([row({ status: 'UNKNOWN' })]),
  numericToken: page([row({ token_id: 101 })]),
  nonBooleanFlag: page([row({ redeemable: 'false' })]),
})) {
  test(`invalid positions contract fails closed: ${name}`, async () => {
    upstream(url => url.pathname.endsWith('/value') ? normal(url) : value);
    unavailable(await invoke());
  });
}

test('valid v2 values and snake_case positions map into the existing UI contract', async () => {
  const calls = upstream(normal);
  const { response, body } = await invoke();
  assert.equal(response.status, 200);
  assert.equal(body.totalValue, 7);
  assert.equal(body.truncated, false);
  assert.equal(body.positions.length, 1);
  const position = body.positions[0];
  assert.equal(position.asset, '101');
  assert.equal(position.proxyWallet, wallet);
  assert.equal(position.currentValue, 7);
  assert.equal(position.initialValue, 5); // fee-exclusive entry basis, not total_cost_usdc
  assert.equal(position.cashPnl, 2);
  assert.equal(position.realizedPnl, 1);
  assert.equal(position.size, 10);
  assert.equal(position.curPrice, 0.7);
  assert.equal(position.status, 'OPEN');
  assert.ok(calls.every(({ url, init }) => url.origin === 'https://data-api.polymarket.com'
    && url.pathname.startsWith('/v2/') && !url.searchParams.has('offset')
    && init.cache === 'no-store' && init.signal instanceof AbortSignal));
});

test('genuinely empty wallet remains a successful explicit zero', async () => {
  upstream(url => url.pathname.endsWith('/value')
    ? { data: { proxy_wallet: wallet, value: 0 } } : page());
  const { response, body } = await invoke();
  assert.equal(response.status, 200);
  assert.deepEqual(body, { positions: [], totalValue: 0, truncated: false });
});

test('OPEN, redeemable losers and CLOSED history are all requested without dust filtering', async () => {
  const calls = upstream(url => {
    if (url.pathname.endsWith('/value')) return normal(url);
    const status = url.searchParams.get('status');
    if (status === 'OPEN') return page([row()]);
    if (status === 'REDEEMABLE_LOST') return page([row({ token_id: '103', status: 'REDEEMABLE', current_value: 0, current_price: 0, unrealized_pnl: -5 })]);
    if (status === 'CLOSED') return page([row({ token_id: '104', status: 'CLOSED', current_size: 0, current_value: 0 })]);
    throw new Error('Unexpected lifecycle');
  });
  const { response, body } = await invoke();
  assert.equal(response.status, 200);
  assert.equal(body.positions.length, 3);
  const requests = calls.filter(({ url }) => url.pathname.endsWith('/positions'));
  assert.deepEqual(requests.map(({ url }) => url.searchParams.get('status')).sort(), ['CLOSED', 'OPEN', 'REDEEMABLE_LOST']);
  assert.ok(requests.every(({ url }) => url.searchParams.get('user') === wallet
    && url.searchParams.get('filter_type') === 'TOKENS' && url.searchParams.get('filter_amount') === '0'));
});

test('cursor continuation works even for a short first page; filters are preserved', async () => {
  const cursor = 'opaque/+?=cursor';
  const calls = upstream(url => {
    if (url.pathname.endsWith('/value')) return normal(url);
    if (url.searchParams.get('status') !== 'OPEN') return page();
    return url.searchParams.get('cursor') ? page([row({ token_id: '105' })]) : page([row()], cursor);
  });
  const { response, body } = await invoke();
  assert.equal(response.status, 200);
  assert.equal(body.positions.length, 2);
  assert.equal(body.truncated, false);
  const next = calls.find(({ url }) => url.searchParams.has('cursor')).url;
  assert.equal(next.searchParams.get('cursor'), cursor);
  assert.equal(next.searchParams.get('user'), wallet);
  assert.equal(next.searchParams.get('status'), 'OPEN');
  assert.equal(next.searchParams.get('filter_amount'), '0');
});

test('duplicate position identities across pages cannot multiply P&L', async () => {
  upstream(url => {
    if (url.pathname.endsWith('/value')) return normal(url);
    if (url.searchParams.get('status') !== 'OPEN') return page();
    return url.searchParams.get('cursor') ? page([row()]) : page([row()], 'next');
  });
  const { response, body } = await invoke();
  assert.equal(response.status, 200);
  assert.equal(body.positions.length, 1);
});

test('later page failure cannot be represented as a complete partial wallet', async () => {
  upstream(url => {
    if (url.pathname.endsWith('/value')) return normal(url);
    if (url.searchParams.get('status') !== 'OPEN') return page();
    return url.searchParams.get('cursor') ? json({}, 503) : page([row()], 'next');
  });
  unavailable(await invoke());
});

test('repeated cursor fails closed rather than looping or silently returning partial history', async () => {
  upstream(url => url.pathname.endsWith('/value') ? normal(url)
    : url.searchParams.get('status') === 'OPEN' ? page([row()], 'same') : page());
  unavailable(await invoke());
});

test('bounded pagination flags remaining history and still requests each lifecycle', async () => {
  const calls = upstream(url => {
    if (url.pathname.endsWith('/value')) return normal(url);
    if (url.searchParams.get('status') !== 'OPEN') return page();
    return page([row({ token_id: url.searchParams.has('cursor') ? '105' : '101' })], url.searchParams.has('cursor') ? 'page3' : 'page2');
  });
  const { response, body } = await invoke();
  assert.equal(response.status, 200);
  assert.equal(body.truncated, true);
  assert.equal(calls.filter(({ url }) => url.searchParams.get('status') === 'OPEN').length, 2);
  assert.ok(calls.some(({ url }) => url.searchParams.get('status') === 'CLOSED'));
});

test('upstream rate limiting becomes unavailable with bounded retry guidance', async () => {
  upstream(() => json({ error: 'rate limited' }, 429, { 'Retry-After': '60' }));
  const { response, body } = await invoke();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.equal(Object.hasOwn(body, 'totalValue'), false);
});

for (const address of ['invalid', '0x123', `${wallet}&user=${otherWallet}`]) {
  test(`invalid address rejected before upstream calls: ${address}`, async () => {
    const calls = upstream(normal);
    const { response } = await invoke(address);
    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
  });
}

test('lifecycle P&L preserves zero-mark holdings and does not double-count closed basis', () => {
  const { positionPnl, isPositionOpen } = loadTs('src/lib/utils.ts');
  const lost = { status: 'REDEEMABLE', currentValue: 0, curPrice: 0, cashPnl: -5, realizedPnl: 0 };
  assert.equal(isPositionOpen(lost), true);
  assert.equal(positionPnl(lost), -5);
  assert.equal(positionPnl({ ...lost, status: 'CLOSED', realizedPnl: -5 }), -5);
  assert.equal(positionPnl({ currentValue: 7, cashPnl: 2, realizedPnl: 1 }), 3);
  assert.equal(positionPnl({ currentValue: 0, cashPnl: -5, realizedPnl: 4 }), 4);
});
