// Weekly-Planner — the wallet: cash, and the transactions that move it.
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   THE WALLET, AND THE TRANSACTIONS THAT MOVE IT

   Cash lives here. Everything else she owns lives as one record per holding
   in js/21-money-data.js, which a parent keeps truthful by hand — there is no
   market simulation any more, because a share being worth whatever the Money
   rules page says it is worth is both simpler to explain and closer to how it
   actually works.

   STOCKS_2023 survives as real history: the "companies go down too" chart on
   the meeting's decision step draws one genuine year, because a company that
   only ever goes up is not a lesson about companies. All amounts display in
   CAD (USD names converted at ~1.35 so everything is one currency for kids).
   ════════════════════════════════════════════════════════════════ */
const MONEY_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// Real 2023 monthly closes, normalized to CAD (USD names × ~1.35, rounded).
const STOCKS_2023 = {
  SU:   { name: 'Suncor', emoji: '🛢️', prices: [45,44,41,43,40,41,46,47,50,45,42,43] },
  TSLA: { name: 'Tesla',  emoji: '🚗', prices: [234,277,279,221,274,352,360,348,338,270,324,335] },
  AAPL: { name: 'Apple',  emoji: '🍎', prices: [194,198,223,230,239,262,265,254,231,231,255,259] },
  COST: { name: 'Costco', emoji: '🛒', prices: [675,655,675,678,682,726,752,755,761,745,799,891] },
};
const BANK_DEFAULTS = { savingsRate: 0.015, gicRates: { 3: 0.030, 6: 0.035, 12: 0.040 } };

function money2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function bankConfig() {
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.bank) c.bank = { savingsRate: BANK_DEFAULTS.savingsRate, gicRates: { ...BANK_DEFAULTS.gicRates }, marketMonth: 0 };
  if (c.bank.marketMonth == null) c.bank.marketMonth = 0;
  if (c.bank.savingsRate == null) c.bank.savingsRate = BANK_DEFAULTS.savingsRate;
  if (!c.bank.gicRates) c.bank.gicRates = { ...BANK_DEFAULTS.gicRates };
  // Anchor the sim clock to the real calendar the first time it runs, so the
  // date starts at "this month, this year" and advances with each meeting —
  // instead of being permanently stuck at "Jan 2023".
  if (c.bank.startYear == null || c.bank.startMonth == null) {
    const now = new Date();
    c.bank.startYear = now.getFullYear();
    c.bank.startMonth = now.getMonth();
  }
  return c.bank;
}
function ensureWallet(kid) {
  const p = getProfData(kid);
  if (!p.wallet) p.wallet = { cash: 0, savings: 0, gics: [], holdings: {}, lastMeetingWeek: null };
  if (!Array.isArray(p.wallet.gics)) p.wallet.gics = [];
  if (!p.wallet.holdings) p.wallet.holdings = {};
  return p.wallet;
}
function stockPrice(ticker, monthOverride) {
  const cfg = bankConfig();
  const simMonth = (monthOverride != null ? monthOverride : cfg.marketMonth);
  const m = ((cfg.startMonth + simMonth) % 12 + 12) % 12;
  return STOCKS_2023[ticker].prices[m];
}
function marketMonthLabel() {
  const cfg = bankConfig();
  const total = cfg.startMonth + cfg.marketMonth;
  const year = cfg.startYear + Math.floor(total / 12);
  return MONEY_MONTHS[((total % 12) + 12) % 12] + ' ' + year;
}
/* What she owns now lives in one record per holding (js/21-money-data.js), so
   a parent can keep it truthful by hand instead of a simulation deciding for
   them. These four keep their old names because half the app calls them. */
function portfolioValue(kid) { return mnyInvestedTotal(kid); }
function gicTotal(kid) { return mnyLockedTotal(kid); }
function savingsTotal(kid) { return mnySavedTotal(kid); }
function netWorth(kid) { return mnyEverything(kid); }

/* ── Transactions (each guards against overdraw; returns true on success) ── */
function moneyDeposit(kid, amount) {          // cash → kept ready
  const w = ensureWallet(kid); amount = money2(Math.min(amount, w.cash));
  if (amount <= 0) return false;
  w.cash = money2(w.cash - amount); mnyAddToSaved(kid, amount); saveAll(); return true;
}
function moneyAddCash(kid, amount) {          // extra cash from outside chores → wallet cash
  const w = ensureWallet(kid); amount = money2(amount);
  if (!(amount > 0)) return false;
  w.cash = money2(w.cash + amount); saveAll(); return true;
}
function moneyWithdraw(kid, amount) {         // kept ready → cash (two-way)
  const w = ensureWallet(kid); amount = money2(Math.min(amount, mnySavedTotal(kid)));
  if (amount <= 0) return false;
  const took = mnyTakeFromSaved(kid, amount);
  w.cash = money2(w.cash + took); saveAll(); return true;
}
function moneyOpenGIC(kid, amount, termMonths) {   // cash → locked away
  const w = ensureWallet(kid); amount = money2(Math.min(amount, w.cash));
  const term = termMonths || 12;
  if (amount <= 0 || ![3, 6, 12].includes(term)) return false;
  const cfg = bankConfig();
  const rate = cfg.gicRates[term] || 0.03;
  w.cash = money2(w.cash - amount);
  const matures = formatDayKey(todayKey());
  matures.setMonth(matures.getMonth() + term);
  mnyAddHolding(kid, { kind: 'gic', name: 'Locked away for a year', units: 1,
                       priceNow: amount, costBasis: amount, rateAnnual: rate,
                       termMonths: term, maturesOn: ctDateToKey(matures) });
  saveAll(); return true;
}
function moneyBuyStock(kid, ticker, dollars) {     // cash → a bit of a company
  const w = ensureWallet(kid); dollars = money2(Math.min(dollars, w.cash));
  if (dollars <= 0 || !STOCKS_2023[ticker]) return false;
  const price = stockPrice(ticker);
  w.cash = money2(w.cash - dollars);
  const held = mnyHoldingsOfKind(kid, 'stock').find(h => h.ticker === ticker);
  if (held) {
    held.units = (Number(held.units) || 0) + dollars / price;
    held.priceNow = money2(price);
    held.costBasis = money2(money2(held.costBasis) + dollars);
    held.updatedAt = Date.now();
  } else {
    mnyAddHolding(kid, { kind: 'stock', name: STOCKS_2023[ticker].name, ticker,
                         units: dollars / price, priceNow: money2(price), costBasis: dollars });
  }
  saveAll(); return true;
}
function moneySellStock(kid, ticker, shares) {     // a bit of a company → cash
  const w = ensureWallet(kid);
  const held = mnyHoldingsOfKind(kid, 'stock').find(h => h.ticker === ticker);
  if (!held) return false;
  const have = Number(held.units) || 0;
  shares = Math.min(shares, have);
  if (shares <= 1e-9) return false;
  const price = money2(held.priceNow) || stockPrice(ticker);
  const proceeds = money2(shares * price);
  // Cost comes off in proportion, so what is left still knows what it cost.
  held.costBasis = money2(money2(held.costBasis) * (1 - shares / have));
  held.units = have - shares;
  held.updatedAt = Date.now();
  if (held.units < 1e-9) mnyRemoveHolding(kid, held.id);
  w.cash = money2(w.cash + proceeds); saveAll(); return true;
}

/* One month on. Interest lands on what is kept ready, and anything locked away
   that has reached its date pays out. There is no market simulation any more:
   a share is worth what the Money rules page says it is worth, which is both
   simpler and closer to how it really works.
   Returns a summary for the meeting recap. Called once per weekly meeting. */
function moneyAdvanceMonth(kid) {
  const w = ensureWallet(kid);
  let interest = 0;
  mnyHoldingsOfKind(kid, 'savings').forEach(h => {
    const add = money2(mnyHoldingValue(h) * ((Number(h.rateAnnual) || 0) / 12));
    if (!(add > 0)) return;
    h.units = 1;
    h.priceNow = money2(mnyHoldingValue(h) + add);
    h.updatedAt = Date.now();
    interest = money2(interest + add);
  });
  const maturedList = [];
  const today = todayKey();
  mnyHoldingsOfKind(kid, 'gic').slice().forEach(h => {
    if (!h.maturesOn || String(h.maturesOn) > String(today)) return;
    const value = mnyHoldingValue(h);
    const payout = money2(value * (1 + (Number(h.rateAnnual) || 0)));
    w.cash = money2(w.cash + payout);
    maturedList.push({ amount: value, payout, termMonths: h.termMonths || 12 });
    mnyRemoveHolding(kid, h.id);
  });
  saveAll();
  return { interest, matured: maturedList };
}

/* Kids may look at what they own on 💰 My money; every function that moves it
   is parent-only. This is the guard the old bank screen enforced, kept because
   the commit path and the rules page both still lean on it. */
function moneyCanTransact() {
  if (!isParent()) { showToast('A grown-up moves the money 🔒'); return false; }
  return true;
}
