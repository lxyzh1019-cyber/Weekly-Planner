// Weekly-Planner — the Sunday meeting's two money steps: what I earned, and
// what I do with it. Classic script, declarations only (MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   PAGES 2 AND 3 · THE SUNDAY MEETING

   These two are deliberately not screens a kid can open alone. They are the
   ten minutes on a Sunday when the week gets agreed and the money moves, with
   her in the room. That is why competition results and money from outside are
   entered HERE and not on a parent-only screen — the entering is the
   conversation.

   The order is fixed and it matters:

     Step 3  What I earned        agree the numbers          → a confirm stamp
     Step 4  What I do with it    decide where it goes       → the money moves

   CONFIRM IS NOT COMMIT. Confirming records that the family agrees the week is
   right; nothing moves. Because nothing has moved, changing a number afterwards
   costs nothing — the week simply reopens and step 4 re-locks. If confirming
   had moved money, every correction would need to be unwound, and the honest
   version of that is a system nobody dares correct.

   Step 4 opens with last week's plan already applied and priced. A normal week
   is: read the numbers, answer the question, done. Everything that lets her
   change the plan lives behind one button, because most weeks she will not
   want to, and a screen that asks eleven questions every Sunday is a screen
   that turns the meeting into a chore.
   ════════════════════════════════════════════════════════════════ */

let mnyMeetKid = 'jess';       // whose money the two steps are showing
let mnyEditOn = false;         // parent-edit steppers revealed
let mnyExpandRow = null;       // which channel's day-by-day working is open
let mnyCompOpen = false;       // the competition form
let mnyDepOpen = false;        // the money-from-outside form
let mnyCompDraft = null;
let mnyDepDraft = null;
let mnyPlanOpen = false;       // "change the plan" revealed
let mnyDraft = null;           // {planId, split, extra, extraTarget, reflect}
let mnyDoorAmt = null;         // the "if I put $X somewhere" amount
let mnyChecksOpen = false;

function mnyMeetingKid() { return (mnyMeetKid === 'jenn' || mnyMeetKid === 'jess') ? mnyMeetKid : 'jess'; }
function mnySetMeetKid(kid) {
  mnyMeetKid = kid;
  mnyExpandRow = null; mnyCompDraft = null; mnyDepDraft = null;
  mnyDraft = null; mnyDoorAmt = null;
  renderMeetingMode();
}

/* The tabs at the top of both steps. The meeting covers both kids in one
   sitting, so this is a switch, not a filter. */
function mnyKidTabs() {
  const cur = mnyMeetingKid();
  return `<div class="mny-chiprow">${['jenn', 'jess'].map(k =>
    `<button type="button" class="mny-chip ${k === cur ? 'on' : ''}" onclick="mnySetMeetKid('${escapeJsAttr(k)}')">${CT_PROFILE_ICON[k]} ${k === 'jenn' ? 'Jenn' : 'Jess'}</button>`).join('')}</div>`;
}

/* ── Money in → what has to go out → what is hers ──
   Three cells, and the one the current step is about is lit. Without it, "mine
   to choose" arrives as a number with no arithmetic behind it.

   FOUR callers now, deliberately one component: the kid's money page
   (js/22-money-page1.js, mnyIncomeCard), meeting step 3, meeting step 4, and
   the parent portal (js/24-money-parent.js, mnyWeekResults). A second thing
   that draws these three numbers is a second thing that can drift, and drift
   is the bug this was pulled in to fix.

   `liveIdx` is meeting-only — it lights the cell the current step is about.
   Pass -1 anywhere there is no "current step", and nothing lights. */
function mnyStrip(wk, kid, liveIdx) {
  const pool = mnyPool(wk, kid);
  const cells = [
    { label: 'Money that came in', value: pool.cameIn },
    { label: 'My loan payment', value: pool.mustPay },
    { label: 'Mine to choose', value: pool.mine },
  ];
  return `<div class="mny-strip">${cells.map((c, i) =>
    `<div class="mny-strip-cell${i === liveIdx ? ' on' : ''}">
       <div class="mny-label">${escapeHtml(c.label)}</div>
       <div class="mny-strip-val">${mnyMoney(c.value)}</div>
     </div>`).join('<span class="mny-strip-arrow">→</span>')}</div>`;
}

/* ════════════════════════════════════════════════════════════════
   STEP 3 · WHAT I EARNED
   ════════════════════════════════════════════════════════════════ */
function mnyRenderEarned(wk) {
  const kid = mnyMeetingKid();
  if (!mrUsesNewModel(wk)) return mmRenderConfirm(wk, false);
  mnySimCatchUp(kid);          // the world moves whether or not we met last week

  const confirmed = mnyIsConfirmed(wk, kid);
  return `${mnyPageHead('💪 What I earned', 'Agree the week before anything moves', [], { back: false })}
    ${mnyTabBar('grow')}
    ${mnyKidTabs()}
    ${mnyStrip(wk, kid, 0)}
    ${mmRenderQuarterly()}
    <div class="mny-cols two">
      <div class="mny-col">${mnyEarningsCard(wk, kid)}${mnyIncomeBarCard(wk, kid)}</div>
      <div class="mny-col">${mnyCompetitionForm(wk, kid)}${mnyDepositForm(wk, kid)}</div>
    </div>
    ${mnyConfirmBar(wk, kid)}
    ${confirmed ? mnyReturnsCard(kid) : mnyReturnsLocked()}`;
}

/* The week, channel by channel. Each row carries where its number came from —
   the planner, or a grown-up who changed it — because "it says $15" is not the
   same claim as "Mom made it $15", and a kid is entitled to know which. */
function mnyEarningsCard(wk, kid) {
  const b = mrWeekBreakdown(wk, kid);
  const missing = mnyMissing(kid, wk);
  const values = { chores: b.chorePaid, learning: b.learnPaid, streak: b.streakBonus,
                   comp: b.compPaid, fines: b.fines.total };

  const rows = MNY_CHANNELS.map(ch => {
    const ov = b.overrides[ch.key];
    const value = money2(values[ch.key]);
    const isMissing = missing.indexOf(ch.key) >= 0;
    const chip = isMissing
      ? `<span class="mny-src amber">Not counted yet</span>`
      : (ov ? `<span class="mny-src edited">Changed by a grown-up</span>`
            : `<span class="mny-src">From the planner</span>`);
    const struck = ov
      ? `<s class="mny-was">${mnyMoney(b.original[ch.key])}</s> ` : '';
    const steppers = mnyEditOn
      ? `<span class="mny-stepgrp">
           <button type="button" class="mny-step" onclick="mnyBumpChannel('${escapeJsAttr(ch.key)}',-0.5)" aria-label="Less">−</button>
           <button type="button" class="mny-step" onclick="mnyBumpChannel('${escapeJsAttr(ch.key)}',0.5)" aria-label="More">+</button>
           ${ov ? `<button type="button" class="mny-step" onclick="mnyResetChannel('${escapeJsAttr(ch.key)}')" aria-label="Back to the planner's number">↺</button>` : ''}
           <button type="button" class="mny-step${isMissing ? ' on' : ''}" onclick="mnyFlagMissing('${escapeJsAttr(ch.key)}')" aria-label="Nothing this week">∅</button>
         </span>` : '';
    // Only show a minus when something was actually taken off: "−$0.00" reads
    // as a penalty on a week that had none.
    const shown = (ch.key === 'fines' && value > 0)
      ? '−' + mnyMoney(value).slice(1) : mnyMoney(value);
    return `<div class="mny-erow">
        <button type="button" class="mny-erow-label" onclick="mnyToggleRow('${escapeJsAttr(ch.key)}')" aria-expanded="${mnyExpandRow === ch.key}">
          ${ch.icon} ${escapeHtml(ch.label)} <span class="mny-mag">🔍</span>
        </button>
        <div class="mny-erow-right">${chip}<b>${struck}${shown}</b>${steppers}</div>
        ${mnyExpandRow === ch.key ? `<div class="mny-working">${mnyWorking(wk, kid, ch.key, b)}</div>` : ''}
      </div>`;
  }).join('');

  const reason = mnyWeekReason(kid, wk);
  const reasonRow = mnyAnyEdited(kid, wk)
    ? `<div class="mny-note">Why: ${MNY_REASONS.map(r =>
        `<button type="button" class="mny-chip ${reason === r.id ? 'on' : ''}" onclick="mnyPickReason('${escapeJsAttr(r.id)}')">${escapeHtml(r.label)}</button>`).join(' ')}</div>`
    : '';

  return `<div class="mny-card">
      <div class="mny-week-head">
        <span class="mny-label">What ${kid === 'jenn' ? 'Jenn' : 'Jess'} earned this week</span>
        <button type="button" class="mny-chip ${mnyEditOn ? 'on' : ''}" onclick="mnyToggleEdit()">✏️ Change a number</button>
      </div>
      ${rows}
      <div class="mny-row total"><span>Earned for her work</span><b>${mnyMoney(b.net)}</b></div>
      ${reasonRow}
    </div>`;
}

/* The bar lives in its own card rather than under the earnings rows, because it
   counts money from outside as well: sitting it directly beneath "earned for
   her work" made two different totals look like one disagreeing with itself.

   It carries no total of its own. Step 3 already shows mnyStrip directly above
   it, and the strip's first cell is pool.cameIn — a different number from this
   bar's sum, because the bar counts fines separately and includes holding
   growth. Printing both, side by side, labelled as if they were the same thing,
   is precisely the disagreement the comment above was written about. The
   legend under the bar still names every segment in dollars. */
function mnyIncomeBarCard(wk, kid) {
  const data = mnyIncomeSegments(wk, kid);
  return `<div class="mny-card">
      <div class="mny-week-head">
        <span class="mny-label">Where this week's money came from</span>
      </div>
      ${mnyBarHtml(data, { empty: 'Nothing counted yet' })}
    </div>`;
}

/* Tapping a row opens the working behind it — the six days, the bundles, the
   run of clean days, the date of each fine. An amount nobody can take apart is
   an amount nobody can argue with, and this whole system runs on her being
   able to argue with it. */
function mnyWorking(wk, kid, channel, b) {
  const line = (l, v) => `<div class="mny-row"><span>${escapeHtml(l)}</span><b>${v}</b></div>`;
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  if (channel === 'chores') {
    const c = b.chores;
    return c.days.map(d => line(dayNames[d.dayIdx], mnyMoney(d.paid))).join('')
      + (c.freeUsed.length ? `<div class="mny-note">${c.freeUsed.length} free job${c.freeUsed.length > 1 ? 's' : ''} used — always your lowest-paying ones.</div>` : '')
      + (c.overflowChores ? `<div class="mny-note">${c.overflowChores} job${c.overflowChores > 1 ? 's' : ''} past your daily most — those earned XP.</div>` : '');
  }
  if (channel === 'learning') {
    return b.learning.lines.map(l => line(
      l.label + (l.voided ? ' (' + l.voided + ' did not count)' : ''),
      l.xp ? l.xp + ' XP' : mnyMoney(l.amount))).join('')
      || `<div class="mny-note">Nothing counted this week.</div>`;
  }
  if (channel === 'streak') {
    return line('Longest run of days with all three routines kept', b.streak.days + ' days')
      + (b.streak.tier ? line('That pays the ' + b.streak.tier + '-day step', mnyMoney(b.streak.bonus))
                       : `<div class="mny-note">Three days in a row with morning, afternoon and evening all closed is the first step.</div>`);
  }
  if (channel === 'comp') {
    const entries = mrCompetitions(kid).filter(c => String(c.dayKey) >= wk && String(c.dayKey) <= mnyWeekEnd(wk));
    return entries.length
      ? entries.map(c => line(mnySportIcon(c.sport) + ' ' + (c.name || mnySportLabel(c.sport)) + ' · ' + mnyShortDate(c.dayKey), mnyMoney(c.awarded))).join('')
      : `<div class="mny-note">No competition days this week.</div>`;
  }
  if (channel === 'fines') {
    const rows = b.fines.perDay.filter(d => d.raw > 0);
    return rows.length
      ? rows.map(d => line(dayNames[d.dayIdx], '−' + mnyMoney(d.applied).slice(1) +
          (d.applied < d.raw ? ' (a day never goes below $0)' : ''))).join('')
      : `<div class="mny-note">Nothing taken off this week.</div>`;
  }
  return '';
}
function mnyWeekEnd(wk) {
  const d = formatDayKey(wk); d.setDate(d.getDate() + 6);
  return ctDateToKey(d);
}

/* ── Competition day ──
   Entered here, at the table, with the results sheet in hand. The rules engine
   already knows what a result is worth (mrScoreCompetition), so this form only
   has to collect it honestly. */
function mnyCompetitionForm(wk, kid) {
  const entries = mrCompetitions(kid).filter(c => String(c.dayKey) >= wk && String(c.dayKey) <= mnyWeekEnd(wk));
  if (!mnyCompOpen) {
    return `<div class="mny-card">
        <div class="mny-week-head">
          <span class="mny-label">🏆 Competition day</span>
          <button type="button" class="mny-chip" onclick="mnyToggleComp()">${entries.length ? 'Add another' : 'Add one'}</button>
        </div>
        ${entries.length
          ? entries.map(c => `<div class="mny-row"><span>${mnySportIcon(c.sport)} ${escapeHtml(c.name || mnySportLabel(c.sport))} · ${mnyShortDate(c.dayKey)}</span>
              <b>${mnyMoney(c.awarded)}</b>
              <button type="button" class="mny-step" onclick="mnyDeleteComp('${escapeJsAttr(c.id)}')" aria-label="Remove">✕</button></div>`).join('')
          : `<div class="mny-note">No competition this week.</div>`}
      </div>`;
  }
  const d = mnyCompDraft || (mnyCompDraft = { sport: 'swim', dayKey: todayKey(), name: '',
    points: 0, qualified: false, provincial: false, group: 0, overall: 0, silver: 0, gold: 0, allGold: false });
  const preview = mrScoreCompetition({
    sport: d.sport, dayKey: d.dayKey, points: d.points, qualified: d.qualified, provincial: d.provincial,
    placement: { group: d.group || undefined, overall: d.overall || undefined },
    danceItems: { silver: d.silver, gold: d.gold, allGold: d.allGold },
  }, mrRulesFor(d.dayKey));

  const sportChips = [['swim', '🏊 Swim'], ['skate', '⛸️ Skating'], ['dance', '💃 Dance']].map(([id, label]) =>
    `<button type="button" class="mny-chip ${d.sport === id ? 'on' : ''}" onclick="mnyCompSet('sport','${escapeJsAttr(id)}')">${label}</button>`).join('');

  let detail = '';
  if (d.sport === 'swim') {
    detail = `<div class="mny-chiprow">
        <button type="button" class="mny-chip ${d.qualified ? 'on' : ''}" onclick="mnyCompSet('qualified',${!d.qualified})">Qualified for Provincials</button>
        <button type="button" class="mny-chip ${d.provincial ? 'on' : ''}" onclick="mnyCompSet('provincial',${!d.provincial})">This was Provincials</button>
      </div>`;
  } else if (d.sport === 'skate') {
    detail = `<div class="mny-label">In her group</div><div class="mny-chiprow">
        ${[0, 1, 2, 3].map(n => `<button type="button" class="mny-chip ${d.group === n ? 'on' : ''}" onclick="mnyCompSet('group',${n})">${n === 0 ? '—' : n + (['st','nd','rd'][n - 1])}</button>`).join('')}
      </div>
      <div class="mny-label">Overall</div><div class="mny-chiprow">
        ${[0, 1, 2, 3].map(n => `<button type="button" class="mny-chip ${d.overall === n ? 'on' : ''}" onclick="mnyCompSet('overall',${n})">${n === 0 ? '—' : n + (['st','nd','rd'][n - 1])}</button>`).join('')}
      </div>
      <div class="mny-note">Both of these count. First in her group <b>and</b> first overall pays for both.</div>`;
  } else {
    detail = `<div class="mny-row"><span>Silver items</span>${mnyStepper('silver', d.silver, 'comp')}</div>
      <div class="mny-row"><span>Gold items</span>${mnyStepper('gold', d.gold, 'comp')}</div>
      <div class="mny-chiprow"><button type="button" class="mny-chip ${d.allGold ? 'on' : ''}" onclick="mnyCompSet('allGold',${!d.allGold})">Every item was Gold</button></div>`;
  }

  return `<div class="mny-card">
      <div class="mny-label">🏆 Competition day</div>
      <div class="mny-chiprow">${sportChips}</div>
      <label class="mny-field"><span>What it was called</span>
        <input type="text" data-mm-field="comp-name" value="${escapeAttr(d.name)}"
          oninput="mnyCompSetQuiet('name', this.value)" placeholder="Winter Invitational"></label>
      <label class="mny-field"><span>Which day</span>
        <input type="date" data-mm-field="comp-day" value="${escapeAttr(d.dayKey)}"
          onchange="mnyCompSet('dayKey', this.value)"></label>
      ${d.sport !== 'dance' ? `<div class="mny-row"><span>Points</span>${mnyStepper('points', d.points, 'comp')}</div>` : ''}
      ${detail}
      <div class="mny-row total"><span>That comes to</span><b>${mnyMoney(preview)}</b></div>
      <div class="mny-chiprow">
        <button type="button" class="mny-btn primary" onclick="mnySaveComp()">Save it</button>
        <button type="button" class="mny-btn" onclick="mnyToggleComp()">Cancel</button>
      </div>
      <div class="mny-note">The official results sheet decides — not Mom, not Dad, not you.</div>
    </div>`;
}

/* ── Money from outside ──
   Birthday money, a gift, something sold. It is hers, but where it lands is
   still a decision, so the destinations are gated by the same lessons as
   everything else. */
function mnyDepositForm(wk, kid) {
  const saved = mnyDepositsForWeek(kid, wk);
  if (!mnyDepOpen) {
    return `<div class="mny-card">
        <div class="mny-week-head">
          <span class="mny-label">🎁 Money from outside</span>
          <button type="button" class="mny-chip" onclick="mnyToggleDep()">${saved.length ? 'Add another' : 'Add some'}</button>
        </div>
        ${saved.length
          ? saved.map(s => `<div class="mny-row"><span>🎁 ${escapeHtml(s.from)}</span>
              <b>${mnyMoney(s.amount)}</b>
              <button type="button" class="mny-step" onclick="mnyDeleteDep('${escapeJsAttr(s.id)}')" aria-label="Remove">✕</button></div>`).join('')
          : `<div class="mny-note">Nothing from outside this week.</div>`}
        ${saved.length ? `<div class="mny-note">One-offs stay one-offs — this does not change what any week pays.</div>` : ''}
      </div>`;
  }
  const d = mnyDepDraft || (mnyDepDraft = { amount: 20, from: MNY_FROM[0] });
  return `<div class="mny-card">
      <div class="mny-label">🎁 Money from outside</div>
      <div class="mny-row"><span>How much</span>${mnyStepper('amount', d.amount, 'dep', 5)}</div>
      <div class="mny-chiprow">${MNY_DEPOSIT_CHIPS.map(v =>
        `<button type="button" class="mny-chip ${d.amount === v ? 'on' : ''}" onclick="mnyDepSet('amount',${v})">$${v}</button>`).join('')}</div>
      <div class="mny-label">Where it came from</div>
      <div class="mny-chiprow">${MNY_FROM.map(f =>
        `<button type="button" class="mny-chip ${d.from === f ? 'on' : ''}" onclick="mnyDepSet('from','${escapeJsAttr(f)}')">${escapeHtml(f)}</button>`).join('')}</div>
      <div class="mny-note">This goes into the same pile as everything else you earned. You decide where all of it goes on the next step.</div>
      <div class="mny-chiprow">
        <button type="button" class="mny-btn primary" onclick="mnySaveDep()">Save it</button>
        <button type="button" class="mny-btn" onclick="mnyToggleDep()">Cancel</button>
      </div>
    </div>`;
}

/* The confirm bar. Total on the left, what is in the way in the middle, the
   button on the right — and the button says what is missing rather than just
   refusing. */
function mnyConfirmBar(wk, kid) {
  const b = mrWeekBreakdown(wk, kid);
  const missing = mnyMissing(kid, wk);
  const stamp = mnyConfirmStamp(wk, kid);
  const confirmed = mnyIsConfirmed(wk, kid);
  const committed = mnyIsCommitted(wk, kid);
  const needsReason = mnyAnyEdited(kid, wk) && !mnyWeekReason(kid, wk);
  const blocked = missing.length ? `${missing.length} thing${missing.length > 1 ? 's are' : ' is'} not counted yet`
                : (needsReason ? 'Pick why a number was changed' : '');

  let button;
  if (committed) {
    button = `<span class="mny-src">The money has already moved</span>`;
  } else if (blocked) {
    button = `<button type="button" class="mny-btn" disabled>${escapeHtml(blocked)}</button>`;
  } else if (confirmed) {
    button = `<button type="button" class="mny-btn" onclick="mmGoStep(4)">Next — what to do with it ▶</button>`;
  } else {
    button = `<button type="button" class="mny-btn primary" onclick="mnyDoConfirm()">That's right — save it</button>`;
  }
  return `<div class="mny-confirmbar">
      <span><b>${mnyMoney(b.net)}</b> for the week</span>
      <span class="mny-note">${escapeHtml(blocked || stamp)}</span>
      ${button}
    </div>`;
}

function mnyReturnsLocked() {
  return `<div class="mny-card locked">
      <div class="mny-label">What my money earned</div>
      <div class="mny-note">🔒 This opens once you have agreed the week above.</div>
    </div>`;
}
/* The other half of the lesson: the money that arrived without her doing any
   work for it. Separated from earnings on purpose — a nine-year-old should be
   able to see that these are two different kinds of money. */
function mnyReturnsCard(kid) {
  const r = mnyReturns(kid);
  if (!r.rows.length) {
    return `<div class="mny-card">
        <div class="mny-label">What my money earned</div>
        <div class="mny-note">Nothing yet — this fills in once you have money kept ready, locked away, or in a company.</div>
      </div>`;
  }
  return `<div class="mny-card">
      <div class="mny-label">What my money earned</div>
      <div class="mny-total sm">${mnySigned(r.gain)}</div>
      <div class="mny-note">Everything above this you worked for. This part arrived on its own. ${mnyAskBtn('save')}</div>
      <div class="mny-rows">
        ${r.rows.map(row => `<div class="mny-row">
            <span>${row.icon} ${escapeHtml(row.name)}${row.maturesOn ? ' · unlocks ' + mnyShortDate(row.maturesOn) : ''}</span>
            <b>${mnyMoney(row.value)} ${row.gain ? `<small>${mnySigned(row.gain)}${row.onPaper ? ' on paper' : ''}</small>` : ''}</b>
          </div>`).join('')}
        ${r.yearAhead > 0 ? `<div class="mny-row total"><span>If nothing changes, in a year</span><b>${mnySigned(r.yearAhead)}</b></div>` : ''}
      </div>
      ${r.rows.some(x => x.onPaper)
        ? `<div class="mny-note">The company part is <b>on paper</b> — it is not yours until you sell it, and it can go down.</div>` : ''}
    </div>`;
}

/* ════════════════════════════════════════════════════════════════
   STEP 4 · WHAT I DO WITH IT
   ════════════════════════════════════════════════════════════════ */
function mnyRenderDecide(wk) {
  const kid = mnyMeetingKid();
  mnySimCatchUp(kid);
  if (!mrUsesNewModel(wk)) {
    return `<div class="mm-h">🤝 What I do with it</div>
      <div class="ct-meta">This week was earned under the old group model, which paid as the chores were done. There is nothing to decide.</div>`;
  }
  const head = `${mnyPageHead('🤝 What I do with it', 'Decide once, for every dollar', [], { back: false })}
    ${mnyTabBar('where')}${mnyKidTabs()}`;

  // The gate covers the WHOLE step, not one column: deciding what to do with a
  // number nobody has agreed to is not a decision, it is a guess.
  if (!mnyIsConfirmed(wk, kid)) {
    return `${head}
      <div class="mny-card locked">
        <div class="mny-label">Not yet</div>
        <div class="mny-note">🔒 ${escapeHtml(mnyConfirmStamp(wk, kid) || 'Agree the week on the step before this one first.')}</div>
        <button type="button" class="mny-btn wide" onclick="mmGoStep(3)">◀ Back to what she earned</button>
      </div>`;
  }
  if (mnyIsCommitted(wk, kid)) return `${head}${mnyCommittedCard(wk, kid)}`;

  const draft = mnyEnsureDraft(wk, kid);
  const pool = mnyPool(wk, kid);
  return `${head}
    ${mnyStrip(wk, kid, 2)}
    <div class="mny-cols two">
      <div class="mny-col">
        ${mnyPoolCard(wk, kid, pool)}
        ${mnyPlanCard(wk, kid, draft, pool)}
      </div>
      <div class="mny-col">
        ${mnyPlanOpen ? mnyChangePlanCards(wk, kid, draft, pool) : ''}
        ${mnyReflectCard(draft)}
        ${mnyCommitBar(wk, kid, draft, pool)}
      </div>
    </div>`;
}

/* The draft plan. Opens as last week's shape, re-priced against this week's
   money — so a smaller week never commits more than exists. */
function mnyEnsureDraft(wk, kid) {
  if (mnyDraft && mnyDraft.wk === wk && mnyDraft.kid === kid) return mnyDraft;
  const prev = mnyPreviousPlan(wk, kid);
  const planId = (prev && prev.planId) ? 'last' : 'debt';
  mnyDraft = {
    wk, kid, planId,
    split: mnySplitFor(wk, kid, planId),
    reflect: null,
    own: null,
  };
  mnyPlanOpen = false;
  return mnyDraft;
}

/* The parent's before-we-start list. Collapsed, because on a good week it is
   seven ticks and nobody needs to read it.

   It used to render inside step 4 — after step 3 had already agreed the week —
   which made a list called "before we start" into a post-mortem. It belongs at
   the top of step 1, and that is where mmRenderReview now calls it. */
function mnyChecklist(wk, kid) {
  const checks = mnyChecks(wk, kid);
  const done = MNY_CHECKS.filter(c => checks[c.id]).length;
  if (!mnyChecksOpen) {
    return `<button type="button" class="mny-btn wide" onclick="mnyToggleChecks()">
      🧭 Before we start — ${done} of ${MNY_CHECKS.length} ready ▸</button>`;
  }
  return `<div class="mny-card">
      <div class="mny-week-head"><span class="mny-label">🧭 Before we start</span>
        <button type="button" class="mny-chip" onclick="mnyToggleChecks()">Hide ▾</button></div>
      <div class="mny-checks">${MNY_CHECKS.map(c =>
        `<button type="button" class="mny-chip ${checks[c.id] ? 'on' : ''}" onclick="mnyTickCheck('${escapeJsAttr(c.id)}')">${checks[c.id] ? '✓' : '○'} ${escapeHtml(c.label)}</button>`).join('')}</div>
    </div>`;
}

/* What there is to decide about, and what was never up for decision. The loan
   payment is one locked line inside this card rather than a card of its own:
   it is not a choice, and giving it its own card made it look like one. */
function mnyPoolCard(wk, kid, pool) {
  const b = pool.breakdown;
  const due = pool.due;
  const w = ensureWallet(kid);
  const short = pool.mustPay > 0 && money2(w.cash + b.net) < pool.mustPay;
  // The payment can be argued with, at the table, with the consequence on
  // screen while you argue. Parent-only: it is a change to the agreement.
  const payRow = (d) => {
    const stepper = isParent()
      ? `<span class="mny-stepgrp">
           <button type="button" class="mny-step" onclick="mnyBumpPayment('${escapeJsAttr(d.debt.id)}',-1)" aria-label="Pay less">−</button>
           <button type="button" class="mny-step" onclick="mnyBumpPayment('${escapeJsAttr(d.debt.id)}',1)" aria-label="Pay more">+</button>
           ${d.reduced ? `<button type="button" class="mny-step" onclick="mnyResetPayment('${escapeJsAttr(d.debt.id)}')" aria-label="Back to the scheduled payment">↺</button>` : ''}
         </span>`
      : '';
    const was = d.reduced ? `<s class="mny-was">${mnyMoney(d.scheduled)}</s> ` : '';
    return `<div class="mny-row">
        <span>🔒 ${escapeHtml(d.debt.icon + ' ' + d.debt.name)} — ${d.kind === 'down' ? 'deposit' : 'this month'}</span>
        <b>${was}−${mnyMoney(d.amount).slice(1)}</b>${stepper}
      </div>`;
  };
  return `<div class="mny-card">
      <div class="mny-label">Where this week's money stands</div>
      <div class="mny-rows">
        <div class="mny-row"><span>Money that came in</span><b>${mnyMoney(pool.cameIn)}</b></div>
        ${pool.deposits > 0 ? `<div class="mny-row"><span class="mny-sub-row">…including 🎁 ${mnyMoney(pool.deposits)} from outside</span></div>` : ''}
        ${due.map(payRow).join('')}
        <div class="mny-row total"><span>Mine to choose</span><b>${mnyMoney(pool.mine)}</b></div>
      </div>
      ${mnyPaymentImpact(wk, kid, pool)}
      ${mnyBuysNote(pool.mine)}
      <div class="mny-note">Corrections to what she earned happen on the step before this one.</div>
      ${short ? `<div class="mny-note warn">There is not enough to cover the payment. ${MNY_SHORTFALL.map(s =>
        `<button type="button" class="mny-chip" onclick="mnyPickShortfall('${escapeJsAttr(s.id)}')">${escapeHtml(s.label)}</button>`).join(' ')}</div>` : ''}
    </div>`;
}
/* What paying less actually costs, in the two units that mean something to a
   nine-year-old: dollars added by arrears, and months added to the date she is
   free of it. Silent when the family is paying the schedule, because then
   there is nothing to weigh up. */
function mnyPaymentImpact(wk, kid, pool) {
  if (!(pool.unpaid > 0)) return '';
  const primary = mnyDebtsByPriority(kid).find(d => loanBalance(kid, d.id) > 0);
  const rate = primary ? (Number(primary.arrearsRatePct) || 0) / 100 : 0;
  const cost = money2(pool.unpaid * rate);
  // The months are the half a nine-year-old can actually feel. loanFreeDate
  // already answers "when am I free of this at the current rate", so asking it
  // twice — once as if the shortfall had been paid — gives the delta without a
  // second formula to keep in step with the first.
  let later = '';
  if (primary) {
    const now = loanFreeDate(kid, primary.id, 0);
    const ifPaid = loanFreeDate(kid, primary.id, pool.unpaid);
    if (now.months != null && ifPaid.months != null) {
      const slip = now.months - ifPaid.months;
      if (slip > 0) later = ` It also pushes being free of ${escapeHtml(primary.name)} out by about `
        + `${slip} month${slip === 1 ? '' : 's'}.`;
    }
  }
  return `<div class="mny-note warn">
      Paying ${mnyMoney(pool.unpaid)} less than the schedule frees ${mnyMoney(pool.unpaid)} to choose with now,
      and costs ${mnyMoney(cost)} a month in late fees until it is caught up.${later}
      It is not forgiven — the loan still carries it.
    </div>`;
}

/* The three ways a short week can be settled. All three have a price, and the
   price is the lesson. */
const MNY_SHORTFALL = [
  { id: 'pay_available',      label: 'Pay what I have' },
  { id: 'pay_nothing',        label: 'Pay nothing this month' },
  { id: 'cover_from_savings', label: 'Take it from what I kept ready' },
];
let mnyShortfallChoice = 'pay_available';
function mnyPickShortfall(id) { mnyShortfallChoice = id; renderMeetingMode(); }

/* Nudge a debt's payment for this week. Never above the schedule (paying extra
   is a choice made below, out of what's hers) and never below zero. */
function mnyBumpPayment(debtId, dir) {
  const wk = mnyWeekKeyMeeting(), kid = mnyMeetingKid();
  const row = mnyDueThisWeek(kid, wk).find(d => d.debt.id === debtId);
  if (!row) return;
  const next = money2(Math.max(0, Math.min(row.scheduled, row.amount + dir)));
  mnySetPaymentOverride(kid, wk, debtId, next >= row.scheduled ? null : next);
  mnyDraft = null;   // the pool changed, so the draft split has to be re-priced
  renderMeetingMode();
}
function mnyResetPayment(debtId) {
  mnySetPaymentOverride(mnyMeetingKid(), mnyWeekKeyMeeting(), debtId, null);
  mnyDraft = null;
  renderMeetingMode();
}

/* The plan, already applied and priced. On a normal week this is the whole of
   step 4: read it, answer the question, done. */
function mnyPlanCard(wk, kid, draft, pool) {
  const plan = MNY_PLANS.find(p => p.id === draft.planId) || MNY_PLANS[0];
  const priced = mnyPricePlan(kid, draft.split);
  const rows = mnyBucketRows(kid, draft.split);
  const out = mnyOutflowSegments(wk, kid, draft.split);
  return `<div class="mny-card">
      <div class="mny-week-head">
        <span class="mny-label">${draft.planId === 'last' ? "Last week's plan, applied" : escapeHtml(plan.label)}</span>
        <b>${mnyMoney(mnySplitTotal(draft.split))}</b>
      </div>
      <div class="mny-rows">${rows}</div>
      ${priced.bonus > 0 ? `<div class="mny-note">Paying early earns you <b>${mnyMoney(priced.bonus)}</b> on top${priced.monthsSaved > 0 ? `, and finishes ${priced.monthsSaved} month${priced.monthsSaved > 1 ? 's' : ''} sooner` : ''}.</div>` : ''}
      <div class="mny-sub">Where it all goes</div>
      ${mnyBarHtml(out, { empty: 'Nothing to move' })}
      ${mnyGhostBar(wk, kid)}
      <button type="button" class="mny-btn wide${mnyPlanOpen ? '' : ' primary'}" onclick="mnyTogglePlan()">${
        mnyPlanOpen ? 'Done changing ▾' : '✏️ Change the plan — pick a different one, or set your own amounts ▸'}</button>
    </div>`;
}
/* Last week's shape, ghosted under this week's. Two bars side by side would be
   a comparison; one under the other, faded, is the same shape asked about
   again — which is the actual question at the meeting. Absent on the first
   week, because a ghost of nothing is just a puzzle. */
function mnyGhostBar(wk, kid) {
  const prev = mnyPreviousPlan(wk, kid);
  if (!prev || !prev.split) return '';
  const ghost = mnyOutflowSegments(wk, kid, prev.split);
  if (!ghost.segs.length) return '';
  return `<div class="mny-ghost">
      <div class="mny-ghost-label">Last week</div>
      <div class="mny-bar ghost" role="img" aria-label="Last week's plan for comparison">${ghost.segs.map(g =>
        `<div class="mny-seg" style="width:${g.w};background:${g.color}"></div>`).join('')}</div>
    </div>`;
}

function mnyBucketRows(kid, split) {
  const rows = [];
  mnyDebtsByPriority(kid).forEach(d => {
    const v = money2(split['loan:' + d.id]);
    if (v > 0 || split['loan:' + d.id] != null) {
      rows.push(`<div class="mny-row"><span>${escapeHtml(d.icon + ' Pay off ' + d.name)} ${mnyAskBtn('extra')}</span><b>${mnyMoney(v)}</b></div>`);
    }
  });
  mnyGoals(kid).forEach(g => {
    const v = money2(split['goal:' + g.id]);
    if (v > 0 || split['goal:' + g.id] != null) {
      rows.push(`<div class="mny-row"><span>${escapeHtml(g.icon + ' Toward ' + g.name)}</span><b>${mnyMoney(v)}</b></div>`);
    }
  });
  [['spend', '🛍️ Spend it', 'spend'], ['ready', '💵 Keep it ready', 'ready'],
   ['gic', '🔒 Lock it away for a year', 'gic'],
   ['stock', '📈 Buy a bit of a company', 'stock']].forEach(([k, label, ask]) => {
    rows.push(`<div class="mny-row"><span>${label} ${mnyAskBtn(ask)}</span><b>${mnyMoney(split[k])}</b></div>`);
  });
  return rows.join('');
}

/* Everything that lets her change the plan, behind one button. */
function mnyChangePlanCards(wk, kid, draft, pool) {
  const cards = MNY_PLANS.map(p => {
    const open = mnyIsOpen(kid, p.need);
    return `<button type="button" class="mny-plan ${draft.planId === p.id ? 'on' : ''}" ${open ? '' : 'disabled'}
      onclick="mnyPickPlan('${escapeJsAttr(p.id)}')">
      <span class="mny-plan-icon">${p.icon}</span>
      <span>${escapeHtml(p.label)}</span>
      ${open ? '' : `<small>🔒 ${escapeHtml(mnyNeedLabel(p.need))}</small>`}
    </button>`;
  }).join('');

  const steppers = mnyDebtsByPriority(kid).map(d =>
    `<div class="mny-row"><span>${escapeHtml(d.icon + ' ' + d.name)}</span>${mnyBucketStepper('loan:' + d.id, draft.split['loan:' + d.id])}</div>`).join('')
    + mnyGoals(kid).map(g => {
      const pace = mnyGoalPace(kid, g);
      return `<div class="mny-row"><span>${escapeHtml(g.icon + ' ' + g.name)}
        ${pace.neededPerWeek != null ? `<small class="mny-sub-row">${mnyMoney(pace.neededPerWeek)} a week keeps it on track</small>` : ''}</span>
        ${mnyBucketStepper('goal:' + g.id, draft.split['goal:' + g.id])}</div>`;
    }).join('')
    + MNY_BUCKETS.filter(b => b.key !== 'loan').map(b => {
      const open = mnyIsOpen(kid, b.need);
      return `<div class="mny-row"><span>${b.icon} ${escapeHtml(b.label)}${open ? '' : ' 🔒 ' + mnyNeedLabel(b.need)}</span>
        ${open ? mnyBucketStepper(b.key, draft.split[b.key]) : '<b>—</b>'}</div>`;
    }).join('');

  const spent = mnySplitTotal(draft.split);
  const left = money2(pool.mine - spent);
  const overStock = money2(draft.split.stock) > pool.stockCap;
  const overSpend = money2(draft.split.spend) > pool.spendCap;
  const msg = overStock
    ? `<span class="warn">A bit of a company is capped at ${mnyMoney(pool.stockCap)} — a fifth of the week.</span>`
    : overSpend
    ? `<span class="warn">Spending is capped at ${mnyMoney(pool.spendCap)} — a fifth of the week.</span>`
    : (Math.abs(left) < 0.005 ? 'Every dollar has a job ✓'
       : (left > 0 ? `${mnyMoney(left)} still has no job.` : `That is ${mnyMoney(-left)} more than you have.`));

  const doorAmt = (mnyDoorAmt == null) ? pool.mine : mnyDoorAmt;
  const doors = mnyDoors(kid, doorAmt);
  const maxAbs = Math.max(1, ...doors.map(d => Math.abs(d.delta)));

  return `<div class="mny-card">
      <div class="mny-label">Pick a plan</div>
      <div class="mny-plans">${cards}</div>
      <div class="mny-sub">Or set every number yourself</div>
      <div class="mny-rows">${steppers}</div>
      <div class="mny-note">${msg}</div>
    </div>
    <div class="mny-card">
      <div class="mny-label">If I put ${mnyMoney(doorAmt)} somewhere for a year</div>
      <div class="mny-chiprow">
        ${[10, 50, 100].map(v => `<button type="button" class="mny-chip ${doorAmt === v ? 'on' : ''}" onclick="mnySetDoor(${v})">$${v}</button>`).join('')}
        <button type="button" class="mny-chip ${mnyDoorAmt == null ? 'on' : ''}" onclick="mnySetDoor(null)">What I actually have</button>
      </div>
      <div class="mny-doors">${doors.map(d => {
        const w = Math.round((Math.abs(d.delta) / maxAbs) * 50);
        const neg = d.delta < 0;
        return `<div class="mny-door">
            <span class="mny-door-label">${d.icon} ${escapeHtml(d.label)}</span>
            <span class="mny-door-track">
              <i class="${neg ? 'neg' : 'pos'}" style="width:${w}%"></i>
            </span>
            <b class="${neg ? 'neg' : ''}">${mnySigned(d.delta)}${d.range ? ' or so' : ''}</b>
          </div>`;
      }).join('')}</div>
      <div class="mny-note">${escapeHtml(doors.map(d => d.note)[3])}</div>
    </div>
    ${mnyIsOpen(kid, 90) ? mnyStockChart() : ''}`;
}
function mnyBucketStepper(key, value) {
  return `<span class="mny-stepgrp">
      <button type="button" class="mny-step" onclick="mnyTuneBucket('${escapeJsAttr(key)}',-1)" aria-label="Less">−</button>
      <b>${mnyMoney(value)}</b>
      <button type="button" class="mny-step" onclick="mnyTuneBucket('${escapeJsAttr(key)}',1)" aria-label="More">+</button>
    </span>`;
}

/* One real year, drawn from real prices. A company that only ever goes up is
   not a lesson about companies. */
function mnyStockChart() {
  const series = STOCKS_2023.TSLA.prices;
  const lo = Math.min(...series), hi = Math.max(...series);
  const pts = series.map((v, i) =>
    `${(i / (series.length - 1)) * 100},${30 - ((v - lo) / (hi - lo)) * 26}`).join(' ');
  const drop = Math.round(((Math.min(...series.slice(2, 5)) - series[2]) / series[2]) * 100);
  return `<div class="mny-card">
      <div class="mny-label">📈 Companies go down too</div>
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" class="mny-spark" role="img" aria-label="One company's price through 2023">
        <polyline points="${pts}" fill="none" stroke="#c14a24" stroke-width="1.4" vector-effect="non-scaling-stroke"/>
      </svg>
      <div class="mny-note">This really happened, back in 2023. One company fell ${Math.abs(drop)}% in three months, then went back up. Nobody knew it would. ${mnyAskBtn('stock')}</div>
    </div>`;
}

/* One question, and it gates the commit. Not because the answer is checked,
   but because a decision she cannot say a reason for is not hers yet. */
function mnyReflectCard(draft) {
  const chosen = MNY_REFLECT.chips.find(c => c.id === draft.reflect);
  return `<div class="mny-card">
      <div class="mny-label">One question</div>
      <div class="mny-today-big">${escapeHtml(MNY_REFLECT.question)}</div>
      <div class="mny-chiprow">${MNY_REFLECT.chips.map(c =>
        `<button type="button" class="mny-chip ${draft.reflect === c.id ? 'on' : ''}" onclick="mnyPickReflect('${escapeJsAttr(c.id)}')">${escapeHtml(c.label)}</button>`).join('')}</div>
      ${chosen
        ? `<div class="mny-note">${escapeHtml(chosen.effect)} The plan above has moved to match — change any number if you disagree with it.</div>`
        : `<div class="mny-note">Pick one. Your answer shapes the plan above, and it goes into the record of this week.</div>`}
    </div>`;
}

function mnyCommitBar(wk, kid, draft, pool) {
  const spent = mnySplitTotal(draft.split);
  const left = money2(pool.mine - spent);
  const overStock = money2(draft.split.stock) > pool.stockCap;
  const overSpend = money2(draft.split.spend) > pool.spendCap;
  let blocked = '';
  if (!draft.reflect) blocked = 'Answer the question first';
  else if (left < -0.005) blocked = 'That is more than you have';
  else if (left > 0.005) blocked = `${mnyMoney(left)} still has no job`;
  else if (overStock) blocked = 'Too much into one company';
  else if (overSpend) blocked = `Spending is capped at ${mnyMoney(pool.spendCap)}`;
  return `<div class="mny-confirmbar">
      <span><b>${mnyMoney(spent)}</b> to move</span>
      ${blocked
        ? `<button type="button" class="mny-btn" disabled>${escapeHtml(blocked)}</button>`
        : `<button type="button" class="mny-btn primary" onclick="mnyDoCommit()">Done — move my money</button>`}
    </div>`;
}

function mnyCommittedCard(wk, kid) {
  const plan = mnyWeekPlan(wk, kid) || {};
  const out = mnyOutflowSegments(wk, kid, plan.split);
  return `<div class="mny-card">
      <div class="mny-label">Done for this week</div>
      <div class="mny-today-big">The money has moved. ${escapeHtml(plan.label || '')}</div>
      ${mnyBarHtml(out, { empty: '' })}
      ${mmUndo ? `<button type="button" class="mny-btn wide" onclick="mmUndoRecord()">↩️ Undo — nothing is frozen yet</button>` : ''}
    </div>`;
}

/* ════════════════════════════════════════════════════════════════
   ACTIONS
   ════════════════════════════════════════════════════════════════ */
function mnyToggleEdit() {
  if (!isParent()) { showToast('A grown-up changes the numbers 🔒'); return; }
  mnyEditOn = !mnyEditOn; renderMeetingMode();
}
function mnyToggleRow(key) { mnyExpandRow = (mnyExpandRow === key) ? null : key; renderMeetingMode(); }
function mnyToggleComp() { mnyCompOpen = !mnyCompOpen; if (!mnyCompOpen) mnyCompDraft = null; renderMeetingMode(); }
function mnyToggleDep() { mnyDepOpen = !mnyDepOpen; if (!mnyDepOpen) mnyDepDraft = null; renderMeetingMode(); }
function mnyToggleChecks() { mnyChecksOpen = !mnyChecksOpen; renderMeetingMode(); }
function mnyTogglePlan() { mnyPlanOpen = !mnyPlanOpen; renderMeetingMode(); }
function mnyTickCheck(id) { mnyToggleCheck(mnyWeekKeyMeeting(), mnyMeetingKid(), id); renderMeetingMode(); }
function mnyWeekKeyMeeting() { return ctWeekKey || ctThisWeekKey(); }

function mnyBumpChannel(channel, delta) {
  const wk = mnyWeekKeyMeeting(), kid = mnyMeetingKid();
  const b = mrWeekBreakdown(wk, kid);
  const cur = { chores: b.chorePaid, learning: b.learnPaid, streak: b.streakBonus,
                comp: b.compPaid, fines: b.fines.total }[channel];
  mnySetOverride(kid, wk, channel, Math.max(0, money2(cur + delta)), mnyWeekReason(kid, wk));
  renderMeetingMode();
}
function mnyResetChannel(channel) {
  mnyClearOverride(mnyMeetingKid(), mnyWeekKeyMeeting(), channel);
  renderMeetingMode();
}
function mnyFlagMissing(channel) {
  mnyToggleMissing(mnyMeetingKid(), mnyWeekKeyMeeting(), channel);
  renderMeetingMode();
}
/* One reason for the week, applied to every change made in it. */
function mnyPickReason(id) {
  const wk = mnyWeekKeyMeeting(), kid = mnyMeetingKid();
  const ov = mnyOverrides(kid, wk);
  Object.keys(ov).forEach(k => { ov[k].reason = id; });
  saveAll();
  renderMeetingMode();
}

function mnyStepper(field, value, which, step) {
  const s = step || 1;
  const fn = which === 'comp' ? 'mnyCompBump' : 'mnyDepBump';
  return `<span class="mny-stepgrp">
      <button type="button" class="mny-step" onclick="${fn}('${escapeJsAttr(field)}',${-s})" aria-label="Less">−</button>
      <b>${which === 'dep' ? mnyMoney(value) : value}</b>
      <button type="button" class="mny-step" onclick="${fn}('${escapeJsAttr(field)}',${s})" aria-label="More">+</button>
    </span>`;
}
/* Typed fields mutate the draft WITHOUT redrawing. A chip or a stepper changes
   what the rest of the card says (the score preview, which detail rows apply),
   so those still re-render; a name being typed changes nothing else on screen,
   and redrawing on each letter is what threw the caret out of the box. The
   value is already in the draft, so the next real render picks it up. */
function mnyCompSetQuiet(field, value) { if (mnyCompDraft) mnyCompDraft[field] = value; }
function mnyDepSetQuiet(field, value) { if (mnyDepDraft) mnyDepDraft[field] = value; }
function mnyCompSet(field, value) { if (!mnyCompDraft) return; mnyCompDraft[field] = value; renderMeetingMode(); }
function mnyCompBump(field, delta) { if (!mnyCompDraft) return; mnyCompDraft[field] = Math.max(0, (Number(mnyCompDraft[field]) || 0) + delta); renderMeetingMode(); }
function mnyDepSet(field, value) { if (!mnyDepDraft) return; mnyDepDraft[field] = value; renderMeetingMode(); }
function mnyDepBump(field, delta) { if (!mnyDepDraft) return; mnyDepDraft[field] = Math.max(0, money2((Number(mnyDepDraft[field]) || 0) + delta)); renderMeetingMode(); }

function mnySaveComp() {
  const d = mnyCompDraft; if (!d) return;
  const kid = mnyMeetingKid();
  const saved = mrAddCompetition(kid, {
    sport: d.sport, name: d.name, dayKey: d.dayKey, points: d.points,
    qualified: d.qualified, provincial: d.provincial,
    placement: { group: d.group || undefined, overall: d.overall || undefined },
    danceItems: { silver: d.silver, gold: d.gold, allGold: d.allGold },
  });
  if (!saved) return;
  // A competition entered after the week was agreed changes what the week is
  // worth, so the week has to be agreed again.
  mnyReopenWeek(kid, mnyWeekKeyMeeting());
  mnyCompOpen = false; mnyCompDraft = null;
  showToast(`${mnySportIcon(saved.sport)} Saved — ${mnyMoney(saved.awarded)}`);
  renderMeetingMode();
}
function mnyDeleteComp(id) {
  mrDeleteCompetition(mnyMeetingKid(), id);
  mnyReopenWeek(mnyMeetingKid(), mnyWeekKeyMeeting());
  renderMeetingMode();
}
function mnySaveDep() {
  const d = mnyDepDraft; if (!d) return;
  const saved = mnyAddDeposit(mnyMeetingKid(), mnyWeekKeyMeeting(), d);
  if (!saved) { showToast('Put in an amount first'); return; }
  mnyDepOpen = false; mnyDepDraft = null;
  showToast(`🎁 Saved — ${mnyMoney(saved.amount)}`);
  renderMeetingMode();
}
function mnyDeleteDep(id) { mnyRemoveDeposit(mnyMeetingKid(), id); renderMeetingMode(); }

function mnyDoConfirm() {
  const wk = mnyWeekKeyMeeting(), kid = mnyMeetingKid();
  if (!mnyConfirmWeek(wk, kid, 'a grown-up')) return;
  mnyDraft = null;
  showToast('✅ Agreed — now what to do with it');
  renderMeetingMode();
}

function mnyPickPlan(id) {
  const d = mnyDraft; if (!d) return;
  const plan = MNY_PLANS.find(p => p.id === id);
  // The card is already disabled, but the gate belongs on the action too: a
  // lesson that can be skipped by a stale click is not a lesson.
  if (!plan || !mnyIsOpen(d.kid, plan.need)) { showToast(`🔒 ${mnyNeedLabel(plan ? plan.need : 0)}`); return; }
  d.planId = id;
  d.split = mnySplitFor(d.wk, d.kid, id, d.own);
  renderMeetingMode();
}
/* Answering the question is not a formality — it re-shapes the plan toward
   what she just said the money is for. Three identical-feeling buttons that
   only unlocked a commit taught that the question was a toll booth; a plan
   that visibly moves teaches that the answer is a decision. Every number is
   still hers to override afterwards. */
function mnyPickReflect(id) {
  const d = mnyDraft;
  if (!d) return;
  d.reflect = id;
  // ...except once she has set the numbers by hand. At that point the split is
  // an answer in its own right, and overwriting it because she then named a
  // reason would throw away the more considered of the two.
  if (d.planId === 'own') { renderMeetingMode(); return; }
  const chip = MNY_REFLECT.chips.find(c => c.id === id);
  if (chip && chip.planId) {
    const open = mnyIsOpen(d.kid, (MNY_PLANS.find(p => p.id === chip.planId) || {}).need || 0);
    if (open) {
      d.planId = chip.planId;
      d.split = mnySplitFor(d.wk, d.kid, chip.planId, d.own);
    }
  }
  renderMeetingMode();
}
function mnySetDoor(v) { mnyDoorAmt = v; renderMeetingMode(); }
/* Touching any stepper turns the plan into a hand-built one, seeded from
   wherever it already was — so nudging one number never silently discards the
   other three. */
function mnyTuneBucket(key, dir) {
  const d = mnyDraft; if (!d) return;
  const pool = mnyPool(d.wk, d.kid);
  const next = Math.max(0, money2(money2(d.split[key]) + dir));
  if (key === 'stock' && next > pool.stockCap) { showToast(`A fifth of the week is the most — ${mnyMoney(pool.stockCap)}`); return; }
  if (key === 'spend' && next > pool.spendCap) { showToast(`A fifth of the week is the most to spend — ${mnyMoney(pool.spendCap)}`); return; }
  const others = money2(mnySplitTotal(d.split) - money2(d.split[key]));
  if (money2(others + next) > pool.mine + 0.005) { showToast('That is more than you have'); return; }
  d.split[key] = next;
  d.planId = 'own';
  d.own = Object.assign({}, d.split);
  renderMeetingMode();
}

/* ════════════════════════════════════════════════════════════════
   THE COMMIT — the one place money actually moves
   ════════════════════════════════════════════════════════════════ */
function mnyDoCommit() {
  const wk = mnyWeekKeyMeeting(), kid = mnyMeetingKid();
  const d = mnyDraft;
  if (!d || !mnyIsConfirmed(wk, kid) || mnyIsCommitted(wk, kid)) return;
  if (!isParent()) { showToast('A grown-up moves the money 🔒'); return; }

  // Catch the world up first: interest earned and prices moved since the last
  // meeting are part of this week, and the ledger has to record them.
  mnySimCatchUp(kid);
  const passive = mnyPassiveSinceLastMeeting(kid);

  mmTakeUndoSnapshot(wk);

  // 1 · money from outside joins the pool FIRST. It carries no destination —
  //     the plan below decides where every dollar goes, whichever door it came
  //     in through — and it has to be in the wallet before the schedule runs.
  //     Crediting it afterwards would send a week to arrears for want of money
  //     that was sitting on the table the whole time.
  mnyDepositsForWeek(kid, wk).forEach(dep => {
    if (dep.appliedAt) return;
    moneyAddCash(kid, dep.amount);
    dep.appliedAt = Date.now();
    dep.updatedAt = syncNow();
  });

  // 2 · the week itself: freeze the ledger, credit what she earned, credit XP,
  //     run the scheduled loan payment against the whole pool, open the box.
  const res = commitKidWeek(wk, kid, { shortfall: mnyShortfallChoice });
  const parts = res.parts;

  // 3 · the plan. Cash is already in the wallet from step 1, so each bucket
  //     just moves it on.
  const split = d.split;
  let toLoan = 0;
  mnyDebtsByPriority(kid).forEach(debt => {
    const amt = money2(split['loan:' + debt.id]);
    if (!(amt > 0)) return;
    const w = ensureWallet(kid);
    const pay = money2(Math.min(amt, w.cash));
    if (!(pay > 0)) return;
    w.cash = money2(w.cash - pay);
    const rec = loanRecordPayment(kid, pay, 'early', debt.id);
    toLoan = money2(toLoan + pay);
    if (rec) parts.push(`${debt.name} −$${pay.toFixed(2)} (cleared $${rec.credited.toFixed(2)})`);
  });
  // Goal money is real kept-ready money with a name on it — it moves into
  // savings like anything else, and the goal records that this much of it is
  // spoken for. Keeping goals as a separate pot would have meant a kid could
  // not change her mind, which is not a thing savings should do.
  const toGoals = {};
  mnyGoals(kid).forEach(g => {
    const amt = money2(split['goal:' + g.id]);
    if (!(amt > 0)) return;
    if (!moneyDeposit(kid, amt)) return;
    g.saved = money2(money2(g.saved) + amt);
    g.updatedAt = syncNow();
    toGoals[g.id] = amt;
    parts.push(`${g.icon} ${g.name} +$${amt.toFixed(2)}`);
  });
  // Spending leaves it exactly where it is: cash in the wallet is money she can
  // spend. The record of the decision is the plan and the ledger line below.
  if (money2(split.spend) > 0) parts.push(`🛍️ to spend $${money2(split.spend).toFixed(2)}`);
  if (money2(split.gic) > 0) moneyOpenGIC(kid, money2(split.gic), 12);
  if (money2(split.stock) > 0) mnyBuyChosenFund(kid, money2(split.stock));
  if (money2(split.ready) > 0) moneyDeposit(kid, money2(split.ready));

  // 4 · write it down: what was decided, and what the ledger should say.
  const plan = MNY_PLANS.find(p => p.id === d.planId) || MNY_PLANS[0];
  mnySavePlan(wk, kid, {
    planId: d.planId, label: plan.label, split, reflect: d.reflect,
    committedAt: syncNow(),
  });
  const c = state.shared.chore;
  const ledger = ((c.moneyLedger || {})[wk] || {})[kid];
  if (ledger) {
    const stamp = mnyWeekConfirm(wk, kid) || {};
    ledger.confirmedBy = stamp.by || 'a grown-up';
    ledger.plan = { id: d.planId, label: plan.label };
    ledger.outside = mnyDepositTotal(kid, wk);
    ledger.debtExtra = toLoan;
    ledger.spend = money2(split.spend);
    ledger.ready = money2(split.ready);
    ledger.gic = money2(split.gic);
    ledger.stock = money2(split.stock);
    ledger.reflect = d.reflect;
    ledger.passive = passive;
    ledger.goals = toGoals;
    ledger.debtBalanceAfter = mnyTotalOwing(kid);
  }
  // This Sunday becomes the new baseline for "made on its own".
  mnyStampPassiveBaseline(kid);

  // 5 · the shared half of the meeting, once BOTH kids are settled.
  if (['jenn', 'jess'].every(k => mnyIsCommitted(wk, k))) commitMeetingShared(wk);

  saveAll();
  mnyDraft = null; mnyPlanOpen = false;
  showToast(`💛 Done${parts.length ? ' · ' + parts.slice(0, 3).join(' · ') : ''}`);
  renderMeetingMode();
}

/* Buy whichever fund the rules currently name. A fixed menu, never a text box
   (see MNY_FUNDS) — and the two blended options are not real tickers, so they
   are held as their own record rather than pretending to be a company. */
function mnyBuyChosenFund(kid, dollars) {
  const fundId = ((mrRules().investing || {}).fund) || 'index';
  const fund = MNY_FUNDS.find(f => f.id === fundId) || MNY_FUNDS[0];
  if (fund.ticker) { moneyBuyStock(kid, fund.ticker, dollars); return; }
  const w = ensureWallet(kid);
  const amt = money2(Math.min(dollars, w.cash));
  if (!(amt > 0)) return;
  w.cash = money2(w.cash - amt);
  const held = mnyHoldingsOfKind(kid, 'stock').find(h => h.fundId === fund.id);
  if (held) {
    held.units = 1;
    held.priceNow = money2(mnyHoldingValue(held) + amt);
    held.costBasis = money2(money2(held.costBasis) + amt);
    held.updatedAt = syncNow();
  } else {
    // A blended fund has no share price to look up, so it grows at a rate like
    // a savings account does — just a much better one, with the risk to match.
    mnyAddHolding(kid, { kind: 'stock', name: fund.label, fundId: fund.id,
                         units: 1, priceNow: amt, costBasis: amt,
                         rateAnnual: MNY_FUND_RATES[fund.id] || 0 });
  }
  saveAll();
}
