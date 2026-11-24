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

test('liquidity mobile: picker chips readable, trader grid and selects fit 375px (2026-11-23 live re-measure)', () => {
  const s = read('src/app/liquidity/page.tsx');
  assert.match(s, /color: on \? 'var\(--text-primary\)' : 'var\(--text-tertiary\)'/);
  assert.doesNotMatch(s, /(?<!sm:)grid-cols-\[40px_1fr_140px_140px\]/);
  assert.match(s, /max-w-\[44vw\] truncate sm:max-w-xs/);
  assert.doesNotMatch(s, /'rgba\(var\(--ink-rgb\),0\.[1-4]\d?\)',\s*\n\s*\}\}/);
});

test('light theme maps bright accent colours to readable shades (2026-11-23 live re-measure)', () => {
  const css = read('src/app/globals.css');
  for (const [from, to] of [['#34d399', '#065f46'], ['#fb7185', '#9f1239'], ['#fbbf24', '#92400e'], ['#60a5fa', '#1d4ed8']]) {
    assert.ok(css.includes(`[style*="color:${from}" i]`) && css.includes(`{ color: ${to} !important; }`), `${from} light mapping`);
  }
  assert.match(css, /:root\[data-theme="light"\] \{ --success: #065f46; --danger: #9f1239; --warning: #92400e; --info: #1d4ed8; \}/);
  for (const c of ['emerald-300', 'emerald-400', 'rose-300', 'rose-400', 'amber-300', 'amber-400']) {
    assert.match(css, new RegExp(`:root\\[data-theme="light"\\] \\.text-${c} \\{ color: #`));
  }
});

test('leaderboard stat accents use theme-aware status tokens', () => {
  const s = read('src/app/leaderboard/page.tsx');
  assert.doesNotMatch(s, /accent=\{?[^}\n]*rgba\((?!var)/);
  assert.match(s, /accent="var\(--info\)"/);
});

test('wallet watchlist button idle text uses secondary ink', () => {
  assert.match(read('src/app/wallet/[address]/page.tsx'), /border:'1px solid rgba\(var\(--ink-rgb\),0\.1\)', color:'var\(--text-secondary\)'/);
});

test('liquidity light theme: tooltips use the theme surface, header fits 375px, no dimmed accent text', () => {
  for (const f of ['src/app/liquidity/page.tsx', 'src/app/liquidity/Backtester.tsx', 'src/app/liquidity/RecorderHealth.tsx', 'src/components/WalletActivity.tsx']) {
    const s = read(f);
    assert.doesNotMatch(s, /rgba\(25,25,25/, `${f}: hard-coded dark tooltip`);
    assert.doesNotMatch(s, /(?<![:\w-])text-(?:rose|emerald|amber|sky)-\d00\/\d\d\b/, `${f}: dimmed accent text`);
  }
  const p = read('src/app/liquidity/page.tsx');
  assert.match(p, /hidden h-px w-12 sm:block/);
  assert.match(p, /accent="var\(--warning\)"/);
  assert.match(read('src/app/globals.css'), /color:#fb923c" i\][^\n]*\{ color: #9a3412 !important; \}/);
});

test('every liquidity section header drops the decorative rule on mobile; cyan readable on light', () => {
  for (const f of ['src/app/liquidity/page.tsx', 'src/app/liquidity/Backtester.tsx', 'src/app/liquidity/FarmChanges.tsx', 'src/app/liquidity/RecorderHealth.tsx', 'src/app/liquidity/ModelValidation.tsx']) {
    const s = read(f);
    if (s.includes('function SectionHeader')) assert.match(s, /hidden h-px w-12 sm:block/, f);
  }
  assert.match(read('src/app/globals.css'), /:root\[data-theme="light"\] \.text-cyan-300 \{ color: #0e7490; \}/);
});

test('light theme: profit/loss gradient text uses dark shades (Polymarket and Kalshi price tiles)', () => {
  const css = read('src/app/globals.css');
  assert.match(css, /:root\[data-theme="light"\] \.text-grad-profit \{ background:linear-gradient\(135deg,#047857,#065f46\)/);
  assert.match(css, /:root\[data-theme="light"\] \.text-grad-loss   \{ background:linear-gradient\(135deg,#be123c,#9f1239\)/);
});

test('dark theme: loss gradient is light enough on red-tinted price tiles', () => {
  assert.match(read('src/app/globals.css'), /^\.text-grad-loss     \{ background:linear-gradient\(135deg,#fda4af,#fb7185\)/m);
});
