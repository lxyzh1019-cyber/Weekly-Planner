/* ════════════════════════════════════════════════════════════════
   THE FLOW — money is something that MOVES
   ════════════════════════════════════════════════════════════════

   Stage 4 of the money redesign, and the reason Stage 1 stored movements
   instead of balances. Until now nothing on any screen read the stream.

   ── What this screen is for ──

   The owner's instruction, in their words: *I do not want the kids to see the
   end money, they need to understand the cash flow — they earn, they spend,
   they save, they have left.*

   So this screen does NOT lead with a total. A child watching a total learns
   to watch a total: it goes up, which is good, and down, which is bad, and she
   learns nothing about why either happened. **The movement is the headline and
   the balance is the consequence** — `flStory` says what came in, what went
   out, what was put away and what is left, in that order, in one sentence
   before any bar is drawn.

   `mnyEverythingCard` (js/22-money-page1.js) still leads with "Everything I have",
   and that is correct and unchanged: it is the page where she checks a figure
   before deciding something. This is the page where she finds out how it got
   there. Two questions, two screens.

   ── Where its numbers come from (build 2026-10-06c) ──

   The FROZEN ledger: every settled Sunday, read through `sdHistGroups`
   (js/43, the reader 📖 All my Sundays and the meeting's "My last 4 Sundays"
   use), and put in the month its Sunday falls in — so the 4 Oct Sunday is
   October's, and a month here is exactly the Sundays All my Sundays lists
   for it. It read the event stream until 2026-10-06c; the stream books a
   settled week on its Monday and has nothing for a week written straight
   into the ledger, so October showed "I earned $0.00" beside a Sunday that
   paid $30.00. One reader of a Sunday, one month for it. This file groups and
   adds those readings; it decides nothing about what a Sunday paid.

   ── Three periods, one question ──

   | This month | what is happening now |
   | All of it  | the whole history, since the family began |
   | A typical month | every ribbon divided by the months that PASSED |

   The third is the one that answers "am I doing all right", and it divides
   by elapsed months rather than months holding Sundays — deliberately,
   because dividing by months with data turns a quiet summer into a good one.

   ── The history strip ──

   One column per calendar month, oldest on the left, each stacked by where the
   money came FROM. An empty month is drawn as an empty column rather than
   skipped: a gap is a fact, and a month missing from a chart reads as a month
   that did not happen. This is the part that makes a year legible at a glance,
   and it is why "only this month" was not enough.
   ════════════════════════════════════════════════════════════════ */

/* Device-local, never synced state: every state write is a full-document
   upload, and which period a child last looked at is not the family's data. */
let flPeriod = 'month';          // 'month' | 'all' | 'typical'
let flMonth = null;              // the month key when flPeriod === 'month'

const FL_PERIODS = [
  { id: 'month',   label: 'This month' },
  { id: 'all',     label: 'All of it' },
  { id: 'typical', label: 'A typical month' },
];

/* One hue per ribbon, matched to the pots they name on 💰 My money so the two
   screens cannot be telling a child about different things. */
const FL_COLOURS = {
  earned: 'var(--mny-v15-bar)', gift: 'var(--mny-v15-gold)', made: 'var(--mny-flow-interest)',
  off: 'var(--mny-flow-fine)',
  loan: 'var(--mny-v15-wall)', spent: 'var(--mny-v15-cash)',
  ready: 'var(--mny-v15-saved)', locked: 'var(--mny-flow-locked)', invest: 'var(--mny-v15-made)',
};

/* ── The months, from the frozen ledger ─────────────────────────── */

/* The month a settled week belongs to: the month of its Sunday (the money
   week runs Monday–Sunday and is paid that Sunday — decision 15). */
function flSundayMonth(weekKey) { return sdSundayOf(weekKey).slice(0, 7); }

/* What a set of settled Sundays add up to, in the page's groups. Came in:
   💪 earned (🏠 / ⛸️ / 🏆 where the row kept the split), 🎁 given, 🌱 made,
   ➖ taken off — so "came in" is what the Sundays added. Went out: 🧱 to
   the loan wall, 🛍️ spent. Put away to grow: 🏦 Savings (goal jars inside
   it), 🔒 Locked away, 📈 Companies. `div` makes a typical month: each
   figure divided first, so every caption is still the sum of its rows. */
function flSum(rows, div) {
  const n = v => money2(Number(v) || 0);
  const d = Math.max(1, Number(div) || 1);
  const t = { earned: 0, home: 0, club: 0, comp: 0, split: false, given: 0, made: 0, off: 0,
              loan: 0, spent: 0, ready: 0, locked: 0, invest: 0 };
  rows.forEach(r => {
    const g = mnySundayGroups(r);
    t.earned += n(g.earned); t.given += n(g.given); t.made += n(g.made); t.off += Math.max(0, -n(g.off));
    if (g.home != null) { t.split = true; t.home += n(g.home); t.club += n(g.club); t.comp += n(g.comp); }
    t.loan += n((r.loan || {}).paid) + n(r.extra != null ? r.extra : r.debtExtra);
    t.spent += n(r.spend);
    t.ready += n(r.ready) + n(r.goal); t.locked += n(r.gic); t.invest += n(r.stock);
  });
  Object.keys(t).forEach(k => { if (typeof t[k] === 'number') t[k] = money2(t[k] / d); });
  t.inTotal = money2(t.earned + t.given + t.made - t.off);
  t.outTotal = money2(t.loan + t.spent);
  t.savedTotal = money2(t.ready + t.locked + t.invest);
  t.count = rows.length;
  return t;
}

/* Every month from her first settled Sunday to this month, oldest first. A
   month with no Sunday is still there, marked `empty`: a gap is a fact, and
   a month silently missing from a chart reads as a month that did not happen. */
function flMonthsFor(kid) {
  const rows = mnyLedgerRows(kid);
  if (!rows.length) return [];
  const keys = rows.map(r => flSundayMonth(r.weekKey)).sort();
  const now = todayKey().slice(0, 7);
  const last = keys[keys.length - 1] > now ? keys[keys.length - 1] : now;
  const out = [];
  let [y, m] = keys[0].split('-').map(Number);
  for (let guard = 0; guard < 600; guard++) {
    const key = y + '-' + String(m).padStart(2, '0');
    const these = rows.filter(r => flSundayMonth(r.weekKey) === key);
    out.push(Object.assign({ month: key, empty: !these.length }, flSum(these)));
    if (key >= last) break;
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

/* The month on screen: the one she picked, else the newest with a Sunday. */
function flCurrentMonth(months) {
  if (!months.length) return null;
  if (flMonth && months.some(m => m.month === flMonth)) return flMonth;
  const full = months.filter(m => !m.empty);
  return (full.length ? full[full.length - 1] : months[months.length - 1]).month;
}

/* The flow being drawn. One function, so the sentence, the bars and the
   strip can never describe different spans. */
function flFlowFor(kid, months) {
  const rows = mnyLedgerRows(kid);
  if (flPeriod === 'typical') return Object.assign(flSum(rows, months.length), { months: months.length });
  if (flPeriod === 'all') return flSum(rows);
  const key = flCurrentMonth(months);
  return months.find(m => m.month === key) || flSum([]);
}

function flMonthLabel(m) {
  const [y, mm] = String(m).split('-').map(Number);
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July',
          'August', 'September', 'October', 'November', 'December'][mm - 1] + ' ' + y;
}
function flMonthShort(m) {
  const [, mm] = String(m).split('-').map(Number);
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mm - 1];
}

/* ── The sentence ──────────────────────────────────────────────────
   Said in words before anything is drawn, because a bar chart answers "how
   much of each" and a child's first question is "what happened". In the four
   groups My money and the passbook use — 💪 earned, 🎁 given, 🌱 made, ➖
   taken off — then what went out and what was put away to grow. No balance:
   what is waiting right now is My money's 📥 door, not this page's. */
function flStory(flow, periodWords) {
  const groups = `💪 I earned ${mnyMoney(flow.earned)}, 🎁 I was given ${mnyMoney(flow.given)}, 🌱 my money made ${mnyMoney(flow.made)} and ➖ ${mnyMoney(flow.off)} was taken off.`;
  const after = [];
  if (flow.outTotal > 0) after.push(`${mnyMoney(flow.outTotal)} went out`);
  if (flow.savedTotal > 0) after.push(`${mnyMoney(flow.savedTotal)} was put away to grow`);
  return `${escapeHtml(periodWords)}: ${groups}${after.length ? ' ' + after.join(' and ') + '.' : ''}`;
}

/* ── A ribbon row ──────────────────────────────────────────────────
   Label, bar, amount — on one line at every width. The bar is proportional to
   the biggest ribbon in ITS OWN group, not to the grand total: an "in" group
   and an "out" group with one scale between them would draw a $2 fine as an
   invisible sliver next to $40 of jobs, which is the one row a child most
   needs to see. The totals under each group are what compare the two.
   `always` rows show at $0 too (the four came-in groups, as drawn); a `sub`
   row is a part of the row above it — no bar, and not added again. */
function flRibbonRows(entries) {
  const rows = entries.filter(e => e.always || e.sub || money2(e.value) > 0);
  const max = rows.filter(e => !e.sub).reduce((m, e) => Math.max(m, money2(e.value)), 0);
  return rows.map(e => {
    if (e.sub) {
      return `<div class="fl-row fl-subrow"><span class="fl-row-name">${e.icon} ${escapeHtml(e.label)}</span>
          <span class="fl-sub-amt">${mnyMoney(e.value)}</span></div>`;
    }
    const v = money2(e.value);
    const pct = v > 0 && max > 0 ? Math.max(4, Math.round((v / max) * 100)) : 0;
    return `<div class="fl-row">
        <span class="fl-row-name">${e.icon} ${escapeHtml(e.label)}</span>
        <span class="fl-track"><span class="fl-bar" style="width:${pct}%;background:${escapeAttr(e.colour)}"></span></span>
        <b class="fl-row-amt">${e.minus && v > 0 ? '−' : ''}${mnyMoney(v)}</b>
      </div>`;
  }).join('');
}

function flInRows(f) {
  const sub = (icon, label, value) => ({ icon, label, value, sub: true });
  return flRibbonRows([
    { icon: '💪', label: 'Money I earned', value: f.earned, colour: FL_COLOURS.earned, always: true },
    ...(f.split ? [sub('🏠', 'Home · chores and routine', f.home), sub('⛸️', 'Club job', f.club), sub('🏆', 'Competitions', f.comp)] : []),
    { icon: '🎁', label: 'Money I was given', value: f.given, colour: FL_COLOURS.gift, always: true },
    { icon: '🌱', label: 'Money my money made', value: f.made, colour: FL_COLOURS.made, always: true },
    { icon: '➖', label: 'Taken off', value: f.off, colour: FL_COLOURS.off, always: true, minus: true },
  ]);
}
function flOutRows(f) {
  return flRibbonRows([
    { icon: '🧱', label: 'To my loan wall', value: f.loan, colour: FL_COLOURS.loan },
    { icon: '🛍️', label: 'Spent', value: f.spent, colour: FL_COLOURS.spent },
  ]);
}
function flGrowRows(f) {
  return flRibbonRows([
    { icon: '🏦', label: 'Savings', value: f.ready, colour: FL_COLOURS.ready },
    { icon: '🔒', label: 'Locked away', value: f.locked, colour: FL_COLOURS.locked },
    { icon: '📈', label: 'Companies', value: f.invest, colour: FL_COLOURS.invest },
  ]);
}

/* ── The history strip ─────────────────────────────────────────────
   Every month since her first Sunday, oldest first, each column stacked by
   where that month's money came from and scaled against the busiest month. An
   EMPTY month keeps its column: a summer with no jobs is something to see, and
   a month silently dropped reads as a month that did not happen. The columns
   share the card's width and take the height left under the groups, so the
   strip fills the card (BUILD-SPEC §0: no empty band).

   One tappable control per month, 44px or more each way, which is also what
   makes the strip a picker rather than a picture. */
function flHistoryStrip(months, selected) {
  if (months.length < 2) return '';
  const came = mo => money2(mo.earned + mo.given + mo.made);
  const max = months.reduce((m, mo) => Math.max(m, came(mo)), 0);
  const cols = months.map(mo => {
    const on = mo.month === selected && flPeriod === 'month';
    const stack = max > 0 ? [['earned', mo.earned], ['gift', mo.given], ['made', mo.made]].map(([k, v]) =>
      v > 0 ? `<span class="fl-seg" style="height:${(v / max) * 100}%;background:${escapeAttr(FL_COLOURS[k])}"></span>` : '').join('') : '';
    return `<button type="button" class="fl-col${on ? ' on' : ''}${mo.empty ? ' empty' : ''}"
        data-fl-action="month" data-fl-month="${escapeAttr(mo.month)}"
        aria-label="${escapeAttr(flMonthLabel(mo.month) + ' — ' + mnyMoney(came(mo)) + ' came in')}">
        <span class="fl-stack">${stack}</span>
        <span class="fl-col-name">${flMonthShort(mo.month)}</span>
      </button>`;
  }).join('');
  return `<div class="fl-strip-wrap">
      <div class="fl-strip">${cols}</div>
      <div class="fl-note">Every month since my first Sunday. Taller means more came in that month; tap one to see it.</div>
    </div>`;
}

/* ── The page ─────────────────────────────────────────────────────
   📊 By month — the passbook's second door (decision 14), drawn under My
   money's head by `mnyRenderHistory` (js/22): one card, the groups on top
   and every month along the bottom, filling the screen. */
function flRenderFlow(kid) {
  const months = flMonthsFor(kid);
  const head = `<div class="mv2-cardhead"><span class="mv2-title">📊 By month</span></div>`;
  if (!months.length) {
    return `<div class="mv2-flow mv2-flow--empty"><div class="mv2-card mv2-flow-main">
        ${head}
        <div class="fl-empty">My money story starts the first time a Sunday is signed. Nothing yet: that is just the beginning, not a problem.</div>
      </div></div>`;
  }
  const selected = flCurrentMonth(months);
  const flow = flFlowFor(kid, months);

  const periodWords = flPeriod === 'typical'
    ? `In a typical month, across the ${flow.months} ${flow.months === 1 ? 'month' : 'months'} you have been going`
    : flPeriod === 'all' ? 'Since the very beginning'
    : `In ${flMonthLabel(selected)}`;

  const chips = FL_PERIODS.map(p =>
    `<button type="button" class="mv2-btn${flPeriod === p.id ? ' on' : ''}"
       data-fl-action="period" data-fl-id="${p.id}" aria-pressed="${flPeriod === p.id}">${escapeHtml(p.label)}</button>`).join('');
  const outRows = flOutRows(flow), growRows = flGrowRows(flow);
  return `<div class="mv2-flow">
    <div class="mv2-card mv2-flow-main">
      ${head}
      <div class="fl-chiprow">${chips}</div>
      <p class="fl-story">${flStory(flow, periodWords)}</p>

      <div class="fl-group">
        <div class="fl-cap">⬇️ What came in <b>${mnyMoney(flow.inTotal)}</b></div>
        ${flInRows(flow)}
      </div>

      <div class="fl-group">
        <div class="fl-cap">➡️ What went out <b>${mnyMoney(flow.outTotal)}</b></div>
        ${outRows || '<div class="fl-empty">Nothing went out.</div>'}
      </div>

      <div class="fl-group">
        <div class="fl-cap">🌱 Put away to grow <b>${mnyMoney(flow.savedTotal)}</b></div>
        ${growRows || '<div class="fl-empty">Nothing was put away to grow.</div>'}
      </div>
      ${flHistoryStrip(months, selected)}
    </div>
  </div>`;
}

/* ── Events ────────────────────────────────────────────────────────
   Delegated, and on data attributes rather than inline handlers: a month key
   is derived from a stored dayKey, which arrives off a world-writable
   document. Same reasoning as the chore strip. */
function flHandleClick(e) {
  const el = e.target.closest('[data-fl-action]');
  if (!el) return;
  const a = el.getAttribute('data-fl-action');
  if (a === 'period') { flPeriod = el.getAttribute('data-fl-id'); mnyRenderHistory(); return; }
  if (a === 'month') {
    /* Tapping a column always means "show me this month", so it selects the
       period as well. Selecting a month and leaving the screen on "all of it"
       would be a control that appears to do nothing. */
    flMonth = el.getAttribute('data-fl-month');
    flPeriod = 'month';
    mnyRenderHistory();
  }
}
