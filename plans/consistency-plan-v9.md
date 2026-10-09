# Plan v9 — Weekly-Planner consistency pass — Approved 2026-10-09

| Summary |
|---|
| What changes for you: every kid header is built again to your exact values, so it matches your pictures; the test measures each header and fails on any mismatch. Then the parent header, from the same values. |
| What changed and why: your pictures and the build did not match; you answered the 15 differences and sent the exact values. A checkpoint report comes first. |
| What I need to do: approve Plan v9; later read the new comparison page, merge PR 4, read the build on the iPad. |

🟩 **Rev 2** — **Quick read** · 282 words · about 2 min

**Summary**
- Goal: one header everywhere, built to your exact header values; then one set of parts, one money and date style, a picture test, slim records.
- Done: 18 of 42 stages. Next: the checkpoint report and the PR 4 rebuild, side by side.
- I need from you: approve Plan v9; later read the new comparison page, merge PR 4, read the build on the iPad.

**What changed since Plan v8**
- 🟩 **Rev 2** — The kid header is built again from your table of exact values, with new parts. The picture wins on any difference, and one header is checked with you before the rest.
- Your 15 answers are in: 1 and 9–14 follow the picture, 2–8 stay, 15 is 20px unless it does not fit on a 360-wide phone.
- The smoke test measures every header against the table and fails on any mismatch.
- A checkpoint report comes first, with the one-test run 149 s before and 33 s after.
- The new comparison page starts with Today, Week, Day, Money and Meeting on the iPad in Pop. PR 5 uses the same table for the parent header.

🟩 **Rev 2** — **Decisions:** None open. You answered everything on 9 October, plus three answers today: the picture wins, one header first, and a rule proposal.

**Next steps**
- Stage 19 checkpoint report: the report with the measured part and the one-test times.
- Stage 20 PR 4 rebuild: every kid header measures to your table on GitHub; the Day date size at 360 wide reported.
- Stage 21 new comparison page: your pictures beside the build, iPad Pop first; PR 4 updated.
- … 21 more steps in the full plan below

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
- **D20** One smoke job per date, about 8 minutes accepted; the job that took 20 minutes was explained and fixed; keep the short test loop, the test map and the time tool; Stages 41–42 (slowest tests set up their own data) stay as the way under 5 minutes.
- **D21** The header pictures are your Claude Design package (9 October 2026), not Claude's mockups. Heights: standard 64 on the iPad and 60 on the phone; money 72 and 64; meeting 62 + 44 on the iPad and 60 + 44 on the phone; parent like standard, with a 44 sub-bar when viewing a girl.
- **D22** The unused-style checker loophole is closed (done in PR 4).
- **D23** The picture test hides the build number (done in PR 4).
- **D24** The four overnight choices built in PR 3 are kept.
- **D25** The round avatar badge is on every kid header at every width; its words stay for screen readers.
- **D26** Today's date shows on a phone. Only the money header hides its date on a phone.
- **D27** On a phone, Copy a day moves to tapping the Day date; the iPad keeps the button.
- **D28** The iPad Day title reads "Tuesday 6 Oct"; the span form ("Tue–Thu") waits for PR 6.
- **D29** PR 4 does not match the pictures: rebuild the kid header from your table of exact values with new parts. The old header parts are not tuned; the kid header stops using them, and each is deleted when nothing uses it.
- **D30** Differences 1, 9, 10, 11, 12, 13, 14 follow the picture (money iPad header without title or date; date and week arrows centred; one joined Full/Preview switch; Pop chosen part yellow; pink avatar and pink meeting ring; "Signed" and "Week of Oct 5 – 11"). Keep 2–8 as built (Sound button, phone ◀ only, 📑, dashed meeting line, grown-up money second row, Sister Sync and Print headers, back names where she came from).
- **D31** Difference 15: the phone Day date is 20px; smaller only if 20px does not fit at 360px wide. The worker measures at 360 and reports; it does not choose a smaller size silently.
- **D32** The smoke test measures every header against the exact values (bar height, context centred within ±8px, date size and colour, badge size and colour, Full/Preview one part) and fails on any mismatch.
- **D33** The comparison page is made again, your pictures beside the build, with Today, Week, Day, Money and Meeting on the iPad in Pop at the top.
- **D34** A checkpoint report is written now, in the end-of-plan report format, with the one-test run 149 s before and 33 s after the fast one-test change. Then PR 5.
- **D35** PR 5 builds the parent header from the same table (purple bar, 44 badge, 44 buttons, 44 sub-bar when viewing a girl) and stacks on the PR 4 branch (at most 3 open pull requests in a stack).
- 🟩 **Rev 2** — **D36** The picture wins: where the build and your picture differ, the build follows the picture. Only a part that cannot fit becomes a question, with a picture pair.
- 🟩 **Rev 2** — **D37** One header first: Today on the iPad in Pop is built and shown beside your picture; the other screens are built only after your OK on that pair.
- 🟩 **Rev 2** — **D38** The rule "follow the reference exactly" goes to the central rules as a proposal (written in the record; the central rules are changed only there).

Earlier agreed points still in force (night check 2026-10-08): the girls lose the old Chores view of past weeks; the parent money-board controls keep working from the parent screens; anything reachable only on Chores and not in the relocation map was kept and asked about.

## The work, one line per pull request

- **PR 0-pre, 0-split, 0-A, 0-B, PR 1, Fix, PR 2, PR 3** — merged.
- **Fast one-test run** — merged into the PR 4 branch: one check 149 s → 33 s.
- **PR 4** (open, not merged) Kid headers. **Fix round in this version:** rebuilt from your exact values (D29–D31), the smoke measurement check (D32), the comparison page again (D33). Same pull request, updated after the reviewer.
- **PR 5** Parent portal headers from the same table (D35); Reading size default (D14).
- **PR 6** Words and numbers: one money style, one date style, one kid name.
- **PRs 7–12** Components, one surface each: Today, Week/Day, Money and Sunday, Parent, Sister Sync and Profile, sheets.
- **PR 13** Clean-up and guards; history to the archive.
- **PR 14** Slowest tests set up their own data; every GitHub job under 5 minutes.

## Your stops

- You merge every pull request. Do not merge PR 4 until you have read the new comparison page (Stage 22).
- iPad read of the build: after PR 4, PR 6 and PR 13.
- Any difference still visible on the new comparison page comes to you as a numbered question with a picture pair.

## ❓ Decisions

None open. Decided 2026-10-09: rebuild the kid header from the exact values; 1 and 9–14 follow the picture, 2–8 stay, 15 is 20px unless it does not fit at 360 wide; smoke measurement checks; comparison page again, iPad Pop first; checkpoint report now; then PR 5 stacked on the PR 4 branch.

Checked against: the Kid headers hotspot row (round 1: context pushed right, date grey and small, two Full/Preview buttons, cream badge; rewrite chosen by you; the smoke measurement is the guard); the Profile badge hotspot row (4 fix rounds, over its limit; rewrite recorded 9 October; the badge is rebuilt with the header and measured by smoke; the old regression and workaround end with it); the PR 4 history (first build, review fixes, first comparison page with 15 differences, your answers in ledger row 134); Looks–Calm meaning (new colours are tokens with a value in both looks); test suite run time (round 3; the fast one-test change is inside it); ledger rows 42, 70, 113–134. Plan reviewer before showing: 8 findings, all built into this version.

Removes/consolidates: the drifted PR 4 header styles → one new header family built from one table, deleted rather than tuned; the old top bar, week stepper and icon button retired from the kid header now and deleted when PR 5, PR 10 and PR 11 remove their last users; two header checks folded into the one measurement check; 18 money formatters → 1; many part styles → one kit; Chores screen; 7 unused functions; "no stacked branches" → stacks of at most 3.

## Out of scope

Money, XP and merge rules; stored data; new features; Track S (own plan); parent headers inside the PR 4 fix round (PR 5's job).

## Stages to finish

42 stages: 22 build steps by Claude, then 20 checks by you (merges, iPad reads, the Chores ✓, header pictures, comparison pages). Stages 1–18 are done. Stages 19–21 are new; Stage 22 is Plan v8's Stage 19; every later stage keeps its wording and moves down by three.

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
19. Checkpoint report 1 · Claude · Build· after: 18 · level: Routine · size: S · group: B · tests: none (document) · proof: Quick read, then the unedited measured part from the report tool, then "one-test run: 149 s before, 33 s after"; committed on the PR 4 branch
20. PR 4 fix round: rebuild the kid header from the exact values, smoke measurement check · Claude · Build· after: 18 · level: Complex · size: L · group: B · tests: the short loop, the new measurement check alone, the unused-style and look-colour checks · proof: first, Today on the iPad in Pop is built and sent to you beside your picture, and the rest waits for your OK (D37); then a per-screen table of expected parts and values (Calm values read from the source picture) is added to the copied table, before any check is written; the new measurement check passes for every kid header at iPad and phone in Pop and Calm on all four dates and fails on a planted 4px offset, a planted two-button switch and a planted wider right group; the date sits within 8px of the bar centre even when the two sides differ in width; the ring, "Signed", "Week of Oct 5 – 11" and the money iPad header without title or date are measured; the kept behaviours still pass (Day date tap for Copy a day on the phone, badge hidden during the meeting lock, back names, parent Day bar compact, Sister Sync on one line at 375 wide, size floors); no old header class name left anywhere; the 360-wide Day date measurement in the PR; references refreshed; CI green on the head commit
21. PR 4 fix round: comparison page again, reviewer, PR 4 updated · Claude · Build· after: 20 · level: Routine · size: S · group: C · tests: none (page) · proof: the page opens with the five iPad Pop pairs, your picture beside the build, then every other pair; remaining differences numbered with measured numbers; reviewer verdict recorded; CI green on the head commit
22. Read the new comparison, merge PR 4, iPad read (Check) · You · Check · after: 21 · group: D · proof: your OK on the page (or a Fix row per mismatch); PR 4 merged; build read on the iPad in both looks
23. PR 5 headers, parent portal from the exact values · Claude · Build· after: 21 · level: Complex · size: M · group: E · tests: the short loop, the measurement check with parent screens · proof: one purple bar on every parent screen, badge 44, buttons 44, 44 sub-bar when viewing a girl, all measured; Confirm all and Mark reviewed rows pass; Reading size defaults to 1.2; old parent top bar and month stepper gone; side-by-side page; GitHub green
24. Decide differences, merge PR 5 (Check) · You · Check · after: 22, 23 · group: F · proof: page decided; PR 5 merged
25. PR 6 words and numbers · Claude · Build· after: 24 · level: Complex · size: L · group: G · proof: one Sunday per girl shows the same totals in the new format; money and Sunday tests pass; a planted local formatter fails the check
26. Merge PR 6, iPad read, one Sunday per girl (Check) · You · Check · after: 25 · group: H · proof: merged; build read; one Sunday per girl walked
27. PR 7 Today · Claude · Build· after: 26 · level: Complex · size: M · group: I · proof: old classes gone; Today rows pass; "with Mum" row readable in Calm; before/after page
28. Decide page, merge PR 7 (Check) · You · Check · after: 27 · group: J · proof: page decided; merged
29. PR 8 Week and Day · Claude · Build· after: 28 · level: Complex · size: M · group: K · proof: old classes gone; Week and Day rows pass; before/after page
30. Decide page, merge PR 8 (Check) · You · Check · after: 29 · group: L · proof: page decided; merged
31. PR 9 Money and Sunday · Claude · Build· after: 30 · level: Complex · size: L · group: M · proof: old classes gone; money rows and tests pass; before/after page
32. Decide page, merge PR 9 (Check) · You · Check · after: 31 · group: N · proof: page decided; merged
33. PR 10 Parent portal · Claude · Build· after: 32 · level: Complex · size: M · group: O · proof: old classes gone; parent rows pass; before/after page
34. Decide page, merge PR 10 (Check) · You · Check · after: 33 · group: P · proof: page decided; merged
35. PR 11 Sister Sync and Profile · Claude · Build· after: 34 · level: Complex · size: M · group: Q · proof: old classes gone; Sister Sync and Profile rows pass; before/after page
36. Decide page, merge PR 11 (Check) · You · Check · after: 35 · group: R · proof: page decided; merged
37. PR 12 sheets and dialogs · Claude · Build· after: 36 · level: Complex · size: L · group: S · proof: one sheet and one dialog style left; each of the 27 overlays opens and closes; before/after page
38. Decide page, merge PR 12 (Check) · You · Check · after: 37 · group: T · proof: page decided; merged
39. PR 13 clean-up and guards, history to the archive · Claude · Build· after: 38 · level: Complex · size: L · group: U · proof: each guard fails on a planted example; money and Sunday tests unchanged; GitHub green
40. Merge PR 13, iPad read (Check) · You · Check · after: 39 · group: V · proof: merged; build read on the iPad
41. PR 14 slowest tests set up their own data, every job under 5 minutes · Claude · Build· after: 40 · level: Complex · size: M · group: W · proof: every GitHub job under 5 minutes; green on all four dates
42. Merge PR 14 (Check) · You · Check · after: 41 · group: X · proof: merged; the plan closes

## Technical details

**Files per stage.** Stage 1: `js/13-chores.js`, `css/app.css`, `tests/smoke.js`, `.github/workflows/ci.yml`; Stage 3: `tests/smoke.js`, `.github/workflows/ci.yml`, `package.json`, `tests/README.md`; Stage 5: `tests/pictures.js`, `tests/reference/`; Stage 7: `FEATURES.md`, `ARCHITECTURE.md`, `WORKING_RECORD.md`; Stage 9: `js/43-sunday-core.js`, `js/44-sunday.js`, `js/46-grownups.js`; Stage 11: `tests/out/chores-snapshot.html`; Stage 13: `index.html`, `js/13-chores.js`, `tests/smoke.js`; Stage 15: `js/05-helpers.js`, `js/47-header.js`, `css/app.css`; Stage 18: `js/47-header.js`, `css/app.css`, `tests/smoke.js`, `tests/reference/`; Stage 19: `docs/reports/weekly-planner-consistency-pass-checkpoint-1.md`; Stage 20: `docs/handoff/header-exact-values.md`, `index.html`, `js/47-header.js`, `css/app.css`, `js/31-today.js`, `js/07-week-view.js`, `js/08-day-view.js`, `js/15-meeting.js`, `js/21-money-data.js`, `js/22-money-page1.js`, `js/16-print.js`, `tests/smoke.js`, `tests/helpers.test.js`, `tests/README.md`, `FEATURES.md`, `tests/reference/`, `sw.js`, `js/01-config.js`; Stage 21: `docs/handoff/consistency/pr4-headers-compare.html`; Stage 23: `index.html`, `js/11-parent.js`, `js/33-parent-app.js`, `js/07-week-view.js`, `js/09-sheets.js`, `js/47-header.js`, `css/app.css`, `tests/smoke.js`, `tests/reference/`; Stage 25: `js/05-helpers.js`, `js/14-money.js`, `js/44-sunday.js`, `tests/check-money-words.js`; Stage 27: `js/31-today.js`, `css/app.css`, `tests/smoke.js`; Stage 29: `js/07-week-view.js`, `js/08-day-view.js`, `css/app.css`; Stage 31: `js/14-money.js`, `js/44-sunday.js`, `css/app.css`; Stage 33: `js/11-parent.js`, `js/32-parent-now.js`, `css/app.css`; Stage 35: `index.html`, `js/10-social.js`, `css/app.css`; Stage 37: `css/app.css`, `js/09-sheets.js`, `index.html`; Stage 39: `js/18-rules.js`, `tests/check-headers.js`, `package.json`, `docs/archive/`; Stage 41: `tests/smoke.js`, `tools/smoke-times.js`.

**Branch and pull requests.** Fix-round work on `claude/consistency-4` (PR #135, base retargets to `main` since #133 merged as `09c17b7`; PR #136 merged into the branch at `500f153`). Bump `SW_VERSION` and `APP_BUILD` together. PR 5 branches from `claude/consistency-4` and opens against it (stack of 2; limit 3); it merges the branch once if Stage 20 changes after it branches; retarget to `main` after #135 merges. The approved plan file is committed as `plans/consistency-plan-v9.md` (draft copy already in the worktree, uncommitted).

**Stage 19.** Main session writes it (record document; recorded exception in governance 1). Quick read: Summary; What changed from the plan (PR 0-split's three designs, the Fix stage, the fast one-test run, the PR 4 fix round); Decisions during the work (D14–D35, one line each); Suggestions (rules, checks or habits that cost more than they saved, with numbers). Then `plan_report.py "Weekly-Planner consistency pass" --dir <transcripts dir>` output unedited, UTF-8 (keep the `<!-- metrics -->` line). Then "One-test run: 149 s before PR #136, 33 s after (one `SMOKE_ONLY` check on this PC)".

**Stage 20 — rebuild (D29–D32, D36, D37).** Explore map first. Pilot: after the per-screen table and the measurement check exist, build Today iPad Pop only, send the owner the pair (owner picture `headers/standard-ipad-pop.png` beside the CI or local screenshot) and wait for OK; then the other screens. D36: any difference from the picture is fixed toward the picture; only a no-fit case becomes a question with a picture pair. Copy `header-exact-values.md` to `docs/handoff/` and `Header System.dc.html` to `docs/handoff/consistency/headers/source/header-system-turn2.dc.html`.
- **Per-screen table first (reviewer 2, 3).** Before any check is written, the worker adds to the copied `header-exact-values.md` a table: screen × size × look → which parts exist and their values (Today, Week, Week preview, Day with the date as title 28px × scale, money iPad without title or date, money phone, meeting rows, Sister Sync and Print as built, phone Week ◀ only). Calm values for `--hdr-badge-bg`, `--hdr-label-ink`, `--hdr-ring` and `--sel` are read from the source `.dc.html` (Calm frames) into that table; the check reads only the table's values. Any Calm value that differs from Pop is listed in the PR.
- **Markup.** `pageHeader(o)` keeps its name and options (`variant, back, lead, title, context, tools, actions, badge, sub, titleAction, moneySurface`); output is new `.hdr-*` markup: `.hdr`, `.hdr--standard|money|meeting|parent`, `.hdr-row`, `.hdr-back`, `.hdr-title`, `.hdr-context`, `.hdr-step` (52×52, label min-width 200), `.hdr-switch` + `.hdr-switch-cell` (one element, 2px ink border, radius 14, overflow hidden, cells 56×48, 2px divider, selected `--sel`, icons 📋/🖨 20px, no words), `.hdr-span` (52×48), `.hdr-print` (52 high, `--main`, "Print" 18px 600), `.hdr-actions`, `.hdr-badge` (52×52 circle, `#ffe4ec`, 2px ink, emoji 24px, aria-label from `profileBadgeText`), `.hdr-sub` (44), `.hdr-r2`.
- **Centring (reviewer 1).** `flex:1` centres in the leftover space, not the bar. The bar row is a `grid-template-columns: 1fr auto 1fr` grid: left group (back, title) start-aligned in column 1, `.hdr-context` in column 2, right group (tools, actions, badge) end-aligned in column 3. This is how "must sit in the middle of the bar" is met. Where the context is absent (Day, money iPad) the side groups stay at the ends.
- **Values only from the table.** Bar 64/60, money 72/64, meeting 62+44 / 60+44; padding 0 18px gap 16 iPad, 0 10–12px gap 6–10 phone; 2.5px ink bottom rule, meeting row 1 1.5px dashed; title head font 30px × scale 700; date label body 22px 600 `#1c2240`, phone 20px; Day title head 28px × scale; stepper shadow Pop 3px 3px 0, Calm 2px 2px 0; meeting chosen girl 2.5px ink + 3px `#ff5c8a` ring; kid buttons 52, money 54. Tokens in both looks: `--hdr-badge-bg`, `--hdr-ring`, `--sel` (Pop `#ffc83d`, Calm navy), `--hdr-label-ink`.
- **All `.ph-` users (reviewer 4).** The old `.ph-*` block in `css/app.css` is deleted. Also: `index.html` static shells (lines 137, 249, 467, 488, 744); `js/21-money-data.js:1829-1832` money tabs (`.ph-tabs`, `.ph-tab`, `.ph-tab-tag`, `.ph-tab-word` → `.hdr-tabs`, `.hdr-tab`, `.hdr-tab-tag`, `.hdr-tab-word`); `data-ph-action` → `data-hdr-action` (`js/47-header.js:137,158` dispatch); `tests/helpers.test.js` (45 refs); `tests/smoke.js` (91 refs). Proof: `grep -c "ph-"` = 0 across `js/`, `index.html`, `css/`, `tests/` (unrelated words listed). `.topbar` (`index.html:702`), `.week-nav` (`index.html:490`, `:713`) and `.btn-icon` stay for screens outside the kid header, so `check-dead-css.js` stays green; PR shows `grep -c` 0 for them in `js/47-header.js` and its callers.
- **Kept behaviours (reviewer 5).** Named regression checks in the proof: Day title button for Copy a day on the phone (D27, `renderDayHeading`), badge `[hidden]` during the meeting lock, `mmOpenDayForBlocks` Day header and `navReturn` back names (`oneBackStackGoesWhereYouCameFrom`), `parentDayTopBarStaysCompact` with the 2026-09-30 wide-day case, Sister Sync on one line at 375px, 44px tap and 13/15px text floors.
- **Smoke `everyHeaderMeasuresToTheExactValues`** (added to `SETUP_NEEDS`): Today, Week, Week preview, Day, My money, Money school, All my Sundays, By month, meeting steps, Sister Sync, Print; 1194 and 390; Pop and Calm; per the per-screen table asserts bar height (with rule: 66/62, 74/66, meeting 63+46 / 61+46), context centre ±8px of the bar centre, label 22/20px 600 colour, badge 52×52 background and border, one `.hdr-switch` with two 56×48 cells, span cells and `--sel`, stepper 52×52, buttons ≥52 (money ≥54); plus (reviewer 6) the meeting chosen-girl ring, the step text "Signed", the week line "Week of Oct 5 – 11" form, and no title or date in the money iPad header. Folds in `kidScreensHaveOneStandardHeader` and `moneyAndMeetingHeadersHoldTheirSizes`. Three planted faults (4px context offset, two-button switch, wider right group) in proof commits, then reverted.
- **Difference 15.** Render Day at 360×844 in both looks with "Wednesday 30 Sep"; report fit or the largest size that fits.
- References from `gh workflow run ci.yml --ref claude/consistency-4` pictures artifact. One-test time in the PR and `tests/README.md`. Hotspot notes already recorded (Kid headers round 1; Profile badge round 4).

**Stage 21.** `sonnet-worker` rebuilds `docs/handoff/consistency/pr4-headers-compare.html` in place: Part A iPad Pop five pairs first, then iPad Calm, phone Pop, phone Calm, Week preview; Part B remaining differences with measured numbers; Part C other changed pictures (`tools/picture-diff-page.js`). Then `reviewer` (before PR), record, PR #135 text (360 measurement, one-test time, page link); ready only with CI green.

**Stage 23 — PR 5 (D35).** `.parent-bar` → `pageHeader({variant:'parent'})`; `.parent-banner` removed on Week, Day, Monthly; Monthly `.topbar` and parent `.week-nav` replaced and rules deleted; measurement check gains parent screens; D14 in `paApplyTextScale` (`js/33-parent-app.js`); `.cp-head`, `.ctr-head`, `.gu-head` lose card-as-header styling; header actions re-checked by hand (`check-dead-actions.js` cannot see generated `data-*`).

**Governance, every pull request (Plan v8 list, still in force).** 1. Read `CLAUDE.md` and `ARCHITECTURE.md`; plan mode. The main session edits only `WORKING_RECORD.md`, `FEATURES.md`, `plans/` and — recorded exception for D34 — the checkpoint report in `docs/reports/` (the central rule names the main session as the report writer); every other file goes through a worker. The main session commits and pushes. 2. Tests (D16): short loop and the map's tests on this PC; GitHub green on the head commit before a PR opens or turns ready. 3. Bump `SW_VERSION` and `APP_BUILD` together in every PR that changes a shell file. 4. Regression table against `FEATURES.md`; record updated in the same turn. 5. Screens: iPad 1194×834 and phone 390×844, Pop and Calm (plus 360 wide for the Day date). 6. Stacks (replaces v8's "no stacked branches", following the central stacked-PR rule and the owner's "then continue with PR 5" while PR 4 stays unmerged; Design decisions "PR 5 stacks"): at most 3 unmerged PRs; PR 5 bumps `SW_VERSION` again over PR 4's value, so `check-sw-shell.js` compares against its base `claude/consistency-4`; after #135 merges, PR 5 is retargeted to `main` and `git merge-base` confirmed. 7. References never go stale; the difference page is the approval. 8. One session carries all 42 stages; after each merge `## Where we are` and the restart line are pushed.

**Routing.** 19 main session; 20 opus-worker (sonnet-worker for the two copies); 21 sonnet-worker then reviewer; 23 and every later Build opus-worker with an Explore map. Reviewer before every pull request update and before done. No full `npm test` on this PC (D16).

**Later PRs (unchanged from Plan v8).** PR 6: 18 money formatters → `fmtMoney`, date and kid-name helpers, `check-money-words.js`, Day span form. PRs 7–12: one surface each to `.ui-*`, old classes deleted, references updated. PR 13: 7 unused functions, Sunday-branch money week, timer audit, guards in `npm run check`. PR 14: slowest smoke checks set up their own data; `tools/smoke-times.js`. Track S after PR 13.

**Risks.** Second reference refresh (200+ pictures, one CI round trip); Calm colour values from the picture where the table is silent (fixed in the per-screen table before the check); 20px Day date may not fit at 360 in Calm; the bigger 30px × 1.1 title may crowd Sister Sync at 375 (kept-behaviour check); PR 5 may merge the PR 4 branch once.

**Done when, per stage.** 19: file on branch with Quick read, unedited measured part, 149 s → 33 s line. 20: per-screen table first; values copied; new `.hdr-*` markup only; no `ph-` left; measurement check green on four dates, both sizes, both looks, red on three planted faults; kept behaviours pass; 1 and 9–14 as the picture, 2–8 unchanged; 360 measurement in PR; dead-CSS and look-token checks green; references refreshed; build bumped; CI green. 21: page with five iPad Pop pairs first; reviewer ran; PR #135 green. 22: page read; PR #135 merged; build read on the iPad in both looks. 23 PR 5: one purple bar on every parent screen with 44 badge, buttons and sub-bar, measured; Confirm all and Mark reviewed rows pass; Reading size defaults to 1.2 and scales the header; old parent top bar and month stepper gone; comparison page; GitHub green. 24: differences decided; PR 5 merged. 25 PR 6: one Sunday per girl shows the same totals in the new format; `sunday.test.js` and `money.test.js` pass; `check-money-words.js` fails on a planted formatter; old functions gone. 26: PR 6 merged; build read; one Sunday per girl walked. 27, 29, 31, 33, 35, 37 (PR 7–12): the surface's old classes gone (`check-dead-css.js`); floors hold; its `FEATURES.md` rows pass; before/after page in both looks; references updated; GitHub green. 28, 30, 32, 34, 36, 38: page decided; that PR merged. 39 PR 13: each guard fails on a planted example; the 7 functions and the Sunday branch gone; timers audited; history archived; `Reviewer before done` written. 40: PR 13 merged; build read on the iPad. 41 PR 14: every GitHub job under 5 minutes on all four dates. 42: PR 14 merged; the plan closes.

**D38.** The main session writes a proposal for hz-claude-config ("an owner design reference is the specification: extract its values into a table, test every value before building, the picture wins, pilot one screen first") into the record under Open questions for the next hz-claude-config change.

Agreed points: 27 of 27 in the plan.
