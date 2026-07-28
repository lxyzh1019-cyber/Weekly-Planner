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
];

function mnyParentKid() { return (parentViewing === 'jenn' || parentViewing === 'jess') ? parentViewing : 'jess'; }
function mnySetParentSection(id) { mnyParentSection = id; mnyRenderRulesTab(); }

function mnyRenderRulesTab() {
  const wrap = document.getElementById('mnyRulesWrap');
  if (!wrap) return;
  if (!isParent()) { wrap.innerHTML = `<div class="mny-card"><div class="mny-note">Parents only 🔒</div></div>`; return; }
  const kid = mnyParentKid();
  const v = mrLatestVersion();

  const nav = MNY_PARENT_SECTIONS.map(s =>
    `<button type="button" class="mny-chip ${mnyParentSection === s.id ? 'on' : ''}" data-mnyp-action="section" data-mnyp-id="${s.id}">${s.label}</button>`).join('');

  let body = '';
  if (mnyParentSection === 'prices') body = mnyRulePrices();
  else if (mnyParentSection === 'week') body = mnyWeekResults(kid);
  else if (mnyParentSection === 'debts') body = mnyDebtEditor(kid);
  else if (mnyParentSection === 'holdings') body = mnyHoldingsEditor(kid);
  else if (mnyParentSection === 'lessons') body = mnyLessonEditor(kid);
  else body = mnyHistoryEditor(kid);

  wrap.innerHTML =
      `<div class="mny-card">
         <div class="mny-week-head">
           <span class="mny-label">⚙️ Money rules — ${CT_PROFILE_ICON[kid]} ${kid === 'jenn' ? 'Jenn' : 'Jess'}</span>
           <span class="mny-chiprow">${['jenn', 'jess'].map(k =>
             `<button type="button" class="mny-chip ${k === kid ? 'on' : ''}" data-mnyp-action="kid" data-mnyp-id="${k}">${CT_PROFILE_ICON[k]} ${k === 'jenn' ? 'Jenn' : 'Jess'}</button>`).join('')}</span>
         </div>
         <div class="mny-note">Every change is dated and recorded. Past weeks keep the prices that were live when the work was done — changing a price today never rewrites what they already earned. In effect since <b>${escapeHtml((v && v.effectiveFrom) || '—')}</b> · ${escapeHtml(mrReasonLabel(v && v.reason))}</div>
         <div class="mny-chiprow">${nav}</div>
       </div>
       ${mnyPendingBar()}
       ${body}
       ${mnyTargetsFooter()}`;
  if (typeof enhanceNonButtonClickables === 'function') enhanceNonButtonClickables(wrap);
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
      ${num('Dance — per Silver item', 'competition.dance.silverPerItem', (cp.dance || {}).silverPerItem)}
      ${num('Dance — per Gold item', 'competition.dance.goldPerItem', (cp.dance || {}).goldPerItem)}
      ${num('Dance — most for one test', 'competition.dance.testCap', (cp.dance || {}).testCap, 5)}
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

  return `<div class="mny-card">
      <label class="mny-field"><span>Find a price</span>
        <input type="search" value="${escapeAttr(mnyRuleSearch)}" placeholder="streak, dance, cap…" data-mnyp-action="search"></label>
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
    </div>
    ${mnyChangeHistory()}`;
}

/* ── What she owns ──
   One record per holding, kept truthful by hand. There is no market
   simulation: a share is worth what this page says it is worth, which is both
   simpler to explain and closer to how it actually works. */
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
          <button type="button" class="mny-step" data-mnyp-action="holddel" data-mnyp-id="${escapeAttr(h.id)}" aria-label="Remove">✕</button>
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

  return `<div class="mny-card">
      <div class="mny-label">📈 What she owns</div>
      <div class="mny-rows">
        <div class="mny-row"><span>Cash</span><b>${mnyMoney(mnyCash(kid))}</b></div>
        <div class="mny-row"><span>Kept ready</span><b>${mnyMoney(mnySavedTotal(kid))}</b></div>
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
   Which stage she is at, and the override for when the conversation gets
   somewhere before the loan does. */
function mnyLessonEditor(kid) {
  const idx = mnyStageIndex(kid);
  const pct = mnyPaidPct(kid);
  const override = mnyUnlockOverride(kid);
  return `<div class="mny-card">
      <div class="mny-label">🎓 Where she is</div>
      <div class="mny-progress"><div class="mny-progress-fill green" style="width:${pct}%"></div></div>
      <div class="mny-goal-row">${pct}% of everything she owes is paid off</div>
      <div class="mny-rows">
        ${MNY_STAGES.map((s, i) => `<div class="mny-row${i === idx ? ' total' : ''}">
            <span>${s.icon} ${escapeHtml(s.title)}</span>
            <b>${i < idx ? 'open' : (i === idx ? 'here now' : (pct >= s.pct ? 'open' : '🔒 ' + s.pct + '%'))}</b>
          </div>`).join('')}
      </div>
      <div class="mny-label" style="margin-top:0.5rem">Open a stage early</div>
      <div class="mny-chiprow">${MNY_STAGES.map((s, i) =>
        `<button type="button" class="mny-chip ${override === i ? 'on' : ''}" data-mnyp-action="unlock" data-mnyp-i="${i}">${s.icon} ${i === 0 ? 'no override' : s.pct + '%'}</button>`).join('')}</div>
      <div class="mny-note">Use this when you have had the conversation and she is ready for it before the loan says so. It only ever opens things — it cannot close one she has reached.</div>
    </div>
    ${mnyChangeHistory()}`;
}

function mnyChangeHistory() {
  const entries = mrLogEntries().slice(0, mnyHistoryOpen ? 60 : 8);
  return `<div class="mny-card">
      <button type="button" class="mny-acc" data-mnyp-action="hist" aria-expanded="${mnyHistoryOpen}">
        <span class="mny-label">📋 Change history</span><span>${mnyHistoryOpen ? 'Less ▾' : 'More ▸'}</span>
      </button>
      <div class="mny-rows">
        ${entries.length ? entries.map(e => `<div class="mny-row">
            <span>${escapeHtml(e.note || e.path)} · ${escapeHtml(mrReasonLabel(e.reason))} · ${escapeHtml(mnyShortDate(new Date(e.at).toISOString().slice(0, 10)))}</span>
            <b>${escapeHtml(e.from == null ? '—' : String(e.from))} → ${escapeHtml(e.to == null ? '—' : String(e.to))}</b>
          </div>`).join('') : `<div class="mny-note">No changes yet — the starting template is still in effect.</div>`}
      </div>
    </div>`;
}

/* ── Week history ──
   The frozen ledger, and a way to type in the weeks that happened before the
   app did. Hand-entered rows are marked as such: a week somebody typed from
   memory is not the same evidence as a week the app watched happen. */
function mnyHistoryEditor(kid) {
  const rows = mnyLedgerRows(kid);
  return `<div class="mny-card">
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
            <span class="mny-label">Week of ${escapeHtml(mnyShortDate(r.weekKey))}${r.handEntered ? ' · typed in' : ''}</span>
            <b>${mnyMoney(r.net)}</b>
          </div>
          ${r.handEntered ? `<div class="mny-rows">
              ${f('Jobs', 'chores', 1)}${f('Learning', 'learning', 1)}${f('Clean days', 'streak', 1)}
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
              <div class="mny-row"><span>Clean days</span><b>${mnyMoney(r.streak)}</b></div>
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
function mnyParentClick(ev) {
  const el = ev.target.closest('[data-mnyp-action]');
  if (!el) return;
  const a = el.getAttribute('data-mnyp-action');
  const id = el.getAttribute('data-mnyp-id');
  const kid = mnyParentKid();

  if (a === 'section') { mnySetParentSection(id); return; }
  if (a === 'kid')     { setParentKid(id); mnyRenderRulesTab(); return; }
  if (a === 'hist')    { mnyHistoryOpen = !mnyHistoryOpen; mnyRenderRulesTab(); return; }
  if (a === 'reason')  { mnyPendingReason = id; mnyRenderRulesTab(); return; }
  if (a === 'drop')    { mnyPending.splice(Number(el.getAttribute('data-mnyp-i')), 1); mnyRenderRulesTab(); return; }
  if (a === 'save')    { mnySavePending(); return; }
  if (a === 'discard') { mnyPending = []; mnyPendingFrom = null; mnyRenderRulesTab(); return; }
  if (a === 'meeting') { showScreen('parent'); openFamilyMeeting(); return; }

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

  if (a === 'led') {
    const f = el.getAttribute('data-mnyp-f');
    const d = Number(el.getAttribute('data-mnyp-d'));
    mnyEditLedger(kid, id, f, d);
    mnyRenderRulesTab();
    return;
  }
  if (a === 'leddel')  { mnyDeleteLedgerWeek(kid, id); mnyRenderRulesTab(); return; }
  if (a === 'addweek') { mnyAddMissedWeek(kid); mnyRenderRulesTab(); return; }
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
  c.moneyLedger[wk][kid] = {
    at: Date.now(), handEntered: true, updatedAt: Date.now(),
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
  row.updatedAt = Date.now();
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
