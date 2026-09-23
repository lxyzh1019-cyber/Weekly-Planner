// Weekly-Planner — dead action guard.
//
// Fails when a control is drawn with no code behind it. Two shapes, both of
// which this repo has shipped:
//
//   1 · An `onclick="fn(…)"` whose `fn` is declared nowhere. The button draws,
//       takes the tap, and throws a ReferenceError a child never sees.
//   2 · A `data-P-action="V"` whose value V is not handled by prefix P's OWN
//       dispatcher. The button draws and the tap does nothing at all — the
//       three inert profile badges and the dead ✏️ branch were both this.
//
// Why rule 2 is scoped per prefix: "does the literal 'V' appear anywhere in
// js/" is wrong in both directions. It flags values that ARE handled through a
// selector (`closest('[data-mny-action="dep-day"]')`), and it passes a dead
// `data-pm-action="edit"` because some OTHER prefix handles an 'edit'. A value
// counts as handled only by the code that reads its own prefix.
//
// How "the code that reads prefix P" is found: every js/ file is lexed —
// strings, template literals (with their `${…}` code), comments and regex
// literals told apart — so braces inside a string or a comment do not count.
// The file is then cut into its TOP-LEVEL units (a function declaration, a
// `const x = …`). A unit READS P when it contains `dataset.<p>Action` or the
// quoted attribute name 'data-P-action'. The action variable it reads into
// (`const a = el.getAttribute('data-mm-action')`) is followed one call deep and
// onward: a unit that passes it to another function (`reflHandleAction(a, …)`)
// makes that function a reader too.
//
// V is handled when either:
//   a) the selector `[data-P-action="V"]` appears in js/, or
//   b) inside a P reader, V is compared or keyed: `=== 'V'`, `== 'V'`,
//      `case 'V'`, `'V':`, `['V']`.
// A prefix nothing reads fails outright, naming every value it emits.
//
// Values built at runtime (`data-rc-action="${action}"`) are resolved where
// they can be: a quoted literal inside the `${…}`, or — when the expression is
// a parameter of the function drawing it — the literal passed at every call
// site. What cannot be resolved is counted and printed, not guessed.
//
// The reverse — a value a P reader compares against that no markup emits — is
// dead handler code, but a value may be built at runtime where no scan can see
// it, so it WARNS and does not fail. It only counts comparisons against the
// action itself (`a === 'V'`), not every string compared in the function.
//
// If this fires on a control you are about to wire, wire it in the same change.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* A known dead control, exempt BY NAME with its reason. An exemption expires:
   once the value is no longer emitted anywhere, this check fails and says to
   delete the entry — an exemption that outlives its reason is a hole. */
const EXEMPT = [
  { prefix: 'pm', value: 'edit',
    why: 'unreachable branch in pmPriceCards (editable=false at its only caller); removal belongs to HANDOFF-pocket-money.md §2' },
];

// ── The lexer ─────────────────────────────────────────────────────────────
// Returns two views of the source, the same length and with every newline in
// place so an offset means the same thing in both:
//   code — comments, string/template TEXT and regex literals blanked; the code
//          inside a template's `${…}` is kept. Nesting is measured on this.
//   text — comments blanked only. Strings are searched on this.
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'yield', 'await']);
function lex(src) {
  const code = src.split('');
  const text = src.split('');
  const n = src.length;
  const blankCode = (i) => { if (code[i] !== '\n') code[i] = ' '; };
  const blankBoth = (i) => { if (code[i] !== '\n') { code[i] = ' '; text[i] = ' '; } };
  const frames = [];               // 'tpl' | { depth } for a template's ${ … }
  let lastChar = '';               // last significant code character
  let lastWord = '';               // the identifier that character ended, if any
  let i = 0;
  const regexAllowed = () => {
    if (!lastChar) return true;
    if (/[\w$]/.test(lastChar)) return REGEX_AFTER_WORD.has(lastWord);
    return !/[)\]}'"`]/.test(lastChar);   // after a value, `/` divides
  };
  while (i < n) {
    const top = frames[frames.length - 1];
    const c = src[i];
    if (top === 'tpl') {
      if (c === '\\') { blankCode(i); blankCode(i + 1); i += 2; continue; }
      if (c === '`') { blankCode(i); frames.pop(); lastChar = '`'; lastWord = ''; i++; continue; }
      if (c === '$' && src[i + 1] === '{') {
        blankCode(i); blankCode(i + 1); frames.push({ depth: 0 }); lastChar = '('; lastWord = ''; i += 2; continue;
      }
      blankCode(i); i++; continue;
    }
    // code (top level, or inside a template's ${ … })
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') { blankBoth(i); i++; }
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      blankBoth(i); blankBoth(i + 1); i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { blankBoth(i); i++; }
      blankBoth(i); blankBoth(i + 1); i += 2;
      continue;
    }
    if (c === '\'' || c === '"') {
      blankCode(i); i++;
      while (i < n && src[i] !== c && src[i] !== '\n') {
        if (src[i] === '\\') { blankCode(i); i++; }
        blankCode(i); i++;
      }
      blankCode(i); i++;
      lastChar = c; lastWord = '';
      continue;
    }
    if (c === '`') { blankCode(i); frames.push('tpl'); i++; continue; }
    if (c === '/' && regexAllowed()) {
      blankCode(i); i++;
      let inClass = false;
      while (i < n && src[i] !== '\n') {
        const d = src[i];
        if (d === '\\') { blankCode(i); blankCode(i + 1); i += 2; continue; }
        if (d === '[') inClass = true;
        else if (d === ']') inClass = false;
        else if (d === '/' && !inClass) break;
        blankCode(i); i++;
      }
      blankCode(i); i++;
      while (i < n && /[a-z]/.test(src[i])) { blankCode(i); i++; }
      lastChar = ')'; lastWord = '';   // a regex is a value, like a closing paren
      continue;
    }
    if (top && top !== 'tpl') {
      if (c === '{') top.depth++;
      else if (c === '}') {
        if (top.depth === 0) { blankCode(i); frames.pop(); i++; continue; }
        top.depth--;
      }
    }
    if (/[\w$]/.test(c)) {
      let j = i;
      while (j < n && /[\w$]/.test(src[j])) j++;
      lastWord = src.slice(i, j); lastChar = src[j - 1]; i = j; continue;
    }
    if (!/\s/.test(c)) { lastChar = c; lastWord = ''; }
    i++;
  }
  return { code: code.join(''), text: text.join('') };
}

// Nesting depth before each offset of a code view, over ( [ {.
function nestingOf(code) {
  const depth = new Int32Array(code.length + 1);
  let d = 0;
  for (let i = 0; i < code.length; i++) {
    depth[i] = d;
    const c = code[i];
    if (c === '(' || c === '[' || c === '{') d++;
    else if (c === ')' || c === ']' || c === '}') d--;
  }
  depth[code.length] = d;
  return depth;
}

// The top-level units of a file: [start, end) ranges with a name when the unit
// declares one. A unit ends at a closer that returns nesting to zero, at a `;`
// at nesting zero, or where a new declaration keyword starts a line at zero
// (a missing semicolon must not merge two declarations into one unit).
const DECL_AT = /^(?:async\s+function\b|function\b|const\b|let\b|var\b)/;
function unitsOf(code, text, depth) {
  const units = [];
  let start = -1;
  const close = (end) => {
    if (start < 0) return;
    const head = text.slice(start, Math.min(end, start + 200));
    const m = head.match(/^(?:async\s+)?function\s*\*?\s*([\w$]+)/) || head.match(/^(?:const|let|var)\s+([\w$]+)/);
    units.push({ start, end, name: m ? m[1] : null });
    start = -1;
  };
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (depth[i] === 0 && start >= 0 && /[a-z]/.test(c)
        && /\n[ \t]*$/.test(code.slice(Math.max(0, i - 80), i))
        && DECL_AT.test(code.slice(i, i + 20))) {
      close(i);
    }
    if (start < 0) {
      if (/\s|;/.test(c)) continue;
      start = i;
    }
    if (depth[i] === 0 && c === ';') { close(i + 1); continue; }
    if (c === '}' && depth[i + 1] === 0) {
      // `} else {` / `}.bind(…)` / `}, …` keep going; otherwise this unit is done.
      const rest = code.slice(i + 1, i + 40).replace(/^\s+/, '');
      if (/^(else\b|catch\b|finally\b|[.,(\[?:+\-*\/&|])/.test(rest)) continue;
      close(i + 1);
    }
  }
  close(code.length);
  return units;
}

// Every name declared at the top level of js/: function, async function, and
// const/let/var including the comma-separated form.
function topLevelNames(code, depth) {
  const names = new Set();
  const re = /(?<![\w$.])(async\s+function\s*\*?|function\s*\*?|const|let|var)\s+([\w$]+)/g;
  let m;
  while ((m = re.exec(code))) {
    if (depth[m.index] !== 0) continue;
    names.add(m[2]);
    if (/function/.test(m[1])) continue;
    // Further names in `let a = 1, b = 2;` — commas at the same nesting.
    for (let i = m.index + m[0].length; i < code.length; i++) {
      if (depth[i] !== 0) continue;
      const c = code[i];
      if (c === ';') break;
      if (c === '\n' && DECL_AT.test(code.slice(i + 1).replace(/^\s+/, ''))) break;
      if (c === ',') {
        const nm = code.slice(i + 1, i + 80).match(/^\s*([\w$]+)/);
        if (nm) names.add(nm[1]);
      }
    }
  }
  return names;
}

// ── Load the source ───────────────────────────────────────────────────────
const files = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).sort().map(f => {
  const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
  const { code, text } = lex(src);
  const depth = nestingOf(code);
  return { file: 'js/' + f, src, code, text, depth, units: unitsOf(code, text, depth) };
});
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
const lineOf = (s, i) => s.slice(0, i).split('\n').length;

const declared = new Set();
files.forEach(f => topLevelNames(f.code, f.depth).forEach(n => declared.add(n)));

/* The value of an attribute that opens at `from` (just past its `"`), read to
   the closing quote. Inside a template the value may hold `${ … }`, which may
   itself hold quotes and nested templates, so those are skipped as a unit. */
function attrValue(s, from) {
  const interps = [];
  let i = from;
  while (i < s.length && s[i] !== '"') {
    if (s[i] === '$' && s[i + 1] === '{') {
      const st = i;
      let d = 0, q = null;
      for (i += 2; i < s.length; i++) {
        const c = s[i];
        if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
        if (c === '\'' || c === '"' || c === '`') { q = c; continue; }
        if (c === '{') d++;
        else if (c === '}') { if (d === 0) break; d--; }
      }
      interps.push({ at: st - from, expr: s.slice(st + 2, i) });
      i++;
      continue;
    }
    i++;
  }
  return { raw: s.slice(from, i), interps, end: i };
}

// ── Rule 1 · every function an onclick calls is declared ──────────────────
const KEYWORDS = new Set(['if', 'else', 'return', 'function', 'typeof', 'void', 'new', 'while', 'for', 'switch', 'catch', 'do', 'delete', 'in', 'of', 'await']);
const BROWSER = new Set(['alert', 'confirm', 'prompt', 'print', 'open', 'close', 'focus', 'blur', 'scrollTo', 'fetch', 'requestAnimationFrame']);
const isGlobal = (name) => BROWSER.has(name) || name in globalThis;

const onclickProblems = [];
let onclickCalls = 0;
const onclickNames = new Set();
let onclickDynamic = 0;
const scanOnclicks = (s, where) => {
  const re = /\sonclick="/g;
  let m;
  while ((m = re.exec(s))) {
    const v = attrValue(s, m.index + m[0].length);
    // Interpolations become a placeholder; one sitting where a callee goes is a
    // name built at runtime (`${fn}(…)`), which no scan can resolve.
    let handler = v.raw;
    for (const ip of [...v.interps].reverse()) {
      handler = handler.slice(0, ip.at) + '\u0000' + handler.slice(ip.at + ip.expr.length + 3);
    }
    handler = handler.replace(/'(?:\\.|[^'\\])*'/g, "''");
    onclickDynamic += (handler.match(/\u0000\s*\(/g) || []).length;
    for (const c of handler.matchAll(/(?<![.\w$\u0000])([A-Za-z_$][\w$]*)\s*\(/g)) {
      const name = c[1];
      if (KEYWORDS.has(name) || isGlobal(name)) continue;
      onclickCalls++;
      onclickNames.add(name);
      if (!declared.has(name)) onclickProblems.push(`${where(m.index)}  onclick calls ${name}(), which nothing in js/ declares`);
    }
  }
};
scanOnclicks(html, i => `index.html:${lineOf(html, i)}`);
files.forEach(f => scanOnclicks(f.text, i => `${f.file}:${lineOf(f.src, i)}`));

// ── Rule 2 · every data-P-action value is handled by P's reader ───────────
const camel = (p) => p + 'Action';               // data-mny-action → dataset.mnyAction
const emitted = new Map();                        // prefix → Map(value → [where])
let dynamicUnresolved = 0;
const addEmit = (p, v, where) => {
  if (!emitted.has(p)) emitted.set(p, new Map());
  const byV = emitted.get(p);
  if (!byV.has(v)) byV.set(v, []);
  byV.get(v).push(where);
};

/* The innermost function around offset `at` whose parameter list names
   `param`, as { name, index, file }. Declarations and arrow consts both. */
function enclosingParamOwner(f, at, param) {
  const heads = [];
  const re = /(?:function\s+([\w$]+)\s*\(([^)]*)\)|(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?(?:\(([^)]*)\)|([\w$]+))\s*=>)/g;
  let m;
  while ((m = re.exec(f.code)) && m.index < at) {
    const name = m[1] || m[3];
    const params = (m[2] != null ? m[2] : (m[4] != null ? m[4] : m[5])).split(',').map(s => s.trim().replace(/\s*=.*$/, ''));
    const index = params.indexOf(param);
    if (index < 0) continue;
    // Its extent: the body after the head, to the point nesting drops below it.
    const bodyFrom = m.index + m[0].length;
    const base = f.depth[m.index];
    let end = bodyFrom;
    let seenOpen = false;
    for (; end < f.code.length; end++) {
      const c = f.code[end];
      if (f.depth[end + 1] > base) seenOpen = true;
      if (f.depth[end + 1] < base) break;
      if (f.depth[end + 1] === base && seenOpen && c === '}' && m[1]) break;
      if (f.depth[end] === base && !m[1] && /[;,)]/.test(c)) break;
    }
    if (at < end) heads.push({ name, index, start: m.index });
  }
  return heads.length ? heads[heads.length - 1] : null;
}

// Arguments of a call whose `(` is at `open`, split at top-level commas.
function callArgs(s, open) {
  const args = [];
  let d = 0, q = null, st = open + 1;
  for (let i = open + 1; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '\'' || c === '"' || c === '`') { q = c; continue; }
    if (c === '(' || c === '[' || c === '{') d++;
    else if (c === ')' || c === ']' || c === '}') {
      if (d === 0) { args.push(s.slice(st, i).trim()); return args; }
      d--;
    } else if (c === ',' && d === 0) { args.push(s.slice(st, i).trim()); st = i + 1; }
  }
  return args;
}

for (const f of files) {
  const re = /data-([a-z]+)-action="/g;
  let m;
  while ((m = re.exec(f.text))) {
    // An attribute SELECTOR is a read, not an emission.
    if (f.text[m.index - 1] === '[') continue;
    const p = m[1];
    const v = attrValue(f.text, m.index + m[0].length);
    const where = `${f.file}:${lineOf(f.src, m.index)}`;
    if (!v.interps.length) { addEmit(p, v.raw, where); continue; }
    if (v.interps.length !== 1 || v.raw.length !== v.interps[0].expr.length + 3) { dynamicUnresolved++; continue; }
    const expr = v.interps[0].expr.trim();
    const literals = [...expr.matchAll(/'([^'\\]*)'/g)].map(x => x[1]);
    literals.forEach(x => addEmit(p, x, where));
    // What is left once the literals are gone, stripped of an escaping wrapper.
    const bare = expr.replace(/^escape(?:Attr|Html)\((.*)\)$/, '$1').replace(/\s*\|\|\s*'[^']*'$/, '').trim();
    if (literals.length && !/^[\w$.]+$/.test(bare)) continue;           // a ternary of literals: all resolved
    if (!/^[\w$]+$/.test(bare)) { dynamicUnresolved++; continue; }     // r.action, b.action: runtime data
    const owner = enclosingParamOwner(f, m.index, bare);
    if (!owner) { dynamicUnresolved++; continue; }
    // Every call site of the owner: a literal at the parameter's position is an emitted value.
    let resolvedAll = true, sites = 0;
    for (const g of files) {
      const cre = new RegExp(`(?<![\\w$.])${owner.name.replace(/\$/g, '\\$')}\\s*\\(`, 'g');
      let c;
      while ((c = cre.exec(g.text))) {
        if (/function\s*$/.test(g.text.slice(Math.max(0, c.index - 12), c.index))) continue;
        const arg = callArgs(g.text, c.index + c[0].length - 1)[owner.index];
        if (arg === undefined) continue;
        sites++;
        const lit = arg.match(/^'([^'\\]*)'$/);
        if (lit) addEmit(p, lit[1], `${g.file}:${lineOf(g.src, c.index)}`);
        else resolvedAll = false;
      }
    }
    if (!sites || !resolvedAll) dynamicUnresolved++;
  }
}

// Readers: units that read the prefix, plus the functions they hand the action to.
const unitByName = new Map();
files.forEach(f => f.units.forEach(u => { if (u.name) unitByName.set(u.name, { f, u }); }));
const readers = new Map();                        // prefix → [{ f, u, vars:Set }]
const addReader = (p, f, u, v) => {
  if (!readers.has(p)) readers.set(p, []);
  const list = readers.get(p);
  let r = list.find(x => x.u === u);
  if (!r) { r = { f, u, vars: new Set() }; list.push(r); }
  if (v && !r.vars.has(v)) { r.vars.add(v); return true; }
  return false;
};
for (const p of emitted.keys()) {
  const readExpr = new RegExp(`dataset\\.${camel(p)}\\b|getAttribute\\(\\s*(['"])data-${p}-action\\1\\s*\\)`);
  const assign = new RegExp(`(?:const|let|var)\\s+([\\w$]+)\\s*=\\s*[\\w$.]*?(?:dataset\\.${camel(p)}\\b|getAttribute\\(\\s*(['"])data-${p}-action\\2\\s*\\))`, 'g');
  const queue = [];
  for (const f of files) {
    for (const u of f.units) {
      const body = f.text.slice(u.start, u.end);
      if (!readExpr.test(body) && !new RegExp(`(['"])data-${p}-action\\1`).test(body)) continue;
      addReader(p, f, u, null);
      for (const a of body.matchAll(assign)) if (addReader(p, f, u, a[1])) queue.push({ f, u, v: a[1] });
    }
  }
  // Follow the action variable into the functions it is handed to.
  while (queue.length) {
    const { f, u, v } = queue.shift();
    const body = f.text.slice(u.start, u.end);
    for (const c of body.matchAll(/(?<![\w$.])([\w$]+)\s*\(/g)) {
      if (KEYWORDS.has(c[1]) || !unitByName.has(c[1])) continue;
      const args = callArgs(body, c.index + c[0].length - 1);
      const idx = args.findIndex(a => a === v);
      if (idx < 0) continue;
      const target = unitByName.get(c[1]);
      const head = target.f.text.slice(target.u.start, target.u.end).match(/^[^(]*\(([^)]*)\)/);
      const param = head && head[1].split(',').map(s => s.trim().replace(/\s*=.*$/, ''))[idx];
      if (param && addReader(p, target.f, target.u, param)) queue.push({ f: target.f, u: target.u, v: param });
    }
  }
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const allText = files.map(f => f.text).join('\n');
const handled = (p, v) => {
  if (allText.includes(`[data-${p}-action="${v}"]`) || allText.includes(`[data-${p}-action='${v}']`)) return true;
  const q = `(['"])${esc(v)}\\1`;
  const re = new RegExp(`(?:[!=]==?\\s*${q})|(?:${q}\\s*[!=]==?)|(?:\\bcase\\s+${q})|(?:${q}\\s*:)|(?:\\[\\s*${q}\\s*\\])`);
  return (readers.get(p) || []).some(r => re.test(r.f.text.slice(r.u.start, r.u.end)));
};

const actionProblems = [];
const exemptUsed = [];
let actionCount = 0;
for (const x of EXEMPT) {
  if (!(emitted.get(x.prefix) || new Map()).has(x.value)) {
    actionProblems.push(`the exemption for ${x.prefix}/${x.value} has expired — nothing emits data-${x.prefix}-action="${x.value}" any more. Delete it from EXEMPT in tests/check-dead-actions.js.`);
  }
}
for (const [p, byV] of [...emitted.entries()].sort()) {
  const isExempt = (v) => EXEMPT.some(x => x.prefix === p && x.value === v);
  // A prefix is read by a reader unit, or by a selector naming one of its values
  // (`closest('[data-pa-action="pin"]')` is how data-pa-action is read).
  const bySelector = allText.includes(`[data-${p}-action="`) || allText.includes(`[data-${p}-action='`);
  if (!readers.has(p) && !bySelector) {
    const live = [...byV.keys()].filter(v => !isExempt(v));
    [...byV.keys()].filter(isExempt).forEach(v => exemptUsed.push(`${p}/${v}`));
    actionCount += byV.size;
    if (live.length) {
      actionProblems.push(`data-${p}-action is read by nothing in js/ — no dataset.${camel(p)}, no getAttribute('data-${p}-action'). It emits: `
        + live.map(v => `"${v}" (${byV.get(v)[0]})`).join(', '));
    }
    continue;
  }
  for (const [v, where] of byV) {
    actionCount++;
    if (isExempt(v)) { exemptUsed.push(`${p}/${v}`); continue; }
    if (!handled(p, v)) {
      const names = (readers.get(p) || []).map(r => r.u.name || '?').join(', ') || `only [data-${p}-action="…"] selectors`;
      actionProblems.push(`${where[0]}  data-${p}-action="${v}" — no reader of data-${p}-action handles "${v}" (readers: ${names})`);
    }
  }
}

// ── The reverse, as a warning: compared in a P reader, emitted by nothing ──
const warnings = [];
for (const [p, list] of readers) {
  const byV = emitted.get(p) || new Map();
  for (const r of list) {
    const body = r.f.text.slice(r.u.start, r.u.end);
    for (const v of r.vars) {
      const re = new RegExp(`(?<![\\w$.])${esc(v)}\\s*[!=]==?\\s*'([^'\\\\]*)'|'([^'\\\\]*)'\\s*[!=]==?\\s*${esc(v)}(?![\\w$])`, 'g');
      for (const c of body.matchAll(re)) {
        const val = c[1] != null ? c[1] : c[2];
        if (!byV.has(val) && !warnings.some(w => w.p === p && w.val === val)) {
          warnings.push({ p, val, where: `${r.f.file}:${lineOf(r.f.src, r.u.start + c.index)}`, fn: r.u.name });
        }
      }
    }
  }
}

const problems = onclickProblems.concat(actionProblems);
const prefixCount = emitted.size;
const exemptNote = exemptUsed.length ? ` (${exemptUsed.length} exempted: ${exemptUsed.join(', ')})` : '';
const dynNote = `${onclickDynamic} onclick callee(s) and ${dynamicUnresolved} action value(s) built at runtime, not checkable`;
if (warnings.length) {
  console.log(`WARN  ${warnings.length} value(s) compared in an action reader that no markup emits — dead handler code, or built at runtime where this cannot see:`);
  warnings.forEach(w => console.log(`  ${w.where}  ${w.fn}: data-${w.p}-action "${w.val}"`));
}
if (!problems.length) {
  console.log(`OK  ${onclickCalls} onclick calls (${onclickNames.size} distinct functions), ${actionCount} actions across ${prefixCount} prefixes, all handled${exemptNote}; ${dynNote}; ${warnings.length} reverse warning(s)`);
  process.exit(0);
}
console.error(`FAIL  ${problems.length} control(s) with no code behind them:\n`);
problems.forEach(p => console.error('  ' + p));
console.error('\nA control that draws and does nothing is a tap a child learns to distrust.');
console.error('Declare the function, handle the value in its own prefix\'s dispatcher, or remove the control.');
process.exit(1);
