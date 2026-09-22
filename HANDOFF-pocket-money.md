# Handoff — Weekly-Planner pocket money

Written 2026-09-22 from a cloud session on branch `claude/inspiring-gauss-232zww`.
Audited read-only; **no money file was changed.** Paste this into a fresh chat.

**Goal:** close out the pocket-money redesign — decide what is actually broken,
what is working-as-designed-but-wrong-for-this-family, and what to do about the
categories, the rules table and the gift/move-money gaps.

---

## 0 · Read this first — the premise did not hold

The session began from "check every promise you made in PR #90, a lot were not
delivered." Audited promise by promise against the code at HEAD:
**13 of 15 delivered, 2 partial, 3 with tests that would not fail if the
promise broke.**

What is actually happening is **delivered-but-unreachable** and
**delivered-but-renamed** — which feels identical from the outside. Four of the
six complaints turned out to be features that exist and are hard to find, or
deliberate gates nobody wanted. Treat the list below as reachability and naming
work, not as a rebuild.

**One correction on record:** earlier in that session the assistant said no
rules-editor commit existed across PRs #89 and #90, inferred from commit
titles. That was wrong — see §2.

---

## 1 · Governance: the hotspot rule has fired

`CLAUDE.md` → Design Mode → Hotspot counter: *"When an area reaches 3 fix
rounds … the next patch is not allowed until a rewrite-vs-repair comparison is
presented: shared causes, what can be consolidated or removed, simplicity,
compatibility, migration, rollback, regression risk."*

The money area is now on round 3 — PR #89 (Stages 1–3), PR #90 (Stages 4–6),
and this round. **So the first deliverable in the new chat is that comparison,
not a patch.** `WORKING_RECORD.md`'s hotspot table does not yet list the money
area; add it.

The comparison has an obvious focus. There are **three key-spaces for one idea**:

| List | Keys | File |
|---|---|---|
| `EV_HOMES` / `RC_HOMES` | `cash` `ready` `locked` `invest` | `js/40-stream.js:55-58`, `js/41-record.js:71` |
| `MNY_BUCKETS` | `loan` `spend` `ready` `gic` `stock` | `js/21-money-data.js:43-54` |
| `MNY_HOLDING_KINDS` | `savings` `gic` `stock` | `js/21-money-data.js:207-211` |

`EV_HOME_FOR_HOLDING` (`js/40-stream.js:99`) and `evHomeNeed`'s `byKey`
(`js/40-stream.js:829`) exist only to translate between them. That is the shared
cause behind the category complaints, and it is the thing a redesign would
consolidate.

---

## 2 · The rules editor exists. The gap is narrower than "not editable".

**Path (verified in code, walkable on an iPad):**
**Parent Mode → Setup → 💰 Money rules**, and **Setup → 🕰️ Change history** for
the versions. Landing entries at `js/11-parent.js:48` and `:51-52`; panel
`money` → `mnyRenderRulesTab` (`js/24-money-parent.js:50`); host
`#ptab-money` / `#mnyRulesWrap` (`index.html:685-687`).

**What it can already do.** ~30 editable stepper paths — `chores.grade.3/2/1`,
`chores.dailyCap`, `chores.freeChoresPerWeek`, `learning.items.N.amount`,
`streak.tiers.N.bonus`, seven `competition.*`, `fines.items.N.amount`,
`targets.jenn/jess.annual`, `buys.items.N.amount`, `investing.fund`,
`school.unlockStage.<kid>` — plus ＋/🗑 rows for loans, holdings and prior
weeks, a "find a price" search, an effective-from date input, a pending bar, and
`mrApplyEdits` (`js/18-rules.js:376`) committing **one effective-dated version**
with a reason code and a per-field audit log. `mrSaveRules`, `mrNewVersion`,
`mrAddVersion`, `mrSetRule`, `mrUpdateRules` do not exist — `mrApplyEdits` is
the only versioned writer.

**The real gap — amounts yes, rows no.** You can change
`competition.dance.silverPerItem`'s dollar value. You cannot rename the `dance`
key, delete it, or add a `skateStar` one. Same for chore, learning and fine
rows: the labels and keys are baked into `MR_DEFAULT_RULES`
(`js/18-rules.js:88-157`) and into the editor's hand-written card list
(`js/24-money-parent.js:181-190` literally spells out "Dance — per Silver item").
**That is the ask**: an editable *category table*, not just editable numbers.

**Then do the family's change:** remove **Dance** (it is really a skating level
exam) and add **skating star level** as a category beside skating competition.
Touches `MR_DEFAULT_RULES.competition`, `mrScoreCompetition`, `mrTagForSport`,
the editor's card list, and the Record sheet's sport picker.

**Two defects found next to it:**
- **Dead branch.** `pmPriceCards(r, editable)` emits `data-pm-action="edit"`
  pencils at `js/19-pocket.js:43`, but **no handler for `data-pm-action` exists
  anywhere**, and its only call site passes `editable=false`
  (`js/22-money-page1.js:668`). `tests/smoke.js:2392` asserts the button is
  absent. If you ever tried to edit a price from the kid's 💷 *What things pay*
  card, this is why nothing happened. Delete the parameter and the branch.
- **Merge hazard.** `moneyRules.versions` merges by id (`js/04-merge.js:403-413`),
  so two devices each adding a version both survive. If both land on the same
  `effectiveFrom`, `mrVersionForDate` takes the last match, so the
  later-created edit wins **wholesale** and the other device's changed fields
  are silently dropped from the live rules (still readable in history).

---

## 3 · Move money "all greyed out" — by design, with a root cause you will want changed

**The chain:** `rcMoveForm` (`js/41-record.js:294-300`) → `evHomeOpen`
(`js/40-stream.js:838-841`) → `evHomeNeed` → `MNY_BUCKETS[].need` → `mnyIsOpen`
(`js/21-money-data.js:1409-1412`) → `MNY_STAGES[mnyStageIndex(kid)].pct` →
**`mnyPaidPct(kid)` = percentage of the LOAN paid off** (`js/20-loan.js:123-127`).

Thresholds: **Keep it ready 30% · Lock it away 60% · Buy a bit of a company 90%.**
Cash is always open. The rationale is explicit at `js/40-stream.js:807-814` —
Money school opens the pots as the loan comes down, and a move sheet that
bypassed the ladder would make the ladder decorative.

**The root cause.** `mnyPaidPct` returns `0` when `principal === 0`. **A kid with
no loan at all is pinned at stage 0 forever**, so every destination except Cash
is greyed — and `openRecordSheet` defaults `moveTo: 'ready'`
(`js/41-record.js:106`), so the sheet opens already pointing at a shut pot.
That is almost certainly what was seen. A kid whose loan is under 30% paid gets
the same screen for a different reason.

**Escape hatch that exists today:** the parent stage override
`rules.school.unlockStage[<kid>]`, set at Setup → 💰 Money rules
(`js/24-money-parent.js:893`, read at `js/21-money-data.js:1397-1405`). It
raises the floor immediately.

**Decision needed:** should a no-loan kid be at stage 0, or at the top? The
ladder is tied to debt repayment, which silently assumes every child has a debt.

**Two real bugs in the move path:**
1. `invest → ready` and `invest → locked` pass `mnyMoveRefusal` (source has
   balance, destination open) so the chip is **not** greyed and no reason is
   shown — then `mnyMoveMoney` falls through to
   `showToast('That move is not one the app knows.')`
   (`js/40-stream.js:877-912`).
2. That gap poisons the kid's queue. `mnyRequestMove` validates with
   `mnyMoveRefusal` only (`js/40-stream.js:934-936`), so a kid can file
   `invest → ready`; the parent's card shows **"Yes, move it" enabled**
   (`js/24-money-parent.js:345-357`, `why` is null); pressing it returns false,
   the request is never stamped `approvedAt`/`rejectedAt`, and it sits in the
   queue forever re-offering a button that cannot work.

Note the chips are `.rc-chip.shut` — opacity 0.55, dashed border, **still
tappable**, with the reason rendered beside them. Deliberate: *"a disabled
control with no reason is a control a child works around"*
(`js/40-stream.js:855-856`).

---

## 4 · The categories you remember — found, and mostly renamed rather than removed

They are the action row of the retired **Bank & Invest** sub-tab, deleted in
commit **`437f79a` "Retire the old pocket-money screen and its market
simulation"** (28 Jul 2026). From `437f79a^:js/14-money.js:224-234` and
`437f79a^:js/19-pocket.js:91-94, 125, 176`:

`➕ Add cash` · `→ 🏦 Save` · `→ 🔒 GIC` · `→ 📈 Invest` · `→ 💵 To cash` ·
`🎿 Pay extra` · `🏦 Pay the down payment`, over a four-row balance list
`💵 Cash / 🏦 Savings / 🔒 GIC / 📈 Stocks`.

| You remembered | Today | Status |
|---|---|---|
| pay down the debt | bucket `loan` "Pay off" | renamed |
| cash out | `→ 💵 To cash`; `ready → cash`, `invest → cash` | **narrowed** — `locked → cash` now refused outright (`js/40-stream.js:869-872`) |
| deposit more money | the gift form (`mnyAddDeposit`), parent-gated, kid proposes | **narrowed** — the free-form "add cash" button is gone |
| investment: Saving | bucket `ready` "Keep it ready", holding `kind:'savings'` | renamed |
| investment: GIC | bucket `gic` "Lock it away for a year" | **narrowed** — terms were 3/6/12 with per-term rates and a parent rate card; `mnyMoveMoney` now hardcodes 12 (`js/40-stream.js:886`) though `moneyOpenGIC` still accepts `[3,6,12]` |
| investment: Stock | bucket `stock` "Buy a bit of a company" | **replaced** — ticker picking, fractional shares and the simulated 2023 market are gone; now a fixed 6-item `MNY_FUNDS` menu (`js/21-money-data.js:73-80`) |
| — | `spend` "Spend it", capped at 20% of the week | added |
| — | `goal:<id>` rows, never stage-locked | added |
| — | the 30/60/90 unlock ladder | added |

Also removed **on purpose**: commit `5f4cabe` *"One cash pool: inflows don't
carry destinations"* deleted the destination picker on money coming in. If the
memory is of choosing a category at the moment money arrived, that is the commit.

**So "the category is not correct" is a naming decision, not a bug.** The child-
facing renames ("Buy a bit of a company") no longer match the family's own
vocabulary. Decide the vocabulary first, then change labels in one place — which
is what §1's consolidation is for.

---

## 5 · There is no cash pool. "One pool" means one pool *per kid*.

No `cashPool`, no `familyCash`, no shared money key anywhere. **No function sums
across both kids.** `mnyPool(weekKey, kid)` (`js/21-money-data.js:1167-1189`) is
a per-kid, per-week *calculation*, not a store — it returns
`{cameIn, mustPay, mine, stockCap, spendCap, …}`.

"One pool" (`js/21-money-data.js:1116-1128`, and `ARCHITECTURE.md:2513-2516`)
means **inflows are fungible within one child's money**: which door a dollar
came in through has no bearing on which door it leaves by. It is not a family pot.

PR #89's own report answered *"Where is the cash pool"* with **"foundation laid
— the flow diagram is Stage 4."** That shipped in PR #90 as
📖 **My money story** (`js/42-flow.js`, `#screen-moneystory`). So the answer to
the question is that screen, plus `mnyEverything(kid)` = cash + kept-ready +
locked + invested (`js/21-money-data.js:400-402`), shown as *Everything I have*
on 💰 My money.

**What actually holds money, per kid:**
`wallet.cash` (the only live wallet field) · `holdings[]` with
`kind: 'savings' | 'gic' | 'stock'` · `deposits[]` (gifts) · `moveRequests[]` ·
`debts[]` (negative money, and what drives the whole unlock ladder).

**Dead fields:** `wallet.savings`, `wallet.gics[]`, `wallet.holdings{}` are
initialised by `ensureWallet` (`js/14-money.js:67-73`) and have **no live
reader** — every total now comes from the holding records. Safe to retire.

---

## 6 · Gifts: a parent can edit them. Three date bugs, and no approval path for an edit.

**It works.** 🎁 Gifts → tap a row (parent only) → Record sheet →
`mnyEditDeposit` (`js/21-money-data.js:812-857`). Amount, `from`, giver and
`dayKey` are all pre-filled and all passed (`js/41-record.js:388`). `weekKey` is
recomputed via `mnyGiftWeekFor`, which correctly walks forward past a committed
week.

**Amount arithmetic is right** — it moves the wallet by `delta`, not
reverse-and-reapply. The reverse version was a real defect that left the derived
balance behind the stored one by the whole gift; the comment at `:836-845`
records it. Don't "simplify" it back.

**Three date-edit bugs:**
1. **The old week is never reopened.** `mnyReopenWeek(kid, d.weekKey)` at `:855`
   uses the **new** week only. Move a gift from week A to week B and week A stays
   confirmed with a split that no longer matches, and nobody is told.
2. **The stream event never moves.** `mnyEditDeposit` does not touch the row
   written by `mnyGiftMirror` (`:654`), which carries its own `dayKey`/`weekKey`
   — so 📖 My money story and the month history still show the gift on the old
   date.
3. **A date-only edit writes nothing.** `delta === 0`, so no correction row is
   created at all; the change is visible only in the gifts list.

**"Parent approves the change" does not exist.** A kid can propose a **new** gift
(`pendingApproval` + `addedBy`, `mnyAddDeposit` `:747-774`), but the edit door
renders for a parent only (`js/22-money-page1.js:575-578`) and `mnyEditDeposit`
refuses her anyway (`:813`). There is no `pendingEdit` idiom anywhere. Building
one is the ask.

---

## 7 · The old rules ARE still on the kid Money tab — confirmed, and the root cause is worse

Commits `d1f341f` and `8e9104d` changed `js/18-rules.js`, `js/37-reflection.js`
and the tests. **No kid-facing money screen was touched.** Three restate the old
rules as literals:

| Surface | Says | Engine says |
|---|---|---|
| `MNY_PAID` (`js/21-money-data.js:143-148`), on 🎓 Money school via `js/25-money-school.js:142-145`, under **"Extra work — this pays"** | "Math pages, handwriting pages, Chinese words" | all four learning items `xpOnly: true, amount: 0` (`js/18-rules.js:88-92`) — **house rule 1** |
| Fines card `js/19-pocket.js:96-101` | flat `−$1.00` per behaviour item | `freeRepeats: 2`, first two free (`js/18-rules.js:153-156`) — **house rule 2** |
| Streak card `js/19-pocket.js:81` | "Miss a day and the run starts over" | `graceDays: 1` (`js/18-rules.js:107`) — **house rule 3** |

The reflection screen *was* updated (`js/37-reflection.js:362-364`), so the
reflection and the Money tab now disagree about the same rule.

**Root cause — no migration.** `pmPriceCards` renders from **stored** rules
(`js/22-money-page1.js:659-668` → `mrRules()` → `mrRulesFor()` →
`(v && v.rules) || MR_DEFAULT_RULES`), and `MR_DEFAULT_RULES` is copied into
state **only when `versions.length === 0`** (`js/18-rules.js:288-297`). A device
whose rulebook was seeded before 21 Sep still shows **Math $2 / Handwriting $2 /
Chinese $1** and flat fines, permanently, on both profiles.
`tests/money.test.js:18-21` asserts against `MR_DEFAULT_RULES` directly and
never against a stored version — which is why every test passes.

**Fix shape agreed with the owner (his Option 2):**
1. The three screens **read the live rules** instead of restating them.
2. **A migration that appends, never rewrites** — if no stored version is
   effective on or after the house-rules date, append a new effective-dated
   version carrying `MR_DEFAULT_RULES`. Appending is the point:
   `ARCHITECTURE.md:2553` locks *"a week already lived keeps the rules that were
   live when it was lived"*, and rewriting a saved version would reprice history.
3. **A test that would have caught it**: assert the kid screens' rendered copy
   against `mrRules()`, and assert a pre-house-rules fixture serves new rules for
   the current week and old rules for an old week.
4. Update `AllowanceRulesJennJess-v2.md` — it is the pre-house-rules document and
   currently backs the wrong side on all three rules (Math $2, flat −$1 fines, no
   grace day). Everything else in it already agrees with the engine.

---

## 8 · My money ↔ Money school duplication — one real defect, five cosmetic

| ID | Information | My money | Money school | Can drift? |
|---|---|---|---|---|
| D1 | loan % + green bar + "still to go" | `js/22-money-page1.js:505, 519-520` (per debt) | `js/25-money-school.js:75-79` (all debts) | scope only |
| D2 | which stage she is on / "opens as your loan comes down" | `js/22-money-page1.js:639-644` | `js/25-money-school.js:66-74` | no — both live |
| **D3** | **paid vs unpaid work; the free-chore count** | `js/19-pocket.js:52` — **live** `r.chores.freeChoresPerWeek` | `js/21-money-data.js:136-150` — **literal "two"** | **YES — real defect** |
| D4 | "the free ones are your lowest-paying" | `js/22-money-page1.js:259-260` **and** `js/19-pocket.js:52`, same screen | implied by `MNY_PAID[0]` | wording only |
| D5 | what money buys | `:333` (one item) | `:123-134` (full list) | no — both live |
| D6 | concept what/why/risk | `:928-931` (toast) | `:104-107` (panel) | locked-state copy differs |
| D7 | five-page tab bar | `:191` | `:48` | no — one function |

**D3 is the one to fix, and it compounds §7.** `freeChoresPerWeek` defaults to 2
and **is parent-editable** (`js/24-money-parent.js:165`). Change it to 3 and
💰 My money says "3 each week are free" while 🎓 Money school still says "after
your first two". The same two literals also carry the homework-is-paid error.

`js/19-pocket.js` renders on **`#screen-mymoney` only**; Money school merely
links to it. It **is** the authoritative live price list — so `MNY_PAID` /
`MNY_UNPAID` should be derived from it or deleted.

---

## 9 · A kid cannot record a meet — by design, with a gap the owner chose to close

Four layers, all deliberate: the ✚ is emitted for a parent only
(`js/22-money-page1.js:630`), `RC_KINDS` marks `meet` as `kid: false`
(`js/41-record.js:54-60`), `mrAddCompetition` refuses a kid outright
(`js/18-rules.js:1258`), and the meeting pages are parent-only.
`ARCHITECTURE.md:2247` states it: a child gets 2 of the 5 records "and both as
proposals"; a meet is "a grown-up's judgement about her week".

**The gap:** a **gift** she can propose ("Ask a grown-up", `rcSaveLabel`,
`js/41-record.js:178-182`); a **meet** has no propose path at all, and nothing on
screen says why.

**Owner's decision:** mirror the gift path exactly. A kid gets the ✚ on the 🏆
card and the `meet` kind; `mrAddCompetition` stops hard-refusing and instead
writes `pendingApproval: true` + `addedBy` for a kid; nothing scores or pays
until a parent approves. A pending meet is skipped by the commit loop the way a
pending deposit is. Scoring and money paths untouched.

---

## 10 · Jenn $0, Jess $50 — not a bug

`mnyCash(kid)` is `money2(ensureWallet(kid).cash)` (`js/21-money-data.js:398`) —
a **stored** balance defaulting to `cash: 0` (`js/14-money.js:69`). Searched all
of `js/` for a seeded or opening balance: **there is none.** The only literal 50
in a money path is the gift quick-pick chip `MNY_DEPOSIT_CHIPS = [20, 50, 100,
200]` (`js/21-money-data.js:94`). The catch-up default is `MNY_DEFAULT_WEEK = 3`,
applied to **both** kids equally (`js/24-money-parent.js:490, 551`). So every
dollar in `wallet.cash` arrived through a recorded write, and the $50 is almost
certainly an approved gift.

**Steps to confirm, walked against an iPad, no console needed:**
1. Switch to **Parent Mode**.
2. Open **💰 My money**.
3. Tap the **🦊 Jess** chip in the page head (parent-only kid switcher,
   `js/22-money-page1.js:190, 228-230`).
4. Expand **🎁 Gifts** (`Show ▸`) — last 10 gifts with giver, date and amount,
   and any flagged *waiting for a grown-up* (`js/22-money-page1.js:560-588`).
5. Tap **🐥 Jenn** and repeat.

If no $50 row appears, the next step is a parent-visible diagnostic:
`evShadowDrift(kid)` (`js/40-stream.js:462-468`) already computes derived-vs-
stored per pot but has **no UI**, so it is unusable without a console.

---

## 11 · PR #90 audit — the two partials and the three weak tests

**Partial 1 — "the Flow owns no arithmetic" is overstated.**
`js/42-flow.js:125` sums `saved` itself:
`FL_SAVED_DESTS.reduce((s, k) => s + money2(flow.dests[k] || 0), 0)`.
`js/40-stream.js` exposes no saved total, so the third clause of the headline
sentence is a money figure with no pure-function owner and no unit test.
**Related:** `outTotal` deliberately excludes home→home allocations
(`js/40-stream.js:188-198`) but `flDestRows` draws `ready`/`locked`/`invest`
ribbons anyway (`js/42-flow.js:164-168`), so the caption
`➡️ Where it went <b>${outTotal}</b>` (`:246`) is **smaller than the ribbons
printed beneath it** — on the one screen that asks a child to compare group
totals.

**Partial 2 — rule 4's denominator is not `mrWeeksElapsed()` alone.**
`js/18-rules.js:1873`: `const weeksCounted = Math.max(elapsed, weeks.length, 1);`
True in normal operation, but the settled-week count still becomes the
denominator whenever it is larger. A defensive max, not the promise as written.

**Three tests that would not fail if the promise broke:**
- `theFourHouseRulesHold`'s **rule-4 branch** (`tests/smoke.js:5666-5676`) only
  type-checks. Revert `mrYearToDate` to `paidTotal / weeks.length` and it still
  passes — the one rule whose defect was "every week reads as a good one".
- `theFlowSaysWhereItWent`'s order assertion (`:5729-5733`) compares word order
  **inside** `.fl-story`. Move `.fl-story` below the bars and it still passes; it
  never asserts the screen's reading order, which is the actual promise.
- Stale naming from the retired word budget, including a live check still named
  for it: `checks.theUndoToastIsOutsideTheWordBudget` (`:11911-11916`), plus
  comments at `:4632, 4737, 8026, 9194, 14932`.

**Delivered and verified** (do not re-litigate): the Flow leads with the sentence
not a total; "left" is a balance; per-group scaling; three periods over elapsed
months; empty months kept; `screen-moneystory` in `KID_SCREENS`; the word budget
gone with the 44px/13px floors intact; the meeting a `.mm-screen` with
`mmIsOpen`/`mmShow`/`mmHide` the only idiom and **zero** stray readers; five
steps → three with ids and legacy translation; the money footer as the commit,
offering the other child via one `mnyCommitRefusal` owner; all four house rules
resolved through `mrRulesForWeek`; `money.test.js:171-172` asserting 51% as an
equality, not a widened band.

---

## 12 · Suggested order for the new chat

1. **The rewrite-vs-repair comparison** (§1) — governance requires it before any
   further money patch. Focus it on the three key-spaces.
2. **§7 + D3** — the live-rules regression and its migration. This is the one
   that is actively telling the girls the wrong rules.
3. **§3** — the no-loan stage-0 decision, then the two `invest →` bugs.
4. **§2** — the editable category table, then Dance → skating star level.
5. **§6** — gift date bugs, then a kid's edit proposal.
6. **§9** — a kid proposing a meet.
7. **§11** — the two partials and the three weak tests.
8. **§5** — retire `wallet.savings` / `wallet.gics` / `wallet.holdings`.

## Reference

- Repo `lxyzh1019-cyber/Weekly-Planner`, default branch `main`.
- Read `CLAUDE.md` (global rules, v2.1) **and** `ARCHITECTURE.md` (this repo's
  rules) at session start. Report the rules version and the branch.
- Merged: PR #89 (Stages 1–3), PR #90 (Stages 4–6). No open PRs at handoff time.
- Verification gate before any push: `npm ci && npm test` — check · merge ·
  buffers · stream · cleanup · xp · money · smoke. Bump `SW_VERSION` (`sw.js:29`)
  on any shell-file change.
- `js/04-merge.js` is **frozen**: changes need a demonstrated sync bug and a
  failing test written first.
- Every `state.shared` key needs a merge decision (`tests/check-shared-merge.js`).
- Routing: plan in the main session, delegate implementation to `opus-worker`.
- The non-money work (school-day offer, profile badges, watch-a-sister-compete)
  is planned separately on branch `claude/inspiring-gauss-232zww` — do not
  duplicate it.
