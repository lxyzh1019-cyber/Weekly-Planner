// Smoke times from a CI run: node tools/smoke-times.js <folder> [top]. <folder> holds the run's artifacts (gh run download <run-id> -p 'smoke-screenshots-*' -D <folder>); every smoke-ran-<date>.json in it is read.
const fs = require('fs');
const path = require('path');

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
const runs = files.map(f => JSON.parse(fs.readFileSync(f, 'utf8'))).sort((a, b) => a.date.localeCompare(b.date));

console.log('Per date: wall, time in checks, setup between checks, failed checks');
for (const r of runs) {
  const failed = Object.entries(r.checks || {}).filter(([, ok]) => !ok).map(([k]) => k);
  console.log(`  ${r.date} (${r.run}): ${sec(r.wallMs)} wall, ${sec(sum(r.ms))} in ${Object.keys(r.ms || {}).length} checks, `
    + `${sec(r.wallMs - sum(r.ms))} setup${failed.length ? `, FAILED: ${failed.join(', ')}` : ''}`);
  for (const [k, v] of Object.entries(r.ms || {})) ms[k] = Math.max(ms[k] || 0, v);
  for (const [k, v] of Object.entries(r.setup || {})) setup[k] = Math.max(setup[k] || 0, v);
}
const list = (title, m, prefix) => {
  console.log(`${title} (slowest over every date, top ${top}):`);
  Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, top)
    .forEach(([name, v]) => console.log(`  ${String(v).padStart(7)} ms  ${prefix}${name}`));
};
list('Checks', ms, '');
list('Setup between checks', setup, 'before ');
