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

/* Money that arrives from outside the week's work. Destinations are gated by
   the same stages as the buckets, so a birthday cheque cannot skip a lesson. */
const MNY_DEST = [
  { id: 'loan',  icon: '🎿', label: 'Pay off my loan',        need: 0 },
  { id: 'ready', icon: '💵', label: 'Keep it ready',          need: 30 },
  { id: 'gic',   icon: '🔒', label: 'Lock it away for a year', need: 60 },
];
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
  { id: 'debt', icon: '🎿', title: 'Owing money', need: 0,
    what: 'Someone paid for something now, and you pay them back a bit at a time.',
    why: 'You get the thing straight away instead of waiting years to save for it.',
    risk: 'Until it is paid off, part of every week is already spoken for.' },
  { id: 'cash', icon: '💵', title: 'Cash', need: 0,
    what: 'Money you can use today, sitting in your wallet.',
    why: 'It is ready the moment you need it.',
    risk: 'It does not grow at all while it sits there.' },
  { id: 'extra', icon: '⚡', title: 'Paying early', need: 0,
    what: 'Paying more than you have to, before it is due.',
    why: 'You earn a bonus for it, and the loan ends sooner.',
    risk: 'That money is gone into the loan — you cannot get it back out.',
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
  if (!h.createdAt) h.createdAt = Date.now();
  return h;
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
   MONEY FROM OUTSIDE

   Birthday money, a gift, something sold. Entered at the meeting with her in
   the room — never on a parent-only screen — and applied when the week is
   committed, so it can be corrected right up to the moment it moves.
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
    id: mrNewId('dep-'), weekKey, amount: 0, from: MNY_FROM[0], dest: 'ready',
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
function mnyPool(weekKey, kid) {
  const b = mrWeekBreakdown(weekKey, kid);
  const deposits = mnyDepositTotal(kid, weekKey);
  const cameIn = money2(b.net + deposits);
  /* The loan payment comes out of what she EARNED, not out of a birthday
     cheque: the schedule is a claim on her week's work, and letting a gift
     absorb it would quietly make the loan look easier than it is. */
  const mustPay = money2(Math.min(mnyDueNowTotal(kid), b.net));
  /* Money from outside is money that came in, but it is NOT hers to choose
     about tonight: she already aimed it when she entered it, one destination
     per gift. Counting it in both places would let the same fifty dollars be
     kept ready AND paid off the loan — the plan would commit more than exists,
     and the shortfall would only surface as an odd number after the commit.
     So what is hers to choose is simply what her work left after the loan. */
  const mine = money2(Math.max(0, b.net - mustPay));
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

  if (planId === 'own') return Object.assign(out, own || {});
  if (planId === 'last') {
    const prev = mnyPreviousPlan(weekKey, kid);
    if (prev && prev.split) {
      // Re-price last week's SHAPE against this week's money, so a smaller week
      // does not commit more than exists.
      const prevTotal = Object.keys(prev.split).reduce((s, k) => s + money2(prev.split[k]), 0);
      if (prevTotal > 0) {
        Object.keys(prev.split).forEach(k => {
          if (out[k] === undefined && k.indexOf('loan:') === 0) return;   // a debt since cleared
          out[k] = money2(pool.mine * (money2(prev.split[k]) / prevTotal));
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
function mnyIncomeSegments(weekKey, kid) {
  const pool = mnyPool(weekKey, kid);
  const b = pool.breakdown;
  const out = mnySegments([
    { label: 'Jobs',         value: b.chorePaid,    color: '#95d5b2' },
    { label: 'Learning',     value: b.learnPaid,    color: '#6fb1fc' },
    { label: 'Clean days',   value: b.streakBonus,  color: '#ffd166' },
    { label: 'Competitions', value: b.compPaid,     color: '#ff9eb5' },
    { label: 'From outside', value: pool.deposits,  color: '#c9a6e8' },
  ]);
  out.fines = money2(b.fines.total);
  return out;
}
function mnyOutflowSegments(weekKey, kid, split) {
  const pool = mnyPool(weekKey, kid);
  const s = split || (mnyWeekPlan(weekKey, kid) || {}).split || {};
  const rows = [{ label: 'My loan payment', value: pool.mustPay, color: '#b8b0a2' }];
  mnyDebtsByPriority(kid).forEach(d => {
    rows.push({ label: 'Extra off ' + d.name, value: money2(s['loan:' + d.id]), color: '#95d5b2' });
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
function mnyShortDate(dayKey) {
  if (!dayKey) return '—';
  const d = formatDayKey(dayKey);
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + ' ' + d.getDate();
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
