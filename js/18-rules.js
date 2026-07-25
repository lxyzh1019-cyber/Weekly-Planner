// Weekly-Planner — pocket-money rules: effective-dated rule versions + audit log.
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   POCKET MONEY RULES

   Every dollar value the money system uses lives here as *data*, not as a
   constant, so a parent can change it without a code edit — and every change
   is recorded. Mirrors AllowanceRulesJennJess-v2.md.

   Two properties matter more than anything else in this file:

   1. Rules are EFFECTIVE-DATED, never mutated in place. Editing clones the
      latest version, stamps a new effectiveFrom, and appends a log entry.
      `mrRulesFor(dayKey)` resolves the version that was live on that date.
      This is load-bearing: ctWeekMoney recomputes live for any week that was
      never finalized at a meeting, so without date resolution a rate change
      today silently rewrites what was earned last month.

   2. The version list is an id-keyed array so `mergeArrayById` can union edits
      made on two devices; the log is a grow-only map, where a plain union is
      already the correct merge (see the taxonomy note in js/04-merge.js).
   ════════════════════════════════════════════════════════════════ */

/* Chore taxonomy, per the rulebook:
     ROUTINE          — state.shared.chore.groups (existing bundles). Unpaid.
     HOUSEHOLD chore  — paid, graded 3/2/1/0, each with its OWN deadline.
     PERSONAL chore   — mandatory, unpaid; XP only when done unasked.
   Every household chore is meant to be roughly equivalent effort, so the kid
   picking her two free ones each week has no clever move available. */
const MR_HOUSEHOLD_CHORES = [
  { id: 'dishes',   label: 'Dishes & dishwasher',   deadline: 'before you leave the kitchen' },
  { id: 'mop',      label: 'Mop',                   deadline: 'before dinner' },
  { id: 'vacuum',   label: 'Vacuum',                deadline: 'before dinner' },
  { id: 'laundry',  label: 'Laundry',               deadline: 'before bed' },
  { id: 'sorting',  label: 'Sorting clothes',       deadline: 'before bed' },
  { id: 'bins',     label: 'Bins out',              deadline: 'before dinner' },
  { id: 'table',    label: 'Set & clear the table', deadline: 'before dinner' },
];
const MR_PERSONAL_CHORES = [
  { id: 'bed',      label: 'Make your bed' },
  { id: 'room',     label: 'Tidy your room' },
  { id: 'schoolbag',label: 'Pack your school bag' },
  { id: 'gear',     label: 'Pack your sports gear' },
];

/* The seed template. Every value is a starting point reviewed each quarter —
   none of it is load-bearing. */
const MR_DEFAULT_RULES = {
  targets: { jenn: { annual: 1000 }, jess: { annual: 800 } },

  chorePool: MR_HOUSEHOLD_CHORES,
  personalChores: MR_PERSONAL_CHORES,
  chores: {
    // grade → dollars. 3 = on time AND to standard, 2 = to standard but late,
    // 1 = passed a redo, 0 = not done or failed the redo.
    grade: { 3: 3, 2: 2, 1: 1, 0: 0 },
    dailyCap: 3,
    freeChoresPerWeek: 2,   // kid-picked, unpaid, deducted BEFORE the daily cap
  },

  learning: {
    items: [
      { id: 'math',        label: 'Math homework', unit: 'pages', perUnit: 3,  amount: 2 },
      { id: 'handwriting', label: 'Handwriting',   unit: 'pages', perUnit: 5,  amount: 2 },
      { id: 'chinese',     label: 'Chinese',       unit: 'words', perUnit: 10, amount: 1 },
      // The learning app is XP-only: it is the one channel whose units are
      // trivially farmable, so it never pays dollars.
      { id: 'app',     label: 'Learning game level',  unit: 'levels', perUnit: 1, amount: 0, xpOnly: true },
    ],
    sundayCheckCount: 3,    // Mom picks 3 at random; a miss unpays and re-queues it
    newMaterialOnly: true,
  },

  // Highest tier only — 7 clean days pays $3, NOT $1+$2+$3.
  streak: { tiers: [{ days: 3, bonus: 1 }, { days: 5, bonus: 2 }, { days: 7, bonus: 3 }],
            highestOnly: true, resetsOn: 'sunday' },

  competition: {
    // No caps on points, by decision — the dance test is the one exception.
    swim:  { perPoint: 1, qualifyBonus: 20, provincialPerPoint: 2 },
    skate: { perPoint: 1, placement: { group: { 1: 20, 2: 10, 3: 5 }, overall: { 1: 20, 2: 10, 3: 5 } }, stackable: true },
    dance: { silverPerItem: 1, goldPerItem: 2, allGoldBonus: 10, testCap: 30 },
  },

  // Objects left out are boxed, not fined — the fine only lands on a REPEAT of
  // the same item in the same week. One event, one penalty, until it's a choice.
  saturdayBox: {
    releaseDay: 'saturday',
    redemptionJob: true,
    redemptionCountsToFree: false,   // the redemption job is NOT one of the free two
    exempt: ['school books', 'homework', 'sports gear'],
    repeatFineId: 'box_repeat',
  },

  fines: {
    items: [
      { id: 'tone',        label: 'How you speak to each other, or to us', amount: 1 },
      { id: 'borrow',      label: "Taking your sister's things without asking", amount: 1 },
      { id: 'screens',     label: 'Screens past the agreed limit', amount: 1 },
      { id: 'asked_twice', label: 'Being asked twice', amount: 1 },
      { id: 'box_repeat',  label: 'Something left out for the second time this week', amount: 1 },
    ],
    dailyFloorZero: true,   // fines can zero a day, never create debt
  },

  /* Honesty is deliberately NOT a flat fine. Trust is what was broken, so the
     ladder ends by withdrawing discretion rather than money. */
  honesty: {
    steps: [
      { step: 1, action: 'void_and_talk',      label: 'Claim void. Recorded, discussed Sunday.' },
      { step: 2, action: 'void_and_channel',   label: 'Claim void. That channel pays nothing this week.' },
      { step: 3, action: 'void_and_privileges',label: 'Claim void. Loses free-chore pick and loan-surplus choice.' },
    ],
  },

  xp: {
    perLevel: 100,
    awards: [
      { id: 'chore_overflow', label: 'Extra household chore past your $3 day', xp: 20 },
      { id: 'personal_unasked', label: 'Personal chore done without being asked', xp: 10 },
      { id: 'app_level',      label: 'Learning game level cleared', xp: 20 },
      { id: 'helped_sister',  label: "Helping with something that isn't yours", xp: 15 },
      { id: 'streak_7',       label: 'Full 7-day routine streak', xp: 50 },
      { id: 'personal_best',  label: 'Personal best at a competition', xp: 50 },
    ],
  },

  loan: {
    principal: { jenn: 1000, jess: 800 },
    downPayment: { jenn: 300, jess: 240 },
    downPaymentDue: '2026-10-01',
    monthly: { jenn: 70, jess: 56 },
    months: 10,
    onScheduleRatePct: 0,
    arrearsRatePct: 5,          // per month, on the overdue portion only
    simpleInterest: true,       // never charge interest on accrued interest
    earlyPaymentBonusPct: 10,   // any early payment, any size: $100 clears $110
    shortfallChoices: ['pay_available', 'pay_nothing', 'cover_from_savings'],
  },

  sickPausesEverything: true,
  reviewCadence: 'quarterly',
};

/* Reason codes for every rule edit. `family_meeting` is the default — the
   normal case is "we agreed to change this together on Sunday". */
const MR_REASONS = [
  { id: 'family_meeting',     label: 'Family meeting' },
  { id: 'correct_error',      label: 'Correct a previous error' },
  { id: 'quarterly_review',   label: 'Quarterly review' },
  { id: 'new_activity',       label: 'New activity added' },
  { id: 'one_time_exception', label: 'One-time exception' },
];
const MR_DEFAULT_REASON = 'family_meeting';
function mrReasonLabel(id) {
  const r = MR_REASONS.find(x => x.id === id);
  return r ? r.label : (id || '—');
}

function mrNewId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function mrDeepCopy(o) { return JSON.parse(JSON.stringify(o)); }

/* Lazy-init, mirroring bankConfig() (js/14-money.js:24) so saved state upgrades
   silently on first read. */
function mrEnsure() {
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.moneyRules) c.moneyRules = {};
  const mr = c.moneyRules;
  if (!Array.isArray(mr.versions)) mr.versions = [];
  if (!mr.log) mr.log = {};
  if (!mr.versions.length) {
    const now = Date.now();
    mr.versions.push({
      id: mrNewId('mrv-'),
      effectiveFrom: c.programStartDate || ctDateToKey(ctMondayOf(new Date())),
      createdAt: now, updatedAt: now, createdBy: 'parent',
      reason: MR_DEFAULT_REASON,
      note: 'Rulebook v2 — starting template.',
      rules: mrDeepCopy(MR_DEFAULT_RULES),
    });
  }
  return mr;
}

/* Versions oldest → newest by effective date. Ties break on createdAt so two
   edits made the same day resolve identically on every device. */
function mrVersions() {
  const mr = mrEnsure();
  return mr.versions.slice().sort((a, b) => {
    if (a.effectiveFrom !== b.effectiveFrom) return a.effectiveFrom < b.effectiveFrom ? -1 : 1;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

/* The version live on `dayKey`: the newest whose effectiveFrom is on or before
   that date. Keys are 'YYYY-MM-DD', so a string compare is chronological.
   Falls back to the earliest version for dates before the program started, so a
   historical week never resolves to nothing. */
function mrVersionForDate(dayKey) {
  const vs = mrVersions();
  if (!vs.length) return null;
  const key = dayKey || todayKey();
  let found = null;
  for (const v of vs) {
    if (v.effectiveFrom <= key) found = v; else break;
  }
  return found || vs[0];
}
function mrRulesFor(dayKey) {
  const v = mrVersionForDate(dayKey);
  return (v && v.rules) || MR_DEFAULT_RULES;
}
/* Rules for a chore week resolve from the week's MONDAY, not from today, so
   recomputing an old week uses the rules that were live when it was earned. */
function mrRulesForWeek(weekKey) { return mrRulesFor(weekKey); }
function mrRules() { return mrRulesFor(todayKey()); }
function mrLatestVersion() {
  const vs = mrVersions();
  return vs.length ? vs[vs.length - 1] : null;
}

/* ── Dotted-path access ──
   Paths ('chores.dailyCap', 'loan.arrearsRatePct') keep the editor and the log
   generic — neither needs a per-field branch. */
function mrGetPath(obj, path) {
  return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function mrSetPath(obj, path, value) {
  const parts = String(path).split('.');
  const last = parts.pop();
  let cur = obj;
  for (const k of parts) {
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[last] = value;
}

/* ── Audit log ──
   Grow-only map keyed by entry id: a plain union is the correct merge, so this
   needs no timestamp arbitration. */
function mrLogAppend(entry) {
  const mr = mrEnsure();
  const id = entry.id || mrNewId('mrl-');
  mr.log[id] = { id, at: Date.now(), by: 'parent', ...entry };
  return mr.log[id];
}
function mrLogEntries() {
  return Object.values(mrEnsure().log).sort((a, b) => (b.at || 0) - (a.at || 0));
}

/* ── Editing ──
   Clone the latest version, apply changes, stamp a new effectiveFrom, log one
   entry per changed field. Nothing already earned moves: past dates still
   resolve to the older version.

   `changes` is [{path, value}]. `effectiveFrom` defaults to today; a future
   date schedules the change. Returns the version, or null if nothing changed. */
function mrApplyEdits(changes, { reason, note, effectiveFrom } = {}) {
  if (!isParent()) { showToast('Only parents can change the money rules 🔒'); return null; }
  const mr = mrEnsure();
  const base = mrLatestVersion();
  const from = effectiveFrom || todayKey();
  const rules = mrDeepCopy((base && base.rules) || MR_DEFAULT_RULES);

  const applied = [];
  (changes || []).forEach(ch => {
    const before = mrGetPath(rules, ch.path);
    if (JSON.stringify(before) === JSON.stringify(ch.value)) return;   // no-ops make no version
    mrSetPath(rules, ch.path, ch.value);
    applied.push({ path: ch.path, from: before, to: ch.value });
  });
  if (!applied.length) return null;

  const now = Date.now();
  // Editing a version already effective today REPLACES it rather than stacking
  // a second same-day version — otherwise nudging one number three times leaves
  // three versions all effective today, and the tie-break decides the winner.
  let version;
  if (base && base.effectiveFrom === from) {
    base.rules = rules;
    base.updatedAt = now;
    base.reason = reason || MR_DEFAULT_REASON;
    if (note != null) base.note = note;
    version = base;
  } else {
    version = {
      id: mrNewId('mrv-'), effectiveFrom: from, createdAt: now, updatedAt: now,
      createdBy: 'parent', reason: reason || MR_DEFAULT_REASON, note: note || '', rules,
    };
    mr.versions.push(version);
  }
  applied.forEach(a => mrLogAppend({
    versionId: version.id, effectiveFrom: from,
    path: a.path, from: a.from, to: a.to,
    reason: reason || MR_DEFAULT_REASON, note: note || '',
  }));
  saveAll();
  return version;
}

/* ── Shared read helpers ── */
function mrTargetFor(kid) {
  return Number(((mrRules().targets || {})[kid] || {}).annual) || 0;
}
function mrChoreById(id, weekKey) {
  return (mrRulesForWeek(weekKey).chorePool || []).find(c => c.id === id) || null;
}
/* Apply a cap that may legitimately be null/absent ("no cap"). Centralised so a
   missing cap can never silently become 0. */
function mrApplyCap(amount, cap) {
  const a = Number(amount) || 0;
  if (cap == null || cap === '') return a;
  const c = Number(cap);
  return isFinite(c) ? Math.min(a, c) : a;
}

/* ════════════════════════════════════════════════════════════════
   EARNINGS — the new chore model

   Three kinds of chore, per the rulebook:
     ROUTINE          — state.shared.chore.groups. Tracked, pays nothing.
     HOUSEHOLD chore  — graded 3/2/1/0, paid, own deadline, $3/day cap.
     PERSONAL chore   — mandatory, unpaid; XP only when done unasked.
   ════════════════════════════════════════════════════════════════ */

/* The week the new model takes over. Weeks before it keep the old
   group-payout formula, so switching the family to graded chores can't
   restate money that was already earned under the old rules. Set once, to the
   Monday of whichever week the app first runs the new code. */
function mrModelStartWeek() {
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.moneyModelStartWeek) c.moneyModelStartWeek = ctDateToKey(ctMondayOf(new Date()));
  return c.moneyModelStartWeek;
}
function mrUsesNewModel(weekKey) {
  return String(weekKey || '') >= mrModelStartWeek();   // 'YYYY-MM-DD' compares chronologically
}

function mrEnsureEarnings(kid, weekKey) {
  const p = getProfData(kid);
  if (!p.earnings) p.earnings = {};
  if (!p.earnings[weekKey]) p.earnings[weekKey] = {};
  const e = p.earnings[weekKey];
  if (!e.chores) e.chores = {};       // {[dayIdx]: {[choreId]: grade 1..3}}
  if (!e.personal) e.personal = {};   // {[dayIdx]: {[choreId]: 'done'|'unasked'}}
  if (!e.learning) e.learning = {};   // filled in by a later step
  if (!e.sick) e.sick = {};           // {[dayIdx]: true} — pauses everything
  if (!p.earningsUpdatedAtByWeek) p.earningsUpdatedAtByWeek = {};
  return e;
}
/* Stamp the week so a cross-device merge knows which side is newer — this is
   what lets a REGRADE (3 → 1) beat a stale remote copy, exactly as
   ctStampChoreWeek does for the old checkbox model. */
function mrStampEarnings(kid, weekKey) {
  const p = getProfData(kid);
  if (!p.earningsUpdatedAtByWeek) p.earningsUpdatedAtByWeek = {};
  p.earningsUpdatedAtByWeek[weekKey] = Date.now();
}

function mrGetChoreGrade(kid, weekKey, dayIdx, choreId) {
  const e = mrEnsureEarnings(kid, weekKey);
  return Number((e.chores[String(dayIdx)] || {})[choreId]) || 0;
}
function mrSetChoreGrade(kid, weekKey, dayIdx, choreId, grade) {
  if (!isParent()) { showToast('Mom grades the chores 🔒'); return false; }
  const e = mrEnsureEarnings(kid, weekKey);
  const d = String(dayIdx);
  if (!e.chores[d]) e.chores[d] = {};
  const g = Math.max(0, Math.min(3, Number(grade) || 0));
  if (g === 0) delete e.chores[d][choreId]; else e.chores[d][choreId] = g;
  mrStampEarnings(kid, weekKey);
  saveAll();
  return true;
}
function mrGetPersonal(kid, weekKey, dayIdx, choreId) {
  const e = mrEnsureEarnings(kid, weekKey);
  return (e.personal[String(dayIdx)] || {})[choreId] || null;
}
/* Personal chores cycle none → done → done-unasked. Only the last earns XP;
   none of the three ever earns money. */
function mrCyclePersonal(kid, weekKey, dayIdx, choreId) {
  const e = mrEnsureEarnings(kid, weekKey);
  const d = String(dayIdx);
  if (!e.personal[d]) e.personal[d] = {};
  const cur = e.personal[d][choreId] || null;
  const next = cur === null ? 'done' : (cur === 'done' ? 'unasked' : null);
  if (next === null) delete e.personal[d][choreId]; else e.personal[d][choreId] = next;
  mrStampEarnings(kid, weekKey);
  saveAll();
  return next;
}
function mrIsSick(kid, weekKey, dayIdx) {
  return !!mrEnsureEarnings(kid, weekKey).sick[String(dayIdx)];
}
function mrToggleSick(kid, weekKey, dayIdx) {
  if (!isParent()) { showToast('A grown-up marks sick days 🔒'); return; }
  const e = mrEnsureEarnings(kid, weekKey);
  const d = String(dayIdx);
  if (e.sick[d]) delete e.sick[d]; else e.sick[d] = true;
  mrStampEarnings(kid, weekKey);
  saveAll();
}

/* Household chore money for a week.

   Order matters and is the subtle part: the free chores are deducted BEFORE
   the daily cap, not after. Deducting after would mean a kid who does three
   chores on Monday takes her free two out of already-capped money and earns
   less than one who did the same work spread across the week.

   The first `freeChoresPerWeek` graded chores of the week are the free ones.
   Because every chore in the pool is meant to be equivalent effort, taking
   them chronologically is the same as letting her choose — she picks by
   deciding what to do first, and no ordering earns her more.

   Returns the paid total plus the per-day breakdown and the count of chores
   that fell entirely past the cap (those earn XP instead — credited at the
   family meeting, so a re-render can never double-award). */
function mrChoreWeek(weekKey, kid) {
  const r = mrRulesForWeek(weekKey);
  const cfg = r.chores || {};
  const pay = cfg.grade || {};
  const dailyCap = cfg.dailyCap;
  let freeLeft = Number(cfg.freeChoresPerWeek) || 0;

  const days = [];
  let total = 0, overflowChores = 0, freeUsed = [];
  for (let d = 0; d < 7; d++) {
    const graded = mrEnsureEarnings(kid, weekKey).chores[String(d)] || {};
    let dayPaid = 0, dayRaw = 0;
    // Stable order so the same week always resolves identically.
    Object.keys(graded).sort().forEach(choreId => {
      const g = Number(graded[choreId]) || 0;
      if (g <= 0) return;
      if (freeLeft > 0) { freeLeft--; freeUsed.push({ dayIdx: d, choreId }); return; }
      const value = Number(pay[g]) || 0;
      dayRaw += value;
      const room = (dailyCap == null) ? value : Math.max(0, dailyCap - dayPaid);
      if (room <= 0) { overflowChores++; return; }   // nothing left today → XP
      dayPaid += Math.min(value, room);
    });
    dayPaid = money2(dayPaid);
    total += dayPaid;
    days.push({ dayIdx: d, raw: money2(dayRaw), paid: dayPaid });
  }
  return { paid: money2(total), days, overflowChores, freeUsed, freeLeft };
}

/* Personal chores done unasked, for the XP award. Never money. */
function mrPersonalUnaskedCount(weekKey, kid) {
  const e = mrEnsureEarnings(kid, weekKey);
  let n = 0;
  for (let d = 0; d < 7; d++) {
    const day = e.personal[String(d)] || {};
    Object.keys(day).forEach(id => { if (day[id] === 'unasked') n++; });
  }
  return n;
}

/* ── LEARNING ──────────────────────────────────────────────────────
   Bundle-rated: 3 pages of math pays $2, and 4 pages still pays $2 — you're
   paid per completed bundle, not per page, which is what stops the channel
   being open-ended.

   The Sunday check is what makes the claim real. Mom picks 3 items at random;
   anything she can't answer for is VOIDED — those units stop paying and get
   re-queued. Voids are stored separately from units so the original claim
   stays visible rather than being quietly edited away. */
function mrGetLearning(kid, weekKey, dayIdx, itemId) {
  const e = mrEnsureEarnings(kid, weekKey);
  return Number((e.learning[String(dayIdx)] || {})[itemId]) || 0;
}
function mrSetLearning(kid, weekKey, dayIdx, itemId, units) {
  const e = mrEnsureEarnings(kid, weekKey);
  const d = String(dayIdx);
  if (!e.learning[d]) e.learning[d] = {};
  const n = Math.max(0, Number(units) || 0);
  if (n === 0) delete e.learning[d][itemId]; else e.learning[d][itemId] = n;
  mrStampEarnings(kid, weekKey);
  saveAll();
}
function mrGetLearningVoid(kid, weekKey, dayIdx, itemId) {
  const e = mrEnsureEarnings(kid, weekKey);
  if (!e.learningVoid) e.learningVoid = {};
  return Number((e.learningVoid[String(dayIdx)] || {})[itemId]) || 0;
}
/* Fail the Sunday check on an item: void that day's units for it. */
function mrVoidLearning(kid, weekKey, dayIdx, itemId) {
  if (!isParent()) { showToast('Mom runs the Sunday check 🔒'); return; }
  const e = mrEnsureEarnings(kid, weekKey);
  if (!e.learningVoid) e.learningVoid = {};
  const d = String(dayIdx);
  if (!e.learningVoid[d]) e.learningVoid[d] = {};
  e.learningVoid[d][itemId] = mrGetLearning(kid, weekKey, dayIdx, itemId);
  mrStampEarnings(kid, weekKey);
  saveAll();
}
function mrLearningWeek(weekKey, kid) {
  const r = mrRulesForWeek(weekKey);
  const items = (r.learning || {}).items || [];
  let paid = 0, xpLevels = 0;
  const lines = [];
  items.forEach(it => {
    let units = 0, voided = 0;
    for (let d = 0; d < 7; d++) {
      units  += mrGetLearning(kid, weekKey, d, it.id);
      voided += mrGetLearningVoid(kid, weekKey, d, it.id);
    }
    const net = Math.max(0, units - voided);
    if (it.xpOnly) { xpLevels += net; lines.push({ id: it.id, label: it.label, units, voided, net, amount: 0, xp: net }); return; }
    const bundles = Math.floor(net / (Number(it.perUnit) || 1));
    const amount = money2(bundles * (Number(it.amount) || 0));
    paid += amount;
    lines.push({ id: it.id, label: it.label, units, voided, net, bundles, amount });
  });
  return { paid: money2(paid), lines, xpLevels };
}

/* ── STREAK ────────────────────────────────────────────────────────
   A day counts when every routine session is checked. Sick days PAUSE the run
   rather than breaking it — being unwell is not a discipline problem.

   Pays the highest tier reached, not the sum: 7 clean days is $3, not $1+$2+$3.
   The run measured is the longest in the week, so a Sunday miss doesn't erase
   six days that genuinely happened — "3 days in a row" is a thing you either
   did or didn't. */
function mrStreakDayDone(weekKey, kid, dayIdx) {
  return CT_SESSIONS.every(s => ctGetMandatory(weekKey, dayIdx, s, kid));
}
function mrStreakWeek(weekKey, kid) {
  const r = mrRulesForWeek(weekKey);
  const tiers = ((r.streak || {}).tiers || []).slice().sort((a, b) => a.days - b.days);
  let run = 0, best = 0;
  for (let d = 0; d < 7; d++) {
    if (mrIsSick(kid, weekKey, d)) continue;              // paused, not broken
    if (mrStreakDayDone(weekKey, kid, d)) { run++; best = Math.max(best, run); }
    else run = 0;
  }
  let bonus = 0, tier = 0;
  tiers.forEach(t => { if (best >= t.days) { bonus = Number(t.bonus) || 0; tier = t.days; } });
  return { days: best, bonus: money2(bonus), tier };
}

/* ── COMPETITION ───────────────────────────────────────────────────
   Points are uncapped by decision; the dance test is the one exception.
   `awarded` is frozen when the result is entered, so a later rate change can
   never restate a competition that already happened. */
function mrCompetitions(kid) {
  const p = getProfData(kid);
  if (!Array.isArray(p.competitions)) p.competitions = [];
  return p.competitions;
}
/* Pure: what a result is worth under the rules live on its date. */
function mrScoreCompetition(entry, rules) {
  const c = (rules || mrRulesFor(entry.dayKey)).competition || {};
  const pts = Number(entry.points) || 0;
  let total = 0;
  if (entry.sport === 'swim') {
    const s = c.swim || {};
    total += pts * Number(entry.provincial ? s.provincialPerPoint : s.perPoint || 0);
    if (entry.qualified) total += Number(s.qualifyBonus) || 0;
  } else if (entry.sport === 'skate') {
    const s = c.skate || {};
    total += pts * (Number(s.perPoint) || 0);
    const pl = s.placement || {};
    const g = (entry.placement || {}).group, o = (entry.placement || {}).overall;
    if (g && (pl.group || {})[g]) total += Number(pl.group[g]);
    if (o && (pl.overall || {})[o]) total += Number(pl.overall[o]);   // both layers stack
  } else if (entry.sport === 'dance') {
    const s = c.dance || {};
    const di = entry.danceItems || {};
    total += (Number(di.silver) || 0) * (Number(s.silverPerItem) || 0);
    total += (Number(di.gold) || 0) * (Number(s.goldPerItem) || 0);
    if (di.allGold) total += Number(s.allGoldBonus) || 0;
    total = mrApplyCap(total, s.testCap);        // the only competition cap
  }
  return money2(total);
}
function mrAddCompetition(kid, entry) {
  if (!isParent()) { showToast('A grown-up records results 🔒'); return null; }
  const e = {
    id: mrNewId('comp-'), dayKey: entry.dayKey || todayKey(), sport: entry.sport,
    points: Number(entry.points) || 0, placement: entry.placement || {},
    qualified: !!entry.qualified, provincial: !!entry.provincial,
    danceItems: entry.danceItems || {}, personalBest: !!entry.personalBest,
    updatedAt: Date.now(),
  };
  e.awarded = mrScoreCompetition(e, mrRulesFor(e.dayKey));   // frozen at entry
  mrCompetitions(kid).push(e);
  saveAll();
  return e;
}
function mrDeleteCompetition(kid, id) {
  if (!isParent()) { showToast('A grown-up records results 🔒'); return; }
  const p = getProfData(kid);
  p.competitions = mrCompetitions(kid).filter(c => c.id !== id);
  tombstoneIds('comp:', [id]);
  saveAll();
}
function mrCompetitionWeek(weekKey, kid) {
  const info = { keys: [] };
  const mon = formatDayKey(weekKey);
  for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(mon.getDate() + i); info.keys.push(ctDateToKey(d)); }
  const inWeek = mrCompetitions(kid).filter(c => info.keys.includes(c.dayKey));
  return {
    paid: money2(inWeek.reduce((s, c) => s + (Number(c.awarded) || 0), 0)),
    entries: inWeek,
    personalBests: inWeek.filter(c => c.personalBest).length,
  };
}

/* ── FINES, SATURDAY BOX, HONESTY ──────────────────────────────────
   Box first, fine on repeat: leaving something out is boxed, and only a SECOND
   offence for the same item that week also costs money. Once is a mistake,
   twice is a choice — and it keeps one event from carrying two penalties. */
function mrFines(kid) {
  const p = getProfData(kid);
  if (!Array.isArray(p.fines)) p.fines = [];
  return p.fines;
}
function mrBoxItems(kid) {
  const p = getProfData(kid);
  if (!Array.isArray(p.boxItems)) p.boxItems = [];
  return p.boxItems;
}
function mrAddFine(kid, itemId, dayKey) {
  if (!isParent()) { showToast('A grown-up records these 🔒'); return null; }
  const f = { id: mrNewId('fine-'), dayKey: dayKey || todayKey(), itemId, at: Date.now() };
  mrFines(kid).push(f);
  saveAll();
  return f;
}
function mrRemoveFine(kid, id) {
  const p = getProfData(kid);
  p.fines = mrFines(kid).filter(f => f.id !== id);
  tombstoneIds('fine:', [id]);
  saveAll();
}
/* Box an item. If the same label was already boxed this week, that's the
   repeat — box it AND raise the fine named in the rules. */
function mrBoxItem(kid, label, weekKey) {
  if (!isParent()) { showToast('A grown-up fills the box 🔒'); return null; }
  const r = mrRulesForWeek(weekKey);
  const wkKeys = [];
  const mon = formatDayKey(weekKey);
  for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(mon.getDate() + i); wkKeys.push(ctDateToKey(d)); }
  const norm = String(label || '').trim().toLowerCase();
  const priorThisWeek = mrBoxItems(kid).filter(b =>
    wkKeys.includes(b.dayKey) && String(b.label || '').trim().toLowerCase() === norm).length;
  const entry = { id: mrNewId('box-'), label: String(label || '').trim(),
                  dayKey: todayKey(), boxedAt: Date.now(), releasedAt: null,
                  repeat: priorThisWeek > 0 };
  mrBoxItems(kid).push(entry);
  if (entry.repeat) mrAddFine(kid, (r.saturdayBox || {}).repeatFineId || 'box_repeat', entry.dayKey);
  saveAll();
  return entry;
}
function mrReleaseBoxItem(kid, id) {
  if (!isParent()) { showToast('A grown-up opens the box 🔒'); return; }
  const b = mrBoxItems(kid).find(x => x.id === id);
  if (b) { b.releasedAt = Date.now(); saveAll(); }
}

/* Fines for the week, floored so a day can never go negative: a fine can take
   away what was earned that day, but it cannot create debt. */
function mrFinesWeek(weekKey, kid, dayEarnings) {
  const r = mrRulesForWeek(weekKey);
  const cfg = r.fines || {};
  const byId = {};
  (cfg.items || []).forEach(i => { byId[i.id] = Number(i.amount) || 0; });
  const mon = formatDayKey(weekKey);
  const keys = [];
  for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(mon.getDate() + i); keys.push(ctDateToKey(d)); }

  let total = 0;
  const perDay = [];
  keys.forEach((k, d) => {
    const raw = mrFines(kid).filter(f => f.dayKey === k)
      .reduce((s, f) => s + (byId[f.itemId] != null ? byId[f.itemId] : 1), 0);
    const earned = (dayEarnings && dayEarnings[d] != null) ? dayEarnings[d] : 0;
    const applied = cfg.dailyFloorZero ? Math.min(raw, earned) : raw;
    total += applied;
    perDay.push({ dayIdx: d, raw: money2(raw), applied: money2(applied) });
  });
  return { total: money2(total), perDay };
}

/* Honesty ladder: warning → that channel's week → choice privileges. The step
   is derived from how many strikes are already on record, so it escalates on
   its own rather than needing anyone to remember where they were. */
function mrHonestyStrikes(kid) {
  const p = getProfData(kid);
  if (!Array.isArray(p.honesty)) p.honesty = [];
  return p.honesty;
}
function mrRecordHonesty(kid, channel, note) {
  if (!isParent()) { showToast('A grown-up records this 🔒'); return null; }
  const r = mrRules();
  const steps = (r.honesty || {}).steps || [];
  const step = Math.min(mrHonestyStrikes(kid).length + 1, steps.length || 3);
  const entry = { id: mrNewId('hon-'), at: Date.now(), channel: channel || 'chores',
                  step, note: note || '' };
  mrHonestyStrikes(kid).push(entry);
  saveAll();
  return entry;
}
/* Step 2 voids a channel for the week; step 3 also withdraws the kid's choices. */
function mrHonestyEffect(kid, weekKey) {
  const mon = formatDayKey(weekKey);
  const keys = [];
  for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(mon.getDate() + i); keys.push(ctDateToKey(d)); }
  const thisWeek = mrHonestyStrikes(kid).filter(h => keys.includes(ctDateToKey(new Date(h.at))));
  const voided = {};
  let losesChoices = false;
  thisWeek.forEach(h => {
    if (h.step >= 2) voided[h.channel] = true;
    if (h.step >= 3) losesChoices = true;
  });
  return { voidedChannels: voided, losesChoices, strikes: mrHonestyStrikes(kid).length };
}

/* ── THE WEEK ──────────────────────────────────────────────────────
   Every channel, in the order the rulebook names them, then fines. */
function mrWeekBreakdown(weekKey, kid) {
  const chores = mrChoreWeek(weekKey, kid);
  const learning = mrLearningWeek(weekKey, kid);
  const streak = mrStreakWeek(weekKey, kid);
  const comp = mrCompetitionWeek(weekKey, kid);
  const honesty = mrHonestyEffect(kid, weekKey);

  // A step-2 honesty strike zeroes the channel it was claimed on.
  const chorePaid = honesty.voidedChannels.chores ? 0 : chores.paid;
  const learnPaid = honesty.voidedChannels.learning ? 0 : learning.paid;
  const compPaid  = honesty.voidedChannels.competition ? 0 : comp.paid;

  // Fines are floored against what was actually earned that day.
  const dayEarnings = chores.days.map(d => d.paid);
  const fines = mrFinesWeek(weekKey, kid, dayEarnings);

  const gross = money2(chorePaid + learnPaid + streak.bonus + compPaid);
  const net = money2(Math.max(0, gross - fines.total));
  return { chores, learning, streak, comp, fines, honesty, gross, net,
           chorePaid, learnPaid, compPaid };
}
function mrWeekMoney(weekKey, kid) {
  return mrWeekBreakdown(weekKey, kid).net;
}

/* Inert in the browser; lets tests/rules.test.js exercise the pure helpers. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MR_DEFAULT_RULES, MR_REASONS, MR_DEFAULT_REASON,
    MR_HOUSEHOLD_CHORES, MR_PERSONAL_CHORES, mrGetPath, mrSetPath, mrApplyCap };
}
