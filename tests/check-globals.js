// Weekly-Planner — duplicate top-level declaration guard.
//
// index.html loads js/01-*.js .. js/99-main.js as classic scripts sharing ONE
// global scope (see MODULARIZATION_PLAN.md and CLAUDE.md). That makes duplicate
// top-level names a real hazard, and one that per-file `node --check` cannot see:
//
//   - two `function foo()` declarations: the later file silently wins, and any
//     difference in its signature or body is invisible at the call sites
//   - two top-level `let`/`const` of one name: a hard SyntaxError at load, so
//     the whole app dies with a blank screen
//
// This script fails when any top-level name is declared in more than one place.
// Run via `npm run check`.
//
// Scope: top-level declarations only, i.e. those starting at column 0. Anything
// indented is inside a function or block and cannot collide globally.
//
// Known limitation: top-level destructuring (`const {a, b} = obj`) is not
// unpacked, so names bound that way are not compared. That under-reports rather
// than false-alarms; there is no top-level destructuring in js/ today.

const fs = require('fs');
const path = require('path');

const JS_DIR = path.join(__dirname, '..', 'js');

// Pull every declarator name out of one `let|const|var` line. Handles the
// comma-separated form (`let a = null, b = null;`) by splitting only on commas
// at bracket depth 0, outside strings.
function declaratorNames(rest) {
  const names = [];
  let depth = 0;
  let quote = null;
  let segment = '';
  const flush = () => {
    const m = segment.match(/^\s*([A-Za-z_$][A-Za-z0-9_$]*)/);
    if (m) names.push(m[1]);
    segment = '';
  };
  for (let i = 0; i < rest.length; i++) {
    const c = rest[i];
    if (quote) {
      if (c === quote && rest[i - 1] !== '\\') quote = null;
      segment += c;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; segment += c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) { flush(); continue; }
    else if (c === '=' && depth === 0 && rest[i + 1] !== '=' && rest[i - 1] !== '!' && rest[i - 1] !== '=') {
      // stop at the initialiser; the name is everything before it
      flush();
      // skip to the next depth-0 comma
      let d = 0, q = null;
      for (i++; i < rest.length; i++) {
        const k = rest[i];
        if (q) { if (k === q && rest[i - 1] !== '\\') q = null; continue; }
        if (k === '"' || k === "'" || k === '`') { q = k; continue; }
        if (k === '(' || k === '[' || k === '{') d++;
        else if (k === ')' || k === ']' || k === '}') d--;
        else if (k === ',' && d === 0) break;
      }
      continue;
    }
    segment += c;
  }
  flush();
  return names;
}

// name -> [{ file, line }]
const decls = new Map();
const record = (name, file, line) => {
  if (!decls.has(name)) decls.set(name, []);
  decls.get(name).push({ file, line });
};

const files = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js')).sort();

for (const file of files) {
  const lines = fs.readFileSync(path.join(JS_DIR, file), 'utf8').split('\n');
  lines.forEach((text, i) => {
    const lineNo = i + 1;

    let m = text.match(/^(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
    if (m) { record(m[1], file, lineNo); return; }

    m = text.match(/^(let|const|var)\s+(.*)$/);
    if (m) for (const n of declaratorNames(m[2])) record(n, file, lineNo);
  });
}

const dupes = [...decls.entries()]
  .filter(([, sites]) => sites.length > 1)
  .sort(([a], [b]) => a.localeCompare(b));

const total = [...decls.values()].reduce((n, s) => n + s.length, 0);

if (!dupes.length) {
  console.log(`OK  ${total} top-level declarations across ${files.length} files, no duplicates`);
  process.exit(0);
}

console.error(`FAIL  ${dupes.length} duplicated top-level name(s):\n`);
for (const [name, sites] of dupes) {
  console.error(`  ${name}`);
  for (const s of sites) console.error(`      js/${s.file}:${s.line}`);
  console.error('');
}
console.error('All js/*.js files share one global scope. A duplicate function lets the');
console.error('last-loaded copy win silently; a duplicate let/const is a SyntaxError at');
console.error('load. Rename or delete one declaration.');
process.exit(1);
