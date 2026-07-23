// Weekly-Planner — pure merge/tombstone layer (unit-tested by tests/merge.test.js).
// Extracted verbatim from index.html (classic script, global scope).
/* Union two id-keyed arrays, newest copy of each id wins. `tombScope` names
   the collection ('sa:', 'ca:jenn:', 'task:'…) so deletions recorded as
   scoped tombstones stick instead of resurrecting via the union. */
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
    map.set(item.id, nextTs > prevTs ? item : prev);
  });
  let out = Array.from(map.values());
  if (tombScope != null) {
    const t = state.shared && state.shared.tombstones;
    if (t) out = out.filter(item =>
      !(t[tombScope + item.id] && t[tombScope + item.id] >= (item.updatedAt || item.createdAt || 0)));
  }
  return out;
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
function tombstoneBlockIds(ids) {
  const t = ensureTombstones();
  const now = Date.now();
  (ids || []).forEach(id => { if (id != null) t[id] = now; });
  // Prune ancient tombstones so the map doesn't grow forever. 30 days is far
  // longer than any device realistically stays offline holding stale blocks.
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  Object.keys(t).forEach(id => { if (t[id] < cutoff) delete t[id]; });
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
  merged.chore = mergeChoreState(lp.chore, rp.chore);
  merged.wallet = deepMergeObj(lp.wallet, rp.wallet);
  merged.dayMoods = deepMergeObj(lp.dayMoods, rp.dayMoods);
  merged.blockMoods = deepMergeObj(lp.blockMoods, rp.blockMoods);
  merged.weekFeedback = deepMergeObj(lp.weekFeedback, rp.weekFeedback);
  return merged;
}

// Inert in the browser; lets tests/merge.test.js run these functions in Node.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mergeArrayById, ensureTombstones, tombstoneBlockIds, blockTombstoned,
    tombstoneIds, mergeTombstones, isPlainObject, deepMergeObj, mergeChoreState,
    mergeWeeks, mergeProfileState };
}
