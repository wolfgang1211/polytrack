/* GEO priority 1: /polymarket-lp-rewards answer page. */
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
const AT = new Date('2026-11-22T17:45:30Z');

const farm = (id, dailyRate, o = {}) => ({
  conditionId: id, question: `SYNTHETIC market ${id}?`, slug: `syn-${id}`, eventSlug: `syn-ev-${id}`,
  volume24h: 1000, liquidity: 5000, spread: 0.02, dailyRate, minSize: 100, maxSpread: 3.5,
  estDailyReward: 1, estApr: 10, daysToResolve: 30, competition: 'Low', rewardStart: null,
  rewardEnd: '2026-12-31T00:00:00Z', isNew: false, endsSoon: false, priceVol: 1, stability: 'A', riskAdjApr: 10, ...o,
});

test('snapshot: ranks by real daily reward, writes a numbered UTC-dated summary, keeps unknowns unknown', () => {
  const { buildLpRewardsSnapshot } = lib();
  const farms = [farm('a', 50), farm('b', 1200, { minSize: null, maxSpread: null, liquidity: 0, rewardEnd: null }), farm('c', 300)];
  const s = buildLpRewardsSnapshot({ farms, scanned: 380 }, AT);
  assert.equal(s.status, 'ok');
  assert.deepEqual(s.rows.map(r => r.question), ['SYNTHETIC market b?', 'SYNTHETIC market c?', 'SYNTHETIC market a?']);
  assert.deepEqual(s.rows.map(r => r.rank), [1, 2, 3]);
  assert.equal(s.totalDaily, 1550);
  assert.equal(s.rows[0].minSize, null);
  assert.equal(s.rows[0].maxSpread, null);
  assert.equal(s.rows[0].liquidity, null, 'zero liquidity from the feed is shown as unknown');
  assert.equal(s.summary,
    'As of 22 Nov 2026, 17:45 UTC, the highest daily liquidity reward among the 3 Polymarket reward markets AlphaBoard tracks is $1,200 per day on "SYNTHETIC market b?". '
    + 'The top 3 markets offer $1,550 per day combined, and all 3 tracked markets offer $1,550 per day.');
});

test('snapshot: failed upstream (0 scanned) is "unavailable", never a page of zeros; top list is capped', () => {
  const { buildLpRewardsSnapshot, LP_REWARDS_TOP_N } = lib();
  assert.equal(buildLpRewardsSnapshot({ farms: [], scanned: 0 }, AT).status, 'unavailable');
  assert.equal(buildLpRewardsSnapshot(null, AT).status, 'unavailable');
  assert.equal(buildLpRewardsSnapshot({ farms: [farm('z', 0)], scanned: 200 }, AT).status, 'empty');
  // Pools under Polymarket's $1 minimum payout cannot pay anyone: not listed, not counted.
  const dust = buildLpRewardsSnapshot({ farms: [farm('d', 0.004), farm('r', 6)], scanned: 200 }, AT);
  assert.deepEqual(dust.rows.map(r => r.question), ['SYNTHETIC market r?']);
  assert.equal(dust.totalDaily, 6);
  assert.equal(buildLpRewardsSnapshot({ farms: [farm('d', 0.5)], scanned: 200 }, AT).status, 'empty');
  const many = Array.from({ length: 40 }, (_, i) => farm(`m${i}`, i + 1));
  const s = buildLpRewardsSnapshot({ farms: many, scanned: 400 }, AT);
  assert.equal(s.rows.length, LP_REWARDS_TOP_N);
  assert.equal(s.marketCount, 40);
});

const view = snapshot => {
  const View = createLoader()('src/app/polymarket-lp-rewards/LpRewardsView.tsx').default;
  return renderToStaticMarkup(React.createElement(View, { snapshot }));
};
const jsonLd = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));

test('view: server HTML carries h1, the summary as the first paragraph, a real table and an outbound referral link', () => {
  const { buildLpRewardsSnapshot } = lib();
  const html = view(buildLpRewardsSnapshot({ farms: [farm('b', 1200, { minSize: null }), farm('a', 50)], scanned: 380 }, AT));
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  const firstP = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)[1];
  assert.match(firstP, /As of 22 Nov 2026, 17:45 UTC/);
  assert.match(firstP, /\$1,200 per day/);
  assert.match(html, /<table\b/);
  assert.equal((html.match(/<tbody>[\s\S]*?<\/tbody>/)[0].match(/<tr\b/g) || []).length, 2);
  assert.match(html, /<time dateTime="2026-11-22T17:45:30.000Z">/);
  const link = html.match(/<a\b[^>]*href="https:\/\/polymarket\.com\/event\/syn-ev-b[^"]*"[^>]*>/)[0];
  assert.match(link, /utm_content=lp_rewards_page/);
  assert.match(link, /rel="noopener noreferrer sponsored"/);
  const rowB = html.match(/<tr\b[^>]*>(?:(?!<\/tr>)[\s\S])*SYNTHETIC market b\?[\s\S]*?<\/tr>/)[0];
  assert.match(rowB, />—</, 'unknown min size shows a dash');
  assert.doesNotMatch(rowB, />0</);
  assert.match(html, /Not affiliated with Polymarket/);
  assert.match(html, /href="https:\/\/docs\.polymarket\.com\/market-makers\/liquidity-rewards"/);
});

test('format: whole dollars without cents, open-ended pool dates shown as "No end date"', () => {
  const { formatUsd, buildLpRewardsSnapshot } = lib();
  assert.equal(formatUsd(50), '$50');
  assert.equal(formatUsd(12.5), '$12.50');
  assert.equal(formatUsd(1250.4), '$1,250');
  const html = view(buildLpRewardsSnapshot({ farms: [farm('a', 50, { rewardEnd: '2500-12-31T00:00:00Z' }), farm('b', 40)], scanned: 10 }, AT));
  assert.match(html, />No end date</);
  assert.match(html, />2026-12-31</);
  assert.doesNotMatch(html, /2500-12-31/);
});

test('view: FAQPage, Dataset and BreadcrumbList JSON-LD match the visible content', () => {
  const { buildLpRewardsSnapshot, LP_REWARDS_FAQ } = lib();
  const html = view(buildLpRewardsSnapshot({ farms: [farm('a', 50)], scanned: 10 }, AT));
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

test('view: unavailable data says so plainly and shows no figures', () => {
  const { buildLpRewardsSnapshot } = lib();
  const html = view(buildLpRewardsSnapshot({ farms: [], scanned: 0 }, AT));
  assert.match(html, /temporarily unavailable/i);
  assert.doesNotMatch(html, /<table\b/);
  const header = html.match(/<header\b[\s\S]*?<\/header>/)[0];
  assert.doesNotMatch(header, /\$\d/, 'no reward figures outside the static FAQ');
  assert.equal(jsonLd(html).some(b => b['@type'] === 'Dataset'), false, 'no Dataset claim without data');
});

test('page is server-rendered with ISR and wired into sitemap, llms.txt, analytics and breadcrumbs', () => {
  const page = read('src/app/polymarket-lp-rewards/page.tsx');
  assert.doesNotMatch(page, /'use client'/);
  assert.match(page, /export const revalidate = 900/);
  assert.match(page, /scanRewardFarms\(\)/);
  assert.match(page, /canonical: '\/polymarket-lp-rewards'/);
  const urls = createLoader()('src/app/sitemap.ts').default().map(e => e.url);
  assert.ok(urls.includes('https://www.alphaboard.xyz/polymarket-lp-rewards'));
  assert.match(read('public/llms.txt'), /\]\(https:\/\/www\.alphaboard\.xyz\/polymarket-lp-rewards\)/);
  assert.equal(createLoader()('src/lib/funnelSchema.ts').pageGroup('/polymarket-lp-rewards'), 'liquidity');
  const { outboundEvent } = createLoader()('src/lib/outboundAnalytics.ts');
  const { marketUrl } = createLoader()('src/lib/builder.ts');
  assert.equal(outboundEvent(marketUrl('e', 's', 'lp_rewards_page')).placement, 'lp_rewards_page');
  assert.match(read('src/components/Breadcrumb.tsx'), /'\/polymarket-lp-rewards': 'Polymarket LP Rewards'/);
});
