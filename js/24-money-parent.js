// Weekly-Planner — ⚙️ Money rules: the parent's half of the money system.
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   PAGE 4 · MONEY RULES  (parent portal)

   Everything a grown-up can change lives here, and nowhere else. Before this,
   the rules editor was a sub-tab of a screen you reached from the chore tab —
   which meant the one surface that decides what every dollar is worth was
   three taps down a path nobody would guess.

   This is the one page in the money system written for adults. It may say
   "effective date" and "arrears" and mean them. The other four are for a
   nine-year-old and are held to plain words.

   Two things it must never do:

   1. WRITE A RULE DIRECTLY. Every change goes through mrApplyEdits
      (js/18-rules.js), which clones the live version, stamps a new effective
      date and logs a line per field. Past weeks keep the prices that were live
      when the work was done, so a raise today never rewrites what she earned
      in March.

   2. RESET PROGRESS. Renaming a debt, re-rating it, correcting its principal —
      none of it touches `paid` or `payments`. The record is a record.

   Edits collect in a pending list and save as ONE change with one reason,
   because "we sat down on Sunday and re-tuned five numbers" is one decision,
   and logging it as five makes the history unreadable.
   ════════════════════════════════════════════════════════════════ */

let mnyPending = [];        // [{path, value, label}] — not saved until confirmed
let mnyPendingReason = MR_DEFAULT_REASON;
let mnyPendingFrom = null;  // effective date; defaults to today
let mnyRuleSearch = '';
let mnyHistoryOpen = false;
let mnyParentSection = 'prices';

const MNY_PARENT_SECTIONS = [
  { id: 'prices',   label: '💷 What things pay' },
  { id: 'week',     label: '📋 This week' },
  { id: 'debts',    label: '🎿 Loans' },
  { id: 'holdings', label: '📈 What she owns' },
  { id: 'lessons',  label: '🎓 Lessons' },
  { id: 'history',  label: '📖 Week history' },
  /* The flat amount for the weeks before the family started counting. It was
     the "Weeks nobody sat down for" card inside Week history; it is its own
     section now, with dates and an amount a parent chooses. */
  { id: 'grandma',  label: '👵 Grandma rule' },
  /* The log of rule changes, on its own. It was drawn at the bottom of
     Lessons, and Setup › 🕰️ Change history landed on the WEEK LEDGER — so the
     one row named for it opened everything except it. */
  { id: 'changes',  label: '🕰️ Change history' },
];

function mnyParentKid() { return (parentViewing === 'jenn' || parentViewing === 'jess') ? parentViewing : 'jess'; }
function mnySetParentSection(id) { mnyParentSection = id; mnyRenderRulesTab(); }

function mnyRenderRulesTab() {
  const wrap = document.getElementById('mnyRulesWrap');
  if (!wrap) return;
  if (!isParent()) { wrap.innerHTML = `<div class="mny-card"><div class="mny-note">Parents only 🔒</div></div>`; return; }
  const kid = mnyParentKid();
  const v = mrLatestVersion();

  /* A rail rather than a chip row: seven sections read as a list of places, and
     the one you are in stays visible while you scroll the one you opened. */
  const nav = MNY_PARENT_SECTIONS.map(s =>
    `<button type="button" class="mny-rail-item ${mnyParentSection === s.id ? 'on' : ''}" data-mnyp-action="section" data-mnyp-id="${s.id}">${escapeHtml(s.label)}</button>`).join('');

  let body = '';
  if (mnyParentSection === 'prices') body = mnyRulePrices();
  else if (mnyParentSection === 'week') body = mnyWeekResults(kid);
  else if (mnyParentSection === 'debts') body = mnyDebtEditor(kid);
  else if (mnyParentSection === 'holdings') body = mnyHoldingsEditor(kid);
  else if (mnyParentSection === 'lessons') body = mnyLessonEditor(kid);
  else if (mnyParentSection === 'changes') body = mnyChangeHistory();
  else if (mnyParentSection === 'grandma') body = mnyGrandmaCard();
  else body = mnyHistoryEditor(kid);

  /* mnyTabBar is gone from here. It is the girls' own five-page wayfinding
     (Earn · Bank · Goals · Learn · Rules) and it rendered above the section
     chips, so the parent got the portal's nav, then the kids' nav, then the
     sections — three rows before a single number. */
  wrap.innerHTML =
      `${mnyPageHead('⚙️ Money rules', 'The only page that changes a number', [
          { action: 'record-any', label: '✍️ Record something' },
          { action: 'tourpar', label: '? How this page works' },
        ], { back: false })}
       <div class="mny-effect">
         <span class="mny-label">${CT_PROFILE_ICON[kid]} ${kid === 'jenn' ? 'Jenn' : 'Jess'}</span>
         <span class="mny-effect-since">In effect since <b>${escapeHtml((v && v.effectiveFrom) || '—')}</b> · ${escapeHtml(mrReasonLabel(v && v.reason))}</span>
       </div>
       ${mnyPendingBar()}
       ${mnyHouseRulesCard()}
       <div class="mny-rail-wrap">
         <nav class="mny-rail" aria-label="Money rules sections">${nav}</nav>
         <div class="mny-rail-body">
           <div class="mny-note">Every change is dated and recorded. Past weeks keep the prices that were live when the work was done — changing a price today never rewrites what they already earned.</div>
           ${body}
         </div>
       </div>
       ${mnyTargetsFooter()}`;
  if (typeof enhanceNonButtonClickables === 'function') enhanceNonButtonClickables(wrap);
}

/* ── The four house rules, when this household's rulebook lacks them ──
   `mrHouseRulesPending` (js/18-rules.js) lists what is still missing, found by
   item id in the rules live today; this card shows every change before one
   tap applies it through `mrApplyEdits`. Parent-only because the whole page
   is, and gone for good once applied — see `mrHouseRulesApplied`. */
function mnyHouseRulesCard() {
  if (!isParent() || mrHouseRulesApplied()) return '';
  const pending = mrHouseRulesPending();
  if (!pending.length) return '';
  const from = mrHouseRulesFrom();
  const said = (field, v) => {
    if (field === 'amount') return mnyMoney(Number(v) || 0);
    if (field === 'xpOnly') return v === true ? 'XP only' : 'pays money';
    if (field === 'freeRepeats') return (Number(v) || 0) ? (Number(v) + ' free a week') : 'costs from the first';
    if (field === 'graceDays') return (Number(v) || 0) + ' grace day' + ((Number(v) || 0) === 1 ? '' : 's') + ' a week';
    return v == null ? '—' : String(v);
  };
  const rows = pending.map(p => `<div class="mny-row"><span>${escapeHtml(p.item)} — ${escapeHtml(MR_HOUSE_RULES_FIELDS[p.field] || p.field)}</span>
      <b>${escapeHtml(said(p.field, p.from))} → ${escapeHtml(said(p.field, p.value))}</b></div>`).join('');
  return `<div class="mny-card mny-pending">
      <div class="mny-week-head"><span class="mny-label">🏠 The four house rules are not in this rulebook yet</span></div>
      <div class="mny-note">On 21 Sep the family agreed four rules: homework earns XP, not dollars; tone,
        taking her sister's things, screens and being asked twice are free the first two times in a week;
        one grace day a week on the routine streak; and the year's pace divides by the weeks that passed.
        The fourth is already how the app counts. The rulebook on this household's devices was written
        before the other three, so they are not in force.</div>
      <div class="mny-rows">${rows}</div>
      ${from ? `<div class="mny-note">Takes effect from Monday ${escapeHtml(mnyShortDate(from))}: this week and every
          week after it price under these, and every week before keeps the prices it was lived under.
          Nothing already earned is re-priced. Only the rows above change — the chore pool, prices, caps and
          targets stay exactly as they are.</div>
        <button type="button" class="mny-btn primary wide" data-mnyp-action="houserules"
          >Put ${pending.length === 1 ? 'this change' : 'these ' + pending.length + ' changes'} into the rulebook</button>
        <div class="mny-note">Recorded in 🕰️ Change history as “${escapeHtml(MR_HOUSE_RULES_NOTE)}”. Once it is
          in, this card does not come back — changing one of these later is your decision, and it stays.</div>`
      : `<div class="mny-note">A rules change is already scheduled for ${escapeHtml(mnyShortDate((mrLatestVersion() || {}).effectiveFrom))}.
          These can go in once it has started, so they are not dated in front of it.</div>`}
    </div>`;
}

/* ── The pending bar ──
   Nothing is saved until this is confirmed, and everything in it saves as one
   change with one reason. Discard just empties the list — no version was ever
   created, so there is nothing to roll back. */
function mnyPendingBar() {
  if (!mnyPending.length) return '';
  const rows = mnyPending.map((p, i) =>
    `<div class="mny-row"><span>${escapeHtml(p.label)}</span>
       <b>${escapeHtml(String(p.value))}</b>
       <button type="button" class="mny-step" data-mnyp-action="drop" data-mnyp-i="${i}" aria-label="Drop this change">✕</button></div>`).join('');
  const reasons = MR_REASONS.map(r =>
    `<button type="button" class="mny-chip ${mnyPendingReason === r.id ? 'on' : ''}" data-mnyp-action="reason" data-mnyp-id="${r.id}">${escapeHtml(r.label)}</button>`).join('');
  return `<div class="mny-card mny-pending">
      <div class="mny-week-head"><span class="mny-label">${mnyPending.length} change${mnyPending.length > 1 ? 's' : ''} not saved yet</span></div>
      <div class="mny-rows">${rows}</div>
      <div class="mny-label">Why</div>
      <div class="mny-chiprow">${reasons}</div>
      <label class="mny-field"><span>In effect from</span>
        <input type="date" value="${escapeAttr(mnyPendingFrom || todayKey())}" data-mnyp-action="from"></label>
      <div class="mny-note">A date in the future schedules the change — weeks before it keep today's prices.</div>
      <div class="mny-chiprow">
        <button type="button" class="mny-btn primary" data-mnyp-action="save">Save as one change</button>
        <button type="button" class="mny-btn" data-mnyp-action="discard">Discard</button>
      </div>
    </div>`;
}

function mnyQueueEdit(path, value, label) {
  const i = mnyPending.findIndex(p => p.path === path);
  const entry = { path, value, label: label || path };
  if (i >= 0) mnyPending[i] = entry; else mnyPending.push(entry);
  mnyRenderRulesTab();
}
function mnySavePending() {
  if (!mnyPending.length) return;
  /* The gates' order is refused HERE, in the handler, as well as at each
     stepper: a pending list can also be built by a stale tap or a second
     device's rules arriving underneath it. */
  if (mnyPending.some(p => String(p.path).indexOf('school.stagePct.') === 0)) {
    const why = mnyStagePctRefusal();
    if (why) { showToast(why); return; }
  }
  const version = mrApplyEdits(mnyPending.map(p => ({ path: p.path, value: p.value, label: p.label })),
    { reason: mnyPendingReason, effectiveFrom: mnyPendingFrom || todayKey() });
  const n = mnyPending.length;
  mnyPending = []; mnyPendingFrom = null;
  mnyRenderRulesTab();
  showToast(version ? `✅ ${n} change${n > 1 ? 's' : ''} saved as one` : 'Nothing changed');
}

/* ── What things pay ──
   The same five lists the kid reads on her own page, with a stepper on every
   number. The search box exists because there are about forty of them. */
function mnyRulePrices() {
  const r = mrRules();
  const q = mnyRuleSearch.toLowerCase();
  const hit = (label) => !q || String(label).toLowerCase().indexOf(q) >= 0;
  const pending = (path) => mnyPending.find(p => p.path === path);
  const num = (label, path, value, step, suffix) => {
    if (!hit(label)) return '';
    const p = pending(path);
    const shown = p ? p.value : value;
    return `<div class="mny-row${p ? ' changed' : ''}"><span>${escapeHtml(label)}</span>
        <span class="mny-stepgrp">
          <button type="button" class="mny-step" data-mnyp-action="bump" data-mnyp-path="${escapeAttr(path)}" data-mnyp-d="${-(step || 0.5)}" data-mnyp-label="${escapeAttr(label)}" aria-label="Less">−</button>
          <b>${suffix === '%' ? shown + '%' : mnyMoney(shown)}</b>
          <button type="button" class="mny-step" data-mnyp-action="bump" data-mnyp-path="${escapeAttr(path)}" data-mnyp-d="${step || 0.5}" data-mnyp-label="${escapeAttr(label)}" aria-label="More">+</button>
        </span></div>`;
  };

  const g = (r.chores || {}).grade || {};
  const cards = [];
  cards.push(`<div class="mny-card"><div class="mny-label">🧹 Household chores</div>
      ${num('On time and to standard', 'chores.grade.3', g[3])}
      ${num('To standard, but late', 'chores.grade.2', g[2])}
      ${num('Redone, then to standard', 'chores.grade.1', g[1])}
      ${num('Most she can earn in a day', 'chores.dailyCap', (r.chores || {}).dailyCap)}
      ${num('Free chores each week', 'chores.freeChoresPerWeek', (r.chores || {}).freeChoresPerWeek, 1)}
    </div>`);

  const items = (r.learning || {}).items || [];
  cards.push(`<div class="mny-card"><div class="mny-label">📘 Learning</div>
      ${items.map((it, i) => it.xpOnly ? '' :
        num(it.label + ' (per ' + it.perUnit + ' ' + it.unit + ')', 'learning.items.' + i + '.amount', it.amount)).join('')}
      ${num('Items spot-checked on Sunday', 'learning.sundayCheckCount', (r.learning || {}).sundayCheckCount, 1)}
    </div>`);

  const tiers = (r.streak || {}).tiers || [];
  cards.push(`<div class="mny-card"><div class="mny-label">🔥 Clean-day streak</div>
      ${tiers.map((t, i) => num(t.days + ' days in a row', 'streak.tiers.' + i + '.bonus', t.bonus)).join('')}
    </div>`);

  const cp = r.competition || {};
  cards.push(`<div class="mny-card"><div class="mny-label">🏆 Competitions</div>
      ${num('Swim — per point', 'competition.swim.perPoint', (cp.swim || {}).perPoint)}
      ${num('Swim — qualifying bonus', 'competition.swim.qualifyBonus', (cp.swim || {}).qualifyBonus, 5)}
      ${num('Swim — per point at Provincials', 'competition.swim.provincialPerPoint', (cp.swim || {}).provincialPerPoint)}
      ${num('Skating — per point', 'competition.skate.perPoint', (cp.skate || {}).perPoint)}
      ${/* "Skating star level" is what the family calls it; the rule key and the
            sport id stay `dance`, because stored results and every rule version
            already on the devices name it that. A relabel, not a new sport. */''}
      ${num('Skating star level — per Silver item', 'competition.dance.silverPerItem', (cp.dance || {}).silverPerItem)}
      ${num('Skating star level — per Gold item', 'competition.dance.goldPerItem', (cp.dance || {}).goldPerItem)}
      ${num('Skating star level — most for one test', 'competition.dance.testCap', (cp.dance || {}).testCap, 5)}
    </div>`);

  const fines = (r.fines || {}).items || [];
  cards.push(`<div class="mny-card"><div class="mny-label">📦 Fines</div>
      ${fines.map((f, i) => num(f.label, 'fines.items.' + i + '.amount', f.amount)).join('')}
      <div class="mny-note">A day never goes below $0. A fine can take what was earned that day; it cannot create debt.</div>
    </div>`);

  cards.push(`<div class="mny-card"><div class="mny-label">🎯 Yearly targets</div>
      ${num('Jenn', 'targets.jenn.annual', ((r.targets || {}).jenn || {}).annual, 50)}
      ${num('Jess', 'targets.jess.annual', ((r.targets || {}).jess || {}).annual, 50)}
    </div>`);

  /* What money buys. These are the anchors every big number on a kid page is
     translated into, so they have to be things she has watched you buy — keep
     them current, and keep them yours. */
  const buys = (r.buys || {}).items || [];
  cards.push(`<div class="mny-card"><div class="mny-label">🛒 What money buys</div>
      ${buys.map((b, i) => num(b.label, 'buys.items.' + i + '.amount', b.amount, 1)).join('')}
      <div class="mny-note">Every big number she sees gets turned into these — "$80" is a word, "dinner out for all of us" is a quantity. Keep them things she has actually watched us buy.</div>
    </div>`);

  return `<div class="mny-card">
      <label class="mny-field"><span>Find a price</span>
        <input type="search" value="${escapeAttr(mnyRuleSearch)}" placeholder="streak, star level, cap…" data-mnyp-action="search"></label>
    </div>${cards.join('')}`;
}

/* ── This week's results ──
   The same overrides step 3 of the meeting writes. Deliberately the same
   state: a number corrected here and a number corrected at the table have to
   be the same number, or the two screens start arguing. */
function mnyWeekResults(kid) {
  const wk = mnyWeekKey();
  const b = mrWeekBreakdown(wk, kid);
  const values = { chores: b.chorePaid, learning: b.learnPaid, streak: b.streakBonus,
                   comp: b.compPaid, fines: b.fines.total };
  const rows = MNY_CHANNELS.map(ch => {
    const ov = b.overrides[ch.key];
    return `<div class="mny-row"><span>${ch.icon} ${escapeHtml(ch.label)}
        ${ov ? `<span class="mny-src edited">changed</span> <s class="mny-was">${mnyMoney(b.original[ch.key])}</s>` : `<span class="mny-src">from the planner</span>`}</span>
      <span class="mny-stepgrp">
        <button type="button" class="mny-step" data-mnyp-action="chan" data-mnyp-id="${ch.key}" data-mnyp-d="-0.5" aria-label="Less">−</button>
        <b>${mnyMoney(values[ch.key])}</b>
        <button type="button" class="mny-step" data-mnyp-action="chan" data-mnyp-id="${ch.key}" data-mnyp-d="0.5" aria-label="More">+</button>
        ${ov ? `<button type="button" class="mny-step" data-mnyp-action="chanreset" data-mnyp-id="${ch.key}" aria-label="Back to the planner's number">↺</button>` : ''}
      </span></div>`;
  }).join('');
  const stamp = mnyConfirmStamp(wk, kid);
  return `<div class="mny-card">
      <div class="mny-label">This week — ${escapeHtml(mnyShortDate(wk))}</div>
      <div class="mny-rows">${rows}
        <div class="mny-row total"><span>Earned for her work</span><b>${mnyMoney(b.net)}</b></div>
      </div>
      ${stamp ? `<div class="mny-note">${escapeHtml(stamp)}</div>` : ''}
      <div class="mny-note">Competition days and money from outside are entered <b>at the meeting, with her</b> — not here. That is the whole point of them.</div>
      <button type="button" class="mny-btn wide" data-mnyp-action="meeting">👨‍👩‍👧‍👦 Open the family meeting</button>
    </div>
    ${/* The pool, read-only. "Earned for her work" above is b.net — gross less
          fines, no gifts — which is a fourth number again. Without this the
          parent is the one person who has to arbitrate when a child says the
          screens disagree, and is reading a figure that matches neither of
          them. A reader, not a writer: the payment steppers stay in
          mnyPoolCard at the meeting, where the conversation happens. */''}
    <div class="mny-card">
      <div class="mny-label">Where this week's money stands</div>
      ${mnyStrip(wk, kid, -1)}
    </div>
    ${mnyLastAnswerCard(kid, wk)}`;
}
function mnyLastAnswerCard(kid, wk) {
  const prev = mnyPreviousPlan(wk, kid);
  if (!prev || !prev.reflect) return '';
  const chip = MNY_REFLECT.chips.find(c => c.id === prev.reflect);
  return `<div class="mny-card">
      <div class="mny-label">Her answer last week</div>
      <div class="mny-today-big">“${escapeHtml(chip ? chip.label : prev.reflect)}”</div>
      <div class="mny-note">She chose ${escapeHtml(prev.label || 'a plan')}.</div>
    </div>`;
}

/* ── The loans ──
   Each debt owns its own terms, so two of them can carry two different rates.
   Nothing here writes `paid` except the field that exists to correct it, and
   every change is logged with a date — renaming a loan must never look like
   progress was reset. */
function mnyDebtEditor(kid) {
  const debts = mnyDebts(kid);
  const cards = debts.map(d => {
    const owing = loanBalance(kid, d.id);
    const pct = money2(d.principal) > 0 ? Math.round((money2(d.paid) / money2(d.principal)) * 100) : 0;
    const free = loanFreeDate(kid, d.id, 0);
    const pace = loanPacing(kid, d.id);
    const field = (label, key, step, suffix) =>
      `<div class="mny-row"><span>${escapeHtml(label)}</span>
        <span class="mny-stepgrp">
          <button type="button" class="mny-step" data-mnyp-action="debt" data-mnyp-id="${escapeAttr(d.id)}" data-mnyp-f="${key}" data-mnyp-d="${-step}" aria-label="Less">−</button>
          <b>${suffix === '%' ? money2(d[key]) + '%' : mnyMoney(d[key])}</b>
          <button type="button" class="mny-step" data-mnyp-action="debt" data-mnyp-id="${escapeAttr(d.id)}" data-mnyp-f="${key}" data-mnyp-d="${step}" aria-label="More">+</button>
        </span></div>`;
    return `<div class="mny-card">
        <div class="mny-week-head">
          <span class="mny-label">${escapeHtml(d.icon)} ${escapeHtml(d.name)}</span>
          ${debts.length > 1 ? `<button type="button" class="mny-step" data-mnyp-action="debtdel" data-mnyp-id="${escapeAttr(d.id)}" aria-label="Remove this loan">✕</button>` : ''}
        </div>
        <label class="mny-field"><span>What it is called — she sees this everywhere</span>
          <input type="text" value="${escapeAttr(d.name)}" data-mnyp-action="debtname" data-mnyp-id="${escapeAttr(d.id)}"></label>
        <div class="mny-chiprow">${MNY_DEBT_ICONS.map(ic =>
          `<button type="button" class="mny-chip ${d.icon === ic ? 'on' : ''}" data-mnyp-action="debticon" data-mnyp-id="${escapeAttr(d.id)}" data-mnyp-ic="${escapeAttr(ic)}">${ic}</button>`).join('')}</div>
        <label class="mny-field"><span>What it bought</span>
          <input type="text" value="${escapeAttr(d.item || '')}" data-mnyp-action="debtitem" data-mnyp-id="${escapeAttr(d.id)}" placeholder="skis"></label>
        <div class="mny-rows">
          ${field('What it started at', 'principal', 25)}
          ${field('Paid off so far', 'paid', 5)}
          ${field('Each month', 'monthly', 1)}
          ${field('Deposit', 'downPayment', 10)}
          ${field('Bonus for paying early', 'bonusRate', 1, '%')}
          ${field('Cost of paying late, per month', 'arrearsRatePct', 1, '%')}
        </div>
        <label class="mny-field"><span>Deposit due</span>
          <input type="date" value="${escapeAttr(d.downPaymentDue || '')}" data-mnyp-action="debtdue" data-mnyp-id="${escapeAttr(d.id)}"></label>
        <div class="mny-rows">
          <div class="mny-row"><span>Still owing</span><b>${mnyMoney(owing)}</b></div>
          <div class="mny-row"><span>Paid off</span><b>${pct}%</b></div>
          <div class="mny-row"><span>Clear by</span><b>${free.date ? mnyShortDate(free.date) : '—'}</b></div>
          <div class="mny-row"><span>Bonus she has earned</span><b>${mnyMoney(mnyBonusEarned(kid, d.id))}</b></div>
          ${d.arrearsInterest > 0 ? `<div class="mny-row warn"><span>Charged for being late</span><b>${mnyMoney(d.arrearsInterest)}</b></div>` : ''}
          ${pace ? `<div class="mny-row"><span>Against the schedule</span><b>${pace.status === 'on-pace' ? 'on track' : mnyMoney(pace.behindBy) + ' behind'}</b></div>` : ''}
        </div>
        <div class="mny-note">Renaming or re-rating a loan is recorded with today's date and never touches what has been paid.</div>
      </div>`;
  }).join('');
  return `${cards}
    <div class="mny-card">
      <button type="button" class="mny-btn wide" data-mnyp-action="debtadd">＋ Add another loan</button>
      <div class="mny-note">Extra money goes to whichever loan pays the biggest bonus first — that is where a dollar clears the most.</div>
    </div>`;
}

/* ── What she owns ──
   One record per holding, kept truthful by hand. There is no market
   simulation: a share is worth what this page says it is worth, which is both
   simpler to explain and closer to how it actually works. */
/* ── What she has asked to move ──
   A request is an ASK, not a movement (js/40-stream.js) — the money does not
   leave cash until this is answered, and it is re-checked against the wallet as
   it stands now rather than as it stood when she asked.

   The approval surface ships BEFORE the door she proposes through, deliberately:
   a request that could be made and never answered is worse than one that cannot
   yet be made. */
function mnyMoveRequestsCard(kid) {
  const pend = (typeof mnyPendingMoves === 'function') ? mnyPendingMoves(kid) : [];
  if (!pend.length) return '';
  const rows = pend.map(r => {
    const why = (typeof mnyMoveRefusal === 'function')
      ? mnyMoveRefusal(kid, r.from, r.to, r.amount) : null;
    return `<div class="mny-card">
        <div class="mny-week-head">
          <span class="mny-label">${mnyMoney(r.amount)} · ${escapeHtml(mnyHomeLabel(r.from))} → ${escapeHtml(mnyHomeLabel(r.to))}</span>
          <span class="mny-label">${escapeHtml(r.dayKey || '')}</span>
        </div>
        ${r.note ? `<div class="mny-note">“${escapeHtml(r.note)}”</div>` : ''}
        ${why ? `<div class="mny-note">Cannot happen right now — ${escapeHtml(why)}</div>` : ''}
        <div class="mny-chiprow">
          <button type="button" class="mny-btn primary" data-mnyp-action="mvok" data-mnyp-id="${escapeAttr(r.id)}"${why ? ' disabled' : ''}>Yes, move it</button>
          <button type="button" class="mny-btn" data-mnyp-action="mvno" data-mnyp-id="${escapeAttr(r.id)}">Not this time</button>
        </div>
      </div>`;
  }).join('');
  return `<div class="mny-card">
      <div class="mny-label">🔀 ${pend.length} thing${pend.length === 1 ? '' : 's'} she has asked to move</div>
      <div class="mny-note">Nothing has moved yet. Saying yes moves it now, at today's balances.</div>
    </div>${rows}`;
}

/* One name per home, so the queue row, the card and any sheet say the same
   words about the same pot. */
function mnyHomeLabel(home) {
  return ({ cash: 'Cash', ready: 'Kept ready', locked: 'Locked away', invest: 'In companies' })[String(home)]
    || String(home);
}

function mnyHoldingsEditor(kid) {
  const holdings = mnyHoldings(kid);
  const r = mnyReturns(kid);
  const cards = holdings.map(h => {
    const bump = (label, key, step) =>
      `<div class="mny-row"><span>${escapeHtml(label)}</span>
        <span class="mny-stepgrp">
          <button type="button" class="mny-step" data-mnyp-action="hold" data-mnyp-id="${escapeAttr(h.id)}" data-mnyp-f="${key}" data-mnyp-d="${-step}" aria-label="Less">−</button>
          <b>${key === 'rateAnnual' ? mnyPctOf(h[key]) : (key === 'units' ? (Math.round(h.units * 1000) / 1000) : mnyMoney(h[key]))}</b>
          <button type="button" class="mny-step" data-mnyp-action="hold" data-mnyp-id="${escapeAttr(h.id)}" data-mnyp-f="${key}" data-mnyp-d="${step}" aria-label="More">+</button>
        </span></div>`;
    return `<div class="mny-card">
        <div class="mny-week-head">
          <span class="mny-label">${escapeHtml(h.name)}</span>
          <span class="mny-stepgrp">
            ${h.kind === 'stock' && mnyHoldingValue(h) > 0 ? `<button type="button" class="mny-step mny-step--wide" data-mnyp-action="holdsell" data-mnyp-id="${escapeAttr(h.id)}" aria-label="Sell some of this for cash">Sell</button>` : ''}
            <button type="button" class="mny-step" data-mnyp-action="holddel" data-mnyp-id="${escapeAttr(h.id)}" aria-label="Remove">✕</button>
          </span>
        </div>
        <div class="mny-chiprow">${MNY_HOLDING_KINDS.map(k =>
          `<button type="button" class="mny-chip ${h.kind === k.id ? 'on' : ''}" data-mnyp-action="holdkind" data-mnyp-id="${escapeAttr(h.id)}" data-mnyp-k="${k.id}">${k.icon} ${escapeHtml(k.label)}</button>`).join('')}</div>
        <label class="mny-field"><span>What she calls it</span>
          <input type="text" value="${escapeAttr(h.name)}" data-mnyp-action="holdname" data-mnyp-id="${escapeAttr(h.id)}"></label>
        <div class="mny-rows">
          ${h.ticker ? bump('How many', 'units', 1) : ''}
          ${bump(h.ticker ? 'Worth each, today' : 'Worth today', 'priceNow', 5)}
          ${bump('What it cost', 'costBasis', 5)}
          ${h.ticker ? '' : bump('Growth a year', 'rateAnnual', 0.005)}
          <div class="mny-row total"><span>Worth now</span><b>${mnyMoney(mnyHoldingValue(h))}</b></div>
        </div>
        ${h.ticker
          ? `<div class="mny-note">${escapeHtml(h.ticker)}'s price follows the calendar month on its own. Setting it here holds until the month turns.</div>`
          : `<div class="mny-note">This grows by itself, a bit every day, at the rate above.</div>`}
        ${h.kind === 'gic' ? `<label class="mny-field"><span>Unlocks on</span>
          <input type="date" value="${escapeAttr(h.maturesOn || '')}" data-mnyp-action="holddate" data-mnyp-id="${escapeAttr(h.id)}"></label>` : ''}
      </div>`;
  }).join('');

  const funds = MNY_FUNDS.map(f =>
    `<button type="button" class="mny-chip ${((mrRules().investing || {}).fund === f.id) ? 'on' : ''}" data-mnyp-action="fund" data-mnyp-id="${f.id}">${escapeHtml(f.label)}</button>`).join('');

  return `${mnyMoveRequestsCard(kid)}
    <div class="mny-card">
      <div class="mny-label">📈 What she owns</div>
      <div class="mny-rows">
        <div class="mny-row"><span>Cash</span><b>${mnyMoney(mnyCash(kid))}</b></div>
        <div class="mny-row"><span>Kept ready</span><span class="mny-stepgrp"><b>${mnyMoney(mnySavedTotal(kid))}</b>
          ${mnySavedTotal(kid) > 0 ? `<button type="button" class="mny-step mny-step--wide" data-mnyp-action="saved2cash" aria-label="Move kept-ready money back to cash">→ cash</button>` : ''}</span></div>
        <div class="mny-row"><span>Locked away</span><b>${mnyMoney(mnyLockedTotal(kid))}</b></div>
        <div class="mny-row"><span>In companies</span><b>${mnyMoney(mnyInvestedTotal(kid))}</b></div>
        <div class="mny-row total"><span>Everything</span><b>${mnyMoney(mnyEverything(kid))}</b></div>
      </div>
      <div class="mny-note">Made so far: <b>${mnySigned(r.gain)}</b>. On this rate, another <b>${mnySigned(r.yearAhead)}</b> over a year. All of it moves on its own: interest for the days that pass, share prices with the calendar month, and locked money paying out on its date.</div>
    </div>
    ${cards}
    <div class="mny-card">
      <button type="button" class="mny-btn wide" data-mnyp-action="holdadd">＋ Add something she owns</button>
      <div class="mny-label" style="margin-top:0.5rem">What her investing money buys</div>
      <div class="mny-chiprow">${funds}</div>
      <div class="mny-note">A fixed list, never a search box. Choosing a company by name is the lesson; a search box is a casino.</div>
    </div>`;
}

/* ── Lessons ──
   Which stage she is at, the override for when the conversation gets
   somewhere before the loan does, and the three gates themselves.

   The gates are rule values (`school.stagePct`), so a change goes through the
   pending list and `mrApplyEdits` like any price: dated, logged, one version.
   The ORDER is checked in the handler (`mnyStagePctRefusal`), not only in the
   markup — a stepper that could put "lock it away" before "keep it ready"
   would open a pot whose lesson is still shut. */
const MNY_TUNABLE_STAGES = ['ready', 'locked', 'stock'];
/* A gate as it will be once the pending list is saved: the queued value if
   there is one, the live rule otherwise. */
function mnyStagePctShown(stageId) {
  const p = mnyPending.find(x => x.path === 'school.stagePct.' + stageId);
  return p ? Number(p.value) : mnyStagePct(stageId);
}
/* Why a set of gates cannot be saved, as a sentence, or null. `values` holds
   ready / locked / stock; anything missing reads as it will be once saved. */
function mnyStagePctRefusal(values) {
  const v = {};
  MNY_TUNABLE_STAGES.forEach(id => {
    v[id] = Number((values && values[id] != null) ? values[id] : mnyStagePctShown(id));
  });
  const name = (id) => (MNY_STAGES.find(s => s.id === id) || {}).title || id;
  for (const id of MNY_TUNABLE_STAGES) {
    if (!isFinite(v[id]) || v[id] < 0 || v[id] > 100) {
      return `${name(id)} has to open somewhere between 0% and 100% paid off.`;
    }
  }
  for (let i = 1; i < MNY_TUNABLE_STAGES.length; i++) {
    const a = MNY_TUNABLE_STAGES[i - 1], b = MNY_TUNABLE_STAGES[i];
    if (v[a] > v[b]) {
      return `${name(a)} (${v[a]}%) cannot open after ${name(b).toLowerCase()} (${v[b]}%) — each stage opens no later than the one after it.`;
    }
  }
  return null;
}

function mnyLessonEditor(kid) {
  const idx = mnyStageIndex(kid);
  const pct = mnyPaidPct(kid);
  const override = mnyUnlockOverride(kid);
  const gate = (id) => {
    const s = MNY_STAGES.find(x => x.id === id);
    const path = 'school.stagePct.' + id;
    const changed = mnyPending.some(x => x.path === path);
    return `<div class="mny-row${changed ? ' changed' : ''}"><span>${s.icon} ${escapeHtml(s.title)}</span>
        <span class="mny-stepgrp">
          <button type="button" class="mny-step" data-mnyp-action="stagepct" data-mnyp-id="${id}" data-mnyp-d="-5" aria-label="Open it sooner">−</button>
          <b>${mnyStagePctShown(id)}%</b>
          <button type="button" class="mny-step" data-mnyp-action="stagepct" data-mnyp-id="${id}" data-mnyp-d="5" aria-label="Open it later">+</button>
        </span></div>`;
  };
  return `<div class="mny-card">
      <div class="mny-label">🎓 Where she is</div>
      <div class="mny-progress"><div class="mny-progress-fill green" style="width:${pct}%"></div></div>
      <div class="mny-goal-row">${mnyTotalPrincipal(kid) > 0
        ? `${pct}% of everything she owes is paid off`
        : 'She has no loan, so every stage is open'}</div>
      <div class="mny-rows">
        ${MNY_STAGES.map((s, i) => `<div class="mny-row${i === idx ? ' total' : ''}">
            <span>${s.icon} ${escapeHtml(s.title)}</span>
            <b>${i < idx ? 'open' : (i === idx ? 'here now' : '🔒 ' + mnyStagePct(s.id) + '%')}</b>
          </div>`).join('')}
      </div>
      <div class="mny-label" style="margin-top:0.5rem">Open a stage early</div>
      <div class="mny-chiprow">${MNY_STAGES.map((s, i) =>
        `<button type="button" class="mny-chip ${override === i ? 'on' : ''}" data-mnyp-action="unlock" data-mnyp-i="${i}">${s.icon} ${i === 0 ? 'no override' : mnyStagePct(s.id) + '%'}</button>`).join('')}</div>
      <div class="mny-note">Use this when you have had the conversation and she is ready for it before the loan says so. It only ever opens things — it cannot close one she has reached.</div>
    </div>
    <div class="mny-card">
      <div class="mny-label">🚪 When each stage opens — share of all loans paid off, for both girls</div>
      <div class="mny-rows">${MNY_TUNABLE_STAGES.map(gate).join('')}</div>
      <div class="mny-note">These are rules like any price: a change waits in the list above until you save it,
        and it is dated and kept in 🕰️ Change history. Each stage has to open no later than the one after it.
        ${escapeHtml((MNY_STAGES[MNY_STAGES.length - 1] || {}).title || '')} stays at ${mnyStagePct('mix')}%.</div>
    </div>`;
}

function mnyChangeHistory() {
  const entries = mrLogEntries().slice(0, mnyHistoryOpen ? 60 : 8);
  return `<div class="mny-card">
      <button type="button" class="mny-acc" data-mnyp-action="hist" aria-expanded="${mnyHistoryOpen}">
        <span class="mny-label">📋 Change history</span><span>${mnyHistoryOpen ? 'Less ▾' : 'More ▸'}</span>
      </button>
      <div class="mny-rows">
        ${entries.length ? entries.map(e => {
            /* A non-scalar goes through the same summariser mrLogAppend uses —
               entries already on the family's devices hold whole arrays, and
               String() of one is "[object Object]" per record. */
            const said = e.summary || mrLogSummary(e.from, e.to);
            return `<div class="mny-row">
            <span>${escapeHtml(e.note || e.path)} · ${escapeHtml(mrReasonLabel(e.reason))} · ${escapeHtml(mnyShortDate(toDayKeyInZone(new Date(e.at))))}</span>
            <b>${said != null ? escapeHtml(said)
              : `${escapeHtml(e.from == null ? '—' : String(e.from))} → ${escapeHtml(e.to == null ? '—' : String(e.to))}`}</b>
          </div>`;
          }).join('') : `<div class="mny-note">No changes yet — the starting template is still in effect.</div>`}
      </div>
    </div>`;
}

/* ── Week history ──
   The frozen ledger, and a way to type in the weeks that happened before the
   app did. Hand-entered rows are marked as such: a week somebody typed from
   memory is not the same evidence as a week the app watched happen. */
/* ── The default for a week nobody sat down for ─────────────────────
   mmUnsettledWeeks looks back eight weeks and stops, so weeks older than that
   are invisible AND unsettleable: the catch-up list cannot show them and there
   is no other door. They sit unsettled forever, and the money for them is
   simply never credited.

   A flat default per child clears them. Deliberately NOT applied to weeks the
   catch-up list can still reach — those still hold real chore and routine data
   and should be settled on their own numbers, which is the whole point of the
   catch-up list. */
const MNY_DEFAULT_WEEK = 3;
const MNY_CATCHUP_REACH = 8;

/* Read-only, so the card can show the total and the weeks BEFORE anything
   moves. Sixteen weeks is a real amount of money and it must never arrive as a
   surprise — the same shape as Copy a plan, which shows its work first.

   ONE ENGINE, two callers. With no options it is the default sweep the
   meeting hub's catch-up banner offers: every un-met week from the family's
   first week to one beyond the catch-up reach, at MNY_DEFAULT_WEEK. With
   `{ reason: 'grandma', from, to, amount }` it is the Grandma rule: a parent's
   own dates and amount, and ONLY weeks with no record at all for that child
   (`mnyWeekHasAnyRecord`) — a week with anything in it is counted as skipped.

   Either way it never reaches the current week, a future one, or the eight
   the catch-up list still settles on real numbers, whatever dates are typed:
   the newest week it can name is one beyond that reach. The $3 is backfill,
   never a floor. */
function mnyDefaultSweepPlan(opts) {
  const o = opts || {};
  ctEnsureShared();
  const c = state.shared.chore;
  const grandma = o.reason === 'grandma';
  const amount = (o.amount != null) ? money2(Math.max(0, Number(o.amount) || 0)) : MNY_DEFAULT_WEEK;
  const out = { weeks: [], total: 0, perKid: { jenn: 0, jess: 0 }, skipped: { jenn: 0, jess: 0 },
                amount, reason: grandma ? 'grandma' : 'default', from: null, to: null, latest: null };
  const isDay = (k) => /^\d{4}-\d{2}-\d{2}$/.test(String(k || ''));
  /* The newest week any sweep may name. */
  const latest = formatDayKey(ctThisWeekKey());
  latest.setDate(latest.getDate() - (MNY_CATCHUP_REACH + 1) * 7);
  out.latest = ctDateToKey(latest);
  let top = latest;
  if (isDay(o.to)) {
    const t = formatDayKey(ctWeekKeyForDate(o.to));
    if (t < top) top = t;
  }
  const floor = isDay(o.from) ? String(ctWeekKeyForDate(o.from))
    : ((typeof mmCatchUpFloor === 'function') ? String(mmCatchUpFloor()) : null);
  out.from = floor; out.to = ctDateToKey(top);
  if (!floor || !(amount > 0)) return out;
  const mon = new Date(top);
  for (let i = 0; i < 260; i++) {
    const wk = ctDateToKey(mon);
    if (String(wk) < floor) break;
    let kids = [];
    if (grandma) {
      ['jenn', 'jess'].forEach(k => {
        if (mnyWeekHasAnyRecord(wk, k)) out.skipped[k]++;
        else kids.push(k);
      });
    } else if (!((c.meetingsHeld || {})[wk])) {
      kids = ['jenn', 'jess'].filter(k => ((c.finalizedWeeks || {})[wk] || {})[k] == null);
    }
    if (kids.length) {
      kids.forEach(k => { out.perKid[k] = money2(out.perKid[k] + amount); });
      out.weeks.push({ wk, kids, amount: money2(amount * kids.length) });
    }
    mon.setDate(mon.getDate() - 7);
  }
  out.total = money2(out.weeks.reduce((s, w) => s + w.amount, 0));
  return out;
}

/* The writer. Idempotent through the SAME guard commitKidWeek already uses —
   finalizedWeeks[wk][kid] == null is the has-been-credited test — so this can
   run twice, on two devices, in any merge order, and credit once.

   A defaulted week is LABELLED, not disguised: the ledger row carries its own
   mark so the money story can say "no meeting was held, the default applied"
   rather than presenting $3 as a week's earnings — and `defaultReason` says
   WHICH default, so a Grandma-rule week reads "Grandma rule" and never "nobody
   met". It also carries handEntered, because mnyEditLedger refuses any row
   without it and a defaulted row must stay correctable by the same door. */
async function mnyRunDefaultSweep(opts) {
  if (!isParent()) { showToast('A grown-up settles the weeks 🔒'); return; }
  const plan = mnyDefaultSweepPlan(opts);
  const grandma = plan.reason === 'grandma';
  if (!plan.weeks.length) {
    showToast(grandma ? 'No empty weeks between those dates — nothing to credit'
                      : 'No un-met weeks older than the catch-up window');
    return;
  }
  const span = `${mnyShortDate(plan.weeks[plan.weeks.length - 1].wk)} to ${mnyShortDate(plan.weeks[0].wk)}`;
  const n = plan.weeks.length, s = n === 1 ? '' : 's';
  const skipped = plan.skipped.jenn + plan.skipped.jess;
  const ok = await showConfirm(grandma
    ? `Credit ${mnyMoney(plan.total)} under the Grandma rule?\n\n`
      + ['jenn', 'jess'].map(k => `${mnyKidName(k)}: ${mnyMoney(plan.perKid[k])}`).join(' · ')
      + `\n\n${mnyMoney(plan.amount)} per child for each empty week, ${span}.`
      + (skipped ? `\n\n${skipped} week${skipped === 1 ? '' : 's'} with something recorded ${skipped === 1 ? 'is' : 'are'} left alone.` : '')
    : `Credit ${mnyMoney(plan.total)} across ${n} week${s} nobody sat down for?\n\n`
      + `${mnyMoney(plan.amount)} per child per week, from ${span}.\n\n`
      + `Weeks the catch-up list can still reach are left alone — settle those on their real numbers.`,
    { okLabel: 'Credit it', cancelLabel: 'Not now' });
  if (!ok) return;

  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.moneyLedger) c.moneyLedger = {};
  if (!c.finalizedWeeks) c.finalizedWeeks = {};
  const note = grandma ? ' — Grandma rule' : ' — nobody met, the default';
  let credited = 0, moved = 0;
  plan.weeks.forEach(w => {
    if (!c.moneyLedger[w.wk]) c.moneyLedger[w.wk] = {};
    if (!c.finalizedWeeks[w.wk]) c.finalizedWeeks[w.wk] = {};
    w.kids.forEach(kid => {
      // The guard, re-read at write time rather than trusted from the plan.
      if (c.finalizedWeeks[w.wk][kid] != null) return;
      if (grandma && mnyWeekHasAnyRecord(w.wk, kid)) return;
      moneyAddCash(kid, plan.amount, {
        kind: 'settle', from: 'earned', dayKey: w.wk, weekKey: w.wk, ref: w.wk,
        note: 'Week of ' + w.wk + note });
      evMirror(kid, { kind: 'settle', amount: 0, dayKey: w.wk, weekKey: w.wk, ref: w.wk,
                      note: 'Week of ' + w.wk + (grandma ? ' — settled under the Grandma rule' : ' — settled at the default') });
      c.finalizedWeeks[w.wk][kid] = plan.amount;
      c.moneyLedger[w.wk][kid] = {
        at: Date.now(), handEntered: true, defaulted: true, defaultReason: plan.reason,
        updatedAt: syncNow(),
        chores: 0, learning: 0, streak: 0, competition: 0, fines: 0, outside: 0,
        ready: 0, gic: 0, stock: 0, debtExtra: 0,
        gross: plan.amount, net: plan.amount,
        xp: 0, boxReleased: 0, loan: null,
      };
      credited = money2(credited + plan.amount);
      moved++;
    });
    if (typeof ctStampWeekState === 'function') ctStampWeekState(w.wk);
  });
  saveAll();
  mnyRenderRulesTab();
  showToast(moved
    ? `Credited ${mnyMoney(credited)} across ${plan.weeks.length} week${plan.weeks.length === 1 ? '' : 's'}`
    : 'Those weeks were already credited');
}

/* ── 👵 The Grandma rule ──
   Before the family started counting, every week was worth a flat amount. This
   is that rule, applied to the weeks between two dates a parent chooses. The
   form is a module draft and is NEVER stored: the dates are a question asked
   once, and the answer that matters — which weeks were credited — is in the
   ledger. Defaults: from the family's first week on file, to the most recent
   30 May, at MNY_DEFAULT_WEEK. */
let mnyGrandmaDraft = null;   // { from, to, amount } — never written to state
function mnyLastMay30(dayKey) {
  const day = String(dayKey || todayKey());
  const y = Number(day.slice(0, 4));
  const may = y + '-05-30';
  return day >= may ? may : (y - 1) + '-05-30';
}
function mnyGrandmaForm() {
  if (!mnyGrandmaDraft) {
    mnyGrandmaDraft = { from: String(mrStartWeek()), to: mnyLastMay30(todayKey()), amount: MNY_DEFAULT_WEEK };
  }
  return mnyGrandmaDraft;
}
function mnyGrandmaPlan() {
  const f = mnyGrandmaForm();
  return mnyDefaultSweepPlan({ reason: 'grandma', from: f.from, to: f.to, amount: f.amount });
}
function mnyGrandmaCard() {
  const f = mnyGrandmaForm();
  const plan = mnyGrandmaPlan();
  const n = plan.weeks.length;
  const perKid = ['jenn', 'jess'].map(k => {
    const weeks = plan.weeks.filter(w => w.kids.indexOf(k) >= 0).length;
    return `<div class="mny-row"><span>${CT_PROFILE_ICON[k]} ${mnyKidName(k)} — ${weeks} week${weeks === 1 ? '' : 's'}${
        plan.skipped[k] ? ` · ${plan.skipped[k]} skipped, they hold records` : ''}</span>
      <b>${mnyMoney(plan.perKid[k])}</b></div>`;
  }).join('');
  const rows = plan.weeks.slice(0, 8).map(w => `<div class="mny-row"><span>Week of ${escapeHtml(mnyShortDate(w.wk))}
      · ${escapeHtml(w.kids.map(mnyKidName).join(' and '))}</span><b>${mnyMoney(w.amount)}</b></div>`).join('');
  return `<div class="mny-card">
      <div class="mny-week-head"><span class="mny-label">👵 Grandma rule</span>
        <b>${mnyMoney(plan.total)}</b></div>
      <div class="mny-note">Before we started counting, every week was worth the same flat amount. This
        credits it to each girl for every week between these two dates that holds <b>no record at all</b> for
        her — no chore graded, no meet, no gift, no fine, nothing ticked, no meeting. A week with anything in it
        is skipped: it has its own numbers.</div>
      <label class="mny-field"><span>From the week of</span>
        <input type="date" value="${escapeAttr(f.from)}" data-mnyp-action="gmfrom"></label>
      <label class="mny-field"><span>To the week of</span>
        <input type="date" value="${escapeAttr(f.to)}" data-mnyp-action="gmto"></label>
      <div class="mny-row"><span>Each child, each week</span>
        <span class="mny-stepgrp">
          <button type="button" class="mny-step" data-mnyp-action="gmamt" data-mnyp-d="-0.5" aria-label="Less">−</button>
          <b>${mnyMoney(f.amount)}</b>
          <button type="button" class="mny-step" data-mnyp-action="gmamt" data-mnyp-d="0.5" aria-label="More">+</button>
        </span></div>
      <div class="mny-note">It never reaches this week or a later one, or the eight weeks the catch-up list still
        settles on real numbers — the latest week it can credit is the week of ${escapeHtml(mnyShortDate(plan.latest))}.
        Nothing here is saved until you credit it.</div>
      <div class="mny-rows">${perKid}</div>
      ${n ? `${rows}
        ${n > 8 ? `<div class="mny-note">…and ${n - 8} more.</div>` : ''}
        <button type="button" class="mny-btn primary wide" data-mnyp-action="grandma"
          >Credit ${mnyMoney(plan.total)} across ${n} week${n === 1 ? '' : 's'}</button>
        <div class="mny-note">Shown before anything moves. Run it again and it finds nothing new: a week it
          credited is a week with a record.</div>`
      : `<div class="mny-note mny-gap">No empty weeks between these dates — nothing to credit.</div>`}
    </div>`;
}

/* ── When the pocket money system starts, and the backlog before it ──
   Two stores gate how far back the meeting will look, and BOTH self-seed to the
   current Monday the first time anything reads them — which is why a family
   that has been running for months has no floor and the catch-up list saturates
   at its own ceiling. Set them, once, and the look-back has a real beginning.

   A parent-visible date rather than a constant in the source: a family's start
   date is the family's, and hardcoding one would ship this household's date in
   a public repo. */
function mnyStartDateCard() {
  ctEnsureShared();
  const c = state.shared.chore;
  const program = String(mrStartWeek());
  const derived = !c.programStartDate;
  const floor = (typeof mmCatchUpFloor === 'function') ? mmCatchUpFloor() : program;
  /* The flat default for weeks nobody sat down for used to sit here. It is the
     👵 Grandma rule section now, where a parent chooses its dates. */
  return `<div class="mny-card">
      <div class="mny-week-head"><span class="mny-label">📅 When pocket money started</span></div>
      <label class="mny-field"><span>First week</span>
        <input type="date" value="${escapeAttr(program)}" data-mnyp-action="startweek"></label>
      <div class="mny-note">The meeting looks back to the Monday of this week and no further.
        Currently ${escapeHtml(mnyShortDate(floor))}.${derived
          ? ` Worked out from the earliest week on file — set it if the family started before that.`
          : ''}</div>
      <div class="mny-note">A flat amount for the weeks before that is the 👵 Grandma rule, its own section.</div>
    </div>`;
}

/* ── The money stream, and what setting it up would do ──
   Stage 1 of the money redesign (js/40-stream.js). The stream records every
   movement — where a dollar came from, where it went — and derives every
   balance from that, instead of the app keeping one `wallet.cash` number that
   eight different functions had to remember to update.

   Nothing on any screen reads it yet. This card exists so the one-time set-up
   is a thing a parent SEES before it happens: the preview is computed by
   `evMigrationPlan`, which writes nothing, and the button runs exactly it.
   Money is never moved by this — the opening line is what she already has, so
   every derived balance comes out equal to the one on screen today. */
function mnyStreamCard() {
  const plans = (typeof evMigrationPlan === 'function') ? evMigrationPlan() : [];
  const pending = plans.filter(p => !p.alreadyDone);
  const drift = ['jenn', 'jess'].reduce((all, k) =>
    all.concat((typeof evShadowDrift === 'function' ? evShadowDrift(k) : [])
      .map(d => mnyKidName(k) + ' — ' + d)), []);
  return `<div class="mny-card">
      <div class="mny-week-head"><span class="mny-label">🔀 Where the money went</span></div>
      <div class="mny-note">Every movement of money, recorded one by one, so
        every total can be worked out from it instead of being remembered.</div>
      ${pending.length ? `
        ${pending.map(p => `<div class="mny-row">
            <span>${escapeHtml(mnyKidName(p.kid))} — ${p.weeks} settled week${p.weeks === 1 ? '' : 's'},
              ${p.gifts} gift${p.gifts === 1 ? '' : 's'}</span>
            <b>${mnyMoney(p.opening.cash)} already had</b>
          </div>`).join('')}
        <button type="button" class="mny-btn wide" data-mnyp-action="migrate"
          >Set it up — ${pending.reduce((n, p) => n + p.rows.length, 0)} movements from what is on record</button>
        <div class="mny-note">Shown before anything is written, and it moves no
          money: it reads the weeks already settled and the gifts already
          recorded, and opens each pot at exactly what it holds today.</div>`
      : `<div class="mny-note mny-gap">✅ Set up — every movement is on record.</div>`}
      ${drift.length
        ? `<div class="mny-note warn">These do not agree yet: ${escapeHtml(drift.join(' · '))}</div>`
        : `<div class="mny-note">Both ways of counting agree.</div>`}
    </div>`;
}

/* ── Weeks the retired branch short-changed ──
   Until the two money models became one, which model a week used was decided by
   a store that seeded itself to the current Monday — so on any device running a
   new build every week the family had lived was priced by the retired formula,
   and graded chores, the routine streak and a recorded competition all paid
   nothing in all of them. `finalizedWeeks[wk][kid] == null` then refused to
   credit them ever again.

   `evRepairPlan` (js/40-stream.js) reads only. Each week is re-priced under ITS
   OWN rules, never today's, and the repair only ever adds — a week the old
   branch happened to pay more for keeps what it paid. */
function mnyRepairCard() {
  const plans = (typeof evRepairPlan === 'function') ? evRepairPlan() : [];
  const total = money2(plans.reduce((n, p) => n + p.total, 0));
  const weeks = plans.reduce((n, p) => n + p.weeks.length, 0);
  if (!weeks) {
    return `<div class="mny-card">
        <div class="mny-week-head"><span class="mny-label">🩹 Weeks that were short</span></div>
        <div class="mny-note">✅ Nothing owed — every settled week matches what its own rules say.</div>
      </div>`;
  }
  return `<div class="mny-card">
      <div class="mny-week-head"><span class="mny-label">🩹 Weeks that were short</span>
        <b>${mnyMoney(total)}</b></div>
      <div class="mny-note">These were settled while two money models were live, and were
        priced by the retired one — so graded chores, the routine streak and any
        competition in them paid nothing. Each is re-priced under <b>its own</b> rules.</div>
      ${plans.filter(p => p.weeks.length).map(p => p.weeks.slice(0, 10).map(w => `
        <div class="mny-row">
          <span>${escapeHtml(mnyKidName(p.kid))} — week of ${escapeHtml(mnyShortDate(w.wk))}${w.why ? `<br><span class="mny-note">${escapeHtml(w.why)}</span>` : ''}</span>
          <b>${mnyMoney(w.was)} → ${mnyMoney(w.should)}</b>
        </div>`).join('')).join('')}
      <button type="button" class="mny-btn wide" data-mnyp-action="repair"
        >Pay the ${mnyMoney(total)} they were short, across ${weeks} week${weeks === 1 ? '' : 's'}</button>
      <div class="mny-note">Shown before anything moves, and it only ever adds:
        a week that was paid more than its rules say keeps what it paid.</div>
    </div>`;
}

async function mnyRunRepair() {
  if (!isParent()) { showToast('A grown-up settles the weeks 🔒'); return; }
  const plans = evRepairPlan();
  const total = money2(plans.reduce((n, p) => n + p.total, 0));
  const weeks = plans.reduce((n, p) => n + p.weeks.length, 0);
  if (!weeks) { showToast('Nothing owed ✅'); return; }
  const lines = plans.filter(p => p.weeks.length).map(p =>
    `${mnyKidName(p.kid)}: ${mnyMoney(p.total)} across ${p.weeks.length} week${p.weeks.length === 1 ? '' : 's'}`);
  const ok = await showConfirm(
    `Pay ${mnyMoney(total)} that ${weeks} settled week${weeks === 1 ? ' was' : 's were'} short?\n\n` +
    `${lines.join('\n')}\n\nEach week is re-priced under its own rules, and nothing is ever taken away.`,
    { okLabel: 'Pay it', cancelLabel: 'Not now' });
  if (!ok) return;
  const res = evRunRepair();
  showToast(`✅ ${mnyMoney(res.credited)} across ${res.weeks} week${res.weeks === 1 ? '' : 's'}`);
  mnyRenderRulesTab();
}

function mnyHistoryEditor(kid) {
  const rows = mnyLedgerRows(kid);
  return `${mnyStreamCard()}${mnyRepairCard()}${mnyStartDateCard()}<div class="mny-card">
      <div class="mny-week-head"><span class="mny-label">📖 Weeks on record</span><b>${rows.length}</b></div>
      <button type="button" class="mny-btn wide" data-mnyp-action="addweek">＋ Add a week that happened before this</button>
      <div class="mny-note">Each tap steps one week further back from the earliest week on record.</div>
    </div>
    ${rows.slice(0, 20).map(r => {
      const f = (label, key, step) =>
        `<div class="mny-row"><span>${escapeHtml(label)}</span>
          <span class="mny-stepgrp">
            <button type="button" class="mny-step" data-mnyp-action="led" data-mnyp-id="${escapeAttr(r.weekKey)}" data-mnyp-f="${key}" data-mnyp-d="${-step}" aria-label="Less">−</button>
            <b>${mnyMoney(r[key])}</b>
            <button type="button" class="mny-step" data-mnyp-action="led" data-mnyp-id="${escapeAttr(r.weekKey)}" data-mnyp-f="${key}" data-mnyp-d="${step}" aria-label="More">+</button>
          </span></div>`;
      const inTotal = money2(money2(r.chores) + money2(r.learning) + money2(r.streak) + money2(r.competition) + money2(r.outside));
      const outTotal = money2(money2((r.loan || {}).paid) + money2(r.debtExtra) + money2(r.ready) + money2(r.gic) + money2(r.stock));
      const gap = money2(inTotal - money2(r.fines) - outTotal);
      return `<div class="mny-card">
          <div class="mny-week-head">
            <span class="mny-label">Week of ${escapeHtml(mnyShortDate(r.weekKey))}${
              /* `defaulted` was written and read nowhere, so a week credited at
                 the flat default because nobody sat down read as "typed in" —
                 the same label as a week a parent entered from memory. They are
                 different facts and the history has to say which. */
              r.defaulted ? (r.defaultReason === 'grandma' ? ' · Grandma rule' : ' · nobody met') : (r.repricedAt ? ' · re-priced' : (r.handEntered ? ' · typed in' : (r.weeksLate ? ' · settled ' + r.weeksLate + 'wk late' : '')))}</span>
            <b>${mnyMoney(r.net)}</b>
          </div>
          ${r.handEntered ? `<div class="mny-rows">
              ${f('Jobs', 'chores', 1)}${f('Learning', 'learning', 1)}${f('Routines', 'streak', 1)}
              ${f('Competitions', 'competition', 5)}${f('From outside', 'outside', 5)}${f('Taken off', 'fines', 1)}
              ${f('Kept ready', 'ready', 1)}${f('Locked away', 'gic', 5)}${f('Into companies', 'stock', 1)}
              ${f('Paid off early', 'debtExtra', 1)}
              <div class="mny-row total"><span>In minus out</span><b class="${Math.abs(gap) > 0.005 ? 'warn' : ''}">${mnySigned(gap)}</b></div>
            </div>
            ${Math.abs(gap) > 0.005 ? `<div class="mny-note warn">These do not balance yet — ${mnyMoney(Math.abs(gap))} is unaccounted for.</div>` : ''}
            <button type="button" class="mny-btn" data-mnyp-action="leddel" data-mnyp-id="${escapeAttr(r.weekKey)}">Remove this week</button>`
          : `<div class="mny-rows">
              <div class="mny-row"><span>Jobs</span><b>${mnyMoney(r.chores)}</b></div>
              <div class="mny-row"><span>Learning</span><b>${mnyMoney(r.learning)}</b></div>
              <div class="mny-row"><span>Routines kept</span><b>${mnyMoney(r.streak)}</b></div>
              <div class="mny-row"><span>Competitions</span><b>${mnyMoney(r.competition)}</b></div>
              <div class="mny-row"><span>Taken off</span><b>${mnyMoney(r.fines)}</b></div>
              ${r.editReason ? `<div class="mny-row"><span>Changed at the meeting</span><b>${escapeHtml(mnyReasonLabel(r.editReason))}</b></div>` : ''}
            </div>
            <div class="mny-note">Settled at a meeting — frozen, and not editable. Corrections belong in the next week's conversation.</div>`}
        </div>`;
    }).join('')}`;
}

/* Both kids against their targets, always in view — the number that says
   whether any of these rates are set right. */
function mnyTargetsFooter() {
  return `<div class="mny-card">
      <div class="mny-label">This year, against target</div>
      ${['jenn', 'jess'].map(kid => {
        const y = mrYearToDate(kid);
        const target = mrTargetFor(kid);
        const pct = target > 0 ? Math.max(0, Math.min(100, Math.round((y.paidTotal / target) * 100))) : 0;
        return `<div class="mny-goal-row">${CT_PROFILE_ICON[kid]} ${kid === 'jenn' ? 'Jenn' : 'Jess'} — ${mnyMoney(y.paidTotal)} of ${mnyMoney(target)}${y.weeks ? ` over ${y.weeks} week${y.weeks === 1 ? '' : 's'}, on pace for ${mnyMoney(y.projected)}` : ''}</div>
          <div class="mny-progress"><div class="mny-progress-fill" style="width:${pct}%"></div></div>`;
      }).join('')}
    </div>`;
}

/* ════════════════════════════════════════════════════════════════
   CLICKS — one delegated handler, actions on data attributes
   ════════════════════════════════════════════════════════════════ */
/* ── The two doors back to cash ──
   Money goes INTO savings and companies through the meeting's step 4, but the
   only way back out used to be a parent editing a holding's numbers by hand —
   the buttons left with the old pocket-money screen. These reuse the functions
   that never stopped working (moneyWithdraw, moneySellStock), behind the same
   parent-only guard the commit path leans on. */
function mnyAskMoveSavedToCash(kid) {
  if (!moneyCanTransact()) return;
  const have = mnySavedTotal(kid);
  showPrompt(`Move how much of her kept-ready ${mnyMoney(have)} back to cash?`, { type: 'number', value: String(have) })
    .then(v => {
      if (v == null) return;
      const amt = money2(Number(v));
      if (!(amt > 0)) return;
      if (moneyWithdraw(kid, amt)) showToast(`${mnyMoney(Math.min(amt, have))} moved to cash`);
      mnyRenderRulesTab();
    });
}
function mnyAskSellHolding(kid, id) {
  if (!moneyCanTransact()) return;
  const h = mnyHoldings(kid).find(x => x.id === id);
  if (!h || h.kind !== 'stock') return;
  const have = Number(h.units) || 0;
  showPrompt(`Sell how many of ${h.name}? She has ${Math.round(have * 1000) / 1000}, worth ${mnyMoney(h.priceNow)} each.`, { type: 'number', value: String(have) })
    .then(v => {
      if (v == null) return;
      const n = Number(v);
      if (!(n > 0)) return;
      const before = mnyCash(kid);
      if (moneySellStock(kid, id, n)) showToast(`Sold for ${mnyMoney(money2(mnyCash(kid) - before))}`);
      mnyRenderRulesTab();
    });
}

function mnyParentClick(ev) {
  const el = ev.target.closest('[data-mnyp-action]');
  if (!el) return;
  const a = el.getAttribute('data-mnyp-action');
  const id = el.getAttribute('data-mnyp-id');
  const kid = mnyParentKid();

  if (a === 'section') { mnySetParentSection(id); return; }
  if (a === 'tab')     { mnyGoTab(el.getAttribute('data-mny-tab')); return; }
  if (a === 'kid')     { setParentKid(id); mnyRenderRulesTab(); return; }
  if (a === 'hist')    { mnyHistoryOpen = !mnyHistoryOpen; mnyRenderRulesTab(); return; }
  if (a === 'reason')  { mnyPendingReason = id; mnyRenderRulesTab(); return; }
  if (a === 'drop')    { mnyPending.splice(Number(el.getAttribute('data-mnyp-i')), 1); mnyRenderRulesTab(); return; }
  if (a === 'save')    { mnySavePending(); return; }
  if (a === 'discard') { mnyPending = []; mnyPendingFrom = null; mnyRenderRulesTab(); return; }
  if (a === 'meeting') { showScreen('parent'); openFamilyMeetingAsk(); return; }

  if (a === 'bump') {
    const path = el.getAttribute('data-mnyp-path');
    const d = Number(el.getAttribute('data-mnyp-d'));
    const pend = mnyPending.find(p => p.path === path);
    const cur = pend ? pend.value : (Number(mrGetPath(mrRules(), path)) || 0);
    mnyQueueEdit(path, Math.max(0, Math.round((cur + d) * 1000) / 1000), el.getAttribute('data-mnyp-label'));
    return;
  }
  if (a === 'chan') {
    const wk = mnyWeekKey();
    const b = mrWeekBreakdown(wk, kid);
    const cur = { chores: b.chorePaid, learning: b.learnPaid, streak: b.streakBonus,
                  comp: b.compPaid, fines: b.fines.total }[id];
    mnySetOverride(kid, wk, id, Math.max(0, money2(cur + Number(el.getAttribute('data-mnyp-d')))),
      mnyWeekReason(kid, wk) || 'fixing');
    mnyRenderRulesTab();
    return;
  }
  if (a === 'chanreset') { mnyClearOverride(kid, mnyWeekKey(), id); mnyRenderRulesTab(); return; }

  if (a === 'debt') {
    const f = el.getAttribute('data-mnyp-f');
    const d = Number(el.getAttribute('data-mnyp-d'));
    const rec = mnyDebtById(kid, id);
    if (rec) mnyEditDebt(kid, id, f, Math.max(0, money2(money2(rec[f]) + d)));
    mnyRenderRulesTab();
    return;
  }
  if (a === 'debticon') { mnyEditDebt(kid, id, 'icon', el.getAttribute('data-mnyp-ic')); mnyRenderRulesTab(); return; }
  if (a === 'debtdel')  { if (mnyRemoveDebt(kid, id)) mnyRenderRulesTab(); return; }
  if (a === 'debtadd')  {
    mnyAddDebt(kid, { name: 'New loan', icon: '🚲', principal: 100, monthly: 10,
                      downPaymentDue: todayKey() });
    mnyRenderRulesTab();
    return;
  }
  if (a === 'holddel')  { mnyRemoveHolding(kid, id); mnyRenderRulesTab(); return; }
  if (a === 'saved2cash') { mnyAskMoveSavedToCash(kid); return; }
  if (a === 'mvok') { if (mnyApproveMove(kid, id)) showToast('Moved 🔀'); mnyRenderRulesTab(); return; }
  if (a === 'mvno') {
    showPrompt('Why not, in a few words? She will see it.', { value: 'We talked about it' })
      .then(v => { if (v == null) return; mnyRejectMove(kid, id, v); mnyRenderRulesTab(); });
    return;
  }
  if (a === 'holdsell')   { mnyAskSellHolding(kid, id); return; }
  if (a === 'holdkind') { mnyEditHolding(kid, id, 'kind', el.getAttribute('data-mnyp-k')); mnyRenderRulesTab(); return; }
  if (a === 'hold') {
    const f = el.getAttribute('data-mnyp-f');
    const d = Number(el.getAttribute('data-mnyp-d'));
    const h = mnyHoldings(kid).find(x => x.id === id);
    if (h) mnyEditHolding(kid, id, f, Math.max(0, Math.round(((Number(h[f]) || 0) + d) * 1000) / 1000));
    mnyRenderRulesTab();
    return;
  }
  if (a === 'holdadd') {
    mnyAddHolding(kid, { kind: 'savings', name: 'Money kept ready', units: 1,
                         priceNow: 0, costBasis: 0, rateAnnual: bankConfig().savingsRate });
    mnyRenderRulesTab();
    return;
  }
  if (a === 'fund')   { mnyQueueEdit('investing.fund', id, 'What her investing money buys'); return; }
  if (a === 'unlock') { mnyQueueEdit('school.unlockStage.' + kid, Number(el.getAttribute('data-mnyp-i')), 'Open a lesson stage early'); return; }
  if (a === 'stagepct') {
    if (MNY_TUNABLE_STAGES.indexOf(id) < 0) return;
    const next = Math.max(0, Math.min(100, mnyStagePctShown(id) + Number(el.getAttribute('data-mnyp-d'))));
    const why = mnyStagePctRefusal({ [id]: next });
    if (why) { showToast(why); return; }
    const s = MNY_STAGES.find(x => x.id === id);
    mnyQueueEdit('school.stagePct.' + id, next, s.title + ' opens at (% paid off)');
    return;
  }

  if (a === 'led') {
    const f = el.getAttribute('data-mnyp-f');
    const d = Number(el.getAttribute('data-mnyp-d'));
    mnyEditLedger(kid, id, f, d);
    mnyRenderRulesTab();
    return;
  }
  if (a === 'leddel')  { mnyDeleteLedgerWeek(kid, id); mnyRenderRulesTab(); return; }
  if (a === 'addweek') { mnyAddMissedWeek(kid); mnyRenderRulesTab(); return; }
  if (a === 'grandma') {
    const f = mnyGrandmaForm();
    mnyRunDefaultSweep({ reason: 'grandma', from: f.from, to: f.to, amount: f.amount });
    return;
  }
  if (a === 'gmamt') {
    const f = mnyGrandmaForm();
    f.amount = Math.max(0, money2(f.amount + Number(el.getAttribute('data-mnyp-d'))));
    mnyRenderRulesTab();
    return;
  }
  if (a === 'migrate')      { mnyRunStreamSetup(); return; }
  if (a === 'repair')       { mnyRunRepair(); return; }
  if (a === 'houserules') {
    if (mrApplyHouseRules()) showToast('✅ The four house rules are in the rulebook');
    mnyRenderRulesTab();
    return;
  }
}

/* Writes the stream's opening record, after saying what it will do. Separate
   from `evRunMigration` (js/40-stream.js) for the reason every writer in this
   app is: that one owns the decision and writes nothing a preview did not
   show, this one owns the conversation with the parent. */
async function mnyRunStreamSetup() {
  if (!isParent()) { showToast('A grown-up sets this up 🔒'); return; }
  const plans = evMigrationPlan();
  const rows = plans.reduce((n, p) => n + p.rows.length, 0);
  if (!rows) { showToast('Already set up ✅'); return; }
  const lines = plans.filter(p => !p.alreadyDone).map(p =>
    `${mnyKidName(p.kid)}: ${p.weeks} settled week${p.weeks === 1 ? '' : 's'}, ` +
    `${p.gifts} gift${p.gifts === 1 ? '' : 's'}, opening ${mnyMoney(p.opening.cash)} in hand`);
  const ok = await showConfirm(
    `Record ${rows} movements from what is already on file?\n\n${lines.join('\n')}\n\n` +
    `No money moves — every total stays exactly as it reads today.`,
    { okLabel: 'Set it up', cancelLabel: 'Not now' });
  if (!ok) return;
  const res = evRunMigration();
  const left = ['jenn', 'jess'].reduce((all, k) => all.concat(evShadowDrift(k)), []);
  showToast(left.length
    ? `Recorded ${res.written} — but ${left.length} total${left.length === 1 ? '' : 's'} disagree`
    : `✅ Recorded ${res.written} movements — every total agrees`);
  mnyRenderRulesTab();
}

/* ONE date now. There used to be two — `programStartDate` and
   `moneyModelStartWeek` — gating different things and both self-seeding to the
   current Monday, so a household running for months was told its record began
   this week and its whole backlog fell out of reach. `mrStartWeek`
   (js/18-rules.js) derives it from the earliest week on file when nobody has
   set it; this is how a family says their real beginning was earlier still.

   Stamped, because `deepMergeObj` lets a REMOTE SCALAR WIN: without a stamp a
   device still holding its own older idea of the start date would push it
   straight back over a parent's choice, silently. `mergeSharedChore` arbitrates
   the pair newest-wins. Normalised to the MONDAY of whatever date was typed,
   because every week key in this app is a Monday. */
function mnySetStartWeek(value) {
  if (!isParent()) { showToast('A grown-up sets this 🔒'); return; }
  if (!value) return;
  const d = formatDayKey(value);
  if (!d || isNaN(d)) return;
  const wk = (typeof ctWeekKeyForDate === 'function') ? ctWeekKeyForDate(value) : value;
  ctEnsureShared();
  const c = state.shared.chore;
  c.programStartDate = wk;
  c.programStartDateAt = syncNow();
  /* `moneyModelStartWeek` and `routineRuleStartWeek` are retired but NOT
     deleted. A delete inside state.shared.chore cannot propagate — deepMergeObj
     iterates the keys the remote has, so the next snapshot puts them straight
     back — and tidying them would churn the document on every sync to no
     effect. Nothing reads them any more; a stored copy is left where it lies,
     the same reasoning as the retired `unlockedActs`. */
  saveAll();
  mnyRenderRulesTab();
  showToast('Pocket money starts the week of ' + mnyShortDate(wk));
}

/* Typed fields need input/change rather than click. */
function mnyParentInput(ev) {
  const el = ev.target.closest('[data-mnyp-action]');
  if (!el) return;
  const a = el.getAttribute('data-mnyp-action');
  const id = el.getAttribute('data-mnyp-id');
  const kid = mnyParentKid();
  if (a === 'search') { mnyRuleSearch = el.value; mnyRenderRulesTab(); return; }
  if (a === 'from')   { mnyPendingFrom = el.value; return; }
  if (a === 'startweek') { mnySetStartWeek(el.value); return; }
  /* The Grandma rule's dates: kept in the draft on every keystroke, drawn again
     only once the date is committed, so typing a date is never interrupted. */
  if (a === 'gmfrom' || a === 'gmto') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(el.value)) return;
    mnyGrandmaForm()[a === 'gmfrom' ? 'from' : 'to'] = el.value;
    if (ev.type === 'change') mnyRenderRulesTab();
    return;
  }
  if (a === 'debtname') { mnyEditDebt(kid, id, 'name', el.value); return; }
  if (a === 'debtitem') { mnyEditDebt(kid, id, 'item', el.value); return; }
  if (a === 'debtdue')  { mnyEditDebt(kid, id, 'downPaymentDue', el.value); return; }
  if (a === 'holdname') { mnyEditHolding(kid, id, 'name', el.value); return; }
  if (a === 'holddate') { mnyEditHolding(kid, id, 'maturesOn', el.value); return; }
}

/* ── Weeks that happened before the app did ──
   Typed in one at a time, walking backwards from the earliest week on record,
   and always marked `handEntered` so nobody later mistakes a memory for a
   measurement. */
function mnyAddMissedWeek(kid) {
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.moneyLedger) c.moneyLedger = {};
  const existing = Object.keys(c.moneyLedger).filter(wk => c.moneyLedger[wk] && c.moneyLedger[wk][kid]).sort();
  const anchor = existing.length ? existing[0] : mnyWeekKey();
  const d = formatDayKey(anchor);
  d.setDate(d.getDate() - 7);
  const wk = ctDateToKey(d);
  if (!c.moneyLedger[wk]) c.moneyLedger[wk] = {};
  if (c.moneyLedger[wk][kid]) { showToast('That week is already on record'); return; }
  if (typeof ctStampWeekState === 'function') ctStampWeekState(wk);
  c.moneyLedger[wk][kid] = {
    at: Date.now(), handEntered: true, updatedAt: syncNow(),
    chores: 0, learning: 0, streak: 0, competition: 0, fines: 0, outside: 0,
    ready: 0, gic: 0, stock: 0, debtExtra: 0, gross: 0, net: 0,
    xp: 0, boxReleased: 0, loan: null,
  };
  saveAll();
  showToast('Added the week of ' + mnyShortDate(wk));
}
function mnyEditLedger(kid, wk, field, delta) {
  ctEnsureShared();
  const row = ((state.shared.chore.moneyLedger || {})[wk] || {})[kid];
  // A settled week is frozen. It is a record of what was agreed, and editing it
  // after the fact would make every history in the app un-trustable.
  if (!row || !row.handEntered) { showToast('That week was settled at a meeting — it cannot be edited'); return; }
  row[field] = Math.max(0, money2(money2(row[field]) + delta));
  row.gross = money2(money2(row.chores) + money2(row.learning) + money2(row.streak) + money2(row.competition));
  row.net = money2(Math.max(0, row.gross - money2(row.fines)));
  row.updatedAt = syncNow();
  saveAll();
}
function mnyDeleteLedgerWeek(kid, wk) {
  ctEnsureShared();
  const led = state.shared.chore.moneyLedger || {};
  const row = (led[wk] || {})[kid];
  if (!row || !row.handEntered) { showToast('Only weeks you typed in can be removed'); return; }
  delete led[wk][kid];
  saveAll();
}
