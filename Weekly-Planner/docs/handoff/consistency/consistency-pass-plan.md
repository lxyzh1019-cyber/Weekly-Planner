# Plan v1 — Whole-app consistency pass — Awaiting approval

**Written:** 2026-10-06 from a code review of `main` @ `8ef4eeb` (47 JS files, 2.3 MB; `css/app.css` 9,710 lines; 13 screens).
**Save as:** `docs/handoff/consistency-pass.md`. Stage B's detail is in `docs/handoff/header-system.md`.
**Status:** NOT STARTED. Present this as "Plan vN" and wait for approval.

## 0. Governance
Same as `header-system.md` §0: read CLAUDE.md and ARCHITECTURE.md; plan mode; all source edits through `opus-worker`; `npm test` green before any push; regression table against FEATURES.md; update WORKING_RECORD.md; bump SW_VERSION and APP_BUILD together; check iPad 1194×834 and phone 390×844 in both looks. **No change to money, XP, merge or data rules.** This is a presentation pass.

## 1. Verdict
No rewrite. The logic layer (merge, money, Sunday, tests, CI) is solid. The **presentation layer was built in ~10 rounds, and each round brought its own components**. The fix is to consolidate into one small component set, one surface at a time.

## 2. Findings (measured; ✗ Broken · △ Inconsistent · ○ Debt)

### A. Data and safety (outside this pass, listed so it is not forgotten)
- ✗ **A1** No Firebase Auth; one global doc `weekly_planner/shared_state` (js/03-sync.js:18-19). Parent PIN defaults to `'1234'` and lives in the synced doc (js/02-state.js:17, js/05-helpers.js:1444), so anyone who can read the doc can read the PIN. SECURITY_TODO.md runbook is still not started. **Owner decision needed before any public link is shared.**

### B. Page headers: see header-system.md
- ✗ 9 header patterns; ✗ double header bands on Chore and parent-viewing; △ back/nav rules.

### C. Components: same job, many versions
| What | Versions found | Target |
|---|---|---|
| Buttons | **72** button classes (`.btn-icon`, `.pill-btn`, `.mny-btn`, `.gu-btn`, `.ck-btn`, `.rc-btn`, `.bk-btn`, `.td-*-btn`, …) | 4: primary · secondary · icon · danger (+ size `lg` for money 54/66px) |
| Chips/pills | **51** classes | 1 chip (on/off), 1 status pill |
| Tabs | **11** tab systems (`view-tab`, `day-span-tab`, `parent-tab`, `mny-tab`, `ck-tab`, `cp-tab`, `ctr-tab`, `gu-tab`, `refl-tab`, `copy-day-tab`, `mv2-idea-tab`) | 1 segmented tab, used in the header sub-bar and inside cards |
| Cards | **25** card classes | 1 card + 1 section head (title · note · figure) |
| Sheets/pop-ups | **13** styles (`.sheet`, `.gu-sheet`, `.rq-sheet`, `.sd-sheet`, `.td-more-sheet`, `.app-dialog-sheet`, `.quest-popup`, `.pn-told-sheet`, …), 27 overlays | 1 sheet (bottom on phone, centred on iPad) + 1 dialog |
| Kid switchers | `parent-scope`, `mny-head-kids`, `cp-kid`, `refl-kids`, `answer-kids`, `sd` avatars | 1 kid switch (avatar pills) |
| Week / day steppers | `.week-nav`, `.ck-weeknav`, `.ct-weeknav`, `.day-nav-center`, meeting week label | 1 ◀ period ▶ stepper |

### D. Words, numbers and dates
- ✗ **D1 Money prints 3 ways.** `mnyMoney` gives "$3.00", while `rqDollars`, `guMoney$`, `ckMoney`, `sdWhole$` and `sdD` give "$3". `mnyMoney(-3)` gives **"$-3.00"**, but `sdMoney` gives "−$3.00". **18 formatters** in total. Target: one `fmtMoney(v, {whole, signed})` in js/05-helpers.js; delete the others.
- △ **D2 Dates**: `mnyDayLabel` uses toLocaleDateString ("Sat, Oct 3"), `mnyDayName` is hand-built ("Sat 3 Oct"), Today uses a long locale date, and `guDayName` gives weekday only. Target: `fmtDay(key, 'short'|'long'|'weekday')`.
- ○ **D3 Kid name** is defined 4 times (`kidLabel`, `mnyKidName`, `pcwKidName`, `cfKidName`). Keep `kidLabel`.
- △ **D4 Emoji in headings**: 54 headings, with the emoji placed first, last or alone. Rule: section headings may have one leading emoji; screen titles have none (Q2).

### E. Visual tokens
- △ **E1** 56 different border-radius values and 71 different shadows. Target: radius 8/12/16/pill; shadow sm/md/lg (hard offset) per look.
- △ **E2** 26 breakpoints (380 … 1150). Target: 3: `≤699` phone, `700–1099` small tablet, `≥1100` iPad landscape.
- △ **E3** 30 z-index values (0 → 9999). Target: named layers: base · sticky header 100 · nav 200 · sheet 500 · dialog 600 · toast 700.
- ○ **E4** 391 hex colours still typed into CSS (the look plan's L11 check allowlists them). Burn the list down per stage.
- ✗ **E5** Text below the 13px floor: 38 px declarations plus ~95 rem declarations under 0.8125rem with no `max()` floor (leads; verify each). Known: `.ck-weeklabel` 11.5px. 17 font sizes ignore `--text-scale`, so the Reading-size setting misses them.

### F. Flow
- ✓ **F1 withdrawn:** owner confirmed the Print button no longer previews, so there is no duplication (D3).
- △ **F2** Profile screen still carries the long manifesto (index.html:96-105) under the three cards, flagged in AUDIT-PRODUCT P2. Move it to a "How this planner works" sheet.
- △ **F3** Back buttons are hard-coded (see header-system.md §2b).
- ○ **F4** Sister Sync builds its section headings with inline styles (index.html:576-590), unlike every other screen.

### G. Code debt that causes the drift
- ○ **G1** 85 inline `style=` in index.html and 179 in generated markup; 141 + 83 inline `onclick` beside 12 different `data-*-action` systems.
- ○ **G2** 7 functions defined but never called: `setParentKid`, `mmRenderQuarterly`, `loanPayExtraPrompt`, `mnyWithdrawRequest`, `mrCompetitionBlock`, `moneyCanTransact`, `mnyConfirmStamp` (each name appears once in the codebase).
- ○ **G3** 335 "gone / retired / long gone / kept for" comments. History belongs in WORKING_RECORD.md, not in source.
- ○ **G4** 10 `setInterval` vs 18 `clearInterval`; check the stopwatch timers in js/08 and js/09 clear on screen change.

## 3. Execution plan (one PR per stage, in order)

**Stage A — Component kit. No visible change.**
`js/05-helpers.js`: `fmtMoney`, `fmtDay`, `kidLabel` as the one source. CSS: `--radius-*`, `--shadow-*`, `--z-*`, the 3 breakpoints, `.ui-btn`, `.ui-chip`, `.ui-tabs`, `.ui-card`, `.ui-sect-head`, `.ui-sheet`, `.ui-kids`, `.ui-stepper` for both looks. Unit tests for `fmtMoney`: negatives, whole, cents.
*Done when:* tests pass and screenshots are unchanged.

**Stage B — Headers.** header-system.md Stages 1–5 (Q1/Q2 decided).

**Stage C — Words and numbers.** Swap every money, date and kid-name call to the Stage A helpers; delete the 17 duplicate money formatters and 3 duplicate kid-name helpers. Fix `$-3.00`. Owner picks one money style: **"$3.00 always" or "$3, $2.50"** (owner question C-Q1).
*Done when:* `check-money-words.js` is extended to fail on a new local formatter; money tests pass; one Sunday run matches the pre-change totals.

**Stage D — Components, by surface** (one PR each, in usage order): Today → Week/Day → Money and Sunday → Chores → Parent portal → sheets and dialogs. Each PR moves that surface to `.ui-*`, deletes its private button, tab, card and sheet classes, and moves its inline styles into CSS.
*Done when, per PR:* `check-dead-css.js` shows the old classes gone; 44px and 13/15px floors hold; screenshots before and after in both looks.

**Stage E — Flow cleanups.** F1: remove the duplicate Print door (owner picks which, C-Q2). F2: manifesto into a sheet. F4: Sister Sync headings onto `.ui-sect-head`. G2: delete the 7 unused functions. G4: timer audit.

**Stage F — Guards.** Extend the checks so the drift cannot return: fail on a new `*-btn`, `*-tab`, `*-sheet` or `*-card` class outside `.ui-*` (allowlist with reasons); fail on font-size without a floor or scale; fail on a z-index or breakpoint not in the token list; fail on a new money or date formatter.
*Done when:* each guard fails on a planted example.

**Stage G (separate track, owner decision) — Security runbook** (SECURITY_TODO.md steps 1–7). Not a design task.

## 4. Owner decisions (2026-10-06)
- **C-Q1:** "$3" for whole dollars, "$2.50" otherwise, everywhere. `fmtMoney` defaults to this; `mnyMoney` ("$3.00") is retired.
- **C-Q2:** keep both. The Print button no longer previews (owner).
- **C-Q3:** security track after this pass.

## 4b. Found by the full checks (2026-10-06, round 2)
- **Hotspot rule:** profile badge has 2 fix rounds, so Stage B is round 3 and needs the rewrite-vs-repair comparison before any badge edit. Pocket money has 7+ rounds and the money re-check brief is another one, so it needs the same.
- **Chores screen retirement (C3, ledger #42) is still pending.** Stage B/D must not restyle `#screen-chore` until the owner decides C3. If it retires, its double header goes with it.
- **Nothing since build 2026-10-05d is confirmed on the iPad.** No stage starts until the owner reads the current build.
- **Open Q7 (parent Reading size default 1 vs 1.2)** is still open. Fold it into Stage B's parent header.
- **Stale money-week code:** 15-meeting.js:1008 says Sun–Sat from 11 Oct, which decision 15 withdrew. The Sun–Sat mapping (18-rules.js:117-122, 1274-1400) is kept "for the record". Delete it in Stage E, after the money re-check PR merges.

## 5. Risks
- Stage D touches every screen. Keep each PR to one surface and run the FEATURES.md regression rows for that surface.
- Money formatting (Stage C) is visible on signed Sundays. Frozen weeks render from stored numbers, so only the display changes. Confirm with `sunday.test.js`.
- Look plan (Pop/Calm) values must exist for every new token.
