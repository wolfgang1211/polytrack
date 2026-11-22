/* RED-first tests for Kalshi QUOTE QUALITY (spread, displayed top-of-book sizes, thin/wide warnings).
   New modules (not yet implemented): src/lib/kalshiQuoteQuality.ts (pure helper) and
   src/app/markets/KalshiQuoteSummary.tsx (shared synchronous summary, no hooks). Real page/client modules are
   server-rendered with ReactDOMServer; only next/link, next/navigation and Polymarket modules are stubbed.
   NOT browser proof: no layout, focus, hover/title display or click behavior is exercised.
   Every fixture is SYNTHETIC (shapes mirror existing tests/kalshi-*.test.cjs fixtures; values invented). */
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
const BASE = 'https://external-api.kalshi.com/trade-api/v2';
afterEach(() => mock.restoreAll());

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
const nextMocks = () => ({
  'next/link': { __esModule: true, default: ({ href, children, ...rest }) => {
    delete rest.prefetch;
    return React.createElement('a', { href, ...rest }, children);
  } },
  'next/navigation': { notFound: () => { throw Object.assign(new Error(NOT_FOUND), { digest: NOT_FOUND }); } },
  '@/lib/markets': { fetchMarketsList: async () => [] },
  './MarketsClient': { __esModule: true, default: () => React.createElement('div', { 'data-stub': 'polymarket-client' }) },
});
// Loaded lazily so each test fails on its own while the module is missing.
const Q = () => makeLoader()('src/lib/kalshiQuoteQuality.ts');
const K = () => makeLoader()('src/lib/kalshi.ts');
const Summary = () => makeLoader(nextMocks())('src/app/markets/KalshiQuoteSummary.tsx').default;
const renderSummary = props => renderToStaticMarkup(React.createElement(Summary(), props));

const qi = (yesBid, yesAsk, yesBidSize = 150, yesAskSize = 150) => ({ yesBid, yesAsk, yesBidSize, yesAskSize });
const RESULT_KEYS = ['ask', 'askSize', 'bid', 'bidSize', 'spreadCents', 'status', 'warnings'];

// ---------- markup helpers ----------
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const attrs = s => Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2].replace(/&amp;/g, '&')]));
/** Every summary root (element carrying data-quote-status), in document order. */
const summaries = html => [...html.matchAll(/<\w+\b([^>]*\bdata-quote-status="[^"]*"[^>]*)>/g)].map(m => attrs(m[1]));
/** Case-sensitive "Label … value" with only tags/whitespace/colon between; value ends at a tag boundary. */
const labeled = (label, value) => new RegExp(`(?<![\\w ])${esc(label)}(?:\\s|:|<[^>]*>)*${esc(value)}(?=\\s*<)`);
const textOnly = html => html.replace(/<[^>]*>/g, ' ');
// Badges are matched as whole element text so disclaimer prose never counts as a badge.
const BADGES_EXCEPT_SIZE_WIDE = />(One-sided quote|No usable quotes|Crossed quote snapshot)</;
const INTERACTIVE =/<(a|button|details|summary|input|select|textarea)\b|tabindex=/i;
const PROMISES = /midpoint|mid-point|probab|%|\bliquid\b|liquidity|healthy|\btight\b|excellent|tradab|fillable|guarantee|you can (buy|sell)|\bas of\b|\blive\b|real-time|just now|no warnings/i;

// ---------- SYNTHETIC fixtures ----------
const rawMarket = (o = {}) => ({
  ticker: 'KXSYN-26DEC-T1', event_ticker: 'KXSYN-26DEC', title: 'Synthetic market?',
  yes_sub_title: 'Synthetic yes', no_sub_title: 'Synthetic no', status: 'active', market_type: 'binary',
  close_time: '2099-12-31T00:00:00Z', updated_time: '2026-11-01T00:00:00Z',
  volume_24h_fp: '1234.50', volume_fp: '98765.25', open_interest_fp: '4321.75',
  yes_bid_dollars: '0.4100', yes_ask_dollars: '0.4300', yes_bid_size_fp: '500.00', yes_ask_size_fp: '500.00',
  notional_value_dollars: '1.0000', rules_primary: 'Synthetic primary rule.', rules_secondary: 'Synthetic secondary rule.',
  ...o,
});
const rawEvent = (o = {}) => ({
  event_ticker: 'KXSYN-26DEC', series_ticker: 'KXSYN', title: 'Synthetic event?', sub_title: 'On Dec 31, 2099',
  category: 'Synthetic Category', mutually_exclusive: true, last_updated_ts: '2026-11-01T03:24:48.885736Z',
  strike_date: '2099-12-31T19:00:00Z', ...o,
});
const rawBook = (yes, no) => ({ orderbook_fp: { yes_dollars: yes, no_dollars: no } });
const mk = (ticker, o = {}) => ({
  ticker, eventTicker: ticker.replace(/-T\d+$/, ''), title: `Market ${ticker}`, yesLabel: `Outcome ${ticker}`, noLabel: null,
  status: 'active', marketType: 'binary', closeTime: '2099-06-01T00:00:00Z', updatedTime: null, volume24hContracts: 5,
  totalVolumeContracts: 9, openInterestContracts: 3, yesBid: 0.41, yesAsk: 0.43, yesBidSize: 500, yesAskSize: 500,
  notionalDollars: 1, rulesPrimary: null, rulesSecondary: null, ...o,
});
const discoveryPage = groups => ({
  groups, receivedAt: '2026-11-19T10:00:00.000Z', sourceAsOf: null,
  coverage: {
    tradePages: 1, tradesScanned: 10, rejectedTrades: 0, uniqueTickers: 4, selectedTickers: 4, moreTradesAvailable: false,
    oldestTradeAt: '2026-11-19T09:00:00Z', newestTradeAt: '2026-11-19T09:59:00Z', marketPages: 1, rejectedMarkets: 0,
    eventMetadataRequested: 1, eventMetadataFailed: 0, truncated: false,
    windowStart: '2026-11-18T10:00:00.000Z', windowEnd: '2026-11-19T10:00:00.000Z',
  },
});

function upstream(fn) {
  const calls = [];
  mock.method(globalThis, 'fetch', async (input, init) => {
    const href = typeof input === 'string' ? input : (input?.url ?? String(input));
    calls.push({ href, url: new URL(href), init });
    const r = await fn(new URL(href), init);
    return r instanceof Response ? r : Response.json(r);
  });
  return calls;
}
const isBook = url => url.pathname.endsWith('/orderbook');
async function renderPage(file, props) {
  const Page = makeLoader(nextMocks())(file).default;
  return renderToStaticMarkup(await Page(props));
}
const DETAIL = 'src/app/markets/kalshi/[ticker]/page.tsx';
const isHistoryCall = c => ['/trade-api/v2/events/KXSYN-26DEC', '/trade-api/v2/markets/trades'].includes(c.url.pathname);
const renderDetail = () => renderPage(DETAIL, { params: Promise.resolve({ ticker: 'KXSYN-26DEC-T1' }) });
const detailWithBook = book => upstream(url => (isBook(url) ? book : { market: rawMarket() }));

// ================= helper: analyzeKalshiQuotes =================
test('policy constants are exported UI heuristics: 10c wide spread, 100-contract small size', () => {
  const { WIDE_SPREAD_CENTS, SMALL_DISPLAYED_SIZE_CONTRACTS } = Q();
  assert.equal(WIDE_SPREAD_CENTS, 10);
  assert.equal(SMALL_DISPLAYED_SIZE_CONTRACTS, 100);
});

test('normal two-sided quote: exact spread in cents, sides preserved, no warnings, no rating fields', () => {
  const r = Q().analyzeKalshiQuotes(qi(0.41, 0.43, 150, 200));
  assert.deepEqual(r, { status: 'two_sided', bid: 0.41, ask: 0.43, bidSize: 150, askSize: 200, spreadCents: 2, warnings: [] });
  assert.deepEqual(Object.keys(r).sort(), RESULT_KEYS);
});

test('wide boundary: exactly 10c is wide, 9.99c is not', () => {
  const { analyzeKalshiQuotes } = Q();
  const at = analyzeKalshiQuotes(qi(0.4, 0.5));
  assert.equal(at.spreadCents, 10);
  assert.deepEqual(at.warnings, ['wide_spread']);
  const below = analyzeKalshiQuotes(qi(0.4001, 0.5));
  assert.equal(below.spreadCents, 9.99);
  assert.deepEqual(below.warnings, []);
});

test('small displayed size: 100 is not small, any usable side below 100 is; fractional sizes preserved', () => {
  const { analyzeKalshiQuotes } = Q();
  assert.deepEqual(analyzeKalshiQuotes(qi(0.41, 0.43, 100, 100)).warnings, []);
  const a = analyzeKalshiQuotes(qi(0.41, 0.43, 99.99, 150));
  assert.deepEqual(a.warnings, ['small_displayed_size']);
  assert.equal(a.bidSize, 99.99);
  const b = analyzeKalshiQuotes(qi(0.41, 0.43, 150, 0.5));
  assert.deepEqual(b.warnings, ['small_displayed_size']);
  assert.equal(b.askSize, 0.5);
  assert.deepEqual(analyzeKalshiQuotes(qi(0.4, 0.5, 20, 30)).warnings, ['wide_spread', 'small_displayed_size']);
});

test('one-sided: an absent price or size makes that whole side unusable; quantity is never kept or invented', () => {
  const { analyzeKalshiQuotes } = Q();
  assert.deepEqual(analyzeKalshiQuotes(qi(0.41, null, 150, 50)),
    { status: 'bid_only', bid: 0.41, ask: null, bidSize: 150, askSize: null, spreadCents: null, warnings: ['one_sided'] });
  assert.deepEqual(analyzeKalshiQuotes(qi(0.41, 0.43, null, 150)),
    { status: 'ask_only', bid: null, ask: 0.43, bidSize: null, askSize: 150, spreadCents: null, warnings: ['one_sided'] });
  assert.deepEqual(analyzeKalshiQuotes(qi(null, 0.43, 150, 40)).warnings, ['one_sided', 'small_displayed_size']);
});

test('both sides absent is unavailable with every field null', () => {
  assert.deepEqual(Q().analyzeKalshiQuotes(qi(null, null, null, null)),
    { status: 'unavailable', bid: null, ask: null, bidSize: null, askSize: null, spreadCents: null, warnings: ['no_quotes'] });
});

test('invalid prices (0, 1, out of range, NaN, Infinity, strings, >4dp) and invalid sizes are rejected, never coerced', () => {
  const { analyzeKalshiQuotes } = Q();
  for (const p of [0, 1, -0.1, 1.5, NaN, Infinity, -Infinity, '0.41', null, undefined, 0.41005, {}]) {
    const r = analyzeKalshiQuotes(qi(p, 0.43));
    assert.equal(r.status, 'ask_only', `price ${String(p)}`);
    assert.equal(r.bid, null);
    assert.equal(r.bidSize, null);
    assert.equal(r.spreadCents, null);
  }
  for (const s of [0, -1, NaN, Infinity, '150', null, undefined]) {
    const r = analyzeKalshiQuotes({ yesBid: 0.41, yesAsk: 0.43, yesBidSize: 150, yesAskSize: s }); // not qi(): its default would replace undefined
    assert.equal(r.status, 'bid_only', `size ${String(s)}`);
    assert.deepEqual([r.ask, r.askSize, r.spreadCents], [null, null, null]);
  }
});

test('crossed snapshot: status crossed, prices preserved, spread null (no abs/clamp), no wide claim', () => {
  const { analyzeKalshiQuotes } = Q();
  assert.deepEqual(analyzeKalshiQuotes(qi(0.45, 0.43)),
    { status: 'crossed', bid: 0.45, ask: 0.43, bidSize: 150, askSize: 150, spreadCents: null, warnings: ['crossed'] });
  assert.deepEqual(analyzeKalshiQuotes(qi(0.9, 0.1, 50, 150)).warnings, ['crossed', 'small_displayed_size']);
});

test('locked quote (bid == ask) is a valid 0 spread, positive zero', () => {
  const r = Q().analyzeKalshiQuotes(qi(0.43, 0.43));
  assert.equal(r.status, 'two_sided');
  assert.ok(Object.is(r.spreadCents, 0));
  assert.deepEqual(r.warnings, []);
});

test('exact tick arithmetic: no binary-float artifacts in spreads', () => {
  const { analyzeKalshiQuotes } = Q();
  for (const [bid, ask, cents] of [[0.41, 0.43, 2], [0.07, 0.1, 3], [0.29, 0.58, 29], [0.4115, 0.413, 0.15], [0.0001, 0.9999, 99.98], [0.57, 0.58, 1]]) {
    assert.equal(analyzeKalshiQuotes(qi(bid, ask)).spreadCents, cents, `${bid}/${ask}`);
  }
});

test('purity: frozen input untouched, deterministic, fresh result objects', () => {
  const { analyzeKalshiQuotes } = Q();
  const input = Object.freeze(qi(0.4, 0.5, 20, 30));
  const a = analyzeKalshiQuotes(input);
  a.warnings.push('mutated');
  const b = analyzeKalshiQuotes(input);
  assert.deepEqual(input, qi(0.4, 0.5, 20, 30));
  assert.deepEqual(b.warnings, ['wide_spread', 'small_displayed_size']);
  assert.notEqual(a.warnings, b.warnings);
});

test('formatSpreadCents: supported cent fractions to 2dp, invalid values are Unavailable (never negative/NaN/rounded)', () => {
  const { formatSpreadCents } = Q();
  for (const [v, s] of [[2, '2¢'], [0, '0¢'], [-0, '0¢'], [0.15, '0.15¢'], [9.99, '9.99¢'], [10, '10¢'], [99.98, '99.98¢'], [0.1, '0.1¢']]) {
    assert.equal(formatSpreadCents(v), s, String(v));
  }
  for (const v of [null, undefined, NaN, Infinity, -Infinity, -1, -0.01, '2', 0.123, 100.01]) {
    assert.equal(formatSpreadCents(v), 'Unavailable', String(v));
  }
});

// ================= shared UI: KalshiQuoteSummary =================
test('summary: spread + contract sizes, independent warnings, data attributes, accessible threshold disclaimer', () => {
  const html = renderSummary(qi(0.4, 0.5, 75.5, 1234.5));
  const [s] = summaries(html);
  assert.deepEqual([s['data-quote-status'], s['data-quote-warnings'], s['data-quote-source']], ['two_sided', 'wide_spread small_displayed_size', 'market']);
  assert.match(html, labeled('Spread', '10¢'));
  assert.match(html, labeled('Bid size', '75.5 contracts'));
  assert.match(html, labeled('Ask size', '1,234.5 contracts'));
  assert.match(html, />Wide spread</);
  assert.match(html, />Small displayed size</);
  assert.doesNotMatch(html, BADGES_EXCEPT_SIZE_WIDE);
  for (const re of [/10¢/, /100 contracts/, /not Kalshi rules/, /top of book only/i, /not full depth/, /freshness is unknown/]) {
    assert.match(textOnly(html), re, `visible/sr text: ${re}`);
    assert.match(s.title ?? '', re, `title: ${re}`);
  }
  assert.doesNotMatch(html, INTERACTIVE); // safe inside an existing market link
  assert.doesNotMatch(textOnly(html), PROMISES);
});

test('summary: one-sided, no quotes and crossed states show Unavailable spread, never 0 or a wide claim', () => {
  for (const [input, status, label] of [
    [qi(0.41, null, 150, null), 'bid_only', 'One-sided quote'],
    [qi(null, null, null, null), 'unavailable', 'No usable quotes'],
    [qi(0.45, 0.43), 'crossed', 'Crossed quote snapshot'],
  ]) {
    const html = renderSummary(input);
    assert.equal(summaries(html)[0]['data-quote-status'], status);
    assert.match(html, new RegExp(`>${label}<`));
    assert.match(html, labeled('Spread', 'Unavailable'));
    assert.doesNotMatch(html, />Wide spread<|(?<![\d.])0¢/);
    assert.doesNotMatch(textOnly(html), PROMISES);
  }
  assert.match(renderSummary(qi(0.41, null, 150, null)), labeled('Ask size', 'Unavailable'));
});

test('summary: tight quote shows no badges and no positive rating; partial book flags observed levels only', () => {
  const tight = renderSummary(qi(0.41, 0.43, 500, 500));
  assert.equal(summaries(tight)[0]['data-quote-warnings'], '');
  assert.doesNotMatch(tight, />(Wide spread|Small displayed size)<|data-quote-partial/);
  assert.doesNotMatch(tight, BADGES_EXCEPT_SIZE_WIDE);
  assert.doesNotMatch(textOnly(tight), PROMISES);
  const partial = renderSummary({ ...qi(0.41, 0.43, 500, 500), partial: true, source: 'book' });
  const [s] = summaries(partial);
  assert.deepEqual([s['data-quote-partial'], s['data-quote-source']], ['true', 'book']);
  assert.match(partial, /observed levels only/);
  assert.match(partial, /cannot be confirmed/);
});

// ================= lists: raw, event, Discovery =================
test('tiny positive displayed sizes never round to zero contracts', () => {
  const load = makeLoader();
  const Summary = load('src/app/markets/KalshiQuoteSummary.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Summary, {
    yesBid: 0.4, yesAsk: 0.42, yesBidSize: 1e-21, yesAskSize: 266242.23,
  }));
  assert.match(html, /1e-21 contracts/);
  assert.doesNotMatch(html, />0 contracts</);
});

/** Closed native "Quote details" disclosure body (no `open` attribute); null when absent or open.
    The summary may hold only aria-hidden decorative SVG markup plus the exact visible text "Quote details". */
const closedQuoteDetails = html => {
  for (const m of html.matchAll(/<details\b(?![^>]*\bopen\b)[^>]*>\s*<summary\b[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)) {
    const visible = m[1].replace(/<svg\b[^>]*\baria-hidden="true"[^>]*>[\s\S]*?<\/svg>/g, '');
    if (!visible.includes('<') && visible.trim() === 'Quote details') return m[2];
  }
  return null;
};

test('raw list SSR: card summary equals the helper result, in a closed Quote details beside the card link in the same article, one upstream request', async () => {
  const raw = rawMarket({ yes_bid_dollars: '0.4000', yes_ask_dollars: '0.5000', yes_bid_size_fp: '75.50', yes_ask_size_fp: '150.00' });
  const calls = upstream(() => ({ markets: [raw], cursor: '' }));
  const html = await renderPage('src/app/markets/page.tsx', { searchParams: Promise.resolve({ platform: 'kalshi' }) });
  assert.equal(calls.length, 1);
  assert.equal(calls.filter(c => isBook(c.url)).length, 0);
  const expected = Q().analyzeKalshiQuotes(K().normalizeMarket(raw));
  const [s] = summaries(html);
  assert.equal(s['data-quote-status'], expected.status);
  assert.equal(s['data-quote-warnings'], expected.warnings.join(' '));
  assert.match(html, labeled('Spread', '10¢'));
  assert.match(html, labeled('Bid size', '75.5 contracts'));
  const articles = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map(m => m[1]);
  assert.equal(articles.length, 1, 'one card for one market');
  const [article] = articles;
  const card = article.match(/<a href="\/markets\/kalshi\/KXSYN-26DEC-T1"[^>]*>([\s\S]*?)<\/a>/);
  assert.ok(card, 'market card link rendered in the card article');
  assert.doesNotMatch(card[1], INTERACTIVE);
  assert.doesNotMatch(card[1], /data-quote-status=/, 'quote summary is outside the primary link');
  const quote = closedQuoteDetails(article);
  assert.ok(quote !== null, 'closed Quote details in the same article');
  const inQuote = summaries(quote);
  assert.equal(inQuote.length, 1);
  assert.equal(inQuote[0]['data-quote-status'], expected.status);
  assert.equal(inQuote[0]['data-quote-warnings'], expected.warnings.join(' '));
  assert.match(quote, labeled('Spread', '10¢'));
  assert.match(quote, labeled('Bid size', '75.5 contracts'));
  assert.match(quote, /KXSYN-26DEC-T1/, 'quote belongs to this ticker');
});

test('event page list SSR: one-sided child quote is labeled, no book requests are added', async () => {
  const calls = upstream(url => (url.pathname.startsWith('/trade-api/v2/events/') ? { event: rawEvent() }
    : { markets: [rawMarket({ yes_ask_dollars: '0.0000', yes_ask_size_fp: '0.00' })], cursor: '' }));
  const html = await renderPage('src/app/markets/kalshi/events/[eventTicker]/page.tsx', { params: Promise.resolve({ eventTicker: 'KXSYN-26DEC' }) });
  assert.equal(calls.length, 2);
  assert.equal(calls.filter(c => isBook(c.url)).length, 0);
  assert.equal(summaries(html)[0]['data-quote-status'], 'bid_only');
  assert.match(html, />One-sided quote</);
  assert.match(html, labeled('Ask size', 'Unavailable'));
});

test('Discovery SSR: every row summary equals the helper, in its own closed Quote details outside the 2-column row link, zero fetches', () => {
  const calls = upstream(() => { throw new Error('Discovery render must not fetch'); });
  const markets = [
    mk('KXA-E1-T1'),
    mk('KXA-E1-T2', { yesBid: 0.3, yesAsk: 0.45, yesBidSize: 12.5, yesAskSize: 300 }),
    mk('KXA-E1-T3', { yesAsk: null, yesAskSize: null }),
    mk('KXA-E1-T4', { yesBid: null, yesAsk: null, yesBidSize: null, yesAskSize: null }),
  ];
  const ev = { eventTicker: 'KXA-E1', seriesTicker: 'KXA', title: 'Title KXA-E1', subTitle: null, category: 'Sports', mutuallyExclusive: true, updatedTime: null, strikeDate: null };
  const Client = makeLoader(nextMocks())('src/app/markets/KalshiDiscoveryClient.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Client, {
    initial: discoveryPage([{ eventTicker: 'KXA-E1', event: ev, metadataStatus: 'loaded', markets }]), initialError: null,
  }));
  assert.equal(calls.length, 0);
  const { analyzeKalshiQuotes } = Q();
  assert.deepEqual(summaries(html).map(s => [s['data-quote-status'], s['data-quote-warnings']]),
    markets.map(m => { const r = analyzeKalshiQuotes(m); return [r.status, r.warnings.join(' ')]; }));
  const rows = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(m => m[1]).filter(li => li.includes('href="/markets/kalshi/KXA-E1-T'));
  assert.equal(rows.length, 4);
  rows.forEach((li, i) => {
    const m = markets[i];
    const link = li.match(/<a href="\/markets\/kalshi\/(KXA-E1-T\d)"([^>]*)>([\s\S]*?)<\/a>/);
    assert.ok(link, `row ${i}: link rendered`);
    const [, ticker, rowAttrs, inner] = link;
    assert.equal(ticker, m.ticker);
    assert.match(rowAttrs, /grid-cols-\[minmax\(0,1fr\)_auto\](?!_)/, `${ticker}: 2-column row link`);
    assert.doesNotMatch(inner, INTERACTIVE);
    assert.doesNotMatch(inner, /data-quote-status=/, `${ticker}: quote summary outside the row link`);
    const quote = closedQuoteDetails(li);
    assert.ok(quote !== null, `${ticker}: closed Quote details in its own row`);
    const r = analyzeKalshiQuotes(m);
    assert.deepEqual(summaries(quote).map(s => [s['data-quote-status'], s['data-quote-warnings']]), [[r.status, r.warnings.join(' ')]], ticker);
    assert.match(quote, new RegExp(`>${esc(ticker)}<`), `${ticker}: quote belongs to this row`);
  });
});

// ================= market detail =================
test('detail: summary uses top of the SAME normalized book, not conflicting metadata; derived-ask provenance kept', async () => {
  // Metadata says 41/43c x 500; the book says 30c bid x5 and a 45c ask derived from a 55c No bid x3.
  const calls = detailWithBook(rawBook([['0.3000', '5.00'], ['0.2000', '9.00']], [['0.5500', '3.00']]));
  const html = await renderDetail();
  // History fetches are covered in kalshi-history.test.cjs; this asserts metadata/book only.
  assert.deepEqual(calls.filter(c => !isHistoryCall(c)).map(c => [c.href, c.init?.method ?? 'GET']), [
    [`${BASE}/markets/KXSYN-26DEC-T1`, 'GET'], [`${BASE}/markets/KXSYN-26DEC-T1/orderbook`, 'GET'],
  ]);
  const all = summaries(html);
  assert.equal(all.length, 1);
  assert.deepEqual([all[0]['data-quote-source'], all[0]['data-quote-status'], all[0]['data-quote-warnings']], ['book', 'two_sided', 'wide_spread small_displayed_size']);
  assert.match(html, labeled('Spread', '15¢'));
  assert.match(html, labeled('Bid size', '5 contracts'));
  assert.match(html, labeled('Ask size', '3 contracts'));
  assert.doesNotMatch(html, labeled('Spread', '2¢'));
  assert.doesNotMatch(html, /500 contracts/);
  assert.match(html, /Yes ask derived from No bids/);
  assert.match(html, /Derived from No bids/); // existing depth table caption unchanged
  assert.match(html, /<td>45¢<\/td>/);
});

test('detail: good metadata + empty book shows No usable quotes from the book, never 0 or metadata quality', async () => {
  detailWithBook(rawBook([], []));
  const html = await renderDetail();
  const [s] = summaries(html);
  assert.deepEqual([s['data-quote-source'], s['data-quote-status'], s['data-quote-warnings']], ['book', 'unavailable', 'no_quotes']);
  assert.match(html, />No usable quotes</);
  assert.match(html, labeled('Spread', 'Unavailable'));
  assert.doesNotMatch(html, /(?<![\d.])0¢/);
});

test('detail: partial/malformed book labels the summary as observed levels only and keeps the existing partial alert', async () => {
  for (const [yes, no, status] of [
    [[['abc', '1'], ['0.3000', '4.00']], [['0.6000', '200.00']], 'two_sided'],
    [[['abc', '1']], [['x', 'y']], 'unavailable'],
  ]) {
    mock.restoreAll();
    detailWithBook(rawBook(yes, no));
    const html = await renderDetail();
    const [s] = summaries(html);
    assert.deepEqual([s['data-quote-status'], s['data-quote-partial']], [status, 'true']);
    assert.match(html, /observed levels only/);
    assert.match(html, /Partial book: \d+ malformed level/);
  }
});

test('detail: book failure keeps the existing alert and renders no summary (no metadata fallback)', async () => {
  const calls = upstream(url => (isBook(url) ? new Response('UPSTREAM-SECRET', { status: 500 }) : { market: rawMarket() }));
  const html = await renderDetail();
  assert.equal(calls.filter(c => !isHistoryCall(c)).length, 2);
  assert.match(html, /Order book is temporarily unavailable/);
  assert.equal(summaries(html).length, 0);
  assert.doesNotMatch(html, /Bid size|Ask size|>Spread</);
});

test('detail: unsupported market keeps its notice, never requests the book, renders no summary', async () => {
  const calls = upstream(url => (isBook(url) ? rawBook([['0.3000', '5.00']], []) : { market: rawMarket({ market_type: 'scalar' }) }));
  const html = await renderDetail();
  assert.equal(calls.filter(c => isBook(c.url)).length, 0);
  assert.match(html, /not supported/);
  assert.equal(summaries(html).length, 0);
});

// ================= boundaries =================
test('existing parser output and API shape are unchanged (no quote-quality fields leak into KalshiMarket)', () => {
  const m = K().normalizeMarket(rawMarket());
  assert.deepEqual(Object.keys(m).sort(), ['closeTime', 'eventTicker', 'marketType', 'noLabel', 'notionalDollars', 'openInterestContracts',
    'rulesPrimary', 'rulesSecondary', 'status', 'ticker', 'title', 'totalVolumeContracts', 'updatedTime', 'volume24hContracts',
    'yesAsk', 'yesAskSize', 'yesBid', 'yesBidSize', 'yesLabel']);
  assert.doesNotMatch(src('src/lib/kalshi.ts'), /kalshiQuoteQuality/);
});

test('source: helper is pure, summary is synchronous/non-interactive, and all four surfaces share it', () => {
  const helper = src('src/lib/kalshiQuoteQuality.ts');
  assert.doesNotMatch(helper, /fetch\(|process\.env|Date\.|Math\.random|localStorage|import\s/);
  const ui = src('src/app/markets/KalshiQuoteSummary.tsx');
  assert.doesNotMatch(ui, /use client|use(State|Effect|Ref|Memo|Callback|LayoutEffect)\b|window\.|document\.|fetch\(|onClick|<a\b|<button|<details/);
  assert.match(ui, /analyzeKalshiQuotes/);
  assert.match(ui, /formatSpreadCents/);
  for (const f of ['src/app/markets/KalshiMarketsClient.tsx', 'src/app/markets/KalshiDiscoveryClient.tsx', DETAIL]) {
    assert.match(src(f), /import KalshiQuoteSummary(?:,\s*\{[^}]*\})? from ['"][^'"]*KalshiQuoteSummary['"]/, f);
  }
  for (const f of ['src/app/markets/KalshiMarketsClient.tsx', 'src/app/markets/KalshiDiscoveryClient.tsx']) {
    assert.doesNotMatch(src(f), /orderbook|fetchVerifiedOrderbook/i, `${f}: no per-row book fetch`);
  }
});
