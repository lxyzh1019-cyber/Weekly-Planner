# Weekly Planner money: re-check fixes — Rev 1 (after full checks, 2026-10-06)

Changes to the brief dated 2026-10-06 (build 2026-10-06e). The code is unchanged since then: the only new commits are two `.claude/agents` files.

```diff
+ 0. Before any edit: hotspot rule. Pocket money has 7+ fix rounds. Add this round to the counter
+    and present a short rewrite-vs-repair note (expected: repair, because the cause is duplicated
+    logic, not the model).
! 1. Commitment card: the line is 46-grownups.js:537, not :538.
+    The same bug is in TWO kid-facing places: 44-sunday.js:1301 (`pct`, the "New row on my wall"
+    pop-up: "Part of my steady money", the ⚠️ over-half verdict) and :1323 (the "one more club
+    session → %" idea). Both divide by steady with no $5 floor. All three read sdCommitPlan
+    (lowSteady, r0/r1).
+    Also :1307 "Left for me to choose" = steady − p1 can go negative. With lowSteady, use the
+    form's wording instead of a figure.
!    Without this, fix 3's new check fails on 44-sunday.js and the PR cannot go green while it
!    says "don't change anything else".
! 2. Font: two hand-kept root lists disagree.
!    css 8389 (--text-scale: 1) has .pn-grid and #pnToldOverlay; css 8398 (--font-round) has
!    .mm-head--two and .mny-head--big. Adding three classes to 8398 repeats the root cause.
!    Fix: one attribute, data-money-surface, on every money root (My money, Money school, All my
!    Sundays, By month, Sunday steps, Grown-ups, Parent › Now money cards, request/told/Sunday
!    overlays). Both rules select [data-money-surface]. Then delete the two lists.
! 3. The font smoke check must find screens by [data-money-surface], not a list, and include
!    Parent › Now.
! 5. Wrong diagnosis. `.gu-search-label` is already screen-reader-only (css 8141: 1px clip).
!    The clipped text is the input's placeholder "Find a price or rule…" (46-grownups.js:990).
!    Removing nowrap does nothing; removing the clip would show the words twice.
!    Fix: placeholder "Find…" at ≤699px, or let the input take the column width.
  6. Confirmed as written (42-flow.js:132).
+ 7. Stale comment 15-meeting.js:1008 ("Sun–Sat from 11 Oct 2026") contradicts decision 15.
+    Fix the comment only. Deleting the Sun–Sat mapping code is a later stage.
```

**Then:** as before. Also report the iPad read of build 2026-10-06e. None of the builds since 2026-10-05d has been read on the iPad.
