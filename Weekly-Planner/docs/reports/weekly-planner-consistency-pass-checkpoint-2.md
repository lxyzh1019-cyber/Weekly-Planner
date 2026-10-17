# Weekly-Planner consistency pass — checkpoint report 2 (2026-10-10)

This is a checkpoint, not the end of the plan. Plan v10 Rev 2 has 46 stages. Stages 1–33 are done. Part 6 — words and numbers is ready for review.

## Quick read

**Summary**
- Done since report 1: the kid headers rebuilt from your exact values (Part 4), parent headers (Part 5), test jobs under 5 minutes (Part 14), a faster one-test run on this PC, and Part 6.
- Part 6: one money style ("$3", "$2.50", "−$3"), one date style ("Sat 24 Oct"), one kid name, and the Day span "Tue–Thu". 23 local formatters are removed. A check now fails on a new one.
- The Sunday numbers are the same as before for both girls (77 numbers each, 0 differ). Only the format changed.

**What changed from the plan**
- Raw `$${n}` money text (48 places) and two hard-coded "$0.00" also moved to the one money style. The reviewer found them. Whole dollars look the same.
- The service-worker check now also checks every style file. The empty style files needed this for their proof.
- 7 phone pictures were refreshed a second time. Emoji edges varied from one GitHub run to the next.

**Decisions during the work**
- Kept as they are, waiting for you: amounts of $100 and up shown rounded ("$140") on the passbook and the Sunday forecast. The whole-dollar figures in the meeting and on the loan screen are kept the same way.

**Suggestions (blunt)**
- **The first Part 6 worker hit its step limit with 7 red checks (cost: 1 reviewer round and 2 extra GitHub runs).** All 7 were test lines that still expected "$X.00". Recommendation: a format change gets one grep of the tests for the old form in the same hand-over.
- **Emoji edge jitter in the picture test cost one extra GitHub run.** The test already shoots a picture 3 times, but that does not help when the whole run draws the emoji differently. Recommendation: hide colour emoji in the picture test (like the build number). Then a real change still fails.
- **Workers may not commit.** The first worker committed anyway. Each later hand-over had to be committed by the main session. Recommendation: say "do not commit" in every hand-over.

## Measured part

Not included. The session's command guard refused to run `plan_report.py`, because the command names the central rules folder. It asks for the Read tool instead. The measured part follows in the end report, once the script can run.
