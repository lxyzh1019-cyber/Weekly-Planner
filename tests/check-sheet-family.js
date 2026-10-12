// Weekly-Planner — one sheet and one dialog style (Stage 43, owner G13 and P1–P4, 2026-10-12).
//
// Every pop-up is an .overlay holding the kit's .ui-sheet (or, for the app
// dialog, .ui-dialog) — css/app.css, the kit section. This check fails when a
// second sheet or dialog look comes back:
//   1. a retired sheet class is styled or written: .sheet, .sheet--compact,
//      .sheet-close-x, .app-dialog-sheet, .td-more-sheet, .sd-sheet,
//      .pn-told-sheet, .rq-x (in css/, index.html or js/);
//   2. a rule outside the kit draws a pop-up's box: any rule whose selector
//      ends on an overlay or a sheet (.overlay, #…Overlay, .ui-sheet,
//      .ui-dialog, .rq-sheet, .gu-sheet) and sets its background, border,
//      corner, shadow, position, layer, alignment, size or animation. Words
//      (colour, font), padding, max-height and the custom properties
//      (--sheet-w, --scrim) stay allowed: they are what a sheet holds, not
//      what it looks like.
// The parser walks braces one level into @media / @supports and skips
// @keyframes; the stylesheets have no deeper nesting.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RETIRED = ['sheet', 'sheet--compact', 'sheet-close-x', 'app-dialog-sheet', 'td-more-sheet', 'sd-sheet', 'pn-told-sheet', 'rq-x'];
// The kit's own rules: the only ones that may draw the box.
const KIT = new Set(['.overlay', '.overlay.open', '.overlay--dialog', '.overlay.overlay--dialog', '.overlay[data-money-surface]',
  '.ui-sheet', '.ui-dialog', '.ui-sheet-x', '.ui-sheet--docked', '.ui-sheet > h3']);
const BOX = /^(?:background(?:-color|-image)?|border(?:-[a-z-]+)?|box-shadow|position|inset|top|right|bottom|left|z-index|align-items|justify-content|align-self|width|min-width|max-width|margin(?:-[a-z]+)?|animation(?:-[a-z]+)?|display|transform)$/;
const POPUP_SUBJECT = /(?:\.overlay\b|#[A-Za-z]+Overlay$|\.ui-sheet(?![-\w])|\.ui-dialog(?![-\w])|\.rq-sheet(?![-\w])|\.gu-sheet(?![-\w]))[^\s>+~]*$/;

const problems = [];
const retiredClass = (c) => new RegExp(`\\.${c.replace(/-/g, '\\-')}(?![-\\w])`);

function rules(css) {
  const out = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  const walk = (end) => {
    while (i < end) {
      const open = text.indexOf('{', i);
      if (open < 0 || open >= end) return;
      const head = text.slice(i, open).trim();
      // The matching close brace.
      let depth = 1, j = open + 1;
      while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      if (/^@(media|supports)/.test(head)) { i = open + 1; walk(j - 1); i = j; continue; }
      if (!head.startsWith('@')) out.push({ selector: head, body: text.slice(open + 1, j - 1) });
      i = j;
    }
  };
  walk(text.length);
  return out;
}

for (const f of fs.readdirSync(path.join(ROOT, 'css')).filter(f => f.endsWith('.css')).sort()) {
  const css = fs.readFileSync(path.join(ROOT, 'css', f), 'utf8');
  for (const { selector, body } of rules(css)) {
    for (const c of RETIRED) if (retiredClass(c).test(selector)) problems.push(`css/${f}: "${selector}" styles the retired .${c}`);
    const parts = selector.split(',').map(s => s.trim().replace(/\s+/g, ' '));
    const outside = parts.filter(s => !KIT.has(s) && POPUP_SUBJECT.test(s));
    if (!outside.length) continue;
    const props = body.split(';').map(d => d.split(':')[0].trim().toLowerCase()).filter(p => p && !p.startsWith('--'));
    const boxy = props.filter(p => BOX.test(p));
    if (boxy.length) problems.push(`css/${f}: "${outside.join(', ')}" sets ${boxy.join(', ')} — a second sheet look; the box is the kit's (.ui-sheet / .ui-dialog)`);
  }
}

// The markup: no element wears a retired sheet class.
const sources = [path.join(ROOT, 'index.html'), ...fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => path.join(ROOT, 'js', f))];
for (const file of sources) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/class="([^"$]*)"/g)) {
    const names = m[1].split(/\s+/);
    for (const c of RETIRED) if (names.includes(c)) problems.push(`${path.relative(ROOT, file)}: an element wears the retired class "${c}"`);
  }
}

if (problems.length) {
  console.error('check-sheet-family: a second sheet or dialog style is back:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('check-sheet-family: one sheet style (.ui-sheet) and one dialog style (.ui-dialog), nothing else draws a pop-up');
