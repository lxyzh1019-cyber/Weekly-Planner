# Sync and offline behaviour — findings

| | |
|---|---|
| **Prompted by** | A third-party (ChatGPT) review proposing eleven sync policy decisions and an eight-item "data-integrity release" |
| **Verified against** | `3f75a2c`, line by line |
| **Status** | Findings. The fixes are `95e3ce5`, `51142dd` and `92e4905`. |

This is the record of what the review got right, what was already built here,
and — the part worth keeping — why this repo's own tests passed over four
defects it had written itself.

## The short version

The review's eleven decisions split three ways.

**About half was already built and tested here.** Restating it as an open
recommendation was reasonable — it was reasoning from a description, not from
the code — but no work followed from those rows.

**Four items were real and unfixed**, and one of them (offline edits to the same
record silently discarding a version) was the sharpest thing on the list.

**Three defects nobody named were worse than most of what was named**, and one
of those loses real work in the ordinary weekly use of the app rather than in an
edge case.

## Already built, before this review

| Claim | Where it already lives |
|---|---|
| Use `America/Edmonton` for all day/week calculations | `APP_TIMEZONE`, `toDayKeyInZone`, `nowMinutesInZone` — `js/05-helpers.js:1110-1141`; `todayKey()` and `tdNowMin()` both route through them |
| Handle DST automatically | Every day/week step uses `setDate` or `Math.round` of a difference; both absorb a 23- or 25-hour day. One exception found and fixed (`mmOpenNextWeek`) |
| Order writes by a trusted clock, not the device's | `syncNow` / `noteServerTime` — `js/03-sync.js:81-101`, learned from the server's echo of this device's own write; two unit tests at `tests/merge.test.js:410-418`. `AUDIT.md:240` named it; it shipped in `0ad103a` |
| Merge different records automatically | The whole of `js/04-merge.js` — id-keyed unions, per-week arbitration, deep object merge |
| Records without timestamps must never override newer stamped ones | `js/04-merge.js:19-20` — an unstamped record falls back to `0` and always loses |
| "Synced" only after Firebase acknowledges | `js/03-sync.js:161-166` gates the label on `remoteTs >= lastLocalWriteAt`, with a distinct pending message |
| Deletions need explicit tombstones | `tombstoneBlockIds` / `blockTombstoned` / `mergeTombstones`, with scoped keys per collection |

## Real, and now fixed

### Three shared stores were not arbitrated at all — the worst finding

`mergeSharedState` merges `state.shared` as `{ ...ls, ...rs, <named keys> }`. A
key it does not name is **replaced wholesale by the remote copy on every
snapshot**, so a local edit not yet pushed is gone, silently.

- **`parentDayConfirm`** — which days a grown-up has reviewed. Two adults working
  through one Sunday meeting on an iPad and a phone: whichever snapshot landed
  last erased the other's reviews. `canCloseWeek` reads it, so the week then
  refused to close with nothing on screen to say why. This is the ordinary way
  the meeting is used, not an edge case.
- **`builtInRoutineOverrides`** — a parent's routine edits, and `delete` could not
  propagate either.
- **`schoolCal`** — the family's imported calendar, a nested object replaced whole.

Not on the review's list.

### A removal could not be expressed

`weeksClosed` lives inside `state.shared.chore`, merged by `deepMergeObj`, which
iterates `Object.keys(remote)`. **Absence is the one thing that cannot express.**
Reopening a week is a removal, so it never left the device that made it: the
close always won and `reflIsLocked` re-locked both girls' reflections behind it.

The meeting's **Undo** removes from seven more of these maps and had the same
fate. The wallet went back, because profiles are arbitrated per record, while the
week still read as settled on the other device — a half-undo, and the half that
was wrong was the money's own paperwork. Also not on the list.

The review's recommendation here (`state: "open"` with a new timestamp) was the
right instinct. The implementation went one level up instead: `ctStampWeekState`
hands a stamped week to the newer side whole across all eight maps, the keys it
does *not* have included, which fixes reopen, the Undo and the parent's week
reset with one mechanism. An **unstamped** week keeps the grow-only union
exactly as before, so no stale device can un-record a meeting that predates it.

### The clock fix was never finished

`syncNow` existed; five merge-relevant stamps still called `Date.now()`. The
tombstone one was the sharp edge: a tombstone stamped raw, compared against a
record stamped corrected, means that on a device whose clock runs **behind** the
server the tombstone is older than the block it is meant to delete — so
`blockTombstoned`'s `>=` is false and **the delete silently does not stick**,
anywhere, for anyone. The review's "convert every merge-relevant `Date.now()`"
was correct and this is what it was pointing at, though not with this
consequence attached.

### Same record, both offline — one version discarded silently

Correct, and the sharpest item on the list. The owner's objection to the first
proposed fix was the decisive one: *"new and old are just timestamps; this does
not mean which one contains the correct information."* That is right, and it is
why newest-wins could not be the final word.

Resolved by making detection **causal rather than chronological** — see
`recordsDiverged` and the CLAUDE.md section — so both versions survive, the
newer one displays (the girls see no warning and nothing waits on an adult), and
a parent chooses on content. Only a provable divergence is ever raised: ask about
every ordinary catch-up sync and a parent learns to dismiss the question, which
is worse than not asking.

### Backup Replace was device-local

Correct. Replace pushed, every other device **merged** that snapshot, and their
newer-stamped records won arbitration and went straight back up — the dialog
promised "make this device match the backup exactly" and delivered exactly that,
one device, until the next sync. `dataEpoch` fixes it, as the review proposed.

### Smaller, all verified

- `mmOpenNextWeek` stepped a week with `+ 7 * 864e5`; a week is 169 hours when
  the clocks go back, so once a year "open next week" opened the week you were
  already on.
- The money audit log dated entries with `toISOString`, filing anything after 5pm
  Edmonton under tomorrow.
- An exact stamp tie kept `prev`, which is a different record depending on which
  device you stand on: two devices diverged permanently and the document went to
  whichever pushed last.
- Tombstone pruning measured age against the device clock and ran only as a side
  effect of a *new* delete — so a family that deleted nothing pruned nothing, and
  a tablet set a year fast could empty the map and resurrect the family's
  deletes. It prunes by count now and asks no clock anything.
- CI never ran `npm run test:xp`. Test counts in `CLAUDE.md` and
  `tests/README.md` were stale in three places.

## Declined

**Retaining tombstones indefinitely "until the related history is archived".**
There is no archiving here, and the document has a hard 1 MiB ceiling it already
prunes nothing else against. The real defects were the clock and the trigger, not
the window. Fixed those and made the cap a count.

## Why this repo's own QA missed four of its own defects

The more useful half of this document. These are defects in code written here, by
sessions with a test suite, that 311 checks passed over.

**1. The freeze was read as "do not think about merging."** `CLAUDE.md` says
`js/04-merge.js` is frozen. Four keys were then added to `state.shared` — each
with its own feature tests, none with a merge decision. Adding a key to
`state.shared` *is* a merge-layer decision; the freeze made the file that would
have prompted it feel out of bounds.

**2. A test written beside the code shares its blind spot.**
`tests/merge.test.js:410` asserts *"a fast clock would win an exchange it should
lose (the bug)"* — the suite documents the defect as expected behaviour, because
the fix had landed in a different file. Five of eleven stamps were converted and
the work was recorded as finished. A test cannot check an assumption its author
did not know they were making.

**3. Every check ran on one device.** `tests/smoke.js` blocks every Firebase host
at the network layer. "Two devices disagree" was not under-tested, it was
**structurally invisible** to the harness — and adding a check inside an existing
harness is cheap while building a new harness is not.

**4. Green has already lied here twice**, and both are recorded in `CLAUDE.md`:
the `for … || break` loop that exits 0 on failure, and the eight smoke checks
that returned a truthy findings array and were counted as passes. The suite's
silence about sync was the same shape, and was not evidence.

**5. The gap was documented and then not treated as work.**
`AUDIT-PRODUCT.md:148-157` already specifies the exact matrix — *"online; offline
edit then reconnect; two devices editing different records; conflicting edit to
same record."* It was written here. Twelve feature-scoped sessions passed without
building it.

An outside reader had one structural advantage worth naming: no memory of having
handled it. It asked the general question — *what happens when two devices are
offline?* — where this repo's reviewer read `syncNow()` and recorded "clock:
done". Familiarity is what cost the most.

## What was built so this does not recur

Neither is a resolution to audit harder. A reviewer with the author's priors
keeps missing the author's blind spots, so both fixes are mechanical.

**`tests/check-shared-merge.js`** (in `npm run check`) fails the build on a
`state.shared` key with no merge decision, and on a `delete` inside
`state.shared.chore` with no stamp. All four defects would have been build
failures the moment they were typed. It caught `dataEpoch` during this very
release, which is the proof it works on new code and not only on old.

**The two-device harness** in `tests/merge.test.js` — `makeDevice`, `on`,
`receive`, `sync`. Eight of the twelve first checks failed against `main`; the
three that passed there are the controls. `mergeSharedState` was lifted out of
`js/03-sync.js` so the tests drive the real composition: **a merge reachable only
from a browser is a merge no unit test can hold.**

Two design errors were caught by that harness rather than by reasoning — a
resolution that raised a second conflict about the question it had just settled,
and a chooser whose two cards read identically. Both would have shipped.

## Deliberately out of scope

Firebase Auth and deploying `firestore.rules` (`SECURITY_TODO.md` owns the
order), history archiving, and any visual change beyond the conflict chooser and
the Today copy.
