// Weekly-Planner — 🎓 Money school: the ideas behind every number.
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   PAGE 5 · MONEY SCHOOL

   The other four pages tell her what happened. This one tells her why any of
   it works that way. It is the only money page with no numbers of her own on
   it, and the only one she never has to open.

   Two decisions shape it:

   1. THE LESSONS ARRIVE AS THE DEBT COMES DOWN, not on a calendar. Locking a
      year away is a meaningless idea to someone with nothing spare and a loan
      to clear; it becomes a real choice at exactly the point she has money
      that could go either way. So every idea is gated on the share of what she
      owes that is paid off, and a locked one shows what opens it rather than
      its body — a lesson arriving before the thing it explains is just noise.

   2. IT NAMES HER ACTUAL DEBT. Nothing here says "ski" or "loan"; every string
      interpolates from the debt record, so the page reads as being about her
      week rather than about money in general.

   Reached from My money, and from the "Take me to Money school" on every `?`
   card in the system — so a question asked anywhere lands somewhere that
   answers it properly.
   ════════════════════════════════════════════════════════════════ */

let mnySchoolConcept = 'debt';
/* Where Money school's ◀ goes back to (Plan v5 §L M10: "📚 Take me to Money
   school" and back to the same page). Module state on this device only —
   never in `state`, which every write uploads whole. `{ screen, scrollY }`;
   null means the default, My money. */
let mnySchoolReturn = null;

function mnyOpenSchool(kid, conceptId, opts) {
  if (isParent() && (kid === 'jenn' || kid === 'jess')) mnyKid = kid;
  if (conceptId) mnySchoolConcept = conceptId;
  const from = opts && opts.from;
  mnySchoolReturn = from ? { screen: String(from), scrollY: Number(opts.scrollY) || 0 } : null;
  showScreen('moneyschool');
  mnyRenderSchool();
}
/* ◀ from Money school: back where the explainer was opened — My money at the
   same place on the page, or the Sunday step it was asked from. Anything
   else, and the default, is My money. */
function mnySchoolBack() {
  const back = mnySchoolReturn;
  mnySchoolReturn = null;
  /* From Sunday's '?' (the meeting is a screen): back to the same girl and
     the same Sunday step — the step lives in her device-local draft. */
  if (back && back.screen === 'meeting') {
    showScreen('meeting');
    renderMeetingMode();
    return;
  }
  mnyOpenMyMoney(mnyViewKid());
  if (back && back.screen === 'mymoney' && back.scrollY > 0) {
    try { window.scrollTo(0, back.scrollY); } catch (e) {}
  }
}

function mnyRenderSchool() {
  const wrap = document.getElementById('mnySchoolWrap');
  if (!wrap) return;
  const kid = mnyViewKid();
  const pct = mnyPaidPct(kid);
  const idx = mnyStageIndex(kid);

  if (!mnyConceptById(mnySchoolConcept)) mnySchoolConcept = 'debt';

  wrap.innerHTML =
      `${mnyPageHead('🎓 Money school', 'Why any of it works this way', [], { back: 'backschool' })}
       ${mnyTabBar('school')}
       <div class="mny-cols school">
         <div class="mny-col">${mnyLadderCard(kid, pct, idx)}</div>
         <div class="mny-col">${mnyConceptPanel(kid)}</div>
         <div class="mny-col">${mnyWorkListsCard()}${mnyBuysCard()}</div>
       </div>`;
  if (typeof enhanceNonButtonClickables === 'function') enhanceNonButtonClickables(wrap);
}

/* The ladder. Where she is, what is next, and what it takes — stated as the
   real number, because "60%" with no dollars behind it is not a goal. */
function mnyLadderCard(kid, pct, idx) {
  const owed = mnyTotalOwing(kid);
  const principal = mnyTotalPrincipal(kid);
  const next = MNY_STAGES[idx + 1];
  const toNext = next && principal > 0
    ? money2(Math.max(0, (mnyStagePct(next.id) / 100) * principal - mnyTotalPaid(kid))) : 0;

  const rows = MNY_STAGES.map((s, i) => {
    const open = i <= idx;
    return `<div class="mny-row${i === idx ? ' total' : ''}${open ? '' : ' dim'}">
        <span>${s.icon} ${escapeHtml(s.title)}</span>
        <b>${i === idx ? 'you are here' : (open ? 'open' : '🔒 ' + mnyStagePct(s.id) + '%')}</b>
      </div>`;
  }).join('');

  return `<div class="mny-card">
      <div class="mny-label">This opens up as your loan comes down</div>
      <div class="mny-total">${pct}%</div>
      <div class="mny-progress"><div class="mny-progress-fill green" style="width:${pct}%"></div></div>
      <div class="mny-goal-row">${owed > 0
        ? `${mnyMoney(owed)} still to go`
        /* No loan is not a loan paid off. `mnyPaidPct` reads 100 for a child
           who owes nothing, which opens every pot — but "paid off" would be
           celebrating something that never happened. */
        : (principal > 0 ? `All paid off. Everything is open.` : `Nothing to pay back, so everything is open.`)}</div>
      <div class="mny-rows">${rows}</div>
      ${next && toNext > 0
        ? `<div class="mny-note">Pay off <b>${mnyMoney(toNext)}</b> more and <b>${escapeHtml(next.icon + ' ' + next.title)}</b> opens.</div>`
        : ''}
    </div>`;
}

/* The chips, and whichever idea is picked. */
function mnyConceptPanel(kid) {
  /* A locked chip is still tappable. Disabling it would leave a kid pressing a
     dead button with no idea why; tapping it says what opens it, which is the
     only useful thing a locked lesson has to offer. */
  const chips = MNY_CONCEPTS.map(c => {
    const open = mnyIsOpen(kid, c.stage);
    return `<button type="button" class="mny-chip ${mnySchoolConcept === c.id ? 'on' : ''}${open ? '' : ' locked'}"
      data-mny-action="concept" data-mny-concept="${c.id}">
      ${c.icon} ${escapeHtml(c.title)}${open ? '' : ' 🔒'}</button>`;
  }).join('');

  const c = mnyConceptCard(mnySchoolConcept, kid);
  const toGo = money2(Math.max(0, (mnyStagePct(c.stage) / 100) * mnyTotalPrincipal(kid) - mnyTotalPaid(kid)));
  const body = c.open
    ? `<div class="mny-sub">What it is</div><p>${escapeHtml(c.what)}</p>
       <div class="mny-sub">${escapeHtml(c.whyLabel)}</div><p>${escapeHtml(c.why)}</p>
       <div class="mny-sub">${escapeHtml(c.riskLabel)}</div><p>${escapeHtml(c.risk)}</p>`
    : `<p>🔒 ${escapeHtml(mnyNeedLabel(c.stage))}.</p>
       ${toGo > 0 ? `<p>Pay off <b>${mnyMoney(toGo)}</b> more and this one opens.</p>` : ''}
       <p>It is not a secret — it is just easier to understand once you have money that could go either way.</p>`;

  return `<div class="mny-card">
      <div class="mny-label">The ideas</div>
      <div class="mny-chiprow">${chips}</div>
    </div>
    <div class="mny-card">
      <div class="mny-week-head"><span class="mny-label">${escapeHtml(c.icon + ' ' + c.title)}</span></div>
      <div class="mny-concept-body">${body}</div>
    </div>
    ${mnySchoolConcept === 'stock' ? mnyStockChart() : ''}`;
}

/* What money actually buys. The list exists so a number can be weighed against
   something real — "$40" is a word, "a pizza night" is a quantity. */
function mnyBuysCard() {
  const items = mnyBuysItems();
  if (!items.length) return '';
  return `<div class="mny-card">
      <div class="mny-label">🛒 What money buys</div>
      <div class="mny-rows">${items.map(i =>
        `<div class="mny-row"><span>${escapeHtml(i.label)}</span><b>${mnyMoney(i.amount)}</b></div>`).join('')}</div>
      <div class="mny-note">Real prices, from things we actually buy. It is how you tell whether something is worth saving for.</div>
    </div>`;
}

/* The line the whole rulebook rests on: some things are paid for and most
   things are not, and knowing which is which is the point.

   "Just part of being here" is a lesson and stays as one. Its one line a rule
   decides — how many household chores a week are free — is written from the
   live rules. What PAYS is the live price list itself, in the same closed-by-
   default card and the same remembered toggle My money uses: the literal list
   that stood here still said homework paid after it stopped paying. */
function mnyWorkListsCard() {
  const free = Math.max(0, Math.round(Number((mrRules().chores || {}).freeChoresPerWeek) || 0));
  const words = ['', 'first', 'first two', 'first three', 'first four', 'first five', 'first six', 'first seven'];
  const freeLine = free > 0
    ? `The ${words[free] || 'first ' + free} household chore${free === 1 ? '' : 's'} each week`
    : '';
  const lines = MNY_UNPAID.concat(freeLine ? [freeLine] : []);
  return `<div class="mny-card">
      <div class="mny-label">Just part of being here</div>
      <div class="mny-rows">${lines.map(t => `<div class="mny-row"><span>${escapeHtml(t)}</span></div>`).join('')}</div>
      <div class="mny-note">Nobody gets paid for these. They are what living in a family looks like.</div>
    </div>
    ${mnyPricesCard(mnyWeekKey())}`;
}
