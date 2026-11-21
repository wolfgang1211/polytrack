/* MU1 RED-first tests: shared Market Explorer UI (src/app/markets/MarketExplorerUI.tsx) and its wiring into the Polymarket
   and Kalshi Discover/Markets/Events views. Evidence is SSR markup (react-dom/server) plus a few source guards: semantic
   STRUCTURE only (elements, data attributes, nesting, open/closed state). It is NOT visual, layout, mobile or hydration
   proof; that gate stays OPEN. Every fixture is SYNTHETIC; nothing fetches the network (TopMarkets/trade link are stubbed). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '..');
const UI = 'src/app/markets/MarketExplorerUI.tsx';

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
const Link = ({ href, children, ...rest }) => { delete rest.prefetch; return React.createElement('a', { href, ...rest }, children); };
const baseMocks = () => ({
  'next/link': { __esModule: true, default: Link },
  'next/navigation': { notFound: () => { throw new Error('NEXT_NOT_FOUND'); } },
  '@/components/TopMarkets': { __esModule: true, default: ({ campaignContext }) => React.createElement('div', { 'data-stub': 'top-markets', 'data-campaign': campaignContext },
    React.createElement('a', { href: 'https://polymarket.com/event/synthetic?via=referral' }, 'SYNTHETIC featured')) },
  '@/components/PolymarketTradeLink': { __esModule: true, default: ({ href }) => React.createElement('a', { href, 'data-stub': 'trade-link' }, 'Trade') },
});
const load = (file, extra = {}) => makeLoader({ ...baseMocks(), ...extra })(file);
const ssr = (file, props, extra) => renderToStaticMarkup(React.createElement(load(file, extra).default, props));
const src = f => fs.readFileSync(path.join(root, f), 'utf8');

// ---------- tiny balanced-tag HTML helpers (SSR output is well-formed) ----------
function nodes(html, open) {
  return [...html.matchAll(open)].map(m => {
    const tag = /^<([a-z0-9]+)/i.exec(m[0])[1];
    const re = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
    re.lastIndex = m.index;
    let depth = 0, x;
    while ((x = re.exec(html))) { depth += x[0][1] === '/' ? -1 : 1; if (depth === 0) break; }
    const end = x ? x.index + x[0].length : html.length;
    return { start: m.index, end, open: m[0], html: html.slice(m.index, end) };
  });
}
const within = (ranges, i) => ranges.some(r => i > r.start && i < r.end);
const at = (html, needle) => { const i = html.indexOf(needle); assert.ok(i >= 0, `missing ${needle}`); return i; };
const details = html => nodes(html, /<details\b[^>]*>/g);
const isOpen = d => /\sopen=""/.test(d.open);
const summaryText = d => (/<summary\b[^>]*>([\s\S]*?)<\/summary>/.exec(d.html)?.[1] ?? '').replace(/<[^>]+>/g, '');
const byAttr = (html, attr) => nodes(html, new RegExp(`<[a-z]+\\b[^>]*\\s${attr}(=""|\\b)[^>]*>`, 'g'));
const withoutRanges = (html, ranges) => ranges.reduceRight((s, r) => s.slice(0, r.start) + s.slice(r.end), html);
const noNestedAnchors = html => assert.ok(!nodes(html, /<a\b[^>]*>/g).some(a => /<a\b/.test(a.html.slice(2))), 'nested <a>');
// Market rows only: any <li> rendered inside KalshiQuoteSummary/policy markup is not a row.
const rowLis = html => nodes(html, /<li\b[^>]*>/g).filter(l => /href="\/markets\/kalshi\/(?!events\/)/.test(l.html));
const h1Count =html => (html.match(/<h1\b/g) ?? []).length;

// ---------- SYNTHETIC fixtures ----------
const T1 = '2026-11-19T10:05:00.000Z';
const ev = (eventTicker, o = {}) => ({ eventTicker, seriesTicker: eventTicker.split('-')[0], title: `SYNTHETIC event ${eventTicker}`,
  subTitle: null, category: 'Sports', mutuallyExclusive: true, updatedTime: null, strikeDate: null, ...o });
const mk = (ticker, o = {}) => ({ ticker, eventTicker: ticker.replace(/-T\d+$/, ''), title: `SYNTHETIC market ${ticker}`,
  yesLabel: `Outcome ${ticker}`, noLabel: null, status: 'active', marketType: 'binary', closeTime: '2099-06-01T00:00:00Z',
  updatedTime: null, volume24hContracts: 5, totalVolumeContracts: 9, openInterestContracts: 3, yesBid: 0.41, yesAsk: 0.43,
  yesBidSize: 1, yesAskSize: 1, notionalDollars: 1, rulesPrimary: null, rulesSecondary: null, ...o });
const group = (t, markets, o = {}) => ({ eventTicker: t, event: ev(t), metadataStatus: 'loaded', markets, ...o });
const coverage = (o = {}) => ({ tradePages: 1, tradesScanned: 10, rejectedTrades: 0, uniqueTickers: 5, selectedTickers: 5,
  moreTradesAvailable: false, oldestTradeAt: '2026-11-19T09:00:00.123456Z', newestTradeAt: '2026-11-19T09:59:00.123456Z',
  marketPages: 1, rejectedMarkets: 0, eventMetadataRequested: 2, eventMetadataFailed: 0, truncated: false,
  windowStart: '2026-11-18T10:00:00.000Z', windowEnd: '2026-11-19T10:00:00.000Z', ...o });
const dpage = (groups, cov = {}) => ({ groups, receivedAt: T1, sourceAsOf: null, coverage: coverage(cov) });
const twoGroups = () => dpage([group('KXA-E1', [mk('KXA-E1-T1')]), group('KXB-E1', [mk('KXB-E1-T1', { yesAsk: null })], { event: ev('KXB-E1', { category: 'Crypto' }) })]);
const polyMarket = (id, o = {}) => ({ id, question: `SYNTHETIC question ${id}?`, slug: `syn-${id}`, eventSlug: `syn-ev-${id}`,
  outcomes: '["Yes","No"]', outcomePrices: '["0.62","0.38"]', volume24hr: 1234, volumeNum: 5000, liquidityNum: 800,
  endDate: '2099-01-01T00:00:00Z', image: '', category: 'Politics', ...o });

const parse = qs => load('src/lib/kalshiDiscoveryFilters.ts').parseDiscoveryFilters(new URLSearchParams(qs));
const discover = (initial, qs = '') => ssr('src/app/markets/KalshiDiscoveryClient.tsx', { initial, initialError: null, initialFilters: parse(qs) });
const quoteHtml = m => ssr('src/app/markets/KalshiQuoteSummary.tsx', { yesBid: m.yesBid, yesAsk: m.yesAsk, yesBidSize: m.yesBidSize, yesAskSize: m.yesAskSize });
const policyHtml = () => renderToStaticMarkup(React.createElement(load('src/app/markets/KalshiQuoteSummary.tsx').KalshiQuotePolicyNote));
const K = () => load('src/lib/kalshi.ts');

// ======================= 1. shared presentational components =======================
test('ExplorerHeader renders a semantic <header> with heading id, title, provider, description and children', () => {
  const { ExplorerHeader } = load(UI);
  const html = renderToStaticMarkup(React.createElement(ExplorerHeader,
    { id: 'syn-heading', title: 'SYNTHETIC Title', provider: 'Kalshi', description: 'SYNTHETIC description' },
    React.createElement('nav', { 'aria-label': 'Child nav' }, 'child')));
  const [h, ...rest] = byAttr(html, 'data-explorer-header');
  assert.equal(rest.length, 0);
  assert.match(h.open, /^<header\b/);
  assert.match(h.html, /<h[12]\b[^>]*id="syn-heading"[^>]*>[\s\S]*SYNTHETIC Title/);
  for (const t of ['Kalshi', 'SYNTHETIC description', 'aria-label="Child nav"']) assert.ok(h.html.includes(t), t);
});

test('ExplorerCard is an <article>, ExplorerToolbar a labelled group; both carry fixed data attributes and className', () => {
  const { ExplorerCard, ExplorerToolbar } = load(UI);
  const card = renderToStaticMarkup(React.createElement(ExplorerCard, { className: 'syn-card' }, 'c'));
  assert.match(byAttr(card, 'data-explorer-card')[0].open, /^<article\b[^>]*class="[^"]*syn-card/);
  const bar = renderToStaticMarkup(React.createElement(ExplorerToolbar, { className: 'syn-bar' }, React.createElement('input', { 'aria-label': 'q' })));
  const [t] = byAttr(bar, 'data-explorer-toolbar');
  assert.match(t.open, /class="[^"]*syn-bar/);
  assert.match(t.open, /role="(search|group|toolbar)"/);
  assert.ok(t.html.includes('aria-label="q"'));
});

test('ExplorerDetails is native <details>, CLOSED by default, explicit open works, summary is plain interactive text', () => {
  const { ExplorerDetails } = load(UI);
  const closed = renderToStaticMarkup(React.createElement(ExplorerDetails, { summary: 'SYNTHETIC more' }, React.createElement('p', null, 'body')));
  const [d] = byAttr(closed, 'data-explorer-details');
  assert.match(d.open, /^<details\b/);
  assert.equal(isOpen(d), false);
  assert.match(d.html, /^<details\b[^>]*>\s*<summary\b/, 'summary is the first child');
  assert.equal(summaryText(d).trim(), 'SYNTHETIC more');
  const summary = /<summary\b[^>]*>[\s\S]*?<\/summary>/.exec(d.html)[0];
  assert.doesNotMatch(summary, /<(a|button)\b/, 'no link/button inside summary');
  assert.match(summary, /min-h-(11|\[44px\])/, '44px touch target');
  assert.ok(d.html.includes('<p>body</p>'));
  assert.equal(isOpen(byAttr(renderToStaticMarkup(React.createElement(ExplorerDetails, { summary: 's', open: true }, 'x')), 'data-explorer-details')[0]), true);
});

test('ExplorerDetails: decorative aria-hidden chevron replaces the marker hidden by flex; native summary semantics untouched', () => {
  const { ExplorerDetails } = load(UI);
  const html = renderToStaticMarkup(React.createElement(ExplorerDetails, { summary: 'SYNTHETIC more' }, 'body'));
  const [d] = byAttr(html, 'data-explorer-details');
  assert.match(d.open, /^<details\b[^>]*class="[^"]*\bgroup\b/, 'group on <details> drives group-open');
  assert.doesNotMatch(d.open, /\s(role|tabindex)=/i, 'details keeps native role');
  const summary = /<summary\b[^>]*>[\s\S]*?<\/summary>/.exec(d.html)[0];
  assert.doesNotMatch(/<summary\b[^>]*>/.exec(summary)[0], /\s(role|tabindex|aria-expanded)=/i, 'summary stays the natural keyboard target');
  const [chev, ...more] = byAttr(summary, 'data-explorer-chevron');
  assert.equal(more.length, 0);
  assert.match(chev.open, /^<svg\b/);
  assert.match(chev.open, /aria-hidden="true"/);
  assert.match(chev.open, /class="[^"]*group-open:rotate-(90|180)/);
  assert.match(chev.open, /class="[^"]*transition/);
  assert.equal(summaryText(d).trim(), 'SYNTHETIC more', 'accessible name is the text only');
  assert.equal(isOpen(d), false);
});

test('source guard: stateless module, no hooks/deps, ink token, min-w-0, readable labels; no overflow-x-hidden anywhere in scope', () => {
  const ui = src(UI);
  assert.doesNotMatch(ui, /\buse(State|Effect|Ref|Memo|Callback|Reducer)\b/);
  assert.deepEqual([...ui.matchAll(/from '([^']+)'/g)].map(m => m[1]).filter(m => m !== 'react'), [], 'no imports beyond react');
  assert.match(ui, /text-ink/);
  assert.match(ui, /min-w-0/);
  assert.doesNotMatch(ui, /text-\[(9|10|11)px\]/);
  for (const f of ['MarketsClient', 'KalshiDiscoveryClient', 'KalshiMarketsClient', 'KalshiEventsClient']) {
    assert.match(src(`src/app/markets/${f}.tsx`), /from '\.\/MarketExplorerUI'/, `${f} imports the shared module`);
  }
  for (const f of [UI, 'src/app/markets/MarketsClient.tsx', 'src/app/markets/KalshiDiscoveryClient.tsx', 'src/app/markets/KalshiMarketsClient.tsx',
    'src/app/markets/KalshiEventsClient.tsx', 'src/app/markets/MarketPlatformSelect.tsx', 'src/app/markets/page.tsx']) {
    assert.doesNotMatch(src(f), /overflow-x-hidden/, f);
  }
});

// ======================= 3 + 8. provider links and page nav group =======================
test('provider select: Kalshi -> DISCOVER_HREF, Polymarket unchanged, raw Markets view URL unchanged, resolvers unchanged', () => {
  const sel = load('src/app/markets/MarketPlatformSelect.tsx');
  assert.equal(sel.DISCOVER_HREF, '/markets?platform=kalshi&view=discover');
  const prov = renderToStaticMarkup(React.createElement(sel.default, { active: 'polymarket' }));
  assert.match(prov, /href="\/markets\?platform=polymarket"[^>]*>Polymarket</);
  assert.match(prov, /href="\/markets\?platform=kalshi&amp;view=discover"[^>]*>Kalshi</);
  const views = renderToStaticMarkup(React.createElement(sel.KalshiViewSelect, { active: 'markets' }));
  assert.match(views, /href="\/markets\?platform=kalshi"[^>]*>Markets</);
  assert.deepEqual(['kalshi', ['kalshi'], 'x', undefined].map(sel.resolvePlatform), ['kalshi', 'polymarket', 'polymarket', 'polymarket']);
  assert.deepEqual(['discover', 'events', 'markets', ['events'], undefined].map(sel.resolveKalshiView), ['discover', 'events', 'markets', 'markets', 'markets']);
});

test('page: provider (and Kalshi view) navs share one wrapping control group in every branch', async () => {
  const stub = name => ({ __esModule: true, default: () => React.createElement('div', { 'data-stub': name }) });
  const Page = load('src/app/markets/page.tsx', {
    '@/lib/markets': { fetchMarketsList: async () => [] },
    '@/lib/kalshi': { ...K(), fetchKalshiMarkets: async () => ({ markets: [], nextCursor: null, rejectedCount: 0, receivedAt: T1 }) },
    '@/lib/kalshiEvents': { ...load('src/lib/kalshiEvents.ts'), fetchKalshiEvents: async () => null },
    '@/lib/kalshiDiscoveryCache': { getCachedKalshiDiscovery: async () => twoGroups() },
    './MarketsClient': stub('poly'), './KalshiMarketsClient': stub('raw'), './KalshiEventsClient': stub('events'), './KalshiDiscoveryClient': stub('discover'),
  }).default;
  for (const q of [{}, { platform: 'kalshi' }, { platform: 'kalshi', view: 'events' }, { platform: 'kalshi', view: 'discover' }]) {
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve(q) }));
    const need = ['aria-label="Market data provider"', ...(q.platform ? ['aria-label="Kalshi view"'] : [])];
    const box = nodes(html, /<(div|header)\b[^>]*>/g).filter(n => need.every(s => n.html.includes(s))).sort((a, b) => a.html.length - b.html.length)[0];
    assert.ok(box, JSON.stringify(q));
    assert.match(box.open, /flex-wrap/, `${JSON.stringify(q)}: nav group wraps instead of stacking full-width rows`);
  }
});

// ======================= 2 + 4. Polymarket =======================
test('Polymarket: one h1 in shared header, search in shared toolbar, cards are ExplorerCard articles, USD units', () => {
  const html = ssr('src/app/markets/MarketsClient.tsx', { initialMarkets: [polyMarket('p1'), polyMarket('p2')] });
  assert.equal(h1Count(html), 1);
  const [header] = byAttr(html, 'data-explorer-header');
  assert.ok(header && /<h1\b/.test(header.html), 'h1 lives in the shared header');
  const [bar] = byAttr(html, 'data-explorer-toolbar');
  assert.ok(bar && /<input\b[^>]*placeholder="Search markets…"/.test(bar.html), 'search inside shared toolbar');
  const cards = byAttr(html, 'data-explorer-card');
  assert.equal(cards.length, 2);
  for (const c of cards) { assert.match(c.open, /^<article\b/); assert.match(c.html, /data-stub="trade-link"/); assert.match(c.html, /\$/); }
  noNestedAnchors(html);
});

test('Polymarket: Featured TopMarkets (campaign unchanged) sits in a CLOSED disclosure; filters/sort/search stay outside', () => {
  const html = ssr('src/app/markets/MarketsClient.tsx', { initialMarkets: [polyMarket('p1')] });
  const featured = details(html).filter(d => d.html.includes('data-stub="top-markets"'));
  assert.equal(featured.length, 1);
  assert.match(featured[0].open, /data-explorer-details/);
  assert.equal(isOpen(featured[0]), false);
  assert.match(summaryText(featured[0]), /featured/i);
  assert.match(featured[0].html, /data-campaign="markets_featured"/);
  assert.match(featured[0].html, /href="https:\/\/polymarket\.com\/event\/synthetic\?via=referral"/, 'referral link intact');
  const ds = details(html);
  for (const needle of ['placeholder="Search markets…"', '>All</button>', '<button']) assert.equal(within(ds, at(html, needle)), false, needle);
  noNestedAnchors(html);
});

// ======================= 2 + 7. Raw Kalshi markets =======================
test('Raw Kalshi: shared header/toolbar; one article per market with exactly ONE market href; quote details outside the anchor', () => {
  const ms = [mk('KXA-E1-T1'), mk('KXA-E1-T2', { yesAsk: null })];
  const html = ssr('src/app/markets/KalshiMarketsClient.tsx', { initial: { markets: ms, nextCursor: null, rejectedCount: 0, receivedAt: T1 }, initialError: null });
  assert.equal(h1Count(html), 1);
  assert.match(byAttr(html, 'data-explorer-header')[0].html, /<h1\b[^>]*id="kalshi-heading"/);
  const [bar] = byAttr(html, 'data-explorer-toolbar');
  assert.ok(/<input\b/.test(bar.html) && />Refresh</.test(bar.html), 'search + Refresh in toolbar');
  const cards = byAttr(html, 'data-explorer-card');
  assert.equal(cards.length, 2);
  cards.forEach((c, i) => {
    assert.match(c.open, /^<article\b/);
    const hrefs = [...c.html.matchAll(/href="\/markets\/kalshi\/([^"]+)"/g)].map(m => decodeURIComponent(m[1]));
    assert.deepEqual(hrefs, [ms[i].ticker], 'exactly one market href');
    const [a] = nodes(c.html, /<a\b[^>]*>/g);
    assert.ok(a.html.includes(ms[i].title) && /Yes ask/.test(a.html) && a.html.includes(K().formatCents(ms[i].yesAsk)), 'question + prices in anchor');
    assert.match(a.html, /\b(View|Open)\b(?! interest)/, 'CTA text, not the "Open interest" label');
    const [q] = details(c.html);
    assert.ok(q && !isOpen(q) && /quote/i.test(summaryText(q)), 'closed Quote details');
    assert.equal(within([a], q.start), false, 'details outside the anchor');
    assert.ok(q.html.includes(quoteHtml(ms[i])), 'real KalshiQuoteSummary inside details');
    const visible = withoutRanges(c.html, details(c.html));
    assert.match(visible, /Closes/); assert.match(visible, /24h volume/i);
  });
  assert.equal((html.match(/href="\/markets\/kalshi\//g) ?? []).length, 2);
  const pi = at(html, policyHtml());
  assert.equal(within([...nodes(html, /<a\b[^>]*>/g), ...cards], pi), false, 'policy note visible outside rows/links');
  noNestedAnchors(html);
});

// ======================= 2. Kalshi events =======================
test('Kalshi events: shared header (one h1) and shared toolbar with the search input; native series form untouched in page', () => {
  const html = ssr('src/app/markets/KalshiEventsClient.tsx', { initial: null, initialError: 'SYNTHETIC load error', seriesTicker: null });
  assert.equal(h1Count(html), 1);
  assert.match(byAttr(html, 'data-explorer-header')[0].html, /<h1\b[^>]*id="kalshi-events-heading"/);
  assert.match(byAttr(html, 'data-explorer-toolbar')[0].html, /<input\b/);
  assert.match(src('src/app/markets/page.tsx'), /aria-label="Filter events by series"/);
});

// ======================= 2 + 5. Kalshi Discover header, filters, about =======================
test('Discover: shared header/toolbar; search, category (first select) and Refresh prominent; numeric filters in CLOSED "More filters"', () => {
  const html = discover(twoGroups());
  assert.equal(h1Count(html), 1);
  assert.match(byAttr(html, 'data-explorer-header')[0].html, /<h1\b[^>]*id="kalshi-discover-heading"/);
  const [bar] = byAttr(html, 'data-explorer-toolbar');
  assert.ok(/<input\b/.test(bar.html) && />Refresh</.test(bar.html), 'search + Refresh in toolbar');
  const ds = details(html);
  const more = ds.filter(d => /more filters/i.test(summaryText(d)));
  assert.equal(more.length, 1);
  assert.equal(isOpen(more[0]), false);
  for (const l of ['Max spread', 'Min displayed size', 'Closes within']) assert.ok(more[0].html.includes(l), l);
  const firstSelect = at(html, '<select');
  const catLabel = nodes(html, /<label\b[^>]*>/g).find(l => l.html.includes('Category'));
  assert.ok(catLabel && within([catLabel], firstSelect), 'category is still the first select');
  for (const needle of ['<input', 'Category', '>Refresh<']) assert.equal(within(ds, at(html, needle)), false, needle);
});

test('Discover: "More filters" opens automatically when ANY numeric filter is active from the URL; category/q alone keep it closed', () => {
  const moreOpen = qs => isOpen(details(discover(twoGroups(), qs)).find(d => /more filters/i.test(summaryText(d))));
  for (const qs of ['maxSpread=5', 'minSize=100', 'closing=24h', 'maxSpread=1&closing=7d']) assert.equal(moreOpen(qs), true, qs);
  for (const qs of ['', 'category=Sports', 'q=fed']) assert.equal(moreOpen(qs), false, qs);
});

test('Discover: invalid-URL warning and Reset stay visible OUTSIDE every collapsed disclosure', () => {
  const html = discover(twoGroups(), 'maxSpread=3');
  const ds = details(html);
  assert.equal(within(ds, at(html, 'role="status"')), false, 'warning outside details');
  assert.match(html, /invalid filter values \(maxSpread\)/);
  assert.equal(within(ds, at(html, '>Reset filters<')), false, 'Reset outside details');
});

test('Discover: concise visible scope (sample, not full catalog, contracts not dollars, retrieval, partial); long notes in CLOSED About', () => {
  const html = discover(dpage(twoGroups().groups, { moreTradesAvailable: true }));
  const ds = details(html);
  const visible = withoutRanges(html, ds);
  assert.match(visible, /not the full catalog/i);
  assert.match(visible, /contract/i); assert.match(visible, /not dollars/i);
  assert.match(visible, /Retrieved /);
  assert.match(visible, /Partial sample/);
  const about = ds.filter(d => /about/i.test(summaryText(d)));
  assert.equal(about.length, 1);
  assert.equal(isOpen(about[0]), false);
  assert.ok(about[0].html.includes('20 seconds'), 'cache policy reachable in About');
  assert.match(visible, /Sampled trades span/, 'actual sample time span stays visible, not hidden with technical explanations');
  assert.ok(ds.some(d => d.html.includes('Trades scanned')), 'coverage table still reachable');
});

// ======================= 6. Discover rows and groups =======================
test('Discover rows: compact minmax grid anchor with title, YES ask and 24h contracts; closed Quote details outside anchor with real summary', () => {
  const page = twoGroups();
  const html = discover(page);
  const lis = rowLis(html);
  const ms = page.groups.flatMap(g => g.markets);
  assert.equal(lis.length, ms.length);
  lis.forEach((li, i) => {
    const m = ms[i];
    const anchors = nodes(li.html, /<a\b[^>]*>/g);
    assert.equal(anchors.length, 1);
    const a = anchors[0];
    assert.match(a.open, /href="\/markets\/kalshi\//);
    assert.match(a.open, /minmax\(0,1fr\)/);
    assert.doesNotMatch(a.open, /_auto_auto_auto/, 'old 4-column row replaced');
    assert.ok(a.html.includes(m.yesLabel), 'title');
    assert.match(a.html, /Yes ask/);
    assert.ok(a.html.includes(K().formatCents(m.yesAsk)), 'published ask, unknown kept as-is');
    assert.ok(a.html.includes(K().formatContracts(m.volume24hContracts)), '24h contracts');
    assert.doesNotMatch(a.html, /%|No price|implied/i, 'ask not converted to probability');
    const [q] = details(li.html);
    assert.ok(q && !isOpen(q), 'closed Quote details');
    assert.equal(within([a], q.start), false, 'details outside anchor');
    assert.ok(q.html.includes(quoteHtml(m)), 'real KalshiQuoteSummary');
  });
  noNestedAnchors(html);
});

test('Discover groups: ExplorerCard articles, 12-group and 4-row caps with counts, honest unknown/not-loaded metadata', () => {
  const gs = Array.from({ length: 13 }, (_, i) => group(`KXG${i}-E1`, Array.from({ length: 5 }, (_, j) => mk(`KXG${i}-E1-T${j + 1}`, { volume24hContracts: 100 - i }))));
  gs[0] = { ...gs[0], event: null, metadataStatus: 'unavailable' };
  gs[1] = { ...gs[1], event: null, metadataStatus: 'not_requested' };
  const html = discover(dpage(gs));
  const cards = byAttr(html, 'data-explorer-card');
  assert.equal(cards.length, 12);
  for (const c of cards) {
    assert.match(c.open, /^<article\b/);
    assert.equal(rowLis(c.html).length, 4);
    assert.match(c.html, /Show 1 more sampled market/);
  }
  assert.match(html, /View all 13 event groups/);
  assert.match(html, /Event details unavailable/);
  assert.match(html, /Event details not loaded/);
  noNestedAnchors(html);
});

// ======================= MU4: readability, long labels, More filters on back/forward =======================
test('source guard: owned explorer views keep essential text at >= text-xs and >= text-ink/55', () => {
  for (const f of ['MarketsClient', 'KalshiDiscoveryClient', 'KalshiMarketsClient', 'KalshiEventsClient']) {
    const s = src(`src/app/markets/${f}.tsx`);
    assert.doesNotMatch(s, /text-\[(9|10|11)px\]/, `${f}: sub-12px text`);
    // The only remaining faint ink is the decorative search icon svg (MarketsClient), which carries no text.
    const faint = [...s.matchAll(/^.*\btext-ink\/(1\d|2\d|3\d|4\d)\b.*$/gm)].map(m => m[0]).filter(l => !/<svg\b/.test(l));
    assert.deepEqual(faint, [], `${f}: low-opacity essential text`);
  }
});

test('Polymarket and raw Kalshi: outcome boxes and grid items carry min-w-0 so long labels truncate instead of overflowing', () => {
  const long = 'SYNTHETIC-very-long-outcome-label-without-any-spaces-'.repeat(4);
  const html = ssr('src/app/markets/MarketsClient.tsx', { initialMarkets: [polyMarket('p1', { outcomes: JSON.stringify([long, 'No']) })] });
  const [card] = byAttr(html, 'data-explorer-card');
  const outcome = nodes(card.html, /<div\b[^>]*class="[^"]*\bflex-1\b[^"]*"[^>]*>/g).find(n => n.html.includes(long));
  assert.ok(outcome, 'outcome box rendered with the full label');
  assert.match(outcome.open, /\bmin-w-0\b/);
  assert.match(outcome.html, /class="[^"]*\btruncate\b[^"]*">SYNTHETIC-very-long/);
  assert.match(html, /<div class="min-w-0"[^>]*><article\b[^>]*data-explorer-card/, 'Polymarket grid item');
  assert.ok(html.includes('62¢') && html.includes('data-stub="trade-link"'), 'price and CTA unchanged');
  const raw = ssr('src/app/markets/KalshiMarketsClient.tsx', { initial: { markets: [mk('KXA-E1-T1')], nextCursor: null, rejectedCount: 0, receivedAt: T1 }, initialError: null });
  assert.match(raw, /<li class="min-w-0"><article\b[^>]*data-explorer-card/, 'raw Kalshi grid item');
});

/* Deterministic hook shim (same technique as tests/kalshi-discovery-filters.test.cjs): useState/useRef/useMemo/useEffect
   replaced, effects run once on mount, popstate dispatched to the registered listener. It proves the component's STATE and the
   `open`/`key` it hands to <details>. It does NOT run React DOM reconciliation in a browser, so the native "user closed the
   panel, then back/forward" DOM behavior is inferred from React's key-remount semantics, not executed here. */
function discoverHarness(search) {
  const listeners = [];
  const loc = { pathname: '/markets', search, hash: '' };
  const nav = (_s, _t, url) => { const u = new URL(String(url), 'http://localhost'); Object.assign(loc, { pathname: u.pathname, search: u.search, hash: u.hash }); };
  globalThis.window = { location: loc, history: { pushState: nav, replaceState: nav },
    addEventListener: (t, fn) => { if (t === 'popstate') listeners.push(fn); }, removeEventListener: () => {} };
  const slots = [], effects = [];
  let i = 0;
  const hooks = {
    useState(init) {
      const k = i++;
      if (!(k in slots)) slots[k] = typeof init === 'function' ? init() : init;
      return [slots[k], u => { slots[k] = typeof u === 'function' ? u(slots[k]) : u; }];
    },
    useRef(init) { const k = i++; if (!(k in slots)) slots[k] = { current: init }; return slots[k]; },
    useMemo(fn) { i++; return fn(); },
    useEffect(fn) { effects[i++] = fn; },
  };
  const Client = load('src/app/markets/KalshiDiscoveryClient.tsx', { react: { ...React, ...hooks } }).default;
  const props = { initial: twoGroups(), initialError: null, initialFilters: parse(search) };
  const render = () => { i = 0; return Client(props); };
  const flat = n => (Array.isArray(n) ? n.flatMap(flat) : React.isValidElement(n) ? [n, ...flat(n.props.children)] : []);
  const text = n => (typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(text).join('')
    : React.isValidElement(n) ? text(n.props.children) : '');
  const find = (pred, what) => { const el = flat(render()).find(pred); assert.ok(el, what); return el; };
  render();
  effects.forEach(fn => fn && fn()); // mount: registers the popstate listener
  return {
    more: () => find(n => n.props.summary === 'More filters', 'More filters'),
    moreOpenInHtml: () => isOpen(details(renderToStaticMarkup(render())).find(d => /more filters/i.test(summaryText(d)))),
    click: label => find(n => n.type === 'button' && text(n).trim() === label, label).props.onClick(),
    setMaxSpread: v => flat(find(n => n.type === 'label' && text(n).includes('Max spread'), 'Max spread')).find(x => x.type === 'select').props.onChange({ target: { value: v } }),
    pop: s => { loc.search = s; listeners.forEach(fn => fn({ type: 'popstate', state: null })); },
  };
}

test('Discover: More filters re-syncs with the URL on back/forward (Reset -> back restores numeric filter -> panel opens); edits never collapse it', () => {
  const base = '?platform=kalshi&view=discover';
  try {
    const h = discoverHarness(`${base}&maxSpread=5`);
    let m = h.more();
    const k0 = m.key;
    assert.equal(m.props.open, true, 'opens on load with a numeric URL filter');
    h.click('Reset filters');
    m = h.more();
    assert.deepEqual([m.props.open, m.key], [true, k0], 'Reset (outside the panel) neither collapses nor remounts it');
    // (Native "user closes the panel" happens here in a browser; not executable in this shim.)
    h.pop(`${base}&maxSpread=1`);
    m = h.more();
    assert.equal(m.props.open, true, 'back/forward restoring a numeric filter opens More filters');
    assert.notEqual(m.key, k0, 'new key remounts <details>, so a user-closed panel is re-opened');
    assert.equal(h.moreOpenInHtml(), true);
    const k1 = m.key;
    h.setMaxSpread('');
    m = h.more();
    assert.deepEqual([m.props.open, m.key], [true, k1], 'clearing a filter inside the panel never collapses it under the user');
    h.pop(base);
    m = h.more();
    assert.equal(m.props.open, undefined, 'back/forward to a URL without numeric filters mirrors the closed default');
    assert.notEqual(m.key, k1);
    assert.equal(h.moreOpenInHtml(), false);
    const k2 = m.key;
    h.setMaxSpread('1');
    m = h.more();
    assert.deepEqual([m.props.open, m.key], [undefined, k2], 'user edits do not toggle the panel');
  } finally {
    delete globalThis.window;
  }
});
