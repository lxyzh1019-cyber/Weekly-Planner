# History comments moved out of js/ and css/ (Stage 45, 2026-10-12)

Part 13 item 8: comments in `js/` and `css/` that only said what used to be there ("… lived here", "… is gone", "retired") were moved here, word for word, so the code reads as it is now. No code changed with them. Each entry gives the file and the line it started on at commit 8a0e0a2. Comments that still explain the code beside them stayed where they are.

## css/app.css

### css/app.css:55-56

```
    /* --day-landscape-chrome lived here: the day screen's chrome height, which
       its three rails each subtracted from the viewport. One scroller now. */
```

### css/app.css:854-855

```
  /* The .day-next-up-banner rules lived here — Today says "now" and "next up"
     once, on its own card. */
```

### css/app.css:856-857

```
  /* The .day-kid-quick-row / .btn-break-quick rules lived here, styling the two
     break buttons that sat permanently on Today. Both are gone. */
```

### css/app.css:1009

```
  /* .week-grid lived here, for the retired compact week view. */
```

### css/app.css:1269-1270

```
  /* .quest-today-card and its parts lived here — the Quest Board's summary of
     today, and its door through to the real list. Today IS the list. */
```

### css/app.css:1869-1874

```
  /* W2 was here: an icon-only tier for a block too short even for a name, plus
     the --xslim type ramp that went with it (11.84px card text, 12.8px icon —
     both under the 13px floor). Nothing sets either class now. The week's card
     floor is the `name` tier, so the shortest block the app allows says what it
     is instead of rendering as a bare emoji with the name only in a title
     tooltip, which a child on an iPad can never reach. */
```

### css/app.css:1877-1879

```
  /* The .week-legend rules lived here. That legend was parent-only markup inside
     the permanently hidden compact view, so it never rendered; the Day Blocks
     view's .tg-legend-* is the live one. */
```

### css/app.css:1908-1910

```
  /* .timeline-wrap lived here — the inner scroll box between .day-workspace and
     .timeline. Its overflow was the middle of three nested scrollers; the day
     scrolls as one surface now, and .day-workspace is it. */
```

### css/app.css:2121-2125

```
  /* .tl-hour-line and .tl-halfhour-line lived here. Three surfaces each drew
     their own rules — or, in the Day Blocks week, a decorative stripe that named
     no time — and all of them drew them UNDER the blocks, so the grid said
     nothing the moment a day was actually planned. One owner now: buildHourGrid
     in js/05-helpers.js.
```

### css/app.css:2257-2260

```
  /* The ACTIVITY TRAY section lived here: the fixed bottom/side rail of
     activity chips, its filters, its header and its level/lock badges. The
     rail is gone — placement goes through the picker that opens where you
     tap. .filter-chip survives because that picker uses it. */
```

### css/app.css:3400-3404

```
  /* The QUEST BOARD block lived here — #screen-quest's gradient, its topbar,
     the hero card with its own Lv/XP bar, the board header and the quest list.
     The screen is retired (index.html says why); Today carries the hero strip
     it duplicated, as .dq-hero. The sticker collection below moved to Today
     with its ids intact, so its rules stay exactly as they were. */
```

### css/app.css:3470-3473

```
  /* The Quest Board's pocket-money disclosure lived here, and its rules went
     with the retired "how I earn" card for weeks under the old $6-cap group
     model. Today's own money card is the kid-facing summary now, and 💰 My
     money owns the detail. */
```

### css/app.css:3720-3721

```
  /* Hero Mode toggle on profile screen */
  /* .hero-mode-toggle lived here, for a switch that no longer exists. */
```

## css/week-day.css

### css/week-day.css:41-42

```
  /* .week-glance-age and its number input were here, and the 🎂 Age question
     with them. A row per category instead of a wrap of pills: pills have no
```

## js/01-config.js

### js/01-config.js:45-49

```
/* CAT_COLOUR lived here: the same nine categories again, as `var(--cat-*)`
   strings. It had ZERO consumers — a third copy of a colour table that nothing
   ever read, which is worse than a duplicate that drifts, because a duplicate
   that drifts at least shows up on a screen. CAT_HEX below is what the app
   asks, and ACTIVITY_CATEGORIES is what owns the hues. */
```

### js/01-config.js:784-787

```
/* TUTORIAL_STARTER_CHOICES lived here — the three Family Hero chores the
   first-run overlay offered as a "starter" to unlock. Onboarding went with the
   unlock subsystem: its whole content was picking a locked chore, so with
   nothing locked there was nothing left for it to say. */
```

## js/02-state.js

### js/02-state.js:38-39

```
/* dayLandscapeChromeRaf lived here, throttling the day screen's chrome
   measurement. The measurement is gone — one scroller needs no arithmetic. */
```

### js/02-state.js:48-49

```
/* currentZone lived here, for the morning/afternoon/evening day filters.
   Those are gone and the day is always shown whole — see js/08-day-view.js. */
```

### js/02-state.js:50-51

```
/* currentTrayFilter lived here, for the activity rail's category chips. The
   rail is gone; the placement picker keeps its own filter (slotPickerFilter). */
```

### js/02-state.js:59-60

```
/* dayLandscapeFocusPane lived here, dimming one pane of the day screen while
   the other was in use. There is one pane now — the schedule. */
```

## js/05-helpers.js

### js/05-helpers.js:873-877

```
/* openTutorial, chooseTutorialStarter, skipTutorial and offerTutorialIfNeeded
   lived here. They were the first-run flow, and all four existed to hand a
   child one Family Hero chore as an unlocked "starter". Family Hero is not a
   prize any more, so the overlay had nothing to offer: every chore it listed is
   now on the ordinary picker, reachable from the slot she just tapped. */
```

### js/05-helpers.js:1254-1259

```
/* renderDayNextUpBanner lived here. It printed "Now" and "Next up" into the day
   timeline's left rail — the same sentence Today's own card leads with, on a
   screen you had just navigated away from Today to reach. The rail is gone and
   this went with it; Today says it once. Its two side jobs moved rather than
   died: the break row's visibility and the evening wind-down nudge are both in
   tdRenderToday (js/31-today.js), which is where they are read now. */
```

### js/05-helpers.js:1527-1532

```
/* Hero Mode lived here. It began as the choice of landing screen — Quest Board
   or week grid — and Today took that job. Its last remaining duty was gating a
   "Quests" shortcut on Today, and Today became the quest list itself, so the
   toggle ended up switching nothing at all. Removed, and the stored key is
   cleared on boot (js/99-main.js) so it does not linger on the girls' devices.
   HERO_TIERS and the XP ladder are a different feature and are untouched. */
```

## js/06-quests.js

### js/06-quests.js:179-182

```
/* showPocketMoney / togglePocketMoney / renderQuestMoneyStrip lived here. They
   rendered into #questMoneyWrap on the Quest Board, which is gone; Today's own
   money card (tdMoneyChart) is the kid-facing summary now, and 💰 My money is
   still the page that owns the detail. */
```

### js/06-quests.js:227-231

```
/* openQuestDetail lived here: it opened the edit sheet when a kid tapped a
   quest card's body on the Quest Board. The board no longer renders that list —
   the day view's Quest mode does, and its cards already route a body tap
   through onTimelineBlockTap, which knows about routines and training blocks
   as well. */
```

## js/07-week-view.js

### js/07-week-view.js:540-541

```
   onWeekAgeChange was here, behind a 🎂 Age field. Both are gone: the child is
   not asked her age (currentAge answers it), and the parent portal corrects it. */
```

### js/07-week-view.js:1118

```
   (.tg2-wrap was here for the same reason, for the retired Day Blocks week.) */
```

## js/08-day-view.js

### js/08-day-view.js:259-262

```
/* Today's Vibe (renderVibe / setDayMood) lived here: a mood picker folded away
   on Today that wrote dayMoods[currentDayKey]. It is folded into Today's 🌙 How
   was today? row (tdReflectRow, js/31-today.js), which opens the reflect sheet
   with its day passed in (R5 §7 Q3) — one door for the day's mood. */
```

### js/08-day-view.js:2273-2278

```
/* updateDayLandscapeChromeHeight lived here, with its two window listeners. It
   measured the day screen's chrome into --day-landscape-chrome, which the three
   rails each subtracted from the viewport to work out their own max-height —
   the arithmetic that let three panes scroll independently. There is one
   scroller now and it simply fills what is left, so there is nothing to
   measure. */
```

## js/09-sheets.js

### js/09-sheets.js:6-11

```
   buildTray lived here — the Activities rail down the right of the day screen,
   a scrolling grid of every activity in the library. It is gone, and with it the
   pick-then-tap model it existed for: you chose a chip, the rail dimmed, and the
   schedule waited for a second tap. Tapping a time opens the picker right there
   instead, which is the interaction that was already doing the work, and the day
   screen gets the rail's width back.
```

### js/09-sheets.js:1783-1789

```
/* ctAutoCheckOptionalFromBlock lived here: it synced a completed chore block
   into `optionalByWeek`, the retired chore-GROUP store. Nothing downstream
   reads that store any more — not the kid tab, not the parent portal, not
   mrWeekBreakdown — so its only remaining effect was to make a chore look
   handled while it never reached anyone. Completions now route through
   claimChoresFromBlock / gradeChoresFromBlock (js/06-quests.js), which write
   claims and grades against the chore pool. */
```

## js/15-meeting.js

### js/15-meeting.js:1502-1508

```
/* mmRenderCelebrate lived here. Its per-child "wins" list re-derived what the
   week showed — routines, chores, hours, XP — beside the accessors that already
   owned each one. Step 2 asks the child first and offers the same facts as
   evidence underneath, through reflEvidence (js/37-reflection.js), so the list
   became a second answer to a question that now has an owner. The planned-vs-
   completed chart it carried was the celebration half and survives on step 2;
   mm2b and mm2bScale still draw it. */
```

### js/15-meeting.js:1535-1537

```
/* `mmRenderConfirm` (the old "Confirm & record" step, unreachable since the
   meeting became three steps) and `mmConfirmAndRecord` are retired (Sunday
   v15 Stage 4). */
```

### js/15-meeting.js:1982-1988

```
/* mmPlanNextWeek lived here. It copied whatever week the meeting was pointed
   at into the following one and then did `weekOffset += 1` — which is correct
   only on the current week and silently wrong on every other, writing a
   historical week's plan over the top of another week that had already
   happened. The last step no longer offers it: copying a schedule belongs in
   the planner, beside the week it would land on, where pcwPlan (Setup › Copy a
   plan) and fillWeekFromNearest already do it and show their work first. */
```

## js/16-print.js

### js/16-print.js:56-59

```
/* onPrintAgeChange was here. It read document.getElementById('printAge').value
   with no null guard, and there has been no #printAge element in index.html for
   a long time — so the one thing it could have done was throw. Age is not asked
   for anywhere now; currentAge() answers it. */
```

### js/16-print.js:331-333

```
/* buildPrintSummary lived here — the week's totals as a footer under the print
   grid. It had no caller: the summary was dropped from the sheet deliberately
   (see the note above the render) and the function outlived it. */
```

## js/20-loan.js

### js/20-loan.js:201-206

```
/* Sunday v15 Stage 4 retired the old monthly schedule here: `loanMonthKey`,
   `loanDownOutstanding`, `loanDueNow` (the down payment, then the monthly
   figure) and `mnyDueNowAll`. A Sunday takes the must-pay below
   (`mnyDueThisWeek` / `mnyLoanSundayPayment`); a debt's `downPayment*`
   fields stay on the record for the weeks lived under them and are read by
   nothing that moves money (Plan v3 §D). */
```

### js/20-loan.js:260-264

```
/* Retired in Sunday v15 Stage 4 (Plan v3 §D, §G): the deposit prompt
   (`loanPayDownPaymentPrompt`), the monthly arrears charge (`loanAccrueArrears`,
   `mnyAccrueArrearsAll`) and the monthly transfer with its three shortfall
   choices (`loanSundayTransfer`, `mnySundayTransferAll`). A short Sunday pays
   what there is and carries the rest, with no interest on it. */
```

## js/21-money-data.js

### js/21-money-data.js:62-64

```
/* The ready-made plans (`MNY_PLANS`) are retired with the meeting's old money
   panels (Sunday v15 Stage 4, Plan v3 §G): the three starts on Sunday's "I
   choose" step are the core's `SD_PRESETS` (js/43). */
```

### js/21-money-data.js:1553-1555

```
/* `mnySplitFor`, `mnySplitTotal`, `mnySplitToLoan`, `mnyPricePlan` and
   `mnyDoors` priced the retired plan cards; Sunday's "I choose" step prices
   every placement through the core (js/43). Retired in Stage 4. */
```

## js/23-money-meeting.js

### js/23-money-meeting.js:18-22

```
   Retired in Stage 4 (deleted with their CSS and actions): "What I earned"
   and "What I do with it" (`mnyRenderEarned`, `mnyRenderDecide`), the
   earnings, income-bar, pool, plan, bucket, change-plan, door, reflect,
   commit and committed cards, the inline competition and money-from-outside
   forms, the confirm bar, the three shortfall choices (`MNY_SHORTFALL`) and
```

## js/34-parent-copyweek.js

### js/34-parent-copyweek.js:57-60

```
/* pcwPlaceableIds lived here. The day copy needs the same answer now, so it is
   placeableActivityIds in js/05-helpers.js — one owner, since two screens
   deciding for themselves what the other child can resolve is exactly how they
   would come to disagree. */
```
