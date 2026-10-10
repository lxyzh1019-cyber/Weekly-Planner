# Plan v1 (Rev 1) — One page header for every screen — Awaiting approval

```diff
! Rev 1 (2026-10-06, after flow / logic / repeat checks):
- "Back buttons have no aria-label": wrong. applyIconButtonAriaLabels (js/99-main.js:270) names ◀ "Back" at runtime. Kept only as: name says where it goes.
+ §2a Owner-approved sizes kept: My money 72px one row / 54px buttons; meeting two rows 106px (BUILD-SPEC.md). They become header variants, not exceptions.
+ §2b One back/nav rule (flow check). Chore drops its hard-coded goWeek back.
! Money's profile badge is now an owner question (Q1), not a given.
+ Phone rule from the owner: two rows max, or one row of icons only.
```

**Written:** 2026-10-06, from a review of `main` @ `8ef4eeb`.
**Save as:** `docs/handoff/header-system.md`.
**Status:** NOT STARTED. The session presents this as its own "Plan vN" and waits for approval before any edit.

## 0. Governance (not optional)
1. Read `CLAUDE.md` and `ARCHITECTURE.md`. Report the rules version and the branch.
2. Plan mode first. All source edits go to the `opus-worker` subagent.
3. Before any push, `npm test` passes all suites.
4. End each stage with a regression table against `FEATURES.md`, and update `WORKING_RECORD.md`.
5. Bump `SW_VERSION` (sw.js) and `APP_BUILD` (js/01-config.js) together on every stage.
6. Main target is iPad Pro 11″ landscape (1194 × 834). Also check 390 × 844. Check both looks (Pop and Calm).
7. Keep the shared-values check (`check-look-tokens.js`) passing. No typed-in colours or fonts.

## 1. Problem (measured)
There are **9 different page-header patterns**, each with its own height, rule line, title size, back button and date style.

| # | Pattern | Where | Differs by |
|---|---|---|---|
| 1 | `.topbar` | Today, Chore, Sister Sync, Monthly, Print (index.html) | sticky; 3px **dashed** paper-line rule; h2 1.84rem; badge on the right |
| 2 | `.week-topbar` | Week | profile badge on the **left** of the title |
| 3 | `.day-topbar` | Day | no visible title (`#dayTitle` visually-hidden); "◀ Week" text back button |
| 4 | `.mny-head` / `--big` | My money, Money school (`mnyPageHead`) | not sticky; 3px **solid ink** rule; 72px tall; own `.mny-back` (40px); **no profile badge**; script-font date |
| 5 | `.mm-head--two` | Family meeting | 2 rows; `.mm-title` printed and then hidden with `:has()` |
| 6 | `.ck-head` | Kid chores (inside Chore screen) | cream band **under** the `.topbar`, so this screen has two headers; week label 11.5px; nav buttons 36px |
| 7 | `.cp-head` / `.ctr-head` | Parent chores, trends | rounded bordered **card** used as a header |
| 8 | `.gu-head` | Grown-ups pages | title + script strap on one line, nowrap |
| 9 | `.parent-bar` + `.parent-banner` | Parent portal; parent viewing Week/Day; Monthly | purple bar, plus a second purple strip on Week, Day and Monthly |

Other problems:
- Back buttons `◀` on lines 396, 561, 781, 821 get only a generic "Back" name at runtime (applyIconButtonAriaLabels), not where they go.
- Sister Sync is a bottom-nav tab but still has a back button (`goWeek()`). A tab destination needs no back button.
- Title style: "Sister Sync 👯" and "Weekly Chore 🧹" have emoji, "Today" and "My Week" don't; "💰 My money" puts the emoji first.
- Dates use 4 styles: centred text (Today), h3 stepper (Week/Day), script font on the right (Money), display font (parent).
- Floors broken: `.ck-weeklabel` 11.5px (13px floor), `.ck-navbtn` 36px and `.mny-back` 40px (44px floor).

## 2. Target: one header, two rows, fixed slots

```
Row 1 (app bar, always):  [◀ back?] [Title] ······ [context] ······ [actions ≤2] [profile badge]
Row 2 (sub-bar, optional): [tabs | stepper | kid switch]  — same style everywhere
```

| Slot | Rule |
|---|---|
| Back | Only on screens **not** in the bottom nav (Day, Chore, Monthly, Print, money sub-pages). 44×44, icon `◀`, aria-label "Back to <screen>". Always far left. |
| Title | One size and font token (`--hdr-title-size`, heading font). No emoji in titles; the nav icon already carries it. Always visible (Day shows "Day"). |
| Context | One slot: either today's date or a ◀ period ▶ stepper. Centred. Formatted by **one** helper (e.g. `hdrDateLabel()`). |
| Actions | At most 2 icon buttons, 44×44, with aria-labels (e.g. 📋 copy day, ? how this page works, 🖨 print). Extras go in ⋯ More. |
| Profile badge | Every kid screen, always far right. Parent screens: the parent menu takes this place. |
| Sub-bar | Week view tabs, money tabs, meeting stepper, chore kid/week, parent scope pills. One component, one style, inside the same sticky header. |

Shared visuals (new shared values in both looks):
- `--hdr-h` 64px (iPad) / 56px (phone); sub-bar 48px.
- Background `--paper`. One bottom rule, 2.5px solid ink (`--bw-rule`). Remove the dashed rule and the extra shadow.
- Sticky (`top: 0`) on every screen, row 1 and row 2 together.
- Parent mode: the same bar with a purple background (`--accent-purple`). It **replaces** `.parent-banner` on Week, Day and Monthly. "Viewing Jenn" plus the banner actions move into the sub-bar.

### 2a. Variants (sizes the owner already approved stay)
| Variant | Height | Used by | Source |
|---|---|---|---|
| `standard` | 64px iPad / 56px phone | Today, Week, Day, Chore, Sister Sync, Monthly, Print | new |
| `money` | 72px, 54px buttons, one row | My money, Money school, passbook pages | BUILD-SPEC.md "Header: one row, 72 px" |
| `meeting` | two rows, 106px, no bottom bar | Family meeting, all Sunday steps | BUILD-SPEC.md "Family meeting header" |
| `parent` | standard height, purple | Parent portal, parent viewing a kid screen | Plan v9 §N |

The variants share the slot order, fonts, rule line, sticky behaviour, button style and date helper. Only height and button size differ.

Phone (owner, final-page answer 3/5): every header is two rows at most, or one row of icons only. No full descriptions.

### 2b. Back and bottom-nav rule (flow check)
- A screen with the bottom nav has **no back button**: Today, Week, Sister Sync. Remove Sister Sync's ◀.
- A screen without the bottom nav has **◀ back to where she came from**: Money, Money school, Meeting, Day, Chore, Monthly, Print. Today these are hard-coded: Money → Today (`backtoday`), Chore and Sync → Week (`goWeek`), and Money school uses `mnySchoolReturn`. Generalise `mnySchoolReturn` into one `navReturn` stack, used by every back button.
- Chore is reached from ⋯ More on any tab, but shows both the bottom nav and a ◀ to Week. Pick one: take it out of `TD_NAV_SCREENS` and keep ◀ back (recommended, because Chore is not a tab).

### Owner decisions (2026-10-06)
- **Q1 — yes:** the profile badge appears on the money pages too, as the avatar only (44×44) at the far right. At 390px the date is hidden to make room.
- **Q2 — yes:** screen titles have no emoji.

Out of scope: section headings inside cards (`pn-group-head`, `sd-panel-head`, `sd-box-head` and the like), print output, the profile picker, layout below the header, features and data.

## 3. Stages (one PR each)

**Stage 1 — Build the component. No visible change.**
- Add `js/47-header.js` (classic script, loaded before 99-main.js; follow the load-order rule in ARCHITECTURE.md). It exports `pageHeader({ back, title, context, actions, badge, sub })`, which returns markup using `.ph-*` classes.
- Add the `.ph-*` CSS and the `--hdr-*` shared values for both looks.
- Add unit and smoke tests that render each slot combination.
- *Done when:* `npm test` passes and no screen changes.

**Stage 2 — Kid tab screens: Today, Week, Money, Sister Sync.**
- Replace `.topbar`, `.week-topbar` and `mnyPageHead` heads with `pageHeader`.
- Move Week's badge to the right. Remove Sister Sync's back button (§2b). Apply Q1 to Money. Money uses the `money` variant; its tabs and the parent kid switch stay in its one row, as approved.
- Add the `navReturn` stack (§2b) and route Money's ◀ through it.
- *Done when:* the 4 headers have the same height and the same baseline at 1194 and 390 in Pop and Calm; "Sister Sync" fits on one line at 375px; smoke screenshots are attached to the PR (before and after).

**Stage 3 — Kid inner screens: Day, Chore, Meeting, Money school, Print.**
- Day gets a visible title. Chore's two headers become one (week nav goes into the sub-bar; `.ck-weeklabel` ≥ 13px; nav buttons 44px). Chore leaves `TD_NAV_SCREENS` and its ◀ uses `navReturn`. The meeting uses the `meeting` variant (106px, as approved); delete the hidden `.mm-title`.
- Every back button's aria-label names its destination ("Back to Today").
- *Done when:* the same checks as Stage 2 pass, and no screen has two header bands.

**Stage 4 — Parent portal.**
- `.parent-bar` becomes `pageHeader` in parent variant. `.parent-banner` is removed from Week, Day and Monthly; its actions move into the sub-bar. `.cp-head`, `.ctr-head` and `.gu-head` page titles use the sub-bar or title slot (card styling removed).
- *Done when:* every parent destination has one purple bar, parent-to-kid-view keeps the Back and Confirm/Mark reviewed actions, and the Reading size (`--fs-scale`) still scales the header.

**Stage 5 — Delete and guard.**
- Delete dead CSS: `.topbar*`, `.week-topbar*`, `.day-topbar*`, `.mny-head*`, `.mm-head*`, `.ck-head*`, `.parent-banner*` (`check-dead-css.js` confirms).
- Add `tests/check-headers.js` to `npm run check`. It fails when a `.screen` lacks exactly one `.ph` header, when a header button is under 44px or has no accessible name, or when header text is under 15px.
- Add a "Page header" section to `FEATURES.md`.
- *Done when:* `npm test` passes, the guard fails on a planted second header, and the owner reads the new build on the iPad.

## 4. Risks
- Sticky two-row header costs height on the Day timeline. Keep the sub-bar off Day unless the span tabs move into it.
- Calm's wider fonts: check titles and sub-bar tabs at 375px in both looks.
- `check-dead-actions.js` cannot see generated `data-*` actions. Re-check every header action by hand.
- Parent banner actions (Confirm all / Mark reviewed) are money-critical. Run the regression rows for them explicitly.
