# Checkpoint report 4 — Weekly-Planner consistency pass — Round 1 (Kit 1.1 + Part 11)

## Quick read

**Summary**
- Round 1 is built, joined into one branch and green on GitHub, pictures included. It goes to you as one pull request.
- Kit 1.1: dark mode is gone, with a guard. The kit has the K1–K12 parts, and every value is measured on a test page. Now, She told me, Meeting, Grown-ups and Sunday use the kit.
- Part 11: Sister Sync and Profile, Today's rows, the Week summary rows and the Day checklist use the kit. 151 pictures changed; each picture belongs to a numbered row on the compare page.

**What changed from the plan**
- The plan named 3 dark-mode rules and 7 dark colour values. There were 2 rules and 6 values. Several line numbers were also wrong; the Stage 59 maps fixed them.
- The Meeting day row was in the parent screen files, so Stage 51 built it, not Stage 52.
- The Sunday "My week" strip stays as it is (your answer G5).
- Your answer G14 (A) adds two Round 2 lanes (Stages 62 and 63). The plan grows from 59 to 61 stages.
- Stage 41 also changed the file that draws the profile switcher, because the switcher rows are built there.
- The Sunday choose row fits 2 rows in Pop. In Calm it takes 3 rows, so that check is for Pop only, as D73 says.
- Your corrected kit-gaps note has not arrived. Stages 50 and 53 stay partly done until it does.

**Decisions during the work**
- The 52px girl stepper is used on the request sheet and on Sunday. The 44px stepper is used where only a parent uses it (G4).
- A day still to come stays tappable on Now and Meeting. It has its own dashed look, not the disabled look (reviewer finding, G2).
- A row waiting for Mum gets the done colour, but its name is not struck through (reviewer finding).

**Suggestions**
- The report tool counts 457 "PR n" against 76 "Part n" across all sessions. Most are in older records; the plan and the ledger now use "Part n".
- 36 pull requests were opened for 23 merge stops in this plan's history. Round 1 has one pull request for one stop, as D78 requires.
- The emoji edges flipped one money picture on almost every run. Hiding emoji in the picture test (Part 13) removes these reruns.
- The picture test can only show the Week summary and an open catch-up day with local screenshots. Add them to the reference set in Part 13.

## Measured part (by code, from the session files)

### Top 3 time sinks
1. Model thinking: 841 min (36%).
2. Test runs: 687 min (30%).
3. Waiting for GitHub: 460 min (20%).

### Top 3 token sinks
1. opus-worker: 394.2 M (52%).
2. Main session: 246.0 M (32%).
3. Main context above 200 k: 99.3 M (13%).

### Scorecard (selected)
| Solution | Measured | Result |
|---|---|---|
| Reviews per pull request (goal ≤ 2) | max 5 | does not work |
| Pull requests per merge stop (goal 1) | 36 opened, 23 stops | does not work (Round 1: 1) |
| Sonnet share of hand-overs (goal ≥ 40%) | 34% | does not work |
| Main session share of tokens (goal < 35%) | 12% | works |
| "Part n" instead of "PR n" | 457 PR n · 76 Part n | does not work (old records) |

### Totals
13 sessions · 65.4 h · 757.6 M tokens · 7,580 tool calls · 150 helpers · 202 refused steps · 2 compactions.

**One-test time:** a single smoke check on this PC starts in under 40 s (D41); the Stage 53 run of 12 lane checks passed in one run.

## Round 1 evidence
- Code head 068daa7, GitHub run 38207380390: all 6 jobs green, 0 picture differences.
- Pictures: 151 changed against main, each one on a K or Q row of the compare page round1-compare.html.
- Sunday figures: 408 before and 412 after, 0 changed. The 4 new figures are the "$80" chart label (Q-b).
- Reviewer: 4 findings, all fixed. The re-check found no blocking problem. The only open item is the kit-gaps note.
- File list: docs/reports/round1-change-list.md.

## Regression table (against FEATURES.md)
| | |
|---|---|
| Kept | Every Today, Week, Day, parent, Grown-ups, Sunday, Sister Sync and Profile flow; the "with Mum" contrast; the header measurements |
| Added | Kit 1.1 rows; Today, Week and Day row rows; the Sunday ok look, the 52/44 steppers and the 2-row choose row; the no-dark-mode guard |
| Intentionally removed | Dark mode; the private day chips, green yes, round steppers, private kid pills, private rows and the old Profile and Sister Sync rules |
| Missing | none |
