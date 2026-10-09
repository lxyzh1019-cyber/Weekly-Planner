// Weekly-Planner — 🎓 Money school: the ideas behind every number.
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   🎓 MONEY SCHOOL — the second of her two money tabs (decision 14)

   💰 My money tells her what happened. This one tells her why any of
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

  /* The same head as My money (decision 14): ◀, the title, the two tabs,
     ? and the date; no bottom bar. Three columns of `.mv2` cards on the
     iPad, filling the screen, as the stage 8 drawing places them: the ladder
     over the Companies chart, the ideas, then "Just part of being here" over
     what money buys. One column on the phone. */
  wrap.innerHTML =
      `${mnyPageHead('🎓 Money school', '', [
          { action: 'tourkid', icon: '?', word: 'How this page works' },
        ], { kidSwitch: true, tabs: 'school', date: true, back: 'backschool', big: true })}
       <div class="mv2-school" data-money-surface>
         <div class="mv2-col">${mnyLadderCard(kid, pct, idx)}${mnyStockChart()}</div>
         <div class="mv2-col">${mnyIdeasCard(kid)}</div>
         <div class="mv2-col">${mnyWorkListsCard()}${mnyBuysCard()}</div>
       </div>`;
  if (typeof enhanceNonButtonClickables === 'function') enhanceNonButtonClickables(wrap);
}

/* 🔓 What opens when. Where she is, what is next, and what it takes — stated
   as the real number, because "60%" with no dollars behind it is not a goal. */
function mnyLadderCard(kid, pct, idx) {
  const owed = mnyTotalOwing(kid);
  const principal = mnyTotalPrincipal(kid);
  const next = MNY_STAGES[idx + 1];
  const toNext = next && principal > 0
    ? money2(Math.max(0, (mnyStagePct(next.id) / 100) * principal - mnyTotalPaid(kid))) : 0;

  /* Each step says where it opens, as drawn: "open · 20%", "I am here ·
     30%", "🔒 at 40%" (the first step opens at 0%, so it says only "open"). */
  const rows = MNY_STAGES.map((s, i) => {
    const open = i <= idx;
    const at = mnyStagePct(s.id);
    const verdict = i === idx ? 'I am here' + (at > 0 ? ' · ' + at + '%' : '')
      : open ? 'open' + (at > 0 ? ' · ' + at + '%' : '') : '🔒 at ' + at + '%';
    return `<div class="mv2-li mv2-ladder-row${i === idx ? ' here' : ''}${open ? '' : ' dim'}">
        <span>${s.icon} ${escapeHtml(s.title)}</span>
        <b>${verdict}</b>
      </div>`;
  }).join('');

  return `<div class="mv2-card mv2-ladder">
      <div class="mv2-cardhead"><span class="mv2-title">🔓 What opens when</span></div>
      <div class="mv2-ladder-goal">${owed > 0
        ? `<b class="mv2-ladder-pct">${pct}%</b><span>of my loans paid</span><b class="mv2-ladder-left">${mnyMoney(owed)} to go</b>`
        /* No loan is not a loan paid off. `mnyPaidPct` reads 100 for a child
           who owes nothing, which opens every pot — but "paid off" would be
           celebrating something that never happened. */
        : `<span>${principal > 0 ? 'All paid off. Everything is open.' : 'Nothing to pay back, so everything is open.'}</span>`}</div>
      <span class="mv2-bar mv2-ladder-bar"><i style="width:${pct}%"></i></span>
      <div class="mv2-rows">${rows}</div>
      ${next && toNext > 0
        ? `<div class="mv2-sum mv2-ladder-next">Pay off <b>${mnyMoney(toNext)}</b> more and <b>${escapeHtml(next.icon + ' ' + next.title)}</b> opens.</div>`
        : ''}
    </div>`;
}

/* 💡 The ideas: one door row each, in the order they open. A door opens the
   idea in the same sheet My money's doors use (`mnyOpenInfoSheet('idea')`,
   reading MNY_CONCEPTS — the one statement of each idea). A locked idea is
   still a door: its sheet says what opens it, which is the only useful thing
   a locked lesson has to offer. */
function mnyIdeasCard(kid) {
  const swap = mnyConceptSwap(kid);
  let locked = false;
  const rows = MNY_CONCEPTS.map(c => {
    const open = mnyIsOpen(kid, c.stage);
    if (!open) locked = true;
    return `<button type="button" class="mv2-li mv2-idea-row${open ? '' : ' dim'}" data-mny-action="idea" data-mny-concept="${escapeAttr(c.id)}">
        <span>${c.icon} <span class="mv2-idea-name">${escapeHtml(swap(c.title))}</span>${c.isNew ? ' <i class="mv2-newtag">new</i>' : ''}</span>
        <b>${open ? '' : '🔒 at ' + mnyStagePct(c.stage) + '% '}<span class="mv2-chev" aria-hidden="true">▸</span></b>
      </button>`;
  }).join('');
  return `<div class="mv2-card mv2-ideas">
      <div class="mv2-cardhead"><span class="mv2-title">💡 The ideas</span></div>
      <div class="mv2-line">Each one opens the same page as the ? on My money.</div>
      <div class="mv2-rows">${rows}</div>
      ${locked ? '<div class="mv2-idea-locknote">A locked idea still opens: it says what opens it and how much is left to pay.</div>' : ''}
    </div>`;
}

/* 🛒 What money buys. The list exists so a number can be weighed against
   something real — "$40" is a word, "a pizza night" is a quantity. */
function mnyBuysCard() {
  const items = mnyBuysItems();
  if (!items.length) return '';
  return `<div class="mv2-card mv2-buys">
      <div class="mv2-cardhead"><span class="mv2-title">🛒 What money buys</span></div>
      <div class="mv2-rows">${items.map(i =>
        `<div class="mv2-li"><span>${escapeHtml(i.label)}</span><b>${mnyMoney(i.amount)}</b></div>`).join('')}</div>
      <div class="mv2-note">Real prices, from things we actually buy.</div>
    </div>`;
}

/* The line the whole rulebook rests on: some things are paid for and most
   things are not, and knowing which is which is the point.

   "Just part of being here" is a lesson and stays as one. Its one line a rule
   decides — how many household chores a week are free — is written from the
   live rules. What PAYS is the live price list itself, behind the door
   "💷 What things pay ▸" — the same sheet My money's week sheet opens. */
function mnyWorkListsCard() {
  const free = Math.max(0, Math.round(Number((mrRules().chores || {}).freeChoresPerWeek) || 0));
  const words = ['', 'first', 'first two', 'first three', 'first four', 'first five', 'first six', 'first seven'];
  const freeLine = free > 0
    ? `The ${words[free] || 'first ' + free} household chore${free === 1 ? '' : 's'} each week`
    : '';
  const lines = MNY_UNPAID.concat(freeLine ? [freeLine] : []);
  return `<div class="mv2-card mv2-unpaid">
      <div class="mv2-cardhead"><span class="mv2-title">🏡 Just part of being here</span></div>
      <div class="mv2-rows">${lines.map(t => `<div class="mv2-li"><span>${escapeHtml(t)}</span></div>`).join('')}</div>
      <div class="mv2-note">Nobody gets paid for these. They are what living in a family looks like.</div>
      ${mnyDoor('prices-sheet', '💷 What things pay')}
    </div>`;
}
