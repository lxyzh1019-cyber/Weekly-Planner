// Weekly-Planner — chore setup (redesign 2a, the "Options" tab).
//
// In the handoff drawing this tab is an archive of the three superseded
// directions — design-review material with no function in the app. It is the
// setup screen instead, because that is the thing the parent portal was
// actually missing: the chore pool, the goals, and the prices all lived
// scattered through a kid-shaped chore tab.
//
// Every pool edit goes through mrApplyEdits, so it is effective-dated and shows
// up in the rule log with a reason beside it. Changing what a chore is worth in
// March must not restate what January paid.

let coDraft = { icon: '🧺', label: '', due: '17:30', who: 'both', lane: 'chores' };

function coApply(pool, label) {
  // Dated from the week on screen, not from today: a rule edited on Wednesday
  // that took effect on Monday is the normal case, and mrRulesForWeek reads
  // a week by its Monday.
  return mrApplyEdits([{ path: 'chorePool', value: pool, label }],
    { reason: 'family_meeting', effectiveFrom: ctWeekKey });
}
function coPool() { return mrDeepCopy(mrRulesForWeek(ctWeekKey).chorePool || []); }

/* ── The chore pool ── */
function coPoolCard() {
  const rows = mrPoolRows(ctWeekKey).map(p => {
    const laneBtn = MR_LANES.map(l =>
      `<button type="button" class="co-lane ${p.lane === l.id ? 'on' : ''}"
        data-co-action="lane" data-id="${escapeAttr(p.id)}" data-lane="${l.id}"
        title="${l.paid ? 'Checked and paid' : 'Day-scoped, earns XP, never paid'}">${escapeHtml(l.label)}</button>`).join('');
    const whoBtn = [['both', 'Both'], ['jenn', 'Jenn'], ['jess', 'Jess']].map(([w, lbl]) =>
      `<button type="button" class="co-who ${p.who === w ? 'on' : ''}"
        data-co-action="who" data-id="${escapeAttr(p.id)}" data-who="${w}">${lbl}</button>`).join('');
    return `<div class="co-row">
      <input class="co-icon" value="${escapeAttr(p.icon)}" data-co-action="icon" data-id="${escapeAttr(p.id)}"
        title="One emoji" aria-label="Icon for ${escapeAttr(p.label)}">
      <input class="co-name" value="${escapeAttr(p.label)}" data-co-action="rename" data-id="${escapeAttr(p.id)}"
        aria-label="Name of ${escapeAttr(p.label)}">
      <input class="co-due" value="${escapeAttr(mrDueMinutes(p) != null ? mrFormatClock(mrDueMinutes(p)) : (p.due || ''))}" placeholder="7:30pm"
        data-co-action="due" data-id="${escapeAttr(p.id)}"
        title="A real clock time. Bedtime is 8:30pm and nothing can be due after it."
        aria-label="Due time for ${escapeAttr(p.label)}">
      <span class="co-lanes">${laneBtn}</span>
      <span class="co-whos">${whoBtn}</span>
      <button type="button" class="ck-navbtn" data-co-action="retire" data-id="${escapeAttr(p.id)}"
        aria-label="Retire ${escapeAttr(p.label)}">×</button>
    </div>`;
  }).join('');
  return `<div class="cp-sect">
    <div class="cp-cap">The chore pool — what a chore is</div>
    <div class="ck-sub">A row here says what a chore <b>is</b>: its name, its lane, when in the day it's due, and who it's for. It says nothing about <b>when</b> — a chore reaches a girl's day only when the weekly planner puts it there, which is why the week grid can grey out a day and mean it.</div>
    <div class="ck-sub">Pay comes from the grade you give, not from the chore, so there is no per-chore price to argue about. <b>8:30pm is bedtime and nothing can be due after it.</b> Only the <b>Chores</b> lane is checked and paid.</div>
    ${rows}
    <div class="co-row co-draft">
      <input class="co-icon" value="${escapeAttr(coDraft.icon)}" data-co-action="draft-icon"
        title="One emoji" aria-label="New chore icon">
      <input class="co-name" value="${escapeAttr(coDraft.label)}" placeholder="New chore — what is it?"
        data-co-action="draft-label" aria-label="New chore name">
      <input class="co-due" value="${escapeAttr(coDraft.due)}" placeholder="7:30pm"
        data-co-action="draft-due" aria-label="New chore due time">
      <span class="co-lanes">${MR_LANES.map(l =>
        `<button type="button" class="co-lane ${coDraft.lane === l.id ? 'on' : ''}"
          data-co-action="draft-lane" data-lane="${l.id}">${escapeHtml(l.label)}</button>`).join('')}</span>
      <span class="co-whos">${[['both', 'Both'], ['jenn', 'Jenn'], ['jess', 'Jess']].map(([w, lbl]) =>
        `<button type="button" class="co-who ${coDraft.who === w ? 'on' : ''}"
          data-co-action="draft-who" data-who="${w}">${lbl}</button>`).join('')}</span>
      <button type="button" class="ck-btn on" data-co-action="add">Add</button>
    </div>
    <div class="ck-sub">Retiring a chore leaves every past week exactly as it was — the grades already given still resolve and still paid.</div>
  </div>`;
}

/* ── Planner tags that point at nothing ──
   The one failure the pool/planner split can produce, surfaced rather than
   left to quietly cost a kid money. */
function coOrphanCard() {
  const orphans = mrUnresolvedTags(ctWeekKey);
  if (!orphans.length) return '';
  const rows = orphans.map(o => `<div class="cp-applied">
    <span class="cp-plan-name">${escapeHtml(o.tag)}<span class="ck-item-due">${CT_PROFILE_ICON[o.kid]} ${CT_DAYS[o.dayIdx]} — matches no chore in the pool</span></span>
    <button type="button" class="ck-btn" data-co-action="adopt" data-tag="${escapeAttr(o.tag)}">Add it to the pool</button>
  </div>`).join('');
  return `<div class="cp-sect">
    <div class="cp-cap ck-red">Planner asks for chores that aren't in the pool</div>
    <div class="ck-sub">These are on someone's day this week but match nothing here, so they can never be claimed, graded or paid. Add them, or take them off the day in the planner.</div>
    ${rows}</div>`;
}

/* ── Weekly goals, in their two halves ── */
function coGoalsCard() {
  const g = ctGetWeekGoals(ctWeekKey);
  const cards = ['jenn', 'jess'].map(k => {
    const goal = g[k];
    const legacy = goal && goal.points != null;
    const days = goal && goal.routineDays != null ? goal.routineDays : 0;
    const money = goal && goal.money != null ? goal.money : 0;
    const doneDays = ctRoutineDaysDone(ctWeekKey, k);
    const doneMoney = ctWeekMoney(ctWeekKey, k);
    const bar = (v, target, unit) => {
      const pct = target > 0 ? Math.min(100, Math.round(v / target * 100)) : 0;
      return `<div class="ctr-goalbar"><div class="ctr-goalfill" style="width:${pct}%"></div></div>
        <div class="ck-sub">${unit === '$' ? ckMoney(v) : v} of ${unit === '$' ? ckMoney(target) : target}${target > 0 ? ` · ${pct}%` : ' — not set'}</div>`;
    };
    const step = (kind, delta, label) =>
      `<button type="button" class="ck-navbtn" data-co-action="goal" data-kid="${k}" data-kind="${kind}" data-delta="${delta}" aria-label="${label}">${delta > 0 ? '+' : '–'}</button>`;
    return `<div class="ctr-card"><div class="ctr-card-head">
        <span class="ctr-card-icon">${CT_PROFILE_ICON[k]}</span>
        <span class="ctr-card-name">${k === 'jenn' ? 'Jenn' : 'Jess'}</span>
        <span class="ck-spacer"></span>
        <span class="ck-sub">${ctGetGoalBonus(ctWeekKey, k) ? '✅ +$1 banked' : '+$1 when both land'}</span>
      </div>
      <div class="ctr-card-body">
        ${legacy ? `<div class="ck-sub">This week carries an older single goal of <b>${goal.points} points</b>, and is left on the rule it was set under. Setting either half below replaces it.</div>` : ''}
        <div class="co-goalrow">${step('days', -1, 'Fewer clean days')}${step('days', 1, 'More clean days')}
          <span class="co-goallab">clean routine days</span></div>
        ${bar(doneDays, days, 'd')}
        <div class="co-goalrow">${step('money', -1, 'Lower money goal')}${step('money', 1, 'Higher money goal')}
          <span class="co-goallab">money for the week</span></div>
        ${bar(doneMoney, money, '$')}
      </div></div>`;
  }).join('');
  return `<div class="cp-sect"><div class="cp-cap">Weekly goals</div>
    <div class="ck-sub">One routine goal and one money goal each. <b>Both</b> have to land for the +$1 — a goal you can hit by ignoring half of it isn't a goal.</div>
    <div class="ctr-cards">${cards}</div></div>`;
}

/* ── Prices ── */
function coPriceCard() {
  const r = mrRulesForWeek(ctWeekKey);
  const c = r.chores || {};
  const grade = c.grade || {};
  const num = (label, path, value, hint) => `<div class="co-num">
    <span class="cp-plan-name">${escapeHtml(label)}<span class="ck-item-due">${escapeHtml(hint)}</span></span>
    <button type="button" class="ck-navbtn" data-co-action="num" data-path="${escapeAttr(path)}" data-delta="-1" aria-label="Lower ${escapeAttr(label)}">–</button>
    <span class="co-numv">${value}</span>
    <button type="button" class="ck-navbtn" data-co-action="num" data-path="${escapeAttr(path)}" data-delta="1" aria-label="Raise ${escapeAttr(label)}">+</button>
  </div>`;
  return `<div class="cp-sect"><div class="cp-cap">What a grade is worth</div>
    <div class="ck-sub">Every change here is dated from the week on screen and logged with a reason. Past weeks keep what they paid.</div>
    ${num('On time & to standard', 'chores.grade.3', ckMoney(grade[3]), 'the full grade')}
    ${num('To standard, late', 'chores.grade.2', ckMoney(grade[2]), 'or done after being asked')}
    ${num('Redone, then to standard', 'chores.grade.1', ckMoney(grade[1]), 'it took a second go')}
    ${num('Most a day can pay', 'chores.dailyCap', ckMoney(c.dailyCap), 'work past this becomes XP, not money')}
    ${num('Free chores a week', 'chores.freeChoresPerWeek', String(c.freeChoresPerWeek), 'these belong to the family; they land on her lowest-paying work')}
  </div>`;
}

/* ── The blunt instruments ── */
function coDangerCard() {
  return `<div class="cp-sect"><div class="cp-cap">Backup &amp; reset</div>
    <div class="ck-sub">A reset clears this week's ticks, grades and claims for both girls. Weeks already recorded at a meeting are not touched.</div>
    <div class="cp-settle-btns">
      <button type="button" class="ck-btn" data-co-action="export">Export a backup</button>
      <button type="button" class="ck-btn co-danger" data-co-action="clear">Reset this week</button>
    </div></div>`;
}

function coRenderOptions() {
  const wrap = document.getElementById('coWrap');
  if (!wrap) return;
  ctPrepareRead();
  if (!ctWeekKey) ctSetCurrentWeekFromPlanner();
  const info = ctWeekInfo();
  wrap.innerHTML = `<div class="ctr-tab">
    <div class="ctr-head">
      <div>
        <div class="cp-title">Chore setup</div>
        <div class="ck-sub">Editing against the week of ${MONTH_SHORT[info.mon.getMonth()]} ${info.mon.getDate()}. Days are set in the weekly planner, not here.</div>
      </div>
      <span class="ck-spacer"></span>
      <button type="button" class="ck-btn" data-co-action="to-chores">← Back to the queue</button>
    </div>
    ${coOrphanCard()}
    ${coPoolCard()}
    ${coGoalsCard()}
    ${coPriceCard()}
    ${coDangerCard()}
  </div>`;
}

/* ── Actions ── */
function coHandleClick(e) {
  const el = e.target.closest('[data-co-action]');
  if (!el || el.disabled || el.tagName === 'INPUT') return;
  const a = el.dataset.coAction, id = el.dataset.id;
  if (a === 'to-chores') { setParentTab('chores'); cpRenderChoreTab(); return; }
  if (a === 'lane')  return coSetField(id, 'lane', el.dataset.lane);
  if (a === 'who')   return coSetField(id, 'who', el.dataset.who);
  if (a === 'retire') return coRetire(id);
  if (a === 'draft-lane') { coDraft.lane = el.dataset.lane; return coRenderOptions(); }
  if (a === 'draft-who')  { coDraft.who = el.dataset.who; return coRenderOptions(); }
  if (a === 'add')    return coAdd();
  if (a === 'adopt')  return coAdopt(el.dataset.tag);
  if (a === 'goal')   return coBumpGoal(el.dataset.kid, el.dataset.kind, +el.dataset.delta);
  if (a === 'num')    return coBumpNumber(el.dataset.path, +el.dataset.delta);
  if (a === 'export') return ctExportBackup();
  if (a === 'clear')  return ctClearWeek().then(() => coRenderOptions());
}
/* Text inputs commit on change, not on every keystroke — a rule version per
   letter typed would make the log useless. */
function coHandleChange(e) {
  const el = e.target.closest('[data-co-action]');
  if (!el) return;
  const a = el.dataset.coAction;
  if (a === 'rename') coSetField(el.dataset.id, 'label', el.value);
  else if (a === 'icon') coSetField(el.dataset.id, 'icon', el.value);
  else if (a === 'draft-icon') coDraft.icon = el.value;
  else if (a === 'due') coSetDue(el.dataset.id, el.value);
  else if (a === 'draft-label') coDraft.label = el.value;
  else if (a === 'draft-due') coDraft.due = el.value;
}
function coSetField(id, field, value) {
  const pool = coPool();
  const row = pool.find(p => p.id === id);
  if (!row) return;
  const v = field === 'label' ? String(value || '').trim() : value;
  if (field === 'label' && !v) { showToast('A chore needs a name'); return coRenderOptions(); }
  if (row[field] === v) return;
  row[field] = v;
  coApply(pool, `${row.label} — ${field}`);
  coRenderOptions();
  cpRenderChoreTab();
}
function coSetDue(id, value) {
  const raw = String(value || '').trim();
  if (raw && !mrDueIsValid(raw)) {
    const mins = mrParseClock(raw);
    showToast(mins == null
      ? 'Give it a real time, like 7:30pm'
      : `Nothing can be due after bedtime (${mrFormatClock(MR_BEDTIME_MIN)})`);
    return coRenderOptions();
  }
  const pool = coPool();
  const row = pool.find(p => p.id === id);
  if (!row) return;
  const norm = raw ? mrFormatClock(mrParseClock(raw)) : null;
  if ((row.due || null) === norm) return;
  row.due = norm;
  coApply(pool, `${row.label} — due time`);
  coRenderOptions();
  cpRenderChoreTab();
}
function coNewId(label, pool) {
  const base = mrFoldName(label).slice(0, 16) || 'chore';
  let id = base, n = 2;
  while (pool.some(p => p.id === id)) id = base + n++;
  return id;
}
function coAdd() {
  const label = String(coDraft.label || '').trim();
  if (!label) { showToast('Give the chore a name'); return; }
  if (coDraft.due && !mrDueIsValid(coDraft.due)) {
    showToast(`Nothing can be due after bedtime (${mrFormatClock(MR_BEDTIME_MIN)})`);
    return;
  }
  const pool = coPool();
  if (pool.some(p => mrFoldName(p.label) === mrFoldName(label))) {
    showToast('That chore is already in the pool'); return;
  }
  pool.push({ id: coNewId(label, pool), icon: coDraft.icon || '🧺', label,
              lane: coDraft.lane, who: coDraft.who,
              due: coDraft.due ? mrFormatClock(mrParseClock(coDraft.due)) : null });
  coApply(pool, `added ${label}`);
  coDraft = { icon: '🧺', label: '', due: '17:30', who: 'both', lane: 'chores' };
  coRenderOptions();
  cpRenderChoreTab();
  showToast(`"${label}" is in the pool 🧽`);
}
/* Adopt a planner tag that matches nothing: keep the tag's own text as the id
   so the blocks already carrying it resolve immediately. */
function coAdopt(tag) {
  const pool = coPool();
  pool.push({ id: tag, icon: '🧺', label: tag, lane: 'chores', who: 'both', due: null });
  coApply(pool, `added ${tag} from the planner`);
  coRenderOptions();
  cpRenderChoreTab();
  showToast(`"${tag}" can be graded now ✓`);
}
async function coRetire(id) {
  const pool = coPool();
  const row = pool.find(p => p.id === id);
  if (!row) return;
  if (!(await showConfirm(`Retire "${row.label}"? Past weeks keep every grade it already earned.`,
    { danger: true, okLabel: 'Retire' }))) return;
  coApply(pool.filter(p => p.id !== id), `retired ${row.label}`);
  coRenderOptions();
  cpRenderChoreTab();
}
function coBumpGoal(kid, kind, delta) {
  const g = ctGetWeekGoals(ctWeekKey);
  const cur = g[kid];
  // Stepping either half converts an older points goal to the two-part shape.
  const base = (cur && cur.points == null) ? cur : { routineDays: null, money: null };
  const next = { routineDays: base.routineDays, money: base.money };
  if (kind === 'days') next.routineDays = Math.max(0, Math.min(7, (next.routineDays || 0) + delta));
  else next.money = Math.max(0, (next.money || 0) + delta);
  if (!next.routineDays && !next.money) { next.routineDays = null; next.money = null; }
  const out = { jenn: g.jenn, jess: g.jess };
  out[kid] = (next.routineDays == null && next.money == null) ? null : next;
  ctSetWeekGoals(ctWeekKey, out.jenn, out.jess);
  ctMaybeFireGoalBonus(ctWeekKey, 'jenn');
  ctMaybeFireGoalBonus(ctWeekKey, 'jess');
  saveAll();
  coRenderOptions();
}
function coBumpNumber(path, delta) {
  const cur = Number(mrGetPath(mrRulesForWeek(ctWeekKey), path)) || 0;
  const next = Math.max(0, cur + delta);
  if (next === cur) return;
  mrApplyEdits([{ path, value: next }], { reason: 'family_meeting', effectiveFrom: ctWeekKey });
  coRenderOptions();
  cpRenderChoreTab();
}
