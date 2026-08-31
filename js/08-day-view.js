// Weekly-Planner — day editor: timeline, checklist mode, placement, block render, remove.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   DAY EDITOR
════════════════════════════════════════════════════════════════ */
function openDayFromWeekCard(dayKey, dayIdx, focusBlockId=null) {
  const wk = computeWeekOffsetForDayKey(dayKey);
  openDay(dayKey, dayIdx, focusBlockId, wk);
}

/* ── How many days the schedule shows at once ──
   A column count, not a mode. What a block says, how it is placed and how it is
   edited are identical at 1, 2 and 3 — the only difference is how many days are
   on screen, which is the thing a parent laying out a week actually wants. It
   lives in localStorage and never in synced state: every state write here is a
   full-document upload, and this is a preference about one screen on one device.

   Three columns on a phone is confetti rather than a plan, so a narrow viewport
   is served one column whatever the stored preference says. */
const DAY_SPAN_LS_KEY = 'wp_day_span';
const DAY_SPAN_MIN_WIDTH_PER_COL = 300;  // below this a column stops being readable

function dayViewSpan() {
  const n = parseInt(localStorage.getItem(DAY_SPAN_LS_KEY) || '1', 10);
  return (n === 2 || n === 3) ? n : 1;
}
/* How many columns this viewport can carry at all, whatever is stored. */
function dayViewSpanAvailable() {
  return Math.max(1, Math.floor((window.innerWidth - 64) / DAY_SPAN_MIN_WIDTH_PER_COL));
}
/* What the viewport can actually carry, which is what buildTimeline renders. */
function dayViewSpanEffective() {
  return Math.max(1, Math.min(dayViewSpan(), dayViewSpanAvailable()));
}
function setDayViewSpan(n) {
  try { localStorage.setItem(DAY_SPAN_LS_KEY, String(n)); } catch (e) {}
  renderDaySpanTabs();
  buildTimeline();
}
/* The day keys on screen, left to right, starting at the anchor. Runs past the
   end of a week on purpose: three days from Saturday is Sat-Sun-Mon, which is
   how a weekend is actually planned. */
function dayViewKeys() {
  const span = dayViewSpanEffective();
  const start = formatDayKey(dayViewAnchorKey || currentDayKey);
  const out = [];
  for (let i = 0; i < span; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    out.push(dateToLocalKey(d));
  }
  return out;
}
function renderDaySpanTabs() {
  const wrap = document.getElementById('daySpanTabs');
  if (!wrap) return;
  const cur = dayViewSpan();
  /* What the SCREEN can carry, not what is currently chosen. This read
     dayViewSpanEffective(), which is min(chosen, available) — so on one day both
     2 and 3 were drawn as unavailable, and on two days 3 was: the control told
     you the wider views were impossible whenever you were not already in them. */
  const avail = dayViewSpanAvailable();
  wrap.innerHTML = '';
  [1, 2, 3].forEach(n => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'day-span-tab' + (cur === n ? ' active' : '') + (n > avail ? ' unavailable' : '');
    b.textContent = String(n);
    b.setAttribute('aria-label', n === 1 ? 'Show one day' : `Show ${n} days side by side`);
    b.setAttribute('aria-pressed', cur === n ? 'true' : 'false');
    b.onclick = () => setDayViewSpan(n);
    wrap.appendChild(b);
  });
}

function openDay(key, dayIdx, focusBlockId=null, weekOffsetOverride=null) {
  if (weekOffsetOverride != null) weekOffset = weekOffsetOverride;
  currentDayKey = key;
  // The anchor is the leftmost column; currentDayKey is the day being edited.
  // They are the same until a tap lands in another column.
  dayViewAnchorKey = key;
  selectedActivity = null;

  // Parent banner
  const banner = document.getElementById('parentBannerDay');
  banner.style.display = isParent() ? 'block' : 'none';

  document.getElementById('dayProfileBadge').textContent =
    isParent() ? (parentViewing==='jenn'?'🐥 (P)':'🦊 (P)') :
    (profile==='jenn'?'🐥 Jenn':'🦊 Jess');
  document.getElementById('dayTitle').textContent = '';
  renderDayHeading();

  showScreen('day');
  renderDaySpanTabs();
  buildTimeline();
  bindDayTimelineCompactOnScroll();
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
  if (nowMinutesInZone() >= 20 * 60 && currentDayKey === todayKey() && getDayBlocks(key).length > 0) {
    const m = getProfData().dayMoods?.[key];
    if (!m) showToast('💫 Tap 🌙 to reflect on today');
  }
}

/* The date line in the topbar. Names one day, or the span it is showing — a
   heading that said "Tuesday" over three columns would be lying about two of
   them. */
function renderDayHeading() {
  const el = document.getElementById('daySubtitle');
  if (!el) return;
  const keys = dayViewKeys();
  const first = formatDayKey(keys[0]);
  if (keys.length === 1) {
    el.textContent = `${DAY_LONG[dayIdxOfKey(keys[0])]}, ${MONTH_SHORT[first.getMonth()]} ${first.getDate()}`;
    return;
  }
  const last = formatDayKey(keys[keys.length - 1]);
  const lastPart = last.getMonth() === first.getMonth()
    ? `${last.getDate()}` : `${MONTH_SHORT[last.getMonth()]} ${last.getDate()}`;
  el.textContent = `${MONTH_SHORT[first.getMonth()]} ${first.getDate()} – ${lastPart}`;
}
/* Mon=0..Sun=6, the index DAY_LONG and getDayKeys both use. Derived from the
   date rather than passed in, because a column three days along may not be in
   the week the caller had in hand. */
function dayIdxOfKey(key) {
  const js = formatDayKey(key).getDay();
  return js === 0 ? 6 : js - 1;
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
  const wrap = document.querySelector('#screen-day .day-workspace');
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

/* setZone / zoneRange / zoneRangeMin and the currentZone variable lived here.
   They powered morning/afternoon/evening filters in the day topbar, which were
   removed long ago: the tabs went, setZone was left forcing 'all', and nothing
   ever set currentZone to anything else — so every caller was computing the
   whole day the long way round. The day is shown whole, full stop.

   The Before School / School / After School / Evening bands are a different
   thing entirely and are very much alive — see buildSideband. */

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

/* Quest mode lived here — setDayViewMode, buildDayQuest, and before them
   Checklist mode. Three renderings of one day, each with its own completion
   handlers, retired one at a time for the same reason: a tick that can happen in
   two places is a tick that can disagree with itself.

   The quest cards were not deleted, they moved. They are on Today now
   (js/31-today.js), which is where a child goes to *do* a day; this screen is
   where one gets built. That leaves the day screen a single layout, so there is
   no dayViewMode left to go stale between visits. */

/* One hour gutter, then one column per day on show. The gutter is shared
   deliberately: three days each carrying their own 6am-10pm ladder is three
   copies of the same information and two more vertical rules on a screen the
   family already called too busy. */
function buildTimeline() {
  if (activeStopwatchTick) { clearInterval(activeStopwatchTick); activeStopwatchTick = null; }
  refreshRestDayButton();
  const tl = document.getElementById('timeline');
  const topbar = document.querySelector('#screen-day .day-topbar');
  tl.innerHTML = '';
  if (topbar) topbar.classList.remove('day-topbar--compact');

  const keys = dayViewKeys();
  tl.classList.toggle('timeline--multi', keys.length > 1);
  tl.style.setProperty('--day-cols', String(keys.length));

  const canvasHeight = DAY_MIN_SPAN * PX_PER_MIN;

  /* THE HEADER ROW IS NOT INSIDE THE COLUMNS. It used to be: .tl-col-head sat
     at the top of each .tl-col, above .tl-canvas, so the canvas started ~48px
     down while .tl-gutter — a sibling of the whole column stack — started at
     zero. Nothing put the two back in phase, so at 2 and 3 days every hour
     label in the gutter named a line ~34 minutes below itself. One day has no
     header, which is the only reason this was ever invisible.

     Splitting the row out gives the gutter and the canvases one origin again.
     It stays INSIDE .day-workspace, sticky at its top: a header outside the
     scroller would have to mirror scrollLeft by hand to stay over its columns
     when the view pans sideways at 2 and 3 days, and this way the browser does
     it. The workspace is still the only scroller. */
  const multi = keys.length > 1;
  const headRow = document.createElement('div');
  headRow.className = 'tl-headrow';
  const headSpacer = document.createElement('div');
  headSpacer.className = 'tl-headrow-spacer';
  headRow.appendChild(headSpacer);
  const headCols = document.createElement('div');
  headCols.className = 'tl-headcols';
  headRow.appendChild(headCols);

  const body = document.createElement('div');
  body.className = 'tl-body';
  body.appendChild(buildHourGutter(canvasHeight));

  const cols = document.createElement('div');
  cols.className = 'tl-cols';
  let running = false;
  const allBlocks = [];
  keys.forEach(key => {
    const built = buildDayColumn(key, canvasHeight, multi);
    cols.appendChild(built.el);
    if (built.head) headCols.appendChild(built.head);
    if (built.hasRunningStopwatch) running = true;
    allBlocks.push(...built.blocks);
  });
  if (multi) tl.appendChild(headRow);
  body.appendChild(cols);
  tl.appendChild(body);

  if (running) {
    activeStopwatchTick = setInterval(()=>{
      if (document.querySelector('.screen.active')?.id !== 'screen-day') {
        clearInterval(activeStopwatchTick);
        activeStopwatchTick = null;
        return;
      }
      buildTimeline();
    }, 1000);
  }

  enhanceAccessibility(tl);
  updateStopwatchGoalToasts(allBlocks);
}

/* The 6am-10pm ladder, once. */
function buildHourGutter(canvasHeight) {
  const gutter = document.createElement('div');
  gutter.className = 'tl-gutter';
  gutter.style.height = canvasHeight + 'px';
  const firstHour = Math.ceil(START_MIN / 60);
  const lastHour  = Math.floor(END_MIN / 60);
  for (let h = firstHour; h <= lastHour; h++) {
    const label = document.createElement('div');
    label.className = 'tl-hour-label';
    label.textContent = `${h>12?h-12:h}${h>=12?'pm':'am'}`;
    label.style.top = ((h * 60) - START_MIN) * PX_PER_MIN + 'px';
    gutter.appendChild(label);
  }
  return gutter;
}

/* One day. Everything that used to be the body of buildTimeline, with the day
   it belongs to passed in rather than read off the global — which is what makes
   two and three columns possible at all. Each canvas carries its own dayKey, so
   a tap knows which day it landed on without anything having to guess. */
function buildDayColumn(dayKey, canvasHeight, withHeader) {
  const zMinStart = 0, zMinEnd = DAY_MIN_SPAN;
  const spanMin = zMinEnd - zMinStart;
  const blocks = getDayBlocks(dayKey);

  const col = document.createElement('div');
  col.className = 'tl-col' + (dayKey === currentDayKey ? ' tl-col--current' : '');
  col.dataset.dayKey = dayKey;

  let head = null;
  if (withHeader) {
    const d = formatDayKey(dayKey);
    head = document.createElement('button');
    head.type = 'button';
    head.className = 'tl-col-head' + (dayKey === todayKey() ? ' is-today' : '')
                   + (dayKey === currentDayKey ? ' tl-col-head--current' : '');
    head.dataset.dayKey = dayKey;
    head.innerHTML = `<span class="tl-col-day">${escapeHtml(DAY_SHORT[dayIdxOfKey(dayKey)])}</span>
      <span class="tl-col-date">${d.getDate()}</span>`;
    // Tapping the header makes that day the one the topbar's 📋 / 🌙 / 🗑 act on.
    head.onclick = () => { focusDayColumn(dayKey); };
  }

  const canvas = document.createElement('div');
  canvas.className = 'tl-canvas';
  canvas.style.height = canvasHeight + 'px';
  canvas.dataset.zmin = zMinStart;
  canvas.dataset.dayKey = dayKey;
  canvas.onclick = (e)=>handleCanvasTap(e, zMinStart);
  canvas.onmousemove = (e)=>updatePlacementGuideFromPointer(e, zMinStart);
  canvas.onmouseleave = ()=>clearPlacementGuide();
  canvas.classList.toggle('placing', !!selectedActivity);

  /* The zone bands used to be a fourth vertical strip beside the gutter, with
     their labels set sideways so a short band cut the word in half. They are
     the background of the day now: same source (isSchoolDay / SCHOOL_HOURS),
     one column fewer, and the label reads left to right. */
  paintZoneBands(canvas, dayKey, zMinStart, zMinEnd);

  const guide = document.createElement('div');
  guide.className = 'tl-placement-guide';
  guide.dataset.time = '';
  if (currentTimelineGuideY != null) guide.style.top = `${currentTimelineGuideY}px`;
  canvas.appendChild(guide);
  if (dayKey === currentDayKey) timelinePlacementGuideEl = guide;

  /* The hour and half-hour rules are NOT drawn here. They go on last, over the
     blocks — see the buildHourGrid append below. Drawn first, as they were,
     every rule vanished under the first thing placed on top of it. */

  // "Now" line, on the column that is actually today
  if (dayKey === todayKey()) {
    // Same zone as todayKey, or the line lands hours from where she actually is.
    const nowMin = nowMinutesInZone() - START_MIN;
    if (nowMin >= zMinStart && nowMin <= zMinEnd) {
      const nowLine = document.createElement('div');
      nowLine.className = 'tl-now-line';
      nowLine.style.top = (nowMin - zMinStart) * PX_PER_MIN + 'px';
      canvas.appendChild(nowLine);
    }
  }

  const visibleBlocks = blocks.filter(b => {
    const bStart = b.startMin - START_MIN;
    const bEnd   = bStart + b.durationMin;
    return bEnd > zMinStart && bStart < zMinEnd;
  });
  // A block's travel/get-ready buffer can overlap an adjacent activity — flag
  // both the buffer strip and the activity it collides with.
  const bufferConflicts = computeBufferConflicts(blocks);
  const colAssignments = renderBlocksWithCollision(canvas, visibleBlocks, zMinStart, bufferConflicts.affected, dayKey);

  if (!blocks.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'timeline-empty-state';
    emptyState.innerHTML = `
      <div class="title">Ready to plan this day?</div>
      <div class="hint">Tap a time to add something.</div>
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
  renderPendingInvitesOnTimeline(canvas, zMinStart, zMinEnd, dayKey);

  /* Last, so :00 and :30 stay readable across whatever is placed over them.
     zMinStart is 0 on every path today, which is why the grid can measure from
     START_MIN; a zoomed zone would have to pass its own offset in. */
  canvas.appendChild(buildHourGrid(PX_PER_MIN, spanMin, { cls: 'hour-grid--day' }));

  col.appendChild(canvas);
  return {
    el: col,
    head,
    blocks,
    hasRunningStopwatch: blocks.some(b => !!(b.stopwatch && b.stopwatch.enabled && b.stopwatch.running)),
  };
}

/* Make one column the day the topbar acts on. currentDayKey is what every
   existing writer reads — placeBlock, setDayMood, clearDay, applyTemplate, the
   edit sheet — so pointing it at the tapped column is the whole of what a
   multi-day view needs, rather than threading a day key through all of them. */
function focusDayColumn(dayKey) {
  if (!dayKey || dayKey === currentDayKey) return;
  currentDayKey = dayKey;
  renderDayHeading();
  // Two trees since the headers moved out of the columns: the canvas keeps its
  // outline, the header keeps its highlight, and both must agree on which day
  // the topbar is acting on.
  document.querySelectorAll('#timeline .tl-col').forEach(c =>
    c.classList.toggle('tl-col--current', c.dataset.dayKey === dayKey));
  document.querySelectorAll('#timeline .tl-col-head').forEach(h =>
    h.classList.toggle('tl-col-head--current', h.dataset.dayKey === dayKey));
  renderVibe();
}

function renderPendingInvitesOnTimeline(canvas, zMinStart, zMinEnd, dayKey) {
  const forDay = dayKey || currentDayKey;
  if (isParent()) return;
  const me = activeProfile();
  if (me !== 'jenn' && me !== 'jess') return;
  const invites = (state.shared.invites || []).filter(i =>
    i.to === me && i.status === 'pending' && i.day === forDay
  );
  if (!invites.length) return;
  const acts = getAllActivities(activeProfile(), { includeArchived: true });
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

/* Which stretches of a day are Before School / School / After School / Evening,
   or one Free Time band on a day with no school. Read from the real school
   calendar rather than the day of the week: a Tuesday in July is not a school
   day, and neither is a PD day (CLAUDE.md — isSchoolDay is the only way to ask). */
function dayZoneSegments(dayKey) {
  if (!isSchoolDay(dayKey)) {
    return [{ start: 0, end: DAY_MIN_SPAN, label: '🎉 Free time', cls: 'tl-band-free' }];
  }
  const h = schoolHours();
  const s = h.startMin, e = h.endMin;
  // 3h after the bell is "after school"; the rest of the night is evening.
  const afterEnd = Math.min(e + 180, DAY_MIN_SPAN);
  const segs = [];
  if (s > 0)                   segs.push({ start: 0, end: s, label: '🌅 Before school', cls: 'tl-band-before' });
  /* Lunch recess splits the school band rather than sitting on top of it, so
     the middle of the day reads as three stretches and not as one block with a
     stripe through it. Only when a parent has set one — the shipped calendar
     never knew about lunch, and inventing a time would be worse than silence. */
  if (h.lunchMin > 0 && h.lunchStartMin != null) {
    segs.push({ start: s, end: h.lunchStartMin, label: '🏫 School', cls: 'tl-band-school' });
    segs.push({ start: h.lunchStartMin, end: h.lunchStartMin + h.lunchMin,
                label: '🥪 Lunch recess', cls: 'tl-band-lunch' });
    segs.push({ start: h.lunchStartMin + h.lunchMin, end: e, label: '🏫 School', cls: 'tl-band-school' });
  } else {
                               segs.push({ start: s, end: e, label: '🏫 School', cls: 'tl-band-school' });
  }
  if (afterEnd > e)            segs.push({ start: e, end: afterEnd, label: '🎒 After school', cls: 'tl-band-after' });
  if (DAY_MIN_SPAN > afterEnd) segs.push({ start: afterEnd, end: DAY_MIN_SPAN, label: '🌙 Evening', cls: 'tl-band-evening' });
  return segs.filter(x => x.end > x.start);
}

/* The bands used to be their own vertical strip beside the gutter, with the
   labels set sideways — which meant the band's height was the label's line
   length, so a short before-school gap rendered "BEFORE SCHOOL" cut in half and
   needed a whole fallback ladder of shorter strings. Painted as the day's
   background instead: one vertical strip fewer, no sideways text, no fallback,
   and the label reads the way words read. */
function paintZoneBands(canvas, dayKey, zMinStart, zMinEnd) {
  dayZoneSegments(dayKey).forEach(s => {
    const visStart = Math.max(s.start, zMinStart);
    const visEnd   = Math.min(s.end,   zMinEnd);
    if (visEnd <= visStart) return;
    const top    = (visStart - zMinStart) * PX_PER_MIN;
    const height = (visEnd - visStart) * PX_PER_MIN;
    const seg = document.createElement('div');
    seg.className = 'tl-band-seg ' + s.cls;
    seg.style.top = top + 'px';
    seg.style.height = height + 'px';
    seg.title = s.label;
    // Under ~34px there is no room for a line of text without it fighting the
    // hour rule sitting in the same pixels; the colour still says which stretch
    // it is, and the title carries the name.
    if (height >= 34) {
      const lab = document.createElement('span');
      lab.className = 'tl-band-label';
      lab.textContent = s.label;
      seg.appendChild(lab);
    }
    canvas.appendChild(seg);
  });
}

/* Greedy column-packing collision: blocks that overlap get assigned to columns.
   conflictAffectedIds (optional Set) flags blocks whose buffer overlaps a
   neighbour, or that a neighbour's buffer overlaps — surfaced as a badge.
   Returns a Map of id -> {col, count} so the buffer pass below can reuse the
   same column/width as the activity a buffer belongs to, instead of each
   buffer strip claiming the full lane width and sprawling under a
   side-by-side neighbour. */
function renderBlocksWithCollision(canvas, blocks, zMinStart, conflictAffectedIds, dayKey) {
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
      renderBlockPixel(canvas, b, zMinStart, colIdx, colCount, conflictAffectedIds, dayKey);
    });
  });
  return assignments;
}

function renderBlockPixel(canvas, b, zMinStart, colIdx, colCount, conflictAffectedIds, dayKey) {
  // The day this block belongs to, not "whichever day the topbar names" — in a
  // 2- or 3-day view those are different, and a tick that wrote to the wrong one
  // would be a tick that silently completed another day's block.
  const ownDayKey = dayKey || currentDayKey;
  const act = findActivity(b.actId);
  if (!act) return;

  // The day is always shown whole, so a block can only be clipped by running
  // past the 6am-9pm canvas itself — the "continues" markers below still cover
  // that. The zone filter that used to narrow this is gone.
  const zoneSpan = DAY_MIN_SPAN - zMinStart;
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
  /* Whether the name and the duration go on two lines or one is a layout
     question, not a "how much may it say" one, and using the ladder's `meta`
     step for it stacked a 40px block into a 30px content box — the half-hour
     Breakfast whose title came out sliced. See BLOCK_STACK_MIN. */
  const isCompact = height < BLOCK_STACK_MIN;
  /* And the shortest blocks the app allows — a 15-minute break is 22px, of
     which borders and padding take 8 — need the tighter of the two one-line
     settings, or the single line they do have overflows too. 13px is the house
     floor and this is the one place that reaches it. */
  const isTight = isCompact && height < 30;
  let fontTier = '';
  if (!isCompact) {
    if (blockTierAtLeast(tier, 'full')) fontTier = ' block-font-lg';
    else if (blockTierAtLeast(tier, 'detail')) fontTier = ' block-font-md';
  }
  // Training topics (skating/swimming/dryland) each get their own icon + colour
  // so they read differently at a glance, not just by the text label.
  const topic = (act.isTraining) ? getTrainingTopic(b.tag) : null;
  const blockBg = blockColour(b);
  const dispIcon = topic ? topic.icon : act.icon;
  const hasConflict = !isBuffer && !!(conflictAffectedIds && conflictAffectedIds.has(b.id));
  blockEl.className = 'placed-block'
    +(isBuffer ? ` travel-buf travel-buf--centered${b._bufferCls ? ' '+b._bufferCls : ''}${b._bufferConflict ? ' travel-buf--conflict' : ''}` : '')
    +(b.parentPinned?' parent-pinned':'')
    +(b.completed?' placed-block--completed':'')
    +(isLightColour(blockBg)?' light-bg':'')
    +(hasConflict ? ' placed-block--conflict' : '')
    +(isCompact?' compact':'')+(isTight?' compact-tight':'')+fontTier;
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
  /* Through the same helper Today reads, on the block's own day — so a block
     that Today calls "Homework · Block 2" is called that here too. dayKey is
     the canvas's own, never the currentDayKey global: on a 2- or 3-column day
     view the global points at whichever column was last focused. */
  const named = blockDisplayName(b, undefined, dayKey);
  const baseName = named.n
    ? named.name + ' · Block ' + named.n
    : named.name;
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
    ? `<button type="button" class="block-done-btn${b.completed?' done':''}" aria-label="${b.completed?'Mark not done':'Mark done'}" onclick="event.stopPropagation(); toggleBlockDone('${escapeJsAttr(ownDayKey)}','${escapeJsAttr(b.id)}',event)">${b.completed?'✓':''}</button>`
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
  if (!isBuffer) attachTapGuard(blockEl, ()=> { focusDayColumn(ownDayKey); onTimelineBlockTap(b.id); });
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
  const sourceAct = findActivity(b.actId);
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

/* Bound to .day-workspace, which is the day screen's one scroller. It used to
   listen on #screen-day itself — right while the screen was the scrolling
   element, wrong now that the workspace inside it is. Scroll events do not
   bubble, so listening on the wrong element is silent rather than noisy. */
function bindDayTimelineCompactOnScroll() {
  if (dayTopbarCompactBound) return;
  const screen = document.getElementById('screen-day');
  const topbar = screen ? screen.querySelector('.day-topbar') : null;
  const scroller = screen ? screen.querySelector('.day-workspace') : null;
  if (!screen || !topbar || !scroller) return;
  const threshold = 36;
  scroller.addEventListener('scroll', () => {
    if (!window.matchMedia('(min-width: 980px) and (orientation: landscape)').matches) {
      topbar.classList.remove('day-topbar--compact');
      return;
    }
    topbar.classList.toggle('day-topbar--compact', scroller.scrollTop > threshold);
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
  const act = findActivity(b.actId);
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
    // The middle button is a pan, never a tap, so it must reach .day-workspace:
    // swallowing it here is why a middle-drag started over a gear row did
    // nothing at all while the same drag two pixels away panned the day.
    row.addEventListener('pointerdown', (ev) => { if (ev.button !== 1) ev.stopPropagation(); });
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
  // Middle button passes through to the workspace's pan — see buildBlockTrainingChecks.
  el.addEventListener('pointerdown', (ev) => { if (ev.button !== 1) ev.stopPropagation(); });
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
  const act = b && findActivity(b.actId);
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
  const act = b && findActivity(b.actId);
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
  const act = b && findActivity(b.actId);
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

/* Canvas tap → place new block at that pixel y, on the day that canvas is.
   The day comes off the canvas, not off currentDayKey: with two or three columns
   on screen those differ, and reading the global would drop every block into
   whichever day the topbar happened to name. */
function handleCanvasTap(e, zMinStart) {
  const canvas = e.currentTarget;
  focusDayColumn(canvas.dataset.dayKey);
  addActivityAtMin(START_MIN + zMinStart + canvasSnapMin(canvas, e.clientY));
}

/* One place converts a pointer's y into a snapped minute, for the tap and for
   the guide that promises where the tap will land — they disagreed before.

   clientTop is subtracted because getBoundingClientRect() reports the BORDER
   box while everything drawn in the canvas is positioned against the padding
   box; it is 0 today (the canvas draws its edge with an inset shadow) and stays
   correct if a real border ever comes back.

   One rounding, not two: Math.round(Math.round(y / 1.4) / 15) * 15 rounded to
   the minute and then to the quarter, so a boundary could move half a minute
   before the quarter-hour round ever saw it.

   And the last quarter-hour of the day is not a legal start. Without the clamp
   a tap at the very bottom gave startMin === END_MIN, placeBlock trimmed the
   duration to END_MIN - startMin = 0, and a zero-minute block was saved. */
function canvasSnapMin(canvas, clientY) {
  const rect = canvas.getBoundingClientRect();
  const y = clientY - rect.top - canvas.clientTop;
  const snapped = Math.round(y / (PX_PER_MIN * 15)) * 15;
  return Math.max(0, Math.min(DAY_MIN_SPAN - 15, snapped));
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
    ts = { durationMin: selectedActivity.durationMin||120, colour:CAT_HEX.training, tag:'skating', objectives:[], note:'', compName:'', repeat:false, repeatDays:[], travelBuffer:false, getReadyBuffer:false, warmupBuffer:false, gearState:{}, travelBufMin:15, getReadyBufMin:15, warmupBufMin:20 };
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
  /* Name the day as well as the time whenever more than one day is on screen.
     "Add at 3:30pm" is ambiguous the moment there are three columns, and a
     block landing on the wrong day is not a mistake a child can see. */
  const many = dayViewKeys().length > 1;
  const dayName = many ? `${DAY_SHORT[dayIdxOfKey(currentDayKey)]} ` : '';
  if (title) title.textContent = `Add ${dayName}${formatTimeFromMin(absMin)}`;
  if (hint) hint.textContent = 'Pick what goes in this time slot.';
  renderSlotPicker();
  openSheet('slotPickerOverlay');
}

/* What she has actually been putting on her days, most-used first. Reads the
   last four weeks of her own blocks — a library of forty activities sorted
   alphabetically buries the six a real week is made of. */
function slotPickerRecentActIds(limit) {
  const counts = new Map();
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 28);
  const weeks = (getProfData() || {}).weeks || {};
  Object.keys(weeks).forEach(k => {
    if (formatDayKey(k) < cutoff) return;
    (weeks[k] || []).forEach(b => {
      if (!b || !b.actId) return;
      counts.set(b.actId, (counts.get(b.actId) || 0) + 1);
    });
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
    .slice(0, limit || 6).map(e => e[0]);
}

function renderSlotPicker() {
  const filterWrap = document.getElementById('slotPickerFilter');
  const list = document.getElementById('slotPickerList');
  if (!filterWrap || !list) return;
  const acts = getAllActivities();

  /* One filter table, shared with everything else that filters activities
     (js/01-config.js). This list used to be a hand-copied subset of the tray's,
     which is exactly how the two drifted apart. Chips that match nothing are
     dropped rather than offered as a dead end. */
  const chips = [{ id: 'all', label: 'All' }].concat(
    ACTIVITY_FILTERS.filter(f => acts.some(a => activityMatchesFilter(a, f.id))));
  filterWrap.innerHTML = '';
  if (!chips.some(f => f.id === slotPickerFilter)) slotPickerFilter = 'all';
  chips.forEach(f => {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'filter-chip' + (slotPickerFilter === f.id ? ' active' : '');
    c.textContent = f.label;
    c.onclick = () => { slotPickerFilter = f.id; renderSlotPicker(); };
    filterWrap.appendChild(c);
  });

  const filtered = acts.filter(a => activityMatchesFilter(a, slotPickerFilter));
  // Most-used first, only on the unfiltered list — inside a category the
  // library's own order is the one the child is looking for.
  let ordered = filtered;
  if (slotPickerFilter === 'all') {
    const recent = slotPickerRecentActIds(6);
    const rank = id => { const i = recent.indexOf(id); return i === -1 ? 999 : i; };
    ordered = filtered.slice().sort((a, b) => rank(a.id) - rank(b.id));
  }

  list.innerHTML = '';
  ordered.forEach(act => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'slot-pick-chip' + ((act._locked || act._rewardLocked) ? ' locked' : '');
    chip.innerHTML = `<span class="spc-icon">${escapeHtml(act.icon)}</span><span class="spc-name">${escapeHtml(act.name)}</span><span class="spc-dur">${escapeHtml(formatDuration(act.durationMin || 60))}</span>`;
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
    ts = { durationMin: act.durationMin||120, colour:CAT_HEX.training, tag:'skating', objectives:[], note:'', compName:'', repeat:false, repeatDays:[], travelBuffer:false, getReadyBuffer:false, warmupBuffer:false, gearState:{}, travelBufMin:15, getReadyBufMin:15, warmupBufMin:20 };
    openTrainingSheet();
  } else {
    as_ = { durationMin: act.durationMin||60, colour: CAT_HEX[act.cat]||COLOURS[0], note:'', repeat:false, repeatDays:[], travelBuffer:false, travelBufMin:15, choreTags: [], objectives: [] };
    openActivitySheet();
  }
}

function updatePlacementGuideFromPointer(ev, zMinStart) {
  const canvas = ev?.currentTarget;
  if (!canvas || !selectedActivity) return;
  // The same snap the tap will use, so the line promises where the block lands.
  const snapped = canvasSnapMin(canvas, ev.clientY);
  const snappedY = snapped * PX_PER_MIN;
  const absMin = START_MIN + zMinStart + snapped;
  currentTimelineGuideY = snappedY;
  canvas.style.setProperty('--place-guide-y', `${snappedY}px`);
  canvas.dataset.guideLabel = formatTimeFromMin(absMin);
  if (timelinePlacementGuideEl) {
    timelinePlacementGuideEl.style.top = `${snappedY}px`;
    timelinePlacementGuideEl.dataset.time = formatTimeFromMin(absMin);
  }
}

/* Every canvas, not the first one — with three columns on screen, clearing only
   `querySelector`'s first hit left a guide line hanging on the other two. */
function clearPlacementGuide() {
  currentTimelineGuideY = null;
  document.querySelectorAll('#timeline .tl-canvas').forEach(canvas => {
    canvas.classList.remove('placing');
    canvas.style.removeProperty('--place-guide-y');
    canvas.dataset.guideLabel = '';
  });
}

/* setDayFocusPane / applyDayLandscapeFocusState / dayLandscapeFocusPane lived
   here, dimming one pane of the day screen while the other was in use. Before
   them, leftPaneManualCollapsed / applyLeftPaneState / toggleLeftPane hid the
   left "Today" rail. Both existed to manage a multi-pane screen. There is one
   pane now — the schedule — so there is nothing to focus and nothing to dim. */

/* updateDayLandscapeChromeHeight lived here, with its two window listeners. It
   measured the day screen's chrome into --day-landscape-chrome, which the three
   rails each subtracted from the viewport to work out their own max-height —
   the arithmetic that let three panes scroll independently. There is one
   scroller now and it simply fills what is left, so there is nothing to
   measure. */


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
  /* The 5-minute floor belongs on the FITTED duration too. It only guarded the
     requested one, so a start at the very end of the day trimmed to
     END_MIN - startMin === 0 and saved a zero-minute block — which then drew at
     the 22px minimum with "0m" beside it. Callers that snap now clamp as well
     (canvasSnapMin), but placeBlock is the one every path goes through. */
  const fitDur = Math.max(5, Math.min(reqDur, END_MIN - startMin));
  if (fitDur < reqDur) showToast('✂️ Trimmed to fit the day');
  durationMin = fitDur;
  const block = {
    id, actId, startMin, durationMin,
    createdAt: syncNow(), updatedAt: syncNow(), // so cross-device merges order correctly
    colour,
    objectives: objectives||[],
    note: note||'',
    tag: opts.tag||null,
    // Which meet this is. blockDisplayName is the one place it becomes a label.
    compName: (opts.compName || '').trim().slice(0, 40) || null,
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
    /* THE SERIES REMEMBERS WHAT IT IS. The days, the frequency and the two dates
       were read off the form, used once to decide where to drop blocks, and
       thrown away — so nothing afterwards could say what the repeat was, and
       the edit sheet could only count siblings. They are stamped on every block
       of the series now, which is what lets seriesSpecText read it back and
       seriesExtendTo change its mind later. */
    const seriesId = 'sr-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    const ranged = !!(opts.repeatDateStart || opts.repeatDateEnd);
    block.seriesId    = seriesId;
    block.seriesDays  = [...new Set(opts.repeatDays)].sort((a, b) => a - b);
    block.seriesEvery = ranged ? seriesEveryWeeks(opts.repeatEvery) : 1;
    if (opts.repeatDateStart) block.seriesStart = opts.repeatDateStart;
    if (opts.repeatDateEnd)   block.seriesEnd   = opts.repeatDateEnd;
    setDayBlocks(currentDayKey, blocks); // re-save to persist the series on the original

    /* With no dates the caller means this week only, which is what a kid gets
       by default and what the hint under the picker promises. With either date
       set it is a real span, and seriesDayKeys (js/05-helpers.js) owns which
       days that covers — including the every-N-weeks phase and the horizon cap. */
    const targets = ranged
      ? seriesDayKeys({
          days: block.seriesDays, everyWeeks: block.seriesEvery, anchorKey: currentDayKey,
          startKey: opts.repeatDateStart || null, endKey: opts.repeatDateEnd || null,
        })
      : block.seriesDays.map(i => getDayKeys(weekOffset)[i]).filter(Boolean);

    targets.forEach(targetKey => {
      if (targetKey === currentDayKey) return;        // already placed
      const db = getDayBlocks(targetKey);
      if (db.some(b => b.seriesId === seriesId)) return;  // never twice on one day
      db.push(Object.assign({}, block, {
        id: Date.now().toString(36)+Math.random().toString(36).slice(2,5),
        checklistState: {}, confirmed: false,
      }));
      setDayBlocks(targetKey, db);
    });
    saveAll();
  }

  checkLevelUp(actId);

  buildTimeline();
  selectedActivity = null;
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

