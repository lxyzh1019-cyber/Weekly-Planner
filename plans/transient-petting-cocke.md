# Plan v6 — Weekly-Planner consistency pass — Approved 2026-10-08

| Summary |
|---|
| 🟦 **Rev 1** — What changes for you: one header everywhere, one set of parts, one money and date style, Chores retired after your ✓, a picture test, slim records. New first: on this PC only the short test loop runs (under half a minute); on GitHub the full tests run as one job per date, about 8 minutes each, and the slow 7 October job is fixed. |
| What changed from the last version and why: splitting the tests into parts did not work. Parts after the first still failed on data left by earlier tests, and the gain was about 1 minute per job. Your choice B: the parts and their repeat-and-compare system are removed. Each date runs as one job again, about 8 minutes, and that is accepted for now. The short test loop, the test map and the time tool stay. A read-only check finds why the 7 October job took 20 minutes, and that is fixed. Making the slowest tests set up their own data (the way to get under 5 minutes) stays as Stages 38–39. |
| 🟦 **Rev 1** — What I need to do: approve Plan v6; merge PR 0-split first, then every pull request; iPad read after PR 1, PR 4, PR 6 and PR 13; tick the Chores rows; approve the header pictures before PR 4. Your choice B is in the plan. |

**Changes in this version** — Plan v6 · 🟦 Rev 1: what changed since Plan v5
```diff
+ 🟦 Rev 1 — What changes for you: one header everywhere, one set of parts, one money and date style, Chores retired after your ✓, a picture test, slim records. New first:…
+ 🟦 Rev 1 — What I need to do: approve Plan v6; merge PR 0-split first, then every pull request; iPad read after PR 1, PR 4, PR 6 and PR 13; tick the Chores rows; approve…
+ 🟦 Rev 1 — **D16** The full test suite never runs on this PC. Each change uses the short test loop: the fast checks plus the tests the test map names for that area. The f…
+ 🟦 Rev 1 — **D17** Retired in Plan v6 (replaced by D20): test parts that repeat the earlier tests that change data.
+ 🟦 Rev 1 — **D19** Retired in Plan v6 (replaced by D20): the part runner set the screen size and print view back to normal before every test; and the fallback after one m…
+ 🟦 Rev 1 — **D20** Stop splitting the smoke test by repeats; remove the repeat-and-compare system. One smoke job per date again, about 8 minutes accepted. Keep the short…
+ 🟦 Rev 1 — **PR 0-split** The short test loop on this PC, a test map for each area so a fix runs only its own tests, and the time tool. On GitHub the smoke test runs as o…
+ 🟦 Rev 1 — None open. The second GitHub run with parts failed again on carried data, and parts saved about 1 minute per job. You chose B: one job per date, parts removed…
+ 🟦 Rev 1 — Decided: pictures compared in the browser; unread builds fold into PR 1's iPad read; Reading size 1.2; full suite only on GitHub (D16); test parts repeat the e…
+ 🟦 Rev 1 — Checked against: hotspots pocket money, profile badge, Calm meaning (the new "with Mum" contrast finding belongs here), Sister Sync, smoke look checks (the 9:3…
+ 🟦 Rev 1 — Removes/consolidates: 9 headers → 1; 18 money formatters → 1; many part styles → one kit; 3 money lists → 1; Chores screen; 7 unused functions; the repeat-and-…
+ 🟦 Rev 1 — 39 stages: 19 build steps by Claude, then 20 checks by you (merges, iPad reads, the Chores ✓, header pictures). Stages 38 and 39 bring every GitHub job under 5…
+ 🟦 Rev 1 — PR 0-split short loop, test map and one smoke job per date · Claude · Build · files: smoke test, CI workflow, package scripts, test notes, rules text, feature…
+ 🟦 Rev 1 — PR 14 slowest tests set up their own data, smoke in parts under 5 minutes · Claude · Build · files: smoke test · after: 37 · level: Complex · size: M · group:…
- 🟦 Rev 1 — What changes for you: one header everywhere, one set of parts, one money and date style, Chores retired after your ✓, a picture test, slim records. New first:…
- 🟦 Rev 1 — What I need to do: approve Plan v5; merge PR 0-split first, then every pull request; iPad read after PR 1, PR 4, PR 6 and PR 13; tick the Chores rows; approve…
- 🟦 Rev 1 — **D16** The full test suite never runs on this PC. Each change uses the short test loop: the fast checks plus the tests the test map names for that area. The f…
- 🟦 Rev 1 — **D17** A test part repeats every earlier test that changes data and skips only earlier tests that only look. In the same GitHub run, a check proves each part…
- 🟦 Rev 1 — **D19** Before every test, the part runner sets the screen size and print view back to normal. A test that only changes those counts as look-only. A before-and…
- 🟦 Rev 1 — **PR 0-split** The smoke test runs in parts side by side on GitHub, each part under 5 minutes, for each of the four dates. A last check makes sure all parts to…
- 🟦 Rev 1 — None open. The time check failed in the build (301–322 seconds against about 200). You chose: screen size and print view back to normal before every test, then…
- 🟦 Rev 1 — Decided: pictures compared in the browser; unread builds fold into PR 1's iPad read; Reading size 1.2; full suite only on GitHub (D16); test parts repeat the e…
- 🟦 Rev 1 — Checked against: hotspots pocket money, profile badge, Calm meaning (the new "with Mum" contrast finding belongs here), Sister Sync, smoke look checks (the 9:3…
- 🟦 Rev 1 — Removes/consolidates: 9 headers → 1; 18 money formatters → 1; many part styles → one kit; 3 money lists → 1; Chores screen; 7 unused functions; one long smoke…
- 🟦 Rev 1 — 39 stages: 19 build steps by Claude, then 20 checks by you (merges, iPad reads, the Chores ✓, header pictures). Stages 38 and 39 happen only if the measuring r…
- 🟦 Rev 1 — PR 0-split test parts side by side and the short loop · Claude · Build · files: smoke test, CI workflow, package scripts, test notes, rules text, feature list…
- 🟦 Rev 1 — PR 14 slowest tests set up their own data, only if needed · Claude · Build · files: smoke test · after: 37 · level: Complex · size: M · group: A · proof: every…
+ 🟦 Rev 1 — 16 lines changed in Technical details
```

## Your decisions on record

- **D1** No full redesign. Fix the header, then consolidate components.
- **D2** Money format: "$3" for whole dollars, "$2.50" otherwise, everywhere. Negatives "−$3".
- **D3** Keep both the Print preview tab and the 🖨 Print button.
- **D4** Profile badge on every kid screen, money pages included.
- **D5** No emoji in screen titles. Headings may lead with one.
- **D6** Money re-check first, as one pull request.
- **D7** Chores retires after your per-row ✓.
- **D8** Track S (security) after this pass; until then no public link is shared.
- **D9** Checks at iPad 1194×834 and phone 390×844, both looks.
- **D10** Stage 0 first: PR 0-A, then PR 0-B.
- **D11** One session: this session carries Stage 0 and PRs 1–13.
- **D12** PR 4 waits for the approved Claude Design header pictures.
- **D13** Old history goes to the archive.
- **D14** Reading size default 1.2 when nothing is stored.
- **D15** PR 0-pre is its own pull request, merged before PR 0-A, with nothing else in it.
- 🟦 **Rev 1** — **D16** The full test suite never runs on this PC. Each change uses the short test loop: the fast checks plus the tests the test map names for that area. The full suite runs only on GitHub: one smoke job per date, about 8 minutes each, accepted until Stages 38–39 bring every job under 5 minutes. PR 0-split does this before any other build stage.
- 🟦 **Rev 1** — **D17** Retired in Plan v6 (replaced by D20): test parts that repeat the earlier tests that change data.
- **D18** The Calm "with Mum" chore text on Today, too pale to read, is fixed in PR 7 with a test row that shows it.
- 🟦 **Rev 1** — **D19** Retired in Plan v6 (replaced by D20): the part runner set the screen size and print view back to normal before every test; and the fallback after one measuring run, if start-up plus repeated tests was still over 200 seconds.
- 🟦 **Rev 1** — **D20** Stop splitting the smoke test by repeats; remove the repeat-and-compare system. One smoke job per date again, about 8 minutes accepted. Keep the short test loop, the test map and the time tool. A read-only check finds why the 7 October job took 20 minutes, and that is fixed. Stages 38–39 (slowest tests set up their own data) stay for later as the way under 5 minutes.

## The work, one line per pull request

- **PR 0-pre** (merged) Money door on Chores at least 44 tall on the phone, new build number; smoke tests on four fixed dates.
- 🟦 **Rev 1** — **PR 0-split** The short test loop on this PC, a test map for each area so a fix runs only its own tests, and the time tool. On GitHub the smoke test runs as one job per date (D20); the 7 October job is made as fast as the others. The rules text says: short loop on this PC, full suite on GitHub before the pull request opens.
- **PR 0-A** Picture test of every screen and state; a pixel compare in code shows only what differs. It runs as its own part on GitHub, split again if it takes over 5 minutes.
- **PR 0-B** Feature list by screen; each rule line names the money test that proves it; history to the archive.
- **PR 1** Money re-check (pocket-money note first).
- **PR 2** Chores: a) snapshot page for your per-row ✓; b) retire after the ✓.
- **PR 3** Component kit, no visible change: pixel-identical to the PR 0-A references.
- **PR 4** Headers, kid screens (badge note first).
- **PR 5** Headers, parent portal: one purple bar; Reading size default (D14).
- **PR 6** Words and numbers: one money style, one date style, one kid name.
- **PRs 7–12** Components, one surface each: Today, Week/Day, Money and Sunday, Parent, Sister Sync and Profile, sheets.
- **PR 13** Clean-up and guards; history comments to the archive.

## Your stops

- You merge every pull request.
- iPad read of the build: after PR 1, PR 4, PR 6 and PR 13.
- Approvals: Chores per-row ✓; header pictures before PR 4; every difference from an approved picture, side by side.

## ❓ Decisions

🟦 **Rev 1** — None open. The second GitHub run with parts failed again on carried data, and parts saved about 1 minute per job. You chose B: one job per date, parts removed (D20).

🟦 **Rev 1** — Decided: pictures compared in the browser; unread builds fold into PR 1's iPad read; Reading size 1.2; full suite only on GitHub (D16); test parts repeat the earlier tests that change data (D17, you: yes, 2026-10-08); the Calm "with Mum" text on Today is fixed in PR 7 with a test row that shows it (D18, you: yes, 2026-10-08); D17 and D19 retired; one smoke job per date, about 8 minutes, slowest tests set up their own data later (D20, you: B, 2026-10-08).

🟦 **Rev 1** — Checked against: hotspots pocket money, profile badge, Calm meaning (the new "with Mum" contrast finding belongs here), Sister Sync, smoke look checks (the 9:30 Today pin), test suite run time (round 3, at its limit, 1 recurrence: parts broke on order, then on carried data twice; compared again before this version: repair, rewrite the tests, or step back; step back chosen); ledger 42, 70, 113–131; open question 7.

🟦 **Rev 1** — Removes/consolidates: 9 headers → 1; 18 money formatters → 1; many part styles → one kit; 3 money lists → 1; Chores screen; 7 unused functions; the repeat-and-compare part system (never merged) removed; "full suite before every push" → short loop before a push, full suite on GitHub before the pull request.

## Out of scope

Money, XP and merge rules; stored data; new features; Track S (own plan).

## Stages to finish

🟦 **Rev 1** — 39 stages: 19 build steps by Claude, then 20 checks by you (merges, iPad reads, the Chores ✓, header pictures). Stages 38 and 39 bring every GitHub job under 5 minutes, after PR 13.

1. PR 0-pre tap size and fixed test dates · Claude · Build · opus-worker, Complex · size: M · proof: the door measured 44 tall on the phone in both looks; GitHub green on four dates (done)
2. Merge PR 0-pre · You · Check
3. 🟦 **Rev 1** — PR 0-split short loop, test map and one smoke job per date · Claude · Build · files: smoke test, CI workflow, package scripts, test notes, rules text, feature list references · after: 2 · level: Complex · size: M · group: A · proof: the cause of the 20-minute 7 October job named and fixed; two GitHub runs green on all four dates with each job time listed and every smoke job under 10 minutes; no part or repeat code left; the short loop measured under 3 minutes on this PC
4. Merge PR 0-split · You · Check
5. PR 0-A picture test and references · Claude · Build · opus-worker, Complex · size: M · proof: two GitHub runs with 0 picture differences; a planted 1-pixel change caught; picture job under 5 minutes
6. Merge PR 0-A · You · Check
7. PR 0-B feature list and records · Claude · Build · sonnet-worker, Routine + opus-worker, Complex · size: L · proof: every coverage phrase found or marked; every rule marked; GitHub green
8. Merge PR 0-B · You · Check
9. PR 1 money re-check, pocket-money note first · Claude · Build · opus-worker, Complex · size: L · proof: every brief check passes; undoing fix 1 or 2 makes the checks fail; picture differences shown on one page
10. Merge PR 1, iPad read, money walk-through · You · Check
11. PR 2a Chores snapshot page · Claude · Build · sonnet-worker, Routine · size: S · proof: one page with the Chores screen for 3 users, 2 sizes, 2 looks and every moved row at its new home
12. Chores per-row ✓ · You · Check
13. PR 2b retire the Chores screen · Claude · Build · opus-worker, Complex · size: M · proof: each moved row has a passing check at its new home; no link to the old screen; GitHub green
14. Merge PR 2 · You · Check
15. PR 3 component kit, no visible change · Claude · Build · opus-worker, Complex · size: L · proof: 0 picture differences; new unit tests pass; GitHub green
16. Merge PR 3 · You · Check
17. Approve header pictures · You · Check
18. PR 4 headers, kid screens, badge note first · Claude · Build · opus-worker, Complex · size: L · proof: one header per kid screen, same height per kind; side-by-side page against the approved pictures; GitHub green
19. Decide differences, merge PR 4, iPad read · You · Check
20. PR 5 headers, parent portal · Claude · Build · opus-worker, Complex · size: M · proof: one purple bar on every parent screen; Confirm all and Mark reviewed checks pass; side-by-side page
21. Decide differences, merge PR 5 · You · Check
22. PR 6 words and numbers · Claude · Build · opus-worker, Complex · size: L · proof: one Sunday per girl shows the same totals in the new format; money and Sunday tests pass; a planted local formatter fails the check
23. Merge PR 6, iPad read, one Sunday per girl · You · Check
24. PR 7 Today · Claude · Build · opus-worker, Complex · size: M · proof: old classes gone; Today's feature rows pass; the "with Mum" chore row readable in Calm, shown by a test row; before/after page in both looks
25. Decide page, merge PR 7 · You · Check
26. PR 8 Week and Day · Claude · Build · opus-worker, Complex · size: M · proof: old classes gone; Week and Day feature rows pass; before/after page in both looks
27. Decide page, merge PR 8 · You · Check
28. PR 9 Money and Sunday · Claude · Build · opus-worker, Complex · size: L · proof: old classes gone; money feature rows and money tests pass; before/after page in both looks
29. Decide page, merge PR 9 · You · Check
30. PR 10 Parent portal · Claude · Build · opus-worker, Complex · size: M · proof: old classes gone; parent feature rows pass; before/after page in both looks
31. Decide page, merge PR 10 · You · Check
32. PR 11 Sister Sync and Profile · Claude · Build · opus-worker, Complex · size: M · proof: old classes gone; Sister Sync and Profile feature rows pass; before/after page in both looks
33. Decide page, merge PR 11 · You · Check
34. PR 12 sheets and dialogs · Claude · Build · opus-worker, Complex · size: L · proof: one sheet and one dialog style left; each of the 27 overlays opens and closes; before/after page in both looks
35. Decide page, merge PR 12 · You · Check
36. PR 13 clean-up and guards, history to the archive · Claude · Build · opus-worker, Complex · size: L · proof: each guard fails on a planted example; money and Sunday tests unchanged; GitHub green
37. Merge PR 13, iPad read · You · Check
38. 🟦 **Rev 1** — PR 14 slowest tests set up their own data, smoke in parts under 5 minutes · Claude · Build · files: smoke test · after: 37 · level: Complex · size: M · group: A · proof: every GitHub job under 5 minutes; all parts green on all four dates; no difference at any part start
39. Merge PR 14 · You · Check

## Technical details

### PR 0-split — Test parts side by side and the short loop (owner instruction, 2026-10-07)

- Found: the worker's full local `npm test` on the rebased PR 0-A branch was stopped at 30 minutes (exit 124) inside the picture compare; every suite before it passed. CI run 37671279692 (PR 0-pre): unit job 27 s; smoke legs 2026-10-15 7 m 46 s, 2026-10-11 8 m 41 s, 2026-10-01 7 m 37 s, 2026-10-07 19 m 59 s. `tests/smoke.js` is one 27,285-line process; `ALL_CHECKS` is built from the `checks.<name> =` lines; `SMOKE_ONLY` runs a subset locally and is refused under `CI`.
- Explore first (Map): which checks share browser state or seeded data with earlier checks (order dependence), the setup each check needs, and the time each check takes on CI (from one timing run with per-check durations printed).
- Change in `tests/smoke.js`: `SMOKE_PART=k/n` runs a fixed, balanced share of `ALL_CHECKS` (balanced by the measured CI times, kept in a small saved list in `tests/`; a new check not in the list goes to the part with the least time). Allowed under `CI` (unlike `SMOKE_ONLY`). Order-dependent checks stay together in one part. Each part writes the names it ran and passed to `tests/out/smoke-ran-<date>-<k>.txt` and prints its time.
- `.github/workflows/ci.yml`: the smoke job's matrix becomes date × part (n chosen from the measurement so each job, setup included, is under 5 minutes; expected 3 or 4); the browser cache stays; `fail-fast: false`. A last job `Smoke coverage` downloads every part's list and fails when a check in `ALL_CHECKS` is missing or ran twice for a date. Artifact names carry date and part (upload-artifact refuses duplicates). Each job keeps `timeout-minutes`. The cleanup, XP and money calibration steps move to the unit job if they need no browser, else to part 1 only.
- `tests/check-ci-scripts.js` still passes; it learns that `test:smoke` runs as parts plus the coverage job.
- Short loop: `npm run test:fast` = `npm run check` plus the unit suites (merge, buffers, stream, cleanup if no browser, xp, money, sunday); target under 3 minutes on this PC. `npm test` stays the full chain for GitHub and for anyone who asks for it; it is never run on this PC by the workers.
- Test map: `FEATURES.md` `## References` gets `Tests: <area or files> → <tests it needs>` lines (static checks, unit suites, `SMOKE_ONLY=<checks>` lists per screen area), so a fix runs only its own tests.
- Rules text: `ARCHITECTURE.md` "Verification — run all three before any push" and "The full suite gates every push" become: before a push, the short loop plus the map's tests; before a pull request opens, the full suite green on GitHub (every part plus the coverage job). `tests/README.md` says the same and shows `SMOKE_PART`. The worker instructions' "full suite once per stage" is met by the GitHub run.
- No app file changes, so no `SW_VERSION`/`APP_BUILD` bump. Branch `claude/consistency-split` from `main` @ `b21b71a`.
- Planted proofs: remove one check from the saved list's coverage (or skip it in one part) → the coverage job fails; restore → green.

**Plan v4 — what the first two workers found, and the replay design (D17).**
- Built so far on `claude/consistency-split` @ `1ee3113` (pushed, no PR): `SMOKE_PART=k/n` with contiguous parts in file order that stop at `PART_DONE` (`tests/smoke-parts.js`), per-check and setup timing, `tests/smoke-times.json` + `tools/smoke-times.js`, `tests/smoke-coverage.js` (missing / failed / doubled / unreported part / 240 s wall limit / named crashes / seam compare), CI matrix date × 4 parts, `test:xp`/`test:money` moved to the checks job, own cleanup job, `test:fast` (28 s on this PC, worker 1), `check-ci-scripts.js` rules, rules text, 17 `Tests:` lines. Fixed: part 4 crash (`#paSchoolStart` only drawn by an earlier body; `paRenderSchool()` in setup before `schoolHoursReconcileTheCardsAlreadyPlaced`).
- Runs: 37724453227 (full, timing) all green; 37725190228 (checks dealt by time) parts 2–4 crashed on order; 37725586130 and 37727046148 (contiguous, n=4): every job 2:47–4:06, part walls 134–208 s; parts 2–4 fail: `todayMoneyRowMatchesMyMoney`, `todayShowsWhatAChoreWouldPay`, `sundayPaydayAddsUp` (2026-10-11), `theReflectionIsHerAnswer`, `theNotDoneMarkerSurvivesEveryCardHeight`, `theCalmLookReadsEverywhere` (2026-10-07). The seam capture shows 55–130 differing keys per seam (`moneyRules`, wallets, ledgers, weeks, `mnyKid`, `weekView`, localStorage …).
- Cause: check bodies are not self-contained; across hundreds of checks they leave data that later checks read. Skipping earlier bodies gives a part different data from the long run. Patching each later check (worker 2's option 1) leaves the parts testing different data; a strict zero-difference seam by restoring state in every body (option 2) is a multi-stage rewrite of the suite.
- Design (reviewer before the plan: 11 problems, all folded in below). Stage 3 runs as two worker hand-overs in this order; the second starts only after the first's gate passes. **3a — replay, seam proof, time gate. 3b — short loop, test map and text** (mostly built; rewording only).
- 3a step 1, noise first: two captures of the same state in the same run, and the same part in two runs, give 0 seam differences. If not, `want()` resets the clock to a fixed time per check (test-only) instead of adding exclusions to the capture. The 55–130 keys may partly be clock noise.
- 3a step 2, classify: every part run records, for each check it runs, whether its body changed the seam capture (before/after). A check is a **reader** only if it changed nothing in every all-green run so far, on every date, AND a static scan of its body finds no assignment to an outer variable and no `route`/`addInitScript`/`on(`/`newContext`/`newPage`/`emulateMedia`/`setViewportSize`. Everything else, and any check whose body hash changed since it was classified, is a **writer** (safe default). The lists (with body hashes) live in `tests/smoke-times.json` and are refreshed from normal CI runs by `tools/smoke-times.js`; no long run is needed. `together` is dropped: a later check that relies on an earlier one makes the earlier one a writer (marked in code).
- 3a step 3, replay: a part runs setup, every writer body before its range **without recording its result** (a throw or console error there fails the part as "replay of X failed"), skips reader bodies before its range, runs its own range in full and stops at `PART_DONE`. Parts are balanced on replayed writer time plus own time.
- 3a step 4, chain seam (no stored reference): coverage compares part k's `seamStart` with part k−1's `seamEnd` at the same check, same run and commit; part 1 starts at the real start, so by induction every part starts where one long run would be. Strict: any difference fails and names the key. Nothing goes stale when later PRs change the app.
- 3a time gate, measured before any balancing work: W = writer seconds per date. Go on only if setup (without the house-rules audit precompute, `tests/smoke.js` 5780–5831 and 5858–5952, about 90 s, which then moves behind its own checks) + W + the slowest reader range ≤ about 200 s wall (job under 5 minutes). If the gate fails, stop and show the owner the measured W with two choices (❓ Decision 1): allow those jobs a little over 5 minutes, or a new stage where the slowest writer checks set up their own data. n is then chosen from measured job times (n=5 allowed; extra jobs queue).
- The 6 failing checks are expected to pass once parts start from the long run's data; any that still fail are real and are fixed in this PR (test-only) or reported. The Calm "with Mum" contrast (`screen-today .td-row-go` 3.31:1, `#8078df` on `#eef2f9`, at 390 and 1194) is an app defect → D18: fixed in PR 7 (Today); the smoke seed gets a "with Mum" chore row on Today so the Calm look check sees it in every run.
**Plan v5 — the time gate failed, and the view reset (D19).**
- 3a worker 2026-10-08, commit `8d20f46` on `claude/consistency-split`: `tests/smoke-parts.js` gains `mask`, `checkBodies` (sha1 per body) and `staticWriters`; new `tools/smoke-gate.js <artifact folder>` prints writers, setup with/without the audit precompute, W and the gate per date. `test:fast` 145/0. From CI run 37727046148: 454 checks, 20 static writers; setup 124–129 s (audit precompute 91–92 s); static W 175–193 s, 266–285 s with the audit checks as writers; setup without audit + W = 301–322 s against ~200 s. Largest: `noLabelIsCutOnTheMoneyScreens` 69–84 s (`setViewportSize`), `everyTextUsesTheLooksFonts` 34–41 s, `theCalmLookReadsEverywhere` / `thePopLookReadsEverywhere` 19–25 s, `printIgnoresTheLook` (`emulateMedia`), `theLookSurvivesAReload` (`newContext`).
- Change to D17's static rule: `setViewportSize` and `emulateMedia` no longer make a body a writer by themselves. Before every check body (replayed or own), the part runner calls one reset that sets the default viewport of the test context and `emulateMedia({ media: 'screen', colorScheme, reducedMotion })` back to the suite's defaults; the long run (no `SMOKE_PART`) calls the same reset, so parts and the long run stay identical. The seam capture adds the print media type next to `view.size`, `view.dark` and `view.reducedMotion`. `route`, `addInitScript`, `on(`, `newContext`, `newPage` and outer-variable writes stay static writers. The audit precompute moves behind its own checks; with the reset its viewport changes no longer make those checks writers.
- Then 3a steps 1–4 as below (noise, seam classes, replay, chain seam). Gate measured with `tools/smoke-gate.js` on the first CI run after the reset: if setup + W + slowest reader range ≤ ~200 s, balance and finish under 5 minutes per job. If not: parts balanced as well as possible, each smoke job's `timeout-minutes` raised to fit, the measured longest job written in the record, and Stages 38–39 kept: the slowest writers set up and restore their own data (PR 14). Hotspot "Test suite run time" counts that fallback as a 2nd workaround.
- Risk: the seam does not see DOM or listener changes outside saved state; a check that leaves those is still caught when a later check in a part fails, and the chain seam names state differences only.

- Text: rules text, `tests/README.md`, `FEATURES.md` describe the replay design; the "contiguous, skip everything before" wording goes; the view reset (D19) is described too.

🟦 **Rev 1** — **Plan v6 — back to one smoke job per date (D20).** The D17 and D19 sections above are retired and kept only as history.
- 🟦 **Rev 1** — Why: run 37788688047 on `8b90e39` (n=2): part 1 green on all four dates; part 2 failed on all four (`replay of anEmptyDayDrawsItsInviteGhost failed`, ghost buttons covered by `missionClearSub`); coverage found 44 seam differences between part 1 and part 2. Part walls 353–423 s, jobs 6:39–7:46, against 7:37–8:41 for one job per date before (2026-10-07: 19:59). The reviewer (Stuck moment) found 5 more problems in the replay code.
- 🟦 **Rev 1** — Explore first (read-only): why the 2026-10-07 smoke job took 19:59 in run 37671279692 when the other dates took 7:37–8:41 (per-check times from run 37724453227 and the timing artifacts). The fix is test-only.
- 🟦 **Rev 1** — Build on a fresh branch from `main` (the old `claude/consistency-split` stays as it is, not merged). Bring over only: `test:fast` and its package script, per-check and setup timing printed by `tests/smoke.js` with `tools/smoke-times.js` (the time tool for Stage 38), `test:xp`/`test:money` in the checks job and the own cleanup job if they still help, `check-ci-scripts.js` rules for the new scripts, the `Tests:` and `Tools:` lines in `FEATURES.md`, and the rules text. Leave out: `SMOKE_PART`, `tests/smoke-parts.js`, `tests/smoke-coverage.js`, `tools/smoke-gate.js`, the replay, seam capture, view reset, async `want()`, the parts matrix and the coverage job.
- 🟦 **Rev 1** — `.github/workflows/ci.yml`: smoke matrix by date only, as on `main`; `timeout-minutes` kept with room over the measured job time.
- 🟦 **Rev 1** — Text: `ARCHITECTURE.md`, `tests/README.md` and `FEATURES.md` say: short loop locally, full suite on GitHub (one smoke job per date, about 8 minutes, until Stage 38).

### PR 0-A follow-up after PR 0-split

- The rebased branch is `claude/consistency-0a-rebase` (from `main` @ `b21b71a`, HEAD `25e284f`; pushed). The record and plan files stay on `claude/consistency-0a` until PR 0-A opens. After PR 0-split merges, the rebased branch is rebased onto `main` again.
- 🟦 **Rev 1** — The picture test moves out of the smoke 2026-10-07 leg into its own job (one fixed clock, Wed 2026-10-07 12:00 Edmonton). If that job takes over 5 minutes, it is split by state with `PICTURES_PART=k/n` (picture states do not depend on each other), each part uploading `pictures-<k>`; a last step checks every state was shot once.
- Local picture runs on this PC are not done (the compare against Linux references re-shoots almost every picture and is slow); only GitHub gates.

### PR 0-pre — Tap size and fixed test dates (merged as `d3bdc71`, PR #122)

- Found: CI on `main` and on `claude/consistency-0a` failed `kidScreensMeetTheHouseRules` since 7 Oct: `screen-chore@390: 1 target(s) under 44px: mv2-door ct-money-door@148x36` (156x36 in Calm). The door is `ctMoneyDoor` (`js/13-chores.js`; drawn by the old board's `ctRenderMoneyCard` and under the kid tab in `js/26-chore-kid.js`, PR #118).
- Change: the 💰 money door on the Chores screen (`.ct-money-card .mv2-door`) is at least 44px tall at 390×844 in Pop and Calm; other `.mv2-door`s unchanged. `SW_VERSION` and `APP_BUILD` bumped together.
- Smoke on fixed dates (`SMOKE_DATE`, default 2026-10-07) and the CI matrix 2026-10-15 / 10-11 / 10-01 / 10-07.
- Cause of 7 Oct written in the PR and the record.

### Moved from the everyday part (full wording)

- Explore runs before every Complex stage; the reviewer runs before every pull request and before done. Each branch starts from `main` after the previous merge.
- D4 detail: avatar only on money pages; the date hides at ≤699px. D12: 4 variants (standard, money, meeting, parent), both sizes, both looks; references for PR 4 and PR 5. D13 replaces PR 13's old "history into the record" item.
- Checked against, in full: pocket money 7 / 2 / 1 (PRs 1, 6, 9 and 13 count inside round 8 unless a new symptom appears); profile badge 2 / 0 / 1; Looks–Calm meaning (PR 3 tokens: one value never carries both decoration and meaning); Sister Sync invites, 6 rounds (PR 4 and PR 11 touch Sync's header and headings only, no invite logic); smoke look checks 1 / 0 / 0 (the 9:30 pin is installed per check, so it holds in any part); test suite run time 1 / 0 / 0 / 1 workaround (the date matrix runs the whole smoke four times — PR 0-split replaces that with parts); ledger 42 (Chores waits for the ✓), 70 (one text scale, open; overlaps PR 1), 113–128 (money decisions 1–16; decision 7 "rest of app later" is this pass); no history for the component kit.
- Removes/consolidates, in full: 9 header patterns → 1 header, 4 variants; 18 money formatters → 1; 4 kid-name helpers → 1; 72 button classes → 4; 51 chip classes → 2; 11 tab systems → 1; 25 card classes → 1 card + 1 section head; 13 sheet styles → 1 sheet + 1 dialog; 3 hand-kept money lists → 1 marker; 3 hard-coded back routes → 1 return stack; the Chores screen; 7 unused functions; the Sunday branch of the money week; 8 old documents and the history comments → archive; one long smoke job per date → parts plus one coverage job; the picture steps riding on the 2026-10-07 smoke leg → their own job.
- Out of scope, in full: new features except PR 1's money fixes as in the brief; typed-in hex colours (burned down only where a PR 7–12 surface already touches them); inline click handlers and the action systems; sub-13px fonts outside the surfaces touched (the PR 13 guard covers new ones). Track S after PR 13 as its own plan.

### Sources and where they are saved

- Authoritative: `app-consistency-plan-v2-source.md` (D1–D13, Stage 0, PRs 1–13, stops, content ledger). Detail: `app-consistency-plan-v1.md` (PR detail), `money-recheck-brief-rev1.md` (PR 1), `header-system-plan.md` (PR 3–5), `consistency-pass-plan.md` (findings, PR 6–13). All five are in `D:\User\Heng Z\Downloads\wp-consistency\wp-consistency\`.
- PR 0-A: `sonnet-worker` copies the five files into `docs/handoff/consistency/`. The approved plan files (`plans/pasted-content-id-1cd8-weekly-planner-c-partitioned-pebble.md` for v1–v2, `plans/soft-singing-moth.md` for v3) are committed with the work.
- The original money brief dated 2026-10-06 (fixes 1–6 with their "Done when" lines) is not in the folder; PR 1's check list below is the v1 list plus the brief's first revision. If the owner has the original, it joins `docs/handoff/consistency/` in PR 0-A.
- 🟦 **Rev 1** — Ledger rows at approval: `Weekly-Planner consistency pass · Stage <k> of 39 — <stage>` (Plan v5: "of 37" became "of 39"; Plan v6 renames Stages 3 and 38; Stages 1 and 2 stay COMPLETE).

### Governance, every pull request

1. Read `CLAUDE.md` and `ARCHITECTURE.md`; report the rules version and the branch. Plan mode. The main session edits only `WORKING_RECORD.md`, `FEATURES.md` and `plans/`; every other file (source, tests, `docs/`, `.github/`, file moves) goes through `opus-worker` or `sonnet-worker` (routing below). The main session commits and pushes the branch.
2. 🟦 **Rev 1** — Tests (D16): on this PC only the short loop (`npm run test:fast`) plus the tests the map names for the change; never the full `npm test`. Before the pull request opens, GitHub runs the full suite: the unit job, the smoke job on all four dates and (from PR 0-A) the picture job — all green. Smoke jobs about 8 minutes are accepted until Stage 38 (D20); any other job stays under 5 minutes.
3. Bump `SW_VERSION` (`sw.js`) and `APP_BUILD` (`js/01-config.js`) together in every PR that changes a shell file (PR 0-pre, then PR 1 onwards). PR 0-split, PR 0-A and PR 0-B change no app file, so no bump (`tests/check-sw-shell.js` enforces the bump only on shell changes). PR 3 adds `js/47-header.js` to the `SHELL` list in `sw.js` (`check-sw-shell.js`).
4. Regression table against `FEATURES.md`; `WORKING_RECORD.md` updated (request ledger, hotspot counter, deliverable ledger) in the same turn.
5. Screens: iPad 1194×834 and phone 390×844, Pop and Calm. Smoke screenshots go to `tests/out/` (CI artifact) and are linked in the PR. Picture-test references live in `tests/reference/`.
6. No stacked branches: each branch starts from `main` after the previous merge (`git merge-base` confirmed), so `check-sw-shell.js` compares against the right base. The PR 0-A branch is rebased onto `main` after PR 0-split merges, not restarted. Pull requests open last and ready for review, after the reviewer; never as drafts.
7. References never go stale: every PR that changes the look updates `tests/reference/` on its own branch; the difference page is the approval (picture pairs numbered like `❓ Decisions`).
8. Session: one session carries all 39 stages. From 1.5 M tokens the remaining stages go to fresh workers and the main session reads only short reports; after each merge `## Where we are` and the restart line are pushed.

### Routing

| Stage | Helper | Level | Why |
|---|---|---|---|
| PR 0-pre | opus-worker | Complex | Done |
| PR 0-split | opus-worker | Complex | `.github/workflows/ci.yml`, `package.json`, `tests/smoke.js` part selection, order dependence between checks, `check-ci-scripts.js`; Explore map first |
| PR 0-A | opus-worker | Complex | New test harness (`tests/pictures.js`), fixture data and fixed clock, `package.json` script, `.github/workflows/ci.yml` job; `sonnet-worker` (Routine) copies the five source files |
| PR 0-B | sonnet-worker (parallel workers for the audit) + opus-worker | Routine + Complex | Sonnet: coverage list, by-screen proofs, `git mv` moves, record slimming edits outside the two record files. Opus: `ARCHITECTURE.md` `checked by <script>` / `text only` marks (needs each script read). Main session: `WORKING_RECORD.md` and `FEATURES.md` edits |
| PR 1 | opus-worker | Complex | Money |
| PR 2a | sonnet-worker | Routine | One-off output: a run of the picture test into `tests/out/` plus the comparison page; no references, no new script, no `package.json` or `ci.yml` change |
| PR 2b | opus-worker | Complex | Refactoring: remove a screen, port 21 smoke checks |
| PR 3 | opus-worker | Complex | Design: component kit, tokens, header builder, new classic script, `sw.js` SHELL |
| PR 4 | opus-worker | Complex | Refactoring, profile-badge hotspot, one navigation stack |
| PR 5 | opus-worker | Complex | Parent portal, money-critical actions, Reading-size setting |
| PR 6 | opus-worker | Complex | Money formatting across 18 formatters, deletions |
| PR 7–12 | opus-worker | Complex | Refactoring, one surface each (PR 9 is money) |
| PR 13 | opus-worker | Complex | Deletions, live money-week code, guards in `npm run check`, `package.json` |

- Before every Complex stage, `Explore` (reads only) returns the `Map:` of files and lines; the hand-over carries it.
- `reviewer` runs before every pull request and before done (`Reviewer before done (Weekly-Planner consistency pass): <verdict>` in `## Where we are`); on any `Stuck:`.
- `sonnet-worker` gets two tries, then `opus-worker` with `Escalated from sonnet-worker: <reason>`. It never touches `sw.js`, `package.json`, `.github/`, Firebase or schema files.
- Worker instructions: `~/.cache/hz-rules/<version>/agents/opus-worker-instructions.md` and `sonnet-worker-instructions.md` (session start names the version; 3.2.0 today). Every hand-over says: no full `npm test` on this PC (D16).

### The three decisions (decided 2026-10-06), detail

1. **Picture compare.** `playwright-core` cannot read PNGs. Decided (owner, 2026-10-06): compare inside the browser with a canvas — the test loads the reference PNG and the fresh screenshot into two `<canvas>` elements in the test page and diffs pixel data; no new dependency. Not chosen: `pngjs` + `pixelmatch`.
2. **Money fit and logic, Stage 13.** Decided (owner, 2026-10-06): mark Stage 13 SUPERSEDED by this plan's Stage 10 (PR 1's iPad read plus that walk). `#119` merged to `main` as `8ef4eeb`.
3. **D14 Reading size.** Open question 7 in the record: the parent Reading size default is 1 vs 1.2 when nothing is stored. Decided (owner, 2026-10-06): 1.2 (D14), built in PR 5. It visibly changes parent text size on every parent screen on a device with nothing stored.

### Hotspot notes (recorded before the first edit)

- **Test suite run time — round 1 (before PR 0-split).** Row added 2026-10-07: 1 fix round, 1 workaround (the date matrix repeats the whole smoke four times). Structural fix, not a patch: parts side by side with one coverage job that makes a skipped check impossible to miss.
- **Pocket money — round 8 (before PR 1).** Counter: 7 → 8 fix rounds; recurrences 2, regressions 1 unchanged. One pass = one round: PRs 6, 9 and 13 also touch pocket-money display and count inside round 8 unless a new symptom appears (then a new row entry). Expected verdict: repair, because the cause is duplicated logic (three places divide by steady, three hand-kept root lists), not the model. Structural part: `sdCommitPlan` as the one source of the commitment share and its `over` threshold; one `data-money-surface` attribute instead of lists. The "rewrite-vs-repair reviewed?" cell gets `yes <date>` with the note.
- **Profile badge — round 3 (before PR 4).** Counter: 2 → 3 fix rounds; regressions 1 unchanged. Shared cause across rounds 1–3: the badge is placed by hand in each top bar. Expected verdict: repair with structure — the badge becomes one slot of `pageHeader`, always far right, `profileBadgeText` stays the one text source; the Day-bar special sizing (`.profile-badge--parent`) retires when Day uses the same header. Cell updated the same way.

### PR detail

**PR 0-A — Picture test and references (no app change).**
- `tests/pictures.js` (playwright-core 1.62.1, already a dev dependency) opens every screen **and state** for Jenn, Jess and Parent where it differs by user, at 1194×834 and 390×844, in Pop and Calm, with fixed fixture data and a fixed clock. The list is built from the PR 1–12 surfaces: the 13 screens, every tab (Week view tabs, money tabs My money · Money school, All my Sundays, By month, parent tabs), the overlays `#sundayOverlay`, `#grownupsOverlay`, `#requestOverlay`, `#pnToldOverlay`, the Parent › Now cards, each meeting step, and every sheet and dialog. Pictures: `tests/reference/<screen-or-state>-<user>-<ipad|phone>-<pop|calm>.png`.
- Stability: references are made and compared only on the CI Linux runner with the pinned browser; the test waits for `document.fonts.ready`; animations and transitions off (`prefers-reduced-motion` plus a test stylesheet). A local run reports but does not gate.
- Pixel compare in code with a small tolerance (decision 1: canvas in the browser); prints only the pictures that differ. `package.json` gets `test:pictures`, wired into `npm test`; `.github/workflows/ci.yml` runs it in its own job (split by state if over 5 minutes) — `tests/check-ci-scripts.js` requires a step per `test:*` script.
- `sonnet-worker` copies the five source files into `docs/handoff/consistency/`; the approved plan files are committed with this PR.
- Already built and rebased onto `main` @ `b21b71a` as `claude/consistency-0a-rebase` (picture test, 360 CI references, a differing picture re-shot up to twice in a new context because Linux emoji scaling varies per run). After PR 0-split merges: rebase again, move the pictures into their own job, refresh the Chores references from CI, run CI twice.

**PR 0-B — Feature list by screen and slim records.**
- Central conversion instructions (session start names the path): coverage list first in `docs/archive/features-coverage.txt`; `FEATURES.md` by screen with `<!-- feature-list: by-screen -->` and a proof per line.
- `## References`: `Sizes:` and `Looks:` lines (D9); figures = each girl's Sunday totals, steady money, commitment %, loan and pocket balances for the fixture week; rule document = `AllowanceRulesJennJess-v2.md` (each rule line names the money test that proves it; a line without a test is listed to the owner). The `Tests:` lines from PR 0-split stay and are extended per screen.
- Move to `docs/archive/` (`git mv` by `sonnet-worker`, not delete): the narrative build history in `FEATURES.md` and `ARCHITECTURE.md`, and the old top-level files `AUDIT.md`, `AUDIT-PRODUCT.md`, `AUDIT-SYNC.md`, `PLAN.md`, `PLAN-PHASE2.md`, `REVIEW.md`, `MODULARIZATION_PLAN.md`, `MULTI_ROLE_REVIEW.md`. Keep `SECURITY_TODO.md` (Track S needs it). The setup notes in `FEATURES.md` become one line pointing to hz-claude-config.
- Slim `WORKING_RECORD.md` (main session) **keeps**: the request ledger, the deliverable ledger, the hotspot table with its comparisons, Open questions / blockers, Where we are. Only narrative history moves (the dated Approved-baseline story, Pending, old regression tables and checks, the PR #92 record section) to `docs/archive/working-record-history.md`.
- `opus-worker` marks each `ARCHITECTURE.md` rule `checked by <script>` or `text only`.
- The first record edit also corrects `## Where we are`: PR 5 of Money fit and logic (#119) merged to `main` as `8ef4eeb`; Stage 13 per decision 2.

**PR 1 — Money re-check** (`money-recheck-brief-rev1.md` in full: fixes 1–6 plus first-revision items 0, 1, 2, 3, 5, 7).
- Commitment % from `sdCommitPlan` in all three places: `46-grownups.js:537`, `44-sunday.js:1301` (`pct`, the "New row on my wall" pop-up) and `:1323` (the "one more club session → %" idea); no division by steady without the $5 floor. `44-sunday.js:1306` and `:1310` hard-code `> 50`: they read `sdCommitPlan`'s `over` instead. `:1307` "Left for me to choose" never negative — with `lowSteady`, the form's wording instead of a figure.
- `data-money-surface` on every money root (My money, Money school, All my Sundays, By month, Sunday steps, Grown-ups, Parent › Now money cards, request/told/Sunday overlays). The three CSS lists — `css/app.css` 8389 (`--text-scale: 1`), 8398 (`--font-round`) and 9557 (`.mv2-school`, `.mv2-hist`, `.mv2-flow` → `--text-scale: 1`) — become one `[data-money-surface]` selector each; the lists are deleted. Ledger row 70 (L7, one text scale) is checked against this.
- Font smoke check finds screens by `[data-money-surface]`, Parent › Now included. The %-check fails on any division by steady outside `js/43`.
- Search box: `.gu-search-label` is already screen-reader-only; the clipped text is the placeholder "Find a price or rule…" (`46-grownups.js:990`). Fix: placeholder "Find…" at ≤699px, or let the input take the column width.
- "This month" is the calendar month; empty state when nothing has landed.
- The two ✍️ Record doors get the same hint line. Fix 6 confirmed as written (`42-flow.js:132`).
- Stale comment `15-meeting.js:1008` ("Sun–Sat from 11 Oct 2026") corrected to decision 15; the mapping code stays until PR 13.
- Updates `tests/reference/` for the money surfaces; the difference page shows each change.

**PR 2 — Chores screen** (C3, ledger row 42).
- a) One-off: a run of the picture test writes `#screen-chore` for Jenn, Jess and Parent at both sizes in both looks into `tests/out/`, plus each row of `docs/chore-relocation-map.md` shown at its new home, on one comparison page linked in the reply (not an open PR — pull requests open last). No references, no new script. The run happens on GitHub (D16), its artifact feeds the page. Stop for the per-row ✓.
- b) After the ✓: remove `#screen-chore`, `openChoreTab`, `#choreProfileBadge`, the 🧹 More tile and its refresh hooks; Chore leaves `TD_NAV_SCREENS`; port the 21 smoke checks to the new homes (and their parts and the saved time list); `check-dead-css.js` and `check-dead-actions.js` stay green; the Chore references leave `tests/reference/`. Then PR 2 opens.

**PR 3 — Component kit (no visible change).**
- `js/05-helpers.js`: `fmtMoney(v, {signed})` (D2), `fmtDay(key, 'short'|'long'|'weekday')`, `kidLabel` as the one name source. Unit tests: negative, whole, cents, rounding.
- CSS tokens for both looks: `--radius-sm/md/lg/pill`, `--shadow-sm/md/lg`, `--z-base/header/nav/sheet/dialog/toast`, `--hdr-*` (`--hdr-h` 64px iPad / 56px phone; sub-bar 48px; `--hdr-title-size`). Breakpoints: ≤699, 700–1099, ≥1100. `check-look-tokens.js` stays green; every new token has a value in both looks; a token carries decoration or meaning, never both (Looks–Calm hotspot).
- Classes: `.ui-btn` (primary, secondary, icon, danger; `lg` for the money 54/66px), `.ui-chip`, `.ui-tabs`, `.ui-card`, `.ui-sect-head`, `.ui-sheet`, `.ui-kids`, `.ui-stepper`.
- `js/47-header.js` (classic script, declares only, loaded before `99-main.js` per the load-order rule; added to the `sw.js` `SHELL` list): `pageHeader({variant, back, title, context, actions, badge, sub})` returning `.ph-*` markup; variants `standard` (64/56px), `money` (72px, 54px buttons, one row), `meeting` (two rows, 106px, no bottom bar), `parent` (standard height, purple). Unit and smoke tests render each slot combination. Nothing calls it yet.
- Proof: the picture test reports 0 differences against the PR 0-A references as updated by PR 1 and PR 2.

**PR 4 — Headers, kid screens.** Today, Week, Day, Sister Sync, My money, Money school, All my Sundays, By month, the meeting, Print.
- Replace `.topbar`, `.week-topbar`, `.day-topbar`, `mnyPageHead` and `.mm-head--two` with `pageHeader`; delete the replaced CSS (`check-dead-css.js`). Slots: `[◀ back?] [Title] [context] [actions ≤2] [profile badge]`; sub-bar for tabs, stepper, kid switch. Sticky, `--paper`, one 2.5px solid rule, no dashed rule, no extra shadow.
- Badge always far right, avatar only on money pages, the date hidden at ≤699px (D4). Titles without emoji (D5). Day gets a visible title; delete the hidden `.mm-title`.
- Back rule: no ◀ on Today, Week, Sister Sync (remove Sister Sync's `goWeek` back — header only, no invite logic). Elsewhere ◀ goes through one `navReturn` stack (generalised from `mnySchoolReturn`; `backtoday` retired); aria-label "Back to <screen>".
- Phone rule: every header is two rows at most, or one row of icons only. Keep the sub-bar off Day unless its span tabs move into it.
- Every difference from the approved header picture goes on one comparison page, picture pairs numbered like `❓ Decisions`; `tests/reference/` updated on the branch.
- Monthly: handled in PR 5 with its purple strip; if Explore shows a kid-reached Monthly view, it takes the `standard` variant in PR 4.

**PR 5 — Headers, parent portal.**
- `.parent-bar` becomes `pageHeader` (parent variant, `--accent-purple`). `.parent-banner` is removed on Week, Day and Monthly; "Viewing Jenn", Back, Confirm all and Mark reviewed move into the sub-bar. Run the `FEATURES.md` regression rows for Confirm all and Mark reviewed explicitly (money-critical).
- D14: Reading size (`--fs-scale`) default 1.2 when nothing is stored (decision 3).
- `.cp-head`, `.ctr-head` and `.gu-head` lose the card-as-header styling (title slot or sub-bar). Delete the replaced CSS.
- `check-dead-actions.js` cannot see generated `data-*` actions: re-check every header action by hand. References updated; difference page.

**PR 6 — Words and numbers.**
- Replace the 18 money formatters (`mnyMoney`, `rqDollars`, `guMoney$`, `ckMoney`, `sdWhole$`, `sdD`, `sdMoney`, …) with `fmtMoney`; fix `mnyMoney(-3)` = "$-3.00". Replace `mnyDayLabel`, `mnyDayName`, `guDayName` with `fmtDay`; `mnyKidName`, `pcwKidName`, `cfKidName` with `kidLabel`. Delete the old functions.
- Extend `check-money-words.js` to fail on a new local money or date formatter.
- Frozen weeks render from stored numbers; only the display changes (`sunday.test.js`, `money.test.js`). References updated; difference page.

**PRs 7–12 — Components, one surface per PR.** Each PR: move the surface to `.ui-*`, delete its private button, tab, card and sheet classes (`check-dead-css.js`), move its inline `style=` into CSS, drop emoji-titled headings (D5), burn down typed-in hex colours only inside that surface, run that surface's `FEATURES.md` rows, update `tests/reference/`, before/after page in both looks.
- PR 7 Today · PR 8 Week/Day (`.week-nav`, `.day-nav-center` → `.ui-stepper`) · PR 9 Money and Sunday (`mny-*`, `sd-*`, `rq-sheet`, `pn-told-sheet`; the 54/66px `lg` size) · PR 10 Parent portal (`parent-tab`, `cp-*`, `ctr-*`, `gu-*`, `parent-scope` → `.ui-kids`) · PR 11 Sister Sync and Profile (inline-styled headings `index.html:576-590` → `.ui-sect-head`, headings only, no invite logic; the manifesto `index.html:96-105` → a "How this planner works" sheet) · PR 12 sheets and dialogs (`.sheet`, `.gu-sheet`, `.sd-sheet`, `.td-more-sheet`, `.app-dialog-sheet`, `.quest-popup`, … → `.ui-sheet` + one dialog; the 27 overlays).

**PR 13 — Clean-up and guards.**
- Delete the 7 unused functions after a re-grep including string-dispatched calls: `setParentKid`, `mmRenderQuarterly`, `loanPayExtraPrompt`, `mnyWithdrawRequest`, `mrCompetitionBlock`, `moneyCanTransact`, `mnyConfirmStamp`.
- Money week, decision 15: `18-rules.js:117-122` and `1274-1400` hold the **live** `mrMoneyDays`, `mrMoneyWeekLabel` and `mrMoneyWeekOf`, used elsewhere. Remove only the Sunday–Saturday branch and its tests; Monday–Sunday results unchanged; prove no stored rulebook can switch the Sunday branch on (test with a stored rulebook fixture); Explore map first; `money.test.js` and `sunday.test.js` otherwise unchanged.
- Timer audit: every `setInterval` in `js/08`, `js/09` and `js/44` is cleared on screen change or close.
- D13: old history (comments, plans, audits, hand-overs) moves to `docs/archive/`, never into `WORKING_RECORD.md`. The "gone / retired / long gone / kept for" source comments go to `docs/archive/history-comments.md`.
- Guards in `npm run check` (`tests/check-headers.js` and extensions), each with an allowlist and a reason per entry; fail on: more than one `.ph` header per `.screen`, a header button under 44px or without an accessible name, header text under 15px; a new `*-btn`, `*-tab`, `*-card` or `*-sheet` class outside `.ui-*`; a font size with no floor or no `--text-scale` (new ones; existing sub-13px fonts outside the touched surfaces are allowlisted with reasons); a z-index or breakpoint outside the tokens; a hand-kept screen list in CSS (selectors with 4 or more ids or roots).
- `FEATURES.md`: Page header, Component kit, Money format sections.

**Track S (after PR 13, D8).** `SECURITY_TODO.md` runbook steps 1–7: backup, read the live rules, Firebase Auth, move the doc, point the client, publish the rules, delete the old doc. Own plan and PRs; opus-worker only.

### Done when, per stage

Rows 3 and 4 are new; every later row keeps its wording and moves down by two. "`npm test` passes" in any row means: green on GitHub (governance 2), never a local full run.

| Stage | Done when |
|---|---|
| 1 PR 0-pre | Done: PR #122 merged as `d3bdc71`. |
| 2 | Done: PR 0-pre merged to `main`. |
| 🟦 **Rev 1** — 3 PR 0-split | Explore names the cause of the 20-minute 2026-10-07 job; fixed test-only; two GitHub runs in a row, unit job and the smoke job on each of the four dates green, times listed in the PR, every smoke job under 10 minutes; no `SMOKE_PART`, replay, seam, view-reset or coverage-job code left; `check-ci-scripts.js` passes; `npm run test:fast` timed on this PC under 3 minutes; per-check times printed and the time tool kept; `FEATURES.md` `Tests:` lines present; `ARCHITECTURE.md` and `tests/README.md` say short loop locally, full suite on GitHub; no app file changed; reviewer ran; PR ready. |
| 4 | PR 0-split merged to `main`. |
| 5 PR 0-A | On CI: two runs in a row give 0 differences; a planted 1-pixel change is caught; the picture job (or each of its parts) under 5 minutes; `check-ci-scripts.js` passes with the new step; `npm test` passes; sources and plan files committed; reviewer ran; PR ready. The branch sits on `main` after PR 0-split (merge-base confirmed) and the Chores references are refreshed from CI. |
| 6 | PR 0-A merged to `main` (merge-base confirmed). |
| 7 PR 0-B | Every coverage phrase is found or marked "removed — owner OK"; the three record files keep only the current state (the five kept record sections intact); rule lines without a test listed; every `ARCHITECTURE.md` rule marked; `npm test` passes. |
| 8 | PR 0-B merged. |
| 9 PR 1 | Hotspot note recorded first; every "Done when" in the brief passes; reverting fix 1 or 2 makes `npm run check` fail; the three lists are gone; `npm test` passes; references updated; difference page; build bumped. |
| 10 | PR 1 merged; the owner reports the build number read on Today → ⋯ More on the iPad and the money walk-through (closes Money fit and logic Stage 13 per decision 2). |
| 11 PR 2a | The page shows the Chores screen (3 users × 2 sizes × 2 looks) and every relocation-map row at its new home; linked in the reply; no repo change beyond `tests/out/`. |
| 12 | The owner's ✓ on every row (or a Fix row per missing one). |
| 13 PR 2b | Every relocation-map row has a passing check at its new home; nothing links to the old screen; dead-css and dead-actions green; `npm test` passes. |
| 14 | PR 2 merged. |
| 15 PR 3 | `npm test` passes, new unit tests included; `check-sw-shell.js` passes with the new script; the picture test reports 0 differences against the current references. |
| 16 | PR 3 merged. |
| 17 | The approved header pictures (4 variants × 2 sizes × 2 looks) are in `docs/handoff/consistency/headers/`. |
| 18 PR 4 | Badge note recorded first; every kid screen has exactly one header; same height per variant at both sizes in both looks; "Sister Sync" fits on one line at 375px; 44px and 13/15px floors hold; comparison page with every difference from the approved pictures; references updated; `npm test` passes. |
| 19 | Differences decided; PR 4 merged; build read on the iPad in both looks. |
| 20 PR 5 | One purple bar on every parent screen; Confirm all and Mark reviewed regression rows pass; Reading size scales the header and defaults per decision 3; comparison page; `npm test` passes. |
| 21 | Differences decided; PR 5 merged. |
| 22 PR 6 | One Sunday per girl shows the same totals as before, in the new format; `sunday.test.js` and `money.test.js` pass; `check-money-words.js` fails on a planted local formatter; old functions gone; references updated. |
| 23 | PR 6 merged; build read on the iPad; one Sunday per girl walked. |
| 24, 26, 28, 30, 32, 34 PR 7–12 | The surface's old classes are gone (`check-dead-css.js`); floors hold; that surface's `FEATURES.md` rows pass; before/after page in both looks; references updated; `npm test` passes. |
| 25, 27, 29, 31, 33, 35 | Page decided; that PR merged. |
| 36 PR 13 | Each guard fails on a planted example; the 7 functions and the Sunday branch gone with money and Sunday tests otherwise unchanged; timers audited; history in `docs/archive/`; `FEATURES.md` sections added; `npm test` passes; `Reviewer before done` written. |
| 37 | PR 13 merged; build read on the iPad; the plan closes. |

### Risks

- PRs 7–12 touch every screen: one surface per PR, that surface's regression rows each time.
- Two looks double the visual checks; the guards cover tokens, layout still needs the iPad.
- The picture test on a local machine differs from CI (fonts, browser build); only CI gates.
- PR 6's display change shows on signed Sundays; stored numbers do not change.
- Retiring Chores removes a door the girls may use; the per-row ✓ is the gate.
- Calm's wider fonts: titles and sub-bar tabs at 375px in both looks.
- A sticky two-row header costs height on the Day timeline.
- PR 13's money-week code is live: the Sunday branch only, proven by tests.
- Any money branch opened during this plan starts from `main` after the latest merge.
- Fixed smoke dates: a calendar-dependent failure shows only when one of the four dates triggers it (7 Oct is in the set because it did).
- Parts: each part repeats the browser setup and the earlier writer tests, so total GitHub minutes go up while waiting time goes down. If writers are slow, the last parts are the longest; the audit move and n=5 are the levers. The reader/writer split is only as good as the seam state's reach (state held only in Node variables is outside it); a named crash is the backstop.
- Short loop only on this PC: a smoke failure is first seen on GitHub, not before the push; the map's `SMOKE_ONLY` lists catch most of them earlier.

### Content ledger check

| # | Phrase | Section where it appears |
|---|---|---|
| 1 | No full redesign | Your decisions (D1) |
| 2 | "$3" for whole dollars | Your decisions (D2) |
| 3 | Print preview tab and the 🖨 Print button | Your decisions (D3) |
| 4 | Profile badge on every kid screen | Your decisions (D4) |
| 5 | No emoji in screen titles | Your decisions (D5) |
| 6 | Money re-check first | Your decisions (D6) |
| 7 | per-row ✓ | Your decisions (D7); The work (PR 2); Your stops |
| 8 | Track S | Your decisions (D8); Out of scope; Technical details |
| 9 | iPad 1194×834 and phone 390×844 | Your decisions (D9); Governance 5 |
| 10 | PR 0-A | Your decisions (D10); The work; Stages 5 |
| 11 | this session carries Stage 0 and PRs 1–13 | Your decisions (D11) |
| 12 | approved Claude Design header pictures | Your decisions (D12) |
| 13 | never into `WORKING_RECORD.md` | Technical details › PR 13 (D13) |
| 14 | pixel compare in code | The work (PR 0-A); Technical details › PR 0-A |
| 15 | names the money test that proves it | The work (PR 0-B); Technical details › PR 0-B |
| 16 | Keep `SECURITY_TODO.md` | Technical details › PR 0-B |
| 17 | pixel-identical to the PR 0-A references | The work (PR 3) |
| 18 | after PR 1, PR 4, PR 6 and PR 13 | Summary; Your stops |
| 19 | no public link is shared | Your decisions (D8) |
| 🟦 **Rev 1** — 20 | each smoke job about 8 minutes now, under 5 minutes after Stage 38 | Your decisions (D16, D20); The work (PR 0-split); Stages 38–39 |
