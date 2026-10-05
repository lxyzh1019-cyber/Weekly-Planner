// Weekly-Planner — the parent's front door.
//
// Work used to be scattered: approvals in Tasks, grading in Chores, day
// confirmations inside the meeting, the backlog on the Weekly Review hub. A
// parent had to poll three tabs to find out whether anything wanted them.
//
// This screen answers that in one place, and it owns nothing. Every number is
// read through the accessor the owning screen already uses, and every queue row
// is a link to the screen that owns the work — Now counts and routes, it never
// decides. A second place that decides how a chore is graded or how money moves
// is a second place that can disagree with the first, and a parent has no way
// to tell which one is lying.
//
// One card writes (R5 §5 C1): "On her behalf" gives a child's own answers for
// her — a claim, her own things, her training rating — and logs learning,
// each through the chore tab's writer. It grades, settles and approves nothing.
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

/* The badge on the destination itself: four possible things, counted once,
   and every question the girls asked that is still open (`guWaitingCount`,
   the one number) — they are answered on Now (Deviation 36). */
function pnWaitingCount() { return pnOpenCount(['jenn', 'jess']); }
/* The one count (Plan v18 Stage 7): the badge, and "N open" over ✅ Waiting
   for you, read the same — one for each line above the cards (a backlog,
   chores to grade, activities, a note) and one for each open question of the
   girls in scope (💬 talk-first included: it still blocks payday). */
function pnOpenCount(kids) {
  const c = pnClaimCounts();
  return (pnBacklog().length ? 1 : 0)
       + (c.total ? 1 : 0)
       + (pnPendingActs().length ? 1 : 0)
       + (pnNoteKids().length ? 1 : 0)
       + kids.reduce((n, k) => n + mnyRequestsFor(k).filter(q => q.open).length, 0);
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
  /* Her questions are not a row any more: they are answered right here, in
     ✅ Waiting for you (Plan v9 §N, Deviation 36). */
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

/* ════════════════════════════════════════════════════════════════
   ✅ WAITING FOR YOU (Plan v9 §M 5b / §N, Deviation 36 — Stage 6d)
   Every question the girls asked a grown-up is answered HERE, on Now, not
   on a Money tab: the list on the left, and three side panes, each with one
   stated purpose — ☀️ This Sunday (is payday ready, what still blocks it),
   💬 Her answer last week (read before the meeting) and 👛 What they own
   (check before a yes to a move or a cash-out). Under them ✍️ Record and
   🚪 She told me…, and 🔧 Tidy-up only when there is something to tidy.

   It still owns nothing. The cards are Grown-ups' own (`guApproveCard`,
   js/46) on the ONE reader (`mnyRequestsFor`) and the ONE answerer
   (`mnyAnswerRequest`); their `data-mnyp-action` taps go to `mnyParentClick`
   (bound on #pnWrap too, js/99-main.js), exactly as on the Money tab.
   ════════════════════════════════════════════════════════════════ */
const PN_SCOPE_LS_KEY = 'wp_now_scope';      // Jenn · Jess · Both on this device (§N 5a)
const PN_GROUP_LS_KEY = 'wp_now_groupby';    // By girl · By kind on this device
let pnSheetOpen = false;                     // 🚪 "She told me…" sheet showing
function pnLsGet(key, ok, dflt) {
  try { const v = localStorage.getItem(key); return ok.indexOf(v) >= 0 ? v : dflt; } catch (e) { return dflt; }
}
function pnLsSet(key, v) { try { localStorage.setItem(key, v); } catch (e) {} }
function pnScope() { return pnLsGet(PN_SCOPE_LS_KEY, ['jenn', 'jess', 'both'], 'both'); }
function pnGroupBy() { return pnLsGet(PN_GROUP_LS_KEY, ['girl', 'kind'], 'girl'); }
function pnScopeKids() { const s = pnScope(); return s === 'both' ? ['jenn', 'jess'] : [s]; }

/* The kinds, in the order "By kind" lists them (the mockup's groups). */
const PN_KIND_GROUPS = [
  ['coming', '🎁 Money coming in', ['gift', 'deposit']],
  ['early', '⏪ Early cash', ['adv']],
  ['goals', '🎯 Goals', ['goal']],
  ['results', '🏆 Results', ['comp']],
  ['club', '⛸️ Club', ['skip']],
  ['moves', '🔀 Moves', ['move']],
  ['fines', '📦 Fines', ['dispute']],
];
/* A segmented toggle, remembered on this device. */
function pnSeg(label, action, opts, cur) {
  return `<div class="pn-seg" role="group" aria-label="${escapeAttr(label)}">${opts.map(([id, text]) =>
    `<button type="button" class="pn-segbtn${cur === id ? ' on' : ''}" aria-pressed="${cur === id}" data-pn-action="${action}" data-kid="${id}">${escapeHtml(text)}</button>`).join('')}</div>`;
}
/* Everything that is not a question she asked — a backlog, chores to grade,
   activities to approve, a note, the loan season — as one compact line each
   (the mockup's "4 weeks still open · Catch up ›" line). */
function pnQueueCard() {
  const rows = pnQueueRows();
  if (!rows.length) return '';
  return `<div class="pn-lines">${rows.map(r => `
    <button type="button" class="pn-line" data-pn-action="${r.action}">
      <span class="pn-ico" aria-hidden="true">${r.icon}</span>
      <span class="pn-text"><span class="pn-title">${escapeHtml(r.title)}</span>
        <span class="pn-sub">${escapeHtml(r.sub)}</span></span>
      <span class="pn-cta${r.go ? ' go' : ''}">${escapeHtml(r.cta)}</span>
    </button>`).join('')}</div>`;
}
/* 🎯 A full jar — "did she buy it?" — a card in the list only when due. */
function pnBoughtCards(kids) {
  return kids.flatMap(kid => mnyGoalsNearestFirst(kid).filter(g => {
    const saved = mnyGoalJarValue(kid, g);
    return mnyGoalPace(kid, Object.assign({}, g, { saved })).reached;
  }).map(g => `<div class="gu-req gu-req--open">
      <div class="gu-req-top">${guKidChip(kid)}<span class="gu-kind">jar is full</span><span class="gu-amt"><b>${escapeHtml(guMoney$(mnyGoalJarValue(kid, g)))}</b></span></div>
      <div class="gu-req-text">${escapeHtml((g.icon || '🎯') + ' ' + g.name)} — did she buy it?</div>
      <div class="gu-check">🔎 Takes it out of the jar and writes a line</div>
      <div class="gu-answer"><button type="button" class="gu-yes" data-mnyp-action="guboughtit" data-mnyp-kid="${kid}" data-mnyp-id="${escapeAttr(g.id)}">✓ She bought it</button></div>
    </div>`));
}
/* The questions: open ones, yeses Sunday has not used, and the last 7 days'
   answers (`guQueue`, js/46), for the girls in scope. 💬 Talk-first ones are
   their own group, "To talk about on Sunday" (§N 5b): the meeting's "Parents
   answer first" card is where they are agreed. Then by girl or by kind. */
function pnRequestsHtml() {
  const kids = pnScopeKids();
  const all = guQueue().filter(q => kids.indexOf(q.kid) >= 0);
  const talk = all.filter(q => q.status === 'talk');
  const rest = all.filter(q => q.status !== 'talk');
  const group = (title, list, extra) => (list.length || extra) ? `<div class="pn-group">
      <div class="pn-group-head"><span class="pn-group-title">${escapeHtml(title)}</span><span class="pn-group-n">${list.filter(q => q.open).length} open</span></div>
      <div class="gu-cards2">${list.map(guApproveCard).join('')}${extra || ''}</div></div>` : '';
  let body;
  if (pnGroupBy() === 'kind') {
    body = PN_KIND_GROUPS.map(([id, title, kinds]) => group(title, rest.filter(q => kinds.indexOf(q.kind) >= 0),
      id === 'goals' ? pnBoughtCards(kids).join('') : '')).join('');
  } else {
    body = kids.map(kid => group(mnyKidName(kid), rest.filter(q => q.kid === kid), pnBoughtCards([kid]).join(''))).join('');
  }
  const talkHtml = talk.length ? `<div class="pn-group pn-group--talk">
      <div class="pn-group-head"><span class="pn-group-title">💬 To talk about on Sunday</span><span class="pn-group-n">${talk.length}</span></div>
      <div class="pn-talknote">Agreed at the family meeting, in “Parents answer first”: set the amount there, then ✓ Agree or Not this time.</div>
      <div class="gu-cards2">${talk.map(guApproveCard).join('')}</div></div>` : '';
  const gf = guGrandfatherCreditCard();
  const empty = !all.length && !gf && !pnBoughtCards(kids).length
    ? `<div class="gu-empty">Nothing waiting. When they tap 🏆 or 🔀 on My money, it lands here.</div>` : '';
  return `${body}${talkHtml}${gf ? `<div class="pn-group"><div class="pn-group-head"><span class="pn-group-title">👴 Grandfather rule</span></div>${gf}</div>` : ''}${empty}`;
}
/* ☀️ This Sunday — is payday ready, what still blocks it. Per girl: what is
   still to answer, then came in → loan → hers (`mnyPool`, the meeting's own
   figures) and ✏️ Change a line (`guOverrideRows`, the one writer); the days
   confirmed, the meeting's button and her full week. */
function pnSundayCard() {
  ctPrepareRead();
  const wk = ctWeekKey || ctThisWeekKey();
  const info = ctWeekInfo();
  const held = !!((state.shared.chore.meetingsHeld || {})[wk]);
  const nConfirmed = [0, 1, 2, 3, 4, 5, 6].filter(mmIsDayConfirmed).length;
  let days = '';
  for (let d = 0; d < 7; d++) {
    const date = new Date(info.mon); date.setDate(info.mon.getDate() + d);
    const k = ctDateToKey(date);
    days += `<button type="button" class="pn-day${mmIsDayConfirmed(d) ? ' ok' : ''}${k === todayKey() ? ' now' : ''}"
        data-pn-action="day" data-day="${d}" aria-label="${escapeAttr(DAY_SHORT[d] + ' ' + date.getDate())}">
        <span class="pn-day-dow">${DAY_SHORT[d]}</span>
        <span class="pn-day-date">${date.getDate()}</span></button>`;
  }
  const sunday = new Date(info.sun);
  const kids = ['jenn', 'jess'].map(kid => {
    const pool = mnyPool(wk, kid);
    const wait = mnyRequestsFor(kid).filter(q => q.open).length;
    return `<div class="pn-sunkid ${'gu-tint--' + kid}">
        <div class="pn-sunkid-head"><b>${escapeHtml(mnyKidName(kid))}</b>
          <span class="pn-sunkid-wait${wait ? '' : ' ok'}">${wait ? `⏳ ${wait} to answer` : '✓ payday can open'}</span></div>
        <div class="pn-sunkid-flow">came in <b>${escapeHtml(mnyMoney(pool.cameIn))}</b> → loan <b>${escapeHtml(mnyMoney(pool.mustPay))}</b> → hers <b class="pn-hers">${escapeHtml(mnyMoney(pool.mine))}</b></div>
        <div class="gu">${guOverrideRows(kid)}</div>
      </div>`;
  }).join('');
  const cta = held
    ? `<button type="button" class="pill-btn pn-wide" data-pn-action="meeting">🧑‍🧑‍🧒 Re-open the meeting</button>`
    : `<button type="button" class="btn-confirm pn-wide" data-pn-action="meeting">🧑‍🧑‍🧒 ${nConfirmed > 0 ? 'Continue the' : 'Run'} family meeting</button>`;
  return `<div class="pn-card pn-side-card pn-sun">
      <div class="pn-side-head"><span class="pn-side-title">☀️ This Sunday · ${escapeHtml(sunday.getDate() + ' ' + MONTH_SHORT[sunday.getMonth()])}</span>
        <span class="pn-side-meta">${nConfirmed} of 7 days confirmed</span></div>
      <p class="pn-purpose">Is payday ready? What still blocks it.</p>
      ${kids}
      <div class="pn-days">${days}</div>
      ${cta}
      <button type="button" class="pill-btn pn-wide" data-pn-action="fullweek">📋 Open her full week ›</button>
    </div>`;
}
/* 💬 Her answer last week — read before the meeting (`sdLastAnswer`, the
   Sunday step's own reader). */
function pnLastAnswerCard() {
  const wk = ctThisWeekKey();
  const rows = ['jenn', 'jess'].map(kid => {
    const a = sdLastAnswer(kid, wk);
    return a && a.said ? `<div class="pn-said">${guKidChip(kid)} “${escapeHtml(a.said)}”${a.guess != null ? ` <span class="pn-sub">guessed $${escapeHtml(String(a.guess))}</span>` : ''}</div>` : '';
  }).join('');
  if (!rows) return '';
  return `<div class="pn-card pn-side-card">
      <div class="pn-side-head"><span class="pn-side-title">💬 Her answer last week</span></div>
      <p class="pn-purpose">Read it before the meeting.</p>
      ${rows}
    </div>`;
}
/* 👛 What they own — both girls in one table (Deviation 37: no cash
   account). 🏦 Savings holds her 🎯 goal jars ("of which …", display only);
   then 🔒 Locked away, 📈 Companies, 🧱 the loan left; "📥 Waiting for
   Sunday" only while either girl has some. Check it before a yes to a move
   or a cash-out. ✏️ Fix opens Grown-ups' fix sheet for that girl. */
function pnOwnsCard() {
  const K = ['jenn', 'jess'];
  const parts = {};
  K.forEach(k => { parts[k] = mnyEverythingParts(k); });
  const row = (label, f, cls) => `<tr class="${cls || ''}"><th scope="row">${escapeHtml(label)}</th>${K.map(k => `<td>${escapeHtml(f(k))}</td>`).join('')}</tr>`;
  const tile = (k, id) => parts[k].tiles.find(t => t.k === id).value;
  const jarRows = K.some(k => parts[k].jars.length)
    ? row('of which 🎯 goal jars', k => mnyMoney(parts[k].jarTotal), 'pn-owns-sub') : '';
  // The next lock to come back, either girl's (the day a parent hands it back to her pile).
  const back = K.flatMap(k => mnyHoldingsOfKind(k, 'gic').map(h => String(h.maturesOn || ''))).filter(Boolean).sort()[0] || '';
  const waiting = K.some(k => parts[k].waiting > 0) ? row('📥 Waiting for Sunday', k => mnyMoney(parts[k].waiting)) : '';
  return `<div class="pn-card pn-side-card pn-owns">
      <div class="pn-side-head"><span class="pn-side-title">👛 What they own</span></div>
      <p class="pn-purpose">Check before you say yes to a move or a cash-out.</p>
      <table class="pn-owns-table">
        <thead><tr><td></td>${K.map(k => `<th scope="col">${guKidChip(k)}</th>`).join('')}</tr></thead>
        <tbody>
          ${row('🏦 Savings', k => mnyMoney(tile(k, 'ready')))}
          ${jarRows}
          ${row(`🔒 Locked away${back ? ' · back ' + mnyDayName(back) : ''}`, k => mnyMoney(tile(k, 'gic')))}
          ${row('📈 Companies', k => mnyMoney(tile(k, 'stock')))}
          ${waiting}
          ${row('Total', k => mnyMoney(parts[k].total), 'pn-owns-total')}
          ${row('🧱 Loan left', k => mnyMoney(mnyTotalOwing(k)))}
        </tbody>
      </table>
      <div class="pn-owns-fix">${K.map(k => `<button type="button" class="gu-btn" data-mnyp-action="gufixowns" data-mnyp-kid="${k}">✏️ Fix ${escapeHtml(mnyKidName(k))}’s</button>`).join('')}</div>
    </div>`;
}
/* 🔧 Tidy-up — one-time and repair jobs (the stream set-up, weeks the
   retired branch short-changed, meets never paid), shown only while one has
   something to do; each still previews and confirms through its own runner. */
let pnTidyOpen = false;
function pnTidyCard() {
  const cards = [guStreamCard(), guRepairCard(), guMeetsCard()].filter(Boolean);
  if (!cards.length) return '';
  return `<div class="pn-tidy">
      <button type="button" class="pn-tidybtn" data-pn-action="tidy" aria-expanded="${pnTidyOpen}">🔧 Tidy-up · ${cards.length} ${pnTidyOpen ? '▾' : '▸'}</button>
      ${pnTidyOpen ? `<div class="gu">${cards.join('')}</div>` : ''}
    </div>`;
}
/* 🚪 "She told me…": the On-her-behalf card, in a sheet (§N 5d). */
function pnOpenToldSheet() {
  pnSheetOpen = true;
  openSheet('pnToldOverlay');
  pnRenderToldSheet();
}
function pnRenderToldSheet() {
  const body = document.getElementById('pnToldBody');
  if (!body || !pnSheetOpen) return;
  body.innerHTML = `${pnAnswerCard()}<button type="button" class="btn-confirm pn-wide" data-pn-action="told-close">Done</button>`;
}

/* ── On her behalf (R5 §5 rows 7 and 8, C1 — 2026-09-24) ─────────────────
   "She told us at the door": on a busy week that is how a job gets recorded
   when she never reached the iPad (the reason mrSetClaim lets a parent claim,
   js/18-rules.js). This card is where a grown-up gives HER answers for her —
   a chore's claim, her own things, her training rating — and logs learning,
   which only a grown-up does. Per child and per day of this week, up to today.

   Every control calls the writer the chore tab calls (openChoreClaimPrompt →
   mrSetClaim, ctCyclePersonalFor → mrCyclePersonal, ckRateSelfFor →
   mrSetAttitude 'self', ctBumpLearningFor → mrSetLearning). It still grades
   nothing, settles nothing and approves nothing — grading stays in Chores and
   pay in the meeting — and a week already settled for her offers nothing. */
let pnAnswerKid = null;     // the child answered for; null → parentViewing
let pnAnswerDay = null;     // day index of this week; null → today
let pnAnswerElse = false;   // the "something else" picker open

function pnAnswerTarget() {
  const kid = pnAnswerKid || (parentViewing === 'jess' ? 'jess' : 'jenn');
  const wk = ctThisWeekKey();
  const keys = mrWeekDayKeys(wk);
  const todayIdx = Math.max(0, keys.indexOf(todayKey()));
  const d = (pnAnswerDay != null && pnAnswerDay <= todayIdx) ? pnAnswerDay : todayIdx;
  return { kid, wk, d, todayIdx, dayKey: keys[d] };
}
function pnAnswerCard() {
  const { kid, wk, d, todayIdx, dayKey } = pnAnswerTarget();
  const kids = ['jenn', 'jess'].map(k => `<button type="button" class="pn-kidbtn${k === kid ? ' on' : ''}"
      data-pn-action="answer-kid" data-kid="${k}" aria-pressed="${k === kid}">
      ${CT_PROFILE_ICON[k]} ${k === 'jenn' ? 'Jenn' : 'Jess'}</button>`).join('');
  const mon = formatDayKey(wk);
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => {
    const date = new Date(mon); date.setDate(mon.getDate() + i);
    return `<button type="button" class="pn-day${i === d ? ' on' : ''}" data-pn-action="answer-day" data-day="${i}"
        aria-pressed="${i === d}"${i > todayIdx ? ' disabled' : ''}
        aria-label="${escapeAttr(DAY_SHORT[i] + ' ' + date.getDate())}">
        <span class="pn-day-dow">${DAY_SHORT[i]}</span>
        <span class="pn-day-date">${date.getDate()}</span></button>`;
  }).join('');
  const head = `<div class="pn-answer-kids">${kids}</div><div class="pn-days">${days}</div>`;
  if (mnyWeekSettled(wk, kid)) {
    return `<div class="pn-card pn-answer">${head}
      <p class="pn-note">This week is settled for her, so there is nothing more to answer here.</p></div>`;
  }

  // Her chores that day: answer the ones nobody has graded.
  const jobs = mrChoresForDay(kid, wk, d).rows.filter(x => x.row.lane === 'chores').map(({ row }) => {
    const g = mrGetChoreGrade(kid, wk, d, row.id), c = mrGetClaim(kid, wk, d, row.id);
    const word = q => ((CK_QUALITY.find(x => x.g === q) || {}).word || '').toLowerCase();
    if (g > 0) {
      return `<div class="pn-row pn-static"><span class="pn-ico" aria-hidden="true">${escapeHtml(row.icon)}</span>
        <span class="pn-text"><span class="pn-title">${escapeHtml(row.label)}</span>
        <span class="pn-sub">${escapeHtml('graded — ' + word(g))}</span></span></div>`;
    }
    return `<button type="button" class="pn-row" data-pn-action="answer-claim" data-chore="${escapeAttr(row.id)}">
      <span class="pn-ico" aria-hidden="true">${escapeHtml(row.icon)}</span>
      <span class="pn-text"><span class="pn-title">${escapeHtml(row.label)}</span>
        <span class="pn-sub">${escapeHtml(c ? 'she said ' + word(c) + ' — change it' : 'no answer yet')}</span></span>
      <span class="pn-cta">${c ? 'Change' : 'Answer'} ›</span></button>`;
  }).join('');
  const left = ckUnlistedChoresFor(kid, wk, d);
  const elseHtml = !left.length ? '' : !pnAnswerElse
    ? `<button type="button" class="pn-row" data-pn-action="answer-else" aria-expanded="false">
        <span class="pn-ico" aria-hidden="true">＋</span>
        <span class="pn-text"><span class="pn-title">She did something else</span></span></button>`
    : left.map(row => `<button type="button" class="pn-row" data-pn-action="answer-else-pick" data-chore="${escapeAttr(row.id)}">
        <span class="pn-ico" aria-hidden="true">${escapeHtml(row.icon)}</span>
        <span class="pn-text"><span class="pn-title">${escapeHtml(row.label)}</span></span>
        <span class="pn-cta">Answer ›</span></button>`).join('')
      + `<button type="button" class="pn-row" data-pn-action="answer-else" aria-expanded="true">
        <span class="pn-text"><span class="pn-title">Never mind</span></span></button>`;

  // Her own things and helping out.
  const { own, helping } = ckOwnLaneItems(kid, wk, d);
  const lanes = [...own, ...helping].map(i => {
    const st = mrGetPersonal(kid, wk, d, i.id);
    return `<button type="button" class="pn-row" data-pn-action="answer-personal" data-chore="${escapeAttr(i.id)}" aria-pressed="${!!st}">
      <span class="pn-ico" aria-hidden="true">${escapeHtml(i.icon || '⭐')}</span>
      <span class="pn-text"><span class="pn-title">${escapeHtml(i.label)}</span>
        <span class="pn-sub">${st === 'unasked' ? 'done, nobody asked ⭐ (XP)' : st === 'done' ? 'done' : 'not yet'}</span></span></button>`;
  }).join('');

  // Her training rating, on a day that had training.
  const t = ckTrainingBlockOn(kid, dayKey);
  let training = '';
  if (t) {
    const a = mrGetAttitude(kid, wk, d);
    training = `<p class="pn-answer-h">${escapeHtml((t.act && t.act.name) || 'Training')} — her own rating</p>
      <div class="pn-rates">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="pn-rate${a.self === n ? ' on' : ''}"
        data-pn-action="answer-attitude" data-n="${n}" aria-pressed="${a.self === n}">${n}</button>`).join('')}</div>`;
  }

  // Learning — only a grown-up logs it.
  const items = (mrRulesForWeek(wk).learning || {}).items || [];
  const learning = items.map(it => {
    const units = mrGetLearning(kid, wk, d, it.id);
    return `<div class="pn-learn"><span class="pn-text"><span class="pn-title">${escapeHtml(it.label)}</span>
        <span class="pn-sub">${units} ${escapeHtml(it.unit || '')}</span></span>
      <button type="button" class="pn-step" data-pn-action="answer-learn" data-item="${escapeAttr(it.id)}" data-delta="-1"
        aria-label="${escapeAttr('Less ' + it.label)}">−</button>
      <button type="button" class="pn-step" data-pn-action="answer-learn" data-item="${escapeAttr(it.id)}" data-delta="1"
        aria-label="${escapeAttr('More ' + it.label)}">+</button></div>`;
  }).join('');

  const section = (title, html) => html ? `<p class="pn-answer-h">${title}</p>${html}` : '';
  return `<div class="pn-card pn-answer">${head}
      ${section('Chores', jobs + elseHtml)}
      ${section('Own things · helping out', lanes)}
      ${training}
      ${section('Learning', learning)}
      <p class="pn-note">Her answers, given for her. Grading stays in Chores, and nothing is paid until the meeting.</p>
    </div>`;
}
/* The writes, each through the chore tab's writer; then Now repaints. */
function pnAnswerClick(a, el) {
  if (!isParent()) return;
  const { kid, wk, d, todayIdx } = pnAnswerTarget();
  if (a === 'answer-kid')  { pnAnswerKid = el.getAttribute('data-kid') === 'jess' ? 'jess' : 'jenn'; pnAnswerElse = false; pnRenderNow(); return; }
  if (a === 'answer-day')  {
    const i = Number(el.getAttribute('data-day'));
    if (i >= 0 && i <= todayIdx) { pnAnswerDay = i; pnAnswerElse = false; pnRenderNow(); }
    return;
  }
  if (mnyWeekSettled(wk, kid)) return;
  if (a === 'answer-else') { pnAnswerElse = !pnAnswerElse; pnRenderNow(); return; }
  if (a === 'answer-claim' || a === 'answer-else-pick') {
    const id = el.getAttribute('data-chore');
    const row = mrPoolRow(id, wk);
    if (!row || mrGetChoreGrade(kid, wk, d, id) > 0) return;
    pnAnswerElse = false;
    openChoreClaimPrompt(kid, wk, d, id, row.label).then(() => pnRenderNow());
    return;
  }
  if (a === 'answer-personal') { ctCyclePersonalFor(kid, wk, d, el.getAttribute('data-chore')); pnRenderNow(); return; }
  if (a === 'answer-attitude') { if (ckRateSelfFor(kid, wk, d, Number(el.getAttribute('data-n')) || 0)) pnRenderNow(); return; }
  if (a === 'answer-learn') {
    if (ctBumpLearningFor(kid, wk, d, el.getAttribute('data-item'), Number(el.getAttribute('data-delta')) || 0)) pnRenderNow();
  }
}

function pnRenderNow() {
  const wrap = document.getElementById('pnWrap');
  if (!wrap) return;
  if (!isParent()) { wrap.innerHTML = `<div class="pn-card">Parents only 🔒</div>`; return; }
  ctPrepareRead();
  if (!ctWeekKey) ctSetCurrentWeekFromPlanner();
  /* The queue's backlog line is the only representation of the backlog here
     (the catch-up screen is where that work happens; the meeting hub still
     lists the weeks). */
  const open = pnOpenCount(pnScopeKids());
  wrap.innerHTML = `<div class="pn-grid">
      <div class="pn-main">
        <div class="pn-wait-head">
          <h2 class="pn-wait-title">✅ Waiting for you</h2>
          <span class="pn-count">${open} open</span>
          <span class="pn-strap">Nothing pays until it passes here.</span>
          <span class="pn-wait-toggles">
            ${pnSeg('Whose questions', 'scope', [['jenn', 'Jenn'], ['jess', 'Jess'], ['both', 'Both']], pnScope())}
            ${pnSeg('Group them', 'groupby', [['girl', 'By girl'], ['kind', 'By kind']], pnGroupBy())}
          </span>
        </div>
        ${pnQueueCard()}
        ${pnRequestsHtml()}
      </div>
      <div class="pn-side">
        ${pnSundayCard()}
        ${pnLastAnswerCard()}
        ${pnOwnsCard()}
        <div class="pn-sidebtns">
          <button type="button" class="pn-sidebtn" data-pn-action="record">✍️ Record</button>
          <button type="button" class="pn-sidebtn" data-pn-action="told">🚪 She told me…</button>
        </div>
        ${pnTidyCard()}
      </div>
    </div>`;
  pnRenderToldSheet();
  // The count on the tab itself, so a parent sees there is work without opening.
  const badge = document.getElementById('pnTabBadge');
  if (badge) {
    const n = pnWaitingCount();
    badge.textContent = n || '';
    badge.hidden = !n;
  }
}

/* One delegated listener, bound in js/99-main.js. Every queue row routes to
   the screen that owns the work rather than doing it here; the on-her-behalf
   card's controls go to pnAnswerClick, which calls the chore tab's writers. */
function pnHandleClick(e) {
  const el = e.target.closest('[data-pn-action]');
  if (!el) return;
  const a = el.getAttribute('data-pn-action');
  // On her behalf (rows 7 and 8): the one place on Now that writes, and only
  // through the chore tab's own writers — see pnAnswerCard.
  if (a === 'answer-kid' || a === 'answer-day' || a === 'answer-else' || a === 'answer-claim'
      || a === 'answer-else-pick' || a === 'answer-personal' || a === 'answer-attitude'
      || a === 'answer-learn') { pnAnswerClick(a, el); return; }
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
  /* ✅ Waiting for you's own controls (§N 5): whose questions and how they
     are grouped, remembered on this device; 🚪 She told me…; 🔧 Tidy-up. */
  if (a === 'scope')   { pnLsSet(PN_SCOPE_LS_KEY, el.getAttribute('data-kid')); pnRenderNow(); return; }
  if (a === 'groupby') { pnLsSet(PN_GROUP_LS_KEY, el.getAttribute('data-kid')); pnRenderNow(); return; }
  if (a === 'told')       { pnOpenToldSheet(); return; }
  if (a === 'told-close') { pnSheetOpen = false; closeSheet('pnToldOverlay'); return; }
  if (a === 'tidy')       { pnTidyOpen = !pnTidyOpen; pnRenderNow(); return; }
  if (a === 'loans') {
    /* Section first: setParentScope re-renders the tab it is standing on, so
       setting it afterwards would paint the money page twice. Her loan rows
       live on Money › ➕ Commitments (Stage 4b). */
    mnyParentSection = 'commit';
    setParentTab('money');
    return;
  }
  if (a === 'meeting')  { openFamilyMeetingAsk(); return; }
  if (a === 'fullweek') { parentView(parentViewing); return; }
  if (a === 'day')      { openFamilyMeetingAt(1, Number(el.getAttribute('data-day'))); return; }
}
