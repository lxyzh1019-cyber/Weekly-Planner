# Checkpoint report 5 — Weekly-Planner consistency pass — Round 2 and the end report

## Quick read

**Summary**
- Round 2 is built and green on GitHub, pictures included. It goes to you as one pull request; it is the last build of this plan.
- Popups follow your answers P1–P6: 22 sheets are centred on the iPad; the edit, activity and training forms keep the right-side panel on the iPad (P2); all come from the bottom on a phone. Money popups keep their area colours (P3). Every sheet has one finger-sized ✕; yes/no questions have no ✕ (P4). Old buttons and cards are gone; the app uses the kit everywhere.
- Part 13 adds seven guards that stop new private styles, removes 7 unused functions, stops two leaking timers, and moves old history notes to the archive. The parent backup screen shows one read-only line about the Sunday-start money rule.

**What changed from the plan**
- The plan counted 27 popups; there are 25 (your answer P1).
- Emoji are not hidden in the picture test: hiding them moved the text next to each emoji. The retries stay, and a planted 1-pixel red outline on a plain button proves a real change still fails.
- The Sunday-start money option stays (P10 A). Removing it is a later pull request, only if neither iPad has that rule.
- Copy a day says "N blocks will be replaced", not "planned blocks": the count includes ticked blocks.
- The ✕ sat at the bottom right of short sheets and out of view on tall ones (Stage 63's fix); it is now pinned to the top right of every sheet, and the check measures it before and after scrolling.
- Stage 63's first worker reached its test-run limit; an Opus worker finished it. Stage 64 reads the saved rules directly, because the usual reader creates a rule set when none exists.

**Decisions during the work**
- Popups P1–P6: 25 popups; edit, activity and training keep the right panel on the iPad; money popups take the one look with their area colours; ✕ on sheets, not on yes/no; handle bar on the phone only; ✕ stays in view while you scroll.
- Red OK P7–P9: red on 8 questions that cannot be undone, the normal button on 4, red on 2 only when planned blocks are lost (the question names how many).
- "Remove this block" keeps its full width (built on my recommendation — undone if you say no).

**Suggestions**
- Seven pictures passed only on a retry in one run, some with 300–500 changed pixels. A change that comes and goes can pass the retries. Recommend: count retry passes per run and fail above 3.
- The plan check put colour marks on the Rev 5 lines only after you asked (10 of 12 approved plans have them). Recommend: the plan check marks lines on the first showing of a Rev.
- Stages 45 and 63 could have run side by side (33 min). Recommend: the planner puts stages with no shared file in one group.
- Sonnet took 34% of hand-overs (goal 40%); one Sonnet lane hit the test-run limit. Recommend: keep the goal; raise Sonnet's test-run limit for picture-heavy lanes.
- Opening the parent portal on a fresh iPad creates a starting rule set (older behaviour, not this round). Worth a look in a later money round.

## Measured part (by code, from the session files)

### Top 3 time sinks
1. Model thinking: 986 min (35%). Fix: fewer steps; read several files in one step; smaller hand-overs.
2. Test runs: 797 min (28%). Fix: a one-test run under 1 minute; workers run tests in the foreground.
3. Waiting for GitHub: 631 min (22%). Fix: each GitHub job under 5 minutes; one push per pull request.

### Top 3 token sinks
1. opus-worker: 480.9 M (53%). Fix: Routine work to sonnet-worker.
2. Main session: 278.1 M (31%). Fix: /compact at a stop above 50% context.
3. Main context above 200 k: 114.9 M (13%).

**Parallel candidates:** 231 min could have run side by side. Stages 5 and 7: 44 min; Stages 45 and 63: 33 min; Stages 35 and 37: 29 min.

### Live scorecard
| Solution | Measured | Result |
|---|---|---|
| ⏳ lines per round (goal: at most 1) | max 16 in one round, 127 in 50 rounds | does not work |
| Asked you to open a new session (goal: 0) | 4 | does not work |
| Reviews per pull request (goal: at most 2) | max 6 | does not work |
| Plan tries per approval (goal: at most 2) | 45 tries, 12 approved | does not work |
| Stops for you (goal: only necessary ones) | 46 stops in 50 rounds | measured |
| Pull requests per merge stop (goal: 1) | 16 opened, 24 merge stops | works |
| Check time (goal: under 5% of the session) | about 241 min (8982 tool calls) | measured |
| Main session share of tokens (goal: under 35%) | 10% | works |
| Sonnet share of worker hand-overs (goal: 40% or more) | 34% (42 of 123) | does not work |
| Workers' tests in the foreground (goal: 0 in the background) | 649 foreground, 22 background | does not work |
| Report link in the Completion line (goal: every one) | 12 of 55 | does not work |
| 'Part n' instead of 'PR n' | PR n: 457 · Part n: 90 | does not work (old records) |
| Approved plans with colour marks | 10 of 12 | does not work |
| Waiting answers with a notice that names them | 14 of 62 | does not work |

### Totals
| Measure | Value |
|---|---|
| Sessions | 15 |
| Session time (sum) | 87.8 h |
| Tokens | 903.3 M |
| Tool calls | 8982 |
| Hook time per call (median) | 1.03 s |
| Test runs (time in test commands) | 797 min |
| Helpers started | 172 |
| Refused steps (checks) | 265 |
| Main context: at start / peak | 72 k / 532 k |
| Compactions | 2 |

**Tokens by helper:** opus-worker 66× 480.9 M · main 15× 278.1 M · reviewer 40× 64.9 M · sonnet-worker 38× 62.9 M · Explore 16× 11.5 M · planner 6× 4.1 M · reviewer-light 6× 0.9 M.

**Slowest steps:** the longest were waits for your answers or approvals (428, 178 and 131 min), not work.

**One-test time:** median 55 s for a one-test run (344 runs, report tool); a single smoke check on this PC starts in under 40 s (D41).

## Round 2 evidence
- Stages 43, 62, 63, 45 and 64 done. The reviewer found 1 blocking problem (the Stage 64 wording, "money rule" as you chose); fixed and proven by the fix run.
- Code head 7d125b0, GitHub run 38343054413: all 6 jobs green; 344 pictures, 0 differ, 0 passed only on a retry; the planted outline check caught.
- Against main: 273 files changed; 212 pictures changed in 46 states, each on the before-and-after page docs/handoff/consistency/round2-compare.html (5.72 MB).
- Money 38/0 and Sunday 146/0 unchanged.
- Red OK list: red — Reset week, Start this day over, Remove goal, take an activity off (future blocks removed), Reset routine, Delete routine, backup Replace everything, Replace blocks. Normal — Box it anyway, exercise off the list, child-added activity off the list, Retire chore. Red only when blocks are lost — Repeat until ("N planned blocks will be removed"), Copy a day ("N blocks will be replaced").

## Regression table (against FEATURES.md)
| | |
|---|---|
| Kept | Every popup still opens and closes (all 25, oneSheetAndOneDialogEverywhere); Esc, backdrop tap, focus return; Undo below popups; reflect moods 44px; money and Sunday figures unchanged; backup export and restore (backupTabIsUsable and 5 more) |
| Added | One sheet and one dialog family; 44px ✕; seven guards and the 13px floor; planted outline check; Sunday-start line; Monthly fits a phone |
| Intentionally removed | Old sheet looks and the 32px ✕; amber Sunday card; old shared buttons and cards; 7 unused functions; emoji hiding (tried, taken out) |
| Missing | none |
