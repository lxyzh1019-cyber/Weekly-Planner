# Tests

Two checks that must pass before any change to `index.html` is pushed:

```bash
# 1. Sync/merge unit tests (no dependencies, runs the real merge functions)
node tests/merge.test.js

# 2. Headless-browser smoke test (boots the app, drives the main flows)
npm install playwright-core   # once
node tests/smoke.js           # screenshots land in tests/out/
```

`smoke.js` needs a Chromium binary. It auto-detects the Playwright browsers
under `/opt/pw-browsers` (Claude Code cloud environments have this
pre-installed); elsewhere set `SMOKE_CHROMIUM=/path/to/chrome`.

Also worth running after any edit:

```bash
# JS syntax check on the inline script
node -e "
const m = require('fs').readFileSync('index.html','utf8')
  .match(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/);
require('fs').writeFileSync('/tmp/wp.js', m[1]);
" && node --check /tmp/wp.js && echo OK
```

When asking Claude (or anyone) to change this app, ask them to **run these
tests and attach the smoke-test screenshots** before pushing. New features
should come with a new check in `smoke.js`.
