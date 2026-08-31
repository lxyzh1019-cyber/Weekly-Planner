/* Locks the calibrated XP values.
   Run: node tests/xp.test.js  (also runs as part of `npm test`)

   These numbers were not chosen, they were calibrated: tools/xp-calibrate.js
   replays them over synthetic quiet / ordinary / strong weeks and reports levels
   gained. This file is what stops one of them drifting afterwards without
   anybody re-running that.

   It reads the shipped source rather than importing the app — js/06-quests.js is
   a classic script full of DOM calls and cannot be required. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repo = path.join(__dirname, '..');
const quests = fs.readFileSync(path.join(repo, 'js/06-quests.js'), 'utf8');
const rules = fs.readFileSync(path.join(repo, 'js/18-rules.js'), 'utf8');

let pass = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fails.push(name + (detail ? ' — ' + detail : '')); console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

function num(src, re) { const m = src.match(re); return m ? Number(m[1]) : null; }

const perLevel = num(quests, /const QUEST_XP_PER_LEVEL = (\d+)/);
const legacy = num(quests, /const QUEST_XP_PER_LEVEL_LEGACY = (\d+)/);
const cap = num(quests, /const XP_WEEKLY_CAP = (\d+)/);

check('the level threshold is the calibrated 400', perLevel === 400, `read ${perLevel}`);
check('the legacy scale is still named, so banked XP can be converted', legacy === 100, `read ${legacy}`);
check('the weekly cap is the calibrated 260', cap === 260, `read ${cap}`);

const byGroup = (() => {
  const body = quests.match(/const QUEST_XP_BY_GROUP = \{([\s\S]*?)\};/);
  const out = {};
  if (body) body[1].split('\n').forEach(l => {
    const m = l.match(/(\w+):\s*(\d+)/);
    if (m) out[m[1]] = Number(m[2]);
  });
  return out;
})();

const want = { routine: 3, brain: 5, body: 8, chores: 5, daily: 0, free: 0 };
Object.keys(want).forEach(g => {
  check(`${g} blocks are worth ${want[g]} XP`, byGroup[g] === want[g], `read ${byGroup[g]}`);
});

/* The one rule that is not a tuning knob. Meals, appointments, rest and family
   time earn nothing — not as a judgement about them, but because XP is the
   record of effort and eating dinner is not effort. */
check('a meal or an appointment earns nothing', byGroup.daily === 0);
check('free and rest time earns nothing', byGroup.free === 0);

/* A cap that always binds is not a cap, it is a flat rate — and it would make a
   strong week worth exactly as much as an ordinary one, which is the opposite of
   what the brief asks for. The calibration proves the gap; this proves the cap
   is above what an ordinary week actually earns. */
const ordinaryBlocks = 15 * byGroup.routine + 10 * byGroup.brain + 3 * byGroup.body + 2 * byGroup.chores;
check('an ordinary week does not hit the cap', ordinaryBlocks + 30 < cap,
  `ordinary earns ${ordinaryBlocks + 30}, cap is ${cap}`);
check('one week can never be worth more than one level', cap < perLevel,
  `cap ${cap} vs ${perLevel} per level`);

/* Both writers go through one gate. Two independent taps into one pool is what
   let a strong week print several levels at the meeting on work that had already
   been counted as it happened. */
check('block XP is credited through addQuestXP with a week key',
  /addQuestXP\(worth, kid, ctWeekKeyForDate\(dayKey\)\)/.test(quests));
check('the weekly awards are credited through the same call with a week key',
  /addQuestXP\(total, kid, weekKey\)/.test(rules));
check('addQuestXP is the only writer of the XP total',
  (quests.match(/prog\.xp2 = /g) || []).length === 1);

/* And the rulebook the girls are shown quotes the same threshold. */
check('the rulebook quotes the calibrated threshold', /perLevel: 400/.test(rules));

/* Finally: the calibration itself still passes. If someone changes a value and
   only this file, the tool is what says whether the change is defensible. */
try {
  execFileSync(process.execPath, [path.join(repo, 'tools/xp-calibrate.js')], { stdio: 'pipe' });
  check('tools/xp-calibrate.js still meets every target', true);
} catch (e) {
  const out = String(e.stdout || '') + String(e.stderr || '');
  const why = (out.split('OUT OF RANGE:')[1] || out).trim().split('\n').slice(0, 4).join(' | ');
  check('tools/xp-calibrate.js still meets every target', false, why);
}

console.log('');
console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
