// Weekly-Planner — 💰 My money: the one money page that belongs to the kid.
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   PAGE 1 · MY MONEY — My Money v2 (Sunday v15, Plan v5 §L)

   Every other money screen in this app is something that happens TO her — a
   grading, a meeting, a rule. This one is hers, and it is the only one she can
   open any day of the week without a grown-up.

   It is the owner's prototype (docs/handoff/sunday-v15/My Money v2 Screen),
   joined to what the app already had where the owner picked "merge" or "keep
   today's" (Plan v5 §L M1–M10):

     today's head and tab bar (M1) ·
     ☀️ how long until Sunday, seven day circles, what is still to come (M2) ·
     ⏳ what she asked Dad (the prototype's chips) ·
     🧱 the loan wall with today's key facts (M5) ·
     Everything I have — today's card, the handoff's names, each shut place
       saying when it opens (M3) ·
     🎯 a jar for every goal, with its date and what a week it takes (M4) ·
     the four "ask Dad" buttons ·
     This week — where this week's money is coming from (M7) · 🎁 Gifts (M9)
     — and, on the right, 📒 the passbook of the last four Sundays (M7),
     the month's calendar with 📅 Coming up under it (M6), and ⭐ stickers.

   Nothing here moves money. Every button opens a sheet that ASKS (js/45),
   and every '?' explains (M10). A grown-up looking at her page reads the same
   page; where a grown-up records directly (a result, a move, a gift) the
   button opens the Record sheet instead (js/41) — one writer, two doors.
   ════════════════════════════════════════════════════════════════ */

let mnyKid = 'jess';          // which kid a parent is looking at
let mnyCalMonth = null;       // 'YYYY-MM' for the competition calendar
/* Gifts: what came in, from whom, when. Collapsed by default and remembered
   per device — a list of past gifts is reference, not news (ARCHITECTURE.md:
   a disclosure toggle is the right shape for reference material).
   localStorage, never synced state: every state write is a full-document
   upload and this is a view preference. */
const MNY_GIFTS_LS_KEY = 'wp_mny_gifts_open';
function mnyGiftsOpen() { try { return localStorage.getItem(MNY_GIFTS_LS_KEY) === '1'; } catch (e) { return false; } }
function mnySetGiftsOpen(open) {
  try { localStorage.setItem(MNY_GIFTS_LS_KEY, open ? '1' : '0'); } catch (e) {}
}

/* The price list's remembered toggle — Money school's card (`mnyPricesCard`)
   still carries it. My money opens the same list in a sheet from the ☀️ card
   ("💷 what things pay ▸"). */
const MNY_PRICES_LS_KEY = 'wp_mny_prices_open';
function mnyPricesOpen() {
  try { return localStorage.getItem(MNY_PRICES_LS_KEY) === '1'; } catch (e) { return false; }
}
function mnySetPricesOpen(open) {
  try { localStorage.setItem(MNY_PRICES_LS_KEY, open ? '1' : '0'); } catch (e) {}
}

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

/* ── The walkthrough ──
   A card at a time, with a dot pager. Opened from the ? in a page header and
   never shown unasked: a tour that appears by itself is a thing to dismiss,
   not a thing to read. */
let mnyTourWho = null;      // 'kid' | 'parent' | null
let mnyTourStep = 0;
function mnyOpenTour(who) { mnyTourWho = who; mnyTourStep = 0; mnyDrawTour(); }
function mnyCloseTour() {
  mnyTourWho = null;
  const el = document.getElementById('mnyTour');
  if (el) el.remove();
}
function mnyTourGo(d) {
  const steps = MNY_TOURS[mnyTourWho] || [];
  const next = mnyTourStep + d;
  if (next < 0 || next >= steps.length) { mnyCloseTour(); return; }
  mnyTourStep = next;
  mnyDrawTour();
}
function mnyDrawTour() {
  const steps = MNY_TOURS[mnyTourWho] || [];
  const s = steps[mnyTourStep];
  if (!s) return mnyCloseTour();
  let el = document.getElementById('mnyTour');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mnyTour';
    el.className = 'mny-tour-scrim';
    document.body.appendChild(el);
    el.addEventListener('click', ev => {
      if (ev.target === el) { mnyCloseTour(); return; }
      const b = ev.target.closest('[data-tour]');
      if (!b) return;
      const a = b.getAttribute('data-tour');
      if (a === 'close') mnyCloseTour();
      else if (a === 'dot') { mnyTourStep = Number(b.getAttribute('data-i')); mnyDrawTour(); }
      else mnyTourGo(Number(a));
    });
  }
  el.innerHTML = `<div class="mny-tour" role="dialog" aria-modal="true" aria-label="${escapeAttr(s.title)}">
      <div class="mny-tour-where">${escapeHtml(s.where)}</div>
      <div class="mny-tour-title">${escapeHtml(s.icon + ' ' + s.title)}</div>
      <p>${escapeHtml(s.body)}</p>
      <div class="mny-tour-foot">
        <button type="button" class="mny-btn" data-tour="-1">${mnyTourStep ? '◀ Back' : 'Close'}</button>
        <div class="mny-dots">${steps.map((_, i) =>
          `<button type="button" class="mny-dot${i === mnyTourStep ? ' on' : ''}" data-tour="dot" data-i="${i}" aria-label="Step ${i + 1}"></button>`).join('')}</div>
        <button type="button" class="mny-btn primary" data-tour="1">${mnyTourStep === steps.length - 1 ? 'Done' : 'Next ▶'}</button>
      </div>
    </div>`;
}

/* ════════════════════════════════════════════════════════════════
   THE PAGE — the owner's approved mockup (Plan v9 §M 5b / §N, Stage 6d)
   On the iPad (1194 × 834) three columns, as drawn: looking back on the left
   (📒 passbook, the month's calendar with 📅 Coming up, ⭐ stickers), what she
   checks most in the middle (☀️ Sunday with its "This week" bar, 🧱 the loan
   wall, Everything I have, 🎯 goal jars) and everything about asking on the
   right (📮 the four buttons, ⌛ Asked parents, 🎁 Gifts). The head and the
   My money · Money school tabs share one row (§N "Header space"). Between
   768 and 1100px the middle and the right sit side by side with the left
   column under them; under 768px one column, middle first (Plan v3 D8).
   ════════════════════════════════════════════════════════════════ */
let mnyWeekBarOpen = false;   // ☀️ "▸ where it goes" (this device and session only)
let mnyLoanRowsOpen = false;  // 🧱 "📋 My N loans" — the rows instead of the wall
let mnyBookOpen = null;       // 📒 the Sunday whose split is unfolded
function mnyRenderMyMoney() {
  const wrap = document.getElementById('mnyPage1Wrap');
  if (!wrap) return;
  const kid = mnyViewKid();
  // Bring the world up to today before drawing it. The app can be shut for
  // three weeks; the interest still happened.
  mnySimCatchUp(kid);

  wrap.innerHTML =
      `${mnyPageHead('💰 My money', '', [
          { action: 'story',    label: '📖', aria: 'My money story' },
          { action: 'tourkid',  label: '?', aria: 'How this page works' },
        ], { kidSwitch: true, tabs: 'money', date: true })}
       <div class="mv2">
         <div class="mv2-main">
           ${mnyCountdownCard(kid)}
           <div class="mv2-pair">
             ${mnyLoanWallCard(kid)}
             ${mnyEverythingCard(kid)}
           </div>
           ${mnyGoalJarsCard(kid)}
         </div>
         <div class="mv2-ask">
           ${mnyAskCard(kid)}
           ${mnyGiftsCard(kid)}
         </div>
         <div class="mv2-side">
           ${mnyPassbookCard(kid)}
           ${mnyCalendarCard(kid)}
           ${mnyStickersCard(kid)}
         </div>
       </div>`;
  if (typeof enhanceNonButtonClickables === 'function') enhanceNonButtonClickables(wrap);
}

/* "Wed 7 Oct" — the day, in the head's right corner (the mockup's date). */
function mnyTodayLine() {
  return mnyDayName(todayKey());
}

/* Every money page wears the same head: a way back, the title, a line of
   context, and the buttons that belong to this page rather than to the system.
   It replaces the app's topbar on these screens rather than sitting under it.
   `opts.tabs` puts the page's tab bar into the same row and `opts.date` the
   day at its right (My money, §N "Header space": one row, the same buttons).
   A button with `aria` is an icon button (📖, ?) named for a screen reader. */
function mnyPageHead(title, strap, buttons, opts) {
  const o = opts || {};
  const kidSwitch = (o.kidSwitch && isParent())
    ? `<span class="mny-head-kids">${['jenn', 'jess'].map(k =>
        `<button type="button" class="mny-chip ${k === mnyViewKid() ? 'on' : ''}" data-mny-action="kid" data-mny-kid="${k}">${CT_PROFILE_ICON[k]} ${mnyKidName(k)}</button>`).join('')}</span>`
    : '';
  return `<div class="mny-head${o.tabs ? ' mny-head--one' : ''}">
      ${o.back === false ? '' : `<button type="button" class="mny-back" data-mny-action="${escapeAttr(o.back || 'backplanner')}" aria-label="Back">◀</button>`}
      <h2 class="mny-head-title">${escapeHtml(title)}</h2>
      ${strap ? `<span class="mny-head-strap">${escapeHtml(strap)}</span>` : ''}
      ${o.tabs ? mnyTabBar(o.tabs, { compact: true }) : ''}
      ${kidSwitch}
      ${o.date ? `<span class="mny-head-date">${escapeHtml(mnyTodayLine())}</span>` : ''}
      <span class="mny-head-btns">${(buttons || []).map(b =>
        `<button type="button" class="mny-btn${b.aria ? ' mny-btn--icon' : ''}" data-mny-action="${escapeAttr(b.action)}"${b.aria ? ` aria-label="${escapeAttr(b.aria)}" title="${escapeAttr(b.aria)}"` : ''}>${escapeHtml(b.label)}</button>`).join('')}</span>
    </div>`;
}

/* "$3" for whole dollars, "$2.50" otherwise — the prototype's money on a
   small label. */
function mnyShort$(v) { const n = money2(v); return (n < 0 ? '−$' : '$') + (Math.abs(n) % 1 ? Math.abs(n).toFixed(2) : String(Math.abs(n))); }
/* The passbook's figures: "$140" from $100 up, "$16.15" below (prototype `mk`). */
function mnyBook$(v) { const n = money2(v); return n >= 100 ? '$' + Math.round(n) : mnyMoney(n); }
/* "27 Sep" — how the passbook and Coming up name a day. */
function mnyDayMonth(dayKey) {
  const d = formatDayKey(dayKey);
  return d.getDate() + ' ' + MONTH_SHORT[d.getMonth()];
}
/* "Sat 24 Oct" */
function mnyDayLabel(dayKey) {
  return formatDayKey(dayKey).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

/* ── ☀️ HOW LONG UNTIL SUNDAY (M2) ──
   The prototype's card: the days to Sunday, and one circle a day — what the
   chores earned that day (the real grades, `mrChoreWeek`), ✓ for a full day,
   ½ for part of one, · for nothing; days still ahead dashed and empty. The
   line under it: about what the chores have come to so far, and how many
   days of routine are kept (`mrStreakWeek`, where an unfinished day is never
   the forgiving one — Plan v5 Deviation 32). Below, section K's dashed line
   for weeks not settled yet, and the price list one tap away. */
function mnyCountdownData(kid) {
  /* The money week (Deviation 34): today's, or — on a meeting Sunday under
     the Sun–Sat rule, before her meeting — the week that meeting pays, all
     of it finished. Under Mon–Sun this is the planner week, as before. */
  const today = String(todayKey());
  const meetingWk = ctThisWeekKey();
  let wk = mrMoneyWeekOf(today, kid);
  if (wk !== meetingWk && mrMoneyWeekIsSunday(meetingWk) && !mnyWeekSettled(meetingWk, kid)) wk = meetingWk;
  const sunday = mrDayKeyAdd(wk, 6);                       // the meeting that pays it
  const toSun = Math.max(0, Math.round((formatDayKey(sunday) - formatDayKey(today)) / 864e5));
  const chores = mrChoreWeek(wk, kid);
  const keys = chores.days.map(x => x.dayKey);
  const dow = Math.max(0, keys.filter(k => k <= today).length - 1);
  const cap = money2((mrRulesForWeek(wk).chores || {}).dailyCap);
  let soFar = 0;
  const days = chores.days.map(x => {
    const k = x.dayKey;
    const past = k <= today;
    const paid = money2(x.paid);
    if (past) soFar = money2(soFar + paid);
    return {
      d: 'SMTWTFS'[formatDayKey(k).getDay()], dayKey: k, past, paid,
      mark: !past ? '' : (cap > 0 && paid >= cap ? '✓' : paid > 0 ? '½' : '·'),
      chore: !past ? '' : (paid > 0 ? mnyShort$(paid) : '—'),
    };
  });
  return {
    wk, dow, toSun, days, soFar,
    routineDays: (mrStreakWeek(wk, kid) || {}).days || 0,
    label: toSun === 0 ? 'Sunday is today!' : `Sunday in ${toSun} day${toSun === 1 ? '' : 's'}`,
    unpaid: mnyUnpaidRows(kid),
  };
}

/* "This week so far" — the mockup's bar inside the countdown (§N: the "This
   week" card becomes a bar; tap "where it goes" for the details). Read from
   `mnyIncomeSegments`, the one answer to where this week's money is coming
   from, in the short names (🏠 Home = chores, learning and the routine). The
   projection "about $X by Sunday if the rest goes well" adds, to what is in
   so far, a full day of chores for each day still ahead, each club session
   still to come and the routine's top tier while it can still be reached. */
function mnyWeekSoFar(kid, c) {
  const wk = mnyWeekKey();
  const data = mnyIncomeSegments(wk, kid);
  const val = (label) => money2(((data.segs || []).find(s => s.label === label) || {}).value);
  const parts = [
    { k: 'home', icon: '🏠', label: 'Home', v: money2(val('Jobs') + val('Learning') + val('Routines kept')) },
    { k: 'club', icon: '⛸️', label: 'Club job', v: val('My club job') },
    { k: 'prize', icon: '🏆', label: 'Prizes', v: val('Competitions') },
    { k: 'given', icon: '🎁', label: 'Given', v: val('From outside') },
    { k: 'made', icon: '🌱', label: 'Made', v: val('Made on its own') },
  ].filter(p => p.v > 0);
  const soFar = money2(parts.reduce((a, p) => a + p.v, 0) - (data.fines || 0));
  const R = mrRulesForWeek(c.wk);
  const cap = money2((R.chores || {}).dailyCap);
  const today = String(todayKey());
  const ahead = c.days.filter(d => !d.past).length;
  const rate = money2(Number(mrRuleOr(R, 'sessions.perSession')) || 0);
  const sessionsAhead = ((mrSessionsWeek(c.wk, kid) || {}).sessions || []).filter(s => String(s.dayKey) > today).length;
  const tiers = (((R.streak || {}).tiers) || []).slice().sort((a, b) => a.days - b.days);
  const top = tiers[tiers.length - 1];
  const streakNow = val('Routines kept');
  const canStreak = top && (c.routineDays + ahead) >= Number(top.days) - (Number(((R.streak || {}).graceDays)) || 0);
  const more = money2(ahead * cap + sessionsAhead * rate + (canStreak ? Math.max(0, money2(top.bonus) - streakNow) : 0));
  return { data, parts, soFar, bySunday: money2(soFar + more) };
}
function mnyCountdownCard(kid) {
  const c = mnyCountdownData(kid);
  const unpaidTotal = money2(c.unpaid.reduce((a, r) => a + r.amount, 0));
  const w = mnyWeekSoFar(kid, c);
  const total = money2(w.parts.reduce((a, p) => a + p.v, 0));
  const open = mnyWeekBarOpen;
  const bar = total > 0
    ? `<span class="mv2-weekbar" role="img" aria-label="${escapeAttr(w.parts.map(p => p.label + ' ' + mnyMoney(p.v)).join(', '))}">${w.parts.map(p =>
        `<i class="mv2-weekbar--${p.k}" style="flex:${p.v} 0 0"></i>`).join('')}</span>`
    : `<span class="mv2-weekbar mv2-weekbar--empty"></span>`;
  return `<div class="mv2-card mv2-sun">
      <div class="mv2-sun-top">
        <div class="mv2-sun-head">
          <span class="mv2-sun-title">☀️ ${escapeHtml(c.label)}</span>
          <span class="mv2-sun-sub">payday guessing game · ${escapeHtml(mnyDayName(mrDayKeyAdd(c.wk, 6)))}</span>
        </div>
        <div class="mv2-days" role="list">${c.days.map(d => `<div class="mv2-day${d.past ? '' : ' ahead'}${d.dayKey === String(todayKey()) ? ' today' : ''}" role="listitem" aria-label="${escapeAttr(d.dayKey + (d.past ? ' · chores ' + (d.paid > 0 ? mnyMoney(d.paid) : 'nothing') : ' · still ahead'))}">
            <span>${d.d}</span><span class="mv2-dot${d.past ? (d.paid > 0 ? ' paid' : ' none') : ''}">${d.mark}</span><span>${escapeHtml(d.chore)}</span>
          </div>`).join('')}</div>
      </div>
      <div class="mv2-sun-weekline">
        <span class="mv2-sun-sofar"><b>This week so far ${escapeHtml(mnyMoney(w.soFar))}</b>${w.parts.map(p => ` · ${p.icon} ${escapeHtml(p.label)} ${escapeHtml(mnyShort$(p.v))}`).join('')}${c.routineDays ? ` · 🔥 ${c.routineDays} routine day${c.routineDays === 1 ? '' : 's'} kept` : ''}</span>
        <button type="button" class="mv2-link mv2-whereto" data-mny-action="weekbar" aria-expanded="${open}">${open ? '▾ hide' : '▸ where it goes'}</button>
      </div>
      ${bar}
      ${open ? `<div class="mv2-weekmore">
          ${mnyBarHtml(w.data, { empty: 'Nothing yet — the week has just started' })}
          ${w.data.passive > 0
            ? `<div class="mny-note">${mnyMoney(w.data.passive)} of that my money made by itself. It is not cash yet. ${mnyAskBtn('save')}</div>`
            : (w.data.passive < 0
              ? `<div class="mny-note warn">My companies are worth ${mnyMoney(-w.data.passive)} less than last Sunday. That happens — it can go back up. ${mnyAskBtn('stock')}</div>`
              : '')}
          ${mnyStrip(mnyWeekKey(), kid, -1)}
        </div>` : ''}
      <div class="mv2-sun-foot">
        <span class="mv2-guessby"><b>about ${escapeHtml(mnyShort$(w.bySunday))} by Sunday</b> if the rest goes well</span>
        ${c.unpaid.length ? `<span class="mv2-still" title="${escapeAttr(c.unpaid.length + ' week' + (c.unpaid.length === 1 ? '' : 's') + ' not settled yet')}">${escapeHtml(mnyMoney(unpaidTotal))} still to come · ${c.unpaid.length} week${c.unpaid.length === 1 ? '' : 's'} not settled yet</span>` : ''}
        <button type="button" class="mv2-link" data-mny-action="prices-sheet">💷 what things pay ▸</button>
      </div>
    </div>`;
}

/* ── What "still to come" actually means, in one place ──
   Every uncredited week from the last eight, read from the same two sources
   the meeting does — `ctWeekMoney` for what a week comes to, `finalizedWeeks`
   for what has been credited — and moving nothing itself. The week running
   now is not waiting for anything (it is still being earned; the ☀️ circles
   own it), so it counts only once a grown-up has agreed it. */
function mnyUnpaidWeeks(kid, max) {
  ctEnsureShared();
  const c = state.shared.chore;
  const fin = c.finalizedWeeks || {};
  const out = [];
  for (let i = 0; i <= (max || 8); i++) {
    const mon = formatDayKey(ctThisWeekKey()); mon.setDate(mon.getDate() - i * 7);
    const wk = ctDateToKey(mon);
    if (String(wk) < String(mrStartWeek())) break;
    if ((fin[wk] || {})[kid] != null) continue;          // already credited
    const amount = money2(ctWeekMoney(wk, kid));
    if (amount <= 0) continue;
    out.push({ wk, amount, agreed: mnyIsConfirmed(wk, kid), weeksAgo: i });
  }
  return out;
}
function mnyUnpaidRows(kid) {
  return mnyUnpaidWeeks(kid, 8).filter(r => r.weeksAgo > 0 || r.agreed);
}
function mnyUnpaidTotal(kid) {
  return money2(mnyUnpaidRows(kid).reduce((a, r) => a + r.amount, 0));
}

/* ── 📮 ASK PARENTS: the four buttons and ⌛ what she asked (§N, mockup) ──
   Everything about asking in one right-hand pane: 🏆 Tell a result ·
   ⛸️ Club sessions · 🔀 Move · 💵 Cash · ⏪ Draw early, then "⌛ Asked
   parents" — her six newest questions from the ONE reader (`mnyRequestsFor`)
   with each answer in her words (`rqStatusText`), and "see all ▸" for the
   rest. A child's buttons open the request sheets (js/45), which ASK; a
   grown-up's 🏆 and 🔀 open the Record sheet, which records — one writer, two
   doors. */
function mnyAskCard(kid) {
  const wk = ctThisWeekKey();
  const rules = mrRulesForWeek(wk);
  const rate = money2(Number(mrRuleOr(rules, 'sessions.perSession')) || 0);
  const skips = mnyEnsureRequests(kid).filter(r => r && r.kind === 'skip' && r.weekKey === wk && r.status !== 'no').length;
  const max = money2(Number(mrRuleOr(rules, 'advance.maxPerWeek')) || 0);
  const left = Math.floor(money2(Math.max(0, max - mnyAdvanceUsed(kid, wk))) + 1e-9);
  const btn = (action, cls, label, sub) =>
    `<button type="button" class="mv2-act ${cls}" data-mny-action="${action}">${escapeHtml(label)}<span>${escapeHtml(sub)}</span></button>`;
  const mine = mnyRequestsFor(kid);
  const waiting = mine.filter(q => q.open).length;
  const row = (q) => `<div class="mv2-askrow ${'mv2-askrow--' + (q.status || 'open')}"><span class="mv2-chip-text">${escapeHtml(q.icon + ' ' + q.text)}</span><b>${escapeHtml(rqStatusText(q))}</b></div>`;
  return `<div class="mv2-card mv2-askcard">
      <div class="mv2-cardhead"><span class="mv2-title">📮 Ask parents</span></div>
      <div class="mv2-actions">
        ${btn('act-result', 'mv2-act--result', '🏆 Tell a result', 'from my planner')}
        ${btn('act-club', 'mv2-act--club', '⛸️ Club sessions', skips ? `${skips} asked · ${mnyShort$(rate)} each I go to` : `${mnyShort$(rate)} each I go to`)}
        ${btn('act-move', 'mv2-act--move', '🔀 Move · 💵 Cash', 'move · out · in')}
        ${btn('act-adv', 'mv2-act--adv', '⏪ Draw early', left ? `up to $${left}` : 'used up this week')}
      </div>
      <div class="mv2-asked">
        <span class="mv2-asked-title">⌛ Asked parents</span>
        ${waiting ? `<span class="mv2-asked-n">${waiting} waiting</span>` : ''}
        ${mine.length > 6 ? `<button type="button" class="mv2-seeall" data-mny-action="asked-all">see all ▸</button>` : ''}
      </div>
      ${mine.length ? `<div class="mv2-asklist">${mine.slice(-6).reverse().map(row).join('')}</div>`
        : '<span class="mv2-asked-none">Nothing asked yet.</span>'}
    </div>`;
}

/* ── 🧱 MY LOAN WALL (M5 + the mockup) ──
   A hundred bricks, each a hundredth of everything borrowed, filled as it is
   paid; under it what matters most, large — how much is left and when it is
   paid off — and the key facts small: the share paid and a week, each month,
   the early bonus earned, the cost of borrowing so far and the late costs
   (red, only above $0). "📋 My N loans" shows the rows instead of the wall
   (each row's bar, oldest first, and the interest line); "🧱 Show the wall"
   goes back. Every figure from `mnyLoanFacts` (js/20). */
function mnyLoanWallCard(kid) {
  const f = mnyLoanFacts(kid);
  if (!(f.principal > 0)) {
    return `<div class="mv2-card mv2-wall">
        <div class="mv2-cardhead"><span class="mv2-title">🧱 My loan wall</span>${mnyAskBtn('debt')}</div>
        <div class="mv2-line">Nothing to pay back, so every place for money is open.</div>
      </div>`;
  }
  const brick = f.principal / 100;
  const bricks = Array.from({ length: 100 }, (_, i) => {
    const fill = Math.max(0, Math.min(1, (f.paid - i * brick) / brick));
    return `<span class="mv2-brick${fill >= 1 ? ' full' : ''}"><i style="width:${Math.round(fill * 100)}%"></i></span>`;
  }).join('');
  const pct = f.principal > 0 ? (f.paid / f.principal) * 100 : 100;
  const rows = f.rows.map(r => `<div class="mv2-loanrow">
      <span class="mv2-loanrow-name">${escapeHtml(r.icon + ' ' + r.name)}</span>
      <b>${r.left <= 0.005 ? '✓ done' : escapeHtml(mnyMoney(r.left))}</b>
      <span class="mv2-bar"><i style="width:${Math.round(r.paidPct)}%"></i></span>
    </div>`).join('');
  const freeBy = f.left <= 0 ? 'Paid off 🎉'
    : f.freeBy ? formatDayKey(f.freeBy).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—';
  const open = mnyLoanRowsOpen;
  const n = f.rows.length;
  return `<div class="mv2-card mv2-wall">
      <div class="mv2-cardhead"><span class="mv2-title">🧱 My loan wall</span>${mnyAskBtn('debt')}</div>
      ${open
        ? `<div class="mv2-loanrows">${rows}</div>
           ${f.lastInterest > 0 ? `<div class="mv2-int">🟥 +${escapeHtml(mnyMoney(f.lastInterest))} interest added last time (${f.ratePct}% a year)</div>` : ''}`
        : `<div class="mv2-bricks" role="img" aria-label="${escapeAttr(Math.round(pct) + '% of the loan paid back')}">${bricks}</div>`}
      <div class="mv2-keyfacts">
        <div class="mv2-bigfacts">
          <span class="mv2-left-big"><b class="mv2-left">${escapeHtml(mnyMoney(f.left))}</b> left</span>
          <span class="mv2-bigfact"><span>Paid off by</span><b>${escapeHtml(freeBy)}</b></span>
        </div>
        <div class="mv2-facts">
          <span>${Math.round(pct)}% paid · ${escapeHtml(mnyMoney(f.weekly))} a week</span>
          <span>Each month <b>${escapeHtml(mnyMoney(f.monthly))}</b></span>
          <span>Early bonus earned <b>${escapeHtml(mnyMoney(f.bonus))}</b></span>
          <span>Borrowing so far <b>${escapeHtml(mnyMoney(f.interestAdded))}</b></span>
          <span${f.lateCosts > 0 ? ' class="mv2-late"' : ''}>Late costs <b>${escapeHtml(mnyMoney(f.lateCosts))}</b></span>
        </div>
      </div>
      <button type="button" class="mv2-btn mv2-loansbtn" data-mny-action="loanrows" aria-expanded="${open}">${open ? '🧱 Show the wall' : `📋 My ${n} loan${n === 1 ? '' : 's'} ▸`}</button>
    </div>`;
}

/* ── EVERYTHING I HAVE (M3, the mockup, Deviation 37 — no cash account) ──
   The total and the three places money can be — 🏦 Savings (her 🎯 goal
   jars inside it: "of which 🎯 bike $12", display only — the jars stay
   their own holdings in the data), 🔒 Locked away and 📈 Companies — each
   with its '?' and the prototype's hint. A place not open yet is dashed and
   says when it opens. Money that came in between Sundays (an approved gift,
   cash from home, a lock that came back — `wallet.cash`) is not a place: it
   shows as one line, "📥 Waiting for Sunday", only while there is some, and
   joins her pile on Sunday. */
function mnyEverythingParts(kid) {
  const jars = mnyGoalsNearestFirst(kid).map(g => ({ icon: g.icon || '🎯', name: g.name, value: mnyGoalJarValue(kid, g) }))
    .filter(j => j.value > 0);
  const jarTotal = money2(mnyReadyHomeTotal(kid) - mnySavedTotal(kid));
  return {
    total: mnyEverything(kid), jars, jarTotal, waiting: mnyCash(kid),
    tiles: [
      { k: 'ready', icon: '🏦', label: 'Savings',   value: money2(mnySavedTotal(kid) + jarTotal), ask: 'ready', stage: 'ready' },
      { k: 'gic',   icon: '🔒', label: 'Locked',    value: mnyLockedTotal(kid),   ask: 'gic',   stage: 'locked' },
      { k: 'stock', icon: '📈', label: 'Companies', value: mnyInvestedTotal(kid), ask: 'stock', stage: 'stock' },
    ].map(t => Object.assign(t, { open: mnyIsOpen(kid, t.stage), gate: mnyStagePct(t.stage) }))
     .map(t => Object.assign(t, { hint: mnyTileHint(kid, t) })),
  };
}
/* "Sat 3 Oct" — how the money screens name a day (owner's review). */
function mnyDayName(dayKey) {
  const d = formatDayKey(dayKey);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ' ' + d.getDate() + ' ' + MONTH_SHORT[d.getMonth()];
}
/* The prototype's line under each place (My Money v2 `pots[].sub`): the
   Savings safety line, when a lock comes back, how far a shut place is. */
function mnyTileHint(kid, t) {
  const R = mrSundayRules(ctThisWeekKey());
  const rate = { ready: mrRuleOr(R, 'pots.rates.ready'), gic: mrRuleOr(R, 'pots.rates.gic'), stock: mrRuleOr(R, 'pots.rates.stock') }[t.k];
  const f = mnyLoanFacts(kid);
  const pct = f.principal > 0 ? (f.paid / f.principal) * 100 : 100;
  if (!t.open) return `🔒 opens at ${t.gate}% paid · ${Math.max(1, Math.ceil(t.gate - pct))} more bricks`;
  if (t.k === 'ready') {
    const saved = mnySavedTotal(kid);
    const safety = money2(Number(mrRuleOr(R, 'pots.safety')) || 0);
    return saved >= safety ? `🛟 ${mnyShort$(safety)} safety + ${mnyMoney(saved - safety)} I can use · ${rate}% a year`
      : `🛟 fill to ${mnyShort$(safety)} first · ${mnyMoney(safety - saved)} to go`;
  }
  if (t.k === 'gic' && t.value > 0) {
    const next = mnyEnsureHoldings(kid).filter(h => h && h.kind === 'gic' && h.maturesOn)
      .map(h => String(h.maturesOn)).sort()[0];
    return `back ${next ? mnyDayName(next) : 'soon'} · ${rate}% a year`;
  }
  return `${rate}% a year`;
}
/* "of which 🎯 New skate guards $8 · 📚 Book set $2" — her jars, inside Savings. */
function mnyJarsInside(jars) {
  return jars.length ? 'of which ' + jars.map(j => `${j.icon} ${j.name} ${mnyShort$(j.value)}`).join(' · ') : '';
}
function mnyEverythingCard(kid) {
  const p = mnyEverythingParts(kid);
  return `<div class="mv2-card mv2-have">
      <div class="mv2-cardhead"><span class="mv2-title">Everything I have</span></div>
      <div class="mv2-totalrow"><span class="mv2-total">${escapeHtml(mnyMoney(p.total))}</span>${mnyBuysNote(p.total)}</div>
      <div class="mv2-tiles">
        ${p.tiles.map(t => `<div class="mv2-tile${t.open ? '' : ' shut'}" data-mny-tile="${t.k}">
            <div class="mv2-tile-top"><span class="mv2-tile-name">${t.icon} ${escapeHtml(t.label)}</span> ${mnyAskBtn(t.ask)}<b class="mv2-tile-val">${escapeHtml(mnyMoney(t.value))}</b></div>
            ${t.k === 'ready' && p.jars.length ? `<div class="mv2-tile-jars">${escapeHtml(mnyJarsInside(p.jars))}</div>` : ''}
            ${t.hint ? `<div class="mv2-tile-gate">${escapeHtml(t.hint)}</div>` : ''}
          </div>`).join('')}
      </div>
      ${p.waiting > 0 ? `<div class="mv2-waiting"><span>📥 Waiting for Sunday</span><b>${escapeHtml(mnyMoney(p.waiting))}</b></div>
        <div class="mv2-line">It joins my pile on Sunday, and I choose where it goes.</div>` : ''}
    </div>`;
}

/* ── 🎯 MY GOAL JARS (M4: several goals, each the prototype's jar) ──
   Nearest date first (`mnyGoalsNearestFirst`, the order Sunday's 🎯 box asks
   in), side by side as drawn. Each jar: how full, saved of what it costs, and
   today's answer to "am I going to make it?" — about how much a week by the
   date (`mnyGoalPace`). A jar is shut while Savings is (Plan v5 Deviation 31).
   ✏️ New goal asks her parents (the Stage 2 sheet); a goal already asked is
   drawn as a dashed jar with its answer. */
function mnyGoalJarsCard(kid) {
  const goals = mnyGoalsNearestFirst(kid);
  const shut = mnyGoalJarRefusal(kid);
  const asked = mnyEnsureRequests(kid)
    .filter(r => r && r.kind === 'goal' && !r.appliedWeek && r.status !== 'no').slice(-1)[0];
  const jar = (g) => {
    const saved = mnyGoalJarValue(kid, g);
    const target = money2(g.target);
    const pct = target > 0 ? Math.max(0, Math.min(100, (saved / target) * 100)) : 0;
    const pace = mnyGoalPace(kid, Object.assign({}, g, { saved }));
    let line;
    if (pace.reached) {
      line = isParent()
        ? `<button type="button" class="mv2-btn" data-mny-action="goaldone" data-mny-goal="${escapeAttr(g.id)}">🎉 She got it — take it out</button>`
        : `<div class="mv2-goal-line">🎉 Saved! Tell a grown-up.</div>`;
    } else if (shut) {
      line = `<div class="mv2-goal-line">${escapeHtml(shut)}</div>`;
    } else if (pace.late) {
      line = `<div class="mv2-goal-line">The day has passed and there is ${escapeHtml(mnyMoney(pace.left))} to go. Move the date, or keep going.</div>`;
    } else if (pace.neededPerWeek != null) {
      line = `<div class="mv2-goal-line">about ${escapeHtml(mnyMoney(pace.neededPerWeek))} a week to make it by ${escapeHtml(mnyShortDate(g.targetDate))}</div>`;
    } else {
      line = `<div class="mv2-goal-line">${escapeHtml(mnyMoney(pace.left))} to go · its own jar · earns nothing</div>`;
    }
    return `<div class="mv2-jar${shut ? ' shut' : ''}">
        <span class="mv2-jarpic" aria-hidden="true"><i style="height:${Math.round(pct)}%"></i></span>
        <div class="mv2-jarbody">
          <div class="mv2-jarname">${escapeHtml((g.icon || '🎯') + ' ' + g.name)}</div>
          <div class="mv2-jarfig"><b>${escapeHtml(mnyMoney(saved))}</b><span>of ${escapeHtml(mnyMoney(target))}</span></div>
          ${line}
        </div>
      </div>`;
  };
  const askedJar = asked ? `<div class="mv2-askjar">
      <span class="mv2-jarpic" aria-hidden="true"></span>
      <div class="mv2-jarbody">
        <div class="mv2-askname">${escapeHtml((asked.icon || '🎯') + ' ' + asked.name)}</div>
        <div class="mv2-goal-asked">${escapeHtml(asked.status === 'yes' ? '✓ Parents said yes · starts Sunday' : `⌛ asked parents · ${mnyShort$(asked.target)}`)}</div>
      </div>
    </div>` : '';
  return `<div class="mv2-card mv2-goals">
      <div class="mv2-cardhead"><span class="mv2-title">🎯 My goal jars</span>${mnyAskBtn('goal')}
        <button type="button" class="mv2-btn mv2-newgoal" data-mny-action="goal-new">✏️ New goal</button></div>
      ${goals.length || asked ? `<div class="mv2-jars">${goals.map(jar).join('')}${askedJar}</div>`
        : `<div class="mv2-line">No goal yet. ✏️ New goal asks my parents for one.</div>`}
    </div>`;
}

/* ── 🎁 GIFTS (M9: today's card, the mockup's place in the right pane) ──
   What came in, from whom, when — what still waits for a grown-up, or the last ten with
   the remembered toggle — and "I was given something", which for her opens
   the gift sheet (a question for her parents, js/45) and for a grown-up the
   Record sheet, which records it at once. A grown-up taps a row to correct it
   through the sheet that recorded it. */
function mnyGiftsCard(kid) {
  const all = (typeof mnyEnsureDeposits === 'function') ? mnyEnsureDeposits(kid) : [];
  const open = mnyGiftsOpen();
  const sorted = all.slice().sort((a, b) => String(b.dayKey || '').localeCompare(String(a.dayKey || '')));
  // Closed: only what still waits for a grown-up; open (remembered): the last ten.
  const recent = open ? sorted.slice(0, 10) : sorted.filter(d => d.pendingApproval && !d.rejectedAt).slice(0, 3);
  const waiting = all.filter(d => d.pendingApproval && !d.rejectedAt).length;
  const rows = recent.map(d => {
    const inner = `<span>🎁 ${escapeHtml(d.giver || d.from || 'A gift')}${d.giver && d.from ? ' · ' + escapeHtml(d.from) : ''}
        <small>${escapeHtml(mnyShortDate(d.dayKey || d.weekKey))}${
          d.rejectedAt ? ' · not this time' : d.pendingApproval ? ' · ⌛ waiting for a grown-up' : ' · ✓ counted'}</small></span>
      <b>${escapeHtml(mnyMoney(d.amount))}</b>`;
    return isParent()
      ? `<button type="button" class="mv2-giftrow mv2-giftrow--tap" data-mny-action="gift-edit"
           data-mny-dep="${escapeAttr(d.id)}">${inner}</button>`
      : `<div class="mv2-giftrow">${inner}</div>`;
  }).join('');
  return `<div class="mv2-card mv2-gifts">
      <div class="mv2-cardhead"><span class="mv2-title">🎁 Gifts</span>${waiting ? `<span class="mv2-asked-n">${waiting} waiting</span>` : ''}
        <button type="button" class="mv2-seeall" data-mny-action="gifts" aria-expanded="${open}">${open ? 'fewer ▾' : 'all ▸'}</button></div>
      ${rows || `<div class="mv2-line">${all.length ? `${all.length} gift${all.length === 1 ? '' : 's'} so far · all ▸ to see them` : open ? 'No gifts recorded yet. When someone gives me money, “I was given something” tells my parents, and it joins my pile on Sunday once they say yes.' : 'No gifts recorded yet.'}</div>`}
      <button type="button" class="mv2-btn mv2-giftadd" data-mny-action="gift-add">${isParent() ? '＋ Record a gift' : '🎁 I was given something'}</button>
    </div>`;
}

/* ── 📒 MY PASSBOOK (M7, the mockup, Deviation 40) ──
   The last four Sundays from the frozen ledger (`moneyLedger`), newest first:
   what came in that Sunday and where it went. Each Sunday shows money IN by
   the four income groups (Plan v5 §L S1) — 💪 earned · 🎁 given · 🌱 made ·
   ➖ taken off — above where it WENT (wall · saved · cash), each a bar; a tap
   unfolds the Sunday's figures. 💰 in = what she earned after fines + what she
   was given (the same figure as before); 💪 earned is before the fines, which
   ➖ takes off; 🌱 made stays in her pots. Money drawn early was spent as cash
   before Sunday, so it is in "cash". The foot: the four Sundays' total and how
   many she has signed; "all my Sundays" (📖, top-right) opens My money story.
   A row from before the split (a flat or typed-in week) shows what came in
   only. */
function mnyPassbookRow(r) {
  const n = (v) => money2(Number(v) || 0);
  const given = n(r.deposits != null ? r.deposits : r.outside);
  const earned = n(r.net);
  const made = Math.max(0, n(r.passive));
  const fines = Math.max(0, n(r.fines));
  const steady = n(r.chores) + n(r.learning) + n(r.streak) + n(r.sessionsPaid);
  const split = !r.defaulted && (steady + n(r.competition) + given + made) > 0;
  const wall = money2(n((r.loan || {}).paid) + n(r.extra != null ? r.extra : r.debtExtra));
  const saved = money2(n(r.ready) + n(r.goal) + n(r.gic) + n(r.stock));
  const cash = n(r.spend);
  return {
    weekKey: r.weekKey, sunday: sdSundayOf(r.weekKey), inAmt: money2(earned + given),
    earned, given, made, split, wall, saved, cash,
    gross: money2(earned + fines), takenOff: fines,
    steady: money2(steady), bonus: money2(n(r.competition) + given + made),
  };
}
function mnyPassbookData(kid) {
  const all = mnyLedgerRows(kid).map(mnyPassbookRow);
  const last4 = all.slice(0, 4);
  const sum = (k) => money2(last4.reduce((a, r) => a + r[k], 0));
  const t = { inAmt: sum('inAmt'), earned: sum('earned'), given: sum('given'), made: sum('made'),
              gross: sum('gross'), takenOff: sum('takenOff'),
              wall: sum('wall'), saved: sum('saved'), cash: sum('cash'),
              steady: money2(last4.filter(r => r.split).reduce((a, r) => a + r.steady, 0)),
              bonus: money2(last4.filter(r => r.split).reduce((a, r) => a + r.bonus, 0)),
              split: last4.some(r => r.split) };
  const placed = money2(t.wall + t.saved + t.cash);
  const shares = sdPercents([t.wall, t.saved, t.cash], placed);
  const sb = money2(t.steady + t.bonus);
  const steadyPct = sb > 0 ? Math.round(t.steady / sb * 100) : null;
  return { all, last4, total: t, shares, placed, steadyPct };
}
/* "All my Sundays" (owner's review, screenshot 1): a small icon in the
   card's top-right corner, opening My money story. */
function mnyBookAllBtn() {
  return `<button type="button" class="mv2-bookall" data-mny-action="story" aria-label="All my Sundays" title="All my Sundays">📖</button>`;
}
/* The in-bar (💪 🎁 🌱, with ➖ hatched at its end) and the out-bar (wall ·
   saved · cash). */
function mnyBookBars(r, showIn) {
  const inBar = showIn ? `<span class="mv2-bookbar mv2-bookbar--in"><i class="mv2-sw--earned" style="flex:${money2(r.gross - r.takenOff)} 0 0"></i><i class="mv2-sw--given" style="flex:${r.given} 0 0"></i><i class="mv2-sw--made" style="flex:${r.made} 0 0"></i><i class="mv2-sw--off" style="flex:${r.takenOff} 0 0"></i></span>` : '';
  return `${inBar}<span class="mv2-bookbar mv2-bookbar--out"><i class="mv2-sw--wall" style="flex:${r.wall} 0 0"></i><i class="mv2-sw--saved" style="flex:${r.saved} 0 0"></i><i class="mv2-sw--cash" style="flex:${r.cash} 0 0"></i></span>`;
}
/* "💪 $28 · 🎁 $5 · 🌱 $0.40 · ➖ $1" — what came in, by group. */
function mnyBookInLine(r) {
  return `💪 ${mnyShort$(r.gross)} · 🎁 ${mnyShort$(r.given)} · 🌱 ${mnyShort$(r.made)} · ➖ ${mnyShort$(r.takenOff)}`;
}
function mnyPassbookCard(kid) {
  const p = mnyPassbookData(kid);
  const sw = (cls) => `<i class="mv2-sw ${cls}"></i>`;
  const key = `<div class="mv2-bookkey"><span>${sw('mv2-sw--earned')}earned ${sw('mv2-sw--given')}given ${sw('mv2-sw--made')}made ${sw('mv2-sw--off')}taken off</span><span>${sw('mv2-sw--wall')}wall ${sw('mv2-sw--saved')}saved ${sw('mv2-sw--cash')}cash</span></div>`;
  if (!p.last4.length) {
    return `<div class="mv2-card mv2-book">
        <div class="mv2-cardhead"><span class="mv2-title">📒 My passbook</span>${mnyBookAllBtn()}</div>
        ${key}
        <div class="mv2-line">Every Sunday I sign gets written here — what came in, and where it went.</div>
      </div>`;
  }
  const rows = p.last4.map((r, i) => {
    const open = mnyBookOpen === r.weekKey;
    return `<button type="button" class="mv2-bookrow${i === 0 ? ' latest' : ''}${open ? ' open' : ''}" data-mny-action="bookrow" data-mny-week="${escapeAttr(r.weekKey)}" aria-expanded="${open}">
        <span class="mv2-bookdate">${escapeHtml(mnyDayMonth(r.sunday))}</span>
        <b class="mv2-bookin">${escapeHtml(mnyMoney(r.inAmt))}</b>
        <span class="mv2-bookbars">${mnyBookBars(r, r.split)}</span>
        ${open ? `<span class="mv2-booksplit">${r.split ? `<span>in: ${escapeHtml(mnyBookInLine(r))}</span>` : ''}<span>went: wall ${escapeHtml(mnyMoney(r.wall))} · saved ${escapeHtml(mnyMoney(r.saved))} · cash ${escapeHtml(mnyMoney(r.cash))}</span></span>` : ''}
      </button>`;
  }).join('');
  const t = p.total;
  const pf = (i, v) => sdPercentLabel(p.shares[i], v);
  const first = p.last4[p.last4.length - 1], last = p.last4[0], n = p.last4.length;
  const note = `${mnyDayMonth(first.sunday)} – ${mnyDayMonth(last.sunday)}: about ${mnyBook$(t.inAmt / n)} a week${p.steadyPct != null ? ` (${p.steadyPct}% steady · ${100 - p.steadyPct}% bonus)` : ''}.${p.placed > 0 ? ` ${pf(0, t.wall)} to the wall · ${pf(1, t.saved)} saved · ${pf(2, t.cash)} cash.` : ''}`;
  return `<div class="mv2-card mv2-book">
      <div class="mv2-cardhead"><span class="mv2-title">📒 My passbook</span>${mnyBookAllBtn()}</div>
      ${key}
      ${rows}
      <div class="mv2-booktotal"><span>${n} Sunday${n === 1 ? '' : 's'}</span><b class="mv2-bookin">${escapeHtml(mnyMoney(t.inAmt))} in</b>
        <span class="mv2-bookline">${escapeHtml(`${mnyKidName(kid)} ✓ ${p.all.length} signed`)}</span></div>
      <div class="mv2-booknote">${escapeHtml(note)}</div>
      ${t.split ? `<div class="mv2-booknote">${escapeHtml('in: ' + mnyBookInLine(t))}</div>` : ''}
    </div>`;
}

/* ── THE MONTH'S CALENDAR + 📅 COMING UP (M6: merged) ──
   Today's calendar, Monday first: a recorded result shows its sport and
   "✓ $18" on its day; a meet on her planner with no result yet shows dashed —
   and once its day has come, tapping it opens 🏆 Tell a result for that meet
   (a grown-up: the Record sheet); money Dad expects this month (Stage 1
   `expected` — a month, not a day) sits under the month's name. Under it,
   the prototype's 📅 Coming up: this month's results with what they paid,
   the meets still to come, and the money Dad expects in the months ahead. */
function mnyCalendarData(kid, month) {
  const recorded = mrCompetitions(kid).filter(c => c && String(c.dayKey || '').slice(0, 7) === month);
  const planned = rqPlannedInMonth(kid, month).filter(p => p.st !== 'done');
  const expected = mnyEnsureExpected(kid).filter(e => e && e.month === month);
  return { recorded, planned, expected };
}
function mnyComingUp(kid) {
  const today = String(todayKey());
  const month = today.slice(0, 7);
  const out = [];
  mrCompetitions(kid).filter(c => c && String(c.dayKey || '').slice(0, 7) === month)
    .sort((a, b) => (a.dayKey < b.dayKey ? -1 : 1))
    .forEach(c => out.push({ kind: 'done', icon: mnySportIcon(c.sport), name: c.name || mnySportLabel(c.sport),
      when: `${mnyDayLabel(c.dayKey)} · ✓ ${mnyShort$(mrCompAward(c))}` }));
  const months = [0, 1, 2].map(i => { const d = formatDayKey(month + '-01'); d.setMonth(d.getMonth() + i); return ctDateToKey(d).slice(0, 7); });
  months.forEach(m => rqPlannedInMonth(kid, m).filter(p => p.st === 'soon')
    .forEach(p => out.push({ kind: 'soon', icon: p.icon, name: p.title, when: mnyDayLabel(p.dayKey) })));
  mnyEnsureExpected(kid).filter(e => e && e.month >= month && !/🏆|🏊|⛸️/.test(e.label || ''))
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .forEach(e => out.push({ kind: 'expect', icon: '', name: e.label,
      when: `${MONTH_SHORT[Number(e.month.slice(5, 7)) - 1]} · parents expect ~${mnyShort$(e.amount)}` }));
  return out.slice(0, 6);
}
/* Every day of the month is a button (Deviation 39): a day with a recorded
   result, or a planned meet whose day has come, opens 🏆 Tell a result for it
   — or says where her question stands; a planned meet still ahead says its
   results come after the day; a day with nothing asks "Add a competition on
   Sat 10 Oct?" and opens the planner's own add sheet on that day with
   🏆 Competition chosen (`mnyCalDay`, below — the planner's writer, no other). */
function mnyCalendarCard(kid) {
  const month = mnyCalMonth || String(todayKey()).slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7;            // Monday-first, like the planner
  const cal = mnyCalendarData(kid, month);
  const today = String(todayKey());
  const byDay = {};
  const slot = (d) => (byDay[d] = byDay[d] || {});
  cal.recorded.forEach(c => { slot(Number(String(c.dayKey).slice(8, 10))).rec = c; });
  cal.planned.forEach(p => { const d = Number(String(p.dayKey).slice(8, 10)); if (!slot(d).rec) slot(d).plan = p; });
  const total = money2(cal.recorded.reduce((s, c) => s + mrCompAward(c), 0));
  let cells = '';
  for (let i = 0; i < lead; i++) cells += `<span class="mv2-cal-cell blank"></span>`;
  for (let d = 1; d <= days; d++) {
    const key = month + '-' + String(d).padStart(2, '0');
    const hit = byDay[d] || {};
    const isToday = key === today ? ' today' : '';
    const attrs = `data-mny-action="cal-day" data-daykey="${key}"`;
    if (hit.rec) {
      cells += `<button type="button" class="mv2-cal-cell rec${isToday}" ${attrs} aria-label="${escapeAttr((hit.rec.name || mnySportLabel(hit.rec.sport)) + ' · ✓ ' + mnyMoney(mrCompAward(hit.rec)))}"><span class="mv2-cal-icon">${escapeHtml(mnySportIcon(hit.rec.sport))}</span><small>✓ ${escapeHtml(mnyShort$(mrCompAward(hit.rec)))}</small></button>`;
    } else if (hit.plan) {
      const p = hit.plan;
      cells += `<button type="button" class="mv2-cal-cell plan${p.st === 'open' ? ' open' : ''}${isToday}" ${attrs} data-mny-id="${escapeAttr(p.blockId || '')}" aria-label="${escapeAttr((p.st === 'open' ? '🏆 Tell a result for ' : '') + p.title + (p.st === 'sent' ? ' · sent to parents' : p.st === 'soon' ? ' · coming up' : ''))}"><span class="mv2-cal-icon">${escapeHtml(p.icon)}</span><small>${d}</small></button>`;
    } else {
      cells += `<button type="button" class="mv2-cal-cell${isToday}" ${attrs} aria-label="${escapeAttr(mnyDayName(key) + ' — add a competition')}">${d}</button>`;
    }
  }
  const label = ['January','February','March','April','May','June','July','August','September','October','November','December'][m - 1] + ' ' + y;
  const coming = mnyComingUp(kid);
  return `<div class="mv2-card mv2-cal">
      <div class="mv2-month-nav">
        <button type="button" class="mv2-step" data-mny-action="cal" data-mny-dir="-1" aria-label="Previous month">‹</button>
        <span class="mv2-title">🏆 ${escapeHtml(label)}</span>
        <button type="button" class="mv2-step" data-mny-action="cal" data-mny-dir="1" aria-label="Next month">›</button>
      </div>
      ${cal.expected.length ? `<div class="mv2-expect">${cal.expected.map(e => `<span>${escapeHtml(e.label)} · parents expect ~${escapeHtml(mnyShort$(e.amount))}</span>`).join('')}</div>` : ''}
      <div class="mv2-dow">${['M','T','W','T','F','S','S'].map(x => `<span>${x}</span>`).join('')}</div>
      <div class="mv2-calgrid">${cells}</div>
      <div class="mv2-row2"><span>This month's results</span><b>${escapeHtml(mnyMoney(total))}</b></div>
      <div class="mv2-coming">
        <div class="mv2-title mv2-title--sm">📅 Coming up</div>
        ${coming.length ? coming.map(c => `<div class="mv2-comingrow ${'mv2-comingrow--' + c.kind}"><span>${escapeHtml((c.icon ? c.icon + ' ' : '') + c.name)}</span><span>${escapeHtml(c.when)}</span></div>`).join('')
          : '<div class="mv2-line">Nothing on the calendar yet.</div>'}
      </div>
      <div class="mv2-line">We never talk about money before or during a competition. That is a promise, not a rule.</div>
    </div>`;
}
/* A tapped calendar day (Deviation 39). One question per kind of day:
     recorded result            → what it paid (a grown-up: the Record sheet, to correct it)
     planned meet, day has come → 🏆 Tell a result for it (a grown-up: the Record sheet)
     planned, already told      → where her question stands
     planned, still ahead       → "results after the day"
     nothing on it              → "Add a competition on Sat 10 Oct?", then the
                                  planner's own add sheet on that day with
                                  🏆 Competition chosen (`pickFromSlot`) —
                                  the planner's writer; nothing is placed here. */
function mnyCalDay(kid, dayKey) {
  const month = String(dayKey).slice(0, 7);
  const cal = mnyCalendarData(kid, month);
  const rec = cal.recorded.find(c => String(c.dayKey) === String(dayKey));
  const plan = cal.planned.find(p => String(p.dayKey) === String(dayKey));
  if (rec) {
    if (isParent()) { openRecordSheet({ kind: 'meet', kid, id: rec.id }); return; }
    showToast(`${mnySportIcon(rec.sport)} ${rec.name || mnySportLabel(rec.sport)} · ✓ ${mnyMoney(mrCompAward(rec))} — it is on my record`);
    return;
  }
  if (plan) {
    if (plan.st === 'soon') { showToast(`${plan.icon} ${plan.title} is on ${mnyDayName(dayKey)} — results after the day`); return; }
    if (plan.st === 'sent') {
      const q = mnyRequestsFor(kid).find(x => x.kind === 'comp' && x.record && x.record.blockId === plan.blockId);
      showToast(`${plan.icon} ${plan.title} · ${q ? rqStatusText(q) : '⌛ sent to parents'}`);
      return;
    }
    if (isParent()) openRecordSheet({ kind: 'meet', kid, dayKey, name: plan.title || '', sport: plan.sport || '' });
    else mnyOpenRequestSheet('result', { kid, blockId: plan.blockId, dayKey });
    return;
  }
  showConfirm(`Add a competition on ${mnyDayName(dayKey)}?`, { okLabel: '🏆 Add it' }).then(ok => {
    if (!ok) return;
    const act = findActivity('competition', kid);
    if (!act) { showToast('There is no 🏆 Competition activity to add.'); return; }
    openDayFromWeekCard(dayKey, (formatDayKey(dayKey).getDay() + 6) % 7);
    pendingStartMin = 9 * 60;
    pickFromSlot('competition');
  });
}

/* The sport id `dance` is the skating star level test — silver and gold items
   are the star test's own marks. Only the words changed: the id, the rule key
   and the scorer did not, so every result already recorded reads under the
   name the family uses. */
function mnySportIcon(s) { return { swim: '🏊', skate: '⛸️', dance: '🌟' }[s] || '🏆'; }
function mnySportLabel(s) { return { swim: 'Swim meet', skate: 'Skating', dance: 'Skating star level' }[s] || 'Competition'; }

/* ── ⭐ STICKERS (as drawn) ──
   Derived, never stored: each signed week's ledger row through the core's
   `sdStickersFor` (the same rule Sunday uses), every sticker she has ever
   earned lit, the rest a dashed ❔. */
function mnyStickersFor(kid) {
  const got = new Set();
  mnyLedgerRows(kid).forEach(r => {
    sdStickersFor({
      extra: Number(r.extra != null ? r.extra : r.debtExtra) || 0,
      ready: Number(r.ready) || 0, gic: Number(r.gic) || 0, stock: Number(r.stock) || 0,
      wallet: Number(r.spend) || 0,
      guess: r.guess != null ? Number(r.guess) : null, payday: Number(r.payday) || 0,
    }).forEach(id => got.add(id));
  });
  return SD_STICKERS.map(([id, icon, name]) => ({ id, icon, name, got: got.has(id) }));
}
function mnyStickersCard(kid) {
  return `<div class="mv2-card mv2-stickers">
      <span class="mv2-title">⭐ Stickers</span>
      <div class="mv2-stickrow">${mnyStickersFor(kid).map(s =>
        `<span class="mv2-sticker${s.got ? ' got' : ''}" title="${escapeAttr(s.name)}" aria-label="${escapeAttr(s.name + (s.got ? '' : ' — not yet'))}">${s.got ? s.icon : '❔'}</span>`).join('')}</div>
    </div>`;
}

/* What everything pays, straight from the rules — Money school's copy of the
   list (My money opens the same list in a sheet). Collapsed by default: this
   is reference, not news. TODAY's prices; what was already earned this week
   keeps the price live when it was done, and the note says so. */
function mnyPricesCard(wk) {
  const r = mrRules();
  const weekRules = mrRulesForWeek(wk);
  const changedMidWeek = JSON.stringify(r) !== JSON.stringify(weekRules);
  const open = mnyPricesOpen();
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

/* The Flow leads this screen and the settled weeks follow it (js/42-flow.js).

   The order is the point. The week list reads the FROZEN LEDGER, so it can
   only show weeks a meeting settled — a gift that arrived on a Tuesday, a
   spend, a move between pots are all invisible to it. The Flow reads the
   stream, which holds every one of them. Leading with the narrower answer is
   how a child comes to believe the money she was given is not part of her
   money story.

   Both stay: the ledger rows are the week-by-week record a parent checks
   against a meeting, and the Flow cannot replace a record of what each
   settlement paid. */
/* ── Your last 8 weeks (R5 §5 C2, row 12) ──
   The chore tab rail's eight bars — what each week earned, this one still
   going — from its own reader, ckEightWeeks, so the bars and their labels are
   the rail's. Scaled to her own best week of the eight. It sits after the Flow
   and before the week-by-week record, which lists settled weeks only and is
   not repeated here. Read-only. */
function mnyEightWeeksCard(kid) {
  const { weeks, peak } = ckEightWeeks(kid, ctThisWeekKey());
  const best = weeks.reduce((a, w) => (w.money > a.money ? w : a), weeks[0]);
  const bars = weeks.map(w => `<span class="mny-wk8-bar${w.now ? ' now' : ''}" title="${escapeAttr(w.title)}">
        <span class="mny-wk8-fill" style="height:${Math.max(4, Math.round(w.money / peak * 80))}px"></span>
      </span>`).join('');
  const first = weeks[0].d;
  return `<div class="mny-card mny-weeks8">
      <div class="mny-label">📊 Your last 8 weeks</div>
      <div class="mny-wk8-row" role="img" aria-label="${escapeAttr(weeks.map(w => w.title).join('; '))}">${bars}</div>
      <div class="mny-wk8-axis"><span>${escapeHtml(`${MONTH_SHORT[first.getMonth()]} ${first.getDate()}`)}</span><span>this week</span></div>
      <div class="mny-note">${best.money > 0
        ? escapeHtml(`Best of the eight: ${mnyMoney(best.money)}, the week of ${MONTH_SHORT[best.d.getMonth()]} ${best.d.getDate()}. This week is still going.`)
        : 'Nothing earned in these eight weeks yet. This week is still going.'}</div>
    </div>`;
}

function mnyRenderStory() {
  const wrap = document.getElementById('mnyStoryWrap');
  if (!wrap) return;
  const kid = mnyViewKid();
  const all = mnyLedgerRows(kid);
  const flow = (typeof flRenderFlow === 'function') ? flRenderFlow(kid) : '';
  const weeks8 = mnyEightWeeksCard(kid);

  if (!all.length) {
    wrap.innerHTML = `${mnyPageHead('🌊 My money story', '', [], { back: 'backmoney' })}
      ${mnyTabBar('money')}
      ${flow}
      ${weeks8}
      <div class="mny-card"><div class="mny-label">📖 Week by week</div>
      <div class="mny-note">Every Sunday you settle a week, it gets written down here — what came in, where it went, and how much of your loan was left. Nothing settled yet.</div></div>`;
    if (typeof enhanceNonButtonClickables === 'function') enhanceNonButtonClickables(wrap);
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
  /* `outside` was missing, while the per-week bar directly below this listed
     "From outside" as a row — so every gift was under-reported in the one
     figure that claims to be everything that came in. */
  const inTotal = money2(sum('chores') + sum('learning') + sum('streak')
    + sum('competition') + sum('outside')
    + rows.reduce((s, r) => s + (r.defaulted ? money2(r.gross) : 0), 0));

  wrap.innerHTML =
      `${mnyPageHead('🌊 My money story', 'Where it comes from and where it goes', [], { back: 'backmoney' })}
       ${mnyTabBar('money')}
       ${flow}
       ${weeks8}
       <div class="mny-card">
         <div class="mny-label">📖 Week by week</div>
         <div class="mny-chiprow">${modeBtns}</div>
         ${monthNav}
         <div class="mny-rows">
           <div class="mny-row"><span>Money that came in</span><b>${mnyMoney(inTotal)}</b></div>
           <div class="mny-row"><span>Taken off</span><b>${sum('fines') > 0 ? '−' + mnyMoney(sum('fines')).slice(1) : 'nothing'}</b></div>
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
    { label: 'Jobs',         value: r.chores,      color: 'var(--mny-chores)' },
    { label: 'Learning',     value: r.learning,    color: 'var(--mny-learning)' },
    { label: 'Clean days',   value: r.streak,      color: 'var(--mny-streak)' },
    { label: 'Competitions', value: r.competition, color: 'var(--mny-comp)' },
    { label: 'From outside', value: r.outside,     color: 'var(--mny-outside)' },
    /* A week credited at a flat amount carries it in no channel, so without
       this row its bar read "Nothing came in" beside a total of $3. A meet
       paid on top is already the Competitions segment, so it is not counted
       here a second time. */
    { label: r.defaultReason === 'grandma' ? 'Grandfather rule' : 'A flat amount',
      value: r.defaulted ? money2(money2(r.gross) - money2(r.competition)) : 0, color: 'var(--mny-flat)' },
  ]);
  inBar.fines = money2(r.fines);
  const plan = r.plan || {};
  const outBar = mnySegments([
    { label: 'Loan payment', value: (r.loan || {}).paid, color: 'var(--mny-out-loan)' },
    { label: 'Paid off early', value: r.debtExtra,       color: 'var(--mny-out-extra)' },
    { label: 'Savings',      value: r.ready,             color: 'var(--mny-out-ready)' },
    { label: 'Locked away',  value: r.gic,               color: 'var(--mny-out-locked)' },
    { label: 'Companies',    value: r.stock,             color: 'var(--mny-out-stock)' },
  ]);
  const edited = (r.edited || []).length;
  return `<div class="mny-card">
      <div class="mny-week-head">
        <span class="mny-label">Week of ${escapeHtml(mnyShortDate(r.weekKey))}</span>
        <b>${mnyMoney(r.net)}</b>
      </div>
      ${r.confirmedBy ? `<div class="mny-note">Agreed with ${escapeHtml(r.confirmedBy)}${plan.label ? ' · ' + escapeHtml(plan.label) : ''}</div>` : ''}
      ${/* A week agreed weeks after it ended was put together from what everyone
            remembered. She is entitled to know which of her weeks those are —
            same honesty as the parent side marking a typed-in week. */''}
      ${r.defaulted ? `<div class="mny-note">${r.defaultReason === 'grandma'
          ? '👴 Grandfather rule — before we started counting, every week got the same amount.'
          : '🕰️ Nobody sat down for this week, so it got a flat amount.'}</div>` : ''}
      ${r.weeksLate ? `<div class="mny-note">🕰️ Agreed ${r.weeksLate} week${r.weeksLate > 1 ? 's' : ''} after this one finished, from what everyone remembered.</div>` : ''}
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
/* Every container mnyHandleClick is bound to, in ONE list. 99-main.js binds
   from it and the smoke suite asserts every rendered `data-mny-action` sits
   under one of these. It used to be a literal in 99-main.js that nobody had
   to keep in step with the pages — so the parent's Money rules page, which
   renders `record-any` and `tourpar` into #mnyRulesWrap, had two buttons
   that did nothing at all.
   `requestBody` is her request sheets' body (js/45-requests.js): their
   `rq-…` actions are handed to `rqHandleAction` / `rqHandleInput`.
   `sundayBody` is the Sunday ritual's sheet (Dad's card, js/44); the
   ritual's `sd-…` actions, in the meeting body and that sheet, are handed to
   `sdHandleAction`. */
const MNY_CLICK_HOSTS = ['mnyPage1Wrap', 'mnyStoryWrap', 'mnySchoolWrap', 'familyMeetingBody', 'mnyRulesWrap', 'requestBody', 'sundayBody'];

function mnyHandleClick(ev) {
  const el = ev.target.closest('[data-mny-action]');
  if (!el) return;
  const a = el.getAttribute('data-mny-action');
  // Her request sheets (js/45-requests.js) own every `rq-…` action.
  if (a.indexOf('rq-') === 0) { rqHandleAction(a, el); return; }
  // The Sunday ritual (js/44-sunday.js) owns every `sd-…` action.
  if (a.indexOf('sd-') === 0) { sdHandleAction(a, el); return; }

  if (a === 'gifts') { mnySetGiftsOpen(!mnyGiftsOpen()); mnyRenderMyMoney(); return; }
  /* My money's doors (My Money v2). A child's open her request sheets
     (js/45) — each one ASKS. A grown-up records a result, a move or a gift
     directly on the Record sheet (js/41), and files a club or advance
     question on her behalf through the same sheets. */
  if (a === 'gift-add') {
    if (isParent()) openRecordSheet({ kind: 'gift', kid: mnyViewKid() });
    else mnyOpenRequestSheet('gift', { kid: mnyViewKid() });
    return;
  }
  if (a === 'gift-edit') { openRecordSheet({ kind: 'gift', kid: mnyViewKid(), id: el.getAttribute('data-mny-dep') }); return; }
  if (a === 'act-result') {
    if (isParent()) openRecordSheet({ kind: 'meet', kid: mnyViewKid() });
    else mnyOpenRequestSheet('result', { kid: mnyViewKid() });
    return;
  }
  if (a === 'act-move') {
    if (isParent()) openRecordSheet({ kind: 'move', kid: mnyViewKid() });
    else mnyOpenRequestSheet('move', { kid: mnyViewKid() });
    return;
  }
  if (a === 'act-club') { mnyOpenRequestSheet('club', { kid: mnyViewKid() }); return; }
  if (a === 'act-adv')  { mnyOpenRequestSheet('adv', { kid: mnyViewKid() }); return; }
  if (a === 'goal-new') { mnyOpenRequestSheet('goal', { kid: mnyViewKid() }); return; }
  if (a === 'asked-all') { mnyOpenRequestSheet('list', { kid: mnyViewKid() }); return; }
  if (a === 'prices-sheet') { mnyOpenRequestSheet('prices', { kid: mnyViewKid() }); return; }
  // A day on the calendar (Deviation 39): its result, its question, or "add a competition?".
  if (a === 'cal-day') { mnyCalDay(mnyViewKid(), el.getAttribute('data-daykey')); return; }
  // ☀️ "where it goes", 🧱 "My N loans", a 📒 Sunday's split — this screen's own folds.
  if (a === 'weekbar') { mnyWeekBarOpen = !mnyWeekBarOpen; mnyRenderMyMoney(); return; }
  if (a === 'loanrows') { mnyLoanRowsOpen = !mnyLoanRowsOpen; mnyRenderMyMoney(); return; }
  if (a === 'bookrow') {
    const wk = el.getAttribute('data-mny-week');
    mnyBookOpen = mnyBookOpen === wk ? null : wk;
    mnyRenderMyMoney();
    return;
  }
  /* No kind chosen: which record this is is the first thing the sheet asks.
     On Money rules the child on screen is the parent page's, not mnyKid. */
  if (a === 'record-any') {
    openRecordSheet({ kid: el.closest('#mnyRulesWrap') ? mnyParentKid() : mnyViewKid() });
    return;
  }
  /* A planned meet with no result yet, on Sunday's "Dad answers first" card:
     "No criteria met · $0" writes a real record worth nothing — a different
     fact from no record at all. */
  if (a === 'comp-zero') {
    mnyRecordCompZero(mnyMeetingKid(), el.getAttribute('data-daykey'),
      el.getAttribute('data-name'), el.getAttribute('data-sport'));
    return;
  }
  if (a === 'kid')     { mnySetKid(el.getAttribute('data-mny-kid')); return; }
  if (a === 'story')   { mnyOpenStory(); return; }
  if (a === 'tab')     { mnyGoTab(el.getAttribute('data-mny-tab')); return; }
  if (a === 'tourkid') { mnyOpenTour('kid'); return; }
  if (a === 'backmoney')   { mnyOpenMyMoney(mnyViewKid()); return; }
  if (a === 'backschool')  { mnySchoolBack(); return; }
  if (a === 'backplanner') { goWeek(); return; }
  if (a === 'tourpar') { mnyOpenTour('parent'); return; }
  if (a === 'prices') {
    // Money school's price list keeps its remembered toggle.
    mnySetPricesOpen(!mnyPricesOpen());
    mnyRenderSchool();
    return;
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
  // 🎉 A goal reached is a grown-up's moment: the jar empties into the thing.
  if (a === 'goaldone') {
    if (mnyCompleteGoal(mnyViewKid(), el.getAttribute('data-mny-goal'))) showToast('🎉 Got it!');
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

/* Typed fields. Kept out of mnyHandleClick and off re-render: redrawing on
   every keystroke would take the caret with it. */
function mnyHandleInput(ev) {
  const el = ev.target.closest('[data-mny-action]');
  if (!el) return;
  const a = el.getAttribute('data-mny-action');
  if (a.indexOf('rq-') === 0) { rqHandleInput(a, el); return; }
}

/* ── THE '?' EXPLAINER (Plan v5 §L M10: the prototype's idea card) ──
   What / Why / Watch and the Chinese line, read from MNY_CONCEPTS through
   `mnyConceptCard` (the one statement of each idea, the same Money school
   shows), plus "📚 Take me to Money school", which opens Money school at that
   idea and remembers where to come back to (`mnySchoolReturn`, device-local).
   An idea not open for her yet still explains itself — the prototype has no
   locks here — and says when it opens. */
function mnyShowConcept(id, opts) {
  const o = opts || {};
  /* From the meeting the girl on screen is the meeting's, and Save & grow's
     '?' carries a tab for each of its four places (the prototype's askTabs). */
  const fromMeeting = typeof mmIsOpen === 'function' && mmIsOpen();
  const kid = fromMeeting ? mnyMeetingKid() : mnyViewKid();
  const c = mnyConceptCard(id, kid);
  if (!c) return;
  const existing = document.getElementById('mnyConceptCard');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'mnyConceptCard';
  el.className = 'mny-concept-scrim';
  const tabs = (o.tabs || []).map(t => {
    const tc = mnyConceptCard(t, kid);
    return tc ? `<button type="button" class="mv2-idea-tab${t === id ? ' on' : ''}" data-idea-tab="${escapeAttr(t)}">${escapeHtml(tc.icon + ' ' + tc.title)}</button>` : '';
  }).join('');
  el.innerHTML = `<div class="mny-concept mv2-idea" role="dialog" aria-modal="true" aria-label="${escapeAttr(c.icon + ' ' + c.title)}">
      ${tabs ? `<div class="mv2-idea-tabs">${tabs}</div>` : ''}
      <div class="mv2-idea-title">${escapeHtml(c.icon + ' ' + c.title)}</div>
      <div class="mv2-idea-grid">
        <b class="mv2-idea-what">What</b><span>${escapeHtml(c.what)}</span>
        <b class="mv2-idea-why">Why</b><span>${escapeHtml(c.why)}</span>
        <b class="mv2-idea-watch">Watch</b><span>${escapeHtml(c.risk)}</span>
      </div>
      ${c.cn ? `<div class="mv2-idea-cn" lang="zh">${escapeHtml(c.cn)}</div>` : ''}
      ${c.open ? '' : `<div class="mv2-idea-lock">🔒 ${escapeHtml(mnyNeedLabel(c.stage))}.</div>`}
      <div class="mv2-idea-foot">
        <button type="button" class="mv2-btn" id="mnyConceptMore">📚 Take me to Money school</button>
        <button type="button" class="mv2-btn mv2-btn--go" id="mnyConceptClose">Got it</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.addEventListener('click', e => {
    if (e.target === el) { close(); return; }
    const t = e.target.closest('[data-idea-tab]');
    if (t) mnyShowConcept(t.getAttribute('data-idea-tab'), o);
  });
  el.querySelector('#mnyConceptClose').addEventListener('click', close);
  el.querySelector('#mnyConceptMore').addEventListener('click', () => {
    close();
    /* Money school is a screen and so is the meeting, so navigating there
       leaves the page behind on its own; ◀ in Money school comes back. A
       sheet would strand her behind a scrim she could not see past. */
    const fromMoney = document.getElementById('screen-mymoney') &&
      document.getElementById('screen-mymoney').classList.contains('active');
    mnyOpenSchool(kid, c.id, fromMoney ? { from: 'mymoney', scrollY: window.scrollY || 0 }
      : (fromMeeting ? { from: 'meeting' } : null));
  });
}
