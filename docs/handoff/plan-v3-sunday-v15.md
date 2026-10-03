# Plan v3 — Sunday v15 pocket-money redesign — Awaiting approval

**🟩 Rev 2 — what changed and why (owner's rule: byte-close to the prototype unless a deviation is approved):** a new section *Deviations from the prototype* lists every departure with its approval status, so nothing is silently different. Four were put to the owner: keep the plan's placement of Sunday and Grown-ups (approved); ↺ Redo returns one girl only (changed — per-girl snapshot replaces the meeting-wide Undo); the Approve card's − / + steps the dollar amount as drawn (changed — stored as Dad's figure beside her entry); Savings is always open with no 🏦 flag on the wall (confirmed). Sections touched: Summary, A, B (result row), E (steps 2, 11), H, Deviations (new), Risks. 🟩

**🟦 Rev 1 — what changed and why (owner's reply to v1):** three "not built" items were wrong or unclear. (1) "Club owes me" is now built: the club pays the assistant job twice a year, Dad advances it weekly, so the app keeps a running tally per girl and a Grown-ups button to record the club's payout. (2) A result's pay is never Dad's own figure: results are published online, so the Approve card shows the official sheet's fields (races, points, placing, qualifying) for Dad to correct, and the pay follows the rules. (3) The $0.50 box fine was never a gap: it is replaced by the app's own fines rules (your decision D2). The two older handoff items are now named and folded into this PR. Sections touched: Summary, B (two rows), G, H, J, Risks, Stages. 🟦

| Summary |
|---|
| **What this plan does:** rebuilds the girls' pocket money around your three prototype screens. Sunday becomes a four-step ritual inside the family meeting (guess, payday, choose, sign). My money becomes the passbook, loan wall, pots, goal jar and the four "ask Dad" buttons. The parent's money page becomes Grown-ups with Approve, Commitments, Fines, Expected and Rules tabs. Underneath, the app's existing money engine, ledgers and sync stay as they are; the new club-session pay, the request queue, the goal jar, the four-week locks, cash drawn early and the new loan terms are each given a home that joins cleanly to what already exists. |
| **What changed from the last version and why:** 🟩 Rev 2: every difference from your prototypes is now listed with its approval; Redo undoes one girl only; Dad corrects a result's dollars with − / + as drawn; Savings never locks. 🟩 🟦 Rev 1: the club's twice-a-year payout is now tracked and recorded; a result is checked against the published sheet, never priced by hand; the box fine is simply replaced by the app's fines rules; two small older fixes (a settled week can still be claimed; one XP toggle has no permission check) are added to this build. 🟦 Version 1 carried your eight decisions from today: club sessions from the planner plus a one-off from Grown-ups; the app's existing fines rules kept, with the tab reminding that every behaviour gets recorded; today's chore engine kept and relabelled; the prototype's loan terms; the old cash-pool work retired; Money story and Money school kept for now; one pull request; a stacked phone layout. |
| **What I need you to do:** approve this plan, or name the sections to change. Later: merge the pull request, then open the app on the iPad and run one Sunday with each girl so the hold-to-add, the coins and the Calm look are checked on the real device. |

**Changes in this version**

```diff
+ 🟩 Rev 2 — New section "Deviations from the prototype": every departure, each marked approved (with the decision) or inherent
+ 🟩 Rev 2 — A: ↺ Redo restores one girl only (per-kid snapshot at sign; mmUndoRecord takes a kid); the meeting-wide Undo is retired
- 🟩 Rev 2 — A: "Redo = the existing meeting Undo; it returns both children"
+ 🟩 Rev 2 — B: result pay: the Approve card's − / + steps the dollars; stored as awardedOverride {value, by, at} beside her entry; mrCompetitionWeek reads it
- 🟩 Rev 2 — B: "the Approve card edits the official sheet's fields; no hand-typed figure"
+ 🟩 Rev 2 — B/My money: Savings always open; the loan wall shows 🔒 30% and 📈 40% flags only
+ 🟩 Rev 2 — E: snapshot per kid at step 2; step 11 seals that kid's snapshot
+ 🟩 Rev 2 — H: sundayRedoReturnsOnlyHer replaces sundayRedoIsTheMeetingUndo; undoReturnsBothChildren retired on purpose
+ 🟩 Rev 2 — Risks: a result override and its points can disagree; the record shows both
+ 🟦 Rev 1 — Summary: club payout tracked and recorded; results checked against the published sheet; box fine replaced by the app's fines rules; two older fixes added to this build
+ 🟦 Rev 1 — B: row "🧾 Club owes me": derived tally of sessions paid since clubPaidThrough[kid]; Grown-ups "✓ Club paid" button; shared key clubPaidThrough with an lww decision and a two-device test
+ 🟦 Rev 1 — B: row "Result pay": the Approve card edits the official sheet's fields; pay follows the rules; no hand-typed figure
- 🟦 Rev 1 — B: row "Club owes me … not built"
+ 🟦 Rev 1 — H: merge test row for clubPaidThrough
+ 🟦 Rev 1 — J: handoff §00 items 1–2 are in this PR: mrSetClaim refuses a settled week; mrCyclePersonal gets the claim writer's guard; one smoke check each
- 🟦 Rev 1 — J: "§00 items 1–2 still open, not in this PR"
+ 🟦 Rev 1 — Stage 2: club payout tally and button, the settled-week claim refusal, the toggle guard
+ 🟦 Rev 1 — Risks: the club payout records a date, not a partial amount
- 🟦 Rev 1 — Risks: "Club owes me is not built"
- 🟦 Rev 1 — Risks: "Dad sets an arbitrary pay on a result; here Dad edits the points"
- 🟦 Rev 1 — Risks: "Prototype fines ($0.50 box) replaced by the catalog" (a decision, not a risk)
- 🟦 Rev 1 — Risks: "Still open after this PR: settled-week claim lock, mrCyclePersonal guard"
+ 🟦 Rev 1 — Risks: nothing from the older handoff stays open except its editable category table
```

**Stages to finish**
10 stages: one record update, five build steps and one pull request by Claude, then your merge, your iPad check and a four-Sunday pilot.
1. Record today's decisions and the rewrite choice in the working record — Claude
2. Build the arithmetic core, rules, loan terms, request queue and their unit tests — Claude
3. Build the Grown-ups tabs and the kid's request sheets — Claude
4. Build My money v2 — Claude
5. Build the Sunday ritual and the new sign sequence; retire the old meeting money panels — Claude
6. Styling for both looks and the phone, rewrite the affected smoke checks, bump the build stamp, full test run green — Claude
7. Open the draft pull request with the regression table and the records updated — Claude
8. Review and merge the pull request — You
9. Open the live app on the iPad, confirm the build stamp, run one Sunday for each girl — You
10. Pilot for four Sundays; report anything that does not add up — You, then Claude fixes

Date 2026-10-03 · branch to create: `claude/sunday-v15` from `main` @ `8b56fdb` · one PR (owner's choice) · executor `opus-worker` (System Design/Redesign).

## Context

The owner designed a replacement for the kids' pocket-money system as three iPad prototypes (Sunday v15, My Money v2, Grown-ups v2) plus a handoff. The current app has a working but differently shaped money system: a three-step family meeting with "What I earned / What I do with it" panels, a loan with monthly payments and a down payment, pots on a stage ladder, a Record sheet, a money stream (`profile.events`) from which every balance is derived, and about 100 smoke checks. The prototypes are the spec; the stream, the frozen ledgers, the effective-dated rules and the merge layer are the foundation they must be built on. The job is to make the prototype's concepts flow through the app's real data without dead or duplicated logic.

**Checked against:** `WORKING_RECORD.md` request ledger rows 13, 14, 17, 24, 28–42, 46, 47, 59 (PR C cash pool — now superseded by the owner's decision of 2026-10-03), row 25 and `HANDOFF-pocket-money.md` §00/§3/§6/§9/§12 (items subsumed or still open are listed in §J); hotspot row **Pocket money**: 4 fix rounds, 2 recurrences, rewrite-vs-repair reviewed 2026-09-22 → *repair*. This plan is the owner-chosen **rewrite** of the kid-facing surfaces and the loan terms, on top of the unchanged stream/ledger/rules engine. Step 0 updates that row.

## Owner decisions taken today (settled; not reopened by this plan)

| # | Decision |
|---|---|
| D1 | Club sessions come from **both**: an "Assistant job" planner block (her ✓ pre-fills attendance, fixable on Sunday; skip requests name the block) and a one-off session a parent places from Grown-ups. |
| D2 | **Fines keep the app's catalog** (5 items, $1, two free repeats, `box_repeat`, daily floor). Grown-ups › Fines logs those and reminds that every occurrence is recorded even when free. No $0.50 box rule. A kid may still dispute a fine. |
| D3 | **Chores keep today's engine** (per chore by grade, $3/day cap, two free); Sunday relabels it "a day done right = $3". Calibration tests unchanged. |
| D4 | **Loan uses the prototype terms**: weekly must-pay = monthly × 12 ÷ 52, 1%/yr on the balance added every 4 Sundays, 10% bonus on extra, no down payment, several rows. |
| D5 | PR C (cash pool) is **superseded**; nothing from it is built. |
| D6 | 📖 Money story and 🎓 Money school **stay for now**; the '?' explainers are new and reviewed before any retirement. |
| D7 | **One PR.** |
| D8 | **Stacked phone layout** at 390px; the house sweeps apply. |

## Design decisions (this plan's; approval covers them)

### A. Where each prototype screen lives

The prototype's three-tab strip is prototype navigation. The app has one kid nav and one parent portal (ARCHITECTURE › Navigation: no second nav row).

| Prototype | In the app |
|---|---|
| 🏠 My money | Kid nav **Money** → `screen-mymoney`, `mnyRenderMyMoney` rewritten (js/22-money-page1.js). |
| ☀️ Sunday | The family meeting's **money step** (`MM_STEPS` stays week/money/close). `mnyRenderEarned`/`mnyRenderDecide` are replaced by the four-sub-step ritual. Commit, Undo, catch-up, `canCloseWeek` and `isChildMoneyCommitted` keep working unchanged. A kid's My money shows a ☀️ countdown card (not a tab); in parent mode that card opens the meeting at the money step for that kid (`openFamilyMeeting` with the child selected). |
| 👨‍👩‍👧 Grown-ups | Parent portal **Setup › 💰 Money rules** panel (`#ptab-money` / `#mnyRulesWrap`) becomes **Grown-ups money** with top sub-tabs ✅ Approve · ➕ Commitments · 📦 Fines · 🎁 Expected · ⚙️ Rules · 📖 More. The side rail goes; its sections (history, grandma, changes, holdings editor, repair, stream setup, missed week) live under More. Parent › Now gains one row "✅ N to answer" routing to Approve (same shape as the existing moves row). |
| 🗣️ Dad's card | A button in the meeting head, opening a sheet through `openSheet` with the per-step ASK/SAY/WAIT script and the step checklist. |

Sunday sub-steps: 1 Guess → 2 Payday → 3 I choose → 4 Signed. **Sign = commit for that kid** (hold to sign). 🟩 Rev 2: **↺ Redo returns one girl only**, as drawn: `mmTakeUndoSnapshot(wk, kid)` is taken per kid at sign and `mmUndoRecord(kid)` restores her wallet, debts, holdings, deposits, goals, XP, her ledger row, `finalizedWeeks[wk][kid]`, `weekPlans[wk][kid]` and tombstones her commit's stream lines; the shared `meetingsHeld` is cleared only when neither girl is signed. `mmUndoHeld` keeps its rule (money moved after her sign withdraws her Redo). The meeting-wide Undo button is retired. 🟩 **Next Sunday →** = the meeting's close step for the second child or `mmHide`; the per-kid "mark applied" bookkeeping happens at sign (see E), not at a separate Next Sunday action.

### B. Data model — prototype concept → repo store

Rule: every write goes through the function that already owns it; no new stream homes; every new key has a merge decision and a two-device test.

| Prototype | Store | New? | Merge decision |
|---|---|---|---|
| Requests to Dad: `comp`, `goal`, `adv`, `skip`, `dispute` | **`profile.requests[]`** `{id:'req-…', kind, status:null\|'yes'\|'no'\|'talk', askedAt, answeredAt, appliedWeek, by, text, …kind fields}` | yes | `mergeArrayById(…, 'req:')` in `mergeProfileState` — an answer is an edit, newest wins; tombstone so a withdrawn one stays gone (same reasoning as `moveRequests`). |
| Request `move` / `cash out` | existing `profile.moveRequests` (+ `talkAt`) | field only | unchanged (`mvq:`) |
| Request `gift`, `deposit` (cash from home) | existing `profile.deposits` with `pendingApproval` (+ `talkAt`; `from:'home'` category added to `MNY_FROM` if absent) | field only | unchanged (`dep:`) |
| "Asked Dad" list, Approve queue | **one reader** `mnyRequestsFor(kid)` (js/46) unions the three stores into `{id, store, kind, status, text, icon, amount, open, applied}`; **one answerer** `mnyAnswerRequest(kid, id, 'yes'\|'no'\|'talk')` routes to the owner per store/kind. | functions | — |
| Goal jar | a holding `{kind:'savings', goalId, rateAnnual:0, name}` tied to the active `savingGoals` row; `mnySavedTotal`/`mnyTakeFromSaved` exclude `goalId` holdings; `mnyGoalHolding(kid)` is the one reader. No new stream home (`ready`). | holding fields | unchanged (`hold:`, `sgoal:`) |
| 🔒 Locked away, 4 weeks | `moneyOpenGIC(kid, amount, term, opts)` accepts `{weeks:4}`: `termWeeks`, `maturesOn` = the Saturday before the 4th-next meeting Sunday, `rateAnnual` from rules `pots.rates.gic`. Existing 12-month holdings mature on their own date. `mnySimCatchUp` pays maturity to cash unchanged; the Payday step shows it under 🏦 From my bank as "🔓 came back". | holding fields | unchanged |
| ⏪ Drawn in advance | request kind `adv` `{amount, day, why}`; at approval **nothing moves** (the cash came from Dad's pocket); at sign the approved, unapplied ones are a deduction line `earned → spent` with `note:'advance'`, `ref:req.id`, and `appliedWeek = wk`. "Forgot to ask" on payday = the parent adds an `adv` request already `yes` through the same writer. | — | — |
| ⛸️ Assistant job | `DEFAULT_ACTIVITIES` gains `{id:'assistant_job', sub:'training', name:'Assistant job', icon:'⛸️', cat:'training', isTraining:true, isPaidSession:true, travels:true}`. Attendance answer: **`profile.earnings[wk].sessions[blockId] = true\|false`** written by `mrSetSessionAttendance(kid, wk, blockId, attended)` (parent-only, stamps like `mrSetChoreGrade`). Unanswered → default from `isBlockCompleted` (✓) / `isBlockNotDone` (✗) / else "?". **New channel** `mrSessionsWeek(wk, kid)` → `{sessions:[{blockId, dayKey, name, attended}], paid}`, rate `rules.sessions.perSession`; added to `mrWeekBreakdown` gross, `original`, overrides (`ov.sessions`), and the frozen ledger (`sessions`, `sessionsPaid`). One-off session (D1) = a parent places an `assistant_job` block through the existing block writer `mrPlaceCompetitionBlock` generalised to `mrPlaceActivityBlock(kid, actId, dayKey, startMin)`. Skip request `{blockId}` → on yes `mrSetSessionAttendance(false)`. | activity + earnings field + channel | `earnings[wk]` already merges whole-week by stamp (`mergeEarnings`); test it. |
| 🏆 Tell a result | request kind `comp` `{compId?, blockId?, custom, sport, name, dayKey, races[{ev,time,pts}], pts, grp, ovr, qualified, provincial}`; on yes → `mrAddCompetition(kid, {…, points: Σ races.pts or pts, placement:{group,overall}, races})` — the one owner, which places/adopts the block (custom meets get one) and runs `mnyLateCompSync`. The Approve card's −/+ **edits the points** before yes (the results sheet decides; no second "pay" figure). | request kind; `races` detail field on the competition | `comp:` unchanged |
| 🎯 New goal | request kind `goal` `{name, icon, target, keep:'move'\|'ready'}`; on yes → `mnyAddGoal`, previous goal `done`, goal holding renamed; `keep:'ready'` → goal holding converted to a plain savings holding through `mnyMoveMoney` semantics (no stream line: same home). | request kind | — |
| Fine dispute | request kind `dispute` `{fineId}`; on yes → `mrRemoveFine` (existing owner) | request kind | — |
| ⭐ Stickers | **derived** from `moneyLedger` rows (`sdStickersFor(row)` in the pure core) — no key, same idiom as `xp2`. | — | — |
| 🎁 Expected money | **`profile.expected[]`** `{id, month:'YYYY-MM', label, amount}` | yes | `mergeArrayById(…, 'exp:')` |
| 📒 Passbook, histCat, timeline | `moneyLedger[wk][kid]` rows; commit adds `sessions, sessionsPaid, deposits, passive, advance, loanCash, extra, cents, goal` beside the existing `plan, spend, ready, gic, stock, passive`. Rows older than the split show earned only (handoff known item). | ledger fields | per-week stamped map, unchanged |
| Sunday in-progress (guess, source taps, allocation, sub-step, hold) | device-local `sdDraft` keyed `kid+wk`, mirrored to `localStorage` `wp_sunday_<kid>_<wk>` in try/catch; never in `state` (same reasoning as looks). | — | — |
| 📉 Market wobble | rule `market.wobblePct` (0 or 2). At reveal, if > 0 and no stock holding carries `wobbledWeek === wk`, `mnyRevalueStock(kid, −pct, {note:'wobble'})` writes the loss the way a holding losing value already does and stamps `wobbledWeek`. | rule + holding field | — |
| 🎯 Earning target, year so far | `rules.targets.<kid>.annual`, `mrYearToDate` (existing) | — | — |
| Words stage | rule `words.<kid>` 1–3 | rule | — |
| 🟦 Rev 1 — 🧾 "Club owes me" (the club pays the assistant job twice a year; Dad advances $6 a session each Sunday) | **Derived tally**: Σ `sessionsPaid` over the kid's ledger rows after `clubPaidThrough[kid]`, shown on Sunday's What-I-own card and on Grown-ups › Commitments as "Club owes Dad $X · N sessions since <date>". Grown-ups button "✓ Club paid" writes **`state.shared.chore.clubPaidThrough[kid] = weekKey`** and a log line; nothing moves in her money (the club pays Dad back). | shared key | `// lww: clubPaidThrough — one date per kid; the newer value counts.` + two-device test 🟦 |
| 🟩 Rev 2 — Result pay | As drawn: the Approve card's − / + steps the **dollar amount** ("You made it $X"), checked by Dad against the published sheet. Stored on the competition as `awardedOverride {value, by, at}` beside her entry (`awarded` from the rules stays); `mrCompetitionWeek` — the one owner — pays the override when present; the ledger row and the kid's "Results & gifts" line show "$X (Dad made it $Y)". The 🟦 Rev 1 field-editing card is dropped. 🟩 | competition field | `comp:` unchanged |
| 🟩 Rev 2 — Savings gate | Always open: `school.stagePct.ready = 0`; My money's loan wall draws the 🔒 30% and 📈 40% flags only; Savings never dims. 🟩 | — | — |

### C. Rules — every prototype key becomes a path in `MR_DEFAULT_RULES`, read through `mrRulesForWeek`

New or changed paths (defaults in brackets): `sessions.perSession` (6) · `advance.maxPerWeek` (5) · `spend.capPct` (20; replaces the `0.2` literal in `mnyPool`) · `loan.ratePct` (1) · `loan.interestEverySundays` (4) · `loan.extraBonusPct` (10, read where `earlyPaymentBonusPct` was) · `pots.safety` (10) · `pots.lockWeeks` (4) · `pots.rates` `{ready:1.5, gic:4, stock:7}` (replace `bank.savingsRate`/`gicRates` as the rate source; `bank` stays for `marketMonth`) · `school.stagePct` `{ready:0, locked:30, stock:40, mix:100}` (ready always open; `mnyStagePctRefusal` order rule still holds) · `words` `{jenn:1, jess:1}` · `market.wobblePct` (0). Existing: `chores.*`, `streak.*`, `competition.*`, `fines.*`, `targets.*`, `loan.monthly.<kid>` unchanged. Left in place but no longer read by the flow: `loan.downPayment*`, `loan.arrearsRatePct`, `loan.months`, `learning.items.*.amount` — a lived week keeps its rules.

"Save · starts next Sunday" = `mrApplyEdits(changes, {effectiveFrom: next Monday's key, reason:'grownups'})` through the existing `mnyQueueEdit`/`mnySavePending`; the change log card reads `moneyRules.log`. The impact preview (typical week, loan a week, free by, most to spend) is computed by the pure core from the pending rules vs saved rules. A household with a stored rulebook gets the new fields the way the house rules did: `mrHouseRulesPending` is extended with the new paths (append a version; never rewrite).

### D. Loan

`debts[]` keep their shape. New readers in js/20: `mnyWeeklyDue(debt)` = `monthly × 12 ÷ 52`; `mnyMustPay(kid)` = Σ weekly over open debts + `arrears`, capped at the balance. Interest: `loanAccrueBalanceInterest(kid, wk)` runs at sign when `debt.sundaysSinceInterest` reaches `loan.interestEverySundays`; it adds `balance × ratePct/100 × 4/52` to the existing `arrearsInterest` bucket (shown as "interest added", the 🟥 brick) and writes an `interest`-kind stream line as the existing arrears accrual does. `loanAccrueArrears`, `loanSundayTransfer`, `mnySundayTransferAll`, `mnyDueNowAll` and the down-payment branch of `loanDueNow` are **retired** (deleted together with their smoke checks). Shortfall (total < must-pay): pay what there is, the rest is carried in `arrears` and shown next Sunday as "📌 still owed from last week" — no interest on it. Payments allocate **oldest debt first** (`createdAt`), which equals the prototype's "paid oldest first" (bonus is uniform). `mnyPaidPct` unchanged. Migration: existing debts keep `principal`/`paid`; `downPayment` is ignored.

Commitments (Grown-ups ➕): `mnyAddCommitment(kid, {what, cost, sharePct, weeks})` → her share = cost × share; down = 10% of her share moved `ready → cash` then `cash → loan:<id>` as a `down` payment; new debt `{principal: her share, paid: down, monthly: (share − down) ÷ weeks × 52 ÷ 12, createdAt}`; the affordability card reads `mnyMustPay` ÷ steady average (last 4 ledger rows) against the 50% limit. 🌧️ Surprise cost: `mnyAddSurprise(kid, {what, cost})` → Savings pays first (`moneyWithdraw` then `cash → spent`), the rest is a debt with `monthly: 0` paid by extra. Both feed the "🆕 New row on my wall" card on the next Sunday (read from debts with `createdAt` after the last signed week; no `planner-commit` store).

### E. The sign sequence (`mnyDoCommit` rewritten; each line through its owner)

1. `mmUndoHeld()`; `mnySimCatchUp(kid)` (interest, prices, lock maturity → cash); passive gain read from `valueAtLastMeeting`.
2. 🟩 Rev 2: `mmTakeUndoSnapshot(wk, kid)` — this girl only. 🟩
3. Approved, unapplied **gifts/deposits** credited (`mnyApproveDeposit` path, existing).
4. `commitKidWeek(wk, kid)` — unchanged owner: freezes the ledger (now with `sessions`), credits net to cash, `evSettleLines`, XP, box release. The loan transfer call inside it is replaced by step 6.
5. **Advance** deductions: for each approved `adv` not applied → `cash → spent` line `note:'advance'`, `appliedWeek = wk`.
6. **Loan**: must-pay through `loanRecordPayment(kid, amount, 'scheduled', oldestOpenDebtId)` (arrears first), then extra × (1 + bonus) through `loanRecordPayment(…, 'early')`; `loanAccrueBalanceInterest` if due; `sundaysSinceInterest++`.
7. **Placement**, in the pure core's order: 💵 cash out is money staying in `cash`; `ready` → `moneyDeposit`; `goal` → `moneyDeposit` into the goal holding (+ `g.saved`); `gic` → `moneyOpenGIC(…, {weeks: lockWeeks})`; `stock` → `mnyBuyChosenFund`; **cents** → `ready`.
8. In = Out asserted by the core before any write (`sdCheckInOut`); a mismatch refuses the sign with a sentence (never silently rounds).
9. `mnySavePlan(wk, kid, {planId:'sunday', split, committedAt})` → `isChildMoneyCommitted` true; ledger fields filled; `mnyStampPassiveBaseline`.
10. Requests answered `yes` for this kid and still unapplied (`comp`, `goal`, `skip`, `dispute`, moves, deposits) stamped `appliedWeek`; fines of the week are in the frozen ledger already.
11. 🟩 Rev 2: `mmUndoSeal(kid)`; both children committed → `commitMeetingShared`. 🟩

**Undo fix (pre-existing, docs/handoff/pr-c-cash-pool.md §5b):** the per-kid snapshot records the ids of events written between snapshot and seal; `mmUndoRecord(kid)` tombstones exactly those (`evReverse` is wrong here — the commit never happened) so a re-sign does not double-count the stream. Test first (`tests/stream.test.js` + smoke `undoDoesNotDoubleCountTheStream`).

### F. Files

| File | Change |
|---|---|
| `js/43-sunday-core.js` **new** | Pure arithmetic with a `module.exports` guard: `sdIncome(lines)`, `sdPile`, `sdHers`, `sdCanPlace`, `sdPlace`, `sdPresets`, `sdSign` (returns the full `signed` record, book row, stickers, milestones), `sdVerdicts` (income + strategy sentences), `sdForecast` (1 wk / 1 mo / 5 mo), `sdImpact` (rules preview), `sdStickersFor`, `sdCheckInOut`, `sdPercents` (largest-remainder). No DOM, no state. |
| `js/44-sunday.js` **new** | The money step UI: draft, four sub-steps, hold-to-add (pointer events, 2 s = $5, progress bar), flying coins + glow (CSS classes; respects `prefers-reduced-motion`), '?' explainer sheets (What/Why/Watch + Chinese line, through `openSheet`), Dad's card sheet, right-pane cards. Renders into the meeting body; actions are `data-mny-action` under `familyMeetingBody` (already a host). |
| `js/45-requests.js` **new** | `profile.requests` owner: `mnyEnsureRequests`, `mnyAddRequest`, `mnyRequestsFor`, `mnyAnswerRequest`, `mnyApplyRequest`; the kid's request sheets (Tell a result, Club sessions, Move/Cash/Put in, Draw in advance, New goal) through `openSheet`, drafts module-level like `rcDraft`. |
| `js/46-grownups.js` **new** | Approve queue, Commitments (+ `mnyAddCommitment`, `mnyAddSurprise`), Fines tab (catalog + standing + "record it even when free" line), Expected, the sub-tab bar. |
| `js/22-money-page1.js` | `mnyRenderMyMoney` rewritten to My Money v2 (countdown, chips, loan wall, What I own, goal jar, passbook, coming up, stickers, four action buttons); story page untouched. |
| `js/23-money-meeting.js` | `mnyRenderEarned`, `mnyRenderDecide`, `mnyDoConfirm`'s UI, the inline competition/gift forms are replaced by js/44; `mmPlannedCompetitions`, `mmUnrecordedCompetitions`, `mnyBuyChosenFund`, `mnyCommitRefusal` stay; `mnyDoCommit` rewritten per E. |
| `js/24-money-parent.js` | Rules tab rewritten to the stepper sections with impact preview and log; the rail becomes the sub-tab bar; retired sections' code deleted or moved under More. |
| `js/18-rules.js` | `MR_DEFAULT_RULES` paths (C); `mrSessionsWeek`, `mrSetSessionAttendance`; `mrWeekBreakdown` + `mrFreezeWeekLedger` gain the sessions channel; `mrAddCompetition` accepts `races` and a kid proposal (handoff §9 owner decision) — a request is the proposal, so `pendingApproval` on the competition is not needed; `mrPlaceActivityBlock`. |
| `js/20-loan.js` | §D. |
| `js/21-money-data.js` | goal holding helpers; `MNY_TABS` (kid: money + school; the `grow`/`where` meeting tabs become one `sunday`); `mnyPool` reads `spend.capPct`; stage pct default `ready:0`; `MNY_FROM` + `home`. |
| `js/14-money.js` | `moneyOpenGIC` weeks term; `mnyRevalueStock`; `bank` rates no longer the source. |
| `js/01-config.js` | `assistant_job` activity; `APP_BUILD` bump. |
| `js/04-merge.js` | two lines: `requests` (`req:`), `expected` (`exp:`) — with failing two-device tests first. |
| `js/36-status.js` | unchanged (reads `mnyIsCommitted`). |
| `js/32-parent-now.js` | "✅ N to answer" row. |
| `js/99-main.js` | nothing new to bind if all actions stay under `MNY_CLICK_HOSTS`; `mnyRulesWrap` already listed. |
| `index.html`, `sw.js` | the four new scripts in both lists; `SW_VERSION` = `APP_BUILD` = `2026-10-03a`. |
| `css/app.css` | new `--mny-*` tokens for the prototype's surfaces (steady green, bonus gold, bank blue, loan violet, ghost dashed, glow orange), identical in both looks (money colours are meaning); sizes multiply `--text-scale`; 44px targets; stacked layout under 768px. |
| `tests/sunday.test.js` **new** | §H. `package.json` `test:sunday` in the `test` chain + `.github/workflows/ci.yml` step (check-ci-scripts). |

### G. What is retired (deleted, not left unreachable)

`mnyRenderEarned`/`mnyRenderDecide` and their cards, the meeting's inline competition form (the kid's Tell-a-result sheet and the Record sheet remain the two doors, one writer), `loanSundayTransfer`/`mnySundayTransferAll`/`loanAccrueArrears`/`mnyAccrueArrearsAll`/down-payment logic, `MNY_PLANS` (replaced by the three presets in the core), the parent side rail, `bank.savingsRate`/`gicRates` as rate sources, `MNY_PAID`/`MNY_UNPAID` literals if still present. Money school's ladder reads `school.stagePct` (ready 0%) and its concept cards read the same `MNY_CONCEPTS` text the '?' sheets use — one statement of each concept. Money story unchanged.

### H. Tests and verification

- **`tests/sunday.test.js`** (pure core; `process.env.TZ='UTC'` first): 8–20 Sunday runs for both kids with random but valid placements, asserting every week: In = Out; cents ≤ $0.99 to Savings; loan balance never negative; interest added exactly every 4 Sundays; a lock returns on the Saturday before the 4th-next Sunday; goal overflow → Savings; gates cross at 30/40% and never re-lock; spend ≤ cap; advance ≤ max; percentages sum to 100 with "<1%". Edge cases from the handoff: all sessions missed; zero bonus; steady < must-pay (🚨 verdict, arrears carried); spend cap hit; advance at max; forgotten advance on payday; loan fully paid (spill to Savings, 🎉 verdict); goal reached; new goal with move vs Savings; rules change takes effect next week only.
- **`tests/merge.test.js`**: two-device rows for 🟦 `clubPaidThrough` (newer date wins both ways) 🟦, `requests` (ask on iPad, answer on phone, both converge; a withdrawn request stays gone), `expected`, `earnings[wk].sessions` (attendance answered on one device survives a grade on the other), goal holding + `savingGoals` convergence.
- **`tests/stream.test.js`**: the Undo tombstone fix; advance and interest lines keep *opening + Σin − Σout === in hand*.
- **`tests/money.test.js`**: unchanged and must stay green (D3); `tools/money-calibrate.js` gains the sessions channel at 0 sessions so the pinned figures hold.
- **`tests/smoke.js`** — rewritten by category: (i) **meeting money panels** (`meetingMoneyFlowEndToEnd`, `planNeverOverspendsThePool`, `moneyTabsWorkInsideTheMeeting`, `meetingWontCelebrateHalfDone`, `lockedPlansAndBucketsRefuse`, `aPlannedCompetitionMustBeScored`, `competitionMoneyReachesThePool`, `onePoolReadsTheSameOnEveryScreen` …) become Sunday checks: `sundayGuessIsBlockedUntilDadAnswers`, `sundayPaydayAddsUp` (coin count = floor($), % of money in), `sundayHoldAddsFive`, `sundayCannotSignWithMoneyUnplaced`, `sundayInEqualsOut`, `sundaySignMovesEveryDollarThroughItsOwner` (stream drift zero after sign), 🟩 `sundayRedoReturnsOnlyHer` (sister's signing untouched; her stream lines gone; `undoReturnsBothChildren` retired on purpose) 🟩, `sundayRulesChangeShowsNextWeek`, `sundayMilestoneOpensAPot`; (ii) **loan** (`loanChargesOncePerMonth`, `arrearsInterestOncePerMonth`, `downPaymentComesFirst`, `extraPaysHighestBonusFirst`, `loanPaymentIsArguableNotForgiven`) → `loanInterestEveryFourSundays`, `mustPayIsTakenFirst`, `extraCountsOneTen`, `shortfallIsCarriedNotCharged`, `oldestRowIsPaidFirst`; (iii) **pots** (`lockedMoneyMaturesOnItsDate`, `savingGoalEndToEnd`, `theGatesComeFromOneTable`, `moneySchoolGatesAndNames`) updated for 4-week locks, the goal holding and ready at 0%; (iv) **My money** (`earningsBarOnMyMoney`, `walletTilesReadTheRealSavings`, `todayMoneyRowMatchesMyMoney`, `kidTabsExplainRatherThanRefuse`) → `passbookShowsTheLastFourSundays`, `passbookSharesSumToOneHundred`, `loanWallMatchesTheDebts`, `whatIOwnMatchesTheHoldings`, `everyRequestLandsInApprove`; (v) **parent** (`ruleEditsSaveAsOneChange`, `everyMoneyActionHasAListener`, `everyMoneyControlClicksClean`, `tabBarOnEveryMoneySurface`) kept and extended to the new tabs; `finesTabRecordsEvenWhenFree`; (vi) kept as-is: stream, gift, Grandma, late-meet, repair, record-sheet, house-rules checks. The house sweeps (`kidScreensMeetTheHouseRules` with new rows for Sunday steps 1–4, My money with each sheet open; `parentScreensMeetTheHouseRules` with each Grown-ups tab) run in both looks at 390 and 1194.
- Gate before push: `npm ci && npm test` (check · merge · buffers · stream · cleanup · xp · money · **sunday** · smoke).

### I. Migration and compatibility on a device with data

Rulebook: a new version appended through the house-rules pending mechanism (new paths only). Debts: untouched shape; `downPayment` ignored; `sundaysSinceInterest` starts at 0. Holdings: 12-month GICs mature on their date; a `savingGoals` row with `saved > 0` gets a goal holding created from the kept-ready balance on first read (idempotent by `goalId`). Deposits/moveRequests: untouched. Ledger: old rows readable; new fields optional. `weekPlans`: `planId:'sunday'` from now; old plans readable. No cross-device migration of events.

### J. Build and records (main session, after the worker)

0. **Step 0 (this record):** `WORKING_RECORD.md` — hotspot row Pocket money: add "**rewrite chosen by the owner 2026-10-03** (Sunday v15); 2026-09-22 repair decision superseded for the kid surfaces and loan terms"; request ledger rows for today's eight decisions; rows 13/14/17/28–42/59 marked superseded by D5; `docs/handoff/pr-c-cash-pool.md` gets a one-line "Superseded 2026-10-03" head. `HANDOFF-pocket-money.md`: §9 (kid proposes a meet) and §3's `invest→` bug (`mnyMoveViaCash` already) subsumed; 🟦 Rev 1: §00 items 1–2 are **in this PR** (stage 2): (1) `mrSetClaim` refuses a claim on a week `mnyWeekSettled` says is settled, with a sentence, so no door can claim a settled week; (2) `mrCyclePersonal` gets the same `!isParent() && kid !== activeProfile()` guard as `mrSetClaim`; one smoke check each 🟦; §00 item 3 (`.mny-tab-tag`) moot once the tab bar is restyled — verified by the sweep.
1. Branch `claude/sunday-v15`; worker stages below; `npm test` after each stage.
2. `FEATURES.md` "App — Pocket money" gains the Sunday v15 manifest; `ARCHITECTURE.md` gains "Sunday v15 — the ritual is the money step" (data model table, the one-reader/one-answerer rule for requests, the goal-holding rule, the 4-week lock, the attendance channel, what was retired).
3. Draft PR with the regression table against `FEATURES.md` money section; merge is the owner's; "deployed" only after `Build 2026-10-03a` is read on the iPad.

### Worker stages (one branch, in order; `npm test` green after each)

1. Core + rules + tests: js/43, rules paths, `mrSessionsWeek`, loan readers/interest, `moneyOpenGIC` weeks, goal holding, `requests`/`expected` merge lines (tests first), `tests/sunday.test.js`, calibration tool, Undo tombstone fix.
2. Requests + Grown-ups: js/45, js/46, parent rules tab, Now row, `assistant_job` activity, one-off session placement 🟦 Rev 1: + club payout tally and button, `mrSetClaim` settled-week refusal, `mrCyclePersonal` guard 🟦.
3. My money v2 (js/22).
4. Sunday ritual (js/44) + `mnyDoCommit` rewrite + retirements (§G) + Money school/story reading the new gates and concepts.
5. CSS tokens, both looks, phone stack, animations, reduced motion; smoke rewrite (§H v); shell lists, build stamps.

### Observable success criteria

1. On a fresh profile and on a seeded one, a parent can run Guess → Payday → I choose → Sign for both kids; `evShadowDrift` is zero after each sign; `canCloseWeek` turns true.
2. Every number on Sunday adds up on screen (In = Out, 100% placed, percentages 100).
3. A rule changed in Grown-ups changes next Sunday's hints, caps and gates, and not this week's frozen ledger.
4. A kid's request of each kind appears in Approve, is answered, and its effect lands on the right owner (competition recorded, goal switched, attendance marked, fine removed, advance deducted at sign, gift credited, move moved).
5. Chores, routine streak, fines, competitions and club attendance on Sunday equal the planner's own figures for the week (`mrWeekBreakdown`).
6. `npm test` green with the new suite in the chain and in CI; house sweeps pass in both looks at 390 and 1194.
7. Build stamp `2026-10-03a` on the page.

### 🟩 Rev 2 — Deviations from the prototype (the prototype is the acceptance standard; each line is approved or inherent)

| # | Prototype | This build | Status |
|---|---|---|---|
| 1 | Top strip My money · Sunday · Grown-ups on every screen | Sunday is the family meeting's money step; Grown-ups is Parent › Setup › the money panel; My money is the kid's Money tab | **approved** 2026-10-03 (🟩 Rev 2 question 1) |
| 2 | 📦 Box fine $0.50, free-text "what", logged by Mom/Dad | The app's fines catalog (5 items, two free repeats, box_repeat); the tab logs item · day · who, shows standing, reminds to record every occurrence | **approved** D2 |
| 3 | Chores "$3 per graded day, max $15" | Today's engine (per chore by grade, $3/day cap, two free); Sunday says "a day done right = $3"; max is 7 × $3 | **approved** D3 |
| 4 | iPad only, 1194×834 | Same at 1194; stacked single column at 390 | **approved** D8 |
| 5 | Hand-drawn look only | Pop look matches the prototype; Calm shows the same boxes in Calm's tokens (house rule) | **approved** D8 context; the looks rule predates this plan |
| 6 | ↺ Redo per girl | Per girl | **matches** (🟩 Rev 2) |
| 7 | − / + on a result's dollars | Same, stored as Dad's figure beside her entry | **matches** (🟩 Rev 2) |
| 8 | 🏦 flag at 20% on the wall (My Money v2) vs "Savings always open" (handoff, Sunday) | Always open, no 🏦 flag | **approved** (🟩 Rev 2 question 4) |
| 9 | Jenn/Jess switch buttons in every header | A girl sees only herself; a parent switches with the existing kid switcher | inherent (ARCHITECTURE: cross-sibling data is never a leaderboard) |
| 10 | Seeded dates (Oct 2026), seeded loans, sessions, stories | Real data: debts, blocks, ledger; Jess's story sentence generated from the week (handoff known item) | inherent |
| 11 | No company picker | The repo's existing fund picker, as the handoff asks | **approved** (handoff) |
| 12 | Money story / Money school absent | Kept for now | **approved** D6 |
| 13 | "Club owes me" row present in data, not drawn | Drawn on What I own and in Grown-ups, with a "✓ Club paid" button | **approved** (🟦 Rev 1) |
| 14 | Locked-away interest shown for 4 weeks only | Also the yearly-equivalent, as the handoff suggests | handoff item; drop on request |
| 15 | Prototype keeps its own in-memory rules/queue/fines/expected stores | One store each in the app's synced state, with merge decisions | inherent |

Anything not in this table is built as drawn.

### Risks and known gaps

- **Size.** One PR touching ~12 files, four new, ~100 smoke checks rewritten. Mitigated by the five stages each gated by `npm test`.
- Hold-to-add on iPad relies on pointer events + `touch-action:none`; verified on the device, not only headless.
- Coin/glow animations: CSS only, disabled under `prefers-reduced-motion`.
- Calm look: the hand-drawn prototype is Pop; Calm gets the same boxes with Calm tokens — needs a look on the iPad.
- 🟦 Rev 1: the club payout is recorded by date only; if the club ever pays part of what it owes, the tally does not model a partial payment (one "paid through" date). 🟦
- The kid's fine "dispute" maps to `mrRemoveFine` on yes (the app's own fines rules apply, D2).
- 🟩 Rev 2: a result's stored points and Dad's dollar figure can disagree; the record shows both and the override carries who and when. 🟩
- The 12-month GIC option disappears from the kid flow; a parent can still open one from Grown-ups › More › holdings.
- Old passbook rows show earned only.
- 🟦 Rev 1: nothing from the older pocket-money handoff stays open after this PR except its §2 editable category table, which the new Rules tab does not add (rows stay fixed, amounts editable). 🟦
