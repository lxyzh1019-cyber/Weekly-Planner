// Weekly-Planner — parent mode: review, approvals, activity management, performance,
// routines, monthly heatmap, level rules. Extracted verbatim from index.html.
/* ════════════════════════════════════════════════════════════════
   PARENT MODE
════════════════════════════════════════════════════════════════ */
let parentTab = 'review';
function renderParentHome() {
  setParentTab(parentTab);
  document.getElementById('reviewKidName').textContent = parentViewing==='jenn' ? '🐥 Jenn' : '🦊 Jess';
  document.querySelectorAll('#parentWeekKidPills .pill-btn').forEach(b =>
    b.classList.toggle('active', b.textContent.includes(parentViewing==='jenn'?'Jenn':'Jess')));
  renderMeetingHub();
  renderReviewFeedback();
  renderPerformance();
  renderRoutinesList();
  renderParentActivities();
  renderPendingApproval();
  renderLevelRules();
}

function setParentTab(tab) {
  parentTab = tab;
  document.querySelectorAll('#screen-parent .parent-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.ptab === tab));
  document.querySelectorAll('#screen-parent .parent-panel').forEach(p =>
    p.hidden = (p.id !== 'ptab-' + tab));
}

// Switch which child the parent is reviewing without leaving the dashboard.
function setParentKid(kid) {
  parentViewing = kid;
  renderParentHome();
}

/* Weekly Review hub — Function 1 (review & confirm) lives in ONE place:
   the family meeting. This hub is read-only status for the meeting's week:
   the 7-day strip mirrors the meeting's day-confirms (both kids), and every
   tap opens the meeting itself rather than confirming in a second surface. */
function renderMeetingHub() {
  const wrap = document.getElementById('meetingHub');
  if (!wrap) return;
  ctPrepareRead();
  const wk = ctWeekKey || ctDateToKey(ctMondayOf(new Date()));
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
  const money = ['jenn', 'jess'].map(kid => `${CT_PROFILE_ICON[kid]} $${ctWeekMoney(wk, kid).toFixed(2)}`).join(' · ');
  const status = held
    ? `<div class="hub-status hub-status-done">✅ This week is recorded — pocket money was credited at the meeting.</div>`
    : `<div class="hub-status">${nConfirmed}/7 days confirmed · pocket money so far: ${money}</div>`;
  const cta = held
    ? `<button type="button" class="pill-btn" onclick="openFamilyMeeting()">🧑‍🧑‍🧒 Re-open the meeting</button>`
    : `<button type="button" class="btn-confirm" onclick="openFamilyMeeting()">🧑‍🧑‍🧒 ${nConfirmed > 0 ? 'Continue the' : 'Run'} family meeting</button>`;
  wrap.innerHTML = `<div class="hub-week">Week of ${weekLabel}</div>
    <div class="review-day-row">${days}</div>${status}
    <div style="margin-top:0.6rem">${cta}</div>`;
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
function parentOpenChoreReview() {
  profile = 'parent';
  openChoreTab();
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
        <button class="btn-icon" style="padding:2px 8px;background:var(--accent-green)" onclick="approveKidActivity('${owner}','${act.id}')">✅ Approve</button>
        <button class="btn-icon" style="padding:2px 8px" onclick="openParentActivityEditor('${owner}','${act.id}')">✏️ Modify</button>
        <button class="btn-icon" style="padding:2px 8px" onclick="rejectKidActivity('${owner}','${act.id}')">🗑 Reject</button>
      </div>`;
    wrap.appendChild(card);
  });
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
async function rejectKidActivity(owner, id) {
  if (!(await showConfirm('Remove this activity the child added?', { danger:true, okLabel:'Remove' }))) return;
  const arr = (state.profiles[owner] && state.profiles[owner].customActivities) || [];
  const idx = arr.findIndex(x => x.id === id);
  if (idx < 0) return;
  arr.splice(idx, 1);
  tombstoneIds('ca:' + owner + ':', [id]);
  saveAll();
  renderPendingApproval();
  renderParentActivities();
  showToast('Removed');
}

/* ════════════════════════════════════════════════════════════════
   PARENT ACTIVITY MANAGEMENT (CRUD + sync)
════════════════════════════════════════════════════════════════ */
let parentActivityEdit = { mode:'new', sourceProfile:null, originalId:null };

function renderParentActivities() {
  const wrap = document.getElementById('parentActivitiesList');
  if (!wrap) return;
  wrap.innerHTML = '';

  // Shared activities
  const shared = getSharedActivities();
  shared.forEach(a => wrap.appendChild(parentActivityCard(a, 'shared')));

  // Per-child activities
  ['jenn','jess'].forEach(p=>{
    const acts = (state.profiles[p] && state.profiles[p].customActivities) || [];
    acts.forEach(a => {
      // Skip routine-shadow activities (they're managed via the Routines section)
      if (a.isRoutine) return;
      // Pending kid-added activities show in the approval section above.
      if (a.pendingApproval) return;
      wrap.appendChild(parentActivityCard(a, p));
    });
  });

  if (!wrap.children.length) {
    wrap.innerHTML = '<div class="gt-empty">No custom activities yet. Tap ＋ to add one.</div>';
  }
}

function parentActivityCard(act, owner) {
  const card = document.createElement('div');
  card.className = 'challenge-card';
  const ownerLabel = owner==='shared' ? '🔗 Shared'
                    : owner==='jenn'   ? '🐥 Jenn only'
                    : '🦊 Jess only';
  card.innerHTML = `
    <div class="challenge-title">${act.icon||'⭐'} ${act.name} <span style="font-size:0.7rem;color:var(--ink-light);font-family:'Patrick Hand'">· ${ownerLabel}</span></div>
    <div style="font-size:0.85rem;color:var(--ink-light)">${(act.durationMin||60)} min · ${act.cat||'free'}</div>
    <div style="display:flex;justify-content:flex-end;gap:0.4rem;margin-top:0.4rem;flex-wrap:wrap">
      <button class="btn-icon" onclick="toggleShareActivity('${owner}','${act.id}')" style="padding:2px 8px" title="${owner==='shared'?'Move to single child':'Promote to shared'}">${owner==='shared'?'↩️ Unshare':'🔗 Share'}</button>
      <button class="btn-icon" onclick="openParentActivityEditor('${owner}','${act.id}')" style="padding:2px 8px">✏️ Edit</button>
      <button class="btn-icon" onclick="deleteParentActivity('${owner}','${act.id}')" style="padding:2px 8px">🗑</button>
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

async function deleteParentActivity(owner, id) {
  // Count how many placed blocks reference this activity across both kids' weeks
  const refs = countBlocksUsingActivity(id);
  let msg;
  if (refs === 0) {
    msg = 'Delete this activity?';
  } else {
    msg = `⚠️ This activity is used in ${refs} placed block${refs===1?'':'s'}.\n\nOK = delete the activity AND all ${refs} block${refs===1?'':'s'}\nCancel = keep everything`;
  }
  if (!(await showConfirm(msg, { danger:true, okLabel:'Delete' }))) return;
  // Remove the activity definition
  removeParentActivity(owner, id);
  // Cascade-delete every referencing block from both kids (tombstoned so the
  // sync merge can't bring them back)
  if (refs > 0) {
    const removedBlockIds = [];
    ['jenn','jess'].forEach(p => {
      const weeks = (state.profiles[p] && state.profiles[p].weeks) || {};
      Object.keys(weeks).forEach(dayKey => {
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
    // Recompute progress for both kids since their counts may have changed
    recountActivityProgress('jenn');
    recountActivityProgress('jess');
  }
  saveAll();
  renderParentActivities();
  showToast(refs > 0 ? `Activity + ${refs} block${refs===1?'':'s'} deleted 🗑` : 'Deleted 🗑');
}

/* Count placed blocks across all profiles/weeks that reference an activity id. */
function countBlocksUsingActivity(actId) {
  let n = 0;
  ['jenn','jess'].forEach(p => {
    const weeks = (state.profiles[p] && state.profiles[p].weeks) || {};
    Object.values(weeks).forEach(arr => {
      (arr||[]).forEach(b => { if (b.actId === actId) n++; });
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
  const mon = ctMondayOf(new Date());
  mon.setDate(mon.getDate() + offset * 7);
  return ctDateToKey(mon);
}
// One kid's numbers for the week starting at monKey.
function perfWeekStats(monKey, kid) {
  const mon = formatDayKey(monKey);
  const acts = getAllActivities(kid);
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
      <div class="challenge-title">${tmpl.icon} ${tmpl.title} <span style="font-size:0.7rem;color:var(--ink-light);font-family:'Patrick Hand'">· built-in${isOverridden?' (edited)':''}</span></div>
      <div style="font-size:0.85rem;color:var(--ink-light)">${tmpl.items.length} items</div>
      <div style="display:flex;justify-content:flex-end;gap:0.4rem;margin-top:0.4rem">
        <button class="btn-icon" onclick="openEditBuiltInRoutine('${id}')" style="padding:2px 8px">✏️ Edit</button>
        ${isOverridden ? `<button class="btn-icon" onclick="resetBuiltInRoutine('${id}')" style="padding:2px 8px" title="Reset to default">↩️ Reset</button>` : ''}
      </div>
    `;
    wrap.appendChild(card);
  });

  // Custom
  (state.shared.routineTemplates||[]).forEach(r=>{
    const card = document.createElement('div');
    card.className = 'challenge-card';
    card.innerHTML = `
      <div class="challenge-title">${r.icon||'📋'} ${r.title}</div>
      <div style="font-size:0.85rem;color:var(--ink-light)">${r.items.length} items</div>
      <div style="display:flex;justify-content:flex-end;gap:0.4rem;margin-top:0.4rem">
        <button class="btn-icon" onclick="openEditRoutine('${r.id}')" style="padding:2px 8px">✏️ Edit</button>
        <button class="btn-icon" onclick="deleteRoutine('${r.id}')" style="padding:2px 8px">🗑</button>
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
    row.innerHTML = `
      <input type="text" placeholder="Task description" value="${(it.text||'').replace(/"/g,'&quot;')}" data-idx="${idx}" data-field="text">
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
      if (f==='text') routineBuilder.items[i].text = e.target.value;
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
          const act = getAllActivities(p).find(a=>a.id===b.actId);
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
          const act = getAllActivities(p).find(a=>a.id===b.actId);
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
      <div class="challenge-title">${r.newIcon||act?.icon||''} ${r.name||'Level Up'}</div>
      <div style="font-size:0.88rem;color:var(--ink-light)">
        ${act?.icon||''} ${act?.name||r.activityId} → level up after <b>${r.target} ${r.type==='count'?'times':'hours'}</b>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:0.4rem">
        <button class="btn-icon" onclick="deleteLevelRule('${r.id}')" style="padding:2px 8px">🗑</button>
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

