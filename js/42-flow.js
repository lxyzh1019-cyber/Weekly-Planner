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

   `mnyWalletCard` (js/22-money-page1.js) still leads with "Everything I have",
   and that is correct and unchanged: it is the page where she checks a figure
   before deciding something. This is the page where she finds out how it got
   there. Two questions, two screens.

   ── It owns no arithmetic ──

   Every number comes from `evFlow` / `evMonths` / `evTypicalMonth`
   (js/40-stream.js), which are pure, unit-tested in `tests/stream.test.js`,
   and were written in Stage 1 with exactly this screen in mind. A second place
   that decides what "came in" means is a second place that can disagree with
   the first — the defect this repo keeps recording. This file arranges and
   labels; it never sums a movement itself.

   ── Three periods, one question ──

   | This month | what is happening now |
   | All of it  | the whole history, since the family began |
   | A typical month | every ribbon divided by the months that PASSED |

   The third is the one that answers "am I doing all right", and `evTypicalMonth`
   divides by elapsed months rather than months holding events — deliberately,
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

/* Where money went, in the order a child should read it: what she chose to put
   away first, then what left for good. `loan` is last because paying a debt
   down is neither saving nor spending and reads oddly beside either. */
const FL_DEST_ORDER = ['ready', 'locked', 'invest', 'spent', 'fine', 'loan'];
const FL_SAVED_DESTS = ['ready', 'locked', 'invest'];

/* One hue per ribbon, matched to the pots they name on 💰 My money so the two
   screens cannot be telling a child about different things. */
const FL_COLOURS = {
  earned: '#95d5b2', prize: '#ff9eb5', gift: '#c9a6e8', borrowed: '#f2b880',
  interest: '#bdbdbd', typed: '#d6d6d6', opening: '#d6d6d6',
  ready: '#6fb1fc', locked: '#8ad8d0', invest: '#b0a0ea',
  spent: '#ffd166', fine: '#e08e8e', loan: '#f2b880',
};

function flColour(key) { return FL_COLOURS[String(key)] || '#bdbdbd'; }
function flSourceLabel(key) { return EV_SOURCE_LABELS[key] || { icon: '💰', label: String(key) }; }
function flDestLabel(key) { return EV_DEST_LABELS[key] || { icon: '💰', label: String(key) }; }

/* ── What period is on screen ──────────────────────────────────── */

/* Every month the family has any money in, oldest first. Read once per render
   and handed to both the strip and the picker, because calling `evMonths`
   twice is a second answer waiting to happen. */
function flMonthsFor(kid) {
  return (typeof evMonths === 'function') ? evMonths(kid) : [];
}

function flCurrentMonth(months) {
  if (!months.length) return null;
  const keys = months.map(m => m.month);
  if (flMonth && keys.indexOf(flMonth) >= 0) return flMonth;
  return keys[keys.length - 1];
}

/* The flow being drawn. One function, so the sentence, the two bars and the
   footnote can never describe different spans. */
function flFlowFor(kid, months) {
  if (flPeriod === 'typical') return evTypicalMonth(kid);
  if (flPeriod === 'all') return evFlow(kid);
  const key = flCurrentMonth(months);
  if (!key) return evFlow(kid);
  return months.find(m => m.month === key) || evFlow(kid);
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
   much of each" and a child's first question is "what happened". */
function flStory(flow, periodWords) {
  const saved = money2(FL_SAVED_DESTS.reduce((s, k) => s + money2(flow.dests[k] || 0), 0));
  const out = money2(flow.outTotal);
  const bits = [];
  bits.push(`${mnyMoney(flow.inTotal)} came in`);
  if (out > 0) bits.push(`${mnyMoney(out)} went out`);
  if (saved > 0) bits.push(`${mnyMoney(saved)} went somewhere to grow`);
  /* "Left" is a BALANCE, not in-minus-out: she may have had money before the
     span started. Saying it as a subtraction would be arithmetic a child could
     check and find wrong. */
  return `${escapeHtml(periodWords)}, ${bits.join(', ')}. You have ${mnyMoney(flow.inHand)} in cash right now.`;
}

/* ── A ribbon row ──────────────────────────────────────────────────
   Label, bar, amount — on one line at every width. The bar is proportional to
   the biggest ribbon in ITS OWN group, not to the grand total: an "in" group
   and an "out" group with one scale between them would draw a $2 fine as an
   invisible sliver next to $40 of jobs, which is the one row a child most
   needs to see. The totals under each group are what compare the two. */
function flRibbonRows(entries) {
  const rows = entries.filter(e => money2(e.value) > 0);
  if (!rows.length) return '';
  const max = rows.reduce((m, e) => Math.max(m, money2(e.value)), 0);
  return rows.map(e => {
    const pct = Math.max(4, Math.round((money2(e.value) / max) * 100));
    return `<div class="fl-row">
        <span class="fl-row-name">${e.icon} ${escapeHtml(e.label)}</span>
        <span class="fl-track"><span class="fl-bar" style="width:${pct}%;background:${escapeAttr(e.colour)}"></span></span>
        <b class="fl-row-amt">${mnyMoney(e.value)}</b>
      </div>`;
  }).join('');
}

function flSourceRows(flow) {
  return flRibbonRows(EV_SOURCES.map(k => {
    const l = flSourceLabel(k);
    return { icon: l.icon, label: l.label, value: flow.sources[k] || 0, colour: flColour(k) };
  }));
}
function flDestRows(flow) {
  return flRibbonRows(FL_DEST_ORDER.map(k => {
    const l = flDestLabel(k);
    return { icon: l.icon, label: l.label, value: flow.dests[k] || 0, colour: flColour(k) };
  }));
}

/* ── The history strip ─────────────────────────────────────────────
   Every month since the family began, oldest first, each column stacked by
   where that month's money came from and scaled against the busiest month. An
   EMPTY month keeps its column: a summer with no jobs is something to see, and
   a month silently dropped reads as a month that did not happen.

   One tappable control per month, 44px wide, which is also what makes the
   strip a picker rather than a picture. */
function flHistoryStrip(months, selected) {
  if (months.length < 2) return '';
  const max = months.reduce((m, mo) => Math.max(m, money2(mo.inTotal)), 0);
  const cols = months.map(mo => {
    const on = mo.month === selected && flPeriod === 'month';
    const stack = max > 0 ? EV_SOURCES.map(k => {
      const v = money2(mo.sources[k] || 0);
      if (!(v > 0)) return '';
      return `<span class="fl-seg" style="height:${(v / max) * 100}%;background:${escapeAttr(flColour(k))}"></span>`;
    }).join('') : '';
    return `<button type="button" class="fl-col${on ? ' on' : ''}${mo.empty ? ' empty' : ''}"
        data-fl-action="month" data-fl-month="${escapeAttr(mo.month)}"
        aria-label="${escapeAttr(flMonthLabel(mo.month) + ' — ' + mnyMoney(mo.inTotal) + ' came in')}">
        <span class="fl-stack">${stack}</span>
        <span class="fl-col-name">${flMonthShort(mo.month)}</span>
      </button>`;
  }).join('');
  return `<div class="fl-strip-wrap">
      <div class="fl-strip">${cols}</div>
      <div class="fl-note">Every month since you started. Taller means more came in that month —
      an empty one is a month where nothing did, which is worth seeing too.</div>
    </div>`;
}

/* ── The screen ────────────────────────────────────────────────── */
function flRenderFlow(kid) {
  const months = flMonthsFor(kid);
  const selected = flCurrentMonth(months);
  const flow = flFlowFor(kid, months);

  const periodWords = flPeriod === 'typical'
    ? `In a typical month, across the ${flow.months} ${flow.months === 1 ? 'month' : 'months'} you have been going`
    : flPeriod === 'all' ? 'Since the very beginning'
    : `In ${flMonthLabel(selected || todayKey().slice(0, 7))}`;

  const chips = FL_PERIODS.map(p =>
    `<button type="button" class="fl-chip${flPeriod === p.id ? ' on' : ''}"
       data-fl-action="period" data-fl-id="${p.id}">${escapeHtml(p.label)}</button>`).join('');

  const inRows = flSourceRows(flow);
  const outRows = flDestRows(flow);

  /* Nothing recorded is a real state and it has TWO causes that need different
     answers: a family that has not run the set-up yet, and a child who simply
     has not earned anything in the month she is looking at. Saying "nothing
     here" for both would send a parent looking for a bug in the second case. */
  if (!inRows && !outRows) {
    const anyAtAll = (typeof evList === 'function') && evList(kid).length > 0;
    return `<div class="mny-card">
        <div class="mny-label">🌊 Where your money goes</div>
        <div class="fl-empty">${anyAtAll
          ? 'Nothing moved in this one. Try <b>All of it</b> to see the whole story.'
          : 'Your money story starts the first time a week is settled or something is given to you. Nothing yet — that is just the beginning, not a problem.'}</div>
        ${anyAtAll ? `<div class="fl-chiprow">${chips}</div>` : ''}
      </div>`;
  }

  return `<div class="mny-card">
      <div class="mny-label">🌊 Where your money goes</div>
      <div class="fl-chiprow">${chips}</div>
      <p class="fl-story">${flStory(flow, periodWords)}</p>

      <div class="fl-group">
        <div class="fl-cap">⬇️ What came in <b>${mnyMoney(flow.inTotal)}</b></div>
        ${inRows || '<div class="fl-empty">Nothing came in.</div>'}
      </div>

      <div class="fl-group">
        <div class="fl-cap">➡️ Where it went <b>${mnyMoney(flow.outTotal)}</b></div>
        ${outRows || '<div class="fl-empty">None of it has gone anywhere yet — it is all still cash.</div>'}
      </div>

      <div class="fl-left">
        <span>💵 Left as cash, right now</span><b>${mnyMoney(flow.inHand)}</b>
      </div>
      <div class="fl-note">This last number is not what came in take away what went out —
      you had money before this ${flPeriod === 'all' ? 'story' : 'month'} started, and that counts too.</div>
    </div>
    ${flHistoryStrip(months, selected)}`;
}

/* ── Events ────────────────────────────────────────────────────────
   Delegated, and on data attributes rather than inline handlers: a month key
   is derived from a stored dayKey, which arrives off a world-writable
   document. Same reasoning as the chore strip. */
function flHandleClick(e) {
  const el = e.target.closest('[data-fl-action]');
  if (!el) return;
  const a = el.getAttribute('data-fl-action');
  if (a === 'period') { flPeriod = el.getAttribute('data-fl-id'); mnyRenderStory(); return; }
  if (a === 'month') {
    /* Tapping a column always means "show me this month", so it selects the
       period as well. Selecting a month and leaving the screen on "all of it"
       would be a control that appears to do nothing. */
    flMonth = el.getAttribute('data-fl-month');
    flPeriod = 'month';
    mnyRenderStory();
  }
}
