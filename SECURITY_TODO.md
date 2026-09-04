# Security follow-ups (server-side — not fixable in client code alone)

> **Deployed rules unverified as of 2026-08-06.** The open starter rule quoted in
> `README.md` is what the repo documents, *not* a confirmed reading of what is
> live on the `chore-tracker-a461b` project. Nobody has checked the Firestore
> console or done an unauthenticated read against the document. Until someone
> does, treat the rules below as *desired* state and the exposure as *possible*
> rather than established.

The parent gate in this app is a **soft child-lock, not a security boundary.**
The client-side improvements already made (parent-configurable, per-family PIN
stored in shared state) stop the PIN from being a hardcoded literal, but anyone
who can read the page source or the synced Firestore document can still see it.
Real enforcement requires backend work:

## 1. Authenticate families (Firebase Auth)
Add Firebase Authentication (email-link or Google sign-in is enough for a family
app) so each family has an identity, instead of every client sharing one
anonymous, wide-open document.

## 2. Per-family document instead of one global doc
Today the app reads/writes a **single global document**:
`FS_COLLECTION = 'weekly_planner'`, `FS_DOC_ID = 'shared_state'` (in
**`js/03-sync.js`**, near the top — these moved out of `index.html` when the
monolith was split). Every deployment shares that one doc — there is no family
scoping.
Key the document by the authenticated family (e.g. `weekly_planner/{familyUid}`)
so families cannot read or clobber each other's data.

## 3. Scoped Firestore security rules
The starter rule in `README.md` is `allow read, write: if true` — fully open.
Replace it with rules that require an authenticated user and restrict access to
that user's own family document, e.g.:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /weekly_planner/{familyUid} {
      allow read, write: if request.auth != null && request.auth.uid == familyUid;
    }
  }
}
```

## Runbook — the order this has to happen in

`firestore.rules` in the repo root is the intended target. It is **committed but
not deployed**, and deploying it out of order locks the app out of its own data,
because every read and write the client makes today is unauthenticated.

The rules and the client change are a single unit. Do not publish one without
the other.

1. **Export a full backup first.** Parent Dashboard → 🗄️ Backup → *Export full
   backup*. Everything below is recoverable from that file and nothing below is
   recoverable without it. Keep it off the device.
2. **Read the current state before changing it.** Firebase console →
   Firestore → Rules tab: record what is actually deployed today, and note the
   current size of `weekly_planner/shared_state` from the Data tab. As of
   2026-08-06 nobody has done this — see the note at the top of this file.
3. **Add Firebase Auth** (§1 above) and get a uid in the client, without yet
   changing where the document lives. Verify the app still works.
4. **Move the document.** Copy `weekly_planner/shared_state` to
   `weekly_planner/{uid}`. Leave the original in place until step 6 passes.
5. **Point the client at the new path** — `FS_DOC_ID` becomes the uid rather
   than the `'shared_state'` constant (`js/03-sync.js`), and `initFirebase`
   waits for an auth state before subscribing.
6. **Publish `firestore.rules`.** Then verify, in this order: the app still
   reads and writes; a signed-out browser gets permission-denied; a second
   family's uid cannot read the first's document.
7. **Only then delete the old `shared_state` document,** and re-verify from a
   fresh browser session.

If step 6 fails, revert the rules first — the client can keep running against
the open rules while the auth path is fixed.

## 4. Treat the PIN as UX only
Even after the above, keep the parent PIN as a convenience lock for shared
family devices — never as the thing that protects data. Money editing, backup
export, and parent-only views should be gated by the *authenticated identity*,
not the PIN.

## Related (not security, but same sync surface)

- **The merge layer is no longer last-write-wins.** This section used to say two
  devices editing in the same window could drop one side's change. That was true
  of the old wholesale-replace merge and is **no longer accurate**:
  **Superseded in part — see `AUDIT-SYNC.md`.** The caveats below about the
  device clock and about `mergeRemoteState` were fixed after this was written:
  arbitration stamps come from `syncNow` throughout, four unarbitrated shared
  keys were closed, and `tests/check-shared-merge.js` now fails the build on a
  fifth. The one remaining caveat here that is still open is the shared
  `shared_state` document, which is the Firebase Auth work this file owns.

  `mergeRemoteState` (`js/03-sync.js`) now runs the conflict-aware layer in
  `js/04-merge.js` — id-keyed unions (`mergeArrayById`), deletion tombstones with
  30-day pruning (`mergeTombstones`), per-week chore arbitration, a forward-only
  `lastGradeSeen` watermark, and a recount of derived progress from the merged
  weeks rather than either side's copy. It has 50 unit tests exercising the real
  shipped functions (`npm run test:merge`). Treat it as load-bearing and frozen;
  see `CLAUDE.md`.
- **Remaining real caveats on that surface:**
  - Merge arbitration timestamps come from each device's own `Date.now()`, so a
    device with a wrong clock can win an exchange it should have lost.
  - All families share one document, so scoping is still the open problem — see
    §2 above.
  - Every mutation writes the entire state tree with no debounce, and the
    per-document Firestore ceiling is 1 MiB with week history never pruned.
