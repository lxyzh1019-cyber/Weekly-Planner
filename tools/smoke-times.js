// Smoke times from a CI run: node tools/smoke-times.js <folder> [top]. <folder> holds the run's artifacts (gh run download <run-id> -p 'smoke-screenshots-*' -D <folder>); every smoke-ran-<date>.json and smoke-ran-<date>-part<N>.json in it is read, and a date run in parts is checked to have run every smoke check exactly once.
const fs = require('fs');
const path = require('path');
const { smokeCheckNames, EVERY_PART } = require('../tests/smoke-parts/parts.js');

const dir = process.argv[2];
const top = Number(process.argv[3] || 20);
if (!dir) { console.error('usage: node tools/smoke-times.js <artifact folder> [top]'); process.exit(1); }

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (/^smoke-ran-.*\.json$/.test(e.name)) files.push(p);
  }
})(dir);
if (!files.length) { console.error(`no smoke-ran-*.json under ${dir}`); process.exit(1); }

const sum = (m) => Object.values(m || {}).reduce((s, x) => s + x, 0);
const sec = (ms) => `${Math.round(ms / 1000)} s`;
const ms = {}, setup = {};   // per name: the slowest over every date
// The part is in the file name (smoke-ran-<date>-part<N>.json), not in the file.
const runs = files.map(f => Object.assign(JSON.parse(fs.readFileSync(f, 'utf8')),
  { part: (/-part(\d+)\.json$/.exec(f) || [])[1] || '' }))
  .sort((a, b) => a.date.localeCompare(b.date) || a.part.localeCompare(b.part));

console.log('Per date: wall, time in checks, setup between checks, failed checks');
for (const r of runs) {
  const failed = Object.entries(r.checks || {}).filter(([, ok]) => !ok).map(([k]) => k);
  console.log(`  ${r.date}${r.part ? ` part ${r.part}` : ''} (${r.run}): ${sec(r.wallMs)} wall, ${sec(sum(r.ms))} in ${Object.keys(r.ms || {}).length} checks, `
    + `${sec(r.wallMs - sum(r.ms))} setup${failed.length ? `, FAILED: ${failed.join(', ')}` : ''}`);
  for (const [k, v] of Object.entries(r.ms || {})) ms[k] = Math.max(ms[k] || 0, v);
  for (const [k, v] of Object.entries(r.setup || {})) setup[k] = Math.max(setup[k] || 0, v);
}

// A date run in parts: the parts' check lists together must be the whole suite,
// each check once (EVERY_PART checks once per part), against today's check names.
const all = smokeCheckNames();
const byDate = {};
runs.filter(r => r.part).forEach(r => (byDate[r.date] = byDate[r.date] || []).push(r));
if (Object.keys(byDate).length) console.log('Parts together, per date (every smoke check exactly once):');
for (const [date, parts] of Object.entries(byDate)) {
  const seen = {};
  parts.forEach(r => Object.keys(r.checks || {}).forEach(n => { seen[n] = (seen[n] || 0) + 1; }));
  const missing = all.filter(n => !seen[n]);
  const twice = Object.keys(seen).filter(n => !EVERY_PART.includes(n) && seen[n] > 1);
  const unknown = Object.keys(seen).filter(n => !all.includes(n));
  const ok = !missing.length && !twice.length && !unknown.length;
  console.log(`  ${date}: parts ${parts.map(r => r.part).join(', ')}, ${Object.keys(seen).length} of ${all.length} checks`
    + (ok ? ' — OK' : '')
    + (missing.length ? `, MISSING: ${missing.join(', ')}` : '')
    + (twice.length ? `, IN TWO PARTS: ${twice.join(', ')}` : '')
    + (unknown.length ? `, NOT IN THE SUITE: ${unknown.join(', ')}` : ''));
}
const list = (title, m, prefix) => {
  console.log(`${title} (slowest over every date, top ${top}):`);
  Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, top)
    .forEach(([name, v]) => console.log(`  ${String(v).padStart(7)} ms  ${prefix}${name}`));
};
list('Checks', ms, '');
list('Setup between checks', setup, 'before ');
