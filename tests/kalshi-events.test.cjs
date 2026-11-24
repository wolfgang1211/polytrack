/* RED-first tests for read-only Kalshi EVENT browsing and bounded event -> markets navigation.
   Adapter (src/lib/kalshiEvents.ts + additions to src/lib/kalshi.ts), API routes and server-rendered pages are
   transpiled from the real TypeScript sources; global fetch is mocked. Pages render with ReactDOMServer; only
   next/link, next/navigation and the Polymarket data/client modules are stubbed. No browser, no network.
   Every fixture is SYNTHETIC and never a live result. */
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { NextRequest } = require('next/server');

const root = path.resolve(__dirname, '..');
const BASE = 'https://external-api.kalshi.com/trade-api/v2';
const AUTH_HEADERS = ['authorization', 'cookie', 'kalshi-access-key', 'kalshi-access-signature', 'kalshi-access-timestamp'];
const SECRET = 'UPSTREAM-SECRET-BODY-must-not-leak';
const NOT_FOUND = 'NEXT_NOT_FOUND';

// Resolves '@/', relative and extensionless .ts/.tsx imports so kalshiEvents.ts may import './kalshi' or '@/lib/kalshi'.
function makeLoader(mocks = {}) {
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
    new Function('exports', 'require', 'module', '__filename', '__dirname', out)(mod.exports, req, mod, file, path.dirname(file));
    return mod.exports;
  }
  return load;
}
const load = makeLoader();
// Loaded lazily so each test fails on its own while the implementation is missing.
const K = () => load('src/lib/kalshi.ts');
const E = () => load('src/lib/kalshiEvents.ts');
const kerr = status => e => e instanceof K().KalshiError && e.status === status;
const routes = {
  event: 'src/app/api/kalshi/events/[eventTicker]/route.ts',
  markets: 'src/app/api/kalshi/markets/route.ts',
};

// SYNTHETIC fixture (shape mirrors observed live sample; values invented)
const rawEvent = (o = {}) => ({
  event_ticker: 'KXSYN-26DEC', series_ticker: 'KXSYN', title: 'Synthetic event?', sub_title: 'On Dec 31, 2099',
  category: 'Synthetic Category', mutually_exclusive: true, last_updated_ts: '2026-11-01T03:24:48.885736Z',
  strike_date: '2099-12-31T19:00:00Z', strike_period: '', collateral_return_type: 'MECNET', exchange_index: 0,
  settlement_sources: [{ name: 'Synthetic source', url: 'https://example.invalid/' }],
  ...o,
});
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
// SYNTHETIC fixture (shape mirrors observed live sample; values invented)
const rawBook = () => ({ orderbook_fp: { yes_dollars: [['0.0100', '10.00']], no_dollars: [['0.9700', '7.00']] } });
const foreignMarket = () => rawMarket({ ticker: 'KXOTHER-1-T1', event_ticker: 'KXOTHER-1', title: 'Foreign child market' });

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
    assert.equal(init?.redirect, 'error');
  }
}
class BodyTimeoutResponse extends Response {
  json() { return Promise.reject(new DOMException('body timed out', 'TimeoutError')); }
  text() { return Promise.reject(new DOMException('body timed out', 'TimeoutError')); }
}
const EVENT_PATH = '/trade-api/v2/events/KXSYN-26DEC';
// Routes upstream by path: event detail vs. bounded child markets list.
const byPath = ({ event = () => ({ event: rawEvent() }), markets = () => ({ markets: [rawMarket()], cursor: '' }) } = {}) => url =>
  url.pathname.startsWith('/trade-api/v2/events/') ? event(url)
    : url.pathname === '/trade-api/v2/markets' ? markets(url) : new Response('unexpected path', { status: 500 });

async function invokeEvent(eventTicker) {
  const req = new NextRequest(`http://localhost/api/kalshi/events/${encodeURIComponent(eventTicker)}`);
  const res = await load(routes.event).GET(req, { params: Promise.resolve({ eventTicker }) });
  return { res, body: await res.json() };
}
async function invokeMarkets(search = '') {
  const res = await load(routes.markets).GET(new NextRequest(`http://localhost/api/kalshi/markets${search}`));
  return { res, body: await res.json() };
}
const noStore = res => assert.match(res.headers.get('cache-control') ?? '', /no-store/);

// ---------- page rendering helpers ----------
const nextMocks = () => ({
  'next/link': { __esModule: true, default: ({ href, children, ...rest }) => {
    delete rest.prefetch;
    return React.createElement('a', { href, ...rest }, children);
  } },
  'next/navigation': { notFound: () => { throw Object.assign(new Error(NOT_FOUND), { digest: NOT_FOUND }); } },
  '@/lib/markets': { fetchMarketsList: async () => [] },
  './MarketsClient': { __esModule: true, default: () => React.createElement('div', { 'data-stub': 'polymarket-client' }) },
});
const EVENT_PAGE = 'src/app/markets/kalshi/events/[eventTicker]/page.tsx';
async function renderEvent(eventTicker) {
  const Page = makeLoader(nextMocks())(EVENT_PAGE).default;
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ eventTicker }) }));
}
const rejectsNotFound = p => assert.rejects(p, e => e?.digest === NOT_FOUND);
const attrs = s => Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2].replace(/&amp;/g, '&')]));
const anchors = html => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(m => ({ ...attrs(m[1]), text: m[2].replace(/<[^>]+>/g, '').trim() }));
// "Label: value" in any markup (dt/dd, p/p, span) — value must end at a tag boundary.
const labeled = (label, value) => new RegExp(`${label}(?:\\s|:|<[^>]*>)*${value}(?=\\s*<)`, 'i');
afterEach(() => mock.restoreAll());

// ---------- normalizeEvent ----------
test('normalizeEvent returns exactly the eight published fields and invents no status', () => {
  const ev = E().normalizeEvent({ ...rawEvent(), markets: [rawMarket()], status: 'open' });
  assert.deepEqual(ev, {
    eventTicker: 'KXSYN-26DEC', seriesTicker: 'KXSYN', title: 'Synthetic event?', subTitle: 'On Dec 31, 2099',
    category: 'Synthetic Category', mutuallyExclusive: true, updatedTime: '2026-11-01T03:24:48.885736Z',
    strikeDate: '2099-12-31T19:00:00Z',
  });
  // Category is kept as published (no taxonomy guessing); non-string optional fields become null.
  const other = E().normalizeEvent(rawEvent({ category: 'Science and Technology', sub_title: 42 }));
  assert.equal(other.category, 'Science and Technology');
  assert.equal(other.subTitle, null);
  assert.equal(E().normalizeEvent(rawEvent({ category: { name: 'x' } })).category, null);
});

test('mutuallyExclusive is a boolean only when the source sends a real boolean', () => {
  for (const [input, expected] of [[true, true], [false, false], ['false', null], ['true', null], [1, null], [0, null], [null, null], [undefined, null]]) {
    assert.equal(E().normalizeEvent(rawEvent({ mutually_exclusive: input })).mutuallyExclusive, expected, JSON.stringify(input) ?? 'undefined');
  }
});

// Observed live format for last_updated_ts / strike_date: RFC 3339 date-time with a timezone (e.g. 2026-11-13T01:45:27.378586Z).
test('updatedTime and strikeDate keep valid timezone-bearing ISO timestamps and null everything else', () => {
  const ok = E().normalizeEvent(rawEvent({ strike_date: '2026-12-09T19:00:00Z' }));
  assert.equal(ok.strikeDate, '2026-12-09T19:00:00Z');
  assert.equal(ok.updatedTime, '2026-11-01T03:24:48.885736Z');
  for (const bad of ['2099-13-45T00:00:00Z', 'soon', '', '2026-12-09', '2026-12-09T19:00:00', 1765306800, null, undefined]) {
    const ev = E().normalizeEvent(rawEvent({ last_updated_ts: bad, strike_date: bad }));
    assert.notEqual(ev, null);
    assert.equal(ev.updatedTime, null, JSON.stringify(bad) ?? 'undefined');
    assert.equal(ev.strikeDate, null, JSON.stringify(bad) ?? 'undefined');
  }
});

test('normalizeEvent quarantines rows without strict identifiers or a title', () => {
  for (const [label, raw] of [
    ['missing event_ticker', rawEvent({ event_ticker: undefined })], ['lowercase event_ticker', rawEvent({ event_ticker: 'kxsyn-26dec' })],
    ['path-like event_ticker', rawEvent({ event_ticker: '../KXSYN' })], ['numeric event_ticker', rawEvent({ event_ticker: 123 })],
    ['missing series_ticker', rawEvent({ series_ticker: undefined })], ['spaced series_ticker', rawEvent({ series_ticker: 'KX SYN' })],
    ['empty title', rawEvent({ title: '' })], ['non-string title', rawEvent({ title: 5 })], ['missing title', rawEvent({ title: undefined })],
    ['null row', null], ['array row', [rawEvent()]], ['string row', 'KXSYN-26DEC'],
  ]) assert.equal(E().normalizeEvent(raw), null, label);
});

// ---------- transport ----------
test('getKalshiJson is the exported fixed-host GET transport', async () => {
  const calls = upstream(() => ({ ok: true }));
  assert.deepEqual(await K().getKalshiJson('/events', { status: 'open', limit: '3' }), { ok: true });
  assertSafeCalls(calls);
  assert.equal(calls[0].url.pathname, '/trade-api/v2/events');
  assert.equal(calls[0].url.searchParams.get('limit'), '3');
});

// ---------- fetchKalshiEvents ----------
// ---------- fetchKalshiEvent ----------
test('fetchKalshiEvent requests metadata with exclude_markets=true and never returns embedded markets', async () => {
  const calls = upstream(() => ({ event: { ...rawEvent(), markets: [rawMarket()] }, markets: [] }));
  const r = await E().fetchKalshiEvent('KXSYN-26DEC');
  assertSafeCalls(calls);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, EVENT_PATH);
  assert.equal(calls[0].url.searchParams.get('exclude_markets'), 'true');
  assert.notEqual(calls[0].url.searchParams.get('with_nested_markets'), 'true');
  assert.deepEqual(Object.keys(r).sort(), ['event', 'receivedAt', 'sourceAsOf']);
  assert.deepEqual(r.event, E().normalizeEvent(rawEvent()));
  assert.equal(r.sourceAsOf, null);
});

test('fetchKalshiEvent: ticker mismatch or malformed event is 502; an invalid ticker is 400 with zero network', async () => {
  for (const body of [{ event: rawEvent({ event_ticker: 'KXSYN-OTHER' }) }, { event: rawEvent({ title: undefined }) }, {}, { event: null }]) {
    mock.restoreAll();
    upstream(() => body);
    await assert.rejects(E().fetchKalshiEvent('KXSYN-26DEC'), kerr(502), JSON.stringify(body));
  }
  mock.restoreAll();
  const calls = upstream(() => ({ event: rawEvent() }));
  for (const bad of ['kxsyn-26dec', '', '../KXSYN', 'KX/SYN']) await assert.rejects(E().fetchKalshiEvent(bad), kerr(400), bad);
  assert.equal(calls.length, 0);
});

for (const [label, respond, status] of [
  ['404 preserved', () => new Response(SECRET, { status: 404 }), 404],
  ['429 becomes 503', () => new Response(SECRET, { status: 429 }), 503],
  ['500 becomes 502', () => new Response(SECRET, { status: 500 }), 502],
  ['network failure becomes 502', () => { throw new TypeError('fetch failed'); }, 502],
  ['fetch-phase TimeoutError becomes 504', () => { throw new DOMException('timed out', 'TimeoutError'); }, 504],
  ['AbortError becomes 504', () => { throw new DOMException('aborted', 'AbortError'); }, 504],
  ['body-phase timeout becomes 504', () => new BodyTimeoutResponse('{}', { status: 200 }), 504],
]) {
  test(`fetchKalshiEvent error mapping: ${label}`, async () => {
    upstream(respond);
    await assert.rejects(E().fetchKalshiEvent('KXSYN-26DEC'), kerr(status));
  });
}

// ---------- client guard ----------
// ---------- query parsing ----------
test('parseListQuery accepts a strict, non-repeated event_ticker and keeps its default shape', () => {
  const p = sp => K().parseListQuery(new URLSearchParams(sp));
  assert.deepEqual(p(''), { limit: 100 });
  assert.deepEqual(p('event_ticker=KXSYN-26DEC'), { limit: 100, eventTicker: 'KXSYN-26DEC' });
  assert.deepEqual(p('limit=20&cursor=c1&event_ticker=KXSYN-26DEC'), { limit: 20, cursor: 'c1', eventTicker: 'KXSYN-26DEC' });
  for (const q of ['event_ticker=kxsyn', 'event_ticker=', 'event_ticker=KX%2FSYN', 'event_ticker=KXA&event_ticker=KXA']) {
    assert.throws(() => p(q), kerr(400), q);
  }
});

test('fetchKalshiMarkets({eventTicker}) sends event_ticker and quarantines foreign child rows; default request has none', async () => {
  let calls = upstream(() => ({ markets: [rawMarket(), foreignMarket()], cursor: '' }));
  const r = await K().fetchKalshiMarkets({ limit: 20, eventTicker: 'KXSYN-26DEC' });
  assertSafeCalls(calls);
  const sp = calls[0].url.searchParams;
  assert.equal(sp.get('event_ticker'), 'KXSYN-26DEC');
  assert.equal(sp.get('status'), 'open');
  assert.equal(sp.get('mve_filter'), 'exclude');
  assert.deepEqual(r.markets.map(m => m.ticker), ['KXSYN-26DEC-T1']);
  assert.equal(r.rejectedCount, 1);
  mock.restoreAll();
  calls = upstream(() => ({ markets: [rawMarket(), foreignMarket()], cursor: '' }));
  const all = await K().fetchKalshiMarkets({ limit: 20 });
  assert.equal(calls[0].url.searchParams.has('event_ticker'), false);
  assert.equal(all.markets.length, 2);
  mock.restoreAll();
  calls = upstream(() => ({ markets: [], cursor: '' }));
  await assert.rejects(K().fetchKalshiMarkets({ limit: 20, eventTicker: 'kxsyn' }), kerr(400));
  assert.equal(calls.length, 0);
});

// ---------- routes ----------
test('kalshi event routes are GET-only (no POST handler)', () => {
  for (const file of [routes.event]) {
    const mod = load(file);
    assert.equal(typeof mod.GET, 'function', file);
    assert.equal(mod.POST, undefined, file);
  }
});

test('event detail route rejects invalid tickers with 400 and zero network (awaited Promise params)', async () => {
  const calls = upstream(() => ({ event: rawEvent() }));
  for (const t of ['kxsyn', '', '-KXSYN', 'KX SYN', 'KX/SYN', '../KXSYN', `K${'X'.repeat(100)}`]) {
    const { res, body } = await invokeEvent(t);
    assert.equal(res.status, 400, JSON.stringify(t));
    assert.equal(typeof body.error, 'string');
    noStore(res);
  }
  assert.equal(calls.length, 0);
});

test('event detail route returns the normalized event and maps 404/429/timeout/mismatch without leaking', async () => {
  const calls = upstream(() => ({ event: rawEvent() }));
  const ok = await invokeEvent('KXSYN-26DEC');
  assert.equal(ok.res.status, 200);
  assertSafeCalls(calls);
  assert.equal(calls[0].url.pathname, EVENT_PATH);
  assert.equal(calls[0].url.searchParams.get('exclude_markets'), 'true');
  assert.equal(ok.body.event.eventTicker, 'KXSYN-26DEC');
  assert.equal(ok.body.sourceAsOf, null);
  for (const [respond, status] of [
    [() => new Response(SECRET, { status: 404 }), 404], [() => new Response(SECRET, { status: 429 }), 503],
    [() => { throw new DOMException('timed out', 'TimeoutError'); }, 504], [() => new BodyTimeoutResponse('{}', { status: 200 }), 504],
    [() => ({ event: rawEvent({ event_ticker: 'KXSYN-OTHER' }) }), 502],
  ]) {
    mock.restoreAll();
    upstream(respond);
    const { res, body } = await invokeEvent('KXSYN-26DEC');
    assert.equal(res.status, status);
    assert.equal(body.event, undefined);
    assert.doesNotMatch(JSON.stringify(body), /UPSTREAM-SECRET/);
    noStore(res);
  }
});

test('markets route forwards event_ticker, quarantines foreign children and rejects bad event_ticker with zero network', async () => {
  let calls = upstream(() => ({ markets: [rawMarket(), foreignMarket()], cursor: '' }));
  const { res, body } = await invokeMarkets('?limit=20&event_ticker=KXSYN-26DEC');
  assert.equal(res.status, 200);
  assert.equal(calls[0].url.searchParams.get('event_ticker'), 'KXSYN-26DEC');
  assert.equal(calls[0].url.searchParams.get('mve_filter'), 'exclude');
  assert.deepEqual(body.markets.map(m => m.ticker), ['KXSYN-26DEC-T1']);
  assert.equal(body.rejectedCount, 1);
  mock.restoreAll();
  calls = upstream(() => ({ markets: [], cursor: '' }));
  for (const q of ['?event_ticker=kxsyn', '?event_ticker=', '?event_ticker=KX%2FSYN', '?event_ticker=KXA&event_ticker=KXA']) {
    const r = await invokeMarkets(q);
    assert.equal(r.res.status, 400, q);
  }
  assert.equal(calls.length, 0);
});

// ---------- /markets view selection ----------
// ---------- event detail page ----------
test('event page renders metadata and only its own open child markets from awaited params', async () => {
  const calls = upstream(byPath({ markets: () => ({ markets: [rawMarket(), foreignMarket()], cursor: '' }) }));
  const html = await renderEvent('KXSYN-26DEC');
  assertSafeCalls(calls);
  const ev = calls.find(c => c.url.pathname === EVENT_PATH);
  assert.ok(ev, 'event metadata not requested');
  assert.equal(ev.url.searchParams.get('exclude_markets'), 'true');
  const kids = calls.filter(c => c.url.pathname === '/trade-api/v2/markets');
  assert.equal(kids.length, 1);
  assert.equal(kids[0].url.searchParams.get('event_ticker'), 'KXSYN-26DEC');
  assert.equal(kids[0].url.searchParams.get('status'), 'open');
  assert.equal(calls.length, 2);
  assert.match(html, /Synthetic event\?/);
  assert.match(html, labeled('Category', 'Synthetic Category'));
  assert.match(html, labeled('Series', 'KXSYN'));
  assert.match(html, labeled('Strike date', '2099-12-31 19:00 UTC'));
  assert.match(html, labeled('Mutually exclusive', 'Yes'));
  assert.match(html, /Open binary \$1 markets/);
  assert.match(html, /href="\/markets\/kalshi\/KXSYN-26DEC-T1"/);
  assert.doesNotMatch(html, /KXOTHER-1-T1|Foreign child market/);
  assert.equal(anchors(html).some(a => a.href === '/markets?platform=kalshi'), true, 'back link to the Kalshi explorer');
});

test('event page shows mutually exclusive as No or Unavailable without coercion', async () => {
  for (const [value, label] of [[false, 'No'], ['false', 'Unavailable'], [undefined, 'Unavailable']]) {
    mock.restoreAll();
    upstream(byPath({ event: () => ({ event: rawEvent({ mutually_exclusive: value }) }) }));
    assert.match(await renderEvent('KXSYN-26DEC'), labeled('Mutually exclusive', label), JSON.stringify(value) ?? 'undefined');
  }
});

test('event page: invalid ticker is notFound with zero network; upstream 404 is notFound', async () => {
  const calls = upstream(byPath());
  await rejectsNotFound(renderEvent('kxsyn-lower'));
  await rejectsNotFound(renderEvent('../KXSYN'));
  assert.equal(calls.length, 0);
  mock.restoreAll();
  upstream(byPath({ event: () => new Response('x', { status: 404 }) }));
  await rejectsNotFound(renderEvent('KXSYN-NOPE'));
});

test('event page: other event failures are an unavailable state, not a 404, and never leak upstream text', async () => {
  for (const respond of [() => new Response(SECRET, { status: 500 }), () => ({ event: rawEvent({ event_ticker: 'KXSYN-OTHER' }) })]) {
    mock.restoreAll();
    upstream(byPath({ event: respond }));
    const html = await renderEvent('KXSYN-26DEC');
    assert.match(html, /role="alert"/);
    assert.match(html, /unavailable/i);
    assert.doesNotMatch(html, /UPSTREAM-SECRET/);
    assert.equal(anchors(html).some(a => a.href === '/markets?platform=kalshi'), true);
  }
});

test('event page: child list failure keeps event metadata and hands an error with Retry to the child client', async () => {
  upstream(byPath({ markets: () => new Response(SECRET, { status: 500 }) }));
  const html = await renderEvent('KXSYN-26DEC');
  assert.match(html, /Synthetic event\?/);
  assert.match(html, labeled('Category', 'Synthetic Category'));
  assert.match(html, /Open binary \$1 markets/);
  assert.match(html, /role="alert"/);
  assert.match(html, />Retry</);
  assert.doesNotMatch(html, />Load more</);
  assert.doesNotMatch(html, /UPSTREAM-SECRET/);
});

test('event page generateMetadata uses a canonical event URL with zero provider requests', async () => {
  const calls = upstream(byPath());
  const { generateMetadata } = makeLoader(nextMocks())(EVENT_PAGE);
  const m = await generateMetadata({ params: Promise.resolve({ eventTicker: 'KXSYN-26DEC' }) });
  assert.equal(m.alternates.canonical, '/markets/kalshi/events/KXSYN-26DEC');
  await generateMetadata({ params: Promise.resolve({ eventTicker: '../x' }) });
  assert.equal(calls.length, 0);
});

test('market detail page links to its parent event page', async () => {
  upstream(url => (url.pathname.endsWith('/orderbook') ? rawBook() : { market: rawMarket() }));
  const Page = makeLoader(nextMocks())('src/app/markets/kalshi/[ticker]/page.tsx').default;
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ ticker: 'KXSYN-26DEC-T1' }) }));
  assert.match(html, /href="\/markets\/kalshi\/events\/KXSYN-26DEC"/);
});
