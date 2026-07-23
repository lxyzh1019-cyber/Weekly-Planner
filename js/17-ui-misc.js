// Weekly-Planner — misc UI: styled dialogs, sheets, toasts, mascot, sister visibility.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   MISC
════════════════════════════════════════════════════════════════ */
/* ── Styled dialogs — promise-based replacements for native confirm()/prompt()
   so destructive confirms and PIN/text entry stay inside the app's sheet
   aesthetic instead of the browser's gray boxes. Reuses the .overlay/.sheet
   styling. showConfirm → Promise<boolean>; showPrompt → Promise<string|null>
   (null on cancel, matching native prompt). ── */
let _appDialogResolve = null;
function _closeAppDialog(result) {
  const ov = document.getElementById('appDialogOverlay');
  if (ov) ov.classList.remove('open');
  const resolve = _appDialogResolve;
  _appDialogResolve = null;
  document.removeEventListener('keydown', _appDialogKey, true);
  if (resolve) resolve(result);
}
function _appDialogKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); _appDialogCancel(); }
  else if (e.key === 'Enter') {
    const inp = document.getElementById('appDialogInput');
    if (!inp || document.activeElement === inp) { e.preventDefault(); _appDialogOk(); }
  }
}
function _appDialogOk() {
  const inp = document.getElementById('appDialogInput');
  _closeAppDialog(inp ? inp.value : true);
}
function _appDialogCancel() {
  const inp = document.getElementById('appDialogInput');
  _closeAppDialog(inp ? null : false);
}
function _appDialog({ message, kind, value = '', inputType = 'text', okLabel = 'OK', cancelLabel = 'Cancel', danger = false }) {
  // Resolve any dialog already open (shouldn't normally happen) before opening.
  if (_appDialogResolve) _closeAppDialog(kind === 'prompt' ? null : false);
  let ov = document.getElementById('appDialogOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'overlay';
    ov.id = 'appDialogOverlay';
    ov.addEventListener('click', e => { if (e.target === ov) _appDialogCancel(); });
    document.body.appendChild(ov);
  }
  const inputHtml = kind === 'prompt'
    ? `<input id="appDialogInput" type="${inputType}" class="app-dialog-input" value="${escapeAttr(String(value))}">`
    : '';
  ov.innerHTML =
    `<div class="sheet app-dialog-sheet" role="dialog" aria-modal="true">
      <div class="sheet-handle"></div>
      <p class="app-dialog-msg">${escapeHtml(message)}</p>
      ${inputHtml}
      <div class="app-dialog-btns">
        <button type="button" class="pill-btn app-dialog-cancel" onclick="_appDialogCancel()">${escapeHtml(cancelLabel)}</button>
        <button type="button" class="btn-confirm${danger ? ' danger' : ''}" style="width:auto;flex:1" onclick="_appDialogOk()">${escapeHtml(okLabel)}</button>
      </div>
    </div>`;
  return new Promise(resolve => {
    _appDialogResolve = resolve;
    ov.classList.add('open');
    document.addEventListener('keydown', _appDialogKey, true);
    const inp = document.getElementById('appDialogInput');
    if (inp) { inp.focus(); inp.select(); }
  });
}
function showConfirm(message, opts = {}) {
  return _appDialog({ message, kind: 'confirm', okLabel: opts.okLabel || 'OK', cancelLabel: opts.cancelLabel || 'Cancel', danger: !!opts.danger });
}
function showPrompt(message, opts = {}) {
  return _appDialog({ message, kind: 'prompt', value: opts.value || '', inputType: opts.type || 'text', okLabel: opts.okLabel || 'OK', cancelLabel: opts.cancelLabel || 'Cancel' });
}

// ── App-wide double-tap / double-click guard for committing actions ──
// Confirm / Save / Remove / Delete / Share buttons no longer hide themselves
// after a tap, so a fast double-tap (or a mobile "ghost click") could fire the
// handler twice — placing a duplicate block, sending a duplicate invite, etc.
// We swallow a repeat activation of the SAME action button inside a short
// window. Opening any sheet resets the guard so legitimately re-using the same
// static button on a fresh sheet is never blocked.
let _actGuardBtn = null, _actGuardAt = 0;
function resetActionGuard() { _actGuardBtn = null; _actGuardAt = 0; }
(function installActionDoubleTapGuard() {
  const WINDOW_MS = 600;
  const MUTATING = /(?:confirm|save|remove|delete|send|invite|create|place|blast|accept|decline|record)[A-Za-z]*\s*\(/i;
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('button, [onclick], [role="button"]');
    if (!btn) return;
    const cls = typeof btn.className === 'string' ? btn.className : '';
    const oc = (btn.getAttribute && btn.getAttribute('onclick')) || '';
    const isAction = /\bbtn-confirm\b/.test(cls) || /\bbtn-danger\b/.test(cls) || MUTATING.test(oc);
    if (!isAction) return;
    const now = Date.now();
    if (btn === _actGuardBtn && (now - _actGuardAt) < WINDOW_MS) {
      // Duplicate activation — swallow it before the inline handler runs.
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    _actGuardBtn = btn;
    _actGuardAt = now;
  }, true);
})();

function openSheet(id) { resetActionGuard(); document.getElementById(id).classList.add('open'); }
function closeSheet(id) {
  if (id === 'editOverlay') editStopwatchClearTick();
  if (id === 'kidRoutineOverlay') kidRoutineStopwatchClearTick();
  if (id === 'kidTrainingOverlay') kidTrainingStopwatchClearTick();
  if (id === 'activityOverlay' || id === 'trainingOverlay') cancelCreatePlacement(null, true);
  document.getElementById(id).classList.remove('open');
  // The meeting is the only surface that confirms days / records the week, so
  // refresh the parent dashboard's read-only hub whenever the meeting closes.
  if (id === 'familyMeetingOverlay') {
    const sp = document.getElementById('screen-parent');
    if (sp && sp.classList.contains('active')) renderParentHome();
  }
}
function overlayClick(e, id) { if (e.target.classList.contains('overlay')) closeSheet(id); }
function toggleRepeat(id) {
  const el = document.getElementById(id);
  el.classList.toggle('on');
  if (id==='trainingRepeat') {
    ts.repeat = el.classList.contains('on');
    document.getElementById('trainingRepeatDays').style.display = ts.repeat?'block':'none';
  } else if (id==='editRepeat') {
    editState.repeat = el.classList.contains('on');
    document.getElementById('editRepeatDays').style.display = editState.repeat?'block':'none';
    if (editState.repeat) {
      renderDayPicker('editDayPicker', editState.repeatDays, (days)=>{ editState.repeatDays = days; });
    }
  } else {
    as_.repeat = el.classList.contains('on');
    document.getElementById('activityRepeatDays').style.display = as_.repeat?'block':'none';
  }
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2500);
}

/* ════════════════════════════════════════════════════════════════
   MASCOT — per-profile owl (Hedwig-style)
════════════════════════════════════════════════════════════════ */
function ensureMascotFields(p) {
  if (!p.mascotName) p.mascotName = '';
  if (typeof p.mascotIntroShown !== 'boolean') p.mascotIntroShown = false;
}

/* Called when a child profile's screen becomes active. Shows the owl button. */
function refreshMascotButton() {
  const btn = document.getElementById('mascotBtn');
  if (!btn) return;
  // Hide in parent mode and on the profile-picker screen
  const active = document.querySelector('.screen.active');
  const onDay = active && active.id === 'screen-day';
  if (isParent() || !onDay) { btn.classList.remove('show'); return; }
  const prof = activeProfile();
  if (prof !== 'jenn' && prof !== 'jess') { btn.classList.remove('show'); return; }
  btn.dataset.profile = prof;
  const deco = document.getElementById('mascotDeco');
  if (deco) deco.textContent = prof === 'jenn' ? '🎀' : '🧣';
  btn.classList.add('show');
}

/* First tap -> name prompt; subsequent taps -> recommendation based on day. */
async function onMascotClick() {
  const p = getProfData();
  ensureMascotFields(p);
  if (!p.mascotName) {
    hideMascot();
    const defaultName = activeProfile() === 'jenn' ? 'Hedwig' : 'My Owl';
    const name = ((await showPrompt("What should I call your owl? 🦉", { value: defaultName })) || '').trim();
    if (!name) return;
    p.mascotName = name.slice(0, 20);
    p.mascotIntroShown = true;
    saveAll();
    showMascotWithSuggestions(
      `Hi! I'm ${p.mascotName} 🦉 Tap me anytime for ideas about your day.`,
      []
    );
    return;
  }
  // Already named — give a recommendation
  mascotRecommend();
}

/* Build a message and render optional suggestion pills. */
function showMascotWithSuggestions(msg, suggestions, autoHide=true) {
  const msgEl = document.getElementById('mascotMsg');
  const sugWrap = document.getElementById('mascotSuggestions');
  if (!msgEl || !sugWrap) return;
  msgEl.textContent = msg;
  sugWrap.innerHTML = '';
  (suggestions || []).forEach(s => {
    const b = document.createElement('button');
    b.className = 'pill-btn';
    b.textContent = `${s.icon} ${s.name}`;
    b.onclick = () => {
      hideMascot();
      // Pre-select the activity in the tray so the child can tap a slot
      const all = getAllActivities();
      const act = all.find(a => a.id === s.id);
      if (act) selectActivity(act);
    };
    sugWrap.appendChild(b);
  });
  document.getElementById('mascot').classList.add('show');
  if (autoHide) setTimeout(hideMascot, 9000);
}

/* Preserve old signature (used by onboarding elsewhere). */
function showMascot(msg, autoHide=true) {
  showMascotWithSuggestions(msg, [], autoHide);
}
function hideMascot() { document.getElementById('mascot').classList.remove('show'); }

/* Figure out which "zone" a gap belongs to based on its start minute
   (absolute minutes-from-midnight). Weekends return 'weekend' always. */
function zoneForGap(absStartMin, isWeekend) {
  if (isWeekend) return 'weekend';
  // before-school < 8:00 (480), school 8:00-15:00 (900), after-school 15:00-18:00 (1080), evening >= 18:00
  if (absStartMin < 8*60)  return 'before-school';
  if (absStartMin < 15*60) return 'school';
  if (absStartMin < 18*60) return 'after-school';
  return 'evening';
}

/* Scan the current day's blocks, find the biggest free gap >= 90 min,
   pick 1–2 suitable activities, then show a suggestion. */
function mascotRecommend() {
  const p = getProfData();
  ensureMascotFields(p);
  const name = p.mascotName || 'I';
  const blocks = getDayBlocks(currentDayKey).slice().sort((a,b)=>a.startMin-b.startMin);

  // Day boundaries in minutes-from-6AM (internal) + absolute
  const dayStart = START_MIN;              // 360 (6am)
  const dayEnd   = START_MIN + DAY_MIN_SPAN; // 1260 (9pm)

  // Find biggest gap >= 90 min
  let bestGap = null, bestLen = 89;
  let cursor = dayStart;
  for (const b of blocks) {
    if (b.startMin > cursor) {
      const len = b.startMin - cursor;
      if (len > bestLen) { bestLen = len; bestGap = { startMin: cursor, durationMin: len }; }
    }
    cursor = Math.max(cursor, b.startMin + b.durationMin);
  }
  if (dayEnd > cursor) {
    const len = dayEnd - cursor;
    if (len > bestLen) { bestLen = len; bestGap = { startMin: cursor, durationMin: len }; }
  }

  if (!bestGap) {
    showMascotWithSuggestions(`Your day looks full already! Maybe rest tonight? 🌙`, []);
    return;
  }

  // Match activities by zone
  const d = formatDayKey(currentDayKey);
  const dow = d.getDay(); // 0=Sun, 6=Sat
  const isWeekend = (dow === 0 || dow === 6);
  const zone = zoneForGap(bestGap.startMin, isWeekend);

  const pool = getAllActivities().filter(a =>
    !a._locked &&
    Array.isArray(a.suitableTime) &&
    a.suitableTime.includes(zone) &&
    // Don't suggest things already on the day
    !blocks.some(b => b.actId === a.id) &&
    // Avoid "school_day" and other obligations — focus on fun/free/active
    (a.cat === 'free' || a.cat === 'active' || a.cat === 'school' || a.cat === 'training')
  );

  // Shuffle-ish using date seed so suggestions feel varied but stable within a day
  const seed = hashSeed(currentDayKey + '-' + zone + '-' + activeProfile());
  pool.sort((a,b) => ((hashSeed(a.id)^seed) % 1000) - ((hashSeed(b.id)^seed) % 1000));
  const picks = pool.slice(0, 2);

  const hours = Math.floor(bestLen / 60);
  const mins = bestLen % 60;
  const durLabel = hours ? `${hours}h${mins?' '+mins+'m':''}` : `${mins}m`;
  const zoneLabel = {
    'before-school':'this morning',
    'school':'during the school break',
    'after-school':'this afternoon',
    'evening':'tonight',
    'weekend':'today',
  }[zone] || 'today';

  if (!picks.length) {
    showMascotWithSuggestions(`You have ${durLabel} free ${zoneLabel}. Anything fun in mind? ✨`, []);
    return;
  }
  const listStr = picks.map(a => `${a.icon} ${a.name}`).join(' or ');
  showMascotWithSuggestions(
    `You have ${durLabel} free ${zoneLabel}. Want to try ${listStr}?`,
    picks
  );
}

/* ════════════════════════════════════════════════════════════════
   SISTER SYNC — edit-sheet helpers
════════════════════════════════════════════════════════════════ */
function togglePublic() {
  if (!editingBlockId) return;
  const blocks = getDayBlocks(currentDayKey);
  const blk = blocks.find(b=>b.id===editingBlockId);
  if (!blk) return;
  blk.public = !blk.public;
  setDayBlocks(currentDayKey, blocks);
  document.getElementById('publicToggle').classList.toggle('on', !!blk.public);
}
function sisterDetailsVisibleGlobal() {
  const vis = getSisterVisibilityState();
  return !vis.hideDetails;
}
function setSisterDetailsVisibleGlobal(next) {
  if (!state.shared) state.shared = {};
  state.shared.sisterVisibilityMode = next ? 'public' : 'busy-only';
  saveAll();
  if (document.querySelector('#screen-sync.active')) renderSync();
}
async function inviteSisterFromEdit() {
  if (!editingBlockId) return;
  const blocks = getDayBlocks(currentDayKey);
  const blk = blocks.find(b=>b.id===editingBlockId);
  if (!blk) return;
  const me = activeProfile();
  if (me !== 'jenn' && me !== 'jess') return;
  const sister = me === 'jenn' ? 'jess' : 'jenn';
  const sisterName = sister==='jenn'?'Jenn':'Jess';
  const act = getAllActivities(me).find(a=>a.id===blk.actId) || getAllActivities().find(a=>a.id===blk.actId);
  const activityLabel = act ? `${act.icon} ${act.name}` : 'this activity';
  const dayDate = formatDayKey(currentDayKey);
  const dayIdx = (dayDate.getDay()+6)%7;
  const ok = await showConfirm(`Share ${activityLabel} on ${DAY_SHORT[dayIdx]} at ${formatTimeFromMin(blk.startMin)} with ${sisterName}?`, { okLabel:'Share' });
  if (!ok) return;
  // Reuse existing sendInvite, but it expects currentDayKey/syncDayIdx context.
  // Inline here for clarity:
  const inv = {
    id: 'inv-'+Date.now().toString(36),
    from: me,
    to: sister,
    actId: blk.actId,
    day: currentDayKey,
    startMin: blk.startMin,
    durationMin: blk.durationMin,
    status: 'pending',
    createdAt: Date.now(),
    sourceBlockId: blk.id,
  };
  state.shared.invites = [...(state.shared.invites||[]), inv];
  // Track on the block too
  if (!Array.isArray(blk.invitedTo)) blk.invitedTo = [];
  if (!blk.invitedTo.includes(sister)) blk.invitedTo.push(sister);
  setDayBlocks(currentDayKey, blocks);
  showToast(`Invite sent to ${sister==='jenn'?'Jenn':'Jess'} 💌`);
}

