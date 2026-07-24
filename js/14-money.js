// Weekly-Planner — kids' money sim: bank (savings + GIC) and investing (stocks).
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   MONEY: Bank (savings + GIC) & Investing (stocks) — a kids' money sim.

   Simulated clock: one weekly family meeting = one "month". Each meeting
   advances the stock market one month through real 2023 data, credits one
   month of savings interest, and matures any GICs that have reached term.
   All amounts display in CAD (Suncor is CAD-listed; USD names converted at
   ~1.35 so everything is one currency for the kids).
   ════════════════════════════════════════════════════════════════ */
const MONEY_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// Real 2023 monthly closes, normalized to CAD (USD names × ~1.35, rounded).
const STOCKS_2023 = {
  SU:   { name: 'Suncor', emoji: '🛢️', prices: [45,44,41,43,40,41,46,47,50,45,42,43] },
  TSLA: { name: 'Tesla',  emoji: '🚗', prices: [234,277,279,221,274,352,360,348,338,270,324,335] },
  AAPL: { name: 'Apple',  emoji: '🍎', prices: [194,198,223,230,239,262,265,254,231,231,255,259] },
  COST: { name: 'Costco', emoji: '🛒', prices: [675,655,675,678,682,726,752,755,761,745,799,891] },
};
const MONEY_TICKERS = ['SU','TSLA','AAPL','COST'];
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
/* Which of the 12 historical price columns the current sim month maps to. */
function marketMonthIndex() {
  const cfg = bankConfig();
  return ((cfg.startMonth + cfg.marketMonth) % 12 + 12) % 12;
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
function portfolioValue(kid) {
  const w = ensureWallet(kid);
  return money2(Object.keys(w.holdings).reduce((s, t) => s + (w.holdings[t] || 0) * stockPrice(t), 0));
}
function gicTotal(kid) { return money2(ensureWallet(kid).gics.reduce((s, g) => s + (g.amount || 0), 0)); }
function netWorth(kid) {
  const w = ensureWallet(kid);
  return money2(w.cash + w.savings + gicTotal(kid) + portfolioValue(kid));
}

/* ── Transactions (each guards against overdraw; returns true on success) ── */
function moneyDeposit(kid, amount) {          // cash → savings
  const w = ensureWallet(kid); amount = money2(Math.min(amount, w.cash));
  if (amount <= 0) return false;
  w.cash = money2(w.cash - amount); w.savings = money2(w.savings + amount); saveAll(); return true;
}
function moneyAddCash(kid, amount) {          // extra cash from outside chores → wallet cash
  const w = ensureWallet(kid); amount = money2(amount);
  if (!(amount > 0)) return false;
  w.cash = money2(w.cash + amount); saveAll(); return true;
}
function moneyWithdraw(kid, amount) {         // savings → cash (two-way)
  const w = ensureWallet(kid); amount = money2(Math.min(amount, w.savings));
  if (amount <= 0) return false;
  w.savings = money2(w.savings - amount); w.cash = money2(w.cash + amount); saveAll(); return true;
}
function moneyOpenGIC(kid, amount, termMonths) {   // cash → locked GIC
  const w = ensureWallet(kid); amount = money2(Math.min(amount, w.cash));
  if (amount <= 0 || ![3, 6, 12].includes(termMonths)) return false;
  const cfg = bankConfig();
  const rate = cfg.gicRates[termMonths] || 0.03;
  w.cash = money2(w.cash - amount);
  w.gics.push({ id: 'gic-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    amount, termMonths, rate, openedMonth: cfg.marketMonth, matureMonth: cfg.marketMonth + termMonths });
  saveAll(); return true;
}
function moneyBuyStock(kid, ticker, dollars) {     // cash → fractional shares
  const w = ensureWallet(kid); dollars = money2(Math.min(dollars, w.cash));
  if (dollars <= 0 || !STOCKS_2023[ticker]) return false;
  const shares = dollars / stockPrice(ticker);
  w.cash = money2(w.cash - dollars);
  w.holdings[ticker] = (w.holdings[ticker] || 0) + shares; saveAll(); return true;
}
function moneySellStock(kid, ticker, shares) {     // shares → cash
  const w = ensureWallet(kid); const have = w.holdings[ticker] || 0;
  shares = Math.min(shares, have);
  if (shares <= 1e-9 || !STOCKS_2023[ticker]) return false;
  w.holdings[ticker] = have - shares;
  if (w.holdings[ticker] < 1e-9) delete w.holdings[ticker];
  w.cash = money2(w.cash + shares * stockPrice(ticker)); saveAll(); return true;
}

/* Advance the money world by one "month": credit savings interest, mature any
   due GICs (principal + simple interest for the term), and step the market.
   Returns a summary for the meeting recap. Called once per weekly meeting. */
function moneyAdvanceMonth(kid) {
  const w = ensureWallet(kid); const cfg = bankConfig();
  const interest = money2(w.savings * (cfg.savingsRate / 12));
  w.savings = money2(w.savings + interest);
  const maturedList = [];
  const nextMonth = cfg.marketMonth + 1;
  w.gics = w.gics.filter(g => {
    if (nextMonth >= g.matureMonth) {
      const payout = money2(g.amount * (1 + g.rate * (g.termMonths / 12)));
      w.cash = money2(w.cash + payout);
      maturedList.push({ amount: g.amount, payout, termMonths: g.termMonths });
      return false;
    }
    return true;
  });
  return { interest, matured: maturedList };
}

/* ── Money UI ── */
let moneyKid = 'jess';
function openMoneyScreen(kid) {
  // Bank & Invest is parent-only; kids get the "How I earn" sheet instead.
  if (!isParent()) { openHowIEarn(); return; }
  moneyKid = (kid === 'jenn' || kid === 'jess') ? kid : ctParentKid;
  showScreen('money');
  renderMoneyScreen();
}
/* The two extrinsic economies — Quest Board XP (effort) and pocket money
   (reward) — live in separate systems and were never shown together, so a
   parent couldn't see effort→reward at a glance. This read-only card bridges
   the visibility (it does NOT merge the systems): each kid's level/XP/quests
   beside this week's money and net worth. */
function buildEffortRewardCard() {
  const wk = (typeof ctWeekKey !== 'undefined' && ctWeekKey) ? ctWeekKey : ctDateToKey(ctMondayOf(new Date()));
  const col = (kid) => {
    const xp = getQuestXP(kid);
    const level = Math.floor(xp / QUEST_XP_PER_LEVEL) + 1;
    const tier = heroTierForLevel(level);
    const quests = (getProfData(kid)?.progress?.tasksCompleted) || 0;
    const money = ctWeekMoney(wk, kid);
    const worth = netWorth(kid);
    return `<div style="flex:1;min-width:0;text-align:center">
        <div style="font-weight:700;margin-bottom:0.2rem">${CT_PROFILE_ICON[kid]} ${kid === 'jenn' ? 'Jenn' : 'Jess'}</div>
        <div>${tier.emoji} Lv ${level} · ${xp} XP</div>
        <div class="ct-meta">${quests} quest${quests === 1 ? '' : 's'} done</div>
        <div style="margin:0.3rem 0;font-size:1.1rem" aria-hidden="true">↓</div>
        <div>💰 $${money.toFixed(2)} <span class="ct-meta">this week</span></div>
        <div class="ct-meta">net worth $${worth.toFixed(2)}</div>
      </div>`;
  };
  return `<div class="chore-card"><h3>🎯 Effort → Reward</h3>
    <div class="ct-meta">Effort earns XP &amp; hero levels on the Quest Board; kept routines and chores earn pocket money. Two systems — one glance.</div>
    <div style="display:flex;gap:0.75rem;margin-top:0.4rem">${col('jenn')}${col('jess')}</div></div>`;
}
function renderMoneyScreen() {
  const kid = moneyKid;
  const badge = document.getElementById('moneyProfileBadge');
  if (badge) badge.textContent = kid === 'jenn' ? '🐥 Jenn' : '🦊 Jess';
  const w = ensureWallet(kid); const cfg = bankConfig();
  const wrap = document.getElementById('moneyWrap');
  if (!wrap) return;
  let html = `<div class="chore-grid">`;
  html += `<div class="money-hero">
      <div>Net worth<br><b>$${netWorth(kid).toFixed(2)}</b></div>
      <div class="money-market">📅 ${marketMonthLabel()}</div>
    </div>`;
  html += buildEffortRewardCard();
  html += `<div class="chore-card"><h3>💵 Cash — $${w.cash.toFixed(2)}</h3>
    <div class="money-btn-row">
      ${isParent() ? `<button class="pill-btn" onclick="moneyAddCashPrompt()">➕ Add cash</button>` : ''}
      <button class="pill-btn" onclick="moneyAction('deposit')">→ 🏦 Save</button>
      <button class="pill-btn" onclick="moneyOpenGICPrompt()">→ 🔒 GIC</button>
      <button class="pill-btn" onclick="moneyAction('buy')">→ 📈 Invest</button>
    </div>${isParent() ? `<div class="ct-meta" style="margin-top:0.3rem">➕ Add cash logs extra money from outside chores (a gift, allowance, birthday) so it can be saved or invested too.</div>` : ''}</div>`;
  html += `<div class="chore-card"><h3>🏦 Savings — $${w.savings.toFixed(2)}</h3>
    <div class="ct-meta">Earns ${(cfg.savingsRate * 100).toFixed(2)}%/yr, credited each family meeting. Money moves both ways.</div>
    <div class="money-btn-row"><button class="pill-btn" onclick="moneyAction('withdraw')">→ 💵 To cash</button></div></div>`;
  const gicRows = w.gics.length ? w.gics.map(g => {
    const left = Math.max(0, g.matureMonth - cfg.marketMonth);
    const payout = money2(g.amount * (1 + g.rate * (g.termMonths / 12)));
    return `<div class="ct-item"><div class="ct-item-left"><span>🔒 $${g.amount.toFixed(2)} · ${g.termMonths}mo @ ${(g.rate * 100).toFixed(1)}%</span></div><span class="ct-meta">${left === 0 ? 'matures next meeting' : left + ' mo left'} → $${payout.toFixed(2)}</span></div>`;
  }).join('') : `<div class="ct-meta">No GICs yet. Locking cash for a term earns a higher, guaranteed rate.</div>`;
  html += `<div class="chore-card"><h3>🔒 GIC — locked savings</h3>${gicRows}
    <div class="ct-meta">Rates: 3mo ${(cfg.gicRates[3] * 100).toFixed(1)}% · 6mo ${(cfg.gicRates[6] * 100).toFixed(1)}% · 12mo ${(cfg.gicRates[12] * 100).toFixed(1)}%</div>
    <div class="money-btn-row"><button class="pill-btn" onclick="moneyOpenGICPrompt()">+ Open a GIC</button></div></div>`;
  const stockRows = MONEY_TICKERS.map(t => {
    const price = stockPrice(t); const sh = w.holdings[t] || 0; const val = sh * price;
    return `<div class="ct-item"><div class="ct-item-left"><span>${STOCKS_2023[t].emoji} <b>${t}</b> $${price}</span></div>
      <span class="ct-meta">${sh > 0 ? sh.toFixed(3) + ' sh · $' + val.toFixed(2) : '—'}</span>
      <span style="display:flex;gap:0.3rem"><button class="btn-icon" aria-label="Buy ${t}" onclick="moneyBuyPrompt('${t}')">＋</button>${sh > 0 ? `<button class="btn-icon" aria-label="Sell ${t}" onclick="moneySellPrompt('${t}')">－</button>` : ''}</span></div>`;
  }).join('');
  html += `<div class="chore-card"><h3>📈 Stocks — ${marketMonthLabel()}</h3>
    <div class="ct-meta">Real historical prices — they go up AND down. Invest any dollar amount (fractional shares).</div>
    ${stockRows}
    <div class="ct-meta" style="margin-top:0.3rem">Portfolio value: <b>$${portfolioValue(kid).toFixed(2)}</b></div></div>`;
  if (isParent()) {
    html += `<div class="chore-card"><h3>⚙️ Rates (parent)</h3>
      <div class="money-btn-row">
        <button class="pill-btn" onclick="moneySetRate('savings')">Savings ${(cfg.savingsRate * 100).toFixed(2)}%</button>
        <button class="pill-btn" onclick="moneySetRate('3')">GIC 3mo ${(cfg.gicRates[3] * 100).toFixed(1)}%</button>
        <button class="pill-btn" onclick="moneySetRate('6')">GIC 6mo ${(cfg.gicRates[6] * 100).toFixed(1)}%</button>
        <button class="pill-btn" onclick="moneySetRate('12')">GIC 12mo ${(cfg.gicRates[12] * 100).toFixed(1)}%</button>
      </div>
      <div class="ct-meta">Rates reference CIBC savings/GIC. One family meeting = one month of interest.</div></div>`;
  }
  html += `</div>`;
  wrap.innerHTML = html;
}
async function moneyPromptAmount(label, max) {
  const v = await showPrompt(`${label}\nHow much? (max $${max.toFixed(2)})`, { value:'', type:'number' });
  if (v == null) return null;
  const a = money2(parseFloat(v));
  if (!a || a <= 0) return null;
  return Math.min(a, max);
}
async function moneyAction(kind) {
  const kid = moneyKid; const w = ensureWallet(kid);
  if (kind === 'deposit') { const a = await moneyPromptAmount('Move Cash → Savings', w.cash); if (a) { moneyDeposit(kid, a); renderMoneyScreen(); } }
  else if (kind === 'withdraw') { const a = await moneyPromptAmount('Move Savings → Cash', w.savings); if (a) { moneyWithdraw(kid, a); renderMoneyScreen(); } }
  else if (kind === 'buy') { const t = ((await showPrompt('Which stock? SU, TSLA, AAPL, COST', { value:'AAPL' })) || '').toUpperCase().trim(); if (STOCKS_2023[t]) moneyBuyPrompt(t); }
}
async function moneyAddCashPrompt() {
  if (!isParent()) { showToast('Parents add extra cash 🔒'); return; }
  const kid = moneyKid;
  const v = await showPrompt('Add extra cash 💵\nMoney from outside chores — a gift, allowance, or birthday. How much?', { value:'', type:'number' });
  if (v == null) return;
  const a = money2(parseFloat(v));
  if (!a || a <= 0) { if (v !== '') showToast('Enter an amount like 5'); return; }
  moneyAddCash(kid, a);
  renderMoneyScreen();
  showToast(`➕ Added $${a.toFixed(2)} to ${kid === 'jenn' ? 'Jenn' : 'Jess'}’s cash — save or invest it below 🏦`);
}
async function moneyBuyPrompt(t) {
  const kid = moneyKid; const w = ensureWallet(kid);
  const a = await moneyPromptAmount(`Invest in ${t} @ $${stockPrice(t)}/share`, w.cash);
  if (a) { moneyBuyStock(kid, t, a); renderMoneyScreen(); showToast(`Bought $${a.toFixed(2)} of ${t} 📈`); }
}
async function moneySellPrompt(t) {
  const kid = moneyKid; const w = ensureWallet(kid); const sh = w.holdings[t] || 0;
  const v = await showPrompt(`Sell ${t} (you have ${sh.toFixed(3)} shares @ $${stockPrice(t)})\nHow many shares?`, { value:sh.toFixed(3), type:'number' });
  if (v == null) return;
  const n = parseFloat(v);
  if (n > 0) { moneySellStock(kid, t, n); renderMoneyScreen(); showToast(`Sold ${t} 💵`); }
}
async function moneyOpenGICPrompt() {
  const kid = moneyKid; const w = ensureWallet(kid);
  const term = await showPrompt('GIC term — 3, 6, or 12 months?', { value:'12', type:'number' });
  const tm = parseInt(term, 10);
  if (![3, 6, 12].includes(tm)) { if (term != null) showToast('Pick 3, 6, or 12'); return; }
  const a = await moneyPromptAmount(`Open a ${tm}-month GIC`, w.cash);
  if (a) { moneyOpenGIC(kid, a, tm); renderMoneyScreen(); showToast(`🔒 ${tm}-month GIC opened`); }
}
async function moneySetRate(which) {
  const cfg = bankConfig();
  const cur = which === 'savings' ? cfg.savingsRate : cfg.gicRates[parseInt(which, 10)];
  const v = await showPrompt(`Annual rate (%) for ${which === 'savings' ? 'Savings' : 'GIC ' + which + 'mo'}:`, { value:(cur * 100).toFixed(2), type:'number' });
  if (v == null) return;
  const r = parseFloat(v) / 100;
  if (isNaN(r) || r < 0 || r > 1) { showToast('Enter a rate like 1.5'); return; }
  if (which === 'savings') cfg.savingsRate = r; else cfg.gicRates[parseInt(which, 10)] = r;
  saveAll(); renderMoneyScreen();
}

