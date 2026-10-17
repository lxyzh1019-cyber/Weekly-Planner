# ARCHITECTURE.md — history

Build history and retired rules taken out of `ARCHITECTURE.md` (PR 0-B, 2026-10-08). Nothing here is a current rule. Each part names the `ARCHITECTURE.md` section it came from; a one-line pointer stays there.

## From "Plan v6 PR B — the Grandma rule, the loan season, the gates (2026-09-22)"

**🔓 A pot opening is a moment.** *(Retired in Sunday v15 Stage 3: the Sunday
milestone — "🔓 20% paid back! Savings is open", Plan v5 Deviation 33 — says it
at the moment it happens, and the card would have said it twice.)* On her own My money, `mnyStageOpenedCard`
showed one card when her stage is above the stage last acknowledged on this
device (`localStorage`, `wp_mny_stage_seen_<kid>`, every access in try/catch,
never synced). It names the pots and shows each new idea's what / why / watch
through `mnyConceptCard` — never restated. First sight records the current stage
silently; a stage that drops is recorded silently too. A grown-up sees nothing.

## From "Small fixes R6 — Plan v6 C (2026-09-25, build 2026-09-25a)"

Eight small fixes, each held by a smoke check that failed on the code before
it. The rules they set are written in place above; this is the index (the rules are in `ARCHITECTURE.md`).

| # | What | Where the rule lives | Check |
|---|---|---|---|
| C1 | 😌 Rest on the 📋 sheet is a 44px target (it was 38px) | `#restDayBtn` joins `.day-over-btn, .reflect-day-btn` in `css/app.css` | `restButtonIsA44pxTarget` |
| C2 | Reflect-sheet moods are 44px, day and blocks; block names 15px | "How a day went is asked on Today" | `reflectMoodsAre44pxTargets` |
| C3 | An empty day's canvas stretches to its pending invite ghosts | "The day STOPS where the day stops" | `anEmptyDayDrawsItsInviteGhost` |
| C4 | A child's "remove all in series" keeps pinned copies | "A pin is a parent's" | `removeAllInSeriesKeepsPins` |
| C5 | 👯 Sister details is a grown-up's to change; kids see it | "Sister Sync is a timeline" › *showAll* | `sisterDetailsAreTheParentsToChange` |
| C6 | Sister Sync is in the kid-screen sweep; each row proves its screen showed | UI rules | `kidScreensMeetTheHouseRules` |
| C7 | The R5 screens read in dark mode | `ARCHITECTURE.md` › Small fixes R6 › Dark mode | `theR5ScreensReadInDarkMode` |
| C8 | The copy button names the sister's day | "A pin is a parent's" | `copyADayNamesTheSistersDay` |

## From "Small fixes R6 — Plan v6 C (2026-09-25, build 2026-09-25a)"

**C6 found** the 💌 inbox's ✅ Accept / ❌ Decline / 📌 Add it anyway at
`.pill-btn`'s 38px (`.invite-actions .pill-btn` is 44px now). Before the
screen-on-show guard, the new Sister Sync row measured nothing: the sweep ran
with a parent signed in and `openSisterSync` refused.

## From ARCHITECTURE.md: Small fixes R7 — Plan v7 (2026-09-26, build 2026-09-26a)

Eight small deferred fixes, each held by a check that failed on the code
before it — except item 5, whose check found nothing to fix and was shown to
bite by a fault planted in a scratch run, and items 7 and 8, which change no
behaviour and are held by a scripted grep. The rules are written in place
above; this is the index (the rules are in `ARCHITECTURE.md`).

| # | What | Where the rule lives | Check |
|---|---|---|---|
| 1 | The closing ritual counts what is done and names the child being viewed | "How a day went is asked on Today" | `theClosingRitualCountsWhatWasDone` |
| 2 | The Day view's invite buttons are 44px and the ghost never covers a block (lanes, empty minutes, inside the canvas); the Day view is in the sweep (which also found its top bar, ✓ tick and meta line) | UI rules; "There is a second accept door" | `kidScreensMeetTheHouseRules` (Day view rows), `anEmptyDayDrawsItsInviteGhost` |
| 3 | Copy a day with nothing to copy says so and changes nothing | "Copying nothing asks nothing" | `copyingNothingSaysSoAndChangesNothing` |
| 4 | The copy confirm names a copied block that overlaps a kept pin | "A copy that lands across a kept pin says so" | `aCopyNamesItsOverlapWithAKeptPin` |
| 5 | 🕓 Catch up is in the dark-mode contrast check (nothing to fix; a low-contrast title planted in a scratch run failed it) | `ARCHITECTURE.md` › Small fixes R6 › Dark mode | `theR5ScreensReadInDarkMode` |
| 6 | "Sister Sync" stays one line in the fallback font at 375px | Navigation, "Five places" | `sisterSyncTabFitsInTheFallbackFont` |
| 7 | "90/90" → 112 here and in `tests/README.md`; the four stale "6am–9pm" comments (`js/08-day-view.js`, `js/16-print.js` ×2, `css/app.css`) say 6am–10pm | — | `grep -rn "6am.9pm" js css` finds nothing |
| 8 | Dead code removed: the drag `inviteId` guard (`js/39-block-drag.js`), the orphan 👯 aria-label entry (`js/99-main.js`), the Chores options `export` branch (`js/29-chore-options.js`); the 12 dead chore-tab branches wait for C3 | — | grep; `check-dead-actions` reverse warnings 27 → 26 |

## From "The money week runs Sunday to Saturday — Plan v6 Deviation 34 (2026-10-04)"

The owner's answer to S1-6 was "Money week only": from the meeting of
**Sun 11 Oct 2026** the meeting pays the seven FINISHED days before it —
Sun..Sat — for chores, the routine streak, fines and club sessions. The
planner, every stored `weekKey` and every per-day record stay Monday–Sunday.

**A dated rule, not a new key.** `MR_DEFAULT_RULES.week = { startsOn:
'sunday', from: '2026-10-11' }`, read per key through `mrRuleOr`, so a stored
rulebook that predates it reads the same answer; `mrMoneyWeekRulePending` /
`mrApplyMoneyWeekRule` (marker `MR_MONEY_WEEK_NOTE`, card on Grown-ups ›
⚙️ Rules) append it as one dated version from this week's Monday, the Sunday
rules' way. A week is Sun–Sat when its rules say `sunday` and its meeting
Sunday (Monday + 6) is on or after `from` (`mrMoneyWeekRuleOn`). No
`state.shared` key was added, so no merge decision was needed.

**The mapping (js/18-rules.js, `mrMoneyDays`).** Storage identity is
(planner Monday W, dayIdx 0 = Mon … 6 = Sun). The money week keyed by W is:

| Rule | Days paid | Storage refs |
|---|---|---|
| Mon–Sun (before the switch) | Mon(W)..Sun(W+6) | (W,0)..(W,6) — exactly as before |
| Sun–Sat | Sun(W−1)..Sat(W+5) | (W−7, 6), (W,0)..(W,5) |

The meeting on Sun(W+6) still settles weekKey W (`ctThisWeekKey()` names the
coming meeting's week on every day under either rule); that Sunday itself is
day 0 of the next money week, W+7. `mrMoneyWeekOf(dayKey)` answers "which
money week pays this day" for today's surfaces. Every reader asks
`mrMoneyDays` / `mrMoneyDayKeys` instead of `mrWeekDayKeys`: `mrChoreWeek`
(its `days[]` now carry `dayKey`, `wk`, `d`, `taken`), `mrStreakWeek`,
`mrFinesWeek` (and `mrFineStanding`), `mrSessionsWeek` (an attendance answer
kept at the day's planner week is still read). A Sun–Sat week has no "unticked
Sunday counts on its own Sunday" case (owner decision #93 stays for Mon–Sun
weeks): its meeting comes after its last day, so Sunday's step 1 no longer
asks for the Sunday routine (`sdSundayRoutine`). Competitions, learning and
gifts keep their Mon–Sun week.

**A day is never paid twice.** `mrFreezeWeekLedger` writes the row's
covered days (`days`). A settled week keeps exactly the days it froze; a row
frozen before `days` existed covered its own nominal days. The only day two
weeks can both name is the switch Sunday (Sun 4 Oct 2026: day 6 of the last
Mon–Sun week, day 0 of the first Sun–Sat one). An open week marks `taken` any
of its days a settled neighbour covers, so whichever of the two settles first
pays it — normally the old week, at the meeting of 4 Oct, leaving the first
Sun–Sat week six days (Mon 5 – Sat 10). A `taken` day is paused for the
streak (neither kept nor missed). Held by tests/sunday.test.js (the pure
`mrMoneyDaysPure`, all 120 settle orders over five weeks: every day paid
exactly once) and smoke `theMoneyWeekRunsSundayToSaturday`,
`aDayIsNeverPaidTwiceAcrossTheSwitch`.

**Readers that changed** (today's day belongs to the next money week on a
Sunday): the ☀️ countdown (`mnyCountdownData`: on a meeting Sunday, before
her meeting, the finished week with "Sunday is today!"), Today's 🔥 streak,
`mrChoreWouldPay` / `mnyEarnLeftToday` (through `mrChoreDay`), the chore tab's
cap bar, earn board, header streak and free-chore marks (kid and parent), the
parent day cards and fines list, Grown-ups › 📦 Fines (Day row =
the coming meeting's money days, plus today when it is not one of them; each
fine's cost from the week that pays its day), the dispute amount, Sunday's
"My week" strip and `mnyWorking` day names. **Unchanged on purpose:** every
`ctWeekMoney` / `mrWeekBreakdown(W)` caller that means "the meeting at the end
of planner week W" (week view, passbook, story, meeting, stream, Approve's
This Sunday, the club sessions sheet).

`tools/money-calibrate.js` prices its modelled weeks in the rule's order
(Sunday first); the figures do not move (day order only moves ties), which
tests/money.test.js now asserts — nothing was re-pinned.
