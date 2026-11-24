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
const h1Count =html => (html.match(/<h1\b/g) ?? []).length;

// ---------- SYNTHETIC fixtures ----------
const T1 = '2026-11-19T10:05:00.000Z';
const mk = (ticker, o = {}) => ({ ticker, eventTicker: ticker.replace(/-T\d+$/, ''), title: `SYNTHETIC market ${ticker}`,
  yesLabel: `Outcome ${ticker}`, noLabel: null, status: 'active', marketType: 'binary', closeTime: '2099-06-01T00:00:00Z',
  updatedTime: null, volume24hContracts: 5, totalVolumeContracts: 9, openInterestContracts: 3, yesBid: 0.41, yesAsk: 0.43,
  yesBidSize: 1, yesAskSize: 1, notionalDollars: 1, rulesPrimary: null, rulesSecondary: null, ...o });
const polyMarket = (id, o = {}) => ({ id, question: `SYNTHETIC question ${id}?`, slug: `syn-${id}`, eventSlug: `syn-ev-${id}`,
  outcomes: '["Yes","No"]', outcomePrices: '["0.62","0.38"]', volume24hr: 1234, volumeNum: 5000, liquidityNum: 800,
  endDate: '2099-01-01T00:00:00Z', image: '', category: 'Politics', ...o });

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
  for (const f of ['MarketsClient', 'KalshiTopClient', 'KalshiMarketsClient']) {
    assert.match(src(`src/app/markets/${f}.tsx`), /from '\.\/MarketExplorerUI'/, `${f} imports the shared module`);
  }
  for (const f of [UI, 'src/app/markets/MarketsClient.tsx', 'src/app/markets/KalshiTopClient.tsx', 'src/app/markets/KalshiMarketsClient.tsx',
    'src/app/markets/MarketPlatformSelect.tsx', 'src/app/markets/page.tsx']) {
    assert.doesNotMatch(src(f), /overflow-x-hidden/, f);
  }
});

// ======================= 3 + 8. provider links and page nav group =======================
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

test('Polymarket: "time left" is rendered from the server timestamp, so hydration text matches even if the clock moved', () => {
  const serverNow = Date.parse('2026-11-22T18:00:00Z');
  const ending = polyMarket('p1', { endDate: new Date(serverNow + 59.5 * 60_000).toISOString() });
  const realNow = Date.now;
  try {
    Date.now = () => serverNow + 2 * 60_000; // client hydrates 2 minutes later
    const html = ssr('src/app/markets/MarketsClient.tsx', { initialMarkets: [ending], serverNow });
    assert.match(html, />59m left</, 'label comes from serverNow, not from the moving clock');
    Date.now = () => serverNow + 30 * 60_000;
    assert.equal(ssr('src/app/markets/MarketsClient.tsx', { initialMarkets: [ending], serverNow }), html, 'same props, same markup at any wall-clock time');
  } finally {
    Date.now = realNow;
  }
  assert.match(src('src/app/markets/page.tsx'), /<MarketsClient\b[^>]*serverNow=/, 'page passes its render timestamp');
});

test('Polymarket: a missing or non-numeric outcome price renders as unknown (—), never as 0¢; a real 0 stays 0¢', () => {
  const priceTexts = card => [...card.html.matchAll(/<p class="text-base font-black[^"]*">([^<]*)<\/p>/g)].map(m => m[1]);
  const render = prices => byAttr(ssr('src/app/markets/MarketsClient.tsx', { initialMarkets: [polyMarket('p1', { outcomePrices: prices })] }), 'data-explorer-card')[0];
  assert.deepEqual(priceTexts(render('["0.62"]')), ['62¢', '—'], 'second price missing from the feed');
  assert.deepEqual(priceTexts(render('["0.62", null]')), ['62¢', '—'], 'null price');
  assert.deepEqual(priceTexts(render('["0.62", ""]')), ['62¢', '—'], 'blank price');
  assert.deepEqual(priceTexts(render('["0.62", "abc"]')), ['62¢', '—'], 'non-numeric price');
  assert.deepEqual(priceTexts(render('["1", "0"]')), ['100¢', '0¢'], 'genuine 0 is kept');
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
// ======================= 2 + 5. Kalshi Discover header, filters, about =======================
// ======================= 6. Discover rows and groups =======================
// ======================= MU4: readability, long labels, More filters on back/forward =======================
test('source guard: owned explorer views keep essential text at >= text-xs and >= text-ink/55', () => {
  for (const f of ['MarketsClient', 'KalshiTopClient', 'KalshiMarketsClient',
    // Browser acceptance 2026-11-21 measured 2.5-3.0:1 contrast on these Kalshi quote/detail texts at 375px; keep them guarded too.
    'KalshiQuoteSummary', 'KalshiHistoryClient', 'page', 'kalshi/[ticker]/page', 'kalshi/events/[eventTicker]/page']) {
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
