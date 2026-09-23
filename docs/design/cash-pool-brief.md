# Design brief — "💧 My cash pool" (Weekly-Planner · My money page)

Paste everything below the line into Claude Design.

---

## What I need

A **picture of a child's money as a pool of water**, for the top of the "My money"
page of a family planner app. The picture must show how money moves, not how much
there is in total. Two children use it (sisters, school age), usually on an iPad,
with a parent beside them at a weekly family meeting.

Please design:

1. **iPad Pro 11″ landscape, 1194 × 834.** This is the main screen.
2. **Phone portrait, 390 wide.** Same content, stacked.
3. **States:** a normal week · a week where nothing came in · a pot still locked ·
   one pop-up open (the "Jobs" pop-up).

## The picture — what flows where

```
   INLET  ─────►   ( THE POOL = her cash )   ─────►  OUTLET
   what came in                                       what went out
   · Jobs (chores)                                    · Loan payment
   · Routine streak                                   · Spending
   · Competitions                                     · Fines (thin stream)
   · Gifts
                     ╎                     ▲
                     ╎  dashed loop         ╎
                     ▼                     ╎
          Kept ready · Locked away · In companies
          (money she has put to work — still hers,
           and it can come back into the pool with interest or a sale)
```

- **Inlet** on the left: one stream for each source, each labelled with its amount
  for the period. Streams with $0 are drawn faint, not hidden.
- **The pool** in the middle is **her cash**, the money she can use right now.
- **Outlet** on the right: the loan payment, spending, and fines as a thin stream.
  The loan payment is the main outlet: she is paying back a sports loan the way
  grown-ups pay a mortgage.
- **The dashed loop** leaves the pool, goes into the three "put to work" pots, and
  returns to the pool. It is **dashed because the money is still hers**. Label the
  way out "put away" and the way back "came back". This is the one idea the picture
  has to teach.
- A small **Week / Month** switch sits above the picture. It opens on **Week**
  every time. Every figure in the picture changes with it.

## Under the picture — four small pot tiles

`Cash` · `Kept ready` · `Locked away` · `In companies`

- Each tile shows an icon, the name and its own amount.
- A locked tile shows what opens it, e.g. "🔒 Opens when 40% of the loan is paid",
  and is drawn quieter.
- A small button **"Ask to move some"** sits beside or under the tiles.

## Rules — please do not break these

1. **No added-up total anywhere.** Never "Everything I have: $50". The children
   should read the flow, not a grand total. This is the most important rule.
2. The loop is **dashed**. Inlet and outlet are solid.
3. **Owing is never red.** The loan is a fact, not an alarm. Use violet for the loan.
4. **Every stream, the pool and every tile can be tapped.** Each opens a pop-up
   card over the page:

   | Tap | Opens |
   |---|---|
   | Jobs | 💷 What things pay (the chore price list) |
   | Competitions | 🏆 The competition calendar |
   | Gifts | 🎁 Gifts she has been given |
   | Loan payment | 🔓 What paying it opens |
   | Cash tile | 🎯 Her saving goal |
   | Kept ready / Locked away / In companies | That idea explained in one short thought (what · why · what to watch) |

   Design one pop-up (Jobs) in full. For the others, the frame is enough: they
   reuse existing cards.
5. The figures in the words must equal the picture. If a caption says $12, the
   stream is drawn as $12.
6. Stream widths may reflect amounts, but give every non-zero stream a minimum
   width so a $1 stream is still tappable (at least 44 px touch target).
7. The pot names, the pop-up contents and the order of the four tiles stay exactly
   as written here.

## Where it sits on the iPad page

The page has the app's own header and a tab bar, about 120 px, then three columns.
Suggested layout (improve it if you can):

- **Left and middle columns:** the pool picture with the four tiles under it.
- **Right column:** a separate **target card** (week/month earnings toward a
  yearly target — keep it visually separate from the pool), then **🏆 Competition
  calendar** and **🎁 Gifts** as small cards. These two also open from the inlet.
- **Below the pool:** the **loan** card and **spending** card.
- At most six cards on the iPad screen, and nothing scrolls sideways.

## Look and feel — match the app

- Hand-drawn, warm, paper-like. Page background `#fef9ef`, cards `#fffdf5`,
  hairlines `#e8dfc3`, ink `#2a2320`, secondary ink `#6b5d4f`, accent `#ff7b54`.
- Card radius 18 px; flat offset shadow `3px 3px 0 rgba(42,35,32,0.15)`.
- Fonts (Google Fonts): headings **Gochi Hand**; body **Patrick Hand**; hand-written
  notes **Caveat**; numbers **Nunito** 700 for clarity.
- Stream colours already used by the app:
  - Jobs `#95d5b2`
  - Routine streak `#ffd166`
  - Competitions `#ff9eb5`
  - Gifts `#c9a6e8`
  - Fines `#e06666`
  - Loan `#6b5bb5` (violet, never red)
- Pot colours already used by the app:
  - Kept ready `#ffd166`
  - Locked away `#6fb1fc`
  - In companies `#c9a6e8`
  - The pool/cash is water blue, your choice, but it must stay readable against
    `#fffdf5`.
- Text on colour must reach 4.5 : 1 contrast. The picture must still make sense in
  greyscale: label every stream in words, not by colour alone.

## Sample figures (illustrative, not real)

One week for one child:

| Stream | Amount |
|---|---|
| **Came in** | |
| Jobs | $14.00 |
| Routine streak | $3.00 |
| Competitions | $0.00 |
| Gifts | $20.00 |
| **Went out** | |
| Loan payment | $6.00 |
| Spending | $4.50 |
| Fines | $1.00 |
| **Dashed loop** | |
| Put away | $10.00 |
| Came back | $0.40 |

Pots:

| Pot | Amount |
|---|---|
| Cash | $22.00 |
| Kept ready | $10.00 |
| Locked away | $12.00 |
| In companies | $6.00 — 🔒 opens at 40% paid |

Loan: **$1,000**, of which **$300** has been paid (30%).

## What I will do with it

I will sign off one design. It is then built into the app, where the real figures
come from the app's money records. So please keep every element nameable, e.g.
"inlet stream: Jobs" or "pot tile: Locked away", so each can be matched to its data.
