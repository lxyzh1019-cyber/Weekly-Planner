# Chores — where each feature lives now (confirmation checklist)

Plan v4 §5, round R5 (2026-09-24). The Chores screen keeps working, unchanged, until **every row below is ticked by the owner** on the iPad. Only then does C3 (retiring the screen) start, in its own round.

How to confirm a row: do the thing in its **new home** on the iPad, then check the **Chores screen** shows the same answer (both places write through the same owner function). Tick ☐ → ☑ here, or tell Claude which rows are confirmed.

| ☐ | # | What the Chores screen does | New home | How to check it on the iPad |
|---|---|---|---|---|
| ☐ | 1 | Answer how a job went (On time / Late / Redo) | **Today** — tap a job row; it asks right there | Answer a job on Today; it shows answered on the Chores screen |
| ☐ | 2 | ＋ I did something else | **Today**, under "Jobs I can do"; for an earlier day, inside **🕓 Catch up** | Add one for today, and one for two days ago via Catch up |
| ☐ | 3 | Tick routine items; "all N done" | **Today** — the routine card opens to its items; earlier days in **🕓 Catch up** | Tick one item, then "all done" |
| ☐ | 4 | Own things / Helping out | **Today** card | Tap it; the Chores screen shows the same |
| ☐ | 5 | Training attitude 1–5 (her own) | **Today**, on the training block once it has ended; earlier days in **🕓 Catch up** | Rate a finished training |
| ☐ | 6 | Answered grades marked as seen | **Today** — the ✨ chip clears once she has seen them | ✨ goes away after viewing |
| ☐ | 7 | Learning +/− (parent) | **Parent portal › Now**, per kid | Bump learning as a parent |
| ☐ | 8 | Parent answers a job for her ("she told us at the door") | **Parent portal › Now**, per kid and per day of the open week | Answer a job for her from the portal |
| ☐ | 9 | Streak, level, XP bar | **Today** hero (🔥 streak added) | Streak shows on Today |
| ☐ | 10 | Privileges ladder | **Today** — tap the level → "My level" | Opens and lists privileges |
| ☐ | 11 | Daily ceiling bar, fines, weekly total, ledger | **My money** | Same figures as the Chores screen |
| ☐ | 12 | 8-week earnings bars (past-weeks list already there) | **Money story** | Bars match the Chores screen's |
| ☐ | 13 | Open loops (boxed items) | **Today** | A boxed item shows on Today |
| ☐ | 14 | Chore week grid | Catch-up job → **🕓 Catch up** (row 19); whole-week report → **Week tab** | Week report shows the same claims |
| ☐ | 15 | Pre-system weeks' old board | **Parent › History**, read-only (Clear week / Export already in App › Backup and data) | Open an old week in History |
| — | 16 | Portal actions via `ctHandleWrapClick` | **Stays** in the portal | (no change to confirm) |
| — | 17 | 12 dead handler branches, `#choreGroupOverlay` | Removed in C3 | (C3) |
| — | 18 | `#choreProfileBadge`, nav entry, 3 refresh hooks + `openChoreTab`, 21 smoke checks | Go with the screen in C3; checks ported | (C3) |
| ☐ | 19 | **New — 🕓 Catch up** on missed days | **Today**, top card when an earlier day of an unsettled week has something unanswered; one day at a time, oldest first | Skip a day, come back: Catch up offers it; a settled week never appears |

Rows 16–18 are removals or no-ops for C3; there is nothing to confirm there.
