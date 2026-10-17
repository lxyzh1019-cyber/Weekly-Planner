# Weekly-Planner — consistency pass, merged source plan (v2) — for the planner helper

**Written:** 2026-10-06 in claude.ai chat, from the Claude Design review (`app-consistency-plan-v1.md`, `money-recheck-brief-rev1.md`, `header-system-plan.md`, `consistency-pass-plan.md`, all in this folder) plus 5 owner decisions (D9–D13).
**Rules:** hz-claude-config v3.1.32. **Status:** NOT STARTED. Send the `planner` helper to write "Plan v1 — Weekly-Planner consistency pass — Awaiting approval" from this file and the four review files, then wait for approval.
**Save in the repo (first PR):** this file and the four review files under `docs/handoff/consistency/`.

## 1. Owner decisions on record
- D1–D8, as in `app-consistency-plan-v1.md` §1:
  - D1 No full redesign. Fix the header, then consolidate components.
  - D2 Money format: "$3" for whole dollars, "$2.50" otherwise, everywhere. Negatives "−$3".
  - D3 Keep both the Print preview tab and the 🖨 Print button.
  - D4 Profile badge on every kid screen, money pages included.
  - D5 No emoji in screen titles. Section headings may lead with one emoji.
  - D6 Money re-check first, as one PR.
  - D7 The Chores screen may retire after the owner's per-row ✓ (PR 2).
  - D8 Security track (Track S) after this pass.
- **D9 Sizes and looks:** pictures and checks use iPad 1194×834 and phone 390×844, in both looks (Pop and Calm). They go into `FEATURES.md` `## References` as `Sizes:` and `Looks:` lines.
- **D10 Stage 0 first:** a picture test of every screen, the feature list by screen, and slim records come before PR 1.
- **D11 One session:** this session carries Stage 0 and PRs 1–13. It stops only for the owner's merges, iPad reads and approvals listed in §4.
- **D12 Header pictures:** PR 4 waits for the owner-approved Claude Design header pictures (standard, money, meeting, parent; both sizes; both looks). They become the references for PR 4 and PR 5.
- **D13 History to the archive:** old history (comments, plans, audits, hand-overs) moves to `docs/archive/`, never into `WORKING_RECORD.md`. This replaces PR 13's "move history comments into WORKING_RECORD.md".

## 2. Stage 0 (before PR 1)

### PR 0-A — Picture test and references (no app change)
- Add a picture test (`tests/pictures.js`, playwright-core is already a dev dependency) that opens all 13 screens for Jenn, Jess and Parent where the screen differs by user, at both sizes and in both looks, with fixed fixture data and a fixed clock.
- Save the pictures under `tests/reference/<screen>-<user>-<ipad|phone>-<pop|calm>.png`.
- Add a pixel compare in code with a small tolerance. It prints only the pictures that differ.
- *Done when:* two runs in a row give 0 differences; a planted 1-pixel change is caught; `npm test` passes.

### PR 0-B — Feature list by screen and slim records
- Follow the central conversion instructions (session start names the path): coverage list first in `docs/archive/features-coverage.txt`; `FEATURES.md` by screen with `<!-- feature-list: by-screen -->` and a proof per line.
- `## References`: `Sizes:` and `Looks:` (D9); figures = each girl's Sunday totals, steady money, commitment %, loan and pocket balances for the fixture week; rule document = `AllowanceRulesJennJess-v2.md` (each rule line names the money test that proves it; a line without a test is listed to the owner).
- Move to `docs/archive/` (git move, not delete): the build history in `FEATURES.md`, `ARCHITECTURE.md` and `WORKING_RECORD.md`, and the old top-level files `AUDIT.md`, `AUDIT-PRODUCT.md`, `AUDIT-SYNC.md`, `PLAN.md`, `PLAN-PHASE2.md`, `REVIEW.md`, `MODULARIZATION_PLAN.md`, `MULTI_ROLE_REVIEW.md`. Keep `SECURITY_TODO.md` (Track S needs it). The setup notes in `FEATURES.md` become one line pointing to hz-claude-config.
- Mark each `ARCHITECTURE.md` rule `checked by <script>` or `text only`.
- *Done when:* every coverage phrase is found or marked "removed — owner OK"; the three record files keep only the current state; `npm test` passes.

## 3. PRs 1–13 (detail in `app-consistency-plan-v1.md` §2)
1. Money re-check (`money-recheck-brief-rev1.md` in full).
2. Chores screen: a) snapshot for the owner's per-row ✓, b) retire after the ✓.
3. Component kit, no visible change (pixel-identical to the PR 0-A references).
4. Headers, kid screens — **after D12**; compared with the approved header pictures.
5. Headers, parent portal — compared with the approved parent header pictures.
6. Words and numbers (`fmtMoney`, dates, kid names).
7–12. Components, one surface per PR: Today → Week/Day → Money and Sunday → Parent portal → Sister Sync and Profile → sheets and dialogs.
13. Clean-up and guards; history to `docs/archive/` (D13).
Track S (security) stays after PR 13 as its own plan (D8). Until it is done, no public link is shared.

## 4. Stops for the owner
- Every pull request: the owner merges.
- iPad read of the build: after PR 1, PR 4, PR 6 and PR 13.
- Approvals: PR 2a per-row ✓; the header pictures before PR 4 (D12); every difference from an approved picture, shown side by side.

## 5. Content ledger (each agreed point and its search phrase — the plan must contain every phrase)
| # | Point | Search phrase |
|---|---|---|
| 1 | No full redesign | `No full redesign` |
| 2 | Money format | `"$3" for whole dollars` |
| 3 | Keep both print entries | `Print preview tab and the 🖨 Print button` |
| 4 | Badge on every kid screen | `Profile badge on every kid screen` |
| 5 | No emoji in screen titles | `No emoji in screen titles` |
| 6 | Money re-check first | `Money re-check first` |
| 7 | Chores retire after ✓ | `per-row ✓` |
| 8 | Security after the pass | `Track S` |
| 9 | Sizes and looks | `iPad 1194×834 and phone 390×844` |
| 10 | Stage 0 first | `PR 0-A` |
| 11 | One session | `this session carries Stage 0 and PRs 1–13` |
| 12 | Header pictures before PR 4 | `approved Claude Design header pictures` |
| 13 | History to the archive | `never into \`WORKING_RECORD.md\`` |
| 14 | Pixel compare in code | `pixel compare in code` |
| 15 | Rule document to tests | `names the money test that proves it` |
| 16 | Keep SECURITY_TODO.md | `Keep \`SECURITY_TODO.md\`` |
| 17 | Component kit invisible | `pixel-identical to the PR 0-A references` |
| 18 | iPad reads | `after PR 1, PR 4, PR 6 and PR 13` |
| 19 | No public link before Track S | `no public link is shared` |
