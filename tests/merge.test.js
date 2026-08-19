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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
