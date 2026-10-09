// Weekly-Planner — a child's chore answers: the readers and writers Today,
// its catch-up card, the parent portal and the Week tab share.
//
// No grading, no pool editing. Everything here writes a CLAIM — an answer, not
// a payment — or a routine tick. This was the kid's chore tab (redesign 2a);
// the tab was retired in PR 2b once every row of docs/chore-relocation-map.md
// had its new home, and what is left is what those homes call.

/* The three answers, and what each is worth. She judges the work; the dollar
   follows. $0 is deliberately absent — "I didn't do it" isn't a claim, it's the
   absence of one, and only Mom can record a nought. */
const CK_QUALITY = [
  { g: 3, word: 'On time' },
  { g: 2, word: 'Late / after asking' },
  { g: 1, word: 'Had to redo it' },
];

function ckGradePay(rules, g) {
  return Number(((rules.chores || {}).grade || {})[g]) || 0;
}
/* Whole dollars read as "$3", parts as "$2.50". Non-finite input is floored to
   zero rather than rendered: "$NaN" on a kid's earnings is worse than a wrong
   zero, and it is always a bug upstream that this must not hide behind. */
function ckMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '$0';
  return '$' + v.toFixed(v % 1 ? 2 : 0);
}

/* The activity behind a block. The day view resolves this with a local closure
   over getAllActivities(); this is the same lookup, reachable from here. */
function ckActFor(block, kid) {
  if (!block) return null;
  return findActivity(block.actId, kid) || null;
}

/* Every tickable item in a routine, in the order the day view shows them:
   the template, then anything she added, then anything she unlocked. */
/* Delegates to the one owner (js/36-status.js). This was the CORRECT of the two
   copies — it counts by item id — but it still dropped the child, so keep the
   kid argument flowing. */
function ckRoutineItems(routineId, kid) {
  return routineItemsFor(routineId, kid || (typeof ctActiveKid === 'function' ? ctActiveKid() : undefined));
}
/* The same reader for a day named by its key. Today and its catch-up card ask
   about days this tab is not showing (R5 §5 C1), so the question takes the day
   rather than reading ctWeekKey/ctDay — one reader, two callers. */
function ckRoutineBlocksOn(kid, dayKey) {
  if (!dayKey) return [];
  return (getDayBlocks(dayKey, kid) || []).map(b => {
    const act = ckActFor(b, kid);
    if (!act || !act.isRoutine) return null;
    const items = ckRoutineItems(act.routineId, kid);
    const st = b.checklistState || {};
    const done = items.filter(i => st[i.id]).length;
    return { block: b, act, items, done, total: items.length, dayKey };
  }).filter(Boolean);
}
function ckTrainingBlockOn(kid, dayKey) {
  if (!dayKey) return null;
  const b = (getDayBlocks(dayKey, kid) || []).find(x => {
    const act = ckActFor(x, kid);
    return act && act.isTraining;
  });
  if (!b) return null;
  return { block: b, act: ckActFor(b, kid), dayKey };
}

/* ── Your own things, and helping out ──
   Standing responsibilities: they need no planner block, they are never paid,
   and only "nobody had to ask" earns XP. */
/* Which items the two lanes hold on a day — read by Today and by the portal's
   on-her-behalf card, so the two cannot list different things. */
function ckOwnLaneItems(kid, weekKey, dayIdx) {
  const day = mrChoresForDay(kid, weekKey, dayIdx);
  const r = mrRulesForWeek(weekKey);
  const own = [
    ...(r.personalChores || []).map(c => ({ id: c.id, icon: c.icon || '⭐', label: c.label, due: '' })),
    ...day.rows.filter(x => x.row.lane === 'own').map(x => ({ id: x.row.id, icon: x.row.icon, label: x.row.label, due: mrDueLabel(x.row) })),
  ];
  const helping = day.rows.filter(x => x.row.lane === 'helping')
    .map(x => ({ id: x.row.id, icon: x.row.icon, label: x.row.label, due: mrDueLabel(x.row) }));
  return { own, helping };
}

/* The same list for any day: Today's "＋ I did something else" and the
   catch-up card's, and the portal's on-her-behalf picker, read it too. */
function ckUnlistedChoresFor(kid, weekKey, dayIdx) {
  const onDay = new Set(mrChoresForDay(kid, weekKey, dayIdx).rows.map(x => x.row.id));
  return mrPoolRows(weekKey).filter(row =>
    row.lane === 'chores' && !onDay.has(row.id) && (row.who === 'both' || row.who === kid));
}

/* ── Open loops: something taken out and never put back ── */
/* What is in the box and not yet back, and the words for each — read by
   Today's Open loops card (R5 §5 C2, row 13). */
function ckOpenLoops(kid) {
  return mrBoxItems(kid).filter(b => !b.releasedAt);
}
function ckLoopState(b) {
  return b.repeat ? 'again this week · −$1' : 'in the box';
}

/* ── The week, as a grid ──
   Grey means the planner never asked for it, and a thing can't be judged on a
   day it was never planned for. What the grid shows, for a named kid and week —
   read by the Week tab's read-only report (R5 §5 C2, row 14; the Chores
   screen's grid read it too until PR 2b). Each cell carries its state (`na`
   not planned, `routine` kept or not, `off` not on the plan, `graded`,
   `claimed`, `open`), its glyph and its title. */
function ckWeekGridData(kid, weekKey) {
  const r = mrRulesForWeek(weekKey);
  const mon = formatDayKey(weekKey);
  const scheduled = [];
  for (let d = 0; d < 7; d++) {
    const m = {};
    mrChoresForDay(kid, weekKey, d).rows.forEach(x => { m[x.row.id] = x; });
    scheduled.push(m);
  }
  const head = [0, 1, 2, 3, 4, 5, 6].map(d => {
    const date = new Date(mon); date.setDate(mon.getDate() + d);
    return { dow: DAY_SHORT[d], date: date.getDate() };
  });

  /* A REPORT, so it drops a row no day asked for and counts each row out of the
     days that did. `n/7` measured a session against seven days that never
     wanted it, so a weekday-only routine read 5/7 forever and looked like
     failure. (The chore matrix keeps all three rows for the opposite reason:
     it is a FORM, and the row is the only door to recording a routine that
     happened on a day nobody planned it.) */
  const ckSessionsByDay = routineSessionsByDay(kid, weekKey);
  const routineRows = CT_SESSIONS.map(s => {
    const days = [0, 1, 2, 3, 4, 5, 6].filter(d => ckSessionsByDay[d].includes(s));
    let n = 0;
    days.forEach(d => { if (ctGetMandatory(weekKey, d, s, kid)) n++; });
    return { session: s, days, n };
  }).filter(x => x.days.length > 0).map(x => ({
    name: x.session,
    icon: CT_SESSION_ICONS[x.session] || '📋',
    cells: [0, 1, 2, 3, 4, 5, 6].map(d => {
      if (!x.days.includes(d)) return { state: 'na', text: '–', title: 'Not planned this day' };
      const on = ctGetMandatory(weekKey, d, x.session, kid);
      return { state: 'routine', on, text: on ? '✓' : '·', title: '' };
    }),
    total: `${x.n}/${x.days.length}`,
  }));

  const poolChores = mrPoolRows(weekKey).filter(p => p.lane === 'chores');
  const choreRows = poolChores.map(p => {
    let money = 0;
    for (let d = 0; d < 7; d++) {
      const g = mrGetChoreGrade(kid, weekKey, d, p.id);
      if (g > 0) money += ckGradePay(r, g);
    }
    return {
      name: p.label,
      icon: p.icon,
      cells: [0, 1, 2, 3, 4, 5, 6].map(d => {
        if (!scheduled[d][p.id]) return { state: 'off', text: '', title: 'not on the plan that day' };
        const g = mrGetChoreGrade(kid, weekKey, d, p.id);
        if (g > 0) return { state: 'graded', text: ckMoney(ckGradePay(r, g)), title: 'Mom graded it' };
        const c = mrGetClaim(kid, weekKey, d, p.id);
        if (c > 0) return { state: 'claimed', text: '?', title: 'you answered — not checked yet', choreId: p.id, day: d };
        return { state: 'open', text: '·', title: 'tap to say how it went', choreId: p.id, day: d };
      }),
      total: money ? ckMoney(money) : '—',
    };
  });

  return {
    head,
    lanes: [
      { label: 'Routines · tracked, never paid', rows: routineRows },
      { label: 'Chores · the only thing that pays', rows: choreRows },
    ].filter(l => l.rows.length),
  };
}

/* ── The claim prompt, shared ──
   A chore can be finished in three places: Today, the day timeline and the
   week planner. All three have to ask the same question and write the same
   record, or a chore ticked in one place never reaches Mom's queue from the
   others — which is exactly what used to happen when the planner wrote to the
   retired `optionalByWeek` store instead.

   Resolves the grade she claimed, or null if she backed out. */
function openChoreClaimPrompt(kid, weekKey, dayIdx, choreId, label) {
  const r = mrRulesForWeek(weekKey);
  const options = CK_QUALITY.map(q => ({
    id: String(q.g),
    label: q.word,
    sub: `${mnyMoney(ckGradePay(r, q.g))} · Mom checks it after`,
  }));
  return showChoice(`How did ${label || 'it'} go?`, options, { cancelLabel: 'Not done yet' })
    .then(id => {
      if (id == null) return null;
      const g = Number(id) || 0;
      if (!g) return null;
      mrSetClaim(kid, weekKey, dayIdx, choreId, g);
      saveAll();
      showToast('Said and sent — Mom checks it after ✓');
      return g;
    });
}

/* The writer behind it, for a named kid and day. Today and its catch-up card
   tick through this very function (R5 §5 C1), so the two are one write, not
   two copies that could drift. Returns
   whether anything was written; the caller repaints its own screen. */
function ckWriteRoutineItem(kid, dayKey, blockId, itemId) {
  const blocks = getDayBlocks(dayKey, kid);
  const b = blocks.find(x => x.id === blockId);
  if (!b) return false;
  if (!b.checklistState) b.checklistState = {};
  b.checklistState[itemId] = !b.checklistState[itemId];
  setDayBlocks(dayKey, blocks, kid);
  ckRoutineChanged(b, dayKey, kid);
  return true;
}
/* The writer behind the one-tap, for a named kid and day — Today's "all N
   done" and the catch-up card's call it (R5 §5 C1). Returns whether the day had
   a routine to write; the caller repaints. */
function ckWriteAllRoutines(kid, dayKey) {
  const blocks = getDayBlocks(dayKey, kid);
  const routines = ckRoutineBlocksOn(kid, dayKey);
  if (!routines.length) return false;
  const allOn = routines.every(r => r.total > 0 && r.done >= r.total);
  routines.forEach(({ block, items }) => {
    const b = blocks.find(x => x.id === block.id);
    if (!b) return;
    if (!b.checklistState) b.checklistState = {};
    items.forEach(i => { b.checklistState[i.id] = !allOn; });
  });
  setDayBlocks(dayKey, blocks, kid);
  routines.forEach(({ block }) => {
    const b = blocks.find(x => x.id === block.id);
    if (b) ckRoutineChanged(b, dayKey, kid);
  });
  return true;
}
/* What follows every routine write, wherever it was made. */
function ckRoutineChanged(b, dayKey, kid) {
  const act = ckActFor(b, kid);
  // The block's `completed` flag is a mirror of the checklist, never a second
  // opinion about it — so it is re-derived on every change, in both directions.
  syncRoutineCompletion(b, kid);
  // Same award path the day view uses, and it pays no money. It CLEARS as well
  // as sets now: unticking an item has to be able to take the day back, or no
  // screen can ever return to incomplete.
  if (act && act.routineId) ctSyncMandatoryFromRoutine(act.routineId, kid, dayKey, isRoutineCompleted(b, kid));
  saveAll();
}
/* Her own rating for a named kid, week and day: the same number again takes it
   back. Today, its catch-up card and the portal's on-her-behalf card rate
   through this (R5 §5 C1); mrSetAttitude stays the one writer and keeps its
   rule that a child rates only herself and never the parent's side. */
function ckRateSelfFor(kid, weekKey, dayIdx, n) {
  const cur = mrGetAttitude(kid, weekKey, dayIdx).self;
  return mrSetAttitude(kid, weekKey, dayIdx, 'self', cur === n ? 0 : n);
}
