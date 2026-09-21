# WORKING RECORD — Weekly-Planner — rules v2

Single working record for this repository. Updated by the main session at the end of every implementation turn (the record guard hook checks this). Keep it terse; history lives in git.

## Approved baseline
- 2026-09-21, branch `Rules-v2`: install working-rules bundle v2.1 into the repo root, verify with `tests/replay-hooks.sh`, commit and push. Given as a direct instruction rather than a Plan vN — the session predates the plan gate, which loads only from `main`.
- 2026-09-21, in-session decision (asked and answered): `CLAUDE.md` is **split**, not overwritten. Bundle global rules take the `CLAUDE.md` filename; this repo's architecture doc moves to `ARCHITECTURE.md`.

## Pending
- None. PR [#91](https://github.com/lxyzh1019-cyber/Weekly-Planner/pull/91) is open against `main` and awaiting the owner's merge.

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

## Hotspot counter
| Area / feature | Fix rounds | Recurrences | Last symptom | Rewrite-vs-repair reviewed? |
|---|---|---|---|---|
| Rules/governance install | 1 | 0 | — (first round) | n/a |
| `CLAUDE.md` filename collision | 1 | 0 | Bundle and repo both claim the root `CLAUDE.md`; different documents | yes — resolved by split, not patch |
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
| Zip removed | COMPLETE | `working-rules-bundle-v2 (2).zip` deleted in `59dfc1d` |
| `WORKING_RECORD.md` filled for this repo | COMPLETE | this file |
| `FEATURES.md` — governance surface | COMPLETE | bundle-introduced features listed |
| `FEATURES.md` — **app** feature manifest | NOT STARTED | Open question 1 below. No app feature changed this round, so nothing is yet at risk. |
| `routing_guard_mode: enforce` | NOT STARTED | Blocked on `tests/test-routing-hook.md`, which must run in a session where the hooks are live (i.e. after merge to `main`). |

## Checks and evidence
- 2026-09-21 `bash tests/replay-hooks.sh` → **passed=14 failed=0**; `.claude/hooks/config.json` confirmed restored to `routing_guard_mode: "observe"`, `.claude/state/` empty.
- 2026-09-21 `npm run check` → **green**: 43 files pass `node --check`; 1943 top-level declarations, no duplicates; 16 `state.shared` keys all with a merge decision (14 arbitrated, 2 declared LWW); escaping lint clean; 1379 CSS classes and 373 ids all referenced; 7 test suites all run by `npm test` and CI; 43 scripts all loaded and cached, SW_VERSION `2026-09-21c`.
- 2026-09-21 `npm run test:smoke` → **not run** this round. Justified: no `js/`, `css/`, `index.html` or `sw.js` file was touched. The only non-governance edits were two prose lines in `README.md` and `SECURITY_TODO.md`.
- 2026-09-21 Hooks verified live by observation: `record-guard.py` blocked this very turn for an incomplete record, which is the intended behaviour and the first real-session evidence that the Stop hooks fire.

## Open questions / blockers
1. **`FEATURES.md` app manifest is unfilled.** The bundle ships it as a template. A real manifest for this app has to be derived from `ARCHITECTURE.md` (~2700 lines) and would be a task of its own; inventing one quickly would produce a manifest that regression tables are checked against but that is itself wrong — worse than an empty one. Recommend a dedicated round.
2. **`routing_guard_mode` is `observe`.** Per the bundle README, run `tests/test-routing-hook.md` to learn which hook-input fields identify a subagent before switching to `enforce`. Cannot be done from the installing session — hooks load at session start.
3. **Hooks govern sessions that start after merge to `main`.** PR #91 must merge before any of this applies to normal work.
4. **Assumption on record:** `docs/CLAUDE.review-rev1.md` in the request was read as `rev2`. If a rev1 was genuinely expected to exist, the bundle is missing it.
