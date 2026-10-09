// Weekly-Planner — 👨‍👩‍👧 Grown-ups: the parent's money screen (Sunday v15, Grown-ups v2).
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   GROWN-UPS (Plan v3 §A, docs/handoff/sunday-v15/Grown-ups v2 Screen.dc.html)

   Parent › Setup › 💰 Money (#ptab-money / #mnyRulesWrap) is this screen. Its
   sub-tab bar is the prototype's: ✅ Approve (N) · ➕ Commitments · 📦 Fines ·
   🎁 Expected · ⚙️ Rules — plus 📒 Weeks (past weeks, Plan v5 Deviation 16),
   with ✍️ Record and ? How this page works in the bar. ONE variable says where
   the screen is: `mnyParentSection` is one of these tab ids. The 📖 More tab
   and its eight old sections are retired (Stage 4b, Plan v5 §K/§L); every one
   has a home in a tab, and every route that named one now names its tab:

     💷 What things pay        ⚙️ Rules (🧹 Earning, 📘 Learning, 🌟 star
                                level, 📦 Fines, 🎯 Targets, 🛒 What money buys)
     📋 This week (overrides)  ✅ Approve › This Sunday (mnySetOverride)
     🎿 Loans                  ➕ Commitments (each row's facts, ✏️ Fix this row)
     📈 What she owns          ✅ Approve › What she owns (✏️ Fix what she
                                owns) and ⚙️ Rules › 🌱 Pots (the fund picker)
     🎓 Lessons                ⚙️ Rules › 🌱 Pots (ladder, open early, gates)
     📖 Week history           📒 Weeks; repair / meets / stream setup on
                                ✅ Approve while there is something to do
     👴 Grandfather rule       ⚙️ Rules › 👴 (start week, amount, start date);
                                its preview and credit on ✅ Approve
     🕰️ Change history         ⚙️ Rules › 📝 Rule changes (last 5, see all)

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

/* ✅ Approve left this bar for Parent › Now ("Waiting for you", Plan v9 §N,
   Deviation 36); the cards and the queue it drew are still here and Now
   draws them (guQueue, guApproveCard). */
const GU_TABS = [
  { id: 'commit', label: '➕ Commitments' },
  { id: 'fines', label: '📦 Fines' },
  { id: 'expect', label: '🎁 Expected' },
  { id: 'rules', label: '⚙️ Rules' },
  { id: 'weeks', label: '📒 Weeks' },
];
const GU_KIDS = ['jenn', 'jess'];
const GU_DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// The prototype's 🎁 add chips: [label, a guess in dollars].
const GU_EXPECT_ADDS = [['🎂 Birthday', 20], ['🎄 Christmas', 20], ['🧧 New Year', 50], ['🏆 Competition', 12]];
const GU_KIND_LABEL = { goal: 'wants a new goal', comp: 'says a result', gift: 'gift came in', move: 'asks to move',
                        dispute: 'disputes a fine', adv: 'wants to draw early', deposit: 'puts cash in',
                        skip: 'can’t make a session', cash: 'asks to cash out' };
const GU_WORDS_STAGE = { 1: 'earn · save · owe', 2: '+ income · interest · cash flow', 3: '+ assets · debt · net worth' };

/* ⚙️ Rules — the prototype's DEFS, row for row, each on its Plan v3 §C path,
   then the rows the prototype does not draw, rehomed from the retired
   💷 What things pay (Plan v5 §K / G1): chore grades, free chores and the 3-
   and 5-day streak tiers under 🧹 Earning, 🌟 star level under 🏆
   Competitions, and the 📘 Learning, 📦 Fines, 🎯 Targets and 🛒 What money
   buys cards. [title, card tint, rows, extra?] — `rows` is a list, or a
   function of the saved rules that builds one (a list the family owns: fine
   items, learning items, what money buys). A row is [path, label, unit ('$' |
   '%' | 'st' | 'n'), step, she(v, R)]; its path may be a function of the rules
   (a streak tier or a fine is found BY ID or by its days, never by position)
   and a path that resolves to null is not drawn. `extra(R)` draws below the
   rows (🌱 Pots: the fund picker, each girl's ladder, open early). */
const GU_RULE_DEFS = [
  ['🧹 Earning', 'green', [
    ['chores.dailyCap', 'Chores · per graded day', '$', 0.5, v => `“${guMoney$(v)} for a day done right”`],
    // Plan v5 Deviation 30: the forgiving day, said from the rules (sdStreakForgiving).
    [R => 'streak.tiers.' + guTierIndex(R, 7) + '.bonus', 'Routine · 7 days in a row', '$', 1,
      (v, R) => `“${guMoney$(v)} bonus for a full week”${sdStreakForgiving(R) ? ' · ' + sdStreakForgiving(R) : ''}`],
    [R => 'fines.items.' + guItemIndex(R, 'box_repeat') + '.amount', 'Box fine · left out twice in a week', '$', 0.25, v => `“the 🐰 takes ${guMoney$(v)}”`],
    ['chores.grade.3', 'Chore · on time and to standard', '$', 0.5, () => 'each graded chore'],
    ['chores.grade.2', 'Chore · to standard, but late', '$', 0.5],
    ['chores.grade.1', 'Chore · redone, then to standard', '$', 0.5],
    ['chores.freeChoresPerWeek', 'Free chores each week', 'n', 1, () => 'part of being here, no pay'],
    [R => guTierPath(R, 3), 'Routine · 3 days in a row', '$', 0.5],
    [R => guTierPath(R, 5), 'Routine · 5 days in a row', '$', 0.5]]],
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
    ['competition.skate.placement.overall.3', 'Skating · 3rd overall', '$', 1],
    /* "Skating star level" is the family's name; the rule key and sport id
       stay `dance`, because stored results and every rule version name it so. */
    ['competition.dance.silverPerItem', '🌟 Skating star level · per Silver item', '$', 0.5],
    ['competition.dance.goldPerItem', '🌟 Skating star level · per Gold item', '$', 0.5],
    ['competition.dance.testCap', '🌟 Skating star level · most for one test', '$', 5]]],
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
    ['pots.rates.ready', 'Savings pays', '%', 0.5, () => 'a year'],
    ['pots.rates.gic', 'Locked away pays', '%', 0.5, () => 'a year, promised'],
    ['pots.rates.stock', 'Companies (expected)', '%', 0.5, () => 'a year, can go down']], R => guPotsExtra(R)],
  ['👛 Spending', 'spend', [
    ['spend.capPct', 'Most she can cash out', '%', 5, () => 'of her share each Sunday'],
    ['advance.maxPerWeek', 'Most she can draw in advance', '$', 1, v => `“up to ${guMoney$(v)}, taken off next Sunday”`]]],
  ['📚 Words', 'lav', [
    ['words.jenn', 'Jenn · words', 'st', 1, v => GU_WORDS_STAGE[v] || ''],
    ['words.jess', 'Jess · words', 'st', 1, v => GU_WORDS_STAGE[v] || '']]],
  ['📘 Learning', 'lav', R => [
    ...((((R || {}).learning || {}).items) || []).map((it, i) => (it && !it.xpOnly)
      ? ['learning.items.' + i + '.amount', `${it.label} · per ${it.perUnit} ${it.unit}`, '$', 0.5] : null),
    ['learning.sundayCheckCount', 'Items spot-checked on Sunday', 'n', 1, () => {
      const xp = ((((R || {}).learning || {}).items) || []).filter(it => it && it.xpOnly).length;
      return xp ? `${xp} item${xp === 1 ? '' : 's'} earn XP, not dollars (house rule)` : '';
    }]].filter(Boolean)],
  ['📦 Fines', 'spend', R => ((((R || {}).fines || {}).items) || []).map((f, i) => f
    ? ['fines.items.' + i + '.amount', f.label, '$', 0.25,
       () => (Number(f.freeRepeats) || 0) ? `first ${Number(f.freeRepeats)} free each week` : 'costs from the first'] : null)
    .filter(Boolean), () => `<div class="gu-line">A day never goes below $0: a fine can take what was earned that day, never make debt.</div>`],
  ['🎯 Targets', 'green', [
    ['targets.jenn.annual', 'Jenn · a year', '$', 50, () => guYearSoFar('jenn')],
    ['targets.jess.annual', 'Jess · a year', '$', 50, () => guYearSoFar('jess')]]],
  ['🛒 What money buys', 'jenn', R => ((((R || {}).buys || {}).items) || []).map((b, i) => b
    ? ['buys.items.' + i + '.amount', b.label, '$', 1] : null).filter(Boolean),
    () => `<div class="gu-line">Sunday turns a big number into these (“about 2 movie tickets”). Keep them things she has watched us buy.</div>`],
];

/* Drafts, module-level (the Record sheet's idiom). */
let guCommitDraft = null;   // { type, kid, what, cost, share, weeks }
let guFineDraft = null;     // { kid, itemId, dayIdx, who }
let guOneOffDraft = null;   // { kid, dayIdx, startMin }
let guRuleReason = 'grownups';  // ⚙️ Rules save card's reason chip
let guOvOpen = {};          // ✅ This Sunday: whose "✏️ Change a line" is open
let guWeeksKid = 'jenn';    // 📒 Weeks: whose typed-in week is open for fixing
let guWeekOpen = null;      // 📒 Weeks: the typed-in week open for fixing
let guRuleSearch = '';      // 🔎 Find a price — the box's text, kept across redraws
let guSheet = null;         // the open fix sheet: { kind: 'loan'|'owns'|'log', kid, id }

/* ── Small readers ── */
function guMoney$(v) { const n = money2(v); return '$' + (n % 1 ? n.toFixed(2) : String(n)); }
function guIsTab(id) { return GU_TABS.some(t => t.id === id); }
function guTierIndex(R, days) {
  const tiers = ((R || {}).streak || {}).tiers || [];
  const i = tiers.findIndex(t => t && Number(t.days) === days);
  return i < 0 ? Math.max(0, tiers.length - 1) : i;
}
// A tier found by its days, or null — a row the family's tiers lack is not drawn.
function guTierPath(R, days) {
  const tiers = ((R || {}).streak || {}).tiers || [];
  const i = tiers.findIndex(t => t && Number(t.days) === days);
  return i < 0 ? null : 'streak.tiers.' + i + '.bonus';
}
function guItemIndex(R, id) {
  const items = ((R || {}).fines || {}).items || [];
  const i = items.findIndex(x => x && x.id === id);
  return i < 0 ? 0 : i;
}
// 🎯 "so far $412 · on pace for $830" — the targets row's she-line.
function guYearSoFar(kid) {
  const y = mrYearToDate(kid);
  return `so far ${guMoney$(y.paidTotal)}${y.weeks ? ' · on pace for ' + guMoney$(y.projected) : ''}`;
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
/* ✍️ Record (the Record sheet: a meet, gift or chore, or a correction, each
   through its own owner) and ? How this page works sit at the bar's start —
   `data-mny-action`, read by mnyHandleClick (#mnyRulesWrap is one of
   MNY_CLICK_HOSTS); the tabs follow. */
function guTabBar() {
  const cur = guIsTab(mnyParentSection) ? mnyParentSection : 'commit';
  return `<div class="gu-tabs" role="group" aria-label="Money">
      ${GU_TABS.map(t =>
    `<button type="button" class="gu-tab${cur === t.id ? ' on' : ''}" aria-pressed="${cur === t.id}" data-mnyp-action="gutab" data-mnyp-id="${t.id}">${escapeHtml(t.label)}</button>`).join('')}
      <span class="gu-tools">${rcDoorHint()}<button type="button" class="gu-btn gu-record" data-mny-action="record-any">✍️ Record</button><button type="button" class="gu-btn" data-mny-action="tourpar" aria-label="How this page works">?</button></span></div>`;
}

/* The whole tab: the prototype's two columns, the main one and its pane. */
function guRender(tab) {
  const parts = {
    commit: [guCommitMain, guCommitSide],
    fines: [guFinesMain, guFinesSide], expect: [guExpectMain, guExpectSide], rules: [guRulesMain, guRulesSide],
  }[tab] || [guCommitMain, guCommitSide];
  if (tab === 'weeks') return `${guTabBar()}<div class="gu-weeks2">${guWeeksMain()}</div>`;
  if (tab === 'rules') {
    // Built once per render and handed to both columns (Money fit and logic PR 3, B5).
    const secs = guRuleSections();
    return `${guTabBar()}<div class="gu-grid gu-grid--rules"><nav class="gu-ruleindex" aria-label="Rule groups">${guRuleIndex(secs)}</nav><div class="gu-main">${guRulesMain(secs)}</div><div class="gu-side">${parts[1]()}</div><div class="gu-savestrip">${guSaveStrip()}</div></div>`;
  }
  return `${guTabBar()}<div class="gu-grid gu-grid--${tab}"><div class="gu-main">${parts[0]()}</div><div class="gu-side">${parts[1]()}</div></div>`;
}
function guHead(title, strap) {
  return `<div class="gu-head"><h2 class="gu-title">${escapeHtml(title)}</h2><span class="gu-strap">${escapeHtml(strap)}</span></div>`;
}
function guOpt(label, on, action, attrs, off) {
  return `<button type="button" class="gu-opt${label === '−' || label === '+' ? ' mny-step' : ''}${on ? ' on' : ''}" data-mnyp-action="${action}"${attrs || ''}${off ? ' disabled aria-disabled="true"' : ''}>${escapeHtml(label)}</button>`;
}
// The value between a stepper's − and +: plain text, not a button (Money fit and logic PR 5).
function guVal(label) { return `<span class="mny-stepval">${escapeHtml(label)}</span>`; }
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
  const wk = mrMoneyWeekOf(f.dayKey, kid);   // the money week that pays its day (Deviation 34)
  return money2((mrFinesWeek(wk, kid, null).chargeable || {})[f.id] || 0);
}
/* The daily floor's note for a disputed fine ('' when it was taken in full). */
function guDisputeFloor(kid, r) {
  const f = mrFines(kid).find(x => x && x.id === r.fineId);
  return f ? mnyFineFloorNote(kid, f) : '';
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
    : amt > 0 && q.kind === 'dispute' && guDisputeFloor(kid, r) ? `${guDisputeFloor(kid, r).replace(/^./, c => c.toUpperCase())}, so nothing comes back — yes takes it off her record.`
    : amt > 0 ? `Yes gives back ${mnyMoney(amt)} in Sunday’s payday.` : 'It was a free one, so nothing comes back — yes takes it off her record.';
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
           amtLabel: q.kind === 'skip' ? '⛸️' : q.kind === 'dispute' && !(amt > 0) ? 'free'
             : q.kind === 'adv' || q.kind === 'dispute' ? sdOff$(amt, guMoney$) : guMoney$(amt),
           stamp: { yes: '✓ YES', no: '✗ NO', talk: '💬 TALK' }[q.status] || '' };
}
function guApproveCard(q) {
  const v = guCardValues(q);
  const tk = q.kind === 'move' && (q.record || {}).to === 'cash' ? 'cash' : q.kind;   // a move to cash is a cash out: its tag and its words
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
      <div class="gu-req-top">${guKidChip(q.kid)}<span class="gu-tag" data-gu-tag="${escapeAttr(tk)}">${escapeHtml(sdRequestTag(q.kind, (q.record || {}).to) || '❔ Ask')}</span><span class="gu-kind">${escapeHtml(GU_KIND_LABEL[tk] || q.kind)}</span>
        <span class="gu-amt">${adj ? `<button type="button" class="gu-step" data-mnyp-action="gupay" data-mnyp-d="-1"${ids} aria-label="One dollar less">−</button>` : ''}<b>${escapeHtml(v.amtLabel)}</b>${adj ? `<button type="button" class="gu-step" data-mnyp-action="gupay" data-mnyp-d="1"${ids} aria-label="One dollar more">+</button>` : ''}</span></div>
      <div class="gu-req-text">${escapeHtml(q.icon)} ${escapeHtml(q.text)}</div>
      <div class="gu-req-rules">${escapeHtml(v.rulesLine)}</div>
      <div class="gu-check">${escapeHtml(v.check)}</div>
      ${buttons}${done}
    </div>`;
}
/* ✏️ This week's lines, changed by a grown-up with a reason (Plan v5 §K:
   one state, two doors, one writer). The same steppers and reason chips as
   Sunday's Payday ✏️ (js/44), on the same owner: `mnySetOverride` /
   `mnyClearOverride`, and the reason through `mnyPickReason` — so a number
   changed here is the number Sunday shows, and "Now I choose →" still waits
   for a reason. Folded until asked for; a signed week is frozen. */
const GU_OV_LINES = [['chores', '🧹 Chores'], ['learning', '📘 Learning'], ['streak', '🔥 Routine'],
                     ['sessions', '⛸️ Club sessions'], ['comp', '🏆 Results'], ['fines', '📦 Fines']];
function guOverrideRows(kid) {
  const wk = ctThisWeekKey();
  const edited = mnyAnyEdited(kid, wk);
  const open = !!guOvOpen[kid];
  const toggle = `<button type="button" class="gu-btn gu-ovtoggle" aria-expanded="${open}" data-mnyp-action="guovopen" data-mnyp-kid="${kid}">${open ? '✏️ Done changing' : edited ? '✏️ Lines changed — see them' : '✏️ Change a line'}</button>`;
  if (!open) return toggle;
  if (mnyIsCommitted(wk, kid)) return `${toggle}<div class="gu-line">Signed — this week is frozen. A correction belongs in next Sunday's conversation.</div>`;
  const b = mrWeekBreakdown(wk, kid);
  const cur = { chores: b.chorePaid, learning: b.learnPaid, streak: b.streakBonus, sessions: b.sessionsPaid, comp: b.compPaid, fines: b.fines.total };
  const ov = mnyOverrides(kid, wk);
  const reason = mnyWeekReason(kid, wk);
  const ids = (ch) => ` data-mnyp-kid="${kid}" data-mnyp-id="${ch}"`;
  return `${toggle}
    ${mnyStrip(wk, kid, -1)}
    ${GU_OV_LINES.map(([ch, label]) => `<div class="gu-ovrow"><span>${escapeHtml(label)}${ov[ch] ? ` <s class="gu-was">${escapeHtml(mnyMoney(b.original[ch] != null ? b.original[ch] : cur[ch]))}</s>` : ''}</span>
      <span class="gu-pair"><button type="button" class="gu-step" data-mnyp-action="guov" data-mnyp-d="-1"${ids(ch)} aria-label="A dollar less">−</button><b class="gu-num">${escapeHtml(mnyMoney(cur[ch]))}</b><button type="button" class="gu-step" data-mnyp-action="guov" data-mnyp-d="1"${ids(ch)} aria-label="A dollar more">+</button>${ov[ch] ? `<button type="button" class="gu-step" data-mnyp-action="guovreset"${ids(ch)} aria-label="Back to the planner's number">↺</button>` : ''}</span></div>`).join('')}
    ${edited ? `<div class="gu-opts"><span class="gu-line">Why:</span>${MNY_REASONS.map(r =>
      guOpt(r.label, reason === r.id, 'guovreason', ` data-mnyp-kid="${kid}" data-mnyp-id="${escapeAttr(r.id)}"`)).join('')}</div>
      ${reason ? '' : '<div class="gu-line">Pick why — Sunday waits for a reason.</div>'}` : ''}`;
}
function guStepOverride(kid, ch, d) {
  const wk = ctThisWeekKey();
  const b = mrWeekBreakdown(wk, kid);
  const cur = { chores: b.chorePaid, learning: b.learnPaid, streak: b.streakBonus, sessions: b.sessionsPaid, comp: b.compPaid, fines: b.fines.total }[ch];
  if (cur == null) return;
  mnySetOverride(kid, wk, ch, Math.max(0, money2(cur + d)), mnyWeekReason(kid, wk));
}

/* 👴 The Grandfather rule's preview and credit (Plan v5 §K), while weeks
   are waiting for it. The same plan, confirm and writer as before
   (`mnyDefaultSweepPlan` / `mnyRunDefaultSweep`); its settings are on
   ⚙️ Rules › 👴. Data keys stay `grandma.*` and `defaultReason:'grandma'`. */
function guGrandfatherCreditCard() {
  const plan = mnyDefaultSweepPlan();
  const n = plan.weeks.length;
  if (!n) return '';
  const perKid = GU_KIDS.map(k => {
    const weeks = plan.weeks.filter(w => w.kids.indexOf(k) >= 0).length;
    return `<div class="gu-kv"><span>${escapeHtml(mnyKidName(k))} · ${weeks} week${weeks === 1 ? '' : 's'}${plan.comp[k] > 0 ? ` · ${escapeHtml(mnyMoney(plan.comp[k]))} of competitions on top` : ''}</span><b>${escapeHtml(mnyMoney(plan.perKid[k]))}</b></div>`;
  }).join('');
  return `<div class="gu-card gu-plain">
      <div class="gu-cardhead"><span class="gu-cardtitle">👴 Grandfather rule</span><b class="gu-fig">${escapeHtml(mnyMoney(plan.total))}</b></div>
      <div class="gu-line">${n} week${n === 1 ? '' : 's'} outside the review window had no family meeting.${plan.skipped ? ` ${plan.skipped} week${plan.skipped === 1 ? '' : 's'} had a family meeting — left alone.` : ''}</div>
      ${perKid}
      ${plan.saved
        ? `<button type="button" class="gu-save ready" data-mnyp-action="grandma">Credit ${escapeHtml(mnyMoney(plan.total))} across ${n} week${n === 1 ? '' : 's'}</button>
           <div class="gu-line">Shown before anything moves, and asked once more before it does.</div>`
        : `<div class="gu-line">Enter the start week first, in ⚙️ Rules › 👴 Grandfather rule.</div>
           <button type="button" class="gu-btn" data-mnyp-action="gutab" data-mnyp-id="rules">⚙️ Go to Rules</button>`}
    </div>`;
}

/* Maintenance, each only while it has something to do (Plan v5 §K): the
   money stream's one-time set-up (or a drift between the two ways of
   counting), weeks the retired branch short-changed (`evRepairPlan`), and
   settled weeks whose meets were never paid (`mnyUnpaidMeetsPlan`). Each is
   previewed here and confirmed by its own runner before anything moves. */
function guStreamCard() {
  const pending = evMigrationPlan().filter(p => !p.alreadyDone);
  const drift = GU_KIDS.reduce((all, k) => all.concat(evShadowDrift(k).map(d => mnyKidName(k) + ' — ' + d)), []);
  if (!pending.length && !drift.length) return '';
  return `<div class="gu-card gu-plain">
      <div class="gu-cardtitle">🔀 Where the money went</div>
      ${pending.map(p => `<div class="gu-kv"><span>${escapeHtml(mnyKidName(p.kid))} · ${p.weeks} settled week${p.weeks === 1 ? '' : 's'}, ${p.gifts} gift${p.gifts === 1 ? '' : 's'}</span><b>${escapeHtml(mnyMoney(p.opening.cash))} already had</b></div>`).join('')}
      ${pending.length ? `<button type="button" class="gu-btn" data-mnyp-action="migrate">Set it up — ${pending.reduce((n, p) => n + p.rows.length, 0)} movements from what is on record</button>
        <div class="gu-line">It moves no money: each pot opens at exactly what it holds today.</div>` : ''}
      ${drift.length ? `<div class="gu-line gu-warnline">These do not agree yet: ${escapeHtml(drift.join(' · '))}</div>` : ''}
    </div>`;
}
function guRepairCard() {
  const plans = evRepairPlan();
  const weeks = plans.reduce((n, p) => n + p.weeks.length, 0);
  if (!weeks) return '';
  const total = money2(plans.reduce((n, p) => n + p.total, 0));
  return `<div class="gu-card gu-plain">
      <div class="gu-cardhead"><span class="gu-cardtitle">🩹 Weeks that were short</span><b class="gu-fig">${escapeHtml(mnyMoney(total))}</b></div>
      <div class="gu-line">Settled while two money models were live, and priced by the retired one. Each is re-priced under its own rules; it only ever adds.</div>
      ${plans.filter(p => p.weeks.length).map(p => p.weeks.slice(0, 10).map(w =>
        `<div class="gu-kv"><span>${escapeHtml(mnyKidName(p.kid))} · week of ${escapeHtml(mnyShortDate(w.wk))}${w.why ? ` <span class="gu-line">${escapeHtml(w.why)}</span>` : ''}</span><b>${escapeHtml(mnyMoney(w.was))} → ${escapeHtml(mnyMoney(w.should))}</b></div>`).join('')).join('')}
      <button type="button" class="gu-btn" data-mnyp-action="repair">Pay the ${escapeHtml(mnyMoney(total))} they were short, across ${weeks} week${weeks === 1 ? '' : 's'}</button>
    </div>`;
}
function guMeetsCard() {
  const plans = mnyUnpaidMeetsPlan();
  const weeks = plans.reduce((n, p) => n + p.weeks.length, 0);
  if (!weeks) return '';
  const total = money2(plans.reduce((n, p) => n + p.total, 0));
  return `<div class="gu-card gu-plain">
      <div class="gu-cardhead"><span class="gu-cardtitle">🏆 Competitions never paid</span><b class="gu-fig">${escapeHtml(mnyMoney(total))}</b></div>
      <div class="gu-line">These weeks are settled and their competitions are on file, but what the competitions are worth was never paid. Nothing is taken back.</div>
      ${plans.filter(p => p.weeks.length).map(p => p.weeks.slice(0, 10).map(w =>
        `<div class="gu-kv"><span>${escapeHtml(mnyKidName(p.kid))} · week of ${escapeHtml(mnyShortDate(w.wk))} <span class="gu-line">${escapeHtml(w.names.join(', '))}</span></span><b>${escapeHtml(mnyMoney(w.gap))}</b></div>`).join('')).join('')}
      <button type="button" class="gu-btn" data-mnyp-action="paymeets">Pay the ${escapeHtml(mnyMoney(total))} these competitions never got, across ${weeks} week${weeks === 1 ? '' : 's'}</button>
    </div>`;
}
function guWobblePct() { return Number(mrRuleOr(mrRules(), 'market.wobblePct')) || 0; }
/* 📉 Market wobble — a setting, so it lives on ⚙️ Rules › 🌱 Pots (Plan v9
   §M 5b: the Approve side pane is gone). On or off for this Sunday. */
function guWobbleCard() {
  const on = guWobblePct() > 0;
  const pct = on ? guWobblePct() : 2;
  return `<div class="gu-wobble">
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
/* What borrowing a row will have cost by the Sunday it is paid off, at its
   weekly must-pay and the loan's interest every N Sundays on what is left —
   the same arithmetic as `loanAccrueBalanceInterest` / `sdLoanInterest`.
   Interest still to come only; null when the row has no weekly figure. */
function guInterestToCome(left, weekly, R) {
  if (!(left > 0)) return 0;
  if (!(weekly > 0)) return null;
  const rate = Number(mrRuleOr(R, 'loan.ratePct')) || 0;
  const every = Math.max(1, Number(mrRuleOr(R, 'loan.interestEverySundays')) || 1);
  let bal = left, tot = 0;
  for (let w = 1; w <= 1040 && bal > 0.005; w++) {
    bal = money2(bal - weekly);
    if (!(bal > 0) || w % every) continue;
    const i = money2(bal * rate / 100 * every / 52);
    bal = money2(bal + i); tot = money2(tot + i);
  }
  return tot;
}
/* Each row of her wall (Plan v5 §L G2): what is left, and — as the owner
   chose — the cost of borrowing so far (interest added), about what it will
   have cost by payoff, the early bonus she has earned, and late costs (red,
   only above $0), from `mnyLoanFacts`. Tap a row → ✏️ Fix this row. */
function guCommitKidCard(kid) {
  const facts = mnyLoanFacts(kid);
  const R = mrRules();
  const left = facts.left;
  const weekly = guWeeklyLoan(kid), steady = guSteady(kid);
  const rows = facts.rows.map((f, i) => {
    const owe = f.left, p = f.principal;
    const w = p > 0 ? Math.max(0, Math.min(100, (p - Math.max(0, p - f.paid)) / p * 100)) : 100;
    const toCome = guInterestToCome(owe, f.weekly, R);
    const cost = `Interest so far ${guMoney$(f.interestAdded)}${toCome == null ? ' · paid by extra' : ` · about ${guMoney$(money2(f.interestAdded + toCome))} by payoff`}`;
    return `<button type="button" class="gu-loanrow" data-mnyp-action="gufixloan" data-mnyp-kid="${kid}" data-mnyp-id="${escapeAttr(f.id)}" aria-label="${escapeAttr('Fix ' + f.name)}">
        <span class="gu-loanrow-top"><span>${i + 1}. ${escapeHtml(f.icon || '')} ${escapeHtml(f.name)}</span>
        <b>${owe <= 0.005 ? '✓ done' : `${mnyMoney(owe)} of ${mnyMoney(p)}`}</b></span>
        <span class="gu-bar"><span class="gu-bar-fill" style="width:${Math.round(w)}%"></span></span>
        <span class="gu-loanfacts">${escapeHtml(cost)} · bonus earned ${escapeHtml(guMoney$(f.bonus))}</span>
        ${f.lateCosts > 0 ? `<span class="gu-loanfacts gu-late">Late costs ${escapeHtml(guMoney$(f.lateCosts))}</span>` : ''}
      </button>`;
  }).join('');
  return `<div class="gu-card ${'gu-tint--' + kid}">
      <div class="gu-cardhead"><span class="gu-cardtitle">${escapeHtml(mnyKidName(kid))}</span><b class="gu-fig">${mnyMoney(left)} left</b></div>
      <div class="gu-line">${mnyMoney(weekly)} a week · ${guPct(sdSteadyShare(weekly, steady))} of steady ${mnyMoney(steady)}</div>
      ${rows || '<div class="gu-line">Nothing on her wall.</div>'}
    </div>`;
}
/* The commitment's numbers are the core's (`sdCommitPlan`, js/43) — the same
   answer `mnyAddCommitment` writes. A 🌧️ surprise is unchanged: the 🛟 pays
   first, all of Savings if it must (decision 8). The parent's ✓ is form state
   only, tied to the figures it was given for (`guCommitTickKey`). */
function guCommitTickKey(c) { return [c.kid, c.cost, c.share, c.weeks].join('|'); }
function guCommitMath() {
  const c = guCommit(), kid = c.kid;
  const sur = c.type === 'surprise';
  const safety = money2(mrRuleOr(mrRules(), 'pots.safety'));
  const sav = mnySavedTotal(kid);
  const plan = sdCommitPlan({ cost: c.cost, sharePct: c.share, weeks: c.weeks, saved: sav, safety,
                              weeklyNow: guWeeklyLoan(kid), steady: guSteady(kid) });
  const leftNow = mnyTotalOwing(kid);
  const fromSafe = money2(Math.min(c.cost, sav)), borrow = money2(c.cost - fromSafe);
  return { c, kid, sur, safety, plan, leftNow, sav, fromSafe, borrow, ticked: c.tickFor === guCommitTickKey(c) };
}
function guPct(v) { return v != null && isFinite(v) ? Math.round(v) + '%' : '—'; }   // null: under the $5 floor (sdSteadyShare)
function guCommitMain() {
  const c = guCommit(), sur = c.type === 'surprise';
  const rows = [
    guFormRow('Type', guOpt('🆕 Commitment', !sur, 'gucmtype', ' data-mnyp-id="commit"') + guOpt('🌧️ Surprise cost', sur, 'gucmtype', ' data-mnyp-id="surprise"')),
    guFormRow('For', GU_KIDS.map(k => guOpt(mnyKidName(k), c.kid === k, 'gucmkid', ` data-mnyp-id="${k}"`)).join('')),
    guFormRow('Cost', guOpt('−', false, 'gucmcost', ' data-mnyp-d="-5" aria-label="Five dollars less"') + guVal('$' + c.cost) + guOpt('+', false, 'gucmcost', ' data-mnyp-d="5" aria-label="Five dollars more"')),
  ];
  if (!sur) {
    rows.push(guFormRow('Her share', guOpt('−', false, 'gucmshare', ' data-mnyp-d="-5" aria-label="Less"') + guVal(c.share + '%')
      + guOpt('+', false, 'gucmshare', ' data-mnyp-d="5" aria-label="More"')));   // one 50 %: the stepper is the control (PR 5)
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
  const m = guCommitMath(), P = m.plan;
  const lines = m.sur
    ? [['Cost', mnyMoney(m.c.cost)], ['Her 🛟 Savings now', mnyMoney(m.sav)], ['Paid from Savings', mnyMoney(m.fromSafe)], ['New row on her wall', mnyMoney(m.borrow)]]
    : [['Her share', mnyMoney(P.her)],
       P.toWall > 0 ? ['10% down', `${mnyMoney(P.fromSavings)} from Savings, ${mnyMoney(P.toWall)} added to the wall`]
         : ['10% down from her Savings', mnyMoney(P.down)],
       ['New row on her wall', mnyMoney(P.added)],
       ['Weekly loan payment', `${mnyMoney(P.p0)} → ${mnyMoney(P.p1)}`],
       ['Of her steady income', P.lowSteady ? 'not enough steady money yet' : `${guPct(P.r0)} → ${guPct(P.r1)}`],
       ['Free by', `${guFreeBy(m.leftNow, P.p0)} → ${guFreeBy(m.leftNow + P.added, P.p1)}`]];
  const verdict = m.sur
    ? (m.borrow ? `🛟 Not quite enough. ${mnyMoney(m.borrow)} goes on her wall.` : '✅ Her safety money covers it. That is what it is for.')
    : P.lowSteady ? '⚠️ Not enough steady money yet to judge it. Check it with her first.'
    : P.over ? '⚠️ Over the 50% limit. Try a smaller share, a longer time, or wait for row 1 to finish — or check it with her first.'
    : '✅ Fits under the 50% limit.';
  const good = m.sur ? !m.borrow : !P.needsTick;
  const tick = !m.sur && P.needsTick;
  const can = !!String(m.c.what || '').trim() && (!tick || m.ticked);
  return `<div class="gu-sidehead">${m.sur ? 'Is her safety money enough?' : 'Can she afford it?'}</div>
    <div class="gu-card gu-afford ${good ? 'gu-afford--ok' : 'gu-afford--warn'}">
      ${lines.map(([k, v]) => `<div class="gu-kv"><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`).join('')}
      <div class="gu-verdict">${escapeHtml(verdict)}</div>
      ${tick ? `<button type="button" class="gu-btn" role="checkbox" aria-checked="${m.ticked}" data-mnyp-action="gucmtick">${m.ticked ? '✅' : '⬜'} I checked this with her</button>` : ''}
      <button type="button" class="gu-save${can ? ' ready' : ''}" data-mnyp-action="gucmsave">${m.sur ? 'Send her the 🌧️ card' : 'Add to her wall'}</button>
      <div class="gu-line">${m.sur ? 'Not a fine: nobody did anything wrong. 🛟 Savings pays first; the rest becomes a row on her wall. Savings refills first after.'
        : `Her weekly payment goes up from next Sunday. Her 10% down comes out of Savings above the 🛟 ${escapeHtml(guMoney$(m.safety))}; the rest joins the new row.`}</div>
    </div>`;
}
function guSaveCommit() {
  const c = guCommit();
  if (!String(c.what || '').trim()) { showToast(c.type === 'surprise' ? 'What happened?' : 'What is it for?'); return; }
  const m = guCommitMath();
  if (c.type !== 'surprise' && m.plan.needsTick && !m.ticked) { showToast('Tick “I checked this with her” first'); return; }
  const rec = c.type === 'surprise'
    ? mnyAddSurprise(c.kid, { what: c.what, cost: c.cost })
    : mnyAddCommitment(c.kid, { what: c.what, cost: c.cost, sharePct: c.share, weeks: c.weeks, checked: m.ticked });
  if (!rec) return;
  showToast(c.type === 'surprise'
    ? (rec.covered ? '🛟 Her Savings covered it' : `🌧️ ${mnyMoney(rec.principal)} on ${mnyKidName(c.kid)}'s wall`)
    : `🆕 On ${mnyKidName(c.kid)}'s wall`);
  c.what = ''; c.tickFor = null;
}
/* 🧾 The club pays the assistant job twice a year; this is what it owes Dad
   (mnyClubOwes, derived), and "✓ Club paid" moves the date it is paid
   through to her latest settled week (mnySetClubPaid). */
function guClubCard() {
  const rows = GU_KIDS.map(kid => {
    const o = mnyClubOwes(kid);
    const since = o.since ? 'since ' + mnyShortDate(o.since) : 'so far';
    return `<div class="gu-clubrow"><span>${guKidChip(kid)} Club owes us <b>${mnyMoney(o.amount)}</b> · ${o.sessions} session${o.sessions === 1 ? '' : 's'} ${escapeHtml(since)}</span>
      <button type="button" class="gu-btn" data-mnyp-action="guclubpaid" data-mnyp-kid="${kid}"${o.weeks ? '' : ' aria-disabled="true"'}>✓ Club paid</button></div>`;
  }).join('');
  return `<div class="gu-card gu-club"><div class="gu-cardtitle">🧾 Club owes</div>${rows}
    <div class="gu-line">The club pays the assistant job twice a year; we pay her every Sunday. Nothing in her money moves when the club pays.</div></div>`;
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
/* The Day row's days: the money days of the week the coming meeting pays
   (Deviation 34 — Mon..Sun before the switch, Sun..Sat after), and today
   too when it is not one of them (a Sunday under the new rule, which next
   Sunday pays). Each fine is filed by its own day, so `mrFinesWeek` puts it
   in the right week whichever that is. */
function guFineDays() {
  const wk = ctThisWeekKey();
  const keys = mrMoneyDayRefs(wk, mrMoneyWeekIsSunday(wk)).map(x => x.dayKey);
  if (keys.indexOf(todayKey()) < 0) keys.push(todayKey());
  return keys;
}
function guDayName(dayKey) { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][formatDayKey(dayKey).getDay()]; }
// Today's place in the Day row; the last day it may be.
function guTodayIdx() {
  const i = guFineDays().indexOf(todayKey());
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
  const keys = guFineDays();
  // What each one costs, in the money week that pays its day.
  const charge = {};
  const chargeOf = (f) => {
    const wk = mrMoneyWeekOf(f.dayKey, kid);
    if (!charge[wk]) charge[wk] = mrFinesWeek(wk, kid, null).chargeable || {};
    return money2(charge[wk][f.id] || 0);
  };
  return mrFines(kid).filter(f => f && keys.indexOf(f.dayKey) >= 0)
    .slice().sort((a, b) => String(a.dayKey).localeCompare(String(b.dayKey)) || (Number(a.at) || 0) - (Number(b.at) || 0))
    .map(f => ({ f, day: guDayName(f.dayKey), what: guFineLabel(f.itemId), who: f.who || '', amt: chargeOf(f) }));
}
function guFinesMain() {
  const f = guFine(), wk = ctThisWeekKey();
  const items = guFineItems();
  const st = mrFineStanding(mrMoneyWeekOf(guFineDays()[f.dayIdx] || todayKey(), f.kid), f.kid, f.itemId);
  const next = st.nextCosts > 0 ? '−' + mnyMoney(st.nextCosts) : 'free';
  const kidCard = (kid) => {
    const list = guFinesThisWeek(kid);
    const total = money2(list.reduce((a, x) => a + x.amt, 0));
    const logged = [...new Set(list.map(x => x.f.itemId))];
    return `<div class="gu-card ${'gu-tint--' + kid}">
        <div class="gu-cardhead"><span class="gu-cardtitle">${escapeHtml(mnyKidName(kid))} · this week</span>${total > 0 ? `<b class="gu-fig gu-fig--fine">−${mnyMoney(total)}</b>` : ''}</div>
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
      ${guFormRow('Day', guFineDays().map((k, i) => guOpt(guDayName(k), f.dayIdx === i, 'gufnday', ` data-mnyp-id="${i}"`, i > guTodayIdx())).join(''))}
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
    // A free fine is never a "−$0.00" (owner's review, G4-4): no amount at all.
    return `<div class="gu-see"><div class="gu-cardhead"><span>${escapeHtml(mnyKidName(kid))} · 📦 Fines</span>${total > 0 ? `<b class="gu-fig gu-fig--fine">−${mnyMoney(total)}</b>` : list.length ? '<b class="gu-fig">free</b>' : ''}</div>
      <span class="gu-line">${escapeHtml(note)}</span></div>`;
  }).join('');
  return `<div class="gu-sidehead">What she sees on Sunday</div>${see}
    <div class="gu-card gu-plain">It shows under ➖ Taken off on her payday. If she thinks it's wrong, she can dispute it from My money, and it lands in Parent › Now.</div>`;
}
function guLogFine() {
  const f = guFine();
  const dayKey = guFineDays()[f.dayIdx];
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
      <span class="gu-line">Competitions use her average per competition from the last 4. Change it here if a season is different.</span>
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
/* Every section with its rows resolved against the saved rules: a list
   section built, path functions called, rows whose path is null left out. */
function guRuleRows() {
  const saved = guSavedRules();
  return GU_RULE_DEFS.map(([title, tint, rows, extra]) => ({ title, tint, extra,
    rows: (typeof rows === 'function' ? rows(saved) : rows).map(([path, label, unit, step, she]) => {
      const p = typeof path === 'function' ? path(saved) : path;
      return p ? { path: p, label, unit, step, she } : null;
    }).filter(Boolean) }));
}
function guRuleRowFor(path) {
  for (const sec of guRuleRows()) for (const r of sec.rows) if (r.path === path) return r;
  return null;
}
function guFmt(unit, v) {
  const n = Number(v) || 0;
  return unit === 'st' ? 'Stage ' + n : unit === '%' ? n + '%' : unit === 'n' ? String(n) : guMoney$(n);
}
/* 🌱 Pots' extra rows (Plan v5 §K, §L G4): what her 📈 Companies buys (the
   fund picker), and per girl where she is on the ladder — paid %, what is
   open, the next gate — with "open early" chips and ✏️ Fix what she owns.
   The fund and an early opening are rules, queued like any stepper. */
function guPotsExtra(R) {
  const fund = (mnyPending.find(p => p.path === 'investing.fund') || {}).value || ((R || {}).investing || {}).fund;
  const funds = MNY_FUNDS.map(f => guOpt(f.label, fund === f.id, 'gufund', ` data-mnyp-id="${escapeAttr(f.id)}"`)).join('');
  const ladder = GU_KIDS.map(kid => {
    const idx = mnyStageIndex(kid);
    const open = MNY_STAGES.slice(1, idx + 1).map(s => s.icon + ' ' + s.title);
    const next = MNY_STAGES[idx + 1];
    const pend = mnyPending.find(p => p.path === 'school.unlockStage.' + kid);
    const early = pend ? Number(pend.value) : mnyUnlockOverride(kid);
    return `<div class="gu-ladder">
        <div class="gu-kv"><span>${guKidChip(kid)} ${escapeHtml(mnyTotalPrincipal(kid) > 0 ? mnyPaidPct(kid) + '% paid' : 'no loan')}</span>
          <b>${escapeHtml(next ? `next: ${next.icon} at ${mnyStagePct(next.id)}%` : 'all open')}</b></div>
        <div class="gu-line">${escapeHtml(open.length ? 'Open: ' + open.join(' · ') : 'Nothing open yet but the loan and cash')}</div>
        <div class="gu-opts"><span class="gu-line">Open early:</span>${MNY_STAGES.map((s, i) =>
          guOpt(i === 0 ? 'no' : s.icon, early === i, 'guunlock', ` data-mnyp-kid="${kid}" data-mnyp-id="${i}" aria-label="${escapeAttr(i === 0 ? 'No early opening' : 'Open ' + s.title + ' early')}"`)).join('')}</div>
        <button type="button" class="gu-btn" data-mnyp-action="gufixowns" data-mnyp-kid="${kid}">✏️ Fix what she owns</button>
      </div>`;
  }).join('');
  return `<div class="gu-line">What 📈 Companies buys</div><div class="gu-opts">${funds}</div>${ladder}
    <div class="gu-line">Open early only ever opens: it cannot close a pot she has reached.</div>
    ${guWobbleCard()}`;
}
/* 👴 The Grandfather rule's settings (Plan v5 §K; on screen only — data keys
   stay `grandma.*`): the start week and the amount, saved once as a dated
   rule (`mnySaveGrandmaRule`), and the week pocket money started
   (`mnySetStartWeek`). Its preview and credit live on ✅ Approve. */
function guGrandfatherCard() {
  const f = mnyGrandmaForm();
  const rule = mnyGrandmaRule();
  const changed = !rule.saved || String(ctWeekKeyForDate(f.from)) !== rule.from || money2(f.amount) !== rule.amount;
  ctEnsureShared();
  const derived = !state.shared.chore.programStartDate;
  return `<div class="gu-card gu-rulesec gu-tint--lav">
      <div class="gu-cardtitle">👴 Grandfather rule</div>
      <div class="gu-line">Every week from the start week that is outside the review window and had no family meeting gets the same flat amount for each girl. A competition on file is paid on top. The last ${MNY_CATCHUP_REACH} weeks are left to the catch-up list.</div>
      <label class="gu-rule"><span class="gu-rule-words"><span>Starts the week of</span></span>
        <input class="gu-input gu-date" type="date" value="${escapeAttr(f.from)}" data-mnyp-action="gmfrom"></label>
      <div class="gu-rule"><div class="gu-rule-words"><span>Each girl, each week</span></div>
        <span class="gu-pair"><button type="button" class="gu-step" data-mnyp-action="gmamt" data-mnyp-d="-0.5" aria-label="Less">−</button>
        <b class="gu-ruleval">${escapeHtml(guMoney$(f.amount))}</b>
        <button type="button" class="gu-step" data-mnyp-action="gmamt" data-mnyp-d="0.5" aria-label="More">+</button></span></div>
      <button type="button" class="gu-save${changed ? ' ready' : ''}" data-mnyp-action="gmsave">${rule.saved ? (changed ? 'Save the change' : 'Saved ✓') : 'Save the start week'}</button>
      <div class="gu-line">${rule.saved ? `Saved: from the week of ${escapeHtml(mnyShortDate(rule.from))}, ${escapeHtml(mnyMoney(rule.amount))} a week.` : 'Not saved yet — nothing is credited until the start week is.'}</div>
      <label class="gu-rule"><span class="gu-rule-words"><span>Pocket money started</span><span class="gu-she">the meeting looks back no further${derived ? ' · worked out from the earliest week on file' : ''}</span></span>
        <input class="gu-input gu-date" type="date" value="${escapeAttr(String(mrStartWeek()))}" data-mnyp-action="startweek"></label>
    </div>`;
}
/* One-time cards, at the top only while pending (Plan v5 §K): the four house
   rules, the Sunday rules and this quarter's review. */
function guQuarterlyCard() {
  if (!mrQuarterlyDue()) return '';
  return `<div class="gu-card gu-plain">
      <div class="gu-cardtitle">📅 Quarterly review — ${escapeHtml(mrQuarterOf(todayKey()))}</div>
      <div class="gu-line">The rulebook says these numbers get looked at every three months. 🎯 Targets shows what each girl has earned so far and her pace; change anything below, or mark it reviewed.</div>
      <button type="button" class="gu-btn" data-mnyp-action="guquarter">✓ Reviewed — no change needed</button>
    </div>`;
}
/* ⚙️ Rules — one screen (Plan v9 §M 5b "Rules", approved as drawn): an
   index on the left (🔎 Find a price, then every group with a one-line
   summary and a red count of its unsaved changes), the chosen group's rows
   in the middle (one sentence of what it is for; a changed number shows
   "· was …"), "What this changes" and "👀 What the girls will see on
   Sunday" on the right, and the save strip along the bottom. Groups beyond
   the rule cards: 👴 Grandfather rule, 📌 One-time settings (only the cards
   still due; "due" in the index) and 📝 Rule changes (the last 5, see all).
   `guRuleSec` says which group is open; Find a price shows the matching rows
   of every group at once, in place (`guApplyRuleSearch`). */
let guRuleSec = 0;          // ⚙️ Rules: the open group (index into guRuleSections())
let guRuleThisWeek = false; // ⚙️ Rules: "start this week instead" ticked
const GU_RULE_PURPOSE = {
  '🧹 Earning': 'What a chore day and a routine streak pay. She sees these on Today.',
  '🏆 Competitions': 'What a result pays. The official results sheet decides the points.',
  '🧱 Loan': 'What she pays back each month, and what paying early counts for.',
  '🌱 Pots': 'When each pot opens (share of the loan paid) and what it pays.',
  '👛 Spending': 'How much she may cash out on Sunday, and draw before it.',
  '📚 Words': 'Which money words Sunday uses with each girl.',
  '📘 Learning': 'What learning pays, and how many items are spot-checked on Sunday.',
  '📦 Fines': 'What each fine costs. Every one is logged, even a free one.',
  '🎯 Targets': 'What each girl aims to earn in a year. Sunday shows her pace.',
  '🛒 What money buys': 'The prices Sunday turns a big number into.',
};
/* "Chores $3/$2/$1 · cap $3 · 2 free" — each group's line in the index. */
function guRuleSummary(title, R) {
  const g = (p) => mrRuleOr(R, p);
  const d = (p) => guMoney$(Number(g(p)) || 0);
  const t = String(title);
  if (t.indexOf('Earning') >= 0) return `Chores ${d('chores.grade.3')}/${d('chores.grade.2')}/${d('chores.grade.1')} · cap ${d('chores.dailyCap')} · ${Number(g('chores.freeChoresPerWeek')) || 0} free`;
  if (t.indexOf('Competitions') >= 0) return `Swim ${d('competition.swim.perPoint')}/pt · Skate 1st ${d('competition.skate.placement.group.1')} · Silver ${d('competition.dance.silverPerItem')}`;
  if (t.indexOf('Loan') >= 0) return `Jenn ${d('loan.monthly.jenn')} · Jess ${d('loan.monthly.jess')} a month · bonus ${Number(g('loan.extraBonusPct')) || 0}%`;
  if (t.indexOf('Pots') >= 0) return `Open at ${g('school.stagePct.ready')}%/${g('school.stagePct.locked')}%/${g('school.stagePct.stock')}% · pay ${g('pots.rates.ready')}%/${g('pots.rates.gic')}%/${g('pots.rates.stock')}%`;
  if (t.indexOf('Spending') >= 0) return `Cash out ≤ ${g('spend.capPct')}% · draw ahead ≤ ${d('advance.maxPerWeek')}`;
  if (t.indexOf('Words') >= 0) return `Jenn Stage ${g('words.jenn')} · Jess Stage ${g('words.jess')}`;
  if (t.indexOf('Learning') >= 0) {
    const items = (((R || {}).learning || {}).items) || [];
    return `${Number(g('learning.sundayCheckCount')) || 0} items checked a week · ${items.filter(i => i && i.xpOnly).length} XP, not dollars`;
  }
  if (t.indexOf('Fines') >= 0) {
    const items = (((R || {}).fines || {}).items) || [];
    return `${items.length} kinds · ${guMoney$(Number((items[0] || {}).amount) || 0)} each · ${Number((items[0] || {}).freeRepeats) || 0} free a week`;
  }
  if (t.indexOf('Targets') >= 0) return `Jenn ${d('targets.jenn.annual')} · Jess ${d('targets.jess.annual')} a year`;
  if (t.indexOf('buys') >= 0) {
    const items = (((R || {}).buys || {}).items) || [];
    return `${items.length} prices${items[0] ? ` · ${items[0].label} ${guMoney$(items[0].amount)}` : ''}`;
  }
  return '';
}
/* Every group the index lists: the rule cards, then the three others. */
function guRuleSections() {
  const R = guPendingRules();
  const rows = guRuleRows();
  const once = [mnyHouseRulesCard(), guSundayRulesCard(), guQuarterlyCard()].join('');
  const log = guRuleLog();
  return rows.map(sec => ({ kind: 'rules', title: sec.title, sec,
      line: guRuleSummary(sec.title, R),
      changed: mnyPending.filter(p => sec.rows.some(r => r.path === p.path)).length }))
    .concat([
      { kind: 'gf', title: '👴 Grandfather rule', line: (() => { const r = mnyGrandmaRule(); return r.saved ? `${guMoney$(r.amount)} a week each · from ${mnyShortDate(r.from)}` : 'not set up yet'; })() },
      { kind: 'once', title: '📌 One-time settings', line: once ? 'something to put in the rulebook' : `started ${mnyShortDate(String(mrStartWeek()))}`, due: !!once, html: once },
      { kind: 'log', title: '📝 Rule changes', line: log[0] ? `Last: ${mnyShortDate(toDayKeyInZone(new Date(log[0].at)))} · ${log[0].note || log[0].path}` : 'none yet', log },
    ]);
}
/* Open a group by its kind ('gf', 'once', 'log') — Setup's 🕰️ Change history
   and 👴 Grandfather rule rows land on theirs. */
function guRuleOpenGroup(kind) {
  const i = guRuleSections().findIndex(s => s.kind === kind);
  if (i >= 0) { guRuleSec = i; guRuleSearch = ''; }
}
function guRuleIndex(secs = guRuleSections()) {
  const cur = Math.max(0, Math.min(secs.length - 1, guRuleSec));
  return `<label class="gu-q gu-search-label" for="guRuleSearch">🔎 Find a price or rule</label>
    <input class="gu-input" id="guRuleSearch" type="search" value="${escapeAttr(guRuleSearch)}" placeholder="Find a price or rule…" data-mnyp-action="gurulesearch" autocomplete="off">
    ${secs.map((s, i) => `<button type="button" class="gu-idx${i === cur ? ' on' : ''}" aria-pressed="${i === cur}" data-mnyp-action="gurulesec" data-mnyp-id="${i}">
        <span class="gu-idx-title">${escapeHtml(s.title)}${s.changed ? `<span class="gu-idx-n">${s.changed}</span>` : ''}${s.due ? '<span class="gu-idx-due">due</span>' : ''}</span>
        <span class="gu-idx-line">${escapeHtml(s.line)}</span></button>`).join('')}`;
}
function guRuleRowHtml(r, saved, R) {
  const was = Number(mrGetPath(saved, r.path)) || 0, now = Number(mrGetPath(R, r.path)) || 0;
  const ch = was !== now;
  const she = (r.she ? r.she(now, R) : '');
  const attrs = ` data-mnyp-path="${escapeAttr(r.path)}" data-mnyp-label="${escapeAttr(r.label)}"`;
  return `<div class="gu-rule${ch ? ' changed' : ''}"><div class="gu-rule-words"><span>${escapeHtml(r.label)}</span><span class="gu-she">${escapeHtml(she)}</span></div>
      <span class="gu-pair"><button type="button" class="gu-step" data-mnyp-action="gurule" data-mnyp-d="${-r.step}"${attrs} aria-label="Less">−</button>
      <span class="gu-rulevalbox"><b class="gu-ruleval${ch ? ' changed' : ''}">${escapeHtml(guFmt(r.unit, now))}</b>${ch ? `<span class="gu-was">was ${escapeHtml(guFmt(r.unit, was))}</span>` : ''}</span>
      <button type="button" class="gu-step" data-mnyp-action="gurule" data-mnyp-d="${r.step}"${attrs} aria-label="More">+</button></span></div>`;
}
function guRulesMain(secs = guRuleSections()) {
  const saved = guSavedRules(), R = guPendingRules();
  const cur = Math.max(0, Math.min(secs.length - 1, guRuleSec));
  const body = secs.map((s, i) => {
    const head = `<div class="gu-cardtitle">${escapeHtml(s.title)}</div>`;
    let inner = '';
    if (s.kind === 'rules') {
      inner = `${head}<div class="gu-line gu-purpose">${escapeHtml(GU_RULE_PURPOSE[s.title] || '')}</div>
        ${s.sec.rows.map(r => guRuleRowHtml(r, saved, R)).join('')}${s.sec.extra ? s.sec.extra(R) : ''}`;
    } else if (s.kind === 'gf') {
      inner = guGrandfatherCard();
    } else if (s.kind === 'once') {
      inner = `${head}${s.html || `<div class="gu-line">Nothing to put in the rulebook. Pocket money started ${escapeHtml(mnyShortDate(String(mrStartWeek())))}; set it on 👴 Grandfather rule.</div>`}`;
    } else {
      inner = `${head}<div class="gu-line gu-purpose">The last 5 changes, with the reason given.</div>
        ${s.log.slice(0, 5).map(guLogLine).join('') || '<div class="gu-log">No changes yet.</div>'}
        ${s.log.length > 5 ? `<button type="button" class="gu-btn" data-mnyp-action="gulogall">See all ${s.log.length} ▸</button>` : ''}`;
    }
    const cls = s.kind === 'rules' ? `gu-card gu-rulesec ${'gu-tint--' + s.sec.tint}` : s.kind === 'gf' ? 'gu-rulesec gu-rulesec--gf' : 'gu-card gu-rulesec gu-plain';
    return `<div class="${cls}" data-gu-sec="${i}"${i === cur ? '' : ' hidden'}>${inner}</div>`;
  }).join('');
  return `<div class="gu-rulegrid">${body}</div>`;
}
/* 🔎 Find a price (G6-12): with words in the box, every group's matching
   rows show at once, in place — the tab is never redrawn, so the box keeps
   its caret; empty, only the open group shows. A group whose title matches
   shows every row. */
function guApplyRuleSearch(root) {
  const q = String(guRuleSearch || '').trim().toLowerCase();
  const cur = String(Math.max(0, guRuleSec));
  (root || document).querySelectorAll('.gu-rulegrid > .gu-rulesec').forEach(sec => {
    if (!q) {
      sec.hidden = sec.getAttribute('data-gu-sec') !== cur;
      sec.querySelectorAll('.gu-rule').forEach(row => { row.hidden = false; });
      return;
    }
    const title = ((sec.querySelector('.gu-cardtitle') || {}).textContent || '').toLowerCase();
    const whole = title.indexOf(q) >= 0;
    let any = whole;
    sec.querySelectorAll('.gu-rule').forEach(row => {
      const hit = whole || row.textContent.toLowerCase().indexOf(q) >= 0;
      row.hidden = !hit;
      if (hit) any = true;
    });
    sec.hidden = !any;
  });
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
// One log line: date, what, the change, and why (Plan v5 §L G5).
function guLogLine(e) {
  const said = e.summary || mrLogSummary(e.from, e.to) || `${e.from == null ? '—' : String(e.from)} → ${e.to == null ? '—' : String(e.to)}`;
  return `<div class="gu-log"><b>${escapeHtml(mnyShortDate(toDayKeyInZone(new Date(e.at))))}</b> ${escapeHtml(e.note || e.path)} ${escapeHtml(said)} <span class="gu-why">· ${escapeHtml(mrReasonLabel(e.reason))}</span></div>`;
}
function guRulesSide() {
  const saved = guSavedRules(), R = guPendingRules();
  const kids = {};
  GU_KIDS.forEach(k => { kids[k] = guTypicalWeek(k, saved); });
  const impact = sdImpact(saved, R, kids, ctThisWeekKey());
  // 🎯 "This year vs target" (Plan v5 §K): what she has earned this year, against the saved and the changed target.
  impact.forEach(k => {
    const ytd = mrYearToDate(k.kid).paidTotal;
    const was = Number(mrGetPath(saved, 'targets.' + k.kid + '.annual')) || 0;
    const now = Number(mrGetPath(R, 'targets.' + k.kid + '.annual')) || 0;
    const a = `${guMoney$(ytd)} of ${guMoney$(was)}`, b = `${guMoney$(ytd)} of ${guMoney$(now)}`;
    k.rows.push({ k: 'This year vs target', v: a === b ? a : `${a} → ${b}`, changed: a !== b });
  });
  const changed = guRuleChanges(saved);
  const sees = changed.map(p => {
    const d = guRuleRowFor(p.path);
    return `“${d ? d.label : p.label}: now ${d ? guFmt(d.unit, p.value) : String(p.value)} (was ${d ? guFmt(d.unit, mrGetPath(saved, p.path)) : String(mrGetPath(saved, p.path))})”`;
  });
  return `<div class="gu-sidehead">What this changes</div>
    <div class="gu-line gu-purpose">${changed.length ? 'Before → after, for a typical week.' : 'Change a number to see what it does.'}</div>
    ${impact.map(k => `<div class="gu-card gu-impact ${'gu-tint--' + k.kid}"><div class="gu-cardtitle">${escapeHtml(mnyKidName(k.kid))}</div>
      ${k.rows.map(r => `<div class="gu-kv${r.changed ? ' changed' : ''}"><span>${escapeHtml(r.k)}</span><b>${escapeHtml(r.v)}</b></div>`).join('')}</div>`).join('')}
    <div class="gu-card gu-sees">
      <div class="gu-cardtitle">👀 What the girls will see on Sunday</div>
      <div class="gu-line">${escapeHtml(sees.length ? sees.join(' · ') : 'Nothing new — no changes yet.')}</div>
    </div>`;
}
/* The pending list, less anything that is back at its saved value. */
function guRuleChanges(saved) {
  return mnyPending.filter(p => JSON.stringify(mrGetPath(saved || guSavedRules(), p.path)) !== JSON.stringify(p.value));
}
/* The save strip along the bottom (as drawn): what changed, why (reason
   chips), ↺ Undo, "start this week instead" and Save · starts next Sunday. */
function guSaveStrip() {
  const saved = guSavedRules();
  const changed = guRuleChanges(saved);
  const said = (p) => {
    const d = guRuleRowFor(p.path);
    return `${d ? d.label : p.label} ${d ? guFmt(d.unit, mrGetPath(saved, p.path)) : String(mrGetPath(saved, p.path))} → ${d ? guFmt(d.unit, p.value) : String(p.value)}`;
  };
  return `<div class="gu-card gu-saverules${changed.length ? ' gu-saverules--on' : ''}">
      <div class="gu-line"><b>${escapeHtml(changed.length ? `${changed.length} change${changed.length === 1 ? '' : 's'}:` : 'No changes yet.')}</b> ${escapeHtml(changed.length ? changed.map(said).join(' · ') : 'Tap − or + on any rule. The girls see what changed on their next Sunday.')}</div>
      <div class="gu-opts gu-reasons"><span class="gu-line">Why:</span>${MR_REASONS.map(r =>
        guOpt(r.label, guRuleReason === r.id, 'gureason', ` data-mnyp-id="${escapeAttr(r.id)}"`)).join('')}</div>
      <div class="gu-saverow">
        <button type="button" class="gu-btn" data-mnyp-action="gurulediscard">↺ Undo</button>
        <button type="button" class="gu-check-toggle${guRuleThisWeek ? ' on' : ''}" role="checkbox" aria-checked="${guRuleThisWeek}" data-mnyp-action="guthisweek"><span class="gu-box" aria-hidden="true">${guRuleThisWeek ? '✓' : ''}</span>start this week instead</button>
        <span class="gu-line">weeks already signed keep their rules</span>
        <button type="button" class="gu-save${changed.length ? ' ready' : ''}" data-mnyp-action="gurulesave">Save · starts next Sunday</button>
      </div>
    </div>`;
}
function guStepRule(el) {
  const path = el.getAttribute('data-mnyp-path');
  const step = Number(el.getAttribute('data-mnyp-d')) || 0;
  const row = guRuleRowFor(path);
  if (!row) return;
  const cur = Number(mrGetPath(guPendingRules(), path)) || 0;
  const next = row.unit === 'st' ? Math.min(3, Math.max(1, cur + step))
    : row.unit === 'n' ? Math.max(0, Math.round(cur + step))
    : Math.max(0, Math.round((cur + step) * 100) / 100);
  if (path.indexOf('school.stagePct.') === 0) {
    const why = mnyStagePctRefusal({ [path.split('.').pop()]: next });
    if (why) { showToast(why); return; }
  }
  mnyQueueEdit(path, next, row.label);
}
/* "Save · starts next Sunday": the pending list as ONE version from next
   Monday (Plan v3 §C), with the reason chosen beside it (Plan v5 §L G6).
   "Start this week instead" dates it from this week's Monday — the house
   rules' date, refused while a later change is already scheduled. */
function guSaveRules(thisWeek) {
  if (thisWeek == null) thisWeek = guRuleThisWeek;
  if (!mnyPending.length) { showToast('No changes yet. Tap − or + on any rule.'); return; }
  const from = thisWeek ? mrHouseRulesFrom() : guNextMonday();
  if (!from) { showToast('A rules change is already scheduled — this one can start this week once that one has.'); return; }
  mnyPendingFrom = from;
  mnyPendingReason = guRuleReason;
  mnySavePending();
  mnyPendingReason = MR_DEFAULT_REASON;
}

/* ════════════ 📒 WEEKS (Plan v5 Deviation 16, §K; Plan v9 §M 5b / §N) ════════════
   Both girls side by side, as the owner asked (G7-2). On top a summary per
   girl — earned this year (and against her target), loan left, a typical
   week (`guSteady`, the same 4-Sunday average Commitments' affordability
   reads), whether the loan payments are on track, and a saving line (the
   core's `sdSavingLine` over her last 4 Sundays). Then every Sunday, newest
   on top, one row per Sunday with each girl's cell in the passbook's style
   (`mnyPassbookRow`): what came in, the bar of where it went, and a tag —
   ✓ signed (frozen) · ✏️ typed in (✏️ Fix) · 👴 Grandfather rule
   (read-only: its money is already in her wallet). Tapping a Sunday opens
   that week's whole record for both girls (`guWeekRecord`), read from the
   frozen ledger row and the records that week used — no store of its own.
   ＋ Add a week before … sits under each girl (`mnyAddMissedWeek`). */
let guWeekDay = null;       // 📒 Weeks: the Sunday open in full (a week key)
function guWeekTag(r) {
  if (r.defaulted) return r.defaultReason === 'grandma' ? '👴 Grandfather rule' : 'nobody met';
  if (r.repricedAt) return 're-priced';
  if (r.handEntered) return '✏️ typed in';
  if (r.weeksLate) return `settled ${r.weeksLate}wk late`;
  return '✓ signed';
}
const GU_LED_FIELDS = [['chores', 'Jobs', 1], ['learning', 'Learning', 1], ['streak', 'Routines', 1],
  ['competition', 'Competitions', 5], ['outside', 'From outside', 5], ['fines', 'Taken off', 1],
  ['ready', 'Savings', 1], ['gic', 'Locked away', 5], ['stock', 'Companies', 1], ['debtExtra', 'Paid off early', 1]];
function guTypedWeekFields(kid, r) {
  const ids = (f, d) => ` data-mnyp-kid="${kid}" data-mnyp-id="${escapeAttr(r.weekKey)}" data-mnyp-f="${f}" data-mnyp-d="${d}"`;
  const inTotal = money2(money2(r.chores) + money2(r.learning) + money2(r.streak) + money2(r.competition) + money2(r.outside));
  const outTotal = money2(money2((r.loan || {}).paid) + money2(r.debtExtra) + money2(r.ready) + money2(r.gic) + money2(r.stock));
  const gap = money2(inTotal - money2(r.fines) - outTotal);
  return `<div class="gu-weekfix">
      ${GU_LED_FIELDS.map(([f, label, step]) => `<div class="gu-ovrow"><span>${escapeHtml(label)}</span>
        <span class="gu-pair"><button type="button" class="gu-step" data-mnyp-action="guled"${ids(f, -step)} aria-label="Less">−</button><b class="gu-num">${escapeHtml(f === 'fines' ? sdOff$(r[f], mnyMoney) : mnyMoney(r[f]))}</b><button type="button" class="gu-step" data-mnyp-action="guled"${ids(f, step)} aria-label="More">+</button></span></div>`).join('')}
      <div class="gu-kv"><span>In minus out</span><b>${escapeHtml(mnySigned(gap))}</b></div>
      ${Math.abs(gap) > 0.005 ? `<div class="gu-line gu-warnline">These do not balance yet — ${escapeHtml(mnyMoney(Math.abs(gap)))} is unaccounted for.</div>` : ''}
      <button type="button" class="gu-btn" data-mnyp-action="guleddel" data-mnyp-kid="${kid}" data-mnyp-id="${escapeAttr(r.weekKey)}">Remove this week</button>
    </div>`;
}
/* The summary per girl (§N "Weeks"). */
function guWeeksSummary(kid) {
  const y = mrYearToDate(kid);
  const R = mrSundayRules(ctThisWeekKey());
  const target = Number(mrRuleOr(R, 'targets.' + kid + '.annual')) || y.target || 0;
  const earned = guEarnedThisYear(kid);
  const left = mnyTotalOwing(kid);
  const owed = money2(mnyEnsureDebts(kid).reduce((a, d) => a + (loanBalance(kid, d.id) > 0 ? money2(d.arrears) : 0), 0));
  const rows = mnyLedgerRows(kid).slice(0, 4).map(mnyPassbookRow);
  const line = sdSavingLine(rows, left > 0, R);
  const kv = (k, v, cls) => `<div class="gu-kv${cls ? ' ' + cls : ''}"><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>`;
  return `<div class="gu-card gu-weeksum ${'gu-tint--' + kid}">
      <div class="gu-cardhead"><span class="gu-cardtitle">${escapeHtml(mnyKidName(kid))}</span></div>
      ${kv('Earned this year', target > 0 ? `${guMoney$(earned)} of ${guMoney$(target)} · ${Math.round(earned / target * 100)}%` : guMoney$(earned))}
      ${kv('Loan left', guMoney$(left))}
      ${kv('Typical week', guMoney$(guSteady(kid)))}
      ${kv('Loan payments', left <= 0 ? '✓ nothing owed' : owed > 0 ? `📌 ${guMoney$(owed)} still owed` : '✓ on track', owed > 0 ? 'gu-warnline' : '')}
      <div class="gu-line gu-saveline">${escapeHtml(line.word
        ? `Saving: ${line.word} — ${line.pct}% of her last ${line.sundays} Sunday${line.sundays === 1 ? '' : 's'} went to Savings, goal jars, Locked away and Companies${line.extra ? '. ' + line.extra.charAt(0).toUpperCase() + line.extra.slice(1) : ''}.`
        : 'Saving: no signed Sundays yet.')}</div>
    </div>`;
}
/* "Earned this year" (Plan v17 item 8): the same frozen ledger rows the
   list under it shows — each Sunday of this calendar year, what she earned
   after fines (`mnyPassbookRow(r).earned`). It read `mrYearToDate`'s
   `finalizedWeeks` before, which a typed-in or Grandfather week never
   touches, so the summary said $40 while the rows below said $215. */
function guEarnedThisYear(kid) {
  const year = String(todayKey()).slice(0, 4);
  return money2(mnyLedgerRows(kid).filter(r => String(sdSundayOf(r.weekKey)).slice(0, 4) === year)
    .reduce((a, r) => a + mnyPassbookRow(r).earned, 0));
}
/* One girl's cell for one Sunday in the list. */
function guWeekCell(kid, r) {
  if (!r) return `<div class="gu-weekcell gu-weekcell--none ${'gu-tint--' + kid}"><span class="gu-line">—</span></div>`;
  const p = mnyPassbookRow(r);
  const open = guWeekOpen === r.weekKey && guWeeksKid === kid && r.handEntered && !r.defaulted;
  const tag = guWeekTag(r);
  const fixable = r.handEntered && !r.defaulted;
  const parts = r.defaulted ? `cash ${mnyMoney(p.cash || money2(money2(r.gross)))}`
    : `wall ${mnyMoney(p.wall)} · saved ${mnyMoney(p.saved)} · cash ${mnyMoney(p.cash)}`;
  return `<div class="gu-weekcell ${'gu-tint--' + kid}${r.defaulted ? ' gu-weekrow--gf' : ''}">
      <div class="gu-weekcell-top"><b class="gu-weekin">${escapeHtml(mnyMoney(p.inAmt))}</b>
        <span class="mv2-bookbar mv2-bookbar--out gu-weekbar"><i class="mv2-sw--wall" style="flex:${p.wall} 0 0"></i><i class="mv2-sw--saved" style="flex:${p.saved} 0 0"></i><i class="mv2-sw--cash" style="flex:${r.defaulted ? Math.max(1, p.cash) : p.cash} 0 0"></i></span>
        <span class="gu-weektagchip">${escapeHtml(tag)}</span>
        ${fixable ? `<button type="button" class="gu-btn" aria-expanded="${open}" data-mnyp-action="guweekopen" data-mnyp-kid="${kid}" data-mnyp-id="${escapeAttr(r.weekKey)}">${open ? 'Done' : '✏️ Fix'}</button>` : ''}</div>
      <div class="gu-line">${escapeHtml(parts)}</div>
      ${r.defaulted ? `<div class="gu-line">${escapeHtml(r.defaultReason === 'grandma' ? '👴 Grandfather rule' : 'No meeting — default')} ${escapeHtml(mnyMoney(money2(money2(r.gross) - money2(r.competition))))} + competitions ${escapeHtml(mnyMoney(r.competition))} · already in her wallet, so it is not edited here; a competition is corrected through the competition.</div>` : ''}
      ${open ? guTypedWeekFields(kid, r) : ''}
    </div>`;
}
function guWeeksMain() {
  const rowsBy = {};
  GU_KIDS.forEach(k => { rowsBy[k] = {}; mnyLedgerRows(k).forEach(r => { rowsBy[k][r.weekKey] = r; }); });
  const weeks = Array.from(new Set(GU_KIDS.flatMap(k => Object.keys(rowsBy[k])))).sort().reverse();
  const list = weeks.map(wk => {
    const on = guWeekDay === wk;
    return `<div class="gu-weekline${on ? ' on' : ''}">
        <button type="button" class="gu-weekday" data-mnyp-action="guweekday" data-mnyp-id="${escapeAttr(wk)}" aria-expanded="${on}">${escapeHtml(mrMoneyWeekLabel(wk))}</button>
        ${GU_KIDS.map(k => guWeekCell(k, rowsBy[k][wk])).join('')}
      </div>
      ${on ? `<div class="gu-weekdetail">${GU_KIDS.map(k => guWeekRecord(k, wk, rowsBy[k][wk])).join('')}</div>` : ''}`;
  }).join('');
  const earliest = (k) => { const ks = Object.keys(rowsBy[k]).sort(); return ks[0] || ctThisWeekKey(); };
  const foot = GU_KIDS.map(k => {
    const rows = Object.values(rowsBy[k]);
    const signed = rows.filter(r => !r.handEntered && !r.defaulted).length;
    const typed = rows.filter(r => r.handEntered && !r.defaulted).length;
    const gf = rows.filter(r => r.defaulted).length;
    const tot = money2(rows.reduce((a, r) => a + mnyPassbookRow(r).inAmt, 0));
    return `<div class="gu-weekcell ${'gu-tint--' + k}"><b>${escapeHtml(guMoney$(tot))}</b> <span class="gu-line">${signed} signed · ${typed} typed in · ${gf} Grandfather</span></div>`;
  }).join('');
  return `${guHead('📒 Past weeks', 'Both girls, lined up by Sunday. Signed weeks are frozen; typed-in weeks can be fixed. Tap a Sunday for the whole record.')}
    <div class="gu-cards2">${GU_KIDS.map(guWeeksSummary).join('')}</div>
    <div class="gu-weekkey"><span><i class="mv2-sw mv2-sw--wall"></i>to the wall</span><span><i class="mv2-sw mv2-sw--saved"></i>saved</span><span><i class="mv2-sw mv2-sw--cash"></i>cash</span>
      <span>✓ signed on Sunday, frozen · ✏️ typed in from memory, fixable · 👴 Grandfather flat rule, read-only</span></div>
    <div class="gu-card gu-weeks">
      <div class="gu-weekline gu-weekhead"><span>Money week</span>${GU_KIDS.map(k => `<span>${guKidChip(k)} in · where it went</span>`).join('')}</div>
      ${weeks.length ? list : '<div class="gu-line">No Sundays on record yet.</div>'}
      <div class="gu-weekline"><span></span>${GU_KIDS.map(k => `<button type="button" class="gu-btn gu-addweek" data-mnyp-action="guaddweek" data-mnyp-kid="${k}">＋ Add a week before ${escapeHtml(mnyDayMonth(sdSundayOf(earliest(k))))}</button>`).join('')}</div>
      <div class="gu-weekline gu-weekfoot"><b>${weeks.length} Sunday${weeks.length === 1 ? '' : 's'}</b>${foot}</div>
    </div>`;
}
/* One girl's whole record of one Sunday (§N "Weeks", tapping a Sunday):
   every Payday line with its working, the fines with their item and day,
   money drawn early, a grown-up's changes with the reason, the loan (must
   pay, extra and what it counted, interest added), where every dollar went,
   the stickers, the verdict, her answer, who signed and when, and the rules
   version. A row from before the ledger kept these keeps what it kept. */
function guWeekRecord(kid, wk, r) {
  const head = `<div class="gu-cardhead"><span class="gu-cardtitle">${escapeHtml(mnyKidName(kid))} · Sunday ${escapeHtml(mnyDayMonth(sdSundayOf(wk)))}</span></div>`;
  if (!r) return `<div class="gu-card gu-record gu-record--none ${'gu-tint--' + kid}"><div class="gu-line">${escapeHtml(`${mnyKidName(kid)} · no Sunday on record for ${mnyDayMonth(sdSundayOf(wk))}.`)}</div></div>`;
  const kv = (k, v, sub) => `<div class="gu-kv"><span>${escapeHtml(k)}${sub ? `<span class="gu-she">${escapeHtml(sub)}</span>` : ''}</span><b>${escapeHtml(v)}</b></div>`;
  const sec = (title, html) => html ? `<div class="gu-rec-sec"><div class="gu-rec-title">${escapeHtml(title)}</div>${html}</div>` : '';
  const m = (v) => mnyMoney(Number(v) || 0);
  const kept = r.sunday || r.days || r.choresRaw != null;
  if (r.defaulted || !kept) {
    const what = r.defaulted ? (r.defaultReason === 'grandma' ? '👴 Grandfather rule' : 'No meeting — default') : (r.handEntered ? '✏️ Typed in from memory' : 'Settled before the full record was kept');
    return `<div class="gu-card gu-record ${'gu-tint--' + kid}">${head}<div class="gu-line">${escapeHtml(what)} — earned only.</div>
      ${kv('Came in', m(mnyPassbookRow(r).inAmt))}${kv('Loan paid', m((r.loan || {}).paid))}${kv('Saved', m(mnyPassbookRow(r).saved))}${kv('Cash', m(r.spend))}</div>`;
  }
  const days = Array.isArray(r.days) ? r.days : [];
  const inDays = (k) => days.length ? days.indexOf(k) >= 0 : String(ctWeekKeyForDate(k)) === String(wk);
  // 💪 Payday, with the working each line kept.
  const comps = mrCompetitions(kid).filter(c => c && (String(ctWeekKeyForDate(c.dayKey)) === String(wk)));
  const deps = mnyDepositsForWeek(kid, wk).filter(d => d && !d.pendingApproval && !d.rejectedAt);
  const pb = mnyPassbookRow(Object.assign({}, r, { weekKey: wk }));   // the passbook's own reading of the row
  const payday = [
    kv('🧹 Chores', m(r.chores), `${days.length || 7} days · ${r.freeChores || 0} free${r.overflowChores ? ` · ${r.overflowChores} past the cap (XP)` : ''}${r.choresRaw != null && money2(r.choresRaw) !== money2(r.chores) ? ` · graded ${m(r.choresRaw)}` : ''}`),
    Number(r.learning) ? kv('📘 Learning', m(r.learning)) : '',
    kv('🔥 Routine', m(r.streak), `${r.streakDays || 0} days kept`),
    kv('⛸️ Club job', m(r.sessionsPaid), `${r.sessions || 0} session${r.sessions === 1 ? '' : 's'} attended`),
    kv('🏆 Competitions', m(r.competition), comps.map(c => `${c.name || mnySportLabel(c.sport)} · ${Number(c.points) || 0} pts${(c.placement || {}).group ? ` · group ${rqOrd(c.placement.group)}` : ''} · ${guMoney$(mrCompAward(c))}${c.awardedOverride ? ' (a parent made it ' + guMoney$(c.awardedOverride.value) + ')' : ''}`).join(' | ')),
    kv('🎁 Given', m(pb.given), deps.filter(d => !sdIsHomeCash(d)).map(d => `${d.giver || d.from || 'a gift'} ${guMoney$(d.amount)}`).join(' · ')),
    kv('🌱 Money made', m(pb.made)),
    // Cash from home is her own money, not a gift (Plan v17 item 10).
    r.groups && Number(r.groups.bank) ? kv('📥 From my bank', m(r.groups.bank), deps.filter(sdIsHomeCash).map(d => `🏠 ${guMoney$(d.amount)}`).join(' · ')) : '',
  ].join('');
  const fines = mrFines(kid).filter(f => f && inDays(f.dayKey))
    .map(f => kv(`📦 ${guFineLabel(f.itemId)}`, '', `${guDayName(f.dayKey)} ${mnyDayMonth(f.dayKey)}${f.who ? ' · ' + f.who : ''}`)).join('');
  const advReqs = mnyEnsureRequests(kid).filter(q => q && q.kind === 'adv' && q.appliedWeek === wk);
  const advLine = (amt, q) => `<div class="gu-kv gu-advline"><span>${escapeHtml(`⏪ Drawn early ${sdOff$(amt, mnyMoney)}${q && q.why ? ' · ' + q.why : ''}${q && q.agreed && q.agreed.asked != null ? ` (asked ${guMoney$(q.agreed.asked)}, agreed ${guMoney$(q.agreed.value)})` : ''}`)}</span></div>`;
  const advs = advReqs.length
    ? advReqs.map(q => advLine(q.appliedAmount != null ? q.appliedAmount : q.amount, q)).join('')
    : (Number(r.advance) ? advLine(r.advance, null) : '');
  const agreed = mnyRequestsFor(kid).filter(q => q.applied && q.record.appliedWeek === wk && q.asked != null && q.kind !== 'adv')
    .map(q => kv(`💬 ${q.icon} ${q.text}`, `agreed ${guMoney$(q.agreed)}`, `asked ${guMoney$(q.asked)}`)).join('');
  const ov = ((getProfData(kid).earnings || {})[wk] || {}).overrides || {};
  const edits = Object.keys(ov).map(ch => kv(`✏️ ${ch}`, m((ov[ch] || {}).value), `${mnyReasonLabel((ov[ch] || {}).reason)} · a grown-up`)).join('');
  const L = r.loan || {};
  const bonus = Number(mrRuleOr(mrRulesForWeek(wk), 'loan.extraBonusPct')) || 0;
  const loan = [
    L.must != null ? kv('📌 Must pay', m(L.must), Number(L.shortfall) ? `${m(L.shortfall)} still owed after` : '') : '',
    kv('🧱 Paid', m(L.paid)),
    Number(r.extra) ? kv('🧱 Extra', m(r.extra), `counted ${m(L.extraCredited != null ? L.extraCredited : r.extra * (1 + bonus / 100))}`) : '',
    Number(L.interest) ? kv('🟥 Interest added', m(L.interest)) : '',
  ].join('');
  const goalsHtml = Object.keys(r.goals || {}).map(id => {
    const g = (getProfData(kid).savingGoals || []).find(x => x && x.id === id);
    return kv(`🎯 ${g ? (g.icon || '') + ' ' + g.name : 'Goal jar'}`, m(r.goals[id]));
  }).join('');
  const went = [
    kv('🧱 Loan wall', m(money2((Number(L.paid) || 0) + (Number(r.extra) || 0)))),
    kv('🏦 Savings', m(r.ready), Number(r.cents) ? `with ${m(r.cents)} of change` : ''),
    goalsHtml || (Number(r.goal) ? kv('🎯 Goal jars', m(r.goal)) : ''),
    Number(r.gic) ? kv('🔒 Locked away', m(r.gic)) : '',
    Number(r.stock) ? kv('📈 Companies', m(r.stock)) : '',
    kv('💵 Cash out', m(r.cashOut != null ? r.cashOut : r.spend)),
  ].join('');
  const stickers = sdStickersFor({ extra: Number(r.extra) || 0, ready: Number(r.ready) || 0, gic: Number(r.gic) || 0, stock: Number(r.stock) || 0,
    wallet: Number(r.spend) || 0, guess: r.guess != null ? Number(r.guess) : null, payday: Number(r.payday) || 0 })
    .map(id => (SD_STICKERS.find(s => s[0] === id) || [])[1] || '').join(' ');
  let verdict = '';
  if (r.sunday && r.sunday.signed) {
    try {
      const res = { signed: r.sunday.signed, after: Object.assign({}, r.sunday.after) };
      const v = sdVerdicts(res, Object.assign({}, r.sunday.w, { alloc: {} }), mrSundayRules(wk));
      verdict = [v.income && v.income.head, v.strategy && (v.strategy.head + ' — ' + v.strategy.why)].filter(Boolean)
        .map(x => `<div class="gu-line">${escapeHtml(x)}</div>`).join('');
    } catch (e) { verdict = ''; }
  }
  const plan = (mnyEnsureWeekMaps().weekPlans[wk] || {})[kid] || {};
  const pid = plan.reflect || plan.presetId;
  const chip = pid ? MNY_REFLECT.chips.find(x => x.id === pid) : null;
  const answer = chip ? chip.label : (plan.reflect || (plan.planId === 'sunday' ? 'She placed it herself, box by box.' : ''));
  const signedAt = r.updatedAt || r.at;
  return `<div class="gu-card gu-record ${'gu-tint--' + kid}">${head}
      ${sec('💪 Payday', payday)}
      ${sec('➖ Taken off', (Number(r.fines) ? kv('📦 Fines', sdOff$(r.fines, mnyMoney)) : '') + fines + advs)}
      ${sec('✏️ Changed by a grown-up', edits + (r.editReason && !edits ? kv('✏️ Lines changed', (r.edited || []).join(', '), mnyReasonLabel(r.editReason)) : ''))}
      ${sec('💬 Agreed at the meeting', agreed)}
      ${sec('🧱 Loan', loan)}
      ${sec('Where every dollar went', went)}
      ${stickers ? sec('⭐ Stickers', `<div class="gu-line">${escapeHtml(stickers)}</div>`) : ''}
      ${sec('Verdict', verdict)}
      ${answer ? sec('💬 Her answer', `<div class="gu-line">${escapeHtml(MNY_REFLECT.question)} “${escapeHtml(answer)}”${r.guess != null ? escapeHtml(` · she guessed $${r.guess}`) : ''}</div>`) : ''}
      <div class="gu-line gu-rec-foot">${escapeHtml(`Signed by ${r.confirmedBy || 'a grown-up'}${signedAt ? ' · ' + new Date(signedAt).toLocaleString('en-US', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''} · ${r.rulesEffectiveFrom ? 'rules of ' + mnyShortDate(r.rulesEffectiveFrom) : 'the rules of that week'}`)}</div>
    </div>`;
}

/* ════════════ ✏️ The fix sheets (#grownupsOverlay) ════════════
   ✏️ Fix this row (➕ Commitments, Plan v5 §K / G2): name, icon, what it
   started at, paid, remove — through `mnyEditDebt` / `mnyRemoveDebt`, which
   log every change and never touch `payments`. ✏️ Fix what she owns
   (Plan v5 §L G3): each holding's numbers by hand, through `mnyEditHolding`
   (mirrored to the stream as a correction), add or remove. 📝 All rule
   changes (Plan v5 §L G5). Actions are `data-mnyp-action` under
   #grownupsBody, which mnyParentClick / mnyParentInput are bound to. */
/* 📝 Rule changes shows RULE changes only (owner's review G6-14): the log
   also keeps a loan row's corrections and the club's "paid through" date,
   which stay on the record but are not rule changes. */
function guRuleLog() {
  return mrLogEntries().filter(e => !/^(debts|clubPaidThrough)\./.test(String((e && e.path) || '')));
}
function guOpenSheet(kind, kid, id) {
  guSheet = { kind, kid: kid || 'jenn', id: id || null };
  openSheet('grownupsOverlay');
  guRenderSheet();
}
function guCloseSheet() { guSheet = null; closeSheet('grownupsOverlay'); }
function guRenderSheet() {
  const body = document.getElementById('grownupsBody');
  const title = document.getElementById('guSheetTitle');
  if (!body || !guSheet) return;
  const s = guSheet;
  let t = '', html = '';
  if (s.kind === 'loan') {
    const d = mnyDebtById(s.kid, s.id);
    if (!d) { guCloseSheet(); return; }
    t = '✏️ Fix this row';
    html = guFixLoanBody(s.kid, d);
  } else if (s.kind === 'owns') {
    t = `✏️ Fix what ${mnyKidName(s.kid)} owns`;
    html = guFixOwnsBody(s.kid);
  } else {
    t = '📝 Every rule change';
    html = `<div class="gu-card gu-plain">${guRuleLog().slice(0, 200).map(guLogLine).join('') || '<div class="gu-log">No changes yet.</div>'}</div>`;
  }
  title.textContent = t;
  body.innerHTML = `<div class="gu">${html}
      <button type="button" class="gu-save ready gu-save--end" data-mnyp-action="gusheetclose">Done</button></div>`;
}
function guFixLoanBody(kid, d) {
  const ids = ` data-mnyp-kid="${kid}" data-mnyp-id="${escapeAttr(d.id)}"`;
  const icons = MNY_DEBT_ICONS.concat(['🆕', '🌧️'].concat(MNY_DEBT_ICONS.indexOf(d.icon) < 0 && ['🆕', '🌧️'].indexOf(d.icon) < 0 && d.icon ? [d.icon] : []));
  const num = (label, f, step, pct) => `<div class="gu-rule"><div class="gu-rule-words"><span>${escapeHtml(label)}</span></div>
      <span class="gu-pair"><button type="button" class="gu-step" data-mnyp-action="gufixdebt" data-mnyp-f="${f}" data-mnyp-d="${-step}"${ids} aria-label="Less">−</button>
      <b class="gu-ruleval">${escapeHtml(pct ? money2(d[f]) + '%' : mnyMoney(d[f]))}</b>
      <button type="button" class="gu-step" data-mnyp-action="gufixdebt" data-mnyp-f="${f}" data-mnyp-d="${step}"${ids} aria-label="More">+</button></span></div>`;
  return `<div class="gu-card gu-form ${'gu-tint--' + kid}">
      <div class="gu-cardhead"><span class="gu-cardtitle">${escapeHtml(mnyKidName(kid))} · ${escapeHtml(d.icon || '')} ${escapeHtml(d.name)}</span><b class="gu-fig">${escapeHtml(mnyMoney(loanBalance(kid, d.id)))} left</b></div>
      <label class="gu-q" for="guFixLoanName">What it is called — she sees this everywhere</label>
      <input class="gu-input" id="guFixLoanName" type="text" value="${escapeAttr(d.name)}" data-mnyp-action="gufixname"${ids}>
      <div class="gu-opts">${icons.map(ic => guOpt(ic, d.icon === ic, 'gufixicon', `${ids} data-mnyp-ic="${escapeAttr(ic)}"`)).join('')}</div>
      <label class="gu-q" for="guFixLoanItem">What it bought</label>
      <input class="gu-input" id="guFixLoanItem" type="text" value="${escapeAttr(d.item || '')}" placeholder="skates" data-mnyp-action="gufixitem"${ids}>
      ${num('What it started at', 'principal', 25)}
      ${num('Paid off so far', 'paid', 5)}
      ${num('Each month', 'monthly', 5)}
      ${num('Bonus for paying early', 'bonusRate', 5, true)}
      <div class="gu-line">A correction is kept with its date and never touches the payments she made.</div>
      <button type="button" class="gu-btn" data-mnyp-action="gufixdel"${ids}>Remove this row</button>
    </div>
    <button type="button" class="gu-btn" data-mnyp-action="gufixadd" data-mnyp-kid="${kid}">＋ Add another loan</button>`;
}
function guFixOwnsBody(kid) {
  const cards = mnyHoldings(kid).map(h => {
    const ids = ` data-mnyp-kid="${kid}" data-mnyp-id="${escapeAttr(h.id)}"`;
    const bump = (label, f, step) => `<div class="gu-rule"><div class="gu-rule-words"><span>${escapeHtml(label)}</span></div>
        <span class="gu-pair"><button type="button" class="gu-step" data-mnyp-action="gufixhold" data-mnyp-f="${f}" data-mnyp-d="${-step}"${ids} aria-label="Less">−</button>
        <b class="gu-ruleval">${escapeHtml(f === 'rateAnnual' ? mnyPctOf(h[f]) : f === 'units' ? String(Math.round(h.units * 1000) / 1000) : mnyMoney(h[f]))}</b>
        <button type="button" class="gu-step" data-mnyp-action="gufixhold" data-mnyp-f="${f}" data-mnyp-d="${step}"${ids} aria-label="More">+</button></span></div>`;
    return `<div class="gu-card gu-form">
        <div class="gu-cardhead"><span class="gu-cardtitle">${escapeHtml(h.name)}</span><b class="gu-fig">${escapeHtml(mnyMoney(mnyHoldingValue(h)))}</b>
          <button type="button" class="gu-x" data-mnyp-action="gufixholddel"${ids} aria-label="Remove this">✕</button></div>
        <div class="gu-opts">${MNY_HOLDING_KINDS.map(k => guOpt(k.icon + ' ' + k.label, h.kind === k.id, 'gufixholdkind', `${ids} data-mnyp-k="${k.id}"`)).join('')}</div>
        <input class="gu-input" type="text" value="${escapeAttr(h.name)}" data-mnyp-action="gufixholdname"${ids} aria-label="What she calls it">
        ${h.ticker ? bump('How many', 'units', 1) : ''}
        ${bump(h.ticker ? 'Worth each, today' : 'Worth today', 'priceNow', 5)}
        ${bump('What it cost', 'costBasis', 5)}
        ${h.ticker ? '' : bump('Growth a year', 'rateAnnual', 0.005)}
        ${h.kind === 'gic' ? `<label class="gu-rule"><span class="gu-rule-words"><span>Comes back on</span></span>
          <input class="gu-input gu-date" type="date" value="${escapeAttr(h.maturesOn || '')}" data-mnyp-action="gufixholddate"${ids}></label>` : ''}
      </div>`;
  }).join('');
  return `<div class="gu-line">Kept truthful by hand: each change is a correction on her record, so every total still adds up.</div>
    ${cards || '<div class="gu-line">Nothing held yet.</div>'}
    <button type="button" class="gu-btn" data-mnyp-action="gufixholdadd" data-mnyp-kid="${kid}">＋ Add something she owns</button>`;
}

/* ════════════ Taps and typing, handed over from js/24 ════════════ */
function guAction(a, el) {
  const id = el.getAttribute('data-mnyp-id');
  const kid = el.getAttribute('data-mnyp-kid');
  const d = Number(el.getAttribute('data-mnyp-d')) || 0;
  if (a === 'gutab') {
    if (guIsTab(id)) mnyParentSection = id;
    mnyRenderRulesTab();
    return;
  }
  if (a === 'gusheetclose') { guCloseSheet(); return; }
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
  } else if (a === 'guovopen') { guOvOpen[kid] = !guOvOpen[kid];
  } else if (a === 'guov') { guStepOverride(kid, id, d);
  } else if (a === 'guovreset') { mnyClearOverride(kid, ctThisWeekKey(), id);
  } else if (a === 'guovreason') { mnyPickReason(id, kid, ctThisWeekKey());
  } else if (a === 'guboughtit') {
    if (mnyCompleteGoal(kid, id)) showToast('🎉 Bought — the jar is empty and the money is spent');
  } else if (a === 'gufixowns') { guOpenSheet('owns', kid); return;
  // ✏️ the fix sheets
  } else if (a === 'gufixdebt') {
    const rec = mnyDebtById(kid, id), f = el.getAttribute('data-mnyp-f');
    // The row's own fields, back at the owner's review (G3-2): monthly and the
    // early bonus too. Payments are never touched (mnyEditDebt).
    if (rec && ['principal', 'paid', 'monthly', 'bonusRate'].indexOf(f) >= 0) mnyEditDebt(kid, id, f, Math.max(0, money2(money2(rec[f]) + d)));
  } else if (a === 'gufixadd') {
    // ＋ Add another loan (G3-2): a row to fix into shape, opened at once.
    const nd = mnyAddDebt(kid, { name: 'New loan', icon: '🚲', principal: 100, monthly: 10 });
    if (nd) { guOpenSheet('loan', kid, nd.id); return; }
  } else if (a === 'gufixicon') { mnyEditDebt(kid, id, 'icon', el.getAttribute('data-mnyp-ic'));
  } else if (a === 'gufixdel') { if (mnyRemoveDebt(kid, id)) guCloseSheet();
  } else if (a === 'gufixhold') {
    const f = el.getAttribute('data-mnyp-f');
    const h = mnyHoldings(kid).find(x => x.id === id);
    if (h && ['units', 'priceNow', 'costBasis', 'rateAnnual'].indexOf(f) >= 0) {
      mnyEditHolding(kid, id, f, Math.max(0, Math.round(((Number(h[f]) || 0) + d) * 1000) / 1000));
    }
  } else if (a === 'gufixholdkind') { mnyEditHolding(kid, id, 'kind', el.getAttribute('data-mnyp-k'));
  } else if (a === 'gufixholddel') { mnyRemoveHolding(kid, id);
  } else if (a === 'gufixholdadd') {
    mnyAddHolding(kid, { kind: 'savings', name: 'Savings', units: 1, priceNow: 0, costBasis: 0,
                         rateAnnual: (Number(mrRuleOr(mrRules(), 'pots.rates.ready')) || 0) / 100 });
  // ➕ Commitments
  } else if (a === 'gucmtype') { guCommit().type = id === 'surprise' ? 'surprise' : 'commit';
  } else if (a === 'gucmkid') { guCommit().kid = id;
  } else if (a === 'gucmcost') { guCommit().cost = Math.max(5, guCommit().cost + d);
  } else if (a === 'gucmshare') { guCommit().share = Math.max(5, Math.min(100, guCommit().share + d));
  } else if (a === 'gucmweeks') { guCommit().weeks = Math.max(1, Math.min(104, guCommit().weeks + d));
  } else if (a === 'gucmweeksset') { guCommit().weeks = Number(id) || 26;
  } else if (a === 'gucmtick') { const c = guCommit(), key = guCommitTickKey(c); c.tickFor = c.tickFor === key ? null : key;
  } else if (a === 'gucmsave') { guSaveCommit();
  } else if (a === 'guclubpaid') { guClubPaid(kid);
  } else if (a === 'gufixloan') { guOpenSheet('loan', kid, id); return;
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
  } else if (a === 'gurulesave') { guSaveRules(); if (!mnyPending.length && guRuleThisWeek) { guRuleThisWeek = false; mnyRenderRulesTab(); } return;
  } else if (a === 'guthisweek') { guRuleThisWeek = !guRuleThisWeek;
  } else if (a === 'gurulesec') { guRuleSec = Math.max(0, Number(id) || 0); guRuleSearch = '';
  } else if (a === 'gureason') { guRuleReason = MR_REASONS.some(r => r.id === id) ? id : 'grownups';
  } else if (a === 'gulogall') { guOpenSheet('log'); return;
  } else if (a === 'gufund') { mnyQueueEdit('investing.fund', id, 'What her investing money buys'); return;
  } else if (a === 'guunlock') { mnyQueueEdit('school.unlockStage.' + kid, Number(id) || 0, 'Open a stage early — ' + mnyKidName(kid)); return;
  } else if (a === 'guquarter') { mrMarkQuarterReviewed(); showToast('📅 Quarterly review recorded — rates unchanged');
  } else if (a === 'gusundayrules') {
    if (mrApplySundayRules()) showToast('✅ The Sunday rules are in the rulebook');
  // 📒 Weeks
  } else if (a === 'guweekday') { guWeekDay = guWeekDay === id ? null : id;
  } else if (a === 'guweekopen') { const same = guWeekOpen === id && guWeeksKid === kid; guWeeksKid = kid === 'jess' ? 'jess' : 'jenn'; guWeekOpen = same ? null : id;
  } else if (a === 'guled') { mnyEditLedger(kid, id, el.getAttribute('data-mnyp-f'), d);
  } else if (a === 'guleddel') { mnyDeleteLedgerWeek(kid, id); guWeekOpen = null;
  } else if (a === 'guaddweek') { mnyAddMissedWeek(kid);
  } else {
    return;
  }
  mnyRenderRulesTab();
  if (guSheet) guRenderSheet();
}
/* Typing never re-renders: the commitment's name goes into the draft, and the
   save button follows it in place. A fix sheet's name or date is written once
   it is committed (`change`), so a name is one logged correction, not one per
   letter. */
function guInput(a, el, type) {
  const kid = el.getAttribute('data-mnyp-kid'), id = el.getAttribute('data-mnyp-id');
  if (a === 'gurulesearch') { guRuleSearch = String(el.value || '').slice(0, 40); guApplyRuleSearch(document.getElementById('mnyRulesWrap')); return; }
  if (a === 'gucmwhat') {
    guCommit().what = String(el.value || '').slice(0, 40);
    const b = document.querySelector('#mnyRulesWrap [data-mnyp-action="gucmsave"]');
    if (b) b.classList.toggle('ready', !!guCommit().what.trim());
    return;
  }
  if (type !== 'change') return;
  if (a === 'gufixname') { if (String(el.value || '').trim()) mnyEditDebt(kid, id, 'name', String(el.value).trim().slice(0, 40)); }
  else if (a === 'gufixitem') { mnyEditDebt(kid, id, 'item', String(el.value || '').trim().slice(0, 40)); }
  else if (a === 'gufixholdname') { mnyEditHolding(kid, id, 'name', String(el.value || '').slice(0, 40)); }
  else if (a === 'gufixholddate') { if (/^\d{4}-\d{2}-\d{2}$/.test(el.value)) mnyEditHolding(kid, id, 'maturesOn', el.value); }
  else return;
  mnyRenderRulesTab();
  if (guSheet) guRenderSheet();
}
