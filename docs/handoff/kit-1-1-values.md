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
| K4 kid switch | cell 44px high, at least 44px wide | — | `a kid switch cell` |
| K4 kid switch | cell sides 0.75rem (12px); 0.5rem (8px) at 699px and below — folded in from the header's sub-bar rule `.hdr-sub .ui-kids > button` | `--space-3` / `--space-2` | `a kid switch cell side` |
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
| K5 chosen (`[aria-pressed="true"]`) | the selected colour | `--sel` / `--sel-ink` | `the chosen day fill` / `ink` |
| K5 to come (`:disabled`) | dashed border | — | `a day to come, its border` |
| K5 to come | the lighter ink | `--ink-light` | `a day to come, its ink` |
| K5 a plain day | no mark | — | `a plain day mark` |
| K6 full-width button (`.ui-btn--block`) | width 100% of its column | — | `the full-width button` |
| K7 ok button (`.ui-btn--ok`) | green fill, both looks | `--status-done` | `the ok button fill` |
| K7 ok button | its ink | `--status-done-ink` | `the ok button ink` |
| K8 list row (`.ui-row`) | a kid's row 52px | — | `a kid's row` |
| K8 list row, parent size (`.ui-row--parent`) | a parent's row 44px | — | `a parent's row` |
| K8 list row | border 2px | `--bw-chip` | `a row border` |
| K8 list row | corner 11px | `--radius-btn` | `a row corner` |
| K8 list row | slots: icon (`.ui-row-icon`) before the name (`.ui-row-name`), the right-hand slot (`.ui-row-end`) at the row's right inner edge | — | `the row's icon is not before its name` / `the row's right-hand slot` |
| K8 done (`.ui-row--done`) | green wash fill | `--status-done-wash` | `a done row fill` |
| K8 done | the name struck through (not colour alone) | — | `a done row's name is not struck through` |
| K8 add (`.ui-row--add`) | dashed border | — | `the add row border` |
| K9 inner corners | a kit button, a tab, a stepper button 11px (and the row, K8) | `--radius-btn` | `a kit button's corner` / `a tab's corner` / `a stepper button's corner` |
| K9 card | 14px | `--radius-md` | `a card's corner` |
| K10 stepper (`.ui-stepper`) | − / + 44×44 where only a parent uses it | — | `a stepper button width` / `height` |
| K10 stepper, kid size (`.ui-stepper--kid`) | − / + 52×52 where the girl uses it (G4) | — | `the girl's stepper button width` / `height` |
| K11 picked chip (`.ui-chip[aria-pressed="true"]`) | fill equals the selected colour, both looks | `--pill-on: var(--sel)` (both look blocks) | `a picked chip fill (the selected colour)` |
| K11 picked chip | ink | `--pill-on-ink: var(--sel-ink)` | `a picked chip ink` |
| K12 chip sides | 0.75rem (12px) on the iPad; 0.6rem (9.6px) at 699px and below | `--space-3` / — | `a chip side` |

Modifiers chosen here: the list row's parent size is `.ui-row--parent` (the
kid's 52px is the default: Today's and Week/Day rows are the girls'); the
stepper's girl size is `.ui-stepper--kid` (the 44px default keeps every
current stepper as it is: Sunday's and the parent screens').

Planted faults, each failing the check (2026-10-11, then removed): a disabled
button at full opacity; a six-cell row; a 999px cell corner; a 40px row; a
picked-chip colour that differs from the selected colour.
