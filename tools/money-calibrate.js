#!/usr/bin/env node
/* ── MONEY calibration ────────────────────────────────────────────
   Run: node tools/money-calibrate.js

   The twin of tools/xp-calibrate.js, and it exists for the same reason that one
   does: nobody had ever checked what the numbers DO over a term. XP got that
   check and money never did, so a rules change could be argued about but not
   measured.

   This replays the shipped money rules over synthetic quiet / ordinary / strong
   weeks per child and reports what each channel pays, what the week nets, and
   what a year of that shape would come to against the child's annual target.

   It is a MODEL, not a measurement. The weeks below are built from how this
   family's week is actually shaped — school five days, two or three training
   sessions, three routines a day on a school day and two otherwise, two family
   chores — not from Jenn and Jess's real data, which lives in Firestore and not
   in this repo.

   THE NUMBERS ARE READ LIVE. js/18-rules.js carries a module.exports guard, so
   MR_DEFAULT_RULES is required rather than restated here. Change a price in the
   app and re-run; this file cannot drift away from what ships.

   WHAT THE MODEL DELIBERATELY MIRRORS, because these are where the money
   actually gets decided and a simpler sum would flatter the result:
     · the first freeChoresPerWeek chores are unpaid, and they are the CHEAPEST
       ones, which is her best arrangement (mrChoreWeek ranks them that way)
     · the daily cap bites per day, not per week
     · the streak pays the LONGEST run at the HIGHEST tier only, never the sum
     · fines are floored at what that day actually earned, so a fine cannot
       create debt
     · routines pay NOTHING directly. In the new model ctWeekMoney returns
       mrWeekMoney and the $1 goal bonus is never added to it — that bonus is
       on the LEGACY branch only. So the whole routine channel is the streak,
       and its ceiling is the top tier.
*/

const path = require('path');
const { MR_DEFAULT_RULES } = require(path.join(__dirname, '..', 'js', '18-rules.js'));

const R = MR_DEFAULT_RULES;
const money2 = n => Math.round((Number(n) || 0) * 100) / 100;
const usd = n => '$' + money2(n).toFixed(2);

/* ── The channels, each running the shipped rule ─────────────────── */

/* Chores. `graded` is [{day, grade}]. Mirrors mrChoreWeek: cheapest-first free
   chores, then a per-day cap on what is left. */
function choresPaid(graded) {
  const cfg = R.chores || {};
  const pay = cfg.grade || {};
  const cap = cfg.dailyCap;
  const freeCount = Number(cfg.freeChoresPerWeek) || 0;

  const all = graded
    .filter(c => Number(c.grade) > 0)
    .map((c, i) => ({ day: c.day, seq: i, grade: c.grade, value: Number(pay[c.grade]) || 0 }));

  const ranked = all.slice().sort((a, b) => (a.value - b.value) || (a.day - b.day) || (a.seq - b.seq));
  const free = new Set(ranked.slice(0, freeCount).map(c => c.seq));

  const days = [];
  let total = 0, overflow = 0;
  for (let d = 0; d < 7; d++) {
    let dayPaid = 0;
    all.filter(c => c.day === d).forEach(c => {
      if (free.has(c.seq)) return;
      const room = (cap == null) ? c.value : Math.max(0, cap - dayPaid);
      if (room <= 0) { overflow++; return; }
      dayPaid += Math.min(c.value, room);
    });
    total += dayPaid;
    days.push(money2(dayPaid));
  }
  return { paid: money2(total), days, overflow, freeUsed: free.size };
}

/* Learning. `units` is {itemId: unitsThisWeek}. Whole bundles only. */
function learningPaid(units) {
  const items = (R.learning || {}).items || [];
  let paid = 0;
  const lines = [];
  items.forEach(it => {
    const n = Number(units[it.id]) || 0;
    if (it.xpOnly) { lines.push({ id: it.id, units: n, amount: 0, xpOnly: true }); return; }
    const bundles = Math.floor(n / (Number(it.perUnit) || 1));
    const amount = money2(bundles * (Number(it.amount) || 0));
    paid += amount;
    lines.push({ id: it.id, units: n, bundles, amount });
  });
  return { paid: money2(paid), lines };
}

/* Streak. `cleanDays` is a 7-long boolean array; `sick` pauses rather than
   breaks. Longest run, highest tier only. */
function streakPaid(cleanDays, sick) {
  const tiers = ((R.streak || {}).tiers || []).slice().sort((a, b) => a.days - b.days);
  let run = 0, best = 0;
  for (let d = 0; d < 7; d++) {
    if (sick && sick[d]) continue;
    if (cleanDays[d]) { run++; best = Math.max(best, run); } else run = 0;
  }
  let bonus = 0, tier = 0;
  tiers.forEach(t => { if (best >= t.days) { bonus = Number(t.bonus) || 0; tier = t.days; } });
  return { days: best, bonus: money2(bonus), tier };
}

/* Competition. Swim only in the model — it is the one both girls actually do. */
function competitionPaid(comp) {
  if (!comp) return { paid: 0 };
  const s = (R.competition || {}).swim || {};
  const perPoint = Number(comp.provincial ? s.provincialPerPoint : s.perPoint) || 0;
  let total = (Number(comp.points) || 0) * perPoint;
  if (comp.qualified) total += Number(s.qualifyBonus) || 0;
  return { paid: money2(total) };
}

/* The week's fines, modelled as REPEATS OF ONE BEHAVIOUR — which is what the
   free-repeat rule is about. `perDay` is how many happened each day; the first
   `freeRepeats` of them in the week are forgiven and the rest cost.

   Modelling them as one item rather than as several is the harsher reading and
   the right one for a calibration: spread across four different items they
   would all fall inside their own free two and the channel would price at zero,
   which would tell us nothing about what a fine can do to a week. */
function finesApplied(perDay, dayEarnings) {
  const cfg = R.fines || {};
  const item = (cfg.items || [])[0] || {};
  const each = Number(item.amount) || 1;
  const free = Number(item.freeRepeats) || 0;
  let seen = 0, total = 0;
  for (let d = 0; d < 7; d++) {
    const n = Number(perDay[d]) || 0;
    let raw = 0;
    for (let i = 0; i < n; i++) { seen++; if (seen > free) raw += each; }
    const earned = dayEarnings[d] != null ? dayEarnings[d] : 0;
    total += cfg.dailyFloorZero ? Math.min(raw, earned) : raw;
  }
  return { total: money2(total) };
}

/* ── The weeks ────────────────────────────────────────────────────
   A school week asks three routine sessions on each of five school days and
   two on each weekend day, which is 19. A "clean day" is every session that
   day asked for. */
const WEEKS = {
  quiet: {
    label: 'quiet — an off week: school happens, not much else does',
    graded: [{ day: 1, grade: 2 }, { day: 3, grade: 1 }],
    learning: { math: 3, handwriting: 0, chinese: 10 },
    clean: [false, true, true, false, false, false, false],
    sick: [false, false, false, false, false, false, false],
    comp: null,
    fines: [0, 1, 0, 0, 1, 0, 0],
  },
  ordinary: {
    label: 'ordinary — the normal shape of a school week',
    graded: [{ day: 0, grade: 3 }, { day: 1, grade: 3 }, { day: 2, grade: 2 },
             { day: 4, grade: 3 }, { day: 5, grade: 2 }],
    learning: { math: 9, handwriting: 5, chinese: 20 },
    clean: [true, true, true, true, true, false, false],
    sick: [false, false, false, false, false, false, false],
    comp: null,
    fines: [0, 0, 1, 0, 0, 0, 0],
  },
  strong: {
    label: 'strong — everything kept, a swim meet, a qualifying time',
    graded: [{ day: 0, grade: 3 }, { day: 1, grade: 3 }, { day: 2, grade: 3 },
             { day: 3, grade: 3 }, { day: 4, grade: 3 }, { day: 5, grade: 3 },
             { day: 6, grade: 2 }],
    learning: { math: 15, handwriting: 10, chinese: 40 },
    clean: [true, true, true, true, true, true, true],
    sick: [false, false, false, false, false, false, false],
    comp: { points: 6, qualified: false },
    fines: [0, 0, 0, 0, 0, 0, 0],
  },
};

function weekMoney(w) {
  const ch = choresPaid(w.graded);
  const le = learningPaid(w.learning);
  const st = streakPaid(w.clean, w.sick);
  const co = competitionPaid(w.comp);
  const fi = finesApplied(w.fines, ch.days);
  const gross = money2(ch.paid + le.paid + st.bonus + co.paid);
  const net = money2(Math.max(0, gross - fi.total));
  return { chores: ch, learning: le, streak: st, comp: co, fines: fi, gross, net };
}

/* ── Report ───────────────────────────────────────────────────────
   Only when run directly. tests/money.test.js requires this file for its week
   models and its channel functions, and a test that prints a full report on
   top of its own output is noise. */
function report() {
  const cfg = R.chores || {};
  console.log('Money calibration — read live from js/18-rules.js');
  console.log(`chores: grade 3 ${usd(cfg.grade[3])} · 2 ${usd(cfg.grade[2])} · 1 ${usd(cfg.grade[1])}`
    + ` · cap ${usd(cfg.dailyCap)}/day · first ${cfg.freeChoresPerWeek} free`);
  console.log('streak: ' + ((R.streak || {}).tiers || [])
    .map(t => `${t.days}d ${usd(t.bonus)}`).join(' · ') + ' · highest tier only');
  console.log('learning: ' + ((R.learning || {}).items || [])
    .filter(i => !i.xpOnly).map(i => `${i.id} ${usd(i.amount)}/${i.perUnit}${i.unit}`).join(' · '));
  console.log('routines pay nothing directly — the streak IS the routine channel');
  console.log('');

  const order = ['quiet', 'ordinary', 'strong'];
  const results = {};
  order.forEach(kind => {
    const w = WEEKS[kind];
    const m = weekMoney(w);
    results[kind] = m;
    console.log(`── ${w.label}`);
    console.log(`   chores       ${usd(m.chores.paid).padStart(7)}`
      + `   (${m.chores.freeUsed} free used${m.chores.overflow ? `, ${m.chores.overflow} over the daily cap` : ''})`);
    console.log(`   learning     ${usd(m.learning.paid).padStart(7)}`
      + `   (${m.learning.lines.filter(l => !l.xpOnly).map(l => `${l.id} ${l.bundles}x`).join(', ')})`);
    console.log(`   streak       ${usd(m.streak.bonus).padStart(7)}   (longest run ${m.streak.days} days`
      + `${m.streak.tier ? `, ${m.streak.tier}-day tier` : ', no tier reached'})`);
    console.log(`   competition  ${usd(m.comp.paid).padStart(7)}`);
    console.log(`   fines       -${usd(m.fines.total).padStart(7)}`);
    console.log(`   ─────────────────────`);
    console.log(`   net          ${usd(m.net).padStart(7)}`);
    console.log('');
  });

  /* A realistic term, the same mix xp-calibrate uses, so the two tools describe
     the same imagined child. */
  const TERM = ['ordinary', 'ordinary', 'quiet', 'ordinary', 'strong', 'ordinary', 'quiet', 'ordinary'];
  const termTotal = money2(TERM.reduce((s, k) => s + results[k].net, 0));
  const perWeek = money2(termTotal / TERM.length);
  const annual = money2(perWeek * 52);

  console.log('── a realistic term (8 weeks: 5 ordinary, 2 quiet, 1 strong)');
  console.log(`   total ${usd(termTotal)} · ${usd(perWeek)} a week · ${usd(annual)} a year at that rate`);
  console.log('');

  const targets = R.targets || {};
  Object.keys(targets).forEach(kid => {
    const t = Number((targets[kid] || {}).annual) || 0;
    if (!t) return;
    console.log(`   ${kid}: target ${usd(t)}/yr → this shape reaches ${Math.round((annual / t) * 100)}% of it`);
  });
  console.log('');

  /* The routine ceiling, stated out loud, because it is the number the
     planned/simple routine change moves and the one most easily got wrong. */
  const topTier = ((R.streak || {}).tiers || []).reduce((a, b) => (b.days > a.days ? b : a), { days: 0, bonus: 0 });
  console.log(`Routine ceiling: ${usd(topTier.bonus)} per child per week (${topTier.days} clean days).`);
  console.log('The $1 weekly goal bonus is on the LEGACY ctWeekMoney branch only and');
  console.log('is never added in the current model — do not count it.');
}

if (require.main === module) report();

module.exports = { weekMoney, WEEKS, report,
  choresPaid, learningPaid, streakPaid, competitionPaid, finesApplied };
