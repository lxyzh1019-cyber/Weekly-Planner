// Weekly-Planner — the parent's front door.
//
// Work used to be scattered: approvals in Tasks, grading in Chores, day
// confirmations inside the meeting, the backlog on the Weekly Review hub. A
// parent had to poll three tabs to find out whether anything wanted them.
//
// This screen answers that in one place, and it owns nothing. Every number is
// read through the accessor the owning screen already uses, and every row is a
// link to the screen that owns the work — Now counts and routes, it never
// decides. A second place that decides how a chore is graded or how money moves
// is a second place that can disagree with the first, and a parent has no way
// to tell which one is lying.
//
// Declarations only; the delegated listener is bound in js/99-main.js.

/* ── The four things that can be waiting ──
   Each reads one existing accessor and nothing else. If a count here ever
   disagrees with the screen it links to, this file is wrong, not that screen. */

// Chores claimed by a child and still without a grade, per kid.
function pnClaimCounts() {
  const wk = ctWeekKey || ctThisWeekKey();
  const out = { jenn: 0, jess: 0, total: 0, oldest: null };
  ['jenn', 'jess'].forEach(kid => {
    const rows = (typeof mrClaimQueue === 'function') ? mrClaimQueue(wk, kid) : [];
    out[kid] = rows.length;
    out.total += rows.length;
    rows.forEach(r => { if (out.oldest === null || r.dayIdx < out.oldest) out.oldest = r.dayIdx; });
  });
  return out;
}

// Activities a child added that a grown-up has not answered for yet.
function pnPendingActs() {
  return (typeof pendingApprovalActs === 'function') ? pendingApprovalActs() : [];
}

// Exercises a child typed into a training session that nobody has kept or
// dropped yet. Same shape of question as pnPendingActs, so it gets a row of its
// own rather than being folded into that count — approving an activity and
// approving a drill are two different presses in two different lists.
function pnPendingTasks() {
  return (typeof pendingApprovalTasks === 'function') ? pendingApprovalTasks() : [];
}

// Whose free-text note is sitting unread on this week.
function pnNoteKids() {
  const keys = getDayKeys(0);
  const wkKey = keys[0];
  return ['jenn', 'jess'].filter(kid => {
    const pd = getProfData(kid);
    const note = pd && pd.weekFeedback && pd.weekFeedback[wkKey];
    return !!(note && note.trim());
  });
}

// Weeks behind us that are still open. mmUnsettledWeeks already splits met from
// never-opened, so this is a straight pass-through.
function pnBacklog() {
  return (typeof mmUnsettledWeeks === 'function') ? mmUnsettledWeeks(8) : [];
}

/* The badge on the destination itself. Four possible things, counted once. */
function pnWaitingCount() {
  const c = pnClaimCounts();
  return (pnBacklog().length ? 1 : 0)
       + (c.total ? 1 : 0)
       + (pnPendingActs().length ? 1 : 0)
       + (pnNoteKids().length ? 1 : 0);
}

/* ── The queue ──
   Most urgent first: a backlog is older than a claim, which is older than an
   approval, which is older than a note. */
function pnQueueRows() {
  const rows = [];
  /* Top of the list: it has a deadline the season sets, not the backlog. */
  const season = pnLoanSeason();
  if (season) rows.push(season);
  const back = pnBacklog();
  if (back.length) {
    const unopened = mmUnopenedWeeks(8).length;
    rows.push({
      icon: '🕰️', action: 'catchup', cta: 'Catch up ›', go: true,
      title: `${back.length} week${back.length === 1 ? '' : 's'} still open`,
      sub: unopened
        ? 'Nothing expires — tick one off, or catch it up'
        : 'Met, but the money has not moved yet',
    });
  }
  const c = pnClaimCounts();
  if (c.total) {
    const who = ['jenn', 'jess'].filter(k => c[k])
      .map(k => `${CT_PROFILE_ICON[k]} ${k === 'jenn' ? 'Jenn' : 'Jess'} ${c[k]}`).join(' · ');
    rows.push({
      icon: '🧹', action: 'grade', cta: 'Grade ›', go: true,
      title: `${c.total} chore${c.total === 1 ? '' : 's'} waiting on a grade`,
      sub: `${who}${c.oldest !== null ? ` · oldest is ${CT_DAYS[c.oldest]}` : ''}`,
    });
  }
  const pend = pnPendingActs();
  if (pend.length) {
    const first = pend[0];
    rows.push({
      icon: '➕', action: 'approve', cta: 'Look ›',
      title: `${pend.length} activit${pend.length === 1 ? 'y' : 'ies'} to approve`,
      sub: `${CT_PROFILE_ICON[first.owner] || ''} ${first.owner === 'jenn' ? 'Jenn' : 'Jess'} added “${first.act.name}”`,
    });
  }
  const pendT = pnPendingTasks();
  if (pendT.length) {
    const first = pendT[0];
    const who = kidLabel(first.owner);
    rows.push({
      icon: '🏋️', action: 'approve', cta: 'Look ›',
      title: `${pendT.length} exercise${pendT.length === 1 ? '' : 's'} to approve`,
      sub: `${who.icon} ${who.name} added “${first.task.name}”`,
    });
  }
  const moves = ['jenn', 'jess'].flatMap(k =>
    (typeof mnyPendingMoves === 'function' ? mnyPendingMoves(k) : []).map(r => ({ kid: k, r })));
  if (moves.length) {
    const first = moves[0];
    const who = kidLabel(first.kid);
    rows.push({
      icon: '🔀', action: 'moves', cta: 'Answer ›',
      title: `${moves.length} move${moves.length === 1 ? '' : 's'} she has asked about`,
      sub: `${who.icon} ${who.name} · ${mnyMoney(first.r.amount)} to ${mnyHomeLabel(first.r.to).toLowerCase()}`,
    });
  }
  const notes = pnNoteKids();
  if (notes.length) {
    rows.push({
      icon: '💬', action: 'notes', cta: 'Read ›',
      title: `${notes.map(k => k === 'jenn' ? 'Jenn' : 'Jess').join(' and ')} left a note this week`,
      sub: 'Worth reading before the meeting',
    });
  }
  return rows;
}

/* ── The loan season ──
   A new sports loan is set up every autumn, and recording it lowers her
   paid-off share — and with it her Money school stage, which can shut pots she
   has been using. Worked out from the date and the debts and NOTHING ELSE: no
   stored reminder, no dismissal flag. It shows from 1 Aug to 30 Sep of any
   year and goes by itself once a loan has been recorded on or after 1 Jul of
   that year (`createdAt`, stamped on every debt by mnyNormalizeDebt).

   Now counts and routes: the row opens Money rules › Loans and decides
   nothing. Returns null when it should not show. */
function pnLoanSeason() {
  const today = String(todayKey());
  const y = today.slice(0, 4);
  if (today < y + '-08-01' || today > y + '-09-30') return null;
  const since = formatDayKey(y + '-07-01').getTime();
  const recorded = ['jenn', 'jess'].some(kid =>
    (typeof mnyDebts === 'function' ? mnyDebts(kid) : [])
      .some(d => d && (Number(d.createdAt) || 0) >= since));
  if (recorded) return null;
  return {
    icon: '🎿', action: 'loans', cta: 'Loans ›', go: true,
    title: 'Time to set up next season’s sports loan',
    sub: 'Recording the new loan lowers her paid-off share, and so her stage — '
      + '“Open a stage early” in Money rules › Lessons keeps her pots open.',
  };
}

/* A card must never render blank. An empty queue is the good case and should
   read as one, not as a box that failed to load. */
function pnQueueCard() {
  const rows = pnQueueRows();
  if (!rows.length) {
    return `<div class="pn-card pn-clear">✅ Nothing is waiting on you. Every chore has a grade,
      every activity has an answer, and no week is open.</div>`;
  }
  return `<div class="pn-card">${rows.map(r => `
    <button type="button" class="pn-row" data-pn-action="${r.action}">
      <span class="pn-ico" aria-hidden="true">${r.icon}</span>
      <span class="pn-text"><span class="pn-title">${escapeHtml(r.title)}</span>
        <span class="pn-sub">${escapeHtml(r.sub)}</span></span>
      <span class="pn-cta${r.go ? ' go' : ''}">${escapeHtml(r.cta)}</span>
    </button>`).join('')}</div>`;
}

/* ── This week ──
   The rail that used to be a whole tab. Read-only status plus the one button
   that opens the meeting; it settles nothing itself. */
function pnWeekRail() {
  ctPrepareRead();
  const wk = ctWeekKey || ctThisWeekKey();
  const info = ctWeekInfo();
  const held = !!((state.shared.chore.meetingsHeld || {})[wk]);
  const nConfirmed = [0, 1, 2, 3, 4, 5, 6].filter(mmIsDayConfirmed).length;
  let days = '';
  for (let d = 0; d < 7; d++) {
    const date = new Date(info.mon); date.setDate(info.mon.getDate() + d);
    const k = ctDateToKey(date);
    const confirmed = mmIsDayConfirmed(d);
    days += `<button type="button" class="pn-day${confirmed ? ' ok' : ''}${k === todayKey() ? ' now' : ''}"
        data-pn-action="day" data-day="${d}" aria-label="${escapeAttr(DAY_SHORT[d] + ' ' + date.getDate())}">
        <span class="pn-day-dow">${DAY_SHORT[d]}</span>
        <span class="pn-day-date">${date.getDate()}</span></button>`;
  }
  const weekLabel = `${MONTH_SHORT[info.mon.getMonth()]} ${info.mon.getDate()} – ${MONTH_SHORT[info.sun.getMonth()]} ${info.sun.getDate()}`;
  /* pool.cameIn, not the earnings net. This line says "pocket money so far",
     and reading it net once made a birthday cheque already sitting in the week
     invisible here and then appear out of nowhere at the table. */
  const money = ['jenn', 'jess'].map(kid =>
    `<div class="pn-kv"><span>${CT_PROFILE_ICON[kid]} ${kid === 'jenn' ? 'Jenn' : 'Jess'}</span>
       <span class="pn-n">${ckMoney(mnyPool(wk, kid).cameIn)}</span></div>`).join('');
  const cta = held
    ? `<button type="button" class="pill-btn pn-wide" data-pn-action="meeting">🧑‍🧑‍🧒 Re-open the meeting</button>`
    : `<button type="button" class="btn-confirm" data-pn-action="meeting">🧑‍🧑‍🧒 ${nConfirmed > 0 ? 'Continue the' : 'Run'} family meeting</button>`;
  return `<div class="pn-card pn-rail">
      <div class="pn-rail-wk">${escapeHtml(weekLabel)}</div>
      <div class="pn-days">${days}</div>
      <div class="pn-kv"><span>Days confirmed</span><span class="pn-n">${nConfirmed} of 7</span></div>
      ${money}
      <p class="pn-note">${held
        ? '✅ This week is recorded — pocket money was credited at the meeting.'
        : 'Nothing is paid until the week is settled at the meeting.'}</p>
      ${cta}
      <button type="button" class="pill-btn pn-wide" data-pn-action="fullweek">📋 Open her full week ›</button>
    </div>`;
}

function pnRenderNow() {
  const wrap = document.getElementById('pnWrap');
  if (!wrap) return;
  if (!isParent()) { wrap.innerHTML = `<div class="pn-card">Parents only 🔒</div>`; return; }
  ctPrepareRead();
  if (!ctWeekKey) ctSetCurrentWeekFromPlanner();
  /* The queue's backlog row is the only representation of the backlog here.
     Rendering mmCatchUpBanner underneath it as well put the same fact on the
     same screen twice — a row saying "3 weeks still open" above a list of the
     same three weeks — which is exactly the duplication this screen exists to
     stop. The row is the notification; the catch-up screen is where the work
     happens; the meeting hub still lists the weeks. */
  wrap.innerHTML = `<div class="pn-cols">
      <div><p class="pn-cap">Waiting on you</p>${pnQueueCard()}
        <button type="button" class="pn-record" data-pn-action="record">✍️ Record something</button></div>
      <div><p class="pn-cap">This week</p>${pnWeekRail()}</div>
    </div>`;
  // The count on the tab itself, so a parent sees there is work without opening.
  const badge = document.getElementById('pnTabBadge');
  if (badge) {
    const n = pnWaitingCount();
    badge.textContent = n || '';
    badge.hidden = !n;
  }
}

/* One delegated listener, bound in js/99-main.js. Every row routes to the
   screen that owns the work rather than doing it here. */
function pnHandleClick(e) {
  const el = e.target.closest('[data-pn-action]');
  if (!el) return;
  const a = el.getAttribute('data-pn-action');
  if (a === 'catchup') {
    const first = pnBacklog()[0];
    if (first) mmOpenExpress(first.wk);
    return;
  }
  if (a === 'grade')    { setParentTab('chores'); return; }
  if (a === 'approve')  { setParentTab('tasks'); return; }
  if (a === 'notes')    { setParentTab('review'); return; }
  /* Now COUNTS and ROUTES; it never decides. This opens the sheet with no kind
     chosen, because which record it is is the first thing the sheet asks. */
  if (a === 'record')   { openRecordSheet({ kid: parentViewing }); return; }
  if (a === 'moves')    {
    /* Point the portal at the child who asked, and at the section that shows
       what she has — answering a move with another child's balances on screen
       is how the wrong pot gets opened. */
    const first = ['jenn', 'jess'].find(k =>
      typeof mnyPendingMoves === 'function' && mnyPendingMoves(k).length);
    /* Section first: setParentScope re-renders the tab it is standing on, so
       setting it afterwards would paint the money page twice — and in this app
       a render can trigger a full-document write. */
    if (typeof mnySetParentSection === 'function') mnyParentSection = 'holdings';
    if (first) setParentScope(first);
    setParentTab('money');
    return;
  }
  if (a === 'loans') {
    /* Section first, for the same reason as 'moves' above. */
    if (typeof mnySetParentSection === 'function') mnyParentSection = 'debts';
    setParentTab('money');
    return;
  }
  if (a === 'meeting')  { openFamilyMeetingAsk(); return; }
  if (a === 'fullweek') { parentView(parentViewing); return; }
  if (a === 'day')      { openFamilyMeetingAt(1, Number(el.getAttribute('data-day'))); return; }
}
