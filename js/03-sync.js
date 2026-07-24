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
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
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
  const note = (block?.note || '').slice(0, 24);
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
   affected: Set(ids of every block touched by a conflict, either side) }. */
function computeBufferConflicts(blocks) {
  const perBlock = new Map();
  const affected = new Set();
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
      if (preStart < oEnd && preEnd > oStart) { pre = true; affected.add(o.id); }
      if (postStart < oEnd && postEnd > oStart) { post = true; affected.add(o.id); }
    });
    if (pre || post) { perBlock.set(b.id, { pre, post }); affected.add(b.id); }
  });
  return { perBlock, affected };
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
function pushToFirebase() {
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
    payload = JSON.parse(JSON.stringify({ profiles: state.profiles, shared: state.shared }));
  } catch (e) {
    hasPendingSync = true;
    lastSyncError = e?.message || 'payload serialize failed';
    renderPendingSyncMessage();
    console.error('Firestore payload serialization failed', e);
    return;
  }
  payload._meta = { updatedAt: writeAt };
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
function saveAll() {
  saveLocal();
  hasPendingSync = true;
  // Persistence must never throw into the calling action handler — every
  // Save/Delete/Share button refreshes its UI *after* calling saveAll, so an
  // escaped error here leaves sheets stuck open with the data already saved.
  try { renderPendingSyncMessage(); } catch (e) { console.error('renderPendingSyncMessage failed', e); }
  try { pushToFirebase(); } catch (e) { console.error('pushToFirebase failed', e); }
}
window._skipRewardPrompt = false;
function markItemUpdated(item) {
  if (!item) return item;
  item.updatedAt = Date.now();
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

function refreshCurrentScreen() {
  const active = document.querySelector('.screen.active');
  if (!active) return;
  if (active.id === 'screen-week') renderWeek();
  else if (active.id === 'screen-day') { buildTimeline(); buildTray(); renderVibe(); }
  else if (active.id === 'screen-chore') renderChoreTab();
  else if (active.id === 'screen-sync') renderSync();
  else if (active.id === 'screen-parent') renderParentHome();
}

