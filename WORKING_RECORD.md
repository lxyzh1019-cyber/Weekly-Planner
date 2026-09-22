# WORKING RECORD — Weekly-Planner — rules v2

Single working record for this repository. Updated by the main session at the end of every implementation turn (the record guard hook checks this). Keep it terse; history lives in git.

## Approved baseline
- 2026-09-21, branch `Rules-v2`: install working-rules bundle v2.1 into the repo root, verify with `tests/replay-hooks.sh`, commit and push. Given as a direct instruction rather than a Plan vN — the session predates the plan gate, which loads only from `main`.
- 2026-09-21, in-session decision (asked and answered): `CLAUDE.md` is **split**, not overwritten. Bundle global rules take the `CLAUDE.md` filename; this repo's architecture doc moves to `ARCHITECTURE.md`.
- **2026-09-22, Plan v5 approved** — "Money system: stop the bleeding, the Grandma rule, then the pool". Branch `claude/happy-bardeen-1xalni` from `main` @ `f4d1db5`. Sequence: Step 0 (this record) → PR A → PR B → C0 mockup → owner sign-off → PR C. Value-engineering items VE-1…VE-14 accepted; VE-11 (weekly/monthly) un-deferred at the owner's request; VE-3, VE-7, VE-9, VE-10 deferred with reasons. Full plan: `/root/.claude/plans/1-one-kid-completed-quizzical-kitten.md` (session-local).

## Pending
- PR A (stop the bleeding) — next, delegated to `opus-worker`.
- PR [#91](https://github.com/lxyzh1019-cyber/Weekly-Planner/pull/91) — **merged** to `main` (`f4d1db5`).

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
| 11 | R2 2026-09-22 | "Validate the handoff" (a second session's audit of PR #90) | done | 11 claims checked in code; 4 corrected (prose not literals; wallet fields still read by a migration; a geometric order check does exist; the editor does exist). |
| 12 | R2 2026-09-22 | "Compare to your promises in the original plan" | done | 9 load-bearing promises graded: 3 Guaranteed, 2 Checked, 1 Assumed, 3 Broken. |
| 13 | R2 2026-09-22 | "My Money and Money school duplicate — propose a layout, or combine" | open → PR C | Decided: rebalance three pages, don't merge. |
| 14 | R2 2026-09-22 | "Where is the cash pool? You promised" | open → PR C | Admitted not delivered: the Flow's "left" is cash only. Pool on both My money and the story. |
| 15 | R2 2026-09-22 | Grandma rule: $3/week from a chosen start date to 30 May | open → PR B | Only weeks with no record at all. Extends the existing sweep card (VE-4). |
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

## Hotspot counter
| Area / feature | Fix rounds | Recurrences | Last symptom | Rewrite-vs-repair reviewed? |
|---|---|---|---|---|
| Rules/governance install | 1 | 0 | — (first round) | n/a |
| `CLAUDE.md` filename collision | 1 | 0 | Bundle and repo both claim the root `CLAUDE.md`; different documents | yes — resolved by split, not patch |
| **Pocket money** (stream, rules, meeting, money pages) | **3** — PR #89, PR #90, R2 | **1** — a click handler keyed on an attribute its host never listens for (`data-pm-action` then `data-mny-action` on `#mnyRulesWrap`) | House rules never reached a stored rulebook; two dead buttons; `[object Object]` in the change log | **yes — 2026-09-22, repair** (below) |
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

## Deliverable ledger
| Deliverable | State | Evidence |
|---|---|---|
| `.claude/` (settings, 6 hooks, opus-worker agent, hz-guarantee-audit skill) | COMPLETE | Committed `59dfc1d`; `replay-hooks.sh` 14/14 |
| `CLAUDE.md` — global working rules v2.1 | COMPLETE | 13.5KB at root, with `ARCHITECTURE.md` pointer block |
| `ARCHITECTURE.md` — Weekly-Planner architecture doc | COMPLETE | `git mv` from `CLAUDE.md`, 163KB, history preserved |
| `docs/HZ-skill-trigger-tuning.md` | COMPLETE | Committed; `docs/CLAUDE.review-rev2.md` deleted per install procedure |
| `tests/replay-hooks.sh`, `tests/test-routing-hook.md` | COMPLETE | `passed=14 failed=0` |
| `.gitignore` — track `.claude/`, ignore state + pycache | COMPLETE | `git status` clean of `.pyc` |
| Zip removed | COMPLETE | `working-rules-bundle-v2 (2).zip` deleted in `59dfc1d` |
| `WORKING_RECORD.md` filled for this repo | COMPLETE | this file |
| `FEATURES.md` — governance surface | COMPLETE | bundle-introduced features listed |
| `FEATURES.md` — **app** feature manifest | PARTIAL | Money area manifested 2026-09-22 (Step 0). Everything else still checks against `ARCHITECTURE.md` — open question 1. |
| Plan v5 Step 0 — rewrite-vs-repair comparison, hotspot row, records | COMPLETE | This file; `FEATURES.md` money section |
| Plan v5 PR A — stop the bleeding (A1–A12) | PARTIAL — in progress with `opus-worker` | |
| Plan v5 PR B — Grandma rule, star level relabel, August banner | NOT STARTED | |
| Plan v5 C0 — clickable mockup for sign-off | COMPLETE — awaiting owner sign-off | Design canvas https://claude.ai/artifact/3fYy6KiQMcSissRGBvnG6d (private); started ahead of PR B because sign-off is the long pole — content unchanged |
| Plan v5 PR C — the pool and three pages | NOT STARTED | Blocked on C0 sign-off |
| `routing_guard_mode: enforce` | NOT STARTED | Blocked on `tests/test-routing-hook.md`, which must run in a session where the hooks are live (i.e. after merge to `main`). |

## Checks and evidence
- 2026-09-21 `bash tests/replay-hooks.sh` → **passed=14 failed=0**; `.claude/hooks/config.json` confirmed restored to `routing_guard_mode: "observe"`, `.claude/state/` empty.
- 2026-09-21 `npm run check` → **green**: 43 files pass `node --check`; 1943 top-level declarations, no duplicates; 16 `state.shared` keys all with a merge decision (14 arbitrated, 2 declared LWW); escaping lint clean; 1379 CSS classes and 373 ids all referenced; 7 test suites all run by `npm test` and CI; 43 scripts all loaded and cached, SW_VERSION `2026-09-21c`.
- 2026-09-21 `npm run test:smoke` → **not run** this round. Justified: no `js/`, `css/`, `index.html` or `sw.js` file was touched. The only non-governance edits were two prose lines in `README.md` and `SECURITY_TODO.md`.
- 2026-09-21 Hooks verified live by observation: `record-guard.py` blocked this very turn for an incomplete record, which is the intended behaviour and the first real-session evidence that the Stop hooks fire.
- 2026-09-22 Headless Chromium, `main` @ `f4d1db5`, Firebase blocked: every money surface rendered at 430px; **~387 controls clicked** as parent and as child with state restored between clicks — **0 throws, 0 page errors**. Two dead buttons confirmed by watching `#recordOverlay` never gain `open`; `[object Object]` reproduced at **15** occurrences from one `coApply`; Flow caption observed at **$0.00 above a $30.00 bar**.
- 2026-09-22 No npm suite run this round — no source file changed.

## Open questions / blockers
1. **`FEATURES.md` app manifest is unfilled.** The bundle ships it as a template. A real manifest for this app has to be derived from `ARCHITECTURE.md` (~2700 lines) and would be a task of its own; inventing one quickly would produce a manifest that regression tables are checked against but that is itself wrong — worse than an empty one. Recommend a dedicated round.
2. **`routing_guard_mode` is `observe`.** Per the bundle README, run `tests/test-routing-hook.md` to learn which hook-input fields identify a subagent before switching to `enforce`. Cannot be done from the installing session — hooks load at session start.
3. ~~**Hooks govern sessions that start after merge to `main`.**~~ Resolved: PR #91 merged; the plan gate, skill router, validation line and record guard all fired in the 2026-09-22 session.
4. **Assumption on record:** `docs/CLAUDE.review-rev1.md` in the request was read as `rev2`. If a rev1 was genuinely expected to exist, the bundle is missing it.
