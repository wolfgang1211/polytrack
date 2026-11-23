/* Site-wide components flagged by the 2026-11-21 real-browser contrast audit (2.1-3.0:1 at 9-11px, 32px CTA). */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const FILES = ['src/components/Breadcrumb.tsx', 'src/components/TopMarkets.tsx', 'src/components/PolymarketTradeLink.tsx'];

test('breadcrumb, Featured market labels and the Polymarket CTA note use readable text (>= text-xs, >= ink/55)', () => {
  for (const f of FILES) {
    const s = read(f);
    assert.doesNotMatch(s, /text-\[(?:9|10|11)px\]/, `${f}: text smaller than text-xs`);
    // text colour below ink/55; the purely decorative breadcrumb separator is allowed when aria-hidden
    const weak = [...s.matchAll(/(?<![:\w-])text-ink\/([1-4]\d)\b/g)].filter(m => !/aria-hidden="true"[^>]*text-ink\/15|text-ink\/15[^>]*aria-hidden="true"/.test(s.slice(Math.max(0, m.index - 80), m.index + 80)));
    assert.deepEqual(weak.map(m => m[0]), [], `${f}: low-contrast text`);
  }
});

test('"Trade on Polymarket" CTA is at least 44px tall in both sizes', () => {
  const s = read('src/components/PolymarketTradeLink.tsx');
  assert.doesNotMatch(s, /min-h-8\b|min-h-10\b/);
  assert.equal((s.match(/min-h-11\b/g) || []).length >= 1, true);
});

test('breadcrumb links get a >= 24px tap target', () => {
  assert.match(read('src/components/Breadcrumb.tsx'), /min-h-6/);
});

test('light theme lifts the readable ink tones (50/55/60) to >= 62% so they pass 4.5:1 on the light canvas', () => {
  const css = read('src/app/globals.css');
  for (const a of ['50', '55', '60']) {
    const m = css.match(new RegExp(`:root\\[data-theme="light"\\] \\.text-ink\\\\/${a}\\s*\\{\\s*color:\\s*color-mix\\(in oklab, var\\(--color-ink\\) (\\d+)%, transparent\\);?\\s*\\}`));
    assert.ok(m, `override for ink/${a}`);
    assert.ok(Number(m[1]) >= 62, `ink/${a} -> ${m[1]}%`);
  }
});

test('market category badges use theme variables with darker light-theme tones (no hard-coded pastel text on light)', () => {
  const src = read('src/app/markets/MarketsClient.tsx');
  assert.doesNotMatch(src, /Politics: '#|Crypto: '#|Sports: '#/);
  assert.match(src, /var\(--cat-politics\)/);
  const css = read('src/app/globals.css');
  const light = css.slice(css.indexOf(':root[data-theme="light"] {'));
  for (const c of ['politics', 'crypto', 'sports', 'tech', 'entertainment', 'other']) {
    assert.match(css, new RegExp(`--cat-${c}:\\s*#[0-9a-f]{6}`), `dark --cat-${c}`);
    assert.match(light.slice(0, light.indexOf('}')), new RegExp(`--cat-${c}:\\s*#[0-9a-f]{6}`), `light --cat-${c}`);
  }
});

const PAGE_FILES = [
  'src/app/leaderboard/page.tsx', 'src/app/wallet/[address]/page.tsx',
  'src/app/liquidity/page.tsx', 'src/app/liquidity/Backtester.tsx', 'src/app/liquidity/RewardFarms.tsx',
  'src/app/liquidity/FarmChanges.tsx', 'src/app/liquidity/RecorderHealth.tsx', 'src/app/liquidity/ModelValidation.tsx',
  'src/components/CopyAddress.tsx', 'src/components/LatestMoves.tsx', 'src/components/LeaderboardTable.tsx',
  'src/components/LpEarnings.tsx', 'src/components/PnlTimeline.tsx', 'src/components/PositionCard.tsx',
  'src/components/StatsCard.tsx', 'src/components/WalletActivity.tsx', 'src/components/WalletCharts.tsx',
  'src/components/WalletSidebar.tsx',
];

test('leaderboard, wallet and liquidity: no sub-ink/55 text, no 8-9px text, no faint inline ink colour (2026-11-23 audit)', () => {
  for (const f of PAGE_FILES) {
    const s = read(f);
    assert.deepEqual([...s.matchAll(/(?<![:\w-])text-ink\/([1-4]\d|50)\b/g)].map(m => m[0]), [], `${f}: low-contrast ink text class`);
    assert.doesNotMatch(s, /text-\[(?:8|9)px\]/, `${f}: 8-9px text`);
    const faint = [...s.matchAll(/color:\s*'rgba\(var\(--ink-rgb\),\s*0?\.(\d+)\)'/g)].filter(m => Number(`0.${m[1]}`) < 0.55);
    assert.deepEqual(faint.map(m => m[0]), [], `${f}: faint inline ink colour`);
    assert.doesNotMatch(s, /(?<![:\w-])text-(?:rose|emerald|amber|red|green|sky)-\d00\/[1-7]\d\b/, `${f}: dimmed coloured text`);
  }
});

test('wallet/liquidity tap targets and mobile overflow (2026-11-23 audit)', () => {
  assert.match(read('src/components/CopyAddress.tsx'), /width: 24, height: 24/);
  assert.match(read('src/app/wallet/[address]/page.tsx'), /href="\/leaderboard" className="inline-flex min-h-6/);
  const fc = read('src/app/liquidity/FarmChanges.tsx');
  assert.match(fc, /hidden w-16 flex-shrink-0[^"]*sm:inline/);
  assert.match(fc, /gap-2 px-3 py-2\.5 sm:gap-3 sm:px-4/);
});
