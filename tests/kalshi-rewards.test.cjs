/* Kalshi liquidity incentive programs as reward farms (src/lib/kalshiRewards.ts + Liquidity Hub UI).
   Upstream is injected; every fixture is SYNTHETIC. SSR markup only — not visual proof. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createLoader } = require('./helpers/load-ts.cjs');
const root = path.resolve(__dirname, '..');
const load = createLoader();
const kr = load('src/lib/kalshiRewards.ts');
const { KalshiError } = load('src/lib/kalshi.ts');

const NOW = Date.parse('2026-11-26T12:00:00Z');
const prog = (ticker, reward, extra = {}) => ({
  id: `id-${ticker}`, incentive_type: 'liquidity', market_ticker: ticker, event_ticker: `EV-${ticker}`, series_ticker: 'SER',
  period_reward: reward, start_date: '2026-11-25T00:00:00Z', end_date: '2026-12-02T00:00:00Z',
  target_size_fp: '1000.00', discount_factor_bps: 5000, paid_out: false, ...extra,
});
const mkt = (ticker, extra = {}) => ({
  ticker, event_ticker: `EV-${ticker}`, status: 'active', market_type: 'binary', notional_value_dollars: '1.0000',
  title: `Synthetic ${ticker}`, yes_bid_dollars: '0.4000', yes_ask_dollars: '0.4200', yes_bid_size_fp: '200.00', yes_ask_size_fp: '300.00',
  last_price_dollars: '0.4100', previous_price_dollars: '0.4000', volume_24h_fp: '50.00', close_time: '2027-01-01T00:00:00Z', ...extra,
});

test('program units: period_reward is centi-cents per period, discount factor in bps, target size in contracts', () => {
  const p = kr.parseProgram(prog('A', 1_000_000));
  assert.equal(p.periodReward, 100);
  assert.equal(p.discountFactor, 0.5);
  assert.equal(p.targetSize, 1000);
  assert.equal(kr.parseProgram({ ...prog('B', 0) }), null);
  assert.equal(kr.parseProgram({ ...prog('C', 100), incentive_type: 'volume' }), null);
  assert.equal(kr.parseProgram({ ...prog('D', 100), end_date: '2026-11-24T00:00:00Z' }), null);
});

test('farm metrics: daily pool = period reward / days; $1K split across both best bids; same grades as Polymarket', () => {
  const f = kr.buildFarm(kr.parseProgram(prog('A', 1_000_000)), mkt('A'), NOW);
  assert.ok(Math.abs(f.dailyRate - 100 / 7) < 1e-9);
  assert.ok(Math.abs(f.spread - 0.02) < 1e-9);
  assert.ok(Math.abs(f.liquidity - (200 * 0.4 + 300 * 0.58)) < 1e-9);
  // Yes: 500/0.40 = 1250 contracts, scored up to the 1000 Target Size, vs max(1000,200); No: 500/0.58 ≈ 862 vs max(1000,300)
  const yes = 1000 / (1000 + 1000), no = (500 / 0.58) / (1000 + 500 / 0.58);
  assert.ok(Math.abs(f.estDailyReward - f.dailyRate * (yes + no) / 2) < 1e-9);
  assert.ok(Math.abs(f.estApr - f.estDailyReward * 365 / 1000 * 100) < 1e-9);
  assert.equal(f.stability, 'B'); // 0.01 move on a 0.41 mid = 2.4%
  assert.equal(f.isNew, true);
  assert.equal(f.endsSoon, true); // program ends within 7 days
  assert.equal(f.competition, 'Low'); // $14.29/d over $980 competing (max(1000,200)×0.40 + max(1000,300)×0.58)
  const crowded = kr.buildFarm(kr.parseProgram(prog('A', 1_000_000)), mkt('A', { yes_bid_size_fp: '40000.00', yes_ask_size_fp: '40000.00' }), NOW);
  assert.equal(crowded.competition, 'High'); // $14.29/d over $39,200
  // non-binary, missing quotes and closed markets are not priced
  assert.equal(kr.buildFarm(kr.parseProgram(prog('A', 1)), mkt('A', { market_type: 'scalar' }), NOW), null);
  assert.equal(kr.buildFarm(kr.parseProgram(prog('A', 1)), mkt('A', { yes_bid_dollars: '0.0000' }), NOW), null);
  assert.equal(kr.buildFarm(kr.parseProgram(prog('A', 1)), mkt('A', { status: 'closed' }), NOW), null);
});

test('a side never scores more than Target Size: at most half the pool per side against a full book', () => {
  assert.equal(kr.sideShare(50_000, 1000, 10), 0.5);
  assert.equal(kr.sideShare(500, 1000, 3000), 500 / 3500);
  assert.equal(kr.sideShare(0, 1000, 0), 0);
});

test('scan: one request for programs, tickers batched by 100, highest program per market, ranked by risk-adjusted APR', async () => {
  const programs = [prog('A', 1_000_000), prog('A', 2_000_000), prog('B', 5_000_000), ...Array.from({ length: 150 }, (_, i) => prog(`Z${i}`, 400_000))];
  const calls = [];
  const getJson = async (p, q) => {
    calls.push({ p, q });
    if (p === '/incentive_programs') return { incentive_programs: programs, next_cursor: '' };
    return { markets: q.tickers.split(',').map(t => mkt(t)) };
  };
  const s = await kr.scanKalshiRewardFarms({ getJson, wait: async () => {}, now: () => NOW });
  assert.deepEqual(calls[0], { p: '/incentive_programs', q: { status: 'active', type: 'liquidity', limit: '10000' } });
  const marketCalls = calls.filter(c => c.p === '/markets');
  assert.equal(marketCalls.length, 2);
  assert.ok(marketCalls.every(c => c.q.tickers.split(',').length <= 100));
  assert.equal(s.marketsWithRewards, 152);
  assert.equal(s.complete, true);
  // B ($500/week on this book) estimates above 1,000% → thin, so it follows the 30 ranked rows
  assert.equal(s.farms.length, kr.TOP_FARMS + 1);
  assert.equal(s.farms.at(-1).ticker, 'B');
  assert.equal(s.farms.at(-1).thin, true);
  assert.equal(s.farms[0].ticker, 'A');
  assert.equal(s.farms.find(f => f.ticker === 'A').periodReward, 200);
  const ranked = s.farms.slice(0, kr.TOP_FARMS);
  for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].riskAdjApr >= ranked[i].riskAdjApr);
  assert.ok(Math.abs(s.totalDailyRewards - (200 + 500 + 150 * 40) / 7) < 1e-6);
  assert.equal(s.maxTicker, 'B');
  assert.ok(Math.abs(s.maxDailyRate - 500 / 7) < 1e-9);
  assert.ok(Math.abs(s.medianDailyRate - 40 / 7) < 1e-9);
});

test('scan: a failed market batch makes the scan partial; all failing or malformed programs is a 502', async () => {
  const programs = Array.from({ length: 150 }, (_, i) => prog(`Z${i}`, 400_000));
  let n = 0;
  const flaky = async (p, q) => {
    if (p === '/incentive_programs') return { incentive_programs: programs };
    if (n++ === 0) throw new KalshiError(502, 'x');
    return { markets: q.tickers.split(',').map(t => mkt(t)) };
  };
  const s = await kr.scanKalshiRewardFarms({ getJson: flaky, wait: async () => {}, now: () => NOW });
  assert.equal(s.complete, false);
  assert.equal(s.marketsWithRewards, 150);
  await assert.rejects(kr.scanKalshiRewardFarms({ getJson: async p => (p === '/incentive_programs' ? { incentive_programs: programs } : Promise.reject(new KalshiError(502, 'x'))), wait: async () => {}, now: () => NOW }), { status: 502 });
  await assert.rejects(kr.scanKalshiRewardFarms({ getJson: async () => ({ nope: 1 }), wait: async () => {} }), { status: 502 });
});

test('thin markets (est. APR >= 1,000%) are labelled and listed after the ranked rows, never above them', async () => {
  // a $1,000/day pool on an empty book estimates far above 1,000% APR
  const programs = [prog('RICH', 70_000_000), ...Array.from({ length: 40 }, (_, i) => prog(`N${i}`, 400_000))];
  const getJson = async (p, q) => (p === '/incentive_programs' ? { incentive_programs: programs } : { markets: q.tickers.split(',').map(t => mkt(t, t === 'RICH' ? { yes_bid_size_fp: '1.00', yes_ask_size_fp: '1.00' } : {})) });
  const s = await kr.scanKalshiRewardFarms({ getJson, wait: async () => {}, now: () => NOW });
  const rich = s.farms.find(f => f.ticker === 'RICH');
  assert.equal(rich.thin, true);
  assert.equal(s.thinMarkets, 1);
  assert.equal(s.farms.length, kr.TOP_FARMS + 1);
  assert.equal(s.farms[s.farms.length - 1].ticker, 'RICH');
  assert.ok(s.farms.slice(0, kr.TOP_FARMS).every(f => !f.thin));
  const ui = makeLoader({ 'next/link': { __esModule: true, default: Link } })('src/app/liquidity/KalshiRewardFarms.tsx');
  const h = renderToStaticMarkup(React.createElement(ui.KalshiFarmsTable, { data: { ...s, farms: [rich] }, loading: false }));
  assert.match(h, /data-thin=""[^>]*>Thin market</);
});

test('comparison: Polymarket pools come from every rewarded market (CLOB list), notes say what each number covers', () => {
  const src = fs.readFileSync(path.join(root, 'src/app/liquidity/RewardFarmsCompare.tsx'), 'utf8');
  assert.match(src, /fetch\('\/api\/liquidity\/rewards\/universe'\)/);
  assert.match(src, /Pools: every market with an active reward\. Top APR: from the screener's top ~400 markets/);
  assert.match(src, /filter\(a => a < 1000\)/);
  const route = fs.readFileSync(path.join(root, 'src/app/api/liquidity/rewards/universe/route.ts'), 'utf8');
  assert.match(route, /fetchRewardUniverse\(\)/);
  assert.match(route, /if \(!u\.complete\) throw/);
});

test('cache layer caches only complete scans; a cold partial scan is still returned', async () => {
  const cache = load('src/lib/kalshiRewardsCache.ts');
  const part = { complete: false, farms: [] };
  assert.equal(await cache.readKalshiRewards(() => cache.completeOrThrow(async () => part)), part);
  await assert.rejects(cache.completeOrThrow(async () => part), e => e instanceof cache.PartialKalshiRewards);
});

function makeLoader(mocks) {
  const cache = new Map();
  const resolve = p => ['', '.tsx', '.ts'].map(ext => p + ext).find(f => fs.existsSync(f) && fs.statSync(f).isFile()) ?? p;
  function ld(file) {
    file = resolve(path.resolve(root, file));
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} };
    cache.set(file, mod);
    const req = name => (name in mocks ? mocks[name] : name.startsWith('@/') ? ld(path.join(root, 'src', name.slice(2))) : name.startsWith('.') ? ld(path.resolve(path.dirname(file), name)) : require(name));
    const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('exports', 'require', 'module', '__filename', '__dirname', out)(mod.exports, req, mod, file, path.dirname(file));
    return mod.exports;
  }
  return ld;
}
const Link = ({ href, children, ...rest }) => React.createElement('a', { href, ...rest }, children);

test('Kalshi table: same columns in the same slots as Polymarket (Discount/Target Size for Max Spread/Min Size), internal market links', () => {
  const ui = makeLoader({ 'next/link': { __esModule: true, default: Link } })('src/app/liquidity/KalshiRewardFarms.tsx');
  const farm = kr.buildFarm(kr.parseProgram(prog('KXTEST-1', 1_000_000)), mkt('KXTEST-1'), NOW);
  const h = renderToStaticMarkup(React.createElement(ui.KalshiFarmsTable, { data: { farms: [farm], totalDailyRewards: 1234, marketsWithRewards: 7023, scanned: 1, complete: true, receivedAt: '' }, loading: false }));
  const heads = [...h.matchAll(/uppercase tracking-widest text-ink\/55[^"]*">([^<]+)<\/span>/g)].map(m => m[1]);
  assert.deepEqual(heads, ['Market', 'Daily Pool', 'Discount', 'Target Size', 'Liquidity', 'Crowding', 'Est. APR*']);
  assert.match(h, /href="\/markets\/kalshi\/KXTEST-1"/);
  assert.match(h, /across 7,023 markets/);
  assert.match(h, /Synthetic KXTEST-1/);
  const poly = fs.readFileSync(path.join(root, 'src/app/liquidity/RewardFarms.tsx'), 'utf8');
  const polyHeads = poly.match(/\['Market', 'Daily Pool', 'Max Spread', 'Min Size', 'Liquidity', 'Crowding', 'Est\. APR\*'\]/);
  assert.ok(polyHeads, 'Polymarket screener columns unchanged');
});

test('Liquidity Hub: platform tabs with side-by-side summaries; Polymarket stays the default screener', () => {
  const stub = name => ({ __esModule: true, default: () => React.createElement('div', { 'data-stub': name }) });
  const cmp = makeLoader({
    './RewardFarms': stub('poly'),
    './KalshiRewardFarms': { KalshiFarmsTable: () => React.createElement('div', { 'data-stub': 'kalshi' }), useKalshiRewards: () => ({ data: null, loading: true }) },
  })('src/app/liquidity/RewardFarmsCompare.tsx');
  const h = renderToStaticMarkup(React.createElement(cmp.default));
  assert.match(h, /role="tablist" aria-label="Reward farm platform"/);
  assert.match(h, /aria-selected="true"[^>]*>Polymarket</);
  assert.match(h, /data-platform-summary="Polymarket"/);
  assert.match(h, /data-platform-summary="Kalshi"/);
  assert.match(h, /data-stub="poly"/);
  assert.doesNotMatch(h, /data-stub="kalshi"/);
  const page = fs.readFileSync(path.join(root, 'src/app/liquidity/page.tsx'), 'utf8');
  assert.match(page, /<RewardFarmsCompare platform=\{platform\}/);
});

test('rankings over every program: top series (with titles) and largest single-market pools; compact snapshot rows', async () => {
  const programs = [
    ...Array.from({ length: 5 }, (_, i) => ({ ...prog(`RT${i}`, 1_000_000), series_ticker: 'KXRT' })),
    { ...prog('BIG', 10_000_000, { start_date: '2026-11-26T00:00:00Z', end_date: '2026-11-27T00:00:00Z' }), series_ticker: 'KXBIG' },
  ];
  const getJson = async (p, q) => {
    if (p === '/incentive_programs') return { incentive_programs: programs };
    if (p.startsWith('/series/')) return { series: { title: p === '/series/KXRT' ? 'Rotten Tomatoes score' : 'Big one' } };
    return { markets: q.tickers.split(',').map(t => mkt(t)) };
  };
  const s = await kr.scanKalshiRewardFarms({ getJson, wait: async () => {}, now: () => NOW });
  assert.deepEqual(s.topMarkets.map(m => m.ticker)[0], 'BIG');
  assert.equal(s.topMarkets[0].dailyRate, 1000);
  assert.deepEqual(s.topSeries.map(x => [x.seriesTicker, x.title, x.markets]), [['KXBIG', 'Big one', 1], ['KXRT', 'Rotten Tomatoes score', 5]]);
  assert.equal(s.topSeries[1].exampleTitle, 'Synthetic RT0');
  assert.equal(s.snapshot[0].t, 'BIG');
  assert.deepEqual(Object.keys(s.snapshot[0]).sort(), ['as', 'bs', 'liq', 'r', 'sp', 't', 'v']);
  // a failing series lookup only drops the title
  const s2 = await kr.scanKalshiRewardFarms({ getJson: async (p, q) => (p.startsWith('/series/') ? Promise.reject(new Error('x')) : getJson(p, q)), wait: async () => {}, now: () => NOW });
  assert.equal(s2.topSeries[0].title, null);
});

test('API strips the snapshot rows and records history only from complete scans; cron records Kalshi without failing Polymarket', () => {
  const route = fs.readFileSync(path.join(root, 'src/app/api/liquidity/kalshi/rewards/route.ts'), 'utf8');
  assert.match(route, /const \{ snapshot, candidates: _candidates, \.\.\.scan \} = await readKalshiRewards\(\)/);
  assert.match(route, /if \(scan\.complete\) recordKalshiSnapshot/);
  const cron = fs.readFileSync(path.join(root, 'src/app/api/cron/lp-snapshot/route.ts'), 'utf8');
  assert.match(cron, /const wrote = await recordLpSnapshot\(farms, true\);[\s\S]*try \{[\s\S]*recordKalshiSnapshot/);
  const snaps = load('src/lib/kalshiSnapshots.ts');
  assert.equal(snaps.KALSHI_SNAP_INTERVAL_SEC, 1800);
  assert.equal(snaps.KALSHI_SNAP_MARKETS, 300);
  assert.ok(snaps.KALSHI_SNAP_MAX * snaps.KALSHI_SNAP_INTERVAL_SEC >= 7 * 86400);
});

test('Kalshi tab shows pool rankings and the published scoring rule with sources', () => {
  const ui = makeLoader({ 'next/link': { __esModule: true, default: Link } })('src/app/liquidity/KalshiRewardFarms.tsx');
  const data = {
    farms: [], totalDailyRewards: 1, marketsWithRewards: 7023, scanned: 0, complete: true, receivedAt: '', thinMarkets: 0,
    topSeries: [{ seriesTicker: 'KXRT', title: 'Rotten Tomatoes score', dailyRate: 12805, markets: 128, exampleTicker: 'KXRT-1', exampleTitle: 'Movie A score?' }],
    topMarkets: [{ ticker: 'KXONIONACT-1', title: 'Will the Onion Futures Act be repealed before Jan 1, 2029?', seriesTicker: 'KXONIONACT', dailyRate: 142.86, periodReward: 1000, periodDays: 7 }],
  };
  const r = renderToStaticMarkup(React.createElement(ui.KalshiPoolRankings, { data }));
  assert.match(r, /Top series by daily pools/);
  assert.match(r, /Rotten Tomatoes score/);
  assert.match(r, /128 markets/);
  assert.match(r, /href="\/markets\/kalshi\/KXONIONACT-1"/);
  assert.match(r, /\/7d/);
  assert.match(r, /no maker leaderboard here/);
  const f = renderToStaticMarkup(React.createElement(ui.KalshiScoringFormula));
  assert.match(f, /order score  = size × DiscountFactor \^ ticks_from_reference/);
  assert.match(f, /href="https:\/\/help\.kalshi\.com\/en\/articles\/13823851-liquidity-incentive-program"/);
  assert.match(f, /href="https:\/\/kalshi\.com\/incentives"/);
});

test('recorder status without KV is a clean disabled answer; the route returns counts and timestamps only', async () => {
  const snaps = load('src/lib/kalshiSnapshots.ts');
  assert.deepEqual(await snaps.kalshiRecorderStatus(), { enabled: false, snapshots: 0, newestTs: null, oldestTs: null, newestMarkets: null, newestPrograms: null });
  const route = fs.readFileSync(path.join(root, 'src/app/api/liquidity/kalshi/recorder-health/route.ts'), 'utf8');
  assert.match(route, /kalshiRecorderStatus\(\)/);
  assert.doesNotMatch(route, /markets:/);
});

test('Kalshi opportunity cards: depth within 5¢ from the live book, same score weights and risk rules as Polymarket', () => {
  const op = load('src/lib/kalshiOpportunities.ts');
  const { normalizeOrderbook } = load('src/lib/kalshi.ts');
  const farm = kr.buildFarm(kr.parseProgram(prog('KXOPP', 1_000_000, { end_date: '2027-01-10T00:00:00Z' })), mkt('KXOPP', { volume_24h_fp: '10000.00', close_time: '2027-01-20T00:00:00Z' }), NOW);
  const book = normalizeOrderbook({ orderbook_fp: { yes_dollars: [['0.4000', '100.00'], ['0.3600', '50.00'], ['0.3000', '999.00']], no_dollars: [['0.5800', '200.00'], ['0.5000', '999.00']] } });
  const d = op.depthWithin5c(book);
  assert.equal(d.bestBid, 0.4);
  assert.equal(d.bestAsk, 0.42);
  assert.ok(Math.abs(d.bidDepth - (0.4 * 100 + 0.36 * 50)) < 1e-9);  // 0.30 is > 5¢ away
  assert.ok(Math.abs(d.askDepth - 0.42 * 200) < 1e-9);               // implied ask 0.50 is > 5¢ away
  const o = op.buildKalshiOpportunity(farm, book);
  assert.equal(o.conditionId, 'KXOPP');
  assert.equal(o.depthKnown, true);
  assert.ok(Math.abs(o.volume24h - 10000 * 0.41) < 1e-9);
  assert.equal(o.scoreBreakdown.rewards, Math.round(25 * Math.min(1, farm.dailyRate / 100)));
  assert.equal(o.scoreBreakdown.spread, Math.round(15 * 0.02 / 0.05));
  assert.equal(o.score, Object.values(o.scoreBreakdown).reduce((a, b) => a + b, 0));
  assert.equal(o.risk, 'Low');
  assert.equal(o.estDailyReward, farm.estDailyReward);
  const noBook = op.buildKalshiOpportunity(farm, null);
  assert.equal(noBook.depthKnown, false);
  assert.equal(noBook.bidDepth, null);
  // weights copied from the Polymarket route
  const poly = fs.readFileSync(path.join(root, 'src/app/api/liquidity/opportunities/route.ts'), 'utf8');
  const kal = fs.readFileSync(path.join(root, 'src/lib/kalshiOpportunities.ts'), 'utf8');
  for (const w of ['25 * Math.min(1, ', '20 * Math.min(1, Math.log10(Math.max(1, vol24h)) / 7)', '15 * Math.min(1, spread / 0.05)', '15 * (1 - Math.min(1, spreadVol / 30))', '10 * (1 - Math.min(1, Math.abs(mid - 0.5) * 2))']) {
    assert.ok(poly.includes(w) && kal.includes(w), w);
  }
});

test('Liquidity Hub: one platform switch drives header, overview, cards and reward farms; Polymarket-only sections are labelled', () => {
  const page = fs.readFileSync(path.join(root, 'src/app/liquidity/page.tsx'), 'utf8');
  assert.match(page, /role="tablist" aria-label="Liquidity data platform"/);
  assert.match(page, /kalshi: '\/api\/liquidity\/kalshi\/opportunities'/);
  assert.match(page, /polymarket: '\/api\/liquidity\/opportunities'/);
  assert.match(page, /<RewardFarmsCompare platform=\{platform\} onPlatformChange=\{setPlatform\} \/>/);
  assert.match(page, /The sections below still use Polymarket data/);
  assert.match(page, /<PriceHistorySection opps=\{oppsBy\.polymarket\} \/>/);
  assert.match(page, /Total 24h Vol \(est\.\)/);
  const scan = load('src/lib/kalshiRewards.ts');
  assert.equal(scan.OPPORTUNITY_CANDIDATES, 40);
});
