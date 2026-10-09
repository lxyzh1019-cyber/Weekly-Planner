<!-- feature-list: by-screen -->

# FEATURES - Weekly-Planner - by screen

Each line says what you see or what the app does, then the test that proves it. Update this file in the same change that alters a feature. Over-list rather than under-list. Build history is in docs/archive/.

## Today

- Today signposts a waiting invite in one line (one share, one watch, or N invites) as a 44px row between the hero and Coming up, and taps through to the Sister Sync inbox — Proof: anInviteWaitingShowsOnToday
- Today's invite note is for a child only, never counts a missed invite, shows no row when nothing waits and is gone on the next render once answered — Proof: anInviteWaitingShowsOnToday, aMissedInviteIsNotWaiting
- A 🌙 row on Today asks How was today? from 8pm (or yesterday if unanswered); a past day reflects from its Day 📋 sheet — Proof: todayAsksHowTodayWent
- The reflect sheet takes its day: How was today?, How was yesterday? or How was Tuesday?, and writes only that day's mood — Proof: todayAsksHowTodayWent
- Today has no Vibe card; its fold reads To-dos and goals — Proof: todayIsWhereTheDayGetsDone
- The ribbon's now-marker stays inside the strip at its first and last minute — Proof: aDragThatCreatesAnOverlapDoesNotBreakTodaysRibbon
- Jobs I can do: a paid chore row on Today asks On time, Late or Had to redo it in place and then reads waiting — Proof: todayAnswersAJobInPlace, todayAndTheOwnersAgree, todayHandsOffRatherThanActing
- ＋ I did something else today (or on an open catch-up day) files a claim — Proof: somethingElseWorksForAnyOpenDay
- Routines card: each routine opens to its items, shows done/total and an all done button — Proof: routinesTickFromToday
- Own things · helping out card cycles none, done, nobody asked (XP) — Proof: ownThingsFromToday
- Training card after training ends: her 1 to 5 rating, tap again to take back, XP only, no money — Proof: attitudeAfterTraining
- A ✨ chip opens the Mum answered card and clears itself; a parent's look consumes nothing — Proof: answeredGradesClearFromToday
- A ⏳ N with Mum chip counts this week's answers Mum has not checked and goes to the first day with one: today → Jobs I can do; an earlier day → the Week tab's 🧹 Chores this week report, opened, with that chore's row in view — Proof: newAffordancesActuallyNavigate, kidSeesWaitingAndAnswered
- 🕓 Catch up card lists earlier days of this week with an unanswered chore, routine or training, one day open at a time — Proof: catchUpListsOnlyUnansweredDaysOfOpenWeeks, catchUpReachesThisWeekOnly
- Every Today control is at least 44px, words she acts on 15px, nothing under 13px, no sideways scroll at 390px — Proof: kidScreensMeetTheHouseRules
- ＋ Add to an earlier day lists earlier days of this week for a claim; claim only, no grade — Proof: somethingElseOnAFullyAnsweredEarlierDay
- Today's hero shows N day streak, and its level button opens My level with the privilege ladder — Proof: streakAndPrivilegesOnToday
- My level opens from the hero, shows level, tier, XP and the privileges ladder, and has one Close button — Proof: streakAndPrivilegesOnToday
- 📦 Open loops card lists unreleased boxed items; hidden when empty — Proof: openLoopsOnToday
- The Undo toast sits under the reflect sheet: with the toast up, every mood dot on the sheet is still hit at 44px — Proof: reflectMoodsAre44pxTargets
- Today is the front door: what now, what is next, free time, and a money row that agrees with My money — Proof: todayIsTheFrontDoor, todayAnswersWhatNow, todayLeadsWithWhatIsNext, todayNamesFreeTime, todayMoneyRowMatchesMyMoney
- Today's chore counts agree with the owners every other place reads (the Chores screen it was compared with is retired), and the reflection is her answer — Proof: todayAgreesWithTheChoreScreen, theReflectionIsHerAnswer
- Today looks as in the reference picture, iPad Pop — Proof: picture tests/reference/today-jenn-ipad-pop.png

## Week

- School-day offer: school days are offered, never assumed, up to 3 weeks ahead, when the school card is missing — Proof: theSchoolOfferIsAboveTheWeekGrid
- The offer sits above the week grid in one banner, its only host: the old below-grid host is gone from the markup (hidden in the preview view) — Proof: theSchoolOfferIsAboveTheWeekGrid, tests/check-dead-ids.js
- The banner names the count, shows a chip per offered day and Add all N only when more than one is offered; one writer so a stale chip cannot add a duplicate — Proof: oneSchoolDayCanBeAddedOnItsOwn
- A blank week offers its school days from the same banner, with no school button in the coach tip — Proof: aBlankWeekOffersItsSchoolDays
- 🧹 Chores this week on the Week tab: read-only rows for the tab's week, closed by default and remembered — Proof: weekChoreReportOnWeek
- The Full week measures its own type and re-measures when fonts or the look change — Proof: theWeekGridKeepsItsColumnFloor
- Week opens on the layout you can plan in, scrolls as one surface and keeps its column floor — Proof: weekOpensOnTheLayoutYouCanPlanIn, weekScrollsAsOneSurface, theWeekGridKeepsItsColumnFloor
- Dragging a block moves it to the time it was dropped at; resizing changes only its duration — Proof: draggingABlockMovesItToTheTimeItWasDroppedAt, resizingABlockChangesOnlyItsDuration
- Narrow screens get one day at a time — Proof: narrowScreensGetOneDay
- School calendar: every week view follows it, and an ICS file becomes days off only after review — Proof: schoolCalendarIsRight, everyWeekViewFollowsTheSchoolCalendar, anIcsFileBecomesDaysOffOnlyAfterReview
- The Full week looks as in the reference picture, iPad Pop — Proof: picture tests/reference/week-full-jenn-ipad-pop.png

## Day

- The Day header is the standard page header in one row: ◀ back to where the day was opened from (the week, Today or the meeting), the date as the title between ◀ ▶ ("Tuesday 6 Oct" on the iPad, "Tue 6 Oct" on a phone), 1 2 3 days, 📑 Copy a day and the badge; on a phone 📑 and 1 2 3 hide, ◀ ▶ are plain arrows (no box, 44px tap area) and tapping the date is Copy a day; the date button is named "<date> — copy a day", so the heading reads as the date; below 900px the ◀ drops its word (its label still says where it goes); it stays one row, nothing cut, at 360, 375, 390, 768 and 1024px on the week's first day and on Wed 30 Sep, for a parent and a child, and no longer shrinks on scroll; a Day opened from the meeting has its date, ◀ back to the meeting and its (locked) badge, and that ◀ goes back through the meeting's return: the sitting at its step and scroll, the lock lifted — Proof: parentDayTopBarStaysCompact, kidScreensHaveOneStandardHeader, oneBackStackGoesWhereYouCameFrom
- A sister can be invited to watch: a watch block earns nothing, is never chased for a result and keeps the meet's own travel — Proof: aWatchedMeetIsNeverChasedForAResult, aWatchInviteNamesTheMeet
- A watch block reads 👀 Watching — <meet>, or what the block is when no meet name was typed — Proof: aWatchInviteNamesTheMeet
- A watch block gives no training checks and no packing list — Proof: aWatchInviteNamesTheMeet
- A watch block still counts as planned time in the week totals — Proof: none found
- 👀 Invite my sister to watch shows for a kid and a parent on a competition block only; its confirm names the meet, and while the invite is live it reads <sister> is invited to watch and is disabled — Proof: aWatchedMeetIsNeverChasedForAResult, anInviteCannotBeSentTwice
- 💌 Invite <sister> on the edit sheet shows for a kid and a parent on any block except a watch block — Proof: anInviteCannotBeSentTwice
- Each edit-sheet invite button reads its own kind (💌 Invite sent to <sister>, 👀 <sister> is invited to watch); a share never marks the watch button sent, nor the reverse — Proof: anInviteCannotBeSentTwice
- The public toggle on the edit sheet is parent-only — Proof: anInviteCannotBeSentTwice
- The Day view's invite ghost is a second accept door: Accept or Ignore on a day ahead, Add it anyway or Decline on a day gone, writing the same block as the inbox — Proof: theDayViewAcceptFollowsTheSameRules
- The 📋 sheet is Copy a day: it shows both days, keeps pinned blocks, names what goes and what stays, and a child's copy is never pinned — Proof: copyADayShowsBothDays, copyingADayNeverPinsForAChild, templatesAreGone
- Start this day over keeps what is done, pinned or marked not done, and has no undo — Proof: startingADayOverKeepsWhatIsDone
- The closing ritual counts what was done and names the child being viewed — Proof: theClosingRitualCountsWhatWasDone
- 😌 Rest on the 📋 sheet is a 44px target — Proof: restButtonIsA44pxTarget
- The reflect sheet's mood dots are 44px targets and each block row wraps on a phone — Proof: reflectMoodsAre44pxTargets
- An empty day draws its invite ghosts, the drawn span stretches to every ghost (a 4pm ghost on an empty day is drawn), and the ghost never covers a block — Proof: anEmptyDayDrawsItsInviteGhost
- A child's remove all in series keeps parent-pinned copies and says how many stay — Proof: removeAllInSeriesKeepsPins
- The copy button names the sister's day (onto Jess's Tue) — Proof: copyADayNamesTheSistersDay
- Closing ritual title names the child being viewed and counts done blocks (none done reads Nothing ticked off today) — Proof: theClosingRitualCountsWhatWasDone
- The Day view's invite buttons are 44px and the Day view is in the house sweep — Proof: anEmptyDayDrawsItsInviteGhost
- Copy a day with nothing to copy says so and changes nothing — Proof: copyingNothingSaysSoAndChangesNothing
- The copy confirm names a copied block that overlaps a kept pin — Proof: aCopyNamesItsOverlapWithAKeptPin
- The hour ladder lines up with the schedule and only the schedule scrolls on the Day screen — Proof: theHourLadderLinesUpWithTheSchedule, onlyTheScheduleScrollsOnTheDayScreen
- Travel and get-ready strips never cover a card, say when to leave, and are clipped the same way on the Day view — Proof: aBufferStripNeverCoversACard, theStripStillSaysWhenToLeave, theDayViewClipsItsBuffersTheSameWay, buffers.test.js "an overlapping neighbour eats the whole window"
- The Day looks as in the reference picture, iPad Pop — Proof: picture tests/reference/day-jenn-ipad-pop.png

## Sister Sync (the sisters' timeline)

- An invite has one writer and cannot be sent or accepted twice, and its day comes from the screen it was sent from — Proof: anInviteCannotBeSentTwice, anInviteFromSisterSyncIsDatedThatDay
- An invite sent from the parent portal is recorded as the child's and stamps her own block — Proof: anInviteCannotBeSentTwice
- A live invite of the same kind is refused before the confirm with a toast naming its state (she hasn't answered yet, or it's already on her plan); a declined one may be sent again, and a share and a watch of one block are both allowed — Proof: anInviteCannotBeSentTwice
- A share of an activity the sister does not have is refused before it is sent — Proof: none found
- Known limit: a short own card is drawn taller than its minutes; the printed start–end and the stripe are exact — Proof: none found (known limit, not a test)
- The 💌 badge shows only on blocks really shared: a copied block, a repeated block and an extended series do not carry it — Proof: aSeriesInviteCoversEveryDayOrOne, anInviteCannotBeSentTwice
- An invite carries the sender's travel and get-ready; a missed invite is not waiting and can be added anyway — Proof: anInviteCarriesTheSendersTravelAndGetReady, aMissedInviteIsNotWaiting, theDayViewAcceptFollowsTheSameRules
- The invite confirm says what she gets: the same drive there and home and the get-ready time; with no buffers it says nothing about them — Proof: anInviteCarriesTheSendersTravelAndGetReady
- Accepting a watch invite writes the watch block with the meet's own travel and get-ready and no warm-up; accepting a share gives her the sender's drive, get-ready and unpack — Proof: anInviteCarriesTheSendersTravelAndGetReady, aWatchedMeetIsNeverChasedForAResult
- An invite sent before invites carried travel is placed exactly as before, with no migration — Proof: anInviteCarriesTheSendersTravelAndGetReady
- The inbox lists missed invites under the waiting ones with 📌 Add it to my <Day> anyway and ❌ Decline, no Accept; one from before this week drops out of the list but stays stored — Proof: aMissedInviteIsNotWaiting
- A repeating block asks Just this day, or all, as one series invite that gives her her own series — Proof: aSeriesInviteCoversEveryDayOrOne
- The duplicate guard covers a series: one covered day or a second all is refused with a reason — Proof: aSeriesInviteCoversEveryDayOrOne
- Accepting a series with days gone asks From <day> or Include the ones that passed; a fully missed series can be added anyway, unticked — Proof: aMissedInviteIsNotWaiting
- A series invite shows its ghost on each covered day and reads every Thu (3) in the inbox and on Today — Proof: aSeriesInviteCoversEveryDayOrOne
- A moved shared block says Send again? and stays live until the new day is sent — Proof: aMovedSharedBlockSaysSendAgain
- Sister Sync shows a side-by-side timeline of both girls for the chosen day, to scale, with a private block as a grey Busy shape and a both-free stripe — Proof: sisterSyncIsATimeline
- On the timeline your own blocks are at least 44px tall, since they are the invite control, and a block's height is its duration on one axis for both girls — Proof: sisterSyncIsATimeline
- Both free counts each block with its travel, get-ready and warm-up, and school hours, as busy, and looks up each sister's own activities — Proof: sisterSyncIsATimeline
- Tapping your own block on the timeline invites your sister for the day shown — Proof: sisterSyncIsATimeline
- Sister Sync is in the kid house-rules sweep; its invite answer buttons are 44px — Proof: kidScreensMeetTheHouseRules
- Sister Sync looks as in the reference picture, iPad Pop — Proof: picture tests/reference/sync-jenn-ipad-pop.png

## Chores (screen retired 2026-10-08)

- Intentionally removed (owner OK 2026-10-08, all 19 rows of docs/chore-relocation-map.md): the Chores screen, its kid and parent tabs, the week grid's claim cells, its My money door, the chore-group editor and its reference pictures. Each part lives on in the home below — Proof: docs/chore-relocation-map.md
- Answer how a job went (row 1) → Today, in place — Proof: todayAnswersAJobInPlace, todayAndTheOwnersAgree, gradedJobIsClosedToHerOnToday
- ＋ I did something else (row 2) → Today and 🕓 Catch up — Proof: somethingElseWorksForAnyOpenDay
- Routine items and all done (row 3) → Today — Proof: routinesTickFromToday, routinesCloseInOneTap
- Own things, training rating, answered grades seen (rows 4–6) → Today — Proof: ownThingsFromToday, attitudeAfterTraining, kidSeesWaitingAndAnswered, answeredGradesClearFromToday
- Learning and answering a job for her (rows 7–8) → Parent portal › Now — Proof: learningFromThePortal, parentAnswersForHerFromThePortal
- Streak, level, privileges ladder, open loops (rows 9, 10, 13) → Today — Proof: streakAndPrivilegesOnToday, openLoopsOnToday
- Daily ceiling, fines, weekly total, ledger (row 11) → My money; 8-week bars (row 12) → All my Sundays (Money story retired earlier) — Proof: thePassbookOpensAllMySundaysAndByMonth; row 11 owner-checked on the iPad 2026-10-08, no check of its own
- Week's chore report (row 14) → Week tab; missed days (row 19) → 🕓 Catch up — Proof: weekChoreReportOnWeek, catchUpReachesThisWeekOnly
- Pre-system weeks' board (row 15) → Parent › History, read-only — Proof: preSystemWeekReadableInHistory
- Chore readers are week-parameterised and shared; no new writer of money, claims or XP — Proof: weekChoreReportOnWeek
- Grading from the parent queue clears it; grading past the free two pays — Proof: gradeFromQueueClearsIt, gradingPastTheFreeTwoPays
- Sister Sync opens on today (the chore tab half of this check went with the screen) — Proof: sisterSyncOpensOnToday

## My money

- My money's What I own still reads the stored wallet; the words Everything I have are retired everywhere — Proof: everythingIHaveMatchesTheHoldings
- A kid's money header has two tabs, My money and Money school, in its row; a grown-up sees the whole rail of five, with the kid switch, in the sub-bar under it — Proof: tabBarOnEveryMoneySurface, moneyAndMeetingHeadersHoldTheirSizes
- Kid rule copy is generated from the live rules: fines card, streak card with the forgiving day — Proof: theKidPagesSayWhatTheRulesSay
- Every kid money screen holds the 44px target and 13px type floors — Proof: kidScreensMeetTheHouseRules
- Her request sheets: tell a result, club sessions, move / cash out / put cash in, draw early, new goal, everything I asked; every Send reaches the parents — Proof: requestSheetsSendEveryKind
- My money (the header with its tabs, a main column and a 350px right column on iPad, one column under 768px); every control is at least 44px and 13px — Proof: kidCanOpenMyMoney
- Countdown: Sunday in N days, seven day circles, about $X of chores so far, what is still to come and a link to what things pay — Proof: myMoneyMatchesFinalReference
- Asked parents strip: her two newest questions with their status, +N more and see all — Proof: myMoneyMatchesFinalReference
- Loan wall: 100 bricks filled by paid / borrowed, $X left, paid-off date and key facts; no loan reads Nothing to pay back — Proof: loanWallMatchesTheDebts
- What I own: Savings (with goal jars inside), Locked away, Companies, shut ones dashed with when they open; waiting money is one line Waiting for Sunday — Proof: everythingIHaveMatchesTheHoldings, myMoneyHasNoCashAccount
- Goal card: one jar with saved of target, a pace line, and a New goal door — Proof: goalJarsWaitForSavings
- Action buttons: Tell a result, Club sessions, Move / Cash, I was given; a child opens her request sheets, a grown-up opens the Record sheet — Proof: requestSheetsSendEveryKind
- This week so far: where this week's money comes from, by group, with a bar — Proof: myMoneyMatchesFinalReference
- I was given something opens her gift sheet (amount, who, kind, day) and files a gift request; a grown-up's button opens the Record sheet — Proof: giftSheetSendsAGiftRequest
- Passbook: the last four Sundays newest first with money in, wall, saved, cash, a bar per row, = Total, a note and how many Sundays are signed; a 📖 icon opens All my Sundays — Proof: passbookShowsTheLastFourSundays, passbookSharesSumToOneHundred
- Calendar and Coming up: results with what they paid, planned competitions, money parents expect, in a month grid — Proof: calendarShowsComingUp
- Stickers: six, lit when a signed Sunday earns them — Proof: sunday.test.js "stickers come from the signed week, not a stored key"
- The ? explainer card gives What, Why, Watch in the girls' words with a Take me to Money school door and a way back — Proof: explainerGoesToMoneySchoolAndBack
- Move to the loan wall is filed as a request, approved by a parent, and applied as extra on Sunday once — Proof: aMoveToTheWallWaitsForSunday
- Money screens at iPad width use the prototype's text size and never cut a label with an ellipsis — Proof: noLabelIsCutOnTheMoneyScreens
- Every money root (My money and its header, Money school, All my Sundays, By month, the Sunday step and the meeting's header, Grown-ups, Parent › Now, the request, Parent's card, She told me and Grown-ups sheets) carries data-money-surface; one rule gives them --text-scale 1 at 768px and wider and one gives them the body font for figures — Proof: tests/check-money-surface.js, noLabelIsCutOnTheMoneyScreens
- Dates read like Tue 29 Sep; the loan wall has no gate flags and What I own has one row per place with a hint — Proof: loanWallMatchesTheDebts
- Tell parents a result lists the planner's competitions of the last 4 weeks, asks First, is it one of these? and allows one open result per competition — Proof: requestSheetsSendEveryKind
- My money on iPad has three columns: passbook, calendar and stickers on the left; countdown, loan wall, What I own and goals in the middle; Ask parents and gifts on the right — Proof: myMoneyMatchesFinalReference
- No cash account on screen: What I own is Savings, Locked and Companies; money between Sundays is one line Waiting for Sunday — Proof: myMoneyHasNoCashAccount
- Every calendar day is a button: a result says what it paid, a planned competition opens Tell a result, an empty day offers to add a competition in the planner — Proof: calendarShowsComingUp
- Each passbook Sunday is a button row with an in-bar over an out-bar that unfolds its figures — Proof: passbookShowsTheLastFourSundays
- The doors' sheets: this week so far, one loan, all loans side by side, waiting for Sunday, my goals and the month — Proof: myMoneyMatchesFinalReference
- Move / Cash sheet has four modes: Move, Cash out, Put cash in, Draw early; the weekly cap still holds — Proof: requestSheetsSendEveryKind
- This fine is wrong: a 44px button on each fine opens a dispute request with optional reasons; one open question per fine; a yes removes the fine — Proof: aGirlCanDisputeAFine
- Draw early keeps the prototype's tip and fits one screen on iPad and phone, in both looks — Proof: requestSheetsSendEveryKind
- Every request sheet closes with the × top-right; no Done button — Proof: aGirlCanDisputeAFine
- Draw early offers three reasons (School book fair · Treat · Something else), and no Move · Cash mode has a Not now button — Proof: none found
- A kid's money header carries 💰 My money · 🎓 Money school; no bottom bar on Money school, All my Sundays or By month — Proof: thePassbookOpensAllMySundaysAndByMonth
- The kid side names its places Savings, Locked away and Companies on My money, Today's money bar, By month, the Money school ladder and the meeting — Proof: tests/check-money-words.js
- The kid tour bolds its key words and ends with Tap a Sunday for its numbers; the checklist title reads Before we start — Proof: theKidPagesSayWhatTheRulesSay
- Same thing, same look: title-row totals are one family coloured by meaning, money columns right-aligned, one round 44px stepper look, Her share is one 50% stepper, thick-border buttons and a darker scrim — Proof: theLooksKeepTheSameBoxes
- Money screens do not spill or clip: Guess icon, loan-first words, Signed Money out column, badge off the face, result sheet icon, loans table, goal row on phone, wrapping tabs — Proof: noLabelIsCutOnTheMoneyScreens
- My money looks as in the reference picture, iPad Pop — Proof: picture tests/reference/mymoney-jenn-ipad-pop.png

## Money school

- Money school's home card has the door What things pay, the same price sheet My money opens; pmPriceCards is read-only — Proof: priceChangeShowsButDoesNotRestate
- The Money school ladder opens at 20 / 30 / 40 / 100% of debt paid from one table; a parent override can only open a stage — Proof: theGatesComeFromOneTable
- Money school's chips read the same rule words as the card body, with no raw placeholder — Proof: moneyWordsAndSmallFixes
- Money school has three columns on iPad: What opens when (loan, Savings, Locked away, Companies, All paid off), The ideas (each opens the same sheet as the ? on My money), and Companies go down too with What things pay and What money buys — Proof: moneySchoolWearsTheNewLook
- Money school looks as in the reference picture, iPad Pop — Proof: picture tests/reference/moneyschool-jenn-ipad-pop.png

## All my Sundays

- All my Sundays is one full-width card: every settled Sunday from the frozen ledger with one bar and the four groups in words, By Sunday or By month, and a Came in, Taken off summary on top — Proof: thePassbookOpensAllMySundaysAndByMonth
- Every passbook row and every All my Sundays row is a 44px door that opens that Sunday's sheet: came in, taken off, where it went, loan left after, and Settled without a sign where it applies — Proof: aSundayRowOpensItsSheet
- The Sunday sheet reads one frozen row; live fines show only while they add up to it — Proof: aSundayRowOpensItsSheet
- All my Sundays looks as in the reference picture, iPad Pop — Proof: picture tests/reference/all-my-sundays-jenn-ipad-pop.png

## By month

- By month leads with a sentence in four groups (earned, given, my money made, taken off), then what went out and what was put away; each caption equals the sum of its bars; numbers come from the frozen ledger — Proof: theFlowSaysWhereItWent, theFlowCaptionsEqualTheirBars
- By month is the Flow in cards: What came in (earned with Home, Club job and Competitions under it, given, made, taken off), What went out, Put away to grow, and month bars along the bottom — Proof: theFlowSaysWhereItWent
- This month is the calendar month (a picked month stays picked); before any Sunday of this month is signed it reads Nothing has landed this month yet. — Proof: thisMonthSaysNothingHasLandedYet, thePassbookOpensAllMySundaysAndByMonth
- By month looks as in the reference picture, iPad Pop — Proof: picture tests/reference/by-month-jenn-ipad-pop.png

## Sunday steps

- The money step of the meeting is one girl at a time with her own head, four step chips, a sound switch, a Parent's card and a right pane — Proof: sundayLooksLikeThePrototype
- The Sunday screens own no arithmetic: every figure comes from the core over the same input the sign uses — Proof: sunday.test.js "8–20 Sundays, both girls: every invariant held every week"
- Her choices are a draft kept on this device per girl per week, never synced — Proof: sundayRedoReturnsOnlyHer
- Sunday opens once per girl per week: approved goals and wall moves apply, loan rows rescale if the monthly changed, the market wobble runs — Proof: aSkippedSundayStillRescalesHerRows
- Guess: the story sentence, club job tile with a chip per session, chore, streak, competition and gift tiles, the guess stairs and Show me; parents' questions must be answered first — Proof: sundayGuessIsBlockedUntilDadAnswers, sundaySundayRoutineCounts
- Payday: money earned, given, made, from my bank and taken off, each line unfolding its working; Must pay first; My pile of coins; Now I choose records the week agreed — Proof: sundayPaydayAddsUp
- I choose: Loan, Spend and Save & grow with waterfall bars; first tap picks, tap adds $1, hold adds $5; three starts; what I owe and what I own on the right; hold to sign — Proof: sundayHoldAddsFive, sundayCannotSignWithMoneyUnplaced
- Signed: money in and out with In = Out, two verdicts, the milestone at 20 / 30 / 40, Say it out loud, Redo, signature, sticker, Next Sunday; timeline and forecast on the right — Proof: sundayInEqualsOut, sundayMilestoneOpensAPot
- A new commitment or surprise cost since her last signed Sunday shows a card over step 1 with before and after and the share of steady money — Proof: aBigCommitmentNeedsAParentTick
- New row on my wall reads its shares and the 50% line from the core (sdCommitShares): under $5 a week of steady money it says not enough steady money yet instead of a %, Left for me to choose is never negative, and the one-more-club-session idea uses the same division — Proof: tests/check-steady-share.js, sunday.test.js "fix 1: the pop-up's shares and its 50 % line are sdCommitPlan's", smoke sundayLooksLikeThePrototype (the card at $2 steady shows the not-enough wording and no ideas; at $6 steady and over half it asks "How could I get back under half?" with three ideas)
- Parent's card: ASK, SAY and WAIT per step with a checklist and Back to her — Proof: sundayLooksLikeThePrototype
- The sign is refused if money is unplaced or In differs from Out, then moves every dollar through its own owner and writes one ledger row — Proof: sundaySignMovesEveryDollarThroughItsOwner
- On the meeting Sunday the routine is pre-marked as kept without a tick in a week not yet settled; mid-week an unfinished day still stops the run — Proof: sundaySundayRoutineCounts
- In the core, a goal waits for Savings and a shut jar's share goes to the wall — Proof: goalJarsWaitForSavings
- An express catch-up pays that Sunday's must-pay through the sign's own loan step; a changed monthly rescales rows once; the meeting footer draws nothing while the girl is unsigned — Proof: aCaughtUpWeekPaysItsMustPay, theMoneyStepHasOneSignControl
- Late costs are said once, Adjust starts at her figure, a planned meet already told is one item, a free fine shows no amount — Proof: aFreeFineShowsNoAmountAnywhere, sundayOneMeetOneItemAndAdjustStartsAtHerFigure
- Sunday's right panes: Clues, target and Parents answer first on Guess; My pile fills its column; Signed lines indent under their groups with the verdict behind Why — Proof: sundayLooksLikeThePrototype
- Payday: Money in, From my bank, Taken off, a My pile with coins and the loan-first line; My last 4 Sundays show the same rows as the left side — Proof: paydayGroupsMatchLastFourSundays
- I choose has three equal columns and a legend column; first tap picks, second adds $1; What I owe and What I own on the right — Proof: iChooseHasThreeEqualColumnsAndLegend
- Signed shows Money in & out, What I owe vs what I own over the last 8 Sundays with a forecast, Say it out loud, and the timeline and forecast on the right — Proof: signedForecastRule
- Taken off is always shown negative on Payday, Signed, the Now card, the meeting and Weeks — Proof: takenOffIsAlwaysNegative
- One pile figure: Payday, I choose and Signed show the same pile, and From my bank adds up with a Waiting for Sunday line — Proof: onePileFigureOnEveryStep, fromMyBankAddsUp
- I choose's what I owe → after is what the sign leaves, counting the jar's overflow below the Savings gate — Proof: sundayInEqualsOut
- A week that is committed with no Sunday record reads Settled without a sign on the Signed step — Proof: moneyWordsAndSmallFixes
- The meeting Sunday is pre-marked: day 6 of a Monday to Sunday week not yet settled counts as kept once it has come, ticked or not; the Guess tile reads Sunday routine marked for you — Proof: sundaySundayRoutineCounts
- Guess stairs have no reserved band; each bar is its share of the stairs and the step fills the screen at 1100px and up — Proof: sundayGuessIsBlockedUntilDadAnswers
- Sunday Payday, I choose and Signed look as in the reference pictures, iPad Pop — Proof: picture tests/reference/sunday-payday-parent-ipad-pop.png

## Grown-ups

- Competitions never paid: settled weeks whose competitions are worth more than the ledger says, previewed, confirmed and paid once — Proof: olderWeeksUnpaidMeetsArePaidOnce
- Grandfather rule: a dated rule (start week, amount) that credits weeks with no family meeting outside the 8-week window, once, after a preview and confirm — Proof: theGrandmaRuleIsSavedAsADatedRule, grandmaPaysAMeetOnTop, grandmaListsTheWeeksWithNoMeetingOutsideTheWindow
- The catch-up banner offers the Grandfather credit from the saved rule in one tap through the same confirm, never on its own; with no start week saved it points to 👴 Grandfather rule › — Proof: theGrandmaRuleIsSavedAsADatedRule
- The repair leaves a Grandfather-rule week alone; a competition in it is paid once as its own late line — Proof: aLateMeetInADefaultedWeekIsPaidOnce
- One Record sheet, five records: chore grade, competition, gift, fine, move; a child records only a gift and a move and only as a request — Proof: kidCannotTransact
- A gift has a day it came and a week that decides it; a settled week hands the decision to the next open one — Proof: giftCanCoverAQuietWeek
- Record-sheet entry points: Parent Now, the Grown-ups bar, Sunday's add buttons and a planned competition's result; every money control sits under one click host — Proof: everyMoneyActionHasAListener
- A refused move says why on the Record sheet's save button before the tap; typing never re-renders the sheet — Proof: moneyCanMoveOutsideAMeeting
- Every old Money rules section has a home in a Grown-ups tab; Change history and Grandfather rule rows open Grown-ups, Rules — Proof: grownupsEveryOldSectionHasAHome, ruleChangesHaveOneHome
- Weeks: a Grandfather-rule row reads Grandfather rule $3 + meets with no steppers and refuses editing or removal — Proof: aDefaultedWeekIsNotEditedByHand
- Rules, Pots has three gate steppers that save as a dated version; a step that breaks ready <= locked <= stock <= 100 is refused — Proof: theGatesComeFromOneTable
- Grown-ups is the parent's Money tab: Commitments, Fines, Expected, Rules and Weeks, with Record and ? at the start; 44px targets, one column under 768px — Proof: grownupsEveryOldSectionHasAHome
- Commitments: each girl's rows with bars, her must-pay against steady money, a new commitment form with an affordability pane, a Club owes card and a one-off club session — Proof: grownupsCommitmentsAddARow
- The loan card's share of steady money is the core's (sdSteadyShare): under $5 a week of steady money it shows — — Proof: tests/check-steady-share.js, sunday.test.js "fix 1: a share of steady money is null under the $5 floor, else weekly ÷ steady × 100"
- Both ✍️ Record doors (the Grown-ups bar and Parent › Now) carry the same hint, Write down money that came in or went out., from one source (rcDoorHint) — Proof: bothRecordDoorsCarryTheHint
- Fines: choose girl, item, day and who logged it; this week's list with free or charged amounts, standing and remove; every fine is logged even when free — Proof: grownupsFinesLogEvenWhenFree
- Expected: per girl the next five months, move, step $5, remove and add chips — Proof: grownupsExpectedMoneyMoves
- Rules tab: rule rows with the girls' words, a changed value shown with was, an impact pane, Save starts next Sunday as one version, Undo, and the last five changes — Proof: grownupsRulesSaveFromNextSunday
- Grown-ups is Commitments, Fines, Expected, Rules and Weeks, with Record and ?; the More tab is retired and each old section has a new home — Proof: grownupsEveryOldSectionHasAHome
- What things pay lives in Rules: earning, competitions, Skating star level, learning, fines, targets, what money buys — Proof: rulesFindAPriceAndListRuleChangesOnly
- Commitments rows show interest so far, cost by payoff, early bonus and late costs; Fix this row edits name, icon, start and paid-off without touching payments — Proof: debtRenameReachesEverySurface
- Lessons live in Rules, Pots: each girl's place, open early chips and Fix what she owns — Proof: theGatesComeFromOneTable
- Weeks: per girl her Sundays in the passbook's grid with a tag (signed, typed in, Grandfather, re-priced, late), Fix for typed weeks, Add a week — Proof: rulesAndWeeksAreOneScreenEach
- Grandfather rule: start week, amount, Save in Rules; preview and credit in Approve while weeks wait — Proof: theGrandfatherRuleReadsAsItselfEverywhere
- Rule changes: the last five with date, change and reason; See all opens every one — Proof: ruleChangesHaveOneHome
- Rules save card: reason chips beside Save starts next Sunday and Start this week instead; one-time cards only while pending — Proof: grownupsRulesSaveFromNextSunday
- The fix sheets are one overlay, one open at a time — Proof: grownupsEveryOldSectionHasAHome
- On screen the Grandma rule is the Grandfather rule everywhere; stored keys are unchanged — Proof: theGrandfatherRuleReadsAsItselfEverywhere
- Fix this row has What it bought, Each month, Bonus for paying early and Add another loan; Rules has Find a price — Proof: rulesFindAPriceAndListRuleChangesOnly
- Rules is one screen: an index with find a price, the open group in the middle, What this changes on the right and a save strip along the bottom — Proof: rulesAndWeeksAreOneScreenEach
- The Rules index keeps 300px at every two-column width, so the search box's placeholder Find a price or rule… is not cut in either look — Proof: rulesSearchPlaceholderFitsTheIndex
- Weeks: a summary per girl (earned this year, loan left, typical week, loan payments, saving line), every Sunday with both girls side by side, and a tap opens the whole record of that Sunday — Proof: rulesAndWeeksAreOneScreenEach
- A commitment under $5 a week of steady money, or over 50% of it, is saved only with the parent's I checked this with her tick; the 10% down payment comes from Savings only above the safety line — Proof: aBigCommitmentNeedsAParentTick
- Grown-ups Rules looks as in the reference picture, parent iPad Pop — Proof: picture tests/reference/grownups-rules-parent-ipad-pop.png

## The meeting

- The meeting is a full screen opened and closed only through its show/hide functions, returning to where it came from — Proof: meetingKeepsFocusAndScroll
- Three steps: The week, The money, Close; the money step has no footer and the girls switch in the header; the header is a band in the sheet, not pinned over the cards — Proof: theMeetingKeepsItsHeadAndFeet
- Redo is per girl: it returns only her profile and her sign's lines, leaves her sister's signing alone, and is withdrawn once money moves on her stream after the sign — Proof: sundayRedoReturnsOnlyHer, moneyMovedAfterTheMeetingWithdrawsTheUndo, undoDoesNotDoubleCountTheStream
- The meeting's header is the meeting page header, two rows as the owner's picture: the girls as round pictures with a tick when signed, "Family meeting", the three steps as one control (numbers on a phone) and on the money step 🔊 Sound and 🗣️ Parent's card; then, under a dashed rule, the four Sunday steps (or where the family left off) and at the right the week, with catching up and This week ▶ on an older week (the name and the week hide on a phone); 62px / 60px + 44px; no hidden screen title; one font for words and numbers on the money screens — Proof: meetingHeaderTwoRowsNoBottomBar, moneyAndMeetingHeadersHoldTheirSizes
- The money week is named Mon 5 – Sun 11 Oct on the meeting header, Signed header, story card and Weeks rows — Proof: theMoneyHeadNamesTheMoneyWeek
- The meeting's money step looks as in the reference picture, parent iPad Pop — Proof: picture tests/reference/meeting-money-jenn-parent-ipad-pop.png

## Print

- Print is on the week sheet, with its travel and get-ready bands and side band; the week's Print button shows on Print preview, the view it prints, and Print's own header (◀ back to the week, Print Week, 🖨 Print) is never printed — Proof: printIsOnTheWeek, printBuffers, printSideband
- The parent portal prints no broken numbers — Proof: portalPrintsNoBrokenNumbers
- Print preview looks as in the reference picture, parent iPad Pop — Proof: picture tests/reference/week-print-preview-jenn-ipad-pop.png

## Parent portal

- Parent Now has an On her behalf card: pick Jenn or Jess and a day, answer her chores, own things, training and learning for her; no grading or settling there — Proof: parentAnswersForHerFromThePortal, learningFromThePortal
- Parent History offers Before the new system: week chips and a board per child with frozen money — Proof: preSystemWeekReadableInHistory
- Sister Sync shows a read-only Sister details line; only a parent changes it, in Parent, App, Profiles — Proof: sisterDetailsAreTheParentsToChange
- Parent Now shows a loan-season row 1 Aug to 30 Sep unless a debt was made since 1 Jul — Proof: theLoanSeasonRowFollowsTheCalendar
- The ? button in the Grown-ups bar opens the parent tour, written for the six tabs — Proof: theMarkupSaysWhatThingsAre
- Approve: both girls' questions in one list with Yes, Talk first, No and an Undo; steps a result's dollars; a market wobble switch in Rules — Proof: grownupsApproveAnswersEveryKind, nowIsWhereQuestionsAreAnswered
- Parent Now counts what is waiting for the parent, both girls — Proof: parentNowCountsWhatIsWaiting
- This Sunday: Change a line per girl through the override writers with a reason; a signed week is frozen — Proof: nowIsWhereQuestionsAreAnswered
- What they own per girl (cash, Savings, goal jars, Locked, Companies) with Fix what she owns; She bought it on a full jar — Proof: nowIsWhereQuestionsAreAnswered
- The parent portal is one row: Parent menu (PIN, look, Exit), six destinations Now, Meeting, History, Money, Setup (App), the day and the girl switcher; the meeting and My money headers are page headers too — Proof: parentScreensMeetTheHouseRules
- Parent Now lists Waiting for you as full question cards grouped by girl or by kind and filtered Jenn, Jess or Both, with side panes This Sunday, Her answer last week, What they own, Record and She told me — Proof: nowIsWhereQuestionsAreAnswered
- Talk-first questions carry an agreed amount the parent steps and agrees on Sunday; her answer reads agreed $2 (asked $4) — Proof: talkFirstCarriesAnAgreedAmount
- Now's count is one reader: the tab badge and N open count the lines above the cards plus every open question — Proof: everyMoneyRequestIsAnsweredInNow
- The parent portal fits a phone; Trends and Options render and Trends paging is bounded — Proof: portalFitsAPhone, trendsRenders, trendsPagingIsBounded, optionsRenders
- Parent Now looks as in the reference picture, iPad Pop — Proof: picture tests/reference/parent-now-parent-ipad-pop.png

## Profile and navigation

- Kid nav has five places, one fixed bar: Today, Week, Money, Sister Sync, More; no second nav row — Proof: kidNavIsUsableAndScoped
- Sister Sync is a tab with aria-current, fits on one line at 375px also in the fallback font — Proof: sisterSyncIsABottomTab, sisterSyncTabFitsInTheFallbackFont
- The kid nav shows only on a child's screens and never for a parent — Proof: kidNavIsUsableAndScoped
- More holds exactly Switch (and the look tile), then the build number; Chores (retired 2026-10-08), Sisters, Money story and Money school tiles are gone — Proof: moreHasNoMoneySchool
- Money school is reached from the money header's tab and every ? explainer's Take me to Money school; All my Sundays and By month open from the passbook — Proof: explainerGoesToMoneySchoolAndBack
- The sync tab lands on the Sister Sync screen and old routes still work — Proof: navReachesEverythingAndOldRoutesStillWork
- Every profile badge (Today, Week, Day, Sister Sync, My money, Money school, All my Sundays, By month) is a 52px button far right in the header that opens the one profile switcher and reads who is on screen, as the 52px round avatar at every width with its words in the aria-label, e.g. "Parent (Jenn), switch profile" or "Jenn, switch profile" — Proof: everyProfileBadgeSaysTheSameThing, everyProfileBadgeSwitchesProfile
- One writer makes every badge's text; no badge spells it out — Proof: everyProfileBadgeSaysTheSameThing
- Nothing is announced as a control that is not one, and the meeting lock hides only the two badges (really undrawn, not only marked hidden) and lifts for a child — Proof: everyProfileBadgeSwitchesProfile
- Sister Sync fits in the fallback font at 375px — Proof: sisterSyncTabFitsInTheFallbackFont
- Today, Week, Day, Sister Sync and Print each have one standard page header, one height at each size in both looks (64px iPad, 60px phone, plus its rule); no ◀ on Today, Week and Sister Sync; titles without emoji; Today's date reads "Tuesday 6 October" on the iPad and shows on a phone too as "Tue 6 Oct" (only the money header hides its date on a phone); the week range reads "Oct 5 – Oct 11" on the iPad and "Oct 5 – 11" / "Sep 28 – Oct 4" on a phone; "Sister Sync" fits on one line at 375px — Proof: kidScreensHaveOneStandardHeader
- The Week header's 📋 Full week and 🖨 Print preview are tabs, each controlling its own view (#weekFull, #weekPrintPreview are their tabpanels); the parent portal keeps its six destination tabs — Proof: theParentPortalTellsATabFromARegion, theMarkupSaysWhatThingsAre
- My money, Money school, All my Sundays and By month each have one money page header (72px iPad, 64px phone, plus its rule): ◀ "Back to <screen>", the title without emoji ("My money", "Money school"), the date, the two tabs, ? and the round avatar badge far right that opens the switcher; on a phone the date and the title hide and the tabs join (the current one's name, the other's icon); the header spans the screen in both looks — Proof: moneyAndMeetingHeadersHoldTheirSizes, everyProfileBadgeSwitchesProfile, myMoneyMatchesFinalReference
- One back stack: every header ◀ goes back to the screen it was opened from and says so ("Back to Week"), device-local, never in state; the money pages' ◀ too (My money → where it was opened from, Money school → My money or the meeting, at the same place on My money, All my Sundays and By month → My money), and a money tab back to the page that opened it takes the step off; a profile switch empties the stack — Proof: oneBackStackGoesWhereYouCameFrom, explainerGoesToMoneySchoolAndBack
- The profile picker looks as in the reference picture, iPad Pop — Proof: picture tests/reference/profile-any-ipad-pop.png

## Looks

- Sister Sync, Copy a day, Today's 🌙 row, Catch up and Parent Now keep 4.5:1 contrast in dark mode — Proof: theR5ScreensReadInDarkMode
- Two looks, Pop and Calm, cover the whole app; print ignores them. Pop is cream graph paper with handwriting fonts and yellow buttons; Calm is cool paper with Lexend and purple buttons — Proof: theLookFlipsWithNoReload
- Pop (default) and Calm share the same border widths and boxes — Proof: theLooksKeepTheSameBoxes
- Switching: a 🎨 tile in each kid's More and a 🎨 button in the parent portal; instant, remembered per person on this device, never synced — Proof: theLookSurvivesAReload
- Shared in both looks: money colours, the activity palette, kid colours, warnings, print — Proof: warningsReadAsWarningsInBothLooks
- No typed colour, font or text size outside the look tokens; both looks define the same names — Proof: tests/check-look-tokens.js
- Shared values are role-named tokens (surface, page, scrim, text, border, shadow, status, zone, kid, print) and the money --mny-* tokens — Proof: tests/check-look-tokens.js
- Seven font tokens hold every font stack (--font-body, --font-text, --font-head, --font-display, --font-round, --font-hand, --font-script); print has its own --print-font-* tokens — Proof: tests/check-look-tokens.js
- One text scale: every absolute font size in the CSS, generated markup and index.html multiplies --text-scale (composing with the parent Reading size --fs-scale); print forces it to 1 — Proof: tests/check-look-tokens.js, printIgnoresTheLook
- Only family data palettes and colour maths keep a typed colour, each with a look: reason mark; the theme-color meta is the one named exemption — Proof: tests/check-look-tokens.js
- Each look's values live in one :root[data-look] block, shared ones in :root; print keeps its own values and text size — Proof: tests/check-look-tokens.js, printIgnoresTheLook
- Pop look reads everywhere: every visible text is at least 4.5:1 against its background on every kid screen and the five parent destinations — Proof: thePopLookReadsEverywhere
- Readable everywhere: no white text on a pastel, in either look — Proof: thePopLookReadsEverywhere
- Brighter palette: the 12 subgroups and 4 sports stay tell-apart-able and navy ink reads on every fill — Proof: everySubgroupTellsItselfApart
- Kid colours: Jenn pink, Jess blue, white text only on the strong shade — Proof: thePopLookReadsEverywhere
- Calm look: cool page, white cards, purple main button, Lexend and Baloo 2 loaded on first use, switched by applyLook with no reload — Proof: theCalmLookReadsEverywhere, theLookFlipsWithNoReload
- Calm look keeps the same boxes and fits Sister Sync, the strip and the stacked card — Proof: theLooksKeepTheSameBoxes, sisterSyncFitsInBothLooksFonts
- Warm surfaces follow the look while money, kid and meaning colours and warnings stay shared — Proof: warningsReadAsWarningsInBothLooks
- Parent portal in Calm: navy selected tab, 44px tabs, today and selected day differ — Proof: todayAndSelectedDifferInBothLooks
- Print ignores the look: every computed style of the print sheet is the same in Pop and Calm — Proof: printIgnoresTheLook
- Parent screens are held in both looks for contrast, 44px targets and no sideways scroll — Proof: parentScreensMeetTheHouseRules
- One font everywhere: buttons and inputs draw in the look's font and figures — Proof: everyTextUsesTheLooksFonts
- Calm fits the iPad and phone: tight money labels step smaller in Calm but never under 13px; phone heads are two rows with words hidden under 768px — Proof: noLabelIsCutOnTheMoneyScreens
- Grown-ups figures read the body font in Pop; the Story ribbons use My money's meaning colours — Proof: everyTextUsesTheLooksFonts
- Money sizes are tokens: every corner, border width and shadow in the money sections reads a shared size token — Proof: tests/check-look-tokens.js
- Today's clash note ink meets 4.5:1 in both looks — Proof: thePopLookReadsEverywhere

## Data and rules

- Smoke subset: SMOKE_ONLY=a,b runs only the named smoke checks, refuses an unknown name, prints PARTIAL RUN and never counts as a pass of the suite — Proof: tests/check-ci-scripts.js
- Short loop: npm run test:fast runs the static checks (steady-share and money-surface included) and the seven unit suites; npm test adds cleanup and smoke; CI runs checks, browser and one smoke job per date — Proof: tests/check-ci-scripts.js
- Dead-action guard: an onclick or data-action in the markup must name a function or handler that exists — Proof: tests/check-dead-actions.js
- Gate runs on Windows: npm test passes in a Windows checkout with no environment variables (LF files, Node suites set UTC themselves) — Proof: none found
- Picture test: every screen and state is shot at iPad 1194x834 and phone 390x844 in Pop and Calm and compared with tests/reference, on CI only — Proof: picture tests/reference/today-jenn-ipad-pop.png
- Classic scripts, no build step, no ES modules; js/01 to js/99-main.js share one global scope — Proof: tests/check-globals.js
- Load-order rule: files 01 to 36 only declare; all top-level executable code is in js/99-main.js — Proof: tests/check-globals.js
- One declaration per name globally — Proof: tests/check-globals.js
- js/04-merge.js is frozen; a change needs a demonstrated sync bug and a failing test written first — Proof: tests/check-shared-merge.js
- Every state.shared key needs a merge decision — Proof: tests/check-shared-merge.js
- Three escaping helpers, chosen by context — Proof: tests/check-escaping.js
- Verification before a push: test:fast plus the tests the Tests lines name; before a pull request the full suite is green on GitHub — Proof: tests/check-ci-scripts.js
- SW_VERSION must be bumped on any deploy that changes a shell file — Proof: tests/check-sw-shell.js
- A child may create or update a chore claim; never grade, settle or move money — Proof: kidCannotTransact
- A claim in a settled week is refused with a sentence, for a child and a grown-up (the old known gap) — Proof: aSettledWeekCannotBeClaimed
- Money is stored as movements in profile.events; balances are derived and a drift is reported on the parent page — Proof: stream.test.js "a balance reads all of history, not just the span"
- Every wallet writer mirrors into the stream; a caller may label a movement and never redirect one — Proof: stream.test.js "every pot the stream derives matches the movements, over 1000 histories"
- A correction is a reversing event, never an edit; events merge by id with their own tombstone scope — Proof: stream.test.js "a reversal puts the balance back exactly"
- The migration is read-only until run, idempotent and re-prices nothing — Proof: merge.test.js "re-merging the same stream changes no balance"
- Rules are effective-dated versions, so a lived week keeps the rules it was lived under — Proof: merge.test.js "moneyRules newer version edit wins"
- mrApplyEdits is the only versioned writer and logs a line per field with a reason — Proof: merge.test.js "moneyRules audit log unions both entries"
- Settled weeks are frozen in the ledger and never recomputed — Proof: ledgerFreezesTheWeek
- mrStartWeek is derived from the earliest week on file and never written by being read — Proof: theSystemDidNotBeginToday
- Four house rules: homework earns XP not dollars; tone, borrowing, screens and asked-twice are free twice a week; one forgiving day a week; the year's pace divides by weeks elapsed — Proof: theFourHouseRulesHold
- A household with a stored rulebook gets the house rules through a parent-only card, applied once from this Monday, never re-pricing a lived week — Proof: theHouseRulesReachAStoredRulebook
- The year's-pace denominator is weeks elapsed, not weeks settled — Proof: theFourHouseRulesHold
- The rules change log stores readable values, e.g. Added Match the socks — Proof: ruleChangesHaveOneHome
- The repair only ever adds, prices each week under its own rules, never touches a migration-frozen week and is idempotent — Proof: olderWeeksUnpaidMeetsArePaidOnce
- The $3 default is backfill only and never reaches the current week or the eight weeks of catch-up — Proof: grandmaListsTheWeeksWithNoMeetingOutsideTheWindow
- A competition and its calendar block carry each other's id — Proof: aCompetitionCanCarryItsOwnName
- A settled week does not block a competition or a gift: it pays or takes back into cash at once as a late line, once — Proof: aSettledWeekDoesNotBlockALateMeet, aLateMeetInADefaultedWeekIsPaidOnce
- Pots never touch: a move between two pots goes through cash; every destination is stage-gated and a refusal is a sentence — Proof: lockedPlansAndBucketsRefuse
- A child proposes a move, a grown-up approves, and it runs at approval; approving twice moves nothing — Proof: kidCannotTransact
- One route decision for every ordered pair of homes: it moves or is refused with a sentence; no loan is ever shown as 100% paid — Proof: lockedPlansAndBucketsRefuse
- Skating star level is how every money surface names the dance sport — Proof: danceReadsAsSkatingStarLevel
- Loan edits never touch paid or payments; balance, pace, payoff date and weekly amount are derived on every render — Proof: loanWallMatchesTheDebts
- A permanent click sweep presses every money control on every money surface and fails on any exception — Proof: everyMoneyControlClicksClean
- The Sunday arithmetic (js/43) is pure: pile and hers, where money can be placed, presets, the sign, verdicts, forecast, clues, shares; every rate, cap and gate comes in as rules — Proof: sunday.test.js "8–20 Sundays, both girls: every invariant held every week"
- The Sunday rules (6 per session, advance max 5, spend cap 20%, loan 1%, interest every 4 Sundays, extra bonus 10%, safety 10, lock 4 weeks, rates 1.5/4/7, gate 20) are in the shipped rulebook and added to an old one once, never rewritten — Proof: sunday.test.js "the Sunday rules are in the shipped rulebook (Plan v3 §C)"
- The assistant job: attendance is a grown-up's answer or the block, times the per-session rate; parent-only to set; flows into week, ledger, repair and year to date — Proof: sunday.test.js "all sessions missed: the assistant job pays $0 and nothing is fined"
- A result keeps its races and the parent's checked figure beside the rule's award; one function answers what a competition pays — Proof: merge.test.js "competitions from both devices survive"
- Loan terms: weekly due, must-pay oldest first, shortfall carried with no interest, extra at 1 + bonus, balance interest every 4 Sundays — Proof: sunday.test.js "interest is charged on the whole balance left, earlier interest included"
- A 4-week lock comes back on the Saturday before the 4th-next Sunday — Proof: sunday.test.js "a locked 4 weeks comes back on the Saturday before the 4th-next Sunday"
- The goal jar is a Savings-kind holding with its own id and rate 0; Savings totals leave it out, counts include it — Proof: merge.test.js "goal jar: one goal holding per goal, its newest value on both devices"
- A market dip is written once a week the way a holding losing value is — Proof: stream.test.js "a company that went down is worth less, and says so"
- Requests (result, goal, advance, skip, dispute) live in one store with one reader and one answerer; only parents answer; a withdrawn request stays withdrawn — Proof: merge.test.js "requests: a withdrawn request does not come back from the other device"
- Expected money is a parent-only list that merges and removes cleanly — Proof: merge.test.js "expected: an edit travels and a removal stays removed"
- Club owes: the newest club-paid stamp wins; the owed amount is derived from sessions after that week — Proof: merge.test.js "clubPaidThrough: a newer correction wins both ways"
- Two-device checks cover requests, expected, club paid, session answers and goal jars — Proof: merge.test.js "requests: two devices, two asks — both survive"
- A Sunday random run (8 to 20 Sundays, both girls, 60 seeds) holds every invariant every week — Proof: sunday.test.js "the runs really ran (weeks, interest, locks coming back, gates crossed, weeks below 20%)"
- An approved goal switches the jar on only at the Sunday sign, once — Proof: sundayDataOwnersHold
- A claim in a settled week is refused with a sentence for a child and a grown-up alike; own things are answered only for her own week — Proof: aSettledWeekCannotBeClaimed, ownThingsAnswerOnlyForHerOwnWeek
- Goal jars wait for Savings: a shut jar says Goal jars open with Savings, at N% paid off — Proof: goalJarsWaitForSavings
- An unfinished day is never forgiven mid-week: the streak stops at the first day still ahead — Proof: anUnfinishedDayIsNeverForgiven
- One reader, mnyDueThisWeek, gives this Sunday's must-pay for the pool, the Sunday line and the payment — Proof: mustPayIsTakenFirst
- Every on-screen sentence says parents or a parent, not Dad — Proof: moneyWordsAndSmallFixes (the price card names no parent), myMoneyHasNoCashAccount ("My money still says Dad")
- One reader for money my money made, the ledger keeps ownedAfter, and Weeks' earned this year reads the ledger — Proof: passiveIncomeIsCountedAndBaselined
- The Loan per month rescale puts the rounding cent on the last row so the rows add up exactly — Proof: aSkippedSundayStillRescalesHerRows
- Competitions, not meet, wherever it is read on the money screens — Proof: noMeetsOnTheMoneyScreens
- A words check fails retired money words and a raw placeholder on screen — Proof: tests/check-money-words.js
- The money week is Monday to Sunday everywhere; the Sunday to Saturday mapping stays only as tested code and its Rules card is gone — Proof: sunday.test.js "decision 15: the default rules never turn the Sun–Sat mapping on"
- Price cards read Competitions and Box fine, and the quarterly review opens Rules — Proof: moneyWordsAndSmallFixes
- The money fit check: on every money surface, both looks, 390 and 1194, short and long names, no label is clipped, spills out of its box or overlaps another; it finds its roots by data-money-surface and includes Parent › Now — Proof: noLabelIsCutOnTheMoneyScreens
- Her share of steady money is divided in one place, js/43 (sdSteadyShare, sdCommitShares, sdCommitPlan), with the $5 floor and the 50% line — Proof: tests/check-steady-share.js
- Rapid edits coalesce into one write, a dragged block is stamped so a merge cannot lose it, and stamps use server-corrected time — Proof: rapidEditsCoalesceIntoOneWrite, aDraggedBlockIsStampedSoAMergeCannotLoseIt, stampsUseServerCorrectedTime
- A conflict is a parent's to decide, not the clocks'; cloud size warns before the ceiling — Proof: aConflictIsAParentsToDecideNotTheClocks, cloudSizeWarnsBeforeTheCeiling
- Two devices merge: a deleted block does not come back, the newest edit wins, and both devices derive the same balance — Proof: merge.test.js "deleted block not resurrected", "newer-than-tombstone copy survives", "two devices derive the same balance from the merged stream"
- XP: block XP is credited through one writer; the weekly cap is 260 and the level threshold 400 — Proof: xp.test.js "addQuestXP is the only writer of the XP total", "the weekly cap is the calibrated 260", "the level threshold is the calibrated 400"
- Weekly pay: a chore on time and to standard pays $3, the daily cap is $3 and the streak pays the highest tier only — Proof: money.test.js "a chore on time and to standard pays $3", "the daily chore cap is $3", "the streak pays the highest tier only, never the sum"
- Fines: twice costs nothing, the third time costs $1 and a fine can never create debt — Proof: money.test.js "twice costs nothing", "the third time costs $1", "a fine can never create debt"

## Component kit

- One money format: fmtMoney (js/05-helpers.js) writes $3 for whole dollars, $2.50 otherwise, −$3 for a negative (U+2212), +$3 when signed; rounded to the cent like money2 and the same as mnyShort$ and sdD. Nothing calls it yet (PR 6) — Proof: helpers.test.js "agrees with mnyShort$ and sdD from −$500 to $500", "a negative is the minus sign U+2212, never "$-3.00""
- One day format: fmtDay(key, 'short' | 'long' | 'weekday') writes 27 Sep, Sat 3 Oct, Sat from the key alone, the same in every time zone. The Today and Day headers use it; the rest move onto it in PR 6 — Proof: helpers.test.js "long is "Sat 3 Oct" (mnyDayName)", "the same key reads the same day in every time zone"
- kidLabel (js/01-config.js) stays the one kid-name source; mnyKidName, pcwKidName and cfKidName move onto it in PR 6 — Proof: tests/check-globals.js
- One page header: pageHeader({variant, back, lead, title, context, tools, actions, badge, sub, moneySurface}) in js/47-header.js draws back, title, context, at most two actions and the badge far right, every text escaped, and a 44px sub-bar under a 1.5px rule; the header ends in a 2.5px rule under its rows (2px and 1px on a 1x screen); row heights as the owner's header pictures (docs/handoff/consistency/headers/measurements.txt): standard 64px iPad / 60px phone with the kids' 52px buttons and badge, money 72px / 64px with 54px / 52px buttons, meeting two rows 62px / 60px + 44px with 52px buttons (its 🗣️ as the pictures draw it), parent like standard (purple); step (◀ title ▶, its title optionally a button), tools, a named back, the badge's id and noPrint for the kid screens. Today, Week, Day, Sister Sync, Print, the money pages and the meeting use it (PR 4); the portal follows (PR 5) — Proof: helpers.test.js "every slot combination renders in every variant (256 headers)", the six PR 4 slot checks (back.named, step, tools, badge.id, noPrint, step.titleAction) and the lead / pressed / moneySurface check, theComponentKitHoldsItsSizes
- Kit classes .ui-btn (primary, secondary, icon, danger; lg 54px, lg two-line 66px), .ui-chip, .ui-tabs, .ui-card, .ui-sect-head, .ui-sheet, .ui-kids, .ui-stepper read only tokens and keep 44px targets; no screen uses them yet (PRs 7–12) — Proof: helpers.test.js "every listed kit class has a rule and every .ui-* rule is listed", theComponentKitHoldsItsSizes
- Kit tokens in :root, shared by both looks: --radius-pill, --z-header 100, --z-nav 60, --z-sheet 300, --z-dialog 500 (each the layer's z-index today), --hdr-h 64px / 60px at ≤699px, --hdr-money-h 72px / 64px, --hdr-meeting-h 62px / 60px, --hdr-sub-h 44px, --hdr-title-rem (1.75rem / 1.45rem at ≤699px) times --text-scale, applied in .ph-title so a money surface's --text-scale 1 reaches it — Proof: tests/check-look-tokens.js, theComponentKitHoldsItsSizes

## Shell and build number

- Build number is on the page: APP_BUILD equals SW_VERSION and prints as Build <number> on the Today More sheet and the parent App landing — Proof: theBuildNumberIsOnThePage, tests/check-sw-shell.js
- The build number shown is what that device loaded, its offline copy included: js/01-config.js is in the offline shell — Proof: tests/check-sw-shell.js
- Build under the tiles of the More sheet (bottom nav, More) and under the list of the parent App landing, not on Setup — Proof: theBuildNumberIsOnThePage
- The parent App landing and the Today More sheet show Build <APP_BUILD> — Proof: theBuildNumberIsOnThePage
- The picture test writes the build line as one fixed text before every shot, so a new APP_BUILD needs no new pictures (D23) — Proof: tests/pictures.js fixBuildStamp, the CI pictures job
- No unused style: every class in css/app.css is named whole in the source or listed under the file:line that builds it at runtime; a quoted prefix excuses nothing (D22) — Proof: tests/check-dead-css.js
- Sheets are dialogs you can leave, every control has a name, and the app installs to the home screen — Proof: sheetsAreDialogsYouCanLeave, everyControlHasAName, installsToTheHomeScreen
- Escaping holds on every surface — Proof: escapingHoldsOnEverySurface
- The markup says what things are — Proof: theMarkupSaysWhatThingsAre

## Setup and working rules

- Setup and working rules: see hz-claude-config (loaded by .claude/hz-loader.py).
- CLAUDE.md is a pointer: the working rules come from hz-claude-config through .claude/hz-loader.py, and without the session-start line they are read by hand — Proof: CLAUDE.md
- ARCHITECTURE.md holds this repository's own operating rules — Proof: CLAUDE.md
- Every see CLAUDE.md comment in js/ and tests/ means ARCHITECTURE.md — Proof: CLAUDE.md
- WORKING_RECORD.md is the request and deliverable ledger — Proof: CLAUDE.md
- FEATURES.md is the list every regression table is checked against — Proof: CLAUDE.md

## References

The test map: for a change in the area or files named, the tests it needs before a push. The short loop is `npm run test:fast` (about 30 s) plus the Node suites named below (all inside `test:fast`), under 3 minutes. The `SMOKE_ONLY=…` lists are optional and outside that 3-minute target: a `SMOKE_ONLY` run pays a few minutes of setup on a laptop whatever it names. The full suite runs on GitHub before the pull request.

- Tests: any `js/`, `css/app.css`, `index.html`, `sw.js` → `npm run test:fast` (static checks: syntax, globals, shared-merge, escaping, look tokens, money words, steady share, money surface, dead CSS/ids/actions, CI scripts, SW shell)
- Tests: `js/03-sync.js`, `js/04-merge.js`, `js/02-state.js`, `js/38-conflicts.js` → `npm run test:merge`; `SMOKE_ONLY=rapidEditsCoalesceIntoOneWrite,aDraggedBlockIsStampedSoAMergeCannotLoseIt,stampsUseServerCorrectedTime,aConflictIsAParentsToDecideNotTheClocks,cloudSizeWarnsBeforeTheCeiling`
- Tests: money rules and data (`js/18-rules.js`, `js/19-pocket.js`, `js/20-loan.js`, `js/21-money-data.js`, `js/40-stream.js`, `js/41-record.js`, `js/42-flow.js`, `js/43-sunday-core.js`) → `npm run test:money`, `test:stream`, `test:sunday`, `test:xp`; `SMOKE_ONLY=meetingMoneyFlowEndToEnd,sundayInEqualsOut,sundayPaydayAddsUp,onePileFigureOnEveryStep,fromMyBankAddsUp,takenOffIsAlwaysNegative,theMoneyStreamAgreesWithTheWallet`
- Tests: money screens (`js/14-money.js`, `js/15-meeting.js`, `js/22-…25-money-*.js`, `js/44-sunday.js`, `js/45-requests.js`, `js/46-grownups.js`) → the money line above plus `SMOKE_ONLY=everyMoneyControlClicksClean,noLabelIsCutOnTheMoneyScreens` (about 2 minutes on CI on their own)
- Tests: the component kit (`fmtMoney`, `fmtDay` in `js/05-helpers.js`, `js/47-header.js`, the `.ui-*` / `.ph-*` rules and `--hdr-*` / `--z-*` tokens in `css/app.css`) → `npm run test:helpers`; `SMOKE_ONLY=theComponentKitHoldsItsSizes,kidScreensHaveOneStandardHeader,moneyAndMeetingHeadersHoldTheirSizes,oneBackStackGoesWhereYouCameFrom`
- Tests: buffers (travel and get-ready, `js/07-week-view.js`, `js/08-day-view.js`) → `npm run test:buffers`; `SMOKE_ONLY=aBufferStripNeverCoversACard,theStripStillSaysWhenToLeave,theDayViewClipsItsBuffersTheSameWay,printBuffers`
- Tests: Week and Day (`js/07-week-view.js`, `js/08-day-view.js`, `js/09-sheets.js`, `js/39-block-drag.js`) → `SMOKE_ONLY=weekOpensOnTheLayoutYouCanPlanIn,weekScrollsAsOneSurface,theWeekGridKeepsItsColumnFloor,draggingABlockMovesItToTheTimeItWasDroppedAt,resizingABlockChangesOnlyItsDuration,theHourLadderLinesUpWithTheSchedule,onlyTheScheduleScrollsOnTheDayScreen,narrowScreensGetOneDay,copyDayReplacesCleanly`
- Tests: Today and the reflection (`js/31-today.js`, `js/37-reflection.js`) → `SMOKE_ONLY=todayIsTheFrontDoor,todayAnswersWhatNow,todayLeadsWithWhatIsNext,todayNamesFreeTime,todayAgreesWithTheChoreScreen,todayMoneyRowMatchesMyMoney,theReflectionIsHerAnswer,catchUpReachesThisWeekOnly`
- Tests: Chores (`js/13-chores.js`, `js/26-chore-kid.js`, `js/27-chore-parent.js`) → `SMOKE_ONLY=gradeFromQueueClearsIt,gradingPastTheFreeTwoPays,todayAnswersAJobInPlace,somethingElseWorksForAnyOpenDay,learningFromThePortal,parentAnswersForHerFromThePortal,weekChoreReportOnWeek,preSystemWeekReadableInHistory`
- Tests: parent portal (`js/11-parent.js`, `js/28-chore-trends.js`, `js/29-chore-options.js`, `js/32-parent-now.js`, `js/33-parent-app.js`, `js/34-parent-copyweek.js`) → `SMOKE_ONLY=parentScreensMeetTheHouseRules,portalFitsAPhone,trendsRenders,trendsPagingIsBounded,optionsRenders,parentDayTopBarStaysCompact,parentNowCountsWhatIsWaiting`
- Tests: Sister Sync and invites (`js/10-social.js`) → `SMOKE_ONLY=sisterSyncIsATimeline,anInviteCannotBeSentTwice,aMovedSharedBlockSaysSendAgain,sisterSyncTabFitsInTheFallbackFont`
- Tests: profile and navigation (`js/17-ui-misc.js`, `js/99-main.js`) → `SMOKE_ONLY=everyProfileBadgeSwitchesProfile,everyProfileBadgeSaysTheSameThing,kidNavIsUsableAndScoped,navReachesEverythingAndOldRoutesStillWork`
- Tests: looks and layout (`css/app.css`, look tokens) → `SMOKE_ONLY=thePopLookReadsEverywhere,theCalmLookReadsEverywhere,everyTextUsesTheLooksFonts,theLooksKeepTheSameBoxes,kidScreensMeetTheHouseRules,parentScreensMeetTheHouseRules,printIgnoresTheLook`
- Tests: print (`js/16-print.js`) → `SMOKE_ONLY=printIsOnTheWeek,printBuffers,printSideband,printIgnoresTheLook,portalPrintsNoBrokenNumbers`
- Tests: school calendar (`js/35-school-calendar.js`) → `SMOKE_ONLY=schoolCalendarIsRight,everyWeekViewFollowsTheSchoolCalendar,anIcsFileBecomesDaysOffOnlyAfterReview,aBlankWeekOffersItsSchoolDays`
- Tests: markup, escaping and the shell (`index.html`, `js/05-helpers.js`, `sw.js`, `manifest.json`) → `SMOKE_ONLY=theMarkupSaysWhatThingsAre,sheetsAreDialogsYouCanLeave,everyControlHasAName,escapingHoldsOnEverySurface,installsToTheHomeScreen,theBuildNumberIsOnThePage`
- Tests: `tools/cleanup-ci-artifacts.html` → `npm run test:cleanup` (needs a browser, about 1 minute)
- Tests: `tests/smoke.js`, `.github/workflows/ci.yml`, `package.json`, `tools/smoke-times.js` → `npm run test:fast`; then the GitHub run (the checks job, the browser job, the picture job and the smoke job on all four dates) — a CI change is only proven there
- Tests: `tests/pictures.js`, `tests/reference/`, or any screen change (`js/`, `css/app.css`, `index.html`) → the GitHub run's `pictures` job (`gh workflow run ci.yml --ref <branch>`); it gates only on CI, so do not run it locally. References change only from that job's `pictures` artifact
- Tests: a change across several areas, or one the map does not name → the full suite on GitHub (`gh workflow run ci.yml --ref <branch>`)
- Tools: `tools/smoke-times.js <artifact folder> [top]` lists, from a CI run's `smoke-ran-<date>.json` files (`gh run download <run-id> -p 'smoke-screenshots-*' -D <folder>`), each date's wall time, time in checks and setup, then the slowest checks and the longest setup gaps over every date.
- Tools: `tools/picture-diff-page.js <artifact folder> <out.html> [title]` makes the difference page: for every picture in a CI `pictures` artifact's `pictures-diff/`, the old reference (from `tests/reference/`, so run it before copying the new set in) and the new picture side by side, numbered, embedded in one HTML file (`gh run download <run-id> -n pictures -D <folder>`).
- Tools: `tools/unused-globals.js [--tests]` lists top-level `js/` names (function, let, const) that no other code in `js/` or `index.html` names (with `--tests`, `tests/smoke.js` counts as a use too); comments stripped, a heuristic, so confirm each hit with a search.
- Sizes: iPad 1194×834, phone 390×844
- Looks: Pop, Calm
- Figures: the picture-test fixture week (tests/pictures.js FIXTURE, clock Wed 7 Oct 2026 12:00 America/Edmonton, the Sunday signed 4 Oct 2026 19:00). Inputs read from the code: Jenn loan $1000, $336 paid, $70 a month, chores dishes / mop / vacuum / bins graded 3, gift $5 (Grandma), goal New skate guards $35, skating; Jess loan $600, $120 paid, $40 a month, chores dishes / bins / vacuum graded 2, gift $10 (Uncle Mike), goal Book set $50, swimming; each has one assistant-job session; Jess has a tone fine on Tuesday (Mom); Jenn expects $20 at Christmas. Outputs are computed by the app when the pictures are taken and are not written in the code, so each is named with where it shows:
- Figures: each girl's Sunday totals (money in, wall, saved, cash) show on Payday, Signed, the passbook and the Sunday sheet; steady money shows in Grown-ups Commitments and Weeks; commitment % (share of steady money) shows in Grown-ups Commitments and on "New row on my wall"; loan balance shows on the My money loan wall, I choose "What I owe" and Weeks; pocket balances (Savings, Locked away, Companies, Waiting for Sunday) show on My money "What I own", I choose "What I own" and Parent Now "What they own".
- Rules: AllowanceRulesJennJess-v2.md (each rule line names its test)

## Regression table (paste at the end of every edit)
| Regression table | Result |
|---|---|
| Kept | <n> features · Proof: pictures <n> screens × <sizes> sizes, <k> changed (all planned) · tests <passed>/<total> |
| Added | … |
| Intentionally removed | … |
| Missing | … |

