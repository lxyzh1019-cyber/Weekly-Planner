# Security follow-ups (server-side — not fixable in `index.html` alone)

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
`index.html`). Every deployment shares that one doc — there is no family scoping.
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
- **Last-write-wins merge** (`mergeRemoteState` / `pushToFirebase`): two devices
  editing in the same window can drop one side's change. Acceptable for one
  family; revisit (per-field timestamps or a real merge) before multi-user use.
