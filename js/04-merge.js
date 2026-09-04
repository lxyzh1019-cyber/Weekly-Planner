// Weekly-Planner — pure merge/tombstone layer (unit-tested by tests/merge.test.js).
// Extracted verbatim from index.html (classic script, global scope).
/* Union two id-keyed arrays, newest copy of each id wins. `tombScope` names
   the collection ('sa:', 'ca:jenn:', 'task:'…) so deletions recorded as
   scoped tombstones stick instead of resurrecting via the union. */
/* Which of two versions of one record wins.

   The stamp decides it, as it always has. What is new is the TIE: this used to
   be `nextTs > prevTs ? item : prev`, which keeps LOCAL when the stamps are
   equal — and "local" is a different record on each device. Two devices that
   stamp the same millisecond therefore each kept their own copy and stayed
   that way, with the document going to whichever pushed last. A tie has to be
   broken by something both devices can compute and agree on: the write's own
   id, and failing that the record's. Neither is meaningful as an ordering; the
   point is only that it is the SAME ordering everywhere. */
function mergePickNewer(prev, next, prevTs, nextTs) {
  if (nextTs !== prevTs) return nextTs > prevTs ? next : prev;
  const a = String((prev && (prev.opId || prev.id)) || '');
  const b = String((next && (next.opId || next.id)) || '');
  return b > a ? next : prev;
}
function mergeArrayById(localArr, remoteArr, tombScope) {
  const map = new Map();
  (localArr || []).forEach(item => {
    if (!item || item.id == null) return;
    map.set(item.id, item);
  });
  (remoteArr || []).forEach(item => {
    if (!item || item.id == null) return;
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
      return;
    }
    const prevTs = prev.updatedAt || prev.createdAt || 0;
    const nextTs = item.updatedAt || item.createdAt || 0;
    map.set(item.id, mergePickNewer(prev, item, prevTs, nextTs));
  });
  let out = Array.from(map.values());
  if (tombScope != null) {
    const t = state.shared && state.shared.tombstones;
    if (t) out = out.filter(item =>
      !(t[tombScope + item.id] && t[tombScope + item.id] >= (item.updatedAt || item.createdAt || 0)));
  }
  return out;
}

/* ── A conflict is two people editing one thing without seeing each other ──

   Whole-record arbitration keeps the higher stamp and drops the other outright.
   That is the right DISPLAY rule — something has to be on screen, and the girls
   must never be shown a warning about a sync — but it is the wrong final answer,
   because a timestamp orders two writes and says nothing about which one holds
   the better information. The loser used to be discarded with no trace.

   Now it is kept, and a grown-up decides. Three questions, in order:

     1. Is this a conflict at all? Only if neither version descends from the
        other (see markItemUpdated, js/03-sync.js). An ordinary catch-up sync —
        this device simply has not seen that edit yet — is a fast-forward and
        nobody is asked anything. Getting this wrong in the other direction is
        what makes conflict prompts useless: ask about everything and they are
        dismissed without being read.
     2. What is displayed meanwhile? The newer stamp, exactly as before. Nothing
        about the kid screens changes and nothing is blocked waiting on an adult.
     3. Where does the loser go? Into state.shared.conflicts, whole.

   The id is derived from the store, the key and BOTH opIds, so the two devices
   independently generate the SAME id for the same disagreement and the entry
   merges to one row instead of two. */
const CONFLICT_MAX = 40;
function conflictId(store, key, aId, bId) {
  // Sorted, so the id does not depend on which device is doing the merging.
  const pair = [String(aId || '?'), String(bId || '?')].sort();
  return 'cf:' + store + ':' + key + ':' + pair[0] + ':' + pair[1];
}
/* Can we PROVE these two diverged? Anything less is treated as no conflict —
   a false negative loses nothing that was not already lost, while a false
   positive trains a parent to ignore the question. */
function recordsDiverged(l, r) {
  if (!l || !r) return false;
  const lo = l.opId, ro = r.opId;
  if (!lo || !ro) return false;          // pre-upgrade record: nothing provable
  if (lo === ro) return false;           // the same version
  if (r.baseOpId && r.baseOpId === lo) return false;   // remote edited from local
  if (l.baseOpId && l.baseOpId === ro) return false;   // local edited from remote
  return true;
}
/* Keep the version that is NOT being displayed, so it can be chosen later. */
function recordConflict(store, key, local, remote, shownOpId) {
  if (!state.shared) state.shared = {};
  if (!Array.isArray(state.shared.conflicts)) state.shared.conflicts = [];
  const list = state.shared.conflicts;
  const id = conflictId(store, key, local.opId, remote.opId);
  if (list.some(c => c && c.id === id)) return;        // already known, either side
  list.push({
    id, store, key,
    at: mergeNow(),
    // updatedAt so the row merges by id like everything else, and so a
    // resolution made on one device wins over the unresolved copy on the other.
    updatedAt: mergeNow(),
    shownOpId: shownOpId || null,
    versions: [clonePlain(local), clonePlain(remote)],
  });
  // Bounded. Resolved rows go first, then the oldest — a conflict nobody has
  // answered is worth more than one somebody has.
  if (list.length > CONFLICT_MAX) {
    list.sort((a, b) => (a.resolvedAt ? 0 : 1) - (b.resolvedAt ? 0 : 1) || (a.at || 0) - (b.at || 0));
    list.splice(0, list.length - CONFLICT_MAX);
  }
}
function clonePlain(v) {
  try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
}
/* Arbitrate one whole record, and remember the loser if the two genuinely
   diverged. `store` and `key` are what the parent screen shows to say WHICH
   disagreement this is, so they have to be readable: 'reflection', 'weekPlan'.
   Returns the version to display. */
function mergeWholeRecord(store, key, local, remote, stampOf) {
  if (local == null) return remote;
  if (remote == null) return local;
  const ts = stampOf || (rec => Number(rec && rec.updatedAt) || 0);
  const shown = mergePickNewer(local, remote, ts(local), ts(remote));
  if (recordsDiverged(local, remote)) {
    recordConflict(store, key, local, remote, shown.opId);
  }
  return shown;
}
/* Has a grown-up dealt with this one? */
function conflictIsOpen(c) { return !!c && !c.resolvedAt; }
function openConflicts() {
  return ((state.shared && state.shared.conflicts) || []).filter(conflictIsOpen);
}

/* ── Deletion tombstones ──
   mergeArrayById is a union: without a record of the delete, a removed block
   comes straight back from any device still holding it (this is what broke
   "remove series"). Deletes record a tombstone in shared state; the merge
   drops any incoming copy older than the tombstone. */
function ensureTombstones() {
  if (!state.shared) state.shared = {};
  if (!state.shared.tombstones) state.shared.tombstones = {};
  return state.shared.tombstones;
}
/* The corrected clock (js/03-sync.js), or the raw one in Node and before the
   first server echo. A tombstone is compared against the records it deletes and
   those are stamped with syncNow, so stamping tombstones with Date.now() meant
   comparing two different clocks: on a device running BEHIND the server the
   tombstone came out older than the record it was meant to remove, and
   blockTombstoned's `>=` was false — so the delete silently did not stick,
   anywhere, for anyone. */
function mergeNow() {
  return (typeof syncNow === 'function') ? syncNow() : Date.now();
}
/* Pruning is by COUNT, not by age, and that is the whole point.

   The old rule dropped anything older than 30 days measured against
   `Date.now()`. Every part of that was a hazard. It ran only as a side effect
   of recording a NEW delete, so a family that deleted nothing for a year pruned
   nothing. A pruned entry came straight back from any remote that still held
   it. And measuring against a device's own clock hands that clock the power to
   empty the map: a tablet set a year fast — or any device before its first
   server echo, when syncNow is still the raw clock — prunes every tombstone it
   holds, pushes the emptied map, and resurrects the family's deleted blocks.

   A count cap has none of those failure modes, because it asks no clock
   anything. It only ever drops the OLDEST entries, and only once there are more
   than a family could plausibly have: 2000 of them is about 60 KB against a
   1 MiB document, and several years of ordinary deleting. An entry that has
   survived is one nothing can resurrect, which is the job.

   Ordering still uses the stamps, but a wrong stamp can now only misplace one
   entry in the queue rather than empty the queue. */
const TOMBSTONE_MAX = 2000;
function pruneTombstones(t) {
  const ids = Object.keys(t);
  if (ids.length <= TOMBSTONE_MAX) return;
  ids.sort((a, b) => (Number(t[b]) || 0) - (Number(t[a]) || 0));   // newest first
  ids.slice(TOMBSTONE_MAX).forEach(id => { delete t[id]; });
}
function tombstoneBlockIds(ids) {
  const t = ensureTombstones();
  const now = mergeNow();
  (ids || []).forEach(id => { if (id != null) t[id] = now; });
  pruneTombstones(t);
}
/* Tombstone ids in a named collection (scope must match the mergeArrayById
   call for that collection, e.g. 'sa:' for sharedActivities). */
function tombstoneIds(scope, ids) {
  tombstoneBlockIds((ids || []).map(id => scope + id));
}
function blockTombstoned(b) {
  const bTs = b.updatedAt || b.createdAt || 0;
  const t = state.shared && state.shared.tombstones;
  // A copy edited AFTER the delete wins (someone deliberately revived it).
  if (t && t[b.id] && t[b.id] >= bTs) return true;
  // "Remove ALL in series" also tombstones the seriesId itself (prefixed key),
  // so members this device never saw can't sneak back in from another device.
  if (b.seriesId && t && t['sr:' + b.seriesId] && t['sr:' + b.seriesId] >= bTs) return true;
  return false;
}
function mergeTombstones(remoteTombs) {
  const t = ensureTombstones();
  Object.entries(remoteTombs || {}).forEach(([id, ts]) => {
    if (!t[id] || ts > t[id]) t[id] = ts;
  });
  pruneTombstones(t);
}

/* ── Deep merge for nested plain objects ──
   The old `{...lp, ...rp}` replaced nested trees (progress, chore checkmarks,
   wallet, moods) wholesale with the remote copy, clobbering local edits. This
   merges key-by-key and only lets remote win at scalar/array leaves. */
function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function deepMergeObj(local, remote) {
  if (remote === undefined) return local;
  if (!isPlainObject(local) || !isPlainObject(remote)) return remote;
  const out = { ...local };
  Object.keys(remote).forEach(k => {
    out[k] = (isPlainObject(local[k]) && isPlainObject(remote[k]))
      ? deepMergeObj(local[k], remote[k])
      : (remote[k] === undefined ? local[k] : remote[k]);
  });
  return out;
}

/* Per-kid chore checkmarks: deep-merge unions checks from both sides, but a
   deliberate UNcheck must also be able to win. Chore edits stamp a per-week
   updatedAtByWeek; the strictly-newer side takes that week's whole tree. */
function mergeChoreState(localChore, remoteChore) {
  const lc = localChore || {};
  const rc = remoteChore || {};
  const out = deepMergeObj(lc, rc);
  const lts = lc.updatedAtByWeek || {};
  const rts = rc.updatedAtByWeek || {};
  out.updatedAtByWeek = {};
  new Set([...Object.keys(lts), ...Object.keys(rts)]).forEach(wk => {
    const l = lts[wk] || 0, r = rts[wk] || 0;
    out.updatedAtByWeek[wk] = Math.max(l, r);
    const src = r > l ? rc : (l > r ? lc : null);
    if (!src) return; // tie / no stamps → keep the deep-merged union
    ['mandatoryByWeek', 'optionalByWeek', 'mandatoryAutoByWeek'].forEach(f => {
      if (src[f] && src[f][wk] !== undefined) {
        if (!out[f]) out[f] = {};
        out[f][wk] = src[f][wk];
      }
    });
  });
  return out;
}

/* Graded chores / personal chores / sick days, keyed by week. Same hazard as
   mergeChoreState: a deep-merge union can express "graded" but not a REGRADE
   downward (3 → 1) or an erased grade, because the union keeps the higher
   remote leaf. Each edit stamps earningsUpdatedAtByWeek, and the strictly-newer
   side takes that whole week. */
function mergeEarnings(localEarn, remoteEarn, localStamps, remoteStamps) {
  const le = localEarn || {}, re = remoteEarn || {};
  const out = deepMergeObj(le, re);
  const lts = localStamps || {}, rts = remoteStamps || {};
  const stamps = {};
  new Set([...Object.keys(lts), ...Object.keys(rts)]).forEach(wk => {
    const l = lts[wk] || 0, r = rts[wk] || 0;
    stamps[wk] = Math.max(l, r);
    const src = r > l ? re : (l > r ? le : null);
    if (src && src[wk] !== undefined) out[wk] = src[wk];   // tie keeps the union
  });
  return { earnings: out, stamps };
}

/* shared.chore mixes three kinds of data: set-only maps that only ever grow
   (goalBonusByWeek, groupPayoutsFired, moneySnapshots, finalizedWeeks,
   moneyLedger, meetingsHeld, meetingsMet — a union is correct; a ledger entry
   is written once when the week is recorded and never edited, so two devices
   can only ever agree, and two parents cannot disagree about whether a meeting
   happened), an id-keyed array (groups), and per-week
   goals that can be *changed* on two devices. Merging the whole thing with
   deepMergeObj let remote win at every leaf, silently dropping a group added on
   the other device or a goal edit that hadn't synced yet. Keep the deep-merge
   union as the base, but arbitrate groups by id (+ 'grp:' tombstones for
   deletes) and goalsByWeek by a per-week timestamp, mirroring mergeChoreState. */
/* The eight week-keyed maps arbitrated by weekStateUpdatedAt — see the block
   inside mergeSharedChore. Named here so the merge and the writers that stamp
   (ctStampWeekState, js/13-chores.js) are reading one list. */
const CHORE_WEEK_STATE_MAPS = ['weeksClosed', 'finalizedWeeks', 'xpAwardedWeeks',
  'moneyLedger', 'meetingsHeld', 'meetingsMet', 'groupPayoutsFired',
  'moneySnapshots'];

function mergeSharedChore(localChore, remoteChore) {
  const lc = localChore || {};
  const rc = remoteChore || {};
  const out = deepMergeObj(lc, rc);
  // Groups: union by id so concurrent adds both survive; newest edit wins;
  // a delete recorded as a 'grp:' tombstone stays deleted instead of resurrecting.
  out.groups = mergeArrayById(lc.groups, rc.groups, 'grp:');
  // Weekly goals: the strictly-newer side takes that whole week, so an edit that
  // lowers or clears a goal wins over a stale copy (a plain union can't express
  // a removal). A tie / unstamped week keeps the deep-merged union already in out.
  const lts = lc.goalsUpdatedAtByWeek || {};
  const rts = rc.goalsUpdatedAtByWeek || {};
  out.goalsUpdatedAtByWeek = {};
  if (!out.goalsByWeek) out.goalsByWeek = {};
  new Set([...Object.keys(lts), ...Object.keys(rts)]).forEach(wk => {
    const l = lts[wk] || 0, r = rts[wk] || 0;
    out.goalsUpdatedAtByWeek[wk] = Math.max(l, r);
    const src = r > l ? rc : (l > r ? lc : null);
    if (src && src.goalsByWeek && src.goalsByWeek[wk] !== undefined) out.goalsByWeek[wk] = src.goalsByWeek[wk];
  });
  // The Sunday meeting writes two per-week, per-kid records that can both be
  // *changed* on either device, so a union is the wrong merge for them:
  //   weekConfirms — confirming, then reopening after an edit. A union would
  //     keep a stale confirm alive over the reopen that came after it, and the
  //     kid's decision page would unlock on a week that is no longer agreed.
  //   weekPlans    — what she decided to do with the money.
  //   reflections  — what she said about her week. Every field in it can be
  //     changed, and the ARRAY fields are what force this: deepMergeObj treats
  //     an array as a scalar, so answerIds would be replaced by whichever
  //     snapshot arrived last with no timestamp consulted — untick an answer on
  //     the iPad and a stale phone puts it back, silently. A record arbitrated
  //     whole cannot lose one of its own fields.
  // Newest write wins per week, per kid, mirroring goalsByWeek above.
  ['weekConfirms', 'weekPlans', 'reflections'].forEach(field => {
    const lf = lc[field] || {}, rf = rc[field] || {};
    if (!lc[field] && !rc[field]) return;
    const stampOf = (rec) => (rec && (rec.reopenedAt || rec.committedAt || rec.updatedAt || rec.at)) || 0;
    out[field] = {};
    new Set([...Object.keys(lf), ...Object.keys(rf)]).forEach(wk => {
      const lw = lf[wk] || {}, rw = rf[wk] || {};
      out[field][wk] = {};
      new Set([...Object.keys(lw), ...Object.keys(rw)]).forEach(kid => {
        /* These three are the records a PERSON wrote — what she said about her
           week, what she decided to do with her money, what a grown-up agreed
           to. Newest-wins still decides what is displayed, but where the two
           genuinely diverged the loser is kept for a parent to choose from
           rather than discarded: a stamp orders two writes and says nothing
           about which one holds the better information. */
        out[field][wk][kid] = mergeWholeRecord(field, wk + '/' + kid,
          lw[kid], rw[kid], stampOf);
      });
    });
  });
  /* ── Week state a deliberate act can take BACK ──
     Eight week-keyed maps record that something happened: the week was closed,
     the money was finalised, XP was credited, the ledger was written, the
     family met, a group payout fired, a snapshot was taken. As grow-only maps
     a union is right for them, and that is what the comment above argues.

     But three acts REMOVE from them — the meeting's Undo, the parent's week
     reset, and reopening a closed week — and a removal is an ABSENCE.
     deepMergeObj iterates `Object.keys(remote)`, so absence is the one thing it
     cannot express: the remote copy puts the key straight back on the next
     snapshot. Undo therefore reversed the wallet (arbitrated per profile) while
     the week went on reading as settled on the other device, and reopening a
     week never travelled at all — it re-closed itself, re-locking both girls'
     reflections behind it.

     So: a week that carries a stamp is arbitrated whole across all eight maps,
     present or absent, newest side wins. A week with NO stamp keeps the
     grow-only union exactly as before — and only the three acts above write a
     stamp, so nothing about an ordinary week changes and no stale device can
     quietly un-record a meeting that simply predates the mechanism. Same idiom
     as goalsByWeek above and mergeEarnings: the unstamped case keeps the
     union. */
  const lws = lc.weekStateUpdatedAt || {};
  const rws = rc.weekStateUpdatedAt || {};
  out.weekStateUpdatedAt = {};
  new Set([...Object.keys(lws), ...Object.keys(rws)]).forEach(wk => {
    const l = lws[wk] || 0, r = rws[wk] || 0;
    out.weekStateUpdatedAt[wk] = Math.max(l, r);
    const src = r > l ? rc : (l > r ? lc : null);
    if (!src) return;                       // tie / unstamped keeps the union
    CHORE_WEEK_STATE_MAPS.forEach(f => {
      const has = src[f] && Object.prototype.hasOwnProperty.call(src[f], wk);
      if (has) {
        if (!out[f]) out[f] = {};
        out[f][wk] = src[f][wk];
      } else if (out[f]) {
        delete out[f][wk];                  // the newer side says it is gone
      }
    });
  });
  // Money rules: `versions` is an id-keyed array, so two parents editing on
  // different devices both keep their version (newest updatedAt wins per id,
  // 'mrv:' tombstones make a delete stick). The audit `log` is grow-only —
  // deepMergeObj's union is already the correct merge for it, and a lost entry
  // would be a lost record of a change, so it must never be arbitrated away.
  if (lc.moneyRules || rc.moneyRules) {
    const lm = lc.moneyRules || {}, rm = rc.moneyRules || {};
    if (!out.moneyRules) out.moneyRules = {};
    out.moneyRules.versions = mergeArrayById(lm.versions, rm.versions, 'mrv:');
    out.moneyRules.log = deepMergeObj(lm.log || {}, rm.log || {});
  }
  return out;
}

function mergeWeeks(localWeeks, remoteWeeks) {
  const merged = { ...(localWeeks || {}) };
  Object.entries(remoteWeeks || {}).forEach(([dayKey, remoteBlocks]) => {
    const localBlocks = merged[dayKey] || [];
    merged[dayKey] = mergeArrayById(localBlocks, remoteBlocks);
  });
  // Drop tombstoned blocks everywhere — including local-only days, so a delete
  // made on another device lands here too.
  Object.keys(merged).forEach(dayKey => {
    const arr = merged[dayKey] || [];
    const kept = arr.filter(b => !b || !blockTombstoned(b));
    if (kept.length !== arr.length) merged[dayKey] = kept;
  });
  return merged;
}
function mergeProfileState(localProfile, remoteProfile, profName) {
  const lp = localProfile || {};
  const rp = remoteProfile || {};
  const merged = { ...lp, ...rp };
  merged.weeks = mergeWeeks(lp.weeks, rp.weeks);
  merged.customActivities = mergeArrayById(lp.customActivities, rp.customActivities, profName ? 'ca:' + profName + ':' : null);
  merged.goals = mergeArrayById(lp.goals, rp.goals);
  merged.todos = mergeArrayById(lp.todos, rp.todos);
  merged.achievements = mergeArrayById(lp.achievements, rp.achievements);
  // Nested trees: merge key-by-key instead of letting remote replace them.
  merged.progress = deepMergeObj(lp.progress, rp.progress);
  // `lastGradeSeen` is a high-water mark, not a value — it records the moment
  // the kid last looked at her own chore tab, and drives the "newly answered"
  // markers. deepMergeObj lets remote win at a scalar leaf, so a phone that
  // synced an older stamp would drag it BACKWARDS and resurface markers she had
  // already read. A watermark only ever moves forward.
  const seenL = Number((lp.progress || {}).lastGradeSeen) || 0;
  const seenR = Number((rp.progress || {}).lastGradeSeen) || 0;
  if (seenL || seenR) {
    if (!merged.progress) merged.progress = {};
    merged.progress.lastGradeSeen = Math.max(seenL, seenR);
  }
  merged.chore = mergeChoreState(lp.chore, rp.chore);
  const me = mergeEarnings(lp.earnings, rp.earnings, lp.earningsUpdatedAtByWeek, rp.earningsUpdatedAtByWeek);
  merged.earnings = me.earnings;
  merged.earningsUpdatedAtByWeek = me.stamps;
  // Append-only records: id-union with their own tombstone scopes so a delete
  // made on one device sticks instead of resurrecting from the other.
  merged.competitions = mergeArrayById(lp.competitions, rp.competitions, 'comp:');
  merged.fines        = mergeArrayById(lp.fines,        rp.fines,        'fine:');
  merged.boxItems     = mergeArrayById(lp.boxItems,     rp.boxItems,     'box:');
  merged.honesty      = mergeArrayById(lp.honesty,      rp.honesty,      'hon:');
  // Money from outside — birthday money, a gift. Append-only, like the others.
  merged.deposits = mergeArrayById(lp.deposits, rp.deposits, 'dep:');
  // What she is saving for. A kid can add one on either device, so these union
  // by id; a goal she deleted stays deleted via its 'sgoal:' tombstone.
  merged.savingGoals = mergeArrayById(lp.savingGoals, rp.savingGoals, 'sgoal:');
  // What she owns. Each holding is edited in place — by a parent, and by the
  // simulation catching up on interest and prices — so newest copy of each id
  // wins and a removed one stays removed. Two devices catching up the same day
  // compute the same figures from the same dates, so newest-wins is safe here:
  // the loser is not a lost edit, it is an identical one.
  merged.holdings = mergeArrayById(lp.holdings, rp.holdings, 'hold:');
  // Debts: an id-keyed array now that a kid can owe for more than one thing.
  // Each record carries its own `payments` ledger -- a lost payment is money
  // the kid paid and didn't get credit for, so those union by id too, inside
  // the newest copy of the debt.
  merged.debts = mergeArrayById(lp.debts, rp.debts, 'debt:');
  merged.debts.forEach(d => {
    const l = (lp.debts || []).find(x => x && x.id === d.id);
    const r = (rp.debts || []).find(x => x && x.id === d.id);
    if (l && r) d.payments = mergeArrayById(l.payments, r.payments, 'lp:');
  });
  // Legacy single loan, kept for state saved before debts existed; the first
  // read after upgrading migrates it into debts[0] (js/20-loan.js).
  merged.loan = deepMergeObj(lp.loan, rp.loan);
  if (lp.loan || rp.loan) {
    merged.loan.payments = mergeArrayById((lp.loan||{}).payments, (rp.loan||{}).payments, 'lp:');
  }
  merged.wallet = deepMergeObj(lp.wallet, rp.wallet);
  merged.dayMoods = deepMergeObj(lp.dayMoods, rp.dayMoods);
  merged.blockMoods = deepMergeObj(lp.blockMoods, rp.blockMoods);
  merged.weekFeedback = deepMergeObj(lp.weekFeedback, rp.weekFeedback);
  return merged;
}

/* ── Which days a parent has reviewed ──
   `{ jenn: { '2026-09-01': true }, jess: {…} }`, written by markDayReviewedForChild
   (js/36-status.js) and read by weekDaysAwaitingReview, which is what decides
   whether a week may close.

   It was not arbitrated at all: mergeRemoteState spreads the remote copy over
   the local one, so any key it does not name is REPLACED WHOLE. Two adults
   working through the Sunday meeting on an iPad and a phone — the ordinary way
   this screen is used — and whichever snapshot landed last erased the other's
   reviews. Then canCloseWeek refused to close the week and nothing said why.

   A union per kid per day is the right merge and needs no stamp: reviewing a
   day is a fact somebody establishes, and two devices can only ever agree that
   it happened. Un-reviewing is not an act the app offers. */
function mergeParentDayConfirm(local, remote) {
  const out = {};
  const l = local || {}, r = remote || {};
  new Set([...Object.keys(l), ...Object.keys(r)]).forEach(kid => {
    const lk = l[kid] || {}, rk = r[kid] || {};
    out[kid] = {};
    new Set([...Object.keys(lk), ...Object.keys(rk)]).forEach(dayKey => {
      out[kid][dayKey] = !!(lk[dayKey] || rk[dayKey]);
    });
  });
  return out;
}

/* ── A parent's edits to the built-in routines ──
   `{ activityId: { title, icon, items, updatedAt } }`, written by
   saveBuiltInRoutine and removed by resetBuiltInRoutine (js/11-parent.js).

   Unarbitrated until now, so the remote copy replaced the map whole: an
   override saved on the iPad vanished when the phone's snapshot landed. Keyed
   by id rather than positional, so this is the same shape as mergeArrayById and
   gets the same treatment — union by key, newest edit wins, and a removal
   recorded as an 'ovr:' tombstone stays removed instead of coming back from
   whichever device still holds it. Without the tombstone, "reset this routine
   to the built-in" was a button that undid itself on the next sync. */
function mergeRoutineOverrides(local, remote) {
  const l = local || {}, r = remote || {};
  const out = {};
  new Set([...Object.keys(l), ...Object.keys(r)]).forEach(id => {
    const lv = l[id], rv = r[id];
    if (lv == null) { out[id] = rv; return; }
    if (rv == null) { out[id] = lv; return; }
    const lt = Number(lv.updatedAt) || 0, rt = Number(rv.updatedAt) || 0;
    out[id] = mergePickNewer(lv, rv, lt, rt);
  });
  const t = (state.shared && state.shared.tombstones) || null;
  if (t) Object.keys(out).forEach(id => {
    const ts = Number(out[id] && out[id].updatedAt) || 0;
    if (t['ovr:' + id] && t['ovr:' + id] >= ts) delete out[id];
  });
  return out;
}

/* ── The family's own school calendar ──
   A nested record (hours, term, days off) that a parent imports or types, and
   that overrides the shipped fallback. Also unarbitrated, so a remote copy
   replaced it whole and an import done on one device could be undone by any
   snapshot from the other.

   Field-by-field is wrong here: the days-off list is an ARRAY, which
   deepMergeObj treats as a scalar, so a half-merged calendar could carry one
   device's term dates against the other's days off — a calendar that never
   existed anywhere. A calendar is imported and reviewed as one thing, so the
   newer one wins whole. An unstamped copy loses to a stamped one, and two
   unstamped copies keep the local one rather than flip-flopping. */
function mergeSchoolCal(local, remote) {
  if (!local) return remote;
  if (!remote) return local;
  const lt = Number(local.updatedAt) || 0;
  const rt = Number(remote.updatedAt) || 0;
  return rt > lt ? remote : local;
}

/* ── The whole of state.shared, merged ──
   Lifted out of mergeRemoteState (js/03-sync.js) so the two-device tests drive
   the composition the app actually runs. A merge that is only reachable from a
   browser is a merge no unit test can hold, which is a large part of how the
   four unarbitrated keys below went unnoticed for so long.

   The spread is the hazard this function is really about: `...rs` means any key
   NOT named below is replaced wholesale by the remote copy on every snapshot,
   so a local edit that has not been pushed is simply gone. Every key therefore
   needs a decision here, and tests/check-shared-merge.js fails the build on one
   that has none. */
function mergeSharedState(localShared, remoteShared) {
  const ls = localShared || {};
  const rs = remoteShared || {};
  /* Both of these really are scalars: there is no partial state to lose and
     two devices cannot hold halves of an answer, so the newer value simply is
     the answer. The markers are what tests/check-shared-merge.js reads.

     // lww: parentPin — one scalar PIN for the household; if a grown-up
     //      changes it on one device, the newer value is the one that counts.
     // lww: sisterVisibilityMode — one scalar setting ('public'|'busy-only');
     //      there is no partial state, so the newer choice is the answer. */
  return {
    ...ls,
    ...rs,
    invites: mergeArrayById(ls.invites, rs.invites),
    challenges: mergeArrayById(ls.challenges, rs.challenges),
    customTasks: mergeArrayById(ls.customTasks, rs.customTasks, 'task:'),
    routineTemplates: mergeArrayById(ls.routineTemplates, rs.routineTemplates, 'rt:'),
    // Shared activities & level rules were previously replaced wholesale by
    // the remote copy — which made share/unshare/edit only stick when this
    // device pushed last. Merge them by id like everything else.
    sharedActivities: mergeArrayById(ls.sharedActivities, rs.sharedActivities, 'sa:'),
    levelRules: mergeArrayById(ls.levelRules, rs.levelRules, 'lr:'),
    // Sports the family added themselves. Id-keyed like the rest; deletes are
    // archives rather than removals, so no tombstone scope is needed — an
    // archived sport must keep resolving for the blocks that still name it.
    customSports: mergeArrayById(ls.customSports, rs.customSports),
    // Which days a grown-up has reviewed. A union per kid per day — see
    // mergeParentDayConfirm. Unarbitrated until now, which meant two adults
    // working through one Sunday meeting on two devices lost one set of
    // reviews and then could not close the week.
    parentDayConfirm: mergeParentDayConfirm(ls.parentDayConfirm, rs.parentDayConfirm),
    // A parent's edits to the built-in routines. Id-keyed like the rest, with
    // an 'ovr:' tombstone so removing an override sticks instead of coming
    // back from the other device's copy.
    builtInRoutineOverrides: mergeRoutineOverrides(ls.builtInRoutineOverrides, rs.builtInRoutineOverrides),
    /* Two devices that edited the same record without seeing each other. Rows
       are id-keyed and the id is derived from both opIds, so each device
       generates the SAME id for one disagreement and it merges to a single row.
       Never tombstoned: a conflict is resolved, not deleted, and the resolution
       is a field on the row so it travels like any other edit. */
    conflicts: mergeArrayById(ls.conflicts, rs.conflicts),
    /* The restore generation. A high-water mark, never a value: it only ever
       counts up, and taking the max means a device that was offline through a
       Replace cannot drag it back down and re-trigger one. mergeRemoteState
       short-circuits on a HIGHER remote epoch before it ever reaches here, so
       by this point the two are level and the max is simply the safe way to
       say so. */
    dataEpoch: Math.max(Number(ls.dataEpoch) || 0, Number(rs.dataEpoch) || 0),
    // The family's own school calendar. Newest whole record wins — its
    // days-off list is an array, so a field-by-field merge could otherwise
    // produce a calendar that exists on neither device.
    schoolCal: mergeSchoolCal(ls.schoolCal, rs.schoolCal),
    // Chore config/payouts (groups, goals, fired payouts, bank) is a nested
    // tree — conflict-aware merge so two devices' edits both survive: additive
    // maps union, groups arbitrate by id (+ tombstones), goals by per-week ts.
    chore: mergeSharedChore(ls.chore, rs.chore),
    tombstones: ensureTombstones(),
    /* Two devices that edited the same record without seeing each other. Rows
       are id-keyed and the id is derived from both opIds, so each device
       generates the SAME id for one disagreement and it merges to a single row.
       Never tombstoned: a conflict is resolved, not deleted, and the resolution
       is a field on the row so it travels like any other edit.

       LAST in this literal, and that is load-bearing: object properties are
       evaluated in source order, and `chore` above is what DISCOVERS a conflict
       and pushes it onto ls.conflicts. Read this key any earlier and the row
       just found is read before it exists and then thrown away by the
       assignment — the merge would report no conflict and quietly drop the
       losing version, which is the exact bug this mechanism exists to fix. */
    conflicts: mergeArrayById(ls.conflicts, rs.conflicts),
    };
}

// Inert in the browser; lets tests/merge.test.js run these functions in Node.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mergeArrayById, ensureTombstones, tombstoneBlockIds, blockTombstoned,
    tombstoneIds, mergeTombstones, isPlainObject, deepMergeObj, mergeChoreState,
    mergeEarnings, mergeSharedChore, mergeWeeks, mergeProfileState,
    mergePickNewer, pruneTombstones, TOMBSTONE_MAX, CHORE_WEEK_STATE_MAPS,
    mergeParentDayConfirm, mergeSchoolCal, mergeRoutineOverrides,
    mergeSharedState, recordsDiverged, mergeWholeRecord, conflictId,
    openConflicts, conflictIsOpen, CONFLICT_MAX };
}
