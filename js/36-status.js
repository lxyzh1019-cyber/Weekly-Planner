/* ════════════════════════════════════════════════════════════════
   THE STATUS VOCABULARY — one answer per question, for every screen
   ════════════════════════════════════════════════════════════════

   Six screens each worked out "is this done?" for themselves, and the copies
   had drifted far enough that a parent could not tell which one was lying:

     · A routine's checklist and its block's `completed` flag were two records
       that never spoke. Ticking every item in Jenn's morning routine left the
       block reading not-done on Today, the week and the meeting.
     · Two different item-counts for the same routine — one counting every tick
       ever stored, one counting only items the routine currently has — so the
       same block could report 4/3 on one screen and 3/3 on another.
     · "Confirm all today" set `confirmed`; every screen draws its tick from
       `completed`. Pressing it changed nothing anyone could see.
     · The meeting's "Confirm this day" wrote the result for BOTH children.
     · A chore merely placed on the calendar counted as a chore done.

   This file owns NO data. Every function here reads through whichever accessor
   already owns that fact, and writes go to the function that already owned the
   write. It is loaded last on purpose: it calls into js/01 … js/35 at runtime,
   never at load time, so nothing here runs before its dependencies exist.

   Adding a second place that DECIDES any of these answers is the mistake this
   file exists to end. Ask it; do not re-derive it.
════════════════════════════════════════════════════════════════ */

/* ── Which checklist items does this routine have? ────────────────
   The one owner. There were two: countChecklistTotal (js/08-day-view.js) and
   ckRoutineItems (js/26-chore-kid.js), and they disagreed about whether a
   stale tick counts.

   `kid` matters and used to be dropped: getKidExtras read the ACTIVE profile,
   so the parent portal viewing Jenn could be handed Jess's extra items — and
   then measure Jenn's routine against them. */
function routineItemsFor(routineId, kid) {
  if (!routineId) return [];
  const tmpl = (typeof getRoutineTemplate === 'function') ? getRoutineTemplate(routineId) : null;
  const extras = (typeof getKidExtras === 'function') ? getKidExtras(routineId, kid) : [];
  const rewards = (typeof getUnlockedRoutineRewards === 'function')
    ? getUnlockedRoutineRewards(routineId, kid) : [];
  return [...((tmpl && tmpl.items) || []), ...(extras || []), ...(rewards || [])];
}

/* How many of them are ticked. Counted BY ITEM ID, never by counting the true
   values in checklistState — a tick left behind by an item a parent has since
   removed is not progress, and counting it is what produced "4/3 done". */
function routineTally(block, act, kid) {
  const items = routineItemsFor(act && act.routineId, kid);
  const st = (block && block.checklistState) || {};
  return { done: items.filter(i => st[i.id]).length, total: items.length, items };
}

/* ── Completed: the child performed the activity ──────────────────
   For a routine that is the checklist and nothing else, which is what makes
   unticking an item take the completion back. block.completed is still written
   for backward compatibility, but it is DERIVED from this — never an
   independent decision. */
function isRoutineCompleted(block, kid) {
  if (!block) return false;
  const p = kid || (typeof activeProfile === 'function' ? activeProfile() : null);
  const act = (typeof findActivity === 'function') ? findActivity(block.actId, p) : null;
  if (!act || !act.isRoutine) return false;
  const { done, total } = routineTally(block, act, p);
  return total > 0 && done >= total;
}

function isBlockCompleted(block, kid) {
  if (!block) return false;
  const p = kid || (typeof activeProfile === 'function' ? activeProfile() : null);
  const act = (typeof findActivity === 'function') ? findActivity(block.actId, p) : null;
  if (act && act.isRoutine) return isRoutineCompleted(block, p);
  return !!block.completed;
}

/* ── Parent-confirmed: a grown-up verified it ─────────────────────
   Deliberately independent of completion. Confirming an unfinished routine
   must not make it read as finished anywhere — a parent agreeing that a child
   did something is a different fact from the child having ticked it, and the
   two disagreeing is information, not a bug to paper over. */
function isBlockConfirmed(block) { return !!(block && block.confirmed); }

/* Keep the compatibility mirror honest. Called by every checklist write path;
   returns whether the stored flag actually moved. */
function syncRoutineCompletion(block, kid) {
  if (!block) return false;
  const p = kid || (typeof activeProfile === 'function' ? activeProfile() : null);
  const act = (typeof findActivity === 'function') ? findActivity(block.actId, p) : null;
  if (!act || !act.isRoutine) return false;
  const next = isRoutineCompleted(block, p);
  if (!!block.completed === next) return false;
  block.completed = next;
  if (typeof markItemUpdated === 'function') markItemUpdated(block);
  return true;
}

/* ── Day reviewed: a parent reviewed ONE child's whole day ─────────
   Per child. The store is shared with the parent portal's weekly review, and
   the meeting used to write both girls' entries from a single press — which is
   how "Confirm all" came to quietly mean "both children". */
function isDayReviewed(kid, dayKey) {
  const store = (state.shared && state.shared.parentDayConfirm) || {};
  return !!((store[kid] || {})[dayKey]);
}
function markDayReviewed(kid, dayKey, value) {
  if (!kid || !dayKey) return false;
  if (!state.shared.parentDayConfirm) state.shared.parentDayConfirm = {};
  if (!state.shared.parentDayConfirm[kid]) state.shared.parentDayConfirm[kid] = {};
  state.shared.parentDayConfirm[kid][dayKey] = (value === undefined) ? true : !!value;
  return true;
}

/* ── Has this block's time passed? ───────────────────────────────
   Asked by the review gate and by the reflection's evidence, which used to
   decide it separately: `canReviewDay` measured startMin + durationMin against
   the clock, while the evidence asked only whether the DAY had arrived. So a
   swim at six read as "not marked done" from breakfast time onwards, and told a
   child she had missed something she had not yet had the chance to do. */
function blockHasEnded(block, dayKey) {
  if (!block || block.startMin == null) return false;
  const today = todayKey();
  if (dayKey < today) return true;      // a past day is over whatever the clock says
  if (dayKey > today) return false;     // and a future one never got here
  const now = (typeof tdNowMin === 'function') ? tdNowMin() : 24 * 60;
  return (block.startMin + (block.durationMin || 0)) <= now;
}

/* ── …and whether it is even reviewable yet ───────────────────────
   Reviewing a day is an assertion about a day that HAPPENED. Three surfaces
   asked their own version of that question — the parent day banner, the
   meeting's step 1 rows and the week-close gate — and between them they left
   two holes:

     · "has it started" was standing in for "has it finished". A parent
       pressing at nine in the morning could review a day whose swim was still
       three hours away, because the only blocks measured were the ones that
       had begun.
     · a day with NO blocks passed every check trivially, so a Thursday in
       three weeks' time could be marked reviewed. There was nothing to find
       unconfirmed, so nothing objected.

   One decision now. It owns no data: the blocks come from getDayBlocks, the
   confirmation from isBlockConfirmed, the clock from tdNowMin. `reason` is
   what the disabled control says out loud — a control that refuses without
   saying why is the thing this repo keeps having to fix. */
function canReviewDay(kid, dayKey) {
  const none = { pendingCount: 0, futureCount: 0, endsAt: null, blockName: '' };
  if (!kid || !dayKey) return { ok: false, reason: 'future', ...none };
  const today = todayKey();
  const blocks = getDayBlocks(dayKey, kid) || [];
  if (dayKey > today) return { ok: false, reason: 'future', ...none, futureCount: blocks.length };

  /* Only today can still be in progress; blockHasEnded owns that arithmetic
     now, so the evidence lines and this gate cannot disagree about it. */
  const unfinished = (dayKey === today)
    ? blocks.filter(b => b && b.startMin != null && !blockHasEnded(b, dayKey))
    : [];
  if (unfinished.length) {
    const soonest = unfinished.slice().sort(
      (a, b) => (a.startMin + (a.durationMin || 0)) - (b.startMin + (b.durationMin || 0)))[0];
    const named = (typeof blockDisplayName === 'function')
      ? blockDisplayName(soonest, kid, dayKey) : null;
    return { ok: false, reason: 'running', ...none,
             futureCount: unfinished.length,
             endsAt: soonest.startMin + (soonest.durationMin || 0),
             blockName: (named && named.name) || 'An activity' };
  }

  const pending = (typeof dayBlocksEligibleToConfirm === 'function'
    ? dayBlocksEligibleToConfirm(dayKey, kid) : blocks).filter(b => !isBlockConfirmed(b));
  if (pending.length) return { ok: false, reason: 'unconfirmed', ...none, pendingCount: pending.length };

  /* A day that holds nothing CAN be reviewed — a quiet Sunday is a real
     answer. It is reported separately so the caller says "nothing was
     recorded" out loud rather than writing a review of an empty page.

     TODAY is the exception, and not only when it is empty: nothing is running
     and nothing is left to confirm at nine in the morning of a day whose
     swimming has not been put on it yet. A past day is over and cannot gain
     anything; today can. So today reports 'open' — reviewable, but only
     through an explicit "nothing else is planned" the way an empty day already
     asks — and until somebody says that, it holds the week open. */
  if (dayKey === today) return { ok: true, reason: 'open', ...none };
  return { ok: true, reason: blocks.length ? 'ready' : 'empty', ...none };
}

/* The sentence a refused control says, in one place, so the banner, the
   meeting and the week-close gate cannot describe the same day differently. */
function reviewBlockedReason(info) {
  if (!info || info.ok) return '';
  if (info.reason === 'future') return 'This day has not happened yet';
  if (info.reason === 'open') return 'Today is not over yet';
  if (info.reason === 'running') {
    const at = (typeof formatTimeFromMin === 'function') ? formatTimeFromMin(info.endsAt) : 'later today';
    return `${info.blockName} ends at ${at}`;
  }
  const n = info.pendingCount;
  return `${n} block${n === 1 ? '' : 's'} still need${n === 1 ? 's' : ''} confirming`;
}

/* ── The family's chores: three numbers, not one ──────────────────
   `required` is the family's share (freeChoresPerWeek — the first two house
   chores are mandatory). It used to be compared against ONE count that mixed
   scheduled and done together, so two chores merely placed on the calendar
   satisfied the rule without anybody lifting anything.

   Only the paying lane counts: `own` and `helping` need no block and stand
   every day, so counting them would meet the floor for free.

     planned     a distinct (day, chore) pair placed on the schedule
     fulfilled   a distinct pair a parent has GRADED above zero. Nothing less.
                 A claim is the child's account of it, not the answer.
     waiting     claimed by the child, still unanswered — "waiting for parent
                 check", so a child who did the work is never shown as having
                 not done it while a grown-up catches up.

   Reads only. Whether to say anything is the screen's business. */
function getFamilyChoreStatus(kid, weekKey) {
  const required = Number((mrRulesForWeek(weekKey).chores || {}).freeChoresPerWeek) || 0;
  const planned = new Set(), fulfilled = new Set(), waiting = new Set();
  for (let d = 0; d < 7; d++) {
    const { rows } = mrChoresForDay(kid, weekKey, d);
    rows.forEach(r => {
      if (!r.row || !mrLanePays(r.row.lane)) return;
      const key = d + ':' + r.row.id;
      const graded = mrGetChoreGrade(kid, weekKey, d, r.row.id) > 0;
      const claimed = mrGetClaim(kid, weekKey, d, r.row.id) > 0;
      if (r.scheduled) planned.add(key);
      if (graded) { fulfilled.add(key); planned.add(key); }
      else if (claimed) { waiting.add(key); planned.add(key); }
    });
  }
  return {
    required,
    planned: planned.size,
    fulfilled: fulfilled.size,
    waiting: waiting.size,
    unfulfilled: Math.max(0, required - fulfilled.size),
    stillNeedsADay: Math.max(0, required - planned.size),
  };
}

/* ── A week's hours, by group ─────────────────────────────────────
   One computation, read by the week glance, the parent trend, the parent
   detail, the meeting and print — five loops before this, three of which
   labelled the same category differently.

   Clamped to the plannable window (6am–10pm) exactly as computeWeekTotals did,
   so a block running past bedtime does not inflate a day beyond it.

   `completed` goes through isBlockCompleted, which is what makes a ticked
   routine checklist show up in the hours without the block ever having been
   pressed. `schoolMin` is carried separately because School lives inside Brain:
   at ~32 hours a week it would otherwise swamp homework entirely, and the row
   names how much of itself was the school day. */
function getWeeklyHours(kid, weekKey) {
  const keys = mrWeekDayKeys(weekKey);
  const acts = getAllActivities(kid, { includeArchived: true });
  const byGroup = {};
  let planned = 0, completed = 0, schoolMin = 0;
  GROUP_ORDER.forEach(g => { byGroup[g] = { planned: 0, completed: 0 }; });
  keys.forEach(key => {
    (getDayBlocksForProfile(key, kid) || []).forEach(b => {
      const s = Math.max(b.startMin, START_MIN);
      const e = Math.min(b.startMin + (b.durationMin || 0), END_MIN);
      const m = e - s;
      if (!(m > 0)) return;
      const act = acts.find(a => a.id === b.actId);
      const g = activityGroup(act);
      byGroup[g].planned += m; planned += m;
      if (b.actId === 'school_day') schoolMin += m;
      if (isBlockCompleted(b, kid)) { byGroup[g].completed += m; completed += m; }
    });
  });
  return { byGroup, planned, completed, schoolMin, days: keys.length || 7 };
}

/* ── Money committed: the earnings moved as she decided ───────────
   The money page already owns this; naming it here stops a screen inventing a
   second test for the same fact. */
function isChildMoneyCommitted(kid, weekKey) {
  return (typeof mnyIsCommitted === 'function') ? !!mnyIsCommitted(weekKey, kid) : false;
}

/* ── Week closed: both children reviewed, and a parent said so ────
   A separate record from "we met" (meetingsMet) and from "the money moved"
   (meetingsHeld), because it asserts something neither of those does: that
   every day of the week was reviewed for BOTH girls and a grown-up then closed
   it. `canCloseWeek` is what the button asks before offering itself, so the
   record can never claim more than happened. */
function isWeekClosed(weekKey) {
  ctEnsureShared();
  return !!((state.shared.chore.weeksClosed || {})[weekKey]);
}
/* Which days of a week count against a child when the week is asked to close.
   ONLY a day that has not happened is excused. A day still being lived is the
   opposite of an excuse: closing a week over a Sunday whose swimming is still
   in the pool records that the week was reviewed when an hour of it had not
   happened yet. mmCloseSummary counts through this same function, so the
   figure a parent reads and the gate they press cannot disagree. */
function weekDaysAwaitingReview(kid, weekKey) {
  return mrWeekDayKeys(weekKey).filter(k => {
    if (canReviewDay(kid, k).reason === 'future') return false;
    return !isDayReviewed(kid, k);
  });
}

function canCloseWeek(weekKey) {
  const missing = [];
  ['jenn', 'jess'].forEach(kid => {
    const unreviewed = weekDaysAwaitingReview(kid, weekKey).length;
    if (unreviewed) { missing.push({ kid, reason: 'days', n: unreviewed }); return; }
    /* The reflection is part of what closing a week records, so it has to be
       part of what closing a week REQUIRES. Either she answered it or it
       was deliberately set aside — a blank record is neither, and closing over
       one files "we reflected" against a conversation that never happened.
       Money stays independent of it, as designed. */
    if (typeof reflGet === 'function' && typeof reflIsSettled === 'function') {
      const rec = reflGet(weekKey, kid);
      if (!reflIsSettled(rec)) { missing.push({ kid, reason: 'reflection', n: 0 }); return; }
      /* Answered, but nobody has said the conversation happened. A finished
         reflection nobody talked about is a form, not a meeting. A skipped one
         is exempt: there was nothing to talk about. */
      if (typeof reflIsClosable === 'function' && !reflIsClosable(rec)) {
        missing.push({ kid, reason: 'reflection-talk', n: 0 });
        return;
      }
    }
    if (!isChildMoneyCommitted(kid, weekKey)) missing.push({ kid, reason: 'money', n: 0 });
  });
  return { ok: missing.length === 0, missing };
}
/* Close or reopen a week.

   Reopening removes the record, and for a long time that was all it did — which
   meant it did nothing at all beyond this device. `weeksClosed` lives inside
   state.shared.chore, merged by deepMergeObj, which iterates the keys the
   REMOTE has; an absence cannot be expressed that way, so a close always won,
   a reopen never travelled, and the week re-closed itself on the next snapshot
   with reflIsLocked re-locking both girls' reflections behind it.

   ctStampWeekState is what makes the removal sayable: a stamped week is
   arbitrated whole by the newer side across all eight week-state maps,
   including the keys it does not have. Reopening still touches no money —
   mnyReopenWeek is the separate door for that, deliberately. */
function setWeekClosed(weekKey, value) {
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.weeksClosed) c.weeksClosed = {};
  // safe-delete: stamped by ctStampWeekState below, so the newer side takes
  // this week across every week-state map — absence included.
  if (value === false) delete c.weeksClosed[weekKey];
  else c.weeksClosed[weekKey] = { at: syncNow(), by: 'a grown-up' };
  ctStampWeekState(weekKey);
  return true;
}

/* Node-side unit tests reach the pure helpers through this; the browser never
   sees it (js/04-merge.js, js/18-rules.js and js/21-money-data.js carry the
   same guard). */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { routineItemsFor, routineTally };
}
