# Kit gaps found in PR 7, 8, 10 reviews (2026-10-11)

Fix these once, in the kit, not per screen. One small PR ("Kit 1.1") before PR 11.

| # | Gap | Seen in | Fix in kit |
|---|---|---|---|
| K1 | No disabled look: ▶ on the last week looks tappable | PR10 Q6 | `.ui-btn:disabled, [aria-disabled=true]`: 45% opacity, no shadow, `cursor: default` |
| K2 | No hover look (mouse only) | PR7 16, PR10 Q3 | `.ui-btn:hover` and `.ui-chip:hover`: paper → pale wash; `cursor: pointer`. Fingers on the iPad see no difference |
| K3 | No dark-mode look: white chips on a dark banner | PR8 Q8 | **Owner decision 2026-10-11: drop dark mode app-wide.** Delete every `prefers-color-scheme: dark` rule; add `color-scheme: light` on `:root`; a guard fails on any new dark-mode rule |
| K4 | Two kid switches: header = one joined switch; Now and She told me = three round pills in the orange pill colour | PR10 Q11, Q13 | One `.ui-kids`: joined switch, selected = `--sel` (Pop yellow, Calm navy), the same as the header |
| K5 | Seven-day rows built three ways: Now = round chips (tall ovals), She told me = round chips, Meeting = kit buttons | PR10 Q3, Q8 | One `.ui-days`: 7 equal cells, 12px corner (not pill), today / confirmed / chosen / future states. Used by Now, She told me and Meeting. (Correction 2026-10-11: Today has no seven-day row; its ribbon stays as it is.) |
| K6 | "Run family meeting": full width on Now, narrow on Meeting | PR10 Q4 | `.ui-btn--block` (full width) for a screen's one leading action |
| K7 | Yes/answer colour split: Approve is now yellow, "She bought it" stays green on the same page | PR10 Q1 | `.ui-btn--ok` (green). Approve and She bought it use it; Confirm all stays primary |
| K8 | No list-row part: Today rows stay private and PR 8 did not add one, so the deferral was lost | PR7 Q19 | `.ui-row` (**52px on kid screens, 44px on parent screens** — corrected 2026-10-11 to match D11; 2px border, 11px corner, dashed `--add` variant, icon · name · right text slots, done look). Today and Week/Day rows use it in PR 11 |
| K9 | Rows rounder than their card (18px in 14px) | PR7 Q19 | Inner corners 11px |
| K10 | − / + steppers: Sunday is rounded-square (kit), Grown-ups still round | PR9 Q2 | Grown-ups steppers move to the kit stepper; no round stepper left |
| K11 | Two "selected" colours: header switches and day span use `--sel` (Pop yellow), picked chips use `--pill-on` (Pop orange) | PR9 Q9, PR10 Q13 | `--pill-on` = `--sel` in both looks. One selected colour app-wide |
| K12 | Phone Pop: Sunday choose chips wrap to 3 rows, pushing the cards about 50px lower | PR9 Q4 | Kit chip side padding 0.6rem at ≤699px; check that the choose row fits 2 rows at 390px in Pop |

PR 8 Q3 (stopwatch hidden on short blocks): on any block ≥ 46px tall, show ⏱ as a 44px icon-only button ("Start stopwatch") beside the ✓ instead of hiding it. Only blocks under 46px lose both.

## Owner corrections after Round 1 (2026-10-12) — these override K4, K5, K10, K11 above

| # | Correction |
|---|---|
| C1 (overrides K11) | Two colours, two jobs. **Picked / selected = dark teal fill + white text** (the pre-Round-1 look). **Main action = yellow + navy** (Send, Run family meeting, Print). Never one colour for both. Teal also keeps the selected kid switch from clashing with Jenn's yellow 🐥 |
| C2 | Each major area may set its own picked colour **once, at the area root** (e.g. `[data-area="money"]`, `[data-area="planner"]`, `[data-area="parent"]` set `--sel`/`--sel-ink`). Inside an area, one picked colour. White text needs 4.5:1 on it |
| C3 (overrides K10, kit chip shape) | Keep the previous shapes: chips and amount buttons are **rounded rectangles (10–12px corners), not pills**; − / + steppers stay **round**. All pages |
| C4 (overrides K4 width) | Kid switch keeps the joined style but **fills the width** of its row (two equal halves), as wide as the old one. Pop and Calm |
| C5 (overrides K5) | Day tiles **bring back their information**: weekday, date, 🐥 % and 🦊 %, "Review ›". Keep the ✓ confirmed / • today marks. Phone wraps the tiles (as before). Remove the long % list from the status line. Today's tile is not a new red-orange fill: use C1 |
| C6 (Round 1 Q-e) | Bring back the row hover hint and the pale look of an open catch-up day |
| C7 (bug, exists on main too) | The bottom nav floats in the middle of the screen on the iPad. It must stay pinned to the bottom of the screen. Find the cause (likely `position: fixed` inside a parent with `transform`/`filter`/`contain`, or a `100vh` height on iPad Safari) and add a smoke check: nav bottom edge = window height ± 1px after scrolling to the end of Today |

## C8 — Button colours: final, do not ask (2026-10-12)
Use exactly these. Values already exist in css/app.css; point the kit tokens at them. If one fails 4.5:1 for its text, darken that fill only and note it in the PR. Don't ask.

| Job | Pop | Calm | Where |
|---|---|---|---|
| **Picked** (chips, amount, day, kid switch, tabs) — money area | #2f7f77 fill, #fff text (`--mny-v15-teal`, 4.7:1) | same | My money, Money school, Sunday, Grown-ups, request sheets |
| **Picked** — planner area | #2f7f77 fill, #fff text | #1c2240 fill, #fff text (`--ink`) | Today, Week, Day, Sister Sync, Profile |
| **Picked** — parent area | #1c2240 fill, #fff text | #1c2240 fill, #fff text | Parent Now, She told me, Meeting hub, Monthly |
| **Main action** (one per screen) | #ffc83d fill, #1c2240 text (`--btn-main`) | #5b4fd6 fill, #fff text | Send to parents, Run family meeting, Print, Save (ready) |
| **Yes / OK** | #2f7d55 fill, #fff text (`--status-done-strong`, 5.0:1) | same | Approve, Yes pay it, She bought it, Set it, routine done |
| **Danger** (deletes, cannot undo) | #b8441f fill, #fff text | same | Delete, Remove. Not "No" or "Not now" |
| **Secondary** | #fff fill, 2px #1c2240 border, #1c2240 text | same | Not now, No, Talk first, Undo, Answer ›, ◀ ▶ |
| **Disabled** | any of the above at 45% opacity, no shadow | same | |
| **Today marker** on day tiles | double #1c2240 border (as before), no fill | same | |

Rules: yellow means only "main action". Picked never uses yellow, so it never clashes with Jenn's 🐥. Set the picked colour once per area with `[data-area]` (C2).
