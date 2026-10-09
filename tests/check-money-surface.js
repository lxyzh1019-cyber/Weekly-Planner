// Weekly-Planner — money surface check (PR 1 money re-check, fix 2).
//
// Why this exists: the money screens take the prototype's text size
// (`--text-scale: 1` at 768px and wider) and one font for words and figures
// (`--font-round: var(--font-body)`). Each was set by a hand-kept list of
// screen roots in css/app.css, three lists in all, and the lists disagreed:
// Parent › Now and the "She told me" sheet had the size and not the font,
// the meeting and money heads had the font and not the size, and Money
// school, All my Sundays and By month had a list of their own.
//
// The rule: every money root carries `data-money-surface`, and the CSS sets
// those two values through `[data-money-surface]` only. This check fails when
//   - a rule outside the `:root` look blocks sets --text-scale or --font-round
//     with any selector other than `[data-money-surface]` (a list is back);
//   - no `[data-money-surface]` rule sets --text-scale, or none sets
//     --font-round;
//   - nothing in js/ or index.html writes the attribute.
// That a given screen carries it is measured by smoke
// `noLabelIsCutOnTheMoneyScreens`, which finds its roots by the attribute.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CSS = path.join(ROOT, 'css', 'app.css');
const SURFACE = '[data-money-surface]';
const WATCHED = ['--text-scale', '--font-round'];

const css = fs.readFileSync(CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));

/* Walk the blocks: each block's own declarations (nested blocks left out),
   with its selector and the line it starts on. */
function blocks(src) {
  const out = [];
  const stack = [];
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') {
      const prelude = src.slice(start, i).split(/[;}]/).pop().trim();
      stack.push({ prelude, own: '', line: src.slice(0, i).split('\n').length });
      start = i + 1;
    } else if (ch === '}') {
      const b = stack.pop();
      if (b) { b.own += src.slice(start, i); out.push(b); }
      start = i + 1;
    } else if (ch === ';' && stack.length) {
      stack[stack.length - 1].own += src.slice(start, i + 1);
      start = i + 1;
    }
  }
  return out;
}

const problems = [];
const surfaceSets = new Set();
for (const b of blocks(css)) {
  if (b.prelude.startsWith('@')) continue;
  for (const prop of WATCHED) {
    if (!new RegExp('(^|[;\\s])' + prop + '\\s*:').test(b.own)) continue;
    const sel = b.prelude.replace(/\s+/g, ' ');
    if (sel === SURFACE) { surfaceSets.add(prop); continue; }
    if (/^:root\b/.test(sel)) continue;   // the look blocks and print own the token
    problems.push(`css/app.css:${b.line}: "${sel}" sets ${prop} — money roots carry data-money-surface and only "${SURFACE}" sets it`);
  }
}
for (const prop of WATCHED) {
  if (!surfaceSets.has(prop)) problems.push(`css/app.css: no "${SURFACE}" rule sets ${prop}`);
}

const markup = [path.join(ROOT, 'index.html'), ...fs.readdirSync(path.join(ROOT, 'js')).filter(n => n.endsWith('.js')).map(n => path.join(ROOT, 'js', n))];
if (!markup.some(f => /\bdata-money-surface\b/.test(fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')))) {
  problems.push('no money root in js/ or index.html carries data-money-surface');
}

if (problems.length) {
  console.error(`check-money-surface: ${problems.length} problem(s):`);
  problems.forEach(p => console.error('  ' + p));
  process.exit(1);
}
console.log('check-money-surface: OK — the money text size and font are set through [data-money-surface] only');
