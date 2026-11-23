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
