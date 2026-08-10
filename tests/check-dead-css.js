// Weekly-Planner — dead CSS guard.
//
// Fails when css/app.css defines a class selector that appears nowhere in
// index.html, js/ or tests/. Such a rule cannot ever match: the name is not in
// the markup, not in a template, not in a classList call.
//
// Why it is a build check and not a one-off cleanup: the 42 classes removed in
// this pass accumulated because nothing was watching. A stylesheet only grows
// dead weight when deleting a feature leaves its CSS behind, which is invisible
// in review.
//
// What it deliberately does NOT flag: names that are assembled at runtime from a
// prefix, e.g. `'ck-' + lane` or `'mny-' + kind`. The literal never appears in
// the source, so they are indistinguishable from dead names by grep. Any class
// whose prefix is quoted somewhere in the source is treated as possibly-built
// and left alone — that is ~25 names today, and the alternative is a check
// nobody can keep green.
//
// If this fires on a class you are about to use, use it in the same change.
// Removing rules is per-rule surgery, not a sweep: an earlier attempt at a
// brace-walking parser swallowed the closing braces of every @media block. Use
// the browser's CSSOM if you need to automate it, and gate on a screenshot
// comparison across widths.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'css', 'app.css'), 'utf8');

// Strip comments first, so prose mentioning a class name is not read as a rule.
const cssRules = css.replace(/\/\*[\s\S]*?\*\//g, '');

let src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const dir of ['js', 'tests']) {
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    if (f.endsWith('.js')) src += fs.readFileSync(path.join(ROOT, dir, f), 'utf8');
  }
}

const classes = new Set([...cssRules.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(m => m[1]));

/* Whole-token, not substring. `src.includes('week-grid')` is satisfied by
   `print-week-grid`, and `includes('legend-dot')` by `tg-legend-dot` — so four
   rules for a deleted week view sailed through this check as "referenced".
   A dead-code check that cannot see dead code is the failure mode CLAUDE.md
   warns about, so the boundary is explicit: a class name may not be flanked by
   another name character. */
const used = (name) =>
  new RegExp(`(?<![A-Za-z0-9_-])${name.replace(/[-]/g, '\\-')}(?![A-Za-z0-9_-])`).test(src);

const dead = [];
for (const c of [...classes].sort()) {
  if (used(c)) continue;
  const prefix = c.replace(/-[a-zA-Z0-9]+$/, '-');
  if (prefix !== c && [`'${prefix}`, `"${prefix}`, '`' + prefix, `${prefix}'`].some(p => src.includes(p))) {
    continue;   // plausibly built at runtime from this prefix
  }
  dead.push(c);
}

if (!dead.length) {
  console.log(`OK  ${classes.size} CSS classes, all referenced`);
  process.exit(0);
}

console.error(`FAIL  ${dead.length} CSS class(es) defined but never referenced:\n`);
for (const c of dead) console.error(`  .${c}`);
console.error('\nEither use them, or remove their rules — one rule at a time, checking');
console.error('screenshots at 390, 768, 1024 and 1440 before and after.');
process.exit(1);
