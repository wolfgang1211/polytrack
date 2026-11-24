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

test('load failure shows a message and points to the other Kalshi views', () => {
  const h = html({ scan: null, error: 'Kalshi markets could not be loaded right now.' });
  assert.match(h, /could not be loaded/);
  assert.match(h, /Discover, Newest, Events/);
});

test('wiring: Kalshi provider link and Top tab go to view=top; the page renders KalshiTopClient from the cached scan', () => {
  const sel = load('src/app/markets/MarketPlatformSelect.tsx');
  assert.equal(sel.TOP_HREF, '/markets?platform=kalshi&view=top');
  const views = renderToStaticMarkup(React.createElement(sel.KalshiViewSelect, { active: 'top' }));
  assert.match(views, /href="\/markets\?platform=kalshi&amp;view=top" aria-current="page"[^>]*>Top</);
  const page = fs.readFileSync(path.join(root, 'src/app/markets/page.tsx'), 'utf8');
  assert.match(page, /view === 'top'[\s\S]*getCachedKalshiTop\(\)[\s\S]*<KalshiTopClient/);
  assert.match(page, /export const maxDuration = 120;/);
  const cache = fs.readFileSync(path.join(root, 'src/lib/kalshiTopCache.ts'), 'utf8');
  assert.match(cache, /unstable_cache\(/);
  assert.match(cache, /KALSHI_TOP_REVALIDATE_S = 900/);
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
