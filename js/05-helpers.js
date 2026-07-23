// Weekly-Planner — profile data accessors, rewards, tutorial, day/week keys, navigation.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════ */
function getProfData(p=activeProfile()) {
  if (!state.profiles[p]) state.profiles[p] = { weeks:{}, customActivities:[], dayMoods:{}, blockMoods:{}, activityCounts:{}, activityHours:{} };
  const prof = state.profiles[p];
  if (!prof.progress) {
    prof.progress = {
      tutorialDone: false,
      tutorialStarterActId: null,
      unlockedActs: [],
      pendingRewards: [],
      streaks: {},
      manualPlacedCount: 0,
      streakFreezeTokens: 1,
      streakFreezeWeek: dateToLocalKey(getWeekStart(weekOffset)),
      unlockedThisWeek: {},
    };
  }
  if (!Array.isArray(prof.progress.unlockedActs)) prof.progress.unlockedActs = [];
  if (!Array.isArray(prof.progress.pendingRewards)) prof.progress.pendingRewards = [];
  if (!prof.progress.unlockedChecklistItems) prof.progress.unlockedChecklistItems = {};
  if (!prof.progress.streaks) prof.progress.streaks = {};
  if (!prof.progress.unlockedThisWeek) prof.progress.unlockedThisWeek = {};
  if (!prof.progress.unlockedChecklistItems) prof.progress.unlockedChecklistItems = {};
  if (prof.progress.manualPlacedCount == null) prof.progress.manualPlacedCount = 0;
  if (!Array.isArray(prof.progress.stickers)) prof.progress.stickers = [];      // unlocked collectible ids
  if (prof.progress.tasksCompleted == null) prof.progress.tasksCompleted = 0;   // lifetime completions
  if (!prof.progress.completedByCat) prof.progress.completedByCat = {};         // per-category completions
  if (prof.progress.streakFreezeTokens == null) prof.progress.streakFreezeTokens = 1;
  if (!prof.progress.restDays) prof.progress.restDays = {};                     // {[dayKey]:true} — kid-marked days off
  if (!prof.progress.streakFreezeWeek) prof.progress.streakFreezeWeek = dateToLocalKey(getWeekStart(weekOffset));
  const wk = dateToLocalKey(getWeekStart(weekOffset));
  if (prof.progress.streakFreezeWeek !== wk) {
    prof.progress.streakFreezeWeek = wk;
    prof.progress.streakFreezeTokens = 1;
    prof.progress.unlockedThisWeek = {};
  }
  return state.profiles[p];
}
function getDayBlocks(key, p=activeProfile()) { return getProfData(p).weeks[key] || []; }
function setDayBlocks(key, blocks, p=activeProfile()) {
  if (!getProfData(p).weeks) getProfData(p).weeks = {};
  getProfData(p).weeks[key] = blocks;
  saveAll();
}
function getCustomActivities(p=activeProfile()) { return getProfData(p).customActivities || []; }
function getSharedActivities() { return (state.shared && state.shared.sharedActivities) || []; }

function getAllActivities(p=activeProfile()) {
  const season = getCurrentSeason();
  const base = [
    ...DEFAULT_ACTIVITIES,
    ...getCustomActivities(p),
    ...getSharedActivities(),
    ...SEASONAL_ACTIVITIES.map(a=>({...a,_seasonal:true, _locked: a.season!==season})),
  ];
  // apply level-ups
  const rules = state.shared.levelRules || [];
  const profd = getProfData(p);
  const progress = getProfData(p).progress || {};
  const unlockedSet = new Set(progress.unlockedActs || []);
  const starter = progress.tutorialStarterActId;
  return base.map(act => {
    if (act.rewardLocked) {
      const unlocked = unlockedSet.has(act.id) || (starter && starter === act.id);
      act = { ...act, _rewardLocked: !unlocked, _locked: !unlocked };
    }
    const rule = rules.find(r => r.activityId===act.id);
    if (!rule) return act;
    const cur = rule.type==='count' ? (profd.activityCounts?.[act.id]||0) : (profd.activityHours?.[act.id]||0);
    if (cur >= rule.target) {
      return { ...act, name: rule.name||act.name, icon: rule.newIcon||act.icon, _levelled:true };
    }
    return act;
  });
}

function getUnlockedRoutineRewards(routineId, p=activeProfile()) {
  const pr = getProfData(p).progress || {};
  const map = pr.unlockedChecklistItems || {};
  return map[routineId] || [];
}

function queueReward(actId, reason) {
  const p = getProfData();
  const pr = p.progress;
  if (!actId) return;
  const existsPending = (pr.pendingRewards || []).some(r=>r.actId===actId);
  if (existsPending || (pr.unlockedActs||[]).includes(actId)) return;
  pr.pendingRewards.push({ id:'rw-'+Date.now().toString(36)+Math.random().toString(36).slice(2,4), actId, reason: reason||'progress' });
}

function queueChecklistReward(routineId, item, reason) {
  const p = getProfData();
  const pr = p.progress;
  if (!routineId || !item || !item.id) return;
  const key = `${routineId}:${item.id}`;
  const hasPending = (pr.pendingRewards || []).some(r => r.type==='checklist' && `${r.routineId}:${r.item?.id}` === key);
  const unlocked = ((pr.unlockedChecklistItems[routineId] || []).some(x=>x.id===item.id));
  if (hasPending || unlocked) return;
  pr.pendingRewards.push({
    id:'rw-'+Date.now().toString(36)+Math.random().toString(36).slice(2,4),
    type:'checklist',
    routineId,
    item: { ...item },
    reason: reason || 'progress',
  });
}

function unlockRewardAct(actId) {
  const p = getProfData();
  const pr = p.progress;
  if (!actId) return false;
  if (!pr.unlockedActs.includes(actId)) {
    pr.unlockedActs.push(actId);
    return true;
  }
  return false;
}

function pickLockedReward(poolKey, excludeIds=[]) {
  const p = getProfData();
  const pr = p.progress;
  const unlocked = new Set(pr.unlockedActs || []);
  const exclude = new Set(excludeIds || []);
  const pool = REWARD_POOLS[poolKey] || [];
  const act = pool.find(a => !unlocked.has(a.id) && !exclude.has(a.id));
  return act ? act.id : null;
}

function enqueueMilestoneRewards() {
  const p = getProfData();
  const pr = p.progress;
  const n = pr.manualPlacedCount || 0;
  const milestones = [10,15,20];
  milestones.forEach(m=>{
    const key = `manual-${m}`;
    if (n >= m && !pr.unlockedThisWeek[key]) {
      const cycle = m===10 ? ['family','academic'] : (m===15 ? ['health'] : ['culture']);
      let queued = false;
      cycle.forEach(k=>{
        const id = pickLockedReward(k);
        if (id && !queued) {
          queueReward(id, `Placed ${m} blocks`);
          queued = true;
        }
      });
      if (queued) pr.unlockedThisWeek[key] = true;
    }
  });
}

function maybeShowRewardPrompt() {
  if (isParent()) return;
  const p = getProfData();
  const pr = p.progress;
  const box = document.getElementById('dayRewardPrompt');
  const txt = document.getElementById('dayRewardText');
  if (!box || !txt) return;
  if (!pr.pendingRewards.length) {
    box.style.display = 'none';
    window._currentRewardPrompt = null;
    return;
  }
  const first = pr.pendingRewards[0];
  window._currentRewardPrompt = first;
  if (first.type === 'checklist') {
    txt.textContent = `Reward unlocked: ${first.item.text} (${first.reason})`;
  } else {
    const act = DEFAULT_ACTIVITIES.find(a=>a.id===first.actId) || Object.values(REWARD_POOLS).flat().find(a=>a.id===first.actId);
    if (!act) {
      pr.pendingRewards.shift();
      saveAll();
      maybeShowRewardPrompt();
      return;
    }
    txt.textContent = `Reward unlocked: ${act.icon} ${act.name} (${first.reason})`;
  }
  box.style.display = 'flex';
}

function acceptRewardPrompt() {
  const p = getProfData();
  const pr = p.progress;
  const rw = window._currentRewardPrompt;
  if (!rw) return;
  if (rw.type === 'checklist') {
    if (!pr.unlockedChecklistItems[rw.routineId]) pr.unlockedChecklistItems[rw.routineId] = [];
    if (!pr.unlockedChecklistItems[rw.routineId].some(x=>x.id===rw.item.id)) {
      pr.unlockedChecklistItems[rw.routineId].push({ ...rw.item });
      showToast(`Unlocked checklist reward ✨`);
    }
  } else if (rw.actId) {
    const changed = unlockRewardAct(rw.actId);
    if (changed) {
      const act = DEFAULT_ACTIVITIES.find(a=>a.id===rw.actId) || Object.values(REWARD_POOLS).flat().find(a=>a.id===rw.actId);
      showToast(`Unlocked: ${act?.name || 'New reward'} ✨`);
    }
  }
  pr.pendingRewards = pr.pendingRewards.filter(x=>x.id!==rw.id);
  saveAll();
  buildTray();
  maybeShowRewardPrompt();
}

function skipRewardPrompt() {
  const p = getProfData();
  const pr = p.progress;
  const rw = window._currentRewardPrompt;
  if (!rw) return;
  pr.pendingRewards = pr.pendingRewards.filter(x=>x.id!==rw.id);
  pr.pendingRewards.push(rw);
  saveAll();
  showToast('No problem — you can choose it later 💫');
  maybeShowRewardPrompt();
}

function openTutorial() {
  const wrap = document.getElementById('tutorialChoices');
  if (!wrap) return;
  wrap.innerHTML = '';
  const p = getProfData();
  const progress = p.progress;
  TUTORIAL_STARTER_CHOICES.forEach(act=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pill-btn tutorial-choice-btn';
    btn.textContent = `${act.icon} ${act.name} (${formatDuration(act.durationMin)})`;
    btn.onclick = ()=>chooseTutorialStarter(act.id);
    wrap.appendChild(btn);
  });
  if (progress.tutorialStarterActId) {
    const note = document.createElement('p');
    note.className = 'tutorial-overlay-note';
    note.textContent = 'You already picked a starter. You can keep building your Family Hero streak!';
    wrap.appendChild(note);
  }
  openSheet('tutorialOverlay');
}

function chooseTutorialStarter(actId) {
  const p = getProfData();
  const pr = p.progress;
  pr.tutorialDone = true;
  pr.tutorialStarterActId = actId;
  unlockRewardAct(actId);
  closeSheet('tutorialOverlay');
  saveAll();
  buildTray();
  const act = getAllActivities().find(a=>a.id===actId);
  if (act) {
    selectActivity(act);
    showToast(`Starter unlocked: ${act.name} — tap timeline to place it ✅`);
  }
}

function skipTutorial() {
  closeSheet('tutorialOverlay');
  showToast('Tutorial skipped — you can open it later from day view');
}

function offerTutorialIfNeeded() {
  // Family Hero onboarding is opt-in. Kids reach the starter chooser by
  // tapping a locked Family Hero chip in the tray (see selectActivity),
  // not via a pop-up that blocks the first day they try to plan.
}

/* ── Rest days: a kid can mark a day as "off". Rest days are celebrated (rest is
   part of the plan) and never count against a streak — the gap logic below
   subtracts them so a planned day off doesn't break the streak. ── */
function isRestDay(dayKey, kid = activeProfile()) {
  const pd = getProfData(kid);
  return !!(pd && pd.progress && pd.progress.restDays && pd.progress.restDays[dayKey]);
}
function toggleRestDay(dayKey) {
  const pd = getProfData();
  if (!pd.progress.restDays) pd.progress.restDays = {};
  const on = !pd.progress.restDays[dayKey];
  if (on) pd.progress.restDays[dayKey] = true;
  else delete pd.progress.restDays[dayKey];
  saveAll();
  showToast(on ? 'Rest day set — rest is part of the plan 💛' : 'Rest day removed');
  if (typeof buildTimeline === 'function') buildTimeline();
  refreshRestDayButton();
}
// Reflect the current day's rest state on the day-view toggle button.
function refreshRestDayButton() {
  const btn = document.getElementById('restDayBtn');
  if (!btn || !currentDayKey) return;
  const on = isRestDay(currentDayKey);
  btn.classList.toggle('on', on);
  btn.textContent = on ? '😌 Today is a rest day — tap to undo' : '😌 Mark today a rest day';
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}
// Count kid-marked rest days strictly between two day keys (exclusive both ends).
function countRestDaysBetween(fromKey, toKey, kid = activeProfile()) {
  let n = 0;
  const d = formatDayKey(fromKey);
  const end = formatDayKey(toKey);
  d.setDate(d.getDate() + 1);
  while (d < end) {
    if (isRestDay(dateToLocalKey(d), kid)) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

function markRoutineProgressOnChecklistToggle(block, act, prevDone, nextDone, total) {
  if (!act?.isRoutine || !total) return;
  if (prevDone >= total || nextDone < total) return;
  const p = getProfData();
  const pr = p.progress;
  const rid = act.routineId;
  if (!rid) return;
  if (!pr.streaks[rid]) pr.streaks[rid] = { count: 0, lastDay: null };
  const st = pr.streaks[rid];
  const today = currentDayKey;
  if (st.lastDay === today) return;
  if (!st.lastDay) st.count = 1;
  else {
    const rawGap = Math.round((formatDayKey(today) - formatDayKey(st.lastDay)) / (24*60*60*1000));
    // Planned rest days between the two active days don't count against the
    // streak, so a kid who marks a day off keeps their progress.
    const gapDays = rawGap - countRestDaysBetween(st.lastDay, today);
    if (gapDays <= 1) st.count += 1;
    else if (gapDays === 2) {
      // Forgiving streak: one missed day is always forgiven, so a single
      // off-day never wipes out the child's progress.
      st.count += 1;
      showToast('Grace day — your streak is safe 💛');
    }
    else if (gapDays > 2 && pr.streakFreezeTokens > 0) {
      pr.streakFreezeTokens -= 1;
      st.count += 1;
      showToast('Streak freeze used — nice recovery ⭐');
    } else st.count = 1;
  }
  st.lastDay = today;
  if (rid === 'morning' && st.count >= 5) {
    queueChecklistReward('morning', MORNING_LOCKED_REWARD, '5-day morning streak');
  }
  if (rid === 'afterschool' && st.count >= 10) {
    const unlocked = p.progress.unlockedChecklistItems.afterschool || [];
    const pendingIds = (p.progress.pendingRewards || [])
      .filter(r=>r.type==='checklist' && r.routineId==='afterschool')
      .map(r=>r.item?.id);
    const next = AFTERSCHOOL_CHECKLIST_REWARDS.find(it => !unlocked.some(u=>u.id===it.id) && !pendingIds.includes(it.id));
    if (next) queueChecklistReward('afterschool', next, '10-day after-school streak');
  }
  // Award chore point from routine completion
  ctAwardMandatoryFromRoutine(rid, activeProfile(), today);
  saveAll();
  maybeShowRewardPrompt();
}

const CT_ROUTINE_SESSION_MAP = { morning: 'Morning', afterschool: 'Afternoon', evening: 'Evening' };

function ctAwardMandatoryFromRoutine(routineId, kid, dayKey) {
  const session = CT_ROUTINE_SESSION_MAP[routineId];
  if (!session) return;
  const wk = ctWeekKeyForDate(dayKey);
  const mon = formatDayKey(wk);
  const day = formatDayKey(dayKey);
  const dayIdx = Math.round((day - mon) / (24*60*60*1000));
  if (dayIdx < 0 || dayIdx > 6) return;
  const p = getProfData(kid);
  ctEnsureProfile(p);
  // Sticky: once tracked, don't unset even if routine is later unchecked.
  // Routines are mandatory + tracked (heatmap/streaks/goal points) but pay NO money —
  // money now comes only from completing priced chore groups.
  if (ctGetMandatory(wk, dayIdx, session, kid)) return;
  ctSetMandatory(wk, dayIdx, session, kid, true);
  ctSetMandatoryAuto(wk, dayIdx, session, kid);
  ctMaybeFireGoalBonus(wk, kid);
  showToast(`✅ ${session} routine complete`);
}

function getRoutineChecklistWithUnlocks(routineId) {
  const tmpl = getRoutineTemplate(routineId);
  const base = (tmpl?.items || []).slice();
  const p = getProfData();
  const unlocked = (p.progress && p.progress.unlockedChecklistItems && p.progress.unlockedChecklistItems[routineId]) || [];
  return [...base, ...unlocked];
}

/* Track celebration toasts so we do not spam on every re-render */
const routineCompleteToasted = new Set();
const stopwatchGoalToasted = new Set();

function blocksOverlap(aStart, aDur, bStart, bDur) {
  const aEnd = aStart + aDur;
  const bEnd = bStart + bDur;
  return aStart < bEnd && bStart < aEnd;
}

/** Next gap of at least minGap minutes inside [START_MIN, END_MIN), or null */
function findNextGapForBreak(dayKey, minGap, fromMinAbs) {
  const blocks = getDayBlocks(dayKey).filter(b => b && b.startMin != null && b.durationMin != null);
  const startSearch = Math.max(START_MIN, Math.min(END_MIN - minGap, fromMinAbs));
  for (let t = startSearch; t <= END_MIN - minGap; t += 5) {
    const ok = !blocks.some(b => blocksOverlap(t, minGap, b.startMin, b.durationMin));
    if (ok) return t;
  }
  return null;
}

function addQuickBreak(durationMin) {
  if (isParent()) {
    showToast('Switch to your profile to add a break 👤');
    return;
  }
  const now = new Date();
  const nowAbs = now.getHours() * 60 + now.getMinutes();
  let start = findNextGapForBreak(currentDayKey, durationMin, nowAbs);
  if (start == null) {
    start = findNextGapForBreak(currentDayKey, durationMin, START_MIN);
  }
  if (start == null) {
    showToast('No empty slot big enough — try editing the day 📋');
    return;
  }
  const act = getAllActivities().find(a => a.id === 'break_quick');
  const colour = act ? (CAT_HEX[act.cat] || '#95d5b2') : '#95d5b2';
  placeBlock('break_quick', start, durationMin, colour, [], 'Quick break', { travelBuffer: false });
  showToast(`Break added at ${formatTimeFromMin(start)} ✨`);
}

function renderDayNextUpBanner() {
  const el = document.getElementById('dayNextUpBanner');
  const row = document.getElementById('dayKidQuickRow');
  if (!el || !row) return;
  if (isParent()) {
    el.style.display = 'none';
    row.style.display = 'none';
    return;
  }
  row.style.display = 'flex';
  const blocks = getDayBlocks(currentDayKey);
  const acts = getAllActivities();
  const now = new Date();
  const nowAbs = now.getHours() * 60 + now.getMinutes();
  const isToday = currentDayKey === todayKey();

  // "Current" and "Next up" are live, clock-relative concepts — they only
  // make sense for today. On any other day the banner stays empty (item 5).
  if (!isToday) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const scheduled = blocks.map(b => {
    const act = acts.find(a => a.id === b.actId);
    if (!act || act.quickBreak) return null;
    return { b, act, end: b.startMin + b.durationMin };
  }).filter(Boolean).sort((a, b) => a.b.startMin - b.b.startMin);

  // Happening right now: started but not yet finished.
  const current = scheduled.find(c => c.b.startMin <= nowAbs && c.end > nowAbs) || null;
  // Up next: the first block that hasn't started yet.
  const next = scheduled.find(c => c.b.startMin > nowAbs) || null;

  // Evening wind-down nudge (once age is set).
  const evening = now.getHours() >= 18;
  const age = getProfData()?.age;
  const bedtime = (evening && age != null) ? bedtimeReminderText(age) : null;

  if (!current && !next && !bedtime) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  el.style.display = 'block';
  let inner = '';
  if (current) {
    const timeStr = formatTimeFromMin(current.b.startMin);
    inner += `<div class="next-up-row next-up-row--now"><div class="next-up-label">Now</div>`
      + `<div class="next-up-body">${current.act.icon} <b>${escapeHtml(current.act.name)}</b> · ${timeStr}</div></div>`;
  }
  if (next) {
    const timeStr = formatTimeFromMin(next.b.startMin);
    inner += `<div class="next-up-row"><div class="next-up-label">Next up</div>`
      + `<div class="next-up-body">${next.act.icon} <b>${escapeHtml(next.act.name)}</b> · ${timeStr}</div></div>`;
  }
  if (bedtime) inner += `<div class="bedtime-tip">${bedtime}</div>`;
  el.innerHTML = inner;
}

function updateStopwatchGoalToasts(blocks) {
  blocks.forEach(b => {
    const sw = b.stopwatch;
    if (!sw || !sw.enabled || !sw.running) {
      stopwatchGoalToasted.delete(b.id);
      return;
    }
    const goal = sw.goalSec != null ? sw.goalSec : Math.max(60, (b.durationMin | 0) * 60);
    const used = stopwatchDisplayElapsed(sw);
    if (used >= goal) {
      if (!stopwatchGoalToasted.has(b.id)) {
        stopwatchGoalToasted.add(b.id);
        showToast('🎉 You hit your stopwatch goal — amazing!');
      }
    } else {
      stopwatchGoalToasted.delete(b.id);
    }
  });
}

function getSisterVisibilityState() {
  const mode = (state.shared && state.shared.sisterVisibilityMode) || 'public';
  const hideDetails = mode === 'busy-only';
  return { mode, hideDetails };
}

/* Week utils */
const APP_TIMEZONE = 'America/Edmonton';
function toDayKeyInZone(date, timeZone = APP_TIMEZONE) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date);
}
function dateToLocalKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function getWeekStart(offset=0) {
  const now = formatDayKey(toDayKeyInZone(new Date()));
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day===0?6:day-1) + offset*7);
  mon.setHours(0,0,0,0);
  return mon;
}
function getDayKeys(offset=0) {
  const mon = getWeekStart(offset);
  return Array.from({length:7}, (_,i)=>{
    const d = new Date(mon); d.setDate(mon.getDate()+i);
    return dateToLocalKey(d);
  });
}
function formatDayKey(key) { const [y,m,d]=key.split('-'); return new Date(+y,+m-1,+d); }
function todayKey() { return toDayKeyInZone(new Date()); }
const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAY_LONG  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const MOODS = ['😄','🙂','😐','😕','😴'];

/* ════════════════════════════════════════════════════════════════
   SCREENS / NAVIGATION
════════════════════════════════════════════════════════════════ */
function showScreen(id) {
  const targetScreen = document.getElementById('screen-'+id);
  // Never throw on an unknown/removed screen id — that would leave no screen
  // active and, because every nav button routes through here, freeze the app.
  if (!targetScreen) { console.error('showScreen: no screen for id', id); return; }
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  targetScreen.classList.add('active');
  // Auxiliary hooks are isolated so a failure in one can't stop the screen from
  // actually showing (and can't lock navigation across the whole app).
  try { enhanceAccessibility(targetScreen); } catch(e){ console.error('enhanceAccessibility failed', e); }
  try { if (typeof refreshMascotButton === 'function') refreshMascotButton(); } catch(e){ console.error('refreshMascotButton failed', e); }
  if (id === 'day') {
    try {
      updateDayLandscapeChromeHeight();
      applyDayLandscapeFocusState();
      maybeShowRewardPrompt();
      offerTutorialIfNeeded();
    } catch(e){ console.error('day-screen init failed', e); }
  }
}

/* Parent PIN — a *soft* child-lock, not real security (anyone reading the
   source or the synced state can see it). Stored per-family in shared state so a
   parent can change it; defaults to '1234'. A real gate needs Firebase Auth +
   scoped Firestore rules (see SECURITY_TODO.md). */
function getParentPin() {
  const pin = state.shared && state.shared.parentPin;
  return (pin != null && String(pin).length) ? String(pin) : '1234';
}
function setParentPin(newPin) {
  if (!state.shared) state.shared = {};
  state.shared.parentPin = String(newPin);
  saveAll();
}
// Parent-hub control: change the family PIN (verifies the current one first).
async function changeParentPin() {
  const cur = ((await showPrompt('Enter your current PIN 🔒', { type:'password' })) || '').trim();
  if (cur !== getParentPin()) { showToast('Incorrect PIN'); return; }
  const next = ((await showPrompt('New PIN (numbers work best):', { type:'password' })) || '').trim();
  if (!next) { showToast('PIN unchanged'); return; }
  const confirm2 = ((await showPrompt('Re-enter the new PIN:', { type:'password' })) || '').trim();
  if (next !== confirm2) { showToast('PINs didn\'t match — unchanged'); return; }
  setParentPin(next);
  showToast('✅ Parent PIN updated');
}
let parentUnlockedThisSession = false;

/* ── Hero Mode (Quest Board) — simplified gamified landing for kids ── */
const HERO_MODE_LS_KEY = 'wp_hero_mode';
function isHeroMode() {
  const v = localStorage.getItem(HERO_MODE_LS_KEY);
  return v === null ? true : v === '1'; // default ON
}
function toggleHeroMode() {
  const next = !isHeroMode();
  localStorage.setItem(HERO_MODE_LS_KEY, next ? '1' : '0');
  refreshHeroModeToggle();
  showToast(next ? '🎮 Hero Mode ON' : 'Hero Mode OFF');
}
function refreshHeroModeToggle() {
  const btn = document.getElementById('heroModeToggle');
  if (!btn) return;
  const on = isHeroMode();
  btn.textContent = on ? '🎮 Hero Mode: ON' : '🎮 Hero Mode: OFF';
  btn.classList.toggle('on', on);
}

async function selectProfile(p) {
  if (p === 'parent' && !parentUnlockedThisSession) {
    const pin = ((await showPrompt('Enter parent PIN 🔒', { type:'password' })) || '').trim();
    if (pin !== getParentPin()) {
      showToast('Incorrect PIN');
      return;
    }
    parentUnlockedThisSession = true;
  }
  profile = p;
  if (p === 'parent') {
    parentViewing = 'jenn';
    showScreen('parent');
    renderParentHome();
  } else if (isHeroMode()) {
    goQuestBoard();
  } else {
    showScreen('week');
    renderWeek();
  }
}

