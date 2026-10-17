# Round 1 change list — claude/consistency-r1 against main

`change_list.py origin/main` at the Stage 53 head (2026-10-11); one plain line per file.

| File | Lines | What |
|---|---|---|
| `ARCHITECTURE.md` | changed 4066–4079, 4321, 4324 | Dark-mode rule removed (K3); --pill-on now equals --sel / --sel-ink (K11); retired .gu-opt/.rq-opt dropped from the picked-option list. |
| `FEATURES.md` | added 50, 59, 107, 219–221, 307, 494; changed 32–34, 287, 294, 319–320, 427–428, 473 … | By-screen lines and test map for Kit 1.1, Part 11 rows, Grown-ups/request sheet, Sunday ok look, steppers, choose row; sunday-figures tool line. |
| `WORKING_RECORD.md` | added 18–39, 260; changed 6, 9–10, 268, 452–461, 463–469, 471–516 | Stage rows 49-55 and 41 with their evidence. |
| `css/app.css` | added 2–3, 125–126, 4797–4800, 4806–4807, 4817, 4820–4828 …; changed 420–421, 426–429, 524, 583–584, 589–592, 939 …; removed old 331–338, old 736–801, old 1048–1052, old 1863–1865, old 1887–1889, old 3213–3329 … | Kit 1.1 tokens and parts (K1-K12); the rules the lanes left unused deleted (Grown-ups/request-sheet old buttons, round stepper, old profile/Sync copies, #parentWeekKidPills, .week-nav). |
| `css/money.css` | changed 128, 299–302; removed old 115 | Sunday: private green yes removed (ok look), choose row fits two rows on a phone. |
| `css/parent.css` | added 147, 251–268; changed 174–179; removed old 145–152 | Portal and Grown-ups layout for the kit day row, switch and steppers. |
| `css/social.css` | changed 1–263 | Profile picker, switcher and Sister Sync styles moved here from app.css. |
| `css/today.css` | changed 43, 386–391, 491–495; removed old 632, old 660 | Today rows on the kit list row; private row rules removed. |
| `css/week-day.css` | added 47–49, 65–68; changed 51 | Week glance and Day checklist rows on the kit list row. |
| `docs/handoff/consistency/app-consistency-plan-v1.md` | added 28–38 | D9-D14 copied as dated notes. |
| `docs/handoff/header-exact-values.md` | added 134–135 | Dated line: copy stands (D66); Week Switch built to the sub-bar rows (D81). |
| `docs/handoff/kit-1-1-values.md` | new file | New: the Kit 1.1 value table. |
| `docs/handoff/looks-calm-pop.md` | changed 105 | Dark-mode note updated. |
| `docs/reports/weekly-planner-consistency-pass-stage-59-maps.md` | new file | New: the explorer map for Round 1. |
| `index.html` | changed 118, 492–493, 495, 502–505, 507, 512–513 | Profile picker and Sister Sync markup on the kit, inline styles moved to classes. |
| `js/01-config.js` | changed 17 | APP_BUILD 2026-10-11t. |
| `js/06-quests.js` | changed 738–745, 750–751 | Profile switcher rows are kit rows. |
| `js/07-week-view.js` | changed 408, 554–557 | Week Switch uses pv-btn pb-action (D81); glance rows are kit rows. |
| `js/08-day-view.js` | changed 1570–1573, 1586, 1588–1589, 1619–1620, 1803 | Training checklist rows are kit rows. |
| `js/10-social.js` | changed 708, 726, 732–733, 790, 804–805, 815 … | Sister Sync buttons and heads on the kit. |
| `js/11-parent.js` | added 421, 442; changed 426–431, 444–445, 447–448, 450, 511, 565 …; removed old 1482 | Portal kit switch and day row; dead #parentWeekKidPills query removed. |
| `js/31-today.js` | changed 878–881, 920, 922–924, 980–982, 985, 987–989 … | Today rows and catch-up on the kit list row. |
| `js/32-parent-now.js` | added 413; changed 236, 281–284, 298–299, 305, 307, 380 … | Now: kit day row, ok buttons, full-width Run family meeting. |
| `js/44-sunday.js` | changed 372, 382, 430, 446, 449, 453 … | Sunday yes answers ok look; 52px kid steppers. |
| `js/45-requests.js` | added 651–652; changed 643–645, 647–649, 794, 803, 864, 902 … | Request sheet chips, 52px steppers and close button on the kit. |
| `js/46-grownups.js` | added 246; changed 220, 242–243, 344–346, 351, 355, 385 … | Grown-ups tabs, chips, buttons and steppers on the kit. |
| `plans/consistency-plan-v11-rev4.md` | new file | New: the approved plan v11 Rev 4. |
| `sw.js` | changed 29 | SW_VERSION 2026-10-11t. |
| `tests/check-look-tokens.js` | added 86–90, 480–515; changed 10, 537–538 | Rule 6: no dark scheme. |
| `tests/helpers.test.js` | changed 233–236 | Kit value checks updated. |
| `tests/smoke-parts/looks.js` | changed 68–69, 123, 154, 156, 187–188, 199 … | Look checks follow K11 and dark-mode removal. |
| `tests/smoke-parts/money-screens.js` | added 549–574, 606, 609–610, 614–616, 619, 662–723; changed 1, 503–510, 599–603 | Sunday kit checks extended; theSundayChooseRowFitsTwoRows. |
| `tests/smoke-parts/parent.js` | added 31–58, 60–62, 85–89, 119–122, 126–160, 162; changed 18, 73–78, 92, 100, 108–114 | Portal and Grown-ups kit measurements (44/52 steppers, day rows, switch). |
| `tests/smoke-parts/parts.js` | added 42–43, 46; removed old 333 | New checks listed in their parts. |
| `tests/smoke-parts/social.js` | new file | New: sisterSyncIsOnTheKit, theProfileScreensAreOnTheKit. |
| `tests/smoke-parts/today.js` | added 92–142; changed 1, 43, 82 | Today kit-row checks (withMumReadsInBothLooks). |
| `tests/smoke-parts/week-day.js` | added 68–97, 112–114, 238–252, 271–272; changed 1 | kitButtonsHold44pxOnWeekAndDay rows. |
| `tests/smoke.js` | added 18, 26839–26994, 28111–28112; changed 10569, 10971, 10981, 11599, 13190, 13252 …; removed old 16098–16201 | Header check measures .pb-switch; dark-mode check removed; kit checks. |
| `tools/sunday-figures.js` | new file | New: Sunday text and figure dump (Stage 52). |

151 pictures in `tests/reference/` refreshed from run 38203588225 (binary; not in the table above).
