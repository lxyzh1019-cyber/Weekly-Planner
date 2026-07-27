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
   ════════════════════════════════════════════════════════════════ */

function loanRules(dayKey) { return (mrRulesFor(dayKey || todayKey()).loan) || {}; }

function loanState(kid) {
  const p = getProfData(kid);
  if (!p.loan) p.loan = {};
  const l = p.loan;
  if (l.paid == null) l.paid = 0;              // principal cleared, incl. bonus
  if (!Array.isArray(l.payments)) l.payments = [];
  if (l.arrears == null) l.arrears = 0;        // overdue principal
  if (l.arrearsInterest == null) l.arrearsInterest = 0;  // never itself earns interest
  if (l.downPaid == null) l.downPaid = 0;      // how much of the deposit is settled
  // The schedule is MONTHLY but the meeting is WEEKLY, so both the payment and
  // the interest are stamped with the calendar month they belong to. Without
  // this the monthly payment fires again at every Sunday meeting.
  if (l.lastPaymentMonth == null) l.lastPaymentMonth = null;    // 'YYYY-MM'
  if (l.lastInterestMonth == null) l.lastInterestMonth = null;  // 'YYYY-MM'
  return l;
}

function loanPrincipal(kid) { return Number((loanRules().principal || {})[kid]) || 0; }
function loanMonthly(kid)   { return Number((loanRules().monthly   || {})[kid]) || 0; }
function loanDownPayment(kid) { return Number((loanRules().downPayment || {})[kid]) || 0; }

/* The calendar month a date belongs to. 'YYYY-MM-DD' slices chronologically. */
function loanMonthKey(dayKey) { return String(dayKey || todayKey()).slice(0, 7); }

/* How much of the deposit is still owed. */
function loanDownOutstanding(kid) {
  return money2(Math.max(0, loanDownPayment(kid) - loanState(kid).downPaid));
}
function loanDownIsDue(kid, dayKey) {
  const due = loanRules().downPaymentDue;
  return !!due && String(dayKey || todayKey()) >= due && loanDownOutstanding(kid) > 0;
}

/* What the schedule asks for right now, and which kind of payment it is.

   The deposit comes first: until it is settled there are no monthly payments,
   which is what "down payment, then ten months" actually means. */
function loanDueNow(kid, dayKey) {
  const today = dayKey || todayKey();
  const dueDate = loanRules().downPaymentDue;
  if (loanIsCleared(kid)) return { kind: null, amount: 0, reason: 'cleared' };
  if (!dueDate || today < dueDate) return { kind: null, amount: 0, reason: 'not-started' };
  const down = loanDownOutstanding(kid);
  if (down > 0) return { kind: 'down', amount: down, reason: 'down-payment' };
  return { kind: 'scheduled', amount: loanMonthly(kid), reason: 'monthly' };
}

/* What's still owed: principal not yet cleared, plus any interest charged. */
function loanBalance(kid) {
  const l = loanState(kid);
  return money2(Math.max(0, loanPrincipal(kid) - l.paid) + l.arrearsInterest);
}
function loanIsCleared(kid) { return loanBalance(kid) <= 0; }

/* Record a payment.

   kind 'scheduled' — the monthly minimum. Clears exactly what's paid.
   kind 'down'      — the deposit. Clears exactly what's paid, and also counts
                      against the deposit so the schedule can move on to the
                      monthly payments.
   kind 'early'     — anything above the minimum. Earns the bonus, so $100 paid
                      clears $110 of principal.

   Interest owed is always settled before principal, otherwise a kid could
   carry interest indefinitely while paying the loan down. */
function loanRecordPayment(kid, amount, kind) {
  const l = loanState(kid);
  let amt = money2(amount);
  if (!(amt > 0)) return null;

  let toInterest = 0;
  if (l.arrearsInterest > 0) {
    toInterest = Math.min(l.arrearsInterest, amt);
    l.arrearsInterest = money2(l.arrearsInterest - toInterest);
    amt = money2(amt - toInterest);
  }

  const bonusPct = (kind === 'early') ? (Number(loanRules().earlyPaymentBonusPct) || 0) : 0;
  const credited = money2(amt * (1 + bonusPct / 100));
  const owed = Math.max(0, money2(loanPrincipal(kid) - l.paid));
  const applied = Math.min(credited, owed);        // never overpay the loan
  l.paid = money2(l.paid + applied);
  if (l.arrears > 0) l.arrears = money2(Math.max(0, l.arrears - applied));
  // The deposit is tracked on its own so the schedule knows when the monthly
  // payments start — settled against what actually landed on principal.
  if (kind === 'down') {
    l.downPaid = money2(Math.min(loanDownPayment(kid), l.downPaid + applied));
  }

  const rec = { id: mrNewId('lp-'), at: Date.now(), amount: money2(amount), kind: kind || 'scheduled',
                bonusPct, credited: applied, toInterest: money2(toInterest) };
  l.payments.push(rec);
  saveAll();
  return rec;
}

/* Pay the deposit — hers to make early, in whatever pieces she can manage.
   Anything paid here counts against the deposit rather than earning the
   early-payment bonus: the deposit is the schedule, not ahead of it. */
async function loanPayDownPaymentPrompt(kid) {
  const w = ensureWallet(kid);
  const owing = loanDownOutstanding(kid);
  if (!(owing > 0)) { showToast('Down payment is already settled ✅'); return; }
  const v = await showPrompt(
    `Down payment 🎿\n$${owing.toFixed(2)} still to pay of the $${loanDownPayment(kid).toFixed(2)} deposit.\nHow much? (you have $${w.cash.toFixed(2)})`,
    { value: '', type: 'number' });
  if (v == null || v === '') return;
  const amt = money2(Math.min(parseFloat(v) || 0, w.cash, owing));
  if (!(amt > 0)) { showToast('Enter an amount like 20'); return; }
  w.cash = money2(w.cash - amt);
  loanRecordPayment(kid, amt, 'down');
  const left = loanDownOutstanding(kid);
  showToast(left > 0
    ? `🎿 Paid $${amt.toFixed(2)} — $${left.toFixed(2)} of the deposit to go`
    : `🎿 Deposit settled — monthly payments start now`);
  if (typeof renderPocketScreen === 'function') renderPocketScreen();
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
  const l = loanState(kid);
  const mk = loanMonthKey(o.dayKey);
  if (l.lastInterestMonth === mk && !o.force) return 0;
  l.lastInterestMonth = mk;
  if (!(l.arrears > 0)) { saveAll(); return 0; }
  const rate = (Number(loanRules().arrearsRatePct) || 0) / 100;
  const interest = money2(l.arrears * rate);
  l.arrearsInterest = money2(l.arrearsInterest + interest);
  saveAll();
  return interest;
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
  const l = loanState(kid);
  const today = o.dayKey || todayKey();
  const mk = loanMonthKey(today);
  const duty = loanDueNow(kid, today);

  if (duty.reason === 'cleared') return { status: 'cleared', paid: 0, shortfall: 0 };
  if (duty.reason === 'not-started') return { status: 'not-started', paid: 0, shortfall: 0 };
  if (l.lastPaymentMonth === mk && !o.force) {
    return { status: 'already-this-month', paid: 0, shortfall: 0, kind: duty.kind };
  }
  const due = money2(duty.amount);
  const kind = duty.kind;
  if (!(due > 0)) return { status: 'nothing-due', paid: 0, shortfall: 0 };

  const settle = (res) => { l.lastPaymentMonth = mk; saveAll(); return Object.assign({ kind }, res); };
  const w = ensureWallet(kid);

  if (w.cash >= due) {
    w.cash = money2(w.cash - due);
    loanRecordPayment(kid, due, kind);
    return settle({ status: 'paid', paid: due, shortfall: 0 });
  }

  const available = money2(w.cash);
  if (choice === 'cover_from_savings') {
    const need = money2(due - available);
    const fromSavings = Math.min(need, w.savings);
    if (money2(available + fromSavings) < due) {
      // Savings can't close the gap either — fall back to paying what exists.
      choice = 'pay_available';
    } else {
      w.savings = money2(w.savings - fromSavings);
      w.cash = money2(w.cash + fromSavings);
      w.cash = money2(w.cash - due);
      loanRecordPayment(kid, due, kind);
      return settle({ status: 'covered-from-savings', paid: due, shortfall: 0, fromSavings });
    }
  }

  if (choice === 'pay_nothing') {
    l.arrears = money2(l.arrears + due);
    return settle({ status: 'deferred', paid: 0, shortfall: due });
  }

  // pay_available (also the fallback)
  w.cash = money2(w.cash - available);
  if (available > 0) loanRecordPayment(kid, available, kind);
  const shortfall = money2(due - available);
  l.arrears = money2(l.arrears + shortfall);
  return settle({ status: 'partial', paid: available, shortfall });
}

/* Pay extra, any amount — this is the one that earns the 10%.

   This is also the "loan-surplus choice" the honesty ladder withdraws at step
   3, so a strike on record this week closes it. */
async function loanPayExtraPrompt(kid) {
  if (typeof mrLosesChoices === 'function' && mrLosesChoices(kid)) {
    showToast('Loan choices are paused this week ⚖️ — decided together on Sunday');
    return;
  }
  const w = ensureWallet(kid);
  const bonus = Number(loanRules().earlyPaymentBonusPct) || 0;
  const v = await showPrompt(
    `Pay extra off the loan 🎿\nAnything you pay early earns ${bonus}% — $100 clears $${(100 * (1 + bonus / 100)).toFixed(0)}.\nHow much? (you have $${w.cash.toFixed(2)})`,
    { value: '', type: 'number' });
  if (v == null || v === '') return;
  const amt = money2(Math.min(parseFloat(v) || 0, w.cash));
  if (!(amt > 0)) { showToast('Enter an amount like 20'); return; }
  w.cash = money2(w.cash - amt);
  const rec = loanRecordPayment(kid, amt, 'early');
  showToast(`🎿 Paid $${amt.toFixed(2)} — cleared $${(rec ? rec.credited : amt).toFixed(2)} with the ${bonus}% bonus`);
  if (typeof renderPocketScreen === 'function') renderPocketScreen();
}

/* Are they on pace? Compares what's been paid against what the schedule says
   should have been by now, so "behind" is a fact rather than a feeling. */
function loanPacing(kid) {
  const r = loanRules();
  const l = loanState(kid);
  const due = r.downPaymentDue;
  const principal = loanPrincipal(kid);
  if (!principal || !due) return null;
  const today = todayKey();
  let expected = 0;
  if (today >= due) {
    expected = loanDownPayment(kid);
    const start = formatDayKey(due), now = formatDayKey(today);
    const months = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
    expected = money2(Math.min(principal, expected + months * loanMonthly(kid)));
  }
  const diff = money2(l.paid - expected);
  return { expected, paid: money2(l.paid), diff,
           status: diff >= 0 ? 'on-pace' : 'behind', behindBy: money2(Math.max(0, -diff)) };
}
