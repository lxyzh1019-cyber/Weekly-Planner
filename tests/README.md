# Tests

Before a change is pushed — the short loop, `npm run test:fast`:

```bash
npm ci              # once
npm run test:fast   # check + every unit suite (merge, buffers, stream, xp, money, sunday)
```

The test map is the `Tests:` lines in `FEATURES.md` (`## References`): for each
area or file, the tests a change there needs. The short loop plus the map's
Node suites stays under 3 minutes. The `SMOKE_ONLY=…` lists there are optional:
each one pays a few minutes of setup on a laptop, so they are outside the
3-minute short loop. The rules are in `ARCHITECTURE.md`, Verification.

Before a pull request opens — the full suite green on GitHub: the `checks` job,
the browser job (cleanup-tool tests), the picture job, and one smoke job per
date on all four dates, each smoke job about 8 minutes (accepted until a later stage brings every
job under 5 minutes). A pull request starts the run by itself; on a branch,
`gh workflow run ci.yml --ref <branch>`. `npm test` still runs all of it in one
process, but the smoke suite alone is over 30 minutes on a laptop, so it is not
run locally.

The parts, individually:

```bash
# 1. Syntax + global-scope checks (no dependencies)
npm run check         # tests/check-*.js: syntax, globals, shared-merge, escaping, look tokens, money words, dead CSS, dead ids, dead actions, CI scripts, SW shell

# 2. Sync/merge unit tests (no dependencies, runs the real merge functions)
npm run test:merge    # tests/merge.test.js — 112 assertions, must be 112/112

# 3. Headless-browser smoke test (boots the app, drives the main flows)
npm run test:smoke    # tests/smoke.js — screenshots land in tests/out/
```

## What each one is for

**`check-syntax.js`** runs `node --check` on every `js/*.js`. It replaces this
shell loop, which used to be documented here and is **broken**:

```bash
for f in js/*.js; do node --check "$f" || break; done && echo OK   # BROKEN
```

`break` returns 0, so the loop exits 0 even when a file fails to parse,
`&& echo OK` prints `OK`, and the actual error goes to stderr where anyone
skimming for `OK` misses it. Under CI it is a check that can never fail.

**`check-globals.js`** enforces one declaration per name. All 30 scripts load
into a single global scope, so two `function foo()` declarations mean the
later-loaded file silently wins, and two top-level `let`/`const` of one name is a
hard `SyntaxError` at load that per-file `node --check` cannot see. It covers
`function`, `async function`, and `let`/`const`/`var` including the
comma-separated form (`let a = null, b = null;`).

**`check-look-tokens.js`** fails on a colour or font typed outside the shared
values: a hex, `rgb()`/`hsl()` (in CSS also a named colour) or a font name,
in `css/app.css` outside a `:root` / look token block, or in `js/*.js` / `index.html`;
and on an absolute font size (px, rem, pt…) that does not multiply
`--text-scale`. A look is only another set of values for the same names, so a
typed value is a spot that stays in the old look. Data palettes, colour maths
and print-sheet sizes (print ignores the look) stay with a
`/* look: <reason> */` mark; once two looks exist, each must define every look token.

**`check-dead-ids.js`** fails on an `id` in `index.html` that nothing reads —
no `getElementById` in `js/`, no `for=` / `aria-*` back-reference, no `#id`
rule in the stylesheet. Names built at runtime (`'ptab-' + panel`) are found by
scanning the source for quoted prefixes and suffixes, not kept in a hand table.

**`check-dead-actions.js`** fails on a control with no code behind it: an
`onclick` calling a function nothing declares, or a `data-P-action` value that
prefix P's own dispatcher never handles. It warns, without failing, on values a
dispatcher compares against that no markup emits. Known dead controls are
exempted by name in its `EXEMPT` list, and an exemption fails the build once
its value is no longer emitted.

**`smoke.js`** covers, among much else, the chore -> money hand-off: a chore
finished in the planner reaching the parent's grading queue, and a grade given
in the meeting's step 1 showing up as the same figure on step 3. Those two are
worth keeping green -- when that join broke, every screen still rendered and
only the numbers were wrong, which is the kind of failure nobody notices until
a Sunday goes badly.

`smoke.js` needs a Chromium binary. It auto-detects Playwright browsers under
`/opt/pw-browsers` (Claude Code cloud environments have this pre-installed) or
`~/.cache/ms-playwright` (`npx playwright install chromium`), then on Windows
under `%LOCALAPPDATA%\ms-playwright` or an installed Google Chrome; elsewhere
set `SMOKE_CHROMIUM=/path/to/chrome`.

While working on a few checks, `SMOKE_ONLY=checkA,checkB npm run test:smoke`
runs only those (and `noConsoleErrors`) in a fraction of the full run's time.
It is for iteration only. The checks share one page, and a skipped check's
body does not run, so a subset can pass or fail where the full run would not.
That is why it names itself `PARTIAL RUN (SMOKE_ONLY): N of M checks — not a
pass of the suite`, exits 1 on a name that matches no check, and refuses to run
under CI. Give a new check the same `if (want('name'))` prefix as its
neighbours. A subset still pays all the setup between checks, a few minutes on
a laptop, whatever it names.

Every run times each check and the setup just before it, prints the slowest,
and writes `tests/out/smoke-ran-<date>.json`. To see where a CI run's time went:
`gh run download <run-id> -p 'smoke-screenshots-*' -D <folder>`, then
`node tools/smoke-times.js <folder>`.

The suite runs on a fixed date, never the real calendar: `SMOKE_DATE=YYYY-MM-DD`
(default `2026-10-07`) starts every page at noon Edmonton on that day and the
clock runs on from there. CI runs the smoke job once per date in a matrix --
`2026-10-15` (a weekday), `2026-10-11` (a Sunday), `2026-10-01` (the first of a
month) and `2026-10-07` -- so a check that only passes on some days fails there.

## The picture test

`npm run test:pictures` (`tests/pictures.js`) opens every screen and state the
consistency pass touches — the 13 screens, the Week view tabs, My money and
Money school, All my Sundays, By month, each parent tab including Now and the
Grown-ups tabs, each meeting step and the Sunday's steps, the four overlays
(Sunday, Grown-ups, request, told), one info sheet, one confirm dialog, every
other sheet (record, Sunday line, profile switch, slot picker, activity,
training, block edit, routine and training quick sheets, copy day, reflect,
custom activity / task / sport, weekly wins, level, ⋯ More, new challenge,
parent activity, new rule, new routine, chore group) and the quest pop-up — for
Jenn, Jess and the parent where the screen differs by user, at iPad 1194×834
and phone 390×844, in Pop and Calm. The list is the `STATES` table in the file.

Every picture boots from one fixed fixture (both girls, this week's plan, a
signed Sunday last week, a loan each, waiting requests, a goal each) at a fixed
clock, Wednesday 7 Oct 2026 12:00 in America/Edmonton, with a fixed
`Math.random`, reduced motion, no transitions and no caret, after the fonts
have loaded. Each picture is compared with `tests/reference/<state>-<user>-<ipad|phone>-<pop|calm>.png`
on canvases in the browser (no extra package); only the pictures that differ
are printed, with a diff in `tests/out/pictures-diff/`. A missing reference, or
a reference no state makes, is a failure. Every run first checks the compare
itself: a picture against itself gives 0 differences, and one planted changed
pixel is caught. The footer build line (`.app-build`, on the parent App panel
and the More sheet) is written as `Build 0000-00-00` before every shot, so a
new `APP_BUILD` needs no new pictures.

**Retries.** A picture that differs is shot again, alone, in a brand-new
browser context (a new renderer process), up to 2 times. It passes only when a
re-shot matches the reference exactly as the first shot must (2 levels per
channel, 0 pixels); each such pass is printed as "matched on retry N: <name>"
and counted in the summary. A picture that never matches fails with its diff.
Why: on the CI Linux runner colour emoji are scaled from a bitmap font, and
their edges came out a few levels apart between two runs of the same code. The
self-check does not retry. `PICTURES_UPDATE=1` takes no retries.

**Local vs CI.** References are made and compared only on the CI Linux runner;
fonts and the browser build differ elsewhere. Without `CI` set the test reports
differences and exits 0 ("local run — not gating"). In CI it gates, and an
empty `tests/reference/` is a failure ("no references in tests/reference/");
a local run with no references writes the fresh set and exits 0.

**Refreshing references.** Every run writes the fresh set to
`tests/out/pictures-new/`, and CI uploads it (with the diffs) as the artifact
`pictures`. Download it from the CI run of the branch and copy
`pictures-new/*.png` into `tests/reference/` in the same pull request as the
change. `PICTURES_UPDATE=1 npm run test:pictures` writes references from this
machine instead — for trying the test locally only; do not commit them.

**Its own CI job.** The pictures keep their own clock (Wed 2026-10-07 12:00
Edmonton) and do not read `SMOKE_DATE`, so CI runs them once per run, in the
`pictures` job, side by side with the four smoke jobs. It installs the browser
from the caches the `browser` job saved, and uploads the `pictures` artifact
whether it passes or fails.

## CI

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`,
plus nightly and on demand. Jobs: `checks` (no browser: `npm run check` and every
unit suite), `browser` (installs Chromium and its system packages once, caches
both, runs the cleanup-tool tests), `smoke`, one job per date, which
installs the browser from those caches and uploads `tests/out/` as an artifact
(`smoke-screenshots-<date>`) so a layout regression is visible in the run
itself, and `pictures`, the picture test (above) on one fixed clock, which
installs the browser from the same caches and uploads the artifact `pictures`.

When asking Claude (or anyone) to change this app, ask them to **run the short
loop and the map's tests before pushing, and attach the smoke-test screenshots
from the GitHub run** before the pull request opens. New features
should come with a new check in `smoke.js`.
