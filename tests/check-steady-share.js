// Weekly-Planner — steady-share check (PR 1 money re-check, fix 1).
//
// Why this exists: "her loan payment as a % of her steady money" was worked
// out in four places. One of them (`sdCommitPlan`, js/43) had the $5 floor and
// the 50 % line; the other three divided by steady money with no floor, so a
// girl with $1 of steady money saw "Part of my steady money 300%" and a
// hard-coded "> 50" that could disagree with the parent's card.
//
// The rule: a division by steady money happens only in js/43-sunday-core.js
// (`sdSteadyShare`, `sdCommitShares`, `sdCommitPlan`). Everywhere else reads
// those. This check fails on `/ steady`, `/ (steady + …)`, `/ guSteady(…)`,
// `/ x.steady` and the like in any other js/ file. Comments are blanked
// first, so a comment that names the rule does not match.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JS = path.join(ROOT, 'js');
const OWNER = '43-sunday-core.js';

/* Blank comments (keeping line breaks) so line numbers stay true. A `//`
   right after a `:` (a URL in a string) is not a comment. */
function blankComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (m, pre) => pre + ' '.repeat(m.length - pre.length));
}

// A division whose divisor reaches a name ending in "steady" (any case),
// possibly behind brackets, an object path or calls wrapped round it:
// `/ steady`, `/ (steady + r)`, `/ guSteady(kid)`, `/ P.steady`,
// `/ money2(steady)`, `/ Number(steady)`, `/ Math.max(1, steady)`.
const DIVIDE_BY_STEADY = /\/\s*[\w$.(\s,]*?steady\b/i;

// Self-test: the pattern must keep catching the wrapped forms and must not
// flag a plain division (or a comment, once blanked).
[
  ['x / steady', true], ['x / money2(steady)', true], ['x / Number(steady)', true],
  ['x / Math.max(1, steady)', true], ['x / (a.steady + 1)', true],
  ['x / total', false], ['x / Math.max(1, total) // steady money', false],
].forEach(([src, flagged]) => {
  if (DIVIDE_BY_STEADY.test(blankComments(src)) !== flagged) {
    console.error(`check-steady-share: self-test failed — ${JSON.stringify(src)} should ${flagged ? '' : 'not '}be flagged`);
    process.exit(1);
  }
});

const problems = [];
for (const f of fs.readdirSync(JS).filter(n => n.endsWith('.js')).sort()) {
  if (f === OWNER) continue;
  const lines = blankComments(fs.readFileSync(path.join(JS, f), 'utf8')).split('\n');
  lines.forEach((line, i) => {
    if (DIVIDE_BY_STEADY.test(line)) {
      problems.push(`js/${f}:${i + 1}: divides by steady money — read sdSteadyShare / sdCommitShares (js/43) instead\n    ${line.trim().slice(0, 160)}`);
    }
  });
}

if (problems.length) {
  console.error(`check-steady-share: ${problems.length} division(s) by steady money outside js/${OWNER}:`);
  problems.forEach(p => console.error('  ' + p));
  process.exit(1);
}
console.log(`check-steady-share: OK — no division by steady money outside js/${OWNER}`);
