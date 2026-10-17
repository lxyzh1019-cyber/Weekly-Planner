// Weekly-Planner — `npm run test:failed`: re-run only the smoke checks that failed last.
//
// tests/smoke.js writes the names of a run's failed checks to tests/.smoke-failed
// (one per line, empty when none failed). This runs tests/smoke.js with
// SMOKE_ONLY set to those names; that run rewrites the file with only the names
// still failing. SMOKE_DATE and SMOKE_CHROMIUM pass through from the environment,
// and the SMOKE_ONLY rules (SETUP_NEEDS, PARTIAL RUN, refused under CI) apply.
// After a fix: this first, the full suite once at the end.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const file = path.join(__dirname, '.smoke-failed');
const names = fs.existsSync(file)
  ? fs.readFileSync(file, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  : [];

if (!names.length) {
  console.log('no failed checks saved');
  process.exit(0);
}

console.log(`test:failed: re-running ${names.length} saved check(s): ${names.join(', ')}`);
const env = { ...process.env, SMOKE_ONLY: names.join(',') };
delete env.SMOKE_PART; // smoke.js refuses SMOKE_PART beside SMOKE_ONLY
const run = spawnSync(process.execPath, [path.join(__dirname, 'smoke.js')], { env, stdio: 'inherit' });
process.exit(run.status === null ? 1 : run.status);
