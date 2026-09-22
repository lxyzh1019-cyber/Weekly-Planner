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
   lessons arrive as the debt comes down rather than on a calendar.

   THE STAGE IS THE ONE OWNER OF A GATE. Each stage has an id; its number lives
   in the rulebook (`school.stagePct`, js/18-rules.js) and is read only through
   `mnyStagePct`. MNY_BUCKETS, MNY_PLANS and MNY_CONCEPTS name a STAGE and never
   a number. They used to carry their own copies (30 / 60 / 90 in three tables)
   and nothing made them agree, so a pot, its lesson and the ladder row could
   each have said something different about the same moment. */
const MNY_STAGES = [
  { id: 'start',  icon: '🎿', title: 'What I owe, and what I keep' },
  { id: 'ready',  icon: '💵', title: 'Keeping money ready' },
  { id: 'locked', icon: '🔒', title: 'Locking money away' },
  { id: 'stock',  icon: '📈', title: 'Trying it with stocks' },
  { id: 'mix',    icon: '🧩', title: 'Building my own mix' },
];

/* Where money can go on a Sunday. `stage` is the MNY_STAGES id that opens it.
   `loan` is special: there is one row per debt, built at render time. */
const MNY_BUCKETS = [
  { key: 'loan',  icon: '🎿', label: 'Pay off',        stage: 'start', tint: '#eaf6ef' },
  // Spending is a real answer to "what do I do with it", and a system that
  // only ever offers ways to defer teaches deferring, not choosing. Open from
  // the first week — but capped at a fifth, so a whole week can never vanish
  // into one afternoon.
  { key: 'spend', icon: '🛍️', label: 'Spend it',       stage: 'start', tint: '#fff0f0' },
  { key: 'ready', icon: '💵', label: 'Keep it ready',  stage: 'ready', tint: '#fff9e9' },
  { key: 'gic',   icon: '🔒', label: 'Lock it away for a year', stage: 'locked', tint: '#eef3fb' },
  { key: 'stock', icon: '📈', label: 'Buy a bit of a company',  stage: 'stock', tint: '#f6effa' },
];

/* The ready-made plans. Fractions of what is hers to choose. */
const MNY_PLANS = [
  { id: 'debt',     icon: '🎿', label: 'Pay off my loan first', stage: 'start',  split: { loan: 1 } },
  { id: 'ready',    icon: '💵', label: 'Keep some ready',       stage: 'ready',  split: { loan: 0.4, ready: 0.6 } },
  { id: 'balanced', icon: '⚖️', label: 'A bit of everything',   stage: 'locked', split: { loan: 0.4, ready: 0.3, gic: 0.3 } },
  { id: 'grow',     icon: '📈', label: 'Grow it more',          stage: 'stock',  split: { loan: 0.3, ready: 0.1, gic: 0.2, stock: 0.4 } },
  { id: 'last',     icon: '🔁', label: 'Same as last week',     stage: 'start',  split: null },
  /* Not a stage-gated idea — it is manual entry, and the "or set every number
     yourself" steppers directly below this card are open at every stage. A
     locked card sitting above the unlocked control that does the same thing is
     just a lie about what the screen can do. */
  { id: 'own',      icon: '🧩', label: "I'll choose every number myself", stage: 'start', split: null, own: true },
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
/* Where it came from — a CATEGORY, never a person. The giver's name is its own
   field: "who gave her the red pocket" is a thing worth keeping and this list
   could never hold it.

   The two scholarships are kept APART from the competition channel on purpose.
   mrScoreCompetition pays for a RESULT under the rules; a scholarship is a gift
   somebody chose to give, and collapsing them would make a grandparent's cheque
   read as prize money the rules produced. */
const MNY_FROM = ['Birthday money', 'A gift', 'Grandma & Grandpa',
                  'Sports scholarship', 'Academic scholarship',
                  'Sold something', 'Found a job'];
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
/* Each answer names a plan, so picking one visibly re-shapes the split rather
   than just unlocking the commit button. `effect` says what it did, in the
   same words as the answer, so the connection is not a guess. */
const MNY_REFLECT = {
  question: 'What is this money for?',
  chips: [
    { id: 'sooner',  label: 'Getting my loan gone sooner', planId: 'debt',
      effect: 'Then most of it goes onto the loan.' },
    { id: 'saving',  label: 'Saving for something big', planId: 'ready',
      effect: 'Then more of it stays where you can reach it.' },
    { id: 'growing', label: 'Learning how money grows', planId: 'balanced',
      effect: 'Then it gets spread across a few places, so you can watch what each one does.' },
  ],
};

/* What the parent should have in front of them before the meeting starts. */
const MNY_CHECKS = [
  { id: 'c1', label: 'Chores graded for all six days' },
  { id: 'c2', label: 'Learning pages counted' },
  { id: 'c3', label: 'Routine days agreed (morning / afternoon / evening)' },
  { id: 'c4', label: 'Anything boxed this week talked about' },
  { id: 'c5', label: 'Competition results sheet in hand' },
  { id: 'c6', label: 'Money from outside written down' },
  { id: 'c7', label: 'Any price change saved with a reason' },
];

/* The things nobody is paid for that no rule sets. The one that a rule DOES
   set — how many household chores a week are free — is written from the live
   rules by `mnyWorkListsCard`, so a parent changing it changes this page too.
   What PAYS is not a list here at all any more: it said homework paid after
   homework stopped paying, and Money school now shows the live price list. */
const MNY_UNPAID = [
  'Your routines, morning and night',
  'Making your bed and tidying your room',
  'Packing your school bag and your sports gear',
  'Being kind to your sister',
];

/* The ideas Money school teaches, in the order they open. `stage` is the
   MNY_STAGES id that opens it; the debt card names the real debt at render time. */
const MNY_CONCEPTS = [
  /* {debt} is filled in with the real name from her debt record, so this reads
     as being about her week rather than about money in general. */
  { id: 'debt', icon: '🎿', title: 'Owing money', stage: 'start',
    what: 'We paid for {debt} up front, and you pay us back a bit at a time.',
    why: 'You got it straight away instead of waiting years to save up for it.',
    risk: 'Until {debt} is paid off, part of every week is already spoken for.' },
  { id: 'cash', icon: '💵', title: 'Cash', stage: 'start',
    what: 'Money you can use today, sitting in your wallet.',
    why: 'It is ready the moment you need it.',
    risk: 'It does not grow at all while it sits there.' },
  { id: 'spend', icon: '🛍️', title: 'Spending some of it', stage: 'start',
    what: 'Money you decide to actually use, on something you want.',
    why: 'Money is for something. Choosing what, and living with the choice, is the whole skill.',
    risk: 'It is gone once it is spent, and it never comes back as more. That is why only a fifth of a week can go here.',
    whyLabel: 'The good side', riskLabel: 'The other side' },
  { id: 'extra', icon: '⚡', title: 'Paying early', stage: 'start',
    what: 'Paying more off {debt} than you have to, before it is due.',
    why: 'You earn a bonus for it, and {debt} is gone sooner.',
    risk: 'That money has gone into {debt} — you cannot get it back out.',
    whyLabel: 'The good side', riskLabel: 'The other side' },
  { id: 'ready', icon: '🏦', title: 'Keeping money ready', stage: 'ready',
    what: 'Money set aside that you can still get back whenever you want.',
    why: 'When something goes wrong, you are not stuck.',
    risk: 'It grows very slowly — a little bit each year.' },
  { id: 'save', icon: '💰', title: 'Interest', stage: 'ready',
    what: 'The bank pays you a small amount each year for keeping money there.',
    why: 'Money you leave alone quietly makes a bit more money.',
    risk: 'It is small. It will not make you rich on its own.' },
  { id: 'gic', icon: '🔒', title: 'Locking money away for a year', stage: 'locked',
    what: 'You promise not to touch it for a year, and the bank pays you more.',
    why: 'More than just keeping it ready, and the amount is promised.',
    risk: 'You really cannot touch it. Not even if you change your mind.' },
  { id: 'stock', icon: '📈', title: 'Owning a bit of a company', stage: 'stock',
    what: 'You buy a small piece of a real company.',
    why: 'If the company does well, your piece is worth more.',
    risk: 'It can go down too. In 2023 one of these fell by a third in six months.' },
  { id: 'mix', icon: '🧩', title: 'Not putting it all in one place', stage: 'mix',
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
  if (!h.createdAt) h.createdAt = syncNow();
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
      /* The whole payout comes back, principal and the interest it was promised
         — so the stream says both: what was locked returns from `locked`, and
         the extra is new money from `interest`. Booking the lot against
         `locked` would derive a negative locked balance over time. */
      evMirror(kid, { kind: 'move', from: 'locked', to: 'cash', amount: money2(value),
                      ref: h.id, note: 'Unlocked ' + (h.name || 'locked money') });
      if (money2(payout - value) > 0) {
        evMirror(kid, { kind: 'interest', from: 'interest', to: 'cash',
                        amount: money2(payout - value), ref: h.id,
                        note: 'Interest on ' + (h.name || 'locked money') });
      }
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
        evMirrorValueChange(kid, h.kind, add, { ref: h.id, note: 'Interest on ' + (h.name || 'her savings') });
        moved = true;
      }
    } else if (h.kind === 'stock' && h.ticker) {
      // A real company's price for this calendar month. It goes down as often
      // as it goes up, which is the entire point of holding one.
      const price = mnyPriceForMonth(h.ticker, today);
      if (price != null && money2(price) !== money2(h.priceNow)) {
        const was = mnyHoldingValue(h);
        h.priceNow = money2(price);
        evMirrorValueChange(kid, h.kind, money2(mnyHoldingValue(h) - was),
                            { ref: h.id, note: (h.name || 'A company') + ' moved' });
        moved = true;
      }
    }
    h.lastAccruedOn = today;
    h.updatedAt = syncNow();
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

/* ── What is still on the table today ──
   "I can still earn $2.00" is a reason to go and do the bins, which makes this
   one of the few numbers a child acts on directly. It lived inline inside
   mnyTodayCard until Today wanted it too; a second copy of this arithmetic is a
   second answer to the same question, so it lives here and both screens read it.

   `cap` null means the rules set no daily maximum, in which case there is no
   "left" to speak of and the caller should say what she has earned instead. */
function mnyEarnLeftToday(kid, weekKey) {
  const wk = weekKey || mnyWeekKey();
  const cap = (mrRulesForWeek(wk).chores || {}).dailyCap;
  const chores = mrChoreWeek(wk, kid);
  const today = formatDayKey(todayKey());
  const dayIdx = Math.max(0, Math.min(6,
    Math.round((today - formatDayKey(wk)) / (24 * 60 * 60 * 1000))));
  const done = money2((chores.days[dayIdx] || {}).paid);
  return {
    dayIdx, done, cap: (cap == null) ? null : money2(cap),
    left: (cap == null) ? null : money2(Math.max(0, cap - done)),
    freeLeft: chores.freeLeft,
  };
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
  /* A parent keeping a holding truthful by hand is a real change in what she
     has. Mirrored like any other, or the stream would derive a balance that
     disagrees with the screen the moment a number is corrected. */
  const was = mnyHoldingValue(h);
  h[field] = num.includes(field) ? Math.max(0, Number(value) || 0) : value;
  h.updatedAt = syncNow();
  evMirrorValueChange(kid, h.kind, money2(mnyHoldingValue(h) - was),
                      { kind: 'correction', ref: h.id, note: 'Corrected ' + (h.name || 'a holding') });
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
    existing.updatedAt = syncNow();
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
    h.updatedAt = syncNow();
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
    createdAt: syncNow(), updatedAt: syncNow(),
  }, fields || {});
  g.target = money2(g.target);
  g.saved = money2(g.saved);
  if (!(g.target > 0)) return null;
  mnyEnsureGoals(kid).push(g);
  saveAll();
  return g;
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
  g.updatedAt = syncNow();
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
/* How a gift is NAMED on the stream and on the flow diagram. "$50 · gift" says
   nothing a child can hold on to; "Birthday money from Grandma" is the thing
   she remembers, and `giver` exists precisely because `from` is a category and
   never a person. One owner, because the movement, the ribbon and the month
   card all print it and three copies would drift. */
function mnyGiftLabel(d) {
  const from = String((d && d.from) || 'A gift');
  const giver = String((d && d.giver) || '').trim();
  return giver ? from + ' from ' + giver : from;
}
/* The stream fields a gift movement carries, wherever it is credited. Dated to
   the gift's OWN day, not to today — a red pocket arrives at New Year, and a
   flow that files it under the month somebody typed it in is a flow that lies
   about when her money came in. */
function mnyGiftMirror(d) {
  /* `to` is named explicitly even though a gift always lands in cash: the
     migration adds these rows up itself to work out an opening balance, and an
     absent destination reads there as "went nowhere" — which put every gift on
     the stream twice over. A movement says both ends, always. */
  return { kind: 'gift', from: 'gift', to: 'cash',
           dayKey: (d && d.dayKey) || todayKey(),
           weekKey: (d && d.weekKey) || null, ref: (d && d.id) || null,
           note: mnyGiftLabel(d) };
}

/* ── WHEN IT ARRIVED, AND WHICH MEETING DECIDES IT ─────────────────
   Two different questions, and a gift needs both answered separately.

   `dayKey` is WHEN IT CAME — the birthday, the New Year, the Saturday somebody
   sold something. It is what the flow diagram and the month history read, and
   getting it wrong files a red pocket in the wrong month of her life. Until
   now it was hardcoded to `todayKey()` with no form offering a date at all.

   `weekKey` is WHICH SUNDAY DECIDES WHERE IT GOES. A settled week's split has
   already run and its ledger is frozen, so it cannot decide anything more: the
   gift keeps its real date and is decided at the next still-open meeting.

   Before this, the week came from whatever week the PLANNER happened to be
   showing, and a gift landing in a committed week called `mnyReopenWeek`, which
   returns false for exactly that case — so the gift credited her cash and then
   belonged to no week's split at all, silently. */
function mnyGiftWeekFor(kid, dayKey) {
  const from = mnyWeekOfDay(dayKey);
  if (!mnyWeekSettled(from, kid)) return from;
  /* Walk forward to the first week that can still decide it. Bounded by a year
     rather than `while (true)`: a wrong device clock must not spin. Landing on
     the current week is the honest floor — a week that has not happened cannot
     have been settled, so the loop always terminates on something real. */
  const d = formatDayKey(from);
  for (let i = 0; i < 53; i++) {
    d.setDate(d.getDate() + 7);
    const wk = ctDateToKey(d);
    if (!mnyWeekSettled(wk, kid)) return wk;
  }
  return mnyWeekKey();
}

/* Has this child's week been SETTLED — can its split no longer decide
   anything? Committed at a meeting (`mnyIsCommitted`), or credited some other
   way: the Grandma rule, the repair, an express catch-up. Those write
   `finalizedWeeks` and never a committed plan, so asking about the plan alone
   filed a gift dated into a Grandma week under that week — a week no meeting
   will ever sit for, so its split was never offered anywhere. */
function mnyWeekSettled(weekKey, kid) {
  ctEnsureShared();
  const fin = ((state.shared.chore.finalizedWeeks || {})[weekKey] || {})[kid];
  return fin != null || mnyIsCommitted(weekKey, kid);
}

/* Which week a day belongs to, named the way the PLANNER names it.

   `ctWeekKeyForDate` goes through `ctMondayOf`, which reads the device's raw
   clock; `ctThisWeekKey` goes through `getWeekStart`, which goes through the
   app's timezone. CLAUDE.md records that these two can name DIFFERENT MONDAYS
   for part of every day, and that the disagreement already cost this repo a
   defect once. A gift filed under the raw-clock Monday while every money
   surface reads the planner's would be invisible in its own week — so for
   today, the planner's name wins, and only an older day goes through the
   date-walking path where no such second opinion exists. */
function mnyWeekOfDay(dayKey) {
  const day = dayKey || todayKey();
  if (typeof ctWeekKeyForDate !== 'function') return mnyWeekKey();
  const raw = ctWeekKeyForDate(day);
  return raw === ctWeekKeyForDate(todayKey()) ? mnyWeekKey() : raw;
}

/* Is this gift's decision happening somewhere other than the week it arrived
   in? The forms say so out loud rather than letting a parent discover it. */
function mnyGiftDecidedElsewhere(kid, dayKey) {
  const arrived = mnyWeekOfDay(dayKey);
  const decides = mnyGiftWeekFor(kid, dayKey);
  return String(arrived) === String(decides) ? null : decides;
}
/* What a form says when that happens — a gift or a meet, the same words,
   because it is the same mechanism. */
const MNY_SETTLED_WEEK_SENTENCE = 'That week is already settled, so it arrives on its own date and you will decide where it goes at the next meeting.';

/* Rule 1 of mnyLateCompSync (below) as one question — a ledger row whose
   competition channel is neither voided nor edited at the table — so the list
   of older weeks' unpaid meets (mnyUnpaidMeetsPlanFor) can never pick a
   different set of weeks than the sync it pays through. */
function mnyLateCompByTotal(led) {
  return !!led && (led.voided || []).indexOf('competition') < 0
    && (led.edited || []).indexOf('comp') < 0;
}

/* ── A MEET FOR A WEEK ALREADY SETTLED — the gift pattern ────────────
   The owner: "a settled week only discusses routine, fine, chore money, and
   how the money is spent (the split); a settled week does not block the
   competition and gift." Settling closes a week's chores, routines, fines and
   split. It does not close its meets.

   It used to. The meeting's commit was the only thing that ever paid a meet,
   and `finalizedWeeks[wk][kid] == null` refuses a second commit — so a meet
   entered for a week already settled (at a meeting, by the Grandma rule, by
   the repair) sat on file and was never paid. The trap the repair describes
   in js/40-stream.js, from the other side.

   So a meet added, corrected or deleted for a settled week moves her cash at
   once, as its own labelled line on the meet's own date, exactly as a gift
   dated into a settled week does. WHERE it goes is decided at the next
   still-open meeting: the line is filed to that week (`mnyGiftWeekFor`) and
   `mnyPool` counts it there (`mnyLateCompTotal`).

   The settled week's own record is kept in step — its ledger competition,
   gross and net, and `finalizedWeeks`. That is not bookkeeping for its own
   sake: finalizedWeeks is what `evRepairPlanFor` measures a week's worth
   against, and left stale the repair would pay the same meet again as a gap.

   ONE owner, called by the three competition writers in js/18-rules.js through
   a typeof guard, and callable again with no change to catch a week up. A week
   that is NOT settled is left alone: the meeting's commit pays its meets, as
   it always has, and nothing is paid early.

   ── Why it cannot pay twice ──
   1. The week has a ledger row whose competition figure is the plain sum of
      its meets — a meeting, the Grandma rule, the repair. The row says what
      has been paid for meets; `mrCompetitionWeek` says what they are worth
      now; the DIFFERENCE moves and the row is brought to the new total. A
      second run finds nothing to do, and a meet that arrived from another
      device is caught up by the next run instead of being lost. The event id
      is the week, the kid, the row's count of late corrections (`lateSeq`) and
      the two totals — so two devices making the same correction from the same
      row write the SAME id, and the stream's union by id keeps one. An id
      already on the stream means the money moved and only the row missed it:
      the row catches up and nothing moves. `lateSeq` is what stops a real
      repeat (add, delete, add again) from colliding with its own first time.
   2. No ledger row (a legacy or migrated week), or a competition figure a
      grown-up overrode at the table: there is no honest total to compare, so
      nothing is guessed from totals. The CHANGE is paid — this meet's award
      after the write minus before, from the owner that made the write — keyed
      on the meet's own id and that write ('add', 'del', or the opId
      markItemUpdated stamped), so one write is paid once. finalizedWeeks moves
      by the same amount.
   A week whose competition channel the honesty rule voided stays void.

   `change` is { comp, before, after, op, wasDayKey } from the writer, or
   nothing to re-run a week. A meet moved to another week is two changes:
   out of the old week, into the new. */
function mnyLateCompSync(kid, dayKey, change) {
  if (!kid || !dayKey) return 0;
  const ch = change || null;
  const wk = mnyWeekOfDay(dayKey);
  if (ch && ch.wasDayKey && mnyWeekOfDay(ch.wasDayKey) !== wk) {
    const out = mnyLateCompSync(kid, ch.wasDayKey, { comp: ch.comp, before: ch.before, after: 0, op: ch.op });
    return money2(out + mnyLateCompSync(kid, dayKey, { comp: ch.comp, before: 0, after: ch.after, op: ch.op }));
  }
  ctEnsureShared();
  const c = state.shared.chore;
  const fin = (c.finalizedWeeks || {})[wk];
  if (!fin || fin[kid] == null) return 0;
  const led = ((c.moneyLedger || {})[wk] || {})[kid] || null;
  if (led && (led.voided || []).indexOf('competition') >= 0) return 0;
  const byTotal = mnyLateCompByTotal(led);
  const comp = (ch && ch.comp) || null;
  let delta, id, target = 0;
  if (byTotal) {
    const have = money2(led.competition);
    target = mrCompetitionWeek(wk, kid).paid;
    delta = money2(target - have);
    id = 'ev-latecomp-' + kid + '-' + wk + '-' + (Number(led.lateSeq) || 0) + '-' + have + '-' + target;
  } else {
    if (!comp) return 0;
    delta = money2((Number(ch.after) || 0) - (Number(ch.before) || 0));
    id = 'ev-latecomp-' + kid + '-' + wk + '-' + comp.id + '-' + (ch.op || 'edit');
  }
  if (!delta) return 0;
  if (!evList(kid).some(e => e && e.id === id)) {
    const name = comp ? (comp.name || mnySportLabel(comp.sport)) : 'Competitions';
    const tail = delta < 0 ? 'taken back after the week was settled'
      : ((led && led.defaulted && led.defaultReason === 'grandma') ? 'on top of the Grandma rule'
                                                                   : 'paid after the week was settled');
    const common = { kind: 'latecomp', id, ref: comp ? comp.id : wk,
                     weekKey: mnyGiftWeekFor(kid, (comp && comp.dayKey) || wk),
                     note: name + ', week of ' + mnyShortDate(wk) + ' — ' + tail };
    if (delta > 0) moneyAddCash(kid, delta, Object.assign({ from: 'prize', dayKey: (comp && comp.dayKey) || wk }, common));
    else moneyTakeBackCash(kid, money2(-delta), Object.assign({ dayKey: todayKey() }, common));
  }
  if (led) {
    led.competition = byTotal ? target : money2(money2(led.competition) + delta);
    led.gross = money2(money2(led.gross) + delta);
    led.net = money2(money2(led.net) + delta);
    if (byTotal) led.lateSeq = (Number(led.lateSeq) || 0) + 1;
    led.updatedAt = syncNow();
  }
  fin[kid] = money2((Number(fin[kid]) || 0) + delta);
  if (typeof ctStampWeekState === 'function') ctStampWeekState(wk);
  saveAll();
  return delta;
}

/* What late meets brought into (or took out of) the pool this week decides:
   the `latecomp` lines filed to it. Read off the stream, which holds each one
   once by id however many devices wrote it. */
function mnyLateCompTotal(kid, weekKey) {
  if (typeof evList !== 'function') return 0;
  return money2(evList(kid).reduce((s, e) => {
    if (!e || e.kind !== 'latecomp' || e.weekKey !== weekKey) return s;
    if (e.to === 'cash') return s + (Number(e.amount) || 0);
    if (e.from === 'cash') return s - (Number(e.amount) || 0);
    return s;
  }, 0));
}

/* ── Older weeks whose meets were never paid — caught up once ──────
   mnyLateCompSync pays a meet the moment it is written into a settled week.
   A meet already on file when its week was settled by something that did not
   pay meets — an older build's default, or a meet that arrived from the other
   device after — has no write left to trigger it, and sits unpaid.

   So this LISTS them, for a parent to see before anything moves: every
   settled week whose ledger row the sync treats by total (mnyLateCompByTotal)
   and whose meets are worth more than the row says was paid for them. Only a
   positive gap is listed or paid — like the repair's rule 2, old history is
   never taken back. A week with no ledger row stays with the repair, and so
   does a week the repair itself lists: it re-prices the whole week, meets
   included, and the two lists must never offer the same dollars twice.
   Reads only. */
function mnyUnpaidMeetsPlanFor(kid) {
  ctEnsureShared();
  const c = state.shared.chore;
  const fin = c.finalizedWeeks || {};
  const repair = (typeof evRepairPlanFor === 'function') ? evRepairPlanFor(kid).weeks.map(w => w.wk) : [];
  const weeks = [];
  Object.keys(fin).sort().forEach(wk => {
    if ((fin[wk] || {})[kid] == null) return;
    const led = ((c.moneyLedger || {})[wk] || {})[kid] || null;
    if (!mnyLateCompByTotal(led) || repair.indexOf(wk) >= 0) return;
    const cw = mrCompetitionWeek(wk, kid);
    const gap = money2(cw.paid - money2(led.competition));
    if (!(gap > 0)) return;
    weeks.push({ wk, gap, names: cw.entries.map(e => e.name || mnySportLabel(e.sport)) });
  });
  return { kid, weeks, total: money2(weeks.reduce((s, w) => s + w.gap, 0)) };
}
function mnyUnpaidMeetsPlan() { return ['jenn', 'jess'].map(mnyUnpaidMeetsPlanFor); }
/* Pays through the sync's own no-change mode, never around it: it brings each
   row to its total, so a second run — here, on a re-tap, or on the other
   device — finds nothing to pay. The plan is re-read here rather than handed
   in, so a week that stopped owing since the preview pays nothing. */
function mnyPayUnpaidMeets() {
  let paid = 0, weeks = 0;
  mnyUnpaidMeetsPlan().forEach(p => p.weeks.forEach(w => {
    const moved = mnyLateCompSync(p.kid, w.wk);
    if (moved > 0) { paid = money2(paid + moved); weeks++; }
  }));
  return { paid, weeks };
}

function mnyEnsureDeposits(kid) {
  const p = getProfData(kid);
  if (!Array.isArray(p.deposits)) p.deposits = [];
  return p.deposits;
}
function mnyDepositsForWeek(kid, weekKey) {
  return mnyEnsureDeposits(kid).filter(d => d.weekKey === weekKey);
}
/* ── Money from outside, recorded when it actually arrives ─────────
   A red pocket arrives at a birthday or at New Year, not on a Sunday, so this
   no longer waits for the week's commit: it credits the wallet at once and
   stamps appliedAt there and then. The commit loop already skips a stamped
   deposit, so it cannot be credited twice and no new idempotence machinery is
   needed.

   ALWAYS DATED TODAY, into the CURRENT week. Back-dating into a committed week
   would reopen a week whose split has already run, and this function calls
   mnyReopenWeek on every add.

   THE PARENT GATE IS NEW AND IS LOAD-BEARING. This was the one money mutator in
   the app with no isParent() check, which was safe only while it lived behind
   the meeting. On a kid-visible page that credits immediately, its absence
   would let a child hand herself any sum. A child may now PROPOSE one — the
   same pendingApproval + addedBy idiom a kid-created activity and a custom task
   already use — and it credits nothing until a grown-up approves it. */
function mnyAddDeposit(kid, weekKey, fields) {
  const proposed = !isParent();
  const d = Object.assign({
    id: mrNewId('dep-'), weekKey, amount: 0, from: MNY_FROM[0], giver: '',
    dayKey: todayKey(), appliedAt: null, createdAt: syncNow(), updatedAt: syncNow(),
  }, fields || {});
  /* The week follows the DAY, not the caller's idea of "this week". A caller
     that passes no dayKey still gets today's week, so nothing that already
     works changes; a dated gift is filed where it belongs, and one dated into a
     settled week is decided at the next open meeting instead of belonging
     nowhere. */
  d.weekKey = mnyGiftWeekFor(kid, d.dayKey);
  d.amount = money2(d.amount);
  if (!(d.amount > 0)) return null;
  d.giver = String(d.giver || '').trim().slice(0, 40);
  if (proposed) {
    d.addedBy = (typeof activeProfile === 'function') ? activeProfile() : kid;
    d.pendingApproval = true;
  } else {
    // A grown-up's own entry needs no approval and lands at once.
    moneyAddCash(kid, d.amount, mnyGiftMirror(d));
    d.appliedAt = Date.now();
  }
  mnyEnsureDeposits(kid).push(d);
  mnyReopenWeek(kid, weekKey);
  saveAll();
  return d;
}

/* A parent's answer to a child's proposal. Approval is the single moment the
   money moves, stamped so a re-merge cannot credit it twice. */
function mnyApproveDeposit(kid, depositId) {
  if (!isParent()) { showToast('A grown-up approves this 🔒'); return false; }
  const d = mnyEnsureDeposits(kid).find(x => x.id === depositId);
  if (!d || !d.pendingApproval) return false;
  delete d.pendingApproval;
  if (!d.appliedAt) { moneyAddCash(kid, d.amount, mnyGiftMirror(d)); d.appliedAt = Date.now(); }
  markItemUpdated(d);
  mnyReopenWeek(kid, d.weekKey);
  saveAll();
  return true;
}

/* The stream event a gift wrote, found by the id it carries as `ref`. A
   correction has to reverse THE MOVEMENT THAT HAPPENED, not write an opposite
   one and hope the two cancel — the second leaves the original unmarked, so the
   history shows two unrelated rows and nothing says one undid the other. */
function mnyGiftEvent(kid, depositId) {
  if (typeof evList !== 'function') return null;
  const rows = evList(kid).filter(e => e && e.ref === depositId && e.kind === 'gift');
  // The newest un-reversed one: a gift edited twice has a chain behind it.
  const reversed = new Set(evList(kid).map(e => e && e.reverses).filter(Boolean));
  const live = rows.filter(e => !reversed.has(e.id));
  return live.length ? live[live.length - 1] : null;
}

/* ── EDITING A GIFT ────────────────────────────────────────────────
   There was no edit path at all: a typo meant delete-and-retype, which debited
   her wallet and re-credited it, and left two unexplained rows in the history.

   An applied gift moves the wallet by the DIFFERENCE only, and the stream
   records it as a reversal plus a new movement — so a child asking "what
   happened to my $50" sees both the entry and its correction rather than a
   history that quietly lost its mistake. A gift still waiting on a grown-up has
   moved nothing, so it simply edits. */
function mnyEditDeposit(kid, depositId, fields) {
  if (!isParent()) { showToast('A grown-up records this 🔒'); return false; }
  const d = mnyEnsureDeposits(kid).find(x => x.id === depositId);
  if (!d) return false;
  const f = fields || {};
  const wasAmount = money2(d.amount);
  const wasApplied = !!d.appliedAt;

  if (f.amount != null) {
    const next = money2(f.amount);
    if (!(next > 0)) { showToast('An amount, like 20'); return false; }
    d.amount = next;
  }
  if (f.from != null) d.from = f.from;
  if (f.giver != null) d.giver = String(f.giver).trim().slice(0, 40);
  if (f.dayKey) {
    d.dayKey = f.dayKey;
    d.weekKey = mnyGiftWeekFor(kid, f.dayKey);
  }
  markItemUpdated(d);

  if (wasApplied) {
    /* THE WALLET MOVES BY THE DIFFERENCE, AND SO DOES THE STREAM.

       The first attempt reversed the original event in full and then moved the
       wallet by the delta — two different amounts, so the derived balance fell
       behind the stored one by the whole gift. A full reversal is not what an
       edit IS: $50 corrected to $30 is a twenty-dollar adjustment, not a
       fifty-dollar undo followed by a thirty-dollar re-gift.

       The original row stays exactly as written, which is what keeps the
       mistake readable; the correction sits beside it saying what changed. */
    const delta = money2(d.amount - wasAmount);
    const note = 'Corrected to ' + mnyMoney(d.amount) + ' — ' + mnyGiftLabel(d);
    if (delta > 0) {
      moneyAddCash(kid, delta, { kind: 'correction', from: 'gift', ref: d.id,
                                 dayKey: d.dayKey, weekKey: d.weekKey, note });
    } else if (delta < 0) {
      moneyTakeBackCash(kid, money2(-delta), {
        kind: 'correction', ref: d.id, dayKey: todayKey(), note });
    }
  }
  mnyReopenWeek(kid, d.weekKey);
  saveAll();
  return true;
}

function mnyRemoveDeposit(kid, depositId) {
  if (!isParent()) { showToast('A grown-up records this 🔒'); return false; }
  const list = mnyEnsureDeposits(kid);
  const i = list.findIndex(d => d.id === depositId);
  if (i < 0) return false;
  const [gone] = list.splice(i, 1);
  /* If it already reached the wallet, taking the record away has to take the
     money with it. A removal that left the cash behind would be a gift that
     exists only as a number nobody can account for. */
  if (gone.appliedAt) {
    /* Labels only, through the one writer that owns a debit from cash.
       `moneyTakeBackCash` mirrors WHAT ACTUALLY LEFT — it floors at zero, so a
       gift already spent gives back only what is there — and that floor is
       exactly why this cannot be an `evReverse`: a reversal copies the
       original's amount, so removing a spent gift would debit the stream by
       more than the wallet could give back and the two would disagree forever.

       `reverses` still rides along when the whole gift came back, so the
       original row is MARKED as undone rather than left standing beside a debit
       that looks unrelated. When the floor bit, it is genuinely a partial
       correction and does not claim to be a reversal. */
    const orig = mnyGiftEvent(kid, gone.id);
    const w = ensureWallet(kid);
    const whole = money2(w.cash) >= money2(gone.amount);
    moneyTakeBackCash(kid, gone.amount, Object.assign(
      { kind: 'correction', ref: gone.id, dayKey: todayKey(),
        note: 'Gift removed — ' + mnyGiftLabel(gone) },
      (orig && whole) ? { reverses: orig.id } : {}));
  }
  ensureTombstones()['dep:' + gone.id] = Date.now();
  if (gone.weekKey) mnyReopenWeek(kid, gone.weekKey);
  saveAll();
  return true;
}

/* Waiting on a grown-up. Read by the gifts section and by the parent's pending
   list, the same shape pendingApprovalActs and pendingApprovalTasks have. */
function mnyPendingDeposits(kid) {
  return mnyEnsureDeposits(kid).filter(d => d && d.pendingApproval);
}
/* What actually came in. A gift a child has PROPOSED is not money yet — nobody
   has agreed it — so it is left out of the pool and out of the caps the pool
   sizes. Counting it would let an unapproved number raise the spend and stock
   ceilings before a grown-up had seen it. */
function mnyDepositTotal(kid, weekKey) {
  return money2(mnyDepositsForWeek(kid, weekKey)
    .filter(d => !d.pendingApproval)
    .reduce((s, d) => s + money2(d.amount), 0));
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
  { key: 'streak',   icon: '🔥', label: 'Routines kept — morning, afternoon, evening' },
  { key: 'comp',     icon: '🏆', label: 'Competition days' },
  { key: 'fines',    icon: '⚖️', label: 'Taken off' },
];

function mnyOverrides(kid, weekKey) {
  const e = mrEnsureEarnings(kid, weekKey);
  if (!e.overrides) e.overrides = {};
  return e.overrides;
}
/* ── When a grade no longer decides the money ──
   An override replaces a channel's figure AFTER mrWeekBreakdown has summed the
   thing it came from. That is deliberate — a grown-up gets the last word — but
   it leaves two surfaces still showing the working: the parent portal's graded
   list and the meeting's step 1. Both used to present those grades as live
   when they no longer added up to anything anyone would be paid.

   This is the one reader they share, so the notice can't drift between them.
   Returns null when the channel is untouched. */
function mnyOverrideNotice(kid, weekKey, channel) {
  const ov = mnyOverrides(kid, weekKey)[channel];
  if (!ov) return null;
  const label = (MNY_CHANNELS.find(c => c.key === channel) || {}).label || channel;
  return {
    channel, label,
    value: money2(ov.value),
    reason: ov.reason ? mnyReasonLabel(ov.reason) : '',
    text: `This week's ${label.toLowerCase()} total was changed at the meeting to `
        + `${mnyMoney(ov.value)} — the marks below no longer decide it.`
        + (ov.reason ? ` Reason: ${mnyReasonLabel(ov.reason)}.` : ''),
  };
}
/* The notice as a banner, with a way through to where the change was made
   (step 3, chores row expanded) rather than just a warning to live with. */
function mnyOverrideBanner(kid, weekKey, channel) {
  const n = mnyOverrideNotice(kid, weekKey, channel);
  if (!n) return '';
  return `<div class="mny-override-note">
      <span>✏️ ${escapeHtml(n.text)}</span>
      <button type="button" class="mny-chip"
        onclick="mnyShowTheChange('${escapeJsAttr(kid)}','${escapeJsAttr(channel)}')">See the change</button>
    </div>`;
}
/* Open the meeting on step 3 with that channel's working expanded — the one
   place the override, its original figure and its reason all sit together. */
function mnyShowTheChange(kid, channel) {
  if (typeof mnySetMeetKid === 'function') mnySetMeetKid(kid);
  mnyExpandRow = channel;
  if (!(typeof mmIsOpen === 'function' && mmIsOpen())) {
    if (typeof openFamilyMeeting === 'function') openFamilyMeeting();
  }
  if (typeof mmGoStep === 'function') mmGoStep(3);
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
  // syncNow: mergeSharedChore arbitrates weekConfirms on this stamp against
  // reopenedAt, which is already corrected — two clocks cannot be compared.
  c.weekConfirms[weekKey][kid] = { by: by || 'a grown-up', at: syncNow(), reopenedAt: null,
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
  s.reopenedAt = syncNow();
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
  c.weekPlans[weekKey][kid] = Object.assign({}, prev, plan, { updatedAt: syncNow() });
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
/* ── Paying less than the schedule asks ──
   The scheduled payment is what the loan agreement says. It is not a law of
   physics: a family sitting at the table can decide to pay less this month,
   and the whole point of the meeting is to see what that costs before saying
   yes. An override is per-week and per-debt, parent-set, and never silently
   forgiven — the shortfall still runs through the arrears the rules define.

   Stored beside the earnings overrides so it freezes into the week's ledger
   with everything else that was decided that Sunday. */
function mnyPaymentOverrides(kid, weekKey) {
  const e = mrEnsureEarnings(kid, weekKey);
  if (!e.paymentOverrides) e.paymentOverrides = {};
  return e.paymentOverrides;
}
function mnyGetPaymentOverride(kid, weekKey, debtId) {
  const v = mnyPaymentOverrides(kid, weekKey)[debtId];
  return v == null ? null : money2(v);
}
function mnySetPaymentOverride(kid, weekKey, debtId, amount) {
  if (!isParent()) { showToast('A grown-up changes the payment 🔒'); return false; }
  const ov = mnyPaymentOverrides(kid, weekKey);
  if (amount == null) delete ov[debtId];
  else ov[debtId] = money2(Math.max(0, amount));
  mrStampEarnings(kid, weekKey);
  saveAll();
  return true;
}
/* What each debt is actually being paid this week: the schedule, or the
   agreed-down figure. One reader, so the pool, the card and the commit can't
   disagree about the number. */
function mnyDueThisWeek(kid, weekKey) {
  return mnyDueNowAll(kid).map(d => {
    const ov = mnyGetPaymentOverride(kid, weekKey, d.debt.id);
    const amount = ov == null ? money2(d.amount) : money2(Math.min(ov, d.amount));
    return Object.assign({}, d, { scheduled: money2(d.amount), amount, reduced: ov != null && amount < money2(d.amount) });
  });
}

function mnyPool(weekKey, kid) {
  const b = mrWeekBreakdown(weekKey, kid);
  const deposits = mnyDepositTotal(kid, weekKey);
  /* A meet paid after its own week was settled is already in her cash, like a
     gift; this is the meeting that decides where it goes. A correction down
     can make it negative, and the pool never is. */
  const lateComp = mnyLateCompTotal(kid, weekKey);
  const cameIn = money2(Math.max(0, b.net + deposits + lateComp));
  // The schedule draws on the whole pool, like any real payment does.
  const due = mnyDueThisWeek(kid, weekKey);
  const dueTotal = money2(due.reduce((s, d) => s + money2(d.amount), 0));
  const scheduledTotal = money2(due.reduce((s, d) => s + money2(d.scheduled), 0));
  const mustPay = money2(Math.min(dueTotal, cameIn));
  const mine = money2(Math.max(0, cameIn - mustPay));
  return {
    breakdown: b, deposits, lateComp, cameIn, mustPay, mine, due,
    scheduledPay: scheduledTotal,
    // What the family agreed NOT to pay this month. It does not vanish — the
    // debt still carries it, and arrears still apply.
    unpaid: money2(Math.max(0, scheduledTotal - dueTotal)),
    // Investing is capped at a fifth of the week: a bad month should sting,
    // not wipe out everything she earned.
    stockCap: money2(mine * 0.2),
    // Spending is capped the same way — see MNY_BUCKETS 'spend'.
    spendCap: money2(mine * 0.2),
  };
}

/* ── Pricing a plan ──
   Turn a plan (or a hand-built split) into dollars per bucket, then into what
   it actually does to the debt. `split` keys are 'loan:<debtId>', 'ready',
   'gic', 'stock'. */
function mnySplitFor(weekKey, kid, planId, own) {
  const pool = mnyPool(weekKey, kid);
  const debts = mnyDebtsByPriority(kid).filter(d => loanBalance(kid, d.id) > 0);
  const out = { ready: 0, gic: 0, stock: 0, spend: 0 };
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
      if (bucket && !mnyIsOpen(kid, bucket.stage)) {
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
      const give = money2(Math.min(left, mnyCashToClear(kid, d)));
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
    { label: 'Routines kept',  value: b.streakBonus,  color: '#ffd166' },
    { label: 'Competitions',   value: b.compPaid,     color: '#ff9eb5' },
    { label: 'From outside',   value: pool.deposits,  color: '#c9a6e8' },
    { label: 'Made on its own', value: Math.max(0, passive), color: '#b8b0a2' },
  ]);
  out.fines = money2(b.fines.total);
  out.passive = passive;
  /* ── The bar's total is NOT the pool's "money that came in" ──
     The bar adds up what landed: every positive channel, gifts, and what her
     holdings gained. The pool counts spendable cash: fines already taken off,
     and no holding growth, because unrealised value is not money a plan can
     move. Both are right; they answer different questions.

     They are carried side by side here so no screen has to work out the
     difference for itself — that is exactly how the same phrase came to show
     two different figures on the kid page and at the meeting. The identity
     every surface can rely on:

         total − fines − max(0, passive) === cameIn                          */
  out.cameIn = pool.cameIn;
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
  rows.push({ label: 'Spent',        value: money2(s.spend), color: '#ff9eb5' });
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
/* ── THE GATE'S NUMBER — one reader ──
   The share of all debt paid off that opens a stage. The live rulebook first
   (`school.stagePct`), then MR_DEFAULT_RULES per key — so a rulebook stored
   before the field existed, or one that holds only some of the stages, gets
   the defaults for the rest without anything being migrated. The first stage
   is 0 whatever is stored: something has to be open with nothing paid. */
function mnyStagePct(stageId, rules) {
  const i = mnyStageIndexOf(stageId);
  if (i === 0) return 0;
  if (i < 0) return 100;                          // an unknown stage opens last, never first
  const live = (((rules || mrRules()).school || {}).stagePct || {})[stageId];
  const fallback = ((MR_DEFAULT_RULES.school || {}).stagePct || {})[stageId];
  const n = Number(live != null && live !== '' ? live : fallback);
  return isFinite(n) ? Math.max(0, Math.min(100, n)) : 100;
}
function mnyStageIndexOf(stageId) { return MNY_STAGES.findIndex(s => s.id === stageId); }
function mnyStageIndex(kid) {
  const pct = mnyPaidPct(kid);
  const r = mrRules();
  let idx = 0;
  MNY_STAGES.forEach((s, i) => { if (pct >= mnyStagePct(s.id, r)) idx = i; });
  return Math.min(MNY_STAGES.length - 1, Math.max(idx, mnyUnlockOverride(kid)));
}
function mnyStage(kid) { return MNY_STAGES[mnyStageIndex(kid)]; }
/* Is a thing behind this STAGE open yet? Compared by position on the ladder,
   never by percent, so a pot, its lesson and its ladder row are one answer. */
function mnyIsOpen(kid, stageId) {
  const i = mnyStageIndexOf(stageId);
  return i >= 0 && i <= mnyStageIndex(kid);
}
function mnyNeedLabel(stageId) { return 'Opens at ' + mnyStagePct(stageId) + '% paid off'; }

/* The concept card, with the real debt named in it. */
function mnyConceptCard(id, kid) {
  const c = mnyConceptById(id);
  if (!c) return null;
  const names = mnyDebts(kid).map(d => d.name);
  const naming = names.length ? names.join(' and ') : 'your loan';
  const swap = (s) => String(s || '').replace(/\{debt\}/g, naming);
  return {
    id: c.id, icon: c.icon, title: c.title, stage: c.stage,
    open: mnyIsOpen(kid, c.stage),
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
  if (!(typeof mmIsOpen === 'function' && mmIsOpen())) openFamilyMeeting();
  mmGoStep(id === 'grow' ? 3 : 4);
}

/* The bar itself. `cur` is the tab that is showing, and it is not a link. */
/* Which of the five pages this viewer should be offered.

   A kid was being shown all five, numbered, each wearing a badge telling her
   whose page it was — three of them labelled MEETING or PARENT, i.e. three
   things she is being shown and told she may not use. That reads as a locked
   door on her own money page. She gets the two that are hers; a grown-up and the
   meeting still get the whole rail, because for them it IS the map.

   Filtering only. Same components, same routes, same numbering source — the
   meeting pages still explain themselves if she arrives from elsewhere. */
function mnyTabsFor() {
  const parentish = (typeof isParent === 'function' && isParent()) ||
                    (typeof mmIsOpen === 'function' && mmIsOpen());
  if (parentish) return MNY_TABS;
  return MNY_TABS.filter(t => t.who === 'kid' || t.who === 'optional');
}
function mnyTabBar(cur) {
  const tabs = mnyTabsFor();
  // Numbering comes from the full table, so "1" and "5" mean the same thing to a
  // kid and a parent looking at the same system.
  const label = tabs.length === MNY_TABS.length ? 'The five money pages' : 'Your money pages';
  return `<nav class="mny-tabs" aria-label="${escapeAttr(label)}">${tabs.map((t) => {
    const sel = t.id === cur;
    const n = MNY_TABS.indexOf(t) + 1;
    return `<button type="button" class="mny-tab${sel ? ' on' : ''}"${sel ? ' aria-current="page"' : ''}
        data-mny-action="tab" data-mny-tab="${t.id}">
        <span>${n} ${t.icon} ${escapeHtml(t.label)}</span>
        ${t.who === 'kid' || t.who === 'optional' ? '' : `<span class="mny-tab-tag">${escapeHtml(t.who)}</span>`}
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
  return ctThisWeekKey();
}

// Inert in the browser; lets tests run these helpers in Node.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MNY_STAGES, MNY_PLANS, MNY_BUCKETS, MNY_CONCEPTS };
}
