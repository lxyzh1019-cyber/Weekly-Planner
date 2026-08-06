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
# 1. Syntax check every module
for f in js/*.js; do node --check "$f" || break; done && echo OK

# 2. Merge-layer unit tests (50 checks, must be 50/50)
node tests/merge.test.js

# 3. Headless smoke test — boots the app, drives the main flows
npm install playwright-core     # once
node tests/smoke.js             # screenshots land in tests/out/
```

`smoke.js` auto-detects Chromium under `/opt/pw-browsers`; elsewhere set
`SMOKE_CHROMIUM=/path/to/chrome`.

New features ship with a new check in `smoke.js`. The chore→money hand-off
checks are the most valuable ones in there — when that join broke, every screen
still rendered and only the numbers were wrong.

## The merge layer is load-bearing — treat it as frozen

`js/04-merge.js` implements conflict-aware sync: id-keyed unions, deletion
tombstones (30-day pruning), deep object merge, per-week chore arbitration, and
a forward-only `lastGradeSeen` watermark. It has 50 unit tests running the real
shipped functions.

Do not refactor it for style. Change it only to fix a demonstrated sync bug, and
only with a failing test written first.

## Escaping

Any user-supplied string interpolated into an `innerHTML` template **must** go
through `escapeHtml()` (text context) or `escapeAttr()` (attribute context).
Activity names, block notes, chore names, goal names, and kid feedback are all
user-editable.

This is currently inconsistent — see AUDIT item P1-2. When you touch a render
function, fix its escaping as you pass through.

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
  arrows and small chips. The app currently fails this almost everywhere; don't
  add new violations.
- **Minimum font size 13px**; 15px for anything a child must read to act.
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
