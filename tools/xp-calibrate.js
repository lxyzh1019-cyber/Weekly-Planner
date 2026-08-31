#!/usr/bin/env node
/* ── XP calibration ───────────────────────────────────────────────
   Run: node tools/xp-calibrate.js

   Every completed block used to earn a flat 20 XP against 100 per level. Five
   blocks was a level; an ordinary day was two. Nothing capped it, and the
   meeting's weekly awards were credited on top through a second path — so the
   only honest thing to say about the old numbers is that nobody had ever
   checked what they did over a term.

   This replays the proposed rules over eight synthetic weeks per child at three
   effort levels and reports levels gained. It is a MODEL, not a measurement:
   the weeks below are built from the shipped activity, routine and chore tables
   and from how this family's week is actually shaped (school five days, two or
   three training sessions, three routines a day, two family chores), not from
   Jenn and Jess's real data, which lives in Firestore and not in this repo.

   So treat the output as a calibrated starting point. Re-running this against a
   real backup export later would confirm or correct it without touching a line
   of app code.

   TARGETS, from the release brief:
     · normally no more than one level in a week
     · roughly one level every 3–5 active weeks
     · a strong week goes faster, but never skips several levels
     · ordinary meals and passive schedule blocks award nothing

   The values below are read straight out of the app so this cannot drift away
   from what actually ships. Change them in js/06-quests.js and js/18-rules.js
   and re-run. */

const fs = require('fs');
const path = require('path');

const repo = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(repo, f), 'utf8');

/* Pull the live numbers out of the source rather than restating them here — a
   calibration that quietly stops describing the app is worse than none. */
function num(src, re, what) {
  const m = src.match(re);
  if (!m) throw new Error(`could not read ${what} out of the source`);
  return Number(m[1]);
}
const quests = read('js/06-quests.js');
const rules = read('js/18-rules.js');

const PER_LEVEL = num(quests, /const QUEST_XP_PER_LEVEL = (\d+)/, 'XP per level');
const WEEKLY_CAP = num(quests, /const XP_WEEKLY_CAP = (\d+)/, 'the weekly cap');
const BY_GROUP = (() => {
  const body = quests.match(/const QUEST_XP_BY_GROUP = \{([\s\S]*?)\};/);
  if (!body) throw new Error('could not read QUEST_XP_BY_GROUP');
  const out = {};
  body[1].split('\n').forEach(l => {
    const m = l.match(/(\w+):\s*(\d+)/);
    if (m) out[m[1]] = Number(m[2]);
  });
  return out;
})();
const AWARD = (() => {
  const out = {};
  const re = /\{ id: '([\w_]+)',\s*label: '[^']*',\s*xp: (\d+) \}/g;
  let m;
  while ((m = re.exec(rules))) out[m[1]] = Number(m[2]);
  return out;
})();

/* ── The weeks ────────────────────────────────────────────────────
   Blocks a week actually holds, by group, at three levels of effort. `planned`
   is what goes on the calendar; `done` is how much of it she finishes. */
const WEEKS = {
  quiet: {
    label: 'quiet — an off week: school happens, not much else does',
    routine: { planned: 21, done: 8 },
    brain:   { planned: 10, done: 5 },   // 5 school days + homework
    body:    { planned: 2,  done: 1 },
    chores:  { planned: 2,  done: 0 },
    daily:   { planned: 21, done: 18 },  // meals: must contribute nothing
    free:    { planned: 6,  done: 6 },
    weekly:  {},
  },
  ordinary: {
    label: 'ordinary — the normal shape of a school week',
    routine: { planned: 21, done: 15 },
    brain:   { planned: 12, done: 10 },
    body:    { planned: 3,  done: 3 },
    chores:  { planned: 2,  done: 2 },
    daily:   { planned: 21, done: 20 },
    free:    { planned: 6,  done: 6 },
    weekly:  { personal_unasked: 1, training_attitude: 2 },
  },
  strong: {
    label: 'strong — everything kept, a competition, a personal best',
    routine: { planned: 21, done: 21 },
    brain:   { planned: 14, done: 14 },
    body:    { planned: 4,  done: 4 },
    chores:  { planned: 4,  done: 4 },
    daily:   { planned: 21, done: 21 },
    free:    { planned: 8,  done: 8 },
    weekly:  { streak_7: 1, personal_best: 1, chore_overflow: 2,
               personal_unasked: 2, training_attitude: 3, app_level: 1 },
  },
};

function weekXP(w) {
  let blocks = 0;
  ['routine', 'brain', 'body', 'chores', 'daily', 'free'].forEach(g => {
    blocks += (w[g] ? w[g].done : 0) * (BY_GROUP[g] || 0);
  });
  let weekly = 0;
  Object.keys(w.weekly || {}).forEach(id => { weekly += (AWARD[id] || 0) * w.weekly[id]; });
  const raw = blocks + weekly;
  return { blocks, weekly, raw, credited: Math.min(raw, WEEKLY_CAP), capped: raw > WEEKLY_CAP };
}

function levelAt(xp) { return Math.floor(xp / PER_LEVEL) + 1; }

function run(name, sequence) {
  let xp = 0;
  const rows = [];
  sequence.forEach((kind, i) => {
    const w = weekXP(WEEKS[kind]);
    const before = levelAt(xp);
    xp += w.credited;
    const after = levelAt(xp);
    rows.push({ n: i + 1, kind, ...w, level: after, gained: after - before });
  });
  return { name, rows, xp, level: levelAt(xp) };
}

const SEQUENCES = {
  /* Eight weeks each. Nobody has eight strong weeks in a row and nobody has
     eight quiet ones, so the realistic run is the one that decides. */
  'a realistic term (mixed)':  ['ordinary','ordinary','quiet','ordinary','strong','ordinary','quiet','ordinary'],
  'every week ordinary':       Array(8).fill('ordinary'),
  'every week quiet':          Array(8).fill('quiet'),
  'every week strong':         Array(8).fill('strong'),
};

console.log(`XP calibration — ${PER_LEVEL} XP per level, ${WEEKLY_CAP} a week at most`);
console.log('per completed block: ' + Object.entries(BY_GROUP).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('');

const findings = [];
Object.entries(SEQUENCES).forEach(([name, seq]) => {
  const r = run(name, seq);
  console.log(`── ${name}`);
  console.log('   wk  shape      blocks  weekly    raw  credited  level  gained');
  r.rows.forEach(x => {
    console.log(`   ${String(x.n).padStart(2)}  ${x.kind.padEnd(9)}  ${String(x.blocks).padStart(6)}  ${String(x.weekly).padStart(6)}  ${String(x.raw).padStart(5)}  ${String(x.credited).padStart(8)}${x.capped ? '*' : ' '}  ${String(x.level).padStart(5)}  ${String(x.gained).padStart(6)}`);
  });
  const gains = r.rows.map(x => x.gained);
  const weeksPerLevel = (r.level - 1) > 0 ? (seq.length / (r.level - 1)) : Infinity;
  console.log(`   → level ${r.level} after ${seq.length} weeks (${r.xp} XP), `
    + `${weeksPerLevel === Infinity ? 'no levels' : weeksPerLevel.toFixed(1) + ' weeks per level'}, `
    + `most in one week: ${Math.max(...gains)}`);
  console.log('');

  if (Math.max(...gains) > 1) findings.push(`${name}: ${Math.max(...gains)} levels in a single week`);
  if (name === 'a realistic term (mixed)') {
    if (weeksPerLevel < 3) findings.push(`the realistic term levels every ${weeksPerLevel.toFixed(1)} weeks — faster than 3`);
    if (weeksPerLevel > 5) findings.push(`the realistic term levels every ${weeksPerLevel.toFixed(1)} weeks — slower than 5`);
  }
  if (name === 'every week strong') {
    const q = run('q', Array(8).fill('ordinary'));
    if (r.level <= q.level) findings.push('a strong week is worth no more than an ordinary one');
  }
});

// Meals and passive time must be worth nothing, whatever else moves.
if (BY_GROUP.daily !== 0) findings.push(`meals and appointments award ${BY_GROUP.daily} XP each`);
if (BY_GROUP.free !== 0) findings.push(`free and rest time awards ${BY_GROUP.free} XP each`);

if (findings.length) {
  console.log('OUT OF RANGE:');
  findings.forEach(f => console.log('  · ' + f));
  process.exit(1);
}
console.log('Every target met: at most one level a week, one level every 3–5 weeks on a');
console.log('realistic term, strong weeks faster, meals and passive time worth nothing.');
