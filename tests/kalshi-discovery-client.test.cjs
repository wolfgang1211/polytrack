/* COMPONENT-HANDLER tests for KalshiDiscoveryClient — NOT browser proof.
   Same deterministic hook shim as tests/kalshi-events-client.test.cjs (useState/useRef/useMemo/useEffect replaced only
   inside this isolated loader); function components are expanded so nested buttons are reachable. Real onClick/onChange
   handlers are invoked; fetch is mocked. Layout, focus, real event dispatch, disabled-button semantics and React
   scheduling are NOT exercised. Every fixture is SYNTHETIC (normalized shapes; values invented). */
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '..');
const CLIENT = 'src/app/markets/KalshiDiscoveryClient.tsx';
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

function harness(props) {
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
  const Client = makeLoader({ react: { ...React, ...hooks }, 'next/link': { __esModule: true, default: Link } })(CLIENT).default;
  const render = () => { i = 0; return Client(props); };
  // Hook-free child components (GroupCard, MarketRow, Link) are expanded so their buttons are reachable.
  const all = n => (Array.isArray(n) ? n.flatMap(all)
    : React.isValidElement(n) ? (typeof n.type === 'function' ? all(n.type(n.props))
      : [n, ...React.Children.toArray(n.props.children).flatMap(all)]) : []);
  const text = n => (typeof n === 'string' || typeof n === 'number' ? String(n)
    : React.isValidElement(n) ? React.Children.toArray(n.props.children).map(text).join('') : '');
  const find = (pred, what) => { const el = all(render()).find(pred); assert.ok(el, `${what} not rendered`); return el; };
  const h = {
    html: () => renderToStaticMarkup(render()),
    has: label => all(render()).some(n => n.type === 'button' && text(n).trim() === label),
    click: label => find(n => n.type === 'button' && text(n).trim() === label, `button "${label}"`).props.onClick(),
    select: value => find(n => n.type === 'select', 'select').props.onChange({ target: { value } }),
    search: value => find(n => n.type === 'input', 'search input').props.onChange({ target: { value } }),
    eventLinks: () => [...h.html().matchAll(/href="\/markets\/kalshi\/events\/([^"]+)"/g)].map(m => decodeURIComponent(m[1])),
    marketLinks: () => [...h.html().matchAll(/href="\/markets\/kalshi\/([^"/]+)"/g)].map(m => decodeURIComponent(m[1])),
  };
  return h;
}

function mockFetch(...responders) {
  const calls = [];
  mock.method(globalThis, 'fetch', async (input, init) => {
    calls.push({ url: new URL(String(input), 'http://localhost'), init });
    const next = responders.shift();
    assert.ok(next, 'unexpected extra fetch');
    return next(); // ignores the abort signal on purpose: late responses must be discarded by the component
  });
  return calls;
}
const json = (body, status = 200) => () => Response.json(body, { status });
function deferred() { let resolve, reject; const p = new Promise((a, b) => { resolve = a; reject = b; }); return { p, resolve, reject }; }

const T0 = '2026-11-19T10:00:00.000Z', T1 = '2026-11-19T10:05:00.000Z';
const ev = (eventTicker, o = {}) => ({
  eventTicker, seriesTicker: eventTicker.split('-')[0], title: `Title ${eventTicker}`, subTitle: null, category: 'Sports',
  mutuallyExclusive: true, updatedTime: null, strikeDate: null, ...o,
});
const mk = (ticker, o = {}) => ({
  ticker, eventTicker: ticker.replace(/-T\d+$/, ''), title: `Market ${ticker}`, yesLabel: `Outcome ${ticker}`, noLabel: null,
  status: 'active', marketType: 'binary', closeTime: '2099-06-01T00:00:00Z', updatedTime: null, volume24hContracts: 5,
  totalVolumeContracts: 9, openInterestContracts: 3, yesBid: 0.41, yesAsk: 0.43, yesBidSize: 1, yesAskSize: 1,
  notionalDollars: 1, rulesPrimary: null, rulesSecondary: null, ...o,
});
const group = (eventTicker, markets, o = {}) => ({ eventTicker, event: ev(eventTicker), metadataStatus: 'loaded', markets, ...o });
const coverage = (o = {}) => ({
  tradePages: 1, tradesScanned: 10, rejectedTrades: 0, uniqueTickers: 5, selectedTickers: 5, moreTradesAvailable: false,
  oldestTradeAt: '2026-11-19T09:00:00.123456Z', newestTradeAt: '2026-11-19T09:59:00.123456Z', marketPages: 1, rejectedMarkets: 0,
  eventMetadataRequested: 2, eventMetadataFailed: 0, truncated: false,
  windowStart: '2026-11-18T10:00:00.000Z', windowEnd: '2026-11-19T10:00:00.000Z', ...o,
});
const page = (groups, receivedAt = T1, cov = {}) => ({ groups, receivedAt, sourceAsOf: null, coverage: coverage(cov) });
const initialPage = () => page([group('KXA-E1', [mk('KXA-E1-T1')]), group('KXB-E1', [mk('KXB-E1-T1')], { event: ev('KXB-E1', { category: 'Crypto' }) })], T0);

test('Refresh calls the query-free discovery API and replaces the sample after full validation', async () => {
  const h = harness({ initial: initialPage(), initialError: null });
  assert.deepEqual(h.eventLinks(), ['KXA-E1', 'KXB-E1']);
  const calls = mockFetch(json(page([group('KXC-E1', [mk('KXC-E1-T1')])])));
  await h.click('Refresh');
  assert.equal(calls[0].url.pathname, '/api/kalshi/discovery');
  assert.equal(calls[0].url.search, '');
  assert.ok(calls[0].init?.signal instanceof AbortSignal);
  assert.deepEqual(h.eventLinks(), ['KXC-E1']);
  assert.match(h.html(), /Retrieved 2026-11-19 10:05 UTC/);
  assert.match(h.html(), /Showing 1 of 1 event groups/);
});

test('failed Refresh keeps the previous sample with its retrieval time, and Retry recovers', async () => {
  const h = harness({ initial: initialPage(), initialError: null });
  mockFetch(json({ error: 'Kalshi did not respond in time.' }, 504), json(page([group('KXC-E1', [mk('KXC-E1-T1')])])));
  await h.click('Refresh');
  const html = h.html();
  assert.match(html, /role="alert"/);
  assert.match(html, /Kalshi did not respond in time\. Showing the previous sample retrieved 2026-11-19 10:00 UTC/);
  assert.deepEqual(h.eventLinks(), ['KXA-E1', 'KXB-E1']);
  await h.click('Retry');
  assert.doesNotMatch(h.html(), /role="alert"/);
  assert.deepEqual(h.eventLinks(), ['KXC-E1']);
});

test('a corrupted success (wrong-event metadata, foreign market, sourceAsOf, bad coverage) never replaces the sample', async () => {
  for (const bad of [
    page([group('KXC-E1', [mk('KXC-E1-T1')], { event: ev('KXZ-E1') })]),
    page([group('KXC-E1', [mk('KXZ-E1-T1')])]),
    { ...page([group('KXC-E1', [mk('KXC-E1-T1')])]), sourceAsOf: T1 },
    page([group('KXC-E1', [mk('KXC-E1-T1')])], T1, { selectedTickers: 99 }),
    page([group('KXC-E1', [mk('KXC-E1-T1')], { metadataStatus: 'loaded', event: null })]),
  ]) {
    mock.restoreAll();
    const h = harness({ initial: initialPage(), initialError: null });
    mockFetch(json(bad));
    await h.click('Refresh');
    assert.match(h.html(), /malformed discovery sample/);
    assert.deepEqual(h.eventLinks(), ['KXA-E1', 'KXB-E1']);
    assert.ok(h.has('Retry'));
  }
});

test('handler-level race: a superseded refresh is aborted and its late success or failure is discarded', async () => {
  // In a browser the busy button is disabled; this exercises the generation/abort guard directly.
  for (const settleLate of [d => d.resolve(Response.json(page([group('KXLATE-E1', [mk('KXLATE-E1-T1')])]))), d => d.reject(new TypeError('late failure'))]) {
    mock.restoreAll();
    const h = harness({ initial: initialPage(), initialError: null });
    const late = deferred(), fresh = deferred();
    const calls = mockFetch(() => late.p, () => fresh.p);
    const first = h.click('Refresh');
    const second = h.click('Refreshing…');
    assert.equal(calls[0].init.signal.aborted, true, 'first request aborted when superseded');
    fresh.resolve(Response.json(page([group('KXNEW-E1', [mk('KXNEW-E1-T1')])])));
    await second;
    settleLate(late);
    await first;
    assert.deepEqual(h.eventLinks(), ['KXNEW-E1']);
    assert.doesNotMatch(h.html(), /role="alert"|KXLATE/);
    assert.ok(h.has('Refresh'));
  }
});

test('category and search apply to the sample; a category missing after refresh resets to All visibly', async () => {
  const h = harness({ initial: initialPage(), initialError: null });
  assert.match(h.html(), /<option value=""[^>]*>All<\/option><option value="Crypto"[^>]*>Crypto<\/option><option value="Sports"[^>]*>Sports<\/option>/);
  h.select('Crypto');
  assert.deepEqual(h.eventLinks(), ['KXB-E1']);
  h.select('');
  h.search('outcome kxa-e1-t1');
  assert.deepEqual(h.eventLinks(), ['KXA-E1']);
  h.search('nothing-matches');
  assert.match(h.html(), /No event groups in the sample match/);
  h.search('');
  h.select('Crypto');
  mockFetch(json(page([group('KXC-E1', [mk('KXC-E1-T1')])])));
  await h.click('Refresh');
  assert.deepEqual(h.eventLinks(), ['KXC-E1']);
  assert.match(h.html(), /Category &quot;Crypto&quot; is not in the new sample; showing all categories/);
  assert.match(h.html(), /<select[^>]*>\s*<option value=""[^>]*>All<\/option><option value="Sports"[^>]*>Sports<\/option><\/select>/);
});

test('metadata fallback: unavailable vs not_requested are distinct, no invented titles, groups without category drop under a filter', () => {
  const h = harness({
    initial: page([
      group('KXA-E1', [mk('KXA-E1-T1')]),
      group('KXU-E1', [mk('KXU-E1-T1')], { event: null, metadataStatus: 'unavailable' }),
      group('KXN-E1', [mk('KXN-E1-T1')], { event: null, metadataStatus: 'not_requested' }),
    ], T0),
    initialError: null,
  });
  const html = h.html();
  assert.match(html, /Event details unavailable/);
  assert.match(html, /Event details not loaded/);
  assert.doesNotMatch(html, /Title KXU-E1|Title KXN-E1/);
  assert.deepEqual(h.eventLinks(), ['KXA-E1', 'KXU-E1', 'KXN-E1'], 'every group keeps an internal event-page link');
  assert.doesNotMatch(html, /https?:\/\//);
  h.select('Sports');
  assert.deepEqual(h.eventLinks(), ['KXA-E1']);
});

test('rows: first 4 sampled markets then honest expand; null volume is Unavailable, zero stays 0; no event totals', () => {
  const markets = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'].map((t, i) => mk(`KXA-E1-${t}`, {
    volume24hContracts: i === 0 ? 0 : i === 1 ? null : 5, yesBid: i === 0 ? null : 0.41,
  }));
  const h = harness({ initial: page([group('KXA-E1', markets)], T0), initialError: null });
  assert.deepEqual(h.marketLinks(), ['KXA-E1-T1', 'KXA-E1-T2', 'KXA-E1-T3', 'KXA-E1-T4']);
  const html = h.html();
  assert.match(html, /6 sampled open markets/);
  assert.match(html, /0 contracts/);
  assert.match(html, /Unavailable/);
  assert.doesNotMatch(html, /total|sum of|combined/i);
  h.click('Show 2 more sampled markets');
  assert.equal(h.marketLinks().length, 6);
  h.click('Show fewer');
  assert.equal(h.marketLinks().length, 4);
});

test('category selected while Refresh is pending is checked against the arriving sample', async () => {
  const h = harness({ initial: initialPage(), initialError: null });
  const pending = deferred();
  mockFetch(() => pending.p);
  const refreshing = h.click('Refresh'); // captures All in the unfixed implementation
  h.select('Crypto'); // real control remains enabled while the request is pending
  pending.resolve(Response.json(page([group('KXC-E1', [mk('KXC-E1-T1')])])));
  await refreshing;
  assert.deepEqual(h.eventLinks(), ['KXC-E1']);
  assert.match(h.html(), /Category &quot;Crypto&quot; is not in the new sample; showing all categories/);
});

test('event groups are compact by default and expand/collapse with accurate counts', () => {
  const groups = Array.from({ length: 13 }, (_, i) => group(`KXS-E${i}`, [mk(`KXS-E${i}-T1`)]));
  const h = harness({ initial: page(groups, T0, { uniqueTickers: 13, selectedTickers: 13, tradesScanned: 13, eventMetadataRequested: 13 }), initialError: null });
  assert.equal(h.eventLinks().length, 12);
  assert.match(h.html(), /Showing 12 of 13 event groups/);
  h.click('View all 13 event groups');
  assert.equal(h.eventLinks().length, 13);
  h.click('Show fewer event groups');
  assert.equal(h.eventLinks().length, 12);
});

test('initial failure without a sample shows an alert with Retry and no empty-sample message', async () => {
  const h = harness({ initial: null, initialError: 'Kalshi discovery could not be loaded right now.' });
  assert.match(h.html(), /role="alert"/);
  assert.doesNotMatch(h.html(), /No recent trades|previous sample/);
  mockFetch(json(page([], T1, { tradesScanned: 0, uniqueTickers: 0, selectedTickers: 0, oldestTradeAt: null, newestTradeAt: null, eventMetadataRequested: 0 })));
  await h.click('Retry');
  assert.match(h.html(), /No recent trades in the scanned window/);
  assert.doesNotMatch(h.html(), /role="alert"/);
});
