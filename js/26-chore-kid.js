// Weekly-Planner — the kid's chore tab (redesign 2a, "Kid" frame).
//
// One job: what do I do now, and what have I earned. No grading, no pool
// editing, no sight of her sister. Everything here writes a CLAIM — an answer,
// not a payment — which is why a kid can be handed this screen at all.
//
// Layout C from the design: the row is the tap target and the three quality
// words appear only on the chore she just tapped. A settled chore collapses to
// one quiet line, so a seven-chore day fits without scrolling past work that
// was finished days ago.

let ckView = 'day';        // 'day' | 'week'
let ckOpenChore = null;    // the one chore showing its quality words
let ckHistoryOpen = false;

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
function ckMoney(n) { return '$' + Number(n || 0).toFixed(Number(n) % 1 ? 2 : 0); }

/* The activity behind a block. The day view resolves this with a local closure
   over getAllActivities(); this is the same lookup, reachable from here. */
function ckActFor(block, kid) {
  if (!block) return null;
  return getAllActivities(kid).find(a => a.id === block.actId) || null;
}

/* Every tickable item in a routine, in the order the day view shows them:
   the template, then anything she added, then anything she unlocked. */
function ckRoutineItems(routineId) {
  const tmpl = (typeof getRoutineTemplate === 'function') ? getRoutineTemplate(routineId) : null;
  return [
    ...((tmpl && tmpl.items) || []),
    ...((typeof getKidExtras === 'function' ? getKidExtras(routineId) : []) || []),
    ...((typeof getUnlockedRoutineRewards === 'function' ? getUnlockedRoutineRewards(routineId) : []) || []),
  ];
}
/* The day's routine blocks, as the planner placed them. Nothing appears here
   that the planner did not put on the day — the same rule the chores follow. */
function ckRoutineBlocks(kid, dayIdx) {
  const dayKey = mrWeekDayKeys(ctWeekKey)[dayIdx];
  if (!dayKey) return [];
  return (getDayBlocks(dayKey, kid) || []).map(b => {
    const act = ckActFor(b, kid);
    if (!act || !act.isRoutine) return null;
    const items = ckRoutineItems(act.routineId);
    const st = b.checklistState || {};
    const done = items.filter(i => st[i.id]).length;
    return { block: b, act, items, done, total: items.length, dayKey };
  }).filter(Boolean);
}
function ckTrainingBlock(kid, dayIdx) {
  const dayKey = mrWeekDayKeys(ctWeekKey)[dayIdx];
  if (!dayKey) return null;
  const b = (getDayBlocks(dayKey, kid) || []).find(x => {
    const act = ckActFor(x, kid);
    return act && act.isTraining;
  });
  if (!b) return null;
  return { block: b, act: ckActFor(b, kid), dayKey };
}

/* ── The cap bar ───────────────────────────────────────────────────
   Fines first, because they come off before anything is banked. The black tick
   is the day's ceiling, and the blue tail past it is work that turned into XP
   instead of money. A dial was tried and lost: it cannot show what happens PAST
   the ceiling, and "almost full" reads as failure rather than a good day. */
function ckCapBar(kid, dayIdx) {
  const r = mrRulesForWeek(ctWeekKey);
  const cap = Number((r.chores || {}).dailyCap);
  const chores = mrChoreWeek(ctWeekKey, kid);
  const day = chores.days[dayIdx] || { paid: 0, raw: 0 };
  const fines = mrFinesWeek(ctWeekKey, kid, chores.days.map(d => d.paid));
  const fined = (fines.perDay[dayIdx] || {}).applied || 0;

  // Claimed but not yet graded — what today could still become.
  const e = mrEnsureEarnings(kid, ctWeekKey);
  const claims = e.claims[String(dayIdx)] || {};
  let pending = 0;
  Object.keys(claims).forEach(id => {
    if (mrGetChoreGrade(kid, ctWeekKey, dayIdx, id) > 0) return;
    pending += ckGradePay(r, claims[id]);
  });

  const kept = Math.max(0, day.paid - fined);
  const over = Math.max(0, day.raw - (cap || day.raw));   // past the ceiling → XP
  const span = Math.max(cap || 0, fined + kept + pending + over, 1);
  const pct = v => Math.max(0, Math.min(100, v / span * 100));

  const segs = [];
  if (fined)   segs.push({ w: pct(fined),   bg: '#e05a3c', title: `${ckMoney(fined)} in fines, taken first` });
  if (kept)    segs.push({ w: pct(kept),    bg: '#6fc292', title: `${ckMoney(kept)} kept` });
  if (pending) segs.push({ w: pct(pending), bg: 'repeating-linear-gradient(45deg,#ffd166 0 7px,#fff4db 7px 14px)', title: `${ckMoney(pending)} claimed, waiting` });
  if (over)    segs.push({ w: pct(over),    bg: '#6fb1fc', title: `${ckMoney(over)} turned into XP` });

  const keys = [];
  if (fined)   keys.push({ label: `−${ckMoney(fined)} fines, taken first`, bg: '#e05a3c', fg: '#fffdf5' });
  if (kept)    keys.push({ label: `${ckMoney(kept)} kept`, bg: '#6fc292', fg: '#143024' });
  if (pending) keys.push({ label: `${ckMoney(pending)} waiting`, bg: '#ffd166', fg: '#4a3a12' });
  if (over)    keys.push({ label: `${ckMoney(over)} → XP`, bg: '#6fb1fc', fg: '#10243d' });
  if (!keys.length) keys.push({ label: 'nothing yet today', bg: '#fffdf5', fg: '#6b5d4f' });

  // What the next fine would actually cost her — the exposure line.
  const fineAmt = Number((((r.fines || {}).items || [])[0] || {}).amount) || 1;
  const risk = kept > 0
    ? `One more fine today takes ${ckMoney(Math.min(fineAmt, kept))} back off what you've earned.`
    : 'Nothing banked yet today, so a fine costs nothing — a day never goes below $0.';
  const room = cap != null && !Number.isNaN(cap)
    ? `${ckMoney(Math.max(0, cap - day.paid))} of today's ${ckMoney(cap)} ceiling still open.`
    : '';
  return { segs, keys, risk, room, ceilPct: cap ? pct(cap) : 100, cap, day, pending, fined };
}

/* ── Header ── */
function ckHeader(kid) {
  const info = ctWeekInfo();
  const lv = mrXpLevelInfo(kid, ctWeekKey);
  const st = mrStreakWeek(ctWeekKey, kid);
  const label = `${MONTH_SHORT[info.mon.getMonth()]} ${info.mon.getDate()} – ${MONTH_SHORT[info.sun.getMonth()]} ${info.sun.getDate()}`;
  const isThisWeek = ctWeekKey === ctDateToKey(ctMondayOf(new Date()));
  return `<div class="ck-head">
    <div class="ck-head-who">
      <span class="ck-head-icon">${CT_PROFILE_ICON[kid]}</span>
      <div>
        <div class="ck-head-name">${kid === 'jenn' ? 'Jenn' : 'Jess'}</div>
        <div class="ck-weeknav">
          <button type="button" class="ck-navbtn" data-ct-action="ck-week" data-delta="-1" aria-label="Previous week">‹</button>
          <span class="ck-weeklabel">${label}</span>
          <span class="ck-weeksub">${isThisWeek ? 'this week' : 'a week you already lived'}</span>
          <button type="button" class="ck-navbtn" data-ct-action="ck-week" data-delta="1" aria-label="Next week">›</button>
        </div>
      </div>
    </div>
    <div class="ck-chip">
      <span class="ck-chip-icon">🔥</span>
      <div><div class="ck-chip-big">${st.days}</div><div class="ck-chip-cap">day streak</div></div>
    </div>
    <div class="ck-chip">
      <div><div class="ck-chip-big">${lv.level}</div><div class="ck-chip-cap ck-blue">${escapeHtml(lv.tier)}</div></div>
      <div class="ck-xpwrap">
        <div class="ck-xpbar"><div class="ck-xpfill" style="width:${lv.pct}%"></div></div>
        <div class="ck-chip-cap">${lv.xp} XP</div>
      </div>
    </div>
  </div>`;
}

/* ── Control strip: which day, and the four dots that summarise it ── */
function ckControls(kid) {
  const info = ctWeekInfo();
  const todayD = formatDayKey(todayKey());
  let cells = '';
  for (let d = 0; d < 7; d++) {
    const date = new Date(info.mon); date.setDate(info.mon.getDate() + d);
    const isToday = Math.round((date - todayD) / 86400000) === 0;
    const sel = d === ctDay;
    // Three routine dots then one for a chore graded that day.
    let dots = CT_SESSIONS.map(s =>
      `<span class="ck-dot ${ctGetMandatory(ctWeekKey, d, s, kid) ? 'on' : ''}"></span>`).join('');
    const gradedToday = Object.keys(mrEnsureEarnings(kid, ctWeekKey).chores[String(d)] || {}).length > 0;
    dots += `<span class="ck-dot ${gradedToday ? 'chore' : ''}"></span>`;
    cells += `<button type="button" class="ck-day ${sel ? 'sel' : ''} ${isToday ? 'today' : ''}"
      data-ct-action="ck-day" data-day="${d}" aria-pressed="${sel}" title="Show ${CT_DAYS[d]}">
      <span class="ck-day-dow">${DAY_SHORT[d]}</span>
      <span class="ck-day-date">${date.getDate()}</span>
      <span class="ck-dots">${dots}</span></button>`;
  }
  return `<div class="ck-controls">
    <div class="ck-ctl-group">
      <span class="ck-ctl-cap">Looking at</span>
      <div class="ck-seg">
        <button type="button" class="ck-segbtn ${ckView === 'day' ? 'on' : ''}" data-ct-action="ck-view" data-view="day">Day</button>
        <button type="button" class="ck-segbtn ${ckView === 'week' ? 'on' : ''}" data-ct-action="ck-view" data-view="week">Week</button>
      </div>
    </div>
    <div class="ck-ctl-group ck-ctl-days">
      <div class="ck-ctl-caprow">
        <span class="ck-ctl-cap">Which day</span>
        <span class="ck-legend"><span class="ck-dot on"></span>morning · after school · evening<span class="ck-dot chore"></span>chore graded</span>
      </div>
      <div class="ck-daystrip">${cells}</div>
    </div>
    <div class="ck-ctl-group">
      <span class="ck-ctl-cap">Earlier</span>
      <button type="button" class="ck-btn ${ckHistoryOpen ? 'on' : ''}" data-ct-action="ck-history">Before</button>
    </div>
  </div>`;
}

/* ── What you've earned before ── */
function ckHistory(kid) {
  if (!ckHistoryOpen) return '';
  const cur = formatDayKey(ctWeekKey);
  let rows = '';
  for (let i = 1; i <= 8; i++) {
    const mon = new Date(cur); mon.setDate(cur.getDate() - i * 7);
    const wk = ctDateToKey(mon);
    const money = ctWeekMoney(wk, kid);
    const st = mrStreakWeek(wk, kid);
    rows += `<button type="button" class="ck-hist-row" data-ct-action="ck-history-pick" data-week="${escapeAttr(wk)}">
      <span class="ck-hist-label">${MONTH_SHORT[mon.getMonth()]} ${mon.getDate()}</span>
      <span class="ck-hist-detail">${st.days} clean day${st.days === 1 ? '' : 's'}</span>
      <span class="ck-hist-total">${ckMoney(money)}</span></button>`;
  }
  return `<div class="ck-card ck-history">
    <div class="ck-h2">What you've earned before</div>
    <div class="ck-sub">Tap a week to open it. Everything on this card changes to that week — the grades, the routines, all of it.</div>
    ${rows}</div>`;
}

/* ── Routines ── */
function ckRoutines(kid) {
  const blocks = ckRoutineBlocks(kid, ctDay);
  if (!blocks.length) {
    return `<div class="ck-sect"><div class="ck-h2">Your three routines</div>
      <div class="ck-empty">No routine on today's plan.</div></div>`;
  }
  const body = blocks.map(({ block, act, items, done, total }) => {
    const allOn = total > 0 && done >= total;
    const rows = items.map(i => {
      const on = !!(block.checklistState || {})[i.id];
      return `<button type="button" class="ck-item ${on ? 'on' : ''}"
        data-ct-action="ck-routine-item" data-block-id="${escapeAttr(block.id)}" data-item-id="${escapeAttr(i.id)}"
        role="checkbox" aria-checked="${on}">
        <span class="ck-check ${on ? 'on' : ''}">${on ? '✓' : ''}</span>
        <span class="ck-item-name">${escapeHtml(i.text || '')}</span></button>`;
    }).join('');
    return `<div class="ck-block">
      <div class="ck-block-head">
        <span class="ck-block-icon">${act.icon || '📋'}</span>
        <span class="ck-block-name">${escapeHtml(act.name || '')}</span>
        <span class="ck-spacer"></span>
        <button type="button" class="ck-allbtn" data-ct-action="ck-routine-all" data-block-id="${escapeAttr(block.id)}"
          title="Close every item in this block at once">
          <span class="ck-check ${allOn ? 'on' : ''}">${allOn ? '✓' : ''}</span>
          <span>${allOn ? 'all done' : 'all'}</span></button>
        <span class="ck-count">${done}/${total}</span>
      </div>
      <div class="ck-block-body">${rows}</div>
    </div>`;
  }).join('');
  return `<div class="ck-sect">
    <div class="ck-h2">Your three routines</div>
    <div class="ck-sub">Tap when it's done · all three closed = a clean day for the streak</div>
    ${body}</div>`;
}

/* ── Your own things, and helping out ──
   Standing responsibilities: they need no planner block, they are never paid,
   and only "nobody had to ask" earns XP. */
function ckOwnLanes(kid) {
  const day = mrChoresForDay(kid, ctWeekKey, ctDay);
  const r = mrRulesForWeek(ctWeekKey);
  const own = [
    ...(r.personalChores || []).map(c => ({ id: c.id, label: c.label, due: '' })),
    ...day.rows.filter(x => x.row.lane === 'own').map(x => ({ id: x.row.id, label: x.row.label, due: mrDueLabel(x.row) })),
  ];
  const helping = day.rows.filter(x => x.row.lane === 'helping')
    .map(x => ({ id: x.row.id, label: x.row.label, due: mrDueLabel(x.row) }));

  const lane = (label, note, items) => {
    if (!items.length) return '';
    const done = items.filter(i => mrGetPersonal(kid, ctWeekKey, ctDay, i.id)).length;
    const rows = items.map(i => {
      const st = mrGetPersonal(kid, ctWeekKey, ctDay, i.id);
      const mark = st === 'unasked' ? '⭐' : (st === 'done' ? '✓' : '');
      return `<button type="button" class="ck-item ${st ? 'on' : ''}"
        data-ct-action="cycle-personal" data-chore-id="${escapeAttr(i.id)}" aria-label="${escapeAttr(i.label)}">
        <span class="ck-check ${st ? 'on' : ''}">${mark}</span>
        <span class="ck-item-name">${escapeHtml(i.label)}${i.due ? `<span class="ck-item-due">by ${escapeHtml(i.due)}</span>` : ''}</span>
        <span class="ck-item-note">${st === 'unasked' ? 'nobody asked ⭐' : (st === 'done' ? 'done' : '')}</span></button>`;
    }).join('');
    return `<div class="ck-lane">
      <div class="ck-lane-head"><span class="ck-lane-name">${label}</span>
        <span class="ck-lane-note">${note}</span><span class="ck-spacer"></span>
        <span class="ck-count">${done}/${items.length}</span></div>
      <div class="ck-block-body">${rows}</div></div>`;
  };
  const lanes = lane('Your own things', 'your room, your kit', own)
              + lane('Helping out', 'nobody assigned it', helping);
  if (!lanes) return '';
  return `<div class="ck-sect">
    <div class="ck-h2">Looking after your own things</div>
    <div class="ck-sub">Tap when it's done. Tap twice if nobody had to ask — that's the XP.</div>
    <div class="ck-lanes">${lanes}</div></div>`;
}

/* ── The chores: layout C ──
   The row is the tap target. Only the chore she just tapped shows its three
   answers, and a settled chore is a single quiet line. */
function ckChores(kid) {
  const r = mrRulesForWeek(ctWeekKey);
  const day = mrChoresForDay(kid, ctWeekKey, ctDay);
  const rows = day.rows.filter(x => x.row.lane === 'chores');
  const wk = mrChoreWeek(ctWeekKey, kid);
  const freeIds = new Set(wk.freeUsed.filter(f => f.dayIdx === ctDay).map(f => f.choreId));
  const cap = (r.chores || {}).dailyCap;

  const head = `<div class="ck-h2row"><span class="ck-h2">${CT_DAYS[ctDay]}'s chores</span>
    <span class="ck-pill">up to ${ckMoney(cap)} a day</span></div>`;

  if (!rows.length) {
    return `<div class="ck-sect">${head}
      <div class="ck-empty">Nothing on today's plan. A chore only turns up here once it's been put on the day in the weekly planner — so today there is nothing to answer for.</div>
      ${day.unresolved.length ? `<div class="ck-warn">The planner asked for ${escapeHtml(day.unresolved.join(', '))}, which isn't in the chore list — tell a grown-up so it can count.</div>` : ''}
    </div>`;
  }

  const body = rows.map(({ row }) => {
    const grade = mrGetChoreGrade(kid, ctWeekKey, ctDay, row.id);
    const claim = mrGetClaim(kid, ctWeekKey, ctDay, row.id);
    const free = freeIds.has(row.id);
    const open = ckOpenChore === row.id && !grade;
    const due = mrDueLabel(row);

    let state = 'todo', mark = '', status = `by ${escapeHtml(due)}`, pay = '', payCls = '';
    if (grade > 0) {
      state = 'graded'; mark = '✓';
      const word = (CK_QUALITY.find(q => q.g === grade) || {}).word || '';
      status = `${escapeHtml(word.toLowerCase())} · Mom agreed`;
      pay = free ? 'free' : ckMoney(ckGradePay(r, grade));
      payCls = 'ck-green';
    } else if (claim > 0) {
      state = 'claimed'; mark = '✓';
      const word = (CK_QUALITY.find(q => q.g === claim) || {}).word || '';
      status = `you said ${escapeHtml(word.toLowerCase())} — waiting for Mom`;
      pay = ckMoney(ckGradePay(r, claim));
      payCls = 'ck-amber';
    } else if (open) {
      status = `by ${escapeHtml(due)} — say how it went`;
    }

    const quality = open ? `<div class="ck-quality">
      <div class="ck-quality-cap">How did it go?</div>
      <div class="ck-quality-row">${CK_QUALITY.map(q => `
        <button type="button" class="ck-qbtn ${claim === q.g ? 'on' : ''}"
          data-ct-action="ck-claim" data-chore-id="${escapeAttr(row.id)}" data-quality="${q.g}">
          <span class="ck-qword">${escapeHtml(q.word)}</span>
          <span class="ck-qpay">${ckMoney(ckGradePay(r, q.g))}</span></button>`).join('')}
      </div></div>` : '';

    return `<div class="ck-chore ck-chore-${state} ${open ? 'open' : ''}">
      <button type="button" class="ck-chore-row" data-ct-action="ck-chore-row" data-chore-id="${escapeAttr(row.id)}">
        <span class="ck-check ${state !== 'todo' ? 'on' : ''} ${state === 'claimed' ? 'ring' : ''}">${mark}</span>
        <span class="ck-chore-name">${escapeHtml(row.label)}
          <span class="ck-chore-status">${status}</span></span>
        <span class="ck-chore-pay ${payCls}">${pay}</span>
      </button>${quality}</div>`;
  }).join('');

  const free = wk.freeLeft > 0
    ? `${wk.freeLeft} free chore${wk.freeLeft === 1 ? '' : 's'} left this week — those belong to the family.`
    : `Your free chores are used up — everything else this week pays.`;
  return `<div class="ck-sect">${head}
    <div class="ck-sub">Tap the row, then say how it went. Mom checks it after.</div>
    ${body}
    <div class="ck-note">${free}</div>
    ${day.unresolved.length ? `<div class="ck-warn">The planner also asked for ${escapeHtml(day.unresolved.join(', '))}, which isn't in the chore list — tell a grown-up so it can count.</div>` : ''}
  </div>`;
}

/* ── Learning ── */
function ckLearning(kid) {
  const r = mrRulesForWeek(ctWeekKey);
  const items = (r.learning || {}).items || [];
  if (!items.length) return '';
  const rows = items.map(it => {
    const units = mrGetLearning(kid, ctWeekKey, ctDay, it.id);
    const worth = it.xpOnly ? 'XP only' : `${ckMoney(it.amount)} / ${it.perUnit} ${it.unit}`;
    return `<div class="ck-learn ${units > 0 ? 'on' : ''}">
      <span class="ck-learn-name">${escapeHtml(it.label)}<span class="ck-item-due">${escapeHtml(worth)}</span></span>
      <span class="ck-learn-count">${units} ${escapeHtml(it.unit)}</span>
      <span class="ck-learn-btns">
        <button type="button" class="ck-navbtn" data-ct-action="learn-minus" data-item-id="${escapeAttr(it.id)}" aria-label="Less ${escapeAttr(it.label)}">–</button>
        <button type="button" class="ck-navbtn" data-ct-action="learn-plus" data-item-id="${escapeAttr(it.id)}" aria-label="More ${escapeAttr(it.label)}">+</button>
      </span></div>`;
  }).join('');
  return `<div class="ck-sect"><div class="ck-h2">Learning you keep up</div>
    <div class="ck-sub">Only whole bundles pay. Sunday she picks ${(r.learning || {}).sundayCheckCount} at random and asks — anything you can't answer for goes back to unpaid.</div>
    ${rows}</div>`;
}

/* ── Training attitude: XP only, and only where training was planned ── */
function ckAttitude(kid) {
  const t = ckTrainingBlock(kid, ctDay);
  if (!t) return '';
  const a = mrGetAttitude(kid, ctWeekKey, ctDay);
  const btns = (who, val, live) => [1, 2, 3, 4, 5].map(n =>
    live
      ? `<button type="button" class="ck-rate ${val === n ? 'on' : ''}" data-ct-action="ck-attitude" data-day="${ctDay}" data-n="${n}">${n}</button>`
      : `<span class="ck-rate ${val === n ? 'on' : ''}">${n}</span>`).join('');
  const rated = a.self > 0 && a.parent > 0;
  const avg = rated ? Math.round((a.self + a.parent) / 2 * 10) / 10 : '—';
  const gap = rated
    ? (a.self === a.parent ? 'you two agreed' : `you said ${a.self > a.parent ? 'more' : 'less'} than Mom did`)
    : 'waiting on Mom';
  return `<div class="ck-sect ck-training">
    <div class="ck-h2row"><span class="ck-h2">🏊 Training attitude</span>
      <span class="ck-pill ck-pill-blue">XP only · no money</span></div>
    <div class="ck-sub">${escapeHtml(t.act.name || 'Training')} — this block only exists today because training was planned.</div>
    <div class="ck-rates">
      <div><div class="ck-ctl-cap">You rate yourself</div><div class="ck-raterow">${btns('self', a.self, true)}</div></div>
      <div><div class="ck-ctl-cap">Mom rated you</div><div class="ck-raterow">${btns('parent', a.parent, false)}</div></div>
      <div class="ck-ratebox"><div class="ck-chip-big">${avg}<span class="ck-of">/5</span></div>
        <div class="ck-chip-cap">${escapeHtml(gap)}</div></div>
    </div></div>`;
}

/* ── Open loops: something taken out and never put back ── */
function ckLoops(kid) {
  const boxed = mrBoxItems(kid).filter(b => !b.releasedAt);
  if (!boxed.length) return '';
  const rows = boxed.map(b => `<div class="ck-loop">
    <span class="ck-loop-name">${escapeHtml(b.label)}<span class="ck-item-due">back Sunday, or sooner for one unpaid job</span></span>
    <span class="ck-pill ${b.repeat ? 'ck-pill-red' : ''}">${b.repeat ? 'again this week · −$1' : 'in the box'}</span></div>`).join('');
  return `<div class="ck-sect"><div class="ck-h2">Open loops</div>
    <div class="ck-sub">Being in the box is the consequence — money only comes into it the second time the same thing happens in a week.</div>
    ${rows}</div>`;
}

/* ── The week, as a grid ──
   Same data, wider frame. A cell she can tap is a cell the planner scheduled;
   grey means it was never asked for, and a thing can't be judged on a day it
   was never planned for. */
function ckWeekGrid(kid) {
  const r = mrRulesForWeek(ctWeekKey);
  const info = ctWeekInfo();
  const scheduled = [];
  for (let d = 0; d < 7; d++) {
    const m = {};
    mrChoresForDay(kid, ctWeekKey, d).rows.forEach(x => { m[x.row.id] = x; });
    scheduled.push(m);
  }
  let head = '<div class="ck-grid-row ck-grid-head"><div></div>';
  for (let d = 0; d < 7; d++) {
    const date = new Date(info.mon); date.setDate(info.mon.getDate() + d);
    head += `<div class="ck-grid-dh">${DAY_SHORT[d]}<small>${date.getDate()}</small></div>`;
  }
  head += '<div class="ck-grid-dh">week</div></div>';

  const laneHtml = (label, rows) => {
    if (!rows.length) return '';
    return `<div class="ck-grid-lane"><div class="ck-grid-lanehead">${label}</div>`
      + rows.map(row => {
        let cells = '', wk = 0;
        for (let d = 0; d < 7; d++) cells += row.cell(d, () => wk++);
        return `<div class="ck-grid-row"><div class="ck-grid-label">${escapeHtml(row.name)}</div>${cells}<div class="ck-grid-total">${row.total()}</div></div>`;
      }).join('') + '</div>';
  };

  const routineRows = CT_SESSIONS.map(s => {
    let n = 0;
    for (let d = 0; d < 7; d++) if (ctGetMandatory(ctWeekKey, d, s, kid)) n++;
    return {
      name: s,
      cell: (d) => {
        const on = ctGetMandatory(ctWeekKey, d, s, kid);
        return `<div class="ck-cell ${on ? 'done' : ''}">${on ? '✓' : '·'}</div>`;
      },
      total: () => `${n}/7`,
    };
  });

  const poolChores = mrPoolRows(ctWeekKey).filter(p => p.lane === 'chores');
  const choreRows = poolChores.map(p => {
    let money = 0;
    for (let d = 0; d < 7; d++) {
      const g = mrGetChoreGrade(kid, ctWeekKey, d, p.id);
      if (g > 0) money += ckGradePay(r, g);
    }
    return {
      name: p.label,
      cell: (d) => {
        const here = scheduled[d][p.id];
        if (!here) return `<div class="ck-cell ck-cell-off" title="not on the plan that day"></div>`;
        const g = mrGetChoreGrade(kid, ctWeekKey, d, p.id);
        if (g > 0) return `<div class="ck-cell done" title="Mom graded it">${ckMoney(ckGradePay(r, g))}</div>`;
        const c = mrGetClaim(kid, ctWeekKey, d, p.id);
        if (c > 0) return `<button type="button" class="ck-cell claimed" title="you answered — not checked yet"
          data-ct-action="ck-week-cell" data-chore-id="${escapeAttr(p.id)}" data-day="${d}">?</button>`;
        return `<button type="button" class="ck-cell" title="tap to say how it went"
          data-ct-action="ck-week-cell" data-chore-id="${escapeAttr(p.id)}" data-day="${d}">·</button>`;
      },
      total: () => money ? ckMoney(money) : '—',
    };
  });

  return `<div class="ck-sect">
    <div class="ck-h2">The whole week</div>
    <div class="ck-sub">Same data, wider frame. Grey cells are days the planner did not schedule that thing — it can't be judged on a day it was never planned for.</div>
    <div class="ck-gridwrap"><div class="ck-grid">
      ${head}
      ${laneHtml('Routines · tracked, never paid', routineRows)}
      ${laneHtml('Chores · the only thing that pays', choreRows)}
    </div></div>
    <div class="ck-legend2">
      <span>✓ routine closed</span><span>$3 / $2 / $1 = chore checked</span>
      <span>? = you answered, not checked yet</span><span>grey = never on the plan</span>
    </div></div>`;
}

/* ── The earn board, pinned beside both views ── */
function ckRail(kid) {
  const b = mrWeekBreakdown(ctWeekKey, kid);
  const bar = ckCapBar(kid, ctDay);
  const lv = mrXpLevelInfo(kid, ctWeekKey);
  const xp = mrXpForWeek(ctWeekKey, kid);

  const ledger = [];
  if (b.chorePaid)      ledger.push({ name: 'Household chores', detail: `${CT_DAYS[ctDay]} and the rest of the week`, amount: ckMoney(b.chorePaid), fg: 'ck-green' });
  if (b.learnPaid)      ledger.push({ name: 'Learning', detail: 'whole bundles only', amount: ckMoney(b.learnPaid), fg: 'ck-green' });
  if (b.streakBonus)    ledger.push({ name: 'Streak', detail: `${b.streak.days} clean days`, amount: ckMoney(b.streakBonus), fg: 'ck-green' });
  if (b.compPaid)       ledger.push({ name: 'Competition', detail: 'from the results sheet', amount: ckMoney(b.compPaid), fg: 'ck-green' });
  if (b.fines.total)    ledger.push({ name: 'Fines', detail: 'taken before anything is banked', amount: '−' + ckMoney(b.fines.total), fg: 'ck-red' });
  if (!ledger.length)   ledger.push({ name: 'Nothing yet', detail: 'do a household chore to start', amount: ckMoney(0), fg: '' });

  // Scaled against her own best week, not a fixed ceiling — a bar chart whose
  // tallest bar is short says nothing about how the eight weeks compare.
  const mon0 = ctMondayOf(formatDayKey(ctWeekKey));
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(mon0); d.setDate(d.getDate() - i * 7);
    weeks.push({ d, money: ctWeekMoney(ctDateToKey(d), kid), now: i === 0 });
  }
  const peak = Math.max(1, ...weeks.map(w => w.money));
  const spark = weeks.map(w =>
    `<span class="ck-spark ${w.now ? 'now' : ''}" style="height:${Math.max(4, Math.round(w.money / peak * 40))}px"
      title="Week of ${MONTH_SHORT[w.d.getMonth()]} ${w.d.getDate()}: ${ckMoney(w.money)}"></span>`).join('');

  const privs = mrPrivileges(kid, ctWeekKey).map(p =>
    `<div class="ck-priv ${p.unlocked ? 'on' : ''}">
      <span class="ck-priv-name">${escapeHtml(p.label)}</span>
      <span class="ck-priv-state">${p.unlocked ? 'yours' : `level ${p.levelReq}`}</span></div>`).join('');

  return `<aside class="ck-rail">
    <div>
      <div class="ck-rail-cap">Your week</div>
      <div class="ck-rail-total">${ckMoney(b.net)}</div>
      <div class="ck-sub">kept after fines · a day never goes below $0</div>
    </div>
    <div class="ck-card">
      <div class="ck-rail-cap">${CT_DAYS[ctDay]} · ${ckMoney(bar.cap)} ceiling</div>
      <div class="ck-barwrap">
        <div class="ck-bar">${bar.segs.map(s => `<div class="ck-barseg" style="width:${s.w}%;background:${s.bg}" title="${escapeAttr(s.title)}"></div>`).join('')}</div>
        <span class="ck-ceil" style="left:${bar.ceilPct}%" title="the ${ckMoney(bar.cap)} ceiling"></span>
      </div>
      <div class="ck-keys">${bar.keys.map(k => `<span class="ck-key" style="background:${k.bg};color:${k.fg}">${escapeHtml(k.label)}</span>`).join('')}</div>
      <div class="ck-risk">${escapeHtml(bar.risk)}</div>
      <div class="ck-sub">${escapeHtml(bar.room)}</div>
    </div>
    <div class="ck-ledger">${ledger.map(l => `<div class="ck-ledger-row">
      <span class="ck-ledger-name">${escapeHtml(l.name)}<span class="ck-item-due">${escapeHtml(l.detail)}</span></span>
      <span class="ck-ledger-amt ${l.fg}">${l.amount}</span></div>`).join('')}</div>
    <div class="ck-card">
      <div class="ck-rail-cap">Your last 8 weeks</div>
      <div class="ck-sparkrow">${spark}</div>
    </div>
    <div class="ck-card ck-xpcard">
      <div class="ck-rail-cap ck-blue">XP — a separate currency</div>
      <div class="ck-xprow"><span class="ck-rail-total">${lv.xp}</span>
        <span class="ck-chip-cap">level ${lv.level} · ${escapeHtml(lv.tier)}</span></div>
      <div class="ck-sub ck-green">${xp.total} XP earned this week</div>
      <div class="ck-sub">XP and dollars do not convert into each other. Money is what the work was worth; XP is what the habit was worth.</div>
      <div class="ck-rail-cap ck-blue ck-privcap">What XP buys</div>
      ${privs}
    </div>
  </aside>`;
}

/* ── The tab ── */
function ckRenderKidTab(kid) {
  const main = ckView === 'day'
    ? `${ckRoutines(kid)}${ckOwnLanes(kid)}${ckChores(kid)}${ckLearning(kid)}${ckAttitude(kid)}${ckLoops(kid)}`
    : ckWeekGrid(kid);
  return `<div class="ck-tab">
    ${ckHeader(kid)}
    ${ckControls(kid)}
    ${ckHistory(kid)}
    <div class="ck-body">
      <div class="ck-main">${main}</div>
      ${ckRail(kid)}
    </div>
  </div>`;
}

/* ── Actions ──
   Every one of these writes a claim or a tick, never a grade. */
function ckSetView(v) { ckView = v === 'week' ? 'week' : 'day'; ckOpenChore = null; renderChoreTab(); }
function ckSelectDay(d) { ctDay = Math.max(0, Math.min(6, d)); ckOpenChore = null; renderChoreTab(); }
function ckToggleHistory() { ckHistoryOpen = !ckHistoryOpen; renderChoreTab(); }
function ckPickWeek(wk) { ctWeekKey = wk; ctDay = 0; ckHistoryOpen = false; ckOpenChore = null; renderChoreTab(); }

/* Tapping a settled row does nothing: a graded chore is Mom's answer, and this
   screen is not where it gets changed. */
function ckTapChoreRow(choreId) {
  const kid = ctActiveKid();
  if (mrGetChoreGrade(kid, ctWeekKey, ctDay, choreId) > 0) {
    showToast('Mom already checked this one ✓');
    return;
  }
  ckOpenChore = ckOpenChore === choreId ? null : choreId;
  renderChoreTab();
}
function ckClaim(choreId, quality) {
  const kid = ctActiveKid();
  const cur = mrGetClaim(kid, ctWeekKey, ctDay, choreId);
  const next = cur === quality ? 0 : quality;   // tapping the same word takes it back
  if (!mrSetClaim(kid, ctWeekKey, ctDay, choreId, next)) return;
  ckOpenChore = null;
  renderChoreTab();
  if (next) showToast('Said and sent — Mom checks it after ✓');
}
/* In the week grid one tap cycles the claim: nothing → on time → late → redo →
   nothing. Same cell, same day, same claim the day view writes. */
function ckCycleWeekClaim(choreId, dayIdx) {
  const kid = ctActiveKid();
  if (mrGetChoreGrade(kid, ctWeekKey, dayIdx, choreId) > 0) {
    showToast('Mom already checked this one ✓');
    return;
  }
  const order = [0, 3, 2, 1];
  const cur = mrGetClaim(kid, ctWeekKey, dayIdx, choreId);
  const next = order[(order.indexOf(cur) + 1) % order.length];
  if (mrSetClaim(kid, ctWeekKey, dayIdx, choreId, next)) renderChoreTab();
}
/* Routine ticks write to the planner block, exactly as the day view does, so
   the two screens can never disagree about the same morning. */
function ckToggleRoutineItem(blockId, itemId) {
  const kid = ctActiveKid();
  const dayKey = mrWeekDayKeys(ctWeekKey)[ctDay];
  const blocks = getDayBlocks(dayKey, kid);
  const b = blocks.find(x => x.id === blockId);
  if (!b) return;
  if (!b.checklistState) b.checklistState = {};
  b.checklistState[itemId] = !b.checklistState[itemId];
  setDayBlocks(dayKey, blocks, kid);
  ckAfterRoutineChange(b, dayKey, kid);
}
function ckCloseRoutine(blockId) {
  const kid = ctActiveKid();
  const dayKey = mrWeekDayKeys(ctWeekKey)[ctDay];
  const blocks = getDayBlocks(dayKey, kid);
  const b = blocks.find(x => x.id === blockId);
  if (!b) return;
  const act = ckActFor(b, kid);
  const items = ckRoutineItems(act && act.routineId);
  if (!b.checklistState) b.checklistState = {};
  const allOn = items.every(i => b.checklistState[i.id]);
  items.forEach(i => { b.checklistState[i.id] = !allOn; });
  setDayBlocks(dayKey, blocks, kid);
  ckAfterRoutineChange(b, dayKey, kid);
}
function ckAfterRoutineChange(b, dayKey, kid) {
  const act = ckActFor(b, kid);
  const items = ckRoutineItems(act && act.routineId);
  const done = items.filter(i => (b.checklistState || {})[i.id]).length;
  // Same award path the day view uses — sticky, and it pays no money.
  if (items.length && done >= items.length && act && act.routineId) {
    ctAwardMandatoryFromRoutine(act.routineId, kid, dayKey);
  }
  saveAll();
  renderChoreTab();
}
function ckRateSelf(dayIdx, n) {
  const kid = ctActiveKid();
  const cur = mrGetAttitude(kid, ctWeekKey, dayIdx).self;
  if (mrSetAttitude(kid, ctWeekKey, dayIdx, 'self', cur === n ? 0 : n)) renderChoreTab();
}
