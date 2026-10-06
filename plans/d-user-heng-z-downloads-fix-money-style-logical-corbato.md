# Plan v1 — Money fit and logic — Approved 2026-10-05

| Summary |
|---|
| What changes for you: the money numbers add up the same on every screen, the money week reads Sun–Sat wherever money is shown, Savings keeps its $10 safety, a too-big commitment needs your tick, no "Meets" or "cash" as a place, the kept old pages match the new My money, and no money screen spills text. Five pull requests, in order. |
| What changed from the last version and why: you agreed with all eight decisions and asked which old money-tab parts are worth keeping, with a side-by-side view before deciding. Both are in: my call per part, a comparison page before PR 4, and the kept parts updated in PR 4. |
| What I need to do: answer decisions 9–11, then approve; mark the side-by-side page before PR 4. After each pull request: merge, read the build. |

Changes in this version
```diff
+ 🟦 Rev 1 — Decisions 1–8 agreed; decisions 9–12 added (12 = the keep list)
+ 🟦 Rev 1 — "What is worth keeping": a keep-or-retire call per old part
+ 🟦 Rev 1 — Before PR 4, a side-by-side page (old part today · proposed new look) for your marks
+ 🟦 Rev 1 — New PR 4: the kept parts updated to the current rules and look; fit moves to PR 5; 13 stages
- 🟦 Rev 1 — "Money school and Story are kept as they are"
```

## What I found

Audit findings: **14 real**, **6 wrong**, **6 against your own decisions** (1–8, agreed). Grading below.

🟦 Rev 1 — **The old money tab: what is worth keeping.** Nothing is broken; all of it carries old words. My call:
- **🎓 Money school — keep as the one teaching page:** the ladder, the ten ideas with their lock, the Companies chart, "Just part of being here", "What money buys". Retire the cash idea. Merge the ideas with My money's "?" sheets: one text per thing.
- **📖 My money story — keep the long view, drop the short one:** the Flow (months) stays; "week by week" becomes the passbook's "all my Sundays" page (a door the spec names, empty today). Retire "Your last 8 weeks": the passbook and 📒 Weeks show it.
- **Survivors — keep, reword:** the price list, the week checklist, the tour. **Retire:** the Chores-tab 💰 card (decision 9), four dead helpers; archive the old handoff (11).

## The five pull requests

**PR 1 — Money rules.** One pile figure on every screen; "From my bank" adds up; one Sun–Sat money-week label; a too-big commitment needs a parent tick; a down payment leaves the $10 safety alone; a 20-Sunday test run per girl.

**PR 2 — Words and small fixes.** "Competitions" wherever it is read (Swim meet stays); no "Dad" on the price card; the lock-weeks chip reads the rule; an unsigned Signed step says so; Grown-ups figures in the look's font; Story colours match My money.

**PR 3 — Shared values and checks, money screens.** Corners, borders, shadows, the selected fill and the main button read shared values (shadow colour per look); one check fails the build on a typed value there, a second on banned kid words and a raw "{…}".

🟦 Rev 1 — **PR 4 — Old pages join the new look** (the parts you keep on the side-by-side page). Money school and the Story get the My money head, cards, fonts and spacing, filling the iPad screen; their content follows the current rules (stage names, no cash, the four income groups, money weeks, rates read live). The survivors say the current words; the manifest is corrected.

**PR 5 — Fit and same look.** The money fit check grows (every money screen and sheet, both looks, phone and iPad, long names, 4-digit amounts: nothing clipped or overlapping); it fails first, then fixes follow your Stage 7 rules, then wording or a box that grows — never a cut. Same thing, same look: totals, columns, main button, − / +, borders, solid sheets. Every pull request bumps the build and passes the full test chain in both looks.

## Decisions
Decisions 1–8 agreed 2026-10-05 (listed under Technical details).

🟦 Rev 1 — New (my recommendation first):
9. **The 💰 card on the Chores tab** — one door "💰 My money ▸". Or keep it, rewritten.
10. **The Story's weeks** — money weeks, Sun–Sat. Or planner weeks.
11. **The old handoff file at the root** — move to the archive folder with a note. Or leave it.
12. **Keep list** — you mark the side-by-side page (stage 8) before PR 4; my call above is the starting mark.

## Stages to finish
13 stages: 7 build steps by Claude, then 6 checks (merges, iPad reads, one page review).
1. Records: ledger, hotspot row, plan file · Claude · Build (main session)
2. PR 1 Money rules · Claude · Build · opus-worker · Level: Complex
3. Merge PR 1, read the build on the iPad · You · Check
4. PR 2 Words and small fixes · Claude · Build · sonnet-worker · Level: Routine
5. Merge PR 2 · You · Check
6. PR 3 Shared values and checks · Claude · Build · opus-worker · Level: Complex
7. Merge PR 3 · You · Check
8. 🟦 Rev 1 — Side-by-side page: each old part today beside its new look · Claude · Build · opus-worker · Level: Complex
9. 🟦 Rev 1 — Your keep-or-retire marks on that page (decision 12) · You · Check
10. 🟦 Rev 1 — PR 4 Old pages join the new look · Claude · Build · opus-worker · Level: Complex
11. 🟦 Rev 1 — Merge PR 4, read the build · You · Check
12. PR 5 Fit and same look · Claude · Build · opus-worker · Level: Complex
13. Merge PR 5, iPad walk-through in both looks · You · Check

Checked against: Pocket money hotspot row (6 rounds, 2 recurrences, 1 regression; rewrite chosen 2026-10-03 — round 7 repairs it); Looks — Calm meaning row; ledger #96, #98, #91/#92, #87, #102; Plan v18 §W; Stage 7 fit rule; R11 looks rules. No stored field added.

Removes/consolidates: the Mon–Sun label on money surfaces; the Story's own colours; the double rule-section build; literal corner, shadow and border values on the money screens; the raw chip title; the twice-shown waiting figure; 🟦 Rev 1 — the cash idea, the 8-weeks chart, two explainer tables into one, the old card look, the Chores-tab card, four dead helpers, the old handoff.

## Technical details

Planned on Fable 5.1 (the planner hook reports the account default, Opus 5.5).

**Decisions 1–8, agreed 2026-10-05:** 1 waiting money joins the pile (Deviation 37) · 2 a commitment over 50 % of steady money is allowed with the parent tick · 3 the fourth Money school stage is "🎉 All paid off" · 4 "◀ My pile" stays · 5 both accent "current" markers stay · 6 no screenshot diffs · 7 the rest of the app's values in a later plan · 8 the 🛟 safety still pays a surprise cost.

**The audit graded** (Broken = wrong in the code · Checked = the audit is wrong · Approved = asks to undo a decision).
- Broken: L4 Mon–Sun label (`mmWeekLabel`, passbook, Grown-ups) · L5 "3230%" with no floor or gate · L6 down payment ignores the 🛟 $10 · L2 From my bank total vs $0 lines · L1 Payday pile $0 until the coins land, `tp` vs `hers` · L3 rescale rounding · R2 "Meets" (10 lines) · D1 raw `{lockWeeks}` on the school chip · D3 three stage names · R3 Grown-ups figures in Nunito (rule at `css/app.css:8535` lacks `.gu`) · P1 16/24/11 radii, 5 shadow offsets, 4 selected fills, 3 button families · P2 spills · P4 Story colours · E3 Signed empty state.
- Checked: `mockups-6f9.html` is in `docs/handoff/sunday-v15/final/` · D2 reads `freeChoresPerWeek` live (`js/25-money-school.js:171`) · R6/R9 gates read `stagePct` 20/30/40 live · E2 `.mv2-door::after` gives 44 px · F1 tabs 2–4 already hidden for a kid (`mnyTabsFor`) · `js/19-pocket.js` is a redirect + live price card, `js/23-money-meeting.js` holds Sunday helpers.
- Approved: Deviation 37 (waiting money joins the pile) · the owner's 2026-10-03 cents rule (Plan v5) · Deviation 38 (fines "Logged by Mom / Dad") · F3 "◀ My pile" and F2 two accent markers are BUILD-SPEC §0/§3 · D5 Money school and Story kept · 🛟 pays a surprise cost (`js/46-grownups.js:593,602`).

**Branches.** Stacked back-to-back as in R11: `claude/money-rules` from `main` @ `1b2d43f`, then `claude/money-words`, `claude/money-tokens`, `claude/money-oldpages`, `claude/money-fit`, each from the one before; one ready-for-review PR each. Worker instructions path for every hand-over: `C:\Users\Heng Z\.cache\hz-rules\3.1.29\agents\opus-worker-instructions.md`. Every PR bumps `SW_VERSION` (`sw.js:29`) and `APP_BUILD` (`js/01-config.js:17`), now `2026-10-05c`.

**PR 1 — Money rules (`opus-worker`, Complex; Map: the explorer and reviewer reports of 2026-10-05, repeated in the hand-over).**
- L1: `sdPile` (`js/43-sunday-core.js:216`) stays the one owner. Payday head `js/44-sunday.js:730` shows `P.tp` once `done` or under `prefers-reduced-motion`; I choose chip `:923` shows `P.tp` with "$X left" beside it; Signed and passbook read `sdSign`'s `hers`/`inBank`. Test: `tp` = I choose chip = Signed "In" = passbook row in, per girl.
- L2: `js/44-sunday.js:665–712`: inside 🏦 From my bank add the line "📥 Waiting for Sunday $X" where X is the existing `waiting` (= `carry + homeIn`; `homeCash` is already the 🏠 From home stepper), and drop the "📥 $X waiting" part of `bankNote` so the figure shows once. The box then equals `P.pullTot`. Deviation 37 kept (decision 1).
- L3: `sdRescaleLoanRows` (`js/44-sunday.js:225–235`): each row's monthly scaled toward `ch.now`, the rounding residual on the last row. Tests: rows' monthly figures sum to `ch.now` exactly; the weekly total (`mnyWeeklyDue` per row, `js/20-loan.js:282`) within one cent per row. The cents rule (`centsTo`, `js/43-sunday-core.js:230,235`) is unchanged.
- L4: new `mrMoneyWeekLabel(wk)` in `js/18-rules.js` beside `mrMoneyDays`, naming the first and last day `mrMoneyDays` returns (so the switch week reads "Mon 5 – Sat 10 Oct"; Mon–Sun before the dated rule). Called only at the money surfaces: `mmHead`'s "Week of" when the money step is on (`js/15-meeting.js:1008`), Signed's header, the passbook "Week of" (`js/22-money-page1.js:1095`), Grown-ups 📒 Weeks (the Weeks tab reader, not the repair cards at `js/46-grownups.js:444,457`, which stay). `mmWeekLabel` (`js/15-meeting.js:339`) and its ~20 planner callers (`js/07-week-view.js:309`, `js/34-parent-copyweek.js`, the catch-up lines) are untouched. Smoke: with the clock pinned to Sun 11 Oct 2026, the head reads "Mon 5 – Sat 10 Oct"; pinned to 18 Oct, "Sun 11 – Sat 17 Oct".
- L5: `guCommitMath` (`js/46-grownups.js:538–553`) and `guCommitSide` (`:582–604`): steady under 5 → no %, "not enough steady money yet", save only with a parent ✓ checkbox in the form; share over 50 % → same ✓ (decision 2). `guSaveCommit` (`:606`) passes the flag; `mnyAddCommitment` (`js/20-loan.js:496`) refuses without it. The flag is form state only — **no new stored field**.
- L6: `mnyAddCommitment` (`js/20-loan.js:513–518`): `fromSavings = min(down, max(0, mnySavedTotal − safety))`; the rest stays on the row's principal. `guCommitMath`'s `fromSafe`/`okDown` (`:550–552`) and `guCommitSide` read the same split and say "$X from Savings, $Y added to the wall". `mnyAddSurprise` (`:529`) unchanged (decision 8).
- M7: `tests/sunday.test.js` 20-Sunday run per girl through the pure core (`sdBuildInput`-shaped input, `sdSign`): In = Out, L1, cents rule, interest on Sundays 4/8/12/16/20, lock back after 4 weeks, goal jar never over target (overflow → Savings), each approval applied once by its own `appliedWeek` stamp (wall moves `js/40-stream.js:1083`; deposits, Draw early and goals stamp theirs where they are applied — the worker lists each), Redo then re-sign identical, passbook total = rows. Add owe-after-plan (`sdChooseSide`, `js/44-sunday.js:957`) and new-weekly-payment tests. `appliedIds` does not exist.
- Optional owner check: a Parent › App export replayed through the same run (file path by env var).

**PR 2 — Words and small fixes (`sonnet-worker`, Routine).**
- Meets → Competitions: `js/43-sunday-core.js:544,674`, `js/44-sunday.js:541,1323,1324`, `js/22-money-page1.js:726`, `js/46-grownups.js:59,404,454,1262`, `js/24-money-parent.js:382–387`, `js/41-record.js:56`. Keep "Swim meet" (`js/22-money-page1.js:775`, `js/45-requests.js:730`) and the swim-form "at one meet" (`:785`). Identifiers (`kind:'meet'`, `sd-meet`, `rq-meet`) unchanged.
- `js/19-pocket.js:90` "not Mom, not Dad, not you" → "not your parents, not you".
- `js/25-money-school.js:121–125` chip title through the same `swap` as `mnyConceptCard` (`js/21-money-data.js:1680`).
- E3: `js/44-sunday.js:1059–1062` + `sdSignedSide` (`:1223`): "Not signed yet" with a "◀ I choose" button; after signing the spec's content as today.
- R3: `css/app.css:8535` add `.gu, #grownupsOverlay` to the `--font-round: var(--font-body)` rule.
- P4 colours: `FL_COLOURS` (`js/42-flow.js:79–90`) explicit mapping: earned → `--mny-v15-bar`, gift → `--mny-v15-gold` (given), ready → `--mny-v15-saved`, loan and borrowed → `--mny-v15-wall`, spent → `--mny-v15-cash`, invest → `--mny-v15-made`; prize, interest, typed, opening, locked, fine, other keep `--mny-flow-*`.
- (Moved to PR 4: `MNY_STAGES` titles and the compact tab bar on school and Story, so the page work lands once.)

**PR 3 — Shared values and checks (`opus-worker`, Complex).**
- Money sections `css/app.css` from the `--mny-v15` block (`:8046`) to the end of the `.pn-` money rules (~`:9632`), bounded by two marker comments: 135+ `border-radius` → `--radius-md` 14 px (cards), new `--radius-btn` 11 px, `--radius-full` (chips), new `--radius-bar` 6 px; border widths → new `--bw-card 2.5px`, `--bw-btn 2.5px`, `--bw-chip 2px`, `--bw-info 1.5px`; shadows → new `--mny-shadow-card: 3px 3px 0 var(--mny-v15-shadow)` and `--mny-shadow-btn: 2px 2px 0 var(--mny-v15-shadow)` (the colour stays per look: Pop `:8076`, Calm `:8088`; the app's navy `--shadow-sm/md` at `:88–89` are **not** used — R11 4A hazard); 1.5×1.5, 2×3, 4×5 fold into those two; selected → `--sel-tab`/`--sel-tab-ink`, `--sel-opt`; main button → `--btn-main`/`--btn-main-ink`, `--btn-off`. In `:root` when shared, in both look blocks when a look differs (parity rule). The old `.mny-*` section (`:5872`, `:6114` …) joins the markers in PR 4 when the pages move to `.mv2-*`.
- `tests/check-look-tokens.js` rule 6: between the markers a `border-radius`, `box-shadow` or `border(-width)` value must be **one** `var(--…)` token (not a literal with a token inside); exempt `none`, `inset …` and the glow animations (`:9001`, `:9331`, `:9537`).
- `tests/check-money-words.js` (added to `npm run check`, `package.json` and `.github/workflows/ci.yml`): scans **string literals** in `js/` and text in `index.html`, case-insensitive: `dad` (outside the fines `who` list and comments), `\bmeets?\b` (outside "swim meet" and an identifier allow-list), `prizes`, `stocks`, `locking money`, `everything i have`, `in cash` / `cash right now` (cash as a place; "Cash out", "Put cash in", "Cash from home" allowed), and a `{word}` placeholder not preceded by `$` (template `${x}` excluded) outside `swap`'s own source. Planted failures proven, as the existing checks were.
- B5: `guRuleSections()` (`js/46-grownups.js:958–971`) built once per `guRender('rules')` and handed to `guRuleIndex` and `guRulesMain`; smoke counts one build per render (no millisecond assertion).

🟦 Rev 1 — **Stage 8 — side-by-side page (`opus-worker`, Complex).** One private artifact page, like the earlier comparison pages: a row per old part (ladder, ideas, Companies chart, Just part of being here, What money buys, price list, Flow, last 8 weeks, week by week, Chores-tab card, week checklist, tour), each with a screenshot of today's build at 1194 (Pop) on the left and a mockup of the proposed new-look version on the right (or "retire" with the reason and where the information already lives), my mark (keep / merge / retire) and a box for the owner's answer. Screenshots from the smoke harness; mockups as static HTML on the My money tokens. Nothing in the repo changes.

🟦 Rev 1 — **PR 4 — Old pages join the new look (`opus-worker`, Complex; Explore map first: the inventory report of 2026-10-05 and the owner's marks on the stage 8 page, repeated in the hand-over).**
- **Head and tabs.** `mnyRenderSchool` (`js/25-money-school.js:62–80`) and `mnyRenderStory` (`js/22-money-page1.js:999–1114`) use `mnyPageHead` with `big` and the compact `mnyTabBar` as My money (`js/22-money-page1.js:215`); the numbered bar and "The five money pages" label (`js/21-money-data.js:1825`) are retired; `tests/smoke.js:14531` ("tab 5") rewritten. Kid bottom bar hidden as on My money (`TD_NAV_SCREENS`).
- **Look.** Both pages' cards move from `.mny-card`/`.mny-cols.school` (`css/app.css:5872`, `:6114`, fixed `340px 1fr 320px`) to `.mv2-card` and a 1194×834-filling grid (spec §0: 2.5 px ink border, 14 px radius, card shadow, Gochi titles, Patrick Hand body, no empty bands); the `--font-round` rule (`:8535`) covers them; phone stacks one column. `.mny-*` rules that become unused are removed (the dead-CSS check will name them).
- **Money school content.** `MNY_STAGES` (`js/21-money-data.js:41–45`): "🎿 What I owe, and what I keep" → "🧱 My loan"; ready "🏦 Savings"; locked "🔒 Locked away"; stock "📈 Companies"; mix "🎉 All paid off" (decision 3). `MNY_CONCEPTS` (`:165–169` cash concept) → "📥 Waiting for Sunday" concept and `MNY_ASK.cash` (`:213`) reworded; `:225` "Money kept ready" → "Savings"; stock story `:203` ("a third in six months") made to agree with `mnyStockChart` (`js/23-money-meeting.js:264`, "X% in three months"); `:58` "4 weeks" and the tour's `:1842` read `mrRules()` lock weeks; `MNY_UNPAID` (`:138`) kept, wording checked; `mnyWeekKey` (`:1885`) in `js/25-money-school.js:182` → the current money week (`mrMoneyWeekOf(today)`); `mnyHomeLabel` (`js/24-money-parent.js:128` "Cash / Kept ready / In companies") → Waiting for Sunday / Savings / Locked away / Companies.
- **Story content (decision 12).** The Flow (`js/42-flow.js:250`) stays; its sentences `:144,267` ("in cash right now", "still cash") → "📥 Waiting for Sunday"; the "📥 Waiting for Sunday, right now" line (`:271`) goes (My money's door has it); source label `js/40-stream.js:80` "Jobs and routines" → "🏠 Home". "📊 Your last 8 weeks" (`js/22-money-page1.js:982`, `ckEightWeeks` `js/26-chore-kid.js:722`) retired. "📖 Week by week" (`:1048–1110`) becomes the passbook's "📖 all my Sundays" page (the passbook icon at `:612` opens it): settled-week bars `:1071–1075` ("Jobs / Learning / Clean days / From outside") → 💪 Money I earned (🏠 / ⛸️ / 🏆) · 🎁 given · 🌱 made · ➖ taken off, read from the ledger row's groups (`sdHistGroups`, `js/44-sunday.js:760`); "Week of" labelled with `mrMoneyWeekLabel` (decision 10).
- **Money school ideas merged with the "?" sheets:** `MNY_CONCEPTS` (`js/21-money-data.js:165–210`) and `MNY_INFO_KINDS` (`js/22-money-page1.js:807`) become one table read by both `mnyConceptCard` and `mnyOpenInfoSheet`; a school idea opens as the same sheet; the cash concept (`:165–169`, `MNY_ASK.cash` `:213`) is removed.
- **Survivors.** Price card `js/19-pocket.js:82,94` ("Competition days", "Sunday Box") → "🏆 Competitions", "📦 Box fine"; `MNY_CHECKS` (`js/21-money-data.js:123–131` "all six days") → the money week's days; tour `js/21-money-data.js:1841,1845,1848` ("Everything I have", "📋 My loans", "to the wall, saved, or cash") → "✅ What I own", the loans door, "to the wall, Savings or cash out"; info sheet `js/22-money-page1.js:878` "Already in my wallet" → "📥 Waiting for Sunday". Chores tab `ctRenderMoneyCard` (`js/13-chores.js:948`, rendered `:1397`) → one `.mv2-door` "💰 My money ▸" (decision 9); `netWorth` (`js/14-money.js:86`) and `portfolioValue`/`gicTotal`/`savingsTotal` then unused → removed with it, as are `mnyQuestSummary`/`buildHowIEarnCard` (`js/06-quests.js:190,213`), `pocketViewKid` (`js/19-pocket.js`) and `openPocketMoney` (`:27`; its one caller `js/15-meeting.js:1527` calls `mnyOpenMyMoney`). `EV_HOMES.cash` (`js/40-stream.js:58`) stays: it is stored data (`wallet.cash`, Deviation 37).
- **Records.** `HANDOFF-pocket-money.md` → `docs/handoff/archive/HANDOFF-pocket-money.md` with a first-line note (decision 11; a `git mv`, nothing deleted). `FEATURES.md` money section corrected: lines 310, 323, 325, 337, 343, 358, 359–360, 362, 371, 373, 381 (manifest v29); a new subsection manifests My money v2, the Sunday ritual, requests and Grown-ups as they are. `ARCHITECTURE.md`: one note "The old money pages read the new rules".
- **Checks.** Smoke: both pages in the kid sweep at 390/1194 in both looks (already in `CUT_MONEY_ROOTS`? add them), `everyMoneyControlClicksClean` covers them, the words check (PR 3) covers their strings; fail-first on the current page copy.

**PR 5 — Fit and same look (`opus-worker`, Complex).**
- Extend `noLabelIsCutOnTheMoneyScreens` (`tests/smoke.js:5844`, roots `CUT_MONEY_ROOTS:5661`, which already include `#requestOverlay.open *`; add Money school and Story): both looks, 390×844 and 1194×834, after `document.fonts.ready`, seeded with 12-char names and $1,234.56 amounts; for every text element: no `scrollWidth > clientWidth+1`, no rect outside its nearest bordered ancestor, no overlap between sibling labels; the Calm `.mm-body` scroll area is allowed to scroll (Stage 7). Fails first on the audit's Stage B list (`js/44-sunday.js` head pills, pot list, Taken-off note; Grown-ups "$998.90 left", option chips; Money school tabs), then fixed in this order: `--mny-fit` for a tight label, bigger text where a card has room (§W), wording, a box that grows — never `overflow:hidden`.
- Stage C: title-row totals Gochi/Baloo coloured owe purple · own green · pile accent (`js/22-money-page1.js`, `js/44-sunday.js:923,957`); right-aligned money columns; `.rq-send.ready`/`.gu-save.ready`/`.sd-go` → one `--btn-main`; tan only when disabled; one `−/+` rule for `.sd-`, `.rq-`, `.gu-` steppers (value not button-styled); ink borders on all cards, fines side cards red-tinted; one "50 %" on Her share; `#requestOverlay` sheet background solid `--mny-v15-paper`.
- E1 Guess layout (`js/44-sunday.js:496` side). Reviewer "before done" on the whole plan at the end of this PR.

**Gate per PR.** `npm test` exit 0 (check · merge · buffers · stream · cleanup · xp · money · sunday · smoke, both looks, 390/768/1024/1194/1440 sweeps already in smoke), regression table + `FEATURES.md` bump, `ARCHITECTURE.md` note for the new owners (`mrMoneyWeekLabel`, the token and words rules), review pass vs base. Smoke on this PC: `SMOKE_CHROMIUM="C:/Program Files/Google/Chrome/Application/chrome.exe"`.

**Hotspot row at approval (Stage 1):** Pocket money fix rounds 6 → 7 (this audit); recurrences, regressions, workarounds unchanged (the Mon–Sun label and "Meets" were never fixed in those places, so they are leftovers of Deviation 34 and the Prizes → Competitions change of Plan v13, not returns).
