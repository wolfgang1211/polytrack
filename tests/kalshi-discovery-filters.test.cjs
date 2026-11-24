/* RED-first tests for Discover filters + shareable URL state. Pure helpers (src/lib/kalshiDiscoveryFilters.ts), the
   /markets page wiring and KalshiDiscoveryClient handlers. Client tests use a hook shim + FAKE window/history: they are
   evidence of component handlers only — NOT browser, layout or hydration proof. Every fixture is SYNTHETIC. */
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '..');
afterEach(() => { mock.restoreAll(); delete globalThis.window; });

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
    const req = name => (name in mocks ? mocks[name]
      : name.startsWith('@/') ? load(path.join(root, 'src', name.slice(2)))
      : name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : require(name));
    const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    new Function('exports', 'require', 'module', '__filename', '__dirname', 'globalThis', out)(mod.exports, req, mod, file, path.dirname(file), shadow);
    return mod.exports;
  }
  return load;
}
const F = () => makeLoader()('src/lib/kalshiDiscoveryFilters.ts');
test('search typing preserves a trailing space in the controlled input while the URL is canonical', () => {
  const w = fakeWindow();
  const h = harness({ initial: initialPage(), initialError: null });
  h.search('Fed ');
  assert.match(h.html(), /value="Fed "/);
  assert.equal(w.calls.at(-1).url.searchParams.get('q'), 'Fed');
  h.search('Fed decision');
  assert.match(h.html(), /value="Fed decision"/);
});

const D0 = Object.freeze({ q: '', category: '', maxSpread: '', minSize: '', closing: '' });
const f = o => ({ ...D0, ...o });
const sp = s => new URLSearchParams(s);
const deepFreeze = o => { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };

// ---------- SYNTHETIC fixtures (same shapes as tests/kalshi-discovery-client.test.cjs) ----------
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
const quote = (yesBid, yesAsk, yesBidSize = 1, yesAskSize = 1) => ({ yesBid, yesAsk, yesBidSize, yesAskSize });
const group = (eventTicker, markets, o = {}) => ({ eventTicker, event: ev(eventTicker), metadataStatus: 'loaded', markets, ...o });
const coverage = (o = {}) => ({
  tradePages: 1, tradesScanned: 10, rejectedTrades: 0, uniqueTickers: 5, selectedTickers: 5, moreTradesAvailable: false,
  oldestTradeAt: '2026-11-19T09:00:00.123456Z', newestTradeAt: '2026-11-19T09:59:00.123456Z', marketPages: 1, rejectedMarkets: 0,
  eventMetadataRequested: 2, eventMetadataFailed: 0, truncated: false,
  windowStart: '2026-11-18T10:00:00.000Z', windowEnd: '2026-11-19T10:00:00.000Z', ...o,
});
const page = (groups, receivedAt = T1) => ({ groups, receivedAt, sourceAsOf: null, coverage: coverage() });
// KXA: 2¢ spread, Sports. KXB: 1¢ spread, Crypto.
const initialPage = () => page([group('KXA-E1', [mk('KXA-E1-T1')]),
  group('KXB-E1', [mk('KXB-E1-T1', quote(0.42, 0.43))], { event: ev('KXB-E1', { category: 'Crypto' }) })], T0);
const tickers = gs => gs.map(g => [g.eventTicker, g.markets.map(m => m.ticker)]);

// ======================= parse =======================
test('parse: valid owned keys, trimmed text, empty values are valid defaults, unrelated params ignored', () => {
  const { parseDiscoveryFilters } = F();
  assert.deepEqual(parseDiscoveryFilters(sp('platform=kalshi&view=discover&q=+fed+cut++&category=+Economics+&maxSpread=5&minSize=100&closing=7d&foo=1')),
    { filters: { q: 'fed cut', category: 'Economics', maxSpread: '5', minSize: '100', closing: '7d' }, invalidKeys: [] });
  assert.deepEqual(parseDiscoveryFilters(sp('q=&category=&maxSpread=&minSize=&closing=')), { filters: { ...D0 }, invalidKeys: [] });
  assert.deepEqual(parseDiscoveryFilters(sp('')), { filters: { ...D0 }, invalidKeys: [] });
  for (const [k, vals] of [['maxSpread', ['1', '5', '10', '20']], ['minSize', ['100', '1000']], ['closing', ['24h', '7d']]])
    for (const v of vals) assert.deepEqual(parseDiscoveryFilters(sp(`${k}=${v}`)), { filters: f({ [k]: v }), invalidKeys: [] }, `${k}=${v}`);
});

test('parse: invalid enum, precision, negative, junk and repeated owned keys -> invalidKeys in key order, field default', () => {
  const { parseDiscoveryFilters } = F();
  for (const [qs, bad] of [
    ['maxSpread=3', ['maxSpread']], ['maxSpread=5.0', ['maxSpread']], ['maxSpread=-5', ['maxSpread']], ['maxSpread=05', ['maxSpread']],
    ['minSize=abc', ['minSize']], ['minSize=1e3', ['minSize']], ['minSize=-100', ['minSize']], ['closing=1h', ['closing']],
    ['closing=24H', ['closing']], ['q=a&q=b', ['q']], ['category=X&category=X', ['category']],
    ['closing=x&q=a&q=b&maxSpread=7&category=Ok', ['q', 'maxSpread', 'closing']],
  ]) {
    const r = parseDiscoveryFilters(sp(qs));
    assert.deepEqual(r.invalidKeys, bad, qs);
    for (const k of bad) assert.equal(r.filters[k], '', `${qs}: ${k} falls back to default`);
  }
  assert.equal(parseDiscoveryFilters(sp('closing=x&q=a&q=b&maxSpread=7&category=Ok')).filters.category, 'Ok', 'valid keys survive');
});

test('parse: q max 120 and category max 80 after trim; ASCII control chars invalid; unicode allowed', () => {
  const { parseDiscoveryFilters: p } = F();
  const P = o => p(new URLSearchParams(o));
  assert.deepEqual(P({ q: ` ${'a'.repeat(120)} ` }), { filters: f({ q: 'a'.repeat(120) }), invalidKeys: [] });
  assert.deepEqual(P({ q: 'a'.repeat(121) }).invalidKeys, ['q']);
  assert.deepEqual(P({ category: 'c'.repeat(80) }).invalidKeys, []);
  assert.deepEqual(P({ category: 'c'.repeat(81) }).invalidKeys, ['category']);
  for (const bad of ['a\u0000b', 'a\u0007', 'a\u001fb', 'a\u007f', 'a\nb']) {
    assert.deepEqual(P({ q: bad }).invalidKeys, ['q'], JSON.stringify(bad));
    assert.deepEqual(P({ category: bad }).invalidKeys, ['category'], JSON.stringify(bad));
  }
  assert.deepEqual(P({ q: 'Fed ü 利率 & a+b' }), { filters: f({ q: 'Fed ü 利率 & a+b' }), invalidKeys: [] });
});

// ======================= serialize =======================
test('serialize: copy preserves unrelated keys, replaces owned keys, omits defaults, forces platform/view; round-trips', () => {
  const { serializeDiscoveryFilters: s, parseDiscoveryFilters: p } = F();
  const base = sp('platform=polymarket&view=events&foo=1&foo=2&q=old&maxSpread=10&closing=7d');
  const before = base.toString();
  const filters = f({ q: 'a & b+c ü=?#', category: 'Science and Technology', minSize: '1000' });
  const out = s(filters, base);
  assert.ok(out instanceof URLSearchParams);
  assert.notEqual(out, base);
  assert.equal(base.toString(), before, 'base not mutated');
  assert.deepEqual(out.getAll('foo'), ['1', '2']);
  assert.deepEqual([out.getAll('platform'), out.getAll('view')], [['kalshi'], ['discover']]);
  assert.deepEqual([out.getAll('q'), out.getAll('category'), out.getAll('minSize')], [['a & b+c ü=?#'], ['Science and Technology'], ['1000']]);
  assert.equal(out.has('maxSpread') || out.has('closing'), false, 'defaults omitted, stale owned keys removed');
  assert.deepEqual(p(sp(out.toString())), { filters, invalidKeys: [] });
  const empty = s({ ...D0 }, sp('foo=1&q=x&category=y&maxSpread=5&minSize=100&closing=24h'));
  assert.deepEqual([...empty.keys()].sort(), ['foo', 'platform', 'view']);
});

test('serialize: invalid typed values are rejected, never written into the URL', () => {
  const { serializeDiscoveryFilters: s } = F();
  for (const bad of [{ maxSpread: '3' }, { minSize: '50' }, { closing: '1h' }, { q: 'a\u0007' }, { q: 'a'.repeat(121) },
    { category: 'c'.repeat(81) }, { maxSpread: 5 }]) assert.throws(() => s(f(bad), sp('')), JSON.stringify(bad));
});

// ======================= filterDiscoveryGroups =======================
test('defaults keep every group and row (incl. missing/crossed/one-sided quotes); inputs are not mutated', () => {
  const { filterDiscoveryGroups } = F();
  const src = deepFreeze([group('KXA-E1', [mk('KXA-E1-T1', quote(null, null)), mk('KXA-E1-T2', quote(0.45, 0.40)), mk('KXA-E1-T3', quote(0.4, null))]),
    group('KXB-E1', [mk('KXB-E1-T1', { closeTime: null })], { event: null, metadataStatus: 'unavailable' })]);
  const snap = JSON.stringify(src);
  assert.deepEqual(filterDiscoveryGroups(src, { ...D0 }, T0), JSON.parse(snap));
  filterDiscoveryGroups(src, f({ maxSpread: '1', q: 'zzz' }), T0);
  assert.equal(JSON.stringify(src), snap);
});

test('category filters groups; empty groups dropped; original order kept (no global sort)', () => {
  const { filterDiscoveryGroups } = F();
  const src = [group('KXC-E1', [mk('KXC-E1-T1')], { event: ev('KXC-E1', { category: 'Crypto' }) }),
    group('KXA-E1', [mk('KXA-E1-T1', quote(0.1, 0.9))]), group('KXB-E1', [mk('KXB-E1-T1')], { event: ev('KXB-E1', { category: 'Crypto' }) }),
    group('KXU-E1', [mk('KXU-E1-T1')], { event: null, metadataStatus: 'unavailable' })];
  assert.deepEqual(filterDiscoveryGroups(src, f({ category: 'Crypto' }), T0).map(g => g.eventTicker), ['KXC-E1', 'KXB-E1']);
  assert.deepEqual(filterDiscoveryGroups(src, f({ maxSpread: '5' }), T0).map(g => g.eventTicker), ['KXC-E1', 'KXB-E1', 'KXU-E1']);
  assert.deepEqual(filterDiscoveryGroups(src, f({ category: 'Politics' }), T0), []);
});

test('search: event metadata match keeps all eligible rows; otherwise only matching market rows (case-insensitive)', () => {
  const { filterDiscoveryGroups: run } = F();
  const src = [group('KXA-E1', ['T1', 'T2', 'T3'].map(t => mk(`KXA-E1-${t}`)), { event: ev('KXA-E1', { title: 'Fed rate decision', subTitle: 'December' }) }),
    group('KXB-E1', ['T1', 'T2', 'T3'].map(t => mk(`KXB-E1-${t}`)), { event: ev('KXB-E1', { category: 'Crypto' }) }),
    group('KXN-E1', [mk('KXN-E1-T1'), mk('KXN-E1-T2')], { event: null, metadataStatus: 'not_requested' })];
  for (const q of ['FED RATE', 'decem', 'kxa', 'sports']) assert.deepEqual(tickers(run(src, f({ q }), T0))[0], ['KXA-E1', ['KXA-E1-T1', 'KXA-E1-T2', 'KXA-E1-T3']], q);
  assert.deepEqual(tickers(run(src, f({ q: 'crypto' }), T0)), [['KXB-E1', ['KXB-E1-T1', 'KXB-E1-T2', 'KXB-E1-T3']]]);
  assert.deepEqual(tickers(run(src, f({ q: 'outcome kxb-e1-t2' }), T0)), [['KXB-E1', ['KXB-E1-T2']]]);
  assert.deepEqual(tickers(run(src, f({ q: 'market KXB-E1-T3' }), T0)), [['KXB-E1', ['KXB-E1-T3']]]);
  assert.deepEqual(tickers(run(src, f({ q: 'kxn-e1' }), T0)), [['KXN-E1', ['KXN-E1-T1', 'KXN-E1-T2']]], 'eventTicker searchable without metadata');
});

test('maxSpread: coherent two_sided spread <= threshold; boundaries; locked 0 in; crossed/one-sided/missing out only when active', () => {
  const { filterDiscoveryGroups: run } = F();
  const src = [group('KXS-E1', [
    mk('KXS-E1-T1', quote(0.42, 0.42)), mk('KXS-E1-T2', quote(0.40, 0.45)), mk('KXS-E1-T3', quote(0.40, 0.4501)),
    mk('KXS-E1-T4', quote(0.45, 0.40)), mk('KXS-E1-T5', quote(0.40, null)), mk('KXS-E1-T6', quote(null, null)),
    mk('KXS-E1-T7', quote(0.40, 0.41, 0, 5)), mk('KXS-E1-T8', quote(0.40, 0.41234)),
  ])];
  const rows = o => run(src, f(o), T0).flatMap(g => g.markets.map(m => m.ticker.slice(-2)));
  assert.deepEqual(rows({ maxSpread: '5' }), ['T1', 'T2']);
  assert.deepEqual(rows({ maxSpread: '1' }), ['T1']);
  assert.deepEqual(rows({ maxSpread: '10' }), ['T1', 'T2', 'T3']);
  assert.equal(rows({}).length, 8);
});

test('minSize: BOTH displayed sizes >= threshold on a coherent two_sided quote', () => {
  const { filterDiscoveryGroups: run } = F();
  const src = [group('KXZ-E1', [
    mk('KXZ-E1-T1', quote(0.41, 0.43, 100, 100)), mk('KXZ-E1-T2', quote(0.41, 0.43, 100, 99.99)), mk('KXZ-E1-T3', quote(0.41, null, 5000, null)),
    mk('KXZ-E1-T4', quote(0.45, 0.40, 5000, 5000)), mk('KXZ-E1-T5', quote(0.41, 0.43, 1000, 1000)), mk('KXZ-E1-T6', quote(0.41, 0.43, null, 5000)),
  ])];
  const rows = o => run(src, f(o), T0).flatMap(g => g.markets.map(m => m.ticker.slice(-2)));
  assert.deepEqual(rows({ minSize: '100' }), ['T1', 'T5']);
  assert.deepEqual(rows({ minSize: '1000' }), ['T5']);
});

test('numeric filters and q must be satisfied by the SAME row (no cross-row combination)', () => {
  const { filterDiscoveryGroups: run } = F();
  const src = [group('KXX-E1', [mk('KXX-E1-T1', quote(0.42, 0.43, 1, 1)), mk('KXX-E1-T2', quote(0.10, 0.40, 5000, 5000))])];
  assert.deepEqual(run(src, f({ maxSpread: '5', minSize: '1000' }), T0), [], 'spread from T1 + size from T2 is not a match');
  assert.deepEqual(run(src, f({ q: 'kxx-e1-t1', minSize: '1000' }), T0), [], 'q on T1 + size on T2 is not a match');
  assert.deepEqual(tickers(run(src, f({ q: 'title kxx', minSize: '1000' }), T0)), [['KXX-E1', ['KXX-E1-T2']]], 'metadata match still needs numeric per row');
  assert.deepEqual(tickers(run(src, f({ q: 'kxx-e1-t2', minSize: '1000', maxSpread: '20' }), T0)), []);
  assert.deepEqual(tickers(run(src, f({ maxSpread: '1', minSize: '' }), T0)), [['KXX-E1', ['KXX-E1-T1']]]);
});

test('closing: closeTime > receivedAt and <= anchor + 24h/7d; unknown/invalid excluded; never Date.now()', () => {
  const { filterDiscoveryGroups: run } = F();
  mock.method(Date, 'now', () => { throw new Error('Date.now() must not be used by filters'); });
  const at = ms => new Date(Date.parse(T0) + ms).toISOString();
  const H = 3_600_000;
  const src = [group('KXT-E1', [at(0), at(1), at(24 * H), at(24 * H + 1), at(168 * H), at(168 * H + 1), null, 'garbage', at(-H)]
    .map((closeTime, i) => mk(`KXT-E1-T${i + 1}`, { closeTime })))];
  const rows = (closing, anchor = T0) => run(src, f({ closing }), anchor).flatMap(g => g.markets.map(m => m.ticker.split('-').pop()));
  assert.deepEqual(rows('24h'), ['T2', 'T3']);
  assert.deepEqual(rows('7d'), ['T2', 'T3', 'T4', 'T5']);
  assert.deepEqual(rows('24h', 'not-a-time'), [], 'unparseable anchor matches nothing');
  assert.equal(rows('').length, 9, 'closing off keeps unknown close times');
});

const links = html => [...html.matchAll(/href="\/markets\/kalshi\/events\/([^"]+)"/g)].map(m => decodeURIComponent(m[1]));

// ======================= client handlers (hook shim + fake window) =======================
function fakeWindow(search = '?platform=kalshi&view=discover', hash = '') {
  const loc = { pathname: '/markets', search, hash };
  Object.defineProperty(loc, 'href', { get: () => `http://localhost${loc.pathname}${loc.search}${loc.hash}` });
  const listeners = { popstate: [] }, calls = [];
  const nav = kind => (_state, _title, url) => {
    const u = new URL(String(url), loc.href);
    calls.push({ kind, url: u });
    Object.assign(loc, { pathname: u.pathname, search: u.search, hash: u.hash });
  };
  const w = {
    location: loc, history: { pushState: nav('push'), replaceState: nav('replace'), state: null },
    addEventListener: (t, fn) => { (listeners[t] ??= []).push(fn); },
    removeEventListener: (t, fn) => { listeners[t] = (listeners[t] ?? []).filter(x => x !== fn); },
    pop: s => { loc.search = s; for (const fn of [...listeners.popstate]) fn({ type: 'popstate', state: null }); },
    listeners, calls,
  };
  globalThis.window = w;
  return w;
}

function harness(props) {
  const slots = [], effects = new Map(), cleanups = [];
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
    useEffect(fn) { effects.set(i++, fn); },
  };
  const banned = () => { throw new Error('Next navigation must not be used for filter URL state'); };
  const Link = ({ href, children, ...rest }) => React.createElement('a', { href, ...rest }, children);
  const Client = makeLoader({
    react: { ...React, ...hooks }, 'next/link': { __esModule: true, default: Link },
    'next/navigation': { useRouter: banned, useSearchParams: banned, usePathname: banned },
  })('src/app/markets/KalshiDiscoveryClient.tsx').default;
  const render = () => { i = 0; return Client(props); };
  const all = n => (Array.isArray(n) ? n.flatMap(all)
    : React.isValidElement(n) ? (typeof n.type === 'function' ? all(n.type(n.props))
      : [n, ...React.Children.toArray(n.props.children).flatMap(all)]) : []);
  const text = n => (typeof n === 'string' || typeof n === 'number' ? String(n)
    : React.isValidElement(n) ? React.Children.toArray(n.props.children).map(text).join('') : '');
  const find = (pred, what) => { const el = all(render()).find(pred); assert.ok(el, `${what} not rendered`); return el; };
  const ctl = label => {
    const l = find(n => n.type === 'label' && text(n).includes(label), `label "${label}"`);
    const c = all(l).find(x => x.type === 'select' || x.type === 'input');
    assert.ok(c, `control for "${label}"`);
    return c;
  };
  return {
    html: () => renderToStaticMarkup(render()),
    click: label => find(n => n.type === 'button' && text(n).trim() === label, `button "${label}"`).props.onClick(),
    select: value => find(n => n.type === 'select', 'select').props.onChange({ target: { value } }),
    search: value => find(n => n.type === 'input', 'search input').props.onChange({ target: { value } }),
    set: (label, value) => ctl(label).props.onChange({ target: { value } }),
    value: label => ctl(label).props.value,
    firstSelectIs: label => { // one render tree: elements from two renders are never identical
      const tree = all(render());
      const l = tree.find(n => n.type === 'label' && text(n).includes(label));
      assert.ok(l, `label "${label}"`);
      // Children.toArray clones element keys on traversal; compare the same rendered handler, not cloned wrappers.
      assert.equal(tree.find(n => n.type === 'select').props.onChange, all(l).find(x => x.type === 'select').props.onChange);
    },
    eventLinks: () => links(renderToStaticMarkup(render())),
    marketLinks: () => [...renderToStaticMarkup(render()).matchAll(/href="\/markets\/kalshi\/([^"/]+)"/g)].map(m => decodeURIComponent(m[1])),
    mount: () => { render(); for (const fn of effects.values()) { const c = fn(); if (typeof c === 'function') cleanups.push(c); } },
    unmount: () => cleanups.splice(0).forEach(c => c()),
  };
}
const noFetch = () => mock.method(globalThis, 'fetch', async () => { throw new Error('controls must not fetch'); });
function mockFetch(...responders) {
  const calls = [];
  mock.method(globalThis, 'fetch', async (input, init) => { calls.push({ url: new URL(String(input), 'http://localhost'), init }); return responders.shift()(); });
  return calls;
}
const owned = u => ['q', 'category', 'maxSpread', 'minSize', 'closing'].filter(k => u.searchParams.has(k));

test('client renders SSR initialFilters into controls and rows; labels exist; category stays first select; default caption unchanged', () => {
  const filtered = harness({ initial: initialPage(), initialError: null, initialFilters: { filters: f({ maxSpread: '1', minSize: '' }), invalidKeys: [] } });
  assert.deepEqual(filtered.eventLinks(), ['KXB-E1']);
  assert.deepEqual([filtered.value('Max spread (¢)'), filtered.value('Min displayed size'), filtered.value('Closes within')], ['1', '', '']);
  filtered.firstSelectIs('Category');
  assert.match(filtered.html(), /Showing 1 of 1 event groups \(filtered from 2 in the sample\)/);
  const plain = harness({ initial: initialPage(), initialError: null });
  assert.deepEqual(plain.eventLinks(), ['KXA-E1', 'KXB-E1']);
  assert.match(plain.html(), /Showing 2 of 2 event groups\./);
  assert.match(plain.html(), /1 sampled open market\./);
});

test('row counts: matched vs sampled rows per group under a filter', () => {
  const ms = ['T1', 'T2', 'T3'].map((t, i) => mk(`KXA-E1-${t}`, i === 0 ? quote(0.42, 0.43) : {}));
  const h = harness({ initial: page([group('KXA-E1', ms)], T0), initialError: null, initialFilters: { filters: f({ maxSpread: '1' }), invalidKeys: [] } });
  assert.deepEqual(h.marketLinks(), ['KXA-E1-T1']);
  assert.match(h.html(), /1 of 3 sampled open markets match/);
});

test('invalid link: explicit warning and NO results; Reset filters clears owned keys via pushState, keeps hash/unrelated, no fetch', () => {
  const w = fakeWindow('?platform=kalshi&view=discover&maxSpread=3&foo=bar', '#top');
  const fetches = noFetch();
  const h = harness({ initial: initialPage(), initialError: null, initialFilters: { filters: { ...D0 }, invalidKeys: ['maxSpread'] } });
  assert.match(h.html(), />[^<]*(invalid[^<]*maxSpread|maxSpread[^<]*invalid)[^<]*</i, 'one visible warning names the bad key');
  assert.deepEqual(h.eventLinks(), [], 'never quietly broadened to the unfiltered sample');
  h.click('Reset filters');
  assert.equal(w.calls.length, 1);
  const { kind, url } = w.calls[0];
  assert.equal(kind, 'push');
  assert.deepEqual([owned(url), url.searchParams.get('foo'), url.searchParams.get('platform'), url.searchParams.get('view'), url.hash],
    [[], 'bar', 'kalshi', 'discover', '#top']);
  assert.deepEqual(h.eventLinks(), ['KXA-E1', 'KXB-E1']);
  assert.doesNotMatch(h.html(), /invalid/i);
  assert.equal(fetches.mock.callCount(), 0);
});

test('valid link category absent from the sample stays selected as an unavailable option with zero results', () => {
  const h = harness({ initial: initialPage(), initialError: null, initialFilters: { filters: f({ category: 'Politics' }), invalidKeys: [] } });
  assert.equal(h.value('Category'), 'Politics');
  assert.match(h.html(), /<option value="Politics"[^>]*>[^<]*Politics[^<]*<\/option>/);
  assert.deepEqual(h.eventLinks(), []);
});

test('controls update URL natively: select/category push, search typing replace; hash+unrelated kept; no fetch, no Next nav', () => {
  const w = fakeWindow('?platform=kalshi&view=discover&foo=bar', '#x');
  const fetches = noFetch();
  const h = harness({ initial: initialPage(), initialError: null });
  h.set('Max spread (¢)', '1');
  assert.deepEqual(h.eventLinks(), ['KXB-E1']);
  h.search('kx');
  h.search('kxb');
  h.select('Crypto');
  h.set('Closes within', '7d');
  assert.deepEqual(w.calls.map(c => c.kind), ['push', 'replace', 'replace', 'push', 'push']);
  const last = w.calls.at(-1).url;
  assert.deepEqual(Object.fromEntries(last.searchParams), { platform: 'kalshi', view: 'discover', foo: 'bar', q: 'kxb', category: 'Crypto', maxSpread: '1', closing: '7d' });
  assert.equal(last.hash, '#x');
  assert.equal(last.pathname, '/markets');
  assert.deepEqual(h.eventLinks(), [], 'KXB closes 2099, outside 7d');
  assert.equal(fetches.mock.callCount(), 0);
});

test('popstate (mounted listener) updates controls and rows, resets expansion, warns on invalid; cleanup removes listener', () => {
  const w = fakeWindow();
  noFetch();
  const ms = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'].map((t, i) => mk(`KXA-E1-${t}`, i === 0 ? quote(0.42, 0.43) : {}));
  const h = harness({ initial: page([group('KXA-E1', ms)], T0), initialError: null });
  h.mount();
  assert.equal(w.listeners.popstate.length, 1);
  h.click('Show 2 more sampled markets');
  assert.equal(h.marketLinks().length, 6);
  w.pop('?platform=kalshi&view=discover&maxSpread=1');
  assert.equal(h.value('Max spread (¢)'), '1');
  assert.deepEqual(h.marketLinks(), ['KXA-E1-T1']);
  w.pop('?platform=kalshi&view=discover');
  assert.equal(h.value('Max spread (¢)'), '');
  assert.equal(h.marketLinks().length, 4, 'expanded state reset');
  w.pop('?platform=kalshi&view=discover&maxSpread=3');
  assert.match(h.html(), /invalid/i);
  assert.deepEqual(h.eventLinks(), []);
  assert.equal(w.calls.length, 0, 'popstate never writes history');
  h.unmount();
  assert.equal(w.listeners.popstate.length, 0);
});

test('filters changed while Refresh is pending persist; missing category reset uses CURRENT filters and replaceState', async () => {
  const w = fakeWindow('?platform=kalshi&view=discover&foo=bar', '#h');
  let resolve;
  const calls = mockFetch(() => new Promise(r => { resolve = r; }));
  const h = harness({ initial: initialPage(), initialError: null });
  const refreshing = h.click('Refresh');
  h.set('Max spread (¢)', '5');
  h.search('kxc');
  h.select('Crypto');
  const before = w.calls.length;
  resolve(Response.json(page([group('KXC-E1', [mk('KXC-E1-T1')])])));
  await refreshing;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname + calls[0].url.search, '/api/kalshi/discovery');
  assert.deepEqual(h.eventLinks(), ['KXC-E1']);
  assert.match(h.html(), /Category &quot;Crypto&quot; is not in the new sample; showing all categories/);
  assert.equal(w.calls.length, before + 1);
  const { kind, url } = w.calls.at(-1);
  assert.equal(kind, 'replace');
  assert.deepEqual(Object.fromEntries(url.searchParams), { platform: 'kalshi', view: 'discover', foo: 'bar', q: 'kxc', maxSpread: '5' });
  assert.equal(url.hash, '#h');
  assert.deepEqual([h.value('Max spread (¢)'), h.value('Category')], ['5', '']);
});

test('Refresh resets only missing category and preserves invalid URL filters instead of broadening on reload', async () => {
  const w = fakeWindow('?platform=kalshi&view=discover&category=Politics&maxSpread=3&foo=bar', '#h');
  const initialFilters = F().parseDiscoveryFilters(new URLSearchParams(w.location.search));
  mockFetch(() => Response.json(initialPage()));
  const h = harness({ initial: initialPage(), initialError: null, initialFilters });
  await h.click('Refresh');
  assert.equal(new URLSearchParams(w.location.search).get('maxSpread'), '3');
  assert.equal(new URLSearchParams(w.location.search).has('category'), false);
  assert.match(h.html(), /invalid[^<]*maxSpread/i);
  assert.deepEqual(h.eventLinks(), []);
  assert.equal(w.location.hash, '#h');
});

test('pasted control characters become visible spaces and the search URL stays in sync', () => {
  const w = fakeWindow();
  const h = harness({ initial: initialPage(), initialError: null });
  h.search('fed\trate\u0000x ');
  assert.match(h.html(), /value="fed rate x "/);
  assert.equal(new URLSearchParams(w.location.search).get('q'), 'fed rate x');
  h.set('Max spread (¢)', '5');
  assert.equal(new URLSearchParams(w.location.search).get('q'), 'fed rate x');
});

test('malformed Refresh keeps the previous sample, active filters and URL', async () => {
  const w = fakeWindow();
  mockFetch(() => Response.json({ ...initialPage(), sourceAsOf: T1 }));
  const h = harness({ initial: initialPage(), initialError: null, initialFilters: { filters: f({ maxSpread: '1' }), invalidKeys: [] } });
  await h.click('Refresh');
  assert.match(h.html(), /malformed discovery sample/);
  assert.deepEqual(h.eventLinks(), ['KXB-E1']);
  assert.equal(h.value('Max spread (¢)'), '1');
  assert.equal(w.calls.length, 0);
});
