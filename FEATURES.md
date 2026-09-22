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

Derived from `ARCHITECTURE.md` and checked against the code at `f4d1db5`. **This
section is authoritative for the money area**; the rest of the app still checks
against `ARCHITECTURE.md`. Items marked ⚠ are known defects scheduled in Plan v5 —
listed so a regression table can show them changing on purpose.

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
- ⚠ The first three house rules exist only in `MR_DEFAULT_RULES`, so a household with a stored rulebook does not receive them.
- The repair only ever adds, prices each week under its own rules, never touches a migration-frozen week, and is idempotent.
- The $3 default is backfill only: it never reaches the current week or the eight the catch-up list covers.

### Recording
- One Record sheet, five records, each written through its owner: chore grade `mrSetChoreGrade`, meet `mrAddCompetition`/`mrUpdateCompetition`, gift `mnyAddDeposit`/`mnyEditDeposit`, fine `mrAddFine`, move `mnyMoveMoney`/`mnyRequestMove`.
- A child records two of the five — a gift and a move — and both only as proposals; the button says "Ask a grown-up".
- A gift has a `dayKey` (when it came) and a `weekKey` (which Sunday decides it); a settled week hands the decision to the next open one. An edit moves the wallet by the difference, never reverse-and-reapply.
- A meet and its calendar block carry each other's id.
- ⚠ Record-sheet entry points: five documented; the parent Money rules head is dead.

### Moving money
- `mnyMoveMoney` is the one writer and owns no arithmetic. Pots never touch: a move between two pots goes through cash as two movements.
- Every destination is stage-gated through `mnyIsOpen`; a refusal is a sentence shown beside the control, not a bare false.
- A child proposes, a grown-up approves, and the move runs at approval against the wallet as it is then. Approving twice moves nothing; a rejection is kept.
- ⚠ `invest → ready` and `invest → locked` pass the refusal check and then fail; a child can file one that can never be approved.

### The meeting
- The meeting is a full screen (`screen-meeting`), opened and closed only through `mmIsOpen` / `mmShow` / `mmHide`, returning to where it came from.
- Three steps with ids — The week · The money · Close; `mmGoStep` translates the legacy five.
- The money step's footer is the commit, and never a Next; `mnyCommitRefusal` is the one owner of why a split cannot commit. When one child is decided, it offers the other.
- One undo snapshot per week.

### Kid money pages
- 💰 My money, 📖 My money story, 🎓 Money school, joined by the five-page bar (a child sees pages 1 and 5).
- The Flow leads My money story with a sentence — came in, went out, went to grow, left — before any bar, and never leads with a total. "Left" is a balance, not in-minus-out. Each group scales to its own largest row. Three periods, with a typical month dividing by months elapsed. Empty months are kept in the history strip.
- Every kid money screen holds the 44px target and 13px type floors.
- ⚠ The Flow's "Where it went" caption excludes pot-to-pot moves that its bars include; money taken back has no row.
- ⚠ Money school restates prices as literals, including homework as paid work.

### Parent money pages
- Money rules has six sections; steppers queue as pending edits and save as one version with a reason and an effective date.
- Loan edits never touch `paid` or `payments`; balance, pace, payoff date and the weekly amount due are derived on every render.
- The Money school ladder opens at 30 / 60 / 90% of all debt paid; a parent override can only open a stage, never close one.
- ⚠ The rules change log is rendered under Lessons; Setup → Change history lands on the week ledger; a chore-pool edit logs `[object Object]`.
- ⚠ The "? How this page works" button on Money rules is dead.

## Regression table format (paste at the end of every edit)
| Feature | v<old> → v<new> | Note |
|---|---|---|
| <feature> | kept / added / intentionally removed / missing | <why, if not kept> |
