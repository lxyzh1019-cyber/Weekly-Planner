// Weekly-Planner — dead id guard.
//
// Fails when index.html gives an element an id that nothing reads: no
// getElementById or querySelector in js/, no `for=` / `aria-*=` / `href="#…"`
// back-reference elsewhere in the markup, no `#id` selector in css/app.css.
// An id like that is a promise nobody keeps — the six orphans an outside audit
// found had each outlived the code that used them, and nothing here noticed.
//
// The blind spot is the same one tests/check-dead-css.js documents: ids that
// are assembled at runtime (`'ptab-' + panel`, `prefix + 'DateRange'`) never
// appear literally, so grep cannot tell them from dead ones. Rather than keep a
// hand-written table that drifts, the prefixes and suffixes are DISCOVERED from
// the source: any quoted string ending in `-` that is concatenated or
// interpolated, and any capitalised quoted string that follows a `+`. An id
// matching one of those is left alone. That under-reports; it does not
// false-alarm.
//
// If this fires on an id you are about to use, use it in the same change.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'css', 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

let js = '';
for (const f of fs.readdirSync(path.join(ROOT, 'js'))) {
  if (f.endsWith('.js')) js += fs.readFileSync(path.join(ROOT, 'js', f), 'utf8') + '\n';
}

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) {
  console.error(`FAIL  duplicate id(s) in index.html: ${[...new Set(dupes)].join(', ')}`);
  process.exit(1);
}

// The markup with every `id="…"` definition blanked out, so a reference is only
// ever something OTHER than the element naming itself.
const htmlRefs = html.replace(/\sid="[^"]+"/g, ' ');
const src = htmlRefs + '\n' + js + '\n' + css;

const used = (name) =>
  new RegExp(`(?<![A-Za-z0-9_-])${name.replace(/[-]/g, '\\-')}(?![A-Za-z0-9_-])`).test(src);

// Runtime-built names. Prefix: a quoted string ending in `-` beside a `+`, or a
// template-literal head ending in `-${`. Suffix: a capitalised quoted string
// after a `+`.
const prefixes = new Set();
for (const m of js.matchAll(/['"]([A-Za-z][A-Za-z0-9_-]*-)['"]\s*\+/g)) prefixes.add(m[1]);
for (const m of js.matchAll(/\+\s*['"]([A-Za-z][A-Za-z0-9_-]*-)['"]/g)) prefixes.add(m[1]);
for (const m of js.matchAll(/`([A-Za-z][A-Za-z0-9_-]*-)\$\{/g)) prefixes.add(m[1]);
const suffixes = new Set();
for (const m of js.matchAll(/\+\s*['"]([A-Z][A-Za-z0-9]*)['"]/g)) suffixes.add(m[1]);

const dead = [];
for (const id of [...new Set(ids)].sort()) {
  if (used(id)) continue;
  if ([...prefixes].some(p => id.startsWith(p))) continue;
  if ([...suffixes].some(s => id.endsWith(s) && id !== s)) continue;
  dead.push(id);
}

if (!dead.length) {
  console.log(`OK  ${ids.length} ids in index.html, all referenced (${prefixes.size} runtime prefixes, ${suffixes.size} suffixes tolerated)`);
  process.exit(0);
}
console.error(`FAIL  ${dead.length} id(s) defined in index.html but never referenced:\n`);
for (const id of dead) console.error(`  #${id}`);
console.error('\nEither read them from js/, point a for= / aria-* at them, or drop the attribute.');
process.exit(1);
