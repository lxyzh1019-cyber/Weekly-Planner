# WORKING RECORD — Weekly-Planner — rules v2

Single working record for this repository. Updated by the main session at the end of every implementation turn (the record guard hook checks this). Keep it terse; history lives in git.

## Approved baseline
- 2026-09-21, branch `Rules-v2`: install working-rules bundle v2.1 into the repo root, verify with `tests/replay-hooks.sh`, commit and push. Given as a direct instruction rather than a Plan vN — the session predates the plan gate, which loads only from `main`.
- 2026-09-21, in-session decision (asked and answered): `CLAUDE.md` is **split**, not overwritten. Bundle global rules take the `CLAUDE.md` filename; this repo's architecture doc moves to `ARCHITECTURE.md`.
- **2026-09-22, Plan v8 approved** — the three known limits from B5–B7 are closed on #92 before the merge: B8 meeting Undo withdrawn once money moves after the commit; B9 "Meets never paid" catch-up in the repair card (adds only); B10 a defaulted week's record is read-only and shows the flat amount + meets. Fines are a thin OUTFLOW in the pool (owner). **The cash pool (PR C) stays out of #92**; handed off in `docs/handoff/pr-c-cash-pool.md`.
- **2026-09-22, Plan v7 approved** — the Grandma rule rebuilt to the owner's test (from a start week the owner enters and saves as a dated rule; weeks OUTSIDE the 8-week review window; NO family meeting record — `meetingsMet` or `meetingsHeld`; $3; one rule replaces the old "nobody sat down for" sweep) (B5, B7); competitions paid on top (B6), widened by the owner after approval to EVERY settled week: "a settled week should not block a late competition". My money rebuilt around the pool as the owner designed it — inlet (pay), outlet (loan payment, spending), dashed investment loop — with the four pot tiles and NO added-up total; earn · spend · invest · cash; price list, "what paying it opens" and saving goal as pop-ups; competition calendar and gifts as cards AND from the inlet (C1, C2). The pool picture comes from Claude Design, from my brief (C8). The Zones mockup board is retired.
- **2026-09-22, Plan v6 approved** — adds: iPad Pro 11″ landscape as the main interface; one week/month target card (opens on the week, never stored, switches itself to the month once the weekly target is reached; on Today the toggle sits on top and drives came in / went out / put away and the target); unlock gates 20/30/40% from one threshold table, parent-tunable (S4); Money school balanced on iPad; "💧 My cash pool" titled and kept separate from the target card; a what-I-have / what-I-owe line chart (C6) and paired in/out month columns (C7); S2 pot-opening moment, S3 visible build stamp. PR B (B1–B4 + S2–S4) has a 1 Oct deadline. S1 withdrawn.
- **2026-09-22, Plan v5 approved** — "Money system: stop the bleeding, the Grandma rule, then the pool". Branch `claude/happy-bardeen-1xalni` from `main` @ `f4d1db5`. Sequence: Step 0 (this record) → PR A → PR B → C0 mockup → owner sign-off → PR C. Value-engineering items VE-1…VE-14 accepted; VE-11 (weekly/monthly) un-deferred at the owner's request; VE-3, VE-7, VE-9, VE-10 deferred with reasons. Full plan: `/root/.claude/plans/1-one-kid-completed-quizzical-kitten.md` (session-local).

## Pending
- B5–B7 committed on #92. Owner: save the start week in Money rules › 👵 Grandma rule, then preview before crediting.
- #92 description updated + ready for review; owner merges before 1 Oct and checks the iPad stamp reads 2026-09-22d.
- **Found in passing (pre-existing, not fixed):** a legitimate meeting Undo puts the wallet back but leaves the commit's lines in the money stream, so a re-commit double-counts in the stream (the wallet is right; `evShadowDrift` shows the gap). PR C reads every figure from the stream, so this must be fixed before PR C — listed in the handoff.
- Closed by B8–B10 (was): older 'default' rows holding unpaid meets are caught up only when a meet in that week is next touched; `mnyEditLedger` recomputes gross on a defaulted row without the flat amount (pre-existing); meeting Undo after a late meet then re-commit could pay it twice (session-only).
- PR #92 (PR A + PR B + B5–B7) must be merged and deployed before 1 Oct.
- C8 Claude Design brief → owner runs Claude Design → owner signs off the pool picture → gates PR C.
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

## Hotspot counter
| Area / feature | Fix rounds | Recurrences | Last symptom | Rewrite-vs-repair reviewed? |
|---|---|---|---|---|
| Rules/governance install | 1 | 0 | — (first round) | n/a |
| `CLAUDE.md` filename collision | 1 | 0 | Bundle and repo both claim the root `CLAUDE.md`; different documents | yes — resolved by split, not patch |
| **Pocket money** (stream, rules, meeting, money pages) | **4** — PR #89, PR #90, R2 (PR A), R3 (B5–B7, then B8–B10 closing B6's own known limits in the same round — not a new round: no new symptom from the field) | **2** — (i) a click handler keyed on an attribute its host never listens for; (ii) **a settled week blocks competition money** — the "$21 meet in a $0 week" (repaired for legacy weeks only), again for Grandma weeks and, per the owner, any settled week | House rules never reached a stored rulebook; two dead buttons; `[object Object]`. PR A review found two more, both older than PR A: the change log drawn twice, and the move form redrawing on every keystroke. Both fixed in PR A, test first. | **yes — 2026-09-22, repair** (below) |
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
| Zip removed | COMPLETE | `working-rules-bundle-v2 (2).zip` deleted in `59dfc1d` |
| `WORKING_RECORD.md` filled for this repo | COMPLETE | this file |
| `FEATURES.md` — governance surface | COMPLETE | bundle-introduced features listed |
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

## Checks and evidence
- 2026-09-21 `bash tests/replay-hooks.sh` → **passed=14 failed=0**; `.claude/hooks/config.json` confirmed restored to `routing_guard_mode: "observe"`, `.claude/state/` empty.
- 2026-09-21 `npm run check` → **green**: 43 files pass `node --check`; 1943 top-level declarations, no duplicates; 16 `state.shared` keys all with a merge decision (14 arbitrated, 2 declared LWW); escaping lint clean; 1379 CSS classes and 373 ids all referenced; 7 test suites all run by `npm test` and CI; 43 scripts all loaded and cached, SW_VERSION `2026-09-21c`.
- 2026-09-21 `npm run test:smoke` → **not run** this round. Justified: no `js/`, `css/`, `index.html` or `sw.js` file was touched. The only non-governance edits were two prose lines in `README.md` and `SECURITY_TODO.md`.
- 2026-09-21 Hooks verified live by observation: `record-guard.py` blocked this very turn for an incomplete record, which is the intended behaviour and the first real-session evidence that the Stop hooks fire.
- 2026-09-22 Headless Chromium, `main` @ `f4d1db5`, Firebase blocked: every money surface rendered at 430px; **~387 controls clicked** as parent and as child with state restored between clicks — **0 throws, 0 page errors**. Two dead buttons confirmed by watching `#recordOverlay` never gain `open`; `[object Object]` reproduced at **15** occurrences from one `coApply`; Flow caption observed at **$0.00 above a $30.00 bar**.
- 2026-09-22 PR A, main session's own run: `npm test` all green — check 8/8 · merge 112 · buffers 9 · stream 31 · cleanup · xp 28 · money 33 · smoke 321 (click sweep 357 controls ≈38 s). CI on PR #92: *Syntax, globals, merge tests* ✓ and *Headless smoke test* ✓.
- 2026-09-22 Chart palette validated with the dataviz validator against #fffdf5: all six checks pass (CVD ΔE 16.8, normal-vision 22.3, contrast ≥ 3:1).

- 2026-09-22 B5–B7, main session's own run: `npm test` exit 0 — check 8/8 (SW_VERSION 2026-09-22c = APP_BUILD) · merge 112 · buffers 9 · stream 31 · cleanup · xp 28 · money 33 · smoke ALL PASSED.

- 2026-09-22 B8–B10, main session's own run: `npm test` exit 0 — check 8/8 (2026-09-22d) · merge 112 · buffers 9 · stream 31 · cleanup · xp 28 · money 33 · smoke ALL PASSED.

## Open questions / blockers
1. **`FEATURES.md` app manifest is unfilled.** The bundle ships it as a template. A real manifest for this app has to be derived from `ARCHITECTURE.md` (~2700 lines) and would be a task of its own; inventing one quickly would produce a manifest that regression tables are checked against but that is itself wrong — worse than an empty one. Recommend a dedicated round.
2. **`routing_guard_mode` is `observe`.** Per the bundle README, run `tests/test-routing-hook.md` to learn which hook-input fields identify a subagent before switching to `enforce`. Cannot be done from the installing session — hooks load at session start.
3. ~~**Hooks govern sessions that start after merge to `main`.**~~ Resolved: PR #91 merged; the plan gate, skill router, validation line and record guard all fired in the 2026-09-22 session.
4. **Assumption on record:** `docs/CLAUDE.review-rev1.md` in the request was read as `rev2`. If a rev1 was genuinely expected to exist, the bundle is missing it.
