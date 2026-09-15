// Weekly-Planner — every test suite reaches CI.
//
// .github/workflows/ci.yml ENUMERATES the npm scripts it runs, one step at a
// time, rather than running `npm test`. That is deliberate — the fast gate runs
// without a browser and the smoke job installs one — but it means package.json
// and the workflow are two lists that have to agree, and nothing made them.
//
// So a suite added to package.json and not to the workflow is a suite CI never
// runs: it passes on a laptop, is absent from every pull request, and reports
// nothing while the code it guards rots. That is the same shape as the
// `|| break` loop CLAUDE.md records — a check that can never fail — and it is
// not hypothetical: tests/buffers.test.js and tests/money.test.js were both in
// this state, the second of them for as long as it had existed.
//
// It matters most for the two calibrations, because of what they promise.
// CLAUDE.md says of tools/money-calibrate.js that "changing a rate and not
// re-running shows up as a failing test rather than at a Sunday meeting". A
// promise like that is only as good as the thing that enforces it.
//
// Deliberately a string match rather than a YAML parse: this repo has no build
// step and one devDependency, and `npm run <name>` inside a `run:` block is
// unambiguous enough to check by reading. A guard that needed a parser would be
// a guard with a reason not to run.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const wfPath = path.join(root, '.github', 'workflows', 'ci.yml');

if (!fs.existsSync(wfPath)) {
  console.error('FAIL  no .github/workflows/ci.yml — nothing runs these suites on a pull request');
  process.exit(1);
}
const wf = fs.readFileSync(wfPath, 'utf8');

const scripts = Object.keys(pkg.scripts || {});
// `test` is the aggregate a person runs locally; `check` is a chain the
// workflow invokes by name. Everything else that starts a suite is a step CI
// has to carry itself.
const suites = scripts.filter(n => n.startsWith('test:'));

const problems = [];

// 1. Every suite is invoked by some step.
suites.forEach(name => {
  if (!new RegExp(`npm run ${name}(?![\\w:-])`).test(wf)) {
    problems.push(`package.json defines "${name}" and ci.yml never runs it`);
  }
});

// 2. And nothing in the workflow invokes a script that does not exist — a typo
//    in a step name fails the job, but only once somebody pushes.
const invoked = [...wf.matchAll(/npm run ([\w:-]+)/g)].map(m => m[1]);
[...new Set(invoked)].forEach(name => {
  if (!scripts.includes(name)) {
    problems.push(`ci.yml runs "npm run ${name}" and package.json has no such script`);
  }
});

// 3. `npm test` stays the local equivalent: a suite missing from it is one a
//    contributor never runs before pushing.
const aggregate = pkg.scripts && pkg.scripts.test ? pkg.scripts.test : '';
suites.forEach(name => {
  if (!new RegExp(`npm run ${name}(?![\\w:-])`).test(aggregate)) {
    problems.push(`"${name}" is not in the \`test\` script, so \`npm test\` skips it`);
  }
});

if (problems.length) {
  console.error(`FAIL  ${problems.length} test suite(s) not wired end to end:\n`);
  problems.forEach(p => console.error(`  ${p}`));
  console.error('\nAdd a step to .github/workflows/ci.yml, or to the `test` script, in the');
  console.error('same change that adds the suite.');
  process.exit(1);
}

console.log(`OK  ${suites.length} test suites, all run by \`npm test\` and by CI`);
