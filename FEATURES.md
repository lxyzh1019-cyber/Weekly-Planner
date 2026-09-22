# FEATURES — Weekly-Planner — manifest v1 — confirmed 2026-09-21

Locked features of the current version. Every edit is checked against this list and ends with a regression table. Update this file in the same change that alters a feature. Over-list rather than under-list.

**Scope note (manifest v1).** This manifest currently covers the **governance and
tooling surface** installed by working-rules bundle v2.1. The **app's own**
feature manifest is not yet derived — see "App features" below. Until it is, a
regression table for an app change must be checked against `ARCHITECTURE.md`
directly, not against this file.

## Governance — files of record
- `CLAUDE.md` at the repo root holds the global working rules, version-stamped in its header; a session reports that version at start.
- `ARCHITECTURE.md` at the repo root holds this repo's own operating rules; `CLAUDE.md` points to it in its second section.
- Every `see CLAUDE.md` comment in `js/` and `tests/` refers to `ARCHITECTURE.md`; both files state this, so the reference resolves in one hop.
- `WORKING_RECORD.md` is the single request ledger, hotspot counter and deliverable ledger, updated every implementation turn.
- `FEATURES.md` (this file) is the manifest every regression table is checked against.
- Governance paths are exempt from the routing guard: `CLAUDE.md`, `ARCHITECTURE.md`, `WORKING_RECORD.md`, `FEATURES.md`, `.claude/`, `docs/`, `plans/` — set in `.claude/hooks/config.json`, which overrides the bundle default list.

## Governance — Native enforcement (Claude Code features)
- `model: fable` in `.claude/settings.json`; `opus` in `.claude/agents/opus-worker.md`.
- `permissions.defaultMode: plan` — no edits until a plan is approved.
- `permissions.ask` prompts on: `git commit`, `git push`, `git merge`, `gh pr merge`, `firebase deploy`, `npm run deploy`.
- `permissions.deny` blocks: `git reset --hard`, `git checkout --`, `git restore`, `git clean`, `git branch -D`, `git push --force`, `git push -f`, `git stash drop`.

## Governance — Hook enforcement (deterministic, `.claude/hooks/`)
- **plan-gate** (UserPromptSubmit) — injects the plan tier: full `Plan vN` at >2 bullets, micro-plan at 1–2, silent on chat.
- **skill-router** (UserPromptSubmit) — injects skill invocations for keywords in `skill-router.json`.
- **routing-guard** (PreToolUse on Edit/Write/MultiEdit/NotebookEdit) — logs every edit; in `enforce` mode denies non-governance edits not made by the executor subagent. **Currently `observe`.**
- **record-guard** (Stop) — blocks a turn that changed non-governance files without updating `WORKING_RECORD.md` and producing a regression table. Governance-only edits are exempt.
- **validation-line** (Stop) — blocks a final answer missing `Confidence: … · Status: …`.
- `.claude/state/` holds per-session hook logs and is gitignored; `.claude/` itself is tracked.

## Governance — Skill
- `.claude/skills/hz-guarantee-audit/` — grades an existing artifact (Guaranteed / Checked / Assumed / Broken) before answering a narrow question about it. Also uploadable to claude.ai → Settings → Capabilities → Skills.

## Governance — Verification
- `bash tests/replay-hooks.sh` replays synthetic inputs through every hook. **Expected: `passed=14 failed=0`.** It restores `routing_guard_mode` to `observe` and clears `.claude/state/*.jsonl` on exit.
- `tests/test-routing-hook.md` is the cloud procedure for learning which hook-input fields mark a subagent — run before switching `routing_guard_mode` to `enforce`.
- `docs/HZ-skill-trigger-tuning.md` is the skill-trigger tuning procedure.

## App features — not yet manifested
Authority for app behaviour remains `ARCHITECTURE.md`. Its load-bearing rules,
named here so a regression table has something to point at, **without** claiming
to be a complete manifest:
- Classic scripts, no build step, no ES modules; `js/01-*.js` … `js/99-main.js` share one global scope.
- Load-order rule: files `01`–`36` declare only; all top-level executable code is in `js/99-main.js`.
- One declaration per name globally, enforced by `tests/check-globals.js`.
- `js/04-merge.js` is frozen; changes need a demonstrated sync bug and a failing test written first.
- Every `state.shared` key needs a merge decision, enforced by `tests/check-shared-merge.js`.
- Three escaping helpers chosen by context, enforced by `tests/check-escaping.js`.
- Verification gate before any push: `npm run check`, `npm run test:merge`, `npm run test:xp`, `npm run test:money`, `npm run test:smoke`.
- `SW_VERSION` must be bumped on any deploy changing a shell file, enforced by `tests/check-sw-shell.js`.

Deriving the full app manifest from `ARCHITECTURE.md` is an open item in `WORKING_RECORD.md`.

## App — Pocket money (manifested 2026-09-22)

Derived from `ARCHITECTURE.md` and checked against the code at `f4d1db5`;
updated for Plan v5 PR A and Plan v6 PR B (2026-09-22). **This section is authoritative for the
money area**; the rest of the app still checks against `ARCHITECTURE.md`. Items
marked ⚠ are known defects still open — listed so a regression table can show
them changing on purpose.

### The stream and balances
- Money is stored as movements in `profile.events`; balances are derived from them. `evShadowDrift` reports any pot where derived and stored disagree, on the parent page.
- Every wallet writer mirrors into the stream. A caller may **label** a movement and never **redirect** one: structural fields are applied after `opts`.
- A correction is a reversing event, never an edit. `profile.events` merges by id with its own `ev:` tombstone scope.
- The migration is read-only until run, idempotent by derived id, and re-prices nothing.
- ⚠ No screen reads a derived balance yet; every "Everything I have" still reads the stored wallet.

### Rules
- Rules are effective-dated versions; `mrVersionForDate` resolves the version live on a date, so a lived week keeps the rules it was lived under.
- `mrApplyEdits` is the only versioned writer. Each change logs a line per field with a reason.
- Settled weeks are frozen in `moneyLedger` and never recomputed.
- `mrStartWeek()` is derived from the earliest week on file and never written by being read.
- Four house rules (2026-09-21): homework earns XP, not dollars; tone, borrowing, screens and asked-twice are free the first two times a week; one grace day a week on the streak; the year's pace divides by weeks elapsed.
- A household with a stored rulebook gets the house rules through a parent-only card on Money rules: `mrHouseRulesPending` lists only the missing fields, resolved by item id against today's rules; one tap applies them through `mrApplyEdits` from this week's Monday; the family's chore pool, prices, caps and targets are untouched; nothing lived is re-priced. The card never returns once applied (a log marker, `MR_HOUSE_RULES_NOTE`), even after a deliberate revert, and a second device finds nothing to do.
- The year's-pace denominator is asserted directly (weeks elapsed, not weeks settled).
- The rules change log stores readable values: `mrLogSummary` describes a list of records by id ("Added 🧦 Match the socks"); the history passes older stored arrays through the same summariser.
- The repair only ever adds, prices each week under its own rules, never touches a migration-frozen week, and is idempotent.
- The $3 default is backfill only: it never reaches the current week or the eight the catch-up list covers.
- 👵 The Grandma rule is the same engine (`mnyDefaultSweepPlan` / `mnyRunDefaultSweep` with `reason: 'grandma'`): a parent's from-date (default `mrStartWeek()`), to-date (default the most recent 30 May) and amount (default $3), held in a module draft and never stored. It credits only weeks with **no record at all** for that child (`mnyWeekHasAnyRecord`, one owner, **money records only** per the owner's definition — settled weeks, graded chores, meets, gifts, fines, the money stream — listed in `MNY_WEEK_RECORD_STORES`; planner blocks, routine ticks, XP, notes, reflections, goals, plans, closed/met/reviewed marks, the Sunday Box and move requests are deliberately not records), previews weeks, per-child totals and how many were skipped, confirms through the app dialog, never reaches the current week, a later one or the catch-up eight whatever is typed, and credits once. Rows carry `defaulted` + `defaultReason`; Week history and her money story say "Grandma rule". Its own Money rules section and Setup row; it left Week history.
- The hub catch-up banner's default sweep runs through the same engine, unchanged.

### Recording
- One Record sheet, five records, each written through its owner: chore grade `mrSetChoreGrade`, meet `mrAddCompetition`/`mrUpdateCompetition`, gift `mnyAddDeposit`/`mnyEditDeposit`, fine `mrAddFine`, move `mnyMoveMoney`/`mnyRequestMove`.
- A child records two of the five — a gift and a move — and both only as proposals; the button says "Ask a grown-up".
- A gift has a `dayKey` (when it came) and a `weekKey` (which Sunday decides it); a settled week hands the decision to the next open one. An edit moves the wallet by the difference, never reverse-and-reapply.
- A meet and its calendar block carry each other's id.
- Record-sheet entry points, all live — parent Now, the parent Money rules head, meeting step 3, the kid's gift and competition cards, the wallet card's move door.
- `MNY_CLICK_HOSTS` is the one list of containers `mnyHandleClick` is bound to; every rendered `data-mny-action` sits under one of them.
- A refused move says why on the Record sheet's save button before the tap; the destination defaults to the first open pot other than the source.
- Typing never re-renders the Record sheet: typing an amount updates only the save button in place (`rcSyncSave`, from the same `rcSaveState` `rcRender` uses), so the input keeps its focus.

### Moving money
- `mnyMoveMoney` is the one writer and owns no arithmetic. Pots never touch: a move between two pots goes through cash as two movements.
- Every destination is stage-gated through `mnyIsOpen`; a refusal is a sentence shown beside the control, not a bare false.
- A child proposes, a grown-up approves, and the move runs at approval against the wallet as it is then. Approving twice moves nothing; a rejection is kept.
- One route decision, `mnyMoveRoute`, read by both `mnyMoveRefusal` and `mnyMoveMoney`: every ordered pair of homes either moves or is refused with a sentence. `invest → ready|locked` go through cash and move only what the sale raised.
- No loan is 100% paid: every pot is open to a child who owes nothing, and nothing tells her she paid a loan off.

### The meeting
- The meeting is a full screen (`screen-meeting`), opened and closed only through `mmIsOpen` / `mmShow` / `mmHide`, returning to where it came from.
- Three steps with ids — The week · The money · Close; `mmGoStep` translates the legacy five.
- The money step's footer is the commit, and never a Next; `mnyCommitRefusal` is the one owner of why a split cannot commit. When one child is decided, it offers the other.
- One undo snapshot per week.

### Kid money pages
- 💰 My money, 📖 My money story, 🎓 Money school, joined by the five-page bar (a child sees pages 1 and 5).
- The Flow leads My money story with a sentence — came in, went out, went to grow, left — before any bar, and never leads with a total. "Left" is a balance, not in-minus-out. Each group scales to its own largest row. Three periods, with a typical month dividing by months elapsed. Empty months are kept in the history strip.
- The Flow draws three groups — came in, went out (spent, fine, loan, given back, and anything else that left), put away to grow — and each caption equals the sum of its bars. `savedTotal` comes from `evFlowOf`; the Flow sums nothing.
- Kid rule copy is generated from the live rules: the fines card (free repeats, "every time" for the box repeat) and the streak card (grace day); with those rules at 0 the old words return.
- Money school shows the live price list (`pmPriceCards`) in the same closed-by-default disclosure and remembered toggle as My money; "Just part of being here" stays, its free-chores line read from `chores.freeChoresPerWeek`.
- `pmPriceCards` is read-only; its unhandled edit mode is gone.
- Every kid money screen holds the 44px target and 13px type floors.
- 🔓 When her stage rises, My money (her own view only) shows one card naming the pots that opened and each new idea's what / why / what-to-watch from `MNY_CONCEPTS`; "Got it" records the stage in `localStorage` per child, per device (try/catch, never synced). First sight records silently; a grown-up viewing sees nothing.
- 🌟 "Skating star level" is how every money surface names the `dance` sport — price editor, kid price list, meeting form, Record sheet, recorded meets. Sport id, rule key and scorer unchanged.

### Parent money pages
- Money rules has eight sections, 🕰️ Change history and 👵 Grandma rule among them; steppers queue as pending edits and save as one version with a reason and an effective date.
- Setup › 🕰️ Change history opens the Change history section (the rules log), the one section that draws it; 📖 Week history keeps the week ledger; Lessons and Loans no longer carry the log.
- Loan edits never touch `paid` or `payments`; balance, pace, payoff date and the weekly amount due are derived on every render.
- The Money school ladder opens at **20 / 30 / 40 / 100%** of all debt paid (ready · locked · stock · mix), from ONE table: `MNY_STAGES` has ids, pots / plans / lessons name a stage, and `mnyStagePct` reads `school.stagePct` with per-key defaults (no migration). A parent override can only open a stage, never close one.
- Money rules › Lessons has three gate steppers (ready / locked / stock) that save as a dated rule version; a save that breaks ready ≤ locked ≤ stock ≤ 100 is refused with a sentence in the handler.
- 🎿 Parent Now shows a loan-season row 1 Aug – 30 Sep unless a debt was created on or after 1 Jul that year; derived from the date, nothing stored, routes to Money rules › Loans.
- The parent portal's App landing shows "Build <APP_BUILD>"; `tests/check-sw-shell.js` fails when `APP_BUILD` ≠ `SW_VERSION`.
- The "? How this page works" button on Money rules opens the parent tour.
- A permanent click sweep (`everyMoneyControlClicksClean`) presses every money control on every money surface and fails on any exception.

## Regression table format (paste at the end of every edit)
| Feature | v<old> → v<new> | Note |
|---|---|---|
| <feature> | kept / added / intentionally removed / missing | <why, if not kept> |
