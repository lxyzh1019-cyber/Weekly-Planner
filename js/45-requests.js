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
     goal      → nothing at approval: the jar switches ON SUNDAY (the
                 prototype's "✓ starts Sunday") — mnyApplyApprovedGoals,
                 called when Sunday opens, runs mnySwitchGoal
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
                                cash: '💵 Cash out', wall: '🧱 Loan wall' };

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
    const fields = {
      amount: f.amount, from: f.from || (kind === 'deposit' ? 'Cash from home' : MNY_FROM[1]),
      giver: f.giver || '', dayKey, requestKind: kind, note: String(f.note || '').slice(0, 80) };
    // Her own words for the ask ("Put $5 cash in → Savings"), shown in Approve.
    if (f.text) fields.text = String(f.text).slice(0, 120);
    return mnyAddDeposit(kid, ctWeekKeyForDate(dayKey), fields);
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
    if (!r.sport && !r.name) { showToast('Which competition was it?'); return null; }
    /* One competition, one question (owner's review M8-4): a meet that
       already has a result waiting for Dad, or one he said yes to, cannot be
       told again — from the sheet, the other device or anywhere else. */
    const same = (x) => (r.blockId && x.blockId === r.blockId)
      || (!r.blockId && !x.blockId && String(x.dayKey) === String(r.dayKey)
          && String(x.name || '').trim().toLowerCase() === r.name.toLowerCase());
    if (mnyEnsureRequests(kid).some(x => x && x.kind === 'comp' && x.status !== 'no' && same(x))) {
      showToast('My parents already have this one.'); return null;
    }
  } else if (kind === 'goal') {
    Object.assign(r, { name: String(f.name || '').trim().slice(0, 40), icon: f.icon || '🎯',
      target: money2(f.target), keep: f.keep === 'ready' ? 'ready' : 'move',
      targetDate: /^\d{4}-\d{2}-\d{2}$/.test(String(f.targetDate || '')) ? String(f.targetDate) : '' });
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
    // One open question per fine (Plan v18, the dispute door).
    if (mnyEnsureRequests(kid).some(x => x && x.kind === 'dispute' && x.fineId === fine.id && (!x.status || x.status === 'talk'))) {
      showToast('My parents already have this one.'); return null;
    }
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
/* The question she asked about one fine, if any — newest first. */
function mnyFineDispute(kid, fineId) {
  return mnyRequestsFor(kid).filter(q => q.kind === 'dispute' && q.record && q.record.fineId === fineId).pop() || null;
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
      // When a grown-up answered: a deposit's yes is the moment it was credited.
      answeredAt: Number(r.answeredAt || r.approvedAt || r.rejectedAt || r.talkAt
        || (store === 'deposits' && !r.pendingApproval ? r.appliedAt : 0)) || 0,
      weekKey: r.weekKey || null,
      // 💬 Agreed at the meeting (Deviation 41): the figure, and what she asked.
      agreed: r.agreed ? money2(r.agreed.value) : null,
      asked: r.agreed && r.agreed.asked != null ? money2(r.agreed.asked) : null,
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
  const o = Object.assign({}, opts || {});
  if (['yes', 'no', 'talk'].indexOf(answer) < 0) return false;
  const by = o.by || 'a grown-up';
  /* ✓ Agree at the Sunday meeting (Plan v9 §N, Deviation 41): a yes with
     the agreed figure. A result's goes in as a parent's figure (`pay` →
     `awardedOverride`); every other kind's owner reads its own field, which
     takes the agreed figure here, with what she asked kept beside it. */
  if (answer === 'yes' && o.agreed) {
    const found = mnyRequestRecord(kid, id);
    const ag = found && found.rec.agreed;
    if (!found || !ag) { showToast('Set the agreed amount first.'); return false; }
    const field = mnyAgreedField(found.store, found.rec);
    if (field === 'pay') {
      if (ag.asked == null) ag.asked = money2(found.rec.pay != null ? found.rec.pay : guCompCalc(found.rec).amt);
      o.pay = ag.value;
    } else if (field) {
      sdAgreeInto(found.rec, field, syncNow());
    }
    markItemUpdated(found.rec);
  }

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
  // A new goal starts on Sunday, not at the yes: mnyApplyApprovedGoals.
  if (r.kind === 'goal') return true;
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
    // Whether this yes CREATED the record — the one case ↺ Undo can take back.
    r.compCreated = !existing;
    return true;
  }
  return false;
}

/* − / + on a result's dollars, before the yes (Plan v3 §B, deviation #7):
   Dad's figure, checked against the published sheet, kept on the request
   until he says yes — then `mnyRequestYes` puts it beside her entry as
   `awardedOverride`. A grown-up's; never below $0. */
function mnySetRequestPay(kid, id, value) {
  if (!isParent()) { showToast('A grown-up answers this 🔒'); return false; }
  const r = mnyEnsureRequests(kid).find(x => x && x.id === id);
  if (!r || r.kind !== 'comp' || r.status === 'yes') return false;
  r.pay = money2(Math.max(0, Number(value) || 0));
  markItemUpdated(r);
  saveAll();
  return true;
}

/* ── 💬 To talk about on Sunday: the agreed amount (Plan v9 §N, Deviation 41) ──
   A question answered "💬 Talk first" waits for the meeting. There, in
   "Parents answer first", a parent steps an agreed figure with − / + and
   then ✓ Agree (a yes through `mnyAnswerRequest` with `{ agreed: true }`) or
   "Not this time". The figure is `agreed {value, by, at}` on the record in
   its own store — written by the core's `sdWithAgreed`, so it merges with
   the record (tests/merge.test.js). A skip or a dispute has no amount, so it
   has no agreed figure: ✓ / ✗ only. */
function mnyRequestRecord(kid, id) {
  const mv = mnyEnsureMoveRequests(kid).find(r => r && r.id === id);
  if (mv) return { store: 'moveRequests', rec: mv };
  const dep = mnyEnsureDeposits(kid).find(d => d && d.id === id);
  if (dep) return { store: 'deposits', rec: dep };
  const r = mnyEnsureRequests(kid).find(x => x && x.id === id);
  return r ? { store: 'requests', rec: r } : null;
}
// Which field the owner reads for this kind's amount; 'pay' for a result; null: no amount.
function mnyAgreedField(store, rec) {
  if (store !== 'requests') return 'amount';
  return { comp: 'pay', adv: 'amount', goal: 'target' }[rec && rec.kind] || null;
}
// What she asked for, in dollars — kept once a figure was agreed (`agreed.asked`).
function mnyRequestAsked(store, rec) {
  if (!rec) return 0;
  if (rec.agreed && rec.agreed.asked != null) return money2(rec.agreed.asked);
  const f = mnyAgreedField(store, rec);
  if (f === 'pay') return money2(rec.pay != null ? rec.pay : guCompCalc(rec).amt);
  return f ? money2(rec[f]) : 0;
}
function mnySetRequestAgreed(kid, id, value) {
  if (!isParent()) { showToast('A grown-up answers this 🔒'); return false; }
  const found = mnyRequestRecord(kid, id);
  if (!found || !mnyAgreedField(found.store, found.rec)) return false;
  if (mnyRequestStatusOf(found.store, found.rec) !== 'talk') return false;
  sdWithAgreed(found.rec, value, 'a grown-up', syncNow());
  markItemUpdated(found.rec);
  saveAll();
  return true;
}

/* ↺ Undo on an answered card: the question goes back to waiting. A "no" or a
   "let's talk" just reopens. A "yes" reopens only where its effect can be
   taken back through its own owner and Sunday has not used it yet — an
   advance (nothing moved), a goal (the jar switches on Sunday), a missed
   session (the answer is cleared), a result this yes recorded (deleted).
   Anything else is refused with a sentence saying where to correct it. */
function mnyReopenRequest(kid, id) {
  if (!isParent()) { showToast('A grown-up answers this 🔒'); return false; }
  const mv = mnyEnsureMoveRequests(kid).find(r => r && r.id === id);
  if (mv) {
    // 🧱 A yes to the wall moved nothing yet — Sunday pays it — so until
    // Sunday has, it reopens like an advance.
    if (mv.approvedAt && mv.to === 'wall' && !mv.appliedWeek) {
      delete mv.approvedAt;
      markItemUpdated(mv); saveAll();
      return true;
    }
    if (mv.approvedAt) { showToast(mv.to === 'wall' ? 'Sunday has already put this on the wall — it cannot come back.' : 'That money already moved — to undo it, move it back.'); return false; }
    if (!mv.rejectedAt && !mv.talkAt) return false;
    delete mv.rejectedAt; delete mv.talkAt; delete mv.why;
    markItemUpdated(mv); saveAll();
    return true;
  }
  const dep = mnyEnsureDeposits(kid).find(d => d && d.id === id);
  if (dep) {
    if (!dep.pendingApproval) { showToast('That money is already in her bank — correct the gift itself on the Record sheet.'); return false; }
    if (!dep.rejectedAt && !dep.talkAt) return false;
    delete dep.rejectedAt; delete dep.talkAt; delete dep.why;
    markItemUpdated(dep); saveAll();
    return true;
  }
  const r = mnyEnsureRequests(kid).find(x => x && x.id === id);
  if (!r || !r.status) return false;
  if (r.status === 'yes') {
    if (r.appliedWeek) { showToast('Sunday has already used this yes — correct it on the thing itself.'); return false; }
    if (r.kind === 'dispute') { showToast('The fine is already gone — log it again on 📦 Fines if it was right.'); return false; }
    if (r.kind === 'skip') {
      mrSetSessionAttendance(kid, ctWeekKeyForDate(r.dayKey || todayKey()), r.blockId, null);
    } else if (r.kind === 'comp') {
      if (!r.compCreated || !r.compId) { showToast('Correct the result itself on the Record sheet.'); return false; }
      mrDeleteCompetition(kid, r.compId);
      r.compId = null; r.compCreated = false;
    }
  }
  r.status = null; r.answeredAt = null; r.answeredBy = null;
  delete r.talkAt;
  markItemUpdated(r);
  saveAll();
  return true;
}

/* 🎯 Sunday switches the jar. Every goal a grown-up said yes to and Sunday
   has not applied yet goes through `mnySwitchGoal` (the jar follows, or goes
   to Savings, as she asked), oldest yes first, stamped `appliedWeek` so the
   next Sunday — or the other device — does not switch it again. Stage 4's
   Sunday open calls this; nothing else does. Returns how many it applied. */
function mnyApplyApprovedGoals(kid, weekKey) {
  if (!isParent()) return 0;
  const wk = weekKey || ctThisWeekKey();
  const due = mnyEnsureRequests(kid)
    .filter(r => r && r.kind === 'goal' && r.status === 'yes' && !r.appliedWeek)
    .sort((a, b) => (Number(a.answeredAt) || 0) - (Number(b.answeredAt) || 0));
  let n = 0;
  due.forEach(r => {
    const g = mnySwitchGoal(kid, { name: r.name, icon: r.icon || '🎯', target: r.target,
      targetDate: r.targetDate || '' }, r.keep);
    if (!g) return;
    r.goalId = g.id;
    r.appliedWeek = wk;
    markItemUpdated(r);
    n++;
  });
  if (n) saveAll();
  return n;
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

/* ════════════════════════════════════════════════════════════════
   ✋ HER REQUEST SHEETS — the prototype's sheets on My money (My Money v2)

   🏆 Tell Dad a result · ⛸️ My club sessions · 🔀 Move · 💵 Cash out ·
   🏦 Put cash in · ⏪ Draw in advance · 🎯 New goal · ⏳ Everything I asked
   Dad. One static overlay (`#requestOverlay`, chrome in index.html, body
   filled here — the Record sheet's shape), opened by `mnyOpenRequestSheet`
   through `openSheet` / `closeSheet`, which own focus and Escape.

   It owns no rules. "Send to Dad →" is `mnyAddRequest` — the one door, which
   files a move with `mnyRequestMove` and cash from home with `mnyAddDeposit`
   — and every gate it shows is the owner's: the advance maximum
   (`advance.maxPerWeek` less `mnyAdvanceUsed`), a move's refusal
   (`mnyMoveRefusal`, said before the tap), a result's pay
   (`mrScoreCompetition`, the rules of its day).

   The draft is module-level, like `rcDraft`, and the DOM is drawn FROM it:
   typing a name or a race time never re-renders — only the send button and
   the preview follow it, in place (`rqSync`), so the caret stays.
   Actions ride on `data-mny-action="rq-…"` under `#requestBody`, one of
   MNY_CLICK_HOSTS; `mnyHandleClick` / `mnyHandleInput` hand them here.
   ════════════════════════════════════════════════════════════════ */
const RQ_SWIM_EVENTS = ['50 Free', '100 Free', '200 Free', '50 Back', '100 Back', '50 Breast',
                        '100 Breast', '50 Fly', '100 Fly', '100 IM', '200 IM'];
const RQ_GOAL_ICONS = ['🎒', '⛸️', '🛼', '🏊', '📚', '🎧', '🎨', '🧸'];
const RQ_MOVE_WHY = ['Something I want to buy', 'Saving for my goal', 'Loan gone sooner', 'Want it to grow'];
const RQ_SKIP_WHY = ['🤒 Sick', '📚 School thing', '🚗 Family trip', 'Something else'];
const RQ_ADV_WHY = [['📚', 'School book fair'], ['🍦', 'Treat'], ['✏️', 'Something else']];
const RQ_DISPUTE_WHY = [['🙋', 'It wasn’t me'], ['✅', 'I already did it'], ['✏️', 'Something else']];
const RQ_TITLES = { result: '🏆 Tell parents a result', club: '⛸️ My club sessions', goal: '🎯 A new saving goal',
                    list: '⏳ Everything I asked parents', move: '🔀 Move · 💵 Cash', dispute: '📦 This fine is wrong',
                    gift: '🎁 I was given something', prices: '💷 What things pay' };
const RQ_GIFT_CHIPS = [5, 10, 20, 50];
// What each home is called on these sheets (handoff §5). The 🧱 wall is no
// home and no move route: a move or cash put there is paid on Sunday as extra
// (Plan v5 Deviation 25 — mnyApplyApprovedWallMoves, js/40).
const RQ_HOMES = { ready: '🏦 Savings', locked: '🔒 Locked away', invest: '📈 Companies',
                   cash: '💵 Cash out', wall: '🧱 Loan wall' };
let rqDraft = null;

/* "$5" for whole dollars, "$5.50" otherwise — the prototype's `'$' + n`. */
function rqDollars(v) { const n = money2(v); return '$' + (n % 1 ? n.toFixed(2) : String(n)); }
function rqOrd(n) { return n ? ['1st', '2nd', '3rd'][n - 1] : '—'; }
/* "Tue 29 Sep" — the prototype's way (owner's review M13-1). */
function rqDayLabel(dayKey) { return mnyDayName(dayKey); }
function rqHomeShort(h) { return String(RQ_HOMES[h] || h).replace(/^\S+ /, ''); }

/* `kind`: result · club · move · adv · goal · gift · prices · list
   (`opts.mode` for move: move · cash · dep). For her own money — a grown-up
   may open it for the child the portal is looking at. `prices` is not a
   question: the live price list, read-only, opened from My money's ☀️ card. */
function mnyOpenRequestSheet(kind, opts) {
  const o = opts || {};
  const kid = (o.kid === 'jenn' || o.kid === 'jess') ? o.kid
    : (isParent() ? (parentViewing === 'jess' ? 'jess' : 'jenn') : activeProfile());
  /* ⏪ Draw early is a mode of the 🔀 Move · 💵 Cash sheet now (Plan v17 §1):
     `adv` opens that sheet in that mode. */
  const asked = kind === 'adv' ? 'move' : kind;
  const k = ['result', 'club', 'move', 'goal', 'gift', 'prices', 'list', 'dispute'].concat(MNY_INFO_KINDS).indexOf(asked) >= 0 ? asked : 'list';
  rqDraft = { kind: k, kid };
  if (MNY_INFO_KINDS.indexOf(k) >= 0) rqDraft.id = o.id || null;
  if (k === 'dispute') Object.assign(rqDraft, { fineId: o.id || null, why: '', note: '' });
  if (k === 'move') {
    const want = kind === 'adv' ? 'early' : o.mode;
    const mode = ['move', 'cash', 'dep', 'early'].indexOf(want) >= 0 ? want : 'move';
    Object.assign(rqDraft, { mode, from: 'ready', to: mode === 'cash' ? 'cash' : null, amt: 1, why: '' });
  }
  if (k === 'goal') Object.assign(rqDraft, { name: '', icon: '🎒', amt: 30, keep: 'move', targetDate: '' });
  if (k === 'club') Object.assign(rqDraft, { blockId: null, why: '' });
  if (k === 'result') {
    Object.assign(rqDraft, { pick: null });
    // Opened from a planned meet on My money's calendar: that meet, picked.
    const x = o.blockId ? rqPlannedRecent(kid).find(p => p.blockId === o.blockId && p.st === 'open') : null;
    if (x) rqDraft.pick = rqPickFrom(x);
  }
  if (k === 'gift') Object.assign(rqDraft, { amt: 10, giver: '', from: MNY_FROM[0], dayKey: todayKey() });
  openSheet('requestOverlay');
  rqRender();
}
function rqClose() { rqDraft = null; closeSheet('requestOverlay'); }

/* ── One option button: the prototype's opt(label, on, pick, disabled). A
   disabled option is still pressable and says why (data-mny-why), because a
   greyed control with no reason is one a child works around. */
function rqOpt(label, on, action, attrs, why) {
  return `<button type="button" class="rq-opt${on ? ' on' : ''}${why ? ' off' : ''}" data-mny-action="${action}"${attrs || ''}${why ? ` aria-disabled="true" data-mny-why="${escapeAttr(why)}"` : ''}>${escapeHtml(label)}</button>`;
}
function rqVal(label) { return `<span class="rq-opt rq-val">${escapeHtml(label)}</span>`; }
function rqRow(q, optsHtml) {
  return `<div class="rq-row"><div class="rq-q">${escapeHtml(q)}</div><div class="rq-opts">${optsHtml}</div></div>`;
}

/* ── What each sheet asks, and whether it can be sent ─────────────── */
function rqState() {
  const d = rqDraft, kid = d.kid;
  if (d.kind === 'result') return rqResultState(kid, d);
  if (d.kind === 'move' && d.mode === 'early') return rqAdvState(kid, d);
  if (d.kind === 'move') return rqMoveState(kid, d);
  if (d.kind === 'goal') return rqGoalState(kid, d);
  if (d.kind === 'club') return rqClubState(kid, d);
  if (d.kind === 'gift') return rqGiftState(kid, d);
  if (d.kind === 'dispute') return rqDisputeState(kid, d);
  return { ready: false, preview: '' };
}

/* 🏆 What she says happened, and what the rules of its day pay for it. */
function rqResultPay(kid, d) {
  if (!d.pick || !d.pick.sport) return 0;
  const p = d.pick;
  const races = p.races || [];
  return mrScoreCompetition({
    sport: p.sport,
    points: p.sport === 'swim' ? races.reduce((a, r) => a + (Number(r.pts) || 0), 0) : (Number(p.pts) || 0),
    placement: { group: p.grp || null, overall: p.ovr || null },
    qualified: !!p.qual, provincial: !!p.prov,
  }, mrRulesFor(p.dayKey || todayKey()));
}
function rqResultState(kid, d) {
  const p = d.pick;
  if (!p || !p.sport) return { ready: false, preview: 'Pick a competition first.', need: 'Pick a competition first.' };
  const c = (mrRulesFor(p.dayKey || todayKey()).competition) || {};
  const sw = c.swim || {}, sk = c.skate || {};
  const pay = rqResultPay(kid, d);
  const races = p.races || [];
  const name = String(p.name || '').trim();
  let preview;
  if (p.sport === 'swim') {
    const tot = races.reduce((a, r) => a + (Number(r.pts) || 0), 0);
    preview = `${tot} points × ${rqDollars(p.prov ? sw.provincialPerPoint : sw.perPoint)}${p.qual ? ` + ${rqDollars(sw.qualifyBonus)} for qualifying` : ''} = ${rqDollars(pay)}`;
  } else {
    const pl = sk.placement || {};
    preview = `${Number(p.pts) || 0} points × ${rqDollars(sk.perPoint)}${p.grp ? ` + ${rqDollars((pl.group || {})[p.grp])} group` : ''}${p.ovr ? ` + ${rqDollars((pl.overall || {})[p.ovr])} overall` : ''} = ${rqDollars(pay)}`;
  }
  const ready = !!(name && (p.sport !== 'swim' || races.some(r => (Number(r.pts) || 0) > 0 || String(r.time || '').trim())));
  return { ready, preview, pay, need: !name ? 'What was it called?' : 'Put in a race: its points or its time.' };
}
/* The meets on her planner in a month, each with where it stands
   (`rqPlannedStatus`). My money's calendar and 📅 Coming up read it for the
   month they show; the result sheet reads `rqPlannedRecent`. */
function rqPlannedInMonth(kid, month) {
  const today = String(todayKey());
  const out = [];
  const seen = new Set();
  let wk = ctWeekKeyForDate(month + '-01');
  for (let i = 0; i < 6 && String(wk) <= month + '-31'; i++) {
    mmPlannedCompetitions(wk, kid).forEach(p => {
      const key = p.blockId || (p.dayKey + p.name);
      if (String(p.dayKey).slice(0, 7) === month && !seen.has(key)) { seen.add(key); out.push(p); }
    });
    const next = formatDayKey(wk); next.setDate(next.getDate() + 7);
    wk = ctDateToKey(next);
  }
  return rqPlannedStatus(kid, out);
}
/* Each planned meet with where it stands — done (recorded) · sent (she
   already told Dad) · soon (still to come) · open (happened, no result). */
function rqPlannedStatus(kid, out) {
  const today = String(todayKey());
  const comps = mrCompetitions(kid);
  const asks = mnyEnsureRequests(kid).filter(r => r && r.kind === 'comp' && r.status !== 'no');
  return out.map(p => {
    const rec = comps.find(c => c && ((p.compId && c.id === p.compId) || (p.blockId && c.blockId === p.blockId)));
    const sent = asks.some(r => p.blockId && r.blockId === p.blockId);
    const st = rec ? 'done' : sent ? 'sent' : (String(p.dayKey) > today ? 'soon' : 'open');
    const sport = p.sport === 'swim' ? 'swim' : 'skate';
    return Object.assign({}, p, { st, sport, icon: sport === 'swim' ? '🏊' : '⛸️',
      title: p.name || (sport === 'swim' ? 'Swim meet' : 'Skating competition'),
      award: rec ? mrCompAward(rec) : 0 });
  });
}
/* The result sheet's list (owner's review M8-3): the meets on her planner in
   the last 4 weeks that have already happened — a result is told after the
   day, never before it. */
const RQ_RECENT_DAYS = 28;
function rqPlannedRecent(kid) {
  const today = String(todayKey());
  const from = mrDayKeyAdd(today, -(RQ_RECENT_DAYS - 1));
  const out = [], seen = new Set();
  for (let wk = ctWeekKeyForDate(from); String(wk) <= today; wk = mrDayKeyAdd(wk, 7)) {
    mmPlannedCompetitions(wk, kid).forEach(p => {
      const key = p.blockId || (p.dayKey + p.name);
      if (String(p.dayKey) >= from && String(p.dayKey) <= today && !seen.has(key)) { seen.add(key); out.push(p); }
    });
  }
  return rqPlannedStatus(kid, out);
}
function rqResultBody(kid, d) {
  const planned = rqPlannedRecent(kid);
  const p = d.pick;
  const items = planned.map(x => {
    const on = !!(p && !p.custom && p.blockId === x.blockId);
    const can = x.st === 'open';
    const sub = x.st === 'done' ? `${rqDayLabel(x.dayKey)} · ✓ recorded ${rqDollars(x.award)}`
      : x.st === 'sent' ? `${rqDayLabel(x.dayKey)} · ⏳ sent to parents`
      : x.st === 'soon' ? `${rqDayLabel(x.dayKey)} · coming up` : `${rqDayLabel(x.dayKey)} · no result yet`;
    const why = can ? '' : (x.st === 'done' ? 'My parents already have this one.' : x.st === 'sent' ? 'Already sent to parents.' : 'Not yet — it is still coming up.');
    return `<button type="button" class="rq-meet ${'rq-meet--' + x.st}${on ? ' on' : ''}" data-mny-action="rq-pick" data-mny-id="${escapeAttr(x.blockId || '')}"${can ? '' : ` aria-disabled="true" data-mny-why="${escapeAttr(why)}"`}><span class="rq-meet-ico">${x.icon}</span><span class="rq-meet-name">${escapeHtml(x.title)}</span><span class="rq-meet-sub">${escapeHtml(sub)}</span></button>`;
  }).join('') || `<div class="rq-empty">Nothing on my planner in the last 4 weeks.</div>`;
  const custom = !!(p && p.custom);
  let left = `<div class="rq-col"><div class="rq-q">① Which one? My planner, last 4 weeks</div>${items}
    <button type="button" class="rq-custom${custom || d.customAsk ? ' on' : ''}" data-mny-action="rq-custom">➕ It's not on my planner</button>`;
  /* "It's not on my planner" asks her to check the list first (M8-4): one
     competition is one question, so a meet that IS on her planner is told
     from its own row above. */
  if (d.customAsk && !custom) {
    left += `<div class="rq-check"><div class="rq-q">First, is it one of these?</div>
      ${planned.map(x => `<div class="rq-check-row">${escapeHtml(x.icon + ' ' + x.title + ' · ' + rqDayLabel(x.dayKey))}</div>`).join('')}
      <div class="rq-opts rq-two">${rqOpt('← Yes, one of these', false, 'rq-customback')}${rqOpt('✓ No, none of these', false, 'rq-customok')}</div></div>`;
  }
  if (custom) {
    left += `<input class="rq-input" type="text" value="${escapeAttr(p.name || '')}" placeholder="what it was called" data-mny-action="rq-name" aria-label="What it was called">
      <div class="rq-opts rq-two">${rqOpt('🏊 Swim', p.sport === 'swim', 'rq-sport', ' data-mny-id="swim"')}${rqOpt('⛸️ Skating', p.sport === 'skate', 'rq-sport', ' data-mny-id="skate"')}</div>
      <div class="rq-warn">A parent adds it to the planner on a yes, so the name matches next time.</div>`;
  }
  left += `</div>`;
  let right = `<div class="rq-col">`;
  if (!p || !p.sport) {
    right += `<div class="rq-pickfirst">Pick a competition on the left.</div>`;
  } else if (p.sport === 'swim') {
    const rules = (mrRulesFor(p.dayKey || todayKey()).competition || {}).swim || {};
    const races = p.races || [];
    right += `<div class="rq-qline"><span class="rq-q">② My races</span><span class="rq-hint">up to 4 at one meet</span></div>
      ${races.map((r, i) => `<div class="rq-race">
        <b class="rq-race-n">${i + 1}</b>
        <select class="rq-select" data-mny-action="rq-ev" data-mny-i="${i}" aria-label="Race ${i + 1}">${RQ_SWIM_EVENTS.map(e =>
          `<option value="${escapeAttr(e)}"${e === r.ev ? ' selected' : ''}>${escapeHtml(e)}</option>`).join('')}</select>
        <input class="rq-input rq-time" type="text" value="${escapeAttr(r.time || '')}" placeholder="time 0:41.2" data-mny-action="rq-time" data-mny-i="${i}" aria-label="Race ${i + 1} time">
        <span class="rq-step">${rqOpt('−', false, 'rq-racepts', ` data-mny-i="${i}" data-mny-d="-1" aria-label="Fewer points"`)}<b class="rq-num">${Number(r.pts) || 0} pts</b>${rqOpt('+', false, 'rq-racepts', ` data-mny-i="${i}" data-mny-d="1" aria-label="More points"`)}</span>
        ${rqOpt('✕', false, 'rq-racedel', ` data-mny-i="${i}" aria-label="Take this race off"`, races.length > 1 ? '' : 'One race stays — change it instead.')}
      </div>`).join('')}
      ${races.length < 4 ? `<button type="button" class="rq-custom" data-mny-action="rq-raceadd">➕ Add a race (${4 - races.length} left)</button>` : ''}
      <div class="rq-opts">${rqOpt(`🎯 Qualified for Provincials (+${rqDollars(rules.qualifyBonus)})`, !!p.qual, 'rq-qual')}${rqOpt(`🏟️ This was Provincials (${rqDollars(rules.provincialPerPoint)}/pt)`, !!p.prov, 'rq-prov')}</div>`;
  } else {
    right += `<div class="rq-q">② My result</div>
      <div class="rq-side">${rqRow('In my group', [0, 1, 2, 3].map(n => rqOpt(rqOrd(n), (p.grp || 0) === n, 'rq-grp', ` data-mny-id="${n}"`)).join(''))}
      ${rqRow('Overall', [0, 1, 2, 3].map(n => rqOpt(rqOrd(n), (p.ovr || 0) === n, 'rq-ovr', ` data-mny-id="${n}"`)).join(''))}
      ${rqRow('Points', `${rqOpt('−', false, 'rq-pts', ' data-mny-d="-1" aria-label="Fewer points"')}${rqVal((Number(p.pts) || 0) + ' pts')}${rqOpt('+', false, 'rq-pts', ' data-mny-d="1" aria-label="More points"')}`)}</div>`;
  }
  right += `${rqPreviewAndFoot()}</div>`;
  return `<div class="rq-result">${left}${right}</div>`;
}

function rqCustomPick() {
  return { custom: true, blockId: null, compId: null, name: '', sport: null, dayKey: todayKey(),
           races: [], pts: 0, grp: 0, ovr: 0, qual: false, prov: false };
}
/* A planned meet, picked: the draft the result sheet fills in. */
function rqPickFrom(x) {
  return { custom: false, blockId: x.blockId, compId: x.compId || null, name: x.title, sport: x.sport,
           dayKey: x.dayKey, races: x.sport === 'swim' ? [{ ev: '50 Free', time: '', pts: 0 }] : [],
           pts: 0, grp: 0, ovr: 0, qual: false, prov: false };
}

/* 🔀 💵 🏦 One sheet, three things she can ask. */
function rqMoveState(kid, d) {
  const max = d.mode === 'dep' ? 50 : Math.floor(money2(evHomeBalance(kid, d.from)) + 1e-9);
  const amt = Math.min(d.amt || 1, Math.max(1, max));
  const bonus = Number(mrRuleOr(mrRules(), 'loan.extraBonusPct')) || 0;
  const lockWeeks = Number(mrRuleOr(mrRules(), 'pots.lockWeeks')) || 4;
  if (d.mode === 'dep') {
    const ready = !!d.to;
    const preview = d.to ? `I bring $${amt} of cash to my parents on Sunday. It goes into ${rqHomeShort(d.to)}${d.to === 'ready' ? ' and earns a little' : d.to === 'wall' ? ` and counts as ${mnyMoney(amt * (1 + bonus / 100))}` : ''}.` : 'Where should the cash go?';
    return { ready, preview, amt, max, need: 'Where should the cash go?' };
  }
  const to = d.mode === 'cash' ? 'cash' : d.to;
  const refusal = (to && max >= 1)
    ? (to === 'wall' ? mnyWallMoveRefusal(kid, d.from, amt) : mnyMoveRefusal(kid, d.from, to, amt)) : null;
  const ready = !!(to && d.why && max >= 1 && !refusal);
  const preview = max < 1 ? 'Nothing to take out of there yet.'
    : refusal ? refusal
    : !ready ? 'Pick the details and why.'
    : to === 'cash' ? `A parent hands me $${amt} in real cash on Sunday. It leaves the bank — no more interest.`
    : to === 'locked' ? `$${amt} locked for ${lockWeeks} weeks, back on a Saturday with a little extra.`
    : to === 'wall' ? `$${amt} counts as ${mnyMoney(amt * (1 + bonus / 100))} off my wall. It can’t come back.`
    : to === 'invest' ? `$${amt} could go up or down. A parent talks it through first.`
    : `$${amt} goes back where I can reach it.`;
  return { ready, preview, amt, max, need: max < 1 ? 'Nothing to take out of there yet.' : (refusal || 'Pick the details and why.') };
}
function rqMoveBody(kid, d) {
  const st = rqMoveState(kid, d);
  const gate = (h) => mnyStagePct(evHomeNeed(h));
  const lockWeeks = Number(mrRuleOr(mrRules(), 'pots.lockWeeks')) || 4;
  const modeRow = rqModeRow(d);
  if (d.mode === 'early') return modeRow + rqAdvBody(kid, d);
  /* 🏦 Savings reads as on My money — her goal jars inside it (Plan v17
     item 2) — while what she can move is the part outside the jars. */
  const jars = money2(mnyReadyHomeTotal(kid) - mnySavedTotal(kid));
  const fromRow = rqRow('① Take it from', ['ready', 'locked', 'invest'].map(h => {
    const bal = money2(evHomeBalance(kid, h));
    const shown = h === 'ready' ? `${mnyMoney(money2(bal + jars))}${jars > 0 ? ` · 🎯 ${mnyShort$(jars)} inside stays` : ''}` : mnyMoney(bal);
    const shut = h !== 'ready' && !evHomeOpen(kid, h);
    const why = h === 'locked' ? 'Locked money comes back on its own date.'
      : shut ? mnyNeedLabel(evHomeNeed(h)) : (bal < 1 ? 'Nothing to take out of there yet.' : '');
    return rqOpt(`${RQ_HOMES[h]} · ${shown}${h === 'locked' ? ` · 🔒 ${lockWeeks} weeks` : shut ? ` · 🔒${gate(h)}%` : ''}`,
      d.from === h, 'rq-from', ` data-mny-id="${h}"`, why);
  }).join(''));
  const amtRow = rqRow(d.mode === 'dep' ? '① How much cash?' : '③ How much?',
    `${rqOpt('−', false, 'rq-amt', ' data-mny-d="-1" aria-label="Less"', st.amt <= 1 ? 'That is the least.' : '')}${rqVal('$' + st.amt)}${rqOpt('+', false, 'rq-amt', ' data-mny-d="1" aria-label="More"', st.amt >= st.max ? 'That is all there is.' : '')}${d.mode === 'dep' ? '' : rqOpt('All of it', false, 'rq-amtall', '', st.max < 1 ? 'Nothing to take out of there yet.' : '')}`);
  const whyRow = rqRow('④ Why?', RQ_MOVE_WHY.map(w => rqOpt(w, d.why === w, 'rq-why', ` data-mny-id="${escapeAttr(w)}"`)).join(''));
  const toList = d.mode === 'dep' ? ['ready', 'wall', 'locked'] : ['wall', 'locked', 'invest', 'ready'].filter(h => h !== d.from);
  const toRow = rqRow('② Put it in', toList.map(h => {
    const shut = (h === 'locked' || h === 'invest') && !evHomeOpen(kid, h);
    return rqOpt(RQ_HOMES[h] + (shut ? ` 🔒${gate(h)}%` : ''), d.to === h, 'rq-to', ` data-mny-id="${h}"`, shut ? mnyNeedLabel(evHomeNeed(h)) : '');
  }).join(''));
  const rows = d.mode === 'dep' ? [modeRow, amtRow, toRow] : d.mode === 'cash' ? [modeRow, fromRow, amtRow, whyRow] : [modeRow, fromRow, toRow, amtRow, whyRow];
  return rows.join('') + rqPreviewAndFoot({ notNow: false });
}

/* The four modes of the 🔀 Move · 💵 Cash sheet (Plan v17 §1). */
function rqModeRow(d) {
  return rqRow('What do I want to do?', [['move', '🔀 Move'], ['cash', '💵 Cash out'], ['dep', '🏦 Put cash in'], ['early', '⏪ Draw early']]
    .map(([k, l]) => rqOpt(l, d.mode === k, 'rq-mode', ` data-mny-id="${k}"`)).join(''));
}
/* ⏪ Draw early: cash now, off Sunday's payday — up to the rule
   (`advance.maxPerWeek`), less what she drew. The cap is kept and not shown
   (Plan v17 §1, owner's answer): + stops at it and says so when pressed. */
function rqAdvState(kid, d) {
  const wk = ctThisWeekKey();
  const max = money2(Number(mrRuleOr(mrRulesForWeek(wk), 'advance.maxPerWeek')) || 0);
  const used = mnyAdvanceUsed(kid, wk);
  const left = Math.floor(money2(Math.max(0, max - used)) + 1e-9);
  const amt = Math.min(d.amt || 1, Math.max(1, left));
  const ready = !!(d.why && left >= 1);
  // The prototype's tip, with "a parent" (Plan v18 A, owner 2026-10-05).
  const preview = left < 1 ? `I already drew ${rqDollars(used)} in advance this week. That's the most.`
    : `A parent gives me $${amt} cash now and I spend it before Sunday. On payday it shows under ➖ Taken off, so my pile is $${amt} smaller.`;
  return { ready, preview, amt, left, need: left < 1 ? preview : 'What is it for?' };
}
/* The reference's body (Plan v18 B4) with the prototype's tip (owner,
   2026-10-05, A): one plain line, How much − $ + (big steps, the + yellow),
   three reasons, the tip in the handwritten box, Send to parents; the sheet's
   text 1.3× (`data-rq-mode="early"`). No "Not now" — the × closes it. */
function rqAdvBody(kid, d) {
  const st = rqAdvState(kid, d);
  return `<div class="rq-plain">⏪ Draw early: money I need before Sunday. It comes off next Sunday’s payday.</div>
    <div class="rq-amtline"><span class="rq-q">How much</span>${rqOpt('−', false, 'rq-amt', ' data-mny-d="-1" aria-label="Less"', st.amt <= 1 ? 'That is the least.' : '')}<b class="rq-amtval">$${st.amt}</b>${rqOpt('+', false, 'rq-amt', ' data-mny-d="1" aria-label="More"', st.amt >= st.left ? 'That is the most this week.' : '')}</div>
    <div class="rq-opts">${RQ_ADV_WHY.map(([icon, w]) => rqOpt(icon + ' ' + w, d.why === w, 'rq-why', ` data-mny-id="${escapeAttr(w)}"`)).join('')}</div>`
    + rqPreviewAndFoot({ notNow: false });
}

/* 📦 This fine is wrong (owner, 2026-10-05): the fine — item, day and what
   it costs, negative, or "free" when it took nothing off — then what
   happened (a reason chip and/or her own words, both optional) and Send to
   parents. It lands in Parent › Now tagged 📦 Fine; a yes takes the fine
   away (mrRemoveFine, through mnyAnswerRequest). */
function rqDisputeState(kid, d) {
  const fine = mrFines(kid).find(f => f && f.id === d.fineId);
  const q = fine ? mnyFineDispute(kid, fine.id) : null;
  if (!fine) return { ready: false, preview: 'That fine is not on the record.', need: 'That fine is not on the record.' };
  if (q && q.open) return { ready: false, preview: 'My parents already have this one.', need: 'My parents already have this one.' };
  return { ready: true, preview: 'My parents look at it before Sunday. If they agree, the fine is taken away.', fine };
}
function rqDisputeBody(kid, d) {
  const st = rqDisputeState(kid, d);
  const f = st.fine || mrFines(kid).find(x => x && x.id === d.fineId);
  const cost = f ? guDisputeAmount(kid, { fineId: f.id }) : 0;
  const head = f ? `<div class="rq-fine"><span>📦 ${escapeHtml(guFineLabel(f.itemId))} · ${escapeHtml(mnyDayName(f.dayKey))}</span><b>${escapeHtml(cost > 0 ? sdOff$(cost, mnyMoney) : 'free')}</b></div>` : '';
  return head
    + rqRow('What happened? (if I want to say)', RQ_DISPUTE_WHY.map(([icon, w]) => rqOpt(icon + ' ' + w, d.why === w, 'rq-why', ` data-mny-id="${escapeAttr(w)}"`)).join(''))
    + `<input type="text" class="rq-input" data-mny-action="rq-disputenote" maxlength="80" placeholder="In my own words…" value="${escapeAttr(d.note || '')}" aria-label="What happened, in my own words">`
    + rqPreviewAndFoot({ notNow: false });
}

/* 🎯 A new goal — the jar switches on Sunday once Dad says yes. */
function rqGoalJar(kid) {
  const jar = mnyGoalHolding(kid);
  const g = mnyActiveGoal(kid);
  return { saved: jar ? money2(mnyHoldingValue(jar)) : 0, goal: g ? `${g.icon || '🎯'} ${g.name}` : 'my goal' };
}
function rqGoalState(kid, d) {
  const name = String(d.name || '').trim();
  const jar = rqGoalJar(kid);
  const price = d.amt || 30;
  const ready = name.length > 1;
  const start = d.keep === 'ready' ? 0 : jar.saved;
  const wks = Math.ceil(Math.max(0, price - start) / 3);
  const preview = !ready ? 'Type what I want to buy, then pick a price.'
    : `${d.icon} ${name} · $${price}. ${start ? `I start with ${mnyMoney(start)}. ` : ''}At $3 a Sunday that's about ${wks} Sundays. A parent says yes, then my jar switches.`;
  return { ready, preview, need: 'What do I want to buy?' };
}
function rqGoalBody(kid, d) {
  const jar = rqGoalJar(kid);
  const price = d.amt || 30;
  return `<input class="rq-input" type="text" value="${escapeAttr(d.name || '')}" placeholder="what I want to buy · e.g. new skate bag" data-mny-action="rq-goalname" aria-label="What I want to buy">`
    + rqRow('① Pick a picture', RQ_GOAL_ICONS.map(i => rqOpt(i, d.icon === i, 'rq-icon', ` data-mny-id="${i}"`)).join(''))
    + rqRow('② How much does it cost?', `${rqOpt('−', false, 'rq-price', ' data-mny-d="-5" aria-label="Less"', price <= 5 ? 'That is the least.' : '')}${rqVal('$' + price)}${rqOpt('+', false, 'rq-price', ' data-mny-d="5" aria-label="More"')}${[20, 35, 50, 80].map(v => rqOpt('$' + v, price === v, 'rq-priceset', ` data-mny-id="${v}"`)).join('')}`)
    + `<div class="rq-row"><div class="rq-q">③ When do I want it by? <span class="rq-hint">(if there is a day)</span></div><input class="rq-input rq-date" type="date" value="${escapeAttr(d.targetDate || '')}" data-mny-action="rq-goaldate" aria-label="When do I want it by"></div>`
    + (jar.saved > 0 ? rqRow(`④ My jar has ${mnyMoney(jar.saved)} for ${jar.goal}. What happens to it?`,
        [['move', '➡️ Use it for the new goal'], ['ready', '🏦 Put it in Savings']].map(([k, l]) => rqOpt(l, (d.keep || 'move') === k, 'rq-keep', ` data-mny-id="${k}"`)).join('')) : '')
    + rqPreviewAndFoot();
}

/* ⛸️ This week's assistant-job sessions — which one she can't make, and why. */
function rqClubState(kid, d) {
  const sw = mrSessionsWeek(ctThisWeekKey(), kid);
  const s = sw.sessions.find(x => x.blockId === d.blockId);
  const ready = !!(s && d.why);
  const preview = s ? `If a parent says yes, ${rqDayLabel(s.dayKey)} shows as missed on Sunday. A missed session pays $0. It is not a fine.`
    : sw.sessions.length ? `Each session I go to pays ${rqDollars(sw.rate)} on Sunday.` : 'No club sessions on my planner this week.';
  return { ready, preview, need: s ? 'Why?' : 'Which one can’t I make?' };
}
function rqClubBody(kid, d) {
  const sw = mrSessionsWeek(ctThisWeekKey(), kid);
  const asked = (id) => mnyEnsureRequests(kid).some(r => r && r.kind === 'skip' && r.blockId === id && r.status !== 'no');
  return rqRow('① Which one can’t I make?', sw.sessions.map(x =>
      rqOpt(rqDayLabel(x.dayKey) + (asked(x.blockId) ? ' · asked ✓' : ''), d.blockId === x.blockId, 'rq-session',
        ` data-mny-id="${escapeAttr(x.blockId)}"`, asked(x.blockId) ? 'I already asked about this one.' : '')).join(''))
    + rqRow('② Why?', RQ_SKIP_WHY.map(w => rqOpt(w, d.why === w, 'rq-why', ` data-mny-id="${escapeAttr(w)}"`)).join(''))
    + rqPreviewAndFoot();
}

/* 🎁 Money she was given (Plan v5 §L M9): how much, from whom, what kind,
   which day — sent as a gift for Dad to say yes to (`mnyAddRequest` →
   `mnyAddDeposit`'s proposal). A grown-up records one on the Record sheet. */
function rqGiftDays() {
  const out = [];
  const t = formatDayKey(todayKey());
  for (let i = 0; i < 7; i++) {
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i);
    out.push(ctDateToKey(d));
  }
  return out;
}
function rqGiftState(kid, d) {
  const amt = money2(d.amt);
  const giver = String(d.giver || '').trim();
  const ready = amt > 0 && !!d.from;
  const when = d.dayKey === todayKey() ? 'today' : rqDayLabel(d.dayKey);
  const preview = !ready ? 'How much was it?'
    : `${rqDollars(amt)} · ${d.from}${giver ? ' from ' + giver : ''} · ${when}. A parent says yes, then it goes into my payday on Sunday.`;
  return { ready, preview, need: 'How much was it?' };
}
function rqGiftBody(kid, d) {
  const amt = money2(d.amt) || 0;
  return rqRow('① How much?', `${rqOpt('−', false, 'rq-giftamt', ' data-mny-d="-1" aria-label="Less"', amt <= 1 ? 'That is the least.' : '')}${rqVal(rqDollars(amt))}${rqOpt('+', false, 'rq-giftamt', ' data-mny-d="1" aria-label="More"')}${RQ_GIFT_CHIPS.map(v => rqOpt('$' + v, amt === v, 'rq-giftset', ` data-mny-id="${v}"`)).join('')}`)
    + `<div class="rq-row"><div class="rq-q">② Who gave it to me?</div><input class="rq-input" type="text" value="${escapeAttr(d.giver || '')}" placeholder="e.g. Grandma, Uncle Mike" data-mny-action="rq-giver" aria-label="Who gave it to me"></div>`
    + rqRow('③ What kind?', MNY_FROM.map(f => rqOpt(f, d.from === f, 'rq-giftfrom', ` data-mny-id="${escapeAttr(f)}"`)).join(''))
    + rqRow('④ Which day?', rqGiftDays().map((k, i) => rqOpt(i === 0 ? 'Today' : i === 1 ? 'Yesterday' : rqDayLabel(k), d.dayKey === k, 'rq-giftday', ` data-mny-id="${k}"`)).join(''))
    + rqPreviewAndFoot();
}
/* 💷 What things pay — today's prices, read-only (the list My money and
   Money school have always shown, `pmPriceCards`). */
/* The list in groups behind tabs, so no group needs a scroll; it opens on
   🏆 Competitions and 📦 Box fine, as the stage 8 drawing shows it. */
const RQ_PRICE_TABS = [
  { id: 'comp',  label: '🏆 Competitions & fines', groups: ['comp', 'fines'] },
  { id: 'chores', label: '🧹 Chores', groups: ['chores'] },
  { id: 'due',   label: '⏰ When due', groups: ['due'] },
  { id: 'learn', label: '📘 Learning & streak', groups: ['learning', 'streak'] },
  { id: 'xp',    label: '⭐ XP', groups: ['xp'] },
];
function rqPricesBody(d) {
  const r = mrRules();
  const changed = JSON.stringify(r) !== JSON.stringify(mrRulesForWeek(mrMoneyWeekOf(todayKey())));   // the money week she is in
  const tab = RQ_PRICE_TABS.find(t => t.id === (d && d.priceTab)) || RQ_PRICE_TABS[0];
  return `<p class="rq-lead">One list, opened from My money and from Money school. Today's prices.</p>
    ${changed ? `<p class="rq-lead">Something changed price this week. These are the new prices, from now on — what I already did this week still pays what it was worth then.</p>` : ''}
    <div class="rq-opts rq-pricetabs">${RQ_PRICE_TABS.map(t => rqOpt(t.label, t.id === tab.id, 'rq-pricetab', ` data-mny-id="${t.id}"`)).join('')}</div>
    <div class="mny-prices rq-prices">${pmPriceCards(r, tab.groups)}</div>`;
}

/* ⏳ What she asked, newest first, with its answer in her words. */
function rqStatusText(q) {
  const r = q.record || {};
  if (q.status === 'yes') {
    const said = ({ goal: '✓ starts Sunday', skip: '✓ marked missed',
      move: r.to === 'cash' ? '✓ cash on Sunday' : r.to === 'wall' ? (r.appliedWeek ? '✓ on the wall' : '✓ on the wall on Sunday') : '✓ moved',
      adv: '✓ cash given · off Sunday', deposit: '✓ in the bank', dispute: '✓ parents took the fine away' })[q.kind] || '✓ in Sunday’s payday';
    // 💬 Agreed at the meeting (Deviation 41): what she asked, and what was agreed.
    return q.agreed != null && q.asked != null ? `${said} · agreed ${mnyShort$(q.agreed)} (asked ${mnyShort$(q.asked)})` : said;
  }
  if (q.status === 'no') return '✗ not this time';
  if (q.status === 'talk') return '💬 to talk about on Sunday';
  return '⏳ waiting';
}
function rqListBody(kid) {
  const rows = mnyRequestsFor(kid).slice().reverse().map(q => `<div class="rq-chip ${'rq-chip--' + (q.status || 'open')}"><span>${escapeHtml(q.icon)} ${escapeHtml(q.text)}</span><b>${escapeHtml(rqStatusText(q))}</b></div>`).join('')
    || `<div class="rq-empty">Nothing asked yet.</div>`;
  return `${rows}${rqGiftsList(kid)}`;
}
/* 🎁 The gifts on record, newest first (the last ten): from whom, when, and
   where each stands. A grown-up taps one to correct it through the Record
   sheet that recorded it. Cash from home is her bank, not a gift (Plan v17
   item 10), so it is not listed here. */
function rqGiftsList(kid) {
  const all = mnyEnsureDeposits(kid).filter(x => x && !sdIsHomeCash(x))
    .sort((a, b) => String(b.dayKey || '').localeCompare(String(a.dayKey || ''))).slice(0, 10);
  if (!all.length) return '';
  return `<div class="rq-q">🎁 Gifts</div>${all.map(dep => {
    const inner = `<span>🎁 ${escapeHtml(dep.giver || dep.from || 'A gift')}${dep.giver && dep.from ? ' · ' + escapeHtml(dep.from) : ''} · ${escapeHtml(mnyShortDate(dep.dayKey || dep.weekKey))}</span>
      <b>${escapeHtml(mnyMoney(dep.amount))} · ${escapeHtml(dep.rejectedAt ? 'not this time' : dep.pendingApproval ? '⏳ waiting' : '✓ counted')}</b>`;
    return isParent()
      ? `<button type="button" class="rq-chip rq-chip--tap" data-mny-action="gift-edit" data-mny-dep="${escapeAttr(dep.id)}">${inner}</button>`
      : `<div class="rq-chip">${inner}</div>`;
  }).join('')}`;
}

/* The preview line and the buttons every asking sheet ends with. The
   Move · Cash sheet has no "Not now" — its × closes it, as drawn (Plan v18
   B4); Draw early says its one line itself (`preview: false`). */
function rqPreviewAndFoot(o) {
  const st = rqState();
  const opt = o || {};
  return `${opt.preview === false ? '' : `<div class="rq-preview" data-rq-preview>${escapeHtml(st.preview || '')}</div>`}
    <div class="rq-foot">
      ${opt.notNow === false ? '' : '<button type="button" class="rq-notnow" data-mny-action="rq-close">Not now</button>'}
      <button type="button" class="rq-send${st.ready ? ' ready' : ''}" data-mny-action="rq-send">Send to parents →</button>
    </div>`;
}

function rqRender() {
  const host = document.getElementById('requestBody');
  if (!host || !rqDraft) return;
  const d = rqDraft, kid = d.kid;
  const title = document.getElementById('rqSheetTitle');
  // The result sheet's line sits beside its title, on one line (M8-2).
  if (title) title.innerHTML = escapeHtml(MNY_INFO_KINDS.indexOf(d.kind) >= 0 ? mnyInfoSheetTitle(d) : RQ_TITLES[d.kind])
    + (d.kind === 'result' ? ' <span class="rq-titlesub">The official results sheet decides. A parent checks it before anything pays.</span>' : '');
  const sheet = host.closest('.sheet');
  if (sheet) sheet.setAttribute('data-rq-kind', d.kind);
  if (sheet) sheet.setAttribute('data-rq-mode', d.kind === 'move' ? d.mode : '');
  let body;
  if (d.kind === 'result') body = rqResultBody(kid, d);
  else if (d.kind === 'move') body = rqMoveBody(kid, d);
  else if (d.kind === 'goal') body = rqGoalBody(kid, d);
  else if (d.kind === 'club') body = rqClubBody(kid, d);
  else if (d.kind === 'gift') body = rqGiftBody(kid, d);
  else if (d.kind === 'dispute') body = rqDisputeBody(kid, d);
  else if (d.kind === 'prices') body = rqPricesBody(d);
  else if (MNY_INFO_KINDS.indexOf(d.kind) >= 0) body = mnyInfoSheetBody(d);
  else body = rqListBody(kid);
  host.innerHTML = `<button type="button" class="rq-x" data-mny-action="rq-close" aria-label="Close">✕</button>${body}`;
}

/* Typing changed something the button and the preview say: update those two,
   in place, and nothing else — the input keeps its caret. */
function rqSync() {
  const host = document.getElementById('requestBody');
  if (!host || !rqDraft) return;
  const st = rqState();
  const pv = host.querySelector('[data-rq-preview]');
  if (pv && pv.textContent !== (st.preview || '')) pv.textContent = st.preview || '';
  const b = host.querySelector('[data-mny-action="rq-send"]');
  if (b) b.classList.toggle('ready', !!st.ready);
}

/* Taps, handed over by mnyHandleClick for every `rq-…` action. */
function rqHandleAction(a, el) {
  if (!rqDraft) return;
  const d = rqDraft, kid = d.kid;
  if (a === 'rq-close') { rqClose(); return; }
  if (a === 'rq-pricetab') { d.priceTab = el.getAttribute('data-mny-id'); rqRender(); return; }
  if (el.getAttribute('aria-disabled') === 'true') {
    const why = el.getAttribute('data-mny-why');
    if (why) showToast(why);
    return;
  }
  const id = el.getAttribute('data-mny-id');
  const i = Number(el.getAttribute('data-mny-i'));
  const step = Number(el.getAttribute('data-mny-d')) || 0;
  const pick = d.pick;
  if (a === 'rq-send') { rqSend(); return; }
  if (a === 'rq-pick') {
    const x = rqPlannedRecent(kid).find(p => p.blockId === id && p.st === 'open');
    if (!x) return;
    d.pick = rqPickFrom(x); d.customAsk = false;
  } else if (a === 'rq-custom') {
    // With planned meets to check against, ask first; with none, straight in.
    if (rqPlannedRecent(kid).length && !(pick && pick.custom)) { d.customAsk = true; d.pick = null; }
    else d.pick = rqCustomPick();
  } else if (a === 'rq-customok') {
    d.customAsk = false; d.pick = rqCustomPick();
  } else if (a === 'rq-customback') {
    d.customAsk = false; d.pick = null;
  } else if (a === 'rq-sport' && pick) {
    pick.sport = id === 'swim' ? 'swim' : 'skate';
    pick.races = pick.sport === 'swim' ? [{ ev: '50 Free', time: '', pts: 0 }] : [];
  } else if (a === 'rq-racepts' && pick && pick.races[i]) {
    pick.races[i].pts = Math.max(0, (Number(pick.races[i].pts) || 0) + step);
  } else if (a === 'rq-racedel' && pick && pick.races.length > 1) {
    pick.races.splice(i, 1);
  } else if (a === 'rq-raceadd' && pick && pick.races.length < 4) {
    const used = pick.races.map(r => r.ev);
    pick.races.push({ ev: RQ_SWIM_EVENTS.find(e => used.indexOf(e) < 0) || RQ_SWIM_EVENTS[0], time: '', pts: 0 });
  } else if (a === 'rq-qual' && pick) { pick.qual = !pick.qual;
  } else if (a === 'rq-prov' && pick) { pick.prov = !pick.prov;
  } else if (a === 'rq-grp' && pick) { pick.grp = Number(id) || 0;
  } else if (a === 'rq-ovr' && pick) { pick.ovr = Number(id) || 0;
  } else if (a === 'rq-pts' && pick) { pick.pts = Math.max(0, (Number(pick.pts) || 0) + step);
  } else if (a === 'rq-mode') {
    const mode = ['move', 'cash', 'dep', 'early'].indexOf(id) >= 0 ? id : 'move';
    Object.assign(d, { mode, from: 'ready', amt: 1, to: mode === 'cash' ? 'cash' : null, why: '' });
  } else if (a === 'rq-from') {
    d.from = id; d.amt = 1;
    if (d.mode === 'cash') d.to = 'cash'; else if (d.to === id) d.to = null;
  } else if (a === 'rq-to') { d.to = id;
  } else if (a === 'rq-amt') {
    const cap = d.mode === 'early' ? rqAdvState(kid, d).left : rqMoveState(kid, d).max;
    d.amt = Math.max(1, Math.min(Math.max(1, cap), (d.amt || 1) + step));
  } else if (a === 'rq-amtall') { d.amt = Math.max(1, rqMoveState(kid, d).max);
  } else if (a === 'rq-why') { d.why = id;
  } else if (a === 'rq-icon') { d.icon = id;
  } else if (a === 'rq-price') { d.amt = Math.max(5, Math.min(500, (d.amt || 30) + step));
  } else if (a === 'rq-priceset') { d.amt = Number(id) || 30;
  } else if (a === 'rq-keep') { d.keep = id === 'ready' ? 'ready' : 'move';
  } else if (a === 'rq-session') { d.blockId = id;
  } else if (a === 'rq-giftamt') { d.amt = Math.max(1, Math.min(500, (money2(d.amt) || 0) + step));
  } else if (a === 'rq-giftset') { d.amt = Number(id) || 10;
  } else if (a === 'rq-giftfrom') { d.from = MNY_FROM.indexOf(id) >= 0 ? id : MNY_FROM[0];
  } else if (a === 'rq-giftday') { d.dayKey = rqGiftDays().indexOf(id) >= 0 ? id : todayKey();
  } else {
    return;
  }
  rqRender();
}

/* Typing, handed over by mnyHandleInput: the draft, then the button and the
   preview in place. A select's change redraws nothing either — its new value
   is already on screen. */
function rqHandleInput(a, el) {
  if (!rqDraft) return;
  const d = rqDraft;
  const i = Number(el.getAttribute('data-mny-i'));
  if (a === 'rq-name' && d.pick) d.pick.name = el.value;
  else if (a === 'rq-goalname') d.name = el.value;
  else if (a === 'rq-disputenote') d.note = String(el.value || '').slice(0, 80);
  else if (a === 'rq-giver') d.giver = String(el.value || '').slice(0, 40);
  else if (a === 'rq-goaldate') d.targetDate = /^\d{4}-\d{2}-\d{2}$/.test(String(el.value || '')) ? String(el.value) : '';
  else if (a === 'rq-time' && d.pick && d.pick.races[i]) d.pick.races[i].time = String(el.value || '').slice(0, 20);
  else if (a === 'rq-ev' && d.pick && d.pick.races[i]) d.pick.races[i].ev = el.value;
  else return;
  rqSync();
}

/* "Send to Dad →": one door, `mnyAddRequest`, and the owner decides. */
function rqSend() {
  const d = rqDraft, kid = d.kid;
  const st = rqState();
  if (!st.ready) { showToast(st.need || st.preview || 'Not ready yet'); return; }
  let rec = null;
  if (d.kind === 'result') {
    const p = d.pick, races = p.sport === 'swim' ? p.races : [];
    const tot = races.reduce((a, r) => a + (Number(r.pts) || 0), 0);
    const sum = p.sport === 'swim'
      ? `${races.length} race${races.length === 1 ? '' : 's'} · ${tot} pts${p.qual ? ' · qualified' : ''}${p.prov ? ' · Provincials' : ''}`
      : `group ${rqOrd(p.grp)} · overall ${rqOrd(p.ovr)} · ${Number(p.pts) || 0} pts`;
    rec = mnyAddRequest(kid, { kind: 'comp', compId: p.compId, blockId: p.blockId, custom: !!p.custom,
      sport: p.sport, name: String(p.name || '').trim(), dayKey: p.dayKey || todayKey(), races,
      pts: p.sport === 'swim' ? tot : (Number(p.pts) || 0), grp: p.grp, ovr: p.ovr,
      qualified: !!p.qual, provincial: !!p.prov, text: `${String(p.name || '').trim()} · ${sum}` });
  } else if (d.kind === 'move' && d.mode === 'early') {
    rec = mnyAddRequest(kid, { kind: 'adv', amount: st.amt, why: d.why,
      day: new Date().toLocaleDateString('en-US', { weekday: 'short' }),
      text: `Draw $${st.amt} in advance · ${d.why}` });
  } else if (d.kind === 'move' && d.mode === 'dep') {
    rec = mnyAddRequest(kid, { kind: 'deposit', amount: st.amt, note: 'into ' + rqHomeShort(d.to),
      text: `Put $${st.amt} cash in → ${rqHomeShort(d.to)}` });
  } else if (d.kind === 'move') {
    rec = mnyAddRequest(kid, { kind: 'move', from: d.from, to: d.mode === 'cash' ? 'cash' : d.to,
      amount: st.amt, note: d.why });
  } else if (d.kind === 'goal') {
    const jar = rqGoalJar(kid);
    rec = mnyAddRequest(kid, { kind: 'goal', name: String(d.name || '').trim(), icon: d.icon, target: d.amt || 30,
      keep: jar.saved > 0 ? (d.keep || 'move') : 'move', targetDate: d.targetDate || '' });
  } else if (d.kind === 'gift') {
    const giver = String(d.giver || '').trim();
    rec = mnyAddRequest(kid, { kind: 'gift', amount: money2(d.amt), from: d.from, giver, dayKey: d.dayKey,
      text: `${d.from}${giver ? ' · ' + giver : ''} · ${rqDollars(d.amt)}` });
  } else if (d.kind === 'dispute') {
    const f = mrFines(kid).find(x => x && x.id === d.fineId);
    const why = [d.why, String(d.note || '').trim()].filter(Boolean).join(' · ');
    rec = mnyAddRequest(kid, { kind: 'dispute', fineId: d.fineId, why,
      text: `This fine is wrong: ${f ? guFineLabel(f.itemId) + ' · ' + mnyDayName(f.dayKey) : 'a fine'}${why ? ' · ' + why : ''}` });
  } else if (d.kind === 'club') {
    const s = mrSessionsWeek(ctThisWeekKey(), kid).sessions.find(x => x.blockId === d.blockId);
    rec = mnyAddRequest(kid, { kind: 'skip', blockId: d.blockId, dayKey: s ? s.dayKey : todayKey(), why: d.why,
      text: `Can’t make ${s ? rqDayLabel(s.dayKey) : 'a session'} · ${d.why}` });
  }
  if (!rec) return;
  showToast('Sent to parents ✋');
  rqClose();
  if (typeof rcRefreshSurfaces === 'function') rcRefreshSurfaces();
}
