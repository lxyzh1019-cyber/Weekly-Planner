# WORKING RECORD — Weekly-Planner — rules v2

Single working record for this repository. Updated by the main session at the end of every implementation turn (the record guard hook checks this). Keep it terse; history lives in git.

## Approved baseline
- 2026-09-21, branch `Rules-v2`: install working-rules bundle v2.1 into the repo root, verify with `tests/replay-hooks.sh`, commit and push. Given as a direct instruction rather than a Plan vN — the session predates the plan gate, which loads only from `main`.
- 2026-09-21, in-session decision (asked and answered): `CLAUDE.md` is **split**, not overwritten. Bundle global rules take the `CLAUDE.md` filename; this repo's architecture doc moves to `ARCHITECTURE.md`.
- 2026-09-22, branch `claude/inspiring-gauss-232zww`: **Plan v4 approved** — "The non-money half, plus the pocket-money handoff". Three staged commits (school-day offer · profile badges · watch a sister compete), one draft PR. All pocket-money work is deferred to `HANDOFF-pocket-money.md` and a separate chat, at the owner's instruction.
- 2026-09-22, owner's four decisions on record (AskUserQuestion): a kid may **propose** a meet (deferred to the handoff); **Dance** comes out of the competition categories and **skating star level** goes in, with an editable category table (deferred); watch/accompany is built by **extending Sister Sync invites** with a `watching` flag on the competition block, no competition reward, no money-tab link; delivery is **one branch, staged commits, one PR**.

## Pending
- PR [#91](https://github.com/lxyzh1019-cyber/Weekly-Planner/pull/91) **merged** 2026-09-21 as `f4d1db5`. (This line previously said "awaiting the owner's merge" — corrected 2026-09-22.)
- **PR [#93](https://github.com/lxyzh1019-cyber/Weekly-Planner/pull/93) — draft, open, awaiting the owner's review and merge.** Branch `claude/inspiring-gauss-232zww` pushed 2026-09-22 with commits `504cea2`, `b4b62dd`, `d3fb2b6`, `684eb2c`, `c811cda`.
- **Approved (#33), in progress:** 4a `SMOKE_ONLY` ✅ `126506a` · 4b build number ✅ `a03f1c2` · 4c dead-button check ✅ `46c7306` · 4d repeat-invite guard (building) · 4e 💌 note on Today.
- **Not approved, proposed for its own round:** tier-2 click sweep; tier-3 logic review of non-money screens.
- All pocket-money items are **open but not in this round**. See `HANDOFF-pocket-money.md` §12 for the order they should be taken in.

## Request ledger
| # | Round/date | Requirement (user's words, short) | Status | Note |
|---|---|---|---|---|
| 1 | R1 2026-09-21 | "Check out branch rules-v2" | done | Actual remote branch is `Rules-v2` (capital R). |
| 2 | R1 2026-09-21 | "Unzip working-rules-bundle-v2(2).zip with Python" | done | Real filename `working-rules-bundle-v2 (2).zip` (space before paren); `zipfile` extract. |
| 3 | R1 2026-09-21 | "Copy the contents of bundle/ into the repo root" | done | `.claude/`, `CLAUDE.md`, `FEATURES.md`, `WORKING_RECORD.md`, `tests/`, `docs/` at root. `tests/` merged into the existing dir; nothing removed. |
| 4 | R1 2026-09-21 | "If .claude/settings.json already exists, merge it" | done (no-op) | No pre-existing `.claude/` in this repo, so the bundle copy went in whole. Merge branch never applied. |
| 5 | R1 2026-09-21 | "Delete the zip and docs/CLAUDE.review-rev1.md" | done, **deviated** | No `rev1` exists in repo or bundle. Bundle ships `rev2` and its own README says to delete `rev2` on install. Deleted `docs/CLAUDE.review-rev2.md`. Flagged to user. |
| 6 | R1 2026-09-21 | "Make .gitignore track .claude/ and ignore .claude/state/" | done | Also added `__pycache__/` + `*.pyc` — running the hooks generated a `.pyc` that had staged itself. |
| 7 | R1 2026-09-21 | "Run bash tests/replay-hooks.sh and show the last line" | done | `passed=14 failed=0`. Matches the bundle README's expected result. |
| 8 | R1 2026-09-21 | "Then commit and push to rules-v2" | done | Commit `59dfc1d`, pushed to `Rules-v2`. |
| 9 | R1 2026-09-21 | Implied by #3: bundle `README.md` to root | **intentionally not done** | Bundle README is the install guide; absent from its own "Where the files land" table and from the user's enumeration. Overwriting the project README would have lost it. Flagged. |
| 10 | R1 2026-09-21 | Raised in-session: architecture doc must survive the install | done | User chose "Split". See Approved baseline. |
| 11 | R2 2026-09-22 | "I could quickly add school block on the weekly view, the feature got dropped" | in progress | **Confirmed regression.** `93caf9c` deleted the second host `#tgSchoolBanner` with the Day Blocks tab. Stage 1 restores it as `#weekSchoolBannerTop` and adds per-day chips. |
| 12 | R2 2026-09-22 | "Today tab, the profile picture top right does not let you switch profile" | in progress | **Confirmed bug, and it is three screens** — Today, Chores, Sister Sync are inert `<div>`s. Stage 2. Owner raised one; the whole scope was checked per his standing instruction. |
| 13 | R2 2026-09-22 | "Add competition day watch/accompany feature" | in progress | Stage 3. Owner chose: extend Sister Sync, `watching` flag on the block, no reward, no money link. |
| 14 | R2 2026-09-22 | "The add school days banner shows above AND below on an empty week; only below when something is booked — reconsider your proposal" | done | Owner's correction **invalidated Plan v1's fix**, which would have deleted the above-the-fold copy. Plan v2 reversed it to a second host. |
| 15 | R2 2026-09-22 | "Competition cannot be added in the Money tab under Jenn/Jess" | **deferred to handoff** | **Working as designed** — four deliberate gates, `ARCHITECTURE.md:2247`. Owner chose to add a propose path. Handoff §9. |
| 16 | R2 2026-09-22 | "Old rules still showing on the Money tab, against the previous PR" | **deferred to handoff** | **Confirmed regression**, root cause worse than the symptom: no migration for saved rulebooks. Handoff §7 + §8 D3. |
| 17 | R2 2026-09-22 | "Jenn shows 0 cash, Jess shows $50 — why" | **deferred to handoff** | **Not a bug.** No seeded or default balance exists anywhere in `js/`. Handoff §10 carries the iPad steps to confirm. |
| 18 | R2 2026-09-22 | "Remove the Dance category (it is a skating level exam); add skating star level; I need edit ability in Money rules" | **deferred to handoff** | Amounts are already editable; the **rows** are not. Handoff §2. |
| 19 | R2 2026-09-22 | "Check every promise you made in PR90 — a lot are not delivered" | **done (audit), fixes deferred** | Audited 15 promises: **13 delivered, 2 partial, 3 tests that would not fail on regression.** The premise did not hold; the real problem is delivered-but-unreachable. Handoff §0 and §11. |
| 20 | R2 2026-09-22 | "Gifts need to be editable — date and money, parent approves the change" | **deferred to handoff** | A parent CAN edit both. Three date bugs found; a kid has **no** edit-proposal path. Handoff §6. |
| 21 | R2 2026-09-22 | "Money rule is not editable in parent portal" | **deferred to handoff** | **Editor exists and is wired** — Setup → 💰 Money rules. A mid-session claim that no rules editor was ever built was **wrong and is corrected on record**. Handoff §2. |
| 22 | R2 2026-09-22 | "Move money into category all greyed out, why? And the category is not correct" | **deferred to handoff** | By design: the 30/60/90 unlock ladder keyed to loan-paid %. Root cause worth changing — `mnyPaidPct` returns 0 when a kid has **no loan**, pinning her at stage 0 forever. Historical category list recovered from `437f79a`. Handoff §3 + §4. |
| 23 | R2 2026-09-22 | "Duplicated information between My money and Money school" | **deferred to handoff** | 7 overlaps; 6 cosmetic, **1 real defect** (`MNY_PAID`/`MNY_UNPAID` hardcode a parent-editable count). Handoff §8. |
| 24 | R2 2026-09-22 | "Where is the cash pool?" | **answered, deferred** | **There is no family cash pool** and no function sums across both kids. "One pool" means fungible inflows per kid. PR #89 answered this with the Flow screen, shipped as 📖 My money story. Handoff §5. |
| 25 | R2 2026-09-22 | "Separate this into two sections — plan the others here, hand off the pocket money" | done | Plan v4 covers #11/#12/#13 only; `HANDOFF-pocket-money.md` (427 lines) carries #15–#24. |
| 26 | R2 2026-09-22 | "I do not need the add school day banner in two places — keep it above the calendar only" | done | Narrows Plan v4 §1 mid-implementation (**Rev 4**). Stage 1 shipped two hosts and was green; Stage 1b retires the below-grid `#weekSchoolBanner` so the top host is the only one. Folded in two defects the worker flagged: `addSchoolDayToDay` now filters through `schoolDaysToOffer` (a stale chip could write a duplicate card), and the confirm reads "Add it" for one day. |
| 27 | R2 2026-09-22 | "Fix the repeat invite for the sister invite, and brief me where is the best place to send the invite for a regular block like game time" | **proposed, not approved** | Three gaps found: `sendInvite` has no duplicate guard, `acceptInvite` has no status guard (a double-tap writes two blocks), and `invitedTo` conflates share and watch. Briefing given: the edit sheet, opened to kids — today a child can only invite from the Sister Sync screen. Plan v5 §4. |
| 28 | R2 2026-09-22 | "Integrate sister invite into the Today tab; I don't see importance in keeping Sister Sync as a separate tab unless you find something I missed" | **proposed, not approved** | Found what was missed: the 💌 inbox is the **only** place an invite can be accepted — retire the tab and invites become send-only. It also carries the both-free overlap, the side-by-side day and Challenges (`state.shared.challenges`, own merge decision). Recommended moving the inbox to Today first. Plan v5 §5. |
| 29 | R2 2026-09-22 | "Value engineering on the scope and the execution plan" | **done (review), build not approved** | Six items. Top two: **no visible build stamp exists**, so the owner's own deploy rule is unsatisfiable on this app; and `tests/smoke.js` (15,936 lines, 312 checks) has **no filter**, so every iteration is a full 8–10 min run. Plan v5, Rev 7. |
| 30 | R2 2026-09-22 | "Is it reasonable to test all the buttons and check the logic, except money?" | **answered** | Yes, in three tiers. Tier 1 done read-only this turn: **170 `onclick` targets, 0 missing; 177 delegated actions across 13 prefixes, 0 without a handler** (3 scanner hits verified false positives). Tiers 2 and 3 proposed, not approved. |
| 31 | R2 2026-09-22 | "They do use Sister Sync" | done | Answers VE item 4. **Retiring `#screen-sync` is off the table.** §5 shrinks from moving the invites inbox onto Today (which would now mean two inboxes for one list) to an optional one-line 💌 notice on Today that opens Sister Sync. §4 becomes more valuable, not less — the gaps it fixes are hitting a feature in use. |
| 32 | R2 2026-09-22 | Implied by the approved Plan v4: push and open a draft PR | done | Pushed `claude/inspiring-gauss-232zww`; draft PR #93 opened. Push was taken under Plan v4's standing approval and to secure five verified commits held only in an ephemeral container — no new build work was started without approval. |
| 33 | R3 2026-09-22 | "Regarding the decisions, I agree all 5." | in progress | **Approval** of Plan v5's five items: (1) repeat-invite guard + kid share from the block; (2) visible build number; (3) `SMOKE_ONLY`; (4) dead-button check; (5) 💌 note on Today. Built as stages 4a–4e, tooling first. |

## Hotspot counter
| Area / feature | Fix rounds | Recurrences | Last symptom | Rewrite-vs-repair reviewed? |
|---|---|---|---|---|
| Rules/governance install | 1 | 0 | — (first round) | n/a |
| `CLAUDE.md` filename collision | 1 | 0 | Bundle and repo both claim the root `CLAUDE.md`; different documents | yes — resolved by split, not patch |
| **Pocket money** | **3** | **1** | Kid Money tab still shows pre-house-rules prices; Move-money destinations all greyed; categories renamed away from the family's vocabulary | **NO — and the rule now BLOCKS the next patch.** PR #89 (Stages 1–3), PR #90 (Stages 4–6), this round. The comparison is the first deliverable in the handoff chat; `HANDOFF-pocket-money.md` §1 names the shared cause (three key-spaces for one idea: `EV_HOMES` / `MNY_BUCKETS` / `MNY_HOLDING_KINDS`). |
| Week-view school offer | 1 | 0 | Offer only below a ~700px grid once anything is booked | n/a — first fix round; cause is a host deleted with the Day Blocks tab |
| Profile badge | 1 | 0 | Three inert `<div class="profile-badge">` with a false `aria-label` | n/a — first fix round |
| Sister Sync invites | **2** | 0 | Round 2 (4d): no duplicate guard in `sendInvite`, no status guard in `acceptInvite`, and a **second inline writer** (`inviteSisterFromEdit`) that bypassed `sendInvite` entirely | Not required at 2. **The next fix here makes 3 and triggers the comparison.** 4d reduces the surface to one writer, which is the structural answer. |
Rule: 3 fix rounds, or 2 recurrences, or a fix causing a nearby regression → no further patch until the comparison is presented.

## Deliverable ledger
| Deliverable | State | Evidence |
|---|---|---|
| `.claude/` (settings, 6 hooks, opus-worker agent, hz-guarantee-audit skill) | COMPLETE | Committed `59dfc1d`; `replay-hooks.sh` 14/14 |
| `CLAUDE.md` — global working rules v2.1 | COMPLETE | 13.5KB at root, with `ARCHITECTURE.md` pointer block |
| `ARCHITECTURE.md` — Weekly-Planner architecture doc | COMPLETE | `git mv` from `CLAUDE.md`, 163KB, history preserved |
| `docs/HZ-skill-trigger-tuning.md` | COMPLETE | Committed; `docs/CLAUDE.review-rev2.md` deleted per install procedure |
| `tests/replay-hooks.sh`, `tests/test-routing-hook.md` | COMPLETE | `passed=14 failed=0` |
| `.gitignore` — track `.claude/`, ignore state + pycache | COMPLETE | `git status` clean of `.pyc` |
| `WORKING_RECORD.md` filled for this repo | COMPLETE | this file |
| `FEATURES.md` — governance surface | COMPLETE | bundle-introduced features listed |
| `FEATURES.md` — **app** feature manifest | NOT STARTED | Open question 1 below. Still unfilled; Stage 1–3 regression tables are checked against `ARCHITECTURE.md` directly, as the manifest's own scope note instructs. |
| `routing_guard_mode: enforce` | NOT STARTED | Blocked on `tests/test-routing-hook.md`. |
| **PR #90 promise audit** | COMPLETE | 15 promises verified against HEAD: 13 delivered, 2 partial, 3 weak tests. `HANDOFF-pocket-money.md` §0 and §11. |
| **`HANDOFF-pocket-money.md`** | COMPLETE | 427 lines at repo root; 12 sections; ten pocket-money requests (#15–#24) carried with file:line evidence |
| Stage 1 — school-day offer above the grid | COMPLETE (amended) | Repro failed first at **311/314**, then **314/314 exit 0**. `check` 8/8 · merge 112/112 · buffers 9/9 · stream 28/28 · cleanup pass · xp 28/28 · money 33/33. |
| Stage 1b — one host only, above the grid | COMPLETE | `b4b62dd`. 314/314; `check-dead-ids` 374 → **373**, which is the removed host. |
| Stage 2 — profile badges switch profile | COMPLETE | `d3fb2b6`. Repro failed with 7 findings; then **315/315**. |
| Stage 3 — watch a sister compete | COMPLETE | `684eb2c`. Repro failed with 15 findings, incl. the orphan adoption and the meeting chase firing against live code; then **317/317**. |
| Push + draft PR #93 | COMPLETE | Branch pushed; [PR #93](https://github.com/lxyzh1019-cyber/Weekly-Planner/pull/93) open as draft. |
| 4a `SMOKE_ONLY` subset filter | COMPLETE | `126506a`. Full run 317/317 unchanged; typo and CI misuse refused (exit 1); partial line never claims a pass. 32s subset vs 85–98s full. |
| 4b Visible build number | COMPLETE | `a03f1c2`. `BUILD` = `SW_VERSION` = `2026-09-23a`, enforced by `check-sw-shell.js` (mismatch proven to fail). Smoke 318/318. |
| 4c `check-dead-actions.js` | COMPLETE | `46c7306`. 9th check, 0.63s. Five planted failures caught. `pm/edit` exempted by name, self-expiring. |
| 4d Repeat-invite guard + kid share | IN PROGRESS | Delegated; repro first. |
| 4e 💌 note on Today | NOT STARTED | After 4d. |
| 19 dead handler branches (warned by 4c) | OPEN — for tier-3 review | 12 in `ctHandleWrapClick` (chores — possibly a retired chore surface; check nothing was lost with it), `mm` openkidday, `co` num/export, `mnyp` tab/kid (money → handoff §2). Not removed: outside 4c's scope. |
| Real-device verification | NOT STARTED | Blocked by design: no visible build stamp exists (VE 1). Until one ships, "deployed" cannot be verified on the iPad. |
| Tier-3 logic review of non-money screens | NOT STARTED | Proposed as its own read-only round after this PR merges. |

## Checks and evidence
- 2026-09-21 `bash tests/replay-hooks.sh` → **passed=14 failed=0**; `.claude/hooks/config.json` confirmed restored to `routing_guard_mode: "observe"`, `.claude/state/` empty.
- 2026-09-21 `npm run check` → **green**: 43 files pass `node --check`; 1943 top-level declarations, no duplicates; 16 `state.shared` keys all with a merge decision; escaping lint clean; 1379 CSS classes and 373 ids all referenced; 43 scripts all loaded and cached, SW_VERSION `2026-09-21c`.
- 2026-09-22 **read-only audit round, no app file changed.** Five parallel investigations over `js/`, `index.html`, `css/app.css`, `tests/`, the root `.md` files, and git history back to `437f79a`. Findings are in `HANDOFF-pocket-money.md` and Plan v4.
- 2026-09-22 **Stage 1 verified.** Failing repro first: `theSchoolOfferIsAboveTheWeekGrid` + two others failed at **311/314**, naming the missing host. After the fix **314/314, exit 0, errors: []**. Also `npm run check` 8/8 (1945 declarations no duplicates, 1380 CSS classes and 374 ids all referenced, `SW_VERSION 2026-09-22a`), merge 112/112, buffers 9/9, stream 28/28, cleanup pass, xp 28/28, money 33/33. `npm run check` re-run green by the main session independently.
- 2026-09-22 **Stage 1b verified** — 314/314; `check` 8/8, 373 ids.
- 2026-09-22 **Stage 2 verified** — repro failed with 7 named findings, one of them the app stating its own meeting-lock defect; then 315/315, `check` 8/8, 1946 declarations. An intermediate run proved that scoping `applyMeetingLock`'s selector alone could not release the lock.
- 2026-09-22 **Stage 3 verified** — repro failed with 15 findings; then 317/317, `check` 8/8, 1948 declarations, 374 ids (one new, `#watchSisterBtn`).
- 2026-09-22 **Read-only dead-control scan** — 170 distinct `onclick` targets, all declared (one hit, `stopPropagation`, is `event.stopPropagation()`); 177 delegated `data-*-action` values across 13 prefixes, 3 scanner hits all verified handled via `closest('[data-…-action="…"]')`. The scan also **under**-reports: it cannot see the known-dead `pm-action="edit"` branch, because `'edit'` is handled by another prefix. A real guard must parse per prefix.
- 2026-09-22 **Build stamp check** — `SW_VERSION` exists only in `sw.js`, is never posted to the page, and nothing renders a version. **No deploy stamp exists to read.**
- 2026-09-22/23 **4a verified** — full smoke 317/317 (84.7s); subset 2 checks in 32s; `SMOKE_ONLY=noSuchCheck` exit 1; `CI=true SMOKE_ONLY=…` exit 1; deliberately broken check fails the subset, restored passes. Re-verified independently by the main session.
- 2026-09-23 **4b verified** — `theBuildNumberIsOnThePage` failed first naming both missing lines; mismatch `2026-09-23b` vs `2026-09-23a` made `npm run check` exit 1; smoke 318/318 (111s). Tap paths walked in headless Chromium at iPad and phone sizes: kid — Today → ⋯ More → line under the tiles; parent — ⋯ More → Switch → Parent → PIN → ⚙️ App → line under the list.
- 2026-09-23 **4c verified** — current tree: 265 onclick calls (167 functions), 199 actions across 13 prefixes, all handled, 1 exempted; 26 reverse warnings, 19 confirmed dead by hand. Planted: undeclared onclick, unhandled mny value, unread prefix, deleted exemption, expired exemption — each exit 1.
- **Correction on record (1):** the claim that a full smoke run takes 8–10 minutes came from `ARCHITECTURE.md`'s text, not measurement. Measured: 85–111s. `SMOKE_ONLY` saves ~2.6×, not "to seconds" as first claimed.
- **Correction on record (2):** the claim that an iPad "can keep running an old build for a long time" overstated it. `sw.js` is network-first: an online device fetches the deployed code (within GitHub Pages' few minutes of caching). The old build persists only offline. The build number is right in every case.
- **Not verified on a live URL or a real device.** Everything so far is headless Chromium at 390×844; no deploy stamp has been read, so nothing is claimed as deployed.

## Open questions / blockers
1. **`FEATURES.md` app manifest is unfilled.** The bundle ships it as a template. A real manifest has to be derived from `ARCHITECTURE.md` (~2700 lines) and is a task of its own; inventing one quickly would produce a manifest that regression tables are checked against but that is itself wrong. Recommend a dedicated round.
2. **`routing_guard_mode` is `observe`.** Per the bundle README, run `tests/test-routing-hook.md` to learn which hook-input fields identify a subagent before switching to `enforce`.
3. **The pocket-money hotspot rule is live.** Three fix rounds on the money area means the next money patch is not allowed until a rewrite-vs-repair comparison is presented. That is the first item in the handoff chat, not a patch.
4. **One assumption carried into Stage 3 rather than asked:** a watching block earns no competition score and no competition money (guaranteed structurally by `blockIsCompetition` returning false for it) but still counts as ordinary planned time in the week charts. Excluding it from those too is a one-line filter, and would make a Saturday spent at the rink read as free. Flagged to the owner in Plan v4 §3.
5. **Correction on record:** mid-session this assistant stated that no rules-editor commit existed across PRs #89 and #90, inferred from commit titles. That was wrong — a complete effective-dated editor exists at Setup → 💰 Money rules. Recorded here because the wrong claim reached the owner.
