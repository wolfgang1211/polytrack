/* RED-first tests for the shared in-process Kalshi Discover cache (src/lib/kalshiDiscoveryCache.ts).
   Contract: DISCOVERY_CACHE_TTL_MS = 20000; createKalshiDiscoveryCache(fetcher, now = performance.now) -> async getter;
   getCachedKalshiDiscovery = one module-scope instance wrapping the RAW fetchKalshiDiscovery. Freshness is anchored on load
   COMPLETION, strict < TTL, single flight, deep-cloned results, no stale serving/fallback, invalid payloads are a sanitized 502.
   Factory tests use a mocked loader, a manual clock and deferred promises (no sleeps). Integration tests load the real route
   and SSR page through ONE loader instance with the raw fetcher mocked. Every fixture is SYNTHETIC, never a live result.
   Expected to fail until kalshiDiscoveryCache.ts exists and page + route call getCachedKalshiDiscovery. */
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

const root = path.resolve(__dirname, '..');
const SECRET = 'UPSTREAM-SECRET-BODY-must-not-leak';
const ROUTE = 'src/app/api/kalshi/discovery/route.ts';
const CACHE = 'src/lib/kalshiDiscoveryCache.ts';
const R1 = '2026-11-19T10:00:01.000Z';
const R2 = '2026-11-19T10:00:31.000Z';

// Process-wide slot the default getter must use so separate bundles/module graphs in ONE process share one cache.
const SLOT = Symbol.for('alphaboard.kalshi.discovery-cache.v1');
// Shadow global: inherits every real global (fetch/performance mocks stay visible) but owns the cache slot, so a loader
// never sees another test's cache. Pass the same shadow to several loaders to model module graphs in one process.
function shadowGlobal() {
  const g = Object.create(globalThis);
  Object.defineProperty(g, SLOT, { value: undefined, writable: true, configurable: true, enumerable: false });
  return g;
}

// Minimal copy of the TS transpile loader from kalshi-discovery.test.cjs (relative + @/ alias, name-keyed mocks),
// plus an injected `globalThis` (one shadow per loader unless shared explicitly).
function makeLoader(mocks = {}, sharedGlobal = shadowGlobal()) {
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
    new Function('exports', 'require', 'module', '__filename', '__dirname', 'globalThis', out)(
      mod.exports, req, mod, file, path.dirname(file), sharedGlobal);
    return mod.exports;
  }
  return load;
}
const load = makeLoader();
const K = () => load('src/lib/kalshi.ts');
const E = () => load('src/lib/kalshiEvents.ts');
const D = () => load('src/lib/kalshiDiscovery.ts');
const C = () => load(CACHE);
const kerr = status => e => e instanceof K().KalshiError && e.status === status;

// ---------- SYNTHETIC normalized pages (shape of the known-good isDiscoveryPage fixture; values invented) ----------
const WINDOW = { windowStart: '2026-11-18T10:00:00.000Z', windowEnd: '2026-11-19T10:00:00.000Z' };
function page(receivedAt = R1) {
  const coverage = {
    tradePages: 1, tradesScanned: 1, rejectedTrades: 0, uniqueTickers: 1, selectedTickers: 1, moreTradesAvailable: false,
    oldestTradeAt: '2026-11-19T09:59:00.123456Z', newestTradeAt: '2026-11-19T09:59:00.123456Z', marketPages: 1, rejectedMarkets: 0,
    eventMetadataRequested: 1, eventMetadataFailed: 0, truncated: false, ...WINDOW,
  };
  const market = K().normalizeMarket({
    ticker: 'KXA-E1-T1', event_ticker: 'KXA-E1', title: 'Market KXA-E1-T1', yes_sub_title: 'Yes', no_sub_title: 'No',
    status: 'active', market_type: 'binary', close_time: '2099-12-31T00:00:00Z', updated_time: '2026-11-01T00:00:00Z',
    volume_24h_fp: '10.00', volume_fp: '100.00', open_interest_fp: '5.00', yes_bid_dollars: '0.4100', yes_ask_dollars: '0.4300',
    yes_bid_size_fp: '150.00', yes_ask_size_fp: '75.50', notional_value_dollars: '1.0000',
  });
  const event = E().normalizeEvent({
    event_ticker: 'KXA-E1', series_ticker: 'KXA', title: 'Synthetic title KXA-E1', sub_title: 'Synthetic sub',
    category: 'Synthetic Category', mutually_exclusive: false, last_updated_ts: '2026-11-01T00:00:00Z', strike_date: '2099-12-31T00:00:00Z',
  });
  return { groups: [{ eventTicker: 'KXA-E1', event, metadataStatus: 'loaded', markets: [market] }], receivedAt, sourceAsOf: null, coverage };
}
const emptyPage = (receivedAt = R1) => ({
  groups: [], receivedAt, sourceAsOf: null,
  coverage: {
    tradePages: 1, tradesScanned: 0, rejectedTrades: 0, uniqueTickers: 0, selectedTickers: 0, moreTradesAvailable: false,
    oldestTradeAt: null, newestTradeAt: null, marketPages: 0, rejectedMarkets: 0, eventMetadataRequested: 0,
    eventMetadataFailed: 0, truncated: false, ...WINDOW,
  },
});

// ---------- harness: manual clock, deferred promises, recording loader ----------
const clock = (t = 0) => { const c = () => c.t; c.t = t; return c; };
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function spy(impl) { const f = (...args) => { f.calls.push(args); return impl(f.calls.length, ...args); }; f.calls = []; return f; }
const flush = () => new Promise(r => setImmediate(r));
const cached = (impl, now = clock()) => { const fetcher = spy(impl); return { fetcher, now, get: C().createKalshiDiscoveryCache(fetcher, now) }; };
afterEach(() => mock.restoreAll());

// ======================= factory =======================
test('exports TTL 20000, the factory and one shared getter function', () => {
  const c = C();
  assert.equal(c.DISCOVERY_CACHE_TTL_MS, 20000);
  assert.equal(typeof c.createKalshiDiscoveryCache, 'function');
  assert.equal(typeof c.getCachedKalshiDiscovery, 'function');
  assert.equal(typeof c.createKalshiDiscoveryCache(async () => page()), 'function');
});

test('hit before TTL reuses the snapshot unchanged (receivedAt/sourceAsOf/coverage kept, no new freshness stamp)', async () => {
  const { fetcher, now, get } = cached(n => Promise.resolve(page(n === 1 ? R1 : R2)));
  assert.deepEqual(await get(), page(R1));
  now.t = 19999;
  const hit = await get();
  assert.deepEqual(hit, page(R1));
  assert.equal(hit.sourceAsOf, null);
  assert.equal(fetcher.calls.length, 1);
  assert.deepEqual(fetcher.calls[0], [], 'raw fetcher gets no caller input');
});

test('freshness is anchored on load completion, not start; exact 20000 ms boundary expires', async () => {
  const d = deferred();
  const { fetcher, now, get } = cached(n => (n === 1 ? d.promise : Promise.resolve(page(R2))));
  const p = get();
  now.t = 5000;
  d.resolve(page(R1));
  assert.equal((await p).receivedAt, R1);
  now.t = 24999;
  assert.equal((await get()).receivedAt, R1, 'still fresh 19999 ms after completion');
  assert.equal(fetcher.calls.length, 1);
  now.t = 25000;
  assert.equal((await get()).receivedAt, R2, 'expired at exactly TTL after completion');
  assert.equal(fetcher.calls.length, 2);
});

test('cold concurrent getters share exactly one load and the same snapshot, each as an independent deep clone', async () => {
  const d = deferred();
  const orig = page(R1);
  const { fetcher, get } = cached(() => d.promise);
  const ps = Array.from({ length: 5 }, () => get());
  assert.equal(fetcher.calls.length, 1);
  d.resolve(orig);
  const rs = await Promise.all(ps);
  for (const r of rs) {
    assert.deepEqual(r, page(R1));
    assert.notEqual(r, orig);
    assert.notEqual(r.groups[0], orig.groups[0]);
    assert.notEqual(r.coverage, orig.coverage);
  }
  for (let i = 1; i < rs.length; i++) {
    assert.notEqual(rs[i], rs[0]);
    assert.notEqual(rs[i].groups[0].markets[0], rs[0].groups[0].markets[0]);
  }
});

test('mutating a caller result or the original loader output never poisons the cache', async () => {
  const orig = page(R1);
  const { fetcher, get } = cached(() => Promise.resolve(orig));
  const a = await get();
  a.groups[0].markets[0].ticker = 'POISON';
  a.coverage.tradesScanned = 999;
  a.groups.push('x');
  orig.groups[0].eventTicker = 'POISON2';
  orig.coverage.truncated = true;
  orig.receivedAt = R2;
  const b = await get();
  assert.deepEqual(b, page(R1));
  assert.notEqual(b, a);
  assert.equal(fetcher.calls.length, 1);
});

test('expired entry starts one new flight; no waiter is served stale data while it is pending', async () => {
  const d = deferred();
  const { fetcher, now, get } = cached(n => (n === 1 ? Promise.resolve(page(R1)) : d.promise));
  await get();
  now.t = 20000;
  let settled = 0;
  const ps = Array.from({ length: 3 }, () => get().finally(() => settled++));
  await flush();
  assert.equal(settled, 0, 'nobody received the expired snapshot');
  assert.equal(fetcher.calls.length, 2);
  d.resolve(page(R2));
  for (const r of await Promise.all(ps)) assert.equal(r.receivedAt, R2);
});

test('loader rejection rejects every waiter, clears in-flight state, and the next call retries', async () => {
  const d = deferred();
  const { fetcher, get } = cached(n => (n === 1 ? d.promise : Promise.resolve(page(R2))));
  const ps = Array.from({ length: 3 }, () => get());
  d.reject(new (K().KalshiError)(503, 'Synthetic upstream unavailable.'));
  for (const p of ps) await assert.rejects(p, kerr(503));
  assert.equal((await get()).receivedAt, R2);
  assert.equal(fetcher.calls.length, 2);
});

test('synchronous loader throw becomes a rejection (not a sync throw) and is retried next call', async () => {
  const { fetcher, get } = cached(n => {
    if (n === 1) throw new (K().KalshiError)(504, 'Synthetic timeout.');
    return Promise.resolve(page(R1));
  });
  let p;
  assert.doesNotThrow(() => { p = get(); });
  await assert.rejects(p, kerr(504));
  assert.equal((await get()).receivedAt, R1);
  assert.equal(fetcher.calls.length, 2);
});

test('after expiry a failed reload rejects; the old snapshot is never a fallback', async () => {
  const { fetcher, now, get } = cached(n => (n === 2
    ? Promise.reject(new (K().KalshiError)(502, 'Synthetic bad gateway.'))
    : Promise.resolve(page(n === 1 ? R1 : R2))));
  await get();
  now.t = 30000;
  await assert.rejects(get(), kerr(502));
  assert.equal((await get()).receivedAt, R2);
  assert.equal(fetcher.calls.length, 3);
});

test('malformed loader output is a sanitized KalshiError 502 and is not retained', async () => {
  const good = page(R1);
  for (const [label, bad] of [
    ['null', null], ['string', SECRET], ['groups object', { ...good, groups: {} }], ['sourceAsOf set', { ...good, sourceAsOf: R1 }],
    ['bad receivedAt', { ...good, receivedAt: SECRET }], ['negative count', { ...good, coverage: { ...good.coverage, rejectedTrades: -1 }, leak: SECRET }],
  ]) {
    const { fetcher, get } = cached(n => Promise.resolve(n === 1 ? bad : page(R1)));
    await assert.rejects(get(), e => kerr(502)(e) && !String(e.message).includes(SECRET), label);
    assert.deepEqual(await get(), page(R1), label);
    assert.equal(fetcher.calls.length, 2, label);
  }
});

test('an empty but valid sample is cached like any other result (not treated as missing data)', async () => {
  const { fetcher, now, get } = cached(() => Promise.resolve(emptyPage(R1)));
  assert.equal(D().isDiscoveryPage(emptyPage(R1)), true, 'fixture itself is valid');
  assert.deepEqual(await get(), emptyPage(R1));
  now.t = 10000;
  assert.deepEqual(await get(), emptyPage(R1));
  assert.equal(fetcher.calls.length, 1);
});

test('a backwards monotonic clock invalidates the entry and never extends freshness', async () => {
  const { fetcher, now, get } = cached(n => Promise.resolve(page(n === 1 ? R1 : R2)), clock(10000));
  await get();
  now.t = 9999;
  assert.equal((await get()).receivedAt, R2);
  assert.equal(fetcher.calls.length, 2);
  now.t = 9999 + 19999;
  await get();
  assert.equal(fetcher.calls.length, 2, 'new entry is anchored at its own completion');
});

test('default clock is performance.now', async () => {
  let pt = 1000;
  mock.method(performance, 'now', () => pt);
  const fetcher = spy(n => Promise.resolve(page(n === 1 ? R1 : R2)));
  const get = C().createKalshiDiscoveryCache(fetcher);
  await get();
  pt = 20999;
  assert.equal((await get()).receivedAt, R1);
  pt = 21000;
  assert.equal((await get()).receivedAt, R2);
});

// ======================= integration: real route + SSR page share one cached instance =======================
const nextMocks = () => ({
  'next/link': { __esModule: true, default: ({ href, children, ...rest }) => {
    delete rest.prefetch;
    return React.createElement('a', { href, ...rest }, children);
  } },
  'next/navigation': { notFound: () => { throw new Error('NEXT_NOT_FOUND'); } },
  '@/lib/markets': { fetchMarketsList: async () => [] },
  './MarketsClient': { __esModule: true, default: () => React.createElement('div', { 'data-stub': 'polymarket-client' }) },
});
// Fresh loader per test = fresh module-scope cache. Only the RAW fetcher is replaced; isDiscoveryPage etc. stay real.
function app(rawImpl) {
  const net = mock.method(globalThis, 'fetch', async () => { throw new Error('network disabled in tests'); });
  const raw = spy((...a) => rawImpl(...a));
  const rawMod = { ...makeLoader()('src/lib/kalshiDiscovery.ts'), __esModule: true, fetchKalshiDiscovery: raw };
  const ld = makeLoader({ ...nextMocks(), '@/lib/kalshiDiscovery': rawMod, './kalshiDiscovery': rawMod });
  const call = (q = '') => ld(ROUTE).GET(new Request(`http://localhost/api/kalshi/discovery${q}`));
  return { ld, raw, net, call };
}
const noStoreOnly = res => {
  const cc = res.headers.get('cache-control') ?? '';
  assert.match(cc, /no-store/);
  assert.doesNotMatch(cc, /s-maxage|max-age=[1-9]|stale-while-revalidate|public/);
};
const QUERIES = ['?limit=5', '?cursor=a', '?q=fed', '?view=discover', '?a=1&a=2', '?=x', '?tickers=KXA', '?fresh=1', '?nocache'];

test('route: no-store success via the shared cache; ANY query is a no-store 400 before the cache, cold or warm', async () => {
  const { ld, raw, net, call } = app(() => Promise.resolve(page(R1)));
  for (const q of QUERIES) {
    const res = await call(q);
    assert.equal(res.status, 400, q);
    noStoreOnly(res);
  }
  assert.equal(raw.calls.length, 0, 'cold cache never invoked for a rejected query');
  for (let i = 0; i < 2; i++) {
    const res = await call();
    assert.equal(res.status, 200);
    noStoreOnly(res);
    assert.deepEqual(await res.json(), page(R1));
  }
  for (const q of QUERIES) assert.equal((await call(q)).status, 400, `warm ${q}`);
  assert.equal(raw.calls.length, 1);
  assert.deepEqual(raw.calls[0], [], 'no incoming keys forwarded upstream');
  assert.equal((await ld(CACHE).getCachedKalshiDiscovery()).receivedAt, R1, 'route used the module-scope getter');
  assert.equal(raw.calls.length, 1);
  assert.equal(net.mock.callCount(), 0);
});

test('route: a failed load is a no-store error and is not cached; the next request reloads', async () => {
  // KalshiError must come from the same loader instance the route uses (instanceof mapping); resolved lazily at call time.
  let ctx;
  ctx = app(n => (n === 1
    ? Promise.reject(new (ctx.ld('src/lib/kalshi.ts').KalshiError)(503, 'Synthetic upstream unavailable.'))
    : Promise.resolve(page(R2))));
  const failed = await ctx.call();
  assert.equal(failed.status, 503);
  noStoreOnly(failed);
  assert.equal((await failed.json()).groups, undefined);
  const ok = await ctx.call();
  assert.equal(ok.status, 200);
  noStoreOnly(ok);
  assert.equal((await ok.json()).receivedAt, R2);
  assert.equal(ctx.raw.calls.length, 2);
});

// ======================= one process, several module graphs (Next builds SSR and route as separate bundles) =======================
// Two independent loaders = two module graphs (own KalshiError class each) that share one process global.
function graphs(rawImpl) {
  mock.method(globalThis, 'fetch', async () => { throw new Error('network disabled in tests'); });
  const shared = shadowGlobal();
  const raw = spy((...a) => rawImpl(...a));
  const rawMod = { ...makeLoader()('src/lib/kalshiDiscovery.ts'), __esModule: true, fetchKalshiDiscovery: raw };
  const graph = g => makeLoader({ '@/lib/kalshiDiscovery': rawMod, './kalshiDiscovery': rawMod }, g);
  return { shared, raw, A: graph(shared), B: graph(shared), isolated: graph(shadowGlobal()) };
}

test('default getters in separate module graphs of one process coalesce into one fetch and one snapshot', async () => {
  const d = deferred();
  const { shared, raw, A, B, isolated } = graphs(n => (n === 1 ? d.promise : Promise.resolve(page(R2))));
  assert.notEqual(A(CACHE), B(CACHE), 'graphs are independent module instances');
  const pa = A(CACHE).getCachedKalshiDiscovery();
  const pb = B(CACHE).getCachedKalshiDiscovery();
  await flush();
  assert.equal(raw.calls.length, 1, 'one in-flight load across graphs');
  d.resolve(page(R1));
  const [a, b] = await Promise.all([pa, pb]);
  assert.deepEqual([a.receivedAt, b.receivedAt], [R1, R1]);
  assert.notEqual(a, b);
  assert.equal((await B(CACHE).getCachedKalshiDiscovery()).receivedAt, R1, 'hit served across graphs');
  assert.equal(raw.calls.length, 1);
  assert.notEqual(shared[SLOT], undefined, 'shared state lives in the process-global slot');
  assert.equal(globalThis[SLOT], undefined, 'test shadow kept it off the real global');
  assert.equal((await isolated(CACHE).getCachedKalshiDiscovery()).receivedAt, R2, 'a separate process global does not share');
  assert.equal(raw.calls.length, 2);
});

test('a cross-graph rejection reaches the other graph as its own sanitized KalshiError (status kept) and retry works', async () => {
  const d = deferred();
  const { raw, A, B } = graphs(n => (n === 1 ? d.promise : Promise.resolve(page(R2))));
  const KA = A('src/lib/kalshi.ts').KalshiError;
  const KB = B('src/lib/kalshi.ts').KalshiError;
  assert.notEqual(KA, KB, 'each graph has its own error class');
  const pa = A(CACHE).getCachedKalshiDiscovery(); // graph A owns the shared getter and its error class
  const pb = B(CACHE).getCachedKalshiDiscovery();
  await flush();
  d.reject(new KA(504, SECRET));
  await assert.rejects(pa, e => e instanceof KA && e.status === 504);
  await assert.rejects(pb, e => e instanceof KB && e.status === 504 && !String(e.message).includes(SECRET));
  const res = B('src/lib/kalshi.ts').kalshiErrorResponse(await pb.catch(e => e));
  assert.equal(res.status, 504, 'route mapping in graph B keeps 504 instead of a generic failure');
  assert.equal((await B(CACHE).getCachedKalshiDiscovery()).receivedAt, R2, 'failure not retained; next call reloads');
  assert.equal(raw.calls.length, 2);
});
