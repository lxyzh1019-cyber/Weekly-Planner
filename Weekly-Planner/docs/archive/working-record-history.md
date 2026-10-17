# WORKING RECORD history — Weekly-Planner

Moved out of WORKING_RECORD.md on 2026-10-08 (PR 0-B, Plan v6). Read only when a task names it.

## Approved baseline
- 2026-09-21, branch `Rules-v2`: install working-rules bundle v2.1 into the repo root, verify with `tests/replay-hooks.sh`, commit and push. Given as a direct instruction rather than a Plan vN — the session predates the plan gate, which loads only from `main`.
- 2026-09-21, in-session decision (asked and answered): `CLAUDE.md` is **split**, not overwritten. Bundle global rules take the `CLAUDE.md` filename; this repo's architecture doc moves to `ARCHITECTURE.md`.
- 2026-09-22, branch `claude/inspiring-gauss-232zww`: **Plan v4 approved** — "The non-money half, plus the pocket-money handoff". Three staged commits (school-day offer · profile badges · watch a sister compete), one draft PR. All pocket-money work is deferred to `HANDOFF-pocket-money.md` and a separate chat, at the owner's instruction.
- **2026-09-24, R5: Plan v4 approved** (ExitPlanMode, local desktop session, branch `claude/charming-hawking-4f8mm1` from `main` @ `fa06ed5`) — "Sister Sync as a timeline tab, invites that carry travel and repeat, a lighter day toolbar, catching up on missed days, and Chores rebuilt in its new homes". Two draft PRs: PR 1 = 5a nav + More trim · 5b invite travel/get-ready, missed invites, add-anyway, Day-view accept on the same owners · 5c series invites, badge-leak fix, moved-block flag · 5e Sync timeline · 5f templates retired + copy-a-day preview, pins not copied for a child · 5g reflection on Today, day passed explicitly · 5h start-this-day-over. PR 2 (cut from PR 1's head) = 5d relocation map · C1 chore actions + catch-up · C2 chore views. C3 (retire the Chores screen) waits for the owner's per-row confirmation. Plan text: `~/.claude/plans/pasted-content-id-2333-plan-tingly-zebra.md` (v4, Rev 3).
- 2026-09-24, R5 owner decisions (AskUserQuestion): Sister Sync = a bottom tab; invites copy the sender's travel and get-ready; repeating blocks ask "this day, or all?"; Chores features rebuilt in new homes, screen retired only after confirmation; Q1–Q4 built as described; a missed invite offers "add it anyway"; a shared block dragged to another day keeps its 💌 and is flagged "moved, send again?"; build in the local desktop session.
- 2026-09-22, owner's four decisions on record (AskUserQuestion): a kid may **propose** a meet (deferred to the handoff); **Dance** comes out of the competition categories and **skating star level** goes in, with an editable category table (deferred); watch/accompany is built by **extending Sister Sync invites** with a `watching` flag on the competition block, no competition reward, no money-tab link; delivery is **one branch, staged commits, one PR**.
- **2026-09-26, R8** (branch `claude/epic-hopper-4dri6p`): run `hz-claude-config`'s `install-stub.sh` (the owner explicitly allowed the script); owner's choice **"Installer + restore"** — restore the `ARCHITECTURE.md` section in `CLAUDE.md` and fix the docs that describe removed files. Commit on a new branch, push and PR only if `INSTALL OK` — each still gated by the permission prompt.
- **2026-09-26, R10: Plan v2 approved** (called **R9** and rows #55–#60 on the branch, in commit `209e9f6` and in PR #100; renumbered R10 / #56–#61 when `main` was merged in, because PR #99's parallel session had already taken R9 and #55) (ExitPlanMode; `~/.claude/plans/continue-approved-plan-v1-recursive-harbor.md`, v1 was `hi-rustling-reddy.md`), branch `claude/badges-record` from `main` @ `ba078af`, rules v3.1.3. Record clean-up (main session) + one profile-badge wording via `profileBadgeText(kid, asParent)` (`opus-worker`, effort configured: medium) + build 2026-09-26b + one draft PR. Session model: Opus 5.5 (Fable unavailable) — Opus plans and checks, code goes to `opus-worker`.
- **2026-09-27, R11: Plan v7 approved** (ExitPlanMode; `~/.claude/plans/d-user-heng-z-downloads-looks-calm-pop-mossy-newt.md`), branch `claude/looks-calm-pop` from `main` @ `72fd6eb`, rules v3.1.3. "Two looks, Pop and Calm", planned from the owner's handoff **v6** (`docs/handoff/looks-calm-pop.md`, saved verbatim, with `docs/handoff/looks-example.html`). The owner's message header said "Plan v2"; the attached file is v6 and replaces v2–v5. Owner answers (AskUserQuestion): **derive all 12 subgroup colours** in Stage 2 (old → new table signed off in the PR); **stack the five stage PRs back-to-back** (each branch from the one before, merged in order by the owner); **save the example page too**. Session model: Opus 5.5 (Fable unavailable) — Opus plans and checks, source edits go to `opus-worker` (effort configured: medium).

- **2026-09-27, R11: Plan v8 approved** ("approve v8") — v7 plus Rev 1: Stage 4C, one font everywhere (owner request #78), in PR 4.

- **2026-09-27, R12: Plan v1 approved** ("approve v1") — Catch up on Today: this week only (owner: "too much for 8 weeks"), placed directly under "Modify my plan" (owner's layout answer), day rows stay folded one at a time; branch `claude/catchup-this-week` stacked on PR #105; build 2026-09-27f.

- **2026-10-03, R14: Plan v3 approved** (ExitPlanMode; plan copied to `docs/handoff/plan-v3-sunday-v15.md`), branch `claude/sunday-v15` from `main` @ `8b56fdb`, rules v3.1.23. "Sunday v15 pocket-money redesign": the owner's three prototypes (Sunday v15, My Money v2, Grown-ups v2) and `HANDOFF-Claude-Code.md` are the spec, byte-close unless a deviation is approved (the plan's Deviations table). One PR. Executor `opus-worker`.

- **2026-10-03, R14: Plan v5 approved** (owner: "Approve Plan v5"; income groups "Use these groups"). Adds section L (the owner's 21 picks), Deviations 8/23/30 corrections, Stage 3a. Plan copy: `docs/handoff/plan-v3-sunday-v15.md`.

- **2026-10-04, R14: Plan v6 approved** (owner: "Approve Plan v6"; first Sunday–Saturday money week "Sun 11 Oct"). Section M: fixes (6a), mockups (6b), owner review (6c), build redesigns (6d).

- **2026-10-05, R15: Plan v1 approved** (ExitPlanMode; `plans/d-user-heng-z-downloads-fix-money-style-logical-corbato.md`), "Money fit and logic", branch `claude/money-rules` from `main` @ `1b2d43f`, rules v3.1.29, session model Fable 5.1. Built from the owner's external audit (`FIX-money-style-consistency.md`, 2026-10-05) checked against the code: 14 real findings, 6 wrong, 6 against earlier decisions. Five stacked PRs (rules · words · tokens+checks · old pages · fit); a side-by-side page before PR 4. Owner answers: decisions 1–8 "I agree with you" (recommendations); 9–11 taken as recommended with the approval (Chores-tab card → door; Story on money weeks; old handoff archived); 12 (keep list) decided on the side-by-side page.

- **2026-10-06, R15: Plan v2 approved** (ExitPlanMode; same plan file, Rev 2): decisions 12–15 — the twelve keep-or-retire marks as made; two tabs (My money · Money school) with the Story's two parts as doors off the passbook; the money week back to Monday–Sunday everywhere (Deviation 34 withdrawn before its first week) with the Sunday evening routine counted as kept at the meeting ("counted as done automatically"). PR 4 = part A (week) + part B (old pages). Stages unchanged (13).

- **2026-10-06, R16: Plan v1 approved** (ExitPlanMode; `plans/pasted-content-id-1cd8-weekly-planner-c-partitioned-pebble.md`), "Weekly-Planner consistency pass", branch `claude/consistency-0a` from `main` @ `8a5c77d`, rules v3.1.32. Built from the owner's merged source plan v2 (`app-consistency-plan-v2-source.md`, D1–D13) and four review files; all 19 content-ledger phrases in the plan. Owner answers before approval: 1 pictures compared in the browser, no new add-on; 2 the unread builds and the money walk-through fold into PR 1's iPad read; 3 Reading size default 1.2 (D14). Plan named v1 at the owner's instruction (as #116).

- **2026-10-07, R16: Plan v2 approved** (ExitPlanMode; same plan file): PR 0-pre first, on the owner's instructions (#129) — Chores money door at least 44px at 390, build bump, the 7 Oct cause, smoke on four fixed dates; nothing else; then `claude/consistency-0a` rebased onto `main`. 35 stages.

## Pending
- PR [#91](https://github.com/lxyzh1019-cyber/Weekly-Planner/pull/91) **merged** 2026-09-21 as `f4d1db5`. (This line previously said "awaiting the owner's merge" — corrected 2026-09-22.)
- **PR [#93](https://github.com/lxyzh1019-cyber/Weekly-Planner/pull/93) — merged to `main` as `fa06ed5`** (corrected 2026-09-24; this line previously said "draft, open"). Original note: Last code change: the #34 wrong-day fix, then `main` (PR #92) merged in (#35), build 2026-09-23b. Description updated 2026-09-23 to include both. Final gate on the merged head: `npm run check` OK, smoke 347/347.
- **SUPERSEDED 2026-09-26 (R10)** — later builds replaced 23b; the owner read **2026-09-25a** on the iPad (#51). Original: **After merge, the owner's one step:** open Today → ⋯ More on the iPad and read **Build 2026-09-23b**. That is the only way to claim "deployed" under the rules; nothing has been read on the live URL yet.
- **Approved (#33), done:** 4a `SMOKE_ONLY` ✅ `126506a` · 4b build number ✅ `a03f1c2` · 4c dead-button check ✅ `46c7306` · 4d repeat-invite guard ✅ `718bb84` · 4e 💌 note on Today ✅ `a25f8ec`. **All five complete.**
- **Approved (#34), done:** the Sister Sync wrong-day fix (Open questions 6, now closed). Build **2026-09-23b** — after merge, that is the number to read on the iPad, not 23a.
- **Not approved, proposed for its own round:** tier-2 click sweep; tier-3 logic review of non-money screens.
- All pocket-money items are **open but not in this round**. See `HANDOFF-pocket-money.md` §12 for the order they should be taken in.

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
- 2026-09-26 **R8 stub install, worker checks** (no app file touched): `python3 -m json.tool .claude/settings.json` OK; `grep -c '.claude/hooks/' .claude/settings.json` → 0; stale-reference grep → only historical record entries and the R8 notes in `FEATURES.md`, plus a gitignored `.claude/hooks/__pycache__/_common.cpython-311.pyc` left on disk from before the install. `npm ci && npm test` exit 0: check 9/9 (SW_VERSION 2026-09-26a = APP_BUILD; 26 reverse warnings, unchanged) · merge 112 · buffers 9 · stream 31 · cleanup pass · xp 28 · money 33 · smoke 388/388. Central hooks read from `~/.cache/hz-rules/3.1.0/`: the record-guard has **no** Bash-write detection (A3 not carried over), and the default governance list has **no** `ARCHITECTURE.md`. Central `hotspot_alerts()` run on this record flags Pocket money and Sister Sync invites (both before and after the new columns): their "reviewed" cells start `**yes`/`**Yes`, and the hook only accepts a cell starting `yes`.
- 2026-09-29 **R13 stub reinstall, main-session checks** (no app file touched; governance + docs only): `python3 -m json.tool .claude/settings.json` OK; `.claude/` holds only `agents`, `hz-loader.py`, `settings.json`, `state` (no `hooks/`); branch confirmed fresh — `git log origin/main..HEAD` empty after `git fetch origin main` (the pre-fetch ref was stale and wrongly showed 50 commits), and not yet on origin. `npm ci && npm test` → **3 failures: `step1GradeReachesStep3`, `thePopLookReadsEverywhere`, `sisterSyncFitsInBothLooksFonts`. **Pre-existing, not caused by this change**: a detached worktree of `origin/main` @ `e05bcb5` (`npm ci && npm test`) fails on exactly the same three, and this commit touches no file any suite reads. They belong to the open R11 looks work. Worktree removed and pruned. Stale-reference grep over `README.md`/`FEATURES.md`/`WORKING_RECORD.md`/`ARCHITECTURE.md` found 5 now-false current claims (three-file stub list, smoke `v3.1.0`, `model: fable`, the `ask` list, the per-hook wiring) — all corrected this commit and annotated "R13"; historical record rows left untouched, confirmed by `git diff --unified=0` showing only those lines.
- 2026-09-27 **R11 read-only check of handoff v6 against `main` @ `72fd6eb`** (two Explore agents + main session). Corrections to the handoff, all carried into Plan v7:
  1. Blocks are coloured from the 12 subgroup hexes in `ACTIVITY_CATEGORIES` via `blockColour`; CSS `--cat-*` are barely read and disagree with `CAT_HEX` (training `#f2597d` vs `#ef476f`, free `#7fca79` vs `#95d5b2`, routine `#8ad8d0` vs `#80cbc4`). A recolour must grow `RETIRED_SEEDED_HEXES`.
  2. Ink `#2a2320` is hard-coded in `isLightColour` (`js/08-day-view.js:701`) and `everySubgroupTellsItselfApart` (`tests/smoke.js:1861`).
  3. Font-dependent week-grid measurements also include `WF_ROW` (`js/07-week-view.js:1132`), `WF_NAME_ONE_LINE_CHARS`, `WF_BAND_LABEL_PX`; `wfTextPx`'s comment names 13.1px but not Patrick Hand.
  4. 721 `font-size` in `css/app.css`, 399 through `--fs-scale`; no font tokens; 151 `font-family`.
  5. css 477 hex + 99 `rgba()` (518 outside tokens); js 156 hex, 151 `style="`, 206 `.style.`; index.html 87 `style="`; `--parent` unread (confirmed).
  6. No pixel-diff tooling; one screenshot at 1194×834; none in dark mode; fonts load live from Google. Stage 1's gate is a computed-style comparison main vs branch.
  7. SVG strings in `js/28-chore-trends.js` use kid colours `#cf8f22`/`#3d7fd6`; `theme-color` and `manifest.json` hard-code `#fef9ef`; test browser is playwright-core.

### Regression table — R8 stub install (FEATURES v10 → v11)
| Feature | v10 → v11 | Note |
|---|---|---|
| `CLAUDE.md` holds the version-stamped global rules | changed (installer) | Now a pointer; the rules and their version come from the session-start hook (v3.1.0). |
| `ARCHITECTURE.md` holds the repo's rules; `CLAUDE.md` points to it | kept | Section restored after the pointer. |
| `see CLAUDE.md` comments resolve to `ARCHITECTURE.md` in one hop | kept | The restored section still says so. |
| `WORKING_RECORD.md` single ledger / hotspot / deliverables | kept | Hotspot table gains 'Regressions caused' and 'Workarounds/exceptions' (added). |
| `FEATURES.md` is the manifest | kept | |
| Governance-path exemption list, set per repo | changed | `.claude/hooks/config.json` removed; central defaults apply. |
| — `ARCHITECTURE.md` exempt from the guards | **missing** | Not in the central default list; not asked for. The owner should confirm it, or add it centrally. |
| `model: fable`; `opus` worker | kept | Worker file is now the central stub: `effort: medium` (was `high`), `skills:` line dropped. |
| `defaultMode: plan`, `ask` list, `deny` list | kept | Byte-identical in `settings.json`. |
| plan-gate, skill-router, routing-guard (`observe`), validation-line | kept | Now central, through `hz-loader.py`. |
| record-guard | kept | Now central. Adds a worker-dispatch trigger and a block on a missing or template `FEATURES.md`. |
| — record-guard counts Bash writes to the record (A3) | **missing** | Not in central v3.1.0; not asked for. |
| `.claude/state/` gitignored hook logs | kept | |
| SessionStart hook + `.claude/hz-loader.py` | added | |
| `.claude/skills/hz-guarantee-audit/` | intentionally removed | Moved to `hz-claude-config` (installer). |
| `tests/replay-hooks.sh`, `tests/test-routing-hook.md` | intentionally removed | Moved to `hz-claude-config` `central/hooks/` (installer). |
| `docs/HZ-skill-trigger-tuning.md` | intentionally removed | Installer; not in the central manifest — where it lives now is unverified. |
| Smoke subset, dead-action guard, Windows gate | kept | Byte-identical. |
| App features, Pocket money | kept | Byte-identical; no app file touched; `npm test` green. |

### Regression table — R9 Sister Sync hotspot review (FEATURES v11, unchanged)
| Feature | v11 → v11 | Note |
|---|---|---|
| Every `FEATURES.md` app feature, Sister Sync and its invites included | kept | No file under `js/`, `css/`, `index.html`, `sw.js` or `tests/` touched; no build stamp change. |
| `WORKING_RECORD.md` hotspot table | kept | Sister Sync row corrected (6 rounds, reviewed `yes 2026-09-26`, no pipe inside a cell); round 5–6 comparison added. |
| `FEATURES.md` is the manifest | kept | Not edited; nothing to add. |

### Regression table — R10 one badge wording (FEATURES v11 → v12)
| Feature | Result | Note |
|---|---|---|
| Five badges are `<button class="profile-badge" onclick="openProfileSwitcher()">`; one switcher | kept | `everyProfileBadgeSwitchesProfile` passes |
| Every badge prints who is on screen, a parent included | changed | One wording from `profileBadgeText`: `👨‍👩‍👧‍👦 Parent (Jenn/Jess)` / `🐥 Jenn` / `🦊 Jess` |
| Week `🐥 Jenn (P)`, Day `🐥 (P)` wording | intentionally removed | Owner's choice (#57) |
| One writer `profileBadgeText` (`js/01-config.js`) | added | No hand-copied badge string left (grep) |
| Each screen's own child | kept | Only the wording changed |
| Empty badge for an unset profile | kept | Week/Day/Chores/Sync now also `''` there instead of a silent `🦊 Jess` (unreachable for a parent) |
| Parent Day badge on two lines (`.profile-badge--parent`) | added | Plan v3 step 2b |
| R7 compact Day top bar height; 44px targets; child's Day badge one line | kept | 179/179/75/71 (63 scrolled); badge 99×46 |
| Meeting lock; `enhanceAccessibility` labels only real controls | kept | Untouched |
| `everyProfileBadgeSaysTheSameThing`, `parentDayTopBarStaysCompact` | added | Both failed first |
| `APP_BUILD` = `SW_VERSION` | kept | 2026-09-26b |
| Everything else | kept | No other file touched |
| Missing | none | |

### Regression table — R11 Step 0, handoff saved (FEATURES v12, unchanged)
| Feature | v12 → v12 | Note |
|---|---|---|
| Every `FEATURES.md` app and governance feature | kept | Docs and record only; no file under `js/`, `css/`, `index.html`, `sw.js` or `tests/` touched; no build stamp change. |
| `docs/handoff/looks-calm-pop.md`, `docs/handoff/looks-example.html` | added | Owner's files, verbatim. |
| Missing | none | |

### Regression table — R11 Stage 1, shared look values (FEATURES v12 → v13)
| Feature | v12 → v13 | Note |
|---|---|---|
| Every app feature in `FEATURES.md` and `ARCHITECTURE.md` | kept | No visible change: static EQUAL 0; computed-style comparison vs `main` at 94 points shows only random sparkles and the 2 rows below; `npm test` green |
| Kid 44px targets, 13px/15px floors, Sister Sync one line at 375px and in the fallback font, parent Day badge | kept | Smoke checks pass; `--text-scale` = 1 |
| Parent Reading size (`--fs-scale`), including its default quirk (open question 7) | kept | Untouched |
| Print sheet and print preview | kept | Own `--print-*` tokens; sizes not scaled (L12) |
| Money colours per page; Flow separate from My money | kept | Read from `--mny-*` tokens, values unchanged (L10) |
| Activity palette, recolour guard, colour maths | kept | Values unchanged, marked `look:` |
| Dark-mode banner rules, C7 contrast | kept | `--dark-*` tokens, same values |
| Build number | kept | `2026-09-27a` (`APP_BUILD` = `SW_VERSION`) |
| Shared value set, font tokens, `--text-scale`, `check-look-tokens.js` | added | |
| Two inline `Gochi Hand` fonts' offline fallback | changed | Now `cursive` via `--font-display`; identical when the web font loads |
| `--parent` | intentionally removed | Never read |
| Missing | none | |

### Regression table — R11 Stage 2, the Pop look (FEATURES v13 → v14)
| Feature | v13 → v14 | Note |
|---|---|---|
| Layout, features, data; 44px targets; 13px/15px floors at text scale 1.1 | kept | `kidScreensMeetTheHouseRules` (5 viewports) passes with no layout fixes |
| Sister Sync one line at 375px, both fonts; parent Day top bar | kept | Stop rule not triggered |
| Week strips say when to leave; stacked cards fit | kept | Now measured in the real type; pass at 1 and 1.1 and in the fallback font |
| Print sheet | kept | Own values and size; only data colours (Skating, Swimming) differ |
| Money colours per page | kept | Shadows/scrims navy; fine text gets its own readable ink; fills unchanged |
| Dark-mode contrast (C7) | kept | `theR5ScreensReadInDarkMode` passes |
| Placed blocks follow a recolour; training blocks keep their sport colour | kept | `RETIRED_SEEDED_HEXES`, new `TRAINING_DEFAULT_HEXES` |
| Pop look block, navy today markers, filled Now card, washed block rows, yellow main buttons | added | |
| `thePopLookReadsEverywhere`; palette guard over every drawn colour | added | Both failed first |
| Brighter palette; Sleep/Skating/Swimming/Custom/Appointment/Competition moves; kid strong/wash | changed | For the owner's sign-off |
| Ruled paper and page glow; opacity fades on done cards, band labels, unavailable tabs; `--cat-active/-training/-routine/-appointment`; `--mny-trend-*`; hand-measured week constants | intentionally removed | |
| Missing | none | |

### Regression table — R11 Stage 3, Calm and the switches (FEATURES v14 → v15)
| Feature | v14 → v15 | Note |
|---|---|---|
| Pop look, exactly | kept | Computed-style comparison vs Stage 2: no colour, font or border change |
| ⋯ More: 🧹 Chores, ◀ Switch, build number | kept | Third tile added |
| Parent header: scope pills, 🔒 PIN, Exit | kept | Button added; header reflows |
| 44px, 13px/15px floors; Sister Sync one line; week strips and stacked cards | kept | Now held in both looks |
| Print ignores the look | kept | Print reset after both look blocks |
| Calm look, fonts on demand, `applyLook`, kid tile, parent button, per-person storage | added | |
| `--bar-fill` | intentionally removed | Replaced by `--bar-cat` (Pop still navy) |
| `moreHasNoMoneySchool` expectation | changed | Includes the look tile (L4) |
| Calm on warm surfaces (Catch up, Sunday banner, school bar, zones) and parent chrome | missing | Stage 4 |

### Regression table — R11 Stage 4, Calm everywhere, print, one font (FEATURES v15 → v16)
| Feature | v15 → v16 | Note |
|---|---|---|
| Pop colours, borders, sizes | kept | Comparisons vs Stage 3 and 4A/4B: no colour/border/size change |
| Pop fonts | changed | Controls that drew in the system font now draw in Patrick Hand (owner request #78) |
| Parent tabs | changed | 41 → 44px (tap-target floor) |
| Money colours, activity palette, kid colours | kept | Shared; money figures/bars moved onto money tokens with the same values |
| Print | kept | Now proven identical in either look (`printIgnoresTheLook`) |
| Warnings and to-do | kept | Same colours in both looks (shared status tokens) |
| Floors, fits, Sister Sync label, Day top bar | kept | In both looks, incl. parent screens |
| Calm on warm surfaces and the parent portal; one font everywhere; five new checks | added | |
| Calm's purple to-do colour | intentionally removed | Amber in both looks (owner to confirm in PR 4) |
| Missing | none | |

### Regression table — R11 Stage 5, close-out (FEATURES v16 → v17)
| Feature | v16 → v17 | Note |
|---|---|---|
| Every app feature and both looks | kept | Docs, comments and build number only |
| `ARCHITECTURE.md` "Two looks (Pop and Calm)" section; FEATURES summary | added | |
| Stage-era wording ("Calm adds its block in Stage 3", "once looks exist") | intentionally removed | No longer true |
| Build number | changed | `2026-09-27e` |
| Missing | none | |

### Regression table — R12 Catch up this week, under Modify my plan (FEATURES v17 → v18)
| Feature | v17 → v18 | Note |
|---|---|---|
| Catch up card markup, one day open at a time, answers through the same owners, floor and settled rules, disappears when empty | kept | |
| "＋ Add to an earlier day" (C1b) | kept | Same behaviour, this week's days |
| Family meeting's 8-week catch-up list | kept | `mmUnsettledWeeks(8)` unchanged |
| Catch up reach | changed | this week only (was this week + 8) |
| Catch up place | changed | directly under ✏️ Modify my plan (was top of the day column) |
| `catchUpReachesThisWeekOnly`; catch-up step in both look walks | added | Failed first |
| `TD_CATCHUP_WEEKS`, dated "Tue 15 Sep" day names | intentionally removed | |
| Missing | none | |

### Regression table — R16 PR 0-A picture test (FEATURES unchanged version, one line added)
| Feature | Status | Note |
|---|---|---|
| Static checks (11) | kept | passing |
| Every `test:*` in CI and `npm test` | kept | 9 suites + pictures |
| SW bump only on shell changes | kept | no shell file changed |
| Smoke screenshots artifact | kept | |
| Smoke look checks | kept | now pinned to 9:30; pass at any hour |
| Picture test, `pictures` artifact | added | |
| — | missing: none | |

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
| 13 | R2 2026-09-22 | "My Money and Money school duplicate — propose a layout, or combine" | **superseded 2026-10-03 (#87)** — was: open → PR C | Decided: rebalance three pages, don't merge. Mockup v5 shows it at iPad landscape. |
| 14 | R2 2026-09-22 | "Where is the cash pool? You promised" | **superseded 2026-10-03 (#87)** — was: open → PR C | Admitted not delivered: the Flow's "left" is cash only. Pool on both My money and the story. |
| 15 | R2 2026-09-22 | Grandma rule: $3/week from a chosen start date to 30 May | **superseded by #43** | Only weeks with no record at all. Extends the existing sweep card (VE-4). |
| 16 | R2 2026-09-22 | "Different colour per revision in the plan; no `<…>` tags" | done | Fenced `diff` blocks + Rev-N labels; `<span>` does not render in this terminal. |
| 17 | R2 2026-09-22 | Today's money card: option A with changes — weekly flow, weekly target; weekly/monthly | **superseded 2026-10-03 (#87)** — was: open → PR C | No grand total, no sparkline. Pair vs toggle decided at the mockup. |
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
| 28 | R2 2026-09-22 | "The main interface should be iPad Pro 11 inch landscape" | **superseded 2026-10-03 (#87)** — was: done (mockup) → PR C | Mockup redrawn at 1194×834 in the app's own landscape columns (My money 340·1fr·348, Money school 340·1fr·320, Today 1.42:1 with money in the side column). Phone kept as a secondary row. PR C designs and checks landscape first. |
| 29 | R2 2026-09-22 | Today's money card: add the week/month toggle; default to the week every open; switch to the month once the weekly target is exceeded | **superseded 2026-10-03 (#87)** — was: open → PR C (v6) | Never stored. "Exceeded" read as reached (≥) — flagged to owner. One card shared with My money. |
| 30 | R2 2026-09-22 | Lower the unlock gates to 20 / 30 / 40% | open → PR B (v6) | One threshold table; "Building my own mix" assumed to stay 100%. The 1 Oct deposit is exactly 30% for both girls. |
| 31 | R2 2026-09-22 | Money school's middle column too tall | **superseded 2026-10-03 (#87)** — was: done (mockup) → PR C | Price list split across middle + right on iPad. |
| 32 | R2 2026-09-22 | "Anything else that will benefit us?" → S2 pot-opening moment, S3 build stamp, S4 tunable gates | S2/S3/S4 accepted → v6 | S1 withdrawn (see #33). |
| 33 | R2 2026-09-22 | "Why did you say the weekly pay is $11 again? We solved this" | done — **correction** | I restated the calibration's invented "ordinary" week as fact. Real no-meet ceiling via the calculator: $18 / $21 / $24 at 1 / 2 / 3 top-grade chores a day. `ARCHITECTURE.md`'s "$15 after the two free" corrected in the same change. |
| 34 | R2 2026-09-22 | Today's money card: the toggle must drive came in / went out / put away too, and sit on top of the card | **superseded 2026-10-03 (#87)** — was: done (mockup) → PR C | v6 C4. Figures and target always describe the same period. |
| 35 | R2 2026-09-22 | "I did not see the cash pool — where does it go? Do not mix those two" | **superseded 2026-10-03 (#87)** — was: done (mockup) → PR C | It was the untitled "This week's money" card; now "💧 My cash pool". Kept separate from the target card on My money. |
| 36 | R2 2026-09-22 | "A line chart to show her asset and debt, or other charts that make sense" | **superseded 2026-10-03 (#87)** — was: done (mockup) → PR C | v6 C6: what I have (stream balances) vs what I owe (loan by payment date), one $ axis, palette validated (CVD ΔE 16.8). C7: in vs out columns per month. |
| 37 | R2 2026-09-22 | "My money and Money school still don't work well, but I can't tell the details" | done (critique) | Core cause: doing (My money) and learning (Money school) on different pages; no "start here"; Money school a drawer of five unrelated things; the one decision a kid can make is the least visible thing; three pages, two tabs. |
| 38 | R2 2026-09-22 | Money school as a pop-up card on each My money tile? → "Yes, mock it" | done (mockup) → **superseded by #40–#42** | Proposal board `Zones.dc.html`: My money by earn · spend & save · owe; ideas as tile pop-ups (one short thought, never scrolls); ladder on the loan; what-money-buys on the goal; price list a section, not a pop-up. Revisits Rev-1's "three pages, not merged" at the owner's request. |
| 39 | R3 2026-09-22 | "The drift away from my original cash pool design — a pool; income is the inlet, the mortgage the outlet, investment a dashed loop back into the pool" | **superseded 2026-10-03 (#87)** — was: open → PR C (C1, C8) | Picture by Claude Design from my brief (owner's choice). |
| 40 | R3 2026-09-22 | "My money has too many tiles — chores, what paying it opens, saving goal as pop-ups; the core is earn, spending, invest, cash" | **superseded 2026-10-03 (#87)** — was: open → PR C (C2) | ≤ 6 cards on iPad. |
| 41 | R3 2026-09-22 | "Where is the competition calendar, gifts section?" → "both" | **superseded 2026-10-03 (#87)** — was: open → PR C (C2) | Cards AND opened from the pool's inlet. They are live in the app today (`mnyCompetitionCard`, `mnyGiftsCard`); the Zones mockup had dropped them. |
| 42 | R3 2026-09-22 | "Everything I have with the small tiles is clearer"; "end total means adding all the categories together — not my goal" | **superseded 2026-10-03 (#87)** — was: open → PR C (C1) | Four pot tiles back; NO summed total; "Where it is now" table dropped. |
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
| `routing_guard_mode: enforce` | SUPERSEDED 2026-09-26 (R8) — moved to central hz-claude-config (was NOT STARTED) | Blocked on `tests/test-routing-hook.md`, which must run in a session where the hooks are live (i.e. after merge to `main`). |

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
2. **SUPERSEDED 2026-09-26 (R8) — moved to central hz-claude-config** (`central/hooks/ROUTING-TEST.md`; `routing_guard_mode` is a central setting). Original entry kept: **`routing_guard_mode` is `observe`.** Per the bundle README, run `tests/test-routing-hook.md` to learn which hook-input fields identify a subagent before switching to `enforce`. Cannot be done from the installing session — hooks load at session start.
3. ~~**Hooks govern sessions that start after merge to `main`.**~~ Resolved: PR #91 merged; the plan gate, skill router, validation line and record guard all fired in the 2026-09-22 session.
4. **Assumption on record:** `docs/CLAUDE.review-rev1.md` in the request was read as `rev2`. If a rev1 was genuinely expected to exist, the bundle is missing it.
