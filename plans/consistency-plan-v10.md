# Plan v10 — Weekly-Planner consistency pass — Approved 2026-10-10

| Summary |
|---|
| 🟦 **Rev 1** — What changes for you: every test job on GitHub finishes in under 5 minutes before the parent header work starts, so each pull request is ready sooner. |
| What changed and why: you asked to move the test speed work up, with three workers side by side, and to start the parent header work fresh from the main version. |
| 🟦 **Rev 1** — What I need to do: approve Plan v10. |

🟦 **Rev 1** — **Quick read** · 239 words · about 2 min

**Summary**
- 🟦 **Rev 1** — Goal: every GitHub test job finishes in under 5 minutes before PR 5 starts; then the rest of the consistency pass as approved.
- 🟦 **Rev 1** — Done: 22 of 46 stages. Next: measure where the smoke time goes and split the test into parts.
- 🟦 **Rev 1** — I need from you: approve Plan v10.

**What changed since Plan v9**
- 🟦 **Rev 1** — The test speed work (old Stages 41–42) now comes next, before PR 5.
- 🟦 **Rev 1** — Each date's smoke test runs as 3 parts side by side, so each job takes about 3–4 minutes instead of 6.5–8.
- 🟦 **Rev 1** — Three workers work at the same time, one per slow test group; no dynamic workflow.
- 🟦 **Rev 1** — PR 5 starts from main, not stacked on another branch.
- 🟦 **Rev 1** — Stage 22 is done: PR 4 is merged and live, and you read the comparison page and the iPad build.

🟦 **Rev 1** — **Decisions:** None open. You answered on 10 October: Stage 22 OK, 3 parts per date, the setup update waits for later.

**Next steps**
- 🟦 **Rev 1** — Stage 23 measure and prepare: a table of where each smoke job spends its time; the three slow groups moved to their own places.
- 🟦 **Rev 1** — Stages 24–26, three workers side by side: each slow group sets up its own data and passes alone.
- 🟦 **Rev 1** — Stage 27 parts on GitHub: 12 smoke jobs, each under 5 minutes, every check run exactly once.
- 🟦 **Rev 1** — … 19 more steps in the full plan below

---

## The full plan

## Your decisions on record

- **D1** No full redesign. Fix the header, then consolidate components.
- **D2** Money format: "$3" for whole dollars, "$2.50" otherwise, everywhere. Negatives "−$3".
- **D3** Keep both the Print preview tab and the 🖨 Print button.
- **D4** Profile badge on every kid screen, money pages included.
- **D5** No emoji in screen titles. Headings may lead with one.
- **D6** Money re-check first, as one pull request.
- **D7** Chores retires after your per-row ✓ (done).
- **D8** Track S (security) after this pass; until then no public link is shared.
- **D9** Checks at iPad 1194×834 and phone 390×844, both looks.
- **D10** Stage 0 first: PR 0-A, then PR 0-B (done).
- **D11** One session: this session carries Stage 0 and PRs 1–13.
- **D12** PR 4 waits for the approved Claude Design header pictures (done).
- **D13** Old history goes to the archive.
- **D14** Reading size default 1.2 when nothing is stored (PR 5).
- **D15** PR 0-pre is its own pull request, merged before PR 0-A, with nothing else in it (done).
- **D16** The full test suite never runs on this PC. Each change uses the short test loop: the fast checks plus the tests the test map names for that area. The full suite runs only on GitHub.
- **D17** Retired in Plan v6 (replaced by D20).
- **D18** The Calm "with Mum" chore text on Today, too pale to read, is fixed in PR 7 with a test row that shows it.
- **D19** Retired in Plan v6 (replaced by D20).
- 🟦 **Rev 1** — **D20** One smoke job per date, about 8 minutes accepted until the test speed work; the job that took 20 minutes was explained and fixed; keep the short test loop, the test map and the time tool. The way under 5 minutes is now D39.
- **D21** The header pictures are your Claude Design package (9 October 2026), not Claude's mockups. Heights: standard 64 on the iPad and 60 on the phone; money 72 and 64; meeting 62 + 44 on the iPad and 60 + 44 on the phone; parent like standard, with a 44 sub-bar when viewing a girl.
- **D22** The unused-style checker loophole is closed (done in PR 4).
- **D23** The picture test hides the build number (done in PR 4).
- **D24** The four overnight choices built in PR 3 are kept.
- **D25** The round avatar badge is on every kid header at every width; its words stay for screen readers.
- **D26** Today's date shows on a phone. Only the money header hides its date on a phone.
- **D27** On a phone, Copy a day moves to tapping the Day date; the iPad keeps the button.
- **D28** The iPad Day title reads "Tuesday 6 Oct"; the span form ("Tue–Thu") waits for PR 6.
- 🟦 **Rev 1** — **D29** PR 4 does not match the pictures: rebuild the kid header from your table of exact values with new parts (done).
- 🟦 **Rev 1** — **D30** Differences 1, 9–14 follow the picture; 2–8 stay as built (done).
- 🟦 **Rev 1** — **D31** Difference 15: the phone Day date is 20px; smaller only if 20px does not fit at 360px wide (done).
- 🟦 **Rev 1** — **D32** The smoke test measures every header against the exact values and fails on any mismatch (done).
- 🟦 **Rev 1** — **D33** The comparison page is made again, iPad Pop first (done).
- 🟦 **Rev 1** — **D34** Checkpoint report 1 (done; sent again on 10 October).
- 🟦 **Rev 1** — **D35** PR 5 builds the parent header from the same table (purple bar, 44 badge, 44 buttons, 44 sub-bar when viewing a girl). It starts from main after PR 4 merged; it is not stacked (D40).
- **D36** The picture wins: where the build and your picture differ, the build follows the picture. Only a part that cannot fit becomes a question, with a picture pair.
- 🟦 **Rev 1** — **D37** One header first: one screen is built and shown beside your picture before the rest.
- 🟦 **Rev 1** — **D38** The rule "follow the reference exactly" goes to the central rules as a proposal.
- 🟦 **Rev 1** — **D39** Every GitHub job under 5 minutes comes before PR 5. Each date's smoke test runs as 3 parts side by side (12 smoke jobs). The slow groups set up their own data so a part can run without the others. Three workers work at the same time, one per slow test group, each in its own place; no dynamic workflow.
- 🟦 **Rev 1** — **D40** PR 5 and every later pull request start from main after the one before merges; no stacks for the rest of this plan.

Earlier agreed points still in force (night check 2026-10-08): the girls lose the old Chores view of past weeks; the parent money-board controls keep working from the parent screens; anything reachable only on Chores and not in the relocation map was kept and asked about.

## The work, one line per pull request

- 🟦 **Rev 1** — **PR 0-pre, 0-split, 0-A, 0-B, PR 1, Fix, PR 2, PR 3, fast one-test run, PR 4** — merged.
- 🟦 **Rev 1** — **PR 14 (now next)** Slowest tests set up their own data; each date's smoke test in 3 parts; every GitHub job under 5 minutes.
- **PR 5** Parent portal headers from the same table (D35); Reading size default (D14).
- **PR 6** Words and numbers: one money style, one date style, one kid name.
- **PRs 7–12** Components, one surface each: Today, Week/Day, Money and Sunday, Parent, Sister Sync and Profile, sheets.
- **PR 13** Clean-up and guards; history to the archive.

## Your stops

- 🟦 **Rev 1** — You merge every pull request.
- 🟦 **Rev 1** — iPad read of the build: after PR 6 and PR 13.
- 🟦 **Rev 1** — Any difference on a comparison page comes to you as a numbered question with a picture pair.

## ❓ Decisions

🟦 **Rev 1** — None open. Decided 2026-10-10: Stage 22 OK; test speed before PR 5; 3 parts per date; workers one per slow group, no dynamic workflow; PR 5 from main, not stacked; the setup update waits.

🟦 **Rev 1** — Checked against: test suite run time hotspot (round 3; the fast one-test change is inside it; the 2026-10-08 choice to stop splitting by repeats — this plan splits by groups that set up their own data, which is the way that choice kept for later); the 20-minute job history (cause fixed in PR 0-split); D16 (no full run on this PC: each part is checked alone here, the full set only on GitHub); ledger rows for Stages 41–42 (moved, wording kept); the last GitHub run on main: smoke jobs 6.5–8 minutes, picture job 3.5 minutes, other jobs under 1 minute.

🟦 **Rev 1** — Removes/consolidates: the order dependence between the slow groups and the rest of the smoke test (each slow group seeds its own data); the 8-minute smoke allowance in D20 and the test notes; the stack rule for PR 5 (D35 → D40).

## Out of scope

🟦 **Rev 1** — Money, XP and merge rules; stored data; new features; Track S (own plan); any change to what a check tests (only where and when it runs).

## Stages to finish

🟦 **Rev 1** — 46 stages: 26 build steps by Claude, then 20 checks by you (merges, iPad reads, the Chores ✓, header pictures, comparison pages). Stages 1–22 are done. The test speed work moves up as Stages 23–28 (one build stage became five, so the work can run side by side). Plan v9's Stages 23–40 keep their wording and move down by six.

1. PR 0-pre tap size and fixed test dates · Claude · Build· after: — · level: Complex · size: M · group: done · proof: the door measured 44 tall on the phone in both looks; GitHub green on four dates (done)
2. Merge PR 0-pre (Check) · You · Check · after: 1 · group: done · proof: merged (done)
3. PR 0-split short loop, test map and one smoke job per date · Claude · Build· after: 2 · level: Complex · size: M · group: done · proof: cause of the 20-minute job named and fixed; GitHub green on four dates (done)
4. Merge PR 0-split (Check) · You · Check · after: 3 · group: done · proof: merged (done)
5. PR 0-A picture test and references · Claude · Build· after: 4 · level: Complex · size: M · group: done · proof: two GitHub runs with 0 picture differences; a planted 1-pixel change caught (done)
6. Merge PR 0-A (Check) · You · Check · after: 5 · group: done · proof: merged (done)
7. PR 0-B feature list and records · Claude · Build· after: 6 · level: Complex · size: L · group: done · proof: every coverage phrase found or marked; GitHub green (done)
8. Merge PR 0-B (Check) · You · Check · after: 7 · group: done · proof: merged (done)
9. PR 1 money re-check, pocket-money note first · Claude · Build· after: 8 · level: Complex · size: L · group: done · proof: every brief check passes; difference page (done)
10. Merge PR 1, iPad read, money walk-through (Check) · You · Check · after: 9 · group: done · proof: merged; build read (done)
11. PR 2a Chores snapshot page · Claude · Build· after: 10 · level: Routine · size: S · group: done · proof: one page, every moved row at its new home (done)
12. Chores per-row ✓ (Check) · You · Check · after: 11 · group: done · proof: "all rows OK, go ahead" (done)
13. PR 2b retire the Chores screen · Claude · Build· after: 12 · level: Complex · size: M · group: done · proof: each moved row passes at its new home; GitHub green (done)
14. Merge PR 2 (Check) · You · Check · after: 13 · group: done · proof: merged (done)
15. PR 3 component kit, no visible change · Claude · Build· after: 14 · level: Complex · size: L · group: done · proof: 0 picture differences; GitHub green (done)
16. Merge PR 3 (Check) · You · Check · after: 15 · group: done · proof: merged (done)
17. Approve header pictures (Check) · You · Check · after: — · group: done · proof: your Claude Design package (done)
18. PR 4 headers, kid screens, badge note first · Claude · Build· after: 16, 17 · level: Complex · size: L · group: done · proof: one header per kid screen; comparison page with 15 differences; GitHub green (done)
19. Checkpoint report 1 · Claude · Build· after: 18 · level: Routine · size: S · group: done · proof: Quick read, measured part, one-test run went from 149 s to 33 s (done)
20. PR 4 fix round: rebuild the kid header from the exact values, smoke measurement check · Claude · Build· after: 18 · level: Complex · size: L · group: done · proof: measurement check green on four dates, red on three planted faults; CI green (done)
21. PR 4 fix round: comparison page again, reviewer, PR 4 updated · Claude · Build· after: 20 · level: Routine · size: S · group: done · proof: page with five iPad Pop pairs first; reviewer verdict; CI green (done)
22. Read the new comparison, merge PR 4, iPad read (Check) · You · Check · after: 21 · group: done · proof: your OK on 10 October; PR 4 merged; the build of 9 October is live (done)
23. 🟦 **Rev 1** — PR 14 measure where the smoke time goes, and prepare 3 parts · Claude · Build· after: 22 · level: Complex · size: M · group: W1 · tests: the short loop, each new part alone on this PC · proof: a table of time per check and setup per job from the last main run; the three slowest groups named; each moved to its own place with no change to what it checks; a part switch that GitHub accepts; the full list of checks across the 3 parts equals today's list, each once
24. 🟦 **Rev 1** — PR 14 group 1 (expected: the kid screens house-rules walk) sets up its own data · Claude · Build· after: 23 · level: Complex · size: M · group: W2 · tests: that group alone on this PC · proof: the group passes alone and inside its part; it fails on a planted fault it caught before; its time before and after
25. 🟦 **Rev 1** — PR 14 group 2 (expected: the parent screens house-rules walk) sets up its own data · Claude · Build· after: 23 · level: Complex · size: M · group: W2 · tests: that group alone on this PC · proof: the group passes alone and inside its part; it fails on a planted fault it caught before; its time before and after
26. 🟦 **Rev 1** — PR 14 group 3 (expected: the money screens checks) sets up its own data · Claude · Build· after: 23 · level: Complex · size: M · group: W2 · tests: that group alone on this PC · proof: the group passes alone and inside its part; it fails on a planted fault it caught before; its time before and after
27. 🟦 **Rev 1** — PR 14 parts on GitHub, one-test time, reviewer, pull request · Claude · Build· after: 24, 25, 26 · level: Complex · size: S · group: W3 · tests: two GitHub runs · proof: every GitHub job under 5 minutes on two runs; green on all four dates; each check ran exactly once across the 3 parts; the one-test run time in the pull request and the test notes; reviewer verdict
28. 🟦 **Rev 1** — Merge PR 14 (Check) · You · Check · after: 27 · group: X · proof: merged
29. PR 5 headers, parent portal from the exact values · Claude · Build· after: 28 · level: Complex · size: M · group: E · tests: the short loop, the measurement check with parent screens · proof: one purple bar on every parent screen, badge 44, buttons 44, 44 sub-bar when viewing a girl, all measured; Confirm all and Mark reviewed rows pass; Reading size defaults to 1.2; old parent top bar and month stepper gone; side-by-side page; GitHub green
30. Decide differences, merge PR 5 (Check) · You · Check · after: 29 · group: F · proof: page decided; PR 5 merged
31. PR 6 words and numbers · Claude · Build· after: 30 · level: Complex · size: L · group: G · proof: one Sunday per girl shows the same totals in the new format; money and Sunday tests pass; a planted local formatter fails the check
32. Merge PR 6, iPad read, one Sunday per girl (Check) · You · Check · after: 31 · group: H · proof: merged; build read; one Sunday per girl walked
33. PR 7 Today · Claude · Build· after: 32 · level: Complex · size: M · group: I · proof: old classes gone; Today rows pass; "with Mum" row readable in Calm; before-and-after page
34. Decide page, merge PR 7 (Check) · You · Check · after: 33 · group: J · proof: page decided; merged
35. PR 8 Week and Day · Claude · Build· after: 34 · level: Complex · size: M · group: K · proof: old classes gone; Week and Day rows pass; before-and-after page
36. Decide page, merge PR 8 (Check) · You · Check · after: 35 · group: L · proof: page decided; merged
37. PR 9 Money and Sunday · Claude · Build· after: 36 · level: Complex · size: L · group: M · proof: old classes gone; money rows and tests pass; before-and-after page
38. Decide page, merge PR 9 (Check) · You · Check · after: 37 · group: N · proof: page decided; merged
39. PR 10 Parent portal · Claude · Build· after: 38 · level: Complex · size: M · group: O · proof: old classes gone; parent rows pass; before-and-after page
40. Decide page, merge PR 10 (Check) · You · Check · after: 39 · group: P · proof: page decided; merged
41. PR 11 Sister Sync and Profile · Claude · Build· after: 40 · level: Complex · size: M · group: Q · proof: old classes gone; Sister Sync and Profile rows pass; before-and-after page
42. Decide page, merge PR 11 (Check) · You · Check · after: 41 · group: R · proof: page decided; merged
43. PR 12 sheets and dialogs · Claude · Build· after: 42 · level: Complex · size: L · group: S · proof: one sheet and one dialog style left; each of the 27 overlays opens and closes; before-and-after page
44. Decide page, merge PR 12 (Check) · You · Check · after: 43 · group: T · proof: page decided; merged
45. PR 13 clean-up and guards, history to the archive · Claude · Build· after: 44 · level: Complex · size: L · group: U · proof: each guard fails on a planted example; money and Sunday tests unchanged; GitHub green
46. Merge PR 13, iPad read (Check) · You · Check · after: 45 · group: V · proof: merged; build read on the iPad; the plan closes

## Technical details

**Measured baseline (CI run 38012172829 on `main` @ `4949e34`, 2026-10-09 7:11 PM MDT).** `checks` 20 s, `browser` 33 s, smoke 2026-10-01 7.0 min, 10-07 7.9 min, 10-11 6.4 min, 10-15 8.0 min, pictures 3.6 min. Smoke `timeout-minutes: 15`.

**Explore map (2026-10-10, local checkout).** `.github/workflows/ci.yml`: `smoke` job l.162, matrix of 4 dates l.173, `npm run test:smoke` with `SMOKE_DATE` l.220–223, artifacts `smoke-screenshots-<date>` l.228–235. `tests/smoke.js`: one 27,638-line async IIFE with one shared `page` (l.208); checks registered as `if (want('name')) checks.name = …`; `ALL_CHECKS` scraped at l.119–120; `SMOKE_ONLY` l.101, refused under `CI` l.122; per-check and setup timing written to `tests/out/smoke-ran-<date>.json` (l.27602–27624), read by `tools/smoke-times.js`. Sweep loops run before `want()` and are booked as "setup before X". Candidate slow groups: `kidScreensMeetTheHouseRules` (sweep l.5746–5798, result l.5806, about 119 s; depends on `SD_HELPERS_SRC` l.5739–5741 and `window.__mv2Snap` / `__sdSweepSnap`), `parentScreensMeetTheHouseRules` (l.5920), money: `noLabelIsCutOnTheMoneyScreens` (l.6161), `everyMoneyControlClicksClean` (l.27432, re-added l.27580), `meetingMoneyFlowEndToEnd` (l.6891). Others to time: `escapingHoldsOnEverySurface`, `thePopLookReadsEverywhere`, `theCalmLookReadsEverywhere`, `everyTextUsesTheLooksFonts`, `theLooksKeepTheSameBoxes`, `theMarkupSaysWhatThingsAre`, `everyControlHasAName`. `noConsoleErrors` (l.27586) runs last in every part.

**Stage 23 (opus-worker, `claude/consistency-14` from `main`).** Download the four `smoke-screenshots-*` artifacts of the run above (`gh run download 38012172829 -p 'smoke-screenshots-*' -D <scratch>`), run `tools/smoke-times.js <folder> 30`, write the table in the PR and `tests/README.md`. Add `SMOKE_PART=1|2|3` (allowed under `CI`, unlike `SMOKE_ONLY`): each check belongs to one part by a fixed list balanced on the measured times; the parts also gate the sweep loops that today run before `want()`. Move the three slowest groups into `tests/smoke-parts/<group>.js` (loaded by `tests/smoke.js`, sharing its page helpers) so Stages 24–26 edit different files. A test (`tests/smoke-parts.test.js` or a check in `npm run check`) fails when a check is in no part or in two parts. If the measured top three differ from the expected three, the worker takes the measured three and records it as a deviation.

**Stages 24–26 (three opus-workers at once, group W2).** Each edits only its own `tests/smoke-parts/<group>.js`. Worker 1 in the main checkout of `claude/consistency-14`; workers 2 and 3 in worktrees `git worktree add ../Weekly-Planner-w2b -b claude/consistency-14-g2` and `../Weekly-Planner-w2c -b claude/consistency-14-g3`, from Stage 23's head; the main session merges them back into `claude/consistency-14`. Each group seeds its own state (no reliance on `__mv2Snap`, `__sdSweepSnap` or earlier checks), runs with `SMOKE_ONLY=<group>` on this PC (`Task kind: test speed`), and plants one fault it caught before (then reverts).

**Stage 27 (opus-worker).** `ci.yml`: smoke matrix `date × part` (12 jobs), job name `Headless smoke test (<date>, part <n>)`, artifacts `smoke-screenshots-<date>-p<n>`; `tools/smoke-times.js` reads the new names. Branch run first (`gh workflow run ci.yml --ref claude/consistency-14`, background), then a second run; record every job time. Union of the 12 `smoke-ran-*.json` check lists equals `ALL_CHECKS` per date. One-test run time measured and written in the PR and `tests/README.md`. `reviewer` before the PR. Remove the "about 8 minutes, accepted" line from `tests/README.md` and FEATURES.md `## References`.

**Files per stage.** Stage 23: `tests/smoke.js`, `tests/smoke-parts/`, `tools/smoke-times.js`, `tests/README.md`, `package.json` (if a script is added); Stages 24–26: one `tests/smoke-parts/<group>.js` each; Stage 27: `.github/workflows/ci.yml`, `tools/smoke-times.js`, `tests/README.md`, `FEATURES.md`. Stage 29: `index.html`, `js/11-parent.js`, `js/33-parent-app.js`, `js/07-week-view.js`, `js/09-sheets.js`, `js/47-header.js`, `css/app.css`, `tests/smoke.js`, `tests/reference/`; Stage 31: `js/05-helpers.js`, `js/14-money.js`, `js/44-sunday.js`, `tests/check-money-words.js`; Stage 33: `js/31-today.js`, `css/app.css`, `tests/smoke.js`; Stage 35: `js/07-week-view.js`, `js/08-day-view.js`, `css/app.css`; Stage 37: `js/14-money.js`, `js/44-sunday.js`, `css/app.css`; Stage 39: `js/11-parent.js`, `js/32-parent-now.js`, `css/app.css`; Stage 41: `index.html`, `js/10-social.js`, `css/app.css`; Stage 43: `css/app.css`, `js/09-sheets.js`, `index.html`; Stage 45: `js/18-rules.js`, `tests/check-headers.js`, `package.json`, `docs/archive/`. Earlier stages: see `plans/consistency-plan-v9.md`.

**Branch and pull requests (D40).** PR 14 on `claude/consistency-14` from `main` @ `4949e34`. PR 5 branches from `main` after PR 14 merges; every later PR the same. No stacks. Bump `SW_VERSION` and `APP_BUILD` together only in PRs that change a shell file (PR 14 changes none). The approved plan file is committed with PR 14 as `plans/consistency-plan-v10.md`.

**Stage 29 — PR 5 (D35).** `.parent-bar` → `pageHeader({variant:'parent'})`; `.parent-banner` removed on Week, Day, Monthly; Monthly `.topbar` and parent `.week-nav` replaced and rules deleted; measurement check gains parent screens; D14 in `paApplyTextScale` (`js/33-parent-app.js`); `.cp-head`, `.ctr-head`, `.gu-head` lose card-as-header styling; header actions re-checked by hand (`check-dead-actions.js` cannot see generated `data-*`).

**Governance, every pull request (Plan v8 list, still in force, item 6 changed).** 1. Read `CLAUDE.md` and `ARCHITECTURE.md`; plan mode. The main session edits only `WORKING_RECORD.md`, `FEATURES.md`, `plans/` and reports in `docs/reports/`; every other file goes through a worker. The main session commits and pushes. 2. Tests (D16): short loop and the map's tests on this PC; GitHub green on the head commit before a PR opens or turns ready. 3. Bump `SW_VERSION` and `APP_BUILD` together in every PR that changes a shell file. 4. Regression table against `FEATURES.md`; record updated in the same turn. 5. Screens: iPad 1194×834 and phone 390×844, Pop and Calm. 6. No stacks (D40): each PR starts from `main` after the one before merges. 7. References never go stale; the difference page is the approval. 8. One session carries all stages; after each merge `## Where we are` and the restart line are pushed.

**Routing.** 23 opus-worker (Map: the Explore map above); 24–26 three opus-workers at once (`Task kind: test speed`, `Worktree:` and `Group: W2` lines for the second and third); 27 opus-worker then `reviewer`; 29 and every later Build opus-worker with an Explore map. Reviewer before every pull request and before done. No full `npm test` on this PC (D16). Workflow tool not used (D39).

**Record at approval.** Ledger: Stage 22 COMPLETE (owner OK 2026-10-10 in chat; PR #137 merged 2026-10-09 7:11 PM MDT; live `sw.js` `2026-10-09g` read 2026-10-10); old Stages 41–42 → SUPERSEDED by Stages 23–28; Stages 23–46 rows with this plan's wording. Design decisions: `[agreed] [in v10]` for D39 (search: every GitHub job under 5 minutes comes before PR 5), D40 (search: no stacks for the rest of this plan), 3 parts (search: 3 parts side by side). Setup update v3.2.10: branch exists with no pull request; owner opens it later.

**Later PRs (unchanged from Plan v8).** PR 6: 18 money formatters → `fmtMoney`, date and kid-name helpers, `check-money-words.js`, Day span form. PRs 7–12: one surface each to `.ui-*`, old classes deleted, references updated. PR 13: 7 unused functions, Sunday-branch money week, timer audit, guards in `npm run check`. Track S after PR 13.

**Risks.** The sweeps rely on snapshots left by earlier code; seeding them in each group may cost more time than it saves (Stage 23's table shows it before Stages 24–26 start). 12 smoke jobs use more GitHub runner minutes (each repeats `npm ci` and the browser install, about 1 minute, cached). A check that passed only because of an earlier check's state may fail in its own part; that is a found bug, fixed toward the check's intent and recorded.

**Done when, per stage.** 23: time table; three groups named and moved; part switch accepted under `CI`; every check in exactly one part (test fails on a planted missing check). 24–26: group passes alone and in its part; planted fault caught; time before and after. 27: every GitHub job under 5 minutes on two runs; green on four dates; union of checks equals today's list; one-test time written; reviewer ran; PR ready. 28: PR 14 merged. 29 PR 5: one purple bar on every parent screen with 44 badge, buttons and sub-bar, measured; Confirm all and Mark reviewed rows pass; Reading size defaults to 1.2; old parent top bar and month stepper gone; comparison page; GitHub green. 30: differences decided; PR 5 merged. 31 PR 6: one Sunday per girl shows the same totals in the new format; `sunday.test.js` and `money.test.js` pass; `check-money-words.js` fails on a planted formatter. 32: PR 6 merged; build read; one Sunday per girl walked. 33, 35, 37, 39, 41, 43 (PR 7–12): the surface's old classes gone; floors hold; its `FEATURES.md` rows pass; before-and-after page in both looks; references updated; GitHub green. 34, 36, 38, 40, 42, 44: page decided; that PR merged. 45 PR 13: each guard fails on a planted example; the 7 functions and the Sunday branch gone; timers audited; history archived; `Reviewer before done` written. 46: PR 13 merged; build read on the iPad; the plan closes.

**D38.** Proposal for hz-claude-config written in the record under Open questions.

Plan: 42 → 46 stages — the one test speed build stage is split into five (measure and prepare, three groups side by side, GitHub parts), so the work can run in parallel.

Agreed points: 30 of 30 in the plan.
