/* RED tests for KalshiHistoryClient — SSR markup + COMPONENT-HANDLER tests, NOT browser proof.
   SSR cases render the real component with real React (renderToStaticMarkup).
   Handler cases transpile the real component with a deterministic hook shim (useState/useRef/useMemo/
   useCallback/useEffect replaced only inside this isolated loader), walk the returned tree (expanding
   hook-free subcomponents) and invoke the real onClick handlers; fetch is mocked and ignores abort signals,
   so late responses must be discarded by the component itself. Layout, focus, real event dispatch and
   React scheduling are NOT exercised. */
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '..');
const CLIENT = 'src/app/markets/KalshiHistoryClient.tsx';
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

const ssr = props => renderToStaticMarkup(React.createElement(makeLoader({})(CLIENT).default, props));

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
    useCallback(fn) { i++; return fn; },
    useEffect() { i++; },
  };
  const Client = makeLoader({ react: { ...React, ...hooks } })(CLIENT).default;
  const render = () => { i = 0; return Client(props); };
  // Expands hook-free function subcomponents so their buttons are reachable.
  const all = n => (Array.isArray(n) ? n.flatMap(all)
    : !React.isValidElement(n) ? []
    : typeof n.type === 'function' ? all(n.type(n.props))
    : [n, ...React.Children.toArray(n.props.children).flatMap(all)]);
  const text = n => (typeof n === 'string' || typeof n === 'number' ? String(n)
    : React.isValidElement(n) ? React.Children.toArray(n.props.children).map(text).join('') : '');
  const h = {
    html: () => renderToStaticMarkup(render()),
    click: label => {
      const btn = all(render()).find(n => n.type === 'button' && text(n).trim() === label);
      assert.ok(btn, `button "${label}" not rendered`);
      return btn.props.onClick();
    },
  };
  return h;
}

test('an aborted current request cannot install a late successful payload', async () => {
  const Original = globalThis.AbortController;
  let ctrl;
  mock.method(globalThis, 'AbortController', function () { ctrl = new Original(); return ctrl; });
  const pending = deferred();
  mockFetch(() => pending.p);
  const h = harness(props());
  const request = h.click('7d');
  ctrl.abort();
  pending.resolve(Response.json(hist('7d', { points: P7 })));
  await request;
  assert.doesNotMatch(h.html(), /77¢|78¢/);
});

test('market detail keys history state to the literal market ticker', () => {
  const page = fs.readFileSync(path.join(root, 'src/app/markets/kalshi/[ticker]/page.tsx'), 'utf8');
  assert.match(page, /<KalshiHistoryClient\s+key=\{market\.ticker\}/);
});

const TICKER = 'KXSYN-26DEC-T1';
const E = Math.floor(Date.parse('2026-11-19T12:00:00Z') / 1000);
const H = 3600;
const S = E - 86400;
const WIN = { '1h': { startTs: E - 3600, endTs: E, periodMinutes: 1 }, '24h': { startTs: S, endTs: E, periodMinutes: 60 }, '7d': { startTs: E - 604800, endTs: E, periodMinutes: 60 } };
const iso = sec => new Date(sec * 1000).toISOString();
const pt = (endTs, yesClose, volumeContracts = 10) => ({ endTs, yesClose, volumeContracts });
const tr = (o = {}) => ({ tradeId: 'syn-1', createdTime: iso(E - 120), yesPrice: 0.37, noPrice: 0.63, countContracts: 12, takerOutcomeSide: 'yes', isBlockTrade: false, ...o });
// SYNTHETIC normalized payloads (values invented). Closes identify which range's data is on screen.
const P24 = [pt(E - 2 * H, 0.24), pt(E - H, 0.25)];
const P1 = [pt(E - 120, 0.11), pt(E - 60, 0.12)];
const P7 = [pt(E - 2 * H, 0.77), pt(E - H, 0.78)];
function hist(range = '24h', o = {}) {
  return {
    ticker: TICKER, range, window: { ...WIN[range] }, retrievedAt: o.retrievedAt ?? '2026-11-19T12:00:05.000Z', sourceAsOf: null,
    candles: o.candles ?? { ok: true, data: { seriesTicker: 'SYNSERIESQ', points: o.points ?? P24 } },
    trades: o.trades ?? { ok: true, data: { trades: o.tradeRows ?? [tr()], hasMore: o.hasMore ?? false } },
    ...o.override,
  };
}
const props = (initial = hist('24h'), extra = {}) => ({ ticker: TICKER, initialRange: initial?.range ?? '24h', initial, initialError: null, ...extra });

function mockFetch(...responders) {
  const calls = [];
  mock.method(globalThis, 'fetch', async (input, init) => {
    calls.push({ url: new URL(String(input), 'http://localhost'), init });
    const next = responders.shift();
    assert.ok(next, 'unexpected extra fetch');
    return next(init);
  });
  return calls;
}
const json = (body, status = 200) => () => Response.json(body, { status });
function deferred() { let resolve; const p = new Promise(r => { resolve = r; }); return { p, resolve }; }
const settle = async () => { for (let k = 0; k < 5; k++) await new Promise(r => setTimeout(r, 0)); };
const pressed = (html, label) => new RegExp(`<button[^>]*aria-pressed="true"[^>]*>${label}</button>`).test(html);
const assertHistoryCall = (call, range) => {
  assert.equal(call.url.pathname, `/api/kalshi/markets/${TICKER}/history`);
  assert.deepEqual([...call.url.searchParams.keys()], ['range']);
  assert.equal(call.url.searchParams.get('range'), range);
};

const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))]
  .map(m => Object.fromEntries([...m[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map(a => [a[1], a[2]])));
const circles = html => tags(html, 'circle').filter(t => 'data-ts' in t).map(t => ({ ts: Number(t['data-ts']), cx: Number(t.cx), cy: Number(t.cy) }));
const segments = html => tags(html, 'polyline').filter(t => 'data-segment' in t).map(t => t.points.trim().split(/\s+/).length);

/* =================== SSR =================== */
test('chart x positions follow UTC timestamps (not row index) and the y axis is a fixed 0–100¢ scale', () => {
  const html = ssr(props(hist('24h', { points: [pt(S + H, 0), pt(S + 2 * H, 0.5), pt(S + 10 * H, 1)] })));
  assert.match(html, /<svg[^>]*role="img"/);
  assert.match(html, /<title>[^<]*Yes[^<]*<\/title>/);
  const [a, b, c] = circles(html);
  assert.deepEqual([a.ts, b.ts, c.ts], [S + H, S + 2 * H, S + 10 * H]);
  assert.ok(Math.abs((b.cx - a.cx) / (c.cx - a.cx) - 1 / 9) < 0.01, 'x must be proportional to time');
  assert.ok(a.cy > b.cy && b.cy > c.cy, '0¢ low, 100¢ high');
  assert.ok(Math.abs((a.cy - b.cy) - (b.cy - c.cy)) < 0.01 * (a.cy - c.cy), 'linear y');
  assert.deepEqual(segments(html), [2]); // S+10H is isolated by missing periods: point only, no bridging line
  assert.match(html, />0¢</); // a known zero price is kept, not treated as missing
  const narrow = circles(ssr(props(hist('24h', { points: [pt(S + H, 0.5), pt(S + 2 * H, 0.6)] }))));
  assert.ok(Math.abs(narrow[0].cy - b.cy) < 1e-6, 'y scale must not autoscale to the data');
});

test('null closes and missing periods break the line; no point or interpolation is drawn for them', () => {
  const pts = [pt(S + H, 0.21), pt(S + 2 * H, 0.22), pt(S + 3 * H, null, 0), pt(S + 4 * H, 0.24), pt(S + 5 * H, 0.25), pt(S + 7 * H, 0.27), pt(S + 8 * H, 0.28)];
  const html = ssr(props(hist('24h', { points: pts })));
  assert.deepEqual(circles(html).map(c => c.ts), pts.filter(p => p.yesClose !== null).map(p => p.endTs));
  assert.deepEqual(segments(html), [2, 2, 2]);
  assert.equal((html.match(/No trade/g) || []).length, 1);
  assert.match(html, /<table[\s\S]*<caption[\s\S]*<\/table>/); // accessible data table alongside the SVG
  assert.match(html, /contracts/);
});

test('trade table shows published Yes/No prices unswapped, contract counts, taker outcome and block label — never Buy/Sell', () => {
  const html = ssr(props(hist('24h', { tradeRows: [
    tr({ tradeId: 'a', yesPrice: 0.03, noPrice: 0.97, countContracts: 905.2, takerOutcomeSide: 'no' }),
    tr({ tradeId: 'b', isBlockTrade: true, createdTime: iso(E - 300) }),
  ] })));
  const row = html.match(/<tr\b(?:(?!<\/tr>)[\s\S])*905\.2(?:(?!<\/tr>)[\s\S])*<\/tr>/)?.[0];
  assert.ok(row, 'trade row rendered');
  assert.ok(row.indexOf('>3¢<') > -1 && row.indexOf('>3¢<') < row.indexOf('>97¢<'), 'Yes price before No price, as published');
  assert.match(html, /Taker outcome/);
  assert.match(html, /Block/);
  assert.match(html, /2026-11-19 11:58 UTC/);
  assert.doesNotMatch(html, /\b(Buy|Sell|Bought|Sold)\b/);
  assert.doesNotMatch(html, /\$905|\$12\b/);
});

test('time labels separate window, interval, retrieval, last candle and latest trade; hasMore is shown, never faked complete', () => {
  let html = ssr(props(hist('24h', { hasMore: true })));
  assert.match(html, /2026-11-18 12:00 UTC/);
  assert.match(html, /Interval: 1 hour/);
  assert.match(html, /Retrieved 2026-11-19 12:00 UTC/);
  assert.match(html, /Last candle ends 2026-11-19 11:00 UTC/);
  assert.match(html, /Latest trade 2026-11-19 11:58 UTC/);
  assert.match(html, /may lag/i);
  assert.match(html, /More trades exist in this window/);
  assert.ok(pressed(html, '24h') && !pressed(html, '1h') && !pressed(html, '7d'));
  for (const label of ['1h', '24h', '7d', 'Refresh']) assert.match(html, new RegExp(`<button[^>]*>${label}</button>`));
  html = ssr(props(hist('1h', { points: P1 })));
  assert.match(html, /Interval: 1 minute/);
  assert.doesNotMatch(html, /More trades exist/);
});

test('chart and trades render independently when one section failed', () => {
  const err = { ok: false, status: 502, error: 'Kalshi data is temporarily unavailable or malformed.' };
  let html = ssr(props(hist('24h', { candles: err })));
  assert.match(html, /Price chart unavailable/);
  assert.equal(circles(html).length, 0);
  assert.match(html, />37¢</);
  html = ssr(props(hist('24h', { trades: { ...err, status: 503 } })));
  assert.match(html, /Recent trades unavailable/);
  assert.equal(circles(html).length, 2);
  assert.doesNotMatch(html, />37¢</);
});

/* =================== handlers =================== */
test('range control fetches only the same-origin history route with range=<r> and renders that range', async () => {
  const h = harness(props());
  const calls = mockFetch(json(hist('7d', { points: P7 })));
  await h.click('7d');
  await settle();
  assert.equal(calls.length, 1);
  assertHistoryCall(calls[0], '7d');
  const html = h.html();
  assert.ok(pressed(html, '7d'));
  assert.match(html, />77¢</);
  assert.doesNotMatch(html, />24¢</);
});

test('a late response for an older range is discarded and the older request is aborted', async () => {
  const h = harness(props());
  const late = deferred();
  const calls = mockFetch(() => late.p, json(hist('7d', { points: P7 })));
  const first = h.click('1h');
  await h.click('7d');
  await settle();
  late.resolve(Response.json(hist('1h', { points: P1 })));
  await first;
  await settle();
  assert.equal(calls[0].init?.signal?.aborted, true);
  const html = h.html();
  assert.ok(pressed(html, '7d'));
  assert.match(html, />77¢</);
  assert.doesNotMatch(html, />11¢</);
});

test('a failed range load shows an alert with no stale chart under the new label, and Retry refetches that range', async () => {
  const h = harness(props());
  const calls = mockFetch(json({ error: 'Kalshi is rate limiting requests. Please try again shortly.' }, 503), json(hist('1h', { points: P1 })));
  await h.click('1h');
  await settle();
  let html = h.html();
  assert.match(html, /role="alert"/);
  assert.ok(pressed(html, '1h'));
  assert.equal(circles(html).length, 0);
  assert.doesNotMatch(html, />24¢</);
  await h.click('Retry');
  await settle();
  assertHistoryCall(calls[1], '1h');
  html = h.html();
  assert.doesNotMatch(html, /role="alert"/);
  assert.match(html, />11¢</);
});

test('a payload for another ticker, another range or with out-of-window rows is rejected, not rendered', async () => {
  for (const [label, body] of [
    ['other ticker', hist('1h', { points: P1, override: { ticker: 'KXSYN-OTHER' } })],
    ['other range', hist('7d', { points: P7 })],
    ['row outside window', hist('1h', { points: [pt(E + 60, 0.11)] })],
    ['faked sourceAsOf', hist('1h', { points: P1, override: { sourceAsOf: '2026-11-19T12:00:00Z' } })],
  ]) {
    mock.restoreAll();
    const h = harness(props());
    mockFetch(json(body));
    await h.click('1h');
    await settle();
    const html = h.html();
    assert.match(html, /role="alert"/, label);
    assert.doesNotMatch(html, />11¢<|>77¢</, label);
    assert.equal(circles(html).length, 0, label);
  }
});

test('initial server failure offers Retry for the initial range; Refresh refetches the current range', async () => {
  const h = harness(props(null, { initialRange: '24h', initialError: 'Kalshi did not respond in time.' }));
  let html = h.html();
  assert.match(html, /role="alert"/);
  assert.equal(circles(html).length, 0);
  const calls = mockFetch(json(hist('24h')), json(hist('24h', { points: [pt(E - H, 0.31)], retrievedAt: '2026-11-19T12:03:00.000Z' })));
  await h.click('Retry');
  await settle();
  assertHistoryCall(calls[0], '24h');
  assert.match(h.html(), />24¢</);
  await h.click('Refresh');
  await settle();
  assertHistoryCall(calls[1], '24h');
  html = h.html();
  assert.match(html, />31¢</);
  assert.match(html, /Retrieved 2026-11-19 12:03 UTC/);
});
