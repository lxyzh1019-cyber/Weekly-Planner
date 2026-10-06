// Weekly-Planner — the Sunday meeting's money: who is on screen, the working
// behind a payday line, planned meets, and THE SIGN — the one place money
// moves. Classic script, declarations only (MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   THE MONEY STEP · SUNDAY v15 (Plan v3 §A, §E)

   The meeting's money step is the Sunday ritual — Guess → Payday → I choose
   → Signed, one girl at a time — drawn by js/44-sunday.js over the pure core
   (js/43-sunday-core.js). This file keeps what the ritual shares with the
   rest of the meeting: whose money is on screen (`mnyMeetingKid`), the strip
   My money and the parent page still draw (`mnyStrip`), the working behind a
   payday line (`mnyWorking`), the planned meets a week must answer
   (`mmPlannedCompetitions` / `mmUnrecordedCompetitions`) and the one-tap
   "No criteria met · $0", the parent's before-we-start list — and the sign,
   `mnyDoCommit`, rewritten in Stage 4 so every dollar moves through the
   function that owns it, In = Out asserted before anything is written.

   Retired in Stage 4 (deleted with their CSS and actions): "What I earned"
   and "What I do with it" (`mnyRenderEarned`, `mnyRenderDecide`), the
   earnings, income-bar, pool, plan, bucket, change-plan, door, reflect,
   commit and committed cards, the inline competition and money-from-outside
   forms, the confirm bar, the three shortfall choices (`MNY_SHORTFALL`) and
   the meeting-wide Undo button. A result or a gift is entered at the table
   through the Record sheet (Dad's ➕ on Sunday's "Dad answers first" card) or
   asked for by her (js/45) — one writer each.
   ════════════════════════════════════════════════════════════════ */

let mnyMeetKid = 'jess';       // whose money the step is showing
let mnyExpandRow = null;       // which channel's day-by-day working is open (Payday)
let mnyChecksOpen = false;

function mnyMeetingKid() { return (mnyMeetKid === 'jenn' || mnyMeetKid === 'jess') ? mnyMeetKid : 'jess'; }
function mnySetMeetKid(kid) {
  mnyMeetKid = kid;
  mnyExpandRow = null;
  renderMeetingMode();
}
function mnyWeekKeyMeeting() { return ctWeekKey || ctThisWeekKey(); }

/* ── Money in → what has to go out → what is hers ──
   Three cells, and the one the current step is about is lit. Without it, "mine
   to choose" arrives as a number with no arithmetic behind it.

   FOUR callers now, deliberately one component: the kid's money page
   (js/22-money-page1.js, mnyThisWeekCard), meeting step 3, meeting step 4, and
   the parent portal (js/24-money-parent.js, mnyWeekResults). A second thing
   that draws these three numbers is a second thing that can drift, and drift
   is the bug this was pulled in to fix.

   `liveIdx` is meeting-only — it lights the cell the current step is about.
   Pass -1 anywhere there is no "current step", and nothing lights. */
function mnyStrip(wk, kid, liveIdx) {
  const pool = mnyPool(wk, kid);
  const cells = [
    { label: 'Money that came in', value: pool.cameIn },
    { label: 'My loan payment', value: pool.mustPay },
    { label: 'Mine to choose', value: pool.mine },
  ];
  return `<div class="mny-strip">${cells.map((c, i) =>
    `<div class="mny-strip-cell${i === liveIdx ? ' on' : ''}">
       <div class="mny-label">${escapeHtml(c.label)}</div>
       <div class="mny-strip-val">${mnyMoney(c.value)}</div>
     </div>`).join('<span class="mny-strip-arrow">→</span>')}</div>`;
}

/* Tapping a row opens the working behind it — the six days, the bundles, the
   run of clean days, the date of each fine. An amount nobody can take apart is
   an amount nobody can argue with, and this whole system runs on her being
   able to argue with it. */
function mnyWorking(wk, kid, channel, b) {
  const line = (l, v) => `<div class="mny-row"><span>${escapeHtml(l)}</span><b>${v}</b></div>`;
  // Days named from their own date: a Sun–Sat money week starts on the
  // Sunday before its Monday (Deviation 34).
  const dayName = (k) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][formatDayKey(k).getDay()];
  if (channel === 'chores') {
    const c = b.chores;
    return c.days.map(d => line(dayName(d.dayKey), d.taken ? 'paid the week before' : mnyMoney(d.paid))).join('')
      + (c.freeUsed.length ? `<div class="mny-note">${c.freeUsed.length} free job${c.freeUsed.length > 1 ? 's' : ''} used — always your lowest-paying ones.</div>` : '')
      + (c.overflowChores ? `<div class="mny-note">${c.overflowChores} job${c.overflowChores > 1 ? 's' : ''} past your daily most — those earned XP.</div>` : '');
  }
  if (channel === 'learning') {
    return b.learning.lines.map(l => line(
      l.label + (l.voided ? ' (' + l.voided + ' did not count)' : ''),
      l.xp ? l.xp + ' XP' : mnyMoney(l.amount))).join('')
      || `<div class="mny-note">Nothing counted this week.</div>`;
  }
  if (channel === 'streak') {
    return line('Longest run of days with all three routines kept', b.streak.days + ' days')
      + (b.streak.tier ? line('That pays the ' + b.streak.tier + '-day step', mnyMoney(b.streak.bonus))
                       : `<div class="mny-note">Three days in a row with morning, afternoon and evening all closed is the first step.</div>`);
  }
  if (channel === 'comp') {
    const entries = mrCompetitions(kid).filter(c => String(c.dayKey) >= wk && String(c.dayKey) <= mnyWeekEnd(wk));
    return entries.length
      ? entries.map(c => line(mnySportIcon(c.sport) + ' ' + (c.name || mnySportLabel(c.sport)) + ' · ' + mnyShortDate(c.dayKey), mnyMoney(c.awarded))).join('')
      : `<div class="mny-note">No competition days this week.</div>`;
  }
  if (channel === 'sessions') {
    const s = b.sessions || { sessions: [] };
    return (s.sessions || []).map(x => line(dayName(x.dayKey),
        x.attended === true ? '✓ ' + mnyMoney(s.rate) : x.attended === false ? 'missed · $0' : '? not ticked')).join('')
      || `<div class="mny-note">No club sessions this week.</div>`;
  }
  if (channel === 'fines') {
    const rows = b.fines.perDay.filter(d => d.raw > 0);
    return rows.length
      ? rows.map(d => line(dayName(d.dayKey), '−' + mnyMoney(d.applied).slice(1) +
          (d.applied < d.raw ? ' (a day never goes below $0)' : ''))).join('')
      : `<div class="mny-note">Nothing taken off this week.</div>`;
  }
  return '';
}

function mnyWeekEnd(wk) {
  const d = formatDayKey(wk); d.setDate(d.getDate() + 6);
  return ctDateToKey(d);
}

/* ── The planner arranged it; the meeting pays for it ──
   The competition form asked a parent to retype the name of a meet that was
   already sitting on the week's plan. Two records of one afternoon, kept in
   agreement by hand, is how they come to disagree — and the planner is the one
   that had the name first, so it supplies it.

   It supplies FACTS only: which meet, which day, which sport. What the result
   was worth is still decided here, by mrScoreCompetition against the rules of
   that date, because a second place that decides what money moves is a second
   place that can disagree with the first. When no competition was planned, the
   form is exactly what it was — an empty name to type into. */
/* Tag → sport. The inverse lives in js/18-rules.js as `mrTagForSport`.
   `dryland` and `general` are absent on purpose: neither names a sport the
   rulebook can score, so a block tagged with one yields null and the form ASKS
   rather than guessing. It used to yield null too — but `mmSeedCompDraft`'s
   base then silently made it 'swim', so a dance meet and a dryland session both
   arrived pre-filled as swimming. */
const MM_COMP_SPORT_FROM_TAG = { swimming: 'swim', skating: 'skate', dance: 'dance' };
/* What a planned block says its sport is, or null when nothing can say. A
   custom sport the family added — dance, gymnastics, diving — resolves by its
   own id or name, the same way mrTagForSport goes the other way. */
function mmSportForTag(tag) {
  const direct = MM_COMP_SPORT_FROM_TAG[String(tag)];
  if (direct) return direct;
  const known = ['swim', 'skate', 'dance'];
  const want = String(tag || '').trim().toLowerCase();
  if (known.includes(want)) return want;
  const topic = (typeof getTrainingTopic === 'function') ? getTrainingTopic(tag) : null;
  const name = String((topic && topic.name) || '').toLowerCase();
  return known.find(k => name.includes(k)) || null;
}

function mmPlannedCompetitions(wk, kid) {
  const out = [];
  mrWeekDayKeys(wk).forEach(dayKey => {
    (getDayBlocksForProfile(dayKey, kid) || []).forEach(b => {
      if (typeof blockIsCompetition !== 'function' || !blockIsCompetition(b)) return;
      const disp = blockDisplayName(b, kid);
      // "Competition" and "Skating Comp." are what the app calls an unnamed
      // one; neither is a name a parent typed, so neither is offered as one.
      const name = (b.compName || '').trim()
        || (/^(Competition|.+ Comp\.)$/.test(disp.name) ? '' : disp.name);
      out.push({ dayKey, name, sport: mmSportForTag(b.tag),
                 blockId: b.id || null, compId: b.compId || null,
                 startMin: b.startMin || 0, icon: disp.icon });
    });
  });
  return out.sort((a, b) =>
    a.dayKey < b.dayKey ? -1 : a.dayKey > b.dayKey ? 1 : a.startMin - b.startMin);
}

/* The planned competitions this week that have not been written down yet.
   Matched on the day rather than the name: a parent who corrects the spelling
   while recording the result has still recorded that afternoon. */
/* Matched on the day AND the name. Matching by dayKey alone meant two meets on
   one Saturday were both satisfied by recording either of them — the second
   would never be asked for, and its money would never be entered. A meet with
   no name recorded still answers for the unnamed planned one on that day, which
   is the honest reading of a parent who typed nothing. */
function mmCompKey(dayKey, name) {
  return String(dayKey) + '|' + String(name || '').trim().toLowerCase();
}
/* ── THE JOIN, BY ID FIRST ──
   `mmCompKey` is a day plus a lowercased name, and BOTH SIDES ARE MUTABLE. A
   parent who fixes a spelling while recording the result leaves the planned
   meet permanently unrecorded — and an unrecorded planned meet DISABLES THE
   CONFIRM BAR, so the week cannot settle and nothing on screen says why.

   A meet and its block now carry each other's id (`mrPlaceCompetitionBlock`,
   js/18-rules.js), so the first question asked is the one that cannot drift.
   The name match stays as the fallback, because every meet already on file
   carries no id at all — derived, never migrated, the same reasoning as `xp2`
   and the per-leg buffers. */
function mmUnrecordedCompetitions(wk, kid) {
  const inWeek = mrCompetitions(kid)
    .filter(c => String(c.dayKey) >= wk && String(c.dayKey) <= mnyWeekEnd(wk));
  const doneBlockIds = new Set(inWeek.map(c => c.blockId).filter(Boolean));
  const doneCompIds = new Set(inWeek.map(c => c.id).filter(Boolean));
  const done = new Set(inWeek.map(c => mmCompKey(c.dayKey, c.name)));
  const daysWithUnnamed = new Set(inWeek.filter(c => !String(c.name || '').trim())
    .map(c => String(c.dayKey)));
  return mmPlannedCompetitions(wk, kid).filter(p => {
    /* `p.compId` is what carries the ordinary case: recording a result ADOPTS
       the planned block (mrPlaceCompetitionBlock), so the block itself knows it
       has been answered and no name is consulted at all. That single line is
       what unjams the corrected spelling.

       The two id tests above it are the two-device case, and are not
       redundant: a record can arrive from the phone carrying `blockId` before
       the iPad's copy of the block has merged and been stamped. Asking from
       both ends means the meet reads as recorded whichever half lands first. */
    if (p.blockId && doneBlockIds.has(p.blockId)) return false;
    if (p.compId && doneCompIds.has(p.compId)) return false;
    if (p.compId) return false;
    return !done.has(mmCompKey(p.dayKey, p.name))
      && !(!String(p.name || '').trim() && daysWithUnnamed.has(String(p.dayKey)));
  });
}

/* The one-tap answer. A real record, worth nothing, which is a different fact
   from no record at all — and it is what unblocks the settle gate below. */
function mnyRecordCompZero(kid, dayKey, name, sport) {
  if (!isParent()) { showToast('A grown-up records results 🔒'); return; }
  const wk = mmWeekKey();
  mrAddCompetition(kid, { dayKey, name, sport: sport || 'swim', points: 0 });
  mnyReopenWeek(kid, wk);
  saveAll();
  renderMeetingMode();
  showToast(`Recorded — ${mnyMoney(0)}, no criteria met`);
}

/* The parent's before-we-start list. Collapsed, because on a good week it is
   seven ticks and nobody needs to read it.

   It used to render inside step 4 — after step 3 had already agreed the week —
   which made a list called "before we start" into a post-mortem. It belongs at
   the top of step 1, and that is where mmRenderReview now calls it. */
function mnyChecklist(wk, kid) {
  const checks = mnyChecks(wk, kid);
  const done = MNY_CHECKS.filter(c => checks[c.id]).length;
  if (!mnyChecksOpen) {
    return `<button type="button" class="mny-btn wide" onclick="mnyToggleChecks()">
      🧭 Before we start — ${done} of ${MNY_CHECKS.length} ready ▸</button>`;
  }
  return `<div class="mny-card">
      <div class="mny-week-head"><span class="mny-label">🧭 Before we start</span>
        <button type="button" class="mny-chip" onclick="mnyToggleChecks()">Hide ▾</button></div>
      <div class="mny-checks">${MNY_CHECKS.map(c =>
        `<button type="button" class="mny-chip ${checks[c.id] ? 'on' : ''}" onclick="mnyTickCheck('${escapeJsAttr(c.id)}')">${checks[c.id] ? '✓' : '○'} ${escapeHtml(mnyCheckLabel(c, wk, kid))}</button>`).join('')}</div>
    </div>`;
}

/* A check's words. The chores check names the days its money week pays —
   "Chores graded for every day, Mon 5 – Sun 11 Oct" (`mrMoneyWeekLabel`). */
function mnyCheckLabel(c, wk, kid) {
  return c.id === 'c1' ? `${c.label}, ${mrMoneyWeekLabel(wk, kid)}` : c.label;
}

/* One real year, drawn from real prices. A company that only ever goes up is
   not a lesson about companies. `mnyStockDrop` is the fall the chart's note
   names, from the chart's own prices — the 📈 idea's text reads the same
   number (`{stockDrop}`), so the two cannot drift. */
function mnyStockDrop() {
  const series = STOCKS_2023.TSLA.prices;
  return Math.abs(Math.round(((Math.min(...series.slice(2, 5)) - series[2]) / series[2]) * 100));
}
/* 📈 Money school's Companies card: the chart, the sentence, and a door to
   the idea behind it (the same sheet every idea opens). */
function mnyStockChart() {
  const series = STOCKS_2023.TSLA.prices;
  const lo = Math.min(...series), hi = Math.max(...series);
  const pts = series.map((v, i) =>
    `${(i / (series.length - 1)) * 100},${30 - ((v - lo) / (hi - lo)) * 26}`).join(' ');
  return `<div class="mv2-card mv2-school-chart">
      <div class="mv2-cardhead"><span class="mv2-title">📈 Companies go down too</span></div>
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" class="mv2-spark" role="img" aria-label="One company's price through 2023">
        <polyline points="${pts}" fill="none" style="stroke:var(--mny-spark-line)" stroke-width="1.4" vector-effect="non-scaling-stroke"/>
      </svg>
      <div class="mv2-line">This really happened, back in 2023. One company fell ${mnyStockDrop()}% in three months, then went back up. Nobody knew it would.</div>
      ${mnyDoor('idea', '📈 Owning a bit of a company', ' data-mny-concept="stock"')}
    </div>`;
}

/* Buy whichever fund the rules currently name. A fixed menu, never a text box
   (see MNY_FUNDS) — and the two blended options are not real tickers, so they
   are held as their own record rather than pretending to be a company. */
function mnyBuyChosenFund(kid, dollars, opts) {
  const fundId = ((mrRules().investing || {}).fund) || 'index';
  const fund = MNY_FUNDS.find(f => f.id === fundId) || MNY_FUNDS[0];
  if (fund.ticker) { moneyBuyStock(kid, fund.ticker, dollars, opts); return; }
  const w = ensureWallet(kid);
  const amt = money2(Math.min(dollars, w.cash));
  if (!(amt > 0)) return;
  w.cash = money2(w.cash - amt);
  evMirror(kid, Object.assign({ kind: 'invest', note: fund.label },
                              opts || {}, { from: 'cash', to: 'invest', amount: amt }));
  const held = mnyHoldingsOfKind(kid, 'stock').find(h => h.fundId === fund.id);
  if (held) {
    held.units = 1;
    held.priceNow = money2(mnyHoldingValue(held) + amt);
    held.costBasis = money2(money2(held.costBasis) + amt);
    held.updatedAt = syncNow();
  } else {
    // A blended fund has no share price to look up, so it grows at a rate like
    // a savings account does — just a much better one, with the risk to match.
    mnyAddHolding(kid, { kind: 'stock', name: fund.label, fundId: fund.id,
                         units: 1, priceNow: amt, costBasis: amt,
                         rateAnnual: MNY_FUND_RATES[fund.id] || 0 });
  }
  saveAll();
}
function mnyToggleChecks() { mnyChecksOpen = !mnyChecksOpen; renderMeetingMode(); }
function mnyTickCheck(id) { mnyToggleCheck(mnyWeekKeyMeeting(), mnyMeetingKid(), id); renderMeetingMode(); }
/* One reason for the week, applied to every change made in it (Sunday's ✏️
   on a Payday line asks for it before "Now I choose →"). One writer, two
   doors: Sunday passes nothing (the meeting's girl and week, and the meeting
   redraws); Grown-ups › ✅ Approve › This Sunday passes the girl and week and
   redraws itself. */
function mnyPickReason(id, kidArg, wkArg) {
  const wk = wkArg || mnyWeekKeyMeeting(), kid = kidArg || mnyMeetingKid();
  const ov = mnyOverrides(kid, wk);
  Object.keys(ov).forEach(k => { ov[k].reason = id; });
  mrStampEarnings(kid, wk);
  saveAll();
  if (!kidArg) renderMeetingMode();
}

/* ── An express catch-up's loan (Stage 4b) ──
   A week caught up from the hub is settled by commitKidWeek, which no longer
   pays the loan; this pays that Sunday's must-pay through the sign's own loan
   step (mnySundayLoanStep) and writes it on the week's record, under the names
   the passbook reads. Nothing extra is placed: she was not there to choose.
   Skips a week already signed on Sunday (its record has its loan) and a
   Sunday the loan was already paid for. */
function mnyCatchUpLoan(kid, wk) {
  ctEnsureShared();
  const led = ((state.shared.chore.moneyLedger || {})[wk] || {})[kid];
  if (!led || led.loan) return null;
  const { out, interest } = mnySundayLoanStep(kid, wk, 0);
  if (out.already) return null;
  Object.assign(led, {
    loan: { kind: 'sunday', paid: out.paid, must: out.must, shortfall: out.shortfall,
            interest, extraCredited: 0, each: out.each },
    debtBalanceAfter: mnyTotalOwing(kid),
    updatedAt: syncNow(),
  });
  saveAll();
  return out;
}

/* ════════════════════════════════════════════════════════════════
   THE SIGN — the one place money actually moves (Plan v3 §E)

   Hold to sign on Sunday's "I choose" step calls this for ONE girl. Her
   choices are the device-local Sunday draft (js/44); the arithmetic is the
   core's `sdSign` over the same input the screen drew (`sdBuildInput`), and
   In = Out is asserted (`sdCheckInOut`) BEFORE anything is written — a
   mismatch refuses with a sentence and moves nothing. Then, in order, each
   movement through the function that owns it:

     1  mmUndoHeld(kid) · mnySimCatchUp · approved 🧱 wall moves · passive
     2  mmTakeUndoSnapshot(wk, kid) — this girl only (↺ Redo)
     3  money from outside: cash brought from home (mnyAddDeposit), 🏦 From
        my Savings (moneyWithdraw), any approved gift not yet credited
     4  commitKidWeek — the frozen ledger, net to cash, XP, the box
     5  ⏪ advances: a "forgot to ask" becomes a yes through mnyAddRequest,
        then each yes is spent (moneySpendCash), stamped `appliedWeek`
     6  the loan: must-pay oldest first, then extra × (1 + bonus)
        (mnyLoanSundayPayment → mnyLoanPayExtra), interest every N Sundays
        (loanAccrueBalanceInterest)
     7  placement: 🎯 goal jars nearest date first (moneyDepositGoal,
        {goalId}), 🔒 Locked away for `pots.lockWeeks` weeks (moneyOpenGIC),
        📈 Companies (mnyBuyChosenFund), 🏦 Savings with the cents and any
        overflow (moneyDeposit), 💵 cash out handed over (moneySpendCash)
     8  the ledger row under the names the passbook reads, the questions she
        asked stamped `appliedWeek`, the plan (`committedAt`), the passive
        baseline, mmUndoSeal(kid); both girls signed → commitMeetingShared.

   Returns { ok, why } — and the core's result on success. Express catch-up
   (commitFamilyMeeting) settles a week through commitKidWeek, then pays that
   Sunday's must-pay through the same loan step (mnyCatchUpLoan, below).
   ════════════════════════════════════════════════════════════════ */
function mnyDoCommit(kidArg, wkArg) {
  const kid = (kidArg === 'jenn' || kidArg === 'jess') ? kidArg : mnyMeetingKid();
  const wk = wkArg || mnyWeekKeyMeeting();
  if (!isParent()) { showToast('A grown-up moves the money 🔒'); return { ok: false, why: 'A grown-up moves the money 🔒' }; }
  if (mnyIsCommitted(wk, kid)) return { ok: false, why: 'This week is already signed.' };

  // 1 · the world brought up to today; approved wall moves go first (they were
  //     answered before this Sunday — Plan v5 Deviation 25).
  mmUndoHeld(kid);
  mnySimCatchUp(kid);
  mnyApplyApprovedWallMoves(kid, wk);
  // A changed "loan per month" first, so the pile below asks the new must-pay.
  sdRescaleLoanRows(kid, wk);
  const passive = mnyPassiveSinceLastMeeting(kid);

  // The input the screen drew, and what signing it does — refused before any write.
  const ctx = sdBuildInput(kid, wk);
  const res = sdSign(ctx.w, ctx.rules);
  if (!res.ok) { showToast(res.why); return { ok: false, why: res.why }; }
  const io = sdCheckInOut(res.signed);
  if (!io.ok) { showToast(io.why); return { ok: false, why: io.why }; }
  const sg = res.signed, f = ctx.f, alloc = sdAlloc(ctx.w.alloc);
  const readyOpen = sdIsOpen('ready', ctx.w, ctx.rules);

  // 2 · her own snapshot (↺ Redo returns her and only her).
  mmTakeUndoSnapshot(wk, kid);

  // 3 · money from outside joins the pile through its owners.
  if (f.homeCash > 0) {
    mnyAddDeposit(kid, wk, { amount: f.homeCash, from: 'Cash from home', dayKey: todayKey(),
                             requestKind: 'deposit', note: 'Brought from home on Sunday' });
  }
  if (f.pullReady > 0) moneyWithdraw(kid, f.pullReady, { note: '🏦 From my Savings — Sunday', weekKey: wk });
  mnyDepositsForWeek(kid, wk).forEach(dep => {
    if (dep.appliedAt || dep.pendingApproval || dep.rejectedAt) return;
    moneyAddCash(kid, dep.amount, mnyGiftMirror(dep));
    dep.appliedAt = Date.now();
    dep.updatedAt = syncNow();
  });

  // 4 · the week itself.
  commitKidWeek(wk, kid);

  // 5 · ⏪ drawn in advance: it was spent before Sunday, so it leaves now.
  if (f.advManual > 0) {
    mnyAddRequest(kid, { kind: 'adv', amount: f.advManual, status: 'yes', dayKey: mnyWeekEnd(wk),
                         why: 'Forgot to ask — added on payday',
                         text: `Drew ${mnyMoney(f.advManual)} early · added on payday` });
  }
  let advLeft = money2(sg.adv);
  mnyEnsureRequests(kid)
    .filter(r => r && r.kind === 'adv' && r.status === 'yes' && !r.appliedWeek)
    .sort((a, b) => (Number(a.answeredAt) || 0) - (Number(b.answeredAt) || 0))
    .forEach(r => {
      const owe = money2(money2(r.amount) - money2(r.appliedAmount));
      const pay = money2(Math.min(owe, advLeft));
      if (pay > 0) {
        moneySpendCash(kid, pay, { kind: 'advance', note: '⏪ Drawn in advance' + (r.why ? ' · ' + r.why : ''),
                                   ref: r.id, weekKey: wk });
        advLeft = money2(advLeft - pay);
        r.appliedAmount = money2(money2(r.appliedAmount) + pay);
      }
      if (money2(r.appliedAmount) >= money2(r.amount)) r.appliedWeek = wk;
      markItemUpdated(r);
    });

  // 6 · the loan: must-pay first, then extra counted at 1 + bonus.
  const { out: loanOut, interest } = mnySundayLoanStep(kid, wk, sg.extra);

  // 7 · where the rest goes.
  const toGoals = {};
  let goalLeft = money2(sg.goal);
  f.goalOrder.forEach(g => {
    if (!(goalLeft > 0)) return;
    const room = money2(Math.max(0, money2(g.target) - mnyGoalJarValue(kid, g)));
    const put = money2(Math.min(goalLeft, room));
    if (!(put > 0)) return;
    if (moneyDepositGoal(kid, put, { goalId: g.id, note: '🎯 Into my goal jar — Sunday', weekKey: wk })) {
      toGoals[g.id] = put;
      goalLeft = money2(goalLeft - put);
    }
  });
  const lockWeeks = Math.max(1, Number(mrRuleOr(ctx.rules, 'pots.lockWeeks')) || 4);
  if (sg.gic > 0) moneyOpenGIC(kid, sg.gic, { weeks: lockWeeks, weekKey: wk });
  if (sg.stock > 0) mnyBuyChosenFund(kid, sg.stock, { weekKey: wk });
  if (sg.ready > 0) moneyDeposit(kid, sg.ready, { note: '🏦 Savings — Sunday', weekKey: wk });
  if (alloc.spend > 0) moneySpendCash(kid, alloc.spend, { note: '💵 Cash out — handed over on Sunday', weekKey: wk });
  /* Whatever a cent of rounding left in her wallet (two debts each rounding
     their clearing figure) goes where the core sends cents — never left loose. */
  const loose = mnyCash(kid);
  let swept = 0;
  if (loose > 0.004) {
    if (readyOpen) { if (moneyDeposit(kid, loose, { note: '🪙 Change → Savings', weekKey: wk })) swept = loose; }
    else swept = mnyLoanPayExtra(kid, loose, wk, '🪙 Change on the wall').extra;
  }

  // 8 · the record.
  const c = state.shared.chore;
  const ledger = ((c.moneyLedger || {})[wk] || {})[kid];
  if (ledger) {
    // Cash from home is her own money, not a gift (Plan v17 item 10): it is
    // in 🏦 From my bank (`groups.bank`), never in 🎁 given.
    const given = money2(f.giftsIn);
    const extraPaid = money2(loanOut.extra + (readyOpen ? 0 : swept));
    Object.assign(ledger, {
      confirmedBy: 'a grown-up',
      plan: { id: 'sunday', label: 'Signed on Sunday' },
      deposits: given, outside: given,
      extra: extraPaid, debtExtra: extraPaid,
      loan: { kind: 'sunday', paid: loanOut.paid, must: loanOut.must, shortfall: loanOut.shortfall,
              interest, extraCredited: loanOut.extraCredited, each: loanOut.each },
      loanCash: sg.loanCash, advance: sg.adv, cashOut: alloc.spend,
      // `spend` is what the passbook reads as cash: cash out + advance (the prototype's wallet).
      spend: sg.wallet,
      goal: sg.goal, goals: toGoals,
      ready: money2(sg.ready + (readyOpen ? swept : 0)),
      gic: sg.gic, stock: sg.stock, cents: sg.cents,
      passive, guess: sg.guess, payday: sg.payday, hers: sg.hers, mustPay: sg.mustPay,
      groups: { earned: money2(sg.inSteady + f.compIn), given, made: Math.max(0, passive),
                bank: money2(sg.inBank), takenOff: money2(-sg.outFine + sg.adv) },
      sunday: { signed: sg, after: { left: res.after.left, pots: res.after.pots, loan: res.after.loan },
                crossed: res.crossed, w: f.lite },
      debtBalanceAfter: mnyTotalOwing(kid),
      // What she owns after this Sunday (Savings with the goal jars, Locked
      // away, Companies) — the Signed step's owe-vs-own chart reads it beside
      // `debtBalanceAfter` (Plan v17 §4). A row signed before it has neither
      // figure for the chart and is left out there.
      ownedAfter: money2(mnyReadyHomeTotal(kid) + mnyLockedTotal(kid) + mnyInvestedTotal(kid)),
      updatedAt: syncNow(),
    });
  }
  // Every question she asked that this Sunday used, stamped so no later
  // Sunday (or the other device) uses it again.
  mnyEnsureRequests(kid).forEach(r => {
    if (r && r.status === 'yes' && !r.appliedWeek && r.kind !== 'adv') { r.appliedWeek = wk; markItemUpdated(r); }
  });
  mnyEnsureMoveRequests(kid).forEach(r => {
    if (r && r.approvedAt && !r.appliedWeek) { r.appliedWeek = wk; markItemUpdated(r); }
  });
  mnyEnsureDeposits(kid).forEach(dep => {
    if (dep && dep.addedBy && !dep.pendingApproval && !dep.rejectedAt && dep.appliedAt && !dep.appliedWeek) {
      dep.appliedWeek = wk; markItemUpdated(dep);
    }
  });
  mnyConfirmWeek(wk, kid, 'signed on Sunday');
  mnySavePlan(wk, kid, { planId: 'sunday', label: 'Signed on Sunday', split: alloc,
                         presetId: f.presetId || null, guess: sg.guess, committedAt: syncNow() });
  mnyStampPassiveBaseline(kid);
  mmUndoSeal(kid);
  if (['jenn', 'jess'].every(k => mnyIsCommitted(wk, k))) commitMeetingShared(wk);
  saveAll();
  return { ok: true, res, ctx };
}
