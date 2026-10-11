# Plan v10 — Weekly-Planner consistency pass — Approved 2026-10-10 (Rev 2)

🟩 **Rev 2** — **Quick read** · 257 words · about 2 min

**Summary**
- 🟩 **Rev 2** — Goal: one test on this PC runs in under 40 seconds, then the parent headers, then three screen pages built at the same time.
- 🟩 **Rev 2** — Done: 28 of 46 stages. Next: make every one-test run on this PC finish in under 40 seconds.
- 🟩 **Rev 2** — I need from you: approve this Rev of Plan v10.

**What changed since Plan v10 Rev 1**
- 🟩 **Rev 2** — One new build stage before the parent headers: every one-test run on this PC is under 40 seconds; the house-rules walks run on GitHub only.
- 🟩 **Rev 2** — The parent headers are built by the Routine worker, because they come from your table of exact values.
- 🟩 **Rev 2** — After PR 6 merges, Today, Week and Day, and Parent portal are built at the same time, each in its own copy with its own style file.
- 🟩 **Rev 2** — You decide those three pages at one stop, so there are 2 fewer stops.
- 🟩 **Rev 2** — PR 9 needs only PR 6; PR 11 and PR 12 come after the three pages merge.

🟩 **Rev 2** — **Decisions:** None open. You answered on 10 October: the three changes are a Rev of Plan v10, not Plan v11.

**Next steps**
- 🟩 **Rev 2** — Stage 29 fast one test on this PC: one test runs in under 40 seconds, and the time is written in the test notes.
- 🟩 **Rev 2** — Stage 30 parent headers: one purple bar on every parent screen, measured against your values, with a side-by-side page.
- 🟩 **Rev 2** — Stage 31 your stop: decide the differences and merge PR 5.
- 🟩 **Rev 2** — … 15 more steps in the full plan below

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
- **D20** One smoke job per date, about 8 minutes accepted until the test speed work; the job that took 20 minutes was explained and fixed; keep the short test loop, the test map and the time tool. The way under 5 minutes is now D39.
- **D21** The header pictures are your Claude Design package (9 October 2026), not Claude's mockups. Heights: standard 64 on the iPad and 60 on the phone; money 72 and 64; meeting 62 + 44 on the iPad and 60 + 44 on the phone; parent like standard, with a 44 sub-bar when viewing a girl.
- **D22** The unused-style checker loophole is closed (done in PR 4).
- **D23** The picture test hides the build number (done in PR 4).
- **D24** The four overnight choices built in PR 3 are kept.
- **D25** The round avatar badge is on every kid header at every width; its words stay for screen readers.
- **D26** Today's date shows on a phone. Only the money header hides its date on a phone.
- **D27** On a phone, Copy a day moves to tapping the Day date; the iPad keeps the button.
- **D28** The iPad Day title reads "Tuesday 6 Oct"; the span form ("Tue–Thu") waits for PR 6.
- **D29** PR 4 does not match the pictures: rebuild the kid header from your table of exact values with new parts (done).
- **D30** Differences 1, 9–14 follow the picture; 2–8 stay as built (done).
- **D31** Difference 15: the phone Day date is 20px; smaller only if 20px does not fit at 360px wide (done).
- **D32** The smoke test measures every header against the exact values and fails on any mismatch (done).
- **D33** The comparison page is made again, iPad Pop first (done).
- **D34** Checkpoint report 1 (done; sent again on 10 October).
- 🟩 **Rev 2** — **D35** PR 5 builds the parent header from the same table (purple bar, 44 badge, 44 buttons, 44 sub-bar when viewing a girl). It starts from main after PR 14 merged; it is not stacked (D40).
- **D36** The picture wins: where the build and your picture differ, the build follows the picture. Only a part that cannot fit becomes a question, with a picture pair.
- **D37** One header first: one screen is built and shown beside your picture before the rest.
- **D38** The rule "follow the reference exactly" goes to the central rules as a proposal.
- 🟩 **Rev 2** — **D39** Every GitHub job under 5 minutes comes before PR 5. Each date's smoke test runs as 3 parts side by side (12 smoke jobs). The slow groups set up their own data so a part can run without the others. Three workers work at the same time, one per slow test group, each in its own place; no dynamic workflow (done in PR 14).
- **D40** PR 5 and every later pull request start from main after the one before merges; no stacks for the rest of this plan.
- 🟩 **Rev 2** — **D41** Before PR 5, one build stage makes every one-test run on this PC finish in under 40 seconds. A check that does not need the house-rules walks skips them on this PC. The walks run on GitHub only, where nothing changes.
- 🟩 **Rev 2** — **D42** A build from your table of exact values is Routine work for the Sonnet worker, as the central rules say. The parent headers (Stage 30) are Routine.
- 🟩 **Rev 2** — **D43** After PR 6 merges, PR 7 (Today), PR 8 (Week and Day) and PR 10 (Parent portal) are built at the same time, each in its own copy of the project with its own files. Each screen's styles go in their own style file. You decide the three pages at one stop. PR 9 needs only PR 6. PR 11 and PR 12 come after the three merge.
- 🟩 **Rev 2** — **D44** The three changes above are recorded as a Rev of Plan v10, by your choice on 10 October, not as Plan v11.

Earlier agreed points still in force (night check 2026-10-08): the girls lose the old Chores view of past weeks; the parent money-board controls keep working from the parent screens; anything reachable only on Chores and not in the relocation map was kept and asked about.

🟩 **Rev 2** — Agreed points with their search phrases (all kept):
- 🟩 **Rev 2** — This Rev: every one-test run on this PC under 40 s (D41); build from the exact values is Routine (D42); PR 7, PR 8 and PR 10 at the same time (D43); Rev of Plan v10 (D44).
- 🟩 **Rev 2** — Test today's earned: the Today-vs-My-money test compares today's earned amount; the "still to earn today" figure is not brought back now.
- 🟩 **Rev 2** — Plan v7 in the morning; header pictures page overnight (night check 2026-10-08, done).
- 🟩 **Rev 2** — Header values (done in PR 4, used again for the parent header in Stage 30): bottom line solid navy (2.5px set, 2px drawn at ratio 1, 2.5px at ratio 2); exact middle of the bar for the date and week arrows; at most 1px off the middle; only as much as each width needs on narrow phones; the phone meeting keeps 4px gaps and the Sound button.
- 🟩 **Rev 2** — Page answers (2026-10-09): Money school 13px at 360 kept; "◀ Today" kept when she came from Today; meeting steps centred and 🔊 kept.
- 🟩 **Rev 2** — Phone Week preview keeps ◀ week ▶ with one 📋 button back to Full; Print moves to the top of the preview page.
- 🟩 **Rev 2** — Differences: follow the picture on 1, 9–14; keep 2–8; 20px at 360px; the comparison page had the iPad in Pop at the top (all done).
- 🟩 **Rev 2** — The header reference is the owner's Claude Design package (D21).
- 🟩 **Rev 2** — PR 5 stacks: superseded by D40 — PR 5 starts from main.

## The work, one line per pull request

- 🟩 **Rev 2** — **PR 0-pre, 0-split, 0-A, 0-B, PR 1, Fix, PR 2, PR 3, fast one-test run, PR 4, PR 14** — merged.
- 🟩 **Rev 2** — **PR 5 (now next)** First the fast one test on this PC (D41), then the parent portal headers from the same table (D35) and the Reading size default (D14).
- 🟩 **Rev 2** — **PR 6** Words and numbers: one money style, one date style, one kid name. It also adds the empty style file for each screen, so PRs 7–11 never edit the same file.
- 🟩 **Rev 2** — **PR 7, PR 8, PR 10 at the same time** Today; Week and Day; Parent portal. Each in its own copy, with its own style file.
- 🟩 **Rev 2** — **PR 9** Money and Sunday, with its own style file. It starts when one of the three workers finishes.
- 🟩 **Rev 2** — **PR 11** Sister Sync and Profile, after the three merge. **PR 12** Sheets and dialogs, after PR 11.
- **PR 13** Clean-up and guards; history to the archive.

## Your stops

- You merge every pull request.
- iPad read of the build: after PR 6 and PR 13.
- 🟩 **Rev 2** — The three pages of PR 7, PR 8 and PR 10 come to you at one stop.
- Any difference on a comparison page comes to you as a numbered question with a picture pair.

## ❓ Decisions

🟩 **Rev 2** — None open. Decided 2026-10-10: the three changes are a Rev of Plan v10; one-test runs under 40 seconds on this PC with the walks on GitHub only; exact-value builds are Routine; PR 7, PR 8 and PR 10 at the same time with one stop.

🟩 **Rev 2** — Checked against: the test suite run time hotspot (3 fix rounds, at its limit; rewrite-vs-repair reviewed yes on 8 October; this stage changes only which checks run on this PC, nothing on GitHub, so it is not a new repair of the GitHub run); D16 (no full run on this PC, unchanged); the kid header hotspot (1 fix round; the parent header uses the same parts and the same measurement check); the profile badge hotspot (rewrite recorded on 9 October; the parent badge uses the same part); request ledger rows 131 and 134 (test speed and exact values) — no conflict; row 135 notes that the rules make a change after approval a new version, and you chose a Rev.

🟩 **Rev 2** — Removes/consolidates: the rule that a check not on the list gets both walks on this PC; three separate merge stops for PR 7, PR 8 and PR 10 become one; the shared style file stops growing for screen styles (each screen gets its own file).

## Out of scope

🟩 **Rev 2** — Money, XP and merge rules; stored data; new features; Track S (own plan); any change to what a check tests on GitHub.

## Stages to finish

🟩 **Rev 2** — 46 stages: 28 build steps by Claude, then 18 checks by you (merges, iPad reads, the Chores ✓, header pictures, comparison pages). Stages 1–28 are done. Two build stages are new (the fast one test on this PC, and the empty style files). Two check stops are joined into the three-page stop. The total stays 46.

1. PR 0-pre tap size and fixed test dates · Claude · Build · after: — · level: Complex · size: M · group: done · proof: the door measured 44 tall on the phone in both looks; GitHub green on four dates (done)
2. Merge PR 0-pre (Check) · You · Check · after: 1 · group: done · proof: merged (done)
3. PR 0-split short loop, test map and one smoke job per date · Claude · Build · after: 2 · level: Complex · size: M · group: done · proof: cause of the 20-minute job named and fixed; GitHub green on four dates (done)
4. Merge PR 0-split (Check) · You · Check · after: 3 · group: done · proof: merged (done)
5. PR 0-A picture test and references · Claude · Build · after: 4 · level: Complex · size: M · group: done · proof: two GitHub runs with 0 picture differences; a planted 1-pixel change caught (done)
6. Merge PR 0-A (Check) · You · Check · after: 5 · group: done · proof: merged (done)
7. PR 0-B feature list and records · Claude · Build · after: 6 · level: Complex · size: L · group: done · proof: every coverage phrase found or marked; GitHub green (done)
8. Merge PR 0-B (Check) · You · Check · after: 7 · group: done · proof: merged (done)
9. PR 1 money re-check, pocket-money note first · Claude · Build · after: 8 · level: Complex · size: L · group: done · proof: every brief check passes; difference page (done)
10. Merge PR 1, iPad read, money walk-through (Check) · You · Check · after: 9 · group: done · proof: merged; build read (done)
11. PR 2a Chores snapshot page · Claude · Build · after: 10 · level: Routine · size: S · group: done · proof: one page, every moved row at its new home (done)
12. Chores per-row ✓ (Check) · You · Check · after: 11 · group: done · proof: "all rows OK, go ahead" (done)
13. PR 2b retire the Chores screen · Claude · Build · after: 12 · level: Complex · size: M · group: done · proof: each moved row passes at its new home; GitHub green (done)
14. Merge PR 2 (Check) · You · Check · after: 13 · group: done · proof: merged (done)
15. PR 3 component kit, no visible change · Claude · Build · after: 14 · level: Complex · size: L · group: done · proof: 0 picture differences; GitHub green (done)
16. Merge PR 3 (Check) · You · Check · after: 15 · group: done · proof: merged (done)
17. Approve header pictures (Check) · You · Check · after: — · group: done · proof: your Claude Design package (done)
18. PR 4 headers, kid screens, badge note first · Claude · Build · after: 16, 17 · level: Complex · size: L · group: done · proof: one header per kid screen; comparison page with 15 differences; GitHub green (done)
19. Checkpoint report 1 · Claude · Build · after: 18 · level: Routine · size: S · group: done · proof: Quick read, measured part, one-test run went from 149 s to 33 s (done)
20. PR 4 fix round: rebuild the kid header from the exact values, smoke measurement check · Claude · Build · after: 18 · level: Complex · size: L · group: done · proof: measurement check green on four dates, red on three planted faults; CI green (done)
21. PR 4 fix round: comparison page again, reviewer, PR 4 updated · Claude · Build · after: 20 · level: Routine · size: S · group: done · proof: page with five iPad Pop pairs first; reviewer verdict; CI green (done)
22. Read the new comparison, merge PR 4, iPad read (Check) · You · Check · after: 21 · group: done · proof: your OK on 10 October; PR 4 merged; the build of 9 October is live (done)
23. PR 14 measure where the smoke time goes, and prepare 3 parts · Claude · Build · after: 22 · level: Complex · size: M · group: done · proof: time table; three groups named and moved; every check in exactly one part (done)
24. 🟩 **Rev 2** — PR 14 group 1 sets up its own data · Claude · Build · after: 23 · level: Complex · size: M · group: done · proof: passes alone and in its part; planted fault caught (done)
25. 🟩 **Rev 2** — PR 14 group 2 sets up its own data · Claude · Build · after: 23 · level: Complex · size: M · group: done · proof: passes alone and in its part; planted fault caught (done)
26. 🟩 **Rev 2** — PR 14 group 3 sets up its own data · Claude · Build · after: 23 · level: Complex · size: M · group: done · proof: passes alone and in its part; planted fault caught (done)
27. PR 14 parts on GitHub, one-test time, reviewer, pull request · Claude · Build · after: 24, 25, 26 · level: Complex · size: S · group: done · proof: every GitHub job under 5 minutes on two runs; each check once per date; reviewer verdict (done)
28. Merge PR 14 (Check) · You · Check · after: 27 · group: done · proof: merged on 10 October (done)
29. 🟩 **Rev 2** — Fast one test on this PC: every one-test run under 40 seconds · Claude · Build · after: 28 · level: Routine · size: S · group: E1 · tests: one-test runs on this PC, the check list test · proof: a check that is not on the list runs in under 40 seconds on this PC and prints the walks it skipped; a walk check still runs its walk when chosen; GitHub runs every walk as before (same check count per date); the time is written in the test notes and the pull request
30. PR 5 headers, parent portal from the exact values · Claude · Build · after: 29 · level: Routine · size: M · group: E1 · tests: the short loop, the measurement check with parent screens · proof: one purple bar on every parent screen, badge 44, buttons 44, 44 sub-bar when viewing a girl, all measured; Confirm all and Mark reviewed rows pass; Reading size defaults to 1.2; old parent top bar and month stepper gone; side-by-side page; reviewer verdict; GitHub green
31. Decide differences, merge PR 5 (Check) · You · Check · after: 30 · group: F · proof: page decided; PR 5 merged
32. PR 6 words and numbers · Claude · Build · after: 31 · level: Complex · size: L · group: G · proof: one Sunday per girl shows the same totals in the new format; money and Sunday tests pass; a planted local formatter fails the check
33. 🟩 **Rev 2** — PR 6 one empty style file per screen · Claude · Build · after: 32 · level: Complex · size: S · group: G · tests: the short loop, the picture test, the offline check · proof: five empty style files load after the shared one and work offline; the minimum sizes still win (a planted smaller size in a screen file fails the check); 0 picture differences
34. Merge PR 6, iPad read, one Sunday per girl (Check) · You · Check · after: 33 · group: H · proof: merged; build read; one Sunday per girl walked
35. PR 7 Today · Claude · Build · after: 34 · level: Complex · size: M · group: K · proof: old classes gone; Today rows pass; "with Mum" row readable in Calm; before-and-after page
36. PR 8 Week and Day · Claude · Build · after: 34 · level: Complex · size: M · group: K · proof: old classes gone; Week and Day rows pass; before-and-after page
37. 🟩 **Rev 2** — PR 10 Parent portal · Claude · Build · after: 34 · level: Complex · size: M · group: K · proof: old classes gone; parent rows pass; before-and-after page
38. 🟩 **Rev 2** — Decide three pages, merge PR 7, PR 8 and PR 10 (Check) · You · Check · after: 35, 36, 37 · group: L · proof: three pages decided; three pull requests merged
39. PR 9 Money and Sunday · Claude · Build · after: 34 · level: Complex · size: L · group: M · proof: old classes gone; money rows and tests pass; before-and-after page
40. Decide page, merge PR 9 (Check) · You · Check · after: 39 · group: N · proof: page decided; merged
41. PR 11 Sister Sync and Profile · Claude · Build · after: 38 · level: Complex · size: M · group: Q · proof: old classes gone; Sister Sync and Profile rows pass; before-and-after page
42. Decide page, merge PR 11 (Check) · You · Check · after: 41 · group: R · proof: page decided; merged
43. PR 12 sheets and dialogs · Claude · Build · after: 42 · level: Complex · size: L · group: S · proof: one sheet and one dialog style left; each of the 27 overlays opens and closes; before-and-after page
44. Decide page, merge PR 12 (Check) · You · Check · after: 43 · group: T · proof: page decided; merged
45. PR 13 clean-up and guards, history to the archive · Claude · Build · after: 40, 44 · level: Complex · size: L · group: U · proof: each guard fails on a planted example; money and Sunday tests unchanged; GitHub green
46. Merge PR 13, iPad read (Check) · You · Check · after: 45 · group: V · proof: merged; build read on the iPad; the plan closes

## Technical details

**Baseline (tests/README.md, 2026-10-10).** `SMOKE_ONLY=<one check> npm run test:smoke`, default date: 33 s for a check declared in `SETUP_NEEDS` (`theComponentKitHoldsItsSizes`), 99 s for one that is not (`todayShowsWhatAChoreWouldPay`, gets both walks: kid ~85 s, parent ~30 s on the owner's PC). PR #138 merged 2026-10-10 10:57 AM MDT (`f2331a8`).

**Stage 29 (sonnet-worker, Routine, S, branch `claude/consistency-5` from `main` @ `f2331a8`).** In `tests/smoke.js`, when not under `CI`, a `SMOKE_ONLY` run skips the kid and parent house-rules walks unless a chosen check is a walk check or declares a walk in `SETUP_NEEDS`; an undeclared check no longer gets every step on this PC. Under `CI` nothing changes (SMOKE_PART runs, same `ALL_CHECKS` per date). Print each skipped step (existing message). If a chosen check fails only because a walk was skipped, declare that walk for it in `SETUP_NEEDS` (exact list edit, no change to what it checks). Measure: `todayShowsWhatAChoreWouldPay` and one declared check, each under 40 s; write both times in `tests/README.md` (replace the 33 s / 99 s line) and the PR. Files: `tests/smoke.js`, `tests/README.md`. No `package.json`, no `ci.yml`. Escalate to opus-worker if a check needs a walk's state to pass and a declaration does not fix it.

**Rewrite-vs-repair note (Test suite run time hotspot, at 3 rounds).** This is not a repair of the GitHub run (GitHub unchanged and green). Options: (a) local skip of the walks for checks that do not declare them (chosen: one condition, rollback one commit, no CI risk); (b) move the walks out of the setup into their own checks (rewrite; already partly done in PR 14 parts; larger diff, CI risk). Row updated with this note at approval.

**Stage 30 — PR 5 (D35, D42; sonnet-worker, Routine, M, same branch).** `.parent-bar` → `pageHeader({variant:'parent'})`; `.parent-banner` removed on Week, Day, Monthly; Monthly `.topbar` and parent `.week-nav` replaced and rules deleted; measurement check gains parent screens; D14 in `paApplyTextScale` (`js/33-parent-app.js`, per-device `localStorage` key `wp.parentTextScale`, not shared state); `.cp-head`, `.ctr-head`, `.gu-head` lose card-as-header styling; header actions re-checked by hand (`check-dead-actions.js` cannot see generated `data-*`). Values from `header-exact-values.md` (the exact table); compare instructions for the side-by-side page. Files: `index.html`, `js/11-parent.js`, `js/33-parent-app.js`, `js/07-week-view.js`, `js/09-sheets.js`, `js/47-header.js`, `css/app.css`, `tests/smoke.js`, `tests/reference/`. `sw.js` `SW_VERSION`/`APP_BUILD` bump: sonnet-worker may not touch `sw.js` → it returns `Escalate to opus-worker: sw.js bump`, or the hand-over sends that one-line bump to opus-worker after Stage 30. Reviewer before the pull request (plan has more than 3 build stages).

**Stage 33 — style files (opus-worker, Complex, S, on PR 6's branch).** Add `css/today.css`, `css/week-day.css`, `css/money.css`, `css/parent.css`, `css/social.css` (empty, one header comment), linked in `index.html` after `css/app.css` in that order; add each to the precache list in `sw.js` (l.36 area) with the version bump. The floor block now at the end of `css/app.css` must still win over screen files: move it to `css/floors.css`, linked last; `check-dead-css.js` and the floor check read all files in `css/`. ARCHITECTURE.md gains one line on where screen styles live. PR 12 sheets stay in `css/app.css` (shared parts).

**Stages 35–37 (three opus-workers at once, group K).** Worktrees from `main` after Stage 34: `git worktree add ../Weekly-Planner-today -b claude/consistency-7`, `../Weekly-Planner-weekday -b claude/consistency-8`, `../Weekly-Planner-parent -b claude/consistency-10`. Files: PR 7 `js/31-today.js`, `css/today.css`, `tests/smoke-parts/today.js`; PR 8 `js/07-week-view.js`, `js/08-day-view.js`, `css/week-day.css`, `tests/smoke-parts/week-day.js`; PR 10 `js/11-parent.js`, `js/32-parent-now.js`, `css/parent.css`, `tests/smoke-parts/parent.js`. New smoke checks go in the lane's own `tests/smoke-parts/` file (registered by the Stage 23 loader), so no two lanes edit `tests/smoke.js`. Old-class removal from `css/app.css`: each lane deletes only its own rules; overlapping hunks are resolved by the main session at merge. `sw.js` version bump: each PR bumps; after the first merge the main session merges `main` into the other two and re-bumps (one push each). Each lane: reviewer before its pull request; one comparison page per lane; the three pages reach the owner together at Stage 38.

**Stage 39 — PR 9 (opus-worker, group M).** Starts from `main` when the first of Stages 35–37 finishes building (at most 3 workers at once). Files: `js/14-money.js`, `js/44-sunday.js`, `css/money.css`, `tests/smoke-parts/money-screens.js`.

**Later stages unchanged from Plan v10 Rev 1.** Stage 32: `js/05-helpers.js`, `js/14-money.js`, `js/44-sunday.js`, `tests/check-money-words.js`. Stage 41: `index.html`, `js/10-social.js`, `css/social.css`. Stage 43: `css/app.css`, `js/09-sheets.js`, `index.html`. Stage 45: `js/18-rules.js`, `tests/check-headers.js`, `package.json`, `docs/archive/`.

**Routing.** 29 and 30 sonnet-worker (Level: Routine; `sw.js` bump to opus-worker); 32, 33, 35–37, 39, 41, 43, 45 opus-worker with an Explore map; 35–37 in three worktrees (`Worktree:`, `Files:`, `Group: K`). Reviewer before every pull request and before done. No full `npm test` on this PC (D16).

**Governance, every pull request (Plan v8 list, item 6 as D40).** 1. Read `CLAUDE.md` and `ARCHITECTURE.md`; plan mode. The main session edits only `WORKING_RECORD.md`, `FEATURES.md`, `plans/` and reports in `docs/reports/`. 2. Short loop on this PC; GitHub green on the head commit before a PR opens. 3. Bump `SW_VERSION` and `APP_BUILD` together in every PR that changes a shell file. 4. Regression table against `FEATURES.md`. 5. iPad 1194×834 and phone 390×844, Pop and Calm. 6. No stacks (D40). 7. References never go stale. 8. After each merge, `## Where we are` and the restart line are pushed.

**Plan file.** Approved Rev 1 file `plans/consistency-plan-v10.md` stays as approved. This Rev, once approved, is committed with PR 5 as `plans/consistency-plan-v10-rev2.md` (owner choice D44; the rules' "next Plan vN" is set aside by that choice).

**Record at approval.** Ledger: Stages 29–46 rows replaced with this Rev's wording (old 33–40 rows that are joined → SUPERSEDED); row 135 → done; design decisions `[in v10 Rev 2]`; hotspot row gets the rewrite-vs-repair note.

**Risks.** A check that passed only because the walks left state behind fails on this PC without them: Stage 29 declares the walk for it (found, recorded). Three lanes each delete rules from `css/app.css`: merge conflicts handled by the main session. Three lanes each bump `sw.js`: two extra pushes. The floor move to its own last file is checked by a planted smaller size.

Plan: 46 → 46 stages — two build stages added (fast one test on this PC; empty style files), two check stops joined into one three-page stop.

Agreed points: 42 of 42 in the plan.
