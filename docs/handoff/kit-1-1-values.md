# Kit 1.1 — the value table (K1–K12)

Stage 50, Plan v11 Rev 4 (D45–D54, D71–D73) with the owner's Stage 60 answers
(G1, G2, G4, G8). The rules are the kit block of `css/app.css` (`.ui-*`) and
the two look blocks (`:root[data-look="pop"]`, `:root[data-look="calm"]`).
Every row is measured on a fixture by `theComponentKitHoldsItsSizes`
(`tests/smoke.js`) at 1194×834 and 390×844, in Pop and in Calm; a colour is
compared with its token's computed value, not a typed colour. The class list
is `UI_KIT_CLASSES` in `tests/helpers.test.js` (complete both ways). K3 (dark
mode removed, light scheme on the root) was Stage 49 and is checked by
`tests/check-look-tokens.js` rule 6.

- 2026-10-11: K8 corrected by the owner 2026-10-11 (kid 52 / parent 44): a kid's
  row is 52px, a parent's row 44px (G8). The 46px stopwatch line of the
  kit-gaps note is superseded by D67 (48px: ✓ and ⏱ start at 48px blocks).
- 2026-10-11: the owner's corrected kit-gaps copy (K1–K12, copy 3) has not
  arrived; `docs/handoff/kit-gaps-pr7-10.md` is not created yet.

| Part | Value | Token | Check |
|---|---|---|---|
| K1 disabled button (`.ui-btn:disabled`, `.ui-btn[aria-disabled="true"]`) | opacity 0.45 | — | `(disabled) opacity` |
| K1 disabled button | no shadow, also over a rule that draws one | — | `(disabled) shadow` |
| K1 disabled button | cursor default | — | `(disabled) cursor` |
| K2 hover (`.ui-btn`, `.ui-chip`, only under `@media (hover: hover)`) | a pale wash laid over the part's own fill (`background-image`), the fill unchanged | `--hover-wash` (Pop `rgba(184, 68, 31, 0.08)`, Calm `rgba(28, 34, 64, 0.07)`) | `under the mouse, its wash` / `its own fill` (mouse moved onto a secondary button, a main button, a chip) |
| K2 hover | cursor pointer | — | `under the mouse, its cursor` |
| K2 hover | none on a disabled button (wash none, cursor default) | — | `a disabled button under the mouse` |
| K4 kid switch (`.ui-kids`) | cells joined: no gap | — | `the second kid cell (joined: no gap)` |
| K4 kid switch | 2px ink frame | `--bw-chip`, `--ink` | `the kid switch frame` (top, bottom, left, right; colour) |
| K4 kid switch | pill ends: first cell's left corners and last cell's right corners 999px; inner corners 0 | `--radius-pill` | `the kid switch start` / `end` / `divider corner` |
| K4 kid switch | 2px ink divider between cells | `--bw-chip` | `the kid switch divider` |
| K4 kid switch | chosen girl fill and ink | `--sel` / `--sel-ink` | `the chosen girl fill` / `ink` |
| K4 kid switch | the other girl white | `--paper` | `the other girl fill` |
| K4 kid switch | cell 44px high | — | `a kid switch cell` |
| K4 kid switch | cell sides 0.75rem (12px). The header's sub-bar keeps its own phone rule (`.hdr-sub .ui-kids > button`: at least 44px wide, sides 8px): a kit min-width would also widen the portal's girl switch (`.parent-scope`, content-box cells), a header picture | `--space-3` | `a kid switch cell side` |
| K5 seven-day row (`.ui-days`) | 7 cells on one row | — | `the seven-day row has` / `day cell n is not on the row` |
| K5 seven-day row | the 7 cells equal width | — | `day cell n's width` |
| K5 seven-day row | cell at least 44px high | — | `day cell n is …px high, under 44` |
| K5 seven-day row | cell corner 12px | `--radius-cell` (new, 12px) | `day cell n's corner` |
| K5 seven-day row | cell border 2px | `--bw-chip` | `day cell n's border` |
| K5 seven-day row | every cell has a spoken name (`aria-label`) that can carry its % (G1) | — | `has no spoken name with its %` |
| K5 today (`[aria-current="date"]`) | the look's today square: fill and ink | `--day-now-bg` / `--day-now-ink` (Pop strong accent, white; Calm white, ring `--day-now-ring`) | `today's fill` / `today's ink` |
| K5 today | a dot mark • (not colour alone, G1) | — | `today's mark` |
| K5 confirmed (`.ui-day--ok`) | green fill | `--status-done` | `a confirmed day fill` |
| K5 confirmed | a ✓ mark (G1) | — | `a confirmed day mark` |
| K5 today and confirmed | both marks • ✓ | — | `today confirmed, its marks` |
| K5 chosen (`[aria-pressed="true"]`) = the day whose review/answer is open on that screen | the selected colour | `--sel` / `--sel-ink` | `the chosen day fill` / `ink` |
| K5 chosen, where a screen has no open day | Now's Sunday card and the Meeting hub have none (a tap opens the meeting or the answer sheet), so they draw no chosen cell; only Now › She told me does | — | — |
| K5 to come, not tappable (`:disabled`) | dashed border (Now › She told me) | — | `a day to come, its border` |
| K5 to come, tappable (`.ui-day--future`) | the same dashed border, no opacity drop, pointer stays (Now's Sunday card, the Meeting hub) | — | `to-come day cell n is drawn …, want dashed` / `must be .ui-day--future, tappable, pointer` |
| K5 to come | the lighter ink | `--ink-light` | `a day to come, its ink` |
| K5 a plain day | no mark | — | `a plain day mark` |
| K6 full-width button (`.ui-btn--block`) | width 100% of its column | — | `the full-width button` |
| K7 ok button (`.ui-btn--ok`) | green fill, both looks | `--status-done` | `the ok button fill` |
| K7 ok button | its ink | `--status-done-ink` | `the ok button ink` |
| K8 list row (`.ui-row`) | a kid's row 52px | — | `a kid's row` |
| K8 list row, parent size (`.ui-row--parent`) | a parent's row 44px (no user yet: defined and listed, no screen draws it) | — | `a parent's row` |
| K8 list row | border 2px | `--bw-chip` | `a row border` |
| K8 list row | corner 11px | `--radius-btn` | `a row corner` |
| K8 list row | slots: icon (`.ui-row-icon`) before the name (`.ui-row-name`), the right-hand slot (`.ui-row-end`) at the row's right inner edge | — | `the row's icon is not before its name` / `the row's right-hand slot` |
| K8 done (`.ui-row--done`) | green wash fill | `--status-done-wash` | `a done row fill` |
| K8 done | the name struck through (not colour alone) | — | `a done row's name is not struck through` |
| K8 add (`.ui-row--add`) | dashed border | — | `the add row border` |
| K9 inner corners | a kit button, a tab, a stepper button 11px (and the row, K8) | `--radius-btn` | `a kit button's corner` / `a tab's corner` / `a stepper button's corner` |
| K9 card | 14px | `--radius-md` | `a card's corner` |
| K10 stepper (`.ui-stepper`) | − / + 44×44 where only a parent uses it | — | `a stepper button width` / `height` |
| K10 stepper, kid size (`.ui-stepper--kid`) | − / + 52×52 where the girl uses it: the request sheet and Sunday's girl steppers (G4) | — | `the girl's stepper button width` / `height` |
| K11 picked chip (`.ui-chip[aria-pressed="true"]`) | fill equals the selected colour, both looks | `--pill-on: var(--sel)` (both look blocks) | `a picked chip fill (the selected colour)` |
| K11 picked chip | ink | `--pill-on-ink: var(--sel-ink)` | `a picked chip ink` |
| K12 chip sides | 0.75rem (12px) on the iPad; 0.6rem (9.6px) at 699px and below | `--space-3` / — | `a chip side` |
| K12 chip width, at 699px and below | at least 44px, so a short chip stays a 44px target with the narrower sides (a Sunday chip was 40px wide without it) | — | `a one-figure chip is …px wide, under 44` |
| K12 chip shrink, at 699px and below | flex-shrink 0: the 44px min-width replaces flex's content minimum, so without it a long chip was squeezed under its label (Sunday choose row, run 38197271036) | — | `a chip on a phone, its shrink` |

## Owner corrections C1–C6, C8 (2026-10-12) — these rows override the K rows above

From `docs/handoff/kit-gaps-pr7-10.md` § "Owner corrections after Round 1"
and § "C8 — Button colours". Where a C row and a K row disagree, the C row
holds: K4's colour and width, K5's today fill and plain cells on Now and the
Meeting hub, K9's stepper corner, K10's shape, K11's one colour app-wide.
Measured by `theComponentKitHoldsItsSizes` unless named; every check meets a
plant it must catch (a yellow picked chip, white on yellow, the old green ok
fill, a pill chip, an 11px − / +, an inline switch, a solid today frame,
seven squeezed tiles, a div row under the mouse, an open catch-up day drawn
paper, a tile without its %, the old % status line, a switch that does not grow).

| Part | Value | Token | Check |
|---|---|---|---|
| C1/C2 picked, money area (`[data-area="money"]`) | #2f7f77 fill, #fff text, both looks | `--sel: var(--mny-v15-teal)` / `--sel-ink: var(--mny-v15-white)` | `money: a picked chip` / `the chosen girl` / `the current tab` / `the chosen day`; `theSundayKitHolds44pxInItsBoxes` (picked chip) |
| C1/C2 picked, planner area (`[data-area="planner"]`, and outside any area) | Pop #2f7f77 / #fff, Calm #1c2240 / #fff | `--sel-planner` / `--sel-planner-ink` (both look blocks) | `planner: …` |
| C1/C2 picked, parent area (`[data-area="parent"]`) | #1c2240 / #fff, both looks | `--sel: var(--ink)` / `--sel-ink: var(--ink-on-strong)` | `parent: …`; `thePortalKitHolds44px` (She told me's girl and day, Now's girl) |
| C1/C2 one picked colour per area | `--pill-on`, `--tab-on` re-read at the area root, so a picked chip and a tab follow it | `[data-area] { --pill-on: var(--sel); --tab-on: var(--sel) }` | as above |
| C8 main action | Pop #ffc83d / #1c2240, Calm #5b4fd6 / #fff | `--btn-main` / `--btn-main-ink` | `the main button` |
| C8 Yes / OK (`.ui-btn--ok`) | #2f7d55 / #fff, both looks | `--btn-ok: var(--status-done-strong)` / `--btn-ok-ink` | `the ok button`; `theSundayKitHolds44pxInItsBoxes`, `thePortalKitHolds44px` (Grown-ups) |
| C8 Danger (`.ui-btn--danger`, deletes only) | #b8441f / #fff, both looks | `--btn-danger: var(--mny-v15-red)` / `--btn-danger-ink` | `the danger button` |
| C8 Secondary (`.ui-btn--secondary`) | #fff fill, 2px #1c2240 border, #1c2240 text | `--paper`, `--bw-chip`, `--ink` | `the secondary button`, `… border`, `… border colour` |
| C8 contrast | every pair above at least 4.5:1: teal 4.75, navy 15.53, Pop main 10.04, Calm main 5.94, ok 5.02, danger 5.41, secondary 15.53 — no fill darkened | — | `… under 4.5:1` (printed: `C8 contrast` line) |
| C8 today (`[aria-current="date"]`) | a double #1c2240 frame, 4px (two lines), no fill of its own (a confirmed today stays green) | `--bw-today`, `--today-mark` | `today's frame` / `today's fill` / `today confirmed, its fill` |
| C3 chip (`.ui-chip`) | a rounded rectangle, 11px corners (overrides the pill) | `--radius-btn` | `a chip's … corner`; `theSundayKitHolds44pxInItsBoxes` |
| C3 stepper (`.ui-stepper > button`) | round (overrides K9/K10's 11px) | `--radius-full` | `a stepper button (round)`; `theSundayKitHolds44pxInItsBoxes` |
| C4 kid switch (`.ui-kids`) | fills its row, the girls in equal grid columns; in a flex row it grows (Now's toggles, the money sub-bar). The portal's header girl switch (`.parent-scope`) keeps the header table's cells (pad 0 16 / 0 14, phone 46×44) | — | `the kid switch is …px wide` / `halves`; `thePortalKitHolds44px` (Now, She told me) |
| C5 day tiles (`.ui-days--tiles`, Now and the Meeting hub) | weekday (`.ui-day-dow`), date (`.ui-day-date`), 🐥 % and 🦊 % (`.ui-day-pct`), "Review ›" or "Confirmed" (`.ui-day-state`); one width, at least 72px, wrapping where seven do not fit; the spoken name says day, date, state, today and both % | — | `the tiles are …`; `thePortalKitHolds44px` (`day tile n …`, spoken names) |
| C5 hub status line | no % list (the tiles carry it) | — | `thePortalKitHolds44px` (`the status line still lists`) |
| C6 row hover (`button.ui-row`, mouse only) | the pale wash, the pointer | `--hover-wash` | `a kit row (a button) under the mouse` |
| C6 open catch-up day (Today) | `--bg2`; a closed one paper | `--bg2` | `withMumReadsInBothLooks` (`an open catch-up day`) |

Modifiers chosen here: the list row's parent size is `.ui-row--parent` (the
kid's 52px is the default: Today's and Week/Day rows are the girls'); the
stepper's girl size is `.ui-stepper--kid` (the 44px default is the parent
screens'; Sunday's girl steppers and the request sheet's are 52px, `--kid`).

Local exception to K12: `css/parent.css` l.268, `.gu-opts > .ui-chip,
.rq-opts > .ui-chip` set `flex-shrink: 1` (K12 says 0 on a phone), so a long
label wraps instead of pushing the page sideways; min-width 44px still holds.

Planted faults, each failing the check (2026-10-11, then removed): a disabled
button at full opacity; a six-cell row; a 999px cell corner; a 40px row; a
picked-chip colour that differs from the selected colour.

Left for Round 2 (reviewer findings on C1–C8, 2026-10-12): `.pill-btn` (20px corner) and `.filter-chip` (16px corner) are still pills; Stages 62/63 convert them to the 10–12px chip corner. `.mny-chip` is 10px now.
