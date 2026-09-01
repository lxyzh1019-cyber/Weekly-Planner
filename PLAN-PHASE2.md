# Phase 1 closure and Meeting V2 — reviewed plan, rev A

| | |
|---|---|
| **Source** | `Weekly_Planner_Phase_1_Closure_and_Phase_2_Implementation_Plan2.md` |
| **Verified against** | `main` @ `c6ab50d` (after Release 1 / PR #78) |
| **Revision** | A — 2026-08-31 |
| **Status** | Baseline. Not yet implemented. |

## Context

The source plan closes four Phase 1 decisions and then rebuilds the weekly
meeting. It is a good plan: the priorities are right, its boundaries section
correctly names the owners that must not be duplicated, and its instinct to
define merge behaviour before UI is exactly the instinct this repo rewards.

Verified against the code, five of its premises are wrong, one item is much
cheaper than it reads and one much more expensive. This file is the corrected
version — the source plan's intent restated against what the repo actually
contains, with three owner decisions folded in. It exists so the implementation
session does not discover those five at the keyboard, where the usual outcome is
a half-migration nobody planned.

This is the **baseline**. Later revisions mark what moved with a ```diff block,
per the house convention for plans in this repo.

## Revision history

```diff
+ rev A (2026-08-31) — first reviewed version. Establishes the baseline.
+ rev B (2026-09-01) — Release 1.1a/b/c landed. Notes below record what the
+   build found that the plan did not predict.
+ rev C (2026-09-01) — Release 2 landed: the reflection record and its merge
+   rule, step 2 rebuilt, step 5's summary. All four releases are now built.
```

## What the build found that this plan did not predict

Four things surfaced during 1.1 that were not in rev A. They are recorded here
because a plan that is only ever right is a plan nobody checked.

**The meeting's scroller move broke a fourth caller, not three.**
`mmCaptureUiState` held the scroller *element* across a re-render. `.sheet`
survives `host.innerHTML = ...`; `.mm-body` does not, because it is inside the
host being replaced — so `restore()` was setting `scrollTop` on a detached node
and every tap in steps 3 and 4 silently jumped to the top of the panel. The new
assertion found it, not a person.

**Removing the tutorial left two live call sites that every static check
passed.** `node --check` and `check-globals` were both green while
`offerTutorialIfNeeded` was still being called from `openDay` and `showScreen`.
Only the smoke test caught it. A runtime reference in a file that parses is
invisible to both guards.

**Flipping the week default exposed an unmeasured word budget.** The audit had
been rendering Day Blocks, so the Full week had never been held to the 200 at
all, and measured 242. Most came out as duplicative copy; what remains sits on
the seeded row and is the seeded blocks' own names, which are the plan rather
than chrome. That row carries its own recorded number.

**The merge test caught one case of four, and that was the point.** Three of the
four reflection merge tests passed against the unchanged merge layer — the array
replacement happens to give the right answer when the newer side arrives second.
Only "a stale reflection does not overwrite a newer one" failed. Writing the
tests first is what separated the real rule from three that would have looked
like proof.

**A check can prove the markup and miss the rule.** The first version of the
reflection check asserted that a third answer chip was `disabled`. Removing the
cap from the handler left that attribute in place, so the mutation walked
straight past it. The check now reaches the action directly.

**The screenshot pass earned its place.** Every check was green when the week's
coach tip still sent a child to "My free time" in Day Blocks — a retired tab and
a panel whose markup had already gone. Nothing that asserts layering can catch
stale copy.

## Decisions taken

1. **Week tabs.** Flip the default to the Full week. Day Blocks is replaced by a
   read-only Print Preview as the second tab.
2. **Schedule lines.** Every rule goes behind the cards on both surfaces, so a
   card covers any line running through it. The **day view** adopts Print's
   mechanism, rebuilt as 15-minute rows. The **week** keeps its current mechanism
   at a **30-minute** interval and takes only Print's hour/half-hour styling,
   because at its scale a 15-minute row is under 11px.
3. **Tutorial.** Remove first-run onboarding entirely along with the Family Hero
   unlock subsystem.

## What was verified, and what it changes

**"Quick Check" does not exist under that name.** The thing being protected is
`.wf-card-check` — the quick-complete tick, rendered by `renderFullWeek` in
`js/07-week-view.js`, already carrying the one documented 44px exemption in
`tests/smoke.js`. It lives on the **Full** week only; Day Blocks has no tick at
all, just a `.tg2-block--done` opacity change. The requirement is satisfiable —
the doc should use the repo's name for it.

**There is no saved `weekView` preference to migrate.** It is a plain global in
`js/02-state.js`, defaulting to `'timegrid'`, never written to `localStorage`.
The source plan's migration bullet is unnecessary. The opposite is necessary:
because Day Blocks is what the Week screen opens on every single time, replacing
it with a read-only preview would make the default landing non-interactive.

**Day Blocks carries three banners a preview cannot.** `#tgFamilyBanner`,
`#tgSchoolBanner` and `#tgConflictBanner` sit under its grid. The school one is
the "add the missing School Day cards" offer — a mutation, so forbidden on a
read-only surface. The Full week has its own copies of all three, which is why
flipping the default is the fix rather than a compromise.

**Print has no line treatment to borrow.** `renderPrintSheet` does not call
`buildHourGrid` and draws no lines. The sheet is a CSS grid with one row per 15
minutes; the "quarter-hour rules" are cell borders and the "hour rules" a heavier
top border on `.print-hour-start`. Blocks are absolutely positioned over those
cells, which is why a line never crosses text there. Its readability is the rows
and the covering blocks, not a colour choice — so there is no colour-and-weight
borrow to perform, only a mechanism to adopt or a layering to fix.

**`renderPrintSheet()` takes no arguments.** It reads `weekOffset`,
`activeProfile()` and the module-global `printWindow`, writes to a hardcoded
`#printSheet`, and sets `--print-slot` on `document.documentElement` — so two
live copies on one page would fight over that variable. The instruction to
refactor rather than copy it is right; the signature it needs is
`renderPrintSheet(host, { weekOffset, profile, window })`, with the slot size set
on `host`.

**Three scales, not one.** `PX_PER_MIN` is 1.4 globally (day view), but
`renderTimeGrid` and `renderFullWeek` each shadow it with a local — 0.85 and
0.72. A 15-minute row is therefore 21px on the day and 10.8px on the Full week.
The day divides exactly: 64 rows × 21px = the 1344px canvas already in use. The
Full week neither divides evenly nor has the room. This is the whole basis of
decision 2.

**`canReviewDay` is a consolidation, not a new capability.** Eligibility already
exists: `dayBlocksEligibleToConfirm` (`js/09-sheets.js`) filters today's blocks
to those that have started, `markDayReviewedForChild` refuses while any remain
unconfirmed, and `renderParentBanners` already disables the button with "Confirm
the blocks first". Two real holes remain, and they are exactly the ones the
source plan names: the predicate is **started** (`startMin <= now`) rather than
**ended** (`startMin + durationMin <= now`), and a day with no blocks passes the
gate — including a future one. The meeting keeps a third copy, reading
`state.shared.parentDayConfirm` directly in `js/15-meeting.js`.

**The reflection record's array fields would lose deselections.** `deepMergeObj`
(`js/04-merge.js`) treats a non-plain-object as a scalar, so `answerIds: []` is
replaced wholesale by whichever snapshot arrives last, with no timestamp
consulted. Untick an answer on the iPad and the phone's stale copy can put it
back — silently. There is an exact precedent for the fix in the same file.

**The meeting's flex-column fix moves the scroller.** `.mm-head` and `.mm-nav`
are `position: sticky` inside `.sheet`, which is the scroller today. Making the
body the scroller breaks three readers of `sheet.scrollTop`: `mmCaptureUiState`,
`mmCaptureReturn` and `mmReturnToMeeting` — the last two being `mmReturn`, which
the source plan's own boundaries list as must-not-break.

**~200 lines in scope are already dead.** `buildPrintSummary` (`js/16-print.js`)
and `renderTimeGridWeekOverview` / `renderTimeGridMyTime` / `renderDayBar`
(`js/07-week-view.js`) have no call sites, and the latter two have no target
elements in `index.html`. They go with this work rather than through it.

## Release 1.1a — structural, no visual change

Land these first. Nothing here touches layout, so a regression is legible.

**One day-review decision.** Add `canReviewDay(kid, dayKey)` to `js/36-status.js`
— the file that exists to end this kind of duplication — returning
`{ ok, reason, pendingCount, futureCount }`. Build it on
`dayBlocksEligibleToConfirm`, changed to measure a block's **end**. Note that
`confirmAllBlocksForChild` shares that predicate: after the change, "Confirm all"
stops offering a block that is still running. That is a strengthening of the rule
CLAUDE.md already states, and the commit should say so rather than let it look
accidental. Close the empty-day hole — a future day is never reviewable, a past
empty day only behind an explicit "Nothing was recorded" state. Then route all
three callers through it: the parent banner, the meeting's step 1 rows, and
`canCloseWeek`. Disabled controls name the reason they hit.

**The iPad bars.** Meeting: make `#familyMeetingOverlay .sheet` a bounded flex
column — `.mm-head` and `.mm-nav` as `flex: 0 0 auto`, `.mm-body` the only
`overflow: auto` — dropping the sticky positioning and negative margins that
compensate for it today. Then point the three `sheet.scrollTop` readers at the
body; one `mmScroller()` helper beats three selectors. Day: the top bar moves
outside `.day-workspace`, which is already the only scroller;
`dayTopbarCompactBound` and its scroll listener assume the bar is inside it and
must be re-pointed or removed. Use `100dvh` with a `100vh` fallback and
`env(safe-area-inset-bottom)`. Desktop keeps what it has.

**School Time reconciliation.** Extend `paSaveSchoolHours` (`js/33-parent-app.js`)
with the preview and three choices the source plan describes. Two details it does
not carry: blocks store **absolute** planner minutes (`START_MIN + h.startMin`),
so reconciliation applies the same offset the school-day offer in
`js/07-week-view.js` does; and the whole sweep ends in **one** `saveAll()` —
every save is a full-document Firestore upload, so a per-block save across
fourteen blocks is fourteen uploads of the entire family document. One rule to
add: a block carrying a `seriesId` is updated like any other, but the series'
stored `seriesDays`/`seriesEvery` are untouched — an hours change is not a change
to the repeat.

**Family Hero unlock removal.** The lock is generic, not Family-Hero-specific:
`js/01-config.js` spreads all four `REWARD_POOLS` into `DEFAULT_ACTIVITIES` with
`rewardLocked: true`, and `getAllActivities` turns that into `_rewardLocked`. So
exclude the `family` pool from that spread — ids unchanged, so historical blocks
still resolve through `findActivity` — and drop `'family'` from the milestone-10
cycle in `enqueueMilestoneRewards`, leaving `['academic']`. Remove
`a_unlock_helper` from `AFTERSCHOOL_REWARD_ITEMS` (`js/02-state.js`) and `ar2`
from `AFTERSCHOOL_CHECKLIST_REWARDS`, leaving their Focus and Culture siblings
alone. Per decision 3, `openTutorial`, `chooseTutorialStarter`,
`TUTORIAL_STARTER_CHOICES`, the `#tutorialOverlay` markup and the `tutorialDone` /
`tutorialStarterActId` reads all go; stop writing those two progress fields but
leave stored values inert, since a cached bundle that still reads them must not
resurrect a lock. The `_rewardLocked` guards in `js/08-day-view.js` and
`js/09-sheets.js` stay — they still serve the other three pools.

**Sweep the dead code** listed above in the same release.

**Done when:** a day cannot be reviewed while an activity is still running or
still to come; a future day cannot be reviewed at all; the meeting footer and Day
header hold layout space at every scroll position on iPad in both orientations;
changed school hours preview their effect and update only safe future cards, in
one write; Family Hero chores are ordinary available activities that still grade
and pay as chores, with no unlock anywhere; unrelated rewards and XP unaffected.

## Release 1.1b — the week tabs

Ordered **before** the grid work deliberately: this release deletes the Day
Blocks surface, so doing it first means the grid change in 1.1c touches two
surfaces instead of three, and no styling effort lands on a layout about to be
removed.

Flip `weekView`'s default to `'full'` in `js/02-state.js` and make `index.html`
agree — `#weekFull` visible, `viewTabFull` active. `checks.weekOpensOnDayBlocks`
in `tests/smoke.js` asserts all four of those facts against each other and will
catch a half-done flip; rename and invert it.

Refactor `renderPrintSheet` to the parameterised signature above, then render it
into the second tab's host. `openPrint()` stays the Print button's direct route.
The print output is already handler-free, so read-only costs nothing to enforce —
but assert it rather than assume it.

Retire `renderTimeGrid`, `tg2ShortLabel` and the ~93 lines of `.tg2-*` CSS
**together**: `tests/check-dead-css.js` fails the build if the CSS outlives the
markup, and `check-globals` if a name is left half-removed. `wfBufferSegments`,
`attachMiddleDragPan`, `attachTapGuard` and the three banner renderers are shared
with the Full week and the print sheet — they stay.

Eight smoke checks are tied to the Day Blocks surface, and each needs a decision
rather than a deletion. Most re-point to the Full week. Two do not: the
`'Day Blocks week'` arm of `theHourGridReadsThroughABlock` has no successor,
because the preview draws no `.hour-grid` at all — it folds into the Full week
arm, so the check covers two surfaces honestly rather than three dishonestly; and
the `screen-week/dayblocks` type-size row exists specifically to audit the
*default* layout, so it becomes the Full week row.

**Done when:** the Week screen opens on the interactive Full view with its ticks,
planning controls and all three banners; the second tab is a read-only preview of
the same child and week with no mutation path; the Print button still opens the
full Print interface directly; `npm run check` passes with the tg2 renderer and
its CSS both gone.

## Release 1.1c — the schedule lines

Two surfaces, two treatments, because they are drawn at different scales. One
rule is shared, and it is the point of the release: **every rule goes behind the
cards, so a card covers any line running through it.** No line may cross activity
text on either surface.

Today the hour line deliberately rides *above* the cards so a card cannot hide
four o'clock. Once it moves behind, that marker survives as a short tick in the
gutter — both surfaces already have one (`.tl-gutter`, `.wf-gutter`). Same
answer, drawn beside the cards instead of through them.

**Day view — rebuild as 15-minute rows.** Cheaper than "rewrite the day view"
sounds, because Print does not place blocks in cells either: it absolutely
positions them over the grid with `overflow: visible`. So the block layer, the
drag arithmetic, `renderBlocksWithCollision`, the buffers and the now-line do not
move — only the background does. It divides exactly, 64 rows at 21px filling the
1344px canvas already in use, so there is no rounding to manage. Emit the grid as
an absolutely-positioned `display: grid` with `grid-template-rows: repeat(64, 1fr)`,
each row carrying a boundary class for hour, half or quarter.

**Full week — keep the mechanism, take the look.** No row grid. Lines stay as
positioned elements from `buildHourGrid` (`js/05-helpers.js`) at the existing
**30-minute** interval, with no quarter-hour rules. What changes is styling and
layering: the hour line takes Print's heavier, darker treatment and the half-hour
line Print's lighter one (`.print-hour-start` against the plain `--paper-line`
cell border are the reference), and both move behind the cards. The reason to
stop here is not code cost — the rebuild is about the same work — but that at
0.72px per minute a 15-minute row is under 11px, and four rules an hour reads as
hatching rather than structure.

So `buildHourGrid` keeps its `lines`/`ticks` split for the week and gains a
sibling that emits the day's row grid. The `ticks` output stops being a
full-width rule on both surfaces and becomes the gutter tick.

`theHourGridReadsThroughABlock` asserts today's arrangement deliberately,
including that an hour mark is *not* behind a card. It is reversed, not deleted.

**Done when:** no schedule line crosses activity text on either surface; the hour
is still findable from the gutter at any scroll position; the day view draws
quarter-hour rows and the week draws none; Print is untouched and unchanged.

## Release 2 — Meeting V2

The source plan's meeting sections are sound and should be built as written, with
four changes.

**Put the reflection where the merge already works.** Store it as
`state.shared.chore.reflections[weekKey][kid]`, matching `weekConfirms` and
`weekPlans` — the same two-level week/kid shape, in the same container, holding
`updatedAt`. Then add `'reflections'` to the `['weekConfirms', 'weekPlans']` list
in `mergeSharedChore` (`js/04-merge.js`). That loop already takes the whole
per-kid record from the strictly-newer side, which is the rule the source plan
asks for, and it fixes the array problem for free: a record replaced whole cannot
lose a deselection. Write the failing merge test first — the house rule for this
file, and the one that last time correctly said *don't change it at all*.

**Budget the reflection screen before designing it.** Three tabs of eight
answers, three prompts, five evidence cards and four plan fields is well past the
200 visible words a kid screen gets. The meeting is not in `WORD_BUDGET` today
and should be, measured on step 2 with one child selected. The fold pattern Today
and My money already use (`tdExtrasOpen`, `mnyPricesOpen` — `localStorage`, never
synced state) is how the evidence and the four plan fields stay available without
being on screen by default. Answer chips are interactive and take the 44px floor.

**Do not write a full document on every chip tap.** Every mutation is a
whole-document Firestore upload with no debounce, and step 2 is the tap-heaviest
screen in the app. Hold the in-progress reflection in a module-local draft and
commit on tab change, on child switch, and on the parent's "we talked about
this" — three writes per child per meeting instead of twenty.

**Two model fixes.** `inputMode` exists only on the first section; it belongs on
all three or none. And render every stored string through `escapeHtml`, with
chips driven by `data-*` attributes and one delegated listener — the pattern
`js/13-chores.js` uses — never interpolated into `onclick`, which is the hole
`escapeJsAttr` exists to plug and which `tests/check-escaping.js` fails the build
over.

**Done when:** both children hold independent reflection drafts that survive
rerender, sync and return navigation; a child can complete all three prompts by
tapping, without a keyboard; parent confirmation records the conversation and
changes no completion, grade, XP or money; skipping is explicit and does not
block settlement; step 3/4/5 financial invariants and the undo snapshot are
unchanged.

## Scope lock

Not in this plan, and not to be added to it mid-flight:

- XP threshold or rate changes — deferred until real post-fix meeting history
  exists, per the source plan and CLAUDE.md.
- Any restyling of Today, Money or the Meeting into a shared Print visual system.
- Making Print Preview interactive.
- Stored audio, cloud transcription, or automatic judgement of a child's answer.
- Automatic rescheduling of activities that conflict after a school-hours change —
  conflicts are reported and linked, never moved.
- Any change to the money model, chore grading, or the Firebase document shape
  beyond the one reflection record.

## Documentation to update in the same PRs

The CLAUDE.md paragraphs this work falsifies: "One owner for the :00 / :30 grid,
drawn in two layers", the `tg2ShortLabel` exclusion in the block-naming
paragraph, and the Day Blocks references under Navigation. Leaving them is how
the next session reverts this work believing it is restoring the house rules.

## Verification

Nothing ships without `npm ci && npm test` green — `check-syntax`,
`check-globals`, `check-escaping`, `check-dead-css`, then 62/62 merge, the XP
values, then the smoke suite. New features ship with a new check, per the house
rule, and each new check is mutation-tested: break the feature deliberately and
confirm the check catches it. A check that returns a truthy array instead of
`true` is a check that reports a problem and passes.

Per release:

- **1.1a** — seed a block that has started but not ended, assert review is
  refused; advance past its end, assert it is offered. Assert a future empty day
  is refused. Count `saveAll` calls across a full-week school-hours
  reconciliation and assert it is one.
- **1.1b** — assert the preview host has no `onclick`, no mutation `data-` hook
  and no `.wf-card-check`; assert the Full week still ticks a block; assert the
  school-day offer is reachable from the default tab.
- **1.1c** — extend the reversed `theHourGridReadsThroughABlock` to assert, on
  both surfaces, that no rule sits above a card, that the gutter tick does, and
  that neither layer takes pointer events. Assert the week draws hour and
  half-hour rules and **no** quarter-hour rule, and the day view all three. Then
  screenshot both with a full afternoon — the checks can prove the layering, not
  that the result reads well, and the ribbon bug CLAUDE.md records was found by a
  screenshot rather than a check.
- **2** — a two-device merge test written before the UI, driving a select on one
  side and a deselect on the other. Then the meeting end to end on iPad in both
  orientations, with `mmReturn` exercised from step 2 into a child's day and back.

## Confidence at this revision

| Release | Confidence | The risk that remains |
|---|---|---|
| 1.1a | ~90% | Small surface, existing code to build on. |
| 1.1b | ~85% | The print renderer refactor; eight smoke checks to re-point. |
| 1.1c | ~88% | Checks prove layering, not legibility — needs the screenshots. |
| 2 | ~80% | Code is tractable; the reflection UX will need a design pass to fit the word budget. |
| **Overall** | **~88%** | |

The source plan as written measured ~55–60%, because two false premises would
have surfaced mid-build. The gap between those numbers is what this revision is
worth.
