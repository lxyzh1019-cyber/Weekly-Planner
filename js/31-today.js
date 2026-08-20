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
   a child then never does. The whole day shows.

   That still holds, and TD_UP_NEXT is not a return to it. A ten-block day put
   ten cards on the screen and Today was a list again, which is the thing it
   exists to stop — so what is running plus the next TD_UP_NEXT are loud, and the
   REST OF THE DAY IS STILL THERE, one tap away behind "Later today". A cap
   deletes; a disclosure defers. The difference is whether she can get to it. */
const TD_UP_NEXT = 2;
/* Free time is a thing on the list, not the absence of things: "you have an hour
   and a half" is an answer to "what now". Under half an hour is turnaround —
   naming it would make the list busier, which is the opposite of the point. */
const TD_FREE_MIN = 30;

/* ── Reading the day ─────────────────────────────────────────────────────── */

/* Which slot of the week today is, or null when today is outside the week being
   viewed. Today never depends on weekOffset: it is today. */
function tdTodayIndex() {
  const keys = getDayKeys(0);
  const i = keys.indexOf(todayKey());
  return i >= 0 ? i : null;
}

/* Now, in minutes since midnight — the same unit blocks use, and the same zone
   todayKey uses. Read through nowMinutesInZone so the time of day cannot drift
   away from the date on a device whose clock is set to somewhere else. */
function tdNowMin() {
  return nowMinutesInZone();
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
/* The other end of the same day. Same idiom, its own key — closing the morning
   and closing the evening are different decisions. */
const TD_LATER_LS_KEY = 'wp_td_later_open';
function tdLaterOpen() { return localStorage.getItem(TD_LATER_LS_KEY) === '1'; }
function tdToggleLater() {
  try { localStorage.setItem(TD_LATER_LS_KEY, tdLaterOpen() ? '0' : '1'); } catch (e) {}
  tdRenderToday();
}

/* ── What she has to do before the next thing starts ──
   A block can carry travel, get-ready and warm-up time, and the app has always
   known how to turn that into instructions — wfBufferSegments works out the
   segments, bufferSegLabels words them ("🚗 Leave by 5:00pm (30m)"). The week
   grid, the Full week and the print sheet all read them. Today, the one screen a
   child actually looks at before leaving the house, never mentioned them.

   So: call the owner. The arithmetic and the wording both stay in
   js/07-week-view.js, which is why the "leave by" on Today cannot drift from the
   "leave by" on the week. This only picks the pre-side segments, sorts them, and
   works out which of them binds first.

   Returns null for a block with no buffers set — most blocks — so the card stays
   quiet unless there is genuinely something to be early for. */
function tdPrepFor(block) {
  if (!block || typeof wfBufferSegments !== 'function') return null;
  const pre = wfBufferSegments(block)
    .filter(s => s.side === 'pre')
    .sort((a, b) => a.startRel - b.startRel);
  if (!pre.length) return null;
  return {
    moveByMin: pre[0].startRel + START_MIN,
    steps: pre.map(s => bufferSegLabels(s, 'long')),
  };
}

/* ── When does a block start needing her? ──
   Swimming at four o'clock does not mean leaving the house at four o'clock: with
   ten minutes of kit and fifteen in the car, the first minute she has to do
   something is 3:35. A card that leads with 4:00 names a time she is already
   late for.

   This is the one place that question is answered, so the card's time, the
   order of the list and the free-time trim in tdUpcomingTimeline all read the
   same number and cannot drift apart. It delegates to tdPrepFor, which
   delegates to wfBufferSegments (js/07-week-view.js) — the same arithmetic the
   week grid and the print sheet use, so Today can never disagree with them
   about when to leave.

   The block's own startMin for anything without buffers, which is most of them. */
function tdActionableStart(b) {
  if (!b) return 0;
  const prep = tdPrepFor(b);
  const start = b.startMin || 0;
  return prep ? Math.min(prep.moveByMin, start) : start;
}

/* ── A gap that is a break, not free time ──
   The two must never describe the same stretch. tdUpcomingTimeline already
   renders anything from TD_FREE_MIN up as a free-time card, so a break is
   strictly what falls below it — long enough to notice (TD_BREAK_MIN), short
   enough that it is turnaround rather than an afternoon.

   Measured to the moment the next thing starts needing her, not to its start
   time: a fifteen-minute gap before a block she has to leave for ten minutes
   early is a five-minute break, and saying otherwise is the screen promising
   time that does not exist. Returns null when there is no break to name. */
const TD_BREAK_MIN = 10;
function tdGapBefore(current, next) {
  if (!current || !next) return null;
  const end = (current.startMin || 0) + (current.durationMin || 0);
  const mins = tdActionableStart(next) - end;
  if (mins < TD_BREAK_MIN || mins >= TD_FREE_MIN) return null;
  return mins;
}

/* "8:15–9:00am", and "11:30am–12:15pm" only when the two halves of the day
   actually differ. Repeating am on both ends of a range costs two characters in
   the tightest line on the screen and tells a child nothing she did not know. */
function tdTimeRange(startMin, endMin) {
  const a = formatTimeFromMin(startMin), b = formatTimeFromMin(endMin);
  const ap = s => s.slice(-2);
  return ap(a) === ap(b) ? a.slice(0, -2) + '–' + b : a + '–' + b;
}

/* Is she on a break right now, and how much of it is left?

   Only between two blocks: the stretch from the end of the last thing to the
   moment the next one starts needing her. Bounded by tdGapBefore, so it is a
   break exactly when the list would draw a break connector there and never when
   the list would draw a free-time card — the hero and the list describe the same
   gap the same way. Returns null the rest of the time, including before the
   day's first block, which is morning rather than a break.

   pct counts UP so the bar fills as the break runs out, matching the running
   block's bar rather than inverting it. */
function tdBreakNow(blocks, next) {
  if (!next) return null;
  const now = tdNowMin();
  const startsNeedingHer = tdActionableStart(next);
  if (now >= startsNeedingHer) return null;
  let prev = null;
  blocks.forEach(b => {
    if (b.id === next.id) return;
    const end = (b.startMin || 0) + (b.durationMin || 0);
    if (end <= now && (!prev || end > (prev.startMin || 0) + (prev.durationMin || 0))) prev = b;
  });
  if (!prev) return null;
  const mins = tdGapBefore(prev, next);
  if (!mins) return null;
  const elapsed = Math.max(0, mins - (startsNeedingHer - now));
  return { mins, leftMin: startsNeedingHer - now, pct: Math.round(elapsed / mins * 100) };
}

/* How far through the block she is, and how much is left. Pure arithmetic on
   the numbers the block already carries — nothing stored, nothing decided. */
function tdHeroProgress(b) {
  const start = b.startMin || 0;
  const dur = Math.max(1, b.durationMin || 0);
  const elapsed = Math.min(dur, Math.max(0, tdNowMin() - start));
  return {
    pct: Math.round(elapsed / dur * 100),
    leftMin: Math.max(0, dur - elapsed),
    range: tdTimeRange(start, start + dur),
  };
}

/* Today's quest cards — every scheduled block, done ones included, because a
   finished quest ticked green is the point of the list. Sorted by start so the
   order matches the day. This is the one list of today: the day screen's Quest
   mode used to render it too, and the Quest Board before that. */
/* Sorted by tdActionableStart, not by startMin. A 6:30 skate she has to leave
   for at 5:50 belongs where 5:50 belongs — sorting by the block's own start put
   it under a six o'clock block she would already have left the house for.
   startMin breaks the tie so two blocks that need her at the same minute still
   run in the order the day does. */
function tdQuestsToday(kid) {
  const key = todayKey();
  return (getDayBlocks(key, kid) || [])
    .filter(b => b && b.startMin != null && (b.durationMin || 0) > 0)
    .slice()
    .sort((a, b) => (tdActionableStart(a) - tdActionableStart(b))
      || ((a.startMin || 0) - (b.startMin || 0)));
}

/* Which of today's blocks clash, and with what. One call to the owner
   (computeBufferConflicts, js/03-sync.js) per render, and the answer is a Map
   from block id to the NAME of the first activity it runs into — named through
   tdBlockLabel, so a clashing block is called the same thing here as it is on
   its own card. Empty map when the day works, which is most days. */
function tdClashes(kid, blocks) {
  const out = new Map();
  if (typeof computeBufferConflicts !== 'function') return out;
  const { affected, partners } = computeBufferConflicts(blocks);
  if (!affected || !affected.size) return out;
  const byId = new Map(blocks.map(b => [b.id, b]));
  affected.forEach(id => {
    const others = (partners && partners.get(id)) || new Set();
    const first = [...others].map(oid => byId.get(oid)).filter(Boolean)
      .sort((a, b) => (a.startMin || 0) - (b.startMin || 0))[0];
    out.set(id, first ? tdBlockLabel(first, kid).name : 'another activity');
  });
  return out;
}

/* The rest of today, as a child experiences it: the things she has to do AND the
   spaces between them. A gap is not the absence of an item, it is an item — an
   afternoon with nothing in it until 4pm is the answer to "what now", and a list
   that only names blocks cannot say it.

   Gaps come from dayGaps (js/05-helpers.js), the one place a day's free stretches
   are worked out. Nothing here is stored: a free-time entry has no id and no
   state, it is a description of the hole between two blocks. `tdQuestsToday`
   stays the only reader of what the day actually contains. */
/* currentId is the block she is in. It is excluded from the list because the
   hero already IS it — the screen used to render the running block twice, once
   as a hero with a tick and once as a card with a tick, which is two controls
   for one action and two chances to disagree about its state. The hero owns it;
   this is the window onto what comes after. */
function tdUpcomingTimeline(kid, upcomingBlocks, currentId) {
  const now = tdNowMin();
  const items = upcomingBlocks
    .filter(b => !currentId || b.id !== currentId)
    .map(b => ({ kind: 'block', startMin: tdActionableStart(b), block: b }));
  /* Only gaps that are still ahead, and only from now — the hour before lunch is
     not free time at four in the afternoon. A gap that has already started
     counts from now, so "free until 4pm" stays true as the afternoon runs down.

     FREE TIME IS THE SPACE BEFORE SOMETHING, so a gap has to end at a block.
     dayGaps also returns the stretch after the last block, which runs to 10pm —
     "🌤 Free time 3:00pm–10:00pm (7h)" is not information, it is the plan being
     over, and the NOW card and the plan button already say that better. */
  /* And it ends when GETTING READY starts, not when the block does. A 5pm skate
     with fifteen minutes of kit, half an hour in the car and a warm-up is not
     something a child is free until 5 o'clock for — she is free until 3:55. The
     card said "free until 5:00pm" directly under a NOW card saying "be moving by
     3:55pm", which is the screen contradicting itself about the only number on
     it that matters. The buffers are commitments, so they close the gap. */
  const claimedFrom = new Map();
  upcomingBlocks.forEach(b => {
    const prep = tdPrepFor(b);
    claimedFrom.set(b.startMin || 0, prep ? Math.min(prep.moveByMin, b.startMin || 0) : (b.startMin || 0));
  });
  dayGaps(todayKey(), kid, TD_FREE_MIN, now).forEach(g => {
    if (!claimedFrom.has(g.endMin)) return;
    const endMin = claimedFrom.get(g.endMin);
    const durationMin = endMin - g.startMin;
    // Trimming can take a gap under the threshold, and then it was never free
    // time — it was the run-up to the next thing.
    if (durationMin < TD_FREE_MIN) return;
    items.push({ kind: 'free', startMin: g.startMin, gap: { startMin: g.startMin, endMin, durationMin } });
  });
  items.sort((a, b) => a.startMin - b.startMin);

  /* Breaks, threaded between the blocks they sit between. Strictly shorter than
     TD_FREE_MIN (tdGapBefore enforces it), so a stretch is either a break or a
     free-time card and never both — two descriptions of one gap is how a screen
     starts contradicting itself. A break is a connector, not an item: it carries
     no id, no state and nothing to tick. */
  const out = [];
  items.forEach((it, i) => {
    const prev = items[i - 1];
    if (prev && prev.kind === 'block' && it.kind === 'block') {
      const mins = tdGapBefore(prev.block, it.block);
      if (mins) out.push({ kind: 'break', startMin: it.startMin, mins });
    }
    out.push(it);
  });
  return out;
}

/* The break between two blocks, drawn as a connector rather than a card: it is
   a fact about the space between two things she has to do, not a third thing.
   No id, no state, nothing to tick, and not focusable — one action, one control. */
function tdBreakConnector(mins) {
  return `<div class="td-gap-break">
      <span class="td-gap-dots" aria-hidden="true"></span>
      <span class="td-break-chip">☕ ${escapeHtml(formatDuration(mins))} break</span>
    </div>`;
}

/* Where the loud part of the list ends, counting only the things she has to do.
   A break connector rides along with the block it precedes and never spends a
   slot of its own — three cards means three cards, however many gaps sit
   between them. */
function tdLoudSlice(items, want) {
  let n = 0, i = 0;
  for (; i < items.length; i++) {
    if (items[i].kind !== 'break') {
      if (n === want) break;
      n++;
    }
  }
  // Never end the loud part on a dangling connector pointing at a folded card.
  while (i > 0 && items[i - 1].kind === 'break') i--;
  return i;
}

/* A stretch of nothing, offered rather than reported. Taps through to the day
   screen on the same action a block card uses, because the useful thing to do
   with an empty afternoon is decide what goes in it. */
function tdFreeCard(gap) {
  return `<div class="quest-card quest-card--free">
      <button type="button" class="dq-open" data-td-action="plan">
        <div class="quest-time-col">
          <div class="quest-time">${escapeHtml(formatQuestTime(gap.startMin))}</div>
          <div class="quest-dur">${escapeHtml(formatDuration(gap.durationMin))}</div>
        </div>
        <div class="quest-card-icon">🌤</div>
        <div class="quest-card-body">
          <div class="quest-card-name">Free time</div>
          <div class="quest-card-meta">until ${escapeHtml(formatTimeFromMin(gap.endMin))}</div>
        </div>
      </button>
    </div>`;
}

/* One quest card. Structure and classes are the ones Quest mode used, so the
   card keeps its look; the difference is that both targets are data attributes
   read by the delegated listener rather than inline handlers. */
/* isNext marks the T2 card — the block she moves to when this one closes. It is
   the same block the NOW card names under NEXT, read from the same
   tdCurrentAndNext call, so the two can never point at different things.

   The class strings are written out rather than built from a ternary because
   tests/check-dead-css.js matches literal text: a name assembled at runtime is
   invisible to it, and a rule it cannot see is a rule that can quietly die. */
/* The time column, in two shapes.

   A block with travel or get-ready leads with the minute she has to ACT, at the
   SAME size and colour as every other card's time — deliberately not shrunk to a
   footnote, and deliberately not overridden on the --next card or inside
   .dq-list--quiet, because a child who has to leave at ten to five needs to read
   that as easily on a folded card as on the loud one.

   The block's own start still follows underneath, so the card never lies about
   when swimming actually is. Two numbers, and the big one is the one she can act
   on. */
function tdTimeCol(b) {
  const act = tdActionableStart(b);
  const start = b.startMin || 0;
  const dur = b.durationMin
    ? ' · ' + escapeHtml(formatDuration(b.durationMin))
    : '';
  if (act >= start) {
    return `<div class="quest-time-col">
        <div class="quest-time">${escapeHtml(formatQuestTime(start))}</div>
        ${b.durationMin ? `<div class="quest-dur">${escapeHtml(formatDuration(b.durationMin))}</div>` : ''}
      </div>`;
  }
  return `<div class="quest-time-col">
      <div class="quest-time">${escapeHtml(formatQuestTime(act))}</div>
      <div class="quest-ready-lab">get ready</div>
      <div class="quest-start-at">▸ ${escapeHtml(formatQuestTime(start))}${dur}</div>
    </div>`;
}

/* clash names the other activity this one runs into, or null. Today asks
   computeBufferConflicts (js/03-sync.js) — it does not work out for itself
   whether a plan is workable, because the week grid already answers that and
   two answers to one question is one answer too many. */
function tdQuestCard(b, kid, isNext, clash) {
  const { icon, name: nm, block: blk } = tdBlockLabel(b, kid);
  const id = escapeAttr(b.id);
  const done = !!b.completed;
  /* --conflict composes with --next rather than replacing it: the frame is an
     outline, the tier is border, shadow and fill, and the next block is still
     the next block whether or not its buffers fit. Dropping --next here would
     leave the screen with no T2 card at all, which is what the hero's NEXT line
     is checked against. A finished block keeps its done styling — a clash that
     has already been lived through is history, not a warning.
     Written out rather than composed: check-dead-css.js matches literal text. */
  const cls = done ? 'quest-card quest-done'
    : isNext && clash ? 'quest-card quest-card--next quest-card--conflict'
    : isNext ? 'quest-card quest-card--next'
    : clash ? 'quest-card quest-card--conflict'
    : 'quest-card';
  if (done) clash = null;
  return `<div class="${cls}">
      ${clash ? '<span class="quest-conflict-flag" aria-hidden="true">!</span>' : ''}
      <button type="button" class="dq-open" data-td-action="plan" data-td-block="${id}">
        ${tdTimeCol(b)}
        <div class="quest-card-icon">${icon}</div>
        <div class="quest-card-body">
          <div class="quest-card-name">${escapeHtml(nm)}</div>
          ${tdBlockTag(blk)}
          <div class="quest-card-meta"><span class="quest-xp-tag">+${QUEST_XP_PER_TASK} XP</span></div>
          ${clash ? `<div class="quest-conflict-note">⚠️ Overlaps ${escapeHtml(clash)}</div>` : ''}
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

/* ── The shape of the day, drawn to scale ─────────────────────────────────
   A picture of a number the screen already prints: tdQuestHero's "4/8 done" is
   the same fact, and the ribbon carries no caption of its own because of that.

   It was a row of equal squares, which said how MANY things were on the day but
   nothing about their shape — a five-minute vitamin and a three-hour training
   drew the same box, and a free afternoon drew nothing at all. Cells are now
   proportional to duration and the gaps between them are real empty space, so
   the strip reads as the day's shape rather than its inventory. Three times
   underneath give the scale; one marker says where she is in it.

   It reads the array tdRenderToday already computed rather than calling
   getDayBlocks again — one list of today, and a ribbon that cannot disagree
   with the list beside it.

   Four states, and each differs in border STYLE as well as fill: colour alone
   is not a signal a child reliably reads, which is the same reason the nav's
   current tab is underlined and not merely tinted. The emoji faces are gone
   with the equal squares — a sliver eight pixels wide cannot hold one.

   Now tappable, and it opens the DAY SCREEN. It does not unfold a copy of the
   day here: four renderings of one day have been retired in this app already,
   and the day screen is the one that draws today at absolute times with its
   breaks and free stretches — and lets her change it. One button rather than
   twenty tab stops, with the spoken label on the button itself. */
function tdRibbonSpan(blocks) {
  let from = Infinity, to = -Infinity;
  blocks.forEach(b => {
    from = Math.min(from, tdActionableStart(b));
    to = Math.max(to, (b.startMin || 0) + (b.durationMin || 0));
  });
  // A day of one instant still needs a width to divide by.
  return { from, to: Math.max(to, from + 1) };
}

function tdProgressRibbon(kid, blocks) {
  const total = blocks.length;
  if (!total) return tdQuestHero(kid, blocks);
  const { current } = tdCurrentAndNext(kid);
  const now = tdNowMin();
  const done = blocks.filter(b => b.completed).length;
  const { from, to } = tdRibbonSpan(blocks);
  const span = to - from;
  const pctOf = min => Math.max(0, Math.min(100, (min - from) / span * 100));

  /* Cells and the gaps between them, laid left to right, as percentages of one
     nowrap row. Two ways that row could add up to more than 100% — and it did,
     which put the last cell through the right-hand edge of its column on an
     iPad in landscape:

     A BLOCK MAY START INSIDE THE ONE BEFORE IT. That is not a hypothetical, it
     is exactly the clash this screen now draws in red: swimming needs her at
     3:35 while piano runs to 4:00. Measured from its own start, its cell claims
     twenty-five minutes the previous cell has already drawn. Clamping to the
     cursor means the strip only ever spends each minute of the day once.

     AND THE FLOOR IS A FLOOR. A cell thinner than MIN_CELL reads as a scratch
     rather than a block, so it is widened — and enough short blocks widened
     enough will overrun the row on their own, with no overlap involved.

     So: build the segments, then scale the lot back if they came to more than a
     day. Proportions survive; the strip fits. */
  const MIN_CELL = 3;
  let cursor = from;
  const segs = [];
  blocks.forEach(b => {
    const s = tdActionableStart(b);
    const e = (b.startMin || 0) + (b.durationMin || 0);
    const gap = Math.max(0, pctOf(s) - pctOf(cursor));
    if (gap > 0.5) segs.push({ cls: 'td-rib-gap', w: gap });
    // Never re-draw time an earlier block already occupies.
    const drawFrom = Math.max(s, cursor);
    cursor = Math.max(cursor, e);
    /* COLOUR IS WHAT IT IS; THE BORDER IS WHETHER IT IS DONE.
       Fill used to carry status — green done, yellow now, white to come — which
       told a child how much was ticked and nothing at all about what any of it
       was. Colour now comes from blockColour, the same answer the day view and
       the week grid render, so the strip reads as the shape of HER day.

       Status moved to the border, and every cell stays solid: she does not get
       to tick things every hour, so a block she has not confirmed yet must not
       be drawn faded or hollow as though she had failed it. Dashed means not
       confirmed, solid means confirmed. That also retires --missed, which said
       "you missed these" about a morning nobody had had a chance to close.

       Border style rather than colour is what keeps the house rule — colour
       alone is not a signal a child reliably reads — now that colour is
       identity instead of status.

       Written out rather than built from a ternary: check-dead-css.js matches
       literal text, and a class it cannot see is a class that can quietly die. */
    let cls = 'td-rib-cell';
    if (b.completed) cls = 'td-rib-cell td-rib-cell--done';
    else if (current && b.id === current.id) cls = 'td-rib-cell td-rib-cell--now';
    segs.push({
      cls,
      w: Math.max(MIN_CELL, pctOf(e) - pctOf(drawFrom)),
      bg: blockColour(b, kid),
    });
  });
  const wide = segs.reduce((a, s) => a + s.w, 0);
  const scale = wide > 100 ? 100 / wide : 1;
  const cells = segs
    .map(s => `<span class="${s.cls}" style="flex:0 0 ${(s.w * scale).toFixed(2)}%${
      s.bg ? ';background:' + escapeAttr(s.bg) : ''}"></span>`)
    .join('');

  /* The marker only exists while now is inside the day's span. Before the first
     block and after the last one there is nothing for it to point at, and an
     arrow pinned to the edge would claim otherwise. */
  const marker = (now >= from && now <= to)
    ? `<span class="td-rib-now" style="left:${pctOf(now).toFixed(2)}%"></span>`
    : '';
  const mid = Math.round((from + to) / 2);

  /* The button wraps the strip only. tdQuestHero is a sibling inside the same
     .td-ribbon container rather than a child of the button: it is a readout, it
     contains block elements a <button> may not legally hold, and the level she
     has reached is not a thing to tap. */
  return `<div class="td-ribbon">
      <button type="button" class="td-rib-btn" data-td-action="plan"
        aria-label="${escapeAttr(done + ' of ' + total + ' done today. Open the day.')}">
        <span class="td-rib-strip" aria-hidden="true">${cells}${marker}</span>
        <span class="td-rib-foot" aria-hidden="true">
          <span>${escapeHtml(formatQuestTime(from))}</span>
          <span>${escapeHtml(formatQuestTime(mid))}</span>
          <span>${escapeHtml(formatQuestTime(to))}</span>
          <span class="td-rib-go">›</span>
        </span>
      </button>
      ${tdQuestHero(kid, blocks)}
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

/* What a placed block is called, and the only place that decides it.

   findActivity rather than getAllActivities: this names a block that already
   exists, so an archived activity must still resolve — a retired piano teacher
   must not blank out last term's piano.

   The training/competition unwrapping used to live only in tdQuestCard, so the
   NOW card called a skating session "Training" while the card for the very same
   block, a few centimetres below it, called it "Skating". That was survivable
   while the two never shared a viewport. The hero names the next block now, so
   they always do. */
function tdBlockLabel(b, kid) {
  const { icon, name, n } = blockDisplayName(b, kid, todayKey());
  // n is 0 unless the same thing genuinely repeats today, so a lone Homework
  // block stays "Homework" and five of them become Block 1…5.
  return { icon, name, block: n };
}

function tdBlockLine(b, kid) {
  const { icon, name, block } = tdBlockLabel(b, kid);
  const time = (typeof formatTimeFromMin === 'function') ? formatTimeFromMin(b.startMin || 0) : '';
  return { icon, name, block, time };
}

/* "Block 2", or nothing at all. One place, so the hero and the cards cannot
   word it two ways — and quiet, because which of five it is matters less than
   what it is. */
function tdBlockTag(n) {
  return n ? `<span class="td-blk">Block ${n}</span>` : '';
}

function tdRenderToday() {
  const wrap = document.getElementById('tdWrap');
  if (!wrap) return;
  const kid = activeProfile();
  /* The date, from todayKey() and not from a bare new Date(): formatDayKey
     rebuilds it as local midnight of the day the app thinks it is, so the
     weekday cannot drift away from the day the rest of the screen is about. */
  const dateEl = document.getElementById('tdTodayDate');
  if (dateEl) {
    dateEl.textContent = formatDayKey(todayKey())
      .toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  }
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
  /* One call per render, read by both the hero and the cards, so a clash is
     never flagged in one place and not the other. */
  const clashes = tdClashes(kid, quests);
  const waiting = d == null ? 0 : mrWaitingCount(kid, wk);
  const fresh = (d == null || typeof mrNewlyGraded !== 'function') ? [] : mrNewlyGraded(kid, wk);

  /* ── The prep line ──
     Always about the NEXT thing, whether or not something is running: the moment
     a child most needs to know she has to leave at ten to five is while she is
     still in the middle of something else. One time leads, because one time is
     what she can act on; the steps sit under it for when she wants to know why.

     Past the deadline it says so rather than repeating the same sentence — a
     "be moving by 4:45" that reads identically at 4:30 and 5:10 is not helping. */
  const prep = tdPrepFor(next);
  let prepHtml = '';
  if (prep) {
    const late = tdNowMin() >= prep.moveByMin;
    /* The strip is bordered and set in --accent-strong because leaving on time
       is the one thing on this screen that stops being possible if she reads it
       late. It sits under NEXT rather than inside the current block's text,
       which is where it used to be: tdPrepFor has always been asked about the
       NEXT block, so rendering its answer inside the CURRENT one made the most
       actionable line on the screen read as a footnote to the wrong thing.

       .td-now-move and .td-now-steps keep their names and their exact wording —
       the week grid and the print sheet say it the same way, and two screens
       that word "leave by" differently will eventually disagree about the time
       too. */
    prepHtml = `<div class="td-now-prep">
        <div class="td-now-move${late ? ' td-now-move--now' : ''}">
          ${late ? '⏰ Time to get moving' : 'Be moving by ' + escapeHtml(formatTimeFromMin(prep.moveByMin))}</div>
        <div class="td-now-steps">${prep.steps.map(s => `<span>${escapeHtml(s)}</span>`).join('')}</div>
      </div>`;
  }

  /* The half of the hero that has something to say. When something is running,
     what she needs from the screen is not "you are doing piano" — she knows —
     it is what comes after it and whether she has to move for it. */
  let nextHtml = '';
  if (current && next) {
    const nl = tdBlockLine(next, kid);
    /* The gap between what she is doing and what is next, named when it is
       short enough to be a break rather than an afternoon. tdGapBefore returns
       null at TD_FREE_MIN and over, where the free-time card below already
       describes the same stretch — one gap, one description. */
    /* And the time beside it is the one she has to act on, not the one the
       block starts at — the same number tdTimeCol puts on the card below, so the
       hero and the card cannot name two different times for one thing. The prep
       strip directly under this line says what the earlier time is for. */
    const brk = tdGapBefore(current, next);
    nextHtml = `<div class="td-now-next">
        <div class="td-now-nextline">
          <span class="td-now-nextlab">Next</span>
          ${brk ? `<span class="td-break-chip">☕ ${escapeHtml(formatDuration(brk))} break</span>` : ''}
          <span class="td-now-nextname">${escapeHtml(nl.name)}</span>${tdBlockTag(nl.block)}
          <span class="td-now-nexttime">${escapeHtml(formatTimeFromMin(tdActionableStart(next)))}</span>
        </div>${prepHtml}
      </div>`;
  } else if (prepHtml) {
    // No current block: the head IS the next one, so the prep needs no label.
    nextHtml = `<div class="td-now-next">${prepHtml}</div>`;
  }

  // NOW — the one thing the screen exists for.
  const breakNow = current ? null : tdBreakNow(quests, next);
  let nowHtml;
  if (current) {
    const l = tdBlockLine(current, kid);
    /* A 56px tick, not a full-width bar. She already knows what she is doing;
       the card only has to let her close it, and the height a big button would
       take belongs to NEXT. It routes to the same blastQuest the 🎯 on the card
       below routes to — one completion path, not two. */
    /* "now · started 8:15am" made her do the arithmetic. The block's own window
       and what is left of it, with the countdown drawn underneath so "how much
       longer" can be read rather than worked out. No digital clock: the day
       screen owns absolute time, and a clock here would be a second one.

       The button is the 🎯 the cards below carry, not a ✓. It was a tick, and
       four centimetres under it the same block's card showed a tick that meant
       "already done" — one action wearing two glyphs, and a child with no way
       to tell which tick did what. Same glyph, same green, same border. It is
       still 56px because it sits at the card's edge where a thumb arrives at an
       angle, and it still routes to the same blastQuest. */
    const prog = tdHeroProgress(current);
    const clash = clashes.get(current.id);
    nowHtml = `<div class="td-now-head">
        <div class="td-now-icon">${l.icon}</div>
        <div class="td-now-line"><div class="td-now-name">${escapeHtml(l.name)} ${tdBlockTag(l.block)}</div>
          <div class="td-now-sub">${escapeHtml(prog.range)} · <span class="td-now-left">${escapeHtml(formatDuration(prog.leftMin))} left</span></div>
          ${clash ? `<div class="quest-conflict-note">⚠️ Overlaps ${escapeHtml(clash)}</div>` : ''}</div>
        <button type="button" class="td-now-tick" data-td-action="blast"
          data-td-block="${escapeAttr(current.id)}"
          aria-label="Mark ${escapeAttr(l.name)} done" title="Done it! 🎯">🎯</button>
      </div>
      <div class="td-now-bar"><span class="td-now-bar-fill" style="width:${prog.pct}%"></span></div>${nextHtml}`;
  } else if (breakNow) {
    /* Between two things, with only minutes in it. "Nothing scheduled — the rest
       of today is yours" is false at ten past nine on a homework morning, and
       "Homework, next 9:15am" is not what she is doing either: she is on a
       break, and the useful number is how much of it is left. Nothing to tick,
       so no 🎯 — the hero only carries a control when there is something to
       close. Only under TD_FREE_MIN; a longer stretch is free time and the card
       below already names it. */
    const b = breakNow;
    const l = tdBlockLine(next, kid);
    nowHtml = `<div class="td-now-head">
        <div class="td-now-icon">☕</div>
        <div class="td-now-line"><div class="td-now-name">Break</div>
          <div class="td-now-sub"><span class="td-now-left">${escapeHtml(formatDuration(b.leftMin))}</span> until ${escapeHtml(l.name)} · ${escapeHtml(l.time)}</div></div>
      </div>
      <div class="td-now-bar"><span class="td-now-bar-fill" style="width:${b.pct}%"></span></div>${nextHtml}`;
  } else if (next) {
    const l = tdBlockLine(next, kid);
    const act = tdActionableStart(next);
    const clash = clashes.get(next.id);
    /* A block she has to travel to starts when she starts getting ready. Leading
       with "next · 4:00pm" names a time she would already be late for, so when
       there are buffers the head carries the actionable minute and the block's
       own start follows it. */
    const sub = act < (next.startMin || 0)
      ? `<span class="td-now-left">get ready ${escapeHtml(formatTimeFromMin(act))}</span> · starts ${escapeHtml(l.time)}`
      : `next · ${escapeHtml(l.time)}`;
    nowHtml = `<div class="td-now-head">
        <div class="td-now-icon">${l.icon}</div>
        <div class="td-now-line"><div class="td-now-name">${escapeHtml(l.name)} ${tdBlockTag(l.block)}</div>
          <div class="td-now-sub">${sub}</div>
          ${clash ? `<div class="quest-conflict-note">⚠️ Overlaps ${escapeHtml(clash)}</div>` : ''}</div>
      </div>${nextHtml}`;
  } else if (tdInQuietHours()) {
    /* Nine at night with nothing left on the plan. "The rest of today is yours"
       is true and useless — the rest of that day is sleep. */
    nowHtml = `<div class="td-now-head">
        <div class="td-now-icon">🌙</div>
        <div class="td-now-line"><div class="td-now-name">Winding down</div>
          <div class="td-now-sub">nothing left tonight — rest is the plan</div></div>
      </div>`;
  } else {
    nowHtml = `<div class="td-now-head">
        <div class="td-now-icon">🌤️</div>
        <div class="td-now-line"><div class="td-now-name">Nothing scheduled</div>
          <div class="td-now-sub">the rest of today is yours</div></div>
      </div>`;
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
      /* "Do it ›" became "›". The whole row is the target, so the words only
         repeated the affordance the row already offers — and on a busy day
         that phrase was six of the screen's 200-word budget. The chevron keeps
         the visual affordance; aria-label keeps the spoken one. */
      return `<button type="button" class="td-row" data-td-action="chore"
            aria-label="Do ${escapeAttr(j.row.label)}">
          <span class="td-row-icon">${jobIcon(j.row.id)}</span>
          <span class="td-row-name">${escapeHtml(j.row.label)}</span>
          ${payTag}
          <span class="td-row-go" aria-hidden="true">›</span>
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

  /* Next at the top. The list ran in plain time order, so from mid-morning
     onward the thing she was about to do sat below a breakfast she had already
     eaten — the top of the screen was about the past. Upcoming first, still in
     time order so "next" is genuinely next; everything already finished drops
     below a divider that starts closed. */
  /* And only the next few are loud. Ten blocks meant ten cards, which is a list,
     which is what this screen replaced. What is running plus TD_UP_NEXT are on
     the screen; the rest of the day goes under a fold that opens in one tap.
     Free stretches sit in the same order, so an afternoon with nothing until 4pm
     says so instead of showing the 4pm thing as if it were imminent. */
  const split = tdSplitQuestsByNow(quests);
  const earlierOpen = tdEarlierOpen();
  const timeline = tdUpcomingTimeline(kid, split.upcoming, current && current.id);
  const card = it => (it.kind === 'free' ? tdFreeCard(it.gap)
    : it.kind === 'break' ? tdBreakConnector(it.mins)
    : tdQuestCard(it.block, kid, !!(next && it.block && it.block.id === next.id),
        clashes.get(it.block.id)));
  /* A break is a connector, not one of the things she has to do, so it does not
     spend one of the three loud slots — count blocks and free stretches only.
     Otherwise a morning of short gaps would push the third real card behind the
     fold and the window would show two things while claiming three. */
  const loudEnd = tdLoudSlice(timeline, 1 + TD_UP_NEXT);
  const upNext = timeline.slice(0, loudEnd);
  const later = timeline.slice(loudEnd);
  /* A fold over one card hides as much as it saves, so at one the fold is not
     worth the tap and the item simply shows. */
  // Connectors are not things to do, so they do not count in "Later today (n)".
  const laterCount = later.filter(it => it.kind !== 'break').length;
  const laterOpen = tdLaterOpen() || laterCount === 1;
  const questHtml = quests.length
    ? `${upNext.length
          ? `<div class="dq-list">${upNext.map(card).join('')}</div>`
          : `<div class="td-empty">That is the whole day done.</div>`}
       ${laterCount > 1
          ? `<button type="button" class="td-fold-btn td-later-btn" data-td-action="later">
               ${laterOpen ? '▾' : '▸'} Later today (${laterCount})
             </button>`
          : ''}
       ${laterCount && laterOpen ? `<div class="dq-list dq-list--quiet">${later.map(card).join('')}</div>` : ''}
       ${split.earlier.length
          ? `<button type="button" class="td-fold-btn td-earlier-btn" data-td-action="earlier">
               ${earlierOpen ? '▾' : '▸'} Earlier today (${split.earlier.length})
             </button>
             ${earlierOpen ? `<div class="dq-list dq-list--quiet">${split.earlier.map(b => tdQuestCard(b, kid)).join('')}</div>` : ''}`
          : ''}`
    : `<div class="td-empty">Nothing planned yet.</div>`;

  /* The one door onto the day screen, and it says which trip it is.
     There were two, and then three: a static "✏️ Plan my day" button that was
     always there, a "Nothing planned — build a day?" row inside this card when
     the day was empty, and — beside that static button — "📋 The whole week"
     and "💰 My money", which are the Week and Money tabs of the persistent nav
     wearing different labels. CLAUDE.md names a second row of navigation as how
     labels drift apart; this was the last one left.
     So: one button, one destination, and the verb tells her which day she has.
     `quests` is already computed above — no second reader of the day. */
  const planHtml = `<div class="td-more">
      <button type="button" class="td-morebtn td-plan" data-td-action="plan">
        ✏️ ${quests.length ? 'Modify my plan' : 'Plan my day'}</button>
    </div>`;

  // The loop back from a grown-up. Same counts the chore screen shows, so the two
  // can never disagree.
  let loopHtml = '';
  if (fresh.length) {
    loopHtml += `<button type="button" class="td-chip td-chip-fresh" data-td-action="fresh">
      ✨ <b>${fresh.length}</b> answered</button>`;
  }
  /* The family's share of the week, while there is still a week left to put it
     in. mrFamilyChoreStatus owns the counting (js/18-rules.js); this only asks.
     Forward-looking on purpose — "still to plan", never "you didn't" — which is
     the rule every other kid-facing warning in the app follows. It disappears the
     moment the floor is met, so it is a to-do and not a scoreboard. */
  const family = (d == null) ? null : mrFamilyChoreStatus(kid, wk);
  if (family && family.short > 0) {
    loopHtml += `<button type="button" class="td-chip td-chip-family" data-td-action="chore">
      🧹 <b>${family.short}</b> family ${family.short === 1 ? 'chore' : 'chores'} to plan</button>`;
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
  /* The hero takes the clash frame when the block it is showing is one of the
     two the clash names — the same red the week grid uses, on the same finding.
     Written out rather than composed: check-dead-css.js matches literal text. */
  const heroBlock = current || (breakNow ? null : next);
  const heroCls = (heroBlock && clashes.get(heroBlock.id))
    ? 'td-card td-now td-now--conflict'
    : 'td-card td-now';

  const moneyHtml = tdMoneyChart(kid, wk);

  /* The evening wind-down nudge, carried over from the day timeline's banner.
     It used to appear only once someone had typed an age into the week glance,
     which for most of the app's life meant never; currentAge always answers. */
  const nowH = Math.floor(nowMinutesInZone() / 60);
  const age = currentAge(kid);
  const bedtime = (nowH >= 18 && age != null && typeof bedtimeReminderText === 'function')
    ? bedtimeReminderText(age) : null;

  /* ── Two columns on a landscape tablet, one everywhere else ───────────────
     The iPad in landscape is the device this screen is used on, and it was
     being served a single column: every card stretched to a thousand points to
     hold one line of text, a third of the glass unused, and the day running off
     the bottom.

     The split is a distinction, not a way to fill width. Left is the day
     itself — what she is on, what follows, and the button that changes it, so
     the thing that edits the plan sits with the plan. Right is everything
     around the day: how far through she is, what she could pick up, what it has
     earned her. One eye movement answers "what now".

     Source order is the phone order: the grid only reflows, so nothing here
     depends on the viewport being wide. */
  wrap.innerHTML = `
    <div class="td-col td-col--day">
      <div class="${heroCls}">${nowHtml}</div>
      <div class="td-card">
        <div class="td-cap">Coming up</div>${questHtml}</div>
      ${planHtml}
    </div>
    <div class="td-col td-col--side">
      ${loopHtml ? `<div class="td-chips">${loopHtml}</div>` : ''}
      ${tdProgressRibbon(kid, quests)}
      <div class="td-card">
        <div class="td-cap">Jobs I can do</div>${choreHtml}</div>
      <div class="td-card">
        <div class="td-cap">My money</div>${moneyHtml}</div>
      <div class="td-say">${escapeHtml(tdEncouragement(kid))}</div>
      ${bedtime ? `<div class="bedtime-tip">${escapeHtml(bedtime)}</div>` : ''}
    </div>`;

  /* The relocated panels are static siblings of the wrap, so they survive this
     re-render and only need their own renderers run. Each is the function that
     already owned that data on the day screen — called, not reimplemented. */
  tdApplyExtras();
  if (typeof renderVibe === 'function') renderVibe();
  if (typeof renderDayGoalsTodos === 'function') renderDayGoalsTodos();
  /* The sticker wall. Its renderer had no caller anywhere in the repo, so the
     shelf rendered empty wherever it was put — completing a block counted
     towards stickers and unlocked them, and she was never shown. */
  if (typeof renderStickerCollection === 'function') renderStickerCollection(kid);
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
  const earnCap = earn.left == null ? 'Earned today' : 'Still to earn today';
  const earnAmt = mnyMoney(earn.left == null ? earn.done : earn.left);

  return `<button type="button" class="td-money" data-td-action="money">
      <span class="td-money-total">${escapeHtml(mnyMoney(total))}${owing > 0
        ? ` <span class="td-money-owing">owes ${escapeHtml(mnyMoney(owing))}</span>` : ''}</span>
      ${bar}
      <span class="td-keys">${key || '<span class="td-key">Nothing yet</span>'}</span>
      ${spark}
      <span class="td-money-earn">
        <span class="td-money-earn-cap">${escapeHtml(earnCap)}</span>
        <span class="td-money-earn-amt">${escapeHtml(earnAmt)}</span>
      </span>
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
  if (a === 'later')   { tdToggleLater(); return; }
  /* 'week' was here, for a button that repeated the nav's Week tab. The money
     branch stays: tdMoneyChart renders the whole money card as one
     data-td-action="money" button, so this is still a live action. */
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

/* ── The minute hand ──────────────────────────────────────────────────────
   The hero now counts down, and a countdown that only moves when something else
   re-renders is a clock that is wrong most of the time. A tablet left open on
   this screen through an afternoon showed "22m left" for three hours.

   Two costs to avoid. A full tdRenderToday every minute rebuilds every card and
   throws away the scroll position, and refreshCurrentScreen already fires on
   every remote snapshot; so the common tick patches the three things that
   actually changed — the remaining time, the bar and the marker — in place, and
   only a change of what she is doing earns a real re-render. And nothing here
   writes: a render is not a mutation, so this never touches Firestore.

   TD_TICK_MS is a minute because the smallest unit the hero prints is a minute.

   Held in a module-level string rather than read back off the DOM: the point is
   to notice the boundary at 9:15 even when the previous block was never ticked,
   and the DOM cannot say which block it is showing without being asked.
   Declaration only — js/99-main.js starts the timer. */
const TD_TICK_MS = 60000;
let tdTickShowing = null;

function tdTickKey(kid) {
  const { current, next } = tdCurrentAndNext(kid);
  const breakNow = current ? null : tdBreakNow(tdQuestsToday(kid), next);
  return [current ? current.id : '', next ? next.id : '', breakNow ? 'brk' : '', todayKey()].join('|');
}

function tdTick() {
  // .active is what showScreen (js/05-helpers.js) sets; anything else is a
  // screen the child is not looking at, and repainting it is wasted work.
  const screen = document.getElementById('screen-today');
  if (!screen || !screen.classList.contains('active')) return;
  const kid = activeProfile();
  if (!kid || kid === 'parent') return;

  const key = tdTickKey(kid);
  if (key !== tdTickShowing) { tdTickShowing = key; tdRenderToday(); return; }

  const { current, next } = tdCurrentAndNext(kid);
  const left = document.querySelector('#tdWrap .td-now-left');
  const fill = document.querySelector('#tdWrap .td-now-bar-fill');
  if (current) {
    const p = tdHeroProgress(current);
    if (left) left.textContent = formatDuration(p.leftMin) + ' left';
    if (fill) fill.style.width = p.pct + '%';
  } else {
    const b = tdBreakNow(tdQuestsToday(kid), next);
    if (b) {
      if (left) left.textContent = formatDuration(b.leftMin);
      if (fill) fill.style.width = b.pct + '%';
    }
  }
  const marker = document.querySelector('#tdWrap .td-rib-now');
  if (marker) {
    const blocks = tdQuestsToday(kid);
    if (blocks.length) {
      const { from, to } = tdRibbonSpan(blocks);
      const now = tdNowMin();
      if (now >= from && now <= to) {
        marker.style.left = ((now - from) / Math.max(1, to - from) * 100).toFixed(2) + '%';
      }
    }
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
    /* Print was here. It has a button on the week topbar, which is the week it
       prints — a second door to it from a menu is a second label that can
       drift, and printing is not something you go looking for in "more". */
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
