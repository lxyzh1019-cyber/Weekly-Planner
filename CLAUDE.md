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

# 2. Merge-layer unit tests (62 checks, must be 62/62)
npm run test:merge

# 3. The calibrated XP values (see tools/xp-calibrate.js)
npm run test:xp

# 4. Headless smoke test — boots the app, drives the main flows
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

**The week has two tabs, and only one of them is a week you can plan.** Full is
what the screen opens on: the cards, the quick-complete `.wf-card-check` ticks,
the planning controls and the three banners — including the offer to add missing
School Day cards, which is a mutation and so can only live there. The second tab
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
the document.

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
| Did a parent review this child's day? | `isDayReviewed(kid, dayKey)` |
| What does the family's share of the chores stand at? | `getFamilyChoreStatus(kid, weekKey)` |
| How did the week's hours go? | `getWeeklyHours(kid, weekKey)` |
| Did her money move as she decided? | `isChildMoneyCommitted(kid, weekKey)` |
| Is the week closed? | `isWeekClosed(weekKey)` |
| Can this day be reviewed yet? | `canReviewDay(kid, dayKey)` |

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

**Confirming is not completing, and neither is reviewing.** A parent may confirm
an unfinished routine and it must not start reading as finished. `confirmAllBlocksForChild`
marks blocks *completed and confirmed* for **one named child** — only blocks that
have already started, so a nine o'clock press cannot mark the evening's swim
done — and never touches `parentDayConfirm`. `markDayReviewedForChild` is the
other fact and changes no completion. Reviewing a day is **per child**: the
meeting's day rows carry a control each plus an explicit Both.

**A scheduled chore is not a fulfilled one.** `required` / `planned` /
`fulfilled` / `waiting` are four numbers, and only a positive parent grade is
fulfilled. The kid surfaces measure `stillNeedsADay` and stay forward-voiced and
current-week; the **review voice** (owed / fulfilled / unfulfilled) lives on the
parent and meeting screens, where a past week's shortfall is always shown. No
shortfall is carried into the next week.

## Six activity groups — what the time is FOR

`ACTIVITY_GROUPS` and `activityGroup(act)` in `js/01-config.js`. **Routine ·
Brain Construction · Body Construction · Chores · Daily · Free**, each with a
`short` form because the week grid compresses a label to about seven characters.

`cat` still decides a block's **colour** (`CAT_HEX`, `blockColour`) and drives
the picker's filters. This answers a different question, and it is the only one
the hours charts and the XP gate may ask. Two questions, two tables.

There were **six** copies of a label table before this, already disagreeing:
`cat:'daily'` held breakfast, lunch, dinner, the house chore, four Family Hero
tasks and two health tasks, and rendered as "🧹 Chores" on two screens and "🍽
Daily" on three. Family Hero **is** a chore — whoever did the chore is the hero —
so those carry an explicit `group:'chores'`. That is also why they are **not
rewards**: the four `REWARD_POOLS.family` activities used to carry
`rewardLocked: true`, so the thing a child had to earn was the right to help at
home. They are ordinary available activities now, ids unchanged so every
historical block still resolves; the other three pools are still earned. The
first-run tutorial went with the lock, because its entire content was picking one
of those chores as an unlocked "starter". An activity nothing can resolve is
filed under Daily, never dropped: an hours total that silently omits blocks is
worse than one that files them vaguely.

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

## The meeting

**A return context, reused unchanged by Meeting V2.** `mmReturn` records
`{ source, weekKey, step, child, selectedDay, scrollTop }` before the overlay
closes. Both parent banners share `parentBannerBackButton()`, which reads "Back
to weekly meeting" while one is waiting and "◀ Hub" otherwise. `applyMeetingLock`
**hides the Hub link and both child switchers** while a sitting is open: three
controls that each silently abandoned the meeting is worse than one that says
where it goes.

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
  agreement and changes no completion, grade, XP or money.
- **skipping is explicit and reversible**, and never blocks the settlement.

**The action is saved either way; putting it in a plan is a separate act.** She
picks it and it is in the record immediately. Carrying it forward is offered, not
automatic, and never happens without a confirmation naming the child, the week
and what will appear. `reflTargetWeek` decides where it lands, and **not** by
taking the week after the one on screen: a current week plans into next week, and
anything older plans into the week we are actually in — a sitting held six weeks
late must not write into a week that has already happened, which is the defect
that retired `mmPlanNextWeek`. Attaching to a routine she already has writes no
to-do at all, because a duplicate helps nobody.

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

`renderSchoolDayBanner` owns it, as its own banner beside the family-chores one,
inside `SCHOOL_FILL_HORIZON_WEEKS` (3). One School Day block each on one
confirm, not the whole template, and they arrive with **travel and get-ready on**
(see the buffer defaults below). Past that horizon there is no offer: a term is
40-odd weeks, and materialising all of it would write hundreds of blocks into a
document that uploads whole on every change.

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
`anIcsFileBecomesDaysOffOnlyAfterReview` hold the rest. Note what
`weekSideband`/`printSideband` used to be: an assertion that there were exactly
four segments, which counted to four on Christmas week as readily as on a term
Tuesday and is exactly why the 9am band stood for so long. They assert the axis
matches the day it claims to describe.

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
