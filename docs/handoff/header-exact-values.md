# Header — exact values (source: Header System.dc.html, turn 2)

Take the values from this table. Do not reuse old classes (`.topbar`, `.week-nav`, `.btn-icon`, `.profile-badge`) — that is where the build drifted from the picture.

## Bar
| Part | iPad | Phone (≤699) |
|---|---|---|
| Height | 64px (money 72, meeting 62 + 44) | 60px (money 64, meeting 60 + 44) |
| Padding / gap | 0 18px / 16px | 0 10–12px / 6–10px |
| Background | #fff (parent: --purple) | same |
| Rule | 2.5px solid ink, bottom only. Meeting row 1: 1.5px dashed grid line | same |

## Layout (the main miss)
`[back?] [title] [context — flex:1, centred] [actions] [badge]`
The context slot (date or ◀ week ▶) **must sit in the middle of the bar** (`flex:1; justify-content:center`), never pushed right.

## Parts
| Part | Value |
|---|---|
| Title | head font, 30px × look scale (Pop 1.1), weight 700, ink |
| Date / week label | body font, **22px, weight 600, ink #1c2240** (not grey, not 15–19px). Phone 20px. Day: date is the title, head font 28px × scale |
| Stepper ◀ ▶ | 52×52, white, 2px ink border, radius 14, hard shadow (Pop 3px 3px 0, Calm 2px 2px 0). Label min-width 200px |
| Full / Preview | **One joined switch**: 2px ink border, radius 14, overflow hidden; two cells 56×48, divider 2px ink; selected cell = --sel fill. Icons 📋 / 🖨, 20px, no words |
| Print (Preview only) | 52px high, --main fill, word "Print" 18px 600 |
| Day span 1·2·3 | joined switch, cells 52×48, selected = --sel (**Pop yellow #ffc83d**, Calm navy) |
| Badge | 52×52 circle, **#ffe4ec (pink)**, 2px ink border, emoji 24px, no name. Parent 44×44 |
| Meeting chosen girl | 2.5px ink border + 3px #ff5c8a ring |
| Kid buttons | 52px min · parent 44px · money 54px |

## Check it, don't eyeball it
Add to smoke: for each header, read `getBoundingClientRect()` / `getComputedStyle()` and assert the numbers above (bar height, context centre within ±8px of bar centre, date font-size and colour, badge size and background, switch is one element). Fail the test on any mismatch.

## Per-screen table (Stage 20, from the turn-2 source)

Source: `docs/handoff/consistency/headers/source/header-system-turn2.dc.html` (a copy of the owner's `Header System.dc.html`). Turn 2 is SRC lines 20-330, drawn once per look from the look values at SRC 610-615 (`looks2`, SRC 618: `2a` Pop, `2b` Calm). Turn 1 (SRC 332 on) is the old set and is not used. "SRC n" is the line in that file.

**The check reads this table.** `everyHeaderMeasuresToTheExactValues` (tests/smoke.js) finds the row by Screen, Size and Look and takes its numbers from the Bar, Title, Centre and Badge cells, so keep their wording: Bar `<row> + <rule> …; pad 0 <x>; gap <g>`, Title `… = <px>px <weight>`, Centre `… <px>px <weight> <#ink>`, Badge `<w>×<h> <#bg>, <border>px <#ink>, … emoji <px>px`. Part A runs the Today rows; part B adds the others.

### Look values (SRC 610-615)

| Value | Pop | Calm | SRC |
|---|---|---|---|
| hs (title scale, `--text-scale`) | 1.1 | 1 | 611, 614 |
| head font | 'Gochi Hand' | 'Baloo 2' | 611, 614 |
| body font | 'Patrick Hand' | 'Lexend' | 611, 614 |
| `--sel` / `--sel-ink` (selected cell, tab) | #ffc83d / #1c2240 | #1c2240 / #fff | 612, 615 |
| main / mainInk (Print, Payday pill) | #ffc83d / #1c2240 | #5b4fd6 / #fff | 612, 615 |
| `--hdr-sh` (stepper and button shadow) | 3px 3px 0 #1c2240 | 2px 2px 0 #1c2240 | 612, 615 |
| purple (parent bar) | #c3aed6 | #dedaf8 | 612, 615 |
| `--hdr-badge-bg` | #ffe4ec | #ffe4ec (literal, same) | 52, 71, 112, 125 |
| `--hdr-label-ink` and every ink | #1c2240 | #1c2240 (literal, same) | 50, 51, 64 |
| `--hdr-ring` (meeting chosen girl) | #ff5c8a | #ff5c8a (literal, same) | 209, 236 |
| bar background | #fff | #fff (literal, same) | 49 |

Calm differs from Pop only in: hs (title sizes), fonts, `--sel` / `--sel-ink`, main / mainInk, `--hdr-sh`, purple. Badge, ink, ring and bar are the same literals in both looks. Not scaled by hs in either look (the source types them in px): the date and week label, the badge emoji, the stepper glyphs, every button's word.

### Screens

Parts are listed left group | centre | right group. The centre sits in the middle of the bar (layout section above; the build's row is a `1fr auto 1fr` grid). "—" = the part is not on that header.

| Screen | Size | Look | Parts | Bar | Title | Centre | Buttons | Switch / selected | Badge | SRC |
|---|---|---|---|---|---|---|---|---|---|---|
| Today | iPad | Pop | title · date · badge | 64 + 2.5 solid #1c2240; pad 0 18; gap 16; bg #fff | head 30×1.1 = 33px 700 #1c2240, line-height 1, "Today" | date, body 22px 600 #1c2240, "Tuesday 6 October" | — | — | 52×52 #ffe4ec, 2px #1c2240, round, emoji 24px | 49, 50, 51, 52 |
| Today | iPad | Calm | title · date · badge | 64 + 2.5 solid #1c2240; pad 0 18; gap 16; bg #fff | head 30×1 = 30px 700 #1c2240, line-height 1, "Today" | date, body 22px 600 #1c2240, "Tuesday 6 October" | — | — | 52×52 #ffe4ec, 2px #1c2240, round, emoji 24px | 49, 50, 51, 52, 615 |
| Today | phone | Pop | title · date · badge | 60 + 2.5 solid #1c2240; pad 0 12; gap 10; bg #fff | head 26×1.1 = 28.6px 700 #1c2240, "Today" | date, body 20px 600 #1c2240, "Tue 6 Oct" | — | — | 52×52 #ffe4ec, 2px #1c2240, round, emoji 24px | 122, 123, 124, 125 |
| Today | phone | Calm | title · date · badge | 60 + 2.5 solid #1c2240; pad 0 12; gap 10; bg #fff | head 26×1 = 26px 700 #1c2240, "Today" | date, body 20px 600 #1c2240, "Tue 6 Oct" | — | — | 52×52 #ffe4ec, 2px #1c2240, round, emoji 24px | 122, 123, 124, 125, 615 |
| Week Full | iPad | Pop | title · ◀ label ▶ (gap 10) · switch, badge | 64 + 2.5 solid #1c2240; pad 0 18; gap 16; bg #fff | head 30×1.1 = 33px 700 #1c2240, "My Week" | week label, body 22px 600 #1c2240, min-width 200, "Oct 5 – Oct 11" | ◀ ▶ 52×52 #fff, 2px #1c2240, r14, shadow 3px 3px 0, glyph 17px | one switch, 2px #1c2240, r14, overflow hidden, #fff; cells 56×48, 📋 / 🖨 20px, no words, divider 2px; 📋 selected #ffc83d / #1c2240 | 52×52 #ffe4ec, 2px #1c2240, round, emoji 24px | 60, 61, 62, 63, 64, 65, 67, 68, 69, 71 |
| Week Full | iPad | Calm | as Pop | 64 + 2.5 solid #1c2240; pad 0 18; gap 16; bg #fff | head 30×1 = 30px 700 #1c2240, "My Week" | week label, body 22px 600 #1c2240, min-width 200, "Oct 5 – Oct 11" | ◀ ▶ 52×52 #fff, 2px #1c2240, r14, shadow 2px 2px 0, glyph 17px | as Pop; 📋 selected #1c2240 / #fff | 52×52 #ffe4ec, 2px #1c2240, round, emoji 24px | 60-71, 615 |
| Week Preview | iPad | Pop | title · ◀ label ▶ · switch, Print, badge | 64 + 2.5 solid #1c2240; pad 0 18; gap 16; bg #fff | head 30×1.1 = 33px 700 #1c2240, "My Week" | week label, body 22px 600 #1c2240, min-width 200, "Oct 5 – Oct 11" | ◀ ▶ as Week Full; Print min-height 52, pad 0 18, gap 6, #ffc83d / #1c2240, 2px #1c2240, r14, shadow 3px 3px 0, body 18px 600 "Print" | as Week Full; 🖨 selected #ffc83d / #1c2240 | 52×52 #ffe4ec, 2px #1c2240, round, emoji 24px | 79-91 (87, 88 switch; 90 Print) |
| Week Preview | iPad | Calm | as Pop | 64 + 2.5 solid #1c2240; pad 0 18; gap 16; bg #fff | head 30×1 = 30px 700 #1c2240, "My Week" | week label, body 22px 600 #1c2240, min-width 200, "Oct 5 – Oct 11" | ◀ ▶ shadow 2px 2px 0; Print #5b4fd6 / #fff, shadow 2px 2px 0, body 18px 600 | 🖨 selected #1c2240 / #fff | 52×52 #ffe4ec, 2px #1c2240, round, emoji 24px | 79-91, 615 |
| Week | phone | Pop | ◀ · label · ▶, 🖨, badge (no title, no switch) | 60 + 2.5 solid #1c2240; pad 0 10; gap 6; bg #fff | — | week label, body 20px 600 #1c2240, flex 1, "Oct 5 – 11" | ◀ ▶ 52×52 #fff, 2px #1c2240, r14, shadow 3px 3px 0, glyph 16px; 🖨 52×52 #fff, 2px, r14, shadow, 20px, opens Preview | — | 52×52 #ffe4ec, 2px #1c2240, round, emoji 24px | 133, 134, 135, 136, 137, 138, 156 |
| Week | phone | Calm | as Pop | 60 + 2.5 solid #1c2240; pad 0 10; gap 6; bg #fff | — | week label, body 20px 600 #1c2240, flex 1, "Oct 5 – 11" | as Pop, shadow 2px 2px 0 | — | 52×52 #ffe4ec, 2px #1c2240, round, emoji 24px | 133-138, 615 |
| Week Preview | phone | Pop / Calm | not drawn: the phone Week frame applies; Print shows only in Preview (SRC 156); its phone size is not drawn (a question for part B) | — | — | — | — | — | — | 156 |
| Day | iPad | Pop | back "◀ Week" · ◀ date-title ▶ (gap 10) · span 1·2·3, 📑, badge | 64 + 2.5 solid #1c2240; pad 0 18; gap 16; bg #fff | the date is the title, in the centre: head 28×1.1 = 30.8px 700 #1c2240, line-height 1, min-width 220, "Tuesday 6 Oct" | (the date-title) | back min-height 52, pad 0 16, gap 6, #fff, 2px #1c2240, r14, shadow 3px 3px 0, body 18px; ◀ ▶ 52×52, glyph 17px; 📑 52×52 #fff, 2px, r14, shadow, 20px | span: one switch 2px r14; cells 52×48, body 19px; 1 selected 600 #ffc83d / #1c2240; dividers 2px | 52×52 #ffe4ec, 2px #1c2240, round, emoji 24px | 99, 100, 101, 102, 103, 104, 106-110, 111, 112 |
| Day | iPad | Calm | as Pop | 64 + 2.5 solid #1c2240; pad 0 18; gap 16; bg #fff | head 28×1 = 28px 700 #1c2240, min-width 220, "Tuesday 6 Oct" | (the date-title) | as Pop, shadow 2px 2px 0 | span selected #1c2240 / #fff | 52×52 #ffe4ec, 2px #1c2240, round, emoji 24px | 99-112, 615 |
| Day | phone | Pop | "Week", ◀ · date · ▶, badge (no span, no 📑) | 60 + 2.5 solid #1c2240; pad 0 10; gap 6; bg #fff | — (the date is the centre) | date, body 20px 600 #1c2240, flex 1, "Tue 6 Oct" | "Week" 52×52 #fff, 2px #1c2240, r14, shadow 3px 3px 0, body 15px; ◀ ▶ 52×52 plain (no box), 16px | — | 52×52 #ffe4ec, 2px #1c2240, round, emoji 24px | 146, 147, 148, 149, 150, 151, 156 |
| Day | phone | Calm | as Pop | 60 + 2.5 solid #1c2240; pad 0 10; gap 6; bg #fff | — | date, body 20px 600 #1c2240, flex 1, "Tue 6 Oct" | as Pop, shadow 2px 2px 0 | — | 52×52 #ffe4ec, 2px #1c2240, round, emoji 24px | 146-151, 615 |
| My money | iPad | Pop | ◀, tabs · — (spacer) · ?, badge; no title, no date | 72 + 2.5 solid #1c2240; pad 0 18; gap 16; bg #fff | — (the tabs name the page) | — | ◀ 54×54 #fff, 2px #1c2240, r14, shadow 3px 3px 0, 18px; ? 54×54 #fff, 2px, r14, shadow, body 24px 600 | tabs gap 10: pills min-height 54, pad 0 22, gap 8, r999, 2px #1c2240, head 26×1.1 = 28.6px 700; "💰 My money" selected #ffc83d / #1c2240, "🎓 Money school" #fff | 54×54 #ffe4ec, 2px #1c2240, round, emoji 26px | 163, 168, 169, 170, 171, 172, 174, 175, 176 |
| My money | iPad | Calm | as Pop | 72 + 2.5 solid #1c2240; pad 0 18; gap 16; bg #fff | — | — | as Pop, shadow 2px 2px 0 | pills head 26×1 = 26px 700; selected #1c2240 / #fff | 54×54 #ffe4ec, 2px #1c2240, round, emoji 26px | 168-176, 615 |
| My money | phone | Pop | ◀, joined tab switch (flex 1) · — · ?, badge | 64 + 2.5 solid #1c2240; pad 0 8; gap 6; bg #fff | — | — | ◀ 52×52, 16px; ? 52×52 body 22px 600 | one switch flex 1, 2px #1c2240, r14: selected cell flex 1, h48, gap 6, body 18px 600 nowrap "💰 My money" #ffc83d / #1c2240; other 52×48, divider 2px, 🎓 21px | 52×52 #ffe4ec, 2px #1c2240, round, emoji 24px | 184, 185, 186, 187, 188, 190, 191, 195 |
| My money | phone | Calm | as Pop | 64 + 2.5 solid #1c2240; pad 0 8; gap 6; bg #fff | — | — | as Pop, shadow 2px 2px 0 | selected #1c2240 / #fff | 52×52 #ffe4ec, 2px #1c2240, round, emoji 24px | 184-191, 615 |
| Meeting row 1 | iPad | Pop | girls (gap 8), title · steps switch · 🗣️; no badge | 62 + 1.5 dashed #f1e5c8 (grid); pad 0 18; gap 16; bg #fff | head 28×1.1 = 30.8px 700 #1c2240, "Family meeting" | steps: one switch 2px #1c2240, r14; cells h48, pad 0 18, body 18px; "✓ The week", "The money", "Close"; dividers 2px | 🗣️ 52×52 #fff, 2px #1c2240, r14, shadow 3px 3px 0, 22px | "The money" selected 600 #ffc83d / #1c2240 | girls: chosen 52×52 #ffe4ec, 2.5px #1c2240, round, ring 0 0 0 3px #ff5c8a, emoji 24px; other 52×52 #fff, 2px #1c2240, emoji 24px | 207, 208, 209, 210, 212, 213-218, 220 |
| Meeting row 1 | iPad | Calm | as Pop | 62 + 1.5 dashed #dde3ee (grid); pad 0 18; gap 16; bg #fff | head 28×1 = 28px 700 #1c2240 | as Pop | as Pop, shadow 2px 2px 0 | selected #1c2240 / #fff | as Pop (ring #ff5c8a) | 207-220, 615 |
| Meeting row 2 | iPad | Pop | "✓ Guess › [Payday] › I choose › Signed" · — · "Week of Oct 5 – 11" | 44 + 2.5 solid #1c2240; pad 0 18; gap 10; bg #fff; body 18px #1c2240 | — | — | Payday pill pad 4px 14px, #ffc83d / #1c2240, 2px #1c2240, r999, 600; week 600 | — | — | 222, 223, 224, 225, 226, 227 |
| Meeting row 2 | iPad | Calm | as Pop | 44 + 2.5 solid #1c2240; pad 0 18; gap 10; bg #fff; body 18px #1c2240 | — | — | Payday pill #5b4fd6 / #fff | — | — | 222-227, 615 |
| Meeting row 1 | phone | Pop | girls, steps switch · — · 🗣️; no title | 60 + 1.5 dashed #f1e5c8 (grid); pad 0 10; gap 6; bg #fff | — | steps: cells 46×48; "✓" body 18px, "2", "3" body 19px; dividers 2px | 🗣️ 52×52, 21px | "2" selected 600 #ffc83d / #1c2240 | girls 52×52, emoji 22px, chosen 2.5px + ring 3px #ff5c8a | 235, 236, 237, 238-243, 245 |
| Meeting row 1 | phone | Calm | as Pop | 60 + 1.5 dashed #dde3ee (grid); pad 0 10; gap 6; bg #fff | — | as Pop | as Pop, shadow 2px 2px 0 | selected #1c2240 / #fff | as Pop | 235-245, 615 |
| Meeting row 2 | phone | Pop | "✓ Guess › [Payday] › I choose › Signed"; no week | 44 + 2.5 solid #1c2240; pad 0 12; gap 6; bg #fff; body 16px #1c2240 | — | — | Payday pill pad 2px 10px, #ffc83d / #1c2240, 2px, r999, 600 | — | — | 247, 248, 249, 250 |
| Meeting row 2 | phone | Calm | as Pop | 44 + 2.5 solid #1c2240; pad 0 12; gap 6; bg #fff; body 16px #1c2240 | — | — | Payday pill #5b4fd6 / #fff | — | — | 247-250, 615 |
| Sister Sync | iPad | Pop / Calm | as Today, kept as built: title · — · badge (no date) | as Today | head 30×hs, as Today, "Sister Sync" | — | — | — | as Today | 43 (follows Today), 49-52 |
| Sister Sync | phone | Pop / Calm | as Today, kept as built; "Sister Sync" on one line at 375 | as Today phone | head 26×hs, as Today phone | — | — | — | as Today | 43, 122-125 |
| Print | iPad | Pop / Calm | as Today, kept as built: back ◀, title "Print Week" · — · 🖨 Print; no badge; not printed | as Today | head 30×hs, as Today | — | as built (◀ and 🖨 Print 52px) | — | — | 43 (follows Today), 49-52 |
| Print | phone | Pop / Calm | as Today, kept as built | as Today phone | head 26×hs, as Today phone | — | as built | — | — | 43, 122-125 |
