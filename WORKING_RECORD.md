# WORKING RECORD — Weekly-Planner — rules v2

Single working record for this repository. Updated by the main session at the end of every implementation turn (the record guard hook checks this). Keep it terse; history lives in git.

## Approved baseline
- 2026-09-21, branch `Rules-v2`: install working-rules bundle v2.1 into the repo root, verify with `tests/replay-hooks.sh`, commit and push. Given as a direct instruction rather than a Plan vN — the session predates the plan gate, which loads only from `main`.
- 2026-09-21, in-session decision (asked and answered): `CLAUDE.md` is **split**, not overwritten. Bundle global rules take the `CLAUDE.md` filename; this repo's architecture doc moves to `ARCHITECTURE.md`.
- 2026-09-22, branch `claude/inspiring-gauss-232zww`: **Plan v4 approved** — "The non-money half, plus the pocket-money handoff". Three staged commits (school-day offer · profile badges · watch a sister compete), one draft PR. All pocket-money work is deferred to `HANDOFF-pocket-money.md` and a separate chat, at the owner's instruction.
- **2026-09-24, R5: Plan v4 approved** (ExitPlanMode, local desktop session, branch `claude/charming-hawking-4f8mm1` from `main` @ `fa06ed5`) — "Sister Sync as a timeline tab, invites that carry travel and repeat, a lighter day toolbar, catching up on missed days, and Chores rebuilt in its new homes". Two draft PRs: PR 1 = 5a nav + More trim · 5b invite travel/get-ready, missed invites, add-anyway, Day-view accept on the same owners · 5c series invites, badge-leak fix, moved-block flag · 5e Sync timeline · 5f templates retired + copy-a-day preview, pins not copied for a child · 5g reflection on Today, day passed explicitly · 5h start-this-day-over. PR 2 (cut from PR 1's head) = 5d relocation map · C1 chore actions + catch-up · C2 chore views. C3 (retire the Chores screen) waits for the owner's per-row confirmation. Plan text: `~/.claude/plans/pasted-content-id-2333-plan-tingly-zebra.md` (v4, Rev 3).
- 2026-09-24, R5 owner decisions (AskUserQuestion): Sister Sync = a bottom tab; invites copy the sender's travel and get-ready; repeating blocks ask "this day, or all?"; Chores features rebuilt in new homes, screen retired only after confirmation; Q1–Q4 built as described; a missed invite offers "add it anyway"; a shared block dragged to another day keeps its 💌 and is flagged "moved, send again?"; build in the local desktop session.
- 2026-09-22, owner's four decisions on record (AskUserQuestion): a kid may **propose** a meet (deferred to the handoff); **Dance** comes out of the competition categories and **skating star level** goes in, with an editable category table (deferred); watch/accompany is built by **extending Sister Sync invites** with a `watching` flag on the competition block, no competition reward, no money-tab link; delivery is **one branch, staged commits, one PR**.

## Pending
- PR [#91](https://github.com/lxyzh1019-cyber/Weekly-Planner/pull/91) **merged** 2026-09-21 as `f4d1db5`. (This line previously said "awaiting the owner's merge" — corrected 2026-09-22.)
- **PR [#93](https://github.com/lxyzh1019-cyber/Weekly-Planner/pull/93) — merged to `main` as `fa06ed5`** (corrected 2026-09-24; this line previously said "draft, open"). Original note: Last code change: the #34 wrong-day fix, then `main` (PR #92) merged in (#35), build 2026-09-23b. Description updated 2026-09-23 to include both. Final gate on the merged head: `npm run check` OK, smoke 347/347.
- **After merge, the owner's one step:** open Today → ⋯ More on the iPad and read **Build 2026-09-23b**. That is the only way to claim "deployed" under the rules; nothing has been read on the live URL yet.
- **Approved (#33), done:** 4a `SMOKE_ONLY` ✅ `126506a` · 4b build number ✅ `a03f1c2` · 4c dead-button check ✅ `46c7306` · 4d repeat-invite guard ✅ `718bb84` · 4e 💌 note on Today ✅ `a25f8ec`. **All five complete.**
- **Approved (#34), done:** the Sister Sync wrong-day fix (Open questions 6, now closed). Build **2026-09-23b** — after merge, that is the number to read on the iPad, not 23a.
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
| 33 | R3 2026-09-22 | "Regarding the decisions, I agree all 5." | done | **Approval** of Plan v5's five items: (1) repeat-invite guard + kid share from the block; (2) visible build number; (3) `SMOKE_ONLY`; (4) dead-button check; (5) 💌 note on Today. Built as stages 4a–4e, tooling first. |
| 34 | R4 2026-09-23 | "Yes, fix the wrong day invite bug" | done | **Approval** of Open questions 6. Round 3 on Sister Sync invites; comparison in the hotspot counter (repair). `sendInvite(block, to, day, opts)` — the caller passes the day; the global fallback is gone; no day → refused. Build `2026-09-23b`. Evidence under Checks. |
| 35 | R4 2026-09-23 | (harness) PR #93 went un-mergeable after PR #92 merged to `main` | done | Mandated remedy: merge `main` into the head (no rebase/force). 6 conflicts. Two parallel build stamps (`BUILD` here, `APP_BUILD` on `main`) **consolidated into one** — `APP_BUILD`, `.app-build`, one check, one smoke check, Today More + App landing. `check-dead-actions` `pm/edit` exemption self-expired (PR #92 removed the branch) and was deleted. No money file changed by this branch. |
| 36 | R5 2026-09-24 | "Sister Sync as a bottom tab" | in progress | Owner's choice. Plan v4 §1, stage 5a. |
| 37 | R5 2026-09-24 | "Money school / Money story belong to the Money tab" | in progress | Both More tiles removed; plan v4 §2, stage 5a. |
| 38 | R5 2026-09-24 | "Invites carry the sender's travel and getting ready" | in progress | Round 4 on Sister Sync invites (comparison below). Plan v4 §3, stage 5b. Includes missed invites, "add it anyway", Day-view accept door on the same owners. |
| 39 | R5 2026-09-24 | "Repeating blocks: this day, or all?" | in progress | Plan v4 §4, stage 5c. Badge leak fixed; dragged shared block keeps 💌 and says "moved, send again?" (owner). |
| 40 | R5 2026-09-24 | "Sister Sync shows a timeline" | in progress | Plan v4 §6, stage 5e. |
| 41 | R5 2026-09-24 | Q1–Q4: templates, copy-a-day preview, reflection on Today, clear day | in progress | Approved by the owner 2026-09-24. Stages 5f–5h. Rev 3 additions (child copies drop the pin; reflect sheet takes its day) approved with Plan v4. |
| 42 | R5 2026-09-24 | "Build the existing chore features in the new locations; retire Chores only after I have confirmed everything" | in progress | PR 2: 5d map, C1, C2. C3 not in this round. |
| 43 | R5 2026-09-24 | "Validate the plan; have you applied the changes; do I have to create the PR?" | done | Read-only check found 9 factual errors + 6 gaps in Plan v3; folded into Plan v4 (Rev 3). Nothing had been applied. PRs: this session opens drafts; merging is the owner's step. |

## Hotspot counter
| Area / feature | Fix rounds | Recurrences | Last symptom | Rewrite-vs-repair reviewed? |
|---|---|---|---|---|
| Rules/governance install | 1 | 0 | — (first round) | n/a |
| `CLAUDE.md` filename collision | 1 | 0 | Bundle and repo both claim the root `CLAUDE.md`; different documents | yes — resolved by split, not patch |
| **Pocket money** (stream, rules, meeting, money pages) | **4** — PR #89, PR #90, R2 (PR A), R3 (B5–B7, then B8–B10 closing B6's own known limits in the same round — not a new round: no new symptom from the field) | **2** — (i) a click handler keyed on an attribute its host never listens for; (ii) **a settled week blocks competition money** — the "$21 meet in a $0 week" (repaired for legacy weeks only), again for Grandma weeks and, per the owner, any settled week | House rules never reached a stored rulebook; two dead buttons; `[object Object]`. PR A review found two more, both older than PR A: the change log drawn twice, and the move form redrawing on every keystroke. Both fixed in PR A, test first. | **yes — 2026-09-22, repair** (below) |
| Week-view school offer | 1 | 0 | Offer only below a ~700px grid once anything is booked | n/a — first fix round; cause is a host deleted with the Day Blocks tab |
| Profile badge | 1 | 0 | Three inert `<div class="profile-badge">` with a false `aria-label` | n/a — first fix round |
| Sister Sync invites | **4** | 0 | Round 4 (R5, 2026-09-24): an invite carries no travel/get-ready (watch = fixed 15/15); no expiry for a missed day; no series awareness; `invitedTo` leaks through 4 copy paths; a second accept door on the Day view re-implements the rules; a cross-day drag changes the block id under the invite. Round 2 (4d): no duplicate guard in `sendInvite`, no status guard in `acceptInvite`, and a **second inline writer** (`inviteSisterFromEdit`) that bypassed `sendInvite` entirely. Round 3 (#34): `sendInvite` guessed the invite's day from globals (`currentDayKey \|\| syncDayIdx`) | **Yes — round 3 and round 4 comparisons below, repair chosen both times.** |

**Round-3 comparison — Sister Sync invites (2026-09-23, before #34's patch).**
- *Shared cause across rounds 2 and 3:* the invite writer inferred facts its callers already knew — who sent it (round 2: a second writer with its own sender logic) and which day it is for (round 3: a global the Sync screen never sets). Same class: implicit context instead of an explicit argument.
- *Consolidate/remove:* after 4d there is one writer and three doors (Sync mini-block, 💌 edit sheet, 👀 edit sheet). Nothing left to merge. The repair **removes** the global fallback line; the day becomes a required argument, and a missing day is refused rather than guessed.
- *Rewrite option:* move invites into their own module with a block-reference model (`{profile, day, blockId}`) instead of copying fields. Rejected: it changes a `state.shared` shape (merge decision, migration of stored invites on both iPads) to fix a one-line inference bug.
- *Simplicity / compatibility / migration:* repair touches `sendInvite`'s signature and its three callers; stored invites keep their shape; no migration. Existing wrong-dated invites are not rewritten — they cannot be told apart from correct ones.
- *Rollback:* revert one commit. *Regression risk:* low — the edit-sheet doors already pass the right day (the block tap calls `focusDayColumn(ownDayKey)` first, `js/08-day-view.js:1079`); only the Sync door was wrong.
- **Decision: repair.** Structural element: `sendInvite` no longer reads `currentDayKey`/`syncDayIdx` at all, so no future door can inherit the wrong day.

**Round-4 comparison — Sister Sync invites (2026-09-24, Plan v4, before any patch).**
- *Shared cause across rounds 2–4:* an invite is a hand-copied subset of a block; each round found a field or fact the copy left out or guessed (sender, day, buffers, series), plus a second accept door that re-implements the rules and a block whose id changes under the invite.
- *Rewrite option:* invites reference the source block (`{profile, day, blockId}`). Rejected: the owner chose copy semantics; it changes a `state.shared` shape; it needs a migration on both iPads.
- *Repair with structure:* `inviteSnapshot(block, dayKey)` owns what an invite carries; `inviteToBlock(inv, dayKey)` owns what accepting writes; `inviteAcceptable(inv)` owns whether it can be accepted now (both doors call it); buffers only via `getTravelBufMin`/`getGetReadyBufMin`; a field-by-field smoke check compares source and accepted block. No migration; old invites accept as before.
- *Rollback:* each stage reverts as one commit. **Decision: repair.**

Rule: 3 fix rounds, or 2 recurrences, or a fix causing a nearby regression → no further patch until the comparison is presented.

### Rewrite vs repair — pocket money, 2026-09-22

**Shared causes**, each evidenced this round:
1. *Tests assert against constants, not live state.* `tests/money.test.js` checks `MR_DEFAULT_RULES`, never a stored version — so the house rules passed every test while no household with a rulebook received them.
2. *Screens restate rules as literals.* `MNY_PAID`/`MNY_UNPAID`, the fines and streak prose, the stock-risk sentence.
3. *Click wiring by attribute prefix, with nothing checking the host listens.* Two recurrences.
4. *Three key-spaces for one idea* — `EV_HOMES` / `MNY_BUCKETS` / `MNY_HOLDING_KINDS`, joined by two translation tables.
5. *Writers store values renderers assume are simple* — the log's `from`/`to` carrying the whole chore pool.

**What a rewrite would buy:** it removes only cause 4. Causes 1, 2, 3 and 5 are not architectural and would recur inside a rewrite.

**What can be consolidated or removed:** `MNY_PAID`/`MNY_UNPAID` deleted (the live price list replaces them); the three key-spaces consolidated only once pots are actually renamed (VE-9 — nothing needs it yet); guards added for causes 1, 3 and 5 (a stored-rulebook fixture, a host-binding smoke check, a log writer that summarises).

**Simplicity:** repair adds three guards and removes two literal tables. A rewrite replaces the stream, whose invariant is asserted over 1000 random histories on two devices.

**Compatibility:** repair keeps every stored shape. Renaming pot keys would change `profile.events` and holding records already on every device, and `deepMergeObj` lets a stale device push old keys back.

**Migration:** repair needs one — the four house rules, applied as a new effective-dated version through `mrApplyEdits` on one parent tap. Nothing lived is re-priced. A rewrite needs a cross-device data migration.

**Rollback:** each PR reverts cleanly; the rules change is undone by another version, which the editor already does.

**Regression risk:** repair is local to the money pages and three writers. A rewrite puts the ledger, settlement and every balance at risk at once.

**Decision: repair**, with the structural guards above so causes 1, 3 and 5 cannot recur silently.

**Addendum, R3 2026-09-22 — second recurrence (settled week blocks a competition).** Shared cause: "settled" (`finalizedWeeks[wk][kid] != null`) was used as "closed to all money", and each fix covered one settling path (the repair: legacy weeks). Structural option chosen (B6): ONE owner function reconciles a settled week's competitions whenever a competition owner (`mrAdd/Update/DeleteCompetition`) changes one, for every settling path, keeping `finalizedWeeks` and the ledger in step so the repair cannot pay the same meet twice. Rewrite not warranted: the cause is one missing reconciliation, not the stream or the ledger. Decision unchanged: repair.

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
| `FEATURES.md` — **app** feature manifest | PARTIAL | Money area manifested by PR #92; the non-money features this PR touches are manifested (v7). The rest is still unfilled; Stage 1–3 regression tables are checked against `ARCHITECTURE.md` directly, as the manifest's own scope note instructs. |
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
| 4d Repeat-invite guard + kid share | COMPLETE | `718bb84`. One invite writer (the inline copy in `inviteSisterFromEdit` removed); `sisterInviteFor` owns the duplicate question; accept/decline act only on pending; kid can share from the block; `#publicToggle` stays parent-only. `anInviteCannotBeSentTwice` failed with 18 findings, then passes. Smoke 319/319. |
| 4e 💌 note on Today | COMPLETE | `a25f8ec`. Kid-only (`openSisterSync()` refuses a parent). Shares its filter and wording with the inbox (`invitesWaitingFor`, `inviteFacts`). `anInviteWaitingShowsOnToday` failed with 4 findings, then passes. Smoke 320/320. |
| 19 dead handler branches (warned by 4c) | OPEN — for tier-3 review | 12 in `ctHandleWrapClick` (chores — possibly a retired chore surface; check nothing was lost with it), `mm` openkidday, `co` num/export, `mnyp` tab/kid (money → handoff §2). Not removed: outside 4c's scope. |
| Real-device verification | NOT STARTED | Blocked by design: no visible build stamp exists (VE 1). Until one ships, "deployed" cannot be verified on the iPad. |
| Tier-3 logic review of non-money screens | NOT STARTED | Proposed as its own read-only round after this PR merges. |
| **R5 / Plan v4 — PR 1** | | |
| 5a Sister Sync bottom tab + More trim | COMPLETE | Worker model verified: Opus 5.5 (self-report; effort configured: high). New checks `sisterSyncIsABottomTab`, `moreHasNoMoneySchool` + updated `kidNavIsUsableAndScoped`/`navReachesEverythingAndOldRoutesStillWork` failed first (4 named failures), then pass. Worker gate: check 9/9 · merge 112 · buffers 9 · stream 31 · cleanup pass · xp 28 · money 33 · smoke ALL PASSED (349). Main session re-ran `check` 9/9 OK (SW_VERSION 2026-09-24a = APP_BUILD). Label "Sister Sync" fits at 375px in Patrick Hand; wraps to 2 lines in the fallback font (risk noted to owner). Build 2026-09-24a. |
| 5b Invite travel/get-ready, missed invites, add anyway, Day-view door | COMPLETE | Owners `inviteSnapshot`/`inviteToBlock`/`inviteIsMissed`/`inviteAcceptable` in `js/10-social.js`; Day view ghost uses them. New checks `anInviteCarriesTheSendersTravelAndGetReady`, `aMissedInviteIsNotWaiting`, `theDayViewAcceptFollowsTheSameRules` failed first (share arrived 0/0/0 vs 20/25/15; watch 15/15 vs 30/30; missed counted as waiting; past-day ghost offered Accept), then pass. Four existing invite checks now pin the clock to Monday (assertions unchanged; "missed" is date-derived). Worker gate: check 9/9 · merge 112 · buffers 9 · stream 31 · cleanup · xp 28 · money 33 · smoke 352/352. Main session re-ran `check` 9/9. Known, not fixed: an empty day's Day view draws 6am–2pm and ignores pending invites, so an afternoon invite on an empty day has no ghost there (pre-existing). |
| 5c Series invites, badge leak, moved-block flag | NOT STARTED | |
| 5e Sister Sync timeline | NOT STARTED | |
| 5f Templates retired, copy-a-day preview, no child pins | NOT STARTED | |
| 5g Reflection on Today, explicit day | NOT STARTED | |
| 5h Start this day over | NOT STARTED | |
| PR 1 push + draft PR | NOT STARTED | |
| **R5 / Plan v4 — PR 2** | | |
| 5d Chore relocation map (`docs/chore-relocation-map.md`) | NOT STARTED | |
| C1 Chore actions + catch-up | NOT STARTED | |
| C2 Chore views | NOT STARTED | |
| PR 2 push + draft PR | NOT STARTED | |

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
- 2026-09-23 **4e verified** — failed first with 4 findings; then passes, incl. the tap landing with `#invitesList` inside a 390×844 viewport after the fixture proves it starts below the fold. check 9/9 (200 actions), smoke 320/320 (100s). Main session re-ran check + both invite checks independently.
- 2026-09-23 **#34 wrong-day invite verified** — new check `anInviteFromSisterSyncIsDatedThatDay` failed first against the old `js/10-social.js` + `js/17-ui-misc.js` (5 findings: confirm named Mon not Thu; invite dated 2026-09-21 not 2026-09-24; no 💌 stamp; 0 blocks on the sister's Thursday; 1 on her Monday). Main session re-ran that repro independently by swapping the old files back in, then restored the fix. Full gate on the fix, run by the main session: check OK (SW_VERSION 2026-09-23b) · merge 112/112 · buffers 9/9 · stream 28/28 · cleanup pass · xp 28/28 · money 33/33 · **smoke 321/321** exit 0. Headless Chromium only; not deployed; no live stamp read.
- 2026-09-23 **Merge of `main` (PR #92, `fcfb1fe`) verified** — conflicts in `WORKING_RECORD.md` (main session: both histories kept; PR #92's in its own section at the end), `js/01-config.js`, `js/11-parent.js`, `sw.js`, `tests/check-sw-shell.js`, `tests/smoke.js` (worker). No conflict markers remain; `grep -rnw BUILD js tests sw.js` empty. Main session's own gate on the merged tree: check OK (SW_VERSION 2026-09-23b = APP_BUILD; 206 actions, 0 exempted) · merge 112/112 · buffers 9/9 · stream **31/31** (main's +3) · cleanup pass · xp 28/28 · money 33/33 · **smoke 347/347** exit 0 (this branch 321 + main's new checks − `theAppLandingShowsTheBuild`, folded in). Worker also gated main's 26 new smoke checks behind `want()` and de-duplicated `ALL_CHECKS` (a doubled assignment made the subset banner count 348).
- 2026-09-23 **Subset-vs-full discrepancy, logged not resolved:** in a `SMOKE_ONLY` subset, `kidScreensMeetTheHouseRules` reported `font 11.9px on .mny-tab-tag` on a money screen; in the full run it passes. Shared page state differs between the two. Which run reflects what a child actually sees is **not established** — it is a money screen, so it goes to the handoff as a lead rather than being investigated here.
- 2026-09-23 **4d verified** — `anInviteCannotBeSentTwice` failed first with 18 findings incl. "accepting twice put 2 Reading blocks on Jess's day" and "a WATCH invite marked the share button sent"; then passes. It clicks the real Sister Sync mini-block after an edit-sheet share, proving one owner. check 9/9, smoke 319/319 (104s). Main session re-ran check + the two invite checks independently.
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
6. **CLOSED 2026-09-23 by #34 (fixed, build 2026-09-23b).** Original entry kept below. **Sister Sync invites can land on the wrong day — confirmed, not fixed.** `sendInvite` dates an invite `currentDayKey || getDayKeys(weekOffset)[syncDayIdx]` (`js/10-social.js:182`), and `currentDayKey` is initialised to `null` once (`js/02-state.js:25`) and never cleared. After any visit to a day view, an invite sent from a different Sister Sync column is dated the day last opened, and the accepted block lands there. The duplicate guard is unaffected (it matches on block id). **Fixing it is round 3 on Sister Sync invites and triggers the comparison rule**; the comparison is short because 4d already reduced the path to one writer — repair is the answer: the caller passes the day it actually knows. Awaiting the owner's approval.

## PR #92 record — money chat (branch `claude/happy-bardeen-1xalni`, merged to `main` as `fcfb1fe`)
Carried in unchanged when `main` was merged into PR #93 on 2026-09-23. Row numbers here are that chat's own and overlap the ledger above; cite them as "PR #92 #n". Pocket-money work continues in that chat.

### Approved baseline (PR #92)
- **2026-09-22, Plan v8 approved** — the three known limits from B5–B7 are closed on #92 before the merge: B8 meeting Undo withdrawn once money moves after the commit; B9 "Meets never paid" catch-up in the repair card (adds only); B10 a defaulted week's record is read-only and shows the flat amount + meets. Fines are a thin OUTFLOW in the pool (owner). **The cash pool (PR C) stays out of #92**; handed off in `docs/handoff/pr-c-cash-pool.md`.
- **2026-09-22, Plan v7 approved** — the Grandma rule rebuilt to the owner's test (from a start week the owner enters and saves as a dated rule; weeks OUTSIDE the 8-week review window; NO family meeting record — `meetingsMet` or `meetingsHeld`; $3; one rule replaces the old "nobody sat down for" sweep) (B5, B7); competitions paid on top (B6), widened by the owner after approval to EVERY settled week: "a settled week should not block a late competition". My money rebuilt around the pool as the owner designed it — inlet (pay), outlet (loan payment, spending), dashed investment loop — with the four pot tiles and NO added-up total; earn · spend · invest · cash; price list, "what paying it opens" and saving goal as pop-ups; competition calendar and gifts as cards AND from the inlet (C1, C2). The pool picture comes from Claude Design, from my brief (C8). The Zones mockup board is retired.
- **2026-09-22, Plan v6 approved** — adds: iPad Pro 11″ landscape as the main interface; one week/month target card (opens on the week, never stored, switches itself to the month once the weekly target is reached; on Today the toggle sits on top and drives came in / went out / put away and the target); unlock gates 20/30/40% from one threshold table, parent-tunable (S4); Money school balanced on iPad; "💧 My cash pool" titled and kept separate from the target card; a what-I-have / what-I-owe line chart (C6) and paired in/out month columns (C7); S2 pot-opening moment, S3 visible build stamp. PR B (B1–B4 + S2–S4) has a 1 Oct deadline. S1 withdrawn.
- **2026-09-22, Plan v5 approved** — "Money system: stop the bleeding, the Grandma rule, then the pool". Branch `claude/happy-bardeen-1xalni` from `main` @ `f4d1db5`. Sequence: Step 0 (this record) → PR A → PR B → C0 mockup → owner sign-off → PR C. Value-engineering items VE-1…VE-14 accepted; VE-11 (weekly/monthly) un-deferred at the owner's request; VE-3, VE-7, VE-9, VE-10 deferred with reasons. Full plan: `/root/.claude/plans/1-one-kid-completed-quizzical-kitten.md` (session-local).

### Pending (PR #92, as that chat left it — #92 has since merged)
- B5–B7 committed on #92. Owner: save the start week in Money rules › 👵 Grandma rule, then preview before crediting.
- #92 description updated + ready for review; owner merges before 1 Oct and checks the iPad stamp reads 2026-09-22d.
- **Found in passing (pre-existing, not fixed):** a legitimate meeting Undo puts the wallet back but leaves the commit's lines in the money stream, so a re-commit double-counts in the stream (the wallet is right; `evShadowDrift` shows the gap). PR C reads every figure from the stream, so this must be fixed before PR C — listed in the handoff.
- Closed by B8–B10 (was): older 'default' rows holding unpaid meets are caught up only when a meet in that week is next touched; `mnyEditLedger` recomputes gross on a defaulted row without the flat amount (pre-existing); meeting Undo after a late meet then re-commit could pay it twice (session-only).
- PR #92 (PR A + PR B + B5–B7) must be merged and deployed before 1 Oct.
- C8 Claude Design brief → owner runs Claude Design → owner signs off the pool picture → gates PR C.
- PR [#91](https://github.com/lxyzh1019-cyber/Weekly-Planner/pull/91) — **merged** to `main` (`f4d1db5`).

### Request ledger (PR #92)
| # | Round/date | Requirement (user's words, short) | Status | Note |
|---|---|---|---|---|
| 11 | R2 2026-09-22 | "Validate the handoff" (a second session's audit of PR #90) | done | 11 claims checked in code; 4 corrected (prose not literals; wallet fields still read by a migration; a geometric order check does exist; the editor does exist). |
| 12 | R2 2026-09-22 | "Compare to your promises in the original plan" | done | 9 load-bearing promises graded: 3 Guaranteed, 2 Checked, 1 Assumed, 3 Broken. |
| 13 | R2 2026-09-22 | "My Money and Money school duplicate — propose a layout, or combine" | open → PR C | Decided: rebalance three pages, don't merge. Mockup v5 shows it at iPad landscape. |
| 14 | R2 2026-09-22 | "Where is the cash pool? You promised" | open → PR C | Admitted not delivered: the Flow's "left" is cash only. Pool on both My money and the story. |
| 15 | R2 2026-09-22 | Grandma rule: $3/week from a chosen start date to 30 May | **superseded by #43** | Only weeks with no record at all. Extends the existing sweep card (VE-4). |
| 16 | R2 2026-09-22 | "Different colour per revision in the plan; no `<…>` tags" | done | Fenced `diff` blocks + Rev-N labels; `<span>` does not render in this terminal. |
| 17 | R2 2026-09-22 | Today's money card: option A with changes — weekly flow, weekly target; weekly/monthly | open → PR C | No grand total, no sparkline. Pair vs toggle decided at the mockup. |
| 18 | R2 2026-09-22 | "If I change the sports loan, does the system recalculate?" | done | Forward figures derive live; `paid`/`payments` and settled weeks are frozen. |
| 19 | R2 2026-09-22 | Reminder every 1 August for the sports loan setup | open → PR B | Derived banner on Now; no stored dismissal (VE-8). |
| 20 | R2 2026-09-22 | No loan ⇒ every pot open, as the system default | open → PR A | Both girls have loans today; resets Sep 2027. |
| 21 | R2 2026-09-22 | "Change history shows the $3 weeks and becomes Money rules" | open → PR A + B | Setup row routed to the week ledger; the rules log was under Lessons. |
| 22 | R2 2026-09-22 | "The Money rules section should be editable" | **superseded in part** | Generic category editor deferred (VE-3, accepted); the one change needed now — Dance → Skating star level — is a relabel in PR B. |
| 23 | R2 2026-09-22 | "Lessons shows an overflow of [object Object]" | open → PR A | Reproduced: 15 from one chore edit. |
| 24 | R2 2026-09-22 | "Tap every Pocket Money tab and check for bugs" | done | Every surface rendered and read at phone width. |
| 25 | R2 2026-09-22 | "Did you check all the buttons?" | done | ~387 controls clicked, both roles, 0 throws. Two dead buttons found. |
| 26 | R2 2026-09-22 | Value engineering on scope and plan | done | VE-1…14; all accepted; VE-11 un-deferred. |
| 27 | R2 2026-09-22 | Dance is really a skating level exam; add skating star level | open → PR B | Owner confirmed silver/gold matches the star tests ⇒ relabel, scorer unchanged. |
| 28 | R2 2026-09-22 | "The main interface should be iPad Pro 11 inch landscape" | done (mockup) → PR C | Mockup redrawn at 1194×834 in the app's own landscape columns (My money 340·1fr·348, Money school 340·1fr·320, Today 1.42:1 with money in the side column). Phone kept as a secondary row. PR C designs and checks landscape first. |
| 29 | R2 2026-09-22 | Today's money card: add the week/month toggle; default to the week every open; switch to the month once the weekly target is exceeded | open → PR C (v6) | Never stored. "Exceeded" read as reached (≥) — flagged to owner. One card shared with My money. |
| 30 | R2 2026-09-22 | Lower the unlock gates to 20 / 30 / 40% | open → PR B (v6) | One threshold table; "Building my own mix" assumed to stay 100%. The 1 Oct deposit is exactly 30% for both girls. |
| 31 | R2 2026-09-22 | Money school's middle column too tall | done (mockup) → PR C | Price list split across middle + right on iPad. |
| 32 | R2 2026-09-22 | "Anything else that will benefit us?" → S2 pot-opening moment, S3 build stamp, S4 tunable gates | S2/S3/S4 accepted → v6 | S1 withdrawn (see #33). |
| 33 | R2 2026-09-22 | "Why did you say the weekly pay is $11 again? We solved this" | done — **correction** | I restated the calibration's invented "ordinary" week as fact. Real no-meet ceiling via the calculator: $18 / $21 / $24 at 1 / 2 / 3 top-grade chores a day. `ARCHITECTURE.md`'s "$15 after the two free" corrected in the same change. |
| 34 | R2 2026-09-22 | Today's money card: the toggle must drive came in / went out / put away too, and sit on top of the card | done (mockup) → PR C | v6 C4. Figures and target always describe the same period. |
| 35 | R2 2026-09-22 | "I did not see the cash pool — where does it go? Do not mix those two" | done (mockup) → PR C | It was the untitled "This week's money" card; now "💧 My cash pool". Kept separate from the target card on My money. |
| 36 | R2 2026-09-22 | "A line chart to show her asset and debt, or other charts that make sense" | done (mockup) → PR C | v6 C6: what I have (stream balances) vs what I owe (loan by payment date), one $ axis, palette validated (CVD ΔE 16.8). C7: in vs out columns per month. |
| 37 | R2 2026-09-22 | "My money and Money school still don't work well, but I can't tell the details" | done (critique) | Core cause: doing (My money) and learning (Money school) on different pages; no "start here"; Money school a drawer of five unrelated things; the one decision a kid can make is the least visible thing; three pages, two tabs. |
| 38 | R2 2026-09-22 | Money school as a pop-up card on each My money tile? → "Yes, mock it" | done (mockup) → **superseded by #40–#42** | Proposal board `Zones.dc.html`: My money by earn · spend & save · owe; ideas as tile pop-ups (one short thought, never scrolls); ladder on the loan; what-money-buys on the goal; price list a section, not a pop-up. Revisits Rev-1's "three pages, not merged" at the owner's request. |
| 39 | R3 2026-09-22 | "The drift away from my original cash pool design — a pool; income is the inlet, the mortgage the outlet, investment a dashed loop back into the pool" | open → PR C (C1, C8) | Picture by Claude Design from my brief (owner's choice). |
| 40 | R3 2026-09-22 | "My money has too many tiles — chores, what paying it opens, saving goal as pop-ups; the core is earn, spending, invest, cash" | open → PR C (C2) | ≤ 6 cards on iPad. |
| 41 | R3 2026-09-22 | "Where is the competition calendar, gifts section?" → "both" | open → PR C (C2) | Cards AND opened from the pool's inlet. They are live in the app today (`mnyCompetitionCard`, `mnyGiftsCard`); the Zones mockup had dropped them. |
| 42 | R3 2026-09-22 | "Everything I have with the small tiles is clearer"; "end total means adding all the categories together — not my goal" | open → PR C (C1) | Four pot tiles back; NO summed total; "Where it is now" table dropped. |
| 43 | R3 2026-09-22 | Grandma rule: "any week not in the 8-week review window and with no family meeting record gets $3"; "I will input the start week"; "does not close the door to the competition" | done → B5–B7 | Replaces #15. PR B had built the wrong test (money records, to 30 May). **Correction on record.** |
| 44 | R3 2026-09-22 | "A settled week should not block a late competition" + "a settled week only discusses routine, fine, chore money and how the money is spent; it does not block the competition and gift" | done → B6 | Widens B6 from defaulted weeks to every settled week; a late meet follows the existing late-gift pattern (cash on its own date, split at the next meeting); gifts get a test. Same class as the "$21 meet in a $0 week" the repair fixed for legacy weeks only. |
| 45 | R3 2026-09-22 | "Fix all the three known limits, need your suggestion" | done → B8–B10 | Undo withdrawn after later money moves (class fix); unpaid-meets catch-up, adds only; defaulted rows read-only. |
| 46 | R3 2026-09-22 | Fines in the pool: "you are right, thin stream flowing out of the pool" | done | Brief already says so; decision recorded. |
| 47 | R3 2026-09-22 | "Leave the cash pool out from this PR with a handoff document to pick it up later" | done | `docs/handoff/pr-c-cash-pool.md`. |

### Deliverable ledger (PR #92)
| Deliverable | State | Evidence |
|---|---|---|
| `FEATURES.md` — **app** feature manifest | PARTIAL | Money area manifested 2026-09-22 (Step 0). Everything else still checks against `ARCHITECTURE.md` — open question 1. |
| Plan v5 Step 0 — rewrite-vs-repair comparison, hotspot row, records | COMPLETE | This file; `FEATURES.md` money section |
| Plan v5 PR A — stop the bleeding (A1–A12, + A13/A14 checker fixes) | COMPLETE | `79b543b` on draft PR #92; `npm test` green in the main session's own run (check 8/8 · merge 112 · buffers 9 · stream 31 · cleanup · xp 28 · money 33 · smoke 321); every fix's check failed on the old code first (worker evidence) |
| Plan v6 PR B — Grandma rule, star level relabel, August banner, gates 20/30/40 (B4), S2 pot-opening moment, S3 build stamp, S4 tunable gates | COMPLETE | main session's own `npm test`: check 8/8 · merge 112 · buffers 9 · stream 31 · cleanup · xp 28 · money 33 · smoke 344 (click sweep 384 controls); new checks each shown failing on a deliberate break; G1+G2 follow-ups: the Grandma rule counts MONEY records only (owner's definition) |
| Plan v6 C0 — clickable mockup for sign-off (now v5 of the canvas: iPad landscape, toggle card, cash pool titled, have/owe chart, paired month columns) | COMPLETE — awaiting owner sign-off | Design canvas https://claude.ai/artifact/3fYy6KiQMcSissRGBvnG6d (private); started ahead of PR B because sign-off is the long pole — content unchanged |
| Plan v7 B5–B7 — Grandma rule to the owner's test; late competitions paid into any settled week; start week saved as a dated rule | COMPLETE | main session's own `npm test`: check 8/8 · merge 112 · buffers 9 · stream 31 · cleanup · xp 28 · money 33 · smoke all; 10 new checks each shown failing on 17771e2 (worker evidence); build `2026-09-22c`. Repair now skips defaulted weeks (consequence of the flat rule). |
| Plan v7 C8 — Claude Design brief for the pool | COMPLETE — awaiting owner review | `docs/design/cash-pool-brief.md`; fines as a thin outflow — confirmed by the owner |
| Plan v8 B8–B10 — close the three known limits | COMPLETE | main session's own `npm test` exit 0: check 8/8 (SW_VERSION 2026-09-22d = APP_BUILD) · merge 112 · buffers 9 · stream 31 · cleanup · xp 28 · money 33 · smoke ALL PASSED; 3 new checks each failed on 1fbc426 (worker evidence) |
| Plan v8 PR C handoff document | COMPLETE | `docs/handoff/pr-c-cash-pool.md`; every code name cited checked by grep |
| Plan v7 PR C (not in #92) — the pool (C1), My money as earn · spend · invest · cash (C2), Today card + toggle (C3/C4), have/owe chart (C6), month columns (C7) | NOT STARTED | Blocked on the owner's sign-off of the Claude Design picture |
| `routing_guard_mode: enforce` | NOT STARTED | Blocked on `tests/test-routing-hook.md`, which must run in a session where the hooks are live (i.e. after merge to `main`). |

### Checks and evidence (PR #92)
- 2026-09-21 `bash tests/replay-hooks.sh` → **passed=14 failed=0**; `.claude/hooks/config.json` confirmed restored to `routing_guard_mode: "observe"`, `.claude/state/` empty.
- 2026-09-21 `npm run check` → **green**: 43 files pass `node --check`; 1943 top-level declarations, no duplicates; 16 `state.shared` keys all with a merge decision (14 arbitrated, 2 declared LWW); escaping lint clean; 1379 CSS classes and 373 ids all referenced; 7 test suites all run by `npm test` and CI; 43 scripts all loaded and cached, SW_VERSION `2026-09-21c`.
- 2026-09-21 `npm run test:smoke` → **not run** this round. Justified: no `js/`, `css/`, `index.html` or `sw.js` file was touched. The only non-governance edits were two prose lines in `README.md` and `SECURITY_TODO.md`.
- 2026-09-21 Hooks verified live by observation: `record-guard.py` blocked this very turn for an incomplete record, which is the intended behaviour and the first real-session evidence that the Stop hooks fire.
- 2026-09-22 Headless Chromium, `main` @ `f4d1db5`, Firebase blocked: every money surface rendered at 430px; **~387 controls clicked** as parent and as child with state restored between clicks — **0 throws, 0 page errors**. Two dead buttons confirmed by watching `#recordOverlay` never gain `open`; `[object Object]` reproduced at **15** occurrences from one `coApply`; Flow caption observed at **$0.00 above a $30.00 bar**.
- 2026-09-22 PR A, main session's own run: `npm test` all green — check 8/8 · merge 112 · buffers 9 · stream 31 · cleanup · xp 28 · money 33 · smoke 321 (click sweep 357 controls ≈38 s). CI on PR #92: *Syntax, globals, merge tests* ✓ and *Headless smoke test* ✓.
- 2026-09-22 Chart palette validated with the dataviz validator against #fffdf5: all six checks pass (CVD ΔE 16.8, normal-vision 22.3, contrast ≥ 3:1).
- 2026-09-22 B5–B7, main session's own run: `npm test` exit 0 — check 8/8 (SW_VERSION 2026-09-22c = APP_BUILD) · merge 112 · buffers 9 · stream 31 · cleanup · xp 28 · money 33 · smoke ALL PASSED.
- 2026-09-22 B8–B10, main session's own run: `npm test` exit 0 — check 8/8 (2026-09-22d) · merge 112 · buffers 9 · stream 31 · cleanup · xp 28 · money 33 · smoke ALL PASSED.

### Open questions / blockers (PR #92)
1. **`FEATURES.md` app manifest is unfilled.** The bundle ships it as a template. A real manifest for this app has to be derived from `ARCHITECTURE.md` (~2700 lines) and would be a task of its own; inventing one quickly would produce a manifest that regression tables are checked against but that is itself wrong — worse than an empty one. Recommend a dedicated round.
2. **`routing_guard_mode` is `observe`.** Per the bundle README, run `tests/test-routing-hook.md` to learn which hook-input fields identify a subagent before switching to `enforce`. Cannot be done from the installing session — hooks load at session start.
3. ~~**Hooks govern sessions that start after merge to `main`.**~~ Resolved: PR #91 merged; the plan gate, skill router, validation line and record guard all fired in the 2026-09-22 session.
4. **Assumption on record:** `docs/CLAUDE.review-rev1.md` in the request was read as `rev2`. If a rev1 was genuinely expected to exist, the bundle is missing it.
