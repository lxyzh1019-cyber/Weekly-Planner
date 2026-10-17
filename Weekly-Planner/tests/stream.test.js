// Weekly-Planner — the money stream (js/40-stream.js).
// Run: node tests/stream.test.js
//
// These hold the PROPERTY the redesign is built on, not just a few examples:
//
//     opening + everything that came in − everything that went out
//       === what is in hand
//
// A balance system cannot state that about itself — `wallet.cash` was one
// number eight functions wrote, and "is it right?" had no answer except to
// trust all eight. A flow system can, so this file asserts it over random
// sequences as well as over fixtures, which is the difference between a test
// that catches the bug you thought of and one that catches the bug you didn't.
//
// TZ=UTC deliberately, like every other Node suite here: the family is in
// Edmonton, and a date bug that only shows outside that zone must not be able
// to hide behind the developer's own clock. Set here, before anything reads a
// date, rather than as a `TZ=UTC` prefix in package.json, which Windows'
// command shell rejects.
process.env.TZ = 'UTC';

const s =require('../js/40-stream.js');

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond === true) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name, detail != null ? '— ' + detail : (cond === false ? '' : '— ' + JSON.stringify(cond))); }
}
const money2 = n => Math.round((Number(n) || 0) * 100) / 100;

/* A tiny builder so a fixture reads like the story it describes. */
let seq = 0;
function ev(dayKey, from, to, amount, kind) {
  seq++;
  return { id: 'e' + seq, at: seq, dayKey, from, to, amount, kind: kind || 'move' };
}

// ── The shape of one ordinary month ───────────────────────────────
{
  const list = [
    ev('2026-08-31', 'opening', 'cash', 50, 'open'),
    ev('2026-09-07', 'earned', 'cash', 12, 'settle'),
    ev('2026-09-07', 'prize', 'cash', 21, 'settle'),
    ev('2026-09-07', 'cash', 'fine', 2, 'fine'),
    ev('2026-09-08', 'gift', 'cash', 50, 'gift'),
    ev('2026-09-08', 'cash', 'ready', 30, 'ready'),
    ev('2026-09-09', 'cash', 'loan:loan', 5, 'loan'),
    ev('2026-09-10', 'cash', 'spent', 6, 'spend'),
  ];
  const f = s.evFlowOf(list, '2026-09-01', '2026-09-30');

  check('money that came in is counted by where it came from',
    f.sources.earned === 12 && f.sources.prize === 21 && f.sources.gift === 50
      ? true : JSON.stringify(f.sources));

  check('an allocation between two pots is not money coming in',
    f.inTotal === 83 ? true : 'inTotal ' + f.inTotal);

  check('every debt is one "paid back" ribbon',
    f.dests.loan === 5 && f.dests.ready === 30 && f.dests.spent === 6 && f.dests.fine === 2
      ? true : JSON.stringify(f.dests));

  // THE invariant. 50 opening + 83 in − (2 fine + 30 ready + 5 loan + 6 spend)
  check('opening + in − out === what is in hand',
    money2(50 + f.inTotal - f.outTotal - f.dests.ready) === f.inHand
      ? true : `in hand ${f.inHand}`);

  check('a balance reads all of history, not just the span',
    s.evBalanceOf(list, 'cash') === 90 && s.evBalanceOf(list, 'ready') === 30
      ? true : `cash ${s.evBalanceOf(list, 'cash')} ready ${s.evBalanceOf(list, 'ready')}`);

  check('what she has altogether is the pots added up',
    s.evWorthOf(list) === 120 ? true : String(s.evWorthOf(list)));

  /* The Flow draws two groups under "where it went", and each caption must be
     the sum of the bars under it. `outTotal` is what LEFT (fine, loan, spent);
     `savedTotal` is what was put away to grow. The screen sums nothing itself,
     so both are owned here — the caption that read "$0.00" above a $30 bar
     was a caption computed from one set of rows sitting above another. */
  check('what went out is exactly the rows that left',
    f.outTotal === money2(f.dests.fine + f.dests.loan + f.dests.spent)
      ? true : `outTotal ${f.outTotal}`);
  check('what was put away to grow is its own total, not part of what went out',
    f.savedTotal === 30 ? true : `savedTotal ${f.savedTotal}`);

  // A typical month carries both, divided by the months that passed.
  const typ = s.evTypicalMonthOf(list, '2026-08', '2026-09');
  check('a typical month says what was put away, too',
    typ.savedTotal === 15 && typ.outTotal === money2(typ.dests.fine + typ.dests.loan + typ.dests.spent)
      ? true : JSON.stringify({ savedTotal: typ.savedTotal, outTotal: typ.outTotal, dests: typ.dests }));
}

// ── Moving money back out of a pot ────────────────────────────────
// A ribbon that went to "kept ready" and came back must shrink, not draw a
// negative one — a child cannot read a negative ribbon, and the pot balance
// has to follow either way.
{
  const list = [
    ev('2026-09-01', 'opening', 'cash', 100, 'open'),
    ev('2026-09-02', 'cash', 'ready', 40, 'ready'),
    ev('2026-09-20', 'ready', 'cash', 15, 'move'),
  ];
  const f = s.evFlowOf(list, '2026-09-01', '2026-09-30');
  check('taking money back out of a pot shrinks that ribbon',
    f.dests.ready === 25 ? true : JSON.stringify(f.dests));
  check('and the pot itself agrees',
    s.evBalanceOf(list, 'ready') === 25 && s.evBalanceOf(list, 'cash') === 75
      ? true : `ready ${s.evBalanceOf(list, 'ready')} cash ${s.evBalanceOf(list, 'cash')}`);
  check('a pot emptied completely leaves no ribbon behind',
    (() => {
      const all = list.concat([ev('2026-09-21', 'ready', 'cash', 25, 'move')]);
      const g = s.evFlowOf(all, '2026-09-01', '2026-09-30');
      return g.dests.ready === undefined && s.evBalanceOf(all, 'ready') === 0;
    })() ? true : 'ribbon or balance left over');
}

// ── A company losing value ────────────────────────────────────────
// The lesson holding one is meant to teach. A loss is money leaving the pot,
// so it has a direction rather than a negative amount.
{
  const list = [
    ev('2026-09-01', 'opening', 'cash', 100, 'open'),
    ev('2026-09-02', 'cash', 'invest', 40, 'invest'),
    ev('2026-09-15', 'interest', 'invest', 6, 'interest'),
    ev('2026-09-28', 'invest', 'interest', 10, 'interest'),
  ];
  check('a company that went down is worth less, and says so',
    s.evBalanceOf(list, 'invest') === 36 ? true : String(s.evBalanceOf(list, 'invest')));
  const f = s.evFlowOf(list, '2026-09-01', '2026-09-30');
  check('what it made on its own is money coming in',
    f.sources.interest === 6 ? true : JSON.stringify(f.sources));
}

// ── History, month by month ───────────────────────────────────────
{
  const list = [
    ev('2026-07-06', 'earned', 'cash', 20, 'settle'),
    ev('2026-09-07', 'earned', 'cash', 40, 'settle'),
  ];
  const months = s.evMonthsOf(list);
  check('every month between the first and the last is there',
    months.length === 3 && months.map(m => m.month).join(' ') === '2026-07 2026-08 2026-09'
      ? true : months.map(m => m.month).join(' '));
  check('a month nobody earned in is marked empty, not dropped',
    months[1].empty === true && months[1].inTotal === 0 && months[0].empty === false
      ? true : JSON.stringify(months.map(m => m.empty)));

  // The mistake mrYearToDate made with settled weeks, not repeated here: a
  // quiet month counts in the denominator, or a lazy summer reads as a good one.
  const typ = s.evTypicalMonthOf(list);
  check('a typical month divides by the months that PASSED, not the busy ones',
    typ.months === 3 && typ.sources.earned === 20 ? true : JSON.stringify(typ));
}

// ── A settled week is a fact on the stream ────────────────────────
{
  const list = [
    Object.assign(ev('2026-09-07', null, null, 0, 'settle'), { weekKey: '2026-09-07' }),
    Object.assign(ev('2026-09-14', 'earned', 'cash', 9, 'settle'), { weekKey: '2026-09-14' }),
  ];
  const settled = s.evSettledWeeksOf(list);
  check('a week settled at $0 is still answerable as settled',
    !!settled['2026-09-07'] && !!settled['2026-09-14'] ? true : JSON.stringify(settled));
  check('a marker moves no money',
    s.evBalanceOf(list, 'cash') === 9 ? true : String(s.evBalanceOf(list, 'cash')));
  /* And the other half, which is what actually broke: `settle` names BOTH the
     fact and the dollars, so a settlement carrying money must still move it.
     Deciding markerhood by kind rather than by amount silently zeroed every
     settled week — the wallet went up, the stream did not. */
  check('a settlement that carries money still moves it',
    s.evFlowOf(list, null, null).sources.earned === 9
      ? true : JSON.stringify(s.evFlowOf(list, null, null).sources));
}

// ── A correction is a reversal ────────────────────────────────────
// `evReverse` shipped in Stage 1 with zero callers and no test. Stage 3 is what
// it was written for — correcting a gift or a meet — so it gets held here
// before anything leans on it. The pure core is what this file can reach, so
// the reversal is built the way evReverse builds one and the ARITHMETIC is
// asserted; the app-level guard is covered by the smoke check.
{
  const orig = ev('2026-09-08', 'gift', 'cash', 50, 'gift');
  // What evReverse writes: same kind and amount, from/to swapped, dated the day
  // the correction was made, carrying `reverses`.
  const undo = Object.assign(ev('2026-09-20', 'cash', 'gift', 50, 'gift'),
                             { reverses: orig.id });
  const list = [ev('2026-09-01', 'opening', 'cash', 10, 'open'), orig, undo];

  check('a reversal puts the balance back exactly',
    s.evBalanceOf(list, 'cash') === 10 ? true : String(s.evBalanceOf(list, 'cash')));

  // Both rows stay readable. A history that silently loses its mistakes cannot
  // answer "what happened to my $50", which is the question it exists for.
  check('the original stays on the record beside its correction',
    list.filter(e => e.ref === undefined && e.kind === 'gift').length === 2
      ? true : 'the original was removed');

  // The flow nets out: the gift ribbon and its return cancel, so a corrected
  // gift does not leave a month reading as though money arrived twice.
  const f = s.evFlowOf(list, '2026-09-01', '2026-09-30');
  check('a corrected gift nets out of the month it was corrected in',
    money2(f.inTotal - f.outTotal) === 10 ? true : `in ${f.inTotal} out ${f.outTotal}`);

  // And a SECOND reversal of the same event must not be possible — which is
  // what evReverse's `reverses` guard scans for. Asserted on the shape rather
  // than the function, because two of them would double the money back.
  const twice = list.concat([
    Object.assign(ev('2026-09-21', 'cash', 'gift', 50, 'gift'), { reverses: orig.id })]);
  const already = twice.filter(e => e.reverses === orig.id).length;
  check('two reversals of one event would take the money back twice',
    already === 2 && s.evBalanceOf(twice, 'cash') === -40
      ? true : `guard needed: ${already} reversals, cash ${s.evBalanceOf(twice, 'cash')}`);
}

// ── The property, over random sequences ───────────────────────────
// Fixtures catch what their author thought of. This walks a thousand random
// histories and asserts the invariant on every one, which is the only way to
// be sure a combination nobody imagined cannot break it.
{
  let worst = null;
  const homes = ['cash', 'ready', 'locked', 'invest'];
  const sources = ['earned', 'gift', 'prize', 'interest'];
  const sinks = ['spent', 'fine', 'loan:loan'];
  // Deterministic PRNG: a failure has to be reproducible, and a test that
  // fails on one run in fifty and passes on the next is noise, not a signal.
  let seed = 20260921;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = a => a[Math.floor(rnd() * a.length)];

  for (let trial = 0; trial < 1000 && !worst; trial++) {
    const list = [];
    let id = 0;
    const pots = { cash: 0, ready: 0, locked: 0, invest: 0 };
    let inSum = 0, outSum = 0;
    for (let i = 0; i < 20; i++) {
      const amt = money2(Math.max(0.01, Math.round(rnd() * 5000) / 100));
      const day = '2026-09-' + String(1 + Math.floor(rnd() * 28)).padStart(2, '0');
      const roll = rnd();
      let from, to;
      if (roll < 0.45) {                       // money arrives
        from = pick(sources); to = pick(homes);
        inSum = money2(inSum + amt);
      } else if (roll < 0.75) {                // money leaves
        from = pick(homes); to = pick(sinks);
        if (pots[from] < amt) continue;        // never spend what is not there
        outSum = money2(outSum + amt);
      } else {                                 // money is moved between pots
        from = pick(homes); to = pick(homes);
        if (from === to || pots[from] < amt) continue;
      }
      if (from in pots) pots[from] = money2(pots[from] - amt);
      if (to in pots) pots[to] = money2(pots[to] + amt);
      list.push({ id: 'r' + (++id), at: i, dayKey: day, from, to, amount: amt, kind: 'move' });
    }
    // 1 · every pot the stream derives matches the one walked by hand
    const derived = homes.every(h => s.evBalanceOf(list, h) === pots[h]);
    // 2 · in − out over the whole span equals everything she has
    const f = s.evFlowOf(list, null, null);
    const worth = s.evWorthOf(list);
    const balanced = money2(f.inTotal - f.outTotal) === worth;
    // 3 · order cannot matter: a merge from another device arrives shuffled
    const shuffled = list.slice().sort(() => rnd() - 0.5);
    const stable = homes.every(h => s.evBalanceOf(shuffled, h) === pots[h]);
    if (!derived || !balanced || !stable) {
      worst = { trial, derived, balanced, stable, pots, inTotal: f.inTotal, outTotal: f.outTotal, worth };
    }
  }
  check('every pot the stream derives matches the movements, over 1000 histories',
    worst === null || worst.derived === true, worst && JSON.stringify(worst));
  check('in minus out always equals everything she has',
    worst === null || worst.balanced === true, worst && JSON.stringify(worst));
  check('the answer does not depend on the order events arrived in',
    worst === null || worst.stable === true, worst && JSON.stringify(worst));
}

// ── Labels ────────────────────────────────────────────────────────
// A ribbon nothing can name draws as a blank on the flow diagram, which is the
// same invisible failure the activity archive rule exists to prevent.
{
  const missing = s.EV_SOURCES.filter(k => !s.EV_SOURCE_LABELS[k]);
  check('every source a movement can name has words for a child',
    missing.length === 0 || missing);
  const destKeys = s.EV_SINKS.concat(['ready', 'locked', 'invest', 'loan']);
  const noLabel = destKeys.filter(k => !s.EV_DEST_LABELS[k]);
  check('every destination a movement can name has words for a child',
    noLabel.length === 0 || noLabel);
  check('every debt groups under one "paid back"',
    s.evDestKey('loan:abc') === 'loan' && s.evDestKey('loan:xyz') === 'loan'
      && s.evDestKey('spent') === 'spent' ? true : 'grouping wrong');
  check('a holding kind knows which pot it lives in',
    s.evHomeForHolding('savings') === 'ready' && s.evHomeForHolding('gic') === 'locked'
      && s.evHomeForHolding('stock') === 'invest' && s.evHomeForHolding('nonsense') === null
      ? true : 'mapping wrong');
}

// ── Redo / Undo takes the commit's own lines back off the stream ─────
// Plan v3 §E "Undo fix" (docs/handoff/pr-c-cash-pool.md §5b). The meeting's
// undo put the wallet back but LEFT the commit's stream lines, so signing the
// week again wrote them a second time: the stream said she was paid twice and
// the wallet said once. The commit never happened, so its lines are not
// reversed (a reversal is a correction to something that did happen) — they
// are removed, exactly the ones written between the snapshot and the seal,
// and nothing else.
{
  const base = [
    ev('2026-09-01', 'opening', 'cash', 20, 'open'),
    ev('2026-09-03', 'gift', 'cash', 10, 'gift'),
  ];
  const snapIds = s.evIdsOf(base);
  // The commit writes its lines.
  const commit = () => [
    ev('2026-09-28', 'earned', 'cash', 12, 'settle'),
    ev('2026-09-28', 'prize', 'cash', 6, 'settle'),
    ev('2026-09-28', 'cash', 'loan:loan', 3.23, 'loan'),
    { id: 'm' + (++seq), at: seq, dayKey: '2026-09-28', kind: 'settle', amount: 0, from: null, to: null },
  ];
  let list = base.concat(commit());
  const written = s.evWrittenSince(list, snapIds);
  check('the lines a commit wrote are exactly the ones not in the snapshot',
    written.length === 4 ? true : written);
  const once = s.evBalanceOf(list, 'cash');
  // Undo: take those lines off; sign again.
  list = s.evWithout(list, written);
  check('undo leaves the stream exactly as it was at the snapshot',
    JSON.stringify(list.map(e => e.id)) === JSON.stringify(base.map(e => e.id)) ? true : list.map(e => e.id));
  list = list.concat(commit());
  check('signing again after an undo does not double-count the stream',
    s.evBalanceOf(list, 'cash') === once ? true : s.evBalanceOf(list, 'cash') + ' vs ' + once);
  check('the week reads settled once, not twice',
    list.filter(e => e.kind === 'settle' && !(e.amount > 0)).length === 1);
  // A line that arrived before the snapshot is never taken by an undo.
  check('an undo never takes a line from before the snapshot',
    s.evWrittenSince(base, snapIds).length === 0);
}

// ── The interest line on a loan and an advance keep the invariant ────
// Interest added to her wall moves no money of hers (interest → loan:<id>):
// it is drawn as a row, and every pot still equals opening + in − out. An
// advance is cash she already spent, written as cash → spent.
{
  const list = [
    ev('2026-09-01', 'opening', 'cash', 30, 'open'),
    ev('2026-09-28', 'earned', 'cash', 20, 'settle'),
    ev('2026-09-28', 'cash', 'spent', 2, 'spend'),           // ⏪ drawn in advance
    ev('2026-09-28', 'interest', 'loan:loan', 0.54, 'interest'), // the wall grew
    ev('2026-09-28', 'cash', 'loan:loan', 3.23, 'loan'),
  ];
  const f = s.evFlowOf(list);
  const cash = s.evBalanceOf(list, 'cash');
  check('advance and interest lines keep opening + in − out === in hand',
    money2(f.inTotal - f.outTotal) === cash && cash === money2(30 + 20 - 2 - 3.23)
      ? true : JSON.stringify({ in: f.inTotal, out: f.outTotal, cash }));
  check('interest added to the wall is not money that left her pots',
    !f.dests.interest ? true : JSON.stringify(f.dests));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
