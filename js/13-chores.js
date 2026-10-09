// Weekly-Planner — chore tab: groups, matrix, payouts, migrations, chore-tab render.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   CHORE TAB (FULL MERGE)
════════════════════════════════════════════════════════════════ */
const CT_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const CT_SESSIONS = ['Morning','Afternoon','Evening'];
const CT_CHORES = ['Mop','Vacuum','Dish Clean & Dishwasher','Laundry','Sorting Clothes','Extra Exercise','Other'];
const CT_MONEY_CAP = 6;
const CT_SUMMARY_WEEKS = 8;  // Rolling window for summary table
const CT_PROFILE_ICON = { jenn:'🐥', jess:'🦊' };
let ctWeekKey = null;  // "YYYY-MM-DD" Monday of current chore week (synced with weekOffset)
let ctDay = 0;
let ctParentKid = 'jenn';

function ctMondayOf(date) {
  const d = new Date(date);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow===1?0:dow===0?-6:1-dow));
  d.setHours(0,0,0,0);
  return d;
}
function ctDateToKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
/* THE current week, for everything chore- and money-shaped.

   `ctMondayOf(new Date())` reads the device's raw clock; the planner derives
   its week from getWeekStart(), which goes through the app's timezone
   (APP_TIMEZONE). On a device whose clock sits in a different zone the two
   disagree for part of every day — and at a week boundary they name *different
   Mondays*. That is not cosmetic: a week key recorded by the raw-clock path and
   compared against the planner's own names a different week for part of every
   day — which is how the chore tab once came to decide, on a Sunday evening,
   that the current week predated the money system, and fall back to the retired
   board with no chore rows and nothing to claim.

   One derivation, shared by both, so they cannot drift. */
function ctThisMonday() { return getWeekStart(0); }
function ctThisWeekKey() { return dateToLocalKey(getWeekStart(0)); }
function ctEnsureShared() {
  if (!state.shared) state.shared = {};
  if (!state.shared.chore) state.shared.chore = {};
  const c = state.shared.chore;
  /* programStartDate is NOT seeded here any more. Seeding it to today is how a
     household that had been running for months came to be told its record
     began this week — see mrStartWeek (js/18-rules.js), which derives it from
     the earliest thing on file and writes nothing. */
  if (!c.goalsByWeek) c.goalsByWeek = {};
  if (!c.goalsUpdatedAtByWeek) c.goalsUpdatedAtByWeek = {}; // per-week goal edit ts → conflict-aware sync merge
  if (!c.goalBonusByWeek) c.goalBonusByWeek = {};
  if (!c.locked) c.locked = { enabled: false, pin: '1234' };
  if (!c.migration) c.migration = { done: false, migratedAt: null, sourceUpdatedAt: 0 };
  if (!c.legacy) c.legacy = { payload: null, updatedAt: 0 };
  if (c.readLegacyCompatibility == null) c.readLegacyCompatibility = false;
  // ── Chore groups (priced pocket-money model) ──
  if (!c.groups) c.groups = [];                    // [{id,name,icon,kid,choreIds:[names],valueDollars,cadence}]
  if (!c.groupPayoutsFired) c.groupPayoutsFired = {}; // {[weekKey]:{[groupId]:{[kid]:{weekly:true,total}|{days:{dayIdx:true},total}}}}
  if (!c.moneySnapshots) c.moneySnapshots = {};    // {[weekKey]:{jenn:$,jess:$}} — historical weeks frozen at migration
  if (!c.groupsMigration) c.groupsMigration = { done: false };
  if (!c.customChores) c.customChores = [];        // parent-added chore names
  if (!c.hiddenChores) c.hiddenChores = [];        // base/custom names hidden from the pickable list
}

/* Chore names a parent can pick/assign right now: base defaults + custom,
   minus any they've hidden. (ctAllChoreNames keeps the full union incl.
   hidden + group-referenced, for validating existing tagged blocks.) */
function ctPickableChoreNames() {
  ctEnsureShared();
  const c = state.shared.chore;
  const hidden = new Set(c.hiddenChores || []);
  const set = new Set([...CT_CHORES, ...(c.customChores || [])]);
  return [...set].filter(n => !hidden.has(n));
}
function ctEnsureProfile(p) {
  if (!p.chore) p.chore = {};
  if (!p.chore.mandatoryByWeek) p.chore.mandatoryByWeek = {};
  if (!p.chore.optionalByWeek) p.chore.optionalByWeek = {};
  if (!p.chore.mandatoryAutoByWeek) p.chore.mandatoryAutoByWeek = {};
  if (!p.chore.updatedAtByWeek) p.chore.updatedAtByWeek = {}; // {[weekKey]: ms} — newest edit wins that week in sync merges
}
/* Stamp a chore edit so cross-device merges know which side of a week is newer
   (this is what lets an UNcheck beat a stale remote check). */
function ctStampChoreWeek(p, weekKey) {
  if (!p.chore.updatedAtByWeek) p.chore.updatedAtByWeek = {};
  // syncNow, not Date.now: mergeChoreState compares this stamp against the
  // other device's to decide which side of the week wins outright, so it has to
  // be on the same corrected clock as everything else it is measured against.
  p.chore.updatedAtByWeek[weekKey] = syncNow();
}
/* Stamp a week whose RECORDED STATE was deliberately changed — closed,
   reopened, settled, reset, or undone. Eight week-keyed maps carry that state
   (CHORE_WEEK_STATE_MAPS, js/04-merge.js) and they are grow-only unions until a
   week is stamped, at which point the newest side takes that week across all
   eight — including the keys it does NOT have, which is the only way one device
   can tell another that something was taken back. Without it Undo reversed the
   wallet and left the week reading as settled on the other device, and
   reopening a week never travelled at all. */
function ctStampWeekState(weekKey) {
  if (!weekKey) return;
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.weekStateUpdatedAt) c.weekStateUpdatedAt = {};
  c.weekStateUpdatedAt[weekKey] = syncNow();
}
/* One shared prepare step for EVERY chore-reading surface (chore tab, kid week
   matrix, weekly-review hub, family meeting). All migrations run everywhere so
   the three surfaces can never disagree about the same week's data. */
function ctPrepareRead() {
  ctEnsureShared();
  ctEnsureProfile(getProfData('jenn'));
  ctEnsureProfile(getProfData('jess'));
  ctTryMigrateLegacy();
  ctMigrateNumberedKeys();
  ctMigrateToGroups();
}
function ctWeekInfo() {
  const mon = formatDayKey(ctWeekKey || ctThisWeekKey());
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const keys = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    keys.push(ctDateToKey(d));
  }
  return { keys, mon, sun };
}
/* A goal used to be one number: total points for the week. The redesign splits
   it into a routine goal and a money goal, and meeting BOTH is what the +$1 is
   for. Weeks written before that stay a points goal and keep firing on the old
   rule — a bonus already banked must not un-bank itself because the shape of a
   goal changed. */
function ctNormalizeGoal(g) {
  if (g == null || g === '') return null;
  if (typeof g === 'number') return { points: g };
  if (typeof g === 'object') {
    if (g.points != null) return { points: Number(g.points) || 0 };
    const routineDays = g.routineDays == null ? null : Number(g.routineDays) || 0;
    const money = g.money == null ? null : Number(g.money) || 0;
    if (routineDays == null && money == null) return null;
    return { routineDays, money };
  }
  const n = Number(g);
  return Number.isFinite(n) ? { points: n } : null;
}
/* One line describing a goal, whichever shape it is. */
function ctGoalLabel(goal) {
  const g = ctNormalizeGoal(goal);
  if (!g) return '';
  if (g.points != null) return `${g.points} points`;
  const bits = [];
  if (g.routineDays != null) bits.push(`${g.routineDays} clean day${g.routineDays === 1 ? '' : 's'}`);
  if (g.money != null) bits.push(`$${Number(g.money).toFixed(2)}`);
  return bits.join(' · ');
}
function ctGetWeekGoals(weekKey) {
  ctEnsureShared();
  const g = state.shared.chore.goalsByWeek[weekKey] || {};
  return { jenn: ctNormalizeGoal(g.jenn), jess: ctNormalizeGoal(g.jess) };
}
function ctSetWeekGoals(weekKey, jGoal, kGoal) {
  ctEnsureShared();
  state.shared.chore.goalsByWeek[weekKey] = { jenn: jGoal || null, jess: kGoal || null };
  state.shared.chore.goalsUpdatedAtByWeek[weekKey] = syncNow(); // corrected clock; mergeSharedChore arbitrates on it
  const bonus = state.shared.chore.goalBonusByWeek[weekKey] || { jenn:false, jess:false };
  if (jGoal == null) bonus.jenn = false;
  if (kGoal == null) bonus.jess = false;
  state.shared.chore.goalBonusByWeek[weekKey] = bonus;
}
function ctGetGoalBonus(weekKey, kid) {
  ctEnsureShared();
  return !!(state.shared.chore.goalBonusByWeek[weekKey] || {})[kid];
}
function ctSetGoalBonus(weekKey, kid, val) {
  ctEnsureShared();
  if (!state.shared.chore.goalBonusByWeek[weekKey]) state.shared.chore.goalBonusByWeek[weekKey] = { jenn:false, jess:false };
  state.shared.chore.goalBonusByWeek[weekKey][kid] = !!val;
}
/* ── Chore-group helpers (priced pocket-money model) ── */
function ctGroups() { ctEnsureShared(); return state.shared.chore.groups; }
function ctGroupsForKid(kid) { return ctGroups().filter(g => g.kid === kid || g.kid === 'both'); }
function ctAllChoreNames() {
  // Full union for validation: base + parent-custom + any names introduced by
  // groups (includes hidden names so existing tagged blocks still resolve).
  ctEnsureShared();
  const set = new Set([...CT_CHORES, ...(state.shared.chore.customChores || [])]);
  for (const g of ctGroups()) for (const c of (g.choreIds || [])) set.add(c);
  return [...set];
}
function ctGetGroupFiredEntry(weekKey, gid, kid) {
  ctEnsureShared();
  return (((state.shared.chore.groupPayoutsFired[weekKey] || {})[gid] || {})[kid]) || null;
}
function ctGroupFiredWeekly(weekKey, gid, kid) {
  const e = ctGetGroupFiredEntry(weekKey, gid, kid);
  return e === true || !!(e && e.weekly);        // bare `true` = legacy weekly fire
}
function ctGroupFiredDaily(weekKey, gid, kid, dayIdx) {
  const e = ctGetGroupFiredEntry(weekKey, gid, kid);
  return !!(e && e.days && e.days[String(dayIdx)]);
}
function ctSetGroupFired(weekKey, gid, kid, { cadence, dayIdx, amount }) {
  ctEnsureShared();
  const f = state.shared.chore.groupPayoutsFired;
  if (!f[weekKey]) f[weekKey] = {};
  if (!f[weekKey][gid]) f[weekKey][gid] = {};
  let e = f[weekKey][gid][kid];
  if (!e || e === true) e = f[weekKey][gid][kid] = (e === true ? { weekly:true, total:0 } : { total:0 });
  if (cadence === 'weekly') {
    if (e.weekly) return;                          // idempotent
    e.weekly = true; e.total = (Number(e.total)||0) + amount;
  } else {
    if (!e.days) e.days = {};
    if (e.days[String(dayIdx)]) return;            // idempotent per day
    e.days[String(dayIdx)] = true; e.total = (Number(e.total)||0) + amount;
  }
}
function ctGroupCompleteDaily(weekKey, dayIdx, kid, g) {
  return (g.choreIds || []).every(c => ctGetOptional(weekKey, dayIdx, kid, c));
}
function ctGroupCompleteWeekly(weekKey, kid, g) {
  // each member chore checked on at least one day this week
  return (g.choreIds || []).every(c => {
    for (let d = 0; d < 7; d++) if (ctGetOptional(weekKey, d, kid, c)) return true;
    return false;
  });
}
function ctGetMandatory(weekKey, dayIdx, session, kid) {
  const p = getProfData(kid);
  ctEnsureProfile(p);
  return !!(((p.chore.mandatoryByWeek[weekKey] || {})[String(dayIdx)] || {})[session]);
}
function ctSetMandatory(weekKey, dayIdx, session, kid, value) {
  const p = getProfData(kid);
  ctEnsureProfile(p);
  if (!p.chore.mandatoryByWeek[weekKey]) p.chore.mandatoryByWeek[weekKey] = {};
  if (!p.chore.mandatoryByWeek[weekKey][String(dayIdx)]) p.chore.mandatoryByWeek[weekKey][String(dayIdx)] = {};
  p.chore.mandatoryByWeek[weekKey][String(dayIdx)][session] = !!value;
  ctStampChoreWeek(p, weekKey);
}
function ctGetOptional(weekKey, dayIdx, kid, choreName) {
  const p = getProfData(kid);
  ctEnsureProfile(p);
  return !!(((p.chore.optionalByWeek[weekKey] || {})[String(dayIdx)] || {})[choreName]);
}
function ctSetOptional(weekKey, dayIdx, kid, choreName, value) {
  const p = getProfData(kid);
  ctEnsureProfile(p);
  if (!p.chore.optionalByWeek[weekKey]) p.chore.optionalByWeek[weekKey] = {};
  if (!p.chore.optionalByWeek[weekKey][String(dayIdx)]) p.chore.optionalByWeek[weekKey][String(dayIdx)] = {};
  p.chore.optionalByWeek[weekKey][String(dayIdx)][choreName] = !!value;
  ctStampChoreWeek(p, weekKey);
}
function ctGetMandatoryAuto(weekKey, dayIdx, session, kid) {
  const p = getProfData(kid);
  ctEnsureProfile(p);
  return !!((((p.chore.mandatoryAutoByWeek || {})[weekKey] || {})[String(dayIdx)] || {})[session]);
}
/* Provenance: did the APP set this mark, or did a grown-up? It only ever set
   true, which was fine while the mark could never be taken back. Now that
   unticking a routine item clears it (ctSyncMandatoryFromRoutine), the stamp
   has to be clearable too — otherwise a day the app set, then cleared, then a
   parent ticked by hand would still look auto, and the next untick would
   silently overrule her. */
function ctSetMandatoryAuto(weekKey, dayIdx, session, kid, value = true) {
  const p = getProfData(kid);
  ctEnsureProfile(p);
  if (!p.chore.mandatoryAutoByWeek[weekKey]) p.chore.mandatoryAutoByWeek[weekKey] = {};
  if (!p.chore.mandatoryAutoByWeek[weekKey][String(dayIdx)]) p.chore.mandatoryAutoByWeek[weekKey][String(dayIdx)] = {};
  if (value) p.chore.mandatoryAutoByWeek[weekKey][String(dayIdx)][session] = true;
  else delete p.chore.mandatoryAutoByWeek[weekKey][String(dayIdx)][session];
  ctStampChoreWeek(p, weekKey);
}
function ctMandatoryPoints(weekKey, kid) {
  let n = 0;
  for (let d = 0; d < 7; d++) for (const s of CT_SESSIONS) if (ctGetMandatory(weekKey, d, s, kid)) n++;
  return n;
}
function ctOptionalPoints(weekKey, kid) {
  let n = 0;
  for (let d = 0; d < 7; d++) for (const c of ctAllChoreNames()) if (ctGetOptional(weekKey, d, kid, c)) n++;
  return n;
}
// Legacy money formula input — kept only for the one-time migration snapshot.
function ctBonusDaysLegacy(weekKey, kid) {
  let n = 0;
  for (let d = 0; d < 7; d++) {
    if (CT_CHORES.some(c=>ctGetOptional(weekKey, d, kid, c))) n++;
  }
  return n;
}
/* Still CT_SESSIONS, deliberately. This asks whether the legacy per-session
   store ever HELD anything for a historic week, to decide if that week needs a
   migration snapshot. "What does today's plan ask for" is the wrong question
   about a week from two years ago — the blocks that would answer it may not
   exist — and narrowing it would make a week carrying real ticks read as empty
   and silently skip its money snapshot. */
function ctWeekHasData(weekKey, kid) {
  for (let d = 0; d < 7; d++) {
    if (CT_SESSIONS.some(s=>ctGetMandatory(weekKey, d, s, kid))) return true;
    if (ctAllChoreNames().some(c=>ctGetOptional(weekKey, d, kid, c))) return true;
  }
  return false;
}
/* The single computation every money surface reads. ONE model, for every week.

   There used to be two. Weeks before `moneyModelStartWeek` were priced by the
   retired group-payout formula — chore groups pay, $6 weekly cap — on the
   reasoning that history must not move when the family switches to graded
   chores. The reasoning was right and the mechanism was wrong: that store
   seeded itself to the current Monday, so on any device running a new build
   EVERY week the family had lived became a "legacy" week, and graded chores
   and the routine streak paid nothing in all of them.

   What actually protects history is two other things, both still here: a
   settled week is a FROZEN LEDGER and is never recomputed at all, and a price
   edit lands as an effective-dated rule version (mrVersionForDate), so an old
   week still prices under the rules that were live when it was lived. The
   model gate was never what made that true.

   `moneySnapshots` stays ahead of everything: weeks frozen at the original
   migration are a record, not a calculation. */
/* A week frozen at the original migration — earned before this system existed.
   One owner, because `ctWeekMoney` skips it, the chore tab renders the retired
   board for it, and the money card names it, and three copies of "is this week
   from before?" is exactly the drift CLAUDE.md keeps recording. */
function ctWeekIsPreSystem(weekKey, kid) {
  ctEnsureShared();
  const snap = state.shared.chore.moneySnapshots[weekKey];
  return !!(snap && snap[kid] != null);
}
function ctWeekMoney(weekKey, kid) {
  ctEnsureShared();
  const snap = state.shared.chore.moneySnapshots[weekKey];
  if (snap && snap[kid] != null) return snap[kid];   // historical week frozen at migration
  return mrWeekMoney(weekKey, kid);
}
/* Clean routine days this week — the routine half of a goal. */
function ctRoutineDaysDone(weekKey, kid) {
  let n = 0;
  for (let d = 0; d < 7; d++) if (mrStreakDayDone(weekKey, kid, d)) n++;
  return n;
}
function ctMaybeFireGoalBonus(weekKey, kid) {
  const goal = ctGetWeekGoals(weekKey)[kid];
  if (!goal) return;
  if (ctGetGoalBonus(weekKey, kid)) return;
  if (goal.points != null) {   // legacy single-number goal, unchanged
    const points = ctMandatoryPoints(weekKey, kid) + ctOptionalPoints(weekKey, kid);
    if (points >= goal.points) ctSetGoalBonus(weekKey, kid, true);
    return;
  }
  // Both halves must land. A half that was never set can't hold the bonus back.
  const routineOk = goal.routineDays == null || ctRoutineDaysDone(weekKey, kid) >= goal.routineDays;
  const moneyOk   = goal.money == null || ctWeekMoney(weekKey, kid) >= goal.money;
  if (routineOk && moneyOk) ctSetGoalBonus(weekKey, kid, true);
}
// Fire any newly-completed group payouts for `kid` in `weekKey`.
// `dayIdx` is the day just mutated (required for daily cadence; pass null to skip daily groups).
// Sticky by construction — it only ADDS fired entries; unchecking never removes them.
// Returns the array of groups that fired on this call. Caller must saveAll() + re-render.
function ctCheckGroupPayouts(weekKey, dayIdx, kid) {
  ctEnsureShared();
  const snap = state.shared.chore.moneySnapshots[weekKey];
  if (snap && snap[kid] != null) return [];   // frozen historical week: never fire
  const fired = [];
  for (const g of ctGroupsForKid(kid)) {
    const amount = Number(g.valueDollars);
    if (!Array.isArray(g.choreIds) || !g.choreIds.length || !(amount > 0)) continue;
    if (g.cadence === 'daily') {
      if (dayIdx == null) continue;
      if (ctGroupFiredDaily(weekKey, g.id, kid, dayIdx)) continue;
      if (!ctGroupCompleteDaily(weekKey, dayIdx, kid, g)) continue;
      ctSetGroupFired(weekKey, g.id, kid, { cadence:'daily', dayIdx, amount });
      fired.push(g);
    } else {
      if (ctGroupFiredWeekly(weekKey, g.id, kid)) continue;
      if (!ctGroupCompleteWeekly(weekKey, kid, g)) continue;
      ctSetGroupFired(weekKey, g.id, kid, { cadence:'weekly', amount });
      fired.push(g);
    }
  }
  return fired;
}
// Silent reconciliation sweep across all 7 days + weekly groups (no toasts).
function ctSweepGroupPayouts(weekKey, kid) {
  let any = [];
  for (let d = 0; d < 7; d++) any = any.concat(ctCheckGroupPayouts(weekKey, d, kid));
  return any;
}
function ctSetCurrentWeekFromPlanner() {
  ctWeekKey = dateToLocalKey(getWeekStart(weekOffset));
}
function ctWeekKeyForDate(dayKey) {
  return ctDateToKey(ctMondayOf(formatDayKey(dayKey)));
}
async function ctClearWeek() {
  const info = ctWeekInfo();
  if (!(await showConfirm(`Reset all chore data (and pocket money) for week of ${MONTH_SHORT[info.mon.getMonth()]} ${info.mon.getDate()}?`, { danger:true, okLabel:'Reset' }))) return;
  ['jenn','jess'].forEach(kid=>{
    const p = getProfData(kid);
    ctEnsureProfile(p);
    delete p.chore.mandatoryByWeek[ctWeekKey];
    delete p.chore.optionalByWeek[ctWeekKey];
    delete p.chore.mandatoryAutoByWeek[ctWeekKey];
  });
  ctSetGoalBonus(ctWeekKey, 'jenn', false);
  ctSetGoalBonus(ctWeekKey, 'jess', false);
  ctEnsureShared();
  // safe-delete: stamped by ctStampWeekState below. A reset REMOVES from two
  // grow-only maps, and an absence is the one thing deepMergeObj cannot
  // express — without the stamp the other device's snapshot puts both straight
  // back and the reset quietly undoes itself.
  delete state.shared.chore.groupPayoutsFired[ctWeekKey];  // explicit parent reset beats stickiness
  delete state.shared.chore.moneySnapshots[ctWeekKey];  // safe-delete: stamped below
  ctStampWeekState(ctWeekKey);
  saveAll();
}
function ctExportBackup() {
  ctEnsureShared();
  const payload = {
    version: 3,
    exportedAt: new Date().toISOString(),
    weekKey: ctWeekKey,
    day: ctDay,
    migration: state.shared.chore.migration,
    goalsByWeek: state.shared.chore.goalsByWeek,
    goalBonusByWeek: state.shared.chore.goalBonusByWeek,
    groups: state.shared.chore.groups,
    groupPayoutsFired: state.shared.chore.groupPayoutsFired,
    moneySnapshots: state.shared.chore.moneySnapshots,
    groupsMigration: state.shared.chore.groupsMigration,
    profiles: {
      jenn: getProfData('jenn').chore || {},
      jess: getProfData('jess').chore || {},
    },
    summary: {
      jenn: { mandatory: ctMandatoryPoints(ctWeekKey,'jenn'), optional: ctOptionalPoints(ctWeekKey,'jenn'), money: ctWeekMoney(ctWeekKey,'jenn') },
      jess: { mandatory: ctMandatoryPoints(ctWeekKey,'jess'), optional: ctOptionalPoints(ctWeekKey,'jess'), money: ctWeekMoney(ctWeekKey,'jess') },
    },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `weekly-planner-chore-backup-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Chore backup exported ✅');
}
/* The caller path for a named kid, week and day — Today's Own things card and
   the portal's on-her-behalf card cycle through it (R5 §5 C1), so the words and
   the one writer (mrCyclePersonal) are the chore tab's own. */
function ctCyclePersonalFor(kid, weekKey, dayIdx, choreId) {
  const next = mrCyclePersonal(kid, weekKey, dayIdx, choreId);
  if (next === 'unasked') showToast('⭐ Done without being asked — that earns XP');
  return next;
}
// The ct-actions the parent portal's chore panel forwards (cpHandleCtClick,
// js/27-chore-parent.js). Names travel only via data-attributes, so no user
// text is ever interpolated into inline handlers.
function ctHandleWrapClick(e) {
  const el = e.target.closest('[data-ct-action]');
  if (!el || el.disabled) return;
  const a = el.dataset.ctAction;
  if (a === 'sunday-check') ctRunSundayCheck();
  /* The Record sheet (js/41-record.js) replaced ctPromptCompetition's chain of
     eleven sequential prompts. Same writer, one screen, and the answers stay
     visible while they are given. */
  else if (a === 'add-comp')  { openRecordSheet({ kind: 'meet', kid: ctActiveKid(), dayKey: ctWeekInfo().keys[ctDay] }); }
  else if (a === 'edit-comp') { openRecordSheet({ kind: 'meet', kid: ctActiveKid(), id: el.dataset.compId }); }
  else if (a === 'del-comp')  { ctRemoveCompetition(el.dataset.compId); }
  else if (a === 'box-item') ctPromptBoxItem();
  else if (a === 'release-box') ctReleaseBox(el.dataset.boxId);
  else if (a === 'honesty') ctPromptHonesty();
}

function ctActiveKid() { return isParent() ? ctParentKid : activeProfile(); }

/* Parent-only, for a named kid, week and day — Parent › Now logs learning
   through this (R5 §5 C1). mrSetLearning stays the one writer. */
function ctBumpLearningFor(kid, weekKey, dayIdx, itemId, delta) {
  if (!isParent()) { showToast('Mom logs the learning 🔒'); return false; }
  const cur = mrGetLearning(kid, weekKey, dayIdx, itemId);
  mrSetLearning(kid, weekKey, dayIdx, itemId, Math.max(0, cur + delta));
  return true;
}
/* Sunday check: pick N logged items at random and ask. Anything she can't
   answer for is voided — the units stop paying and get re-queued. */
async function ctRunSundayCheck() {
  if (!isParent()) return;
  const kid = ctActiveKid();
  const r = mrRulesForWeek(ctWeekKey);
  const pool = [];
  ((r.learning || {}).items || []).forEach(it => {
    for (let d = 0; d < 7; d++) if (mrGetLearning(kid, ctWeekKey, d, it.id) > 0) pool.push({ d, it });
  });
  if (!pool.length) { showToast('Nothing logged to check yet'); return; }
  const n = Math.min(Number((r.learning || {}).sundayCheckCount) || 3, pool.length);
  const picks = pool.sort(() => Math.random() - 0.5).slice(0, n);
  let voided = 0;
  for (const p of picks) {
    const ok = await showConfirm(
      `${CT_DAYS[p.d]} — ${p.it.label}\nDoes she still know it?`,
      { okLabel: 'Yes, she knows it', danger: false });
    if (!ok) { mrVoidLearning(kid, ctWeekKey, p.d, p.it.id); voided++; }
  }
  cpRenderChoreTab();
  showToast(voided ? `🔍 ${voided} voided — unpaid and to do again` : '🔍 All checked — all paid');
}

function ctRemoveCompetition(id) { mrDeleteCompetition(ctActiveKid(), id); cpRenderChoreTab(); }

async function ctPromptBoxItem() {
  if (!isParent()) return;
  const label = await showPrompt('What went in the box?', { value: '' });
  if (!label || !label.trim()) return;
  // School books, homework and sports gear are never boxed — they go on Mom's
  // shelf. The exempt list was in the rules and read by nothing, so the app
  // would happily box the one thing the rulebook promises it won't.
  const cfg = mrBoxCfg(mrRulesForWeek(ctWeekKey));
  const norm = label.trim().toLowerCase();
  const hit = (cfg.exempt || []).find(x => norm.includes(String(x).toLowerCase())
                                        || String(x).toLowerCase().includes(norm));
  if (hit) {
    const go = await showConfirm(
      `"${label.trim()}" looks like ${hit} — the rulebook says that's never boxed.\nIt goes on Mom's shelf and she asks for it.\n\nBox it anyway?`,
      { okLabel: 'Box it anyway', cancelLabel: 'Put it on the shelf', danger: true });
    if (!go) return;
  }
  const e = mrBoxItem(ctActiveKid(), label, ctWeekKey);
  cpRenderChoreTab();
  if (e) showToast(e.repeat ? `📦 Boxed again this week — that's also −$1` : '📦 Boxed until Sunday');
}
/* Early release costs one unpaid job, chosen by Mom. The job is named first,
   then confirmed with a tick — the tap has to be a statement that the job was
   actually done, not a reflex. Anything still boxed on Sunday comes back free
   at the family meeting, so this path is only for getting it back sooner. */
async function ctReleaseBox(id) {
  if (!isParent()) { showToast('A grown-up opens the box 🔒'); return; }
  const kid = ctActiveKid();
  const b = mrBoxItems(kid).find(x => x.id === id);
  if (!b) return;
  const cfg = mrBoxCfg(mrRulesForWeek(ctWeekKey));
  if (!cfg.redemptionJob) { mrReleaseBoxItem(kid, id); cpRenderChoreTab(); return; }

  const job = ((await showPrompt(
    `Early release: ${b.label}\nWhich unpaid job did she do to earn it back?`,
    { value: '' })) || '').trim();
  if (!job) return;
  const ok = await showCheckConfirm(
    `Give back "${b.label}"?`,
    `${job} was done, to standard${cfg.redemptionCountsToFree === false ? " — and it does NOT count toward her free chores" : ''}`,
    { okLabel: 'Give it back' });
  if (!ok) return;
  mrReleaseBoxItem(kid, id, { job });
  cpRenderChoreTab();
  showToast(`📦 Released early — ${job}`);
}


async function ctPromptHonesty() {
  if (!isParent()) return;
  const kid = ctActiveKid();
  const ch = ((await showPrompt('Which claim? chores / learning / competition', { value: 'chores' })) || '').trim().toLowerCase();
  if (!['chores', 'learning', 'competition'].includes(ch)) { showToast('Pick chores, learning or competition'); return; }
  const e = mrRecordHonesty(kid, ch);
  cpRenderChoreTab();
  if (!e) return;
  const msg = e.step === 1 ? 'Claim void. Recorded — talk about it Sunday.'
    : e.step === 2 ? `Claim void. ${ch} pays nothing this week.`
    : 'Claim void. Loses free-chore pick and loan-surplus choice — back next week.';
  showToast(`⚖️ Step ${e.step} this week — ${msg}`);
}

// Row icons so every routine/chore reads at a glance (1a/1b mock).
const CT_SESSION_ICONS = { Morning:'🌅', Afternoon:'☀️', Evening:'🌙' };
const CT_CHORE_ICONS = {
  'Mop':'🧽', 'Vacuum':'🧹', 'Dish Clean & Dishwasher':'🍽️', 'Laundry':'🧺',
  'Sorting Clothes':'👕', 'Extra Exercise':'🏃', 'Other':'✨',
};
function ctChoreIcon(name) { return CT_CHORE_ICONS[name] || '🧺'; }

// The ordered set of matrix rows for a kid: routines, then each chore group,
// then extras. Each row carries how to read/write its cell.
function ctMatrixRows(kid) {
  const rows = [];
  /* All three rows STAY. This is the parent's input surface for a whole week —
     the only door to recording a routine that happened on a day nobody planned
     it, which is a grown-up's assertion from memory and exactly what
     ctSetMandatoryAuto's provenance rule exists to protect. Dropping a row
     would remove the write. What was wrong is not the row, it is the
     EVALUATION: the cells and the total below now measure against the days
     that actually asked. The kid's week grid is a report and drops the row;
     this is a form and keeps it. */
  CT_SESSIONS.forEach(s => rows.push({ section:'Routines · tracked, no money', label:s, kind:'mandatory', key:s, icon:CT_SESSION_ICONS[s]||'📋' }));
  const groups = ctGroupsForKid(kid);
  const inGroups = new Set();
  groups.forEach(g => {
    const val = (Number(g.valueDollars)||0).toFixed(2);
    const cad = g.cadence === 'daily' ? 'day' : 'week';
    const section = `${g.icon||'🧺'} ${g.name} · $${val} / ${cad}`;
    (g.choreIds||[]).forEach(cn => { inGroups.add(cn); rows.push({ section, label:cn, kind:'optional', key:cn, icon:ctChoreIcon(cn) }); });
  });
  ctPickableChoreNames().filter(cn => !inGroups.has(cn)).forEach(cn =>
    rows.push({ section:'Extra · counts toward the goal', label:cn, kind:'optional', key:cn, icon:ctChoreIcon(cn) }));
  return rows;
}
/* `weekKey` defaults to the chore tab's week; Parent › History's read-only
   board for a week from before the chore pool names its own (R5 §5 C2, row 15). */
function ctMatrixCellChecked(kid, dayIdx, row, weekKey = ctWeekKey) {
  return row.kind === 'mandatory'
    ? ctGetMandatory(weekKey, dayIdx, row.key, kid)
    : ctGetOptional(weekKey, dayIdx, kid, row.key);
}

/* ── A week from before the chore pool, read-only (R5 §5 C2, row 15) ──
   The Chores screen drew such a week with its old board (retired, PR 2b).
   Parent › History shows the week through the same readers — ctGetWeekGoals, ctMatrixRows, ctMatrixCellChecked
   and ctWeekMoney — with no control at all: a week that was lived is a record,
   not a form, and clearing or exporting one is App › Backup and data's job. */
function ctPreSystemBoard(kid, weekKey) {
  ctEnsureShared();
  const c = state.shared.chore;
  const mon = formatDayKey(weekKey);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const goal = ctGetWeekGoals(weekKey)[kid];
  const money = Number(ctWeekMoney(weekKey, kid)) || 0;
  const paid = !!(c.finalizedWeeks && c.finalizedWeeks[weekKey] && c.finalizedWeeks[weekKey][kid] != null);
  let head = '<span class="pre-label"></span>';
  for (let d = 0; d < 7; d++) {
    const date = new Date(mon); date.setDate(mon.getDate() + d);
    head += `<span class="pre-dh">${DAY_SHORT[d]}<small>${date.getDate()}</small></span>`;
  }
  head += '<span class="pre-dh">wk</span>';
  let body = '', section = null;
  ctMatrixRows(kid).forEach(row => {
    if (row.section !== section) { body += `<div class="pre-section">${escapeHtml(row.section)}</div>`; section = row.section; }
    let n = 0, cells = '';
    for (let d = 0; d < 7; d++) {
      const on = ctMatrixCellChecked(kid, d, row, weekKey);
      if (on) n++;
      cells += `<span class="pre-cell${on ? ' on' : ''}">${on ? '✓' : '·'}</span>`;
    }
    body += `<div class="pre-row"><span class="pre-label">${row.icon || ''} ${escapeHtml(row.label)}</span>${cells}<span class="pre-total">${n}</span></div>`;
  });
  return `<div class="pn-card pre-board" data-kid="${kid === 'jenn' ? 'jenn' : 'jess'}">
    <div class="pre-title">${CT_PROFILE_ICON[kid] || ''} ${kid === 'jenn' ? 'Jenn' : 'Jess'} · ${MONTH_SHORT[mon.getMonth()]} ${mon.getDate()} – ${MONTH_SHORT[sun.getMonth()]} ${sun.getDate()}</div>
    <div class="pre-money">$${money.toFixed(2)} <span class="pre-meta">/ $${CT_MONEY_CAP} max · earned before the new money system</span></div>
    <div class="pre-meta">${paid ? '✅ Paid out at the family meeting' : 'Not paid out at a family meeting'}</div>
    ${goal ? `<div class="pre-meta">Goal: ${escapeHtml(ctGoalLabel(goal))}${ctGetGoalBonus(weekKey, kid) ? ' · met ⭐' : ''}</div>` : ''}
    <div class="pre-gridwrap"><div class="pre-grid">
      <div class="pre-dayhead">${head}</div>
      ${body}
    </div></div>
  </div>`;
}
// Full pocket-money history: every week ever recorded at a family meeting, drawn
// from finalizedWeeks (the authoritative "paid" ledger — unbounded, unlike the
// rolling 8-week summary), with per-kid running cumulative totals.

function ctApplyLegacyPayloadToState(parsed) {
  if (!parsed) return false;
  const { dataObj, optObj, goalsObj, bonusObj, startDate, updatedAt } = parsed;
  if (!dataObj || !optObj) return false;
  ctEnsureShared();
  ['jenn','jess'].forEach(kid=>{
    const p = getProfData(kid);
    ctEnsureProfile(p);
  });
  // Use startDate from legacy payload, or fall back to programStartDate
  const anchor = startDate || mrStartWeek();
  const anchorDate = formatDayKey(anchor);
  for (let w = 1; w <= 8; w++) {
    const weekMon = new Date(anchorDate); weekMon.setDate(anchorDate.getDate() + (w-1)*7);
    const wk = ctDateToKey(weekMon);
    for (let d = 0; d < 7; d++) {
      // Still CT_SESSIONS, deliberately: this replays an external legacy payload
      // that carries a value for all three sessions on every day. Writing only
      // the "planned" subset would drop data that was genuinely recorded, and
      // the blocks that would decide the subset do not exist for those weeks.
      for (const s of CT_SESSIONS) {
        const src = (((dataObj[String(w)]||{})[String(d)]||{})[s]||{});
        ctSetMandatory(wk, d, s, 'jenn', !!src.jenn);
        ctSetMandatory(wk, d, s, 'jess', !!src.jess);
      }
      for (const c of CT_CHORES) {
        const o = ((optObj[String(w)]||{})[String(d)]||{});
        ctSetOptional(wk, d, 'jenn', c, !!((o.jenn||{})[c]));
        ctSetOptional(wk, d, 'jess', c, !!((o.jess||{})[c]));
      }
    }
    const g = goalsObj?.[String(w)] || {};
    ctSetWeekGoals(wk, g.jenn || null, g.jess || null);
    const b = bonusObj?.[String(w)] || {};
    ctSetGoalBonus(wk, 'jenn', !!b.jenn);
    ctSetGoalBonus(wk, 'jess', !!b.jess);
  }
  state.shared.chore.migration = { done: true, migratedAt: Date.now(), sourceUpdatedAt: updatedAt || 0 };
  return true;
}
// One-time migration of any existing numbered-key data to date keys
function ctMigrateNumberedKeys() {
  ctEnsureShared();
  const c = state.shared.chore;
  if (c.dateKeyMigration?.done) return;
  const anchor = c.programStartDate;
  if (!anchor) { c.dateKeyMigration = { done: true }; return; }
  const anchorDate = formatDayKey(anchor);
  let didMigrate = false;
  ['jenn','jess'].forEach(kid=>{
    const p = getProfData(kid);
    ctEnsureProfile(p);
    const newMandatory = {}, newOptional = {};
    for (let w = 1; w <= 8; w++) {
      if (!p.chore.mandatoryByWeek[String(w)] && !p.chore.optionalByWeek[String(w)]) continue;
      const weekMon = new Date(anchorDate); weekMon.setDate(anchorDate.getDate() + (w-1)*7);
      const wk = ctDateToKey(weekMon);
      if (p.chore.mandatoryByWeek[String(w)]) { newMandatory[wk] = p.chore.mandatoryByWeek[String(w)]; delete p.chore.mandatoryByWeek[String(w)]; didMigrate = true; }
      if (p.chore.optionalByWeek[String(w)])  { newOptional[wk]  = p.chore.optionalByWeek[String(w)];  delete p.chore.optionalByWeek[String(w)];  didMigrate = true; }
    }
    Object.assign(p.chore.mandatoryByWeek, newMandatory);
    Object.assign(p.chore.optionalByWeek,  newOptional);
  });
  const newGoals = {}, newBonus = {};
  for (let w = 1; w <= 8; w++) {
    if (!c.goalsByWeek[String(w)] && !c.goalBonusByWeek[String(w)]) continue;
    const weekMon = new Date(anchorDate); weekMon.setDate(anchorDate.getDate() + (w-1)*7);
    const wk = ctDateToKey(weekMon);
    // safe-delete: legacy numeric week keys ('1'..'8') from before date keys.
    // Nothing reads them after the migration, and dateKeyMigration.done stops
    // it re-running, so a stale copy arriving from another device is inert.
    if (c.goalsByWeek[String(w)])    { newGoals[wk] = c.goalsByWeek[String(w)];    delete c.goalsByWeek[String(w)];    didMigrate = true; }
    // safe-delete: same legacy numeric keys as the line above
    if (c.goalBonusByWeek[String(w)]){ newBonus[wk] = c.goalBonusByWeek[String(w)]; delete c.goalBonusByWeek[String(w)]; didMigrate = true; }
  }
  Object.assign(c.goalsByWeek, newGoals);
  Object.assign(c.goalBonusByWeek, newBonus);
  c.dateKeyMigration = { done: true, migratedAt: Date.now() };
  if (didMigrate) saveAll();
}
// One-time migration to the priced chore-group model:
// (1) freeze every historical week's money at its OLD-formula value, and
// (2) seed one starter group so the new UI isn't empty.
function ctMigrateToGroups() {
  ctEnsureShared();
  const c = state.shared.chore;
  if (c.groupsMigration?.done) return;
  // Ensure legacy numbered-key weeks are date-keyed BEFORE we snapshot history — this can be
  // reached from the Quest Board (kids' default landing) before anything else runs it. Idempotent.
  ctMigrateNumberedKeys();
  const migrationWeek = ctThisWeekKey();

  // (1) Freeze history — every stored week strictly before the current week.
  const weeks = new Set([...Object.keys(c.goalsByWeek), ...Object.keys(c.goalBonusByWeek)]);
  ['jenn','jess'].forEach(kid=>{
    const p = getProfData(kid); ctEnsureProfile(p);
    Object.keys(p.chore.mandatoryByWeek).forEach(w=>weeks.add(w));
    Object.keys(p.chore.optionalByWeek).forEach(w=>weeks.add(w));
  });
  for (const wk of weeks) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(wk) || wk >= migrationWeek) continue;  // ISO compare valid for zero-padded dates
    ['jenn','jess'].forEach(kid=>{
      if (!ctWeekHasData(wk, kid)) return;
      // Old formula: min(cap, base 2 + bonusDays + goalBonus). `2` = retired CT_MONEY_BASE.
      const old = Math.min(CT_MONEY_CAP, 2 + ctBonusDaysLegacy(wk, kid) + (ctGetGoalBonus(wk, kid) ? 1 : 0));
      if (!c.moneySnapshots[wk]) c.moneySnapshots[wk] = {};
      c.moneySnapshots[wk][kid] = old;
  ctStampWeekState(wk);   // a reset can remove this; an add after one must stamp too
    });
  }

  // (2) Seed a starter group so parents have something to edit.
  if (!c.groups.length) {
    c.groups.push({ id:'grp-starter', name:'Clean Home Crew', icon:'🧹', kid:'both',
      choreIds:['Mop','Vacuum','Dish Clean & Dishwasher'], valueDollars:3, cadence:'weekly' });
  }
  c.groupsMigration = { done:true, migratedAt:Date.now(), migrationWeek };
  saveAll();
}
function ctTryMigrateLegacy() {
  ctEnsureShared();
  if (state.shared.chore.migration?.done) return;
  const payload = state.shared.chore.legacy?.payload;
  if (!payload) return;
  if (ctApplyLegacyPayloadToState(payload)) saveAll();
}
// Legacy standalone Chore-Tracker (chore-tracker/family-data) has been retired.
// Any previously-imported data remains in state.shared.chore; ctTryMigrateLegacy still
// applies a stored payload once, and ctMigrateNumberedKeys still runs on local data.
/* The silent self-heal the Chores screen's render ran (it is retired, PR 2b):
   fire a goal bonus or a group payout that remote-synced checks, or a group
   created/edited after its chores were ticked, have already satisfied. Today's
   render runs it now, for this week. Idempotent; saves only when a payout fires. */
function ctSelfHealWeek(weekKey) {
  ctMaybeFireGoalBonus(weekKey, 'jenn');
  ctMaybeFireGoalBonus(weekKey, 'jess');
  const swept = ctSweepGroupPayouts(weekKey, 'jenn').length + ctSweepGroupPayouts(weekKey, 'jess').length;
  if (swept) saveAll();
}

