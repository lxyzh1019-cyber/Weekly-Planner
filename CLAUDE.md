# CLAUDE.md — Weekly-Planner

Operating rules for any agent session on this repo. Read this first, every session.

## What this is

A single-family weekly planner for two kids (Jenn, Jess) plus a parent role.
Static site, no build step, deployed to GitHub Pages. Cloud sync via Firebase
Firestore (compat SDK, loaded from CDN). Part of a wider family-app ecosystem
sharing the Firebase project `chore-tracker-a461b`.

Primary devices: an iPad and a phone, used by children. Assume touch, assume
short attention, assume the reader is 9–13.

## Architecture — the constraints that must not be broken

**Classic scripts, not ES modules.** `index.html` loads `js/01-*.js` …
`js/99-main.js` as plain `<script src>` tags sharing one global scope. This is a
deliberate decision, documented in `MODULARIZATION_PLAN.md`. Do not "modernise"
it. Three things break if you do:

- `tests/smoke.js` opens the app over `file://`; Chrome blocks ES module imports
  there, so the entire smoke suite dies.
- `smoke.js` drives the app through **global** function calls
  (`page.evaluate(() => selectProfile('jenn'))`).
- There are ~272 inline `onclick="…"` attributes (160 in `index.html`, ~112
  generated in JS) that resolve against the global scope.

No bundler, no npm build, no framework. Files must stay directly loadable.

**Load-order rule.** Files `01`–`29` contain **declarations only** — `function`,
`const` data tables, `let` state. All top-level *executable* code (Firebase boot,
event wiring, first render) lives in `js/99-main.js`, loaded last. Function
hoisting means a declaration in `05` may freely *call* something declared in
`22`; it just must not *run* at load time.

Current permitted exceptions (do not add more): `js/03-sync.js:343`
(`window._skipRewardPrompt = false`), `js/08-day-view.js:1490-1491` (two
`window.addEventListener` calls that only register), `js/17-ui-misc.js:153`
(the self-contained `installActionDoubleTapGuard` IIFE), and the
`module.exports` guards at the end of `04-merge.js`, `18-rules.js`,
`21-money-data.js`.

**One declaration per name, globally.** All 30 files share one scope, so a
duplicate `function foo()` in two files means the later one silently wins. A
`let`/`const` declared twice is a hard `SyntaxError` at load. Before adding a
top-level name, grep for it across `js/`.

## Verification — run all three before any push

```bash
npm ci      # once
npm test    # runs all three below, stops at the first failure
```

Or individually:

```bash
# 1. Syntax check every module + the duplicate-name guard
npm run check

# 2. Merge-layer unit tests (50 checks, must be 50/50)
npm run test:merge

# 3. Headless smoke test — boots the app, drives the main flows
npm run test:smoke          # screenshots land in tests/out/
```

`npm run check` runs `tests/check-syntax.js` and `tests/check-globals.js`. **Do
not go back to the old shell loop** —

```bash
for f in js/*.js; do node --check "$f" || break; done && echo OK   # BROKEN
```

`break` returns 0, so the loop exits 0 even when a file fails, `&& echo OK`
fires, and the check reports success while the real error scrolls past on
stderr. Under CI it is a check that can never fail. `tests/check-syntax.js`
exists because of this.

A check in `smoke.js` passes only by being exactly `true`. The house idiom
`checks.x = cond || [whatWentWrong]` returns a **truthy array** on failure, so
while the runner used `filter(([,v]) => !v)` all eight checks written that way —
the 44px target audit among them — printed their findings and were then counted
as passes. Same shape as the `|| break` bug above: a test that reports a problem
and returns success. If you add a check, return `true` or the findings, never a
bare truthy value.

`tests/check-globals.js` enforces the one-declaration-per-name rule above,
covering `function`, `async function` and top-level `let`/`const`/`var`
(including the comma-separated form) — a duplicate `let` is a load-time
`SyntaxError` that per-file `node --check` cannot see.

`smoke.js` auto-detects Chromium under `/opt/pw-browsers` or
`~/.cache/ms-playwright` (`npx playwright install chromium`); elsewhere set
`SMOKE_CHROMIUM=/path/to/chrome`.

CI (`.github/workflows/ci.yml`) runs all three on every pull request and pushes
to `main`, plus nightly, and uploads the smoke screenshots as an artifact.

New features ship with a new check in `smoke.js`. The chore→money hand-off
checks are the most valuable ones in there — when that join broke, every screen
still rendered and only the numbers were wrong.

## The merge layer is load-bearing — treat it as frozen

`js/04-merge.js` implements conflict-aware sync: id-keyed unions, deletion
tombstones (30-day pruning), deep object merge, per-week chore arbitration, and
a forward-only `lastGradeSeen` watermark. It has 52 unit tests running the real
shipped functions.

Do not refactor it for style. Change it only to fix a demonstrated sync bug, and
only with a failing test written first.

## Escaping

All three helpers live in `js/05-helpers.js`. Pick by **context**, not by habit:

| Context | Helper |
|---|---|
| Text inside markup — `` `<div>${x}</div>` `` | `escapeHtml(x)` |
| A double-quoted attribute — `` `title="${x}"` `` | `escapeAttr(x)` |
| A JS string inside an inline handler — `` `onclick="fn('${x}')"` `` | `escapeJsAttr(x)` |

The third one is not interchangeable with the second, and this is the subtle
part: **an inline handler is HTML-decoded before it is parsed as JavaScript**, so
`escapeAttr`'s `&#39;` decodes straight back to an apostrophe and closes the
string literal anyway. Only a backslash escape survives, which is what
`escapeJsAttr` adds.

That was a live hole, not a hypothetical one. `ensureBlockId` used to splice 24
characters of the user's **note** into a block id, block ids get interpolated
into `onclick` handlers, and ids also arrive straight off a world-writable
Firestore document — so a note containing an apostrophe ran as JavaScript when
the block was tapped. Fixed at both ends: ids are slugged at the source, and the
~58 handler interpolations go through `escapeJsAttr`.

Better than any of them: **don't interpolate into handlers at all.** Use data
attributes plus a delegated listener, the way `js/13-chores.js` and the money
pages already do. Prefer that for new code.

`npm run check` runs `tests/check-escaping.js`, which fails the build on an
unescaped user-text interpolation in markup and on `escapeAttr` used in a
handler. Mark a genuine constant with a trailing `/* safe: from MNY_STAGES */`
and say which table it came from. `tests/smoke.js` carries the runtime proof
(`hostileNamesCannotBecomeCode`, `escapingMatchesTheDomReference`).

## Writing for children

Kid-facing copy is a product surface, not filler. The rules:

- No performance-identity framing ("the good from the great", "masterpiece").
  Lead with autonomy, curiosity and joy. This was a deliberate correction; do
  not regress it.
- Off days are a valid state. Never build all-or-nothing streaks without a rest
  state, a grace token, and partial-progress celebration.
- Money is a financial-literacy lesson, not a payment for being good.
- Cross-sibling data is collaboration, never a leaderboard, in kid views.
- **Budget: aim for ≤200 visible words per kid screen.** Anything longer is
  reference material and belongs behind a disclosure toggle.

## UI rules

- **Touch targets ≥ 44×44px** on every interactive element, including week
  arrows and small chips. Enforced on the four kid screens by
  `kidScreensMeetTheHouseRules` in `tests/smoke.js`, which probes the real hit
  area with `elementFromPoint` rather than measuring the box — so the
  keep-it-small-and-grow-the-target-with-an-`::after` technique passes, as it
  should. One documented exemption: `.wf-card-check`, whose size is set inline per
  block height and which sits at a card corner, where a 44px target would swallow
  the tap that opens the day.
  Scope target rules to the **component**, not the screen: `.ck-navbtn` is both a
  kid's week arrow and the parent portal's, and screen-scoping it left the portal
  copy at 36×36.
- **Minimum font size 13px**; 15px for anything a child must read to act. Also
  enforced by the same check. Roughly 147 declarations in `css/app.css` compute
  below 13px, but most are print, dark-mode or parent surfaces where the kid floor
  does not apply — the floor is a scoped block at the end of `css/app.css` listing
  only what actually rendered too small.
- **≤200 visible words per kid screen** in its default state. Reference material
  is not banned, it starts collapsed — `mnyPricesOpen`, `ckPrivsOpen` and
  `weekGlanceOpen` are the pattern: closed by default, remembered in
  `localStorage` (never synced state — every state write is a full-document
  upload). `screen-chore` is on a **ratchet** (276) rather than the 200 target: it
  must not grow, tighten it whenever the real number drops, and the target stays
  written down.

## Navigation

**Today is the front door** (`js/31-today.js`). A child lands there and moves
through one nav — **Today · Week · Money · More** — which is a single fixed
element outside the screens, filled by `tdRenderNav`. Do not add a second nav row
to a screen: the six-button shortcut row that used to sit in three different
topbars is exactly how their labels drifted apart, and it is gone.

Today **owns no data and no rules.** Every number it shows is read through the
accessors the owning screen uses, and every row hands off. A second place that
grades a chore or moves money is a second place that can disagree with the first,
and a child has no way to tell which one is lying. If you add something to Today,
add a reader, not a writer.
- Use the design tokens in `css/app.css` (`--space-*`, `--text-*`,
  `--shadow-*`, `--radius-*`). Avoid new inline `style="…"`.
- `--accent` (`#ff7b54`) is decorative only. Anything with white text on it or
  informational accent text uses `--accent-strong` (`#c14a24`) — this is the AA
  contrast fix, don't undo it.
- Never white text on the pastel category colors (all fail contrast).
- Use the app's `.sheet` / `appDialog` patterns, not native `confirm()`/`prompt()`.

## Naming

New user-created Claude skills for this ecosystem use the `HZ-` prefix
(e.g. `HZ-web-app-audit`). Repo files, CSS classes and JS functions keep the
existing conventions: `ct*` for chore-tracker functions, `mny*` for money,
`tg2-*` for the current Day Blocks grid.

## Known trip hazards

- Firebase config lives in **`js/03-sync.js:8`**, not `index.html`. Older docs
  (`README.md`, `SECURITY_TODO.md`) still say `index.html` — they're stale.
- `MULTI_ROLE_REVIEW.md` cites `index.html` line numbers from the pre-split
  monolith. Those line numbers are meaningless now; treat that file as history.
- Every mutation currently triggers a full-document Firestore write with no
  debounce. Be aware before adding anything that mutates in a loop.
- `refreshCurrentScreen()` fires on every remote snapshot, including the echo of
  the device's own write. Don't assume a render happens once.
- GitHub Pages caches aggressively. After a deploy that changes `js/*.js`,
  hard-refresh or bump a `?v=` query on the script tags.
