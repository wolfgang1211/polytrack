/* Node CommonJS test loader, not application code. */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

exports.createLoader = function createLoader() {
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(root, filename);
    if (!fs.existsSync(filename)) {
      filename = ['.ts', '.tsx'].map(ext => filename + ext).find(p => fs.existsSync(p)) ?? filename;
    }
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} };
    cache.set(filename, loaded);
    const requireNative = createRequire(filename);
    const localRequire = name => name.startsWith('@/')
      ? load(`src/${name.slice(2)}`)
      : name.startsWith('./') || name.startsWith('../') ? load(path.resolve(path.dirname(filename), name)) : requireNative(name);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    new Function('exports', 'require', 'module', '__filename', '__dirname', compiled)(
      loaded.exports, localRequire, loaded, filename, path.dirname(filename),
    );
    return loaded.exports;
  }
  return load;
};
