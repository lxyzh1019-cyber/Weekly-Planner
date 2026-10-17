// Weekly-Planner — the Part 13 guards (Consistency Plan v8 PR 13, Stage 45).
//
// Static and fast: it reads index.html, css/ and js/ as text, runs no browser.
// Each rule has an allowlist; every entry carries its reason, and an entry
// that no longer matches anything FAILS as stale (an exemption that outlives
// its reason is a hole — the same rule as check-look-tokens.js's EXEMPT).
//
//  1. One header per screen. Each `<div class="screen" …>` in index.html holds
//     at most one `<header class="hdr …">`; every hdrMount('screen-x') call
//     names a screen that holds exactly one; and a pageHeader( call outside
//     js/47-header.js is one of HEADER_BUILDERS, whose screens hold no static
//     header (they draw theirs into their own wrap).
//  2. Header buttons. (a) Size: in a rule whose last selector part is a header
//     control (HDR_CONTROLS), a height / min-height / width / min-width below
//     44px fails (0 and auto are not sizes; a var() is read at its smallest
//     value anywhere in css/). (b) Name: inside every hdrMount( / pageHeader(
//     call, each `prev:`, `next:` and `titleAction:` object and each object in
//     `actions: [ … ]` (or in the array a named function returns) carries
//     `aria:`; a `badge:` object carries `aria:` or comes from kidHeadBadge.
//  3. Header text. A font-size in a rule naming a header part (.hdr…, or a
//     sub-bar part in HDR_TEXT_PARTS) below 15px fails (var() at its smallest,
//     --text-scale read as 1; max(15px, …) is a floor).
//  4. Private parts. A class named *-btn, *-tab, *-card or *-sheet in css/ that
//     is not a kit class (.ui-*) and not in PRIVATE_PARTS fails — new parts
//     are kit parts. RETIRED classes (Part 13) may not come back anywhere.
//  5. Layers and breakpoints. A z-index is a --z-* token (var(), alone or in
//     calc()), or a whole number below --z-nav (60): local stacking inside
//     one component, which can never cover a page layer. Anything else needs a
//     Z_ALLOW entry. An @media width is one of BREAKPOINTS or a MEDIA_ALLOW
//     entry (file + query).
//  6. No hand-kept screen list. A selector list naming 4 or more screen roots
//     (#screen-…, or [data-area=…]) fails unless in SCREEN_LIST_ALLOW: a
//     screen-wide rule belongs on the screen's area (data-area) or a class.
//  7. Timers (Part 13 timer audit). Every setInterval in js/08, js/09 and
//     js/44 is assigned to a handle in TIMERS, whose stop sites must be in
//     the source: cleared on screen change or sheet close (or, for the one
//     countdown, by design when it ends).
//
// Font sizes with no floor (rule 4 of check-look-tokens.js, extended there)
// are not checked here. Run: node tests/check-ui-guards.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const CSS_FILES = fs.readdirSync(path.join(ROOT, 'css')).filter(f => f.endsWith('.css')).sort().map(f => 'css/' + f);
const JS_FILES = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).sort().map(f => 'js/' + f);
const problems = [];
const fail = (rule, where, detail, fix) => problems.push({ rule, where, detail, fix });
const lineOf = (src, i) => src.slice(0, i).split('\n').length;
const blank = (s) => s.replace(/[^\n]/g, ' ');

// ── The allowlists ─────────────────────────────────────────────────────────

// The header's controls (rule 2a): the kit header (js/47-header.js) and the
// parent sub-bar's actions (D81: .pv-btn, .pb-back-btn, .pb-switch).
const HDR_CONTROLS = ['hdr-btn', 'hdr-step', 'hdr-back', 'hdr-badge', 'hdr-title-btn', 'hdr-tab', 'hdr-switch-cell',
  'pv-btn', 'pb-back-btn', 'pb-switch', 'pb-action'];
// Sub-bar text parts read by rule 3 besides every .hdr… class.
const HDR_TEXT_PARTS = ['pv-btn', 'pv-name', 'pb-back-btn', 'pb-switch'];
const HDR_SIZE_ALLOW = [];
const HDR_TEXT_ALLOW = [
  { selector: '.hdr-tab-tag', why: 'the small count tag under a money tab, floored at 13px (max(13px, …)); it labels the tab, the tab word itself is 18px+' },
  { selector: '.hdr-tab[aria-current="page"][data-mny-tab="school"]', why: 'Money school\'s selected tab on a phone under 400px in Calm shrinks to 16.5 / 14.5 / 13px so its word fits one line (header difference 15, owner-approved sizes, header-exact-values.md)' },
  { selector: '.hdr-label--two-months', why: 'a week across two months on a phone under 390px in Calm shrinks to 16 / 14px so "Sep 28 – Oct 4" fits beside ◀ ▶ (header difference 15, owner-approved sizes)' },
];
// The pageHeader( builders outside js/47-header.js and the screens they draw.
const HEADER_BUILDERS = [
  { file: 'js/22-money-page1.js', fn: 'mnyHead', screens: ['screen-mymoney', 'screen-moneystory', 'screen-moneyschool'],
    why: 'the money pages draw their header at the top of their own wrap on every render (PR 4)' },
  { file: 'js/15-meeting.js', fn: 'mmHead', screens: ['screen-meeting'], why: 'the meeting draws its two-row header into #familyMeetingBody (PR 4)' },
  { file: 'js/15-meeting.js', fn: 'renderMeetingMode', screens: ['screen-meeting'],
    why: 'catch-up mode replaces the meeting body, its header included, with the one-row title (no stepper)' },
];

// Rule 4: the private *-btn / *-tab / *-card / *-sheet classes that exist
// (Part 13, 2026-10-12). Each stays because its surface was not moved to the
// kit in this plan; a new one is a kit part instead.
const SURFACE = {
  header: 'the page header\'s own parts (js/47-header.js, the exact-values table, D21); the header is measured by everyHeaderMeasuresToTheExactValues, not a kit part',
  subbar: 'the parent sub-bar action (D81: the Day\'s and Week\'s sub-bar actions keep the sub-bar values, not the kit\'s)',
  week: 'the Week and Day timeline\'s private parts, drawn to scale (Part 8 and Stage 55 kept them)',
  money: 'the money pages\' private parts that Part 9 kept (money sizes are tokens, check-look-tokens rule 5)',
  meeting: 'the family meeting\'s private parts (the meeting is its own screen, Part 9 kept them)',
  parent: 'the parent portal\'s private parts (Part 10 / Stage 62 kept them; the portal\'s kit check is thePortalKitHolds44px)',
  today: 'Today\'s private parts (Part 7 kept the quest cards and the ribbon, D62)',
  sheet: 'a sheet body\'s inner part inside the kit\'s .ui-sheet (check-sheet-family.js: one sheet style)',
  misc: 'an app-wide one-off with its own look (mascot, toast, profile picker, print), not a kit control',
  social: 'Sister Sync\'s challenge card (Part 11 kept it, theProfileScreensAreOnTheKit)',
};
const PRIVATE_PARTS = {
  'hdr-btn': SURFACE.header, 'hdr-tab': SURFACE.header, 'hdr-title-btn': SURFACE.header,
  'pv-btn': SURFACE.subbar, 'pb-back-btn': SURFACE.subbar,
  'wf-card': SURFACE.week, 'day-over-btn': SURFACE.week, 'reflect-day-btn': SURFACE.week, 'refl-card': SURFACE.week,
  'refl-tab': SURFACE.week, 'gt-add-btn': SURFACE.week, 'copy-day-tab': SURFACE.week,
  'checklist-add-btn': SURFACE.sheet, 'checklist-del-btn': SURFACE.sheet, 'checklist-timer-btn': SURFACE.sheet, 'del-btn': SURFACE.sheet,
  'gu-sheet': SURFACE.sheet, 'rq-sheet': SURFACE.sheet, 'wpp-sheet': SURFACE.sheet, 'print-sheet': SURFACE.misc,
  'mny-btn': SURFACE.money, 'mny-card': SURFACE.money, 'mv2-btn': SURFACE.money, 'mv2-card': SURFACE.money, 'mv2-idea-tab': SURFACE.money,
  'gu-btn': SURFACE.money, 'gu-card': SURFACE.money, 'bk-btn': SURFACE.money, 'rc-btn': SURFACE.money,
  'mm-offer-btn': SURFACE.meeting, 'mm-weekbar-btn': SURFACE.meeting, 'mm-xp-card': SURFACE.meeting,
  'ck-btn': SURFACE.parent, 'chore-card': SURFACE.parent, 'cp-tab': SURFACE.parent, 'ctr-card': SURFACE.parent, 'ctr-tab': SURFACE.parent,
  'parent-menu-btn': SURFACE.parent, 'pn-side-card': SURFACE.parent,
  'quest-card': SURFACE.today, 'quest-complete-btn': SURFACE.today, 'td-earlier-btn': SURFACE.today, 'td-later-btn': SURFACE.today,
  'td-rib-btn': SURFACE.today, 'mission-clear-btn': SURFACE.today,
  'kid-nav-btn': SURFACE.misc, 'mascot-btn': SURFACE.misc, 'undo-toast-btn': SURFACE.misc, 'profile-card': SURFACE.misc,
  'challenge-card': SURFACE.social,
};
// Retired in Part 13 (and Stage 62/63): no rule and no user may come back.
const RETIRED = ['pill-btn', 'btn-icon', 'btn-confirm', 'btn-danger', 'pn-card'];

// Rule 5: z-index and breakpoints.
const Z_LOCAL_BELOW = 60;   // --z-nav, the lowest page layer
const Z_ALLOW = [
  { file: 'css/app.css', selector: '.toast', value: '999', why: 'the toast sits above everything, the same number as --z-toast (999)' },
  { file: 'css/app.css', selector: '.ritual-screen', value: '400', why: 'the full-screen ritual covers the page, the same number as --z-overlay (400)' },
  { file: 'css/app.css', selector: '.mascot-btn', value: '140', why: 'the mascot floats over the page and under every sheet (300)' },
  { file: 'css/app.css', selector: '.mascot-bubble', value: '145', why: 'the mascot\'s speech bubble, just over the mascot' },
  { file: 'css/app.css', selector: '.quest-popup', value: '9999', why: 'the quest-complete celebration covers even a toast while it plays' },
  { file: 'css/app.css', selector: '.mission-clear', value: '9998', why: 'the mission-clear banner, just under the quest celebration' },
  { file: 'css/app.css', selector: '.kid-nav', value: '60', why: 'the bottom nav, the same number as --z-nav (60)' },
  { file: 'css/money.css', selector: '.sd-flycoin', value: '400', why: 'the coin that flies across the Sunday sheet, over it (decoration, aria-hidden)' },
  { file: 'css/parent.css', selector: '.parent-menu-pop', value: '120', why: 'the 🔒 Parent ▾ menu drops over the portal\'s sticky bar (100), under every sheet' },
];
// The breakpoints (Part 13): the phone, the iPad portrait, the narrow header,
// the iPad landscape and the wide screen, as max-width / min-width pairs.
const BREAKPOINTS = ['(max-width: 699px)', '(min-width: 700px)', '(max-width: 767px)', '(min-width: 768px)',
  '(max-width: 819px)', '(min-width: 820px) and (max-width: 979px)', '(min-width: 980px) and (orientation: landscape)',
  '(max-width: 899px)', '(max-width: 1099px)', '(max-width: 1100px)', '(min-width: 1100px)'];
const MEDIA_ALLOW = [
  { file: 'css/app.css', query: '(max-width: 360px)', why: 'header difference 15: the Pop two-month label at the 360px phone (owner-approved sizes)' },
  { file: 'css/app.css', query: '(max-width: 363px)', why: 'header difference 15: the Pop Money school tab at 360–363px' },
  { file: 'css/app.css', query: '(max-width: 374px)', why: 'header difference 15: the Calm label sizes at the 360/375px phones' },
  { file: 'css/app.css', query: '(max-width: 389px)', why: 'header difference 15: the Calm sizes under the 390px phone' },
  { file: 'css/app.css', query: '(max-width: 400px)', why: 'header difference 15: the Calm Money school tab under 400px' },
  { file: 'css/app.css', query: '(max-width: 401px)', why: 'header difference 15: the Calm two-month label under 402px' },
  { file: 'css/app.css', query: '(max-width: 380px)', why: 'the sticker wall drops to 3 columns on the smallest phones' },
  { file: 'css/app.css', query: '(max-width: 420px)', why: 'the emoji picker grid drops to 6 columns on a phone' },
  { file: 'css/app.css', query: '(max-width: 560px)', why: 'the sheets\' time rows go to two columns on a phone' },
  { file: 'css/app.css', query: '(max-width: 600px)', why: 'the full Week grid keeps a 770px minimum and scrolls on a phone' },
  { file: 'css/app.css', query: '(max-width: 620px)', why: 'the meeting\'s check list goes to one column' },
  { file: 'css/app.css', query: '(max-width: 640px)', why: 'the time-grid controls and the chore-options header on a phone' },
  { file: 'css/app.css', query: '(max-width: 700px)', why: 'the parent chore pages\' columns and arrows (36px arrows, floored to 44 by css/floors.css)' },
  { file: 'css/app.css', query: '(max-width: 720px)', why: 'the goals and to-do panels go to one column' },
  { file: 'css/app.css', query: '(min-width: 760px)', why: 'the money strip in the meeting and the portal goes to a row' },
  { file: 'css/app.css', query: '(max-width: 820px)', why: 'the parent chore columns and trend cards go to one column' },
  { file: 'css/today.css', query: '(max-width: 480px)', why: 'Today\'s quest cards tighten their padding on a phone' },
];

// Rule 6: hand-kept screen lists.
const SCREEN_LIST_ALLOW = [
  { file: 'css/app.css', selector: '#screen-parent, #screen-mymoney, #screen-moneystory, #screen-moneyschool, #screen-meeting',
    why: 'the money and parent screens\' shared rule predates data-area; moving it is a picture change outside Part 13' },
];

// Rule 7: the timers in js/08, js/09 and js/44, and where each is stopped.
const TIMER_FILES = ['js/08-day-view.js', 'js/09-sheets.js', 'js/44-sunday.js'];
const TIMERS = [
  { handle: 'activeStopwatchTick', file: 'js/08-day-view.js',
    stops: [/screen-day'\)\s*\{\s*clearInterval\(activeStopwatchTick\)/, /buildTimeline\(\)\s*\{\s*if \(activeStopwatchTick\) \{ clearInterval\(activeStopwatchTick\)/],
    why: 'the Day\'s running-stopwatch redraw stops itself on its next tick once the Day is not the screen on show' },
  { handle: 'kidRoutineStopwatchTick', file: 'js/08-day-view.js', stops: [/if \(id === 'kidRoutineOverlay'\) kidRoutineStopwatchClearTick\(\)/],
    why: 'cleared by closeSheet(\'kidRoutineOverlay\') (js/17)' },
  { handle: 'kidTrainingStopwatchTick', file: 'js/08-day-view.js', stops: [/if \(id === 'kidTrainingOverlay'\) kidTrainingStopwatchClearTick\(\)/],
    why: 'cleared by closeSheet(\'kidTrainingOverlay\') (js/17)' },
  { handle: 'editStopwatchTick', file: 'js/09-sheets.js', stops: [/if \(id === 'editOverlay'\) editStopwatchClearTick\(\)/],
    why: 'cleared by closeSheet(\'editOverlay\') (js/17)' },
  { handle: 'activeTimers[key].interval', file: 'js/09-sheets.js', stops: [/remaining <= 0\) \{\s*clearInterval\(activeTimers\[key\]\.interval\)/],
    why: 'a checklist countdown she started: it runs on by design when the sheet closes (the bell rings at zero) and clears itself at zero or when tapped again' },
  { handle: 'sdCountTimer', file: 'js/44-sunday.js', stops: [/mmIsOpen\(\)\) \|\| d\.step !== 1 \|\| d\.shown >= total\) \{ clearInterval\(sdCountTimer\)/],
    why: 'the falling coins stop on the next tick once the meeting is closed or the step changes' },
  { handle: 'sdPress.timer', file: 'js/44-sunday.js', stops: [/mmIsOpen\(\)\)\) \{ clearInterval\(sdPress\.timer\); sdPress = null; return; \}/],
    why: 'a box held down: stops on release, on pointer cancel or leave, and on its next tick once the meeting is closed (Part 13)' },
  { handle: 'sdSignHold.timer', file: 'js/44-sunday.js', stops: [/mmIsOpen\(\)\)\) \{ clearInterval\(sdSignHold\.timer\); sdSignHold = null; return; \}/],
    why: 'hold to sign: stops on release, on pointer cancel or leave, and on its next tick once the meeting is closed (Part 13)' },
];

// ── A small CSS reader: every declaration with its file, line and rule stack ──
const decls = [];
const tokens = new Map();   // --name → [values]
const cssSel = new Map();   // file → [{ selector, line }]
for (const file of CSS_FILES) {
  const css = read(file).replace(/\/\*[\s\S]*?\*\//g, blank);
  const stack = [];
  const rules = [];
  let buf = '', at = -1, q = null;
  const flush = () => {
    const t = buf.trim(); const a = at; buf = ''; at = -1;
    if (!t.includes(':') || !stack.length) return;
    const c = t.indexOf(':');
    const d = { file, line: lineOf(css, a), stack: stack.slice(), selector: stack[stack.length - 1],
      prop: t.slice(0, c).trim().toLowerCase(), value: t.slice(c + 1).trim().replace(/\s*!important$/, '') };
    decls.push(d);
    if (d.prop.startsWith('--')) { if (!tokens.has(d.prop)) tokens.set(d.prop, []); tokens.get(d.prop).push(d.value); }
  };
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (q) { buf += ch; if (ch === '\\') buf += css[++i] || ''; else if (ch === q) q = null; continue; }
    if (ch === '"' || ch === '\'') { q = ch; if (at < 0) at = i; buf += ch; continue; }
    if (ch === '{') { const sel = buf.trim().replace(/\s+/g, ' '); stack.push(sel); rules.push({ selector: sel, line: lineOf(css, i) }); buf = ''; at = -1; continue; }
    if (ch === ';') { flush(); continue; }
    if (ch === '}') { flush(); stack.pop(); continue; }
    if (at < 0 && !/\s/.test(ch)) at = i;
    buf += ch;
  }
  cssSel.set(file, rules);
}
const print = (d) => d.stack.some(s => /^@media\s+(?:only\s+)?print\b/i.test(s));
const lastPart = (sel) => sel.split(/\s*[>+~]\s*|\s+/).filter(Boolean).pop() || '';

/* The smallest px a value can take: var() at its smallest definition anywhere
   in css/, rem at 16px, --text-scale at 1; max(Npx, …) floors at N. null when
   the value has no size. */
function minPx(value, depth = 0) {
  if (depth > 6 || value == null) return null;
  let v = String(value);
  const floor = v.match(/^max\(\s*(\d*\.?\d+)px\s*,/);
  if (floor) return +floor[1];
  v = v.replace(/var\(\s*--text-scale[^)]*\)/g, '1').replace(/var\(\s*--fs-scale[^)]*\)/g, '1');
  let guard = 0;
  while (/var\(\s*--[\w-]+/.test(v) && guard++ < 20) {
    v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/, (m, name, fb) => {
      const defs = (tokens.get(name) || []).map(x => minPx(x, depth + 1)).filter(x => x != null);
      if (defs.length) return Math.min(...defs) + 'px';
      return fb != null ? fb : '';
    });
  }
  const nums = [...v.matchAll(/(\d*\.?\d+)(px|rem)\b/g)].map(m => +m[1] * (m[2] === 'rem' ? 16 : 1));
  return nums.length ? Math.min(...nums) : null;
}

// ── 1. One header per screen ───────────────────────────────────────────────
const html = read('index.html').replace(/<!--[\s\S]*?-->/g, blank);
const screenStarts = [...html.matchAll(/<div class="screen[^"]*" id="(screen-[\w-]+)"/g)];
const staticHeaders = new Map();
screenStarts.forEach((m, i) => {
  const end = i + 1 < screenStarts.length ? screenStarts[i + 1].index : html.length;
  const n = (html.slice(m.index, end).match(/<header class="hdr[ "]/g) || []).length;
  staticHeaders.set(m[1], n);
  if (n > 1) fail('one header per screen', `index.html:${lineOf(html, m.index)}`, `${m[1]} holds ${n} <header class="hdr"> headers`,
    'a screen has one page header (pageHeader); put a second row in its `sub` slot');
});
const jsSrc = new Map(JS_FILES.map(f => [f, read(f)]));
const stripJsComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p) => p + blank(m.slice(p.length)));
const builderHits = new Map(HEADER_BUILDERS.map(b => [b, 0]));
const enclosingFn = (src, at) => { const m = [...src.slice(0, at).matchAll(/^(?:async )?function (\w+)/gm)].pop(); return m ? m[1] : null; };
for (const [file, raw] of jsSrc) {
  const src = stripJsComments(raw);
  for (const m of src.matchAll(/\bhdrMount\(\s*'(screen-[\w-]+)'/g)) {
    const n = staticHeaders.get(m[1]);
    if (n !== 1) fail('one header per screen', `${file}:${lineOf(src, m.index)}`, `hdrMount('${m[1]}') but index.html holds ${n == null ? 'no such screen' : n + ' header(s)'} there`,
      'hdrMount swaps the one static <header class="hdr"> of its screen');
  }
  if (file === 'js/47-header.js') continue;
  for (const m of src.matchAll(/\bpageHeader\(/g)) {
    const fn = enclosingFn(src, m.index);
    const b = HEADER_BUILDERS.find(x => x.file === file && x.fn === fn);
    if (!b) { fail('one header per screen', `${file}:${lineOf(src, m.index)}`, `pageHeader( in ${fn || 'top level'} is not a known header builder`,
      'mount the screen\'s header with hdrMount, or add a HEADER_BUILDERS entry naming its screens and why'); continue; }
    builderHits.set(b, builderHits.get(b) + 1);
    b.screens.filter(s => staticHeaders.get(s)).forEach(s => fail('one header per screen', `${file}:${lineOf(src, m.index)}`,
      `${fn} draws ${s}'s header but index.html also holds a static one there`, 'one header per screen: drop one of the two'));
  }
}
builderHits.forEach((n, b) => { if (!n) fail('stale allowlist', 'tests/check-ui-guards.js HEADER_BUILDERS', `${b.file} ${b.fn} calls pageHeader( no more`, 'delete the entry'); });

// ── 2a. Header buttons are at least 44px ───────────────────────────────────
const SIZE_PROPS = ['height', 'min-height', 'width', 'min-width'];
const sizeAllowHits = new Map(HDR_SIZE_ALLOW.map(x => [x, 0]));
const isHdrControl = (sel) => sel.split(',').some(part => {
  const last = lastPart(part.trim());
  return HDR_CONTROLS.some(c => new RegExp(`\\.${c}(?![\\w-])`).test(last)) || (/\.hdr/.test(part) && /^button\b/.test(last));
});
for (const d of decls) {
  if (!SIZE_PROPS.includes(d.prop) || d.selector.startsWith('@') || print(d) || !isHdrControl(d.selector)) continue;
  if (/^(?:0|auto|none|0px)$/.test(d.value) || /%|fr|vw|vh/.test(d.value)) continue;
  const px = minPx(d.value);
  if (px == null || px >= 44) continue;
  const ok = HDR_SIZE_ALLOW.find(x => x.selector === d.selector && x.prop === d.prop);
  if (ok) { sizeAllowHits.set(ok, sizeAllowHits.get(ok) + 1); continue; }
  fail('header button size', `${d.file}:${d.line}`, `${d.selector} { ${d.prop}: ${d.value} } is ${px}px`, 'a header button is at least 44×44 (52 on a kid header): use the header tokens');
}

// ── 2b. Header buttons have a name ─────────────────────────────────────────
function balanced(src, open) {   // src[open] is ( [ or {; returns the index after its match
  const pairs = { '(': ')', '[': ']', '{': '}' };
  let depth = 0, q = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === '\'' || c === '`') { q = c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { if (--depth === 0) return i + 1; }
  }
  return src.length;
}
const topObjects = (arr) => {   // the {…} objects directly inside an array literal's text
  const out = []; let i = 1;
  while (i < arr.length) { if (arr[i] === '{') { const e = balanced(arr, i); out.push(arr.slice(i, e)); i = e; } else if (arr[i] === '[' || arr[i] === '(' || arr[i] === '`' || arr[i] === '\'' || arr[i] === '"') { i = balanced(arr, i) || i + 1; } else i++; }
  return out;
};
for (const [file, raw] of jsSrc) {
  if (file === 'js/47-header.js') continue;
  const src = stripJsComments(raw);
  for (const m of src.matchAll(/\b(?:hdrMount\(\s*'[\w-]+'\s*,|pageHeader\()\s*\{/g)) {
    const open = src.indexOf('{', m.index + m[0].length - 1);
    const arg = src.slice(open, balanced(src, open));
    const where = `${file}:${lineOf(src, m.index)}`;
    for (const k of arg.matchAll(/\b(prev|next|titleAction)\s*:\s*\{/g)) {
      const o = arg.indexOf('{', k.index); const obj = arg.slice(o, balanced(arg, o));
      if (!/\baria\s*:/.test(obj)) fail('header button name', where, `${k[1]}: ${obj.replace(/\s+/g, ' ').slice(0, 80)} has no aria`, 'give the button its words: aria: \'…\'');
    }
    for (const k of arg.matchAll(/\bactions\s*:\s*(\[|(\w+)\()/g)) {
      let arr;
      if (k[1] === '[') { const o = arg.indexOf('[', k.index); arr = arg.slice(o, balanced(arg, o)); }
      else {
        const def = [...jsSrc].map(([f, s]) => [f, stripJsComments(s)]).map(([f, s]) => { const d = s.match(new RegExp(`function ${k[2]}\\([^)]*\\)\\s*\\{`)); return d ? s.slice(d.index, balanced(s, s.indexOf('{', d.index))) : null; }).find(Boolean);
        if (!def) { fail('header button name', where, `actions come from ${k[2]}(), which was not found`, 'build the actions where the check can read them'); continue; }
        const r = def.indexOf('return ['); arr = r >= 0 ? def.slice(r + 7, balanced(def, r + 7)) : '';
        if (!arr) { fail('header button name', where, `${k[2]}() returns no array literal`, 'return the actions as an array literal'); continue; }
      }
      topObjects(arr).forEach(obj => { if (!/\baria\s*:/.test(obj)) fail('header button name', where, `action ${obj.replace(/\s+/g, ' ').slice(0, 80)} has no aria`, 'give the action its words: aria: \'…\''); });
    }
    for (const k of arg.matchAll(/\bbadge\s*:\s*\{/g)) {
      const o = arg.indexOf('{', k.index); const obj = arg.slice(o, balanced(arg, o));
      if (!/\b(?:aria|text)\s*:/.test(obj)) fail('header button name', where, `badge ${obj.replace(/\s+/g, ' ').slice(0, 80)} has no aria or text`, 'use kidHeadBadge, or give the badge aria: \'…\'');
    }
  }
}

// ── 3. Header text is at least 15px ────────────────────────────────────────
const textAllowHits = new Map(HDR_TEXT_ALLOW.map(x => [x, 0]));
const isHdrText = (sel) => /\.hdr/.test(sel) || HDR_TEXT_PARTS.some(c => new RegExp(`\\.${c}(?![\\w-])`).test(sel));
for (const d of decls) {
  if (d.prop !== 'font-size' || d.selector.startsWith('@') || d.selector.startsWith(':root') || print(d) || !isHdrText(d.selector)) continue;
  const px = minPx(d.value);
  if (px == null || px >= 15) continue;
  const ok = HDR_TEXT_ALLOW.find(x => x.selector === d.selector);
  if (ok) { textAllowHits.set(ok, textAllowHits.get(ok) + 1); continue; }
  fail('header text size', `${d.file}:${d.line}`, `${d.selector} { font-size: ${d.value} } can be ${px}px`, 'header text is at least 15px: use the header tokens');
}

// ── 4. Private parts and retired classes ───────────────────────────────────
const partHits = new Map(Object.keys(PRIVATE_PARTS).map(k => [k, 0]));
const seenPart = new Set();
for (const [file, rules] of cssSel) for (const r of rules) {
  if (r.selector.startsWith('@')) continue;
  for (const m of r.selector.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
    const c = m[1];
    if (RETIRED.includes(c)) fail('retired class', `${file}:${r.line}`, `.${c} is back in ${r.selector.slice(0, 80)}`, 'use the kit part that replaced it (Part 13)');
    if (c.startsWith('ui-') || !/-(?:btn|tab|card|sheet)$/.test(c)) continue;
    if (c in PRIVATE_PARTS) { partHits.set(c, partHits.get(c) + 1); continue; }
    if (seenPart.has(c)) continue; seenPart.add(c);
    fail('new private part', `${file}:${r.line}`, `.${c} is a new *-btn / *-tab / *-card / *-sheet class outside the kit`, 'use the kit part (.ui-btn, .ui-tabs, .ui-card, .ui-sheet …) with its modifiers');
  }
}
partHits.forEach((n, c) => { if (!n) fail('stale allowlist', 'tests/check-ui-guards.js PRIVATE_PARTS', `.${c} has no rule in css/ any more`, 'delete the entry'); });
for (const [file, raw] of [...jsSrc, ['index.html', read('index.html')]]) {
  const src = file === 'index.html' ? raw.replace(/<!--[\s\S]*?-->/g, blank) : stripJsComments(raw);
  for (const c of RETIRED) {
    const re = new RegExp(`(?:class(?:Name)?\\s*[=:+]|classList\\.\\w+\\(|class=")[^;\\n]*?(?<![\\w-])${c}(?![\\w-])`, 'g');
    for (const m of src.matchAll(re)) fail('retired class', `${file}:${lineOf(src, m.index)}`, `.${c} is used again`, 'use the kit part that replaced it (Part 13)');
  }
}

// ── 5. Layers and breakpoints ──────────────────────────────────────────────
const zAllowHits = new Map(Z_ALLOW.map(x => [x, 0]));
for (const d of decls) {
  if (d.prop !== 'z-index') continue;
  const v = d.value;
  if (/^var\(--z-[\w-]+(?:,[^)]*)?\)$/.test(v) || /^calc\(\s*var\(--z-[\w-]+(?:,[^)]*)?\)\s*[-+]\s*\d+\s*\)$/.test(v)) continue;
  if (/^-?\d+$/.test(v) && +v < Z_LOCAL_BELOW) continue;
  const ok = Z_ALLOW.find(x => x.file === d.file && x.selector === d.selector && x.value === v);
  if (ok) { zAllowHits.set(ok, zAllowHits.get(ok) + 1); continue; }
  fail('z-index', `${d.file}:${d.line}`, `${d.selector} { z-index: ${v} }`, `a page layer reads its token (var(--z-header|nav|sticky|sheet|dialog|modal|overlay|toast)); a number under ${Z_LOCAL_BELOW} only orders parts inside one component`);
}
const mediaAllowHits = new Map(MEDIA_ALLOW.map(x => [x, 0]));
for (const [file, rules] of cssSel) for (const r of rules) {
  const m = r.selector.match(/^@media\s+(.*)$/);
  if (!m || !/width/.test(m[1])) continue;
  const q = m[1].replace(/^(?:only\s+)?screen\s+and\s+/, '').trim();
  if (BREAKPOINTS.includes(q)) continue;
  const ok = MEDIA_ALLOW.find(x => x.file === file && x.query === q);
  if (ok) { mediaAllowHits.set(ok, mediaAllowHits.get(ok) + 1); continue; }
  fail('breakpoint', `${file}:${r.line}`, `@media ${q} is not one of the breakpoints`, `use one of ${BREAKPOINTS.join(', ')} (ARCHITECTURE.md, UI rules)`);
}

// ── 6. No hand-kept screen list ────────────────────────────────────────────
const listAllowHits = new Map(SCREEN_LIST_ALLOW.map(x => [x, 0]));
for (const [file, rules] of cssSel) for (const r of rules) {
  if (r.selector.startsWith('@')) continue;
  const roots = new Set([...r.selector.matchAll(/#(screen-[\w-]+)|\[data-area=["']?([\w-]+)/g)].map(m => m[1] || 'area:' + m[2]));
  if (roots.size < 4) continue;
  const ok = SCREEN_LIST_ALLOW.find(x => x.file === file && x.selector === r.selector);
  if (ok) { listAllowHits.set(ok, listAllowHits.get(ok) + 1); continue; }
  fail('screen list', `${file}:${r.line}`, `${roots.size} screens listed by hand: ${r.selector.slice(0, 120)}`, 'name the screens\' area ([data-area="…"]) or give the parts a class');
}

// ── 7. Timers ──────────────────────────────────────────────────────────────
for (const file of TIMER_FILES) {
  const src = stripJsComments(jsSrc.get(file));
  for (const m of src.matchAll(/([\w.[\]]+)\s*=\s*setInterval\(|setInterval\(/g)) {
    const handle = m[1];
    const t = handle && TIMERS.find(x => x.file === file && x.handle === handle);
    if (!t) fail('timer', `${file}:${lineOf(src, m.index)}`, handle ? `setInterval into ${handle} has no TIMERS entry` : 'a setInterval whose handle is not kept',
      'keep the handle and clear it on screen change or sheet close; add a TIMERS entry naming where');
  }
}
const allJs = [...jsSrc.values()].map(stripJsComments).join('\n');
for (const t of TIMERS) t.stops.forEach(re => { if (!re.test(allJs)) fail('timer', t.file, `${t.handle}: its stop site ${re} is gone`, 'clear the timer on screen change or sheet close, and point the TIMERS entry at it'); });

// ── Stale allowlist entries ────────────────────────────────────────────────
for (const [map, name] of [[sizeAllowHits, 'HDR_SIZE_ALLOW'], [textAllowHits, 'HDR_TEXT_ALLOW'], [zAllowHits, 'Z_ALLOW'], [mediaAllowHits, 'MEDIA_ALLOW'], [listAllowHits, 'SCREEN_LIST_ALLOW']]) {
  map.forEach((n, x) => { if (!n) fail('stale allowlist', `tests/check-ui-guards.js ${name}`, JSON.stringify(x).slice(0, 120), 'it matches nothing: delete the entry'); });
}
for (const list of [HDR_TEXT_ALLOW, Z_ALLOW, MEDIA_ALLOW, SCREEN_LIST_ALLOW, HEADER_BUILDERS, TIMERS]) {
  list.filter(x => !x.why || !String(x.why).trim()).forEach(x => fail('allowlist reason', 'tests/check-ui-guards.js', JSON.stringify(x).slice(0, 100), 'every entry says why'));
}

if (!problems.length) {
  console.log(`OK  ui guards: ${screenStarts.length} screens, one header each; header buttons ≥44px and named; header text ≥15px `
    + `(${HDR_TEXT_ALLOW.length} allowed); ${Object.keys(PRIVATE_PARTS).length} private parts kept, no new one, ${RETIRED.length} retired classes gone; `
    + `z-index tokens (${Z_ALLOW.length} allowed); ${BREAKPOINTS.length} breakpoints (${MEDIA_ALLOW.length} allowed); `
    + `no hand-kept screen list (${SCREEN_LIST_ALLOW.length} allowed); ${TIMERS.length} timers each stopped`);
  process.exit(0);
}
console.error(`FAIL  ${problems.length} ui guard problem(s):\n`);
for (const p of problems) console.error(`  ${p.where}  [${p.rule}]\n      ${p.detail}\n      ${p.fix}\n`);
process.exit(1);
