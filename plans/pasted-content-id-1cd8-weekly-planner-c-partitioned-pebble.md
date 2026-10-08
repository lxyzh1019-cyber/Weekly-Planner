# Plan v2 — Weekly-Planner consistency pass — Approved 2026-10-07

| Summary |
|---|
| What changes for you: one header everywhere, one set of parts, one money and date style, Chores retired after your ✓, a picture test, slim records. |
| What changed from the last version and why: 🟩 Rev 2 — PR 0-pre first: since 7 Oct a money button on the Chores screen is too short on the phone and the tests fail on main; the tests also get fixed dates. |
| What I need to do: approve; 🟩 Rev 2 — merge PR 0-pre first, then every pull request; iPad read after PR 1, PR 4, PR 6 and PR 13; tick the Chores rows; approve the header pictures before PR 4. |

Changes in this version:
```diff
+ 🟩 Rev 2 — Summary, D15, The work: PR 0-pre first — money door on Chores at least 44 tall on the phone, new build number, why 7 Oct shows it, tests on four fixed dates; nothing else in it
+ 🟩 Rev 2 — Stages: 35; new stages 1 and 2 build and merge PR 0-pre; the rest shift by two; PR 0-A restarts from main after that merge
```

## Your decisions on record

- **D1** No full redesign. Fix the header, then consolidate components.
- **D2** Money format: "$3" for whole dollars, "$2.50" otherwise, everywhere. Negatives "−$3".
- **D3** Keep both the Print preview tab and the 🖨 Print button.
- **D4** Profile badge on every kid screen, money pages included.
- **D5** No emoji in screen titles. Headings may lead with one.
- **D6** Money re-check first, as one pull request.
- **D7** Chores retires after your per-row ✓.
- **D8** Track S (security) after this pass; until then no public link is shared.
- **D9** Checks at iPad 1194×834 and phone 390×844, both looks.
- **D10** Stage 0 first: PR 0-A, then PR 0-B.
- **D11** One session: this session carries Stage 0 and PRs 1–13.
- **D12** PR 4 waits for the approved Claude Design header pictures.
- **D13** Old history goes to the archive.
- **D14** Reading size default 1.2 when nothing is stored.
- 🟩 **Rev 2** — **D15** PR 0-pre is its own pull request, merged before PR 0-A, with nothing else in it.

## The work, one line per pull request

- 🟩 **Rev 2** — **PR 0-pre** Money door on Chores at least 44 tall on the phone, new build number; find why 7 Oct shows it; smoke tests on four fixed dates.
- **PR 0-A** Picture test of every screen and state; a pixel compare in code shows only what differs.
- **PR 0-B** Feature list by screen; each rule line names the money test that proves it; history to the archive.
- **PR 1** Money re-check (pocket-money note first).
- **PR 2** Chores: a) snapshot page for your per-row ✓; b) retire after the ✓.
- **PR 3** Component kit, no visible change: pixel-identical to the PR 0-A references.
- **PR 4** Headers, kid screens (badge note first).
- **PR 5** Headers, parent portal: one purple bar; Reading size default (D14).
- **PR 6** Words and numbers: one money style, one date style, one kid name.
- **PRs 7–12** Components, one surface each: Today, Week/Day, Money and Sunday, Parent, Sister Sync and Profile, sheets.
- **PR 13** Clean-up and guards; history comments to the archive.

## Your stops

- You merge every pull request.
- iPad read of the build: after PR 1, PR 4, PR 6 and PR 13.
- Approvals: Chores per-row ✓; header pictures before PR 4; every difference from an approved picture, side by side.

## ❓ Decisions

Decided: pictures compared in the browser; unread builds fold into PR 1's iPad read; Reading size 1.2.

Checked against: hotspots pocket money, profile badge, Calm meaning, Sister Sync, smoke look checks; ledger 42, 70, 113–128; open question 7.

Removes/consolidates: 9 headers → 1; 18 money formatters → 1; many part styles → one kit; 3 money lists → 1; Chores screen; 7 unused functions.

## Out of scope

Money, XP and merge rules; stored data; new features; Track S (own plan).

## Stages to finish

🟩 Rev 2 — 35 stages: 17 build steps by Claude, then 18 checks by you (merges, iPad reads, the Chores ✓, header pictures).

1. 🟩 Rev 2 — PR 0-pre tap size and fixed test dates · Claude · Build · opus-worker, Complex
2. 🟩 Rev 2 — Merge PR 0-pre · You · Check
3. PR 0-A picture test and references · Claude · Build · opus-worker, Complex
4. Merge PR 0-A · You · Check
5. PR 0-B feature list and records · Claude · Build · sonnet-worker, Routine + opus-worker, Complex
6. Merge PR 0-B · You · Check
7. PR 1 money re-check, pocket-money note first · Claude · Build · opus-worker, Complex
8. Merge PR 1, iPad read, money walk-through · You · Check
9. PR 2a Chores snapshot page · Claude · Build · sonnet-worker, Routine
10. Chores per-row ✓ · You · Check
11. PR 2b retire the Chores screen · Claude · Build · opus-worker, Complex
12. Merge PR 2 · You · Check
13. PR 3 component kit, no visible change · Claude · Build · opus-worker, Complex
14. Merge PR 3 · You · Check
15. Approve header pictures · You · Check
16. PR 4 headers, kid screens, badge note first · Claude · Build · opus-worker, Complex
17. Decide differences, merge PR 4, iPad read · You · Check
18. PR 5 headers, parent portal · Claude · Build · opus-worker, Complex
19. Decide differences, merge PR 5 · You · Check
20. PR 6 words and numbers · Claude · Build · opus-worker, Complex
21. Merge PR 6, iPad read, one Sunday per girl · You · Check
22. PR 7 Today · Claude · Build · opus-worker, Complex
23. Decide page, merge PR 7 · You · Check
24. PR 8 Week and Day · Claude · Build · opus-worker, Complex
25. Decide page, merge PR 8 · You · Check
26. PR 9 Money and Sunday · Claude · Build · opus-worker, Complex
27. Decide page, merge PR 9 · You · Check
28. PR 10 Parent portal · Claude · Build · opus-worker, Complex
29. Decide page, merge PR 10 · You · Check
30. PR 11 Sister Sync and Profile · Claude · Build · opus-worker, Complex
31. Decide page, merge PR 11 · You · Check
32. PR 12 sheets and dialogs · Claude · Build · opus-worker, Complex
33. Decide page, merge PR 12 · You · Check
34. PR 13 clean-up and guards, history to the archive · Claude · Build · opus-worker, Complex
35. Merge PR 13, iPad read · You · Check

## Technical details

### 🟩 Rev 2 — PR 0-pre — Tap size and fixed test dates (owner instructions, 2026-10-07)

- Found: CI on `main` and on `claude/consistency-0a` fails `kidScreensMeetTheHouseRules` since 7 Oct: `screen-chore@390: 1 target(s) under 44px: mv2-door ct-money-door@148x36` (156x36 in Calm). Reproduced on clean `origin/main` locally. The door is `ctMoneyDoor` (`js/13-chores.js`; drawn by the old board's `ctRenderMoneyCard` and under the kid tab in `js/26-chore-kid.js`, PR #118). `.mv2-door` is `min-height: 28px` with a 44px `::after` reach (`css/app.css`); `.ct-money-card .mv2-door` only raises the font. Explore confirms what the sweep's `kidStandards` measures (the box, or the `::after` reach) before the change is chosen.
- Change: the 💰 money door on the Chores screen (`.ct-money-card .mv2-door`) is at least 44px tall at 390×844 in Pop and Calm; the other `.mv2-door`s (money pages) are left as they are. Bump `SW_VERSION` (`sw.js`) and `APP_BUILD` (`js/01-config.js`) together; `check-sw-shell.js` passes.
- Report: which state of the Chores card the sweep opens on 7 Oct (old board week or kid tab; the week's pool state) and why that date and not the day before shows it — written in the PR and in `WORKING_RECORD.md` (request ledger).
- Smoke on fixed dates: the smoke suite runs under a fixed clock, not the runner's date. Four dates, all inside the fixture's school term: a regular weekday (proposed Thu 15 Oct 2026), a Sunday (Sun 11 Oct 2026, already the Sunday the money checks pin), the first of a month (proposed Thu 1 Oct 2026), and Wed 7 Oct 2026. How: Explore maps every place `tests/smoke.js` reads the real clock (`new Date()`, `Date.now()`, and the "this week"-relative pins such as `pinClockToWeekday`, which must derive from the fixed base, not the runner); the worker installs one base pin per run, selectable by an environment variable so one date can be run locally; CI runs the house-rules sweeps and every mapped date-sensitive check once per date. CI time is reported; if four full runs are too slow, the four dates cover the sweeps and the mapped checks only, and the PR says so.
- Nothing else in this PR. Branch from `main` (proposed `claude/consistency-0pre`). After the merge: `claude/consistency-0a` is rebased onto `main` and its CI re-run; the Chores pictures in `tests/reference/` are refreshed from CI, since the door's height shows in them.
- Done when: see the Done when table, stages 1 and 2.


### Moved from the everyday part (full wording)

- Explore runs before every Complex stage; the reviewer runs before every pull request and before done. Each branch starts from `main` after the previous merge.
- D4 detail: avatar only on money pages; the date hides at ≤699px. D12: 4 variants (standard, money, meeting, parent), both sizes, both looks; references for PR 4 and PR 5. D13 replaces PR 13's old "history into the record" item.
- Checked against, in full: pocket money 7 / 2 / 1 (PRs 1, 6, 9 and 13 count inside round 8 unless a new symptom appears); profile badge 2 / 0 / 1; Looks–Calm meaning (PR 3 tokens: one value never carries both decoration and meaning); Sister Sync invites, 6 rounds (PR 4 and PR 11 touch Sync's header and headings only, no invite logic); ledger 42 (Chores waits for the ✓), 70 (one text scale, open; overlaps PR 1), 113–126 (money decisions 1–16; decision 7 "rest of app later" is this pass); no history for the component kit.
- Removes/consolidates, in full: 9 header patterns → 1 header, 4 variants; 18 money formatters → 1; 4 kid-name helpers → 1; 72 button classes → 4; 51 chip classes → 2; 11 tab systems → 1; 25 card classes → 1 card + 1 section head; 13 sheet styles → 1 sheet + 1 dialog; 3 hand-kept money lists → 1 marker; 3 hard-coded back routes → 1 return stack; the Chores screen; 7 unused functions; the Sunday branch of the money week; 8 old documents and the history comments → archive.
- Out of scope, in full: new features except PR 1's money fixes as in the brief; typed-in hex colours (burned down only where a PR 7–12 surface already touches them); inline click handlers and the action systems; sub-13px fonts outside the surfaces touched (the PR 13 guard covers new ones). Track S after PR 13 as its own plan.

### Sources and where they are saved

- Authoritative: `app-consistency-plan-v2-source.md` (D1–D13, Stage 0, PRs 1–13, stops, content ledger). Detail: `app-consistency-plan-v1.md` (PR detail), `money-recheck-brief-rev1.md` (PR 1), `header-system-plan.md` (PR 3–5), `consistency-pass-plan.md` (findings, PR 6–13). All five are in `D:\User\Heng Z\Downloads\wp-consistency\wp-consistency\`.
- PR 0-A: `sonnet-worker` copies the five files into `docs/handoff/consistency/`. The approved plan file (`plans/pasted-content-id-1cd8-weekly-planner-c-partitioned-pebble.md`) is committed with PR 0-A.
- The original money brief dated 2026-10-06 (fixes 1–6 with their "Done when" lines) is not in the folder; PR 1's check list below is the v1 list plus the brief's first revision. If the owner has the original, it joins `docs/handoff/consistency/` in PR 0-A.
- Ledger rows at approval: 🟩 Rev 2 — `Weekly-Planner consistency pass · Stage <k> of 35 — <stage>`.

### Governance, every pull request

1. Read `CLAUDE.md` and `ARCHITECTURE.md`; report the rules version and the branch. Plan mode. The main session edits only `WORKING_RECORD.md`, `FEATURES.md` and `plans/`; every other file (source, tests, `docs/`, `.github/`, file moves) goes through `opus-worker` or `sonnet-worker` (routing below). The main session commits and pushes the branch.
2. `npm test` passes all 9 suites before any push: `npm run check` (11 static checks: syntax, globals, shared-merge, escaping, look-tokens, money-words, dead-css, dead-ids, dead-actions, ci-scripts, sw-shell), `test:merge`, `test:buffers`, `test:stream`, `test:cleanup`, `test:xp`, `test:money`, `test:sunday`, `test:smoke`. CI green.
3. Bump `SW_VERSION` (`sw.js`) and `APP_BUILD` (`js/01-config.js`) together in every PR that changes a shell file (🟩 Rev 2 — PR 0-pre, then PR 1 onwards). PR 0-A and PR 0-B change no app file, so no bump (`tests/check-sw-shell.js` enforces the bump only on shell changes). PR 3 adds `js/47-header.js` to the `SHELL` list in `sw.js` (`check-sw-shell.js`).
4. Regression table against `FEATURES.md`; `WORKING_RECORD.md` updated (request ledger, hotspot counter, deliverable ledger) in the same turn.
5. Screens: iPad 1194×834 and phone 390×844, Pop and Calm. Smoke screenshots go to `tests/out/` (CI artifact) and are linked in the PR. Picture-test references live in `tests/reference/`.
6. No stacked branches: each branch starts from `main` after the previous merge (`git merge-base` confirmed), so `check-sw-shell.js` compares against the right base. 🟩 Rev 2 — `claude/consistency-0a` already exists; it is rebased onto `main` after PR 0-pre merges, not restarted. Pull requests open last and ready for review, after the reviewer; never as drafts.
7. References never go stale: every PR that changes the look updates `tests/reference/` on its own branch; the difference page is the approval (picture pairs numbered like `❓ Decisions`).
8. Session: one session carries all 🟩 Rev 2 — 35 stages. From 1.5 M tokens the remaining stages go to fresh workers and the main session reads only short reports; after each merge `## Where we are` and the restart line are pushed.

### Routing

| Stage | Helper | Level | Why |
|---|---|---|---|
| 🟩 Rev 2 — PR 0-pre | opus-worker | Complex | Shell CSS and the build bump (`css/app.css`, `sw.js`, `js/01-config.js`), the fixed clock in `tests/smoke.js`, possibly `.github/workflows/ci.yml` (four dates); the 7 Oct cause needs the sweep read |
| PR 0-A | opus-worker | Complex | New test harness (`tests/pictures.js`), fixture data and fixed clock, `package.json` script, `.github/workflows/ci.yml` step; `sonnet-worker` (Routine) copies the five source files |
| PR 0-B | sonnet-worker (parallel workers for the audit) + opus-worker | Routine + Complex | Sonnet: coverage list, by-screen proofs, `git mv` moves, record slimming edits outside the two record files. Opus: `ARCHITECTURE.md` `checked by <script>` / `text only` marks (needs each script read). Main session: `WORKING_RECORD.md` and `FEATURES.md` edits |
| PR 1 | opus-worker | Complex | Money |
| PR 2a | sonnet-worker | Routine | One-off output: a run of the picture test into `tests/out/` plus the comparison page; no references, no new script, no `package.json` or `ci.yml` change |
| PR 2b | opus-worker | Complex | Refactoring: remove a screen, port 21 smoke checks |
| PR 3 | opus-worker | Complex | Design: component kit, tokens, header builder, new classic script, `sw.js` SHELL |
| PR 4 | opus-worker | Complex | Refactoring, profile-badge hotspot, one navigation stack |
| PR 5 | opus-worker | Complex | Parent portal, money-critical actions, Reading-size setting |
| PR 6 | opus-worker | Complex | Money formatting across 18 formatters, deletions |
| PR 7–12 | opus-worker | Complex | Refactoring, one surface each (PR 9 is money) |
| PR 13 | opus-worker | Complex | Deletions, live money-week code, guards in `npm run check`, `package.json` |

- Before every Complex stage, `Explore` (reads only) returns the `Map:` of files and lines; the hand-over carries it.
- `reviewer` runs before every pull request and before done (`Reviewer before done (Weekly-Planner consistency pass): <verdict>` in `## Where we are`); on any `Stuck:`.
- `sonnet-worker` gets two tries, then `opus-worker` with `Escalated from sonnet-worker: <reason>`. It never touches `sw.js`, `package.json`, `.github/`, Firebase or schema files.
- Worker instructions: `~/.cache/hz-rules/<version>/agents/opus-worker-instructions.md` and `sonnet-worker-instructions.md` (session start names the version; 3.1.32 today).

### The three decisions (decided 2026-10-06), detail

1. **Picture compare.** `playwright-core` cannot read PNGs. Decided (owner, 2026-10-06): compare inside the browser with a canvas — the test loads the reference PNG and the fresh screenshot into two `<canvas>` elements in the test page and diffs pixel data; no new dependency. Not chosen: `pngjs` + `pixelmatch`.
2. **Money fit and logic, Stage 13.** The record's Stage 13 (`WAITING ON YOU — merge PR #119, read Build 2026-10-06e on the iPad, walk Today → My money → Sunday → Grown-ups → back as kid and parent in both looks`) is half done: `#119` merged to `main` as `8ef4eeb`; the read and the walk have not been reported. `consistency-pass-plan.md` §4b says no stage starts until the owner reads the current build; the owner's §4 lists reads only after PR 1, 4, 6, 13. Decided (owner, 2026-10-06): mark Stage 13 SUPERSEDED by this plan's 🟩 Rev 2 — Stage 8 (PR 1's iPad read plus that walk).
3. **D14 Reading size.** Open question 7 in the record: the parent Reading size default is 1 vs 1.2 when nothing is stored. Decided (owner, 2026-10-06): 1.2 (D14), built in PR 5. It visibly changes parent text size on every parent screen on a device with nothing stored.

### Hotspot notes (recorded before the first edit)

- **Pocket money — round 8 (before PR 1).** Counter: 7 → 8 fix rounds; recurrences 2, regressions 1 unchanged. One pass = one round: PRs 6, 9 and 13 also touch pocket-money display and count inside round 8 unless a new symptom appears (then a new row entry). Expected verdict: repair, because the cause is duplicated logic (three places divide by steady, three hand-kept root lists), not the model. Structural part: `sdCommitPlan` as the one source of the commitment share and its `over` threshold; one `data-money-surface` attribute instead of lists. The "rewrite-vs-repair reviewed?" cell gets `yes <date>` with the note.
- **Profile badge — round 3 (before PR 4).** Counter: 2 → 3 fix rounds; regressions 1 unchanged. Shared cause across rounds 1–3: the badge is placed by hand in each top bar. Expected verdict: repair with structure — the badge becomes one slot of `pageHeader`, always far right, `profileBadgeText` stays the one text source; the Day-bar special sizing (`.profile-badge--parent`) retires when Day uses the same header. Cell updated the same way.

### PR detail

**PR 0-A — Picture test and references (no app change).**
- `tests/pictures.js` (playwright-core 1.62.1, already a dev dependency) opens every screen **and state** for Jenn, Jess and Parent where it differs by user, at 1194×834 and 390×844, in Pop and Calm, with fixed fixture data and a fixed clock. The list is built from the PR 1–12 surfaces: the 13 screens, every tab (Week view tabs, money tabs My money · Money school, All my Sundays, By month, parent tabs), the overlays `#sundayOverlay`, `#grownupsOverlay`, `#requestOverlay`, `#pnToldOverlay`, the Parent › Now cards, each meeting step, and every sheet and dialog. Pictures: `tests/reference/<screen-or-state>-<user>-<ipad|phone>-<pop|calm>.png`.
- Stability: references are made and compared only on the CI Linux runner with the pinned browser; the test waits for `document.fonts.ready`; animations and transitions off (`prefers-reduced-motion` plus a test stylesheet). A local run reports but does not gate.
- Pixel compare in code with a small tolerance (decision 1: canvas in the browser); prints only the pictures that differ. `package.json` gets `test:pictures`, wired into `npm test`; `.github/workflows/ci.yml` gets its step in the smoke job (the job with the browser) — `tests/check-ci-scripts.js` requires a step per `test:*` script.
- `sonnet-worker` copies the five source files into `docs/handoff/consistency/`; the approved plan file is committed with this PR.
- 🟩 Rev 2 — Already built on `claude/consistency-0a` (picture test, 360 CI references, a differing picture re-shot up to twice in a new context because Linux emoji scaling varies per run); its CI fails only on the house-rules check PR 0-pre fixes. After PR 0-pre merges: rebase onto `main`, refresh the Chores references from CI, re-run.

**PR 0-B — Feature list by screen and slim records.**
- Central conversion instructions (session start names the path): coverage list first in `docs/archive/features-coverage.txt`; `FEATURES.md` by screen with `<!-- feature-list: by-screen -->` and a proof per line.
- `## References`: `Sizes:` and `Looks:` lines (D9); figures = each girl's Sunday totals, steady money, commitment %, loan and pocket balances for the fixture week; rule document = `AllowanceRulesJennJess-v2.md` (each rule line names the money test that proves it; a line without a test is listed to the owner).
- Move to `docs/archive/` (`git mv` by `sonnet-worker`, not delete): the narrative build history in `FEATURES.md` and `ARCHITECTURE.md`, and the old top-level files `AUDIT.md`, `AUDIT-PRODUCT.md`, `AUDIT-SYNC.md`, `PLAN.md`, `PLAN-PHASE2.md`, `REVIEW.md`, `MODULARIZATION_PLAN.md`, `MULTI_ROLE_REVIEW.md`. Keep `SECURITY_TODO.md` (Track S needs it). The setup notes in `FEATURES.md` become one line pointing to hz-claude-config.
- Slim `WORKING_RECORD.md` (main session) **keeps**: the request ledger, the deliverable ledger, the hotspot table with its comparisons, Open questions / blockers, Where we are. Only narrative history moves (the dated Approved-baseline story, Pending, old regression tables and checks, the PR #92 record section) to `docs/archive/working-record-history.md`.
- `opus-worker` marks each `ARCHITECTURE.md` rule `checked by <script>` or `text only`.
- The first record edit also corrects `## Where we are`: PR 5 of Money fit and logic (#119) merged to `main` as `8ef4eeb`; Stage 13 per decision 2.

**PR 1 — Money re-check** (`money-recheck-brief-rev1.md` in full: fixes 1–6 plus first-revision items 0, 1, 2, 3, 5, 7).
- Commitment % from `sdCommitPlan` in all three places: `46-grownups.js:537`, `44-sunday.js:1301` (`pct`, the "New row on my wall" pop-up) and `:1323` (the "one more club session → %" idea); no division by steady without the $5 floor. `44-sunday.js:1306` and `:1310` hard-code `> 50`: they read `sdCommitPlan`'s `over` instead. `:1307` "Left for me to choose" never negative — with `lowSteady`, the form's wording instead of a figure.
- `data-money-surface` on every money root (My money, Money school, All my Sundays, By month, Sunday steps, Grown-ups, Parent › Now money cards, request/told/Sunday overlays). The three CSS lists — `css/app.css` 8389 (`--text-scale: 1`), 8398 (`--font-round`) and 9557 (`.mv2-school`, `.mv2-hist`, `.mv2-flow` → `--text-scale: 1`) — become one `[data-money-surface]` selector each; the lists are deleted. Ledger row 70 (L7, one text scale) is checked against this.
- Font smoke check finds screens by `[data-money-surface]`, Parent › Now included. The %-check fails on any division by steady outside `js/43`.
- Search box: `.gu-search-label` is already screen-reader-only; the clipped text is the placeholder "Find a price or rule…" (`46-grownups.js:990`). Fix: placeholder "Find…" at ≤699px, or let the input take the column width.
- "This month" is the calendar month; empty state when nothing has landed.
- The two ✍️ Record doors get the same hint line. Fix 6 confirmed as written (`42-flow.js:132`).
- Stale comment `15-meeting.js:1008` ("Sun–Sat from 11 Oct 2026") corrected to decision 15; the mapping code stays until PR 13.
- Updates `tests/reference/` for the money surfaces; the difference page shows each change.

**PR 2 — Chores screen** (C3, ledger row 42).
- a) One-off: a run of the picture test writes `#screen-chore` for Jenn, Jess and Parent at both sizes in both looks into `tests/out/`, plus each row of `docs/chore-relocation-map.md` shown at its new home, on one comparison page linked in the reply (not an open PR — pull requests open last). No references, no new script. Stop for the per-row ✓.
- b) After the ✓: remove `#screen-chore`, `openChoreTab`, `#choreProfileBadge`, the 🧹 More tile and its refresh hooks; Chore leaves `TD_NAV_SCREENS`; port the 21 smoke checks to the new homes; `check-dead-css.js` and `check-dead-actions.js` stay green; the Chore references leave `tests/reference/`. Then PR 2 opens.

**PR 3 — Component kit (no visible change).**
- `js/05-helpers.js`: `fmtMoney(v, {signed})` (D2), `fmtDay(key, 'short'|'long'|'weekday')`, `kidLabel` as the one name source. Unit tests: negative, whole, cents, rounding.
- CSS tokens for both looks: `--radius-sm/md/lg/pill`, `--shadow-sm/md/lg`, `--z-base/header/nav/sheet/dialog/toast`, `--hdr-*` (`--hdr-h` 64px iPad / 56px phone; sub-bar 48px; `--hdr-title-size`). Breakpoints: ≤699, 700–1099, ≥1100. `check-look-tokens.js` stays green; every new token has a value in both looks; a token carries decoration or meaning, never both (Looks–Calm hotspot).
- Classes: `.ui-btn` (primary, secondary, icon, danger; `lg` for the money 54/66px), `.ui-chip`, `.ui-tabs`, `.ui-card`, `.ui-sect-head`, `.ui-sheet`, `.ui-kids`, `.ui-stepper`.
- `js/47-header.js` (classic script, declares only, loaded before `99-main.js` per the load-order rule; added to the `sw.js` `SHELL` list): `pageHeader({variant, back, title, context, actions, badge, sub})` returning `.ph-*` markup; variants `standard` (64/56px), `money` (72px, 54px buttons, one row), `meeting` (two rows, 106px, no bottom bar), `parent` (standard height, purple). Unit and smoke tests render each slot combination. Nothing calls it yet.
- Proof: the picture test reports 0 differences against the PR 0-A references as updated by PR 1 and PR 2.

**PR 4 — Headers, kid screens.** Today, Week, Day, Sister Sync, My money, Money school, All my Sundays, By month, the meeting, Print.
- Replace `.topbar`, `.week-topbar`, `.day-topbar`, `mnyPageHead` and `.mm-head--two` with `pageHeader`; delete the replaced CSS (`check-dead-css.js`). Slots: `[◀ back?] [Title] [context] [actions ≤2] [profile badge]`; sub-bar for tabs, stepper, kid switch. Sticky, `--paper`, one 2.5px solid rule, no dashed rule, no extra shadow.
- Badge always far right, avatar only on money pages, the date hidden at ≤699px (D4). Titles without emoji (D5). Day gets a visible title; delete the hidden `.mm-title`.
- Back rule: no ◀ on Today, Week, Sister Sync (remove Sister Sync's `goWeek` back — header only, no invite logic). Elsewhere ◀ goes through one `navReturn` stack (generalised from `mnySchoolReturn`; `backtoday` retired); aria-label "Back to <screen>".
- Phone rule: every header is two rows at most, or one row of icons only. Keep the sub-bar off Day unless its span tabs move into it.
- Every difference from the approved header picture goes on one comparison page, picture pairs numbered like `❓ Decisions`; `tests/reference/` updated on the branch.
- Monthly: handled in PR 5 with its purple strip; if Explore shows a kid-reached Monthly view, it takes the `standard` variant in PR 4.

**PR 5 — Headers, parent portal.**
- `.parent-bar` becomes `pageHeader` (parent variant, `--accent-purple`). `.parent-banner` is removed on Week, Day and Monthly; "Viewing Jenn", Back, Confirm all and Mark reviewed move into the sub-bar. Run the `FEATURES.md` regression rows for Confirm all and Mark reviewed explicitly (money-critical).
- D14: Reading size (`--fs-scale`) default 1.2 when nothing is stored (decision 3).
- `.cp-head`, `.ctr-head` and `.gu-head` lose the card-as-header styling (title slot or sub-bar). Delete the replaced CSS.
- `check-dead-actions.js` cannot see generated `data-*` actions: re-check every header action by hand. References updated; difference page.

**PR 6 — Words and numbers.**
- Replace the 18 money formatters (`mnyMoney`, `rqDollars`, `guMoney$`, `ckMoney`, `sdWhole$`, `sdD`, `sdMoney`, …) with `fmtMoney`; fix `mnyMoney(-3)` = "$-3.00". Replace `mnyDayLabel`, `mnyDayName`, `guDayName` with `fmtDay`; `mnyKidName`, `pcwKidName`, `cfKidName` with `kidLabel`. Delete the old functions.
- Extend `check-money-words.js` to fail on a new local money or date formatter.
- Frozen weeks render from stored numbers; only the display changes (`sunday.test.js`, `money.test.js`). References updated; difference page.

**PRs 7–12 — Components, one surface per PR.** Each PR: move the surface to `.ui-*`, delete its private button, tab, card and sheet classes (`check-dead-css.js`), move its inline `style=` into CSS, drop emoji-titled headings (D5), burn down typed-in hex colours only inside that surface, run that surface's `FEATURES.md` rows, update `tests/reference/`, before/after page in both looks.
- PR 7 Today · PR 8 Week/Day (`.week-nav`, `.day-nav-center` → `.ui-stepper`) · PR 9 Money and Sunday (`mny-*`, `sd-*`, `rq-sheet`, `pn-told-sheet`; the 54/66px `lg` size) · PR 10 Parent portal (`parent-tab`, `cp-*`, `ctr-*`, `gu-*`, `parent-scope` → `.ui-kids`) · PR 11 Sister Sync and Profile (inline-styled headings `index.html:576-590` → `.ui-sect-head`, headings only, no invite logic; the manifesto `index.html:96-105` → a "How this planner works" sheet) · PR 12 sheets and dialogs (`.sheet`, `.gu-sheet`, `.sd-sheet`, `.td-more-sheet`, `.app-dialog-sheet`, `.quest-popup`, … → `.ui-sheet` + one dialog; the 27 overlays).

**PR 13 — Clean-up and guards.**
- Delete the 7 unused functions after a re-grep including string-dispatched calls: `setParentKid`, `mmRenderQuarterly`, `loanPayExtraPrompt`, `mnyWithdrawRequest`, `mrCompetitionBlock`, `moneyCanTransact`, `mnyConfirmStamp`.
- Money week, decision 15: `18-rules.js:117-122` and `1274-1400` hold the **live** `mrMoneyDays`, `mrMoneyWeekLabel` and `mrMoneyWeekOf`, used elsewhere. Remove only the Sunday–Saturday branch and its tests; Monday–Sunday results unchanged; prove no stored rulebook can switch the Sunday branch on (test with a stored rulebook fixture); Explore map first; `money.test.js` and `sunday.test.js` otherwise unchanged.
- Timer audit: every `setInterval` in `js/08`, `js/09` and `js/44` is cleared on screen change or close.
- D13: old history (comments, plans, audits, hand-overs) moves to `docs/archive/`, never into `WORKING_RECORD.md`. The "gone / retired / long gone / kept for" source comments go to `docs/archive/history-comments.md`.
- Guards in `npm run check` (`tests/check-headers.js` and extensions), each with an allowlist and a reason per entry; fail on: more than one `.ph` header per `.screen`, a header button under 44px or without an accessible name, header text under 15px; a new `*-btn`, `*-tab`, `*-card` or `*-sheet` class outside `.ui-*`; a font size with no floor or no `--text-scale` (new ones; existing sub-13px fonts outside the touched surfaces are allowlisted with reasons); a z-index or breakpoint outside the tokens; a hand-kept screen list in CSS (selectors with 4 or more ids or roots).
- `FEATURES.md`: Page header, Component kit, Money format sections.

**Track S (after PR 13, D8).** `SECURITY_TODO.md` runbook steps 1–7: backup, read the live rules, Firebase Auth, move the doc, point the client, publish the rules, delete the old doc. Own plan and PRs; opus-worker only.

### Done when, per stage

🟩 Rev 2 — rows 1 and 2 are new; every later row keeps its wording and moves down by two.

| Stage | Done when |
|---|---|
| 🟩 Rev 2 — 1 PR 0-pre | At 390×844 in Pop and Calm the Chores door measures at least 44px tall; `kidScreensMeetTheHouseRules` and `parentScreensMeetTheHouseRules` pass on all four fixed dates; `npm test` passes; `check-sw-shell.js` passes with the bump; CI green on the branch; the 7 Oct cause written in the PR and the record; the diff holds nothing beyond the door, the bump and the smoke clock; reviewer ran; PR ready. |
| 🟩 Rev 2 — 2 | PR 0-pre merged to `main`. |
| 3 PR 0-A | On CI: two runs in a row give 0 differences; a planted 1-pixel change is caught; `check-ci-scripts.js` passes with the new step; `npm test` passes; sources and plan file committed; reviewer ran; PR ready. 🟩 Rev 2 — The branch sits on `main` after PR 0-pre (merge-base confirmed) and the Chores references are refreshed from CI. |
| 4 | PR 0-A merged to `main` (merge-base confirmed). |
| 5 PR 0-B | Every coverage phrase is found or marked "removed — owner OK"; the three record files keep only the current state (the five kept record sections intact); rule lines without a test listed; every `ARCHITECTURE.md` rule marked; `npm test` passes. |
| 6 | PR 0-B merged. |
| 7 PR 1 | Hotspot note recorded first; every "Done when" in the brief passes; reverting fix 1 or 2 makes `npm run check` fail; the three lists are gone; `npm test` passes; references updated; difference page; build bumped. |
| 8 | PR 1 merged; the owner reports the build number read on Today → ⋯ More on the iPad and the money walk-through (closes Money fit and logic Stage 13 per decision 2). |
| 9 PR 2a | The page shows the Chores screen (3 users × 2 sizes × 2 looks) and every relocation-map row at its new home; linked in the reply; no repo change beyond `tests/out/`. |
| 10 | The owner's ✓ on every row (or a Fix row per missing one). |
| 11 PR 2b | Every relocation-map row has a passing check at its new home; nothing links to the old screen; dead-css and dead-actions green; `npm test` passes. |
| 12 | PR 2 merged. |
| 13 PR 3 | `npm test` passes, new unit tests included; `check-sw-shell.js` passes with the new script; the picture test reports 0 differences against the current references. |
| 14 | PR 3 merged. |
| 15 | The approved header pictures (4 variants × 2 sizes × 2 looks) are in `docs/handoff/consistency/headers/`. |
| 16 PR 4 | Badge note recorded first; every kid screen has exactly one header; same height per variant at both sizes in both looks; "Sister Sync" fits on one line at 375px; 44px and 13/15px floors hold; comparison page with every difference from the approved pictures; references updated; `npm test` passes. |
| 17 | Differences decided; PR 4 merged; build read on the iPad in both looks. |
| 18 PR 5 | One purple bar on every parent screen; Confirm all and Mark reviewed regression rows pass; Reading size scales the header and defaults per decision 3; comparison page; `npm test` passes. |
| 19 | Differences decided; PR 5 merged. |
| 20 PR 6 | One Sunday per girl shows the same totals as before, in the new format; `sunday.test.js` and `money.test.js` pass; `check-money-words.js` fails on a planted local formatter; old functions gone; references updated. |
| 21 | PR 6 merged; build read on the iPad; one Sunday per girl walked. |
| 22, 24, 26, 28, 30, 32 PR 7–12 | The surface's old classes are gone (`check-dead-css.js`); floors hold; that surface's `FEATURES.md` rows pass; before/after page in both looks; references updated; `npm test` passes. |
| 23, 25, 27, 29, 31, 33 | Page decided; that PR merged. |
| 34 PR 13 | Each guard fails on a planted example; the 7 functions and the Sunday branch gone with money and Sunday tests otherwise unchanged; timers audited; history in `docs/archive/`; `FEATURES.md` sections added; `npm test` passes; `Reviewer before done` written. |
| 35 | PR 13 merged; build read on the iPad; the plan closes. |

### Risks

- PRs 7–12 touch every screen: one surface per PR, that surface's regression rows each time.
- Two looks double the visual checks; the guards cover tokens, layout still needs the iPad.
- The picture test on a local machine differs from CI (fonts, browser build); only CI gates.
- PR 6's display change shows on signed Sundays; stored numbers do not change.
- Retiring Chores removes a door the girls may use; the per-row ✓ is the gate.
- Calm's wider fonts: titles and sub-bar tabs at 375px in both looks.
- A sticky two-row header costs height on the Day timeline.
- PR 13's money-week code is live: the Sunday branch only, proven by tests.
- Any money branch opened during this plan starts from `main` after the latest merge.
- 🟩 Rev 2 — Fixed smoke dates: a calendar-dependent failure shows only when one of the four dates triggers it (7 Oct is in the set because it did); four dates may lengthen the smoke job, so CI time is reported.

### Content ledger check

| # | Phrase | Section where it appears |
|---|---|---|
| 1 | No full redesign | Your decisions (D1) |
| 2 | "$3" for whole dollars | Your decisions (D2) |
| 3 | Print preview tab and the 🖨 Print button | Your decisions (D3) |
| 4 | Profile badge on every kid screen | Your decisions (D4) |
| 5 | No emoji in screen titles | Your decisions (D5) |
| 6 | Money re-check first | Your decisions (D6) |
| 7 | per-row ✓ | Your decisions (D7); The work (PR 2); Your stops |
| 8 | Track S | Your decisions (D8); Out of scope; Technical details |
| 9 | iPad 1194×834 and phone 390×844 | Your decisions (D9); Governance 5 |
| 10 | PR 0-A | Your decisions (D10); The work; 🟩 Rev 2 — Stages 3 |
| 11 | this session carries Stage 0 and PRs 1–13 | Your decisions (D11) |
| 12 | approved Claude Design header pictures | Your decisions (D12) |
| 13 | never into `WORKING_RECORD.md` | Technical details › PR 13 (D13) |
| 14 | pixel compare in code | The work (PR 0-A); Technical details › PR 0-A |
| 15 | names the money test that proves it | The work (PR 0-B); Technical details › PR 0-B |
| 16 | Keep `SECURITY_TODO.md` | Technical details › PR 0-B |
| 17 | pixel-identical to the PR 0-A references | The work (PR 3) |
| 18 | after PR 1, PR 4, PR 6 and PR 13 | Summary; Your stops |
| 19 | no public link is shared | Your decisions (D8) |
