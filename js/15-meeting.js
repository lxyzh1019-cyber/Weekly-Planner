// Weekly-Planner — meeting mode: guided 4-step weekly family meeting.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   2c / 1b / 2b — MEETING MODE: a guided 4-step weekly family meeting
   (Review → Celebrate → Confirm → Plan next week). Reuses the existing
   money commit (commitFamilyMeeting) and adds an undo window.
════════════════════════════════════════════════════════════════ */
const MM_STEPS = ['Review', 'Celebrate', 'Confirm', 'Plan next'];
let mmStep = 1;
let mmSelectedDay = null;
let mmUndo = null;

function openFamilyMeeting() {
  if (!isParent()) { showToast('Parents run the family meeting 🔒'); return; }
  ctEnsureShared();
  mmStep = 1; mmSelectedDay = null; mmUndo = null;
  renderMeetingMode();
  openSheet('familyMeetingOverlay');
}

// Day-confirm in the meeting persists to the real parent day-confirm store
// (state.shared.parentDayConfirm), shared with the Weekly Review tab. A meeting
// day is "confirmed" when it's confirmed for BOTH kids.
function mmDayKey(d) { return ctWeekInfo().keys[d]; }
function mmIsDayConfirmed(d) {
  const k = mmDayKey(d);
  const store = state.shared.parentDayConfirm || {};
  return !!((store.jenn || {})[k]) && !!((store.jess || {})[k]);
}
function mmToggleConfirmDay(d) {
  const k = mmDayKey(d);
  const next = !mmIsDayConfirmed(d);
  if (!state.shared.parentDayConfirm) state.shared.parentDayConfirm = {};
  ['jenn', 'jess'].forEach(kid => {
    if (!state.shared.parentDayConfirm[kid]) state.shared.parentDayConfirm[kid] = {};
    state.shared.parentDayConfirm[kid][k] = next;
  });
  saveAll();
  renderMeetingMode();
}
function mmGoStep(n) { mmStep = Math.max(1, Math.min(4, n)); if (mmStep !== 1) mmSelectedDay = mmSelectedDay; renderMeetingMode(); }

// % of a kid's tracked items (routines + all chores) done on a given day.
function mmDayPct(kid, dayIdx) {
  const rows = ctMatrixRows(kid);
  if (!rows.length) return 0;
  const done = rows.reduce((s, row) => s + (ctMatrixCellChecked(kid, dayIdx, row) ? 1 : 0), 0);
  return Math.round(done / rows.length * 100);
}
function mmWeekPct(kid) { let s = 0; for (let d = 0; d < 7; d++) s += mmDayPct(kid, d); return Math.round(s / 7); }

function renderMeetingMode() {
  ctPrepareRead();
  const wk = ctWeekKey || ctDateToKey(ctMondayOf(new Date()));
  const held = !!(state.shared.chore.meetingsHeld && state.shared.chore.meetingsHeld[wk]);
  const stepper = MM_STEPS.map((label, i) => {
    const n = i + 1;
    const cls = n === mmStep ? 'mm-step-cur' : (n < mmStep ? 'mm-step-done' : 'mm-step-up');
    return `<button type="button" class="mm-step ${cls}" onclick="mmGoStep(${n})">${n}·${label}</button>`;
  }).join('');

  let body;
  if (mmStep === 1) body = mmRenderReview(wk);
  else if (mmStep === 2) body = mmRenderCelebrate(wk);
  else if (mmStep === 3) body = mmRenderConfirm(wk, held);
  else body = mmRenderPlan(wk);

  const back = mmStep > 1 ? `<button type="button" class="pill-btn" onclick="mmGoStep(${mmStep - 1})">◀ Back</button>` : `<span></span>`;
  const next = mmStep < 4
    ? `<button type="button" class="btn-confirm" onclick="mmGoStep(${mmStep + 1})">Next ▶</button>`
    : `<button type="button" class="btn-confirm" onclick="closeSheet('familyMeetingOverlay')">🎉 Finish meeting</button>`;

  document.getElementById('familyMeetingBody').innerHTML =
    `<div class="mm-stepper">${stepper}</div><div class="mm-body">${body}</div><div class="mm-nav">${back}${next}</div>`;
}

/* Step 1 — Review: 1b grouped bar chart + day drill-in + meeting readiness. */
function mmRenderReview(wk) {
  const info = ctWeekInfo();
  const todayD = formatDayKey(todayKey());
  let bars = '';
  for (let d = 0; d < 7; d++) {
    const date = new Date(info.mon); date.setDate(info.mon.getDate() + d);
    const isToday = Math.round((date - todayD) / 864e5) === 0;
    const jp = mmDayPct('jenn', d), sp = mmDayPct('jess', d);
    const sel = mmSelectedDay === d ? ' mm-daygrp-sel' : '';
    bars += `<button type="button" class="mm-daygrp${sel}" onclick="mmSelectDay(${d})">
        <div class="mm-bars">
          <div class="mm-bar mm-bar-j" style="height:${jp}%"></div>
          <div class="mm-bar mm-bar-s" style="height:${sp}%"></div>
        </div>
        <div class="mm-daylabel${mmSelectedDay === d ? ' mm-daylabel-sel' : ''}">${DAY_SHORT[d]}${isToday ? ' ★' : ''}</div>
      </button>`;
  }
  const detail = mmSelectedDay != null ? mmRenderDayDetail(wk, mmSelectedDay) : `<div class="mm-hint">Tap a day to review each kid's items and confirm it.</div>`;
  const nConfirmed = [0,1,2,3,4,5,6].filter(mmIsDayConfirmed).length;
  const footer = `<div class="mm-ready">Meeting-ready: ${nConfirmed}/7 days confirmed · 🐥 Jenn ${mmWeekPct('jenn')}% · 🦊 Jess ${mmWeekPct('jess')}% of week done</div>`;
  return `<div class="mm-h">Review the week</div>
    <div class="mm-legend"><span><i class="mm-sw mm-bar-j"></i>Jenn</span><span><i class="mm-sw mm-bar-s"></i>Jess</span><span class="mm-legend-note">bars = % of that day's items done</span></div>
    <div class="mm-chart">${bars}</div>${detail}${footer}`;
}
function mmSelectDay(d) { mmSelectedDay = (mmSelectedDay === d ? null : d); renderMeetingMode(); }
function mmRenderDayDetail(wk, d) {
  const col = (kid) => {
    const rows = ctMatrixRows(kid);
    // Items are tappable so a parent can correct a kid's selection right here in
    // the meeting (parent-only overlay) instead of going to each kid's weekly view.
    const items = rows.map((row, i) => {
      const on = ctMatrixCellChecked(kid, d, row);
      return `<button type="button" class="mm-item ${on ? 'on' : ''}" onclick="mmToggleItem('${kid}',${d},${i})"
          role="checkbox" aria-checked="${on}" aria-label="${escapeAttr(row.label)} ${DAY_SHORT[d]}, ${kid === 'jenn' ? 'Jenn' : 'Jess'}"><span class="mm-item-box">${on ? '✓' : ''}</span>${row.icon ? row.icon + ' ' : ''}${escapeHtml(row.label)}</button>`;
    }).join('');
    const done = rows.filter(row => ctMatrixCellChecked(kid, d, row)).length;
    return `<div class="mm-detail-col"><div class="mm-detail-kid">${CT_PROFILE_ICON[kid]} ${kid === 'jenn' ? 'Jenn' : 'Jess'} <small>${done}/${rows.length} done</small></div>${items}</div>`;
  };
  const confirmed = mmIsDayConfirmed(d);
  return `<div class="mm-detail">
      <div class="mm-detail-cols">${col('jenn')}<div class="mm-detail-div"></div>${col('jess')}</div>
      <div class="mm-detail-editnote">Tap any item to check or uncheck it for that kid — chore money and goal bonuses update live.</div>
      <button type="button" class="mm-confirm-day ${confirmed ? 'confirmed' : ''}" onclick="mmToggleConfirmDay(${d})">${confirmed ? '✓ Confirmed (both kids)' : 'Confirm this day'}</button>
    </div>`;
}
// Parent taps a kid's routine/chore in the meeting review — mirrors the kid-view
// toggles (ctToggleMandatory/ctToggleOptional) but targets an explicit day `d`
// instead of the globally selected ctDay, then re-renders the meeting in place.
function mmToggleItem(kid, d, idx) {
  const wk = ctWeekKey || ctDateToKey(ctMondayOf(new Date()));
  const row = ctMatrixRows(kid)[idx];
  if (!row) return;
  if (row.kind === 'mandatory') {
    ctSetMandatory(wk, d, row.key, kid, !ctGetMandatory(wk, d, row.key, kid));
    ctMaybeFireGoalBonus(wk, kid);
    saveAll();
    renderMeetingMode();
  } else {
    const prev = ctGetOptional(wk, d, kid, row.key);
    ctSetOptional(wk, d, kid, row.key, !prev);
    const fired = !prev ? ctCheckGroupPayouts(wk, d, kid) : [];
    ctMaybeFireGoalBonus(wk, kid);
    saveAll();
    renderMeetingMode();
    ctCelebrateGroupPayouts(fired, 'familyMeetingOverlay');
  }
}

/* Step 2 — Celebrate: auto-collected wins + 2b planned-vs-done analytics. */
function mmRenderCelebrate(wk) {
  const info = ctWeekInfo();
  const wins = (kid) => {
    const mand = ctMandatoryPoints(wk, kid);
    const chores = [];
    ctGroupsForKid(kid).forEach(g => (g.choreIds || []).forEach(cn => { if ([0,1,2,3,4,5,6].some(d => ctGetOptional(wk, d, kid, cn))) chores.push(cn); }));
    const money = ctWeekMoney(wk, kid);
    const goal = ctGetGoalBonus(wk, kid);
    const w = [`✅ ${mand}/21 routines kept`];
    if (chores.length) w.push(`🧹 ${chores.length} chore${chores.length > 1 ? 's' : ''} done`);
    if (goal) w.push(`🎯 Weekly goal reached (+$1)`);
    if (money > 0) w.push(`💰 $${money.toFixed(2)} pocket money`);
    const moods = (getProfData(kid).dayMoods) || {};
    const moodList = info.keys.map(k => moods[k]).filter(Boolean);
    if (moodList.length) w.push(`💫 Vibe: ${moodList.join(' ')}`);
    return `<div class="mm-win"><div class="mm-win-kid">${CT_PROFILE_ICON[kid]} ${kid === 'jenn' ? 'Jenn' : 'Jess'}</div>${w.map(x => `<div class="mm-win-item">${x}</div>`).join('')}</div>`;
  };
  return `<div class="mm-h">Celebrate the wins</div>
    <div class="mm-wins">${wins('jenn')}${wins('jess')}</div>
    <div class="mm-h mm-h-sub">Planned vs done</div>
    <div class="mm-2b">${mm2b('jenn')}${mm2b('jess')}</div>
    <div class="mm-cap">Solid = done · dashed = planned.</div>`;
}
function mm2b(kid) {
  const info = ctWeekInfo();
  const CATS = [['school','📘 Learning'],['training','🏋️ Competitive Sports'],['competition','🏆 Competition'],['routine','📋 Routine'],['daily','🧹 Chores'],['free','🎮 Family/Free'],['active','🏃 Active']];
  const planned = {}, done = {};
  const acts = getAllActivities(kid);
  info.keys.forEach(key => {
    (getDayBlocksForProfile(key, kid) || []).forEach(b => {
      const act = acts.find(a => a.id === b.actId);
      const cat = act ? act.cat : 'custom';
      const m = b.durationMin || 0;
      planned[cat] = (planned[cat] || 0) + m;
      if (b.completed) done[cat] = (done[cat] || 0) + m;
    });
  });
  let totalP = 0, totalD = 0;
  Object.values(planned).forEach(v => totalP += v); Object.values(done).forEach(v => totalD += v);
  const maxMin = Math.max(60, ...CATS.map(([c]) => planned[c] || 0));
  const rows = CATS.filter(([c]) => (planned[c] || 0) > 0).map(([c, label]) => {
    const p = planned[c] || 0, dn = done[c] || 0;
    const pPct = Math.round(p / maxMin * 100), dPct = Math.round(dn / maxMin * 100);
    return `<div class="mm-2b-row"><span class="mm-2b-label">${label}</span>
        <span class="mm-2b-track"><span class="mm-2b-plan" style="width:${pPct}%"></span><span class="mm-2b-done" style="width:${dPct}%;background:${CAT_HEX[c] || '#888'}"></span></span>
        <span class="mm-2b-num">${fmtHrsMin(dn)} / ${fmtHrsMin(p)}</span></div>`;
  }).join('') || `<div class="ct-meta">No scheduled blocks this week.</div>`;
  return `<div class="mm-2b-kid"><div class="mm-win-kid">${CT_PROFILE_ICON[kid]} ${kid === 'jenn' ? 'Jenn' : 'Jess'} — ${fmtHrsMin(totalP)} planned · ${fmtHrsMin(totalD)} done</div>${rows}</div>`;
}

/* Step 3 — Confirm & record (reuses commitFamilyMeeting; offers an undo). */
function mmRenderConfirm(wk, held) {
  const rows = ['jenn','jess'].map(kid => {
    const prelim = ctWeekMoney(wk, kid);
    return `<div class="mm-pay-row"><span>${CT_PROFILE_ICON[kid]} ${kid === 'jenn' ? 'Jenn' : 'Jess'}</span><b>$${prelim.toFixed(2)}</b></div>`;
  }).join('');
  const alreadyHeld = held || !!(state.shared.chore.meetingsHeld && state.shared.chore.meetingsHeld[wk]);
  let action;
  if (mmUndo) {
    action = `<div class="mm-recorded">✅ Recorded — money credited &amp; market advanced to ${marketMonthLabel()}.</div>
      <button type="button" class="pill-btn danger" onclick="mmUndoRecord()">↩️ Undo (nothing is frozen yet)</button>`;
  } else if (alreadyHeld) {
    action = `<div class="mm-recorded">✅ This week was already recorded. Market is at ${marketMonthLabel()}.</div>`;
  } else {
    action = `<button type="button" class="btn-confirm" onclick="mmConfirmAndRecord()">✅ Confirm &amp; record the week</button>`;
  }
  return `<div class="mm-h">Confirm &amp; record</div>
    <div class="ct-meta">This <b>confirms</b> the week — it doesn't "pay". Group chore money already fired sticky as chores were done; recording credits each kid's total (max $${CT_MONEY_CAP}) to cash, adds a month of interest, matures due GICs and moves the market one month.</div>
    <div class="mm-pay">${rows}</div>${action}`;
}
function mmConfirmAndRecord() {
  const c = state.shared.chore;
  const wk = ctWeekKey || ctDateToKey(ctMondayOf(new Date()));
  if (c.meetingsHeld && c.meetingsHeld[wk]) { showToast('Already recorded this week'); return; }
  // Snapshot everything the commit mutates so the undo can fully reverse it.
  mmUndo = {
    wk,
    jenn: JSON.parse(JSON.stringify(ensureWallet('jenn'))),
    jess: JSON.parse(JSON.stringify(ensureWallet('jess'))),
    marketMonth: bankConfig().marketMonth,
    finalized: (c.finalizedWeeks && c.finalizedWeeks[wk]) ? JSON.parse(JSON.stringify(c.finalizedWeeks[wk])) : null,
  };
  const parts = commitFamilyMeeting(wk);
  renderMeetingMode();
  showToast(`💛 Recorded${parts.length ? ' · ' + parts.join(' · ') : ''} · market ${marketMonthLabel()}`);
}
function mmUndoRecord() {
  if (!mmUndo) return;
  const c = state.shared.chore; const wk = mmUndo.wk;
  getProfData('jenn').wallet = mmUndo.jenn;
  getProfData('jess').wallet = mmUndo.jess;
  bankConfig().marketMonth = mmUndo.marketMonth;
  if (mmUndo.finalized) c.finalizedWeeks[wk] = mmUndo.finalized; else if (c.finalizedWeeks) delete c.finalizedWeeks[wk];
  if (c.meetingsHeld) delete c.meetingsHeld[wk];
  mmUndo = null;
  saveAll();
  renderMeetingMode();
  showToast('↩️ Undone — nothing was recorded');
}

/* Step 4 — Plan next week: copy this week into next week as a template. */
function mmRenderPlan(wk) {
  return `<div class="mm-h">Plan next week</div>
    <div class="ct-meta">Copy this week's schedule into next week for both kids as a starting template, then jump there to tweak. Days that already have plans next week are left untouched.</div>
    <button type="button" class="btn-confirm" onclick="mmPlanNextWeek()">📋 Copy this week → next week</button>`;
}
function mmPlanNextWeek() {
  const info = ctWeekInfo();
  let copied = 0;
  ['jenn','jess'].forEach(kid => {
    info.keys.forEach(key => {
      const src = getDayBlocksForProfile(key, kid) || [];
      if (!src.length) return;
      const date = formatDayKey(key); const next = new Date(date); next.setDate(date.getDate() + 7);
      const nextKey = dateToLocalKey(next);
      if ((getDayBlocksForProfile(nextKey, kid) || []).length) return; // don't clobber existing plans
      const clone = src.map(b => ({ ...b, id: Date.now().toString(36) + Math.random().toString(36).slice(2,6), completed: false, confirmed: false, createdAt: Date.now(), updatedAt: Date.now() }));
      setDayBlocks(nextKey, clone, kid);
      copied += clone.length;
    });
  });
  saveAll();
  closeSheet('familyMeetingOverlay');
  weekOffset += 1;
  showScreen('week'); renderWeek();
  showToast(copied ? `📋 Copied ${copied} blocks into next week` : 'Next week already had plans — nothing copied');
}
// Core money commit for the weekly meeting (no UI): credit each kid's prelim
// pocket money to cash, advance the money world one month (interest + GIC
// maturities), step the market, and mark the week held. Returns summary parts.
function commitFamilyMeeting(wk) {
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.finalizedWeeks) c.finalizedWeeks = {};
  if (!c.finalizedWeeks[wk]) c.finalizedWeeks[wk] = {};
  if (!c.meetingsHeld) c.meetingsHeld = {};
  const parts = [];
  ['jenn', 'jess'].forEach(kid => {
    const w = ensureWallet(kid);
    if (c.finalizedWeeks[wk][kid] == null) {
      const prelim = ctWeekMoney(wk, kid);
      w.cash = money2(w.cash + prelim);
      c.finalizedWeeks[wk][kid] = prelim;
      if (prelim > 0) parts.push(`${kid === 'jenn' ? 'Jenn' : 'Jess'} +$${prelim.toFixed(2)}`);
    }
    const adv = moneyAdvanceMonth(kid);
    adv.matured.forEach(m => parts.push(`${kid === 'jenn' ? 'Jenn' : 'Jess'} GIC +$${m.payout.toFixed(2)}`));
  });
  bankConfig().marketMonth += 1;   // one shared market step per meeting
  c.meetingsHeld[wk] = true;
  saveAll();
  return parts;
}
