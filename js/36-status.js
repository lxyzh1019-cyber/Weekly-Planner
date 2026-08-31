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
function canCloseWeek(weekKey) {
  const missing = [];
  ['jenn', 'jess'].forEach(kid => {
    const unreviewed = mrWeekDayKeys(weekKey).filter(k => !isDayReviewed(kid, k)).length;
    if (unreviewed) missing.push({ kid, reason: 'days', n: unreviewed });
    else if (!isChildMoneyCommitted(kid, weekKey)) missing.push({ kid, reason: 'money', n: 0 });
  });
  return { ok: missing.length === 0, missing };
}
function setWeekClosed(weekKey, value) {
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.weeksClosed) c.weeksClosed = {};
  if (value === false) delete c.weeksClosed[weekKey];
  else c.weeksClosed[weekKey] = { at: Date.now(), by: 'a grown-up' };
  return true;
}

/* Node-side unit tests reach the pure helpers through this; the browser never
   sees it (js/04-merge.js, js/18-rules.js and js/21-money-data.js carry the
   same guard). */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { routineItemsFor, routineTally };
}
