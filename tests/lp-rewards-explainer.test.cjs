/* GEO priority 2: evergreen "How Polymarket liquidity rewards work" page. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createLoader } = require('./helpers/load-ts.cjs');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const ROUTE = 'src/app/how-polymarket-liquidity-rewards-work/page.tsx';
const DOCS = 'https://docs.polymarket.com/market-makers/liquidity-rewards';

test('math follows the documented formulas: order score, two-sided rule with c = 3, share of pool', () => {
  const { orderScore, qMin, REWARD_C } = createLoader()('src/lib/lpRewardsMath.ts');
  assert.equal(REWARD_C, 3);
  assert.equal(orderScore(3, 0), 1);
  assert.equal(orderScore(3, 1).toFixed(4), '0.4444');
  assert.equal(orderScore(3, 2).toFixed(4), '0.1111');
  assert.equal(orderScore(3, 3), 0, 'at the max spread an order no longer scores');
  assert.equal(orderScore(3, 4), 0);
  assert.equal(orderScore(3, 1, 2).toFixed(4), '0.8889', 'b multiplier');
  // midpoint inside [0.10, 0.90]: single-sided scores at 1/c
  assert.equal(qMin(90, 0, 0.5), 30);
  assert.equal(qMin(90, 60, 0.5), 60);
  // midpoint outside: must be two-sided
  assert.equal(qMin(90, 0, 0.05), 0);
  assert.equal(qMin(90, 60, 0.95), 60);
});

const page = () => {
  const mod = createLoader()(ROUTE);
  return { mod, html: renderToStaticMarkup(React.createElement(mod.default)) };
};
const jsonLd = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));

test('page answers the question in its first paragraph with the key documented facts', () => {
  const { html } = page();
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<h1[^>]*>How Polymarket Liquidity Rewards Work<\/h1>/);
  const firstP = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)[1].replace(/<[^>]+>/g, '');
  for (const fact of [/resting limit orders/, /once a minute/, /midnight UTC/, /\$1/, /daily reward pool/, /maximum spread/, /minimum order size/]) {
    assert.match(firstP, fact);
  }
});

test('page explains scoring with computed examples, the two-sided rule and the daily normalisation', () => {
  const { html } = page();
  const text = html.replace(/<[^>]+>/g, ' ');
  assert.match(text, /S\(v, s\) = \(\(v − s\) \/ v\)² × b/);
  assert.match(text, /0\.44/, '1¢ from the midpoint with a 3¢ max spread');
  assert.match(text, /0\.11/);
  assert.match(text, /c = 3/);
  assert.match(text, /0\.10 and 0\.90/);
  assert.match(text, /1,440/);
  assert.match(text, /\$5 for the day/, 'worked payout example: 5% of a $100 pool');
});

test('page cites the official documentation and links to the live rewards table', () => {
  const { html } = page();
  assert.ok((html.match(new RegExp(`href="${DOCS.replace(/[.]/g, '\\.')}"`, 'g')) || []).length >= 2, 'docs cited at least twice');
  assert.match(html, /href="\/polymarket-lp-rewards"/);
  assert.match(html, /Not affiliated with Polymarket/);
  assert.match(html, /<time dateTime="2026-11-22">/);
});

test('Article, FAQPage and BreadcrumbList JSON-LD; metadata and canonical', () => {
  const { html, mod } = page();
  const blocks = jsonLd(html);
  const article = blocks.find(b => b['@type'] === 'Article');
  assert.equal(article.headline, 'How Polymarket Liquidity Rewards Work');
  assert.equal(article.dateModified, '2026-11-22');
  assert.equal(article.mainEntityOfPage, 'https://www.alphaboard.xyz/how-polymarket-liquidity-rewards-work');
  assert.ok(article.citation.includes(DOCS));
  const faq = blocks.find(b => b['@type'] === 'FAQPage');
  assert.ok(faq.mainEntity.length >= 4);
  for (const q of faq.mainEntity) assert.ok(html.includes(q.name.replace(/'/g, '&#x27;')) || html.includes(q.name), `visible: ${q.name}`);
  const bc = blocks.find(b => b['@type'] === 'BreadcrumbList');
  assert.deepEqual(bc.itemListElement.map(i => i.name), ['Home', 'How Polymarket Liquidity Rewards Work']);
  assert.equal(mod.metadata.alternates.canonical, '/how-polymarket-liquidity-rewards-work');
  assert.doesNotMatch(read(ROUTE), /'use client'/);
});

test('wired into sitemap, llms.txt, breadcrumbs, analytics page group, and linked from the rewards table page', () => {
  const urls = createLoader()('src/app/sitemap.ts').default();
  const e = urls.find(u => u.url === 'https://www.alphaboard.xyz/how-polymarket-liquidity-rewards-work');
  assert.ok(e);
  assert.equal(e.lastModified, '2026-11-22');
  assert.match(read('public/llms.txt'), /\]\(https:\/\/www\.alphaboard\.xyz\/how-polymarket-liquidity-rewards-work\)/);
  assert.match(read('src/components/Breadcrumb.tsx'), /'\/how-polymarket-liquidity-rewards-work': 'How Liquidity Rewards Work'/);
  assert.equal(createLoader()('src/lib/funnelSchema.ts').pageGroup('/how-polymarket-liquidity-rewards-work'), 'liquidity');
  assert.match(read('src/app/polymarket-lp-rewards/LpRewardsView.tsx'), /href="\/how-polymarket-liquidity-rewards-work"/);
});
