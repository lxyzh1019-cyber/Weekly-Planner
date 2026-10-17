// Weekly-Planner — syntax check every app script.
//
// Replaces the shell loop that used to be documented here and in CLAUDE.md:
//
//   for f in js/*.js; do node --check "$f" || break; done && echo OK
//
// That form is broken. `break` returns 0, so the `for` loop exits 0 even when
// `node --check` failed, `&& echo OK` fires, and the check reports success on a
// file with a syntax error — while the real error goes to stderr where a reader
// skimming for "OK" misses it. In CI it would be a check that can never fail.
//
// This script checks every js/*.js, reports each failure, and exits non-zero if
// any file is bad. Run via `npm run check`.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const JS_DIR = path.join(__dirname, '..', 'js');
const files = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js')).sort();

const failed = [];

for (const file of files) {
  const res = spawnSync(process.execPath, ['--check', path.join(JS_DIR, file)], {
    encoding: 'utf8'
  });
  if (res.status !== 0) {
    failed.push(file);
    console.error(`FAIL js/${file}`);
    console.error((res.stderr || '').trimEnd());
    console.error('');
  }
}

if (failed.length) {
  console.error(`${failed.length} of ${files.length} file(s) failed the syntax check:`);
  for (const f of failed) console.error(`  js/${f}`);
  process.exit(1);
}

console.log(`OK  ${files.length} files pass node --check`);
