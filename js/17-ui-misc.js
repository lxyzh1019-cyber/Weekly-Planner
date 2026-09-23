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
  document.removeEventListener('keydown', _appChoiceKey, true);
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
  // A gated dialog can't be confirmed until its checkbox is ticked — Enter must
  // respect that too, not just the disabled button.
  const chk = document.getElementById('appDialogCheck');
  if (chk && !chk.checked) return;
  const inp = document.getElementById('appDialogInput');
  _closeAppDialog(inp ? inp.value : true);
}
/* Enable the OK button only once the box is ticked. */
function _appDialogCheckToggle() {
  const chk = document.getElementById('appDialogCheck');
  const ok = document.getElementById('appDialogOkBtn');
  if (chk && ok) ok.disabled = !chk.checked;
}
function _appDialogCancel() {
  const inp = document.getElementById('appDialogInput');
  _closeAppDialog(inp ? null : false);
}
function _appDialog({ message, kind, value = '', inputType = 'text', okLabel = 'OK', cancelLabel = 'Cancel', danger = false, checkLabel = '', hideCancel = false }) {
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
  // A checkbox turns "are you sure?" into "confirm this specific thing
  // happened" — the parent has to actively state the job was done, rather than
  // tapping OK out of habit.
  const checkHtml = checkLabel
    ? `<label class="app-dialog-check"><input type="checkbox" id="appDialogCheck" onchange="_appDialogCheckToggle()"> <span>${escapeHtml(checkLabel)}</span></label>`
    : '';
  ov.innerHTML =
    `<div class="sheet app-dialog-sheet" role="dialog" aria-modal="true" aria-labelledby="appDialogMsg">
      <div class="sheet-handle"></div>
      <p class="app-dialog-msg" id="appDialogMsg">${escapeHtml(message)}</p>
      ${inputHtml}${checkHtml}
      <div class="app-dialog-btns">
        ${hideCancel ? '' : `<button type="button" class="pill-btn app-dialog-cancel" onclick="_appDialogCancel()">${escapeHtml(cancelLabel)}</button>`}
        <button type="button" id="appDialogOkBtn" class="btn-confirm${danger ? ' danger' : ''}" style="width:auto;flex:1"${checkLabel ? ' disabled' : ''} onclick="_appDialogOk()">${escapeHtml(okLabel)}</button>
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
/* Informational, one button. For a message too long or too important to be a
   toast — a rejected file with a reason, say — where there is nothing to
   confirm and no second choice to offer. Resolves when dismissed. */
function showAlert(message, opts = {}) {
  return _appDialog({ message, kind: 'alert', okLabel: opts.okLabel || 'OK', hideCancel: true });
}
/* A confirm whose OK stays disabled until the checkbox is ticked. Use it where
   the tap is a factual assertion ("the job was done"), not just consent. */
function showCheckConfirm(message, checkLabel, opts = {}) {
  return _appDialog({ message, kind: 'confirm', checkLabel,
    okLabel: opts.okLabel || 'OK', cancelLabel: opts.cancelLabel || 'Cancel', danger: !!opts.danger });
}
function showPrompt(message, opts = {}) {
  return _appDialog({ message, kind: 'prompt', value: opts.value || '', inputType: opts.type || 'text', okLabel: opts.okLabel || 'OK', cancelLabel: opts.cancelLabel || 'Cancel' });
}
/* One question, N answers, each its own button — for "how did it go?", where
   OK/Cancel can't express the answer. Resolves the chosen option's `id`, or
   null if it was dismissed. `options` is [{ id, label, sub }]. */
function showChoice(message, options, opts = {}) {
  if (_appDialogResolve) _closeAppDialog(null);
  let ov = document.getElementById('appDialogOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'overlay';
    ov.id = 'appDialogOverlay';
    ov.addEventListener('click', e => { if (e.target === ov) _appDialogCancel(); });
    document.body.appendChild(ov);
  }
  const btns = (options || []).map((o, i) =>
    `<button type="button" class="app-dialog-choice" data-choice="${i}">
       <span class="app-dialog-choice-label">${escapeHtml(o.label)}</span>
       ${o.sub ? `<span class="app-dialog-choice-sub">${escapeHtml(o.sub)}</span>` : ''}
     </button>`).join('');
  ov.innerHTML =
    `<div class="sheet app-dialog-sheet" role="dialog" aria-modal="true" aria-labelledby="appDialogMsg">
      <div class="sheet-handle"></div>
      <p class="app-dialog-msg" id="appDialogMsg">${escapeHtml(message)}</p>
      <div class="app-dialog-choices">${btns}</div>
      <div class="app-dialog-btns">
        <button type="button" class="pill-btn app-dialog-cancel" onclick="_closeAppDialog(null)">${escapeHtml(opts.cancelLabel || 'Not yet')}</button>
      </div>
    </div>`;
  ov.querySelectorAll('[data-choice]').forEach(btn => {
    btn.addEventListener('click', () => {
      const o = options[Number(btn.getAttribute('data-choice'))];
      _closeAppDialog(o ? o.id : null);
    });
  });
  return new Promise(resolve => {
    _appDialogResolve = resolve;
    ov.classList.add('open');
    // Escape dismisses; Enter must NOT, because there is no single default
    // answer here — _appDialogKey's Enter branch would resolve `true`, which is
    // not one of the ids the caller is waiting for.
    document.addEventListener('keydown', _appChoiceKey, true);
    const first = ov.querySelector('[data-choice]');
    if (first) first.focus();
  });
}
function _appChoiceKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); _closeAppDialog(null); }
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

/* Sheets are dialogs. Opening one remembers what had focus and moves focus
   inside; closing puts it back. Escape closes the topmost open sheet
   (registered in js/99-main.js). No Tab trap — the girls use touch, and a trap
   that goes wrong is a screen nobody can leave. */
/* Text entry is deliberately NOT in this list: on an iPad, focusing a field
   raises the keyboard over half the sheet, so a sheet must only land on a
   field that asks for it with [autofocus]. Buttons, selects and switches are
   safe first stops; failing those, the sheet itself. */
const SHEET_FOCUSABLE = 'button:not([disabled]), select:not([disabled]), [href], [role="switch"], [tabindex]:not([tabindex="-1"])';
function sheetFocusIn(ov) {
  const sheet = ov.querySelector('.sheet') || ov;
  const first = sheet.querySelector('[autofocus]') || sheet.querySelector(SHEET_FOCUSABLE) || sheet;
  if (first === sheet && !sheet.hasAttribute('tabindex')) sheet.setAttribute('tabindex', '-1');
  try { first.focus({ preventScroll: true }); } catch (e) {}
}
function sheetFocusBack(ov) {
  const back = ov._opener; ov._opener = null;
  if (back && document.contains(back) && typeof back.focus === 'function') {
    try { back.focus({ preventScroll: true }); } catch (e) {}
  }
}
function topOpenSheetId() {
  const open = document.querySelectorAll('.overlay.open');
  return open.length ? open[open.length - 1].id : null;
}
function openSheet(id) {
  resetActionGuard();
  const ov = document.getElementById(id);
  const active = document.activeElement;
  if (!ov.classList.contains('open')) ov._opener = (active && !ov.contains(active)) ? active : null;
  ov.classList.add('open');
  sheetFocusIn(ov);
}
function closeSheet(id) {
  if (id === 'editOverlay') editStopwatchClearTick();
  if (id === 'kidRoutineOverlay') kidRoutineStopwatchClearTick();
  if (id === 'kidTrainingOverlay') kidTrainingStopwatchClearTick();
  if (id === 'activityOverlay' || id === 'trainingOverlay') cancelCreatePlacement(null, true);
  const ov = document.getElementById(id);
  const wasOpen = ov.classList.contains('open');
  ov.classList.remove('open');
  if (wasOpen && ov.contains(document.activeElement)) sheetFocusBack(ov); else ov._opener = null;
  /* The meeting used to be a sheet, and this function carried a special case
     for that one id — refresh the parent hub when it closed. The meeting is a
     screen now (js/15-meeting.js) and `mmHide` owns that refresh, which is
     where it always belonged: a general mechanism should not hold one caller's
     knowledge. */
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
      // Straight into placing it — there is no tray left to pre-select in.
      const act = getAllActivities().find(a => a.id === s.id);
      if (act) startPlacingActivity(act);
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
  /* Read from the school calendar rather than the 8:00/15:00/18:00 that used to
     be written here. Those were a guess, they disagreed with schoolHours() and
     therefore with dayZoneSegments — the bands the day view actually draws —
     and a family whose day ends at 2:50 had the mascot calling 2:55 "school".
     START_MIN is 6am, and these minutes are absolute from midnight, so the
     school hours (offsets from START_MIN) are shifted to match. */
  const h = schoolHours();
  const schoolStart = START_MIN + h.startMin;
  const schoolEnd   = START_MIN + h.endMin;
  if (absStartMin < schoolStart) return 'before-school';
  if (absStartMin < schoolEnd)   return 'school';
  // After school runs to the evening, three hours on from the last bell.
  if (absStartMin < schoolEnd + 180) return 'after-school';
  return 'evening';
}

/* ── WHAT TIME OF DAY IS IT, REGARDLESS OF WHAT KIND OF DAY IT IS ──
   `zoneForGap` answers 'weekend' on its FIRST LINE for every minute from six in
   the morning to ten at night, so on a non-school day the zone carries no
   time-of-day information whatever. Forty-seven of the seventy catalog entries
   declare 'weekend', so at half past twelve on a Saturday the picker was
   offering Evening Routine, Morning Routine and Dinner as things that "fit" —
   and ranking them above Lunch, because the row was ordered by how often the
   household had placed each one in the last four weeks. The hour she tapped
   changed nothing but the heading text.

   This is the clock alone. `midday` is the school-hours band on a day with no
   school — the one band the vocabulary could not say, and the reason Lunch had
   nowhere to belong. The bands come from the family's own schoolHours(), never
   from a constant, so they keep agreeing with the ones the day view draws. */
function clockZoneForMin(absStartMin) {
  const h = schoolHours();
  const schoolStart = START_MIN + h.startMin;
  const schoolEnd   = START_MIN + h.endMin;
  if (absStartMin < schoolStart) return 'before-school';
  if (absStartMin < schoolEnd)   return 'midday';
  if (absStartMin < schoolEnd + 180) return 'after-school';
  return 'evening';
}

/* ── HOW WELL DOES THIS ACTIVITY FIT THE MOMENT SHE TAPPED ──
   A score, not a yes/no. `suitableTime.includes(zone)` was a boolean with no
   notion of how well anything matched, so everything carrying 'weekend'
   qualified equally and the real ordering fell through to placement frequency.

   +3  the activity names this clock band: a direct hit on the hour.
   +1  it names the calendar zone ('weekend'): the right kind of day, and
       nothing at all about the time.
   −2  it names clock bands and none of them is this one. Breakfast is on
       record as a before-school thing; offered at half past twelve it is not
       merely unranked, it is wrong, and it should fall behind an activity that
       simply never said when it belongs.

   Only a positive score is suggested. Ties break appointments-last — a time
   somebody else set is not something a child picks to fill an afternoon — and
   then on recency, which is where the household's own habits still count. */
const PICKER_CLOCK_BANDS = ['before-school', 'midday', 'school', 'after-school', 'evening'];
function slotPickerFit(act, clockZone, calendarZone) {
  const want = Array.isArray(act && act.suitableTime) ? act.suitableTime : [];
  if (!want.length) return 0;
  let score = 0;
  let clockHit = false;
  if (clockZone && want.includes(clockZone)) { score += 3; clockHit = true; }
  /* A school day's 'school' band and a free day's 'midday' are the same hours.
     School Day itself says 'school'; Lunch says 'midday'. Each should read the
     other as a near miss rather than a contradiction — they are the same part
     of the day, just a different kind of one. */
  else if (clockZone === 'midday' && want.includes('school')) { score += 1; clockHit = true; }
  else if (clockZone === 'school' && want.includes('midday')) { score += 1; clockHit = true; }
  if (calendarZone && calendarZone !== clockZone && want.includes(calendarZone)) score += 1;
  /* THE PENALTY KEYS ON THE CLOCK, NOT ON THE TOTAL. Written as
     `score === 0` it never fired for anything carrying 'weekend' as well:
     Breakfast is `['before-school','weekend']`, so at half past twelve on a
     Saturday the weekend point rescued it and it ranked level with an activity
     that had never said when it belongs. Being on record as a MORNING thing is
     exactly what should sink it at midday. */
  const namesABand = want.some(w => PICKER_CLOCK_BANDS.includes(w));
  if (namesABand && !clockHit) score -= 2;
  return score;
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
/* Ask your sister to come and watch you compete.

   Goes through sendInvite rather than repeating it — sendInvite is the one
   writer of an invite, and owns the duplicate guard. sendInvite reads
   activeProfile(), so this works from the parent portal as well as from a
   kid's own screen. */
async function inviteSisterToWatch() {
  if (!editingBlockId) return;
  const blk = (getDayBlocks(currentDayKey) || []).find(b => b.id === editingBlockId);
  if (!blk) return;
  const me = activeProfile();
  if (me !== 'jenn' && me !== 'jess') return;
  await sendInvite(blk, me === 'jenn' ? 'jess' : 'jenn', { watch: true });
}

/* 💌 Invite my sister — the same thing, same time. It used to build its own
   invite inline, beside sendInvite, so a guard in one door missed the other.
   Now it is a door onto sendInvite and nothing more: sendInvite dates it from
   currentDayKey (the day this sheet is editing) and stamps the 💌 badge on
   activeProfile()'s own block. */
async function inviteSisterFromEdit() {
  if (!editingBlockId) return;
  const blk = (getDayBlocks(currentDayKey) || []).find(b => b.id === editingBlockId);
  if (!blk) return;
  const me = activeProfile();
  if (me !== 'jenn' && me !== 'jess') return;
  await sendInvite(blk, me === 'jenn' ? 'jess' : 'jenn');
}

