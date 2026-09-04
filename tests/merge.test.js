// Unit checks for the cloud-sync merge layer in js/04-merge.js.
// Run: node tests/merge.test.js
// They execute the REAL functions the app ships, so they catch regressions
// in deletion tombstones, deep merges, and chore-week conflicts.
// The functions read the app's global `state`, so install a fake one first.
global.state = { shared: { tombstones: {} }, profiles: {} };
const state = global.state;
const api = require('../js/04-merge.js');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name); }
}

// (a) deleted block stays deleted after merging a stale remote copy
state.shared.tombstones = {};
api.tombstoneBlockIds(['b1']);
const mergedW = api.mergeWeeks(
  { d1: [ { id:'b2', startMin: 400 } ] },
  { d1: [ { id:'b1', startMin: 360 }, { id:'b2', startMin: 400 } ] });
check('deleted block not resurrected', mergedW.d1.length === 1 && mergedW.d1[0].id === 'b2');

// (a2) a copy edited AFTER the delete survives
const future = Date.now() + 60000;
check('newer-than-tombstone copy survives',
  api.mergeWeeks({}, { d: [ { id:'b1', updatedAt: future } ] }).d.length === 1);

// (a3) series tombstone kills unseen members
state.shared.tombstones['sr:s1'] = Date.now();
check('series tombstone catches unseen member',
  api.mergeWeeks({}, { d: [ { id:'never-seen', seriesId:'s1' } ] }).d.length === 0);

// (a4) tombstones merge by max timestamp
state.shared.tombstones = { x: 100 };
api.mergeTombstones({ x: 200, y: 50 });
check('tombstone max merge', state.shared.tombstones.x === 200 && state.shared.tombstones.y === 50);

// (b) chore checks from both devices survive
const mc = api.mergeChoreState(
  { optionalByWeek:{ w1: { '0': { Mop:true } } }, updatedAtByWeek:{} },
  { optionalByWeek:{ w1: { '1': { Vacuum:true } } }, updatedAtByWeek:{} });
check('chore checks union', mc.optionalByWeek.w1['0'].Mop === true && mc.optionalByWeek.w1['1'].Vacuum === true);

// (c) newer uncheck beats stale check (both directions)
const lc2 = { optionalByWeek:{ w1: { '0': { Mop:false } } }, updatedAtByWeek:{ w1: 2000 } };
const rc2 = { optionalByWeek:{ w1: { '0': { Mop:true } } },  updatedAtByWeek:{ w1: 1000 } };
check('newer uncheck wins (local newer)', api.mergeChoreState(lc2, rc2).optionalByWeek.w1['0'].Mop === false);
check('newer uncheck wins (remote newer)', api.mergeChoreState(rc2, lc2).optionalByWeek.w1['0'].Mop === false);

// (d) remote profile with stale nested data doesn't wipe local keys
const mp = api.mergeProfileState(
  { progress: { restDays: { k: true }, streaks: { a: 3 } }, wallet: { cash: 5, savings: 2 } },
  { progress: { streaks: { b: 1 } }, wallet: { cash: 7 } });
check('local restDays preserved', mp.progress.restDays && mp.progress.restDays.k === true);
check('remote leaf wins where present', mp.wallet.cash === 7 && mp.wallet.savings === 2);
check('streaks union', mp.progress.streaks.a === 3 && mp.progress.streaks.b === 1);

// (e) share move sticks: tombstoned in old collection, alive in new one
state.shared.tombstones = { 'sa:custom-x': 6000 };
const outSA = api.mergeArrayById([], [ { id:'custom-x', updatedAt: 5000 }, { id:'other', updatedAt: 1 } ], 'sa:');
check('moved activity gone from old collection', outSA.length === 1 && outSA[0].id === 'other');
check('moved activity alive in new collection',
  api.mergeArrayById([{ id:'custom-x', updatedAt: 5000 }], [], 'ca:jenn:').length === 1);

// (f) shared-activity edits merge by id (newest copy wins)
const outEdit = api.mergeArrayById(
  [ { id:'a1', name:'NEW', updatedAt: 9000 } ],
  [ { id:'a1', name:'old', updatedAt: 100 }, { id:'a2', name:'B', updatedAt: 100 } ], 'sa:');
check('newer shared-activity edit wins', outEdit.find(a=>a.id==='a1').name === 'NEW' && outEdit.length === 2);

// (g) deleted custom task stays deleted
state.shared.tombstones['task:t-1'] = 7000;
check('deleted task stays deleted', api.mergeArrayById([], [ { id:'t-1' } ], 'task:').length === 0);

// (h) shared.chore: concurrent group adds on two devices both survive
state.shared.tombstones = {};
const scAdd = api.mergeSharedChore(
  { groups: [ { id:'g1', name:'Kitchen', updatedAt: 100 } ] },
  { groups: [ { id:'g2', name:'Yard', updatedAt: 100 } ] });
check('shared.chore concurrent group adds both survive',
  scAdd.groups.length === 2 && scAdd.groups.some(g=>g.id==='g1') && scAdd.groups.some(g=>g.id==='g2'));

// (h2) newer group edit wins over stale copy
const scEdit = api.mergeSharedChore(
  { groups: [ { id:'g1', valueDollars: 5, updatedAt: 9000 } ] },
  { groups: [ { id:'g1', valueDollars: 1, updatedAt: 100 } ] });
check('shared.chore newer group edit wins', scEdit.groups.find(g=>g.id==='g1').valueDollars === 5);

// (h3) deleted group stays deleted via 'grp:' tombstone
state.shared.tombstones = {}; api.tombstoneIds('grp:', ['g9']);
const scDel = api.mergeSharedChore({ groups: [] }, { groups: [ { id:'g9', name:'gone' } ] });
check('shared.chore deleted group stays deleted', scDel.groups.length === 0);

// (h4) newer weekly goal wins (both directions); older edit doesn't clobber
state.shared.tombstones = {};
const gl = { goalsByWeek:{ w1:{ jenn:15, jess:null } }, goalsUpdatedAtByWeek:{ w1: 2000 } };
const gr = { goalsByWeek:{ w1:{ jenn:20, jess:null } }, goalsUpdatedAtByWeek:{ w1: 1000 } };
check('shared.chore newer goal wins (local newer)',
  api.mergeSharedChore(gl, gr).goalsByWeek.w1.jenn === 15);
check('shared.chore newer goal wins (remote newer)',
  api.mergeSharedChore(gr, gl).goalsByWeek.w1.jenn === 15);

// (h5) additive maps (goalBonusByWeek) still union across devices
const scBonus = api.mergeSharedChore(
  { goalBonusByWeek:{ w1:{ jenn:true } } },
  { goalBonusByWeek:{ w1:{ jess:true } } });
check('shared.chore goalBonusByWeek union',
  scBonus.goalBonusByWeek.w1.jenn === true && scBonus.goalBonusByWeek.w1.jess === true);

// ── (i) money rules: effective-dated versions + grow-only audit log ──
state.shared.tombstones = {};

// (i1) two parents each add a rule version on their own device — both survive.
// A lost version here would silently revert a rule change.
const mrAdd = api.mergeSharedChore(
  { moneyRules: { versions: [ { id:'mrv1', effectiveFrom:'2026-07-27', updatedAt: 100 } ], log: {} } },
  { moneyRules: { versions: [ { id:'mrv2', effectiveFrom:'2026-09-04', updatedAt: 100 } ], log: {} } });
check('moneyRules concurrent version adds both survive',
  mrAdd.moneyRules.versions.length === 2
  && mrAdd.moneyRules.versions.some(v=>v.id==='mrv1')
  && mrAdd.moneyRules.versions.some(v=>v.id==='mrv2'));

// (i2) same version edited on both devices — newest updatedAt wins
const mrEdit = api.mergeSharedChore(
  { moneyRules: { versions: [ { id:'mrv1', rules:{ chores:{ dailyCap: 4 } }, updatedAt: 9000 } ] } },
  { moneyRules: { versions: [ { id:'mrv1', rules:{ chores:{ dailyCap: 3 } }, updatedAt: 100 } ] } });
check('moneyRules newer version edit wins',
  mrEdit.moneyRules.versions.find(v=>v.id==='mrv1').rules.chores.dailyCap === 4);

// (i3) the audit log is grow-only: entries written on either device must ALL
// survive, because a dropped entry is a lost record of a rule change.
const mrLog = api.mergeSharedChore(
  { moneyRules: { versions: [], log: { a:{ id:'a', path:'chores.dailyCap', to:4 } } } },
  { moneyRules: { versions: [], log: { b:{ id:'b', path:'loan.arrearsRatePct', to:5 } } } });
check('moneyRules audit log unions both entries',
  mrLog.moneyRules.log.a && mrLog.moneyRules.log.b);

// (i4) a deleted version stays deleted via its 'mrv:' tombstone
api.tombstoneIds('mrv:', ['mrv9']);
const mrDel = api.mergeSharedChore(
  { moneyRules: { versions: [], log: {} } },
  { moneyRules: { versions: [ { id:'mrv9', effectiveFrom:'2026-01-01' } ], log: {} } });
check('moneyRules deleted version stays deleted', mrDel.moneyRules.versions.length === 0);

// (i5) untouched state must not sprout an empty moneyRules bucket
state.shared.tombstones = {};
check('moneyRules absent when neither side has it',
  api.mergeSharedChore({ groups: [] }, { groups: [] }).moneyRules === undefined);

// ── (j) graded chores: a regrade DOWN must beat a stale remote copy ──
// This is the hazard a plain union cannot express — the union keeps the higher
// remote grade, so Mom lowering 3 → 1 on her phone would silently revert.
const eLocalNewer = api.mergeEarnings(
  { w1: { chores: { '0': { dishes: 1 } } } },
  { w1: { chores: { '0': { dishes: 3 } } } },
  { w1: 2000 }, { w1: 1000 });
check('earnings regrade down wins when local is newer',
  eLocalNewer.earnings.w1.chores['0'].dishes === 1);

const eRemoteNewer = api.mergeEarnings(
  { w1: { chores: { '0': { dishes: 3 } } } },
  { w1: { chores: { '0': { dishes: 1 } } } },
  { w1: 1000 }, { w1: 2000 });
check('earnings regrade down wins when remote is newer',
  eRemoteNewer.earnings.w1.chores['0'].dishes === 1);

// An erased grade must also survive — deleting a key is invisible to a union.
const eErase = api.mergeEarnings(
  { w1: { chores: { '0': {} } } },
  { w1: { chores: { '0': { dishes: 3 } } } },
  { w1: 5000 }, { w1: 100 });
check('earnings erased grade stays erased',
  eErase.earnings.w1.chores['0'].dishes === undefined);

// Untouched weeks on either device must not be disturbed by another week's edit.
const eOther = api.mergeEarnings(
  { w1: { chores: { '0': { mop: 2 } } } },
  { w2: { chores: { '0': { bins: 3 } } } },
  { w1: 2000 }, { w2: 2000 });
check('earnings separate weeks both survive',
  eOther.earnings.w1.chores['0'].mop === 2 && eOther.earnings.w2.chores['0'].bins === 3);

// A tie keeps the union rather than arbitrarily picking a side.
const eTie = api.mergeEarnings(
  { w1: { personal: { '0': { bed: 'done' } } } },
  { w1: { personal: { '0': { room: 'unasked' } } } },
  { w1: 1000 }, { w1: 1000 });
check('earnings tie keeps the union',
  eTie.earnings.w1.personal['0'].bed === 'done' && eTie.earnings.w1.personal['0'].room === 'unasked');

// Stamps must merge to the newer of the two, or the next merge misjudges.
check('earnings stamps take the max', eLocalNewer.stamps.w1 === 2000);

// ── (k) append-only per-kid ledgers ──
state.shared.tombstones = {};

// Results recorded on two devices must both survive; losing one loses money.
const compMerge = api.mergeProfileState(
  { competitions: [{ id:'c1', sport:'swim',  awarded: 22, updatedAt: 100 }] },
  { competitions: [{ id:'c2', sport:'skate', awarded: 57, updatedAt: 100 }] }, 'jess');
check('competitions from both devices survive',
  compMerge.competitions.length === 2
  && compMerge.competitions.reduce((s,c)=>s+c.awarded,0) === 79);

// A deleted result must stay deleted rather than resurrect from the other side.
api.tombstoneIds('comp:', ['c9']);
const compDel = api.mergeProfileState(
  { competitions: [] },
  { competitions: [{ id:'c9', sport:'swim', awarded: 99 }] }, 'jess');
check('deleted competition stays deleted', compDel.competitions.length === 0);

// Fines and box items are separate ledgers and must not bleed into each other.
state.shared.tombstones = {};
const fineMerge = api.mergeProfileState(
  { fines: [{ id:'f1', itemId:'tone' }],   boxItems: [{ id:'b1', label:'skates' }] },
  { fines: [{ id:'f2', itemId:'screens' }], boxItems: [{ id:'b2', label:'books' }] }, 'jess');
check('fines and box items both union independently',
  fineMerge.fines.length === 2 && fineMerge.boxItems.length === 2);

// The honesty ladder derives its step from the count, so a dropped strike would
// silently walk the escalation backwards.
const honMerge = api.mergeProfileState(
  { honesty: [{ id:'h1', step:1 }] },
  { honesty: [{ id:'h2', step:2 }] }, 'jess');
check('honesty strikes union so the ladder cannot regress', honMerge.honesty.length === 2);

// A lost loan payment is money the kid paid and didn't get credit for.
const loanMerge = api.mergeProfileState(
  { loan: { paid: 110, payments: [{ id:'p1', amount:100, credited:110 }] } },
  { loan: { paid: 56,  payments: [{ id:'p2', amount:56,  credited:56  }] } }, 'jess');
check('loan payments union across devices', loanMerge.loan.payments.length === 2);

/* ── The pocket-money system ── */

// A kid can owe for more than one thing. Each debt carries its own payment
// ledger, so a debt added on one device and a payment made on the other both
// have to survive.
state.shared.tombstones = {};
const debtMerge = api.mergeProfileState(
  { debts: [{ id:'loan', name:'Ski loan', paid: 110, updatedAt: 5,
              payments: [{ id:'p1', amount:100 }] }] },
  { debts: [{ id:'loan', name:'Ski loan', paid: 110, updatedAt: 5,
              payments: [{ id:'p2', amount:56 }] },
            { id:'bike', name:'Bike loan', paid: 0 }] }, 'jess');
check('debts union and per-debt payments survive',
  debtMerge.debts.length === 2 &&
  debtMerge.debts.find(d => d.id === 'loan').payments.length === 2);

// Removing a debt on one device must stick, not resurrect from the other.
state.shared.tombstones = { 'debt:bike': Date.now() };
check('removed debt stays removed',
  api.mergeProfileState({ debts: [] }, { debts: [{ id:'bike', name:'Bike loan' }] }, 'jess')
     .debts.length === 0);

// Money from outside is append-only; a deleted one carries a 'dep:' tombstone.
state.shared.tombstones = {};
const depMerge = api.mergeProfileState(
  { deposits: [{ id:'d1', amount: 50 }] },
  { deposits: [{ id:'d2', amount: 20 }] }, 'jess');
check('deposits union across devices', depMerge.deposits.length === 2);
state.shared.tombstones = { 'dep:d2': Date.now() };
check('deleted deposit stays deleted',
  api.mergeProfileState({ deposits: [] }, { deposits: [{ id:'d2', amount: 20 }] }, 'jess')
     .deposits.length === 0);

// Holdings are edited in place by a parent, so the newest copy of each wins.
state.shared.tombstones = {};
const holdMerge = api.mergeProfileState(
  { holdings: [{ id:'h1', priceNow: 180, updatedAt: 10 }] },
  { holdings: [{ id:'h1', priceNow: 200, updatedAt: 20 }, { id:'h2', priceNow: 100 }] }, 'jess');
check('newest holding edit wins, new holdings union',
  holdMerge.holdings.length === 2 &&
  holdMerge.holdings.find(h => h.id === 'h1').priceNow === 200);

// THE ONE THAT MATTERS: confirming a week, then reopening it after an edit.
// A plain union would keep the stale confirm alive over the reopen that came
// after it, and the kid's decision page would unlock on a week nobody agreed.
const confirmMerge = api.mergeSharedChore(
  { weekConfirms: { '2026-07-26': { jess: { by:'Mom', at: 100, reopenedAt: 300 } } } },
  { weekConfirms: { '2026-07-26': { jess: { by:'Mom', at: 100, reopenedAt: null } } } });
check('reopening a week beats a stale confirm',
  confirmMerge.weekConfirms['2026-07-26'].jess.reopenedAt === 300);

// Two kids confirmed on two devices in the same week — both have to land.
const twoKids = api.mergeSharedChore(
  { weekConfirms: { w1: { jenn: { at: 10 } } } },
  { weekConfirms: { w1: { jess: { at: 20 } } } });
check('both kids\' confirms survive the same week',
  twoKids.weekConfirms.w1.jenn && twoKids.weekConfirms.w1.jess);

// What she decided to do with the money: newest decision wins per week per kid.
const planMerge = api.mergeSharedChore(
  { weekPlans: { w1: { jess: { planId:'ready', committedAt: 500 } } } },
  { weekPlans: { w1: { jess: { planId:'debt',  committedAt: 900 } } } });
check('newest week plan wins', planMerge.weekPlans.w1.jess.planId === 'debt');

/* ── The meeting's reflection: what a child said about her week ──
   The record is a two-level week/kid store like weekConfirms and weekPlans, and
   it has to merge the same way for the same reason: every field in it can be
   CHANGED on either device, and a plain deep-merge union cannot express taking
   something back.

   The array fields are what force the issue. deepMergeObj treats an array as a
   scalar, so `answerIds` is replaced wholesale by whichever snapshot arrives
   last, with no timestamp consulted — untick an answer on the iPad and a stale
   phone can put it back, silently. Arbitrating the whole per-kid record by
   updatedAt is what makes a deselection stick: a record replaced whole cannot
   lose one of its own fields. */
const reflNewer = api.mergeSharedChore(
  { reflections: { w1: { jenn: { doingWell: { answerIds: ['tried', 'helped'] }, updatedAt: 100 } } } },
  { reflections: { w1: { jenn: { doingWell: { answerIds: ['tried'] },           updatedAt: 900 } } } });
check('unticking a reflection answer sticks',
  reflNewer.reflections.w1.jenn.doingWell.answerIds.length === 1);

// …and the stale side does not win just by arriving second.
const reflStale = api.mergeSharedChore(
  { reflections: { w1: { jenn: { doingWell: { answerIds: ['tried'] },           updatedAt: 900 } } } },
  { reflections: { w1: { jenn: { doingWell: { answerIds: ['tried', 'helped'] }, updatedAt: 100 } } } });
check('a stale reflection does not overwrite a newer one',
  reflStale.reflections.w1.jenn.doingWell.answerIds.length === 1);

// One child's reflection must never overwrite the other's — they are answered
// on the same screen, often on two devices, in the same sitting.
const reflTwoKids = api.mergeSharedChore(
  { reflections: { w1: { jenn: { needsWork: { answerId: 'rushed' }, updatedAt: 10 } } } },
  { reflections: { w1: { jess: { needsWork: { answerId: 'forgot' }, updatedAt: 20 } } } });
check('both children keep their own reflection',
  reflTwoKids.reflections.w1.jenn.needsWork.answerId === 'rushed'
  && reflTwoKids.reflections.w1.jess.needsWork.answerId === 'forgot');

// Two weeks are two records; settling one must not disturb the other.
const reflTwoWeeks = api.mergeSharedChore(
  { reflections: { w1: { jenn: { updatedAt: 10 } } } },
  { reflections: { w2: { jenn: { updatedAt: 20 } } } });
check('reflections from two weeks both survive',
  reflTwoWeeks.reflections.w1.jenn && reflTwoWeeks.reflections.w2.jenn);

/* ── State added by the viewer/flow work ──
   Four new stores crossed the wire without a check between them. None of them
   is exotic; the point is that a merge bug here is invisible until two devices
   disagree about a week that has already been paid. */

// The four training checks live on the block, so they ride the block's own
// newest-wins arbitration — the same path gearState used.
const trainMerge = api.mergeWeeks(
  { d1: [ { id:'t1', trainingCheck: { ready: true }, updatedAt: 10 } ] },
  { d1: [ { id:'t1', trainingCheck: { ready: true, attitude: true }, updatedAt: 20 } ] });
check('newest training-check state wins on a block',
  trainMerge.d1[0].trainingCheck.attitude === true);

// gradedAt and paymentOverrides live inside earnings[week], which unions by
// default and hands a whole week to the strictly-newer side when stamped.
const gradeStamps = api.mergeEarnings(
  { w1: { chores: { '0': { mop: 3 } }, gradedAt: { '0': { mop: 100 } } } },
  { w1: { chores: { '1': { dishes: 2 } }, gradedAt: { '1': { dishes: 200 } } } },
  {}, {});
check('grades and their stamps union across devices',
  gradeStamps.earnings.w1.gradedAt['0'].mop === 100 &&
  gradeStamps.earnings.w1.gradedAt['1'].dishes === 200);

// A payment agreed down at the meeting must not be lost to the other device's
// copy of the same week.
const payOv = api.mergeEarnings(
  { w1: { paymentOverrides: { 'debt-1': 8 } } },
  { w1: { overrides: { chores: { value: 12 } } } },
  {}, {});
check('a reduced loan payment survives a merge',
  payOv.earnings.w1.paymentOverrides['debt-1'] === 8 &&
  payOv.earnings.w1.overrides.chores.value === 12);

// ...and the newer device still takes the whole week when both stamped it.
const payOvNewer = api.mergeEarnings(
  { w1: { paymentOverrides: { 'debt-1': 8 } } },
  { w1: { paymentOverrides: { 'debt-1': 5 } } },
  { w1: 100 }, { w1: 200 });
check('newest side wins a stamped week outright',
  payOvNewer.earnings.w1.paymentOverrides['debt-1'] === 5);

// THE WATERMARK. lastGradeSeen records when the kid last read her tab. A plain
// deep-merge lets remote win at a scalar, so an older stamp arriving from a
// second device would drag it backwards and resurface markers she had read.
const seenBack = api.mergeProfileState(
  { progress: { lastGradeSeen: 900 } },
  { progress: { lastGradeSeen: 100 } }, 'jess');
check('the "seen" watermark never moves backwards',
  seenBack.progress.lastGradeSeen === 900);
const seenFwd = api.mergeProfileState(
  { progress: { lastGradeSeen: 100 } },
  { progress: { lastGradeSeen: 900 } }, 'jess');
check('the "seen" watermark does move forwards',
  seenFwd.progress.lastGradeSeen === 900);

// ── Clock skew (P1-3) ──────────────────────────────────────────────────────
// Arbitration here is purely "higher updatedAt wins". That is correct only if
// the stamps are comparable across devices, and they were not: every device
// stamped with its own Date.now(), so the winner was whichever clock was
// furthest ahead. These two checks pin the mechanism the fix depends on — the
// merge layer is unchanged, what changed is that js/03-sync.js now stamps with
// syncNow() (server-corrected) instead of Date.now().
const T = 1700000000000;
const SKEW = 10 * 60 * 1000;   // one tablet is ten minutes fast

// Jenn's device edits first, in real time, but its clock is ten minutes fast.
// Jess's device edits a minute later with a correct clock. With raw local
// clocks, the stale edit wins and the later one silently disappears.
const skewed = api.mergeArrayById(
  [{ id: 'blk', who: 'earlier-but-fast-clock', updatedAt: T + SKEW }],
  [{ id: 'blk', who: 'later-real-edit',        updatedAt: T + 60000 }]);
check('a fast clock would win an exchange it should lose (the bug)',
  skewed.length === 1 && skewed[0].who === 'earlier-but-fast-clock');

// Stamped with server-corrected time, the same two edits arbitrate on when they
// actually happened, and the later edit survives.
const corrected = api.mergeArrayById(
  [{ id: 'blk', who: 'earlier-but-fast-clock', updatedAt: T }],
  [{ id: 'blk', who: 'later-real-edit',        updatedAt: T + 60000 }]);
check('server-corrected stamps let the later edit win (the fix)',
  corrected.length === 1 && corrected[0].who === 'later-real-edit');

/* ── "We sat down" is not "the money moved" ──
   meetingsHeld is only written once BOTH kids have finished step 4, so a family
   that reviewed, celebrated and agreed the numbers recorded nothing — and the
   catch-up list then reported every one of the last eight weeks as never
   settled. meetingsMet records the sitting down.

   Its merge is a grow-only union, the same as meetingsHeld and for the same
   reason: two parents cannot disagree about whether a meeting happened, and a
   lost entry is a week the family gets nagged about having already done. */
const metUnion = api.mergeSharedChore(
  { meetingsMet: { 'w-1': { at: 100, by: 'Mum' } } },
  { meetingsMet: { 'w-2': { at: 200, by: 'Dad' } } });
check('two devices\' "we met" records both survive',
  !!(metUnion.meetingsMet && metUnion.meetingsMet['w-1'] && metUnion.meetingsMet['w-2']));

// A week recorded on one device and untouched on the other must stay recorded,
// whichever way round the merge runs.
const metOneSided = api.mergeSharedChore(
  { meetingsMet: { 'w-3': { at: 300 } } },
  { meetingsMet: {} });
check('a "we met" record is not dropped by an emptier remote',
  !!(metOneSided.meetingsMet && metOneSided.meetingsMet['w-3']));
check('…and the same the other way round',
  !!api.mergeSharedChore({ meetingsMet: {} }, { meetingsMet: { 'w-3': { at: 300 } } }).meetingsMet['w-3']);

// Met and settled are separate records: settling must not erase the sitting
// down, and a met week must not read as settled.
const metAndHeld = api.mergeSharedChore(
  { meetingsMet: { 'w-4': { at: 400 } } },
  { meetingsHeld: { 'w-4': true } });
check('met and settled are recorded independently',
  !!metAndHeld.meetingsMet['w-4'] && metAndHeld.meetingsHeld['w-4'] === true);
check('a met week is not silently marked settled',
  api.mergeSharedChore({ meetingsMet: { 'w-5': { at: 500 } } }, {}).meetingsHeld === undefined);

/* ── Age survives a sync, and a stale device cannot un-age a child ──
   Age is stored as the pair {age, ageYear}: how old she is, and the August that
   was true for. currentAge() reads the pair and rolls it forward one year per
   August since — which is the property these tests are really about, because it
   is what makes a plain last-write-wins merge safe here.

   Written before touching js/04-merge.js, per CLAUDE.md. They pass against the
   shipped merge, so 04-merge.js does not move: the same conclusion meetingsMet
   reached. A watermark like lastGradeSeen needs forward-only handling because a
   backwards value is unrecoverable; a stale ageYear is not — the next read sees
   an ageYear behind the current one and bumps again, so the staleness heals
   itself rather than persisting. */
const ageRollover = (d) => (d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1);
check('the August rollover year is this year from August, last year before it',
  ageRollover(new Date(2026, 7, 1)) === 2026 && ageRollover(new Date(2026, 6, 31)) === 2025
  && ageRollover(new Date(2026, 0, 15)) === 2025);

// Both halves travel together, so a device that has never seen an age gets one.
const ageFresh = api.mergeProfileState({}, { age: 10, ageYear: 2026 }, 'jenn');
check('an age set on one device reaches the other',
  ageFresh.age === 10 && ageFresh.ageYear === 2026);

// The stale-device case. The phone pushes last August's pair; the merge takes
// it, and the value is wrong for exactly as long as it takes something to read
// it — the rollover puts it straight back.
const ageStale = api.mergeProfileState({ age: 11, ageYear: 2026 }, { age: 10, ageYear: 2025 }, 'jenn');
const healed = ageStale.age + (2026 - ageStale.ageYear);
check('a stale age merges back to the right number on the next read', healed === 11);

// A correction is a correction: it re-stamps the year, so it does not get
// rolled forward on top of itself.
const ageFixed = api.mergeProfileState({ age: 10, ageYear: 2026 }, { age: 8, ageYear: 2026 }, 'jess');
check('a corrected age is not then aged up again',
  ageFixed.age + (2026 - ageFixed.ageYear) === 8);

// Age is per child. Merging one profile must not reach into the other's.
check('ages are per profile',
  api.mergeProfileState({ age: 12, ageYear: 2026 }, {}, 'jenn').age === 12
  && api.mergeProfileState({}, { age: 8, ageYear: 2026 }, 'jess').age === 8);


/* ══ Two devices ═══════════════════════════════════════════════════════════
   Everything above this line calls one merge function with two hand-built
   objects. That is a real test of that function and no test at all of the
   thing that actually goes wrong: two devices, each holding a whole document,
   editing while offline, reconnecting in some order. AUDIT-PRODUCT.md asked
   for this matrix; it was never built, and every defect this release fixes
   lived in the gap.

   The harness is deliberately small. Each device owns a `state`, edits it
   through the real writers' shapes, and `sync()` runs the REAL
   mergeSharedState / mergeProfileState in both directions — which is why
   mergeSharedState was lifted out of js/03-sync.js: a merge only reachable
   from a browser is a merge no unit test can hold.

   The one thing it fakes is `global.state`, because the merge layer reads
   tombstones off it. Each device swaps its own in for the duration of its own
   merge, which is exactly what a device does. */
function makeDevice(name) {
  return {
    name,
    state: { shared: { tombstones: {}, chore: {} }, profiles: { jenn: {}, jess: {} } },
    clockOffset: 0,
  };
}
/* Run fn with this device's state installed as the global — and with its clock
   skew applied, so "a device ten minutes behind the server" is expressible. */
function on(dev, fn) {
  const prevState = global.state;
  const prevNow = global.syncNow;
  global.state = dev.state;
  global.syncNow = () => Date.now() + dev.clockOffset;
  try { return fn(dev.state); } finally { global.state = prevState; global.syncNow = prevNow; }
}
/* One device receives the other's whole document, exactly as onSnapshot does:
   tombstones first (so the week merges below already know about deletes), then
   shared, then each profile. */
function receive(dev, remote) {
  on(dev, st => {
    api.mergeTombstones((remote.shared || {}).tombstones);
    st.shared = api.mergeSharedState(st.shared, remote.shared);
    ['jenn', 'jess'].forEach(p => {
      st.profiles[p] = api.mergeProfileState(st.profiles[p], (remote.profiles || {})[p], p);
    });
  });
}
const clone = o => JSON.parse(JSON.stringify(o));
/* Both devices come back online and exchange documents. Each merges the other's
   copy as it was at the moment of reconnection, which is what actually happens:
   neither has seen the other's writes yet. */
function sync(a, b) {
  const snapA = clone(a.state), snapB = clone(b.state);
  receive(a, snapB);
  receive(b, snapA);
}

// Two devices editing DIFFERENT records: both edits must survive. This is the
// case the merge layer already handled, and it is here as the control — if it
// ever fails, the harness itself is wrong.
{
  const ipad = makeDevice('ipad'), phone = makeDevice('phone');
  on(ipad, st => { st.shared.sharedActivities = [{ id: 'a1', name: 'Swim', updatedAt: 100 }]; });
  on(phone, st => { st.shared.sharedActivities = [{ id: 'a2', name: 'Skate', updatedAt: 100 }]; });
  sync(ipad, phone);
  check('two devices, different records — both survive',
    ipad.state.shared.sharedActivities.length === 2 &&
    phone.state.shared.sharedActivities.length === 2);
}

// A day reviewed on one device must survive a snapshot from the other. Before
// parentDayConfirm was arbitrated it fell through the `...rs` spread and the
// remote copy replaced it whole, so two adults working through one Sunday
// meeting lost half their reviews — and then canCloseWeek refused the week
// with nothing on screen to say why.
{
  const ipad = makeDevice('ipad'), phone = makeDevice('phone');
  on(ipad, st => { st.shared.parentDayConfirm = { jenn: { '2026-09-01': true } }; });
  on(phone, st => { st.shared.parentDayConfirm = { jenn: { '2026-09-02': true } }; });
  sync(ipad, phone);
  const j = ipad.state.shared.parentDayConfirm.jenn;
  check('a day reviewed on each device survives the other',
    j['2026-09-01'] === true && j['2026-09-02'] === true &&
    phone.state.shared.parentDayConfirm.jenn['2026-09-01'] === true);
}

// Reopening a week has to travel. The reopen is a REMOVAL, and deepMergeObj
// iterates the remote's keys, so it could not be expressed at all: a close
// always won, the reopen never left the device that made it, and reflIsLocked
// re-locked both girls' reflections behind it.
{
  const ipad = makeDevice('ipad'), phone = makeDevice('phone');
  const wk = '2026-08-31';
  const close = st => {
    st.shared.chore.weeksClosed = { [wk]: { at: 1000, by: 'a grown-up' } };
    st.shared.chore.weekStateUpdatedAt = { [wk]: 1000 };
  };
  on(ipad, close); on(phone, close);
  sync(ipad, phone);
  // Now reopen on the iPad only, stamped later, and let the phone hear about it.
  on(ipad, st => {
    delete st.shared.chore.weeksClosed[wk];
    st.shared.chore.weekStateUpdatedAt[wk] = 2000;
  });
  sync(ipad, phone);
  check('reopening a week reaches the other device',
    !ipad.state.shared.chore.weeksClosed[wk] && !phone.state.shared.chore.weeksClosed[wk]);
}

// The meeting's Undo removes from seven week-keyed maps at once. The wallet
// went back because profiles are arbitrated per record; the paperwork did not,
// so the other device still read the week as settled. One stamp covers them.
{
  const ipad = makeDevice('ipad'), phone = makeDevice('phone');
  const wk = '2026-08-31';
  const settled = st => {
    st.shared.chore.meetingsHeld = { [wk]: true };
    st.shared.chore.moneyLedger = { [wk]: { jenn: { total: 12 } } };
    st.shared.chore.finalizedWeeks = { [wk]: { jenn: 12 } };
    st.shared.chore.weekStateUpdatedAt = { [wk]: 1000 };
  };
  on(ipad, settled); on(phone, settled);
  on(ipad, st => {
    delete st.shared.chore.meetingsHeld[wk];
    delete st.shared.chore.moneyLedger[wk];
    delete st.shared.chore.finalizedWeeks[wk];
    st.shared.chore.weekStateUpdatedAt[wk] = 2000;
  });
  sync(ipad, phone);
  const c = phone.state.shared.chore;
  check('an undone settlement is undone on both devices',
    !c.meetingsHeld[wk] && !c.moneyLedger[wk] && !c.finalizedWeeks[wk]);
}

// A week nobody has stamped keeps the grow-only union it always had, so a
// device that predates the stamp cannot quietly un-record a real meeting.
{
  const ipad = makeDevice('ipad'), phone = makeDevice('phone');
  on(ipad, st => { st.shared.chore.meetingsHeld = { 'w1': true }; });
  on(phone, st => { st.shared.chore.meetingsHeld = {}; });
  sync(ipad, phone);
  check('an unstamped week still keeps the grow-only union',
    ipad.state.shared.chore.meetingsHeld.w1 === true &&
    phone.state.shared.chore.meetingsHeld.w1 === true);
}

// A device whose clock runs BEHIND the server deletes a block. Tombstones were
// stamped with Date.now() while the records they delete carry syncNow, so the
// tombstone came out older than its own block, blockTombstoned's `>=` was
// false, and the delete silently did not stick — for anyone.
{
  const slow = makeDevice('slow');
  // syncNow is Date.now() PLUS the offset the device learned from the server,
  // so a device whose own clock runs ten minutes behind carries a POSITIVE
  // offset — its corrected stamps land ahead of its raw ones. That is the whole
  // bug: the block was stamped corrected and the tombstone raw, so the
  // tombstone came out older than the block it was meant to delete.
  slow.clockOffset = +10 * 60 * 1000;
  const block = on(slow, () => ({ id: 'b9', updatedAt: global.syncNow() }));
  on(slow, st => { st.shared.tombstones = {}; api.tombstoneBlockIds(['b9']); });
  const kept = on(slow, () => api.mergeWeeks({}, { d1: [block] }));
  check('a device behind the server can still delete a block',
    (kept.d1 || []).length === 0);
}

// Equal stamps must resolve to the SAME record on both devices. The old
// tie-break kept `prev`, which is a different record depending on which side
// you are standing on, so two devices diverged permanently and the document
// went to whichever pushed last.
{
  const a = { id: 'x', updatedAt: 500, opId: 'dev-a-1', name: 'A' };
  const b = { id: 'x', updatedAt: 500, opId: 'dev-b-1', name: 'B' };
  const fromA = api.mergeArrayById([a], [b])[0].name;
  const fromB = api.mergeArrayById([b], [a])[0].name;
  check('an exact tie resolves the same way on both devices', fromA === fromB);
}

// A record written before this release carries no stamp at all. It must never
// beat one that has a stamp, in either direction.
{
  const legacy = { id: 'y', name: 'legacy' };
  const stamped = { id: 'y', name: 'stamped', updatedAt: 900 };
  check('an unstamped record never beats a stamped one',
    api.mergeArrayById([legacy], [stamped])[0].name === 'stamped' &&
    api.mergeArrayById([stamped], [legacy])[0].name === 'stamped');
}

// A parent's routine override, and the reset that puts it back. Without the
// 'ovr:' tombstone the reset came straight back from the other device's copy
// and the button undid itself on the next sync.
{
  const ipad = makeDevice('ipad'), phone = makeDevice('phone');
  const set = st => { st.shared.builtInRoutineOverrides = { morning: { title: 'Mine', updatedAt: 100 } }; };
  on(ipad, set); on(phone, set);
  sync(ipad, phone);
  on(ipad, st => {
    delete st.shared.builtInRoutineOverrides.morning;
    api.tombstoneIds('ovr:', ['morning']);
  });
  sync(ipad, phone);
  check('resetting a routine override stays reset on both devices',
    !ipad.state.shared.builtInRoutineOverrides.morning &&
    !phone.state.shared.builtInRoutineOverrides.morning);
}

// The school calendar is imported and reviewed as one thing. Its days-off list
// is an array, which deepMergeObj treats as a scalar, so a field-by-field merge
// could pair one device's term dates with the other's days off — a calendar
// that never existed anywhere.
{
  const older = { updatedAt: 100, term: { start: '2026-09-01' }, offDays: ['2026-12-25'] };
  const newer = { updatedAt: 200, term: { start: '2026-09-08' }, offDays: ['2026-11-11'] };
  // Both directions. Remote-newer is the easy one — a plain spread gets it right
  // by accident. LOCAL-newer is the case that was broken: the remote copy
  // replaced it whole, so an import done here was undone by the other device.
  const remoteNewer = api.mergeSchoolCal(older, newer);
  const localNewer  = api.mergeSchoolCal(newer, older);
  check('a school calendar merges whole, never half of each',
    remoteNewer.term.start === '2026-09-08' && remoteNewer.offDays[0] === '2026-11-11'
    && localNewer.term.start === '2026-09-08' && localNewer.offDays[0] === '2026-11-11');
}

// A tombstone map cannot be emptied by a device with a wrong clock. Pruning
// used to measure age against `now`, so a tablet set a year fast dropped every
// tombstone it held, pushed the emptied map, and resurrected the family's
// deletes. It prunes by count now and asks no clock anything.
{
  const slow = makeDevice('slow');
  slow.clockOffset = 400 * 24 * 3600 * 1000 * 3;      // absurdly fast clock
  const t = { 'ancient': 1000, 'older': 2000 };
  on(slow, st => { st.shared.tombstones = t; api.tombstoneBlockIds(['fresh']); });
  check('a wrong clock cannot empty the tombstone map',
    t.ancient === 1000 && t.older === 2000 && t.fresh !== undefined);
}

// It does still prune, once there are more than any family could have — and it
// keeps the newest, which are the ones a straggling device could still argue
// with.
{
  const t = {};
  for (let i = 0; i < api.TOMBSTONE_MAX + 50; i++) t['id-' + i] = 1000 + i;
  api.pruneTombstones(t);
  check('the tombstone map is capped, keeping the newest',
    Object.keys(t).length === api.TOMBSTONE_MAX
    && t['id-' + (api.TOMBSTONE_MAX + 49)] !== undefined
    && t['id-0'] === undefined);
}


/* ══ Same record, two devices ══════════════════════════════════════════════
   The case the whole conflict mechanism exists for, and the one thing a
   timestamp genuinely cannot settle: which of two versions is RIGHT. */

// An ordinary catch-up — this device simply has not seen that edit yet — is a
// fast-forward and nobody is asked anything. If this raised a conflict, a parent
// would be asked about every sync and would learn to dismiss the question.
{
  const base   = { id: 'r1', opId: 'a-1', updatedAt: 100 };
  const edited = { id: 'r1', opId: 'a-2', baseOpId: 'a-1', updatedAt: 200 };
  check('an edit made from the version we hold is not a conflict',
    api.recordsDiverged(base, edited) === false &&
    api.recordsDiverged(edited, base) === false);
}

// The same version on both sides, and a record from before this shipped: no
// conflict either way. Nothing can be PROVED about an unstamped record, and a
// false alarm is worse than a missed one here.
{
  check('the same version, and pre-upgrade records, raise nothing',
    api.recordsDiverged({ opId: 'a-1' }, { opId: 'a-1' }) === false &&
    api.recordsDiverged({ opId: 'a-1' }, { updatedAt: 5 }) === false &&
    api.recordsDiverged({ updatedAt: 5 }, { updatedAt: 9 }) === false);
}

// Two edits from a common ancestor neither device has seen. This is a conflict.
{
  const fromIpad  = { opId: 'a-2', baseOpId: 'a-1', updatedAt: 200 };
  const fromPhone = { opId: 'b-2', baseOpId: 'a-1', updatedAt: 300 };
  check('two edits from an unseen common ancestor do conflict',
    api.recordsDiverged(fromIpad, fromPhone) === true);
}

// Both devices must name the same disagreement the same way, or the log grows
// two rows for one problem and resolving either leaves the other open.
{
  check('both devices generate the same conflict id',
    api.conflictId('reflections', 'w1/jenn', 'a-2', 'b-2') ===
    api.conflictId('reflections', 'w1/jenn', 'b-2', 'a-2'));
}

// End to end: two devices write different reflections for the same week while
// neither can see the other. The newer one is what shows — nothing on a kid
// screen changes and nothing waits for an adult — and the other is KEPT.
{
  const ipad = makeDevice('ipad'), phone = makeDevice('phone');
  const seed = st => {
    st.shared.chore.reflections = { w1: { jenn: { opId: 'seed-1', updatedAt: 100, wentWell: ['a'] } } };
  };
  on(ipad, seed); on(phone, seed);
  sync(ipad, phone);
  on(ipad,  st => { st.shared.chore.reflections.w1.jenn =
    { opId: 'ipad-2', baseOpId: 'seed-1', updatedAt: 200, wentWell: ['swimming'] }; });
  on(phone, st => { st.shared.chore.reflections.w1.jenn =
    { opId: 'phone-2', baseOpId: 'seed-1', updatedAt: 300, wentWell: ['reading'] }; });
  sync(ipad, phone);

  const shownI = ipad.state.shared.chore.reflections.w1.jenn;
  const shownP = phone.state.shared.chore.reflections.w1.jenn;
  const rowsI = ipad.state.shared.conflicts || [];
  const rowsP = phone.state.shared.conflicts || [];
  check('the newer version is what both devices display',
    shownI.opId === 'phone-2' && shownP.opId === 'phone-2');
  check('the displaced version is kept, once, on both devices',
    rowsI.length === 1 && rowsP.length === 1 && rowsI[0].id === rowsP[0].id);
  check('the kept row holds BOTH versions, not just the loser',
    rowsI[0].versions.length === 2 &&
    rowsI[0].versions.some(v => v.opId === 'ipad-2') &&
    rowsI[0].versions.some(v => v.opId === 'phone-2'));
  check('the row records which one is on screen', rowsI[0].shownOpId === 'phone-2');

  // A parent picks the OLDER one — the whole point, since newer is not right.
  // It is written back as a new version descending from the one chosen, so the
  // other device fast-forwards instead of raising the same disagreement again.
  const keep = rowsI[0].versions.find(v => v.opId === 'ipad-2');
  const shown = rowsI[0].shownOpId;
  const resolvedAt = Date.now() + 60000;   // the row already carries a real stamp
  on(ipad, st => {
    // Content from the chosen version; ancestry from the one on screen — which
    // is what cfChoose (js/38-conflicts.js) does, and why.
    st.shared.chore.reflections.w1.jenn =
      Object.assign({}, keep, { opId: 'ipad-3', baseOpId: shown, updatedAt: resolvedAt });
    st.shared.conflicts[0].resolvedAt = resolvedAt;
    st.shared.conflicts[0].updatedAt = resolvedAt;
  });
  sync(ipad, phone);
  check('the older version a parent chose is what both devices then show',
    phone.state.shared.chore.reflections.w1.jenn.wentWell[0] === 'swimming' &&
    ipad.state.shared.chore.reflections.w1.jenn.wentWell[0] === 'swimming');
  check('resolving it closes the row on both devices',
    (ipad.state.shared.conflicts || []).every(c => c.resolvedAt) &&
    (phone.state.shared.conflicts || []).every(c => c.resolvedAt));
  check('and choosing does not raise a second conflict',
    (phone.state.shared.conflicts || []).length === 1);
}

// A restore from backup is the one write that is not a merge. Replace bumps
// dataEpoch, and a higher epoch is taken whole — otherwise the other device's
// newer-stamped records win arbitration and go straight back up, which is
// exactly how Replace used to undo itself on the next sync.
{
  check('dataEpoch only ever counts up',
    api.mergeSharedState({ dataEpoch: 5 }, { dataEpoch: 2 }).dataEpoch === 5 &&
    api.mergeSharedState({ dataEpoch: 2 }, { dataEpoch: 5 }).dataEpoch === 5 &&
    api.mergeSharedState({}, {}).dataEpoch === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
