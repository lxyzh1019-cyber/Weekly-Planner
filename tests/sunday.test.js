// Weekly-Planner — the Sunday ritual's pure core (js/43-sunday-core.js).
// Run: node tests/sunday.test.js  (also runs as part of `npm test`)
//
// Plan v3 §H. The core is the prototype's arithmetic as functions of explicit
// inputs, so this file can do what the prototype could only be clicked
// through: run 8 to 20 Sundays for BOTH girls with random but valid choices,
// and assert, every single week,
//
//   · In = Out to the cent;
//   · the cents go to Savings and are never more than $0.99;
//   · the loan is never negative and never overpaid;
//   · interest is added exactly every 4th Sunday;
//   · a lock comes back on the Saturday before the 4th-next Sunday;
//   · the goal jar never passes its goal — the rest goes to Savings;
//   · 🔒 Locked away and 📈 Companies open at 30 / 40 % paid and never re-lock;
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
  && R.school.stagePct.ready === 0 && R.school.stagePct.locked === 30 && R.school.stagePct.stock === 40
  && R.words.jenn === 1 && R.words.jess === 1 && R.market.wobblePct === 0
    ? true : 'a §C path is missing or has the wrong default');
check('Savings is always open: its gate is 0 and the order rule still holds',
  R.school.stagePct.ready <= R.school.stagePct.locked && R.school.stagePct.locked <= R.school.stagePct.stock
  && R.school.stagePct.stock <= 100);

/* ── A seeded random source, so a failure is reproducible ── */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const between = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

/* The two girls as the prototype drew them (Sunday v15 KIDS). */
function startOf(kid) {
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
  let weeksRun = 0, interestWeeks = 0, locksBack = 0, crossedSeen = {}, presetsLocked = 0;
  for (let seed = 1; seed <= 60 && bad.length < 12; seed++) {
    ['jenn', 'jess'].forEach(kid => {
      const rand = rng(seed * 7919 + (kid === 'jenn' ? 1 : 2));
      const N = 8 + (seed % 13);                      // 8 … 20 Sundays
      let st = startOf(kid);
      const wasOpen = { gic: false, stock: false };
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
        // Cents
        if (!(sg.cents >= 0 && sg.cents <= 0.99)) bad.push(`${tag}: cents ${sg.cents}`);
        if (r2(sg.ready - (w.alloc.ready || 0) - sg.spill - sg.cents) < -0.001) bad.push(`${tag}: the cents did not reach Savings`);
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
        // Gates: open at 30 / 40 % paid, and never re-lock
        const pct = s.sdPaidPct(L);
        ['gic', 'stock'].forEach(k => {
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
          const want = r2((L.principal - L.paid) * R.loan.ratePct / 100 * R.loan.interestEverySundays / 52);
          if (li.interest !== want) bad.push(`${tag}: interest ${li.interest}, expected ${want} on the principal still owed`);
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
  check('the runs really ran (weeks, interest, locks coming back, a gate crossed)',
    weeksRun > 1000 && interestWeeks > 200 && locksBack > 20 && Object.keys(crossedSeen).length >= 1
      ? true : JSON.stringify({ weeksRun, interestWeeks, locksBack, crossedSeen, presetsLocked }));
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
    li.interest === r2((1000 - res.after.loan.paid) * R.loan.ratePct / 100 * 4 / 52) ? true : li.interest);
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
  check('Savings, the wall and cash out are always open',
    ['ready', 'extra', 'spend'].every(k => s.sdCanPlace(k, w, R).ok));
  const pre = s.sdPresets(w, R);
  check('"⚖️ Watch it grow" is locked under 30% and says the gate', pre[2].locked && pre[2].label === '⚖️ Watch it grow 🔒30%');
  const fresh = weekOf({ loan: { principal: 1000, paid: 290, interest: 0, arrears: 0, weekly: 16.15 } });
  const res = s.sdSign(fill(fresh, 'extra'), R);
  check('crossing 30% is the milestone', res.ok && res.crossed === 'gic' ? true : res.crossed);
  check('no loan at all: every pot is open', s.sdIsOpen('stock', { loan: { principal: 0, paid: 0 } }, R));
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

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
