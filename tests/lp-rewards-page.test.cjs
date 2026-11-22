/* GEO priority 1: /polymarket-lp-rewards answer page, covering every Polymarket market with an active reward pool. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createLoader } = require('./helpers/load-ts.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const lib = () => createLoader()('src/lib/lpRewardsPage.ts');
const uni = () => createLoader()('src/lib/rewardsUniverse.ts');
const AT = new Date('2026-11-22T17:45:30Z');

const rm = (id, dailyRate, o = {}) => ({ conditionId: `0x${id}`, dailyRate, maxSpread: 3.5, minSize: 100, ...o });
const meta = (entries) => new Map(entries.map(([id, o = {}]) => [`0x${id}`, {
  question: `SYNTHETIC market ${id}?`, slug: `syn-${id}`, eventSlug: `syn-ev-${id}`, endDate: '2026-12-31T00:00:00Z', liquidity: 5000, ...o,
}]));
const universe = (markets, o = {}) => ({ markets, pages: 1, complete: true, ...o });

/* ---------- CLOB paging ---------- */
const page = (rows, next) => ({ data: rows, next_cursor: next, limit: 500, count: rows.length });
const clobRow = (id, rate, o = {}) => ({ condition_id: `0x${id.toUpperCase()}`, rewards_max_spread: 2.5, rewards_min_size: 50, native_daily_rate: rate, total_daily_rate: rate, ...o });
function fakeFetch(script) {
  const calls = [];
  const fn = async url => {
    calls.push(url);
    const step = script(url, calls.length);
    if (step instanceof Error) throw step;
    if (typeof step === 'number') return { ok: false, status: step, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => step };
  };
  return { fn, calls };
}

test('universe: follows next_cursor to the end marker, dedupes, lower-cases ids, prefers total (incl. sponsored) rate', async () => {
  const { fetchRewardUniverse } = uni();
  const f = fakeFetch(url => {
    if (!url.includes('next_cursor')) return page([clobRow('aa', 5), clobRow('bb', 1, { total_daily_rate: 3 })], 'NTAw');
    if (url.includes('NTAw')) return page([clobRow('aa', 5), clobRow('cc', 0.2, { rewards_max_spread: 0, rewards_min_size: null })], 'LTE=');
    throw new Error('unexpected');
  });
  const u = await fetchRewardUniverse(f.fn);
  assert.equal(u.pages, 2);
  assert.equal(u.complete, true);
  assert.deepEqual(u.markets.map(m => [m.conditionId, m.dailyRate]), [['0xaa', 5], ['0xbb', 3], ['0xcc', 0.2]]);
  assert.equal(u.markets[2].maxSpread, null, 'zero spread is "not published", not 0');
  assert.equal(u.markets[2].minSize, null);
});

test('universe: retries a flaky page; a page that keeps failing marks the result incomplete; first page down = null', async () => {
  const { fetchRewardUniverse } = uni();
  let n = 0;
  const flaky = fakeFetch(url => (!url.includes('next_cursor') ? (++n < 3 ? 503 : page([clobRow('aa', 5)], 'LTE=')) : null));
  const ok = await fetchRewardUniverse(flaky.fn);
  assert.equal(ok.complete, true);
  assert.equal(flaky.calls.length, 3);

  const broken = fakeFetch(url => (!url.includes('next_cursor') ? page([clobRow('aa', 5)], 'NTAw') : new Error('reset')));
  const part = await fetchRewardUniverse(broken.fn);
  assert.equal(part.complete, false);
  assert.equal(part.markets.length, 1);

  assert.equal(await fetchRewardUniverse(fakeFetch(() => 500).fn), null);
});

test('meta: one Gamma request for the displayed ids; missing markets are just absent', async () => {
  const { fetchMarketMeta } = uni();
  const f = fakeFetch(() => [
    { conditionId: '0xAA', question: 'Q aa?', slug: 'q-aa', events: [{ slug: 'ev-aa' }], endDate: '2026-11-23T00:00:00Z', liquidityNum: 0 },
    { conditionId: '0xCC', question: 'Saints vs. Bears', slug: 'nfl', endDate: '2026-11-22T18:00:00Z', gameStartTime: '2026-11-22 18:00:00+00', liquidityNum: 452386 },
  ]);
  const m = await fetchMarketMeta(['0xaa', '0xbb', '0xcc'], f.fn);
  assert.equal(f.calls.length, 1);
  assert.match(f.calls[0], /condition_ids=0xaa&condition_ids=0xbb/);
  assert.deepEqual(m.get('0xaa'), { question: 'Q aa?', slug: 'q-aa', eventSlug: 'ev-aa', endDate: '2026-11-23T00:00:00Z', gameStart: null, liquidity: null });
  assert.equal(m.get('0xcc').gameStart, '2026-11-22T18:00:00.000Z', 'Gamma "YYYY-MM-DD HH:MM:SS+00" parsed to ISO');
  assert.equal(m.has('0xbb'), false);
});

/* ---------- snapshot ---------- */
test('snapshot: every rewarded market counts (no match/short-term filter), ranked by daily pool, sub-$1 pools excluded', () => {
  const { buildLpRewardsSnapshot } = lib();
  const s = buildLpRewardsSnapshot(
    universe([rm('a', 50), rm('nfl', 15771.43), rm('c', 300), rm('dust', 0.4)]),
    meta([['a'], ['nfl', { question: 'Saints vs. Bears', endDate: '2026-11-22T21:00:00Z' }], ['c']]),
    AT,
  );
  assert.equal(s.status, 'ok');
  assert.equal(s.universe, 4);
  assert.equal(s.marketCount, 3);
  assert.deepEqual(s.rows.map(r => r.question), ['Saints vs. Bears', 'SYNTHETIC market c?', 'SYNTHETIC market a?']);
  assert.equal(s.summary,
    'As of 22 Nov 2026, 17:45 UTC, Polymarket offers liquidity rewards of $1 per day or more on 3 markets, worth $16,121 per day in total. '
    + 'The largest pool is $15,771 per day on "Saints vs. Bears"; the top 3 pools total $16,121 per day.');
});

test('snapshot: incomplete paging is disclosed as a lower bound; failure is "unavailable"; table capped at 50', () => {
  const { buildLpRewardsSnapshot, LP_REWARDS_TOP_N } = lib();
  const part = buildLpRewardsSnapshot(universe([rm('a', 10)], { complete: false }), meta([['a']]), AT);
  assert.match(part.summary, /^Partial data: /);
  assert.match(part.summary, /on at least 1 market, worth at least \$10 per day/);
  assert.equal(buildLpRewardsSnapshot(null, new Map(), AT).status, 'unavailable');
  assert.equal(buildLpRewardsSnapshot(universe([rm('d', 0.5)]), new Map(), AT).status, 'empty');
  const many = Array.from({ length: 80 }, (_, i) => rm(`m${i}`, i + 1));
  const s = buildLpRewardsSnapshot(universe(many), new Map(), AT);
  assert.equal(LP_REWARDS_TOP_N, 50);
  assert.equal(s.rows.length, 50);
  assert.equal(s.marketCount, 80);
  assert.equal(s.rows[0].question, null, 'no metadata stays unknown');
});

test('longer-term table: open > 7 days after the snapshot, games and unknown dates excluded, by daily reward, top 25', () => {
  const { buildLpRewardsSnapshot, LP_REWARDS_LONG_TERM_N } = lib();
  const markets = [
    rm('nfl', 15000), rm('soon', 900), rm('far', 800), rm('nodate', 700), rm('futuregame', 650), rm('eightd', 600), rm('sixd', 500),
    ...Array.from({ length: 30 }, (_, i) => rm(`lt${i}`, 100 - i)),
  ];
  const m = meta([
    ['nfl', { endDate: '2026-11-22T18:00:00Z', gameStart: '2026-11-22T18:00:00.000Z' }],
    ['soon', { endDate: '2026-11-25T00:00:00Z' }],
    ['far', { endDate: '2027-06-01T00:00:00Z' }],
    ['nodate', { endDate: null }],
    ['futuregame', { endDate: '2027-01-10T00:00:00Z', gameStart: '2027-01-10T00:00:00.000Z' }],
    ['eightd', { endDate: '2026-11-30T18:00:00Z' }],
    ['sixd', { endDate: '2026-11-28T17:00:00Z' }],
    ...Array.from({ length: 30 }, (_, i) => [`lt${i}`, { endDate: '2027-12-31T00:00:00Z' }]),
  ]);
  const s = buildLpRewardsSnapshot(universe(markets), m, AT, { checked: 37, capped: false });
  assert.equal(LP_REWARDS_LONG_TERM_N, 25);
  assert.equal(s.longTerm.rows.length, 25);
  assert.deepEqual(s.longTerm.rows.slice(0, 3).map(r => r.question), ['SYNTHETIC market far?', 'SYNTHETIC market eightd?', 'SYNTHETIC market lt0?']);
  assert.deepEqual(s.longTerm.rows.map(r => r.rank).slice(0, 3), [1, 2, 3]);
  assert.equal(s.longTerm.checked, 37);
  assert.equal(s.rows[0].question, 'SYNTHETIC market nfl?', 'main table unchanged: still all markets by daily reward');
});

test('long-term candidates: walks the ranked list in batches until 25 qualify or the cap is reached', () => {
  const { isLongTerm, longTermCandidateBatches } = lib();
  const at = AT.toISOString();
  assert.equal(isLongTerm({ endDate: '2026-11-29T17:46:00Z', gameStart: null }, at), true);
  assert.equal(isLongTerm({ endDate: '2026-11-29T17:45:00Z', gameStart: null }, at), false, 'exactly 7 days is not longer than 7 days');
  assert.equal(isLongTerm({ endDate: '2027-01-01T00:00:00Z', gameStart: '2027-01-01T00:00:00.000Z' }, at), false, 'games never count');
  assert.equal(isLongTerm({ endDate: null, gameStart: null }, at), false);
  assert.equal(isLongTerm(undefined, at), false);
  const ids = Array.from({ length: 1200 }, (_, i) => `0x${i}`);
  const batches = longTermCandidateBatches(ids, 50);
  assert.equal(batches.length, 20, 'cap: 1000 markets past the first 50');
  assert.equal(batches[0][0], '0x50');
  assert.ok(batches.every(b => b.length === 50));
});

test('view: second table "Longer-term markets" sits after the main table with its own heading and note', () => {
  const { buildLpRewardsSnapshot } = lib();
  const html = view(buildLpRewardsSnapshot(
    universe([rm('nfl', 1000), rm('far', 80)]),
    meta([['nfl', { endDate: '2026-11-22T18:00:00Z', gameStart: '2026-11-22T17:00:00.000Z' }], ['far', { endDate: '2027-06-01T00:00:00Z' }]]),
    AT, { checked: 2, capped: false },
  ));
  assert.equal((html.match(/<table\b/g) || []).length, 2);
  const main = html.indexOf('id="top-heading"');
  const lt = html.indexOf('id="long-term-heading"');
  assert.ok(main > 0 && lt > main);
  assert.match(html, /<h2 id="long-term-heading"[^>]*>Longer-term markets<\/h2>/);
  const ltSection = html.slice(lt, html.indexOf('</section>', lt));
  assert.match(ltSection, /more than 7 days after this snapshot/);
  assert.match(ltSection, /SYNTHETIC market far\?/);
  assert.doesNotMatch(ltSection, /SYNTHETIC market nfl\?/);
  assert.match(ltSection, />2027-06-01</);
});

test('view: no long-term table when none qualify, with a plain sentence instead', () => {
  const { buildLpRewardsSnapshot } = lib();
  const html = view(buildLpRewardsSnapshot(universe([rm('a', 10)]), meta([['a', { endDate: '2026-11-23T00:00:00Z' }]]), AT, { checked: 1, capped: false }));
  assert.equal((html.match(/<table\b/g) || []).length, 1);
  assert.match(html, /No market among the 1 largest pools checked stays open for more than 7 days/);
});

test('closes label is relative to the snapshot time and never invents a date', () => {
  const { closesLabel } = lib();
  const at = AT.toISOString();
  assert.equal(closesLabel('2026-11-22T21:00:00Z', at), 'in 3h');
  assert.equal(closesLabel('2026-11-22T18:00:00Z', at), 'in <1h');
  assert.equal(closesLabel('2026-11-26T00:00:00Z', at), 'in 3d');
  assert.equal(closesLabel('2027-03-01T00:00:00Z', at), '2027-03-01');
  assert.equal(closesLabel('2026-10-28T00:00:00Z', at), 'Awaiting resolution');
  // Sports: Polymarket's end date is the kick-off time, so use the game start instead.
  assert.equal(closesLabel('2026-11-22T17:00:00Z', at, '2026-11-22T17:00:00.000Z'), 'Game started');
  assert.equal(closesLabel('2026-11-22T20:00:00Z', at, '2026-11-22T20:00:00.000Z'), 'Starts in 2h');
  assert.equal(closesLabel(null, at), '—');
  assert.equal(closesLabel('garbage', at), '—');
});

/* ---------- view ---------- */
const view = snapshot => {
  const View = createLoader()('src/app/polymarket-lp-rewards/LpRewardsView.tsx').default;
  return renderToStaticMarkup(React.createElement(View, { snapshot }));
};
const jsonLd = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));

test('view: server HTML has h1, summary first, a table with a Closes column and referral links; unknowns are dashes', () => {
  const { buildLpRewardsSnapshot } = lib();
  const html = view(buildLpRewardsSnapshot(
    universe([rm('b', 1200, { minSize: null }), rm('a', 50), rm('x', 40)]),
    meta([['b', { endDate: '2026-11-22T21:00:00Z', liquidity: null }], ['a', { endDate: '2026-11-22T17:00:00Z', gameStart: '2026-11-22T17:00:00.000Z' }]]),
    AT,
  ));
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  const firstP = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)[1];
  assert.match(firstP, /As of 22 Nov 2026, 17:45 UTC/);
  assert.match(firstP, /\$1,200 per day/);
  assert.match(html, /<th scope="col"[^>]*>Closes \/ starts<\/th>/);
  assert.match(html, />Game started</);
  const rowB = html.match(/<tr\b[^>]*>(?:(?!<\/tr>)[\s\S])*SYNTHETIC market b\?[\s\S]*?<\/tr>/)[0];
  assert.match(rowB, />in 3h</);
  assert.match(rowB, />—</);
  assert.doesNotMatch(rowB, />\$?0</);
  const link = html.match(/<a\b[^>]*href="https:\/\/polymarket\.com\/event\/syn-ev-b[^"]*"[^>]*>/)[0];
  assert.match(link, /utm_content=lp_rewards_page/);
  assert.match(link, /rel="noopener noreferrer sponsored"/);
  assert.match(html, /Market details unavailable/, 'row without metadata says so instead of inventing a name');
  assert.match(html, /<time dateTime="2026-11-22T17:45:30.000Z">/);
  assert.match(html, /Not affiliated with Polymarket/);
  assert.match(html, /href="https:\/\/docs\.polymarket\.com\/market-makers\/liquidity-rewards"/);
  assert.doesNotMatch(html, /Single-game and match markets/, 'old filter text is gone');
});

test('view: FAQPage, Dataset and BreadcrumbList JSON-LD match the visible content', () => {
  const { buildLpRewardsSnapshot, LP_REWARDS_FAQ } = lib();
  const html = view(buildLpRewardsSnapshot(universe([rm('a', 50)]), meta([['a']]), AT));
  const blocks = jsonLd(html);
  const faq = blocks.find(b => b['@type'] === 'FAQPage');
  assert.deepEqual(faq.mainEntity.map(e => e.name), LP_REWARDS_FAQ.map(f => f.q));
  for (const f of LP_REWARDS_FAQ) assert.ok(html.includes(f.q.replace(/'/g, '&#x27;')) || html.includes(f.q), `visible: ${f.q}`);
  const ds = blocks.find(b => b['@type'] === 'Dataset');
  assert.equal(ds.dateModified, '2026-11-22T17:45:30.000Z');
  assert.equal(ds.url, 'https://www.alphaboard.xyz/polymarket-lp-rewards');
  const bc = blocks.find(b => b['@type'] === 'BreadcrumbList');
  assert.deepEqual(bc.itemListElement.map(i => i.name), ['Home', 'Polymarket LP Rewards']);
});

test('view: unavailable data says so plainly and shows no figures; partial data is flagged', () => {
  const { buildLpRewardsSnapshot } = lib();
  const html = view(buildLpRewardsSnapshot(null, new Map(), AT));
  assert.match(html, /temporarily unavailable/i);
  assert.doesNotMatch(html, /<table\b/);
  assert.doesNotMatch(html.match(/<header\b[\s\S]*?<\/header>/)[0], /\$\d/);
  assert.equal(jsonLd(html).some(b => b['@type'] === 'Dataset'), false);
  const part = view(buildLpRewardsSnapshot(universe([rm('a', 10)], { complete: false }), meta([['a']]), AT));
  assert.match(part, /Partial data/);
});

test('page is server-rendered with ISR, scans the full reward list and is wired into sitemap, llms.txt, analytics and breadcrumbs', () => {
  const page = read('src/app/polymarket-lp-rewards/page.tsx');
  assert.doesNotMatch(page, /'use client'/);
  assert.match(page, /export const revalidate = 900/);
  assert.match(page, /fetchRewardUniverse\(\)/);
  assert.match(page, /longTermCandidateBatches\(/);
  assert.doesNotMatch(page, /scanRewardFarms/);
  assert.match(page, /canonical: '\/polymarket-lp-rewards'/);
  const urls = createLoader()('src/app/sitemap.ts').default().map(e => e.url);
  assert.ok(urls.includes('https://www.alphaboard.xyz/polymarket-lp-rewards'));
  assert.match(read('public/llms.txt'), /\]\(https:\/\/www\.alphaboard\.xyz\/polymarket-lp-rewards\): [^\n]*every Polymarket market with an active liquidity-reward pool/);
  assert.equal(createLoader()('src/lib/funnelSchema.ts').pageGroup('/polymarket-lp-rewards'), 'liquidity');
  const { outboundEvent } = createLoader()('src/lib/outboundAnalytics.ts');
  const { marketUrl } = createLoader()('src/lib/builder.ts');
  assert.equal(outboundEvent(marketUrl('e', 's', 'lp_rewards_page')).placement, 'lp_rewards_page');
  assert.match(read('src/components/Breadcrumb.tsx'), /'\/polymarket-lp-rewards': 'Polymarket LP Rewards'/);
});
