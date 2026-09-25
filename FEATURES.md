# FEATURES — Weekly-Planner — manifest v8 — 2026-09-24 (v2 confirmed 2026-09-22)

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
- **Dead-action guard (added 2026-09-23):** `tests/check-dead-actions.js`, in `npm run check` (the ninth check) and listed in `ARCHITECTURE.md` (Verification) and `tests/README.md`. Fails on (1) an `onclick` in `index.html` or a `js/` template calling a function not declared at top level in `js/` (method calls and browser globals excluded; a runtime callee `${fn}(…)` is counted, not checked), and (2) a `data-P-action="V"` not handled by prefix P's own dispatcher — the selector `[data-P-action="V"]`, or V compared/keyed inside a top-level function reading `dataset.<p>Action` / `'data-P-action'` or one it hands the action variable to. A prefix nothing reads fails, naming every value. Runtime-built values are resolved from literals in the `${…}` or at the drawing function's call sites; the rest are counted. The reverse (a compared value no markup emits) **warns** and does not fail. `EXEMPT` is **empty** since the 2026-09-23 merge of `main`: its one entry, `pm/edit` (unreachable branch in `pmPriceCards`), self-expired when PR #92 removed that edit mode, and was deleted as designed. The mechanism stays: an entry **self-expires** — when nothing emits the value, the check fails until the entry is deleted.

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
- `const APP_BUILD` in `js/01-config.js` is the page's copy of `SW_VERSION` (`sw.js`). **One number with a check:** `tests/check-sw-shell.js` fails `npm run check` when `APP_BUILD !== SW_VERSION` (or `APP_BUILD` is missing), naming both values and saying to set them equal. Bump both together.
- Printed as `Build <APP_BUILD>` (class `.app-build`, `escapeHtml`, 13px floor, not a control) in **two** places: under the tiles of the Today More sheet (`tdOpenMore`, `js/31-today.js`) — **bottom nav → More** — and under the list on the parent portal's App landing only (`parentRenderLanding('app')`, `js/11-parent.js`) — **Parent → PIN → ⚙️ App**. Setup's landing does not carry it.
- Because `js/01-config.js` is a cached shell file, the number shown is what that device loaded, offline copy included.
- Held by `theBuildNumberIsOnThePage` in `tests/smoke.js` (both surfaces show `APP_BUILD`, `APP_BUILD` non-empty, the More line ≥13px, Setup does not show it, `APP_BUILD` matches `YYYY-MM-DD[a-z]`, Setup keeps its 👵 Grandma rule row). It absorbed PR #92's `theAppLandingShowsTheBuild`, which no longer exists.
- **Consolidated 2026-09-23 (build 2026-09-23b)** when `main` (PR #92) was merged in: PR #92 had built a parallel stamp (`APP_BUILD`, App landing only). Now one constant `APP_BUILD`, one class `.app-build`, one `check-sw-shell.js` section, one smoke check, same two screens. `BUILD` no longer exists.

### The kid nav has five places; More holds only what has no other home (manifested 2026-09-24, manifest v8)
- **One nav, five places:** `TD_NAV` (`js/31-today.js`) is **Today · Week · Money · Sister Sync · More**, in that order: one fixed element (`#kidNav`) outside the screens, drawn by `tdRenderNav`. **No second nav row** on any screen (`ARCHITECTURE.md` › Navigation).
- **👯 Sister Sync is a tab** (the owner's decision, 2026-09-24): `data-td-nav="sync"` → `openSisterSync()`, screen `screen-sync`, marked `aria-current="page"` (and `.on`) while Sister Sync is showing. Label **"Sister Sync"**: it fits on one line at 375px with the app's font (Patrick Hand), ≥44px target, 13px floor. The fallback label, if it ever stops fitting, is "Sisters".
- The kid nav shows only on a child's screens (`TD_NAV_SCREENS`) and **never for a parent**; `openSisterSync` still refuses a parent. Parent: no change.
- **One destination, one door.** The ⋯ More sheet (`tdOpenMore`) holds exactly **🧹 Chores · ◀ Switch**, then the build number (see next section). The 👯 Sisters, 📖 Money story and 🎓 Money school tiles and their `tdGoMore` branches (`'sisters'`, `'story'`, `'school'`) are gone. `check-dead-actions` cannot see `data-td-more`, so a tile and its branch are added or removed together, by hand.
- Money school is still reached from money tab 5 (`data-mny-tab="school"`) and My money's 🎓 button; Money story from My money's 📖 button in `mnyLinksCard` (`data-mny-action="story"`).
- Held by `sisterSyncIsABottomTab`, `moreHasNoMoneySchool`, `kidNavIsUsableAndScoped` (5 tabs) and `navReachesEverythingAndOldRoutesStillWork` (the sync tab lands on `screen-sync`) in `tests/smoke.js`.

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
- **Buffers: travel kept, warm-up dropped.** She goes to the rink; she is not competing. Since stage 5b (2026-09-24) the travel is the **meet's own legs** plus its get-ready, carried by the invite (see "An invite carries the sender's travel and get-ready" below); an invite sent before then still gives the fixed `DEFAULT_BUFFER_MIN` (15) each way.
- `sendInvite(block, to, day, opts)` takes an options argument; `opts.watch` puts `watch`, `compName` and `tag` on the invite. The call sites that pass no `opts` (Sister Sync's tap, the edit sheet's 💌) send a plain invite. The sender is `activeProfile()`, so an invite from the parent portal is recorded as the child's.
- The accept writer (`inviteToBlock`) writes `watching`, `compName`, `tag`, the watch note and `warmupBuffer: false` **only** for a watch invite. The plain path is no longer untouched — on purpose (stage 5b): both kinds get their buffers from the invite's snapshot.
- **👀 Invite my sister to watch** (`#watchSisterBtn`) sits outside `#sisterSyncWrap` so it is available to kid **and** parent, and shows only when `blockIsCompetition(block)`. The confirm dialog names the meet. While a watch invite is live it reads `👀 <sister> is invited to watch` and is disabled (see the next section).
- A watch block **still counts as ordinary planned time** in `computeWeekTotals` — a Saturday spent at the rink is not free time.
- Held by `aWatchedMeetIsNeverChasedForAResult` and `aWatchInviteNamesTheMeet` in `tests/smoke.js`.

### An invite has one writer and cannot be sent or accepted twice (manifested 2026-09-23)
- **One writer.** `sendInvite(block, to, day, opts)` (`js/10-social.js`) is the only code that creates an invite. `inviteSisterFromEdit` and `inviteSisterToWatch` (`js/17-ui-misc.js`) are doors onto it — find the block, resolve `activeProfile()` and the sister, call `sendInvite`; the Sister Sync tap calls it directly. The edit sheet's former inline copy (its own invite object, confirm and stamp) is gone.
- **The invite's day comes from the caller** (manifest v7, request #34): Sister Sync passes the day it is showing; the edit sheet passes `currentDayKey` (the day it found the block on). `sendInvite` refuses without a `YYYY-MM-DD` day — toast `Could not tell which day this is — nothing was sent.` — and never reads `currentDayKey` or `syncDayIdx` itself. Held by `anInviteFromSisterSyncIsDatedThatDay`.
- `sendInvite` stamps `invitedTo` on `activeProfile()`'s own block — a parent-portal send is recorded as the child's and stamps the child's block.
- **`sisterInviteFor(block, to, kind, dayKey)`** is the one owner of "is there already one of these": the **live** invite (`pending` or `accepted`) for that block and `to`, of that kind (`'watch'` when `inv.watch`, else `'share'`), or `null`. *For the block* = sent from it (`sourceBlockId`), a series invite whose `blockIds` include it, or listed in the block's `sentInviteIds` (stage 5c); one covering `dayKey` is preferred, and one that does not is **moved** (`inviteCoversDay`).
- **`sendInvite` refuses a live duplicate of the same kind before the confirm dialog**, with a toast naming the state: pending — `<Sister> already has this invite — she hasn't answered yet` (watch: `<Sister> is already invited to watch — she hasn't answered yet`); accepted — `It's already on <Sister>'s plan` (watch: `<Sister> already said yes to watching — it's on her plan`). A **declined** invite may be sent again. A share and a watch of the same block are different kinds and both allowed.
- Since the edit-sheet door now goes through `sendInvite`, a share of an activity the sister does not have is refused up front (`<Sister> cannot receive this activity yet.`) rather than sent and auto-declined on accept.
- **`declineInvite` acts only on `status === 'pending'`, and `acceptInvite` only on an invite `inviteAcceptable` allows (pending and not missed)**; anything else returns quietly and redraws the invite list (`refreshInvitesUI`), so a double-tap on ✅ Accept cannot put a second block on her day and declining an accepted invite changes nothing.
- **Each edit-sheet button reads its own kind through `sisterInviteFor`.** Share: `💌 Invite <sister>` → `💌 Invite sent to <sister>` (disabled) while live. Watch: `👀 Invite <sister> to watch` → `👀 <sister> is invited to watch` (disabled) while live. A watch invite never marks the share button sent, nor the reverse.
- `invitedTo` on the source block has one job: the 💌 badge on the inviter's own timeline (`js/08-day-view.js`). It is not asked whether an invite was sent.
- **`#inviteSisterBtn` sits outside `#sisterSyncWrap`** (like `#watchSisterBtn`), so a kid can share from the block, not only from the Sister Sync screen. It shows for kid and parent on any non-watching block and is **hidden on a watching block** (`blockIsWatching`) — sharing somebody else's meet as a plain invite would clone her competition block onto the competitor's calendar.
- **`#publicToggle` stays parent-only** — `#sisterSyncWrap` now holds only it.
- Held by `anInviteCannotBeSentTwice` in `tests/smoke.js`.

### Today signposts a waiting invite (manifested 2026-09-23)
- **One inbox.** Sister Sync's 💌 list (`renderInvites`) is where an invite is answered; Today only says one is waiting and takes her there. The Day view's pending ghost is the **second accept door**, on the same owners (next section).
- **Shared filter and wording.** `invitesWaitingFor(p)` (invites to `p` that `inviteAcceptable` allows — pending and **not missed**, so the note never points at a day already gone) and `inviteFacts(inv)` (`from`, `subject`, `day`, `time` — plain text; a watch invite's subject is the meet, `compName` → activity name → `her competition`; a share's is `<icon> <name>`, else `an activity`) in `js/10-social.js`. Both `renderInvites` and Today's note call them. The inbox's visible wording is unchanged.
- **`tdInviteNote`** (`js/31-today.js`) — **kid only** (`isParent()` → nothing: the inbox works on `profile` and `openSisterSync` refuses a parent). With nothing pending, no row at all.
- One line: one share `💌 <Sister> invited you to <icon> <activity> · <Day> <time>`; one watch `💌 <Sister> invited you to watch <meet> · <Day>`; several `💌 N invites waiting — from <Sister>` (both names joined with "and" if ever two senders). Every value goes through `escapeHtml`.
- A real control: a `<button class="td-row" data-td-action="invites">` (existing Today row styling, ≥44px), in the day column **between the hero and "Coming up"**, so she meets it before her day's list.
- Tap → `tdOpenInvites`: `openSisterSync()` then scrolls `#invitesSection` (the invites heading + list, `index.html`) to just under the sticky topbar.
- It disappears on the next Today render once nothing is pending — the nav's Today tab (`goToday`) and a remote snapshot (`refreshCurrentScreen`) both re-render. No polling.
- Held by `anInviteWaitingShowsOnToday` in `tests/smoke.js` (run at 390×844).

### An invite carries the sender's travel and get-ready; a missed invite is not waiting (manifested 2026-09-24, stage 5b)
- **`inviteSnapshot(block, dayKey, members)`** (`js/10-social.js`) is the one owner of **what an invite carries**: `actId`, `day`, `startMin`, `durationMin`, `sourceBlockId`, `travel {to, toMin, home, homeMin}`, `ready {before, beforeMin, after, afterMin}`. Buffers are read **only** through `getTravelBufMin` / `getGetReadyBufMin` per side. Both objects are always written (zeros included). **Warm-up is never carried.** `sendInvite` builds every invite from it.
- **The confirm says what she gets**: `Share 📖 Reading on Tue at 4:00pm with Jess? She gets the same 🚗 20m there · 25m home and 👕 15m to get ready.` (unpack after: `🧺 Nm to unpack`); a watch confirm carries the same sentence before its "earns nothing" line. No buffers → no sentence. Plain text, escaped by the dialog.
- **`inviteToBlock(inv, dayKeys)`** is the one owner of **what accepting writes**, for every accept door: one block on each of `dayKeys` for `profile` with one `saveAll`, buffers written the way the edit sheet writes them (master switch + both legs, clamped). Share: the sender's drive, get-ready and unpack. Watch: the meet's own travel and get-ready, warm-up off.
- **An invite with no snapshot** (sent before 5b) is placed exactly as before: a share with no buffers; a watch block with `DEFAULT_BUFFER_MIN` each way. No migration.
- **`inviteIsMissed(inv)`**: its day — for a series, the last of `series.dayKeys` — is before `todayKey()`. Derived from the date: no status value, no new `state.shared` key, `js/04-merge.js` untouched. **`inviteAcceptable(inv)`**: pending and not missed; both accept doors call it.
- **The inbox's Missed group** (`invitesMissedFor(p)`), under the waiting invites: `💌 <Sister> invited you to <subject> · <Day> — that day has passed`, buttons **📌 Add it to my <Day> anyway** and **❌ Decline**, no Accept. A missed invite whose (last) day is before this week's Monday drops out of the list and **stays stored** (invites are never deleted).
- **📌 Add it anyway** (`addInviteAnyway`): the same writer onto that past day; the block arrives **not ticked** (no XP, no completion from placing it); the invite becomes `accepted`, so the sender's 💌 reads "on her plan". Only a pending, missed invite — a second tap adds nothing. `acceptInvite` and `addInviteAnyway` share `placeInvite` (activity check → status → `inviteToBlock`).
- **The Day view's pending ghost** (`renderPendingInvitesOnTimeline`, `js/08-day-view.js`) is the second accept door: ✅ Accept / ❌ Ignore only when `inviteAcceptable`; on a day already gone **📌 Add it anyway** / **❌ Decline**. Its buttons call `acceptInvite` / `addInviteAnyway` / `declineInvite`, so it writes the identical block the inbox writes.
- Held by `anInviteCarriesTheSendersTravelAndGetReady` (share 20/25 + ready 15 identical on hers; watch from a 30/30 meet → 30/30, no warm-up; old invites unchanged; field-by-field comparison of source vs accepted block, including snapshot equality), `aMissedInviteIsNotWaiting` and `theDayViewAcceptFollowsTheSameRules` in `tests/smoke.js`. Invite checks pin the clock to a weekday of this week (`pinClockToWeekday`), because "missed" depends on the date — the four older invite checks were pinned to Monday for that reason and assert nothing new.
- ⚠ Known, not changed here: an empty day's canvas is drawn 6am–2pm (`dayDrawnSpanMin` counts blocks, not pending invites), so an afternoon invite's ghost on an otherwise empty day is not drawn until the evening is opened. The inbox still shows it. (Also true of each covered day of a series invite.)

### A repeating block asks "this day, or all?"; a moved shared block says "Send again?" (manifested 2026-09-24, stage 5c)
- **Sending from a block with a `seriesId`** (a share; a watch invite is always one day) asks through `showChoice`: **Just Tue 29 Sep** or **Every Tuesday to 15 Dec (12)** (every-N: `Every 2 weeks on Tuesday …`; several weekdays joined with "and"). The count is the sender's real copies from that day on (`inviteSeriesMembers`, ≤ `SERIES_MAX_BLOCKS`), less any already live with her. With one copy left there is no choice, only the ordinary confirm.
- **"All" is ONE invite**: `inviteSnapshot(block, day, members)` adds `series {days, every, end, dayKeys[], blockIds[]}`; time and buffers are the tapped block's for every day. `sendInvite` stamps `invitedTo` on every covered block.
- **Duplicate guard covers series**: a single covered day, or a second "all", is refused before any dialog (`sisterInviteFor` matches `series.blockIds`).
- **Accepting all gives her her own series**: a fresh `seriesId` (never the sender's — the sender's "remove all" `sr:` tombstone leaves hers), the same `seriesDays`, `seriesEvery` and `seriesEnd`, buffers per 5b, one `saveAll`. Her edit sheet counts it as a series.
- **Only the days from today on**: when some covered days have gone, accepting asks **From 6 Oct (11)** or **Include the 1 that passed (12)** (both doors; the Day view awaits it). A series is missed only after its last day; 📌 Add it anyway on a missed series places all its days, unticked. The inbox's missed series row reads `… · every Tue (2) — those days have passed` with **📌 Add them to my plan anyway**.
- **Where she sees it**: the pending ghost on each covered day (`inviteCoversDay`); Today's note and the inbox read `📖 Reading · every Tue (12)` (`inviteFacts` → `inviteSeriesShort`; every-N adds `, every 2 weeks`).
- **Badge leak closed**: `weekCloneBlock`, `createSeriesFromBlock` and `seriesExtendTo` strip `invitedTo` and `sentInviteIds` — the 💌 shows only on blocks really shared.
- **A cross-day drag of a shared block** (`moveBlockToDay`, `js/39-block-drag.js`) keeps the 💌 and writes `sentInviteIds` (`inviteIdsForBlock`: the live invites it was sent under). The edit sheet's share/watch button and Sister Sync then read `💌 Sent for Tue — you moved it to Thu · Send again?` (`inviteMovedWords`; 👀 for watch) and stay live; sending again writes one invite for the new day, after which a second send is refused. The sister's old invite is not changed. A same-day drag keeps the id and changes nothing. The dead `block.inviteId && !block.inviteAccepted` guard in `attachBlockDrag` is left alone.
- Held by `aSeriesInviteCoversEveryDayOrOne`, `aMovedSharedBlockSaysSendAgain` and the series-late cases of `aMissedInviteIsNotWaiting` in `tests/smoke.js`.

### Sister Sync shows a timeline (manifested 2026-09-24, stage 5e)
- **One side-by-side timeline for the chosen day** (`renderSync`, `js/10-social.js`): **🐥 Jenn | 🦊 Jess**, `START_HOUR`–`END_HOUR` (6am–10pm), one shared hour gutter, at `SYNC_PX_PER_MIN` = 0.6px a minute (576px). It replaced the two chip columns that showed only a start time.
- **To scale:** a block's height is its duration, on the same axis in both columns; the start–end time (`4:00–5:30pm`) is printed when the block is at least `SYNC_TIME_ROOM_PX` (an hour) tall. A card shorter than its floor borrows the empty minutes above it (`wfCardBoxes`), so its end and its printed start–end stay true; overlaps, and a floored card with nowhere to borrow, go side by side (`wfAssignColumns`). The floor is `SYNC_CARD_MIN_PX` (20px) in the sister's column and **`SYNC_TAP_MIN_PX` (44px) for your own blocks**, because they are the invite control (house 44px target). The both-free stripe reads real minutes, never card heights.
- Built from the pure pieces: `dayZoneSegments` (school and lunch recess drawn as the zone band, with a `🏫 School` label where there is room), `wfBufferSegments` (travel, get-ready and warm-up as hatched `.wf-travel` strips in the block's colour), `buildHourGrid` (hour rules, behind), `blockColour(b, p)` with the explicit sister, `blockDisplayName(b, p)` for the name. **Not** `buildDayColumn` / `renderBlockPixel` (active-profile bound). Block text is ink, never white on a pastel.
- **The DOM keeps the invite checks' selectors:** `#syncGrid` is the host; its first child is Jenn's `.sync-day-col`, then Jess's, then the stripe, gutter and legend — CSS places the tracks gutter | Jenn | stripe | Jess. Every block shape is a `.sync-block`; **`.sync-block-mini` is only on your own tappable blocks**, which show the activity name as text. Written into `ARCHITECTURE.md` (Navigation › Sister Sync is a timeline) as a contract.
- **Privacy unchanged:** a sister's block shows its name only when `isMe || (showAll && b.public)`; otherwise a grey (`SYNC_BUSY_GREY`) **Busy** shape at its real height, whose strips say only "Busy". A block whose activity nobody can name is drawn as Busy (it used to be left off).
- **"Both free" has one owner, `syncBusyMinutes(profile, dayKey)`:** one boolean per minute of the drawn day — each block plus its travel, get-ready and warm-up, plus school hours (school and lunch recess) on a school day. A free-category block and its buffers are not busy. Activities are looked up in **each sister's own** list (`findActivity(…, p)`); the old count used the active profile's list for both, so a sister's own custom free activity read as busy. `syncFreeRuns` turns the two into runs.
- **The both-free stripe** (`.sync-tl-stripe`) runs between the columns, green (`.sync-free-seg`) wherever neither sister is busy, labelled for a screen reader (`Both free: …`). The **"🎉 You're both free …"** sentence stays above as the summary and reads the same runs (windows ≥30 minutes listed; now to the minute, not in 15-minute slots). One legend line under the timeline says what the green line and the stripes mean.
- **Tapping your own block still invites your sister** for the day shown: `sendInvite(b, sister, key)` — duplicate guard, series choice and the moved state as in 5b/5c. A moved block always shows a visible **`💌 Send again?`** line under the name (`.sync-block-flag`, fits a 44px card); the full `💌 Sent for Tue — you moved it to Thu · Send again?` is the block's text (`.sync-block-moved.visually-hidden`) and its `title`.
- Kid floors: nothing under 13px; the block name is 15px. Nothing scrolls sideways at 390px. The 👯 details toggle, the challenges and the 💌 inbox (`#invitesSection`) are unchanged below.
- Held by `sisterSyncIsATimeline` (both columns to scale on one axis, a private block is a grey Busy shape of the right height, the stripe excludes travel, get-ready and school, a sister's own custom free activity counts as free, the stripe excludes a short own block, the sentence and the stripe agree, every `.sync-block-mini` is ≥44px tall and only in her own column, a short moved block shows `💌 … Send again?` inside its visible card, tapping your own block invites her for that day, no text under 13px at 390px), plus the unchanged `anInviteCannotBeSentTwice`, `anInviteFromSisterSyncIsDatedThatDay`, `aMovedSharedBlockSaysSendAgain` and `anInviteWaitingShowsOnToday` in `tests/smoke.js`.
- ⚠ Known, not changed here: a short own card is drawn taller than its minutes (its top edge borrows empty time; the printed start–end and the stripe are exact). Sister Sync is not in `kidScreensMeetTheHouseRules`' sweep; its 44px floor is held by `sisterSyncIsATimeline`. The four other stale "6am–9pm" comments (`js/08-day-view.js`, `js/16-print.js` ×2, `css/app.css:3`) are left for later; the one in `renderSync` is fixed.

### The 📋 sheet is Copy a day; a copy shows both days and keeps pins; starting a day over keeps what is done (manifested 2026-09-24, stages 5f and 5h)
- **Templates retired:** the 🏫 School Day and 🌈 Weekend buttons and their warning are gone, with `applyTemplate` (`js/09-sheets.js`), `schoolTemplate()` and `WEEKEND_TEMPLATE` (`js/01-config.js`). The 📋 sheet is titled **📋 Copy a day**; the Day view's 📋 button reads `Copy a day`. **😌 Rest stays** on the sheet (`#restDayBtn`). The ids `#templateOverlay` / `#templateSheetTitle` and the opener `openTemplateSheet` keep their names.
- **Both days in view:** `#copyDayNow` (`renderCopyDayNow`) lists what is on the target day now (the sister's day when a parent picked her), a pinned block marked `📌 stays`; or `Nothing on Tuesday yet.` Each source-day row (`.copy-day-row`, 44px) starts closed (`aria-expanded="false"`, `aria-controls` → `.cdr-panel`) and opens to list its blocks as `4:00–5:00pm 🏊 Swimming` (`copyDayBlockLine`, sorted by start); the **📋 Copy Tuesday onto this day** button (`.cdr-copy`) is inside the opened row. Days with nothing on them stay listed, disabled. Week tabs (last / this / next) and the parent-only sister tabs are unchanged. List text is 15px.
- **The confirm names what goes and what stays:** `Copy Thursday's 4 things onto this day?` then `This replaces:` with each block line, then `📌 Pinned, so it stays:` with each kept one. Danger styling only when something is replaced.
- **One decision:** `copyDayPlan(src, dst, srcP, dstP)` (`js/07-week-view.js`) reads only and returns `{ copy, replace, keep, dropped }`; the confirm reads it and `copyDayInto` carries it out. **A parent-pinned block on the target day is kept, for everyone** (not tombstoned); a source block the kept pin already covers (same `actId`, `tag`, `startMin`) is not copied again. Replaced blocks are tombstoned as before; unplaceable cross-child blocks are dropped and counted as before. `copyDayInto` returns `{ copied, dropped, kept }`.
- **A child's copy is never pinned:** `weekCloneBlock` drops `parentPinned` when `!isParent()`. Every caller: the 📋 day copy (child → unpinned copies, parent → pinned kept); `fillWeekFromNearest` → `copyWeekInto` (same rule; blank weeks only, so no target pin exists); `pcwCommit` (parent-only — pins kept, behaviour unchanged, and its "replace" still replaces a pinned day the parent chose in the preview).
- **🗑 Start this day over** (stage 5h, R5 §7 Q4): the last button on the 📋 sheet (`.day-over-btn`, 44px, under the line `A sick day, or a cancelled one? Done and pinned things stay.`). The 🗑 on the Day view top bar is **gone** (top bar: 📋 · 🌙 · profile badge). `clearDay` keeps every block `dayBlockStays` answers true for (`completed`, `confirmed`, `parentPinned` or `isBlockNotDone` — a parent's "$0 · didn't happen" verdict is a record too) and tombstones the rest. The confirm reads `Start Friday over? This takes off:` + each block line, `Done, pinned and not-done things stay:` + each kept line (✅ done / 📌 pinned / 🚫 not done), `There is no undo.` (danger, `Start over` / `Not now`). Nothing to take off → a toast (`Nothing to take off Friday — what's there is done, pinned or marked not done`, or `Nothing on Friday to start over`), no dialog, no change. After: the sheet closes and the toast says how many were kept. **No undo** (tombstones). Held by `startingADayOverKeepsWhatIsDone`.
- Held by `templatesAreGone`, `copyADayShowsBothDays` and `copyingADayNeverPinsForAChild` in `tests/smoke.js`, plus the unchanged `copyDayReplacesCleanly`, `aCopiedPlanIsNotPartOfTheOriginalsSeries`, `copyingADayCrossesWeeksAndKids` and `restInTemplateSheet`. `schoolCalendarIsRight` and `schoolHoursAreTheParentsToSet` now place a School Day card through `commitSchoolDays` instead of reading the retired template.

Deriving the full app manifest from `ARCHITECTURE.md` is an open item in `WORKING_RECORD.md`.

## App — Pocket money (manifested 2026-09-22)

Derived from `ARCHITECTURE.md` and checked against the code at `f4d1db5`;
updated for Plan v5 PR A, Plan v6 PR B, Plan v7 B5–B7 and Plan v8 B8–B10 (2026-09-22). **This section is authoritative for the
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
- 🏆 The repair card's second list, "Meets never paid" (`mnyUnpaidMeetsPlan` / `mnyPayUnpaidMeets`): settled weeks with a ledger row the late-meet sync treats by total (`mnyLateCompByTotal`, shared with `mnyLateCompSync`) whose meets are worth more than the row says — each week, its meet names and the amount. Positive gaps only, never takes back; weeks with no ledger row or already on the repair's list stay with the repair. Shown even when the repair has nothing; previewed and confirmed like the repair; one tap pays through `mnyLateCompSync`'s no-change mode, so a second tap pays nothing. (Plan v8 B9)
- The $3 default is backfill only: it never reaches the current week or the eight the catch-up list covers.
- 👵 The Grandma rule is the owner's test and the only default sweep (`mnyDefaultSweepPlan` / `mnyRunDefaultSweep`): a child's week gets the rule's amount when it is on or after the saved start week, outside the 8-week review window, has no family meeting record (`meetingsMet` or `meetingsHeld`) and is not already credited. Chores, fines, gifts and overrides in the week do not stop it. A meet already on file is paid on top as its own line; the row's `competition` is that total and gross/net/`finalizedWeeks` are amount + competition. Previewed (weeks, per-child totals, how many weeks had a family meeting), confirmed through the app dialog, guards re-checked at write time, never reaches the current week, a later one or the catch-up eight, credits once. New rows carry `defaulted` + `defaultReason: 'grandma'`; older `'default'` rows still read "nobody met". Week history and her money story say "Grandma rule"; the story's flat segment excludes the meet so it is drawn once. Its own Money rules section and Setup row. (Plan v7 B5 — replaced PR B's money-record filter and to-date, both deleted.)
- 👵 The start week and amount are a dated rule, `grandma.from` / `grandma.amount`, entered once through the section's Save button and `mrApplyEdits`, logged as readable scalar lines in 🕰️ Change history. `mnyGrandmaRule()` reads the newest version; without it the rule falls back to `mrStartWeek()` and $3 and is "not saved", and nothing is credited until a start week is saved. The form is a draft until Save; there is no to-date; it says the last 8 weeks are left to the catch-up list. No new synced key. (Plan v7 B7)
- The hub catch-up banner offers the same plan from the saved rule — "N weeks left the review window — Credit $3 each" — one tap through the same confirm, never automatic; with no start week saved it points to Money rules › 👵 Grandma rule instead. (Plan v7 B7)
- The repair (`evRepairPlanFor`) leaves a `defaulted` week alone: it was priced by its rule, and its meets belong to `mnyLateCompSync`. (Plan v7 B5)

### Recording
- One Record sheet, five records, each written through its owner: chore grade `mrSetChoreGrade`, meet `mrAddCompetition`/`mrUpdateCompetition`, gift `mnyAddDeposit`/`mnyEditDeposit`, fine `mrAddFine`, move `mnyMoveMoney`/`mnyRequestMove`.
- A child records two of the five — a gift and a move — and both only as proposals; the button says "Ask a grown-up".
- A gift has a `dayKey` (when it came) and a `weekKey` (which Sunday decides it); a settled week hands the decision to the next open one. An edit moves the wallet by the difference, never reverse-and-reapply.
- A meet and its calendar block carry each other's id.
- 🏆 A settled week does not block a meet (the gift pattern): a meet added, corrected or deleted for a week already settled — at a meeting, by the Grandma rule, by the repair — pays or takes back into cash at once as its own `latecomp` line on the meet's own date, filed to the next open week, whose meeting pool (`mnyPool().lateComp`) decides where it goes. One owner, `mnyLateCompSync`, called from `mrAddCompetition` / `mrUpdateCompetition` / `mrDeleteCompetition`; a moved meet is out of one week and into the other. The settled week's ledger competition/gross/net and `finalizedWeeks` stay in step, so the repair never pays it twice. Idempotent by derived id on one device, on a re-run, and across two devices that merge. A week not settled is unchanged: the meeting pays its meets. The Record sheet and the meeting's competition form say what the gift form says (`MNY_SETTLED_WEEK_SENTENCE`). (Plan v7 B6)
- A gift dated into any settled week — meeting-settled or Grandma-defaulted (`mnyWeekSettled`) — reaches her cash once and is decided at the next open meeting. (Plan v7 B6)
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
- ↩️ The Undo is withdrawn once money moves after the commit: the snapshot keeps the id of every money event on both girls' streams, and `mmUndoHeld()` drops it when any other money event is on either stream — written here (late meet, gift, move, approval) or merged from the other device — keeping the reason in `mmUndoGone`. The commit's own movements, for both girls one after the other, keep it (explicit bracket: `mmUndoHeld()` before a commit writes, `mmUndoSeal()` after). Both girls are caught up before the picture. In the button's place the meeting says "Undo is gone — money moved after this meeting; correct the item itself." with what moved; a stale button refuses. Withdrawn stays withdrawn for that week in that sitting. (Plan v8 B8)

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
- 📖 Week history: a `defaulted` row reads "👵 Grandma rule $3 + meets $X" (or "No meeting — default $3 + meets $X" for `defaultReason:'default'`) from its own figures, with no steppers and no remove button; `mnyEditLedger` and `mnyDeleteLedgerWeek` refuse it with a sentence and change nothing (its money is already in her wallet; its meets correct through the meet). Hand-typed rows without `defaulted` keep the editor unchanged. (Plan v8 B10)
- Loan edits never touch `paid` or `payments`; balance, pace, payoff date and the weekly amount due are derived on every render.
- The Money school ladder opens at **20 / 30 / 40 / 100%** of all debt paid (ready · locked · stock · mix), from ONE table: `MNY_STAGES` has ids, pots / plans / lessons name a stage, and `mnyStagePct` reads `school.stagePct` with per-key defaults (no migration). A parent override can only open a stage, never close one.
- Money rules › Lessons has three gate steppers (ready / locked / stock) that save as a dated rule version; a save that breaks ready ≤ locked ≤ stock ≤ 100 is refused with a sentence in the handler.
- 🎿 Parent Now shows a loan-season row 1 Aug – 30 Sep unless a debt was created on or after 1 Jul that year; derived from the date, nothing stored, routes to Money rules › Loans.
- The parent portal's App landing and the Today More sheet show "Build <APP_BUILD>"; `tests/check-sw-shell.js` fails when `APP_BUILD` ≠ `SW_VERSION`. One mechanism — see "The build number is on the page" above.
- The "? How this page works" button on Money rules opens the parent tour.
- A permanent click sweep (`everyMoneyControlClicksClean`) presses every money control on every money surface and fails on any exception.

## Regression table format (paste at the end of every edit)
| Feature | v<old> → v<new> | Note |
|---|---|---|
| <feature> | kept / added / intentionally removed / missing | <why, if not kept> |
