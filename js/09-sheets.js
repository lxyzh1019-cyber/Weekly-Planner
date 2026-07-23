// Weekly-Planner — tray + bottom sheets: training/activity/edit sheets, templates, custom, reflection.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   TRAY
════════════════════════════════════════════════════════════════ */
function buildTray() {
  // Filter chips
  const filterWrap = document.getElementById('trayFilter');
  filterWrap.innerHTML = '';
  const filters = [
    {id:'all', label:'All'},
    {id:'daily', label:'🍽 Daily'},
    {id:'routine', label:'🌅 Routines'},
    {id:'school', label:'📚 Learning'},
    {id:'active', label:'🏃 Active'},
    {id:'training', label:'🏋️ Competitive Sports'},
    {id:'free', label:'🎮 Free'},
    {id:'seasonal', label:'🌟 Seasonal'},
  ];
  filters.forEach(f=>{
    const c = document.createElement('div');
    c.className = 'filter-chip'+(currentTrayFilter===f.id?' active':'');
    c.textContent = f.label;
    c.onclick = ()=>{ currentTrayFilter=f.id; buildTray(); };
    filterWrap.appendChild(c);
  });

  const tray = document.getElementById('trayScroll');
  tray.innerHTML = '';
  const acts = getAllActivities();
  const filtered = acts.filter(a=>{
    if (currentTrayFilter==='all') return true;
    if (currentTrayFilter==='seasonal') return a._seasonal;
    // Category is the source of truth — isTraining is a shared UI mechanism
    // (objectives/gear/tags) between Competitive Sports and Competition, not a category.
    return a.cat===currentTrayFilter;
  });

  filtered.forEach(act=>{
    const chip = document.createElement('div');
    chip.className = 'activity-chip'+((act._locked || act._rewardLocked)?' locked':'');
    chip.id = 'chip-'+act.id;
    chip.style.borderColor = 'var(--ink)';
    const durStr = formatDuration(act.durationMin || 60);

    let levelBadge = '';
    const rule = (state.shared.levelRules||[]).find(r=>r.activityId===act.id);
    if (rule) {
      const profd = getProfData();
      const cur = rule.type==='count' ? (profd.activityCounts?.[act.id]||0) : (profd.activityHours?.[act.id]||0);
      if (cur >= rule.target) levelBadge = `<div class="chip-level-badge">★</div>`;
    }
    let lockBadge = '';
    if (act._locked || act._rewardLocked) lockBadge = `<div class="chip-lock-badge">🔒</div>`;

    chip.innerHTML = `
      ${levelBadge}${lockBadge}
      <div class="chip-icon">${act.icon}</div>
      <div class="chip-name">${act.name}</div>
      <div class="chip-dur">${durStr}</div>
    `;
    chip.onclick = ()=>selectActivity(act);
    tray.appendChild(chip);
  });

  const addChip = document.createElement('div');
  addChip.className = 'chip-add';
  addChip.innerHTML = '<div style="font-size:1.6rem">＋</div><div>Custom</div>';
  addChip.onclick = ()=>openCustomActivity();
  tray.appendChild(addChip);
  enhanceAccessibility(document.getElementById('screen-day'));
}

function selectActivity(act) {
  // Opt-in Family Hero onboarding: tapping a starter chore before it's
  // been set up opens the chooser here, instead of forcing that sheet on
  // the first day-view load (and instead of a dead "locked" toast).
  const _pr = getProfData()?.progress;
  if (_pr && !_pr.tutorialDone && TUTORIAL_STARTER_CHOICES.some(c=>c.id===act.id)) {
    openTutorial(); return;
  }
  if (act._locked) { showToast(`🔒 Unlocks in ${act.season}!`); return; }
  if (act._rewardLocked) { showToast('Keep going — unlock this reward soon ✨'); return; }
  selectedActivity = act;
  setDayFocusPane('center');
  document.querySelectorAll('.activity-chip').forEach(c=>c.classList.remove('selected'));
  const el = document.getElementById('chip-'+act.id);
  if (el) el.classList.add('selected');
  document.getElementById('trayHint').textContent = `"${act.name}" picked — tap a time slot ☝️`;
  hideMascot();
}

/* ════════════════════════════════════════════════════════════════
   TRAINING SHEET
════════════════════════════════════════════════════════════════ */
function openTrainingSheet() { renderTrainingSheet(); openSheet('trainingOverlay'); }

function renderTrainingSheet() {
  const isCompetition = !!(selectedActivity && selectedActivity.isCompetition);
  const titleEl = document.getElementById('trainingSheetTitle');
  if (titleEl) titleEl.textContent = isCompetition ? '🏆 Competition' : '🏋️ Training Session';

  // Start time picker
  renderStartTimePicker('trainingStartPicker', pendingStartMin, (m)=>{ pendingStartMin = m; renderTrainingSheet(); });

  // Tags
  const tagWrap = document.getElementById('trainingTagBtns');
  tagWrap.innerHTML = '';
  TRAINING_TAGS.forEach(t=>{
    const b = document.createElement('button');
    b.className = 'pill-btn'+(ts.tag===t.id?' active':'');
    b.textContent = t.label;
    b.onclick = ()=>{
      // Adopt the topic colour unless the user had picked a non-default custom one.
      if (!ts.colour || ts.colour === CAT_HEX.training || TRAINING_TAGS.some(x=>x.colour===ts.colour)) ts.colour = t.colour;
      ts.tag=t.id; ts.objectives=[]; renderTrainingSheet();
    };
    tagWrap.appendChild(b);
  });

  // Duration (in minutes) — a competition (meet/event) runs much longer than
  // a practice session, so it gets its own, larger set of preset lengths.
  const durWrap = document.getElementById('trainingDurBtns');
  durWrap.innerHTML = '';
  const durOptions = isCompetition ? [120,180,240,300,360,420,480,540,600] : [30,60,90,120,150,180];
  durOptions.forEach(min=>{
    const b = document.createElement('button');
    b.className='pill-btn'+(ts.durationMin===min?' active':'');
    b.textContent = formatDuration(min);
    b.onclick = ()=>{ ts.durationMin=min; renderTrainingSheet(); };
    durWrap.appendChild(b);
  });

  // Colour
  const cp = document.getElementById('trainingColourPicker');
  cp.innerHTML = '';
  COLOURS.forEach(c=>{
    const d = document.createElement('div');
    d.className = 'colour-dot'+(ts.colour===c?' selected':'');
    d.style.background = c;
    d.onclick = ()=>{ ts.colour=c; renderTrainingSheet(); };
    cp.appendChild(d);
  });

  // Objectives — preset + custom tasks filtered by tag. Competition day gets its
  // own performance/meet checklist rather than the practice-drill objectives.
  const objWrap = document.getElementById('objectivesList');
  objWrap.innerHTML = '';
  const presets = (isCompetition ? COMPETITION_OBJECTIVES_BY_TAG : OBJECTIVES_BY_TAG)[ts.tag] || [];
  presets.forEach(obj=>{
    const item = document.createElement('div');
    const checked = ts.objectives.includes(obj);
    item.className = 'obj-item'+(checked?' checked':'');
    item.innerHTML = `<div class="obj-check">${checked?'✓':''}</div><span>${obj}</span>`;
    item.onclick = ()=>{
      if (ts.objectives.includes(obj)) ts.objectives = ts.objectives.filter(o=>o!==obj);
      else ts.objectives.push(obj);
      renderTrainingSheet();
    };
    objWrap.appendChild(item);
  });

  const myTasks = (state.shared.customTasks||[]).filter(t=>t.sport===ts.tag || t.sport==='general');
  if (myTasks.length) {
    const hdr = document.createElement('div');
    hdr.style.cssText='font-family:Gochi Hand;font-size:1rem;color:var(--ink-light);margin-top:0.4rem';
    hdr.textContent = 'From your library:';
    objWrap.appendChild(hdr);
    myTasks.forEach(t=>{
      const label = `${t.name}${t.reps?` (${t.reps})`:''}`;
      const checked = ts.objectives.includes(label);
      const item = document.createElement('div');
      item.className = 'obj-item'+(checked?' checked':'');
      item.innerHTML = `<div class="obj-check">${checked?'✓':''}</div><span>${label}</span><span class="obj-meta">saved</span><span class="obj-delete" title="delete">×</span>`;
      item.onclick = (e)=>{
        if (e.target.classList.contains('obj-delete')) {
          state.shared.customTasks = state.shared.customTasks.filter(x=>x.id!==t.id);
          tombstoneIds('task:', [t.id]);
          ts.objectives = ts.objectives.filter(o=>o!==label);
          saveAll(); renderTrainingSheet();
          return;
        }
        if (ts.objectives.includes(label)) ts.objectives = ts.objectives.filter(o=>o!==label);
        else ts.objectives.push(label);
        renderTrainingSheet();
      };
      objWrap.appendChild(item);
    });
  }

  if (ts.travelBufMin == null || ts.travelBufMin < 5) ts.travelBufMin = DEFAULT_BUFFER_MIN;
  if (ts.getReadyBufMin == null || ts.getReadyBufMin < 5) ts.getReadyBufMin = DEFAULT_BUFFER_MIN;
  if (ts.warmupBufMin == null || ts.warmupBufMin < 5) ts.warmupBufMin = DEFAULT_WARMUP_MIN;
  const tbToggle = document.getElementById('trainingTravelToggle');
  tbToggle.classList.toggle('on', ts.travelBuffer);
  const rbToggle = document.getElementById('trainingReadyToggle');
  rbToggle.classList.toggle('on', !!ts.getReadyBuffer);
  const wbToggle = document.getElementById('trainingWarmupToggle');
  wbToggle.classList.toggle('on', !!ts.warmupBuffer);
  document.getElementById('trainingTravelDurRow').style.display = ts.travelBuffer ? 'flex' : 'none';
  document.getElementById('trainingReadyDurRow').style.display = ts.getReadyBuffer ? 'flex' : 'none';
  document.getElementById('trainingWarmupDurRow').style.display = ts.warmupBuffer ? 'flex' : 'none';
  const tIn = document.getElementById('trainingTravelBufMin');
  const rIn = document.getElementById('trainingReadyBufMin');
  const wIn = document.getElementById('trainingWarmupBufMin');
  if (tIn) tIn.value = String(ts.travelBufMin);
  if (rIn) rIn.value = String(ts.getReadyBufMin);
  if (wIn) wIn.value = String(ts.warmupBufMin);
  renderTrainingGearChecklist('trainingGearList', ts, ts.tag, false, isCompetition);

  // Repeat + day picker
  const rt = document.getElementById('trainingRepeat');
  rt.classList.toggle('on', ts.repeat);
  document.getElementById('trainingRepeatDays').style.display = ts.repeat?'block':'none';
  renderDayPicker('trainingDayPicker', ts.repeatDays, (days)=>{ ts.repeatDays=days; });
  // Date-range only in parent mode
  document.getElementById('trainingDateRange').style.display = isParent() ? 'block' : 'none';

  document.getElementById('trainingNote').value = ts.note;

  renderSheetTimeSummary('trainingTimeSummary', pendingStartMin, ts.durationMin, ts.travelBuffer, ts.travelBufMin, !!ts.getReadyBuffer, ts.getReadyBufMin, !!ts.warmupBuffer, ts.warmupBufMin);
}

function onTrainingBufferMinInput() {
  const tIn = document.getElementById('trainingTravelBufMin');
  const rIn = document.getElementById('trainingReadyBufMin');
  const wIn = document.getElementById('trainingWarmupBufMin');
  if (tIn) ts.travelBufMin = clampBufferMin(tIn.value);
  if (rIn) ts.getReadyBufMin = clampBufferMin(rIn.value);
  if (wIn) ts.warmupBufMin = clampBufferMin(wIn.value);
  renderTrainingSheet();
}

function cancelCreatePlacement(overlayId, skipClose=false) {
  pendingStartMin = null;
  selectedActivity = null;
  currentTimelineGuideY = null;
  setDayFocusPane(null);
  clearPlacementGuide();
  if (!skipClose && overlayId) closeSheet(overlayId);
  const hint = document.getElementById('trayHint');
  if (hint) hint.textContent = 'Tap an activity to pick';
  document.querySelectorAll('.activity-chip').forEach(c=>c.classList.remove('selected'));
}

function confirmTraining() {
  // Guard against a rapid double-tap placing two blocks. The confirm button no
  // longer hides itself after a tap, so we consume pendingStartMin immediately
  // and bail if it's already been consumed (the second tap of a double-tap).
  if (pendingStartMin == null) return;
  const startMin = pendingStartMin;
  pendingStartMin = null;
  const isComp = !!(selectedActivity && selectedActivity.isCompetition);
  ts.note = document.getElementById('trainingNote').value;
  const dateStart = isParent() ? document.getElementById('trainingDateStart').value : '';
  const dateEnd   = isParent() ? document.getElementById('trainingDateEnd').value : '';
  const actId = (selectedActivity && selectedActivity.id) || 'training';
  placeBlock(actId, startMin, ts.durationMin, ts.colour, ts.objectives, ts.note, {
    tag: ts.tag,
    repeatDays: ts.repeat?ts.repeatDays:[],
    travelBuffer: ts.travelBuffer,
    getReadyBuffer: !!ts.getReadyBuffer,
    warmupBuffer: !!ts.warmupBuffer,
    gearState: ts.gearState || {},
    travelBufMin: ts.travelBufMin,
    getReadyBufMin: ts.getReadyBufMin,
    warmupBufMin: ts.warmupBufMin,
    repeatDateStart: dateStart || null,
    repeatDateEnd:   dateEnd   || null,
  });
  closeSheet('trainingOverlay');
  showToast(isComp ? 'Competition placed 🏆' : 'Training placed 🏋️');
}

/* ════════════════════════════════════════════════════════════════
   GENERIC ACTIVITY SHEET
════════════════════════════════════════════════════════════════ */
function openActivitySheet() { renderActivitySheet(); openSheet('activityOverlay'); }
function renderActivitySheet() {
  const act = selectedActivity;
  document.getElementById('activitySheetTitle').textContent = `${act.icon} ${act.name}`;
  if (as_.travelBufMin == null || as_.travelBufMin < 5) as_.travelBufMin = DEFAULT_BUFFER_MIN;

  renderStartTimePicker('activityStartPicker', pendingStartMin, (m)=>{ pendingStartMin = m; renderActivitySheet(); }, ()=>syncDurationColumnSpacers('activity'));

  const durWrap = document.getElementById('activityDurBtns');
  durWrap.innerHTML = '';
  [15,30,45,60,90,120,180].forEach(min=>{
    const b = document.createElement('button');
    b.className='pill-btn'+(as_.durationMin===min?' active':'');
    b.textContent = formatDuration(min);
    b.onclick = ()=>{ as_.durationMin=min; renderActivitySheet(); };
    durWrap.appendChild(b);
  });
  // Custom duration input
  renderCustomDuration('activityCustomDur', as_.durationMin, (m)=>{
    as_.durationMin = m; renderActivitySheet();
  }, ()=>syncDurationColumnSpacers('activity'));

  const cp = document.getElementById('activityColourPicker');
  cp.innerHTML = '';
  COLOURS.forEach(c=>{
    const d = document.createElement('div');
    d.className = 'colour-dot'+(as_.colour===c?' selected':'');
    d.style.background = c;
    d.onclick = ()=>{ as_.colour=c; renderActivitySheet(); };
    cp.appendChild(d);
  });

  const tbToggle = document.getElementById('activityTravelToggle');
  tbToggle.classList.toggle('on', as_.travelBuffer);
  const atRow = document.getElementById('activityTravelDurRow');
  if (atRow) atRow.style.display = as_.travelBuffer ? 'flex' : 'none';
  const atIn = document.getElementById('activityTravelBufMin');
  if (atIn) atIn.value = String(as_.travelBufMin);

  const rt = document.getElementById('activityRepeat');
  rt.classList.toggle('on', as_.repeat);
  document.getElementById('activityRepeatDays').style.display = as_.repeat?'block':'none';
  renderDayPicker('activityDayPicker', as_.repeatDays, (days)=>{ as_.repeatDays=days; });
  // Date-range repeat: parent mode + school category only (per design)
  const showRange = isParent() && selectedActivity && selectedActivity.cat === 'school';
  document.getElementById('activityDateRange').style.display = showRange ? 'block' : 'none';

  document.getElementById('activityNote').value = as_.note;

  // Chore type picker — only shown when placing a House Chore block
  const choreRow = document.getElementById('choreTypeRow');
  const isChoreBlock = selectedActivity && selectedActivity.id === 'chores';
  if (choreRow) {
    choreRow.style.display = isChoreBlock ? 'block' : 'none';
    if (isChoreBlock) {
      const picker = document.getElementById('choreTypePicker');
      if (picker) {
        picker.innerHTML = '';
        if (!Array.isArray(as_.choreTags)) as_.choreTags = [];
        // Multi-select: tag several chores on one House-Chore block. All the
        // selected chores sync to the chore tab when the block is completed.
        ctPickableChoreNames().forEach(tag => {
          const b = document.createElement('button');
          const on = as_.choreTags.includes(tag);
          b.className = 'pill-btn' + (on ? ' active' : '');
          b.textContent = (on ? '✓ ' : '') + tag;
          b.onclick = () => {
            as_.choreTags = on ? as_.choreTags.filter(t => t !== tag) : [...as_.choreTags, tag];
            renderActivitySheet();
          };
          picker.appendChild(b);
        });
      }
    }
  }

  renderSheetTimeSummary('activityTimeSummary', pendingStartMin, as_.durationMin, as_.travelBuffer, as_.travelBufMin);
  requestAnimationFrame(()=>syncDurationColumnSpacers('activity'));
}
function confirmActivity() {
  // Guard against a rapid double-tap placing two blocks (and against a second
  // tap running after selectedActivity was cleared, which used to throw).
  if (pendingStartMin == null || !selectedActivity) return;
  const startMin = pendingStartMin;
  pendingStartMin = null;
  as_.note = document.getElementById('activityNote').value;
  const allowRange = isParent() && selectedActivity && selectedActivity.cat === 'school';
  const dateStart = allowRange ? document.getElementById('activityDateStart').value : '';
  const dateEnd   = allowRange ? document.getElementById('activityDateEnd').value   : '';
  const isChoreBlock = selectedActivity && selectedActivity.id === 'chores';
  placeBlock(selectedActivity.id, startMin, as_.durationMin, as_.colour, [], as_.note, {
    repeatDays: as_.repeat?as_.repeatDays:[],
    travelBuffer: as_.travelBuffer,
    travelBufMin: as_.travelBufMin,
    repeatDateStart: dateStart || null,
    repeatDateEnd:   dateEnd   || null,
    choreTags: isChoreBlock ? (as_.choreTags || []).slice() : null,
  });
  closeSheet('activityOverlay');
  showToast('Block placed ✅');
}

/* Start-time minute picker:
   - Shows nearest hour with :00 :15 :30 :45 quick buttons
   - "Custom" reveals a 5-min-step input */
function renderStartTimePicker(containerId, curMin, onChange, onAfterRender) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = '';

  // Display current time
  const display = document.createElement('div');
  display.className = 'time-display';
  display.textContent = formatTimeFromMin(curMin);
  wrap.appendChild(display);

  // Hour nav
  const hourRow = document.createElement('div');
  hourRow.className = 'minute-picker';
  const curH = Math.floor(curMin/60);
  const curMinInHour = curMin%60;

  const prevH = document.createElement('button');
  prevH.className = 'pill-btn';
  prevH.textContent = '◀';
  prevH.onclick = ()=>{
    const newMin = Math.max(START_MIN, curMin - 60);
    onChange(newMin);
    renderStartTimePicker(containerId, newMin, onChange, onAfterRender);
  };
  hourRow.appendChild(prevH);

  const hourLabel = document.createElement('span');
  hourLabel.style.cssText = 'font-family:Gochi Hand;font-size:1.1rem;min-width:60px;text-align:center';
  const h12 = curH>12?curH-12:(curH===0?12:curH);
  hourLabel.textContent = `${h12}${curH>=12?'pm':'am'}`;
  hourRow.appendChild(hourLabel);

  const nextH = document.createElement('button');
  nextH.className = 'pill-btn';
  nextH.textContent = '▶';
  nextH.onclick = ()=>{
    const newMin = Math.min(END_MIN - 15, curMin + 60);
    onChange(newMin);
    renderStartTimePicker(containerId, newMin, onChange, onAfterRender);
  };
  hourRow.appendChild(nextH);
  wrap.appendChild(hourRow);

  // Minute quick-buttons (0/15/30/45)
  const minRow = document.createElement('div');
  minRow.className = 'minute-picker';
  [0,15,30,45].forEach(m=>{
    const b = document.createElement('button');
    b.className = 'pill-btn'+(curMinInHour===m?' active':'');
    b.textContent = ':'+m.toString().padStart(2,'0');
    b.onclick = ()=>{
      const newMin = curH*60 + m;
      onChange(newMin);
      renderStartTimePicker(containerId, newMin, onChange, onAfterRender);
    };
    minRow.appendChild(b);
  });
  wrap.appendChild(minRow);

  // Custom (5-min step)
  const customRow = document.createElement('div');
  customRow.className = 'custom-time-row';
  customRow.innerHTML = `<label>Custom min:</label>`;
  const input = document.createElement('input');
  input.type = 'number'; input.min = 0; input.max = 55; input.step = 5;
  input.value = curMinInHour;
  input.onchange = ()=>{
    const m = Math.max(0, Math.min(55, Math.round(parseInt(input.value||0)/5)*5));
    const newMin = curH*60 + m;
    onChange(newMin);
    renderStartTimePicker(containerId, newMin, onChange, onAfterRender);
  };
  customRow.appendChild(input);
  wrap.appendChild(customRow);
  requestAnimationFrame(()=>{ if (typeof onAfterRender === 'function') onAfterRender(curMin); });
}

function renderCustomDuration(containerId, curMin, onChange, onAfterChange) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'custom-time-row';
  row.innerHTML = `<label>Custom min:</label>`;
  const input = document.createElement('input');
  input.type = 'number'; input.min = 1; input.max = 480; input.step = 1;
  input.value = curMin;
  input.onchange = ()=>{
    const m = Math.max(1, Math.min(480, parseInt(input.value||15, 10) || 15));
    onChange(m);
    if (typeof onAfterChange === 'function') onAfterChange(m);
  };
  row.appendChild(input);
  wrap.appendChild(row);
}

function toggleTravelBuffer(which) {
  if (which==='training') {
    ts.travelBuffer = !ts.travelBuffer;
    if (ts.travelBuffer && (ts.travelBufMin == null || ts.travelBufMin < 5)) ts.travelBufMin = DEFAULT_BUFFER_MIN;
    renderTrainingSheet();
  } else {
    as_.travelBuffer = !as_.travelBuffer;
    if (as_.travelBuffer && (as_.travelBufMin == null || as_.travelBufMin < 5)) as_.travelBufMin = DEFAULT_BUFFER_MIN;
    renderActivitySheet();
  }
}
function toggleGetReadyBuffer(which) {
  if (which==='training') { ts.getReadyBuffer = !ts.getReadyBuffer; renderTrainingSheet(); }
}
function toggleWarmupBuffer(which) {
  if (which==='training') { ts.warmupBuffer = !ts.warmupBuffer; renderTrainingSheet(); }
}
function toggleEditGetReadyBuffer() {
  editState.getReadyBuffer = !editState.getReadyBuffer;
  const tg = document.getElementById('editReadyToggle');
  if (tg) tg.classList.toggle('on', !!editState.getReadyBuffer);
  const row = document.getElementById('editReadyDurRow');
  if (row) row.style.display = editState.getReadyBuffer ? 'flex' : 'none';
  renderSheetTimeSummary('editTimeSummary', editState.startMin, editState.durationMin, editState.travelBuffer, editState.travelBufMin, !!editState.getReadyBuffer, editState.getReadyBufMin, !!editState.warmupBuffer, editState.warmupBufMin);
}
function toggleEditWarmupBuffer() {
  editState.warmupBuffer = !editState.warmupBuffer;
  const tg = document.getElementById('editWarmupToggle');
  if (tg) tg.classList.toggle('on', !!editState.warmupBuffer);
  const row = document.getElementById('editWarmupDurRow');
  if (row) row.style.display = editState.warmupBuffer ? 'flex' : 'none';
  renderSheetTimeSummary('editTimeSummary', editState.startMin, editState.durationMin, editState.travelBuffer, editState.travelBufMin, !!editState.getReadyBuffer, editState.getReadyBufMin, !!editState.warmupBuffer, editState.warmupBufMin);
}

/* Multi-day picker */
function renderDayPicker(containerId, selectedDays, onChange) {
  const wrap = document.getElementById(containerId);
  wrap.innerHTML = '';
  DAY_SHORT.forEach((d, i)=>{
    const el = document.createElement('div');
    el.className = 'day-pick'+(selectedDays.includes(i)?' active':'');
    el.textContent = d;
    el.onclick = ()=>{
      if (selectedDays.includes(i)) selectedDays.splice(selectedDays.indexOf(i),1);
      else selectedDays.push(i);
      onChange(selectedDays);
      renderDayPicker(containerId, selectedDays, onChange);
    };
    wrap.appendChild(el);
  });
}
function pickPreset(which, preset) {
  let target = which==='training' ? ts.repeatDays
            : which==='edit'     ? editState.repeatDays
            : as_.repeatDays;
  target.length = 0;
  if (preset==='weekdays') [0,1,2,3,4].forEach(i=>target.push(i));
  else if (preset==='weekend') [5,6].forEach(i=>target.push(i));
  else if (preset==='all') [0,1,2,3,4,5,6].forEach(i=>target.push(i));
  if (which==='training') renderTrainingSheet();
  else if (which==='edit') renderDayPicker('editDayPicker', editState.repeatDays, (days)=>{ editState.repeatDays = days; });
  else renderActivitySheet();
}

/* ════════════════════════════════════════════════════════════════
   EDIT BLOCK SHEET
════════════════════════════════════════════════════════════════ */
let editState = {
  startMin: null, durationMin: null, travelBuffer: false, getReadyBuffer: false, travelBufMin: 15, getReadyBufMin: 15,
  warmupBuffer: false, warmupBufMin: 20,
  repeat: false, repeatDays: [],
  completed: false,
  stopwatchEnabled: false,
  stopwatch: { goalSec: null, elapsedSec: 0, running: false, startedAt: null },
};
let editStopwatchTick = null;

function defaultStopwatch() {
  return { goalSec: null, elapsedSec: 0, running: false, startedAt: null, enabled: false };
}

function cloneStopwatch(sw) {
  const d = defaultStopwatch();
  if (!sw || typeof sw !== 'object') return d;
  return {
    goalSec: sw.goalSec != null ? sw.goalSec : null,
    elapsedSec: Math.max(0, sw.elapsedSec|0),
    running: !!sw.running,
    startedAt: sw.startedAt != null ? sw.startedAt : null,
    enabled: !!sw.enabled,
  };
}

function stopwatchDisplayElapsed(sw) {
  if (!sw) return 0;
  let e = Math.max(0, sw.elapsedSec|0);
  if (sw.running && sw.startedAt) {
    e += Math.floor((Date.now() - sw.startedAt) / 1000);
  }
  return e;
}

function renderEditStopwatchStats() {
  const el = document.getElementById('editStopwatchStats');
  if (!el) return;
  const sw = editState.stopwatch || defaultStopwatch();
  const goal = sw.goalSec != null ? sw.goalSec : (Math.max(1, editState.durationMin|0) * 60);
  const used = stopwatchDisplayElapsed(sw);
  el.textContent = `Goal ${formatTimerSec(goal)} · Used ${formatTimerSec(used)}`;
}

function editStopwatchClearTick() {
  if (editStopwatchTick) { clearInterval(editStopwatchTick); editStopwatchTick = null; }
}

function editStopwatchStartTick() {
  editStopwatchClearTick();
  editStopwatchTick = setInterval(()=>{ renderEditStopwatchStats(); }, 500);
}

function syncEditStopwatchUI() {
  const wrap = document.getElementById('editStopwatchWrap');
  const tg = document.getElementById('editStopwatchToggle');
  if (wrap) wrap.style.display = 'block';
  if (tg) tg.classList.toggle('on', editState.stopwatchEnabled);
  renderEditStopwatchStats();
  const sw = editState.stopwatch;
  if (editState.stopwatchEnabled && sw && sw.running) editStopwatchStartTick();
  else editStopwatchClearTick();
}

function toggleEditComplete() {
  editState.completed = !editState.completed;
  document.getElementById('editCompleteToggle').classList.toggle('on', editState.completed);
}

function toggleEditStopwatch() {
  editState.stopwatchEnabled = !editState.stopwatchEnabled;
  if (!editState.stopwatch) editState.stopwatch = defaultStopwatch();
  editState.stopwatch.enabled = editState.stopwatchEnabled;
  if (!editState.stopwatchEnabled) {
    editStopwatchPause();
    editState.stopwatch.running = false;
    editState.stopwatch.startedAt = null;
  }
  syncEditStopwatchUI();
}

function editStopwatchStart() {
  if (!editState.stopwatchEnabled) return;
  if (!editState.stopwatch) editState.stopwatch = defaultStopwatch();
  const sw = editState.stopwatch;
  sw.goalSec = Math.max(60, (editState.durationMin|0) * 60);
  if (sw.running) return;
  sw.running = true;
  sw.startedAt = Date.now();
  syncEditStopwatchUI();
}

function editStopwatchPause() {
  const sw = editState.stopwatch;
  if (!sw || !sw.running) { syncEditStopwatchUI(); return; }
  sw.elapsedSec = stopwatchDisplayElapsed(sw);
  sw.running = false;
  sw.startedAt = null;
  syncEditStopwatchUI();
}

function editStopwatchReset() {
  const sw = editState.stopwatch;
  if (!sw) return;
  sw.elapsedSec = 0;
  sw.running = false;
  sw.startedAt = null;
  sw.goalSec = Math.max(60, (editState.durationMin|0) * 60);
  if (editingBlockId) stopwatchGoalToasted.delete(editingBlockId);
  syncEditStopwatchUI();
}

function onEditStartMinChange(m) {
  editState.startMin = m;
  renderStartTimePicker('editStartPicker', editState.startMin, onEditStartMinChange, ()=>syncDurationColumnSpacers('edit'));
  renderSheetTimeSummary('editTimeSummary', editState.startMin, editState.durationMin, editState.travelBuffer, editState.travelBufMin, !!editState.getReadyBuffer, editState.getReadyBufMin, !!editState.warmupBuffer, editState.warmupBufMin);
  if (editState.stopwatch && editState.stopwatchEnabled) {
    editState.stopwatch.goalSec = Math.max(60, (editState.durationMin|0) * 60);
    renderEditStopwatchStats();
  }
}

function onEditBufferMinInput() {
  const tIn = document.getElementById('editTravelBufMin');
  const rIn = document.getElementById('editReadyBufMin');
  const wIn = document.getElementById('editWarmupBufMin');
  if (tIn) editState.travelBufMin = clampBufferMin(tIn.value);
  if (rIn) editState.getReadyBufMin = clampBufferMin(rIn.value);
  if (wIn) editState.warmupBufMin = clampBufferMin(wIn.value);
  renderSheetTimeSummary('editTimeSummary', editState.startMin, editState.durationMin, editState.travelBuffer, editState.travelBufMin, !!editState.getReadyBuffer, editState.getReadyBufMin, !!editState.warmupBuffer, editState.warmupBufMin);
}

function onActivityTravelBufMinInput() {
  const tIn = document.getElementById('activityTravelBufMin');
  if (tIn) as_.travelBufMin = clampBufferMin(tIn.value);
  renderActivitySheet();
}

function openEditSheet(blockId) {
  editingBlockId = blockId;
  const block = getDayBlocks(currentDayKey).find(b=>b.id===blockId);
  if (!block) return;
  const act = getAllActivities().find(a=>a.id===block.actId);
  if (!act) return;

  editState.startMin    = block.startMin;
  editState.durationMin = block.durationMin;
  editState.travelBuffer = !!block.travelBuffer;
  editState.getReadyBuffer = !!block.getReadyBuffer;
  editState.warmupBuffer = !!block.warmupBuffer;
  editState.travelBufMin = getTravelBufMin(block) || DEFAULT_BUFFER_MIN;
  editState.getReadyBufMin = getGetReadyBufMin(block) || DEFAULT_BUFFER_MIN;
  editState.warmupBufMin = getWarmupBufMin(block) || DEFAULT_WARMUP_MIN;
  editState.gearState = { ...(block.gearState||{}) }
  editState.repeat = false;
  editState.repeatDays = [];
  // Reset edit-repeat UI to "off"
  document.getElementById('editRepeat').classList.remove('on');
  document.getElementById('editRepeatDays').style.display = 'none';
  // Series-wrap visibility: show only if this block belongs to a series of >1
  const sw = document.getElementById('seriesWrap');
  if (sw) {
    const inSeries = !!block.seriesId && countSeriesBlocks(block.seriesId) > 1;
    sw.style.display = inSeries ? 'block' : 'none';
  }

  document.getElementById('editSheetTitle').textContent = `${act.icon} ${act.name}`;

  editState.completed = !!block.completed;
  document.getElementById('editCompleteToggle').classList.toggle('on', editState.completed);
  renderParentStampPicker(block);

  editState.stopwatch = cloneStopwatch(block.stopwatch);
  editState.stopwatchEnabled = !!(block.stopwatch && (block.stopwatch.enabled || block.stopwatch.running));
  if (editState.stopwatch.running && editState.stopwatch.startedAt) {
    editState.stopwatch.elapsedSec = stopwatchDisplayElapsed(editState.stopwatch);
    editState.stopwatch.running = false;
    editState.stopwatch.startedAt = null;
  }

  renderStartTimePicker('editStartPicker', editState.startMin, onEditStartMinChange, ()=>syncDurationColumnSpacers('edit'));
  renderEditDurationPicker(act);

  // Checklist (only if routine)
  const clWrap = document.getElementById('editChecklistWrap');
  if (act.isRoutine) {
    clWrap.style.display = 'block';
    renderChecklist(block, act, 'editChecklistList');
  } else {
    clWrap.style.display = 'none';
  }

  // Objectives (training)
  const objWrap = document.getElementById('editObjectivesWrap');
  const objEditWrap = document.getElementById('editObjectivesEditWrap');
  const objInput = document.getElementById('editObjectivesInput');
  if (act.isTraining) {
    objWrap.style.display = 'block';
    const list = Array.isArray(block.objectives) ? block.objectives : [];
    document.getElementById('editObjectivesView').innerHTML = list.length
      ? list.map(o=>`<div style="font-size:0.9rem;padding:0.3rem 0;border-bottom:1px dashed var(--paper-line)">🎯 ${escapeHtml(o)}</div>`).join('')
      : '<p style="font-size:0.9rem;color:var(--ink-light)">No objectives yet — add some below.</p>';
    objInput.value = list.join('\n');
    if (isParent()) objEditWrap.style.display = 'block';
    else if (block.parentPinned) objEditWrap.style.display = 'none';
    else objEditWrap.style.display = 'block';
  } else {
    objWrap.style.display = 'none';
    objEditWrap.style.display = 'none';
  }

  document.getElementById('editNoteInput').value = block.note || '';

  // Mood inline
  const bmWrap = document.getElementById('editBlockMoods');
  bmWrap.innerHTML = '';
  const curMood = getProfData().blockMoods?.[blockId];
  MOODS.forEach(m=>{
    const el = document.createElement('div');
    el.className = 'vibe-mood'+(curMood===m?' selected':'');
    el.textContent = m;
    el.onclick = ()=>{
      const p = getProfData();
      if (!p.blockMoods) p.blockMoods={};
      p.blockMoods[blockId] = m;
      saveAll();
      bmWrap.querySelectorAll('.vibe-mood').forEach(x=>x.classList.remove('selected'));
      el.classList.add('selected');
      buildTimeline();
    };
    bmWrap.appendChild(el);
  });

  // Travel + get-ready + warm-up buffer
  document.getElementById('editTravelToggle').classList.toggle('on', editState.travelBuffer);
  const editReady = document.getElementById('editReadyToggle');
  const editWarmup = document.getElementById('editWarmupToggle');
  const editGearWrap = document.getElementById('editTrainingGearWrap');
  const editTrRow = document.getElementById('editTravelDurRow');
  const editRdRow = document.getElementById('editReadyDurRow');
  const editWuRow = document.getElementById('editWarmupDurRow');
  if (act.isTraining) {
    editReady.style.display = 'flex';
    editReady.classList.toggle('on', !!editState.getReadyBuffer);
    editWarmup.style.display = 'flex';
    editWarmup.classList.toggle('on', !!editState.warmupBuffer);
    editGearWrap.style.display = 'block';
    renderTrainingGearChecklist('editTrainingGearList', editState, block.tag || 'skating', false, act.isCompetition);
    editTrRow.style.display = editState.travelBuffer ? 'flex' : 'none';
    editRdRow.style.display = editState.getReadyBuffer ? 'flex' : 'none';
    editWuRow.style.display = editState.warmupBuffer ? 'flex' : 'none';
    const etIn = document.getElementById('editTravelBufMin');
    const erIn = document.getElementById('editReadyBufMin');
    const ewIn = document.getElementById('editWarmupBufMin');
    if (etIn) etIn.value = String(editState.travelBufMin);
    if (erIn) erIn.value = String(editState.getReadyBufMin);
    if (ewIn) ewIn.value = String(editState.warmupBufMin);
  } else {
    editReady.style.display = 'none';
    editWarmup.style.display = 'none';
    editGearWrap.style.display = 'none';
    editTrRow.style.display = editState.travelBuffer ? 'flex' : 'none';
    editRdRow.style.display = 'none';
    editWuRow.style.display = 'none';
    if (editTrRow.style.display === 'flex') {
      const etIn = document.getElementById('editTravelBufMin');
      if (etIn) etIn.value = String(editState.travelBufMin);
    }
  }

  renderSheetTimeSummary('editTimeSummary', editState.startMin, editState.durationMin, editState.travelBuffer, editState.travelBufMin, !!editState.getReadyBuffer, editState.getReadyBufMin, !!editState.warmupBuffer, editState.warmupBufMin);
  syncEditStopwatchUI();

  // Parent pin toggle
  const ppWrap = document.getElementById('parentPinWrap');
  if (isParent()) {
    ppWrap.style.display = 'block';
    document.getElementById('pinToggle').classList.toggle('on', !!block.parentPinned);
    document.getElementById('confirmToggle').classList.toggle('on', !!block.confirmed);
  } else ppWrap.style.display = 'none';

  // Sister Sync per-activity controls: parent-only
  const ssWrap = document.getElementById('sisterSyncWrap');
  if (isParent()) {
    ssWrap.style.display = 'block';
    document.getElementById('publicToggle').classList.toggle('on', !!block.public);
    const inviteBtn = document.getElementById('inviteSisterBtn');
    const sister = parentViewing==='jenn' ? 'jess' : 'jenn';
    const alreadyInvited = Array.isArray(block.invitedTo) && block.invitedTo.includes(sister);
    inviteBtn.style.display = 'block';
    inviteBtn.textContent = alreadyInvited
      ? `💌 Invite sent to ${sister==='jenn'?'Jenn':'Jess'}`
      : `💌 Invite your sister`;
    inviteBtn.disabled = alreadyInvited;
  } else {
    ssWrap.style.display = 'none';
  }

  openSheet('editOverlay');
}

function renderEditDurationPicker(act) {
  const durWrap = document.getElementById('editDurBtns');
  durWrap.innerHTML = '';
  const options = act.isCompetition ? [120,180,240,300,360,420,480,540,600]
    : act.isTraining ? [30,60,90,120,150,180] : [15,30,45,60,90,120,180,240];
  options.forEach(min=>{
    const b = document.createElement('button');
    b.className='pill-btn'+(editState.durationMin===min?' active':'');
    b.textContent = formatDuration(min);
    b.onclick = ()=>{ editState.durationMin = min; renderEditDurationPicker(act); };
    durWrap.appendChild(b);
  });
  renderCustomDuration('editCustomDur', editState.durationMin, (m)=>{
    editState.durationMin = m; renderEditDurationPicker(act);
  }, ()=>syncDurationColumnSpacers('edit'));
  renderSheetTimeSummary('editTimeSummary', editState.startMin, editState.durationMin, editState.travelBuffer, editState.travelBufMin, !!editState.getReadyBuffer, editState.getReadyBufMin, !!editState.warmupBuffer, editState.warmupBufMin);
  if (editState.stopwatch) {
    editState.stopwatch.goalSec = Math.max(60, (editState.durationMin|0) * 60);
    renderEditStopwatchStats();
  }
  requestAnimationFrame(()=>syncDurationColumnSpacers('edit'));
}

function renderChecklist(block, act, listContainerId, options) {
  const tmpl = getRoutineTemplate(act.routineId);
  const listWrap = document.getElementById(listContainerId || 'editChecklistList');
  const skipAdd = !!(options && options.skipAdd);
  listWrap.innerHTML = '';
  if (!tmpl?.items?.length && !getKidExtras(act.routineId).length && !getUnlockedRoutineRewards(act.routineId).length) {
    listWrap.innerHTML = '<p style="font-size:0.9rem;color:var(--ink-light)">No items in this routine</p>';
    return;
  }
  if (!block.checklistState) block.checklistState = {};

  // Render parent/template items first (kids cannot rename/delete)
  const cid = listContainerId || 'editChecklistList';

  (tmpl?.items || []).forEach(item=>{
    listWrap.appendChild(buildChecklistRow(block, act, item, false, cid));
  });

  // Render kid-added items (only for child profiles, not parent — parent shouldn't see another kid's extras)
  const extras = getKidExtras(act.routineId);
  extras.forEach(item=>{
    listWrap.appendChild(buildChecklistRow(block, act, item, true, cid));
  });
  const rewardItems = getUnlockedRoutineRewards(act.routineId);
  rewardItems.forEach(item=>{
    listWrap.appendChild(buildChecklistRow(block, act, item, false, cid));
  });

  // "+ Add my own item" row — only when a child is using their own profile (not parent mode)
  if (!isParent() && !skipAdd) {
    const addRow = document.createElement('div');
    addRow.className = 'checklist-add-row';
    addRow.innerHTML = `
      <input type="text" class="checklist-add-input" placeholder="+ Add my own item" maxlength="60">
      <button class="pill-btn checklist-add-btn">Add</button>
    `;
    const inp = addRow.querySelector('input');
    const btn = addRow.querySelector('button');
    const submit = ()=>{
      const txt = inp.value.trim();
      if (!txt) return;
      addKidExtra(act.routineId, txt);
      inp.value = '';
      renderChecklist(block, act, cid);
    };
    btn.onclick = submit;
    inp.onkeydown = (e)=>{ if (e.key==='Enter') { e.preventDefault(); submit(); } };
    listWrap.appendChild(addRow);
  }
}

/* Build one checklist row. isKidItem=true means the row gets a delete (×) button. */
function buildChecklistRow(block, act, item, isKidItem, listContainerId) {
  const cid = listContainerId || 'editChecklistList';
  const checked = !!block.checklistState[item.id];
  const row = document.createElement('div');
  row.className = 'checklist-item'+(checked?' checked':'')+(isKidItem?' kid-item':'');

  const box = document.createElement('div');
  box.className = 'checklist-check';
  box.textContent = checked ? '✓' : '';
  box.onclick = (e)=>{
    e.stopPropagation();
    const blocks = getDayBlocks(currentDayKey);
    const b = blocks.find(x=>x.id===block.id);
    if (!b.checklistState) b.checklistState = {};
    b.checklistState[item.id] = !b.checklistState[item.id];
    setDayBlocks(currentDayKey, blocks);
    renderChecklist(b, act, cid);
    buildTimeline();
    if (act.isRoutine) {
      const total = countChecklistTotal(b, act);
      const done = countChecklistDone(b, act);
      const prevDone = b.checklistState[item.id] ? Math.max(0, done - 1) : Math.min(total, done + 1);
      markRoutineProgressOnChecklistToggle(b, act, prevDone, done, total);
      if (total > 0 && done >= total) {
        if (!routineCompleteToasted.has(b.id)) {
          routineCompleteToasted.add(b.id);
          showToast('🌟 Routine complete — you did it!');
        }
      } else {
        routineCompleteToasted.delete(b.id);
      }
    }
  };
  row.appendChild(box);

  const txt = document.createElement('span');
  txt.className = 'checklist-text';
  txt.textContent = item.text;
  row.appendChild(txt);

  if (item.timerSec) {
    const timerKey = `${block.id}-${item.id}`;
    const timerBtn = document.createElement('button');
    timerBtn.className = 'checklist-timer-btn'+(activeTimers[timerKey]?' running':'');
    timerBtn.textContent = activeTimers[timerKey]
      ? formatTimerSec(activeTimers[timerKey].remaining)
      : `▶ ${formatTimerSec(item.timerSec)}`;
    timerBtn.onclick = (e)=>{
      e.stopPropagation();
      toggleTimer(timerKey, item.timerSec, timerBtn);
    };
    row.appendChild(timerBtn);
  }

  if (isKidItem && !isParent()) {
    const delBtn = document.createElement('button');
    delBtn.className = 'checklist-del-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Remove my item';
    delBtn.onclick = (e)=>{
      e.stopPropagation();
      removeKidExtra(act.routineId, item.id);
      renderChecklist(block, act, cid);
    };
    row.appendChild(delBtn);
  }

  return row;
}

/* Get kid-added extras for the current child profile, for a specific routineId */
function getKidExtras(routineId) {
  const p = getProfData();
  if (!p) return [];
  const map = p.routineExtras || {};
  return map[routineId] || [];
}

function addKidExtra(routineId, text) {
  const p = getProfData();
  if (!p.routineExtras) p.routineExtras = {};
  if (!p.routineExtras[routineId]) p.routineExtras[routineId] = [];
  p.routineExtras[routineId].push({
    id: 'kx-'+Date.now().toString(36)+Math.random().toString(36).slice(2,4),
    text: text,
    addedBy: profile,
  });
  saveAll();
}

function removeKidExtra(routineId, itemId) {
  const p = getProfData();
  if (!p.routineExtras?.[routineId]) return;
  p.routineExtras[routineId] = p.routineExtras[routineId].filter(x=>x.id!==itemId);
  // Also remove any checklistState references in this kid's blocks
  const weeks = p.weeks || {};
  Object.values(weeks).forEach(blocks=>{
    blocks.forEach(b=>{
      if (b.checklistState && itemId in b.checklistState) delete b.checklistState[itemId];
    });
  });
  saveAll();
}

function formatTimerSec(s) {
  const m = Math.floor(s/60); const ss = s%60;
  if (m===0) return ss+'s';
  return m+':'+ss.toString().padStart(2,'0');
}

function toggleTimer(key, totalSec, btnEl) {
  if (activeTimers[key]) {
    clearInterval(activeTimers[key].interval);
    delete activeTimers[key];
    btnEl.classList.remove('running');
    btnEl.textContent = `▶ ${formatTimerSec(totalSec)}`;
    return;
  }
  activeTimers[key] = { remaining: totalSec, interval: null };
  btnEl.classList.add('running');
  activeTimers[key].interval = setInterval(()=>{
    activeTimers[key].remaining--;
    if (activeTimers[key].remaining <= 0) {
      clearInterval(activeTimers[key].interval);
      delete activeTimers[key];
      playBell();
      if (btnEl.isConnected) {
        btnEl.classList.remove('running');
        btnEl.textContent = `✓ Done!`;
        setTimeout(()=>{ if(btnEl.isConnected) btnEl.textContent = `▶ ${formatTimerSec(totalSec)}`; }, 3000);
      }
      showToast('⏰ Time!');
    } else if (btnEl.isConnected) {
      btnEl.textContent = formatTimerSec(activeTimers[key].remaining);
    }
  }, 1000);
}

/* Web Audio bell — two-tone chime */
let _audioCtx = null;
function playBell() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const ctx = _audioCtx;
    const now = ctx.currentTime;
    [
      {freq: 880, start: 0,   dur: 0.8}, // A5
      {freq: 659, start: 0.25, dur: 1.2}, // E5
    ].forEach(({freq, start, dur})=>{
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now+start);
      gain.gain.linearRampToValueAtTime(0.25, now+start+0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now+start+dur);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now+start);
      osc.stop(now+start+dur+0.1);
    });
  } catch(e){ console.warn('Audio failed', e); }
}

function toggleEditTravelBuffer() {
  editState.travelBuffer = !editState.travelBuffer;
  document.getElementById('editTravelToggle').classList.toggle('on', editState.travelBuffer);
  const row = document.getElementById('editTravelDurRow');
  if (row) row.style.display = editState.travelBuffer ? 'flex' : 'none';
  renderSheetTimeSummary('editTimeSummary', editState.startMin, editState.durationMin, editState.travelBuffer, editState.travelBufMin, !!editState.getReadyBuffer, editState.getReadyBufMin, !!editState.warmupBuffer, editState.warmupBufMin);
}

async function saveEditChanges() {
  if (!editingBlockId) return;
  editStopwatchPause();
  const blocks = getDayBlocks(currentDayKey);
  const blk = blocks.find(b=>b.id===editingBlockId);
  if (!blk) { closeSheet('editOverlay'); return; }
  if (blk.parentPinned && !isParent()) {
    showToast('📌 Parent-pinned — ask a grown-up');
    return;
  }
  const act = getAllActivities().find(a=>a.id===blk.actId);

  const newStart = Math.max(START_MIN, Math.min(END_MIN-15, editState.startMin));
  // W5: never let a block run past the end of the day — clamp its duration to
  // the room left from its start, so what's saved is what renders. Toast if we
  // had to shorten it.
  const requestedDur = Math.max(5, Math.min(DAY_MIN_SPAN, editState.durationMin));
  const newDur = Math.min(requestedDur, END_MIN - newStart);
  if (newDur < requestedDur) showToast('✂️ Trimmed to fit the day');
  const newTravel = !!editState.travelBuffer;
  const newGetReady = !!editState.getReadyBuffer;
  const newWarmup = !!editState.warmupBuffer;
  const newTravelBuf = newTravel ? clampBufferMin(editState.travelBufMin) : null;
  const newReadyBuf = newGetReady ? clampBufferMin(editState.getReadyBufMin) : null;
  const newWarmupBuf = newWarmup ? clampBufferMin(editState.warmupBufMin) : null;
  const newGearState = editState.gearState ? { ...editState.gearState } : {};
  const newNote  = document.getElementById('editNoteInput').value;
  const newCompleted = !!editState.completed;
  let newObjectives = Array.isArray(blk.objectives) ? [...blk.objectives] : [];
  if (act && act.isTraining && (isParent() || !blk.parentPinned)) {
    const raw = (document.getElementById('editObjectivesInput')?.value || '').split('\n')
      .map(s => s.trim()).filter(Boolean);
    newObjectives = raw;
  }

  let newStopwatch = null;
  if (editState.stopwatchEnabled && editState.stopwatch) {
    const sw = { ...editState.stopwatch };
    sw.elapsedSec = stopwatchDisplayElapsed(sw);
    sw.running = false;
    sw.startedAt = null;
    sw.enabled = true;
    sw.goalSec = sw.goalSec != null ? sw.goalSec : Math.max(60, newDur * 60);
    newStopwatch = sw;
  }

  const fieldsChanged = (
    blk.startMin !== newStart ||
    blk.durationMin !== newDur ||
    blk.travelBuffer !== newTravel ||
    !!blk.getReadyBuffer !== newGetReady ||
    !!blk.warmupBuffer !== newWarmup ||
    getTravelBufMin(blk) !== (newTravelBuf || 0) ||
    getGetReadyBufMin(blk) !== (newReadyBuf || 0) ||
    getWarmupBufMin(blk) !== (newWarmupBuf || 0) ||
    JSON.stringify(blk.gearState||{}) !== JSON.stringify(newGearState||{}) ||
    (blk.note||'') !== newNote ||
    !!blk.completed !== newCompleted ||
    JSON.stringify(blk.objectives||[]) !== JSON.stringify(newObjectives) ||
    JSON.stringify(blk.stopwatch||null) !== JSON.stringify(newStopwatch)
  );

  // Series-aware update prompt
  let applyToSeries = false;
  if (blk.seriesId && fieldsChanged) {
    const siblings = countSeriesBlocks(blk.seriesId);
    if (siblings > 1) {
      applyToSeries = await showConfirm(`This block is part of a series of ${siblings}.\n\nOK = update ALL in series\nCancel = update only this one`, { okLabel:'Update all', cancelLabel:'Only this' });
    }
  }

  // Apply edits to this block
  blk.startMin    = newStart;
  blk.durationMin = newDur;
  blk.travelBuffer = newTravel;
  blk.getReadyBuffer = newGetReady;
  blk.warmupBuffer = newWarmup;
  if (newTravel) blk.travelBufMin = newTravelBuf;
  else delete blk.travelBufMin;
  if (newGetReady) blk.getReadyBufMin = newReadyBuf;
  else delete blk.getReadyBufMin;
  if (newWarmup) blk.warmupBufMin = newWarmupBuf;
  else delete blk.warmupBufMin;
  blk.gearState = newGearState;
  blk.note = newNote;
  const wasCompleted = !!blk.completed;
  blk.completed = newCompleted;
  // Unify rewards: marking done in the edit sheet now earns XP + fires links.
  if (!wasCompleted && newCompleted) awardBlockLinks(blk, currentDayKey);
  if (act && act.isTraining) blk.objectives = newObjectives;
  if (newStopwatch) blk.stopwatch = newStopwatch;
  else delete blk.stopwatch;
  markItemUpdated(blk); // stamp so edits win cross-device merges
  setDayBlocks(currentDayKey, blocks);

  // Optionally apply same edits to siblings
  if (applyToSeries && blk.seriesId) {
    const seriesPatch = {
      startMin: newStart, durationMin: newDur, travelBuffer: newTravel, getReadyBuffer: newGetReady, warmupBuffer: newWarmup, gearState: { ...newGearState }, note: newNote,
      completed: newCompleted,
    };
    if (newTravel) seriesPatch.travelBufMin = newTravelBuf;
    else seriesPatch.travelBufMin = null;
    if (newGetReady) seriesPatch.getReadyBufMin = newReadyBuf;
    else seriesPatch.getReadyBufMin = null;
    if (newWarmup) seriesPatch.warmupBufMin = newWarmupBuf;
    else seriesPatch.warmupBufMin = null;
    if (act && act.isTraining) seriesPatch.objectives = [...newObjectives];
    if (newStopwatch) seriesPatch.stopwatch = { ...newStopwatch };
    else seriesPatch.stopwatch = null;
    applySeriesEdit(blk.seriesId, editingBlockId, seriesPatch);
  }

  // New "Repeat to other days" — create a fresh series for THIS week
  if (editState.repeat && editState.repeatDays.length) {
    createSeriesFromBlock(blk, editState.repeatDays);
  }

  closeSheet('editOverlay');
  buildTimeline();
  showToast(applyToSeries ? 'Series updated ✅' : 'Saved ✅');
  renderGoalsTodos();
}

/* Count how many blocks share a seriesId across all weeks of this profile. */
function countSeriesBlocks(seriesId) {
  if (!seriesId) return 0;
  const weeks = (getProfData().weeks)||{};
  let n = 0;
  Object.values(weeks).forEach(arr => {
    (arr||[]).forEach(b => { if (b.seriesId === seriesId) n++; });
  });
  return n;
}

/* Apply the same field edits to every block in the series EXCEPT the source. */
function applySeriesEdit(seriesId, sourceBlockId, fields) {
  if (!seriesId) return;
  const weeks = (getProfData().weeks)||{};
  Object.keys(weeks).forEach(dayKey=>{
    const arr = weeks[dayKey]||[];
    let changed = false;
    arr.forEach(b => {
      if (b.seriesId !== seriesId || b.id === sourceBlockId) return;
      Object.assign(b, fields);
      if (Object.prototype.hasOwnProperty.call(fields, 'stopwatch') && fields.stopwatch == null) {
        delete b.stopwatch;
      }
      if (fields.travelBufMin == null && Object.prototype.hasOwnProperty.call(fields, 'travelBufMin')) delete b.travelBufMin;
      if (fields.getReadyBufMin == null && Object.prototype.hasOwnProperty.call(fields, 'getReadyBufMin')) delete b.getReadyBufMin;
      if (fields.warmupBufMin == null && Object.prototype.hasOwnProperty.call(fields, 'warmupBufMin')) delete b.warmupBufMin;
      changed = true;
    });
    if (changed) setDayBlocks(dayKey, arr);
  });
}

/* Delete every block in series (optionally exclude one). */
function deleteSeriesBlocks(seriesId, exceptBlockId=null) {
  if (!seriesId) return 0;
  const weeks = (getProfData().weeks)||{};
  let removed = 0;
  const removedIds = [];
  Object.keys(weeks).forEach(dayKey=>{
    const arr = weeks[dayKey]||[];
    const kept = arr.filter(b => {
      if (b.seriesId !== seriesId) return true;
      if (b.id === exceptBlockId) return true;
      removed++;
      removedIds.push(b.id);
      return false;
    });
    if (kept.length !== arr.length) setDayBlocks(dayKey, kept);
  });
  // Tombstone every removed id AND the series itself so the sync merge can't
  // resurrect any member — even one this device never saw.
  tombstoneBlockIds(removedIds.concat(exceptBlockId ? [] : ['sr:' + seriesId]));
  if (removedIds.length) saveAll();
  return removed;
}

/* Build a new series in the current week from a source block. */
function createSeriesFromBlock(sourceBlock, repeatDays) {
  const keys = getDayKeys(weekOffset);
  const curIdx = keys.indexOf(currentDayKey);
  // If source already has a seriesId, extend it. Otherwise create new.
  if (!sourceBlock.seriesId) {
    sourceBlock.seriesId = 'sr-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    setDayBlocks(currentDayKey, getDayBlocks(currentDayKey));
  }
  const seriesId = sourceBlock.seriesId;
  const profd = getProfData();
  if (!profd.activityCounts) profd.activityCounts = {};
  if (!profd.activityHours)  profd.activityHours  = {};
  let added = 0;
  repeatDays.forEach(idx=>{
    if (idx === curIdx) return;
    const targetKey = keys[idx];
    if (!targetKey) return;
    const dayBlocks = getDayBlocks(targetKey);
    // Avoid duplicating: skip if same series already lives on that day
    if (dayBlocks.some(b => b.seriesId === seriesId)) return;
    const nb = {
      ...sourceBlock,
      id: Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      checklistState: {},
      seriesId,
    };
    dayBlocks.push(nb);
    setDayBlocks(targetKey, dayBlocks);
    profd.activityCounts[sourceBlock.actId] = (profd.activityCounts[sourceBlock.actId]||0) + 1;
    profd.activityHours[sourceBlock.actId]  = (profd.activityHours[sourceBlock.actId]||0)  + (sourceBlock.durationMin/60);
    added++;
  });
  if (added) saveAll();
  return added;
}

function togglePin() {
  const blocks = getDayBlocks(currentDayKey);
  const blk = blocks.find(b=>b.id===editingBlockId);
  if (!blk) return;
  blk.parentPinned = !blk.parentPinned;
  setDayBlocks(currentDayKey, blocks);
  document.getElementById('pinToggle').classList.toggle('on', blk.parentPinned);
  buildTimeline();
}

function ctAutoCheckOptionalFromBlock(blk, dayKey) {
  // A House-Chore block can tag several chores; sync each one to the chore tab.
  const tags = (Array.isArray(blk.choreTags) && blk.choreTags.length)
    ? blk.choreTags
    : (blk.choreTag ? [blk.choreTag] : []);
  const valid = tags.filter(t => t && t !== 'General' && ctAllChoreNames().includes(t));
  if (!valid.length) return;
  const kid = isParent() ? parentViewing : activeProfile();
  const wk = ctWeekKeyForDate(dayKey);
  const mon = formatDayKey(wk);
  const day = formatDayKey(dayKey);
  const dayIdx = Math.round((day - mon) / (24*60*60*1000));
  if (dayIdx < 0 || dayIdx > 6) return;
  const newlyChecked = [];
  valid.forEach(name => {
    if (ctGetOptional(wk, dayIdx, kid, name)) return;
    ctSetOptional(wk, dayIdx, kid, name, true);
    newlyChecked.push(name);
  });
  if (!newlyChecked.length) return;
  const fired = ctCheckGroupPayouts(wk, dayIdx, kid);
  ctMaybeFireGoalBonus(wk, kid);
  // Caller performs saveAll().
  if (fired.length) ctCelebrateGroupPayouts(fired, 'screen-chore');
  else showToast(`✨ ${newlyChecked.length === 1 ? newlyChecked[0] + ' chore' : newlyChecked.length + ' chores'} checked!`);
}

function toggleConfirm() {
  if (!isParent()) { showToast('Only parents can confirm 🔒'); return; }
  const blocks = getDayBlocks(currentDayKey);
  const blk = blocks.find(b=>b.id===editingBlockId);
  if (!blk) return;
  blk.confirmed = !blk.confirmed;
  setDayBlocks(currentDayKey, blocks);
  document.getElementById('confirmToggle').classList.toggle('on', !!blk.confirmed);
  recountActivityProgress();
  if (blk.confirmed) {
    checkLevelUp(blk.actId);
    if (blk.actId === 'chores') ctAutoCheckOptionalFromBlock(blk, currentDayKey);
  }
  saveAll();
  buildTimeline();
}

/* Parent: confirm every block on the current day in one tap. */
async function confirmAllToday() {
  if (!isParent()) return;
  const blocks = getDayBlocks(currentDayKey);
  const unconfirmed = blocks.filter(b => !b.confirmed);
  if (!unconfirmed.length) {
    showToast('Already all confirmed ✅');
    return;
  }
  if (!(await showConfirm(`Confirm all ${unconfirmed.length} block${unconfirmed.length===1?'':'s'} for this day?`))) return;
  unconfirmed.forEach(b => { b.confirmed = true; });
  setDayBlocks(currentDayKey, blocks);
  recountActivityProgress();
  // Check level-up and auto-chore for each unique actId touched
  const seen = new Set();
  unconfirmed.forEach(b => {
    if (b.actId === 'chores') ctAutoCheckOptionalFromBlock(b, currentDayKey);
    if (seen.has(b.actId)) return;
    seen.add(b.actId);
    checkLevelUp(b.actId);
  });
  saveAll();
  buildTimeline();
  showToast(`${unconfirmed.length} block${unconfirmed.length===1?'':'s'} confirmed ✅`);
}

/* ════════════════════════════════════════════════════════════════
   TEMPLATES / CLEAR
════════════════════════════════════════════════════════════════ */
function openTemplateSheet() { refreshRestDayButton(); openSheet('templateOverlay'); }

function applyTemplate(type) {
  const tmpl = type==='school' ? SCHOOL_TEMPLATE : WEEKEND_TEMPLATE;
  const acts = getAllActivities();
  const blocks = tmpl.map(t=>{
    const act = acts.find(a=>a.id===t.actId);
    return {
      id: Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      actId: t.actId,
      startMin: START_MIN + t.startMin,
      durationMin: t.durationMin,
      colour: t.colour || CAT_HEX[act?.cat] || '#888',
      objectives: t.objectives||[],
      note: '',
      tag: t.tag||null,
      checklistState: {},
      travelBuffer: false,
    };
  });
  // The template REPLACES the day — tombstone the old blocks so they don't
  // come back from another device on the next sync merge.
  tombstoneBlockIds((getDayBlocks(currentDayKey) || []).map(b => b.id));
  setDayBlocks(currentDayKey, blocks);
  closeSheet('templateOverlay');
  buildTimeline();
  showToast(`${type==='school'?'🏫 School':'🌈 Weekend'} template applied!`);
}

async function clearDay() {
  if (!(await showConfirm('Clear all blocks for this day?', { danger:true, okLabel:'Clear' }))) return;
  tombstoneBlockIds((getDayBlocks(currentDayKey) || []).map(b => b.id));
  setDayBlocks(currentDayKey, []);
  buildTimeline();
  showToast('Day cleared 🗑');
}

/* ════════════════════════════════════════════════════════════════
   CUSTOM ACTIVITY & TASK
════════════════════════════════════════════════════════════════ */

/* Tap-to-pick emoji grid for activity icons (easier than typing an emoji,
   especially on desktop). */
const EMOJI_PICKER = [
  '⚽','🏀','🎾','🏐','🏊','🚴','🏃','⛸️','🤸','🥋','🧗','🏋️','🛹','⛹️','🥅',
  '🎸','🎹','🎺','🎻','🥁','🎨','🖌️','🎭','🎤','🩰','🎬',
  '📚','📖','✏️','🔬','🧪','🧮','🌍','💻','📝','🗣️','🎓',
  '🍽️','🥣','🍳','🛁','🪥','🧹','🧺','🛏️','👕','🐶','🌳',
  '🎮','🧩','♟️','🎲','🪁','🎈','⭐','🎯','💤','🧸'
];

function renderEmojiGrid(gridId, inputId, current) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '';
  EMOJI_PICKER.forEach(e => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-cell' + (e === current ? ' selected' : '');
    btn.textContent = e;
    btn.setAttribute('aria-label', 'Use ' + e);
    btn.onclick = () => {
      const input = document.getElementById(inputId);
      if (input) input.value = e;
      syncEmojiGrid(gridId, e);
    };
    grid.appendChild(btn);
  });
}

/* Highlight the cell that matches the typed value (keeps grid + input in sync). */
function syncEmojiGrid(gridId, current) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  [...grid.children].forEach(c => c.classList.toggle('selected', c.textContent === current));
}

function openCustomActivity() {
  openSheet('customOverlay');
  const cur = (document.getElementById('customIcon').value || '').trim();
  renderEmojiGrid('customEmojiGrid', 'customIcon', cur);
}

function confirmCustomActivity() {
  const name = document.getElementById('customName').value.trim();
  const icon = document.getElementById('customIcon').value.trim() || '⭐';
  const cat  = document.getElementById('customCat').value;
  const durationMin = parseInt(document.getElementById('customDur').value);
  if (!name) { showToast('Enter a name!'); return; }
  const act = { id:'custom-'+Date.now().toString(36), name, icon, cat, durationMin, custom:true,
    addedBy: isParent() ? 'parent' : activeProfile(),
    pendingApproval: !isParent() };  // a kid's new activity waits for a parent's OK
  getProfData().customActivities = [...getCustomActivities(), act];
  saveAll();
  closeSheet('customOverlay');
  buildTray();
  showToast(isParent() ? `"${name}" added ✨` : `"${name}" added — a grown-up will approve it ✨`);
  document.getElementById('customName').value='';
  document.getElementById('customIcon').value='';
}

function openCustomTask() { openSheet('customTaskOverlay'); }
function confirmCustomTask() {
  const name = document.getElementById('taskName').value.trim();
  const sport = document.getElementById('taskSport').value;
  const reps = document.getElementById('taskReps').value.trim();
  const notes = document.getElementById('taskNotes').value.trim();
  if (!name) { showToast('Enter a name!'); return; }
  const task = { id:'t-'+Date.now().toString(36), name, sport, reps, notes };
  state.shared.customTasks = [...(state.shared.customTasks||[]), task];
  saveAll();
  closeSheet('customTaskOverlay');
  renderTrainingSheet();
  showToast('Task saved to library ✨');
  document.getElementById('taskName').value='';
  document.getElementById('taskReps').value='';
  document.getElementById('taskNotes').value='';
}

/* ════════════════════════════════════════════════════════════════
   END-OF-DAY REFLECTION + RITUAL
════════════════════════════════════════════════════════════════ */
function openReflectSheet() {
  const blocks = getDayBlocks(currentDayKey);
  // Overall
  const overallWrap = document.getElementById('reflectOverallMoods');
  overallWrap.innerHTML = '';
  const curOverall = getProfData().dayMoods?.[currentDayKey];
  MOODS.forEach(m=>{
    const el = document.createElement('div');
    el.className = 'vibe-mood'+(curOverall===m?' selected':'');
    el.textContent = m;
    el.onclick = ()=>{
      overallWrap.querySelectorAll('.vibe-mood').forEach(x=>x.classList.remove('selected'));
      el.classList.add('selected');
      el.dataset.mood = m;
      el.parentElement.dataset.mood = m;
    };
    if (curOverall===m) el.parentElement.dataset.mood = m;
    overallWrap.appendChild(el);
  });

  const listWrap = document.getElementById('reflectBlockList');
  listWrap.innerHTML = '';
  if (!blocks.length) {
    listWrap.innerHTML = '<p style="color:var(--ink-light);font-size:0.9rem">No blocks today</p>';
  } else {
    const acts = getAllActivities();
    blocks.forEach(b=>{
      const act = acts.find(a=>a.id===b.actId);
      if (!act) return;
      const cur = getProfData().blockMoods?.[b.id];
      const row = document.createElement('div');
      row.className = 'obj-item';
      row.style.justifyContent = 'space-between';
      row.innerHTML = `<span>${act.icon} ${act.name}</span>`;
      const moodPicker = document.createElement('div');
      moodPicker.style.cssText='display:flex;gap:0.25rem';
      MOODS.forEach(m=>{
        const dot = document.createElement('div');
        dot.className = 'vibe-mood'+(cur===m?' selected':'');
        dot.style.cssText='width:28px;height:28px;font-size:0.95rem';
        dot.textContent = m;
        dot.onclick = ()=>{
          const p = getProfData(); if(!p.blockMoods) p.blockMoods={};
          p.blockMoods[b.id] = m;
          saveAll();
          moodPicker.querySelectorAll('.vibe-mood').forEach(x=>x.classList.remove('selected'));
          dot.classList.add('selected');
        };
        moodPicker.appendChild(dot);
      });
      row.appendChild(moodPicker);
      listWrap.appendChild(row);
    });
  }
  openSheet('reflectOverlay');
}

function saveReflection() {
  const overallEl = document.querySelector('#reflectOverallMoods .vibe-mood.selected');
  if (overallEl) {
    const p = getProfData();
    if (!p.dayMoods) p.dayMoods={};
    p.dayMoods[currentDayKey] = overallEl.textContent;
    saveAll();
  }
  closeSheet('reflectOverlay');
  renderVibe();
  buildTimeline();
  openClosingRitual();
}

function openClosingRitual() {
  const blocks = getDayBlocks(currentDayKey);
  if (!blocks.length) return;
  const ritualBlocks = document.getElementById('ritualBlocks');
  ritualBlocks.innerHTML = '';
  const acts = getAllActivities();
  blocks.slice().sort((a,b)=>a.startMin-b.startMin).forEach((b, i)=>{
    const act = acts.find(a=>a.id===b.actId);
    if (!act) return;
    const mini = document.createElement('div');
    mini.className = 'ritual-block-mini';
    mini.style.animationDelay = (i*0.08)+'s';
    mini.textContent = `${act.icon} ${act.name}`;
    ritualBlocks.appendChild(mini);
  });

  // Stars
  const stars = document.getElementById('ritualStars');
  stars.innerHTML = '';
  for (let i=0;i<25;i++){
    const s = document.createElement('span');
    s.className='ritual-star';
    s.style.left = Math.random()*100+'%';
    s.style.top  = Math.random()*100+'%';
    s.style.animationDelay = (Math.random()*2)+'s';
    s.textContent = ['✨','⭐','💫','🌟'][Math.floor(Math.random()*4)];
    stars.appendChild(s);
  }

  document.getElementById('ritualTitle').textContent = `Well done, ${profile==='jenn'?'Jenn':'Jess'}!`;
  document.getElementById('ritualSubtitle').textContent = `You did ${blocks.length} thing${blocks.length===1?'':'s'} today.`;

  // Mood picker in ritual
  const moodsWrap = document.getElementById('ritualMoods');
  moodsWrap.innerHTML = '';
  MOODS.forEach(m=>{
    const el = document.createElement('div');
    el.className = 'vibe-mood';
    el.textContent = m;
    el.onclick = ()=>{
      moodsWrap.querySelectorAll('.vibe-mood').forEach(x=>x.classList.remove('selected'));
      el.classList.add('selected');
      const p = getProfData(); if(!p.dayMoods) p.dayMoods={};
      p.dayMoods[currentDayKey] = m;
      saveAll();
    };
    moodsWrap.appendChild(el);
  });

  document.getElementById('ritualScreen').classList.add('show');
}
function closeRitual() { document.getElementById('ritualScreen').classList.remove('show'); renderVibe(); }

