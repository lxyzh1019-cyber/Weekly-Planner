# tools/

One-off operational tools. Not part of the app, not loaded by `index.html`.

## `cleanup-ci-artifacts.html`

Removes the test data that GitHub Actions run
[#1](https://github.com/lxyzh1019-cyber/Weekly-Planner/actions/runs/31129824562)
wrote into the live planner on **6 Aug 2026, 23:07:03–23:09:40 UTC**.

That run executed `tests/smoke.js` at commit `619c1720` with open network. There
is one Firestore document and no test document, so the suite loaded the family's
real planner and pushed its fixtures back. Runs #2 and #3 ran `129432b`, which
blocks Firebase at the network layer and aborts if it ever reaches it.

### Before you run it

Open the planner on **any device that has not synced since 6 Aug** — an iPad or
phone that has been closed. Every list merges as a union, so anything the run
emptied is pushed back just by opening it. The cleaner does not restore; it only
removes.

### Running it

Serve the repo and open the tool over `http://`:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/tools/cleanup-ci-artifacts.html
```

Opening the file directly with `file://` may also work, but the page's origin is
`null` there, which some Firestore transports reject. **Neither path has been
tested against the live database** — doing so would mean reading the family's
real document, which is exactly what this tool exists to clean up after. If the
scan reports a connection error, try the other one.

Then: **Scan** (read-only) → review → **Download backup** (required) → type
`REMOVE`. It writes once, at the end, so a failure part-way leaves the document
untouched.

### How it decides what to remove

A list of fixture ids is not enough — roughly a third of what the suite writes is
randomly named (`mrl-…`, `mrv-…`, `box-…`). But every generated id in this app is
`prefix + Date.now().toString(36) + random` (`js/18-rules.js:231` and ~20 more),
so the id itself encodes its creation millisecond. Detection is:

1. a timestamp inside the incident window — catches the randomly-named ones;
2. a known fixture id;
3. a known fixture name.

The catalogue for 2 and 3 was derived, not guessed: check out `619c1720`, run its
smoke suite with Firebase blocked, record every id and name written to state, and
subtract everything that also appears in `js/`.

Records matching an id the app *also* lets a parent create — a `bike` debt, a
`water` chore — are surfaced but never pre-ticked. Only the clock decides those,
and a human reads them.

### What it cannot fix

The starter chore group may have been reverted to factory settings. On an empty
profile the app seeds `grp-starter` with **no timestamp** (`js/13-chores.js:1249`),
and `mergeArrayById` breaks a 0-vs-0 tie in favour of the local copy — so the CI
browser's factory default won over the family's and was pushed up. If that group
was customised, the edit is gone and nothing can recover it. Step 2 of the tool
tells you which case you are in.

### Tests

`npm run test:cleanup` (`tests/cleanup-tool.test.js`) runs the detection and
removal against a synthetic document that mixes every fixture with real records
shaped to look identical — same id prefixes, same names, differing only in their
timestamps. It asserts that every fixture is removed, that no real record is
touched, that tombstones land in the scope each collection merges under, and that
a second scan finds nothing. It reaches no network.

Delete this tool and its test once the cleanup is done.
