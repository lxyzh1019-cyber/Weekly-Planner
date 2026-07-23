// Weekly-Planner — goals + todos panel and achievements.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   GOALS + TODOS PANEL
════════════════════════════════════════════════════════════════ */
const GT_COLOURS = ['#ff7b54','#ffd166','#95d5b2','#6fb1fc','#c3aed6','#ff9eb5','#8ecae6','#b5ead7'];

function getCurrentWeekKey() {
  return dateToLocalKey(getWeekStart(weekOffset));
}
function getWeekBlockStatsByActId(actId) {
  const keys = getDayKeys(weekOffset);
  const weekBlocks = keys.flatMap(k=>getDayBlocks(k));
  const matches = weekBlocks.filter(b=>b.actId===actId);
  const completed = matches.filter(b=>!!b.completed).length;
  return { total: matches.length, completed };
}
function getTodoLinkStats(todo) {
  if (!todo) return null;
  if (todo.linkType === 'block' && todo.linkBlockId) {
    const keys = getDayKeys(weekOffset);
    const weekBlocks = keys.flatMap(k=>getDayBlocks(k));
    const blk = weekBlocks.find(b=>b.id===todo.linkBlockId);
    if (!blk) return null;
    return { total: 1, completed: blk.completed ? 1 : 0, actId: blk.actId };
  }
  if (todo.linkActId) {
    const s = getWeekBlockStatsByActId(todo.linkActId);
    return { ...s, actId: todo.linkActId };
  }
  return null;
}

function ensureGtFields(p) {
  if (!p.goals) p.goals = [];
  if (!p.todos) p.todos = [];
  if (!p.achievements) p.achievements = [];
}

function renderGoalsTodos() {
  const p = getProfData();
  if (!p) return;
  ensureGtFields(p);

  // ── GOALS ──
  const goalsList = document.getElementById('goalsList');
  if (!goalsList) return;
  goalsList.innerHTML = '';
  if (!p.goals.length) {
    goalsList.innerHTML = '<div class="gt-empty">No goals yet. Tap ＋ to add one.</div>';
  } else {
    p.goals.forEach(g => goalsList.appendChild(buildGoalRow(g)));
  }

  // ── TODOS (filter to current week) ──
  const wk = getCurrentWeekKey();
  const todosList = document.getElementById('todosList');
  todosList.innerHTML = '';
  const weekTodos = p.todos.filter(t => t.weekKey === wk);
  if (!weekTodos.length) {
    todosList.innerHTML = '<div class="gt-empty">Nothing yet. Tap ＋ to add a to-do.</div>';
  } else {
    weekTodos.forEach(t => todosList.appendChild(buildTodoRow(t)));
  }

  const achList = document.getElementById('achievementsList');
  if (!achList) return;
  achList.innerHTML = '';
  if (!p.achievements.length) {
    achList.innerHTML = '<div class="gt-empty">No achievements yet. Tap ＋ to add one.</div>';
  } else {
    p.achievements.forEach(a => achList.appendChild(buildAchievementRow(a)));
  }

  renderDayGoalsTodos();
}

function buildGoalRow(g) {
  const row = document.createElement('div');
  row.className = 'gt-item';

  const swatch = document.createElement('div');
  swatch.className = 'gt-color-swatch';
  swatch.style.background = g.color || GT_COLOURS[0];
  swatch.title = 'Change colour';
  swatch.onclick = ()=>{
    const idx = GT_COLOURS.indexOf(g.color);
    g.color = GT_COLOURS[(idx + 1) % GT_COLOURS.length];
    markItemUpdated(g);
    saveAll();
    renderGoalsTodos();
  };
  row.appendChild(swatch);

  const inp = document.createElement('input');
  inp.className = 'gt-text-input';
  inp.value = g.text;
  inp.placeholder = 'New goal…';
  inp.onchange = ()=>{
    g.text = inp.value.trim();
    markItemUpdated(g);
    saveAll();
  };
  inp.onblur = inp.onchange;
  row.appendChild(inp);

  const del = document.createElement('button');
  del.className = 'gt-del';
  del.textContent = '×';
  del.title = 'Remove';
  del.onclick = async ()=>{
    if (!(await showConfirm('Remove this goal?', { danger:true, okLabel:'Remove' }))) return;
    const p = getProfData();
    p.goals = p.goals.filter(x=>x.id!==g.id);
    saveAll();
    renderGoalsTodos();
  };
  row.appendChild(del);

  return row;
}

function buildTodoRow(t) {
  const row = document.createElement('div');
  const linkStats = getTodoLinkStats(t);
  const effectiveDone = linkStats ? (linkStats.total > 0 && linkStats.completed >= linkStats.total) : !!t.done;
  row.className = 'gt-item' + (effectiveDone ? ' done' : '');

  const check = document.createElement('div');
  check.className = 'gt-check';
  check.textContent = effectiveDone ? '✓' : '';
  check.onclick = ()=>{
    if (linkStats) {
      showToast('Linked to activities: complete blocks in Day view ✅');
      return;
    }
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : null;
    markItemUpdated(t);
    saveAll();
    renderGoalsTodos();
  };
  row.appendChild(check);

  const swatch = document.createElement('div');
  swatch.className = 'gt-color-swatch';
  swatch.style.background = t.color || GT_COLOURS[1];
  swatch.title = 'Change colour';
  swatch.onclick = ()=>{
    const idx = GT_COLOURS.indexOf(t.color);
    t.color = GT_COLOURS[(idx + 1) % GT_COLOURS.length];
    markItemUpdated(t);
    saveAll();
    renderGoalsTodos();
  };
  row.appendChild(swatch);

  const inp = document.createElement('input');
  inp.className = 'gt-text-input';
  inp.value = t.text;
  inp.placeholder = 'New to-do…';
  inp.onchange = ()=>{ t.text = inp.value.trim(); markItemUpdated(t); saveAll(); };
  inp.onblur = inp.onchange;
  row.appendChild(inp);

  const tag = document.createElement('span');
  const acts = getAllActivities();
  const linkedAct = linkStats?.actId ? acts.find(a=>a.id===linkStats.actId) : null;
  if (linkStats) {
    tag.className = 'gt-day-tag';
    tag.textContent = linkedAct ? `${linkedAct.icon} ${linkStats.completed}/${linkStats.total}` : `${linkStats.completed}/${linkStats.total}`;
    tag.title = 'Linked weekly progress';
  } else {
    tag.className = 'gt-day-tag' + (t.assignedDay==null ? ' unset' : '');
    tag.textContent = t.assignedDay==null ? '— day' : DAY_SHORT[t.assignedDay];
    tag.title = 'Tap to assign a day';
  }
  tag.onclick = ()=>{
    if (linkStats) return;
    // Cycle: unassigned → Mon → Tue → … → Sun → unassigned
    const cur = t.assignedDay;
    t.assignedDay = (cur == null) ? 0 : (cur >= 6 ? null : cur + 1);
    markItemUpdated(t);
    saveAll();
    renderGoalsTodos();
  };
  row.appendChild(tag);

  const del = document.createElement('button');
  del.className = 'gt-del';
  del.textContent = '×';
  del.title = 'Remove';
  del.onclick = ()=>{
    const p = getProfData();
    p.todos = p.todos.filter(x=>x.id!==t.id);
    saveAll();
    renderGoalsTodos();
  };
  row.appendChild(del);

  return row;
}

function addGoal() {
  const p = getProfData();
  ensureGtFields(p);
  p.goals.push({
    id: 'g-'+Date.now().toString(36),
    text: '',
    color: GT_COLOURS[p.goals.length % GT_COLOURS.length],
    createdAt: Date.now(),
  });
  saveAll();
  renderGoalsTodos();
  // Focus the new input
  setTimeout(()=>{
    const inputs = document.querySelectorAll('#goalsList .gt-text-input');
    if (inputs.length) inputs[inputs.length-1].focus();
  }, 0);
}


function progressForAchievement(a) {
  const keys = getDayKeys(weekOffset);
  const blocks = keys.flatMap(k=>getDayBlocks(k));
  const linked = blocks.filter(b=>b.actId===a.activityId && b.completed);
  if (a.mode==='duration') {
    const value = linked.reduce((sum,b)=>sum+(b.durationMin||0),0);
    return { value, label: formatDuration(value) };
  }
  const value = linked.length;
  return { value, label: String(value) };
}

function buildAchievementRow(a) {
  const row = document.createElement('div');
  row.className = 'gt-item gt-achievement-row';
  const acts = getAllActivities();
  const act = acts.find(x=>x.id===a.activityId);
  const prog = progressForAchievement(a);
  const targetVal = Math.max(1, a.target||1);
  const done = prog.value >= targetVal;
  const targetLabel = a.mode==='duration' ? formatDuration(targetVal) : String(targetVal);
  row.innerHTML = `<div class=\"gt-text\"><b>${act ? act.icon+' '+escapeHtml(act.name) : 'Pick activity'}</b> · ${a.mode==='duration'?'minutes':'count'} target ${targetLabel}<br><span class="gt-achievement-meta">${prog.label}/${targetLabel} · ${done?'Completed ✅':(prog.value>0?'In progress ⏳':'Not started')}</span></div>`;
  const controls = document.createElement('div');
  controls.className = 'gt-achievement-controls';

  const modeBtn = document.createElement('button');
  modeBtn.className='pill-btn';
  modeBtn.textContent = a.mode==='duration' ? 'Mode: Duration' : 'Mode: Count';
  modeBtn.onclick = ()=>setAchievementMode(a.id, a.mode==='duration'?'count':'duration');
  controls.appendChild(modeBtn);

  const pick = document.createElement('button');
  pick.className='pill-btn';
  pick.textContent='Link activity';
  pick.onclick = async ()=>{
    const names = acts.map((x,i)=>`${i+1}. ${x.icon} ${x.name}`).join('\n');
    const idx = parseInt((await showPrompt('Activity number:\n'+names, { value:'1', type:'number' }))||'',10)-1;
    if (Number.isNaN(idx) || idx<0 || idx>=acts.length) return;
    setAchievementActivity(a.id, acts[idx].id);
  };
  controls.appendChild(pick);

  const targetBtn = document.createElement('button');
  targetBtn.className = 'pill-btn';
  targetBtn.textContent = `Target: ${targetLabel}`;
  targetBtn.onclick = async ()=>{
    const next = parseInt((await showPrompt(`Set target (${a.mode==='duration'?'minutes':'count'})`, { value:String(targetVal), type:'number' }))||'', 10);
    if (!Number.isInteger(next) || next < 1) return;
    setAchievementTarget(a.id, next);
  };
  controls.appendChild(targetBtn);

  const del = document.createElement('button');
  del.className='gt-del';
  del.textContent='×';
  del.onclick = ()=>{
    const p = getProfData();
    p.achievements = p.achievements.filter(x=>x.id!==a.id);
    saveAll();
    renderGoalsTodos();
  };
  controls.appendChild(del);
  row.appendChild(controls);
  return row;
}

function addAchievement() {
  const p = getProfData();
  ensureGtFields(p);
  const acts = getAllActivities();
  const first = acts[0];
  p.achievements.push({
    id: 'a-'+Date.now().toString(36),
    activityId: first ? first.id : null,
    mode: 'count',
    target: 1,
    createdAt: Date.now(),
  });
  saveAll();
  renderGoalsTodos();
}

function setAchievementMode(id, mode) {
  const p = getProfData();
  const a = (p.achievements||[]).find(x=>x.id===id);
  if (!a) return;
  a.mode = mode;
  if (a.target == null || a.target < 1) a.target = 1;
  markItemUpdated(a);
  saveAll();
  renderGoalsTodos();
}

function setAchievementActivity(id, activityId) {
  const p = getProfData();
  const a = (p.achievements||[]).find(x=>x.id===id);
  if (!a) return;
  a.activityId = activityId;
  markItemUpdated(a);
  saveAll();
  renderGoalsTodos();
}

function setAchievementTarget(id, target) {
  const p = getProfData();
  const a = (p.achievements||[]).find(x=>x.id===id);
  if (!a) return;
  a.target = Math.max(1, target|0);
  markItemUpdated(a);
  saveAll();
  renderGoalsTodos();
}

async function addTodo() {
  const p = getProfData();
  ensureGtFields(p);
  const acts = getAllActivities();
  const entries = acts.map((x,i)=>`${i+1}. ${x.icon} ${x.name}`).join('\n');
  const pick = await showPrompt(`Link this weekly to-do to an activity series?\nEnter activity number (or leave blank for manual to-do):\n${entries}`, { value:'' });
  let linkActId = null;
  if (pick && pick.trim()) {
    const idx = parseInt(pick.trim(), 10) - 1;
    if (Number.isInteger(idx) && idx >= 0 && idx < acts.length) {
      linkActId = acts[idx].id;
    } else {
      showToast('Invalid activity number. Created regular to-do.');
    }
  }
  p.todos.push({
    id: 't-'+Date.now().toString(36),
    text: '',
    color: GT_COLOURS[(p.todos.length + 1) % GT_COLOURS.length],
    weekKey: getCurrentWeekKey(),
    assignedDay: null,
    done: false,
    linkType: linkActId ? 'activity' : null,
    linkActId: linkActId || null,
    linkBlockId: null,
    createdAt: Date.now(),
  });
  saveAll();
  renderGoalsTodos();
  setTimeout(()=>{
    const inputs = document.querySelectorAll('#todosList .gt-text-input');
    if (inputs.length) inputs[inputs.length-1].focus();
  }, 0);
}

