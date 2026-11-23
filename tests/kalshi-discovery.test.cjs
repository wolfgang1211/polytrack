/* RED-first tests for read-only Kalshi DISCOVERY: activity-seeded (recent public trades -> whitelisted open markets ->
   event groups). NOT a global ranking: GET /markets is newest-first and has no volume sort, so discovery is a bounded
   SAMPLE of recent trades. Adapter (src/lib/kalshiDiscovery.ts), API route and the server-rendered /markets page are
   transpiled from the real TypeScript sources; global fetch is mocked. Every fixture is SYNTHETIC, never a live result.
   Expected to fail until kalshiDiscovery.ts, api/kalshi/discovery/route.ts and view=discover exist. */
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '..');
const BASE = 'https://external-api.kalshi.com/trade-api/v2';
const AUTH_HEADERS = ['authorization', 'cookie', 'kalshi-access-key', 'kalshi-access-signature', 'kalshi-access-timestamp'];
const SECRET = 'UPSTREAM-SECRET-BODY-must-not-leak';
const P = { trades: '/trade-api/v2/markets/trades', markets: '/trade-api/v2/markets', eventPrefix: '/trade-api/v2/events/' };

// Per-loader global shadow owning the Discover cache slot, so one test's process cache never leaks into another.
const DISCOVERY_CACHE_SLOT = Symbol.for('alphaboard.kalshi.discovery-cache.v1');
function makeLoader(mocks = {}) {
  const shadow = Object.create(globalThis);
  Object.defineProperty(shadow, DISCOVERY_CACHE_SLOT, { value: undefined, writable: true, configurable: true });
  const cache = new Map();
  const resolve = p => ['', '.tsx', '.ts'].map(ext => p + ext).find(f => fs.existsSync(f) && fs.statSync(f).isFile()) ?? p;
  function load(file) {
    file = resolve(path.resolve(root, file));
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} };
    cache.set(file, mod);
    const req = name => {
      if (name in mocks) return mocks[name];
      if (name.startsWith('@/')) return load(path.join(root, 'src', name.slice(2)));
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
      return require(name);
    };
    const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    new Function('exports', 'require', 'module', '__filename', '__dirname', 'globalThis', out)(mod.exports, req, mod, file, path.dirname(file), shadow);
    return mod.exports;
  }
  return load;
}
const load = makeLoader();
// Lazy so each test fails on its own while the implementation is missing.
const K = () => load('src/lib/kalshi.ts');
const E = () => load('src/lib/kalshiEvents.ts');
const D = () => load('src/lib/kalshiDiscovery.ts');
const ROUTE = 'src/app/api/kalshi/discovery/route.ts';
const kerr = status => e => e instanceof K().KalshiError && e.status === status;

// ---------- SYNTHETIC fixtures (shapes mirror observed live samples; values invented) ----------
let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
// Microsecond ISO like the live created_time; relative to now so it falls inside the frozen 24h window.
const isoAgo = s => new Date(Date.now() - s * 1000).toISOString().replace('Z', '456Z');
const rawTrade = (ticker, o = {}) => ({
  trade_id: uuid(), ticker, created_time: isoAgo(60), count_fp: '1.00',
  yes_price_dollars: '0.5000', no_price_dollars: '0.5000', taker_side: 'yes', ...o,
});
const evtOf = t => t.replace(/-T\d+$/, '');
const rawMarket = (ticker, o = {}) => ({
  ticker, event_ticker: evtOf(ticker), title: `Market ${ticker}`, yes_sub_title: 'Yes', no_sub_title: 'No',
  status: 'active', market_type: 'binary', close_time: '2099-12-31T00:00:00Z', updated_time: '2026-11-01T00:00:00Z',
  volume_24h_fp: '10.00', volume_fp: '100.00', open_interest_fp: '5.00',
  yes_bid_dollars: '0.4100', yes_ask_dollars: '0.4300', yes_bid_size_fp: '150.00', yes_ask_size_fp: '75.50',
  notional_value_dollars: '1.0000', ...o,
});
const rawEvent = (eventTicker, o = {}) => ({
  event_ticker: eventTicker, series_ticker: eventTicker.split('-')[0], title: `Synthetic title ${eventTicker}`,
  sub_title: 'Synthetic sub', category: 'Synthetic Category', mutually_exclusive: false,
  last_updated_ts: '2026-11-01T00:00:00Z', strike_date: '2099-12-31T00:00:00Z', ...o,
});

const tickersOf = url => (url.searchParams.get('tickers') ?? '').split(',').filter(Boolean);
const echoMarkets = (over = {}) => url => ({ markets: tickersOf(url).map(t => rawMarket(t, over[t])), cursor: '' });
const tradesOf = (...tickers) => () => ({ trades: tickers.map(t => rawTrade(t)), cursor: '' });
const eventTickerOf = url => decodeURIComponent(url.pathname.slice(P.eventPrefix.length));
const okEvent = url => ({ event: rawEvent(eventTickerOf(url)) });
// Routes upstream by path: trades sample, whitelisted market batch, single event metadata.
const kalshi = ({ trades = tradesOf(), markets = echoMarkets(), event = okEvent } = {}) => url =>
  url.pathname === P.trades ? trades(url)
    : url.pathname === P.markets ? markets(url)
      : url.pathname.startsWith(P.eventPrefix) ? event(url) : new Response('unexpected path', { status: 500 });

function upstream(fn) {
  const calls = [];
  mock.method(globalThis, 'fetch', async (input, init) => {
    const href = typeof input === 'string' ? input : (input?.url ?? String(input));
    const url = new URL(href);
    calls.push({ href, url, init });
    const result = await fn(url, init);
    return result instanceof Response ? result : Response.json(result);
  });
  return calls;
}
const byKind = calls => ({
  trades: calls.filter(c => c.url.pathname === P.trades),
  markets: calls.filter(c => c.url.pathname === P.markets),
  events: calls.filter(c => c.url.pathname.startsWith(P.eventPrefix)),
});
function assertSafeCalls(calls) {
  for (const { href, init } of calls) {
    assert.ok(href.startsWith(`${BASE}/`), `unexpected host/path: ${href}`);
    assert.ok(init?.method === undefined || init.method === 'GET', 'only GET is allowed');
    const headers = new Headers(init?.headers ?? {});
    for (const name of AUTH_HEADERS) assert.equal(headers.has(name), false, `auth header sent: ${name}`);
    assert.ok(init?.signal instanceof AbortSignal, 'every request needs a timeout signal');
    assert.equal(init?.redirect, 'error');
  }
}
const keys = o => Object.keys(o).sort();
const noStore = res => assert.match(res.headers.get('cache-control') ?? '', /no-store/);
const COVERAGE_KEYS = ['eventMetadataFailed', 'eventMetadataRequested', 'marketPages', 'moreTradesAvailable', 'newestTradeAt',
  'oldestTradeAt', 'rejectedMarkets', 'rejectedTrades', 'selectedTickers', 'tradePages', 'tradesScanned', 'truncated',
  'uniqueTickers', 'windowEnd', 'windowStart'];

async function invokeRoute(search = '') {
  // Fresh module instance per call: the route's 20 s process cache must not carry one test's success into another.
  const res = await makeLoader()(ROUTE).GET(new Request(`http://localhost/api/kalshi/discovery${search}`));
  return { res, body: await res.json() };
}

// ---------- page rendering helpers ----------
const nextMocks = () => ({
  'next/link': { __esModule: true, default: ({ href, children, ...rest }) => {
    delete rest.prefetch;
    return React.createElement('a', { href, ...rest }, children);
  } },
  'next/navigation': { notFound: () => { throw new Error('NEXT_NOT_FOUND'); } },
  '@/lib/markets': { fetchMarketsList: async () => [] },
  './MarketsClient': { __esModule: true, default: () => React.createElement('div', { 'data-stub': 'polymarket-client' }) },
});
async function renderMarkets(searchParams) {
  const Page = makeLoader(nextMocks())('src/app/markets/page.tsx').default;
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(searchParams) }));
}
const attrs = s => Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2].replace(/&amp;/g, '&')]));
const anchors = html => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(m => ({ ...attrs(m[1]), text: m[2].replace(/<[^>]+>/g, '').trim() }));
const anchor = (html, text) => { const a = anchors(html).find(x => x.text === text); assert.ok(a, `link "${text}" not rendered`); return a; };
const labeled = (label, value) => new RegExp(`${label}(?:\\s|:|<[^>]*>)*${value}(?=\\s*<)`, 'i');
const DISCOVER_HREF = '/markets?platform=kalshi&view=discover';
afterEach(() => mock.restoreAll());

// ======================= adapter: bounds & shape =======================
test('discovery exposes its fixed budget as constants', () => {
  const d = D();
  assert.deepEqual(
    [d.WINDOW_SECONDS, d.MAX_TRADE_PAGES, d.TRADE_PAGE_LIMIT, d.MAX_SEED_TICKERS, d.MARKET_BATCH_SIZE,
      d.MAX_MARKET_PAGES_PER_BATCH, d.MAX_EVENT_ENRICHMENTS, d.EVENT_CONCURRENCY],
    [86400, 3, 1000, 80, 40, 2, 20, 4],
  );
  assert.equal(typeof d.fetchKalshiDiscovery, 'function');
  assert.equal(typeof d.isDiscoveryPage, 'function');
});

test('fetchKalshiDiscovery returns exactly {groups, receivedAt, sourceAsOf:null, coverage} with explicit coverage keys', async () => {
  const calls = upstream(kalshi({ trades: tradesOf('KXA-E1-T1', 'KXA-E1-T2', 'KXB-E1-T1') }));
  const before = Date.now();
  const r = await D().fetchKalshiDiscovery();
  assertSafeCalls(calls);
  assert.deepEqual(keys(r), ['coverage', 'groups', 'receivedAt', 'sourceAsOf']);
  assert.deepEqual(keys(r.coverage), COVERAGE_KEYS);
  assert.equal(r.sourceAsOf, null);
  assert.ok(Date.parse(r.receivedAt) >= before - 1000 && /T.*Z$/.test(r.receivedAt));
  for (const g of r.groups) assert.deepEqual(keys(g), ['event', 'eventTicker', 'markets', 'metadataStatus']);
  assert.deepEqual(r.groups.map(g => g.eventTicker).sort(), ['KXA-E1', 'KXB-E1']);
  assert.equal(D().isDiscoveryPage(r), true);
  // Sample, not catalog: no global totals / ranks / summed metrics anywhere in the payload.
  assert.doesNotMatch(JSON.stringify(r), /global|total(?!VolumeContracts)|sum|rank/i);
});

// ======================= trade seed =======================
test('trade seed: fixed path, limit 1000, one frozen 24h window across pages, literal cursor, no other params', async () => {
  const calls = upstream(kalshi({
    trades: url => (url.searchParams.has('cursor')
      ? { trades: [rawTrade('KXB-E1-T1')], cursor: '' }
      : { trades: [rawTrade('KXA-E1-T1')], cursor: 'a+b/c=d&e==' }),
  }));
  const before = Math.floor(Date.now() / 1000);
  const r = await D().fetchKalshiDiscovery();
  const after = Math.ceil(Date.now() / 1000);
  const { trades } = byKind(calls);
  assertSafeCalls(calls);
  assert.equal(trades.length, 2);
  assert.deepEqual(keys(Object.fromEntries(trades[0].url.searchParams)), ['limit', 'max_ts', 'min_ts']);
  assert.deepEqual(keys(Object.fromEntries(trades[1].url.searchParams)), ['cursor', 'limit', 'max_ts', 'min_ts']);
  assert.equal(trades[1].url.searchParams.get('cursor'), 'a+b/c=d&e==');
  assert.equal(trades[1].url.searchParams.has('e'), false);
  const [maxA, minA] = ['max_ts', 'min_ts'].map(k => trades[0].url.searchParams.get(k));
  for (const t of trades) {
    assert.equal(t.url.searchParams.get('limit'), '1000');
    assert.equal(t.url.searchParams.get('max_ts'), maxA, 'max_ts frozen across pages');
    assert.equal(t.url.searchParams.get('min_ts'), minA, 'min_ts frozen across pages');
  }
  assert.match(maxA, /^\d+$/);
  assert.ok(Number(maxA) >= before && Number(maxA) <= after);
  assert.equal(Number(maxA) - Number(minA), 86400);
  assert.equal(Date.parse(r.coverage.windowEnd) / 1000, Number(maxA));
  assert.equal(Date.parse(r.coverage.windowStart) / 1000, Number(minA));
  assert.equal(r.coverage.tradePages, 2);
  assert.equal(r.coverage.moreTradesAvailable, false);
});

test('trade rows: invalid, out-of-window and duplicate trade_id are quarantined; injected tickers never reach upstream', async () => {
  const dup = rawTrade('KXA-E1-T1');
  const valid = [dup, rawTrade('KXA-E1-T1'), rawTrade('KXB-E1-T1')];
  const invalid = [
    rawTrade(undefined), rawTrade('kxa-lower'), rawTrade('KXA-E1-T1,KXEVIL-1-T1'), rawTrade('../KXA'), rawTrade(42),
    rawTrade('KXA-E1-T1', { trade_id: '' }), rawTrade('KXA-E1-T1', { trade_id: 12345 }), rawTrade('KXA-E1-T1', { trade_id: 'x'.repeat(200) }),
    rawTrade('KXA-E1-T1', { created_time: 'yesterday' }), rawTrade('KXA-E1-T1', { created_time: '2026-11-19T10:00:00' }),
    rawTrade('KXOLD-E1-T1', { created_time: isoAgo(2 * 86400) }), rawTrade('KXFUT-E1-T1', { created_time: isoAgo(-3600) }),
    null, [rawTrade('KXA-E1-T1')], 'KXA-E1-T1',
  ];
  const calls = upstream(kalshi({ trades: () => ({ trades: [...valid, ...invalid, { ...dup }], cursor: '' }) }));
  const r = await D().fetchKalshiDiscovery();
  assert.equal(r.coverage.tradesScanned, 3);
  assert.equal(r.coverage.rejectedTrades, invalid.length + 1);
  assert.equal(r.coverage.uniqueTickers, 2);
  const sent = byKind(calls).markets.flatMap(c => tickersOf(c.url));
  assert.deepEqual(sent.sort(), ['KXA-E1-T1', 'KXB-E1-T1']);
  for (const c of calls) assert.doesNotMatch(c.href, /KXEVIL|KXOLD|KXFUT|kxa-lower/);
});

test('oldestTradeAt/newestTradeAt are the exact source strings of valid scanned trades', async () => {
  const newest = isoAgo(10), oldest = isoAgo(5000);
  upstream(kalshi({ trades: () => ({
    trades: [rawTrade('KXA-E1-T1', { created_time: isoAgo(100) }), rawTrade('KXA-E1-T1', { created_time: newest }),
      rawTrade('KXB-E1-T1', { created_time: oldest }), rawTrade('KXB-E1-T1', { created_time: 'bad' })],
    cursor: '',
  }) }));
  const r = await D().fetchKalshiDiscovery();
  assert.equal(r.coverage.newestTradeAt, newest);
  assert.equal(r.coverage.oldestTradeAt, oldest);
});

test('malformed trade envelope or unusable trade cursor (incl. null and missing) is a 502, never an empty sample', async () => {
  for (const [label, body] of [
    ['no trades', { cursor: '' }], ['trades null', { trades: null, cursor: '' }], ['trades object', { trades: {}, cursor: '' }],
    ['array body', [rawTrade('KXA-E1-T1')]], ['string body', 'text'],
    ['cursor missing', { trades: [] }], ['cursor null', { trades: [], cursor: null }], ['cursor numeric', { trades: [], cursor: 7 }],
    ['cursor control char', { trades: [], cursor: 'a\u0001b' }], ['cursor oversized', { trades: [], cursor: 'x'.repeat(513) }],
  ]) {
    mock.restoreAll();
    const calls = upstream(kalshi({ trades: () => Response.json(body) }));
    await assert.rejects(D().fetchKalshiDiscovery(), kerr(502), label);
    assert.equal(byKind(calls).markets.length, 0, label);
  }
});

test('a trade page that hands back an already-used cursor is detected as a 502 loop', async () => {
  const calls = upstream(kalshi({ trades: () => ({ trades: [rawTrade('KXA-E1-T1')], cursor: 'c1' }) }));
  await assert.rejects(D().fetchKalshiDiscovery(), kerr(502));
  assert.equal(byKind(calls).trades.length, 2);
  assert.equal(byKind(calls).markets.length, 0);
});

test('trade pagination stops at 3 pages and reports moreTradesAvailable explicitly', async () => {
  let n = 0;
  const calls = upstream(kalshi({ trades: () => ({ trades: [rawTrade('KXA-E1-T1')], cursor: `c${++n}` }) }));
  const r = await D().fetchKalshiDiscovery();
  assert.equal(byKind(calls).trades.length, 3);
  assert.equal(r.coverage.tradePages, 3);
  assert.equal(r.coverage.moreTradesAvailable, true);
});

test('a failed later trade page fails the whole discovery (no partial success), with mapped status', async () => {
  for (const [respond, status] of [
    [() => new Response(SECRET, { status: 500 }), 502], [() => new Response(SECRET, { status: 429 }), 503],
    [() => { throw new DOMException('timed out', 'TimeoutError'); }, 504],
  ]) {
    mock.restoreAll();
    const calls = upstream(kalshi({
      trades: url => (url.searchParams.has('cursor') ? respond() : { trades: [rawTrade('KXA-E1-T1')], cursor: 'c1' }),
    }));
    await assert.rejects(D().fetchKalshiDiscovery(), kerr(status));
    assert.equal(byKind(calls).markets.length, 0);
  }
});

test('seed cap: at most 80 tickers, chosen by sample trade count desc then ticker asc, batched <=40, truncated flagged', async () => {
  const t = i => `KXS-E${String(i).padStart(2, '0')}-T1`;
  const rows = [];
  for (let i = 0; i < 85; i++) for (let k = 0; k < (i >= 80 ? 3 : 1); k++) rows.push(rawTrade(t(i)));
  const calls = upstream(kalshi({ trades: () => ({ trades: rows, cursor: '' }) }));
  const r = await D().fetchKalshiDiscovery();
  const batches = byKind(calls).markets.map(c => tickersOf(c.url));
  assert.equal(batches.length, 2);
  for (const b of batches) assert.ok(b.length <= 40, `batch of ${b.length}`);
  const expected = [...Array(75).keys(), 80, 81, 82, 83, 84].map(t).sort();
  assert.deepEqual(batches.flat().sort(), expected);
  assert.deepEqual([r.coverage.uniqueTickers, r.coverage.selectedTickers, r.coverage.truncated], [85, 80, true]);
});

// ======================= whitelisted market fetch =======================
test('market batch request: fixed path with exactly tickers, status=open, mve_filter=exclude, limit=200', async () => {
  const calls = upstream(kalshi({ trades: tradesOf('KXA-E1-T1', 'KXB-E1-T1') }));
  await D().fetchKalshiDiscovery();
  const [m] = byKind(calls).markets;
  assert.deepEqual(keys(Object.fromEntries(m.url.searchParams)), ['limit', 'mve_filter', 'status', 'tickers']);
  assert.deepEqual([m.url.searchParams.get('status'), m.url.searchParams.get('mve_filter'), m.url.searchParams.get('limit')], ['open', 'exclude', '200']);
  assert.deepEqual(tickersOf(m.url).sort(), ['KXA-E1-T1', 'KXB-E1-T1']);
});

test('market rows: foreign, closed, unsupported, expired, malformed and duplicate rows are quarantined; missing tickers stay absent', async () => {
  const seeded = ['KXA-E1-T1', 'KXA-E1-T2', 'KXA-E1-T3', 'KXA-E1-T4', 'KXA-E1-T5', 'KXA-E1-T6', 'KXM-E1-T1'];
  upstream(kalshi({
    trades: tradesOf(...seeded),
    markets: () => ({ markets: [
      rawMarket('KXA-E1-T1'), rawMarket('KXA-E1-T1'), rawMarket('KXA-E1-T2', { status: 'closed' }),
      rawMarket('KXA-E1-T3', { market_type: 'scalar' }), rawMarket('KXA-E1-T4', { notional_value_dollars: '100.0000' }),
      rawMarket('KXA-E1-T5', { close_time: '2020-01-01T00:00:00Z' }), rawMarket('KXA-E1-T6', { ticker: 'kxa-lower' }),
      rawMarket('KXZ-E1-T1'), null,
    ], cursor: '' }),
  }));
  const r = await D().fetchKalshiDiscovery();
  assert.equal(r.coverage.rejectedMarkets, 8);
  assert.deepEqual(r.groups.map(g => g.eventTicker), ['KXA-E1']);
  assert.deepEqual(r.groups[0].markets, [K().normalizeMarket(rawMarket('KXA-E1-T1'))]);
  assert.doesNotMatch(JSON.stringify(r.groups), /KXZ-E1|KXM-E1/);
});

test('malformed market envelope or unusable market cursor (incl. null and missing) is a 502', async () => {
  for (const [label, body] of [
    ['no markets', { cursor: '' }], ['markets null', { markets: null, cursor: '' }], ['array body', []],
    ['cursor missing', { markets: [] }], ['cursor null', { markets: [], cursor: null }], ['cursor numeric', { markets: [], cursor: 1 }],
  ]) {
    mock.restoreAll();
    upstream(kalshi({ trades: tradesOf('KXA-E1-T1'), markets: () => Response.json(body) }));
    await assert.rejects(D().fetchKalshiDiscovery(), kerr(502), label);
  }
});

test('market paging: follows the cursor with identical tickers, caps at 2 pages as explicit partial, detects a repeated cursor', async () => {
  const page2 = cursor => url => (url.searchParams.has('cursor')
    ? { markets: [rawMarket('KXB-E1-T1')], cursor }
    : { markets: [rawMarket('KXA-E1-T1')], cursor: 'm1' });
  let calls = upstream(kalshi({ trades: tradesOf('KXA-E1-T1', 'KXB-E1-T1'), markets: page2('') }));
  let r = await D().fetchKalshiDiscovery();
  const [p1, p2] = byKind(calls).markets;
  assert.equal(p2.url.searchParams.get('cursor'), 'm1');
  assert.deepEqual(tickersOf(p2.url), tickersOf(p1.url));
  assert.deepEqual([r.coverage.marketPages, r.coverage.truncated], [2, false]);
  assert.deepEqual(r.groups.map(g => g.eventTicker).sort(), ['KXA-E1', 'KXB-E1']);
  mock.restoreAll();
  calls = upstream(kalshi({ trades: tradesOf('KXA-E1-T1', 'KXB-E1-T1'), markets: page2('m2') }));
  r = await D().fetchKalshiDiscovery();
  assert.equal(byKind(calls).markets.length, 2);
  assert.equal(r.coverage.truncated, true);
  mock.restoreAll();
  upstream(kalshi({ trades: tradesOf('KXA-E1-T1', 'KXB-E1-T1'), markets: page2('m1') }));
  await assert.rejects(D().fetchKalshiDiscovery(), kerr(502));
});

test('a failed later market batch fails the whole discovery instead of returning partial groups', async () => {
  const tickers = Array.from({ length: 50 }, (_, i) => `KXF-E${String(i).padStart(2, '0')}-T1`);
  let n = 0;
  upstream(kalshi({
    trades: tradesOf(...tickers),
    markets: url => (++n === 2 ? new Response(SECRET, { status: 500 }) : echoMarkets()(url)),
  }));
  await assert.rejects(D().fetchKalshiDiscovery(), kerr(502));
});

// ======================= grouping, ranking, metadata =======================
test('groups rank by best known 24h contract volume (null last, ties by ticker); zero stays 0; no summed metric', async () => {
  upstream(kalshi({
    trades: tradesOf('KXA-E1-T1', 'KXA-E1-T2', 'KXA-E1-T3', 'KXB-E1-T1', 'KXC-E1-T1', 'KXD-E1-T1'),
    markets: echoMarkets({
      'KXA-E1-T1': { volume_24h_fp: '50.00' }, 'KXA-E1-T2': { volume_24h_fp: undefined }, 'KXA-E1-T3': { volume_24h_fp: '50.00' },
      'KXB-E1-T1': { volume_24h_fp: '0.00' }, 'KXC-E1-T1': { volume_24h_fp: '50.00' }, 'KXD-E1-T1': { volume_24h_fp: 'n/a' },
    }),
  }));
  const r = await D().fetchKalshiDiscovery();
  assert.deepEqual(r.groups.map(g => g.eventTicker), ['KXA-E1', 'KXC-E1', 'KXB-E1', 'KXD-E1']);
  assert.deepEqual(r.groups[0].markets.map(m => m.ticker), ['KXA-E1-T1', 'KXA-E1-T3', 'KXA-E1-T2']);
  assert.equal(r.groups[0].markets[2].volume24hContracts, null);
  assert.equal(r.groups[2].markets[0].volume24hContracts, 0);
  assert.equal(r.groups[3].markets[0].volume24hContracts, null);
  for (const g of r.groups) assert.deepEqual(keys(g), ['event', 'eventTicker', 'markets', 'metadataStatus']);
});

test('event metadata: exclude_markets=true, category kept as published, bound only to its own group', async () => {
  const calls = upstream(kalshi({
    trades: tradesOf('KXA-E1-T1', 'KXB-E1-T1'),
    event: url => ({ event: rawEvent(eventTickerOf(url), { category: eventTickerOf(url) === 'KXA-E1' ? 'Science and Technology' : 'Politics' }) }),
  }));
  const r = await D().fetchKalshiDiscovery();
  const ev = byKind(calls).events;
  assert.deepEqual(ev.map(c => c.url.pathname).sort(), [`${P.eventPrefix}KXA-E1`, `${P.eventPrefix}KXB-E1`]);
  for (const c of ev) assert.equal(c.url.searchParams.get('exclude_markets'), 'true');
  const a = r.groups.find(g => g.eventTicker === 'KXA-E1');
  assert.equal(a.metadataStatus, 'loaded');
  assert.deepEqual(a.event, E().normalizeEvent(rawEvent('KXA-E1', { category: 'Science and Technology' })));
  for (const g of r.groups) assert.equal(g.event.eventTicker, g.eventTicker);
  assert.deepEqual([r.coverage.eventMetadataRequested, r.coverage.eventMetadataFailed], [2, 0]);
});

test('per-event metadata failure (500, 404, wrong event, malformed) keeps markets with event:null and no fabricated title', async () => {
  upstream(kalshi({
    trades: tradesOf('KXA-E1-T1', 'KXB-E1-T1', 'KXC-E1-T1', 'KXD-E1-T1', 'KXE-E1-T1'),
    event: url => ({
      'KXA-E1': () => new Response(SECRET, { status: 500 }),
      'KXB-E1': () => ({ event: rawEvent('KXB-OTHER') }),
      'KXC-E1': () => new Response(SECRET, { status: 404 }),
      'KXD-E1': () => ({ event: rawEvent('KXD-E1', { title: '' }) }),
    }[eventTickerOf(url)] ?? (() => okEvent(url)))(),
  }));
  const r = await D().fetchKalshiDiscovery();
  assert.equal(r.groups.length, 5);
  for (const t of ['KXA-E1', 'KXB-E1', 'KXC-E1', 'KXD-E1']) {
    const g = r.groups.find(x => x.eventTicker === t);
    assert.deepEqual([g.event, g.metadataStatus, g.markets.length], [null, 'unavailable', 1], t);
  }
  assert.equal(r.groups.find(g => g.eventTicker === 'KXE-E1').metadataStatus, 'loaded');
  assert.equal(r.coverage.eventMetadataFailed, 4);
  assert.doesNotMatch(JSON.stringify(r), /KXB-OTHER|UPSTREAM-SECRET/);
});

test('metadata enrichment: only the top 20 ranked groups, at most 4 in flight; the rest are not_requested', async () => {
  const t = i => `KXC${String(i).padStart(2, '0')}-E1-T1`;
  const tickers = Array.from({ length: 25 }, (_, i) => t(i));
  let inFlight = 0, peak = 0;
  const calls = upstream(kalshi({
    trades: tradesOf(...tickers),
    markets: echoMarkets(Object.fromEntries(tickers.map((x, i) => [x, { volume_24h_fp: `${100 - i}.00` }]))),
    event: async url => {
      peak = Math.max(peak, ++inFlight);
      await new Promise(res => setTimeout(res, 5));
      inFlight--;
      return okEvent(url);
    },
  }));
  const r = await D().fetchKalshiDiscovery();
  const requested = byKind(calls).events.map(c => eventTickerOf(c.url)).sort();
  assert.deepEqual(requested, tickers.slice(0, 20).map(evtOf).sort());
  assert.ok(peak <= 4, `peak concurrency ${peak}`);
  assert.equal(r.groups.length, 25, 'every selected listable market is grouped');
  for (const g of r.groups.slice(20)) assert.deepEqual([g.event, g.metadataStatus], [null, 'not_requested']);
  assert.equal(r.coverage.eventMetadataRequested, 20);
});

test('worst case stays inside the fixed request budget (3 trade + 4 market + 20 event = 27)', async () => {
  let page = 0;
  const calls = upstream(kalshi({
    trades: () => { const p = page++; return { trades: Array.from({ length: 40 }, (_, i) => rawTrade(`KXW${p}-E${String(i).padStart(2, '0')}-T1`)), cursor: `t${p}` }; },
    markets: url => (url.searchParams.has('cursor')
      ? { markets: [], cursor: `m2-${tickersOf(url)[0]}` }
      : { markets: tickersOf(url).map(x => rawMarket(x)), cursor: `m1-${tickersOf(url)[0]}` }),
  }));
  const r = await D().fetchKalshiDiscovery();
  const k = byKind(calls);
  assert.deepEqual([k.trades.length, k.markets.length, k.events.length, calls.length], [3, 4, 20, 27]);
  assert.deepEqual([r.coverage.uniqueTickers, r.coverage.selectedTickers, r.coverage.marketPages], [120, 80, 4]);
  assert.deepEqual([r.coverage.moreTradesAvailable, r.coverage.truncated], [true, true]);
});

test('empty or fully rejected trade sample is an explicit empty result with zero market/event requests', async () => {
  for (const rows of [[], [rawTrade('kx-bad'), rawTrade('KXA-E1-T1', { created_time: 'nope' })]]) {
    mock.restoreAll();
    const calls = upstream(kalshi({ trades: () => ({ trades: rows, cursor: '' }) }));
    const r = await D().fetchKalshiDiscovery();
    assert.equal(calls.length, 1);
    assert.deepEqual(r.groups, []);
    const c = r.coverage;
    assert.deepEqual([c.tradesScanned, c.rejectedTrades, c.uniqueTickers, c.selectedTickers, c.marketPages, c.oldestTradeAt, c.newestTradeAt],
      [0, rows.length, 0, 0, 0, null, null]);
    assert.equal(D().isDiscoveryPage(r), true);
  }
});

test('oversized trade pages fail closed before processing rows', async () => {
  const calls = upstream(kalshi({ trades: () => ({ trades: Array.from({ length: 1001 }, () => rawTrade('KXA-E1-T1')), cursor: '' }) }));
  await assert.rejects(D().fetchKalshiDiscovery(), kerr(502));
  assert.equal(byKind(calls).markets.length, 0);
});

test('oversized market pages fail closed before processing rows', async () => {
  const calls = upstream(kalshi({ trades: tradesOf('KXA-E1-T1'), markets: () => ({ markets: Array.from({ length: 201 }, () => rawMarket('KXA-E1-T1')), cursor: '' }) }));
  await assert.rejects(D().fetchKalshiDiscovery(), kerr(502));
  assert.equal(byKind(calls).events.length, 0);
});

// ======================= client guard =======================
test('isDiscoveryPage accepts only a fully formed, self-consistent page', () => {
  const m = K().normalizeMarket(rawMarket('KXA-E1-T1'));
  const ev = E().normalizeEvent(rawEvent('KXA-E1'));
  const coverage = {
    tradePages: 1, tradesScanned: 1, rejectedTrades: 0, uniqueTickers: 1, selectedTickers: 1, moreTradesAvailable: false,
    oldestTradeAt: '2026-11-19T09:59:00.123456Z', newestTradeAt: '2026-11-19T09:59:00.123456Z', marketPages: 1, rejectedMarkets: 0,
    eventMetadataRequested: 1, eventMetadataFailed: 0, truncated: false,
    windowStart: '2026-11-18T10:00:00.000Z', windowEnd: '2026-11-19T10:00:00.000Z',
  };
  const group = { eventTicker: 'KXA-E1', event: ev, metadataStatus: 'loaded', markets: [m] };
  const good = { groups: [group], receivedAt: '2026-11-19T10:00:01.000Z', sourceAsOf: null, coverage };
  const isPage = D().isDiscoveryPage;
  assert.equal(isPage(good), true);
  assert.equal(isPage({ ...good, groups: [{ ...group, event: null, metadataStatus: 'unavailable' }] }), true);
  assert.equal(isPage({ ...good, groups: [{ ...group, event: null, metadataStatus: 'not_requested' }] }), true);
  const noScanned = { ...coverage };
  delete noScanned.tradesScanned;
  for (const [label, v] of [
    ['null', null], ['groups not array', { ...good, groups: {} }], ['sourceAsOf set', { ...good, sourceAsOf: good.receivedAt }],
    ['bad receivedAt', { ...good, receivedAt: 'now' }], ['missing coverage key', { ...good, coverage: noScanned }],
    ['negative count', { ...good, coverage: { ...coverage, rejectedTrades: -1 } }],
    ['fractional count', { ...good, coverage: { ...coverage, marketPages: 1.5 } }],
    ['string boolean', { ...good, coverage: { ...coverage, truncated: 'false' } }],
    ['bad trade time', { ...good, coverage: { ...coverage, newestTradeAt: 'soon' } }],
    ['selected > unique', { ...good, coverage: { ...coverage, selectedTickers: 2 } }],
    ['wrong-event metadata bound', { ...good, groups: [{ ...group, event: { ...ev, eventTicker: 'KXB-E1' } }] }],
    ['foreign market in group', { ...good, groups: [{ ...group, markets: [{ ...m, eventTicker: 'KXB-E1' }] }] }],
    ['loaded without event', { ...good, groups: [{ ...group, event: null }] }],
    ['unavailable with event', { ...good, groups: [{ ...group, metadataStatus: 'unavailable' }] }],
    ['unknown metadataStatus', { ...good, groups: [{ ...group, metadataStatus: 'guessed' }] }],
    ['malformed market', { ...good, groups: [{ ...group, markets: [{ ...m, volume24hContracts: '10' }] }] }],
    ['duplicate group', { ...good, groups: [group, group] }],
  ]) assert.equal(isPage(v), false, label);
});

// ======================= route =======================
test('discovery route exports only GET (runtime answers other methods with 405)', () => {
  const mod = load(ROUTE);
  assert.equal(typeof mod.GET, 'function');
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(mod[m], undefined, m);
});

test('discovery route: query-free GET on a plain Request returns a guarded page with explicit no-store', async () => {
  const calls = upstream(kalshi({ trades: tradesOf('KXA-E1-T1') }));
  const { res, body } = await invokeRoute();
  assert.equal(res.status, 200);
  assertSafeCalls(calls);
  assert.equal(D().isDiscoveryPage(body), true);
  noStore(res);
});

test('discovery route rejects ANY query (unknown, repeated, empty key) with a no-store 400 before upstream', async () => {
  const calls = upstream(kalshi());
  for (const q of ['?limit=5', '?cursor=a', '?min_ts=0', '?max_ts=1', '?q=fed', '?view=discover', '?a=1&a=2', '?=x', '?tickers=KXA']) {
    const { res, body } = await invokeRoute(q);
    assert.equal(res.status, 400, q);
    assert.equal(typeof body.error, 'string', q);
    noStore(res);
  }
  assert.equal(calls.length, 0);
});

test('discovery route maps required upstream failures to sanitized no-store errors, never stale or empty success', async () => {
  for (const [opts, status] of [
    [{ trades: () => new Response(SECRET, { status: 500 }) }, 502], [{ trades: () => new Response(SECRET, { status: 429 }) }, 503],
    [{ trades: () => { throw new DOMException('timed out', 'TimeoutError'); } }, 504],
    [{ trades: () => ({ trades: [], cursor: 42 }) }, 502],
    [{ trades: tradesOf('KXA-E1-T1'), markets: () => new Response(SECRET, { status: 500 }) }, 502],
  ]) {
    mock.restoreAll();
    upstream(kalshi(opts));
    const { res, body } = await invokeRoute();
    assert.equal(res.status, status);
    assert.equal(body.groups, undefined);
    assert.doesNotMatch(JSON.stringify(body), /UPSTREAM-SECRET/);
    noStore(res);
  }
});

// ======================= /markets page =======================
test('resolveKalshiView accepts exact scalar "discover" and "events"; everything else stays the raw markets list', () => {
  const { resolveKalshiView } = makeLoader(nextMocks())('src/app/markets/MarketPlatformSelect.tsx');
  assert.equal(resolveKalshiView('discover'), 'discover');
  assert.equal(resolveKalshiView('events'), 'events');
  assert.equal(resolveKalshiView('top'), 'top');
  for (const v of [undefined, 'DISCOVER', ' discover', ['discover'], ['discover', 'discover'], '', 'TOP', ['top']]) {
    assert.equal(resolveKalshiView(v), 'markets', JSON.stringify(v));
  }
});

test('/markets?platform=kalshi&view=discover renders sample-scoped groups, category filter and metadata fallback', async () => {
  const calls = upstream(kalshi({
    trades: tradesOf('KXA-E1-T1', 'KXA-E1-T2', 'KXB-E1-T1', 'KXC-E1-T1'),
    event: url => ({
      'KXA-E1': () => ({ event: rawEvent('KXA-E1', { category: 'Politics' }) }),
      'KXB-E1': () => ({ event: rawEvent('KXB-E1', { category: 'Economics' }) }),
    }[eventTickerOf(url)] ?? (() => new Response(SECRET, { status: 500 })))(),
  }));
  const html = await renderMarkets({ platform: 'kalshi', view: 'discover' });
  assert.equal(calls[0].url.pathname, P.trades);
  assert.equal(calls.some(c => c.url.pathname === '/trade-api/v2/events'), false, 'no events list request');
  assert.doesNotMatch(html, /polymarket-client/);
  const tabs = anchors(html).filter(a => ['Top', 'Discover', 'Newest', 'Events'].includes(a.text)).slice(0, 4);
  assert.deepEqual(tabs.map(a => a.text), ['Top', 'Discover', 'Newest', 'Events']);
  assert.equal(anchor(html, 'Discover').href, DISCOVER_HREF);
  assert.equal(anchor(html, 'Discover')['aria-current'], 'page');
  assert.equal(anchor(html, 'Newest')['aria-current'], undefined);
  assert.match(html, /sample of recent (Kalshi )?trades/i);
  assert.match(html, /not (a|the) full/i);
  assert.match(html, labeled('Trades scanned', '4'));
  assert.match(html, /href="\/markets\/kalshi\/events\/KXA-E1"/);
  assert.match(html, /href="\/markets\/kalshi\/KXA-E1-T1"/);
  assert.match(html, /Synthetic title KXA-E1/);
  assert.match(html, /as published/i);
  for (const opt of ['All', 'Politics', 'Economics']) assert.match(html, new RegExp(`<option[^>]*>${opt}</option>`));
  assert.match(html, /KXC-E1/);
  assert.match(html, /Event details unavailable/i);
  assert.doesNotMatch(html, /Synthetic title KXC-E1|UPSTREAM-SECRET/);
  assert.doesNotMatch(html, /top markets|trending|all kalshi markets/i);
});

test('discover view: capped sample is labeled partial; empty sample is explicit; failure is an alert with Retry', async () => {
  let n = 0;
  upstream(kalshi({ trades: () => ({ trades: [rawTrade('KXA-E1-T1')], cursor: `c${++n}` }) }));
  assert.match(await renderMarkets({ platform: 'kalshi', view: 'discover' }), /partial/i);
  mock.restoreAll();
  upstream(kalshi());
  const empty = await renderMarkets({ platform: 'kalshi', view: 'discover' });
  assert.match(empty, /No recent trades/i);
  assert.doesNotMatch(empty, /role="alert"/);
  mock.restoreAll();
  upstream(kalshi({ trades: () => new Response(SECRET, { status: 500 }) }));
  const failed = await renderMarkets({ platform: 'kalshi', view: 'discover' });
  assert.match(failed, /role="alert"/);
  assert.match(failed, />Retry</);
  assert.doesNotMatch(failed, /No recent trades|UPSTREAM-SECRET/i);
});

test('raw /markets?platform=kalshi is unchanged but explains newest listings and links to Discover; events and Polymarket untouched', async () => {
  let calls = upstream(() => ({ markets: [rawMarket('KXA-E1-T1')], cursor: '' }));
  let html = await renderMarkets({ platform: 'kalshi' });
  assert.deepEqual(calls.map(c => c.url.pathname), [P.markets]);
  assert.equal(calls[0].url.searchParams.has('tickers'), false);
  assert.match(html, /Search loaded markets/);
  assert.equal(anchor(html, 'Newest')['aria-current'], 'page');
  assert.match(html, /newest listings/i);
  assert.ok(anchors(html).filter(a => a.href === DISCOVER_HREF).length >= 2, 'tab plus an explanatory Discover link');
  mock.restoreAll();
  calls = upstream(() => ({ events: [], cursor: '' }));
  await renderMarkets({ platform: 'kalshi', view: 'events' });
  assert.deepEqual(calls.map(c => c.url.pathname), ['/trade-api/v2/events']);
  mock.restoreAll();
  calls = upstream(kalshi());
  html = await renderMarkets({ view: 'discover' });
  assert.match(html, /data-stub="polymarket-client"/);
  assert.equal(calls.length, 0);
});
