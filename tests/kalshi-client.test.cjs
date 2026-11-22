/* COMPONENT-HANDLER tests for KalshiMarketsClient — NOT browser proof.
   The real component is transpiled and run with a deterministic hook shim (useState/useRef/useMemo/useEffect
   are replaced only inside this isolated loader; global React is untouched). Tests walk the returned element
   tree and invoke the real onClick/onChange handlers; fetch is mocked. Layout, focus, real event dispatch,
   disabled-button semantics and React scheduling are NOT exercised here. */
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
  const load = makeLoader({ react: { ...React, ...hooks }, 'next/link': { __esModule: true, default: Link } });
  const Client = load('src/app/markets/KalshiMarketsClient.tsx').default;
  const render = () => { i = 0; return Client(props); };
  const all = n => (Array.isArray(n) ? n.flatMap(all)
    : React.isValidElement(n) ? [n, ...React.Children.toArray(n.props.children).flatMap(all)] : []);
  const text = n => (typeof n === 'string' || typeof n === 'number' ? String(n)
    : React.isValidElement(n) ? React.Children.toArray(n.props.children).map(text).join('') : '');
  const find = (tree, pred, what) => { const n = all(tree).find(pred); assert.ok(n, `${what} not rendered`); return n; };
  const h = {
    render,
    html: () => renderToStaticMarkup(render()),
    tickers: () => [...h.html().matchAll(/href="\/markets\/kalshi\/([^"]+)"/g)].map(m => decodeURIComponent(m[1])),
    has: label => all(render()).some(n => n.type === 'button' && text(n).trim() === label),
    // Optionally reuse a previously rendered tree to model two inputs landing before a re-render.
    click: (label, tree = render()) => find(tree, n => n.type === 'button' && text(n).trim() === label, `button "${label}"`).props.onClick(),
    change: (pred, target) => find(render(), pred, 'control').props.onChange({ target }),
  };
  return h;
}

// SYNTHETIC fixtures (normalized KalshiMarket shape; values invented)
const mk = (ticker, o = {}) => ({
  ticker, eventTicker: `${ticker.split('-')[0]}-EV`, title: `Title ${ticker}`, yesLabel: 'Yes label', noLabel: 'No label',
  status: 'active', marketType: 'binary', closeTime: '2099-06-01T00:00:00Z', updatedTime: '2026-11-01T00:00:00Z',
  volume24hContracts: 10, totalVolumeContracts: 100, openInterestContracts: 50, yesBid: 0.4, yesAsk: 0.45,
  yesBidSize: 10, yesAskSize: 10, notionalDollars: 1, rulesPrimary: 'r', rulesSecondary: null, ...o,
});
const T0 = '2026-11-19T10:00:00.000Z', T1 = '2026-11-19T10:05:00.000Z', T2 = '2026-11-19T10:10:00.000Z';
const page = (markets, nextCursor, receivedAt, rejectedCount = 0) => ({ markets, nextCursor, receivedAt, sourceAsOf: null, rejectedCount });

function mockFetch(...responders) {
  const calls = [];
  mock.method(globalThis, 'fetch', async (input, init) => {
    calls.push(new URL(String(input), 'http://localhost'));
    const next = responders.shift();
    assert.ok(next, 'unexpected extra fetch');
    return next(init); // deliberately ignores init.signal: late responses must still be discarded by the component
  });
  return calls;
}
const json = (body, status = 200) => () => Response.json(body, { status });
function deferred() { let resolve; const p = new Promise(r => { resolve = r; }); return { p, resolve }; }

test('Load more sends the exact opaque cursor, appends + dedupes, and keeps the retrieval range', async () => {
  const h = harness({ initial: page([mk('KXA-1')], 'c1+/=', T0), initialError: null });
  const calls = mockFetch(json(page([mk('KXA-1'), mk('KXB-1', { volume24hContracts: 5 })], 'c2', T1, 2)));
  await h.click('Load more');
  assert.equal(calls[0].pathname, '/api/kalshi/markets');
  assert.equal(calls[0].searchParams.get('cursor'), 'c1+/=');
  assert.deepEqual(h.tickers(), ['KXA-1', 'KXB-1']);
  const html = h.html();
  assert.match(html, /Showing 2 of 2 loaded/);
  assert.match(html, /2 source rows not shown/);
  assert.match(html, /Retrieved 2026-11-19 10:00 UTC – 2026-11-19 10:05 UTC/);
  assert.ok(h.has('Load more'));
});

test('a repeated cursor stops paging with a visible state instead of looping', async () => {
  const h = harness({ initial: page([mk('KXA-1')], 'c1', T0), initialError: null });
  const calls = mockFetch(json(page([mk('KXB-1')], 'c1', T1)));
  await h.click('Load more');
  assert.equal(calls.length, 1);
  assert.match(h.html(), /Paging stopped: the source repeated a cursor/);
  assert.equal(h.has('Load more'), false);
});

test('a failed Load more shows an error and Retry reuses the same cursor; prior data is kept', async () => {
  const h = harness({ initial: page([mk('KXA-1')], 'c1', T0), initialError: null });
  const calls = mockFetch(json({ error: 'Kalshi is rate limiting requests.' }, 503), json(page([mk('KXB-1')], null, T1)));
  await h.click('Load more');
  assert.match(h.html(), /role="alert"[\s\S]*Kalshi is rate limiting requests\./);
  assert.deepEqual(h.tickers(), ['KXA-1']);
  await h.click('Retry');
  assert.deepEqual(calls.map(u => u.searchParams.get('cursor')), ['c1', 'c1']);
  assert.deepEqual(h.tickers(), ['KXA-1', 'KXB-1']);
  assert.doesNotMatch(h.html(), /role="alert"/);
});

test('Refresh invalidates a late Load more response even when fetch ignores abort', async () => {
  const h = harness({ initial: page([mk('KXA-1')], 'c1', T0), initialError: null });
  const more = deferred(), fresh = deferred();
  const calls = mockFetch(() => more.p, () => fresh.p);
  const tree = h.render(); // both inputs land before a re-render
  const pMore = h.click('Load more', tree);
  const pRefresh = h.click('Refresh', tree);
  fresh.resolve(Response.json(page([mk('KXZ-1')], null, T2)));
  await pRefresh;
  more.resolve(Response.json(page([mk('KXB-1')], 'c2', T1)));
  await pMore;
  assert.equal(calls[1].searchParams.has('cursor'), false);
  assert.deepEqual(h.tickers(), ['KXZ-1']);
  const html = h.html();
  assert.match(html, /End of results/);
  assert.doesNotMatch(html, /10:05 UTC/);
  assert.equal(h.has('Load more'), false);
  assert.equal(h.has('Refresh'), true); // busy cleared by the winning request
});

test('Refresh resets dataset, cursor, rejected count and retrieval range', async () => {
  const h = harness({ initial: page([mk('KXA-1')], 'c1', T0, 3), initialError: null });
  mockFetch(json(page([mk('KXB-1')], 'c2', T1, 1)), json(page([mk('KXZ-1')], null, T2)));
  await h.click('Load more');
  await h.click('Refresh');
  assert.deepEqual(h.tickers(), ['KXZ-1']);
  const html = h.html();
  assert.match(html, /Retrieved 2026-11-19 10:10 UTC\./);
  assert.doesNotMatch(html, /source rows not shown/);
  assert.equal(h.has('Load more'), false);
});

test('initial error Retry loads a first page through refresh', async () => {
  const h = harness({ initial: null, initialError: 'Kalshi markets could not be loaded right now.' });
  mockFetch(json(page([mk('KXA-1')], 'c1', T0)));
  assert.match(h.html(), /role="alert"/);
  await h.click('Retry');
  assert.deepEqual(h.tickers(), ['KXA-1']);
  assert.ok(h.has('Load more'));
});

test('search, Quoted only and sort change the rendered loaded list', () => {
  const h = harness({ initialError: null, initial: page([
    mk('KXA-1', { title: 'Alpha', volume24hContracts: 10, closeTime: '2099-03-01T00:00:00Z' }),
    mk('KXB-1', { title: 'Beta', volume24hContracts: 30, closeTime: '2099-01-01T00:00:00Z', yesBid: null, yesAsk: null }),
    mk('KXC-1', { title: 'Gamma', volume24hContracts: null, closeTime: '2099-02-01T00:00:00Z' }),
  ], null, T0) });
  const isSelect = n => n.type === 'select';
  assert.deepEqual(h.tickers(), ['KXB-1', 'KXA-1', 'KXC-1']); // 24h contracts desc, unknown last
  h.change(isSelect, { value: 'closing' });
  assert.deepEqual(h.tickers(), ['KXB-1', 'KXC-1', 'KXA-1']);
  h.change(isSelect, { value: 'name' });
  assert.deepEqual(h.tickers(), ['KXA-1', 'KXB-1', 'KXC-1']);
  h.change(n => n.type === 'input' && n.props.type === 'checkbox', { checked: true });
  assert.deepEqual(h.tickers(), ['KXA-1', 'KXC-1']);
  h.change(n => n.type === 'input' && n.props.type !== 'checkbox', { value: 'kxc-ev' });
  assert.deepEqual(h.tickers(), ['KXC-1']);
  assert.match(h.html(), /Showing 1 of 3 loaded/);
});

for (const [label, body] of [
  ['non-string nextCursor', { ...page([mk('KXB-1')], 5, T1) }],
  ['non-numeric rejectedCount', { ...page([mk('KXB-1')], 'c2', T1), rejectedCount: 'n' }],
  ['non-ISO receivedAt', page([mk('KXB-1')], 'c2', 'yesterday')],
  ['row without ticker', page([{ title: 'no ticker' }], 'c2', T1)],
]) {
  test(`malformed success response (${label}) shows an error and preserves prior data and cursor`, async () => {
    const h = harness({ initial: page([mk('KXA-1')], 'c1', T0), initialError: null });
    const calls = mockFetch(json(body), json(page([], null, T1)));
    await h.click('Load more');
    const html = h.html();
    assert.match(html, /role="alert"/);
    assert.deepEqual(h.tickers(), ['KXA-1']);
    assert.match(html, /Showing 1 of 1 loaded/);
    assert.doesNotMatch(html, /NaN|undefined/);
    await h.click('Retry'); // prior cursor still intact
    assert.equal(calls[1].searchParams.get('cursor'), 'c1');
  });
}
