// Weekly-Planner — week view: full/compact week render, time grid, week glance & wins.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   WEEK VIEW
════════════════════════════════════════════════════════════════ */
function setWeekView(v) {
  weekView = v;
  // Tab active state
  document.getElementById('viewTabFull').classList.toggle('active', v==='full');
  document.getElementById('viewTabTimeGrid').classList.toggle('active', v==='timegrid');
  // Containers
  document.getElementById('weekCompact').style.display  = v==='compact' ? 'block' : 'none';
  document.getElementById('weekFull').style.display     = v==='full' ? 'flex' : 'none';
  document.getElementById('weekTimeGrid').style.display = v==='timegrid' ? 'block' : 'none';
  renderWeek();
}
function changeWeek(d) { weekOffset += d; renderWeek(); }

/* ── Kid's weekly signature: a commitment "I'll follow my plan" sign-off,
   shown on the weekly view and carried onto the printed sheet. Stored per
   week per profile so each kid signs their own plan. ── */
function weekSignatureKey(keys) { return keys && keys[0] ? keys[0] : getDayKeys(weekOffset)[0]; }
function getWeekSignature(keys, p=activeProfile()) {
  const sigs = getProfData(p)?.weekSignatures;
  return (sigs && sigs[weekSignatureKey(keys)]) || null;
}
function renderWeekSignature(keys) {
  const bar = document.getElementById('weekSignatureBar');
  if (!bar) return;
  const p = activeProfile();
  const name = p==='jenn' ? 'Jenn' : 'Jess';
  const sig = getWeekSignature(keys, p);
  if (sig) {
    const when = new Date(sig.signedAt);
    const dateStr = `${MONTH_SHORT[when.getMonth()]} ${when.getDate()}`;
    bar.innerHTML = `
      <div class="wk-sig-line">
        <span class="wk-sig-label">✍️ Signed by</span>
        <span class="wk-sig-name">${escapeHtml(sig.name || name)}</span>
        <span class="wk-sig-date">on ${dateStr}</span>
      </div>
      <button type="button" class="wk-sig-btn wk-sig-btn--clear" onclick="clearWeekSignature()">Unsign</button>`;
  } else {
    bar.innerHTML = `
      <div class="wk-sig-line wk-sig-line--empty">
        <span class="wk-sig-label">✍️ ${name}, sign your week</span>
        <span class="wk-sig-blank"></span>
      </div>
      <button type="button" class="wk-sig-btn" onclick="signWeek()">Sign this week ✍️</button>`;
  }
}
async function signWeek() {
  const keys = getDayKeys(weekOffset);
  const p = activeProfile();
  const defName = p==='jenn' ? 'Jenn' : 'Jess';
  const entered = await showPrompt('Sign your week ✍️ — write your name:', { value: defName });
  if (entered == null) return;                 // cancelled
  const name = String(entered).trim() || defName;
  const pd = getProfData(p);
  if (!pd.weekSignatures) pd.weekSignatures = {};
  pd.weekSignatures[weekSignatureKey(keys)] = { name, signedAt: Date.now() };
  saveAll();
  renderWeekSignature(keys);
  showToast(`✍️ ${name} signed this week!`);
}
function clearWeekSignature() {
  const keys = getDayKeys(weekOffset);
  const pd = getProfData(activeProfile());
  if (pd.weekSignatures) { delete pd.weekSignatures[weekSignatureKey(keys)]; saveAll(); }
  renderWeekSignature(keys);
}

function renderWeek() {
  // parent banner
  const parentBanner = document.getElementById('parentBannerWeek');
  if (isParent()) {
    parentBanner.style.display = 'block';
    document.getElementById('parentViewingName').textContent = parentViewing==='jenn'?'🐥 Jenn':'🦊 Jess';
  } else {
    parentBanner.style.display = 'none';
  }

  const p = activeProfile();
  document.getElementById('weekProfileBadge').textContent =
    isParent() ? (parentViewing==='jenn'?'🐥 Jenn':'🦊 Jess')+' (P)' :
    (p==='jenn'?'🐥 Jenn':'🦊 Jess');

  const keys = getDayKeys(weekOffset);
  const mon = formatDayKey(keys[0]);
  const sun = formatDayKey(keys[6]);
  document.getElementById('weekRangeLabel').textContent =
    `${MONTH_SHORT[mon.getMonth()]} ${mon.getDate()} — ${MONTH_SHORT[sun.getMonth()]} ${sun.getDate()}`;

  if (weekView === 'compact')      renderCompactWeek(keys);
  else if (weekView === 'timegrid') renderTimeGrid(keys);
  else                              renderFullWeek(keys);

  // Analytics (category legend) only visible to parents
  const legend = document.getElementById('weekLegend');
  if (legend) legend.style.display = isParent() ? 'flex' : 'none';

  // Money button: parents open Bank & Invest, kids open "How I earn".
  const moneyBtn = document.getElementById('weekMoneyBtn');
  if (moneyBtn) {
    const parent = isParent();
    moneyBtn.innerHTML = parent
      ? '<span aria-hidden="true">🏦</span><span class="btn-icon__label">Bank</span>'
      : '<span aria-hidden="true">💰</span><span class="btn-icon__label">How I earn</span>';
    moneyBtn.title = parent ? 'Bank & Invest' : 'How I earn pocket money';
    moneyBtn.setAttribute('aria-label', moneyBtn.title);
  }

  renderGoalsTodos();
  renderWeekGlance(keys);
  renderWeekSignature(keys);

  const coachEl = document.getElementById('weekCoachTip');
  if (coachEl) {
    // Use the app's timezone (America/Edmonton) rather than the device clock so
    // the Sunday nudge lands on the same day boundary as all the week/day keys.
    const isSunday = formatDayKey(toDayKeyInZone(new Date())).getDay() === 0;
    if (isSunday && weekOffset === 0 && !weekReviewDismissed) {
      // Sunday weekly-review nudge: a gentle look-back with a mini summary,
      // shown to parent and child alike so they can reflect together.
      const t = computeWeekTotals(keys);
      const learn = fmtHrsMin(t.catMin.school || 0);
      const active = fmtHrsMin((t.catMin.active || 0) + (t.catMin.training || 0));
      const free = fmtHrsMin(t.free);
      coachEl.classList.add('week-review-tip');
      coachEl.style.display = 'block';
      coachEl.innerHTML = `🗓️ <b>Sunday review</b> — this week: 📚 ${learn} learning · 🏃 ${active} active · 🌤 ${free} free. Look back together, then tweak one thing for next week. <button class="wins-btn" onclick="openWeeklyWins()">🎉 See wins</button> <button class="tip-dismiss" aria-label="Dismiss" onclick="dismissWeekReview()">✕</button>`;
    } else if (!isParent()) {
      coachEl.classList.remove('week-review-tip');
      coachEl.style.display = 'block';
      coachEl.textContent = '🌟 Tip: Tap a day card to see your timeline. Check off routines as you go — each tick is a small win. Use “My free time” in Time-Grid to spot when you can choose rest or a goal.';
    } else {
      coachEl.style.display = 'none';
    }
  }
}

// Weekly time-per-category totals over the app's 6am–10pm window (shared by
// the Sunday review nudge). Free = window minutes not scheduled. Counts the
// full entered duration up to END_MIN so charts reflect what was planned (W6).
function computeWeekTotals(keys) {
  const acts = getAllActivities();
  const catMin = {};
  let planned = 0;
  keys.forEach(k => {
    (getDayBlocks(k) || []).forEach(b => {
      const s = Math.max(b.startMin, START_MIN);
      const e = Math.min(b.startMin + (b.durationMin || 0), END_MIN);
      const m = e - s;
      if (m <= 0) return;
      const act = acts.find(a => a.id === b.actId);
      const cat = act ? act.cat : 'custom';
      catMin[cat] = (catMin[cat] || 0) + m;
      planned += m;
    });
  });
  return { catMin, planned, free: Math.max(0, DAY_MIN_SPAN * 7 - planned) };
}

// "This week at a glance" panel on the week view: category/free-time totals,
// an age-based sleep recommendation, and the week's notes & objectives.
function onWeekAgeChange() {
  const v = (document.getElementById('weekAge')?.value || '').trim();
  const age = v === '' ? null : Math.max(1, Math.min(18, parseInt(v, 10) || 0));
  const pd = getProfData();
  if (pd) { pd.age = age; saveAll(); }
  renderWeekGlance(getDayKeys(weekOffset));
}

function renderWeekGlance(keys) {
  const body = document.getElementById('weekGlanceBody');
  if (!body) return;
  const ageInput = document.getElementById('weekAge');
  const age = getProfData()?.age;
  if (ageInput && document.activeElement !== ageInput) {
    ageInput.value = (age != null && !isNaN(age)) ? age : '';
  }

  const acts = getAllActivities();
  const CAT_LABELS = {
    sleep:'😴 Rest', school:'📚 Learning', active:'🏃 Active',
    free:'🎮 Free', daily:'🍽 Daily', training:'🏋️ Competitive Sports',
    competition:'🏆 Competition', routine:'📋 Routine', custom:'✨ Custom'
  };
  const t = computeWeekTotals(keys);

  const order = ['school','active','training','competition','routine','daily','free','sleep','custom'];
  let chips = '';
  order.forEach(cat => {
    if (!t.catMin[cat]) return;
    chips += `<span class="glance-chip"><span class="glance-dot" style="background:${CAT_HEX[cat]||'#999'}"></span>${CAT_LABELS[cat]||cat}: <b>${fmtHrsMin(t.catMin[cat])}</b></span>`;
  });
  chips += `<span class="glance-chip"><span class="glance-dot" style="background:#fff;border:1px solid #999"></span>🌤 Unscheduled: <b>${fmtHrsMin(t.free)}</b></span>`;

  const sleep = recommendedSleep(age);
  let sleepHtml;
  if (sleep) {
    const perWeek = sleep.min * 7;
    sleepHtml = `<div class="glance-sleep">💤 <b>Recommended sleep (age ${age}, ${sleep.group}):</b> ${sleep.min}–${sleep.max}h per night · aim for ~${perWeek}h across the week</div>`;
  } else {
    sleepHtml = `<div class="glance-sleep glance-sleep--muted">💤 Set the age above to see the recommended sleep for this age group.</div>`;
  }

  // Notes & objectives across the week.
  const notes = [];
  keys.forEach((k, i) => {
    (getDayBlocks(k) || []).forEach(b => {
      const act = acts.find(a => a.id === b.actId);
      if (b.note) notes.push(`<b>${DAY_SHORT[i]}</b> · ${act?.icon||''} ${escapeHtml(act?.name||'')}: ${escapeHtml(b.note)}`);
      if (b.objectives?.length) notes.push(`<b>${DAY_SHORT[i]}</b> · ${act?.icon||''} ${escapeHtml(act?.name||'')}: 🎯 ${escapeHtml(b.objectives.join(', '))}`);
    });
  });
  const notesHtml = notes.length
    ? `<div class="glance-notes"><div class="glance-notes-title">📝 Notes &amp; objectives</div>${notes.map(n=>`<div class="glance-note">${n}</div>`).join('')}</div>`
    : '';

  body.innerHTML = `
    <div class="glance-window">Totals over the 6am–10pm window (${fmtHrsMin(DAY_MIN_SPAN)}/day).</div>
    <div class="glance-chips">${chips}</div>
    ${sleepHtml}
    ${notesHtml}
  `;
}

// #6 Weekly wins recap — a celebratory look at what actually got done.
function computeWeekWins(keys) {
  const acts = getAllActivities();
  let done = 0, total = 0;
  const byCat = {};
  keys.forEach(k => {
    (getDayBlocks(k) || []).forEach(b => {
      if (b.startMin == null) return;
      total++;
      if (b.completed) {
        done++;
        const act = acts.find(a => a.id === b.actId);
        const cat = act ? act.cat : 'custom';
        byCat[cat] = (byCat[cat] || 0) + 1;
      }
    });
  });
  const kid = isParent() ? parentViewing : activeProfile();
  const pd = getProfData(kid);
  const topStreak = Math.max(0, ...Object.values((pd && pd.progress && pd.progress.streaks) || {}).map(s => s.count || 0));
  const stickers = ((pd && pd.progress && pd.progress.stickers) || []).length;
  const money = (kid === 'jenn' || kid === 'jess') ? ctWeekMoney(ctWeekKeyForDate(keys[0]), kid) : 0;
  return { done, total, byCat, topStreak, stickers, money };
}
function openWeeklyWins() {
  const keys = getDayKeys(weekOffset);
  const w = computeWeekWins(keys);
  const CAT_LABELS = { school:'📚 Learning', active:'🏃 Active', free:'🎮 Free', daily:'🍽 Daily', routine:'📋 Routines', training:'🏋️ Competitive Sports', competition:'🏆 Competition', sleep:'😴 Rest', custom:'✨ Other' };
  const pct = w.total ? Math.round(w.done / w.total * 100) : 0;
  const cheer = pct >= 80 ? 'Incredible week! 🌟' : pct >= 50 ? 'Great effort this week! 💪' : w.done > 0 ? 'Every finished task counts 💛' : 'A fresh week ahead — you’ve got this!';
  const catLines = Object.keys(w.byCat).sort((a,b)=>w.byCat[b]-w.byCat[a])
    .map(c => `<span class="wins-chip">${CAT_LABELS[c]||c}: <b>${w.byCat[c]}</b></span>`).join('');
  const body = document.getElementById('weeklyWinsBody');
  if (body) {
    body.innerHTML = `
      <div class="wins-hero">${cheer}</div>
      <div class="wins-stat-row">
        <div class="wins-stat"><div class="wins-num">${w.done}</div><div class="wins-lbl">tasks done</div></div>
        <div class="wins-stat"><div class="wins-num">${pct}%</div><div class="wins-lbl">of planned</div></div>
        <div class="wins-stat"><div class="wins-num">${w.topStreak}</div><div class="wins-lbl">day streak</div></div>
      </div>
      <div class="wins-stat-row">
        ${(activeProfile()==='jenn'||activeProfile()==='jess'||isParent()) ? `<div class="wins-stat"><div class="wins-num">$${(w.money||0).toFixed(2)}</div><div class="wins-lbl">earned</div></div>` : ''}
        <div class="wins-stat"><div class="wins-num">${w.stickers}</div><div class="wins-lbl">stickers</div></div>
      </div>
      ${catLines ? `<div class="wins-cats">${catLines}</div>` : ''}
    `;
  }
  openSheet('weeklyWinsOverlay');
}

let weekReviewDismissed = false;
function dismissWeekReview() {
  weekReviewDismissed = true;
  const el = document.getElementById('weekCoachTip');
  if (el) el.style.display = 'none';
}

// Evening wind-down reminder derived from the child's age (default 7am wake).
function bedtimeReminderText(age) {
  const s = recommendedSleep(age);
  if (!s) return null;
  const targetH = Math.round((s.min + s.max) / 2);
  let bed = 7 * 60 - targetH * 60;
  if (bed < 0) bed += 24 * 60;
  return `💤 Wind-down soon — age ${age} does best with ~${targetH}h sleep (lights-out around ${formatTimeFromMin(bed)} for a 7 am wake).`;
}

/* ════════════════════════════════════════════════════════════════
   TIME-GRID ENHANCEMENTS
   - categorizeBlock: classify a block into sleep-meal / learning / free
   - getBrickStrip: 30 bricks per day (15-min slots, 6 AM–9 PM)
   - calculateLongestFreeStretch: longest contiguous free run across the week
   - renderTimeGrid: grid + brick strips + summary
   ════════════════════════════════════════════════════════════════ */

/* Time-grid color mode: 'inverted' (default, free=bright) or 'classic' (cat colors) */
// 2a: default to quiet-free — planned blocks carry their saturated category
// colour, free time stays plain paper so an empty week reads as empty. The
// toggle still flips to the older "free-time bright" (inverted) mode.
let tgColorMode = 'classic';

/* Activity IDs that count as Learning/Training (per locked plan) */
const TG_LEARNING_IDS = ['school_day', 'french', 'chinese', 'math', 'piano', 'training', 'competition'];
/* Daily meals that count as Sleep/Meal */
const TG_MEAL_IDS = ['breakfast', 'lunch', 'dinner'];

/**
 * Categorize a block into one of: 'sleep-meal' | 'learning' | 'free'.
 * Per the plan:
 *   sleep-meal = meals (breakfast/lunch/dinner). Sleep itself is outside 6a–9p so doesn't appear in the grid.
 *   learning   = school_day, french, chinese, math, piano, training, OR any block with travelBuffer:true
 *   free       = everything else (active, free, routine, custom, daily-non-meal)
 */
function categorizeBlock(block, act) {
  if (!act) return 'free';
  if (block && block.travelBuffer) return 'learning';
  if (TG_LEARNING_IDS.includes(act.id)) return 'learning';
  if (TG_MEAL_IDS.includes(act.id)) return 'sleep-meal';
  return 'free';
}

/**
 * Returns one brick per 30 minutes across the whole waking window. With the
 * day now running 6 AM–10 PM (DAY_MIN_SPAN = 960) that's 32 bricks, so the
 * late-evening hour is no longer dropped (W8).
 * Brick categories: 'sleep-meal' | 'learning' | 'free' (gap counts as free per plan).
 */
const BRICK_COUNT = Math.round(DAY_MIN_SPAN / 30);
function getBrickStrip(key) {
  const blocks = getDayBlocks(key);
  const acts = getAllActivities(activeProfile());
  const bricks = [];
  for (let i = 0; i < BRICK_COUNT; i++) {
    const slotStart = START_MIN + i * 30;
    const slotEnd   = slotStart + 30;
    // Find the block that occupies this slot. If multiple overlap, pick the
    // one with the smallest "free-ness" (sleep-meal/learning beats free) so
    // a 30-min lunch inside a long school block is still attributed to learning.
    const overlaps = blocks.filter(b => b.startMin < slotEnd && (b.startMin + b.durationMin) > slotStart);
    if (overlaps.length === 0) {
      bricks.push({ category: 'free', block: null, act: null });
    } else {
      // Pick the block whose START is closest to (or inside) this slot — gives
      // the visually-dominant block for this 30-min window.
      let best = overlaps[0];
      for (const b of overlaps) {
        if (b.startMin >= slotStart && b.startMin < slotEnd) { best = b; break; }
      }
      const act = acts.find(a => a.id === best.actId);
      bricks.push({ category: categorizeBlock(best, act), block: best, act });
    }
  }
  return bricks;
}

function tgFreeBrickClass() {
  const p = activeProfile();
  return p === 'jess' ? 'tg-brick-free-jess' : 'tg-brick-free-jenn';
}
function tgFreeCellClass() {
  const p = activeProfile();
  return p === 'jess' ? 'tg-free-jess' : 'tg-free-jenn';
}

/**
 * Find the longest contiguous run of 'free' bricks across the whole week.
 * Returns { minutes, dayKey, dayIdx, startMin } or null if no free time.
 */
function calculateLongestFreeStretch(keys) {
  let best = null;
  keys.forEach((key, dayIdx) => {
    const bricks = getBrickStrip(key);
    let runStart = -1;
    for (let i = 0; i <= bricks.length; i++) {
      const isFree = i < bricks.length && bricks[i].category === 'free';
      if (isFree && runStart === -1) runStart = i;
      if ((!isFree || i === bricks.length) && runStart !== -1) {
        const runLen = i - runStart;
        const minutes = runLen * 30;
        if (!best || minutes > best.minutes) {
          best = { minutes, dayKey: key, dayIdx, startMin: START_MIN + runStart * 30 };
        }
        runStart = -1;
      }
    }
  });
  return best;
}

function formatStretchLabel(stretch) {
  if (!stretch || !stretch.minutes) return null;
  const h = Math.floor(stretch.minutes / 60);
  const m = stretch.minutes % 60;
  let timeStr = '';
  if (h > 0 && m > 0) timeStr = `${h}h ${m}m`;
  else if (h > 0)     timeStr = `${h} hour${h>1?'s':''}`;
  else                timeStr = `${m}m`;
  // Day-of-week + part of day (morning/afternoon/evening based on startMin)
  const startHour = Math.floor(stretch.startMin / 60);
  let part = 'morning';
  if (startHour >= 12 && startHour < 17) part = 'afternoon';
  else if (startHour >= 17) part = 'evening';
  return `${timeStr} (${DAY_LONG[stretch.dayIdx]} ${part})`;
}

/* Time-Grid: 7-column hour grid that visualizes free time. */
/* Short label for the 2a Day-Blocks view — a Skating block reads "Skate", French
   reads "FR", the morning routine reads "AM", etc. Kept compact so a block only a
   few pixels tall still says something useful. */
function tg2ShortLabel(act, b) {
  if (!act) return '';
  if (act.isRoutine) {
    if (act.routineId === 'morning') return 'AM';
    if (act.routineId === 'afterschool') return 'PM';
    if (act.routineId === 'evening') return 'Eve';
    return 'Routine';
  }
  if (act.isTraining) {
    const t = getTrainingTopic(b.tag);
    if (act.isCompetition) return t.id === 'general' ? 'Comp' : (t.name.slice(0, 4) + '🏆');
    return ({ skating: 'Skate', swimming: 'Swim', dryland: 'Dry', general: 'Train' })[t.id] || 'Train';
  }
  const idMap = {
    school_day: 'School', french: 'FR', chinese: 'CN', math: 'Math', piano: 'Piano',
    chores: 'Chores', breakfast: '🍳', lunch: '🥗', dinner: '🍽', relax: 'Relax',
    break_quick: 'Break', family: 'Family',
  };
  if (idMap[act.id]) return idMap[act.id];
  const w = (act.name || '').split(/\s+/)[0];
  return w.length > 7 ? w.slice(0, 7) : w;
}

/* 2a "Day Blocks": one column per day, planned activities carry colour + a short
   label, free time is plain lined paper. Conflicts get the same red flag as the
   Full week and the print sheet so the three views agree. */
function renderTimeGrid(keys) {
  const grid = document.getElementById('tgGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const acts = getAllActivities(activeProfile());
  const today = todayKey();

  const PX_PER_MIN = 0.5;
  const totalH = Math.round(DAY_MIN_SPAN * PX_PER_MIN);
  const firstHour = Math.ceil(START_MIN / 60);
  const lastHour  = Math.floor((START_MIN + DAY_MIN_SPAN) / 60);

  // ── Header row: corner + 7 day headers ──
  const corner = document.createElement('div');
  corner.className = 'tg2-corner';
  grid.appendChild(corner);
  keys.forEach((key, i) => {
    const d = formatDayKey(key);
    const head = document.createElement('div');
    head.className = 'tg2-head' + (key === today ? ' today' : '');
    head.innerHTML = `${DAY_SHORT[i]}<small>${d.getDate()}</small>`;
    head.onclick = () => openDay(key, i);
    grid.appendChild(head);
  });

  // ── Body row: time gutter + 7 lanes ──
  const gutter = document.createElement('div');
  gutter.className = 'tg2-gutter';
  gutter.style.height = totalH + 'px';
  for (let h = firstHour; h <= lastHour; h++) {
    const rel = h * 60 - START_MIN;
    if (rel < 0 || rel > DAY_MIN_SPAN) continue;
    const lbl = document.createElement('div');
    lbl.className = 'tg2-gutter-hour';
    lbl.style.top = (rel * PX_PER_MIN) + 'px';
    lbl.textContent = `${((h + 11) % 12) + 1}${h >= 12 ? 'p' : 'a'}`;
    gutter.appendChild(lbl);
  }
  grid.appendChild(gutter);

  keys.forEach((key, dayIdx) => {
    const lane = document.createElement('div');
    lane.className = 'tg2-lane' + (key === today ? ' today' : '');
    lane.style.height = totalH + 'px';
    lane.onclick = () => openDay(key, dayIdx);

    const blocks = (getDayBlocks(key) || []).slice().sort((a, b) => a.startMin - b.startMin);
    const conflicts = computeBufferConflicts(blocks);
    const cols = wfAssignColumns(blocks);

    blocks.forEach(b => {
      const act = acts.find(a => a.id === b.actId);
      if (!act) return;
      const topic = act.isTraining ? getTrainingTopic(b.tag) : null;
      const bg = topic ? trainingBlockColour(b) : (b.colour || CAT_HEX[act.cat] || '#95d5b2');
      const relStart = Math.max(0, b.startMin - START_MIN);
      const relEnd = Math.min(DAY_MIN_SPAN, b.startMin - START_MIN + (b.durationMin || 0));
      if (relEnd - relStart < 1) return;
      const el = document.createElement('div');
      const hasConflict = conflicts.affected.has(b.id);
      el.className = 'tg2-block' + (isLightColour(bg) ? ' light-bg' : '')
        + (b.completed ? ' tg2-block--done' : '') + (hasConflict ? ' tg2-block--conflict' : '');
      el.style.top = (relStart * PX_PER_MIN) + 'px';
      el.style.height = Math.max(11, (relEnd - relStart) * PX_PER_MIN - 1) + 'px';
      el.style.background = bg;
      // Column-pack overlapping blocks so they sit side-by-side, not stacked.
      const slot = cols.get(b.id) || { col: 0, count: 1 };
      const cc = slot.count || 1;
      if (cc > 1) {
        el.style.left = `calc(${(slot.col * 100 / cc)}% + 1px)`;
        el.style.right = 'auto';
        el.style.width = `calc(${100 / cc}% - 3px)`;
      }
      const icon = topic ? topic.icon : act.icon;
      const flag = hasConflict ? `<div class="tg2-block-flag" title="Time clash — not enough travel/get-ready time">!</div>` : '';
      el.innerHTML = `${flag}${icon}<span class="tg2-block-lbl">${escapeHtml(tg2ShortLabel(act, b))}</span>`;
      el.title = `${icon} ${topic ? topic.name : act.name} — ${formatTimeFromMin(b.startMin)}, ${formatDuration(b.durationMin)}`
        + (hasConflict ? ' · ⚠️ overlaps another activity' : '');
      el.onclick = (e) => { e.stopPropagation(); openDay(key, dayIdx, b.id); };
      lane.appendChild(el);
    });

    grid.appendChild(lane);
  });

  // Week-level clash banner (shared with the Full view), plus the streak + legend.
  renderWeekConflictBanner(keys, 'tgConflictBanner');
  renderTimeGridStreak(keys);
  const legend = document.getElementById('tgLegend');
  if (legend) {
    legend.style.display = 'flex';
    legend.innerHTML = [
      ['school', '📚 Learning'], ['training', '🏋️ Competitive Sports'],
      ['routine', '📋 Routine'], ['active', '🏃 Active'], ['daily', '🍽 Daily'],
    ].map(([cat, label]) =>
      `<span class="tg-legend-chip"><span class="tg-legend-dot" style="background:${CAT_HEX[cat] || '#999'}"></span>${label}</span>`
    ).join('') + `<span class="tg-legend-chip"><span class="tg-legend-dot tg-legend-dot--free"></span>Free — plain paper</span>`;
  }
}

/* Render the streak banner above the grid */
function renderTimeGridStreak(keys) {
  const el = document.getElementById('tgStreak');
  if (!el) return;
  const stretch = calculateLongestFreeStretch(keys);
  const label = formatStretchLabel(stretch);
  if (!label) {
    el.innerHTML = '<span class="star">✨</span> No free time this week yet';
    return;
  }
  el.innerHTML = `<span class="star">🌟</span> Longest free stretch: <strong>${label}</strong>`;
}

/* Render the weekly overview: 7 days × 30 bricks each (compact, glanceable) */
function renderTimeGridWeekOverview(keys) {
  const wrap = document.getElementById('tgWeekOverview');
  if (!wrap) return;
  wrap.innerHTML = '';
  const today = todayKey();
  const freeCls = tgFreeBrickClass();

  // Spacer in first column to align with grid
  const spacer = document.createElement('div');
  spacer.className = 'tg-wo-label';
  spacer.textContent = '';
  wrap.appendChild(spacer);

  keys.forEach((key, i) => {
    const d = formatDayKey(key);
    const dayEl = document.createElement('div');
    dayEl.className = 'tg-wo-day' + (key === today ? ' today' : '');
    dayEl.onclick = () => openDay(key, i);

    const lbl = document.createElement('div');
    lbl.className = 'tg-wo-daylabel';
    lbl.textContent = `${DAY_SHORT[i]} ${d.getDate()}`;
    dayEl.appendChild(lbl);

    const bricksWrap = document.createElement('div');
    bricksWrap.className = 'tg-wo-bricks';
    const bricks = getBrickStrip(key);
    bricks.forEach(b => {
      const brk = document.createElement('div');
      let cls = 'tg-wo-brick ';
      if (b.category === 'sleep-meal')    cls += 'tg-brick-sleep-meal';
      else if (b.category === 'learning') cls += 'tg-brick-learning';
      else                                cls += freeCls;
      brk.className = cls;
      bricksWrap.appendChild(brk);
    });
    dayEl.appendChild(bricksWrap);

    const count = bricks.filter(b => b.category === 'free').length;
    const cnt = document.createElement('div');
    cnt.className = 'tg-wo-count';
    cnt.textContent = `${count}/30 free`;
    dayEl.appendChild(cnt);

    wrap.appendChild(dayEl);
  });
}

/* Render TODAY's MY FREE TIME panel (kid view only) */
function renderTimeGridMyTime(keys) {
  const panel = document.getElementById('tgMyTime');
  if (!panel) return;
  // Hide for parent (weekly totals will live in parent analytics later)
  if (isParent()) { panel.style.display = 'none'; return; }

  const today = todayKey();
  const todayIdx = keys.indexOf(today);
  const targetKey = todayIdx >= 0 ? today : keys[0];
  const targetIdx = keys.indexOf(targetKey);
  const td = formatDayKey(targetKey);
  const dateStr = `${DAY_SHORT[targetIdx >= 0 ? targetIdx : 0]}, ${MONTH_SHORT[td.getMonth()]} ${td.getDate()}`;
  const dayLabel = (targetKey === today) ? `${dateStr} · Today` : `${dateStr} (this week)`;

  const bricks = getBrickStrip(targetKey);
  const freeCount = bricks.filter(b => b.category === 'free').length;
  const learnCount = bricks.filter(b => b.category === 'learning').length;
  const mealCount = bricks.filter(b => b.category === 'sleep-meal').length;
  const freeMin = freeCount * 30;
  const fh = Math.floor(freeMin / 60), fm = freeMin % 60;
  const valueStr = fh > 0 ? (fm > 0 ? `${fh}h ${fm}m` : `${fh}h`) : `${fm}m`;

  panel.style.display = 'block';
  panel.dataset.profile = activeProfile();
  panel.classList.toggle('tg-mytime--today', targetKey === today);
  document.querySelector('#tgMyTime .tg-mytime-label').innerHTML = `🌟 MY FREE TIME<br><span style="font-size:0.95rem;font-family:'Patrick Hand',sans-serif;font-weight:700">${dayLabel}</span>`;
  document.getElementById('tgMyTimeValue').textContent = valueStr;

  // Mini brick strip showing today's bricks across the full 6am–10pm window
  const bricksEl = document.getElementById('tgMyTimeBricks');
  bricksEl.innerHTML = '';
  bricksEl.style.gridTemplateColumns = `repeat(${bricks.length}, 1fr)`;
  const freeCls = tgFreeBrickClass();
  bricks.forEach(b => {
    const brk = document.createElement('div');
    let cls = 'tg-mytime-brick ';
    if (b.category === 'sleep-meal')    cls += 'tg-brick-sleep-meal';
    else if (b.category === 'learning') cls += 'tg-brick-learning';
    else                                cls += freeCls;
    brk.className = cls;
    bricksEl.appendChild(brk);
  });

  // Breakdown line
  const parts = [];
  if (freeCount > 0)  parts.push(`${freeCount} free`);
  if (learnCount > 0) parts.push(`${learnCount} learning`);
  if (mealCount > 0)  parts.push(`${mealCount} meals`);
  document.getElementById('tgMyTimeBreakdown').textContent = parts.length ? parts.join(' · ') + ' (30-min blocks)' : 'Nothing planned yet — your whole day is free!';
}

function renderCompactWeek(keys) {
  const grid = document.getElementById('weekGrid');
  grid.innerHTML = '';
  const today = todayKey();

  keys.forEach((key, i)=>{
    const blocks = getDayBlocks(key);
    const card = document.createElement('div');
    card.className = 'day-card'+(key===today?' today':'');
    card.onclick = ()=>openDay(key, i);
    const d = formatDayKey(key);
    card.innerHTML = `
      <div class="day-label">${DAY_SHORT[i]}</div>
      <div class="day-date">${d.getDate()}</div>
      <div class="day-bar-wrap" id="daybar-${key}"></div>
      <div class="day-mood" id="daymood-${key}"></div>
      <div class="day-pct" id="daypct-${key}"></div>
    `;
    grid.appendChild(card);
    renderDayBar(key, blocks);
  });
}

function renderDayBar(key, blocks) {
  const wrap = document.getElementById('daybar-'+key);
  const pctEl = document.getElementById('daypct-'+key);
  const moodEl = document.getElementById('daymood-'+key);
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!blocks.length) { pctEl.textContent=''; moodEl.textContent=''; return; }

  const filled = new Set();
  blocks.forEach(b=>{
    const startSlot = Math.floor((b.startMin - START_MIN)/15);
    const endSlot = Math.ceil((b.startMin - START_MIN + b.durationMin)/15);
    for(let s=startSlot;s<endSlot;s++) filled.add(s);
  });
  const pct = Math.round(filled.size / TOTAL_SLOTS * 100);
  pctEl.textContent = pct+'%';

  const dayMood = getProfData().dayMoods?.[key];
  moodEl.textContent = dayMood || '';

  const catMap = {};
  const acts = getAllActivities();
  blocks.forEach(b=>{
    const act = acts.find(a=>a.id===b.actId);
    if(!act) return;
    const cat = act.cat;
    catMap[cat] = (catMap[cat]||0) + (b.durationMin/15);
  });
  // Category breakdown visible only in Parent Mode — kids just see completion %
  if (isParent()) {
    Object.entries(catMap).forEach(([cat, slots])=>{
      const seg = document.createElement('div');
      seg.className = 'day-bar-seg';
      seg.style.height = Math.max(4, Math.round(slots/TOTAL_SLOTS*70))+'px';
      seg.style.background = CAT_COLOUR[cat]||'var(--cat-free)';
      wrap.appendChild(seg);
    });
  } else {
    // Kid view: single soft completion bar (no category judgment)
    const seg = document.createElement('div');
    seg.className = 'day-bar-seg';
    seg.style.height = Math.max(6, Math.round(pct/100*70))+'px';
    seg.style.background = 'var(--accent-yellow)';
    wrap.appendChild(seg);
  }
}

/* Buffer segments for a block, stacked so get-ready/travel/warm-up never occupy
   the same minutes: before the block you get ready FIRST, then travel (drive),
   then warm up right at the venue, then the activity; after it you travel home,
   then put the gear away. Warm-up is one-sided — you don't warm up on the way
   home. Returns segments with startRel (minutes from START_MIN), dur, icon,
   min — time order. Getting skate boots ready can't happen while driving, so
   the buffers are laid end-to-end, not stacked on the same slot. */
function wfBufferSegments(b) {
  const travelMin = getTravelBufMin(b);
  const readyMin  = getGetReadyBufMin(b);
  const warmupMin = getWarmupBufMin(b);
  const relStart = b.startMin - START_MIN;
  const dur = Math.max(5, b.durationMin || 0);
  const relEnd = relStart + dur;
  const segs = [];
  // Before: [get-ready][travel][warm-up][ACTIVITY]
  if (warmupMin > 0) segs.push({ startRel: relStart - warmupMin, dur: warmupMin, icon: '🔥', min: warmupMin, kind: 'warmup', side: 'pre' });
  if (travelMin > 0) segs.push({ startRel: relStart - warmupMin - travelMin, dur: travelMin, icon: '🚗', min: travelMin, kind: 'travel', side: 'pre' });
  if (readyMin  > 0) segs.push({ startRel: relStart - warmupMin - travelMin - readyMin, dur: readyMin, icon: '👕', min: readyMin, kind: 'ready', side: 'pre' });
  // After: [ACTIVITY][travel][get-ready]
  if (travelMin > 0) segs.push({ startRel: relEnd, dur: travelMin, icon: '🚗', min: travelMin, kind: 'travel', side: 'post' });
  if (readyMin  > 0) segs.push({ startRel: relEnd + travelMin, dur: readyMin, icon: '👕', min: readyMin, kind: 'ready', side: 'post' });
  return segs;
}

/* Distinguish a tap from a scroll/drag so a large block (like Training) that
   fills the timeline doesn't open its editor every time the user tries to
   scroll past it. If the pointer moves beyond a small threshold — or the
   browser cancels the pointer to start scrolling — the following click is
   treated as a scroll gesture and ignored. */
function attachTapGuard(el, onTap) {
  let sx = 0, sy = 0, moved = false;
  el.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; moved = false; }, { passive: true });
  el.addEventListener('pointermove', (e) => {
    if (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) moved = true;
  }, { passive: true });
  el.addEventListener('pointercancel', () => { moved = true; }, { passive: true });
  el.onclick = (e) => {
    e.stopPropagation();
    if (moved) { moved = false; return; }
    onTap(e);
  };
}

function renderFullWeek(keys) {
  const grid = document.getElementById('weeklyFullGrid');
  grid.innerHTML = '';
  const acts = getAllActivities();

  // ── Week-level conflict summary banner (shown above the grid) ──
  renderWeekConflictBanner(keys);

  // Continuous single-column-per-day timeline (matches the Day view): each
  // activity is ONE unbroken block positioned by its real start time on a
  // shared px-per-minute scale, so nothing is ever sliced at a band boundary.
  const PX_PER_MIN = 0.72;
  const totalH = Math.round(DAY_MIN_SPAN * PX_PER_MIN);

  // Time-of-day tint bands + slot labels. Boundaries match the day view's
  // sideband (buildSideband): 6–9am / 9am–3pm / 3–6pm / 6pm–end. `side` is the
  // compact label used on the left axis band.
  const WEEKDAY_BANDS = [
    { start: 0,   end: 180,          cls: 'wf-band-before',  label: '🌅 Before School', side: '🌅 Before' },
    { start: 180, end: 540,          cls: 'wf-band-school',  label: '🏫 School',        side: '🏫 School' },
    { start: 540, end: 720,          cls: 'wf-band-after',   label: '🎒 After School',  side: '🎒 After'  },
    { start: 720, end: DAY_MIN_SPAN, cls: 'wf-band-evening', label: '🌙 Evening',       side: '🌙 Evening' },
  ];
  const WEEKEND_BANDS = [ { start: 0, end: DAY_MIN_SPAN, cls: 'wf-band-free', label: '🎉 Free Time' } ];

  // ── Header row: sideband corner + gutter corner + 7 day headers ──
  const bandCorner = document.createElement('div');
  bandCorner.className = 'wf-corner';
  grid.appendChild(bandCorner);
  const corner = document.createElement('div');
  corner.className = 'wf-corner';
  grid.appendChild(corner);
  keys.forEach((key, ci)=>{
    const d = formatDayKey(key);
    const header = document.createElement('div');
    header.className = 'wf-day-header' + (key===todayKey() ? ' today' : '');
    header.innerHTML = `<div class="wf-col-dow">${DAY_SHORT[ci]}</div><div class="wf-col-date">${d.getDate()}</div>`;
    header.onclick = ()=>openDay(key, ci);
    grid.appendChild(header);
  });

  const firstHour = Math.ceil(START_MIN / 60);
  const lastHour  = Math.floor((START_MIN + DAY_MIN_SPAN) / 60);

  // ── Left sideband: the day view's time-of-day axis for the whole week ──
  const sideband = document.createElement('div');
  sideband.className = 'wf-sideband';
  sideband.style.height = totalH + 'px';
  WEEKDAY_BANDS.forEach(bd => {
    const seg = document.createElement('div');
    seg.className = 'wf-sideband-seg ' + bd.cls;
    seg.style.top = (bd.start * PX_PER_MIN + 1) + 'px';
    seg.style.height = ((bd.end - bd.start) * PX_PER_MIN - 3) + 'px';
    seg.textContent = bd.side;
    seg.title = bd.label;
    sideband.appendChild(seg);
  });
  grid.appendChild(sideband);

  // ── Slim gutter with hour labels down the side ──
  const gutter = document.createElement('div');
  gutter.className = 'wf-gutter';
  gutter.style.height = totalH + 'px';
  for (let h = firstHour; h <= lastHour; h++) {
    const rel = h*60 - START_MIN;
    if (rel < 0 || rel > DAY_MIN_SPAN) continue;
    const lbl = document.createElement('div');
    lbl.className = 'wf-gutter-hour';
    lbl.style.top = (rel * PX_PER_MIN) + 'px';
    lbl.textContent = `${((h+11)%12)+1}${h>=12?'p':'a'}`;
    gutter.appendChild(lbl);
  }
  grid.appendChild(gutter);

  // ── One continuous lane per day ──
  keys.forEach((key, ci) => {
    const dow = formatDayKey(key).getDay();
    const bands = (dow===0 || dow===6) ? WEEKEND_BANDS : WEEKDAY_BANDS;

    const cell = document.createElement('div');
    cell.className = 'wf-day-col' + (key===todayKey() ? ' today' : '');
    cell.style.height = totalH + 'px';
    cell.onclick = (e)=>{
      // Only open the day when the empty lane (not a card) is tapped.
      if (e.target === cell || e.target.classList.contains('wf-band') || e.target.classList.contains('wf-hour-line')) {
        openDay(key, ci);
      }
    };

    // Zone tint bands behind everything. Weekday band names live on the left
    // sideband axis; weekend columns keep their own "Free Time" label since
    // the axis shows the school-day rhythm.
    const isWeekendCol = (dow === 0 || dow === 6);
    bands.forEach(bd => {
      const seg = document.createElement('div');
      seg.className = 'wf-band ' + bd.cls;
      seg.style.top = (bd.start * PX_PER_MIN) + 'px';
      seg.style.height = ((bd.end - bd.start) * PX_PER_MIN) + 'px';
      cell.appendChild(seg);
      if (isWeekendCol && bd.label && (bd.end - bd.start) * PX_PER_MIN >= 24) {
        const lbl = document.createElement('div');
        lbl.className = 'wf-band-label';
        lbl.style.top = (bd.start * PX_PER_MIN + 2) + 'px';
        lbl.textContent = bd.label;
        cell.appendChild(lbl);
      }
    });

    // Hour gridlines to anchor the eye to the time grid.
    for (let h = firstHour; h <= lastHour; h++) {
      const rel = h*60 - START_MIN;
      if (rel <= 0 || rel >= DAY_MIN_SPAN) continue;
      const line = document.createElement('div');
      line.className = 'wf-hour-line';
      line.style.top = (rel * PX_PER_MIN) + 'px';
      cell.appendChild(line);
    }

    // "Now" marker on today's column.
    if (key === todayKey()) {
      const now = new Date();
      const nowMin = now.getHours()*60 + now.getMinutes() - START_MIN;
      if (nowMin > 0 && nowMin < DAY_MIN_SPAN) {
        const nl = document.createElement('div');
        nl.className = 'wf-now-line';
        nl.style.top = (nowMin * PX_PER_MIN) + 'px';
        cell.appendChild(nl);
      }
    }

    const blocks = (getDayBlocks(key) || []).slice().sort((a,b)=>a.startMin - b.startMin);
    const cols = wfAssignColumns(blocks);
    const bufferConflicts = computeBufferConflicts(blocks);

    // Travel / get-ready strips (underneath cards), stacked so getting ready and
    // driving never share the same minutes. Coloured to match the activity
    // they belong to, and flagged red when they'd overlap another activity —
    // i.e. there isn't actually enough time to travel/get ready.
    blocks.forEach(b => {
      const act = acts.find(a=>a.id===b.actId);
      const topic = act && act.isTraining ? getTrainingTopic(b.tag) : null;
      const segColour = topic ? trainingBlockColour(b) : (b.colour || (act && CAT_HEX[act.cat]) || '#888');
      const bc = bufferConflicts.perBlock.get(b.id);
      // Match the buffer strip to its own block's column, so a get-ready/drive
      // strip sits directly under (and the same width as) the card it belongs to
      // instead of spanning the whole day column.
      const slot = cols.get(b.id) || { col: 0, count: 1 };
      const colCount = slot.count || 1;
      const gap = 3;
      const leftCss  = 'calc(' + (slot.col * 100 / colCount) + '% + 1px)';
      const widthCss = 'calc(' + (100 / colCount) + '% - ' + (gap + 2) + 'px)';
      wfBufferSegments(b).forEach(seg => {
        const segS = Math.max(seg.startRel, 0);
        const segE = Math.min(seg.startRel + seg.dur, DAY_MIN_SPAN);
        if (segE - segS < 2) return;
        const topPx = segS * PX_PER_MIN;
        const hPx = (segE - segS) * PX_PER_MIN;
        const segConflict = !!bc && (seg.side === 'pre' ? bc.pre : bc.post);
        cell.appendChild(wfTravelStrip(topPx, hPx, leftCss, widthCss, seg.icon, seg.min, segColour, segConflict));
      });
    });

    // Activity cards — one unbroken block each.
    blocks.forEach(b=>{
      const act = acts.find(a=>a.id===b.actId);
      if (!act) return;
      const startMinOfDay = b.startMin;
      const hr = Math.floor(startMinOfDay/60);
      const min = startMinOfDay % 60;
      const timeStr = `${hr>12?hr-12:hr}:${String(min).padStart(2,'0')}${hr>=12?'p':'a'}`;

      const relStart = b.startMin - START_MIN;
      const dur = Math.max(5, b.durationMin || 0);
      const topPx = relStart * PX_PER_MIN;
      const pxHeight = Math.max(dur * PX_PER_MIN, 16);

      // Training topics carry their own icon + colour (skating/swimming/dryland).
      const topic = act.isTraining ? getTrainingTopic(b.tag) : null;
      const bg = topic ? trainingBlockColour(b) : (b.colour || CAT_HEX[act.cat] || '#888');
      const dispIcon = topic ? topic.icon : act.icon;
      // Competition shares the sport topic's icon/colour, but reads as its own
      // task (a general competition says "Competition", a sport one says e.g.
      // "Swimming 🏆") so it never looks like a plain Training block.
      const dispName = topic
        ? (act.isCompetition ? (topic.id === 'general' ? 'Competition 🏆' : topic.name + ' 🏆') : topic.name)
        : act.name;
      const card = document.createElement('div');
      let cls = 'wf-card' + (isLightColour(bg) ? ' light-bg' : '');
      if (pxHeight >= 60) cls += ' wf-card--tall'; // room to stack time/icon/name centered
      if (pxHeight < 34) cls += ' wf-card--slim';
      if (pxHeight < 22) cls += ' wf-card--xslim';
      if (pxHeight < 16) cls += ' wf-card--icononly'; // too short for a name → icon only
      if (b.completed) cls += ' wf-card--done';
      const hasConflict = bufferConflicts.affected.has(b.id);
      if (hasConflict) cls += ' wf-card--conflict';
      card.className = cls;

      const slot = cols.get(b.id) || { col: 0, count: 1 };
      const colCount = slot.count || 1;
      const gap = 3; // px between overlapping columns
      const leftCss  = 'calc(' + (slot.col * 100 / colCount) + '% + 1px)';
      const widthCss = 'calc(' + (100 / colCount) + '% - ' + (gap + 2) + 'px)';

      const travelMin = getTravelBufMin(b);
      const readyMin  = getGetReadyBufMin(b);
      const bufBefore = travelMin + readyMin;

      card.style.top = topPx + 'px';
      card.style.height = Math.max(pxHeight - 2, 12) + 'px';
      card.style.left  = leftCss;
      card.style.width = widthCss;
      card.style.background = bg;
      const travelTag = bufBefore > 0 ? `<span class="wf-card-travel">${travelMin ? '🚗' : '👕'}${bufBefore}m</span>` : '';
      const stampEmoji = b.parentStamp && b.parentStamp.emoji ? b.parentStamp.emoji + ' ' : '';
      const conflictTag = hasConflict ? `<span class="wf-card-conflict-badge" title="Not enough travel/get-ready time — overlaps another activity">⚠️</span>` : '';
      // Corner flag stays visible on every card size (the inline badge is hidden
      // when a card is too slim for its name), so a clash never hides off-screen.
      const conflictFlag = hasConflict ? `<div class="wf-card-conflict-flag" title="Time clash — not enough travel/get-ready time">!</div>` : '';
      card.innerHTML = `
        ${conflictFlag}
        <div class="wf-card-time">${timeStr}</div>
        <div class="wf-card-icon">${dispIcon}</div>
        <div class="wf-card-name">${stampEmoji}${dispName}${travelTag}${conflictTag}</div>
        <div class="wf-card-dur">${formatDuration(b.durationMin)}</div>
        <button type="button" class="wf-card-check" aria-label="${b.completed?'Mark not done':'Mark done'}"
          onclick="toggleBlockDone('${key}','${b.id}',event)">${b.completed?'✓':''}</button>
      `;
      card.title = `${dispIcon} ${dispName} — ${timeStr}, ${formatDuration(b.durationMin)}`
        + (bufBefore > 0 ? ` · ${travelMin ? '🚗 travel' : '👕 get-ready'} ${bufBefore} min each way` : '')
        + (hasConflict ? ' · ⚠️ overlaps another activity — not enough time' : '');
      attachTapGuard(card, ()=> openDayFromWeekCard(key, ci, b.id));
      cell.appendChild(card);
    });

    grid.appendChild(cell);
  });
}

/* Scan the whole week for buffer/time clashes and surface a plain-language
   banner so a conflict is obvious the moment the week opens — no hovering, no
   hunting for a red outline. Each day that clashes names the activities that
   don't leave enough travel/get-ready time. */
function renderWeekConflictBanner(keys, bannerId = 'weekConflictBanner') {
  const banner = document.getElementById(bannerId);
  if (!banner) return;
  const acts = getAllActivities();
  const dayLines = [];
  keys.forEach((key, i) => {
    const blocks = (getDayBlocks(key) || []).slice();
    const conflicts = computeBufferConflicts(blocks);
    if (!conflicts.affected.size) return;
    const names = [];
    blocks.forEach(b => {
      if (!conflicts.affected.has(b.id)) return;
      const act = acts.find(a => a.id === b.actId);
      const topic = act && act.isTraining ? getTrainingTopic(b.tag) : null;
      const nm = act ? (topic ? topic.name : act.name) : 'Activity';
      if (!names.includes(nm)) names.push(nm);
    });
    dayLines.push(`${DAY_SHORT[i]}: ${names.join(' ⇆ ')}`);
  });
  if (!dayLines.length) { banner.style.display = 'none'; banner.innerHTML = ''; return; }
  const n = dayLines.length;
  banner.style.display = 'flex';
  banner.innerHTML =
    `<span class="wcb-icon">⚠️</span>`
    + `<span>${n} time ${n === 1 ? 'clash' : 'clashes'} this week — not enough travel/get-ready time`
    + `<span class="wcb-detail"><br>${dayLines.map(escapeHtml).join(' · ')}</span></span>`;
}

/* Build one travel/get-ready buffer strip for the weekly view. Positioned in
   px within the zone cell, hugging the card it belongs to. Non-interactive so
   taps fall through to the card/cell underneath. */
function wfTravelStrip(topPx, hPx, leftCss, widthCss, icon, min, colour, conflict) {
  const s = document.createElement('div');
  s.className = 'wf-travel' + (hPx >= 14 ? ' wf-travel--label' : '') + (conflict ? ' wf-travel--conflict' : '');
  s.style.top = topPx + 'px';
  s.style.height = hPx + 'px';
  s.style.left = leftCss;
  s.style.width = widthCss;
  if (colour && !conflict) s.style.setProperty('--wf-travel-colour', colour);
  if (hPx >= 14) s.textContent = `${conflict ? '⚠️' : icon}${min}m`;
  s.title = (conflict ? '⚠️ Overlaps another activity — not enough time. ' : '') + `Travel / get-ready — ${min} min`;
  return s;
}

/* Assign overlapping blocks to columns (greedy) so time-positioned cards
   never sit on top of each other. Returns a Map of id -> {col, count} where
   count is the column count of that block's own overlap group. */
function wfAssignColumns(blocks) {
  const map = new Map();
  const sorted = blocks.slice().sort((a,b)=> (a.startMin - b.startMin) || (a.durationMin - b.durationMin));
  // Group runs of mutually-overlapping blocks, then column-pack each group.
  let group = [];
  let groupEnd = -Infinity;
  const flush = ()=>{
    if (!group.length) return;
    const colEnds = []; // running end time per column
    group.forEach(b=>{
      const bStart = b.startMin;
      const bEnd = b.startMin + (b.durationMin || 0);
      let colIdx = colEnds.findIndex(end => end <= bStart);
      if (colIdx === -1) { colIdx = colEnds.length; colEnds.push(bEnd); }
      else { colEnds[colIdx] = bEnd; }
      map.set(b.id, { col: colIdx });
    });
    const count = colEnds.length;
    group.forEach(b=> { map.get(b.id).count = count; });
    group = [];
    groupEnd = -Infinity;
  };
  sorted.forEach(b=>{
    const bStart = b.startMin;
    const bEnd = b.startMin + (b.durationMin || 0);
    if (bStart >= groupEnd && group.length) flush();
    group.push(b);
    groupEnd = Math.max(groupEnd, bEnd);
  });
  flush();
  return map;
}

