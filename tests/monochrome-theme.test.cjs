const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createLoader } = require('./helpers/load-ts.cjs');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? files(file) : /\.(?:css|tsx?|svg)$/.test(file) ? [file] : [];
  });
}
function purple(rgb) {
  const [r, g, b] = rgb.map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  if (!delta || delta < 0.015) return false;
  let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  return hue >= 235 && hue <= 315;
}
test('all active UI sources are free of purple theme colors and legacy brand tokens', () => {
  const failures = [];
  for (const file of files(path.join(root, 'src'))) {
    const source = fs.readFileSync(file, 'utf8');
    const name = path.relative(root, file);
    if (/(?:bg|text|ring|border|from|to|via|stroke|fill|shadow|outline)-(?:purple|violet|indigo|fuchsia)-/.test(source)) failures.push(`${name}: purple utility`);
    if (/--vi-/.test(source)) failures.push(`${name}: legacy brand token`);
    if (/mark-purple-/.test(source)) failures.push(`${name}: active purple logo`);
    for (const match of source.matchAll(/#([\da-f]{6}|[\da-f]{3})\b/gi)) {
      const hex = match[1].length === 3 ? match[1].split('').map(c => c + c).join('') : match[1];
      if (purple([0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)))) failures.push(`${name}: ${match[0]}`);
    }
    for (const match of source.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi)) {
      if (purple(match.slice(1).map(Number))) failures.push(`${name}: ${match[0]}`);
    }
  }
  assert.deepEqual(failures, []);
});
test('neutral surfaces and typography keep accessible monochrome contrast without desaturating data', () => {
  const css = read('src/app/globals.css');
  assert.match(css, /--color-background:\s*#111111/);
  assert.match(css, /--text-primary:\s*#f2f0e9/);
  assert.match(css, /--text-secondary:\s*#b1afa8/);
  assert.match(css, /--text-muted:\s*#898780/);
  assert.doesNotMatch(css, /filter:\s*(?:grayscale|saturate)\(/);
  assert.match(read('src/app/wallet/[address]/page.tsx'), /background:'var\(--accent-fill\)'/);
  assert.doesNotMatch(read('src/app/wallet/[address]/page.tsx'), /background:'linear-gradient\([^']*rgba\(255,255,255,0\.55\)/);
  assert.match(read('src/app/not-found/page.tsx'), /background: 'var\(--accent-grad\)'/);
  function luminance(hex) {
    return [0.2126, 0.7152, 0.0722].reduce((sum, weight, i) => {
      const channel = parseInt(hex.slice(i * 2, i * 2 + 2), 16) / 255;
      return sum + weight * (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    }, 0);
  }
  for (const fg of ['f2f0e9', 'b1afa8', '898780']) {
    for (const bg of ['111111', '191919', '202020']) {
      assert.ok((luminance(fg) + 0.05) / (luminance(bg) + 0.05) >= 4.5, `${fg} on ${bg}`);
    }
  }
});
test('gain, loss, buy, sell and data-status colors keep their original meaning', () => {
  const utils = createLoader()('src/lib/utils.ts');
  assert.equal(utils.pnlColor(1), 'text-emerald-400');
  assert.equal(utils.pnlColor(-1), 'text-red-400');
  assert.equal(utils.pnlColor(0), 'text-zinc-400');
  const css = read('src/app/globals.css');
  assert.match(css, /--success:\s*#34d399/);
  assert.match(css, /--danger:\s*#fb7185/);
  assert.match(css, /--warning:\s*#fbbf24/);
  assert.match(css, /--info:\s*#60a5fa/);
  assert.match(read('src/app/api/wallet/[address]/og/route.tsx'), /up \? '#34d399' : '#fb7185'/);
  for (const file of ['src/components/RecentBigTrades.tsx', 'src/components/WalletActivity.tsx']) {
    const source = read(file);
    assert.match(source, /(?:emerald|green)/);
    assert.match(source, /(?:rose|red)/);
  }
});
test('brand assets use the original mark in a neutral treatment on page and app metadata', () => {
  const logo = read('src/components/Logo.tsx');
  assert.match(logo, /alphaboard-mark-white-512\.png/);
  for (const size of [192, 512]) assert.ok(fs.existsSync(path.join(root, `public/alphaboard-icon-${size}.png`)));
  assert.match(read('src/app/manifest.ts'), /theme_color:\s*'#111111'/);
  assert.doesNotMatch(read('src/app/layout.tsx'), /animate-orb|ambient orbs|feTurbulence|violet scan-line/);
});
