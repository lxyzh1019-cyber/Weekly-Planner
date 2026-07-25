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
      { id: 'math',    label: 'Math homework',        unit: 'pages', perUnit: 3,  amount: 2 },
      { id: 'chinese', label: 'Chinese / handwriting', unit: 'pages', perUnit: 5, amount: 2 },
      { id: 'vocab',   label: 'Vocabulary',           unit: 'words', perUnit: 10, amount: 1 },
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

/* Inert in the browser; lets tests/rules.test.js exercise the pure helpers. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MR_DEFAULT_RULES, MR_REASONS, MR_DEFAULT_REASON,
    MR_HOUSEHOLD_CHORES, MR_PERSONAL_CHORES, mrGetPath, mrSetPath, mrApplyCap };
}
