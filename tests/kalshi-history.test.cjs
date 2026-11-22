/* RED tests for the Kalshi price-history + recent-trades slice (lib, route, market detail SSR).
   Real TypeScript modules are transpiled and run; only fetch, next/link and next/navigation are stubbed.
   Server-render checks use ReactDOMServer markup — NOT browser proof (no layout, focus, real events). */
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { NextRequest } = require('next/server');

const root = path.resolve(__dirname, '..');
const src = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const NOT_FOUND = 'NEXT_NOT_FOUND';

function makeLoader(mocks = {}) {
  const cache = new Map();
  const resolve = p => ['', '.tsx', '.ts'].map(ext => p + ext).find(f => fs.existsSync(f) && fs.statSync(f).isFile()) ?? p;
  function load(file) {
    file = resolve(path.resolve(root, file));
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} };
    cache.set(file, mod);
    const req = name => (name in mocks ? mocks[name]
      : name.startsWith('@/') ? load(path.join(root, 'src', name.slice(2)))
      : name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : require(name));
    const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    new Function('exports', 'require', 'module', '__filename', '__dirname', out)(mod.exports, req, mod, file, path.dirname(file));
    return mod.exports;
  }
  return load;
}
const nextMocks = () => ({
  'next/link': { __esModule: true, default: ({ href, children, ...rest }) => { delete rest.prefetch; return React.createElement('a', { href, ...rest }, children); } },
  'next/navigation': { notFound: () => { throw Object.assign(new Error(NOT_FOUND), { digest: NOT_FOUND }); } },
});
const load = () => makeLoader(nextMocks());
const HIST = 'src/lib/kalshiHistory.ts';
const KAL = 'src/lib/kalshi.ts';
const ROUTE = 'src/app/api/kalshi/markets/[ticker]/history/route.ts';
const DETAIL = 'src/app/markets/kalshi/[ticker]/page.tsx';
const CLIENT = 'src/app/markets/KalshiHistoryClient.tsx';
const lib = () => load()(HIST);
// Module instances differ per loader, so match KalshiError by name + status rather than instanceof.
const isKErr = status => e => e?.name === 'KalshiError' && e.status === status;

const BASE = 'https://external-api.kalshi.com/trade-api/v2';
const AUTH_HEADERS = ['authorization', 'cookie', 'kalshi-access-key', 'kalshi-access-signature', 'kalshi-access-timestamp'];
const SECRET = 'UPSTREAM-SECRET-BODY-must-not-leak';
const TICKER = 'KXSYN-26DEC-T1';
const EVENT = 'KXSYN-26DEC';
const SERIES = 'SYNSERIESQ'; // deliberately NOT a prefix of the ticker: series must come from the event, never a ticker split
const NOW = new Date('2026-11-19T12:00:00Z');
const END = Math.floor(NOW.getTime() / 1000);
const H = 3600;
const S = END - 86400;
const W24 = { startTs: S, endTs: END, periodMinutes: 60 };
const iso = sec => new Date(sec * 1000).toISOString();
const omit = (o, k) => { const c = { ...o }; delete c[k]; return c; };
const ABSENT = Symbol('absent close');

// SYNTHETIC fixtures (shape mirrors observed live samples; values invented)
const rawMarket = (o = {}) => ({
  ticker: TICKER, event_ticker: EVENT, title: 'Synthetic market?',
  yes_sub_title: 'Synthetic yes', no_sub_title: 'Synthetic no', status: 'active', market_type: 'binary',
  close_time: '2099-12-31T00:00:00Z', updated_time: '2026-11-01T00:00:00Z',
  volume_24h_fp: '1234.50', volume_fp: '98765.25', open_interest_fp: '4321.75',
  yes_bid_dollars: '0.4100', yes_ask_dollars: '0.4300', yes_bid_size_fp: '150.00', yes_ask_size_fp: '75.50',
  notional_value_dollars: '1.0000', rules_primary: 'Synthetic primary rule.', rules_secondary: 'Synthetic secondary rule.',
  ...o,
});
const rawBook = () => ({ orderbook_fp: { yes_dollars: [['0.0100', '10.00'], ['0.0200', '20.00']], no_dollars: [['0.9500', '5.00'], ['0.9700', '7.00']] } });
const eventBody = (o = {}) => ({ event: { event_ticker: EVENT, series_ticker: SERIES, title: 'Synthetic event?', ...o }, markets: [] });
const ohlc = v => ({ open_dollars: v, high_dollars: v, low_dollars: v, close_dollars: v });
const candle = (endTs, close = '0.4000', o = {}) => ({
  end_period_ts: endTs, open_interest_fp: '500.00', volume_fp: '10.00',
  price: close === ABSENT ? { previous_dollars: '0.9900' }
    : { open_dollars: close, high_dollars: close, low_dollars: close, close_dollars: close, mean_dollars: close, previous_dollars: '0.9900' },
  yes_bid: ohlc('0.0100'), yes_ask: ohlc('0.9900'), ...o,
});
const candles = (rows, ticker = TICKER) => ({ ticker, candlesticks: rows });
const trade = (o = {}) => ({
  trade_id: 'syn-trade-1', ticker: TICKER, count_fp: '12.00', yes_price_dollars: '0.3700', no_price_dollars: '0.6300',
  taker_side: 'yes', taker_outcome_side: 'yes', taker_book_side: 'bid', created_time: iso(END - 600), is_block_trade: false, ...o,
});

// VERBATIM rows from the 2026-11-19 public capture (candles-live.json / live-manifest.json), trimmed to the
// region around the observed no-trade period (close absent) and the skipped period 1795082400.
const LIVE = { ticker: 'KXFEDDECISION-26DEC-H0', window: { startTs: 1795011660, endTs: 1795098060, periodMinutes: 60 } };
const LIVE_CANDLES = [
  { end_period_ts: 1795075200, open_interest_fp: '3338401.48', price: { close_dollars: '0.0300', high_dollars: '0.0400', low_dollars: '0.0300', mean_dollars: '0.0367', open_dollars: '0.0400', previous_dollars: '0.0400' }, volume_fp: '1907.64', yes_ask: { close_dollars: '0.0400', high_dollars: '0.0400', low_dollars: '0.0400', open_dollars: '0.0400' }, yes_bid: { close_dollars: '0.0300', high_dollars: '0.0300', low_dollars: '0.0300', open_dollars: '0.0300' } },
  { end_period_ts: 1795078800, open_interest_fp: '3338401.48', price: { previous_dollars: '0.0300' }, volume_fp: '0.00', yes_ask: { close_dollars: '0.0400', high_dollars: '0.0400', low_dollars: '0.0400', open_dollars: '0.0400' }, yes_bid: { close_dollars: '0.0300', high_dollars: '0.0300', low_dollars: '0.0300', open_dollars: '0.0300' } },
  { end_period_ts: 1795086000, open_interest_fp: '3338401.48', price: { close_dollars: '0.0400', high_dollars: '0.0400', low_dollars: '0.0400', mean_dollars: '0.0400', open_dollars: '0.0400', previous_dollars: '0.0300' }, volume_fp: '23.42', yes_ask: { close_dollars: '0.0400', high_dollars: '0.0400', low_dollars: '0.0400', open_dollars: '0.0400' }, yes_bid: { close_dollars: '0.0300', high_dollars: '0.0300', low_dollars: '0.0300', open_dollars: '0.0300' } },
  { end_period_ts: 1795089600, open_interest_fp: '3338401.48', price: { close_dollars: '0.0300', high_dollars: '0.0300', low_dollars: '0.0300', mean_dollars: '0.0300', open_dollars: '0.0300', previous_dollars: '0.0400' }, volume_fp: '112.00', yes_ask: { close_dollars: '0.0400', high_dollars: '0.0400', low_dollars: '0.0400', open_dollars: '0.0400' }, yes_bid: { close_dollars: '0.0300', high_dollars: '0.0300', low_dollars: '0.0300', open_dollars: '0.0300' } },
];
const LIVE_TRADES = [
  { count_fp: '905.20', created_time: '2026-11-19T14:14:20.788241Z', is_block_trade: false, no_price_dollars: '0.9700', taker_book_side: 'bid', taker_outcome_side: 'yes', taker_side: 'yes', ticker: 'KXFEDDECISION-26DEC-H0', trade_id: '07262487-a541-84f5-f097-3b242a16d2c7', yes_price_dollars: '0.0300' },
  { count_fp: '4.22', created_time: '2026-11-19T14:11:04.466273Z', is_block_trade: false, no_price_dollars: '0.9700', taker_book_side: 'ask', taker_outcome_side: 'no', taker_side: 'no', ticker: 'KXFEDDECISION-26DEC-H0', trade_id: '07262489-1b09-bf2b-e900-e3e42060ce88', yes_price_dollars: '0.0300' },
];

/* ── upstream stub ── */
const kindOf = url => {
  const p = url.pathname.replace(/^\/trade-api\/v2/, '');
  if (p === '/markets/trades') return 'trades';
  if (p.startsWith('/events/')) return 'event';
  if (p.endsWith('/candlesticks')) return 'candles';
  if (p.endsWith('/orderbook')) return 'book';
  if (p.startsWith('/markets/')) return 'market';
  return 'other';
};
// Builds aligned candles inside whatever window the code under test requested (closes: 21¢, gap, 23¢, 24¢).
function autoCandles(url, closes = ['0.2100', ABSENT, '0.2300', '0.2400']) {
  const start = Number(url.searchParams.get('start_ts'));
  const end = Number(url.searchParams.get('end_ts'));
  const p = Number(url.searchParams.get('period_interval')) * 60;
  const first = Math.floor(start / p) * p + p;
  return closes.map((c, k) => candle(first + k * p, c)).filter(r => r.end_period_ts <= end);
}
const D = {
  market: () => ({ market: rawMarket() }),
  book: () => rawBook(),
  event: () => eventBody(),
  candles: url => candles(autoCandles(url)),
  trades: url => ({ trades: [trade({ created_time: iso(Number(url.searchParams.get('max_ts')) - 60) })], cursor: '' }),
};
const routeBy = (h = {}) => (url, init) => {
  const f = { ...D, ...h }[kindOf(url)];
  return f ? f(url, init) : new Response('unexpected path', { status: 500 });
};
function upstream(fn) {
  const calls = [];
  mock.method(globalThis, 'fetch', async (input, init) => {
    const href = typeof input === 'string' ? input : (input?.url ?? String(input));
    const url = new URL(href);
    calls.push({ href, url, init, kind: kindOf(url) });
    const r = await fn(url, init);
    return r instanceof Response ? r : Response.json(r);
  });
  return calls;
}
const ofKind = (calls, k) => calls.filter(c => c.kind === k);
const HISTORY_KINDS = ['event', 'candles', 'trades'];
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
async function waitFor(pred, ms = 300) {
  const until = Date.now() + ms;
  while (!pred() && Date.now() < until) await new Promise(r => setTimeout(r, 5));
  return pred();
}
afterEach(() => mock.restoreAll());

/* ── normalized history fixture (client-validation contract) ── */
const validHistory = () => ({
  ticker: TICKER, range: '24h', window: { ...W24 }, retrievedAt: '2026-11-19T12:00:05.000Z', sourceAsOf: null,
  candles: { ok: true, data: { seriesTicker: SERIES, points: [
    { endTs: S + H, yesClose: 0.21, volumeContracts: 10 }, { endTs: S + 2 * H, yesClose: null, volumeContracts: 0 },
    { endTs: S + 3 * H, yesClose: 0, volumeContracts: 5 },
  ] } },
  trades: { ok: true, data: { hasMore: true, trades: [
    { tradeId: 'syn-1', createdTime: iso(END - 120), yesPrice: 0.37, noPrice: 0.63, countContracts: 12, takerOutcomeSide: 'no', isBlockTrade: true },
  ] } },
});

/* =================== window / query =================== */
test('historyWindow: server-computed second windows (1h=1-minute, 24h/7d hourly), end=floor(now), bounded counts; junk rejected', () => {
  const { historyWindow, HISTORY_RANGES, DEFAULT_HISTORY_RANGE, MAX_CANDLES, TRADE_PAGE_LIMIT } = lib();
  assert.deepEqual([...HISTORY_RANGES], ['1h', '24h', '7d']);
  assert.equal(DEFAULT_HISTORY_RANGE, '24h');
  assert.equal(MAX_CANDLES, 200);
  assert.equal(TRADE_PAGE_LIMIT, 50);
  const now = new Date(NOW.getTime() + 999);
  assert.deepEqual(historyWindow('1h', now), { range: '1h', startTs: END - 3600, endTs: END, periodMinutes: 1 });
  assert.deepEqual(historyWindow('24h', now), { range: '24h', startTs: END - 86400, endTs: END, periodMinutes: 60 });
  assert.deepEqual(historyWindow('7d', now), { range: '7d', startTs: END - 604800, endTs: END, periodMinutes: 60 });
  for (const r of HISTORY_RANGES) {
    const w = historyWindow(r, now);
    assert.ok((w.endTs - w.startTs) / (w.periodMinutes * 60) <= MAX_CANDLES, r);
  }
  for (const bad of ['30d', '1H', '', ' 24h', undefined, null, 24, ['24h']]) {
    assert.throws(() => historyWindow(bad, NOW), isKErr(400), JSON.stringify(bad));
  }
  assert.throws(() => historyWindow('24h', new Date('nope')));
});

test('parseHistoryQuery: only an exact range param (default 24h); unknown, repeated, blank or timestamp params are 400', () => {
  const { parseHistoryQuery } = lib();
  assert.equal(parseHistoryQuery(new URLSearchParams('')), '24h');
  for (const r of ['1h', '24h', '7d']) assert.equal(parseHistoryQuery(new URLSearchParams(`range=${r}`)), r);
  for (const q of ['range=30d', 'range=', 'range=1H', 'range=24h&range=24h', 'range=1h&range=7d', 'foo=1',
    'range=24h&start_ts=1', 'min_ts=1', 'end_ts=1795089600', 'limit=1000', 'cursor=abc', 'ticker=KXOTHER']) {
    assert.throws(() => parseHistoryQuery(new URLSearchParams(q)), isKErr(400), q);
  }
});

/* =================== candles =================== */
test('normalizeCandles on verbatim live rows: YES trade close only; absent close is a gap (never previous_dollars); skipped period not filled', () => {
  const pts = lib().normalizeCandles(candles(LIVE_CANDLES, LIVE.ticker), LIVE.ticker, LIVE.window);
  assert.deepEqual(pts, [
    { endTs: 1795075200, yesClose: 0.03, volumeContracts: 1907.64 },
    { endTs: 1795078800, yesClose: null, volumeContracts: 0 },
    { endTs: 1795086000, yesClose: 0.04, volumeContracts: 23.42 },
    { endTs: 1795089600, yesClose: 0.03, volumeContracts: 112 },
  ]);
});

test('normalizeCandles binds the response to the exact requested ticker and a well-formed envelope', () => {
  const { normalizeCandles } = lib();
  assert.deepEqual(normalizeCandles(candles([]), TICKER, W24), []); // a real empty window is valid
  for (const [label, body] of [
    ['different ticker', candles([candle(S + H)], 'KXSYN-OTHER')], ['case-changed ticker', candles([candle(S + H)], TICKER.toLowerCase())],
    ['missing ticker', { candlesticks: [candle(S + H)] }], ['missing candlesticks', { ticker: TICKER }],
    ['null candlesticks', { ticker: TICKER, candlesticks: null }], ['object candlesticks', { ticker: TICKER, candlesticks: {} }],
    ['array envelope', [candle(S + H)]], ['null envelope', null],
    ['missing price object', candles([omit(candle(S + H), 'price')])], ['null price object', candles([candle(S + H, '0.4000', { price: null })])],
    ['array price object', candles([candle(S + H, '0.4000', { price: [] })])], ['null row', candles([null])],
  ]) {
    assert.throws(() => normalizeCandles(body, TICKER, W24), isKErr(502), label);
  }
});

test('normalizeCandles rejects more than 200 rows before reading any row', () => {
  let touched = 0;
  const row = {};
  for (const k of ['end_period_ts', 'price', 'volume_fp', 'open_interest_fp', 'yes_bid', 'yes_ask']) {
    Object.defineProperty(row, k, { enumerable: true, get() { touched++; return undefined; } });
  }
  const body = { ticker: TICKER, candlesticks: Array.from({ length: 201 }, () => row) };
  assert.throws(() => lib().normalizeCandles(body, TICKER, { startTs: END - 604800, endTs: END, periodMinutes: 60 }), isKErr(502));
  assert.equal(touched, 0);
});

test('normalizeCandles rejects the whole set on duplicate, unordered, off-window, non-integer, misaligned or missing timestamps', () => {
  const { normalizeCandles } = lib();
  for (const [label, rows] of [
    ['duplicate end_period_ts', [candle(S + H), candle(S + H)]],
    ['non-chronological rows (strict reject, not silently re-sorted)', [candle(S + 2 * H), candle(S + H)]],
    ['period ending before the window', [candle(S - H)]],
    ['period ending after the window', [candle(END + H)]],
    ['non-integer timestamp', [candle(S + H + 0.5)]],
    ['string timestamp', [candle(String(S + H))]],
    ['timestamp not on the period boundary', [candle(S + H + 30)]],
    ['millisecond timestamp', [candle((S + H) * 1000)]],
    ['missing timestamp', [omit(candle(S + H), 'end_period_ts')]],
  ]) {
    assert.throws(() => normalizeCandles(candles(rows), TICKER, W24), isKErr(502), label);
  }
});

test('candle close keeps source precision up to 6dp and a known 0; >6dp, out-of-range or non-string closes are rejected, not rounded/clamped', () => {
  const { normalizeCandles } = lib();
  const pts = normalizeCandles(candles([
    candle(S + H, '0.123456'), candle(S + 2 * H, '0.0000'), candle(S + 3 * H, '1.0000'), candle(S + 4 * H, '0.5'),
  ]), TICKER, W24);
  assert.deepEqual(pts.map(p => p.yesClose), [0.123456, 0, 1, 0.5]);
  for (const bad of ['0.1234567', '1.0001', '1.000001', '-0.0100', 'abc', '', ' 0.5', '1e-2', '0x1', 0.5, true, {}]) {
    assert.throws(() => normalizeCandles(candles([candle(S + H, bad)]), TICKER, W24), isKErr(502), JSON.stringify(bad));
  }
});

test('null or absent close is a gap; previous_dollars, mean_dollars and yes_bid/yes_ask are never used as the close', () => {
  const nullClose = candle(S + H, null);
  const meanOnly = candle(S + 3 * H, ABSENT, { price: { mean_dollars: '0.4400', previous_dollars: '0.4500' } });
  const bidAsk = candle(S + 4 * H, ABSENT, { yes_bid: ohlc('0.5000'), yes_ask: ohlc('0.5200') });
  const pts = lib().normalizeCandles(candles([nullClose, candle(S + 2 * H, ABSENT), meanOnly, bidAsk]), TICKER, W24);
  assert.deepEqual(pts.map(p => [p.endTs, p.yesClose]), [[S + H, null], [S + 2 * H, null], [S + 3 * H, null], [S + 4 * H, null]]);
});

test('volume_fp "0.00" is a known zero; missing, null, negative, over-precise or junk volume rejects the set (no fabricated volume)', () => {
  const { normalizeCandles } = lib();
  assert.equal(normalizeCandles(candles([candle(S + H, '0.4000', { volume_fp: '0.00' })]), TICKER, W24)[0].volumeContracts, 0);
  assert.equal(normalizeCandles(candles([candle(S + H, '0.4000', { volume_fp: '34853.18' })]), TICKER, W24)[0].volumeContracts, 34853.18);
  for (const bad of [undefined, null, '-1.00', '10.123', 'abc', '', 10, 'NaN', 'Infinity']) {
    const row = bad === undefined ? omit(candle(S + H), 'volume_fp') : candle(S + H, '0.4000', { volume_fp: bad });
    assert.throws(() => normalizeCandles(candles([row]), TICKER, W24), isKErr(502), String(bad));
  }
});

/* =================== trades =================== */
test('normalizeTrades on verbatim live rows keeps published yes/no prices, contract counts and outcome side as-is', () => {
  const r = lib().normalizeTrades({ trades: LIVE_TRADES, cursor: 'opaque-next+/=' }, LIVE.ticker, LIVE.window);
  assert.deepEqual(r, { hasMore: true, trades: [
    { tradeId: '07262487-a541-84f5-f097-3b242a16d2c7', createdTime: '2026-11-19T14:14:20.788241Z', yesPrice: 0.03, noPrice: 0.97, countContracts: 905.2, takerOutcomeSide: 'yes', isBlockTrade: false },
    { tradeId: '07262489-1b09-bf2b-e900-e3e42060ce88', createdTime: '2026-11-19T14:11:04.466273Z', yesPrice: 0.03, noPrice: 0.97, countContracts: 4.22, takerOutcomeSide: 'no', isBlockTrade: false },
  ] });
});

test('trades cursor: only "" means no more pages; missing/invalid cursor is 502; >50 rows rejected before reading any row', () => {
  const { normalizeTrades } = lib();
  assert.deepEqual(normalizeTrades({ trades: [], cursor: '' }, TICKER, W24), { trades: [], hasMore: false });
  assert.equal(normalizeTrades({ trades: [trade()], cursor: '' }, TICKER, W24).hasMore, false);
  for (const body of [{ trades: [] }, { trades: [], cursor: null }, { trades: [], cursor: 7 }, { trades: [], cursor: 'a\nb' },
    { trades: [], cursor: 'x'.repeat(513) }, { cursor: '' }, { trades: null, cursor: '' }, { trades: {}, cursor: '' }, null]) {
    assert.throws(() => normalizeTrades(body, TICKER, W24), isKErr(502), JSON.stringify(body));
  }
  let touched = 0;
  const row = {};
  for (const k of ['trade_id', 'ticker', 'count_fp', 'created_time']) {
    Object.defineProperty(row, k, { enumerable: true, get() { touched++; return undefined; } });
  }
  assert.throws(() => normalizeTrades({ trades: Array.from({ length: 51 }, () => row), cursor: '' }, TICKER, W24), isKErr(502));
  assert.equal(touched, 0);
});

test('a trade with any missing or invalid required field fails the whole trade section (never dropped or filled)', () => {
  const { normalizeTrades } = lib();
  const fails = (row, label) => assert.throws(() => normalizeTrades({ trades: [trade({ trade_id: 'ok-1' }), row], cursor: '' }, TICKER, W24), isKErr(502), label);
  for (const k of ['trade_id', 'ticker', 'count_fp', 'yes_price_dollars', 'no_price_dollars', 'taker_outcome_side', 'taker_book_side', 'created_time', 'is_block_trade']) {
    fails(omit(trade(), k), `missing ${k}`);
  }
  for (const [k, vals] of [
    ['trade_id', ['', 42, null]],
    ['count_fp', ['0.00', '-1.00', '1.234', 'abc', 12, null]],
    ['yes_price_dollars', ['0.1234567', '1.0001', null, 0.37, '']],
    ['no_price_dollars', ['-0.0100', '2', null]],
    ['taker_outcome_side', ['buy', 'YES', null]],
    ['taker_book_side', ['sell', 'BID', null]],
    ['created_time', ['2026-11-19 11:50:00', END - 600, 'yesterday', null]],
    ['is_block_trade', ['false', 0, null]],
  ]) {
    for (const v of vals) fails(trade({ [k]: v }), `${k}=${JSON.stringify(v)}`);
  }
});

test('trades must bind to the ticker and window, be unique, and carry a consistent direction bit', () => {
  const { normalizeTrades } = lib();
  for (const [label, rows] of [
    ['other ticker', [trade({ ticker: 'KXSYN-OTHER' })]],
    ['before window', [trade({ created_time: iso(S - H) })]],
    ['after window', [trade({ created_time: iso(END + H) })]],
    ['duplicate trade_id', [trade({ trade_id: 'dup' }), trade({ trade_id: 'dup', created_time: iso(END - 700) })]],
    ['outcome yes with book ask', [trade({ taker_outcome_side: 'yes', taker_book_side: 'ask' })]],
    ['outcome no with book bid', [trade({ taker_outcome_side: 'no', taker_book_side: 'bid' })]],
  ]) {
    assert.throws(() => normalizeTrades({ trades: rows, cursor: '' }, TICKER, W24), isKErr(502), label);
  }
});

test('block trades are kept and flagged; prices are never swapped by side; deprecated taker_side is optional', () => {
  const r = lib().normalizeTrades({ cursor: '', trades: [
    trade({ trade_id: 'a', taker_side: 'no', taker_outcome_side: 'no', taker_book_side: 'ask', yes_price_dollars: '0.0300', no_price_dollars: '0.9700' }),
    trade({ trade_id: 'b', is_block_trade: true, yes_price_dollars: '0.123456', no_price_dollars: '0.876544', count_fp: '2500.00' }),
    omit(trade({ trade_id: 'c', created_time: iso(END - 900) }), 'taker_side'),
  ] }, TICKER, W24);
  assert.deepEqual(r.trades, [
    { tradeId: 'a', createdTime: iso(END - 600), yesPrice: 0.03, noPrice: 0.97, countContracts: 12, takerOutcomeSide: 'no', isBlockTrade: false },
    { tradeId: 'b', createdTime: iso(END - 600), yesPrice: 0.123456, noPrice: 0.876544, countContracts: 2500, takerOutcomeSide: 'yes', isBlockTrade: true },
    { tradeId: 'c', createdTime: iso(END - 900), yesPrice: 0.37, noPrice: 0.63, countContracts: 12, takerOutcomeSide: 'yes', isBlockTrade: false },
  ]);
});

/* =================== fetchKalshiHistory =================== */
async function history(range = '24h', marketOverrides = {}) {
  const L = load();
  const market = L(KAL).normalizeMarket(rawMarket(marketOverrides));
  return L(HIST).fetchKalshiHistory(market, range, NOW);
}

test('fetchKalshiHistory: series from the verified event, exact candle/trade queries, safe GETs, no market re-fetch, retrieval time only', async () => {
  const calls = upstream(routeBy());
  const before = Date.now();
  const h = await history('24h');
  assertSafeCalls(calls);
  assert.equal(ofKind(calls, 'market').length, 0);
  assert.equal(ofKind(calls, 'book').length, 0);
  assert.deepEqual(ofKind(calls, 'event').map(c => c.url.pathname), [`/trade-api/v2/events/${EVENT}`]);
  const [c] = ofKind(calls, 'candles');
  assert.equal(ofKind(calls, 'candles').length, 1);
  assert.equal(c.url.pathname, `/trade-api/v2/series/${SERIES}/markets/${TICKER}/candlesticks`);
  assert.deepEqual(Object.fromEntries(c.url.searchParams), {
    start_ts: String(S), end_ts: String(END), period_interval: '60', include_latest_before_start: 'false',
  });
  const [t] = ofKind(calls, 'trades');
  assert.equal(ofKind(calls, 'trades').length, 1);
  assert.deepEqual(Object.fromEntries(t.url.searchParams), { ticker: TICKER, limit: '50', min_ts: String(S), max_ts: String(END) });
  assert.equal(h.ticker, TICKER);
  assert.equal(h.range, '24h');
  assert.deepEqual(h.window, W24);
  assert.equal(h.sourceAsOf, null);
  assert.ok(Date.parse(h.retrievedAt) >= before - 1000 && /T.*Z$/.test(h.retrievedAt));
  assert.equal(h.candles.ok, true);
  assert.equal(h.candles.data.seriesTicker, SERIES);
  assert.deepEqual(h.candles.data.points.map(p => p.yesClose), [0.21, null, 0.23, 0.24]);
  assert.equal(h.trades.ok, true);
  assert.equal(h.trades.data.hasMore, false);
  assert.equal(h.trades.data.trades.length, 1);
  assert.equal(lib().isKalshiHistory(JSON.parse(JSON.stringify(h)), { ticker: TICKER, range: '24h' }), true);
});

test('fetchKalshiHistory runs the trades request concurrently with the event→candles chain', async () => {
  let eventSeen = false, tradesSeen = false, tradesDuringEvent = null, eventDuringTrades = null;
  upstream(routeBy({
    event: async () => { eventSeen = true; tradesDuringEvent = await waitFor(() => tradesSeen); return eventBody(); },
    trades: async url => { tradesSeen = true; eventDuringTrades = await waitFor(() => eventSeen); return D.trades(url); },
  }));
  const h = await history('1h');
  assert.equal(tradesDuringEvent, true);
  assert.equal(eventDuringTrades, true);
  assert.equal(h.candles.ok, true);
  assert.equal(h.trades.ok, true);
});

test('event binding failure makes only the chart unavailable (no candle request); trades still load', async () => {
  for (const [label, ev] of [
    ['different event_ticker', eventBody({ event_ticker: 'KXSYN-OTHER' })], ['missing series_ticker', { event: { event_ticker: EVENT } }],
    ['lowercase series', eventBody({ series_ticker: 'synseriesq' })], ['path-like series', eventBody({ series_ticker: '../X' })],
    ['null series', eventBody({ series_ticker: null })], ['missing event object', { markets: [] }],
    ['upstream 500', new Response(SECRET, { status: 500 })],
  ]) {
    mock.restoreAll();
    const calls = upstream(routeBy({ event: () => (ev instanceof Response ? ev.clone() : ev) }));
    const h = await history('24h');
    assert.equal(ofKind(calls, 'candles').length, 0, label);
    assert.equal(h.candles.ok, false, label);
    assert.equal(h.candles.status, 502, label);
    assert.equal(typeof h.candles.error, 'string', label);
    assert.equal(h.trades.ok, true, label);
    assert.doesNotMatch(JSON.stringify(h), /UPSTREAM-SECRET/, label);
  }
});

test('candle and trade sections fail independently with sanitized status (allSettled-style)', async () => {
  upstream(routeBy({ candles: () => candles([candle(S + H)], 'KXSYN-OTHER') }));
  let h = await history('24h');
  assert.equal(h.candles.ok, false);
  assert.equal(h.trades.ok, true);
  mock.restoreAll();
  upstream(routeBy({ trades: () => new Response(SECRET, { status: 429 }) }));
  h = await history('24h');
  assert.equal(h.candles.ok, true);
  assert.deepEqual(Object.keys(h.trades).sort(), ['error', 'ok', 'status']);
  assert.equal(h.trades.status, 503);
  mock.restoreAll();
  upstream(routeBy({ trades: () => ({ trades: [trade({ count_fp: '0.00' })], cursor: '' }) }));
  h = await history('24h');
  assert.equal(h.trades.ok, false);
  assert.equal(h.trades.status, 502);
  assert.equal(h.candles.ok, true);
  assert.doesNotMatch(JSON.stringify(h), /UPSTREAM-SECRET/);
});

test('fetchKalshiHistory: unsupported market is 422 and an invalid range is 400, both with zero upstream requests', async () => {
  const calls = upstream(routeBy());
  for (const o of [{ market_type: 'scalar' }, { notional_value_dollars: '10.0000' }]) {
    await assert.rejects(history('24h', o), isKErr(422));
  }
  await assert.rejects(history('30d'), isKErr(400));
  assert.equal(calls.length, 0);
});

/* =================== route =================== */
async function invokeHistory(search = '', ticker = TICKER) {
  const { GET } = load()(ROUTE);
  const res = await GET(new NextRequest(`http://localhost/api/kalshi/markets/${encodeURIComponent(ticker)}/history${search}`), { params: Promise.resolve({ ticker }) });
  return { res, body: await res.json() };
}

test('history route is GET-only and rejects bad tickers/queries with 400 before any upstream request', async () => {
  const mod = load()(ROUTE);
  assert.equal(typeof mod.GET, 'function');
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(mod[m], undefined, m);
  const calls = upstream(routeBy());
  for (const q of ['?range=30d', '?range=', '?range=1H', '?range=24h&range=24h', '?range=1h&range=7d', '?foo=1',
    '?range=24h&start_ts=1', '?cursor=abc', '?limit=1000']) {
    const { res, body } = await invokeHistory(q);
    assert.equal(res.status, 400, q);
    assert.equal(typeof body.error, 'string', q);
  }
  for (const t of ['kxsyn', '../KXSYN', 'KX SYN', '']) {
    const { res } = await invokeHistory('', t);
    assert.equal(res.status, 400, JSON.stringify(t));
  }
  assert.equal(calls.length, 0);
});

test('history route verifies the market first and returns a client-valid payload for each range', async () => {
  for (const [q, range, period, span] of [['', '24h', '60', 86400], ['?range=1h', '1h', '1', 3600], ['?range=7d', '7d', '60', 604800]]) {
    mock.restoreAll();
    const calls = upstream(routeBy());
    const { res, body } = await invokeHistory(q);
    assert.equal(res.status, 200, q);
    assertSafeCalls(calls);
    assert.equal(calls[0].kind, 'market', q);
    assert.equal(ofKind(calls, 'market').length, 1, q);
    assert.equal(ofKind(calls, 'book').length, 0, q);
    const [c] = ofKind(calls, 'candles');
    assert.equal(c.url.searchParams.get('period_interval'), period, q);
    assert.equal(Number(c.url.searchParams.get('end_ts')) - Number(c.url.searchParams.get('start_ts')), span, q);
    assert.equal(body.range, range, q);
    assert.equal(lib().isKalshiHistory(body, { ticker: TICKER, range }), true, q);
  }
});

test('history route error mapping: unknown market 404, unsupported 422, metadata failure 502 — sanitized, no-store, no history requests', async () => {
  for (const [label, market, status] of [
    ['404', () => new Response(SECRET, { status: 404 }), 404],
    ['unsupported', () => ({ market: rawMarket({ market_type: 'scalar' }) }), 422],
    ['metadata 500', () => new Response(SECRET, { status: 500 }), 502],
    ['ticker mismatch', () => ({ market: rawMarket({ ticker: 'KXSYN-OTHER' }) }), 502],
  ]) {
    mock.restoreAll();
    const calls = upstream(routeBy({ market }));
    const { res, body } = await invokeHistory('?range=24h');
    assert.equal(res.status, status, label);
    assert.equal(typeof body.error, 'string', label);
    assert.doesNotMatch(JSON.stringify(body), /UPSTREAM-SECRET/, label);
    assert.match(res.headers.get('cache-control') ?? '', /no-store/, label);
    assert.equal(calls.filter(c => HISTORY_KINDS.includes(c.kind)).length, 0, label);
  }
});

test('history route: one failed section is a 200 partial payload, not a whole-route error', async () => {
  upstream(routeBy({ event: () => new Response(SECRET, { status: 500 }) }));
  let { res, body } = await invokeHistory('?range=24h');
  assert.equal(res.status, 200);
  assert.equal(body.candles.ok, false);
  assert.equal(body.trades.ok, true);
  assert.doesNotMatch(JSON.stringify(body), /UPSTREAM-SECRET/);
  assert.equal(lib().isKalshiHistory(body, { ticker: TICKER, range: '24h' }), true);
  mock.restoreAll();
  upstream(routeBy({ trades: () => ({ trades: [] }) })); // missing required cursor
  ({ res, body } = await invokeHistory('?range=24h'));
  assert.equal(res.status, 200);
  assert.equal(body.candles.ok, true);
  assert.equal(body.trades.ok, false);
});

/* =================== client payload validation =================== */
test('isKalshiHistory accepts the normalized payload and rejects ticker/range/window/period/row/status violations', () => {
  const { isKalshiHistory } = lib();
  const exp = { ticker: TICKER, range: '24h' };
  assert.equal(isKalshiHistory(validHistory(), exp), true);
  const errSection = { ok: false, status: 502, error: 'Kalshi data is temporarily unavailable or malformed.' };
  assert.equal(isKalshiHistory({ ...validHistory(), candles: errSection, trades: { ...errSection, status: 503 } }, exp), true);
  const mutants = [
    ['expected other ticker', h => h, { ticker: 'KXSYN-OTHER', range: '24h' }],
    ['expected other range', h => h, { ticker: TICKER, range: '7d' }],
    ['window span not 24h', h => { h.window.startTs += H; }],
    ['period wrong for range', h => { h.window.periodMinutes = 1; }],
    ['sourceAsOf faked', h => { h.sourceAsOf = h.retrievedAt; }],
    ['bad retrievedAt', h => { h.retrievedAt = 'now'; }],
    ['point outside window', h => { h.candles.data.points[0].endTs = END + H; }],
    ['unsorted points', h => { h.candles.data.points.reverse(); }],
    ['duplicate point', h => { h.candles.data.points[1].endTs = S + H; }],
    ['close above 1', h => { h.candles.data.points[0].yesClose = 1.2; }],
    ['close undefined (not an explicit null gap)', h => { delete h.candles.data.points[1].yesClose; }],
    ['negative volume', h => { h.candles.data.points[0].volumeContracts = -1; }],
    ['bad series', h => { h.candles.data.seriesTicker = '../X'; }],
    ['zero-contract trade', h => { h.trades.data.trades[0].countContracts = 0; }],
    ['guessed buy side', h => { h.trades.data.trades[0].takerOutcomeSide = 'buy'; }],
    ['trade outside window', h => { h.trades.data.trades[0].createdTime = iso(S - H); }],
    ['non-boolean block flag', h => { h.trades.data.trades[0].isBlockTrade = 'true'; }],
    ['missing hasMore', h => { delete h.trades.data.hasMore; }],
    ['51 trades', h => { h.trades.data.trades = Array.from({ length: 51 }, (_, k) => ({ ...h.trades.data.trades[0], tradeId: `t${k}` })); }],
    ['ok section without data', h => { h.candles = { ok: true }; }],
    ['error section with unknown status', h => { h.trades = { ok: false, status: 200, error: 'x' }; }],
  ];
  for (const [label, mutate, expected = exp] of mutants) {
    const h = validHistory();
    mutate(h);
    assert.equal(isKalshiHistory(h, expected), false, label);
  }
});

/* =================== market detail page (server render) =================== */
async function renderDetail() {
  const Page = load()(DETAIL).default;
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ ticker: TICKER }) }));
}
const dataPoints = html => [...html.matchAll(/<circle\b[^>]*data-ts="(\d+)"/g)].map(m => Number(m[1]));

test('detail page server-renders the default 24h chart and real trade cells from one verified market fetch, book intact', async () => {
  const calls = upstream(routeBy());
  const html = await renderDetail();
  assert.equal(ofKind(calls, 'market').length, 1); // no extra market fetch for history
  for (const k of ['book', ...HISTORY_KINDS]) assert.equal(ofKind(calls, k).length, 1, k);
  const c = ofKind(calls, 'candles')[0].url.searchParams;
  assert.equal(c.get('period_interval'), '60');
  assert.equal(Number(c.get('end_ts')) - Number(c.get('start_ts')), 86400);
  assert.equal(dataPoints(html).length, 3); // 21¢, 23¢, 24¢ — the no-trade period has no point
  assert.match(html, /<svg[^>]*role="img"/);
  assert.match(html, /No trade/);
  assert.match(html, /37¢/);
  assert.match(html, /63¢/);
  assert.match(html, /Taker outcome/);
  assert.match(html, /<button[^>]*aria-pressed="true"[^>]*>24h<\/button>/);
  assert.match(html, /<td>2¢<\/td>/); // book table unchanged
  assert.match(html, /Synthetic primary rule\./);
});

test('detail page fetches the book and the history concurrently', async () => {
  let bookSeen = false, eventSeen = false, bookDuringEvent = null, eventDuringBook = null;
  upstream(routeBy({
    book: async () => { bookSeen = true; eventDuringBook = await waitFor(() => eventSeen); return rawBook(); },
    event: async () => { eventSeen = true; bookDuringEvent = await waitFor(() => bookSeen); return eventBody(); },
  }));
  await renderDetail();
  assert.equal(eventDuringBook, true);
  assert.equal(bookDuringEvent, true);
});

test('detail page: history sections fail independently of each other and of metadata/book', async () => {
  upstream(routeBy({ event: () => new Response(SECRET, { status: 500 }) }));
  let html = await renderDetail();
  assert.match(html, /Price chart unavailable/);
  assert.equal(dataPoints(html).length, 0);
  assert.match(html, /37¢/);
  assert.match(html, /<td>2¢<\/td>/);
  assert.doesNotMatch(html, /UPSTREAM-SECRET/);
  mock.restoreAll();
  upstream(routeBy({ trades: () => new Response(SECRET, { status: 500 }) }));
  html = await renderDetail();
  assert.match(html, /Recent trades unavailable/);
  assert.equal(dataPoints(html).length, 3);
  assert.doesNotMatch(html, /37¢/);
  mock.restoreAll();
  upstream(routeBy({ book: () => new Response(SECRET, { status: 500 }) }));
  html = await renderDetail();
  assert.match(html, /Order book is temporarily unavailable/);
  assert.equal(dataPoints(html).length, 3);
});

test('detail page: unsupported market shows a history-not-supported note and makes no history requests', async () => {
  const calls = upstream(routeBy({ market: () => ({ market: rawMarket({ market_type: 'scalar' }) }) }));
  const html = await renderDetail();
  assert.match(html, /Price history is not supported for this market/);
  assert.equal(calls.filter(c => HISTORY_KINDS.includes(c.kind)).length, 0);
  assert.equal(dataPoints(html).length, 0);
});

/* =================== source boundaries (not behavior proof) =================== */
test('source: history client is a native-SVG, dependency-free client component using theme tokens', () => {
  const s = src(CLIENT);
  assert.match(s, /^['"]use client['"]/);
  for (const [, spec] of s.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    assert.ok(spec === 'react' || spec.startsWith('@/lib/'), `unexpected import ${spec}`);
  }
  assert.doesNotMatch(s, /gradient|purple|violet|<img|SYNTHETIC|mockData|dangerouslySetInnerHTML|kalshi\.com/i);
  assert.match(s, /var\(--|text-ink/);
  assert.match(s, /<svg/);
  assert.match(s, /new AbortController\(\)/);
});
