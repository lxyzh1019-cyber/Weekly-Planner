// Weekly-Planner — the Sunday ritual's arithmetic: pure, no DOM, no `state`.
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   SUNDAY v15 — THE CORE (Plan v3 §F, js/43)

   Every number the Sunday ritual shows — the pile, what she can place where,
   the presets, what signing does, the verdicts beside the money in & out, the
   1 week / 1 month / 5 months forecast, the Grown-ups rules preview — ported
   from the owner's prototype (docs/handoff/sunday-v15/Sunday v15 Screen.dc.html,
   Grown-ups v2) as functions of EXPLICIT inputs. No DOM, no `state`: the same
   split, and the same reason, as `evBalanceOf` (js/40) and `bufferClip` — a
   calculation reachable only from a browser is one no unit test can hold.
   tests/sunday.test.js runs 8–20 Sundays for both girls over this file.

   RULES ARE AN ARGUMENT. Every rate, cap and gate is read from the `rules`
   passed in, by its Plan v3 §C path (`sessions.perSession`, `advance.maxPerWeek`,
   `spend.capPct`, `loan.ratePct`, `loan.interestEverySundays`,
   `loan.extraBonusPct`, `pots.safety`, `pots.lockWeeks`, `pots.rates.*`,
   `school.stagePct.*`, `chores.dailyCap`). The app hands it `mrSundayRules(wk)`,
   which fills a stored rulebook's missing paths from MR_DEFAULT_RULES. What
   stays in this file is what a rule is NOT: the prototype's preset splits, its
   sticker thresholds and its verdict thresholds, which are the spec's own
   definitions of a "Saver" or a "lucky week".

   WORDS ARE THE SPEC. Sentences are the prototype's, character for character,
   except where a figure in them is a rule (the 🛟 $10, a fifth, $1.10, $3 a
   day, $6 a session): those read the rule, and say exactly the prototype's
   words at the default. Money is named by the handoff §5 table.

   THE INPUT, one girl's Sunday (`w`):
     weekKey     the Monday of the week being settled
     week        a Sunday counter (the prototype's `s.week`; 0 before the first)
     lines       [{ key, label, amount, note }] — keys jobs · streak · pa (the
                 ⛸️ assistant job) · comp · gifts · ret (pots earned) · fine (≤0)
     loan        { principal, paid, interest, arrears, weekly } — what is owed
                 is principal − paid + interest; weekly is Σ monthly × 12 ÷ 52
     pots        { ready, goal, gic, stock } — what she has in each
     locks       [{ amount, back }] — locked money and the Sunday it returns
     matured     (optional) locked money that came back — else read off locks
     pull        { ready, stock, cash } — 🏦 from my bank into the pile
     adv         { owed, manual } — ⏪ approved advances + "forgot to ask"
     alloc       { extra, ready, goal, gic, stock, spend, adv } — her choices
     goal        { name, target } | null — the 🎯 goal jar's goal
     guess, hist (4 past week totals), histCat, coming ([[name, date]])
   ════════════════════════════════════════════════════════════════ */

/* ── Definitions the spec owns (not rules) ── */
const SD_STEADY_KEYS = ['jobs', 'streak', 'pa'];
const SD_BONUS_KEYS = ['comp', 'gifts', 'ret'];
const SD_ALLOC_KEYS = ['extra', 'ready', 'goal', 'gic', 'stock', 'spend', 'adv'];
const SD_POT_KEYS = ['ready', 'goal', 'gic', 'stock'];
// Which school gate opens each pot (school.stagePct.<stage>). Savings: always.
const SD_GATE_STAGE = { gic: 'locked', stock: 'stock' };
// The three starts on step 3 (prototype REFLECT).
const SD_PRESETS = [
  { id: 'sooner', label: '🧱 Loan sooner', split: { extra: 1 } },
  { id: 'saving', label: '🎯 For my goal', split: { extra: 0.4, goal: 0.6 } },
  { id: 'growing', label: '⚖️ Watch it grow', split: { extra: 0.4, ready: 0.3, gic: 0.3 }, stage: 'gic' }];
// Stickers a signed week earns (prototype STICKERS) — derived, never stored.
const SD_STICKERS = [
  ['wall', '🧱', 'Wall builder', s => s.extra >= 10],
  ['saver', '🌱', 'Saver', s => s.ready + s.gic + s.stock >= 8],
  ['patient', '🔒', 'Patient one', s => s.gic >= 3],
  ['guesser', '🎯', 'Sharp guesser', s => s.guess != null && Math.abs(s.guess - s.payday) <= 5],
  ['brave', '📈', 'Brave investor', s => s.stock >= 3],
  ['treat', '🍦', 'Treat yourself', s => s.wallet >= 2]];

/* ── Small pure helpers ── */
function sdR2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function sdMoney(v) { const n = Number(v) || 0; return (n < 0 ? '−$' : '$') + Math.abs(n).toFixed(2); }
function sdRule(rules, path) {
  const v = String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), rules || {});
  return Number(v) || 0;
}
// Whole dollars without a float's 13.999999 turning into 13.
function sdFloor(v) { return Math.floor(sdR2(v) + 1e-9); }
function sdCeilCent(v) { return Math.ceil(sdR2(v * 100) - 1e-9) / 100; }
function sdZero() { return { extra: 0, ready: 0, goal: 0, gic: 0, stock: 0, spend: 0, adv: 0 }; }
function sdAlloc(a) { return Object.assign(sdZero(), a || {}); }
function sdPlacedOf(a) { const x = sdAlloc(a); return sdR2(x.extra + x.ready + x.goal + x.gic + x.stock + x.spend); }
function sdBonusRate(rules) { return sdRule(rules, 'loan.extraBonusPct') / 100; }
// % a year as a fraction; the goal jar earns nothing.
function sdRate(rules, k) { return k === 'goal' ? 0 : sdRule(rules, 'pots.rates.' + k) / 100; }

/* ── Dates, from 'YYYY-MM-DD' keys in UTC so no device clock can move them ── */
function sdDayDate(dayKey) {
  const [y, m, d] = String(dayKey).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function sdDayKeyAdd(dayKey, days) {
  const t = sdDayDate(dayKey);
  t.setUTCDate(t.getUTCDate() + Math.round(Number(days) || 0));
  return t.toISOString().slice(0, 10);
}
function sdSundayOf(weekKey) { return sdDayKeyAdd(weekKey, 6); }
/* 🔒 A lock opened in the week of `weekKey` comes back on the Saturday before
   the Nth-next meeting Sunday. The one statement of that date —
   moneyOpenGIC (js/14) reads it too. */
function sdLockMaturesOn(weekKey, weeks) {
  return sdDayKeyAdd(weekKey, 5 + 7 * Math.max(1, Math.floor(Number(weeks) || 0)));
}
// "Oct 2026" — the prototype's dateIn(), counted in Sundays from this one.
function sdMonthYear(weekKey, sundaysAhead) {
  if (!weekKey || !isFinite(sundaysAhead)) return '—';
  return sdDayDate(sdDayKeyAdd(sdSundayOf(weekKey), 7 * sundaysAhead))
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
// "Sat, Oct 31" — the prototype's sunDate(w, 1).
function sdShortDay(dayKey) {
  return sdDayDate(dayKey).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}
/* "a fifth" at 20%: the spend cap said in words, from the rule. */
function sdCapWords(capPct) {
  const p = Number(capPct) || 0;
  return ({ 10: 'a tenth', 20: 'a fifth', 25: 'a quarter', 50: 'half' })[p] || (p + '%');
}

/* ── Shares: largest remainder, so they add to exactly 100 ── */
function sdPercents(vals, total) {
  const raw = vals.map(v => total ? v / total * 100 : 0), fl = raw.map(Math.floor);
  let rem = 100 - fl.reduce((a, b) => a + b, 0);
  raw.map((v, i) => [v - fl[i], i]).sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => { if (rem > 0 && vals[i] > 0) { fl[i]++; rem--; } });
  return fl;
}
// A share that rounds to 0 but is not nothing says so.
function sdPercentLabel(pct, val) { return (pct === 0 && Number(val) > 0) ? '<1%' : pct + '%'; }

/* "about 2 movie tickets" — the family's own price list (rules.buys.items). */
function sdBuysOf(amount, items) {
  const list = (items || []).filter(x => x && Number(x.amount) > 0)
    .slice().sort((a, b) => Number(a.amount) - Number(b.amount));
  const one = s => String(s || '').replace(/^(a|an)\s+/i, '');
  for (let i = list.length - 1; i >= 0; i--) {
    const n = Math.floor(sdR2(amount) / Number(list[i].amount));
    if (n >= 1) return `about ${n} ${n === 1 ? one(list[i].label) : (list[i].plural || one(list[i].label))}`;
  }
  return 'not quite an ice-cream';
}

/* ── Step 1 · what came in ──────────────────────────────────────────
   Steady every week (chores, routine, ⛸️ assistant job); bonus some weeks
   (competitions, gifts, what her pots earned); taken off (📦 fines ≤ 0).
   A fine can never create debt (the app's `fines.dailyFloorZero`): what is
   taken off is never more than what came in, so payday is never below $0. */
function sdIncome(lines) {
  const byKey = {};
  (lines || []).forEach(f => { if (f && f.key) byKey[f.key] = sdR2((byKey[f.key] || 0) + (Number(f.amount) || 0)); });
  const sum = ks => sdR2(ks.reduce((a, k) => a + (byKey[k] || 0), 0));
  const steady = sum(SD_STEADY_KEYS), bonus = sum(SD_BONUS_KEYS);
  const fine = sdR2(Math.max(Math.min(0, byKey.fine || 0), -Math.max(0, steady + bonus)));
  return { steady, bonus, fine, fineAsked: sdR2(Math.min(0, byKey.fine || 0)),
           payday: sdR2(steady + bonus + fine), byKey };
}
/* The prototype's weekCat: one week as the passbook's categories. */
function sdWeekCat(lines) {
  const i = sdIncome(lines), b = i.byKey;
  return { cr: i.steady, comp: b.comp || 0, gifts: b.gifts || 0, ret: b.ret || 0, fine: i.fine };
}
/* ⛸️ The assistant-job line: sessions she attended × the rule. A missed one
   pays $0 and is not a fine; one nobody has answered pays nothing yet. */
function sdSessionsLine(sessions, rules) {
  const list = sessions || [];
  const n = list.filter(x => x && x.attended === true).length;
  return { key: 'pa', amount: sdR2(n * sdRule(rules, 'sessions.perSession')), attended: n,
           open: list.filter(x => x && x.attended == null).length };
}

/* ── The loan, as the core counts it ── */
function sdLeft(loan) {
  const l = loan || {};
  return sdR2(Math.max(0, (Number(l.principal) || 0) - (Number(l.paid) || 0)) + (Number(l.interest) || 0));
}
// Paid share 0–100, the same answer as mnyPaidPct: nothing owed is 100.
function sdPaidPct(loan) {
  const p = Number((loan || {}).principal) || 0;
  if (!(p > 0)) return 100;
  return Math.max(0, Math.min(100, Math.round((Number(loan.paid) || 0) / p * 100)));
}
function sdMustPay(loan) {
  const l = loan || {};
  return sdR2(Math.min(sdLeft(l), (Number(l.weekly) || 0) + (Number(l.arrears) || 0)));
}
/* Interest every N Sundays: the counter moves first, then on the Nth Sunday
   `ratePct` a year on the WHOLE balance left — earlier interest included — is
   added for N weeks. The prototype's `left * rate / 100 * 4 / 52` with
   `left += int`, so interest compounds every N Sundays as drawn. */
function sdLoanInterest(loan, sundaysSince, rules) {
  const every = Math.max(1, sdRule(rules, 'loan.interestEverySundays') || 1);
  const n = (Number(sundaysSince) || 0) + 1;
  const l = Object.assign({}, loan || {});
  if (n < every || !(sdLeft(l) > 0)) return { loan: l, interest: 0, sundaysSince: sdLeft(l) > 0 ? n % every : 0 };
  const interest = sdR2(sdLeft(l) * sdRule(rules, 'loan.ratePct') / 100 * every / 52);
  l.interest = sdR2((Number(l.interest) || 0) + interest);
  return { loan: l, interest, sundaysSince: 0 };
}

/* ── Step 2 · the pile ─────────────────────────────────────────────
   Payday + what she took from her bank; ⏪ the advance comes off first (it is
   already spent), then the 📌 must-pay; what is left in whole dollars is hers
   to place, and the cents go to Savings. Short of the must-pay, the loan
   takes what there is and the rest is carried, with no interest. */
function sdMatured(w) {
  if (w && w.matured != null) return sdR2(w.matured);
  const wk = Number((w || {}).week) || 0;
  return sdR2(((w && w.locks) || []).filter(l => l && Number(l.back) <= wk + 1)
    .reduce((a, l) => a + (Number(l.amount) || 0), 0));
}
function sdPile(w, rules) {
  const x = w || {};
  const income = sdIncome(x.lines);
  const p = Object.assign({ ready: 0, stock: 0, cash: 0 }, x.pull || {});
  const matured = sdMatured(x);
  const pullTot = sdR2(matured + p.ready + p.stock + p.cash);
  const total = sdR2(income.payday + pullTot);
  const weekly = sdR2((x.loan || {}).weekly);
  const mustPay = sdMustPay(x.loan);
  const advW = sdR2(((x.adv || {}).owed || 0) + ((x.adv || {}).manual || 0));
  const advTaken = sdR2(Math.min(advW, Math.max(0, total)));
  const afterAdv = sdR2(total - advTaken);
  const minNow = sdR2(Math.min(mustPay, Math.max(0, afterAdv)));
  const hers = Math.max(0, sdFloor(afterAdv - minNow));
  const cents = sdR2(Math.max(0, afterAdv - minNow - hers));
  const placed = sdPlacedOf(x.alloc);
  return {
    income, payday: income.payday, matured, pullTot, total, weekly, mustPay, minNow,
    shortfall: sdR2(mustPay - minNow), advW, advTaken, advCarried: sdR2(advW - advTaken),
    hers, cents, tp: sdR2(total - advTaken), placed, pile: sdR2(hers - placed),
  };
}
function sdHers(w, rules) { return sdPile(w, rules).hers; }

/* ── Step 3 · may she put money here? ──
   Loan extra, cash out, Savings: always. The goal jar and the two growing
   pots need 🛟 Savings filled to the safety line first; 🔒 Locked away and
   📈 Companies open as the loan is paid (school.stagePct). */
function sdSafeOk(w, rules) {
  const x = w || {};
  return sdR2(((x.pots || {}).ready || 0) - ((x.pull || {}).ready || 0) + sdAlloc(x.alloc).ready)
    >= sdRule(rules, 'pots.safety');
}
function sdIsOpen(k, w, rules) {
  const stage = SD_GATE_STAGE[k];
  if (!stage) return true;
  return sdPaidPct((w || {}).loan) >= sdRule(rules, 'school.stagePct.' + stage);
}
function sdCanPlace(k, w, rules) {
  if (k === 'extra' || k === 'spend' || k === 'adv' || k === 'ready') return { ok: true, why: null };
  const fill = `🛟 fill Savings to $${sdRule(rules, 'pots.safety')} first`;
  if (k === 'goal') return sdSafeOk(w, rules) ? { ok: true, why: null } : { ok: false, why: fill };
  if (!sdIsOpen(k, w, rules)) {
    return { ok: false, why: `🔒 opens at ${sdRule(rules, 'school.stagePct.' + SD_GATE_STAGE[k])}% paid` };
  }
  return sdSafeOk(w, rules) ? { ok: true, why: null } : { ok: false, why: fill };
}

/* Tap = +$1, hold = +$5, − takes back (prototype bump). Caps: the pile, the
   spend cap (a share of her share), the advance maximum. Returns the new
   allocation, or why not. */
function sdPlace(w, k, d, n, rules) {
  const a = sdAlloc((w || {}).alloc);
  const can = sdCanPlace(k, w, rules);
  if (!can.ok) return { ok: false, alloc: a, moved: 0, why: can.why };
  const want = Math.max(1, Math.floor(Number(n) || 1));
  const P = sdPile(w, rules);
  let moved;
  if (d > 0) {
    let room = k === 'adv' ? sdRule(rules, 'advance.maxPerWeek') - a.adv : P.hers - P.placed;
    if (k === 'spend') room = Math.min(room, sdFloor(P.hers * sdRule(rules, 'spend.capPct') / 100) - a.spend);
    moved = Math.max(0, Math.min(want, room));
    if (!moved) {
      let why = '💰 nothing left to place';
      if (k === 'adv') why = `up to $${sdRule(rules, 'advance.maxPerWeek')} early, from next Sunday`;
      else if (k === 'spend' && P.pile > 0) why = `full · ${sdCapWords(sdRule(rules, 'spend.capPct'))} of my share`;
      return { ok: false, alloc: a, moved: 0, why };
    }
    a[k] += moved;
  } else {
    moved = Math.min(want, a[k]);
    if (!moved) return { ok: false, alloc: a, moved: 0, why: null };
    a[k] -= moved;
  }
  return { ok: true, alloc: a, moved, why: null };
}

/* 🏦 From my bank: take a dollar from Savings above the 🛟 line, from
   Companies, or bring cash from home — refused when giving it back would
   leave less than she has already placed (prototype setPull). */
function sdSetPull(w, k, d, rules) {
  const x = w || {};
  const p = Object.assign({ ready: 0, stock: 0, cash: 0 }, x.pull || {});
  const nv = Math.max(0, p[k] + d);
  const cap = k === 'ready' ? sdFloor(Math.max(0, ((x.pots || {}).ready || 0) - sdRule(rules, 'pots.safety')))
            : k === 'stock' ? sdFloor((x.pots || {}).stock || 0) : Infinity;
  if (nv === p[k]) return { ok: false, pull: p };
  if (d > 0 && nv > cap) return { ok: false, pull: p, why: `$${cap} free` };
  const next = Object.assign({}, p, { [k]: nv });
  const H2 = sdHers(Object.assign({}, x, { pull: next }), rules);
  if (d < 0 && H2 < sdPlacedOf(x.alloc)) return { ok: false, pull: p, why: 'Place every dollar first' };
  return { ok: true, pull: next };
}
/* ⏪ "Forgot to ask" on payday: + / − a dollar, never past the weekly
   maximum, never below what she has placed (prototype setAdv). */
function sdSetAdvance(w, d, rules) {
  const x = w || {};
  const adv = Object.assign({ owed: 0, manual: 0 }, x.adv || {});
  const nv = Math.max(0, adv.manual + d);
  const tot = sdR2(adv.owed + nv);
  const max = sdRule(rules, 'advance.maxPerWeek');
  if (nv === adv.manual) return { ok: false, adv };
  if (tot > max) return { ok: false, adv, why: `up to $${max} early, from next Sunday` };
  const H2 = sdHers(Object.assign({}, x, { adv: { owed: adv.owed, manual: nv } }), rules);
  if (H2 < sdPlacedOf(x.alloc)) return { ok: false, adv, why: 'Place every dollar first' };
  return { ok: true, adv: { owed: adv.owed, manual: nv } };
}

/* The three starts (prototype applyReflect). Savings is filled to the 🛟 line
   before anything goes to the jar or the growing pots; the jar never takes
   more than its goal needs (the rest goes to Savings); a pot that is not open
   sends its share to the wall. Whatever is left over goes to the wall. */
function sdPresets(w, rules) {
  const x = w || {};
  const P = sdPile(x, rules);
  const H = P.hers;
  const pots = Object.assign({ ready: 0, goal: 0, gic: 0, stock: 0 }, x.pots || {});
  const safety = sdRule(rules, 'pots.safety');
  return SD_PRESETS.map(r => {
    const locked = !!(r.stage && !sdIsOpen(r.stage, x, rules));
    const label = r.label + (locked ? ` 🔒${sdRule(rules, 'school.stagePct.' + SD_GATE_STAGE[r.stage])}%` : '');
    if (locked) return { id: r.id, label, locked, alloc: null };
    const a = sdZero();
    let used = 0;
    let fill = Math.max(0, Math.ceil(sdR2(safety - (pots.ready - ((x.pull || {}).ready || 0)))));
    Object.keys(r.split).forEach(k => {
      let v = Math.floor(H * r.split[k]);
      if (k === 'goal') {
        const target = x.goal ? Number(x.goal.target) || 0 : 0;
        const cap = Math.max(0, Math.ceil(sdR2(target - pots.goal)));
        const over = Math.max(0, v - cap - fill);
        if (over) { a.ready += over; used += over; v -= over; }
      }
      if (k === 'goal' || k === 'gic' || k === 'stock') {
        const f = Math.min(fill, v); a.ready += f; used += f; fill -= f; v -= f;
      }
      // Judged against the preset's own allocation so far — Savings filled above.
      if (k !== 'goal' && k !== 'ready' && !sdCanPlace(k, Object.assign({}, x, { alloc: a }), rules).ok) {
        a.extra += v; used += v; return;
      }
      a[k] += v; used += v;
    });
    a.extra += H - used;
    return { id: r.id, label, locked, alloc: a };
  });
}

/* ── Stickers, derived from a signed week (no key — the same idiom as xp2) ── */
function sdStickersFor(row) {
  const s = Object.assign({ extra: 0, ready: 0, gic: 0, stock: 0, wallet: 0, guess: null, payday: 0 }, row || {});
  return SD_STICKERS.filter(([, , , ok]) => ok(s)).map(([id]) => id);
}

/* ── In = Out, before anything is written ──
   Money in (steady + bonus + from my bank) must equal money out (fine,
   advance, loan, cash out, Savings, goal, locked, companies) to the cent. A
   mismatch refuses the sign with a sentence — never a silent rounding. */
function sdCheckInOut(sg) {
  const s = sg || {};
  const adv = sdR2(s.adv), cashOut = sdR2((s.wallet || 0) - adv);
  const inn = sdR2((s.inSteady || 0) + (s.inBonus || 0) + (s.inBank || 0));
  const out = sdR2(-(s.outFine || 0) + adv + (s.loanCash || 0) + cashOut + (s.ready || 0)
    + (s.goal || 0) + (s.gic || 0) + (s.stock || 0));
  const ok = Math.abs(inn - out) < 0.005;
  return { in: inn, out, ok, why: ok ? null : `In ${sdMoney(inn)} ≠ Out ${sdMoney(out)} — nothing was signed.` };
}

/* ── Step 4 · Sign ─────────────────────────────────────────────────
   The prototype's sign(): the signed record, the passbook row, the stickers,
   the milestone crossed, and the state after. Refused while money is unplaced
   ("place $X first") or if In ≠ Out. The loan takes interest first, then the
   must-pay, then extra at 1 + bonus; extra beyond what clears the loan spills
   to Savings (🎉). The goal jar never passes its goal; the rest goes to
   Savings. */
function sdSign(w, rules) {
  const x = w || {};
  const P = sdPile(x, rules);
  if (P.pile > 0) return { ok: false, why: `place $${P.pile} first` };
  const a = sdAlloc(x.alloc);
  const pots = Object.assign({ ready: 0, goal: 0, gic: 0, stock: 0 }, x.pots || {});
  const pull = Object.assign({ ready: 0, stock: 0, cash: 0 }, x.pull || {});
  const loan = Object.assign({ principal: 0, paid: 0, interest: 0, arrears: 0, weekly: 0 }, x.loan || {});
  const b = sdBonusRate(rules);
  const week = Number(x.week) || 0;
  const left0 = sdLeft(loan);

  // The loan: interest first, then principal; extra only up to what clears it.
  let interest = sdR2(loan.interest);
  const mustToInt = sdR2(Math.min(interest, P.minNow));
  interest = sdR2(interest - mustToInt);
  const owed0 = sdR2(Math.max(0, loan.principal - loan.paid));
  const mustToPrin = sdR2(Math.min(owed0, P.minNow - mustToInt));
  const owed1 = sdR2(owed0 - mustToPrin);
  const extraNeed = sdR2(interest + sdCeilCent(owed1 / (1 + b)));
  const extraUsed = sdR2(Math.min(a.extra, extraNeed));
  const spill = sdR2(a.extra - extraUsed);
  const extraToInt = sdR2(Math.min(interest, extraUsed));
  interest = sdR2(interest - extraToInt);
  const extraToPrin = sdR2(Math.min(owed1, (extraUsed - extraToInt) * (1 + b)));
  const loanAfter = Object.assign({}, loan, {
    paid: sdR2(loan.paid + mustToPrin + extraToPrin), interest,
    arrears: P.shortfall,                 // carried, with no interest on it
  });
  const nl = sdLeft(loanAfter);
  const pay = sdR2(left0 - nl);             // what came off the wall

  // The milestone: a gate crossed by THIS payment (Savings never had one).
  const pctBefore = sdPaidPct(loan), pctAfter = sdPaidPct(loanAfter);
  const crossed = Object.keys(SD_GATE_STAGE).find(k => {
    const g = sdRule(rules, 'school.stagePct.' + SD_GATE_STAGE[k]);
    return pctBefore < g && pctAfter >= g;
  }) || null;

  // The pots after.
  const target = x.goal ? Number(x.goal.target) || 0 : 0;
  const goalRoom = target > 0 ? Math.max(0, sdR2(target - pots.goal)) : a.goal;
  const toGoal = sdR2(Math.min(a.goal, goalRoom));
  const goalOver = sdR2(a.goal - toGoal);
  const readyIn = sdR2(a.ready + P.cents + goalOver + spill);
  const potsAfter = {
    ready: sdR2(pots.ready - pull.ready + readyIn),
    goal: sdR2(pots.goal + toGoal),
    gic: sdR2(pots.gic - P.matured + a.gic),
    stock: sdR2(pots.stock - pull.stock + a.stock),
  };
  const yr = p => sdR2(p.ready * sdRate(rules, 'ready') + p.gic * sdRate(rules, 'gic') + p.stock * sdRate(rules, 'stock'));
  const weekly = P.weekly;
  const before = { left: left0, free: weekly > 0 ? week + Math.ceil(left0 / weekly) : Infinity,
                   goal: sdR2(pots.goal), yr: yr(pots) };
  const lines = (x.lines || []).map(f => [f.key, f.label || f.key, sdR2(f.amount)]);
  const hist = Array.isArray(x.hist) ? x.hist.slice()
    : (x.histCat || []).map(o => sdR2(o.cr + o.comp + o.gifts + o.ret + o.fine));
  const wallet = sdR2(a.spend + P.advTaken);
  const signed = {
    inSteady: P.income.steady, inBonus: P.income.bonus, outFine: P.income.fine,
    inBank: P.pullTot, pullReady: pull.ready,
    loanCash: sdR2(P.minNow + extraUsed), goal: toGoal, hist, week: week + 1,
    pay, extra: extraUsed, spill, ready: readyIn, gic: a.gic, stock: a.stock,
    wallet, adv: P.advTaken, advCarried: P.advCarried, guess: x.guess == null ? null : x.guess,
    payday: P.payday, hers: P.hers, minW: P.minNow, mustPay: P.mustPay, shortfall: P.shortfall,
    cents: P.cents, lines, free: weekly > 0 ? week + 1 + Math.ceil(nl / weekly) : Infinity,
    goalBal: potsAfter.goal, yr: yr(potsAfter), weekKey: x.weekKey || null,
  };
  const check = sdCheckInOut(signed);
  if (!check.ok) return { ok: false, why: check.why, check };
  signed.stickers = sdStickersFor(signed);
  const bookRow = {
    wk: week + 1, weekKey: x.weekKey || null, date: x.weekKey ? sdSundayOf(x.weekKey) : null,
    earned: sdR2(signed.inSteady + signed.inBonus + signed.outFine),
    steady: signed.inSteady, bonus: signed.inBonus, wall: pay,
    saved: sdR2(readyIn + toGoal + a.gic + a.stock), cash: wallet,
  };
  const lockWeeks = Math.max(1, sdRule(rules, 'pots.lockWeeks') || 1);
  const locks = [...(x.locks || []).filter(l => Number(l.back) > week + 1),
    ...(a.gic ? [{ amount: a.gic, back: week + 1 + lockWeeks,
                   on: x.weekKey ? sdLockMaturesOn(x.weekKey, lockWeeks) : null }] : [])];
  const after = {
    week: week + 1, loan: loanAfter, left: nl, pots: potsAfter, locks,
    goalSaved: potsAfter.goal, advOwed: P.advCarried,
    stickers: [...new Set([...(x.stickers || []), ...signed.stickers])],
    histCat: [...(x.histCat || []).slice(1), sdWeekCat(x.lines)],
  };
  return { ok: true, signed, bookRow, stickers: signed.stickers, crossed, before, after, check };
}

/* ── The verdicts beside "⇅ Money in & out" ────────────────────────
   `res` is sdSign's result; `w` the input it was signed from. Income: can I
   keep this up? Strategy: 🚀 Fast track · 🎈 Enjoy now · 🌱 Saver ·
   ⚖️ Balanced · 🚨 Risky · 🎉 Loan free. Sentences are the prototype's. */
function sdVerdicts(res, w, rules) {
  const sg = res.signed, after = res.after, x = w || {};
  const m = sdMoney;
  const L = sg.lines || [];
  const amtOf = k => sdR2(L.filter(l => l[0] === k).reduce((a, l) => a + l[2], 0));
  const incT = sdR2((sg.inSteady || 0) + (sg.inBonus || 0) + (sg.inBank || 0)) || 1;
  const pc0 = v => Math.round(v / incT * 100) + '%';
  const wk = sdR2((x.loan || {}).weekly);
  const minW = sg.mustPay || sg.minW || wk;
  const cover = minW ? sg.inSteady / minW : 9;
  const bP = Math.round(sg.inBonus / incT * 100), kP = Math.round((sg.inBank || 0) / incT * 100);
  const sP = Math.round(sg.inSteady / incT * 100);
  const hd = cover < 1 ? ['🚨 Not safe yet', 'bad'] : bP >= 40 ? ['🎲 A lucky week, not every week', 'warn']
    : cover < 1.5 ? ['⚠️ Only just enough', 'warn'] : ['✅ I can keep this up', 'good'];
  // What would replace the bonus: more chore days first (up to a day done
  // right every day), then club sessions — both priced by the rules.
  const day = sdRule(rules, 'chores.dailyCap'), ses = sdRule(rules, 'sessions.perSession');
  const choreMax = 7 * day;
  const gap = sdR2(sg.inBonus), earnedW = sdR2(sg.inSteady + sg.inBonus);
  const room = Math.max(0, choreMax - amtOf('jobs'));
  const days = day > 0 ? Math.min(Math.ceil(Math.min(gap, room) / day), Math.floor(room / day)) : 0;
  const restG = sdR2(gap - days * day), sess = restG > 0 && ses > 0 ? Math.ceil(restG / ses) : 0;
  const parts = [];
  if (days) parts.push(days + ' more chore day' + (days > 1 ? 's' : '') + ' (+$' + days * day + ')');
  if (sess) parts.push(sess + ' more club session' + (sess > 1 ? 's' : '') + ' (+$' + sess * ses + ')');
  const h4 = sg.hist || [], avg4 = h4.length ? sdR2(h4.reduce((a, v) => a + v, 0) / h4.length) : 0;
  const dAvg = sdR2(earnedW - avg4);
  const inLines = L.filter(l => [...SD_STEADY_KEYS, ...SD_BONUS_KEYS].includes(l[0]) && l[2] >= 0.005);
  const bonusNames = inLines.filter(l => SD_BONUS_KEYS.includes(l[0]))
    .map(l => String(l[1]).replace(/^\S+ /, '').toLowerCase() + ' ' + m(l[2])).join(', ');
  const nextEv = (x.coming || [])[0];
  const incomeLines = [
    '📅 Steady ' + m(sg.inSteady) + ' (' + sP + '%): the money I earn every week from chores, routine and club sessions.',
    '🧱 My loan needs ' + m(minW) + ' first, every week. Steady covers it ' + cover.toFixed(1) + '×' + (cover < 1 ? ', not enough on its own.' : cover < 1.5 ? ', with little to spare.' : '.'),
    ...(bP > 0 ? ['🎲 Bonus ' + m(sg.inBonus) + ' (' + bP + '%) came from ' + bonusNames + '. ' + (nextEv ? 'Next chance: ' + nextEv[0] + ', ' + nextEv[1] + '.' : 'No meet planned yet.')] : []),
    ...(avg4 ? ['📊 My 4-week average is ' + m(avg4) + '. This week is ' + (dAvg >= 0 ? m(dAvg) + ' more.' : m(-dAvg) + ' less.')] : []),
    ...(kP >= 10 ? ['🏦 ' + kP + '% came from my bank. That is my own money moving, not earning.'] : []),
    gap < 1 ? '👍 All from steady work. I can do this every week.' : '💪 To earn ' + m(earnedW) + ' with no bonus: ' + (parts.join(' + ') || 'keep every session') + (room < day ? '. Chores are already at the top.' : '.')];

  const b = sdBonusRate(rules), counts = sdR2(1 + b);
  const safety = sdRule(rules, 'pots.safety');
  const cash = sdR2(sg.wallet - (sg.adv || 0));
  const saveAmt = sdR2(sg.ready + (sg.goal || 0) + sg.gic + sg.stock);
  const share = Math.max(1, sg.hers || sdR2(sg.extra + saveAmt + cash));
  const exP = Math.round(sg.extra / share * 100), cashP = Math.round(cash / share * 100), saveP = Math.round(saveAmt / share * 100);
  const left = after.left;
  const perExtra = wk + sg.extra * counts;
  const freePn = perExtra > 0 ? Math.ceil(left / perExtra) : Infinity, freeNn = wk > 0 ? Math.ceil(left / wk) : Infinity;
  const sooner = isFinite(freeNn) && isFinite(freePn) ? Math.max(0, freeNn - freePn) : 0;
  const dateIn = n => sdMonthYear(x.weekKey, n);
  const safeLow = after.pots.ready < safety;
  const st = left <= 0 ? ['🎉 Loan free', 'The wall is done. Every payday is all mine now.', 'Next: grow my pots and enjoy.', 'good']
    : cover < 1 ? ['🚨 Risky', `If bonus weeks stop, I can't make my ${m(minW)} payment. That is how people go broke.`, `Next: keep 🛟 $${safety} safe and add steady work: chores and club sessions.`, 'bad']
    : exP >= 35 ? ['🚀 Fast track', `${exP}% of my choice went on the wall. Every week like this, I'm free by ${dateIn(freePn)}${sooner ? `, ${sooner} weeks sooner` : ''}. Pay now, enjoy later.`, safeLow ? `Next: fill 🛟 $${safety} too, in case a week goes wrong.` : 'Next: keep the steady money coming.', 'good']
    : cashP >= 15 && exP < 10 ? ['🎈 Enjoy now', `I took ${m(cash)} as cash. Fun is OK! The loan still gets its ${m(minW)}, but stays till ${dateIn(freeNn)}.`, `Next: try a few $ on the wall. Each $1 counts as $${counts.toFixed(2)}.`, 'warn']
    : saveP >= 40 ? ['🌱 Saver', `${saveP}% went into my pots. I'm building a cushion and my goal.`, 'Next: a little extra on the wall gets me free sooner.', 'good']
    : ['⚖️ Balanced', `${exP}% wall · ${saveP}% saved · ${cashP}% cash. A bit of everything.`, 'Next: pick one thing to push a little more.', 'neutral'];
  const target = x.goal ? Number(x.goal.target) || 0 : 0;
  const goalLeft2 = sdR2(Math.max(0, target - after.pots.goal));
  const capAmt = sdFloor((sg.hers || 0) * sdRule(rules, 'spend.capPct') / 100);
  const strategyLines = [
    '🧱 Loan ' + m(sg.loanCash) + ' (' + pc0(sg.loanCash) + ')' + (sg.extra ? ' = ' + m(minW) + ' must-pay + ' + m(sg.extra) + ' extra (counted ' + m(sdR2(sg.extra * counts)) + ').' : ' = must-pay only.') + ' Free by ' + dateIn(freePn) + (sooner ? ', ' + sooner + ' weeks sooner.' : '.'),
    '🌱 Saved ' + m(saveAmt) + ' (' + pc0(saveAmt) + ')' + ((sg.goal || 0) > 0 ? ' · 🎯 ' + (goalLeft2 > 0 ? m(goalLeft2) + ' to my goal' : 'goal reached!') : '') + (after.pots.ready < safety ? ` · 🛟 safety $${safety} not full yet` : ' · 🛟 safety full') + '.',
    '💵 Cash ' + m(sdR2(cash + (sg.adv || 0))) + ' (' + pc0(sdR2(cash + (sg.adv || 0))) + ')' + (cash + (sg.adv || 0) > 0.004 ? ' to enjoy. Fun is part of the plan.' : ', no treat this week (up to $' + capAmt + ' allowed).'),
    st[2]];
  return {
    income: { head: hd[0], tone: hd[1], lines: incomeLines, cover, steadyPct: sP, bonusPct: bP, bankPct: kP },
    strategy: { name: st[0], head: '🧭 ' + st[0], why: st[1], next: st[2], tone: st[3], lines: strategyLines,
                wallPct: exP, savePct: saveP, cashPct: cashP },
  };
}

/* ── 🔮 "If every week is like this": 1 week, 1 month, 5 months ──
   nW is 1, 4 or 20 Sundays. Prototype fwLoan / fwSave: the wall now vs my
   plan (with interest), and what each pot would hold — the goal jar earns
   none, a full goal sends the rest to Savings, and so does a paid-off loan. */
function sdForecast(res, w, rules, nW) {
  const sg = res.signed, after = res.after, x = w || {};
  const m = sdMoney, n = Number(nW) || 4;
  const earnW = sdR2(sg.inSteady + sg.inBonus + sg.outFine);
  const wk = sdR2((x.loan || {}).weekly);
  const b = sdBonusRate(rules), irate = sdRule(rules, 'loan.ratePct') / 100;
  const perP = wk + sg.extra * (1 + b);
  const left = after.left;
  const leftP = sdR2(Math.max(0, left * (1 + irate * n / 52) - perP * n));
  const mxL = Math.max(1, left);
  const fwLoan = [['now', left], ['my plan', leftP]].map(([k, v]) => ({ k, value: v, v: m(v), w: v / mxL * 100 }));
  const fwAssume = sg.extra ? `paying ${m(wk)} + my ${m(sg.extra)} extra each week` : `paying ${m(wk)} each week, no extra`;
  const fwFree = left <= 0 ? '🎉 done' : leftP <= 0
    ? `🎉 paid off within ${n === 1 ? 'a week' : n === 4 ? 'a month' : '5 months'}`
    : `free by ${sdMonthYear(x.weekKey, perP > 0 ? Math.ceil(left / perP) : Infinity)}`;
  const gT = x.goal ? Number(x.goal.target) || 0 : 0;
  const gName = x.goal ? String(x.goal.name || '') : 'Goal';
  let toReady = 0;
  const rows = [['ready', '🏦 Savings'], ['goal', '🎯 ' + gName], ['gic', '🔒 Locked'], ['stock', '📈 Companies']].map(([k, name]) => {
    const bal = after.pots[k] || 0;
    let put = sdR2((sg[k] || 0) * n);
    if (k === 'goal' && gT > 0 && bal + put > gT) { toReady = sdR2(bal + put - gT); put = sdR2(Math.max(0, gT - bal)); }
    const earn = sdR2((bal + put / 2) * sdRate(rules, k) * n / 52);
    return { k, name, bal, put, earn, locked: (k === 'gic' || k === 'stock') && !sdIsOpen(k, Object.assign({}, x, { loan: after.loan }), rules) };
  });
  const loanSpill = sdR2(Math.max(0, perP * n - left * (1 + irate * n / 52)));
  rows[0].put = sdR2(rows[0].put + toReady + loanSpill);
  rows[0].earn = sdR2((rows[0].bal + rows[0].put / 2) * sdRate(rules, 'ready') * n / 52);
  const mk = v => v >= 100 ? '$' + Math.round(v) : m(v).replace('.00', '');
  const fwSave = rows.map(r => ({ k: r.name, key: r.k, put: r.put ? '+' + mk(r.put) : '—',
    earn: r.k === 'goal' ? 'none' : r.locked ? '🔒' : r.earn ? '+' + m(r.earn) : '$0',
    then: mk(sdR2(r.bal + r.put + r.earn)), locked: r.locked, value: sdR2(r.bal + r.put + r.earn) }));
  const pT = sdR2(rows.reduce((a, r) => a + r.put, 0)), eT = sdR2(rows.reduce((a, r) => a + r.earn, 0));
  const tT = sdR2(rows.reduce((a, r) => a + r.bal + r.put + r.earn, 0));
  return {
    weeks: n, fwEarn: m(earnW), fwTimes: n === 1 ? 'same again next week' : `× ${n} weeks, I'd earn`,
    fwEarnT: m(sdR2(earnW * n)), fwLoan, leftPlan: leftP, fwAssume, fwFree, fwSave,
    fwPutT: '+' + mk(pT), fwEarnI: '+' + m(eT), fwThenT: mk(tT), toReady, loanSpill,
    fwNote: `🎯 The goal jar earns no interest. It waits for what I'm buying.${toReady ? ` Goal full → ${mk(toReady)} goes to 🏦 Savings.` : ''}${loanSpill ? ` Loan done → ${mk(loanSpill)} of payments goes to 🏦 Savings.` : ''}`,
  };
}

/* ── 🎯 A new goal: what is in the old jar moves to the new one, or goes to
   🏦 Savings (a 'goal' request's `keep`). ── */
function sdNewGoal(pots, goal, keep) {
  const p = Object.assign({ ready: 0, goal: 0, gic: 0, stock: 0 }, pots || {});
  if (keep === 'ready') { p.ready = sdR2(p.ready + p.goal); p.goal = 0; }
  return { pots: p, goal: { name: (goal || {}).name || '', target: Number((goal || {}).target) || 0 } };
}

/* ── ⚙️ Grown-ups › Rules: what a change would do (prototype week/freeBy) ──
   `kids`: { jenn: { days, streakDays, sessions, fines: [itemId…], left,
   monthly }, … } — a typical week's shape. Saved vs pending rules, per girl:
   Typical week · Loan a week · Free by · Most to spend. */
function sdImpactWeek(R, k) {
  const tiers = ((R.streak || {}).tiers || []).slice().sort((a, b) => a.days - b.days);
  let streak = 0;
  tiers.forEach(t => { if ((Number(k.streakDays) || 0) >= t.days) streak = Number(t.bonus) || 0; });
  const items = (R.fines || {}).items || [];
  const counts = {};
  (k.fines || []).forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  const fines = Object.keys(counts).reduce((a, id) => {
    const it = items.find(i => i && i.id === id) || {};
    return a + Math.max(0, counts[id] - (Number(it.freeRepeats) || 0)) * (Number(it.amount) || 0);
  }, 0);
  return sdR2((Number(k.days) || 0) * sdRule(R, 'chores.dailyCap') + streak
    + (Number(k.sessions) || 0) * sdRule(R, 'sessions.perSession') - fines);
}
function sdImpactWeekly(R, kid, k) {
  const ruled = (((R.loan || {}).monthly) || {})[kid];
  const monthly = ruled != null ? Number(ruled) : Number(k.monthly) || 0;
  return sdR2(monthly * 12 / 52);
}
function sdImpact(saved, pending, kids, weekKey) {
  const m = sdMoney;
  const arrow = (a, b) => a === b ? a : `${a} → ${b}`;
  const freeBy = (R, kid, k) => {
    const wkly = sdImpactWeekly(R, kid, k);
    return sdMonthYear(weekKey, wkly > 0 ? Math.ceil((Number(k.left) || 0) / wkly) : Infinity);
  };
  const most = (R, kid, k) => m(sdR2(Math.max(0, sdImpactWeek(R, k) - sdImpactWeekly(R, kid, k)) * sdRule(R, 'spend.capPct') / 100));
  return Object.keys(kids || {}).map(kid => {
    const k = kids[kid];
    const rows = [
      ['Typical week', arrow(m(sdImpactWeek(saved, k)), m(sdImpactWeek(pending, k)))],
      ['Loan a week', arrow(m(sdImpactWeekly(saved, kid, k)), m(sdImpactWeekly(pending, kid, k)))],
      ['Free by', arrow(freeBy(saved, kid, k), freeBy(pending, kid, k))],
      ['Most to spend', arrow(most(saved, kid, k), most(pending, kid, k))],
    ].map(([key, v]) => ({ k: key, v, changed: v.indexOf('→') >= 0 }));
    return { kid, rows };
  });
}

// Inert in the browser; lets tests/sunday.test.js hold the pure core in Node.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SD_STEADY_KEYS, SD_BONUS_KEYS, SD_ALLOC_KEYS, SD_POT_KEYS, SD_GATE_STAGE, SD_PRESETS, SD_STICKERS,
    sdR2, sdMoney, sdRule, sdPlacedOf, sdDayKeyAdd, sdSundayOf, sdLockMaturesOn, sdMonthYear, sdShortDay,
    sdCapWords, sdPercents, sdPercentLabel, sdBuysOf, sdIncome, sdWeekCat, sdSessionsLine,
    sdLeft, sdPaidPct, sdMustPay, sdLoanInterest, sdMatured, sdPile, sdHers, sdSafeOk, sdIsOpen,
    sdCanPlace, sdPlace, sdSetPull, sdSetAdvance, sdPresets, sdStickersFor, sdCheckInOut, sdSign,
    sdVerdicts, sdForecast, sdNewGoal, sdImpactWeek, sdImpactWeekly, sdImpact,
  };
}
