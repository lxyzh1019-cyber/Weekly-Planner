// Weekly-Planner — Firebase/Firestore sync, local storage, remote-state merge entry.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   ╔════════════════════════════════════════════════════════════╗
   ║  FIREBASE CONFIG — PASTE YOURS HERE (from French app)       ║
   ╚════════════════════════════════════════════════════════════╝
════════════════════════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBvasH4OqU76196ZmZSXX_e8-L2PYnvyaY",
  authDomain: "chore-tracker-a461b.firebaseapp.com",
  databaseURL: "https://chore-tracker-a461b-default-rtdb.firebaseio.com",
  projectId: "chore-tracker-a461b",
  storageBucket: "chore-tracker-a461b.firebasestorage.app",
  messagingSenderId: "282740057913",
  appId: "1:282740057913:web:72defcf2e53ae13237eae8"
};
// Shared document for planner cloud sync
const FS_COLLECTION = 'weekly_planner';
const FS_DOC_ID = 'shared_state';

let fbApp = null, fbStore = null, fbDocRef = null, fbConnected = false;
let hasPendingSync = false;
let lastSyncError = '';
let syncRetryTimer = null;
let lastLocalWriteAt = 0;
let lastRemoteSeenAt = 0;
const SHOW_SYNC_DEBUG = false;

/* ── Write coalescing ──────────────────────────────────────────────────────
   Every mutation used to call saveAll → pushToFirebase, and each push writes
   the ENTIRE state tree. Anything that mutates in a loop (a routine's items, a
   week's blocks, a meeting settling both kids) therefore fired a full-document
   upload per step. saveLocal stays immediate — localStorage is the crash-safety
   net and must not lag behind the UI — but the network write is debounced.

   Trailing edge, so a burst uploads once when it settles. Anything that ends
   the session (tab hidden, page unloading) flushes first; those listeners are
   registered in js/99-main.js, since this file may only declare. */
const SYNC_DEBOUNCE_MS = 2000;
let syncDebounceTimer = null;
// Counts real push attempts, so tests can assert a burst coalesced. Also the
// quickest way to see runaway writes from the console.
let syncPushAttempts = 0;

/* ── Payload size ──────────────────────────────────────────────────────────
   Firestore's hard limit is 1 MiB per document. This app keeps every week
   forever in one document and prunes nothing, so the limit is a real deadline
   rather than a theoretical one — and the failure is silent: set() rejects, the
   catch below logs, and the status line reads "Synced (connection only)" while
   nothing has synced since. Measure every write and say so before that. */
const SYNC_WARN_BYTES = 700 * 1024;
const SYNC_HARD_WARN_BYTES = 900 * 1024;
const SYNC_LIMIT_BYTES = 1024 * 1024;
let lastPayloadBytes = 0;
let lastPayloadAt = 0;
let payloadWarnLevel = 'ok';   // 'ok' | 'warn' | 'critical' — last level announced

/* ── Clock skew ────────────────────────────────────────────────────────────
   js/04-merge.js arbitrates on `updatedAt`: the higher stamp wins an id, a week,
   a holding. Those stamps came from each device's own Date.now(), so the
   arbitration was really "whose clock is furthest ahead" rather than "who edited
   last". A tablet an hour fast wins every exchange until it is corrected, and
   silently — the losing edit just isn't there any more.

   Fix: learn this device's offset from the server and stamp with the corrected
   time. Every write carries both a client stamp and a serverTimestamp(); when
   the write comes back on the snapshot, the difference is the offset. Only our
   own echoes are used, because another device's clientAt says nothing about our
   clock. The offset includes the commit latency, which is bounded by the network
   (milliseconds) rather than by how wrong a clock can be (hours).

   Offline, syncNow falls back to Date.now() — there is nothing better, and the
   merge only matters once a connection exists anyway. */
const SYNC_MAX_PLAUSIBLE_OFFSET_MS = 24 * 60 * 60 * 1000;
let serverTimeOffsetMs = 0;
let serverTimeKnown = false;
let ownWriteStamps = [];   // client stamps we wrote, awaiting their echo

/* The time to stamp edits with. Use this instead of Date.now() anywhere the
   value is written into state and later compared across devices. */
function syncNow() {
  return Date.now() + serverTimeOffsetMs;
}
/* Learn the offset from the echo of one of our own writes. */
function noteServerTime(meta) {
  if (!meta) return;
  const raw = meta.serverAt;
  const serverAt = raw && typeof raw.toMillis === 'function' ? raw.toMillis()
                 : (typeof raw === 'number' ? raw : 0);
  const clientAt = Number(meta.clientAt) || 0;
  if (!serverAt || !clientAt) return;
  const i = ownWriteStamps.indexOf(clientAt);
  if (i === -1) return;                      // another device's write
  ownWriteStamps.splice(0, i + 1);
  const offset = serverAt - clientAt;
  // A wild value means something other than clock skew is going on; leave the
  // offset alone rather than making arbitration worse than it already was.
  if (Math.abs(offset) > SYNC_MAX_PLAUSIBLE_OFFSET_MS) return;
  serverTimeOffsetMs = offset;
  serverTimeKnown = true;
}

function initFirebase() {
  try {
    if (FIREBASE_CONFIG.apiKey.startsWith('REPLACE')) {
      setSyncStatus('offline','Local only (no Firebase config)');
      return;
    }
    // The Firebase SDK <script> tags are deferred, so they haven't executed yet
    // when this inline script calls initFirebase() at parse time — `firebase`
    // would be undefined and init would throw straight to "Local only". If the
    // SDK isn't ready, wait for DOMContentLoaded (deferred scripts run before it)
    // and retry once. Only report "Local only" if it's truly still missing.
    if (typeof firebase === 'undefined' || typeof firebase.initializeApp !== 'function') {
      if (document.readyState === 'loading') {
        setSyncStatus('syncing', 'Connecting…');
        window.addEventListener('DOMContentLoaded', initFirebase, { once: true });
        return;
      }
      setSyncStatus('offline', 'Local only (Firebase SDK unavailable)');
      return;
    }
    fbApp = firebase.initializeApp(FIREBASE_CONFIG);
    fbStore = firebase.firestore();
    fbDocRef = fbStore.collection(FS_COLLECTION).doc(FS_DOC_ID);
    fbConnected = !!navigator.onLine;
    setSyncStatus('syncing','Connecting…');

    window.addEventListener('online', () => {
      fbConnected = true;
      setSyncStatus('online', 'Synced');
      if (hasPendingSync) pushToFirebase();
    });
    window.addEventListener('offline', () => {
      fbConnected = false;
      setSyncStatus('offline', 'Offline');
    });

    if (!fbConnected) setSyncStatus('offline', 'Offline');

    if (!syncRetryTimer) {
      syncRetryTimer = setInterval(() => {
        if (fbConnected && hasPendingSync) pushToFirebase();
      }, 5000);
    }

    // Listen for changes and merge
    fbDocRef.onSnapshot(snap => {
      if (!snap.exists) {
        setSyncStatus(fbConnected ? 'online' : 'offline', fbConnected ? 'Synced' : 'Offline');
        return;
      }
      const remote = snap.data() || {};
      const remoteTs = remote?._meta?.updatedAt || 0;
      if (remoteTs) lastRemoteSeenAt = Math.max(lastRemoteSeenAt, remoteTs);
      // Before merging: if this snapshot is the echo of our own write, it carries
      // the server's view of when that write happened. That is the only source of
      // truth this device has about its own clock.
      try { noteServerTime(remote._meta); } catch (e) { console.error('noteServerTime failed', e); }
      mergeRemoteState(remote);
      if (hasPendingSync && remoteTs && remoteTs >= lastLocalWriteAt) {
        hasPendingSync = false;
        lastSyncError = '';
        setSyncStatus('online', 'Synced');
        renderPendingSyncMessage();
      }
    }, err => {
      fbConnected = !!navigator.onLine;
      setSyncStatus(fbConnected ? 'online' : 'offline', fbConnected ? 'Synced (connection only)' : 'Offline');
      lastSyncError = err?.code || err?.message || 'read denied';
      renderPendingSyncMessage();
      console.error('Firestore listen failed', err);
    });
  } catch(e) {
    console.error('Firebase init failed', e);
    setSyncStatus('offline','Local only');
  }
}
function setSyncStatus(state, label) {
  const dot = document.getElementById('syncDot');
  const fb  = document.getElementById('fbStatus');
  if (dot) {
    dot.classList.remove('offline','syncing');
    if (state==='offline') dot.classList.add('offline');
    if (state==='syncing') dot.classList.add('syncing');
  }
  if (fb) fb.textContent = (state==='online'?'☁️ ':state==='offline'?'💾 ':'⏳ ')+label;
  renderPendingSyncMessage();
}
function renderPendingSyncMessage() {
  const pending = document.getElementById('syncPendingMsg');
  if (!pending) {
    renderSyncDebugMessage();
    return;
  }
  // A write waiting out its debounce window is the normal case, not a problem.
  // Without this it read "upload retrying…" for two seconds after every edit,
  // which is alarming and untrue — nothing has failed yet.
  if (hasPendingSync && fbConnected && syncDebounceTimer && !lastSyncError) {
    pending.textContent = 'Saving…';
    renderSyncDebugMessage();
    return;
  }
  if (hasPendingSync && fbConnected) {
    pending.textContent = lastSyncError
      ? `Pending sync: upload retrying (${lastSyncError}).`
      : 'Pending sync: upload retrying…';
    renderSyncDebugMessage();
    return;
  }
  if (hasPendingSync) {
    pending.textContent = 'Pending sync: local changes will upload once online.';
    renderSyncDebugMessage();
    return;
  }
  pending.textContent = '';
  renderSyncDebugMessage();
}
function shortTs(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  if (isNaN(d)) return String(ts);
  // Family time, like every other clock the app shows.
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE, hour12: false,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(d);
}
function renderSyncDebugMessage() {
  const el = document.getElementById('syncDebugMsg');
  if (!el) return;
  if (!SHOW_SYNC_DEBUG) {
    el.style.display = 'none';
    el.textContent = '';
    return;
  }
  el.style.display = '';
  el.textContent = `dbg c:${fbConnected?1:0} p:${hasPendingSync?1:0} lw:${shortTs(lastLocalWriteAt)} rr:${shortTs(lastRemoteSeenAt)} err:${lastSyncError||'-'}`;
}

/* ════════════════════════════════════════════════════════════════
   STORAGE: LOCAL + FIREBASE MERGE
════════════════════════════════════════════════════════════════ */
function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...state, ...parsed, profiles: { ...state.profiles, ...(parsed.profiles||{}) }, shared: {...state.shared, ...(parsed.shared||{})} };
    } else {
      // Try loading legacy v2 key once for migration
      const legacy = localStorage.getItem('weeklyplanner-v2');
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          state = { ...state, ...parsed, profiles: { ...state.profiles, ...(parsed.profiles||{}) }, shared: {...state.shared, ...(parsed.shared||{})} };
        } catch(e){}
      }
    }
    migrateBlocks();
  } catch(e){ console.warn('Local load failed', e); }
}

function ensureBlockId(dayKey, block, idx) {
  if (block && block.id != null) return block.id;
  const act = block?.actId || 'act';
  const start = block?.startMin ?? block?.start ?? 0;
  const dur = block?.durationMin ?? block?.slots ?? 0;
  // The note used to be spliced into the id verbatim. Block ids get interpolated
  // into inline onclick handlers, so a note containing an apostrophe closed the
  // handler's string literal and the rest of the note ran as JavaScript on tap.
  // Slug it: keep something human-readable, but only characters that cannot
  // carry meaning in HTML or JS. escapeJsAttr at the render sites covers ids
  // that arrive already-formed from a synced document.
  const note = String(block?.note || '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return `blk-${dayKey}-${idx}-${act}-${start}-${dur}-${note}`;
}

/* Convert legacy {start, slots} blocks → {startMin, durationMin}.
   Safe to call repeatedly; checks per block. */
function migrateBlocks() {
  ['jenn','jess'].forEach(p=>{
    const weeks = state.profiles?.[p]?.weeks;
    if (!weeks) return;
    Object.keys(weeks).forEach(key=>{
      const blocks = weeks[key];
      if (!Array.isArray(blocks)) return;
      weeks[key] = blocks.map((b, idx)=>{
        let next = b;
        if (b.startMin == null || b.durationMin == null) {
          if (b.start != null && b.slots != null) {
            next = {
              ...b,
              startMin: START_MIN + b.start*15,
              durationMin: b.slots*15,
            };
          }
        }
        if (next?.id == null) {
          next = { ...next, id: ensureBlockId(key, next, idx) };
        }
        if (next.travelBuffer && (next.travelBufMin == null || next.travelBufMin < 5)) {
          next = { ...next, travelBufMin: 15 };
        }
        if (next.getReadyBuffer && (next.getReadyBufMin == null || next.getReadyBufMin < 5)) {
          next = { ...next, getReadyBufMin: 15 };
        }
        return next;
      });
    });
  });
}

const DEFAULT_BUFFER_MIN = 15;
function clampBufferMin(n) {
  const v = parseInt(n, 10);
  if (Number.isNaN(v)) return DEFAULT_BUFFER_MIN;
  return Math.max(5, Math.min(180, v));
}
function getTravelBufMin(block) {
  if (!block || !block.travelBuffer) return 0;
  return clampBufferMin(block.travelBufMin != null ? block.travelBufMin : DEFAULT_BUFFER_MIN);
}
function getGetReadyBufMin(block) {
  if (!block || !block.getReadyBuffer) return 0;
  return clampBufferMin(block.getReadyBufMin != null ? block.getReadyBufMin : DEFAULT_BUFFER_MIN);
}
const DEFAULT_WARMUP_MIN = 20;
/* Warm-up is one-sided — you warm up right before competing/training, never
   after — unlike travel/get-ready which mirror before and after. */
function getWarmupBufMin(block) {
  if (!block || !block.warmupBuffer) return 0;
  return clampBufferMin(block.warmupBufMin != null ? block.warmupBufMin : DEFAULT_WARMUP_MIN);
}
/* A block's travel/get-ready buffer needs real, unoccupied time right before
   and after the activity. If that buffer window overlaps another block's own
   time, the plan isn't actually workable (e.g. "leave by 5:30" but the next
   activity already starts at 5:30) — surface it instead of letting it be
   discovered by showing up late. Returns { perBlock: Map(id -> {pre,post}),
   affected: Set(ids of every block touched by a conflict, either side),
   partners: Map(id -> Set(ids it clashes with)) }.

   partners records BOTH sides of every collision the sweep below already finds.
   It exists so a screen can say WHICH activity a block runs into — "Overlaps
   Reading" rather than "overlaps another activity" — without a second overlap
   test living somewhere else and eventually disagreeing with this one. */
function computeBufferConflicts(blocks) {
  const perBlock = new Map();
  const affected = new Set();
  const partners = new Map();
  const pair = (a, b) => {
    if (!partners.has(a)) partners.set(a, new Set());
    partners.get(a).add(b);
  };
  (blocks || []).forEach(b => {
    const sideBuf = getTravelBufMin(b) + getGetReadyBufMin(b);
    const preBuf = sideBuf + getWarmupBufMin(b); // warm-up only ever sits before
    const postBuf = sideBuf;
    if (preBuf <= 0 && postBuf <= 0) return;
    const preStart = b.startMin - preBuf, preEnd = b.startMin;
    const postStart = b.startMin + (b.durationMin || 0), postEnd = postStart + postBuf;
    let pre = false, post = false;
    (blocks || []).forEach(o => {
      if (o.id === b.id) return;
      const oStart = o.startMin, oEnd = o.startMin + (o.durationMin || 0);
      if (preStart < oEnd && preEnd > oStart) { pre = true; affected.add(o.id); pair(b.id, o.id); pair(o.id, b.id); }
      if (postStart < oEnd && postEnd > oStart) { post = true; affected.add(o.id); pair(b.id, o.id); pair(o.id, b.id); }
    });
    if (pre || post) { perBlock.set(b.id, { pre, post }); affected.add(b.id); }
  });
  return { perBlock, affected, partners };
}
let localSaveFailed = false;
function saveLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    // Recovered: a previously-failed write now succeeds.
    if (localSaveFailed) {
      localSaveFailed = false;
      if (typeof showToast === 'function') showToast('✅ Saving works again on this device');
    }
  } catch(e) {
    // Quota exceeded, private mode, or storage blocked. Warn once per transition
    // (not on every keystroke) so the child/parent knows data isn't persisting.
    console.error('localStorage save failed', e);
    if (!localSaveFailed) {
      localSaveFailed = true;
      if (typeof showToast === 'function') showToast('⚠️ Couldn\'t save on this device — storage may be full');
    }
  }
}
/* Byte length of a string as Firestore will store it — UTF-8, not UTF-16 code
   units, so `.length` would under-count every non-ASCII character (the app is
   full of emoji, and kid-entered notes may be Chinese). */
function byteLength(str) {
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(str).length;
  if (typeof Blob === 'function') return new Blob([str]).size;
  return String(str).length;
}
/* Classify a payload against the Firestore ceiling. Pure, so it can be tested
   without building a giant state. */
function payloadHealth(bytes) {
  const n = Number(bytes) || 0;
  const level = n >= SYNC_HARD_WARN_BYTES ? 'critical' : n >= SYNC_WARN_BYTES ? 'warn' : 'ok';
  return { bytes: n, level, pct: Math.min(100, Math.round((n / SYNC_LIMIT_BYTES) * 100)) };
}
/* Announce a threshold crossing once per transition rather than on every write,
   and only ever upward — a parent shouldn't get the same warning 40 times while
   settling a meeting. */
function notePayloadSize(bytes) {
  lastPayloadBytes = bytes;
  lastPayloadAt = Date.now();
  const { level, pct } = payloadHealth(bytes);
  if (level !== payloadWarnLevel) {
    const rising = (payloadWarnLevel === 'ok' && level !== 'ok') ||
                   (payloadWarnLevel === 'warn' && level === 'critical');
    payloadWarnLevel = level;
    if (rising && typeof showToast === 'function') {
      showToast(level === 'critical'
        ? `⚠️ Cloud save is ${pct}% of its size limit — export a backup and ask for old weeks to be archived`
        : `ℹ️ Cloud save is ${pct}% of its size limit — worth exporting a backup`);
    }
  }
  if (typeof bkRenderPanel === 'function') { try { bkRenderPanel(); } catch (e) {} }
}
function pushToFirebase() {
  syncPushAttempts++;
  if (!fbDocRef || !fbConnected) {
    hasPendingSync = true;
    lastSyncError = '';
    renderPendingSyncMessage();
    return;
  }
  const writeAt = Date.now();
  lastLocalWriteAt = Math.max(lastLocalWriteAt, writeAt);
  // Firestore's set() validates the payload SYNCHRONOUSLY and throws on data
  // it can't store (e.g. any field that is `undefined`). Every mutating button
  // runs mutate → saveAll → pushToFirebase → close-sheet/re-render, so a throw
  // here silently killed the UI-refresh half of every action while the data
  // (already in memory and localStorage) survived. JSON round-tripping the
  // payload uploads exactly what saveLocal persists — undefined fields drop
  // out instead of throwing — and any remaining sync throw is downgraded to
  // the same retry path as an async write failure.
  let payload;
  try {
    const json = JSON.stringify({ profiles: state.profiles, shared: state.shared });
    // Measured on the exact string being uploaded, before _meta is attached.
    notePayloadSize(byteLength(json));
    payload = JSON.parse(json);
  } catch (e) {
    hasPendingSync = true;
    lastSyncError = e?.message || 'payload serialize failed';
    renderPendingSyncMessage();
    console.error('Firestore payload serialization failed', e);
    return;
  }
  // updatedAt is the corrected stamp other devices arbitrate on. clientAt and
  // serverAt exist only to measure this device's clock against the server's when
  // this write echoes back — see noteServerTime.
  payload._meta = { updatedAt: syncNow(), clientAt: writeAt };
  try {
    if (typeof firebase !== 'undefined' && firebase.firestore &&
        firebase.firestore.FieldValue && firebase.firestore.FieldValue.serverTimestamp) {
      payload._meta.serverAt = firebase.firestore.FieldValue.serverTimestamp();
    }
  } catch (e) { /* serverTimestamp unavailable — offset just stays unlearned */ }
  ownWriteStamps.push(writeAt);
  // Bound the list: only the newest few echoes are ever useful.
  if (ownWriteStamps.length > 20) ownWriteStamps = ownWriteStamps.slice(-20);
  lastSyncError = '';
  renderPendingSyncMessage();
  setSyncStatus('syncing', 'Uploading…');
  try {
    fbDocRef.set(payload, { merge: true }).catch(e=>{
      hasPendingSync = true;
      lastSyncError = e?.code || e?.message || 'write failed';
      renderPendingSyncMessage();
      console.error('Firestore push failed', e);
      setSyncStatus('online', 'Synced (connection only)');
    }).then(() => {
      if (!hasPendingSync) setSyncStatus('online', 'Synced');
    });
  } catch (e) {
    hasPendingSync = true;
    lastSyncError = e?.code || e?.message || 'write failed';
    renderPendingSyncMessage();
    console.error('Firestore push failed (sync validation)', e);
    setSyncStatus('online', 'Synced (connection only)');
  }
}
/* Arm the trailing debounce. Repeated calls inside the window collapse into the
   single upload that runs when it goes quiet. */
function schedulePush() {
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    syncDebounceTimer = null;
    try { pushToFirebase(); } catch (e) { console.error('pushToFirebase failed', e); }
  }, SYNC_DEBOUNCE_MS);
}
/* Upload now, cancelling any armed debounce. Called when waiting is no longer
   safe: the tab is being hidden or the page is going away. */
function flushPush() {
  if (syncDebounceTimer) { clearTimeout(syncDebounceTimer); syncDebounceTimer = null; }
  if (!hasPendingSync) return;
  try { pushToFirebase(); } catch (e) { console.error('pushToFirebase failed', e); }
}
function saveAll() {
  saveLocal();
  hasPendingSync = true;
  // Persistence must never throw into the calling action handler — every
  // Save/Delete/Share button refreshes its UI *after* calling saveAll, so an
  // escaped error here leaves sheets stuck open with the data already saved.
  try { renderPendingSyncMessage(); } catch (e) { console.error('renderPendingSyncMessage failed', e); }
  // Debounced rather than immediate: see SYNC_DEBOUNCE_MS above. The 5s retry
  // interval in initFirebase is the backstop if this window is ever missed.
  try { schedulePush(); } catch (e) { console.error('schedulePush failed', e); }
}
window._skipRewardPrompt = false;
function markItemUpdated(item) {
  if (!item) return item;
  item.updatedAt = syncNow();
  return item;
}
function mergeRemoteState(remote) {
  if (!remote) return;
  // Tombstones first, so the week merges below already know about deletes
  // recorded on other devices.
  if (remote.shared) mergeTombstones(remote.shared.tombstones);
  if (remote.profiles) {
    ['jenn','jess'].forEach(p => {
      const lp = state.profiles[p] || {};
      const rp = remote.profiles[p] || {};
      state.profiles[p] = mergeProfileState(lp, rp, p);
      // activityCounts/activityHours are derived from confirmed blocks —
      // recompute from the merged weeks instead of trusting either side's copy.
      recountActivityProgress(p);
    });
  }
  if (remote.shared) {
    const ls = state.shared || {};
    const rs = remote.shared || {};
    state.shared = {
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
      // Chore config/payouts (groups, goals, fired payouts, bank) is a nested
      // tree — conflict-aware merge so two devices' edits both survive: additive
      // maps union, groups arbitrate by id (+ tombstones), goals by per-week ts.
      chore: mergeSharedChore(ls.chore, rs.chore),
      tombstones: ensureTombstones(),
    };
  }
  migrateBlocks();
  saveLocal();
  refreshCurrentScreen();
}

/* Redraw whatever is on screen after a remote snapshot lands.

   The kid-facing money pages and the quest board were missing from this list,
   which is why a parent's edit showed up in the portal immediately but a kid
   staring at her own money page saw a stale number until she navigated away
   and back. The meeting overlay is not a `.screen` at all, so it needs its own
   check — and it redraws through renderMeetingMode, which preserves scroll and
   focus, so an incoming sync can't yank a parent's cursor out of a field
   mid-meeting. */
function refreshCurrentScreen() {
  const meeting = document.getElementById('familyMeetingOverlay');
  if (meeting && meeting.classList.contains('open') && typeof renderMeetingMode === 'function') {
    renderMeetingMode();
  }
  const active = document.querySelector('.screen.active');
  if (!active) return;
  if (active.id === 'screen-today') { if (typeof tdRenderToday === 'function') tdRenderToday(); }
  else if (active.id === 'screen-week') renderWeek();
  else if (active.id === 'screen-day') { buildTimeline(); renderVibe(); }
  else if (active.id === 'screen-chore') renderChoreTab();
  else if (active.id === 'screen-sync') renderSync();
  else if (active.id === 'screen-parent') renderParentHome();
  else if (active.id === 'screen-mymoney' && typeof mnyRenderMyMoney === 'function') mnyRenderMyMoney();
  else if (active.id === 'screen-moneystory' && typeof mnyRenderStory === 'function') mnyRenderStory();
  else if (active.id === 'screen-moneyschool' && typeof mnyRenderSchool === 'function') mnyRenderSchool();
}

