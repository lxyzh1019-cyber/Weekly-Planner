# Plan v6 — Two looks: Pop (style B, handwriting) and Calm (new) — Awaiting approval

**Written:** 2026-09-27, in a claude.ai chat, against `main` @ `72fd6eb` (PR #100 merged, build `2026-09-26b`).
**Status:** NOT STARTED.
- The owner approved the scope and all decisions below in chat.
- The session presents this as its own "Plan vN" and waits for approval before any edit.
- **Replaces v2–v5.** Discard any plan a session built from an earlier version. That includes any plan with three looks (Classic, Calm, Pop).

**Save as:** `docs/handoff/looks-calm-pop.md`.

## What changed since v5 (Rev 5)

```diff
+ Pop text is 10% larger than today's, on every Pop screen (owner: the handwriting is hard for
+   him to follow; the kids like it). It is one Pop value, a text scale of 1.1, so it can be tuned
+   later in one place.
+ Found while checking that change: the Full week grid decides which labels fit using a
+   hand-measured glyph-width table (wfTextPx and WF_TRAVEL_TEXT_MIN_PX in js/07-week-view.js).
+   The table is measured for Patrick Hand at 13.1px, and its own comment says a type change
+   invalidates it. Pop's larger text and Calm's new fonts both change the type, so the table must
+   follow the look (new in Stages 2 and 3). v2–v5 missed this.
```

## What changed since v4 (Rev 4)

Earlier revisions were owner decisions and appear below without marks.

```diff
! Pop = the "B" mockup's style with today's handwriting fonts (owner, 2026-09-27).
!   It supersedes v3/v4's "Pop = today's look refined".
!   Kept from today: Gochi Hand and Patrick Hand.
!   New: cream graph-grid paper, navy ink, a Now card filled with its category colour, list rows
!   filled with the category tint, yellow main buttons, brighter category and kid colours.
! Calm borders are navy 3D sticker outlines at today's widths and shadows ("similar 3d border
!   like the current theme"). This replaces v4's soft-slate borders, which lost contrast (~2:1).
! L3: both looks draw real borders at today's widths, so box geometry is identical.
!   Shadows may differ, because a shadow does not move layout.
! L9: "today" markers are navy in both looks (both inks are now navy).
- Dropped: v3's Now-card outline tweak (3.5px → 3px), which had no benefit to the children.
! Stage 2 is now "Restyle Pop" and is a visible change for the kids.
```

---

## 1. Read first (governance, not optional)

1. Read `CLAUDE.md` (global rules v2.1) and `ARCHITECTURE.md`. Report the rules version and the branch.
2. **Work in plan mode.** Present "Plan vN — Title — Awaiting approval". Mark later revisions in fenced `diff` blocks (`+` new, `!` changed, `-` removed) with a Rev-N label. The owner does not want `<span>` colours.
3. If Fable is unavailable, Opus plans and checks. **All source edits go to the `opus-worker` subagent.**
4. Before any push, `npm test` must pass all eight suites: check · merge · buffers · stream · cleanup · xp · money · smoke.
5. End every stage with a regression table against `FEATURES.md`. Update `WORKING_RECORD.md`, adding a new round and the ledger rows in §3.
6. Bump `SW_VERSION` (sw.js) and `APP_BUILD` (js/01-config.js) together on every stage. Only call a stage "deployed" after reading the build number on the iPad (Today → ⋯ More).
7. The main interface is **iPad Pro 11″ landscape, 1194 × 834**. The phone shows the same pages stacked.

## 2. What the owner wants, in their words

- "Redesign [the Weekly Planner] in similar or better a brighter look", with the Sunday payday v6 mockup as the reference.
- Scope: "Whole app (kid, parent, print)".
- "I like both … relaxing for B and calm for A. I need both."
- "Can it be a toggle function to switch at any time?" The parent portal gets **its own switch**.
- The kids especially like "current handwriting style". Money colours stay as the original.
- Which money colour set becomes the one set: "this will be addressed in the upcoming redesign money system." Calm uses the same money colours as Pop.
- Calm: "add the border to make it easier to follow" … "similar 3d border like the current theme".
- Pop: "Style B with the font in handwriting."

## 3. Approved scope (ledger rows for the new round)

| Row | What |
|---|---|
| L1 | **Two looks.** **Pop** is style B with today's handwriting fonts. **Calm** is new. Both cover every kid screen, the parent portal, sheets and pop-ups. |
| L2 | **One set of shared values.** Every colour, font, outline and shadow reads from it. The two looks differ only in the values, never in separate copies of the styling. |
| L3 | **Switching keeps box geometry.** Both looks draw real borders at today's widths (§7) with the same spacing. Shadows may differ. Text width can differ, because the fonts differ, so every screen must fit in both looks. |
| L4 | **Kid toggle: a 🎨 tile in the ⋯ More sheet,** beside 🧹 Chores and ◀ Switch, flipping Pop ↔ Calm. It is remembered **per kid, per device**, in `localStorage` (never synced state). Jenn's choice does not change Jess's. |
| L5 | **Parent toggle: a button in the portal header,** beside 🔒 PIN and Exit, flipping Pop ↔ Calm. It shows on every portal destination and is remembered separately on the device. |
| L6 | **Default is Pop,** for kids and parent. The profile picker uses the look this device used last, else Pop. |
| L7 | **Fonts.** Pop keeps today's fonts: Gochi Hand headings, Patrick Hand text, and today's fallbacks, **at 10% larger than today** (a Pop text scale of 1.1; Rev 5). Calm uses Baloo 2 headings and Lexend text and numbers at today's sizes. The parent portal's existing Reading size (Standard / Larger / Largest) still multiplies on top. |
| L8 | **Brighter category and kid colours in both looks,** same hues. |
| L9 | **"Today" markers are navy in both looks,** not the kid colour. The kid colour stays on the avatar, the selected kid pill and the XP bar. |
| L10 | **Money colours move onto shared values, unchanged.** Both looks use today's money colours exactly as each page has them now. No unifying happens here; the money redesign picks the one set by changing values, not code. |
| L11 | **A check that keeps it this way.** It fails when a colour or font is typed in anywhere except the shared value set, or when either look is missing a value. |
| L12 | **Print ignores the look.** It stays as it prints today. |
| L13 | **Layout, features and data do not change.** This is a look change only. |
| L14 | **Stage 1 lands before any pocket-money layout work.** No money branch is open at `72fd6eb`. |
| L15 | **The week grid's label fitting follows the look** (Rev 5). `wfTextPx` and `WF_TRAVEL_TEXT_MIN_PX` hold glyph widths measured for Patrick Hand at 13.1px. They must give correct widths for Pop at its larger size and for Calm's fonts. Preferred structural option: measure the text in the active font rather than keep a hand table per look. `theStripStillSaysWhenToLeave` holds it in both looks. |

## 4. Where things stand today (measured at `72fd6eb`)

- `css/app.css`: **477** typed-in colours and **151** font declarations, alongside the existing shared values.
- `js/*.js`: **156** typed-in colours and **151** inline `style="…"` in generated markup.
- `index.html`: **87** inline `style="…"`.
- `--parent` (`#7d5ba6`) is declared once and read nowhere. Stage 1 removes it.
- **Today's look:**
  - Paper `--bg #fef9ef` / `--bg2 #fff4db` with ruled lines.
  - Ink `#2a2320`, secondary text `#6b5d4f`.
  - Headings Gochi Hand; text Patrick Hand (Nunito fallback).
  - Cards: white, 2.5px ink outline, 3px hard shadow.
  - Now card: `--bg2`, 3.5px outline, 7×8px hard shadow.
  - Now tick: 56px rounded square, mint, 2px shadow.
  - "Modify my plan": cream, 2.5px outline.
  - Categories pastel (`--cat-*`); kids `--jenn #ff9eb5`, `--jess #6fb1fc`.
- **Money colours today:** two sets that disagree. They are handed to the money redesign, not fixed here.
  - My money charts (`js/21-money-data.js`, `js/22-money-page1.js`): Kept ready yellow `#ffd166`, Locked away blue `#6fb1fc`, Spent pink `#ff9eb5`, loan paid off green `#95d5b2`.
  - Flow (`FL_COLOURS`, `js/42-flow.js`): Kept ready blue `#6fb1fc`, Locked away teal `#8ad8d0`, In companies lilac `#b0a0ea`, Spent yellow `#ffd166`, Loan peach `#f2b880`.
  - The Flow's own comment says its colours match My money; they do not.
- The app has **no dark theme**. Three rules adjust banners under the system dark setting, and `theR5ScreensReadInDarkMode` measures contrast under it. That check must keep passing in both looks.
- The kid nav has **five** tabs: Today · Week · Money · Sister Sync · More, drawn by `tdRenderNav`. "Sister Sync" fits at 375px in today's font; Calm's font changes that measurement.
- The ⋯ More sheet (`tdOpenMore`) holds 🧹 Chores · ◀ Switch and the build number. `check-dead-actions.js` cannot see `data-td-more`, so a More tile and its `tdGoMore` branch are added by hand, together.
- The parent portal has one header on every destination (`#screen-parent .topbar`): scope pills, 🔒 PIN, Exit.
- Body text is 19.5px (already +15% for the iPad). The parent portal has a Reading size setting (`--fs-scale` on `#screen-parent`: 1 / 1.15 / 1.3, per device).
- `js/07-week-view.js`: `wfTextPx` is a hand-measured glyph-width table for Patrick Hand at 13.1px. Its comment says a type change invalidates it, and `WF_TRAVEL_TEXT_MIN_PX`, the same way.

## 5. Stages (one PR each, in this order)

**Stage 1 — Move everything onto shared values. No visible change.**
- Replace every typed-in colour, font and inline style (CSS, generated markup, `index.html`) with a shared value. Each value carries today's look.
- Money colours become shared values with today's values, per page, unchanged (L10).
- Remove the unused `--parent`.
- Add the check (L11) to `npm run check`. Allowlist anything that genuinely can't be a shared value, with a reason per entry.
- *Done when:* `npm test` passes. Smoke screenshots at 1194×834 and 390×844 are unchanged from `main` (pixel diff on each kid screen). The check fails on a planted typed-in colour.

**Stage 2 — Restyle Pop (style B, handwriting). The kids see this.**

```diff
! Change the shared values to Pop's (§7):
!   cream graph-grid paper, navy ink, brighter category and kid colours;
!   the Now card filled with its category colour; list rows filled with the category tint;
!   yellow main buttons; a navy tick.
! Pop text 10% larger (text scale 1.1). The week grid's label fitting updated to match (L15).
! Fonts, border widths and money colours stay as today.
! Done when:
!   - npm test passes;
!   - the screenshots show only the listed changes;
!   - box geometry is unchanged from Stage 1 except where the larger text wraps (listed in the PR);
!   - "Sister Sync" fits on one line at 375px at the larger size (fallback: "Sisters");
!   - theStripStillSaysWhenToLeave passes;
!   - the 44px and 13px/15px floors hold;
!   - contrast ≥ 4.5:1 for all text, including navy text on every category fill;
!     no white text on a pastel.
```

**Stage 3 — Calm, and the toggles.**
- Load Baloo 2 and Lexend (for Calm only), with a real fallback stack, because fonts are cross-origin and not in the offline shell.
- Add the Calm value set (§7).
- The week grid's label fitting gives correct widths in Calm's fonts (L15, Rev 5).
- Add the kid toggle (L4) and the parent toggle (L5), two-way from the start.
- Apply Calm to the kid screens: Today, Week, Day, Sister Sync, the money pages, the meeting, the More sheet, and the kid sheets and pop-ups.
- *Done when:*
  - Flipping changes the look instantly with no reload.
  - After a reload the choice is still set for that kid on that device; the other kid and the parent are unaffected.
  - Box geometry is identical in both looks except where text width differs (listed in the PR).
  - The 44px and 13px/15px floors hold in both looks.
  - "Sister Sync" fits on one line at 375px in both fonts (fallback: "Sisters").
  - The More tile and the header button are ≥ 44×44px.
  - Contrast ≥ 4.5:1 for all text in both looks.
  - Smoke saves every kid screen in both looks at 1194×834 and 390×844 to `tests/out/` (the CI artifact).

**Stage 4 — Calm on the parent portal and remaining overlays.**
- The five destinations (Now · Meeting · History · Setup · App) and their panels.
- Print keeps today's values whichever look is set (L12).
- *Done when:* the same floors and contrast hold on parent screens in both looks, and print output (emulated) is identical whichever look is set.

**Stage 5 — Close out.**
- Add a `FEATURES.md` section for the two looks.
- Review the check's allowlist and remove entries that no longer need to be there.
- *Done when:* `npm test` passes and the owner reads the new build on the iPad.

## 6. Decisions on record

- **D1:** kid toggle = tile in ⋯ More. Rejected: a sixth nav button.
- **D2:** parent toggle = portal header button. Rejected: App → Preferences.
- **D3:** dropped (the parent purple is unused).
- **D4:** Stage 1 lands before pocket-money layout work.
- **D6:** money colours stay as today, the same in both looks; the money redesign picks the one set.

```diff
! D5 superseded by D8 (Rev 4): Pop = style B with today's handwriting fonts.
!   Rejected: today's look refined, and B with new fonts.
! D7 superseded by D9 (Rev 4): Calm borders are navy 3D sticker outlines at today's widths and
!   shadows. Rejected: soft-slate borders (too faint).
```

## 7. Design values (all dates 2026-09-27)

**Shared by both looks**
- Ink `#1c2240` (navy).
- Border widths (today's):
  - Cards, list rows and buttons: 2.5px.
  - Pills, chips and icon tiles: 2px.
  - Now card: 3.5px.
  - Bottom nav top edge: 2.5px.
  - Week blocks: 1.5px.
- Kid colours (fill / strong / wash). White text goes only on the strong value.
  - Jenn: `#ff5c8a` / `#c81d5a` / `#ffe4ec`
  - Jess: `#3d8bfd` / `#1a5fd0` / `#e2edff`
- Categories keep their hue, made brighter (fill / wash). Map every existing `--cat-*` and list each old → new in the PR.
  - School/Brain: `#4aa3ff` / `#e3f0ff`
  - Training/Body: `#f2597d` / `#ffe3ea`
  - Daily/Fuel & Care: `#ffc83d` / `#fff4d6`
  - Routine/Daily Rhythm: `#3cc9b9` / `#dcf7f3`
  - Free/Play & Rest: `#4cc46a` / `#e0f6e5`
  - Active/Explore: `#fb8a2e` / `#ffead8`
  - Sleep: `#a78bfa` / `#efe9ff`
- Money colours: today's, unchanged (§4).
- Emoji stay as the app's icons.

**Pop**

```diff
! Fonts: today's (Gochi Hand headings, Patrick Hand text), 10% larger (Rev 5).
! Page: cream #fff6e3 with a graph grid, lines #f1e5c8 every 26px. Secondary text #4d5575.
! Cards: white, navy border, hard shadow 4px 4px.
! Now card: filled with the current block's category colour, navy text, hard shadow 7×8px.
! List rows: filled with the category tint, 3px hard shadow; icon tiles white.
! Main button: yellow #ffc83d, navy text, 3px hard shadow. Second button: white.
!   Selected tab: yellow.
! Tick: navy with a white check. Progress bar: navy on white.
```

**Calm**

```diff
! Borders: navy at the shared widths, with today's hard shadows (cards 3px; Now card 7×8px;
!   tiles 2px).
```

- Fonts: Baloo 2 (600/700/800) for headings and big figures; Lexend (400/500/600) for text and numbers, with tabular figures.
- Page: `#eef2f9` with a graph grid, lines `#dde3ee` every 26px. Secondary text `#5a6380`.
- Cards and Now card: white.
- List rows: white; the category shows as a tinted icon tile.
- Main button and tick: purple `#5b4fd6`, white text. Selected pill: navy with white text.
- Week blocks: category tint with the navy border.

**Print (both looks):** as today.

## 8. Out of scope

- Screen layouts, features, data and the merge layer.
- Unifying the money colours and money page structure (the money redesign, PR C / payday v6).
- A dark theme, new animation, replacing emoji.

## 9. Risks

- **Text width.** Pop's larger text and Calm's fonts both change text width everywhere. Watch nav labels, chips and the 390px school-day banner, and check each in both looks.
- **Offline fonts.** Offline, Calm's fonts fall back to the stack. That is acceptable, but the fallback must still meet the floors.
- **Ongoing cost.** Every future screen change has to be checked in both looks. The check (L11) covers colours, fonts and contrast; layout still needs a look on the iPad.
- **Merge order.** If a money branch opens before Stage 1 merges, whichever lands second rebases onto the other.
- **The money colour mismatch** (§4) stays visible to the kids until the money redesign fixes it.

```diff
+ Pop is now a visible restyle, not a refinement. The kids see new paper, navy ink and filled cards
+   when Stage 2 merges. They keep their handwriting fonts.
+ Pop and Calm now share the same navy sticker structure. They stay distinct through paper colour,
+   filled vs white cards, fonts and button colours. Confirm on the iPad after Stage 3 that the two
+   still feel different.
```
