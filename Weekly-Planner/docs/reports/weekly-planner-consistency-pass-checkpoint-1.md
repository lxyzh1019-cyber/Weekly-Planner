# Weekly-Planner consistency pass — checkpoint report 1 (2026-10-09)

Checkpoint, not the end of the plan. Plan v9 (42 stages), Stages 1–18 done, PR 4 open for a fix round.

## Quick read

**Summary**
- Done: the test base (short loop, picture test, fixed dates), the money re-check, Chores retired, the component kit, the first kid headers. 7 pull requests merged, PR 4 open.
- The kid headers in PR 4 did not match the owner's pictures. They are rebuilt from the owner's exact values in Plan v9.
- A one-test run now takes 33 s instead of 149 s.

**What changed from the plan**
- The test split (PR 0-split) took three designs (Plan v4–v6) before the owner chose one smoke job per date. It cost the most rework before PR 4.
- An extra Fix stage: the Rules search hint was cut off in Calm at reading size 1.3 (main was red after PR 1).
- An extra stage: the fast one-test run (149 s → 33 s), merged into the PR 4 branch.
- PR 4 fix round (Plan v9): the header is rebuilt from the exact values, with a measurement test, a one-header pilot, and the rule "the picture wins".

**Decisions during the work**
- D14 Reading size 1.2 by default (PR 5). D16 no full test suite on this PC. D18 the pale Calm "with Mum" text is fixed in PR 7.
- D20 one smoke job per date, about 8 minutes accepted. D21 the owner's Claude Design package is the header reference.
- D22 the unused-style loophole is closed. D23 the picture test hides the build number. D24 the four overnight PR 3 choices are kept.
- D25–D28 avatar on every kid header, Today's date on the phone, Copy a day by tapping the Day date on the phone, "Tuesday 6 Oct".
- D29–D33 rebuild from the exact values; differences 1 and 9–14 follow the picture, 2–8 stay, 15 is 20px if it fits at 360; smoke measures every header; new comparison page, iPad Pop first.
- D34 this report. D35 PR 5 stacks on the PR 4 branch. D36 the picture wins. D37 one header first. D38 rule proposal to the central rules.

**Suggestions (blunt)**
- **PR 4's proof measured only the header height (cost: one full rework, 220 references refreshed twice).** Remove "same height per kind" as a proof for any screen built from an owner picture. Replace it with a test of every value in the owner's table, written before the build (now in Plan v9).
- **Differences from an approved picture were sent to the owner as 15 questions.** Remove this habit. The picture wins; only a part that cannot fit becomes a question (D36).
- **Test runs are the biggest time sink (312 min, 41%; median one-test run 2.8 min over 66 runs).** The fast one-test run (33 s) fixes most of this from now on. Keep it; measure again at the next report.
- **The main session ran above 200 k context in 392 of 1095 steps (29.9 M tokens).** Type /compact at every stage break, and send long work to fresh workers.
- **Plan approval waits were long (428 min on one Plan v4 showing).** Ask all questions in one message before the plan, as the rules say; do not show a plan with open questions.
- **99 refused steps.** Most were format and routing refusals. They cost time but caught real gaps (missing Rev marks, missing proof); keep them.

One-test run: 149 s before PR #136, 33 s after (one `SMOKE_ONLY` check on this PC; `kidScreensMeetTheHouseRules` still 119 s because it walks every screen).

## Measured part (by code, from the session files)

## Top 3 time sinks (time first)

1. **test runs**: 312 min (41%). Fix: make a one-test run start in under 1 minute; run long tests in the background.
2. **model thinking**: 284 min (37%). Fix: fewer steps: read several files in one step, smaller hand-overs.
3. **other commands**: 69 min (9%). Fix: look at the slowest steps below.

## Top 3 token sinks (tokens second)

1. **opus-worker**: 138.2 M (51%). Fix: give Routine work to sonnet-worker; bigger hand-overs, fewer restarts.
2. **main**: 111.7 M (41%). Fix: type /compact at stage breaks; keep big files out of the main session.
3. **main context above 200 k**: 29.9 M (11%). Fix: type /compact at each stage break above 200 k.

**Slow one-test runs:** 66 runs, median 2.8 min. Make a one-test run start in under 1 minute in this app. The next plan offers it as decision A, with the saving (about 120 min on a plan like this).


| Measure | Value |
|---|---|
| Sessions | 8 |
| Session time (sum) | 38.6 h |
| Tokens | 273.6 M |
| Tool calls | 2398 |
| Hook time per call (median Read/Grep/Glob) | 1.15 s |
| Test runs (time in test commands) | 312 min |
| Helpers started | 52 |
| Refused steps (checks) | 99 |
| Main session context: at start / peak | 71 k / 447 k |
| Main steps over 200 k context | 392 of 1095 |
| Compactions (/compact) | 2 |

**Tokens by helper:** opus-worker 19× 138.2 M · main 8× 111.7 M · sonnet-worker 9× 11.1 M · reviewer 15× 10.0 M · Explore 6× 1.6 M · planner 3× 1.0 M

**Slowest steps (60 s or more):**
- 428.1 min · main · ExitPlanMode · `{"plan": "# Plan v4 \u2014 Weekly-Planner consistency pass \u2014 Awaiting approval\r\n\r\`
- 178.4 min · main · AskUserQuestion · `{"questions": [{"question": "Since today (7 Oct), GitHub's tests fail on main too: on the `
- 92.9 min · main · Agent · `{"subagent_type": "opus-worker", "description": "Build PR 0-A picture test", "run_in_backg`
- 60.2 min · main · Agent · `{"subagent_type": "opus-worker", "description": "Fix money click check on two dates", "run`
- 48.6 min · main · Agent · `{"subagent_type": "opus-worker", "description": "Build PR 0-pre", "run_in_background": fal`
- 31.0 min · main · ExitPlanMode · `{"plan": "# Plan v4 \u2014 Weekly-Planner consistency pass \u2014 Awaiting approval\r\n\r\`

<!-- metrics: {"sessions": 8, "wall_min": 2316.4, "tokens_m": 273.6, "tool_calls": 2398, "helpers": 52, "test_min": 312.5, "refusals": 99, "floor_s": 1.15, "ctx_start_k": 71, "ctx_peak_k": 447, "steps_over_200k": 392, "over_200k_tokens_m": 29.9, "main_steps": 1095, "compacts": 2, "time_kinds": {"test runs": 312.5, "waiting for GitHub": 56.2, "other commands": 68.9, "model thinking": 283.8, "waiting for you": -3.4, "hook time on every call": 46.0}, "one_test_runs": 66, "one_test_median_s": 169, "tokens_by_helper": {"main": 111.7, "Explore": 1.6, "opus-worker": 138.2, "reviewer": 10.0, "sonnet-worker": 11.1, "planner": 1.0}} -->
