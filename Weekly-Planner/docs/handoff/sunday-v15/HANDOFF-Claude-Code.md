# Weekly Planner · Cash Pool: handoff to Claude Code

Prototype handoff for the kids' weekly money ritual (Jenn and Jess, age 10). The three prototype screens are the spec. Build them into the real app in repo `lxyzh1019-cyber/Weekly-Planner` (branch `main`).

## Files to use

| File | What it is |
|---|---|
| `Sunday v15 Screen.dc.html` | The weekly ritual: Guess → Payday → I choose → Sign. **Main spec.** |
| `My Money v2 Screen.dc.html` | Kid's home screen during the week: passbook, pots, loan wall, goal, requests to Dad |
| `Grown-ups v2 Screen.dc.html` | Parent screen: approvals, new commitments, fines, money rules |
| `support.js` | Prototype runtime only. Do not port. |

Older versions (`Sunday v2–v14`, `My Money Screen`, `Grown-ups Screen`, wireframes) are history. Ignore them.

All logic lives in the `<script data-dc-script>` class at the bottom of each file. The template above it is the layout (inline styles only).

### Repo files already linked (from `github.md`)

- `js/23-money-meeting.js`: money meeting / Sunday flow; `mmPlannedCompetitions` feeds the results sheet.
- `js/18-rules.js`: competition scoring (`mrScoreCompetition`).
- `js/24-money-parent.js`: parent rules.
- **Company picker already exists in the repo.** The company is already selected there. Do not rebuild it. Wire the 📈 Companies pot to it.

---

## 1. Money model (agreed)

### Income
- **📅 Steady** (every week)
  - 🧹 Chores: $3 per graded day, max $15.
  - 🔥 Routine streak: 7 days = $3, 6 with a grace day = $2.
  - ⛸️ Assistant job (club PA): $6 per club session attended. This is the biggest steady source. A missed session = $0, **not** a fine.
- **🎲 Bonus** (some weeks)
  - 🏆 Competitions, from the planner's results via `js/18-rules.js`:
    - Swim: $1/point, +$20 qualifying, $2/point at Provincials.
    - Skating: $1/point + group/overall 20/10/5.
  - 🎁 Gifts: only after Dad approves.
  - 💹 Pots earned (interest).
- **🏦 From my bank** (not earning)
  - 🏦 Savings above the $10 safety.
  - 💵 Cash from home.
  - 🔓 Locked money that has come back.
- **➖ Taken off**
  - 📦 Box fine: $0.50 each, logged by Mom/Dad with day + what + who.
  - ⏪ Drawn in advance: cash taken before Sunday. Up to $5/week, set by the `advMax` rule. Can also be entered on payday if she forgot to ask.

### Out (what she places on Sunday)
- **🧱 Loan**
  - 📌 Must pay = monthly × 12 / 52, taken first. Shown as the red dashed line on the pile.
  - 🧱 Extra: each $1 extra counts as **$1.10** off the wall (`wallBonus` 10%).
  - Interest is 1%/yr, added every 4 Sundays.
- **👛 Spend → 💵 Cash out**
  - Capped at a fifth of her share (`spendCap` 20%).
- **🌱 Save & grow**
  - 🏦 Savings: keep 🛟 $10 safety; reachable any time; ~1.5%/yr.
  - 🎯 Goal jar: its own jar, counts in what she owns, **earns nothing**. Overflow goes to Savings.
  - 🔒 Locked away: **4 weeks** (not a year), ~4%/yr, comes back on the Saturday before payday.
  - 📈 Companies: ~7%/yr, can go down. Use the repo company picker.
- **Unlock gates** (% of loan paid): Locked 30%, Companies 40%. Savings is always open.
- Leftover cents go to Savings.

### Rules come from Grown-ups
All rates, caps and gates are stored in `planner-rules-v1`. Never hard-code them: Sunday reads them live.

---

## 2. Sunday flow (Sunday v15)

### Step 1 · Guess
- **Income tiles:** ⛸️ Assistant job is the **first, widest tile**, with the club-session ticks inside it (✓ = $6, missed = $0). Then Chores, Routine, Competitions, Gifts: tap = yes / none.
- **Guess:** stairs from $10 to $60, with "last week" and "my avg" marks.
- **Right pane:**
  - ⏳ "Dad answers first": open requests block payday.
  - 💡 Clues.
  - 🎯 Earning target, set by Dad.

### Step 2 · Payday
- **Money in:** 📅 Steady and 🎲 Bonus groups (3 per row), then 🏦 From my bank with − / + controls.
- **➖ Taken off:** 📦 fine and ⏪ drawn in advance (with − / +).
- **💰 My pile** (coin stack, each coin = $1)
  - Coins coloured by source: 🟩 steady (green), 🟨 bonus (gold), 🟦 bank (blue).
  - Taken-off coins show as dashed ghost coins at the top. No icon on every coin (decided: too busy).
  - Red dashed line = must-pay loan; purple dashed = last week.
  - Sum line with %: `🟩 $18 (44%) + 🟨 $23 (56%) − $1 taken off = $40`. The % is of money in.

### Step 3 · I choose
- **Waterfall:** 3 columns with full titles 🧱 Loan · 👛 Spend · 🌱 Save & grow. The waterfall stays the focal point.
- **Every column has a "?"** that opens an explainer (What / Why / Watch + Chinese line):
  - Loan: "do what I love now, not years from now", with its cost.
  - Spend: spending on things she loves brings happiness.
  - Save & grow: tabs for Savings / Goal / Locked / Companies.
- **Sub-boxes:** labelled, with a colour strip matching the bar segment.
  - **Interaction:** the first tap on a box selects it; every later tap = **+$1**; hold **2 s** = **+$5**, with a red progress bar along the bottom.
  - One **−** per column, next to the amount. No +$1 / +$5 buttons (removed to give the chart room).
  - Flying-coin effect plus glow/fireworks on the matching right-pane tile.
- **Presets:** 🧱 Loan sooner · 🎯 For my goal · ⚖️ Watch it grow (locked until 30%).
- **Info panels:**
  - Sum line: `🧱 + 👛 + 🌱 = total ✓ · 🪙 change → Savings`.
  - "I get / I give up / 💡 Tip" panel. The tip is shown on screen, because there is no hover on an iPad.
- **Right pane:**
  - 🧱 I owe: 100 bricks, now + plan.
  - ✅ What I own: bars for now + this plan + taken out, and the 🛟 $10 line.
  - **The bar scale is fixed when she enters the step:** (biggest pot + her share), rounded to $10. Adding to Savings must not shrink the Locked / Companies bars.
  - 🎯 Goal jar.
- **Signing:** hold to sign. If money is still unplaced, the button shakes and shows "place $X first".

### Step 4 · Signed (one card, agreed layout)
- **One "⇅ Money in & out" card** with diverging bars: out to the left, in to the right, same scale top and bottom.
- **Top · 💰 Money in:** each income line, grouped under Steady / Bonus / From my bank, with bar, % and $.
- **Verdict beside it:** "can I keep this up?"
  - Headline: ✅ I can keep this up · ⚠️ Only just enough · 🎲 A lucky week, not every week · 🚨 Not safe yet.
  - Detail lines:
    - Steady $ and %, and what it is.
    - Steady ÷ must-pay coverage (×).
    - Where the bonus came from, plus the next meet date.
    - This week vs her 4-week average.
    - Bank share, if it's ≥10% (it's not earning).
    - What would replace the bonus: more chore days first (up to the $15 max), then club sessions.
- **Dashed separator.**
- **Bottom · 💸 Money out:** fine, in advance, loan (with what the extra counted as), cash out, Savings, Goal, Locked (with back date), Companies, then In = Out ✓.
- **Verdict beside it:** 🧭 Strategy.
  - **Labels:**
    - 🚀 Fast track: pay now, enjoy later.
    - 🎈 Enjoy now.
    - 🌱 Saver.
    - ⚖️ Balanced.
    - 🚨 Risky: "that is how people go broke".
    - 🎉 Loan free.
  - **Detail lines:** loan split and free-by date (weeks sooner); saved $, goal left and 🛟 status; cash and the cap; next step.
- **Decided: keep the bars horizontal** (not rotated 90°): there are up to 17 labelled rows, and the verdicts sit beside them.
- **Below the card:**
  - "Say it out loud" line: says "I put $X on my loan (it counted as $Y)" and "no cash this week" when cash is $0.
  - Bottom row: ↺ Redo · signature · sticker · Next Sunday →.
- **Right pane:**
  - 📅 Timeline: two layers (steady bottom, bonus top) plus an average line.
  - 🔮 "If every week is like this", 1 wk / 1 mo / 5 mo:
    - "This week I earned".
    - 🧱 I owe (now vs my plan).
    - ✅ I own table: put in / it earns / then. The goal earns "none".

### Milestones
- Crossing 30% / 40% paid shows "🔒 Locked / 📈 Companies is open".
- There is no Savings milestone, because Savings is always open.

---

## 3. My Money (v2)

- **Countdown to Sunday**, plus the chore/routine week.
- **⏳ Asked Dad chips.**
- **🧱 Loan wall:** bricks, rows per item, interest line.
- **Right of the wall:** ✅ What I own **above** 🎯 Goal jar (swapped).
- **🎯 Goal jar has ✏️ New goal:**
  - Sheet: name (text), picture, price (− / + and quick $20 / $35 / $50 / $80). If her jar already has money: "Use it for the new goal" or "Put it in Savings".
  - Sends a `kind:'goal'` request. Dad approves it in Grown-ups ("wants a new goal", **✓ Set it**). Sunday then switches the jar (`goalDef`).
- **📒 My passbook:** the latest **4** Sundays only. Columns: Sunday · 💰 in · wall · saved · cash, all centred. The table is centred vertically in the card.
  - **Two thin bars under each row:**
    - Under 💰 in: steady (mint `#95d5b2`) / bonus (gold `#ffd166`).
    - Under wall / saved / cash: `#b9aef0` / `#ffe08a` / `#ff9eb5`.
  - **Key line:** "💰 in ■ steady ■ bonus · went to ■ wall ■ saved ■ cash", as CSS swatches (not emoji squares; their colours don't match).
  - **= Total row**, plus a note with the date range, earned total, **"a week"** average, steady/bonus %, and the out split. Shares add to exactly 100% (largest-remainder rounding); a share that rounds to 0 but isn't zero shows "<1%".
- **Action buttons:** 🏆 Tell a result (from the planner) · ⛸️ Club sessions (can't make one) · 🔀 Move / 💵 Cash out / put cash in · ⏪ Draw in advance.

## 4. Grown-ups (v2)

- **Approve:** the queue with a check prompt per kind.
  - Kinds: result, gift, move, fine dispute, advance, deposit, skip, **goal**.
  - The move card says "Locked for **4 weeks**".
- **New commitment:**
  - Cost, **Her share** and **Pay it over** each have − / value / + steppers (share in 5% steps, weeks in 1-week steps) plus quick picks.
  - Shows the payment as % of steady money. The limit is 50%.
- **🌧️ Surprise cost:** 🛟 Savings pays first; the rest becomes a wall row.
- **📦 Fines:** preset "What" options plus an **"…or type it"** free-text box.
- **⚙️ Money rules** (`planner-rules-v1`):
  - Removed: "Kept ready opens at" (Savings is always open).
  - Renamed: "Companies", "cash out".
  - "Companies dip 2%" switch: on Sunday, applies −2% to Companies once per week, and the chip says "sell or wait?".

---

## 5. Naming and icons (agreed, use everywhere)

| Thing | Name / icon |
|---|---|
| Loan | 🧱 Loan (never 🏦) |
| Must pay / extra | 📌 Must pay · 🧱 Extra |
| Savings | 🏦 Savings; 🛟 only for the $10 safety line |
| Goal | 🎯 Goal jar |
| Locked | 🔒 Locked away (4 weeks) |
| Companies | 📈 Companies (not "In companies" / "Company") |
| Save group | 🌱 Save & grow / 🌱 saved (**no 🐷 anywhere**) |
| Spend | 👛 Spend (column) · 💵 Cash out (item) |
| Fine | 📦 Fine (not 🦊) |
| Advance | ⏪ Drawn in advance |
| Timeline key | steady / bonus (not "earned / bonus") |

Words stage (Grown-ups): 1 = earn · save · owe; 2 = + income · interest · cash flow; 3 = + assets · debt · net worth.

---

## 6. Shared data (prototype localStorage keys, map to the real store)

| Key | Contents |
|---|---|
| `planner-rules-v1` | All rates, caps, gates, `loanRate`, `wallBonus`, `spendCap`, `advMax`, monthly payment per kid, words stage, `wobble` |
| `planner-queue-v2` | Requests to Dad: `{id, kid, kind, status: null/'yes'/'no'/'talk', applied, …}` |
| `planner-fines-v1` | `{id, kid, day, what, who, amt, applied}` |
| `planner-commit-v1` | New commitments / surprise costs |
| `planner-expected-v1` | Expected events per kid (timeline) |
| `sunday-v13` | Per-kid Sunday state:<br>- `left`, `pots{ready,goal,gic,stock}`, `locks`<br>- `book[]` rows `{wk, date, earned, steady, bonus, wall, saved, cash}`<br>- `histCat` (last 4 weeks)<br>- `goalDef`, `extraLoans`, `stickers`, `week` |

**Sync:**
- Approved `move`, `deposit`, `adv` and `goal` items are applied once when Sunday opens (tracked by `appliedIds`).
- "Next Sunday" marks the kid's yes-items and fines as `applied`.

---

## 7. What's verified vs what's open

**Verified in the prototype:**
- Full loop: Guess → Payday → I choose → Sign → Redo → re-sign → Next Sunday, for both kids, with no console errors.
- In = Out balanced.
- The "loan counts as" maths: must-pay + extra × 1.10.
- Fixed bar scale.
- No overflow at 1194×834 (iPad).

**Please test or build in Claude Code (automated tests):**
1. Multi-week runs (8–20 Sundays) for both kids. Check the invariants:
   - In = Out every week.
   - Loan payoff date.
   - Interest every 4 Sundays.
   - Locks returning on time.
   - Goal overflow → Savings.
   - Cents → Savings.
   - Unlock gates crossing.
2. Edge cases:
   - All sessions missed.
   - Zero bonus.
   - Steady < must-pay (🚨 path).
   - Spend cap hit.
   - Advance at max.
   - A forgotten advance entered on payday.
   - Loan fully paid (spill to Savings).
   - Goal reached.
   - New goal with "move" vs "Savings".
3. **Integration with the repo:**
   - Competition results from the planner (`mmPlannedCompetitions` / `mrScoreCompetition`).
   - The **existing company picker** → 📈 Companies.
   - Fines, chores, routine and club attendance from the real data.
   - All Grown-ups tabs.
   - The extra Sunday steps: redo, next Sunday, advance on payday.
4. Data that persists across reloads and devices (the prototype uses localStorage).
5. Rule changes in Grown-ups must change Sunday text and numbers live: rates in hints, caps and gates.

**Known small items (not done):**
- Sample passbook weeks from before the steady/bonus split was saved show earned only.
- Jess's guess-screen story text is fixed ("4 sessions"). Generate it from the data.
- Locked away interest over 4 weeks is tiny (~$0.02 on $5). It's honest, but consider showing the yearly-equivalent too.

## 8. Design rules to keep
- Hand-drawn notebook look:
  - Fonts: Gochi Hand (titles), Patrick Hand (body), Nunito (numbers), Caveat (notes).
  - Colours: cream `#fef9ef` / `#fffdf5`, ink `#2a2320`, 2.5px borders, soft offset shadows.
- iPad first (1194×834). Tap targets ≥ 44px. No hover-only hints.
- The kid's voice is first person ("I owe", "What I own"). Dad's card gives Dad an ASK / SAY / WAIT script per step.
- Every number shown to her must add up on screen (100%, In = Out).
