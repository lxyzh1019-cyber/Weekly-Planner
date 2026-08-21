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
   Read-only, and deliberately so: it is shipped code, identical on every
   device, replaced each August. It carries dates only — no school name, no
   district, no source document — because the repo is public. */
function paRenderSchool() {
  const wrap = document.getElementById('paSchoolWrap');
  if (!wrap) return;
  const today = todayKey();
  const stale = schoolCalendarIsStale(today);
  // Instructional days the shipped calendar actually yields, counted the same
  // way schoolCalendarIsRight counts them in the smoke suite.
  let days = 0;
  const d = formatDayKey(SCHOOL_TERM.start);
  const end = formatDayKey(SCHOOL_TERM.end);
  while (d <= end) { if (isSchoolDay(ctDateToKey(d))) days++; d.setDate(d.getDate() + 1); }
  const offRows = NO_SCHOOL_DAYS.filter(k => k >= today).slice(0, 6).map(k => {
    const dt = formatDayKey(k);
    return `<div class="pn-kv"><span>${DAY_SHORT[(dt.getDay() + 6) % 7]} ${dt.getDate()} ${MONTH_SHORT[dt.getMonth()]}</span>
      <span class="pn-n">no school</span></div>`;
  }).join('') || `<p class="pn-note">No more days off before the end of term.</p>`;
  return wrap.innerHTML = `<p class="pn-cap">School calendar</p>
    ${stale ? `<div class="pn-card pn-clear pa-stale">⚠️ This calendar has run out. Past
        <b>${escapeHtml(SCHOOL_TERM.nextStart)}</b> the app stops claiming to know which days are
        school days and falls back to weekday shape. Replace the term dates in
        <code>js/01-config.js</code>.</div>` : ''}
    <div class="pn-card pn-clear" style="${stale ? 'margin-top:0.6rem' : ''}">
      <div class="pn-kv"><span>Term runs</span><span class="pn-n">${escapeHtml(SCHOOL_TERM.start)} → ${escapeHtml(SCHOOL_TERM.end)}</span></div>
      <div class="pn-kv"><span>Next term starts</span><span class="pn-n">${escapeHtml(SCHOOL_TERM.nextStart)}</span></div>
      <div class="pn-kv"><span>Instructional days</span><span class="pn-n">${days}</span></div>
      <p class="pn-note">Shipped with the app and identical on every device, so it is not
        something one device can change. Replaced each August.</p>
    </div>
    <p class="pn-cap" style="margin-top:0.8rem">Next days off</p>
    <div class="pn-card pn-clear">${offRows}</div>`;
}

/* One delegated listener for all four, bound in js/99-main.js. */
function paHandleClick(e) {
  const pin = e.target.closest('[data-pa-action="pin"]');
  if (pin) { changeParentPin(); return; }
  const scale = e.target.closest('[data-pa-scale]');
  if (scale) { paSetTextScale(scale.getAttribute('data-pa-scale')); return; }
}
function paHandleChange(e) {
  const age = e.target.closest('[data-pa-age]');
  if (age) { age.value = paSetAge(age.getAttribute('data-pa-age'), age.value) ?? ''; }
}
