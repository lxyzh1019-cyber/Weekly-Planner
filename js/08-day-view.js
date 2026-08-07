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
  /* Land on the planning layout, always. dayViewMode used to survive every
     navigation, so one trip in through Today's quest rows left Quest mode stuck
     on: every day tapped in the week grid afterwards opened as tick-off cards
     until someone noticed the Timeline tab. A mode the child never chose on this
     screen is not a preference, it is a stale variable.

     setDayViewMode rather than a bare assignment: it also syncs the tab buttons
     and .quest-focus, and it ends in buildTimeline(), which is the render this
     line used to do. goQuestsToday() still wins — it calls setDayViewMode('quest')
     after openDay returns. */
  setDayViewMode('timeline');
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

/* The day is always shown whole now — the morning/afternoon/evening filters
   are gone from the topbar. Kept as a no-op-ish entry point because the zone
   plumbing (zoneRangeMin, clipping markers) still runs underneath, and a saved
   deep link or a template could still ask for a zone. */
function setZone(z) {
  currentZone = 'all';
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
/* Two modes: the timeline (plan it) and quests (confirm it). Checklist mode
   was a third rendering of the same day and duplicated what quests already do,
   so 'checklist' now lands on the timeline rather than a blank pane.

   Quest mode is where completion gets confirmed, so it gets the whole width —
   the Today rail and the activity tray are both about *planning*, and neither
   is any use while ticking things off. */
function setDayViewMode(mode) {
  dayViewMode = (mode === 'quest') ? 'quest' : 'timeline';
  const tb = document.getElementById('dayModeTimeline');
  const qb = document.getElementById('dayModeQuest');
  if (tb) { tb.classList.toggle('active', dayViewMode==='timeline'); tb.setAttribute('aria-selected', dayViewMode==='timeline'); }
  if (qb) { qb.classList.toggle('active', dayViewMode==='quest'); qb.setAttribute('aria-selected', dayViewMode==='quest'); }
  const scr = document.getElementById('screen-day');
  if (scr) scr.classList.toggle('quest-focus', dayViewMode==='quest');
  buildTimeline();
}

/* Day "Checklist" mode lived here — dcTintClass / dcToggleGap /
   buildDayChecklistBlockRow / buildDayChecklistGapPill / buildDayChecklist.
   It was a third rendering of the same day, and it overlapped Quest mode,
   which already lists the day's activities with a tick beside each. Two
   screens for confirming the same completions is one screen too many, so the
   day now offers Timeline (plan it) and Quest (confirm it). */

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
      // The arcade blast (js/06-quests.js) — the same completion the Quest
      // Board used to own. Now that the board hands its list to this view,
      // this is where that animation lives.
      right.onclick = (e) => { e.stopPropagation(); blastQuest(b.id, right, currentDayKey); };
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
  const ql = document.getElementById('dayQuest');
  // Quest mode: the day's activities as gamified quest cards with instant
  // blast-to-complete.
  if (dayViewMode === 'quest') {
    if (tl) tl.style.display = 'none';
    if (ql) ql.style.display = '';
    buildDayQuest();
    renderDayNextUpBanner();
    return;
  }
  if (ql) ql.style.display = 'none';
  if (tl) tl.style.display = '';
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
  const colAssignments = renderBlocksWithCollision(canvas, visibleBlocks, zMinStart, bufferConflicts.affected);

  if (!blocks.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'timeline-empty-state';
    emptyState.innerHTML = `
      <div class="title">Ready to plan this day?</div>
      <div class="hint">Pick an activity, then tap a time in the schedule.</div>
    `;
    canvas.appendChild(emptyState);
  }

  // Travel buffers (rendered underneath, not counted for collision). Each
  // buffer strip inherits its own activity's column/width, so it hugs the
  // card it belongs to instead of sprawling across a neighbouring column.
  blocks.forEach(b => {
    if (!b.travelBuffer && !b.getReadyBuffer && !b.warmupBuffer) return;
    const slot = colAssignments.get(b.id) || { col: 0, count: 1 };
    renderTravelBuffers(canvas, b, zMinStart, zMinEnd, bufferConflicts.perBlock.get(b.id), slot.col, slot.count || 1);
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
      <div class="block-name">💌 ${act.icon} ${escapeHtml(act.name)}</div>
      <div class="block-meta">From ${escapeHtml(fromName)} · ${formatTimeFromMin(inv.startMin)}</div>
      <div class="invitation-actions">
        <button onclick="event.stopPropagation();acceptInviteFromTimeline('${escapeJsAttr(inv.id)}')">✅ Accept</button>
        <button onclick="event.stopPropagation();declineInviteFromTimeline('${escapeJsAttr(inv.id)}')">❌ Ignore</button>
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
   neighbour, or that a neighbour's buffer overlaps — surfaced as a badge.
   Returns a Map of id -> {col, count} so the buffer pass below can reuse the
   same column/width as the activity a buffer belongs to, instead of each
   buffer strip claiming the full lane width and sprawling under a
   side-by-side neighbour. */
function renderBlocksWithCollision(canvas, blocks, zMinStart, conflictAffectedIds) {
  const assignments = new Map();
  if (!blocks.length) return assignments;

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
      assignments.set(b.id, { col: colIdx });
    });
    const colCount = cols.length;

    g.blocks.forEach(b=>{
      const colIdx = assignments.get(b.id).col;
      assignments.get(b.id).count = colCount;
      renderBlockPixel(canvas, b, zMinStart, colIdx, colCount, conflictAffectedIds);
    });
  });
  return assignments;
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
  // A buffer is a thin strip, not a block, and it needs its own floor: at
  // 1.4px per minute a 15-minute get-ready is 21px, and forcing that up to the
  // 22px block minimum made every stacked buffer overlap its neighbour by a
  // pixel or two. Get-ready, travel and warm-up sit end to end before a
  // training block, so three of them compounded into the visible mess of
  // overlapping strips. 11px is legible and still smaller than the shortest
  // buffer the editor allows. clampBufferMin's floor is 5 minutes = 7px at
  // 1.4px/min, so a 6px minimum is never actually reached and NO buffer is
  // ever inflated — which makes the overlap impossible by construction rather
  // than merely unlikely.
  const minH = b._isBuffer ? 6 : 22;
  const height = Math.max(minH, (visEndMin - visStartMin) * PX_PER_MIN - 2);
  // Anchoring: a pre-side buffer grows from its BOTTOM edge, so any overshoot
  // from the floor above bleeds backward into empty time rather than forward
  // into the activity it precedes. Post-side buffers already grow into empty
  // time, which is why "after" always looked right.
  const top = (b._isBuffer && b._bufferSide === 'pre')
    ? Math.max(0, visEndMin * PX_PER_MIN - height)
    : visStartMin * PX_PER_MIN;

  const widthPct = 100 / colCount;
  const leftPct  = colIdx * widthPct;

  const isBuffer = !!b._isBuffer;
  const blockEl = document.createElement('div');
  // One shared rule for how much a block says at a given height — see
  // blockContentTier (js/05-helpers.js). The week cards and the print sheet
  // read the same ladder, so a block is legible the same way in all three.
  const tier = blockContentTier(height);
  const isCompact = !blockTierAtLeast(tier, 'meta');
  let fontTier = '';
  if (!isCompact) {
    if (blockTierAtLeast(tier, 'full')) fontTier = ' block-font-lg';
    else if (blockTierAtLeast(tier, 'detail')) fontTier = ' block-font-md';
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

  // Badges are ordered by how much they change what you'd DO about the block:
  // a clash first, then what it is, then decoration. Only the first two show —
  // eight emoji in a row is texture, not information — and the rest fold into
  // a single "+N" chip (foldBadges).
  const badgeList = [];
  if (hasConflict) badgeList.push('<span class="badge" title="Not enough travel/get-ready time — overlaps another activity">⚠️</span>');
  // (Training sport is shown by the block's own icon now, so no separate badge.)
  // Competition shares the sport's topic icon/colour/name with Competitive Sports, so it
  // needs its own badge to stay visually distinct at a glance.
  if (!isBuffer && act.isCompetition) badgeList.push('<span class="badge" title="Competition">🏆</span>');
  if (act.isRoutine) {
    const done = countChecklistDone(b, act);
    const total = countChecklistTotal(b, act);
    if (total > 0) badgeList.push(`<span class="badge">✓ ${done}/${total}</span>`);
  }
  if (b.parentPinned) badgeList.push('<span class="badge">📌</span>');
  if (b.confirmed) badgeList.push('<span class="badge">✅</span>');
  if (b.parentStamp && b.parentStamp.emoji) badgeList.push(`<span class="badge badge-stamp" title="Proud stamp from a parent">${b.parentStamp.emoji}</span>`);
  // Below this line: things the block already says elsewhere (goals get their
  // own rows, the note its own line, buffers their own strips), so they only
  // appear when there is badge room to spare.
  if (b.objectives?.length) badgeList.push('<span class="badge">🎯</span>');
  if (b.note) badgeList.push('<span class="badge">📝</span>');
  if (!isBuffer && b.travelBuffer) badgeList.push('<span class="badge">🚗</span>');
  if (b.public) badgeList.push('<span class="badge">👯</span>');
  if (Array.isArray(b.invitedTo) && b.invitedTo.length) badgeList.push('<span class="badge">💌</span>');
  if (b.seriesId) badgeList.push('<span class="badge">🔁</span>');
  if (mood) badgeList.push(`<span class="badge">${mood}</span>`);
  const badges = foldBadges(badgeList, blockTierAtLeast(tier, 'detail') ? 3 : 2);

  const noteTrim = (b.note && String(b.note).trim()) ? String(b.note).trim() : '';
  const noteHtml = (!isCompact && noteTrim)
    ? `<div class="block-note">${escapeHtml(noteTrim)}</div>`
    : '';
  // Training blocks show the get-ready gear as a tappable checklist right on
  // the block (built as DOM below), so the kid can pack without opening the
  // sheet. This is separate from the block's own "done" checkbox.
  // A 130px block is a 93-minute session, but weekday training is routinely 60
  // (84px). Rather than lower the threshold and bring back the overflow, a
  // shorter block gets one tappable line instead of five — same store, opens
  // the sheet where all four have room.
  const isTrainingBlock = !isBuffer && act.isTraining;
  const showTrainingChecks = isTrainingBlock && blockTierAtLeast(tier, 'full');
  const showTrainingChip = isTrainingBlock && !showTrainingChecks && blockTierAtLeast(tier, 'detail');
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
    ? `<div class="block-name block-name--inline">${escapeHtml(dispIcon)} <span class="block-title">${escapeHtml(baseName)}</span><span class="block-note-inline" title="${escapeAttr(noteTrim)}"> · ${escapeHtml(noteTrim)}</span></div>`
    : `<div class="block-name">${escapeHtml(dispIcon)} ${escapeHtml(displayName)}</div>`;
  const metaHtml = isBuffer
    ? `<div class="block-meta"><span class="travel-buf-label">${escapeHtml(b._bufferLabel || '')}</span></div>`
    : `<div class="block-meta">${durStr}${badges?' '+badges:''}</div>`;
  // Quick-complete tick — mark this block done straight from the timeline.
  const doneHtml = !isBuffer
    ? `<button type="button" class="block-done-btn${b.completed?' done':''}" aria-label="${b.completed?'Mark not done':'Mark done'}" onclick="event.stopPropagation(); toggleBlockDone(currentDayKey,'${escapeJsAttr(b.id)}',event)">${b.completed?'✓':''}</button>`
    : '';
  // List as many objectives/goals as the block's own height can hold — same
  // "show what this block is about" idea as print/week, and the day view has
  // the most room, so a Piano block gets its whole goal list, not just the
  // 🎯 badge. The four training checks get their own tappable rows below, so
  // they aren't duplicated here.
  const objList = (!isBuffer && Array.isArray(b.objectives)) ? b.objectives.filter(Boolean) : [];
  let objHtml = '';
  if (blockTierAtLeast(tier, 'detail') && objList.length) {
    // Reserve the space the training checks are about to take, so the two
    // never fight over the same pixels.
    const reserved = showTrainingChecks ? 20 + Math.ceil(TRAINING_CHECKS.length / 2) * 30
                   : showTrainingChip ? 24 : 0;
    const maxObjRows = Math.max(0, Math.floor((height - 62 - reserved) / 17));
    if (maxObjRows > 0) {
      const shown = sliceDetailLines(objList.map(o => ({ icon: '🎯', text: o })), maxObjRows);
      objHtml = `<div class="block-objectives">${shown.map(r => `<div class="block-objective-row">${r.icon} ${escapeHtml(r.text)}</div>`).join('')}</div>`;
    }
  }

  blockEl.innerHTML = `
    ${doneHtml}
    ${nameHtml}
    ${metaHtml}
    ${objHtml}
    ${!isBuffer && b.stopwatch && b.stopwatch.enabled ? `<button type="button" class="block-stopwatch-btn" onclick="event.stopPropagation(); startBlockStopwatch('${escapeJsAttr(b.id)}')">⏱ Start stopwatch</button>` : ''}
    ${noteHtml}
  `;
  if (showTrainingChecks) blockEl.appendChild(buildBlockTrainingChecks(b));
  else if (showTrainingChip) blockEl.appendChild(buildBlockTrainingChip(b));
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

function renderTravelBuffers(canvas, b, zMinStart, zMinEnd, conflict, colIdx = 0, colCount = 1) {
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
      _bufferSide: side,
    };
  }).filter(buf => {
    const bufStart = buf.startMin - START_MIN;
    const bufEnd = bufStart + buf.durationMin;
    return bufEnd > zMinStart && bufStart < zMinEnd;
  });
  if (!overlayBlocks.length) return;
  // A block's own buffers never overlap each other in time (they're stacked
  // end-to-end), so they don't need their own column-packing pass — each one
  // just inherits the activity's column/width, so it hugs the card it
  // belongs to instead of spanning the whole lane under a neighbour.
  overlayBlocks.forEach(buf => renderBlockPixel(canvas, buf, zMinStart, colIdx, colCount));
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

// escapeHtml and escapeAttr moved to js/05-helpers.js — js/05, js/06 and js/07
// all call them, so a primitive declared here meant three earlier files
// depended on a later one.

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

/* The four training checks in a sheet's checklist styling (the block gets its
   own compact rendering — buildBlockTrainingChecks). */
function renderTrainingChecks(containerId, block) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  if (!block.trainingCheck) block.trainingCheck = {};
  wrap.innerHTML = '';
  TRAINING_CHECKS.forEach(c => {
    const on = !!block.trainingCheck[c.id];
    const row = document.createElement('div');
    row.className = 'checklist-item' + (on ? ' checked' : '');
    row.title = c.full;
    row.innerHTML = `<div class="checklist-check">${on ? '✓' : ''}</div>`
      + `<span class="checklist-text">${c.icon} ${escapeHtml(c.label)}<small style="display:block;opacity:0.75">${escapeHtml(c.full)}</small></span>`;
    row.onclick = () => {
      block.trainingCheck[c.id] = !block.trainingCheck[c.id];
      markItemUpdated(block);
      saveAll();
      renderTrainingChecks(containerId, block);
      buildTimeline();
    };
    wrap.appendChild(row);
  });
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

/* The four training checks, rendered on the block itself.

   This replaced a tappable copy of the whole packing list — ten rows on a
   skating block, ten on swimming — which at any realistic block height was a
   wall of squares stacked under the name. These four are the review a parent
   and a kid actually do after a session, they are the same four for every
   sport, and they fit. The packing list still lives in the training sheet.

   Each toggle persists to the block's own trainingCheck map, separate from the
   block's "done" tick: turning up prepared and finishing the session are two
   different claims. */
function buildBlockTrainingChecks(b) {
  const wrap = document.createElement('div');
  wrap.className = 'block-gear-list';
  if (!b.trainingCheck) b.trainingCheck = {};
  const doneCount = TRAINING_CHECKS.filter(c => b.trainingCheck[c.id]).length;
  const head = document.createElement('div');
  head.className = 'block-gear-head';
  head.textContent = `${blockIsCompetition(b) ? '🏆 Competition' : '🏋️ Session'} ${doneCount}/${TRAINING_CHECKS.length}`;
  wrap.appendChild(head);
  TRAINING_CHECKS.forEach(c => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'block-gear-item' + (b.trainingCheck[c.id] ? ' checked' : '');
    row.title = c.full;
    row.innerHTML = `<span class="block-gear-box">${b.trainingCheck[c.id] ? '✓' : ''}</span>`
      + `<span class="block-gear-label">${c.icon} ${escapeHtml(c.label)}</span>`;
    row.onclick = (e) => {
      e.stopPropagation();
      b.trainingCheck[c.id] = !b.trainingCheck[c.id];
      markItemUpdated(b);
      saveAll();
      row.classList.toggle('checked', !!b.trainingCheck[c.id]);
      row.querySelector('.block-gear-box').textContent = b.trainingCheck[c.id] ? '✓' : '';
      head.textContent = `${blockIsCompetition(b) ? '🏆 Competition' : '🏋️ Session'} `
        + `${TRAINING_CHECKS.filter(x => b.trainingCheck[x.id]).length}/${TRAINING_CHECKS.length}`;
    };
    // Real taps, not scroll gestures — let them through the block tap guard.
    row.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    wrap.appendChild(row);
  });
  return wrap;
}

/* The four checks folded to one line, for a block with room for a row but not
   for a grid. Tapping opens the training sheet rather than toggling anything —
   four states behind one control would be a guess about which one you meant. */
function buildBlockTrainingChip(b) {
  const st = b.trainingCheck || {};
  const done = TRAINING_CHECKS.filter(c => st[c.id]).length;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'block-train-chip' + (done === TRAINING_CHECKS.length ? ' complete' : '');
  el.title = TRAINING_CHECKS.map(c => `${st[c.id] ? '✅' : '⬜'} ${c.full}`).join('\n');
  el.innerHTML = `<span>${blockIsCompetition(b) ? '🏆' : '🏋️'} ${done}/${TRAINING_CHECKS.length}</span>`
    + `<span class="block-train-chip-go">check off ›</span>`;
  el.onclick = (e) => { e.stopPropagation(); openKidTrainingQuick(b.id); };
  el.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  return el;
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

// getUnlockedRoutineRewards lives in js/05-helpers.js — that copy takes an
// explicit profile, which this one dropped. Both files share one global scope,
// so the duplicate here silently won and made the parameter dead.

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
  // The four checks are the review; the packing list is the preparation. Both
  // belong on this sheet — it is the one surface with room for both, which is
  // why the block itself only carries the four.
  renderTrainingChecks('kidTrainingChecks', b);
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
    as_ = { durationMin: selectedActivity.durationMin||60, colour: CAT_HEX[selectedActivity.cat]||COLOURS[0], note:'', repeat:false, repeatDays:[], travelBuffer:false, travelBufMin:15, choreTags: [], objectives: [] };
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
    as_ = { durationMin: act.durationMin||60, colour: CAT_HEX[act.cat]||COLOURS[0], note:'', repeat:false, repeatDays:[], travelBuffer:false, travelBufMin:15, choreTags: [], objectives: [] };
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
    createdAt: syncNow(), updatedAt: syncNow(), // so cross-device merges order correctly
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

