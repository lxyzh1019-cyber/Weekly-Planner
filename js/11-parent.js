// Weekly-Planner — parent mode: review, approvals, activity management, performance,
// routines, monthly heatmap, level rules. Extracted verbatim from index.html.
/* ════════════════════════════════════════════════════════════════
   PARENT MODE
════════════════════════════════════════════════════════════════ */
let parentTab = 'now';   // the panel on screen
let parentDest = 'now';  // which of the five destinations owns it

/* ── Scope, and why it is not parentViewing ──
   The switcher gains a "Both" state, but parentViewing cannot hold it: 27
   places read that global, and most of them are outside the portal entirely —
   activeProfile, the week view, block grading, the quest strip — and every one
   assumes a real child. A third value would have them silently fall back to
   Jenn or to Jess.

   So scope is its own flag, read only by the portal's own screens.
   parentViewing keeps holding the last real kid, so "open her full week" and
   everything downstream still has someone to open. */
let parentScope = 'both';   // 'both' | 'jenn' | 'jess'
function parentScopeKid() { return parentScope === 'both' ? null : parentScope; }

/* Five destinations. Each has a home panel; anything else it owns is a detail
   reached from that home, with a back link rather than a second nav row. */
const PARENT_DESTS = [
  { id: 'now',     icon: '📥', label: 'Now',     home: 'now' },
  { id: 'meeting', icon: '🧑‍🧑‍🧒', label: 'Meeting', home: 'review' },
  { id: 'history', icon: '📊', label: 'History', home: 'history' },
  { id: 'setup',   icon: '📋', label: 'Setup',   home: 'setup' },
  { id: 'app',     icon: '⚙️', label: 'App',     home: 'app' },
];
const PARENT_PANEL_DEST = {
  now: 'now', chores: 'now',
  review: 'meeting',
  history: 'history', trends: 'history', analysis: 'history',   // trends/analysis are the toggle's two halves
  setup: 'setup', options: 'setup', routines: 'setup', tasks: 'setup', money: 'setup', rules: 'setup',
  copyweek: 'setup',
  app: 'app', access: 'app', profiles: 'app', prefs: 'app', school: 'app', backup: 'app',
};
/* The landing lists. The boundary test decides which side a row falls on:
   does changing this alter what the girls are asked to do, or what it is
   worth? Yes → Setup. No → App. */
const PARENT_LANDINGS = {
  setup: [
    { panel: 'options',  icon: '🧹', title: 'Chores and pay',      sub: 'The pool, due times, lanes and who does what' },
    { panel: 'routines', icon: '🌅', title: 'Routines',            sub: 'Morning, after school, evening, and your own' },
    { panel: 'tasks',    icon: '✅', title: 'Activities and sports', sub: 'The library both girls draw from' },
    { panel: 'money',    icon: '💰', title: 'Money rules',         sub: 'Grades, caps, fines, loans and the week history' },
    { panel: 'rules',    icon: '⭐', title: 'Level-up',            sub: 'What earns a star on an activity' },
    { panel: 'copyweek', icon: '📋', title: 'Copy a plan',         sub: 'Put a week — or one day — onto another, or onto her sister’s' },
    { panel: 'money',    icon: '🕰️', title: 'Change history',      sub: 'Every version of the rules, when it took effect, and why',
      section: 'history' },
  ],
  app: [
    { panel: 'access',   icon: '🔒', title: 'Access',          sub: 'The parent PIN that everything here sits behind' },
    { panel: 'profiles', icon: '👤', title: 'Profiles',        sub: 'Who the girls are, and their age' },
    { panel: 'prefs',    icon: '🎛️', title: 'Preferences',     sub: 'Reading size on grown-up screens' },
    { panel: 'school',   icon: '📅', title: 'School calendar', sub: 'Term dates and days off — replaced each August' },
    { panel: 'backup',   icon: '🗄️', title: 'Backup and data', sub: 'Export, restore, cloud size, and resetting a week' },
  ],
};

/* ── History ──
   Trends and Performance both answered "how did the last eight weeks go", so
   they are one screen with a toggle rather than two tabs. Nothing inside either
   is rebuilt: the toggle shows one of the two panels that already exist, which
   is why every part of both — the pager, the CSV, the cumulative line, the
   heatmap, the written read, the nine categories, the month view — comes across
   untouched. */
let parentHistoryView = 'money';   // 'money' | 'time'
const PARENT_HISTORY_VIEWS = [
  { id: 'money', label: '💰 Money', panel: 'trends',
    note: 'What each week actually paid. Weeks with no meeting held paid nothing — the gap is the finding, not missing data.' },
  { id: 'time',  label: '⏱️ Time and routines', panel: 'analysis',
    note: 'How much of what was planned actually got done, and the month at a glance.' },
];
function setParentHistoryView(id) {
  parentHistoryView = id;
  setParentTab('history');
}
function parentRenderHistory() {
  const wrap = document.getElementById('ptab-history-wrap');
  if (!wrap) return;
  const view = PARENT_HISTORY_VIEWS.find(v => v.id === parentHistoryView) || PARENT_HISTORY_VIEWS[0];
  wrap.innerHTML = `<div class="pn-toggle">${PARENT_HISTORY_VIEWS.map(v =>
      `<button type="button" class="pill-btn${v.id === view.id ? ' active' : ''}" data-parent-history="${v.id}">${escapeHtml(v.label)}</button>`).join('')}</div>
    <p class="pn-note">${escapeHtml(view.note)}</p>`;
  // The two halves live in their own panels; show the one this view names.
  PARENT_HISTORY_VIEWS.forEach(v => {
    const el = document.getElementById('ptab-' + v.panel);
    if (el) el.hidden = (v.id !== view.id);
  });
  const render = PARENT_PANEL_RENDERERS[view.panel];
  if (render) { try { render(); } catch (e) { console.error('history view failed:', view.id, e); } }
}

/* A landing is rows, not a second row of tabs. */
function parentRenderLanding(destId) {
  const wrap = document.getElementById('ptab-' + destId + '-wrap');
  if (!wrap) return;
  const dest = PARENT_DESTS.find(d => d.id === destId) || {};
  const rows = (PARENT_LANDINGS[destId] || []).map(r => `
    <button type="button" class="pn-row" data-parent-panel="${escapeAttr(r.panel)}"${r.section ? ` data-parent-section="${escapeAttr(r.section)}"` : ''}>
      <span class="pn-ico" aria-hidden="true">${r.icon}</span>
      <span class="pn-text"><span class="pn-title">${escapeHtml(r.title)}</span>
        <span class="pn-sub">${escapeHtml(r.sub)}</span></span>
      <span class="pn-chev" aria-hidden="true">›</span>
    </button>`).join('');
  wrap.innerHTML = `<p class="pn-cap">${escapeHtml(dest.label || '')}</p><div class="pn-card">${rows}</div>`;
}

/* One switcher, in the top bar, replacing the three that each drew their own. */
function parentRenderScope() {
  const wrap = document.getElementById('parentScopePills');
  if (!wrap) return;
  const opts = [['both', 'Both'], ['jenn', '🐥 Jenn'], ['jess', '🦊 Jess']];
  wrap.innerHTML = opts.map(([id, label]) =>
    `<button type="button" class="pill-btn${parentScope === id ? ' active' : ''}"
       data-parent-scope="${id}">${label}</button>`).join('');
}

function setParentScope(scope) {
  parentScope = scope;
  // Keep parentViewing on a real child, always: everything outside this portal
  // reads it and none of it can do anything with "both".
  if (scope === 'jenn' || scope === 'jess') parentViewing = scope;
  parentRenderScope();
  setParentTab(parentTab);
}

/* The phone's bottom bar. Same idea as the kid nav (js/31-today.js) and the
   same 44px floor, but it drives setParentDest rather than showScreen —
   the portal is one screen with panels, not five screens. */
function parentRenderNav() {
  const nav = document.getElementById('parentNav');
  if (!nav) return;
  const show = isParent() && document.getElementById('screen-parent')?.classList.contains('active');
  nav.hidden = !show;
  document.body.classList.toggle('has-parent-nav', !!show);
  if (!show) return;
  const waiting = (typeof pnWaitingCount === 'function') ? pnWaitingCount() : 0;
  nav.innerHTML = PARENT_DESTS.map(d => {
    const on = d.id === parentDest;
    const badge = (d.id === 'now' && waiting) ? `<span class="pn-navdot">${waiting}</span>` : '';
    return `<button type="button" class="parent-nav-btn${on ? ' on' : ''}"
        data-parent-dest="${d.id}"${on ? ' aria-current="page"' : ''}>
        <span class="parent-nav-icon" aria-hidden="true">${d.icon}${badge}</span>
        <span class="parent-nav-label">${escapeHtml(d.label)}</span>
      </button>`;
  }).join('');
}

function setParentDest(id) {
  const dest = PARENT_DESTS.find(d => d.id === id);
  if (!dest) return;
  setParentTab(dest.home);
}

/* One delegated listener for the destination nav, the landings and the scope
   pills, bound in js/99-main.js. */
function parentHandleNavClick(e) {
  const dest = e.target.closest('[data-parent-dest]');
  if (dest) { setParentDest(dest.getAttribute('data-parent-dest')); return; }
  const panel = e.target.closest('[data-parent-panel]');
  if (panel) {
    /* Change history is a section of Money rules, not a panel of its own — the
       log only makes sense next to the things it logs. The row names the
       section so it opens where it means to. */
    const sec = panel.getAttribute('data-parent-section');
    if (sec && typeof mnySetParentSection === 'function') mnyParentSection = sec;
    setParentTab(panel.getAttribute('data-parent-panel'));
    return;
  }
  const scope = e.target.closest('[data-parent-scope]');
  if (scope) { setParentScope(scope.getAttribute('data-parent-scope')); return; }
  const hist = e.target.closest('[data-parent-history]');
  if (hist) { setParentHistoryView(hist.getAttribute('data-parent-history')); return; }
  const back = e.target.closest('[data-parent-back]');
  if (back) { setParentDest(parentDest); return; }
}

/* One panel, one renderer. Tabs are pure show/hide, so rendering all ten on
   every call threw nine of them away — including both charts and the whole
   money rules page, on every kid switch, in an app where a render can trigger a
   full-document write.

   Every entry is an arrow rather than a bare reference: this file loads at 11
   and most of these are declared at 24–30, so naming them directly here would
   read them before their script has run. The arrow defers the lookup to the
   call, which is the point at which they exist. */
const PARENT_PANEL_RENDERERS = {
  now:      () => pnRenderNow(),
  history:  () => parentRenderHistory(),
  setup:    () => parentRenderLanding('setup'),
  app:      () => parentRenderLanding('app'),
  review:   () => { renderParentReviewHeader(); renderMeetingHub(); renderReviewFeedback(); },
  chores:   () => cpRenderChoreTab(),
  options:  () => coRenderOptions(),
  trends:   () => ctrRenderTrends(),
  analysis: () => renderPerformance(),
  routines: () => renderRoutinesList(),
  tasks:    () => { renderPendingApproval(); renderPendingTaskApproval(); renderParentActivities(); },
  money:    () => mnyRenderRulesTab(),
  rules:    () => renderLevelRules(),
  copyweek: () => pcwRender(),
  access:   () => paRenderAccess(),
  profiles: () => paRenderProfiles(),
  prefs:    () => paRenderPrefs(),
  school:   () => paRenderSchool(),
  backup:   () => bkRenderPanel(),
};

function renderParentHome() {
  // Shared chrome first, then only the panel actually on screen.
  parentRenderScope();
  setParentTab(parentTab);
}

/* The review panel's own header — kid name, age field, kid pills. It moved in
   here with the rest of that panel's rendering rather than staying in
   renderParentHome, where it would have run for every tab. */
function renderParentReviewHeader() {
  const name = document.getElementById('reviewKidName');
  if (name) name.textContent = parentViewing === 'jenn' ? '🐥 Jenn' : '🦊 Jess';
}

/* Age moved to App › Profiles, which draws a field per kid and writes through
   setKidAge. renderParentAge and onParentAgeChange targeted one input on the
   Weekly Review screen and had nothing left to point at. */

function setParentTab(tab) {
  parentTab = tab;
  parentDest = PARENT_PANEL_DEST[tab] || parentDest;
  const dest = PARENT_DESTS.find(d => d.id === parentDest);
  document.querySelectorAll('#screen-parent .parent-tab').forEach(t => {
    const on = t.dataset.pdest === parentDest;
    t.classList.toggle('active', on);
    // A strip that says role="tab" has to answer which one is selected and what
    // it controls, and has to be one stop in the tab order rather than five.
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
  });
  document.querySelectorAll('#screen-parent .parent-panel').forEach(p =>
    p.hidden = (p.id !== 'ptab-' + tab));
  /* A detail is reached from its destination's home, so it gets one back link
     rather than the destination growing a second row of tabs. */
  const back = document.getElementById('parentBack');
  if (back) {
    const isDetail = !!dest && dest.home !== tab;
    back.hidden = !isDetail;
    if (isDetail) {
      const row = (PARENT_LANDINGS[parentDest] || []).find(r => r.panel === tab);
      back.innerHTML = `<button type="button" class="pill-btn" data-parent-back="1">◀ ${escapeHtml(dest.label)}</button>
        <span class="parent-crumb">${escapeHtml(row ? row.title : '')}</span>`;
    }
  }
  const render = PARENT_PANEL_RENDERERS[tab];
  // Isolated the way showScreen isolates its hooks: one panel that throws must
  // not be able to leave the portal on a blank screen with no way back.
  if (render) { try { render(); } catch (e) { console.error('parent panel render failed:', tab, e); } }
  parentRenderNav();
}

/* Arrow keys move between destinations; Home/End jump to the ends. Bound once
   in js/99-main.js. Roving tabindex is set in setParentTab above, so focus
   follows selection and the strip stays a single stop in the tab order. */
function parentTabsKeydown(e) {
  const tabs = [...document.querySelectorAll('#screen-parent .parent-tab')];
  const i = tabs.indexOf(document.activeElement);
  if (i < 0 || !tabs.length) return;
  let next = null;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length;
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = tabs.length - 1;
  if (next === null) return;
  e.preventDefault();
  setParentDest(tabs[next].dataset.pdest);
  tabs[next].focus();
}

// Switch which child the parent is reviewing without leaving the dashboard.
function setParentKid(kid) {
  setParentScope(kid);
}

/* The Meeting destination's home. Review & confirm lives in ONE place —
   the meeting itself. This is read-only status for the meeting's week:
   the 7-day strip mirrors the meeting's day-confirms (both kids), and every
   tap opens the meeting itself rather than confirming in a second surface. */
function renderMeetingHub() {
  const wrap = document.getElementById('meetingHub');
  if (!wrap) return;
  ctPrepareRead();
  const wk = ctWeekKey || ctThisWeekKey();
  const info = ctWeekInfo();
  const held = !!(state.shared.chore.meetingsHeld && state.shared.chore.meetingsHeld[wk]);
  const nConfirmed = [0,1,2,3,4,5,6].filter(mmIsDayConfirmed).length;
  let days = '';
  for (let d = 0; d < 7; d++) {
    const date = new Date(info.mon); date.setDate(info.mon.getDate() + d);
    const k = ctDateToKey(date);
    const confirmed = mmIsDayConfirmed(d);
    days += `<button type="button" class="review-day${confirmed ? ' confirmed' : ''}${k === todayKey() ? ' today' : ''}" onclick="openFamilyMeetingAt(1,${d})">
        <span class="review-day-dow">${DAY_SHORT[d]}</span>
        <span class="review-day-date">${date.getDate()}</span>
        <span class="review-day-count">🐥${mmDayPct('jenn', d)}% 🦊${mmDayPct('jess', d)}%</span>
        <span class="review-day-state">${confirmed ? '✓ Confirmed' : 'Review ›'}</span>
      </button>`;
  }
  const weekLabel = `${MONTH_SHORT[info.mon.getMonth()]} ${info.mon.getDate()} – ${MONTH_SHORT[info.sun.getMonth()]} ${info.sun.getDate()}`;
  /* pool.cameIn, not ctWeekMoney. This line says "pocket money so far" and it is
     the parent's front door to the meeting, but it used to read the earnings
     net — so a $50 birthday cheque already sitting in the week was invisible
     here and then appeared out of nowhere at the table. Anything labelled as
     the week's money is the pool's number; "earned for her work" is a
     different figure and keeps its own label elsewhere. */
  const money = ['jenn', 'jess'].map(kid =>
    `${CT_PROFILE_ICON[kid]} $${mnyPool(wk, kid).cameIn.toFixed(2)}`).join(' · ');
  const status = held
    ? `<div class="hub-status hub-status-done">✅ This week is recorded — pocket money was credited at the meeting.</div>`
    : `<div class="hub-status">${nConfirmed}/7 days confirmed · pocket money so far: ${money}</div>`;
  const cta = held
    ? `<button type="button" class="pill-btn" onclick="openFamilyMeetingAsk()">🧑‍🧑‍🧒 Re-open the meeting</button>`
    : `<button type="button" class="btn-confirm" onclick="openFamilyMeetingAsk()">🧑‍🧑‍🧒 ${nConfirmed > 0 ? 'Continue the' : 'Run'} family meeting</button>`;
  wrap.innerHTML = `<div class="hub-week">Week of ${escapeHtml(weekLabel)}</div>
    <div class="review-day-row">${days}</div>${status}
    <div style="margin-top:0.6rem">${cta}</div>${mmCatchUpBanner()}`;
}
// Deep-link into the meeting: used by the hub's day strip to open the exact
// day a parent wants to review, inside the one-and-only confirm surface.
function openFamilyMeetingAt(step, day) {
  if (!isParent()) { showToast('Parents run the family meeting 🔒'); return; }
  openFamilyMeeting();
  mmStep = step;
  mmSelectedDay = day == null ? null : day;
  renderMeetingMode();
}

/* Feedback from the kid: the moods/vibes they logged each day this week,
   plus their free-text weekly note (written from the Quest Board). */
function renderReviewFeedback() {
  const wrap = document.getElementById('reviewFeedback');
  if (!wrap) return;
  const kid = parentViewing;
  const pd = getProfData(kid);
  const keys = getDayKeys(weekOffset);
  const wkKey = keys[0];
  let html = '';
  const note = pd && pd.weekFeedback && pd.weekFeedback[wkKey];
  if (note && note.trim()) {
    html += `<div class="feedback-week-note">💬 <b>Their note this week:</b><br>${escapeHtml(note.trim())}</div>`;
  }
  const moods = keys.map((k, i) => {
    const m = pd && pd.dayMoods && pd.dayMoods[k];
    return m ? `<span title="${DAY_SHORT[i]}">${DAY_SHORT[i]} ${m}</span>` : null;
  }).filter(Boolean);
  if (moods.length) {
    html += `<div class="feedback-item">🌈 <b>Daily vibes:</b> ${moods.join(' · ')}</div>`;
  }
  if (!html) html = '<p class="feedback-empty">No feedback yet — vibes and notes your kid logs this week will show here.</p>';
  wrap.innerHTML = html;
}

/* Task approval: activities a kid added themselves wait for a parent's OK. */
function pendingApprovalActs() {
  const out = [];
  ['jenn','jess'].forEach(p => {
    ((state.profiles[p] && state.profiles[p].customActivities) || []).forEach(a => {
      if (a.pendingApproval) out.push({ act: a, owner: p });
    });
  });
  return out;
}
function renderPendingApproval() {
  const wrap = document.getElementById('pendingApprovalList');
  if (!wrap) return;
  const pending = pendingApprovalActs();
  if (!pending.length) { wrap.innerHTML = '<p class="feedback-empty">Nothing waiting — new activities the girls add will appear here.</p>'; return; }
  wrap.innerHTML = '';
  pending.forEach(({ act, owner }) => {
    const card = document.createElement('div');
    card.className = 'challenge-card';
    card.innerHTML = `
      <div class="challenge-title">${act.icon||'⭐'} ${escapeHtml(act.name)} <span style="font-size:0.7rem;color:var(--ink-light);font-family:'Patrick Hand'">· ${owner==='jenn'?'🐥 Jenn':'🦊 Jess'} added</span></div>
      <div style="font-size:0.85rem;color:var(--ink-light)">${(act.durationMin||60)} min · ${act.cat||'free'}</div>
      <div style="display:flex;justify-content:flex-end;gap:0.4rem;margin-top:0.4rem;flex-wrap:wrap">
        <button class="btn-icon" style="padding:2px 8px;background:var(--accent-green)" onclick="approveKidActivity('${escapeJsAttr(owner)}','${escapeJsAttr(act.id)}')">✅ Approve</button>
        <button class="btn-icon" style="padding:2px 8px" onclick="openParentActivityEditor('${escapeJsAttr(owner)}','${escapeJsAttr(act.id)}')">✏️ Modify</button>
        <button class="btn-icon" style="padding:2px 8px" onclick="rejectKidActivity('${escapeJsAttr(owner)}','${escapeJsAttr(act.id)}')">🗑 Reject</button>
      </div>`;
    wrap.appendChild(card);
  });
}
/* ── The same queue, for exercises ──
   state.shared.customTasks is the girls' library of drills — "50m Freestyle
   (x4)" — and anything either of them typed went straight into it with nothing
   to tell a parent it had happened. It is a proposal now, like an activity.

   Shared rather than per-child, so there is no owner array to read: addedBy on
   the record says whose it is. */
function pendingApprovalTasks() {
  return (state.shared.customTasks || [])
    .filter(t => t && t.pendingApproval && !t.archived)
    .map(t => ({ task: t, owner: t.addedBy }));
}
function renderPendingTaskApproval() {
  const wrap = document.getElementById('pendingTaskList');
  if (!wrap) return;
  const pending = pendingApprovalTasks();
  if (!pending.length) {
    wrap.innerHTML = '<p class="feedback-empty">Nothing waiting — new exercises the girls add will appear here.</p>';
    return;
  }
  wrap.innerHTML = '';
  pending.forEach(({ task, owner }) => {
    const who = kidLabel(owner);
    const sport = getTrainingTopic(task.sport);
    const card = document.createElement('div');
    card.className = 'challenge-card';
    card.innerHTML = `
      <div class="challenge-title">🏋️ ${escapeHtml(task.name)}${task.reps ? ` <span style="font-weight:700">(${escapeHtml(task.reps)})</span>` : ''}
        <span style="font-size:0.7rem;color:var(--ink-light);font-family:'Patrick Hand'">· ${escapeHtml(who.icon + ' ' + who.name)} added</span></div>
      <div style="font-size:0.85rem;color:var(--ink-light)">${escapeHtml(sport ? sport.name : (task.sport || 'general'))}${task.notes ? ' · ' + escapeHtml(task.notes) : ''}</div>
      <div style="display:flex;justify-content:flex-end;gap:0.4rem;margin-top:0.4rem;flex-wrap:wrap">
        <button class="btn-icon" style="padding:2px 8px;background:var(--accent-green)" data-task-approve="${escapeAttr(task.id)}">✅ Approve</button>
        <button class="btn-icon" style="padding:2px 8px" data-task-reject="${escapeAttr(task.id)}">🗑 Reject</button>
      </div>`;
    wrap.appendChild(card);
  });
}
function approveKidTask(id) {
  const t = (state.shared.customTasks || []).find(x => x.id === id);
  if (!t) return;
  delete t.pendingApproval;
  markItemUpdated && markItemUpdated(t);
  saveAll();
  renderPendingTaskApproval();
  showToast('Approved ✅ — it stays in the library');
}
/* Archived, not deleted, and for the same reason rejectKidActivity archives:
   a task's text is already flattened into the blocks that used it, and keeping
   the record is what stops a delete on one device resurrecting elsewhere. */
async function rejectKidTask(id) {
  const t = (state.shared.customTasks || []).find(x => x.id === id);
  if (!t) return;
  if (!(await showConfirm('Take this exercise off the girls\' list?', { danger: true, okLabel: 'Take it off' }))) return;
  t.archived = true;
  t.archivedAt = syncNow();
  delete t.pendingApproval;
  markItemUpdated && markItemUpdated(t);
  saveAll();
  renderPendingTaskApproval();
  showToast('Off the list');
}
/* One delegated listener for the two buttons above, bound in js/99-main.js. */
function parentTaskApprovalClick(e) {
  const ok = e.target.closest('[data-task-approve]');
  if (ok) { approveKidTask(ok.getAttribute('data-task-approve')); return; }
  const no = e.target.closest('[data-task-reject]');
  if (no) { rejectKidTask(no.getAttribute('data-task-reject')); }
}

function approveKidActivity(owner, id) {
  const acts = (state.profiles[owner] && state.profiles[owner].customActivities) || [];
  const a = acts.find(x => x.id === id);
  if (!a) return;
  delete a.pendingApproval;
  markItemUpdated && markItemUpdated(a);
  saveAll();
  renderPendingApproval();
  renderParentActivities();
  showToast('Approved ✅');
}
/* Archived, not deleted — the same rule as deleteParentActivity, and for a
   sharper reason: a kid can place blocks with an activity while it is still
   waiting for approval, and the old path removed the record and left those
   blocks pointing at nothing, which made them fail to render at all. */
async function rejectKidActivity(owner, id) {
  if (!(await showConfirm('Take this activity the child added off the list?', { danger:true, okLabel:'Take it off' }))) return;
  const arr = (state.profiles[owner] && state.profiles[owner].customActivities) || [];
  const act = arr.find(x => x.id === id);
  if (!act) return;
  archiveParentActivity(act);
  saveAll();
  renderPendingApproval();
  renderParentActivities();
  showToast('Off the list');
}

/* ════════════════════════════════════════════════════════════════
   PARENT ACTIVITY MANAGEMENT (CRUD + sync)
════════════════════════════════════════════════════════════════ */
let parentActivityEdit = { mode:'new', sourceProfile:null, originalId:null };

function renderParentActivities() {
  const wrap = document.getElementById('parentActivitiesList');
  if (!wrap) return;
  wrap.innerHTML = '';
  const retired = [];

  const add = (a, owner) => {
    if (a.archived) { retired.push({ act: a, owner }); return; }
    wrap.appendChild(parentActivityCard(a, owner));
  };

  // Shared activities
  getSharedActivities().forEach(a => add(a, 'shared'));

  // Per-child activities
  ['jenn','jess'].forEach(p=>{
    const acts = (state.profiles[p] && state.profiles[p].customActivities) || [];
    acts.forEach(a => {
      // Skip routine-shadow activities (they're managed via the Routines section)
      if (a.isRoutine) return;
      // Pending kid-added activities show in the approval section above.
      if (a.pendingApproval && !a.archived) return;
      add(a, p);
    });
  });

  if (!wrap.children.length && !retired.length) {
    wrap.innerHTML = '<div class="gt-empty">No custom activities yet. Tap ＋ to add one.</div>';
  }
  /* Taken off the list, still holding their history — and reversible. A retired
     activity that could not be brought back would be a delete with extra steps.
     Collapsed by default: this is a shelf, not part of the working list. */
  if (retired.length) {
    const det = document.createElement('details');
    det.className = 'pa-retired';
    det.innerHTML = `<summary>🗄 Taken off the list (${retired.length})</summary>`;
    retired.forEach(({ act, owner }) => {
      const row = document.createElement('div');
      row.className = 'pa-retired-row';
      const n = countBlocksUsingActivity(act.id);
      row.innerHTML = `<span class="pa-retired-name">${escapeHtml(act.icon || '⭐')} ${escapeHtml(act.name)}</span>
        <span class="pa-retired-meta">${n} block${n === 1 ? '' : 's'} in history</span>`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pill-btn';
      btn.textContent = 'Put it back';
      btn.onclick = () => unarchiveParentActivity(owner, act.id);
      row.appendChild(btn);
      det.appendChild(row);
    });
    wrap.appendChild(det);
  }
}

function parentActivityCard(act, owner) {
  const card = document.createElement('div');
  card.className = 'challenge-card';
  const ownerLabel = owner==='shared' ? '🔗 Shared'
                    : owner==='jenn'   ? '🐥 Jenn only'
                    : '🦊 Jess only';
  card.innerHTML = `
    <div class="challenge-title">${act.icon||'⭐'} ${escapeHtml(act.name)} <span style="font-size:0.7rem;color:var(--ink-light);font-family:'Patrick Hand'">· ${escapeHtml(ownerLabel)}</span></div>
    <div style="font-size:0.85rem;color:var(--ink-light)">${(act.durationMin||60)} min · ${act.cat||'free'}</div>
    <div style="display:flex;justify-content:flex-end;gap:0.4rem;margin-top:0.4rem;flex-wrap:wrap">
      <button class="btn-icon" onclick="toggleShareActivity('${escapeJsAttr(owner)}','${escapeJsAttr(act.id)}')" style="padding:2px 8px" title="${owner==='shared'?'Move to single child':'Promote to shared'}">${owner==='shared'?'↩️ Unshare':'🔗 Share'}</button>
      <button class="btn-icon" onclick="openParentActivityEditor('${escapeJsAttr(owner)}','${escapeJsAttr(act.id)}')" style="padding:2px 8px">✏️ Edit</button>
      <button class="btn-icon" onclick="deleteParentActivity('${escapeJsAttr(owner)}','${escapeJsAttr(act.id)}')" style="padding:2px 8px">🗑</button>
    </div>
  `;
  return card;
}

function openParentActivityEditor(owner, id) {
  // No args = new activity
  if (!owner) {
    parentActivityEdit = { mode:'new', sourceProfile:null, originalId:null };
    document.getElementById('parentActivityHeading').textContent = '✨ Add Activity';
    document.getElementById('paConfirmBtn').textContent = 'Add ✅';
    document.getElementById('paName').value = '';
    document.getElementById('paIcon').value = '';
    document.getElementById('paDur').value = '60';
    document.getElementById('paCat').value = 'free';
    document.getElementById('paVisibility').value = 'shared';
    renderEmojiGrid('paEmojiGrid', 'paIcon', '');
    openSheet('parentActivityOverlay');
    return;
  }
  const act = findParentActivity(owner, id);
  if (!act) { showToast('Activity not found'); return; }
  parentActivityEdit = { mode:'edit', sourceProfile:owner, originalId:id };
  document.getElementById('parentActivityHeading').textContent = '✏️ Edit Activity';
  document.getElementById('paConfirmBtn').textContent = 'Save ✅';
  document.getElementById('paName').value = act.name || '';
  document.getElementById('paIcon').value = act.icon || '';
  document.getElementById('paDur').value = String(act.durationMin || 60);
  document.getElementById('paCat').value = act.cat || 'free';
  document.getElementById('paVisibility').value = owner==='shared' ? 'shared' : owner;
  renderEmojiGrid('paEmojiGrid', 'paIcon', act.icon || '');
  openSheet('parentActivityOverlay');
}

function findParentActivity(owner, id) {
  if (owner === 'shared') return getSharedActivities().find(a=>a.id===id);
  return ((state.profiles[owner]||{}).customActivities||[]).find(a=>a.id===id);
}

function removeParentActivity(owner, id) {
  // Tombstone the removal so the sync merge can't restore it from another
  // device (a move records the removal in the OLD collection only).
  if (owner === 'shared') {
    state.shared.sharedActivities = (state.shared.sharedActivities||[]).filter(a=>a.id!==id);
    tombstoneIds('sa:', [id]);
  } else {
    state.profiles[owner].customActivities = (state.profiles[owner].customActivities||[]).filter(a=>a.id!==id);
    tombstoneIds('ca:' + owner + ':', [id]);
  }
}

function confirmParentActivity() {
  const name = document.getElementById('paName').value.trim();
  const icon = document.getElementById('paIcon').value.trim() || '⭐';
  const cat  = document.getElementById('paCat').value;
  const durationMin = parseInt(document.getElementById('paDur').value) || 60;
  const vis  = document.getElementById('paVisibility').value;
  if (!name) { showToast('Enter a name'); return; }

  if (parentActivityEdit.mode === 'edit') {
    // Find + update the existing activity in place.
    const oldOwner = parentActivityEdit.sourceProfile;
    const id = parentActivityEdit.originalId;
    const existing = findParentActivity(oldOwner, id);
    if (!existing) { showToast('Not found'); return; }
    existing.name = name; existing.icon = icon; existing.cat = cat; existing.durationMin = durationMin;
    markItemUpdated(existing);
    // Visibility moved? Migrate the activity object to the new collection (preserving its id so placed blocks still resolve).
    const newOwner = vis;
    if (newOwner !== oldOwner) {
      removeParentActivity(oldOwner, id);
      if (newOwner === 'shared') {
        state.shared.sharedActivities = [...(state.shared.sharedActivities||[]), existing];
      } else {
        state.profiles[newOwner].customActivities = [...((state.profiles[newOwner]||{}).customActivities||[]), existing];
      }
    }
    saveAll();
    closeSheet('parentActivityOverlay');
    renderParentActivities();
    showToast('Activity saved ✅');
    return;
  }

  // Create new
  const newAct = {
    id: 'custom-'+Date.now().toString(36)+Math.random().toString(36).slice(2,4),
    name, icon, cat, durationMin, custom:true
  };
  if (vis === 'shared') {
    state.shared.sharedActivities = [...(state.shared.sharedActivities||[]), newAct];
  } else {
    state.profiles[vis].customActivities = [...((state.profiles[vis]||{}).customActivities||[]), newAct];
  }
  saveAll();
  closeSheet('parentActivityOverlay');
  renderParentActivities();
  showToast('Activity added ✅');
}

/* ── Retiring an activity ──
   This used to delete: it stripped the activity from the library and then swept
   BOTH kids' `weeks` with no date filter, removing every block that had ever
   referenced it — from last March as readily as from next Tuesday — tombstoning
   the lot so sync could not bring them back, and then rebuilding
   activityCounts/activityHours from what was left, which zeroed the level-up
   progress those years of blocks had earned. Irreversible, and there was no
   undo. A piano teacher stops and the record of two years of piano goes with
   her.

   It is the exact opposite of the rule the routine editor next door already
   follows ("Past blocks are preserved as historical record"), and the opposite
   of what a family means by "take this off the list".

   So: archive. The activity record stays, marked, so every past block still
   resolves to its own name, icon and colour — findActivity sees archived
   entries on purpose. It disappears from every picker. Blocks from TODAY
   forward are removed, because a plan for next week that names a retired
   activity is a plan nobody can act on. Nothing before today is touched, and
   the counts stand. */
async function deleteParentActivity(owner, id) {
  const act = findParentActivity(owner, id);
  if (!act) { showToast('Not found'); return; }
  const future = countBlocksUsingActivity(id, todayKey());
  const past = countBlocksUsingActivity(id) - future;
  const msg = future
    ? `Take "${act.name}" off the list?\n\nIt is on ${future} day${future === 1 ? '' : 's'} from today onward — those will be removed.`
      + (past ? `\n\n${past} earlier block${past === 1 ? '' : 's'} stay exactly as ${past === 1 ? 'it is' : 'they are'}.` : '')
    : `Take "${act.name}" off the list?`
      + (past ? `\n\n${past} earlier block${past === 1 ? '' : 's'} stay exactly as ${past === 1 ? 'it is' : 'they are'}.` : '');
  if (!(await showConfirm(msg, { danger: true, okLabel: 'Take it off' }))) return;

  archiveParentActivity(act);
  if (future > 0) {
    const removedBlockIds = [];
    const from = todayKey();
    ['jenn','jess'].forEach(p => {
      const weeks = (state.profiles[p] && state.profiles[p].weeks) || {};
      Object.keys(weeks).forEach(dayKey => {
        if (dayKey < from) return;      // history is a record, not a working set
        const arr = weeks[dayKey] || [];
        const kept = arr.filter(b => {
          if (b.actId !== id) return true;
          removedBlockIds.push(b.id);
          return false;
        });
        if (kept.length !== arr.length) state.profiles[p].weeks[dayKey] = kept;
      });
    });
    tombstoneBlockIds(removedBlockIds);
  }
  /* recountActivityProgress is deliberately NOT called. It rebuilds the counts
     from the blocks still standing, and the whole point here is that the past
     ones are still standing — so there is nothing to recount, and calling it
     would only risk undoing that. */
  saveAll();
  renderParentActivities();
  showToast(future
    ? `Off the list — ${future} upcoming removed, history kept 🗄`
    : 'Off the list — history kept 🗄');
}

/* Marked, not removed, and NOT tombstoned: a tombstone is what makes a delete
   stick across every device, and this must not stick as a delete. The record
   has to survive so the blocks that name it keep rendering. */
function archiveParentActivity(act) {
  act.archived = true;
  act.archivedAt = syncNow();
  markItemUpdated(act);
}
function unarchiveParentActivity(owner, id) {
  const act = findParentActivity(owner, id);
  if (!act) return;
  delete act.archived;
  delete act.archivedAt;
  markItemUpdated(act);
  saveAll();
  renderParentActivities();
  showToast(`"${act.name}" is back on the list ✨`);
}

/* Count placed blocks across all profiles/weeks that reference an activity id.
   `fromDayKey` narrows it to that day onward — the difference between "how much
   history is there" and "how much of the plan ahead breaks". */
function countBlocksUsingActivity(actId, fromDayKey) {
  let n = 0;
  ['jenn','jess'].forEach(p => {
    const weeks = (state.profiles[p] && state.profiles[p].weeks) || {};
    Object.keys(weeks).forEach(dayKey => {
      if (fromDayKey && dayKey < fromDayKey) return;
      (weeks[dayKey] || []).forEach(b => { if (b.actId === actId) n++; });
    });
  });
  return n;
}

/* Promote a child-only activity to shared, or demote a shared back to a single child. */
async function toggleShareActivity(owner, id) {
  if (owner === 'shared') {
    // Demote: ask which child to give it to
    const which = await showPrompt('Move this activity to which child?\n\nType "jenn" or "jess":', { value:'jenn' });
    if (!which) return;
    const target = which.trim().toLowerCase();
    if (target !== 'jenn' && target !== 'jess') { showToast('Type jenn or jess'); return; }
    const act = (state.shared.sharedActivities||[]).find(a=>a.id===id);
    if (!act) return;
    // Stamp the moved copy first, then tombstone the old home — the fresh
    // timestamp is what lets the move survive a merge with a stale device.
    markItemUpdated(act);
    removeParentActivity('shared', id);
    state.profiles[target].customActivities = [...((state.profiles[target]||{}).customActivities||[]), act];
  } else {
    // Promote to shared
    const list = (state.profiles[owner]||{}).customActivities || [];
    const act = list.find(a=>a.id===id);
    if (!act) return;
    markItemUpdated(act);
    removeParentActivity(owner, id);
    state.shared.sharedActivities = [...(state.shared.sharedActivities||[]), act];
  }
  saveAll();
  renderParentActivities();
  showToast('Updated 🔗');
}

/* ── Performance tab — Function 2: analyse PAST weeks ──────────────
   Read-only analytics over what actually happened: % of planned time
   completed, routines kept, and money recorded at meetings (from the
   finalizedWeeks ledger). Nothing here confirms or records a week —
   that stays in the family meeting. */
let perfWeekOffset = 0;   // 0 = current week, -1 = last week, …

function perfMondayKey(offset) {
  const mon = ctThisMonday();
  mon.setDate(mon.getDate() + offset * 7);
  return ctDateToKey(mon);
}
// One kid's numbers for the week starting at monKey.
function perfWeekStats(monKey, kid) {
  const mon = formatDayKey(monKey);
  const acts = getAllActivities(kid, { includeArchived: true });
  let planned = 0, done = 0;
  const byCat = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    (getDayBlocksForProfile(ctDateToKey(d), kid) || []).forEach(b => {
      const act = acts.find(a => a.id === b.actId);
      const cat = act ? act.cat : 'custom';
      const m = b.durationMin || 0;
      if (!byCat[cat]) byCat[cat] = { planned: 0, done: 0 };
      byCat[cat].planned += m; planned += m;
      if (b.completed) { byCat[cat].done += m; done += m; }
    });
  }
  const fw = (state.shared.chore.finalizedWeeks || {})[monKey] || {};
  return { planned, done, byCat, routines: ctMandatoryPoints(monKey, kid), money: fw[kid] };
}

function renderPerformance() {
  ctEnsureShared();
  renderPerfTrend();
  renderPerfDetail();
}

function renderPerfTrend() {
  const wrap = document.getElementById('perfTrend');
  if (!wrap) return;
  const heldMap = state.shared.chore.meetingsHeld || {};
  let rows = '';
  for (let off = 0; off > -8; off--) {
    const monKey = perfMondayKey(off);
    const mon = formatDayKey(monKey);
    const j = perfWeekStats(monKey, 'jenn'), s = perfWeekStats(monKey, 'jess');
    // Hide untouched history weeks, but always show the current one.
    if (off !== 0 && !j.planned && !s.planned && j.money == null && s.money == null && !j.routines && !s.routines) continue;
    const bar = (st, cls) => {
      const pct = st.planned ? Math.round(st.done / st.planned * 100) : 0;
      return `<span class="perf-track"><span class="perf-fill ${cls}" style="display:block;width:${pct}%"></span></span><span class="perf-num">${st.planned ? pct + '%' : '—'}</span>`;
    };
    const money = (st) => st.money != null ? `$${st.money.toFixed(2)}` : '—';
    rows += `<button type="button" class="perf-row${off === perfWeekOffset ? ' sel' : ''}" onclick="perfSelectWeek(${off})">
        <span class="perf-week">${off === 0 ? 'This wk' : MONTH_SHORT[mon.getMonth()] + ' ' + mon.getDate()}${heldMap[monKey] ? ' ✅' : ''}</span>
        ${bar(j, 'mm-bar-j')}${bar(s, 'mm-bar-s')}
        <span class="perf-money">${money(j)} · ${money(s)}</span>
      </button>`;
  }
  wrap.innerHTML = `<div class="mm-legend"><span><i class="mm-sw mm-bar-j"></i>Jenn</span><span><i class="mm-sw mm-bar-s"></i>Jess</span><span class="mm-legend-note">bars = % of planned time done · ✅ = recorded at a meeting · $ = money recorded (Jenn · Jess)</span></div>
    <div class="perf-table">${rows}</div>
    <div class="ct-meta" style="margin-top:0.4rem">Tap a week to see its detail below.</div>`;
}
function perfSelectWeek(off) {
  perfWeekOffset = Math.min(0, off);
  renderPerfTrend();
  renderPerfDetail();
}

function renderPerfDetail() {
  const wrap = document.getElementById('perfDetail');
  if (!wrap) return;
  const monKey = perfMondayKey(perfWeekOffset);
  const mon = formatDayKey(monKey);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const CATS = [['school','📘 Learning'],['training','🏋️ Competitive Sports'],['competition','🏆 Competition'],['routine','📋 Routine'],['daily','🧹 Chores'],['free','🎮 Family/Free'],['active','🏃 Active'],['sleep','😴 Rest'],['custom','⭐ Custom']];
  const kidCard = (kid) => {
    const st = perfWeekStats(monKey, kid);
    const maxMin = Math.max(60, ...Object.values(st.byCat).map(v => v.planned));
    const rows = CATS.filter(([c]) => st.byCat[c] && st.byCat[c].planned > 0).map(([c, label]) => {
      const p = st.byCat[c].planned, dn = st.byCat[c].done;
      return `<div class="mm-2b-row"><span class="mm-2b-label">${label}</span>
          <span class="mm-2b-track"><span class="mm-2b-plan" style="width:${Math.round(p / maxMin * 100)}%"></span><span class="mm-2b-done" style="width:${Math.round(dn / maxMin * 100)}%;background:${CAT_HEX[c] || '#888'}"></span></span>
          <span class="mm-2b-num">${fmtHrsMin(dn)} / ${fmtHrsMin(p)}</span></div>`;
    }).join('') || `<div class="ct-meta">Nothing was planned this week.</div>`;
    const money = st.money != null
      ? `$${st.money.toFixed(2)} recorded`
      : (perfWeekOffset === 0 ? `$${ctWeekMoney(monKey, kid).toFixed(2)} preliminary — recorded at the meeting` : 'not recorded');
    return `<div class="mm-2b-kid">
        <div class="mm-win-kid">${CT_PROFILE_ICON[kid]} ${kid === 'jenn' ? 'Jenn' : 'Jess'} — ${fmtHrsMin(st.done)} / ${fmtHrsMin(st.planned)} done</div>${rows}
        <div class="perf-facts">✅ ${st.routines}/21 routines kept · 💰 ${money}</div>
      </div>`;
  };
  const label = `${MONTH_SHORT[mon.getMonth()]} ${mon.getDate()} – ${MONTH_SHORT[sun.getMonth()]} ${sun.getDate()}`;
  wrap.innerHTML = `<div class="perf-detail-nav">
      <button type="button" class="btn-icon" onclick="perfSelectWeek(${perfWeekOffset - 1})">◀</button>
      <b>${perfWeekOffset === 0 ? 'This week' : 'Week of ' + label}</b>
      <button type="button" class="btn-icon" ${perfWeekOffset >= 0 ? 'disabled' : ''} onclick="perfSelectWeek(${perfWeekOffset + 1})">▶</button>
    </div>
    <div class="mm-2b">${kidCard('jenn')}${kidCard('jess')}</div>
    <div class="mm-cap">Solid = done · dashed = planned.</div>`;
}

function renderRoutinesList() {
  const wrap = document.getElementById('routinesList');
  if (!wrap) return;
  wrap.innerHTML = '';

  // Built-in presets — now editable by parent (override saved separately)
  Object.keys(ROUTINE_PRESETS).forEach(id=>{
    const tmpl = getRoutineTemplate(id); // returns override if present
    const isOverridden = !!(state.shared.builtInRoutineOverrides && state.shared.builtInRoutineOverrides[id]);
    const card = document.createElement('div');
    card.className = 'challenge-card';
    card.innerHTML = `
      <div class="challenge-title">${tmpl.icon} ${escapeHtml(tmpl.title)} <span style="font-size:0.7rem;color:var(--ink-light);font-family:'Patrick Hand'">· built-in${isOverridden?' (edited)':''}</span></div>
      <div style="font-size:0.85rem;color:var(--ink-light)">${tmpl.items.length} items</div>
      <div style="display:flex;justify-content:flex-end;gap:0.4rem;margin-top:0.4rem">
        <button class="btn-icon" onclick="openEditBuiltInRoutine('${escapeJsAttr(id)}')" style="padding:2px 8px">✏️ Edit</button>
        ${isOverridden ? `<button class="btn-icon" onclick="resetBuiltInRoutine('${escapeJsAttr(id)}')" style="padding:2px 8px" title="Reset to default">↩️ Reset</button>` : ''}
      </div>
    `;
    wrap.appendChild(card);
  });

  // Custom
  (state.shared.routineTemplates||[]).forEach(r=>{
    const card = document.createElement('div');
    card.className = 'challenge-card';
    card.innerHTML = `
      <div class="challenge-title">${r.icon||'📋'} ${escapeHtml(r.title)}</div>
      <div style="font-size:0.85rem;color:var(--ink-light)">${r.items.length} items</div>
      <div style="display:flex;justify-content:flex-end;gap:0.4rem;margin-top:0.4rem">
        <button class="btn-icon" onclick="openEditRoutine('${escapeJsAttr(r.id)}')" style="padding:2px 8px">✏️ Edit</button>
        <button class="btn-icon" onclick="deleteRoutine('${escapeJsAttr(r.id)}')" style="padding:2px 8px">🗑</button>
      </div>
    `;
    wrap.appendChild(card);
  });
}

/* Custom routine builder state. editingId set when editing an existing routine. */
let routineBuilder = { title:'', icon:'📋', items:[], editingId:null };

function openNewRoutine() {
  routineBuilder = { title:'', icon:'📋', items:[{id:'i1', text:'', timerSec:null}], editingId:null, editingBuiltinId:null };
  document.getElementById('rbHeading').textContent = '🌅 New Custom Routine';
  document.getElementById('rbConfirmBtn').textContent = 'Save Routine ✨';
  renderRoutineBuilder();
  openSheet('newRoutineOverlay');
}

function openEditRoutine(id) {
  const r = (state.shared.routineTemplates||[]).find(x=>x.id===id);
  if (!r) return;
  routineBuilder = {
    title: r.title,
    icon: r.icon || '📋',
    items: r.items.map(it=>({ id: it.id, text: it.text, timerSec: it.timerSec || null })),
    editingId: r.id,
    editingBuiltinId: null,
  };
  if (!routineBuilder.items.length) routineBuilder.items.push({id:'i'+Date.now().toString(36), text:'', timerSec:null});
  document.getElementById('rbHeading').textContent = '✏️ Edit Routine';
  document.getElementById('rbConfirmBtn').textContent = 'Save Changes ✅';
  renderRoutineBuilder();
  openSheet('newRoutineOverlay');
}

function openEditBuiltInRoutine(id) {
  const tmpl = getRoutineTemplate(id);
  if (!tmpl) return;
  routineBuilder = {
    title: tmpl.title,
    icon: tmpl.icon || '📋',
    items: tmpl.items.map(it=>({ id: it.id, text: it.text, timerSec: it.timerSec || null })),
    editingId: null,
    editingBuiltinId: id,
  };
  if (!routineBuilder.items.length) routineBuilder.items.push({id:'i'+Date.now().toString(36), text:'', timerSec:null});
  document.getElementById('rbHeading').textContent = '✏️ Edit Built-in Routine';
  document.getElementById('rbConfirmBtn').textContent = 'Save Changes ✅';
  renderRoutineBuilder();
  openSheet('newRoutineOverlay');
}

async function resetBuiltInRoutine(id) {
  if (!(await showConfirm('Reset this routine to the built-in default? Your edits will be lost.', { danger:true, okLabel:'Reset' }))) return;
  if (state.shared.builtInRoutineOverrides) delete state.shared.builtInRoutineOverrides[id];
  saveAll();
  renderRoutinesList();
  showToast('Reset to default ↩️');
}

function renderRoutineBuilder() {
  document.getElementById('rbTitle').value = routineBuilder.title;
  document.getElementById('rbIcon').value  = routineBuilder.icon;
  const list = document.getElementById('rbItems');
  list.innerHTML = '';
  routineBuilder.items.forEach((it, idx)=>{
    const row = document.createElement('div');
    row.className = 'builder-item-row';
    // The icon box shows what the item WILL get if left alone — the guess from
    // its text — so a blank field never means a blank icon.
    row.innerHTML = `
      <input type="text" class="builder-item-icon" placeholder="${escapeAttr(routineItemIcon(it))}" value="${escapeAttr(it.icon)}" data-idx="${idx}" data-field="icon" title="Icon — leave blank to pick one from the words" aria-label="Icon">
      <input type="text" placeholder="Task description" value="${escapeAttr(it.text)}" data-idx="${idx}" data-field="text">
      <input type="number" placeholder="min" min="0" max="60" value="${it.timerSec?Math.round(it.timerSec/60):''}" data-idx="${idx}" data-field="timerMin" title="Timer (minutes)">
      <button class="del-btn" data-idx="${idx}">×</button>
    `;
    list.appendChild(row);
  });
  // Wire up
  list.querySelectorAll('input').forEach(inp=>{
    inp.oninput = (e)=>{
      const i = parseInt(e.target.dataset.idx);
      const f = e.target.dataset.field;
      if (f==='text') {
        routineBuilder.items[i].text = e.target.value;
        // Re-guess the placeholder as the words change, while the field is empty.
        const iconField = list.querySelector(`input[data-idx="${i}"][data-field="icon"]`);
        if (iconField && !iconField.value) iconField.placeholder = routineItemIcon(routineBuilder.items[i]);
      }
      if (f==='icon') routineBuilder.items[i].icon = e.target.value.trim() || null;
      if (f==='timerMin') {
        const min = parseInt(e.target.value);
        routineBuilder.items[i].timerSec = (min && min>0) ? min*60 : null;
      }
    };
  });
  list.querySelectorAll('.del-btn').forEach(btn=>{
    btn.onclick = ()=>{
      const i = parseInt(btn.dataset.idx);
      routineBuilder.items.splice(i,1);
      if (!routineBuilder.items.length) routineBuilder.items.push({id:'i'+Date.now().toString(36), text:'', timerSec:null});
      renderRoutineBuilder();
    };
  });
}

function addRoutineItem() {
  routineBuilder.items.push({ id:'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,4), text:'', timerSec:null });
  renderRoutineBuilder();
}

function confirmRoutine() {
  const title = document.getElementById('rbTitle').value.trim();
  const icon  = document.getElementById('rbIcon').value.trim() || '📋';
  if (!title) { showToast('Enter a title'); return; }
  const items = routineBuilder.items.filter(i=>i.text.trim()).map(i=>({
    id: i.id, text: i.text.trim(), timerSec: i.timerSec || undefined
  }));
  if (!items.length) { showToast('Add at least one item'); return; }

  if (routineBuilder.editingBuiltinId) {
    // EDIT BUILT-IN — store as override; preset stays untouched
    const id = routineBuilder.editingBuiltinId;
    if (!state.shared.builtInRoutineOverrides) state.shared.builtInRoutineOverrides = {};
    state.shared.builtInRoutineOverrides[id] = { title, icon, items };

    // Prune checklistState in FUTURE blocks for items that no longer exist (same logic as custom)
    const validIds = new Set(items.map(i=>i.id));
    const today = todayKey();
    ['jenn','jess'].forEach(p=>{
      const weeks = (state.profiles[p] && state.profiles[p].weeks) || {};
      Object.keys(weeks).forEach(dayKey=>{
        if (dayKey < today) return;
        const blocks = weeks[dayKey] || [];
        blocks.forEach(b=>{
          const act = findActivity(b.actId, p);
          if (!act?.isRoutine || act.routineId !== id) return;
          if (!b.checklistState) return;
          Object.keys(b.checklistState).forEach(itemId=>{
            if (!validIds.has(itemId)) delete b.checklistState[itemId];
          });
        });
      });
    });

    saveAll();
    closeSheet('newRoutineOverlay');
    renderRoutinesList();
    showToast('Built-in routine updated ✅');
    return;
  }

  if (routineBuilder.editingId) {
    // EDIT MODE — update existing template + sync activity name/icon
    const existing = (state.shared.routineTemplates||[]).find(r=>r.id===routineBuilder.editingId);
    if (!existing) { showToast('Routine not found'); return; }
    existing.title = title;
    existing.icon  = icon;
    existing.items = items;

    // Update matching activity name/icon on both kids
    ['jenn','jess'].forEach(p=>{
      const acts = state.profiles[p].customActivities || [];
      const a = acts.find(x=>x.routineId===routineBuilder.editingId);
      if (a) { a.name = title; a.icon = icon; }
    });

    // Prune checklistState in FUTURE blocks for items that no longer exist.
    // Past blocks are preserved as historical record (don't touch them).
    const validIds = new Set(items.map(i=>i.id));
    const today = todayKey();
    ['jenn','jess'].forEach(p=>{
      const weeks = state.profiles[p].weeks || {};
      Object.keys(weeks).forEach(dayKey=>{
        if (dayKey < today) return; // skip past days
        const blocks = weeks[dayKey] || [];
        blocks.forEach(b=>{
          const act = findActivity(b.actId, p);
          if (!act?.isRoutine || act.routineId !== routineBuilder.editingId) return;
          if (!b.checklistState) return;
          // Keep only valid template items in checklistState
          Object.keys(b.checklistState).forEach(itemId=>{
            if (!validIds.has(itemId)) delete b.checklistState[itemId];
          });
        });
      });
    });

    saveAll();
    closeSheet('newRoutineOverlay');
    renderRoutinesList();
    showToast('Routine updated ✅');
    return;
  }

  // NEW ROUTINE
  const routine = {
    id: 'rt-'+Date.now().toString(36),
    title, icon, items
  };
  state.shared.routineTemplates = [...(state.shared.routineTemplates||[]), routine];

  // Also add a matching activity so it shows in the tray
  const newAct = {
    id: 'routine_'+routine.id,
    name: title,
    icon: icon,
    cat: 'routine',
    durationMin: 30,
    isRoutine: true,
    routineId: routine.id,
    custom: true,
  };
  // Store on both kids' customActivities so it appears in both trays
  ['jenn','jess'].forEach(p=>{
    state.profiles[p].customActivities = [...(state.profiles[p].customActivities||[]), newAct];
  });

  saveAll();
  closeSheet('newRoutineOverlay');
  renderRoutinesList();
  showToast('Routine created ✨');
}

async function deleteRoutine(id) {
  if (!(await showConfirm('Delete this routine?', { danger:true, okLabel:'Delete' }))) return;
  state.shared.routineTemplates = (state.shared.routineTemplates||[]).filter(r=>r.id!==id);
  tombstoneIds('rt:', [id]);
  // Remove matching activity from both kids (tombstoned so sync can't revive them)
  ['jenn','jess'].forEach(p=>{
    const removed = (state.profiles[p].customActivities||[]).filter(a=>a.routineId===id).map(a=>a.id);
    state.profiles[p].customActivities = (state.profiles[p].customActivities||[]).filter(a=>a.routineId!==id);
    tombstoneIds('ca:' + p + ':', removed);
  });
  saveAll();
  renderRoutinesList();
}
function parentView(p) {
  parentViewing = p;
  document.querySelectorAll('#parentWeekKidPills .pill-btn').forEach(b=>b.classList.toggle('active', b.textContent.includes(p==='jenn'?'Jenn':'Jess')));
  showScreen('week');
  renderWeek();
}
function parentSwitchView() {
  parentViewing = parentViewing==='jenn'?'jess':'jenn';
  renderWeek();
}

/* ════════════════════════════════════════════════════════════════
   PARENT MONTHLY HEATMAP
════════════════════════════════════════════════════════════════ */
let parentMonthlyKid = 'jenn';
let parentMonthOffset = 0; // 0 = current month, -1 = prev, +1 = next

function openParentMonthly(kid) {
  parentMonthlyKid = kid;
  parentMonthOffset = 0;
  showScreen('parent-monthly');
  renderParentMonthly();
}

function setParentMonthlyKid(kid) {
  parentMonthlyKid = kid;
  renderParentMonthly();
}

function changeParentMonth(delta) {
  parentMonthOffset += delta;
  renderParentMonthly();
}

function renderParentMonthly() {
  // Update kid-pill active state
  document.getElementById('pmKidJenn').classList.toggle('active', parentMonthlyKid==='jenn');
  document.getElementById('pmKidJess').classList.toggle('active', parentMonthlyKid==='jess');

  // Compute month — anchor "current month" to the app timezone (America/Edmonton)
  // so it matches the day keys, not the device clock, near month boundaries.
  const now = formatDayKey(toDayKeyInZone(new Date()));
  const monthStart = new Date(now.getFullYear(), now.getMonth() + parentMonthOffset, 1);
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();

  document.getElementById('pmTitle').textContent =
    (parentMonthlyKid==='jenn'?'🐥 Jenn':'🦊 Jess') + ' — Monthly';
  document.getElementById('pmMonthLabel').textContent =
    `${MONTH_LONG[month]} ${year}`;

  // Compute weekday-of-first (Mon=0…Sun=6)
  const firstDow = (monthStart.getDay() + 6) % 7;

  const grid = document.getElementById('pmGrid');
  grid.innerHTML = '';

  // Empty leading cells
  for (let i = 0; i < firstDow; i++) {
    const e = document.createElement('div');
    e.className = 'pm-cell empty';
    grid.appendChild(e);
  }

  const profData = state.profiles[parentMonthlyKid] || { weeks:{} };
  const todayK = todayKey();

  for (let d = 1; d <= lastDay; d++) {
    const dateObj = new Date(year, month, d);
    const key = dateToLocalKey(dateObj);
    const dayIdx = (dateObj.getDay() + 6) % 7;

    // Sum durations from blocks across all weeks (data is stored by week-key)
    const blocks = getDayBlocksForProfile(key, parentMonthlyKid);
    const totalMin = blocks.reduce((s,b)=>s+(b.durationMin||0),0);
    const pct = Math.min(100, Math.round(totalMin / DAY_MIN_SPAN * 100));

    const cell = document.createElement('div');
    cell.className = 'pm-cell' + (key===todayK?' today':'');
    cell.style.background = pmDensityColor(pct);

    const mood = profData.dayMoods?.[key];
    cell.innerHTML = `
      <div class="pm-cell-date">${d}</div>
      <div class="pm-cell-pct">${pct}%</div>
      ${mood ? `<div class="pm-cell-mood">${mood}</div>` : ''}
    `;
    cell.onclick = ()=>{
      // Need to set weekOffset so getDayKeys lines up with this date's week
      const wkOff = computeWeekOffsetFor(dateObj);
      weekOffset = wkOff;
      openDay(key, dayIdx);
    };
    grid.appendChild(cell);
  }
}

function pmDensityColor(pct) {
  if (pct === 0) return 'var(--paper)';
  // Gradient: light yellow → orange → red
  if (pct < 25) return '#fff3c4';
  if (pct < 50) return '#ffe08a';
  if (pct < 75) return '#ffa84a';
  return '#ff7050';
}

/* Get blocks for a specific day key for an arbitrary profile (not just active) */
function getDayBlocksForProfile(key, profId) {
  const p = state.profiles[profId];
  return p?.weeks?.[key] || [];
}

/* Given a date, compute the weekOffset relative to today's week */
function computeWeekOffsetForDayKey(dayKey) {
  return computeWeekOffsetFor(formatDayKey(dayKey));
}

function computeWeekOffsetFor(date) {
  const today = new Date();
  const todayMon = getWeekStart(0);
  const targetMon = (function(){
    // Mon-based week start of `date`
    const d = new Date(date);
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    d.setHours(0,0,0,0);
    return d;
  })();
  const ms = targetMon.getTime() - todayMon.getTime();
  return Math.round(ms / (7*24*60*60*1000));
}

const MONTH_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function renderLevelRules() {
  const list = document.getElementById('levelRulesList');
  list.innerHTML = '';
  const rules = state.shared.levelRules || [];
  if (!rules.length) {
    list.innerHTML = '<p style="color:var(--ink-light);font-size:0.9rem">No rules yet</p>';
    return;
  }
  const acts = [...DEFAULT_ACTIVITIES, ...SEASONAL_ACTIVITIES];
  rules.forEach(r=>{
    const act = acts.find(a=>a.id===r.activityId);
    const card = document.createElement('div');
    card.className = 'challenge-card';
    card.innerHTML = `
      <div class="challenge-title">${r.newIcon||act?.icon||''} ${escapeHtml(r.name||'Level Up')}</div>
      <div style="font-size:0.88rem;color:var(--ink-light)">
        ${act?.icon||''} ${escapeHtml(act?.name||r.activityId)} → level up after <b>${r.target} ${r.type==='count'?'times':'hours'}</b>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:0.4rem">
        <button class="btn-icon" onclick="deleteLevelRule('${escapeJsAttr(r.id)}')" style="padding:2px 8px">🗑</button>
      </div>
    `;
    list.appendChild(card);
  });
}
function openNewLevelRule() {
  const sel = document.getElementById('ruleActivity');
  sel.innerHTML = '';
  [...DEFAULT_ACTIVITIES, ...SEASONAL_ACTIVITIES].forEach(a=>{
    const opt = document.createElement('option');
    opt.value = a.id; opt.textContent = `${a.icon} ${a.name}`;
    sel.appendChild(opt);
  });
  openSheet('newRuleOverlay');
}
function confirmNewRule() {
  const name = document.getElementById('ruleName').value.trim() || 'Level Up';
  const rule = {
    id:'rule-'+Date.now().toString(36),
    activityId: document.getElementById('ruleActivity').value,
    type: document.getElementById('ruleType').value,
    target: parseInt(document.getElementById('ruleTarget').value)||10,
    name,
    newIcon: document.getElementById('ruleNewIcon').value.trim() || null,
  };
  state.shared.levelRules = [...(state.shared.levelRules||[]), rule];
  saveAll();
  closeSheet('newRuleOverlay');
  renderLevelRules();
  showToast('Rule saved ⚙️');
  document.getElementById('ruleName').value='';
  document.getElementById('ruleNewIcon').value='';
}
function deleteLevelRule(id) {
  state.shared.levelRules = (state.shared.levelRules||[]).filter(r=>r.id!==id);
  tombstoneIds('lr:', [id]);
  saveAll();
  renderLevelRules();
}

