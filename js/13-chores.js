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
let ctEditingGroupId = null;  // group id being edited in the money-group sheet, null = creating new

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
function ctEnsureShared() {
  if (!state.shared) state.shared = {};
  if (!state.shared.chore) state.shared.chore = {};
  const c = state.shared.chore;
  if (!c.programStartDate) c.programStartDate = ctDateToKey(ctMondayOf(new Date()));
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
function ctAddChore(name) {
  ctEnsureShared();
  const c = state.shared.chore;
  const trimmed = (name || '').trim();
  if (!trimmed) return false;
  // un-hide if it was hidden; add to custom if genuinely new
  c.hiddenChores = (c.hiddenChores || []).filter(n => n !== trimmed);
  const known = new Set([...CT_CHORES, ...(c.customChores || [])]);
  if (!known.has(trimmed)) c.customChores.push(trimmed);
  saveAll();
  return true;
}
function ctRemoveChore(name) {
  ctEnsureShared();
  const c = state.shared.chore;
  // Custom names are removed outright; base names are hidden (data keyed by
  // name in past weeks/groups stays intact).
  if ((c.customChores || []).includes(name)) {
    c.customChores = c.customChores.filter(n => n !== name);
  }
  if (CT_CHORES.includes(name) && !(c.hiddenChores || []).includes(name)) {
    c.hiddenChores.push(name);
  }
  saveAll();
}
function ctRenameChore(oldName, newName) {
  ctEnsureShared();
  const c = state.shared.chore;
  const nn = (newName || '').trim();
  if (!nn || nn === oldName) return;
  // Only custom chores can be renamed in place; base names are added-as-new.
  if ((c.customChores || []).includes(oldName)) {
    c.customChores = c.customChores.map(n => n === oldName ? nn : n);
    // repoint any group references
    (c.groups || []).forEach(g => { g.choreIds = (g.choreIds || []).map(id => id === oldName ? nn : id); });
  } else {
    ctAddChore(nn);
  }
  saveAll();
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
  p.chore.updatedAtByWeek[weekKey] = Date.now();
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
  const mon = formatDayKey(ctWeekKey || ctDateToKey(ctMondayOf(new Date())));
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
function ctGoalPoints(goal) {
  const g = ctNormalizeGoal(goal);
  return g && g.points != null ? g.points : null;
}
function ctGetWeekGoals(weekKey) {
  ctEnsureShared();
  const g = state.shared.chore.goalsByWeek[weekKey] || {};
  return { jenn: ctNormalizeGoal(g.jenn), jess: ctNormalizeGoal(g.jess) };
}
function ctSetWeekGoals(weekKey, jGoal, kGoal) {
  ctEnsureShared();
  state.shared.chore.goalsByWeek[weekKey] = { jenn: jGoal || null, jess: kGoal || null };
  state.shared.chore.goalsUpdatedAtByWeek[weekKey] = Date.now(); // stamp so a concurrent edit merges by recency
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
function ctGroupById(gid) { return ctGroups().find(g => g.id === gid) || null; }
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
function ctSetMandatoryAuto(weekKey, dayIdx, session, kid) {
  const p = getProfData(kid);
  ctEnsureProfile(p);
  if (!p.chore.mandatoryAutoByWeek[weekKey]) p.chore.mandatoryAutoByWeek[weekKey] = {};
  if (!p.chore.mandatoryAutoByWeek[weekKey][String(dayIdx)]) p.chore.mandatoryAutoByWeek[weekKey][String(dayIdx)] = {};
  p.chore.mandatoryAutoByWeek[weekKey][String(dayIdx)][session] = true;
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
function ctWeekHasData(weekKey, kid) {
  for (let d = 0; d < 7; d++) {
    if (CT_SESSIONS.some(s=>ctGetMandatory(weekKey, d, s, kid))) return true;
    if (ctAllChoreNames().some(c=>ctGetOptional(weekKey, d, kid, c))) return true;
  }
  return false;
}
// Uncapped sum of fired group payouts (dollar amount frozen at fire time).
function ctGroupEarned(weekKey, kid) {
  ctEnsureShared();
  const wk = state.shared.chore.groupPayoutsFired[weekKey] || {};
  let sum = 0;
  for (const gid of Object.keys(wk)) {
    const e = wk[gid][kid];
    if (!e) continue;
    if (e === true) { const g = ctGroupById(gid); sum += g ? (Number(g.valueDollars) || 0) : 0; }
    else sum += Number(e.total) || 0;
  }
  return sum;
}
/* The single computation every money surface reads. Weeks are resolved against
   the model that was live when they were earned:

   - Before mrModelStartWeek: the legacy formula (chore groups pay, $6 cap).
     Those weeks are history and must not move just because the family switched
     to graded chores.
   - From mrModelStartWeek on: the rulebook model — routines are unpaid, graded
     household chores are the paid channel, and there is no weekly total cap. */
function ctWeekMoney(weekKey, kid) {
  ctEnsureShared();
  const snap = state.shared.chore.moneySnapshots[weekKey];
  if (snap && snap[kid] != null) return snap[kid];   // historical week frozen at migration
  if (typeof mrUsesNewModel === 'function' && mrUsesNewModel(weekKey)) {
    return mrWeekMoney(weekKey, kid);
  }
  const goalBonus = ctGetGoalBonus(weekKey, kid) ? 1 : 0;
  return Math.min(CT_MONEY_CAP, ctGroupEarned(weekKey, kid) + goalBonus);
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
// Shared toast + celebration for freshly-fired group payouts.
function ctCelebrateGroupPayouts(fired, hostId) {
  if (!fired || !fired.length) return;
  const total = fired.reduce((s,g)=>s + (Number(g.valueDollars)||0), 0);
  const label = fired.length === 1 ? `${fired[0].icon || ''} ${fired[0].name}`.trim() : `${fired.length} groups`;
  // Under the rulebook model routines are tracked but pay nothing, so the
  // group value must not be announced as money — ctWeekMoney ignores it, and
  // promising a kid $2 she never receives is worse than saying nothing.
  showToast(mrUsesNewModel(ctWeekKey)
    ? `✅ ${label} complete!`
    : `💰 ${label} complete! +$${total.toFixed(2)}`);
  if (typeof spawnQuestSparkles === 'function') spawnQuestSparkles(hostId || 'screen-chore');
}
function ctSetCurrentWeekFromPlanner() {
  ctWeekKey = dateToLocalKey(getWeekStart(weekOffset));
}
function ctDayIndexForDate(dayKey) {
  const wk = ctWeekKey || ctDateToKey(ctMondayOf(new Date()));
  const mon = formatDayKey(wk);
  const day = formatDayKey(dayKey);
  return Math.round((day - mon) / (24*60*60*1000));
}
function ctWeekKeyForDate(dayKey) {
  return ctDateToKey(ctMondayOf(formatDayKey(dayKey)));
}
function ctToggleMandatory(session, kid) {
  const isAuto = ctGetMandatoryAuto(ctWeekKey, ctDay, session, kid);
  if (isAuto && !isParent()) return;
  const prev = ctGetMandatory(ctWeekKey, ctDay, session, kid);
  ctSetMandatory(ctWeekKey, ctDay, session, kid, !prev);
  ctMaybeFireGoalBonus(ctWeekKey, kid);
  saveAll();
  renderChoreTab();
}
function ctToggleOptional(choreName, kid) {
  const prev = ctGetOptional(ctWeekKey, ctDay, kid, choreName);
  ctSetOptional(ctWeekKey, ctDay, kid, choreName, !prev);
  const fired = !prev ? ctCheckGroupPayouts(ctWeekKey, ctDay, kid) : [];
  ctMaybeFireGoalBonus(ctWeekKey, kid);
  saveAll();
  renderChoreTab();
  ctCelebrateGroupPayouts(fired, 'screen-chore');
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
  delete state.shared.chore.groupPayoutsFired[ctWeekKey];  // explicit parent reset beats stickiness
  delete state.shared.chore.moneySnapshots[ctWeekKey];
  saveAll();
  renderChoreTab();
}
function ctWeekSummaryRows() {
  // Show last CT_SUMMARY_WEEKS weeks ending with current ctWeekKey
  let rows = '';
  const cur = formatDayKey(ctWeekKey || ctDateToKey(ctMondayOf(new Date())));
  for (let i = CT_SUMMARY_WEEKS - 1; i >= 0; i--) {
    const mon = new Date(cur); mon.setDate(cur.getDate() - i * 7);
    const wk = ctDateToKey(mon);
    const label = `${MONTH_SHORT[mon.getMonth()]} ${mon.getDate()}`;
    const jm = ctMandatoryPoints(wk, 'jenn');
    const jo = ctOptionalPoints(wk, 'jenn');
    const km = ctMandatoryPoints(wk, 'jess');
    const ko = ctOptionalPoints(wk, 'jess');
    const j$ = ctWeekMoney(wk, 'jenn');
    const k$ = ctWeekMoney(wk, 'jess');
    const isCurrent = wk === ctWeekKey;
    rows += `<tr${isCurrent?' style="font-weight:600"':''}><td>${label}</td><td>${jm}/21</td><td>+${jo}</td><td>$${j$.toFixed(2)}</td><td>${km}/21</td><td>+${ko}</td><td>$${k$.toFixed(2)}</td></tr>`;
  }
  return rows;
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
// Delegated click handler for the chore tab (#choreWrap). Names travel only via
// data-attributes, so no user text is ever interpolated into inline handlers.
/* Grade a household chore for the day being viewed, then re-render so the
   day/week totals and the free-chore counter update together. */
function ctGradeChore(choreId, grade) {
  const kid = isParent() ? ctParentKid : activeProfile();
  if (mrSetChoreGrade(kid, ctWeekKey, ctDay, choreId, grade)) renderChoreTab();
}
function ctCyclePersonalChore(choreId) {
  const kid = isParent() ? ctParentKid : activeProfile();
  const next = mrCyclePersonal(kid, ctWeekKey, ctDay, choreId);
  renderChoreTab();
  if (next === 'unasked') showToast('⭐ Done without being asked — that earns XP');
}
function ctHandleWrapClick(e) {
  const el = e.target.closest('[data-ct-action]');
  if (!el || el.disabled) return;
  const a = el.dataset.ctAction;
  if (a === 'toggle-mandatory') ctToggleMandatory(el.dataset.session, el.dataset.kid);
  else if (a === 'toggle-optional') ctToggleOptional(el.dataset.chore, el.dataset.kid);
  else if (a === 'matrix-mandatory') ctMatrixToggleMandatory(+el.dataset.day, el.dataset.session, el.dataset.kid);
  else if (a === 'matrix-optional') ctMatrixToggleOptional(+el.dataset.day, el.dataset.chore, el.dataset.kid);
  else if (a === 'edit-group') ctOpenGroupEditor(el.dataset.groupId);
  else if (a === 'delete-group') ctDeleteGroup(el.dataset.groupId);
  else if (a === 'new-group') ctOpenGroupEditor(null);
  else if (a === 'add-chore') ctPromptAddChore();
  else if (a === 'rename-chore') ctPromptRenameChore(el.dataset.chore);
  else if (a === 'remove-chore') ctPromptRemoveChore(el.dataset.chore);
  else if (a === 'grade-chore') ctGradeChore(el.dataset.choreId, +el.dataset.grade);
  else if (a === 'cycle-personal') ctCyclePersonalChore(el.dataset.choreId);
  else if (a === 'learn-plus') ctBumpLearning(el.dataset.itemId, +1);
  else if (a === 'learn-minus') ctBumpLearning(el.dataset.itemId, -1);
  else if (a === 'sunday-check') ctRunSundayCheck();
  else if (a === 'toggle-sick') ctToggleSickDay(+el.dataset.day);
  else if (a === 'add-comp') ctPromptCompetition();
  else if (a === 'del-comp') ctRemoveCompetition(el.dataset.compId);
  else if (a === 'box-item') ctPromptBoxItem();
  else if (a === 'release-box') ctReleaseBox(el.dataset.boxId);
  else if (a === 'add-fine') ctPromptFine();
  else if (a === 'del-fine') ctRemoveFineById(el.dataset.fineId);
  else if (a === 'honesty') ctPromptHonesty();
  // ── kid tab (js/26-chore-kid.js) ──
  else if (a === 'ck-view') ckSetView(el.dataset.view);
  else if (a === 'ck-day') ckSelectDay(+el.dataset.day);
  else if (a === 'ck-week') ctChangeWeek(+el.dataset.delta);
  else if (a === 'ck-history') ckToggleHistory();
  else if (a === 'ck-history-pick') ckPickWeek(el.dataset.week);
  else if (a === 'ck-chore-row') ckTapChoreRow(el.dataset.choreId);
  else if (a === 'ck-claim') ckClaim(el.dataset.choreId, +el.dataset.quality);
  else if (a === 'ck-week-cell') ckCycleWeekClaim(el.dataset.choreId, +el.dataset.day);
  else if (a === 'ck-routine-item') ckToggleRoutineItem(el.dataset.blockId, el.dataset.itemId);
  else if (a === 'ck-routine-all') ckCloseRoutine(el.dataset.blockId);
  else if (a === 'ck-attitude') ckRateSelf(+el.dataset.day, +el.dataset.n);
}

function ctActiveKid() { return isParent() ? ctParentKid : activeProfile(); }

function ctBumpLearning(itemId, delta) {
  if (!isParent()) { showToast('Mom logs the learning 🔒'); return; }
  const kid = ctActiveKid();
  const cur = mrGetLearning(kid, ctWeekKey, ctDay, itemId);
  mrSetLearning(kid, ctWeekKey, ctDay, itemId, Math.max(0, cur + delta));
  renderChoreTab();
}
function ctToggleSickDay(dayIdx) {
  mrToggleSick(ctActiveKid(), ctWeekKey, dayIdx);
  renderChoreTab();
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
  renderChoreTab();
  showToast(voided ? `🔍 ${voided} voided — unpaid and to do again` : '🔍 All checked — all paid');
}

async function ctPromptCompetition() {
  if (!isParent()) return;
  const kid = ctActiveKid();
  const sport = ((await showPrompt('Which sport? swim / skate / dance', { value: 'swim' })) || '').trim().toLowerCase();
  if (!['swim', 'skate', 'dance'].includes(sport)) { showToast('Pick swim, skate or dance'); return; }

  // Name and date first. The award is frozen against the rules live on the
  // date, so a meet entered late has to carry the day it actually happened —
  // defaulting to whichever day the tab was showing would price it wrong.
  const name = ((await showPrompt('Which meet or competition?\n(e.g. "Winter Invitational")', { value: '' })) || '').trim();
  if (!name) { showToast('Give it a name so it can be checked later'); return; }
  const dayKey = ((await showPrompt('What date was it?', { value: ctWeekInfo().keys[ctDay], type: 'date' })) || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) { showToast('Pick a date'); return; }

  const entry = { sport, name, dayKey };
  if (sport === 'dance') {
    entry.danceItems = {
      silver: parseInt(await showPrompt('How many Silver items?', { value: '0', type: 'number' }), 10) || 0,
      gold:   parseInt(await showPrompt('How many Gold items?',   { value: '0', type: 'number' }), 10) || 0,
    };
    entry.danceItems.allGold = await showConfirm('All Gold?', { okLabel: 'Yes' });
  } else {
    entry.points = parseInt(await showPrompt('Points scored?', { value: '0', type: 'number' }), 10) || 0;
    if (sport === 'swim') {
      entry.qualified = await showConfirm('Qualified for Provincials?', { okLabel: 'Yes' });
      entry.provincial = await showConfirm('Was this meet Provincials?', { okLabel: 'Yes' });
    } else {
      entry.placement = {
        group:   parseInt(await showPrompt('Placement in her group (1/2/3, 0 for none)', { value: '0', type: 'number' }), 10) || 0,
        overall: parseInt(await showPrompt('Placement overall (1/2/3, 0 for none)', { value: '0', type: 'number' }), 10) || 0,
      };
    }
  }
  entry.personalBest = await showConfirm('Was it a personal best?', { okLabel: 'Yes' });
  const saved = mrAddCompetition(kid, entry);
  renderChoreTab();
  if (!saved) return;
  // A result pays in the week it happened, so one dated outside the week on
  // screen correctly won't appear on this card. Say so rather than letting it
  // look like the entry vanished.
  const inThisWeek = ctWeekInfo().keys.includes(dayKey);
  showToast(inThisWeek
    ? `🏆 ${name} recorded — $${Number(saved.awarded).toFixed(2)}`
    : `🏆 ${name} recorded — $${Number(saved.awarded).toFixed(2)} · counts in the week of ${dayKey}`);
}
function ctRemoveCompetition(id) { mrDeleteCompetition(ctActiveKid(), id); renderChoreTab(); }

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
  renderChoreTab();
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
  if (!cfg.redemptionJob) { mrReleaseBoxItem(kid, id); renderChoreTab(); return; }

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
  renderChoreTab();
  showToast(`📦 Released early — ${job}`);
}

async function ctPromptFine() {
  if (!isParent()) return;
  const r = mrRulesForWeek(ctWeekKey);
  const items = (r.fines || {}).items || [];
  const list = items.map((f, i) => `${i + 1}. ${f.label}`).join('\n');
  const pick = await showPrompt(`Which one?\n${list}`, { value: '1', type: 'number' });
  if (pick == null) return;
  const item = items[(parseInt(pick, 10) || 1) - 1];
  if (!item) return;
  mrAddFine(ctActiveKid(), item.id, ctWeekInfo().keys[ctDay]);
  renderChoreTab();
  showToast(`−$${Number(item.amount).toFixed(2)} · ${item.label}`);
}
function ctRemoveFineById(id) { mrRemoveFine(ctActiveKid(), id); renderChoreTab(); }

async function ctPromptHonesty() {
  if (!isParent()) return;
  const kid = ctActiveKid();
  const ch = ((await showPrompt('Which claim? chores / learning / competition', { value: 'chores' })) || '').trim().toLowerCase();
  if (!['chores', 'learning', 'competition'].includes(ch)) { showToast('Pick chores, learning or competition'); return; }
  const e = mrRecordHonesty(kid, ch);
  renderChoreTab();
  if (!e) return;
  const msg = e.step === 1 ? 'Claim void. Recorded — talk about it Sunday.'
    : e.step === 2 ? `Claim void. ${ch} pays nothing this week.`
    : 'Claim void. Loses free-chore pick and loan-surplus choice — back next week.';
  showToast(`⚖️ Step ${e.step} this week — ${msg}`);
}
async function ctPromptAddChore() {
  const name = ((await showPrompt('New chore name:', { value:'' })) || '').trim();
  if (!name) return;
  if (ctAddChore(name)) { showToast(`Added "${name}" 🧽`); renderChoreTab(); }
}
async function ctPromptRenameChore(oldName) {
  const nn = ((await showPrompt('Rename chore:', { value:oldName })) || '').trim();
  if (!nn || nn === oldName) return;
  const isCustom = (state.shared.chore.customChores || []).includes(oldName);
  ctRenameChore(oldName, nn);
  showToast(isCustom ? `Renamed to "${nn}"` : `Added "${nn}" (base chores keep their name)`);
  renderChoreTab();
}
async function ctPromptRemoveChore(name) {
  const isCustom = (state.shared.chore.customChores || []).includes(name);
  if (!(await showConfirm(isCustom ? `Remove "${name}"?` : `Hide "${name}" from the pickable list? (Past weeks keep their data.)`, { danger:true, okLabel:isCustom?'Remove':'Hide' }))) return;
  ctRemoveChore(name);
  showToast(isCustom ? `Removed "${name}"` : `Hid "${name}"`);
  renderChoreTab();
}
// Parent-only manager to add / rename / hide the base chore names.
function ctRenderChoreNamesCard() {
  if (!isParent()) return '';
  const rows = ctPickableChoreNames().map(cn => {
    const isCustom = (state.shared.chore.customChores || []).includes(cn);
    return `<div class="ct-item">
      <div class="ct-item-left"><span>🧽 ${escapeHtml(cn)}</span>${isCustom ? '<span class="ct-badge">custom</span>' : ''}</div>
      <span style="display:flex;gap:0.3rem">
        <button type="button" class="btn-icon" data-ct-action="rename-chore" data-chore="${escapeAttr(cn)}" aria-label="Rename ${escapeAttr(cn)}">✏️</button>
        <button type="button" class="btn-icon" data-ct-action="remove-chore" data-chore="${escapeAttr(cn)}" aria-label="Remove ${escapeAttr(cn)}">🗑</button>
      </span>
    </div>`;
  }).join('');
  return `<div class="chore-card"><h3>🧽 Chore names</h3>
    <div class="ct-meta">The chores kids can tag on a House-Chore block and check off. Base chores hide (data kept); custom chores rename/remove.</div>
    ${rows}
    <div style="margin-top:0.5rem"><button type="button" class="pill-btn" data-ct-action="add-chore">+ New chore</button></div>
  </div>`;
}
// One optional-chore check row (keyboard-accessible button, role=checkbox).
function ctOptCheckRow(kid, choreName, extra = '', badge = '') {
  const checked = ctGetOptional(ctWeekKey, ctDay, kid, choreName);
  return `<div class="ct-item ${checked ? 'done' : ''}">
    <div class="ct-item-left">
      <button type="button" class="ct-check ${checked ? 'on' : ''}" data-ct-action="toggle-optional" data-chore="${escapeAttr(choreName)}" data-kid="${kid}" role="checkbox" aria-checked="${checked}" aria-label="${escapeAttr(choreName)}">${checked ? '✓' : ''}</button>
      <span>${escapeHtml(choreName)}</span>${extra}
    </div>${badge}
  </div>`;
}
/* ════════════════════════════════════════════════════════════════
   1a — KID WEEK MATRIX: one tap-to-toggle grid for the whole week
════════════════════════════════════════════════════════════════ */
// Toggle a matrix cell on an explicit day (the per-day handlers above use the
// selected ctDay; the matrix needs any day).
function ctMatrixToggleMandatory(dayIdx, session, kid) {
  if (ctGetMandatoryAuto(ctWeekKey, dayIdx, session, kid) && !isParent()) return;
  const prev = ctGetMandatory(ctWeekKey, dayIdx, session, kid);
  ctSetMandatory(ctWeekKey, dayIdx, session, kid, !prev);
  ctMaybeFireGoalBonus(ctWeekKey, kid);
  saveAll();
  renderChoreTab();
}
function ctMatrixToggleOptional(dayIdx, choreName, kid) {
  const prev = ctGetOptional(ctWeekKey, dayIdx, kid, choreName);
  ctSetOptional(ctWeekKey, dayIdx, kid, choreName, !prev);
  const fired = !prev ? ctCheckGroupPayouts(ctWeekKey, dayIdx, kid) : [];
  ctMaybeFireGoalBonus(ctWeekKey, kid);
  saveAll();
  renderChoreTab();
  ctCelebrateGroupPayouts(fired, 'screen-chore');
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
function ctMatrixCellChecked(kid, dayIdx, row) {
  return row.kind === 'mandatory'
    ? ctGetMandatory(ctWeekKey, dayIdx, row.key, kid)
    : ctGetOptional(ctWeekKey, dayIdx, kid, row.key);
}
function ctMatrixCellAuto(kid, dayIdx, row) {
  return row.kind === 'mandatory' && ctGetMandatoryAuto(ctWeekKey, dayIdx, row.key, kid);
}

function ctRenderWeekMatrix(kid) {
  const rows = ctMatrixRows(kid);
  const info = ctWeekInfo();
  const todayD = formatDayKey(todayKey());
  // Day status per column: 'past' | 'today' | 'future'
  const dayStatus = [];
  let todayCol = -1;
  for (let d = 0; d < 7; d++) {
    const date = new Date(info.mon); date.setDate(info.mon.getDate() + d);
    const cmp = Math.round((date - todayD) / (24*60*60*1000));
    if (cmp < 0) dayStatus.push('past');
    else if (cmp === 0) { dayStatus.push('today'); todayCol = d; }
    else dayStatus.push('future');
  }

  const icon = CT_PROFILE_ICON[kid];
  const name = kid === 'jenn' ? 'Jenn' : 'Jess';

  // Kid pills (parent may switch which kid they're viewing; a kid sees their own).
  const pill = (k) => {
    const active = k === kid;
    const canSwitch = isParent();
    const attrs = canSwitch ? `onclick="ctParentKid='${k}';renderChoreTab()"` : (active ? '' : 'disabled');
    return `<button type="button" class="cm-pill ${active?'active':''}" ${attrs}>${CT_PROFILE_ICON[k]} ${k==='jenn'?'Jenn':'Jess'}</button>`;
  };

  // Money status chip from the primary chore group.
  const groups = ctGroupsForKid(kid).filter(g => g.cadence !== 'daily');
  let chip = '';
  if (groups.length) {
    const g = groups[0];
    const ids = g.choreIds || []; const m = ids.length;
    const n = ids.filter(cn => [0,1,2,3,4,5,6].some(d => ctGetOptional(ctWeekKey, d, kid, cn))).length;
    const fired = ctGroupFiredWeekly(ctWeekKey, g.id, kid);
    const val = (Number(g.valueDollars)||0).toFixed(2);
    chip = fired ? `$${val} earned · confirm at meeting` : `${n}/${m} chores → $${val} when all done`;
  } else {
    chip = 'No chore groups yet';
  }

  // Header row.
  let cells = '';
  cells += `<div class="cm-corner"></div>`;
  for (let d = 0; d < 7; d++) {
    const date = new Date(info.mon); date.setDate(info.mon.getDate() + d);
    cells += `<div class="cm-dayhead ${dayStatus[d]==='today'?'cm-today':''}">${DAY_SHORT[d]}<small>${date.getDate()}</small></div>`;
  }
  cells += `<div class="cm-wkhead">wk</div>`;

  // Section + data rows.
  let lastSection = null;
  rows.forEach(row => {
    if (row.section !== lastSection) {
      cells += `<div class="cm-section">${escapeHtml(row.section)}</div>`;
      lastSection = row.section;
    }
    cells += `<div class="cm-rowlabel" title="${escapeAttr(row.label)}"><span class="cm-rowicon">${row.icon||''}</span>${escapeHtml(row.label)}</div>`;
    let weekN = 0;
    for (let d = 0; d < 7; d++) {
      const on = ctMatrixCellChecked(kid, d, row);
      if (on) weekN++;
      const auto = ctMatrixCellAuto(kid, d, row);
      // Read-only for kids: they can view here but tick completion in their Day /
      // Week view (which syncs back). Only parents toggle cells directly.
      const readOnly = !isParent();
      const disabled = readOnly || (auto && !isParent());
      const st = dayStatus[d];
      const glyph = on ? '✓' : (st === 'future' ? '' : '·');
      const dataAttrs = row.kind === 'mandatory'
        ? `data-ct-action="matrix-mandatory" data-session="${escapeAttr(row.key)}"`
        : `data-ct-action="matrix-optional" data-chore="${escapeAttr(row.key)}"`;
      cells += `<button type="button" class="cm-cell ${on?'on':''} cm-${st}${readOnly?' cm-readonly':(disabled?' cm-disabled':'')}"`
        + ` role="checkbox" aria-checked="${on}" aria-label="${escapeAttr(row.label)} ${DAY_SHORT[d]}"`
        + ` ${dataAttrs} data-day="${d}" data-kid="${kid}"${disabled ? ' disabled' : ''}>${glyph}</button>`;
    }
    cells += `<div class="cm-rowtotal">${weekN}/7</div>`;
  });

  // Bottom row: per-day mini progress bars (% of that day's items done).
  const totalRows = rows.length || 1;
  cells += `<div class="cm-rowlabel cm-progress-label">Progress</div>`;
  for (let d = 0; d < 7; d++) {
    if (dayStatus[d] === 'future') { cells += `<div class="cm-bar cm-bar-future">–</div>`; continue; }
    const done = rows.reduce((s,row)=> s + (ctMatrixCellChecked(kid, d, row) ? 1 : 0), 0);
    const pct = Math.round(done / totalRows * 100);
    cells += `<div class="cm-bar"><div class="cm-bar-fill" style="height:${pct}%"></div><span class="cm-bar-pct">${pct}%</span></div>`;
  }
  cells += `<div class="cm-corner"></div>`;

  // Footer: summary + 8-week sparkline of weekly money.
  const mandatory = ctMandatoryPoints(ctWeekKey, kid);
  const allGroupChores = [];
  ctGroupsForKid(kid).forEach(g => (g.choreIds||[]).forEach(cn => allGroupChores.push(cn)));
  const choresDone = allGroupChores.filter(cn => [0,1,2,3,4,5,6].some(d => ctGetOptional(ctWeekKey, d, kid, cn))).length;

  const mon0 = ctMondayOf(formatDayKey(ctWeekKey));
  let spark = '';
  for (let i = 7; i >= 0; i--) {
    const d = new Date(mon0); d.setDate(d.getDate() - i*7);
    const wkKey = ctDateToKey(d);
    const money = ctWeekMoney(wkKey, kid);
    const h = Math.max(6, Math.round(money / CT_MONEY_CAP * 100));
    spark += `<span class="cm-spark-bar ${i===0?'cm-spark-now':''}" style="height:${h}%" title="Week of ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}: $${money.toFixed(2)}"></span>`;
  }

  return `<div class="chore-card cm-card">
    <div class="cm-head">
      <div class="cm-pills">${pill('jenn')}${pill('jess')}</div>
      <span class="cm-money-chip">${chip}</span>
    </div>
    <div class="cm-grid">${cells}</div>
    <div class="cm-footer">
      <span class="cm-footer-summary">${icon} ${name} this week: ${mandatory}/21 routines · ${choresDone}/${allGroupChores.length||0} chores</span>
      <span class="cm-spark" aria-label="Last 8 weeks of pocket money">${spark}</span>
    </div>
  </div>`;
}

function ctRenderKidSection(kid) {
  const icon = CT_PROFILE_ICON[kid];
  const name = kid === 'jenn' ? 'Jenn' : 'Jess';
  const mandatory = ctMandatoryPoints(ctWeekKey, kid);
  const optional = ctOptionalPoints(ctWeekKey, kid);
  const total = mandatory + optional;
  const goal = ctGetWeekGoals(ctWeekKey)[kid];
  const goalReached = ctGetGoalBonus(ctWeekKey, kid);

  let html = `<div class="chore-card"><h3>${icon} ${name} — routines</h3><div class="ct-meta">Mandatory: ${mandatory}/21 · Points: ${total}</div>`;
  if (goal) {
    const pts = ctGoalPoints(goal);
    html += `<div class="ct-meta">Goal ${pts != null ? `${total}/${pts}` : ctGoalLabel(goal)}${goalReached ? ' · reached +$1' : ''}</div>`;
  }

  for (const s of CT_SESSIONS) {
    const checked = ctGetMandatory(ctWeekKey, ctDay, s, kid);
    const isAuto = ctGetMandatoryAuto(ctWeekKey, ctDay, s, kid);
    const canToggle = isParent() || !isAuto;
    html += `<div class="ct-item ${checked ? 'done' : ''}">
      <div class="ct-item-left"><button type="button" class="ct-check ${checked ? 'on' : ''}" data-ct-action="toggle-mandatory" data-session="${s}" data-kid="${kid}" role="checkbox" aria-checked="${checked}" aria-label="${s} routine" ${!canToggle ? 'disabled' : ''}>${checked ? '✓' : ''}</button><span>${s}</span></div>
      <span class="ct-badge">${isAuto ? '✨ auto' : 'mandatory'}</span>
    </div>`;
  }
  html += `<div class="ct-meta" style="margin-top:0.3rem">Routines are tracked but pay no money.</div></div>`;
  return html;
}
/* ── Household chores: the paid channel ──
   One row per chore in the pool, each showing its own deadline (there is no
   single household "on time"), with a 0/1/2/3 grade selector for the day being
   viewed. Kids see their grades; only a parent can set one. */
function ctRenderHouseholdChores(kid) {
  const r = mrRulesForWeek(ctWeekKey);
  const pool = r.chorePool || [];
  if (!pool.length) return '';
  const pay = (r.chores || {}).grade || {};
  const wk = mrChoreWeek(ctWeekKey, kid);
  const day = wk.days[ctDay] || { paid: 0 };
  const freeIds = new Set(wk.freeUsed.filter(f => f.dayIdx === ctDay).map(f => f.choreId));

  const GRADES = [
    { g: 3, label: 'On time & to standard' },
    { g: 2, label: 'To standard, late' },
    { g: 1, label: 'Redone, then to standard' },
    { g: 0, label: 'Not done' },
  ];
  const rows = pool.map(c => {
    const g = mrGetChoreGrade(kid, ctWeekKey, ctDay, c.id);
    const isFree = freeIds.has(c.id);
    const amount = isFree ? 'free' : (g > 0 ? '$' + Number(pay[g] || 0).toFixed(2) : '—');
    const pills = isParent()
      ? GRADES.map(x => `<button type="button" class="ct-check ${g === x.g ? 'on' : ''}"
            data-ct-action="grade-chore" data-chore-id="${escapeAttr(c.id)}" data-grade="${x.g}"
            title="${escapeAttr(x.label)}" aria-label="${escapeAttr(c.label + ': ' + x.label)}">${x.g}</button>`).join('')
      : `<span class="ct-badge">${g > 0 ? g + '/3' : 'not yet'}</span>`;
    return `<div class="ct-item ${g > 0 ? 'done' : ''}">
      <div class="ct-item-left"><span>${escapeHtml(c.label)}<br><span class="ct-meta">due ${escapeHtml(c.deadline || '—')}</span></span></div>
      <span class="ct-meta">${amount}</span>
      <span style="display:flex;gap:0.25rem">${pills}</span>
    </div>`;
  }).join('');

  const cap = (r.chores || {}).dailyCap;
  // Which chores are free is settled at the end of the week, not as you go —
  // they land on the lowest-paying ones so doing your best work first is never
  // punished. Step 3 flips that, and says so.
  const freeNote = wk.pickWithdrawn
    ? ` <b>Choices withdrawn this week</b> — they land on your highest-paying chores instead.`
    : ` They land on your <b>lowest-paying</b> chores, so your best work is the work that pays.`;
  const freeLine = wk.freeLeft > 0
    ? `<div class="ct-meta">${wk.freeLeft} free chore${wk.freeLeft === 1 ? '' : 's'} left this week — those belong to the family.${freeNote}</div>`
    : `<div class="ct-meta">Your ${(r.chores || {}).freeChoresPerWeek} free chores are used up — everything else this week pays.${freeNote}</div>`;
  const overflow = wk.overflowChores > 0
    ? `<div class="ct-meta">⭐ ${wk.overflowChores} chore${wk.overflowChores === 1 ? '' : 's'} past the daily max — those earn XP instead of money.</div>` : '';

  return `<div class="chore-card chore-card--full"><h3>🧹 Household chores — ${CT_DAYS[ctDay]}</h3>
    <div class="ct-meta">Paid. "On time" is different for every chore — check the chore, not the clock.</div>
    ${rows}
    <div class="ct-meta" style="margin-top:0.4rem">${CT_DAYS[ctDay]}: <b>$${Number(day.paid).toFixed(2)}</b>${cap != null ? ` / $${Number(cap).toFixed(2)} max` : ''} · week so far <b>$${wk.paid.toFixed(2)}</b></div>
    ${freeLine}${overflow}</div>`;
}

/* ── Personal chores: mandatory, never paid ──
   Tap cycles none → done → done unasked. Only "unasked" earns XP. */
function ctRenderPersonalChores(kid) {
  const r = mrRulesForWeek(ctWeekKey);
  const list = r.personalChores || [];
  if (!list.length) return '';
  const rows = list.map(c => {
    const st = mrGetPersonal(kid, ctWeekKey, ctDay, c.id);
    const mark = st === 'unasked' ? '⭐' : (st === 'done' ? '✓' : '');
    return `<div class="ct-item ${st ? 'done' : ''}">
      <div class="ct-item-left"><button type="button" class="ct-check ${st ? 'on' : ''}"
          data-ct-action="cycle-personal" data-chore-id="${escapeAttr(c.id)}"
          aria-label="${escapeAttr(c.label)}">${mark}</button><span>${escapeHtml(c.label)}</span></div>
      <span class="ct-badge">${st === 'unasked' ? 'unasked ⭐ XP' : (st === 'done' ? 'done' : 'yours')}</span>
    </div>`;
  }).join('');
  const unasked = mrPersonalUnaskedCount(ctWeekKey, kid);
  return `<div class="chore-card"><h3>🪥 Personal chores — ${CT_DAYS[ctDay]}</h3>
    <div class="ct-meta">These are yours. They are never paid. Tap once for done, twice if you did it without being asked.</div>
    ${rows}
    <div class="ct-meta" style="margin-top:0.3rem">${unasked} done unasked this week — that's XP.</div></div>`;
}

/* ── Learning: bundle-rated, with the Sunday check ── */
function ctRenderLearningCard(kid) {
  const r = mrRulesForWeek(ctWeekKey);
  const items = (r.learning || {}).items || [];
  if (!items.length) return '';
  const wk = mrLearningWeek(ctWeekKey, kid);
  const rows = items.map(it => {
    const units = mrGetLearning(kid, ctWeekKey, ctDay, it.id);
    const voided = mrGetLearningVoid(kid, ctWeekKey, ctDay, it.id);
    const line = wk.lines.find(l => l.id === it.id) || {};
    const worth = it.xpOnly ? 'XP only' : `$${Number(it.amount).toFixed(2)} / ${it.perUnit} ${it.unit}`;
    const controls = isParent()
      ? `<button type="button" class="btn-icon" data-ct-action="learn-minus" data-item-id="${escapeAttr(it.id)}" aria-label="Less ${escapeAttr(it.label)}">−</button>
         <button type="button" class="btn-icon" data-ct-action="learn-plus" data-item-id="${escapeAttr(it.id)}" aria-label="More ${escapeAttr(it.label)}">＋</button>`
      : '';
    return `<div class="ct-item ${units > 0 ? 'done' : ''}">
      <div class="ct-item-left"><span>${escapeHtml(it.label)}<br><span class="ct-meta">${worth}</span></span></div>
      <span class="ct-meta">${units} ${escapeHtml(it.unit)}${voided ? ` · ${voided} voided` : ''}${line.amount ? ` · $${Number(line.amount).toFixed(2)} wk` : ''}</span>
      <span style="display:flex;gap:0.25rem">${controls}</span></div>`;
  }).join('');
  return `<div class="chore-card"><h3>📘 Learning — ${CT_DAYS[ctDay]}</h3>
    <div class="ct-meta">Paid per finished bundle, and it has to be new material. Week so far: <b>$${wk.paid.toFixed(2)}</b></div>
    ${rows}
    ${isParent() ? `<div style="margin-top:0.5rem"><button type="button" class="pill-btn" data-ct-action="sunday-check">🔍 Sunday check (${(r.learning||{}).sundayCheckCount})</button></div>` : ''}
    <div class="ct-meta">Every Sunday ${(r.learning || {}).sundayCheckCount} get picked at random — can't answer, it's unpaid and you do it again.</div></div>`;
}

/* ── Streak, sick days ── */
function ctRenderStreakCard(kid) {
  const st = mrStreakWeek(ctWeekKey, kid);
  const r = mrRulesForWeek(ctWeekKey);
  const tiers = ((r.streak || {}).tiers || []).map(t =>
    `<span class="ct-badge">${t.days}d +$${Number(t.bonus).toFixed(0)}</span>`).join(' ');
  const dots = CT_DAYS.map((d, i) => {
    const sick = mrIsSick(kid, ctWeekKey, i);
    const done = mrStreakDayDone(ctWeekKey, kid, i);
    const mark = sick ? '🤒' : (done ? '✓' : '·');
    return `<button type="button" class="ct-check ${done && !sick ? 'on' : ''}"
      data-ct-action="toggle-sick" data-day="${i}" title="${d}${sick ? ' — sick' : ''}"
      aria-label="${d}${sick ? ' sick day' : ''}">${mark}</button>`;
  }).join('');
  return `<div class="chore-card"><h3>🔥 Routine streak</h3>
    <div class="ct-meta">Highest tier only — they don't add up. ${tiers}</div>
    <div style="display:flex;gap:0.3rem;margin:0.4rem 0">${dots}</div>
    <div class="ct-meta">Best run this week: <b>${st.days} day${st.days === 1 ? '' : 's'}</b>${st.bonus ? ` → +$${st.bonus.toFixed(2)}` : ' — no bonus yet'}</div>
    ${isParent() ? `<div class="ct-meta">Tap a day to mark it sick — sick days pause the streak instead of breaking it.</div>` : ''}</div>`;
}

/* ── Competition results ── */
function ctRenderCompetitionCard(kid) {
  const cw = mrCompetitionWeek(ctWeekKey, kid);
  const rows = cw.entries.length ? cw.entries.map(c => {
    const bits = [];
    if (c.points) bits.push(`${c.points} pts`);
    if ((c.placement || {}).group) bits.push(`${c.placement.group} in group`);
    if ((c.placement || {}).overall) bits.push(`${c.placement.overall} overall`);
    if (c.qualified) bits.push('qualified');
    if (c.personalBest) bits.push('PB ⭐');
    const d = formatDayKey(c.dayKey);
    const when = `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
    const title = c.name ? escapeHtml(c.name) : escapeHtml(c.sport);
    return `<div class="ct-item"><div class="ct-item-left"><span>${title}<br><span class="ct-meta">${escapeHtml(c.sport)} · ${when} · ${escapeHtml(bits.join(' · ') || '—')}</span></span></div>
      <span class="ct-meta">$${Number(c.awarded || 0).toFixed(2)}</span>
      ${isParent() ? `<button type="button" class="btn-icon" data-ct-action="del-comp" data-comp-id="${escapeAttr(c.id)}" aria-label="Remove result">🗑</button>` : ''}</div>`;
  }).join('') : `<div class="ct-meta">No results this week.</div>`;
  return `<div class="chore-card"><h3>🏆 Competition</h3>
    <div class="ct-meta">The official results sheet decides. No cap on points. Week: <b>$${cw.paid.toFixed(2)}</b></div>
    ${rows}
    ${isParent() ? `<div style="margin-top:0.5rem"><button type="button" class="pill-btn" data-ct-action="add-comp">+ Record a result</button></div>` : ''}</div>`;
}

/* ── Sunday Box & fines ── */
function ctRenderBoxFinesCard(kid) {
  const r = mrRulesForWeek(ctWeekKey);
  const chores = mrChoreWeek(ctWeekKey, kid);
  const fw = mrFinesWeek(ctWeekKey, kid, chores.days.map(d => d.paid));
  const boxed = mrBoxItems(kid).filter(b => !b.releasedAt);
  const boxRows = boxed.length ? boxed.map(b =>
    `<div class="ct-item"><div class="ct-item-left"><span>📦 ${escapeHtml(b.label)}${b.repeat ? ' <span class="ct-badge">repeat −$1</span>' : ''}<br><span class="ct-meta">back Sunday, or sooner for one unpaid job</span></span></div>
      ${isParent() ? `<button type="button" class="pill-btn" data-ct-action="release-box" data-box-id="${escapeAttr(b.id)}">Release early</button>` : ''}</div>`
  ).join('') : `<div class="ct-meta">Box is empty.</div>`;
  // Early releases are worth showing: they are the ones that cost a job, and
  // seeing the job named is what keeps the price real.
  const earlyRows = mrBoxItems(kid).filter(b => b.releasedAt && b.releasedEarly && b.redemptionJob)
    .slice(-3).reverse().map(b =>
      `<div class="ct-item"><div class="ct-item-left"><span>✅ ${escapeHtml(b.label)}<br><span class="ct-meta">earned back — ${escapeHtml(b.redemptionJob)}</span></span></div></div>`).join('');
  const fineNames = {};
  ((r.fines || {}).items || []).forEach(i => { fineNames[i.id] = i.label; });
  const fineRows = mrFines(kid).slice(-6).reverse().map(f =>
    `<div class="ct-item"><div class="ct-item-left"><span>${escapeHtml(fineNames[f.itemId] || f.itemId)}<br><span class="ct-meta">${escapeHtml(f.dayKey)}</span></span></div>
      <span class="ct-meta">−$1.00</span>
      ${isParent() ? `<button type="button" class="btn-icon" data-ct-action="del-fine" data-fine-id="${escapeAttr(f.id)}" aria-label="Remove fine">🗑</button>` : ''}</div>`).join('');
  // Step 3 of the honesty ladder is a withdrawal of discretion, so it has to be
  // visible where the strike was recorded — not just felt on the loan card.
  const eff = mrHonestyEffect(kid, ctWeekKey);
  const honestyNote = eff.losesChoices
    ? `<div class="ct-meta">⚖️ <b>Choices withdrawn this week</b> — the free chores land on her highest-paying work instead of her lowest, and paying extra off the loan is paused.</div>`
    : (Object.keys(eff.voidedChannels || {}).length
        ? `<div class="ct-meta">⚖️ Voided this week: <b>${escapeHtml(Object.keys(eff.voidedChannels).join(', '))}</b></div>`
        : '');
  return `<div class="chore-card"><h3>📦 Sunday Box &amp; fines</h3>
    <div class="ct-meta">Box first, fine on repeat. Everything in the box comes back at the Sunday family meeting. A day never goes below $0 — fines this week: <b>−$${fw.total.toFixed(2)}</b></div>
    ${honestyNote}${boxRows}${earlyRows}${fineRows}
    ${isParent() ? `<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem">
      <button type="button" class="pill-btn" data-ct-action="box-item">📦 Box something</button>
      <button type="button" class="pill-btn" data-ct-action="add-fine">− Add a fine</button>
      <button type="button" class="pill-btn" data-ct-action="honesty">⚖️ Honesty</button>
    </div>` : ''}</div>`;
}

function ctRenderMoneyCard(kid) {
  ctEnsureShared();
  const c = state.shared.chore;
  const name = kid === 'jenn' ? 'Jenn' : 'Jess';
  const money = ctWeekMoney(ctWeekKey, kid);
  const snap = c.moneySnapshots[ctWeekKey];
  const newModel = mrUsesNewModel(ctWeekKey);
  let body;
  if (snap && snap[kid] != null) {
    body = `<div class="ct-meta">Earned before the new money system.</div>`;
  } else if (newModel) {
    // Under the rulebook model the money comes from graded chores, learning,
    // the streak and competitions — not from group payouts, and there is no
    // weekly total cap.
    const b = mrWeekBreakdown(ctWeekKey, kid);
    const lines = [];
    if (b.chorePaid) lines.push(`<div class="ct-meta">🧹 Household chores +$${b.chorePaid.toFixed(2)}</div>`);
    if (b.learnPaid) lines.push(`<div class="ct-meta">📘 Learning +$${b.learnPaid.toFixed(2)}</div>`);
    if (b.streak.bonus) lines.push(`<div class="ct-meta">🔥 Streak (${b.streak.days} days) +$${b.streak.bonus.toFixed(2)}</div>`);
    if (b.compPaid) lines.push(`<div class="ct-meta">🏆 Competition +$${b.compPaid.toFixed(2)}</div>`);
    if (b.fines.total) lines.push(`<div class="ct-meta">📦 Fines −$${b.fines.total.toFixed(2)}</div>`);
    Object.keys(b.honesty.voidedChannels || {}).forEach(ch =>
      lines.push(`<div class="ct-meta">⚖️ ${escapeHtml(ch)} voided this week — honesty</div>`));
    if (b.chores.overflowChores) lines.push(`<div class="ct-meta">⭐ ${b.chores.overflowChores} chore${b.chores.overflowChores > 1 ? 's' : ''} past the daily max — earns XP</div>`);
    if (!lines.length) lines.push(`<div class="ct-meta">Do a household chore to start earning.</div>`);
    body = lines.join('');
  } else {
    const wk = c.groupPayoutsFired[ctWeekKey] || {};
    const lines = [];
    let uncapped = 0;
    for (const gid of Object.keys(wk)) {
      const e = wk[gid][kid];
      if (!e) continue;
      const g = ctGroupById(gid);
      const gname = g ? `${g.icon || ''} ${g.name}`.trim() : 'Group';
      if (e === true) {
        const amt = g ? (Number(g.valueDollars) || 0) : 0; uncapped += amt;
        lines.push(`<div class="ct-meta">✅ ${escapeHtml(gname)} +$${amt.toFixed(2)}</div>`);
      } else {
        const amt = Number(e.total) || 0; uncapped += amt;
        const dayCount = e.days ? Object.keys(e.days).length : 0;
        const suffix = dayCount ? ` ×${dayCount} day${dayCount > 1 ? 's' : ''}` : '';
        lines.push(`<div class="ct-meta">✅ ${escapeHtml(gname)}${suffix} +$${amt.toFixed(2)}</div>`);
      }
    }
    if (ctGetGoalBonus(ctWeekKey, kid)) { uncapped += 1; lines.push(`<div class="ct-meta">⭐ Weekly goal bonus +$1.00</div>`); }
    if (!lines.length) lines.push(`<div class="ct-meta">Finish a chore group to earn pocket money.</div>`);
    if (uncapped > CT_MONEY_CAP) lines.push(`<div class="ct-meta ct-cap-note">Capped at $${CT_MONEY_CAP} this week.</div>`);
    body = lines.join('');
  }
  const nw = netWorth(kid);
  const finalized = !!(c.finalizedWeeks && c.finalizedWeeks[ctWeekKey] && c.finalizedWeeks[ctWeekKey][kid] != null);
  return `<div class="chore-card chore-card--full"><h3>💰 ${name}'s pocket money</h3>
    <div class="ct-money-total">$${money.toFixed(2)}${newModel
      ? ` <span class="ct-money-cap">this week</span>`
      : ` <span class="ct-money-cap">/ $${CT_MONEY_CAP} max</span>`}</div>
    <div class="ct-meta" style="font-style:italic">Chores are how you help the family 💛 — the pocket money is a bonus for practising with real money.</div>
    <div class="ct-meta">${finalized ? '✅ Paid out at the family meeting' : 'Preliminary — confirmed at the weekly family meeting'}</div>
    ${body}
    <div class="ct-meta" style="margin-top:0.4rem">🏦 Net worth: <b>$${nw.toFixed(2)}</b></div>
    <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem">
      ${isParent()
        ? `<button type="button" class="pill-btn" onclick="mnyOpenMyMoney('${kid}')">💰 My money</button>
           <button type="button" class="pill-btn" onclick="openFamilyMeeting()">🧑‍🧑‍🧒 Family meeting</button>`
        : `<button type="button" class="pill-btn" onclick="mnyOpenMyMoney('${kid}')">💰 My money</button>`}
    </div></div>`;
}
function ctRenderGroupCards(kid) {
  const groups = ctGroupsForKid(kid);
  if (!groups.length) return '';
  return groups.map(g => {
    const ids = g.choreIds || [];
    const m = ids.length;
    const val = Number(g.valueDollars) || 0;
    const cadenceLabel = g.cadence === 'daily' ? 'day' : 'week';
    let paid, meta;
    const rows = ids.map(cn => {
      let extra = '';
      if (g.cadence === 'weekly') {
        const wkDone = [0,1,2,3,4,5,6].some(d => ctGetOptional(ctWeekKey, d, kid, cn));
        if (wkDone) extra = ` <span class="ct-badge ct-badge-week">done this week</span>`;
      }
      return ctOptCheckRow(kid, cn, extra);
    }).join('');
    if (g.cadence === 'daily') {
      const n = ids.filter(cn => ctGetOptional(ctWeekKey, ctDay, kid, cn)).length;
      paid = ctGroupFiredDaily(ctWeekKey, g.id, kid, ctDay);
      const entry = ctGetGroupFiredEntry(ctWeekKey, g.id, kid);
      const daysPaid = entry && entry.days ? Object.keys(entry.days).length : 0;
      meta = `<div class="ct-meta">Today: ${n}/${m}${paid ? ` · ✅ Paid $${val.toFixed(2)} today` : ''}</div>`
        + (daysPaid ? `<div class="ct-meta">Paid ${daysPaid} day${daysPaid > 1 ? 's' : ''} this week</div>` : '');
    } else {
      const n = ids.filter(cn => [0,1,2,3,4,5,6].some(d => ctGetOptional(ctWeekKey, d, kid, cn))).length;
      paid = ctGroupFiredWeekly(ctWeekKey, g.id, kid);
      meta = `<div class="ct-meta">${n}/${m} chores done this week${paid ? ` · ✅ Paid $${val.toFixed(2)}` : ''}</div>`;
    }
    return `<div class="chore-card ${paid ? 'paid' : ''}">
      <h3>${g.icon || '🧺'} ${escapeHtml(g.name)} <span class="ct-badge ct-money-badge">$${val.toFixed(2)} / ${cadenceLabel}</span></h3>
      ${meta}
      ${rows}
    </div>`;
  }).join('');
}
function ctRenderExtraChoresCard(kid) {
  const inGroups = new Set();
  ctGroupsForKid(kid).forEach(g => (g.choreIds || []).forEach(cn => inGroups.add(cn)));
  const extras = ctPickableChoreNames().filter(cn => !inGroups.has(cn));
  if (!extras.length) return '';
  const rows = extras.map(cn => ctOptCheckRow(kid, cn, '', `<span class="ct-badge">extra</span>`)).join('');
  return `<div class="chore-card"><h3>Extra chores</h3>
    <div class="ct-meta">Counts toward the weekly goal — no money.</div>${rows}</div>`;
}
function ctRenderGroupManagerCard() {
  if (!isParent()) return '';
  const rows = ctGroups().map(g => {
    const kidLabel = g.kid === 'both' ? 'Both' : (g.kid === 'jenn' ? 'Jenn' : 'Jess');
    return `<div class="ct-item">
      <div class="ct-item-left"><span>${g.icon || '🧺'} ${escapeHtml(g.name)}</span></div>
      <span class="ct-meta" style="margin:0">$${(Number(g.valueDollars) || 0).toFixed(2)}/${g.cadence === 'daily' ? 'day' : 'wk'} · ${kidLabel}</span>
      <span style="display:flex;gap:0.3rem">
        <button type="button" class="btn-icon" data-ct-action="edit-group" data-group-id="${escapeAttr(g.id)}" aria-label="Edit ${escapeAttr(g.name)}">✏️</button>
        <button type="button" class="btn-icon" data-ct-action="delete-group" data-group-id="${escapeAttr(g.id)}" aria-label="Delete ${escapeAttr(g.name)}">🗑</button>
      </span>
    </div>`;
  }).join('') || `<div class="ct-meta">No money groups yet.</div>`;
  const legacy = !mrUsesNewModel(ctWeekKey);
  return `<div class="chore-card"><h3>⚙️ Routines</h3>
    <div class="ct-meta">${legacy
      ? "Kids earn a routine's value when they finish all its chores within the cadence window."
      : 'Routines are tracked but pay no money — that is how the house runs. Money comes from household chores.'}</div>
    ${rows}
    <div style="margin-top:0.5rem"><button type="button" class="pill-btn" data-ct-action="new-group">+ New group</button></div>
  </div>`;
}
function ctRenderWeekControls() {
  const info = ctWeekInfo();
  const g = ctGetWeekGoals(ctWeekKey);
  // Interim control: it edits the legacy points goal only. A routine/money goal
  // set elsewhere shows read-only here and is preserved when this box is left
  // blank (see ctSaveGoalsFromUi) — the full two-part editor lands with the
  // parent setup screen.
  const goalRow = (kid, id, label) => {
    const pts = ctGoalPoints(g[kid]);
    if (!isParent()) return g[kid] ? `<div class="ct-meta">${label} goal: ${ctGoalLabel(g[kid])}</div>` : '';
    if (g[kid] && pts == null) return `<div class="ct-meta">${label} goal: ${ctGoalLabel(g[kid])}</div>`;
    return `<input id="${id}" class="input" type="number" min="1" max="60" value="${pts != null ? pts : ''}" placeholder="${label} goal" aria-label="${label} weekly point goal"/>`;
  };
  const goalRowJenn = goalRow('jenn', 'ctGoalJenn', 'Jenn');
  const goalRowJess = goalRow('jess', 'ctGoalJess', 'Jess');
  const parentControls = isParent() ? `
    <div class="chore-card">
      <h3>Parent controls</h3>
      <div class="ct-meta">Week goals and validation controls.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-top:0.4rem">
        ${goalRowJenn}${goalRowJess}
      </div>
      <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
        <button class="pill-btn" onclick="ctSaveGoalsFromUi()">Save goals</button>
        <button class="pill-btn danger" onclick="ctClearWeek()">Clear week</button>
        <button class="pill-btn" onclick="ctExportBackup()">Export backup</button>
      </div>
      <div style="display:flex;gap:0.4rem;margin-top:0.5rem">
        <button class="pill-btn ${ctParentKid==='jenn'?'active':''}" onclick="ctParentKid='jenn';renderChoreTab()">Jenn view</button>
        <button class="pill-btn ${ctParentKid==='jess'?'active':''}" onclick="ctParentKid='jess';renderChoreTab()">Jess view</button>
      </div>
    </div>` : (
    (goalRowJenn || goalRowJess) ? `
    <div class="chore-card">
      <h3>Goals</h3>
      ${goalRowJenn}${goalRowJess}
    </div>` : '');
  const weekLabel = `${MONTH_SHORT[info.mon.getMonth()]} ${info.mon.getDate()} — ${MONTH_SHORT[info.sun.getMonth()]} ${info.sun.getDate()}`;
  // Day picker only matters for the parent day-by-day management view; the kid
  // matrix already shows all 7 days, so the day pills are dropped there.
  const dayPills = isParent()
    ? `<div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-top:0.5rem">
        ${CT_DAYS.map((d,i)=>`<button class="pill-btn ${i===ctDay?'active':''}" onclick="ctSelectDay(${i})">${d}</button>`).join('')}
      </div>` : '';
  // Kids can view their chores here but tick completion in their Day / Week view
  // (which syncs back automatically) — this board is read-only for them.
  const kidNote = !isParent()
    ? `<div class="ct-meta" style="margin-top:0.5rem;font-style:italic">👀 View only — tick chores &amp; routines done in your <b>Day</b> or <b>Week</b> view and they'll fill in here.</div>`
    : '';
  return `<div class="chore-card">
    <div class="ct-weeknav">
      <button class="btn-icon" onclick="ctChangeWeek(-1)" aria-label="Previous week">◀</button>
      <h3 class="ct-weeknav-label">Week of ${weekLabel}</h3>
      <button class="btn-icon" onclick="ctChangeWeek(1)" aria-label="Next week">▶</button>
    </div>
    ${dayPills}
    ${kidNote}
  </div>${parentControls}`;
}
function ctChangeWeek(delta) {
  const mon = formatDayKey(ctWeekKey || ctDateToKey(ctMondayOf(new Date())));
  mon.setDate(mon.getDate() + delta * 7);
  ctWeekKey = ctDateToKey(mon);
  ctDay = 0;
  renderChoreTab();
}
function ctSelectDay(dayIdx) {
  ctDay = Math.max(0, Math.min(6, dayIdx));
  renderChoreTab();
}
function ctSaveGoalsFromUi() {
  const cur = ctGetWeekGoals(ctWeekKey);
  // A missing input means "not editing this kid" — a routine/money goal renders
  // as text, so blanking it here must not delete a goal this box cannot express.
  const read = (id, kid) => {
    const el = document.getElementById(id);
    if (!el) return cur[kid];
    const n = parseInt(el.value || '', 10);
    return Number.isInteger(n) ? n : null;
  };
  const j = read('ctGoalJenn', 'jenn');
  const k = read('ctGoalJess', 'jess');
  // ctSetWeekGoals already clears a bonus when its goal is removed. Do NOT blanket-reset
  // both bonuses — that would strip a bonus a kid already banked when a goal is re-saved.
  ctSetWeekGoals(ctWeekKey, j, k);
  ctMaybeFireGoalBonus(ctWeekKey, 'jenn');   // a lowered goal may already be met
  ctMaybeFireGoalBonus(ctWeekKey, 'jess');
  saveAll();
  renderChoreTab();
}
/* ── Parent money-group editor (reuses the .sheet overlay pattern) ── */
function ctRenderChoreEditorList(selectedIds) {
  const sel = new Set(selectedIds || []);
  const names = [...new Set([...ctAllChoreNames(), ...sel])];  // include any names already on the group
  const host = document.getElementById('cgChoreList');
  if (!host) return;
  host.innerHTML = names.map(n => `
    <label class="cg-chore-row">
      <input type="checkbox" data-chore="${escapeAttr(n)}" ${sel.has(n) ? 'checked' : ''}>
      <span>${escapeHtml(n)}</span>
    </label>`).join('');
}
function ctOpenGroupEditor(groupId) {
  if (!isParent()) { showToast('Only parents can edit money groups 🔒'); return; }
  ctEnsureShared();
  ctEditingGroupId = groupId || null;
  const g = groupId ? ctGroupById(groupId) : null;
  document.getElementById('cgTitle').textContent = g ? '💰 Edit Money Group' : '💰 New Money Group';
  document.getElementById('cgName').value = g ? g.name : '';
  document.getElementById('cgIcon').value = g ? (g.icon || '') : '';
  document.getElementById('cgKid').value = g ? g.kid : 'both';
  document.getElementById('cgCadence').value = g ? g.cadence : 'weekly';
  document.getElementById('cgValue').value = g ? g.valueDollars : 1;
  document.getElementById('cgNewChore').value = '';
  ctRenderChoreEditorList(g ? g.choreIds : []);
  openSheet('choreGroupOverlay');
}
function ctAddCustomChoreToEditor() {
  const input = document.getElementById('cgNewChore');
  const name = (input.value || '').trim();
  if (!name) return;
  const existing = [...document.querySelectorAll('#cgChoreList input[data-chore]')].map(el => el.dataset.chore);
  if (existing.includes(name)) { showToast('That chore is already listed'); input.value = ''; return; }
  // preserve current checkbox selections, then append the new (checked) chore
  const selected = existing.filter((_, i) => document.querySelectorAll('#cgChoreList input[data-chore]')[i].checked);
  ctRenderChoreEditorList([...selected, name]);
  input.value = '';
}
function ctConfirmGroupFromUi() {
  if (!isParent()) return;
  const name = (document.getElementById('cgName').value || '').trim();
  const icon = (document.getElementById('cgIcon').value || '').trim();
  const kid = document.getElementById('cgKid').value;
  const cadence = document.getElementById('cgCadence').value === 'daily' ? 'daily' : 'weekly';
  const valueDollars = parseFloat(document.getElementById('cgValue').value);
  const choreIds = [...document.querySelectorAll('#cgChoreList input[data-chore]:checked')].map(el => el.dataset.chore);
  if (!name) { showToast('Give the group a name'); return; }
  if (!(valueDollars > 0)) { showToast('Set a dollar value above 0'); return; }
  if (!choreIds.length) { showToast('Pick at least one chore'); return; }
  ctEnsureShared();
  if (ctEditingGroupId) {
    const g = ctGroupById(ctEditingGroupId);
    // updatedAt lets the sync merge keep the newer edit when two devices touch groups.
    if (g) { g.name = name; g.icon = icon; g.kid = kid; g.cadence = cadence; g.valueDollars = valueDollars; g.choreIds = choreIds; g.updatedAt = Date.now(); }
  } else {
    state.shared.chore.groups.push({ id:'grp-'+Date.now().toString(36), name, icon, kid, choreIds, valueDollars, cadence, updatedAt: Date.now() });
  }
  ctEditingGroupId = null;
  saveAll();
  closeSheet('choreGroupOverlay');
  renderChoreTab();   // render sweep fires any payout the edit newly satisfies
  showToast('Group saved 💰');
}
async function ctDeleteGroup(groupId) {
  if (!isParent()) return;
  const g = ctGroupById(groupId);
  if (!g) return;
  if (!(await showConfirm(`Delete "${g.name}"? Money already earned from it stays.`, { danger:true, okLabel:'Delete' }))) return;
  state.shared.chore.groups = ctGroups().filter(x => x.id !== groupId);
  tombstoneIds('grp:', [groupId]); // record the delete so it can't resurrect from another device's copy
  saveAll();
  renderChoreTab();
}
function ctRenderSummaryTable() {
  return `<div class="chore-card"><h3>8-week summary</h3>
    <div style="overflow:auto"><table class="wf-analytics-table"><thead><tr><th>Week</th><th>Jenn Mand</th><th>Jenn Opt</th><th>Jenn $</th><th>Jess Mand</th><th>Jess Opt</th><th>Jess $</th></tr></thead><tbody>${ctWeekSummaryRows()}</tbody></table></div>
  </div>`;
}
// Full pocket-money history: every week ever recorded at a family meeting, drawn
// from finalizedWeeks (the authoritative "paid" ledger — unbounded, unlike the
// rolling 8-week summary), with per-kid running cumulative totals.
/* One frozen week, read back as a sentence. Only the parts that actually
   happened are shown — a row of zeroes is noise, not a record. */
function ctLedgerLine(L) {
  const bits = [];
  if (L.chores)      bits.push(`🧹 $${Number(L.chores).toFixed(2)}`);
  if (L.learning)    bits.push(`📘 $${Number(L.learning).toFixed(2)}`);
  if (L.streak)      bits.push(`🔥 ${L.streakDays}d $${Number(L.streak).toFixed(2)}`);
  if (L.competition) bits.push(`🏆 $${Number(L.competition).toFixed(2)}`);
  if (L.fines)       bits.push(`📦 −$${Number(L.fines).toFixed(2)}`);
  if (L.xp)          bits.push(`⭐ ${L.xp} XP`);
  if (L.loan && L.loan.paid)      bits.push(`🎿 ${L.loan.kind === 'down' ? 'deposit' : 'loan'} −$${Number(L.loan.paid).toFixed(2)}`);
  if (L.loan && L.loan.interest)  bits.push(`interest −$${Number(L.loan.interest).toFixed(2)}`);
  if (L.loan && L.loan.shortfall) bits.push(`overdue $${Number(L.loan.shortfall).toFixed(2)}`);
  if ((L.voided || []).length)    bits.push(`⚖️ ${escapeHtml(L.voided.join(', '))} voided`);
  if (L.pickWithdrawn)            bits.push(`⚖️ pick withdrawn`);
  if (L.overflowChores)           bits.push(`${L.overflowChores} past the cap`);
  return bits.length ? bits.join(' · ') : 'nothing earned';
}

function ctRenderMoneyHistory() {
  ctEnsureShared();
  const fw = state.shared.chore.finalizedWeeks || {};
  const keys = Object.keys(fw).sort();   // YYYY-MM-DD keys sort chronologically
  if (!keys.length) {
    return `<div class="chore-card"><details class="ct-history"><summary><h3>💰 Full pocket-money history</h3></summary>
      <div class="ct-meta" style="margin-top:0.3rem">No weeks recorded yet. A week appears here once you tap “Confirm &amp; record” for it in the family meeting.</div>
    </details></div>`;
  }
  const ledger = state.shared.chore.moneyLedger || {};
  let jRun = 0, kRun = 0, rows = '';
  keys.forEach(wk => {
    const entry = fw[wk] || {};
    const jHas = entry.jenn != null, kHas = entry.jess != null;
    const j = Number(entry.jenn) || 0, k = Number(entry.jess) || 0;
    if (jHas) jRun = money2(jRun + j);
    if (kHas) kRun = money2(kRun + k);
    const d = formatDayKey(wk);
    const label = `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    rows += `<tr><td>${label}</td>`
      + `<td>${jHas ? '$' + j.toFixed(2) : '—'}</td><td>$${jRun.toFixed(2)}</td>`
      + `<td>${kHas ? '$' + k.toFixed(2) : '—'}</td><td>$${kRun.toFixed(2)}</td></tr>`;
    // Where a frozen breakdown exists, show what the total was actually made
    // of — a bare number a month later answers nothing on its own.
    const lw = ledger[wk] || {};
    const detail = ['jenn', 'jess'].map(kid => {
      const L = lw[kid];
      if (!L) return '';
      return `<span class="ct-hist-kid">${CT_PROFILE_ICON[kid]} ${ctLedgerLine(L)}</span>`;
    }).filter(Boolean).join('');
    if (detail) rows += `<tr class="ct-hist-detail"><td colspan="5">${detail}</td></tr>`;
  });
  rows += `<tr class="ct-hist-total"><td>Total · ${keys.length} wk</td><td>$${jRun.toFixed(2)}</td><td></td><td>$${kRun.toFixed(2)}</td><td></td></tr>`;
  const ji = CT_PROFILE_ICON['jenn'], ki = CT_PROFILE_ICON['jess'];
  return `<div class="chore-card"><details class="ct-history">
      <summary><h3>💰 Full pocket-money history</h3><span class="ct-meta">${keys.length} recorded week${keys.length > 1 ? 's' : ''}</span></summary>
      <div class="ct-meta" style="margin:0.3rem 0">Every week recorded at a family meeting, oldest first, with running totals. “—” means no amount was recorded for that kid that week. Each week's breakdown is <b>frozen when it was agreed</b> — changing a price today never rewrites what a past week paid.</div>
      <div style="overflow:auto"><table class="wf-analytics-table">
        <thead><tr><th>Week</th><th>${ji} Jenn $</th><th>Jenn total</th><th>${ki} Jess $</th><th>Jess total</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
    </details></div>`;
}
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
  const anchor = startDate || state.shared.chore.programStartDate || ctDateToKey(ctMondayOf(new Date()));
  const anchorDate = formatDayKey(anchor);
  for (let w = 1; w <= 8; w++) {
    const weekMon = new Date(anchorDate); weekMon.setDate(anchorDate.getDate() + (w-1)*7);
    const wk = ctDateToKey(weekMon);
    for (let d = 0; d < 7; d++) {
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
    if (c.goalsByWeek[String(w)])    { newGoals[wk] = c.goalsByWeek[String(w)];    delete c.goalsByWeek[String(w)];    didMigrate = true; }
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
  // reached from the Quest Board (kids' default landing) before renderChoreTab runs it. Idempotent.
  ctMigrateNumberedKeys();
  const migrationWeek = ctDateToKey(ctMondayOf(new Date()));

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
function renderChoreTab() {
  ctPrepareRead();
  // ctWeekKey is set once in openChoreTab and preserved across renders (navigation)
  if (!ctWeekKey) ctSetCurrentWeekFromPlanner();
  const wrap = document.getElementById('choreWrap');
  if (!wrap) return;
  const badge = document.getElementById('choreProfileBadge');
  if (badge) badge.textContent = isParent() ? `👨‍👩‍👧‍👦 Parent (${ctParentKid==='jenn'?'Jenn':'Jess'})` : (activeProfile()==='jenn' ? '🐥 Jenn' : '🦊 Jess');
  const kid = isParent() ? ctParentKid : activeProfile();
  ctMaybeFireGoalBonus(ctWeekKey, 'jenn');
  ctMaybeFireGoalBonus(ctWeekKey, 'jess');
  // Silent self-heal: fire payouts satisfied by remote-synced checks or by a group
  // created/edited after its chores were already ticked.
  const swept = ctSweepGroupPayouts(ctWeekKey, 'jenn').length + ctSweepGroupPayouts(ctWeekKey, 'jess').length;
  if (swept) saveAll();

  // 1a: kids get the one-tap week matrix; parents keep the day-by-day
  // management view (groups, chore names, summary, etc.).
  // The three chore kinds render as three cards, in the order the rulebook
  // names them: what pays, what's yours, what's just how we live.
  const newModel = mrUsesNewModel(ctWeekKey);
  const household = newModel ? ctRenderHouseholdChores(kid) : '';
  const personal  = newModel ? ctRenderPersonalChores(kid) : '';
  const learning  = newModel ? ctRenderLearningCard(kid) : '';
  const streak    = newModel ? ctRenderStreakCard(kid) : '';
  const comp      = newModel ? ctRenderCompetitionCard(kid) : '';
  const boxFines  = newModel ? ctRenderBoxFinesCard(kid) : '';

  wrap.innerHTML = isParent()
    ? `
    <div class="chore-grid">
      ${ctRenderWeekControls()}
      ${ctRenderMoneyCard(kid)}
      ${household}
      ${personal}
      ${learning}
      ${streak}
      ${comp}
      ${boxFines}
      ${ctRenderKidSection(kid)}
      ${ctRenderGroupCards(kid)}
      ${ctRenderExtraChoresCard(kid)}
      ${ctRenderGroupManagerCard()}
      ${ctRenderChoreNamesCard()}
      ${ctRenderSummaryTable()}
      ${ctRenderMoneyHistory()}
    </div>
  `
    // A kid gets the redesigned tab: one job, and every control on it writes a
    // claim rather than a payment. Weeks earned under the retired group model
    // have no chore pool to read, so those fall back to the old board.
    : (newModel ? ckRenderKidTab(kid) : `
    <div class="chore-grid">
      ${ctRenderWeekControls()}
      ${ctRenderWeekMatrix(kid)}
      ${ctRenderMoneyCard(kid)}
    </div>
  `);
}

