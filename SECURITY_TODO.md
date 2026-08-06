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

## 4. Treat the PIN as UX only
Even after the above, keep the parent PIN as a convenience lock for shared
family devices — never as the thing that protects data. Money editing, backup
export, and parent-only views should be gated by the *authenticated identity*,
not the PIN.

## Related (not security, but same sync surface)

- **The merge layer is no longer last-write-wins.** This section used to say two
  devices editing in the same window could drop one side's change. That was true
  of the old wholesale-replace merge and is **no longer accurate**:
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
