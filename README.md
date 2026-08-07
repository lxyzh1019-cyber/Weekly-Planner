# Weekly-Planner
Help kids to manage the time

## Running the checks

No build step — `index.html` loads `js/01-*.js` … `js/99-main.js` as plain
classic scripts. To verify a change:

```bash
npm ci
npm test            # syntax + global-scope guard, merge tests, smoke test
```

Or individually:

```bash
npm run check       # node --check on every js/*.js, plus the duplicate-name guard
npm run test:merge  # 50 assertions against the real merge functions
npm run test:smoke  # boots the app in headless Chromium; screenshots in tests/out/
```

`npm run test:smoke` needs a Chromium binary. It finds one automatically under
`/opt/pw-browsers` or `~/.cache/ms-playwright` (install with
`npx playwright install chromium`); otherwise set `SMOKE_CHROMIUM=/path/to/chrome`.

See `CLAUDE.md` for the architectural constraints these checks protect, and
`tests/README.md` for what the smoke suite covers.

## Firebase / Firestore sync setup

This app syncs planner state through **Cloud Firestore** (not Realtime Database).

### Required Firebase configuration
- Firebase project configured in **`js/03-sync.js`** (`FIREBASE_CONFIG`, at the
  top of the file). This used to live in `index.html`; it moved when the monolith
  was split into `js/`.
- Firestore enabled in that Firebase project.
- App writes to (`FS_COLLECTION` / `FS_DOC_ID`, also near the top of
  `js/03-sync.js`):
  - collection: `weekly_planner`
  - document: `shared_state`

### Required Firestore rules (starter)
Use these rules to allow app sync while setting up:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /weekly_planner/{docId} {
      allow read, write: if true;
    }
  }
}
```

**This starter rule is fully open — anyone who can reach the project can read and
write the family's data.** It is a setup convenience, not a deployment target.
See `SECURITY_TODO.md` for what to replace it with, and note that the rules
actually deployed to the project have not been verified against this file.
