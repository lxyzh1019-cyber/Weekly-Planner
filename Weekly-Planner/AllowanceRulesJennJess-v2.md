# OUR FAMILY RULES

**For Jenn and Jess**

*Money is not a prize. It's proof you did the work.*

---

## PART 1 — This Is Just How We Live *(no money)*

| What | Standard |
|---|---|
| Morning routine | Teeth + face, 10 minutes. **Set your own timer.** — Test: none |
| Evening routine | Done before bed, on time — Test: none |
| Bag + gear | Packed the night before — Test: none |
| **Personal chores** | Your room, your bed, your things, your school bag. **These are yours. They are never paid.** — Test: none |
| **First 2 household chores each week** | **You pick which two.** They belong to the family — nobody gets paid to be part of this house. — Test: money.test.js "the first two chores each week are free" |

**Routines. Personal chores. Two household chores.** That's the floor. None of it earns money, and none of it is optional. — Test: money.test.js "the first two chores each week are free"

**Miss a routine and that day doesn't count toward your streak.** One missed day a week won't break the run; a second one starts it over. That's the cost. Nothing else happens. — Test: money.test.js "the forgiving day counts as kept"; money.test.js "a second miss ends the run"

**Genuinely sick — actually in bed, not at school — pauses everything.** Streaks hold, chores aren't expected, nothing counts against you. Being unwell is not a discipline problem. — Test: none

---

## PART 2 — Money You Earn

### HOUSEHOLD CHORES — every one after your first 2 of the week

You pick your two free ones from the chore pool at Sunday. **Every chore in that pool is worth about the same effort**, so there's no clever pick — choose whichever you like and get on with it. — Test: none

| Result | Pay |
|---|---|
| On time **and** to standard | **$3** — Test: money.test.js "a chore on time and to standard pays $3" |
| To standard, but late | **$2** — Test: money.test.js "a chore to standard but late pays $2" |
| Not to standard → **redo it**, then to standard | **$1** — Test: money.test.js "a passed redo pays $1" |
| Not done, or fails the redo | **$0** — Test: money.test.js "a chore not done pays nothing" |

**"On time" is written on the chore itself.** Dishes have a different deadline than laundry, and laundry has a different deadline than taking the bins out. Each chore carries its own — check the card, not the clock. — Test: none

Maximum **$3 per day.** Anything past that earns **XP instead of money** *(Part 6).* — Test: money.test.js "the daily chore cap is $3"

**Who decides: Mom.** — Test: smoke.js kidCannotGradeChores

### LEARNING

**Homework earns XP, not money.** It's your own work, not a job for the house — so it still counts, it's still checked on Sunday, and it still goes on your record. It just isn't paid in dollars. — Test: money.test.js "a quiet week nets $1 — both chores are free, homework pays nothing, and the forgiving day makes a 3-day run (Plan v5 Deviation 30; was $0)"

| Task | Requirement | Earns |
|---|---|---|
| Math homework | 3 pages of +/−/×/÷ — neat, correct | **XP only** *(Part 6)* — Test: money.test.js "a quiet week nets $1 — both chores are free, homework pays nothing, and the forgiving day makes a 3-day run (Plan v5 Deviation 30; was $0)" |
| Handwriting | 5 pages of characters, letters, or numbers | **XP only** *(Part 6)* — Test: money.test.js "a quiet week nets $1 — both chores are free, homework pays nothing, and the forgiving day makes a 3-day run (Plan v5 Deviation 30; was $0)" |
| Chinese | 10 new words or characters you actually know | **XP only** *(Part 6)* — Test: money.test.js "a quiet week nets $1 — both chores are free, homework pays nothing, and the forgiving day makes a 3-day run (Plan v5 Deviation 30; was $0)" |
| Learning game / app | Clear a level | **XP only** *(Part 6)* — Test: none |

**It has to be new material** — work you didn't already know how to do. Not to standard? Redo it, then it counts. — Test: none

**Every Sunday Mom picks 3 things at random from your week and asks you.** Can't answer → that one doesn't count and you do it again. Ten words you still know on Sunday are worth more than fifty you forgot by Thursday. — Test: none

**Who decides: Mom.** — Test: none

### STREAK — routines on time, every day

| 3 days | 5 days | 7 days |
|---|---|---|
| **+$1** | **+$2** | **+$3** — Test: money.test.js "3 clean days pays $1"; money.test.js "5 clean days pays $2"; money.test.js "7 clean days pays $3" |

Counted **by day**. **Highest one only** — they don't add together. — Test: money.test.js "the streak pays the highest tier only, never the sum"

**One missed day a week won't break your run** — the run carries across it, but that day doesn't count as a clean one. So six clean days and one miss is a run of 6, and a full 7 still means seven. **Miss a second day and the run starts over**, but **your best run of the week is the one that pays.** Resets every Sunday. — Test: money.test.js "6 kept + the forgiving day pays $3"; money.test.js "a second miss ends the run"

**Who decides: your own card, checked Sunday.** — Test: none

---

## PART 3 — Competition Days

| | Pay |
|---|---|
| Swim — per point | **$1** — Test: smoke.js competitionMoneyReachesThePool |
| Qualify for Provincials | **+$20** — Test: smoke.js competitionMoneyReachesThePool |
| Provincials — per point | **$2** — Test: none |
| Skating — per point | **$1** — Test: smoke.js grandmaPaysAMeetOnTop |
| Skating placement — in your group (1st/2nd/3rd) | **$20 / $10 / $5** — Test: none |
| Skating placement — overall (1st/2nd/3rd) | **$20 / $10 / $5** — Test: none |
| Dance STAR 5 — Silver / Gold per item | **$1 / $2** — Test: none |
| Dance — all Gold | **+$10** *(dance test max $30)* — Test: none |

Both skating placements can stack. **No cap on points.** — Test: smoke.js competitionMoneyReachesThePool

**Who decides: the official results sheet. Not Mom, not Dad, not you.** — Test: none

> **One rule, and it never bends: we do not talk about money before or during a competition.** — Test: none
> You swim and you skate because you love it. Money is Sunday paperwork.

---

## PART 4 — Your Sports Loan

Your sport costs a lot. You borrow 10% of it from Dad — and you pay it back. — Test: none

| | Jenn | Jess |
|---|---|---|
| Your loan this season | **$1,000** | **$800** — Test: smoke.js loanMigratesToDebtsIntact |
| Down payment — **Oct 1** | $300 | $240 — Test: none |
| Each month after (10 months) | $70 | $56 — Test: none |

### LOAN TERMS

| | |
|---|---|
| Pay on schedule | **No interest. Ever.** — Test: none |
| Miss a payment | **5% per month, simple interest**, on the part you still owe — Test: none |
| Pay extra, any amount, any time | **10% comes off whatever you pay early** — Test: sunday.test.js "below 20%: that extra is counted at 1 + bonus" |

**Simple interest** means the 5% is charged on what you owe — it never charges interest on the interest. — Test: none

**Pay early and every dollar counts.** Put $100 in early and it clears $110 of your loan. You don't have to wait until you can pay the whole thing off — **any early payment, any size, earns the 10%.** — Test: sunday.test.js "below 20%: that extra is counted at 1 + bonus"

### The Sunday Transfer

Your payment moves **automatically**, at the first Sunday meeting of each month. It is a **monthly** payment — the other Sundays don't charge you again. — Test: none

**The down payment comes first.** Until the deposit is paid, the monthly payments haven't started. You can pay the deposit down in pieces any time before it's due — whatever you put in early is that much less to find on the day. — Test: none

**If you don't have enough that week, you choose:**

1. **Pay what you've got** — the rest becomes overdue and starts earning 5%. — Test: none
2. **Pay nothing this month** — the whole payment becomes overdue. Costs more. — Test: none
3. **Cover it from savings** — pull the difference from your savings or a GIC. No interest charged, but you give up what that money was earning. — Test: none

Three real options with three different prices. **Your call, at Sunday.** — Test: none

**Anything above the minimum is yours to decide** — pay the loan down faster, put it in savings, or invest it. — Test: none

> Your savings account pays interest. Your loan does not. Paying early is a **guaranteed 10%.** Investing might beat that — or might not. **That's your decision to make, and it's a real one.** — Test: sunday.test.js "below 20%: that extra is counted at 1 + bonus"

Recalculated every season. — Test: none

---

## PART 5 — When Things Go Wrong

### The Sunday Box

**Leave something out and it goes in the Sunday Box.** You get it back at the Sunday family meeting — the same sit-down where we settle the week. Want it sooner? One unpaid job, chosen by Mom — and **that job does not count** toward your two free chores. — Test: smoke.js sundayBoxOpensAtMeeting

The job gets **written down and ticked off** when you get the thing back, so "I'll do it later" isn't a way to get it out of the box. — Test: none

*School books, homework and sports gear are never boxed — they go on Mom's shelf and you ask for them.* — Test: smoke.js boxExemptListIsRead

**Box first. Fine on repeat.** The first time something goes in the box that week, that's the whole consequence. **If the same thing happens again in the same week, it's boxed *and* it costs −$1.** Once is a mistake. Twice is a choice. — Test: money.test.js "the Sunday Box repeat costs from the first"

### Fines — −$1 each

**The first two times in a week are a conversation, not a fine.** Every one is written down, and we talk about it. **From the third time in the same week, each one costs −$1.** Twice is a slip. Three times is a pattern. — Test: money.test.js "a behaviour fine is forgiven twice in a week"; money.test.js "the third time costs $1"

| |
|---|
| How you speak to each other, or to us — tone included — Test: none |
| Taking your sister's things without asking — Test: none |
| Screens past the agreed limit — Test: none |
| Being asked twice — Test: none |

**This one costs −$1 every time** — it already is the repeat:

| |
|---|
| Something left out for the second time in a week — Test: money.test.js "the Sunday Box repeat costs from the first" |

**A day never goes below $0.** Fines can take away what you earned that day — they can't put you in debt. **No single bad day wipes out a good week.** — Test: money.test.js "a fine can never create debt"

---

## PART 6 — Honesty

Almost everything here runs on your word. You tell Mom the chore was done to standard. You tell her you know the words.

**We are not there yet.** That's not an accusation — it's where we actually are, and it's the thing I most want to change this year.

**If you claim something you didn't do:**

| | What happens |
|---|---|
| **First time** | Claim is void. Recorded, and we talk about it Sunday. Nothing else. — Test: smoke.js honestyLadderResetsWeekly |
| **Second time** | Claim is void, and **that whole channel pays nothing for the week** — chores or competition, whichever you claimed on. — Test: none |
| **Third time** | Claim is void, and **you lose your choices** for that week — your two free chores land on your **highest**-paying work instead of your lowest, and you can't put extra money against the loan. — Test: smoke.js honestyStep3WithdrawsFreePick |

**The ladder resets every Sunday.** Three strikes in one week takes you to the third step; a clean week starts you back at the first. The strikes stay on the record and we still talk about them — but you are never permanently at step three, and your choices always come back. — Test: smoke.js honestyLadderResetsWeekly

Tell me you didn't do it and nothing happens beyond the ordinary miss. **Owning it always costs less than hiding it.** That is the entire lesson and it is the one I care about most. — Test: none

---

## PART 7 — XP

XP isn't money. It's the record of everything you did that money doesn't capture.

| What | XP |
|---|---|
| Extra household chore, past your $3 day | **20** — Test: none |
| Personal chore done without being asked | **10** — Test: none |
| Learning game / app level cleared | **20** — Test: none |
| Helping your sister with something that isn't yours | **15** — Test: none |
| Full 7-day routine streak | **50** — Test: none |
| Personal best at a competition | **50** — Test: none |

**100 XP = one level.** Levels don't convert to money and they never expire. — Test: none

🐣 Newbie · 🐤 Junior · 🦊 Brave · 🦁 Mighty · 🦄 Legendary · 🌟 Star Hero — Test: none

Money runs out when the loan is paid. **XP is the part that's just yours.**

---

## PART 8 — Sunday, 10 Minutes

Bring your card. We add it up, pay it out, move the loan payment, and set the week. — Test: smoke.js sundayPaydayAddsUp

Your two free chores are always your **lowest-paying** ones, worked out at the end of the week — doing your best work first never costs you money. You choose what happens with anything above your minimum. If you think something was graded wrong, **say so here** — I'll listen properly, and if I got it wrong I'll say so and fix it. — Test: smoke.js freeChoresTakeLowestPaying

**Anything still in the Sunday Box comes back at this meeting.** — Test: smoke.js sundayBoxOpensAtMeeting

**Everything is discussed Sunday. Nothing is argued about on Tuesday.** — Test: none

---

*Routines, personal chores and your first two household chores are just how we live — no reward needed. Money is for the extra: chores, learning, competing. Do those well and consistently and it shows up everywhere else.*

**— Dad**
