// Unit checks for the cloud-sync merge layer in index.html.
// Run: node tests/merge.test.js
// They execute the REAL functions extracted from index.html, so they catch
// regressions in deletion tombstones, deep merges, and chore-week conflicts.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/);
if (!m) { console.error('no inline <script> found'); process.exit(1); }
const src = m[1];

function extract(name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error('function not found in index.html: ' + name);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
}

const names = ['mergeArrayById','ensureTombstones','tombstoneBlockIds','blockTombstoned','tombstoneIds',
  'mergeTombstones','isPlainObject','deepMergeObj','mergeChoreState','mergeWeeks','mergeProfileState'];
const code = names.map(extract).join('\n');

const fn = new Function('state', code + `
  return { mergeArrayById, tombstoneBlockIds, tombstoneIds, blockTombstoned, mergeTombstones,
           deepMergeObj, mergeChoreState, mergeWeeks, mergeProfileState };
`);
const state = { shared: { tombstones: {} }, profiles: {} };
const api = fn(state);

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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
