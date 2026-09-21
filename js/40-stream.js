// Weekly-Planner — the money stream: every dollar as a movement, never a stored total.
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   THE STREAM — money is a FLOW, not a balance

   Every earlier version of this app stored money as a BALANCE: `wallet.cash`
   plus a holding per pot, credited by the meeting and spent by the split. Eight
   functions wrote that one number (js/14-money.js, the loan's four paths,
   js/21-money-data.js's maturity payout, the meeting's commit) and none of them
   recorded WHY, so "where did the $50 go" had no answer anywhere in the app —
   and a stored total that eight writers have to keep right is a total that goes
   wrong, which is most of what the money audit found.

   It is also the wrong lesson. A child watching a total learns to watch a
   total. A child watching a flow learns that she earns some, spends some, keeps
   some, locks some — and that what is left is what is left.

   So this file stores MOVEMENTS and derives everything else.

   ── Double entry, in a child's vocabulary ──

   Every event moves an amount FROM somewhere TO somewhere:

     SOURCES (outside → in)   earned · gift · prize · borrowed · interest
                              typed  · opening
     HOMES   (inside)         cash · ready · locked · invest
     SINKS   (in → outside)   spent · fine · loan:<debtId> · returned

   A home's balance is everything that arrived minus everything that left. That
   is the whole engine, and it is why the invariant in tests/stream.test.js can
   be stated at all: opening + Σin − Σout === what is in hand. A balance system
   cannot state that about itself; this one can, on both devices, in any merge
   order.

   ── Shadow mode (Stage 1) ──

   Nothing here REPLACES the old stores yet. `evMirror` is called beside every
   existing writer, the old `wallet.cash` is still the number the app reads, and
   `evShadowDrift` reports where the two disagree. The old stores are retired
   only once that drift has been zero on real household data — see CLAUDE.md,
   "The money stream". Writing the new truth beside the old one and PROVING they
   agree is the only safe way to move a household's money under itself.

   ── Pure core, app wrapper ──

   Everything that answers a question takes an ARRAY of events and returns
   numbers: `evBalanceOf`, `evFlowOf`, `evSpanOf`, `evMonthsOf`. The `kid`-taking
   wrappers below just fetch the array. Same split — and same reason — as
   `bufferClip` in js/05-helpers.js: a calculation reachable only from a browser
   is a calculation no unit test can hold, and the money layer has already been
   burned twice by exactly that.
   ════════════════════════════════════════════════════════════════ */

/* The four places money can SIT. Anything else named by an event is outside
   the wallet: a source it came from or a sink it went to. Order is the order
   the child is taught them — pay what you owe, keep some ready, lock some
   away, then try growing it — and the flow diagram draws them in it. */
const EV_HOMES = ['cash', 'ready', 'locked', 'invest'];

/* Where money comes FROM. `opening` is the migration's balancing entry — what
   she already had the day the stream began — and is deliberately a source like
   any other, so the invariant holds from the first event rather than needing a
   special case. */
const EV_SOURCES = ['earned', 'gift', 'prize', 'borrowed', 'interest', 'typed', 'opening'];

/* Where money GOES when it leaves. `loan:<debtId>` is dynamic, so it is matched
   by prefix rather than listed. `returned` is a gift taken back — the record
   removed, the money with it. */
const EV_SINKS = ['spent', 'fine', 'returned'];

/* Kinds that may carry $0, because they record an EVENT rather than a movement.
   Kept to a named list so a typo in a `kind` cannot quietly create a family of
   zero-dollar rows nothing ever reads. */
const EV_MARKER_KINDS = ['settle', 'reviewed', 'note'];

/* What the child is shown, per side of the diagram. The label is hers; the key
   is the app's. Icons match the ones already on the money pages so a ribbon and
   a card are recognisably the same thing. */
const EV_SOURCE_LABELS = {
  earned:   { icon: '🧹', label: 'Jobs and routines' },
  prize:    { icon: '🏆', label: 'Competitions' },
  gift:     { icon: '🎁', label: 'Gifts' },
  borrowed: { icon: '🎿', label: 'Borrowed' },
  interest: { icon: '✨', label: 'Made on its own' },
  typed:    { icon: '📖', label: 'Before the app' },
  opening:  { icon: '📖', label: 'Already had' },
};
const EV_DEST_LABELS = {
  spent:  { icon: '🛍️', label: 'Spent' },
  ready:  { icon: '💵', label: 'Kept ready' },
  locked: { icon: '🔒', label: 'Locked away' },
  invest: { icon: '📈', label: 'In companies' },
  loan:   { icon: '🎿', label: 'Paid back' },
  fine:   { icon: '📦', label: 'Taken off' },
  returned: { icon: '↩️', label: 'Given back' },
};

/* Which home a holding record lives in. `mnyEnsureHoldings` keys its records by
   `kind`, and the stream keys movements by home; without one owner for the
   mapping the two drift the moment a fourth kind is added. */
const EV_HOME_FOR_HOLDING = { savings: 'ready', gic: 'locked', stock: 'invest' };
function evHomeForHolding(kind) { return EV_HOME_FOR_HOLDING[String(kind)] || null; }

function evIsHome(node) { return EV_HOMES.indexOf(String(node)) >= 0; }
function evIsLoan(node) { return String(node).indexOf('loan:') === 0; }
/* A sink is anything that is neither a home nor a source. Written as "not the
   other two" rather than as a list, because `loan:<id>` and `goal:<id>` are
   generated and a list would have to guess at them. */
function evIsSink(node) {
  return !evIsHome(node) && EV_SOURCES.indexOf(String(node)) < 0;
}
/* The key a destination is GROUPED under on the diagram. Every debt is one
   "Paid back" ribbon: a nine-year-old with two loans does not want two ribbons,
   she wants to know how much went to paying things off. */
function evDestKey(node) { return evIsLoan(node) ? 'loan' : String(node); }

/* ── The pure core ─────────────────────────────────────────────────
   Each of these takes a plain array. `evSpanOf` filters, the rest measure. */

/* Events inside a date span, inclusive both ends. Either bound may be null for
   "no limit", which is what the "Since the start" chip passes. Sorted oldest
   first so a running balance can be walked straight off the result. */
function evSpanOf(events, from, to) {
  return (events || [])
    .filter(e => e && e.dayKey
      && (!from || String(e.dayKey) >= String(from))
      && (!to   || String(e.dayKey) <= String(to)))
    .slice()
    .sort((a, b) => (String(a.dayKey) < String(b.dayKey) ? -1
                   : String(a.dayKey) > String(b.dayKey) ? 1
                   : (Number(a.at) || 0) - (Number(b.at) || 0)));
}

/* What is sitting in one home, over all of history up to `asOf`. NOT span-aware
   by default and deliberately so: a balance is everything that ever happened,
   and asking "what is in cash this month" is a question about the FLOW, not
   about the balance. The two were conflated on the old money story, which is
   how its three rows came not to add up. */
function evBalanceOf(events, home, asOf) {
  let n = 0;
  (events || []).forEach(e => {
    if (!e) return;
    if (asOf && String(e.dayKey) > String(asOf)) return;
    const amt = Number(e.amount) || 0;
    if (!(amt > 0)) return;
    if (String(e.to) === String(home)) n += amt;
    if (String(e.from) === String(home)) n -= amt;
  });
  return Math.round(n * 100) / 100;
}

/* Everything she has, derived. The parent sees this; no kid screen prints it,
   by decision — "left" on her page means what is still in hand, which is
   evBalanceOf(events, 'cash'). */
function evWorthOf(events, asOf) {
  return Math.round(EV_HOMES.reduce((s, h) => s + evBalanceOf(events, h, asOf), 0) * 100) / 100;
}

/* THE FLOW, for one span — what the diagram draws and what the plain-text
   lines underneath it print, from one call so the picture can never say
   something the words do not.

   `sources` and `dests` are keyed by the GROUPED key, so two debts are one
   "Paid back". A movement between two homes (cash → ready) is not income and
   not spending: it is an allocation, and it appears ONLY on the dest side —
   otherwise moving $10 into savings would read as $10 of new money. */
function evFlowOf(events, from, to) {
  const rows = evSpanOf(events, from, to);
  const sources = {}, dests = {};
  let inTotal = 0, outTotal = 0;
  rows.forEach(e => {
    const amt = Math.round((Number(e.amount) || 0) * 100) / 100;
    if (!(amt > 0)) return;
    const src = String(e.from), dst = String(e.to);
    // Money entering the system from outside: a source ribbon.
    if (!evIsHome(src) && evIsHome(dst)) {
      sources[src] = Math.round(((sources[src] || 0) + amt) * 100) / 100;
      inTotal = Math.round((inTotal + amt) * 100) / 100;
      return;
    }
    // Money leaving the system, or being put somewhere: a destination ribbon.
    if (evIsHome(src) && !evIsHome(dst)) {
      const k = evDestKey(dst);
      dests[k] = Math.round(((dests[k] || 0) + amt) * 100) / 100;
      outTotal = Math.round((outTotal + amt) * 100) / 100;
      return;
    }
    // Home → home: an allocation. It is where the money WENT, so it draws as a
    // destination, but it never counts as money that came in or went out.
    if (evIsHome(src) && evIsHome(dst)) {
      if (dst !== 'cash') {
        dests[dst] = Math.round(((dests[dst] || 0) + amt) * 100) / 100;
      } else {
        // Coming back to cash undoes an allocation, so it reduces that ribbon
        // rather than drawing a negative one a child would have to interpret.
        dests[src] = Math.round(((dests[src] || 0) - amt) * 100) / 100;
        if (dests[src] <= 0) delete dests[src];
      }
    }
  });
  return {
    from: from || null, to: to || null,
    sources, dests, inTotal, outTotal,
    // What is in hand at the END of the span — a balance, so it reads the whole
    // history up to `to`, not just the span. "Left" is not "in minus out".
    inHand: evBalanceOf(events, 'cash', to),
    count: rows.length,
  };
}

/* One flow per calendar month, oldest first — the history strip. A month with
   no events is still returned, marked `empty`, because a gap is a fact: a
   summer with no jobs is something to see, and a month silently missing from a
   chart reads as a month that did not happen. */
function evMonthsOf(events, firstMonth, lastMonth) {
  const all = (events || []).filter(e => e && e.dayKey).map(e => String(e.dayKey).slice(0, 7));
  if (!all.length && !firstMonth) return [];
  const first = firstMonth || all.slice().sort()[0];
  const last = lastMonth || all.slice().sort().reverse()[0] || first;
  const out = [];
  let [y, m] = String(first).split('-').map(Number);
  const [ly, lm] = String(last).split('-').map(Number);
  // Bounded so a wrong clock or a typo in a start date cannot spin forever.
  for (let guard = 0; guard < 600; guard++) {
    const key = y + '-' + String(m).padStart(2, '0');
    const days = new Date(y, m, 0).getDate();
    const flow = evFlowOf(events, key + '-01', key + '-' + String(days).padStart(2, '0'));
    out.push(Object.assign({ month: key, empty: flow.count === 0 }, flow));
    if (y > ly || (y === ly && m >= lm)) break;
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

/* A TYPICAL month — every ribbon divided by the number of months that have
   ELAPSED, not by the number that happen to hold events. Dividing by months
   with data is the same mistake `mrYearToDate` made with settled weeks: it
   turns a quiet summer into a high average and tells a child she is doing
   better than she is. An empty month counts. */
function evTypicalMonthOf(events, firstMonth, lastMonth) {
  const months = evMonthsOf(events, firstMonth, lastMonth);
  const n = months.length || 1;
  const avg = (obj) => {
    const out = {};
    Object.keys(obj).forEach(k => { out[k] = Math.round((obj[k] / n) * 100) / 100; });
    return out;
  };
  const sources = {}, dests = {};
  let inTotal = 0, outTotal = 0;
  months.forEach(mo => {
    Object.keys(mo.sources).forEach(k => { sources[k] = (sources[k] || 0) + mo.sources[k]; });
    Object.keys(mo.dests).forEach(k => { dests[k] = (dests[k] || 0) + mo.dests[k]; });
    inTotal += mo.inTotal; outTotal += mo.outTotal;
  });
  return {
    months: n, typical: true,
    sources: avg(sources), dests: avg(dests),
    inTotal: Math.round((inTotal / n) * 100) / 100,
    outTotal: Math.round((outTotal / n) * 100) / 100,
    inHand: months.length ? months[months.length - 1].inHand : 0,
    count: months.reduce((s, mo) => s + mo.count, 0),
  };
}

/* Which weeks have been settled, read off the stream. This is what replaces
   `finalizedWeeks`, `weekPlans[].committedAt` and `meetingsHeld` as the answer
   to "did this week's money move" — three stored flags with three writers that
   could and did disagree. A week is settled BECAUSE its lines exist. */
function evSettledWeeksOf(events) {
  const out = {};
  (events || []).forEach(e => {
    if (e && e.kind === 'settle' && e.weekKey) out[e.weekKey] = Number(e.at) || 0;
  });
  return out;
}

/* ── The app-facing wrappers ───────────────────────────────────────
   These read one child's stream off her profile. Everything above is pure. */

function evEnsure(kid) {
  const p = getProfData(kid);
  if (!Array.isArray(p.events)) p.events = [];
  return p.events;
}
function evList(kid) { return evEnsure(kid); }

/* Append one movement. Returns the event so a caller can reference it.

   `dayKey` defaults to today but is ALWAYS overridable, which is the whole
   point of the field: a gift arrives at a birthday and a meet happens on a
   Saturday, and the old `mnyAddDeposit` hardcoding `todayKey()` with no way to
   say otherwise is one of the defects this redesign exists to remove.

   Append-only by design. A correction is a REVERSING event plus a new one,
   never an edit — see `evReverse`. Two devices can then never disagree about a
   balance, because neither can change what the other already wrote. */
function evAdd(kid, fields) {
  const f = fields || {};
  const amount = money2(f.amount);
  /* A zero-dollar movement is not an event — except for a MARKER, which is how
     the stream records something that happened without money moving. A week
     settled at $0 is the case that matters: it is a real settlement, and if
     only the dollars were recorded then "was this week settled" would be
     answerable for a good week and unanswerable for a quiet one. Markers carry
     no from/to and every calculation above skips them on the `amt > 0` guard,
     so they are inert to balances and to the flow. */
  /* A marker is a ZERO-AMOUNT event, not a kind of event. Keying it on `kind`
     alone was wrong in a way that cost real money: `settle` names both the
     dollars a week paid and the fact that the week was settled, so every
     settlement had its from/to nulled and credited nothing. The amount is what
     decides; the kind only says which zero-amount rows are legitimate. */
  const isMarker = !(amount > 0) && EV_MARKER_KINDS.indexOf(String(f.kind)) >= 0;
  if (!(amount > 0) && !isMarker) return null;
  const dayKey = f.dayKey || todayKey();
  const e = {
    id: f.id || mrNewId('ev-'),
    at: Number(f.at) || syncNow(),
    dayKey,
    weekKey: f.weekKey || (typeof ctWeekKeyForDate === 'function' ? ctWeekKeyForDate(dayKey) : null),
    kind: f.kind || 'move',
    from: isMarker ? null : String(f.from || 'earned'),
    to: isMarker ? null : String(f.to || 'cash'),
    amount,
    ref: f.ref || null,
    note: f.note || '',
    by: f.by || (typeof activeProfile === 'function' ? activeProfile() : null),
    updatedAt: syncNow(),
  };
  if (f.reverses) e.reverses = f.reverses;
  evEnsure(kid).push(e);
  return e;
}

/* Undo one movement without deleting it. The original stays readable — a child
   asking "what happened to my $21" deserves to see both the entry and its
   correction, and a history that silently loses its mistakes is not a history.
   Idempotent: an event already reversed cannot be reversed twice. */
function evReverse(kid, eventId, note) {
  const list = evEnsure(kid);
  const orig = list.find(e => e && e.id === eventId);
  if (!orig) return null;
  if (list.some(e => e && e.reverses === eventId)) return null;
  return evAdd(kid, {
    dayKey: todayKey(), kind: orig.kind, from: orig.to, to: orig.from,
    amount: orig.amount, ref: orig.ref, reverses: eventId,
    note: note || ('Correction — ' + (orig.note || orig.kind)),
  });
}

function evBalance(kid, home, asOf) { return evBalanceOf(evList(kid), home, asOf); }
function evWorth(kid, asOf) { return evWorthOf(evList(kid), asOf); }
function evFlow(kid, from, to) { return evFlowOf(evList(kid), from, to); }
function evMonths(kid, firstMonth, lastMonth) { return evMonthsOf(evList(kid), firstMonth, lastMonth); }
function evTypicalMonth(kid, firstMonth, lastMonth) {
  return evTypicalMonthOf(evList(kid), firstMonth, lastMonth);
}
function evSettledWeeks(kid) { return evSettledWeeksOf(evList(kid)); }
function evWeekIsSettled(kid, weekKey) { return !!evSettledWeeks(kid)[weekKey]; }

/* ── Shadow mode ───────────────────────────────────────────────────
   Stage 1 writes the stream BESIDE the old stores and changes nothing a screen
   reads. `evMirror` is what every existing writer calls; it is deliberately
   silent on failure, because a mirror that could break a real money write would
   be worse than no mirror at all. */
/* A holding CHANGED VALUE — interest credited, a share price moved, a parent
   correcting a number by hand. No cash moved, but what she has did change, so
   the stream has to carry it or the derived `ready`/`invest` balance falls
   behind the stored one a little more every day.

   A LOSS is money leaving the home, not a negative arrival: `evAdd` refuses a
   non-positive amount on purpose (a zero-dollar movement is not an event), so
   the direction carries the sign. That also makes a bad month in a company
   legible on the flow diagram as a ribbon going out, which is exactly the
   lesson holding one is meant to teach. */
function evMirrorValueChange(kid, kind, delta, opts) {
  const home = evHomeForHolding(kind);
  const d = money2(delta);
  if (!home || !d) return null;
  const base = Object.assign({ kind: 'interest', ref: null, note: '' }, opts || {});
  return evMirror(kid, Object.assign({}, base, d > 0
    ? { from: 'interest', to: home, amount: d }
    : { from: home, to: 'interest', amount: money2(-d) }));
}

function evMirror(kid, fields) {
  try {
    if (!kid) return null;
    return evAdd(kid, fields);
  } catch (err) {
    return null;                 // never let the shadow break the real write
  }
}

/* ── A settled week, broken out by where the money came from ───────
   The wallet was credited ONE lump — `ctWeekMoney`'s net — so a stream that
   recorded one lump would be honest and useless: "Jobs and routines" and
   "Competitions" would be the same ribbon, and the flow diagram could not
   answer the question it exists to answer.

   So the gross is split by channel and the fines come off as their own
   movement. The arithmetic is pinned to `net`, not to the rulebook: fines are
   floored at what the week earned (`mrWeekBreakdown`), so gross − net is what
   was ACTUALLY taken off, and the lines therefore always sum to the one number
   the wallet moved by. Deriving the fine from the rules instead would be a
   second opinion about a figure the wallet has already acted on — the exact
   two-answers-to-one-question defect this redesign is removing.

   A legacy week has no channel split to read, so it stays one `earned` line.
   That is not a loss: those are the weeks the old branch mispriced, and the
   migration re-prices them under their own rules. */
function evSettleLines(kid, weekKey, net, newModel) {
  const paid = money2(net);
  if (!(paid > 0)) return;
  const common = { kind: 'settle', dayKey: weekKey, weekKey, ref: weekKey };
  let b = null;
  if (newModel && typeof mrWeekBreakdown === 'function') {
    try { b = mrWeekBreakdown(weekKey, kid); } catch (err) { b = null; }
  }
  if (!b) {
    evMirror(kid, Object.assign({}, common, { from: 'earned', to: 'cash', amount: paid,
                                              note: 'Week of ' + weekKey }));
    return;
  }
  const work = money2(money2(b.chorePaid) + money2(b.learnPaid) + money2(b.streakBonus));
  const prize = money2(b.compPaid);
  const gross = money2(work + prize);
  if (work > 0) {
    evMirror(kid, Object.assign({}, common, { from: 'earned', to: 'cash', amount: work,
                                              note: 'Jobs and routines, week of ' + weekKey }));
  }
  if (prize > 0) {
    evMirror(kid, Object.assign({}, common, { from: 'prize', to: 'cash', amount: prize,
                                              note: 'Competitions, week of ' + weekKey }));
  }
  // What was actually taken off — never more than the week held.
  const taken = money2(gross - paid);
  if (taken > 0) {
    evMirror(kid, Object.assign({}, common, { kind: 'fine', from: 'cash', to: 'fine',
                                              amount: taken,
                                              note: 'Taken off, week of ' + weekKey }));
  }
  /* An override or a rounding difference between the breakdown and what the
     wallet moved by would otherwise leave the stream permanently out of step,
     and a silent cent is how a drift check stops meaning anything. Booked
     openly so `evShadowDrift` stays at zero and the row says what it is. */
  const slack = money2(paid - money2(gross - taken));
  if (slack !== 0) {
    evMirror(kid, Object.assign({}, common, slack > 0
      ? { from: 'earned', to: 'cash', amount: slack, note: 'Agreed at the meeting, week of ' + weekKey }
      : { kind: 'fine', from: 'cash', to: 'fine', amount: money2(-slack),
          note: 'Agreed at the meeting, week of ' + weekKey }));
  }
}

/* Where the stream and the old stores disagree, in dollars. Zero is the
   contract; the smoke check and tests/stream.test.js both assert it, and the
   old stores are not retired until it has been zero on real data. Returns a
   findings array rather than a boolean so a failure says WHICH home drifted —
   the house idiom, and the one the `|| break` and truthy-array bugs in
   CLAUDE.md both came from getting wrong. */
function evShadowDrift(kid) {
  const found = [];
  const pairs = [
    ['cash',   evBalance(kid, 'cash'),   mnyCash(kid)],
    ['ready',  evBalance(kid, 'ready'),  mnySavedTotal(kid)],
    ['locked', evBalance(kid, 'locked'), mnyLockedTotal(kid)],
    ['invest', evBalance(kid, 'invest'), mnyInvestedTotal(kid)],
  ];
  pairs.forEach(([home, stream, stored]) => {
    if (Math.abs(money2(stream) - money2(stored)) > 0.005) {
      found.push(`${home}: stream ${money2(stream)} vs stored ${money2(stored)}`);
    }
  });
  return found;
}

// Inert in the browser; lets tests/stream.test.js hold the pure core in Node.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EV_HOMES, EV_SOURCES, EV_SINKS, EV_MARKER_KINDS, EV_SOURCE_LABELS, EV_DEST_LABELS,
    EV_HOME_FOR_HOLDING, evHomeForHolding,
    evIsHome, evIsLoan, evIsSink, evDestKey,
    evSpanOf, evBalanceOf, evWorthOf, evFlowOf, evMonthsOf, evTypicalMonthOf,
    evSettledWeeksOf,
  };
}

/* ════════════════════════════════════════════════════════════════
   THE MIGRATION — history first, opening balance as the plug

   Shadow mode starts recording the day it ships, so without this the stream
   would know nothing about the months the family has already lived, and the
   flow diagram would open on an empty screen for a household with a year of
   real money behind it.

   Two halves, and the ORDER of them is the whole trick:

   1. Reconstruct what is on record — every settled week from the frozen
      `moneyLedger`, every gift from `deposits`, each dated to the day it
      actually happened.
   2. Compute the OPENING balance per home as
         stored balance − net effect of everything reconstructed
      and date it the day before the earliest reconstructed row.

   Doing it that way means the derived balance equals the stored balance by
   CONSTRUCTION, for every home, on any household, however incomplete its
   history — rather than by hoping the reconstruction happens to be complete.
   Whatever the old stores cannot account for lands in one honest line the
   child can read: "Already had". A migration that tried to be exhaustive and
   silently missed a path would leave a permanent drift nobody could explain.

   Read-only and idempotent. `evMigrationPlan` computes and writes NOTHING, so
   the preview a parent approves is literally what runs; every event carries a
   derived id, so a second run finds them already there and does nothing —
   which also makes it safe on two devices in any merge order.

   It does NOT re-price anything. Weeks the old legacy branch paid $0 for are
   repaired in Stage 2, under each week's own rules, with their own preview.
   ════════════════════════════════════════════════════════════════ */

/* A stable id per migrated row: same input, same id, on every device and every
   run. This is what makes the migration idempotent without a "have I run yet"
   flag — a flag would be one more stored fact that can disagree with reality. */
function evMigId(kid, parts) { return 'ev-mig-' + kid + '-' + parts.join('-'); }

/* The day before the earliest thing we know about — where the opening balance
   sits, so it never lands inside a month whose flow it would distort. */
function evDayBefore(dayKey) {
  const d = formatDayKey(dayKey);
  d.setDate(d.getDate() - 1);
  return ctDateToKey(d);
}

/* What the migration WOULD write, for one child. Pure with respect to state:
   it reads, it does not save. */
function evMigrationPlanFor(kid) {
  ctEnsureShared();
  const c = state.shared.chore;
  const have = {};
  evEnsure(kid).forEach(e => { if (e && e.id) have[e.id] = true; });
  const rows = [];
  const push = (id, f) => { if (!have[id]) rows.push(Object.assign({ id }, f)); };

  /* ── Settled weeks, from the frozen ledger ──
     The ledger is what was AGREED at the meeting, so it is the honest source
     for a past week — not a recomputation, which would read today's rules and
     restate history. Its `net` is what the wallet actually moved by, so the
     lines are pinned to it exactly as evSettleLines pins to the live figure. */
  const led = c.moneyLedger || {};
  Object.keys(led).sort().forEach(wk => {
    const r = (led[wk] || {})[kid];
    if (!r) return;
    const work = money2(money2(r.chores) + money2(r.learning) + money2(r.streak));
    const prize = money2(r.competition);
    const net = money2(r.net);
    if (work > 0) {
      push(evMigId(kid, [wk, 'work']), { kind: 'settle', from: 'earned', to: 'cash',
        amount: work, dayKey: wk, weekKey: wk, ref: wk,
        note: 'Jobs and routines, week of ' + wk });
    }
    if (prize > 0) {
      push(evMigId(kid, [wk, 'prize']), { kind: 'settle', from: 'prize', to: 'cash',
        amount: prize, dayKey: wk, weekKey: wk, ref: wk,
        note: 'Competitions, week of ' + wk });
    }
    const taken = money2(money2(work + prize) - net);
    if (taken > 0) {
      push(evMigId(kid, [wk, 'fine']), { kind: 'fine', from: 'cash', to: 'fine',
        amount: taken, dayKey: wk, weekKey: wk, ref: wk,
        note: 'Taken off, week of ' + wk });
    }
    // Where she decided it should go. `outside` is deliberately skipped — the
    // gifts below carry the same dollars with a date and a giver attached, and
    // counting both would double every birthday.
    const out = [
      ['ready',  money2(r.ready),  'ready',  'Kept ready'],
      ['gic',    money2(r.gic),    'locked', 'Locked away'],
      ['stock',  money2(r.stock),  'invest', 'Into companies'],
      ['spend',  money2(r.spend),  'spent',  'To spend'],
      ['loan',   money2(money2((r.loan || {}).paid) + money2(r.debtExtra)), 'loan:loan', 'Paid off'],
    ];
    out.forEach(([key, amt, to, label]) => {
      if (!(amt > 0)) return;
      push(evMigId(kid, [wk, key]), { kind: key === 'loan' ? 'loan' : key,
        from: 'cash', to, amount: amt, dayKey: wk, weekKey: wk, ref: wk,
        note: label + ', week of ' + wk });
    });
    // The fact of the settlement, so a $0 week is still answerable as settled.
    push(evMigId(kid, [wk, 'settled']), { kind: 'settle', amount: 0,
      dayKey: wk, weekKey: wk, ref: wk, note: 'Week of ' + wk + ' settled' });
  });

  /* ── Gifts, on the day they arrived ──
     Only the ones that actually reached the wallet. A gift a child proposed and
     nobody approved is not money, and putting it on the flow would show her a
     ribbon for something she has not been given. */
  (Array.isArray(getProfData(kid).deposits) ? getProfData(kid).deposits : []).forEach(d => {
    if (!d || !d.appliedAt || d.pendingApproval) return;
    const amt = money2(d.amount);
    if (!(amt > 0)) return;
    push(evMigId(kid, ['dep', d.id]), Object.assign(mnyGiftMirror(d), { amount: amt }));
  });

  /* ── The opening balance, as the plug ──
     Per home: what the app says she has, minus what the rows above account
     for. Everything the old stores could not explain lands here, in one line
     with an honest name, instead of as a drift nobody can see. */
  const netOf = (home) => {
    let n = 0;
    rows.forEach(r => {
      const amt = money2(r.amount);
      if (!(amt > 0)) return;
      if (r.to === home) n = money2(n + amt);
      if (r.from === home) n = money2(n - amt);
    });
    // Events already on the stream count too, or a second run would re-open.
    return money2(n + evBalanceOf(evEnsure(kid), home));
  };
  const stored = { cash: mnyCash(kid), ready: mnySavedTotal(kid),
                   locked: mnyLockedTotal(kid), invest: mnyInvestedTotal(kid) };
  const firstDay = rows.map(r => r.dayKey).sort()[0] || todayKey();
  const openDay = evDayBefore(firstDay);
  const opening = {};
  EV_HOMES.forEach(home => {
    const gap = money2(stored[home] - netOf(home));
    opening[home] = gap;
    if (!gap) return;
    /* A negative gap means the reconstruction credits more than she actually
       has — a week settled then spent through a path the old stores never
       recorded. It is still the truth, so it is written as money leaving,
       exactly as a holding losing value is. */
    push(evMigId(kid, ['open', home]), gap > 0
      ? { kind: 'open', from: 'opening', to: home, amount: gap, dayKey: openDay,
          note: 'What she already had' }
      : { kind: 'open', from: home, to: 'opening', amount: money2(-gap), dayKey: openDay,
          note: 'Already spent before the record began' });
  });

  return {
    kid, rows, opening, stored, openDay,
    weeks: Object.keys(led).filter(wk => (led[wk] || {})[kid]).length,
    gifts: rows.filter(r => r.kind === 'gift').length,
    alreadyDone: rows.length === 0,
  };
}

/* Both girls, one call — what the parent's preview card reads. */
function evMigrationPlan() {
  return ['jenn', 'jess'].map(evMigrationPlanFor);
}

/* Write it. Idempotent by construction: every row carries a derived id and
   `evMigrationPlanFor` omits the ones already on the stream, so running this
   twice — or on two devices that then sync — produces one copy of each. */
function evRunMigration() {
  if (!isParent()) { showToast('A grown-up sets this up 🔒'); return null; }
  const plans = evMigrationPlan();
  let written = 0;
  plans.forEach(plan => {
    plan.rows.forEach(r => { if (evAdd(plan.kid, r)) written++; });
  });
  if (written) saveAll();
  return { written, plans };
}

/* ════════════════════════════════════════════════════════════════
   THE REPAIR — weeks the retired branch mispriced

   Until Stage 2 there were two money models, and which one a week used was
   decided by a store that seeded itself to the current Monday. On any device
   running a new build that made EVERY week the family had lived a "legacy"
   week: graded chores and the routine streak paid nothing in all of them, a
   competition recorded in one of them never reached the wallet, and
   `finalizedWeeks[wk][kid] == null` then refused to ever credit it again.

   That is how a $21 meet came to sit in a week settled at $0 with no way to
   collect it, and how a child who kept every routine was paid $1.

   This finds those weeks and credits the DIFFERENCE, once.

   Four rules, each load-bearing:

   1. **Each week prices under ITS OWN rules.** `mrWeekBreakdown` resolves the
      effective-dated rule version for that week (`mrVersionForDate`), so a
      price edited last month cannot restate a week from March. Repairing is
      not the same as re-pricing under today's rulebook, and the difference is
      the whole reason a parent can agree to it.

   2. **It only ever ADDS.** A week the old branch happened to pay MORE for —
      a group payout under the $6 cap — keeps what it paid. Money already in a
      child's hand is hers; a correction that reached into her wallet would
      teach her the opposite of what this system is for.

   3. **A week frozen at the ORIGINAL migration is never touched.** Those
      predate the chore pool entirely, so there is nothing to re-price and
      `ctWeekIsPreSystem` says so.

   4. **Idempotent, by a derived id.** Two devices can each run it, then sync,
      and the week is repaired once.
   ════════════════════════════════════════════════════════════════ */

/* What one week is worth under its own rules, ignoring what was actually paid.
   Read-only. Returns null when the question does not apply. */
function evRepriceWeek(kid, weekKey) {
  if (typeof ctWeekIsPreSystem === 'function' && ctWeekIsPreSystem(weekKey, kid)) return null;
  if (typeof mrWeekBreakdown !== 'function') return null;
  try { return mrWeekBreakdown(weekKey, kid); } catch (err) { return null; }
}

/* Every settled week that was short-changed, for one child. Writes nothing. */
function evRepairPlanFor(kid) {
  ctEnsureShared();
  const c = state.shared.chore;
  const fin = c.finalizedWeeks || {};
  const have = {};
  evEnsure(kid).forEach(e => { if (e && e.id) have[e.id] = true; });

  const weeks = [];
  Object.keys(fin).sort().forEach(wk => {
    const credited = (fin[wk] || {})[kid];
    if (credited == null) return;                 // never settled — nothing to repair
    const id = evMigId(kid, [wk, 'repair']);
    if (have[id]) return;                         // already repaired
    const b = evRepriceWeek(kid, wk);
    if (!b) return;
    const should = money2(b.net);
    const was = money2(credited);
    const gap = money2(should - was);
    if (!(gap > 0)) return;                       // only ever adds — see rule 2
    weeks.push({
      wk, id, was, should, gap,
      // Named, so the preview can say WHY rather than just showing a number.
      why: [
        b.chorePaid > 0 ? `chores ${mnyMoney(b.chorePaid)}` : '',
        b.streakBonus > 0 ? `routines ${mnyMoney(b.streakBonus)} (${b.streak.days} clean days)` : '',
        b.compPaid > 0 ? `competitions ${mnyMoney(b.compPaid)}` : '',
        b.learnPaid > 0 ? `learning ${mnyMoney(b.learnPaid)}` : '',
      ].filter(Boolean).join(' · '),
    });
  });
  return { kid, weeks, total: money2(weeks.reduce((s, w) => s + w.gap, 0)) };
}

function evRepairPlan() { return ['jenn', 'jess'].map(evRepairPlanFor); }

/* Credit the difference. One event per week, carrying the derived id that makes
   a second run a no-op, and the frozen ledger is corrected alongside so the
   money story and `mrYearToDate` agree with the wallet rather than with the
   figure the retired branch produced. */
function evRunRepair() {
  if (!isParent()) { showToast('A grown-up settles the weeks 🔒'); return null; }
  ctEnsureShared();
  const c = state.shared.chore;
  const plans = evRepairPlan();
  let credited = 0, weeks = 0;
  plans.forEach(plan => {
    plan.weeks.forEach(w => {
      /* The wallet first, through the one writer that moves cash, so the stream
         line and the balance can never disagree about this. */
      moneyAddCash(plan.kid, w.gap, {
        kind: 'settle', from: 'earned', dayKey: w.wk, weekKey: w.wk, ref: w.wk,
        id: w.id, note: 'Week of ' + w.wk + ' — re-priced under its own rules',
      });
      c.finalizedWeeks[w.wk][plan.kid] = money2(w.should);
      /* The frozen ledger is a record of what was AGREED, so it is corrected
         rather than rebuilt: the week's own lines are re-read under its own
         rules, and the correction is stamped so the history says it happened
         instead of quietly reading as though it always had. */
      const led = ((c.moneyLedger || {})[w.wk] || {})[plan.kid];
      const b = evRepriceWeek(plan.kid, w.wk);
      if (led && b) {
        led.chores = money2(b.chorePaid);
        led.learning = money2(b.learnPaid);
        led.streak = money2(b.streakBonus);
        led.streakDays = b.streak.days || 0;
        led.competition = money2(b.compPaid);
        led.fines = money2(b.fines.total);
        led.gross = money2(money2(b.chorePaid) + money2(b.learnPaid)
                         + money2(b.streakBonus) + money2(b.compPaid));
        led.net = money2(b.net);
        led.repricedAt = syncNow();
        led.updatedAt = syncNow();
      }
      credited = money2(credited + w.gap);
      weeks++;
    });
  });
  if (weeks) saveAll();
  return { weeks, credited, plans };
}
