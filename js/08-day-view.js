// Weekly-Planner — day editor: timeline, checklist mode, placement, block render, remove.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   DAY EDITOR
════════════════════════════════════════════════════════════════ */
function openDayFromWeekCard(dayKey, dayIdx, focusBlockId=null) {
  const wk = computeWeekOffsetForDayKey(dayKey);
  openDay(dayKey, dayIdx, focusBlockId, wk);
}

function openDay(key, dayIdx, focusBlockId=null, weekOffsetOverride=null) {
  if (weekOffsetOverride != null) weekOffset = weekOffsetOverride;
  currentDayKey = key;
  selectedActivity = null;
  currentZone = 'all';
  leftPaneManualCollapsed = false;
  dcOpenGaps.clear(); // 3b: forget expanded free-slots from the previous day

  document.querySelectorAll('.zone-tab').forEach(t=>t.classList.toggle('active', t.dataset.zone==='all'));

  // Parent banner
  const banner = document.getElementById('parentBannerDay');
  banner.style.display = isParent() ? 'block' : 'none';

  document.getElementById('dayProfileBadge').textContent =
    isParent() ? (parentViewing==='jenn'?'🐥 (P)':'🦊 (P)') :
    (profile==='jenn'?'🐥 Jenn':'🦊 Jess');
  document.getElementById('dayTitle').textContent = '';
  const d = formatDayKey(key);
  document.getElementById('daySubtitle').textContent = `${DAY_LONG[dayIdx]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;

  showScreen('day');
  buildTimeline();
  bindDayTimelineCompactOnScroll();
  buildTray();
  renderVibe();
  renderDayGoalsTodos();
  maybeShowRewardPrompt();
  offerTutorialIfNeeded();
  if (focusBlockId) {
    pendingFocusBlockId = focusBlockId;
    pendingFocusAttempts = 0;
    focusBlockOnTimeline(focusBlockId);
  }

  // Gentle reflect prompt if evening and day has blocks and no mood set
  const now = new Date();
  if (now.getHours() >= 20 && currentDayKey === todayKey() && getDayBlocks(key).length > 0) {
    const m = getProfData().dayMoods?.[key];
    if (!m) showToast('💫 Tap 🌙 to reflect on today');
  }
}

function renderDayGoalsTodos() {
  const p = getProfData();
  if (!p) return;
  ensureGtFields(p);
  const dayGoalsList = document.getElementById('dayGoalsList');
  const dayTodosList = document.getElementById('dayTodosList');
  if (!dayGoalsList || !dayTodosList) return;

  dayGoalsList.innerHTML = '';
  if (!p.goals.length) {
    dayGoalsList.innerHTML = '<div class="gt-empty">No goals yet.</div>';
  } else {
    p.goals.forEach(g => dayGoalsList.appendChild(buildGoalRow(g)));
  }

  const wk = getCurrentWeekKey();
  const dayDate = formatDayKey(currentDayKey || todayKey());
  const dayIdx = (dayDate.getDay()+6)%7;
  const weekTodos = p.todos.filter(t => t.weekKey === wk);
  const filtered = weekTodos.filter(t => t.assignedDay == null || t.assignedDay === dayIdx);

  dayTodosList.innerHTML = '';
  if (!filtered.length) {
    dayTodosList.innerHTML = '<div class="gt-empty">No to-dos for today.</div>';
  } else {
    filtered.forEach(t => dayTodosList.appendChild(buildTodoRow(t)));
  }
}

function focusBlockOnTimeline(blockId) {
  if (!blockId) return;
  const wrap = document.querySelector('.timeline-wrap');
  const el = document.getElementById('block-'+blockId);
  if (!wrap || !el) {
    if (pendingFocusAttempts < 6) {
      pendingFocusAttempts += 1;
      setTimeout(()=>focusBlockOnTimeline(blockId), 80);
    }
    return;
  }
  const wrapRect = wrap.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const targetTop = wrap.scrollTop + (elRect.top - wrapRect.top) - (wrap.clientHeight / 2) + (elRect.height / 2);
  wrap.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  el.classList.add('block-focus-pulse');
  setTimeout(()=>el.classList.remove('block-focus-pulse'), 2300);
  pendingFocusBlockId = null;
}

function tickActiveStopwatch() {
  buildTimeline();
}

/* Navigate to previous/next day (cross-week aware) */
function navDay(delta) {
  const keys = getDayKeys(weekOffset);
  const curIdx = keys.indexOf(currentDayKey);
  if (curIdx < 0) return;
  const newIdx = curIdx + delta;
  if (newIdx >= 0 && newIdx <= 6) {
    openDay(keys[newIdx], newIdx);
  } else if (newIdx < 0) {
    weekOffset -= 1;
    const newKeys = getDayKeys(weekOffset);
    openDay(newKeys[6], 6);
  } else {
    weekOffset += 1;
    const newKeys = getDayKeys(weekOffset);
    openDay(newKeys[0], 0);
  }
}

/* Event-zone tabs */
function setZone(z) {
  currentZone = z;
  document.querySelectorAll('.zone-tab').forEach(t=>t.classList.toggle('active', t.dataset.zone===z));
  buildTimeline();
}
function zoneRange(z) {
  if (z==='all') return [0, TOTAL_SLOTS];
  if (z==='morning') return [0, 24];       // 6AM–12PM
  if (z==='afternoon') return [24, 48];    // 12PM–6PM
  if (z==='evening') return [48, TOTAL_SLOTS]; // 6PM–9PM
  return [0, TOTAL_SLOTS];
}

/* Today's Vibe */
function renderVibe() {
  const wrap = document.getElementById('vibeMoods');
  wrap.innerHTML = '';
  const current = getProfData().dayMoods?.[currentDayKey];
  MOODS.forEach(m=>{
    const el = document.createElement('div');
    el.className = 'vibe-mood'+(current===m?' selected':'');
    el.textContent = m;
    el.onclick = ()=>setDayMood(m);
    wrap.appendChild(el);
  });
  document.getElementById('vibeSubtext').textContent =
    current ? 'Today felt like...' : 'Tap at the end of your day';
}
function setDayMood(m) {
  const p = getProfData();
  if (!p.dayMoods) p.dayMoods={};
  p.dayMoods[currentDayKey] = m;
  saveAll();
  renderVibe();
  showToast('Mood saved '+m);
}

/* ════════════════════════════════════════════════════════════════
   3b — DAY "CHECKLIST" MODE: collapse free time into tappable pills
════════════════════════════════════════════════════════════════ */
function setDayViewMode(mode) {
  dayViewMode = (mode === 'checklist' || mode === 'quest') ? mode : 'timeline';
  const tb = document.getElementById('dayModeTimeline');
  const cb = document.getElementById('dayModeChecklist');
  const qb = document.getElementById('dayModeQuest');
  if (tb) { tb.classList.toggle('active', dayViewMode==='timeline'); tb.setAttribute('aria-selected', dayViewMode==='timeline'); }
  if (cb) { cb.classList.toggle('active', dayViewMode==='checklist'); cb.setAttribute('aria-selected', dayViewMode==='checklist'); }
  if (qb) { qb.classList.toggle('active', dayViewMode==='quest'); qb.setAttribute('aria-selected', dayViewMode==='quest'); }
  const scr = document.getElementById('screen-day');
  if (scr) scr.classList.toggle('dc-mode', dayViewMode==='checklist');
  buildTimeline();
}

/* Soft category tint for a checklist row, per the 3b palette. */
function dcTintClass(act) {
  if (!act) return '';
  if (act.isCompetition || act.cat==='competition') return 'tint-competition';
  if (act.isTraining || act.cat==='training') return 'tint-training';
  if (act.isRoutine  || act.cat==='routine')  return 'tint-routine';
  if (act.id==='chores') return 'tint-chores';
  if (['breakfast','lunch','dinner'].includes(act.id)) return 'tint-meals';
  if (act.cat==='school') return 'tint-learning';
  if (act.cat==='active') return 'tint-active';
  return '';
}

function dcToggleGap(startMin) {
  if (dcOpenGaps.has(startMin)) dcOpenGaps.delete(startMin); else dcOpenGaps.add(startMin);
  buildDayChecklist();
}

function buildDayChecklistBlockRow(b, acts) {
  const act = acts.find(a=>a.id===b.actId);
  const row = document.createElement('div');
  row.className = ('dc-row ' + dcTintClass(act) + (b.completed?' dc-done':'')).trim();
  const startAbs = b.startMin, endAbs = b.startMin + (b.durationMin||0);
  const icon = act ? act.icon : '❓';
  const name = act ? act.name : 'Activity';
  const choreList = (b.actId==='chores' && Array.isArray(b.choreTags) && b.choreTags.length) ? ': '+b.choreTags.join(', ') : '';
  const noteTrim = (b.note && String(b.note).trim()) ? String(b.note).trim() : '';
  row.innerHTML = `
    <div class="dc-time">${formatTimeFromMin(startAbs)}<small>${formatTimeFromMin(endAbs)}</small></div>
    <div class="dc-content">
      <div class="dc-name">${icon} ${escapeHtml(name)}${escapeHtml(choreList)}</div>
      <div class="dc-meta">${formatDuration(b.durationMin||0)}${noteTrim? ' · '+escapeHtml(noteTrim) : ''}</div>
    </div>
    <button type="button" class="dc-check${b.completed?' done':''}" aria-label="${b.completed?'Mark not done':'Mark done'}" onclick="event.stopPropagation(); toggleBlockDone(currentDayKey,'${b.id}',event)">${b.completed?'✓':''}</button>
  `;
  row.onclick = (e)=>{ e.stopPropagation(); onTimelineBlockTap(b.id); };
  return row;
}

function buildDayChecklistGapPill(gapStart, gapEnd) {
  const wrap = document.createElement('div');
  wrap.className = 'dc-gap';
  const open = dcOpenGaps.has(gapStart);
  const dur = gapEnd - gapStart;
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'dc-gap-pill';
  pill.innerHTML = `<span class="dc-gap-chev">${open?'▾':'▸'}</span><span>✨ Free · ${fmtHrsMin(dur)}</span><span class="dc-gap-hint">${open?'pick a start time':'tap to add here'}</span>`;
  pill.onclick = ()=> dcToggleGap(gapStart);
  wrap.appendChild(pill);
  if (open) {
    const slots = document.createElement('div');
    slots.className = 'dc-slots';
    // 30-min slots aligned to clock half-hours, clipped to the gap.
    for (let t = Math.floor(gapStart/30)*30; t < gapEnd; t += 30) {
      const slotStart = Math.max(t, gapStart);
      const slotEnd = Math.min(t+30, gapEnd);
      if (slotEnd - slotStart < 5) continue;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'dc-slot';
      btn.textContent = `${formatTimeFromMin(slotStart)} – ${formatTimeFromMin(slotEnd)} · tap to add ＋`;
      btn.onclick = ()=> addActivityAtMin(slotStart);
      slots.appendChild(btn);
    }
    wrap.appendChild(slots);
  }
  return wrap;
}

function buildDayChecklist() {
  const host = document.getElementById('dayChecklist');
  if (!host) return;
  host.innerHTML = '';
  const acts = getAllActivities();
  const blocks = getDayBlocks(currentDayKey).slice()
    .filter(b => (b.durationMin||0) > 0)
    .sort((a,b)=> (a.startMin - b.startMin) || (a.durationMin - b.durationMin));

  // Total free time = day window minus the union of occupied intervals.
  const iv = blocks
    .map(b => [Math.max(b.startMin, START_MIN), Math.min(b.startMin+(b.durationMin||0), END_MIN)])
    .filter(([s,e]) => e > s)
    .sort((a,b)=> a[0]-b[0]);
  let occ = 0, curS = null, curE = null;
  iv.forEach(([s,e]) => {
    if (curE === null) { curS = s; curE = e; }
    else if (s <= curE) { curE = Math.max(curE, e); }
    else { occ += curE - curS; curS = s; curE = e; }
  });
  if (curE !== null) occ += curE - curS;
  const freeMin = Math.max(0, (END_MIN - START_MIN) - occ);

  const head = document.createElement('div');
  head.className = 'dc-head';
  head.innerHTML = `<span>📋 Today's checklist</span><span class="dc-free-chip">🌤 ${fmtHrsMin(freeMin)} free today</span>`;
  host.appendChild(head);

  // Walk the day: emit a free-gap pill before each block, then the block row.
  let cursor = START_MIN;
  const emitGap = (gs, ge) => { if (ge - gs >= 5) host.appendChild(buildDayChecklistGapPill(gs, ge)); };
  blocks.forEach(b => {
    const bStart = b.startMin, bEnd = b.startMin + (b.durationMin||0);
    if (bStart > cursor) emitGap(cursor, bStart);
    host.appendChild(buildDayChecklistBlockRow(b, acts));
    cursor = Math.max(cursor, bEnd);
  });
  if (cursor < END_MIN) emitGap(cursor, END_MIN);

  if (!blocks.length) {
    const empty = document.createElement('div');
    empty.className = 'dc-empty';
    empty.textContent = 'Nothing planned yet — tap a free stretch above to add your first activity.';
    host.appendChild(empty);
  }
}

/* Quest mode for the day view: the viewed day's activities as gamified quest
   cards. Completing a quest is instant — it marks the block done, awards XP, and
   re-renders in place (no separate Quest Board screen needed). */
function buildDayQuest() {
  const host = document.getElementById('dayQuest');
  if (!host) return;
  host.innerHTML = '';
  const p = activeProfile();
  const acts = getAllActivities(p);
  const blocks = (getDayBlocks(currentDayKey) || [])
    .filter(b => b && b.startMin != null && (b.durationMin || 0) > 0)
    .slice().sort((a, b) => (a.startMin || 0) - (b.startMin || 0));

  // Compact hero / XP strip so the gamification travels with the view.
  const xp = getQuestXP(p);
  const level = Math.floor(xp / QUEST_XP_PER_LEVEL) + 1;
  const tier = heroTierForLevel(level);
  const into = xp % QUEST_XP_PER_LEVEL;
  const pct = Math.round(into / QUEST_XP_PER_LEVEL * 100);
  const doneCount = blocks.filter(b => b.completed).length;
  const head = document.createElement('div');
  head.className = 'dq-hero';
  head.innerHTML = `
    <div class="dq-hero-avatar">${tier.emoji}</div>
    <div class="dq-hero-info">
      <div class="dq-hero-title">Lv ${level} · ${escapeHtml(tier.name)}</div>
      <div class="dq-xp-bar"><div class="dq-xp-fill" style="width:${pct}%"></div></div>
      <div class="dq-hero-sub">${doneCount}/${blocks.length} quests done · ${into}/${QUEST_XP_PER_LEVEL} XP</div>
    </div>`;
  host.appendChild(head);

  if (!blocks.length) {
    const empty = document.createElement('div');
    empty.className = 'dc-empty';
    empty.textContent = 'No quests for this day yet — switch to Timeline to add some.';
    host.appendChild(empty);
    return;
  }

  const actById = id => acts.find(a => a.id === id);
  const list = document.createElement('div');
  list.className = 'dq-list';
  blocks.forEach(b => {
    const act = actById(b.actId) || { name: 'Quest', icon: '⭐' };
    const topic = act.isTraining ? getTrainingTopic(b.tag) : null;
    const icon = topic ? topic.icon : (act.icon || '⭐');
    const nm = topic
      ? (act.isCompetition ? (topic.id === 'general' ? 'Competition' : topic.name + ' Comp.') : topic.name)
      : (act.name || 'Quest');
    const done = !!b.completed;
    const card = document.createElement('div');
    card.className = 'quest-card dq-card' + (done ? ' quest-done' : '');
    card.innerHTML = `
      <div class="quest-time-col">
        <div class="quest-time">${formatQuestTime(b.startMin)}</div>
        ${b.durationMin ? `<div class="quest-dur">${formatDuration(b.durationMin)}</div>` : ''}
      </div>
      <div class="quest-card-icon">${icon}</div>
      <div class="quest-card-body">
        <div class="quest-card-name">${escapeHtml(nm)}</div>
        <div class="quest-card-meta"><span class="quest-xp-tag">+${QUEST_XP_PER_TASK} XP</span></div>
      </div>`;
    const right = document.createElement(done ? 'div' : 'button');
    if (done) {
      right.className = 'quest-done-badge';
      right.textContent = '✓';
    } else {
      right.type = 'button';
      right.className = 'quest-complete-btn';
      right.setAttribute('aria-label', 'Complete quest');
      right.title = 'Complete it! 🎯';
      right.textContent = '🎯';
      right.onclick = (e) => { e.stopPropagation(); toggleBlockDone(currentDayKey, b.id, e); };
    }
    card.appendChild(right);
    card.onclick = () => onTimelineBlockTap(b.id);
    list.appendChild(card);
  });
  host.appendChild(list);
}

function buildTimeline() {
  if (activeStopwatchTick) { clearInterval(activeStopwatchTick); activeStopwatchTick = null; }
  refreshRestDayButton();
  const tl = document.getElementById('timeline');
  const cl = document.getElementById('dayChecklist');
  const ql = document.getElementById('dayQuest');
  // Quest mode: the day's activities as gamified quest cards with instant
  // blast-to-complete.
  if (dayViewMode === 'quest') {
    if (tl) tl.style.display = 'none';
    if (cl) cl.style.display = 'none';
    if (ql) ql.style.display = '';
    buildDayQuest();
    renderDayNextUpBanner();
    return;
  }
  if (ql) ql.style.display = 'none';
  // 3b: in checklist mode, render the collapsed-free-time list instead of the
  // pixel timeline.
  if (dayViewMode === 'checklist') {
    if (tl) tl.style.display = 'none';
    if (cl) cl.style.display = '';
    buildDayChecklist();
    renderDayNextUpBanner();
    return;
  }
  if (tl) tl.style.display = '';
  if (cl) cl.style.display = 'none';
  const topbar = document.querySelector('#screen-day .day-topbar');
  tl.innerHTML = '';
  if (topbar) topbar.classList.remove('day-topbar--compact');
  const blocks = getDayBlocks(currentDayKey);

  // Zone = range in minutes from 6AM
  const [zMinStart, zMinEnd] = zoneRangeMin(currentZone);
  const spanMin = zMinEnd - zMinStart;
  const canvasHeight = spanMin * PX_PER_MIN;

  // Gutter (time labels)
  const gutter = document.createElement('div');
  gutter.className = 'tl-gutter';
  gutter.style.height = canvasHeight + 'px';

  // Canvas (where blocks go)
  const canvas = document.createElement('div');
  canvas.className = 'tl-canvas';
  canvas.style.height = canvasHeight + 'px';
  canvas.dataset.zmin = zMinStart;
  canvas.onclick = (e)=>handleCanvasTap(e, zMinStart);
  canvas.onmousemove = (e)=>updatePlacementGuideFromPointer(e, zMinStart);
  canvas.onmouseleave = ()=>clearPlacementGuide();
  canvas.classList.toggle('placing', !!selectedActivity);

  timelinePlacementGuideEl = document.createElement('div');
  timelinePlacementGuideEl.className = 'tl-placement-guide';
  timelinePlacementGuideEl.dataset.time = '';
  if (currentTimelineGuideY != null) {
    timelinePlacementGuideEl.style.top = `${currentTimelineGuideY}px`;
  }
  canvas.appendChild(timelinePlacementGuideEl);

  // Hour lines + labels
  const firstHour = Math.ceil((zMinStart + START_MIN) / 60);
  const lastHour  = Math.floor((zMinEnd + START_MIN) / 60);
  for (let h = firstHour; h <= lastHour; h++) {
    const minFromZoneStart = (h * 60) - START_MIN - zMinStart;
    const y = minFromZoneStart * PX_PER_MIN;

    const hourLine = document.createElement('div');
    hourLine.className = 'tl-hour-line';
    hourLine.style.top = y + 'px';
    canvas.appendChild(hourLine);

    const label = document.createElement('div');
    label.className = 'tl-hour-label';
    label.textContent = `${h>12?h-12:h}${h>=12?'pm':'am'}`;
    label.style.top = y + 'px';
    gutter.appendChild(label);

    // Half-hour line
    if (h < lastHour || minFromZoneStart + 30 < spanMin) {
      const halfY = y + 30 * PX_PER_MIN;
      if (halfY < canvasHeight) {
        const halfLine = document.createElement('div');
        halfLine.className = 'tl-halfhour-line';
        halfLine.style.top = halfY + 'px';
        canvas.appendChild(halfLine);
      }
    }
  }

  // Zone labels (only when viewing all) — now shown in side-band instead of canvas
  // (Side-band is appended below alongside the gutter)

  // "Now" line if today
  if (currentDayKey === todayKey()) {
    const now = new Date();
    const nowMin = now.getHours()*60 + now.getMinutes() - START_MIN;
    if (nowMin >= zMinStart && nowMin <= zMinEnd) {
      const nowLine = document.createElement('div');
      nowLine.className = 'tl-now-line';
      nowLine.style.top = (nowMin - zMinStart) * PX_PER_MIN + 'px';
      canvas.appendChild(nowLine);
    }
  }

  // Render visible blocks with column collision
  const visibleBlocks = blocks.filter(b => {
    const bStart = b.startMin - START_MIN;
    const bEnd   = bStart + b.durationMin;
    return bEnd > zMinStart && bStart < zMinEnd;
  });
  // A block's travel/get-ready buffer can overlap an adjacent activity — flag
  // both the buffer strip and the activity it collides with.
  const bufferConflicts = computeBufferConflicts(blocks);
  renderBlocksWithCollision(canvas, visibleBlocks, zMinStart, bufferConflicts.affected);

  if (!blocks.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'timeline-empty-state';
    emptyState.innerHTML = `
      <div class="title">Ready to plan this day?</div>
      <div class="hint">Pick an activity, then tap a time in the schedule.</div>
    `;
    canvas.appendChild(emptyState);
  }

  // Travel buffers (rendered underneath, not counted for collision)
  blocks.forEach(b => {
    if (!b.travelBuffer && !b.getReadyBuffer && !b.warmupBuffer) return;
    renderTravelBuffers(canvas, b, zMinStart, zMinEnd, bufferConflicts.perBlock.get(b.id));
  });

  // Pending invitations from sister — render as dashed-border blocks
  renderPendingInvitesOnTimeline(canvas, zMinStart, zMinEnd);

  const sideband = buildSideband(zMinStart, zMinEnd);
  tl.appendChild(sideband);
  tl.appendChild(gutter);
  tl.appendChild(canvas);
  const hasRunning = blocks.some(b => !!(b.stopwatch && b.stopwatch.enabled && b.stopwatch.running));
  if (hasRunning) {
    activeStopwatchTick = setInterval(()=>{
      if (document.querySelector('.screen.active')?.id !== 'screen-day') {
        clearInterval(activeStopwatchTick);
        activeStopwatchTick = null;
        return;
      }
      buildTimeline();
    }, 1000);
  }

  updateStopwatchGoalToasts(blocks);
  renderDayNextUpBanner();
}

function renderPendingInvitesOnTimeline(canvas, zMinStart, zMinEnd) {
  if (isParent()) return;
  const me = activeProfile();
  if (me !== 'jenn' && me !== 'jess') return;
  const invites = (state.shared.invites || []).filter(i =>
    i.to === me && i.status === 'pending' && i.day === currentDayKey
  );
  if (!invites.length) return;
  const acts = getAllActivities();
  invites.forEach(inv => {
    const act = acts.find(a => a.id === inv.actId);
    if (!act) return;
    const bStart = inv.startMin - START_MIN;
    const bEnd   = bStart + inv.durationMin;
    if (bEnd <= zMinStart || bStart >= zMinEnd) return;
    const top = Math.max(0, (bStart - zMinStart) * PX_PER_MIN);
    const height = Math.max(34, inv.durationMin * PX_PER_MIN - 2);
    const el = document.createElement('div');
    el.className = 'placed-block invitation';
    el.style.top = top + 'px';
    el.style.height = height + 'px';
    el.style.left = 'calc(50% + 2px)';
    el.style.width = 'calc(50% - 4px)';
    const fromName = inv.from === 'jenn' ? 'Jenn' : 'Jess';
    el.innerHTML = `
      <div class="block-name">💌 ${act.icon} ${act.name}</div>
      <div class="block-meta">From ${fromName} · ${formatTimeFromMin(inv.startMin)}</div>
      <div class="invitation-actions">
        <button onclick="event.stopPropagation();acceptInviteFromTimeline('${inv.id}')">✅ Accept</button>
        <button onclick="event.stopPropagation();declineInviteFromTimeline('${inv.id}')">❌ Ignore</button>
      </div>
    `;
    canvas.appendChild(el);
  });
}

function acceptInviteFromTimeline(id) {
  acceptInvite(id);
  buildTimeline();
}
function declineInviteFromTimeline(id) {
  declineInvite(id);
  buildTimeline();
}

function addZoneLabel(canvas, text, minOffset, zMinStart) {
  const rel = minOffset - zMinStart;
  if (rel < 0 || rel * PX_PER_MIN > canvas.offsetHeight + 200) return;
  const lbl = document.createElement('div');
  lbl.className = 'tl-zone-label';
  lbl.textContent = text;
  lbl.style.top = (rel * PX_PER_MIN + 4) + 'px';
  canvas.appendChild(lbl);
}

/* Returns true when a background is better paired with DARK (ink) text than
   with white. Uses WCAG relative-luminance contrast rather than a raw luma
   threshold, so mid-tone pastels (e.g. the teal #80cbc4 routine colour) get
   readable dark text instead of low-contrast white. */
function isLightColour(col) {
  if (!col) return false;
  let r, g, b, m;
  if ((m = col.match(/^#([0-9a-f]{6})$/i))) {
    r = parseInt(m[1].substr(0,2),16); g = parseInt(m[1].substr(2,2),16); b = parseInt(m[1].substr(4,2),16);
  } else if ((m = col.match(/^#([0-9a-f]{3})$/i))) {
    r = parseInt(m[1][0]+m[1][0],16); g = parseInt(m[1][1]+m[1][1],16); b = parseInt(m[1][2]+m[1][2],16);
  } else if ((m = col.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i))) {
    r = +m[1]; g = +m[2]; b = +m[3];
  } else {
    return false;
  }
  const lin = c => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
  const L = 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b);
  const Link = 0.2126*lin(0x2a) + 0.7152*lin(0x23) + 0.0722*lin(0x20); // --ink #2a2320
  const contrastWithWhite = 1.05 / (L + 0.05);
  const contrastWithInk   = (L + 0.05) / (Link + 0.05);
  return contrastWithInk >= contrastWithWhite; // dark text is at least as readable
}

/* ────────────────────────────────────────────────────────────────
   DOODLES — playful decorations around placed blocks.
   Seed = blockId + year-month, so they are stable within a month
   and refresh monthly. Only ~40% of blocks get a doodle.
   ──────────────────────────────────────────────────────────────── */
const DOODLE_POOLS = {
  spring: ['🌸','🌷','🐛','🦋','🌱','🌼'],
  summer: ['☀️','🌊','🍉','🐚','⛱','🌻'],
  autumn: ['🍂','🍁','🌰','🎃','🐿','🍄'],
  winter: ['❄️','⛄','✨','🧣','🌟','🎿'],
};
function hashSeed(str) {
  let h = 2166136261;
  for (let i=0;i<str.length;i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function doodleFor(blockId) {
  const d = new Date();
  const key = blockId + '-' + d.getFullYear() + '-' + d.getMonth();
  const seed = hashSeed(key);
  // 80% of blocks get a doodle
  if ((seed % 100) >= 80) return null;
  const pool = DOODLE_POOLS[getCurrentSeason()];
  const emoji = pool[(seed >> 8) % pool.length];
  // Pick a position: corners around the block (1=TL, 2=TR, 3=BR, 4=BL)
  const pos = ((seed >> 16) % 4) + 1;
  // Slight rotation for handmade feel
  const rot = (((seed >> 24) % 30) - 15); // -15..14 degrees
  return { emoji, pos, rot };
}
function renderDoodle(canvas, blockId, blockTop, blockHeight, leftPct, widthPct) {
  const d = doodleFor(blockId);
  if (!d) return;
  const el = document.createElement('div');
  el.className = 'tl-doodle';
  el.textContent = d.emoji;
  el.style.transform = `rotate(${d.rot}deg)`;

  // Place doodle peeking OUT from block corner (half outside, half inside).
  // This keeps it visible against any background and playful like stickers.
  const dh = 24;
  let top, left;

  if (d.pos === 1) {           // top-left: peek from upper-left corner
    top = blockTop - dh/3;
    left = `calc(${leftPct}% - ${dh/3}px)`;
  } else if (d.pos === 2) {    // top-right
    top = blockTop - dh/3;
    left = `calc(${leftPct + widthPct}% - ${dh*2/3}px)`;
  } else if (d.pos === 3) {    // bottom-right
    top = blockTop + blockHeight - dh*2/3;
    left = `calc(${leftPct + widthPct}% - ${dh*2/3}px)`;
  } else {                      // bottom-left
    top = blockTop + blockHeight - dh*2/3;
    left = `calc(${leftPct}% - ${dh/3}px)`;
  }
  el.style.top = top + 'px';
  el.style.left = left;
  canvas.appendChild(el);
}

/* Build the coloured side-band that shows Before School / School / etc.
   Weekday: 4 segments. Weekend: single "Free Time" segment.
   Returns a DOM element ready to insert before the gutter. */
function buildSideband(zMinStart, zMinEnd) {
  const band = document.createElement('div');
  band.className = 'tl-sideband';
  const canvasHeight = (zMinEnd - zMinStart) * PX_PER_MIN;
  band.style.height = canvasHeight + 'px';

  const d = formatDayKey(currentDayKey);
  const dow = d.getDay(); // 0=Sun, 6=Sat
  const isWeekend = (dow===0 || dow===6);

  // Segments defined as minutes-from-6am
  let segs;
  if (isWeekend) {
    segs = [ { start: 0, end: DAY_MIN_SPAN, label: '🎉 FREE TIME', cls: 'tl-band-free' } ];
  } else {
    segs = [
      { start: 0,   end: 180,          label: '🌅 BEFORE SCHOOL', cls: 'tl-band-before'  }, // 6–9am
      { start: 180, end: 540,          label: '🏫 SCHOOL',         cls: 'tl-band-school'  }, // 9am–3pm
      { start: 540, end: 720,          label: '🎒 AFTER SCHOOL',   cls: 'tl-band-after'   }, // 3pm–6pm
      { start: 720, end: DAY_MIN_SPAN, label: '🌙 EVENING',        cls: 'tl-band-evening' }, // 6pm–9pm
    ];
  }

  segs.forEach(s => {
    // Clip to visible zone
    const visStart = Math.max(s.start, zMinStart);
    const visEnd   = Math.min(s.end,   zMinEnd);
    if (visEnd <= visStart) return;
    const top    = (visStart - zMinStart) * PX_PER_MIN;
    const height = (visEnd - visStart) * PX_PER_MIN;
    if (height < 20) return; // too small to be useful
    const seg = document.createElement('div');
    seg.className = 'tl-band-seg ' + s.cls;
    seg.style.top = top + 'px';
    seg.style.height = (height - 2) + 'px';
    seg.textContent = s.label;
    band.appendChild(seg);
  });

  return band;
}

function zoneRangeMin(z) {
  // Return [startMinOffset, endMinOffset] from 6AM
  if (z==='all') return [0, DAY_MIN_SPAN];
  if (z==='morning') return [0, 360];       // 6AM-12PM
  if (z==='afternoon') return [360, 720];   // 12PM-6PM
  if (z==='evening') return [720, DAY_MIN_SPAN]; // 6PM-9PM
  return [0, DAY_MIN_SPAN];
}

/* Greedy column-packing collision: blocks that overlap get assigned to columns.
   conflictAffectedIds (optional Set) flags blocks whose buffer overlaps a
   neighbour, or that a neighbour's buffer overlaps — surfaced as a badge. */
function renderBlocksWithCollision(canvas, blocks, zMinStart, conflictAffectedIds) {
  if (!blocks.length) return;

  // Build overlap groups
  const sorted = blocks.slice().sort((a,b)=> (a.startMin - b.startMin) || (a.durationMin - b.durationMin));

  // Group consecutively-overlapping blocks
  const groups = [];
  sorted.forEach(b=>{
    const bStart = b.startMin;
    const bEnd   = b.startMin + b.durationMin;
    const g = groups.find(g=> g.end > bStart);
    if (g) {
      g.blocks.push(b);
      g.end = Math.max(g.end, bEnd);
    } else {
      groups.push({ blocks:[b], end: bEnd });
    }
  });

  groups.forEach(g=>{
    // Within a group, assign each block to the lowest-indexed column that's free
    const cols = []; // each col = {endMin}
    const assignments = new Map();
    g.blocks.forEach(b=>{
      const bStart = b.startMin;
      const bEnd = b.startMin + b.durationMin;
      let colIdx = cols.findIndex(c => c.endMin <= bStart);
      if (colIdx === -1) {
        colIdx = cols.length;
        cols.push({ endMin: bEnd });
      } else {
        cols[colIdx].endMin = bEnd;
      }
      assignments.set(b.id, colIdx);
    });
    const colCount = cols.length;

    g.blocks.forEach(b=>{
      const colIdx = assignments.get(b.id);
      renderBlockPixel(canvas, b, zMinStart, colIdx, colCount, conflictAffectedIds);
    });
  });
}

function renderBlockPixel(canvas, b, zMinStart, colIdx, colCount, conflictAffectedIds) {
  const act = getAllActivities().find(a=>a.id===b.actId);
  if (!act) return;

  // Clip the block to the visible zone and flag any edge it crosses, so a
  // block spilling past a selected zone's top/bottom shows a "continues"
  // marker instead of being silently cut (W7). In the default "all" view the
  // zone spans the whole day, so nothing is clipped.
  const [, zEndOffset] = zoneRangeMin(currentZone);
  const zoneSpan = zEndOffset - zMinStart;
  const relStart = (b.startMin - START_MIN) - zMinStart;
  const relEnd   = relStart + (b.durationMin || 0);
  const clippedTop    = relStart < 0;
  const clippedBottom = relEnd > zoneSpan;
  const visStartMin = Math.max(0, relStart);
  const visEndMin   = Math.min(zoneSpan, relEnd);
  const top = visStartMin * PX_PER_MIN;
  const height = Math.max(22, (visEndMin - visStartMin) * PX_PER_MIN - 2);

  const widthPct = 100 / colCount;
  const leftPct  = colIdx * widthPct;

  const isBuffer = !!b._isBuffer;
  const blockEl = document.createElement('div');
  const isCompact = height < 45;
  let fontTier = '';
  if (!isCompact) {
    if (height >= 110) fontTier = ' block-font-lg';
    else if (height >= 72) fontTier = ' block-font-md';
  }
  // Training topics (skating/swimming/dryland) each get their own icon + colour
  // so they read differently at a glance, not just by the text label.
  const topic = (act.isTraining) ? getTrainingTopic(b.tag) : null;
  const blockBg = topic ? trainingBlockColour(b) : (b.colour || CAT_HEX[act.cat] || '#888');
  const dispIcon = topic ? topic.icon : act.icon;
  const hasConflict = !isBuffer && !!(conflictAffectedIds && conflictAffectedIds.has(b.id));
  blockEl.className = 'placed-block'
    +(isBuffer ? ` travel-buf travel-buf--centered${b._bufferCls ? ' '+b._bufferCls : ''}${b._bufferConflict ? ' travel-buf--conflict' : ''}` : '')
    +(b.parentPinned?' parent-pinned':'')
    +(b.completed?' placed-block--completed':'')
    +(isLightColour(blockBg)?' light-bg':'')
    +(hasConflict ? ' placed-block--conflict' : '')
    +(isCompact?' compact':'')+fontTier;
  blockEl.id = 'block-'+b.id;
  blockEl.style.background = blockBg;
  blockEl.style.top = top + 'px';
  blockEl.style.height = height + 'px';
  blockEl.style.left = `calc(${leftPct}% + 2px)`;
  blockEl.style.width = `calc(${widthPct}% - 4px)`;

  const durStr = formatDuration(b.durationMin);
  const mood = getProfData().blockMoods?.[b.id] || '';

  let badges = '';
  // (Training sport is shown by the block's own icon now, so no separate badge.)
  // Competition shares the sport's topic icon/colour/name with Competitive Sports, so it
  // needs its own badge to stay visually distinct at a glance.
  if (!isBuffer && act.isCompetition) badges += '<span class="badge" title="Competition">🏆</span>';
  if (b.objectives?.length) badges += '<span class="badge">🎯</span>';
  if (b.note) badges += '<span class="badge">📝</span>';
  if (b.parentPinned) badges += '<span class="badge">📌</span>';
  if (!isBuffer && b.travelBuffer) badges += '<span class="badge">🚗</span>';
  if (hasConflict) badges += '<span class="badge" title="Not enough travel/get-ready time — overlaps another activity">⚠️</span>';
  if (b.public) badges += '<span class="badge">👯</span>';
  if (Array.isArray(b.invitedTo) && b.invitedTo.length) badges += '<span class="badge">💌</span>';
  if (b.seriesId) badges += '<span class="badge">🔁</span>';
  if (b.confirmed) badges += '<span class="badge">✅</span>';
  if (act.isRoutine) {
    const done = countChecklistDone(b, act);
    const total = countChecklistTotal(b, act);
    if (total > 0) badges += `<span class="badge">✓ ${done}/${total}</span>`;
  }
  if (mood) badges += `<span class="badge">${mood}</span>`;
  if (b.parentStamp && b.parentStamp.emoji) badges += `<span class="badge badge-stamp" title="Proud stamp from a parent">${b.parentStamp.emoji}</span>`;

  const noteTrim = (b.note && String(b.note).trim()) ? String(b.note).trim() : '';
  const noteHtml = (!isCompact && noteTrim)
    ? `<div class="block-note">${escapeHtml(noteTrim)}</div>`
    : '';
  // Training blocks show the get-ready gear as a tappable checklist right on
  // the block (built as DOM below), so the kid can pack without opening the
  // sheet. This is separate from the block's own "done" checkbox.
  const showGearChecklist = !isBuffer && !isCompact && act.isTraining && b.tag
    && getTrainingGearPresets(b.tag, act.isCompetition).length > 0;
  // For a multi-chore House-Chore block, show the tagged chores in the name.
  const choreList = (b.actId === 'chores' && Array.isArray(b.choreTags) && b.choreTags.length)
    ? b.choreTags.join(', ') : '';
  const baseName = topic
    ? (act.isCompetition ? (topic.id === 'general' ? 'Competition' : topic.name + ' Comp.') : topic.name)
    : act.name;
  const displayName = choreList ? `${act.name}: ${choreList}` : baseName;
  const nameHtml = isBuffer
    ? ''
    : (isCompact && noteTrim)
    ? `<div class="block-name block-name--inline">${dispIcon} <span class="block-title">${escapeHtml(baseName)}</span><span class="block-note-inline" title="${escapeHtml(noteTrim).replace(/"/g,'&quot;')}"> · ${escapeHtml(noteTrim)}</span></div>`
    : `<div class="block-name">${dispIcon} ${escapeHtml(displayName)}</div>`;
  const metaHtml = isBuffer
    ? `<div class="block-meta"><span class="travel-buf-label">${escapeHtml(b._bufferLabel || '')}</span></div>`
    : `<div class="block-meta">${durStr}${badges?' '+badges:''}</div>`;
  // Quick-complete tick — mark this block done straight from the timeline.
  const doneHtml = !isBuffer
    ? `<button type="button" class="block-done-btn${b.completed?' done':''}" aria-label="${b.completed?'Mark not done':'Mark done'}" onclick="event.stopPropagation(); toggleBlockDone(currentDayKey,'${b.id}',event)">${b.completed?'✓':''}</button>`
    : '';

  blockEl.innerHTML = `
    ${doneHtml}
    ${nameHtml}
    ${metaHtml}
    ${!isBuffer && b.stopwatch && b.stopwatch.enabled ? `<button type="button" class="block-stopwatch-btn" onclick="event.stopPropagation(); startBlockStopwatch('${b.id}')">⏱ Start stopwatch</button>` : ''}
    ${noteHtml}
  `;
  if (showGearChecklist) blockEl.appendChild(buildBlockGearChecklist(b, b.tag, act.isCompetition));
  if (!isBuffer && clippedTop) {
    const m = document.createElement('div');
    m.className = 'block-clip-marker block-clip-marker--top';
    m.textContent = '⌃ continues';
    blockEl.appendChild(m);
    blockEl.title = `${act.name} started earlier — switch to “All” to see the whole block`;
  }
  if (!isBuffer && clippedBottom) {
    const m = document.createElement('div');
    m.className = 'block-clip-marker block-clip-marker--bottom';
    m.textContent = 'continues ⌄';
    blockEl.appendChild(m);
    blockEl.title = `${act.name} continues past this section — switch to “All” to see the whole block`;
  }
  if (!isBuffer) attachTapGuard(blockEl, ()=> onTimelineBlockTap(b.id));
  canvas.appendChild(blockEl);

  // Decorative doodle (seasonal, stable per block per month)
  if (!isBuffer) renderDoodle(canvas, b.id, top, height, leftPct, widthPct);
}

function renderTravelBuffers(canvas, b, zMinStart, zMinEnd, conflict) {
  const travelBuf = getTravelBufMin(b);
  const readyBuf = getGetReadyBufMin(b);
  const warmupBuf = getWarmupBufMin(b);
  const endMin = b.startMin + b.durationMin;
  const entries = [];
  // Stack the buffers end-to-end so get-ready/driving/warm-up never share the
  // same minutes — you can't get skate boots ready while the car is moving.
  // Before the block: [get ready][travel][warm-up][ACTIVITY]; after: [ACTIVITY]
  // [travel][get ready] — warm-up never happens on the way home.
  if (b.warmupBuffer && warmupBuf > 0) {
    entries.push(
      { startMin: b.startMin - warmupBuf, label: '🔥 warm-up', bufDur: warmupBuf, cls: 'travel-buf-warmup', side: 'pre' },
    );
  }
  const preWarmup = (b.warmupBuffer ? warmupBuf : 0);
  if (b.travelBuffer && travelBuf > 0) {
    entries.push(
      { startMin: b.startMin - preWarmup - travelBuf, label: '🚗 ➡ travel', bufDur: travelBuf, cls: '', side: 'pre' },
      { startMin: endMin, label: '🚗 ⬅ travel', bufDur: travelBuf, cls: '', side: 'post' },
    );
  }
  if (b.getReadyBuffer && readyBuf > 0) {
    const preTravel = (b.travelBuffer ? travelBuf : 0);
    entries.push(
      { startMin: b.startMin - preWarmup - preTravel - readyBuf, label: '👕 ➡ get ready', bufDur: readyBuf, cls: 'travel-buf-ready', side: 'pre' },
      { startMin: endMin + preTravel, label: '👕 ⬅ get ready', bufDur: readyBuf, cls: 'travel-buf-ready', side: 'post' },
    );
  }
  const sourceAct = getAllActivities().find(a=>a.id===b.actId);
  const overlayBlocks = entries.map(({ startMin, label, bufDur, cls, side }) => {
    const segConflict = !!conflict && (side === 'pre' ? conflict.pre : conflict.post);
    return {
      id: `${b.id}-${startMin}-${bufDur}-${cls || 'travel'}`,
      actId: b.actId,
      startMin,
      durationMin: bufDur,
      colour: b.colour || CAT_HEX[sourceAct?.cat] || '#888',
      _isBuffer: true,
      _bufferCls: cls || '',
      _bufferLabel: (segConflict ? '⚠️ ' : '') + label,
      _bufferConflict: segConflict,
    };
  }).filter(buf => {
    const bufStart = buf.startMin - START_MIN;
    const bufEnd = bufStart + buf.durationMin;
    return bufEnd > zMinStart && bufStart < zMinEnd;
  });
  if (!overlayBlocks.length) return;
  renderBlocksWithCollision(canvas, overlayBlocks, zMinStart);
}

function bindDayTimelineCompactOnScroll() {
  if (dayTopbarCompactBound) return;
  const screen = document.getElementById('screen-day');
  const topbar = screen ? screen.querySelector('.day-topbar') : null;
  if (!screen || !topbar) return;
  const threshold = 36;
  screen.addEventListener('scroll', () => {
    if (!window.matchMedia('(min-width: 980px) and (orientation: landscape)').matches) {
      topbar.classList.remove('day-topbar--compact');
      return;
    }
    topbar.classList.toggle('day-topbar--compact', screen.scrollTop > threshold);
  }, { passive: true });
  dayTopbarCompactBound = true;
}

function formatDuration(min) {
  if (min < 60) return min+'m';
  const h = Math.floor(min/60);
  const m = min%60;
  return h+'h'+(m?(m+'m'):'');
}

function formatTimeFromMin(min) {
  // min = minutes from midnight (after adding START_MIN) OR absolute — handle absolute
  const h = Math.floor(min/60);
  const m = min%60;
  const ampm = h>=12?'pm':'am';
  const h12 = h>12?h-12:(h===0?12:h);
  return `${h12}:${m.toString().padStart(2,'0')}${ampm}`;
}

function escapeHtml(str) {
  if (str == null) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}
// Escape a value for use inside a double-quoted HTML attribute (escapeHtml leaves quotes).
function escapeAttr(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderSheetTimeSummary(elId, startMin, durationMin, travelOn, travelBufMin, readyOn=false, readyBufMin=15, warmupOn=false, warmupBufMin=20) {
  const el = document.getElementById(elId);
  if (!el) return;
  const dur = Math.max(0, durationMin|0);
  const start = startMin|0;
  const endMin = start + dur;
  const tBuf = Math.max(0, travelBufMin|0);
  const rBuf = Math.max(0, readyBufMin|0);
  const wBuf = Math.max(0, warmupBufMin|0);
  const homeMin = travelOn ? endMin + tBuf : null;
  const prepMin = readyOn ? start - rBuf : null;
  const warmupStartMin = warmupOn ? start - wBuf : null;
  let html = '';
  if (travelOn && homeMin != null) {
    html += `<div class="sheet-time-summary-row">`;
    html += `<div class="sheet-time-summary">Ends about ${formatTimeFromMin(endMin)}</div>`;
    html += `<div class="sheet-time-summary">Home about ${formatTimeFromMin(homeMin)} (after ${tBuf}m travel)</div>`;
    html += `</div>`;
  } else {
    html += `<div class="sheet-time-summary">Ends about ${formatTimeFromMin(endMin)}</div>`;
  }
  if (warmupOn && warmupStartMin != null) {
    html += `<div class="sheet-time-summary">🔥 Warm up by ${formatTimeFromMin(warmupStartMin)} (${wBuf}m before)</div>`;
  }
  if (readyOn && prepMin != null) {
    html += `<div class="sheet-time-summary">Start getting ready by ${formatTimeFromMin(prepMin)} (${rBuf}m before + ${rBuf}m after)</div>`;
  }
  el.innerHTML = html;
}

function syncDurationColumnSpacers(mode) {
  const startId = mode === 'training' ? 'trainingStartPicker' : (mode === 'activity' ? 'activityStartPicker' : 'editStartPicker');
  const durRowId = mode === 'training' ? 'trainingDurBtns' : (mode === 'activity' ? 'activityDurBtns' : 'editDurBtns');
  const slotId = mode === 'training' ? 'trainingDurationTopSpacer' : (mode === 'activity' ? 'activityDurationTopSpacer' : 'editDurationTopSpacer');
  const s = document.getElementById(startId);
  const d = document.getElementById(durRowId);
  const slot = document.getElementById(slotId);
  if (!s || !slot) return;
  const sh = s.offsetHeight;
  const dh = d ? d.offsetHeight : 0;
  const startCustom = s.querySelector('.custom-time-row');
  const ch = startCustom
    ? startCustom.offsetHeight + parseFloat(getComputedStyle(startCustom).marginTop || '0')
    : 0;
  slot.style.minHeight = Math.max(0, sh - dh - ch) + 'px';
}

function getTrainingGearPresets(tag, isComp) {
  if (isComp) {
    // Competition-day packing list — bring-everything, not the practice bag.
    if (tag === 'swimming') {
      return ['Competition suit','Goggles (spare too)','Swim cap (x2)','Towel (x2)','Warm clothes / parka','Snacks','Water bottle','Heat sheet / schedule','ID / registration'];
    }
    if (tag === 'skating') {
      return ['Competition dress','Skates','Guards & soakers','Gloves','Music backup','Hair & makeup kit','Tissues','Snacks','Water bottle','Schedule'];
    }
    return ['Uniform / kit','Water bottle','Snacks','Schedule','ID / registration'];
  }
  if (tag === 'swimming') {
    return ['Goggles','Swim cap','Swim suit','Towel','Training earphone','Mic','Hat','Board','Hand fins','Leg fins'];
  }
  if (tag === 'skating') {
    return ['Dress','Gloves','Skate','Training list'];
  }
  return [];
}

/* Does this placed block represent a Competition (vs a Training session)? */
function blockIsCompetition(b) {
  if (!b) return false;
  if (b.actId === 'competition') return true;
  const act = getAllActivities().find(a => a.id === b.actId);
  return !!(act && act.isCompetition);
}

function renderTrainingGearChecklist(containerId, stateObj, tag, persist, isComp) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const items = getTrainingGearPresets(tag, isComp);
  wrap.innerHTML = '';
  if (!items.length) {
    wrap.innerHTML = '<p style="font-size:0.9rem;color:var(--ink-light)">No preset gear for this sport yet.</p>';
    return;
  }
  if (!stateObj.gearState) stateObj.gearState = {};
  const prefix = isComp ? `gearC-${tag}` : `gear-${tag}`;
  items.forEach((label, idx)=>{
    const key = `${prefix}-${idx}`;
    const row = document.createElement('div');
    row.className = 'checklist-item' + (stateObj.gearState[key] ? ' checked' : '');
    row.innerHTML = `<div class="checklist-check">${stateObj.gearState[key]?'✓':''}</div><span class="checklist-text">${label}</span>`;
    row.onclick = ()=>{
      stateObj.gearState[key] = !stateObj.gearState[key];
      if (persist) saveAll();
      renderTrainingGearChecklist(containerId, stateObj, tag, persist, isComp);
    };
    wrap.appendChild(row);
  });
}

/* Tappable get-ready gear checklist rendered directly on a training block in
   the timeline. Each item toggles the block's gearState and persists it. This
   is deliberately separate from the block's own completion checkbox. */
function buildBlockGearChecklist(b, tag, isComp) {
  const items = getTrainingGearPresets(tag, isComp);
  const wrap = document.createElement('div');
  wrap.className = 'block-gear-list';
  if (!items.length) return wrap;
  if (!b.gearState) b.gearState = {};
  const prefix = isComp ? `gearC-${tag}` : `gear-${tag}`;
  const doneCount = items.filter((_, idx) => b.gearState[`${prefix}-${idx}`]).length;
  const head = document.createElement('div');
  head.className = 'block-gear-head';
  head.textContent = `${isComp ? '🏆' : '🎒'} ${isComp ? 'Pack for comp' : 'Get ready'} ${doneCount}/${items.length}`;
  wrap.appendChild(head);
  items.forEach((label, idx) => {
    const key = `${prefix}-${idx}`;
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'block-gear-item' + (b.gearState[key] ? ' checked' : '');
    row.innerHTML = `<span class="block-gear-box">${b.gearState[key] ? '✓' : ''}</span><span class="block-gear-label">${escapeHtml(label)}</span>`;
    row.onclick = (e) => {
      e.stopPropagation();
      b.gearState[key] = !b.gearState[key];
      markItemUpdated(b);
      saveAll();
      row.classList.toggle('checked', !!b.gearState[key]);
      row.querySelector('.block-gear-box').textContent = b.gearState[key] ? '✓' : '';
      const done = items.filter((_, i) => b.gearState[`${prefix}-${i}`]).length;
      head.textContent = `${isComp ? '🏆' : '🎒'} ${isComp ? 'Pack for comp' : 'Get ready'} ${done}/${items.length}`;
    };
    // The gear rows are real taps, not scroll gestures — let them through the
    // block-level tap guard.
    row.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    wrap.appendChild(row);
  });
  return wrap;
}

function countChecklistTotal(block, act) {
  const tmpl = getRoutineTemplate(act.routineId);
  const tmplCount = tmpl?.items?.length || 0;
  const extraCount = getKidExtras(act.routineId).length;
  const rewardCount = getUnlockedRoutineRewards(act.routineId).length;
  return tmplCount + extraCount + rewardCount;
}
function countChecklistDone(block, act) {
  const state = block.checklistState || {};
  return Object.values(state).filter(v=>v===true).length;
}

function getRoutineTemplate(routineId) {
  // Parent override of a built-in (e.g. morning/afterschool/evening) wins
  const overrides = (state.shared && state.shared.builtInRoutineOverrides) || {};
  if (overrides[routineId]) return overrides[routineId];
  if (ROUTINE_PRESETS[routineId]) return ROUTINE_PRESETS[routineId];
  return (state.shared.routineTemplates||[]).find(r=>r.id===routineId);
}
function isBuiltInRoutine(routineId) { return !!ROUTINE_PRESETS[routineId]; }

function onTimelineBlockTap(blockId) {
  if (isParent()) {
    openEditSheet(blockId);
    return;
  }
  const blocks = getDayBlocks(currentDayKey);
  const b = blocks.find(x => x.id === blockId);
  const act = b && getAllActivities().find(a => a.id === b.actId);
  if (!b || !act) return;
  if (act.isRoutine) {
    openKidRoutineQuick(blockId);
    return;
  }
  if (act.isTraining) {
    openKidTrainingQuick(blockId);
    return;
  }
  openEditSheet(blockId);
}

function isActivitySelectable(act) {
  if (!act) return false;
  if (act._locked || act._rewardLocked) return false;
  return true;
}

function getUnlockedRoutineRewards(routineId) {
  const p = getProfData();
  const map = (p.progress && p.progress.unlockedChecklistItems) || {};
  return map[routineId] || [];
}

function kidRoutineStopwatchClearTick() {
  if (kidRoutineStopwatchTick) {
    clearInterval(kidRoutineStopwatchTick);
    kidRoutineStopwatchTick = null;
  }
}

function kidTrainingStopwatchClearTick() {
  if (kidTrainingStopwatchTick) {
    clearInterval(kidTrainingStopwatchTick);
    kidTrainingStopwatchTick = null;
  }
}

function openKidRoutineQuick(blockId) {
  kidQuickBlockId = blockId;
  const blocks = getDayBlocks(currentDayKey);
  const b = blocks.find(x => x.id === blockId);
  const act = b && getAllActivities().find(a => a.id === b.actId);
  if (!b || !act || !act.isRoutine) return;
  document.getElementById('kidRoutineTitle').textContent = `${act.icon} ${act.name}`;
  renderChecklist(b, act, 'kidRoutineChecklist', { skipAdd: true });
  const swEl = document.getElementById('kidRoutineStopwatch');
  swEl.style.display = 'block';
  if (!b.stopwatch) b.stopwatch = {};
  b.stopwatch.enabled = true;
  if (b.stopwatch.goalSec == null) b.stopwatch.goalSec = Math.max(60, (b.durationMin|0) * 60);
  if (b.stopwatch.elapsedSec == null) b.stopwatch.elapsedSec = 0;
  if (!b.stopwatch.running) {
    b.stopwatch.running = true;
    b.stopwatch.startedAt = Date.now();
  }
  setDayBlocks(currentDayKey, blocks);
  buildTimeline();
  kidRoutineStopwatchClearTick();
  const tick = ()=>{
    const arr = getDayBlocks(currentDayKey);
    const blk = arr.find(x => x.id === blockId);
    if (!blk || !blk.stopwatch) return;
    const goal = blk.stopwatch.goalSec != null ? blk.stopwatch.goalSec : Math.max(60, (blk.durationMin|0) * 60);
    const used = stopwatchDisplayElapsed(blk.stopwatch);
    swEl.textContent = `⏱ Goal ${formatTimerSec(goal)} · Used ${formatTimerSec(used)}`;
  };
  tick();
  kidRoutineStopwatchTick = setInterval(tick, 500);
  openSheet('kidRoutineOverlay');
}

function kidRoutineOpenEdit() {
  kidRoutineStopwatchClearTick();
  const id = kidQuickBlockId;
  closeSheet('kidRoutineOverlay');
  if (id) openEditSheet(id);
}

function openKidTrainingQuick(blockId) {
  kidQuickBlockId = blockId;
  const blocks = getDayBlocks(currentDayKey);
  const b = blocks.find(x => x.id === blockId);
  const act = b && getAllActivities().find(a => a.id === b.actId);
  if (!b || !act || !act.isTraining) return;
  document.getElementById('kidTrainingTitle').textContent = `${act.icon} ${act.name}`;
  const objEl = document.getElementById('kidTrainingObjectives');
  const lines = (b.objectives && b.objectives.length)
    ? b.objectives.map(o => `<div class="checklist-item" style="cursor:default;border-color:var(--accent)"><span class="checklist-text">🎯 ${escapeHtml(o)}</span></div>`).join('')
    : '<p style="font-size:0.95rem;color:var(--ink-light)">No objectives listed yet — tap Edit to add some.</p>';
  objEl.innerHTML = lines;
  const swEl = document.getElementById('kidTrainingStopwatch');
  if (b.stopwatch && b.stopwatch.enabled) {
    swEl.style.display = 'block';
    kidTrainingStopwatchClearTick();
    const tick = ()=>{
      const arr = getDayBlocks(currentDayKey);
      const blk = arr.find(x => x.id === blockId);
      if (!blk || !blk.stopwatch) return;
      const goal = blk.stopwatch.goalSec != null ? blk.stopwatch.goalSec : Math.max(60, (blk.durationMin|0) * 60);
      const used = stopwatchDisplayElapsed(blk.stopwatch);
      swEl.textContent = `⏱ Goal ${formatTimerSec(goal)} · Used ${formatTimerSec(used)}`;
    };
    tick();
    if (!b.stopwatch.running) {
      b.stopwatch.running = true;
      b.stopwatch.startedAt = Date.now();
      b.stopwatch.elapsedSec = Math.max(0, b.stopwatch.elapsedSec|0);
      if (b.stopwatch.goalSec == null) b.stopwatch.goalSec = Math.max(60, (b.durationMin|0) * 60);
      setDayBlocks(currentDayKey, blocks);
      buildTimeline();
    }
    kidTrainingStopwatchTick = setInterval(tick, 500);
  } else {
    swEl.style.display = 'none';
  }
  renderTrainingGearChecklist('kidTrainingGear', b, b.tag || 'skating', true, act.isCompetition);
  openSheet('kidTrainingOverlay');
}

function kidTrainingOpenEdit() {
  const id = kidQuickBlockId;
  closeSheet('kidTrainingOverlay');
  if (id) openEditSheet(id);
}

/* Canvas tap → place new block at that pixel y */
function handleCanvasTap(e, zMinStart) {
  const rect = e.currentTarget.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const relMin = Math.round(y / PX_PER_MIN);
  // Snap to 15 min
  const snapped = Math.round(relMin / 15) * 15;
  const absMin = START_MIN + zMinStart + snapped;

  addActivityAtMin(absMin);
}

/* Shared placement entry point used by both the timeline canvas tap and the
   3b checklist free-slot buttons: with nothing selected, offer the slot
   picker; otherwise route the selected activity into its placement sheet. */
function addActivityAtMin(absMin) {
  // No activity picked yet → offer the picker right at the tapped time so the
  // kid doesn't have to select from the tray first.
  if (!selectedActivity) { openSlotPicker(absMin); return; }
  if (selectedActivity._locked) { showToast(`🔒 Unlocks in ${selectedActivity.season}!`); return; }
  if (selectedActivity._rewardLocked) { showToast('Keep going — this reward unlocks soon ✨'); return; }

  pendingStartMin = absMin;

  if (selectedActivity.isTraining) {
    ts = { durationMin: selectedActivity.durationMin||120, colour:CAT_HEX.training, tag:'skating', objectives:[], note:'', repeat:false, repeatDays:[], travelBuffer:false, getReadyBuffer:false, warmupBuffer:false, gearState:{}, travelBufMin:15, getReadyBufMin:15, warmupBufMin:20 };
    openTrainingSheet();
  } else {
    as_ = { durationMin: selectedActivity.durationMin||60, colour: CAT_HEX[selectedActivity.cat]||COLOURS[0], note:'', repeat:false, repeatDays:[], travelBuffer:false, travelBufMin:15, choreTags: [] };
    openActivitySheet();
  }
}

/* Quick activity picker shown when an empty slot is tapped with nothing
   selected. Keeps pendingStartMin from the tap, then routes into the normal
   placement sheet once an activity is chosen. */
let slotPickerFilter = 'all';
function openSlotPicker(absMin) {
  pendingStartMin = absMin;
  slotPickerFilter = 'all';
  const title = document.getElementById('slotPickerTitle');
  const hint = document.getElementById('slotPickerHint');
  if (title) title.textContent = `Add at ${formatTimeFromMin(absMin)}`;
  if (hint) hint.textContent = 'Pick what goes in this time slot.';
  renderSlotPicker();
  openSheet('slotPickerOverlay');
}
function renderSlotPicker() {
  const filterWrap = document.getElementById('slotPickerFilter');
  const list = document.getElementById('slotPickerList');
  if (!filterWrap || !list) return;
  const filters = [
    {id:'all', label:'All'}, {id:'daily', label:'🍽 Daily'}, {id:'routine', label:'🌅 Routines'},
    {id:'school', label:'📚 Learning'}, {id:'active', label:'🏃 Active'},
    {id:'training', label:'🏋️ Competitive Sports'}, {id:'free', label:'🎮 Free'},
  ];
  filterWrap.innerHTML = '';
  filters.forEach(f => {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'filter-chip' + (slotPickerFilter === f.id ? ' active' : '');
    c.textContent = f.label;
    c.onclick = () => { slotPickerFilter = f.id; renderSlotPicker(); };
    filterWrap.appendChild(c);
  });
  const acts = getAllActivities().filter(a => {
    if (slotPickerFilter === 'all') return true;
    return a.cat === slotPickerFilter;
  });
  list.innerHTML = '';
  acts.forEach(act => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'slot-pick-chip' + ((act._locked || act._rewardLocked) ? ' locked' : '');
    chip.innerHTML = `<span class="spc-icon">${act.icon}</span><span class="spc-name">${escapeHtml(act.name)}</span><span class="spc-dur">${formatDuration(act.durationMin || 60)}</span>`;
    chip.onclick = () => pickFromSlot(act.id);
    list.appendChild(chip);
  });
  const addC = document.createElement('button');
  addC.type = 'button';
  addC.className = 'slot-pick-chip slot-pick-add';
  addC.innerHTML = '<span class="spc-icon">＋</span><span class="spc-name">Custom activity</span>';
  addC.onclick = () => { closeSheet('slotPickerOverlay'); openCustomActivity(); };
  list.appendChild(addC);
}
function pickFromSlot(actId) {
  const act = getAllActivities().find(a => a.id === actId);
  if (!act) return;
  if (act._locked) { showToast(`🔒 Unlocks in ${act.season}!`); return; }
  if (act._rewardLocked) { showToast('Keep going — unlock this reward soon ✨'); return; }
  const _pr = getProfData()?.progress;
  if (_pr && !_pr.tutorialDone && TUTORIAL_STARTER_CHOICES.some(c => c.id === act.id)) {
    closeSheet('slotPickerOverlay'); openTutorial(); return;
  }
  selectedActivity = act;
  closeSheet('slotPickerOverlay');
  // pendingStartMin was set by openSlotPicker.
  if (act.isTraining) {
    ts = { durationMin: act.durationMin||120, colour:CAT_HEX.training, tag:'skating', objectives:[], note:'', repeat:false, repeatDays:[], travelBuffer:false, getReadyBuffer:false, warmupBuffer:false, gearState:{}, travelBufMin:15, getReadyBufMin:15, warmupBufMin:20 };
    openTrainingSheet();
  } else {
    as_ = { durationMin: act.durationMin||60, colour: CAT_HEX[act.cat]||COLOURS[0], note:'', repeat:false, repeatDays:[], travelBuffer:false, travelBufMin:15, choreTags: [] };
    openActivitySheet();
  }
}

function updatePlacementGuideFromPointer(ev, zMinStart) {
  const canvas = ev?.currentTarget;
  if (!canvas || !selectedActivity) return;
  const rect = canvas.getBoundingClientRect();
  const rawY = ev.clientY - rect.top;
  const clampedY = Math.max(0, Math.min(rect.height, rawY));
  const relMin = Math.round(clampedY / PX_PER_MIN);
  const snapped = Math.round(relMin / 15) * 15;
  const snappedY = Math.max(0, Math.min(rect.height, snapped * PX_PER_MIN));
  const absMin = START_MIN + zMinStart + snapped;
  currentTimelineGuideY = snappedY;
  canvas.style.setProperty('--place-guide-y', `${snappedY}px`);
  canvas.dataset.guideLabel = formatTimeFromMin(absMin);
  if (timelinePlacementGuideEl) {
    timelinePlacementGuideEl.style.top = `${snappedY}px`;
    timelinePlacementGuideEl.dataset.time = formatTimeFromMin(absMin);
  }
}

function clearPlacementGuide() {
  currentTimelineGuideY = null;
  const canvas = document.querySelector('#timeline .tl-canvas');
  if (!canvas) return;
  canvas.classList.remove('placing');
  canvas.style.removeProperty('--place-guide-y');
  canvas.dataset.guideLabel = '';
}

function setDayFocusPane(pane) {
  dayLandscapeFocusPane = pane || null;
  const dayScreen = document.getElementById('screen-day');
  if (!dayScreen) return;
  dayScreen.classList.toggle('focus-left', dayLandscapeFocusPane === 'left');
  dayScreen.classList.toggle('focus-center', dayLandscapeFocusPane === 'center');
  dayScreen.classList.toggle('focus-right', dayLandscapeFocusPane === 'right');
  applyLeftPaneState();
}

// Left "Today" pane auto-hides while editing (an activity is picked, i.e.
// focus-center) to free up room for the schedule; the Panel button also
// toggles it manually.
let leftPaneManualCollapsed = false;
function applyLeftPaneState() {
  const s = document.getElementById('screen-day');
  if (!s) return;
  const editing = s.classList.contains('focus-center');
  const collapsed = leftPaneManualCollapsed || editing;
  s.classList.toggle('left-collapsed', collapsed);
  const caret = document.getElementById('dayLeftToggleCaret');
  if (caret) caret.textContent = collapsed ? '▸' : '◀';
}
function toggleLeftPane() {
  const s = document.getElementById('screen-day');
  leftPaneManualCollapsed = !(s && s.classList.contains('left-collapsed'));
  applyLeftPaneState();
}

function applyDayLandscapeFocusState() {
  setDayFocusPane(dayLandscapeFocusPane);
}

function updateDayLandscapeChromeHeight() {
  if (dayLandscapeChromeRaf) cancelAnimationFrame(dayLandscapeChromeRaf);
  dayLandscapeChromeRaf = requestAnimationFrame(()=>{
    dayLandscapeChromeRaf = 0;
    const dayScreen = document.getElementById('screen-day');
    if (!dayScreen) return;
    const isLandscape = window.matchMedia('(min-width: 980px) and (orientation: landscape)').matches;
    if (!isLandscape) {
      dayScreen.style.removeProperty('--day-landscape-chrome');
      return;
    }
    const parentBanner = dayScreen.querySelector(':scope > #parentBannerDay');
    const topbar = dayScreen.querySelector(':scope > .day-topbar');
    const pb = parentBanner && parentBanner.style.display !== 'none' ? parentBanner.offsetHeight : 0;
    const tb = topbar ? topbar.offsetHeight : 0;
    const chromePx = Math.max(112, Math.ceil(pb + tb + 10));
    dayScreen.style.setProperty('--day-landscape-chrome', `${chromePx}px`);
  });
}
window.addEventListener('resize', updateDayLandscapeChromeHeight);
window.addEventListener('orientationchange', updateDayLandscapeChromeHeight);

function placementFeedback() {
  try {
    if (navigator.vibrate) navigator.vibrate(20);
  } catch(e) {}
  try {
    playBell();
  } catch(e) {}
}

/* Place a new block */
function placeBlock(actId, startMin, durationMin, colour, objectives, note, opts={}) {
  const id = Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  // W5: keep the block inside the day — trim its duration to the room left from
  // its start so what's saved always renders in full.
  const reqDur = Math.max(5, durationMin || 0);
  const fitDur = Math.min(reqDur, END_MIN - startMin);
  if (fitDur < reqDur) showToast('✂️ Trimmed to fit the day');
  durationMin = fitDur;
  const block = {
    id, actId, startMin, durationMin,
    createdAt: Date.now(), updatedAt: Date.now(), // so cross-device merges order correctly
    colour,
    objectives: objectives||[],
    note: note||'',
    tag: opts.tag||null,
    choreTags: opts.choreTags || (opts.choreTag ? [opts.choreTag] : null),
    choreTag: opts.choreTag || (opts.choreTags && opts.choreTags[0]) || null,
    parentPinned: isParent() ? true : false,
    travelBuffer: !!opts.travelBuffer,
    getReadyBuffer: !!opts.getReadyBuffer,
    warmupBuffer: !!opts.warmupBuffer,
    gearState: opts.gearState ? { ...opts.gearState } : {},
    checklistState: {},
    confirmed: false, // Parent confirms before progress counts toward level-up
  };
  if (block.travelBuffer) {
    block.travelBufMin = clampBufferMin(opts.travelBufMin != null ? opts.travelBufMin : DEFAULT_BUFFER_MIN);
  }
  if (block.getReadyBuffer) {
    block.getReadyBufMin = clampBufferMin(opts.getReadyBufMin != null ? opts.getReadyBufMin : DEFAULT_BUFFER_MIN);
  }
  if (block.warmupBuffer) {
    block.warmupBufMin = clampBufferMin(opts.warmupBufMin != null ? opts.warmupBufMin : DEFAULT_WARMUP_MIN);
  }
  const blocks = getDayBlocks(currentDayKey);
  blocks.push(block);
  setDayBlocks(currentDayKey, blocks);
  if (!isParent()) {
    const p = getProfData();
    p.progress.manualPlacedCount = (p.progress.manualPlacedCount || 0) + 1;
    enqueueMilestoneRewards();
    maybeShowRewardPrompt();
  }

  // Counts are recomputed from confirmed blocks elsewhere — no manual increment here.
  const profd = getProfData();
  if (!profd.activityCounts) profd.activityCounts = {};
  if (!profd.activityHours)  profd.activityHours  = {};
  saveAll();
  placementFeedback();

  if (opts.repeatDays?.length) {
    // Stamp series on the original block first
    const seriesId = 'sr-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    block.seriesId = seriesId;
    setDayBlocks(currentDayKey, blocks); // re-save to persist seriesId on original

    const useDateRange = !!(opts.repeatDateStart && opts.repeatDateEnd);
    if (useDateRange) {
      // Parent date-range mode: iterate every day from start..end, drop blocks
      // on dates whose getDay() matches one of the repeatDays (Mon=0..Sun=6 internal).
      const sd = new Date(opts.repeatDateStart);
      const ed = new Date(opts.repeatDateEnd);
      if (!isNaN(sd) && !isNaN(ed) && ed >= sd) {
        const targetSet = new Set(opts.repeatDays); // 0..6 with Mon=0
        for (let d = new Date(sd); d <= ed; d.setDate(d.getDate()+1)) {
          // Map JS getDay() (Sun=0..Sat=6) to internal (Mon=0..Sun=6)
          const jsDow = d.getDay();
          const internalIdx = jsDow === 0 ? 6 : jsDow - 1;
          if (!targetSet.has(internalIdx)) continue;
          const targetKey = dateToLocalKey(d);
          if (targetKey === currentDayKey) continue; // already placed
          const db = getDayBlocks(targetKey);
          // Avoid duplicating: skip if same series already on that day
          if (db.some(b => b.seriesId === seriesId)) continue;
          const nb = { ...block, id: Date.now().toString(36)+Math.random().toString(36).slice(2,5), checklistState:{}, seriesId, confirmed:false };
          db.push(nb); setDayBlocks(targetKey, db);
        }
      }
    } else {
      // Single-week mode (existing behavior)
      const keys = getDayKeys(weekOffset);
      const curIdx = keys.indexOf(currentDayKey);
      opts.repeatDays.forEach(idx=>{
        if (idx === curIdx) return;
        const targetKey = keys[idx];
        if (!targetKey) return;
        const nb = { ...block, id: Date.now().toString(36)+Math.random().toString(36).slice(2,5), checklistState:{}, seriesId, confirmed:false };
        const db = getDayBlocks(targetKey); db.push(nb); setDayBlocks(targetKey, db);
      });
    }
    saveAll();
  }

  checkLevelUp(actId);

  buildTimeline();
  buildTray();
  selectedActivity = null;
  setDayFocusPane(null);
  document.getElementById('trayHint').textContent = 'Tap an activity to pick';
}

async function removeBlock() {
  if (!editingBlockId) return;
  const blocks = getDayBlocks(currentDayKey);
  const blk = blocks.find(b=>b.id===editingBlockId);
  if (blk?.parentPinned && !isParent()) {
    showToast('📌 Parent-pinned — ask a grown-up');
    return;
  }
  // Series-aware: prompt to remove all if part of a series
  if (blk?.seriesId) {
    const siblings = countSeriesBlocks(blk.seriesId);
    if (siblings > 1) {
      const all = await showConfirm(`This block is part of a series of ${siblings}.\n\nOK = remove ALL in series\nCancel = remove only this one`, { okLabel:'Remove all', cancelLabel:'Only this' });
      if (all) {
        deleteSeriesBlocks(blk.seriesId);
        closeSheet('editOverlay');
        buildTimeline();
        showToast('Series removed 🗑');
        return;
      }
    }
  }
  tombstoneBlockIds([editingBlockId]);
  setDayBlocks(currentDayKey, blocks.filter(b=>b.id!==editingBlockId));
  closeSheet('editOverlay');
  buildTimeline();
}

/* Detach the currently-edited block from its series. Future edits/deletes
   won't ask "all in series" because seriesId is gone. Other series members
   are untouched. */
function detachFromSeries() {
  if (!editingBlockId) return;
  const blocks = getDayBlocks(currentDayKey);
  const blk = blocks.find(b=>b.id===editingBlockId);
  if (!blk || !blk.seriesId) return;
  delete blk.seriesId;
  setDayBlocks(currentDayKey, blocks);
  document.getElementById('seriesWrap').style.display = 'none';
  buildTimeline();
  showToast('Detached from series ✂️');
}

/* Recompute activityCounts/activityHours from CONFIRMED blocks across all weeks
   for the active profile. Single source of truth — replaces ad-hoc increments. */
function recountActivityProgress(p=activeProfile()) {
  if (p === 'parent') return; // parent has no own progress
  const profd = getProfData(p);
  if (!profd) return;
  const counts = {}; const hours = {};
  const weeks = profd.weeks || {};
  Object.values(weeks).forEach(arr => {
    (arr||[]).forEach(b => {
      if (!b.confirmed) return;
      counts[b.actId] = (counts[b.actId]||0) + 1;
      hours[b.actId]  = (hours[b.actId]||0)  + ((b.durationMin||0)/60);
    });
  });
  profd.activityCounts = counts;
  profd.activityHours  = hours;
}

/* Check level up — recounts first, then announces if a target is now met. */
function checkLevelUp(actId) {
  recountActivityProgress();
  const rule = (state.shared.levelRules||[]).find(r=>r.activityId===actId);
  if (!rule) return;
  const profd = getProfData();
  const cur = rule.type==='count' ? (profd.activityCounts[actId]||0) : (profd.activityHours[actId]||0);
  if (cur >= rule.target && !profd._levelledShown?.[actId]) {
    if (!profd._levelledShown) profd._levelledShown = {};
    profd._levelledShown[actId] = true;
    setTimeout(()=>{ showToast(`✨ LEVEL UP! ${rule.name}`); }, 400);
  }
}

