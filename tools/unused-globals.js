// Lists top-level js/ names (function, let, const) that no other code in js/ or index.html names — comments stripped; a heuristic, so confirm each hit with a search. Usage: node tools/unused-globals.js [--tests]
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const jsDir = path.join(root, 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).map(f => path.join(jsDir, f));
const withTests = process.argv.includes('--tests');
const smokeParts = path.join(root, 'tests', 'smoke-parts');
const extra = [path.join(root, 'index.html')].concat(withTests ? [path.join(root, 'tests', 'smoke.js'),
  ...fs.readdirSync(smokeParts).filter(f => f.endsWith('.js')).map(f => path.join(smokeParts, f))] : []);

// Comments out, strings kept (a name inside a template or an onclick string is a use).
function stripComments(src) {
  let out = '', i = 0, q = null;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (q) {
      out += c;
      if (c === '\\') { out += n || ''; i += 2; continue; }
      if (c === q) q = null;
      i++; continue;
    }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '<' && src.startsWith('<!--', i)) { const e = src.indexOf('-->', i + 4); i = e < 0 ? src.length : e + 3; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    out += c; i++;
  }
  return out;
}

const texts = files.concat(extra).map(f => ({ f, t: stripComments(fs.readFileSync(f, 'utf8')) }));
const decl = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:let|const|var)\s+([A-Za-z_$][\w$]*)/gm;
const names = [];
texts.filter(x => x.f.startsWith(jsDir)).forEach(({ f, t }) => {
  let m;
  while ((m = decl.exec(t))) names.push({ name: m[1] || m[2], file: path.basename(f) });
});
const all = texts.map(x => x.t).join('\n');
names.forEach(({ name, file }) => {
  const re = new RegExp('(?<![\\w$])' + name.replace(/\$/g, '\\$') + '(?![\\w$])', 'g');
  const n = (all.match(re) || []).length;
  if (n <= 1) console.log(file + ' ' + name);
});
