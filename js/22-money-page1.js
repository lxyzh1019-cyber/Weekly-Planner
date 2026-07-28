// Weekly-Planner — 💰 My money: the one money page that belongs to the kid.
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   PAGE 1 · MY MONEY

   Every other money screen in this app is something that happens TO her — a
   grading, a meeting, a rule. This one is hers, and it is the only one she can
   open any day of the week without a grown-up.

   It answers four questions, in the order a nine-year-old actually asks them:

     What can I still earn today?
     How much do I have altogether?
     Where did this week's money come from?
     How much of my loan is left?

   Nothing here is editable. That is the point: a page you cannot break is a
   page you will open. Everything that changes a number lives on the meeting
   pages or the parent portal.

   The composition bar REPLACES the old earned-this-week total rather than
   joining it. Adding a chart beside a number would have made this the densest
   screen in the app; the bar says everything the number said and also says
   where it came from.
   ════════════════════════════════════════════════════════════════ */

let mnyKid = 'jess';          // which kid a parent is looking at
let mnyCalMonth = null;       // 'YYYY-MM' for the competition calendar
let mnyOpenPrices = {};       // which "what things pay" cards are expanded
let mnyStoryMode = 'week';    // the money story: 'week' | 'month'
let mnyStoryMonth = null;     // 'YYYY-MM'

/* Kids see their own money. A parent sees whichever kid is selected. */
function mnyViewKid() {
  if (isParent()) return (mnyKid === 'jenn' || mnyKid === 'jess') ? mnyKid : 'jess';
  const p = activeProfile();
  return (p === 'jenn' || p === 'jess') ? p : 'jess';
}
function mnyKidName(kid) { return kid === 'jenn' ? 'Jenn' : 'Jess'; }

function mnyOpenMyMoney(kid) {
  ctPrepareRead();
  if (isParent() && (kid === 'jenn' || kid === 'jess')) mnyKid = kid;
  showScreen('mymoney');
  mnyRenderMyMoney();
}
function mnySetKid(kid) { mnyKid = kid; mnyRerenderMoney(); }

/* One place for "something moved, redraw whatever money screen is open". Every
   transaction helper calls this rather than naming a screen it may not be on. */
function mnyRerenderMoney() {
  if (document.getElementById('screen-mymoney') &&
      document.getElementById('screen-mymoney').classList.contains('active')) mnyRenderMyMoney();
  if (document.getElementById('screen-moneystory') &&
      document.getElementById('screen-moneystory').classList.contains('active')) mnyRenderStory();
  if (document.getElementById('screen-moneyschool') &&
      document.getElementById('screen-moneyschool').classList.contains('active') &&
      typeof mnyRenderSchool === 'function') mnyRenderSchool();
}

/* ── The stacked bar ──
   One row of coloured segments, a legend under it with the dollars spelled
   out, and fines on their own red line below. A bar cannot go backwards, so a
   fine is never a negative segment — pretending otherwise is how a chart
   starts lying to a child about what happened. */
function mnyBarHtml(data, opts) {
  const o = opts || {};
  if (!data.segs.length) {
    return `<div class="mny-bar-empty">${escapeHtml(o.empty || 'Nothing yet this week')}</div>`;
  }
  const bar = data.segs.map(s =>
    `<div class="mny-seg" style="width:${s.w};background:${s.color}" title="${escapeAttr(s.label + ' ' + mnyMoney(s.value))}"></div>`).join('');
  const legend = data.segs.map(s =>
    `<span class="mny-key"><i style="background:${s.color}"></i>${escapeHtml(s.label)} <b>${mnyMoney(s.value)}</b></span>`).join('');
  const fines = (data.fines > 0)
    ? `<div class="mny-fineline">⚖️ Taken off: −${mnyMoney(data.fines).slice(1)}</div>` : '';
  return `<div class="mny-bar" role="img" aria-label="${escapeAttr(data.segs.map(s => s.label + ' ' + mnyMoney(s.value)).join(', '))}">${bar}</div>
    <div class="mny-legend">${legend}</div>${fines}`;
}

/* A `?` that opens the idea behind whatever it sits beside. */
function mnyAskBtn(conceptId) {
  return `<button type="button" class="mny-ask" data-mny-action="ask" data-mny-concept="${escapeAttr(conceptId)}" aria-label="What does this mean?">?</button>`;
}

/* ════════════════════════════════════════════════════════════════
   THE PAGE
   ════════════════════════════════════════════════════════════════ */
function mnyRenderMyMoney() {
  const wrap = document.getElementById('mnyPage1Wrap');
  if (!wrap) return;
  const kid = mnyViewKid();
  const wk = mnyWeekKey();

  const badge = document.getElementById('mnyProfileBadge');
  if (badge) badge.textContent = `${CT_PROFILE_ICON[kid] || ''} ${mnyKidName(kid)}`;
  const switcher = document.getElementById('mnyKidSwitch');
  if (switcher) {
    switcher.hidden = !isParent();
    switcher.innerHTML = ['jenn', 'jess'].map(k =>
      `<button type="button" class="mny-chip ${k === kid ? 'on' : ''}" data-mny-action="kid" data-mny-kid="${k}">${CT_PROFILE_ICON[k]} ${mnyKidName(k)}</button>`).join('');
  }

  wrap.innerHTML =
      `<div class="mny-cols">
         <div class="mny-col">
           ${mnyTodayCard(kid, wk)}
           ${mnyWalletCard(kid)}
           ${mnyIncomeCard(kid, wk)}
           ${mnyGoalCard(kid)}
         </div>
         <div class="mny-col">
           ${mnyDebtCards(kid)}
           ${mnyCompetitionCard(kid)}
         </div>
         <div class="mny-col">
           ${mnyLinksCard(kid)}
           ${mnyPricesCard(wk)}
         </div>
       </div>`;
  if (typeof enhanceNonButtonClickables === 'function') enhanceNonButtonClickables(wrap);
}

/* What is still on the table today. The daily cap is a real number to a kid —
   "I can still earn $2.00" is a reason to go and do the bins. */
function mnyTodayCard(kid, wk) {
  const r = mrRulesForWeek(wk);
  const cap = (r.chores || {}).dailyCap;
  const chores = mrChoreWeek(wk, kid);
  const today = formatDayKey(todayKey());
  const dayIdx = Math.max(0, Math.min(6, Math.round((today - formatDayKey(wk)) / (24 * 60 * 60 * 1000))));
  const done = money2((chores.days[dayIdx] || {}).paid);
  const left = (cap == null) ? null : money2(Math.max(0, cap - done));
  const free = chores.freeLeft;

  const line = (left == null)
    ? `You have earned ${mnyMoney(done)} today.`
    : (left > 0
        ? `You can still earn <b>${mnyMoney(left)}</b> today.`
        : `That is everything for today — ${mnyMoney(done)}. Extra jobs now earn <b>XP</b>.`);

  return `<div class="mny-card mny-today">
      <div class="mny-label">Today</div>
      <div class="mny-today-big">${line}</div>
      <div class="mny-note">${free > 0
        ? `${free} of your free jobs still to use this week. They are always your lowest-paying ones, so doing your best work first never costs you.`
        : `Your free jobs for this week are used up — everything else pays.`}</div>
    </div>`;
}

/* Everything she has, and the four places it can be. */
function mnyWalletCard(kid) {
  const tiles = [
    { k: 'cash',  icon: '💵', label: 'Cash',        value: mnyCash(kid),          ask: 'cash' },
    { k: 'save',  icon: '🏦', label: 'Kept ready',  value: mnySavedTotal(kid),    ask: 'ready' },
    { k: 'gic',   icon: '🔒', label: 'Locked away', value: mnyLockedTotal(kid),   ask: 'gic' },
    { k: 'stock', icon: '📈', label: 'In companies', value: mnyInvestedTotal(kid), ask: 'stock' },
  ];
  return `<div class="mny-card">
      <div class="mny-label">Everything I have</div>
      <div class="mny-total">${mnyMoney(mnyEverything(kid))}</div>
      <div class="mny-tiles">
        ${tiles.map(t => `<div class="mny-tile">
            <div class="mny-tile-top">${t.icon} ${escapeHtml(t.label)} ${mnyAskBtn(t.ask)}</div>
            <div class="mny-tile-val">${mnyMoney(t.value)}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

/* Where this week's money came from. The headline is the bar's own total, so
   the number and the picture can never tell two different stories. */
function mnyIncomeCard(kid, wk) {
  const data = mnyIncomeSegments(wk, kid);
  const made = mnyReturns(kid).gain;
  return `<div class="mny-card">
      <div class="mny-label">Money that came in this week</div>
      <div class="mny-total sm">${mnyMoney(data.total)}</div>
      ${mnyBarHtml(data, { empty: 'Nothing yet — the week has just started' })}
      ${made > 0
        ? `<div class="mny-note">Separately, what you already own has made <b>${mnyMoney(made)}</b> since you got it — without you doing anything. ${mnyAskBtn('save')}</div>`
        : ''}
    </div>`;
}

/* The year. A target only means something next to how the year is actually
   going, so the pace line is not optional. */
function mnyGoalCard(kid) {
  const ytd = mrYearToDate(kid);
  const target = mrTargetFor(kid);
  if (!target) return '';
  const pct = Math.max(0, Math.min(100, Math.round((ytd.paidTotal / target) * 100)));
  const projected = money2(ytd.projected);
  // A pace needs weeks behind it. Projecting "$0.00 for the year" off a kid who
  // simply has not had her first Sunday yet is not encouragement, it is a lie.
  const pace = !(ytd.paidTotal > 0)
    ? `Your first settled Sunday starts this off.`
    : (projected >= target
        ? `At this rate you finish the year around <b>${mnyMoney(projected)}</b> — ahead of your goal.`
        : `At this rate you finish the year around <b>${mnyMoney(projected)}</b>. Your goal is ${mnyMoney(target)}.`);
  return `<div class="mny-card">
      <div class="mny-label">My year</div>
      <div class="mny-goal-row"><b>${mnyMoney(ytd.paidTotal)}</b> of ${mnyMoney(target)}</div>
      <div class="mny-progress"><div class="mny-progress-fill" style="width:${pct}%"></div></div>
      <div class="mny-note">${pace}</div>
    </div>`;
}

/* One card per debt. The name and the icon are data a parent typed — every
   string that shows them interpolates, so nothing here says "ski". */
function mnyDebtCards(kid) {
  const debts = mnyDebts(kid);
  if (!debts.length) return '';
  return debts.map(d => {
    const owing = loanBalance(kid, d.id);
    const principal = money2(d.principal);
    const pct = principal > 0 ? Math.max(0, Math.min(100, Math.round((money2(d.paid) / principal) * 100))) : 0;
    const pace = loanPacing(kid, d.id);
    const free = loanFreeDate(kid, d.id, 0);
    const bonus = mnyBonusEarned(kid, d.id);
    const cleared = owing <= 0;
    return `<div class="mny-card mny-debt">
        <div class="mny-debt-top">
          <span class="mny-debt-name">${escapeHtml(d.icon)} ${escapeHtml(d.name)}</span>
          ${mnyAskBtn('debt')}
        </div>
        ${cleared
          ? `<div class="mny-today-big">Paid off. All of it. 🎉</div>`
          : `<div class="mny-progress"><div class="mny-progress-fill green" style="width:${pct}%"></div></div>
             <div class="mny-goal-row">${pct}% paid off · <b>${mnyMoney(owing)}</b> still to go</div>
             <div class="mny-rows">
               <div class="mny-row"><span>Each month</span><b>${mnyMoney(d.monthly)}</b></div>
               <div class="mny-row"><span>Paid off by</span><b>${free.date ? mnyShortDate(free.date) : '—'}</b></div>
               ${bonus > 0 ? `<div class="mny-row"><span>Extra I earned by paying early</span><b>${mnyMoney(bonus)}</b></div>` : ''}
               ${d.arrearsInterest > 0 ? `<div class="mny-row warn"><span>Costs added for paying late</span><b>${mnyMoney(d.arrearsInterest)}</b></div>` : ''}
             </div>
             ${pace ? `<div class="mny-note">${pace.status === 'on-pace'
               ? 'You are on track.'
               : `You are ${mnyMoney(pace.behindBy)} behind where the plan says you should be.`}</div>` : ''}`}
      </div>`;
  }).join('');
}

/* Competition days, as a month she can actually point at. */
function mnyCompetitionCard(kid) {
  const month = mnyCalMonth || String(todayKey()).slice(0, 7);
  const entries = mrCompetitions(kid).filter(c => String(c.dayKey || '').slice(0, 7) === month);
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7;            // Monday-first, like the planner
  const byDay = {};
  entries.forEach(c => { byDay[Number(String(c.dayKey).slice(8, 10))] = c; });
  const total = money2(entries.reduce((s, c) => s + money2(c.awarded), 0));

  let cells = '';
  for (let i = 0; i < lead; i++) cells += `<span class="mny-cal-cell blank"></span>`;
  for (let d = 1; d <= days; d++) {
    const c = byDay[d];
    cells += `<span class="mny-cal-cell${c ? ' has' : ''}${todayKey() === month + '-' + String(d).padStart(2, '0') ? ' today' : ''}">
        ${c ? `<span class="mny-cal-icon">${escapeHtml(mnySportIcon(c.sport))}</span>` : d}
      </span>`;
  }
  const label = ['January','February','March','April','May','June','July','August','September','October','November','December'][m - 1] + ' ' + y;

  return `<div class="mny-card mny-comp">
      <div class="mny-month-nav">
        <button type="button" class="mny-step" data-mny-action="cal" data-mny-dir="-1" aria-label="Previous month">‹</button>
        <span class="mny-label">🏆 ${escapeHtml(label)}</span>
        <button type="button" class="mny-step" data-mny-action="cal" data-mny-dir="1" aria-label="Next month">›</button>
      </div>
      <div class="mny-dow">${['M','T','W','T','F','S','S'].map(d => `<span>${d}</span>`).join('')}</div>
      <div class="mny-cal">${cells}</div>
      ${entries.length
        ? `<div class="mny-rows">${entries.sort((a, b) => a.dayKey < b.dayKey ? -1 : 1).map(c =>
             `<div class="mny-row"><span>${mnySportIcon(c.sport)} ${escapeHtml(c.name || mnySportLabel(c.sport))} · ${mnyShortDate(c.dayKey)}</span><b>${mnyMoney(c.awarded)}</b></div>`).join('')}</div>
           <div class="mny-row total"><span>This month</span><b>${mnyMoney(total)}</b></div>`
        : `<div class="mny-note">No competition days this month.</div>`}
      <div class="mny-note">We never talk about money before or during a competition. That is a promise, not a rule.</div>
    </div>`;
}
function mnySportIcon(s) { return { swim: '🏊', skate: '⛸️', dance: '💃' }[s] || '🏆'; }
function mnySportLabel(s) { return { swim: 'Swim meet', skate: 'Skating', dance: 'Dance test' }[s] || 'Competition'; }

/* The two ways out of this page. */
function mnyLinksCard(kid) {
  const stage = mnyStage(kid);
  return `<div class="mny-card">
      <div class="mny-label">More</div>
      <button type="button" class="mny-btn wide" data-mny-action="story">📖 My money story</button>
      <button type="button" class="mny-btn wide" data-mny-action="school">🎓 Money school</button>
      <div class="mny-note">You are on <b>${escapeHtml(stage.icon + ' ' + stage.title)}</b>. The next lesson opens as your loan comes down.</div>
    </div>`;
}

/* What everything pays, straight from the rules — so a price a parent changed
   this morning is right here this afternoon. Collapsed by default: this is
   reference, not news. */
function mnyPricesCard(wk) {
  /* TODAY's prices, not the week's. This is the list she checks before deciding
     whether to go and do the bins — it has to answer "what will I get for this
     if I do it now". The week's earnings are still computed against the rules
     that were live when each day happened (mrRulesForWeek), so a price raised
     mid-week shows up here immediately without restating what she already
     earned; the note says so when the two differ. */
  const r = mrRules();
  const weekRules = mrRulesForWeek(wk);
  const changedMidWeek = JSON.stringify(r) !== JSON.stringify(weekRules);
  const open = !!mnyOpenPrices.all;
  return `<div class="mny-card">
      <button type="button" class="mny-acc" data-mny-action="prices" aria-expanded="${open}">
        <span class="mny-label">💷 What things pay</span><span>${open ? 'Hide ▾' : 'Show ▸'}</span>
      </button>
      ${open ? `${changedMidWeek
          ? `<div class="mny-note">Something changed price this week. These are the new prices, from now on — what you already did this week still pays what it was worth then.</div>` : ''}
        <div class="mny-prices">${pmPriceCards(r, false)}</div>` : ''}
    </div>`;
}

/* ════════════════════════════════════════════════════════════════
   MY MONEY STORY

   Every week that was settled, as far back as it goes. A second screen rather
   than a section on page 1: the history is the densest thing in the system and
   page 1 has to stay a page she opens without being asked.
   ════════════════════════════════════════════════════════════════ */
function mnyOpenStory() { showScreen('moneystory'); mnyRenderStory(); }

function mnyLedgerRows(kid) {
  ctEnsureShared();
  const led = state.shared.chore.moneyLedger || {};
  return Object.keys(led).filter(wk => led[wk] && led[wk][kid])
    .sort().reverse()
    .map(wk => Object.assign({ weekKey: wk }, led[wk][kid]));
}

function mnyRenderStory() {
  const wrap = document.getElementById('mnyStoryWrap');
  if (!wrap) return;
  const kid = mnyViewKid();
  const all = mnyLedgerRows(kid);

  if (!all.length) {
    wrap.innerHTML = `<div class="mny-card"><div class="mny-label">📖 My money story</div>
      <div class="mny-note">Nothing here yet. Every Sunday you settle a week, it gets written down here — what came in, where it went, and how much of your loan was left.</div></div>`;
    return;
  }

  const months = Array.from(new Set(all.map(r => r.weekKey.slice(0, 7)))).sort().reverse();
  if (!mnyStoryMonth || months.indexOf(mnyStoryMonth) < 0) mnyStoryMonth = months[0];
  const rows = (mnyStoryMode === 'month')
    ? all.filter(r => r.weekKey.slice(0, 7) === mnyStoryMonth)
    : all.slice(0, 12);

  const modeBtns = [['week', 'By week'], ['month', 'By month']].map(([id, label]) =>
    `<button type="button" class="mny-chip ${mnyStoryMode === id ? 'on' : ''}" data-mny-action="storymode" data-mny-mode="${id}">${label}</button>`).join('');
  const monthNav = (mnyStoryMode === 'month')
    ? `<div class="mny-month-nav">
         <button type="button" class="mny-step" data-mny-action="storymonth" data-mny-dir="-1" aria-label="Earlier">‹</button>
         <span class="mny-label">${escapeHtml(mnyStoryMonthLabel(mnyStoryMonth))}</span>
         <button type="button" class="mny-step" data-mny-action="storymonth" data-mny-dir="1" aria-label="Later">›</button>
       </div>` : '';

  // Totals for whatever period is showing, so the header is never just decoration.
  const sum = (f) => money2(rows.reduce((s, r) => s + money2(r[f]), 0));
  const inTotal = money2(sum('chores') + sum('learning') + sum('streak') + sum('competition'));

  wrap.innerHTML =
      `<div class="mny-card">
         <div class="mny-label">📖 My money story</div>
         <div class="mny-chiprow">${modeBtns}</div>
         ${monthNav}
         <div class="mny-rows">
           <div class="mny-row"><span>Money that came in</span><b>${mnyMoney(inTotal)}</b></div>
           <div class="mny-row"><span>Taken off</span><b>−${mnyMoney(sum('fines')).slice(1)}</b></div>
           <div class="mny-row total"><span>Kept</span><b>${mnyMoney(sum('net'))}</b></div>
         </div>
       </div>
       ${rows.map(r => mnyStoryWeek(kid, r)).join('')}`;
  if (typeof enhanceNonButtonClickables === 'function') enhanceNonButtonClickables(wrap);
}
function mnyStoryMonthLabel(m) {
  const [y, mm] = String(m).split('-').map(Number);
  return ['January','February','March','April','May','June','July','August','September','October','November','December'][mm - 1] + ' ' + y;
}

/* One settled week: what came in, where it went, and what was still owed at
   the end of it. Both bars use the frozen ledger, never a recomputation — the
   history has to be a record of what happened, not what today's rules would
   have paid. */
function mnyStoryWeek(kid, r) {
  const inBar = mnySegments([
    { label: 'Jobs',         value: r.chores,      color: '#95d5b2' },
    { label: 'Learning',     value: r.learning,    color: '#6fb1fc' },
    { label: 'Clean days',   value: r.streak,      color: '#ffd166' },
    { label: 'Competitions', value: r.competition, color: '#ff9eb5' },
    { label: 'From outside', value: r.outside,     color: '#c9a6e8' },
  ]);
  inBar.fines = money2(r.fines);
  const plan = r.plan || {};
  const outBar = mnySegments([
    { label: 'Loan payment', value: (r.loan || {}).paid, color: '#b8b0a2' },
    { label: 'Paid off early', value: r.debtExtra,       color: '#95d5b2' },
    { label: 'Kept ready',   value: r.ready,             color: '#ffd166' },
    { label: 'Locked away',  value: r.gic,               color: '#6fb1fc' },
    { label: 'Into companies', value: r.stock,           color: '#c9a6e8' },
  ]);
  const edited = (r.edited || []).length;
  return `<div class="mny-card">
      <div class="mny-week-head">
        <span class="mny-label">Week of ${escapeHtml(mnyShortDate(r.weekKey))}</span>
        <b>${mnyMoney(r.net)}</b>
      </div>
      ${r.confirmedBy ? `<div class="mny-note">Agreed with ${escapeHtml(r.confirmedBy)}${plan.label ? ' · ' + escapeHtml(plan.label) : ''}</div>` : ''}
      ${edited ? `<div class="mny-note">${edited} thing${edited > 1 ? 's were' : ' was'} changed at the meeting${r.editReason ? ' — ' + escapeHtml(mnyReasonLabel(r.editReason)) : ''}.</div>` : ''}
      <div class="mny-sub">Came in</div>
      ${mnyBarHtml(inBar, { empty: 'Nothing came in' })}
      ${outBar.segs.length ? `<div class="mny-sub">Went out</div>${mnyBarHtml(outBar, {})}` : ''}
      ${r.debtBalanceAfter != null
        ? `<div class="mny-row"><span>Still owing at the end of the week</span><b>${mnyMoney(r.debtBalanceAfter)}</b></div>` : ''}
      ${r.xp ? `<div class="mny-note">+${r.xp} XP</div>` : ''}
    </div>`;
}

/* ════════════════════════════════════════════════════════════════
   CLICKS

   One delegated handler per screen, because innerHTML wipes listeners. Nothing
   user-entered is interpolated into an inline handler — actions ride on data
   attributes and are looked up here.
   ════════════════════════════════════════════════════════════════ */
function mnyHandleClick(ev) {
  const el = ev.target.closest('[data-mny-action]');
  if (!el) return;
  const a = el.getAttribute('data-mny-action');

  if (a === 'kid')    { mnySetKid(el.getAttribute('data-mny-kid')); return; }
  if (a === 'story')  { mnyOpenStory(); return; }
  if (a === 'school') { if (typeof mnyOpenSchool === 'function') mnyOpenSchool(mnyViewKid()); return; }
  if (a === 'prices') {
    // From Money school this is a link to the price list rather than a toggle
    // on a card that is not on screen.
    if (!document.getElementById('screen-mymoney').classList.contains('active')) {
      mnyOpenPrices.all = true; mnyOpenMyMoney(mnyViewKid()); return;
    }
    mnyOpenPrices.all = !mnyOpenPrices.all; mnyRenderMyMoney(); return;
  }
  if (a === 'ask')     { mnyShowConcept(el.getAttribute('data-mny-concept')); return; }
  if (a === 'concept') { mnySchoolConcept = el.getAttribute('data-mny-concept'); mnyRenderSchool(); return; }
  if (a === 'cal') {
    const month = mnyCalMonth || String(todayKey()).slice(0, 7);
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + Number(el.getAttribute('data-mny-dir')), 1);
    mnyCalMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    mnyRenderMyMoney();
    return;
  }
  if (a === 'storymode')  { mnyStoryMode = el.getAttribute('data-mny-mode'); mnyRenderStory(); return; }
  if (a === 'storymonth') {
    const [y, m] = String(mnyStoryMonth).split('-').map(Number);
    const d = new Date(y, m - 1 + Number(el.getAttribute('data-mny-dir')), 1);
    mnyStoryMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    mnyRenderStory();
    return;
  }
}

/* The concept card. Locked ideas show what opens them rather than the body —
   a lesson arriving before the thing it explains is just noise. */
function mnyShowConcept(id) {
  const kid = mnyViewKid();
  const c = mnyConceptCard(id, kid);
  if (!c) return;
  const body = c.open
    ? `<p>${escapeHtml(c.what)}</p>
       <div class="mny-sub">${escapeHtml(c.whyLabel)}</div><p>${escapeHtml(c.why)}</p>
       <div class="mny-sub">${escapeHtml(c.riskLabel)}</div><p>${escapeHtml(c.risk)}</p>`
    : `<p>🔒 ${escapeHtml(mnyNeedLabel(c.need))}.</p>`;
  // Every `?` in the system can hand off to the page that teaches the idea
  // properly, so a question asked anywhere lands somewhere that answers it.
  showToastCard(`${c.icon} ${c.title}`, body, c.id);
}

/* A plain dismissible card. Uses the app's sheet chrome if it is available and
   falls back to a toast, so a `?` always answers something. */
function showToastCard(title, bodyHtml, conceptId) {
  const existing = document.getElementById('mnyConceptCard');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'mnyConceptCard';
  el.className = 'mny-concept-scrim';
  el.innerHTML = `<div class="mny-concept" role="dialog" aria-modal="true" aria-label="${escapeAttr(title)}">
      <div class="mny-concept-title">${escapeHtml(title)}</div>
      <div class="mny-concept-body">${bodyHtml}</div>
      ${conceptId ? `<button type="button" class="mny-btn wide" id="mnyConceptMore">🎓 Take me to Money school</button>` : ''}
      <button type="button" class="mny-btn wide" id="mnyConceptClose">Got it</button>
    </div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.addEventListener('click', e => { if (e.target === el) close(); });
  el.querySelector('#mnyConceptClose').addEventListener('click', close);
  const more = el.querySelector('#mnyConceptMore');
  if (more) more.addEventListener('click', () => {
    close();
    // The meeting runs in an overlay; leaving it open over the school page
    // would strand her behind a scrim she cannot see past.
    if (typeof closeSheet === 'function') closeSheet('familyMeetingOverlay');
    mnyOpenSchool(mnyViewKid(), conceptId);
  });
}
