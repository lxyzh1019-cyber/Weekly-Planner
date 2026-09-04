// Weekly-Planner — unarbitrated shared-state guard.
//
// Every mutation uploads the whole document, and `mergeRemoteState`
// (js/03-sync.js) decides what happens when the copy coming back disagrees with
// the copy on this device. It merges `state.shared` as:
//
//     state.shared = { ...ls, ...rs, invites: …, chore: …, tombstones: … };
//
// Keys named in that literal get a real arbitration. **Every other key falls
// through `...rs` and is replaced wholesale by whatever the remote holds.** For
// a scalar setting that is fine. For anything editable it is silent data loss:
// an edit made on the iPad and not yet pushed is gone the moment the phone's
// snapshot lands, with nothing on any screen to say so.
//
// That is not a hypothetical. Four keys were added to `state.shared` by later
// feature work — `weeksClosed`, `parentDayConfirm`, `schoolCal` and
// `builtInRoutineOverrides` — each with its own passing tests, none with a
// merge decision. `parentDayConfirm` records which days a parent has reviewed
// and gates `canCloseWeek`, so losing it also jams the week shut with no
// explanation.
//
// The reason no test caught it: every check in this repo runs on ONE device.
// tests/smoke.js blocks every Firebase host at the network layer, so "two
// devices disagree" is not under-tested, it is invisible to the harness. This
// script exists for the same reason tests/check-globals.js does — to catch, in
// the build, a class of defect that per-file checking and single-device tests
// structurally cannot see.
//
// The rule: adding a key to `state.shared` IS a merge-layer decision. Make it
// here, not later.
//
// Two ways to satisfy this check:
//
//   1. Name the key in the literal returned by `mergeSharedState` (js/04-merge.js),
//      with a merge function that arbitrates it.
//
//   2. If last-write-wins really is correct — a scalar setting where the two
//      devices cannot meaningfully disagree — declare it in js/03-sync.js:
//
//          // lww: parentPin — a scalar; the newer of two PINs is the answer.
//
//      The reason is required and is the point of the marker: it forces the
//      decision to be made and read, the same way `/* safe: … */` does in
//      tests/check-escaping.js.
//
// Run via `npm run check`.

const fs = require('fs');
const path = require('path');

const JS_DIR = path.join(__dirname, '..', 'js');
const MERGE_FILE = '04-merge.js';   // where mergeSharedState lives

const read = f => fs.readFileSync(path.join(JS_DIR, f), 'utf8');
const files = fs.readdirSync(JS_DIR).filter(f => f.endsWith('.js')).sort();

/* ── 1. Every top-level key the app uses under state.shared ──────────────── */
// key -> [{ file, line }], first few sites only; they are for the error report.
const used = new Map();
for (const file of files) {
  read(file).split('\n').forEach((text, i) => {
    // Strip line comments so a key named only in prose is not counted.
    const code = text.replace(/\/\/.*$/, '');
    const re = /\bstate\.shared\.([A-Za-z_$][A-Za-z0-9_$]*)/g;
    let m;
    while ((m = re.exec(code)) !== null) {
      if (!used.has(m[1])) used.set(m[1], []);
      const sites = used.get(m[1]);
      if (sites.length < 4) sites.push({ file, line: i + 1 });
    }
  });
}

/* ── 2. The keys mergeRemoteState actually arbitrates ────────────────────── */
// Walk the `state.shared = { … }` literal by brace depth rather than by regex,
// so a nested object in a value can never be mistaken for another key.
const syncLines = read(MERGE_FILE).split('\n');
const arbitrated = new Set();
const fnAt = syncLines.findIndex(l => /^function mergeSharedState\b/.test(l));
// Count from the `return {` rather than the signature, so the object literal's
// own keys sit at depth 1 and nothing nested in a value can be mistaken for one.
let start = fnAt === -1 ? -1 : syncLines.findIndex((l, i) => i > fnAt && /^\s*return\s*\{\s*$/.test(l));
if (start === -1) {
  console.error(`FAIL  could not find mergeSharedState in js/${MERGE_FILE}.`);
  console.error('      This guard reads its object literal to learn which keys are arbitrated.');
  console.error('      If the merge was restructured, teach this script the new shape.');
  process.exit(1);
}
{
  let depth = 0;
  for (let i = start; i < syncLines.length; i++) {
    const code = syncLines[i].replace(/\/\/.*$/, '');
    const before = depth;
    if (before === 1) {
      const m = code.match(/^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*:/);
      if (m) arbitrated.add(m[1]);
    }
    for (const c of code) {
      if (c === '{') depth++;
      else if (c === '}') depth--;
    }
    if (i > start && depth <= 0) break;
  }
}

/* ── 3. Keys explicitly declared last-write-wins, with a reason ──────────── */
const lww = new Map();
const lwwNoReason = [];
syncLines.forEach((text, i) => {
  const m = text.match(/^\s*\/\/\s*lww:\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*(.*)$/);
  if (!m) return;
  const reason = m[2].replace(/^[—\-–:\s]+/, '').trim();
  if (reason.length < 12) lwwNoReason.push({ key: m[1], line: i + 1 });
  else lww.set(m[1], reason);
});

/* ── 4. Report ───────────────────────────────────────────────────────────── */
const unhandled = [...used.keys()]
  .filter(k => !arbitrated.has(k) && !lww.has(k))
  .sort();

if (lwwNoReason.length) {
  console.error('FAIL  an `lww:` marker must say WHY last-write-wins is correct:\n');
  for (const { key, line } of lwwNoReason) {
    console.error(`  ${key}   js/${SYNC_FILE}:${line}`);
  }
  console.error('\nWrite it as:  // lww: someKey — a scalar setting; two devices cannot');
  console.error('meaningfully disagree, so the newer value is the answer.');
  process.exit(1);
}

/* ── 5. Deletes inside state.shared.chore ────────────────────────────────── */
// `chore` IS arbitrated — by mergeSharedChore — but its base is deepMergeObj,
// which iterates `Object.keys(remote)`. A deleted key is an ABSENCE, and an
// absence cannot be expressed by iterating what the other side has: the remote
// copy simply puts it back. So `delete` inside this tree is write-only. It
// appears to work on the device that did it and is undone by the next snapshot.
//
// This is how reopening a week broke. `setWeekClosed(wk, false)` deleted
// `weeksClosed[wk]`, so a close always won and a reopen never travelled — and
// `reflIsLocked` re-locked both girls' reflections behind it.
//
// The fix is to make the removal SAYABLE. `ctStampWeekState(wk)` stamps the
// week, and a stamped week is handed to the newer side whole across all eight
// week-state maps — including the keys it does not have, which is how one
// device tells another that something was taken back. A tombstone is the other
// way to say it, for id-keyed collections.
//
// Mark a genuine exception with a reason on the same line or the line above:
//
//     // safe-delete: purely local scratch, never reaches state.shared
const choreDeletes = [];
for (const file of files) {
  const lines = read(file).split('\n');
  // Local aliases of state.shared.chore, e.g. `const c = state.shared.chore;`
  const aliases = new Set(['state.shared.chore']);
  for (const text of lines) {
    const m = text.match(/(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*state\.shared\.chore\s*;/);
    if (m) aliases.add(m[1]);
  }
  lines.forEach((text, i) => {
    const code = text.replace(/\/\/.*$/, '');
    if (!/\bdelete\s/.test(code)) return;
    // The marker may sit on the line itself or in the comment immediately above
    // it — a few lines of it, since the reason is usually worth a sentence.
    if (/safe-delete:/.test(text)) return;
    if (lines.slice(Math.max(0, i - 4), i).some(l => /safe-delete:/.test(l))) return;
    for (const alias of aliases) {
      const esc = alias.replace(/[.$]/g, '\\$&');
      if (new RegExp(`\\bdelete\\s+${esc}\\.`).test(code)) {
        choreDeletes.push({ file, line: i + 1, text: text.trim() });
        break;
      }
    }
  });
}

if (choreDeletes.length) {
  console.error(`FAIL  ${choreDeletes.length} delete(s) inside state.shared.chore:\n`);
  for (const d of choreDeletes) {
    console.error(`  js/${d.file}:${d.line}`);
    console.error(`      ${d.text}`);
    console.error('');
  }
  console.error('mergeSharedChore merges this tree with deepMergeObj, which iterates the');
  console.error('keys the REMOTE has. An absence cannot be expressed that way, so the');
  console.error('remote copy puts the deleted key straight back on the next snapshot —');
  console.error('the delete works on this device only, until the next sync undoes it.');
  console.error('');
  console.error('Stamp the week with ctStampWeekState (js/13-chores.js) so the newer');
  console.error('side takes it whole across every week-state map, absence included — or');
  console.error('record a tombstone, for an id-keyed collection. Then say which, here:');
  console.error('');
  console.error('    // safe-delete: stamped by ctStampWeekState below');
  process.exit(1);
}

if (!unhandled.length) {
  console.log(`OK  ${used.size} state.shared keys, all with a merge decision `
            + `(${arbitrated.size} arbitrated, ${lww.size} declared last-write-wins)`);
  process.exit(0);
}

console.error(`FAIL  ${unhandled.length} state.shared key(s) with no merge decision:\n`);
for (const key of unhandled) {
  console.error(`  ${key}`);
  for (const s of used.get(key)) console.error(`      js/${s.file}:${s.line}`);
  console.error('');
}
console.error(`mergeSharedState (js/${MERGE_FILE}) spreads the remote copy over the local`);
console.error('one, so a key it does not name is REPLACED WHOLESALE on every snapshot —');
console.error('any local edit not yet pushed is lost, silently, on every device.');
console.error('');
console.error('Either arbitrate the key in mergeSharedState (js/04-merge.js), or, if');
console.error('last-write-wins is genuinely right for it, say so and say why:');
console.error('');
console.error('    // lww: theKey — a scalar setting; the newer value is the answer.');
process.exit(1);
