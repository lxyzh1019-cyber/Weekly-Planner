# Plan v11 Rev 4 — Weekly-Planner consistency pass — Approved

**Quick read** · 320 words · about 2 min

**Summary**
- Goal: finish the consistency pass with fewer stops: Kit 1.1 and Part 11 reach you as one pull request, Parts 12 and 13 as one more.
- Done: 44 of 59 stages. Next: read-only maps of both rounds, every gap asked at once; then Kit 1.1.
- I need from you: approve Rev 4. No decision is open.

**What changed since Rev 3**
- Your stops go from five to two: one merge with an iPad read after Round 1 (Kit 1.1 + Part 11), one after Round 2 (Parts 12 + 13). A decision stop comes only if the maps find gaps.
- Each round is one pull request; parallel lanes join in one round branch first; a checkpoint report comes with each round.
- The parent Week "Switch" button is made to match the header table and measured again, in Kit 1.1 (your choice A).
- Stage 34 (iPad read, one Sunday per girl) is done, by your answer. Work packages are "Part n", pull requests "#number". The two GitHub test stages before Part 11 are kept and done.
- Plan: 58 → 59 stages — maps, your gap answers (only if gaps) and the Round 1 checkpoint report added; the separate Part 11 and Part 12 merge stops superseded.

**Decisions:** None open. You answered on 11 October: the iPad read is done; two rounds; the Week Switch follows the table (A). The newest checkpoint report's three time sinks need no decision: two are closed (one GitHub run per push; the hand-over's Proof template); the third sits in the central pull-request guard, not this app.

**Next steps**
- Stage 59 maps: one list of every gap the kit or the references do not cover, both rounds.
- Stage 60 your answers: only if Stage 59 finds gaps; else a line in the report.
- Stage 49 Kit 1.1: dark mode removed, guard added.
- … 12 more steps in the full plan below

---

## The full plan

## Your decisions on record

- **D1** No full redesign. Fix the header, then consolidate components.
- **D2** Money format: "$3" for whole dollars, "$2.50" otherwise, everywhere. Negatives "−$3".
- **D3** Keep both the Print preview tab and the 🖨 Print button.
- **D4** Profile badge on every kid screen, money pages included.
- **D5** No emoji in screen titles. Headings may lead with one.
- **D6** Money re-check first, as one pull request (done).
- **D7** Chores retires after your per-row ✓ (done).
- **D8** Track S (security) after this pass; until then no public link is shared.
- **D9** Checks at iPad 1194×834 and phone 390×844, both looks.
- **D10** Stage 0 first: Part 0-A, then Part 0-B (done).
- **D11** One session: this session carries Stage 0 and Parts 1–13.
- **D12** Part 4 waits for the approved Claude Design header pictures (done).
- **D13** Old history goes to the archive.
- **D14** Reading size default 1.2 when nothing is stored (done in Part 5).
- **D15** Part 0-pre is its own pull request, merged before Part 0-A (done).
- **D16** The full test suite never runs on this PC. Each change uses the short test loop. The full suite runs only on GitHub.
- **D17**, **D19** Retired in Plan v6 (replaced by D20).
- **D18** The Calm "with Mum" chore text on Today is fixed in Part 7 with a test row that shows it (done).
- **D20** One smoke job per date; the short test loop, the test map and the time tool stay. The way under 5 minutes is D39 (done).
- **D21** The header pictures are your Claude Design package (9 October 2026). Heights: standard 64 on the iPad and 60 on the phone; money 72 and 64; meeting 62 + 44 and 60 + 44; parent like standard, with a 44 sub-bar when viewing a girl.
- **D22** The unused-style checker loophole is closed (done).
- **D23** The picture test hides the build number (done).
- **D24** The four overnight choices built in Part 3 are kept.
- **D25** The round avatar badge is on every kid header at every width; its words stay for screen readers.
- **D26** Today's date shows on a phone. Only the money header hides its date on a phone.
- **D27** On a phone, Copy a day moves to tapping the Day date; the iPad keeps the button.
- **D28** The iPad Day title reads "Tuesday 6 Oct"; the span form ("Tue–Thu") came with Part 6.
- **D29** Rebuild the kid header from your table of exact values with new parts (done).
- **D30** Differences 1, 9–14 follow the picture; 2–8 stay as built (done).
- **D31** Difference 15: the phone Day date is 20px; smaller only if 20px does not fit at 360px wide (done).
- **D32** The smoke test measures every header against the exact values and fails on any mismatch (done).
- **D33** The comparison page is made again, iPad Pop first (done).
- **D34** Checkpoint report 1 (done).
- **D35** Part 5 builds the parent header from the same table (done).
- **D36** The picture wins: where the build and your picture differ, the build follows the picture. Only a part that cannot fit becomes a question, with a picture pair.
- **D37** One header first (done).
- **D38** "Follow the reference exactly" goes to the central rules as a proposal.
- **D39** Every GitHub job under 5 minutes before Part 5; each date's smoke test runs as 3 parts side by side (done).
- **D40** Every pull request starts from main after the one before merges; no stacks for the rest of this plan. A round's lanes branch from the round branch, not from main (D79).
- **D41** Every one-test run on this PC finishes in under 40 seconds; the house-rules walks run on GitHub only (done).
- **D42** A build from your table of exact values is Routine work for the Sonnet worker.
- **D43** Parts 7, 8 and 10 were built at the same time, each in its own copy with its own style file (done).
- **D44** The Plan v10 changes of 10 October were a Rev of Plan v10, by your choice.
- **D45** Kit 1.1 fixes the kit gaps once, in the kit, not per screen. It comes after Part 9 (merged) and before Part 11, inside Round 1.
- **D46** K1 — disabled look on kit buttons: 45% opacity, no shadow, default cursor.
- **D47** K2 — hover look on kit buttons and chips, mouse only: pale wash, pointer cursor. Fingers on the iPad see no difference.
- **D48** K3 — drop dark mode app-wide: delete every dark-mode rule; light colour scheme on the root; a guard fails on any new dark-mode rule.
- **D49** K4 — one kid switch everywhere: the header's joined switch, selected in the selected colour (Pop yellow, Calm navy).
- **D50** K5 — one seven-day row part: 7 equal cells, 12px corner, today / confirmed / chosen / future states; used by Now, She told me and Meeting.
- **D51** K6 — a full-width kit button for a screen's one leading action (Run family meeting on Now and Meeting).
- **D52** K7 — a green "ok" kit button. Approve and She bought it use it; Confirm all stays the main colour. The parent's ✓ Yes / Agree / result on Sunday take it too (D70).
- **D53** K8 — a kit list-row part (44px, 2px border, 11px corner, dashed add variant). Today and Week/Day rows use it in Part 11.
- **D54** K9 — inner corners 11px, so rows are not rounder than their card.
- **D55** Part 8 question 3: the stopwatch is a 44px icon-only button beside the ✓; the height line is D67 (48px) (done).
- **D56** The other questions on the Part 7, 8 and 10 pages are accepted as built.
- **D57** The icon-only stopwatch went into Part 8 before its merge (done).
- **D58** Parts 7, 8 and 10 merged as they were; nothing builds on the flagged kit parts until Kit 1.1.
- **D59** Order: Part 9, then Kit 1.1, then Part 11. Inside Round 1, Part 11's lanes start only after the kit block is built.
- **D60** Dark-mode removal and its guard go into Kit 1.1.
- **D61** D9–D14, the header exact values and the kit-gaps note are copied into the repository's handoff folder, notes only, in Kit 1.1.
- **D62** Today's ribbon stays as it is; the seven-day row part goes on Now, She told me and Meeting.
- **D63** Hiding colour emoji in the picture test waits for Part 13; until then a rerun caused only by emoji edges is not a failure. (Note 2026-10-13, Stage 45 deviation in WORKING_RECORD.md: permanent — emoji are not hidden, the retries stay, and a planted outline check proves a real change still fails through them.)
- **D64** Nothing merged before Plan v11 was approved (done).
- **D65** The iPad read of the live build after the Parts 7, 8, 10 merges and one Sunday per girl: done, by your answer of 11 October.
- **D66** The app's header exact-values copy stands, with a dated note. The kit-gaps note in the app is your corrected copy (3) of 11 October (K1–K12).
- **D67** Part 8 question 10 (A): ✓ and ⏱ start at 48px blocks (50px pinned); 46–47px blocks show neither (done).
- **D68** Part 8 question 11 (B): narrow blocks show only the ✓ and start the stopwatch from the sheet; under 60px of name room the ✓ hides too (done).
- **D69** Part 8: question 8 is closed (dark mode goes in Kit 1.1); question 3's heading says 48px.
- **D70** Part 9 page: questions 1, 3, 5–8, 10–12 accepted; questions 2, 4 and 9 fixed in Kit 1.1 as K10, K12 and K11.
- **D71** K10 — Grown-ups' − / + steppers move to the kit stepper; no round stepper is left anywhere.
- **D72** K11 — the picked-chip colour equals the selected colour in both looks; one selected colour app-wide.
- **D73** K12 — kit chip side padding 0.6rem on phones (699px and below); the Sunday choose row fits 2 rows at 390px in Pop, checked.
- **D74** The kit-gaps note is replaced by your copy (3) of 11 October.
- **D75** (Rev 2) GitHub tests run once per push to a work branch, with no manual start; a pull request runs 1 date × 3 parts; all 4 dates run on main and nightly; notes-only commits use [skip ci] (done).
- **D76** (Rev 3) The smoke test saves the names of failed checks; "npm run test:failed" re-runs only those. After a fix, run test:failed first and the full suite once at the end. A GitHub failure without a code change: re-run its failed jobs only (done).
- **D77** (Rev 4) Only necessary stops: a stop is only a decision only you can make (asked together, early), a merge (one pull request per round), or an iPad read when a screen changes in a way you must judge, joined with the merge. Everything else is a line in the report.
- **D78** (Rev 4) One pull request per stop: 2 rounds — Round 1 = Kit 1.1 + Part 11; Round 2 = Parts 12 + 13 + the end report.
- **D79** (Rev 4) Lanes of one round meet in one round branch first, conflicts solved there and GitHub green, before the round's one pull request opens.
- **D80** (Rev 4) Work packages are "Part n"; pull requests are "#number". Every "PR n" row in the plan and the ledger is renamed.
- **D81** (Rev 4) The parent Week "Switch" button is a little wider and rounder than the header table, with slightly bigger words in Pop. It is made to match the table and measured again, in Kit 1.1 (your choice A).

Earlier agreed points still in force (night check 2026-10-08): the girls lose the old Chores view of past weeks; the parent money-board controls keep working from the parent screens; anything reachable only on Chores and not in the relocation map was kept and asked about.

Agreed points with their search phrases (all kept):
- Rev 4, 11 October: only necessary stops · one pull request per stop · 2 rounds · lanes meet in one round branch · Part n and #number · Week Switch matches the table · iPad read done.
- Rev 3: npm run test:failed. Rev 2: 1 date × 3 parts.
- Plan v11: Kit 1.1 · disabled look · hover look · drop dark mode · one kid switch · seven-day row part · full-width kit button · green ok button · kit list-row part · inner corners 11px · icon-only stopwatch · accepted as built · stopwatch into Part 8 · nothing builds on the flagged parts · Part 9 then Kit 1.1 · dark mode in Kit 1.1 · copy D9–D14 · Today's ribbon stays · emoji edges is not a failure · merge nothing before Plan v11 · iPad read at the same stop · corrected copy · ticked from its sheet · 60px of name room · Q3's heading 48px · K10, K12 and K11 · no round stepper left · one selected colour · choose row fits 2 rows · owner's copy (3).
- Plan v10 Rev 2: every one-test run on this PC under 40 s (D41); build from the exact values is Routine (D42); PR 7, PR 8 and PR 10 at the same time (D43); Rev of Plan v10 (D44).
- Plan v10: every GitHub job under 5 minutes comes before PR 5; 3 parts side by side; no stacks for the rest of this plan (D40).
- Plan v7 in the morning; header pictures page overnight (done).
- Test today's earned; accept 1, 2, 3, 5, 6, 7, 8 and 10; keep both buttons on Day; avatar shows that girl's avatar.
- Header values (done): bottom line solid navy; exact middle of the bar; at most 1px; only as much as each width needs; keeps 4px gaps.
- page answers (2026-10-09); one 📋 button back to Full; follow the picture on 1, 9; keep 2–8; 20px at 360px; iPad in Pop at the top; measures every header; The picture wins; One header first; follow the reference exactly; rebuild the kid header; checkpoint report.
- Round avatar badge; Today's date shows on a phone; tapping the Day date; Tuesday 6 Oct; four overnight choices; checker loophole; owner's Claude Design package; hides the build number.
- One smoke job per date; took 20 minutes; way under 5 minutes; old Chores view of past weeks; parent money-board controls; not in the relocation map. PR 5 stacks: superseded by D40.

## The work, one line per pull request

- **Parts 0-pre, 0-split, 0-A, 0-B, 1, Fix, 2, 3, 4, 14, 5, 6, 7, 8, 9, 10** — merged. The GitHub test trigger (Stage 57) and the re-run of failed checks (Stage 58) — merged.
- **Round 1 — one pull request:** Kit 1.1 (dark mode removed with its guard; the twelve kit fixes K1–K12 with a test for each value; the adopters on Now, She told me, Meeting, Sunday and Grown-ups; the Week Switch matched to the table; the handoff notes) and Part 11 (Sister Sync and Profile; Today and Week/Day rows on the kit list-row). One before-and-after page; checkpoint report 4.
- **Round 2 — one pull request:** Part 12 (sheets and dialogs) and Part 13 (clean-up and guards; emoji hidden in the picture test; history to the archive). One before-and-after page; the end report (checkpoint report 5).

**Order from here:** 59 → 60 (you, only if gaps) → 49 → 50 → 51, 52 and 55 together → 41 → 53 → 61 → 54 (you) → 43 → 45 → 56 → 46 (you).

## Your stops

- **Stage 60** · stop: decision — only if the maps find gaps; all gaps of both rounds asked at once, each with a recommendation. No gaps: a line in the report, no stop.
- **Stage 54** · stop: merge, device read — merge Round 1; read the new live build on the iPad (Kit 1.1 and Part 11 change screens you must judge); checkpoint report 4 comes with the pull request. Any page difference comes as a numbered question with a picture pair (D36), at this stop.
- **Stage 46** · stop: merge, device read — merge Round 2; read the build on the iPad; the end report comes with the pull request; the plan closes.
- Everything else (lane joins, GitHub runs, reviewer results, record updates) is a line in the report.

## ❓ Decisions

None open. Answered 2026-10-11: iPad read done (D65); 2 rounds (D78); Week Switch matches the table (D81). Checkpoint report 3's three time sinks: one GitHub run per push with notes-only commits skipped (closed by Stage 57); wrong Proof lines (closed: every hand-over carries the Proof template); a reviewer demanded again after a notes-only commit (central pull-request guard, not this app — each round's report is committed before its pull request opens, so the demand is not triggered).

Checked against: the Component kit hotspot (1 round; Kit 1.1 is that round; the Week Switch is a thirteenth gap in the same round, not a new round); the Kid headers hotspot (1 round, rewrite done; the Week Switch is measured by the same header check against the same table); the Pocket money hotspot (round 10, 1 regression; no money logic or stored data changes); the Day block buttons hotspot (2 rounds, rotation redraw done in Stage 47; Round 1's Week/Day rows do not touch the block head); the Profile badge hotspot (5 rounds; untouched — Part 11 changes the Sister Sync and Profile screens' own parts, not the header badge); the Test suite run time hotspot (4 rounds, 1 recurrence; every round job stays under 5 minutes; failed checks re-run first, D76); D40 (no stacks: lanes branch from the round branch, which starts from main); D43 (lanes keep their own files; no lane edits the shared style file — its two deletions happen in the join; the one shared test list is edited by one lane at a time); D58 and D59 (Part 11's lanes start after the kit block, Stage 50); D63; request ledger rows 128, 131, 134, 135, 136 — no conflict. D65 changes from "before Kit 1.1" to done, by your answer. Checkpoint reports: each stop with an iPad read gets one (Stages 61 and 56); report 3 exists, so the next is 4. No hotspot is at its limit.

Removes/consolidates: four merge stops become two; the separate Part 11 and Part 12 merge stops (Stages 42 and 44) are superseded; the work of bringing main into other open branches after each merge is gone (one open pull request at a time); the parent Week Switch's private size (it takes the sub-bar action look the Day's actions already have); plus everything Rev 3 already removes (dark-mode rules and tokens, the dark-mode smoke check, private day chips, green yes, round steppers, second selected colour, private kid pills, 18px inner corners).

## Out of scope

Money, XP and merge rules; stored data; new features (no seven-day row on Today, D62); Track S (own plan); any change to what a check tests on GitHub.

## Stages to finish

59 stages: 41 build steps by Claude, then 18 checks (merges, iPad reads, the Chores ✓, header pictures, gap answers). Stages 1–40, 47, 48, 57 and 58 are done (44). Three stages are new (59, 60, 61); two are superseded (42, 44) and not counted. Stage numbers keep their place; the running order is above.

1. Part 0-pre tap size and fixed test dates · Claude · Build · after: — · level: Complex · size: M · group: done · proof: GitHub green on four dates (done)
2. Merge Part 0-pre (Check) · You · Check · after: 1 · group: done · proof: merged (done)
3. Part 0-split short loop, test map and one smoke job per date · Claude · Build · after: 2 · level: Complex · size: M · group: done · proof: GitHub green on four dates (done)
4. Merge Part 0-split (Check) · You · Check · after: 3 · group: done · proof: merged (done)
5. Part 0-A picture test and references · Claude · Build · after: 4 · level: Complex · size: M · group: done · proof: two runs with 0 picture differences; a planted 1-pixel change caught (done)
6. Merge Part 0-A (Check) · You · Check · after: 5 · group: done · proof: merged (done)
7. Part 0-B feature list and records · Claude · Build · after: 6 · level: Complex · size: L · group: done · proof: GitHub green (done)
8. Merge Part 0-B (Check) · You · Check · after: 7 · group: done · proof: merged (done)
9. Part 1 money re-check · Claude · Build · after: 8 · level: Complex · size: L · group: done · proof: every brief check passes (done)
10. Merge Part 1, iPad read, money walk-through (Check) · You · Check · after: 9 · group: done · proof: merged; build read (done)
11. Part 2a Chores snapshot page · Claude · Build · after: 10 · level: Routine · size: S · group: done · proof: one page (done)
12. Chores per-row ✓ (Check) · You · Check · after: 11 · group: done · proof: "all rows OK" (done)
13. Part 2b retire the Chores screen · Claude · Build · after: 12 · level: Complex · size: M · group: done · proof: GitHub green (done)
14. Merge Part 2 (Check) · You · Check · after: 13 · group: done · proof: merged (done)
15. Part 3 component kit, no visible change · Claude · Build · after: 14 · level: Complex · size: L · group: done · proof: 0 picture differences (done)
16. Merge Part 3 (Check) · You · Check · after: 15 · group: done · proof: merged (done)
17. Approve header pictures (Check) · You · Check · after: — · group: done · proof: your Claude Design package (done)
18. Part 4 headers, kid screens · Claude · Build · after: 16, 17 · level: Complex · size: L · group: done · proof: comparison page (done)
19. Checkpoint report 1 · Claude · Build · after: 18 · level: Routine · size: S · group: done · proof: report (done)
20. Part 4 fix round: rebuild the kid header from the exact values · Claude · Build · after: 18 · level: Complex · size: L · group: done · proof: measurement check green; planted faults red (done)
21. Part 4 fix round: comparison page again, reviewer · Claude · Build · after: 20 · level: Routine · size: S · group: done · proof: page; reviewer verdict (done)
22. Read the new comparison, merge Part 4, iPad read (Check) · You · Check · after: 21 · group: done · proof: merged; build live (done)
23. Part 14 measure the smoke time, prepare 3 parts · Claude · Build · after: 22 · level: Complex · size: M · group: done · proof: time table (done)
24. Part 14 group 1 sets up its own data · Claude · Build · after: 23 · level: Complex · size: M · group: done · proof: planted fault caught (done)
25. Part 14 group 2 sets up its own data · Claude · Build · after: 23 · level: Complex · size: M · group: done · proof: planted fault caught (done)
26. Part 14 group 3 sets up its own data · Claude · Build · after: 23 · level: Complex · size: M · group: done · proof: planted fault caught (done)
27. Part 14 parts on GitHub, reviewer, pull request · Claude · Build · after: 24, 25, 26 · level: Complex · size: S · group: done · proof: every job under 5 minutes (done)
28. Merge Part 14 (Check) · You · Check · after: 27 · group: done · proof: merged (done)
29. Fast one test on this PC · Claude · Build · after: 28 · level: Routine · size: S · group: done · proof: 38 s and 34 s measured (done)
30. Part 5 headers, parent portal from the exact values · Claude · Build · after: 29 · level: Routine · size: M · group: done · proof: measured; reviewer; GitHub green (done)
31. Decide differences, merge Part 5 (Check) · You · Check · after: 30 · group: done · proof: merged (done)
32. Part 6 words and numbers · Claude · Build · after: 31 · level: Complex · size: L · group: done · proof: 77 numbers per girl, 0 differ (done)
33. Part 6 one empty style file per screen · Claude · Build · after: 32 · level: Complex · size: S · group: done · proof: planted faults caught; 0 picture differences (done)
34. Merge Part 6, iPad read, one Sunday per girl (Check) · You · Check · after: 33, 38 · group: done · proof: merged; the live build read on the iPad; one Sunday per girl walked (done, owner answer 2026-10-11)
35. Part 7 Today · Claude · Build · after: 34 · level: Complex · size: M · group: done · proof: old classes gone; "with Mum" readable in Calm; page with 19 items (done)
36. Part 8 Week and Day · Claude · Build · after: 34 · level: Complex · size: M · group: done · proof: old classes gone; page with 9 questions (done)
37. Part 10 Parent portal · Claude · Build · after: 34 · level: Complex · size: M · group: done · proof: old classes gone; page with 15 questions (done)
38. Decide three pages, merge Parts 7, 8, 10 (Check) · You · Check · after: 35, 36, 37, 47 · group: done · proof: three pull requests merged (done)
39. Part 9 Money and Sunday · Claude · Build · after: 34 · level: Complex · size: L · group: done · proof: old classes gone; 331 Sunday figures unchanged; page with 12 questions (done)
40. Merge Part 9 (Check) · You · Check · after: 38, 48 · group: done · proof: merged (done)
41. Part 11 Sister Sync and Profile · Claude · Build (opus-worker) · after: 52 · level: Complex (reason: which private parts map to which kit parts is a design choice on two screens the kit has not touched) · size: M · group: R1-D · files: in Technical details · tests: the short loop, the Sister Sync and Profile smoke lines, the picture test on GitHub · proof: old classes gone; Sister Sync and Profile rows pass; its lane green on GitHub, ready for the join
42. Decide page, merge Part 11 (Check) · SUPERSEDED — joined into Stage 54 (D78)
43. Part 12 sheets and dialogs · Claude · Build (opus-worker) · after: 54 · level: Complex (reason: 27 overlays, one sheet and one dialog style — a design choice) · size: L · group: R2-A · files: in Technical details · tests: the short loop, the overlay smoke lines, the picture test on GitHub · proof: one sheet and one dialog style left; each of the 27 overlays opens and closes; on the Round 2 branch with GitHub green
44. Decide page, merge Part 12 (Check) · SUPERSEDED — joined into Stage 46 (D78)
45. Part 13 clean-up and guards, emoji hidden in the picture test, history to the archive; Round 2 page, reviewer · Claude · Build (opus-worker) · after: 43 · level: Complex (reason: each guard's shape and the way to hide emoji without hiding real changes are design choices) · size: L · group: R2-B · files: in Technical details · tests: the whole check list, the money and Sunday unit tests, the picture test on GitHub twice · proof: each guard fails on a planted example; a planted real change still fails the picture test with emoji hidden, and two runs agree on every picture; money and Sunday tests unchanged; one before-and-after page for Parts 12 and 13; reviewer verdict; GitHub green on the Round 2 head
46. Merge Round 2, iPad read (Check) · You · Check · after: 45, 56 · group: R2-stop · stop: merge, device read · proof: merged; build read on the iPad; the plan closes
47. Part 8 ✓ and stopwatch rules before its merge · Claude · Build (opus-worker) · after: 36 · level: Complex · size: M · group: done · proof: 44×44 ✓ and icon-only ⏱ from 48px; rotation redraw; reviewer; GitHub green (done)
48. Part 9 reviewer, kit check and pull request · Claude · Build · after: 39 · level: Complex · size: S · group: done · proof: pull request open and green (done)
49. Kit 1.1 — dark mode removed, guard added · Claude · Build (sonnet-worker) · after: 60 · level: Routine (the list is exact: three rules, seven tokens, one smoke check, one declaration, one guard rule, three note lines) · size: M · group: R1-A · files: in Technical details · tests: the whole check list, the smoke parts check, the kit smoke line, the picture test on GitHub · proof: no dark-mode rule or dark token is left; the root declares the light scheme; the dark-mode smoke check is gone and the parts list passes its own check; three plants fail the check list; 0 picture differences
50. Kit 1.1 — the twelve fixes in the kit, value table and test · Claude · Build (opus-worker) · after: 49 · level: Complex (reason: the parts' states and the one-switch look are design choices; the exact table is checked before any screen adopts) · size: L · group: R1-B · files: in Technical details · tests: the kit unit test, the kit smoke line, the look-token check, the header measurement check, the picture test on GitHub · proof: the header measurement check is unchanged and green and 0 header pictures differ; the kit-gaps note (K1–K12) byte for byte, with a value table; the kit smoke check measures each value on a fixture and fails on five planted faults; the kit class list is complete both ways
51. Kit 1.1 — adopters on the parent and Grown-ups screens, Week Switch to the table · Claude · Build (sonnet-worker) · after: 50 · level: Routine (exact values from K1–K12 and the header table) · size: M · group: R1-C · files: in Technical details · tests: the parent kit smoke line (extended), the header measurement check, the short loop · proof: the header measurement check is green and now also measures the parent Week Switch as a sub-bar action (height, side padding, corner and Pop text size equal the table; fails first on the current button); Now's and She told me's day rows are the kit's seven-day row; one girl switch element in the header's look; Approve and She bought it are green ok buttons; Run family meeting on Now is full width; ▶ on the last week shows the disabled look; every Grown-ups and request-sheet − / + is the kit stepper, measured; parent smoke lines green
52. Kit 1.1 — adopters on Meeting and Sunday · Claude · Build (opus-worker) · after: 50 · level: Complex (reason: the Meeting row must be identified from two candidates, and seven 44px cells plus a two-row choose row must fit a 390px phone) · size: M · group: R1-C · files: in Technical details · tests: the Sunday kit smoke line (extended), the short loop · proof: the Meeting seven-day row is the kit's part; Run family meeting on Meeting is full width; the parent's ✓ Yes / Agree / result are green ok buttons; Sunday's steppers are the kit stepper; the choose row fits 2 rows at 390px in Pop (new check, fails on a planted third row); 331 Sunday figures unchanged; Sunday smoke lines green
53. Round 1 — join the lanes, delete the two shared rules, notes, pictures, page, reviewer · Claude · Build (sonnet-worker; the lane joins and the build bump to opus-worker) · after: 41, 51, 52, 55 · level: Routine · size: M · group: R1-E · files: in Technical details · tests: the shell check, the dead-style check, the picture test on GitHub · proof: every lane joined into the Round 1 branch, conflicts solved; the private green-yes rule and the shared round stepper rule deleted, no round stepper left anywhere (dead-style check); D9–D14 and the header note in place; the corrected kit-gaps note in place; one before-and-after page for Kit 1.1 and Part 11, iPad Pop first, one row per K, the Week Switch and each Part 11 screen; references refreshed from the GitHub artifact; build bumped; every GitHub job under 5 minutes; regression table; reviewer verdict; GitHub green on the Round 1 head
54. Merge Round 1, iPad read (Check) · You · Check · after: 61 · group: R1-stop · stop: merge, device read · proof: page decided; merged; the new live build read on the iPad
55. Part 11 — Today and Week/Day rows on the kit list-row · Claude · Build (opus-worker) · after: 50 · level: Complex (reason: which rows and states take the part on three screens is a design choice; the Day's rows sit inside the block layout) · size: M · group: R1-C · files: in Technical details · tests: the Today and Week/Day smoke lines, the short loop, the picture test on GitHub · proof: Today's rows (the catch-up day row included) and the Week/Day list rows are the kit list-row at 44px, 2px border, 11px corner; the private row rules are gone; a planted 18px row corner fails the kit check
56. Checkpoint report 5 — the end report; the Round 2 pull request opens · Claude · Build (main session; reports are its files) · after: 45 · level: Routine · size: S · group: R2-C · files: in Technical details · tests: none · proof: Quick read, the measured part from the report tool, the one-test time line, the suggestions list; committed as a notes-only commit before the pull request opens; the pull request open on GitHub green
57. GitHub tests once per push, 1 date on a pull request, 4 dates on main and nightly · Claude · Build (sonnet-worker) · after: 47 · level: Routine · size: S · group: done · proof: one push → one run, 3 smoke jobs; a notes-only commit starts none; main and nightly 4 dates; every job under 5 minutes (done)
58. Re-run only failed smoke checks · Claude · Build (opus-worker) · after: 57 · level: Routine · size: S · group: done · proof: planted failing check saved alone; the re-run ran only it; file ignored by git; rule in the test notes (done)
59. Maps for both rounds; every gap asked at once · Claude · Build (Explore, read only) · after: 58 · level: Routine · size: S · group: R0-A · files: none changed · tests: none · proof: one list, per Part, of the files and lines each Complex stage touches and every control or case the kit or the references do not cover, each gap with a recommendation
60. Answer the gaps (Check) · You · Check · after: 59 · group: R0-stop · stop: decision — only if Stage 59 lists gaps; with no gaps this stage is COMPLETE with "no gaps" and is a line in the report · proof: every gap answered in one reply
61. Checkpoint report 4; the Round 1 pull request opens · Claude · Build (main session; reports are its files) · after: 53 · level: Routine · size: S · group: R1-F · files: in Technical details · tests: none · proof: Quick read, the measured part from the report tool, the one-test time line, the suggestions list; committed as a notes-only commit before the pull request opens; the pull request open on GitHub green

## Technical details

**State (2026-10-11, 7:25 PM MDT).** `main` @ `8163f1f` (#148 setup update merged). #142 Part 7, #143 Part 8, #144 Part 10, #145 Part 9, #146 Stage 57, #147 Stage 58 merged. No open pull request. Live build after #145. `docs/reports/weekly-planner-consistency-pass-checkpoint-3.md` exists (2026-10-11) and names the next report as 4.

**Rounds and branches.** Round 1: `claude/consistency-r1` from `main`. Stages 49, 50 in the main folder on it. Group R1-C (51, 52, 55) runs three lanes at once: one worker in the main folder, two in `../Weekly-Planner-lane-b` and `../Weekly-Planner-lane-c` (`git worktree add … -b claude/r1-<stage>` from `claude/consistency-r1`). Stage 41 after 52 in its own lane (both edit `tests/smoke-parts/parts.js`). No lane edits `css/app.css`; its two deletions are Stage 53's. Stage 53 merges each lane branch into `claude/consistency-r1`, solves conflicts, runs the short loop and gets GitHub green on the head. Stage 61 commits the report with `[skip ci]` and then opens the one pull request (`gh pr create`, ready for review) — the notes commit precedes the pull request so the pull-request guard does not demand a second reviewer (checkpoint report 3, sink 1); if the guard refuses a head with no run, push the report without `[skip ci]` (one 1-date run). Round 2: `claude/consistency-r2` from `main` after Stage 54; 43 then 45 sequential on it; 56 the same way as 61. After a merge, remove lane worktrees with no uncommitted changes.

**Stage 59 (Explore, read only).** Maps for Stages 50, 52, 55, 41, 43, 45; list each control or case not covered by K1–K12, `docs/handoff/header-exact-values.md` or the Part pages. Gaps go to the owner in one reply (Stage 60).

**Stage 49 (sonnet-worker, Routine, M).** `css/app.css`: delete the three `@media (prefers-color-scheme: dark)` rules (l.2153, 2190, 2195) and the seven `--dark-*` tokens (l.331–338); add `color-scheme: light;` in the top `:root`. `tests/smoke.js`: delete `theR5ScreensReadInDarkMode`. `tests/smoke-parts/parts.js` l.330: remove its entry. `tests/check-look-tokens.js`: rule 6 "no dark scheme" — fail on `prefers-color-scheme` in `css/`, `js/`, `index.html`, `sw.js`; fail when the top `:root` lacks `color-scheme: light`. Notes: `ARCHITECTURE.md` l.4044–4060, `FEATURES.md` l.306, `docs/handoff/looks-calm-pop.md` l.105. Plants: a dark rule in `css/today.css`; `matchMedia('(prefers-color-scheme: dark)')` in a script; the declaration removed.

**Stage 50 (opus-worker, Complex, L).** As Rev 3: `css/app.css` kit block K1–K12 (`.ui-btn:disabled`, hover under `@media (hover: hover)`, `.ui-kids` joined switch, `.ui-days`, `--radius-cell: 12px`, `.ui-btn--block`, `.ui-btn--ok`, `.ui-row`/`.ui-row--add`, inner corners `--radius-btn`, `--pill-on: var(--sel)`, chip padding 0.6rem ≤ 699px). Copy `D:/User/Heng Z/Downloads/kit-gaps-pr7-10 (3).md` → `docs/handoff/kit-gaps-pr7-10.md`; value table `docs/handoff/kit-1-1-values.md`. `tests/helpers.test.js` `UI_KIT_CLASSES`; `tests/smoke.js` `theComponentKitHoldsItsSizes` with five plants. `FEATURES.md` Component kit rows.

**Stage 51 (sonnet-worker, Routine, M).** As Rev 3 (`js/32-parent-now.js`, `js/11-parent.js`, `js/46-grownups.js`, `js/45-requests.js`, `css/parent.css`, `tests/smoke-parts/parent.js` — the Grown-ups and request-sheet stepper sizes measured here, in this lane's own files), plus D81: `js/07-week-view.js` l.408 — the Week "Switch" (`.pb-switch`) drops `ui-btn ui-btn--secondary` for the sub-bar action classes `pv-btn pb-action` that the Day's actions use (`css/app.css` l.2979 and l.5344: min-height 44, pad 0 10, r12, body 16px, the Parent sub-bar rows of `docs/handoff/header-exact-values.md`); `tests/smoke.js` `everyHeaderMeasuresToTheExactValues`, parent part (~l.27720): the measured sub-bar actions `.pv-btn, .pb-back-btn` gain `.pb-switch` — red first on the current button. No `css/app.css` edit: `.gu-yes` is deleted in Stage 53. Grep the tests for the old class names.

**Stage 52 (opus-worker, Complex, M).** As Rev 3: `js/44-sunday.js` (`.sd-days` → `.ui-days`; l.430, 446, 449, 453 → `ui-btn ui-btn--ok`; Run family meeting → `ui-btn--block`; `.sd-step` → the kit stepper); `css/money.css`; `js/15-meeting.js` only if the row is there; `tests/smoke-parts/money-screens.js` extended; new choose-row check listed in `tests/smoke-parts/parts.js`. No `css/app.css` edit: the shared round stepper rule is deleted in Stage 53. 331-figure text dump before and after.

**Stage 55 (opus-worker, Complex, M).** `js/31-today.js` (`.td-row`, `.td-catchup-day` → `.ui-row`; `.td-rib-*` untouched), `css/today.css`, `js/07-week-view.js` (list rows only; the Switch line is Stage 51's — the join resolves the one file both touch), `js/08-day-view.js`, `css/week-day.css`, `tests/smoke-parts/today.js`, `tests/smoke-parts/week-day.js`. No parts-list edit.

**Stage 41 (opus-worker, Complex, M).** `index.html`, `js/10-social.js`, `css/social.css`, `tests/smoke-parts/social.js` (new), `tests/smoke-parts/parts.js`, the `tests/smoke.js` require line.

**Stage 53 (sonnet-worker, Routine, M; lane joins and `sw.js` bump to opus-worker).** Join `claude/r1-51`, `claude/r1-52`, `claude/r1-55`, `claude/r1-41` into `claude/consistency-r1`. `css/app.css`: delete `.gu-yes` and the shared round stepper rule (`.sd-step, .gu-step, .rq-opt.mny-step, .gu-opt.mny-step, .rq-race .rq-opt.mny-step`, ~l.7464) once `check-dead-css` shows no user. `docs/handoff/consistency/app-consistency-plan-v1.md` D9–D14 dated notes; `docs/handoff/header-exact-values.md` one dated line (D66), the sub-bar rows unchanged (D81 builds to them); `docs/handoff/consistency/round1-compare.html` (K1–K12, Week Switch, Part 11 screens; iPad Pop first; 1194 and 390; both looks); `tests/reference/` from the CI artifact; `SW_VERSION` = `APP_BUILD`; `change_list.py` list for the pull request; regression table against `FEATURES.md`; reviewer; GitHub green on the head.

**Stage 61 (main session).** `docs/reports/weekly-planner-consistency-pass-checkpoint-4.md`: Quick read; `plan_report.py` measured part (or the blocker named again if the command guard refuses); one-test time line; suggestions. `[skip ci]` commit, then the Round 1 pull request.

**Stages 43, 45.** Stage 43: `css/app.css`, `js/09-sheets.js`, `index.html`. Stage 45: `js/18-rules.js`, `package.json`, `docs/archive/`, `tests/pictures.js` (hide colour emoji before each shot; a planted real change must still fail; two GitHub runs must agree); delete the shared `.pill-btn`, `.btn-icon`, `.btn-confirm`, `.pv-btn`, `.pn-card` and similar rules once unused (`.pv-btn` only if the sub-bar actions have moved to a kit class by then; otherwise it stays); `docs/handoff/consistency/round2-compare.html`; reviewer; GitHub green on the head.

**Stage 56 (main session).** `docs/reports/weekly-planner-consistency-pass-checkpoint-5.md`: Quick read; `plan_report.py` measured part; one-test time line; suggestions. `[skip ci]` commit, then the Round 2 pull request.

**GitHub tests (since #146, #147).** `.github/workflows/ci.yml` runs once per push on every branch (no `pull_request` trigger; the push run reports on the pull request's head commit): off `main` 1 date (2026-10-07) × 3 smoke parts plus checks, browser and pictures; on `main` and nightly 4 dates × 3 parts. `[skip ci]` on notes-only commits. After a fix: `npm run test:failed` first, full suite once at the end on GitHub; a GitHub failure with no code change: `gh run rerun <id> --failed`.

**Routing.** 49, 51, 53 sonnet-worker (Routine; `sw.js` bump and lane joins to opus-worker); 50, 52, 55, 41, 43, 45 opus-worker with the Stage 59 map; 59 Explore; 56, 61 main session (reports and git). Reviewer once per round, on the joined branch, before its pull request. No full `npm test` on this PC (D16). Every hand-over: "grep the tests for the old form", `Also: update the record row, commit and push`, and the `Proof:` line template ("counts against main, cite the head run").

**Governance, every pull request.** 1. Read `CLAUDE.md` and `ARCHITECTURE.md`. 2. Short loop on this PC; GitHub green on the head commit before the pull request opens. 3. Bump `SW_VERSION` and `APP_BUILD` together. 4. Regression table against `FEATURES.md`. 5. iPad 1194×834 and phone 390×844, Pop and Calm. 6. No stacks (D40). 7. References never go stale (row 128).

**Record at approval.** `## Approved baseline` → Plan v11 Rev 4, this file. Ledger: every row "of 59"; rename every "PR n" stage row to "Part n" (D80; the design-decision lines keep their quoted search phrases); Stage 34 COMPLETE (owner answer 2026-10-11, 7:25 PM MDT); Stages 42 and 44 SUPERSEDED (D78); rows 41, 43, 45, 46, 49–56 reworded and re-dependent as above (row 56 → "Checkpoint report 5, the end report"); rows 59, 60, 61 added. Design decisions: the Rev 4 points added `[in v11 Rev 4]` with the search phrases above (only necessary stops; one pull request per stop; 2 rounds; lanes meet in one round branch; Part n and #number; Week Switch matches the table; iPad read done). Hotspot: Component kit row notes the Week Switch as the thirteenth gap in round 1. `## Where we are`: no open pull request; next Stage 59; restart line `Continue Weekly-Planner consistency pass on branch main; next: Stage 59 of 59 — maps for both rounds.`

**Risks.** Round 1 is one large pull request (kit block plus seven screens' files); the reviewer runs once on the joined branch and the before-and-after page is longer. Lane joins: `tests/smoke-parts/parts.js` is edited by 52 then 41 in sequence, and `js/07-week-view.js` by 51 (one line) and 55 (rows) — small, resolved in Stage 53; no lane edits `css/app.css`. K11 recolours every picked chip in Pop — one large picture refresh. A `[skip ci]` report commit leaves the pull request head without a run; the fallback is one 1-date run. Emoji jitter may cost one extra GitHub run per round until Part 13 (D63).

Plan: 58 → 59 stages — Stages 59 (maps), 60 (gap answers, only if gaps) and 61 (checkpoint report 4) added; Stages 42 and 44 superseded by the round merges (D78).

Agreed points: 81 of 81 in the plan
