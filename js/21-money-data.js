// Weekly-Planner — pocket money: constants, holdings, deposits, plans, charts.
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   THE POCKET MONEY SYSTEM — shared data layer

   Five surfaces sit on top of this file:

     1 💰 My money           kid, every day        js/22-money-page1.js
     2 💪 What I earned      the Sunday meeting    js/23-money-meeting.js
     3 🤝 What I do with it  the Sunday meeting    js/23-money-meeting.js
     4 ⚙️ Money rules        the parent portal     js/24-money-parent.js
     5 🎓 Money school       kid, when she likes   js/25-money-school.js

   Nothing here renders. It answers the questions those five pages ask:
   what came in, what has to go out, what is hers to choose, what she owns,
   and what any of it would be worth a year from now.

   Two rules this file exists to keep:

   1. THE ENGINES OWN THE NUMBERS. Earnings come from mrWeekBreakdown
      (js/18-rules.js), debts from js/20-loan.js, cash from the wallet. Nothing
      is re-derived here with a second formula — a second formula is how two
      screens end up disagreeing about the same dollar.

   2. CONFIRM IS NOT COMMIT. Page 2's confirm records that the family agrees
      the week is right. No money moves until page 3's commit. That is what
      lets an edit simply reopen the week instead of having to be unwound.
   ════════════════════════════════════════════════════════════════ */

/* ── Money school: what opens when ──
   Keyed to the share of everything she owes that has been paid off, so the
   lessons arrive as the debt comes down rather than on a calendar. */
const MNY_STAGES = [
  { pct: 0,   icon: '🎿', title: 'What I owe, and what I keep' },
  { pct: 30,  icon: '💵', title: 'Keeping money ready' },
  { pct: 60,  icon: '🔒', title: 'Locking money away' },
  { pct: 90,  icon: '📈', title: 'Trying it with stocks' },
  { pct: 100, icon: '🧩', title: 'Building my own mix' },
];

/* Where money can go on a Sunday. `need` is the stage that opens it.
   `loan` is special: there is one row per debt, built at render time. */
const MNY_BUCKETS = [
  { key: 'loan',  icon: '🎿', label: 'Pay off',        need: 0,  tint: '#eaf6ef' },
  { key: 'ready', icon: '💵', label: 'Keep it ready',  need: 30, tint: '#fff9e9' },
  { key: 'gic',   icon: '🔒', label: 'Lock it away for a year', need: 60, tint: '#eef3fb' },
  { key: 'stock', icon: '📈', label: 'Buy a bit of a company',  need: 90, tint: '#f6effa' },
];

/* The ready-made plans. Fractions of what is hers to choose. */
const MNY_PLANS = [
  { id: 'debt',     icon: '🎿', label: 'Pay off my loan first', need: 0,   split: { loan: 1 } },
  { id: 'ready',    icon: '💵', label: 'Keep some ready',       need: 30,  split: { loan: 0.4, ready: 0.6 } },
  { id: 'balanced', icon: '⚖️', label: 'A bit of everything',   need: 60,  split: { loan: 0.4, ready: 0.3, gic: 0.3 } },
  { id: 'grow',     icon: '📈', label: 'Grow it more',          need: 90,  split: { loan: 0.3, ready: 0.1, gic: 0.2, stock: 0.4 } },
  { id: 'last',     icon: '🔁', label: 'Same as last week',     need: 0,   split: null },
  { id: 'own',      icon: '🧩', label: "I'll choose every number myself", need: 100, split: null, own: true },
];

/* Investing is a fixed menu — no typing in a ticker. A nine-year-old picking a
   company by name is the lesson; a search box is a casino. */
const MNY_FUNDS = [
  { id: 'index',  label: 'A little bit of lots of companies', ticker: null },
  { id: 'bond',   label: 'Lending money to big companies',    ticker: null },
  { id: 'SU',     label: 'One company you pick — Suncor',     ticker: 'SU' },
  { id: 'AAPL',   label: 'One company you pick — Apple',      ticker: 'AAPL' },
  { id: 'COST',   label: 'One company you pick — Costco',     ticker: 'COST' },
  { id: 'TSLA',   label: 'One company you pick — Tesla',      ticker: 'TSLA' },
];

/* Where money from outside came FROM. Not where it goes — a gift carries no
   destination. It joins the pool like every other dollar and gets decided on
   page 3 with the rest. */
const MNY_FROM = ['Birthday money', 'A gift', 'Grandma & Grandpa', 'Sold something', 'Found a job'];
const MNY_DEPOSIT_CHIPS = [20, 50, 100, 200];

/* Why a number was changed at the meeting. Chips only — a free-text box turns
   into "because" and stops being a record of anything. */
const MNY_REASONS = [
  { id: 'planner_missed', label: 'The planner missed it' },
  { id: 'graded_wrong',   label: 'Graded wrong' },
  { id: 'agreed',         label: 'Agreed exception' },
  { id: 'fixing',         label: 'Fixing a mistake' },
];
function mnyReasonLabel(id) {
  const r = MNY_REASONS.find(x => x.id === id);
  return r ? r.label : (id || '—');
}

/* One question, every week. Three answers, so it gets answered. */
const MNY_REFLECT = {
  question: 'What is this money for?',
  chips: [
    { id: 'sooner',  label: 'Getting my loan gone sooner' },
    { id: 'saving',  label: 'Saving for something big' },
    { id: 'growing', label: 'Learning how money grows' },
  ],
};

/* What the parent should have in front of them before the meeting starts. */
const MNY_CHECKS = [
  { id: 'c1', label: 'Chores graded for all six days' },
  { id: 'c2', label: 'Learning pages counted' },
  { id: 'c3', label: 'Streak days agreed' },
  { id: 'c4', label: 'Anything boxed this week talked about' },
  { id: 'c5', label: 'Competition results sheet in hand' },
  { id: 'c6', label: 'Money from outside written down' },
  { id: 'c7', label: 'Any price change saved with a reason' },
];

const MNY_UNPAID = [
  'Your routines, morning and night',
  'Making your bed and tidying your room',
  'Packing your school bag and your sports gear',
  'The first two household chores each week',
  'Being kind to your sister',
];
const MNY_PAID = [
  'Household chores after your first two',
  'Math pages, handwriting pages, Chinese words',
  'A full week of clean routine days',
  'Competition days',
];

/* The eight ideas Money school teaches, in the order they open. `need` is the
   stage; the debt card names the real debt at render time. */
const MNY_CONCEPTS = [
  /* {debt} is filled in with the real name from her debt record, so this reads
     as being about her week rather than about money in general. */
  { id: 'debt', icon: '🎿', title: 'Owing money', need: 0,
    what: 'We paid for {debt} up front, and you pay us back a bit at a time.',
    why: 'You got it straight away instead of waiting years to save up for it.',
    risk: 'Until {debt} is paid off, part of every week is already spoken for.' },
  { id: 'cash', icon: '💵', title: 'Cash', need: 0,
    what: 'Money you can use today, sitting in your wallet.',
    why: 'It is ready the moment you need it.',
    risk: 'It does not grow at all while it sits there.' },
  { id: 'extra', icon: '⚡', title: 'Paying early', need: 0,
    what: 'Paying more off {debt} than you have to, before it is due.',
    why: 'You earn a bonus for it, and {debt} is gone sooner.',
    risk: 'That money has gone into {debt} — you cannot get it back out.',
    whyLabel: 'The good side', riskLabel: 'The other side' },
  { id: 'ready', icon: '🏦', title: 'Keeping money ready', need: 30,
    what: 'Money set aside that you can still get back whenever you want.',
    why: 'When something goes wrong, you are not stuck.',
    risk: 'It grows very slowly — a little bit each year.' },
  { id: 'save', icon: '💰', title: 'Interest', need: 30,
    what: 'The bank pays you a small amount each year for keeping money there.',
    why: 'Money you leave alone quietly makes a bit more money.',
    risk: 'It is small. It will not make you rich on its own.' },
  { id: 'gic', icon: '🔒', title: 'Locking money away for a year', need: 60,
    what: 'You promise not to touch it for a year, and the bank pays you more.',
    why: 'More than just keeping it ready, and the amount is promised.',
    risk: 'You really cannot touch it. Not even if you change your mind.' },
  { id: 'stock', icon: '📈', title: 'Owning a bit of a company', need: 90,
    what: 'You buy a small piece of a real company.',
    why: 'If the company does well, your piece is worth more.',
    risk: 'It can go down too. In 2023 one of these fell by a third in six months.' },
  { id: 'mix', icon: '🧩', title: 'Not putting it all in one place', need: 100,
    what: 'Splitting your money so it is not all doing the same job.',
    why: 'If one part has a bad year, the others carry you.',
    risk: 'You will never make as much as if you had guessed right and put it all in one.' },
];
function mnyConceptById(id) { return MNY_CONCEPTS.find(c => c.id === id) || null; }
/* The `?` on any bucket, tile or row → the idea behind it. */
const MNY_ASK = { loan: 'debt', ready: 'ready', gic: 'gic', stock: 'stock', cash: 'cash', extra: 'extra', save: 'save' };

/* ════════════════════════════════════════════════════════════════
   WHAT SHE OWNS

   One record per holding, in a brokerage's shape: how many units, what they
   are worth now, what they cost, what rate they pay. There is no market
   simulation — a parent types the price in on the Money rules page, which is
   also the honest version, because that is exactly what happens in real life.
   Cash stays in the wallet; everything else lives here.
   ════════════════════════════════════════════════════════════════ */
const MNY_HOLDING_KINDS = [
  { id: 'savings', icon: '🏦', label: 'Money kept ready' },
  { id: 'gic',     icon: '🔒', label: 'Locked away' },
  { id: 'stock',   icon: '📈', label: 'A bit of a company' },
];

/* What the blended funds earn a year when nobody is picking companies. Real
   long-run-ish numbers, kept as defaults a parent can edit per holding. */
const MNY_FUND_RATES = { index: 0.07, bond: 0.03 };

function mnyNormalizeHolding(h) {
  if (!h || typeof h !== 'object') return null;
  if (!h.id) h.id = mrNewId('hold-');
  if (!h.kind) h.kind = 'savings';
  if (!h.name) h.name = (MNY_HOLDING_KINDS.find(k => k.id === h.kind) || {}).label || 'Savings';
  if (h.units == null) h.units = 1;
  h.priceNow = money2(h.priceNow);
  h.costBasis = money2(h.costBasis);
  if (h.rateAnnual == null) h.rateAnnual = 0;      // 0.015 = 1.5% a year
  if (!h.openedOn) h.openedOn = todayKey();
  if (h.maturesOn == null) h.maturesOn = '';
  // The last day this holding's growth was worked out, and what it was worth at
  // the last settled Sunday. Both drive the simulation below.
  if (!h.lastAccruedOn) h.lastAccruedOn = h.openedOn || todayKey();
  if (h.valueAtLastMeeting == null) h.valueAtLastMeeting = money2(h.units * h.priceNow);
  if (!h.createdAt) h.createdAt = Date.now();
  return h;
}

/* ════════════════════════════════════════════════════════════════
   THE SIMULATION — on real calendar time

   Money does not wait for a family meeting. Interest accrues on the days that
   actually passed, a locked deposit matures on its real date, and a share is
   worth whatever the market says this month. Tying any of that to "one meeting
   = one month" made the world move only when a grown-up remembered to open a
   screen, which is exactly the wrong lesson.

   `mnySimCatchUp` is lazy and idempotent: every money surface calls it on
   render and the commit calls it before it settles anything, and running it
   twice in one day does nothing the second time. That is what lets the app be
   closed for three weeks and still be right when it opens.
   ════════════════════════════════════════════════════════════════ */

/* Whole days between two dayKeys, never negative. */
function mnyDaysBetween(fromKey, toKey) {
  const a = formatDayKey(fromKey), b = formatDayKey(toKey);
  return Math.max(0, Math.round((b - a) / 86400000));
}
/* Which column of a 12-month price series a real calendar month lands on.
   The data is one real year; after twelve months it cycles, which is honest
   enough for a teaching model and never leaves a price undefined. */
function mnyPriceForMonth(ticker, dayKey) {
  const series = (STOCKS_2023[ticker] || {}).prices;
  if (!series) return null;
  const d = formatDayKey(dayKey || todayKey());
  return series[((d.getMonth() % series.length) + series.length) % series.length];
}

function mnySimCatchUp(kid, opts) {
  const o = opts || {};
  const today = o.dayKey || todayKey();
  const w = ensureWallet(kid);
  let interest = 0, moved = false;
  const matured = [];

  mnyEnsureHoldings(kid).slice().forEach(h => {
    const days = mnyDaysBetween(h.lastAccruedOn, today);

    // Anything locked away pays out on its date — principal plus the interest
    // it was promised for the term. It is the one holding that ends by itself.
    if (h.kind === 'gic' && h.maturesOn && String(h.maturesOn) <= String(today)) {
      const value = mnyHoldingValue(h);
      const term = (Number(h.termMonths) || 12) / 12;
      const payout = money2(value * (1 + (Number(h.rateAnnual) || 0) * term));
      w.cash = money2(w.cash + payout);
      matured.push({ id: h.id, name: h.name, amount: value, payout });
      mnyRemoveHolding(kid, h.id);
      moved = true;
      return;
    }
    if (!days) return;

    if (h.kind === 'savings' || (h.kind === 'stock' && !h.ticker)) {
      // Kept-ready money and the blended funds grow smoothly: simple interest
      // for the days that actually passed. No compounding — it is both gentler
      // and easier to explain than interest on interest.
      const rate = (h.rateAnnual != null) ? Number(h.rateAnnual)
                 : (MNY_FUND_RATES[h.fundId] || 0);
      const add = money2(mnyHoldingValue(h) * rate * (days / 365));
      if (add > 0) {
        h.units = 1;
        h.priceNow = money2(mnyHoldingValue(h) + add);
        interest = money2(interest + add);
        moved = true;
      }
    } else if (h.kind === 'stock' && h.ticker) {
      // A real company's price for this calendar month. It goes down as often
      // as it goes up, which is the entire point of holding one.
      const price = mnyPriceForMonth(h.ticker, today);
      if (price != null && money2(price) !== money2(h.priceNow)) {
        h.priceNow = money2(price);
        moved = true;
      }
    }
    h.lastAccruedOn = today;
    h.updatedAt = Date.now();
  });

  if (moved) saveAll();
  return { interest, matured };
}

/* What her money made on its own since the last settled Sunday — interest
   credited plus any change in what her companies are worth. This is real
   income, it just was not earned by working, and a week's bar that leaves it
   out does not add up. */
function mnyPassiveSinceLastMeeting(kid) {
  mnySimCatchUp(kid);
  return money2(mnyEnsureHoldings(kid)
    .reduce((s, h) => s + (mnyHoldingValue(h) - money2(h.valueAtLastMeeting)), 0));
}
/* Called once the week is settled: this Sunday becomes the new baseline. */
function mnyStampPassiveBaseline(kid) {
  mnyEnsureHoldings(kid).forEach(h => { h.valueAtLastMeeting = mnyHoldingValue(h); });
  saveAll();
}

/* Lazy-init + one-time migration off the old wallet, mirroring bankConfig().
   `wallet.savings`, every GIC and every stock ticker becomes a record; the
   wallet keeps only cash. Migrating drops nothing — a lost holding is money
   the kid earned and can no longer see. */
function mnyEnsureHoldings(kid) {
  const p = getProfData(kid);
  if (Array.isArray(p.holdings)) { p.holdings.forEach(mnyNormalizeHolding); return p.holdings; }
  p.holdings = [];
  const w = (p.wallet && typeof p.wallet === 'object') ? p.wallet : {};
  const cfg = (typeof bankConfig === 'function') ? bankConfig() : { savingsRate: 0.015, gicRates: {} };
  if (money2(w.savings) > 0) {
    p.holdings.push(mnyNormalizeHolding({
      id: 'save-' + kid, kind: 'savings', name: 'Money kept ready',
      units: 1, priceNow: money2(w.savings), costBasis: money2(w.savings),
      rateAnnual: Number(cfg.savingsRate) || 0,
    }));
  }
  (Array.isArray(w.gics) ? w.gics : []).forEach(g => {
    p.holdings.push(mnyNormalizeHolding({
      id: g.id || mrNewId('hold-'), kind: 'gic', name: 'Locked away for a year',
      units: 1, priceNow: money2(g.amount), costBasis: money2(g.amount),
      rateAnnual: Number(g.rate) || 0, maturesOn: g.maturesOn || '',
    }));
  });
  Object.keys((w.holdings && typeof w.holdings === 'object') ? w.holdings : {}).forEach(t => {
    const units = Number(w.holdings[t]) || 0;
    if (!(units > 0)) return;
    const price = (typeof stockPrice === 'function' && STOCKS_2023[t]) ? stockPrice(t) : 0;
    p.holdings.push(mnyNormalizeHolding({
      kind: 'stock', name: (STOCKS_2023[t] || {}).name || t, ticker: t,
      units, priceNow: money2(price), costBasis: money2(units * price),
    }));
  });
  // Empty the old wallet buckets once they have been carried across, so a
  // legacy reader can never count the same dollar twice. Cash stays.
  if (p.wallet) { p.wallet.savings = 0; p.wallet.gics = []; p.wallet.holdings = {}; }
  return p.holdings;
}

function mnyHoldings(kid) { return mnyEnsureHoldings(kid); }
function mnyHoldingsOfKind(kid, kind) { return mnyEnsureHoldings(kid).filter(h => h.kind === kind); }
function mnyHoldingValue(h) { return money2((Number(h.units) || 0) * money2(h.priceNow)); }
function mnyKindTotal(kid, kind) {
  return money2(mnyHoldingsOfKind(kid, kind).reduce((s, h) => s + mnyHoldingValue(h), 0));
}
function mnySavedTotal(kid) { return mnyKindTotal(kid, 'savings'); }
function mnyLockedTotal(kid) { return mnyKindTotal(kid, 'gic'); }
function mnyInvestedTotal(kid) { return mnyKindTotal(kid, 'stock'); }
function mnyCash(kid) { return money2(ensureWallet(kid).cash); }
/* Everything she has, in one number. */
function mnyEverything(kid) {
  return money2(mnyCash(kid) + mnySavedTotal(kid) + mnyLockedTotal(kid) + mnyInvestedTotal(kid));
}

function mnyAddHolding(kid, fields) {
  const h = mnyNormalizeHolding(Object.assign({ kind: 'savings', units: 1 }, fields || {}));
  mnyEnsureHoldings(kid).push(h);
  saveAll();
  return h;
}
function mnyEditHolding(kid, holdingId, field, value) {
  const h = mnyEnsureHoldings(kid).find(x => x.id === holdingId);
  if (!h) return false;
  const num = ['units', 'priceNow', 'costBasis', 'rateAnnual'];
  h[field] = num.includes(field) ? Math.max(0, Number(value) || 0) : value;
  h.updatedAt = Date.now();
  saveAll();
  return true;
}
function mnyRemoveHolding(kid, holdingId) {
  const list = mnyEnsureHoldings(kid);
  const i = list.findIndex(h => h.id === holdingId);
  if (i < 0) return false;
  const [gone] = list.splice(i, 1);
  ensureTombstones()['hold:' + gone.id] = Date.now();
  saveAll();
  return true;
}

/* Move money in and out of "kept ready". Used by the plan commit and by the
   loan's cover-from-savings choice, so both go through one path. */
function mnyAddToSaved(kid, amount) {
  const amt = money2(amount);
  if (!(amt > 0)) return false;
  const existing = mnyHoldingsOfKind(kid, 'savings')[0];
  if (existing) {
    existing.units = 1;
    existing.priceNow = money2(mnyHoldingValue(existing) + amt);
    existing.costBasis = money2(money2(existing.costBasis) + amt);
    existing.updatedAt = Date.now();
  } else {
    const cfg = bankConfig();
    mnyAddHolding(kid, { id: 'save-' + kid, kind: 'savings', name: 'Money kept ready',
                         units: 1, priceNow: amt, costBasis: amt, rateAnnual: Number(cfg.savingsRate) || 0 });
  }
  saveAll();
  return true;
}
function mnyTakeFromSaved(kid, amount) {
  let left = money2(amount);
  if (!(left > 0)) return 0;
  let took = 0;
  mnyHoldingsOfKind(kid, 'savings').forEach(h => {
    if (!(left > 0)) return;
    const have = mnyHoldingValue(h);
    const take = money2(Math.min(have, left));
    if (!(take > 0)) return;
    h.units = 1;
    h.priceNow = money2(have - take);
    h.costBasis = money2(Math.max(0, money2(h.costBasis) - take));
    h.updatedAt = Date.now();
    left = money2(left - take);
    took = money2(took + take);
  });
  saveAll();
  return took;
}

/* What each holding has made, and what it would make in a year. This is the
   "what my money earned" statement — the money that arrived without her
   doing any work for it. */
function mnyReturns(kid) {
  const rows = mnyEnsureHoldings(kid).map(h => {
    const value = mnyHoldingValue(h);
    const cost = money2(h.costBasis);
    const kind = MNY_HOLDING_KINDS.find(k => k.id === h.kind) || MNY_HOLDING_KINDS[0];
    return {
      id: h.id, kind: h.kind, icon: kind.icon, name: h.name,
      value, cost, gain: money2(value - cost),
      rateAnnual: Number(h.rateAnnual) || 0,
      yearAhead: money2(value * (Number(h.rateAnnual) || 0)),
      maturesOn: h.maturesOn || '',
      // A stock is only worth what it sells for, and it has not been sold.
      onPaper: h.kind === 'stock',
    };
  });
  const gain = money2(rows.reduce((s, r) => s + r.gain, 0));
  const yearAhead = money2(rows.reduce((s, r) => s + r.yearAhead, 0));
  return { rows, gain, yearAhead, total: money2(rows.reduce((s, r) => s + r.value, 0)) };
}

/* ════════════════════════════════════════════════════════════════
   SAVING GOALS

   A number in a savings account is not a reason to save. A bike is.

   Goals are the one thing in this whole system a kid creates herself — she
   names it, sets what it costs and when she wants it by, and the app works out
   what that means per week. Everything else here is decided by a grown-up or
   by a rule, and a system where a kid has no say in anything is a system she
   participates in rather than owns.

   A goal is earmarked kept-ready money, not a separate pot: the dollars are
   really in her savings and she could change her mind. What the goal adds is a
   name, a date, and an honest answer to "am I going to make it?".
   ════════════════════════════════════════════════════════════════ */
const MNY_GOAL_ICONS = ['🎯', '🚲', '🎮', '📱', '🎸', '🛼', '📚', '🧩', '🎧', '🐶', '✈️', '🎁'];
const MNY_GOAL_CHIPS = [25, 50, 100, 200];

function mnyEnsureGoals(kid) {
  const p = getProfData(kid);
  if (!Array.isArray(p.savingGoals)) p.savingGoals = [];
  return p.savingGoals;
}
function mnyGoals(kid, includeDone) {
  return mnyEnsureGoals(kid).filter(g => includeDone || !g.done);
}
function mnyGoalById(kid, id) { return mnyEnsureGoals(kid).find(g => g.id === id) || null; }

/* Kid-editable on purpose — no isParent() gate. Naming what you are saving for
   is the part that makes saving mean anything. */
function mnyAddGoal(kid, fields) {
  const g = Object.assign({
    id: mrNewId('goal-'), name: 'Something I want', icon: '🎯',
    target: 50, targetDate: '', saved: 0, done: false,
    createdAt: Date.now(), updatedAt: Date.now(),
  }, fields || {});
  g.target = money2(g.target);
  g.saved = money2(g.saved);
  if (!(g.target > 0)) return null;
  mnyEnsureGoals(kid).push(g);
  saveAll();
  return g;
}
function mnyEditGoal(kid, id, field, value) {
  const g = mnyGoalById(kid, id);
  if (!g) return false;
  g[field] = (field === 'target' || field === 'saved') ? Math.max(0, money2(value)) : value;
  g.updatedAt = Date.now();
  saveAll();
  return true;
}
function mnyRemoveGoal(kid, id) {
  const list = mnyEnsureGoals(kid);
  const i = list.findIndex(g => g.id === id);
  if (i < 0) return false;
  const [gone] = list.splice(i, 1);
  ensureTombstones()['sgoal:' + gone.id] = Date.now();
  saveAll();
  return true;
}
/* Reaching a goal is a parent moment: it is the point where the money leaves
   savings and becomes the thing. */
function mnyCompleteGoal(kid, id) {
  if (!isParent()) { showToast('Tell a grown-up — they will mark it 🎉'); return false; }
  const g = mnyGoalById(kid, id);
  if (!g || g.done) return false;
  mnyTakeFromSaved(kid, Math.min(money2(g.saved), mnySavedTotal(kid)));
  g.done = true;
  g.doneAt = Date.now();
  g.updatedAt = Date.now();
  saveAll();
  return true;
}

/* Am I going to make it? Answered in dollars per week, because "you need 34%
   more" is not something anyone can act on. */
function mnyGoalPace(kid, goal) {
  const left = money2(Math.max(0, money2(goal.target) - money2(goal.saved)));
  if (left <= 0) return { left: 0, weeksLeft: 0, neededPerWeek: 0, onPace: true, reached: true };
  let weeksLeft = null;
  if (goal.targetDate) {
    const days = mnyDaysBetween(todayKey(), goal.targetDate);
    weeksLeft = Math.max(0, Math.ceil(days / 7));
  }
  const neededPerWeek = weeksLeft ? money2(left / weeksLeft) : null;
  // What she has actually been putting aside, from the weeks already settled.
  const recent = mnyRecentSavingRate(kid);
  const hasHistory = mnySettledWeekCount(kid) > 0;
  return {
    left, weeksLeft, neededPerWeek, recent, hasHistory, reached: false,
    onPace: (neededPerWeek == null) || (recent >= neededPerWeek),
    // A date already past with money still to go is its own answer.
    late: weeksLeft === 0 && left > 0,
  };
}
/* How many Sundays have actually been settled. Without one, there is no pace
   to be behind — only a plan. */
function mnySettledWeekCount(kid) {
  ctEnsureShared();
  const plans = state.shared.chore.weekPlans || {};
  return Object.keys(plans).filter(wk => plans[wk] && plans[wk][kid] && plans[wk][kid].committedAt).length;
}
/* Average put aside per settled week, over the last few. */
function mnyRecentSavingRate(kid) {
  ctEnsureShared();
  const plans = state.shared.chore.weekPlans || {};
  const weeks = Object.keys(plans).filter(wk => plans[wk] && plans[wk][kid] && plans[wk][kid].committedAt)
    .sort().slice(-6);
  if (!weeks.length) return 0;
  const total = weeks.reduce((s, wk) => {
    const sp = plans[wk][kid].split || {};
    const goals = Object.keys(sp).filter(k => k.indexOf('goal:') === 0)
      .reduce((t, k) => t + money2(sp[k]), 0);
    return s + money2(sp.ready) + goals;
  }, 0);
  return money2(total / weeks.length);
}

/* ════════════════════════════════════════════════════════════════
   MONEY FROM OUTSIDE

   Birthday money, a gift, something sold. Entered at the meeting with her in
   the room — never on a parent-only screen — and applied when the week is
   committed, so it can be corrected right up to the moment it moves.

   It records how much and where from. It does NOT record where it goes: that
   is decided on page 3 along with everything else in the pool.
   ════════════════════════════════════════════════════════════════ */
function mnyEnsureDeposits(kid) {
  const p = getProfData(kid);
  if (!Array.isArray(p.deposits)) p.deposits = [];
  return p.deposits;
}
function mnyDepositsForWeek(kid, weekKey) {
  return mnyEnsureDeposits(kid).filter(d => d.weekKey === weekKey);
}
function mnyAddDeposit(kid, weekKey, fields) {
  const d = Object.assign({
    id: mrNewId('dep-'), weekKey, amount: 0, from: MNY_FROM[0],
    dayKey: todayKey(), appliedAt: null, createdAt: Date.now(), updatedAt: Date.now(),
  }, fields || {});
  d.amount = money2(d.amount);
  if (!(d.amount > 0)) return null;
  mnyEnsureDeposits(kid).push(d);
  mnyReopenWeek(kid, weekKey);
  saveAll();
  return d;
}
function mnyRemoveDeposit(kid, depositId) {
  const list = mnyEnsureDeposits(kid);
  const i = list.findIndex(d => d.id === depositId);
  if (i < 0) return false;
  const [gone] = list.splice(i, 1);
  ensureTombstones()['dep:' + gone.id] = Date.now();
  if (gone.weekKey) mnyReopenWeek(kid, gone.weekKey);
  saveAll();
  return true;
}
function mnyDepositTotal(kid, weekKey) {
  return money2(mnyDepositsForWeek(kid, weekKey).reduce((s, d) => s + money2(d.amount), 0));
}

/* ════════════════════════════════════════════════════════════════
   CHANGING A NUMBER AT THE MEETING

   The planner's number is the starting point, not the verdict. A parent can
   change any channel, but only with a reason from a fixed list, and the
   original stays visible beside it. An override lives inside the week's
   earnings record, so mrWeekBreakdown applies it and every surface —
   the quest strip, the ledger freeze, the year-to-date — follows for free.
   ════════════════════════════════════════════════════════════════ */
const MNY_CHANNELS = [
  { key: 'chores',   icon: '🧹', label: 'Jobs around the house' },
  { key: 'learning', icon: '📚', label: 'Learning' },
  { key: 'streak',   icon: '🔥', label: 'Clean days in a row' },
  { key: 'comp',     icon: '🏆', label: 'Competition days' },
  { key: 'fines',    icon: '⚖️', label: 'Taken off' },
];

function mnyOverrides(kid, weekKey) {
  const e = mrEnsureEarnings(kid, weekKey);
  if (!e.overrides) e.overrides = {};
  return e.overrides;
}
function mnySetOverride(kid, weekKey, channel, value, reason) {
  if (!isParent()) { showToast('A grown-up changes the numbers 🔒'); return false; }
  const ov = mnyOverrides(kid, weekKey);
  const v = Math.max(0, money2(value));
  ov[channel] = { value: v, reason: reason || null, at: Date.now() };
  mrStampEarnings(kid, weekKey);
  mnyReopenWeek(kid, weekKey);
  saveAll();
  return true;
}
function mnyClearOverride(kid, weekKey, channel) {
  if (!isParent()) return false;
  const ov = mnyOverrides(kid, weekKey);
  if (ov[channel] == null) return false;
  delete ov[channel];
  mrStampEarnings(kid, weekKey);
  mnyReopenWeek(kid, weekKey);
  saveAll();
  return true;
}
/* A channel the planner has nothing for. Amber, and it blocks the confirm
   until someone either gives it a number or says there was nothing. */
function mnyMissing(kid, weekKey) {
  const e = mrEnsureEarnings(kid, weekKey);
  if (!Array.isArray(e.missing)) e.missing = [];
  return e.missing;
}
function mnyToggleMissing(kid, weekKey, channel) {
  if (!isParent()) return false;
  const list = mnyMissing(kid, weekKey);
  const i = list.indexOf(channel);
  if (i < 0) list.push(channel); else list.splice(i, 1);
  mrStampEarnings(kid, weekKey);
  mnyReopenWeek(kid, weekKey);
  saveAll();
  return true;
}
/* The reason chosen the first time anything was changed this week. One reason
   per week, shown on the card. */
function mnyWeekReason(kid, weekKey) {
  const ov = mnyOverrides(kid, weekKey);
  const first = Object.keys(ov).map(k => ov[k]).filter(o => o && o.reason)
    .sort((a, b) => (a.at || 0) - (b.at || 0))[0];
  return first ? first.reason : null;
}
function mnyAnyEdited(kid, weekKey) { return Object.keys(mnyOverrides(kid, weekKey)).length > 0; }

/* ════════════════════════════════════════════════════════════════
   THE WEEK: CONFIRM, THEN DECIDE, THEN COMMIT
   ════════════════════════════════════════════════════════════════ */
function mnyEnsureWeekMaps() {
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.weekConfirms) c.weekConfirms = {};
  if (!c.weekPlans) c.weekPlans = {};
  return c;
}
function mnyWeekConfirm(weekKey, kid) {
  const c = mnyEnsureWeekMaps();
  return (c.weekConfirms[weekKey] || {})[kid] || null;
}
function mnyIsConfirmed(weekKey, kid) {
  const s = mnyWeekConfirm(weekKey, kid);
  return !!(s && s.at && !s.reopenedAt);
}
function mnyIsCommitted(weekKey, kid) {
  ctEnsureShared();
  const p = ((state.shared.chore.weekPlans || {})[weekKey] || {})[kid];
  return !!(p && p.committedAt);
}
function mnyConfirmWeek(weekKey, kid, by) {
  if (!isParent()) { showToast('A grown-up confirms the week 🔒'); return false; }
  const c = mnyEnsureWeekMaps();
  if (!c.weekConfirms[weekKey]) c.weekConfirms[weekKey] = {};
  c.weekConfirms[weekKey][kid] = { by: by || 'a grown-up', at: Date.now(), reopenedAt: null,
                                   checks: (c.weekConfirms[weekKey][kid] || {}).checks || {} };
  saveAll();
  return true;
}
/* Any change after confirming reopens the week — unless the money has already
   moved, in which case the frozen ledger stands and the correction belongs to
   next Sunday's conversation. */
function mnyReopenWeek(kid, weekKey) {
  const c = mnyEnsureWeekMaps();
  const s = (c.weekConfirms[weekKey] || {})[kid];
  if (!s || !s.at || s.reopenedAt) return false;
  if (mnyIsCommitted(weekKey, kid)) return false;
  s.reopenedAt = Date.now();
  saveAll();
  return true;
}
function mnyConfirmStamp(weekKey, kid) {
  const s = mnyWeekConfirm(weekKey, kid);
  if (!s || !s.at) return '';
  if (s.reopenedAt) return 'Changed after confirming — confirm again';
  const d = new Date(s.at);
  return 'Confirmed by ' + s.by + ' · ' + d.getDate() + ' ' +
         ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
}
/* The parent's before-we-start checklist, stored beside the confirm. */
function mnyChecks(weekKey, kid) {
  const c = mnyEnsureWeekMaps();
  if (!c.weekConfirms[weekKey]) c.weekConfirms[weekKey] = {};
  if (!c.weekConfirms[weekKey][kid]) c.weekConfirms[weekKey][kid] = { checks: {} };
  const s = c.weekConfirms[weekKey][kid];
  if (!s.checks) s.checks = {};
  return s.checks;
}
function mnyToggleCheck(weekKey, kid, id) {
  const ch = mnyChecks(weekKey, kid);
  ch[id] = !ch[id];
  saveAll();
  return ch[id];
}

function mnyWeekPlan(weekKey, kid) {
  const c = mnyEnsureWeekMaps();
  return (c.weekPlans[weekKey] || {})[kid] || null;
}
function mnySavePlan(weekKey, kid, plan) {
  const c = mnyEnsureWeekMaps();
  if (!c.weekPlans[weekKey]) c.weekPlans[weekKey] = {};
  const prev = c.weekPlans[weekKey][kid] || {};
  c.weekPlans[weekKey][kid] = Object.assign({}, prev, plan, { updatedAt: Date.now() });
  saveAll();
  return c.weekPlans[weekKey][kid];
}
/* Last week's plan — what "same as last week" means, and what page 3 opens
   with already applied. */
function mnyPreviousPlan(weekKey, kid) {
  const c = mnyEnsureWeekMaps();
  const weeks = Object.keys(c.weekPlans).filter(wk => wk < weekKey && c.weekPlans[wk] && c.weekPlans[wk][kid]).sort();
  if (!weeks.length) return null;
  return c.weekPlans[weeks[weeks.length - 1]][kid];
}

/* ── What the week is made of ──
   One number for each thing that came in, one for each thing that has to go
   out, and what is left for her to decide. */
/* ── ONE POOL ──
   Jobs, learning, clean days, competitions and a birthday cheque are all the
   same thing once they land: money in. Paying off a loan, keeping some ready,
   locking it away, buying a bit of a company and putting some toward a goal
   are all the same thing on the way out: money out. Which door a dollar came
   in through has no bearing on which door it leaves by.

   That is not a simplification for a nine-year-old — it is how a cash pool
   actually works, and it is the reason there is exactly one place where
   outflows get decided (page 3) rather than a destination attached to every
   inflow. Tagging gifts with a destination at entry looked tidier and was
   wrong twice over: it let the same fifty dollars be spent in two places, and
   it made the loan payment look like a claim on her chores specifically. */
function mnyPool(weekKey, kid) {
  const b = mrWeekBreakdown(weekKey, kid);
  const deposits = mnyDepositTotal(kid, weekKey);
  const cameIn = money2(b.net + deposits);
  // The schedule draws on the whole pool, like any real payment does.
  const mustPay = money2(Math.min(mnyDueNowTotal(kid), cameIn));
  const mine = money2(Math.max(0, cameIn - mustPay));
  return {
    breakdown: b, deposits, cameIn, mustPay, mine,
    // Investing is capped at a fifth of the week: a bad month should sting,
    // not wipe out everything she earned.
    stockCap: money2(mine * 0.2),
  };
}

/* ── Pricing a plan ──
   Turn a plan (or a hand-built split) into dollars per bucket, then into what
   it actually does to the debt. `split` keys are 'loan:<debtId>', 'ready',
   'gic', 'stock'. */
function mnySplitFor(weekKey, kid, planId, own) {
  const pool = mnyPool(weekKey, kid);
  const debts = mnyDebtsByPriority(kid).filter(d => loanBalance(kid, d.id) > 0);
  const out = { ready: 0, gic: 0, stock: 0 };
  debts.forEach(d => { out['loan:' + d.id] = 0; });
  // A row per goal she is still saving for. Goals are never stage-locked —
  // they are the reason to save, so gating them behind a lesson about saving
  // would be backwards.
  mnyGoals(kid).forEach(g => { out['goal:' + g.id] = 0; });

  if (planId === 'own') return Object.assign(out, own || {});
  if (planId === 'last') {
    const prev = mnyPreviousPlan(weekKey, kid);
    if (prev && prev.split) {
      // Re-price last week's SHAPE against this week's money, so a smaller week
      // does not commit more than exists.
      const prevTotal = Object.keys(prev.split).reduce((s, k) => s + money2(prev.split[k]), 0);
      if (prevTotal > 0) {
        Object.keys(prev.split).forEach(k => {
          const dollars = money2(pool.mine * (money2(prev.split[k]) / prevTotal));
          // A debt cleared or a goal reached since last week: its share falls
          // back to being kept ready rather than vanishing from the split.
          if (out[k] === undefined && (k.indexOf('loan:') === 0 || k.indexOf('goal:') === 0)) {
            out.ready = money2(out.ready + dollars);
            return;
          }
          out[k] = dollars;
        });
        return out;
      }
    }
    planId = 'ready';   // no history yet — fall back to the gentle default
  }
  const plan = MNY_PLANS.find(p => p.id === planId) || MNY_PLANS[0];
  const shape = plan.split || { loan: 1 };
  Object.keys(shape).forEach(k => {
    let dollars = money2(pool.mine * shape[k]);
    if (k !== 'loan') {
      // A bucket she has not reached yet takes nothing, whatever the plan says.
      // Its share falls back to paying the debt down, which is always open.
      const bucket = MNY_BUCKETS.find(b => b.key === k);
      if (bucket && !mnyIsOpen(kid, bucket.need)) {
        const first = debts[0];
        if (first) out['loan:' + first.id] = money2(out['loan:' + first.id] + dollars);
        else out.ready = money2(out.ready + dollars);
        return;
      }
      out[k] = dollars;
      return;
    }
    // The loan share spreads across debts, highest bonus first — that is where
    // a dollar clears the most.
    let left = dollars;
    debts.forEach(d => {
      if (!(left > 0)) return;
      const bonus = (Number(d.bonusRate) || 0) / 100;
      const need = money2(loanBalance(kid, d.id) / (1 + bonus));
      const give = money2(Math.min(left, need));
      out['loan:' + d.id] = money2(out['loan:' + d.id] + give);
      left = money2(left - give);
    });
    if (left > 0) out.ready = money2(out.ready + left);   // everything paid off
  });
  return out;
}
function mnySplitTotal(split) {
  return money2(Object.keys(split || {}).reduce((s, k) => s + money2(split[k]), 0));
}
function mnySplitToLoan(split, debtId) {
  if (debtId) return money2((split || {})['loan:' + debtId]);
  return money2(Object.keys(split || {}).filter(k => k.indexOf('loan:') === 0)
    .reduce((s, k) => s + money2(split[k]), 0));
}

/* What a plan does, in the four numbers page 3 shows as tiles. */
function mnyPricePlan(kid, split) {
  const toLoan = mnySplitToLoan(split);
  const before = mnyTotalOwing(kid);
  let bonus = 0, cleared = 0, left = toLoan;
  mnyDebtsByPriority(kid).forEach(d => {
    if (!(left > 0)) return;
    const owed = loanBalance(kid, d.id);
    if (!(owed > 0)) return;
    const rate = (Number(d.bonusRate) || 0) / 100;
    const need = money2(owed / (1 + rate));
    const pay = money2(Math.min(left, need));
    cleared = money2(cleared + pay * (1 + rate));
    bonus = money2(bonus + pay * rate);
    left = money2(left - pay);
  });
  const primary = mnyDebtsByPriority(kid).find(d => loanBalance(kid, d.id) > 0);
  const now = primary ? loanFreeDate(kid, primary.id, 0) : { months: 0 };
  const then = primary ? loanFreeDate(kid, primary.id, mnySplitToLoan(split, primary.id)) : { months: 0 };
  return {
    toLoan, bonus, cleared,
    owingAfter: money2(Math.max(0, before - cleared)),
    cashReady: money2(money2((split || {}).ready) + money2((split || {}).gic) + money2((split || {}).stock)),
    monthsNow: now.months, monthsThen: then.months,
    monthsSaved: (now.months != null && then.months != null) ? Math.max(0, now.months - then.months) : 0,
    freeDate: then.date || null,
  };
}

/* ── The five doors ──
   "If I put $X somewhere for a year, what happens?" — one row per choice,
   signed, so paying late sits below the line beside the ones that grow. */
function mnyDoors(kid, amount) {
  const amt = money2(amount);
  const cfg = bankConfig();
  const d = mnyDebtsByPriority(kid)[0] || { bonusRate: 0, arrearsRatePct: 0, name: 'my loan', icon: '🎿' };
  const bonus = (Number(d.bonusRate) || 0) / 100;
  const arrears = (Number(d.arrearsRatePct) || 0) / 100;
  const gic = Number((cfg.gicRates || {})[12]) || 0.04;
  const save = Number(cfg.savingsRate) || 0.015;
  return [
    { id: 'early', icon: '⚡', label: 'Pay off ' + d.name + ' early', delta: money2(amt * bonus),
      note: 'The bonus is promised — it cannot go down.' },
    { id: 'gic',   icon: '🔒', label: 'Lock it away for a year',      delta: money2(amt * gic),
      note: 'Promised too, but you cannot touch it for a year.' },
    { id: 'ready', icon: '💵', label: 'Keep it ready',                delta: money2(amt * save),
      note: 'Small, but you can have it back any day.' },
    { id: 'stock', icon: '📈', label: 'Buy a bit of a company',       delta: money2(amt * 0.07), range: true,
      note: 'Could be a lot more. Could be less than you put in.' },
    { id: 'late',  icon: '🐢', label: 'Pay late',                     delta: money2(-amt * arrears * 12),
      note: 'It costs more every month you wait.' },
  ];
}

/* ════════════════════════════════════════════════════════════════
   THE TWO BARS

   Where the money came from, and where it went. Same grammar both times: one
   stacked bar, every segment labelled in dollars, fines shown as a red line
   underneath rather than a negative segment — a bar cannot go backwards, and
   pretending it can is how a chart starts lying.
   ════════════════════════════════════════════════════════════════ */
function mnySegments(list) {
  const rows = (list || []).filter(r => money2(r.value) > 0);
  const total = money2(rows.reduce((s, r) => s + money2(r.value), 0));
  if (!(total > 0)) return { segs: [], total: 0 };
  return {
    total,
    segs: rows.map(r => ({
      label: r.label, color: r.color, value: money2(r.value),
      // A sliver still has to be visible and still has to be tappable.
      w: Math.max(3, Math.round((money2(r.value) / total) * 100)) + '%',
    })),
  };
}
/* What came in THIS WEEK. Deliberately no "made on its own" segment: what her
   holdings have gained is a running total since she bought them, not a thing
   that happened this week, and dropping it into a weekly bar would make the
   segments add up to more than the week did. That number has its own home —
   the returns statement on page 2, where it is the whole point. */
/* Everything that came in this week, including what her money made on its own.
   Passive income belongs here: it is income, it happened this week, and a bar
   that omits it does not add up to what she is worth now. It is deliberately
   the last segment and a muted grey — she did not work for it, and the whole
   lesson is that it arrived anyway. */
function mnyIncomeSegments(weekKey, kid) {
  const pool = mnyPool(weekKey, kid);
  const b = pool.breakdown;
  const passive = mnyPassiveSinceLastMeeting(kid);
  const out = mnySegments([
    { label: 'Jobs',           value: b.chorePaid,    color: '#95d5b2' },
    { label: 'Learning',       value: b.learnPaid,    color: '#6fb1fc' },
    { label: 'Clean days',     value: b.streakBonus,  color: '#ffd166' },
    { label: 'Competitions',   value: b.compPaid,     color: '#ff9eb5' },
    { label: 'From outside',   value: pool.deposits,  color: '#c9a6e8' },
    { label: 'Made on its own', value: Math.max(0, passive), color: '#b8b0a2' },
  ]);
  out.fines = money2(b.fines.total);
  out.passive = passive;
  return out;
}
function mnyOutflowSegments(weekKey, kid, split) {
  const pool = mnyPool(weekKey, kid);
  const s = split || (mnyWeekPlan(weekKey, kid) || {}).split || {};
  const rows = [{ label: 'My loan payment', value: pool.mustPay, color: '#b8b0a2' }];
  mnyDebtsByPriority(kid).forEach(d => {
    rows.push({ label: 'Extra off ' + d.name, value: money2(s['loan:' + d.id]), color: '#95d5b2' });
  });
  mnyGoals(kid, true).forEach(g => {
    const v = money2(s['goal:' + g.id]);
    if (v > 0) rows.push({ label: 'Toward ' + g.name, value: v, color: '#ffb4a2' });
  });
  rows.push({ label: 'Kept ready',   value: money2(s.ready), color: '#ffd166' });
  rows.push({ label: 'Locked away',  value: money2(s.gic),   color: '#6fb1fc' });
  rows.push({ label: 'Bit of a company', value: money2(s.stock), color: '#c9a6e8' });
  return mnySegments(rows);
}

/* ── Lessons ──
   Which stage she is at, and what that opens. A parent can open the next one
   early — sometimes the conversation gets there before the debt does. */
function mnyUnlockOverride(kid) {
  const r = mrRules();
  return Number(((r.school || {}).unlockStage || {})[kid]) || 0;
}
function mnyStageIndex(kid) {
  const pct = mnyPaidPct(kid);
  let idx = 0;
  MNY_STAGES.forEach((s, i) => { if (pct >= s.pct) idx = i; });
  return Math.min(MNY_STAGES.length - 1, Math.max(idx, mnyUnlockOverride(kid)));
}
function mnyStage(kid) { return MNY_STAGES[mnyStageIndex(kid)]; }
/* Is a thing needing `need` percent open yet? */
function mnyIsOpen(kid, need) {
  const ceiling = MNY_STAGES[mnyStageIndex(kid)].pct;
  return (Number(need) || 0) <= ceiling;
}
function mnyNeedLabel(need) { return 'Opens at ' + (Number(need) || 0) + '% paid off'; }

/* The concept card, with the real debt named in it. */
function mnyConceptCard(id, kid) {
  const c = mnyConceptById(id);
  if (!c) return null;
  const names = mnyDebts(kid).map(d => d.name);
  const naming = names.length ? names.join(' and ') : 'your loan';
  const swap = (s) => String(s || '').replace(/\{debt\}/g, naming);
  return {
    id: c.id, icon: c.icon, title: c.title, need: c.need,
    open: mnyIsOpen(kid, c.need),
    what: swap(c.what), why: swap(c.why), risk: swap(c.risk),
    whyLabel: c.whyLabel || 'Why it helps', riskLabel: c.riskLabel || 'What to watch',
  };
}

/* ════════════════════════════════════════════════════════════════
   WHAT MONEY BUYS

   "$80" is not a quantity to a nine-year-old, it is a word. "Dinner out for
   all of us" is a quantity. They are the same fact, and only one of them can
   be weighed against wanting something else.

   So every big number on a kid page gets an anchor beside it, drawn from a
   list of things she has actually watched the family buy — parent-editable,
   because the whole point is that the prices are hers, not a stock photo of a
   generic economy.
   ════════════════════════════════════════════════════════════════ */
function mnyBuysItems() {
  const items = ((mrRules().buys || {}).items || []).filter(i => money2(i.amount) > 0);
  return items.slice().sort((a, b) => money2(a.amount) - money2(b.amount));
}
/* Pick the comparison that reads most naturally for this amount: a count
   between one and nine, halves allowed, nothing below the cheapest thing on
   the list — "about 0.4 of an ice cream" helps nobody. */
function mnyBuysLine(amount) {
  const amt = money2(amount);
  const items = mnyBuysItems();
  if (!items.length || amt < money2(items[0].amount)) return '';

  let best = null;
  items.forEach(it => {
    const price = money2(it.amount);
    const raw = amt / price;
    if (raw < 0.9) return;                       // cannot afford one of these
    const n = Math.round(raw * 2) / 2;           // to the nearest half
    if (n > 9.5) return;                         // too many to picture
    // Prefer whole numbers, then small counts, then the closest fit.
    const score = (Math.abs(n - Math.round(n)) < 0.01 ? 0 : 1) * 10
                + Math.abs(n - 3)                 // three of something reads best
                + Math.abs(raw - n) * 2;          // and honest is better than tidy
    if (!best || score < best.score) best = { it, n, raw, score };
  });
  if (!best) {
    // Bigger than nine of everything: use the dearest thing and say "over".
    const top = items[items.length - 1];
    const n = Math.floor(amt / money2(top.amount));
    return n >= 1 ? `more than ${n} ${mnyBuysPlural(top)}` : '';
  }
  const { it, n } = best;
  if (Math.abs(n - 1) < 0.01) return `about the price of ${it.label}`;
  const count = (Math.abs(n - Math.round(n)) < 0.01) ? String(Math.round(n)) : n.toFixed(1);
  return `about ${count} ${mnyBuysPlural(it)}`;
}
/* The plural comes from the item, never from a rule — English does not have
   one. Falls back to the label with its article stripped, which is at least
   never nonsense even if a parent leaves the field empty. */
function mnyBuysPlural(item) {
  return item.plural || String(item.label || '').replace(/^an? /, '');
}
/* The same line, ready to drop under a total. Empty when there is nothing
   useful to say, so it never leaves a dangling dash. */
function mnyBuysNote(amount) {
  const line = mnyBuysLine(amount);
  return line ? `<div class="mny-buys">🛒 ${escapeHtml(line)}</div>` : '';
}

/* ════════════════════════════════════════════════════════════════
   THE FIVE PAGES, AS A SET

   Every money surface carries the same numbered tab bar. That is not
   decoration: the five pages are one system, and a kid who can see all five
   from any of them understands that "what I earned" and "what I do with it"
   are two halves of one Sunday rather than two unrelated screens.

   The tag under each label says WHO the page is for. A kid tapping page 4 is
   not being refused — she is being told it is a grown-up's page, which is a
   different and much better message.
   ════════════════════════════════════════════════════════════════ */
const MNY_TABS = [
  { id: 'money',  icon: '💰', label: 'My money',          who: 'kid' },
  { id: 'grow',   icon: '💪', label: 'What I earned',     who: 'meeting' },
  { id: 'where',  icon: '🤝', label: 'What I do with it', who: 'meeting' },
  { id: 'rules',  icon: '⚙️', label: 'Money rules',       who: 'parent' },
  { id: 'school', icon: '🎓', label: 'Money school',      who: 'optional' },
];

/* Where each tab goes. The two meeting pages open the meeting itself for a
   grown-up; for a kid they explain that this happens on Sunday, together,
   rather than opening a screen she cannot use alone. */
function mnyGoTab(id) {
  const kid = (typeof mnyViewKid === 'function') ? mnyViewKid() : 'jess';
  if (id === 'money')  { mnyOpenMyMoney(kid); return; }
  if (id === 'school') { mnyOpenSchool(kid); return; }
  if (id === 'rules') {
    if (!isParent()) { showToast('⚙️ Money rules is a grown-up page'); return; }
    showScreen('parent');
    if (typeof setParentTab === 'function') setParentTab('money');
    if (typeof mnyRenderRulesTab === 'function') mnyRenderRulesTab();
    return;
  }
  // grow / where — the two halves of the Sunday meeting.
  if (!isParent()) {
    showToast(id === 'grow'
      ? '💪 You go through this together on Sunday'
      : '🤝 You decide this together on Sunday');
    return;
  }
  if (typeof openFamilyMeeting !== 'function') return;
  const already = document.getElementById('familyMeetingOverlay');
  if (!already || !already.classList.contains('open')) openFamilyMeeting();
  mmGoStep(id === 'grow' ? 3 : 4);
}

/* The bar itself. `cur` is the tab that is showing, and it is not a link. */
function mnyTabBar(cur) {
  return `<nav class="mny-tabs" aria-label="The five money pages">${MNY_TABS.map((t, i) => {
    const sel = t.id === cur;
    return `<button type="button" class="mny-tab${sel ? ' on' : ''}"${sel ? ' aria-current="page"' : ''}
        data-mny-action="tab" data-mny-tab="${t.id}">
        <span>${i + 1} ${t.icon} ${escapeHtml(t.label)}</span>
        <span class="mny-tab-tag">${escapeHtml(t.who)}</span>
      </button>`;
  }).join('')}</nav>`;
}

/* ── The walkthroughs ──
   Two of them, because the two audiences need opposite things explained: a kid
   needs to know nothing here can hurt her, a parent needs to know this is the
   only place a number can be changed. */
const MNY_TOURS = {
  kid: [
    { icon: '💰', title: 'This page is yours', where: 'The whole screen',
      body: 'Everything here is yours to look at any time, without asking. Nothing on this page can take money away from you — a number only changes at the Sunday meeting, with a grown-up sitting next to you.' },
    { icon: '🧹', title: 'What you can still earn today', where: 'Top left',
      body: 'The first card is today only. It says how much of today is still open, and how many of your free jobs are left.' },
    { icon: '🏦', title: 'The four places your money sits', where: 'Left column',
      body: 'Cash you can spend, money kept ready, money locked away for a year, and money in companies. Add the four together and that is everything you have.' },
    { icon: '🎯', title: 'What you are saving for', where: 'Left column',
      body: 'Make a goal for something you want. Put in what it costs and when you want it by, and I will tell you how much a week that takes.' },
    { icon: '📖', title: 'Every week you have ever done', where: 'Top right button',
      body: 'My money story opens your past weeks — one at a time or a whole month, and how much of your loan was left at the end of each.' },
  ],
  parent: [
    { icon: '⚙️', title: 'The only page that changes a number', where: 'The whole screen',
      body: 'Prices, caps, targets, the loans, what she owns and past weeks all live here. Pages 1 to 3 only read from this page — nothing on them can be edited by a kid.' },
    { icon: '🎿', title: 'The loans', where: 'Loans section',
      body: 'Each debt carries its own amount, schedule, early-payment bonus and late cost. Renaming or re-rating one is written to the change history with a date, and never touches what has been paid.' },
    { icon: '📈', title: 'What she actually holds', where: 'What she owns',
      body: 'One record per holding. Page 1’s tiles and page 2’s returns are computed from it, so no number is typed in twice. Interest, share prices and maturity all move on real calendar time by themselves.' },
    { icon: '🗓', title: 'Weeks arrive two ways', where: 'Week history',
      body: 'Confirming a week at the meeting writes its row by itself and freezes it. For a week that happened before the app, "Add a week" steps back one week per tap so you can type it in.' },
    { icon: '💾', title: 'Nothing saves until you say so', where: 'The bar at the top',
      body: 'Edits collect and save as one dated change with one reason. Discard throws them away — no version was ever created, so there is nothing to roll back.' },
  ],
};

/* ── Formatting ── */
function mnyMoney(n) { return '$' + money2(n).toFixed(2); }
function mnySigned(n) { const v = money2(n); return (v < 0 ? '−$' : '+$') + Math.abs(v).toFixed(2); }
/* A percentage is meaningless to a nine-year-old on its own — always say what
   it is worth in dollars. */
function mnyPctOf(rate, dollars) {
  const pct = (Number(rate) || 0) * 100;
  const txt = (Math.round(pct * 10) / 10) + '%';
  return dollars == null ? txt : txt + ' — ' + mnyMoney(dollars);
}
/* "Jul 28" is fine for something that happened this year. For a debt-free date
   three years out it is worse than useless — it reads as next week. The year
   appears whenever it is not the current one. */
function mnyShortDate(dayKey) {
  if (!dayKey) return '—';
  const d = formatDayKey(dayKey);
  const txt = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + ' ' + d.getDate();
  const thisYear = formatDayKey(todayKey()).getFullYear();
  return d.getFullYear() === thisYear ? txt : (txt + ' ' + d.getFullYear());
}
/* The week the money pages are looking at — the planner's current week. */
function mnyWeekKey() {
  if (typeof ctWeekKey !== 'undefined' && ctWeekKey) return ctWeekKey;
  return ctDateToKey(ctMondayOf(new Date()));
}

// Inert in the browser; lets tests run these helpers in Node.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MNY_STAGES, MNY_PLANS, MNY_BUCKETS, MNY_CONCEPTS };
}
