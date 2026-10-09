// Unit checks for the component kit's code (Consistency PR 3): fmtMoney and
// fmtDay in js/05-helpers.js, and pageHeader in js/47-header.js.
// Run: node tests/helpers.test.js
//
// fmtMoney and fmtDay are the one money and day format (decision D2); PR 6
// moves the eighteen local formatters onto them, so these numbers are the ones
// every money and day label will read. They are held here against the outputs
// of the formatters they replace (mnyShort$ and sdD for money; mnyDayMonth,
// mnyDayName and guDayName for days). pageHeader is rendered for every slot
// combination; its heights are held in the browser by the smoke check
// theComponentKitHoldsItsSizes.
// UTC on every machine: set here, before anything reads a date (see
// tests/buffers.test.js).
process.env.TZ = 'UTC';
const helpers = require('../js/05-helpers.js');
const { fmtMoney, fmtDay } = helpers;
// pageHeader is a classic script reading escapeHtml and escapeAttr as globals.
global.escapeHtml = helpers.escapeHtml;
global.escapeAttr = helpers.escapeAttr;
const { pageHeader, PH_VARIANTS, PH_MAX_ACTIONS } = require('../js/47-header.js');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond === true) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name, cond === false ? '' : JSON.stringify(cond)); }
}
// Every pair whose result is not the expected one, or true.
function table(rows, fn) {
  const bad = rows.filter(([input, want]) => fn(input) !== want)
    .map(([input, want]) => `${JSON.stringify(input)} gave ${JSON.stringify(fn(input))}, expected ${JSON.stringify(want)}`);
  return bad.length ? bad : true;
}

// ── fmtMoney ───────────────────────────────────────────────────────────────
check('whole dollars have no cents', table([[3, '$3'], [0, '$0'], [140, '$140'], [1000, '$1000']], v => fmtMoney(v)));
check('cents show two places', table([[2.5, '$2.50'], [0.05, '$0.05'], [16.15, '$16.15'], [99.99, '$99.99']], v => fmtMoney(v)));
check('a negative is the minus sign U+2212, never "$-3.00"', table([[-3, '−$3'], [-2.5, '−$2.50'], [-0.01, '−$0.01']], v => fmtMoney(v)));
check('rounded to the cent first, as money2 does', table([
  [2.499, '$2.50'], [2.996, '$3'], [2.004, '$2'], [-2.996, '−$3'], [0.001, '$0'], [-0.004, '$0'],
], v => fmtMoney(v)));
check('not a number reads as $0', table([[null, '$0'], [undefined, '$0'], ['abc', '$0'], ['4.5', '$4.50']], v => fmtMoney(v)));
check('signed adds + to a positive only', table([[3, '+$3'], [2.5, '+$2.50'], [0, '$0'], [-3, '−$3']], v => fmtMoney(v, { signed: true })));
// The same answers as the two formatters D2 names as the model.
{
  const money2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const mnyShort$ = (v) => { const n = money2(v); return (n < 0 ? '−$' : '$') + (Math.abs(n) % 1 ? Math.abs(n).toFixed(2) : String(Math.abs(n))); };
  const bad = [];
  for (let c = -50000; c <= 50000; c += 37) {
    const v = c / 100 + 0.003;
    if (fmtMoney(v) !== mnyShort$(v)) bad.push(`${v}: ${fmtMoney(v)} vs ${mnyShort$(v)}`);
  }
  check('agrees with mnyShort$ and sdD from −$500 to $500', bad.length ? bad.slice(0, 5) : true);
}

// ── fmtDay ─────────────────────────────────────────────────────────────────
check('short is "27 Sep" (mnyDayMonth)', table([['2026-09-27', '27 Sep'], ['2026-10-03', '3 Oct'], ['2027-01-01', '1 Jan']], k => fmtDay(k, 'short')));
check('long is "Sat 3 Oct" (mnyDayName)', table([['2026-10-03', 'Sat 3 Oct'], ['2026-10-04', 'Sun 4 Oct'], ['2026-12-31', 'Thu 31 Dec']], k => fmtDay(k, 'long')));
check('weekday is "Sat" (guDayName)', table([['2026-10-03', 'Sat'], ['2026-10-05', 'Mon'], ['2024-02-29', 'Thu']], k => fmtDay(k, 'weekday')));
check('no form reads as short', fmtDay('2026-10-07') === '7 Oct' || fmtDay('2026-10-07'));
{
  // The device's zone cannot move a day: the same key in four zones.
  const seen = new Set();
  for (const tz of ['UTC', 'America/Edmonton', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
    process.env.TZ = tz;
    seen.add(fmtDay('2026-10-04', 'long'));
  }
  process.env.TZ = 'UTC';
  check('the same key reads the same day in every time zone', seen.size === 1 && seen.has('Sun 4 Oct') || [...seen]);
}

// ── pageHeader ─────────────────────────────────────────────────────────────
const count = (html, re) => (html.match(re) || []).length;
check('four variants', JSON.stringify(PH_VARIANTS) === '["standard","money","meeting","parent"]' || PH_VARIANTS);
{
  // Every combination of the six optional slots, in every variant.
  const slots = {
    back: { to: 'Week', data: { 'mny-action': 'back' } },
    title: 'My money',
    context: 'Wed 7 Oct',
    actions: [{ label: '📋', aria: 'Print', data: { 'mny-action': 'print' } }, { label: '?', aria: 'Help' }],
    badge: { text: 'Jenn', icon: '🐥', aria: 'Switch profile' },
    sub: '<div class="ui-tabs"><button type="button" aria-selected="true">Week</button></div>',
  };
  const names = Object.keys(slots);
  const bad = [];
  let rendered = 0;
  for (const variant of PH_VARIANTS) {
    for (let mask = 0; mask < 1 << names.length; mask++) {
      const o = { variant };
      names.forEach((n, i) => { if (mask & (1 << i)) o[n] = slots[n]; });
      const html = pageHeader(o);
      rendered++;
      const has = (n) => !!(mask & (1 << names.indexOf(n)));
      const where = `${variant} [${names.filter(has).join(',')}]`;
      if (!html.startsWith(`<header class="ph ph--${variant}">`)) bad.push(`${where}: does not open as ph ph--${variant}`);
      if (count(html, /class="ph-row ph-main"/g) !== 1) bad.push(`${where}: not exactly one main row`);
      if (has('back') !== html.includes('aria-label="Back to Week"')) bad.push(`${where}: back slot`);
      if (has('title') !== html.includes('<h2 class="ph-title">My money</h2>')) bad.push(`${where}: title slot`);
      if (has('context') !== html.includes('<div class="ph-context">Wed 7 Oct</div>')) bad.push(`${where}: context slot`);
      if (has('actions') !== (count(html, /class="ph-btn"/g) === 2)) bad.push(`${where}: actions slot`);
      if (has('badge') !== html.includes('class="ph-badge"')) bad.push(`${where}: badge slot`);
      const lower = variant === 'meeting' ? 'ph-row ph-r2' : 'ph-row ph-sub';
      if (has('sub') !== html.includes(`<div class="${lower}"><div class="ui-tabs">`)) bad.push(`${where}: sub slot (${lower})`);
      if (html.includes(variant === 'meeting' ? 'ph-sub' : 'ph-r2')) bad.push(`${where}: the wrong lower row`);
      // Slot order: back, title, context, actions, badge — the badge always last in its row.
      const order = ['ph-back', 'ph-title', 'ph-context', 'ph-actions', 'ph-badge'].map(c => html.indexOf(c)).filter(i => i >= 0);
      if (order.some((v, i) => i && v < order[i - 1])) bad.push(`${where}: slots out of order`);
      if (has('badge') && html.indexOf('ph-badge') < html.lastIndexOf('ph-btn')) bad.push(`${where}: the badge is not far right`);
      if (has('back') && !html.includes('data-mny-action="back"')) bad.push(`${where}: back lost its data attribute`);
    }
  }
  check(`every slot combination renders in every variant (${rendered} headers)`, bad.length ? bad.slice(0, 8) : true);
}
check('an unknown or missing variant is standard',
  pageHeader({ variant: 'nope', title: 'X' }).startsWith('<header class="ph ph--standard">')
  && pageHeader().startsWith('<header class="ph ph--standard">') || pageHeader({ variant: 'nope' }));
{
  const html = pageHeader({ actions: [{ label: 'a' }, { label: 'b' }, { label: 'c' }] });
  check(`at most ${PH_MAX_ACTIONS} actions are drawn`, count(html, /class="ph-btn"/g) === 2 && !html.includes('>c<') || html);
}
{
  const html = pageHeader({ badge: { icon: '🐥', text: 'Jenn', avatar: true, aria: 'Switch profile' } });
  check('an avatar badge draws only the icon, named by its aria-label',
    html.includes('class="ph-badge ph-badge--avatar" aria-label="Switch profile"') && html.includes('<span class="ph-av" aria-hidden="true">🐥</span>') && !html.includes('Jenn') || html);
}
// The kid screens' slots (PR 4): a named back, ◀ title ▶, tools, the badge's
// id, noPrint and the title as a button (D27).
{
  const named = pageHeader({ back: { to: 'Week', named: true, data: { 'ph-action': 'back' } } });
  const plain = pageHeader({ back: { to: 'Week' } });
  check('back.named writes where ◀ goes beside it; a plain back does not',
    named.includes('<span aria-hidden="true">◀</span> <span class="ph-back-to">Week</span></button>')
    && named.includes('aria-label="Back to Week"') && !plain.includes('ph-back-to') || [named, plain]);
}
{
  const html = pageHeader({ title: 'Tue 6 Oct', step: { prev: { aria: 'Previous day', data: { 'ph-action': 'day-prev' } },
    next: { aria: 'Next day', data: { 'ph-action': 'day-next' } } } });
  const prev = html.indexOf('aria-label="Previous day"'), title = html.indexOf('<h2 class="ph-title">Tue 6 Oct</h2>'), next = html.indexOf('aria-label="Next day"');
  check('step draws ◀ title ▶ in one .ph-step, each arrow with its data',
    html.includes('<div class="ph-step">') && count(html, /class="ph-btn ph-step-btn"/g) === 2
    && prev >= 0 && prev < title && title < next
    && html.includes('data-ph-action="day-prev"') && html.includes('data-ph-action="day-next"') || html);
}
{
  const html = pageHeader({ title: 'My Week', context: 'x', tools: '<b>T</b>', actions: [{ label: 'Print' }], badge: { icon: '🐥', avatar: true, aria: 'a' } });
  const t = html.indexOf('<div class="ph-tools"><b>T</b></div>');
  check('tools sit after the title and context, before the actions and the badge',
    t > html.indexOf('ph-context') && t < html.indexOf('ph-actions') && t < html.indexOf('ph-badge') && !pageHeader({ title: 'x' }).includes('ph-tools') || html);
}
{
  const html = pageHeader({ badge: { icon: '🐥', avatar: true, aria: 'Jenn, switch profile', id: 'dayProfileBadge', data: { 'ph-action': 'profile' } } });
  check('badge.id names the badge button (the meeting lock finds it by id)',
    /<button type="button" class="ph-badge ph-badge--avatar" aria-label="Jenn, switch profile"[^>]* data-ph-action="profile" id="dayProfileBadge">/.test(html)
    && !pageHeader({ badge: { icon: '🐥', avatar: true } }).includes(' id=') || html);
}
check('noPrint marks the header no-print; without it the header prints',
  pageHeader({ title: 'Print Week', noPrint: true }).startsWith('<header class="ph ph--standard no-print">')
  && !pageHeader({ title: 'Print Week' }).includes('no-print') || pageHeader({ noPrint: true }));
{
  const step = { prev: { aria: 'Previous day' }, next: { aria: 'Next day' }, titleAction: { aria: 'Copy a day', data: { 'ph-action': 'day-copy' } } };
  const html = pageHeader({ title: 'Tue 6 Oct', step });
  const evil = pageHeader({ title: '<i>x</i>', step: { titleAction: { aria: '"><img>', data: { 'ph-action': 'day-copy' } } } });
  check('step.titleAction draws the title as one button inside the h2 (D27)',
    html.includes('<h2 class="ph-title"><button type="button" class="ph-title-btn" data-ph-action="day-copy" aria-label="Copy a day">Tue 6 Oct</button></h2>')
    && count(html, /class="ph-title-btn"/g) === 1
    && !pageHeader({ title: 'Tue 6 Oct', step: { prev: {}, next: {} } }).includes('ph-title-btn')
    && !/<img|<i>/.test(evil) || [html, evil]);
}
{
  const evil = '<img src=x onerror=alert(1)>"\'';
  const html = pageHeader({ back: { to: evil, data: { 'mny-action': evil, 'bad name': 'x', 'onclick': 'x' } }, title: evil, context: evil,
    actions: [{ label: evil, aria: evil, data: { 'kid': evil } }], badge: { text: evil, icon: evil, aria: evil } });
  const problems = [];
  if (/<img/i.test(html)) problems.push('a tag got through');
  // Text may keep its quotes (escapeHtml); inside a tag none may be raw.
  if (html.replace(/>[^<]*</g, '><').includes('"\'')) problems.push('a quote was written raw into an attribute');
  if (!html.includes('&quot;&#39;')) problems.push('the attribute escaper was not used');
  if (html.includes('bad name')) problems.push('an attribute name with a space was written');
  if (/\sonclick=/.test(html)) problems.push('a handler attribute was written');
  if (!html.includes('data-kid="') || !html.includes('data-onclick="x"')) problems.push('safe data names were dropped');
  check('every slot is escaped and a bad data name is dropped', problems.length ? problems.concat(html) : true);
}

// ── The kit's classes ──────────────────────────────────────────────────────
// Every .ui-* and .ph-* class the kit adds to css/app.css, listed by name: the
// smoke check theComponentKitHoldsItsSizes finds each one's rule in the live
// stylesheet, and this list is also what tests/check-dead-css.js reads while
// no screen uses the kit yet (PRs 4–12 replace that with real markup).
const UI_KIT_CLASSES = ['ui-btn', 'ui-btn--primary', 'ui-btn--secondary', 'ui-btn--icon', 'ui-btn--danger', 'ui-btn--lg', 'ui-btn--two-line',
  'ui-chip', 'ui-tabs', 'ui-card', 'ui-sect-head', 'ui-sheet', 'ui-kids', 'ui-stepper'];
{
  const fs = require('fs');
  const path = require('path');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const defined = new Set([...css.matchAll(/\.(ui-[a-z0-9-]+)/g)].map(m => m[1]));
  const missing = UI_KIT_CLASSES.filter(c => !defined.has(c));
  const unlisted = [...defined].filter(c => !UI_KIT_CLASSES.includes(c));
  check('every listed kit class has a rule and every .ui-* rule is listed', missing.length || unlisted.length ? { missing, unlisted } : true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
