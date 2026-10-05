# Money screens — build spec (final reference, approved 2026-10-04)

Visual reference: `mockups-6f9.html` (same folder). Each mockup is drawn at the iPad size, **1194 × 834 px**. All sizes below are px at that size, measured from the final mockup. Sample data is the prototype's own week; the build uses real data, mapped in each section.

This spec covers the money screens on iPad width. The phone layout (390 px) stays as the plan says (stacked, one column); it was not drawn in this round.

## 0. Rules for all four screens

**Looks**
- **Pop look.** Paper `#fef9ef` with a 24 px grid (`#f4ead4` lines). Ink `#2a2320`. Cards are `#fffdf5` with a 2.5 px ink border, 14 px radius and a `3px 3px 0 rgba(42,35,32,.16)` shadow.
- **Colours.** Accent `#c14a24`, teal `#2a5f59`, purple `#6b5bb5`, green `#2f7f62`, yellow `#ffd166`, mint `#e4f5ec`, cream `#fff4db`, pink `#ffe9ef`, blue `#eaf4ff`, lavender `#f1edfd`.
- **Calm look.** Gets the same boxes in Calm tokens (house rule).

**Fonts: one font for words and numbers** (owner's words: "same font for text and number").
- Body text and **every number** (money, %, dates, counts): **Patrick Hand**. Amounts are weight 700; plain numbers (%, axis ticks, day amounts) are 400.
- Titles: **Gochi Hand**. An amount sitting in a title row uses Gochi Hand too, for example "$700.00 left", "$78.01", "$700.00 → $657.45".
- Handwriting lines only: **Caveat** — the date "Sun 4 Oct", "Jenn ✓ · 4 Sundays signed", "$35 — it's more!", "Say it out loud", the "Jenn ✓" signature.
- No Nunito anywhere on these screens.
- Patrick Hand has no tabular figures (`font-variant-numeric: tabular-nums` does nothing). Right-align every money column.
- Text sizes follow the prototype: names 16–17 px, amounts 18–19 px, hints 13–14 px.

**Boxes**
- **Tap buttons:** at least 44 px tall, thick border and shadow, text centred. My money's action buttons are 66 px and its header buttons 54 px.
- **Information boxes:** thin edge or none, no shadow.
- **Doors:** a green dashed-underlined line or list row with ▸, with a 44 px hit area.

**Words**
- Never "Dad" on screen: say "parents" or "Parent's card" (Deviation 38).
- **"Competitions"**, never "Prizes" (🏆).

**Space**
- No empty bands inside or under cards. The only visible grid is the 10–14 px gaps between cards.

**Family meeting header** (Payday, I choose, Signed): two rows, 106 px total, `#fffdf5`, 3 px ink rule under it. There is **no bottom bar**; ◀ Guess / Now I choose → move between steps.
- **Row 1** (56 px): 🐥 Jenn and 🦊 Jess as round 36 px pictures with names under them. Tapping one switches girl; the signed girl gets a green ✓ badge. Then "👨‍👧‍👧 Family meeting" (Gochi 22), then pills 1·The week · 2·The money · 3·Close (44 px; done = mint, current = accent). "Week of Sep 28 – Oct 4" is right-aligned.
- **Row 2** (49 px, tint `#f8f2e4`): "2 · The money for Jenn:", steps 1 · Guess · 2 · Payday · 3 · I choose · 4 · Sign (done = mint, current = accent). Right side: 🔊 Sound on, 🗣️ Parent's card.

**Content area** (meeting screens): main card at x 14, y 112, 796 × 716. Right side at x 824, y 112, 356 × 716.

## 1. My money (kid Money tab)

Approved in round 7 and changed only by the font pass.

**Header and screen**
- Header: one row, 72 px.
  - ◀ (54 × 54, goes back to Today), 💰 "My money" (Gochi 28).
  - Tabs **💰 My money** (accent) / **🎓 Money school** (54 px).
  - Right side: **📖 My money story**, **? How this page works** (54 px), then the date "Sun 4 Oct" (Caveat 26, `#5a4d41`).
- **No second tab row. The kid bottom bar is hidden on this screen.**
- Left column x 14, y 82, 800 × 744. Right column x 828, 352 × 744.

**Left column, top to bottom**
1. **Countdown card** (800 × 121, cream).
   - 🌞 "Sunday is today!" (Gochi 30) with "payday guessing game, together on the iPad" under it.
   - The **M…S day circles** (32 px, ✓ or ·, "$3" or "—" under) start right after the title block and spread across the rest of the card, so there is no gap.
   - Bottom line: door "📊 This week so far $48.00 ▸" (sheet: 💪 earned with 🏠/⛸️/🏆 lines, 🎁 given, 🌱 made, ➖ taken off), and on the right "🧹 about $18.00 of chores so far. The guess is on Sunday."
   - Data: the money week Sun–Sat (Deviation 34), chores and routine streak, pending requests.
2. **Asked parents strip** (800 × 48, `#fffdf5`, thin border).
   - "⏳ Asked parents", then up to two request chips (44 px; waiting = dashed, done = mint).
   - "+N more · see all" button opens a sheet with every request, gift requests included.
   - Data: the request queue (`req:`, `mvq:`, `dep:`), status per request.
3. **Loan wall card** (423 × 480; 24 px space above the title).
   - "🧱 My loan wall" (Gochi 31) and "$700.00 left" (Gochi 27, purple) — this appears **once**.
   - Wall: 100 bricks, **11 px tall**, 4 px gaps, 10 per row. Paid bricks green `#95d5b2` with a solid edge; the rest dashed.
   - **Summary block** (lavender): paid $300.00 · 30% · $16.15 a week · free by Aug 2027 · late costs $0.00 · "🟥 interest 1% a year · +$0.54 added last time" in red. The red interest line lives here.
   - **Two largest loans** as 44 px door rows (name · paid bar · "$380.00 left" ▸). Each opens **that loan only**: left (of borrowed), each month, paid off by, interest so far, early bonus earned, late costs, paid bar, and a link to "All loans side by side".
   - "＋ 1 more loan" and the door **"3 loans · Details · side by side ▸"**. It opens a table with one column per loan plus an **All** column (rows: left, borrowed, each month, paid off by, interest so far, early bonus, late costs) and paid/left bars for each loan on one scale.
   - Data: the loan rows (left, principal, weekly must-pay, payoff date, interest added, bonus, late costs).
4. **What I own card** (365 wide, blue; 24 px space above the title).
   - "✅ What I own" (Gochi 28) and "$25.00 with 🎯".
   - Info boxes (no button look): 🏦 Savings $20.00 "🎯 $8 inside · 1.5% a year"; 🔒 Locked away $5.00 "back Sat, Oct 3 · 4% a year"; 📈 Companies (dimmed, "opens at 40% paid").
   - Door "📥 Waiting for Sunday $5.00 ▸". It shows only when above $0 (Deviation 37; data key `wallet.cash`).
   - **No Cash tile.** Goal jars are counted inside Savings for display only.
5. **Goal card** (pink).
   - Jar drawing, "🎯 New skate guards", "$8.00 of $35.00", "about $3.38 a week · by Nov 28", "⏳ asked parents: 🎒 Skate bag · $30".
   - Two small 44 px icons: **＋** (new goal request to parents) and **⋯** (my goals; she picks which goal this card shows).
   - **No "next goal" line.**
6. **Four action buttons**, 193 × 66 px each, two lines (20 px title, 14 px note):
   - 🏆 Tell a result / from my planner
   - ⛸️ Club sessions / $6 each I go to
   - 🔀 Move · 💵 Cash / move · cash out · put in · draw early
   - 🎁 I was given / a gift or cash
   - **Move · Cash sheet** has four modes: 🔀 Move · 💵 Cash out · 🏦 Put cash in · **⏪ Draw early** (amount −/+, reason chips, "Send to parents").
   - **No limit text** for Draw early; the weekly cap rule stays in the data (`advance.maxPerWeek`) and is just not shown.

**Right column**
- **📒 My passbook** (352 × 426), as the prototype.
  - Centred table with centred column titles: Sunday · 💰 in · wall · saved · cash.
  - Four Sundays; each row has its "in" bar split earned/given/made (Deviation 40) and an out bar wall/saved/cash.
  - "= Total" row, a summary sentence, "Jenn ✓ · 4 Sundays signed" (Caveat), and a 📖 "all my Sundays" icon.
- **📅 Coming up** (246 px): six rows (club sessions, competitions, holidays with "parents expect ~$X") and a "🗓️ Month ▸" door.
  - The month calendar: tap a finished competition to see its result; a planned one says "results after the day"; an empty day asks "Add a competition?" and opens the planner's add sheet (Deviation 39).
- **⭐ Stickers** strip (52 px).

## 2. Payday (Sunday step 2)

Approved in round 5 and changed only by the font pass.

**Main card** (796 × 716)
- Title row (38 px): ☀️ "My payday" (Gochi 30) and "$35 — it's more! · 4 of 4 sources right" (Caveat).
- Body (596 px): left column (Money in + Taken off), then **My pile** (214 wide, full height).
- Footer (44 px): ◀ Guess · "📌 Loan first $16.15 ($70 a month) · then $60.86 is mine" · −/+ (parent control for must-pay) · **Now I choose →**.

**Money in**, four income groups (pick S1)
- **💪 Money I earned**: rows of 44 px payday-line buttons (196 wide, centred, with sticker tags), each with its working beside it.
  - 🏠 Home (chores + routine · *every week*)
  - ⛸️ Club job (sessions · *every week*)
  - 🏆 **Competitions** (result name)
  - Each line opens its explainer sheet.
- **🎁 Money I was given** (gifts) and **🌱 Money my money made** (pots interest), side by side.
- **🏦 From my bank**, as the prototype: header with a note ("📥 $5.00 waiting · a lock came back") and total, then two boxes, **🏦 From Savings** ($2 free) and **🏠 From home** (cash I bring in), each with −/+.

**➖ Taken off**, as the prototype
- Header ("fines · cash I drew before Sunday", total in red).
- Two boxes: 📦 Box fine (day + item, amount) and ⏪ Drawn early (amount, "forgot to ask? tap +", −/+).

**My pile**
- The prototype's coins: radial-gradient discs labelled "$1", 5 per row, filling the card. Colours by group: earned green, given gold, bank blue, fine dashed red 📦.
- The **y-axis sits on the right** of the coins, with $10 ticks on its outer side and no gap.
- Dashed red "📌 loan first $16.15" line.
- Under the pile: each group's **share in %** (earned 62% · given 32% · bank 6% · taken off −1%).

**Right side**
- **🔥 My week** (fire circles).
- **📊 My last 4 Sundays**: rows are exactly the left side's groups — 💪 Money I earned (🏠 / ⛸️ / 🏆 Competitions) · 🎁 Given · 🌱 Made · 📥 From my bank · ➖ Taken off · = Total. Columns 4 wk / 3 wk / 2 wk / last / now / avg. "now" includes the bank, so the sample total is $77.
- **🏆 🎁 Results & gifts.**

## 3. I choose (Sunday step 3)

The prototype's **waterfall**. The only change from the prototype: the pot boxes become one legend column.

**Main card** (796 × 716, padding 8)
- Top row (44): 💰 **$77.01** pile chip (no makeup line) · "🤝 What I do with it" (Gochi) · **✍️ Hold to sign** (220 px, one line). Press and hold for 1.4 s; it works only when 100% is placed.
- Strategy row (44): ◀ My pile · 🧱 Loan sooner · 🎯 For my goal · ⚖️ Watch it grow · ↺ All back · 📊 Everything.
- Columns row (470): **three equal columns, 198 px each** (🧱 Loan, 👛 Spend, 🌱 Save & grow), then the **legend column, 163 px**.
  - Column: title row (Loan / Spend Gochi 26 px, Save & grow 24 px); amount row (amount, % pill, **? 44 px** — moved here so the bigger titles fit).
  - Waterfall area: Loan's block fills from 0 to its %, Spend's starts at Loan's top, Save & grow's starts above Spend. A dashed level line, the block made of pot segments with icons, and a one-line note under it ("🧱 each $1 extra = $1.10 off", "👛 up to $12 · a fifth", "🏦 $10 safety first").
  - Legend column: a **"−$1"** button (44 px) on top, then 7 pot rows (32 px look in a 44 px tap area): 📌 Must pay (dashed, fixed) · 🧱 Extra · 💵 Cash out · 🏦 Savings · 🎯 Goal · 🔒 Locked · 📈 Companies (dashed "🔒" until open at 40% paid). No instruction text.
- **Tapping:** the first tap on a pot picks it; the second adds $1, and a coin flies from the pile to it (no coins under reduced motion). "−$1" takes $1 from the picked pot. Must pay can't go lower; Cash out is capped at a fifth of her share.
- Sum line: "🧱 $40.15 + 👛 $0.00 + 🌱 $36.86 = $77.01 ✓ · 86¢ change → Savings".
- I get / I give up / Tip box (prototype), updated for the last pot touched.

**Right side** (356 wide)
- Label "💼 What I have & owe".
- **🧱 What I owe** (315 px), the prototype's card. Title 24 px; body text 1.1× (16.5 px; amount 18.7 px).
  - "$700.00 → $657.45" in purple.
  - **Thin bricks**: 10 px, 2–5 px gaps, dashed until paid; green = paid; yellow with a **2 px orange-red outline** = this plan; a red sliver = interest.
  - Lines: "🟩 paid · 🟨 this plan · free by Jan 2027 · 3 loans", "📌 $16.15 must pay + 🧱 $24.00 extra (counts $26.40)", "🟥 +$0.54 interest added (1% a year, every 4 Sundays)".
  - The whole card gets an orange border while Must pay or Extra is picked.
- **✅ What I own** (260 px), the prototype's card. Title 24 px; body text 1.2× (names 19.2 px, values 19.2 px, change 16.8 px).
  - Key: now / this plan / **taken out** (striped) / $10 safety line.
  - Rows: Savings (bar now + plan, change, value), Locked away (striped "taken out", −$5.00), Companies.
  - Note "$10 safety + $X I can use · 🎯 goal jar $35.00 counted in the total".
- Height ratio What I owe : What I own = **1.21**.
- **🎯 Goal card** (85 px).

**Data:** her pile = payday + bank pulls − taken off; must-pay; pots (`ready`, goal, `gic`, `stock`); the gates (Savings at 20%, Companies at 40%); spend cap; loan state; goal target.

## 4. Signed (Sunday step 4)

**Main card** (796 × 716)
1. **Step header** (84 px, **no fill**).
   - ✍️ "Signed. This is my plan." (Gochi 30), 🐥 Jenn ✓ signed Sun 4 Oct · 4:12 pm, money week Sun 27 Sep – Sat 3 Oct · Week 1.
   - **MY PLAN** stamp (rotated, red border).
   - "⭐ Sticker: …" (information), **↺ Redo my plan** (undoes this girl only).
   - No bottom row: "Jenn ✓" and "Next Sunday →" would repeat the header.
2. **⇅ Money in & out** (355 px), the prototype's chart.
   - 22 px rows; 14 px bars growing from a 2.5 px middle line (out to the left, in to the right, rounded at the outer end).
   - Money in rows: 💪 Money I earned (bold, no bar) with 🏠 Home / ⛸️ Club job / 🏆 Competitions indented, 🎁 Money I was given, 🌱 My money made, 📥 From my bank.
   - Money out rows: 📦 Fine, 🧱 Loan · counts $X, 🏦 Savings, 🎯 goal (indented).
   - Two verdict boxes beside the halves: "🎲 A lucky week, not every week" and "🧭 🚀 Fast track", each with a two-line summary and **▸ Why** (a sheet with the full reasons).
3. **📉 What I owe vs what I own** (162 px). Line chart: 🧱 owe (purple) and ✅ own (green); the gap between them shaded and labelled.
   - **Window:** the last 8 Sundays including today. Older Sundays are left out, with "◀ N older Sundays in 📒".
   - **Forecast:** dashed lines from the signed point, using this week's numbers.
     - If the loan is free **within 13 Sundays (3 months)**, run to the payoff Sunday labelled **"free by DD Mon"**.
     - Otherwise show **the next 6 Sundays**.
   - **Labels:** thinned so at most 8 show; the signed point and the last point are always labelled.
   - Data: the weekly ledger (loan left and what she owns each Sunday), plus this week's must-pay + extra×1.1 and the save amount.
4. **Say it out loud** (Caveat, dashed teal box).

**Right side**
- **📅 My timeline** (182 px), as the prototype. Title 24 px; legend 15.4 px (earned / given / avg).
  - **Event icons row** (🏆 🏆 🎄 🧧 on their months).
  - Stacked bars (earned below, given on top), past solid; "now" bar outlined red; future dashed and faded.
  - Dashed avg line with label; month labels under the bars.
- **🔮 If every week is like this** (524 px). Title 24 px with **12 px above and 12 px below** it.
  - 1 wk / 1 mo / 5 mo (44 px).
  - "This week I earned … × N weeks, I'd earn …" — **the only bordered box**.
  - Then one filled block with **no gap**: 🧱 I owe (lavender; free by, paying line, now / my plan bars) directly on top of ✅ I own (light green; I put in / it earns / then; Savings, 🎯 skate guards, Locked, Companies, = Total).
  - Goal jar note.

## 5. Decisions carried from earlier rounds (not to be lost)

- **Words:** "parents", never "Dad"; "Competitions"; "📥 Waiting for Sunday" instead of a cash account (Deviation 37).
- **Talk first:** shows an agreed amount at the meeting (Deviation 41).
- **Money week:** runs Sunday–Saturday (Deviation 34).
- **Gates:** Savings opens at 20% paid; Companies at 40%.
- **Drawing early:** cap kept in the rules, not shown on My money.
- **Gift requests:** live in Asked parents / see all; the entry point is the 🎁 I was given button.
- **Redo:** per girl.
- **Corrections:** a parent corrects a result's dollars with −/+ (stored beside her entry).
- **Coins and animations:** CSS only, off under `prefers-reduced-motion`.
