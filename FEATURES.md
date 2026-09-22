# FEATURES — Weekly-Planner — manifest v2 — confirmed 2026-09-22

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

### Week screen — the school-day offer (manifested 2026-09-22)
- School days are **offered, never assumed**, and the question is whether the school **card** is missing, not whether the day is empty — `schoolDaysToOffer` (`js/07-week-view.js`).
- The offer is limited to `SCHOOL_FILL_HORIZON_WEEKS` (3) weeks ahead — `schoolOfferInHorizon`.
- **It appears in ONE place, above the grid** — `#weekSchoolBannerTop`, a sibling of `#weekFull` directly under `#weekCoachTip`. A to-do below a ~691px grid is a to-do nobody sees. `renderSchoolDayBanner(bannerId = 'weekSchoolBannerTop')` draws it, called once from `renderFullWeek`; the `bannerId` parameter stays so the host is swappable, but only one host exists.
- `#weekSchoolBanner` (the old below-grid host, inside `.weekly-full-wrap`) is **absent from `index.html`**, not merely undrawn — an id nothing reads fails `tests/check-dead-ids.js`, and a host left in place is a host somebody reinstates.
- `setWeekView('preview')` hides `#weekSchoolBannerTop` explicitly, because it sits outside `#weekFull` and the renderer runs only from `renderFullWeek`.
- The banner names the count, draws a `.wsb-day` chip per offered day, and draws the bulk `Add all N` **only when more than one day is offered**.
- **One writer**: `commitSchoolDays(dayKeys, p)` owns the confirm copy (its `okLabel` is `Add it` for one day, `Add them` for more), the block shape (travel + get-ready on, not completed, not confirmed), the single `saveAll()` and the toast. `addSchoolDaysToWeek(mondayKey)` and `addSchoolDayToDay(dayKey)` are its two doors, and **both filter through `schoolDaysToOffer` first** so a stale chip cannot write a duplicate School Day.
- The blank-week coach tip (`weekEmptyOffer`) carries **no** school button — the banner covers the blank week from the same position.
- Held by `theSchoolOfferIsAboveTheWeekGrid`, `oneSchoolDayCanBeAddedOnItsOwn` and `aBlankWeekOffersItsSchoolDays` in `tests/smoke.js`.

Deriving the full app manifest from `ARCHITECTURE.md` is an open item in `WORKING_RECORD.md`.

## Regression table format (paste at the end of every edit)
| Feature | v<old> → v<new> | Note |
|---|---|---|
| <feature> | kept / added / intentionally removed / missing | <why, if not kept> |
