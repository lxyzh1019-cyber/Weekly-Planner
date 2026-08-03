// Weekly-Planner — sports loan: schedule, Sunday transfer, arrears, early payment.
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   THE SPORTS LOAN

   Each kid borrows 10% of what her sport costs and pays it back. The terms are
   the lesson, not the money:

     on schedule    0% — never any interest
     overdue        5% a month, SIMPLE, on the overdue portion only
     paid early     10% bonus on whatever she pays early, any amount

   Simple interest matters here. Compounding would charge interest on interest,
   which is both harder to explain and harsher than anything a ten-year-old
   should meet first. `arrears` therefore accrues against the overdue principal
   only, and accrued interest is tracked separately so it can never itself earn
   interest.

   The early-payment bonus is frozen onto each payment when it is made, so
   changing the rate later can't restate a balance she already paid down.

   ── MORE THAN ONE DEBT ──
   A kid can owe for more than one thing at a time (skis and a bike), so the
   single `profiles[kid].loan` object became `profiles[kid].debts` — a list of
   records that each carry their OWN terms. The terms live on the record rather
   than in the rulebook because two debts cannot share one principal, one rate
   and one schedule; the rulebook's `loan` block is now the seed those terms are
   copied from when the first debt is created, and the default for new ones.

   Every function here takes an optional trailing `debtId`. Left out, it means
   the first debt — which is the sports loan the rulebook describes, so every
   existing caller keeps working unchanged. Money that is paid ahead of schedule
   goes to the HIGHEST-BONUS debt first (mnyDebtsByPriority), because that is
   the one where a dollar clears the most.
   ════════════════════════════════════════════════════════════════ */

function loanRules(dayKey) { return (mrRulesFor(dayKey || todayKey()).loan) || {}; }

/* The debt each kid starts with. Deliberately generic: the real name is data a
   parent types on the Money rules page, and every string that shows it
   interpolates rather than hardcoding a sport. */
const MNY_DEBT_SEED = { name: 'Sports loan', icon: '🎿', item: 'her season' };
const MNY_DEBT_ICONS = ['🎿', '⛸️', '🏊', '💃', '🚲', '🎸', '💻', '🎮', '📱', '🏀', '🎹', '📚'];

/* Fill in anything a saved or hand-made record is missing. Runs on every read,
   so a debt added by an older version of the app can never be half-shaped. */
function mnyNormalizeDebt(d) {
  if (!d || typeof d !== 'object') return null;
  if (!d.id) d.id = mrNewId('debt-');
  if (!d.name) d.name = MNY_DEBT_SEED.name;
  if (!d.icon) d.icon = MNY_DEBT_SEED.icon;
  if (d.item == null) d.item = '';
  ['principal', 'downPayment', 'monthly', 'paid', 'arrears', 'arrearsInterest', 'downPaid']
    .forEach(k => { d[k] = money2(d[k]); });
  if (d.downPaymentDue == null) d.downPaymentDue = '';
  if (d.months == null) d.months = 0;
  if (d.arrearsRatePct == null) d.arrearsRatePct = 0;
  if (d.bonusRate == null) d.bonusRate = 0;
  if (!Array.isArray(d.payments)) d.payments = [];
  if (d.lastPaymentMonth === undefined) d.lastPaymentMonth = null;   // 'YYYY-MM'
  if (d.lastInterestMonth === undefined) d.lastInterestMonth = null; // 'YYYY-MM'
  if (!d.createdAt) d.createdAt = Date.now();
  return d;
}

/* Lazy-init + one-time migration, mirroring bankConfig() (js/14-money.js:24) so
   saved state upgrades silently on first read. The old single `loan` object
   becomes debt #1 with every field carried across — a migration that dropped
   `payments` would erase money a kid actually paid. */
function mnyEnsureDebts(kid) {
  const p = getProfData(kid);
  if (!Array.isArray(p.debts)) p.debts = [];
  if (!p.debts.length) {
    const r = loanRules();
    const old = (p.loan && typeof p.loan === 'object') ? p.loan : {};
    p.debts.push(mnyNormalizeDebt({
      id: 'loan',                       // stable id — this is the original sports loan
      name: MNY_DEBT_SEED.name, icon: MNY_DEBT_SEED.icon, item: MNY_DEBT_SEED.item,
      principal: Number((r.principal || {})[kid]) || 0,
      downPayment: Number((r.downPayment || {})[kid]) || 0,
      downPaymentDue: r.downPaymentDue || '',
      monthly: Number((r.monthly || {})[kid]) || 0,
      months: Number(r.months) || 0,
      arrearsRatePct: Number(r.arrearsRatePct) || 0,
      bonusRate: Number(r.earlyPaymentBonusPct) || 0,
      paid: old.paid, payments: Array.isArray(old.payments) ? old.payments : [],
      arrears: old.arrears, arrearsInterest: old.arrearsInterest, downPaid: old.downPaid,
      lastPaymentMonth: old.lastPaymentMonth || null,
      lastInterestMonth: old.lastInterestMonth || null,
    }));
  } else {
    p.debts.forEach(mnyNormalizeDebt);
  }
  return p.debts;
}

/* Every debt, in the order they were taken on. */
function mnyDebts(kid) { return mnyEnsureDebts(kid); }
/* Every debt still owing something, highest bonus rate first — the order extra
   money should be paid in, because that is where a dollar clears the most. */
function mnyDebtsByPriority(kid) {
  return mnyEnsureDebts(kid).slice()
    .sort((a, b) => (Number(b.bonusRate) || 0) - (Number(a.bonusRate) || 0));
}
function mnyDebtById(kid, debtId) {
  const list = mnyEnsureDebts(kid);
  if (!debtId) return list[0] || null;
  return list.find(d => d.id === debtId) || null;
}
function mnyDebtLabel(kid, debtId) {
  const d = mnyDebtById(kid, debtId);
  return d ? (d.icon + ' ' + d.name) : 'the loan';
}

/* Everything owed across every debt — what page 1 and the meeting show. */
function mnyTotalOwing(kid) {
  return money2(mnyEnsureDebts(kid).reduce((s, d) => s + loanBalance(kid, d.id), 0));
}
function mnyTotalPrincipal(kid) {
  return money2(mnyEnsureDebts(kid).reduce((s, d) => s + (Number(d.principal) || 0), 0));
}
function mnyTotalPaid(kid) {
  return money2(mnyEnsureDebts(kid).reduce((s, d) => s + (Number(d.paid) || 0), 0));
}
/* How much of everything owed has been cleared, 0–100. Drives the Money school
   ladder and every progress bar. */
function mnyPaidPct(kid) {
  const principal = mnyTotalPrincipal(kid);
  if (!(principal > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((mnyTotalPaid(kid) / principal) * 100)));
}
/* The bonus already banked by paying early, across every debt. Read from the
   frozen per-payment records, never from a rate applied after the fact. */
function mnyBonusEarned(kid, debtId) {
  const list = debtId ? [mnyDebtById(kid, debtId)].filter(Boolean) : mnyEnsureDebts(kid);
  return money2(list.reduce((s, d) => s + (d.payments || []).reduce(
    (t, p) => t + Math.max(0, money2((Number(p.credited) || 0) - (Number(p.amount) || 0) + (Number(p.toInterest) || 0))), 0), 0));
}

/* ── Debt records ──
   Adding, renaming and re-rating all land in the rules audit log so the change
   history on the Money rules page is one list. Nothing here ever touches
   `paid` or `payments`: renaming a debt must not reset progress. */
function mnyAddDebt(kid, fields) {
  if (!isParent()) { showToast('Only parents can add a loan 🔒'); return null; }
  const r = loanRules();
  const d = mnyNormalizeDebt({
    arrearsRatePct: Number(r.arrearsRatePct) || 0,
    bonusRate: Number(r.earlyPaymentBonusPct) || 0,
    ...(fields || {}),
  });
  mnyEnsureDebts(kid).push(d);
  mrLogAppend({ path: 'debts.' + kid + '.' + d.id, from: null, to: d.name,
                reason: (fields && fields.reason) || MR_DEFAULT_REASON,
                note: 'Added ' + d.icon + ' ' + d.name });
  saveAll();
  return d;
}
function mnyEditDebt(kid, debtId, field, value, opts) {
  if (!isParent()) { showToast('Only parents can change a loan 🔒'); return false; }
  const d = mnyDebtById(kid, debtId);
  if (!d) return false;
  const before = d[field];
  const num = ['principal', 'downPayment', 'monthly', 'months', 'arrearsRatePct', 'bonusRate', 'paid'];
  d[field] = num.includes(field) ? Math.max(0, Number(value) || 0) : value;
  if (JSON.stringify(before) === JSON.stringify(d[field])) return false;
  d.updatedAt = Date.now();
  mrLogAppend({ path: 'debts.' + kid + '.' + d.id + '.' + field, from: before, to: d[field],
                reason: (opts && opts.reason) || MR_DEFAULT_REASON,
                note: (opts && opts.note) || (d.name + ' — ' + field) });
  saveAll();
  return true;
}
function mnyRemoveDebt(kid, debtId) {
  if (!isParent()) { showToast('Only parents can remove a loan 🔒'); return false; }
  const list = mnyEnsureDebts(kid);
  if (list.length <= 1) { showToast('There has to be at least one loan on the record'); return false; }
  const i = list.findIndex(d => d.id === debtId);
  if (i < 0) return false;
  const [gone] = list.splice(i, 1);
  // Tombstone, so a delete made here doesn't resurrect from the other device.
  ensureTombstones()['debt:' + gone.id] = Date.now();
  mrLogAppend({ path: 'debts.' + kid + '.' + gone.id, from: gone.name, to: null,
                reason: MR_DEFAULT_REASON, note: 'Removed ' + gone.icon + ' ' + gone.name });
  saveAll();
  return true;
}

function loanState(kid, debtId) {
  return mnyDebtById(kid, debtId) || mnyNormalizeDebt({ id: 'none' });
}

function loanPrincipal(kid, debtId)   { return money2(loanState(kid, debtId).principal); }
function loanMonthly(kid, debtId)     { return money2(loanState(kid, debtId).monthly); }
function loanDownPayment(kid, debtId) { return money2(loanState(kid, debtId).downPayment); }

/* The calendar month a date belongs to. 'YYYY-MM-DD' slices chronologically. */
function loanMonthKey(dayKey) { return String(dayKey || todayKey()).slice(0, 7); }

/* How much of the deposit is still owed. */
function loanDownOutstanding(kid, debtId) {
  const d = loanState(kid, debtId);
  return money2(Math.max(0, money2(d.downPayment) - money2(d.downPaid)));
}
function loanDownIsDue(kid, dayKey, debtId) {
  const due = loanState(kid, debtId).downPaymentDue;
  return !!due && String(dayKey || todayKey()) >= due && loanDownOutstanding(kid, debtId) > 0;
}

/* What the schedule asks for right now, and which kind of payment it is.

   The deposit comes first: until it is settled there are no monthly payments,
   which is what "down payment, then ten months" actually means. */
function loanDueNow(kid, dayKey, debtId) {
  const today = dayKey || todayKey();
  const d = loanState(kid, debtId);
  const dueDate = d.downPaymentDue;
  if (loanIsCleared(kid, debtId)) return { kind: null, amount: 0, reason: 'cleared' };
  if (!dueDate || today < dueDate) return { kind: null, amount: 0, reason: 'not-started' };
  const down = loanDownOutstanding(kid, debtId);
  if (down > 0) return { kind: 'down', amount: down, reason: 'down-payment' };
  return { kind: 'scheduled', amount: money2(d.monthly), reason: 'monthly' };
}

/* What the schedule asks of this kid right now, across every debt. */
function mnyDueNowAll(kid, dayKey) {
  return mnyDebtsByPriority(kid)
    .map(d => Object.assign({ debtId: d.id, debt: d }, loanDueNow(kid, dayKey, d.id)))
    .filter(x => x.amount > 0);
}
function mnyDueNowTotal(kid, dayKey) {
  return money2(mnyDueNowAll(kid, dayKey).reduce((s, x) => s + x.amount, 0));
}

/* What's still owed: principal not yet cleared, plus any interest charged. */
function loanBalance(kid, debtId) {
  const l = loanState(kid, debtId);
  return money2(Math.max(0, money2(l.principal) - money2(l.paid)) + money2(l.arrearsInterest));
}
function loanIsCleared(kid, debtId) { return loanBalance(kid, debtId) <= 0; }

/* Record a payment.

   kind 'scheduled' — the monthly minimum. Clears exactly what's paid.
   kind 'down'      — the deposit. Clears exactly what's paid, and also counts
                      against the deposit so the schedule can move on to the
                      monthly payments.
   kind 'early'     — anything above the minimum. Earns the bonus, so $100 paid
                      clears $110 of principal.

   Interest owed is always settled before principal, otherwise a kid could
   carry interest indefinitely while paying the loan down. */
function loanRecordPayment(kid, amount, kind, debtId) {
  const l = loanState(kid, debtId);
  let amt = money2(amount);
  if (!(amt > 0)) return null;

  let toInterest = 0;
  if (l.arrearsInterest > 0) {
    toInterest = Math.min(l.arrearsInterest, amt);
    l.arrearsInterest = money2(l.arrearsInterest - toInterest);
    amt = money2(amt - toInterest);
  }

  // The rate comes from the debt's own record, so two debts can carry two
  // different bonuses — and is frozen onto the payment, so re-rating a debt
  // later can never restate a balance she already paid down.
  const bonusPct = (kind === 'early') ? (Number(l.bonusRate) || 0) : 0;
  const credited = money2(amt * (1 + bonusPct / 100));
  const owed = Math.max(0, money2(money2(l.principal) - money2(l.paid)));
  const applied = Math.min(credited, owed);        // never overpay the loan
  l.paid = money2(money2(l.paid) + applied);
  if (l.arrears > 0) l.arrears = money2(Math.max(0, l.arrears - applied));
  // The deposit is tracked on its own so the schedule knows when the monthly
  // payments start — settled against what actually landed on principal.
  if (kind === 'down') {
    l.downPaid = money2(Math.min(money2(l.downPayment), money2(l.downPaid) + applied));
  }

  const rec = { id: mrNewId('lp-'), at: Date.now(), debtId: l.id, amount: money2(amount),
                kind: kind || 'scheduled', bonusPct, credited: applied, toInterest: money2(toInterest) };
  l.payments.push(rec);
  saveAll();
  return rec;
}

/* Pay extra across every debt, highest bonus first — the split page 3 commits.
   Returns what landed where so the meeting can say it out loud. */
function mnySpreadEarlyPayment(kid, amount, debtId) {
  let left = money2(amount);
  if (!(left > 0)) return [];
  const order = debtId ? [mnyDebtById(kid, debtId)].filter(Boolean) : mnyDebtsByPriority(kid);
  const out = [];
  order.forEach(d => {
    if (!(left > 0)) return;
    const owed = loanBalance(kid, d.id);
    if (!(owed > 0)) return;
    // Never hand over more than clears the debt: with a 10% bonus, $100 of cash
    // clears $110, so the cash needed is the balance divided by 1 + bonus.
    const bonus = (Number(d.bonusRate) || 0) / 100;
    const need = money2(owed / (1 + bonus));
    const pay = money2(Math.min(left, need));
    if (!(pay > 0)) return;
    const rec = loanRecordPayment(kid, pay, 'early', d.id);
    if (rec) out.push({ debtId: d.id, name: d.name, icon: d.icon, paid: pay, cleared: rec.credited });
    left = money2(left - pay);
  });
  return out;
}

/* Pay the deposit — hers to make early, in whatever pieces she can manage.
   Anything paid here counts against the deposit rather than earning the
   early-payment bonus: the deposit is the schedule, not ahead of it. */
async function loanPayDownPaymentPrompt(kid, debtId) {
  const w = ensureWallet(kid);
  const d = loanState(kid, debtId);
  const owing = loanDownOutstanding(kid, debtId);
  if (!(owing > 0)) { showToast('Down payment is already settled ✅'); return; }
  const v = await showPrompt(
    `Down payment ${d.icon}\n$${owing.toFixed(2)} still to pay of the $${loanDownPayment(kid, debtId).toFixed(2)} deposit.\nHow much? (you have $${w.cash.toFixed(2)})`,
    { value: '', type: 'number' });
  if (v == null || v === '') return;
  const amt = money2(Math.min(parseFloat(v) || 0, w.cash, owing));
  if (!(amt > 0)) { showToast('Enter an amount like 20'); return; }
  w.cash = money2(w.cash - amt);
  loanRecordPayment(kid, amt, 'down', d.id);
  const left = loanDownOutstanding(kid, debtId);
  showToast(left > 0
    ? `${d.icon} Paid $${amt.toFixed(2)} — $${left.toFixed(2)} of the deposit to go`
    : `${d.icon} Deposit settled — monthly payments start now`);
  if (typeof mnyRerenderMoney === 'function') mnyRerenderMoney();
}

/* One month of simple interest on the overdue principal. Charged against a
   separate bucket so it never compounds.

   Stamped with the calendar month: the family meeting runs every Sunday, and
   charging "one month" of interest at each of them would be four to five
   months of interest a month. The month is stamped even when nothing is
   overdue, so arrears raised later in the same month aren't charged interest
   for a month that had already begun. */
function loanAccrueArrears(kid, opts) {
  const o = opts || {};
  const l = loanState(kid, o.debtId);
  const mk = loanMonthKey(o.dayKey);
  if (l.lastInterestMonth === mk && !o.force) return 0;
  l.lastInterestMonth = mk;
  if (!(l.arrears > 0)) { saveAll(); return 0; }
  const rate = (Number(l.arrearsRatePct) || 0) / 100;
  const interest = money2(l.arrears * rate);
  l.arrearsInterest = money2(l.arrearsInterest + interest);
  saveAll();
  return interest;
}
/* Every debt's interest, once each per calendar month. */
function mnyAccrueArrearsAll(kid, opts) {
  return money2(mnyDebts(kid).reduce(
    (s, d) => s + loanAccrueArrears(kid, Object.assign({}, opts, { debtId: d.id })), 0));
}

/* The Sunday transfer. When the wallet covers the minimum it just moves. When
   it doesn't, she chooses — and all three choices carry a different price:

     pay_available      pay what's there; the shortfall goes overdue
     pay_nothing        defer the whole payment; all of it goes overdue
     cover_from_savings top up from savings so nothing goes overdue, giving up
                        whatever that money was earning

   The schedule is monthly and the meeting is weekly, so the month is stamped
   once a payment is settled either way — paid, part-paid or deferred all use
   up that month's turn. Otherwise every Sunday would charge the month again.

   Returns a description of what happened for the meeting recap. */
function loanSundayTransfer(kid, choice, opts) {
  const o = opts || {};
  const l = loanState(kid, o.debtId);
  const today = o.dayKey || todayKey();
  const mk = loanMonthKey(today);
  const duty = loanDueNow(kid, today, o.debtId);

  if (duty.reason === 'cleared') return { status: 'cleared', paid: 0, shortfall: 0 };
  if (duty.reason === 'not-started') return { status: 'not-started', paid: 0, shortfall: 0 };
  if (l.lastPaymentMonth === mk && !o.force) {
    return { status: 'already-this-month', paid: 0, shortfall: 0, kind: duty.kind };
  }
  // The family can agree at the meeting to pay less than the schedule this
  // month (opts.cap). The rest is NOT forgiven — it lands in arrears below,
  // exactly as an unaffordable month would, so the cost is the same whether
  // she couldn't pay or chose not to.
  const scheduled = money2(duty.amount);
  const due = (o.cap == null) ? scheduled : money2(Math.max(0, Math.min(o.cap, scheduled)));
  const kind = duty.kind;
  if (!(scheduled > 0)) return { status: 'nothing-due', paid: 0, shortfall: 0 };
  if (!(due > 0)) {
    l.arrears = money2(l.arrears + scheduled);
    l.lastPaymentMonth = mk;
    saveAll();
    return { status: 'deferred', paid: 0, shortfall: scheduled, kind, debtId: l.id, name: l.name, icon: l.icon };
  }

  // Whatever the agreed payment leaves unpaid of the scheduled amount still
  // has to be owed, on every path out of here.
  const agreedShort = money2(scheduled - due);
  const settle = (res) => {
    if (agreedShort > 0) l.arrears = money2(l.arrears + agreedShort);
    l.lastPaymentMonth = mk;
    saveAll();
    return Object.assign({ kind, debtId: l.id, name: l.name, icon: l.icon }, res,
      { shortfall: money2((res.shortfall || 0) + agreedShort) });
  };
  const w = ensureWallet(kid);

  if (w.cash >= due) {
    w.cash = money2(w.cash - due);
    loanRecordPayment(kid, due, kind, l.id);
    return settle({ status: agreedShort > 0 ? 'partial' : 'paid', paid: due, shortfall: 0 });
  }

  const available = money2(w.cash);
  if (choice === 'cover_from_savings') {
    const saved = mnySavedTotal(kid);
    const need = money2(due - available);
    const fromSavings = Math.min(need, saved);
    if (money2(available + fromSavings) < due) {
      // Savings can't close the gap either — fall back to paying what exists.
      choice = 'pay_available';
    } else {
      mnyTakeFromSaved(kid, fromSavings);
      w.cash = money2(w.cash + fromSavings);
      w.cash = money2(w.cash - due);
      loanRecordPayment(kid, due, kind, l.id);
      return settle({ status: 'covered-from-savings', paid: due, shortfall: 0, fromSavings });
    }
  }

  if (choice === 'pay_nothing') {
    l.arrears = money2(l.arrears + due);
    return settle({ status: 'deferred', paid: 0, shortfall: due });
  }

  // pay_available (also the fallback)
  w.cash = money2(w.cash - available);
  if (available > 0) loanRecordPayment(kid, available, kind, l.id);
  const shortfall = money2(due - available);
  l.arrears = money2(l.arrears + shortfall);
  return settle({ status: 'partial', paid: available, shortfall });
}

/* Every debt's scheduled payment, highest bonus first — what the meeting runs.
   Returns one result per debt so the recap can name each. */
function mnySundayTransferAll(kid, choice, opts) {
  const o = opts || {};
  return mnyDebtsByPriority(kid)
    .map(d => {
      // A payment the family agreed down at the meeting caps this debt's
      // transfer; without a week to read overrides from, the schedule stands.
      const cap = (o.weekKey && typeof mnyGetPaymentOverride === 'function')
        ? mnyGetPaymentOverride(kid, o.weekKey, d.id) : null;
      return loanSundayTransfer(kid, choice, Object.assign({}, o, { debtId: d.id, cap }));
    })
    .filter(r => r && r.status !== 'cleared' && r.status !== 'not-started' && r.status !== 'nothing-due');
}

/* Pay extra, any amount — this is the one that earns the 10%.

   This is also the "loan-surplus choice" the honesty ladder withdraws at step
   3, so a strike on record this week closes it. */
async function loanPayExtraPrompt(kid, debtId) {
  if (typeof mrLosesChoices === 'function' && mrLosesChoices(kid)) {
    showToast('Loan choices are paused this week ⚖️ — decided together on Sunday');
    return;
  }
  const w = ensureWallet(kid);
  const d = loanState(kid, debtId);
  const bonus = Number(d.bonusRate) || 0;
  const v = await showPrompt(
    `Pay extra off ${d.name} ${d.icon}\nAnything you pay early earns ${bonus}% — $100 clears $${(100 * (1 + bonus / 100)).toFixed(0)}.\nHow much? (you have $${w.cash.toFixed(2)})`,
    { value: '', type: 'number' });
  if (v == null || v === '') return;
  const amt = money2(Math.min(parseFloat(v) || 0, w.cash));
  if (!(amt > 0)) { showToast('Enter an amount like 20'); return; }
  w.cash = money2(w.cash - amt);
  const rec = loanRecordPayment(kid, amt, 'early', d.id);
  showToast(`${d.icon} Paid $${amt.toFixed(2)} — cleared $${(rec ? rec.credited : amt).toFixed(2)} with the ${bonus}% bonus`);
  if (typeof mnyRerenderMoney === 'function') mnyRerenderMoney();
}

/* Are they on pace? Compares what's been paid against what the schedule says
   should have been by now, so "behind" is a fact rather than a feeling. */
function loanPacing(kid, debtId) {
  const l = loanState(kid, debtId);
  const due = l.downPaymentDue;
  const principal = money2(l.principal);
  if (!principal || !due) return null;
  const today = todayKey();
  let expected = 0;
  if (today >= due) {
    expected = money2(l.downPayment);
    const start = formatDayKey(due), now = formatDayKey(today);
    const months = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
    expected = money2(Math.min(principal, expected + months * money2(l.monthly)));
  }
  const diff = money2(money2(l.paid) - expected);
  return { expected, paid: money2(l.paid), diff,
           status: diff >= 0 ? 'on-pace' : 'behind', behindBy: money2(Math.max(0, -diff)) };
}

/* When this debt is cleared at the current rate, and how many payments are
   left — the "debt-free date" every effect tile on page 3 shows. `extra` is a
   one-off amount paid on top today. */
function loanFreeDate(kid, debtId, extra) {
  const l = loanState(kid, debtId);
  const monthly = money2(l.monthly);
  const bonus = (Number(l.bonusRate) || 0) / 100;
  let owing = money2(Math.max(0, loanBalance(kid, debtId) - money2(extra) * (1 + bonus)));
  if (!(owing > 0)) return { months: 0, date: todayKey(), cleared: true };
  if (!(monthly > 0)) return { months: null, date: null, cleared: false };
  const months = Math.ceil(owing / monthly);
  const d = formatDayKey(todayKey());
  d.setMonth(d.getMonth() + months);
  return { months, date: ctDateToKey(d), cleared: false };
}
