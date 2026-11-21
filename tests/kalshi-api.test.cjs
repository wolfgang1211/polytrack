/* Node test runner + real TypeScript loader for the read-only Kalshi provider (RED until implemented). */
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { createLoader } = require('./helpers/load-ts.cjs');
const load = createLoader();
// Loaded lazily so each test fails on its own while the integration is missing.
const lib = () => load('src/lib/kalshi.ts');
const routes = {
  list: 'src/app/api/kalshi/markets/route.ts',
  detail: 'src/app/api/kalshi/markets/[ticker]/route.ts',
  book: 'src/app/api/kalshi/markets/[ticker]/orderbook/route.ts',
};
const BASE = 'https://external-api.kalshi.com/trade-api/v2';
const AUTH_HEADERS = ['authorization', 'cookie', 'kalshi-access-key', 'kalshi-access-signature', 'kalshi-access-timestamp'];
const SECRET = 'UPSTREAM-SECRET-BODY-must-not-leak';
const NOW = new Date('2026-11-19T12:00:00Z');

// SYNTHETIC fixture (shape mirrors observed live sample; values invented)
const rawMarket = (o = {}) => ({
  ticker: 'KXSYN-26DEC-T1', event_ticker: 'KXSYN-26DEC', title: 'Synthetic market?',
  yes_sub_title: 'Synthetic yes', no_sub_title: 'Synthetic no', status: 'active', market_type: 'binary',
  close_time: '2099-12-31T00:00:00Z', updated_time: '2026-11-01T00:00:00Z',
  volume_24h_fp: '1234.50', volume_fp: '98765.25', open_interest_fp: '4321.75',
  yes_bid_dollars: '0.4100', yes_ask_dollars: '0.4300', yes_bid_size_fp: '150.00', yes_ask_size_fp: '75.50',
  notional_value_dollars: '1.0000', rules_primary: 'Synthetic primary rule.', rules_secondary: 'Synthetic secondary rule.',
  ...o,
});
// SYNTHETIC fixture (shape mirrors observed live sample; values invented). Upstream lists levels ascending.
const rawBook = (o = {}) => ({ orderbook_fp: {
  yes_dollars: [['0.0100', '10.00'], ['0.0200', '20.00']],
  no_dollars: [['0.9500', '5.00'], ['0.9700', '7.00']],
  ...o,
} });

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
function assertSafeCalls(calls) {
  for (const { href, init } of calls) {
    assert.ok(href.startsWith(`${BASE}/`), `unexpected host/path: ${href}`);
    assert.ok(init?.method === undefined || init.method === 'GET', 'only GET is allowed');
    const headers = new Headers(init?.headers ?? {});
    for (const name of AUTH_HEADERS) assert.equal(headers.has(name), false, `auth header sent: ${name}`);
    assert.ok(init?.signal instanceof AbortSignal, 'every request needs a timeout signal');
  }
}
const isBook = url => url.pathname.endsWith('/orderbook');
async function invokeList(search = '') {
  const { GET } = load(routes.list);
  const res = await GET(new NextRequest(`http://localhost/api/kalshi/markets${search}`));
  return { res, body: await res.json() };
}
async function invokeTicker(kind, ticker) {
  const { GET } = load(routes[kind]);
  const path = `http://localhost/api/kalshi/markets/${encodeURIComponent(ticker)}${kind === 'book' ? '/orderbook' : ''}`;
  const res = await GET(new NextRequest(path), { params: Promise.resolve({ ticker }) });
  return { res, body: await res.json() };
}
afterEach(() => mock.restoreAll());

// ---------- adapter: normalizeMarket ----------
test('base URL is the fixed public Kalshi host', () => {
  assert.equal(lib().KALSHI_BASE_URL, BASE);
});

test('normalizeMarket parses decimal strings and keeps contracts vs dollars units explicit', () => {
  const m = lib().normalizeMarket(rawMarket());
  assert.deepEqual(Object.keys(m).sort(), [
    'closeTime', 'eventTicker', 'marketType', 'noLabel', 'notionalDollars', 'openInterestContracts', 'rulesPrimary',
    'rulesSecondary', 'status', 'ticker', 'title', 'totalVolumeContracts', 'updatedTime', 'volume24hContracts',
    'yesAsk', 'yesAskSize', 'yesBid', 'yesBidSize', 'yesLabel',
  ]);
  assert.equal(m.ticker, 'KXSYN-26DEC-T1');
  assert.equal(m.eventTicker, 'KXSYN-26DEC');
  assert.equal(m.yesLabel, 'Synthetic yes');
  assert.equal(m.noLabel, 'Synthetic no');
  assert.equal(m.status, 'active');
  assert.equal(m.marketType, 'binary');
  assert.equal(m.closeTime, '2099-12-31T00:00:00Z');
  assert.equal(m.volume24hContracts, 1234.5);
  assert.equal(m.totalVolumeContracts, 98765.25);
  assert.equal(m.openInterestContracts, 4321.75);
  assert.equal(m.yesBid, 0.41);
  assert.equal(m.yesAsk, 0.43);
  assert.equal(m.yesBidSize, 150);
  assert.equal(m.yesAskSize, 75.5);
  assert.equal(m.notionalDollars, 1);
  assert.equal(m.rulesPrimary, 'Synthetic primary rule.');
});

for (const [field, key, bad] of [
  ['volume_24h_fp', 'volume24hContracts', undefined], ['volume_fp', 'totalVolumeContracts', '-5.00'],
  ['open_interest_fp', 'openInterestContracts', 'NaN'], ['yes_bid_size_fp', 'yesBidSize', 'Infinity'],
  ['yes_bid_dollars', 'yesBid', '1.5000'], ['yes_ask_dollars', 'yesAsk', '-0.0100'],
  ['yes_ask_dollars', 'yesAsk', 'abc'], ['notional_value_dollars', 'notionalDollars', null],
]) {
  test(`invalid financial field ${field}=${String(bad)} becomes null, never 0`, () => {
    const m = lib().normalizeMarket(rawMarket({ [field]: bad }));
    assert.notEqual(m, null);
    assert.equal(m[key], null);
  });
}

test('a 0 price sentinel with zero or missing size is not a quote', () => {
  const m = lib().normalizeMarket(rawMarket({
    yes_bid_dollars: '0.0000', yes_bid_size_fp: '0.00', yes_ask_dollars: '0.0000', yes_ask_size_fp: undefined,
  }));
  assert.equal(m.yesBid, null);
  assert.equal(m.yesAsk, null);
});

test('a nonzero price without a positive size is not a usable quote', () => {
  const m = lib().normalizeMarket(rawMarket({ yes_bid_size_fp: '0.00', yes_ask_size_fp: undefined }));
  assert.equal(m.yesBid, null);
  assert.equal(m.yesAsk, null);
});

for (const bad of [true, false, '', '   ', '1e3', '0x10', '12,5', Infinity, NaN, {}, []]) {
  test(`non-decimal value ${typeof bad === 'number' ? String(bad) : JSON.stringify(bad)} never becomes a financial number`, () => {
    const m = lib().normalizeMarket(rawMarket({ volume_fp: bad, open_interest_fp: bad }));
    assert.equal(m.totalVolumeContracts, null);
    assert.equal(m.openInterestContracts, null);
  });
}

test('quote prices with unsupported precision (>4dp) become null instead of a rounded fabricated price', () => {
  const m = lib().normalizeMarket(rawMarket({ yes_bid_dollars: '0.41005', yes_ask_dollars: '0.430' }));
  assert.equal(m.yesBid, null);
  assert.equal(m.yesAsk, 0.43);
});

for (const close of ['2099-13-45T00:00:00Z', 'soon', '', 12345, null, undefined]) {
  test(`invalid close_time ${JSON.stringify(close) ?? 'undefined'} is null and never listable as open`, () => {
    const { normalizeMarket, isOpenListable } = lib();
    const m = normalizeMarket(rawMarket({ close_time: close }));
    assert.equal(m.closeTime, null);
    assert.equal(isOpenListable(m, NOW), false);
  });
}

for (const [label, raw] of [
  ['missing ticker', rawMarket({ ticker: undefined })], ['missing event_ticker', rawMarket({ event_ticker: '' })],
  ['unknown status', rawMarket({ status: 'mystery' })], ['list filter word is not a market status', rawMarket({ status: 'open' })],
  ['null row', null], ['string row', 'KXSYN'],
]) {
  test(`normalizeMarket quarantines ${label}`, () => assert.equal(lib().normalizeMarket(raw), null));
}

test('known lifecycle statuses are accepted but only active rows are listable', () => {
  const { normalizeMarket, isOpenListable } = lib();
  for (const status of ['initialized', 'inactive', 'active', 'closed', 'determined', 'disputed', 'amended', 'finalized']) {
    const m = normalizeMarket(rawMarket({ status }));
    assert.equal(m?.status, status);
    assert.equal(isOpenListable(m, NOW), status === 'active');
  }
});

test('isOpenListable excludes past-close active, non-binary and non-$1 notional rows', () => {
  const { normalizeMarket, isOpenListable } = lib();
  assert.equal(isOpenListable(normalizeMarket(rawMarket({ close_time: '2026-12-09T18:59:00Z' })), NOW), true);
  assert.equal(isOpenListable(normalizeMarket(rawMarket({ close_time: '2026-11-01T00:00:00Z' })), NOW), false);
  assert.equal(isOpenListable(normalizeMarket(rawMarket({ market_type: 'scalar' })), NOW), false);
  assert.equal(isOpenListable(normalizeMarket(rawMarket({ notional_value_dollars: '10.0000' })), NOW), false);
});

// ---------- adapter: normalizeOrderbook ----------
test('orderbook sorts bids desc and derives asks from the opposite side with provenance', () => {
  const b = lib().normalizeOrderbook(rawBook());
  assert.deepEqual(b.yesBids, [{ price: 0.02, size: 20 }, { price: 0.01, size: 10 }]);
  assert.deepEqual(b.noBids, [{ price: 0.97, size: 7 }, { price: 0.95, size: 5 }]);
  assert.deepEqual(b.yesAsks, [
    { price: 0.03, size: 7, derivedFrom: 'no_bid' }, { price: 0.05, size: 5, derivedFrom: 'no_bid' },
  ]);
  assert.deepEqual(b.noAsks, [
    { price: 0.98, size: 20, derivedFrom: 'yes_bid' }, { price: 0.99, size: 10, derivedFrom: 'yes_bid' },
  ]);
  assert.equal(b.bestYesBid, 0.02);
  assert.equal(b.bestYesAsk, 0.03);
  assert.equal(b.bestNoBid, 0.97);
  assert.equal(b.bestNoAsk, 0.98);
});

// Contract correction (official GetMarketOrderbook schema: yes_dollars/no_dollars are REQUIRED arrays):
// only a genuine [] is an empty side; null/missing sides are malformed (see envelope cases below).
test('genuinely empty book sides ([]) stay unknown: [] levels and null best, never 0', () => {
  const b = lib().normalizeOrderbook(rawBook({ yes_dollars: [], no_dollars: [] }));
  assert.deepEqual([b.yesBids, b.noBids, b.yesAsks, b.noAsks], [[], [], [], []]);
  assert.deepEqual([b.bestYesBid, b.bestYesAsk, b.bestNoBid, b.bestNoAsk], [null, null, null, null]);
  assert.equal(b.rejectedLevelCount, 0);
  assert.equal(b.complete, true);
});

test('bad individual levels are dropped, valid ones kept', () => {
  const b = lib().normalizeOrderbook(rawBook({
    yes_dollars: [['abc', '1'], ['0.0000', '5'], ['1.0000', '5'], ['0.5000', '0'], ['0.5000', '-1'], ['0.5000'], null, 'x', ['0.3000', '4.00']],
    no_dollars: [],
  }));
  assert.deepEqual(b.yesBids, [{ price: 0.3, size: 4 }]);
  assert.deepEqual(b.noAsks, [{ price: 0.7, size: 4, derivedFrom: 'yes_bid' }]);
  assert.equal(b.rejectedLevelCount, 8);
  assert.equal(b.complete, false); // a book with dropped levels is never reported complete
});

test('book levels with unsupported price precision (>4dp) are rejected, not rounded into a new price', () => {
  const b = lib().normalizeOrderbook(rawBook({ yes_dollars: [['0.12345', '5.00'], ['0.123', '2.00']], no_dollars: [] }));
  assert.deepEqual(b.yesBids, [{ price: 0.123, size: 2 }]);
  assert.equal(b.rejectedLevelCount, 1);
  assert.equal(b.complete, false);
});

for (const [label, raw] of [
  ['missing orderbook_fp', {}], ['null envelope', null], ['string side', rawBook({ yes_dollars: 'oops' })],
  ['object side', rawBook({ no_dollars: { a: 1 } })], ['null yes side', rawBook({ yes_dollars: null })],
  ['null no side', rawBook({ no_dollars: null })], ['missing yes side', { orderbook_fp: { no_dollars: [] } }],
  ['missing no side', { orderbook_fp: { yes_dollars: [] } }], ['empty orderbook_fp', { orderbook_fp: {} }],
  ['array orderbook_fp', { orderbook_fp: [] }],
]) {
  test(`normalizeOrderbook throws 502 on malformed envelope: ${label}`, () => {
    const { normalizeOrderbook, KalshiError } = lib();
    assert.throws(() => normalizeOrderbook(raw), e => e instanceof KalshiError && e.status === 502);
  });
}

// ---------- adapter: fetchers ----------
test('fetchKalshiMarkets quarantines bad/non-listable rows and reports retrieval time only', async () => {
  const calls = upstream(() => ({
    markets: [rawMarket(), rawMarket({ ticker: undefined }), rawMarket({ close_time: '2020-01-01T00:00:00Z' }), rawMarket({ status: 'mystery' })],
    cursor: 'next-page',
  }));
  const before = Date.now();
  const r = await lib().fetchKalshiMarkets({ limit: 5 });
  assertSafeCalls(calls);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, '/trade-api/v2/markets');
  assert.equal(calls[0].url.searchParams.get('status'), 'open');
  assert.equal(calls[0].url.searchParams.get('mve_filter'), 'exclude');
  assert.equal(calls[0].url.searchParams.get('limit'), '5');
  assert.equal(r.markets.length, 1);
  assert.equal(r.markets[0].ticker, 'KXSYN-26DEC-T1');
  assert.equal(r.rejectedCount, 3);
  assert.equal(r.nextCursor, 'next-page');
  assert.equal(r.sourceAsOf, null);
  assert.ok(Date.parse(r.receivedAt) >= before - 1000 && /T.*Z$/.test(r.receivedAt));
});

test('a real empty page is valid and an empty cursor becomes null', async () => {
  upstream(() => ({ markets: [], cursor: '' }));
  const r = await lib().fetchKalshiMarkets({ limit: 10 });
  assert.deepEqual(r.markets, []);
  assert.equal(r.nextCursor, null);
  assert.equal(r.rejectedCount, 0);
});

// Official GetMarkets schema: cursor is a REQUIRED string; only '' means last page. Anything else must not look like completeness.
for (const [label, body] of [
  ['missing cursor', { markets: [] }], ['null cursor', { markets: [], cursor: null }], ['numeric cursor', { markets: [], cursor: 123 }],
  ['object cursor', { markets: [], cursor: {} }], ['oversized cursor', { markets: [], cursor: 'x'.repeat(513) }],
  ['control-char cursor', { markets: [], cursor: 'ab\u0001cd' }], ['newline cursor', { markets: [], cursor: 'ab\ncd' }],
]) {
  test(`unusable upstream cursor is a 502, not a silent end of results: ${label}`, async () => {
    upstream(() => body);
    const { fetchKalshiMarkets, KalshiError } = lib();
    await assert.rejects(fetchKalshiMarkets({ limit: 10 }), e => e instanceof KalshiError && e.status === 502);
  });
}

test('a valid opaque upstream cursor is returned exactly', async () => {
  upstream(() => ({ markets: [], cursor: 'CgsI+/=%~_-.x' }));
  assert.equal((await lib().fetchKalshiMarkets({ limit: 10 })).nextCursor, 'CgsI+/=%~_-.x');
});

for (const body of [{ cursor: 'x' }, { markets: null }, { markets: {} }, ['not', 'an', 'object'], 'text']) {
  test(`malformed list envelope is an upstream error, not an empty list: ${JSON.stringify(body)}`, async () => {
    upstream(() => Response.json(body));
    const { fetchKalshiMarkets, KalshiError } = lib();
    await assert.rejects(fetchKalshiMarkets({ limit: 10 }), e => e instanceof KalshiError && e.status === 502);
  });
}

test('fetchKalshiMarket requires a literal ticker match', async () => {
  upstream(() => ({ market: rawMarket({ ticker: 'kxsyn-26dec-t1' }) }));
  const { fetchKalshiMarket, KalshiError } = lib();
  await assert.rejects(fetchKalshiMarket('KXSYN-26DEC-T1'), e => e instanceof KalshiError && e.status === 502);
});

for (const [label, respond, status] of [
  ['404 preserved', () => new Response(SECRET, { status: 404 }), 404],
  ['429 becomes 503', () => new Response(SECRET, { status: 429 }), 503],
  ['500 becomes 502', () => new Response(SECRET, { status: 500 }), 502],
  ['non-JSON body becomes 502', () => new Response('not json', { status: 200 }), 502],
  ['network failure becomes 502', () => { throw new TypeError('fetch failed'); }, 502],
  ['AbortError becomes 504', () => { throw new DOMException('aborted', 'AbortError'); }, 504],
  ['TimeoutError becomes 504', () => { throw new DOMException('timed out', 'TimeoutError'); }, 504],
]) {
  test(`fetchKalshiMarket error mapping: ${label}`, async () => {
    upstream(respond);
    const { fetchKalshiMarket, KalshiError } = lib();
    await assert.rejects(fetchKalshiMarket('KXSYN-26DEC-T1'), e => e instanceof KalshiError && e.status === status);
  });
}

test('upstream requests refuse redirects and send no credentials', async () => {
  const calls = upstream(() => ({ market: rawMarket() }));
  await lib().fetchKalshiMarket('KXSYN-26DEC-T1');
  assert.equal(calls[0].init.redirect, 'error');
  assert.notEqual(calls[0].init.credentials, 'include');
});

// Response whose headers arrived but whose body read times out (AbortSignal.timeout firing mid-body).
class BodyTimeoutResponse extends Response {
  json() { return Promise.reject(new DOMException('body timed out', 'TimeoutError')); }
  text() { return Promise.reject(new DOMException('body timed out', 'TimeoutError')); }
}
test('a timeout while reading the response body is 504, same as a fetch-phase timeout', async () => {
  upstream(() => new BodyTimeoutResponse('{}', { status: 200 }));
  const { fetchKalshiMarket, KalshiError } = lib();
  await assert.rejects(fetchKalshiMarket('KXSYN-26DEC-T1'), e => e instanceof KalshiError && e.status === 504);
});

test('fetchKalshiOrderbook refuses unsupported (scalar or non-$1) markets with 422 and never requests the book', async () => {
  for (const o of [{ market_type: 'scalar' }, { notional_value_dollars: '10.0000' }]) {
    mock.restoreAll();
    const calls = upstream(url => (isBook(url) ? rawBook() : { market: rawMarket(o) }));
    const { fetchKalshiOrderbook, KalshiError } = lib();
    await assert.rejects(fetchKalshiOrderbook('KXSYN-26DEC-T1'), e => e instanceof KalshiError && e.status === 422);
    assert.equal(calls.filter(c => isBook(c.url)).length, 0);
  }
});

// ---------- routes ----------
test('kalshi routes are GET-only (no POST handler)', () => {
  for (const file of Object.values(routes)) {
    const mod = load(file);
    assert.equal(typeof mod.GET, 'function');
    assert.equal(mod.POST, undefined);
  }
});

test('markets route defaults limit to 100 and forces open + mve exclude upstream', async () => {
  const calls = upstream(() => ({ markets: [rawMarket()], cursor: 'c2' }));
  const { res, body } = await invokeList();
  assert.equal(res.status, 200);
  assertSafeCalls(calls);
  assert.equal(calls[0].url.searchParams.get('limit'), '100');
  assert.equal(calls[0].url.searchParams.get('status'), 'open');
  assert.equal(calls[0].url.searchParams.get('mve_filter'), 'exclude');
  assert.equal(calls[0].url.searchParams.has('cursor'), false);
  assert.equal(body.markets.length, 1);
  assert.equal(body.nextCursor, 'c2');
  assert.equal(body.sourceAsOf, null);
});

test('markets route forwards an opaque cursor encoded and unchanged', async () => {
  const cursor = 'a+b/c=d&e==';
  const calls = upstream(() => ({ markets: [], cursor: '' }));
  const { res } = await invokeList(`?limit=200&cursor=${encodeURIComponent(cursor)}`);
  assert.equal(res.status, 200);
  assert.equal(calls[0].url.searchParams.get('cursor'), cursor);
  assert.equal(calls[0].url.searchParams.getAll('cursor').length, 1);
  assert.equal(calls[0].url.searchParams.has('e'), false);
  assert.equal(calls[0].url.searchParams.get('limit'), '200');
});

for (const query of [
  '?limit=0', '?limit=201', '?limit=1.5', '?limit=abc', '?limit=-1', '?limit=', '?limit=5&limit=6',
  '?cursor=a&cursor=b', `?cursor=${'x'.repeat(513)}`, '?cursor=abc%01def', '?cursor=abc%0Adef',
]) {
  test(`markets route rejects ${query.slice(0, 40)} with zero network calls`, async () => {
    const calls = upstream(() => ({ markets: [], cursor: '' }));
    const { res, body } = await invokeList(query);
    assert.equal(res.status, 400);
    assert.equal(typeof body.error, 'string');
    assert.equal(calls.length, 0);
  });
}

for (const ticker of ['kxsyn', '', '-KXSYN', 'KX SYN', 'KX/SYN', '../KXSYN', `K${'X'.repeat(100)}`]) {
  for (const kind of ['detail', 'book']) {
    test(`${kind} route rejects ticker ${JSON.stringify(ticker.slice(0, 12))} with zero network calls`, async () => {
      const calls = upstream(() => ({ market: rawMarket() }));
      const { res } = await invokeTicker(kind, ticker);
      assert.equal(res.status, 400);
      assert.equal(calls.length, 0);
    });
  }
}

for (const [kind, upstreamStatus, status] of [
  ['list', 500, 502], ['detail', 404, 404], ['detail', 429, 503], ['book', 500, 502], ['book', 429, 503],
]) {
  test(`${kind} route maps upstream ${upstreamStatus} to ${status} without leaking upstream body`, async () => {
    upstream(() => new Response(SECRET, { status: upstreamStatus }));
    const { res, body } = kind === 'list' ? await invokeList() : await invokeTicker(kind, 'KXSYN-26DEC-T1');
    assert.equal(res.status, status);
    assert.equal(typeof body.error, 'string');
    assert.doesNotMatch(JSON.stringify(body), /UPSTREAM-SECRET/);
    assert.match(res.headers.get('cache-control') ?? '', /no-store/);
  });
}

test('detail route returns 504 on upstream timeout', async () => {
  upstream(() => { throw new DOMException('timed out', 'TimeoutError'); });
  const { res } = await invokeTicker('detail', 'KXSYN-26DEC-T1');
  assert.equal(res.status, 504);
  assert.match(res.headers.get('cache-control') ?? '', /no-store/);
});

test('detail route returns the normalized market for a literal ticker match', async () => {
  const calls = upstream(() => ({ market: rawMarket() }));
  const { res, body } = await invokeTicker('detail', 'KXSYN-26DEC-T1');
  assert.equal(res.status, 200);
  assertSafeCalls(calls);
  assert.equal(calls[0].url.pathname, '/trade-api/v2/markets/KXSYN-26DEC-T1');
  assert.equal(body.market.ticker, 'KXSYN-26DEC-T1');
  assert.equal(body.market.openInterestContracts, 4321.75);
  assert.equal(body.sourceAsOf, null);
});

test('orderbook route verifies metadata before the book and returns derived asks', async () => {
  const calls = upstream(url => (isBook(url) ? rawBook() : { market: rawMarket() }));
  const { res, body } = await invokeTicker('book', 'KXSYN-26DEC-T1');
  assert.equal(res.status, 200);
  assertSafeCalls(calls);
  assert.deepEqual(calls.map(c => c.url.pathname), [
    '/trade-api/v2/markets/KXSYN-26DEC-T1', '/trade-api/v2/markets/KXSYN-26DEC-T1/orderbook',
  ]);
  assert.equal(body.ticker, 'KXSYN-26DEC-T1');
  assert.equal(body.sourceAsOf, null);
  assert.equal(typeof body.receivedAt, 'string');
  assert.equal(body.bestYesBid, 0.02);
  assert.equal(body.bestYesAsk, 0.03);
  assert.equal(body.yesAsks[0].derivedFrom, 'no_bid');
});

test('orderbook route: unknown ticker (metadata 404) is 404 even if the book endpoint would return an empty 200', async () => {
  const calls = upstream(url => (isBook(url) ? rawBook({ yes_dollars: [], no_dollars: [] }) : new Response(SECRET, { status: 404 })));
  const { res, body } = await invokeTicker('book', 'KXSYN-NOPE');
  assert.equal(res.status, 404);
  assert.doesNotMatch(JSON.stringify(body), /UPSTREAM-SECRET/);
  assert.equal(calls.filter(c => isBook(c.url)).length, 0);
});

test('orderbook route: metadata ticker mismatch is 502 and the book is never fetched', async () => {
  const calls = upstream(url => (isBook(url) ? rawBook() : { market: rawMarket({ ticker: 'KXSYN-OTHER' }) }));
  const { res } = await invokeTicker('book', 'KXSYN-26DEC-T1');
  assert.equal(res.status, 502);
  assert.equal(calls.filter(c => isBook(c.url)).length, 0);
});

for (const [label, book] of [
  ['wrong envelope key', { orderbook: {} }], ['null side', rawBook({ no_dollars: null })],
  ['missing side', { orderbook_fp: { yes_dollars: [['0.0200', '20.00']] } }],
]) {
  test(`orderbook route: malformed book (${label}) is 502, not an empty book`, async () => {
    upstream(url => (isBook(url) ? book : { market: rawMarket() }));
    const { res, body } = await invokeTicker('book', 'KXSYN-26DEC-T1');
    assert.equal(res.status, 502);
    assert.equal(body.yesBids, undefined);
    assert.match(res.headers.get('cache-control') ?? '', /no-store/);
  });
}

test('orderbook route: partial book exposes rejectedLevelCount and complete:false', async () => {
  upstream(url => (isBook(url) ? rawBook({ yes_dollars: [['abc', '1'], ['0.0200', '20.00']] }) : { market: rawMarket() }));
  const { res, body } = await invokeTicker('book', 'KXSYN-26DEC-T1');
  assert.equal(res.status, 200);
  assert.equal(body.rejectedLevelCount, 1);
  assert.equal(body.complete, false);
});

test('orderbook route: unsupported market type is a sanitized no-store 422 with no book request', async () => {
  const calls = upstream(url => (isBook(url) ? rawBook() : { market: rawMarket({ market_type: 'scalar' }) }));
  const { res, body } = await invokeTicker('book', 'KXSYN-26DEC-T1');
  assert.equal(res.status, 422);
  assert.equal(typeof body.error, 'string');
  assert.match(res.headers.get('cache-control') ?? '', /no-store/);
  assert.equal(calls.filter(c => isBook(c.url)).length, 0);
});

test('markets route: unusable upstream cursor is a no-store 502, not a successful final page', async () => {
  upstream(() => ({ markets: [rawMarket()], cursor: 42 }));
  const { res, body } = await invokeList();
  assert.equal(res.status, 502);
  assert.equal(body.markets, undefined);
  assert.match(res.headers.get('cache-control') ?? '', /no-store/);
});
