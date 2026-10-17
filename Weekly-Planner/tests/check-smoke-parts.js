// Weekly-Planner — every smoke check is in exactly one SMOKE_PART.
//
// CI runs each date's smoke suite as three parts side by side
// (SMOKE_PART=1|2|3, lists in tests/smoke-parts/parts.js). A check in no part
// would run in no job: green on every pull request while nothing tests it —
// the same shape as a suite CI never runs (tests/check-ci-scripts.js). A check
// in two parts runs twice for nothing. So this fails the build on either, and
// on a listed name no check has. noConsoleErrors runs in every part and is in
// no list.

const { smokeCheckNames, partProblems } = require('./smoke-parts/parts');

const names = smokeCheckNames();
const problems = partProblems(names);
if (problems.length) {
  problems.forEach(p => console.error('FAIL  ' + p));
  console.error(`check-smoke-parts: ${problems.length} problem(s) in tests/smoke-parts/parts.js`);
  process.exit(1);
}
console.log(`check-smoke-parts: OK (${names.length} smoke checks, each in one part or in every part)`);
