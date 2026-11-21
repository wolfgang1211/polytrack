/* COMPONENT-HANDLER tests for KalshiEventsClient and event-bound KalshiMarketsClient — NOT browser proof.
   Same deterministic hook shim as tests/kalshi-client.test.cjs (useState/useRef/useMemo/useEffect replaced only inside
   this isolated loader). Real onClick handlers are invoked; fetch is mocked. Layout, focus, real event dispatch,
   disabled-button semantics and React scheduling are NOT exercised. Every fixture is SYNTHETIC. */
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '..');
afterEach(() => mock.restoreAll());

function makeLoader(mocks) {
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

function harness(file, props) {
  const slots = [];
  let i = 0;
  const hooks = {
    useState(init) {
      const k = i++;
      if (!(k in slots)) slots[k] = typeof init === 'function' ? init() : init;
      return [slots[k], u => { slots[k] = typeof u === 'function' ? u(slots[k]) : u; }];
    },
    useRef(init) { const k = i++; if (!(k in slots)) slots[k] = { current: init }; return slots[k]; },
    useMemo(fn) { i++; return fn(); },
    useEffect() { i++; },
  };
  const Link = ({ href, children, ...rest }) => React.createElement('a', { href, ...rest }, children);
  const Client = makeLoader({ react: { ...React, ...hooks }, 'next/link': { __esModule: true, default: Link } })(file).default;
  const render = () => { i = 0; return Client(props); };
  const all = n => (Array.isArray(n) ? n.flatMap(all)
    : React.isValidElement(n) ? [n, ...React.Children.toArray(n.props.children).flatMap(all)] : []);
  const text = n => (typeof n === 'string' || typeof n === 'number' ? String(n)
    : React.isValidElement(n) ? React.Children.toArray(n.props.children).map(text).join('') : '');
  const h = {
    html: () => renderToStaticMarkup(render()),
    links: re => [...h.html().matchAll(re)].map(m => decodeURIComponent(m[1])),
    has: label => all(render()).some(n => n.type === 'button' && text(n).trim() === label),
    click: label => {
      const b = all(render()).find(n => n.type === 'button' && text(n).trim() === label);
      assert.ok(b, `button "${label}" not rendered`);
      return b.props.onClick();
    },
  };
  return h;
}

function mockFetch(...responders) {
  const calls = [];
  mock.method(globalThis, 'fetch', async input => {
    calls.push(new URL(String(input), 'http://localhost'));
    const next = responders.shift();
    assert.ok(next, 'unexpected extra fetch');
    return next(); // ignores the abort signal on purpose: late responses must be discarded by the component
  });
  return calls;
}
const json = (body, status = 200) => () => Response.json(body, { status });
function deferred() { let resolve; const p = new Promise(r => { resolve = r; }); return { p, resolve }; }

const T0 = '2026-11-19T10:00:00.000Z', T1 = '2026-11-19T10:05:00.000Z';
// SYNTHETIC fixtures (normalized shapes; values invented)
const ev = (eventTicker, o = {}) => ({
  eventTicker, seriesTicker: 'KXSYN', title: `Title ${eventTicker}`, subTitle: null, category: 'Cat',
  mutuallyExclusive: true, updatedTime: null, strikeDate: null, ...o,
});
const evPage = (events, nextCursor, receivedAt = T1, rejectedCount = 0) => ({ events, nextCursor, receivedAt, sourceAsOf: null, rejectedCount });
const mk = (ticker, eventTicker = 'KXSYN-26DEC') => ({
  ticker, eventTicker, title: `Title ${ticker}`, yesLabel: 'Y', noLabel: 'N', status: 'active', marketType: 'binary',
  closeTime: '2099-06-01T00:00:00Z', updatedTime: null, volume24hContracts: 1, totalVolumeContracts: 1, openInterestContracts: 1,
  yesBid: 0.4, yesAsk: 0.45, yesBidSize: 1, yesAskSize: 1, notionalDollars: 1, rulesPrimary: null, rulesSecondary: null,
});
const mkPage = (markets, nextCursor, receivedAt = T1) => ({ markets, nextCursor, receivedAt, sourceAsOf: null, rejectedCount: 0 });

const EVENTS = 'src/app/markets/KalshiEventsClient.tsx';
const MARKETS = 'src/app/markets/KalshiMarketsClient.tsx';
const eventLinks = h => h.links(/href="\/markets\/kalshi\/events\/([^"]+)"/g);
const marketLinks = h => h.links(/href="\/markets\/kalshi\/([^"/]+)"/g);

test('events: Load more sends the exact cursor, appends and dedupes by eventTicker', async () => {
  const h = harness(EVENTS, { initial: evPage([ev('KXSYN-A')], 'c1+/=', T0), initialError: null });
  const calls = mockFetch(json(evPage([ev('KXSYN-A'), ev('KXSYN-B', { category: 'Other' })], 'c2')));
  await h.click('Load more');
  assert.equal(calls[0].pathname, '/api/kalshi/events');
  assert.equal(calls[0].searchParams.get('cursor'), 'c1+/=');
  assert.equal(calls[0].searchParams.get('limit'), '50');
  assert.equal(calls[0].searchParams.has('series_ticker'), false);
  assert.deepEqual(eventLinks(h), ['KXSYN-A', 'KXSYN-B']);
  assert.match(h.html(), /Showing 2 of 2 loaded/);
  assert.match(h.html(), /<option[^>]*>Other<\/option>/);
  assert.ok(h.has('Load more'));
});

test('events: a repeated cursor stops paging visibly', async () => {
  const h = harness(EVENTS, { initial: evPage([ev('KXSYN-A')], 'c1', T0), initialError: null });
  mockFetch(json(evPage([ev('KXSYN-B')], 'c1')));
  await h.click('Load more');
  assert.equal(h.has('Load more'), false);
  assert.match(h.html(), /source repeated a cursor/);
});

test('events: Retry after a failed Load more re-requests the same cursor and keeps loaded rows', async () => {
  const h = harness(EVENTS, { initial: evPage([ev('KXSYN-A')], 'c1', T0), initialError: null });
  const calls = mockFetch(json({ error: 'Kalshi did not respond in time.' }, 504), json(evPage([ev('KXSYN-B')], null)));
  await h.click('Load more');
  assert.match(h.html(), /role="alert"/);
  assert.deepEqual(eventLinks(h), ['KXSYN-A']);
  await h.click('Retry');
  assert.deepEqual(calls.map(c => c.searchParams.get('cursor')), ['c1', 'c1']);
  assert.deepEqual(eventLinks(h), ['KXSYN-A', 'KXSYN-B']);
});

test('events: Refresh supersedes an in-flight Load more; the late page is discarded and paging resets', async () => {
  const h = harness(EVENTS, { initial: evPage([ev('KXSYN-A')], 'c1', T0), initialError: null });
  const late = deferred(), fresh = deferred();
  const calls = mockFetch(() => late.p, () => fresh.p);
  const more = h.click('Load more');
  const refresh = h.click('Refresh');
  fresh.resolve(Response.json(evPage([ev('KXSYN-C')], 'r2')));
  await refresh;
  late.resolve(Response.json(evPage([ev('KXSYN-LATE')], 'late-cursor')));
  await more;
  assert.equal(calls[1].searchParams.has('cursor'), false);
  assert.deepEqual(eventLinks(h), ['KXSYN-C']);
  assert.match(h.html(), /Showing 1 of 1 loaded/);
});

test('events: a series-bound client forwards series_ticker and rejects a success containing another series', async () => {
  const h = harness(EVENTS, { initial: evPage([ev('KXSYN-A')], 'c1', T0), initialError: null, seriesTicker: 'KXSYN' });
  const calls = mockFetch(json(evPage([ev('KXOTHER-1', { seriesTicker: 'KXOTHER' })], 'c2')), json(evPage([], null)));
  await h.click('Load more');
  assert.equal(calls[0].searchParams.get('series_ticker'), 'KXSYN');
  assert.match(h.html(), /different series/);
  assert.deepEqual(eventLinks(h), ['KXSYN-A']);
  await h.click('Refresh');
  assert.equal(calls[1].searchParams.get('series_ticker'), 'KXSYN');
});

test('events: a malformed success envelope never replaces loaded state', async () => {
  const h = harness(EVENTS, { initial: evPage([ev('KXSYN-A')], 'c1', T0), initialError: null });
  mockFetch(json({ events: [ev('KXSYN-B', { mutuallyExclusive: 'false' })], nextCursor: 'c2', receivedAt: T1, sourceAsOf: null, rejectedCount: 0 }));
  await h.click('Load more');
  assert.match(h.html(), /malformed event page/);
  assert.deepEqual(eventLinks(h), ['KXSYN-A']);
});

// Raw upstream uses cursor:'' for exhaustion; the normalized same-origin page must say nextCursor:null instead.
test('a same-origin success carrying the raw nextCursor:"" sentinel is rejected without replacing loaded data', async () => {
  const e = harness(EVENTS, { initial: evPage([ev('KXSYN-A')], 'c1', T0), initialError: null });
  mockFetch(json(evPage([ev('KXSYN-B')], '')));
  await e.click('Load more');
  assert.match(e.html(), /malformed event page/);
  assert.deepEqual(eventLinks(e), ['KXSYN-A']);
  assert.ok(e.has('Retry'));
  mock.restoreAll();
  const m = harness(MARKETS, { initial: mkPage([mk('KXSYN-26DEC-T1')], 'c1', T0), initialError: null, eventTicker: 'KXSYN-26DEC' });
  mockFetch(json(mkPage([mk('KXSYN-26DEC-T2')], '')));
  await m.click('Load more');
  assert.match(m.html(), /malformed market page/);
  assert.deepEqual(marketLinks(m), ['KXSYN-26DEC-T1']);
});

test('event-bound markets client keeps event_ticker on load more, Retry and refresh, and rejects foreign-event rows', async () => {
  const h = harness(MARKETS, { initial: mkPage([mk('KXSYN-26DEC-T1')], 'c1', T0), initialError: null, eventTicker: 'KXSYN-26DEC' });
  assert.match(h.html(), /Open binary \$1 markets/);
  const calls = mockFetch(
    json({ error: 'Kalshi data is temporarily unavailable or malformed.' }, 502),
    json(mkPage([mk('KXSYN-26DEC-T2')], 'c2')),
    json(mkPage([mk('KXOTHER-1-T1', 'KXOTHER-1')], null)),
    json(mkPage([mk('KXSYN-26DEC-T3')], null)),
  );
  await h.click('Load more');
  await h.click('Retry');
  assert.deepEqual(marketLinks(h), ['KXSYN-26DEC-T1', 'KXSYN-26DEC-T2']);
  await h.click('Load more');
  assert.match(h.html(), /different event/);
  assert.deepEqual(marketLinks(h), ['KXSYN-26DEC-T1', 'KXSYN-26DEC-T2']);
  await h.click('Refresh');
  assert.deepEqual(marketLinks(h), ['KXSYN-26DEC-T3']);
  assert.deepEqual(calls.map(c => c.searchParams.get('event_ticker')), Array(4).fill('KXSYN-26DEC'));
  assert.deepEqual(calls.map(c => c.searchParams.get('cursor')), ['c1', 'c1', 'c2', null]);
});
