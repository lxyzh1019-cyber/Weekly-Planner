# Weekly-Planner — Implementation Audit

Audited against `main` @ `23e8bb4` (224 commits). Every finding below was
verified against the current code, not carried over from an earlier review.

**How to use this file:** work top-down. Each item has a location, the reason it
matters, a fix, and an acceptance check. An item is done when its acceptance
check passes *and* all three verification commands in `CLAUDE.md` are green.

## Already closed — do not re-fix

Verified fixed on current `main`: BUG-1 (quest-board completions now route
through `awardBlockLinks`, `js/06-quests.js:409`), BUG-2 (`saveLocal` surfaces a
toast on failure, `js/03-sync.js:267`), BUG-3 (`isSunday` and heatmap month go
through `toDayKeyInZone`), BUG-4 partial (PIN is parent-configurable in shared
state), DESIGN-1 (`--accent-strong: #c14a24`), DESIGN-4 (duplicate
`--radius-sm` removed), PSY-3 (rest-day and partial-progress states exist).

`REVIEW.md` and `MULTI_ROLE_REVIEW.md` are now largely historical.

## Re-verification pass — 2026-08-06

This file was independently re-checked against `23e8bb4` before any work started,
alongside the product audit in `AUDIT-PRODUCT.md`. Baseline at that point:
**50/50 merge tests, `node --check` clean on all 30 JS files.**

Confirmed as written: P0-1, P0-2, P0-3, P0-4, P1-1, P1-3, P2-1, P2-3, P2-4, P2-6,
P2-7, P3-1, P3-2, P3-3 (22 orphaned `tg-*` classes, checked against `index.html`
and `js/`).

The kid-screen measurements reproduced almost exactly on an independent run
(Chromium, Jenn's profile, 900×1100 and 390×844): `screen-mymoney` 737 words /
17 of 19 controls under 44px, `screen-chore` 346 / 16 of 27, `screen-week` 213 /
15 of 15, `screen-quest` 88 / 4 of 5. Worst targets confirmed: chore week arrows
at 21×21, My money `?` helpers at 22×22, "◀ Switch hero" at 131×35.

**Four items are wrong or stale. Do not action them as written.**

1. **P2-5 is closed.** Native `confirm()`/`prompt()`/`alert()` have zero call
   sites — the only grep hit is a comment. `showConfirm`, `showCheckConfirm`,
   `showPrompt` and `showChoice` already exist at `js/17-ui-misc.js:84-99`. The
   `appDialog`/`appChoice` the item names are the internal `_appDialog`
   primitives, not a pending migration. **Drop the item.**

2. **P2-2 asks for a check that already exists.** `phoneAudit`
   (`tests/smoke.js:742-804`) already blocks on 44px via
   `checks.kidTabFitsAPhone` and `checks.portalFitsAPhone`. Its real gaps are
   coverage — it measures **height only, never width**, over ~10 selectors, on
   the kid chore tab and parent portal only. Broaden it; don't rebuild it.

3. **P1-2's "77 unescaped" is inflated.** Several of its own cited sites are not
   injection sinks: `js/10-social.js:99` and `js/05-helpers.js:285` assign
   `.textContent`, `js/07-week-view.js:545` assigns `.title`. The real surface is
   **56** template-literal `innerHTML` writes (55 `=`, 1 `+=`). Audit those.
   The `escapeHtml`/`escapeAttr` load-order hazard in the same item is real.

4. **The font floor is worse than reported** — 8.96px on `screen-week` and 9.0px
   on `screen-chore`, not the 11.9px in P2-2.

The measured word counts and touch-target failures are now enforced as smoke
assertions rather than left as prose targets; see the plan for sequencing.

---

# P0 — Durability

These four compound each other. Do them as one branch.

## P0-1 · There is no backup or restore for planner data

**Where:** `ctExportBackup()`, `js/13-chores.js:460`

The only export in the repo covers the chore/money slices. It does **not**
include `profiles.*.weeks` (the planner itself), `progress`, `goals`, `todos`,
`customActivities`, `achievements`, or `earnings`. And there is no import
function anywhere — export is a one-way door.

Combined with P0-3 (one unauthenticated global document), a single bad write
destroys a year of a child's planner with no recovery path.

**Fix**
- Add `exportFullBackup()` writing the complete `{ profiles, shared }` tree plus
  `{ schemaVersion, exportedAt, appVersion }`.
- Add `importFullBackup(file)`: parse → validate `schemaVersion` → present a
  choice of **Merge** (route through the existing `mergeRemoteState` path) or
  **Replace** (confirm-gated) → `saveAll()`.
- Parent-gated, on the parent screen. Keep `ctExportBackup` as the chore-only
  export if it's in use; label them distinctly.
- Reuse the merge layer for Merge. Do not write a second merge implementation.

**Acceptance:** new smoke check — seed a week → export → clear `localStorage` →
reload → import → deep-equal on `profiles` and `shared`.

## P0-2 · The Firestore 1 MiB document ceiling is on a timer

**Where:** `FS_COLLECTION`/`FS_DOC_ID`, `js/03-sync.js:18-19`; `pushToFirebase`,
`js/03-sync.js:~288`

Everything lives in one document, and every mutation serialises the entire
`{ profiles, shared }` tree. `weeks` is never pruned. Blocks carry ~20 fields
(`placeBlock`, `js/08-day-view.js:1511`); at roughly 6 blocks/day × 2 kids that
is ~30–45 KB/week, putting the document at Firestore's hard 1 MiB limit inside
roughly 6–12 months of real use.

When it trips, `set()` fails permanently and the status line reads
*"Synced (connection only)"* — a reassuring label for a dead sync. Nobody will
notice until data is already being lost.

**Fix, in this order**
1. **Instrument first.** In `pushToFirebase`, measure
   `new Blob([JSON.stringify(payload)]).size`. Log it, expose it on the parent
   screen, warn at 700 KB, hard-warn at 900 KB. Ship this alone if nothing else.
2. **Archive cold weeks.** Keep a rolling hot window (suggest 12 weeks) in the
   live document; move older weeks to
   `weekly_planner/shared_state/archive/{yyyy-Www}` documents, loaded on demand
   when a parent scrolls back. Archival must be idempotent and tombstone-aware.
3. Only if 1–2 prove insufficient: one document per week.

**Acceptance:** payload size is visible on the parent screen; a synthetic state
seeded with 60 weeks of blocks triggers the warning and, after archival, brings
the live document back under 300 KB with all weeks still readable.

## P0-3 · Unauthenticated single global document

**Where:** `js/03-sync.js:8-19`; starter rule in `README.md`

`allow read, write: if true`, one document shared by every deployment, and the
config committed in a public repo. Already logged in `SECURITY_TODO.md` and
still fully open. It is the multiplier on P0-1 and P0-2.

**Fix (minimum viable, no login UI)**
- Enable Firebase **Anonymous Auth**; persist the resulting uid.
- Key the document per family: `weekly_planner/{uid}`.
- One-time migration: on first run with auth, if the legacy `shared_state`
  document exists and the new one doesn't, copy it across.
- Rules:
  ```
  match /weekly_planner/{familyUid} {
    allow read, write: if request.auth != null && request.auth.uid == familyUid;
  }
  match /weekly_planner/{familyUid}/archive/{weekId} {
    allow read, write: if request.auth != null && request.auth.uid == familyUid;
  }
  ```
- Add a parent-visible "link another device" flow (show/enter the family id), or
  the second device silently starts an empty family.
- Keep the PIN as a soft child-lock only. It is not the boundary.

**Acceptance:** two browser profiles get separate documents; a client without
auth is denied read and write; existing data survives the migration.

## P0-4 · Write amplification — no debounce

**Where:** `saveAll` → `pushToFirebase`, `js/03-sync.js:~330`

Every tap writes the entire document. Firestore's free tier allows 20k
writes/day; two kids working a chore list can burn it, and it accelerates P0-2.

**Fix:** coalesce writes behind a 2-second trailing debounce. Flush immediately
on `visibilitychange` (hidden) and `pagehide` so a closed tab never loses a
pending write. Keep the existing 5-second retry as the failure path.

**Acceptance:** a smoke step that fires 20 rapid mutations produces ≤2 Firestore
writes (spy on `fbDocRef.set`), and the final state still syncs.

---

# P1 — Correctness

## P1-1 · Duplicate function declaration

**Where:** `getUnlockedRoutineRewards` at `js/05-helpers.js:195` **and**
`js/08-day-view.js:1192`

Two top-level declarations of the same name in one shared global scope. The
`08` copy loads later and silently wins — and it drops the `p = activeProfile()`
parameter the `05` version accepts. Callers exist in `08-day-view.js:1149`,
`09-sheets.js:908,926`, and `26-chore-kid.js:52`. Latent today because no caller
passes a profile; it breaks the first parent view that reads the other kid's
rewards.

**Fix:** delete the `js/08-day-view.js` copy. Then add a guard to the test
script so this class of bug can't recur:

```bash
grep -h '^function [A-Za-z0-9_]*' js/*.js \
  | sed 's/.*function \([A-Za-z0-9_]*\).*/\1/' | sort | uniq -d
```

Non-empty output fails the check.

**Acceptance:** the duplicate-name check returns nothing; smoke green.

## P1-2 · Inconsistent HTML escaping — 328 escaped vs 77 unescaped

**Where:** ~77 unescaped interpolations of user-editable fields inside
`innerHTML` templates. Confirmed examples: `js/09-sheets.js:1583`,
`js/08-day-view.js:449, 796, 843, 850, 1218, 1259`, `js/10-social.js:99`,
`js/05-helpers.js:285, 294, 314, 345, 370`, `js/07-week-view.js:545`.

Activity names, block notes, chore names and kid feedback are all user-editable.
A `&` or `<` in a name corrupts the render **today** — this is a rendering bug
before it is a security one, though it is also XSS-shaped.

**Fix**
- Move `escapeHtml` and `escapeAttr` out of `js/08-day-view.js:948-960` into
  `js/05-helpers.js`. They are helpers called from files loaded earlier; their
  current home is a latent load-order hazard.
- Mechanical pass: wrap every user-supplied string in the correct escaper.
- Add a lint step to the verification block that fails on an unescaped
  `${...name}` / `${...note}` / `${...label}` inside a template that reaches
  `innerHTML`. Grep-based is fine; false positives get an inline
  `/* safe: constant */` marker.

**Acceptance:** an activity named `<img src=x onerror=alert(1)>&"` renders as
literal text on the week, day, sheet, sync and chore screens, and injects
nothing. Lint returns clean.

## P1-3 · Merge arbitration trusts the device clock

**Where:** `markItemUpdated` (`js/03-sync.js:~347`), `mergeArrayById`
(`js/04-merge.js:6`), `_meta.updatedAt` (`js/03-sync.js:~300`)

Every conflict is resolved by comparing client `Date.now()` values. A tablet
with a wrong clock wins every conflict forever, or loses every one — silently,
permanently, and invisibly.

**Fix:** on each snapshot, read Firestore's server timestamp, compute a
per-device offset, and stamp writes with the corrected time. Store the offset in
memory only. Fall back to raw `Date.now()` when offline.

This is a small change that makes the entire (genuinely good) merge layer
trustworthy.

**Acceptance:** new unit test in `merge.test.js` — a device stamped 10 minutes
fast does not win against a later real edit once the offset is applied.

---

# P2 — UX / UI and flow

Measured headless at iPad (900×1100) and phone (390×844), both kid profiles.

## The direct answer on button count

**The number of buttons is not the problem.** Visible interactive elements per
screen: Quest 6, Week 15, Day 12, Chore 27, My Money 19, Sync 4. For an app this
feature-rich, that's reasonable, and the tab bar keeps the top-level model
clear.

Three things *are* problems, in this order:

## P2-1 · Reading load, not tap load — **this is the real issue**

Measured visible word counts on kid-facing screens:

| Screen | Words |
|---|---|
| `screen-mymoney` | **736** |
| `screen-chore` | **346** |
| `screen-week` | 213 |
| `screen-quest` | 88 |
| `screen-day` | 40 |

736 words is roughly three pages of a children's chapter book, on one screen, in
policy prose — chore pay tiers, per-chore deadlines, free-job explanations,
year-goal framing. The writing itself is good; the *placement* is wrong. A kid
opening "My money" wants one thing: **how much do I have, and how much can I
still earn today.** Everything else is reference material she needs once a
month.

**Fix**
- Set a budget of **≤200 visible words per kid screen** and enforce it in the
  smoke test.
- Restructure `screen-mymoney` to three zones: (1) the number — cash, and
  "you can still earn $X today"; (2) this week's progress; (3) everything else
  collapsed behind **"How money works ▾"**, default closed, state remembered.
- `js/22-money-page1.js:129` already has a tour/dialog pattern and the "What
  things pay" panel already has a `Hide ▾` toggle. The instinct is right and
  underused — extend it to the deadline table, free-job rules and year goal.
- Move the per-chore deadline table ("Dishes — before you leave the kitchen")
  onto the chore itself in `screen-chore`, at the point of use. Recognition over
  recall.

**Acceptance:** smoke asserts `<200` words visible on `screen-mymoney`,
`screen-chore` and `screen-quest` in the default collapsed state; every
collapsed section is reachable in one tap.

## P2-2 · Touch targets are systematically undersized

Measured: **not a single kid-facing control reaches 44×44px.** Almost everything
lands at 35–43px tall, and several are far worse:

| Control | Screen | Measured |
|---|---|---|
| Week nav `‹` `›` | Chore (iPad) | **21 × 21** |
| Day/Week toggle | Chore | 65×35, 75×35 |
| `💰` `📋` `🌙` chips | Day | 47 × 38 |
| Back `◀` | Most screens | 40–45 × 40–41 |
| `– / +` steppers | Chore (phone) | 40 × 40 |
| "Switch hero" | Quest | 131 × 35 |

Font sizes bottom out at **11.9px**, with a meaningful cluster at 12.5–13.4px.

For a 9-year-old on a tablet, 21×21px is a miss-and-retry target, and misses on
a chore screen mean wrong data, not just annoyance. On iPad `screen-chore`, 16 of
27 controls are under 44px and 10 are under 32px.

**Fix**
- Global rule: minimum `min-height: 44px; min-width: 44px` on every interactive
  element. Where the visual chip must stay small, keep the visual size and
  expand the hit area with padding or an `::after` overlay.
- The 21×21 week arrows on the chore screen are the single worst offender — fix
  first.
- Raise the font-size floor to 13px, and 15px for anything a child must read to
  act.

**Acceptance:** add a smoke assertion that walks every visible interactive
element on the kid screens at both viewports and fails on any bounding box under
44×44. This is ~15 lines and prevents all future regressions.

## P2-3 · Sub-navigation shows a kid four things that aren't hers

`screen-mymoney` presents a numbered rail: `1 💰 My money [KID]` ·
`2 💪 What I earned [MEETING]` · `3 🤝 What I do with it [MEETING]` ·
`4 ⚙️ Money rules [PARENT]` · `5 🎓 Money school [OPTIONAL]`.

Five tabs, of which one is the child's. The role badges are honest and a good
instinct, but showing a kid four doors she can't or shouldn't open is the
button-count complaint in its true form: it isn't *many* buttons, it's *other
people's* buttons.

**Fix:** filter the rail by active role. A kid sees `My money` and
`Money school`. Parent and meeting mode see the full five. Same components, same
routes — visibility only.

**Acceptance:** on a kid profile, only role-appropriate entries render; parent
mode is unchanged; smoke covers both.

## P2-4 · Four entry points to money, one destination

`💰 My pocket money` (Quest), `💰 My money` (Week), `💰 My money` (Chore),
`💰` (Day). Multiple routes to a frequent destination is legitimate design, not
a bug — but the labels differ and, combined with P2-3's five sub-tabs, the
mental model gets fuzzy.

**Fix:** one label everywhere — **"My money"**. Low effort, real clarity gain.

## P2-5 · Native `confirm()` / `prompt()` still in use

Carried over from `REVIEW.md`, still open. Grey browser dialogs inside a
hand-drawn sticker world, unstyled and untranslatable. `js/17-ui-misc.js`
already has `appDialog` / `appChoice` — migrate the remaining call sites,
starting with destructive actions and PIN entry.

## P2-6 · 207 inline styles bypass the token layer

103 in `index.html`, 104 generated in JS. `css/app.css` has a real token system
(`--space-*`, `--text-*`, `--shadow-*`); inline styles fight it and are the main
thing blocking dark mode. Migrate the high-traffic ones (screen containers,
badges, chips) into classes. Low priority, steady payoff.

## P2-7 · No PWA manifest

`assets/icons/icon-192.png` and `icon-512.png` exist — the exact manifest sizes
— but there is no `manifest.json`, no `<link rel="manifest">`, no `theme-color`,
and no service worker. Firestore's own `enablePersistence()` isn't called
either.

For a planner that lives on a kid's tablet, "add to home screen, opens like an
app, works in the car with no wifi" is high value and roughly an hour's work.

**Acceptance:** Lighthouse installability check passes; the app boots and
renders the current week with the network disabled.

---

# P3 — Repo hygiene

## P3-1 · No `package.json`, no CI

`package.json` is in `.gitignore`, so a fresh clone cannot run the smoke test
without manual setup and Playwright is unpinned.

**Fix:** commit a `package.json` with `playwright-core` pinned and scripts:
```json
"scripts": {
  "check": "for f in js/*.js; do node --check \"$f\" || exit 1; done",
  "test:merge": "node tests/merge.test.js",
  "test:smoke": "node tests/smoke.js",
  "test": "npm run check && npm run test:merge && npm run test:smoke"
}
```
Add `.github/workflows/ci.yml` running `check` + `test:merge` on every PR
(fast, no browser). Run `test:smoke` nightly or on `main`.

## P3-2 · Documentation drift that will misdirect an agent

- `README.md:9` and `SECURITY_TODO.md:1,17` say the Firebase config is in
  `index.html`. It has been in `js/03-sync.js:8` since the split.
- `MULTI_ROLE_REVIEW.md` cites `index.html` line numbers throughout from the
  pre-split monolith. Following them now lands in markup.

**Fix:** update `README.md` and `SECURITY_TODO.md` paths. Add a one-line header
to `REVIEW.md` and `MULTI_ROLE_REVIEW.md` marking them historical and pointing
to this file.

## P3-3 · 67 unreferenced CSS classes

Out of 1,118 in a 5,298-line stylesheet. Includes an orphaned `tg-*` family
(~25 rules: `tg-grid`, `tg-hour-cell`, `tg-mytime-*`, `tg-week-overview`…) left
behind when the Day Blocks view was rewritten to `tg2-*`. Also `mood-btn`,
`money-hero`, `qmp-*`, `day-goals-todos*`, `ck-chore-*`.

**Fix:** delete after confirming each against `index.html` + `js/`. Add the
dead-class scan as an advisory (non-blocking) CI step.

## P3-4 · Fifteen functions over 80 lines

`renderFullWeek` (272), `renderBlockPixel` (186), `renderPrintSheet` (158),
`openEditSheet` (157), `buildTimeline` (146), `saveEditChanges` (123). Not
urgent — they're render functions and mostly linear — but `renderFullWeek` at
272 lines is where the next hard bug will hide. Split opportunistically when you
next touch it, not as a standalone task.

---

# Explicitly out of scope — do not do these

- **Do not convert to ES modules or add a bundler.** The reasoning in
  `MODULARIZATION_PLAN.md` still holds: `file://` smoke test, ~272 inline
  `onclick` handlers, global-driven test harness.
- **Do not refactor `js/04-merge.js` for style.** It is the strongest code in
  the repo and has 50 passing tests.
- **Do not attempt to eliminate the ~1,200 globals.** High cost, high risk, and
  the numbered load-order convention is working.
- **Do not restyle the app.** The hand-drawn aesthetic, the pastel category
  palette and the celebration moments are working. P2 changes structure and
  sizing, not visual identity.

---

# Suggested branch sequence

| Branch | Contents | Notes |
|---|---|---|
| `claude/p0-durability` | P0-1 … P0-4 | Ship P0-2 step 1 (instrumentation) first and alone if you want a quick win |
| `claude/p1-correctness` | P1-1 … P1-3 | Mechanical; P1-2 is the largest diff |
| `claude/p2-kid-ux` | P2-1 … P2-4 | Highest visible impact for the kids; smoke assertions land here |
| `claude/p2-polish` | P2-5 … P2-7 | Can ride alongside feature work |
| `claude/p3-hygiene` | P3-1 … P3-3 | Do P3-1 early — it protects everything after it |
