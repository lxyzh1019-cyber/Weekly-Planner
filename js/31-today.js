// Weekly-Planner — the Today screen.
//
// Why this exists: a child opening this app had to answer "what now?" by reading
// a seven-day grid, then a chore tab, then a money page — three dense surfaces,
// none of which is about right now. The planner is good at a week and had no
// answer for an afternoon.
//
// This screen answers one question and then gets out of the way:
//
//     what am I meant to be doing, and what needs me?
//
// It owns no data and no rules. Every number here is read through the same
// accessors the other screens use (mrChoresForDay, mrWaitingCount, getDayBlocks,
// getUnlockedRoutineRewards…), and every action hands off to the screen that
// already owns it. That is deliberate: a second place that computes money or
// grades a chore is a second place that can disagree with the first.
//
// Invariants it must not break (see CLAUDE.md): a child may create or update a
// claim, never grade or settle; nothing here moves money. Reached from the tab
// bar and from the persistent nav, and it is where a child now lands.
//
// Declarations only. Wiring is in js/99-main.js.

/* Word budget: this screen is subject to the same ≤200 rule as the others
   (tests/smoke.js, kidScreensMeetTheHouseRules). It is built to it rather than
   retrofitted, which is why there is no explanatory copy here — the only prose
   is one encouragement line, and it is short. */

const TD_MAX_CHORES = 4;      // beyond this it stops being "what now" and becomes a list
/* TD_MAX_QUESTS was here. It capped the old summary at three, which is right for
   a teaser and wrong for the list itself — a capped list silently hides a quest
   a child then never does. The whole day shows. */

/* ── Reading the day ─────────────────────────────────────────────────────── */

/* Which slot of the week today is, or null when today is outside the week being
   viewed. Today never depends on weekOffset: it is today. */
function tdTodayIndex() {
  const keys = getDayKeys(0);
  const i = keys.indexOf(todayKey());
  return i >= 0 ? i : null;
}

/* Now, in minutes since midnight — the same unit blocks use. */
function tdNowMin() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/* The block she is in, and the one after it. Reads today's real blocks; sorted
   by start so "next" means next, not "next in the array". */
function tdCurrentAndNext(kid) {
  const key = todayKey();
  const blocks = (getDayBlocks(key, kid) || [])
    .slice()
    .sort((a, b) => (a.startMin || 0) - (b.startMin || 0));
  const now = tdNowMin();
  let current = null, next = null;
  for (const b of blocks) {
    const start = b.startMin || 0;
    const end = start + (b.durationMin || 0);
    if (now >= start && now < end) { current = b; continue; }
    if (start > now && !next) next = b;
  }
  return { current, next, count: blocks.length };
}

/* ── Today's jobs, and why the card was blank ──
   "Jobs I can do" listed only what was still claimable, so the day a child
   actually did everything the card rendered nothing at all — the reward for
   finishing was an empty box. A week whose pool has no unscheduled rows gave
   the same blank for a completely different reason, and neither said which.

   This returns the whole of today with each row's state, so the card can always
   say something true. Read through the accessors the chore screen uses
   (mrGetClaim / mrGetChoreGrade); nothing here decides anything. */
function tdJobsToday(kid) {
  const wk = ctThisWeekKey();
  const d = tdTodayIndex();
  if (d == null) return { rows: [], hasPool: false };
  const { rows } = mrChoresForDay(kid, wk, d);
  return {
    hasPool: rows.length > 0,
    rows: rows.map(r => {
      const grade = mrGetChoreGrade(kid, wk, d, r.row.id);
      const claim = mrGetClaim(kid, wk, d, r.row.id);
      return {
        row: r.row,
        state: grade ? 'answered' : claim ? 'waiting' : 'todo',
      };
    }),
  };
}

/* ── Quiet hours ──
   At nine in the evening with nothing left on the plan, "Nothing scheduled —
   the rest of today is yours" is technically true and useless: the rest of that
   day is bedtime. Between QUIET_HOURS.startMin and the following morning the
   NOW card says so instead. Only when nothing is actually running: a block that
   genuinely runs past nine still wins, because the plan beats the clock. */
function tdInQuietHours() {
  const now = tdNowMin();
  return now >= QUIET_HOURS.startMin || now < QUIET_HOURS.endMin;
}

/* Today's blocks split at "now": what is still to come, then what already
   happened. The list used to run 6am-first all day, so by the afternoon the
   next thing was halfway down the page behind a breakfast nobody needs to look
   at again. Upcoming keeps time order — next is next — and the rest goes below
   a divider that starts closed. */
function tdSplitQuestsByNow(blocks) {
  const now = tdNowMin();
  const upcoming = [], earlier = [];
  blocks.forEach(b => {
    const end = (b.startMin || 0) + (b.durationMin || 0);
    // A block still running counts as upcoming: it is what she is doing now.
    (end > now ? upcoming : earlier).push(b);
  });
  return { upcoming, earlier };
}

/* Closed by default and remembered in localStorage — the house disclosure
   pattern (tdExtrasOpen, mnyPricesOpen, ckPrivsOpen). Never synced state:
   every state write is a full-document upload. */
const TD_EARLIER_LS_KEY = 'wp_td_earlier_open';
function tdEarlierOpen() { return localStorage.getItem(TD_EARLIER_LS_KEY) === '1'; }
function tdToggleEarlier() {
  try { localStorage.setItem(TD_EARLIER_LS_KEY, tdEarlierOpen() ? '0' : '1'); } catch (e) {}
  tdRenderToday();
}

/* Today's quest cards — every scheduled block, done ones included, because a
   finished quest ticked green is the point of the list. Sorted by start so the
   order matches the day. This is the one list of today: the day screen's Quest
   mode used to render it too, and the Quest Board before that. */
function tdQuestsToday(kid) {
  const key = todayKey();
  return (getDayBlocks(key, kid) || [])
    .filter(b => b && b.startMin != null && (b.durationMin || 0) > 0)
    .slice()
    .sort((a, b) => (a.startMin || 0) - (b.startMin || 0));
}

/* One quest card. Structure and classes are the ones Quest mode used, so the
   card keeps its look; the difference is that both targets are data attributes
   read by the delegated listener rather than inline handlers. */
function tdQuestCard(b, kid) {
  const acts = getAllActivities(kid, { includeArchived: true });
  const act = acts.find(a => a.id === b.actId) || { name: 'Quest', icon: '⭐' };
  const topic = act.isTraining ? getTrainingTopic(b.tag) : null;
  const icon = topic ? topic.icon : (act.icon || '⭐');
  const nm = topic
    ? (act.isCompetition ? (topic.id === 'general' ? 'Competition' : topic.name + ' Comp.') : topic.name)
    : (act.name || 'Quest');
  const id = escapeAttr(b.id);
  const done = !!b.completed;
  return `<div class="quest-card${done ? ' quest-done' : ''}">
      <button type="button" class="dq-open" data-td-action="plan" data-td-block="${id}">
        <div class="quest-time-col">
          <div class="quest-time">${escapeHtml(formatQuestTime(b.startMin))}</div>
          ${b.durationMin ? `<div class="quest-dur">${escapeHtml(formatDuration(b.durationMin))}</div>` : ''}
        </div>
        <div class="quest-card-icon">${icon}</div>
        <div class="quest-card-body">
          <div class="quest-card-name">${escapeHtml(nm)}</div>
          <div class="quest-card-meta"><span class="quest-xp-tag">+${QUEST_XP_PER_TASK} XP</span></div>
        </div>
      </button>
      ${done
        ? `<span class="quest-done-badge">✓</span>`
        : `<button type="button" class="quest-complete-btn" data-td-action="blast"
             data-td-block="${id}" aria-label="Complete ${escapeAttr(nm)}" title="Complete it! 🎯">🎯</button>`}
    </div>`;
}

/* The hero strip that used to sit at the top of Quest mode. Numbers, not prose —
   it costs almost nothing against the word budget. */
function tdQuestHero(kid, blocks) {
  const xp = getQuestXP(kid);
  const level = Math.floor(xp / QUEST_XP_PER_LEVEL) + 1;
  const tier = heroTierForLevel(level);
  const into = xp % QUEST_XP_PER_LEVEL;
  const pct = Math.round(into / QUEST_XP_PER_LEVEL * 100);
  const done = blocks.filter(b => b.completed).length;
  return `<div class="dq-hero">
      <div class="dq-hero-avatar">${tier.emoji}</div>
      <div class="dq-hero-info">
        <div class="dq-hero-title">Lv ${level} · ${escapeHtml(tier.name)}</div>
        <div class="dq-xp-bar"><div class="dq-xp-fill" style="width:${pct}%"></div></div>
        <div class="dq-hero-sub">${done}/${blocks.length} done · ${into}/${QUEST_XP_PER_LEVEL} XP</div>
      </div>
    </div>`;
}

/* One line, chosen from what actually happened rather than at random — an
   encouragement that ignores the day is noise. Off days are a valid state
   (CLAUDE.md), so a rest day gets its own line and a blank day is never framed
   as a failure. */
function tdEncouragement(kid) {
  const wk = ctThisWeekKey();
  const d = tdTodayIndex();
  if (d == null) return 'Today is not in the week you are looking at.';
  if (typeof isRestDay === 'function' && isRestDay(todayKey(), kid)) {
    return 'Rest day. Resting counts — nothing here is waiting on you.';
  }
  const fresh = (typeof mrNewlyGraded === 'function') ? mrNewlyGraded(kid, wk) : [];
  if (fresh.length) return `Mum answered ${fresh.length === 1 ? 'something' : fresh.length + ' things'}. Have a look.`;
  const waiting = mrWaitingCount(kid, wk);
  if (waiting) return `${waiting} ${waiting === 1 ? 'job is' : 'jobs are'} with Mum. Nothing else to do about ${waiting === 1 ? 'it' : 'them'}.`;
  const { current, next, count } = tdCurrentAndNext(kid);
  if (current) return 'You are in the middle of something. Keep going.';
  if (next) return 'Nothing right now. Next thing is coming up.';
  if (count) return 'Everything on today is done. That is the whole day.';
  return 'Nothing planned today. A quiet day is allowed.';
}

/* ── Rendering ───────────────────────────────────────────────────────────── */

function tdBlockLine(b, kid) {
  const act = findActivity(b.actId, kid);
  const icon = (act && act.icon) || '📌';
  const name = (act && act.name) || 'Something';
  const time = (typeof formatTimeFromMin === 'function') ? formatTimeFromMin(b.startMin || 0) : '';
  return { icon, name, time };
}

function tdRenderToday() {
  const wrap = document.getElementById('tdWrap');
  if (!wrap) return;
  const kid = activeProfile();
  const badge = document.getElementById('todayProfileBadge');
  if (badge) badge.textContent = kid === 'jenn' ? '🐥 Jenn' : kid === 'jess' ? '🦊 Jess' : '';
  if (!kid || kid === 'parent') {
    wrap.innerHTML = `<div class="td-card"><div class="td-cap">Today</div>
      <div class="td-empty">Pick a profile to see the day.</div></div>`;
    return;
  }
  ctPrepareRead();
  /* The panels moved off the day timeline — vibe, to-dos, goals, breaks — all
     read the global currentDayKey, which the day screen owns and sets in
     openDay. On Today that day is today, by definition. Point it here so a mood
     set from this screen lands on today rather than on whichever day happened to
     be open last. Any entry to the day screen sets it again. */
  currentDayKey = todayKey();
  const wk = ctThisWeekKey();
  const d = tdTodayIndex();
  const { current, next } = tdCurrentAndNext(kid);
  const quests = tdQuestsToday(kid);
  const waiting = d == null ? 0 : mrWaitingCount(kid, wk);
  const fresh = (d == null || typeof mrNewlyGraded !== 'function') ? [] : mrNewlyGraded(kid, wk);

  // NOW — the one thing the screen exists for.
  let nowHtml;
  if (current) {
    const l = tdBlockLine(current, kid);
    nowHtml = `<div class="td-now-icon">${l.icon}</div>
      <div><div class="td-now-name">${escapeHtml(l.name)}</div>
        <div class="td-now-sub">now · started ${escapeHtml(l.time)}</div></div>`;
  } else if (next) {
    const l = tdBlockLine(next, kid);
    nowHtml = `<div class="td-now-icon">${l.icon}</div>
      <div><div class="td-now-name">${escapeHtml(l.name)}</div>
        <div class="td-now-sub">next · ${escapeHtml(l.time)}</div></div>`;
  } else if (tdInQuietHours()) {
    /* Nine at night with nothing left on the plan. "The rest of today is yours"
       is true and useless — the rest of that day is sleep. */
    nowHtml = `<div class="td-now-icon">🌙</div>
      <div><div class="td-now-name">Winding down</div>
        <div class="td-now-sub">nothing left tonight — rest is the plan</div></div>`;
  } else {
    nowHtml = `<div class="td-now-icon">🌤️</div>
      <div><div class="td-now-name">Nothing scheduled</div>
        <div class="td-now-sub">the rest of today is yours</div></div>`;
  }

  // Chores she can answer for, each with what it would be worth. A tap opens the
  // chore screen at today — the claim is made there, in the one place that owns
  // it. The price is read from mrChoreWouldPay (js/18-rules.js), which owns
  // chore pricing; nothing here works out what a chore pays.
  const pay = (d == null) ? null : mrChoreWouldPay(kid, wk, d);
  const payTag = pay
    ? (pay.capReached
        ? `<span class="td-row-pay xp">+XP</span>`
        : `<span class="td-row-pay">up to ${mnyMoney(pay.amount)}</span>`)
    : '';
  /* Every job on today, with where each one has got to — not only the ones
     still claimable. Filtering to claimable meant the card went blank on the
     day she finished everything, which is the day it should have most to say,
     and blank again on a week with no pool for an entirely different reason.
     A card that says nothing cannot be read; these three states can. */
  const jobs = tdJobsToday(kid);
  const jobIcon = id => (typeof ctChoreIcon === 'function' ? ctChoreIcon(id) : '🧹');
  const jobRows = jobs.rows.slice(0, TD_MAX_CHORES + 2).map(j => {
    if (j.state === 'todo') {
      return `<button type="button" class="td-row" data-td-action="chore">
          <span class="td-row-icon">${jobIcon(j.row.id)}</span>
          <span class="td-row-name">${escapeHtml(j.row.label)}</span>
          ${payTag}
          <span class="td-row-go">Do it ›</span>
        </button>`;
    }
    // Class names written out rather than built from a ternary: the dead-CSS
    // check matches literal strings, and a class it cannot see is a class it
    // reports as dead.
    const done = j.state === 'answered';
    const cls = done ? 'td-row td-row--done' : 'td-row td-row--waiting';
    return `<button type="button" class="${cls}" data-td-action="${done ? 'fresh' : 'waiting'}">
        <span class="td-row-icon">${done ? '✓' : '⏳'}</span>
        <span class="td-row-name">${escapeHtml(j.row.label)}</span>
        <span class="td-row-go">${done ? 'done' : 'with Mum'}</span>
      </button>`;
  }).join('');
  const choreHtml = jobRows || (jobs.hasPool
    ? `<div class="td-empty">All today's jobs are done ✓</div>`
    : `<div class="td-empty">No jobs set up for this week yet.</div>`);

  /* An empty day offers to be filled, and the offer is the thing you tap.
     This read "Tap ✏️ Plan my day to build one", pointing at a button in the
     static row below — an instruction to go and find a control is a worse
     affordance than the control, and it costs more words on a screen held to
     200 with no ratchet. The permanent button stays for a day that already has
     a plan; this is the door on the day that has none. */
  /* Next at the top. The list ran in plain time order, so from mid-morning
     onward the thing she was about to do sat below a breakfast she had already
     eaten — the top of the screen was about the past. Upcoming first, still in
     time order so "next" is genuinely next; everything already finished drops
     below a divider that starts closed. */
  const split = tdSplitQuestsByNow(quests);
  const earlierOpen = tdEarlierOpen();
  const questHtml = quests.length
    ? `${split.upcoming.length
          ? `<div class="dq-list">${split.upcoming.map(b => tdQuestCard(b, kid)).join('')}</div>`
          : `<div class="td-empty">That is the whole day done.</div>`}
       ${split.earlier.length
          ? `<button type="button" class="td-fold-btn td-earlier-btn" data-td-action="earlier">
               ${earlierOpen ? '▾' : '▸'} Earlier today (${split.earlier.length})
             </button>
             ${earlierOpen ? `<div class="dq-list">${split.earlier.map(b => tdQuestCard(b, kid)).join('')}</div>` : ''}`
          : ''}`
    : `<button type="button" class="td-row td-plan" data-td-action="plan">
         <span class="td-row-icon">✏️</span>
         <span class="td-row-name">Nothing planned — build a day?</span>
         <span class="td-row-go">Plan it ›</span>
       </button>`;

  // The loop back from a grown-up. Same counts the chore screen shows, so the two
  // can never disagree.
  let loopHtml = '';
  if (fresh.length) {
    loopHtml += `<button type="button" class="td-chip td-chip-fresh" data-td-action="fresh">
      ✨ <b>${fresh.length}</b> answered</button>`;
  }
  if (waiting) {
    loopHtml += `<button type="button" class="td-chip" data-td-action="waiting">
      ⏳ <b>${waiting}</b> with Mum</button>`;
  }

  /* ── Pocket money ──
     Cash, what she owes, and what is still on the table today. It sits after
     the jobs list because it answers "was that worth it?", which is the
     question that follows the jobs rather than the one before them.

     Three readers and nothing else: mnyCash and mnyTotalOwing are the same
     accessors the money page uses, and mnyEarnLeftToday is the very function
     mnyTodayCard reads — extracted precisely so this row could not become a
     second answer to it. The whole row taps through to My money; nothing here
     spends, claims or settles. */
  const moneyHtml = tdMoneyChart(kid, wk);

  /* The evening wind-down nudge, carried over from the day timeline's banner —
     age-based, so it only appears once an age is set. */
  const nowH = new Date().getHours();
  const age = getProfData(kid)?.age;
  const bedtime = (nowH >= 18 && age != null && typeof bedtimeReminderText === 'function')
    ? bedtimeReminderText(age) : null;

  wrap.innerHTML = `
    <div class="td-card td-now">${nowHtml}</div>
    ${loopHtml ? `<div class="td-chips">${loopHtml}</div>` : ''}
    ${tdQuestHero(kid, quests)}
    <div class="td-card">
      <div class="td-cap">On today</div>${questHtml}</div>
    <div class="td-card">
      <div class="td-cap">Jobs I can do</div>${choreHtml}</div>
    <div class="td-card">
      <div class="td-cap">My money</div>${moneyHtml}</div>
    <div class="td-say">${escapeHtml(tdEncouragement(kid))}</div>
    ${bedtime ? `<div class="bedtime-tip">${escapeHtml(bedtime)}</div>` : ''}`;

  /* The relocated panels are static siblings of the wrap, so they survive this
     re-render and only need their own renderers run. Each is the function that
     already owned that data on the day screen — called, not reimplemented. */
  tdApplyExtras();
  if (typeof renderVibe === 'function') renderVibe();
  if (typeof renderDayGoalsTodos === 'function') renderDayGoalsTodos();
  if (typeof maybeShowRewardPrompt === 'function') maybeShowRewardPrompt();
}

/* ── Money, as a picture ──
   This was three tiles of words and figures — "Cash $4.20 / I owe $2.00 /
   Still to earn $1.50" — which is a table, and a table is the slowest way to
   answer "how am I doing". Two pictures instead:

   A stacked bar for where her money IS right now (cash · kept ready · locked ·
   invested), because the shape of that bar is the whole financial-literacy
   lesson — a bar that is all cash looks different from one that is mostly
   saved, and she can see which is which without reading a number.

   A sparkline underneath for how the total has moved, week by week, once there
   are enough settled weeks for a line to mean anything. Below three it is a
   shape drawn from noise, so it simply is not there.

   Reads only. mnyCash / mnySavedTotal / mnyLockedTotal / mnyInvestedTotal and
   mnyTotalOwing are the same accessors My money uses, so the two can never
   disagree; the row taps through to that page, and nothing here moves money. */
const TD_MONEY_SEGMENTS = [
  { key: 'cash',   label: 'Cash',       colour: 'var(--cat-daily)' },
  { key: 'saved',  label: 'Kept ready', colour: 'var(--cat-free)' },
  { key: 'locked', label: 'Locked',     colour: 'var(--cat-school)' },
  { key: 'stock',  label: 'Invested',   colour: 'var(--cat-custom)' },
];

/* Everything she has, per pot. */
function tdMoneyParts(kid) {
  return {
    cash:   mnyCash(kid),
    saved:  mnySavedTotal(kid),
    locked: mnyLockedTotal(kid),
    stock:  mnyInvestedTotal(kid),
  };
}

/* What she was worth at the end of each settled week, oldest first. Built from
   the frozen ledger rather than recomputed — history is a record, not a
   recomputation (js/15-meeting.js says the same about the ledger itself). */
function tdMoneyHistory(kid) {
  ctEnsureShared();
  const fin = state.shared.chore.finalizedWeeks || {};
  const weeks = Object.keys(fin).filter(wk => fin[wk] && fin[wk][kid] != null).sort();
  let running = 0;
  return weeks.map(wk => { running = money2(running + Number(fin[wk][kid] || 0)); return { wk, total: running }; });
}

const TD_MONEY_SPARK_MIN_WEEKS = 3;   // below this a line is drawn from noise

function tdMoneyChart(kid, wk) {
  const parts = tdMoneyParts(kid);
  const total = money2(parts.cash + parts.saved + parts.locked + parts.stock);
  const owing = mnyTotalOwing(kid);
  const segs = TD_MONEY_SEGMENTS
    .map(s => ({ ...s, amount: money2(parts[s.key]) }))
    .filter(s => s.amount > 0);

  const bar = total > 0
    ? `<span class="td-bar">${segs.map(s => `<span class="td-bar-seg" style="width:${(s.amount / total * 100).toFixed(2)}%;background:${s.colour}"
            title="${escapeAttr(s.label + ' ' + mnyMoney(s.amount))}"></span>`).join('')}</span>`
    : `<span class="td-bar td-bar--empty"></span>`;

  // The key doubles as the numbers, so the picture needs no separate table.
  const key = segs.map(s => `<span class="td-key">
      <span class="td-key-dot" style="background:${s.colour}"></span>
      ${escapeHtml(s.label)} ${escapeHtml(mnyMoney(s.amount))}</span>`).join('');

  const hist = tdMoneyHistory(kid);
  const spark = hist.length >= TD_MONEY_SPARK_MIN_WEEKS ? tdMoneySparkline(hist) : '';

  /* The one figure on this card she can act on today, and the only reason it
     survives the move from tiles to a picture: "I can still earn $2.00" is a
     reason to go and do the bins. mnyEarnLeftToday is the very function
     mnyTodayCard reads — extracted so this line could not become a second
     answer to it. */
  const earn = mnyEarnLeftToday(kid, wk);
  const earnLine = earn.left == null
    ? `Earned today ${mnyMoney(earn.done)}`
    : `Still to earn today ${mnyMoney(earn.left)}`;

  return `<button type="button" class="td-money" data-td-action="money">
      <span class="td-money-total">${escapeHtml(mnyMoney(total))}${owing > 0
        ? ` <span class="td-money-owing">owes ${escapeHtml(mnyMoney(owing))}</span>` : ''}</span>
      ${bar}
      <span class="td-keys">${key || '<span class="td-key">Nothing yet</span>'}</span>
      <span class="td-money-earn">${escapeHtml(earnLine)}</span>
      ${spark}
    </button>`;
}

/* Inline SVG, no library, no external anything — the page is loaded over
   file:// by the smoke suite and served from GitHub Pages otherwise.
   preserveAspectRatio="none" so it stretches to whatever width the card is. */
function tdMoneySparkline(hist) {
  const vals = hist.map(h => h.total);
  const max = Math.max(...vals), min = Math.min(...vals, 0);
  const span = (max - min) || 1;
  const pts = vals.map((v, i) => {
    const x = vals.length === 1 ? 0 : (i / (vals.length - 1)) * 100;
    const y = 20 - ((v - min) / span) * 20;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  return `<span class="td-spark" aria-hidden="true">
      <svg viewBox="0 0 100 20" preserveAspectRatio="none" focusable="false">
        <polyline points="${pts}" fill="none" stroke="var(--accent-strong)" stroke-width="1.6"
                  stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      </svg>
      <span class="td-spark-cap">${hist.length} settled weeks</span>
    </span>`;
}

/* Vibe, to-dos and goals sit behind one toggle: they are reference panels, and
   Today's 200-word budget is for what a child needs at a glance. Closed by
   default, remembered in localStorage — never synced state, because every state
   write is a full-document upload. */
const TD_EXTRAS_LS_KEY = 'wp_td_extras_open';
function tdExtrasOpen() { return localStorage.getItem(TD_EXTRAS_LS_KEY) === '1'; }
function tdToggleExtras() {
  try { localStorage.setItem(TD_EXTRAS_LS_KEY, tdExtrasOpen() ? '0' : '1'); } catch (e) {}
  tdApplyExtras();
}
function tdApplyExtras() {
  const body = document.getElementById('tdExtrasBody');
  const btn = document.getElementById('tdExtrasBtn');
  if (!body || !btn) return;
  const open = tdExtrasOpen();
  body.style.display = open ? '' : 'none';
  btn.textContent = open ? 'Vibe, to-dos and goals ▾' : 'Vibe, to-dos and goals ▸';
}

/* One delegated listener, bound once in js/99-main.js, so re-rendering cannot
   lose it and no user text is ever interpolated into an inline handler.

   Today is now the screen where a day gets done, so 'blast' does change state —
   but through completeQuest, the one function that already owned completion, XP
   and sticker counting. Invoking the owner is the rule; containing a second copy
   of it is what CLAUDE.md forbids. Everything else here still just navigates. */
function tdHandleClick(e) {
  const el = e.target.closest('[data-td-action]');
  if (!el || el.disabled) return;
  const a = el.getAttribute('data-td-action');
  const d = tdTodayIndex();
  if (a === 'chore')   { openChoreTab(); if (d != null) ckSelectDay(d); return; }
  if (a === 'waiting') { openChoreTab(); ckGoWaiting(); return; }
  if (a === 'fresh')   { openChoreTab(); ckGoFresh(); return; }
  if (a === 'earlier') { tdToggleEarlier(); return; }
  if (a === 'week')    { goWeek(); return; }
  if (a === 'money')   { openWeekMoney(); return; }
  // 🎯 — the arcade completion, unchanged, on today's block.
  if (a === 'blast')   { blastQuest(el.getAttribute('data-td-block'), el, todayKey()); return; }
  /* Open today for planning. openDayFromWeekCard, not openDay: Today never
     depends on weekOffset (it is today) but the day screen does, and the wrapper
     resolves the offset for a given day key. The optional block id feeds the
     existing focusBlockOnTimeline path, so a card opens at the block tapped. */
  if (a === 'plan') {
    if (d == null) { goWeek(); return; }
    openDayFromWeekCard(todayKey(), d, el.getAttribute('data-td-block') || null);
    return;
  }
}

function goToday() {
  showScreen('today');
  tdRenderToday();
}

/* ── The four-destination nav ─────────────────────────────────────────────────
   Today · Week · Money · More.

   One fixed element outside the screens rather than a copy of the same markup in
   each: six kid screens each carrying their own nav row is six places for the
   nav to drift, and the old topbar row proved it — the same five buttons were
   pasted into three screens with slightly different labels.

   Every existing route still works and every old button still exists. This adds a
   way to move between the four places that matter without retiring anything;
   Branch 6 is where the duplicates go. */
const TD_NAV = [
  { id: 'today', icon: '☀️', label: 'Today', screen: 'screen-today' },
  { id: 'week',  icon: '📋', label: 'Week',  screen: 'screen-week' },
  { id: 'money', icon: '💰', label: 'Money', screen: 'screen-mymoney' },
  { id: 'more',  icon: '⋯',  label: 'More',  screen: null },
];
/* Screens that belong to a child. The nav is hidden everywhere else — a parent
   in the portal does not need a child's bottom bar, and the profile picker is
   where you go to stop being a child. */
const TD_NAV_SCREENS = ['screen-today', 'screen-week', 'screen-mymoney', 'screen-chore',
                        'screen-day', 'screen-sync', 'screen-moneystory',
                        'screen-moneyschool'];

function tdRenderNav() {
  const nav = document.getElementById('kidNav');
  if (!nav) return;
  const active = document.querySelector('.screen.active');
  const kid = activeProfile();
  const show = !!active && TD_NAV_SCREENS.includes(active.id) &&
               (kid === 'jenn' || kid === 'jess') && !isParent();
  nav.hidden = !show;
  if (!show) { document.body.classList.remove('has-kid-nav'); return; }
  document.body.classList.add('has-kid-nav');
  nav.innerHTML = TD_NAV.map(d => {
    const on = d.screen === active.id;
    return `<button type="button" class="kid-nav-btn${on ? ' on' : ''}"
        data-td-nav="${d.id}"${on ? ' aria-current="page"' : ''}>
        <span class="kid-nav-icon" aria-hidden="true">${d.icon}</span>
        <span class="kid-nav-label">${escapeHtml(d.label)}</span>
      </button>`;
  }).join('');
}

/* "More" is everything that is not one of the three. A sheet rather than a
   screen: it is a menu, and a menu you can dismiss beats a place you have to
   navigate back out of. */
function tdOpenMore() {
  /* Tiles, not rows. Seven full-width rows filled most of a phone screen for a
     menu of seven short words — a stack of buttons whose text is two words each
     is a list pretending to be a page. Three across says the same in a third of
     the height, and every tile is still its own 44px target.

     Quests is gone with the Quest Board: it opened the fourth rendering of
     today's list, and Today is the list. */
  const items = [
    { icon: '🧹', label: 'Chores',       go: 'chores' },
    { icon: '👯', label: 'Sisters',      go: 'sisters' },
    { icon: '📖', label: 'Money story',  go: 'story' },
    { icon: '🎓', label: 'Money school', go: 'school' },
    { icon: '🖨', label: 'Print',        go: 'print' },
    { icon: '◀',  label: 'Switch',       go: 'profile' },
  ];
  let ov = document.getElementById('tdMoreOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'overlay';
    ov.id = 'tdMoreOverlay';
    ov.addEventListener('click', ev => {
      if (ev.target === ov) { ov.classList.remove('open'); return; }
      const b = ev.target.closest('[data-td-more]');
      if (!b) return;
      ov.classList.remove('open');
      tdGoMore(b.getAttribute('data-td-more'));
    });
    document.body.appendChild(ov);
  }
  ov.innerHTML = `<div class="sheet td-more-sheet" role="dialog" aria-modal="true" aria-label="More places to go">
      <div class="sheet-handle"></div>
      <div class="td-cap">More</div>
      <div class="td-more-grid">
        ${items.map(i => `<button type="button" class="td-more-tile" data-td-more="${i.go}">
            <span class="td-more-icon" aria-hidden="true">${i.icon}</span>
            <span class="td-more-label">${escapeHtml(i.label)}</span>
          </button>`).join('')}
      </div>
    </div>`;
  ov.classList.add('open');
}
function tdGoMore(where) {
  if (where === 'chores')  { openChoreTab(); return; }
  if (where === 'sisters') { openSisterSync(); return; }
  if (where === 'story')   { mnyOpenStory(); return; }
  if (where === 'school')  { if (typeof mnyOpenSchool === 'function') mnyOpenSchool(); return; }
  if (where === 'print')   { openPrint(); return; }
  if (where === 'profile') { goProfile(); return; }
}
function tdHandleNavClick(e) {
  const el = e.target.closest('[data-td-nav]');
  if (!el) return;
  const d = el.getAttribute('data-td-nav');
  if (d === 'today') { goToday(); return; }
  if (d === 'week')  { goWeek(); return; }
  // openWeekMoney, not mnyOpenMyMoney directly: it resolves whose money page
  // this is, which is not always the active profile.
  if (d === 'money') { openWeekMoney(); return; }
  if (d === 'more')  { tdOpenMore(); return; }
}
