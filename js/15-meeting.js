// Weekly-Planner — meeting mode: guided 4-step weekly family meeting.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   2c / 1b / 2b — MEETING MODE: a guided 4-step weekly family meeting
   (Review → Celebrate → Confirm → Plan next week). Reuses the existing
   money commit (commitFamilyMeeting) and adds an undo window.
════════════════════════════════════════════════════════════════ */
/* Five steps since the money system was redesigned. The old single "Confirm"
   step did two different jobs badly: it agreed the week AND moved the money in
   one press, which meant a correction after the fact had to be unwound. Steps
   3 and 4 (js/23-money-meeting.js) separate them — 3 agrees the numbers, 4
   decides where they go and is the only thing that moves money. */
const MM_STEPS = ['Review', 'Celebrate', 'What I earned', 'What I do with it', 'Plan next'];
let mmStep = 1;
let mmSelectedDay = null;
let mmUndo = null;
let mmAddChoreFor = null;   // "kid|dayIdx" whose add-a-chore picker is open
let mmCatchUpAsked = false; // the catch-up question, asked once per page load

/* ── Catching up a week ──
   Eight weeks sat unopened, and the reason is not that the meeting is hard to
   use once it is open — it is that a five-step sitting is the wrong shape for a
   week that finished a month ago and that nobody is going to discuss. This is
   the same commit reached by a shorter road: totals, adjust, close, next.

   It is deliberately NOT a second way to move money. Everything below routes
   through commitFamilyMeeting, exactly as step 4 does, and mmMarkWeekMet stays
   the separate record of having sat down — the two facts do not imply each
   other here any more than they do anywhere else. */
let mmExpressWeek = null;   // week key while the catch-up screen is open
let mmExpressMoney = true;  // tick 1 — record the money
let mmExpressMet = false;   // tick 2 — we talked about this week together

function openFamilyMeeting() {
  if (!isParent()) { showToast('Parents run the family meeting 🔒'); return; }
  ctEnsureShared();
  mmStep = 1; mmMaxStep = 1; mmSelectedDay = null; mmUndo = null;
  mmClearReturn();        // a fresh sitting has nowhere to go back to
  mmExpressWeek = null;   // the full sitting, not the catch-up run
  renderMeetingMode();
  openSheet('familyMeetingOverlay');
}

// Day-confirm in the meeting persists to the real parent day-confirm store
// (state.shared.parentDayConfirm), shared with the Weekly Review tab. A meeting
// day is "confirmed" when it's confirmed for BOTH kids.
function mmDayKey(d) { return ctWeekInfo().keys[d]; }
function mmIsDayConfirmed(d) {
  const k = mmDayKey(d);
  const store = state.shared.parentDayConfirm || {};
  return !!((store.jenn || {})[k]) && !!((store.jess || {})[k]);
}
/* Reviewing a day is a fact about ONE child. This wrote both girls' entries
   from a single press, which is where "Confirm all" quietly came to mean "both
   children": a parent who had looked at Jenn's Tuesday and never opened Jess's
   left a record saying she had reviewed both.

   The all-in-one press survives as an explicit "Both" control — it is a real
   thing to want when a day genuinely was fine for everyone — but it now says
   so on the button instead of being what a per-day tick happened to do. */
function mmIsDayReviewedFor(kid, d) { return isDayReviewed(kid, mmDayKey(d)); }
function mmToggleDayReviewed(kid, d) {
  const k = mmDayKey(d);
  markDayReviewed(kid, k, !isDayReviewed(kid, k));
  saveAll();
  renderMeetingMode();
}
function mmToggleConfirmDay(d) {
  const k = mmDayKey(d);
  const next = !mmIsDayConfirmed(d);
  ['jenn', 'jess'].forEach(kid => markDayReviewed(kid, k, next));
  saveAll();
  renderMeetingMode();
}
/* How far this sitting actually got. "We met" means the family reviewed the
   week together, and the honest evidence for that is reaching step 3 — Review,
   Celebrate, then agreeing what was earned. Steps 1-2 alone is opening the
   sheet and looking at it. Reset whenever the meeting points at a new week. */
let mmMaxStep = 1;
function mmGoStep(n) {
  mmStep = Math.max(1, Math.min(MM_STEPS.length, n));
  mmMaxStep = Math.max(mmMaxStep, mmStep);
  renderMeetingMode();
}
/* Called when the meeting sheet is closed. Records that the family sat down —
   nothing else. The money is step 4's to move, and a week closed at step 3 is
   exactly the case that used to leave no trace at all. */
function mmCloseMeeting() {
  const wk = mmWeekKey();
  // mmMaxStep never leaves 1 in catch-up mode, so this cannot fire there — a
  // week closed from the catch-up screen is only "met" if that box was ticked.
  if (mmMaxStep >= 3 && isParent() && !mmIsSettled(wk)) mmMarkWeekMet(wk);
  mmExpressWeek = null;
  // Nothing to come back to once the sitting is over, so the week and day
  // screens get their Hub button and their switchers back.
  mmClearReturn();
  closeSheet('familyMeetingOverlay');
  const hub = document.getElementById('meetingHub');
  if (hub && document.getElementById('screen-parent')?.classList.contains('active')) renderMeetingHub();
}

/* ── Catching up on a week nobody got to ──────────────────────────
   The meeting has always run on whatever week `ctWeekKey` points at, so
   settling a past week already worked — it was just invisible. Nothing named
   the week on screen, so three catch-ups in a row looked identical while step 4
   moved real money, and nothing anywhere said a week had been skipped.

   Editability needs no new rule: mnyReopenWeek already reopens any week that
   is not committed, and a skipped week never got committed. So a blank past
   week is open by construction — these functions only make that visible, and
   give a blank week something to tick. */
function mmWeekLabel(wk) {
  const mon = formatDayKey(wk);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return `${MONTH_SHORT[mon.getMonth()]} ${mon.getDate()} – ${MONTH_SHORT[sun.getMonth()]} ${sun.getDate()}`;
}
/* The last week that was actually recorded. A family that meets most Sundays
   never needs this; a family sitting down after a busy fortnight needs it
   before anything else, because "which week did we last do?" is the first
   question at the table and nothing on screen answered it. */
function mmLastReviewed() {
  ctEnsureShared();
  const held = state.shared.chore.meetingsHeld || {};
  const wks = Object.keys(held).filter(k => held[k]).sort();
  if (!wks.length) return null;
  const wk = wks[wks.length - 1];
  return { wk, weeksAgo: mrWeeksSince(wk) };
}
function mmWeeksAgoWord(n) {
  return n === 0 ? 'this week' : n === 1 ? 'a week ago' : `${n} weeks ago`;
}
function mmLastReviewedLine() {
  const last = mmLastReviewed();
  const rows = mmUnsettledWeeks(8);
  const unopened = rows.filter(x => x.status === 'none').length;
  const met = rows.length - unopened;
  /* Counted separately on purpose. Lumping them together is what made two
     meetings read as eight missed ones: a week the family sat down for is not
     a week nobody got to, it is a week whose money is still waiting. */
  const parts = [];
  if (unopened) parts.push(`${unopened} earlier week${unopened === 1 ? '' : 's'} not yet opened`);
  if (met) parts.push(`${met} met but not paid out`);
  const gap = parts.length ? ` · ${parts.join(' · ')}` : '';
  if (!last) {
    const text = parts.length ? `No week has been settled yet${gap}` : 'No week has been settled yet.';
    return `<div class="mm-weekbar-last">${escapeHtml(text)}</div>`;
  }
  // Dates and counts only — no user text on this line.
  const text = `Last settled: ${mmWeekLabel(last.wk)} · ${mmWeeksAgoWord(last.weeksAgo)}${gap}`;
  return `<div class="mm-weekbar-last">${escapeHtml(text)}</div>`;
}
/* The week this meeting is about, always on screen, with where the family left
   off underneath it. The sheet's own title is the static "Weekly family
   meeting", which is true of every week and so identifies none of them. */
function mmWeekBar(wk) {
  const late = mrWeeksSince(wk);
  const label = `Week of ${mmWeekLabel(wk)}`;   // from date tables, no user text
  const head = late
    ? `<span class="mm-weekbar-wk">${escapeHtml(label)}</span>
       <span class="mm-weekbar-late">⏪ catching up · ${late} week${late === 1 ? '' : 's'} ago</span>
       <button type="button" class="mm-weekbar-btn" data-mm-action="thisweek">This week ▶</button>`
    : `<span class="mm-weekbar-wk">${escapeHtml(label)}</span>
       <span class="mm-weekbar-now">this week</span>`;
  return `<div class="mm-weekbar${late ? ' late' : ''}">
      <div class="mm-weekbar-head">${head}</div>${mmLastReviewedLine()}</div>`;
}
/* ── The question, when the meeting is opened to be run ──
   Deliberately not part of openFamilyMeeting. Half of that function's callers
   are deep links — a specific day from the hub's strip, step 3 to show an
   override, the tab rail jumping to "What I earned" — and a question about a
   different week on top of one of those is a question about something the
   parent did not ask for. So this hangs off the three "run the meeting"
   buttons, and openFamilyMeeting stays exactly as it was.

   Asked once per page load: a parent who says not now has answered, the hub's
   list is still sitting there, and next Sunday is a new load. */
function mmMaybeAskCatchUp() {
  if (mmCatchUpAsked || !isParent()) return;
  if (mmWeekKey() !== ctThisWeekKey()) return;   // already looking at a past week
  const open = mmUnsettledWeeks(8);
  if (!open.length) return;
  mmCatchUpAsked = true;
  const last = mmLastReviewed();
  const nearest = open[0];
  const unopened = open.filter(x => x.status === 'none').length;
  const met = open.length - unopened;
  const where = last
    ? `Last settled: week of ${mmWeekLabel(last.wk)} — ${mmWeeksAgoWord(last.weeksAgo)}.`
    : 'No week has been settled yet.';
  /* Says which kind of open each week is. It used to call all of them "never
     settled", which told a family who had sat down twice that they had missed
     eight weeks — the app disagreeing with something they had actually done. */
  const what = [
    unopened ? `${unopened} earlier week${unopened === 1 ? '' : 's'} nobody has opened` : '',
    met ? `${met} you met about but did not pay out` : '',
  ].filter(Boolean).join(', and ');
  const msg = `${where} There ${open.length === 1 ? 'is' : 'are'} ${what}. Open one now?`;
  showChoice(msg, [
    { id: 'nearest', label: `Go to ${mmWeekLabel(nearest.wk)}`,
      sub: nearest.status === 'met'
        ? `${mmWeeksAgoWord(nearest.weeksLate)} — met, money still waiting`
        : `${mmWeeksAgoWord(nearest.weeksLate)} — the most recent one still open` },
    { id: 'now', label: 'Carry on with this week',
      sub: 'The open weeks stay open, and stay editable' },
  ], { cancelLabel: 'Not now' }).then(id => {
    if (id === 'nearest') mmGoToWeek(nearest.wk);
  });
}
/* Step 2 charts the week's blocks and stops there, deliberately: the meeting is
   not a fourth place that lists a day's blocks with ticks beside them —
   CLAUDE.md names that as the mistake, and three such lists have already been
   retired for it. So this is a way THROUGH to the screen that already owns
   them, which is what was missing once a kid could put a blank fortnight back
   in herself: the blocks still need confirming, and confirming is a day-view
   act. Lands on the meeting's week, not on today. */
/* ── Leaving the meeting, and being able to come back ─────────────
   Opening a child's week used to close the meeting and forget everything —
   which week, which step, which child, which day, where you had scrolled to.
   Getting back meant starting the sitting over from step 1.

   Worse, once you landed there THREE buttons offered to take you somewhere
   else: "◀ Hub", the parent's "Switch" and the round profile badge. Every one
   of them silently abandoned the meeting and none of them said so.

   This is the reusable return context. It is deliberately the shape the spec
   named, because Meeting V2 is meant to use it unchanged. It lives in a module
   global rather than synced state: it describes where THIS device is in a
   sitting, and every synced write is a full-document upload. */
let mmReturn = null;

function mmCaptureReturn(kid, dayIdx) {
  const sheet = document.querySelector('#familyMeetingOverlay .sheet');
  mmReturn = {
    source: 'weekly-meeting',
    weekKey: mmWeekKey(),
    step: mmStep,
    child: kid || (typeof mnyMeetingKid === 'function' ? mnyMeetingKid() : 'jenn'),
    selectedDay: (dayIdx == null) ? mmSelectedDay : dayIdx,
    scrollTop: sheet ? sheet.scrollTop : 0,
  };
}
function mmClearReturn() { mmReturn = null; }
function mmHasReturn() { return !!(mmReturn && mmReturn.source === 'weekly-meeting'); }

/* Put the sitting back exactly where it was. The scroll restore waits a frame
   because renderMeetingMode replaces the body wholesale — setting scrollTop on
   the old content would be measured against a height that is about to change. */
function mmReturnToMeeting() {
  if (!mmHasReturn()) { showScreen('parent'); return; }
  const r = mmReturn;
  mmClearReturn();
  if (!isParent()) { showToast('Parents run the family meeting 🔒'); return; }
  ctWeekKey = r.weekKey;
  mmSelectedDay = r.selectedDay;
  if (typeof mnySetMeetKid === 'function') mnySetMeetKid(r.child);
  showScreen('parent');
  const overlay = document.getElementById('familyMeetingOverlay');
  if (!overlay || !overlay.classList.contains('open')) openSheet('familyMeetingOverlay');
  mmStep = Math.max(1, Math.min(MM_STEPS.length, r.step || 1));
  mmMaxStep = Math.max(mmMaxStep, mmStep);
  renderMeetingMode();
  requestAnimationFrame(() => {
    const sheet = document.querySelector('#familyMeetingOverlay .sheet');
    if (sheet) sheet.scrollTop = r.scrollTop || 0;
  });
}

function mmOpenWeekForBlocks(kid) {
  const wk = mmWeekKey();
  mmCaptureReturn(kid);
  closeSheet('familyMeetingOverlay');
  weekOffset = computeWeekOffsetForDayKey(wk);
  parentView(kid);
}

/* Open one DAY from the meeting — same context, plus the day itself, so the
   parent lands on the thing the row was about rather than on the week. */
function mmOpenDayForBlocks(kid, dayIdx) {
  const wk = mmWeekKey();
  const keys = mrWeekDayKeys(wk);
  const dayKey = keys[dayIdx] || keys[0];
  mmCaptureReturn(kid, dayIdx);
  closeSheet('familyMeetingOverlay');
  weekOffset = computeWeekOffsetForDayKey(wk);
  parentViewing = kid;
  currentDayKey = dayKey;
  dayViewAnchorKey = dayKey;
  showScreen('day');
  buildTimeline();
}
/* What the "run the family meeting" buttons call. */
function openFamilyMeetingAsk() {
  openFamilyMeeting();
  mmMaybeAskCatchUp();
}
/* ── "We sat down" is a different fact from "the money moved" ──
   meetingsHeld[wk] is written in exactly one place, commitMeetingShared, and
   only once BOTH kids have finished step 4 — weekPlans[wk][kid].committedAt for
   Jenn AND Jess. So a family that opened the meeting, reviewed the week,
   celebrated it and even agreed the numbers on step 3 recorded nothing at all,
   and "🎉 Finish meeting" left it unset. Two meetings held, and the catch-up
   list still reported every one of the last eight weeks as never settled —
   saturating at its own ceiling, which is where the number 8 came from.

   The same press is what credits the money, so the wallet reading $0.00 while
   the meeting showed real figures was not a second bug: it is this one seen
   from the other end. Step 3 shows ctWeekMoney, a live preliminary figure;
   nothing is in the wallet until step 4.

   So there are two records now. meetingsMet says the family sat down;
   meetingsHeld still says the money moved. Only a week with neither is
   something to nag about. */
function mmEnsureMet() {
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.meetingsMet) c.meetingsMet = {};
  return c.meetingsMet;
}
function mmIsMet(wk) { return !!mmEnsureMet()[wk]; }
function mmIsSettled(wk) {
  ctEnsureShared();
  return !!(state.shared.chore.meetingsHeld || {})[wk];
}
/* Recorded when the meeting is closed having done the reviewing, and by the
   catch-up list's "we did this one" for a week that was run before this
   existed. It records a fact about the family; it never moves money —
   settling is step 4's job and stays there (CLAUDE.md: call an owner, never
   contain one). */
function mmMarkWeekMet(wk, opts) {
  if (!isParent()) { showToast('Parents run the family meeting 🔒'); return false; }
  const met = mmEnsureMet();
  if (met[wk]) return false;
  met[wk] = { at: syncNow(), by: (opts && opts.by) || 'a grown-up' };
  saveAll();
  return true;
}

/* The earliest week worth asking about: the later of the money model's start
   (before it there is nothing to agree or decide — mmKidSettled treats those as
   settled) and the program's start (before it there was no family in the app).
   Whichever is later binds, because a week that fails either test is a week the
   meeting cannot do anything with.

   An "earliest week with any data" floor was tried here too and removed: it
   suppressed genuinely open weeks whenever the first record happened to be
   recent, which is the same class of wrongness as the bug this is fixing —
   the count disagreeing with what the family actually did. programStartDate is
   already the honest answer to "when did this family start". */
function mmCatchUpFloor() {
  ctEnsureShared();
  const c = state.shared.chore;
  const model = String(mrModelStartWeek());
  const program = c.programStartDate ? String(c.programStartDate) : '';
  return program > model ? program : model;
}

/* Weeks behind us and what state each is in, most recent first:
     'none'    nobody opened it   → the only state worth offering
     'met'     the family sat down, the money has not moved
     'settled' done
   Returns only the weeks that are not settled, so existing callers that just
   want a count of open weeks still read correctly. */
function mmUnsettledWeeks(max) {
  ctEnsureShared();
  const floor = mmCatchUpFloor();
  const out = [];
  for (let i = 1; i <= (max || 8); i++) {
    const mon = formatDayKey(ctThisWeekKey()); mon.setDate(mon.getDate() - i * 7);
    const wk = ctDateToKey(mon);
    if (String(wk) < floor) break;
    if (mmIsSettled(wk)) continue;
    out.push({ wk, weeksLate: i, status: mmIsMet(wk) ? 'met' : 'none' });
  }
  return out;
}
/* Just the weeks nobody has opened. This is what the copy nags about — a week
   the family sat down for is not a week they missed. */
function mmUnopenedWeeks(max) {
  return mmUnsettledWeeks(max).filter(x => x.status === 'none');
}

/* ── The catch-up screen ── */

// How many rows the banner shows before rolling the rest up. Eight open weeks
// is eight rows of guilt; four and a count is the same information.
const MM_CATCHUP_VISIBLE = 4;

function mmOpenExpress(wk) {
  if (!isParent()) { showToast('Parents run the family meeting 🔒'); return; }
  ctEnsureShared();
  mmExpressWeek = wk;
  mmExpressMoney = true;
  mmExpressMet = false;
  // Set the mode first: mmGoToWeek points every downstream reader at the week,
  // opens the sheet and renders — and renderMeetingMode already honours the flag.
  mmGoToWeek(wk);
}

function mmCloseExpress() {
  mmExpressWeek = null;
  mmCloseMeeting();   // shares the close path, so the hub refreshes behind it
}

/* Leave this week as it is and look at the next one still open. */
function mmExpressSkip() {
  const next = mmUnsettledWeeks(8).find(x => x.wk !== mmExpressWeek);
  if (next) mmOpenExpress(next.wk); else mmCloseExpress();
}

/* The only button here that changes anything. Money moves through
   commitFamilyMeeting and nowhere else; "we talked about it" is recorded
   separately, and either tick can be left off. */
function mmExpressCommit() {
  if (!isParent()) { showToast('Parents run the family meeting 🔒'); return; }
  const wk = mmExpressWeek;
  if (!wk) return;
  if (!mmExpressMoney && !mmExpressMet) {
    showToast('Tick at least one, or skip this week');
    return;
  }
  if (mmExpressMoney) commitFamilyMeeting(wk);
  if (mmExpressMet) mmMarkWeekMet(wk);
  saveAll();
  const done = [mmExpressMoney ? 'money recorded' : '', mmExpressMet ? 'marked as met' : '']
    .filter(Boolean).join(' · ');
  showToast(`${mmWeekLabel(wk)} — ${done}`);
  const next = mmUnsettledWeeks(8)[0];
  if (next) mmOpenExpress(next.wk);
  else { mmCloseExpress(); if (typeof renderParentHome === 'function') renderParentHome(); }
}

function mmExpressToggle(which) {
  if (which === 'money') mmExpressMoney = !mmExpressMoney;
  else mmExpressMet = !mmExpressMet;
  renderMeetingMode();
}

/* One kid's column: the same five channels step 3 reads, from the same
   accessor, so a figure here can never disagree with the full meeting's. */
function mmExpressKidCard(wk, kid) {
  const b = mrWeekBreakdown(wk, kid);
  const name = kid === 'jenn' ? 'Jenn' : 'Jess';
  const row = (label, value) =>
    `<div class="mm-xp-row"><span>${escapeHtml(label)}</span><span class="mm-xp-n">${value}</span></div>`;
  return `<div class="mm-xp-card">
      <div class="mm-xp-name">${CT_PROFILE_ICON[kid]} <b>${name}</b></div>
      ${row('Chores graded', ckMoney(b.chorePaid))}
      ${row('Learning', ckMoney(b.learnPaid))}
      ${row('Routine streak', ckMoney(b.streakBonus))}
      ${row('Competition', ckMoney(b.compPaid))}
      ${row('Fines', b.fines.total ? '−' + ckMoney(b.fines.total) : 'none')}
      <div class="mm-xp-row mm-xp-total"><span><b>Total</b></span><span class="mm-xp-n"><b>${ckMoney(b.net)}</b></span></div>
      <button type="button" class="pill-btn" data-mm-action="express-adjust">Adjust in the full meeting ›</button>
    </div>`;
}

function mmRenderExpress(wk) {
  const open = mmUnsettledWeeks(8);
  const idx = open.findIndex(x => x.wk === wk);
  const total = ['jenn', 'jess'].reduce((s, k) => s + mrWeekBreakdown(wk, k).net, 0);
  const tick = on => on ? '☑' : '☐';
  return `<div class="mm-express">
      <div class="mm-xp-head">
        <span>🕰️</span>
        <div><div class="mm-xp-title">Catch up · ${escapeHtml(mmWeekLabel(wk))}</div>
        <div class="ct-meta">${idx >= 0 ? `Week ${idx + 1} of ${open.length} still open` : 'This week is already closed'}</div></div>
        <span class="ck-spacer"></span>
        <button type="button" class="pill-btn" data-mm-action="express-full">Open the full meeting</button>
      </div>
      <div class="mm-xp-cards">${['jenn', 'jess'].map(k => mmExpressKidCard(wk, k)).join('')}</div>
      <div class="mm-xp-ticks">
        <button type="button" class="mm-xp-tick" data-mm-action="express-tick" data-which="money">
          <span class="mm-xp-box">${tick(mmExpressMoney)}</span>
          <span><b>Record the money</b><br><span class="ct-meta">Credits ${ckMoney(total)} to their pockets</span></span>
        </button>
        <button type="button" class="mm-xp-tick" data-mm-action="express-tick" data-which="met">
          <span class="mm-xp-box">${tick(mmExpressMet)}</span>
          <span><b>We talked about this week together</b><br><span class="ct-meta">Leave this unticked if you are only recording — History will show the week as never met</span></span>
        </button>
      </div>
      <div class="mm-xp-actions">
        <button type="button" class="btn-confirm" data-mm-action="express-commit">Close this week and go to the next</button>
        <button type="button" class="pill-btn" data-mm-action="express-skip">Skip for now</button>
      </div>
    </div>`;
}
/* The parent hub's way in. Deliberately not a warning: a fortnight nobody
   wrote down is a normal outcome of a busy fortnight, and the copy says the
   week is still there rather than that something was missed. */
function mmCatchUpBanner() {
  const list = mmUnsettledWeeks(8);
  if (!list.length) return '';
  const unopened = list.filter(x => x.status === 'none').length;
  const met = list.length - unopened;
  /* Each row says which kind of open it is, and offers the action that fits.
     A week the family met about needs its money settling, not a nag about
     having been missed; a week nobody opened can be ticked off as done if it
     was run before the app could record it. Neither button moves money —
     "Settle" jumps to the step that owns that (CLAUDE.md). */
  // Four rows and a count, not eight rows of guilt. The roll-up keeps the rest
  // reachable without making the hub a wall of missed weeks.
  const shown = list.slice(0, MM_CATCHUP_VISIBLE);
  const hidden = list.length - shown.length;
  const rows = shown.map(x => {
    const isMet = x.status === 'met';
    const label = isMet ? '✅ met — money still waiting' : `${x.weeksLate} week${x.weeksLate === 1 ? '' : 's'} ago`;
    const actions = isMet
      ? `<button type="button" class="mm-catchup-go" data-mm-week="${escapeAttr(x.wk)}" data-mm-catch="settle">Settle the money ›</button>`
      : `<button type="button" class="mm-catchup-did" data-mm-week="${escapeAttr(x.wk)}" data-mm-catch="met">We did this one ✓</button>
         <button type="button" class="mm-catchup-go" data-mm-week="${escapeAttr(x.wk)}" data-mm-catch="open">Catch up ›</button>`;
    return `<div class="mm-catchup-row${isMet ? ' met' : ''}">
        <span class="mm-catchup-wk">${escapeHtml(mmWeekLabel(x.wk))}</span>
        <span class="mm-catchup-late">${escapeHtml(label)}</span>
        ${actions}
      </div>`;
  }).join('');
  const more = hidden
    ? `<div class="mm-catchup-row mm-catchup-more">
         <span class="mm-catchup-wk">${hidden} older week${hidden === 1 ? '' : 's'}</span>
         <span class="mm-catchup-late">still open</span>
         <button type="button" class="mm-catchup-go" data-mm-catch="all">Work through them ›</button>
       </div>`
    : '';
  const cap = [
    unopened ? `${unopened} week${unopened === 1 ? '' : 's'} nobody has opened` : '',
    met ? `${met} met but not paid out` : '',
  ].filter(Boolean).join(' · ');
  return `<div class="mm-catchup">
      <div class="mm-catchup-cap">🕰️ ${escapeHtml(cap)}.
        Nothing expires — open one whenever you get to it, or tick off one you already did.</div>
      ${rows}${more}</div>`;
}

/* One delegated listener for the rows above, bound in js/99-main.js. Data
   attributes rather than interpolated handlers — the pattern js/13-chores.js
   and the money pages already use, and the one CLAUDE.md asks for in new code. */
function mmHandleCatchUpClick(e) {
  const el = e.target.closest('[data-mm-catch]');
  if (!el) return;
  const wk = el.getAttribute('data-mm-week');
  const what = el.getAttribute('data-mm-catch');
  if (what === 'met') {
    if (mmMarkWeekMet(wk)) {
      renderMeetingHub();
      showToast('Marked as done — the money is still there to settle when you want');
    }
    return;
  }
  // 'open' and the roll-up start the catch-up run — the shorter road to the
  // same commit. 'settle' is a week the family already met about, so it wants
  // the step that owns the money rather than a screen that re-asks whether they
  // sat down.
  if (what === 'open') { mmOpenExpress(wk); return; }
  if (what === 'all') {
    const first = mmUnsettledWeeks(8)[0];
    if (first) mmOpenExpress(first.wk);
    return;
  }
  mmGoToWeek(wk);
  if (what === 'settle') mmGoStep(4);
}
/* Point the meeting at another week. Everything downstream reads mmWeekKey(),
   so this is the whole of it — except the draft plan, which belongs to one kid
   in one week and would otherwise be re-offered against a different week's
   money. mnyEnsureDraft re-keys itself too; clearing it here keeps step 4 from
   rendering one stale frame first. */
function mmGoToWeek(wk) {
  if (!isParent()) { showToast('Parents run the family meeting 🔒'); return; }
  ctWeekKey = wk;
  // A context captured against another week would send the parent back to a
  // sitting that no longer exists.
  mmClearReturn();
  mmStep = 1; mmMaxStep = 1; mmSelectedDay = null; mmUndo = null; mmAddChoreFor = null;
  if (typeof mnyDraft !== 'undefined') mnyDraft = null;
  const overlay = document.getElementById('familyMeetingOverlay');
  if (!overlay || !overlay.classList.contains('open')) openSheet('familyMeetingOverlay');
  renderMeetingMode();
}

/* New meeting controls ride on data attributes and this one delegated listener
   rather than being interpolated into inline handlers — the pattern
   js/13-chores.js and the money pages use, and the one CLAUDE.md asks for in
   new code. Bound in js/99-main.js: #familyMeetingBody has its innerHTML
   replaced on every render, but the element itself is never replaced. */
function mmHandleClick(e) {
  const el = e.target.closest('[data-mm-action]');
  if (!el) return;
  const a = el.getAttribute('data-mm-action');
  const kid = el.getAttribute('data-kid') || '';
  const d = Number(el.getAttribute('data-day'));
  if (a === 'thisweek')       { mmGoToWeek(ctThisWeekKey()); return; }
  if (a === 'openweek')       { mmOpenWeekForBlocks(kid); return; }
  if (a === 'allroutines')    { mmToggleAllRoutines(kid, d); return; }
  if (a === 'addchore-open')  { mmToggleAddChore(kid, d); return; }
  if (a === 'addchore-pick')  { mmAddChoreHappened(kid, d, el.getAttribute('data-chore')); return; }
  if (a === 'openday')        { mmSelectDay(d); return; }
  if (a === 'confirmday')     { mmToggleConfirmDay(d); return; }
  if (a === 'reviewday')      { mmToggleDayReviewed(kid, d); return; }
  if (a === 'openkidday')     { mmOpenDayForBlocks(kid, d); return; }
  if (a === 'express-tick')   { mmExpressToggle(el.getAttribute('data-which')); return; }
  if (a === 'express-commit') { mmExpressCommit(); return; }
  if (a === 'express-skip')   { mmExpressSkip(); return; }
  // Both routes out of catch-up mode land in the full meeting on the same week.
  if (a === 'express-full' || a === 'express-adjust') {
    mmExpressWeek = null; mmGoStep(1); return;
  }
}

/* ── What Step 1 reviews ───────────────────────────────────────────
   The two halves of a day are stored in two different places, on purpose:

     ROUTINES (Morning / Afternoon / Evening) are the parent's call and pay no
     money. They live in the legacy per-session store (ctGetMandatory), which
     is also exactly what mrStreakDayDone reads for the clean-day streak — so
     ticking one here is what moves the streak channel.

     CHORES come from the chore pool via the planner (mrChoresForDay) and are
     what the money engine totals. A parent tapping one in the meeting IS the
     grading act, so a tap writes a GRADE (mrSetChoreGrade), the same value
     cpQueue writes from the portal.

   Before this, Step 1 rendered the retired chore *groups* and wrote to
   ctSetOptional — a store nothing downstream reads any more. That is why a
   week reviewed at the table still showed $0 of "Jobs around the house" on
   Step 3. */
function mmReviewRows(kid, dayIdx) {
  const wk = mmWeekKey();
  const rows = CT_SESSIONS.map(s => ({
    kind: 'routine', key: s, label: s, icon: CT_SESSION_ICONS[s] || '📋',
    on: !!ctGetMandatory(wk, dayIdx, s, kid),
    claim: 0, pays: false,
  }));
  const r = mrRulesForWeek(wk);
  mrChoresForDay(kid, wk, dayIdx).rows.forEach(({ row }) => {
    if (!mrLanePays(row.lane)) return;   // 'own'/'helping' never pay — not money to agree
    const grade = mrGetChoreGrade(kid, wk, dayIdx, row.id);
    rows.push({
      kind: 'chore', key: row.id, label: row.label, icon: row.icon || '🧺',
      on: grade > 0, grade, claim: mrGetClaim(kid, wk, dayIdx, row.id),
      pays: true, pay: ckGradePay(r, grade || 3),
    });
  });
  return rows;
}
function mmWeekKey() { return ctWeekKey || ctThisWeekKey(); }

// % of a kid's tracked items (routines + priced chores) settled on a given day.
function mmDayPct(kid, dayIdx) {
  const rows = mmReviewRows(kid, dayIdx);
  if (!rows.length) return 0;
  const done = rows.reduce((s, row) => s + (row.on ? 1 : 0), 0);
  return Math.round(done / rows.length * 100);
}
// Days of the viewed week that have already happened (Mon..today inclusive).
// A past week counts all 7; a future/other week counts 7 too (its numerator is
// 0 anyway, so this just avoids divide-by-zero).
function mmElapsedDays() {
  const info = ctWeekInfo();
  const idx = Math.round((formatDayKey(todayKey()) - info.mon) / 864e5);
  if (idx < 0 || idx > 6) return 7;
  return idx + 1;
}
// Average % of items done per elapsed day. Was a fixed /7, which let an
// untouched, not-yet-happened weekend drag a strong Mon–Fri down; dividing by
// elapsed days instead measures the days actually in play.
function mmWeekPct(kid) {
  const days = mmElapsedDays();
  let s = 0; for (let d = 0; d < days; d++) s += mmDayPct(kid, d);
  return Math.round(s / days);
}

function renderMeetingMode() {
  ctPrepareRead();
  const wk = ctWeekKey || ctThisWeekKey();
  const held = !!(state.shared.chore.meetingsHeld && state.shared.chore.meetingsHeld[wk]);
  const stepper = MM_STEPS.map((label, i) => {
    const n = i + 1;
    const cls = n === mmStep ? 'mm-step-cur' : (n < mmStep ? 'mm-step-done' : 'mm-step-up');
    return `<button type="button" class="mm-step ${cls}" onclick="mmGoStep(${n})">${n}·${label}</button>`;
  }).join('');

  // Catch-up mode replaces the stepper entirely: a week nobody is going to
  // discuss does not need five steps to close.
  if (mmExpressWeek) {
    const xhost = document.getElementById('familyMeetingBody');
    const xrestore = mmCaptureUiState(xhost);
    xhost.innerHTML = mmRenderExpress(mmExpressWeek);
    xrestore();
    return;
  }

  let body;
  if (mmStep === 1) body = mmRenderReview(wk);
  else if (mmStep === 2) body = mmRenderCelebrate(wk);
  else if (mmStep === 3) body = mnyRenderEarned(wk);
  else if (mmStep === 4) body = mnyRenderDecide(wk);
  else body = mmRenderPlan(wk);

  const back = mmStep > 1 ? `<button type="button" class="pill-btn" onclick="mmGoStep(${mmStep - 1})">◀ Back</button>` : `<span></span>`;
  const next = mmStep < MM_STEPS.length
    ? `<button type="button" class="btn-confirm" onclick="mmGoStep(${mmStep + 1})">Next ▶</button>`
    : mmFinishButtons(wk);

  const host = document.getElementById('familyMeetingBody');
  const restore = mmCaptureUiState(host);
  host.innerHTML =
    `${mmWeekBar(wk)}<div class="mm-stepper">${stepper}</div><div class="mm-body">${body}</div><div class="mm-nav">${back}${next}</div>`;
  restore();
}

/* ── Keeping the meeting usable across a re-render ──
   Every tap in steps 3 and 4 rebuilds #familyMeetingBody wholesale. That threw
   away two things the family notices immediately: the sheet's scroll position
   (so a button pressed halfway down the page appeared to "do nothing" — the
   view had jumped back to the top), and keyboard focus (so typing a
   competition name lost the caret after the first letter, because the input
   the letter went into no longer existed).

   Captures both before the swap and puts them back after. Fields are matched by
   `data-mm-field` rather than DOM position, so a re-render that changes the
   surrounding markup still finds the right input. */
function mmCaptureUiState(host) {
  const sheet = document.querySelector('#familyMeetingOverlay .sheet');
  const scrollTop = sheet ? sheet.scrollTop : 0;
  const active = document.activeElement;
  let field = null, selStart = null, selEnd = null;
  if (active && host && host.contains(active)) {
    field = active.getAttribute('data-mm-field');
    // Only text-like inputs carry a caret worth restoring.
    try {
      if (field && active.selectionStart != null) {
        selStart = active.selectionStart;
        selEnd = active.selectionEnd;
      }
    } catch (e) { /* number/date inputs throw on selectionStart — ignore */ }
  }
  return function restore() {
    if (sheet) sheet.scrollTop = scrollTop;
    if (!field || !host) return;
    const next = host.querySelector(`[data-mm-field="${CSS.escape(field)}"]`);
    if (!next) return;
    next.focus();
    if (selStart == null) return;
    try { next.setSelectionRange(selStart, selEnd); } catch (e) { /* not text-like */ }
  };
}

/* Step 1 — Review: 1b grouped bar chart + day drill-in + meeting readiness. */
/* ── Step 1: seven rows, not a chart and a detour ──
   It used to be a bar chart: tap a day, scroll to the detail below, confirm,
   scroll back, tap the next day — seven times, and twenty-eight movements for a
   week where nothing was wrong. Each day is a row now, confirmable in place,
   and it only opens when something actually needs changing. The detail it opens
   is the same two-column panel as before. */
function mmRenderReview(wk) {
  const info = ctWeekInfo();
  const todayD = formatDayKey(todayKey());
  let rows = '';
  for (let d = 0; d < 7; d++) {
    const date = new Date(info.mon); date.setDate(info.mon.getDate() + d);
    const isToday = Math.round((date - todayD) / 864e5) === 0;
    const ahead = date > todayD && !isToday;
    const jp = mmDayPct('jenn', d), sp = mmDayPct('jess', d);
    const open = mmSelectedDay === d;
    const done = mmIsDayConfirmed(d);
    const empty = jp === 0 && sp === 0;
    /* Three states, said out loud: Jenn reviewed, Jess reviewed, both. There is
       no hidden reading of "confirmed" that means both children any more — the
       Both control is there, and it is labelled Both. */
    const kidCell = (kid) => {
      const on = mmIsDayReviewedFor(kid, d);
      const nm = kid === 'jenn' ? 'Jenn' : 'Jess';
      return `<button type="button" class="mm-drow-kid${on ? ' on' : ''}"
          data-mm-action="reviewday" data-kid="${escapeAttr(kid)}" data-day="${d}"
          aria-label="${on ? nm + ' reviewed' : 'Mark ' + nm + ' reviewed'}"
        >${on ? '✓' : '○'} ${CT_PROFILE_ICON[kid]}</button>`;
    };
    const state = ahead
      ? `<span class="mm-drow-note">Not here yet</span>`
      : `<span class="mm-drow-review">${kidCell('jenn')}${kidCell('jess')}`
        + `<button type="button" class="${done ? 'mm-drow-ok' : 'mm-drow-go'}"
             data-mm-action="confirmday" data-day="${d}"
           >${done ? '✓ Both reviewed' : 'Both'}</button></span>`;
    const mid = (!ahead && empty)
      ? `<span class="mm-drow-note">Nothing logged — open it and add what actually happened</span>`
      : `<span class="mm-drow-bars">
           <span class="mm-drow-track"><span class="mm-drow-fill mm-bar-j" style="width:${jp}%"></span></span>
           <span class="mm-drow-track"><span class="mm-drow-fill mm-bar-s" style="width:${sp}%"></span></span>
         </span>`;
    rows += `<div class="mm-drow${open ? ' open' : ''}${done ? ' done' : ''}">
        <div class="mm-drow-head">
          <button type="button" class="mm-drow-day" data-mm-action="openday" data-day="${d}"
            aria-expanded="${open ? 'true' : 'false'}">
            <span class="mm-drow-dow">${DAY_SHORT[d]} ${date.getDate()}${isToday ? ' ★' : ''}</span>
          </button>
          ${mid}${state}
          <button type="button" class="mm-drow-x" data-mm-action="openday" data-day="${d}"
            aria-label="${open ? 'Close' : 'Open'} ${escapeAttr(DAY_SHORT[d])}">${open ? '▴' : '▾'}</button>
        </div>
        ${open ? `<div class="mm-drow-body">${mmRenderDayDetail(wk, d)}</div>` : ''}
      </div>`;
  }
  const detail = `<div class="mm-drows">${rows}</div>`;
  const nConfirmed = [0,1,2,3,4,5,6].filter(mmIsDayConfirmed).length;
  // Framed as a team total, not a head-to-head scoreboard: lead with how the two
  // did together, with each kid's number kept small for transparency.
  const jp = mmWeekPct('jenn'), sp = mmWeekPct('jess');
  const together = Math.round((jp + sp) / 2);
  const footer = `<div class="mm-ready">Meeting-ready: ${nConfirmed}/7 days confirmed · 💪 Together you kept ${together}% of the days so far <small>(🐥 ${jp}% · 🦊 ${sp}%)</small></div>`;
  // The readiness list belongs before anything is agreed, not after (it lived
   // in step 4 until now). Per-kid state, so it follows whoever step 3/4 is on.
  return `${mnyChecklist(wk, mnyMeetingKid())}
    <div class="mm-h">Review the week</div>
    <div class="mm-legend"><span><i class="mm-sw mm-bar-j"></i>Jenn</span><span><i class="mm-sw mm-bar-s"></i>Jess</span><span class="mm-legend-note">how the team's doing each day — cheer each other on</span></div>
    ${mmFamilyChoreReview(wk)}
    ${detail}${footer}`;
}

/* ── The family's chores, in the review voice ─────────────────────
   The kid-facing banner is forward-looking and current-week only, on purpose.
   This is the other half: a parent reviewing a week has to be able to see a
   shortfall, including on a week that has already gone by, and nothing showed
   it. A scheduled chore is not a fulfilled one — only a positive parent grade
   is — and a chore the child claimed but nobody has answered is neither, so it
   is named as waiting rather than counted against her.

   Nothing is carried into the next week. The shortfall is the week's record. */
function mmFamilyChoreReview(wk) {
  if (typeof getFamilyChoreStatus !== 'function') return '';
  const rows = ['jenn', 'jess'].map(kid => {
    const st = getFamilyChoreStatus(kid, wk);
    if (!st.required) return '';
    const name = kid === 'jenn' ? 'Jenn' : 'Jess';
    const met = st.unfulfilled === 0;
    const waiting = st.waiting
      ? ` · <span class="mm-chore-wait">${st.waiting} waiting for a parent check</span>` : '';
    return `<div class="mm-chore-row${met ? ' met' : ''}">
        <span class="mm-chore-who">${CT_PROFILE_ICON[kid]} ${escapeHtml(name)}</span>
        <span>${st.required} family ${st.required === 1 ? 'chore' : 'chores'} owed · `
      + `${st.fulfilled} fulfilled · ${st.unfulfilled} unfulfilled${waiting}</span>
      </div>`;
  }).join('');
  if (!rows) return '';
  return `<div class="mm-chore-review">${rows}
      <div class="mm-cap">Only a parent's grade counts as fulfilled. A shortfall stays on this week — it is not carried forward.</div>
    </div>`;
}
function mmSelectDay(d) { mmSelectedDay = (mmSelectedDay === d ? null : d); renderMeetingMode(); }
function mmRenderDayDetail(wk, d) {
  const col = (kid) => {
    const rows = mmReviewRows(kid, d);
    const name = kid === 'jenn' ? 'Jenn' : 'Jess';
    /* Both sections carry a footer, and it is what makes a blank week workable:
       the chores one can add a chore that was never planned, the routines one
       marks all three at once. Rendered in the empty branch too — an empty day
       is precisely the day that needs them. */
    const footer = (kind) => {
      if (kind === 'routine') {
        const allOn = CT_SESSIONS.every(s => ctGetMandatory(wk, d, s, kid));
        return `<button type="button" class="mm-routine-all" data-mm-action="allroutines"
            data-kid="${escapeAttr(kid)}" data-day="${d}">${allOn ? 'Clear all three' : 'All three kept'}</button>`;
      }
      const open = mmAddChoreFor === kid + '|' + d;
      const opts = open ? mmAddChoreOptions(kid, d) : [];
      const list = open
        ? `<div class="mm-addchore-list">${opts.map(row =>
            `<button type="button" class="mm-addchore-pick" data-mm-action="addchore-pick"
                data-kid="${escapeAttr(kid)}" data-day="${d}" data-chore="${escapeAttr(row.id)}"
              >${row.icon} ${escapeHtml(row.label)}</button>`).join('')
            || `<div class="mm-detail-empty">Every chore in the pool is already on this day.</div>`}</div>`
        : '';
      return `<button type="button" class="mm-addchore" data-mm-action="addchore-open"
          data-kid="${escapeAttr(kid)}" data-day="${d}" aria-expanded="${open}"
        >${open ? '✕ Never mind' : '＋ Add a chore that happened'}</button>${list}`;
    };
    const section = (title, note, kind) => {
      const mine = rows.map((row, i) => ({ row, i })).filter(x => x.row.kind === kind);
      if (!mine.length) {
        return `<div class="mm-detail-sect"><div class="mm-detail-cap">${title}</div>
          <div class="mm-detail-empty">${kind === 'chore'
            ? 'No chores on the plan for this day.'
            : 'No routines tracked for this day.'}</div>${footer(kind)}</div>`;
      }
      const items = mine.map(({ row, i }) => {
        // What she said, before a grown-up agreed — so the parent is confirming
        // her answer rather than guessing at it.
        const said = row.claim > 0
          ? (CK_QUALITY.find(q => q.g === row.claim) || {}).word || ''
          : '';
        const tag = row.kind === 'chore'
          ? (row.on ? `<span class="mm-item-pay">${mnyMoney(row.pay)}</span>`
             : said ? `<span class="mm-item-said">she said: ${escapeHtml(said.toLowerCase())}</span>`
             : `<span class="mm-item-said">not answered</span>`)
          : '';
        return `<button type="button" class="mm-item ${row.on ? 'on' : ''}" onclick="mmToggleItem('${escapeJsAttr(kid)}',${d},${i})"
            role="checkbox" aria-checked="${row.on}" aria-label="${escapeAttr(row.label)} ${DAY_SHORT[d]}, ${name}"><span class="mm-item-box">${row.on ? '✓' : ''}</span>${row.icon ? row.icon + ' ' : ''}${escapeHtml(row.label)}${tag}</button>`;
      }).join('');
      const done = mine.filter(x => x.row.on).length;
      // A chores total overridden at step 3 no longer follows from these marks,
      // so say so here rather than letting the ticks imply a number they don't
      // produce any more.
      const banner = kind === 'chore' ? mnyOverrideBanner(kid, mmWeekKey(), 'chores') : '';
      return `<div class="mm-detail-sect">
        <div class="mm-detail-cap">${title} <small>${done}/${mine.length}</small></div>
        <div class="mm-detail-note">${note}</div>${banner}${items}${footer(kind)}</div>`;
    };
    const done = rows.filter(r => r.on).length;
    return `<div class="mm-detail-col">
      <div class="mm-detail-kid">${CT_PROFILE_ICON[kid]} ${name} <small>${done}/${rows.length} done</small></div>
      ${section('Routines', 'You mark these. They pay no money — they build the clean-day streak.', 'routine')}
      ${section('Chores', 'Tapping one agrees her answer and pays it.', 'chore')}
    </div>`;
  };
  const confirmed = mmIsDayConfirmed(d);
  return `<div class="mm-detail">
      <div class="mm-detail-cols">${col('jenn')}<div class="mm-detail-div"></div>${col('jess')}</div>
      <div class="mm-detail-editnote">Tap any item to change it for that kid — this is the same record the chore tab and "What I earned" read, so the money updates live. On a week nobody wrote down, add what actually happened.</div>
      <button type="button" class="mm-confirm-day ${confirmed ? 'confirmed' : ''}" onclick="mmToggleConfirmDay(${d})">${confirmed ? '✓ Confirmed (both kids)' : 'Confirm this day'}</button>
    </div>`;
}
/* Parent taps an item in the meeting review.

   A routine toggles the tracked session (no money, feeds the streak). A chore
   writes a GRADE — agreeing the kid's claim at the quality she said, or a
   plain "on time" when she never answered. Tapping a graded chore ungrades it.
   Either way it is the same store the portal and the money engine read, so
   Step 3 recomputes from it the moment this returns. */
function mmToggleItem(kid, d, idx) {
  const wk = mmWeekKey();
  const row = mmReviewRows(kid, d)[idx];
  if (!row) return;
  if (row.kind === 'routine') {
    ctSetMandatory(wk, d, row.key, kid, !row.on);
    ctMaybeFireGoalBonus(wk, kid);
  } else {
    // Agree at what she claimed; if she never claimed, agree at "on time".
    const next = row.on ? 0 : (row.claim > 0 ? row.claim : 3);
    mrSetChoreGrade(kid, wk, d, row.key, next);
  }
  mnyReopenWeek(kid, wk);
  saveAll();
  renderMeetingMode();
}

/* ── Filling in a week nobody wrote down ──────────────────────────
   A paid chore reaches step 1 only where the planner scheduled it: the `chores`
   lane is `needsBlock: true`, so a week with no blocks in it — the busy
   fortnight this is all for — offered three routines a day and not one chore to
   tick. The money channel that matters was unreachable, and the only way to put
   anything on the week was step 3's override steppers, which agree a lump sum
   with no working behind it.

   The fix needs no new store and no change to mrChoresForDay. That reader
   already has an `unplanned` branch — written for "she mops without being
   asked" — which surfaces any chore carrying a claim or a grade even with no
   block behind it. So recording one is just writing the grade, exactly as
   ticking a planned chore does, and every surface downstream picks it up. */
function mmAddChoreOptions(kid, d) {
  const wk = mmWeekKey();
  const have = new Set(mmReviewRows(kid, d).filter(r => r.kind === 'chore').map(r => r.key));
  return mrPoolRows(wk).filter(row => mrLanePays(row.lane) && !have.has(row.id)
    && (row.who === 'both' || row.who === kid));
}
function mmToggleAddChore(kid, d) {
  const key = kid + '|' + d;
  mmAddChoreFor = (mmAddChoreFor === key ? null : key);
  renderMeetingMode();
}
/* Graded at "on time" because a parent adding a chore from memory is agreeing
   it happened, not ranking how it went — and the grade buttons in the portal
   and the tap in step 1 can still change it afterwards. */
function mmAddChoreHappened(kid, d, choreId) {
  const wk = mmWeekKey();
  if (!mrPoolRow(choreId, wk)) return;
  if (!mrSetChoreGrade(kid, wk, d, choreId, 3)) return;
  mmAddChoreFor = null;
  mnyReopenWeek(kid, wk);
  saveAll();
  renderMeetingMode();
}
/* All three routines for one kid on one day. Reconstructing a fortnight one tap
   at a time is 42 taps per kid, which is how a catch-up becomes a week nobody
   bothers to settle. Still the parent's assertion, and still the same store a
   live tick writes — this only saves the taps. */
function mmToggleAllRoutines(kid, d) {
  const wk = mmWeekKey();
  const all = CT_SESSIONS.every(s => ctGetMandatory(wk, d, s, kid));
  CT_SESSIONS.forEach(s => ctSetMandatory(wk, d, s, kid, !all));
  ctMaybeFireGoalBonus(wk, kid);
  mnyReopenWeek(kid, wk);
  saveAll();
  renderMeetingMode();
}

/* ── Step 2 — Celebrate ───────────────────────────────────────────
   This counted chores through ctGetOptional — `optionalByWeek`, the retired
   chore-GROUP store that three separate comments in this codebase already say
   nothing downstream reads. Under the graded model it returns nothing, so a
   week with real graded chores was celebrated as "0 chores done", and the
   money line showed ctWeekMoney: a live preliminary figure, not what was
   actually recorded. A celebration that congratulates a child for the wrong
   things is worse than no celebration, because she cannot tell which.

   Every line now reads a live source: routines from the same routine
   completion every screen uses, chores from real parent grades, hours from
   getWeeklyHours, money from the FROZEN ledger once it exists, XP from the XP
   ledger. Nothing here is computed a second way. */
function mmRenderCelebrate(wk) {
  const info = ctWeekInfo();
  const scale = mm2bScale(wk);
  const wins = (kid) => {
    const w = [];

    // Routines: what the checklists actually say, day by day.
    let rDone = 0, rTotal = 0;
    info.keys.forEach(key => {
      (getDayBlocksForProfile(key, kid) || []).forEach(b => {
        const act = findActivity(b.actId, kid);
        if (!act || !act.isRoutine) return;
        rTotal++;
        if (isRoutineCompleted(b, kid)) rDone++;
      });
    });
    if (rTotal) w.push(`✅ ${rDone}/${rTotal} routine${rTotal === 1 ? '' : 's'} kept`);

    // Chores: only a positive parent grade. A claim is her account of it.
    const fam = getFamilyChoreStatus(kid, wk);
    let graded = 0;
    for (let d = 0; d < 7; d++) {
      mrChoresForDay(kid, wk, d).rows.forEach(r => {
        if (r.row && mrGetChoreGrade(kid, wk, d, r.row.id) > 0) graded++;
      });
    }
    if (graded) w.push(`🧹 ${graded} chore${graded === 1 ? '' : 's'} checked off by a grown-up`);
    if (fam.waiting) w.push(`⏳ ${fam.waiting} waiting for a parent check`);

    // Activity completion, from the one hours computation.
    const h = getWeeklyHours(kid, wk);
    if (h.planned) w.push(`⏱ ${fmtHrsMin(h.completed)} of ${fmtHrsMin(h.planned)} planned hours completed`);

    if (ctGetGoalBonus(wk, kid)) w.push(`🎯 Weekly goal reached (+$1)`);

    /* Money: the frozen ledger is the record. ctWeekMoney is a live preliminary
       figure that step 3 shows on purpose, and nothing reaches the wallet until
       step 4 — so saying it here as though it had happened is the same class of
       wrongness as the chore count above. */
    const finalised = ((state.shared.chore.finalizedWeeks || {})[wk] || {})[kid];
    if (finalised != null) w.push(`💰 $${Number(finalised).toFixed(2)} recorded`);
    else {
      const prelim = ctWeekMoney(wk, kid);
      if (prelim > 0) w.push(`💰 $${prelim.toFixed(2)} so far — recorded at step 4`);
    }

    // XP, from the one ledger, and only once it has actually been credited.
    const credited = ((state.shared.chore.xpAwardedWeeks || {})[wk] || {})[kid];
    if (credited != null) { if (credited > 0) w.push(`⭐ +${credited} XP credited`); }
    else if (typeof mrXpForWeek === 'function') {
      const t = mrXpForWeek(wk, kid).total;
      if (t > 0) w.push(`⭐ +${t} XP to come`);
    }

    const moods = (getProfData(kid).dayMoods) || {};
    const moodList = info.keys.map(k => moods[k]).filter(Boolean);
    if (moodList.length) w.push(`💫 Vibe: ${moodList.join(' ')}`);

    if (!w.length) w.push('Nothing recorded for this week yet — step 1 is where it goes in.');
    return `<div class="mm-win"><div class="mm-win-kid">${CT_PROFILE_ICON[kid]} ${kid === 'jenn' ? 'Jenn' : 'Jess'}</div>${w.map(x => `<div class="mm-win-item">${x}</div>`).join('')}</div>`;
  };
  return `<div class="mm-h">Celebrate the wins</div>
    <div class="mm-wins">${wins('jenn')}${wins('jess')}</div>
    <div class="mm-h mm-h-sub">Planned vs completed</div>
    <div class="mm-2b">${mm2b('jenn', scale)}${mm2b('jess', scale)}</div>
    <div class="mm-cap">Solid = planned hours completed · dashed = planned, on one scale for both girls. The app records which planned blocks were finished, not how long anything took.</div>
    <div class="mm-blocklink">${['jenn', 'jess'].map(k =>
      `<button type="button" class="pill-btn" data-mm-action="openweek" data-kid="${escapeAttr(k)}"
        >${CT_PROFILE_ICON[k]} Open ${escapeHtml(k === 'jenn' ? 'Jenn' : 'Jess')}'s week ›</button>`).join('')}
      <span class="mm-cap">Ticking and confirming blocks happens there, not here.</span></div>`;
}
/* The third copy of this chart, and the third bucketing of the same blocks.
   It read b.completed directly, so a routine finished by its checklist counted
   as zero minutes done; and it scaled each kid's bars to her own biggest row,
   so the two cards sat side by side and could not be compared. Both come from
   getWeeklyHours now, on one scale. */
function mm2b(kid, scaleMax) {
  const wk = mmWeekKey();
  const h = getWeeklyHours(kid, wk);
  const maxMin = scaleMax || Math.max(60, ...Object.values(h.byGroup).map(v => v.planned));
  const rows = GROUP_ORDER.filter(g => h.byGroup[g].planned > 0).map(g => {
    const p = h.byGroup[g].planned, dn = h.byGroup[g].completed;
    const inner = (g === 'brain' && h.schoolMin > 0)
      ? `<small class="mm-2b-sub"> (${fmtHrsMin(h.schoolMin)} school)</small>` : '';
    return `<div class="mm-2b-row"><span class="mm-2b-label">${groupLabel(g)}${inner}</span>
        <span class="mm-2b-track"><span class="mm-2b-plan" style="width:${Math.round(p / maxMin * 100)}%"></span><span class="mm-2b-done" style="width:${Math.round(dn / maxMin * 100)}%;background:${groupHex(g) /* safe: from ACTIVITY_GROUPS */}"></span></span>
        <span class="mm-2b-num">${fmtHrsMin(dn)} / ${fmtHrsMin(p)}</span></div>`;
  }).join('') || `<div class="ct-meta">No scheduled blocks this week.</div>`;
  return `<div class="mm-2b-kid"><div class="mm-win-kid">${CT_PROFILE_ICON[kid]} ${kid === 'jenn' ? 'Jenn' : 'Jess'} — ${fmtHrsMin(h.completed)} completed / ${fmtHrsMin(h.planned)} planned</div>${rows}</div>`;
}
/* One scale for both girls, computed before either card is drawn. */
function mm2bScale(wk) {
  return Math.max(60, ...['jenn', 'jess'].flatMap(k =>
    Object.values(getWeeklyHours(k, wk).byGroup).map(v => v.planned)));
}

/* Step 3 — Confirm & record (reuses commitFamilyMeeting; offers an undo). */
function mmRenderConfirm(wk, held) {
  const rows = ['jenn','jess'].map(kid => {
    const prelim = ctWeekMoney(wk, kid);
    return `<div class="mm-pay-row"><span>${CT_PROFILE_ICON[kid]} ${kid === 'jenn' ? 'Jenn' : 'Jess'}</span><b>$${prelim.toFixed(2)}</b></div>`;
  }).join('');
  const alreadyHeld = held || !!(state.shared.chore.meetingsHeld && state.shared.chore.meetingsHeld[wk]);
  let action;
  if (mmUndo) {
    action = `<div class="mm-recorded">✅ Recorded — money credited.</div>
      <button type="button" class="pill-btn danger" onclick="mmUndoRecord()">↩️ Undo this meeting — puts both girls back</button>`;
  } else if (alreadyHeld) {
    action = `<div class="mm-recorded">✅ This week was already recorded.</div>`;
  } else {
    action = `<button type="button" class="btn-confirm" onclick="mmConfirmAndRecord()">✅ Confirm &amp; record the week</button>`;
  }
  const newModel = (typeof mrUsesNewModel === 'function') && mrUsesNewModel(wk);
  // Show what recording is about to do, per kid, BEFORE it happens — the loan
  // transfer and XP credit are irreversible-feeling to a kid, so they should
  // never be a surprise that only shows up in a toast afterwards.
  const preview = newModel ? ['jenn','jess'].map(kid => {
    const b = mrWeekBreakdown(wk, kid);
    const xp = mrXpForWeek(wk, kid).total;
    // What the schedule actually asks for today — the deposit before the
    // monthlies, and nothing at all on the Sundays that aren't payment day.
    // Read through mnyDueNowAll rather than loanDueNow: it already knows which
    // months are settled, and it covers EVERY debt. This used to call
    // loanState(kid) with no debtId, which returns list[0] in insertion order —
    // so a kid with two loans saw one of them, and not necessarily the one the
    // payment was about.
    const owed = mnyDueNowAll(kid);
    const due = money2(owed.reduce((s, x) => s + money2(x.amount), 0));
    const dueLabel = owed.length > 1 ? 'loans'
                   : (owed[0] && owed[0].kind === 'down') ? 'down payment' : 'loan';
    const bits = [];
    if (b.chorePaid) bits.push(`chores $${b.chorePaid.toFixed(2)}`);
    if (b.learnPaid) bits.push(`learning $${b.learnPaid.toFixed(2)}`);
    if (b.streak.bonus) bits.push(`streak $${b.streak.bonus.toFixed(2)}`);
    if (b.compPaid) bits.push(`competition $${b.compPaid.toFixed(2)}`);
    if (b.fines.total) bits.push(`fines −$${b.fines.total.toFixed(2)}`);
    return `<div class="ct-meta">${CT_PROFILE_ICON[kid]} ${bits.join(' · ') || 'nothing earned'}${xp ? ` · +${xp} XP` : ''}${due ? ` · ${escapeHtml(dueLabel)} −$${due.toFixed(2)}` : ''}</div>`;
  }).join('') : '';
  const explain = newModel
    ? `This <b>confirms</b> the week. Recording credits each kid's total to cash, credits XP, opens the Sunday Box, adds a month of interest and pays out anything locked away that has reached its date. The loan payment and any overdue interest move <b>once a month</b>, not every Sunday.`
    : `This <b>confirms</b> the week — it doesn't "pay". Group chore money already fired sticky as chores were done; recording credits each kid's total (max $${CT_MONEY_CAP}) to cash, adds a month of interest and pays out anything locked away that has reached its date.`;
  return `<div class="mm-h">Confirm &amp; record</div>
    <div class="ct-meta">${explain}</div>
    <div class="mm-pay">${rows}</div>${preview}${mmRenderQuarterly()}${action}`;
}
/* Quarterly review. The rulebook promises the numbers get revisited every three
   months; this raises it at the meeting with the actual earning data beside it,
   so the re-tune is argued from what happened rather than from a hunch. */
function mmRenderQuarterly() {
  if (typeof mrQuarterlyDue !== 'function' || !mrQuarterlyDue()) return '';
  const rows = ['jenn','jess'].map(kid => {
    const y = mrYearToDate(kid);
    const ch = y.channels;
    const name = kid === 'jenn' ? 'Jenn' : 'Jess';
    if (!y.weeks) return `<div class="ct-meta">${CT_PROFILE_ICON[kid]} ${name} — no recorded weeks yet.</div>`;
    return `<div class="ct-meta" style="margin-top:0.3rem">${CT_PROFILE_ICON[kid]} <b>${name}</b> — $${y.paidTotal.toFixed(2)} over ${y.weeks} week${y.weeks === 1 ? '' : 's'}
        · on this pace <b>$${y.projected.toFixed(2)}/yr</b> against a $${y.target.toFixed(0)} target (<b>${y.pctOfTarget}%</b>)</div>
      <div class="ct-meta">chores $${ch.chores.toFixed(2)} · learning $${ch.learning.toFixed(2)} · streak $${ch.streak.toFixed(2)} · competition $${ch.competition.toFixed(2)} · fines −$${ch.fines.toFixed(2)}</div>`;
  }).join('');
  return `<div class="mm-recorded" style="margin-top:0.6rem">
      <div><b>📅 Quarterly review — ${mrQuarterOf(todayKey())}</b></div>
      <div class="ct-meta">The rulebook says these numbers get looked at every three months. Here's what actually happened.</div>
      ${rows}
      <div style="margin-top:0.4rem"><button type="button" class="pill-btn" onclick="mmDoQuarterlyReview()">Open the rules editor</button>
        <button type="button" class="pill-btn" onclick="mmSkipQuarterlyReview()">Reviewed — no change</button></div>
    </div>`;
}
function mmDoQuarterlyReview() {
  mrMarkQuarterReviewed();
  closeSheet('familyMeetingOverlay');
  openPocketMoney(ctParentKid, 'setup');
}
function mmSkipQuarterlyReview() {
  mrMarkQuarterReviewed();
  renderMeetingMode();
  showToast('📅 Quarterly review recorded — rates unchanged');
}

function mmConfirmAndRecord() {
  const c = state.shared.chore;
  const wk = ctWeekKey || ctThisWeekKey();
  if (c.meetingsHeld && c.meetingsHeld[wk]) { showToast('Already recorded this week'); return; }
  mmTakeUndoSnapshot(wk);
  const parts = commitFamilyMeeting(wk);
  renderMeetingMode();
  showToast(`💛 Recorded${parts.length ? ' · ' + parts.join(' · ') : ''}`);
}

/* ── ONE snapshot for the whole family, taken once ────────────────
   The comment below always said what this was for, and the code did the
   opposite: mnyDoCommit called it unconditionally, once per child. Settling
   Jenn stored the state before Jenn; settling Jess then OVERWROTE it with the
   state after Jenn. Undo put Jess back, left Jenn's money moved, and announced
   "nothing was recorded" — which was false, and false in the one direction
   that matters, because the family had no way to see the difference.

   So it is idempotent per week now. The first commit of a week takes the
   picture; every later one leaves it alone, and mmUndoRecord winds the whole
   sitting back to before either girl was settled. */
function mmTakeUndoSnapshot(wk) {
  // Already holding the pre-commit picture for this week — do not replace it.
  if (mmUndo && mmUndo.wk === wk) return;
  const c = state.shared.chore;
  // Snapshot everything the commit mutates so the undo can fully reverse it.
  // The commit now moves XP and the loan as well as the wallet, so the undo has
  // to carry all of it — a partial reverse would leave credited XP or a loan
  // payment standing against a week that was un-recorded.
  const snap = kid => JSON.parse(JSON.stringify({
    wallet: ensureWallet(kid),
    // Every debt, every holding and every deposit the commit can touch. A kid
    // can owe for more than one thing, so snapshotting only the first debt
    // would leave the others paid down against a week that was un-recorded.
    debts: (typeof mnyDebts === 'function') ? mnyDebts(kid) : null,
    holdings: (typeof mnyHoldings === 'function') ? mnyHoldings(kid) : null,
    deposits: (typeof mnyEnsureDeposits === 'function') ? mnyEnsureDeposits(kid) : null,
    // Goal progress moves with the money, so it has to come back with it.
    savingGoals: (typeof mnyEnsureGoals === 'function') ? mnyEnsureGoals(kid) : null,
    xp: (getProfData(kid).progress || {}).questXP || 0,
    // The meeting also empties the box, so undo has to put it back.
    boxItems: (typeof mrBoxItems === 'function') ? mrBoxItems(kid) : null,
    /* The "made on its own since the last meeting" baseline needs no field of
       its own: mnyStampPassiveBaseline writes valueAtLastMeeting onto each
       holding, and `holdings` above is a deep copy, so restoring it restores
       the baseline with it. Worth saying out loud — it is not obvious, and an
       undo that missed it would swallow a stretch of interest for good. */
  }));
  mmUndo = {
    wk,
    jenn: snap('jenn'),
    jess: snap('jess'),
    marketMonth: bankConfig().marketMonth,
    finalized: (c.finalizedWeeks && c.finalizedWeeks[wk]) ? JSON.parse(JSON.stringify(c.finalizedWeeks[wk])) : null,
    xpAwarded: (c.xpAwardedWeeks && c.xpAwardedWeeks[wk]) ? JSON.parse(JSON.stringify(c.xpAwardedWeeks[wk])) : null,
    ledger: (c.moneyLedger && c.moneyLedger[wk]) ? JSON.parse(JSON.stringify(c.moneyLedger[wk])) : null,
    // What each kid decided, and whether she had agreed her week — an undo that
    // left the plan behind would show money moved against a week with no
    // decision recorded.
    plans: (c.weekPlans && c.weekPlans[wk]) ? JSON.parse(JSON.stringify(c.weekPlans[wk])) : null,
    confirms: (c.weekConfirms && c.weekConfirms[wk]) ? JSON.parse(JSON.stringify(c.weekConfirms[wk])) : null,
    // "We sat down" is a separate record from "the money moved", and an undo
    // that left it behind would show a week met with nothing settled.
    met: !!((c.meetingsMet || {})[wk]),
    heldBefore: !!((c.meetingsHeld || {})[wk]),
    // Which girls were already committed when the picture was taken. This is
    // what lets the message below be honest rather than assume.
    committedBefore: ['jenn', 'jess'].filter(k => isChildMoneyCommitted(k, wk)),
  };
}
function mmUndoRecord() {
  if (!mmUndo) return;
  const c = state.shared.chore; const wk = mmUndo.wk;
  ['jenn', 'jess'].forEach(kid => {
    const s = mmUndo[kid];
    const pd = getProfData(kid);
    pd.wallet = s.wallet;
    if (s.debts) pd.debts = s.debts;
    if (s.holdings) pd.holdings = s.holdings;
    if (s.deposits) pd.deposits = s.deposits;
    if (s.savingGoals) pd.savingGoals = s.savingGoals;
    if (s.boxItems) pd.boxItems = s.boxItems;
    if (!pd.progress) pd.progress = {};
    pd.progress.questXP = s.xp;
  });
  bankConfig().marketMonth = mmUndo.marketMonth;
  if (mmUndo.finalized) c.finalizedWeeks[wk] = mmUndo.finalized; else if (c.finalizedWeeks) delete c.finalizedWeeks[wk];
  // Clearing the XP ledger for the week is what lets a re-record award again;
  // without it the reversed XP could never be re-credited.
  if (c.xpAwardedWeeks) {
    if (mmUndo.xpAwarded) c.xpAwardedWeeks[wk] = mmUndo.xpAwarded; else delete c.xpAwardedWeeks[wk];
  }
  // The frozen ledger has to go back too, or an un-recorded week keeps a
  // history entry claiming it was settled.
  if (c.moneyLedger) {
    if (mmUndo.ledger) c.moneyLedger[wk] = mmUndo.ledger; else delete c.moneyLedger[wk];
  }
  // The decision and the agreement go back with the money. Leaving the plan
  // behind would leave the week showing as settled with nothing to settle.
  if (c.weekPlans) { if (mmUndo.plans) c.weekPlans[wk] = mmUndo.plans; else delete c.weekPlans[wk]; }
  if (c.weekConfirms) { if (mmUndo.confirms) c.weekConfirms[wk] = mmUndo.confirms; else delete c.weekConfirms[wk]; }
  if (typeof mnyDraft !== 'undefined') mnyDraft = null;
  if (c.meetingsHeld) { if (mmUndo.heldBefore) c.meetingsHeld[wk] = true; else delete c.meetingsHeld[wk]; }
  // "We sat down" and "the money moved" are different facts, and the undo has
  // to put each back the way it found it rather than assume both were false.
  if (c.meetingsMet) { if (mmUndo.met) c.meetingsMet[wk] = true; else delete c.meetingsMet[wk]; }

  /* Say only what is true. "Nothing was recorded" was printed unconditionally,
     including in the case it was most wrong about: after settling both girls,
     when the snapshot had been overwritten and only the second was actually
     reversed. It now names who went back — and if a girl was already committed
     before this sitting began, it says that instead of claiming the week is
     clean. */
  const wasClean = !(mmUndo.committedBefore || []).length;
  mmUndo = null;
  saveAll();
  renderMeetingMode();
  showToast(wasClean
    ? '↩️ Undone — nothing was recorded for either girl'
    : '↩️ Undone — both girls are back where they were before this meeting');
}

/* ── Where is this week, relative to now? ─────────────────────────
   The last step used to offer "Copy this week → next week" whatever week the
   meeting was pointed at, and mmPlanNextWeek read ctWeekInfo and then did
   weekOffset += 1 — so opening a week from six weeks ago and pressing it
   copied that historical week into the following historical one, over the top
   of a week that had already happened. */
function mmWeekPosition(wk) {
  const now = ctThisWeekKey();
  if (wk === now) return 'current';
  return wk < now ? 'past' : 'future';
}

/* Step 5 — what this week can still have done to it. */
function mmRenderPlan(wk) {
  const pos = mmWeekPosition(wk);
  const strip = mmSettledStrip(wk);

  if (pos === 'future') {
    /* A week that has not happened cannot be reviewed, settled or closed —
       there is nothing to review. Planning it is the week screen's job. */
    return `${strip}
      <div class="mm-h">This week hasn't happened yet</div>
      <div class="ct-meta">A future week can't be reviewed or closed. Plan it in the weekly planner, and come back once it has been lived.</div>
      <button type="button" class="btn-confirm" data-mm-action="thisweek">Go to this week ▶</button>`;
  }

  if (pos === 'past') {
    /* Catching up. The two things that make sense here are finishing the
       review and getting back to the present — never planning forward from a
       week that is already behind. */
    const unsettled = ['jenn', 'jess'].map(k => mmKidSettled(wk, k)).filter(x => !x.decided);
    const go = unsettled[0];
    return `${strip}
      <div class="mm-h">Finish reviewing this week</div>
      <div class="ct-meta">${escapeHtml(mmWeekLabel(wk))} has already been and gone, so there is nothing to plan forward from it. Finish what it still owes, then come back to the present.</div>
      ${go
        ? `<button type="button" class="btn-confirm" onclick="mnySetMeetKid('${escapeJsAttr(go.kid)}');mmGoStep(${go.agreed ? 4 : 3})">Finish ${escapeHtml(go.name)}'s week ▶</button>`
        : `<div class="mm-recorded">✅ This week is fully reviewed and settled.</div>`}
      <button type="button" class="pill-btn" data-mm-action="thisweek">Return to this week</button>`;
  }

  // Current week: close it, then move on. Copying a schedule stays where it
  // already lives — inside the next week's planner — rather than growing a
  // second copy control here.
  const gate = canCloseWeek(wk);
  const closed = isWeekClosed(wk);
  let closeBtn;
  if (closed) {
    closeBtn = `<div class="mm-recorded">✅ This week is closed.</div>
      <button type="button" class="pill-btn" onclick="mmReopenWeek()">Reopen it</button>`;
  } else if (gate.ok) {
    closeBtn = `<button type="button" class="btn-confirm" onclick="mmCloseWeekNow()">🔒 Close the week</button>`;
  } else {
    const why = gate.missing.map(m => m.reason === 'days'
      ? `${m.kid === 'jenn' ? 'Jenn' : 'Jess'} has ${m.n} day${m.n === 1 ? '' : 's'} still to review`
      : `${m.kid === 'jenn' ? 'Jenn' : 'Jess'}'s money is not settled yet`).join(' · ');
    closeBtn = `<button type="button" class="btn-confirm" disabled>🔒 Close the week</button>
      <div class="ct-meta">${escapeHtml(why)}.</div>`;
  }
  return `${strip}
    <div class="mm-h">Close the week</div>
    <div class="ct-meta">Closing records that both girls' days were reviewed and the money was settled. It is a separate fact from "we met" and from "the money moved".</div>
    ${closeBtn}
    <div class="mm-h mm-h-sub">Next week</div>
    <div class="ct-meta">Open next week to plan it. Copying a schedule across lives in the planner itself, next to the week it would land on.</div>
    <button type="button" class="pill-btn" onclick="mmOpenNextWeek()">Open next week ▶</button>`;
}

function mmCloseWeekNow() {
  const wk = mmWeekKey();
  const gate = canCloseWeek(wk);
  if (!gate.ok) { showToast('Both girls need reviewing and settling first'); return; }
  setWeekClosed(wk, true);
  saveAll();
  renderMeetingMode();
  showToast('🔒 Week closed');
}
function mmReopenWeek() {
  setWeekClosed(mmWeekKey(), false);
  saveAll();
  renderMeetingMode();
  showToast('Week reopened');
}
/* Straight to next week's planner. No copying — the planner's own offer is
   there, beside the week it would actually land on. */
function mmOpenNextWeek() {
  const wk = mmWeekKey();
  const next = dateToLocalKey(new Date(formatDayKey(wk).getTime() + 7 * 864e5));
  mmClearReturn();
  closeSheet('familyMeetingOverlay');
  weekOffset = computeWeekOffsetForDayKey(next);
  showScreen('week');
  renderWeek();
}

/* ── Is this meeting actually finished? ──
   The week is only recorded once BOTH kids are settled — commitMeetingShared
   fires from step 4 on the condition that jenn and jess are each committed. So
   a parent who worked through Jess and closed on "🎉 Finish meeting" left
   Jenn's week un-agreed, un-decided and unrecorded, with nothing on screen
   saying so. This strip is the missing readout: two rows, two states each,
   every one of them a tap to the step that fixes it. */
function mmKidSettled(wk, kid) {
  return {
    kid,
    name: kid === 'jenn' ? 'Jenn' : 'Jess',
    // A week earned under the retired group model has nothing to agree or
    // decide, so it counts as settled rather than blocking the meeting forever.
    old: !mrUsesNewModel(wk),
    agreed: !mrUsesNewModel(wk) || mnyIsConfirmed(wk, kid),
    decided: !mrUsesNewModel(wk) || mnyIsCommitted(wk, kid),
  };
}
function mmAllSettled(wk) {
  return ['jenn', 'jess'].every(k => mmKidSettled(wk, k).decided);
}
function mmSettledStrip(wk) {
  const rows = ['jenn', 'jess'].map(k => {
    const s = mmKidSettled(wk, k);
    const cell = (on, label, step) =>
      `<button type="button" class="mm-settle-cell ${on ? 'on' : ''}"
         onclick="mnySetMeetKid('${escapeJsAttr(k)}');mmGoStep(${step})">${on ? '✓' : '○'} ${label}</button>`;
    return `<div class="mm-settle-row">
        <span class="mm-settle-who">${CT_PROFILE_ICON[k]} ${escapeHtml(s.name)}</span>
        ${cell(s.agreed, 'Agreed', 3)}${cell(s.decided, 'Decided', 4)}
      </div>`;
  }).join('');
  const done = mmAllSettled(wk);
  return `<div class="mm-settle ${done ? 'done' : ''}">
      <div class="mm-settle-cap">${done
        ? '✅ Both weeks are settled — the money has moved and the week is recorded.'
        : 'Before you finish — tap anything unticked to go and do it.'}</div>
      ${rows}
    </div>`;
}
/* What the last button should say. A family genuinely might stop halfway and
   come back, so this names the gap rather than refusing — and keeps a way out. */
function mmFinishButtons(wk) {
  if (mmAllSettled(wk)) {
    return `<button type="button" class="btn-confirm" onclick="mmCloseMeeting()">🎉 Finish meeting</button>`;
  }
  const unsettled = ['jenn', 'jess'].map(k => mmKidSettled(wk, k)).filter(s => !s.decided);
  const gap = unsettled.length === 2
    ? "Neither week is decided yet"
    : `${unsettled[0].name}'s week isn't decided yet`;
  const goTo = unsettled[0];
  return `<span class="mm-finish-gap">
      <button type="button" class="pill-btn" onclick="mmCloseMeeting()">Close anyway</button>
      <button type="button" class="btn-confirm" onclick="mnySetMeetKid('${escapeJsAttr(goTo.kid)}');mmGoStep(${goTo.agreed ? 4 : 3})">${escapeHtml(gap)} ▶</button>
    </span>`;
}
/* mmPlanNextWeek lived here. It copied whatever week the meeting was pointed
   at into the following one and then did `weekOffset += 1` — which is correct
   only on the current week and silently wrong on every other, writing a
   historical week's plan over the top of another week that had already
   happened. The last step no longer offers it: copying a schedule belongs in
   the planner, beside the week it would land on, where pcwPlan (Setup › Copy a
   plan) and fillWeekFromNearest already do it and show their work first. */

// Core money commit for the weekly meeting (no UI): credit each kid's prelim
// pocket money to cash, advance the money world one month (interest + GIC
// maturities), step the market, and mark the week held. Returns summary parts.
/* The per-kid half. Split out of commitFamilyMeeting so the redesigned meeting
   can settle one kid at a time — she decides what happens to her own money on
   step 4, and her sister's week is a separate conversation that may not even
   happen on the same evening. */
function commitKidWeek(wk, kid, opts) {
  const o = opts || {};
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.finalizedWeeks) c.finalizedWeeks = {};
  if (!c.finalizedWeeks[wk]) c.finalizedWeeks[wk] = {};
  if (!c.meetingsHeld) c.meetingsHeld = {};
  if (!c.moneyLedger) c.moneyLedger = {};
  if (!c.moneyLedger[wk]) c.moneyLedger[wk] = {};
  const parts = [];
  const newModel = (typeof mrUsesNewModel === 'function') && mrUsesNewModel(wk);
  {
    const w = ensureWallet(kid);
    const name = kid === 'jenn' ? 'Jenn' : 'Jess';
    // The breakdown is frozen HERE, before anything moves. Recomputing it later
    // would read today's rules and today's grades, so a price edit or a late
    // regrade would silently rewrite what a past week said it paid. History has
    // to be a record, not a recomputation.
    const ledger = (newModel && c.moneyLedger[wk][kid] == null)
      ? mrFreezeWeekLedger(wk, kid) : null;
    if (c.finalizedWeeks[wk][kid] == null) {
      const prelim = ctWeekMoney(wk, kid);
      w.cash = money2(w.cash + prelim);
      c.finalizedWeeks[wk][kid] = prelim;
      if (prelim > 0) parts.push(`${name} +$${prelim.toFixed(2)}`);
    }
    // XP is computed all week but only credited here — awarding it on render
    // would multiply it by however many times the screen redrew. Idempotent
    // per week, so re-recording can't double-award.
    if (newModel) {
      const xp = mrCreditWeekXp(wk, kid);
      if (xp > 0) parts.push(`${name} +${xp} XP`);
      // A month of overdue interest, then the scheduled transfer. Interest is
      // charged BEFORE the payment so a kid who pays late still meets the cost
      // of having been late, rather than escaping it by paying on the day.
      const interest = mnyAccrueArrearsAll(kid);
      if (interest > 0) parts.push(`${name} interest −$${interest.toFixed(2)}`);
      // Both of these are stamped by calendar month inside the loan module —
      // the meeting is weekly, the schedule is monthly, so most Sundays this
      // correctly does nothing. Every debt is paid, highest bonus rate first.
      const transfers = mnySundayTransferAll(kid, o.shortfall || 'pay_available', { weekKey: wk });
      const t = transfers[0] || { paid: 0, shortfall: 0, kind: null };
      transfers.forEach(r => {
        const what = r.kind === 'down' ? 'down payment' : r.name;
        if (r.paid > 0) parts.push(`${name} ${what} −$${r.paid.toFixed(2)}`);
        if (r.shortfall > 0) parts.push(`${name} ${r.name} overdue $${r.shortfall.toFixed(2)}`);
      });
      // The box opens at the meeting, not on a calendar day.
      const released = mrReleaseBoxForMeeting(kid);
      if (released > 0) parts.push(`${name} box opened (${released})`);
      // Fill in what only became known as the meeting ran.
      if (ledger) {
        ledger.xp = xp;
        ledger.boxReleased = released;
        ledger.loan = {
          kind: t.kind || null,
          paid: money2(transfers.reduce((s, r) => s + (r.paid || 0), 0)),
          shortfall: money2(transfers.reduce((s, r) => s + (r.shortfall || 0), 0)),
          interest: money2(interest || 0),
          // Per debt, so a week with two loans can still be read back.
          each: transfers.map(r => ({ debtId: r.debtId, name: r.name,
                                      paid: money2(r.paid || 0), shortfall: money2(r.shortfall || 0) })),
        };
        c.moneyLedger[wk][kid] = ledger;
      }
    }
    const adv = moneyAdvanceMonth(kid);
    adv.matured.forEach(m => parts.push(`${name} unlocked +$${m.payout.toFixed(2)}`));
  }
  saveAll();
  return { parts, ledger: (c.moneyLedger[wk] || {})[kid] || null };
}

/* The half that belongs to the family rather than to one kid. Runs once, when
   both weeks are settled — marking the meeting held before the second kid has
   decided anything would lock her out of her own step 4. */
function commitMeetingShared(wk) {
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.meetingsHeld) c.meetingsHeld = {};
  bankSyncMarketMonth();   // the calendar moves the market, not the meeting count
  c.meetingsHeld[wk] = true;
  saveAll();
}

/* Both kids in one press. The redesigned meeting settles them one at a time on
   step 4; this stays for the legacy path and for anything that just wants the
   week recorded. */
function commitFamilyMeeting(wk) {
  const parts = [];
  ['jenn', 'jess'].forEach(kid => { parts.push(...commitKidWeek(wk, kid).parts); });
  commitMeetingShared(wk);
  return parts;
}
