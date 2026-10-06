// Weekly-Planner — money words check.
//
// Why this exists: the money screens were reworded more than once (Prizes →
// Competitions, "meet" → competition, cash as a place → 📥 Waiting for Sunday,
// no parent named), and each time an old word survived somewhere nobody looked.
// A raw "{lockWeeks}" reached a child's screen the same way. So the words the
// family retired, and a `{word}` placeholder nobody filled, fail the build.
//
// What is scanned (case-insensitive):
//   - js/*.js: the TEXT of string literals and templates only. Comments are
//     blanked and code is blanked (the same small lexer as check-dead-actions.js;
//     a copy, because each check here is a standalone script), so identifiers
//     and comments never match. Inside strings, a word joined to a hyphen or
//     underscore (`rq-meet`, `sd-dad`, a class or an action) and a whole quoted
//     lowercase key (`kind: 'meet'`, `'meet:' + day`, `data-sd-kind="meet"`) are data, not words
//     a child reads, and do not match.
//   - index.html: visible text — comments, <script> and <style> bodies and the
//     tags themselves (attributes included) are blanked.
//
// The words:
//   dad                      — a parent is "a parent" / "your parents" on screen.
//   meet, meets              — "Competitions" (PR 2); "swim meet" is the sport's
//                              own word and passes.
//   prizes                   — "Competitions" (Plan v13).
//   stocks                   — "Companies".
//   locking money            — "Locked away".
//   everything i have        — "What I own".
//   in cash, cash right now  — cash as a place; it is "📥 Waiting for Sunday".
//                              "Cash out", "Put cash in", "Cash from home" and
//                              the "Cash in" request kind never match.
//   {word}                   — a placeholder no code filled. `${x}` (a template
//                              hole) is not one. In js/21-money-data.js,
//                              mnyConceptSwap's own source is skipped, and
//                              inside MNY_CONCEPTS (the data it fills) the words
//                              its own regex fills are allowed — read from that
//                              regex, so a new placeholder it does not fill fails.
//
// Allowances are BY NAME: ALLOW (a word that is right where it is) and EXEMPT
// (a known hit that a later PR fixes). Each is {file, text, word, why}: `text`
// is a substring of the source line, `word` the pattern's name. An entry that
// no longer matches a hit FAILS as stale — an allowance that outlives its
// reason is a hole (the same rule as check-dead-actions.js's EXEMPT).
//
// What it knowingly does NOT catch: words built at runtime from pieces
// ('D' + 'ad'), words in attributes of index.html (placeholder, aria-label,
// title), and other files (css content:, sw.js, tests/) — they hold no money
// words today.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML_FILE = 'index.html';

const WORDS = [
  { word: 'dad', re: /\bdad\b/gi },
  { word: 'meet', re: /\bmeets?\b/gi, skip: (before) => /\bswim\s+$/i.test(before) },
  { word: 'prizes', re: /\bprizes\b/gi },
  { word: 'stocks', re: /\bstocks\b/gi },
  { word: 'locking money', re: /\blocking money\b/gi },
  { word: 'everything i have', re: /\beverything i have\b/gi },
  { word: 'cash as a place', re: /\bin cash\b|\bcash right now\b/gi },
  { word: 'placeholder', re: /(?<![$\w])\{[A-Za-z_]\w*\}/g },
];

/* Words that are right where they are. */
const ALLOW = [
  { file: 'js/46-grownups.js', text: "['Mom', 'Dad'].map(", word: 'dad',
    why: 'the fines form\'s "Logged by" choice: which parent logged the fine is the record itself' },
  { file: 'js/46-grownups.js', text: "who: 'Dad' };", word: 'dad',
    why: 'the fines form\'s default "Logged by" value (data, one of the two choices above)' },
  { file: 'js/46-grownups.js', text: "guFine().who = id === 'Mom' ? 'Mom' : 'Dad';", word: 'dad',
    why: 'the fines form stores the chosen "Logged by" value (data)' },
  { file: 'js/10-social.js', text: 'it is your meet, not hers', word: 'meet',
    why: 'Social: a parent\'s own competition she watches, not money and not her competition' },
  { file: 'js/45-requests.js', text: 'up to 4 at one meet', word: 'meet',
    why: 'the swim request\'s race picker: a swim meet, kept deliberately in PR 2' },
];

/* Known hits a later PR fixes — each goes when its words change. */
const EXEMPT = [
  { file: 'js/21-money-data.js', text: "title: 'Locking money away' }", word: 'locking money', why: 'PR 4 (MNY_STAGES titles)' },
  { file: 'js/21-money-data.js', text: "title: 'Trying it with stocks' }", word: 'stocks', why: 'PR 4 (MNY_STAGES titles)' },
  { file: 'js/21-money-data.js', text: "title: 'Locking money away for {lockWeeks} weeks'", word: 'locking money', why: 'PR 4 (Money school concept titles)' },
  { file: 'js/21-money-data.js', text: "where: 'Everything I have'", word: 'everything i have', why: 'PR 4 (the tour: "What I own")' },
  { file: 'js/06-quests.js', text: '<span>Everything I have</span>', word: 'everything i have', why: 'PR 4 (mnyQuestSummary is removed)' },
  { file: 'js/42-flow.js', text: 'in cash right now.', word: 'cash as a place', why: 'PR 4 (the Flow\'s sentences → 📥 Waiting for Sunday)' },
  { file: 'js/24-money-parent.js', text: 'To correct a meet, change the meet itself.', word: 'meet', why: 'PR 4 (found by this check: the defaulted-row refusal → "competition")' },
  { file: 'js/45-requests.js', text: "showToast('Which meet was it?')", word: 'meet', why: 'PR 4 (found by this check: the competition request\'s toast → "Which competition was it?")' },
];

// ── The lexer: a copy of check-dead-actions.js's ──
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

const problems = [];
const allowHits = new Map(ALLOW.map(x => [x, 0]));
const exemptHits = new Map(EXEMPT.map(x => [x, 0]));
let scanned = 0, allowed = 0, exempted = 0, swapped = 0;

function scan(file, rawLines, strLines, skipLines, fills) {
  strLines.forEach((line, idx) => {
    if (skipLines && skipLines.has(idx + 1)) return;
    for (const w of WORDS) {
      w.re.lastIndex = 0;
      let m;
      while ((m = w.re.exec(line))) {
        if (w.skip && w.skip(line.slice(0, m.index))) continue;
        const raw = rawLines[idx];
        const pre = raw[m.index - 1] || '', post = raw[m.index + m[0].length] || '';
        if (/[\w-]/.test(pre) || /[\w-]/.test(post)) continue;               // rq-meet, sd-dad, meet_x
        if (/['"`]/.test(pre) && /['"`:]/.test(post)
            && m[0] === m[0].toLowerCase() && !/\s/.test(m[0])) continue;   // a lowercase key: 'meet', "meet", 'meet:'
        if (w.word === 'placeholder' && fills && fills.lines.has(idx + 1) && fills.words.has(m[0].slice(1, -1))) { swapped++; continue; }
        const a = ALLOW.find(x => x.file === file && x.word === w.word && raw.includes(x.text));
        if (a) { allowHits.set(a, allowHits.get(a) + 1); allowed++; continue; }
        const e = EXEMPT.find(x => x.file === file && x.word === w.word && raw.includes(x.text));
        if (e) { exemptHits.set(e, exemptHits.get(e) + 1); exempted++; continue; }
        problems.push({ where: `${file}:${idx + 1}`, word: w.word, found: m[0], line: raw.trim().slice(0, 110) });
      }
    }
  });
}

// js/*.js — string and template text only: where the code view is blank and
// the text view is not.
for (const name of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).sort()) {
  const file = `js/${name}`;
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const { code, text } = lex(src);
  let str = '';
  for (let i = 0; i < src.length; i++) str += (text[i] === '\n') ? '\n' : (code[i] === ' ' ? text[i] : ' ');
  const rawLines = src.split('\n');
  // mnyConceptSwap's own source holds the placeholders it fills.
  let skip = null, fills = null;
  if (file === 'js/21-money-data.js') {
    const words = (src.match(/function mnyConceptSwap[\s\S]*?\\\{\(([\w|]+)\)\\\}/) || [])[1];
    const c0 = rawLines.findIndex(l => /^const MNY_CONCEPTS = \[/.test(l));
    const c1 = c0 < 0 ? -1 : rawLines.findIndex((l, k) => k > c0 && /^\];/.test(l));
    if (!words || c1 < 0) problems.push({ where: file, word: 'placeholder', found: 'MNY_CONCEPTS', line: 'mnyConceptSwap\'s regex or MNY_CONCEPTS not found: update check-money-words.js' });
    else {
      fills = { words: new Set(words.split('|')), lines: new Set() };
      for (let k = c0; k <= c1; k++) fills.lines.add(k + 1);
    }
    const at = rawLines.findIndex(l => /^function mnyConceptSwap\(/.test(l));
    if (at < 0) problems.push({ where: file, word: 'placeholder', found: 'mnyConceptSwap', line: 'mnyConceptSwap not found: the check cannot skip its source; update check-money-words.js' });
    else {
      skip = new Set();
      for (let k = at; k < rawLines.length; k++) { skip.add(k + 1); if (/^\}/.test(rawLines[k])) break; }
    }
  }
  scan(file, rawLines, str.split('\n'), skip, fills);
  scanned++;
}

// index.html — visible text only.
{
  const src = fs.readFileSync(path.join(ROOT, HTML_FILE), 'utf8');
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  const vis = src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, blank)
    .replace(/<[^>]*>/g, blank);
  scan(HTML_FILE, src.split('\n'), vis.split('\n'), null, null);
  scanned++;
}

for (const [list, hits, name] of [[ALLOW, allowHits, 'ALLOW'], [EXEMPT, exemptHits, 'EXEMPT']]) {
  for (const x of list) if (!hits.get(x)) problems.push({ where: `tests/check-money-words.js ${name}`, word: x.word, found: 'stale',
    line: `${x.file} "${x.text}" no longer has a "${x.word}" hit — delete the entry` });
}

if (!problems.length) {
  console.log(`OK  ${scanned} js/html file(s): no retired money word and no unfilled {placeholder} on screen — `
    + `${allowed} allowed by ${ALLOW.length} named allowance(s), ${swapped} concept placeholder(s) mnyConceptSwap fills, ${exempted} known hit(s) left for PR 4 (${EXEMPT.length} exemption(s))`);
  process.exit(0);
}
console.error(`FAIL  ${problems.length} money word problem(s):\n`);
for (const p of problems) console.error(`  ${p.where}  [${p.word}]  "${p.found}"\n      ${p.line}\n`);
console.error('A retired word or a raw {placeholder} reaches a child\'s screen. Reword it, or add a named ALLOW/EXEMPT entry with the reason.');
process.exit(1);
