// Weekly-Planner — meeting mode: guided 4-step weekly family meeting.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   2c / 1b / 2b — MEETING MODE: a guided 4-step weekly family meeting
   (Review → Celebrate → Confirm → Plan next week). Reuses the existing
   money commit (commitFamilyMeeting) and adds an undo window.
════════════════════════════════════════════════════════════════ */
/* Five steps since the money system was redesigned. The old single "Confirm"
   step did two different jobs badly: it agreed the week AND moved the money in
   one press, which meant a correction after the fact had to be unwound. Steps
   3 and 4 (js/23-money-meeting.js) separate them — 3 agrees the numbers, 4
   decides where they go and is the only thing that moves money. */
const MM_STEPS = ['Review', 'Celebrate', 'What I earned', 'What I do with it', 'Plan next'];
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
function mmGoStep(n) { mmStep = Math.max(1, Math.min(MM_STEPS.length, n)); renderMeetingMode(); }

/* ── What Step 1 reviews ───────────────────────────────────────────
   The two halves of a day are stored in two different places, on purpose:

     ROUTINES (Morning / Afternoon / Evening) are the parent's call and pay no
     money. They live in the legacy per-session store (ctGetMandatory), which
     is also exactly what mrStreakDayDone reads for the clean-day streak — so
     ticking one here is what moves the streak channel.

     CHORES come from the chore pool via the planner (mrChoresForDay) and are
     what the money engine totals. A parent tapping one in the meeting IS the
     grading act, so a tap writes a GRADE (mrSetChoreGrade), the same value
     cpQueue writes from the portal.

   Before this, Step 1 rendered the retired chore *groups* and wrote to
   ctSetOptional — a store nothing downstream reads any more. That is why a
   week reviewed at the table still showed $0 of "Jobs around the house" on
   Step 3. */
function mmReviewRows(kid, dayIdx) {
  const wk = mmWeekKey();
  const rows = CT_SESSIONS.map(s => ({
    kind: 'routine', key: s, label: s, icon: CT_SESSION_ICONS[s] || '📋',
    on: !!ctGetMandatory(wk, dayIdx, s, kid),
    claim: 0, pays: false,
  }));
  const r = mrRulesForWeek(wk);
  mrChoresForDay(kid, wk, dayIdx).rows.forEach(({ row }) => {
    if (!mrLanePays(row.lane)) return;   // 'own'/'helping' never pay — not money to agree
    const grade = mrGetChoreGrade(kid, wk, dayIdx, row.id);
    rows.push({
      kind: 'chore', key: row.id, label: row.label, icon: row.icon || '🧺',
      on: grade > 0, grade, claim: mrGetClaim(kid, wk, dayIdx, row.id),
      pays: true, pay: ckGradePay(r, grade || 3),
    });
  });
  return rows;
}
function mmWeekKey() { return ctWeekKey || ctThisWeekKey(); }

// % of a kid's tracked items (routines + priced chores) settled on a given day.
function mmDayPct(kid, dayIdx) {
  const rows = mmReviewRows(kid, dayIdx);
  if (!rows.length) return 0;
  const done = rows.reduce((s, row) => s + (row.on ? 1 : 0), 0);
  return Math.round(done / rows.length * 100);
}
// Days of the viewed week that have already happened (Mon..today inclusive).
// A past week counts all 7; a future/other week counts 7 too (its numerator is
// 0 anyway, so this just avoids divide-by-zero).
function mmElapsedDays() {
  const info = ctWeekInfo();
  const idx = Math.round((formatDayKey(todayKey()) - info.mon) / 864e5);
  if (idx < 0 || idx > 6) return 7;
  return idx + 1;
}
// Average % of items done per elapsed day. Was a fixed /7, which let an
// untouched, not-yet-happened weekend drag a strong Mon–Fri down; dividing by
// elapsed days instead measures the days actually in play.
function mmWeekPct(kid) {
  const days = mmElapsedDays();
  let s = 0; for (let d = 0; d < days; d++) s += mmDayPct(kid, d);
  return Math.round(s / days);
}

function renderMeetingMode() {
  ctPrepareRead();
  const wk = ctWeekKey || ctThisWeekKey();
  const held = !!(state.shared.chore.meetingsHeld && state.shared.chore.meetingsHeld[wk]);
  const stepper = MM_STEPS.map((label, i) => {
    const n = i + 1;
    const cls = n === mmStep ? 'mm-step-cur' : (n < mmStep ? 'mm-step-done' : 'mm-step-up');
    return `<button type="button" class="mm-step ${cls}" onclick="mmGoStep(${n})">${n}·${label}</button>`;
  }).join('');

  let body;
  if (mmStep === 1) body = mmRenderReview(wk);
  else if (mmStep === 2) body = mmRenderCelebrate(wk);
  else if (mmStep === 3) body = mnyRenderEarned(wk);
  else if (mmStep === 4) body = mnyRenderDecide(wk);
  else body = mmRenderPlan(wk);

  const back = mmStep > 1 ? `<button type="button" class="pill-btn" onclick="mmGoStep(${mmStep - 1})">◀ Back</button>` : `<span></span>`;
  const next = mmStep < MM_STEPS.length
    ? `<button type="button" class="btn-confirm" onclick="mmGoStep(${mmStep + 1})">Next ▶</button>`
    : `<button type="button" class="btn-confirm" onclick="closeSheet('familyMeetingOverlay')">🎉 Finish meeting</button>`;

  const host = document.getElementById('familyMeetingBody');
  const restore = mmCaptureUiState(host);
  host.innerHTML =
    `<div class="mm-stepper">${stepper}</div><div class="mm-body">${body}</div><div class="mm-nav">${back}${next}</div>`;
  restore();
}

/* ── Keeping the meeting usable across a re-render ──
   Every tap in steps 3 and 4 rebuilds #familyMeetingBody wholesale. That threw
   away two things the family notices immediately: the sheet's scroll position
   (so a button pressed halfway down the page appeared to "do nothing" — the
   view had jumped back to the top), and keyboard focus (so typing a
   competition name lost the caret after the first letter, because the input
   the letter went into no longer existed).

   Captures both before the swap and puts them back after. Fields are matched by
   `data-mm-field` rather than DOM position, so a re-render that changes the
   surrounding markup still finds the right input. */
function mmCaptureUiState(host) {
  const sheet = document.querySelector('#familyMeetingOverlay .sheet');
  const scrollTop = sheet ? sheet.scrollTop : 0;
  const active = document.activeElement;
  let field = null, selStart = null, selEnd = null;
  if (active && host && host.contains(active)) {
    field = active.getAttribute('data-mm-field');
    // Only text-like inputs carry a caret worth restoring.
    try {
      if (field && active.selectionStart != null) {
        selStart = active.selectionStart;
        selEnd = active.selectionEnd;
      }
    } catch (e) { /* number/date inputs throw on selectionStart — ignore */ }
  }
  return function restore() {
    if (sheet) sheet.scrollTop = scrollTop;
    if (!field || !host) return;
    const next = host.querySelector(`[data-mm-field="${CSS.escape(field)}"]`);
    if (!next) return;
    next.focus();
    if (selStart == null) return;
    try { next.setSelectionRange(selStart, selEnd); } catch (e) { /* not text-like */ }
  };
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
  // Framed as a team total, not a head-to-head scoreboard: lead with how the two
  // did together, with each kid's number kept small for transparency.
  const jp = mmWeekPct('jenn'), sp = mmWeekPct('jess');
  const together = Math.round((jp + sp) / 2);
  const footer = `<div class="mm-ready">Meeting-ready: ${nConfirmed}/7 days confirmed · 💪 Together you kept ${together}% of the days so far <small>(🐥 ${jp}% · 🦊 ${sp}%)</small></div>`;
  return `<div class="mm-h">Review the week</div>
    <div class="mm-legend"><span><i class="mm-sw mm-bar-j"></i>Jenn</span><span><i class="mm-sw mm-bar-s"></i>Jess</span><span class="mm-legend-note">how the team's doing each day — cheer each other on</span></div>
    <div class="mm-chart">${bars}</div>${detail}${footer}`;
}
function mmSelectDay(d) { mmSelectedDay = (mmSelectedDay === d ? null : d); renderMeetingMode(); }
function mmRenderDayDetail(wk, d) {
  const col = (kid) => {
    const rows = mmReviewRows(kid, d);
    const name = kid === 'jenn' ? 'Jenn' : 'Jess';
    const section = (title, note, kind) => {
      const mine = rows.map((row, i) => ({ row, i })).filter(x => x.row.kind === kind);
      if (!mine.length) {
        return `<div class="mm-detail-sect"><div class="mm-detail-cap">${title}</div>
          <div class="mm-detail-empty">${kind === 'chore'
            ? 'No chores on the plan for this day.'
            : 'No routines tracked for this day.'}</div></div>`;
      }
      const items = mine.map(({ row, i }) => {
        // What she said, before a grown-up agreed — so the parent is confirming
        // her answer rather than guessing at it.
        const said = row.claim > 0
          ? (CK_QUALITY.find(q => q.g === row.claim) || {}).word || ''
          : '';
        const tag = row.kind === 'chore'
          ? (row.on ? `<span class="mm-item-pay">${mnyMoney(row.pay)}</span>`
             : said ? `<span class="mm-item-said">she said: ${escapeHtml(said.toLowerCase())}</span>`
             : `<span class="mm-item-said">not answered</span>`)
          : '';
        return `<button type="button" class="mm-item ${row.on ? 'on' : ''}" onclick="mmToggleItem('${kid}',${d},${i})"
            role="checkbox" aria-checked="${row.on}" aria-label="${escapeAttr(row.label)} ${DAY_SHORT[d]}, ${name}"><span class="mm-item-box">${row.on ? '✓' : ''}</span>${row.icon ? row.icon + ' ' : ''}${escapeHtml(row.label)}${tag}</button>`;
      }).join('');
      const done = mine.filter(x => x.row.on).length;
      return `<div class="mm-detail-sect">
        <div class="mm-detail-cap">${title} <small>${done}/${mine.length}</small></div>
        <div class="mm-detail-note">${note}</div>${items}</div>`;
    };
    const done = rows.filter(r => r.on).length;
    return `<div class="mm-detail-col">
      <div class="mm-detail-kid">${CT_PROFILE_ICON[kid]} ${name} <small>${done}/${rows.length} done</small></div>
      ${section('Routines', 'You mark these. They pay no money — they build the clean-day streak.', 'routine')}
      ${section('Chores', 'Tapping one agrees her answer and pays it.', 'chore')}
    </div>`;
  };
  const confirmed = mmIsDayConfirmed(d);
  return `<div class="mm-detail">
      <div class="mm-detail-cols">${col('jenn')}<div class="mm-detail-div"></div>${col('jess')}</div>
      <div class="mm-detail-editnote">Tap any item to change it for that kid — this is the same record the chore tab and "What I earned" read, so the money updates live.</div>
      <button type="button" class="mm-confirm-day ${confirmed ? 'confirmed' : ''}" onclick="mmToggleConfirmDay(${d})">${confirmed ? '✓ Confirmed (both kids)' : 'Confirm this day'}</button>
    </div>`;
}
/* Parent taps an item in the meeting review.

   A routine toggles the tracked session (no money, feeds the streak). A chore
   writes a GRADE — agreeing the kid's claim at the quality she said, or a
   plain "on time" when she never answered. Tapping a graded chore ungrades it.
   Either way it is the same store the portal and the money engine read, so
   Step 3 recomputes from it the moment this returns. */
function mmToggleItem(kid, d, idx) {
  const wk = mmWeekKey();
  const row = mmReviewRows(kid, d)[idx];
  if (!row) return;
  if (row.kind === 'routine') {
    ctSetMandatory(wk, d, row.key, kid, !row.on);
    ctMaybeFireGoalBonus(wk, kid);
  } else {
    // Agree at what she claimed; if she never claimed, agree at "on time".
    const next = row.on ? 0 : (row.claim > 0 ? row.claim : 3);
    mrSetChoreGrade(kid, wk, d, row.key, next);
  }
  saveAll();
  renderMeetingMode();
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
    action = `<div class="mm-recorded">✅ Recorded — money credited.</div>
      <button type="button" class="pill-btn danger" onclick="mmUndoRecord()">↩️ Undo (nothing is frozen yet)</button>`;
  } else if (alreadyHeld) {
    action = `<div class="mm-recorded">✅ This week was already recorded.</div>`;
  } else {
    action = `<button type="button" class="btn-confirm" onclick="mmConfirmAndRecord()">✅ Confirm &amp; record the week</button>`;
  }
  const newModel = (typeof mrUsesNewModel === 'function') && mrUsesNewModel(wk);
  // Show what recording is about to do, per kid, BEFORE it happens — the loan
  // transfer and XP credit are irreversible-feeling to a kid, so they should
  // never be a surprise that only shows up in a toast afterwards.
  const preview = newModel ? ['jenn','jess'].map(kid => {
    const b = mrWeekBreakdown(wk, kid);
    const xp = mrXpForWeek(wk, kid).total;
    // What the schedule actually asks for today — the deposit before the
    // monthlies, and nothing at all on the Sundays that aren't payment day.
    const l = loanState(kid);
    const duty = loanDueNow(kid);
    const paidThisMonth = l.lastPaymentMonth === loanMonthKey();
    const due = paidThisMonth ? 0 : duty.amount;
    const dueLabel = duty.kind === 'down' ? 'down payment' : 'loan';
    const bits = [];
    if (b.chorePaid) bits.push(`chores $${b.chorePaid.toFixed(2)}`);
    if (b.learnPaid) bits.push(`learning $${b.learnPaid.toFixed(2)}`);
    if (b.streak.bonus) bits.push(`streak $${b.streak.bonus.toFixed(2)}`);
    if (b.compPaid) bits.push(`competition $${b.compPaid.toFixed(2)}`);
    if (b.fines.total) bits.push(`fines −$${b.fines.total.toFixed(2)}`);
    return `<div class="ct-meta">${CT_PROFILE_ICON[kid]} ${bits.join(' · ') || 'nothing earned'}${xp ? ` · +${xp} XP` : ''}${due ? ` · ${dueLabel} −$${due.toFixed(2)}` : ''}</div>`;
  }).join('') : '';
  const explain = newModel
    ? `This <b>confirms</b> the week. Recording credits each kid's total to cash, credits XP, opens the Sunday Box, adds a month of interest and pays out anything locked away that has reached its date. The loan payment and any overdue interest move <b>once a month</b>, not every Sunday.`
    : `This <b>confirms</b> the week — it doesn't "pay". Group chore money already fired sticky as chores were done; recording credits each kid's total (max $${CT_MONEY_CAP}) to cash, adds a month of interest and pays out anything locked away that has reached its date.`;
  return `<div class="mm-h">Confirm &amp; record</div>
    <div class="ct-meta">${explain}</div>
    <div class="mm-pay">${rows}</div>${preview}${mmRenderQuarterly()}${action}`;
}
/* Quarterly review. The rulebook promises the numbers get revisited every three
   months; this raises it at the meeting with the actual earning data beside it,
   so the re-tune is argued from what happened rather than from a hunch. */
function mmRenderQuarterly() {
  if (typeof mrQuarterlyDue !== 'function' || !mrQuarterlyDue()) return '';
  const rows = ['jenn','jess'].map(kid => {
    const y = mrYearToDate(kid);
    const ch = y.channels;
    const name = kid === 'jenn' ? 'Jenn' : 'Jess';
    if (!y.weeks) return `<div class="ct-meta">${CT_PROFILE_ICON[kid]} ${name} — no recorded weeks yet.</div>`;
    return `<div class="ct-meta" style="margin-top:0.3rem">${CT_PROFILE_ICON[kid]} <b>${name}</b> — $${y.paidTotal.toFixed(2)} over ${y.weeks} week${y.weeks === 1 ? '' : 's'}
        · on this pace <b>$${y.projected.toFixed(2)}/yr</b> against a $${y.target.toFixed(0)} target (<b>${y.pctOfTarget}%</b>)</div>
      <div class="ct-meta">chores $${ch.chores.toFixed(2)} · learning $${ch.learning.toFixed(2)} · streak $${ch.streak.toFixed(2)} · competition $${ch.competition.toFixed(2)} · fines −$${ch.fines.toFixed(2)}</div>`;
  }).join('');
  return `<div class="mm-recorded" style="margin-top:0.6rem">
      <div><b>📅 Quarterly review — ${mrQuarterOf(todayKey())}</b></div>
      <div class="ct-meta">The rulebook says these numbers get looked at every three months. Here's what actually happened.</div>
      ${rows}
      <div style="margin-top:0.4rem"><button type="button" class="pill-btn" onclick="mmDoQuarterlyReview()">Open the rules editor</button>
        <button type="button" class="pill-btn" onclick="mmSkipQuarterlyReview()">Reviewed — no change</button></div>
    </div>`;
}
function mmDoQuarterlyReview() {
  mrMarkQuarterReviewed();
  closeSheet('familyMeetingOverlay');
  openPocketMoney(ctParentKid, 'setup');
}
function mmSkipQuarterlyReview() {
  mrMarkQuarterReviewed();
  renderMeetingMode();
  showToast('📅 Quarterly review recorded — rates unchanged');
}

function mmConfirmAndRecord() {
  const c = state.shared.chore;
  const wk = ctWeekKey || ctThisWeekKey();
  if (c.meetingsHeld && c.meetingsHeld[wk]) { showToast('Already recorded this week'); return; }
  mmTakeUndoSnapshot(wk);
  const parts = commitFamilyMeeting(wk);
  renderMeetingMode();
  showToast(`💛 Recorded${parts.length ? ' · ' + parts.join(' · ') : ''}`);
}

/* Snapshot everything a commit mutates, so the undo can fully reverse it. Taken
   before either kid is settled — step 4 settles them one at a time, and an undo
   that only reversed the second would leave the first standing against a week
   that was un-recorded. */
function mmTakeUndoSnapshot(wk) {
  const c = state.shared.chore;
  // Snapshot everything the commit mutates so the undo can fully reverse it.
  // The commit now moves XP and the loan as well as the wallet, so the undo has
  // to carry all of it — a partial reverse would leave credited XP or a loan
  // payment standing against a week that was un-recorded.
  const snap = kid => JSON.parse(JSON.stringify({
    wallet: ensureWallet(kid),
    // Every debt, every holding and every deposit the commit can touch. A kid
    // can owe for more than one thing, so snapshotting only the first debt
    // would leave the others paid down against a week that was un-recorded.
    debts: (typeof mnyDebts === 'function') ? mnyDebts(kid) : null,
    holdings: (typeof mnyHoldings === 'function') ? mnyHoldings(kid) : null,
    deposits: (typeof mnyEnsureDeposits === 'function') ? mnyEnsureDeposits(kid) : null,
    // Goal progress moves with the money, so it has to come back with it.
    savingGoals: (typeof mnyEnsureGoals === 'function') ? mnyEnsureGoals(kid) : null,
    xp: (getProfData(kid).progress || {}).questXP || 0,
    // The meeting also empties the box, so undo has to put it back.
    boxItems: (typeof mrBoxItems === 'function') ? mrBoxItems(kid) : null,
  }));
  mmUndo = {
    wk,
    jenn: snap('jenn'),
    jess: snap('jess'),
    marketMonth: bankConfig().marketMonth,
    finalized: (c.finalizedWeeks && c.finalizedWeeks[wk]) ? JSON.parse(JSON.stringify(c.finalizedWeeks[wk])) : null,
    xpAwarded: (c.xpAwardedWeeks && c.xpAwardedWeeks[wk]) ? JSON.parse(JSON.stringify(c.xpAwardedWeeks[wk])) : null,
    ledger: (c.moneyLedger && c.moneyLedger[wk]) ? JSON.parse(JSON.stringify(c.moneyLedger[wk])) : null,
    // What each kid decided, and whether she had agreed her week — an undo that
    // left the plan behind would show money moved against a week with no
    // decision recorded.
    plans: (c.weekPlans && c.weekPlans[wk]) ? JSON.parse(JSON.stringify(c.weekPlans[wk])) : null,
    confirms: (c.weekConfirms && c.weekConfirms[wk]) ? JSON.parse(JSON.stringify(c.weekConfirms[wk])) : null,
  };
}
function mmUndoRecord() {
  if (!mmUndo) return;
  const c = state.shared.chore; const wk = mmUndo.wk;
  ['jenn', 'jess'].forEach(kid => {
    const s = mmUndo[kid];
    const pd = getProfData(kid);
    pd.wallet = s.wallet;
    if (s.debts) pd.debts = s.debts;
    if (s.holdings) pd.holdings = s.holdings;
    if (s.deposits) pd.deposits = s.deposits;
    if (s.savingGoals) pd.savingGoals = s.savingGoals;
    if (s.boxItems) pd.boxItems = s.boxItems;
    if (!pd.progress) pd.progress = {};
    pd.progress.questXP = s.xp;
  });
  bankConfig().marketMonth = mmUndo.marketMonth;
  if (mmUndo.finalized) c.finalizedWeeks[wk] = mmUndo.finalized; else if (c.finalizedWeeks) delete c.finalizedWeeks[wk];
  // Clearing the XP ledger for the week is what lets a re-record award again;
  // without it the reversed XP could never be re-credited.
  if (c.xpAwardedWeeks) {
    if (mmUndo.xpAwarded) c.xpAwardedWeeks[wk] = mmUndo.xpAwarded; else delete c.xpAwardedWeeks[wk];
  }
  // The frozen ledger has to go back too, or an un-recorded week keeps a
  // history entry claiming it was settled.
  if (c.moneyLedger) {
    if (mmUndo.ledger) c.moneyLedger[wk] = mmUndo.ledger; else delete c.moneyLedger[wk];
  }
  // The decision and the agreement go back with the money. Leaving the plan
  // behind would leave the week showing as settled with nothing to settle.
  if (c.weekPlans) { if (mmUndo.plans) c.weekPlans[wk] = mmUndo.plans; else delete c.weekPlans[wk]; }
  if (c.weekConfirms) { if (mmUndo.confirms) c.weekConfirms[wk] = mmUndo.confirms; else delete c.weekConfirms[wk]; }
  if (typeof mnyDraft !== 'undefined') mnyDraft = null;
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
/* The per-kid half. Split out of commitFamilyMeeting so the redesigned meeting
   can settle one kid at a time — she decides what happens to her own money on
   step 4, and her sister's week is a separate conversation that may not even
   happen on the same evening. */
function commitKidWeek(wk, kid, opts) {
  const o = opts || {};
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.finalizedWeeks) c.finalizedWeeks = {};
  if (!c.finalizedWeeks[wk]) c.finalizedWeeks[wk] = {};
  if (!c.meetingsHeld) c.meetingsHeld = {};
  if (!c.moneyLedger) c.moneyLedger = {};
  if (!c.moneyLedger[wk]) c.moneyLedger[wk] = {};
  const parts = [];
  const newModel = (typeof mrUsesNewModel === 'function') && mrUsesNewModel(wk);
  {
    const w = ensureWallet(kid);
    const name = kid === 'jenn' ? 'Jenn' : 'Jess';
    // The breakdown is frozen HERE, before anything moves. Recomputing it later
    // would read today's rules and today's grades, so a price edit or a late
    // regrade would silently rewrite what a past week said it paid. History has
    // to be a record, not a recomputation.
    const ledger = (newModel && c.moneyLedger[wk][kid] == null)
      ? mrFreezeWeekLedger(wk, kid) : null;
    if (c.finalizedWeeks[wk][kid] == null) {
      const prelim = ctWeekMoney(wk, kid);
      w.cash = money2(w.cash + prelim);
      c.finalizedWeeks[wk][kid] = prelim;
      if (prelim > 0) parts.push(`${name} +$${prelim.toFixed(2)}`);
    }
    // XP is computed all week but only credited here — awarding it on render
    // would multiply it by however many times the screen redrew. Idempotent
    // per week, so re-recording can't double-award.
    if (newModel) {
      const xp = mrCreditWeekXp(wk, kid);
      if (xp > 0) parts.push(`${name} +${xp} XP`);
      // A month of overdue interest, then the scheduled transfer. Interest is
      // charged BEFORE the payment so a kid who pays late still meets the cost
      // of having been late, rather than escaping it by paying on the day.
      const interest = mnyAccrueArrearsAll(kid);
      if (interest > 0) parts.push(`${name} interest −$${interest.toFixed(2)}`);
      // Both of these are stamped by calendar month inside the loan module —
      // the meeting is weekly, the schedule is monthly, so most Sundays this
      // correctly does nothing. Every debt is paid, highest bonus rate first.
      const transfers = mnySundayTransferAll(kid, o.shortfall || 'pay_available', { weekKey: wk });
      const t = transfers[0] || { paid: 0, shortfall: 0, kind: null };
      transfers.forEach(r => {
        const what = r.kind === 'down' ? 'down payment' : r.name;
        if (r.paid > 0) parts.push(`${name} ${what} −$${r.paid.toFixed(2)}`);
        if (r.shortfall > 0) parts.push(`${name} ${r.name} overdue $${r.shortfall.toFixed(2)}`);
      });
      // The box opens at the meeting, not on a calendar day.
      const released = mrReleaseBoxForMeeting(kid);
      if (released > 0) parts.push(`${name} box opened (${released})`);
      // Fill in what only became known as the meeting ran.
      if (ledger) {
        ledger.xp = xp;
        ledger.boxReleased = released;
        ledger.loan = {
          kind: t.kind || null,
          paid: money2(transfers.reduce((s, r) => s + (r.paid || 0), 0)),
          shortfall: money2(transfers.reduce((s, r) => s + (r.shortfall || 0), 0)),
          interest: money2(interest || 0),
          // Per debt, so a week with two loans can still be read back.
          each: transfers.map(r => ({ debtId: r.debtId, name: r.name,
                                      paid: money2(r.paid || 0), shortfall: money2(r.shortfall || 0) })),
        };
        c.moneyLedger[wk][kid] = ledger;
      }
    }
    const adv = moneyAdvanceMonth(kid);
    adv.matured.forEach(m => parts.push(`${name} unlocked +$${m.payout.toFixed(2)}`));
  }
  saveAll();
  return { parts, ledger: (c.moneyLedger[wk] || {})[kid] || null };
}

/* The half that belongs to the family rather than to one kid. Runs once, when
   both weeks are settled — marking the meeting held before the second kid has
   decided anything would lock her out of her own step 4. */
function commitMeetingShared(wk) {
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.meetingsHeld) c.meetingsHeld = {};
  bankConfig().marketMonth += 1;   // one shared clock step per meeting
  c.meetingsHeld[wk] = true;
  saveAll();
}

/* Both kids in one press. The redesigned meeting settles them one at a time on
   step 4; this stays for the legacy path and for anything that just wants the
   week recorded. */
function commitFamilyMeeting(wk) {
  const parts = [];
  ['jenn', 'jess'].forEach(kid => { parts.push(...commitKidWeek(wk, kid).parts); });
  commitMeetingShared(wk);
  return parts;
}
