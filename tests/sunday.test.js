// Weekly-Planner — the Sunday ritual's pure core (js/43-sunday-core.js).
// Run: node tests/sunday.test.js  (also runs as part of `npm test`)
//
// Plan v3 §H. The core is the prototype's arithmetic as functions of explicit
// inputs, so this file can do what the prototype could only be clicked
// through: run 8 to 20 Sundays for BOTH girls with random but valid choices,
// and assert, every single week,
//
//   · In = Out to the cent;
//   · the cents are never more than $0.99 and go to Savings — or, below the
//     🏦 Savings gate, on the loan as extra with the goal jar's overflow
//     (Plan v5 Deviation 8);
//   · the loan is never negative and never overpaid;
//   · interest is added exactly every 4th Sunday;
//   · a lock comes back on the Saturday before the 4th-next Sunday;
//   · the goal jar never passes its goal — the rest goes to Savings;
//   · 🏦 Savings, 🔒 Locked away and 📈 Companies open at 20 / 30 / 40 % paid
//     and never re-lock;
//   · cash out never passes its cap and an advance never passes its maximum;
//   · the passbook shares add to exactly 100, with "<1%" for a tiny one —
//
// then the handoff's edge cases one by one. Rules are read from
// MR_DEFAULT_RULES through js/18-rules.js's module guard, so a price changed
// in the app is the price tested here.
//
// A check passes only by being exactly true — see ARCHITECTURE.md
// "Verification": a truthy findings array is a failure, never a pass.
process.env.TZ = 'UTC';
const path = require('path');
const s = require(path.join(__dirname, '..', 'js', '43-sunday-core.js'));
const { MR_DEFAULT_RULES } = require(path.join(__dirname, '..', 'js', '18-rules.js'));

const R = JSON.parse(JSON.stringify(MR_DEFAULT_RULES));
let pass = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond === true) { pass++; console.log('PASS ' + name); }
  else {
    const why = detail != null ? detail : (cond === false ? '' : JSON.stringify(cond));
    fails.push(name + (why ? ' — ' + why : ''));
    console.log('FAIL ' + name + (why ? ' — ' + why : ''));
  }
}
const r2 = s.sdR2;

/* ── The rules the ritual reads come from the rulebook ── */
check('the Sunday rules are in the shipped rulebook (Plan v3 §C)',
  R.sessions.perSession === 6 && R.advance.maxPerWeek === 5 && R.spend.capPct === 20
  && R.loan.ratePct === 1 && R.loan.interestEverySundays === 4 && R.loan.extraBonusPct === 10
  && R.pots.safety === 10 && R.pots.lockWeeks === 4
  && R.pots.rates.ready === 1.5 && R.pots.rates.gic === 4 && R.pots.rates.stock === 7
  && R.school.stagePct.ready === 20 && R.school.stagePct.locked === 30 && R.school.stagePct.stock === 40
  && R.words.jenn === 1 && R.words.jess === 1 && R.market.wobblePct === 0
    ? true : 'a §C path is missing or has the wrong default');
check('Savings opens at 20% paid (Plan v5 Deviation 8) and the order rule holds',
  R.school.stagePct.ready === 20
  && R.school.stagePct.ready <= R.school.stagePct.locked && R.school.stagePct.locked <= R.school.stagePct.stock
  && R.school.stagePct.stock <= 100);
check('the forgiving day counts (Plan v5 Deviation 30)',
  R.streak.graceDays === 1 && R.streak.graceCounts === true);

/* ── A seeded random source, so a failure is reproducible ── */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const between = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

/* The two girls as the prototype drew them (Sunday v15 KIDS), plus a third
   start below the 🏦 Savings gate (10% paid) so every run also crosses 20%. */
function startOf(kid) {
  if (kid === 'low') {
    return { weekKey: '2026-09-28', week: 0, loan: { principal: 600, paid: 60, interest: 0, arrears: 0, weekly: r2(40 * 12 / 52) },
      pots: { ready: 0, goal: 4, gic: 0, stock: 0 }, locks: [],
      goal: { name: 'Swim goggles', target: 12 }, histCat: [], stickers: [], sinceInterest: 0, advOwed: 0 };
  }
  return kid === 'jenn'
    ? { weekKey: '2026-09-28', week: 0, loan: { principal: 1000, paid: 300, interest: 0, arrears: 0, weekly: r2(70 * 12 / 52) },
        pots: { ready: 12, goal: 8, gic: 5, stock: 0 }, locks: [{ amount: 5, back: 1 }],
        goal: { name: 'New skate guards', target: 35 }, histCat: [], stickers: [], sinceInterest: 0, advOwed: 0 }
    : { weekKey: '2026-09-28', week: 0, loan: { principal: 800, paid: 240, interest: 0, arrears: 0, weekly: r2(56 * 12 / 52) },
        pots: { ready: 6, goal: 0, gic: 0, stock: 0 }, locks: [],
        goal: { name: 'Book set', target: 50 }, histCat: [], stickers: [], sinceInterest: 0, advOwed: 0 };
}

/* One Sunday's income, random but valid: chores by the day, the streak's
   tiers, ⛸️ sessions answered ✓ / ✗, a meet or a gift some weeks, what her
   pots earned, and a fine now and then. */
function incomeFor(rand, st) {
  const sessions = Array.from({ length: between(rand, 0, 4) }, () => ({ attended: rand() < 0.8 }));
  const pa = s.sdSessionsLine(sessions, R);
  const ret = r2((st.pots.ready * R.pots.rates.ready / 100 + st.pots.gic * R.pots.rates.gic / 100
    + st.pots.stock * R.pots.rates.stock / 100) / 52);
  return [
    { key: 'jobs', label: '🧹 Chores', amount: between(rand, 0, 7) * R.chores.dailyCap },
    { key: 'streak', label: '🔥 Routine streak', amount: pick(rand, [0, 1, 2, 3]) },
    { key: 'pa', label: '⛸️ Assistant job', amount: pa.amount },
    { key: 'comp', label: '🏆 Competitions', amount: rand() < 0.3 ? between(rand, 5, 30) : 0 },
    { key: 'gifts', label: '🎁 Gifts', amount: rand() < 0.2 ? between(rand, 3, 20) : 0 },
    { key: 'ret', label: '💹 My pots earned', amount: ret },
    { key: 'fine', label: '📦 Fine', amount: rand() < 0.25 ? -1 : 0 },
  ];
}

/* Place every dollar: a preset some weeks, random taps and holds otherwise.
   A refused tap is simply a different choice — the core said why. */
function placeAll(rand, w) {
  let a = s.sdPresets(w, R).filter(p => !p.locked);
  if (rand() < 0.35 && a.length) return pick(rand, a).alloc;
  let cur = Object.assign({}, w, { alloc: {} });
  for (let guard = 0; guard < 400; guard++) {
    const P = s.sdPile(cur, R);
    if (P.pile <= 0) return cur.alloc;
    const k = guard > 300 ? 'extra' : pick(rand, ['extra', 'extra', 'ready', 'goal', 'gic', 'stock', 'spend', 'spend']);
    const r = s.sdPlace(cur, k, 1, rand() < 0.3 ? 5 : 1, R);
    if (r.ok) {
      cur = Object.assign({}, cur, { alloc: r.alloc });
      // Now and then she changes her mind about a dollar.
      if (rand() < 0.08) {
        const back = s.sdPlace(cur, k, -1, 1, R);
        if (back.ok) cur = Object.assign({}, cur, { alloc: back.alloc });
      }
    }
  }
  return cur.alloc;
}

/* ── 8–20 Sundays, both girls, every invariant every week ── */
{
  const bad = [];
  let weeksRun = 0, interestWeeks = 0, locksBack = 0, crossedSeen = {}, presetsLocked = 0, shutWeeks = 0, overSeen = 0;
  for (let seed = 1; seed <= 60 && bad.length < 12; seed++) {
    ['jenn', 'jess', 'low'].forEach(kid => {
      const rand = rng(seed * 7919 + ({ jenn: 1, jess: 2, low: 3 })[kid]);
      const N = 8 + (seed % 13);                      // 8 … 20 Sundays
      let st = startOf(kid);
      const wasOpen = { ready: false, gic: false, stock: false };
      for (let i = 0; i < N && bad.length < 12; i++) {
        const tag = `${kid} seed ${seed} Sunday ${i + 1}`;
        const lines = incomeFor(rand, st);
        const w = {
          weekKey: s.sdDayKeyAdd('2026-09-28', 7 * i), week: st.week, lines,
          loan: st.loan, pots: st.pots, locks: st.locks, goal: st.goal,
          pull: {}, adv: { owed: st.advOwed, manual: 0 }, alloc: {},
          histCat: st.histCat, stickers: st.stickers, guess: between(rand, 10, 60),
          hist: [], coming: [['Club time trials', 'Sun 18 Oct']],
        };
        // Sometimes she takes a dollar or two from Savings above the 🛟 line,
        // or asked to draw early during the week.
        if (rand() < 0.3) { const p = s.sdSetPull(w, 'ready', 1, R); if (p.ok) w.pull = p.pull; }
        if (rand() < 0.3) {
          let adv = w.adv;
          for (let t = 0; t < between(rand, 1, 6); t++) {
            const r = s.sdSetAdvance(Object.assign({}, w, { adv }), 1, R);
            if (r.ok) adv = r.adv;
          }
          w.adv = adv;
        }
        if (w.adv.owed + w.adv.manual > R.advance.maxPerWeek) bad.push(`${tag}: advance ${w.adv.owed + w.adv.manual} over the maximum`);
        const P = s.sdPile(w, R);
        w.alloc = placeAll(rand, w);
        const cap = Math.floor(r2(P.hers * R.spend.capPct / 100) + 1e-9);
        if ((w.alloc.spend || 0) > cap) bad.push(`${tag}: cash out ${w.alloc.spend} over the cap ${cap}`);
        const pre = s.sdPresets(w, R);
        presetsLocked += pre.filter(p => p.locked).length;
        const res = s.sdSign(w, R);
        if (!res.ok) { bad.push(`${tag}: sign refused — ${res.why}`); break; }
        const sg = res.signed;
        // In = Out
        if (!res.check.ok) bad.push(`${tag}: In ${res.check.in} ≠ Out ${res.check.out}`);
        // Cents: to Savings above the gate; below it, with the jar's overflow,
        // on the loan as extra — and Savings takes nothing but a spill.
        if (!(sg.cents >= 0 && sg.cents <= 0.99)) bad.push(`${tag}: cents ${sg.cents}`);
        const readyOpen0 = s.sdIsOpen('ready', w, R);
        if (readyOpen0) {
          if (r2(sg.ready - (w.alloc.ready || 0) - sg.spill - sg.cents) < -0.001) bad.push(`${tag}: the cents did not reach Savings`);
          if (sg.overToLoan !== 0) bad.push(`${tag}: ${sg.overToLoan} went on the loan with Savings open`);
        } else {
          shutWeeks++;
          if (w.alloc.ready) bad.push(`${tag}: $${w.alloc.ready} placed in Savings below its gate`);
          if (sg.ready !== sg.spill) bad.push(`${tag}: Savings took ${sg.ready} below its gate (spill ${sg.spill})`);
          const over = r2(sg.cents + Math.max(0, (w.alloc.goal || 0) - sg.goal));
          if (sg.overToLoan !== over) bad.push(`${tag}: cents + overflow ${over}, on the loan ${sg.overToLoan}`);
          if (sg.overToLoan > 0) overSeen++;
          if (P.centsTo !== 'extra') bad.push(`${tag}: the pile says the cents go to ${P.centsTo}`);
        }
        // Loan never negative, never overpaid
        const L = res.after.loan;
        if (s.sdLeft(L) < 0 || L.paid > L.principal + 0.001) bad.push(`${tag}: loan ${JSON.stringify(L)}`);
        if (r2(sg.loanCash + sg.adv) > r2(P.total) + 0.001 && P.total >= 0) bad.push(`${tag}: paid more than the pile held`);
        // Goal jar never past its goal
        if (st.goal.target > 0 && res.after.pots.goal > st.goal.target + 0.001 && st.pots.goal <= st.goal.target) {
          bad.push(`${tag}: the goal jar holds ${res.after.pots.goal} of ${st.goal.target}`);
        }
        // A lock comes back on the Saturday before the 4th-next Sunday
        res.after.locks.filter(l => l.on && l.back === st.week + 1 + R.pots.lockWeeks).forEach(l => {
          const sat = s.sdDayKeyAdd(s.sdSundayOf(w.weekKey), 7 * R.pots.lockWeeks - 1);
          if (l.on !== sat || new Date(l.on + 'T00:00:00Z').getUTCDay() !== 6) bad.push(`${tag}: lock back on ${l.on}, expected Saturday ${sat}`);
        });
        locksBack += s.sdMatured(w) > 0 ? 1 : 0;
        // Shares add to 100
        const shares = [sg.pay ? sg.loanCash : 0, r2(sg.ready + sg.goal + sg.gic + sg.stock), sg.wallet];
        const tot = r2(shares.reduce((a, v) => a + v, 0));
        const pc = s.sdPercents(shares, tot);
        if (tot > 0 && pc.reduce((a, v) => a + v, 0) !== 100) bad.push(`${tag}: shares ${pc} of ${tot}`);
        pc.forEach((p, j) => { if (p === 0 && shares[j] > 0 && s.sdPercentLabel(p, shares[j]) !== '<1%') bad.push(`${tag}: a tiny share is not "<1%"`); });
        // Gates: open at 20 / 30 / 40 % paid, and never re-lock
        const pct = s.sdPaidPct(L);
        ['ready', 'gic', 'stock'].forEach(k => {
          const open = s.sdIsOpen(k, { loan: L }, R);
          const gate = R.school.stagePct[s.SD_GATE_STAGE[k]];
          if (open !== (pct >= gate)) bad.push(`${tag}: ${k} open=${open} at ${pct}% (gate ${gate})`);
          if (wasOpen[k] && !open) bad.push(`${tag}: ${k} re-locked at ${pct}%`);
          wasOpen[k] = open;
        });
        if (res.crossed) crossedSeen[res.crossed] = true;
        // Roll forward to next Sunday: interest every 4th Sunday.
        const li = s.sdLoanInterest(L, st.sinceInterest, R);
        const due = (i + 1) % R.loan.interestEverySundays === 0;
        if (s.sdLeft(L) > 0 && due !== (li.interest > 0)) bad.push(`${tag}: interest ${li.interest} on Sunday ${i + 1}`);
        if (li.interest > 0) {
          interestWeeks++;
          // The prototype's `left * rate / 100 * 4 / 52`, with `left += int`: on
          // the whole balance still owed, earlier interest included.
          const want = r2(s.sdLeft(L) * R.loan.ratePct / 100 * R.loan.interestEverySundays / 52);
          if (li.interest !== want) bad.push(`${tag}: interest ${li.interest}, expected ${want} on the whole balance left`);
        }
        st = { weekKey: w.weekKey, week: res.after.week, loan: li.loan, pots: res.after.pots, locks: res.after.locks,
               goal: st.goal, histCat: res.after.histCat, stickers: res.after.stickers,
               sinceInterest: li.sundaysSince, advOwed: res.after.advOwed };
        weeksRun++;
      }
    });
  }
  check('8–20 Sundays, both girls: every invariant held every week',
    bad.length === 0 ? true : bad.slice(0, 12).join(' | '));
  check('the runs really ran (weeks, interest, locks coming back, gates crossed, weeks below 20%)',
    weeksRun > 1500 && interestWeeks > 300 && locksBack > 20 && crossedSeen.ready && Object.keys(crossedSeen).length >= 2
    && shutWeeks > 50 && overSeen > 20
      ? true : JSON.stringify({ weeksRun, interestWeeks, locksBack, crossedSeen, presetsLocked, shutWeeks, overSeen }));
}

/* ── Edge cases from the handoff (§7.2) ── */
function weekOf(over) {
  return Object.assign({
    weekKey: '2026-09-28', week: 0,
    lines: [{ key: 'jobs', label: '🧹 Chores', amount: 15 }, { key: 'streak', label: '🔥 Routine streak', amount: 3 },
            { key: 'pa', label: '⛸️ Assistant job', amount: 12 }],
    loan: { principal: 1000, paid: 300, interest: 0, arrears: 0, weekly: r2(70 * 12 / 52) },
    pots: { ready: 12, goal: 8, gic: 0, stock: 0 }, locks: [], pull: {}, adv: { owed: 0, manual: 0 },
    alloc: {}, goal: { name: 'New skate guards', target: 35 }, hist: [30, 30, 30, 30], coming: [],
  }, over || {});
}
function fill(w, k) {
  const P = s.sdPile(w, R);
  return Object.assign({}, w, { alloc: Object.assign({}, w.alloc, { [k || 'extra']: ((w.alloc || {})[k || 'extra'] || 0) + P.pile }) });
}

// All sessions missed: $0, and not a fine.
{
  const line = s.sdSessionsLine([{ attended: false }, { attended: false }, { attended: false }], R);
  const w = fill(weekOf({ lines: [{ key: 'jobs', label: '🧹 Chores', amount: 15 }, Object.assign({ label: '⛸️ Assistant job' }, line)] }));
  const res = s.sdSign(w, R);
  check('all sessions missed: the assistant job pays $0 and nothing is fined',
    line.amount === 0 && line.attended === 0 && res.ok && res.signed.outFine === 0 ? true : JSON.stringify(line));
  const open = s.sdSessionsLine([{ attended: null }, { attended: true }], R);
  check('an unanswered session pays nothing until somebody answers',
    open.amount === R.sessions.perSession && open.open === 1);
}

// Zero bonus: all steady.
{
  const w = fill(weekOf());
  const res = s.sdSign(w, R);
  const v = s.sdVerdicts(res, w, R);
  check('zero bonus: the verdict says it all came from steady work',
    v.income.lines.includes('👍 All from steady work. I can do this every week.')
    && !v.income.lines.some(t => /^🎲/.test(t)) && v.income.head === '✅ I can keep this up'
      ? true : v.income);
}

// Steady below the must-pay: 🚨, the rest carried with no interest.
{
  const w = weekOf({ lines: [{ key: 'jobs', label: '🧹 Chores', amount: 6 }, { key: 'streak', label: '🔥 Routine streak', amount: 1 }],
                     loan: { principal: 1000, paid: 300, interest: 0, arrears: 0, weekly: 16.15 } });
  const P = s.sdPile(w, R);
  const res = s.sdSign(w, R);
  const v = s.sdVerdicts(res, w, R);
  check('steady < must-pay: the loan takes what there is and nothing is left to place',
    P.minNow === 7 && P.hers === 0 && P.shortfall === 9.15 ? true : JSON.stringify(P));
  check('steady < must-pay: the shortfall is carried to next Sunday',
    res.ok && res.after.loan.arrears === 9.15 && s.sdMustPay(res.after.loan) === r2(16.15 + 9.15)
      ? true : JSON.stringify(res.after && res.after.loan));
  check('steady < must-pay: 🚨 Not safe yet and 🚨 Risky',
    v.income.head === '🚨 Not safe yet' && v.strategy.name === '🚨 Risky'
    && v.strategy.why === "If bonus weeks stop, I can't make my $16.15 payment. That is how people go broke."
      ? true : JSON.stringify([v.income.head, v.strategy.name, v.strategy.why]));
  const li = s.sdLoanInterest(res.after.loan, 3, R);
  check('steady < must-pay: no interest on what was carried',
    li.interest === r2(s.sdLeft(res.after.loan) * R.loan.ratePct / 100 * 4 / 52) ? true : li.interest);
}

// Interest compounds as drawn: the prototype adds `left * rate / 100 * 4 / 52`
// to `left`, so the next interest is charged on the earlier interest too.
{
  const L0 = { principal: 1000, paid: 300, interest: 0, arrears: 0, weekly: 16.15 };
  const a = s.sdLoanInterest(L0, 3, R);
  const b = s.sdLoanInterest(a.loan, 3, R);
  const wantA = r2(700 * R.loan.ratePct / 100 * 4 / 52);
  const wantB = r2((700 + wantA) * R.loan.ratePct / 100 * 4 / 52);
  check('interest is charged on the whole balance left, earlier interest included',
    a.interest === wantA && b.interest === wantB && b.loan.interest === r2(wantA + wantB)
      ? true : JSON.stringify({ a: a.interest, wantA, b: b.interest, wantB, total: b.loan.interest }));
  const big = { principal: 100000, paid: 0, interest: 5000, arrears: 0, weekly: 1 };
  const c = s.sdLoanInterest(big, 3, R);
  check('interest on a balance that already carries interest counts that interest',
    c.interest === r2(105000 * R.loan.ratePct / 100 * 4 / 52) ? true : c.interest);
}

// Spend cap hit.
{
  let w = weekOf();
  const P = s.sdPile(w, R);
  const cap = Math.floor(P.hers * R.spend.capPct / 100);
  let last;
  for (let i = 0; i < 40; i++) { last = s.sdPlace(w, 'spend', 1, 1, R); if (!last.ok) break; w = Object.assign({}, w, { alloc: last.alloc }); }
  check('spend cap: cash out stops at a fifth of her share and says so',
    w.alloc.spend === cap && last.ok === false && last.why === 'full · a fifth of my share'
      ? true : JSON.stringify({ spend: w.alloc.spend, cap, why: last.why }));
  const R2 = JSON.parse(JSON.stringify(R)); R2.spend.capPct = 25;
  const off = s.sdPlace(w, 'spend', 1, 1, R2);
  check('the cap words follow the rule', off.ok || off.why === 'full · a quarter of my share');
}

// Advance at the maximum; an advance forgotten until payday.
{
  let w = weekOf({ adv: { owed: 3, manual: 0 } });
  const one = s.sdSetAdvance(w, 1, R); w = Object.assign({}, w, { adv: one.adv });
  const two = s.sdSetAdvance(w, 1, R); w = Object.assign({}, w, { adv: two.adv });
  const three = s.sdSetAdvance(w, 1, R);
  check('advance at max: $3 asked + $2 forgotten is the most; a third dollar is refused',
    one.ok && two.ok && !three.ok && w.adv.manual === 2 && three.why === 'up to $5 early, from next Sunday'
      ? true : JSON.stringify([one, two, three]));
  const P = s.sdPile(w, R);
  const res = s.sdSign(fill(w), R);
  check('a forgotten advance comes off this payday, counts as cash out, and In = Out',
    P.advTaken === 5 && res.ok && res.signed.adv === 5 && res.signed.wallet === 5 && res.check.ok
      ? true : JSON.stringify({ P, sg: res.signed }));
}

// Loan fully paid: the extra beyond the wall spills to Savings; 🎉.
{
  const w0 = weekOf({ loan: { principal: 100, paid: 92, interest: 0, arrears: 0, weekly: 16.15 } });
  const w = fill(w0, 'extra');
  const res = s.sdSign(w, R);
  const v = s.sdVerdicts(res, w, R);
  check('loan paid off: the wall is done and nothing was overpaid',
    res.ok && s.sdLeft(res.after.loan) === 0 && res.after.loan.paid === 100 ? true : JSON.stringify(res.after.loan));
  check('loan paid off: the extra it did not need goes to 🏦 Savings',
    res.signed.spill > 0 && res.signed.ready >= res.signed.spill && res.check.ok ? true : JSON.stringify(res.signed));
  check('loan paid off: 🎉 Loan free',
    v.strategy.name === '🎉 Loan free' && v.strategy.why === 'The wall is done. Every payday is all mine now.');
  const f = s.sdForecast(res, w, R, 4);
  check('loan paid off: the forecast says done', f.fwFree === '🎉 done');
}

// Goal reached: the jar stops at the goal, the rest goes to Savings.
{
  const w = weekOf({ pots: { ready: 20, goal: 30, gic: 0, stock: 0 } });
  const P = s.sdPile(w, R);
  const alloc = { goal: 10, extra: P.hers - 10 };
  const res = s.sdSign(Object.assign({}, w, { alloc }), R);
  const v = s.sdVerdicts(res, w, R);
  check('goal reached: the jar holds exactly its goal and the overflow is in Savings',
    res.ok && res.after.pots.goal === 35 && res.signed.goal === 5
    && res.after.pots.ready === r2(20 + 5 + P.cents) ? true : JSON.stringify(res.after.pots));
  check('goal reached: the verdict says so', v.strategy.lines[1].indexOf('goal reached!') >= 0 ? true : v.strategy.lines[1]);
  const f = s.sdForecast(res, Object.assign({}, w, { alloc }), R, 4);
  check('the forecast never fills the jar past its goal', f.fwSave[1].value <= 35 ? true : JSON.stringify(f.fwSave[1]));
  // Plan v18 Stage 7: a goal named with its own picture is not given a second (🎯 🛼).
  const pic = s.sdForecast(res, Object.assign({}, w, { alloc, goal: Object.assign({}, w.goal, { name: '🛼 New skate guards' }) }), R, 4);
  const bare = s.sdForecast(res, Object.assign({}, w, { alloc, goal: Object.assign({}, w.goal, { name: 'skate guards' }) }), R, 4);
  check("the forecast keeps a goal's own picture and adds 🎯 only to a bare name",
    pic.fwSave[1].k === '🛼 New skate guards' && bare.fwSave[1].k === '🎯 skate guards' ? true : JSON.stringify([pic.fwSave[1].k, bare.fwSave[1].k]));
}

// A new goal: the jar's money moves, or goes to Savings.
{
  const pots = { ready: 12, goal: 8, gic: 0, stock: 0 };
  const moved = s.sdNewGoal(pots, { name: 'Book set', target: 50 }, 'move');
  const saved = s.sdNewGoal(pots, { name: 'Book set', target: 50 }, 'ready');
  check('new goal, "use it for the new goal": the $8 stays in the jar',
    moved.pots.goal === 8 && moved.pots.ready === 12 && moved.goal.target === 50);
  check('new goal, "put it in Savings": the $8 goes to Savings and the jar starts at $0',
    saved.pots.goal === 0 && saved.pots.ready === 20);
}

// A rules change takes effect next week only.
{
  const R2 = JSON.parse(JSON.stringify(R)); R2.spend.capPct = 50; R2.sessions.perSession = 8;
  const w1 = weekOf();
  let a1 = w1;
  for (let i = 0; i < 40; i++) { const r = s.sdPlace(a1, 'spend', 1, 1, R); if (!r.ok) break; a1 = Object.assign({}, a1, { alloc: r.alloc }); }
  const res1 = s.sdSign(fill(a1), R);
  const frozen = JSON.stringify(res1.signed);
  // Next week is lived under the new rules …
  const w2 = Object.assign(weekOf({ weekKey: '2026-10-05', week: 1, loan: res1.after.loan, pots: res1.after.pots }), {});
  let a2 = w2;
  for (let i = 0; i < 40; i++) { const r = s.sdPlace(a2, 'spend', 1, 1, R2); if (!r.ok) break; a2 = Object.assign({}, a2, { alloc: r.alloc }); }
  const H2 = s.sdPile(w2, R2).hers;
  check('a rules change: next Sunday caps cash out by the new rule',
    a2.alloc.spend === Math.floor(H2 * 0.5) && a1.alloc.spend === Math.floor(s.sdPile(w1, R).hers * 0.2)
      ? true : JSON.stringify([a1.alloc.spend, a2.alloc.spend]));
  check('a rules change: the session rate is next week\'s', s.sdSessionsLine([{ attended: true }], R2).amount === 8);
  // … and this Sunday's signed record is not touched by it.
  s.sdSign(fill(a2), R2);
  check('a rules change: the week already signed keeps what it was signed under',
    JSON.stringify(res1.signed) === frozen);
}

/* ── Signing refuses with a sentence, never silently ── */
{
  const w = weekOf();
  const P = s.sdPile(w, R);
  const res = s.sdSign(w, R);
  check('money still in the pile: "place $X first"', !res.ok && res.why === `place $${P.pile} first`);
  const bad = s.sdCheckInOut({ inSteady: 10, inBonus: 0, inBank: 0, outFine: 0, adv: 0, loanCash: 5, wallet: 0, ready: 4, goal: 0, gic: 0, stock: 0 });
  check('In ≠ Out is refused with the figures', !bad.ok && bad.why === 'In $10.00 ≠ Out $9.00 — nothing was signed.');
}

/* ── Gates and the 🛟 line ── */
{
  const w = weekOf({ loan: { principal: 1000, paid: 250, interest: 0, arrears: 0, weekly: 16.15 }, pots: { ready: 4, goal: 0, gic: 0, stock: 0 } });
  check('🔒 Locked away is shut below 30% paid, with the rule\'s number',
    s.sdCanPlace('gic', w, R).why === '🔒 opens at 30% paid');
  const w2 = weekOf({ loan: { principal: 1000, paid: 300, interest: 0, arrears: 0, weekly: 16.15 }, pots: { ready: 4, goal: 0, gic: 0, stock: 0 } });
  check('at 30% it opens — once 🛟 Savings is filled', s.sdCanPlace('gic', w2, R).why === '🛟 fill Savings to $10 first');
  check('📈 Companies waits for 40%', s.sdCanPlace('stock', w2, R).why === '🔒 opens at 40% paid');
  check('at 25% paid Savings is open; the wall and cash out always are',
    ['ready', 'extra', 'spend'].every(k => s.sdCanPlace(k, w, R).ok));
  const pre = s.sdPresets(w, R);
  check('"⚖️ Watch it grow" is locked under 30% and says the gate', pre[2].locked && pre[2].label === '⚖️ Watch it grow 🔒30%');
  const fresh = weekOf({ loan: { principal: 1000, paid: 290, interest: 0, arrears: 0, weekly: 16.15 } });
  const res = s.sdSign(fill(fresh, 'extra'), R);
  check('crossing 30% is the milestone', res.ok && res.crossed === 'gic' ? true : res.crossed);
  check('no loan at all: every pot is open', s.sdIsOpen('stock', { loan: { principal: 0, paid: 0 } }, R));
}

/* ── Below the 🏦 Savings gate (Plan v5 Deviation 8) ──
   At 15% paid Savings is shut with the rule's number; the wall and cash out
   are open; the goal jar waits for Savings (Deviation 31); a jar already
   holding money still never passes its goal — the cents and the jar's overflow go on the loan as extra, counted at
   1 + bonus; crossing 20% is a milestone. */
{
  const low = { principal: 1000, paid: 150, interest: 0, arrears: 0, weekly: 16.15 };
  const lines = [{ key: 'jobs', label: '🧹 Chores', amount: 15 }, { key: 'streak', label: '🔥 Routine streak', amount: 3 },
                 { key: 'pa', label: '⛸️ Assistant job', amount: 12 }, { key: 'ret', label: '💹 My pots earned', amount: 0.4 }];
  const w = weekOf({ loan: low, lines, pots: { ready: 0, goal: 30, gic: 0, stock: 0 } });
  check('🏦 Savings is shut below 20% paid, with the rule’s number',
    s.sdCanPlace('ready', w, R).why === '🔒 opens at 20% paid' && !s.sdIsOpen('ready', w, R));
  check('below 20%: the wall and cash out are open',
    ['extra', 'spend'].every(k => s.sdCanPlace(k, w, R).ok) ? true : JSON.stringify(['extra', 'spend'].map(k => s.sdCanPlace(k, w, R))));
  // Plan v5 Deviation 31 (owner, after Stage 3a): goal jars wait for Savings.
  check('below 20%: the goal jar waits for Savings, with the rule’s number',
    s.sdCanPlace('goal', w, R).why === '🔒 opens at 20% paid' ? true : JSON.stringify(s.sdCanPlace('goal', w, R)));
  const P = s.sdPile(w, R);
  check('below 20%: the pile says the cents go on the loan', P.centsTo === 'extra' && P.cents > 0 ? true : JSON.stringify(P));
  const alloc = { goal: 10, extra: P.hers - 10 };
  const res = s.sdSign(Object.assign({}, w, { alloc }), R);
  const b = R.loan.extraBonusPct / 100;
  const over = r2(P.cents + 5);                     // the jar takes $5 of the $10
  check('below 20%: the cents and the jar’s overflow go on the loan as extra',
    res.ok && res.signed.goal === 5 && res.signed.overToLoan === over && res.signed.ready === 0
    && res.after.pots.ready === 0 && res.after.pots.goal === 35 && res.check.ok
      ? true : JSON.stringify({ sg: res.signed, pots: res.after && res.after.pots }));
  check('below 20%: that extra is counted at 1 + bonus',
    res.after.loan.paid === r2(150 + P.minNow + (alloc.extra + over) * (1 + b)) && res.signed.extra === r2(alloc.extra + over)
      ? true : JSON.stringify({ paid: res.after.loan.paid, want: r2(150 + P.minNow + (alloc.extra + over) * (1 + b)) }));
  const pre = s.sdPresets(w, R).find(p => p.id === 'saving');
  check('below 20%: "🎯 For my goal" sends the shut jar’s share to the wall, not Savings',
    pre && !pre.alloc.ready && !pre.alloc.goal && pre.alloc.extra === P.hers ? true : JSON.stringify(pre));
  const f = s.sdForecast(res, Object.assign({}, w, { alloc }), R, 4);
  check('below 20%: the forecast puts a full jar’s overflow on the loan',
    f.toReady === 0 && f.overLoan > 0 && /goes on the 🧱 loan/.test(f.fwNote) ? true : JSON.stringify([f.toReady, f.overLoan, f.fwNote]));
  const near = weekOf({ loan: { principal: 1000, paid: 190, interest: 0, arrears: 0, weekly: 16.15 } });
  const crossed = s.sdSign(fill(near, 'extra'), R);
  check('crossing 20% is the milestone', crossed.ok && crossed.crossed === 'ready' ? true : crossed.crossed);
  const at20 = weekOf({ loan: { principal: 1000, paid: 200, interest: 0, arrears: 0, weekly: 16.15 }, lines });
  const P20 = s.sdPile(at20, R);
  const res20 = s.sdSign(fill(at20, 'extra'), R);
  check('at 20% the cents go to Savings again and nothing extra goes on the loan',
    P20.centsTo === 'ready' && res20.signed.overToLoan === 0 && res20.signed.ready === P20.cents ? true : JSON.stringify(res20.signed));
}

/* ── 📌 The must-pay the app priced (Stage 4) ──
   `loan.mustPay` is this Sunday's figure from the loan's owner — a grown-up's
   agreed-down payment included — and the pile takes exactly that, never more
   than is owed; what it does not take is carried, never charged. */
{
  const base = weekOf({});
  const P0 = s.sdPile(base, R);
  const down = weekOf({ loan: Object.assign({}, base.loan, { mustPay: r2(P0.mustPay - 5) }) });
  const P1 = s.sdPile(down, R);
  check('a must-pay agreed down by $5 frees $5 for her, to the dollar',
    P1.mustPay === r2(P0.mustPay - 5) && P1.hers === P0.hers + 5 ? true : JSON.stringify([P0.mustPay, P1.mustPay, P0.hers, P1.hers]));
  const big = weekOf({ loan: { principal: 100, paid: 95, interest: 0, arrears: 0, weekly: 16.15, mustPay: 40 } });
  check('a must-pay never takes more than is owed', s.sdPile(big, R).mustPay === 5 ? true : s.sdPile(big, R).mustPay);
}

/* ── A placement is never negative, never more than the pile (Stage 4) ── */
{
  const w = weekOf({});
  const P = s.sdPile(w, R);
  const neg = s.sdSign(Object.assign({}, w, { alloc: { extra: P.hers + 3, spend: -3 } }), R);
  check('a negative box refuses the sign', !neg.ok && /\$0 or more/.test(neg.why) ? true : JSON.stringify(neg));
  const over = s.sdSign(Object.assign({}, w, { alloc: { extra: P.hers + 2 } }), R);
  check('placing more than the pile refuses the sign', !over.ok && /more than my pile/.test(over.why) ? true : JSON.stringify(over));
}

/* ── 🔥 The routine clue (Plan v5 Deviation 30) ── */
{
  check('the clue line: 7 days = $3 · 6 with a forgiving day = $3',
    s.sdStreakClue(R) === '7 days = $3 · 6 with a forgiving day = $3' ? true : s.sdStreakClue(R));
  const old = JSON.parse(JSON.stringify(R)); delete old.streak.graceCounts;
  check('a week lived before the rule: 6 with a forgiving day = $2',
    s.sdStreakClue(old) === '7 days = $3 · 6 with a forgiving day = $2' ? true : s.sdStreakClue(old));
  const none = JSON.parse(JSON.stringify(R)); none.streak.graceDays = 0;
  check('no forgiving day: the clue is the top tier only', s.sdStreakClue(none) === '7 days = $3' ? true : s.sdStreakClue(none));
  const clues = s.sdClues(R);
  check('Sunday’s four clues read the rules',
    clues.length === 4 && clues[0].v === '$3 a day · $6 a session' && clues[1].k === '🔥 Routine'
    && clues[1].v === '7 days = $3 · 6 with a forgiving day = $3' ? true : JSON.stringify(clues));
}

/* ── The prototype's own words, at the default rules ── */
{
  const w = weekOf({ lines: [{ key: 'jobs', label: '🧹 Chores', amount: 15 }, { key: 'streak', label: '🔥 Routine streak', amount: 3 },
    { key: 'pa', label: '⛸️ Assistant job', amount: 12 }, { key: 'comp', label: '🏆 Competitions', amount: 18 },
    { key: 'gifts', label: '🎁 Gifts', amount: 5 }, { key: 'fine', label: '📦 Box fine', amount: -1 }],
    pots: { ready: 12, goal: 8, gic: 5, stock: 0 }, locks: [{ amount: 5, back: 1 }], hist: [40, 33, 42, 30],
    coming: [['Club time trials', 'Sun 18 Oct']] });
  const alloc = s.sdPresets(w, R)[2].alloc;
  const res = s.sdSign(Object.assign({}, w, { alloc }), R);
  const v = s.sdVerdicts(res, Object.assign({}, w, { alloc }), R);
  check('the income verdict reads as the prototype wrote it',
    v.income.head === '🎲 A lucky week, not every week'
    && v.income.lines[1] === '🧱 My loan needs $16.15 first, every week. Steady covers it 1.9×.'
    && v.income.lines[2] === '🎲 Bonus $23.00 (40%) came from competitions $18.00, gifts $5.00. Next chance: Club time trials, Sun 18 Oct.'
      ? true : JSON.stringify(v.income.lines));
  check('the strategy verdict reads as the prototype wrote it',
    v.strategy.head === '🧭 🚀 Fast track' && /^\d+% of my choice went on the wall\. Every week like this, I'm free by [A-Z][a-z]{2} \d{4}, \d+ weeks sooner\. Pay now, enjoy later\.$/.test(v.strategy.why)
      ? true : v.strategy.why);
  check('a locked 4 weeks comes back on the Saturday before the 4th-next Sunday',
    s.sdLockMaturesOn('2026-09-28', 4) === '2026-10-31' && s.sdShortDay('2026-10-31') === 'Sat, Oct 31');
  for (const n of [1, 4, 20]) {
    const f = s.sdForecast(res, Object.assign({}, w, { alloc }), R, n);
    check(`forecast ${n === 1 ? '1 wk' : n === 4 ? '1 mo' : '5 mo'}: the goal jar earns none, the totals add up`,
      f.fwSave[1].earn === 'none' && f.fwLoan.length === 2 && f.fwLoan[1].value <= f.fwLoan[0].value + 0.001
        ? true : JSON.stringify(f.fwSave));
  }
  check('stickers come from the signed week, not a stored key',
    JSON.stringify(s.sdStickersFor({ extra: 10, ready: 5, gic: 3, stock: 0, wallet: 0, guess: 50, payday: 52 }))
      === JSON.stringify(['wall', 'saver', 'patient', 'guesser']));
  check('what money buys is read from the family\'s price list',
    s.sdBuysOf(14, R.buys.items) === 'about 1 movie ticket' && s.sdBuysOf(30, R.buys.items) === 'about 1 new book'
    && s.sdBuysOf(2, R.buys.items) === 'not quite an ice-cream' ? true : s.sdBuysOf(14, R.buys.items));
  const pc = s.sdPercents([0.2, 49.9, 49.9], 100);
  check('shares: largest remainder sums to 100, and a tiny one reads "<1%"',
    pc.reduce((a, b) => a + b, 0) === 100 && s.sdPercentLabel(pc[0], 0.2) === (pc[0] === 0 ? '<1%' : pc[0] + '%')
      ? true : pc);
}

/* ── ⚙️ Grown-ups › Rules: the impact preview ── */
{
  const kids = { jenn: { days: 6, streakDays: 7, sessions: 2, fines: [], left: 700, monthly: 70 } };
  const same = s.sdImpact(R, R, kids, '2026-09-28');
  check('nothing pending: no row changes', same[0].rows.every(r => !r.changed));
  const R2 = JSON.parse(JSON.stringify(R)); R2.chores.dailyCap = 4; R2.loan.monthly.jenn = 90;
  const moved = s.sdImpact(R, R2, kids, '2026-09-28');
  const row = k => moved[0].rows.find(r => r.k === k);
  check('a change shows before → after on every row it moves',
    row('Typical week').v === '$33.00 → $39.00' && row('Loan a week').v === '$16.15 → $20.77'
    && row('Typical week').changed && row('Most to spend').changed ? true : JSON.stringify(moved[0].rows));
}

/* ── 📅 The money week runs Monday to Sunday (decision 15, 2026-10-06) ──
   Plan v6 Deviation 34 (Sunday to Saturday from 11 Oct 2026) was withdrawn
   before it started. The shipped rulebook is Monday–Sunday and only a STORED
   `week.startsOn: 'sunday'` with a `week.from` could turn the mapping on.
   The mapping code stays for the record: js/18-rules.js's `mrMoneyDaysPure`,
   every fact handed in, is tested below with explicit Sun–Sat rules — which
   days a meeting pays, before and after a switch, and that no day is ever paid
   by two settled weeks whatever order the weeks are settled in. */
{
  const r18 = require(path.join(__dirname, '..', 'js', '18-rules.js'));
  check('decision 15: the shipped rulebook runs the money week Monday–Sunday, with no switch date',
    R.week && R.week.startsOn === 'monday' && !('from' in R.week) ? true : JSON.stringify(R.week));
  check('decision 15: the default rules never turn the Sun–Sat mapping on',
    ['2026-09-28', '2026-10-05', '2026-10-12', '2027-03-01'].every(wk => !r18.mrMoneyWeekRuleOn(R, wk))
      && !r18.mrMoneyWeekRuleOn({}, '2026-10-12') && !r18.mrMoneyWeekRuleOn({ week: { startsOn: 'sunday' } }, '2026-10-12')
      ? true : 'a week reads Sun–Sat under the shipped or a partial rulebook');
  // The withdrawn shipped pair, copied into a stored rulebook, never turns it on.
  const copied = { week: { startsOn: 'sunday', from: '2026-10-11' } };
  check('decision 15: a stored rulebook holding the withdrawn pair (sunday, 2026-10-11) reads every week Mon–Sun',
    ['2026-09-28', '2026-10-05', '2026-10-12', '2027-03-01'].every(wk => !r18.mrMoneyWeekRuleOn(copied, wk)) ? true : 'a week reads Sun–Sat');
  const chosen = { week: { startsOn: 'sunday', from: '2026-11-08' } };
  check('a stored sunday rule with another date still turns the mapping on from that date',
    !r18.mrMoneyWeekRuleOn(chosen, '2026-10-26') && r18.mrMoneyWeekRuleOn(chosen, '2026-11-02') && r18.mrMoneyWeekRuleOn(chosen, '2026-11-09') ? true : 'wrong');
  // The mapping's own tests: a Sun–Sat rule from the meeting of 11 Oct, handed in as a function.
  const isSun = wk => r18.mrDayKeyAdd(wk, 6) >= '2026-10-11';
  check('weeks whose meeting is before 11 Oct keep Mon–Sun; the week of 5 Oct is the first Sun–Sat',
    !isSun('2026-09-21') && !isSun('2026-09-28') && isSun('2026-10-05') && isSun('2026-11-02') ? true
      : [isSun('2026-09-28'), isSun('2026-10-05')].join(','));
  const keysOf = refs => refs.filter(x => !x.taken).map(x => x.dayKey).join(',');
  const none = () => null;
  check('an old week pays Mon..Sun at (W, 0..6)',
    keysOf(r18.mrMoneyDaysPure('2026-09-28', isSun, none)) === '2026-09-28,2026-09-29,2026-09-30,2026-10-01,2026-10-02,2026-10-03,2026-10-04');
  const nw = r18.mrMoneyDaysPure('2026-10-12', isSun, none);
  check('a new week pays Sun..Sat; its Sunday is read at the planner week before, day 6',
    keysOf(nw) === '2026-10-11,2026-10-12,2026-10-13,2026-10-14,2026-10-15,2026-10-16,2026-10-17'
      && nw[0].wk === '2026-10-05' && nw[0].d === 6 && nw[1].wk === '2026-10-12' && nw[1].d === 0 ? true : JSON.stringify(nw.slice(0, 2)));
  // The switch: Sun 4 Oct is day 6 of the last Mon–Sun week and day 0 of the first Sun–Sat one.
  const settledOld = wk => (wk === '2026-09-28' ? true : null);
  const first = r18.mrMoneyDaysPure('2026-10-05', isSun, settledOld);
  check('the switch Sunday already settled in the old week is left out of the first new week',
    first[0].dayKey === '2026-10-04' && first[0].taken === true && keysOf(first) === '2026-10-05,2026-10-06,2026-10-07,2026-10-08,2026-10-09,2026-10-10'
      ? true : JSON.stringify(first.map(x => x.dayKey + (x.taken ? 'x' : ''))));
  check('while the old week is open, the first new week names the switch Sunday too (whichever settles first pays it)',
    r18.mrMoneyDaysPure('2026-10-05', isSun, none)[0].taken === false);
  /* Any order of settling, each settled week freezing the days it paid: no day twice, none missed. */
  const weeks = ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'];
  const perms = (a) => a.length < 2 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map(p => [x].concat(p)));
  let bad = null;
  perms(weeks).forEach(order => {
    if (bad) return;
    const ledger = {};
    const settled = wk => (wk in ledger ? ledger[wk] : null);
    order.forEach(wk => { ledger[wk] = keysOf(r18.mrMoneyDaysPure(wk, isSun, settled)).split(','); });
    const all = [].concat(...weeks.map(wk => ledger[wk]));
    const dup = all.filter((k, i) => all.indexOf(k) !== i);
    const span = new Set(all);
    let gap = null;
    for (let k = '2026-09-21'; k <= '2026-10-24'; k = r18.mrDayKeyAdd(k, 1)) if (!span.has(k)) gap = k;
    if (dup.length || gap) bad = order.join(' ') + ' → dup ' + dup.join(',') + ' gap ' + gap;
  });
  check('settled in any of the 120 orders, every day from 21 Sep to 24 Oct is paid exactly once', bad === null ? true : bad);
  /* A row frozen before this change recorded no days: it covered its own nominal days. */
  const oldRow = wk => (wk === '2026-09-28' ? true : wk === '2026-10-05' ? ['2026-10-05'] : null);
  check('a settled week keeps exactly the days its ledger froze',
    keysOf(r18.mrMoneyDaysPure('2026-10-05', isSun, oldRow)) === '2026-10-05');
}

/* ── 📒 Weeks: the saving line (Plan v9 §N, 10% / 50%) ── */
{
  const row = (wall, saved, cash) => ({ wall, saved, cash });
  const L = (rows, open) => s.sdSavingLine(rows, open, R);
  check('saving line: under 10% is "a little"', L([row(10, 0.5, 9.5)], false).word === 'a little');
  check('saving line: exactly 10% is "steady"', L([row(5, 2, 13)], false).word === 'steady' && L([row(5, 2, 13)], false).pct === 10);
  check('saving line: exactly 50% is "steady"', L([row(5, 10, 5)], false).word === 'steady');
  check('saving line: over 50% is "a lot"', L([row(4, 11, 5)], false).word === 'a lot');
  check('saving line: "a lot" with a loan open says what extra counts, from the rules',
    L([row(4, 11, 5)], true).extra === 'extra on the loan counts $1.10 per $1' ? true : L([row(4, 11, 5)], true).extra);
  const R2 = JSON.parse(JSON.stringify(R)); R2.loan.extraBonusPct = 25;
  check('saving line: the bonus is read from loan.extraBonusPct, not a literal',
    s.sdSavingLine([row(4, 11, 5)], true, R2).extra === 'extra on the loan counts $1.25 per $1');
  check('saving line: no loan open, no extra line', L([row(4, 11, 5)], false).extra === '');
  check('saving line: "steady" never adds the loan line', L([row(5, 5, 10)], true).extra === '');
  check('saving line: only the last 4 Sundays count',
    L([row(10, 0, 10), row(10, 0, 10), row(10, 0, 10), row(10, 0, 10), row(0, 100, 0)], false).word === 'a little');
  check('saving line: shares across Sundays, not an average of shares',
    L([row(0, 9, 1), row(90, 0, 0)], false).pct === 9);
  check('saving line: nothing placed yet says nothing', L([], true).word === null && L([row(0, 0, 0)], true).pct === null);
}
/* ── 💬 The agreed amount (Plan v9 §N, Deviation 41) ── */
{
  const r = { id: 'req-x', amount: 5, updatedAt: 1 };
  s.sdWithAgreed(r, -3, 'a grown-up', 50);
  check('agreed: never below $0, stamped with who and when', r.agreed.value === 0 && r.agreed.by === 'a grown-up' && r.updatedAt === 50);
  s.sdWithAgreed(r, 3.456, 'a grown-up', 60);
  s.sdAgreeInto(r, 'amount', 70);
  check('agreed: agreeing puts the figure in the owner\'s field and keeps what she asked',
    r.amount === 3.46 && r.agreed.asked === 5 && r.agreed.value === 3.46 && r.updatedAt === 70);
  s.sdWithAgreed(r, 4, 'a grown-up', 80);
  check('agreed: a later step keeps what she first asked', r.agreed.asked === 5);
}

/* ── 📉 What I owe vs what I own (Plan v17 §4, Stage 6h) ── */
{
  const F = s.sdOweOwnForecast;
  const soon = F(100, 50, 10, 5);
  check('forecast: free within 13 Sundays runs to the payoff Sunday', soon.toFree === true && soon.n === 10 && soon.points.length === 10
    && soon.points[9][0] === 0 && soon.points[9][1] === 100 ? true : JSON.stringify(soon));
  const edge = F(130, 0, 10, 0);
  check('forecast: exactly 13 Sundays is still "free by"', edge.toFree === true && edge.n === 13);
  const far = F(657.45, 56.86, 42.55, 36.86);
  check('forecast: further than 13 Sundays shows the next 6', far.toFree === false && far.n === 6 && far.points.length === 6
    && far.points[0][0] === 614.9 && far.points[5][1] === s.sdR2(56.86 + 6 * 36.86) ? true : JSON.stringify(far));
  const none = F(0, 20, 10, 5);
  check('forecast: nothing owed is not "free by" — six Sundays, owe stays $0', none.toFree === false && none.n === 6 && none.points.every(p => p[0] === 0));
  const noPay = F(100, 0, 0, 0);
  check('forecast: no payment never claims a payoff', noPay.toFree === false && noPay.n === 6 && noPay.points[5][0] === 100);
  check('forecast: owe never goes below $0', F(25, 0, 10, 0).points.every(p => p[0] >= 0));

  const S = s.sdOweOwnSeries;
  const rows = Array.from({ length: 12 }, (_, i) => ({ weekKey: 'w' + String(i).padStart(2, '0'), owed: 900 - i * 10, owned: i }));
  const ser = S(rows, { weekKey: 'now', owed: 700, owned: 30 }, 42, 5);
  check('series: the last 8 Sundays including today', ser.past.length === 8 && ser.past[7].weekKey === 'now' && ser.past[0].weekKey === 'w05');
  check('series: older Sundays are counted, not drawn', ser.hidden === 5);
  check('series: the forecast starts from the signed point', ser.forecast.points[0][0] === 658 && ser.forecast.points[0][1] === 35);
  const few = S([{ weekKey: 'a', owed: 10, owned: 1 }], { weekKey: 'now', owed: 5, owned: 2 }, 5, 0);
  check('series: a short history shows what there is', few.past.length === 2 && few.hidden === 0 && few.forecast.toFree === true && few.forecast.n === 1);
  check('series: rows without the figures are skipped', S([{ weekKey: 'x', owed: null, owned: 3 }, { weekKey: 'y', owed: 4, owned: 1 }], { weekKey: 'now', owed: 3, owned: 1 }, 1, 0).past.map(p => p.weekKey).join() === 'y,now');

  const T = s.sdThinLabels;
  check('labels: a short chart labels every point', T(6, [3, 5], 8).join() === '0,1,2,3,4,5');
  for (const n of [9, 14, 21, 30, 61]) {
    const keep = [7, n - 1];
    const got = T(n, keep, 8);
    check(`labels: ${n} points show at most 8, the signed and the last always`, got.length <= 8 && got.length >= 4 && keep.every(k => got.includes(k)) ? true : JSON.stringify(got));
  }
}

/* ── Plan v18 (Stage 7): the gap label, the request tags, taken off ── */
{
  // The free-soon chart from the 6h comparison: the signed point's segment is
  // steep and narrow, so its middle is not a home for the label.
  const x = i => 44 + i * 80, y = v => 8 + (1 - v / 400) * 74;
  const past = [{ x: x(0), owe: y(250), own: y(10) }, { x: x(1), owe: y(220), own: y(20) }, { x: x(2), owe: y(85), own: y(61) }];
  const lines = [past.map(p => [p.x, p.owe]), past.map(p => [p.x, p.own]),
    [[x(2), y(85)], [x(3), y(43)], [x(4), y(0)]], [[x(2), y(61)], [x(3), y(80)], [x(4), y(100)]]];
  const size = { w: 46, h: 12 }, bounds = { l: 44, r: 680, t: 8, b: 82 };
  const spot = s.sdGapLabelSpot(past, lines, size, bounds);
  const box = sp => ({ l: sp.x - 25, r: sp.x + 25, t: sp.y - 8, b: sp.y + 8 });
  const hits = sp => lines.some(L => L.some((p, i) => i > 0 && s.sdSegHitsBox(L[i - 1], p, box(sp))));
  check('gap label: free-soon chart — a spot is found', !!spot, JSON.stringify(spot));
  check('gap label: it never touches a line', spot && !hits(spot) ? true : JSON.stringify(spot));
  check('gap label: it stays inside the chart', spot && spot.x - 23 >= 44 && spot.x + 23 <= 680 && spot.y - 6 >= 8 && spot.y + 6 <= 82 ? true : JSON.stringify(spot));
  // A wide gap: the newest segment's middle is the first choice.
  const wide = [{ x: 44, owe: y(390), own: y(5) }, { x: 124, owe: y(380), own: y(10) }];
  const w1 = s.sdGapLabelSpot(wide, [wide.map(p => [p.x, p.owe]), wide.map(p => [p.x, p.own])], size, bounds);
  check('gap label: a wide gap puts it in the middle of the newest segment', w1 && w1.x === 84 ? true : JSON.stringify(w1));
  // Lines everywhere leave no spot rather than a wrong one.
  const flat = [{ x: 44, owe: y(100), own: y(100) }, { x: 60, owe: y(100), own: y(100) }];
  const allLines = [[[44, 8], [680, 82]], [[44, 82], [680, 8]], [[44, 45], [680, 45]], [[362, 8], [362, 82]],
    [[100, 8], [100, 82]], [[200, 8], [200, 82]], [[44, 20], [680, 20]], [[44, 70], [680, 70]]];
  check('gap label: nowhere free means null, never a spot on a line', s.sdGapLabelSpot(flat, allLines, size, bounds) === null);
  check('gap label: segment/box hit test', s.sdSegHitsBox([0, 0], [10, 10], { l: 4, r: 6, t: 4, b: 6 }) === true
    && s.sdSegHitsBox([0, 0], [10, 0], { l: 4, r: 6, t: 4, b: 6 }) === false);

  const T = s.sdRequestTag;
  const want = { comp: '🏆 Result', skip: '⛸️ Club', move: '🔀 Move', deposit: '🏦 Cash in', adv: '⏪ Draw early',
                 gift: '🎁 Gift', goal: '🎯 Goal', dispute: '📦 Fine' };
  check('request tags: every kind has its tag', Object.keys(want).every(k => T(k, 'ready') === want[k]) ? true
    : JSON.stringify(Object.keys(want).map(k => [k, T(k, 'ready')])));
  check('request tags: a move to cash is a cash out', T('move', 'cash') === '💵 Cash out' && T('move', 'wall') === '🔀 Move');
  check('request tags: an unknown kind has none', T('nope') === null);

  const F = s.sdFineFloorNote;
  check('floor note: a fine on a $0 day says nothing was taken', F(1, 0) === 'nothing taken — the day was $0');
  check('floor note: a partly floored day says what was taken', F(2, 0.5) === 'only $0.50 taken — the day earned $0.50');
  check('floor note: a fine taken in full says nothing', F(1, 1) === '' && F(0, 0) === '');
  const O = s.sdOff$;
  check('taken off: a positive amount shows with a minus', O(1) === '−$1.00');
  check('taken off: a negative amount shows with one minus', O(-2.5) === '−$2.50');
  check('taken off: nothing taken off is $0.00, never −$0.00', O(0) === '$0.00' && O(0.001) === '$0.00');
  check("taken off: the screen's own format", O(3, v => '$' + v) === '−$3');
}

/* ── Money fit and logic, PR 1 (2026-10-05) ───────────────────────── */
{
  const r18 = require(path.join(__dirname, '..', 'js', '18-rules.js'));

  /* L3 · "loan per month" changed: the rows' monthly figures add up to the new
     figure exactly (the rounding residual sits on the last row), and the
     weekly must-pay (monthly × 12 ÷ 52 per row) is within a cent per row. */
  {
    const bad = [];
    const cases = [[[70, 25, 33.33], 120], [[10, 10, 10], 50], [[56], 61], [[33.33, 33.33, 33.34], 100.01],
      [[12.5, 7.25, 40, 3.1], 77.77], [[1, 2, 3, 4, 5, 6, 7], 29.99]];
    const rand = rng(20261005);
    for (let i = 0; i < 200; i++) {
      const n = between(rand, 1, 5);
      cases.push([Array.from({ length: n }, () => r2(between(rand, 100, 9000) / 100)), r2(between(rand, 500, 20000) / 100)]);
    }
    cases.forEach(([rows, now]) => {
      const next = s.sdRescaleMonthly(rows, now);
      const sum = r2(next.reduce((a, v) => a + v, 0));
      if (sum !== r2(now)) bad.push(`${JSON.stringify(rows)} → ${now}: rows sum to ${sum}`);
      const wk = r2(next.reduce((a, v) => a + r2(v * 12 / 52), 0));
      if (Math.abs(wk - r2(now * 12 / 52)) > 0.01 * next.length + 1e-9) bad.push(`${JSON.stringify(rows)} → ${now}: weekly ${wk} vs ${r2(now * 12 / 52)}`);
      if (next.some(v => v < 0)) bad.push(`${JSON.stringify(rows)} → ${now}: a negative row ${JSON.stringify(next)}`);
    });
    check('L3 rescale: the rows\' monthly figures sum to the new "loan per month" exactly', bad.length ? bad.slice(0, 6) : true);
  }

  /* L5 / L6 · a commitment, before anything is written. */
  {
    const P = o => s.sdCommitPlan(Object.assign({ cost: 60, sharePct: 50, weeks: 26, saved: 20, safety: 10, weeklyNow: 16.15, steady: 40 }, o));
    const a = P({});
    check('new weekly payment after a commitment: $16.15 → $17.19 for $27 over 26 weeks',
      a.her === 30 && a.down === 3 && a.added === 27 && a.weekly === 1.04 && a.p0 === 16.15 && a.p1 === 17.19
        ? true : JSON.stringify(a));
    const b = P({ saved: 11 }), c = P({ saved: 5 });
    check('L6 down payment: Savings pays only above the 🛟 $10, the rest joins the wall',
      b.fromSavings === 1 && b.toWall === 2 && b.added === 29 && c.fromSavings === 0 && c.toWall === 3 && c.added === 30
      && a.fromSavings === 3 && a.toWall === 0 ? true : JSON.stringify([a, b, c].map(x => [x.fromSavings, x.toWall, x.added])));
    check('L6 the new row\'s weekly figure is the wall part over its weeks (monthly × 12 ÷ 52)',
      b.monthly === r2(29 / 26 * 52 / 12) && b.weekly === r2(b.monthly * 12 / 52) && b.p1 === r2(16.15 + b.weekly)
        ? true : JSON.stringify(b));
    const low = P({ steady: 4.99 }), zero = P({ steady: 0 });
    check('L5 steady under $5: no share is shown and a parent\'s ✓ is needed',
      low.lowSteady === true && low.r0 === null && low.r1 === null && low.needsTick === true && zero.needsTick === true
        ? true : JSON.stringify([low, zero].map(x => [x.lowSteady, x.r1, x.needsTick])));
    const over = P({ weeklyNow: 19.5 }), under = P({ weeklyNow: 10 });
    check('L5 over 50 % of steady money needs a parent\'s ✓; under it does not',
      over.over === true && over.needsTick === true && under.over === false && under.needsTick === false && Math.round(under.r1) === 28
        ? true : JSON.stringify([over, under].map(x => [x.r1, x.over, x.needsTick])));
    /* PR 1 money re-check, fix 1: the one division by steady money. Grown-ups'
       loan card and her "New row on my wall" pop-up read these, so a $1 week
       of steady money shows no "300%" anywhere. */
    const sh = [s.sdSteadyShare(3, 1), s.sdSteadyShare(3, 4.99), s.sdSteadyShare(3, 0), s.sdSteadyShare(2.5, 5), s.sdSteadyShare(10, 40)];
    check('fix 1: a share of steady money is null under the $5 floor, else weekly ÷ steady × 100',
      sh[0] === null && sh[1] === null && sh[2] === null && sh[3] === 50 && sh[4] === 25 ? true : JSON.stringify(sh));
    const cs = [s.sdCommitShares(16.15, 17.19, 4), s.sdCommitShares(20, 20.01, 40), s.sdCommitShares(20, 20, 40)];
    check('fix 1: the pop-up\'s shares and its 50 % line are sdCommitPlan\'s',
      cs[0].lowSteady === true && cs[0].over === false && cs[0].r1 === null
      && cs[1].over === true && cs[2].over === false && cs[2].r0 === 50
      && JSON.stringify(s.sdCommitShares(a.p0, a.p1, a.steady)) === JSON.stringify({ r0: a.r0, r1: a.r1, lowSteady: a.lowSteady, over: a.over })
        ? true : JSON.stringify(cs));
  }

  /* L4 · the money week's name: its first and last day. */
  {
    const rule = wk => r18.mrDayKeyAdd(wk, 6) >= '2026-10-11';
    const none = () => null;
    const L = r18.mrMoneyWeekLabelPure;
    const got = [L('2026-10-12', rule, none), L('2026-10-05', rule, none), L('2026-09-28', rule, none),
      L('2026-09-28', () => true, none), L('2026-11-02', rule, none)];
    const want = ['Sun 11 – Sat 17 Oct', 'Mon 5 – Sat 10 Oct', 'Mon 28 Sep – Sun 4 Oct', 'Sun 27 Sep – Sat 3 Oct', 'Sun 1 – Sat 7 Nov'];
    check('L4 money week label: Sun–Sat, the switch week Mon 5 – Sat 10, Mon–Sun before the rule',
      got.join('|') === want.join('|') ? true : got);
    const newFirst = wk => wk === '2026-10-05' ? ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'] : null;
    const oldFirst = wk => wk === '2026-09-28' ? true : null;
    check('L4 the switch Sunday is named by the week that paid it',
      L('2026-10-05', rule, newFirst) === 'Sun 4 – Sat 10 Oct' && L('2026-10-05', rule, oldFirst) === 'Mon 5 – Sat 10 Oct'
        ? true : [L('2026-10-05', rule, newFirst), L('2026-10-05', rule, oldFirst)]);
    // Decision 15: with the shipped rules every week is Mon–Sun.
    const shipped = wk => r18.mrMoneyWeekRuleOn(R, wk);
    const gotD = [L('2026-10-05', shipped, none), L('2026-10-12', shipped, none), L('2026-09-28', shipped, none)];
    check('decision 15: with the default rules the week of 5 Oct reads "Mon 5 – Sun 11 Oct"',
      gotD.join('|') === 'Mon 5 – Sun 11 Oct|Mon 12 – Sun 18 Oct|Mon 28 Sep – Sun 4 Oct' ? true : gotD);
  }

  /* 🔥 Decision 15: the meeting's own Sunday is pre-marked. In a week not
     yet settled, its Sunday counts as kept once it has come — she still does
     the routine that evening, and a later untick changes nothing (the meeting
     freezes the week). `mrStreakRunPure` is the one rule mrStreakWeek reads. */
  {
    const run = r18.mrStreakRunPure;
    const st = R.streak;
    // Mon..Sat as given, then the meeting Sunday (today) not ticked.
    const week = (monSat, live = true) => monSat.map(kept => ({ kept, today: false, meetingSunday: false }))
      .concat([{ kept: false, today: live, meetingSunday: true }]);
    const six = run(week([true, true, true, true, true, true]), st, true);
    check('pre-mark: 6 kept days + the meeting Sunday (not ticked) = the 7-day tier, $3',
      six.days === 7 && six.tier === 7 && six.bonus === 3 ? true : JSON.stringify(six));
    const oneMiss = run(week([true, true, false, true, true, true]), st, true);
    check('pre-mark: one miss Mon–Sat + the meeting Sunday = 7 days with the forgiving day, $3',
      oneMiss.days === 7 && oneMiss.bonus === 3 ? true : JSON.stringify(oneMiss));
    const twoMiss = run(week([true, false, true, false, true, true]), st, true);
    check('pre-mark: two misses Mon–Sat still fail the 7-day tier',
      twoMiss.tier < 7 && twoMiss.bonus < 3 ? true : JSON.stringify(twoMiss));
    const settled = run(week([true, true, false, true, true, true], false), st, false);
    check('pre-mark: a settled week is read whole — an unticked Sunday there is a miss, as before',
      settled.days === 6 && settled.bonus === 2 ? true : JSON.stringify(settled));
    const midWeek = run([{ kept: true }, { kept: true }, { kept: false, today: true, meetingSunday: false }], st, true);
    check('pre-mark: only the meeting Sunday — a weekday not done yet still stops the live run',
      midWeek.days === 2 ? true : JSON.stringify(midWeek));
  }

  /* 🧱 owe after my plan (I choose): exactly what the sign leaves, interest
     owed and the 10 % bonus included. */
  {
    const w = { weekKey: '2026-10-12', week: 3, lines: [{ key: 'jobs', amount: 21 }, { key: 'streak', amount: 2 }],
      loan: { principal: 1000, paid: 300, interest: 2.5, arrears: 0, weekly: 16.15 }, pots: { ready: 12, goal: 8, gic: 0, stock: 0 },
      locks: [], goal: { name: 'Guards', target: 35 }, pull: {}, adv: { owed: 0, manual: 0 }, alloc: { extra: 6 }, hist: [] };
    const res = s.sdSign(w, R);
    // Below the 🏦 Savings gate the jar's overflow goes on the wall too (the old
    // chooser figure, left − (must-pay + extra × 1.1), said $521.67 here).
    const lo = { weekKey: '2026-10-12', week: 3, lines: [{ key: 'jobs', amount: 21 }, { key: 'streak', amount: 2 }, { key: 'pa', amount: 6.5 }],
      loan: { principal: 600, paid: 60, interest: 0, arrears: 0, weekly: 9.23 }, pots: { ready: 0, goal: 4, gic: 0, stock: 0 },
      locks: [], goal: { name: 'Goggles', target: 12 }, pull: {}, adv: { owed: 0, manual: 0 }, alloc: { goal: 12 }, hist: [] };
    lo.alloc.extra = s.sdPile(lo, R).hers - 12;
    const resLo = s.sdSign(lo, R);
    check('owe after plan: I choose shows what the sign leaves (interest owed; the jar overflowing below the Savings gate)',
      res.ok && resLo.ok && s.sdOweAfterPlan(w, R) === res.after.left && s.sdOweAfterPlan(lo, R) === resLo.after.left && resLo.after.left === 517.27
        ? true : JSON.stringify([res.after && res.after.left, s.sdOweAfterPlan(w, R), resLo.after && resLo.after.left, s.sdOweAfterPlan(lo, R)]));
  }

  /* M7 · 20 Sundays per girl with real-shaped numbers, through the pure core
     (an `sdBuildInput`-shaped week → `sdSign`). Approvals are modelled the way
     the app stamps them: a ⏪ Draw early feeds `adv.owed` until its
     `appliedAmount` reaches its amount and the sign stamps `appliedWeek`
     (js/23-money-meeting.js); a gift feeds 🎁 until stamped at the sign
     (js/23); a 🧱 wall move is paid once at Sunday open from Savings, as extra
     at 1 + bonus, and stamped (js/40-stream.js `mnyApplyApprovedWallMoves`); a
     🎯 goal switch is applied once at Sunday open and stamped
     (js/45-requests.js `mnyApplyApprovedGoals`). The stamps are this model's;
     the smoke suite drives the app's own. */
  ['jenn', 'jess'].forEach(kid => {
    const bad = [];
    const J = kid === 'jenn';
    let st = startOf(kid);
    const reqs = [
      ...[2, 9, 15].map(i => ({ id: 'adv' + i, kind: 'adv', amount: J ? 3 : 2, approvedFor: i, appliedAmount: 0, appliedWeek: null })),
      ...[3, 11].map(i => ({ id: 'dep' + i, kind: 'dep', amount: J ? 10 : 15, approvedFor: i, appliedWeek: null })),
      ...[6, 14].map(i => ({ id: 'wall' + i, kind: 'wall', amount: 4, approvedFor: i, appliedWeek: null })),
      { id: 'goal10', kind: 'goal', approvedFor: 10, name: J ? 'Skate bag' : 'Art set', target: J ? 60 : 45, appliedWeek: null },
    ];
    const stampsSeen = {};
    const stamp = (r, wk) => { if (r.appliedWeek) bad.push(`${r.id} stamped twice`); r.appliedWeek = wk; stampsSeen[r.id] = (stampsSeen[r.id] || 0) + 1; };
    const lockBack = st.locks.map(l => [l.back, l.amount]);   // [Sunday it comes back, amount]
    const rows = [];
    let advTakenSum = 0, giftsSum = 0, wallPaid = 0, interestSundays = [];
    for (let i = 1; i <= 20; i++) {
      const tag = `${kid} Sunday ${i}`;
      const weekKey = s.sdDayKeyAdd('2026-09-28', 7 * (i - 1));
      const live = reqs.filter(r => r.approvedFor <= i && !r.appliedWeek);
      // Sunday opens: the goal switch and the wall moves, each once.
      live.filter(r => r.kind === 'goal').forEach(r => {
        st.pots = s.sdNewGoal(st.pots, { name: r.name, target: r.target }, 'goal');
        st.goal = { name: r.name, target: r.target }; stamp(r, weekKey);
      });
      live.filter(r => r.kind === 'wall').forEach(r => {
        const amt = r2(Math.min(r.amount, st.pots.ready));
        st.pots = Object.assign({}, st.pots, { ready: r2(st.pots.ready - amt) });
        const b = R.loan.extraBonusPct / 100;
        const credit = r2(Math.min(r2(st.loan.principal - st.loan.paid), amt * (1 + b)));
        st.loan = Object.assign({}, st.loan, { paid: r2(st.loan.paid + credit) });
        r.appliedAmount = amt; wallPaid = r2(wallPaid + amt); stamp(r, weekKey);
      });
      const gifts = r2(live.filter(r => r.kind === 'dep').reduce((a, r) => a + r.amount, 0));
      const advOwed = r2(live.filter(r => r.kind === 'adv').reduce((a, r) => a + r.amount - r.appliedAmount, 0));
      const lines = [
        { key: 'jobs', label: '🧹 Chores', amount: (J ? [5, 6, 4, 7][i % 4] : [4, 5, 6, 3][i % 4]) * R.chores.dailyCap },
        { key: 'streak', label: '🔥 Routine streak', amount: [0, 1, 2, 3][i % 4] },
        { key: 'pa', label: '⛸️ Club job', amount: (J ? 2 : 1) * R.sessions.perSession },
        { key: 'comp', label: '🏆 Competitions', amount: (i === 5 || i === 13) ? (J ? 15 : 12) : 0 },
        { key: 'gifts', label: '🎁 Gifts', amount: gifts },
        { key: 'ret', label: '🌱 My pots earned', amount: 0 },
        { key: 'fine', label: '📦 Fines', amount: (i === 7 || i === 12) ? -1 : 0 },
      ];
      const w = { weekKey, week: st.week, lines, loan: st.loan, pots: st.pots, locks: st.locks, goal: st.goal,
        pull: {}, adv: { owed: advOwed, manual: 0 }, alloc: {}, hist: [], histCat: st.histCat, stickers: st.stickers, guess: 30 };
      if (i === 8) { const pr = s.sdSetPull(w, 'ready', 1, R); if (pr.ok) w.pull = pr.pull; }
      // Her plan: Savings and the jar a little, a lock every other week, a treat, the rest on the wall.
      let cur = Object.assign({}, w, { alloc: {} });
      const tap = (k, n) => { const r = s.sdPlace(cur, k, 1, n, R); if (r.ok) cur = Object.assign({}, cur, { alloc: r.alloc }); };
      tap('ready', 2); tap('goal', J ? 3 : 4); if (i % 2) tap('gic', 1); tap('spend', 1);
      tap('extra', 999);
      w.alloc = cur.alloc;
      const P = s.sdPile(w, R);
      if (P.pile !== 0) bad.push(`${tag}: $${P.pile} left unplaced`);
      const oweAfter = s.sdOweAfterPlan(w, R);
      const snap = JSON.stringify(w);
      const res = s.sdSign(w, R);
      if (!res.ok) { bad.push(`${tag}: refused — ${res.why}`); break; }
      const sg = res.signed;
      if (!res.check.ok) bad.push(`${tag}: In ${res.check.in} ≠ Out ${res.check.out}`);
      if (oweAfter !== res.after.left) bad.push(`${tag}: I choose says owe ${oweAfter}, the sign leaves ${res.after.left}`);
      // L1: one pile figure — Payday's pile and I choose's chip (P.tp), Signed's
      // money in less what was taken off, and My last 4 Sundays' total.
      const takenOff = r2(-sg.outFine + sg.adv);
      const row = { row: { chores: lines[0].amount, streak: lines[1].amount, sessionsPaid: lines[2].amount, competition: lines[3].amount,
        groups: { earned: r2(sg.inSteady + lines[3].amount), given: gifts, made: 0, bank: sg.inBank, takenOff } } };
      const hg = s.sdHistGroups(row);
      if (P.tp !== hg.total || r2(res.check.in - takenOff) !== P.tp) bad.push(`${tag}: pile ${P.tp}, last-4 total ${hg.total}, Signed in − taken off ${r2(res.check.in - takenOff)}`);
      // The cents rule: Savings when open, else on the loan with the jar's overflow.
      if (s.sdIsOpen('ready', w, R)) {
        if (sg.overToLoan !== 0 || r2(sg.ready - (w.alloc.ready || 0) - sg.spill) < r2(P.cents) - 0.001) bad.push(`${tag}: the cents did not reach Savings`);
      } else if (sg.overToLoan < sg.cents) bad.push(`${tag}: cents ${sg.cents} not on the loan (${sg.overToLoan})`);
      if (res.after.pots.goal > st.goal.target + 0.001) bad.push(`${tag}: goal jar ${res.after.pots.goal} of ${st.goal.target}`);
      // A lock comes back after exactly 4 Sundays.
      const matured = s.sdMatured(w);
      const due = r2(lockBack.filter(([back]) => back === i).reduce((a, [, v]) => a + v, 0));
      if (matured !== due) bad.push(`${tag}: ${matured} came back, ${due} was due`);
      if (w.alloc.gic) lockBack.push([i + R.pots.lockWeeks, w.alloc.gic]);
      // Redo, then sign again: the same ledger.
      const again = s.sdSign(JSON.parse(snap), R);
      if (JSON.stringify(again) !== JSON.stringify(res)) bad.push(`${tag}: a re-sign after Redo differs`);
      // The sign stamps what it used.
      let advLeft = sg.adv;
      live.filter(r => r.kind === 'adv').forEach(r => {
        const pay = r2(Math.min(r2(r.amount - r.appliedAmount), advLeft));
        r.appliedAmount = r2(r.appliedAmount + pay); advLeft = r2(advLeft - pay);
        if (r.appliedAmount >= r.amount) stamp(r, weekKey);
      });
      live.filter(r => r.kind === 'dep').forEach(r => stamp(r, weekKey));
      advTakenSum = r2(advTakenSum + sg.adv); giftsSum = r2(giftsSum + gifts);
      rows.push(res.bookRow);
      const li = s.sdLoanInterest(res.after.loan, st.sinceInterest, R);
      if (li.interest > 0) interestSundays.push(i);
      st = { weekKey, week: res.after.week, loan: li.loan, pots: res.after.pots, locks: res.after.locks, goal: st.goal,
             histCat: res.after.histCat, stickers: res.after.stickers, sinceInterest: li.sundaysSince, advOwed: res.after.advOwed };
    }
    if (interestSundays.join(',') !== '4,8,12,16,20') bad.push('interest on Sundays ' + interestSundays.join(','));
    if (!lockBack.some(([back]) => back > 1 && back <= 20)) bad.push('no lock placed in the run came back');
    reqs.forEach(r => { if (stampsSeen[r.id] !== 1) bad.push(`${r.id} applied ${stampsSeen[r.id] || 0} times`); });
    const advAsked = r2(reqs.filter(r => r.kind === 'adv').reduce((a, r) => a + r.amount, 0));
    const depAsked = r2(reqs.filter(r => r.kind === 'dep').reduce((a, r) => a + r.amount, 0));
    if (advTakenSum !== advAsked) bad.push(`drawn early ${advTakenSum} taken off, ${advAsked} asked`);
    if (giftsSum !== depAsked) bad.push(`gifts ${giftsSum} paid in, ${depAsked} given`);
    if (!(wallPaid > 0)) bad.push('no wall move was paid');
    // The passbook's total row is the sum of its rows, and every row placed what came in.
    const T = ['earned', 'wall', 'saved', 'cash'].map(k => r2(rows.reduce((a, x) => a + x[k], 0)));
    const byRow = rows.reduce((a, x) => [r2(a[0] + x.earned), r2(a[1] + x.wall), r2(a[2] + x.saved), r2(a[3] + x.cash)], [0, 0, 0, 0]);
    if (T.join() !== byRow.join() || rows.length !== 20) bad.push(`passbook total ${T} vs rows ${byRow} over ${rows.length} rows`);
    check(`M7 20 Sundays for ${kid}: In = Out, one pile figure, cents, interest on 4/8/12/16/20, locks back after 4, goal capped, each approval once, Redo re-sign identical, passbook total`,
      bad.length ? bad.slice(0, 8) : true);
  });

  /* Optional: SUNDAY_REPLAY=<path to a Parent › App export> replays her signed
     Sundays through the same In = Out and pile checks. Skipped when unset. */
  if (process.env.SUNDAY_REPLAY) {
    const fs = require('fs');
    const bad = [];
    let n = 0;
    try {
      const data = JSON.parse(fs.readFileSync(process.env.SUNDAY_REPLAY, 'utf8'));
      const shared = data.shared || (data.state && data.state.shared) || {};
      const led = (shared.chore || {}).moneyLedger || {};
      Object.keys(led).sort().forEach(wk => Object.keys(led[wk] || {}).forEach(kid => {
        const r = led[wk][kid];
        const sg = r && r.sunday && r.sunday.signed;
        if (!sg) return;
        n++;
        const io = s.sdCheckInOut(sg);
        if (!io.ok) bad.push(`${kid} ${wk}: ${io.why}`);
        const tp = r2(io.in - (-sg.outFine + sg.adv));
        const hg = s.sdHistGroups({ row: r });
        if (r.groups && hg.total !== tp) bad.push(`${kid} ${wk}: last-4 total ${hg.total}, pile ${tp}`);
      }));
    } catch (e) { bad.push('could not read ' + process.env.SUNDAY_REPLAY + ': ' + e.message); }
    check(`replay of ${process.env.SUNDAY_REPLAY}: ${n} signed Sundays hold In = Out and one pile figure`, bad.length ? bad.slice(0, 8) : true);
  }
}

/* ── 📒 One Sunday's sheet reads its frozen row (decision 16, Money fit and logic PR 5) ──
   `sdSundayRecord` is the one reader the Sunday sheet draws: what came in in
   the four groups (the same as All my Sundays), what was taken off (fines and
   cash drawn early), where it went, the loan left after, and whether it was
   settled without a sign. */
{
  const bad = [];
  const signed = {
    weekKey: '2026-09-28', chores: 14, learning: 2, streak: 3, sessionsPaid: 6, competition: 5, net: 30, fines: 1,
    groups: { earned: 30, given: 10, made: 0.42, bank: 4, takenOff: 3 }, advance: 2,
    loan: { paid: 12, must: 12 }, extra: 3, ready: 10, goal: 4, gic: 0, stock: 2, cashOut: 5, spend: 7,
    debtBalanceAfter: 640.5, sunday: { signed: { ok: 1 } },
  };
  try {
  const frozen = Object.freeze(Object.assign({}, signed, { groups: Object.freeze(Object.assign({}, signed.groups)), loan: Object.freeze(Object.assign({}, signed.loan)) }));
  const a = s.sdSundayRecord(frozen);
  const ci = a.cameIn;
  if (ci.earned !== 30 || ci.home !== 19 || ci.club !== 6 || ci.comp !== 5) bad.push('came in 💪 ' + JSON.stringify(ci));
  if (ci.given !== 10 || ci.made !== 0.42 || ci.bank !== 4) bad.push('came in 🎁 🌱 📥 ' + JSON.stringify(ci));
  if (a.takenOff.total !== 3 || a.takenOff.fines !== 1 || a.takenOff.advance !== 2) bad.push('taken off ' + JSON.stringify(a.takenOff));
  const went = a.went.map(x => x.k + ':' + x.v).join(' ');
  if (went !== 'wall:15 saved:10 goal:4 stock:2 cash:5') bad.push('went ' + went);
  if (a.loanLeftAfter !== 640.5) bad.push('loan left after ' + a.loanLeftAfter);
  if (a.noSign) bad.push('a signed Sunday reads as settled without a sign');
  if (a.total !== s.sdHistGroups({ row: signed }).total || a.total !== 41) bad.push('total ' + a.total + ", not All my Sundays' 41");
  // A Grandfather-rule week: no groups, no sign, no loan figure kept.
  const d = s.sdSundayRecord({ weekKey: '2026-09-21', defaulted: true, defaultReason: 'grandma', net: 20, outside: 0, fines: 0,
    loan: { paid: 8 }, ready: 0, spend: 12 });
  if (!d.noSign) bad.push('a defaulted Sunday does not read as settled without a sign');
  if (d.cameIn.earned !== 20 || d.cameIn.home !== null || d.cameIn.bank !== 0) bad.push('defaulted came in ' + JSON.stringify(d.cameIn));
  if (d.loanLeftAfter !== null) bad.push('defaulted loan left after ' + d.loanLeftAfter);
  const dw = d.went.map(x => x.k + ':' + x.v).join(' ');
  if (dw !== 'wall:8 saved:0 goal:0 cash:12') bad.push('defaulted went ' + dw);
  if (!s.sdSundayRecord({ handEntered: true, sunday: { signed: {} } }).noSign) bad.push('a hand-entered Sunday reads as signed');
  } catch (e) { bad.push('threw: ' + e.message); }
  check('PR 5: sdSundayRecord reads one frozen Sunday — four came-in groups, taken off, where it went, loan left after, settled without a sign',
    typeof s.sdSundayRecord !== 'function' ? 'sdSundayRecord is not exported' : (bad.length ? bad : true));
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
