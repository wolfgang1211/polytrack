/* Server-render tests for the read-only Kalshi UI. Real page/client modules are rendered with
   ReactDOMServer; only next/link, next/navigation and the Polymarket data/client modules are stubbed.
   These do not simulate browser clicks: hook-driven controls (load more/refresh) get source-boundary checks only. */
const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

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

const nextMocks = () => ({
  'next/link': { __esModule: true, default: ({ href, children, ...rest }) => {
    delete rest.prefetch; // Next-only prop, not a DOM attribute
    return React.createElement('a', { href, ...rest }, children);
  } },
  'next/navigation': { notFound: () => { throw Object.assign(new Error(NOT_FOUND), { digest: NOT_FOUND }); } },
  '@/lib/markets': { fetchMarketsList: async () => [] },
  './MarketsClient': { __esModule: true, default: () => React.createElement('div', { 'data-stub': 'polymarket-client' }) },
});

// SYNTHETIC fixture (shape mirrors observed live sample; values invented)
const rawMarket = (o = {}) => ({
  ticker: 'KXSYN-26DEC-T1', event_ticker: 'KXSYN-26DEC', title: 'Synthetic market?',
  yes_sub_title: 'Synthetic yes', no_sub_title: 'Synthetic no', status: 'active', market_type: 'binary',
  close_time: '2099-12-31T00:00:00Z', updated_time: '2026-11-01T00:00:00Z',
  volume_24h_fp: '1234.50', volume_fp: '98765.25', open_interest_fp: '4321.75',
  yes_bid_dollars: '0.4100', yes_ask_dollars: '0.0000', yes_bid_size_fp: '150.00', yes_ask_size_fp: '0.00',
  notional_value_dollars: '1.0000', rules_primary: 'Synthetic primary rule.', rules_secondary: 'Synthetic secondary rule.',
  ...o,
});
// SYNTHETIC fixture (shape mirrors observed live sample; values invented)
const rawBook = (o = {}) => ({ orderbook_fp: { yes_dollars: [['0.0100', '10.00'], ['0.0200', '20.00']], no_dollars: [['0.9700', '7.00']], ...o } });

function upstream(fn) {
  const calls = [];
  mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    calls.push(url);
    const r = await fn(url, init);
    return r instanceof Response ? r : Response.json(r);
  });
  return calls;
}
const isBook = url => url.pathname.endsWith('/orderbook');
afterEach(() => mock.restoreAll());

async function renderMarkets(searchParams) {
  const Page = makeLoader(nextMocks())('src/app/markets/page.tsx').default;
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(searchParams) }));
}
async function renderDetail(ticker) {
  const Page = makeLoader(nextMocks())('src/app/markets/kalshi/[ticker]/page.tsx').default;
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ ticker }) }));
}
const rejectsNotFound = p => assert.rejects(p, e => e?.digest === NOT_FOUND);

// ---------- provider selector ----------
test('resolvePlatform only accepts the exact scalar "kalshi"', () => {
  const { resolvePlatform } = makeLoader(nextMocks())('src/app/markets/MarketPlatformSelect.tsx');
  assert.equal(resolvePlatform('kalshi'), 'kalshi');
  for (const v of [undefined, 'polymarket', 'KALSHI', ' kalshi', ['kalshi', 'kalshi'], ['kalshi'], '']) {
    assert.equal(resolvePlatform(v), 'polymarket', JSON.stringify(v));
  }
});

test('selector is plain links with aria-current on the active provider only (no fake tab roles)', () => {
  const load = makeLoader(nextMocks());
  const Select = load('src/app/markets/MarketPlatformSelect.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Select, { active: 'kalshi' }));
  assert.match(html, /<a href="\/markets\?platform=polymarket"(?![^>]*aria-current)[^>]*>Polymarket<\/a>/);
  // Kalshi lands on Discover; SSR escapes the query separator as &amp;.
  assert.match(html, /<a href="\/markets\?platform=kalshi&amp;view=top" aria-current="page"[^>]*>Kalshi<\/a>/);
  assert.equal((html.match(/aria-current/g) || []).length, 1);
  assert.doesNotMatch(html, /role="tab/);
});

// ---------- /markets page provider isolation ----------
for (const [label, sp] of [['default', {}], ['repeated platform', { platform: ['kalshi', 'kalshi'] }], ['unknown platform', { platform: 'other' }]]) {
  test(`/markets ${label} renders Polymarket and makes no Kalshi request`, async () => {
    const calls = upstream(() => ({ markets: [], cursor: '' }));
    const html = await renderMarkets(sp);
    assert.match(html, /data-stub="polymarket-client"/);
    assert.match(html, /href="\/markets\?platform=polymarket" aria-current="page"/);
    assert.equal(calls.filter(u => u.hostname.includes('kalshi')).length, 0);
  });
}

test('/markets?platform=kalshi server-renders the loaded page with explicit loaded-set labels', async () => {
  const calls = upstream(() => ({ markets: [rawMarket()], cursor: 'opaque+cursor' }));
  const html = await renderMarkets({ platform: 'kalshi' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].searchParams.get('limit'), '100');
  assert.doesNotMatch(html, /polymarket-client/);
  assert.match(html, /href="\/markets\?platform=kalshi" aria-current="page"/);
  assert.match(html, /Search loaded markets/);
  assert.match(html, /Sorting and filters apply to loaded markets only/);
  assert.match(html, /Showing 1 of 1 loaded/);
  assert.match(html, />Load more</);
  assert.match(html, /href="\/markets\/kalshi\/KXSYN-26DEC-T1"/);
  assert.match(html, /41¢/);
  assert.match(html, /Unavailable/); // 0 ask sentinel with 0 size is not a quote
  assert.match(html, /1\.2K contracts/);
  assert.match(html, /4\.3K contracts/);
  assert.match(html, /2099-12-31 00:00 UTC/);
  assert.match(html, /Retrieval time only/);
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /\$1,234|\$1\.2K/); // contract counts never rendered as dollars
});

test('kalshi initial upstream failure shows error + retry, not a genuine-empty message', async () => {
  upstream(() => new Response('UPSTREAM-SECRET', { status: 500 }));
  const html = await renderMarkets({ platform: 'kalshi' });
  assert.match(html, /role="alert"/);
  assert.match(html, />Retry</);
  assert.doesNotMatch(html, /No open binary markets/);
  assert.doesNotMatch(html, /UPSTREAM-SECRET/);
  assert.doesNotMatch(html, />Load more</);
});

test('kalshi genuine empty page is an empty state, and a valid all-rejected page with a cursor stays loadable', async () => {
  upstream(() => ({ markets: [], cursor: '' }));
  let html = await renderMarkets({ platform: 'kalshi' });
  assert.match(html, /No open binary markets on the loaded pages/);
  assert.doesNotMatch(html, /role="alert"/);
  assert.doesNotMatch(html, />Load more</);
  mock.restoreAll();
  upstream(() => ({ markets: [rawMarket({ status: 'mystery' })], cursor: 'next' }));
  html = await renderMarkets({ platform: 'kalshi' });
  assert.match(html, /More pages may still be available/);
  assert.match(html, />Load more</);
  assert.match(html, /1 source rows not shown/);
});

// ---------- detail page ----------
test('detail renders metadata, raw rules, units, depth with derived asks and the retrieval caveat', async () => {
  const calls = upstream(url => (isBook(url) ? rawBook() : { market: rawMarket() }));
  const html = await renderDetail('KXSYN-26DEC-T1');
  // History fetches (events/candlesticks/trades) are covered in kalshi-history.test.cjs; this asserts metadata/book only.
  const isHistory = u => ['/trade-api/v2/events/KXSYN-26DEC', '/trade-api/v2/markets/trades'].includes(u.pathname);
  assert.deepEqual(calls.filter(u => !isHistory(u)).map(u => u.pathname), ['/trade-api/v2/markets/KXSYN-26DEC-T1', '/trade-api/v2/markets/KXSYN-26DEC-T1/orderbook']);
  assert.match(html, /Synthetic market\?/);
  assert.match(html, /Status: active/);
  assert.match(html, /Synthetic primary rule\./);
  assert.match(html, /Synthetic secondary rule\./);
  assert.match(html, /\$1 per contract/);
  assert.match(html, /98\.8K contracts/);
  assert.match(html, /Derived from No bids/);
  assert.match(html, /Derived from Yes bids/);
  assert.match(html, /<td>2¢<\/td>/);
  assert.match(html, /<td>3¢<\/td>/); // yes ask derived from 0.97 no bid
  assert.match(html, /retrieval times only/);
  assert.match(html, /href="\/markets\?platform=kalshi"/);
  assert.doesNotMatch(html, /kalshi\.com\/markets/); // no fabricated external market URL
});

test('detail: invalid ticker is a real 404 with zero network', async () => {
  const calls = upstream(() => ({ market: rawMarket() }));
  await rejectsNotFound(renderDetail('kxsyn-lower'));
  assert.equal(calls.length, 0);
});

test('detail: upstream 404 is notFound, upstream 500 is an unavailable state (not a fake 404)', async () => {
  upstream(() => new Response('x', { status: 404 }));
  await rejectsNotFound(renderDetail('KXSYN-NOPE'));
  mock.restoreAll();
  upstream(() => new Response('UPSTREAM-SECRET', { status: 500 }));
  const html = await renderDetail('KXSYN-26DEC-T1');
  assert.match(html, /temporarily unavailable/);
  assert.doesNotMatch(html, /UPSTREAM-SECRET/);
});

test('detail: book failure keeps metadata and rules visible', async () => {
  upstream(url => (isBook(url) ? new Response('x', { status: 500 }) : { market: rawMarket() }));
  const html = await renderDetail('KXSYN-26DEC-T1');
  assert.match(html, /Synthetic primary rule\./);
  assert.match(html, /Order book is temporarily unavailable/);
});

test('detail: partial book is labeled partial, not complete', async () => {
  upstream(url => (isBook(url) ? rawBook({ yes_dollars: [['abc', '1'], ['0.3000', '4.00']] }) : { market: rawMarket() }));
  const html = await renderDetail('KXSYN-26DEC-T1');
  assert.match(html, /Partial book: 1 malformed level/);
});

test('detail: unsupported (scalar / non-$1) market shows no quotes and never requests the book; closed status visible', async () => {
  const calls = upstream(url => (isBook(url) ? rawBook() : { market: rawMarket({ market_type: 'scalar', status: 'closed' }) }));
  const html = await renderDetail('KXSYN-26DEC-T1');
  assert.match(html, /not supported/);
  assert.match(html, /Status: closed/);
  assert.match(html, /not tradable/);
  assert.equal(calls.filter(isBook).length, 0);
});

// ---------- metadata ----------
test('markets layout metadata names both providers without equating their units', () => {
  const { metadata } = makeLoader(nextMocks())('src/app/markets/layout.tsx');
  for (const d of [metadata.description, metadata.openGraph.description, metadata.twitter.description]) {
    assert.match(d, /Polymarket/);
    assert.match(d, /Kalshi/);
    assert.match(d, /contract/);
  }
});

test('detail metadata has its own canonical/OG URL from awaited params, with zero provider requests', async () => {
  const calls = upstream(() => ({ market: rawMarket() }));
  const { generateMetadata } = makeLoader(nextMocks())('src/app/markets/kalshi/[ticker]/page.tsx');
  const m = await generateMetadata({ params: Promise.resolve({ ticker: 'KXSYN-26DEC-T1' }) });
  assert.equal(m.alternates.canonical, '/markets/kalshi/KXSYN-26DEC-T1');
  assert.equal(m.openGraph.url, '/markets/kalshi/KXSYN-26DEC-T1');
  assert.match(m.title, /KXSYN-26DEC-T1/);
  assert.match(m.twitter.description, /Kalshi/);
  const bad = await generateMetadata({ params: Promise.resolve({ ticker: '../x' }) });
  assert.equal(bad.alternates.canonical, '/markets?platform=kalshi');
  assert.equal(calls.length, 0);
});

test('detail labels market record time, not quote freshness', async () => {
  upstream(url => (isBook(url) ? rawBook() : { market: rawMarket() }));
  const html = await renderDetail('KXSYN-26DEC-T1');
  assert.match(html, /Market record updated/);
  assert.doesNotMatch(html, /Source updated/);
});

// ---------- source boundaries (not browser behavior) ----------
test('source: /markets awaits promise searchParams; Polymarket client stays Kalshi-free', () => {
  assert.match(src('src/app/markets/page.tsx'), /await searchParams/);
  assert.doesNotMatch(src('src/app/markets/MarketsClient.tsx'), /kalshi/i);
});

test('source: load-more uses an opaque encoded cursor, stops on repeats, and guards late responses', () => {
  const s = src('src/app/markets/KalshiMarketsClient.tsx');
  assert.match(s, /encodeURIComponent\(cursor\)/);
  assert.match(s, /usedCursors\.current\.has\(cursor\)/);
  assert.match(s, /setStalled\(true\)/);
  assert.match(s, /new AbortController\(\)/);
  assert.match(s, /gen !== generation\.current/);
  assert.match(s, /MAX_PAGES/);
  assert.match(s, /disabled=\{busy !== null\}/);
});

test('source: new Kalshi UI uses existing theme tokens, no gradients/purple/images/mock data', () => {
  for (const f of ['src/app/markets/KalshiMarketsClient.tsx', 'src/app/markets/MarketPlatformSelect.tsx', 'src/app/markets/kalshi/[ticker]/page.tsx']) {
    const s = src(f);
    assert.doesNotMatch(s, /gradient|purple|violet|<img|SYNTHETIC|mockData/i, f);
    assert.match(s, /var\(--|text-ink/, f);
  }
});
