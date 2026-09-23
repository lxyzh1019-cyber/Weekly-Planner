# ARCHITECTURE.md — Weekly-Planner

Operating rules for any agent session on this repo. Read this first, every session.

Global working rules that apply across all repos are in `CLAUDE.md` at the root;
this file is the Weekly-Planner's own. It was itself `CLAUDE.md` until the
working-rules bundle took that filename, so every "see CLAUDE.md" comment in
`js/` and `tests/` refers to this document.

## What this is

A single-family weekly planner for two kids (Jenn, Jess) plus a parent role.
Static site, no build step, deployed to GitHub Pages. Cloud sync via Firebase
Firestore (compat SDK, loaded from CDN). Part of a wider family-app ecosystem
sharing the Firebase project `chore-tracker-a461b`.

Primary devices: an iPad and a phone, used by children. Assume touch, assume
short attention, assume the reader is 9–13.

## Architecture — the constraints that must not be broken

**Classic scripts, not ES modules.** `index.html` loads `js/01-*.js` …
`js/99-main.js` as plain `<script src>` tags sharing one global scope. This is a
deliberate decision, documented in `MODULARIZATION_PLAN.md`. Do not "modernise"
it. Three things break if you do:

- `tests/smoke.js` opens the app over `file://`; Chrome blocks ES module imports
  there, so the entire smoke suite dies.
- `smoke.js` drives the app through **global** function calls
  (`page.evaluate(() => selectProfile('jenn'))`).
- There are ~272 inline `onclick="…"` attributes (160 in `index.html`, ~112
  generated in JS) that resolve against the global scope.

No bundler, no npm build, no framework. Files must stay directly loadable.

**Load-order rule.** Files `01`–`29` contain **declarations only** — `function`,
`const` data tables, `let` state. All top-level *executable* code (Firebase boot,
event wiring, first render) lives in `js/99-main.js`, loaded last. Function
hoisting means a declaration in `05` may freely *call* something declared in
`22`; it just must not *run* at load time.

Current permitted exceptions (do not add more): `js/08-day-view.js:1351-1352`
(two `window.addEventListener` calls that only register), `js/17-ui-misc.js:159`
(the self-contained `installActionDoubleTapGuard` IIFE), and the
`module.exports` guards at the end of `04-merge.js`, `18-rules.js`,
`21-money-data.js`. (`js/03-sync.js`'s `window._skipRewardPrompt = false` was a
fourth. It was written once and read nowhere, and went with the activity-unlock
subsystem below.)

**One declaration per name, globally.** All 36 files share one scope, so a
duplicate `function foo()` in two files means the later one silently wins. A
`let`/`const` declared twice is a hard `SyntaxError` at load. Before adding a
top-level name, grep for it across `js/`.

## Verification — run all three before any push

```bash
npm ci      # once
npm test    # runs everything below, stops at the first failure
```

Or individually:

```bash
# 1. Syntax check every module + the duplicate-name guard
npm run check

# 2. Merge-layer unit tests (90 checks, must be 90/90)
npm run test:merge

# 3. The calibrated XP values (see tools/xp-calibrate.js)
npm run test:xp

# 3b. The calibrated MONEY values (see tools/money-calibrate.js)
npm run test:money

# 4. Headless smoke test — boots the app, drives the main flows
npm run test:smoke          # screenshots land in tests/out/
```

`npm run check` runs `tests/check-syntax.js`, `tests/check-globals.js`,
`tests/check-shared-merge.js`, `tests/check-escaping.js`, `tests/check-dead-css.js`,
`tests/check-dead-ids.js`, `tests/check-dead-actions.js` and `tests/check-sw-shell.js` (an `id` in `index.html` that nothing reads — the
same blind spot as dead CSS, with runtime-built prefixes discovered from the
source rather than listed by hand). **Do not go back to the old shell loop** —

```bash
for f in js/*.js; do node --check "$f" || break; done && echo OK   # BROKEN
```

`break` returns 0, so the loop exits 0 even when a file fails, `&& echo OK`
fires, and the check reports success while the real error scrolls past on
stderr. Under CI it is a check that can never fail. `tests/check-syntax.js`
exists because of this.

A check in `smoke.js` passes only by being exactly `true`. The house idiom
`checks.x = cond || [whatWentWrong]` returns a **truthy array** on failure, so
while the runner used `filter(([,v]) => !v)` all eight checks written that way —
the 44px target audit among them — printed their findings and were then counted
as passes. Same shape as the `|| break` bug above: a test that reports a problem
and returns success. If you add a check, return `true` or the findings, never a
bare truthy value.

**And never a bare `false` either.** Around fifty checks end
`return thisThing && thatThing && theOther;`, where every one of those names was
already computed and already meant something — and all of it is thrown away, so
a failure says which check broke and nothing about why. That is not
hypothetical: one change to the meeting broke three of them at once and finding
out which sub-condition was false cost an extra full run of the suite *per
check*, at eight to ten minutes each. `meetingMoneyFlowEndToEnd`,
`tabBarOnEveryMoneySurface` and `newAffordancesActuallyNavigate` are converted;
the rest are the same shape and the same fix — build a `problems` array, push a
sentence naming the surface and the expectation, `return problems.length ?
problems : true`.

**A control with no code behind it fails the build.** `tests/check-dead-actions.js`
holds two rules. Every function an `onclick` calls — in `index.html` and in the
templates in `js/` — must be declared at the top level of `js/`. And every
`data-P-action="V"` must be handled by prefix **P's own** dispatcher: the
selector `[data-P-action="V"]`, or `V` compared (`=== 'V'`, `case 'V'`, `'V':`,
`['V']`) inside a top-level function that reads `dataset.<p>Action` or
`'data-P-action'`, or one that function hands the action to. Scoped per prefix
because "does 'V' appear anywhere" is wrong both ways — it passed a dead
`data-pm-action="edit"` because another prefix handles an `'edit'`. Function
extents come from a lexer that tells strings, templates, comments and regexes
apart. A prefix nothing reads fails outright. A value compared in a reader that
no markup emits is dead handler code, but a value may be built at runtime, so
that is a **warning**, not a failure. The one known dead control, `pm/edit`, is
exempt by name, and the exemption **expires**: once nothing emits it, the check
fails until the entry is deleted.

`tests/check-globals.js` enforces the one-declaration-per-name rule above,
covering `function`, `async function` and top-level `let`/`const`/`var`
(including the comma-separated form) — a duplicate `let` is a load-time
`SyntaxError` that per-file `node --check` cannot see.

`smoke.js` auto-detects Chromium under `/opt/pw-browsers` or
`~/.cache/ms-playwright` (`npx playwright install chromium`); elsewhere set
`SMOKE_CHROMIUM=/path/to/chrome`.

**Iterating on a few smoke checks:** `SMOKE_ONLY=checkA,checkB npm run test:smoke`
runs just those (plus `noConsoleErrors`, which has no guard) in a fraction of the
full run's time. Each check statement is prefixed `if (want('name'))`, so the setup
between checks still runs — but a skipped check's own body does not, and the
checks share one page, so a subset result is a hint, not a verdict. It is for
iteration only and cannot stand in for the gate: an unknown name exits 1, the
last line reads `PARTIAL RUN (SMOKE_ONLY): N of M checks — not a pass of the
suite`, and it refuses to run at all when `CI` is set. The full suite gates every
push. A new check gets the same prefix, with its own name in both places.

CI (`.github/workflows/ci.yml`) runs all three on every pull request and pushes
to `main`, plus nightly, and uploads the smoke screenshots as an artifact.

**The workflow ENUMERATES its npm scripts rather than running `npm test`.** That
is deliberate — the fast gate runs without a browser and the smoke job installs
one — but it makes `package.json` and the workflow two lists that have to agree,
and nothing made them. A suite added to one and not the other is a suite CI
never runs: green on a laptop, absent from every pull request, reporting nothing
while the code it guards rots. The same shape as the `|| break` loop above.

Not hypothetical: `tests/buffers.test.js` and `tests/money.test.js` were both in
that state, the second for as long as it had existed — so a rates change in
`js/18-rules.js` could break the calibrated totals and still show a green PR,
against the promise `tools/money-calibrate.js` is written to make.
`tests/check-ci-scripts.js` (in `npm run check`) now fails the build on a
`test:*` script the workflow does not run, on a workflow step naming a script
that does not exist, and on a suite missing from the `test` chain. **Add the
step in the same change that adds the suite.**

New features ship with a new check in `smoke.js`. The chore→money hand-off
checks are the most valuable ones in there — when that join broke, every screen
still rendered and only the numbers were wrong.

## The merge layer is load-bearing — treat it as frozen

`js/04-merge.js` implements conflict-aware sync: id-keyed unions, deletion
tombstones (30-day pruning), deep object merge, per-week chore arbitration, and
a forward-only `lastGradeSeen` watermark. It has 90 unit tests running the real
shipped functions.

Do not refactor it for style. Change it only to fix a demonstrated sync bug, and
only with a failing test written first. Writing the test first also tells you
when *not* to change it: `meetingsMet` was added expecting a merge change, and
`deepMergeObj`'s union was already right for it — five tests went in, `04-merge.js`
did not move.

## Every shared key needs a merge decision

`mergeSharedState` (`js/04-merge.js`) merges `state.shared` as
`{ ...ls, ...rs, <named keys> }`. **A key it does not name is replaced wholesale
by the remote copy on every snapshot** — so a local edit that has not been
pushed is simply gone, silently, with nothing on any screen to say so.

Four keys were added by later feature work and none got a decision:
`parentDayConfirm` (which days a grown-up has reviewed — losing it also jams
`canCloseWeek` shut with no explanation), `builtInRoutineOverrides`,
`schoolCal`, and `weeksClosed` one level down. Every one of them had passing
feature tests. **Adding a key to `state.shared` IS a merge-layer decision**, and
the freeze on `04-merge.js` does not excuse skipping it — it means make the
decision deliberately, with a test.

`tests/check-shared-merge.js` (in `npm run check`) fails the build on a key with
no decision. Either name it in `mergeSharedState`, or declare it beside that
function with a reason:

```js
// lww: parentPin — one scalar PIN for the household; the newer value counts.
```

**A `delete` inside `state.shared.chore` cannot propagate.** `deepMergeObj`
iterates `Object.keys(remote)`, and an absence is the one thing that cannot
express: the remote copy puts the key straight back. That is how reopening a
week never travelled, and how the meeting's Undo reversed the wallet while the
week still read as settled on the other device. `ctStampWeekState(wk)`
(`js/13-chores.js`) is what makes a removal sayable — a stamped week goes to the
newer side whole across all eight maps in `CHORE_WEEK_STATE_MAPS`, the keys it
does *not* have included. An **unstamped** week keeps the grow-only union
exactly as before, so no stale device can un-record a meeting that predates the
mechanism. Same idiom as `goalsByWeek` and `mergeEarnings`: the unstamped case
keeps the union. The guard checks this too; mark a genuine exception
`// safe-delete: <why>`.

## A conflict is a parent's to decide, not the clock's

Whole-record arbitration keeps the higher stamp. That is the right **display**
rule — something has to be on screen, and the girls must never be shown a
warning about a sync — but it is the wrong final answer: **a timestamp orders
two writes and says nothing about which one is right.** The loser used to be
discarded with no trace.

Detection is **causal, not chronological**. Every write records `opId` (this
write) and `baseOpId` (the version it was made from), stamped by
`markItemUpdated` (`js/03-sync.js`). `recordsDiverged` (`js/04-merge.js`) then
asks whether either version descends from the other:

| | |
|---|---|
| `R.baseOpId === L.opId` | R was edited from L → fast-forward, no conflict |
| `L.baseOpId === R.opId` | L was edited from R → fast-forward, no conflict |
| `L.opId === R.opId` | the same version |
| neither, and both stamped | **a real conflict** |
| either lacks `opId` | pre-upgrade: nothing provable, treated as ordinary |

That distinction is the whole design. Raise a conflict on every ordinary
catch-up sync and a parent is asked about all of them and learns to dismiss the
question, which is worse than not asking.

On a genuine conflict the newer stamp is what **displays** and the loser is kept
whole in `state.shared.conflicts`. The id is derived from store, key and **both**
opIds, sorted — so two devices independently generate the *same* id and the row
merges to one. `conflicts:` is the **last** key in `mergeSharedState`'s literal,
and that is load-bearing: properties evaluate in source order and `chore:` is
what discovers a conflict, so reading it any earlier drops the row that was just
found.

`js/38-conflicts.js` is the chooser, under the parent portal's **App**. It owns
no data: it hands one of two versions the app already holds back to the writer
that owns it. Two rules learned from tests rather than from thinking:

- **The cards quote her own words.** A summary that counts ("2 things that went
  well") reads identically for both versions, so the screen would ask a parent
  to choose between two things it refused to show them.
- **A resolution's content is the version chosen; its `baseOpId` is the version
  that was on SCREEN** (`shownOpId`). Descending from the chosen one looks
  natural and raises a *second* conflict about the question just settled,
  because the other device is not holding that version.

## Backup Replace is authoritative — `dataEpoch`

Replace used to mean replace on one device. It pushed, every other device
received that snapshot and **merged** it, and their newer-stamped records won
arbitration and went straight back up. `_meta`-adjacent `state.shared.dataEpoch`
is incremented by `bkApplyBackup(…, 'replace')` and nowhere else;
`mergeRemoteState` takes a **higher** incoming epoch wholesale with no merging
at all, and it is a `Math.max` high-water mark in the merge so it can never go
backwards.

## Two devices, or it isn't tested

Every check in this repo ran on one device for a long time — `tests/smoke.js`
blocks every Firebase host at the network layer — so "two devices disagree" was
not under-tested, it was **invisible to the harness**. That is most of why the
defects above survived a suite of 300-odd checks.

`tests/merge.test.js` now carries a two-device harness: `makeDevice`, `on`,
`receive`, `sync`. Each device owns a whole `state`, edits it offline, and
`sync()` runs the real `mergeSharedState` and `mergeProfileState` in both
directions. `mergeSharedState` was lifted out of `js/03-sync.js` for exactly
this reason — **a merge reachable only from a browser is a merge no unit test
can hold.**

Anything touching sync ships with a two-device check. A one-device check for a
sync change proves nothing, and the suite's silence is not evidence — this file
already records two occasions where green meant nothing (the `|| break` loop,
and the eight checks that returned a truthy findings array).

Node tests run under `TZ=UTC`, deliberately: the family is in Edmonton, so a
date bug that only shows outside that zone must not be able to hide behind the
developer's own clock.

## Escaping

All three helpers live in `js/05-helpers.js`. Pick by **context**, not by habit:

| Context | Helper |
|---|---|
| Text inside markup — `` `<div>${x}</div>` `` | `escapeHtml(x)` |
| A double-quoted attribute — `` `title="${x}"` `` | `escapeAttr(x)` |
| A JS string inside an inline handler — `` `onclick="fn('${x}')"` `` | `escapeJsAttr(x)` |

The third one is not interchangeable with the second, and this is the subtle
part: **an inline handler is HTML-decoded before it is parsed as JavaScript**, so
`escapeAttr`'s `&#39;` decodes straight back to an apostrophe and closes the
string literal anyway. Only a backslash escape survives, which is what
`escapeJsAttr` adds.

That was a live hole, not a hypothetical one. `ensureBlockId` used to splice 24
characters of the user's **note** into a block id, block ids get interpolated
into `onclick` handlers, and ids also arrive straight off a world-writable
Firestore document — so a note containing an apostrophe ran as JavaScript when
the block was tapped. Fixed at both ends: ids are slugged at the source, and the
~58 handler interpolations go through `escapeJsAttr`.

Better than any of them: **don't interpolate into handlers at all.** Use data
attributes plus a delegated listener, the way `js/13-chores.js` and the money
pages already do. Prefer that for new code.

`npm run check` runs `tests/check-escaping.js`, which fails the build on an
unescaped user-text interpolation in markup and on `escapeAttr` used in a
handler. Mark a genuine constant with a trailing `/* safe: from MNY_STAGES */`
and say which table it came from. `tests/smoke.js` carries the runtime proof
(`hostileNamesCannotBecomeCode`, `escapingMatchesTheDomReference`).

## Writing for children

Kid-facing copy is a product surface, not filler. The rules:

- No performance-identity framing ("the good from the great", "masterpiece").
  Lead with autonomy, curiosity and joy. This was a deliberate correction; do
  not regress it.
- Off days are a valid state. Never build all-or-nothing streaks without a rest
  state, a grace token, and partial-progress celebration.
- Money is a financial-literacy lesson, not a payment for being good.
- Cross-sibling data is collaboration, never a leaderboard, in kid views.
- **There is no word budget.** There was one — a hard ≤200 visible words per
  kid screen, enforced by `kidScreensMeetTheHouseRules` — and the owner removed
  it, because of what it actually bought. It did not produce brevity; it pushed
  real explanation behind disclosure toggles, where a nine-year-old does not go
  looking. A screen with something worth saying says it.
  That is not licence to pad. Every rule above still holds, and they are
  judgement — which is exactly what a word count was standing in for and could
  never measure. Ask whether a sentence earns its place, not whether the screen
  has run out of allowance.

## UI rules

- **Touch targets ≥ 44×44px** on every interactive element, including week
  arrows and small chips. Enforced on the four kid screens by
  `kidScreensMeetTheHouseRules` in `tests/smoke.js`, which probes the real hit
  area with `elementFromPoint` rather than measuring the box — so the
  keep-it-small-and-grow-the-target-with-an-`::after` technique passes, as it
  should. One documented exemption: `.wf-card-check`, whose size is set inline per
  block height and which sits at a card corner, where a 44px target would swallow
  the tap that opens the day.
  Scope target rules to the **component**, not the screen: `.ck-navbtn` is both a
  kid's week arrow and the parent portal's, and screen-scoping it left the portal
  copy at 36×36.
- **Minimum font size 13px**; 15px for anything a child must read to act. Also
  enforced by the same check. Roughly 147 declarations in `css/app.css` compute
  below 13px, but most are print, dark-mode or parent surfaces where the kid floor
  does not apply — the floor is a scoped block at the end of `css/app.css` listing
  only what actually rendered too small.
- **No word budget** — see *Writing for children*. The count and its per-screen
  ratchets are gone from `tests/smoke.js`; the 44px and 13px floors stay,
  because reach and legibility are not editorial taste.
  **A disclosure toggle is still the right shape for reference material** —
  `mnyPricesOpen`, `ckPrivsOpen`, `weekGlanceOpen` and `tdExtrasOpen` are the
  pattern: closed by default, remembered in `localStorage` (never synced state —
  every state write is a full-document upload). What changed is the reason. It
  is now a judgement about what a child came to the screen for, not a way of
  getting under a number, so a thing worth reading may lead rather than hide.

## Navigation

**Today is the front door** (`js/31-today.js`). A child lands there and moves
through one nav — **Today · Week · Money · More** — which is a single fixed
element outside the screens, filled by `tdRenderNav`. Do not add a second nav row
to a screen: the six-button shortcut row that used to sit in three different
topbars is exactly how their labels drifted apart, and it is gone.

**The hero owns the block she is in, and owns it alone.** The screen used to draw
the running block twice — a NOW card saying "now · started 8:15am" with a green
`✓`, and four centimetres below the very same block as a card with a `✓` of its
own. Two controls for one action, two glyphs for one meaning, and nothing to tell
a child which tick did what. The running block is now absent from the list
entirely (not even as a passive marker), and the hero's button is the `🎯` the
cards carry — same green, same border, same offset, 56px only because it sits at
the card's edge. `theHeroIsTheOnlyPlaceTheRunningBlockAppears` holds both halves.

The hero carries the block's **window and what is left of it** (`8:15–9:00am · 22m
left`) with the countdown drawn under it, and `tdTick` (js/99-main.js starts the
timer) repaints it every minute — patching those three nodes in place, and doing a
full render only when what she is doing actually changes. Still no clock: absolute
time belongs to the day screen.

**A block you travel to starts when you start getting ready.** Swimming at four
does not mean leaving the house at four, so `tdActionableStart` — `tdPrepFor`'s
first pre-buffer, which is `wfBufferSegments` and therefore the week grid's own
arithmetic — is what the card leads with, what the hero's NEXT names, and what the
list sorts by. `.quest-time` carries it at full size on the `--next` card, a plain
card and a folded one alike: a get-ready time shrunk to a footnote is exactly the
case where it matters most.

**A gap is a break or free time, never both.** Under `TD_FREE_MIN` it is a chip on
the hero's NEXT line and a connector between two cards; from `TD_FREE_MIN` up it is
the free-time card that already existed. `tdGapBefore` is the one place that line
is drawn, and it measures to `tdActionableStart`, not to the block's start.

**A strip stops where the next card starts, and never says more than it can
show.** Two defects, one fixture — a School Day with 15m travel + 15m get-ready
running into Homework at three o'clock. A buffer strip was drawn at its full
length whatever was in the way, straight over the top of the next card, so
neither the strip nor the card's name and tick could be read; and at 0.72px per
minute a 15-minute strip is 10.8px tall while the kid readability floor sets its
text to 13.1px, so two stacked strips each printed a label through the other.

`bufferClip` (`js/05-helpers.js`) is the one owner of **how much of a buffer
window is real, unoccupied time** — pure numbers, with a `module.exports` guard,
so `tests/buffers.test.js` can hold it. `computeBufferConflicts` calls it and
returns `shortMin` beside the booleans it always returned, and the sweep in that
unit test asserts the equivalence that `short > 0` happens exactly when the
overlap test fires: two definitions of one fact is the six-copies defect this
file already records. The Full week, the day view and the print sheet all clip
through it, so the red a screen draws and the minutes the banner prints can
never describe different amounts of time. `wfBufferSegments` itself is
**untouched** — Today's `tdPrepFor` reads it for "leave by 7:40", and that is
still 7:40 whether or not the plan fits.

`WF_TRAVEL_TEXT_MIN_PX` (17) is a **measurement**, like `WF_ROW`: 13.12px of
text plus a 1.5px conflict border each side is 16.1, so 16 sits on the edge and
17 is the first height that always holds a line. A strip under it keeps its
hatch and its tooltip and says nothing; several short same-side segments merge
into one **band** whose per-kind hatches stay as children and whose single label
speaks for both. Height only answers one of the two questions — a column is
95–129px and the long label is about 168px — so `wfTravelStrip`'s `maxTier`,
which had no caller passing one, now caps the tier by width too.

**When a label has to shrink, the CLOCK is what survives.** The width cap made
the `long` tier structurally unreachable on this surface — every label carrying
a time is 158–211px against a 115px budget — and the ladder's next rung was
`short`, `🚗 Travel 15m`, which throws away the one figure a parent acts on and
keeps the one the strip's own length already draws. The result was that no
clock time reached the Full week at all. `time` (`🚗 7:40a` out, `🏠 3:20p`
back, about 59px) sits between them and is what a strip picks whenever it is
tall enough for a line; `short` is not on that ladder, being both wider and less
use, and survives only because the print sheet picks tiers by block height and
does want it.

**A LABEL NAMES THE EVENT, NOT JUST THE TIME.** One figure per side was the
first answer and it was a figure short: School Day at 8:10 with fifteen minutes
of getting ready and fifteen of driving printed `🚗 7:40am`, which is when she
starts *getting ready* — the right number wearing the wrong icon, and the car
does not leave until 7:55. Going out there are **two** facts and a parent acts
on both, so the full form is `👕 7:40 🏠→🚗 7:55`. Coming back it is
`🚗→🏠 3:05 🧺 3:20`, and the arrow is what says which end of the trip this
is.

**What each side drops first is decided by which fact has a DEADLINE.** Getting
ready before a block has to be finished when the car leaves, so both figures
matter and the **direction arrow** is what goes first — `👕 7:40 🚗 7:55` keeps
both times down to a 100px column, which is every real one-lane column on this
grid. Unpacking afterwards has no deadline at all, so coming home it is the
**unpack figure** that goes and the arrow that stays: through-the-door is what
somebody is waiting on. `wfSideTimeForms` is the one ladder, widest rung first;
`wfSideEdgeRel` and `wfKindEdgeRel` are what it reads. Coming back the travel
edge is the end of the last **travel** segment, when you are through the door,
never the end of the put-the-gear-away that follows it.

**The after-buffer is UNPACKING, and says so everywhere.** The two get-ready
buffers are different jobs — preparation with a deadline, unloading with none —
and three of the four places that named a buffer kind were not side-aware, so
the post side read "Get ready" on the print sheet and in every tooltip while
`seg.side` sat in scope at each of them unasked. `bufferKindLabel` and
`bufferKindIcon` (`js/07-week-view.js`) are the one owner: 👕 **Get ready**
before, 🧺 **Unpack** after. Today is deliberately untouched — `tdPrepFor`
filters `side === 'pre'`, so it is only ever talking about getting ready.

**The tooltip is the full sentence at every width.** A visible label that has
fallen to its bare rung drops the meridiem and one of its two figures; the
`title` names every segment, its minutes and its clock time the long way round,
which is also what a screen reader gets. `bufferSegLabels(seg, 'long')` is that
sentence, and its pre-get-ready form says **from** 7:40 rather than "done by
7:55" — the deadline is already said by the travel label beside it, and the
moment she has to start was the one figure nothing anywhere carried.

**A zone name is drawn where it is NEWS.** `labelledCol` was
`!isSchoolDay(key) || key !== axisKey`, which silences the axis day itself and
labels every OTHER identical school day — four columns × four zones on an
ordinary week, sixteen repeats of what the left sideband already says once,
competing with the cards and the buffer times for the same pixels. The same
expression failed the other way round on a week with no school in it: `axisKey`
is then `null`, `key !== axisKey` is true everywhere, and all seven columns
printed `🎉 Free time`. A column now names its zones only when its **shape
differs** from the day the axis is describing — compared as a signature of the
segments rather than as `isSchoolDay(key) === isSchoolDay(axisKey)`, which is
equivalent today only because `schoolHours()` takes no day argument. So the
school columns of a term week say nothing, a Saturday inside one still speaks,
a PD day speaks, and a week that is all holiday says it once on the axis.
`aZoneNameIsDrawnOnlyWhereItIsNews` holds all four.

**A zone name is not drawn where a buffer strip speaks.** The bands print their
own name at the top of each stretch — `🏫 SCHOOL`, `🎒 AFTER SCHOOL` — and a
buffer run beginning on that boundary lands its time in exactly those pixels.
Invisible while the strips were mute; two lines of text through each other the
moment they spoke again, which is the defect `WF_TRAVEL_TEXT_MIN_PX` exists to
prevent. The **time wins**: it is the one figure on this surface a parent acts
on, and the zone is still said twice over, by the band's tint and by the left
axis. Pure arithmetic on inline pixel values (`WF_BAND_LABEL_PX`, another
measurement), so it costs no reflow. A screenshot found this — the suite was
green.

**And the fact never disappears.** A lone fifteen-minute buffer is 10.8px and
cannot hold a line at any width, so its side goes silent and the time is simply
gone from the screen. The strips are **asked** whether they muted — rather than
the card re-deriving the tier ladder, which is how the two would drift — and the
card prints whatever its sides could not say, at any tier, as the time and never
the minutes. Now that a side carries two figures there is a **second** way to
come up short: half a column holds one clock time, so a band can speak and still
be a fact down. Same contract one rung further in — the elements are asked what
they **printed**, `wfSideTimeUnsaid` answers what is missing from it, and the
card carries the remainder. `theStripStillSaysWhenToLeave` holds the fact rather
than the mechanism: both figures visible in a full column, the leave-by one
visible in a split lane with the other spelled out in a tooltip, at one lane and
at two, without overflowing what draws them.

**`wfTextPx` is how wide a label will be, and it is a MEASUREMENT.** It replaces
`text.length * 6.6`, which charged every character the same width — and a buffer
label is mostly emoji, so `🚗 7:55am` is eight units and 65.6 real pixels (8.2
each) while `🎒 After school` is fifteen and 100 (6.7 each). One number was
wrong in **both** directions and wrong by a third: it refused labels that fitted
and, worse, accepted labels that then ran off the column edge, which is the one
failure the width cap exists to prevent. Measured in
`.wf-travel-band-label`'s own type (0.82rem lifted to the 13.1px kid floor): an
**emoji 21**, an **arrow 12**, a **digit 7.3**, a **lowercase letter 9.6**, an
**uppercase 10.6**, a **space 1**, a **colon or bracket 4**. The letters are
rounded up, because over-estimating only refuses a label that would have fitted
while under-estimating draws one that does not.

**The space is the load-bearing row, and it is charged 1 rather than its own
3.6.** Every space in a label on this surface follows an emoji, whose advance
already carries it — and charging it in full put the two-figure form
`👕7:40 🚗7:55` about four pixels over a 390px-viewport column that it
really fits in, so a phone silently dropped the get-ready time. These numbers
were re-derived once already against real rendered widths, which is the reason
they are written here rather than left in the code: a first calibration that
looks reasonable is exactly what ships wrong.

`.wf-travel-band-label` is in the overflow sweep for the same reason: it is the
element that actually carries a band's text, and while it was left out a label
30px too wide for its column passed that sweep untouched.

**The minutes that did not fit are drawn, not just described.** `.wf-overrun`
lays the shortfall over the card it runs into at a quarter strength, exactly as
tall as the overrun and ending in a dashed line, taking no pointer events — the
old full-strength overprint was the only thing that showed how bad a clash was,
and it showed it by making both unreadable. The number itself rides on the
**flag**: the card that is run into swaps its round `!` for a pill reading
`! 20m over`, hung above its top-left corner and mostly outside the card, which
is the one place that never covers a centred name at any card height; a card in
a right-hand lane hangs it top-RIGHT or two lanes' pills collide. The partner
card keeps the plain `!`. `clashWorstShort` and `clashTitle`
(**`js/05-helpers.js`**) are the one pair that answers "how far am I run into,
and by what", because the shortfall is recorded against the block whose window
is short — so a card must read its PARTNERS' figures, not its own.
`tdClashText` is the same sentence on Today.

**Both schedule surfaces say it, and say the same thing.** That pair lived in
`js/07-week-view.js`, so the week grid was the only screen that could name the
activity a block runs into or count the minutes: the day view drew a red outline
and a `⚠️` whose tooltip read *overlaps another activity*, naming nothing and
counting nothing. Backwards, because the week grid is where a clash is SEEN and
the day view is where it is dragged away. The day view carries the same
`! 20m over` figure — inline on the block, where it has the room a 20px week
card does not — the same named sentence, and the same quarter-strength
`.wf-overrun` drawn to its own scale. `renderBlocksWithCollision` and
`renderBlockPixel` take the whole finding now rather than the `affected` Set
alone, which is what made the surface unable to explain its own warning.
`theDayViewSaysTheSameThingAboutAClash` seeds one fixture and asserts both
screens report the same number and the same partner — the failure worth guarding
is disagreement, not absence.

The week banner lists **one line per clashing pair**, deduped on the sorted id
pair. It used to join every affected name on a day into one chain — "School Day
⇆ Homework ⇆ Ballet ⇆ Evening Routine" — which names four things while saying
neither which two clash nor by how much.

**Lanes are decided on what is DRAWN, and a floored card borrows the minutes
BEFORE it.** `wfAssignColumns` and `renderBlocksWithCollision` compared
`startMin` and `durationMin`, which is the wrong question on a surface with a
minimum card height: at 0.72px per minute the 20px floor is 28 minutes, so a
ten-minute After-School Routine at 8:50pm was drawn straight through a 9:00pm
Evening Routine while the arithmetic said they were clear. Measuring the floored
pixels instead fixed that and broke the other direction — a 3:40pm routine and a
4:00pm piano lesson, which share not one minute, came out as two half-width
cards with their names erased, while the day view drew both full width and was
right.

`wfCardBoxes` (`js/07-week-view.js`) settles it, and is **the one geometry** the
lane pass, the cards and the overrun layer all read: a lane decided on one set
of numbers and a card drawn on another is invisible, because the card in the
wrong lane still looks like a card. The floor grows a short card **upward**, into
minutes that are empty by construction, so the card's bottom edge — the one a
reader uses to see where one activity stops and the next begins — stays
truthful. Room is measured against the other blocks' real extents and against
the already-decided bottom of the block before it, so two short blocks either
side of one gap can never both borrow it, and a 6am block has nothing above to
borrow. Only a card with nowhere to borrow from overruns, and only that splits a
lane. A lane-narrowed card under 64px drops its name to the icon
(`.wf-card--noname`): one clipped letter is not a name, and the icon is already
what a short card draws.

**A width nothing measured.** `colPx` — the budget every buffer label and the
`--noname` threshold are checked against — was read off `cell.clientWidth`, from
a cell appended to the grid at the END of its own iteration. It was **always 0**,
so the `|| 120` fallback was always the answer. The day headers are already in
the grid and sit in the same tracks, so one of them measures every column once,
with no per-cell reflow.

`.placed-block { min-height: 22px }` applied to buffer strips too, so every strip
under about seventeen minutes was silently grown and pushed past the block it
abuts — the overlap `renderBlockPixel`'s own comment calls impossible by
construction, made possible by a floor in another file. `.placed-block.travel-buf`
carries its own 6px floor, matching the JS.

**A clash is the week's finding, drawn the week's way.** `computeBufferConflicts`
(js/03-sync.js) owns it; Today asks and reuses `.wf-card--conflict`'s red. Its
`partners` map exists so a screen can say *which* activity a block runs into
without a second overlap test growing somewhere else. Both blocks it names take
the frame, and the wording states the fact — the plan is what does not fit, and a
child did not write it.

**Today is where a day gets done; the day screen is where one gets built.** That
split is the whole design. Today carries the quest cards, the 🎯 completion, the
XP strip, the mood, the to-dos, the goals, the sticker collection and the note to
grown-ups. `screen-day` is a planning tool — one schedule, **one layout**. It has
no mode toggle, and there is no `dayViewMode`: a mode that survives navigation is
a mode a child never chose, which is what Quest mode became.

**Four** renderings of one day have now been retired for the same reason —
Checklist mode, the Quest Board's own list, day-view Quest mode, and finally the
Quest Board screen itself. If you find yourself adding a fifth place that lists
today's blocks with ticks beside them, that is the mistake, and Today is the
place that already does it.

**The week has two tabs, and only one of them is a week you can plan.** Full is
what the screen opens on: the cards, the quick-complete `.wf-card-check` ticks,
the planning controls and the three banners — including the offer to add missing
School Day cards, which is a mutation and so can only live there. (That offer is
drawn ABOVE the grid, from `#weekSchoolBannerTop`, which is a sibling of
`#weekFull` rather than part of it — so `setWeekView` has to hide it on the
preview explicitly. See *The school calendar* below.) The second tab
is a read-only preview of the printed sheet, and it is a second **host** for
`renderPrintSheet` (`js/16-print.js`), never a second copy of it: that function
takes `(host, { weekOffset, profile, window })` and sets `--print-slot` on the
host, because two live copies on one page would otherwise fight over one element
and one variable. `setWeekView` folds any unknown value into `'full'`, so a stale
`'timegrid'` lands somewhere you can plan.

Day Blocks was the third rendering and was the default, which is the only reason
replacing it needed a default flip: landing on a read-only surface is worse than
the problem the preview solves.

That is why the day ribbon **taps through to `screen-day`** rather than unfolding
a copy of the day under itself. It is drawn to scale — cell widths proportional to
duration, gaps as real empty space, one now-marker — because equal squares said
how many things were on the day and nothing about its shape. It is one control,
not twenty: a 14px cell is not a reachable target, and twenty tab stops is not a
description of an afternoon.

**The ribbon's colour is what a block IS; its border is whether it is done.**
Fill used to carry status — green done, yellow now, white to come — which said
how much was ticked and nothing about what any of it was. Colour is now
`blockColour`, the same answer the day view and the week grid render. Status
moved to the border: **dashed not confirmed, solid confirmed**, and every cell
stays solid-filled at full strength. A child does not get to tick things every
hour, so an unconfirmed block must never be drawn faded or hollow as though she
had failed it — which is why `--missed` is gone rather than restyled.

**One owner for a block's colour, and one for its name.** Both were written out
more than once, and the colour had already drifted: an unknown category came out
green on the week grid and grey in the day view, print and Full week.
`blockColour` (js/01-config.js) and `blockDisplayName` (js/05-helpers.js) are
those owners now. A block is **numbered only when the same thing repeats within
that day** — one Homework stays "Homework", five become Block 1…5 — and numbered
by `startMin`, never by the order a caller holds them in: Today sorts by
`tdActionableStart` and the day view lays out by position, so a number that
followed either would point at a different block on the two screens. (The week
grid used to be excluded, because `tg2ShortLabel` compressed to seven characters
and "Block 2" could not live there. Both went with the Day Blocks layout.)
**Meals are the one exception**: they used
to render as a bare `🍳`/`🥗`/`🍽` beside the block's own icon, so a cell said the
same glyph twice and named nothing. Words win — the budget exists to stop a typed
competition name being crammed in, not to stop a meal being readable.

**A competition is called what a parent typed.** `blockDisplayName` returns
`b.compName` when there is one, which is what reaches the day view, both week
layouts, Today and print — the Full week and the print sheet each used to derive
"Skating Comp." themselves, so a named meet read correctly on one screen and
wrongly on the two you actually pin up. The weekly meeting then reads the meet
off the plan (`mmPlannedCompetitions`, `js/23-money-meeting.js`) instead of
asking for it twice; it takes facts only — which meet, which day, which sport —
and `mrScoreCompetition` still decides what the result is worth.

**WATCHING IS NOT COMPETING, and `blockIsCompetition` is the one seam that says
so.** A sister can be invited to come and watch a meet, and the danger is the
invite mechanism itself: `acceptInvite` (`js/10-social.js`) copies `actId`
verbatim, and `competition` is a plain default activity carrying
`isCompetition`, so the watcher's block simply **was** a competition to every
reader in the app. She would have been listed by `mmPlannedCompetitions` and
chased at Sunday's meeting for a result she never swam — and an unrecorded
planned meet **disables the confirm bar**, so the week could not settle and
nothing on screen would say why; and `mrPlaceCompetitionBlock`'s orphan
adoption (`js/18-rules.js`) would have taken her watch block as the meet's own,
`compId` and all, which is the link to the money tab.

`blockIsCompetition(b)` (`js/08-day-view.js`) returns **false** when
`blockIsWatching(b)`. That is a deliberate narrowing, not an oversight to
simplify away: it is the single test all five competition surfaces funnel
through, so one line makes a watch block invisible to every one of them at
once, in the direction that is **safe by default** — the next surface that asks
this question is right without being told. A watch block therefore earns no
competition score and no competition money, structurally rather than by
discipline.

Three things still have to know, and they are named rather than left to
inference. `blockDisplayName` reads `act.isCompetition` rather than
`blockIsCompetition`, so it is the one place that still asks directly — it
prints **`👀 Watching — <meet>`**, falling back to what the block is when
nobody named the meet, because a card reading "Winter Invitational" on the
watcher's Saturday claims the meet is hers. `renderTrainingChecks` and
`renderTrainingGearChecklist` return empty for a watch block: the four checks
are a review of a session you took part in, and a watcher packs no skates.
Buffers split — **travel stays, warm-up goes**: she really does go to the rink,
and she is not competing.

`sendInvite(block, to, day, opts)` carries `watch`, `compName` and `tag`; the
call sites that pass no `opts` send a plain invite, and **the plain invite path in
`acceptInvite` is untouched** — it is the one mechanism that already puts an
event on both calendars and this is not about it. `👀 Invite my sister to
watch` sits outside `#sisterSyncWrap`, which is parent-only, because asking
your sister to come and watch you compete is a child's own decision; it shows
only when `blockIsCompetition(block)`, so a watch block cannot be passed on
again as a meet.

**An invite has ONE writer, and one owner of "is there already one?"** There
were two writers of a plain invite — `sendInvite` and an inline copy in
`inviteSisterFromEdit` (`js/17-ui-misc.js`) with its own confirm and its own
stamp — and neither asked whether one was already out, so a guard in either
would have missed the other door. `sendInvite` is now the only code that
creates an invite: the Sister Sync tap calls it, and `inviteSisterFromEdit` and
`inviteSisterToWatch` only find the block, resolve `activeProfile()` and the
sister, and call it. Do not build an invite anywhere else. **The invite's day
comes from the caller** — Sister Sync passes the day it is showing, the edit
sheet passes `currentDayKey` (the day it found the block on) — and `sendInvite`
refuses without one; it never reads `currentDayKey` or `syncDayIdx` itself,
because `currentDayKey` outlives the day view that set it.
`sisterInviteFor(blockId, to, kind)` (`js/10-social.js`) returns the **live**
invite — `pending` or `accepted` — from that block to that sister of that kind
(`'watch'` when `inv.watch`, else `'share'`), or `null`. `sendInvite` refuses a
live duplicate of the same kind **before** its confirm dialog, with a toast
saying whether she hasn't answered yet or it is already on her plan; a
**declined** invite may go again (a no on Tuesday is not a no for ever), and a
share and a watch of the same block are different questions. `acceptInvite`
and `declineInvite` act only on a `pending` invite — a double-tap on ✅ Accept
used to put a second block on her day — and otherwise return quietly and
redraw the list.

Both edit-sheet buttons read their sent-state from `sisterInviteFor` **for
their own kind**. `invitedTo` on the source block is a bare list of names that
cannot tell a share from a watch; its one job is the 💌 badge on the inviter's
own timeline, and it is not asked whether anything was sent. **`💌 Invite my
sister` (`#inviteSisterBtn`) also sits outside `#sisterSyncWrap`**, so a child
can share from the block as well as from the Sister Sync screen; it is hidden
on a watching block (`blockIsWatching`), because sharing somebody else's meet
as a plain invite would clone her competition block onto the competitor's own
calendar. **The public toggle (`#publicToggle`) stays parent-only** — it is
all `#sisterSyncWrap` now holds. `anInviteCannotBeSentTwice` (`tests/smoke.js`)
holds all of it.

**One inbox, and Today signposts it.** The 💌 inbox is Sister Sync's
(`renderInvites`), and accepting and declining stay there. Today carries a
one-line note when an invite is waiting — a signpost, not a second inbox — and
its filter and wording are the inbox's own: `invitesWaitingFor(p)` (to `p`,
`pending`) and `inviteFacts(inv)` (who / what / day / time, with the inbox's
fallbacks) in `js/10-social.js`, called by both surfaces so they cannot count or
name an invite differently. **Kid only**: the inbox works on `profile`,
`acceptInvite` writes to `profile`, and `openSisterSync` refuses a parent, so a
parent-facing note would lead to a refusal. `anInviteWaitingShowsOnToday`
holds it.

**A watch block still counts as ordinary planned time.** `computeWeekTotals`
does not filter it out, deliberately: a Saturday she really spent at the rink
must not read as free. What it does not do is earn.

`aWatchedMeetIsNeverChasedForAResult` and `aWatchInviteNamesTheMeet`
(`tests/smoke.js`) hold both halves — the first is the one that makes the
feature safe and is worth more than the rest of it.

Drawn to scale means the row has to **add up to a day**. It is one nowrap flex row
of percentages with nothing able to shrink, so anything that oversubscribes it
pushes the last cell straight through the edge of its column. Two things do:
overlapping blocks — which is exactly the clash this screen draws in red, where a
block's get-ready starts inside the block before it — and `MIN_CELL`, since a floor
applied often enough overruns the row on its own. `tdProgressRibbon` clamps each
cell to the cursor so no minute is spent twice, then scales the segments back if
they still come to more than 100. It shipped without either guard and every check
passed: no fixture had two blocks that overlap. A screenshot found it.

**The day screen scrolls as one surface, and that surface has to be BOUNDED.**
It was three nested scrollers (`.day-workspace` → `.day-center-lane` →
`.timeline-wrap`), which on an iPad meant a flick could move the wrong one.
`.day-workspace` is the only scroller — but for a long time it was not a scroller
at all: `#screen-day.screen.active` carried `min-height`, so the flex column grew
to the 1344px schedule and the **document** scrolled instead, 832px of it. The
wheel hid that (`overscroll-behavior: contain` on the workspace), but
`attachMiddleDragPan` deliberately hands leftover scroll to the page, so the
middle button was the one input that reached the document and it carried the
topbar off screen. The screen carries a `height` now, at every width rather than
only at ≥980px landscape, and `body.has-kid-nav #screen-day.screen.active` has the
specificity it always needed. `dayScreenScrollsAsOneSurface` only walks INSIDE
`#screen-day` and cannot see this; `onlyTheScheduleScrollsOnTheDayScreen` watches
the document — and seeds a day tall enough to scroll rather than assuming one,
because a workspace that does not overflow is a short day, not a defect.

**The day STOPS where the day stops.** The schedule was drawn 6am–10pm whatever
was on it, and `.timeline` carried `min-height: 1344px` with 200px of padding
under that, so an evening whose last block ends at a quarter to nine showed an
hour of empty grid and then most of a screen of nothing — and no trimming in JS
could have taken either back. `dayDrawnSpanMin(keys)` (**not** `dayViewSpan`,
which has meant the column count since the 1/2/3-day view landed) takes the last
drawn edge across the visible columns, buffers included, adds
`DAY_TAIL_SPARE_MIN` so there is somewhere to tap to put something later, floors
at `DAY_MIN_TAIL_MIN` so a blank day is still a canvas you can plan on, and
rounds to a **multiple of 15** because `buildSlotGrid` tiles the canvas in
quarter-hour rows. `tlShowEvening` (`localStorage`, never synced state) opens
the rest, through `.tl-later` — which also says which state the canvas is in,
since a day that stops at nine looks exactly like a day with no evening.

The span is **on the canvas** (`dataset.spanMin`, read back by `canvasSpanMin`),
not passed down five signatures and never taken from the global: the gutter's
last hour, `renderBlockPixel`'s clipping, `canvasSnapMin` and the drag clamps in
`js/39-block-drag.js` all followed `DAY_MIN_SPAN` and would each have put
something — a label, a tap, a drop — below the bottom of a trimmed canvas.
`dayZoneSegments` is deliberately NOT span-aware: the week grid and the print
sheet read it too, and `paintZoneBands` already clips to the column's own end.
Two smoke checks asserted the old fixed day — 64 slot rows and 17 hour marks —
and now derive both from the rendered height; what matters is that the canvas
divides exactly into 15-minute rows, not that it is 64 of them.

**The day headers are a row of their own, outside the columns.** `.tl-col-head`
used to sit inside `.tl-col`, above `.tl-canvas`, while `.tl-gutter` — a sibling
of the whole column stack — started at the top of the header. Nothing put the two
back in phase, so at 2 and 3 days every hour label named a line **46px, about 33
minutes, below itself**. One day has no header, which is the only reason it was
ever invisible. `.tl-headrow` stays inside `.day-workspace`, sticky at its top, so
panning sideways keeps each header over its column with no `scrollLeft` mirroring
and no second scroller. `focusDayColumn` marks both trees.

**`.tl-canvas` draws its edge with an inset shadow, not a border**, and gets
`z-index: 0`. The border was 2px on a border-box element whose height JS set to
exactly the day, so the padding box was 4px short — the 10pm rule and the tail of
a 10pm block were clipped, and taps measured 2px off what was drawn
(`getBoundingClientRect` reports the border box). The stacking context is what
stops `.placed-block` (z10) painting over the sticky header and gutter.

**No rule is drawn across a card.** Print reads well because its rules are the
borders of 15-minute cells: a block sits on top of them, so a line cannot cross
its text. Both schedule surfaces follow that now — **every full-width rule goes
BEHIND the cards**, and the only thing drawn over one is the short hour mark at
the gutter edge, because "where is four o'clock" is a question a card must not be
able to hide. The rule and that mark used to be ONE element with the mark as its
`::before`, which is why the hour could not go behind without taking its own
answer with it.

**Two surfaces, two builders, because they are drawn at different scales.**
`buildSlotGrid` (`js/05-helpers.js`) is Print's mechanism — real 15-minute rows —
and the **day view** takes it whole: at 1.4px/min a row is 21px and 64 of them
tile its 1344px canvas exactly. `grid-template-rows: repeat(n, 1fr)` rather than a
pixel height hands subpixel distribution to the layout engine, so boundaries land
where the absolutely-positioned blocks expect them.
`buildHourGrid` still serves the **Full week** at the 30-minute interval, with
`layer: 'lines'` the rules (behind) and `layer: 'ticks'` the marks (above): at
0.72px/min a 15-minute row is under 11px, and four rules an hour read as hatching
rather than as a scale. Do not "unify" these — the split IS the decision.

Blocks, drag arithmetic, `renderBlocksWithCollision`, the buffers and the now-line
know nothing about any of it; only the background changed. Both layers are
appended after the blocks, so the behind layer earns its place with a z-index
rather than DOM order — `noRuleIsDrawnAcrossACard` asserts each side separately,
because a stacking value that silently stopped applying is exactly the failure
that would otherwise look fine, and `theHourLadderLinesUpWithTheSchedule` measures
the gutter label against the row boundary at 1, 2 and 3 columns.

Takes no pointer events.

**The activity rail is gone.** Placement goes through the picker that opens where
you tap (`openSlotPicker`) — the interaction that was already doing the work.
`buildTray` and `setDayFocusPane` were retired with it, and `selectedActivity` is
now transient: set by `pickFromSlot`, cleared on placement. A caller that already
knows which activity — the tutorial, a level-up reward, a mascot suggestion —
calls `startPlacingActivity` (`js/09-sheets.js`).

**1 / 2 / 3 days is a column count, not a mode.** `dayViewDays` lives in
`localStorage` only, nothing about what a block says or how it is edited changes
with it, and a narrow viewport is served one column whatever is stored.
`dayViewAnchorKey` is the leftmost column; `currentDayKey` is the day being
edited, and every writer downstream (`placeBlock`, `setDayMood`, `clearDay`, the
edit sheet) still reads that one global — a tap in another column points it there
first (`focusDayColumn`). Anything that renders a block must take its day key
from the canvas's `dataset.dayKey`, never from the global.

**Two thresholds, two questions.** `BLOCK_TIERS` answers *how much may a block
say at this height*; `BLOCK_STACK_MIN` (46px) answers *when can the day view
stack it on two lines*. Conflating them is what sliced a 30-minute Breakfast's
own title in half — 40px of block, 30px of content box, two lines needing 34.

**A tier is permission, not a fit.** On the Full week the two disagreed:
`detail` starts at 64px and a stacked card needs 66 before it draws a single
goal line, so the ladder promoted cards into a layout they could not hold.
`wfStackPlan` (`js/07-week-view.js`) is what decides the layout now, against
`WF_ROW` — the **measured** cost of each row at the sizes this grid ships. The
old arithmetic budgeted 58px for the four fixed rows and 20px a goal line; the
real figures are 66 and 17, because the kid readability floor lifted
`.wf-card-time`, `-dur` and `-sum` to 13.1px and nothing re-measured. On top of
that `.wf-card--tall .wf-card-name` is allowed two lines and the budget counted
one. Every stacked card overflowed by 7–21px, which is how a training block's
goals came to run through the duration underneath them.

Priority on a stacked card: icon and name always, then the duration (the one
thing position and size do not already say), then goal lines, then the
start-time chip with whatever is left. A second line of name is bought only
when the name is long enough to need it — and that estimate cannot overflow,
because a plan that says one line also emits `.wf-card--nameclamp`, which holds
it to one whatever the guess got wrong. `theStackedCardFitsWhatItDraws` measures
in-flow children against the card's own height; `WF_ROW` is a set of
measurements, so changing the type invalidates it.

Today **owns no data and no rules — but it does invoke them.** Every number it
shows is read through the accessors the owning screen uses, and every write goes
through the function that already owned that write: `completeQuest` for a tick
(XP and sticker counting come with it), `addQuickBreak` for a break, `setDayMood`
for a mood. **Call an owner; never contain one.** A second place that *decides*
how a chore is graded or how money moves is a second place that can disagree with
the first, and a child has no way to tell which one is lying — so grading and
settling still belong to the chore and money screens, and nothing on Today moves
money.

Today's vibe, to-do, goals, sticker and note panels ship collapsed behind one
`localStorage` flag (`tdExtrasOpen`), and finished blocks fold away behind its
sibling `tdEarlierOpen`. That was originally the word budget biting — Today was
built to a 200-word cap and measured 97 on the audit's seeded day. **The cap is
gone and the folds stay**, because they were right for a better reason than the
number: a child opens Today to find out what she is doing next, and everything
behind those folds is something else. Where that reasoning does NOT hold, a fold
is now the wrong answer — an explanation on 💰 My money was once cut from
twenty-four words to three to fit, and that was the budget making the screen
worse.

**Today leads with what is next.** The list splits at `tdNowMin()` — upcoming in
time order, then everything finished under a closed "earlier today" fold. In
`QUIET_HOURS` (9pm–7am, `js/01-config.js`) with nothing running, the NOW card
reads as wind-down rather than "the rest of today is yours".

**A waiting invite is named on Today, and the tap lands on it.** `tdInviteNote`
draws one `.td-row` button in the day column, between the hero and "Coming up",
so she meets it before her day's list: `💌 Jess invited you to 📚 Reading · Tue
4:00pm`, `💌 Jess invited you to watch Winter Invitational · Sat`, or
`💌 2 invites waiting — from Jess`. Nothing pending, no row. The tap
(`data-td-action="invites"` → `tdOpenInvites`) opens Sister Sync and scrolls
`#invitesSection` to just under the sticky topbar — the list is at the bottom
of that screen, and landing at its top would be the school banner under a 700px
grid again. It goes away on the next Today render after she answers: the nav's
Today tab re-renders (`goToday`), and a snapshot from the other device does too
(`refreshCurrentScreen`). There is no polling.

**A card must never render blank.** "Jobs I can do" listed only what was still
claimable, so the day a child finished everything her reward was an empty box —
and a week with no chore pool gave the same blank for a different reason.
`tdJobsToday` returns every job with its state, and the three empty cases each
say which one they are.
- Use the design tokens in `css/app.css` (`--space-*`, `--text-*`,
  `--shadow-*`, `--radius-*`). Avoid new inline `style="…"`.
- `--accent` (`#ff7b54`) is decorative only. Anything with white text on it or
  informational accent text uses `--accent-strong` (`#c14a24`) — this is the AA
  contrast fix, don't undo it.
- Never white text on the pastel category colors (all fail contrast).
- Use the app's `.sheet` / `appDialog` patterns, not native `confirm()`/`prompt()`.

**IF IT LOOKS LIKE A CONTROL AND IS ANNOUNCED AS ONE, IT HAS TO BE ONE.** Three
of the five `.profile-badge`s — Today, the chore tab, Sister Sync — were bare
`<div>`s with no handler, while the week's and the day's were buttons calling
`openProfileSwitcher()`. The app told the user it was a button in three separate
ways and then did nothing: `css/app.css` gave it `cursor: pointer` and a 44px
box, and `enhanceAccessibility` (`js/99-main.js`) injected
`aria-label="Open profile selector"` on **every** `.profile-badge` with no
`[onclick]` filter — while `enhanceNonButtonClickables`, three lines above it,
did filter, so the dead badges got a label and no role, no focus and no
keyboard. All five are `<button class="profile-badge" onclick="…"
aria-label="Switch profile">` now, and the aria pass only labels a badge that
has a click path, so the next inert one cannot re-tell the lie.
`everyProfileBadgeSwitchesProfile` asserts it by **activating** each badge and
watching for `#profileSwitchOverlay`: a control can carry every attribute on the
list and still open nothing.

## One answer per question — `js/36-status.js`

Six screens each worked out "is this done?" for themselves, and the copies had
drifted far enough that a parent could not tell which one was lying. This file
is the vocabulary now. **It owns no data**: every function reads through
whichever accessor already owned that fact, and every write goes to the function
that already owned that write. Ask it; do not re-derive it.

| Question | Function |
|---|---|
| Did she perform it? | `isBlockCompleted(block, kid)` |
| …and for a routine, which is its checklist? | `isRoutineCompleted(block, kid)` |
| Did a grown-up verify it? | `isBlockConfirmed(block)` |
| …or record that it did NOT happen? | `isBlockNotDone(block)` |
| Is this block answered either way? | `isBlockAccountedFor(block)` |
| What is this day still waiting on? | `dayBlocksAwaitingAccount(kid, dayKey)` |
| Which routines did this day ask for? | `routineSessionsForDay(kid, weekKey, dayIdx)` |
| Did a parent review this child's day? | `isDayReviewed(kid, dayKey)` |
| What does the family's share of the chores stand at? | `getFamilyChoreStatus(kid, weekKey)` |
| How did the week's hours go? | `getWeeklyHours(kid, weekKey)` |
| Did her money move as she decided? | `isChildMoneyCommitted(kid, weekKey)` |
| Is the week closed? | `isWeekClosed(weekKey)` |
| Can this day be reviewed yet? | `canReviewDay(kid, dayKey)` |
| Has this block's time passed? | `blockHasEnded(block, dayKey)` |
| What is the week still waiting on? | `weekDaysAwaitingReview(kid, weekKey)` |

It loads at `36`, last of the declaration files, because it calls into `01`–`35`
at runtime and none of them at load time. `99-main.js` still owns every line of
top-level executable code.

**A routine's completion IS its checklist.** `block.completed` survives as a
derived mirror — written on every checklist change, never decided beside it.
Three defects used to compound here: `countChecklistDone` counted every `true`
in `checklistState` while `countChecklistTotal` counted only current items, so
one block read 4/3 on the day view and 3/3 on the chore tab; `getKidExtras` took
no child and read the active profile, so the portal viewing Jenn measured her
routine against Jess's items; and the day-level "kept" mark was sticky by design,
so unticking could never take anything back. `routineItemsFor` is the one item
list, counted by id, per child. `ctSyncMandatoryFromRoutine` sets **and clears**
— but only clears a mark the app itself made, because a parent's tick in the
meeting is her assertion and a child unticking must not overrule it.

**A day cannot be reviewed before it has happened.** `canReviewDay` is the one
decision, asked by the parent day banner, the meeting's step 1 rows (and its
Both control) and `canCloseWeek` — which no longer counts a day that has not
arrived as a day somebody failed to review. Two holes it closed: eligibility
asked whether a block had **started**, so a swim still running counted as
something to sign off, and `dayBlocksEligibleToConfirm` measures
`startMin + durationMin` now; and a day with **no blocks** passed every check
trivially, so a Thursday three weeks out could be marked reviewed. An empty past
day stays reviewable — a quiet Sunday is a real answer — but says "nothing was
recorded" out loud first. `reviewBlockedReason` is the sentence a refused control
says: it could previously only ever be "Confirm the blocks first", so a day
refused for not having happened told a parent to confirm blocks that did not
exist.

**Today is `'open'`, and that is a third thing.** An empty PAST day is a real
answer; today holding nothing at nine in the morning is not — it is a day that
has not been lived, and signing it off reviews the swimming nobody has put on it
yet. Nor is it only about emptiness: a today whose blocks have all ENDED is the
same case. So today reports `'open'` — reviewable, but only through an explicit
"nothing else is planned", the way an empty day already asks before it is signed
off blank — and until somebody says that, it holds the week open.

**Only a day that has not happened is excused from closing a week.**
`canCloseWeek` used to excuse a **running** day alongside a future one, so a
Sunday sitting held while the swimming was still in the pool counted six of six
and closed. `mmCloseSummary` carried the same exclusion, so the figure a parent
read agreed with the gate they pressed while both were wrong together —
`weekDaysAwaitingReview` is that one decision now, and both ask it.

**A week does not close over a blank reflection, nor over a conversation nobody
had.** Step 5 showed `0/3` and closed anyway. Two questions, deliberately kept
apart because different callers ask them: `reflIsSettled` — three tabs answered
or explicitly skipped — decides whether there is anything for a parent to TICK;
`reflIsClosable` decides whether the week may close on it, and a **finished**
reflection needs `parentReviewedAt` as well. A skipped one does not: there was no
conversation to confirm, and a skip must never be able to trap the family. Since
`reflEdit` clears the tick whenever her answers move, reworking an answer after
they talked correctly re-opens the week — which is why step 5 says *complete ·
conversation not confirmed* rather than just "complete". Money settlement stays
independent of all of it, deliberately.

**Closing a week that has not ended is offered, not refused.** Every elapsed day
being reviewed is not the same as the week being over: with today signed off
through "nothing else today", a Tuesday satisfies the gate. `isWeekClosed` has
only two readers — step 5's own UI and `reflIsLocked` — the money is frozen by
settlement rather than by closure, and `mmReopenWeek` is the way back, so this
is a confirmation rather than a prohibition. `mmDaysStillAhead` names the days
still to come and is empty on the last day, so the ordinary Sunday-afternoon
meeting is never asked to justify itself.

**Confirming is not completing, and neither is reviewing.** A parent may confirm
an unfinished routine and it must not start reading as finished. `confirmAllBlocksForChild`
marks blocks *completed and confirmed* for **one named child** — only blocks that
have already started, so a nine o'clock press cannot mark the evening's swim
done — and never touches `parentDayConfirm`. `markDayReviewedForChild` is the
other fact and changes no completion. Reviewing a day is **per child**: the
meeting's day rows carry a control each plus an explicit Both.

**"It was planned and it did not happen" is a THIRD answer.** `confirmed` and
its absence were the whole vocabulary, so a plan that was not carried out had
nowhere to be recorded, and every route out stated something false: "Confirm
all" marks the blocks done *and* grades their chores at "on time", the edit
sheet's confirm toggle graded a chore nobody claimed, and deleting the blocks
rewrites the plan the reflection reads. The day then held the whole week open
through `canCloseWeek`, for the one reason a parent had no move against.

`isBlockNotDone` is not "unconfirmed" and not "completed" — it is a parent's
account of the day. It completes nothing and earns no XP, but it **reaches the
money**: a grade above zero on a block that did not happen is paying for work
nobody did, so `ungradeChoresFromBlock` clears it through `mrSetChoreGrade`, and
the confirmation names every chore and the total first. XP is not clawed back —
`xpCredit` is forward-only and there is no path back into the ledger — so the
confirmation says so. A block that has not ENDED is refused, and a completed
routine is refused rather than overwritten, because a routine's completion IS
its checklist and clearing it would wipe the child's own ticks.

**Confirmed and not-done are mutually exclusive IN THE RECORD**, never worked
out at read time. Blocks merge whole-record newest-wins through `mergeArrayById`,
so a block carrying both flags survives a sync intact and every predicate
downstream then disagrees with the next. Both writers `delete` the other flag,
and both stamp `markItemUpdated` — `setDayBlocks` does NOT stamp, which is why
`toggleConfirm` could previously lose a confirmation to a stale remote copy.

Drawn as a **marker, never a fade**, on the day view, the week card and Today's
ribbon. `--missed` was removed deliberately because an *unconfirmed* block must
not look like a child's failure; this is the opposite case, so the fill keeps
full strength and a ring and badge carry it. On the ribbon it needs a third
border treatment, or dashed-not-confirmed reads as "nobody has said" about the
one block somebody has.

**A scheduled chore is not a fulfilled one.** `required` / `planned` /
`fulfilled` / `waiting` are four numbers, and only a positive parent grade is
fulfilled. The kid surfaces measure `stillNeedsADay` and stay forward-voiced and
current-week; the **review voice** (owed / fulfilled / unfulfilled) lives on the
parent and meeting screens, where a past week's shortfall is always shown. No
shortfall is carried into the next week.

## Category › subgroup › activity — the third question

`cat` answers **what colour is this block**. `group` answers **what is this time
FOR** — the eight rows every hours chart and the XP gate read. Neither is a shape
a person can navigate: a picker with nine flat chips, three of which mean the
same thing to a ten-year-old, is a list you scroll rather than a place you know
your way around. "Learning" held a school day, a French lesson and a piano
practice, and all three drew in the same blue.

So `ACTIVITY_CATEGORIES` (`js/01-config.js`): **six categories, each holding one
or more subgroups**, and every shipped activity names one with `sub:`.

| Category | Subgroups (hue) |
|---|---|
| 🌅 Daily Rhythm | Routine `#8ad8d0` · Helping hands `#229eb1` |
| 🍎 Fuel & Care | Meals `#ffd166` · Appointments `#e3c48f` |
| 🧠 Brain Construction | School `#6fb1fc` · Language `#8ed0f0` · Arts `#b0a0ea` |
| 💪 Body Construction | Training `#f2597d` · Everyday movement `#ff9a76` |
| 🧭 Explore | Outings `#d98ac8` |
| 🎮 Play & Rest | Play `#7fca79` · Seasonal treats `#cfe06b` |

**Measure colour distance the way an eye does — CIEDE2000, never CIE76.** The
first separation of this table used CIE76, which overstates the distance between
saturated greens by roughly double: it scored Helping hands against Play at 49
where the answer is **19**, so a palette that cleared every threshold on paper
still had two *different* categories reading as one colour on an iPad. Worse,
the "fix" it endorsed — deepening Play — walked it *toward* Helping hands,
because both are greens. `colourDistance` (`js/05-helpers.js`) is CIEDE2000 and
`everySubgroupTellsItselfApart` (`tests/smoke.js`) holds the table to it, so the
check measures the same way the palette was chosen.

**The figure that matters is the worst CROSS-category pair.** Two subgroups
inside one category are *meant* to look related — Meals and Appointments are both
Fuel & Care and sit at 9.8, which is the design working. Two subgroups in
different categories reading as one colour is the defect, and that pair was
**2.9**: Helping hands and Play, a chore and an afternoon of Minecraft, the same
colour to any eye. The floor is 14 on cross-category pairs only; within a
category all that is required is that two are not literally the same hex.

Five of the twelve were crowded into one green-teal corner, so **Helping hands
left it entirely** (chores are not a shade of rest) and **Explore left the greens
too**. Helping hands went to a deep cyan rather than somewhere warm, so Daily
Rhythm still reads as one category — a light aqua and a deep cyan are obviously
siblings, which is the point of having categories at all. Training was lifted off
`#ef476f` in the same pass: it gave dark ink 4.27:1, the one value in the table
under the 4.5:1 the contrast rule asks for.

**A recolour has a half that fails silently.** `SEEDED_HEX_VALUES` is what lets
`blockColour` tell a colour somebody CHOSE from one a placement copied out of the
table — so the moment a hex changes, the retired value drops out of that set and
every block already on the calendar starts reading as a deliberate choice,
frozen at the old hue **forever**. No migration can fix it: `deepMergeObj` lets a
remote scalar win, so a device serving an older bundle out of a Pages cache would
push the old colours straight back. `RETIRED_SEEDED_HEXES` (`js/01-config.js`)
must **grow on every recolour and never be pruned**, and the guard asserts both
halves — a retired hue re-derives, a hand-picked one is left alone.

**One owner, and the recolour is what proves it.** `ACTIVITY_GROUPS` carried its
own `hex` on every row, four of them repeating a subgroup value exactly, so
moving a hue would have recoloured the cards and left the hours charts and the
meeting bars on the old values. `groupHex` derives from the subgroup table now.
The same trap sat in three render paths that read `b.colour || CAT_HEX[act.cat]`
directly — the week and day buffer strips and the sibling preview — which takes
the SEEDED value `blockColour` exists to ignore, so a card would have drawn in
the new hue with its own travel strip still in the old one. All three call
`blockColour`. `CAT_COLOUR`, a third copy of the same table with zero consumers,
is gone.

**The week legend draws the colours the cards actually wear.** It listed the
eight chart groups, then the six categories — closer, but still not what a card
wears. Half the hues on the grid (Helping hands, Appointments, Language, Arts,
Everyday movement, Seasonal treats) appeared in no key at all, one of them the
very colour a parent could not tell from Play. All twelve now, grouped under
their category so it still reads as six ideas. `.tg-legend-cat` sits at the kid
floor of 13.1px, not below it — this is a kid screen, and "it is only a heading"
is not an exemption.

**The subgroup is the hue; the category picks it.** `blockColour` reads
`activitySub(act).hex`. A stored `b.colour` counts only when somebody CHOSE it:
every placement path seeded one out of the shipped table, so a value equal to
anything in `SEEDED_HEX_VALUES` is the old default written down and the answer is
derived instead — otherwise changing a subgroup's hue would leave every block
already placed wearing the one it replaced. A block whose activity **nothing
resolves** keeps the grey `#888`, explicitly: `activitySub`'s neutral landing is
Meals, which is right for filing an hours total vaguely and wrong for colour. A
block nobody can name drawn in Breakfast amber does not say "unknown", it says
"breakfast".

**The chart rows do not move.** A subgroup names a default `group`, and an
explicit `group:` on an activity still wins — that is how Muscle Relaxation sits
with the movement activities where it belongs in her week and still earns
nothing, and how Family Meeting sits beside the routines without ever being
counted as a routine session. Eight ids, same prices; three labels changed to
match the words on the picker (Daily → Fuel & Care, Free → Play & Rest, Chores →
Helping hands).

**Derived, never migrated.** Every custom activity already in Firestore carries a
`cat` and no `sub`, and `deepMergeObj` lets a remote scalar win, so a device
serving an older bundle out of a Pages cache could push an un-stamped record back
over a stamped one. `activitySub` answers at read time — the same answer whatever
has run, however often, in any merge order — and writes nothing. The same
reasoning as `xp2` and `achievementActivityId`. `cat` is still WRITTEN on a new
record (`catForSub`) because the sticker conditions, the Athlete achievement and
`ACTIVITY_OBJECTIVES_BY_CAT` all key on it.

**The Family Hero chores are archived.** They named four specific jobs the paid
pool already holds row by row — and `mrChoreTagsForDay` keys on
`actId !== 'chores'`, so a Family Hero block was never a claimable chore at all: a
child could do the washing-up under Kitchen Helper Quest and be paid nothing for
it. House Chore plus a pool row is the one way to say it.

## The picker asks what time it is

`ACTIVITY_FILTERS` is the six categories plus **✨ Mine** (which means "made by
this family, wherever it was filed" — a different question from all six, and the
only way to find the thing you made). Seasonal is a subgroup now, not a chip:
`_locked` still keeps Beach Day out of January, so nothing about availability
changed, only where it is filed.

**It leads with what fits, and "fits" is a SCORE against the clock.** Every
activity has carried `suitableTime` since the catalog was written and the picker
never asked. Asking it as a boolean was not enough: `zoneForGap` answers
`'weekend'` on its **first line** for every minute from six in the morning to ten
at night, so on a non-school day the zone carries no time-of-day information
whatever — and 47 of the 70 entries declare `'weekend'`, so they all matched
equally and the real ordering fell through to `slotPickerRecentActIds`, which is
placement frequency over four weeks. Tapping **12:30 offered Evening Routine,
Morning Routine and Dinner ahead of Lunch**, in exactly the household's
most-placed order. The hour changed nothing but the heading text.

Two questions, two owners. `clockZoneForMin` (`js/17-ui-misc.js`) is the band
regardless of what KIND of day it is; `zoneForGap` stays the calendar answer.
**`'midday'`** joins the vocabulary as the school-hours band on a day with no
school — the one band it could not say, and the reason Lunch had nowhere to
belong. `slotPickerFit` scores: **+3** a direct hit on the clock band, **+1** the
calendar zone alone (right kind of day, nothing about the hour), **−2** when the
activity names clock bands and none of them is this one. `school` and `midday`
read each other as a near miss, being the same hours on two kinds of day.

The penalty keys on the **clock hit, not on the total** — written as
`score === 0` it never fires for anything also carrying `'weekend'`, so Breakfast
stayed level with an activity that had never said when it belongs. Being on
record as a morning thing is what should sink it at midday.

The **room** check stays a hard filter, because a seven-hour School Day in the
hour before dinner is not a poor fit but an impossible one. It RANKS, it does not
hide: everything else follows under its own heading, because a picker that hides
things is one she stops trusting. An **appointment ranks last** within a score —
a time somebody else set is not something a child picks to fill an afternoon
with. Recency survives as the final tie-break, which is where the household's own
habits still count.

**Both headings survive an empty suggestion row.** They used to vanish together,
leaving a bare undifferentiated list — and that is the NORMAL case at midday on a
school day, where the only match for the school band is School Day itself and it
is far too long to fit. It says *Nothing obvious for 12:30pm* rather than saying
nothing. `theSuggestionsAnswerTheClock` asserts the ORDERING, not the presence of
a heading: the previous check asserted only that "Good for" existed, which was
true throughout, and is why this shipped.

**Inside a category the list is grouped by subgroup**, with the subgroup's colour
on the heading and on each tile's edge. The per-chip "last time" lift is drawn
**above every heading and removed from its own group**: grouping re-sorts into
table order, so a lifted House Chore landed back at the bottom under Helping hands
and the memory silently stopped working.

**Fixed height, fixed chip row.** `.slot-picker-list` was a `max-height`, so the
sheet was as tall as whichever category happened to be open and the whole dialog
jumped on every chip — moving the chips out from under her thumb. It is
`min(336px, 50vh)`, five rows of 56px tiles, which holds the largest category on
an iPad and scrolls inside itself on a phone. The chip row is one line that
scrolls sideways rather than wrapping, for the same reason.

**Both add-activity dialogs are rendered from the one table.** `#customCat` and
`#paCat` held a hardcoded list of eight each, copied byte for byte, so a category
added to the app reached neither. `renderCategorySelects` fills a category select
and a dependent subgroup select, hiding the second when the category has one
subgroup. The kid dialog **opens on the chip she came from** and stamps the window
she is standing in, so the thing she just invented turns up in the suggestions at
the time she invented it for. The parent editor sets the four windows and
`travels` by hand, and refuses an activity that fits nowhere — one that can never
be suggested reads as a mistake rather than a choice.

## Eight activity groups — what the time is FOR

`ACTIVITY_GROUPS` and `activityGroup(act)` in `js/01-config.js`. **Routine ·
Brain Construction · Body Construction · Chores · Daily · Free · Everyday
movement · Explore**, each with a `short` form because the week grid compresses
a label to about seven characters.

**Move and Explore were the two the table could not say.** A Saturday swim was
filed under Body beside a coached session, so the hours chart said a length of
the pool was the same ask as a training hour; and a day at a museum was "free
time", which is what the app calls doing nothing. `cat: 'active'` maps to
`move`; `explore` has no category behind it and is set explicitly, because `cat`
is busy answering the other question. `relax` carries an explicit `group:'free'`
for the same reason in reverse: rest that scores is rest turned into another
thing to perform.

**`groupDef`'s fallback is by id, not by position.** It used to return
`ACTIVITY_GROUPS[4]` — `daily`, but only because daily happened to be the fifth
row, so adding a group above it would have silently re-pointed every
unknown-group lookup. Nothing tested it until `mealsAreNotChores` did.

**`tools/xp-calibrate.js` reads the group list from the source.** It summed over
a hand-written six-id array, so adding a group left it reporting the economy the
app no longer had — no error, just the wrong numbers, which makes "change a
number and re-run the tool" a no-op. `tests/xp.test.js` now also asserts the
other direction: every group the app prices must be one the test has an opinion
about, because iterating its own `want` map is a whitelist that a new group
passes unnoticed.

`cat` still drives the picker's filters, and `CAT_HEX` survives only as
`blockColour`'s last fallback — the SUBGROUP is what decides a block's colour. This answers a different question, and it is the only one
the hours charts and the XP gate may ask. Two questions, two tables.

There were **six** copies of a label table before this, already disagreeing:
`cat:'daily'` held breakfast, lunch, dinner, the house chore, four Family Hero
tasks and two health tasks, and rendered as "🧹 Chores" on two screens and "🍽
Daily" on three. Family Hero **is** a chore — whoever did the chore is the hero —
so those carry an explicit `group:'chores'`. That is also why they are **not
rewards**: the four `REWARD_POOLS.family` activities used to carry
`rewardLocked: true`, so the thing a child had to earn was the right to help at
home. They are ordinary available activities now, ids unchanged so every
historical block still resolves. The first-run tutorial went with the lock,
because its entire content was picking one of those chores as an unlocked
"starter". An activity nothing can resolve is
filed under Daily, never dropped: an hours total that silently omits blocks is
worse than one that files them vaguely.

**Nothing is earned before it can be planned.** The other nine pool activities
followed Family Hero, and `REWARD_POOLS` went with them — their literals are
inlined into `DEFAULT_ACTIVITIES`, ids unchanged. The grant was never a level-up,
whatever the surrounding prose said: `checkLevelUp` only ever renamed and
re-iconed through `levelRules`. It was a **placed-block milestone** at 10/15/20,
so the app's answer to "you have planned ten things" was to hand back the right
to plan an eleventh *kind* of thing. `unlockedActs`, `manualPlacedCount` and
`unlockedThisWeek` are no longer seeded; a stored document that still carries
them is left alone, because `deepMergeObj` cannot express a deletion and a
tidy-up would churn the document on every sync to no effect.

Two things survive this and must not be swept up with it. **`_locked` still has
a writer** — the seasonal out-of-season rule in `getAllActivities` — and it is
the one that keeps Beach Day out of January; only `_rewardLocked` went. And the
**routine-checklist rewards** (`MORNING_LOCKED_REWARD`,
`AFTERSCHOOL_CHECKLIST_REWARDS`, `queueChecklistReward`) are a different feature
that merely shares the `#dayRewardPrompt` widget: they earn an extra checklist
*item* off a real streak rather than gating an activity. `maybeShowRewardPrompt`
drains any `{actId}` entry it is handed, because `pendingRewards` syncs and a
device serving an older bundle out of a Pages cache can still queue one — an
offer that cannot be accepted would wedge the widget for the checklist rewards
behind it. `noActivityHasToBeEarned` and `aLegacyActivityRewardDrainsAway` hold
all of this.

**A day asks for the routines it PLANNED, or its own default.** All three
sessions used to be evaluated on every day of every week, so a family that never
planned an after-school routine was permanently marked down for one.
`routineSessionsForDay` (`js/36-status.js`) is the one owner: the day's routine
blocks when there are any, otherwise **three on a school day and two on a
weekend or school-free day** — there is no after-school routine on a day with no
school. Which kind of day it is comes from `isSchoolDay`, never from the day of
the week, so the family's own calendar decides it.

`routineSessionsByDay` and `routineSessionDayCount` are derivations for the week
grids, which need a denominator: `n/7` measured a session against seven days
that never wanted it, so a weekday-only routine read 5/7 forever and looked like
failure. The kid's week grid is a **report** and drops a row no day asked for;
`ctMatrixRows` is a **form** and keeps all three, because the row is the only
door to recording a routine that happened on an unplanned day.

**The rule SHOWS everywhere and PRICES only from `mrRoutineRuleStartWeek` on.**
A day that asks for fewer routines is easier to keep clean, which makes a streak
tier easier to reach — right going forward, wrong backwards, because an
unsettled old week re-prices from the live plan. `mrRoutineSessionsFor`
(`js/18-rules.js`) is the money-side gate, and `mrStreakDayDone` and
`mrStreakWeek` both ask it so they cannot disagree about the same week.
`ctWeekHasData` and the legacy import still say `CT_SESSIONS` on purpose, with a
reason at each site.

School lives inside Brain and is ~32 hours a week, so the Brain row **names how
much of itself was the school day** — otherwise homework can never be seen to
move. `getWeeklyHours` returns `schoolMin` for exactly that.

**The charts say hours, on one scale.** `6h 30m completed / 8h planned`, scaled
against a single maximum across both girls and every week shown. Each bar used to
be normalised to its own kid's planned total, so two equal bars meant different
amounts and no bar could be compared week to week. Labelled **"planned hours
completed"** — the app records no elapsed time and must not imply it does.

## XP: one ledger, one gate, calibrated

`tools/xp-calibrate.js` replays the rules over synthetic quiet / ordinary /
strong weeks and reports levels gained; `tests/xp.test.js` locks the values and
re-runs it. **Change a number and re-run the tool** — the first set of values
tried here levelled a child every half-week, and the tool is what said so.

Every completed block used to earn a flat `QUEST_XP_PER_TASK` (20) against 100
per level: five blocks was a level, an ordinary day was two, and a bowl of cereal
was worth a swim session. There was no cap, and `mrCreditWeekXp` added the
meeting's awards on top through a second path.

Now: `xpCredit` (`js/06-quests.js`) is the **only** writer of the total, both
paths go through it with a `weekKey`, and `XP_WEEKLY_CAP` (260) is one allowance
they share. Work past the cap still happens and still counts — it just stops
printing levels; a cap that silenced the work would be worse than none.
`QUEST_XP_BY_GROUP` prices a block by group, and **Daily and Free earn nothing** —
not a judgement about rest, but a statement that XP records effort.
`mrXpLevelInfo` is the one level calculation; Today's hero and the parent portal
each did their own and could disagree about the same child.

**Nothing is migrated, deliberately.** Raising the threshold 100 → 400 would
demote both girls, and a one-time rescale is unsafe here: `deepMergeObj` lets a
remote **scalar** win, so a device still serving the old bundle out of a Pages
cache could push an un-rescaled total over a rescaled one, or two devices could
rescale the same figure twice. `progress.xp2` holds the new scale and, when it is
absent, the answer is **derived** from the legacy `questXP` — the same answer
whatever has run, however often, in any merge order.

## Three steps, and they have IDS

It was five — *Check the week · Reflect · What I earned · What I do with it ·
Close & plan*. Eight weeks went unsettled, and the reason was never that any
one step is hard: **five is the wrong shape for a Sunday with two children in
the room.** Three of the five merged in pairs that were always about the same
thing.

| Step | Was |
|---|---|
| **The week** | what happened, and what she made of it (1 + 2) |
| **The money** | what it came to, and where it goes (3 + 4) |
| **Close** | (5) |

**The numbers were POSITIONS, and 46 call sites held them.** `mmGoStep(3)`
appeared eleven times, `mmGoStep(4)` eight, across the app and the suite.
Renumbering would have silently re-pointed every one at a different screen —
the same defect as `groupDef` returning `ACTIVITY_GROUPS[4]` because daily
happened to be the fifth row.

So a step has an **id**, and three functions keep the two numberings apart:

| | |
|---|---|
| `mmGoTo(id)` | name a step — what everything inside the meeting uses |
| `mmGoIndex(i)` | 1-based into `MM_STEPS` — the stepper and the ◀ ▶ nav |
| `mmGoStep(n)` | the **legacy five**, translated through `MM_LEGACY_STEP` |

`mmGoStep` is the only place that knows the old numbering, so every existing
caller keeps meaning what it meant: "go to what she earned" still lands on the
money. **Getting this wrong once cost a crash** — the first cut clamped `n`
straight into the new list, so `mmGoStep(2)`, every caller meaning *the
reflection*, silently landed on the money. That is the position-not-id defect
committed while writing the warning about it.

`mmMaxStep` is compared against `mmStepIndex('money') + 1` rather than the
literal `3` it used to be: that number was the position of "What I earned" in a
five-row list and would have come to mean "Close" the moment the list changed
length.

**A step is a list of panels, not a rewrite.** `mmRenderReview`,
`mmRenderReflect`, `mnyRenderEarned` and `mnyRenderDecide` each still own
exactly what they owned; a step concatenates them. Rewriting four renderers
into two would have been four chances to lose a rule only one of them knew.

**One set of chrome per screen.** Each money panel drew its own page head,
five-page bar and kid tabs, so merging them stacked **two identical five-tab
navs** on the screen whose whole purpose is to be less to wade through — the
six-button-shortcut-row defect again. `opts.chrome === false` drops a panel's
head in favour of a section heading, and the step renders the bar once. A
chrome flag is not a second renderer.

**THE MONEY STEP'S FOOTER IS THE COMMIT, not a Next.** `mmMoneyFooter` owns it.
The commit was a bar somewhere in the middle of a long scrolling panel, and on
this screen that is not a matter of taste: it is the one control in the app that
moves real money, and one you have to go looking for is one that gets missed on
a Sunday and one that gets pressed while scrolling past it. In the footer it is
always visible, always in the same place, and it says what it will do or why it
cannot.

It is **still a separate gated act**: putting "what I earned" and "what I do
with it" on one screen must not make scrolling to the bottom a commit. The
footer only becomes a way onwards once the money has actually moved — and when
the other child is still undecided it offers *her*, because a sitting that skips
a child is how a week comes to be half-settled with nothing saying so.

**`mnyCommitRefusal` is the one owner of why a split cannot commit.** Two things
ask it now — the panel where the plan is edited, and the footer button — and two
copies of a rule about moving money has a worst case worth naming: a button
offering to commit while the panel above it says it cannot.

## The meeting is a SCREEN, not a pop-up

It ran inside `familyMeetingOverlay`, a `.sheet` — a box floating over the page
with its own scrollbar. A Sunday sitting is the **longest task in this app**:
two children, a week of days, a reflection each and a money split. Inside a
sheet that meant scrolling a small window up and down the whole way through,
which is the owner's own report of using it. **A task that takes twenty minutes
is not a dialog.**

It is `screen-meeting` now and `showScreen` opens it. That is not a second
dialog mechanism growing beside `openSheet`/`closeSheet` — it is **one fewer**.
The sheets that remain are what a sheet should be: short, one question,
answered and gone.

**Three owners, which is why the switch was a one-place change.** Nineteen call
sites across seven files each spelled out their own
`document.getElementById('familyMeetingOverlay').classList.contains('open')` —
the six-copies defect this file keeps recording, and exactly what would have
made this a nineteen-place edit with nineteen chances to miss one.

| Question | Function |
|---|---|
| Is the meeting showing? | `mmIsOpen()` |
| Open it | `mmShow()` |
| Close it | `mmHide()` |

**`mmHide` returns to where the sitting came from.** As a sheet that was free —
closing revealed whatever had been behind it — and a screen has to remember, so
`mmShow` records the active screen in `mmCameFrom` (device-local; which screen
someone is on is not the family's data, and every state write is a full-document
upload). It never records the meeting as its own origin: `mmShow` is called
again by every path that re-enters a sitting already open, and a self-reference
would trap the Close control on this screen.

**`closeSheet` stopped carrying one caller's knowledge.** It held a special case
for this one id — refresh the parent hub when the meeting closes — and that is
`mmHide`'s now. A general mechanism should not know about one of its callers.

**The layout is unchanged, and that is why the move was cheap.** The meeting was
already a flex column with `.mm-body` as its one scroller and the head and foot
as real flex children taking layout space (never sticky, which floats a band
over a card). It only had to stop being 88% of the viewport inside a floating
box and start being `100dvh` of the screen. `theMeetingKeepsItsHeadAndFeet`
asserts the same properties against `.mm-screen`.

The kid nav and the parent bar both hide themselves here without any change:
`TD_NAV_SCREENS` does not list `screen-meeting`, and `parentRenderNav` shows
only on `screen-parent`. `applyMeetingLock` keys on the return context rather
than on the overlay, so it was unaffected too.

## The meeting

**A return context, reused unchanged by Meeting V2.** `mmReturn` records
`{ source, weekKey, step, child, selectedDay, scrollTop }` before the overlay
closes. Both parent banners share `parentBannerBackButton()`, which reads "Back
to weekly meeting" while one is waiting and "◀ Hub" otherwise. `applyMeetingLock`
**hides the Hub link and both child switchers** while a sitting is open: three
controls that each silently abandoned the meeting is worse than one that says
where it goes.

**A lock that cannot be lifted is not a lock, it is damage.** Two things were
wrong with it. It swept the whole document for `.profile-badge`, so a sitting on
the week screen also hid the switcher on Today, the chore tab and Sister Sync —
four screens it is not about; it names `MEETING_LOCK_BADGES`
(`weekProfileBadge`, `dayProfileBadge`) by id now. And `locked` was
`mmHasReturn()` alone while both call sites sat inside `if (isParent())`, so
nothing ever ran it with the lock off: start a meeting, look at the week, switch
to a kid, and every badge stayed hidden for the rest of the session on all five
screens. `locked` is `isParent() && mmHasReturn()`, and `renderWeek` and
`openDay` call it **outside** their `isParent()` branches, so a child's own
render is what puts the control back. `mmClearReturn()` only nulls the variable
— it un-hides nothing, and never could.

**A day refused only for `unconfirmed` is the one refusal a SITTING may talk its
way past.** `mmOverridableRefusal` names it: blocks nobody answered, which is
exactly what makes an old week stick. `future` and `running` are refused over
time, which no amount of agreeing changes, so they stay hard everywhere — and so
does the parent day banner, because the offer belongs to a sitting where a
grown-up is working through a week on purpose, not to the day screen where a
stray tap would record a review nobody meant.

The offer is **inline on the row, never a modal**: a three-button sheet would be
a second dialog mechanism beside `openSheet`/`closeSheet`, which own focus and
Escape, and an offer that has to be discovered is one a parent works around.
Three answers — leave the blocks and review, open the day, or record them as not
done and review. Only the last moves money, so only the last confirms. A week
already settled refuses it and offers `mnyReopenWeek` instead, because changing
a grade after settlement edits a record the wallet no longer reflects.

**A settled week's money cannot be taken back, and nothing may claim it can.**
`committedAt` is written once at step 4 and **nothing anywhere clears it**;
`mnyReopenWeek` refuses a committed week outright; and the meeting's Undo lives
in a session-local `mmUndo` that is gone the moment the sheet closes. So the
record-and-review answer refuses — but NARROWLY, through
`notDoneIsFrozenFor` (`js/09-sheets.js`): it asks whether *this* action would
move money, not whether the week is settled. A swim recorded as not done in a
settled week costs nothing and is still allowed, so a whole week does not become
unrecordable to protect one grade. An earlier draft offered to "reopen her week"
and called `mnyReopenWeek`, which returns false for exactly this case, then
toasted that it had — a button announcing something it had not done, which is
the defect this file keeps recording. The check that guards it is what found it.

**Step 1 had no route to the day or the week at all**, on any week: `openkidday`
was dispatched with no button anywhere rendering it, and the only `openweek`
button was in step 2. Both steps carry the per-child pair now, from one writer
with one set of labels.

**Fines are entered on step 1, where the day key already is.** `mrAddFine` takes
a `dayKey`, step 1 walks the week day by day, and step 3 is a totals screen that
would have to ask which day. `cpFines` stays as the day-to-day surface. Two
entry points, one writer (`mrAddFine`), one arithmetic owner (`mrFinesWeek`) —
not the "six copies" defect, which was six places each deciding the answer.

**A planned competition must be scored before the week settles.** A meet could
be planned and never recorded, and the answer was unsayable: `$0` in the totals
reads identically for "no meet", "a meet worth nothing", "a voided channel" and
"an override to zero". Step 3 lists every planned meet with no result and offers
a one-tap **No criteria met · $0**, which `mrAddCompetition` persists cleanly
(unlike `mrSetChoreGrade`, which DELETES at zero). `mmUnrecordedCompetitions`
matches on day **and** name, or two meets on one Saturday are both satisfied by
recording either.

**Step 2 asks the child; it does not tell her about herself.** `js/37-reflection.js`
owns the record and nothing else. Three questions in this order — *What went
well? · What problem did you notice? · What will you do next time?* — because a
child asked what went wrong before she is asked what went right has been told
what the conversation is about. The second tab is **Needs work**, never "Bad": a
behaviour can need work, a child cannot.

The record is `state.shared.chore.reflections[weekKey][kid]`, the same shape and
container as `weekConfirms` and `weekPlans`, and `mergeSharedChore` arbitrates it
the same way — **newest whole record per week per kid**. That is not a style
choice: `deepMergeObj` treats an array as a scalar, so `answerIds` would be
replaced by whichever snapshot arrived last with no timestamp consulted, and
unticking an answer on the iPad could be undone by a stale phone. A record
replaced whole cannot lose one of its own fields.

Rules the screen holds, all of them in the handler rather than only in the
markup — a `disabled` attribute is a hint to the pointer, not a rule:

- **evidence never selects an answer.** It is offered *underneath* her own, and
  folded by default. The app answering for her is the one thing this screen must
  not do.
- at most **two** things went well, exactly **one** problem, exactly **one**
  action.
- **naming a cause does not finish the second tab.** An explanation is not a
  solution; "I need help finding one" is a real answer where silence is not.
- the parent's tick records **that the conversation happened**. It asserts no
  agreement and changes no completion, grade, XP or money. It is offered only
  once there is something to have talked about — complete, or explicitly
  skipped — because closing a week now counts it, and a tick on a blank record
  would be a conversation recorded about nothing.
- **skipping is explicit and reversible**, and never blocks the settlement. It is
  offered only while something is still unanswered: setting aside a reflection
  that is already finished is a contradiction, and finishing one clears
  `skippedAt`.
- **no two of those states may disagree.** `reflStampAnswered` owns the derived
  marks so no caller has to remember them: completing clears the skip, and any
  change to *her answers* clears `parentReviewedAt` — a tick describes the
  answers that were on screen when they talked, so it cannot survive her
  rewriting one. `reflAnswerSignature` is what draws that line, which is how the
  tick survives its own write and the parent's own observation field.

**Evidence counts what has ENDED, and names what is waiting.** Needs Work read
the week from midnight, so a swim at six was offered to a child at breakfast as a
block she had "not marked done" — telling her she had failed at something she had
not yet had the chance to do. It measures `blockHasEnded` now, the same
arithmetic `canReviewDay` uses. And a chore she had DONE and claimed read as
"still owed" while it sat in a parent's queue: `getFamilyChoreStatus` already
separates `waiting` from `fulfilled` and outstanding, so the evidence says which
is which rather than blaming a child for somebody else's inbox.

**A recorded action keeps its own words.** `actionText` was written and read by
nothing — the display rebuilt the label from the current answer list, so
rewording an option would silently change what a reflection from six months ago
appears to say. `reflActionLabel` derives the live label and is what gets STORED;
`reflActionText` prefers the stored words and falls back to the label only for a
record written before the field carried anything. `actionTextId` says which
answer the stored words belong to, so picking a different action rewrites them
and rewording the list never does.

**The action is saved either way; putting it in a plan is a separate act.** She
picks it and it is in the record immediately. Carrying it forward is offered, not
automatic, and never happens without a confirmation naming the child, the week
and what will appear. `reflTargetWeek` decides where it lands, and **not** by
taking the week after the one on screen: a current week plans into next week, and
anything older plans into the week we are actually in — a sitting held six weeks
late must not write into a week that has already happened, which is the defect
that retired `mmPlanNextWeek`.

**Choosing a routine decides what the to-do is TIED TO, not whether one exists.**
Attaching used to write no to-do at all — only `linkedRoutineId` into the
reflection, a field no routine, block, checklist or planner ever read. The app
said "Attached ✅" and nothing anywhere changed, and the smoke check asserted
that the *field* was recorded, so it passed green over a complete no-op — the
same shape as the `|| break` bug this file already documents. Both paths write a
real to-do now; picking a routine additionally sets `linkType:'activity'` and
`linkActId`, which is what `getTodoLinkStats` (`js/12-goals.js`) already read, so
the to-do carries that routine's progress beside it. `carriedTodoId` names what
was created; `reflCarryLabel` is the one sentence saying where it went, which is
what step 5 reports.

**`carriedTodoId` is the only evidence a carry actually happened.**
`reflCarriedForward` accepts it, and accepts the legacy `linkedBlockId` because
the old to-do path DID write a to-do beside it. It deliberately does **not**
accept `linkedRoutineId` on its own: `targetWeek` plus a routine id and no
`carriedTodoId` is precisely what the broken button produced, and reading that as
carried is worse than the bug it came from — the old build failed silently, this
would state "in next week's to-dos · with Morning Routine" about something that
never existed while never offering the button again. Read as not carried, the
offer returns and the next tap writes the real thing, so the record repairs
itself with no migration. `addKidExtra` is deliberately NOT used: it reads the active
profile rather than the child being reviewed, and a routine checklist item is a
standing rule rather than one week's action.

**A closed week's reflection is a record.** `reflIsLocked` gates every edit path —
chips, keyboard, the parent tick, the skip and the carry-forward — because the
money and the grades are already frozen when a week closes and a reflection that
could still be rewritten would be the odd one out. Paging through it stays
available; reopening the week on step 5 is the way back in, the same door every
other frozen fact uses.

**Two things are kept apart from her own words.** `inputMode` records *how* the
answer was given — spoken, or scribed by whoever held the iPad — and nothing
about what it was: a child who explained it well to her parent has answered, and
making her type it to make it count turns a conversation into a form.
`parentObservation` is a second account of the week in its own labelled field,
and it can never overwrite hers. `evidenceIds` keeps what the app was *offering*
when she answered, never what she picked — nothing on this screen selects an
answer.

**A tap edits a draft, not the document.** Every write is a full-document upload
and this is the tap-heaviest screen in the app, so `reflDraft` is device-local
and `reflCommitDraft` writes on the moves that mean she has finished with a tab —
switching tab or child, leaving for her week, changing step, closing the meeting.
Three writes per child per sitting instead of twenty, and the smoke check counts
them rather than trusting it.

**A past week cannot plan forward.** `mmWeekPosition(wk)` decides what step 5
offers. Current: close the week (`canCloseWeek` refuses until both girls' days
are reviewed and both are settled) and open next week. Past: finish reviewing,
return to the present — no copy. Future: cannot be reviewed or closed.
`mmPlanNextWeek` is **gone**; it read whichever week the meeting pointed at and
then did `weekOffset += 1`, so a six-week-old sitting wrote its plan over the
following historical week. Copying belongs in the planner, beside the week it
would land on.

**One undo snapshot per week, taken by whichever commit comes first.**
`mmTakeUndoSnapshot` ran once per child, so settling Jess overwrote the picture
taken before Jenn; undo put Jess back, left Jenn's money moved, and printed
"nothing was recorded". It is idempotent per week now, and the message says what
actually happened.

**Celebrate reads live sources only.** It counted chores through `ctGetOptional`
— `optionalByWeek`, the retired chore-group store — so a week of real graded work
was celebrated as zero, and it showed the preliminary money figure as though it
had been recorded.

**One scroller, both ends pinned.** `.mm-head` sticks to the top of the sheet and
`.mm-nav` to the bottom, inside the sheet's own scroll area — nesting a second
scroller would mean a flick on an iPad moves the wrong one.

## Buffer defaults: you go to some things

`travels: true` on an activity (`js/01-config.js`) makes travel **and** get-ready
default **on** when a block is placed. Training, competition, the four `appt_*`
and School Day carry it. Both sheets started every buffer off, so a swim was
planned as though it happened at the kitchen table and `tdActionableStart` — the
get-ready time Today leads with — had nothing to compute from until somebody
remembered the toggle. The default comes from the **activity**, never globally:
a global default would put a fifteen-minute car journey in front of Breakfast.

## Travel is two legs, not one figure mirrored

`travelBufMin` was a single number drawn before a block and after it, so the
ordinary Tuesday could not be said at all: **school, then straight on to
training, then home.** There is no drive home from school that day; the drive to
training leaves from the school gates rather than the house; the drive home
afterwards is longer than either. The activity you are going TO owns the travel,
so the fact is **per leg**.

`travelTo` / `travelHome` and `readyBefore` / `readyAfter`, each with its own
minutes. **Derived, never migrated:** absent means fall back to the symmetric
`travelBuffer` / `travelBufMin`, so every block already in Firestore behaves
exactly as it does today with nothing written — same reasoning as `xp2` and
`achievementActivityId`. They are block fields inside `weeks`, arbitrated
whole-record by `mergeArrayById`, so this is **not** a `state.shared` key and
needs no merge decision of its own.

`getTravelBufMin(block, side)` and `getGetReadyBufMin(block, side)` take
`'pre'` | `'post'`. **Omitting the side keeps the old answer** — the larger of
the two legs — so "does this block carry travel at all" is still right and no
existing call site could be left silently wrong by the change. Everything that
draws or measures a SEGMENT passes a side: `wfBufferSegments`,
`renderTravelBuffers`, `computeBufferConflicts`, `renderPrintSheet`,
`dayDrawnSpanMin` (post legs only — those are the minutes after the block ends).

The edit sheet's two rows read **Getting there / Coming home** and **Before /
Putting things away after**, the return leg a checkbox with its own number
beside it, greyed until it is ticked. Both legs are written out whenever the
master toggle is on, so a block says what it means rather than leaning on the
fallback — which cannot express "no drive home" at all. Warm-up stays one-sided
and training-only.

**And the sheet that summarises it names each leg from its own figure.**
`renderSheetTimeSummary` (`js/08-day-view.js`) took one travel number and one
get-ready number and applied both symmetrically, so a block with fifteen minutes
before and thirty-five after read as *15m before + 15m after*, and a block with
no drive home still promised one. Its `legs` argument is optional and absent
means symmetric — which is what the two **placement** sheets pass, because a
block being placed genuinely is symmetric until somebody edits it. A block that
goes straight on says *Going straight on — no travel home* out loud, because a
missing line reads as "nobody set it" rather than as the answer. The function
also replaced seven byte-identical call sites.

`aBlockCanGoStraightOnWithoutComingHome` asserts the legacy shape is untouched,
that the Tuesday draws no post segments, that the sheet names 35m and 25m rather
than mirroring the outbound pair, and — the half that would otherwise prove
nothing — that the *same pair with a return leg* still reports its 20-minute
clash.

## Every buffer a block carries, it can edit

`#editReadyToggle` and `#editReadyBufMin` have been in `index.html` all along,
and `openEditSheet` (`js/09-sheets.js`) showed them for a **training** block
only — everything else fell into an `else` branch that set both to
`display:none`. So travel could be adjusted on any block and get-ready on almost
none.

Exactly backwards, because of the buffer default above: placing an activity sets
`getReadyBuffer: activityTravels(act)`, so School Day, all five appointments,
Ballet, Swimming, Skating and every Explore outing arrive with get-ready
**on** — and not one of them is `isTraining`. Every block that carries the buffer
by default was a block whose buffer could not be edited, which is also most of
what the week grid draws in red: a parent looking at a twenty-minute clash had
no control anywhere in the app that would fix it.

The quieter half: `onEditBufferMinInput` read all three number inputs
unconditionally, and the non-training branch never loaded the get-ready box from
the block — so it kept its static `value="15"`, or whatever was typed on the
last training block opened that session. Changing the **travel** minutes on a
Swimming block copied that stale number into the block's get-ready and saved it.
**A hidden input is never read**, and all three are loaded from the block on
every path, not on one branch of two.

**Warm-up stays training-only.** It is a training-specific idea with its own
20-minute default, and a warm-up in front of Breakfast is what the buffer-default
rule exists to prevent. `getReadyIsEditableOnAnythingThatCarriesIt` and
`changingTravelDoesNotRewriteGetReady` hold both halves.

## Writing a plan for this repo

Problems and fixes in **plain language** — what is wrong, what it will do
instead, which files. Not code, not line numbers. Mark what changed since the
previous revision of the plan with a ```` ```diff ```` block so it carries a
background colour and can be found at a glance. Keep the whole thing scannable.

## Naming

New user-created Claude skills for this ecosystem use the `HZ-` prefix
(e.g. `HZ-web-app-audit`). Repo files, CSS classes and JS functions keep the
existing conventions: `ct*` for chore-tracker functions, `mny*` for money,
`wf-*` for the Full week grid, `wpp-*` for the week's print preview.

## The parent portal is five destinations

`Now · Meeting · History · Setup · App`, declared in `PARENT_DESTS`
(`js/11-parent.js`). It was ten flat tabs in a wrapping row, which on a phone
was three lines and no order worth learning.

**One panel renders at a time.** `renderParentHome()` used to call all ten panel
renderers on every invocation, including every kid switch, in an app where a
render can trigger a full-document write. `PARENT_PANEL_RENDERERS` maps panel id
to renderer and `setParentTab` invokes only the one being opened. **Every entry
is an arrow, not a bare reference** — this file loads at `11` and most renderers
are declared at `24`–`30`, so naming them directly would read them before their
script has run.

**A destination owns a home panel; anything else is a detail** reached from that
home with one back link. `PARENT_PANEL_DEST` says which destination owns each
panel, and `everyOldTabIsStillReachable` asserts the mapping rather than leaving
it to a person walking a checklist — a panel that quietly stops being reachable
is the failure a restructure produces.

**The boundary test decides where anything new goes:** *does changing this alter
what the girls are asked to do, or what it is worth?* Yes → **Setup**. No →
**App**. Change history sits in Setup, next to the things it logs.

**`parentScope` is not `parentViewing`.** The switcher has a **Both** state, but
that value must never reach `parentViewing`: 27 places read that global and most
are outside the portal — `activeProfile`, the week view, block grading, the quest
strip — and every one assumes a real child. Scope is a separate flag read only by
the portal; `parentViewing` always holds a real kid. Anything that changes which
child is shown goes through `setParentScope`, never straight at the global — that
is what left three switchers disagreeing with each other.

**The phone gets a bottom bar** (`parentRenderNav`), the kid nav's shape and 44px
floor, below the 700px breakpoint only; the iPad keeps the top strip. It drives
`setParentTab`, not `showScreen` — the portal is one screen with panels.

**A backlogged week has a short road** (`mmOpenExpress`): totals, two ticks,
close, next. It is not a second way to move money — it commits through
`commitFamilyMeeting` like step 4, and `mmMarkWeekMet` stays the separate record
of having sat down. `mmMaxStep` never leaves 1 while it is on, which is what
keeps `mmCloseMeeting` from marking a week met that was only recorded.

**Now counts and routes; it never decides.** Every number on it is read through
the accessor the owning screen uses, and there is deliberately no control on it
that grades, settles or approves. A second place that decides how a chore is
graded is a second place that can disagree with the first.

**Copying a plan shows its work first.** Setup › Copy a plan
(`js/34-parent-copyweek.js`) does a whole week or a single day — a span toggle,
not a second screen, because `pcwPlan()` stays the one decision either way. In
day mode the two weekday pickers may differ: "put Tuesday's shape on Thursday" is
a real thing to want. It owns no clone rule: `weekCloneBlock` (`js/07-week-view.js`)
still decides what a copy arrives as — not done, not confirmed, no XP, no ticked
checklist, no gear or training ticks, a stopwatch at zero, and **no `seriesId`**.

That last one is the load-bearing part. A copy used to inherit the original's
series, and `countSeriesBlocks` scans every week of a profile — so editing a
copied block offered "update all" and rewrote the weeks it was copied FROM, and
"remove all in series" wrote `'sr:'+seriesId` into `state.shared.tombstones`,
which is **shared, not per-profile**, so through `blockTombstoned`
(`js/04-merge.js`) one delete could drop the sister's cross-copied blocks on the
next merge. `weekCloneBlock` also deep-copies `objectives`, `gearState`,
`trainingCheck` and `stopwatch`: `Object.assign` is shallow, and a copy and its
original shared those by reference until the next reload re-parsed the JSON.

**A day copy reaches two children and any week.** `copyDayInto(srcKey, dstKey,
srcP, dstP)` is the one engine; the kid's 📋 sheet drives it for last / this /
next week on her own days, and cross-child is parent-only because a day copy
REPLACES the destination. Unplaceable blocks are dropped through
`placeableActivityIds` (`js/05-helpers.js` — one owner, shared with `pcw`) and
the count of what was left behind is always said out loud.

**A repeat is materialised, and it remembers what it is.** `seriesDayKeys`
(`js/05-helpers.js`) is the one place that answers which days a repeat covers —
days of the week, **every N weeks**, from a start date through an end date — and
`placeBlock` stamps `seriesDays`, `seriesEvery`, `seriesStart` and `seriesEnd`
onto every block it makes, so the edit sheet can read the repeat back instead of
just counting siblings. The phase anchor is the Monday of the day the block was
placed on, not of the start date: typing "from next Monday" must not silently
shift which weeks are on. Horizon capped at `SERIES_MAX_WEEKS` (26) and
`SERIES_MAX_BLOCKS` (120), because one press must not write a year of blocks into
a document that uploads whole on every change. Moving the end date runs
`seriesExtendTo`, which adds and removes real blocks — but never a day already
ticked or confirmed, which is a record rather than a line in a plan.

The other two week copies are not general enough to replace `pcw` and are
deliberately left alone:
`mmPlanNextWeek` copies *this* week into next for both girls from inside the
meeting, and `fillWeekFromNearest` fills a **blank** week from whichever
neighbour it picks.

`pcwPlan()` is the single decision — the preview and the commit both read it, so
what a parent is shown is literally what will happen, and it reads every source
day before anything is written (which is what makes a same-week cross-child copy
safe). A day that already holds a plan is **skipped** by default; **Replace it**
is a separate choice, confirmed, and tombstones what it removed — without the
tombstone a merge from another device brings the old blocks straight back and
the day ends up holding both plans. A copy that silently skipped four of seven
days is how a parent comes to believe a week is planned when it is not, which is
why the day-by-day preview is not optional chrome.

Cross-child is the one place blocks are dropped: a block naming an activity
private to Jenn renders as **nothing at all** on Jess's day — the same invisible
failure the archive rule exists to stop — so `pcwPlaceableIds` filters them and
the card says how many were left behind and why. Same-child copies are never
filtered: her own blocks resolve however they resolve, and dropping one there
would be this screen quietly deciding a block was wrong.

The girls' five-page money bar (`mnyTabBar`) is **not** on the parent's Money
rules page. It is their wayfinding through their own pages, and it rendered above
the section rail — portal nav, then kid nav, then sections. It stays on all three
kid pages and inside the meeting.

## An achievement nobody chose is not an achievement

`addAchievement` used to seed `getAllActivities()[0]`, and `DEFAULT_ACTIVITIES[0]`
is Breakfast, so every achievement anyone added arrived reading **"🍳 Breakfast ·
count target 1"**. Nobody chose that; it was alphabetical accident presented as a
decision. New ones start `activityId: null`, but the records already written were
never corrected and still read as somebody's decision.

`achievementActivityId(a)` (`js/12-goals.js`) is the one place that answers *which
activity did somebody actually choose*, and every reader goes through it —
`progressForAchievement` and `buildAchievementRow`, which already render "No
activity yet · Tap 'Link activity'" for an unassigned one, so nothing else had to
change.

**The seeded shape is identifiable exactly.** The old creator wrote `createdAt`
and never `updatedAt`, while every edit path — `setAchievementActivity`,
`setAchievementMode`, `setAchievementTarget` — goes through `markItemUpdated`. So
an `activityId` on a record with **no `updatedAt`** can only have come from the
seeder, and a parent who genuinely picked Breakfast stamped `updatedAt` in doing
so and is left alone.

**Derived, never migrated** — the same reasoning as `xp2`. `achievements` is an
**array**, and `deepMergeObj` treats an array as a scalar, so a device still
serving an old bundle out of a Pages cache could push the un-cleaned array back
over a cleaned one. Answering at read time gives the same answer whatever has run,
however often, in any merge order, and writes nothing.
`aSeededAchievementIsNotAChoice` asserts both halves, and that reading twice
changes nothing.

## History is a record, not a working set

**The archive rule covered half the catalog.** `getAllActivities` applied its
`archived` filter to the custom and shared lists only — `DEFAULT_ACTIVITIES` and
`SEASONAL_ACTIVITIES` were spread raw, so the flag written onto a shipped
activity was read by nobody. It is applied to all four now, which is what lets a
built-in be retired; `findActivity` already passed `includeArchived`, so the
read-back half always worked. Same pick-vs-read-back split
`getTrainingTags`/`getTrainingTopic` uses for a sport the family has dropped.
`theCatalogResolvesEveryBlockItEverNamed` holds every retired id to three
answers: gone from the pickers, still resolvable, still able to say its name.

An activity is **archived, never deleted** (`archiveParentActivity`,
`js/11-parent.js`). Deleting used to sweep both kids' `weeks` with no date
filter, removing every block that had ever named it — from last March as readily
as from next Tuesday — and then rebuild `activityCounts` from what was left, so
retiring a piano teacher deleted two years of piano. Irreversible, no undo.

The rule now: the record stays and is **not tombstoned** (a tombstone is what
makes a delete stick across devices); only blocks from **today forward** are
removed; the counts are left alone. Same for `rejectKidActivity`, and for a
retired custom sport.

That splits one lookup into two, and the split is load-bearing:

| Question | Function |
|---|---|
| What can she **pick**? | `getAllActivities(p)` — archived entries absent |
| What does this placed block **name**? | `findActivity(actId, p)` — archived entries visible |

**An exercise a child types is a proposal, exactly as an activity is.** A new
drill goes into `state.shared.customTasks` with `addedBy` and `pendingApproval`,
is usable in the session she typed it for, and waits in Setup › Activities and
sports for a parent to keep or drop it. Rejecting **archives**; the record stays,
for the same reason `rejectKidActivity` archives.

Get it the wrong way round and either a retired activity is offered in a picker
(visible, harmless) or every block that ever used it stops rendering (invisible,
and the reason this rule exists). `retiringAnActivityKeepsItsHistory` in
`tests/smoke.js` holds both ends.

## "We met" and "the money moved" are different facts

`meetingsHeld[wk]` is written in exactly one place — `commitMeetingShared` — and
only once **both** kids have finished step 4. So a family that opened the
meeting, reviewed the week, celebrated it and agreed the numbers on step 3
recorded nothing at all, and the catch-up list called every one of the last eight
weeks "never settled" — saturating at its own ceiling, which is where the
reported "missing 8 weeks" came from after two real meetings.

The same press credits the money, so the wallet reading `$0.00` while the meeting
showed real figures was not a second bug: step 3 displays `ctWeekMoney`, a live
preliminary figure, and nothing reaches the wallet until step 4.

`meetingsMet[wk]` records the sitting down (`mmMarkWeekMet`, set on close from
step 3 or later, and retroactively from the hub's catch-up list). `meetingsHeld`
still means the money moved, and every existing reader of it is still asking that
question correctly. Only `status: 'none'` weeks are nagged about. Neither the
catch-up buttons nor `mmMarkWeekMet` moves money — "Settle" jumps to step 4,
which owns that.

The catch-up look-back stops at `max(mrModelStartWeek(), programStartDate)`. An
"earliest week with any data" floor was tried and removed: it suppressed
genuinely open weeks whenever the first record happened to be recent, which is
the same class of wrongness as the bug it was meant to help.

## The school calendar: shipped, then the family's

`SCHOOL_HOURS`, `SCHOOL_TERM` and `NO_SCHOOL_DAYS` in `js/01-config.js` are the
**fallback** — what a family that has set nothing gets, and what the app carries
in the public repo, which is **dates only**: no school name, no district, no
source document. That has not changed.

What has: a family can now say otherwise, and their answer lives in
`state.shared.schoolCal` (synced state, never committed). **Never read the
constants directly.** Three accessors in `js/05-helpers.js` decide which wins:

| Question | Function |
|---|---|
| When is school, and is there a lunch recess? | `schoolHours()` |
| When does the term run? | `schoolTerm()` |
| Which days are off? | `schoolOffDays()` — the shipped list plus the family's |
| How long does a block of this default to? | `activityDefaultDuration(act)` |

`activityDefaultDuration` exists for School Day alone: every path that PLACES a
school card already computed its length from `schoolHours()`, but the picker
read the shipped `durationMin: 420` and handed a seven-hour card to a family
whose day is 6h40. `zoneForGap` (`js/17-ui-misc.js`) reads `schoolHours()` too
now — it hardcoded 8:00/15:00/18:00, so it disagreed with `dayZoneSegments`, the
bands the day view actually draws.

**A season can be more than one season.** `season` took a single string and the
garden does not stop in June, so `inSeason(act, season)` is the one comparison
and `seasonLabel(act)` is what the three "🔒 Unlocks in …" toasts print — a bare
array would have read "spring,summer".

`isSchoolDay(dayKey)` / `schoolDayInfo(dayKey)` go through those, and are still
the only way to ask — never by checking the day of the week: a Tuesday in July
is not a school day, and neither is a PD day.

**Changing the hours reconciles the cards already placed.** `schoolHours()` drives
the bands and any NEW School Day card, so moving it used to leave every card
already on the calendar at the old time — the app disagreeing with itself, visible
only by opening each week. `paSaveSchoolHours` (`js/33-parent-app.js`) previews
first and offers three answers. `paSchoolCardPlan` decides and **reads only**, so
the preview is literally what `paSchoolCardPlan`'s companion will do. A completed
or confirmed card never moves, a past day is not touched, only `startMin` and
`durationMin` change, and a clash is reported rather than resolved. The sweep ends
in **one** `saveAll()` — `setDayBlocks` saves on every call, so reconciling
fourteen cards through it would upload the whole family document fourteen times.

`SCHOOL_TEMPLATE` is now **`schoolTemplate()`**, and the change is load-bearing:
a top-level `const` is evaluated when `js/01-config.js` runs, so it can only ever
see the shipped fallback. Anything that wants the school-day shape has to ask at
the moment it needs it.

**Every surface draws the day from `dayZoneSegments`** (`js/08-day-view.js`) — the
day view, the Full week and the print sheet. It had one caller for a long time
while the others carried their own copies: the Full week and print each hardcoded
school at 9am–3pm, an hour later than `SCHOOL_HOURS`, selected by
`dow === 0 || dow === 6`, so Christmas Day, every PD day and every day of July
drew a "🏫 School" band. The two vertical axes (the Full week's sideband, the
print sheet's) describe seven days with one column, so they describe the week's
**first school day** and say so plainly when a week has none.

**School days are offered, never assumed — but offered whenever they are
missing.** The band and the card are different things and neither replaces the
other: the pale `🏫 School` band is a **time-zone**, business hours, and what
makes the summer and winter breaks legible; the card is the plan. So the offer
asks whether the school **card** is missing, not whether the day is empty. It
used to ask the second, and only on a wholly blank week, so one breakfast on a
Monday disqualified that Monday from ever getting its school card.

`renderSchoolDayBanner` owns it, as its own banner,
inside `SCHOOL_FILL_HORIZON_WEEKS` (3). One School Day block each on one
confirm, not the whole template, and they arrive with **travel and get-ready on**
(see the buffer defaults below). Past that horizon there is no offer: a term is
40-odd weeks, and materialising all of it would write hundreds of blocks into a
document that uploads whole on every change.

**A TO-DO BELOW THE GRID IS A TO-DO NOBODY SEES, so it is drawn above it — and
in one place.** The banner was `#weekSchoolBanner`, at the bottom of
`.weekly-full-wrap` after about 691px of grid (960 minutes at 0.72px/min) plus
the colour key and the streak, which on a 390×844 phone is a screen and a half
under the fold. The blank-week coach tip carried a second copy and was the wrong
one to rely on — it needed the whole week blank, so it vanished the moment a
block landed, and the stale-calendar branch pre-empted it. `#tgSchoolBanner`
under the retired 🧱 Day Blocks tab was the other host, and losing it with the
tab is how the offer came to live only below the fold.

`#weekSchoolBannerTop`, a **sibling** of `#weekFull` directly under
`#weekCoachTip`, is now the only host. `#weekSchoolBanner` is gone from the
markup — not merely undrawn, because an id nothing reads fails
`tests/check-dead-ids.js`, and a host left in place is a host somebody reinstates
by reflex. `renderSchoolDayBanner` keeps its `bannerId` parameter, which costs
nothing and is how the host stayed swappable, and its default names the real
host so a bare call cannot become a silent no-op. Because the host is outside
`#weekFull`, `setWeekView` has to hide it explicitly on the read-only preview —
`renderSchoolDayBanner` is called only from `renderFullWeek`, so nothing else
would.

**One writer, two doors.** `commitSchoolDays(dayKeys, p)` (`js/07-week-view.js`)
is the only place a School Day card is written from this offer: the confirm
wording, the block shape, the single `saveAll()` and the toast. Both doors
resolve their days through `schoolDaysToOffer` first —
`addSchoolDaysToWeek(mondayKey)` for the week, `addSchoolDayToDay(dayKey)` for
one — so a chip that is stale because another device already added that card
becomes the "already has one" toast rather than a second School Day on the same
day. The banner draws a `.wsb-day` chip per offered day beside the count, and
the bulk `Add all N` only when there is more than one — with a single day left
the chip **is** the action. The smallest true answer has to be available: a week
whose Thursday is a PD day the family is away for must not have to refuse the
other four school days to say so.

**Importing** (`js/35-school-calendar.js`) reads a `.ics` file or URL. It is a
hand-written parser because there is no build step and the CSP allows no
third-party script. Three things about it are deliberate and should not be
"simplified": an all-day `DTEND` is **exclusive**; an RRULE past
`FREQ=WEEKLY`/`DAILY` with an end is **counted and skipped**, never half-applied;
and **every all-day entry is listed, not only the ones that match a keyword** —
"Christmas Day" contains none of the day-off words, so a list that gated
visibility hid the most obvious day off in a school calendar. Nothing is written
until it is ticked, and term dates arrive unticked because they are a year-long
guess.

**Replace the shipped dates each August.** Past `schoolTerm().nextStart` the app
stops claiming to know: bands fall back to weekday shape and
`schoolCalendarIsStale()` puts a note on the week — *to a parent only*. A child
is never told the app's data is out of date; she cannot act on it.

`schoolCalendarIsRight` counts the instructional days the **shipped** calendar
yields and asserts the published total (177 for K-8) — a mistyped date moves that
number, which is the point. `everyWeekViewFollowsTheSchoolCalendar`,
`schoolHoursAreTheParentsToSet`, `aBlankWeekOffersItsSchoolDays` and
`anIcsFileBecomesDaysOffOnlyAfterReview` hold the rest.
`theSchoolOfferIsAboveTheWeekGrid` measures the two rectangles at 390×844 on a
**part-planned** week — "above the grid" is a fact about geometry, not about DOM
order — and `oneSchoolDayCanBeAddedOnItsOwn` holds the chips, as a kid and as a
parent viewing that kid. Note what
`weekSideband`/`printSideband` used to be: an assertion that there were exactly
four segments, which counted to four on Christmas week as readily as on a term
Tuesday and is exactly why the 9am band stood for so long. They assert the axis
matches the day it claims to describe.

## One clock — the system did not begin today

**There is one date, `state.shared.chore.programStartDate`, it is DERIVED when
nobody has set it, and it is never written by being read.** `mrStartWeek()`
(`js/18-rules.js`) is the one owner.

Three stores used to answer three versions of this question —
`programStartDate`, `moneyModelStartWeek`, `routineRuleStartWeek` — and every
one of them **self-seeded to the current Monday** the first time anything read
it. On a device that first ran a given build in September, that made every week
before September a different kind of week:

- priced by the retired group-payout formula, so graded chores and the routine
  streak paid **nothing** in all of them;
- meeting step 3 swapped wholesale for the legacy confirm screen, so the
  competition form and the gift form were **not on the page**, with nothing to
  say why;
- `mmCatchUpFloor` was the later of two of them, so the catch-up list reached
  **one week** and the $3 default sweep found **none at all** and said so;
- and the routine streak asked for three routines on every day of every week,
  so Labour Day and both weekend days broke the run.

"Unset" was being read as "the system began today", which is the one thing it
cannot mean for a family that has been running for months.

**Deriving rather than seeding is the load-bearing half.** `mrDerivedStartWeek`
reads the earliest week with anything in it — the money ledger, finalised
weeks, group payouts, meetings held, each child's stream and each child's
placed blocks — and **writes nothing**. So it costs no sync, it cannot be frozen
wrong by whichever device happened to look first, and it moves back on its own
the moment an older week arrives from another device. A parent can still say the
family began earlier (Setup › Weeks on record), and that is the only way a
household whose real beginning predates anything on file can say so.

This exact derivation was tried once as the **catch-up floor** and removed,
because there it suppressed genuinely open weeks whenever the first record
happened to be recent. As a **default start** it errs the other way: against a
seed of "today" it can only ever reach further back.

**Merge decision:** `programStartDate` is arbitrated newest-stamp-wins against
`programStartDateAt` in `mergeSharedChore`, the same shape as `goalsByWeek`. An
**unstamped** value counts as 0 deliberately — it can only have come from a
build that seeded this, and a deliberate choice must always beat a seed. Without
it `deepMergeObj` lets a remote scalar win and a stale device pushes its own
idea straight back, putting the whole backlog out of reach again.

`moneyModelStartWeek` and `routineRuleStartWeek` are retired but **not deleted**:
a delete inside `state.shared.chore` cannot propagate (`deepMergeObj` iterates
the keys the remote has), so tidying them would churn the document on every sync
to no effect. Same reasoning as the retired `unlockedActs`.

## One money model, for every week

`mrUsesNewModel` is **gone**, and with it the legacy branch of `ctWeekMoney`,
the legacy step 3 and step 4, `buildHowIEarnCardLegacy` and its CSS,
`ctGroupEarned`, and the `newModel` skip in `commitKidWeek` that took the ledger
freeze, the XP credit, the arrears, the loan transfer and the Sunday Box with it.

The reasoning for having two models was right — history must not move when the
family switches to graded chores — but the **mechanism was never what made that
true**. Two other things do, and both are still here:

- a settled week is a **frozen ledger** and is never recomputed at all;
- a price edit lands as an **effective-dated rule version** (`mrVersionForDate`),
  so an old week still prices under the rules that were live when it was lived.

`moneySnapshots` still comes first in `ctWeekMoney`: weeks frozen at the
original migration are a record, not a calculation. `ctWeekIsPreSystem` is the
one owner of that question, and it is what now decides whether the chore tab
draws the retired board — the honest test, where `mrUsesNewModel` sent every
past week there and left a child with no chore rows and nothing to claim.

## The repair — weeks the retired branch mispriced

`evRepairPlan` / `evRunRepair` (`js/40-stream.js`), previewed on the parent's
Money page. Four rules, each load-bearing:

1. **Each week prices under ITS OWN rules.** `mrWeekBreakdown` resolves that
   week's effective-dated rule version, so a price edited last month cannot
   restate a week from March. Repairing is not re-pricing under today's
   rulebook, and that difference is the whole reason a parent can agree to it.
2. **It only ever ADDS.** A week the old branch happened to pay *more* for keeps
   what it paid. Money already in a child's hand is hers.
3. **A week frozen at the original migration is never touched.**
4. **Idempotent by a derived id**, because two devices will each run it and then
   sync.

The frozen ledger is corrected alongside the wallet and stamped `repricedAt`, or
the money story and `mrYearToDate` would keep quoting the figure the retired
branch produced while the wallet said something else — which is the
two-answers-to-one-question defect this file keeps recording.

**A defaulted week says so.** `defaulted` was written and read nowhere, so a
week credited at the flat default because nobody sat down read as "typed in" —
the same label as a week a parent entered from memory. They are different facts
and the history says which, alongside "re-priced".

**The $3 default is offered where the backlog is.** `mmUnsettledWeeks` stops at
eight, so anything older was invisible there AND unsettleable — the only door
was a card in Setup that a parent had no reason to open. The catch-up banner now
carries the older weeks and the sweep. Still a tap, still previewed, still moves
no money until `mnyRunDefaultSweep` confirms.

## A gift has a date, and a correction is not an edit

**`dayKey` is when it came; `weekKey` is which Sunday decides where it goes.**
Two questions, and a gift needs both answered separately.

`mnyAddDeposit` hardcoded `dayKey: todayKey()` and **no form anywhere offered a
date**, so a birthday recorded a fortnight later sat in the wrong month of her
history. Worse, the week came from whatever week the PLANNER happened to be
showing, and a gift landing in a committed week called `mnyReopenWeek` — which
returns `false` for exactly that case. The gift credited her cash and then
belonged to **no week's split at all**, silently.

`mnyGiftWeekFor` is the one owner: the week follows the day, and a settled week
hands the decision to the next still-open one, which both forms say out loud.
A caller that passes no `dayKey` still gets today's week, so nothing that
already worked changed.

**`mnyWeekOfDay` exists because two functions name different Mondays.**
`ctWeekKeyForDate` goes through `ctMondayOf`, which reads the device's raw
clock; `ctWeekKey` comes from `getWeekStart`, which goes through the app's
timezone. This file already records that those disagree for part of every day.
A gift filed under the raw-clock Monday while every money surface reads the
planner's would be invisible in its own week — so for today the planner's name
wins, and only an older day takes the date-walking path.

**The wallet and the stream move by the SAME amount, always.** The first attempt
at `mnyEditDeposit` reversed the original event in full and then moved the
wallet by the difference — two different figures, so the derived balance fell
behind the stored one by the whole gift, on every correction. A full reversal is
not what an edit *is*: $50 corrected to $30 is a twenty-dollar adjustment, not a
fifty-dollar undo followed by a thirty-dollar re-gift. The original row stays
exactly as written, which is what keeps the mistake readable; the correction
sits beside it saying what changed.

**A removal cannot be `evReverse` either, and the floor is why.**
`moneyTakeBackCash` floors at zero, so a gift already spent gives back only what
is there — while a reversal copies the original's amount. Removing a spent gift
through `evReverse` would debit the stream by more than the wallet could give
back, forever. It goes through `moneyTakeBackCash`, which mirrors what actually
left, and carries `reverses` **only when the whole gift came back**; when the
floor bit it is a partial correction and does not claim otherwise.

**`mrUpdateCompetition` keeps the id and re-scores.** There was no edit path at
all, so a wrong figure meant delete-and-re-add — which minted a new id, broke
the link to the block, and made the planned meet read as unrecorded again.
`awarded` is frozen at entry precisely so a later price change cannot restate
it, so an edit is a new entry of the same fact and must re-score; mutating
`points` in place would leave the record saying one thing and its money another.
Moving the date moves the block with it — a face left behind on the old Saturday
is a second meet nobody held.

## The Record sheet — one door, five records

`js/41-record.js`, with a static `recordOverlay` in `index.html` (chrome in
HTML, body filled by JS — the `familyMeetingOverlay` pattern), opened by
`openRecordSheet({ kind, kid, dayKey, id })` through `openSheet`/`closeSheet`,
which own focus and Escape. **Do not add a second dialog mechanism beside
them.**

**Five facts had five entry roads and none of them met.** A meet could only be
recorded inside the Sunday meeting or through `ctPromptCompetition`'s chain of
**eleven sequential prompts**; a gift went through `mnyPromptGift`'s four; a
fine was a numbered list typed into a prompt box; a chore grade was reachable
only from the chore tab, on the week and day that tab happened to be showing;
a move had no door at all until Stage 3 built one.

**A prompt chain is the worst shape a form can have.** You cannot see what you
have already answered, you cannot change an earlier answer, and abandoning it
halfway leaves nothing. Every one of these is four to six fields on one screen,
which is what this sheet is.

**It owns no rules.** Every row calls the function that already owned that
write — the same contract Today keeps, *call an owner, never contain one*:

| Record | Writes through |
|---|---|
| 🧹 a chore grade | `mrSetChoreGrade` |
| 🏆 a meet result | `mrAddCompetition` / `mrUpdateCompetition` |
| 🎁 a gift | `mnyAddDeposit` / `mnyEditDeposit` |
| 📦 a fine | `mrAddFine` |
| 🔀 a move | `mnyMoveMoney` / `mnyRequestMove` |

Each branch validates only what the **owner cannot** — that a name was left
empty on a form the owner never saw. Everything else, every gate included, is
the owner's.

**The draft is module-level, and that is load-bearing.** `rcRender` writes
`innerHTML`, so a re-render per keystroke would throw away the caret and every
other field. Answers live in `rcDraft` and the DOM is drawn FROM it — the same
shape `mmCaptureUiState` uses inside the meeting. **Typing never re-renders**;
only a change that alters what the form ASKS does: the day (which week's rules
apply, and which chores exist on it) and the two pots on a move (whether it is
refused).

**A child gets two of the five, and both as proposals** — a gift she was given
and a move between her own pots. `mnyAddDeposit` and `mnyRequestMove` already
carry the propose/approve gate, so the sheet adds no rule of its own; it just
does not offer her the three that are a grown-up's judgement about her week.
`rcSaveLabel` is what says so: the button reads *Ask a grown-up* rather than
*Save*, because a button that says less than it knows is how a child learns the
app is not telling her things.

**The tables are read, never restated.** `CP_GRADES` is the parent grader's own
four grades and `mrRulesForWeek(...).fines.items` is the week's own catalog —
two tables of grades is how the wording on two screens comes apart, and a fine
entered against an old day must be the amount that was live then.

**Retired by it:** `ctPromptCompetition` and `mnyPromptGift`, deleted rather
than left unreachable — a retired chain still callable is a second entry road
with different rules. `ctRemoveCompetition` stays: removing is not recording.
The meeting's inline competition and deposit **cards stay** too; they are where
the conversation happens on a Sunday, and they call the same writers.

**Correcting goes through the same door.** A parent taps a gift row or a meet
row to open the sheet on that record, carrying its id — so a typo is a
correction rather than the delete-and-retype that debited the wallet,
re-credited it, and left two rows nobody could explain.

Entry points: parent **Now** (a dashed ✍️ that routes, because Now counts and
routes and never decides), the parent **Money rules** head, **meeting step 3**,
the kid's **gift** and **competition** cards, and the wallet card's
`mnyMoveDoor` — one door whose label changes with the role, never two.

## Money can move between Sundays

**Until Stage 3 the only door out of cash was the Sunday split.** The two that
existed went one way — kept-ready back to cash, a company back to cash — and
both were buried on the parent's Money rules page. So a $50 birthday gift that
arrived on a Tuesday sat in cash until the following Sunday whatever anybody
wanted, which is the "nowhere to put it" this redesign started from.

**`mnyMoveMoney(kid, from, to, amount, opts)` is THE one writer** (`js/40-stream.js`),
and it owns no arithmetic: it routes to the primitives that already own each
movement — `moneyDeposit`, `moneyWithdraw`, `moneyOpenGIC`, `mnyBuyChosenFund`,
`moneySellStock`. Three of those took no `opts`, so a movement through them
could not be labelled; they take one now, with the structural fields still
applied **after** it per the Stage-1 rule — a caller may label a movement, never
redirect one.

**Pots do not touch; money goes through cash.** `ready → locked` and
`ready → invest` are a withdrawal and then a purchase, **two recorded
movements**, because that is what actually happens. One movement pretending the
pots are adjacent is a row the flow cannot explain. `invest → cash` converts
dollars to shares newest-holding-first, once, beside the only caller that needs
it — `moneySellStock` takes shares and everything else on this surface is
dollars.

**The stage gates are not optional.** Every destination is checked with
`mnyIsOpen` against `MNY_BUCKETS` — the same predicate `mnySplitFor` uses when
it sends a locked bucket's share to the debt instead. `evHomeNeed` maps a home
to its bucket rather than restating the percentages: two tables naming one gate
is how they come to disagree. A sheet that could put money in a pot Money
school has not opened would make the whole ladder decorative. And the gate must
block the **action**, not just grey the row — a `disabled` attribute is a hint
to the pointer, not a rule.

**A refusal is a SENTENCE, not a false.** `mnyMoveRefusal` returns the words or
`null`, so a row can be greyed *and say why beside it*. Locked money is the one
refusal that is a lesson rather than a limit: it comes back on its own date
(`mnySimCatchUp`), and letting it out early teaches the opposite of what locking
it away is for.

**A child proposes; a grown-up approves.** A proposal is **not a movement**, so
it must never be a stream event — the stream records money that moved, and a
request on it would make every derived balance wrong until somebody said no.
Requests are `profile.moveRequests`, `mergeArrayById(..., 'mvq:')` in
`mergeProfileState`, with their own two-device check.

- **`mnyRequestMove` refuses for the same reasons a parent's move would**, in
  the same sentence, so a child is never told to ask about something a grown-up
  could not do either.
- **The move runs at APPROVAL, never pre-authorised at the ask.** What she had
  on Tuesday is not what she has on Sunday, so `mnyApproveMove` re-checks every
  refusal against the wallet as it is now, and stamps `approvedAt` only once the
  money actually moved. Approving twice moves nothing — two devices will each
  see the row.
- **A rejection is kept, not deleted.** "We talked about it and decided not to"
  is a real answer, and a child should see her request was answered rather than
  find it simply gone.

`moneyCanTransact` is called by two functions and **none of the primitives check
`isParent()` themselves**, so `mnyMoveMoney` carries that gate explicitly.

## The Flow — the screen the stream was stored for

`js/42-flow.js`, at the head of `screen-moneystory`. Stage 1 stored movements
instead of balances **for this screen**, and until Stage 4 nothing read them:
`evFlow`, `evMonths` and `evTypicalMonth` were unit-tested and had no caller.
A calculation with no reader is a calculation nobody finds out is wrong.

**It does not lead with a total, and that is the whole design.** The owner's
instruction, in their words: *I do not want the kids to see the end money, they
need to understand the cash flow — they earn, they spend, they save, they have
left.* A child watching a total learns to watch a total: it goes up, which is
good, and down, which is bad, and she learns nothing about why either happened.
So `flStory` says what came in, what went out, what was put away and what is
left, **in that order, in one sentence, before any bar is drawn** — the
movement is the headline and the balance is its consequence.
`theFlowSaysWhereItWent` asserts the ORDER, not merely that both appear: a
screen whose first figure is a balance has quietly become the thing it
replaced, and nothing else in the suite would notice.

`mnyWalletCard` still leads with *Everything I have*, unchanged and correct.
That is the page where she checks a figure before deciding something; this is
the page where she finds out how it got there. Two questions, two screens.

**It owns no arithmetic.** Every number comes from the pure functions in
`js/40-stream.js`. This file arranges and labels; it never sums a movement
itself. A second place deciding what "came in" means is a second place that can
disagree with the first.

**"Left" is a balance, never in-minus-out.** She may have had money before the
span started, and putting $30 into kept-ready is not money gone. The screen
says so out loud rather than leaving a child to do arithmetic that does not
come out.

**Each group scales to its own biggest ribbon, not to a grand total.** One
scale across "in" and "out" draws a $2 fine as an invisible sliver beside $40
of jobs — the one row she most needs to see. The two group totals are what
compare the halves.

**Three periods, and the third is the honest one.** *This month* · *All of it* ·
*A typical month*, which `evTypicalMonth` divides by the months that have
**elapsed**, empty ones included. Dividing by months holding events turns a
quiet summer into a good one — the same mistake `mrYearToDate` makes with
settled weeks, deliberately not repeated.

**The history strip keeps its empty months.** One 44px column per calendar
month, oldest left, stacked by where that month's money came from, scrolling
sideways rather than wrapping — a wrapped timeline stops being a timeline. An
empty month is drawn as a dashed empty frame: a gap is a fact, and a month
dropped from a chart reads as a month that did not happen. Tapping a column
selects **both** the month and the period, because selecting a month while the
screen still reads "all of it" is a control that appears to do nothing.

**The Flow leads and the settled weeks follow.** The week list reads the frozen
`moneyLedger`, so it can only show weeks a meeting settled — a gift on a
Tuesday, a spend, a move between pots are all invisible to it. Leading with the
narrower answer is how a child comes to believe the money she was given is not
part of her money story. Both stay: the ledger rows are the week-by-week record
a parent checks a meeting against, and the Flow cannot replace a record of what
each settlement paid.

`screen-moneystory` joined `KID_SCREENS` in the same change. It is a kid screen
and was never in that audit, which is how the strip's 26px columns could have
shipped with no 44px floor enforced on them — the row seeds two events first,
because an empty story draws no strip and no ribbons and would pass the audit
by having nothing on it.

## The money stream — a flow, not a balance

`js/40-stream.js`. **Money is stored as MOVEMENTS and every balance is derived
from them.** This is Stage 1 of the money redesign and the thing the rest of it
rests on.

What it replaces: `wallet.cash` was one number written by **eight** separate
functions — `js/14-money.js`'s six, the loan's four paths, the maturity payout,
the meeting's commit — and not one of them recorded *why*. So "where did the $50
go" had no answer anywhere in the app, and a stored total that eight writers have
to keep right is a total that goes wrong. It is also the wrong lesson: a child
watching a total learns to watch a total.

Every event moves an amount **from** somewhere **to** somewhere:

| | |
|---|---|
| **sources** (outside → in) | `earned` · `gift` · `prize` · `borrowed` · `interest` · `typed` · `opening` |
| **homes** (inside) | `cash` · `ready` · `locked` · `invest` |
| **sinks** (in → outside) | `spent` · `fine` · `loan:<debtId>` · `returned` |

A home's balance is what arrived minus what left. That is the whole engine, and
it is why `tests/stream.test.js` can state the invariant at all — *opening + Σin
− Σout === what is in hand* — over a thousand randomly generated histories, on
two devices, in any arrival order. A balance system cannot say that about
itself.

**A caller may LABEL a movement; it may never REDIRECT one.** Every writer
applies the fields it owns — which pot the money left, which it arrived in, how
much — **after** the caller's `opts`, so they always win. Spread the other way
round and `mnyRemoveDeposit` passing the gift's own mirror fields turned a debit
from her cash into `gift → returned`, and then into `cash → cash`: the wallet
dropped $50 and the stream did not, silently, forever. Both were caught by
`theMoneyStreamAgreesWithTheWallet` on its first two runs, which is exactly what
that check is for.

**A marker is a ZERO-AMOUNT event, not a kind of event.** `settle` names both
the dollars a week paid and the fact that it was settled, so deciding markerhood
by `kind` nulled the from/to on every settlement and credited nothing. The
amount decides; `EV_MARKER_KINDS` only says which zero-amount rows are
legitimate. A week settled at $0 still has to be answerable as settled, which is
the reason markers exist.

**A movement says both ends, always.** `mnyGiftMirror` named no destination and
the migration's own arithmetic read that as "went nowhere", which put every gift
on the stream twice over.

**Shadow mode, and what licenses retiring the old stores.** Nothing on any
screen reads the stream yet. `evMirror` is called beside every existing writer,
`wallet.cash` is still what the app displays, and `evShadowDrift(kid)` returns
the **findings** — never a bare boolean — for every pot where the two disagree.
`theMoneyStreamAgreesWithTheWallet` drives the real writers (a settlement, a
gift, money aside and back, a lock, a company bought and revalued, a gift taken
back) and checks drift after *every* step, including before anything has
happened: a base case that agrees is what would otherwise hide a sign error in
every case after it. The old stores are retired in Stage 2, only after that
drift has been zero on real household data.

**The migration reconstructs history, then plugs the gap.** `evMigrationPlan`
reads the frozen `moneyLedger` and the applied `deposits`, dates each row to the
day it happened, and *then* computes the opening balance per home as
`stored − everything reconstructed`. That order is the trick: the derived
balance equals the stored balance **by construction**, on any household however
incomplete its history, rather than by hoping the reconstruction is exhaustive.
Whatever the old stores cannot account for lands in one honest line a child can
read — *What she already had* — instead of as a drift nobody can see. A negative
gap is written as money leaving, the same way a holding losing value is.

It is **read-only and idempotent**: `evMigrationPlan` writes nothing, so the
preview a parent approves is literally what runs, and every row carries a
derived id (`evMigId`) so a second run — or two devices that then sync — produces
one copy of each. It re-prices **nothing**; the weeks the legacy branch
mispriced are repaired in Stage 2, under each week's own rules, with their own
preview.

**Merge decision:** `profile.events` is `mergeArrayById(..., 'ev:')` in
`mergeProfileState` — a union by id with its own tombstone scope. Append-only by
contract, so newest-wins per id never has to arbitrate anything real: a
correction is a **reversing event** (`evReverse`), never an edit. Without the
tombstone a correction would undo itself on the next sync, which is money
appearing from nowhere.

**Pure core, app wrapper.** `evBalanceOf`, `evFlowOf`, `evSpanOf`, `evMonthsOf`,
`evTypicalMonthOf` take an array and return numbers, with a `module.exports`
guard; the `kid`-taking wrappers just fetch the array. Same split and same
reason as `bufferClip` — a calculation reachable only from a browser is one no
unit test can hold, and the money layer has been burned by exactly that twice.

**A typical month divides by the months that PASSED**, not by the months that
happen to hold events — the same mistake `mrYearToDate` makes with settled
weeks, deliberately not repeated: a quiet summer must not read as a good one.

## Money: a start date, a default, and gifts

**The system has a beginning, and it is the family's.** `moneyModelStartWeek`
and `programStartDate` both self-seed to the current Monday on first read, which
is why a household running for months has no floor and the catch-up list
saturates at its own ceiling. Both are set together from Setup › Weeks on
record, as a parent-visible date rather than a constant — hardcoding one would
ship a household's date in a public repo.

**Weeks older than the catch-up reach get a flat default.** `mmUnsettledWeeks`
looks back eight weeks and stops, so anything older is invisible AND
unsettleable. `mnyRunDefaultSweep` credits `MNY_DEFAULT_WEEK` per child for each
un-met week beyond that reach, and three things make it safe: it is idempotent
through the **same** `finalizedWeeks[wk][kid] == null` guard `commitKidWeek`
uses, so two devices in any merge order credit once; it previews every week and
the total before moving anything; and the ledger row is marked `defaulted` so
the money story can say "no meeting was held" rather than presenting the figure
as a week's earnings. Weeks the catch-up list can still reach are left alone —
those hold real data and belong on their own numbers.

**Gifts are `profile.deposits`, which already existed.** A new store would
duplicate it and fight the one-pool rule: which door a dollar came in through
has no bearing on which door it leaves by. What changed:

- a **giver** field beside the category chip, because `from` names a kind of
  money and never a person, and a red pocket is from somebody;
- **Sports scholarship** and **Academic scholarship** as categories, kept apart
  from the competition channel so a grandparent's cheque never reads as prize
  money the rules produced;
- recorded **any time and credited at once**, and **dated** — see *A gift has
  a date* above. It was dated today into whatever week the planner was showing,
  which is the defect that section exists to record;
- a **parent gate**, which `mnyAddDeposit` never had. That was safe only while
  it lived behind the meeting; on a kid-visible page that credits immediately
  its absence would let a child hand herself any sum. A child now PROPOSES one
  (`pendingApproval` + `addedBy`, the same idiom a kid-created activity and a
  custom task use) and it credits nothing until approved. The commit loop skips
  a pending deposit and `mnyDepositTotal` leaves it out of the pool, or the gate
  would work on one screen and not the other. Removing an applied gift debits
  the wallet back through `moneyTakeBackCash`, floored at zero so a correction
  can never invent a debt.

**`tools/money-calibrate.js` is the twin of `tools/xp-calibrate.js`.** XP got a
calibration and money never did, so a rules change could be argued about but not
measured. It requires `MR_DEFAULT_RULES` through the module guard rather than
restating a price, and mirrors the four places money is actually decided: the
first two chores are free and are the CHEAPEST, the daily cap bites per day, the
streak pays the longest run at the highest tier only, and a fine is floored at
what that day earned. `tests/money.test.js` locks the result, so changing a rate
and not re-running shows up as a failing test rather than at a Sunday meeting.

It also settles a number that is easy to get wrong: **routines are worth at most
$3 per child per week.** They pay nothing directly, and the $1 weekly goal bonus
is on the LEGACY branch of `ctWeekMoney` and is never added in the current
model. The streak is the whole routine channel.

## The four house rules — 2026-09-21

Four rules the family agreed, each landed in `MR_DEFAULT_RULES` and read
through `mrRulesForWeek`, so **a week already lived keeps the rules that were
live when it was lived**. Nothing is retroactive; that is the owner's own
constraint and it is what effective-dated rule versions are for.

**1 · Homework earns XP, not dollars.** All four `learning` items are `xpOnly`
now. Homework is her own work, not a job the household is paying to have done —
the whole reason this app prices chores is that a chore is a share of running a
home somebody would otherwise have to do. Paying for homework teaches that
learning is something you do for money. The work still **counts**:
`mrWeekBreakdown` credits XP on an `xpOnly` line, the Sunday check still
applies, the hours charts are unchanged. Only the dollars stop.

**2 · Twice is a conversation; the third time costs.** `freeRepeats: 2` on
tone, borrowing, screens and being asked twice. Every occurrence is **recorded**
— `mrAddFine` writes it the day it happened, unchanged — and the first two in a
week take no money. The **third and every one after it** costs its amount.
`reflEvidence` offers the forgiven ones in her reflection's **Needs work** tab,
named individually rather than counted ("3 things this week" reads as a score
and says nothing she can act on), and it offers the incident and never an
answer, which is the rule the whole reflection is built on.

Not a pure conversation, and not a flat fine either. A first slip is something
to talk about: charging a child a dollar for how she spoke to her sister prices
the relationship, and buys the wrong lesson twice over — she can afford to be
unkind after a good week, and a bad week compounds. But a pattern is a
different fact from a slip, and a rule with no consequence at all is one a
nine-year-old correctly reads as no rule.

**Per item, per week.** Three *different* slips is three conversations; it is
one behaviour repeating that this is about. The count is per WEEK, so two on one
Tuesday are still the week's first two — a bad Tuesday is not three Tuesdays.

**The free repeats cannot be decided a day at a time.** Monday's is free because
it is the first and Friday's is charged because it is the third, so
`mrFinesWeek` makes one pass over the whole week sorted by day then `at`, marks
which occurrences are chargeable, and only then applies the daily floor.

**`mrFineStanding` is the one owner of the count**, asked by the reflection so
it can say what happens next — a rule a child finds out about by being charged
is a rule she was never given a chance to keep. Two counts of the same thing is
how two screens come to disagree.

**`box_repeat` keeps its dollar from the first.** It is not about character: a
thing was left out, it was boxed, and it was left out again in the same week.
It **is** the repeat, so free repeats on top would count the same forgiveness
twice.

**The calibration asserts the threshold directly.** None of the three modelled
weeks holds three of the same behaviour — which is the point of the rule and
also means the week models cannot exercise it, and a rule the calibration never
reaches is a rule it is not calibrating.

**3 · One grace day a week.** `streak.graceDays: 1`. An off day is a valid
state, and a streak with no rest state is the all-or-nothing shape *Writing for
children* forbids. The grace carries the run **across** a miss without crediting
the day — so six kept days with one miss reads 6, not 7, and a clean week still
means seven. A second miss ends the run. Read from the rules and defaulted to 0,
so an older rule version prices its week exactly as it did.

**4 · The pace divides by the weeks that PASSED.** `mrYearToDate` divided by
the number of weeks with a **finalised record**, which is the defect behind "she
was paid $1 this month and it says she is on track": a family that settles its
good weeks and lets the quiet ones slide reads as though every week were good,
because the quiet ones are not in the denominator at all. It was arithmetic on a
self-selected sample. `mrWeeksElapsed()` is the one owner, counting from
`mrStartWeek()` — derived, not seeded — and an unsettled week now counts as a
week that paid nothing, which is what it is. This file recorded it as a known
defect before it was fixed.

### The gap this opened, and whose it is

Homework was carrying about **half the economy**. With it gone and the chore
rates left where they were — the owner's decision, asked and answered — an
ordinary week goes **$21 → $11**, a quiet week **$3 → $0**, and a realistic term
reaches **51%** of Jenn's $1000 target instead of ~100%.

`tests/money.test.js` asserts that 51% rather than the old 85–115% band. The
assertion was **not deleted and not widened to whatever passes today** — either
would turn the one check measuring the economy against the family's own stated
aim into decoration. It asserts the real figure, so the guard still fires on
unintended drift, and it says out loud that the target is now an aim rather than
a description.

**That gap is the family's to close, not the code's:** raise the chore rates
(`tools/money-calibrate.js` says exactly where they land — $6/$4/$2 with a $9
cap and one free chore reaches 111%), or lower the targets to what the rates
pay.

**Read that 51% correctly.** It is the projection from a modelled TERM — five
ordinary weeks, two quiet, one strong — not from a ceiling. The rates are not
incapable of reaching the target: the daily cap allows **$21 a week from chores
alone** ($15 after the two free), the streak adds $3, and competition points are
**uncapped** with a $20 qualifying bonus. The `strong` fixture is $24 because it
models one chore a day and a six-point meet that did not qualify, so the cap
never bites. What 51% says is that the term SHAPE does not reach the target,
which is a different and much smaller claim than "she cannot earn it".

**The $3 default is backfill, never a floor.** `mnyDefaultSweepPlan` starts one
week beyond the catch-up reach and walks BACKWARDS, so it can never touch the
current week or the last eight: it credits weeks that had already gone by, not
weeks being lived. Going forward a quiet week pays what she earned, which may
be nothing, and that is the earn-and-spend system working.
`theDefaultSweepCreditsOldWeeksOnce` asserts it cannot reach the current week or
a future one, because that failure would be silent and generous — money
appearing for a week she is still living.

## Known trip hazards

- Firebase config lives in **`js/03-sync.js:8`**, not `index.html`. Older docs
  (`README.md`, `SECURITY_TODO.md`) still say `index.html` — they're stale.
- `MULTI_ROLE_REVIEW.md` cites `index.html` line numbers from the pre-split
  monolith. Those line numbers are meaningless now; treat that file as history.
- Every mutation currently triggers a full-document Firestore write with no
  debounce. Be aware before adding anything that mutates in a loop.
- `refreshCurrentScreen()` fires on every remote snapshot, including the echo of
  the device's own write. Don't assume a render happens once.
- GitHub Pages caches aggressively. After a deploy that changes `js/*.js`,
  hard-refresh or bump a `?v=` query on the script tags. `sw.js` is the other
  cache: it is **network-first** so being online always gets the deployed code,
  and the shell it holds only answers offline — but **bump `SW_VERSION` on every
  deploy that changes a shell file**, or an installed device keeps the old
  offline copy. There is no build step to do it for you.

  `tests/check-sw-shell.js` (in `npm run check`) is what makes that enforceable.
  `index.html`'s script tags and `sw.js`'s `SHELL` are two hand-written lists
  that have to agree and nothing made them — the same shape as the
  `package.json`/`ci.yml` split. **A script in one and not the other is
  invisible until the device is offline**, because the worker is network-first:
  online it is fetched and nothing looks wrong. Not hypothetical —
  `js/40-stream.js` shipped that way, and offline every `ev*` function was
  undefined, so `moneyAddCash` and with it every gift, settlement and loan
  payment threw on the first tap. The guard also fails the build when a branch
  changes a shell file and never touches `sw.js`, reading the working tree as
  well as the committed diff so the warning arrives before the commit rather
  than after it.

  **`BUILD` (`js/01-config.js`) is the page's copy of `SW_VERSION`, and it is
  how you tell which build a device is running.** `SW_VERSION` lives only inside
  the worker and was never shown anywhere, so an installed iPad could not say
  which build it had — and "deployed" cannot be claimed without reading a stamp
  on the page. `BUILD` is printed as `Build <value>` under the tiles of the Today
  **More** sheet (bottom nav → More) and under the list on the parent portal's
  **App** landing (Parent → PIN → ⚙️ App). `js/01-config.js` is itself a cached
  shell file, so the number on screen is what THAT device loaded, offline copy
  included — no `postMessage` round-trip to the worker is needed to know it.
  `tests/check-sw-shell.js` fails the build when `BUILD !== SW_VERSION`, so it
  is one number with a check rather than two that drift: **bump both
  together.** `theBuildNumberIsOnThePage` in `tests/smoke.js` holds both
  surfaces.
- Toggles (`.buffer-toggle`, `.repeat-toggle`) and the 19 overlays carry their
  ARIA **statically** in `index.html`; `enhanceNonButtonClickables`
  (`js/99-main.js`) only keeps `aria-checked` in step with `.on`. Focus and
  Escape for sheets live in `openSheet`/`closeSheet` (`js/17-ui-misc.js`) — do
  not add a second dialog mechanism beside them.
