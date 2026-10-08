# Plan v1 — Weekly Planner: money re-check + whole-app consistency — Awaiting approval

**Written:** 2026-10-06 against `main` (build 2026-10-06e; the only commits since add `.claude/agents` files).
**Save as:** `docs/handoff/app-consistency-v1.md`. Its source notes are `money-recheck-brief-rev1.md`, `header-system-plan.md` and `consistency-pass-plan.md`. Copy them into `docs/handoff/` alongside it.
**Status:** NOT STARTED. Present this as "Plan vN — Title — Awaiting approval" and wait.

## 0. Governance (every PR)
1. Read `CLAUDE.md` and `ARCHITECTURE.md`; report the rules version and the branch. Plan mode. All source edits go through `opus-worker`; the main session commits.
2. `npm test` passes all suites before any push. CI is green.
3. Bump `SW_VERSION` and `APP_BUILD` together. Call a PR "deployed" only after the owner reads the build on the iPad (Today → ⋯ More).
4. Regression table against `FEATURES.md`; update `WORKING_RECORD.md` (request ledger, hotspot counter).
5. Screens: iPad 1194×834 and phone 390×844, **Pop and Calm**. Smoke screenshots go to `tests/out/` (CI artifact) and are linked in the PR.
6. **Hotspot rule:** pocket money (7+ rounds) and profile badge (2 rounds) each need a short rewrite-vs-repair note in the PR before the first edit to that area.
7. Out of scope everywhere: money, XP and merge rules, stored data shapes, features. This is a correctness-and-presentation pass.

## 1. Owner decisions on record (2026-10-06)
| # | Decision |
|---|---|
| D1 | No full redesign. Fix the header, then consolidate components. |
| D2 | Money format: "$3" for whole dollars, "$2.50" otherwise, everywhere. Negatives "−$3". |
| D3 | Print: keep both the Print preview tab and the 🖨 Print button (they do different jobs). |
| D4 | Profile badge on every kid screen, money pages included (avatar only; date hides at ≤699px). |
| D5 | No emoji in screen titles. Section headings may lead with one emoji. |
| D6 | Money re-check first, as one PR. |
| D7 | Chores screen may be retired after the owner sees its snapshot (PR 2). |
| D8 | Security track after this pass. |

## 2. PRs, in order

### PR 1 — Money re-check (one PR)
Scope: `money-recheck-brief-rev1.md` in full (original fixes 1–6, plus Rev 1 changes 0, 1, 2, 3, 5 and 7).
- Commitment % from `sdCommitPlan` in **all three** places (46-grownups.js:537, 44-sunday.js:1301, :1323); no negative "Left for me to choose".
- `data-money-surface` on every money root. Both CSS lists (8389, 8398) become one selector, and the lists are deleted.
- Font smoke check finds screens by `[data-money-surface]` (Parent › Now included). The %-check fails on any division by steady outside js/43.
- Search box: fix the placeholder, not the hidden label.
- "This month" is the calendar month; empty state when nothing has landed.
- Two ✍️ Record doors get the same hint line.
- Stale Sun–Sat comment corrected.
*Done when:* every "Done when" in the brief passes; reverting fix 1 or 2 makes `npm run check` fail; the owner reads the build on the iPad.

### PR 2 — Chores screen snapshot, then retire (C3, ledger #42)
- **Step a (no code change):** smoke saves `#screen-chore` for Jenn, Jess and Parent at both sizes and in both looks, plus each row of `docs/chore-relocation-map.md` shown at its new home. Post the images in the PR. **Stop for the owner's per-row ✓.**
- **Step b (after ✓):** remove `#screen-chore`, `openChoreTab`, `#choreProfileBadge`, the 🧹 More tile and its refresh hooks. Port the 21 smoke checks to the new homes. `check-dead-css.js` and `check-dead-actions.js` stay green.
*Done when:* every relocation-map row has a passing check at its new home and nothing links to the old screen.

### PR 3 — Component kit (no visible change)
- Helpers in js/05-helpers.js: `fmtMoney(v, {signed})` (D2), `fmtDay(key, 'short'|'long'|'weekday')`, with `kidLabel` as the one name source. Unit tests: negative, whole, cents, rounding.
- CSS tokens for both looks: `--radius-sm/md/lg/pill`, `--shadow-sm/md/lg`, `--z-base/header/nav/sheet/dialog/toast`, `--hdr-*`. Breakpoints: ≤699, 700–1099, ≥1100.
- Classes: `.ui-btn` (primary, secondary, icon, danger; `lg` size for the money 54/66px), `.ui-chip`, `.ui-tabs`, `.ui-card`, `.ui-sect-head`, `.ui-sheet`, `.ui-kids`, `.ui-stepper`.
- `js/47-header.js`: `pageHeader({variant, back, title, context, actions, badge, sub})`, with variants `standard`, `money`, `meeting` and `parent` (header-system-plan.md §2–2b).
*Done when:* tests pass and screenshots are pixel-identical to `main`.

### PR 4 — Headers, kid screens
Today, Week, Day, Sister Sync, My money, Money school, All my Sundays, By month, the meeting, Print.
- One header per screen, with fixed slot order and the badge always at the far right (D4).
- Titles without emoji (D5).
- Back rule: no ◀ on bottom-nav tabs. Elsewhere ◀ uses one `navReturn` stack, so Money returns to where she came from.
- Day shows a visible title. The meeting keeps two rows and 106px; money keeps one row and 72px.
- Back labels name their destination.
*Done when:* every kid screen has exactly one header; the same height per variant at both sizes and in both looks; "Sister Sync" fits at 375px; 44px and 13/15px floors hold.

### PR 5 — Headers, parent portal
- `.parent-bar` becomes `pageHeader` (parent variant). The second purple `.parent-banner` is removed on Week, Day and Monthly; Back, Confirm all and Mark reviewed move into its sub-bar.
- Fix open Q7: the Reading size default is 1.2 when nothing is stored.
- `.cp-head`, `.ctr-head` and `.gu-head` lose the card-as-header styling.
*Done when:* one purple bar on every parent screen; regression rows for Confirm all and Mark reviewed pass; Reading size scales the header.

### PR 6 — Words and numbers
- Replace the 18 money formatters with `fmtMoney`. Fix "$-3.00". Replace the date and kid-name helpers.
- Delete the old functions.
- Extend `check-money-words.js` to fail on a new local money or date formatter.
*Done when:* one Sunday per girl shows the same totals as before, in the new format; `sunday.test.js` and `money.test.js` pass.

### PR 7–12 — Components, one surface per PR
Order: Today → Week/Day → Money and Sunday → Parent portal → Sister Sync and Profile → all sheets and dialogs.
Each PR:
- moves that surface to the `.ui-*` set and deletes its private button, tab, card and sheet classes;
- moves its inline `style=` into CSS;
- removes its emoji-titled headings per D5.

Also in these PRs:
- Sister Sync's inline-styled headings (index.html:576-590) use `.ui-sect-head`.
- The profile screen's long message moves into a "How this planner works" sheet.
*Done when, per PR:* the old classes are gone (`check-dead-css.js`); the floors hold; before and after screenshots in both looks.

### PR 13 — Clean-up and guards
- Delete the 7 unused functions: `setParentKid`, `mmRenderQuarterly`, `loanPayExtraPrompt`, `mnyWithdrawRequest`, `mrCompetitionBlock`, `moneyCanTransact`, `mnyConfirmStamp`. Re-grep first, including string-dispatched calls.
- Delete the unused Sun–Sat money-week mapping (18-rules.js) and its tests, per decision 15.
- Timer audit: every `setInterval` in js/08, js/09 and js/44 is cleared on screen change or close.
- Move history comments ("gone", "retired", "long gone") into `WORKING_RECORD.md`.
- Guards in `npm run check`, each with an allowlist and a reason per entry. They fail on:
  - more than one header per `.screen`;
  - a new `*-btn`, `*-tab`, `*-card` or `*-sheet` class outside `.ui-*`;
  - a font size with no floor or no `--text-scale`;
  - a z-index or breakpoint outside the tokens;
  - a hand-kept screen list in CSS (selectors with 4 or more ids or roots).
- Update `FEATURES.md`: Page header, Component kit, Money format.
*Done when:* each guard fails on a planted example; `npm test` passes; the owner reads the build on the iPad.

### Track S — Security (after PR 13, D8)
Follow `SECURITY_TODO.md` runbook steps 1–7: backup, read the live rules, Firebase Auth, move the doc, point the client, publish the rules, delete the old doc. Its own plan and PRs; not a design task.

## 3. Sizing and stops
- PR 1: one session. PR 2: two short sessions, with the owner's check between them. PRs 3–6: one session each. PRs 7–12: one session each. PR 13: one session.
- **Stop points for the owner:** after PR 1 (iPad read), PR 2a (Chores snapshot ✓), PR 4 (headers on the iPad in both looks), PR 6 (one Sunday per girl), PR 13.

## 4. Risks
- PRs 7–12 touch every screen. Keep one surface per PR, and run that surface's `FEATURES.md` rows.
- The two looks double the visual checks. The guards cover tokens; layout still needs the iPad.
- Money display changes in PR 6 show on signed Sundays. Stored numbers don't change.
- Retiring Chores (PR 2b) removes a door the girls may use. The owner's ✓ per row is the gate.
- Any money branch opened during this plan rebases onto whichever PR lands first.
