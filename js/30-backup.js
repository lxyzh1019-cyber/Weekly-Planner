// Weekly-Planner — full backup and restore.
//
// Why this file exists: the app's only export was ctExportBackup (js/13-chores.js),
// which copies the chore slices and nothing else. It silently omits every
// profile's `weeks`, `progress`, `goals`, `todos`, `customActivities`,
// `achievements` and `earnings` — i.e. the whole planner — and there was no
// import function at all, so even that partial export was a one-way door.
// A family that lost a device had no route back.
//
// Declarations only (see CLAUDE.md load-order rule); the parent panel is
// rendered on demand from renderParentHome, and the file input is created when
// the parent taps Restore.

const BK_SCHEMA_VERSION = 1;
const BK_KIND = 'weekly-planner-full-backup';

/* The whole persisted tree, plus enough metadata to know what a file is and
   whether this build can read it. Mirrors exactly what saveLocal writes and
   pushToFirebase uploads: { profiles, shared }. */
function bkBuildFullBackup() {
  // A snapshot, not a view. This used to hand back live references into `state`,
  // which is correct for the one caller that serialises immediately and a trap
  // for every other one: hold the result, change anything, and the "backup" you
  // are holding changes with it. Cheap to copy — an export is a rare, deliberate
  // parent action, and JSON is the format it is about to become anyway.
  const snapshot = JSON.parse(JSON.stringify({ profiles: state.profiles, shared: state.shared }));
  return {
    kind: BK_KIND,
    schemaVersion: BK_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    storageKey: LS_KEY,
    profiles: snapshot.profiles,
    shared: snapshot.shared
  };
}

function bkFormatBytes(n) {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

/* Rough shape report for the UI and for the export toast, so a parent can see
   at a glance that the file really does contain the planner. */
function bkBackupStats(data) {
  const profiles = (data && data.profiles) || {};
  const kids = Object.keys(profiles);
  let weeks = 0, blocks = 0, goals = 0;
  kids.forEach(k => {
    const p = profiles[k] || {};
    const w = p.weeks || {};
    Object.keys(w).forEach(key => {
      weeks++;
      if (Array.isArray(w[key])) blocks += w[key].length;
    });
    goals += (p.goals || []).length;
  });
  return { kids, weeks, blocks, goals };
}

function bkExportFullBackup() {
  if (!isParent()) { showToast('Ask a grown-up — backups are parent-only'); return; }
  try {
    const data = bkBuildFullBackup();
    const json = JSON.stringify(data, null, 2);
    const stats = bkBackupStats(data);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    link.download = `weekly-planner-full-backup-${stamp}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast(`✅ Full backup saved — ${stats.weeks} week${stats.weeks === 1 ? '' : 's'}, ${bkFormatBytes(byteLength(json))}`);
    bkRenderPanel();
  } catch (e) {
    console.error('Full backup export failed', e);
    showToast('⚠️ Couldn\'t create the backup file');
  }
}

/* Reject anything that isn't a full backup this build can read.
   The important case is the chore-only file: ctExportBackup also writes a .json
   with a top-level `profiles` key, but there each profile holds only the chore
   slice. Applying one as a full restore would replace real planner profiles
   with chore fragments, so it is named and refused rather than half-imported. */
function bkValidateBackup(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'That file isn\'t a Weekly-Planner backup.' };
  }
  if (data.version === 3 && (data.goalsByWeek || data.groups || data.moneySnapshots) && !data.schemaVersion) {
    return { ok: false, error: 'That\'s a chore-only backup (from “Export chore backup”). It doesn\'t contain the planner, so it can\'t be restored here.' };
  }
  if (data.kind && data.kind !== BK_KIND) {
    return { ok: false, error: 'That file is a different kind of backup.' };
  }
  const version = Number(data.schemaVersion);
  if (!version) {
    return { ok: false, error: 'That file has no backup version, so it can\'t be read safely.' };
  }
  if (version > BK_SCHEMA_VERSION) {
    return { ok: false, error: `That backup was made by a newer version of the app (v${version}). Update the app first.` };
  }
  if (!data.profiles || typeof data.profiles !== 'object') {
    return { ok: false, error: 'That backup has no profiles in it.' };
  }
  const kids = Object.keys(data.profiles).filter(k => k === 'jenn' || k === 'jess');
  if (!kids.length) {
    return { ok: false, error: 'That backup has no Jenn or Jess data in it.' };
  }
  if (!data.shared || typeof data.shared !== 'object') {
    return { ok: false, error: 'That backup is missing the shared family settings.' };
  }
  return { ok: true, stats: bkBackupStats(data) };
}

/* Merge keeps both sides: it routes the backup through the same conflict-aware
   layer a remote snapshot uses (js/04-merge.js), so id-keyed unions, deletion
   tombstones and per-week arbitration all apply. Nothing is dropped just
   because the backup is older.

   Replace makes this device match the file: profiles present in the backup are
   substituted wholesale, and shared settings are laid over the current
   structural defaults so no key the app expects goes missing. migrateBlocks
   then normalises any legacy {start, slots} blocks, exactly as a page load does. */
function bkApplyBackup(data, mode) {
  if (mode === 'merge') {
    mergeRemoteState({ profiles: data.profiles, shared: data.shared });
  } else {
    Object.keys(data.profiles || {}).forEach(k => {
      if (k === 'jenn' || k === 'jess') state.profiles[k] = data.profiles[k];
    });
    state.shared = { ...state.shared, ...(data.shared || {}) };
    migrateBlocks();
  }
  saveAll();
  // A restore is exactly the moment not to sit in a debounce window.
  flushPush();
  if (typeof refreshCurrentScreen === 'function') refreshCurrentScreen();
  bkRenderPanel();
}

/* Read the chosen file, validate it, then ask what to do with it. Async because
   FileReader is, and because both dialogs are promise-based. */
async function bkHandleImportFile(file) {
  if (!isParent()) { showToast('Ask a grown-up — restoring is parent-only'); return; }
  if (!file) return;
  let text;
  try {
    text = await file.text();
  } catch (e) {
    console.error('Backup read failed', e);
    showToast('⚠️ Couldn\'t read that file');
    return;
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    showToast('⚠️ That file isn\'t valid JSON');
    return;
  }
  const check = bkValidateBackup(data);
  if (!check.ok) {
    await showAlert(check.error);
    return;
  }
  const s = check.stats;
  const when = data.exportedAt ? new Date(data.exportedAt).toLocaleString() : 'an unknown date';
  const summary = `Backup from ${when}\n${s.weeks} week${s.weeks === 1 ? '' : 's'}, ${s.blocks} planned block${s.blocks === 1 ? '' : 's'}, ${s.goals} goal${s.goals === 1 ? '' : 's'}.`;

  const mode = await showChoice(`${summary}\n\nHow should this be restored?`, [
    { id: 'merge', label: '🔀 Merge', sub: 'Keep what\'s on this device and add anything missing from the backup. Safe choice.' },
    { id: 'replace', label: '♻️ Replace', sub: 'Make this device match the backup exactly. Anything newer here is lost.' }
  ]);
  if (!mode) return;

  if (mode === 'replace') {
    const now = bkBackupStats({ profiles: state.profiles });
    const ok = await showCheckConfirm(
      `This replaces the ${now.weeks} week${now.weeks === 1 ? '' : 's'} on this device with the ${s.weeks} in the backup. It can't be undone.`,
      'I have exported a backup of what\'s on this device',
      { okLabel: 'Replace everything', cancelLabel: 'Cancel', danger: true }
    );
    if (!ok) return;
  }

  try {
    bkApplyBackup(data, mode);
    showToast(mode === 'merge' ? '✅ Backup merged in' : '✅ Restored from backup');
  } catch (e) {
    console.error('Backup restore failed', e);
    showToast('⚠️ Restore failed — nothing was changed on the cloud');
  }
}

/* One hidden input, created on demand and reused. Resetting value before the
   click means picking the same file twice still fires change. */
function bkImportPickFile() {
  if (!isParent()) { showToast('Ask a grown-up — restoring is parent-only'); return; }
  let input = document.getElementById('bkImportInput');
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.id = 'bkImportInput';
    input.accept = 'application/json,.json';
    input.hidden = true;
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      input.value = '';
      bkHandleImportFile(f);
    });
    document.body.appendChild(input);
  }
  input.value = '';
  input.click();
}

/* Cloud-size readout. lastPayloadBytes is measured on the real upload string in
   pushToFirebase; before the first sync of a session there is nothing measured
   yet, so fall back to the local copy, which is the same tree. */
function bkCloudSizeInfo() {
  let bytes = lastPayloadBytes;
  let measured = !!bytes;
  if (!bytes) {
    try { bytes = byteLength(JSON.stringify({ profiles: state.profiles, shared: state.shared })); }
    catch (e) { bytes = 0; }
  }
  return { ...payloadHealth(bytes), measured };
}

function bkRenderPanel() {
  const wrap = document.getElementById('bkWrap');
  if (!wrap) return;
  const info = bkCloudSizeInfo();
  const stats = bkBackupStats({ profiles: state.profiles });
  const note = info.level === 'critical'
    ? 'This is close to the cloud limit. Export a backup now, and old weeks should be archived soon — past the limit, cloud saves stop going through.'
    : info.level === 'warn'
    ? 'Still fine, but worth keeping an eye on. Export a backup.'
    : 'Plenty of room.';

  wrap.innerHTML = `
    <h3 class="parent-h3">🗄️ Backup &amp; restore</h3>
    <p class="parent-hint">A full backup contains everything both girls have planned and earned — every week, routine, goal, chore and pocket-money record. Keep one somewhere off this device.</p>
    <div style="display:flex;gap:0.6rem;flex-wrap:wrap;margin-bottom:0.5rem">
      <button class="btn-confirm bk-btn" onclick="bkExportFullBackup()">⬇️ Export full backup</button>
      <button class="pill-btn bk-btn" onclick="bkImportPickFile()">⬆️ Restore from file…</button>
    </div>
    <p class="parent-hint">On this device now: ${stats.weeks} week${stats.weeks === 1 ? '' : 's'}, ${stats.blocks} planned block${stats.blocks === 1 ? '' : 's'}, ${stats.goals} goal${stats.goals === 1 ? '' : 's'}.</p>

    <h3 class="parent-h3">☁️ Cloud save size</h3>
    <p class="parent-hint">Everything syncs as one document, and the cloud caps that document at 1 MB. ${info.measured ? '' : '(Not synced yet this session — measured from the copy on this device.)'}</p>
    <div class="bk-meter" role="img" aria-label="Cloud save is ${info.pct}% of the size limit">
      <div class="bk-meter-fill ${info.level}" style="width:${Math.max(2, info.pct)}%"></div>
    </div>
    <p class="parent-hint"><b>${bkFormatBytes(info.bytes)}</b> of 1 MB — ${info.pct}%. ${note}</p>

    <h3 class="parent-h3">🧹 Chore-only export</h3>
    <p class="parent-hint">A smaller file with just the chore groups, prices and money snapshots — useful for checking the money setup, but <b>not</b> a backup of the planner and not restorable here.</p>
    <button class="pill-btn bk-btn" onclick="ctExportBackup()">⬇️ Export chore-only file</button>
  `;
}
