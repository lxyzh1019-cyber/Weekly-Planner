// Weekly-Planner — look-token lint.
//
// Why this exists: the app is getting two looks (Pop and Calm, handoff L2/L11).
// A look is only a different set of VALUES for the same shared names, so every
// colour and font the app paints must read one of those names. One typed-in
// `#fff` or `font-family: 'Patrick Hand'` is a spot that silently stays in the
// old look when the family switches — nobody sees it until a child does. So a
// typed colour or font anywhere outside the shared value set fails the build.
//
// Four rules:
//
// 1. css/app.css. Comments are stripped first. Outside a TOKEN BLOCK no
//    declaration may carry a colour literal — hex, rgb()/rgba(), hsl()/hsla(),
//    hwb()/lab()/lch()/oklab()/oklch(), or a CSS named colour (transparent,
//    currentColor, inherit, initial and unset are keywords, not colours) — and
//    `font-family` must be one token — `var(--…)` with no fallback (the font
//    tokens are --font-… and print's --print-font-…) — or `inherit`; the `font` shorthand
//    must not name a family itself (no quoted name, no generic like
//    sans-serif). A literal in a `var(--x, #fff)` fallback counts: it is typed.
//    A TOKEN BLOCK is a rule whose whole selector is `:root`,
//    `[data-look="…"]` or `:root[data-look="…"]`, at the top level or inside an
//    at-rule (so `@media print { :root { … } }` is one; `:root .x` is not).
//    Inside a token block only custom-property declarations (`--name: …`) may
//    carry literals — `:root { background: #fff }` is still a typed colour.
//
// 2. js/*.js and index.html. No hex (#rgb, #rgba, #rrggbb, #rrggbbaa),
//    rgb()/rgba(), hsl()/hsla(), and no `font-family:` / `fontFamily =` naming a
//    font instead of `var(…)`/`inherit`. Comment TEXT is not scanned: a small
//    lexer (the same shape as check-dead-actions.js's; a copy, because each
//    check here is a standalone script) blanks `//` and `/* */` comments —
//    telling strings, templates and regex literals apart so `'https://…'` is not
//    a comment — and in index.html `<!-- … -->` is blanked. So prose like
//    `// was #fff` never counts, and a colour inside a string or template
//    always does. In index.html `&#10;`-style entities are not hex.
//    A literal that must stay (a family's data palette, colour maths that needs
//    real hex) is allowed by:
//      (a) a real comment `/* look: <reason> */` on the same line (in index.html
//          `<!-- look: <reason> -->`). The reason is required: `/* look: */`
//          fails, because an allowance nobody explained is one nobody can
//          review.
//      (b) the same comment on the FIRST line of a multi-line `const`/`let`/
//          `var` declaration whose brackets open on that line: it covers the
//          declaration down to where those brackets close (`];` / `};`). A table
//          is marked once, not per row.
//      (c) a named EXEMPT entry {file, match, why} below, for the few places
//          that cannot carry a comment. An entry that no longer matches a line
//          with a literal FAILS as stale — an exemption that outlives its reason
//          is a hole (the same rule as check-dead-actions.js's EXEMPT).
//
// 3. Looks. When two or more looks are defined (`[data-look="pop"]`,
//    `[data-look="calm"]`, with or without `:root`), every custom property
//    defined in ANY look block must be defined in EVERY look block. A name one
//    look forgets falls back to the base `:root` value — the other look's
//    colour leaking through. With fewer than two looks this rule has nothing to
//    compare and reports itself as dormant.
//
// 4. Text scale. A look may make text bigger or smaller (--text-scale, set by
//    the look block; `var(--text-scale, 1)` where none is), so every font size with an absolute unit (px, rem, pt, pc, cm,
//    mm, in, Q) must multiply it: `calc(0.9rem * var(--text-scale, 1))`. One
//    that does not is text that stays the old size in the new look. em, %,
//    keywords and 0 follow their parent already and are not checked.
//    Scanned: css/app.css `font-size` and `font` declarations outside token
//    blocks and outside `@media print`; in js/*.js and index.html (comment text
//    blanked, as in rule 2) `font-size:` in markup/cssText and
//    `fontSize =` / `fontSize:` in DOM code. The print sheet ignores the look
//    (L12), so its own sizes stay as typed and carry `/* look: <reason> */` on
//    the same line — in css/app.css too, where that mark is read for this rule
//    only. In js/html, (b) and EXEMPT work as in rule 2.
//
// What it knowingly does NOT catch:
//   - Named colours in js/ and index.html (`color:white` in a template string).
//     Words like `red` or `white` are everywhere in JS as data and prose; there
//     were none in a style context when this was written. CSS gets the full
//     named-colour rule because there a word in a declaration value IS a value.
//   - Colours built at runtime (`'#' + hex`, `rgb(${r},…)` split across
//     expressions): it reads text, not values. A template that writes
//     `rgb(${r}, ${g}, ${b})` is still caught, since `rgb(` is in the text.
//   - Whether a token's VALUE is right, or whether text on a colour is
//     readable in both looks — that is the smoke test's and the eye's job.
//   - manifest.json and the `theme-color` meta: static files the browser reads
//     before any CSS, so they cannot read a variable (theme-color is EXEMPT
//     below; manifest.json is not scanned).
//   - Other file types (sw.js, tools/, tests/) — they paint nothing.
//   - A font size whose unit is added away from the assignment
//     (`el.style.fontSize = size`, `size` built elsewhere), or a --token that
//     holds an absolute size read by `font-size: var(--x)` (none do).
// And one thing it can misread: a selector or anchor spelled only in hex
// letters and standing alone (`'#add'`, `href="#bad"`) looks like a colour.
// There were none when this was written; mark one with `/* look: not a colour */`.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CSS_FILE = 'css/app.css';
const HTML_FILE = 'index.html';

/* Literals that cannot carry a `look:` comment, exempt BY NAME with the reason.
   `match` is a substring of the line. An entry that matches no line with a
   literal fails as stale: delete it. */
const EXEMPT = [
  {
    file: 'index.html',
    match: '<meta name="theme-color"',
    why: 'the browser reads theme-color before any CSS loads, so it cannot be a var(); '
       + 'it holds the default look\'s (Pop\'s) --bg, as manifest.json does; applyLook '
       + '(js/05-helpers.js) rewrites it from the live --bg whenever a look is applied',
  },
];

const NAMED = ['aliceblue','antiquewhite','aqua','aquamarine','azure','beige','bisque','black','blanchedalmond','blue','blueviolet','brown','burlywood','cadetblue','chartreuse','chocolate','coral','cornflowerblue','cornsilk','crimson','cyan','darkblue','darkcyan','darkgoldenrod','darkgray','darkgreen','darkgrey','darkkhaki','darkmagenta','darkolivegreen','darkorange','darkorchid','darkred','darksalmon','darkseagreen','darkslateblue','darkslategray','darkslategrey','darkturquoise','darkviolet','deeppink','deepskyblue','dimgray','dimgrey','dodgerblue','firebrick','floralwhite','forestgreen','fuchsia','gainsboro','ghostwhite','gold','goldenrod','gray','green','greenyellow','grey','honeydew','hotpink','indianred','indigo','ivory','khaki','lavender','lavenderblush','lawngreen','lemonchiffon','lightblue','lightcoral','lightcyan','lightgoldenrodyellow','lightgray','lightgreen','lightgrey','lightpink','lightsalmon','lightseagreen','lightskyblue','lightslategray','lightslategrey','lightsteelblue','lightyellow','lime','limegreen','linen','magenta','maroon','mediumaquamarine','mediumblue','mediumorchid','mediumpurple','mediumseagreen','mediumslateblue','mediumspringgreen','mediumturquoise','mediumvioletred','midnightblue','mintcream','mistyrose','moccasin','navajowhite','navy','oldlace','olive','olivedrab','orange','orangered','orchid','palegoldenrod','palegreen','paleturquoise','palevioletred','papayawhip','peachpuff','peru','pink','plum','powderblue','purple','rebeccapurple','red','rosybrown','royalblue','saddlebrown','salmon','sandybrown','seagreen','seashell','sienna','silver','skyblue','slateblue','slategray','slategrey','snow','springgreen','steelblue','tan','teal','thistle','tomato','turquoise','violet','wheat','white','whitesmoke','yellow','yellowgreen'];

// #rgb / #rgba / #rrggbb / #rrggbbaa — not inside a word, an entity (&#10;), a URL
// fragment (…/#add) or an id like #add-row.
const HEX = /(?<![\w&#/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const COLOUR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi;
const NAMED_RE = new RegExp('(?<![\\w#.-])(?:' + NAMED.join('|') + ')(?![\\w-])', 'gi');
const GENERIC_FAMILY = /\b(?:sans-serif|serif|cursive|monospace|fantasy|system-ui)\b/i;
// A font-family (CSS text) or fontFamily (DOM) set to something other than var()/inherit.
const JS_FONT = /(?:font-family\s*:|fontFamily\s*(?:=(?!=)|:))\s*(?![\s'"`]*(?:var\(|inherit\b|\$\{))[^;]/g;
const LOOK_MARK = /^\s*look:\s*([\s\S]*?)\s*$/;
// Rule 4: an absolute length in a font size (a digit or `${…}` before the unit).
const ABS_SIZE = /(?:\d|\})\s*(?:px|rem|pt|pc|cm|mm|in|q)\b/i;
const SCALED = /--text-scale\b/;
// font-size: in markup / cssText — the value runs to the next ; or quote.
const JS_FONT_SIZE = /font-size\s*:\s*([^;"'`\n]*)/gi;
// fontSize = / fontSize: in DOM code — the value runs to the end of the statement.
const JS_FONT_SIZE_DOM = /fontSize\s*(?:=(?!=)|:)\s*([^;\n]*)/g;
const ABS_SIZE_DOM = /(?:[\d}]|['"`])\s*(?:px|rem|pt|pc|cm|mm)\b/i;

const problems = [];
const lineOf = (src, offset) => { let n = 1; for (let i = 0; i < offset; i++) if (src.charCodeAt(i) === 10) n++; return n; };
const blank = (s) => s.replace(/[^\n]/g, ' ');

// ── Rule 1: css/app.css ───────────────────────────────────────────────────
const TOKEN_SELECTOR = /^(?::root(?:\[data-look=(["'])[\w-]+\1\])?|\[data-look=(["'])[\w-]+\2\])$/;
const LOOK_SELECTOR = /^(?::root)?\[data-look=(["'])([\w-]+)\1\]$/;

function literalsInCssValue(value) {
  const masked = value
    .replace(/"[^"]*"|'[^']*'/g, blank)
    .replace(/url\([^)]*\)/gi, blank)
    .replace(/--[\w-]+/g, blank);                 // custom-property NAMES (--accent-green) are not colours
  const found = [];
  for (const re of [HEX, COLOUR_FN, NAMED_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(masked))) found.push(value.slice(m.index, m.index + m[0].length));
  }
  return found;
}

const cssSrc = fs.readFileSync(path.join(ROOT, CSS_FILE), 'utf8');
// Lines carrying `/* look: <reason> */` — read by rule 4 (text scale) only.
const cssMarks = new Set();
for (const m of cssSrc.matchAll(/\/\*([\s\S]*?)\*\//g)) {
  const line = lineOf(cssSrc, m.index);
  if (readMark(CSS_FILE, line, m[1])) cssMarks.add(line);
}
let unscaledKept = 0;
// Strip comments, keeping every newline so offsets map to lines.
const css = cssSrc.replace(/\/\*[\s\S]*?\*\//g, blank);
const looks = new Map();          // look name → Set of custom properties
let cssDecls = 0, tokenBlocks = 0;
{
  const stack = [];               // preludes of the open blocks
  let buf = '', bufStart = -1, quote = null;
  const flushDecl = () => {
    const text = buf.trim();
    const at = bufStart;
    buf = ''; bufStart = -1;
    if (!text || !text.includes(':') || !stack.length) return;
    const colon = text.indexOf(':');
    const prop = text.slice(0, colon).trim().toLowerCase();
    const value = text.slice(colon + 1).trim();
    const selector = stack[stack.length - 1];
    if (selector.startsWith('@')) return;                     // descriptor of an at-rule (@page, @font-face)
    cssDecls++;
    const inToken = TOKEN_SELECTOR.test(selector);
    const look = selector.match(LOOK_SELECTOR);
    if (look && prop.startsWith('--')) {
      if (!looks.has(look[2])) looks.set(look[2], new Set());
      looks.get(look[2]).add(prop);
    }
    if (inToken && prop.startsWith('--')) return;              // the shared value set itself
    const where = `${CSS_FILE}:${lineOf(css, at)}`;
    const ctx = `${selector.replace(/\s+/g, ' ').slice(0, 60)} { ${prop}: ${value.replace(/\s+/g, ' ').slice(0, 70)} }`;
    for (const lit of literalsInCssValue(value)) {
      problems.push({ where, rule: 'css colour', detail: `${lit} in ${ctx}`,
        fix: inToken ? 'only --custom-properties may hold a value in a token block; read it with var(--…)'
                     : 'use var(--token) — add the value to :root under a role name if none fits' });
    }
    if (prop === 'font-family' && !/^(?:var\(--[\w-]+\)|inherit)(?:\s*!important)?$/i.test(value)) {
      problems.push({ where, rule: 'css font', detail: ctx, fix: 'use a font token, var(--font-…), or inherit' });
    }
    if (prop === 'font' && (/["']/.test(value) || GENERIC_FAMILY.test(value.replace(/var\([^)]*\)/g, '')))) {
      problems.push({ where, rule: 'css font', detail: ctx, fix: 'name the family with var(--font-…), not a font name' });
    }
    // Rule 4: an absolute font size multiplies --text-scale.
    if ((prop === 'font-size' || prop === 'font') && !inToken && ABS_SIZE.test(value) && !SCALED.test(value)
        && !stack.some(s => /^@media\s+(?:only\s+)?print\b/i.test(s))) {
      if (cssMarks.has(lineOf(css, at))) unscaledKept++;
      else problems.push({ where, rule: 'text scale', detail: ctx,
        fix: 'write calc(<size> * var(--text-scale, 1)); a print-sheet-only size carries /* look: <reason> */ on its line' });
    }
  };
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) { buf += c; if (c === '\\') { buf += css[++i] || ''; } else if (c === quote) quote = null; continue; }
    if (c === '"' || c === '\'') { quote = c; if (bufStart < 0) bufStart = i; buf += c; continue; }
    if (c === '{') {
      const prelude = buf.trim().replace(/\s+/g, ' ');
      stack.push(prelude);
      if (TOKEN_SELECTOR.test(prelude)) tokenBlocks++;
      buf = ''; bufStart = -1;
      continue;
    }
    if (c === ';') { flushDecl(); continue; }
    if (c === '}') { flushDecl(); stack.pop(); continue; }
    if (bufStart < 0 && !/\s/.test(c)) bufStart = i;
    buf += c;
  }
}

// ── The JS lexer (comments blanked; strings, templates and regexes kept) ──
// Returns { text, code, comments }: text = comments blanked; code = comments,
// string/template text and regexes blanked (brackets are counted on it);
// comments = [{ start, end, body }] for every block comment.
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'yield', 'await']);
function lex(src) {
  const code = src.split('');
  const text = src.split('');
  const comments = [];
  const n = src.length;
  const blankCode = (i) => { if (i < n && code[i] !== '\n') code[i] = ' '; };
  const blankBoth = (i) => { if (i < n && code[i] !== '\n') { code[i] = ' '; text[i] = ' '; } };
  const frames = [];
  let lastChar = '', lastWord = '', i = 0;
  const regexAllowed = () => {
    if (!lastChar) return true;
    if (/[\w$]/.test(lastChar)) return REGEX_AFTER_WORD.has(lastWord);
    return !/[)\]}'"`]/.test(lastChar);
  };
  while (i < n) {
    const top = frames[frames.length - 1];
    const c = src[i];
    if (top === 'tpl') {
      if (c === '\\') { blankCode(i); blankCode(i + 1); i += 2; continue; }
      if (c === '`') { blankCode(i); frames.pop(); lastChar = '`'; lastWord = ''; i++; continue; }
      if (c === '$' && src[i + 1] === '{') { blankCode(i); blankCode(i + 1); frames.push({ depth: 0 }); lastChar = '('; lastWord = ''; i += 2; continue; }
      blankCode(i); i++; continue;
    }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') { blankBoth(i); i++; } continue; }
    if (c === '/' && src[i + 1] === '*') {
      const start = i;
      blankBoth(i); blankBoth(i + 1); i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { blankBoth(i); i++; }
      blankBoth(i); blankBoth(i + 1); i += 2;
      comments.push({ start, end: i, body: src.slice(start + 2, i - 2) });
      continue;
    }
    if (c === '\'' || c === '"') {
      blankCode(i); i++;
      while (i < n && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') { blankCode(i); i++; } blankCode(i); i++; }
      blankCode(i); i++; lastChar = c; lastWord = ''; continue;
    }
    if (c === '`') { blankCode(i); frames.push('tpl'); i++; continue; }
    if (c === '/' && regexAllowed()) {
      blankCode(i); i++;
      let inClass = false;
      while (i < n && src[i] !== '\n') {
        const d = src[i];
        if (d === '\\') { blankCode(i); blankCode(i + 1); i += 2; continue; }
        if (d === '[') inClass = true; else if (d === ']') inClass = false; else if (d === '/' && !inClass) break;
        blankCode(i); i++;
      }
      blankCode(i); i++;
      while (i < n && /[a-z]/.test(src[i])) { blankCode(i); i++; }
      lastChar = ')'; lastWord = ''; continue;
    }
    if (top && top !== 'tpl') {
      if (c === '{') top.depth++;
      else if (c === '}') { if (top.depth === 0) { blankCode(i); frames.pop(); i++; continue; } top.depth--; }
    }
    if (/[\w$]/.test(c)) { let j = i; while (j < n && /[\w$]/.test(src[j])) j++; lastWord = src.slice(i, j); lastChar = src[j - 1]; i = j; continue; }
    if (!/\s/.test(c)) { lastChar = c; lastWord = ''; }
    i++;
  }
  return { text: text.join(''), code: code.join(''), comments };
}

// ── Rule 2: js/*.js and index.html ────────────────────────────────────────
const exemptHits = new Map(EXEMPT.map(x => [x, 0]));
let marksUsed = 0, tablesCovered = 0, scannedFiles = 0, allowedLiterals = 0;

function scanLines(file, rawLines, textLines, marks, covered) {
  textLines.forEach((line, idx) => {
    const found = [];
    for (const re of [HEX, COLOUR_FN]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) found.push(m[0]);
    }
    JS_FONT.lastIndex = 0;
    let f;
    while ((f = JS_FONT.exec(line))) found.push(line.slice(f.index, f.index + 40).trim());
    const n = idx + 1;
    // Rule 4: absolute font sizes multiply --text-scale.
    const sizes = [];
    for (const [re, abs] of [[JS_FONT_SIZE, ABS_SIZE], [JS_FONT_SIZE_DOM, ABS_SIZE_DOM]]) {
      re.lastIndex = 0;
      let s;
      while ((s = re.exec(line))) if (abs.test(s[1]) && !SCALED.test(s[1])) sizes.push(s[0].trim().slice(0, 50));
    }
    if (sizes.length) {
      const ex = EXEMPT.find(x => x.file === file && rawLines[idx].includes(x.match));
      if (marks.has(n) || covered.has(n)) unscaledKept += sizes.length;
      else if (ex) { exemptHits.set(ex, exemptHits.get(ex) + 1); unscaledKept += sizes.length; }
      else problems.push({ where: `${file}:${n}`, rule: 'text scale', detail: `${sizes.join(', ')}   ${rawLines[idx].trim().slice(0, 90)}`,
        fix: 'write calc(<size> * var(--text-scale, 1)); a print-sheet-only size carries a trailing /* look: <reason> */' });
    }
    if (!found.length) return;
    if (marks.has(n) || covered.has(n)) { allowedLiterals += found.length; return; }
    const ex = EXEMPT.find(x => x.file === file && rawLines[idx].includes(x.match));
    if (ex) { exemptHits.set(ex, exemptHits.get(ex) + 1); allowedLiterals += found.length; return; }
    problems.push({ where: `${file}:${n}`, rule: 'typed colour/font', detail: `${found.join(', ')}   ${rawLines[idx].trim().slice(0, 90)}`,
      fix: 'read a var(--token); or, for data/colour maths that must stay, add a trailing /* look: <reason> */' });
  });
}

// A look mark's reason, or a problem when it has none.
function readMark(file, line, body) {
  const m = body.match(LOOK_MARK);
  if (!m) return false;
  if (!m[1]) {
    problems.push({ where: `${file}:${line}`, rule: 'look mark', detail: 'a look: comment with no reason',
      fix: 'say why this literal stays, e.g. /* look: activity palette is family data */' });
    return false;
  }
  return true;
}

for (const name of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).sort()) {
  const file = `js/${name}`;
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const { text, code, comments } = lex(src);
  scannedFiles++;
  const rawLines = src.split('\n');
  const codeLines = code.split('\n');
  const marks = new Set();
  const covered = new Set();
  for (const c of comments) {
    const line = lineOf(src, c.start);
    if (!readMark(file, line, c.body)) continue;
    marks.add(line);
    marksUsed++;
    // (b) the first line of a multi-line declaration covers it to its closing bracket.
    if (!/^\s*(?:export\s+)?(?:const|let|var)\b/.test(rawLines[line - 1])) continue;
    let depth = 0;
    for (const ch of codeLines[line - 1]) { if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--; }
    if (depth <= 0) continue;
    tablesCovered++;
    for (let k = line; k < codeLines.length && depth > 0; k++) {
      covered.add(k + 1);
      for (const ch of codeLines[k]) { if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--; }
    }
  }
  scanLines(file, rawLines, text.split('\n'), marks, covered);
}

{
  const src = fs.readFileSync(path.join(ROOT, HTML_FILE), 'utf8');
  scannedFiles++;
  const marks = new Set();
  const text = src.replace(/<!--([\s\S]*?)-->/g, (whole, body, offset) => {
    const line = lineOf(src, offset);
    if (readMark(HTML_FILE, line, body)) { marks.add(line); marksUsed++; }
    return blank(whole);
  });
  scanLines(HTML_FILE, src.split('\n'), text.split('\n'), marks, new Set());
}

for (const [x, hits] of exemptHits) {
  if (!hits) problems.push({ where: `tests/check-look-tokens.js EXEMPT`, rule: 'stale exemption',
    detail: `${x.file} "${x.match}" no longer matches a line with a colour or font literal`,
    fix: 'delete the entry from EXEMPT — an exemption that outlives its reason is a hole' });
}

// ── Rule 3: every look defines every look token ───────────────────────────
let looksNote;
if (looks.size < 2) {
  looksNote = `looks rule dormant (${looks.size} look block name(s): ${[...looks.keys()].join(', ') || 'none'})`;
} else {
  const all = new Set();
  for (const names of looks.values()) names.forEach(n => all.add(n));
  for (const [look, names] of looks) {
    const missing = [...all].filter(n => !names.has(n)).sort();
    if (missing.length) problems.push({ where: `${CSS_FILE} [data-look="${look}"]`, rule: 'look missing token',
      detail: `${missing.length} token(s) another look defines: ${missing.join(', ')}`,
      fix: `define each in the ${look} look — a missing one shows the base :root value in this look` });
  }
  looksNote = `${looks.size} looks (${[...looks.keys()].join(', ')}) define the same ${all.size} token(s)`;
}

if (!problems.length) {
  console.log(`OK  ${cssDecls} css declarations checked, colours and fonts only in ${tokenBlocks} token block(s); `
    + `${scannedFiles} js/html file(s) clean — ${allowedLiterals} literal(s) kept by ${marksUsed} look: mark(s) `
    + `(${tablesCovered} table(s)) and ${EXEMPT.length} exemption(s); every absolute font size multiplies --text-scale `
    + `(${unscaledKept} print-only size(s) kept by look: marks); ${looksNote}`);
  process.exit(0);
}
console.error(`FAIL  ${problems.length} typed colour/font/size problem(s):\n`);
for (const p of problems) {
  console.error(`  ${p.where}  [${p.rule}]`);
  console.error(`      ${p.detail}`);
  console.error(`      ${p.fix}\n`);
}
console.error('A colour, font or unscaled font size typed outside the shared value set stays in the old look when the family switches.');
process.exit(1);
