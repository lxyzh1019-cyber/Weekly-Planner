// Weekly-Planner — the parent's chore tab (redesign 2a, "Parent" frame).
//
// The other half of the same week. A kid's tab answers "what do I do now";
// this one answers "what is waiting on me, grade it, settle it" — which is why
// one shared wall of cards served neither.
//
// Nothing here records a week. Settle opens the family meeting, which stays the
// single place finalizedWeeks is written: two code paths agreeing to write the
// same ledger is the one thing this app cannot afford.

let cpView = 'day';   // 'day' | 'week'
let cpDay = 0;

/* The four answers a grown-up can give. $0 is here and absent from the kid's
   row, because recording a nought is a judgement only she makes. */
const CP_GRADES = [
  { g: 3, label: 'On time & to standard' },
  { g: 2, label: 'To standard, late' },
  { g: 1, label: 'Redone, then to standard' },
  { g: 0, label: 'Not done' },
];

function cpKid() { return parentViewing === 'jess' ? 'jess' : 'jenn'; }
function cpName(kid) { return kid === 'jenn' ? 'Jenn' : 'Jess'; }
function cpDayKey() { return mrWeekDayKeys(ctWeekKey)[cpDay]; }

/* ── Header ── */
function cpHeader() {
  const info = ctWeekInfo();
  const kid = cpKid();
  const weekLabel = `${MONTH_SHORT[info.mon.getMonth()]} ${info.mon.getDate()} – ${MONTH_SHORT[info.sun.getMonth()]} ${info.sun.getDate()}`;
  const pills = ['jenn', 'jess'].map(k => {
    const n = mrClaimQueue(ctWeekKey, k).length;
    return `<button type="button" class="cp-kid ${k === kid ? 'on' : ''}" data-cp-action="kid" data-kid="${k}">
      <span class="cp-kid-icon">${CT_PROFILE_ICON[k]}</span>
      <span><span class="cp-kid-name">${cpName(k)}</span>
      <span class="cp-kid-badge ${n ? 'wait' : ''}">${n ? `${n} waiting` : 'nothing waiting'}</span></span></button>`;
  }).join('');
  const date = new Date(info.mon); date.setDate(info.mon.getDate() + cpDay);
  const isToday = ctDateToKey(date) === todayKey();
  const stepper = cpView === 'day' ? `<span class="cp-stepper">
      <button type="button" class="ck-navbtn" data-cp-action="day-step" data-delta="-1" aria-label="Previous day">‹</button>
      <span class="cp-daylabel">${CT_DAYS[cpDay]} ${date.getDate()}${isToday ? ' <span class="ck-red">today</span>' : ''}</span>
      <button type="button" class="ck-navbtn" data-cp-action="day-step" data-delta="1" aria-label="Next day">›</button>
    </span>` : '';
  return `<div class="cp-head">
    <div class="cp-head-top">
      <span class="cp-title">${cpName(kid)}'s week — ${weekLabel}</span>
      <span class="ck-spacer"></span>
      <button type="button" class="ck-navbtn" data-cp-action="week-step" data-delta="-1" aria-label="Previous week">‹</button>
      <button type="button" class="ck-navbtn" data-cp-action="week-step" data-delta="1" aria-label="Next week">›</button>
    </div>
    <div class="cp-head-row">
      ${pills}
      <span class="cp-divider"></span>
      <span class="ck-seg">
        <button type="button" class="ck-segbtn ${cpView === 'day' ? 'on' : ''}" data-cp-action="view" data-view="day">Day</button>
        <button type="button" class="ck-segbtn ${cpView === 'week' ? 'on' : ''}" data-cp-action="view" data-view="week">Week</button>
      </span>
      ${stepper}
      <span class="ck-spacer"></span>
      <button type="button" class="ck-btn" data-cp-action="setup">Chore pool &amp; goals ›</button>
    </div>
  </div>`;
}

/* ── The settle card ──
   Live numbers, and one button that opens the meeting. It deliberately cannot
   record anything itself. */
function cpSettleCard() {
  const kid = cpKid();
  const b = mrWeekBreakdown(ctWeekKey, kid);
  const wk = mrChoreWeek(ctWeekKey, kid);
  const queue = mrClaimQueue(ctWeekKey, kid);
  const held = !!((state.shared.chore.meetingsHeld || {})[ctWeekKey]);
  const parts = [];
  if (b.chorePaid)   parts.push(`🧹 ${ckMoney(b.chorePaid)}`);
  if (b.learnPaid)   parts.push(`📘 ${ckMoney(b.learnPaid)}`);
  if (b.streakBonus) parts.push(`🔥 ${ckMoney(b.streakBonus)}`);
  if (b.compPaid)    parts.push(`🏆 ${ckMoney(b.compPaid)}`);
  if (b.fines.total) parts.push(`📦 −${ckMoney(b.fines.total)}`);
  return `<div class="cp-settle">
    <div class="cp-settle-top">
      <span class="ck-rail-total">${ckMoney(b.net)}</span>
      <span class="ck-sub">${parts.join(' · ') || 'nothing earned yet this week'}</span>
    </div>
    ${queue.length ? `<div class="ck-risk">${queue.length} chore${queue.length === 1 ? '' : 's'} claimed and waiting on you.</div>` : ''}
    <div class="ck-sub">${wk.freeLeft} free chore${wk.freeLeft === 1 ? '' : 's'} left · they land on her lowest-paying work${wk.pickWithdrawn ? ' — <b>choices withdrawn this week</b>, so they land on her highest instead' : ''}.</div>
    <div class="cp-settle-btns">
      <button type="button" class="ck-btn on" data-cp-action="settle">${held ? 'Re-open the meeting' : 'Settle at the meeting'}</button>
      <button type="button" class="ck-btn" data-cp-action="settle">Sunday meeting →</button>
      <span class="ck-sub">${held ? '✅ recorded — pocket money was credited' : 'nothing is recorded until the meeting'}</span>
    </div>
  </div>`;
}

/* ── Both girls, this day ── */
function cpDayCards() {
  const cards = ['jenn', 'jess'].map(k => {
    const chores = mrChoreWeek(ctWeekKey, k);
    const day = chores.days[cpDay] || { paid: 0 };
    const waiting = mrClaimQueue(ctWeekKey, k).filter(q => q.dayIdx === cpDay).length;
    const routines = CT_SESSIONS.filter(s => ctGetMandatory(ctWeekKey, cpDay, s, k)).length;
    const sick = mrIsSick(k, ctWeekKey, cpDay);
    return `<button type="button" class="cp-daycard ${k === cpKid() ? 'on' : ''}" data-cp-action="kid" data-kid="${k}">
      <span class="cp-daycard-top">${CT_PROFILE_ICON[k]} <b>${cpName(k)}</b>
        <span class="ck-spacer"></span><span class="ck-hist-total">${ckMoney(day.paid)}</span></span>
      <span class="ck-pill ${waiting ? '' : 'cp-pill-quiet'}">${waiting ? `${waiting} waiting` : 'all answered'}</span>
      <span class="ck-sub">${routines}/3 routines closed${sick ? ' · 🤒 sick day' : ''}</span>
    </button>`;
  }).join('');
  return `<div class="cp-sect"><div class="cp-cap">Both girls, this day</div>
    <div class="cp-daycards">${cards}</div></div>`;
}

/* ── Waiting on you: the claim queue ──
   Every row carries what she said and the four answers a grown-up can give. */
function cpQueue() {
  const kid = cpKid();
  const rows = mrClaimQueue(ctWeekKey, kid);
  if (!rows.length) {
    return `<div class="cp-sect"><div class="cp-cap">Waiting on you</div>
      <div class="ck-empty">✅ Nothing waiting. Every chore she has answered for this week has a grade on it.</div></div>`;
  }
  const r = mrRulesForWeek(ctWeekKey);
  const body = rows.map(q => {
    const word = (CK_QUALITY.find(x => x.g === q.claim) || {}).word || '';
    const name = q.row ? q.row.label : q.choreId;
    const due = q.row ? mrDueLabel(q.row) : '—';
    return `<div class="cp-qrow">
      <div class="cp-qtext">
        <div class="cp-qname">${escapeHtml(name)}</div>
        <div class="ck-sub">${CT_DAYS[q.dayIdx]} · due ${escapeHtml(due)}</div>
        <div class="ck-risk cp-qclaim">She said: ${escapeHtml(word.toLowerCase())} (${ckMoney(ckGradePay(r, q.claim))})</div>
      </div>
      <div class="cp-gradebar">${CP_GRADES.map(x => `
        <button type="button" class="cp-gbtn ${q.claim === x.g ? 'agrees' : ''}"
          data-cp-action="grade" data-chore-id="${escapeAttr(q.choreId)}" data-day="${q.dayIdx}" data-grade="${x.g}"
          title="${escapeAttr(x.label)}">${ckMoney(ckGradePay(r, x.g))}</button>`).join('')}</div>
    </div>`;
  }).join('');
  return `<div class="cp-sect"><div class="cp-cap">Waiting on you</div>${body}</div>`;
}

/* ── Already graded: still changeable ── */
function cpGraded() {
  const kid = cpKid();
  const r = mrRulesForWeek(ctWeekKey);
  const e = mrEnsureEarnings(kid, ctWeekKey);
  const graded = Object.keys(e.chores[String(cpDay)] || {});
  if (!graded.length) return '';
  const wk = mrChoreWeek(ctWeekKey, kid);
  const freeIds = new Set(wk.freeUsed.filter(f => f.dayIdx === cpDay).map(f => f.choreId));
  const body = graded.map(id => {
    const g = mrGetChoreGrade(kid, ctWeekKey, cpDay, id);
    const claim = mrGetClaim(kid, ctWeekKey, cpDay, id);
    const row = mrPoolRow(id, ctWeekKey);
    const agree = claim
      ? (claim === g ? 'you agreed with her' : `she said ${ckMoney(ckGradePay(r, claim))}`)
      : 'she never claimed it';
    return `<div class="cp-qrow cp-qrow-done">
      <div class="cp-qtext">
        <div class="cp-qname">${escapeHtml(row ? row.label : id)}</div>
        <div class="ck-sub">${escapeHtml((CP_GRADES.find(x => x.g === g) || {}).label || '')} · ${escapeHtml(agree)}</div>
      </div>
      <span class="ck-chore-pay ck-green">${freeIds.has(id) ? 'free' : ckMoney(ckGradePay(r, g))}</span>
      <div class="cp-gradebar cp-gradebar-sm">${CP_GRADES.map(x => `
        <button type="button" class="cp-gbtn ${g === x.g ? 'on' : ''}"
          data-cp-action="grade" data-chore-id="${escapeAttr(id)}" data-day="${cpDay}" data-grade="${x.g}"
          title="${escapeAttr(x.label)}">${ckMoney(ckGradePay(r, x.g))}</button>`).join('')}</div>
    </div>`;
  }).join('');
  return `<div class="cp-sect"><div class="cp-cap">Already graded</div>${body}</div>`;
}

/* ── This day's planner ──
   The scheduling entry point. The pool says what a chore is; this is where it
   gets put on a day, so a grown-up never has to leave the portal to set up the
   work she is about to grade. */
function cpPlanner() {
  const kid = cpKid();
  const day = mrChoresForDay(kid, ctWeekKey, cpDay);
  const on = new Set(day.rows.filter(x => x.scheduled).map(x => x.row.id));
  const pool = mrPoolRows(ctWeekKey)
    .filter(p => p.lane === 'chores' && (p.who === 'both' || p.who === kid));
  const rows = pool.map(p => `<div class="cp-plan ${on.has(p.id) ? 'on' : ''}">
      <span class="cp-plan-name">${escapeHtml(p.label)}<span class="ck-item-due">due ${escapeHtml(mrDueLabel(p))}</span></span>
      <button type="button" class="ck-btn ${on.has(p.id) ? 'on' : ''}"
        data-cp-action="${on.has(p.id) ? 'unschedule' : 'schedule'}" data-chore-id="${escapeAttr(p.id)}">
        ${on.has(p.id) ? 'On the day' : 'Put on the day'}</button>
    </div>`).join('');
  const warn = day.unresolved.length
    ? `<div class="ck-warn">The planner asks for ${escapeHtml(day.unresolved.join(', '))} on this day, which matches nothing in the chore pool — it can never be graded or paid until that is fixed.</div>`
    : '';
  return `<div class="cp-sect"><div class="cp-cap">This day's planner</div>
    <div class="ck-sub">A chore reaches her day only from here. The pool says what a chore is; the planner says when.</div>
    ${warn}${rows || '<div class="ck-empty">No chores in the pool for her yet.</div>'}</div>`;
}

/* ── Attitude, sick days, fines ── */
function cpAttitudeSick() {
  const kid = cpKid();
  const a = mrGetAttitude(kid, ctWeekKey, cpDay);
  const btns = [1, 2, 3, 4, 5].map(n =>
    `<button type="button" class="ck-rate ${a.parent === n ? 'on' : ''}"
      data-cp-action="attitude" data-n="${n}">${n}</button>`).join('');
  const said = a.self ? `She rated herself ${a.self}/5.` : 'She has not rated herself yet.';
  const gap = (a.self && a.parent)
    ? (a.self === a.parent ? ' You agreed.' : ` You are ${Math.abs(a.self - a.parent)} apart — worth the conversation.`)
    : '';
  const sick = CT_DAYS.map((d, i) => `<button type="button" class="cp-sick ${mrIsSick(kid, ctWeekKey, i) ? 'on' : ''}"
      data-cp-action="sick" data-day="${i}">${d}${mrIsSick(kid, ctWeekKey, i) ? ' 🤒' : ''}</button>`).join('');
  return `<div class="cp-sect">
    <div class="cp-cap">Training attitude — XP, never money</div>
    <div class="ck-sub">${escapeHtml(said)}${escapeHtml(gap)} A session only counts once you have both answered.</div>
    <div class="ck-raterow">${btns}</div>
    <div class="cp-cap cp-cap-gap">Sick day — pauses the streak, doesn't break it</div>
    <div class="cp-sickrow">${sick}</div>
  </div>`;
}

function cpFines() {
  const kid = cpKid();
  const r = mrRulesForWeek(ctWeekKey);
  const chores = mrChoreWeek(ctWeekKey, kid);
  const fw = mrFinesWeek(ctWeekKey, kid, chores.days.map(d => d.paid));
  const items = ((r.fines || {}).items || []).filter(f => f.id !== 'box_repeat');
  const btns = items.map(f => `<button type="button" class="cp-fine" data-cp-action="fine" data-fine="${escapeAttr(f.id)}">
      ${escapeHtml(f.label)} <b>−${ckMoney(f.amount)}</b></button>`).join('');
  const names = {}; ((r.fines || {}).items || []).forEach(i => { names[i.id] = i.label; });
  const applied = mrFines(kid).filter(f => mrWeekDayKeys(ctWeekKey).includes(f.dayKey)).slice(-6).reverse()
    .map(f => `<div class="cp-applied">
      <span class="cp-plan-name">${escapeHtml(names[f.itemId] || f.itemId)}<span class="ck-item-due">${escapeHtml(f.dayKey)}</span></span>
      <span class="ck-red">−${ckMoney(1)}</span>
      <button type="button" class="ck-navbtn" data-cp-action="unfine" data-fine-id="${escapeAttr(f.id)}" aria-label="Take this fine back">×</button>
    </div>`).join('');
  return `<div class="cp-sect">
    <div class="cp-cap">Fines — flat, applied to ${CT_DAYS[cpDay]}</div>
    <div class="ck-sub">Leaving something out isn't here — that goes in the box first. Fines this week: <b>−${ckMoney(fw.total)}</b>, and a day never goes below $0.</div>
    ${btns}
    ${applied ? `<div class="cp-cap cp-cap-gap">Applied this week</div>${applied}` : ''}
  </div>`;
}

/* ── Week view ── */
function cpDualGrid() {
  const info = ctWeekInfo();
  const pool = mrPoolRows(ctWeekKey).filter(p => p.lane === 'chores');
  const r = mrRulesForWeek(ctWeekKey);
  const sched = {};
  ['jenn', 'jess'].forEach(k => {
    sched[k] = [];
    for (let d = 0; d < 7; d++) {
      const m = {};
      mrChoresForDay(k, ctWeekKey, d).rows.forEach(x => { m[x.row.id] = true; });
      sched[k].push(m);
    }
  });
  let head = '<div class="cp-grid-row cp-grid-head"><div></div>';
  for (let d = 0; d < 7; d++) {
    const date = new Date(info.mon); date.setDate(info.mon.getDate() + d);
    head += `<div class="ck-grid-dh">${DAY_SHORT[d]}<small>${date.getDate()}</small></div>`;
  }
  head += '<div class="ck-grid-dh">wk</div></div>';

  const stripe = (k, p, d) => {
    if (!sched[k][d][p.id]) return `<span class="cp-stripe off" title="${cpName(k)} — not on the plan"></span>`;
    const g = mrGetChoreGrade(k, ctWeekKey, d, p.id);
    if (g > 0) return `<span class="cp-stripe done" title="${cpName(k)} — graded">${ckMoney(ckGradePay(r, g))}</span>`;
    const c = mrGetClaim(k, ctWeekKey, d, p.id);
    if (c > 0) return `<span class="cp-stripe claimed" title="${cpName(k)} — claimed, waiting">?</span>`;
    return `<span class="cp-stripe" title="${cpName(k)} — nothing claimed">·</span>`;
  };
  const rows = pool.map(p => {
    let cells = '';
    for (let d = 0; d < 7; d++) {
      cells += `<div class="cp-cellpair">${stripe('jenn', p, d)}${stripe('jess', p, d)}</div>`;
    }
    const tot = k => {
      let m = 0;
      for (let d = 0; d < 7; d++) { const g = mrGetChoreGrade(k, ctWeekKey, d, p.id); if (g > 0) m += ckGradePay(r, g); }
      return m;
    };
    return `<div class="cp-grid-row"><div class="ck-grid-label">${escapeHtml(p.label)}</div>${cells}
      <div class="cp-grid-tot"><span>${ckMoney(tot('jenn'))}</span><span>${ckMoney(tot('jess'))}</span></div></div>`;
  }).join('');
  return `<div class="cp-sect"><div class="cp-cap">Both kids, same week</div>
    <div class="ck-sub">Top stripe ${CT_PROFILE_ICON.jenn} Jenn · bottom ${CT_PROFILE_ICON.jess} Jess. Grey means the planner never put it on that day.</div>
    <div class="ck-sub">The week column is what each chore was <b>graded</b> at. It is not what she is paid — the free chores and the daily ceiling come off afterwards, and the payout sheet below is the number that settles.</div>
    <div class="ck-gridwrap"><div class="cp-grid">${head}${rows}</div></div></div>`;
}

/* ── The payout sheet: read-only on purpose ──
   Every line that made the number. Change a grade in Day view and this follows,
   because both read mrWeekBreakdown rather than keeping their own tally. */
function cpPayout() {
  const kid = cpKid();
  const b = mrWeekBreakdown(ctWeekKey, kid);
  const lines = [];
  const push = (name, detail, amount, cls) => lines.push({ name, detail, amount, cls });
  push('Household chores', `${b.chores.freeUsed.length} free · ${b.chores.overflowChores} past the cap`, ckMoney(b.chorePaid), 'ck-green');
  if (b.learnPaid)   push('Learning', 'whole bundles only', ckMoney(b.learnPaid), 'ck-green');
  if (b.streakBonus) push('Streak', `${b.streak.days} clean days`, ckMoney(b.streakBonus), 'ck-green');
  if (b.compPaid)    push('Competition', 'from the results sheet', ckMoney(b.compPaid), 'ck-green');
  if (b.fines.total) push('Fines', 'floored at $0 each day', '−' + ckMoney(b.fines.total), 'ck-red');
  Object.keys(b.honesty.voidedChannels || {}).forEach(ch =>
    push(`${ch} voided`, 'honesty ladder, step 2', ckMoney(0), 'ck-red'));
  Object.keys(b.overrides || {}).forEach(ch =>
    push(`${ch} adjusted`, escapeHtml(mrReasonLabel((b.overrides[ch] || {}).reason) || 'agreed at the meeting'),
      ckMoney(b.overrides[ch].value), 'ck-amber'));

  const body = lines.map(l => `<div class="cp-payline">
    <span class="cp-payname">${escapeHtml(l.name)}</span><span class="cp-paydots"></span>
    <span class="ck-sub">${l.detail}</span>
    <span class="cp-payamt ${l.cls}">${l.amount}</span></div>`).join('');
  return `<div class="cp-sect"><div class="cp-cap">${cpName(kid)} — the payout sheet</div>
    <div class="ck-sub">Every line that made the number. Change a grade in Day view and this follows. Adjustments are made at the meeting, where they get a reason recorded beside them.</div>
    <div class="cp-payout">${body}
      <div class="cp-paytotal"><span>${cpName(kid)}</span><span class="ck-hist-total">${ckMoney(b.net)}</span></div>
    </div></div>`;
}

/* ── Competition results ──
   A parent-recorded channel, and the only one whose money comes from a sheet
   of paper rather than from anything the app watched happen. It lives beside
   the payout because that is where its money shows up. */
function cpCompetition() {
  const kid = cpKid();
  const cw = mrCompetitionWeek(ctWeekKey, kid);
  const rows = cw.entries.length ? cw.entries.map(c => {
    const bits = [];
    if (c.points) bits.push(`${c.points} pts`);
    if ((c.placement || {}).group) bits.push(`${c.placement.group} in group`);
    if ((c.placement || {}).overall) bits.push(`${c.placement.overall} overall`);
    if (c.qualified) bits.push('qualified');
    if (c.personalBest) bits.push('PB ⭐');
    const d = formatDayKey(c.dayKey);
    return `<div class="cp-applied">
      <span class="cp-plan-name">${escapeHtml(c.name || c.sport)}<span class="ck-item-due">${escapeHtml(c.sport)} · ${MONTH_SHORT[d.getMonth()]} ${d.getDate()} · ${escapeHtml(bits.join(' · ') || '—')}</span></span>
      <span class="ck-green">${ckMoney(c.awarded || 0)}</span>
      <button type="button" class="ck-navbtn" data-ct-action="del-comp" data-comp-id="${escapeAttr(c.id)}" aria-label="Remove result">×</button>
    </div>`;
  }).join('') : '<div class="ck-sub">No results this week.</div>';
  return `<div class="cp-sect"><div class="cp-cap">Competition — week: ${ckMoney(cw.paid)}</div>
    <div class="ck-sub">The official results sheet decides, and a result pays in the week it happened — one dated outside this week won't show here.</div>
    ${rows}
    <button type="button" class="ck-btn" data-ct-action="add-comp">🏆 Record a result</button></div>`;
}

/* ── Every week ever recorded ──
   The authoritative paid ledger, unbounded, with running totals. Frozen when
   it was agreed, so changing a price today never rewrites what a week paid. */
function cpMoneyHistory() {
  ctEnsureShared();
  const fw = state.shared.chore.finalizedWeeks || {};
  const keys = Object.keys(fw).sort();
  if (!keys.length) {
    return `<div class="cp-sect"><div class="cp-cap">Recorded weeks</div>
      <div class="ck-sub">Nothing recorded yet. A week lands here once you tap “Confirm &amp; record” for it in the family meeting.</div></div>`;
  }
  let jRun = 0, kRun = 0, rows = '';
  keys.forEach(wk => {
    const e = fw[wk] || {};
    const j = Number(e.jenn) || 0, k = Number(e.jess) || 0;
    if (e.jenn != null) jRun = money2(jRun + j);
    if (e.jess != null) kRun = money2(kRun + k);
    const d = formatDayKey(wk);
    rows += `<tr><td>${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}</td>
      <td>${e.jenn != null ? ckMoney(j) : '—'}</td><td>${ckMoney(jRun)}</td>
      <td>${e.jess != null ? ckMoney(k) : '—'}</td><td>${ckMoney(kRun)}</td></tr>`;
  });
  return `<div class="cp-sect"><div class="cp-cap">Recorded weeks · ${keys.length}</div>
    <div class="ck-sub">Every week recorded at a family meeting, oldest first, with running totals. Each week's breakdown is frozen when it was agreed.</div>
    <div class="ck-gridwrap"><table class="wf-analytics-table">
      <thead><tr><th>Week</th><th>${CT_PROFILE_ICON.jenn} Jenn</th><th>total</th><th>${CT_PROFILE_ICON.jess} Jess</th><th>total</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>`;
}

/* ── Spot-check, honesty, box ── */
function cpSundayTools() {
  const kid = cpKid();
  const r = mrRulesForWeek(ctWeekKey);
  const eff = mrHonestyEffect(kid, ctWeekKey);
  const steps = ((r.honesty || {}).steps || []).map(s => `<div class="cp-step ${eff.step === s.step ? 'on' : ''}">
      <span class="cp-stepn">${s.step}</span><span class="cp-plan-name">${escapeHtml(s.label)}</span></div>`).join('');
  const boxed = mrBoxItems(kid).filter(b => !b.releasedAt);
  const box = boxed.length
    ? boxed.map(b => `<div class="cp-applied">
        <span class="cp-plan-name">📦 ${escapeHtml(b.label)}${b.repeat ? ' <span class="ck-pill ck-pill-red">repeat −$1</span>' : ''}</span>
        <button type="button" class="ck-btn" data-ct-action="release-box" data-box-id="${escapeAttr(b.id)}">Release early</button>
      </div>`).join('')
    : '<div class="ck-sub">Box is empty.</div>';
  return `<div class="cp-sect">
    <div class="cp-cap">Sunday spot-check</div>
    <div class="ck-sub">${(r.learning || {}).sundayCheckCount} logged items at random. Anything she can't answer for goes back to unpaid and gets done again.</div>
    <button type="button" class="ck-btn" data-ct-action="sunday-check">🔍 Run the spot-check</button>

    <div class="cp-cap cp-cap-gap">Honesty ladder — <span class="ck-red">${eff.step ? `at step ${eff.step}` : 'clean this week'}</span></div>
    <div class="ck-sub">A false claim is voided on the spot. The step is derived from the strikes on record this week and resets Sunday, so it escalates without anyone having to remember where they were.</div>
    ${steps}
    <button type="button" class="ck-btn" data-ct-action="honesty">⚖️ Record a strike</button>

    <div class="cp-cap cp-cap-gap">Sunday Box</div>
    <div class="ck-sub">Being in the box is the consequence — money only enters on the second time for the same thing, and that shows in her fines automatically. Everything comes back at the meeting.</div>
    ${box}
    <button type="button" class="ck-btn" data-ct-action="box-item">📦 Box something</button>
  </div>`;
}

/* ── The tab ── */
function cpRenderChoreTab() {
  const wrap = document.getElementById('cpWrap');
  if (!wrap) return;
  ctPrepareRead();
  if (!ctWeekKey) ctSetCurrentWeekFromPlanner();
  ctParentKid = cpKid();       // keep the shared ct* helpers pointed at this kid
  const body = cpView === 'day'
    ? `${cpDayCards()}<div class="cp-cols">
        <div>${cpQueue()}${cpGraded()}${cpFines()}</div>
        <div>${cpPlanner()}${cpAttitudeSick()}</div>
      </div>`
    : `${cpDualGrid()}${cpPayout()}${cpCompetition()}${cpSundayTools()}${cpMoneyHistory()}`;
  wrap.innerHTML = `<div class="cp-tab">${cpHeader()}${cpSettleCard()}${body}</div>`;
}

/* ── Actions ── */
function cpHandleClick(e) {
  const el = e.target.closest('[data-cp-action]');
  if (!el || el.disabled) return;
  const a = el.dataset.cpAction;
  if (a === 'kid') { parentViewing = el.dataset.kid; renderParentHome(); }
  else if (a === 'view') { cpView = el.dataset.view === 'week' ? 'week' : 'day'; cpRenderChoreTab(); }
  else if (a === 'day-step') { cpDay = Math.max(0, Math.min(6, cpDay + (+el.dataset.delta))); cpRenderChoreTab(); }
  else if (a === 'week-step') { ctChangeWeekParent(+el.dataset.delta); }
  // The setup screen is its own tab. Until it exists, say so rather than
  // switching to a panel that isn't there and blanking the portal.
  else if (a === 'setup') {
    if (document.getElementById('ptab-options')) setParentTab('options');
    else showToast('Chore pool & goals — coming to its own tab');
  }
  else if (a === 'settle') { openFamilyMeeting(); }
  else if (a === 'grade') cpGrade(el.dataset.choreId, +el.dataset.day, +el.dataset.grade);
  else if (a === 'schedule') cpSchedule(el.dataset.choreId, true);
  else if (a === 'unschedule') cpSchedule(el.dataset.choreId, false);
  else if (a === 'attitude') cpRateParent(+el.dataset.n);
  else if (a === 'sick') { mrToggleSick(cpKid(), ctWeekKey, +el.dataset.day); cpRenderChoreTab(); }
  else if (a === 'fine') { mrAddFine(cpKid(), el.dataset.fine, cpDayKey()); cpRenderChoreTab(); }
  else if (a === 'unfine') { mrRemoveFine(cpKid(), el.dataset.fineId); cpRenderChoreTab(); }
}
/* The chore tab's own delegated handler covers the shared ct-actions (box,
   honesty, spot-check) that this panel reuses verbatim. */
function cpHandleCtClick(e) {
  if (!e.target.closest('[data-ct-action]')) return;
  ctHandleWrapClick(e);
}
function ctChangeWeekParent(delta) {
  const mon = formatDayKey(ctWeekKey || ctDateToKey(ctMondayOf(new Date())));
  mon.setDate(mon.getDate() + delta * 7);
  ctWeekKey = ctDateToKey(mon);
  cpDay = 0;
  renderParentHome();
}
function cpGrade(choreId, dayIdx, grade) {
  const kid = cpKid();
  const cur = mrGetChoreGrade(kid, ctWeekKey, dayIdx, choreId);
  // Tapping the grade already on a row takes it back off, which is how a
  // mis-tap is undone without a separate control.
  if (mrSetChoreGrade(kid, ctWeekKey, dayIdx, choreId, cur === grade ? 0 : grade)) {
    cpRenderChoreTab();
    renderMeetingHub();
  }
}
function cpRateParent(n) {
  const kid = cpKid();
  const cur = mrGetAttitude(kid, ctWeekKey, cpDay).parent;
  if (mrSetAttitude(kid, ctWeekKey, cpDay, 'parent', cur === n ? 0 : n)) cpRenderChoreTab();
}
/* Put a chore on a day, or take it off. Tags are written by pool id so every
   new one resolves exactly; the legacy label path stays only for old data. */
function cpSchedule(choreId, on) {
  const kid = cpKid();
  const dayKey = cpDayKey();
  const blocks = (getDayBlocks(dayKey, kid) || []).slice();
  const row = mrPoolRow(choreId, ctWeekKey);
  let host = blocks.find(b => b.actId === 'chores');
  if (on) {
    if (!host) {
      // Start it half an hour before it's due, or late afternoon if it has no
      // clock time — a block has to sit somewhere on the day to exist.
      const due = mrDueMinutes(row);
      host = { id: 'ch-' + Date.now().toString(36), actId: 'chores',
               startMin: Math.max(0, (due != null ? due : 17 * 60) - 30),
               durationMin: 30, choreTags: [], checklistState: {} };
      blocks.push(host);
    }
    if (!Array.isArray(host.choreTags)) host.choreTags = [];
    if (!host.choreTags.includes(choreId)) host.choreTags.push(choreId);
  } else {
    blocks.forEach(b => {
      if (b.actId !== 'chores' || !Array.isArray(b.choreTags)) return;
      b.choreTags = b.choreTags.filter(t => mrPoolRowForTag(t, ctWeekKey)?.id !== choreId);
    });
  }
  // A House-Chore block with no chores on it is litter on the day.
  const kept = blocks.filter(b => b.actId !== 'chores' || (b.choreTags || []).length);
  setDayBlocks(dayKey, kept, kid);
  cpRenderChoreTab();
  showToast(on ? `On ${CT_DAYS[cpDay]} ✓` : `Taken off ${CT_DAYS[cpDay]}`);
}
