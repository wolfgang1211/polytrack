const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function uiFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'api' ? [] : uiFiles(file);
    return file.endsWith('.tsx') ? [file] : [];
  });
}
test('site-wide neutral UI utilities and inline tones are theme-aware, not dark-only', () => {
  const failures = [];
  for (const file of [...uiFiles(path.join(root, 'src/app')), ...uiFiles(path.join(root, 'src/components'))]) {
    const source = fs.readFileSync(file, 'utf8');
    const name = path.relative(root, file);
    if (/(?:text|bg|border|divide|ring|placeholder|stroke|fill|from|via|to)-white(?:\b|\/)/.test(source)) failures.push(`${name}: fixed white utility`);
    if (/rgba?\(\s*255\s*,\s*255\s*,\s*255/.test(source)) failures.push(`${name}: fixed white alpha tone`);
    if (/#(?:111111|191919|202020|292929|f2f0e9|b1afa8)\b/i.test(source)) failures.push(`${name}: fixed neutral hex tone`);
  }
  assert.deepEqual(failures, []);
});
