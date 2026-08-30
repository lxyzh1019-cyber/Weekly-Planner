// Weekly-Planner — App: the four screens behind the fifth destination.
//
// The boundary test puts things here when the answer is no: changing any of it
// leaves untouched what the girls are asked to do and what it is worth. That is
// the whole difference between this and Setup.
//
// Declarations only; wiring is in js/99-main.js.

/* ── Access ──
   One shared parent PIN. A second parent identity and "who graded this" are
   not here on purpose: they touch the auth boundary AUDIT-PRODUCT.md calls a
   P0, and that work comes first. */
function paRenderAccess() {
  const wrap = document.getElementById('paAccessWrap');
  if (!wrap) return;
  wrap.innerHTML = `<p class="pn-cap">Access</p>
    <div class="pn-card">
      <div class="pn-row pn-static">
        <span class="pn-ico" aria-hidden="true">🔑</span>
        <span class="pn-text"><span class="pn-title">Parent PIN</span>
          <span class="pn-sub">Everything a grown-up can change sits behind it</span></span>
        <button type="button" class="pn-cta" data-pa-action="pin">Change</button>
      </div>
    </div>
    <div class="pn-card pn-clear" style="margin-top:0.6rem">
      A second parent identity and stamping who graded each claim are not here
      yet — they touch the sign-in boundary, which is its own piece of work.
    </div>`;
}

/* ── Profiles ──
   The new home for age: a once-a-year correction that used to sit in the
   primary filter row of a weekly screen. The app assumes 10 and rolls it
   forward each August, so this is a correction and never a question. */
function paRenderProfiles() {
  const wrap = document.getElementById('paProfilesWrap');
  if (!wrap) return;
  const card = kid => {
    const name = kid === 'jenn' ? 'Jenn' : 'Jess';
    return `<div class="pn-card pa-profile">
      <div class="pa-prof-head">
        <span class="pa-avatar ${kid === 'jenn' ? 'pa-avatar-jenn' : 'pa-avatar-jess'}">${CT_PROFILE_ICON[kid]}</span>
        <span><span class="pn-title">${name}</span>
          <span class="pn-sub">Signs in from the profile picker</span></span>
      </div>
      <div class="pn-kv"><span>Age</span>
        <input class="pa-age" type="number" min="1" max="18" data-pa-age="${kid}"
               value="${escapeAttr(String(currentAge(kid) ?? ''))}"
               aria-label="Age of ${name}"></div>
      <div class="pn-kv"><span>Rolls forward</span><span>Every August</span></div>
      <p class="pn-note">Her yearly sports share lives in Setup › Money rules — it drives a
        required payment, so by the boundary test it belongs there, not here.</p>
    </div>`;
  };
  wrap.innerHTML = `<p class="pn-cap">Profiles</p>
    <div class="pa-profiles">${card('jenn')}${card('jess')}</div>`;
}

function paSetAge(kid, value) {
  const v = setKidAge(value, kid);
  showToast(`Age set to ${v} 🎂`);
  return v;
}

/* ── Preferences ──
   Only one thing here, and it is real. Week start, meeting day and theme were
   drawn in the redesign but nothing stores them, and a settings screen full of
   controls that do nothing is worse than a short one. --fs-scale already exists
   so a surface can scale its own small text; this is the grown-up surfaces
   using it. Per-device, so localStorage and never synced state — every write to
   synced state is a full-document upload. */
const PA_SCALE_KEY = 'wp.parentTextScale';
const PA_SCALES = [['1', 'Standard'], ['1.15', 'Larger'], ['1.3', 'Largest']];
function paTextScale() {
  try { return localStorage.getItem(PA_SCALE_KEY) || '1'; } catch (e) { return '1'; }
}
function paApplyTextScale() {
  const el = document.getElementById('screen-parent');
  if (el) el.style.setProperty('--fs-scale', paTextScale());
}
function paSetTextScale(v) {
  try { localStorage.setItem(PA_SCALE_KEY, v); } catch (e) {}
  paApplyTextScale();
  paRenderPrefs();
}
function paRenderPrefs() {
  const wrap = document.getElementById('paPrefsWrap');
  if (!wrap) return;
  const cur = paTextScale();
  wrap.innerHTML = `<p class="pn-cap">Preferences</p>
    <div class="pn-card pn-clear">
      <p class="pn-title">Reading size on grown-up screens</p>
      <p class="pn-sub">These pages are read at arm's length on a tablet. The girls' own
        screens are not affected.</p>
      <div class="pn-toggle" style="margin-top:0.6rem">${PA_SCALES.map(([v, label]) =>
        `<button type="button" class="pill-btn${v === cur ? ' active' : ''}"
           data-pa-scale="${v}">${escapeHtml(label)}</button>`).join('')}</div>
    </div>
    <div class="pn-card pn-clear" style="margin-top:0.6rem">
      Week start, meeting day and theme are not settings — the week starts Monday
      everywhere in the app, and the meeting happens when you open it.
    </div>`;
}

/* ── School calendar ──
   This page was read-only, and said so: "shipped with the app and identical on
   every device… replaced each August." That was true of the dates and it was
   the wrong answer for the hours. A district's bell times are not something a
   parent should have to open js/01-config.js to correct, and the shipped
   calendar never knew about lunch recess at all.

   So: the dates and hours a family sets live in state.shared.schoolCal and are
   read through schoolHours() / schoolTerm() / schoolOffDays() (js/05-helpers.js).
   The shipped calendar stays as the fallback and as the thing "Use the shipped
   ones" puts back. The repo still carries dates only — this is synced state,
   never committed — and the note below says so where a parent is typing. */
function paSchoolTimeRow(label, id, relMin, hint) {
  return `<div class="pa-time-row">
      <label for="${id}">${escapeHtml(label)}</label>
      <input type="time" id="${id}" value="${escapeAttr(relMinToTimeStr(relMin))}">
      ${hint ? `<span class="pn-note pa-time-hint">${escapeHtml(hint)}</span>` : ''}
    </div>`;
}

function paRenderSchool() {
  const wrap = document.getElementById('paSchoolWrap');
  if (!wrap) return;
  const today = todayKey();
  const stale = schoolCalendarIsStale(today);
  const cal = schoolCal();
  const h = schoolHours();
  const term = schoolTerm();
  const setHours = !!(cal.hours && (cal.hours.startMin != null || cal.hours.endMin != null));
  const setTerm = !!(cal.termStart || cal.termEnd || cal.nextStart);
  // Instructional days the calendar actually yields, counted the same way
  // schoolCalendarIsRight counts them in the smoke suite.
  let days = 0;
  const d = formatDayKey(term.start);
  const end = formatDayKey(term.end);
  while (d <= end) { if (isSchoolDay(ctDateToKey(d))) days++; d.setDate(d.getDate() + 1); }

  const off = schoolOffDays().filter(k => k >= today).sort();
  const added = new Set((cal.offDays || []).map(x => (x && x.date) || x));
  const offRows = off.slice(0, 8).map(k => {
    const dt = formatDayKey(k);
    const extra = (cal.offDays || []).find(x => ((x && x.date) || x) === k);
    const label = (extra && extra.label) || (added.has(k) ? 'added here' : 'no school');
    return `<div class="pn-kv"><span>${DAY_SHORT[(dt.getDay() + 6) % 7]} ${dt.getDate()} ${MONTH_SHORT[dt.getMonth()]}</span>
      <span class="pn-n">${escapeHtml(label)}${added.has(k) ? ' <button type="button" class="pa-x" data-pa-school="drop-off" data-date="' + escapeAttr(k) + '" aria-label="Remove this day off">✕</button>' : ''}</span></div>`;
  }).join('') || `<p class="pn-note">No more days off before the end of term.</p>`;

  wrap.innerHTML = `<p class="pn-cap">School calendar</p>
    ${stale ? `<div class="pn-card pn-clear pa-stale">⚠️ This calendar has run out. Past
        <b>${escapeHtml(term.nextStart)}</b> the app stops claiming to know which days are
        school days and falls back to weekday shape. Set the new term dates below.</div>` : ''}

    <p class="pn-cap" style="margin-top:0.8rem">School hours</p>
    <div class="pn-card">
      ${paSchoolTimeRow('School starts', 'paSchoolStart', h.startMin)}
      ${paSchoolTimeRow('Lunch recess', 'paSchoolLunch', h.lunchStartMin == null ? h.startMin : h.lunchStartMin)}
      <div class="pa-time-row">
        <label for="paSchoolLunchMin">…lasting</label>
        <input type="number" id="paSchoolLunchMin" min="0" max="180" step="5" value="${h.lunchMin || 0}">
        <span class="pn-note pa-time-hint">minutes — 0 for none</span>
      </div>
      ${paSchoolTimeRow('School ends', 'paSchoolEnd', h.endMin)}
      <div class="pn-toggle" style="margin-top:0.5rem">
        <button type="button" class="pill-btn active" data-pa-school="save-hours">Save hours</button>
        ${setHours ? `<button type="button" class="pill-btn" data-pa-school="reset-hours">Use the shipped hours</button>` : ''}
      </div>
      <p class="pn-note">These drive the coloured bands on the day and both week views, the
        School Day block, and every question the app asks about when school is on.</p>
    </div>

    <p class="pn-cap" style="margin-top:0.8rem">Term dates</p>
    <div class="pn-card">
      <div class="pa-time-row"><label for="paTermStart">Term starts</label>
        <input type="date" id="paTermStart" value="${escapeAttr(term.start)}"></div>
      <div class="pa-time-row"><label for="paTermEnd">Term ends</label>
        <input type="date" id="paTermEnd" value="${escapeAttr(term.end)}"></div>
      <div class="pa-time-row"><label for="paTermNext">Next term starts</label>
        <input type="date" id="paTermNext" value="${escapeAttr(term.nextStart)}"></div>
      <div class="pn-toggle" style="margin-top:0.5rem">
        <button type="button" class="pill-btn active" data-pa-school="save-term">Save dates</button>
        ${setTerm ? `<button type="button" class="pill-btn" data-pa-school="reset-term">Use the shipped dates</button>` : ''}
      </div>
      <div class="pn-kv" style="margin-top:0.4rem"><span>Instructional days</span><span class="pn-n">${days}</span></div>
    </div>

    <p class="pn-cap" style="margin-top:0.8rem">Days off</p>
    <div class="pn-card">${offRows}</div>
    <div class="pn-card" style="margin-top:0.4rem">
      <div class="pa-time-row">
        <input type="date" id="paOffDate" aria-label="A day with no school">
        <input type="text" id="paOffLabel" maxlength="40" placeholder="why — e.g. staff day" aria-label="Why there is no school">
        <button type="button" class="pill-btn" data-pa-school="add-off">Add</button>
      </div>
      <p class="pn-note">Statutory holidays and breaks are already in the shipped calendar; this is for
        the ones your school adds. Anything you type here syncs to the family's devices, so keep it
        general — no school name, no address.</p>
    </div>

    <!-- Rendered by scRenderImport (js/35-school-calendar.js). It owns the
         parsing and the preview; this page owns where they sit. -->
    <div id="scWrap"></div>`;
  scRenderImport();
}

/* Saving is one function per card rather than one per field: a school day whose
   start moved past its end is not a state worth storing for the half-second
   between two field changes. */
function paSaveSchoolHours() {
  const startMin = timeStrToRelMin((document.getElementById('paSchoolStart') || {}).value);
  const endMin = timeStrToRelMin((document.getElementById('paSchoolEnd') || {}).value);
  const lunchStartMin = timeStrToRelMin((document.getElementById('paSchoolLunch') || {}).value);
  const lunchMin = Math.max(0, Math.min(180, Number((document.getElementById('paSchoolLunchMin') || {}).value) || 0));
  if (startMin == null || endMin == null) { showToast('Those times are outside the planner day'); return; }
  if (endMin <= startMin) { showToast('School ends before it starts'); return; }
  if (lunchMin > 0 && (lunchStartMin == null || lunchStartMin < startMin || lunchStartMin + lunchMin > endMin)) {
    showToast('Lunch recess has to sit inside the school day'); return;
  }
  if (!state.shared.schoolCal) state.shared.schoolCal = {};
  state.shared.schoolCal.hours = { startMin, endMin, lunchStartMin: lunchMin > 0 ? lunchStartMin : null, lunchMin };
  saveAll();
  paRenderSchool();
  refreshCurrentScreen && refreshCurrentScreen();
  showToast('School hours saved 🏫');
}

function paSaveSchoolTerm() {
  const start = (document.getElementById('paTermStart') || {}).value || '';
  const end = (document.getElementById('paTermEnd') || {}).value || '';
  const next = (document.getElementById('paTermNext') || {}).value || '';
  if (!start || !end) { showToast('The term needs a first and a last day'); return; }
  if (end <= start) { showToast('The term ends before it starts'); return; }
  if (next && next <= end) { showToast('The next term starts before this one ends'); return; }
  if (!state.shared.schoolCal) state.shared.schoolCal = {};
  Object.assign(state.shared.schoolCal, { termStart: start, termEnd: end, nextStart: next || SCHOOL_TERM.nextStart });
  saveAll();
  paRenderSchool();
  refreshCurrentScreen && refreshCurrentScreen();
  showToast('Term dates saved 📅');
}

function paAddSchoolOffDay() {
  const date = (document.getElementById('paOffDate') || {}).value || '';
  const label = ((document.getElementById('paOffLabel') || {}).value || '').trim().slice(0, 40);
  if (!date) { showToast('Pick a date'); return; }
  if (!state.shared.schoolCal) state.shared.schoolCal = {};
  const list = state.shared.schoolCal.offDays || [];
  if (list.some(x => ((x && x.date) || x) === date)) { showToast('That day is already off'); return; }
  state.shared.schoolCal.offDays = [...list, { date, label: label || 'no school' }];
  saveAll();
  paRenderSchool();
  refreshCurrentScreen && refreshCurrentScreen();
  showToast('Day off added');
}

function paDropSchoolOffDay(date) {
  const cal = (state.shared.schoolCal || {});
  cal.offDays = (cal.offDays || []).filter(x => ((x && x.date) || x) !== date);
  saveAll();
  paRenderSchool();
  refreshCurrentScreen && refreshCurrentScreen();
}

/* Back to the shipped calendar. Removing the key rather than copying the
   shipped values in is what makes "shipped" mean shipped: next August's
   replacement then reaches this family without anyone pressing anything. */
function paResetSchool(what) {
  const cal = state.shared.schoolCal;
  if (!cal) return;
  if (what === 'hours') delete cal.hours;
  else { delete cal.termStart; delete cal.termEnd; delete cal.nextStart; }
  saveAll();
  paRenderSchool();
  refreshCurrentScreen && refreshCurrentScreen();
  showToast('Back to the shipped calendar');
}

function paHandleSchoolClick(e) {
  const btn = e.target.closest('[data-pa-school]');
  if (!btn) return;
  const act = btn.getAttribute('data-pa-school');
  if (act === 'save-hours') paSaveSchoolHours();
  else if (act === 'save-term') paSaveSchoolTerm();
  else if (act === 'reset-hours') paResetSchool('hours');
  else if (act === 'reset-term') paResetSchool('term');
  else if (act === 'add-off') paAddSchoolOffDay();
  else if (act === 'drop-off') paDropSchoolOffDay(btn.getAttribute('data-date'));
}

/* One delegated listener for all four, bound in js/99-main.js. */
function paHandleClick(e) {
  if (e.target.closest('[data-sc]')) { scHandleClick(e); return; }
  if (e.target.closest('[data-pa-school]')) { paHandleSchoolClick(e); return; }
  const pin = e.target.closest('[data-pa-action="pin"]');
  if (pin) { changeParentPin(); return; }
  const scale = e.target.closest('[data-pa-scale]');
  if (scale) { paSetTextScale(scale.getAttribute('data-pa-scale')); return; }
}
function paHandleChange(e) {
  if (e.target.closest('[data-sc]')) { scHandleChange(e); return; }
  const age = e.target.closest('[data-pa-age]');
  if (age) { age.value = paSetAge(age.getAttribute('data-pa-age'), age.value) ?? ''; }
}
