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
/* A pool row says what a chore IS — its name, which lane it belongs to, when in
   the day it's due, and who it's for. It deliberately does NOT say which day it
   happens: that is the weekly planner's job, and a chore reaches a kid's day
   only because a House-Chore block there tags it. Keeping the two apart is what
   lets the week grid grey out a day and mean it — a chore can't be judged on a
   day it was never planned for. */
const MR_HOUSEHOLD_CHORES = [
  { id: 'dishes',   icon: '🍴', label: 'Dishes & dishwasher',   deadline: 'before you leave the kitchen', due: '19:30', who: 'both', lane: 'chores' },
  { id: 'mop',      icon: '🧽', label: 'Mop',                   deadline: 'before dinner',                due: '17:30', who: 'both', lane: 'chores' },
  { id: 'vacuum',   icon: '🌀', label: 'Vacuum',                deadline: 'before dinner',                due: '17:30', who: 'both', lane: 'chores' },
  { id: 'laundry',  icon: '🧺', label: 'Laundry',               deadline: 'before bed',                   due: '20:00', who: 'both', lane: 'chores' },
  { id: 'sorting',  icon: '👕', label: 'Sorting clothes',       deadline: 'before bed',                   due: '20:00', who: 'both', lane: 'chores' },
  { id: 'bins',     icon: '🗑️', label: 'Bins out',              deadline: 'before dinner',                due: '17:30', who: 'both', lane: 'chores' },
  { id: 'table',    icon: '🍽️', label: 'Set & clear the table', deadline: 'before dinner',                due: '17:30', who: 'both', lane: 'chores' },
];
/* Only `chores` is checked and paid. The other two are day-scoped standing
   responsibilities that earn XP — they need no planner block to appear. */
const MR_LANES = [
  { id: 'chores',  label: 'Chores',          paid: true,  needsBlock: true  },
  { id: 'own',     label: 'Your own things', paid: false, needsBlock: false },
  { id: 'helping', label: 'Helping out',     paid: false, needsBlock: false },
];
const MR_BEDTIME_MIN = 20 * 60 + 30;   // 8:30pm — nothing can be due after it
const MR_PERSONAL_CHORES = [
  { id: 'bed',      icon: '🛏️', label: 'Make your bed' },
  { id: 'room',     icon: '🧸', label: 'Tidy your room' },
  { id: 'schoolbag',icon: '🎒', label: 'Pack your school bag' },
  { id: 'gear',     icon: '🥋', label: 'Pack your sports gear' },
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
  // Released at the Sunday family meeting, so getting your things back is part
  // of the same sit-down that settles the week.
  sundayBox: {
    releaseDay: 'sunday',
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
      // Attitude at training is XP only, never money — how you turn up isn't
      // something to be paid for, but it is something worth counting.
      { id: 'training_attitude', label: 'Turning up well at training', xp: 10 },
    ],
    /* A name for where she is, so a level number means something out loud.
       Highest tier whose `level` she has reached. */
    tiers: [
      { level: 1,  name: 'Starter' },
      { level: 3,  name: 'Steady' },
      { level: 5,  name: 'Reliable' },
      { level: 8,  name: 'Trusted' },
      { level: 12, name: 'Captain' },
    ],
    /* What XP buys. Deliberately never money — these are things a grown-up
       grants, which is the whole point of a second currency. */
    privileges: [
      { id: 'bedtime',  label: 'Pick Friday bedtime — half an hour later', levelReq: 2 },
      { id: 'music',    label: 'Choose the music in the car',              levelReq: 3 },
      { id: 'seat',     label: 'Front seat for a week',                    levelReq: 5 },
      { id: 'friend',   label: 'A friend over on a school night',          levelReq: 8 },
      { id: 'dayout',   label: 'Pick where we go on a Saturday',           levelReq: 12 },
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

  /* What she can put money into. A fixed menu, never a text box: choosing a
     company by name is the lesson, and a search field is a casino. */
  investing: { fund: 'index' },

  /* What money buys.

     "$80" means nothing to a nine-year-old. "Dinner out for all of us" means
     something, and the two are the same fact. Every big number on a kid page
     gets translated into these, so saving up for something has a size she can
     picture rather than a figure she is told to care about.

     Prices are deliberately family-specific and parent-editable — the point is
     that they are things SHE has seen the family buy. */
  buys: {
    // `plural` is carried explicitly because English will not be guessed at:
    // "3 dinner out for all of uses" is what naive pluralisation produces.
    items: [
      { id: 'icecream', label: 'an ice-cream cone',        plural: 'ice-cream cones',   amount: 6 },
      { id: 'milk',     label: 'a jar of milk',            plural: 'jars of milk',      amount: 8 },
      { id: 'sharpen',  label: 'a skate sharpening',       plural: 'skate sharpenings', amount: 12 },
      { id: 'movie',    label: 'a movie ticket',           plural: 'movie tickets',     amount: 14 },
      { id: 'burger',   label: 'a burger meal',            plural: 'burger meals',      amount: 15 },
      { id: 'book',     label: 'a new book',               plural: 'new books',         amount: 20 },
      { id: 'plush',    label: 'a big plush toy',          plural: 'big plush toys',    amount: 35 },
      { id: 'pizza',    label: 'a pizza night at home',    plural: 'pizza nights',      amount: 40 },
      { id: 'dinner',   label: 'dinner out for all of us', plural: 'dinners out',       amount: 80 },
      { id: 'game',     label: 'a new video game',         plural: 'new video games',   amount: 90 },
    ],
  },

  /* Money school opens as the debt comes down. A parent can float a kid to a
     later stage when the conversation gets there before the loan does. */
  school: { unlockStage: { jenn: 0, jess: 0 } },

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
      effectiveFrom: c.programStartDate || ctThisWeekKey(),
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
    // `label` is what the editor called this field on screen. A history that
    // reads "chores.grade.3" is a history nobody checks; "On time and to
    // standard" is one a parent can actually scan six months later.
    applied.push({ path: ch.path, from: before, to: ch.value, label: ch.label || null });
  });
  if (!applied.length) return null;

  const now = Date.now();
  // Editing a version already effective today REPLACES it rather than stacking
  // a second same-day version — otherwise nudging one number three times leaves
  // three versions all effective today, and the tie-break decides the winner.
  let version;
  // ...except the EARLIEST version, which is never replaced in place.
  //
  // mrVersionForDate falls back to vs[0] for any date before the first version
  // exists, so vs[0] is what every pre-programme week reads. Rewriting it turns
  // a price change into a retroactive one — the exact thing this whole
  // versioning scheme exists to prevent ("edit a price in March and every week
  // back to January would restate itself"). It only bites when a parent edits a
  // price on the day the programme starts, because that is the one day the seed
  // version is also "effective today" — which made this a bug that appeared on
  // Mondays and vanished by Tuesday.
  //
  // Cost of the exception: several edits on day one leave several versions
  // rather than one. The later one still wins (mrVersionForDate takes the last
  // match), and a history that records each change is not the worse outcome.
  const isSeed = base && mrVersions()[0] === base;
  if (base && base.effectiveFrom === from && !isSeed) {
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
    reason: reason || MR_DEFAULT_REASON, note: a.label || note || '',
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
  if (!c.moneyModelStartWeek) c.moneyModelStartWeek = ctThisWeekKey();
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
  /* What SHE says happened, kept strictly apart from what Mom graded. A claim
     never touches money — mrChoreWeek reads `chores` and nothing else. The two
     living in separate maps is what lets one week cell carry both answers
     without either being mistaken for the other. */
  if (!e.claims) e.claims = {};       // {[dayIdx]: {[choreId]: quality 1..3}}
  if (!e.attitude) e.attitude = {};   // {[dayIdx]: {self:1..5, parent:1..5}} — XP only
  if (!e.personal) e.personal = {};   // {[dayIdx]: {[choreId]: 'done'|'unasked'}}
  if (!e.learning) e.learning = {};   // filled in by a later step
  if (!e.sick) e.sick = {};           // {[dayIdx]: true} — pauses everything
  if (!e.overrides) e.overrides = {}; // {[channel]: {value, reason, at}} — set at the meeting
  if (!Array.isArray(e.missing)) e.missing = [];   // channels the planner has nothing for
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
  // When it was answered, so the kid's tab can show her what is new since she
  // last looked. Without this she claims into silence: she has to re-open the
  // tab and re-read every row to find out whether anything was decided.
  if (!e.gradedAt) e.gradedAt = {};
  if (!e.gradedAt[d]) e.gradedAt[d] = {};
  // syncNow, not Date.now: this stamp is written on the parent's device and read
  // on the kid's, so the two clocks have to be compared on the same footing. A
  // parent phone running a few seconds behind the iPad would stamp a grade that
  // looks older than the kid's last visit, and mrNewlyGraded would never show it
  // — the silence this field exists to prevent.
  if (g === 0) delete e.gradedAt[d][choreId]; else e.gradedAt[d][choreId] = syncNow();
  mrStampEarnings(kid, weekKey);
  saveAll();
  return true;
}
function mrGradedAt(kid, weekKey, dayIdx, choreId) {
  const e = mrEnsureEarnings(kid, weekKey);
  return Number(((e.gradedAt || {})[String(dayIdx)] || {})[choreId]) || 0;
}
/* ── What she hasn't seen yet ──
   Two halves of the same loop: what is still with Mom, and what came back
   while she wasn't looking. Both read from records that already exist. */
function mrWaitingCount(kid, weekKey) {
  return mrClaimQueue(weekKey, kid).length;
}
function mrFirstWaitingDay(kid, weekKey) {
  const q = mrClaimQueue(weekKey, kid);
  return q.length ? q[0].dayIdx : null;
}
function mrLastGradeSeen(kid) {
  const pr = getProfData(kid).progress || {};
  return Number(pr.lastGradeSeen) || 0;
}
function mrNewlyGraded(kid, weekKey) {
  const since = mrLastGradeSeen(kid);
  const e = mrEnsureEarnings(kid, weekKey);
  const out = [];
  Object.keys(e.gradedAt || {}).forEach(d => {
    Object.keys(e.gradedAt[d] || {}).forEach(id => {
      if (e.gradedAt[d][id] > since) out.push({ dayIdx: Number(d), choreId: id });
    });
  });
  return out;
}
/* Stamped when the kid's own tab renders — a parent looking at her screen must
   not consume her "new" markers, or she never sees them. */
function mrMarkGradesSeen(kid) {
  if (isParent()) return;
  const pd = getProfData(kid);
  if (!pd.progress) pd.progress = {};
  pd.progress.lastGradeSeen = syncNow();   // same clock as gradedAt, see mrSetChoreGrade
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
/* ── THE CHORE POOL: what a chore is ───────────────────────────────
   Rows are read through mrNormalizePoolRow so a row stored before the lane /
   due / who fields existed still resolves. Nothing here knows about days. */
function mrNormalizePoolRow(row) {
  if (!row) return null;
  const lane = MR_LANES.some(l => l.id === row.lane) ? row.lane : 'chores';
  const who = (row.who === 'jenn' || row.who === 'jess') ? row.who : 'both';
  return { id: row.id, label: row.label || row.id, lane, who,
           icon: row.icon || (lane === 'chores' ? '🧺' : '⭐'),
           due: row.due || null, deadline: row.deadline || '' };
}
function mrPoolRows(weekKey) {
  return ((mrRulesForWeek(weekKey) || {}).chorePool || []).map(mrNormalizePoolRow).filter(Boolean);
}
function mrPoolRow(id, weekKey) {
  return mrPoolRows(weekKey).find(r => r.id === id) || null;
}
function mrLane(id) { return MR_LANES.find(l => l.id === id) || MR_LANES[0]; }
function mrLanePays(id) { return !!mrLane(id).paid; }

/* ── Clock times ──
   A due time is a real time of day, and bedtime is a wall the rules put there:
   nothing can be due after 8:30pm, because a chore due after bedtime is a chore
   she is set up to fail. */
function mrParseClock(s) {
  const t = String(s == null ? '' : s).trim().toLowerCase();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (!(h >= 0 && h <= 23) || !(min >= 0 && min <= 59)) return null;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23) return null;
  return h * 60 + min;
}
function mrFormatClock(mins) {
  if (mins == null) return '';
  const h24 = Math.floor(mins / 60), m = mins % 60;
  const ap = h24 >= 12 ? 'pm' : 'am';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return m ? `${h}:${String(m).padStart(2, '0')}${ap}` : `${h}${ap}`;
}
function mrDueMinutes(row) { return row ? mrParseClock(row.due) : null; }
/* What to print. A real clock time wins; the prose deadline is the fallback so
   rows written before due times existed still read as something. */
function mrDueLabel(row) {
  const mins = mrDueMinutes(row);
  if (mins != null) return mrFormatClock(mins);
  return (row && row.deadline) || '—';
}
function mrDueIsValid(s) {
  const mins = mrParseClock(s);
  return mins != null && mins <= MR_BEDTIME_MIN;
}

/* ── THE PLANNER SEAM: which day a chore is on ─────────────────────
   Planner blocks tag chores by NAME (`choreTags: ['Mop']`) while the pool is
   keyed by id ('mop') — two vocabularies for one thing, harmless until the
   planner became the only way a chore reaches a day. Resolve by id first, then
   by folded label, so every tag written before this still lands on its row. */
function mrFoldName(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '');
}
function mrPoolRowForTag(tag, weekKey) {
  const rows = mrPoolRows(weekKey);
  const raw = String(tag == null ? '' : tag).trim();
  if (!raw) return null;
  const byId = rows.find(r => r.id === raw);
  if (byId) return byId;
  const folded = mrFoldName(raw);
  return rows.find(r => mrFoldName(r.id) === folded)
      || rows.find(r => mrFoldName(r.label) === folded)
      || null;
}
/* Every chore tag the planner put on this kid's day, in block order. */
function mrChoreTagsForDay(kid, weekKey, dayIdx) {
  const keys = (typeof mrWeekDayKeys === 'function') ? mrWeekDayKeys(weekKey) : [];
  const dayKey = keys[dayIdx];
  if (!dayKey) return [];
  const out = [];
  (getDayBlocks(dayKey, kid) || []).forEach(b => {
    if (b.actId !== 'chores') return;
    const tags = (Array.isArray(b.choreTags) && b.choreTags.length)
      ? b.choreTags
      : (b.choreTag ? [b.choreTag] : []);
    tags.filter(Boolean).forEach(t => out.push({ tag: t, blockId: b.id }));
  });
  return out;
}
/* THE reader every chore surface uses.

   `chores`-lane rows appear only where the planner scheduled them. `own` and
   `helping` rows are standing responsibilities — they need no block and show
   every day, which is how personal chores have always behaved.

   Unresolvable tags are returned rather than dropped: a tag pointing at no pool
   row is a real setup mistake, and silently hiding it would leave a kid doing
   work the app never counts. */
function mrChoresForDay(kid, weekKey, dayIdx) {
  const forKid = r => r.who === 'both' || r.who === kid;
  const rows = [], unresolved = [], seen = new Set();
  mrChoreTagsForDay(kid, weekKey, dayIdx).forEach(({ tag, blockId }) => {
    const row = mrPoolRowForTag(tag, weekKey);
    if (!row) { if (!unresolved.includes(tag)) unresolved.push(tag); return; }
    if (!forKid(row) || seen.has(row.id)) return;
    seen.add(row.id);
    rows.push({ row, tag, blockId, scheduled: true });
  });
  mrPoolRows(weekKey).forEach(row => {
    if (mrLane(row.lane).needsBlock || seen.has(row.id) || !forKid(row)) return;
    seen.add(row.id);
    rows.push({ row, tag: row.id, blockId: null, scheduled: false });
  });
  // A chore that was DONE but never planned. The pool/planner rule ("the pool
  // says what a chore is; the planner says when") is right about what the app
  // expects and wrong about what happens — she mops without being asked, and
  // this reader had no way to represent that, so the work was uncountable and
  // unpayable. A claim or a grade on the day is evidence enough that it
  // happened; nothing is paid until a grown-up grades it either way.
  const e = mrEnsureEarnings(kid, weekKey);
  const d = String(dayIdx);
  new Set([...Object.keys(e.claims[d] || {}), ...Object.keys(e.chores[d] || {})]).forEach(id => {
    if (seen.has(id)) return;
    const row = mrPoolRow(id, weekKey);
    if (!row || !forKid(row)) return;
    seen.add(id);
    rows.push({ row, tag: id, blockId: null, scheduled: false, unplanned: true });
  });
  rows.sort((a, b) => {
    const da = mrDueMinutes(a.row), db = mrDueMinutes(b.row);
    if (da != null && db != null && da !== db) return da - db;
    if ((da == null) !== (db == null)) return da == null ? 1 : -1;
    return a.row.label < b.row.label ? -1 : a.row.label > b.row.label ? 1 : 0;
  });
  return { rows, unresolved };
}
/* Every planner tag this week that lands on no pool row — surfaced in the
   parent's setup screen so it can be fixed rather than quietly costing money. */
function mrUnresolvedTags(weekKey) {
  const out = [];
  ['jenn', 'jess'].forEach(kid => {
    for (let d = 0; d < 7; d++) {
      mrChoresForDay(kid, weekKey, d).unresolved.forEach(t => {
        if (!out.some(x => x.tag === t && x.kid === kid)) out.push({ tag: t, kid, dayIdx: d });
      });
    }
  });
  return out;
}

/* ── CLAIMS: what she says happened ────────────────────────────────
   A claim is an answer, not a payment. It rings the cell; only a grade fills
   it. Mom can agree, change it, or leave it — and until she does, the chore
   sits in her queue. */
function mrGetClaim(kid, weekKey, dayIdx, choreId) {
  const e = mrEnsureEarnings(kid, weekKey);
  return Number((e.claims[String(dayIdx)] || {})[choreId]) || 0;
}
function mrSetClaim(kid, weekKey, dayIdx, choreId, quality) {
  // A kid may only ever answer for her own week. Parents claim on her behalf
  // (she told them at the door), which is why this isn't parent-only.
  if (!isParent() && kid !== activeProfile()) {
    showToast('That’s not your week 🔒');
    return false;
  }
  const e = mrEnsureEarnings(kid, weekKey);
  const d = String(dayIdx);
  if (!e.claims[d]) e.claims[d] = {};
  const q = Math.max(0, Math.min(3, Number(quality) || 0));
  if (q === 0) delete e.claims[d][choreId]; else e.claims[d][choreId] = q;
  mrStampEarnings(kid, weekKey);
  saveAll();
  return true;
}
/* Claimed but not yet graded — the parent's "waiting on you" list. Ordered by
   day then due time so the oldest thing owed an answer is first. */
function mrClaimQueue(weekKey, kid) {
  const e = mrEnsureEarnings(kid, weekKey);
  const out = [];
  for (let d = 0; d < 7; d++) {
    const claims = e.claims[String(d)] || {};
    Object.keys(claims).forEach(choreId => {
      if (mrGetChoreGrade(kid, weekKey, d, choreId) > 0) return;   // already answered
      const row = mrPoolRow(choreId, weekKey);
      out.push({ kid, dayIdx: d, choreId, claim: Number(claims[choreId]) || 0, row });
    });
  }
  return out.sort((a, b) => a.dayIdx - b.dayIdx
    || ((mrDueMinutes(a.row) ?? 9999) - (mrDueMinutes(b.row) ?? 9999)));
}

/* ── TRAINING ATTITUDE: XP only, never money ───────────────────────
   She rates herself, Mom rates her, and the gap between the two is the part
   worth talking about. Both are 1..5; the average earns XP per rated session. */
function mrGetAttitude(kid, weekKey, dayIdx) {
  const a = mrEnsureEarnings(kid, weekKey).attitude[String(dayIdx)] || {};
  return { self: Number(a.self) || 0, parent: Number(a.parent) || 0 };
}
function mrSetAttitude(kid, weekKey, dayIdx, who, n) {
  if (who === 'parent' && !isParent()) { showToast('Mom sets that one 🔒'); return false; }
  if (who === 'self' && !isParent() && kid !== activeProfile()) return false;
  const e = mrEnsureEarnings(kid, weekKey);
  const d = String(dayIdx);
  if (!e.attitude[d]) e.attitude[d] = {};
  const v = Math.max(0, Math.min(5, Number(n) || 0));
  if (v === 0) delete e.attitude[d][who]; else e.attitude[d][who] = v;
  if (!Object.keys(e.attitude[d]).length) delete e.attitude[d];
  mrStampEarnings(kid, weekKey);
  saveAll();
  return true;
}
/* A session counts once both people have answered — one rating on its own is
   half a conversation, and paying XP for it would reward self-rating alone. */
function mrAttitudeWeek(weekKey, kid) {
  const days = [];
  for (let d = 0; d < 7; d++) {
    const a = mrGetAttitude(kid, weekKey, d);
    if (!a.self && !a.parent) continue;
    const rated = a.self > 0 && a.parent > 0;
    days.push({ dayIdx: d, self: a.self, parent: a.parent, rated,
                avg: rated ? Math.round((a.self + a.parent) / 2 * 10) / 10 : 0,
                gap: rated ? a.self - a.parent : 0 });
  }
  const scored = days.filter(d => d.rated);
  const avg = scored.length
    ? Math.round(scored.reduce((s, d) => s + d.avg, 0) / scored.length * 10) / 10 : 0;
  return { days, sessions: scored.length, avg };
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

   Which chores are free is NOT chronological. Grades pay differently ($3 / $2
   / $1), so taking the first two of the week would mean a kid who does two
   sloppy grade-1 chores on Monday keeps her grade-3 work and earns more than
   one who did her best work first. That is exactly backwards.

   "You pick them" is therefore resolved as the arrangement she would pick:
   the free slots land on her LOWEST-paying graded chores, so she keeps the
   most money and there is no reward for starting the week badly.

   At honesty step 3 the pick is withdrawn (see mrHonestyEffect). The free
   slots then land on her highest-paying chores instead — the privilege is the
   choice, and losing it has a price.

   Returns the paid total plus the per-day breakdown and the count of chores
   that fell entirely past the cap (those earn XP instead — credited at the
   family meeting, so a re-render can never double-award). */
function mrChoreWeek(weekKey, kid) {
  const r = mrRulesForWeek(weekKey);
  const cfg = r.chores || {};
  const pay = cfg.grade || {};
  const dailyCap = cfg.dailyCap;
  const freeCount = Number(cfg.freeChoresPerWeek) || 0;
  const pickWithdrawn = !!mrHonestyEffect(kid, weekKey).losesChoices;

  // Every graded chore of the week, with what it would pay.
  const all = [];
  for (let d = 0; d < 7; d++) {
    const graded = mrEnsureEarnings(kid, weekKey).chores[String(d)] || {};
    Object.keys(graded).sort().forEach(choreId => {
      const g = Number(graded[choreId]) || 0;
      if (g <= 0) return;
      all.push({ dayIdx: d, choreId, grade: g, value: Number(pay[g]) || 0 });
    });
  }

  // Cheapest-first is her best arrangement; step 3 flips it to dearest-first.
  // Day and id break ties so the same week always resolves identically.
  const ranked = all.slice().sort((a, b) =>
    (pickWithdrawn ? b.value - a.value : a.value - b.value)
    || a.dayIdx - b.dayIdx
    || (a.choreId < b.choreId ? -1 : a.choreId > b.choreId ? 1 : 0));
  const freeUsed = ranked.slice(0, freeCount);
  const isFree = {};
  freeUsed.forEach(f => { isFree[f.dayIdx + '|' + f.choreId] = true; });

  const days = [];
  let total = 0, overflowChores = 0;
  for (let d = 0; d < 7; d++) {
    let dayPaid = 0, dayRaw = 0;
    all.filter(c => c.dayIdx === d).forEach(c => {
      if (isFree[c.dayIdx + '|' + c.choreId]) return;
      dayRaw += c.value;
      const room = (dailyCap == null) ? c.value : Math.max(0, dailyCap - dayPaid);
      if (room <= 0) { overflowChores++; return; }   // nothing left today → XP
      dayPaid += Math.min(c.value, room);
    });
    dayPaid = money2(dayPaid);
    total += dayPaid;
    days.push({ dayIdx: d, raw: money2(dayRaw), paid: dayPaid });
  }
  return { paid: money2(total), days, overflowChores, freeUsed,
           freeLeft: Math.max(0, freeCount - freeUsed.length), pickWithdrawn };
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
    // The meet's own name and date: "3 pts, skate" is not something anyone can
    // check against a results sheet six months later.
    name: String(entry.name || '').trim(),
    points: Number(entry.points) || 0, placement: entry.placement || {},
    qualified: !!entry.qualified, provincial: !!entry.provincial,
    danceItems: entry.danceItems || {}, personalBest: !!entry.personalBest,
    updatedAt: syncNow(),
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

/* The box config. Rule versions saved before the box moved to Sunday still
   carry the old `saturdayBox` key, and past versions are immutable by design,
   so both names are read. */
function mrBoxCfg(r) {
  const rules = r || mrRules();
  return rules.sundayBox || rules.saturdayBox || {};
}

/* ── FINES, SUNDAY BOX, HONESTY ────────────────────────────────────
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
  if (entry.repeat) mrAddFine(kid, mrBoxCfg(r).repeatFineId || 'box_repeat', entry.dayKey);
  saveAll();
  return entry;
}
/* Early release. The rulebook price for getting something back before Sunday is
   one unpaid job chosen by Mom, so the release records WHY it happened —
   otherwise an early release is indistinguishable from the Sunday one and the
   job quietly becomes optional. */
function mrReleaseBoxItem(kid, id, opts) {
  if (!isParent()) { showToast('A grown-up opens the box 🔒'); return; }
  const o = opts || {};
  const b = mrBoxItems(kid).find(x => x.id === id);
  if (!b) return;
  b.releasedAt = Date.now();
  b.releasedEarly = true;
  b.redemptionJob = o.job ? String(o.job).trim() : '';
  saveAll();
}
/* The Sunday release: everything still in the box comes out when the family
   meeting is recorded. Returns how many items were handed back so the meeting
   recap can say so. Caller saves. */
function mrReleaseBoxForMeeting(kid) {
  const now = Date.now();
  let n = 0;
  mrBoxItems(kid).forEach(b => { if (!b.releasedAt) { b.releasedAt = now; n++; } });
  return n;
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
   its own rather than needing anyone to remember where they were.

   The ladder is counted PER WEEK and resets on Sunday. Counting it over a
   lifetime meant that after three strikes ever, every later strike was step 3
   forever — the rulebook's "until you've earned them back" would have had no
   way to happen. A week is the unit everything else here settles in, so it is
   the unit the ladder resets in too. The strikes themselves are kept forever;
   it is only the escalation that starts again. */
function mrHonestyStrikes(kid) {
  const p = getProfData(kid);
  if (!Array.isArray(p.honesty)) p.honesty = [];
  return p.honesty;
}
/* The Monday-to-Sunday keys of a week — the window the ladder counts in. */
function mrWeekDayKeys(weekKey) {
  const mon = formatDayKey(weekKey);
  const keys = [];
  for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(mon.getDate() + i); keys.push(ctDateToKey(d)); }
  return keys;
}
/* Which day a strike falls on has to be read in the app's timezone, the same
   way mrWeekDayKeys builds the keys it is matched against. Reading the device
   clock instead put a strike on the wrong calendar day for part of every day —
   and outside the week entirely at a week boundary, which silently emptied the
   ladder: three strikes in one evening all counted as step 1 and nothing was
   ever voided. */
function mrHonestyStrikesInWeek(kid, weekKey) {
  const keys = mrWeekDayKeys(weekKey);
  return mrHonestyStrikes(kid).filter(h => keys.includes(toDayKeyInZone(new Date(h.at))));
}
function mrRecordHonesty(kid, channel, note) {
  if (!isParent()) { showToast('A grown-up records this 🔒'); return null; }
  const r = mrRules();
  const steps = (r.honesty || {}).steps || [];
  // The strike's own timestamp decides which week it belongs to, so the step
  // has to be counted in that same week — not in whichever week the chore tab
  // happens to be showing.
  const at = Date.now();
  const wk = ctThisWeekKey();
  const step = Math.min(mrHonestyStrikesInWeek(kid, wk).length + 1, steps.length || 3);
  const entry = { id: mrNewId('hon-'), at, channel: channel || 'chores',
                  step, note: note || '' };
  mrHonestyStrikes(kid).push(entry);
  saveAll();
  return entry;
}
/* Step 2 voids a channel for the week; step 3 also withdraws the kid's choices. */
function mrHonestyEffect(kid, weekKey) {
  const thisWeek = mrHonestyStrikesInWeek(kid, weekKey);
  const voided = {};
  let losesChoices = false;
  thisWeek.forEach(h => {
    if (h.step >= 2) voided[h.channel] = true;
    if (h.step >= 3) losesChoices = true;
  });
  // `strikes` is the count that drives the ladder, so it is the weekly one.
  // The lifetime total is kept alongside it for the Sunday conversation.
  return { voidedChannels: voided, losesChoices,
           strikes: thisWeek.length, strikesAllTime: mrHonestyStrikes(kid).length };
}

/* Has this kid lost her choices this week? Defaults to the live week so the
   surfaces that gate on it (the loan-surplus button, the free-chore pick)
   don't each have to work out which week they're in. */
function mrLosesChoices(kid, weekKey) {
  const wk = weekKey || (typeof ctWeekKey !== 'undefined' && ctWeekKey)
             || ctThisWeekKey();
  if (!mrUsesNewModel(wk)) return false;
  return !!mrHonestyEffect(kid, wk).losesChoices;
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
  let chorePaid = honesty.voidedChannels.chores ? 0 : chores.paid;
  let learnPaid = honesty.voidedChannels.learning ? 0 : learning.paid;
  let compPaid  = honesty.voidedChannels.competition ? 0 : comp.paid;

  // Fines are floored against what was actually earned that day.
  const dayEarnings = chores.days.map(d => d.paid);
  const fines = mrFinesWeek(weekKey, kid, dayEarnings);

  /* ── What a grown-up changed at the meeting ──
     The planner's number is where the conversation starts, not where it ends:
     a chore graded from the wrong room, a page counted twice, an agreed
     exception. An override replaces the channel's figure but keeps the
     original beside it, and it is applied HERE — the one place every surface
     reads from — so the quest strip, the frozen ledger and the year-to-date
     all follow without a second code path. */
  const e = mrEnsureEarnings(kid, weekKey);
  const ov = e.overrides || {};
  const original = { chores: money2(chorePaid), learning: money2(learnPaid),
                     streak: money2(streak.bonus), comp: money2(compPaid),
                     fines: money2(fines.total) };
  let streakBonus = streak.bonus;
  let finesTotal = fines.total;
  if (ov.chores)   chorePaid  = money2(ov.chores.value);
  if (ov.learning) learnPaid  = money2(ov.learning.value);
  if (ov.streak)   streakBonus = money2(ov.streak.value);
  if (ov.comp)     compPaid   = money2(ov.comp.value);
  if (ov.fines)    finesTotal = money2(ov.fines.value);

  const gross = money2(chorePaid + learnPaid + streakBonus + compPaid);
  const net = money2(Math.max(0, gross - finesTotal));
  return { chores, learning, streak, comp, honesty, gross, net,
           chorePaid, learnPaid, compPaid,
           streakBonus, overrides: ov, original,
           fines: Object.assign({}, fines, { total: money2(finesTotal) }) };
}
function mrWeekMoney(weekKey, kid) {
  return mrWeekBreakdown(weekKey, kid).net;
}

/* A frozen copy of a week's breakdown, taken at the family meeting.

   Everything in mrWeekBreakdown is derived — from the rules live today, the
   grades recorded today, the honesty strikes on file today. That is right for
   the current week and wrong for a past one: edit a price in March and every
   week back to January would restate itself. Freezing the numbers at the
   moment they are agreed makes the history an actual ledger, and means the
   Sunday conversation can always be reconstructed exactly as it happened.

   The loan and XP fields are filled in by the meeting once those have run. */
function mrFreezeWeekLedger(weekKey, kid) {
  const b = mrWeekBreakdown(weekKey, kid);
  const v = mrVersionForDate(weekKey) || {};
  return {
    at: Date.now(),
    rulesVersion: v.id || null,
    rulesEffectiveFrom: v.effectiveFrom || null,
    chores: money2(b.chorePaid),
    choresRaw: money2(b.chores.paid),
    freeChores: (b.chores.freeUsed || []).length,
    overflowChores: b.chores.overflowChores || 0,
    pickWithdrawn: !!b.chores.pickWithdrawn,
    learning: money2(b.learnPaid),
    streakDays: b.streak.days || 0,
    streak: money2(b.streakBonus),
    competition: money2(b.compPaid),
    fines: money2(b.fines.total),
    voided: Object.keys(b.honesty.voidedChannels || {}),
    honestyStrikes: b.honesty.strikes || 0,
    // What a grown-up changed, and why — frozen alongside the numbers so the
    // Sunday conversation can be read back exactly as it happened.
    edited: Object.keys(b.overrides || {}),
    editReason: (Object.keys(b.overrides || {}).map(k => b.overrides[k])
                  .filter(o => o && o.reason)
                  .sort((x, y) => (x.at || 0) - (y.at || 0))[0] || {}).reason || null,
    gross: money2(b.gross),
    net: money2(b.net),
    xp: 0, boxReleased: 0, loan: null,
  };
}

/* ── XP ────────────────────────────────────────────────────────────
   XP is the record of everything money doesn't capture — and it's what stops
   the daily cap reading as a hard stop. Work past the cap still counts, it just
   counts as something other than dollars.

   Computed for a week, credited once at the family meeting. Crediting on every
   render would multiply the award by however many times the screen redrew. */
function mrXpAward(rules, id) {
  const a = ((rules.xp || {}).awards || []).find(x => x.id === id);
  return a ? (Number(a.xp) || 0) : 0;
}
function mrXpForWeek(weekKey, kid) {
  const r = mrRulesForWeek(weekKey);
  const chores = mrChoreWeek(weekKey, kid);
  const learning = mrLearningWeek(weekKey, kid);
  const streak = mrStreakWeek(weekKey, kid);
  const comp = mrCompetitionWeek(weekKey, kid);

  const lines = [];
  const add = (id, count) => {
    if (!count) return;
    const each = mrXpAward(r, id);
    if (!each) return;
    const award = ((r.xp || {}).awards || []).find(x => x.id === id);
    lines.push({ id, label: award ? award.label : id, count, each, xp: count * each });
  };
  add('chore_overflow',   chores.overflowChores);
  add('personal_unasked', mrPersonalUnaskedCount(weekKey, kid));
  add('app_level',        learning.xpLevels);
  add('streak_7',         streak.days >= 7 ? 1 : 0);
  add('personal_best',    comp.personalBests);
  // Only sessions BOTH people rated count — see mrAttitudeWeek.
  add('training_attitude', mrAttitudeWeek(weekKey, kid).sessions);
  return { lines, total: lines.reduce((s, l) => s + l.xp, 0) };
}

/* ── XP levels, tiers and what they buy ────────────────────────────
   Levels come from the quest XP already banked in progress.questXP — this puts
   a name and a set of privileges on top of it rather than starting a second,
   competing XP system. */
function mrXpLevelInfo(kid, weekKey) {
  const r = mrRulesForWeek(weekKey || todayKey());
  const perLevel = Number((r.xp || {}).perLevel) || 100;
  const xp = Number((getProfData(kid).progress || {}).questXP) || 0;
  const level = Math.floor(xp / perLevel) + 1;
  const into = xp % perLevel;
  const tiers = ((r.xp || {}).tiers || []).slice().sort((a, b) => a.level - b.level);
  const tier = tiers.filter(t => level >= t.level).pop() || tiers[0] || null;
  return { xp, perLevel, level, into, pct: Math.round(into / perLevel * 100),
           tier: tier ? tier.name : '', toNext: perLevel - into };
}
function mrPrivileges(kid, weekKey) {
  const info = mrXpLevelInfo(kid, weekKey);
  const r = mrRulesForWeek(weekKey || todayKey());
  return ((r.xp || {}).privileges || []).map(p => ({
    id: p.id, label: p.label, levelReq: Number(p.levelReq) || 1,
    unlocked: info.level >= (Number(p.levelReq) || 1),
  }));
}
/* Idempotent per week — a second call for the same week is a no-op, so
   re-recording a meeting can't double-award. */
function mrCreditWeekXp(weekKey, kid) {
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.xpAwardedWeeks) c.xpAwardedWeeks = {};
  if (!c.xpAwardedWeeks[weekKey]) c.xpAwardedWeeks[weekKey] = {};
  if (c.xpAwardedWeeks[weekKey][kid] != null) return 0;      // already credited
  const { total } = mrXpForWeek(weekKey, kid);
  c.xpAwardedWeeks[weekKey][kid] = total;
  if (total > 0) addQuestXP(total, kid);
  return total;
}

/* ── QUARTERLY REVIEW ──────────────────────────────────────────────
   The rulebook promises the numbers get revisited every three months. This
   turns that promise into something the app actually raises, with the real
   earning data beside it so the re-tune isn't guesswork. */
function mrQuarterOf(dayKey) {
  const d = formatDayKey(dayKey || todayKey());
  return d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1);
}
function mrLastReviewedQuarter() {
  ctEnsureShared();
  return state.shared.chore.lastReviewedQuarter || null;
}
function mrQuarterlyDue() {
  return mrLastReviewedQuarter() !== mrQuarterOf(todayKey());
}
function mrMarkQuarterReviewed() {
  if (!isParent()) return;
  ctEnsureShared();
  state.shared.chore.lastReviewedQuarter = mrQuarterOf(todayKey());
  mrLogAppend({ path: 'review.quarter', from: mrLastReviewedQuarter(), to: mrQuarterOf(todayKey()),
                reason: 'quarterly_review', note: 'Quarterly review marked done' });
  saveAll();
}
/* Actual earnings per channel across the finalized weeks, against the annual
   target — the numbers the quarterly re-tune should be argued from. */
function mrYearToDate(kid) {
  ctEnsureShared();
  const fin = state.shared.chore.finalizedWeeks || {};
  const weeks = Object.keys(fin).filter(wk => fin[wk] && fin[wk][kid] != null).sort();
  let paidTotal = 0;
  const channels = { chores: 0, learning: 0, streak: 0, competition: 0, fines: 0 };
  weeks.forEach(wk => {
    paidTotal += Number(fin[wk][kid]) || 0;
    if (!mrUsesNewModel(wk)) return;                 // legacy weeks have no channel split
    const b = mrWeekBreakdown(wk, kid);
    channels.chores      += b.chorePaid;
    channels.learning    += b.learnPaid;
    channels.streak      += b.streakBonus;
    channels.competition += b.compPaid;
    channels.fines       += b.fines.total;
  });
  const target = mrTargetFor(kid);
  const weeksCounted = weeks.length || 1;
  const projected = money2((paidTotal / weeksCounted) * 52);
  return { weeks: weeks.length, paidTotal: money2(paidTotal), channels, target, projected,
           pctOfTarget: target ? Math.round((projected / target) * 100) : 0 };
}

/* Inert in the browser; lets tests/rules.test.js exercise the pure helpers. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MR_DEFAULT_RULES, MR_REASONS, MR_DEFAULT_REASON,
    MR_HOUSEHOLD_CHORES, MR_PERSONAL_CHORES, mrGetPath, mrSetPath, mrApplyCap };
}
