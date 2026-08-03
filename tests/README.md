# Tests

Two checks that must pass before any change to `index.html` is pushed:

```bash
# 1. Sync/merge unit tests (no dependencies, runs the real merge functions)
node tests/merge.test.js

# 2. Headless-browser smoke test (boots the app, drives the main flows)
npm install playwright-core   # once
node tests/smoke.js           # screenshots land in tests/out/
```

`smoke.js` covers, among much else, the chore -> money hand-off: a chore
finished in the planner reaching the parent's grading queue, and a grade given
in the meeting's step 1 showing up as the same figure on step 3. Those two are
worth keeping green -- when that join broke, every screen still rendered and
only the numbers were wrong, which is the kind of failure nobody notices until
a Sunday goes badly.

`smoke.js` needs a Chromium binary. It auto-detects the Playwright browsers
under `/opt/pw-browsers` (Claude Code cloud environments have this
pre-installed); elsewhere set `SMOKE_CHROMIUM=/path/to/chrome`.

Also worth running after any edit:

```bash
# JS syntax check on every app script
for f in js/*.js; do node --check "$f" || break; done && echo OK
```

When asking Claude (or anyone) to change this app, ask them to **run these
tests and attach the smoke-test screenshots** before pushing. New features
should come with a new check in `smoke.js`.
