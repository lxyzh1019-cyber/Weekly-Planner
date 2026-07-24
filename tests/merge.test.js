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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
