// Weekly-Planner — escaping lint.
//
// Two rules, both learned from real defects in this codebase:
//
// 1. TEXT CONTEXT. A user-editable string interpolated into an HTML template
//    must go through escapeHtml. Activity names, routine and challenge titles,
//    chore-group names, routine item text and the kid's mascot name are all
//    free text the family types.
//
// 2. HANDLER CONTEXT. A value interpolated into a single-quoted JS string inside
//    an inline handler — onclick="fn('HERE')" — must go through escapeJsAttr,
//    NOT escapeAttr. An inline handler is HTML-decoded before it is parsed as
//    JavaScript, so escapeAttr's &#39; decodes back to an apostrophe and closes
//    the string anyway. Block ids used to carry 24 characters of the user's
//    note, and ids also arrive from a shared Firestore document, so this was
//    live arbitrary-code execution on tap, not a theoretical one.
//
// Opt out on a line with a trailing `/* safe: why */` comment. Use it when the
// value is a constant from a data table, and say which one. Note that a line
// INSIDE a multi-line template literal cannot carry that comment — it would
// render as visible text — so there, either escape (harmless on a constant) or
// name the value with an `Html` suffix to say it is already escaped.
//
// This is a lint, not a proof: it reads lines, not scopes. tests/smoke.js has
// the runtime assertions (hostileNamesCannotBecomeCode).

const fs = require('fs');
const path = require('path');

const JS_DIR = path.join(__dirname, '..', 'js');

// Every ${...} interpolation on a line (no nested braces — good enough here).
const INTERP = /\$\{([^{}]+)\}/g;
// '${...}' inside an inline handler attribute.
const HANDLER = /\son[a-z]+\s*=\s*"([^"]*)"/g;
const HTMLTAG = /<\/?[a-zA-Z][a-zA-Z0-9-]*[\s>\/]/;
const OPT_OUT = /\/\*\s*safe:/;

/* Does this expression resolve to free text the family typed?
   Tested against the extracted expression rather than matched inline, because
   an inline pattern missed `act?.name` — optional chaining has no literal dot
   before the property, and that gap hid a real unescaped sink. */
const TEXTY_MEMBER = /(?:\?\.|\.)\s*(?:name|label|title|text|note)\s*$/;
/* A bare local that carries user text. This exists because a real XSS hid behind
   one: js/07-week-view.js built `const dispName = topic ? topic.name : act.name`
   and interpolated `${dispName}` straight into a card, so the member-expression
   rule above never saw a `.name` at the interpolation site and the hole rendered
   an <img> from a custom activity's name. Naming is the only signal available
   without a real parser, so anything named like display text is treated as
   display text. */
const TEXTY_LOCAL = /^(?:disp[A-Z]\w*|\w*(?:Name|Label|Title|Text|Note))$/;
function isTexty(expr) {
  // Ignore a trailing `|| 'fallback'`; the fallback is a literal either way.
  const head = expr.replace(/\|\|[^|]*$/, '').trim();
  if (/mascotName\s*$/.test(head)) return true;
  if (TEXTY_LOCAL.test(head)) return true;
  return TEXTY_MEMBER.test(head);
}

const problems = [];

for (const file of fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js')).sort()) {
  const lines = fs.readFileSync(path.join(JS_DIR, file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    const where = `js/${file}:${i + 1}`;
    if (OPT_OUT.test(line)) return;

    // Rule 2 first: handler context is the more dangerous one.
    let m;
    HANDLER.lastIndex = 0;
    while ((m = HANDLER.exec(line))) {
      const body = m[1];
      const inner = /'\$\{([^{}]+)\}'/g;
      let h;
      while ((h = inner.exec(body))) {
        const expr = h[1];
        if (/^[\s\d+\-*/().]+$/.test(expr)) continue;      // numeric, cannot carry a quote
        if (/escapeJsAttr\s*\(/.test(expr)) continue;
        problems.push({
          where, rule: 'handler',
          detail: `'\${${expr}}' inside ${m[0].trim().slice(0, 40)}…`,
          fix: 'wrap in escapeJsAttr() — escapeAttr does not protect inline handlers'
        });
      }
    }

    // Rule 1: only meaningful where the line is actually building markup.
    if (!HTMLTAG.test(line)) return;
    if (/\.map\(/.test(line)) return;                      // interpolates markup, not text
    INTERP.lastIndex = 0;
    while ((m = INTERP.exec(line))) {
      const expr = m[1];
      if (/escapeHtml|escapeAttr|escapeJsAttr/.test(expr)) continue;
      if (!isTexty(expr)) continue;
      problems.push({
        where, rule: 'text',
        detail: '${' + expr.trim() + '}',
        fix: 'wrap in escapeHtml(), or mark /* safe: constant from <table> */'
      });
    }
  });
}

if (!problems.length) {
  console.log('OK  escaping lint clean');
  process.exit(0);
}

console.error(`FAIL  ${problems.length} unescaped interpolation(s):\n`);
for (const p of problems) {
  console.error(`  ${p.where}  [${p.rule}]`);
  console.error(`      ${p.detail}`);
  console.error(`      ${p.fix}\n`);
}
process.exit(1);
