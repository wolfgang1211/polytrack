/* Kalshi Top view (src/app/markets/KalshiTopClient.tsx + view=top wiring). SSR markup only; every fixture is SYNTHETIC.
   Not visual/mobile/hydration proof — that is checked separately in a real browser. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');

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
      fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    new Function('exports', 'require', 'module', '__filename', '__dirname', out)(mod.exports, req, mod, file, path.dirname(file));
    return mod.exports;
  }
  return load;
}
const Link = ({ href, children, ...rest }) => { delete rest.prefetch; return React.createElement('a', { href, ...rest }, children); };
const load = makeLoader({ 'next/link': { __esModule: true, default: Link } });
const Client = load('src/app/markets/KalshiTopClient.tsx');
const NOW = Date.parse('2026-11-23T21:00:00Z');

const ev = (eventTicker, extra = {}) => ({
  eventTicker, title: `Synthetic ${eventTicker}`, category: 'Sports', volume24hContracts: 1_940_205, openInterestContracts: 52_000,
  tradedMarkets: 2, closeTime: '2026-11-26T01:15:00Z',
  outcomes: [
    { ticker: `${eventTicker}-A`, label: 'Cincinnati', yesBid: 0.72, yesAsk: 0.73, volume24hContracts: 1_000_000 },
    { ticker: `${eventTicker}-B`, label: 'Washington', yesBid: 0.27, yesAsk: 0.28, volume24hContracts: 900_000 },
  ], ...extra,
});
const scan = (extra = {}) => ({
  events: [
    ev('KXGAME-1'),
    ev('KXFED-1', { category: 'Economics', title: 'Fed hike in Dec?', tradedMarkets: 1,
      outcomes: [{ ticker: 'KXFED-1-H', label: 'Hike', yesBid: 0.03, yesAsk: 0.04, volume24hContracts: 9 }] }),
    ev('KXODD-1', { category: 'Brand New', tradedMarkets: 7 }),
  ],
  scannedMarkets: 176_506, listableMarkets: 176_506, tradedMarkets: 22_275, tradedEvents: 4_100, pages: 177,
  complete: true, stopReason: 'done', scanMs: 21_000, receivedAt: '2026-11-23T20:55:00.000Z', ...extra,
});
const html = props => renderToStaticMarkup(React.createElement(Client.default, { serverNow: NOW, error: null, ...props }));

test('one card per event, Polymarket-style tiles, contract units, details links', () => {
  const h = html({ scan: scan() });
  assert.equal((h.match(/data-explorer-card=""/g) || []).length, 3);
  assert.match(h, /Markets<\/span> <span class="text-grad">Explorer/);
  assert.match(h, />Cincinnati<\/p><p class="[^"]*text-grad-profit[^"]*">73¢</);
  assert.match(h, />Washington<\/p><p class="[^"]*text-grad-loss[^"]*">28¢</);
  assert.match(h, /1\.9M <span[^>]*>contracts<\/span>/);
  assert.match(h, /href="\/markets\/kalshi\/events\/KXGAME-1"[^>]*>View all outcomes</);
  assert.match(h, /href="\/markets\/kalshi\/KXFED-1-H"[^>]*>View market &amp; order book</);
  assert.match(h, /2d left/);
  assert.doesNotMatch(h, /\$1\.9M/, 'contract volume is never shown as dollars');
});

test('single-market events show Yes ask and the No ask derived from the Yes bid', () => {
  const h = html({ scan: scan() });
  assert.match(h, />Yes<\/p><p[^>]*>4¢</);
  assert.match(h, />No<\/p><p[^>]*>97¢</);
  assert.equal(Client.noAsk(null), null);
  assert.equal(Client.cents(null), '—');
  assert.equal(Client.cents(0.002), '0.2¢');
});

test('published categories become chips; unknown is Other; only chips with events are shown', () => {
  const h = html({ scan: scan() });
  for (const c of ['All', 'Sports', 'Economy', 'Other']) assert.match(h, new RegExp(`<button[^>]*>${c}</button>`));
  assert.doesNotMatch(h, /<button[^>]*>Crypto<\/button>/);
  assert.match(h, /\+5 more outcomes/);
});

test('scan facts are stated; a partial scan is labelled as partial with its reason', () => {
  const full = html({ scan: scan() });
  assert.match(full, /Full scan · updated 5 min ago/);
  assert.match(full, /176,506 rows, 177 pages/);
  assert.match(full, /contract counts, not dollars/);
  const partial = html({ scan: scan({ complete: false, stopReason: 'rate_limited' }) });
  assert.match(partial, /Partial scan/);
  assert.match(partial, /stopped early \(Kalshi rate limit\)/);
});

test('no ask: the best bid is shown and labelled as a bid; closed events are hidden', () => {
  const s = scan();
  s.events[0].outcomes[0] = { ...s.events[0].outcomes[0], yesAsk: null, yesBid: 0.99 };
  s.events.push(ev('KXOLD-1', { title: 'Already closed', closeTime: '2026-11-23T20:00:00Z' }));
  const h = html({ scan: s });
  assert.match(h, />Cincinnati<\/p><p[^>]*>99¢<span[^>]*>bid<\/span>/);
  assert.doesNotMatch(h, /Already closed/);
});

test('stale cache: an old scan is flagged as refreshing and the client polls the API for the background result', () => {
  assert.equal(Client.isStale('2026-11-23T20:55:00.000Z', NOW), false);
  assert.equal(Client.isStale('2026-11-23T09:00:00.000Z', NOW), true);
  const src = fs.readFileSync(path.join(root, 'src/app/markets/KalshiTopClient.tsx'), 'utf8');
  assert.match(src, /fetch\('\/api\/kalshi\/top', \{ cache: 'no-store' \}\)/);
  assert.match(src, /Date\.parse\(next\.receivedAt\) > since/);
  assert.match(src, /refreshing…/);
  const route = fs.readFileSync(path.join(root, 'src/app/api/kalshi/top/route.ts'), 'utf8');
  assert.match(route, /s-maxage=30'/);
});

test('load failure shows a message and a retry hint', () => {
  const h = html({ scan: null, error: 'Kalshi markets could not be loaded right now.' });
  assert.match(h, /could not be loaded/);
  assert.match(h, /try again in a few minutes/);
});

test('sorts and chips mirror the Polymarket explorer (Open Interest in the liquidity slot, stated in About)', () => {
  const h = html({ scan: scan() });
  const sorts = [...h.matchAll(/<button type="button"[^>]*min-h-\[44px\] rounded-lg[^>]*>([^<]+)<\/button>/g)].map(m => m[1]);
  assert.deepEqual(sorts, ['24h Volume', 'Total Volume', 'Open Interest', 'Closing Soon', 'Newest']);
  const top = load('src/lib/kalshiTop.ts');
  assert.deepEqual([...top.KALSHI_CHIPS], ['All', 'Politics', 'Crypto', 'Sports', 'Tech', 'World', 'Entertainment', 'Economy', 'Other']);
  assert.match(h, /Kalshi publishes no liquidity figure, so Open Interest takes that place/);
});

test('one Kalshi view like Polymarket: no view tabs; legacy ?view= and ?series= URLs redirect permanently', async () => {
  const sel = load('src/app/markets/MarketPlatformSelect.tsx');
  assert.equal(sel.KALSHI_HREF, '/markets?platform=kalshi');
  const redirects = [];
  const stub = name => ({ __esModule: true, default: () => React.createElement('div', { 'data-stub': name }) });
  const Page = makeLoader({
    'next/link': { __esModule: true, default: Link },
    'next/navigation': { permanentRedirect: url => { redirects.push(url); throw new Error('REDIRECT'); } },
    '@/lib/markets': { fetchMarketsList: async () => [] },
    '@/lib/kalshiTopCache': { getCachedKalshiTop: async () => scan() },
    './MarketsClient': stub('poly'), './KalshiTopClient': stub('top'),
  })('src/app/markets/page.tsx').default;
  const out = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ platform: 'kalshi' }) }));
  assert.match(out, /data-stub="top"/);
  assert.match(out, /aria-label="Market data provider"/);
  assert.doesNotMatch(out, /Kalshi view|>Discover<|>Newest<|>Events</);
  for (const q of [{ view: 'discover' }, { view: 'events' }, { view: 'markets' }, { view: 'top' }, { series: 'KXFED' }]) {
    await assert.rejects(Page({ searchParams: Promise.resolve({ platform: 'kalshi', ...q }) }), /REDIRECT/);
  }
  assert.deepEqual([...new Set(redirects)], ['/markets?platform=kalshi']);
  const poly = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  assert.match(poly, /data-stub="poly"/);
});

test('Kalshi card shows the event image like Polymarket; cents never round a live quote to 100¢ or 0¢', () => {
  const s = scan(); s.events[0].image = 'https://img.test/a.png';
  const h = html({ scan: s });
  assert.match(h, /<img src="https:\/\/img\.test\/a\.png" alt="" class="h-10 w-10 flex-shrink-0 rounded-xl object-cover"/);
  assert.equal(Client.cents(0.9996), '99.9¢');
  assert.equal(Client.cents(0.0004), '0.1¢');
  assert.equal(Client.cents(0.999), '99.9¢');
  assert.equal(Client.cents(0.004), '0.4¢');
  assert.equal(Client.cents(0.5), '50¢');
  assert.equal(Client.cents(1), '100¢');
});

test('Polymarket explorer: same cents rule; a passed end date on an active market reads "Awaiting result", never "Closed"', () => {
  const src = fs.readFileSync(path.join(root, 'src/app/markets/MarketsClient.tsx'), 'utf8');
  assert.match(src, /if \(ms <= 0\) return 'Awaiting result';/);
  assert.doesNotMatch(src, /'Closed'/);
  assert.match(src, /Number\.isFinite\(p\) \? cents\(p\) : '—'/);
  const utils = load('src/lib/utils.ts');
  for (const t of ['Yokohama: Ryo Ono vs Lennon Roark Jones', 'Counter-Strike: Eternal Fire vs DENDELE CS (BO1)', 'Will Everton FC win on 2026-11-23?', 'atp-ono-lennonr-2026-11-22']) {
    assert.equal(utils.detectCategory(t), 'Sports', t);
  }
  assert.equal(utils.detectCategory('Trump vs Harris debate winner'), 'Politics');
  assert.equal(utils.detectCategory('Bitcoin Up or Down - November 24'), 'Crypto');
});

test('Polymarket "Closing Soon" asks the source for markets ending from now on (never an empty list of expired markets)', async () => {
  const urls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async u => { urls.push(String(u)); return new Response(JSON.stringify([{ id: 1, question: 'Q?', active: true, closed: false, endDate: '2099-01-01T00:00:00Z' }]), { status: 200 }); };
  try {
    const { fetchMarketsList } = makeLoader()('src/lib/markets.ts');
    const ending = await fetchMarketsList('ending', 120);
    await fetchMarketsList('vol24h', 120);
    assert.equal(ending.length, 1);
    assert.match(urls[0], /order=endDate&ascending=true&limit=120&end_date_min=\d{4}-\d{2}-\d{2}T\d{2}%3A\d{2}%3A00\.000Z$/);
    assert.doesNotMatch(urls[1], /end_date_min/);
  } finally { globalThis.fetch = realFetch; }
});

test('Polymarket page renders the deep pool server-side so counts and category filters are stable from first paint', () => {
  const page = fs.readFileSync(path.join(root, 'src/app/markets/page.tsx'), 'utf8');
  assert.match(page, /fetchMarketsList\('volume', 200\)/);
  assert.match(page, /initialExtra=\{initialExtra\}/);
  const client = fs.readFileSync(path.join(root, 'src/app/markets/MarketsClient.tsx'), 'utf8');
  assert.match(client, /useState<TopMarket\[\] \| null>\(initialExtra\.length > 0 \? initialExtra : null\)/);
});
