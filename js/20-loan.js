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
  if (l.lastTransferWeek == null) l.lastTransferWeek = null;
  return l;
}

function loanPrincipal(kid) { return Number((loanRules().principal || {})[kid]) || 0; }
function loanMonthly(kid)   { return Number((loanRules().monthly   || {})[kid]) || 0; }
function loanDownPayment(kid) { return Number((loanRules().downPayment || {})[kid]) || 0; }

/* What's still owed: principal not yet cleared, plus any interest charged. */
function loanBalance(kid) {
  const l = loanState(kid);
  return money2(Math.max(0, loanPrincipal(kid) - l.paid) + l.arrearsInterest);
}
function loanIsCleared(kid) { return loanBalance(kid) <= 0; }

/* Record a payment.

   kind 'scheduled' — the monthly minimum. Clears exactly what's paid.
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

  const rec = { id: mrNewId('lp-'), at: Date.now(), amount: money2(amount), kind: kind || 'scheduled',
                bonusPct, credited: applied, toInterest: money2(toInterest) };
  l.payments.push(rec);
  saveAll();
  return rec;
}

/* One month of simple interest on the overdue principal. Charged against a
   separate bucket so it never compounds. */
function loanAccrueArrears(kid) {
  const l = loanState(kid);
  if (!(l.arrears > 0)) return 0;
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

   Returns a description of what happened for the meeting recap. */
function loanSundayTransfer(kid, choice) {
  const l = loanState(kid);
  const due = loanMonthly(kid);
  if (loanIsCleared(kid)) return { status: 'cleared', paid: 0, shortfall: 0 };
  if (!(due > 0)) return { status: 'nothing-due', paid: 0, shortfall: 0 };

  const w = ensureWallet(kid);
  if (w.cash >= due) {
    w.cash = money2(w.cash - due);
    loanRecordPayment(kid, due, 'scheduled');
    return { status: 'paid', paid: due, shortfall: 0 };
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
      loanRecordPayment(kid, due, 'scheduled');
      return { status: 'covered-from-savings', paid: due, shortfall: 0, fromSavings };
    }
  }

  if (choice === 'pay_nothing') {
    l.arrears = money2(l.arrears + due);
    saveAll();
    return { status: 'deferred', paid: 0, shortfall: due };
  }

  // pay_available (also the fallback)
  w.cash = money2(w.cash - available);
  if (available > 0) loanRecordPayment(kid, available, 'scheduled');
  const shortfall = money2(due - available);
  l.arrears = money2(l.arrears + shortfall);
  saveAll();
  return { status: 'partial', paid: available, shortfall };
}

/* Pay extra, any amount — this is the one that earns the 10%. */
async function loanPayExtraPrompt(kid) {
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
