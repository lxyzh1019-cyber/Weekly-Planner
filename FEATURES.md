# FEATURES — Weekly-Planner — manifest v5 — 2026-09-23 (v2 confirmed 2026-09-22)

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
- **Smoke subset for iteration (added 2026-09-22):** `SMOKE_ONLY=checkA,checkB npm run test:smoke` runs only the named checks. Every check statement in `tests/smoke.js` carries an `if (want('name'))` prefix naming its own check; `noConsoleErrors` is the one unguarded check and always runs. The check names are read from the file itself, not a hand list. A subset **is never the gate**: an unknown name exits 1 naming it; a named check that records nothing is a failure; the last line is `PARTIAL RUN (SMOKE_ONLY): N of M checks — not a pass of the suite` and never `ALL SMOKE CHECKS PASSED`; it refuses to run when `CI` is set. With `SMOKE_ONLY` unset or empty the suite runs every check, pass rule `v !== true`, final line unchanged. Documented in `ARCHITECTURE.md` (Verification) and `tests/README.md`.
- **Dead-action guard (added 2026-09-23):** `tests/check-dead-actions.js`, in `npm run check` (the ninth check) and listed in `ARCHITECTURE.md` (Verification) and `tests/README.md`. Fails on (1) an `onclick` in `index.html` or a `js/` template calling a function not declared at top level in `js/` (method calls and browser globals excluded; a runtime callee `${fn}(…)` is counted, not checked), and (2) a `data-P-action="V"` not handled by prefix P's own dispatcher — the selector `[data-P-action="V"]`, or V compared/keyed inside a top-level function reading `dataset.<p>Action` / `'data-P-action'` or one it hands the action variable to. A prefix nothing reads fails, naming every value. Runtime-built values are resolved from literals in the `${…}` or at the drawing function's call sites; the rest are counted. The reverse (a compared value no markup emits) **warns** and does not fail. `EXEMPT` names `pm/edit` (unreachable branch in `pmPriceCards`; removal belongs to `HANDOFF-pocket-money.md` §2) and **self-expires**: when nothing emits the value, the check fails until the entry is deleted.

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

### The build number is on the page (manifested 2026-09-23)
- `const BUILD` in `js/01-config.js` is the page's copy of `SW_VERSION` (`sw.js`). **One number with a check:** `tests/check-sw-shell.js` fails `npm run check` when `BUILD !== SW_VERSION` (or `BUILD` is missing), naming both values and saying to set them equal. Bump both together.
- Printed as `Build <BUILD>` (class `.app-build`, `escapeHtml`, 13px floor, not a control) in **two** places: under the tiles of the Today More sheet (`tdOpenMore`, `js/31-today.js`) — **bottom nav → More** — and under the list on the parent portal's App landing only (`parentRenderLanding('app')`, `js/11-parent.js`) — **Parent → PIN → ⚙️ App**. Setup's landing does not carry it.
- Because `js/01-config.js` is a cached shell file, the number shown is what that device loaded, offline copy included.
- Held by `theBuildNumberIsOnThePage` in `tests/smoke.js` (both surfaces show `BUILD`, `BUILD` non-empty, the More line ≥13px, Setup does not show it).

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

### The profile badge switches profile (manifested 2026-09-22)
- **All five** profile badges are real controls: `#todayProfileBadge`, `#weekProfileBadge`, `#dayProfileBadge`, `#choreProfileBadge`, `#syncProfileBadge` are each `<button class="profile-badge" onclick="openProfileSwitcher()" aria-label="Switch profile">`. Three of them (Today, chores, Sister Sync) were inert `<div>`s.
- `openProfileSwitcher` (`js/06-quests.js`) is the one switcher; every badge is a call site for it.
- Every badge **prints who is on screen**, a parent included. Today's says `👨‍👩‍👧‍👦 Parent (Jenn|Jess)` for a grown-up, the same shape the chore tab uses.
- **Nothing is announced as a control that is not one.** `enhanceAccessibility` (`js/99-main.js`) injects `aria-label` only on a `.profile-badge` that is a `<button>`/`<a>`, carries `[onclick]`, or has `role="button"` — matching how `enhanceNonButtonClickables` beside it already filtered.
- **The meeting lock is scoped and releasable.** `applyMeetingLock` (`js/11-parent.js`) hides only `MEETING_LOCK_BADGES` (`weekProfileBadge`, `dayProfileBadge`) plus `#parentWeekActions .pb-switch`, never every `.profile-badge` in the document; `locked` is `isParent() && mmHasReturn()`; and `renderWeek`/`openDay` call it **outside** their `isParent()` branches so a child's own render puts the control back.
- Held by `everyProfileBadgeSwitchesProfile` in `tests/smoke.js` — it activates each badge and asserts the switcher opens, and asserts the lock both engages for a parent mid-meeting and lifts for a child.

### A sister can be invited to watch (manifested 2026-09-22)
- A **`watching: true`** flag on the block is what makes it a watch block, on any competition block, not only a scored meet. `blockIsWatching(b)` (`js/08-day-view.js`) is the one owner of the question.
- **`blockIsCompetition(b)` returns `false` when the block is watching.** This is the single seam all five competition surfaces funnel through, and the narrowing is deliberate and load-bearing — do not simplify it away. It is what guarantees, structurally: never listed by `mmPlannedCompetitions`, never chased by `mmUnrecordedCompetitions`, never adopted by `mrPlaceCompetitionBlock`'s orphan branch, never given a `compId`, and so **no competition score, no competition money, no money-tab link**.
- `blockDisplayName` reads `act.isCompetition` directly, so it keeps working and prints **`👀 Watching — <meet>`**, falling back to what the block is when no `compName` was typed.
- `renderTrainingChecks` and `renderTrainingGearChecklist` render nothing for a watch block; `renderBlockPixel`'s `isTrainingBlock` excludes it, so no on-block checks or chip; the edit sheet hides the warm-up toggle and the gear list.
- **Buffers: travel kept, warm-up dropped.** She goes to the rink; she is not competing.
- `sendInvite(block, to, opts)` takes an options argument; `opts.watch` puts `watch`, `compName` and `tag` on the invite. The two-argument call sites (Sister Sync's tap, the edit sheet's 💌) send a plain invite. The sender is `activeProfile()`, so an invite from the parent portal is recorded as the child's.
- `acceptInvite` writes `watching`, `compName`, `tag`, the travel buffer and the note **only** on the watch branch; the plain invite path is unchanged.
- **👀 Invite my sister to watch** (`#watchSisterBtn`) sits outside `#sisterSyncWrap` so it is available to kid **and** parent, and shows only when `blockIsCompetition(block)`. The confirm dialog names the meet. While a watch invite is live it reads `👀 <sister> is invited to watch` and is disabled (see the next section).
- A watch block **still counts as ordinary planned time** in `computeWeekTotals` — a Saturday spent at the rink is not free time.
- Held by `aWatchedMeetIsNeverChasedForAResult` and `aWatchInviteNamesTheMeet` in `tests/smoke.js`.

### An invite has one writer and cannot be sent or accepted twice (manifested 2026-09-23)
- **One writer.** `sendInvite(block, to, opts)` (`js/10-social.js`) is the only code that creates an invite. `inviteSisterFromEdit` and `inviteSisterToWatch` (`js/17-ui-misc.js`) are doors onto it — find the block, resolve `activeProfile()` and the sister, call `sendInvite`; the Sister Sync tap calls it directly. The edit sheet's former inline copy (its own invite object, confirm and stamp) is gone.
- From the edit sheet, `sendInvite` dates the invite from `currentDayKey` (the day being edited) and stamps `invitedTo` on `activeProfile()`'s own block — a parent-portal send is recorded as the child's and stamps the child's block.
- **`sisterInviteFor(blockId, to, kind)`** is the one owner of "is there already one of these": the **live** invite (`pending` or `accepted`) with that `sourceBlockId` and `to`, of that kind (`'watch'` when `inv.watch`, else `'share'`), or `null`.
- **`sendInvite` refuses a live duplicate of the same kind before the confirm dialog**, with a toast naming the state: pending — `<Sister> already has this invite — she hasn't answered yet` (watch: `<Sister> is already invited to watch — she hasn't answered yet`); accepted — `It's already on <Sister>'s plan` (watch: `<Sister> already said yes to watching — it's on her plan`). A **declined** invite may be sent again. A share and a watch of the same block are different kinds and both allowed.
- Since the edit-sheet door now goes through `sendInvite`, a share of an activity the sister does not have is refused up front (`<Sister> cannot receive this activity yet.`) rather than sent and auto-declined on accept.
- **`acceptInvite` and `declineInvite` act only on `status === 'pending'`**; anything else returns quietly and redraws the invite list (`refreshInvitesUI`), so a double-tap on ✅ Accept cannot put a second block on her day and declining an accepted invite changes nothing.
- **Each edit-sheet button reads its own kind through `sisterInviteFor`.** Share: `💌 Invite <sister>` → `💌 Invite sent to <sister>` (disabled) while live. Watch: `👀 Invite <sister> to watch` → `👀 <sister> is invited to watch` (disabled) while live. A watch invite never marks the share button sent, nor the reverse.
- `invitedTo` on the source block has one job: the 💌 badge on the inviter's own timeline (`js/08-day-view.js`). It is not asked whether an invite was sent.
- **`#inviteSisterBtn` sits outside `#sisterSyncWrap`** (like `#watchSisterBtn`), so a kid can share from the block, not only from the Sister Sync screen. It shows for kid and parent on any non-watching block and is **hidden on a watching block** (`blockIsWatching`) — sharing somebody else's meet as a plain invite would clone her competition block onto the competitor's calendar.
- **`#publicToggle` stays parent-only** — `#sisterSyncWrap` now holds only it.
- Held by `anInviteCannotBeSentTwice` in `tests/smoke.js`.

Deriving the full app manifest from `ARCHITECTURE.md` is an open item in `WORKING_RECORD.md`.

## Regression table format (paste at the end of every edit)
| Feature | v<old> → v<new> | Note |
|---|---|---|
| <feature> | kept / added / intentionally removed / missing | <why, if not kept> |
