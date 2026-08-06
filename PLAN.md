# Weekly-Planner — reconciled plan from the GPT and Claude audits

## Context

Two independent audits of `main` @ `23e8bb4` arrived: a code-verified
implementation audit (GPT's, now `AUDIT.md`, which shipped with the proposed
`CLAUDE.md`) and a product/UX/security audit (Claude's, now
`AUDIT-PRODUCT.md`). They agree on the backend risks and **contradict each other
on the child experience** — Claude's wants a Today-first rebuild, GPT's
explicitly forbids restructuring.

The re-verification pass behind the decisions below is recorded at the top of
`AUDIT.md`, including four of its own items that turned out to be stale.

I re-verified both against the code and re-measured the running app on this commit
before planning. Outcome of the decisions taken:

- **Child experience: Option C primary (full Today-first rebuild), Option A
  supplementary.** A's budget and touch-target rules land *first*, as enforced
  smoke assertions, so the new Today shell is built to them instead of inheriting
  today's density. This is the sequencing that makes C safe rather than a rewrite
  on top of unmeasured ground.
- **Backend: defer auth, harden first.** Backup/restore, payload instrumentation
  and write debounce ship before any auth or schema change.
- **Firebase: evidence pass before code.** Report what the deployed rules actually
  are before writing anything that depends on them. No console changes by me.

## What I verified before planning

Baseline on this commit is green: **50/50 merge tests, `node --check` clean on all
30 JS files.**

**Confirmed in code** — GPT's P0-1 (`ctExportBackup`, `js/13-chores.js:460`, covers
only chore slices; no import function exists anywhere), P0-2 (single doc, full-tree
serialise per write, `weeks` never pruned), P0-3 (`allow read, write: if true` in
`README.md`; no auth), P0-4 (`saveAll` → `pushToFirebase` with no debounce,
`js/03-sync.js:334`), P1-1 (duplicate `getUnlockedRoutineRewards` at
`js/05-helpers.js:195` and `js/08-day-view.js:1192`; the later copy wins and drops
the `p = activeProfile()` parameter), P1-3 (`markItemUpdated` arbitrates on
`Date.now()`), P2-6 (exactly 207 inline styles: 103 + 104), P2-7 (icon-192/512
present, no manifest), P3-1 (`package.json` gitignored, no `.github/` at all),
P3-2 (docs still say the Firebase config is in `index.html`; it's
`js/03-sync.js:8`), P3-3 (22 orphaned `tg-*` classes confirmed against
`index.html` + `js/`).

**Re-measured myself** (Chromium, Jenn's profile, 900×1100 and 390×844) — GPT's UX
numbers reproduce almost exactly:

| Screen | Words | Controls | Under 44px | Min font |
|---|---:|---:|---:|---:|
| `screen-mymoney` | 737 | 19 | 17 | 11.9px |
| `screen-chore` | 346 | 27 | 16 | 9.0px |
| `screen-week` | 213 | 15 | 15 | 9.0px |
| `screen-quest` | 88 | 5 | 4 | 10.6px |

Worst targets: chore week arrows `‹` `›` at **21×21**, My money `?` helpers at
**22×22**, "◀ Switch hero" at 131×35. The font floor is **8.96px**, not the 11.9px
GPT reported. Not one kid-facing control meets 44×44 on any screen.

**Corrections — do not action these as written:**

1. **GPT P2-5 is stale.** Native `confirm()`/`prompt()` are *gone* — zero call
   sites; the only grep hit is a comment. `showConfirm`, `showPrompt`,
   `showChoice`, `showCheckConfirm` already exist (`js/17-ui-misc.js:84-99`).
   GPT names them `appDialog`/`appChoice`, which are the internal `_appDialog`
   primitives. **Drop this item.**
2. **GPT P1-2's "77 unescaped" is inflated.** Its own cited examples include
   `js/10-social.js:99` and `js/05-helpers.js:285` (both `.textContent`) and
   `js/07-week-view.js:545` (`.title`) — none are injection sinks. The real
   surface is **56** template-literal `innerHTML` writes (55 `=` + 1 `+=`).
   Audit those; don't sweep the 77.
3. **GPT P2-2 asks for a smoke assertion that already exists.** `phoneAudit`
   (`tests/smoke.js:742-804`) already blocks on 44px and is wired into
   `checks.kidTabFitsAPhone` / `checks.portalFitsAPhone`. Its gaps are coverage:
   **height only (never width)**, ~10 selectors, kid tab + parent portal only.
   Broaden it; don't rebuild it.
4. **GPT P2-3 is correct and I initially doubted it.** The numbered rail *is*
   rendered — `1 💰 My money KID` · `2 💪 What I earned MEETING` ·
   `3 🤝 What I do with it MEETING` · `4 ⚙️ Money rules PARENT` ·
   `5 🎓 Money school OPTIONAL`, role badges and all, on the kid's own page.
5. **Claude's audit did not run the app** (it says so). Where the two conflict on
   UX, GPT's measurements are the evidence. Claude's audit is the stronger source
   on invariants and on the security threat model.

## Invariants — hold across every branch below

From Claude's audit, and non-negotiable during the rebuild:

1. A child may create or update a claim; she must never grade, settle, or move money.
2. Parent review is the authority point; family-meeting settlement is the financial one.
3. Settled weeks stay immutable absent an explicit audited correction flow.
4. Rule changes are effective-dated and must not recalculate settled history.
5. Offline edits and reconnect must not silently discard data.
6. Do not convert to ES modules, add a bundler, or rewrite the state model.
   `file://` smoke, ~272 inline `onclick` handlers and global-driven tests all
   depend on classic scripts (`MODULARIZATION_PLAN.md`).
7. `js/04-merge.js` is frozen except to fix a demonstrated sync bug, test first.

---

## Branch 0 — `claude/audit-baseline`: guardrails before anything moves

Nothing else is safe to land until a fresh clone can run the tests and CI enforces them.

- **Commit the two audit deliverables**: `CLAUDE.md` and `AUDIT.md` (both supplied,
  neither in the repo). Add my corrections above as a "Verified / superseded"
  section in `AUDIT.md` so the stale items can't be re-actioned.
- **`package.json`** — remove it from `.gitignore`, commit with `playwright-core`
  pinned at `1.62.1` (the version I verified against) and scripts `check`,
  `test:merge`, `test:smoke`, `test`.
- **`.github/workflows/ci.yml`** — `check` + `test:merge` on every PR (fast, no
  browser); `test:smoke` on `main` and nightly, uploading `tests/out/*.png` as
  artifacts. Smoke needs `--no-sandbox`; it also auto-detects
  `/opt/pw-browsers`, so pin the browser in CI to match.
- **Duplicate-global guard** — add to `check`: `grep -h '^function ' js/*.js | sed
  's/.*function \([A-Za-z0-9_]*\).*/\1/' | sort | uniq -d` must be empty.
- **Fix P1-1 now** — delete `getUnlockedRoutineRewards` from
  `js/08-day-view.js:1192`, keeping the `js/05-helpers.js:195` version that accepts
  the profile parameter. Callers: `js/08-day-view.js:1149`, `js/09-sheets.js:908,926`,
  `js/26-chore-kid.js:52`. The guard above stops recurrence.
- **Fix P3-2 doc drift** — correct the Firebase config path in `README.md` and
  `SECURITY_TODO.md` to `js/03-sync.js:8`; header `REVIEW.md` and
  `MULTI_ROLE_REVIEW.md` as historical (their `index.html` line numbers predate the split).
- **Firebase evidence pass (read-only)** — report the deployed Firestore rules, who
  has project access, and current document size, into `SECURITY_TODO.md`. Separate
  confirmed from assumed. **No console changes, no production writes.**

## Branch 1 — `claude/p0-durability`: protect the data first

A large UI rebuild is exactly when a tested restore path matters most. Auth is
deferred by decision; this branch is the part that doesn't touch the schema.

- **Full backup/restore** (P0-1). `exportFullBackup()` writes the whole
  `{ profiles, shared }` tree plus `{ schemaVersion, exportedAt, appVersion }` —
  today's export silently omits `profiles.*.weeks`, `progress`, `goals`, `todos`,
  `customActivities`, `achievements`, `earnings`. `importFullBackup(file)`:
  parse → validate `schemaVersion` → offer **Merge** (route through the existing
  `mergeRemoteState`, `js/03-sync.js:349` — do not write a second merge) or
  **Replace** (confirm-gated via the existing `showCheckConfirm`) → `saveAll()`.
  Parent-gated, on the parent screen. Keep `ctExportBackup` as the chore-only
  export, relabelled so the two are distinguishable.
- **Payload-size instrumentation** (P0-2 step 1 only). In `pushToFirebase`
  (`js/03-sync.js:285`) measure `new Blob([JSON.stringify(payload)]).size`, surface
  it on the parent screen, warn at 700 KB, hard-warn at 900 KB. Firestore's ceiling
  is 1 MiB and `weeks` is never pruned — today the failure mode is a `set()` that
  dies permanently behind the reassuring label *"Synced (connection only)"*
  (`js/03-sync.js:322`). Archival (step 2) stays deferred until the numbers justify it.
- **Write debounce** (P0-4). Coalesce behind a 2s trailing debounce in `saveAll`;
  flush immediately on `visibilitychange` (hidden) and `pagehide` so a closed tab
  never drops a pending write. Keep the existing 5s retry (`js/03-sync.js:67`) as
  the failure path.
- **Rules, written but not deployed** — commit `firestore.rules` with the
  per-family model and a `SECURITY_TODO.md` runbook of exact console steps. Client
  keeps working against today's open rules; nothing here depends on the console.

## Branch 2 — `claude/p1-correctness`: mechanical, before the UI churns

- **Escaping** (P1-2, corrected scope). Move `escapeHtml`/`escapeAttr` from
  `js/08-day-view.js:948-960` to `js/05-helpers.js` — they're called from files
  that load earlier, which is a live load-order hazard. Then audit the **56 real
  `innerHTML` template writes**, not the inflated 77. Add a grep lint that flags
  unescaped `${...name}` / `${...note}` / `${...label}` reaching `innerHTML`,
  with `/* safe: constant */` as the opt-out. Acceptance: an activity named
  `<img src=x onerror=alert(1)>&"` renders as literal text on week, day, sheet,
  sync and chore screens.
- **Clock-skew arbitration** (P1-3). On each snapshot read Firestore's server
  timestamp, hold a per-device offset in memory, stamp writes with corrected time,
  fall back to raw `Date.now()` offline. Small change; it makes the whole merge
  layer trustworthy. Failing test in `tests/merge.test.js` first — a device 10
  minutes fast must not beat a later real edit.

## Branch 3 — `claude/kid-standards`: A, as the standard C gets built to

This is the supplementary pass, and it lands **before** the rebuild so the new
shell has a budget to respect rather than one to retrofit.

- **Enforce the rules in the smoke suite first**, so they bind the rebuild:
  - Broaden `phoneAudit` (`tests/smoke.js:742`) to check **width as well as
    height**, across all kid screens (`screen-week`, `screen-quest`,
    `screen-mymoney`, `screen-chore`), not just the kid chore tab and portal.
  - New assertion: **≤200 visible words** per kid screen in default collapsed
    state, and every collapsed section reachable in one tap.
  - New assertion: **13px font floor** (15px for anything a child must read to act).
- **Then make the app pass them**:
  - Reference panels default **closed**, state remembered — "What things pay"
    already has a working `Hide ▾` in `js/22-money-page1.js:472`; it just opens by
    default. Extend the same treatment to the deadline table, free-job rules and
    year goal. 737 → ~165 words.
  - Move the per-chore deadline table onto the chore itself on `screen-chore`
    (`js/26-chore-kid.js`) — recognition over recall.
  - **Role-filter the numbered rail** (P2-3): a kid sees `My money` and
    `Money school`; parent and meeting modes see all five. Visibility only, same
    components and routes.
  - Global `min-height/min-width: 44px` on interactive elements in `css/app.css`;
    where a chip must stay visually small, keep the visual size and grow the hit
    area with padding or an `::after` overlay. Fix the 21×21 chore arrows first.
  - Raise the font floor off 8.96px.
- **PWA manifest** (P2-7) — `manifest.json` + `<link rel="manifest">` +
  `theme-color`; `icon-192.png`/`icon-512.png` already exist at the right sizes.
  High value for a tablet-resident planner, roughly an hour.

## Branches 4–6 — `claude/today-shell-{1,2,3}`: C, staged

C is the chosen direction. It is also the largest diff in the plan, so it ships in
three reviewable stages rather than one. Each stage keeps the suite green.

**4 — build Today alongside the existing app.** New `js/30-today.js` (declarations
only; wiring in `js/99-main.js` per the load-order rule) plus one screen `div` in
`index.html`. Renders, in order: current/next scheduled item, today's quests,
claimable chores, pending parent answers, one encouragement element. It reads
existing state through existing functions — no new business logic, no new money
paths, no duplicate globals. Reachable but not yet default; every current route
untouched. New smoke checks for the screen, built to Branch 3's budget.

**5 — make Today the front door.** Default child landing after `selectProfile`;
introduce the four-destination nav (**Today · Week · Money · More**). Old routes
keep working as aliases so nothing breaks mid-migration. `refreshCurrentScreen`
(`js/03-sync.js:400`) gains the Today branch. Port the smoke checks that drive
screens through globals like `goWeek()` / `openChoreTab()`.

**6 — consolidate and retire.** Move Print, Sisters, Trends, Story, School and
setup under **More** or the relevant parent area; collapse the four differently
labelled money entry points to one label, "My money" (P2-4); retire duplicate
top-bar shortcuts and the route aliases from stage 5. Then, with regression
coverage in place, delete confirmed dead DOM/CSS — the 22 orphaned `tg-*` classes
(P3-3) among them.

**Explicitly not in scope:** Claude's audit Phase 3 (parent Waiting-home
consolidation) and Phase 4 (design-system pass). Both are reasonable follow-ups;
neither was chosen here. Also out: ES modules, a bundler, eliminating the ~1,200
globals, restyling the hand-drawn aesthetic, and refactoring `js/04-merge.js`.

---

## Verification

Every branch, before push — the three commands from `CLAUDE.md`:

```bash
npm test    # check + merge + smoke; see CLAUDE.md for the individual scripts
```

Branch 0 replaced the old documented shell loop
(`for f in js/*.js; do node --check "$f" || break; done && echo OK`) — `break`
returns 0, so it printed `OK` and exited 0 even on a syntax error. The merge
suite must stay at 50/50 plus new cases; smoke is 115 checks today.

Notes from this session: `playwright-core` is gitignored and must be installed
once (`npm install playwright-core`); Chromium lives at `/opt/pw-browsers` and
**needs `--no-sandbox`** in this environment or it dies with no output.

Per-branch acceptance:

- **0** — CI red on a deliberately broken syntax file; duplicate-global guard
  catches a re-added duplicate; fresh clone runs `npm test`.
- **1** — seed a week → `exportFullBackup` → clear `localStorage` → reload →
  `importFullBackup` → deep-equal on `profiles` and `shared`. 20 rapid mutations
  produce ≤2 Firestore writes (spy on `fbDocRef.set`) and the final state still
  syncs. A synthetic 60-week state trips the size warning.
- **2** — the XSS-shaped activity name renders as literal text on all five
  surfaces; escaping lint clean; the clock-skew merge test passes.
- **3** — smoke asserts ≤200 words and zero sub-44×44 controls on all four kid
  screens at 390×844 and 900×1100; Lighthouse installability passes.
- **4–6** — a child can answer "what now?" on one screen and submit a chore claim
  without entering the full planner; no planning or money data is lost; the money
  invariants above still hold in the smoke suite at every stage.

Screenshots for changed layouts at 390×844, 768×1024, 1024×768, 1440×900. Report
untested cases explicitly — live two-device Firestore sync is not covered by any
of this and should be called out as such in each PR.
