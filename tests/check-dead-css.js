// Weekly-Planner — dead CSS guard.
//
// Fails when css/app.css defines a class selector that appears nowhere in
// index.html, js/ or tests/ as a whole word. Such a rule cannot ever match:
// the name is not in the markup, not in a template, not in a classList call.
//
// Why it is a build check and not a one-off cleanup: the 42 classes removed in
// an earlier pass accumulated because nothing was watching. A stylesheet only
// grows dead weight when deleting a feature leaves its CSS behind, which is
// invisible in review.
//
// Strict since PR 4 (D22): there is no prefix excuse any more. Before, a quoted
// prefix anywhere in the source excused every class with that start (with no
// left boundary, so a quoted 'block-' excused ck- names too); 49 dead classes
// hid behind it. Now a class whose full name never appears in the source must
// be listed in BUILT_AT_RUNTIME below, by its full name, under the file:line
// that glues it together (a kind, status or count onto a quoted prefix). The
// check also fails when a listed name is no longer in the CSS, or when the
// named builder file no longer holds that prefix, so the list cannot rot into
// a new excuse. This file is not read as source: names in the list are not uses.
//
// If this fires on a class you are about to use, use it in the same change. If
// you build a class at runtime, add each full name here under its builder.
// Removing rules is per-rule surgery, not a sweep: an earlier attempt at a
// brace-walking parser swallowed the closing braces of every @media block. Use
// the browser's CSSOM if you need to automate it, and gate on a screenshot
// comparison across widths.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'css', 'app.css'), 'utf8');

// Classes assembled at runtime, by builder (file:line where the name is glued).
// Full names only, never a prefix.
const BUILT_AT_RUNTIME = {
  'js/07-week-view.js:1240': ['wf-band-after', 'wf-band-before', 'wf-band-evening', 'wf-band-free', 'wf-band-lunch'],
  'js/10-social.js:152': ['sync-day-col--left', 'sync-day-col--right'],
  'js/16-print.js:185': ['print-band-after', 'print-band-before', 'print-band-evening', 'print-band-free',
    'print-band-lunch', 'print-band-school'],
  'js/22-money-page1.js:611': ['mv2-booktable--n1', 'mv2-booktable--n2', 'mv2-booktable--n3'],
  'js/22-money-page1.js:656': ['mv2-coming--n1', 'mv2-coming--n2', 'mv2-coming--n3', 'mv2-coming--n4', 'mv2-coming--n5'],
  'js/22-money-page1.js:658': ['mv2-comingrow--done'],
  'js/44-sunday.js:637': ['sd-coin--bank', 'sd-coin--earned', 'sd-coin--given'],
  'js/44-sunday.js:891': ['sd-seg--extra', 'sd-seg--fixed', 'sd-seg--gic', 'sd-seg--goal', 'sd-seg--ready',
    'sd-seg--spend', 'sd-seg--stock'],
  'js/44-sunday.js:895': ['sd-col--grow', 'sd-col--loan', 'sd-col--spend'],
  'js/44-sunday.js:909': ['sd-cell--extra', 'sd-cell--fixed', 'sd-cell--gic', 'sd-cell--goal', 'sd-cell--ready',
    'sd-cell--spend', 'sd-cell--stock'],
  'js/44-sunday.js:1097': ['sd-fill--adv', 'sd-fill--bank', 'sd-fill--cash', 'sd-fill--earned', 'sd-fill--fine',
    'sd-fill--given', 'sd-fill--goal', 'sd-fill--locked', 'sd-fill--made', 'sd-fill--saved', 'sd-fill--stock',
    'sd-fill--wall'],
  'js/44-sunday.js:1102': ['sd-verdict--bad', 'sd-verdict--good', 'sd-verdict--warn'],
  'js/44-sunday.js:1392': ['sd-script-line--ask', 'sd-script-line--wait'],
  'js/45-requests.js:763': ['rq-meet--open'],
  'js/45-requests.js:1043': ['rq-chip--no', 'rq-chip--open', 'rq-chip--talk', 'rq-chip--yes'],
  'js/46-grownups.js:186': ['gu-kidchip--jenn', 'gu-kidchip--jess'],
  'js/46-grownups.js:348': ['gu-stamp--talk', 'gu-stamp--yes'],
  'js/46-grownups.js:352': ['gu-req--no', 'gu-req--talk', 'gu-req--yes'],
  'js/46-grownups.js:535': ['gu-tint--jenn'],
  'js/46-grownups.js:1023': ['gu-tint--green', 'gu-tint--loan', 'gu-tint--spend'],
};

// Strip comments first, so prose mentioning a class name is not read as a rule.
const cssRules = css.replace(/\/\*[\s\S]*?\*\//g, '');

let src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const dir of ['js', 'tests']) {
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    if (!f.endsWith('.js') || (dir === 'tests' && f === path.basename(__filename))) continue;
    src += fs.readFileSync(path.join(ROOT, dir, f), 'utf8');
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

const built = new Set();
const stale = [];
for (const [where, names] of Object.entries(BUILT_AT_RUNTIME)) {
  const file = where.replace(/:\d+$/, '');
  const full = path.join(ROOT, file);
  const builder = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
  for (const n of names) {
    const prefix = n.replace(/[a-zA-Z0-9]+$/, '');
    if (!classes.has(n)) stale.push(`.${n} (listed under ${where}) is no longer in css/app.css`);
    else if (!builder.includes(prefix)) stale.push(`.${n}: ${file} no longer builds '${prefix}...'`);
    built.add(n);
  }
}

const dead = [...classes].sort().filter(c => !used(c) && !built.has(c));

if (!dead.length && !stale.length) {
  console.log(`OK  ${classes.size} CSS classes, all referenced (${built.size} of them built at runtime, listed)`);
  process.exit(0);
}

if (dead.length) {
  console.error(`FAIL  ${dead.length} CSS class(es) defined but never referenced:\n`);
  for (const c of dead) console.error(`  .${c}`);
  console.error('\nEither use them, list each full name under its runtime builder in');
  console.error('BUILT_AT_RUNTIME, or remove their rules — one rule at a time, checking');
  console.error('screenshots at 390, 768, 1024 and 1440 before and after.');
}
if (stale.length) {
  console.error(`FAIL  ${stale.length} stale BUILT_AT_RUNTIME entr${stale.length === 1 ? 'y' : 'ies'}:\n`);
  for (const s of stale) console.error(`  ${s}`);
}
process.exit(1);
