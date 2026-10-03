// Weekly-Planner — what she asks a grown-up: the request queue, expected money, the club payout.
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   ASK DAD — ONE QUEUE, THREE STORES (Plan v3 §B, Sunday v15)

   A child asks for eight kinds of thing, and three of them already had a home
   before this redesign:

     🔀 move / 💵 cash out     profile.moveRequests  (mnyRequestMove, js/40)
     🎁 gift / 💵 cash in      profile.deposits      (mnyAddDeposit, js/21)
     🏆 result · 🎯 new goal · ⏪ draw early · ⛸️ can't make a session ·
     📦 a fine she disputes    profile.requests      (this file — NEW)

   A request is never a stream event: the stream records money that MOVED, and
   a request has moved nothing. So each store keeps its own records, and this
   file adds the ONE reader (`mnyRequestsFor`) that shows all three as one
   list, and the ONE answerer (`mnyAnswerRequest`) that routes a grown-up's
   yes / no / talk to the function that already owns each effect:

     comp      → mrAddCompetition (or mrUpdateCompetition) — Dad's − / +
                 figure goes beside her entry as `awardedOverride`
     goal      → mnySwitchGoal (mnyAddGoal + the jar follows)
     skip      → mrSetSessionAttendance(…, false) — missed pays $0, no fine
     dispute   → mrRemoveFine
     adv       → nothing moves at approval: the cash came from Dad's pocket;
                 Sunday takes it off her payday
     move      → mnyApproveMove / mnyRejectMove
     gift/dep  → mnyApproveDeposit

   Writers own no rules of their own beyond what the owner cannot check.
   `profile.requests` merges by id with a 'req:' tombstone (js/04-merge.js).
   ════════════════════════════════════════════════════════════════ */

const MNY_REQUEST_KINDS = ['comp', 'goal', 'adv', 'skip', 'dispute'];
const MNY_REQUEST_ICONS = { comp: '🏆', goal: '🎯', adv: '⏪', skip: '⛸️', dispute: '📦',
                            move: '🔀', cash: '💵', gift: '🎁', deposit: '💵' };
// What each home is called on her pages (handoff §5 naming table).
const MNY_REQUEST_POT_NAMES = { ready: '🏦 Savings', locked: '🔒 Locked away', invest: '📈 Companies',
                                cash: '💵 Cash out' };

function mnyEnsureRequests(kid) {
  const p = getProfData(kid);
  if (!Array.isArray(p.requests)) p.requests = [];
  return p.requests;
}

/* May this person ask, or answer, for this kid? A child asks for herself only;
   a grown-up may add one on her behalf (the advance she forgot to ask for). */
function mnyRequestMayAsk(kid) {
  if (isParent()) return true;
  return (typeof activeProfile === 'function') ? activeProfile() === kid : true;
}

/* ⏪ What she has drawn early this week, asked or already given. */
function mnyAdvanceUsed(kid, weekKey) {
  return money2(mnyEnsureRequests(kid)
    .filter(r => r && r.kind === 'adv' && r.weekKey === weekKey && r.status !== 'no')
    .reduce((s, r) => s + money2(r.amount), 0));
}

/* She asks. Returns the record, or null with the reason said out loud.
   `move`, `gift` and `deposit` go to the stores that already own them, so a
   sheet has one door for every kind. */
function mnyAddRequest(kid, fields) {
  const f = fields || {};
  const kind = String(f.kind || '');
  if (!mnyRequestMayAsk(kid)) { showToast('You can ask for yourself 🙂'); return null; }
  if (kind === 'move') return mnyRequestMove(kid, f.from, f.to, f.amount, f.note);
  if (kind === 'gift' || kind === 'deposit') {
    const dayKey = f.dayKey || todayKey();
    return mnyAddDeposit(kid, ctWeekKeyForDate(dayKey), {
      amount: f.amount, from: f.from || (kind === 'deposit' ? 'Cash from home' : MNY_FROM[1]),
      giver: f.giver || '', dayKey, requestKind: kind, note: String(f.note || '').slice(0, 80) });
  }
  if (MNY_REQUEST_KINDS.indexOf(kind) < 0) { showToast('That is not something to ask for here.'); return null; }
  const dayKey = f.dayKey || todayKey();
  const weekKey = ctWeekKeyForDate(dayKey);
  const r = {
    id: mrNewId('req-'), kind, status: null, askedAt: syncNow(), answeredAt: null,
    appliedWeek: null, by: (typeof activeProfile === 'function') ? activeProfile() : kid,
    dayKey, weekKey, text: String(f.text || '').slice(0, 120),
    createdAt: syncNow(), updatedAt: syncNow(),
  };
  if (kind === 'comp') {
    const races = Array.isArray(f.races) ? f.races.map(x => ({
      ev: String((x && x.ev) || '').slice(0, 40), time: String((x && x.time) || '').slice(0, 20),
      pts: Number(x && x.pts) || 0 })) : [];
    Object.assign(r, {
      compId: f.compId || null, blockId: f.blockId || null, custom: !!f.custom,
      sport: String(f.sport || ''), name: String(f.name || '').trim().slice(0, 60), races,
      pts: races.length ? races.reduce((s, x) => s + x.pts, 0) : (Number(f.pts) || 0),
      grp: Number(f.grp) || 0, ovr: Number(f.ovr) || 0,
      qualified: !!f.qualified, provincial: !!f.provincial,
    });
    if (!r.sport && !r.name) { showToast('Which meet was it?'); return null; }
  } else if (kind === 'goal') {
    Object.assign(r, { name: String(f.name || '').trim().slice(0, 40), icon: f.icon || '🎯',
      target: money2(f.target), keep: f.keep === 'ready' ? 'ready' : 'move' });
    if (!r.name) { showToast('What is the goal called?'); return null; }
    if (!(r.target > 0)) { showToast('How much does it cost?'); return null; }
  } else if (kind === 'adv') {
    const max = money2(mrRuleOr(mrRulesForWeek(weekKey), 'advance.maxPerWeek'));
    const amount = money2(f.amount);
    const left = money2(Math.max(0, max - mnyAdvanceUsed(kid, weekKey)));
    if (!(amount > 0)) { showToast('How much?'); return null; }
    if (amount > left) {
      showToast(`I can draw up to ${mnyMoney(max)} a week — ${mnyMoney(left)} left this week.`);
      return null;
    }
    Object.assign(r, { amount, day: String(f.day || '').slice(0, 10), why: String(f.why || '').slice(0, 80) });
  } else if (kind === 'skip') {
    if (!f.blockId) { showToast('Which session?'); return null; }
    Object.assign(r, { blockId: f.blockId, why: String(f.why || '').slice(0, 80) });
  } else if (kind === 'dispute') {
    const fine = mrFines(kid).find(x => x && x.id === f.fineId);
    if (!fine) { showToast('That fine is not on the record.'); return null; }
    Object.assign(r, { fineId: fine.id, why: String(f.why || '').slice(0, 80) });
  }
  /* "Forgot to ask" on payday: a grown-up adds it already answered, through
     this same writer, so it reads like any other yes. */
  if (isParent() && f.status === 'yes') {
    r.status = 'yes'; r.answeredAt = syncNow(); r.answeredBy = 'a grown-up';
  }
  mnyEnsureRequests(kid).push(r);
  saveAll();
  return r;
}

/* Take back a question nobody has answered. Tombstoned, so the other device
   does not hand it back. */
function mnyWithdrawRequest(kid, id) {
  if (!mnyRequestMayAsk(kid)) return false;
  const list = mnyEnsureRequests(kid);
  const i = list.findIndex(r => r && r.id === id);
  if (i < 0) return false;
  if (list[i].status === 'yes') { showToast('Already answered — ask a grown-up to change it.'); return false; }
  list.splice(i, 1);
  tombstoneIds('req:', [id]);
  saveAll();
  return true;
}

/* ── One reader: every question she has asked, in one shape ──
   {id, store, kind, status, text, icon, amount, open, applied, askedAt,
    answeredAt, weekKey, record}. `open` is "still waiting on a grown-up" —
   unanswered or "let's talk" — which is what blocks payday. Sorted oldest
   question first. */
function mnyRequestStatusOf(store, r) {
  if (store === 'requests') return r.status || null;
  if (store === 'moveRequests') {
    return r.approvedAt ? 'yes' : r.rejectedAt ? 'no' : r.talkAt ? 'talk' : null;
  }
  // deposits: a proposal she made
  if (r.rejectedAt) return 'no';
  if (!r.pendingApproval && r.appliedAt) return 'yes';
  return r.talkAt ? 'talk' : null;
}
function mnyRequestText(store, r) {
  if (r.text) return r.text;
  if (store === 'moveRequests') {
    const from = MNY_REQUEST_POT_NAMES[r.from] || r.from, to = MNY_REQUEST_POT_NAMES[r.to] || r.to;
    return r.to === 'cash'
      ? `Cash out ${mnyMoney(r.amount)} from ${String(from).replace(/^\S+ /, '')}`
      : `Move ${mnyMoney(r.amount)} ${String(from).replace(/^\S+ /, '')} → ${String(to).replace(/^\S+ /, '')}`;
  }
  if (store === 'deposits') return `${mnyGiftLabel(r)} · ${mnyMoney(r.amount)}`;
  if (r.kind === 'comp') return `${r.name || mnySportLabel(r.sport)} · ${r.pts} pts`;
  if (r.kind === 'goal') return `New goal: ${r.icon || '🎯'} ${r.name} · ${mnyMoney(r.target)}`;
  if (r.kind === 'adv') return `Draw ${mnyMoney(r.amount)} early${r.why ? ' · ' + r.why : ''}`;
  if (r.kind === 'skip') return `Can't make a club session${r.why ? ' · ' + r.why : ''}`;
  if (r.kind === 'dispute') return `A fine I think is wrong${r.why ? ' · ' + r.why : ''}`;
  return '';
}
function mnyRequestsFor(kid) {
  const rows = [];
  const add = (store, r, kind, icon, amount) => {
    const status = mnyRequestStatusOf(store, r);
    rows.push({
      id: r.id, store, kind, status, icon, amount: money2(amount),
      text: mnyRequestText(store, r),
      open: !status || status === 'talk',
      applied: !!r.appliedWeek,
      askedAt: Number(r.askedAt || r.createdAt) || 0,
      answeredAt: Number(r.answeredAt || r.approvedAt || r.rejectedAt) || 0,
      weekKey: r.weekKey || null,
      record: r,
    });
  };
  mnyEnsureRequests(kid).forEach(r => {
    if (!r || !r.id) return;
    const amount = r.kind === 'adv' ? r.amount : r.kind === 'goal' ? r.target : 0;
    const icon = r.kind === 'comp' && r.sport ? mnySportIcon(r.sport) : (MNY_REQUEST_ICONS[r.kind] || '❔');
    add('requests', r, r.kind, icon, amount);
  });
  mnyEnsureMoveRequests(kid).forEach(r => {
    if (!r || !r.id) return;
    add('moveRequests', r, 'move', r.to === 'cash' ? MNY_REQUEST_ICONS.cash : MNY_REQUEST_ICONS.move, r.amount);
  });
  mnyEnsureDeposits(kid).forEach(d => {
    // Only her proposals are questions; a grown-up's own entry is a record.
    if (!d || !d.id || !d.addedBy) return;
    const kind = d.requestKind === 'deposit' || /home/i.test(String(d.from || '')) ? 'deposit' : 'gift';
    add('deposits', d, kind, MNY_REQUEST_ICONS[kind], d.amount);
  });
  return rows.sort((a, b) => a.askedAt - b.askedAt);
}

/* ── One answerer ──
   `answer` is 'yes' | 'no' | 'talk'. A yes runs the owner of that kind's
   effect FIRST and records the answer only once the owner has done its part,
   so a refused move stays a question rather than reading "✓ yes" over money
   that never moved. A yes is final here: its effect has happened, and taking
   it back is a correction to the effect itself, through its own owner.
   `opts.pay` (comp only) is Dad's dollar figure from the Approve card's − / +;
   different from what the rules pay, it is kept beside her entry. */
function mnyAnswerRequest(kid, id, answer, opts) {
  if (!isParent()) { showToast('A grown-up answers this 🔒'); return false; }
  const o = opts || {};
  if (['yes', 'no', 'talk'].indexOf(answer) < 0) return false;
  const by = o.by || 'a grown-up';

  const mv = mnyEnsureMoveRequests(kid).find(r => r && r.id === id);
  if (mv) {
    if (answer === 'yes') return mnyApproveMove(kid, id);
    if (answer === 'no') return mnyRejectMove(kid, id, o.why);
    if (mv.approvedAt || mv.rejectedAt) return false;
    mv.talkAt = syncNow(); markItemUpdated(mv); saveAll();
    return true;
  }
  const dep = mnyEnsureDeposits(kid).find(d => d && d.id === id);
  if (dep) {
    // A no is kept, like a move's: it is answered, not reopened.
    if (dep.rejectedAt) return false;
    if (answer === 'yes') return mnyApproveDeposit(kid, id);
    if (!dep.pendingApproval) return false;
    if (answer === 'no') {
      // Kept, not deleted, and never credited: it stays a proposal nobody agreed.
      dep.rejectedAt = syncNow(); dep.why = String(o.why || '').slice(0, 80);
    } else {
      dep.talkAt = syncNow();
    }
    markItemUpdated(dep); saveAll();
    return true;
  }

  const r = mnyEnsureRequests(kid).find(x => x && x.id === id);
  if (!r) return false;
  if (r.status === 'yes') return false;
  if (answer === 'yes') {
    const done = mnyRequestYes(kid, r, o, by);
    if (!done) return false;
  }
  r.status = answer;
  if (answer === 'talk') r.talkAt = syncNow();
  r.answeredAt = syncNow();
  r.answeredBy = by;
  markItemUpdated(r);
  saveAll();
  return true;
}

/* The yes half, per kind. Returns true once the owner has done its part. */
function mnyRequestYes(kid, r, o, by) {
  if (r.kind === 'adv') return true;          // the cash came from a pocket; Sunday takes it off
  if (r.kind === 'dispute') { mrRemoveFine(kid, r.fineId); return true; }
  if (r.kind === 'skip') {
    // The week of the session's own day, not the week she asked in.
    return mrSetSessionAttendance(kid, ctWeekKeyForDate(r.dayKey || todayKey()), r.blockId, false);
  }
  if (r.kind === 'goal') {
    const g = mnySwitchGoal(kid, { name: r.name, icon: r.icon || '🎯', target: r.target }, r.keep);
    if (!g) return false;
    r.goalId = g.id;
    return true;
  }
  if (r.kind === 'comp') {
    const fields = {
      dayKey: r.dayKey, sport: r.sport, name: r.name,
      points: (r.races && r.races.length) ? r.races.reduce((s, x) => s + (Number(x.pts) || 0), 0) : (Number(r.pts) || 0),
      placement: { group: r.grp || null, overall: r.ovr || null },
      qualified: !!r.qualified, provincial: !!r.provincial, races: r.races || [],
      blockId: r.blockId || null,
    };
    const rule = mrScoreCompetition(fields, mrRulesFor(fields.dayKey));
    if (o.pay != null && isFinite(Number(o.pay)) && money2(o.pay) !== money2(rule)) {
      fields.awardedOverride = { value: money2(o.pay), by, at: syncNow() };
    }
    const existing = r.compId ? mrCompetitions(kid).find(c => c && c.id === r.compId) : null;
    const saved = existing ? mrUpdateCompetition(kid, existing.id, fields) : mrAddCompetition(kid, fields);
    if (!saved) return false;
    r.compId = saved.id;
    return true;
  }
  return false;
}

/* ════════════════════════════════════════════════════════════════
   🎁 EXPECTED MONEY — Grown-ups › Expected
   What the family knows is coming (Christmas, New Year, a meet) for the
   timeline's dashed months. `profile.expected[]` {id, month:'YYYY-MM', label,
   amount}; merges by id with an 'exp:' tombstone. Nothing moves: it is a
   forecast, not money.
   ════════════════════════════════════════════════════════════════ */
function mnyEnsureExpected(kid) {
  const p = getProfData(kid);
  if (!Array.isArray(p.expected)) p.expected = [];
  return p.expected;
}
function mnyExpectedMonthOk(month) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || '')); }
function mnyAddExpected(kid, fields) {
  if (!isParent()) { showToast('A grown-up keeps this list 🔒'); return null; }
  const f = fields || {};
  if (!mnyExpectedMonthOk(f.month)) { showToast('Which month?'); return null; }
  const e = { id: mrNewId('exp-'), month: String(f.month), label: String(f.label || '').trim().slice(0, 40),
              amount: money2(Math.max(0, Number(f.amount) || 0)), createdAt: syncNow(), updatedAt: syncNow() };
  if (!e.label) { showToast('What is it?'); return null; }
  mnyEnsureExpected(kid).push(e);
  saveAll();
  return e;
}
function mnyEditExpected(kid, id, fields) {
  if (!isParent()) { showToast('A grown-up keeps this list 🔒'); return false; }
  const e = mnyEnsureExpected(kid).find(x => x && x.id === id);
  if (!e) return false;
  const f = fields || {};
  if (f.month != null) { if (!mnyExpectedMonthOk(f.month)) return false; e.month = String(f.month); }
  if (f.label != null) e.label = String(f.label).trim().slice(0, 40) || e.label;
  if (f.amount != null) e.amount = money2(Math.max(0, Number(f.amount) || 0));
  markItemUpdated(e);
  saveAll();
  return true;
}
function mnyRemoveExpected(kid, id) {
  if (!isParent()) { showToast('A grown-up keeps this list 🔒'); return false; }
  const list = mnyEnsureExpected(kid);
  const i = list.findIndex(x => x && x.id === id);
  if (i < 0) return false;
  list.splice(i, 1);
  tombstoneIds('exp:', [id]);
  saveAll();
  return true;
}

/* ════════════════════════════════════════════════════════════════
   🧾 THE CLUB OWES DAD — the assistant job's payout
   The club pays the assistant job twice a year; Dad advances it to her every
   Sunday. So nothing here moves her money: the tally is DERIVED — every
   settled week after `clubPaidThrough[kid]` adds what its frozen ledger row
   paid for sessions — and "✓ Club paid" only moves that date forward (or back,
   to correct it), with a line in the change log. One date per kid, merged
   newest-stamp-wins (js/04-merge.js). A partial payout is not modelled.
   ════════════════════════════════════════════════════════════════ */
function mnyClubPaidThrough(kid) {
  ctEnsureShared();
  return ((state.shared.chore.clubPaidThrough || {})[kid]) || null;
}
function mnySetClubPaid(kid, weekKey) {
  if (!isParent()) { showToast('A grown-up records the club payout 🔒'); return false; }
  if (!weekKey) return false;
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.clubPaidThrough) c.clubPaidThrough = {};
  if (!c.clubPaidThroughAt) c.clubPaidThroughAt = {};
  const before = c.clubPaidThrough[kid] || null;
  c.clubPaidThrough[kid] = String(weekKey);
  c.clubPaidThroughAt[kid] = syncNow();
  mrLogAppend({ path: 'clubPaidThrough.' + kid, from: before, to: String(weekKey),
                reason: MR_DEFAULT_REASON,
                note: '✓ Club paid — ' + mnyKidName(kid) + ', through the week of ' + weekKey });
  saveAll();
  return true;
}
function mnyClubOwes(kid) {
  ctEnsureShared();
  const led = state.shared.chore.moneyLedger || {};
  const since = mnyClubPaidThrough(kid);
  let amount = 0, sessions = 0, weeks = 0;
  Object.keys(led).sort().forEach(wk => {
    if (since && String(wk) <= String(since)) return;
    const row = (led[wk] || {})[kid];
    if (!row) return;
    const paid = money2(row.sessionsPaid);
    if (!(paid > 0) && !(Number(row.sessions) > 0)) return;
    amount = money2(amount + paid);
    sessions += Number(row.sessions) || 0;
    weeks++;
  });
  return { amount, sessions, weeks, since };
}
