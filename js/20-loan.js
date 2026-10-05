// Weekly-Planner — sports loan: schedule, Sunday transfer, arrears, early payment.
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   THE SPORTS LOAN

   Each kid borrows part of what her sport costs and pays it back. The terms
   are the lesson, not the money — Sunday v15's terms (owner decision D4):

     every Sunday   📌 the must-pay first: monthly × 12 ÷ 52, oldest row first
     short week     pay what there is; the rest is carried, with no interest
     interest       `loan.ratePct` a year on what is left, every N Sundays
     paid extra     each $1 counts as 1 + the row's bonus (10%)

   The old monthly schedule, its deposit and its 5%-a-month arrears charge
   are retired (Stage 4); `arrearsInterest` is the bucket interest is added to,
   settled before principal by every payment.

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
/* The bonus on extra money, frozen onto a debt when it is created. Sunday v15
   names it `loan.extraBonusPct`; a rulebook stored before that still carries
   `earlyPaymentBonusPct`, which is the same figure under its old name. */
function loanExtraBonusPct(loan) {
  const r = loan || {};
  const v = (r.extraBonusPct != null) ? r.extraBonusPct : r.earlyPaymentBonusPct;
  return Number(v) || 0;
}

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
  if (!d.createdAt) d.createdAt = syncNow();
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
      bonusRate: loanExtraBonusPct(r),
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
   ladder and every progress bar.

   Nothing owed is 100, not 0. The ladder opens pots as the debt comes down, so
   0 pinned a child with no loan at stage 0 forever — every pot shut, for want
   of a debt she never had. Callers that would say "paid off" check the
   principal themselves (the ladder card, the parent's Lessons). */
function mnyPaidPct(kid) {
  const principal = mnyTotalPrincipal(kid);
  if (!(principal > 0)) return 100;
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
    bonusRate: loanExtraBonusPct(r),
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
  d.updatedAt = syncNow();
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

/* Sunday v15 Stage 4 retired the old monthly schedule here: `loanMonthKey`,
   `loanDownOutstanding`, `loanDueNow` (the down payment, then the monthly
   figure) and `mnyDueNowAll`. A Sunday takes the must-pay below
   (`mnyDueThisWeek` / `mnyLoanSundayPayment`); a debt's `downPayment*`
   fields stay on the record for the weeks lived under them and are read by
   nothing that moves money (Plan v3 §D). */

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

/* Retired in Sunday v15 Stage 4 (Plan v3 §D, §G): the deposit prompt
   (`loanPayDownPaymentPrompt`), the monthly arrears charge (`loanAccrueArrears`,
   `mnyAccrueArrearsAll`) and the monthly transfer with its three shortfall
   choices (`loanSundayTransfer`, `mnySundayTransferAll`). A short Sunday pays
   what there is and carries the rest, with no interest on it. */

/* ════════════════════════════════════════════════════════════════
   SUNDAY v15 LOAN TERMS (Plan v3 §D, owner decision D4)

   Every Sunday the loan takes its MUST-PAY first: each debt's monthly figure
   × 12 ÷ 52, plus whatever was still owed from last week (`arrears`), capped
   at what is owed. Paid oldest debt first (`createdAt`). When there is not
   enough, she pays what there is and the rest is carried in `arrears` to
   next Sunday — with NO interest on it. Extra money pays oldest first too, and
   each $1 counts as 1 + the debt's bonus. Interest is `loan.ratePct` a year
   on what is still owed, added every `loan.interestEverySundays` Sundays.

   These are what the Sunday sign runs (`mnyDoCommit`, js/23); the old
   monthly transfer and arrears charge are retired (Stage 4).
   ════════════════════════════════════════════════════════════════ */

/* One debt's weekly must-pay, before arrears: monthly × 12 ÷ 52. */
function mnyWeeklyDue(debt) {
  return money2((Number(debt && debt.monthly) || 0) * 12 / 52);
}
/* Debts still owing something, oldest first — the order a Sunday pays them
   in. Ties (two debts created in the same instant) keep their list order. */
function mnyOpenDebtsOldestFirst(kid) {
  return mnyEnsureDebts(kid)
    .map((d, i) => ({ d, i }))
    .filter(x => loanBalance(kid, x.d.id) > 0)
    .sort((a, b) => ((Number(a.d.createdAt) || 0) - (Number(b.d.createdAt) || 0)) || (a.i - b.i))
    .map(x => x.d);
}
/* What one debt asks for this Sunday: its weekly figure plus what is still
   owed from last week, never more than the debt itself. */
function mnyDebtDueThisSunday(kid, debt) {
  return money2(Math.min(loanBalance(kid, debt.id),
    mnyWeeklyDue(debt) + money2(debt.arrears)));
}
/* What this Sunday must take before she chooses anything, across every debt —
   the red dashed line on her pile. */
function mnyMustPay(kid) {
  return money2(mnyOpenDebtsOldestFirst(kid).reduce((s, d) => s + mnyDebtDueThisSunday(kid, d), 0));
}

/* The Sunday payment: must-pay first (oldest debt first, `scheduled`, no
   bonus), then `opts.extra` dollars of extra (oldest first, `early`, with
   the bonus). Moves only cash she has. What the must-pay could not cover is
   carried in each debt's `arrears`, with no interest. Once a week: a second
   call for the same week moves nothing. Returns what happened. */
function mnyLoanSundayPayment(kid, weekKey, opts) {
  const o = opts || {};
  const wk = weekKey || ctThisWeekKey();
  const debts = mnyOpenDebtsOldestFirst(kid);
  const out = { must: 0, paid: 0, shortfall: 0, extra: 0, extraCredited: 0, each: [] };
  if (mnyEnsureDebts(kid).some(d => d.lastSundayPaidWeek === wk)) return Object.assign(out, { already: true });
  const w = ensureWallet(kid);
  /* Each row's must-pay as `mnyDueThisWeek` prices it — the one reader the
     pile, the 📌 line and this payment share — so a grown-up's agreed-down
     figure for this Sunday is what is taken, and the rest is carried. */
  const rows = mnyDueThisWeek(kid, wk);
  debts.forEach(d => {
    const row = rows.find(x => x.debtId === d.id);
    const scheduled = row ? row.scheduled : mnyDebtDueThisSunday(kid, d);
    const due = row ? row.amount : scheduled;
    const pay = money2(Math.min(due, Math.max(0, w.cash)));
    out.must = money2(out.must + due);
    if (pay > 0) {
      w.cash = money2(w.cash - pay);
      evMirror(kid, { kind: 'loan', from: 'cash', to: 'loan:' + d.id, amount: pay, ref: d.id,
                      weekKey: wk, note: (d.name || 'Loan') + ' — must pay' });
      loanRecordPayment(kid, pay, 'scheduled', d.id);
    }
    // Whatever was not paid of the schedule is still owed next Sunday — a
    // short week and an agreed-down payment alike, with no interest on it.
    d.arrears = money2(Math.max(0, scheduled - pay));
    out.paid = money2(out.paid + pay);
    out.each.push({ debtId: d.id, name: d.name, due, scheduled, paid: pay, carried: d.arrears });
  });
  out.shortfall = money2(Math.max(0, out.must - out.paid));
  const ex = mnyLoanPayExtra(kid, o.extra, wk);
  out.extra = ex.extra;
  out.extraCredited = ex.extraCredited;
  mnyEnsureDebts(kid).forEach(d => { d.lastSundayPaidWeek = wk; });
  saveAll();
  return out;
}

/* ── One Sunday's loan step — the sign's and the catch-up's ──
   A changed "loan per month" rescales her rows first (sdRescaleLoanRows,
   once per rule version), then the must-pay and `extra` (mnyLoanSundayPayment),
   then interest if this is the Nth Sunday (loanAccrueBalanceInterest). The
   Sunday sign (mnyDoCommit) and an express catch-up (mnyCatchUpLoan, js/23)
   both pay through here, so a caught-up week is never left unpaid. */
function mnySundayLoanStep(kid, weekKey, extra) {
  sdRescaleLoanRows(kid, weekKey);
  const out = mnyLoanSundayPayment(kid, weekKey, { extra: extra || 0 });
  const interest = loanAccrueBalanceInterest(kid, weekKey);
  return { out, interest };
}

/* Extra off the wall: up to `amount` of her cash, oldest debt first, each
   dollar `early` with that debt's bonus, never an overpayment. The one
   writer of extra — Sunday's payment above and a 🧱 Loan wall move she asked
   for (mnyApplyApprovedWallMoves, js/40) both pay through it. Returns
   {extra: dollars paid, extraCredited: what they cleared}. */
function mnyLoanPayExtra(kid, amount, weekKey, note) {
  const w = ensureWallet(kid);
  const out = { extra: 0, extraCredited: 0 };
  let extra = money2(Math.min(Math.max(0, Number(amount) || 0), Math.max(0, w.cash)));
  mnyOpenDebtsOldestFirst(kid).forEach(d => {
    if (!(extra > 0)) return;
    const bonus = (Number(d.bonusRate) || 0) / 100;
    const owedPrincipal = Math.max(0, money2(d.principal) - money2(d.paid));
    // Enough to clear it — interest first, then principal at the bonus rate —
    // and never a cent more, because an overpayment would leave her cash.
    const clears = money2(money2(d.arrearsInterest) + Math.ceil((owedPrincipal / (1 + bonus)) * 100) / 100);
    const pay = money2(Math.min(extra, clears));
    if (!(pay > 0)) return;
    w.cash = money2(w.cash - pay);
    evMirror(kid, { kind: 'loan', from: 'cash', to: 'loan:' + d.id, amount: pay, ref: d.id,
                    weekKey: weekKey || ctThisWeekKey(), note: note || ('Extra off ' + (d.name || 'her loan')) });
    const rec = loanRecordPayment(kid, pay, 'early', d.id);
    extra = money2(extra - pay);
    out.extra = money2(out.extra + pay);
    out.extraCredited = money2(out.extraCredited + money2(((rec && rec.credited) || 0) + ((rec && rec.toInterest) || 0)));
  });
  saveAll();
  return out;
}

/* ── 🧱 THE WALL'S KEY FACTS (Plan v5 §L M5 / G2) — read only ──
   Per debt and in total: what was borrowed, paid, left; the weekly must-pay;
   when it is free at that pace; the early bonus earned; the cost of
   borrowing so far (interest added — the `interest → loan:<id>` stream lines
   `loanAccrueBalanceInterest` writes, net of any reversal) and the last
   interest added; and LATE COSTS — what the retired monthly arrears charge
   put on the debt, i.e. everything charged into `arrearsInterest` (what is
   there now plus what payments already settled) that was not balance
   interest. Nothing here is stored; every figure is derived. */
function mnyLoanFacts(kid) {
  const events = (typeof evList === 'function') ? evList(kid) : [];
  const rows = mnyEnsureDebts(kid).map(d => {
    const node = 'loan:' + d.id;
    const interestAdded = money2(Math.max(0, events.reduce((s, e) => {
      if (!e) return s;
      if (e.from === 'interest' && e.to === node) return s + money2(e.amount);
      if (e.from === node && e.to === 'interest') return s - money2(e.amount);
      return s;
    }, 0)));
    const charged = money2(money2(d.arrearsInterest)
      + (d.payments || []).reduce((t, p) => t + money2(p.toInterest), 0));
    const principal = money2(d.principal);
    const left = loanBalance(kid, d.id);
    return {
      debt: d, id: d.id, name: d.name, icon: d.icon, principal,
      paid: money2(d.paid), left, weekly: left > 0 ? mnyWeeklyDue(d) : 0,
      monthly: money2(d.monthly),
      bonus: mnyBonusEarned(kid, d.id),
      interestAdded, lastInterest: money2(d.lastInterestAdded),
      lateCosts: money2(Math.max(0, charged - interestAdded)),
      paidPct: principal > 0 ? Math.max(0, Math.min(100, (money2(d.paid) / principal) * 100)) : 100,
      createdAt: Number(d.createdAt) || 0,
    };
  });
  const sum = (k) => money2(rows.reduce((s, r) => s + money2(r[k]), 0));
  const left = sum('left');
  const weekly = sum('weekly');
  const weeksLeft = (left > 0 && weekly > 0) ? Math.ceil(left / weekly) : (left > 0 ? null : 0);
  let freeBy = null;
  if (weeksLeft != null) {
    const d = formatDayKey(sdSundayOf(ctThisWeekKey()));
    d.setDate(d.getDate() + weeksLeft * 7);
    freeBy = ctDateToKey(d);
  }
  const rate = Number(mrRuleOr(mrRules(), 'loan.ratePct')) || 0;
  return {
    rows: rows.slice().sort((a, b) => (a.createdAt - b.createdAt)),
    principal: sum('principal'), paid: sum('paid'), left, weekly,
    monthly: money2(rows.filter(r => r.left > 0).reduce((s, r) => s + r.monthly, 0)),
    bonus: sum('bonus'), interestAdded: sum('interestAdded'), lateCosts: sum('lateCosts'),
    lastInterest: sum('lastInterest'), ratePct: rate,
    paidPct: mnyPaidPct(kid), weeksLeft, freeBy,
  };
}

/* Interest every N Sundays (`loan.interestEverySundays`, at
   `loan.ratePct` a year), counted per debt in `sundaysSinceInterest` and
   stamped with the week so a second call for the same Sunday does nothing.
   On the WHOLE balance left — interest already added included — as the
   prototype draws it (`left * rate / 100 * 4 / 52`, then `left += int`), the
   same answer as `sdLoanInterest` (js/43). The old loan's `simpleInterest`
   rule belonged to the retired arrears charge, not to these terms. Into the
   `arrearsInterest` bucket the loan already shows. The stream gets a line from `interest` to the debt: no home moves —
   she has not paid it — but the row says the wall grew and why. Returns the
   interest added across every debt. */
function loanAccrueBalanceInterest(kid, weekKey) {
  const wk = weekKey || ctThisWeekKey();
  const rules = mrRulesForWeek(wk);
  const ratePct = Number(mrRuleOr(rules, 'loan.ratePct')) || 0;
  const every = Math.max(1, Number(mrRuleOr(rules, 'loan.interestEverySundays')) || 1);
  let total = 0;
  mnyEnsureDebts(kid).forEach(d => {
    if (d.lastInterestSunday === wk) return;
    d.lastInterestSunday = wk;
    if (!(loanBalance(kid, d.id) > 0)) { d.sundaysSinceInterest = 0; return; }
    d.sundaysSinceInterest = (Number(d.sundaysSinceInterest) || 0) + 1;
    if (d.sundaysSinceInterest < every) return;
    d.sundaysSinceInterest = 0;
    const interest = money2(loanBalance(kid, d.id) * ratePct / 100 * every / 52);
    if (!(interest > 0)) return;
    d.arrearsInterest = money2(money2(d.arrearsInterest) + interest);
    d.lastInterestAdded = interest;
    evMirror(kid, { kind: 'interest', from: 'interest', to: 'loan:' + d.id, amount: interest,
                    ref: d.id, weekKey: wk, note: 'Interest added to ' + (d.name || 'her loan') });
    total = money2(total + interest);
  });
  saveAll();
  return total;
}

/* ════════════════════════════════════════════════════════════════
   GROWN-UPS › ➕ COMMITMENTS (Plan v3 §D) — a new row on her wall

   🆕 A commitment: she pays `sharePct` of what it costs. 10% of her share
   goes down at once, out of her 🏦 Savings (Savings → cash → the new row, as
   a `down` payment, two recorded movements); the rest is the new row, paid
   over `weeks` Sundays — written as the row's own monthly figure
   (rest ÷ weeks × 52 ÷ 12), so `mnyWeeklyDue` gives back rest ÷ weeks.
   🌧️ A surprise cost: nobody did anything wrong. Her Savings pays first
   (Savings → cash → spent); whatever Savings cannot cover becomes a row with
   no weekly figure, paid by extra. Each through the owners that already move
   that money; each new row is `mnyAddDebt`'s. Returns the new row (or, for a
   surprise Savings covered, `{ covered: true }`), null when refused.
   ════════════════════════════════════════════════════════════════ */
function mnyAddCommitment(kid, fields) {
  if (!isParent()) { showToast('Only parents can add a loan 🔒'); return null; }
  const f = fields || {};
  const what = String(f.what || '').trim().slice(0, 40);
  const cost = money2(Math.max(0, Number(f.cost) || 0));
  const share = Math.max(0, Math.min(100, Number(f.sharePct) || 0));
  const weeks = Math.max(1, Math.round(Number(f.weeks) || 1));
  if (!what) { showToast('What is it for?'); return null; }
  const her = money2(cost * share / 100);
  if (!(her > 0)) { showToast('Her share has to be more than $0'); return null; }
  const down = Math.round(her * 10) / 100;                 // 10% of her share, to the cent
  const rest = money2(her - down);
  const d = mnyAddDebt(kid, { name: what, icon: '🆕', item: what, principal: her,
    monthly: money2(rest / weeks * 52 / 12), downPayment: 0, downPaymentDue: '' });
  if (!d) return null;
  /* The 10% down, out of Savings: what Savings cannot cover stays on the row
     — the affordability card has already said so ("⚠️ under 🛟"). */
  const fromSavings = money2(Math.min(down, mnySavedTotal(kid)));
  if (fromSavings > 0) {
    const w = ensureWallet(kid);
    const before = money2(w.cash);
    moneyWithdraw(kid, fromSavings, { note: 'Down payment on ' + what });
    const pay = money2(Math.min(fromSavings, money2(w.cash - before), w.cash));
    if (pay > 0) {
      w.cash = money2(w.cash - pay);
      evMirror(kid, { kind: 'loan', from: 'cash', to: 'loan:' + d.id, amount: pay, ref: d.id,
                      note: '10% down on ' + what });
      loanRecordPayment(kid, pay, 'down', d.id);
    }
  }
  saveAll();
  return d;
}
function mnyAddSurprise(kid, fields) {
  if (!isParent()) { showToast('Only parents can add a loan 🔒'); return null; }
  const f = fields || {};
  const what = String(f.what || '').trim().slice(0, 40);
  const cost = money2(Math.max(0, Number(f.cost) || 0));
  if (!what) { showToast('What happened?'); return null; }
  if (!(cost > 0)) { showToast('What did it cost?'); return null; }
  const fromSafe = money2(Math.min(cost, mnySavedTotal(kid)));
  let paid = 0;
  if (fromSafe > 0) {
    const w = ensureWallet(kid);
    const before = money2(w.cash);
    moneyWithdraw(kid, fromSafe, { note: '🌧️ ' + what });
    paid = money2(Math.min(fromSafe, money2(w.cash - before)));
    if (paid > 0) moneySpendCash(kid, paid, { note: '🌧️ ' + what });
  }
  const borrow = money2(cost - paid);
  if (!(borrow > 0)) { saveAll(); return { covered: true, paid }; }
  return mnyAddDebt(kid, { name: what, icon: '🌧️', item: what, principal: borrow,
    monthly: 0, downPayment: 0, downPaymentDue: '' });
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
  evMirror(kid, { kind: 'loan', from: 'cash', to: 'loan:' + d.id, amount: amt,
                  ref: d.id, note: 'Extra off ' + (d.name || 'her loan') });
  const rec = loanRecordPayment(kid, amt, 'early', d.id);
  showToast(`${d.icon} Paid $${amt.toFixed(2)} — cleared $${(rec ? rec.credited : amt).toFixed(2)} with the ${bonus}% bonus`);
  if (typeof mnyRerenderMoney === 'function') mnyRerenderMoney();
}

/* Are they on pace? What has been paid against what the weekly must-pay
   says should have been by now, counted in Sundays since the row was taken
   on (Sunday v15 terms — the old deposit-then-monthly schedule is retired),
   so "behind" is a fact rather than a feeling. */
function loanPacing(kid, debtId) {
  const l = loanState(kid, debtId);
  const principal = money2(l.principal);
  const since = Number(l.createdAt) || 0;
  if (!principal || !since) return null;
  const weeks = Math.max(0, Math.floor((Date.now() - since) / (7 * 864e5)));
  const expected = money2(Math.min(principal, weeks * mnyWeeklyDue(l)));
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
