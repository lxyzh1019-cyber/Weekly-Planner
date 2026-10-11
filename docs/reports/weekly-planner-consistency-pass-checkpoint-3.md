# Weekly-Planner consistency pass — checkpoint report 3 (2026-10-11)

This is a checkpoint, not the end of the plan. Plan v11 has 56 stages. Build 27 of 37 done. Parts 7, 8, 10 and 9 are ready for your merge.

## Quick read

**Summary**
- Four pull requests are ready: Today, Week and Day, Parent portal, Money and Sunday. Each passed its review and its tests on GitHub.
- Week and Day now show the ✓ and a small ⏱ icon only where they fit, follow an iPad rotation, and start the right block's stopwatch in a 3-day view.
- Your kit gaps K1–K12 are planned as Kit 1.1, after the Money and Sunday merge.

**What changed from the plan**
- The ✓ and ⏱ start at 48px blocks, not 46px: a 46px block has room for only 42px inside its border (your answer A).
- The review of the Day buttons found two older faults that were already on the live app: a ⏱ in a column that is not focused did nothing, and the Day title kept three days after a rotation. Both are fixed in Part 8.
- This report is number 3; the end report (Stage 56) becomes number 4.

**Decisions during the work**
- The first Money and Sunday worker hit its step limit; a second worker finished. One check file outside its list changed so the Sunday styles stay size-checked.
- The Week and Day page counts "22 figures match": the money figures, unchanged because Part 8 changes no money file. It is not a saved before-and-after list.

**Suggestions (blunt)**
- **The pull-request guard asked for a reviewer again after notes-only commits (cost: 3 extra reviewer runs today, about 10 minutes).** Recommendation: let a commit that changes only a compare page or a record skip the new reviewer demand.
- **Reviews kept finding wrong Proof lines (cost: 2 reviewer rounds).** Recommendation: every worker hand-over gives the exact Proof template and says "counts against main, cite the head run".
- **Workers start GitHub runs by hand because a branch push starts none, and each push of a notes file then started a second run.** Recommendation: workers mark notes-only commits [skip ci] every time.

## Measured part

Not included: the report tool sits in the central rules folder, and the command guard refuses commands that name it. The end report tries again.
