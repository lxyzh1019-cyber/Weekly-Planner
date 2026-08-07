# Tests

Everything must pass before a change is pushed:

```bash
npm ci      # once
npm test    # check + merge tests + smoke test, stops at the first failure
```

The three parts, individually:

```bash
# 1. Syntax + global-scope checks (no dependencies)
npm run check         # tests/check-syntax.js, tests/check-globals.js

# 2. Sync/merge unit tests (no dependencies, runs the real merge functions)
npm run test:merge    # tests/merge.test.js — 50 assertions, must be 50/50

# 3. Headless-browser smoke test (boots the app, drives the main flows)
npm run test:smoke    # tests/smoke.js — screenshots land in tests/out/
```

## What each one is for

**`check-syntax.js`** runs `node --check` on every `js/*.js`. It replaces this
shell loop, which used to be documented here and is **broken**:

```bash
for f in js/*.js; do node --check "$f" || break; done && echo OK   # BROKEN
```

`break` returns 0, so the loop exits 0 even when a file fails to parse,
`&& echo OK` prints `OK`, and the actual error goes to stderr where anyone
skimming for `OK` misses it. Under CI it is a check that can never fail.

**`check-globals.js`** enforces one declaration per name. All 30 scripts load
into a single global scope, so two `function foo()` declarations mean the
later-loaded file silently wins, and two top-level `let`/`const` of one name is a
hard `SyntaxError` at load that per-file `node --check` cannot see. It covers
`function`, `async function`, and `let`/`const`/`var` including the
comma-separated form (`let a = null, b = null;`).

**`smoke.js`** covers, among much else, the chore -> money hand-off: a chore
finished in the planner reaching the parent's grading queue, and a grade given
in the meeting's step 1 showing up as the same figure on step 3. Those two are
worth keeping green -- when that join broke, every screen still rendered and
only the numbers were wrong, which is the kind of failure nobody notices until
a Sunday goes badly.

`smoke.js` needs a Chromium binary. It auto-detects Playwright browsers under
`/opt/pw-browsers` (Claude Code cloud environments have this pre-installed) or
`~/.cache/ms-playwright` (`npx playwright install chromium`); elsewhere set
`SMOKE_CHROMIUM=/path/to/chrome`.

## CI

`.github/workflows/ci.yml` runs all three on every pull request and on pushes to
`main`, plus nightly, and uploads `tests/out/` as an artifact so a layout
regression is visible in the run itself.

When asking Claude (or anyone) to change this app, ask them to **run these
tests and attach the smoke-test screenshots** before pushing. New features
should come with a new check in `smoke.js`.
