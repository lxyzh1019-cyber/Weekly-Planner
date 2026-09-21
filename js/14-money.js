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
/* ── The market clock runs on the calendar, not on attendance ──
   marketMonth used to be incremented once per meeting, which quietly made the
   share prices a count of how many Sundays the family showed up. Two costs:
   settling three missed weeks in one evening moved the market three months in
   one evening, and a family that met every week saw a different year of prices
   than a family that met fortnightly — for the same year.

   Derived from the anchor instead, so the market moves with real time whether
   or not anyone met. Monotonic on purpose: it never steps backwards, so a
   device with a wrong clock cannot rewind a price a kid has already been
   shown. */
function bankMarketMonthForToday() {
  const cfg = bankConfig();
  const now = new Date();
  return Math.max(0, (now.getFullYear() - cfg.startYear) * 12 + (now.getMonth() - cfg.startMonth));
}
function bankSyncMarketMonth() {
  const cfg = bankConfig();
  const next = bankMarketMonthForToday();
  if (next > cfg.marketMonth) cfg.marketMonth = next;
  return cfg.marketMonth;
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
/* What she owns now lives in one record per holding (js/21-money-data.js), so
   a parent can keep it truthful by hand instead of a simulation deciding for
   them. These four keep their old names because half the app calls them. */
function portfolioValue(kid) { return mnyInvestedTotal(kid); }
function gicTotal(kid) { return mnyLockedTotal(kid); }
function savingsTotal(kid) { return mnySavedTotal(kid); }
function netWorth(kid) { return mnyEverything(kid); }

/* ── Transactions (each guards against overdraw; returns true on success) ── */
/* ── Shadow writes into the money stream ──
   Stage 1 of the money redesign: every function below that moves a dollar also
   records WHERE IT CAME FROM AND WHERE IT WENT in js/40-stream.js, beside the
   stored balance it has always written. Nothing reads the stream yet; the
   point is to prove the two agree (evShadowDrift) before the stored balance is
   retired. `evMirror` swallows its own failures deliberately — a mirror that
   could break a real money write would be worse than no mirror.

   `opts.kind`/`opts.ref`/`opts.note` let a caller say what the movement WAS
   ("the week of 7 Sep settled", "Grandma's red pocket"), which is the whole
   thing the old wallet could not say.

   A caller may LABEL a movement; it may never REDIRECT one. The fields each
   function owns — which pot the money left, which it arrived in, how much — are
   applied AFTER `opts`, so they always win. Spread the other way round and
   `mnyRemoveDeposit` passing `from: 'gift'` turns a debit from her cash into a
   movement that never touches cash at all: the wallet drops $50 and the stream
   does not, silently, for ever. That is not hypothetical — it is what
   `theMoneyStreamAgreesWithTheWallet` caught on the first run. */
function moneyDeposit(kid, amount, opts) {          // cash → kept ready
  const w = ensureWallet(kid); amount = money2(Math.min(amount, w.cash));
  if (amount <= 0) return false;
  w.cash = money2(w.cash - amount); mnyAddToSaved(kid, amount);
  evMirror(kid, Object.assign({ kind: 'ready' }, opts || {}, { from: 'cash', to: 'ready', amount }));
  saveAll(); return true;
}
function moneyAddCash(kid, amount, opts) {          // extra cash from outside chores → wallet cash
  const w = ensureWallet(kid); amount = money2(amount);
  if (!(amount > 0)) return false;
  w.cash = money2(w.cash + amount);
  /* `from` defaults to 'earned' only because most callers are the weekly
     settlement. A gift, a prize or a migration opening passes its own source —
     an unlabelled dollar is exactly what made "where did the $50 go"
     unanswerable in the first place. */
  evMirror(kid, Object.assign({ kind: 'in', from: 'earned' }, opts || {}, { to: 'cash', amount }));
  saveAll(); return true;
}
/* The inverse of moneyAddCash, and the ONLY caller is a gift being taken back
   after it already reached the wallet. Floored at zero: taking a record away
   must never invent a debt the child then has to work off. If the cash is
   already spent the floor absorbs it, which is the honest outcome — the money
   is gone, and pretending otherwise would put her in the red for a parent's
   correction. */
function moneyTakeBackCash(kid, amount, opts) {
  const w = ensureWallet(kid); amount = money2(amount);
  if (!(amount > 0)) return false;
  const before = money2(w.cash);
  w.cash = money2(Math.max(0, w.cash - amount));
  /* Mirror what ACTUALLY left, not what was asked for: the floor above can
     absorb part of it, and a stream line for money that never moved would put
     the derived balance permanently below the stored one. */
  /* BOTH ends are this function's to name, not just the one it leaves. A gift
     being taken back passes the gift's own mirror fields as a label, and while
     `to` was left caller-settable that made the movement cash → cash: a
     self-transfer, net zero, and the debit never happened. If a function owns
     the movement it owns every part of it. */
  evMirror(kid, Object.assign({ kind: 'out' }, opts || {},
                              { from: 'cash', to: 'returned',
                                amount: money2(before - w.cash) }));
  saveAll(); return true;
}
function moneyWithdraw(kid, amount, opts) {         // kept ready → cash (two-way)
  const w = ensureWallet(kid); amount = money2(Math.min(amount, mnySavedTotal(kid)));
  if (amount <= 0) return false;
  const took = mnyTakeFromSaved(kid, amount);
  w.cash = money2(w.cash + took);
  evMirror(kid, Object.assign({ kind: 'move' }, opts || {}, { from: 'ready', to: 'cash', amount: money2(took) }));
  saveAll(); return true;
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
  evMirror(kid, { kind: 'locked', from: 'cash', to: 'locked', amount,
                  note: term + '-month lock' });
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
    held.updatedAt = syncNow();
  } else {
    mnyAddHolding(kid, { kind: 'stock', name: STOCKS_2023[ticker].name, ticker,
                         units: dollars / price, priceNow: money2(price), costBasis: dollars });
  }
  evMirror(kid, { kind: 'invest', from: 'cash', to: 'invest', amount: dollars,
                  note: STOCKS_2023[ticker].name });
  saveAll(); return true;
}
function moneySellStock(kid, ref, shares) {        // a bit of a company → cash
  // `ref` is a holding id or a ticker: a company a parent typed in by hand has
  // no ticker, and it must be as sellable as one from the price table.
  const w = ensureWallet(kid);
  const held = mnyHoldingsOfKind(kid, 'stock').find(h => h.id === ref || (h.ticker && h.ticker === ref));
  if (!held) return false;
  const have = Number(held.units) || 0;
  shares = Math.min(shares, have);
  if (shares <= 1e-9) return false;
  const price = money2(held.priceNow) || (held.ticker ? stockPrice(held.ticker) : 0);
  if (!(price > 0)) return false;
  const proceeds = money2(shares * price);
  // Cost comes off in proportion, so what is left still knows what it cost.
  held.costBasis = money2(money2(held.costBasis) * (1 - shares / have));
  held.units = have - shares;
  held.updatedAt = syncNow();
  if (held.units < 1e-9) mnyRemoveHolding(kid, held.id);
  w.cash = money2(w.cash + proceeds);
  /* Proceeds, not cost. A company sold for more than it cost brings back more
     than went in, and the difference is real money the stream has to carry or
     the derived balance falls behind the stored one by exactly the gain. */
  evMirror(kid, { kind: 'move', from: 'invest', to: 'cash', amount: proceeds,
                  note: 'Sold ' + (held.name || 'a company') });
  saveAll(); return true;
}

/* Bring the world up to today. The simulation runs on real calendar time
   (js/21-money-data.js) — interest for the days that actually passed, locked
   money maturing on its real date, share prices moving with the month — so
   this is just the meeting's name for "catch up before you settle anything".
   Kept under the old name because the meeting recap still calls it. */
function moneyAdvanceMonth(kid) {
  const r = mnySimCatchUp(kid);
  return { interest: r.interest, matured: r.matured };
}

/* Kids may look at what they own on 💰 My money; every function that moves it
   is parent-only. This is the guard the old bank screen enforced, kept because
   the commit path and the rules page both still lean on it. */
function moneyCanTransact() {
  if (!isParent()) { showToast('A grown-up moves the money 🔒'); return false; }
  return true;
}
