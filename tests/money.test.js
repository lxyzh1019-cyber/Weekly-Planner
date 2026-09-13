/* Locks the calibrated MONEY values.
   Run: node tests/money.test.js  (also runs as part of `npm test`)

   The twin of tests/xp.test.js, and it exists for the same reason: these
   numbers were not chosen, they were calibrated. tools/money-calibrate.js
   replays them over synthetic quiet / ordinary / strong weeks and reports what
   a term comes to against each child's annual target. This file is what stops
   one of them drifting afterwards without anybody re-running that.

   It requires js/18-rules.js through the module.exports guard at the end of
   that file, so it reads what actually ships rather than a copy.

   A check here passes only by being exactly true. The house idiom
   `checks.x = cond || [whatWentWrong]` returns a truthy ARRAY on failure, so a
   runner that tests truthiness counts a finding as a pass — see CLAUDE.md. The
   check() helper below takes a boolean and a detail string, never a value. */
const path = require('path');
const { MR_DEFAULT_RULES } = require(path.join(__dirname, '..', 'js', '18-rules.js'));
const cal = require(path.join(__dirname, '..', 'tools', 'money-calibrate.js'));

const R = MR_DEFAULT_RULES;
let pass = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond === true) { pass++; console.log('PASS ' + name); }
  else { fails.push(name + (detail ? ' — ' + detail : '')); console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

/* ── The shipped prices ──────────────────────────────────────────── */
const g = (R.chores || {}).grade || {};
check('a chore on time and to standard pays $3', g[3] === 3, `read ${g[3]}`);
check('a chore to standard but late pays $2', g[2] === 2, `read ${g[2]}`);
check('a passed redo pays $1', g[1] === 1, `read ${g[1]}`);
check('a chore not done pays nothing', g[0] === 0, `read ${g[0]}`);
check('the daily chore cap is $3', (R.chores || {}).dailyCap === 3, `read ${(R.chores || {}).dailyCap}`);
check('the first two chores each week are free',
  (R.chores || {}).freeChoresPerWeek === 2, `read ${(R.chores || {}).freeChoresPerWeek}`);

const tiers = ((R.streak || {}).tiers || []).slice().sort((a, b) => a.days - b.days);
check('the streak has three tiers', tiers.length === 3, `read ${tiers.length}`);
check('3 clean days pays $1', tiers[0] && tiers[0].days === 3 && tiers[0].bonus === 1,
  JSON.stringify(tiers[0]));
check('5 clean days pays $2', tiers[1] && tiers[1].days === 5 && tiers[1].bonus === 2,
  JSON.stringify(tiers[1]));
check('7 clean days pays $3', tiers[2] && tiers[2].days === 7 && tiers[2].bonus === 3,
  JSON.stringify(tiers[2]));
check('the streak pays the highest tier only, never the sum',
  (R.streak || {}).highestOnly === true, `read ${(R.streak || {}).highestOnly}`);

check('a fine can never create debt',
  (R.fines || {}).dailyFloorZero === true, `read ${(R.fines || {}).dailyFloorZero}`);

/* ── The routine ceiling ─────────────────────────────────────────────
   The number most easily got wrong, and the one the planned/simple routine
   change moves. Routines pay NOTHING directly: in the current model
   ctWeekMoney returns mrWeekMoney, and the $1 weekly goal bonus sits on the
   LEGACY branch of that function and is never added. So the whole routine
   channel is the streak, and its ceiling is the top tier. */
const topTier = tiers[tiers.length - 1] || { bonus: 0 };
check('routines are worth at most $3 per child per week', topTier.bonus === 3,
  `read ${topTier.bonus}`);

/* ── The calibrated weeks ────────────────────────────────────────────
   Change a price above and these move. That is the point: the failure is the
   prompt to re-run tools/money-calibrate.js and decide whether the new shape
   is wanted, rather than discovering it at a Sunday meeting. */
const quiet = cal.weekMoney(cal.WEEKS.quiet);
const ordinary = cal.weekMoney(cal.WEEKS.ordinary);
const strong = cal.weekMoney(cal.WEEKS.strong);

check('a quiet week nets $3', quiet.net === 3, `read ${quiet.net}`);
check('an ordinary week nets $21', ordinary.net === 21, `read ${ordinary.net}`);
check('a strong week nets $42', strong.net === 42, `read ${strong.net}`);

check('a quiet week reaches no streak tier', quiet.streak.bonus === 0, `read ${quiet.streak.bonus}`);
check('an ordinary week reaches the 5-day tier', ordinary.streak.tier === 5, `read ${ordinary.streak.tier}`);
check('a strong week reaches the 7-day tier', strong.streak.tier === 7, `read ${strong.streak.tier}`);

/* The two free chores are the CHEAPEST ones, which is her best arrangement.
   A quiet week grades only two chores, so both are free and chores pay nothing
   — the check that would catch the free-chore rule being flipped to
   dearest-first, which would pay her for the quiet week and cost her the
   ordinary one. */
check('a quiet week pays nothing for two chores, because both are free',
  quiet.chores.paid === 0, `read ${quiet.chores.paid}`);
check('an ordinary week pays for five chores less the two free ones',
  ordinary.chores.paid === 9, `read ${ordinary.chores.paid}`);

/* ── The term, against the targets ──────────────────────────────────── */
const TERM = ['ordinary', 'ordinary', 'quiet', 'ordinary', 'strong', 'ordinary', 'quiet', 'ordinary'];
const byKind = { quiet, ordinary, strong };
const termTotal = Math.round(TERM.reduce((s, k) => s + byKind[k].net, 0) * 100) / 100;
const annual = Math.round((termTotal / TERM.length) * 52 * 100) / 100;

check('a realistic eight-week term totals $153', termTotal === 153, `read ${termTotal}`);

const jennTarget = Number(((R.targets || {}).jenn || {}).annual) || 0;
const jessTarget = Number(((R.targets || {}).jess || {}).annual) || 0;
check('Jenn\'s annual target is $1000', jennTarget === 1000, `read ${jennTarget}`);
check('Jess\'s annual target is $800', jessTarget === 800, `read ${jessTarget}`);

/* The calibration itself: a realistic term should land NEAR the older child's
   target, not wildly over or under it. This is the check that would have
   caught the first set of XP values levelling a child every half-week, applied
   to money. */
const pctOfJenn = Math.round((annual / jennTarget) * 100);
check('a realistic term lands within 85-115% of Jenn\'s annual target',
  pctOfJenn >= 85 && pctOfJenn <= 115, `reached ${pctOfJenn}%`);

console.log('');
console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.log('');
  fails.forEach(f => console.log('  · ' + f));
  console.log('');
  console.log('Re-run tools/money-calibrate.js and decide whether the new shape is wanted.');
  process.exit(1);
}
