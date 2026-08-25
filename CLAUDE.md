# CLAUDE.md — Weekly-Planner

Operating rules for any agent session on this repo. Read this first, every session.

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

Current permitted exceptions (do not add more): `js/03-sync.js:506`
(`window._skipRewardPrompt = false`), `js/08-day-view.js:1351-1352` (two
`window.addEventListener` calls that only register), `js/17-ui-misc.js:159`
(the self-contained `installActionDoubleTapGuard` IIFE), and the
`module.exports` guards at the end of `04-merge.js`, `18-rules.js`,
`21-money-data.js`.

**One declaration per name, globally.** All 30 files share one scope, so a
duplicate `function foo()` in two files means the later one silently wins. A
`let`/`const` declared twice is a hard `SyntaxError` at load. Before adding a
top-level name, grep for it across `js/`.

## Verification — run all three before any push

```bash
npm ci      # once
npm test    # runs all three below, stops at the first failure
```

Or individually:

```bash
# 1. Syntax check every module + the duplicate-name guard
npm run check

# 2. Merge-layer unit tests (62 checks, must be 62/62)
npm run test:merge

# 3. Headless smoke test — boots the app, drives the main flows
npm run test:smoke          # screenshots land in tests/out/
```

`npm run check` runs `tests/check-syntax.js`, `tests/check-globals.js`,
`tests/check-escaping.js` and `tests/check-dead-css.js`. **Do
not go back to the old shell loop** —

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

`tests/check-globals.js` enforces the one-declaration-per-name rule above,
covering `function`, `async function` and top-level `let`/`const`/`var`
(including the comma-separated form) — a duplicate `let` is a load-time
`SyntaxError` that per-file `node --check` cannot see.

`smoke.js` auto-detects Chromium under `/opt/pw-browsers` or
`~/.cache/ms-playwright` (`npx playwright install chromium`); elsewhere set
`SMOKE_CHROMIUM=/path/to/chrome`.

CI (`.github/workflows/ci.yml`) runs all three on every pull request and pushes
to `main`, plus nightly, and uploads the smoke screenshots as an artifact.

New features ship with a new check in `smoke.js`. The chore→money hand-off
checks are the most valuable ones in there — when that join broke, every screen
still rendered and only the numbers were wrong.

## The merge layer is load-bearing — treat it as frozen

`js/04-merge.js` implements conflict-aware sync: id-keyed unions, deletion
tombstones (30-day pruning), deep object merge, per-week chore arbitration, and
a forward-only `lastGradeSeen` watermark. It has 62 unit tests running the real
shipped functions.

Do not refactor it for style. Change it only to fix a demonstrated sync bug, and
only with a failing test written first. Writing the test first also tells you
when *not* to change it: `meetingsMet` was added expecting a merge change, and
`deepMergeObj`'s union was already right for it — five tests went in, `04-merge.js`
did not move.

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
- **Budget: aim for ≤200 visible words per kid screen.** Anything longer is
  reference material and belongs behind a disclosure toggle.

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
- **≤200 visible words per kid screen** in its default state. Reference material
  is not banned, it starts collapsed — `mnyPricesOpen`, `ckPrivsOpen` and
  `weekGlanceOpen` are the pattern: closed by default, remembered in
  `localStorage` (never synced state — every state write is a full-document
  upload). `screen-chore` is on a **ratchet** (276) rather than the 200 target: it
  must not grow, tighten it whenever the real number drops, and the target stays
  written down.

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
followed either would point at a different block on the two screens. The week
grid is deliberately excluded: `wfShortLabel` compresses to seven characters on
purpose and "Block 2" cannot live there.

Drawn to scale means the row has to **add up to a day**. It is one nowrap flex row
of percentages with nothing able to shrink, so anything that oversubscribes it
pushes the last cell straight through the edge of its column. Two things do:
overlapping blocks — which is exactly the clash this screen draws in red, where a
block's get-ready starts inside the block before it — and `MIN_CELL`, since a floor
applied often enough overruns the row on its own. `tdProgressRibbon` clamps each
cell to the cursor so no minute is spent twice, then scales the segments back if
they still come to more than 100. It shipped without either guard and every check
passed: no fixture had two blocks that overlap. A screenshot found it.

**The day screen scrolls as one surface.** It was three nested scrollers
(`.day-workspace` → `.day-center-lane` → `.timeline-wrap`), which on an iPad
meant a flick could move the wrong one. `.day-workspace` is the only scroller;
`dayScreenScrollsAsOneSurface` in `tests/smoke.js` keeps it that way.

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

Today **owns no data and no rules — but it does invoke them.** Every number it
shows is read through the accessors the owning screen uses, and every write goes
through the function that already owned that write: `completeQuest` for a tick
(XP and sticker counting come with it), `addQuickBreak` for a break, `setDayMood`
for a mood. **Call an owner; never contain one.** A second place that *decides*
how a chore is graded or how money moves is a second place that can disagree with
the first, and a child has no way to tell which one is lying — so grading and
settling still belong to the chore and money screens, and nothing on Today moves
money.

Today measures **97 words** against the 200 on the audit's seeded day — one
running block, a break, a get-ready column, a clash and a free stretch, with both
folds open. It has read as high as 129 on the same fixture: the figure moves with
whatever the jobs and money cards happen to hold when the sweep reaches them, so
re-measure rather than trusting the number written here. Today
is also held to the **200-word budget with no ratchet**, which is why the
vibe, to-do, goals, sticker and note panels ship collapsed behind one
`localStorage` flag (`tdExtrasOpen`), and why finished blocks fold away behind
`tdExtrasOpen`'s sibling `tdEarlierOpen`. Reference material starts closed. The
budget bites: an explanation on 💰 My money went in at 21 words over and had to
come down to three.

**Today leads with what is next.** The list splits at `tdNowMin()` — upcoming in
time order, then everything finished under a closed "earlier today" fold. In
`QUIET_HOURS` (9pm–7am, `js/01-config.js`) with nothing running, the NOW card
reads as wind-down rather than "the rest of today is yours".

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

## Naming

New user-created Claude skills for this ecosystem use the `HZ-` prefix
(e.g. `HZ-web-app-audit`). Repo files, CSS classes and JS functions keep the
existing conventions: `ct*` for chore-tracker functions, `mny*` for money,
`tg2-*` for the current Day Blocks grid.

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

**Copying a week is a plan, and it shows its work first.** Setup › Copy a week
(`js/34-parent-copyweek.js`) is the third place a week gets copied, and it owns
no clone rule: `weekCloneBlock` (`js/07-week-view.js`) still decides what a copy
arrives as — not done, not confirmed, no XP, no ticked checklist. The other two
are not general enough to replace it and are deliberately left alone:
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

## History is a record, not a working set

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

## The school calendar expires every August

`SCHOOL_HOURS`, `SCHOOL_TERM` and `NO_SCHOOL_DAYS` in `js/01-config.js` are the
one source of truth for "is there school today, and when". Both consumers derive
from them — `SCHOOL_TEMPLATE` and the day timeline's coloured bands — because
when they were hardcoded separately they disagreed by an hour and nobody noticed.

Read it through `isSchoolDay(dayKey)` / `schoolDayInfo(dayKey)`
(`js/05-helpers.js`), never by checking the day of the week: a Tuesday in July is
not a school day, and neither is a PD day.

**Replace all three each August.** Past `SCHOOL_TERM.nextStart` the app stops
claiming to know: bands fall back to weekday shape and `schoolCalendarIsStale()`
puts a note on the week — *to a parent only*. A child is never told the app's
data is out of date; she cannot act on it.

`schoolCalendarIsRight` in `tests/smoke.js` counts the instructional days the
calendar yields and asserts the published total (177 for K-8). A mistyped date
moves that number, which is the point — it is the only check here that can catch
a plausible-looking wrong date.

This is deliberately shipped code, not synced state: it is identical on every
device, and the repo is public, so it carries **dates only** — no school name, no
district, no source document.

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
  hard-refresh or bump a `?v=` query on the script tags.
