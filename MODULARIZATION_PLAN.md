# Plan: splitting index.html into modules

`index.html` is 15,627 lines: CSS on lines 16–4024, HTML body, and one inline
`<script>` on lines 5259–15625 with ~530 functions. This plan splits it into
one CSS file and ~14 JS files with **no behaviour change**, validated by the
existing tests at every step.

## Ground rules (what makes this low-risk)

### Classic scripts, not ES modules

The earlier draft proposed `<script type="module">`. Checking the repo showed
that would break three things at once:

- `tests/smoke.js` opens the app via `file://` — Chrome blocks ES module
  imports under `file://`, so the smoke test (and anyone opening the file
  directly) would stop working.
- `smoke.js` drives the app through **global** functions
  (`page.evaluate(() => selectProfile('jenn'))` etc.). ES module exports
  aren't global, so every such call would need a shim.
- The 231 inline `onclick="..."` handlers would each need a
  `window.foo = foo` shim.

Instead, split into **plain classic scripts** loaded in order:

```html
<link rel="stylesheet" href="css/app.css">
...
<script src="js/01-config.js"></script>
<script src="js/02-state.js"></script>
...
<script src="js/99-main.js"></script>
```

Classic scripts share one global scope — top-level `function`, `var`, `let`,
and `const` declarations are all visible across files, exactly like today's
single block. So:

- **No shims.** All 231 onclick handlers keep working untouched.
- **No server requirement.** `file://` keeps working; `smoke.js` needs no
  changes; deployment is still plain static files.
- Every extraction is a pure cut-and-paste of lines from `index.html` into a
  file. The code itself never changes — only its location.

ES modules can still happen later as a separate phase if encapsulation ever
becomes worth it; this split delivers all of the readability and bug-tracing
value on its own.

### One constraint: declarations early, execution last

Today, function hoisting lets top-level boot code call functions defined
thousands of lines later. Across separate script files, a top-level statement
that *runs at load time* can only call functions from files loaded **before**
it. Rule:

- Files `01`–`13` contain only declarations (`function`, `const` data tables,
  `let` state variables).
- All top-level *executable* code — Firebase boot, event-listener wiring,
  the initial render call — moves to `js/99-main.js`, loaded last.

When extracting a range, grep it for top-level statements (anything at column
0 that isn't a declaration) and route those lines to `99-main.js` instead.

### Verification after every step (all mechanical)

```bash
# 1. Syntax-check every extracted file
for f in js/*.js; do node --check "$f" || exit 1; done

# 2. Merge-layer unit tests
node tests/merge.test.js

# 3. Full smoke test
node tests/smoke.js
```

Additionally, because every step is a pure move, `git diff --color-moved` on
the commit should show only moved blocks — any red/green line that isn't part
of the `<script src>` / `<link>` scaffolding is a mistake.

## Test-suite touchpoints

- **`tests/merge.test.js`** currently regex-extracts the merge functions out
  of the inline `<script>`. It breaks at step 3 (sync split) unless updated.
  Fix is an upgrade, not a workaround: end `js/04-sync.js` with

  ```js
  if (typeof module !== 'undefined') {
    module.exports = { mergeArrayById, ensureTombstones, tombstoneBlockIds,
      blockTombstoned, tombstoneIds, mergeTombstones, isPlainObject,
      deepMergeObj, mergeChoreState, mergeWeeks, mergeProfileState };
  }
  ```

  and replace the test's brace-matching extractor with
  `require('../js/04-sync.js')`. The tests then run the real file directly
  and stop depending on fragile string parsing. (The `module` guard is inert
  in the browser.)
- **`tests/smoke.js`**: no changes needed at any step.

## Target layout

```
css/app.css
js/01-config.js       Firebase config, constants, colour tables, presets,
                      templates, reward pools (~top 400 lines of the script)
js/02-state.js        state object, profile/weekOffset/edit-state variables,
                      load/save/localStorage
js/03-utils.js        pure helpers (time math, formatting, ids, DOM helpers)
js/04-sync.js         Firestore sync + the whole merge/tombstone layer
js/05-activities.js   activity CRUD, categories, filter chips
js/06-blocks.js       block CRUD, buffers, conflicts, checklist state
js/07-day-view.js
js/08-week-view.js
js/09-print.js        print + sheets views
js/10-parent.js
js/11-chores.js
js/12-meetings.js
js/13-goals.js
js/99-main.js         boot sequence, global event wiring, initial render
```

Numbered prefixes make load order self-documenting. Exact groupings can flex
— the numbering just has to match real dependency-at-load-time order, which
for declaration-only files is trivially satisfied.

## Steps (each one ships independently, tests green before push)

0. **Table of contents + section banners** in the inline script (the
   "lighter-weight alternative" from the earlier draft — now step 0, not an
   alternative). Doing this first forces the grouping decisions cheaply and
   turns every later step into "cut between two banners".
1. **CSS → `css/app.css`.** Mechanical, zero JS risk.
2. **`js/01-config.js`** — pure constant data, no logic. Proves the
   multi-file pattern with the safest possible content.
3. **`js/04-sync.js` + merge.test.js switch to `require()`.** The step
   validates itself: the exact code being moved is the code the unit tests
   exercise.
4. **`js/03-utils.js`, then `js/02-state.js`.**
5. **`js/05-activities.js`, then `js/06-blocks.js`.** Highest value —
   blocks.js is where recent bugs (buffer conflicts, category filters, the
   remove/save regression) actually lived.
6. **View files, one per commit:** day → week → print/sheets.
7. **`10`–`13`** (parent, chores, meetings, goals) — most self-contained.
8. **`js/99-main.js`** — whatever executable code remains in the inline
   block moves out; `index.html` ends up with markup plus `<script src>`
   tags only.

## Sizing

With no shim work and no handler migration, each step is: pick a banner-to-
banner range, cut, paste, run the three checks, commit. Realistically **4–6
short sessions** (the earlier estimate of 8–15 assumed the ES-module shim
work). Steps 0–3 fit comfortably in one session. It can still ride alongside
feature work — extract whichever module the next feature touches first.

## Gotchas to watch

- Top-level executable statements hiding mid-file (an IIFE, an
  `addEventListener` between two functions) must move to `99-main.js`, not
  travel with their neighbours.
- A `let`/`const` accidentally extracted into two files throws a
  redeclaration `SyntaxError` at load — the smoke test catches this
  instantly (page won't boot).
- The Firebase SDK `<script defer>` tags stay in `<head>`; the code that
  waits for them lives in `99-main.js`, same as it effectively does today.
- After deploying a split step, hard-refresh (or append `?v=` to the script
  URLs) if the host caches aggressively.
