# Handoff — PR C: My money built around the cash pool

**Written:** 2026-09-22, at the end of the session that shipped PR #92 (money PR A, PR B, B5–B10).
**Status:** NOT STARTED. It is **blocked on the owner signing off the pool picture** from Claude Design.
**Start from:** `main` after #92 is merged. This file, `docs/design/cash-pool-brief.md` and
`WORKING_RECORD.md` (request ledger rows 13, 14, 17, 28–31, 34–42) are the sources.

---

## 1. Read first (governance, not optional)

1. Read `CLAUDE.md` (global rules v2.1) and `ARCHITECTURE.md` (this repo's rules). Report the
   rules version and the branch.
2. **Work in plan mode.** Present a "Plan vN — Title — Awaiting approval", with later revisions marked
   in fenced `diff` blocks (`+` new, `!` changed, `-` removed) and a Rev-N label. The owner does
   not want `<span>` colours.
3. If Fable is unavailable, Opus plans and checks. **All source edits go to the `opus-worker`
   subagent.** The main session edits only plans and records.
4. For every defect, write a failing test first. Before any push, `npm test` must pass all eight suites
   (check · merge · buffers · stream · cleanup · xp · money · smoke).
5. End with a regression table against `FEATURES.md` (money section). Update `WORKING_RECORD.md`.
   Bump `SW_VERSION` (sw.js) and `APP_BUILD` (js/01-config.js) together. Only call it "deployed"
   after reading the build stamp on the live page.
6. The main interface is **iPad Pro 11″ landscape, 1194 × 834**. The phone shows the same pages
   stacked.

## 2. What the owner wants, in their words

- "It is a pool: income is the inlet, the mortgage is the outlet, investment is a loop back in
  the pool (dashed line)."
- "My money currently has too many tiles … chore tile as pop up, same for the what paying it
  opens, saving goal. The core is earn, spending, invest, cash."
- "Everything I have with the small tiles is clearer and easier to follow." The owner rejected the
  "Where it is now" table.
- On totals: "by the end total what I mean is adding all the categories together — which is not
  my goal." **Never show a summed grand total.**
- On the competition calendar and gifts: "both". They stay as cards AND open from the pool's
  inlet.
- On fines: a thin stream **flowing out** of the pool (confirmed 2026-09-22).
- "Do not mix those two": the cash pool and the target card stay separate on My money.

## 3. Approved scope

| Item | What |
|---|---|
| **C1** | **💧 My cash pool**, the hero of My money. See below the table. |
| **C2** | **My money = earn · spend · invest · cash.** See below the table. |
| **C3** | **Today's money card:** the week's flow and the weekly target. No grand total and no sparkline. |
| **C4** | **One target card with a week/month toggle.** See below the table. |
| **C5** | **Small fixes on the same pages.** See below the table. |
| **C6** | **"What I have and what I owe" line chart** on 📖 My money story. See below the table. |
| **C7** | **Paired came-in / went-out columns per month** on the story. Empty months stay dashed. |
| **C8** | **The Claude Design brief**, `docs/design/cash-pool-brief.md`. Done; the owner takes it to Claude Design. |

**C1 — 💧 My cash pool**
- **Inlet**, one labelled stream each, tappable: jobs, routine streak, competitions, gifts.
- **Pool**: her cash.
- **Outlet**: loan payment, spending, and fines as a thin stream.
- **Dashed loop**: cash to Kept ready / Locked away / In companies, and back.
- Under the pool, **four small pot tiles**: Cash · Kept ready · Locked away · In companies. A locked tile shows what opens it.
- "Ask to move some" stays.
- There is a week/month switch, and it opens on the week.

**C2 — My money = earn · spend · invest · cash**
- On iPad, at most **six cards**:
  - the pool with its tiles;
  - the target card;
  - 🏆 competition calendar;
  - 🎁 gifts;
  - the loan;
  - spending.
- **Pop-ups**, each reusing an existing card:
  - 💷 what things pay, from the inlet's "jobs";
  - 🔓 what paying it opens, from the loan;
  - 🎯 saving goal, from the Cash tile;
  - the competition calendar and gifts, also from the inlet;
  - Money school ideas, from the pot they explain.

**C4 — the target card**
- It is on Today and on My money.
- It opens on the **week** every time; the choice is never stored.
- Once this week's earnings reach the weekly target, it opens on the month and says why.
- There is one stored figure, the annual target: weekly = ÷52 and monthly = ÷12.
- **On Today**, the toggle sits on top and drives came in / went out / put away AND the target, all from `evFlow` for that period.
- **On My money**, the target card is separate from the pool.

**C5 — small fixes**
- The stock-risk sentence no longer contradicts its chart.
- A locked 📈 idea hides its chart.
- The "Open a stage early" chips show when a change is pending.
- Money school's three columns end level on iPad. The price list is split across the middle and right columns.

**C6 — the line chart**
- Two lines on one $ axis, one point per month, with empty months kept:
  - "have" = cash + kept ready + locked away + in companies, from `evBalanceOf` at each month end;
  - "owe" = principal still owed at each month end.
- Colours: green `#2f855a` for have, violet `#6b5bb5` for owe; never red. The palette is validated (CVD ΔE 16.8).
- 2 px lines with dots, end labels plus a legend, tap a month for its figures, and a "Show the numbers" table fold.
- Actual figures only; nothing projected.

## 4. Where the design stands

- **Brief:** `docs/design/cash-pool-brief.md`, paste-ready for Claude Design. It fixes:
  - the flows, states and pop-up map;
  - the app's colours and fonts;
  - sample figures, marked illustrative;
  - the rule "no added-up total".
- **Sign-off:** the owner picks one Claude Design result. PR C builds that picture, and "matches the signed-off design" is an acceptance check. **Do not start building before sign-off.**
- **Old mockup canvas** (for reference only): https://claude.ai/artifact/3fYy6KiQMcSissRGBvnG6d
  - Still valid: the iPad boards "Today" (toggle on top drives the tiles) and "Story" (chart C6 and paired columns C7).
  - Retired: the "Zones" proposal board and the "Where it is now" table.

## 5. Code entry points

| What | Where |
|---|---|
| My money page, card order | `mnyRenderMyMoney` — js/22-money-page1.js |
| The current cards to rearrange or turn into pop-ups | js/22-money-page1.js (see list below) |
| Page head, tabs, pot-opening moment | `mnyPageHead`, `mnyStageOpenedCard` — js/22-money-page1.js; `mnyTabBar` — js/21-money-data.js |
| Story page (C6, C7) | `mnyRenderStory` — js/22-money-page1.js |
| Money school (ideas that become pop-ups; C5 column balance) | `mnyRenderSchool` — js/25-money-school.js |
| Today's money card (C3, C4) | `ctRenderMoneyCard` — js/13-chores.js; `tdMoneyParts`, `tdMoneyChart` — js/31-today.js |
| Period flows and balances (every figure comes from these) | `evFlowOf`, `evBalanceOf`, `evFlow`, `evBalance` — js/40-stream.js |
| Unlock gates and stages | `MNY_STAGES`, `mnyStagePct`, `mnyIsOpen` — js/21-money-data.js |
| Click wiring | `MNY_CLICK_HOSTS` + `mnyHandleClick`. Every rendered `data-mny-action` must sit under a host that handles it; a smoke check enforces this. |

The current cards in js/22-money-page1.js are:
- `mnyTodayCard`
- `mnyWalletCard`
- `mnyIncomeCard`
- `mnySavingGoalsCard`
- `mnyGoalCard`
- `mnyPricesCard`
- `mnyDebtCards`
- `mnyCompetitionCard`
- `mnyGiftsCard`
- `mnyLinksCard`

**Rules that bite here:**
- There is no new `state.shared` key without a merge decision; the pop-up state is UI-only.
- Escape everything with the helpers.
- The Flow's caption must equal its bars. PR A fixed exactly this defect; do not reintroduce it.
- Settling a week closes chores, routines, fines and the split. It never closes competitions or gifts (B6).

## 6. Acceptance checks

- It matches the signed-off Claude Design picture at 1194 × 834, and the phone stack is sane.
- Nowhere on My money is there an added-up total.
- The pool's inlet, outlet and loop figures equal `evFlowOf` for the period shown.
- Every inlet stream, pot tile and loan tile opens its pop-up.
- The competition calendar and gifts appear both as cards and from the inlet.
- My money has at most six cards on iPad.
- Weekly × 52 = monthly × 12 = the annual target.
- The target card opens on the week below target and on the month at or above it, and a tap is not remembered on the next open.
- On Today, came in / went out / put away change with the toggle and match `evFlow`.
- The chart's "have" point equals the stream balance at each month end, and "owe" equals principal minus payments credited by then.
- The click sweep (a smoke check) finds 0 throws as parent and as child.

## 7. First three things to do

1. Ask the owner for the signed-off Claude Design result: the link or file, and the one variant chosen.
2. Read `ARCHITECTURE.md`'s money sections and `FEATURES.md`'s money manifest. Then present
   **Plan v1 — PR C** with success criteria from section 6, awaiting approval.
3. On approval, delegate to `opus-worker` in two steps: first C3/C4 (Today + target card; no design
   dependency beyond the brief), then C1/C2/C5–C7 against the signed-off picture.
