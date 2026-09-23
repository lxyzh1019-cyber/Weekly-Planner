// Weekly-Planner — every shipped script reaches the offline shell.
//
// index.html loads the app as plain <script src> tags, and sw.js caches a
// hand-written SHELL list so an installed device opens without signal. Those
// are two lists that have to agree, and nothing made them — exactly the shape
// of the package.json/ci.yml split that tests/check-ci-scripts.js exists for.
//
// A script in one and not the other is INVISIBLE UNTIL THE DEVICE IS OFFLINE.
// The worker is network-first, so online everything is fetched and nothing
// looks wrong. Offline, every listed script comes from cache, the unlisted one
// fails, and its globals are simply undefined — which in a classic-script app
// sharing one scope means the first caller throws.
//
// Not hypothetical: js/40-stream.js shipped this way. Online it was perfect;
// offline every `ev*` function was undefined, so `moneyAddCash` — and with it
// every gift, every settlement and every loan payment — threw on the first tap.
//
// This also fails the build when SW_VERSION was not bumped in a commit that
// changed a shell file. That is the manual step the repo's no-build rule costs
// (sw.js says so itself), and a manual step nothing checks is a step that gets
// missed: an installed device keeps serving the old offline copy for as long as
// the worker lives.
//
// Deliberately a string match rather than an HTML parse: this repo has no build
// step and one devDependency, and a <script src> tag is unambiguous enough to
// read. A guard that needed a parser would be a guard with a reason not to run.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const swPath = path.join(ROOT, 'sw.js');

if (!fs.existsSync(swPath)) {
  console.error('FAIL  no sw.js — the installed app has no offline shell');
  process.exit(1);
}
const sw = fs.readFileSync(swPath, 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const problems = [];

// ── 1 · index.html and the SHELL name the same scripts ──
const inHtml = [...html.matchAll(/<script\s+src="([^"]+)"/g)]
  .map(m => m[1])
  .filter(src => !/^https?:/.test(src))        // the Firebase CDN is never cached
  .map(src => src.replace(/^\.\//, ''));
const inShell = [...sw.matchAll(/'\.\/(js\/[^']+)'/g)].map(m => m[1]);

inHtml.forEach(src => {
  if (!inShell.includes(src)) {
    problems.push(`index.html loads "${src}" and sw.js never caches it — it will 404 offline`);
  }
});
inShell.forEach(src => {
  if (!inHtml.includes(src)) {
    problems.push(`sw.js caches "${src}" and index.html does not load it`);
  }
});

// ── 2 · every script ON DISK is loaded ──
// A file nobody loads is dead weight; a file loaded but not on disk is a 404
// on every boot, online and off.
fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).forEach(f => {
  if (!inHtml.includes('js/' + f)) {
    problems.push(`js/${f} exists and index.html never loads it`);
  }
});

// ── 3 · SW_VERSION moved when a shell file did ──
// Only checkable against a git history, so a shallow clone or an export skips
// it rather than failing on something it cannot see.
const version = (sw.match(/const SW_VERSION = '([^']+)'/) || [])[1];
if (!version) {
  problems.push('sw.js has no SW_VERSION to bump');
} else {
  /* Committed work AND the working tree. Comparing only against HEAD would
     warn a developer about a missed bump after they had already committed it,
     which is exactly one commit too late to be useful. */
  let changed = null;
  const collect = (cmd) => {
    try {
      /* Split BEFORE trimming. `git status --porcelain` puts the status in the
         first two columns, so " M sw.js" begins with a space — and trimming the
         whole output eats it, shifting that one line two characters and turning
         the path into "w.js". Every other line survives, so the bug reads as
         "the guard ignores the first file I changed". */
      return execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
        .toString().split('\n').filter(line => line.trim());
    } catch (err) {
      return null;                             // no git, or no origin/main to compare against
    }
  };
  const committedRaw = collect('git diff --name-only origin/main...HEAD');
  const committed = (committedRaw || []).map(l => l.trim());
  const working = (collect('git status --porcelain') || [])
    .map(line => line.slice(3).trim())         // two status columns, then a space
    .map(f => f.replace(/^.* -> /, ''));       // a rename reports "old -> new"
  if (committedRaw) changed = [...new Set(committed.concat(working))];
  if (changed && changed.length) {
    const shellTouched = changed.some(f =>
      f === 'index.html' || f === 'css/app.css' || f === 'manifest.json' || /^js\/.+\.js$/.test(f));
    const swTouched = changed.includes('sw.js');
    if (shellTouched && !swTouched) {
      problems.push(
        'this branch changes a shell file and never touches sw.js — bump SW_VERSION, '
        + 'or an installed device keeps serving the old offline copy');
    }
  }
}

// ── 4 · the visible build stamp names the same build ──
// APP_BUILD (js/01-config.js) is what the Today More sheet and the parent
// portal's App landing print, so a grown-up can read which build a device is
// running. The page cannot read sw.js, so the stamp is a second copy of
// SW_VERSION; two copies nothing compares drift, and a stamp that reads "new"
// on a device serving the old offline shell is worse than no stamp. Same
// string match as SW_VERSION above.
const config = fs.readFileSync(path.join(ROOT, 'js', '01-config.js'), 'utf8');
const build = (config.match(/const APP_BUILD = '([^']+)'/) || [])[1];
if (!build) {
  problems.push("js/01-config.js has no APP_BUILD — the page has no build stamp to show (const APP_BUILD = '<same as SW_VERSION>';)");
} else if (version && build !== version) {
  problems.push(
    `APP_BUILD in js/01-config.js is '${build}' but SW_VERSION in sw.js is '${version}' — `
    + 'set both to the same value; a device shows APP_BUILD as the build it is running');
}

if (problems.length) {
  console.error(`FAIL  ${problems.length} offline-shell problem(s):\n`);
  problems.forEach(p => console.error('  ' + p));
  console.error('\nsw.js is network-first, so none of this shows online. It shows');
  console.error('the first time a child opens the app without signal.');
  process.exit(1);
}
console.log(`OK  ${inShell.length} scripts, all loaded and all cached (SW_VERSION ${version} = APP_BUILD)`);
