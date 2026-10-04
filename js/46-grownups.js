// Weekly-Planner — 👨‍👩‍👧 Grown-ups: the parent's money screen (Sunday v15, Grown-ups v2).
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   GROWN-UPS (Plan v3 §A, docs/handoff/sunday-v15/Grown-ups v2 Screen.dc.html)

   Parent › Setup › 💰 Money (#ptab-money / #mnyRulesWrap) is this screen. Its
   sub-tab bar is the prototype's: ✅ Approve (N) · ➕ Commitments · 📦 Fines ·
   🎁 Expected · ⚙️ Rules — plus 📖 More, which holds the old rail's sections
   unchanged (js/24-money-parent.js). ONE variable says where the screen is:
   `mnyParentSection` is a tab id here, or one of MNY_PARENT_SECTIONS (= More,
   on that section) — so every route that already set a section (Setup ›
   🕰️ Change history, the meeting hub's Grandma pointer, Now's loan-season
   row) still lands where it did.

   Each tab is the prototype's left column and its right-hand pane, drawn from
   the app's own data, and every write goes through the function that already
   owns it:
     ✅ Approve      mnyRequestsFor (one reader) · mnyAnswerRequest (one
                     answerer) · mnySetRequestPay · mnyReopenRequest ·
                     📉 market.wobblePct through mrApplyEdits
     ➕ Commitments  mnyAddCommitment / mnyAddSurprise (js/20) · mnySetClubPaid ·
                     mrPlaceActivityBlock (the one-off ⛸️ session)
     📦 Fines        mrAddFine (with who) · mrRemoveFine · mrFineStanding
     🎁 Expected     mnyAddExpected / mnyEditExpected / mnyRemoveExpected
     ⚙️ Rules        mnyQueueEdit → mnySavePending (one version, from next
                     Monday) · sdImpact (js/43) · mrApplySundayRules

   Actions are `data-mnyp-action="gu…"` under #mnyRulesWrap; mnyParentClick /
   mnyParentInput hand them to guAction / guInput. Drafts (the commitment form,
   the fine form, the one-off session) are module-level, like the Record
   sheet's: typing never re-renders.
   ════════════════════════════════════════════════════════════════ */

const GU_TABS = [
  { id: 'approve', label: '✅ Approve' },
  { id: 'commit', label: '➕ Commitments' },
  { id: 'fines', label: '📦 Fines' },
  { id: 'expect', label: '🎁 Expected' },
  { id: 'rules', label: '⚙️ Rules' },
  { id: 'more', label: '📖 More' },
];
const GU_KIDS = ['jenn', 'jess'];
const GU_DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// The prototype's 🎁 add chips: [label, a guess in dollars].
const GU_EXPECT_ADDS = [['🎂 Birthday', 20], ['🎄 Christmas', 20], ['🧧 New Year', 50], ['🏆 Meet', 12]];
const GU_KIND_LABEL = { goal: 'wants a new goal', comp: 'says a result', gift: 'gift came in', move: 'asks to move',
                        dispute: 'disputes a fine', adv: 'wants to draw early', deposit: 'puts cash in',
                        skip: 'can’t make a session' };
const GU_WORDS_STAGE = { 1: 'earn · save · owe', 2: '+ income · interest · cash flow', 3: '+ assets · debt · net worth' };

/* ⚙️ Rules — the prototype's DEFS, row for row, each on its Plan v3 §C path.
   [title, card tint, rows: [path, label, unit ('$' | '%' | 'st'), step, she(v, R)]].
   A row's path may be a function of the rules (the 7-day streak tier and the
   box fine are found BY ID in the family's own lists, never by position). */
const GU_RULE_DEFS = [
  ['🧹 Earning', 'green', [
    ['chores.dailyCap', 'Chores · per graded day', '$', 0.5, v => `“${guMoney$(v)} for a day done right”`],
    // Plan v5 Deviation 30: the forgiving day, said from the rules (sdStreakForgiving).
    [R => 'streak.tiers.' + guTierIndex(R, 7) + '.bonus', 'Routine · 7 days in a row', '$', 1,
      (v, R) => `“${guMoney$(v)} bonus for a full week”${sdStreakForgiving(R) ? ' · ' + sdStreakForgiving(R) : ''}`],
    [R => 'fines.items.' + guItemIndex(R, 'box_repeat') + '.amount', 'Box fine · left out twice in a week', '$', 0.25, v => `“the 🐰 takes ${guMoney$(v)}”`]]],
  ['🏆 Competitions', 'jenn', [
    ['competition.swim.perPoint', 'Swim · per point', '$', 0.5],
    ['competition.swim.qualifyBonus', 'Swim · qualify for Provincials', '$', 5],
    ['competition.swim.provincialPerPoint', 'Swim · per point at Provincials', '$', 0.5],
    ['competition.skate.perPoint', 'Skating · per point', '$', 0.5],
    ['competition.skate.placement.group.1', 'Skating · 1st in group', '$', 5],
    ['competition.skate.placement.group.2', 'Skating · 2nd in group', '$', 5],
    ['competition.skate.placement.group.3', 'Skating · 3rd in group', '$', 1],
    ['competition.skate.placement.overall.1', 'Skating · 1st overall', '$', 5],
    ['competition.skate.placement.overall.2', 'Skating · 2nd overall', '$', 5],
    ['competition.skate.placement.overall.3', 'Skating · 3rd overall', '$', 1]]],
  ['🧱 Loan', 'loan', [
    ['loan.monthly.jenn', 'Jenn · loan per month', '$', 5, v => `${mnyMoney(v * 12 / 52)} a week`],
    ['loan.monthly.jess', 'Jess · loan per month', '$', 5, v => `${mnyMoney(v * 12 / 52)} a week`],
    ['loan.extraBonusPct', 'Bonus on extra wall money', '%', 5, v => `“$1 extra counts as $${(1 + v / 100).toFixed(2)}”`],
    ['loan.ratePct', 'Loan interest', '%', 0.5, (v, R) => `a year · added every ${Number(mrRuleOr(R, 'loan.interestEverySundays')) || 4} Sundays`]]],
  ['🌱 Pots', 'jess', [
    // Plan v5 Deviation 8: Savings opens at 20% (the prototype's "Kept ready
    // opens at", named as the handoff names the pot).
    ['school.stagePct.ready', 'Savings opens at', '%', 5, () => 'of loan paid'],
    ['school.stagePct.locked', 'Locked away opens at', '%', 5, () => 'of loan paid'],
    ['school.stagePct.stock', 'Companies opens at', '%', 5, () => 'of loan paid'],
    ['pots.rates.ready', 'Kept ready pays', '%', 0.5, () => 'a year'],
    ['pots.rates.gic', 'Locked away pays', '%', 0.5, () => 'a year, promised'],
    ['pots.rates.stock', 'Companies (expected)', '%', 0.5, () => 'a year, can go down']]],
  ['👛 Spending', 'spend', [
    ['spend.capPct', 'Most she can cash out', '%', 5, () => 'of her share each Sunday'],
    ['advance.maxPerWeek', 'Most she can draw in advance', '$', 1, v => `“up to ${guMoney$(v)}, taken off next Sunday”`]]],
  ['📚 Words', 'lav', [
    ['words.jenn', 'Jenn · words', 'st', 1, v => GU_WORDS_STAGE[v] || ''],
    ['words.jess', 'Jess · words', 'st', 1, v => GU_WORDS_STAGE[v] || '']]],
];

/* Drafts, module-level (the Record sheet's idiom). */
let guCommitDraft = null;   // { type, kid, what, cost, share, weeks }
let guFineDraft = null;     // { kid, itemId, dayIdx, who }
let guOneOffDraft = null;   // { kid, dayIdx, startMin }
let guMoreSection = 'prices';   // which More section the 📖 More tab opens on

/* ── Small readers ── */
function guMoney$(v) { const n = money2(v); return '$' + (n % 1 ? n.toFixed(2) : String(n)); }
function guIsTab(id) { return GU_TABS.some(t => t.id === id && t.id !== 'more'); }
function guTierIndex(R, days) {
  const tiers = ((R || {}).streak || {}).tiers || [];
  const i = tiers.findIndex(t => t && Number(t.days) === days);
  return i < 0 ? Math.max(0, tiers.length - 1) : i;
}
function guItemIndex(R, id) {
  const items = ((R || {}).fines || {}).items || [];
  const i = items.findIndex(x => x && x.id === id);
  return i < 0 ? 0 : i;
}
function guNextMonday() {
  const d = formatDayKey(ctThisWeekKey());
  d.setDate(d.getDate() + 7);
  return ctDateToKey(d);
}
function guKidChip(kid) {
  return `<span class="gu-kidchip ${'gu-kidchip--' + kid}">${escapeHtml(mnyKidName(kid))}</span>`;
}
/* Everything still waiting on a grown-up, both girls — the tab's count and
   Parent › Now's "✅ N to answer" row read this one number. */
function guWaitingCount() {
  return GU_KIDS.reduce((n, kid) => n + mnyRequestsFor(kid).filter(q => q.open).length, 0);
}
/* Her steady money a week: chores, the routine streak and club sessions
   (Sunday's 🧱 steady part), averaged over the last 4 settled weeks. What the
   affordability card measures a loan payment against. */
function guSteady(kid) {
  const rows = mnyLedgerRows(kid).slice(0, 4);
  if (!rows.length) return 0;
  const sum = rows.reduce((a, r) => a + money2(r.chores) + money2(r.learning) + money2(r.streak) + money2(r.sessionsPaid), 0);
  return money2(sum / rows.length);
}
/* Σ of the weekly must-pay over her open rows, before anything carried. */
function guWeeklyLoan(kid) {
  return money2(mnyOpenDebtsOldestFirst(kid).reduce((a, d) => a + mnyWeeklyDue(d), 0));
}
/* "Oct 2026": the month she is free by, `weeks` Sundays from this one. */
function guFreeBy(left, perWeek) {
  if (!(left > 0)) return '✓ now';
  return sdMonthYear(ctThisWeekKey(), perWeek > 0 ? Math.ceil(left / perWeek) : Infinity);
}

/* ── The sub-tab bar ── */
function guTabBar() {
  const cur = guIsTab(mnyParentSection) ? mnyParentSection : 'more';
  const n = guWaitingCount();
  return `<div class="gu-tabs" role="group" aria-label="Grown-ups">${GU_TABS.map(t =>
    `<button type="button" class="gu-tab${cur === t.id ? ' on' : ''}" aria-pressed="${cur === t.id}" data-mnyp-action="gutab" data-mnyp-id="${t.id}">${escapeHtml(t.id === 'approve' ? `✅ Approve (${n})` : t.label)}</button>`).join('')}</div>`;
}

/* The whole tab: the prototype's two columns, the main one and its pane. */
function guRender(tab) {
  const parts = {
    approve: [guApproveMain, guApproveSide], commit: [guCommitMain, guCommitSide],
    fines: [guFinesMain, guFinesSide], expect: [guExpectMain, guExpectSide], rules: [guRulesMain, guRulesSide],
  }[tab] || [guApproveMain, guApproveSide];
  return `${guTabBar()}<div class="gu-grid gu-grid--${tab}"><div class="gu-main">${parts[0]()}</div><div class="gu-side">${parts[1]()}</div></div>`;
}
function guHead(title, strap) {
  return `<div class="gu-head"><h2 class="gu-title">${escapeHtml(title)}</h2><span class="gu-strap">${escapeHtml(strap)}</span></div>`;
}
function guOpt(label, on, action, attrs, off) {
  return `<button type="button" class="gu-opt${on ? ' on' : ''}" data-mnyp-action="${action}"${attrs || ''}${off ? ' disabled aria-disabled="true"' : ''}>${escapeHtml(label)}</button>`;
}
function guVal(label) { return `<span class="gu-opt gu-optval">${escapeHtml(label)}</span>`; }
function guFormRow(q, opts) {
  return `<div class="gu-formrow"><span class="gu-q">${escapeHtml(q)}</span><div class="gu-opts">${opts}</div></div>`;
}

/* ════════════ ✅ APPROVE ════════════ */
/* What the queue shows: every open question, every yes Sunday has not used,
   and anything answered in the last 7 days — so an answer stays on screen
   long enough to be undone, and the queue does not grow for ever. */
function guQueue() {
  const since = Date.now() - 7 * 864e5;
  const out = [];
  GU_KIDS.forEach(kid => mnyRequestsFor(kid).forEach(q => {
    const keep = q.open || (q.store === 'requests' && q.status === 'yes' && !q.applied)
      || (q.answeredAt && q.answeredAt >= since);
    if (keep) out.push(Object.assign({ kid }, q));
  }));
  return out.sort((a, b) => a.askedAt - b.askedAt);
}
/* 🏆 What the rules pay for a result she told, and the line that says why —
   the prototype's compCalc, against the rules of the meet's own day. */
function guCompCalc(r) {
  if (!r.sport) return { amt: 0, line: 'Older request: check what she says above.' };
  const rules = mrRulesFor(r.dayKey || todayKey());
  const c = rules.competition || {};
  const races = r.races || [];
  const pts = races.length ? races.reduce((a, x) => a + (Number(x.pts) || 0), 0) : (Number(r.pts) || 0);
  const amt = mrScoreCompetition({ sport: r.sport, points: pts, placement: { group: r.grp || null, overall: r.ovr || null },
                                   qualified: !!r.qualified, provincial: !!r.provincial }, rules);
  if (r.sport === 'swim') {
    const sw = c.swim || {}, rate = r.provincial ? sw.provincialPerPoint : sw.perPoint;
    return { amt, line: races.map(x => `${x.ev}${x.time ? ' ' + x.time : ''} · ${Number(x.pts) || 0} pts`).join(' | ')
      + `. ${pts} pts × ${guMoney$(rate)}${r.qualified ? ` + ${guMoney$(sw.qualifyBonus)} qualifying` : ''}.` };
  }
  const pl = (c.skate || {}).placement || {};
  const G = Number((pl.group || {})[r.grp]) || 0, O = Number((pl.overall || {})[r.ovr]) || 0;
  return { amt, line: `Group ${rqOrd(r.grp)} ${guMoney$(G)} · overall ${rqOrd(r.ovr)} ${guMoney$(O)} · ${pts} pts × ${guMoney$((c.skate || {}).perPoint)}.` };
}
/* A disputed fine: what saying yes gives back — what that one fine costs. */
function guDisputeAmount(kid, r) {
  const f = mrFines(kid).find(x => x && x.id === r.fineId);
  if (!f) return 0;
  const wk = ctWeekKeyForDate(f.dayKey);
  return money2((mrFinesWeek(wk, kid, null).chargeable || {})[f.id] || 0);
}
function guCardValues(q) {
  const r = q.record || {}, kid = q.kid;
  const rules = mrRules();
  const cc = q.kind === 'comp' ? guCompCalc(r) : null;
  const ruleAmt = cc ? cc.amt : q.kind === 'dispute' ? guDisputeAmount(kid, r) : q.amount;
  const amt = cc && r.pay != null ? money2(r.pay) : ruleAmt;
  const to = r.to;
  const rulesLine = q.kind === 'goal'
      ? `${r.icon || '🎯'} ${r.name} · ${guMoney$(r.target)}. ${r.keep === 'ready' ? 'Money in her old jar goes to Savings.' : 'Money in her old jar moves to the new goal.'} The jar earns no interest.`
    : q.kind === 'comp' ? `${r.custom ? 'Not on the planner yet. ' : ''}${cc.line}${r.pay != null && money2(r.pay) !== money2(cc.amt) ? ` You made it ${guMoney$(r.pay)}.` : ''}`
    : q.kind === 'gift' ? 'Gifts go straight into her payday once you say yes.'
    : q.kind === 'move' ? `Her reason: “${r.note || '—'}”.${to === 'locked' ? ` Locked for ${Number(mrRuleOr(rules, 'pots.lockWeeks')) || 4} weeks once moved.` : to === 'cash' ? ' Hand her the cash on Sunday. It leaves the bank.' : to === 'wall' ? ` Nothing moves now: on Sunday it goes on her wall as extra, each $1 counting ${guMoney$(1 + (Number(mrRuleOr(rules, 'loan.extraBonusPct')) || 0) / 100)}.` : ''}`
    : q.kind === 'deposit' ? 'Cash from home goes into the bank. Count it with her on Sunday.'
    : q.kind === 'adv' ? `Cash now; it comes off Sunday’s payday. Her limit is ${guMoney$(mrRuleOr(rules, 'advance.maxPerWeek'))} a week.`
    : q.kind === 'skip' ? 'Yes marks it missed on Sunday. It pays $0. It is not a fine.'
    : `Yes gives back ${mnyMoney(amt)} in Sunday’s payday.`;
  const fromName = { ready: 'Savings', locked: 'Locked away', invest: 'Companies', cash: 'cash' }[r.from] || r.from;
  const check = q.kind === 'goal' ? '🔎 Is it something she really wants? Is the price right?'
    : q.kind === 'comp' ? '🔎 Check the results sheet: every race and score'
    : q.kind === 'gift' ? '🔎 Did the money actually arrive?'
    : q.kind === 'move' ? `🔎 She has it in ${fromName}?`
    : q.kind === 'deposit' ? '🔎 Count the cash'
    : q.kind === 'adv' ? '🔎 Is it for something this week?'
    : q.kind === 'skip' ? '🔎 Let the coach know'
    : '🔎 Whose was it, and what does she say happened?';
  const yesLabel = q.kind === 'goal' ? '✓ Set it' : q.kind === 'deposit' ? '✓ Got the cash' : q.kind === 'adv' ? '✓ Give her the cash'
    : q.kind === 'move' ? (to === 'cash' ? '✓ Hand it over' : to === 'wall' ? '✓ On the wall Sunday' : '✓ Move it') : q.kind === 'dispute' ? '✓ Give it back'
    : q.kind === 'skip' ? '✓ OK, mark missed' : '✓ Yes, pay it';
  const after = q.status === 'yes'
    ? (q.kind === 'goal' ? 'jar switches Sunday' : q.kind === 'adv' ? 'comes off Sunday' : q.kind === 'move' ? (to === 'wall' ? 'on the wall Sunday' : 'moves before Sunday') : 'in Sunday’s payday')
    : q.status === 'talk' ? 'still blocks payday' : 'she sees “not this time”';
  return { amt, ruleAmt, rulesLine, check, yesLabel, after,
           amtLabel: q.kind === 'skip' ? '⛸️' : guMoney$(amt),
           stamp: { yes: '✓ YES', no: '✗ NO', talk: '💬 TALK' }[q.status] || '' };
}
function guApproveCard(q) {
  const v = guCardValues(q);
  const st = q.status || 'open';
  const ids = ` data-mnyp-id="${escapeAttr(q.id)}" data-mnyp-kid="${q.kid}"`;
  /* As drawn: ✓ / 💬 / ✗ while nobody has answered; once answered — "let's
     talk" included, which still blocks payday and still counts on the tab —
     the stamp and ↺ Undo, which puts the question back to waiting. */
  const adj = !q.status && q.kind === 'comp';
  const buttons = !q.status ? `<div class="gu-answer">
      <button type="button" class="gu-yes" data-mnyp-action="guyes"${ids}>${escapeHtml(v.yesLabel)}</button>
      <button type="button" class="gu-talk" data-mnyp-action="gutalk"${ids}>💬 Talk first</button>
      <button type="button" class="gu-no" data-mnyp-action="guno"${ids}>✗ No</button>
    </div>` : '';
  const done = q.status ? `<div class="gu-done">
      <span class="gu-stamp ${'gu-stamp--' + st}">${escapeHtml(v.stamp)}</span>
      <span class="gu-after">${escapeHtml(v.after)}</span>
      <button type="button" class="gu-undo" data-mnyp-action="guundo"${ids}>↺ Undo</button>
    </div>` : '';
  return `<div class="gu-req ${'gu-req--' + st}">
      <div class="gu-req-top">${guKidChip(q.kid)}<span class="gu-kind">${escapeHtml(GU_KIND_LABEL[q.kind] || q.kind)}</span>
        <span class="gu-amt">${adj ? `<button type="button" class="gu-step" data-mnyp-action="gupay" data-mnyp-d="-1"${ids} aria-label="One dollar less">−</button>` : ''}<b>${escapeHtml(v.amtLabel)}</b>${adj ? `<button type="button" class="gu-step" data-mnyp-action="gupay" data-mnyp-d="1"${ids} aria-label="One dollar more">+</button>` : ''}</span></div>
      <div class="gu-req-text">${escapeHtml(q.icon)} ${escapeHtml(q.text)}</div>
      <div class="gu-req-rules">${escapeHtml(v.rulesLine)}</div>
      <div class="gu-check">${escapeHtml(v.check)}</div>
      ${buttons}${done}
    </div>`;
}
function guApproveMain() {
  const queue = guQueue();
  return `${guHead('✅ Waiting for you', 'Nothing pays until it passes here.')}
    <div class="gu-cards2">${queue.map(guApproveCard).join('')}</div>
    ${queue.length ? '' : `<div class="gu-empty">Nothing waiting. When they tap 🏆 or 🔀 on My money, it lands here.</div>`}`;
}
/* "This Sunday", per girl: what still waits, what a yes adds to her payday,
   and what moves. Yes answers Sunday has not used (requests), or answered
   this week (a move or cash from home moves at the yes). */
function guSundayCard(kid) {
  const monday = formatDayKey(ctThisWeekKey()).getTime();
  const mine = mnyRequestsFor(kid);
  const wait = mine.filter(q => q.open).length;
  const yes = mine.filter(q => q.status === 'yes'
    && (q.store === 'requests' ? !q.applied : (q.answeredAt || 0) >= monday));
  const adds = money2(yes.filter(q => ['move', 'adv', 'deposit', 'skip', 'goal'].indexOf(q.kind) < 0)
    .reduce((a, q) => a + guCardValues(Object.assign({ kid }, q)).amt, 0));
  const moves = yes.filter(q => ['move', 'adv', 'deposit'].indexOf(q.kind) >= 0).map(q => q.text);
  return `<div class="gu-card gu-sun ${wait ? 'gu-sun--wait' : 'gu-sun--ok'}">
      <div class="gu-cardhead"><span class="gu-cardtitle">${escapeHtml(mnyKidName(kid))}</span>
        <span class="gu-sun-status">${wait ? `⏳ ${wait} to answer` : '✓ payday can open'}</span></div>
      <div class="gu-sun-adds">${adds ? `+${guMoney$(adds)} added to her payday` : 'Nothing added on top of chores.'}</div>
      <div class="gu-sun-moves">${escapeHtml(moves.length ? moves.join(' · ') : 'No moves.')}</div>
    </div>`;
}
function guWobblePct() { return Number(mrRuleOr(mrRules(), 'market.wobblePct')) || 0; }
function guApproveSide() {
  const on = guWobblePct() > 0;
  const pct = on ? guWobblePct() : 2;
  return `<div class="gu-sidehead">This Sunday</div>
    ${GU_KIDS.map(guSundayCard).join('')}
    <div class="gu-card gu-wobble">
      <div class="gu-cardhead"><span class="gu-cardtitle">📉 Market wobble</span>
        <button type="button" class="gu-toggle${on ? ' on' : ''}" aria-pressed="${on}" data-mnyp-action="guwobble">${on ? 'On this week' : 'Off'}</button></div>
      <div class="gu-line">${on ? `Companies show −${pct}% this Sunday. Ask her: “Do you sell, or wait?”`
        : `Turn on to show companies dipping ${pct}% this Sunday — practice for a real drop.`}</div>
    </div>`;
}
/* 📉 On or off for this Sunday: a rule (`market.wobblePct`, 0 or 2), through
   the one versioned writer, from this week's Monday — the house rules' date
   (`mrHouseRulesFrom`), which refuses when a change is already scheduled
   ahead, so a version is never dated in front of one cloned from it. */
function guSetWobble(on) {
  if (!isParent()) { showToast('Only parents can change the money rules 🔒'); return false; }
  const from = mrHouseRulesFrom();
  if (!from) { showToast('A rules change is already scheduled — turn the wobble on once it starts.'); return false; }
  const v = mrApplyEdits([{ path: 'market.wobblePct', value: on ? 2 : 0, label: '📉 Market wobble' }],
    { reason: 'grownups', effectiveFrom: from });
  return !!v;
}

/* ════════════ ➕ COMMITMENTS ════════════ */
function guCommit() {
  if (!guCommitDraft) guCommitDraft = { type: 'commit', kid: 'jenn', what: '', cost: 60, share: 50, weeks: 26 };
  return guCommitDraft;
}
function guCommitKidCard(kid) {
  const debts = mnyEnsureDebts(kid).slice()
    .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
  const left = money2(debts.reduce((a, d) => a + loanBalance(kid, d.id), 0));
  const weekly = guWeeklyLoan(kid), steady = guSteady(kid);
  const rows = debts.map((d, i) => {
    const owe = loanBalance(kid, d.id), p = money2(d.principal);
    const w = p > 0 ? Math.max(0, Math.min(100, (p - Math.max(0, p - money2(d.paid))) / p * 100)) : 100;
    return `<div class="gu-loanrow"><div class="gu-loanrow-top"><span>${i + 1}. ${escapeHtml(d.icon || '')} ${escapeHtml(d.name)}</span>
        <b>${owe <= 0.005 ? '✓ done' : `${mnyMoney(owe)} of ${mnyMoney(p)}`}</b></div>
        <div class="gu-bar"><div class="gu-bar-fill" style="width:${Math.round(w)}%"></div></div></div>`;
  }).join('');
  return `<div class="gu-card ${'gu-tint--' + kid}">
      <div class="gu-cardhead"><span class="gu-cardtitle">${escapeHtml(mnyKidName(kid))}</span><b class="gu-fig">${mnyMoney(left)} left</b></div>
      <div class="gu-line">${mnyMoney(weekly)} a week · ${steady > 0 ? Math.round(weekly / steady * 100) + '%' : '—'} of steady ${mnyMoney(steady)}</div>
      ${rows || '<div class="gu-line">Nothing on her wall.</div>'}
    </div>`;
}
function guCommitMath() {
  const c = guCommit(), kid = c.kid;
  const sur = c.type === 'surprise';
  const safety = money2(mrRuleOr(mrRules(), 'pots.safety'));
  const her = money2(c.cost * c.share / 100);
  const down = Math.round(her * 10) / 100;
  const added = money2(her - down);
  const p0 = guWeeklyLoan(kid), p1 = money2(p0 + added / c.weeks);
  const steady = guSteady(kid);
  const r0 = steady > 0 ? p0 / steady * 100 : Infinity, r1 = steady > 0 ? p1 / steady * 100 : Infinity;
  const leftNow = mnyTotalOwing(kid);
  const sav = mnySavedTotal(kid);
  const fromSafe = money2(Math.min(c.cost, sav)), borrow = money2(c.cost - fromSafe);
  return { c, kid, sur, safety, her, down, added, p0, p1, r0, r1, leftNow, sav, fromSafe, borrow,
           okAff: r1 <= 50, okDown: sav - down >= safety };
}
function guPct(v) { return isFinite(v) ? Math.round(v) + '%' : '—'; }
function guCommitMain() {
  const c = guCommit(), sur = c.type === 'surprise';
  const rows = [
    guFormRow('Type', guOpt('🆕 Commitment', !sur, 'gucmtype', ' data-mnyp-id="commit"') + guOpt('🌧️ Surprise cost', sur, 'gucmtype', ' data-mnyp-id="surprise"')),
    guFormRow('For', GU_KIDS.map(k => guOpt(mnyKidName(k), c.kid === k, 'gucmkid', ` data-mnyp-id="${k}"`)).join('')),
    guFormRow('Cost', guOpt('−', false, 'gucmcost', ' data-mnyp-d="-5" aria-label="Five dollars less"') + guVal('$' + c.cost) + guOpt('+', false, 'gucmcost', ' data-mnyp-d="5" aria-label="Five dollars more"')),
  ];
  if (!sur) {
    rows.push(guFormRow('Her share', guOpt('−', false, 'gucmshare', ' data-mnyp-d="-5" aria-label="Less"') + guVal(c.share + '%')
      + guOpt('+', false, 'gucmshare', ' data-mnyp-d="5" aria-label="More"')
      + [25, 50, 75, 100].map(p => guOpt(p + '%', c.share === p, 'gucmshareset', ` data-mnyp-id="${p}"`)).join('')));
    rows.push(guFormRow('Pay it over', guOpt('−', false, 'gucmweeks', ' data-mnyp-d="-1" aria-label="A week less"')
      + guVal(c.weeks + (c.weeks === 1 ? ' week' : ' weeks'))
      + guOpt('+', false, 'gucmweeks', ' data-mnyp-d="1" aria-label="A week more"')
      + [[13, '3 months'], [26, '6 months'], [52, '1 year']].map(([w, l]) => guOpt(l, c.weeks === w, 'gucmweeksset', ` data-mnyp-id="${w}"`)).join('')));
  }
  return `${guHead('➕ Commitments', 'Each one is its own row on her wall, paid oldest first.')}
    <div class="gu-cards2">${GU_KIDS.map(guCommitKidCard).join('')}</div>
    <div class="gu-card gu-form">
      <div class="gu-cardtitle">${sur ? '🌧️ Surprise cost' : '🆕 New commitment'}</div>
      <input class="gu-input" type="text" value="${escapeAttr(c.what)}" data-mnyp-action="gucmwhat"
        placeholder="${sur ? 'what happened · e.g. lost swim goggles' : 'what it is · e.g. Winter Invitational entry'}" aria-label="What it is">
      ${rows.join('')}
    </div>
    ${guClubCard()}
    ${guOneOffCard()}`;
}
function guCommitSide() {
  const m = guCommitMath();
  const lines = m.sur
    ? [['Cost', mnyMoney(m.c.cost)], ['Her 🛟 Savings now', mnyMoney(m.sav)], ['Paid from Savings', mnyMoney(m.fromSafe)], ['New row on her wall', mnyMoney(m.borrow)]]
    : [['Her share', mnyMoney(m.her)],
       ['10% down from her Savings', mnyMoney(m.down) + (m.okDown ? '' : ` ⚠️ under 🛟 ${guMoney$(m.safety)}`)],
       ['New row on her wall', mnyMoney(m.added)],
       ['Weekly loan payment', `${mnyMoney(m.p0)} → ${mnyMoney(m.p1)}`],
       ['Of her steady income', `${guPct(m.r0)} → ${guPct(m.r1)}`],
       ['Free by', `${guFreeBy(m.leftNow, m.p0)} → ${guFreeBy(m.leftNow + m.added, m.p1)}`]];
  const verdict = m.sur
    ? (m.borrow ? `🛟 Not quite enough. ${mnyMoney(m.borrow)} goes on her wall.` : '✅ Her safety money covers it. That is what it is for.')
    : m.okAff ? '✅ Fits under the 50% limit.' : '⚠️ Over the 50% limit. Try a smaller share, a longer time, or wait for row 1 to finish.';
  const good = m.sur ? !m.borrow : m.okAff;
  const can = !!String(m.c.what || '').trim();
  return `<div class="gu-sidehead">${m.sur ? 'Is her safety money enough?' : 'Can she afford it?'}</div>
    <div class="gu-card gu-afford ${good ? 'gu-afford--ok' : 'gu-afford--warn'}">
      ${lines.map(([k, v]) => `<div class="gu-kv"><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`).join('')}
      <div class="gu-verdict">${escapeHtml(verdict)}</div>
      <button type="button" class="gu-save${can ? ' ready' : ''}" data-mnyp-action="gucmsave">${m.sur ? 'Send her the 🌧️ card' : 'Add to her wall'}</button>
      <div class="gu-line">${m.sur ? 'Not a fine: nobody did anything wrong. 🛟 Savings pays first; the rest becomes a row on her wall. Savings refills first after.'
        : 'Her weekly payment goes up from next Sunday. Her 10% down comes out of Savings.'}</div>
    </div>`;
}
function guSaveCommit() {
  const c = guCommit();
  if (!String(c.what || '').trim()) { showToast(c.type === 'surprise' ? 'What happened?' : 'What is it for?'); return; }
  const rec = c.type === 'surprise'
    ? mnyAddSurprise(c.kid, { what: c.what, cost: c.cost })
    : mnyAddCommitment(c.kid, { what: c.what, cost: c.cost, sharePct: c.share, weeks: c.weeks });
  if (!rec) return;
  showToast(c.type === 'surprise'
    ? (rec.covered ? '🛟 Her Savings covered it' : `🌧️ ${mnyMoney(rec.principal)} on ${mnyKidName(c.kid)}'s wall`)
    : `🆕 On ${mnyKidName(c.kid)}'s wall`);
  c.what = '';
}
/* 🧾 The club pays the assistant job twice a year; this is what it owes Dad
   (mnyClubOwes, derived), and "✓ Club paid" moves the date it is paid
   through to her latest settled week (mnySetClubPaid). */
function guClubCard() {
  const rows = GU_KIDS.map(kid => {
    const o = mnyClubOwes(kid);
    const since = o.since ? 'since ' + mnyShortDate(o.since) : 'so far';
    return `<div class="gu-clubrow"><span>${guKidChip(kid)} Club owes Dad <b>${mnyMoney(o.amount)}</b> · ${o.sessions} session${o.sessions === 1 ? '' : 's'} ${escapeHtml(since)}</span>
      <button type="button" class="gu-btn" data-mnyp-action="guclubpaid" data-mnyp-kid="${kid}"${o.weeks ? '' : ' aria-disabled="true"'}>✓ Club paid</button></div>`;
  }).join('');
  return `<div class="gu-card gu-club"><div class="gu-cardtitle">🧾 Club owes</div>${rows}
    <div class="gu-line">The club pays the assistant job twice a year; Dad pays her every Sunday. Nothing in her money moves when the club pays.</div></div>`;
}
function guClubPaid(kid) {
  const rows = mnyLedgerRows(kid);
  if (!rows.length || !mnyClubOwes(kid).weeks) { showToast('Nothing owed for club sessions yet.'); return; }
  if (mnySetClubPaid(kid, rows[0].weekKey)) showToast(`🧾 Club paid through the week of ${mnyShortDate(rows[0].weekKey)}`);
}
/* ➕ One club session that is not on her planner (D1): a grown-up places the
   ⛸️ Assistant job on a day this week, through the one block placer. */
function guOneOff() {
  if (!guOneOffDraft) {
    const today = mrWeekDayKeys(ctThisWeekKey()).indexOf(todayKey());
    guOneOffDraft = { kid: 'jenn', dayIdx: today < 0 ? 0 : today, startMin: 17 * 60 };
  }
  return guOneOffDraft;
}
function guOneOffCard() {
  const o = guOneOff();
  const t = formatTimeFromMin(o.startMin);
  return `<div class="gu-card gu-form">
      <div class="gu-cardtitle">➕ One-off club session</div>
      ${guFormRow('For', GU_KIDS.map(k => guOpt(mnyKidName(k), o.kid === k, 'gu1kid', ` data-mnyp-id="${k}"`)).join(''))}
      ${guFormRow('Day', GU_DAY_NAMES.map((d, i) => guOpt(d, o.dayIdx === i, 'gu1day', ` data-mnyp-id="${i}"`)).join(''))}
      ${guFormRow('Starts', guOpt('−', false, 'gu1time', ' data-mnyp-d="-30" aria-label="Half an hour earlier"') + guVal(t) + guOpt('+', false, 'gu1time', ' data-mnyp-d="30" aria-label="Half an hour later"'))}
      <button type="button" class="gu-save ready" data-mnyp-action="gu1place">⛸️ Put it on her planner</button>
      <div class="gu-line">It pays like any club session she goes to; Sunday asks whether she went.</div>
    </div>`;
}
function guPlaceOneOff() {
  if (!isParent()) { showToast('A grown-up places this 🔒'); return null; }
  const o = guOneOff();
  const dayKey = mrWeekDayKeys(ctThisWeekKey())[o.dayIdx];
  const act = findActivity('assistant_job', o.kid);
  if (!act || !dayKey) { showToast('There is no ⛸️ Assistant job activity to place.'); return null; }
  const draft = activityPlacementDraft(act);
  const fields = { durationMin: draft.durationMin };
  ['travelBuffer', 'travelBufMin', 'getReadyBuffer', 'getReadyBufMin', 'warmupBuffer', 'warmupBufMin', 'tag', 'gearState']
    .forEach(k => { if (draft[k] !== undefined) fields[k] = draft[k]; });
  const b = mrPlaceActivityBlock(o.kid, 'assistant_job', dayKey, o.startMin, fields);
  if (b) showToast(`⛸️ On ${mnyKidName(o.kid)}'s ${GU_DAY_NAMES[o.dayIdx]}`);
  return b;
}

/* ════════════ 📦 FINES (deviation #2: the app's catalog) ════════════
   Plan v5 Deviation 23: a Day row, Mon–Sun of this week, today chosen first
   and the days still to come disabled — each fine is attached to its day.
   A back-dated one is placed by `mrFinesWeek` (day, then `at`), so the free
   repeats and the standing stay right. */
function guFineItems() { return ((mrRulesForWeek(ctThisWeekKey()).fines) || {}).items || []; }
// Today's place in this week (Mon 0 … Sun 6); the last day it may be.
function guTodayIdx() {
  const i = mrWeekDayKeys(ctThisWeekKey()).indexOf(todayKey());
  return i < 0 ? 6 : i;
}
function guFine() {
  if (!guFineDraft) {
    guFineDraft = { kid: 'jenn', itemId: (guFineItems()[0] || {}).id || '', dayIdx: guTodayIdx(), who: 'Dad' };
  }
  // A draft kept from an earlier day never points past today.
  if (guFineDraft.dayIdx > guTodayIdx()) guFineDraft.dayIdx = guTodayIdx();
  return guFineDraft;
}
/* "1 of 2 free · the next one costs $1" — mrFineStanding's numbers, said. */
function guStandingLine(st) {
  if (!(st.free > 0)) return `costs ${guMoney$(st.amount)} every time`;
  return `${Math.min(st.count, st.free)} of ${st.free} free · the next one ${st.nextCosts > 0 ? 'costs ' + guMoney$(st.nextCosts) : 'is free'}`;
}
function guFineLabel(itemId) {
  const it = guFineItems().find(x => x && x.id === itemId);
  return it ? it.label : itemId;
}
function guFinesThisWeek(kid) {
  const wk = ctThisWeekKey();
  const keys = mrWeekDayKeys(wk);
  const chargeable = mrFinesWeek(wk, kid, null).chargeable || {};
  return mrFines(kid).filter(f => f && keys.indexOf(f.dayKey) >= 0)
    .slice().sort((a, b) => String(a.dayKey).localeCompare(String(b.dayKey)) || (Number(a.at) || 0) - (Number(b.at) || 0))
    .map(f => ({ f, day: GU_DAY_NAMES[keys.indexOf(f.dayKey)], what: guFineLabel(f.itemId), who: f.who || '',
                 amt: money2(chargeable[f.id] || 0) }));
}
function guFinesMain() {
  const f = guFine(), wk = ctThisWeekKey();
  const items = guFineItems();
  const st = mrFineStanding(wk, f.kid, f.itemId);
  const next = st.nextCosts > 0 ? '−' + mnyMoney(st.nextCosts) : 'free';
  const kidCard = (kid) => {
    const list = guFinesThisWeek(kid);
    const total = money2(list.reduce((a, x) => a + x.amt, 0));
    const logged = [...new Set(list.map(x => x.f.itemId))];
    return `<div class="gu-card ${'gu-tint--' + kid}">
        <div class="gu-cardhead"><span class="gu-cardtitle">${escapeHtml(mnyKidName(kid))} · this week</span><b class="gu-fig gu-fig--fine">−${mnyMoney(total)}</b></div>
        ${list.map(x => `<div class="gu-finerow"><b>${escapeHtml(x.day)}</b><span class="gu-ellip">${escapeHtml(x.what)}${x.who ? ' · ' + escapeHtml(x.who) : ''}</span>
          <b class="gu-num">${x.amt > 0 ? '−' + mnyMoney(x.amt) : 'free'}</b>
          <button type="button" class="gu-x" data-mnyp-action="gufinedel" data-mnyp-kid="${kid}" data-mnyp-id="${escapeAttr(x.f.id)}" aria-label="Take this fine off">✕</button></div>`).join('')}
        ${list.length ? '' : '<span class="gu-line">Nothing logged this week. 🎉</span>'}
        ${logged.map(id => `<span class="gu-line">${escapeHtml(guFineLabel(id))}: ${escapeHtml(guStandingLine(mrFineStanding(wk, kid, id)))}</span>`).join('')}
      </div>`;
  };
  return `${guHead('📦 Fines', 'Log it when it happens. She sees when, what and who on Sunday.')}
    <div class="gu-card gu-form">
      <div class="gu-cardhead"><span class="gu-cardtitle">➕ Log a fine</span><b class="gu-fig gu-fig--fine">${escapeHtml(next)}</b></div>
      ${guFormRow('For', GU_KIDS.map(k => guOpt(mnyKidName(k), f.kid === k, 'gufnkid', ` data-mnyp-id="${k}"`)).join(''))}
      ${guFormRow('What', items.map(it => guOpt(it.label, f.itemId === it.id, 'gufnitem', ` data-mnyp-id="${escapeAttr(it.id)}"`)).join(''))}
      ${guFormRow('Day', GU_DAY_NAMES.map((d, i) => guOpt(d, f.dayIdx === i, 'gufnday', ` data-mnyp-id="${i}"`, i > guTodayIdx())).join(''))}
      ${guFormRow('Logged by', ['Mom', 'Dad'].map(w => guOpt(w, f.who === w, 'gufnwho', ` data-mnyp-id="${w}"`)).join(''))}
      <div class="gu-line">${escapeHtml(mnyKidName(f.kid))} · ${escapeHtml(guFineLabel(f.itemId))}: ${escapeHtml(guStandingLine(st))}</div>
      <div class="gu-remind">Log every one, even a free one. The free ones are still on her record, and she sees each one on Sunday.</div>
      <button type="button" class="gu-save ready gu-save--end" data-mnyp-action="gufnsave">📦 Log it</button>
    </div>
    <div class="gu-cards2">${GU_KIDS.map(kidCard).join('')}</div>`;
}
function guFinesSide() {
  const see = GU_KIDS.map(kid => {
    const list = guFinesThisWeek(kid);
    const total = money2(list.reduce((a, x) => a + x.amt, 0));
    const note = list.length
      ? `${[...new Set(list.map(x => x.day))].join(' + ')} · ${[...new Set(list.map(x => x.what))].join(' · ')}${list.some(x => x.who) ? ' · ' + [...new Set(list.map(x => x.who).filter(Boolean))].join(' + ') + ' logged' : ''}`
      : 'no fines this week 🎉';
    return `<div class="gu-see"><div class="gu-cardhead"><span>${escapeHtml(mnyKidName(kid))} · 📦 Fines</span><b class="gu-fig gu-fig--fine">−${mnyMoney(total)}</b></div>
      <span class="gu-line">${escapeHtml(note)}</span></div>`;
  }).join('');
  return `<div class="gu-sidehead">What she sees on Sunday</div>${see}
    <div class="gu-card gu-plain">It shows under ➖ Taken off on her payday. If she thinks it's wrong, she can dispute it from My money, and it lands in ✅ Approve.</div>`;
}
function guLogFine() {
  const f = guFine();
  const dayKey = mrWeekDayKeys(ctThisWeekKey())[f.dayIdx];
  if (!f.itemId || !dayKey) { showToast('What for?'); return; }
  if (mrAddFine(f.kid, f.itemId, dayKey, { who: f.who })) showToast(`📦 Logged for ${mnyKidName(f.kid)}`);
}

/* ════════════ 🎁 EXPECTED ════════════ */
function guMonthKey(i) {
  const d = formatDayKey(todayKey());
  const m = new Date(d.getFullYear(), d.getMonth() + i, 1);
  return m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0');
}
function guMonthShort(key) {
  const [y, m] = String(key).split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}
function guExpectRows(kid) {
  const window5 = [0, 1, 2, 3, 4].map(guMonthKey);
  return mnyEnsureExpected(kid).filter(e => e && window5.indexOf(e.month) >= 0)
    .slice().sort((a, b) => String(a.month).localeCompare(String(b.month)) || (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
}
function guExpectMain() {
  const cards = GU_KIDS.map(kid => {
    const rows = guExpectRows(kid);
    const total = money2(rows.reduce((a, e) => a + money2(e.amount), 0));
    const ids = (e) => ` data-mnyp-kid="${kid}" data-mnyp-id="${escapeAttr(e.id)}"`;
    return `<div class="gu-card ${'gu-tint--' + kid}">
        <div class="gu-cardhead"><span class="gu-cardtitle">${escapeHtml(mnyKidName(kid))}</span><span class="gu-line">next 5 months</span><b class="gu-fig">≈ ${guMoney$(total)}</b></div>
        ${rows.map(e => `<div class="gu-exrow"><span class="gu-ellip">${escapeHtml(e.label)}</span>
          <span class="gu-pair"><button type="button" class="gu-step" data-mnyp-action="guexmon" data-mnyp-d="-1"${ids(e)} aria-label="A month earlier">◀</button><b class="gu-num">${escapeHtml(guMonthShort(e.month))}</b><button type="button" class="gu-step" data-mnyp-action="guexmon" data-mnyp-d="1"${ids(e)} aria-label="A month later">▶</button></span>
          <span class="gu-pair"><button type="button" class="gu-step" data-mnyp-action="guexamt" data-mnyp-d="-5"${ids(e)} aria-label="Five dollars less">−</button><b class="gu-num">${guMoney$(e.amount)}</b><button type="button" class="gu-step" data-mnyp-action="guexamt" data-mnyp-d="5"${ids(e)} aria-label="Five dollars more">+</button></span>
          <button type="button" class="gu-x" data-mnyp-action="guexdel"${ids(e)} aria-label="Take this off">✕</button></div>`).join('')}
        <div class="gu-adds"><span class="gu-line">➕ add</span>${GU_EXPECT_ADDS.map(([l, a], i) =>
          `<button type="button" class="gu-addchip" data-mnyp-action="guexadd" data-mnyp-kid="${kid}" data-mnyp-id="${i}">${escapeHtml(l)}</button>`).join('')}</div>
      </div>`;
  }).join('');
  return `${guHead('🎁 Expected money', 'Your guess, for her timeline. Real money still comes in as a request.')}${cards}`;
}
function guExpectSide() {
  return `<div class="gu-sidehead">Where it shows</div>
    <div class="gu-card gu-plain gu-stack">
      <span>📅 Her timeline on Signed: the 🎲 bonus part of each future month.</span>
      <span>🏠 My money · Coming up: gifts and holidays.</span>
      <span class="gu-line">Meets use her average per meet from the last 4. Change it here if a season is different.</span>
    </div>`;
}

/* ════════════ ⚙️ RULES ════════════ */
/* The rules as they stand for next Sunday (the newest version, every Sunday
   v15 path filled from the defaults), and the same with the pending list
   applied — what Save would make. */
function guSavedRules() { return mrSundayRules(guNextMonday()); }
function guPendingRules() {
  const R = mrDeepCopy(guSavedRules());
  mnyPending.forEach(p => mrSetPath(R, p.path, p.value));
  return R;
}
function guRuleRows() {
  const saved = guSavedRules();
  return GU_RULE_DEFS.map(([title, tint, rows]) => ({ title, tint, rows: rows.map(([path, label, unit, step, she]) => {
    const p = typeof path === 'function' ? path(saved) : path;
    return { path: p, label, unit, step, she };
  }) }));
}
function guFmt(unit, v) {
  const n = Number(v) || 0;
  return unit === 'st' ? 'Stage ' + n : unit === '%' ? n + '%' : guMoney$(n);
}
function guRulesMain() {
  const saved = guSavedRules(), R = guPendingRules();
  const sections = guRuleRows().map(sec => `<div class="gu-card gu-rulesec ${'gu-tint--' + sec.tint}">
      <div class="gu-cardtitle">${escapeHtml(sec.title)}</div>
      ${sec.rows.map(r => {
        const was = Number(mrGetPath(saved, r.path)) || 0, now = Number(mrGetPath(R, r.path)) || 0;
        const ch = was !== now;
        const she = (r.she ? r.she(now, R) : '') + (ch ? ` · was ${guFmt(r.unit, was)}` : '');
        const attrs = ` data-mnyp-path="${escapeAttr(r.path)}" data-mnyp-label="${escapeAttr(r.label)}"`;
        return `<div class="gu-rule"><div class="gu-rule-words"><span>${escapeHtml(r.label)}</span><span class="gu-she">${escapeHtml(she)}</span></div>
          <span class="gu-pair"><button type="button" class="gu-step" data-mnyp-action="gurule" data-mnyp-d="${-r.step}"${attrs} aria-label="Less">−</button>
          <b class="gu-ruleval${ch ? ' changed' : ''}">${escapeHtml(guFmt(r.unit, now))}</b>
          <button type="button" class="gu-step" data-mnyp-action="gurule" data-mnyp-d="${r.step}"${attrs} aria-label="More">+</button></span></div>`;
      }).join('')}
    </div>`).join('');
  return `${guHead('⚙️ Money rules', 'Changes start next Sunday. The girls see what changed.')}
    ${guSundayRulesCard()}
    <div class="gu-cards2 gu-rulegrid">${sections}</div>`;
}
/* A rulebook stored before Sunday v15 lacks the new paths; this offers them
   as one appended version (mrApplySundayRules), the house rules' way. A yes /
   no rule (the forgiving day) reads as a word, not "true". */
function guRuleWord(v) { return v == null ? '—' : v === true ? 'yes' : v === false ? 'no' : String(v); }
function guSundayRulesCard() {
  if (mrSundayRulesApplied()) return '';
  const pending = mrSundayRulesPending();
  if (!pending.length) return '';
  return `<div class="gu-card gu-plain">
      <div class="gu-cardtitle">☀️ The Sunday rules are not in this rulebook yet</div>
      ${pending.map(p => `<div class="gu-kv"><span>${escapeHtml(p.item)} — ${escapeHtml(p.field)}</span><b>${escapeHtml(guRuleWord(p.from))} → ${escapeHtml(guRuleWord(p.value))}</b></div>`).join('')}
      <div class="gu-line">Added as one dated change from this week's Monday. Nothing already lived is re-priced, and the family's own figures stay.</div>
      <button type="button" class="gu-save ready" data-mnyp-action="gusundayrules">Put ${pending.length === 1 ? 'it' : 'them'} into the rulebook</button>
    </div>`;
}
/* A typical week for the impact preview: her last 4 settled weeks, averaged —
   graded days, the streak, sessions — and last week's fines. */
function guTypicalWeek(kid, R) {
  const rows = mnyLedgerRows(kid).slice(0, 4);
  const n = rows.length || 1;
  const cap = Number(mrRuleOr(R, 'chores.dailyCap')) || 3;
  const avg = (k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0) / n;
  const last = formatDayKey(ctThisWeekKey()); last.setDate(last.getDate() - 7);
  const keys = mrWeekDayKeys(ctDateToKey(last));
  return {
    days: Math.round(avg('chores') / cap * 10) / 10,
    streakDays: avg('streak') > 0 ? 7 : 0,
    sessions: Math.round(avg('sessions') * 10) / 10,
    fines: mrFines(kid).filter(f => f && keys.indexOf(f.dayKey) >= 0).map(f => f.itemId),
    left: mnyTotalOwing(kid),
    monthly: money2(mnyEnsureDebts(kid).reduce((a, d) => a + (loanBalance(kid, d.id) > 0 ? money2(d.monthly) : 0), 0)),
  };
}
function guRulesSide() {
  const saved = guSavedRules(), R = guPendingRules();
  const kids = {};
  GU_KIDS.forEach(k => { kids[k] = guTypicalWeek(k, saved); });
  const impact = sdImpact(saved, R, kids, ctThisWeekKey());
  const changed = mnyPending.filter(p => JSON.stringify(mrGetPath(saved, p.path)) !== JSON.stringify(p.value));
  const def = (path) => {
    for (const sec of guRuleRows()) for (const r of sec.rows) if (r.path === path) return r;
    return null;
  };
  const said = (p) => {
    const d = def(p.path);
    return `${d ? d.label : p.label} ${d ? guFmt(d.unit, mrGetPath(saved, p.path)) : String(mrGetPath(saved, p.path))} → ${d ? guFmt(d.unit, p.value) : String(p.value)}`;
  };
  const log = mrLogEntries().slice(0, 5);
  return `<div class="gu-sidehead">What this changes</div>
    ${impact.map(k => `<div class="gu-card gu-impact"><div class="gu-cardtitle">${escapeHtml(mnyKidName(k.kid))}</div>
      ${k.rows.map(r => `<div class="gu-kv${r.changed ? ' changed' : ''}"><span>${escapeHtml(r.k)}</span><b>${escapeHtml(r.v)}</b></div>`).join('')}</div>`).join('')}
    <div class="gu-card gu-saverules">
      <div class="gu-line">${escapeHtml(changed.length ? `${changed.length} change${changed.length === 1 ? '' : 's'}: ${changed.map(said).join(' · ')}` : 'No changes yet. Tap − or + on any rule.')}</div>
      <div class="gu-saverow">
        <button type="button" class="gu-btn" data-mnyp-action="gurulediscard">↺ Undo</button>
        <button type="button" class="gu-save${changed.length ? ' ready' : ''}" data-mnyp-action="gurulesave">Save · starts next Sunday</button>
      </div>
      <div class="gu-cardtitle gu-logtitle">📝 Rule changes</div>
      ${log.map(e => `<div class="gu-log"><b>${escapeHtml(mnyShortDate(toDayKeyInZone(new Date(e.at))))}</b> ${escapeHtml(e.note || e.path)} ${escapeHtml(e.summary || `${e.from == null ? '—' : String(e.from)} → ${e.to == null ? '—' : String(e.to)}`)}</div>`).join('')
        || '<div class="gu-log">No changes yet.</div>'}
    </div>`;
}
function guStepRule(el) {
  const path = el.getAttribute('data-mnyp-path');
  const step = Number(el.getAttribute('data-mnyp-d')) || 0;
  const row = (() => { for (const sec of guRuleRows()) for (const r of sec.rows) if (r.path === path) return r; return null; })();
  if (!row) return;
  const cur = Number(mrGetPath(guPendingRules(), path)) || 0;
  const next = row.unit === 'st' ? Math.min(3, Math.max(1, cur + step)) : Math.max(0, Math.round((cur + step) * 100) / 100);
  if (path.indexOf('school.stagePct.') === 0) {
    const why = mnyStagePctRefusal({ [path.split('.').pop()]: next });
    if (why) { showToast(why); return; }
  }
  mnyQueueEdit(path, next, row.label);
}
/* "Save · starts next Sunday": the pending list as ONE version from next
   Monday (Plan v3 §C), through the same writer as every other rules page. */
function guSaveRules() {
  if (!mnyPending.length) { showToast('No changes yet. Tap − or + on any rule.'); return; }
  mnyPendingFrom = guNextMonday();
  mnyPendingReason = 'grownups';
  mnySavePending();
  mnyPendingReason = MR_DEFAULT_REASON;
}

/* ════════════ Taps and typing, handed over from js/24 ════════════ */
function guAction(a, el) {
  const id = el.getAttribute('data-mnyp-id');
  const kid = el.getAttribute('data-mnyp-kid');
  const d = Number(el.getAttribute('data-mnyp-d')) || 0;
  if (a === 'gutab') {
    if (id === 'more') mnyParentSection = guMoreSection;
    else if (guIsTab(id)) mnyParentSection = id;
    mnyRenderRulesTab();
    return;
  }
  // ✅ Approve
  if (a === 'guyes' || a === 'gutalk' || a === 'guno') {
    const r = mnyEnsureRequests(kid).find(x => x && x.id === id);
    const ans = a === 'guyes' ? 'yes' : a === 'gutalk' ? 'talk' : 'no';
    mnyAnswerRequest(kid, id, ans, r && r.pay != null ? { pay: r.pay } : {});
  } else if (a === 'guundo') {
    mnyReopenRequest(kid, id);
  } else if (a === 'gupay') {
    const r = mnyEnsureRequests(kid).find(x => x && x.id === id);
    if (r) mnySetRequestPay(kid, id, (r.pay != null ? money2(r.pay) : guCompCalc(r).amt) + d);
  } else if (a === 'guwobble') {
    guSetWobble(!(guWobblePct() > 0));
  // ➕ Commitments
  } else if (a === 'gucmtype') { guCommit().type = id === 'surprise' ? 'surprise' : 'commit';
  } else if (a === 'gucmkid') { guCommit().kid = id;
  } else if (a === 'gucmcost') { guCommit().cost = Math.max(5, guCommit().cost + d);
  } else if (a === 'gucmshare') { guCommit().share = Math.max(5, Math.min(100, guCommit().share + d));
  } else if (a === 'gucmshareset') { guCommit().share = Number(id) || 50;
  } else if (a === 'gucmweeks') { guCommit().weeks = Math.max(1, Math.min(104, guCommit().weeks + d));
  } else if (a === 'gucmweeksset') { guCommit().weeks = Number(id) || 26;
  } else if (a === 'gucmsave') { guSaveCommit();
  } else if (a === 'guclubpaid') { guClubPaid(kid);
  } else if (a === 'gu1kid') { guOneOff().kid = id;
  } else if (a === 'gu1day') { guOneOff().dayIdx = Math.max(0, Math.min(6, Number(id) || 0));
  } else if (a === 'gu1time') { guOneOff().startMin = Math.max(6 * 60, Math.min(21 * 60, guOneOff().startMin + d));
  } else if (a === 'gu1place') { guPlaceOneOff();
  // 📦 Fines
  } else if (a === 'gufnkid') { guFine().kid = id;
  } else if (a === 'gufnitem') { guFine().itemId = id;
  } else if (a === 'gufnday') { guFine().dayIdx = Math.max(0, Math.min(guTodayIdx(), Number(id) || 0));
  } else if (a === 'gufnwho') { guFine().who = id === 'Mom' ? 'Mom' : 'Dad';
  } else if (a === 'gufnsave') { guLogFine();
  } else if (a === 'gufinedel') { mrRemoveFine(kid, id);
  // 🎁 Expected
  } else if (a === 'guexadd') {
    const add = GU_EXPECT_ADDS[Number(id)];
    if (add) mnyAddExpected(kid, { month: guMonthKey(0), label: add[0], amount: add[1] });
  } else if (a === 'guexmon') {
    const e = mnyEnsureExpected(kid).find(x => x && x.id === id);
    const win = [0, 1, 2, 3, 4].map(guMonthKey);
    const at = e ? win.indexOf(e.month) : -1;
    if (e && at >= 0) mnyEditExpected(kid, id, { month: win[Math.max(0, Math.min(4, at + d))] });
  } else if (a === 'guexamt') {
    const e = mnyEnsureExpected(kid).find(x => x && x.id === id);
    if (e) mnyEditExpected(kid, id, { amount: Math.max(0, money2(e.amount) + d) });
  } else if (a === 'guexdel') { mnyRemoveExpected(kid, id);
  // ⚙️ Rules
  } else if (a === 'gurule') { guStepRule(el); return;
  } else if (a === 'gurulediscard') { mnyPending = []; mnyPendingFrom = null;
  } else if (a === 'gurulesave') { guSaveRules(); return;
  } else if (a === 'gusundayrules') {
    if (mrApplySundayRules()) showToast('✅ The Sunday rules are in the rulebook');
  } else {
    return;
  }
  mnyRenderRulesTab();
}
/* Typing never re-renders: the commitment's name goes into the draft, and the
   save button follows it in place. */
function guInput(a, el) {
  if (a !== 'gucmwhat') return;
  guCommit().what = String(el.value || '').slice(0, 40);
  const b = document.querySelector('#mnyRulesWrap [data-mnyp-action="gucmsave"]');
  if (b) b.classList.toggle('ready', !!guCommit().what.trim());
}
