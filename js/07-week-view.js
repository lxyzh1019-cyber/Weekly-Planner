// Weekly-Planner — week view: full/compact week render, time grid, week glance & wins.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   WEEK VIEW
════════════════════════════════════════════════════════════════ */
/* Two views: the week you plan in, and a read-only preview of what the Print
   button prints. 'timegrid' — Day Blocks — was the third, and was what the
   screen opened on; it is retired, and anything still asking for it lands on
   the Full week rather than on a blank container. */
function setWeekView(v) {
  weekView = (v === 'preview') ? 'preview' : 'full';
  document.getElementById('viewTabFull').classList.toggle('active', weekView === 'full');
  document.getElementById('viewTabPrintPreview').classList.toggle('active', weekView === 'preview');
  document.getElementById('weekFull').style.display = weekView === 'full' ? 'flex' : 'none';
  document.getElementById('weekPrintPreview').style.display = weekView === 'preview' ? 'flex' : 'none';
  /* The school-day offer above the grid is a SIBLING of #weekFull, so hiding
     the Full view does not take it with it — and renderSchoolDayBanner is only
     ever called from renderFullWeek, so without this it would keep whatever it
     last said over a read-only print preview where nothing can be added. */
  const schoolTop = document.getElementById('weekSchoolBannerTop');
  if (schoolTop && weekView === 'preview') schoolTop.style.display = 'none';
  renderWeek();
}
function changeWeek(d) { weekOffset += d; renderWeek(); }

/* ── Putting back a week that was left blank ───────────────────────
   The planner could only ever copy a week FORWARD, which is
   the wrong direction for the case that actually happens: a fortnight goes by,
   nothing gets planned, and the family sits down to review two weeks with
   nothing in them. Placing fourteen days one block at a time is the real reason
   that review does not happen — so this offers the shape of a week she already
   planned, to fix rather than to build from nothing.

   Nothing is asserted on her behalf. Every copy arrives not-done and
   unconfirmed: a copied week is a plan, not a claim about what happened. */
function weekIsBlank(mondayKey, p) {
  return mrWeekDayKeys(mondayKey).every(k => !(getDayBlocksForProfile(k, p) || []).length);
}
/* The nearest week that actually has a plan, searched outwards so a blank
   fortnight can borrow from either side of itself. Equal distances go to the
   LATER week: a plan from after the gap is a better guess at "a normal week"
   than one from further back. */
function nearestPlannedWeek(mondayKey, p, span) {
  const mon = formatDayKey(mondayKey);
  for (let d = 1; d <= (span || 8); d++) {
    for (const dir of [1, -1]) {
      const c = new Date(mon); c.setDate(mon.getDate() + dir * d * 7);
      const key = ctDateToKey(c);
      if (!weekIsBlank(key, p)) return key;
    }
  }
  return null;
}
/* One clone rule, shared with every copy path. Everything that records what
   HAPPENED is dropped, because a copy is a plan — and that includes xpAwarded,
   which the meeting's inline copy used to carry over: awardBlockLinks only awards when the
   flag is unset, so a copied block could never pay XP however often it was
   done. checklistState goes for the same reason — a pre-ticked checklist is a
   claim nobody made. gearState and trainingCheck are the same claim in two
   more shapes, and a stopwatch carries somebody else's elapsed minutes.

   A COPY IS NOT PART OF THE ORIGINAL'S SERIES. seriesId used to come through
   untouched, and every consequence of that was invisible until it bit:
   countSeriesBlocks scans every week of the profile, so editing a copied block
   offered "update all" and rewrote the weeks it was copied FROM; "remove all in
   series" deleted those originals and wrote 'sr:'+seriesId into
   state.shared.tombstones, which is shared rather than per-profile — so via
   blockTombstoned (js/04-merge.js) the same delete could drop the SISTER's
   cross-copied blocks on the next merge. Every copy path inherits this fix:
   the parent portal's copy, the meeting's plan-next-week, the blank-week fill
   and the day copy.

   The spreads matter too. Object.assign is shallow, so a copy and its original
   shared their objectives array and their gear/check/stopwatch objects by
   reference until the next reload re-parsed the JSON — editing one edited both
   in memory, which is the kind of bug that only shows up on the device that
   did the copy. */
function weekCloneBlock(b) {
  const c = Object.assign({}, b, {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    completed: false, confirmed: false, xpAwarded: false,
    checklistState: {}, gearState: {}, trainingCheck: {},
    createdAt: syncNow(), updatedAt: syncNow(),
  });
  delete c.seriesId;
  // Nor was the copy shared: the 💌 badge and its invite link stay on the original.
  delete c.invitedTo; delete c.sentInviteIds;
  if (Array.isArray(b.objectives)) c.objectives = b.objectives.slice();
  if (b.stopwatch) c.stopwatch = Object.assign({}, b.stopwatch, {
    elapsedSec: 0, running: false, startedAt: null,
  });
  return c;
}
/* Days that already hold something are left alone — the same guard
   every copy path uses. A copy must never overwrite a plan somebody made. */
function copyWeekInto(sourceMondayKey, targetMondayKey, p) {
  const src = mrWeekDayKeys(sourceMondayKey), dst = mrWeekDayKeys(targetMondayKey);
  let copied = 0;
  src.forEach((sk, i) => {
    const from = getDayBlocksForProfile(sk, p) || [];
    if (!from.length) return;
    if ((getDayBlocksForProfile(dst[i], p) || []).length) return;
    setDayBlocks(dst[i], from.map(b => weekCloneBlock(b)), p);
    copied += from.length;
  });
  return copied;
}
/* One day onto another, in either direction and across weeks. Same clone rule
   as the week copy — new ids, completion and XP reset, checklist cleared — so a
   copied Tuesday cannot arrive pre-ticked or pay XP twice.

   The week copy skips a destination that already has blocks; a day copy cannot,
   because "make Wednesday look like Tuesday" is exactly what you ask for when
   Wednesday is already wrong. It replaces, and tombstones what it replaced —
   without that, a merge from another device brings the old blocks straight
   back (js/04-merge.js).

   Two children, not one. The signature took a single profile and used it for
   both ends, so the one thing the engine could not do was the thing a parent
   most often wants: put Jenn's Tuesday on Jess's. Cross-child drops the blocks
   the destination cannot resolve, for the reason placeableActivityIds explains,
   and says how many — a copy that silently dropped four blocks is how someone
   comes to believe a day is planned when it is not.

   Returns { copied, dropped }. */
function copyDayInto(srcDayKey, dstDayKey, srcP, dstP) {
  const to = dstP || srcP;
  if (!srcDayKey || !dstDayKey) return { copied: 0, dropped: 0 };
  if (srcDayKey === dstDayKey && to === srcP) return { copied: 0, dropped: 0 };
  const all = getDayBlocksForProfile(srcDayKey, srcP) || [];
  const canPlace = to === srcP ? null : placeableActivityIds(to);
  const from = canPlace ? all.filter(b => !b.actId || canPlace.has(b.actId)) : all;
  const existing = getDayBlocksForProfile(dstDayKey, to) || [];
  if (existing.length) tombstoneBlockIds(existing.map(b => b.id));
  setDayBlocks(dstDayKey, from.map(b => weekCloneBlock(b)), to);
  saveAll();
  return { copied: from.length, dropped: all.length - from.length };
}

function fillWeekFromNearest(mondayKey) {
  const p = activeProfile();
  if (!weekIsBlank(mondayKey, p)) { showToast('This week already has a plan'); return; }
  const src = nearestPlannedWeek(mondayKey, p, 8);
  if (!src) { showToast('No other week has a plan to copy yet'); return; }
  const n = copyWeekInto(src, mondayKey, p);
  renderWeek();
  showToast(n ? `📋 Copied ${n} block${n === 1 ? '' : 's'} — now fix what's wrong` : 'Nothing to copy');
}
/* "Start planning" called goPlanToday, which opens TODAY — so a kid looking at
   a blank week from a fortnight ago was teleported out of the week she was
   looking at and into the current day, which is not what she pressed. Opens a
   day in the week on screen instead, preferring today when today is in it. */
function goPlanWeek(mondayKey) {
  const keys = mrWeekDayKeys(mondayKey);
  const i = Math.max(0, keys.indexOf(todayKey()));
  openDayFromWeekCard(keys[i], i);
}
/* The empty-week tip. A past week says something different because the thing to
   do is different: a week already gone is not "pick a day and put the first
   thing in", it is "put back what actually happened" — and there may be a
   week's shape next door to start from. One line either way; screen-week is on
   the 200-word kid budget. */
/* ── School days, offered rather than assumed ──
   The calendar knows which days of this week are school days. What it must not
   do is quietly fill them in: a week that arrived pre-planned is a week nobody
   decided, and the girls' plans are theirs to make. So the offer says how many
   and which, and nothing is written until it is pressed.

   And only near the front. A term is 40-odd weeks; materialising every school
   day of it would write hundreds of blocks into a document that uploads whole
   on every change, to describe a Tuesday in May that nobody is planning yet.
   Three weeks is as far ahead as anyone is actually laying out a week. */
const SCHOOL_FILL_HORIZON_WEEKS = 3;

/* ── Which school days have no school card yet? ───────────────────
   This asked whether the DAY was empty, which is a different question and the
   wrong one. The pale "🏫 School" band is a time-zone — business hours, and
   what makes the summer and the winter break legible. The card is the plan.
   They are not duplicates of each other and neither replaces the other.

   So a Monday with Breakfast on it is not a Monday that has school on the
   plan — but under the old test it was disqualified from ever being offered
   one, and the offer only ever appeared on a WHOLLY blank week. Put one meal
   anywhere and that week's school days could never get their cards. */
function schoolDaysToOffer(keys, p = activeProfile()) {
  return keys.filter(k => isSchoolDay(k)
    && !(getDayBlocksForProfile(k, p) || []).some(b => b && b.actId === 'school_day'));
}

function schoolOfferInHorizon(keys) {
  const off = computeWeekOffsetForDayKey(keys[0]);
  return off >= 0 && off < SCHOOL_FILL_HORIZON_WEEKS;
}

/* ── ONE writer for the School Day card, whichever door it came through ──
   Names the days before it writes anything, the way the parent portal's copy
   preview does. One School Day block per day — not the whole school-day
   template, which would also invent a piano lesson and a bedtime routine
   nobody asked for.

   The whole week's missing days and a single day are the same write, so they
   are the same function: the confirm wording, the block shape, the one
   saveAll() and the toast all live here and nowhere else. Two copies of this
   is the six-copies defect ARCHITECTURE.md already records — a card placed
   from a chip must be identical to one placed from "Add all". */
async function commitSchoolDays(days, p = activeProfile()) {
  if (!days.length) { showToast('Every school day this week already has one'); return; }
  const names = days.map(k => DAY_LONG[(formatDayKey(k).getDay() + 6) % 7]);
  const h = schoolHours();
  const when = `${formatTimeFromMin(START_MIN + h.startMin)}–${formatTimeFromMin(START_MIN + h.endMin)}`;
  const ok = await showConfirm(
    `Add School Day to ${names.length} day${names.length === 1 ? '' : 's'} — ${names.join(', ')}?\n\n`
    + `${when}, from the school calendar, with travel and get-ready time on. Nothing `
    + 'else is added, and a day that already has a School Day on it is left alone.',
    // "Add them" for one day was the last word in here that did not agree with
    // the count the sentence above it already got right.
    { okLabel: days.length === 1 ? 'Add it' : 'Add them', cancelLabel: 'Not now' });
  if (!ok) return;
  days.forEach(k => {
    const arr = getDayBlocksForProfile(k, p) || [];
    arr.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      actId: 'school_day',
      startMin: START_MIN + h.startMin,
      durationMin: h.endMin - h.startMin,
      objectives: [], note: '', checklistState: {},
      // You go to school, so the get-ready and the journey are part of the
      // morning — the same default anything you travel to now arrives with.
      travelBuffer: true, travelBufMin: DEFAULT_BUFFER_MIN,
      getReadyBuffer: true, getReadyBufMin: DEFAULT_BUFFER_MIN,
      completed: false, confirmed: false,
      createdAt: syncNow(), updatedAt: syncNow(),
    });
    setDayBlocks(k, arr, p);
  });
  saveAll();
  renderWeek();
  showToast(`🏫 Added ${days.length} school day${days.length === 1 ? '' : 's'} — now build round them`);
}

/* The whole week's missing days, from the "Add all" control. */
async function addSchoolDaysToWeek(mondayKey) {
  const p = activeProfile();
  const keys = mrWeekDayKeys(mondayKey);
  return commitSchoolDays(schoolDaysToOffer(keys, p), p);
}

/* One day, from its own chip. The smallest true answer: a PD day the family is
   away for, or a Thursday at her grandmother's, is not a reason to refuse the
   other four.

   Filtered through schoolDaysToOffer rather than written straight, because the
   chip on screen is only as fresh as the last render: another device adding
   that day's card, or a sync arriving mid-tap, would otherwise make this a
   SECOND School Day on the same day. schoolDaysToOffer already answers both
   halves — is it a school day, and does it still lack its card — so a stale
   chip becomes the "already has one" toast instead of a duplicate block. */
async function addSchoolDayToDay(dayKey) {
  const p = activeProfile();
  return commitSchoolDays(schoolDaysToOffer([dayKey], p), p);
}

function weekEmptyOffer(keys) {
  const p = activeProfile();
  const plan = `<button class="wins-btn" onclick="goPlanWeek('${escapeJsAttr(keys[0])}')">✏️ Start planning</button>`;
  /* The 🏫 offer used to be a button here too, and this was the copy that could
     not be relied on: it needed the whole week blank, it needed keys[6] to be
     today or later, and the stale-calendar branch above pre-empted it — so it
     went away the moment one block landed, which is when somebody is actually
     planning. #weekSchoolBannerTop now stands in the same place above the grid,
     in the same words, and is the one place the offer appears. */
  if (keys[6] >= todayKey()) {
    return `📝 <b>This week is empty.</b> Pick a day and put the first thing in — you can move it later. ${plan}`;
  }
  const src = nearestPlannedWeek(keys[0], p, 8);
  const copy = src
    ? ` <button class="wins-btn" onclick="fillWeekFromNearest('${escapeJsAttr(keys[0])}')">📋 Copy ${escapeHtml(mmWeekLabel(src))}</button>`
    : '';
  return `📝 <b>Nothing was planned this week.</b> Put back what you actually did, then review it together. ${plan}${copy}`;
}

/* ── Kid's weekly signature: a commitment "I'll follow my plan" sign-off,
   shown on the weekly view and carried onto the printed sheet. Stored per
   week per profile so each kid signs their own plan. ── */
function weekSignatureKey(keys) { return keys && keys[0] ? keys[0] : getDayKeys(weekOffset)[0]; }
function getWeekSignature(keys, p=activeProfile()) {
  const sigs = getProfData(p)?.weekSignatures;
  return (sigs && sigs[weekSignatureKey(keys)]) || null;
}
function renderWeekSignature(keys) {
  const bar = document.getElementById('weekSignatureBar');
  if (!bar) return;
  const p = activeProfile();
  const name = p==='jenn' ? 'Jenn' : 'Jess';
  const sig = getWeekSignature(keys, p);
  if (sig) {
    const when = new Date(sig.signedAt);
    const dateStr = `${MONTH_SHORT[when.getMonth()]} ${when.getDate()}`;
    bar.innerHTML = `
      <div class="wk-sig-line">
        <span class="wk-sig-label">✍️ Signed by</span>
        <span class="wk-sig-name">${escapeHtml(sig.name || name)}</span>
        <span class="wk-sig-date">on ${dateStr}</span>
      </div>
      <button type="button" class="wk-sig-btn wk-sig-btn--clear" onclick="clearWeekSignature()">Unsign</button>`;
  } else {
    bar.innerHTML = `
      <div class="wk-sig-line wk-sig-line--empty">
        <span class="wk-sig-label">✍️ ${name}</span>
        <span class="wk-sig-blank"></span>
      </div>
      <button type="button" class="wk-sig-btn" onclick="signWeek()">Sign this week ✍️</button>`;
  }
}
async function signWeek() {
  const keys = getDayKeys(weekOffset);
  const p = activeProfile();
  const defName = p==='jenn' ? 'Jenn' : 'Jess';
  const entered = await showPrompt('Sign your week ✍️ — write your name:', { value: defName });
  if (entered == null) return;                 // cancelled
  const name = String(entered).trim() || defName;
  const pd = getProfData(p);
  if (!pd.weekSignatures) pd.weekSignatures = {};
  pd.weekSignatures[weekSignatureKey(keys)] = { name, signedAt: Date.now() };
  saveAll();
  renderWeekSignature(keys);
  showToast(`✍️ ${name} signed this week!`);
}
function clearWeekSignature() {
  const keys = getDayKeys(weekOffset);
  const pd = getProfData(activeProfile());
  if (pd.weekSignatures) { delete pd.weekSignatures[weekSignatureKey(keys)]; saveAll(); }
  renderWeekSignature(keys);
}

function renderWeek() {
  // parent banner
  const parentBanner = document.getElementById('parentBannerWeek');
  if (isParent()) {
    parentBanner.style.display = 'block';
    document.getElementById('parentViewingName').textContent = parentViewing==='jenn'?'🐥 Jenn':'🦊 Jess';
    document.getElementById('parentBackWeek').innerHTML = parentBannerBackButton();
    // Switching child mid-meeting loses the sitting, so the meeting lock hides
    // this rather than leaving a control that quietly discards your place.
    document.getElementById('parentWeekActions').innerHTML =
      `<button type="button" class="btn-icon no-print pb-switch" onclick="parentSwitchView()">Switch</button>`;
  } else {
    parentBanner.style.display = 'none';
  }
  /* Outside the isParent() branch on purpose. While it was inside, nothing ever
     called this with the lock OFF, so a sitting hid the switcher and a child's
     render had no way to put it back. */
  applyMeetingLock();

  const p = activeProfile();
  document.getElementById('weekProfileBadge').textContent =
    isParent() ? (parentViewing==='jenn'?'🐥 Jenn':'🦊 Jess')+' (P)' :
    (p==='jenn'?'🐥 Jenn':'🦊 Jess');

  const keys = getDayKeys(weekOffset);
  const mon = formatDayKey(keys[0]);
  const sun = formatDayKey(keys[6]);
  document.getElementById('weekRangeLabel').textContent =
    `${MONTH_SHORT[mon.getMonth()]} ${mon.getDate()} — ${MONTH_SHORT[sun.getMonth()]} ${sun.getDate()}`;

  if (weekView === 'preview') renderWeekPrintPreview();
  else                        renderFullWeek(keys);

  renderGoalsTodos();
  renderWeekGlance(keys);
  renderWeekSignature(keys);

  const coachEl = document.getElementById('weekCoachTip');
  if (coachEl) {
    // Use the app's timezone (America/Edmonton) rather than the device clock so
    // the Sunday nudge lands on the same day boundary as all the week/day keys.
    const isSunday = formatDayKey(toDayKeyInZone(new Date())).getDay() === 0;
    /* An empty week used to look exactly like a full one with the cards taken
       out — seven blank columns and the same tip above them, saying nothing
       about the fact that there is nothing here. It takes the highest priority
       because on a blank week it is the only thing worth saying. Framed as an
       invitation, not a scolding: a week with nothing in it yet is a normal
       state, not a failure. */
    const nothingPlanned = keys.every(k => !(getDayBlocks(k) || []).length);
    /* The shipped school calendar has run out. Say so to a parent, once, where a
       parent already looks — never to a child, who cannot act on it and should
       not be told the app is out of date. Until it is replaced the day bands
       fall back to plain weekday shape, which is wrong on holidays; that is a
       visible, fixable wrong rather than a silent one. */
    if (isParent() && keys.some(k => schoolCalendarIsStale(k))) {
      coachEl.classList.remove('week-review-tip');
      coachEl.style.display = 'block';
      coachEl.textContent = '🗓️ The school calendar in this app ends after '
        + schoolTerm().nextStart + '. Until it is updated, school days are guessed from the weekday only.';
    } else if (nothingPlanned) {
      coachEl.classList.remove('week-review-tip');
      coachEl.style.display = 'block';
      coachEl.innerHTML = weekEmptyOffer(keys);
    } else if (isSunday && weekOffset === 0 && !weekReviewDismissed) {
      // Sunday weekly-review nudge: a gentle look-back with a mini summary,
      // shown to parent and child alike so they can reflect together.
      const t = computeWeekTotals(keys);
      const learn = fmtHrsMin(t.catMin.brain || 0);
      /* Move and Explore are counted here too. They used to fall inside `free`
         via cat:'active', so splitting them out without naming them here would
         have quietly dropped every swim, bike ride and hike out of the one
         number this banner offers — smaller for the same week, with nothing on
         screen to say why. */
      const active = fmtHrsMin((t.catMin.body || 0) + (t.catMin.move || 0)
                             + (t.catMin.explore || 0) + (t.catMin.free || 0));
      const free = fmtHrsMin(t.free);
      coachEl.classList.add('week-review-tip');
      coachEl.style.display = 'block';
      coachEl.innerHTML = `🗓️ <b>Sunday review</b> — this week: 📚 ${learn} learning · 🏃 ${active} active · 🌤 ${free} free. Look back together, then tweak one thing for next week. <button class="wins-btn" onclick="openWeeklyWins()">🎉 See wins</button> <button class="tip-dismiss" aria-label="Dismiss" onclick="dismissWeekReview()">✕</button>`;
    } else if (!isParent()) {
      coachEl.classList.remove('week-review-tip');
      coachEl.style.display = 'block';
      /* Twice now this line has named a view that no longer exists — first
         "Time-Grid", then "Day Blocks", and it also sent a child to a "My free
         time" panel that had already lost its markup. A tip that points at
         something is a tip that goes stale, so this one points at nothing but
         the day she is already looking at. */
      coachEl.textContent = '🌟 Tip: Tap a day to see your timeline. Check off routines as you go — each tick is a small win.';
    } else {
      coachEl.style.display = 'none';
    }
  }
}

// Weekly time-per-category totals over the app's 6am–10pm window (shared by
// the Sunday review nudge). Free = window minutes not scheduled. Counts the
// full entered duration up to END_MIN so charts reflect what was planned (W6).
//
// `free` is AWAKE time nobody has claimed, and it always was — the window is
// 6am–10pm, so the eight hours a child is in bed were never in the denominator.
// It did not read that way: "Unscheduled: 41h" beside no mention of sleep looks
// like it is counting the nights. nightMin is that figure, stated rather than
// left implicit, and it is deliberately not folded into `free`.
/* Grouped by what the time is FOR (activityGroup, js/01-config.js), not by the
   category that decides a block's colour. Those were the same question until
   `cat:'daily'` turned out to hold breakfast, dinner, the house chore and four
   Family Hero tasks — and got labelled "🧹 Chores" on two screens and "🍽
   Daily" on three. */
function computeWeekTotals(keys) {
  const acts = getAllActivities(activeProfile(), { includeArchived: true });
  const catMin = {};
  let planned = 0;
  keys.forEach(k => {
    (getDayBlocks(k) || []).forEach(b => {
      const s = Math.max(b.startMin, START_MIN);
      const e = Math.min(b.startMin + (b.durationMin || 0), END_MIN);
      const m = e - s;
      if (m <= 0) return;
      const act = acts.find(a => a.id === b.actId);
      const g = activityGroup(act);
      catMin[g] = (catMin[g] || 0) + m;
      planned += m;
    });
  });
  const days = keys.length || 7;
  return {
    catMin, planned,
    free: Math.max(0, DAY_MIN_SPAN * days - planned),
    nightMin: (1440 - DAY_MIN_SPAN) * days,
    days,
  };
}

/* "This week at a glance": time per day by category, what is still free, and the
   week's notes & objectives.

   It reported weekly totals as a wrap of coloured pills — "📚 Learning: 38h 30m"
   — which is two problems at once. A week total is not a number a nine-year-old
   can act on without dividing it by seven in her head, and a row of pills has no
   column to read down, so comparing two categories means hunting. Per day leads
   now, the week total sits behind it, and the whole thing is a two-column table.

   onWeekAgeChange was here, behind a 🎂 Age field. Both are gone: the child is
   not asked her age (currentAge answers it), and the parent portal corrects it. */
function renderWeekGlance(keys) {
  const body = document.getElementById('weekGlanceBody');
  if (!body) return;
  const age = currentAge();

  const acts = getAllActivities(activeProfile(), { includeArchived: true });
  const t = computeWeekTotals(keys);

  /* One row per category: the per-day average leads, the week total follows it
     in smaller type. `swatch` is a hex the tables own, so it is safe in a style
     attribute. */
  const row = (label, min, note, swatch /* safe: from CAT_HEX */) => `
    <div class="glance-row">
      <span class="glance-row-label">
        <span class="glance-dot" style="background:${swatch}"></span>${label}</span>
      <span class="glance-row-figs">
        <b class="glance-per-day">${fmtHrsMin(Math.round(min / t.days))}/day</b>
        <span class="glance-total">${note || fmtHrsMin(min) + ' this week'}</span></span>
    </div>`;

  let rows = '';
  GROUP_ORDER.forEach(g => {
    if (!t.catMin[g]) return;
    rows += row(groupLabel(g), t.catMin[g], null, groupHex(g) /* safe: from ACTIVITY_GROUPS */);
  });
  /* Unscheduled and overnight are two different facts and used to read as one.
     Unscheduled is awake time nobody has claimed; overnight is the 10pm–6am the
     window never covered. Saying both, on their own lines, is the fix. */
  rows += row('🌤 Unscheduled', t.free, null, '#ffffff' /* safe: constant */);
  rows += row('😴 Overnight', t.nightMin, '10pm–6am, not counted above', '#cbc3e3' /* safe: constant */);

  const sleep = recommendedSleep(age);
  const sleepHtml = sleep
    ? `<div class="glance-sleep">💤 <b>Sleep for age ${age}:</b> ${sleep.min}–${sleep.max}h a night</div>`
    : '';

  // Notes & objectives across the week.
  const notes = [];
  keys.forEach((k, i) => {
    (getDayBlocks(k) || []).forEach(b => {
      const act = acts.find(a => a.id === b.actId);
      if (b.note) notes.push(`<b>${DAY_SHORT[i]}</b> · ${act?.icon||''} ${escapeHtml(act?.name||'')}: ${escapeHtml(b.note)}`);
      if (b.objectives?.length) notes.push(`<b>${DAY_SHORT[i]}</b> · ${act?.icon||''} ${escapeHtml(act?.name||'')}: 🎯 ${escapeHtml(b.objectives.join(', '))}`);
    });
  });
  const notesHtml = notes.length
    ? `<div class="glance-notes"><div class="glance-notes-title">📝 Notes &amp; objectives</div>${notes.map(n=>`<div class="glance-note">${n}</div>`).join('')}</div>`
    : '';

  body.innerHTML = `
    <div class="glance-window">An average day, over the 6am–10pm window.</div>
    <div class="glance-rows">${rows}</div>
    ${sleepHtml}
    ${notesHtml}
  `;
  applyWeekGlanceOpen();
}

/* "This week at a glance" is reference, so it starts closed and remembers what
   she chose. Per-device view state, so localStorage rather than the synced
   document — same idiom as HERO_MODE_LS_KEY in js/05-helpers.js. */
const WK_GLANCE_LS_KEY = 'wp_week_glance_open';
function weekGlanceOpen() { return localStorage.getItem(WK_GLANCE_LS_KEY) === '1'; }
function toggleWeekGlance() {
  try { localStorage.setItem(WK_GLANCE_LS_KEY, weekGlanceOpen() ? '0' : '1'); } catch (e) {}
  applyWeekGlanceOpen();
}
function applyWeekGlanceOpen() {
  const open = weekGlanceOpen();
  const body = document.getElementById('weekGlanceBody');
  const caret = document.getElementById('weekGlanceCaret');
  const btn = document.querySelector('#weekGlance .week-glance-toggle');
  if (body) body.hidden = !open;
  if (caret) caret.textContent = open ? 'Hide ▾' : 'Show ▸';
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

// #6 Weekly wins recap — a celebratory look at what actually got done.
function computeWeekWins(keys) {
  const acts = getAllActivities(activeProfile(), { includeArchived: true });
  let done = 0, total = 0;
  const byCat = {};
  keys.forEach(k => {
    (getDayBlocks(k) || []).forEach(b => {
      if (b.startMin == null) return;
      total++;
      if (isBlockCompleted(b, activeProfile())) {
        done++;
        const act = acts.find(a => a.id === b.actId);
        const g = activityGroup(act);
        byCat[g] = (byCat[g] || 0) + 1;
      }
    });
  });
  const kid = isParent() ? parentViewing : activeProfile();
  const pd = getProfData(kid);
  const topStreak = Math.max(0, ...Object.values((pd && pd.progress && pd.progress.streaks) || {}).map(s => s.count || 0));
  const stickers = ((pd && pd.progress && pd.progress.stickers) || []).length;
  const money = (kid === 'jenn' || kid === 'jess') ? ctWeekMoney(ctWeekKeyForDate(keys[0]), kid) : 0;
  return { done, total, byCat, topStreak, stickers, money };
}
function openWeeklyWins() {
  const keys = getDayKeys(weekOffset);
  const w = computeWeekWins(keys);
  const pct = w.total ? Math.round(w.done / w.total * 100) : 0;
  const cheer = pct >= 80 ? 'Incredible week! 🌟' : pct >= 50 ? 'Great effort this week! 💪' : w.done > 0 ? 'Every finished task counts 💛' : 'A fresh week ahead — you’ve got this!';
  const catLines = Object.keys(w.byCat).sort((a,b)=>w.byCat[b]-w.byCat[a])
    .map(c => `<span class="wins-chip">${groupLabel(c)}: <b>${w.byCat[c]}</b></span>`).join('');
  const body = document.getElementById('weeklyWinsBody');
  if (body) {
    body.innerHTML = `
      <div class="wins-hero">${cheer}</div>
      <div class="wins-stat-row">
        <div class="wins-stat"><div class="wins-num">${w.done}</div><div class="wins-lbl">tasks done</div></div>
        <div class="wins-stat"><div class="wins-num">${pct}%</div><div class="wins-lbl">of planned</div></div>
        <div class="wins-stat"><div class="wins-num">${w.topStreak}</div><div class="wins-lbl">day streak</div></div>
      </div>
      <div class="wins-stat-row">
        ${(activeProfile()==='jenn'||activeProfile()==='jess'||isParent()) ? `<div class="wins-stat"><div class="wins-num">$${(w.money||0).toFixed(2)}</div><div class="wins-lbl">earned</div></div>` : ''}
        <div class="wins-stat"><div class="wins-num">${w.stickers}</div><div class="wins-lbl">stickers</div></div>
      </div>
      ${catLines ? `<div class="wins-cats">${catLines}</div>` : ''}
    `;
  }
  openSheet('weeklyWinsOverlay');
}

let weekReviewDismissed = false;
function dismissWeekReview() {
  weekReviewDismissed = true;
  const el = document.getElementById('weekCoachTip');
  if (el) el.style.display = 'none';
}

// Evening wind-down reminder derived from the child's age (default 7am wake).
function bedtimeReminderText(age) {
  const s = recommendedSleep(age);
  if (!s) return null;
  const targetH = Math.round((s.min + s.max) / 2);
  let bed = 7 * 60 - targetH * 60;
  if (bed < 0) bed += 24 * 60;
  return `💤 Wind-down soon — age ${age} does best with ~${targetH}h sleep (lights-out around ${formatTimeFromMin(bed)} for a 7 am wake).`;
}

/* ════════════════════════════════════════════════════════════════
   TIME-GRID ENHANCEMENTS
   - categorizeBlock: classify a block into sleep-meal / learning / free
   - getBrickStrip: 30 bricks per day (15-min slots, 6 AM–9 PM)
   - calculateLongestFreeStretch: longest contiguous free run across the week
   - renderTimeGrid: grid + brick strips + summary
   ════════════════════════════════════════════════════════════════ */

/* Time-grid color mode: 'inverted' (default, free=bright) or 'classic' (cat colors) */
// 2a: default to quiet-free — planned blocks carry their saturated category
// colour, free time stays plain paper so an empty week reads as empty. The
// toggle still flips to the older "free-time bright" (inverted) mode.
let tgColorMode = 'classic';

/* Activity IDs that count as Learning/Training (per locked plan) */
const TG_LEARNING_IDS = ['school_day', 'french', 'chinese', 'math', 'piano', 'training', 'competition'];
/* Daily meals that count as Sleep/Meal */
const TG_MEAL_IDS = ['breakfast', 'lunch', 'dinner'];

/**
 * Categorize a block into one of: 'sleep-meal' | 'learning' | 'free'.
 * Per the plan:
 *   sleep-meal = meals (breakfast/lunch/dinner). Sleep itself is outside 6a–9p so doesn't appear in the grid.
 *   learning   = school_day, french, chinese, math, piano, training, OR any block with travelBuffer:true
 *   free       = everything else (active, free, routine, custom, daily-non-meal)
 */
function categorizeBlock(block, act) {
  if (!act) return 'free';
  if (block && block.travelBuffer) return 'learning';
  if (TG_LEARNING_IDS.includes(act.id)) return 'learning';
  if (TG_MEAL_IDS.includes(act.id)) return 'sleep-meal';
  return 'free';
}

/**
 * Returns one brick per 30 minutes across the whole waking window. With the
 * day now running 6 AM–10 PM (DAY_MIN_SPAN = 960) that's 32 bricks, so the
 * late-evening hour is no longer dropped (W8).
 * Brick categories: 'sleep-meal' | 'learning' | 'free' (gap counts as free per plan).
 */
const BRICK_COUNT = Math.round(DAY_MIN_SPAN / 30);
function getBrickStrip(key) {
  const blocks = getDayBlocks(key);
  const acts = getAllActivities(activeProfile(), { includeArchived: true });
  const bricks = [];
  for (let i = 0; i < BRICK_COUNT; i++) {
    const slotStart = START_MIN + i * 30;
    const slotEnd   = slotStart + 30;
    // Find the block that occupies this slot. If multiple overlap, pick the
    // one with the smallest "free-ness" (sleep-meal/learning beats free) so
    // a 30-min lunch inside a long school block is still attributed to learning.
    const overlaps = blocks.filter(b => b.startMin < slotEnd && (b.startMin + b.durationMin) > slotStart);
    if (overlaps.length === 0) {
      bricks.push({ category: 'free', block: null, act: null });
    } else {
      // Pick the block whose START is closest to (or inside) this slot — gives
      // the visually-dominant block for this 30-min window.
      let best = overlaps[0];
      for (const b of overlaps) {
        if (b.startMin >= slotStart && b.startMin < slotEnd) { best = b; break; }
      }
      const act = acts.find(a => a.id === best.actId);
      bricks.push({ category: categorizeBlock(best, act), block: best, act });
    }
  }
  return bricks;
}

/**
 * Find the longest contiguous run of 'free' bricks across the whole week.
 * Returns { minutes, dayKey, dayIdx, startMin } or null if no free time.
 */
function calculateLongestFreeStretch(keys) {
  let best = null;
  keys.forEach((key, dayIdx) => {
    const bricks = getBrickStrip(key);
    let runStart = -1;
    for (let i = 0; i <= bricks.length; i++) {
      const isFree = i < bricks.length && bricks[i].category === 'free';
      if (isFree && runStart === -1) runStart = i;
      if ((!isFree || i === bricks.length) && runStart !== -1) {
        const runLen = i - runStart;
        const minutes = runLen * 30;
        if (!best || minutes > best.minutes) {
          best = { minutes, dayKey: key, dayIdx, startMin: START_MIN + runStart * 30 };
        }
        runStart = -1;
      }
    }
  });
  return best;
}

function formatStretchLabel(stretch) {
  if (!stretch || !stretch.minutes) return null;
  const h = Math.floor(stretch.minutes / 60);
  const m = stretch.minutes % 60;
  let timeStr = '';
  if (h > 0 && m > 0) timeStr = `${h}h ${m}m`;
  else if (h > 0)     timeStr = `${h} hour${h>1?'s':''}`;
  else                timeStr = `${m}m`;
  // Day-of-week + part of day (morning/afternoon/evening based on startMin)
  const startHour = Math.floor(stretch.startMin / 60);
  let part = 'morning';
  if (startHour >= 12 && startHour < 17) part = 'afternoon';
  else if (startHour >= 17) part = 'evening';
  return `${timeStr} (${DAY_LONG[stretch.dayIdx]} ${part})`;
}

/* Time-Grid: 7-column hour grid that visualizes free time. */


/* ── The second tab: what the Print button will print ─────────────
   A HOST, not a second renderer. renderPrintSheet (js/16-print.js) draws the
   same sheet into #printSheet for the real thing and into this element for the
   preview, so the two can never drift — the whole reason Day Blocks was
   retired rather than restyled was that a fourth rendering of a week is a
   fourth thing that can disagree.

   Read-only costs nothing to enforce here: the print markup carries no
   handlers at all, only title attributes. It follows the week and the child
   the screen is already showing. */
function renderWeekPrintPreview() {
  renderPrintSheet('weekPreviewSheet', { weekOffset, profile: activeProfile() });
}

/* renderTimeGrid drew the Day Blocks layout — one lane per day, an hour grid
   behind, a short label on every block. It was the week's default view and is
   retired: the week opens on the Full layout, which is the one you can plan and
   tick in, and the second tab is now a read-only preview of the printed sheet.
   tg2ShortLabel went with it — it compressed a name to about seven characters,
   which no surviving surface asks for. */


/* Render the streak banner above the grid */
/* The colour key, built live from the group table rather than typed out. The
   version before this was parent-only, hardcoded, and sat inside a container
   that was permanently display:none — so it could never appear whatever set it.
   Short forms: this is a key under a grid, not a chart axis, and it is spending
   a child's word budget to say what the colours mean. */
function renderWeekLegend() {
  const legend = document.getElementById('weekLegend');
  if (!legend) return;
  legend.style.display = 'flex';
  /* THE COLOURS THE CARDS ACTUALLY WEAR — every one of them. This listed the
     eight chart groups first, which is a different table entirely, and then the
     six CATEGORIES, which is closer but still not what a card wears: a block is
     coloured by its SUBGROUP, and half of those never appeared in the key.
     Helping hands, Appointments, Language, Arts, Everyday movement and Seasonal
     treats were six hues on the grid that the legend did not explain — and one
     of them, Helping hands, was the colour a parent could not tell from Play.

     Grouped under the category heading so twelve chips still read as six ideas
     rather than a wall of dots. */
  legend.innerHTML = ACTIVITY_CATEGORIES.map(c =>
    `<span class="tg-legend-group"><span class="tg-legend-cat">${escapeHtml(c.short)}</span>`
    + c.subs.map(sg =>
        `<span class="tg-legend-chip"><span class="tg-legend-dot" style="background:${sg.hex /* safe: from ACTIVITY_CATEGORIES */}"></span>${escapeHtml(sg.label.replace(/^\S+\s*/, ''))}</span>`
      ).join('')
    + `</span>`
  ).join('') + `<span class="tg-legend-chip"><span class="tg-legend-dot tg-legend-dot--free"></span>Free time</span>`;
}

/* The longest free stretch, under the week it describes. Named for the layout
   it used to live in; it belongs to the week, not to a tab. */
function renderWeekStreak(keys) {
  const el = document.getElementById('weekStreak');
  if (!el) return;
  const stretch = calculateLongestFreeStretch(keys);
  const label = formatStretchLabel(stretch);
  if (!label) {
    el.innerHTML = '<span class="star">✨</span> No free time this week yet';
    return;
  }
  el.innerHTML = `<span class="star">🌟</span> Longest free stretch: <strong>${label}</strong>`;
}


/* Buffer segments for a block, stacked so get-ready/travel/warm-up never occupy
   the same minutes: before the block you get ready FIRST, then travel (drive),
   then warm up right at the venue, then the activity; after it you travel home,
   then put the gear away. Warm-up is one-sided — you don't warm up on the way
   home. Returns segments with startRel (minutes from START_MIN), dur, icon,
   min — time order. Getting skate boots ready can't happen while driving, so
   the buffers are laid end-to-end, not stacked on the same slot. */
function wfBufferSegments(b) {
  // Per leg: going there and coming home are separate facts on a block now.
  const travelPre  = getTravelBufMin(b, 'pre');
  const travelPost = getTravelBufMin(b, 'post');
  const readyPre   = getGetReadyBufMin(b, 'pre');
  const readyPost  = getGetReadyBufMin(b, 'post');
  const warmupMin  = getWarmupBufMin(b);
  const relStart = b.startMin - START_MIN;
  const dur = Math.max(5, b.durationMin || 0);
  const relEnd = relStart + dur;
  const segs = [];
  // Before: [get-ready][travel][warm-up][ACTIVITY]
  if (warmupMin > 0)  segs.push({ startRel: relStart - warmupMin, dur: warmupMin, icon: '🔥', min: warmupMin, kind: 'warmup', side: 'pre' });
  if (travelPre > 0)  segs.push({ startRel: relStart - warmupMin - travelPre, dur: travelPre, icon: '🚗', min: travelPre, kind: 'travel', side: 'pre' });
  if (readyPre  > 0)  segs.push({ startRel: relStart - warmupMin - travelPre - readyPre, dur: readyPre, icon: '👕', min: readyPre, kind: 'ready', side: 'pre' });
  // After: [ACTIVITY][travel][get-ready]
  if (travelPost > 0) segs.push({ startRel: relEnd, dur: travelPost, icon: '🚗', min: travelPost, kind: 'travel', side: 'post' });
  if (readyPost  > 0) segs.push({ startRel: relEnd + travelPost, dur: readyPost, icon: '👕', min: readyPost, kind: 'ready', side: 'post' });
  segs.forEach(s => { s.endRel = s.startRel + s.dur; });
  return segs;
}

/* Human label for one buffer segment, at three widths, so a strip reads as a
   real instruction ("leave by 5:30p") rather than a bare "🚗15m" wherever
   there's room for it — the print sheet and the weekly cards both need this,
   not just the day view. `tier` is 'long' | 'short' | 'time' | 'tiny' — and
   they are not one ramp: `short` names the KIND and the minutes, `time` names
   the clock, and which of the two is worth more depends on the surface. The
   print sheet has room for the kind; the Full week's column does not, and there
   the clock is the whole point. */
/* WHEN TO LEAVE AND WHEN YOU ARE BACK — the shortest form that still says it.
   Somewhere to put the fact when the full sentence does not fit the column,
   which on the Full week is always: "🚗 Leave by 7:40am (15m)" costs about
   168px of this type and a seven-day column is 95–129px. The old ladder went
   straight from that to "🚗 Travel 15m", which drops the only figure a parent
   acts on and keeps the one the strip's own length already shows. THE CLOCK
   TIME IS WHAT SURVIVES; the minutes are what go. */
/* ── WHAT A BUFFER SEGMENT IS CALLED ──
   Side-aware, because the two get-ready buffers are different jobs: before a
   block you are GETTING READY, with a deadline; after it you are UNPACKING,
   with none. Three of the four places that named a kind were not side-aware, so
   the post side read "Get ready" on the print sheet and in every tooltip —
   `seg.side` was in scope at each of them and simply not asked. */
function bufferKindLabel(seg) {
  if (!seg) return '';
  if (seg.kind === 'travel') return 'Travel';
  if (seg.kind === 'warmup') return 'Warm-up';
  return seg.side === 'post' ? 'Unpack' : 'Get ready';
}
/* And the glyph, for the same reason. 🧺 coming back, 👕 going out. */
function bufferKindIcon(seg) {
  if (!seg) return '';
  if (seg.kind === 'ready' && seg.side === 'post') return '🧺';
  return seg.icon;
}

function bufferSegTime(seg) {
  const startAbs = seg.startRel + START_MIN;
  const endAbs = seg.endRel + START_MIN;
  // 🏠 rather than 🚗 coming home: the icon says which end of the trip it is.
  if (seg.kind === 'travel' && seg.side === 'post') return `🏠 ${formatTimeFromMin(endAbs)}`;
  if (seg.kind === 'ready'  && seg.side === 'post') return `🧺 ${formatTimeFromMin(endAbs)}`;
  return `${seg.icon} ${formatTimeFromMin(startAbs)}`;
}

function bufferSegLabels(seg, tier) {
  const startAbs = seg.startRel + START_MIN;
  const endAbs = seg.endRel + START_MIN;
  if (tier === 'tiny') return `${bufferKindIcon(seg)}${seg.min}m`;
  if (tier === 'time') return bufferSegTime(seg);
  if (tier === 'short') {
    return `${bufferKindIcon(seg)} ${bufferKindLabel(seg)} ${seg.min}m`;
  }
  // long
  /* FROM, not "done by". The deadline is already said by the travel label
     that follows it ("Leave by 7:55am"), and it was the only figure here:
     the moment she has to START is the one this tooltip alone can give,
     and it is what the visible band drops first when the column narrows. */
  if (seg.kind === 'ready' && seg.side === 'pre')  return `${seg.icon} Get ready from ${formatTimeFromMin(startAbs)} (${seg.min}m)`;
  if (seg.kind === 'travel' && seg.side === 'pre') return `${seg.icon} Leave by ${formatTimeFromMin(startAbs)} (${seg.min}m)`;
  if (seg.kind === 'warmup')                       return `${seg.icon} Warm up by ${formatTimeFromMin(startAbs)} (${seg.min}m)`;
  if (seg.kind === 'travel' && seg.side === 'post') return `${seg.icon} Home about ${formatTimeFromMin(endAbs)} (${seg.min}m)`;
  if (seg.kind === 'ready' && seg.side === 'post')  return `🧺 Unpack ${seg.min}m — done by ${formatTimeFromMin(endAbs)}`;
  return `${seg.icon} ${seg.min}m`;
}

/* Distinguish a tap from a scroll/drag so a large block (like Training) that
   fills the timeline doesn't open its editor every time the user tries to
   scroll past it. If the pointer moves beyond a small threshold — or the
   browser cancels the pointer to start scrolling — the following click is
   treated as a scroll gesture and ignored.

   LOAD-BEARING FOR THE DRAG LAYER: `moved` is set by a pointermove on this
   element OR ANY DESCENDANT, and js/39-block-drag.js appends its grip and
   resize handles as descendants of the block. That is the whole reason a drag
   cannot also open the edit sheet, and there is no suppression code on the
   other side to notice if it stopped being true. Narrowing these listeners to
   the element itself would make every drag open the editor as well.
   `aDraggedBlockDoesNotAlsoOpenItsEditor` in tests/smoke.js holds it. */
function attachTapGuard(el, onTap) {
  let sx = 0, sy = 0, moved = false;
  el.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; moved = false; }, { passive: true });
  el.addEventListener('pointermove', (e) => {
    if (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) moved = true;
  }, { passive: true });
  el.addEventListener('pointercancel', () => { moved = true; }, { passive: true });
  el.onclick = (e) => {
    e.stopPropagation();
    if (moved) { moved = false; return; }
    onTap(e);
  };
}

/* Scroll one element by (dx, dy) and report back what it could not absorb.
   Reading scrollTop after the write rather than doing the arithmetic is what
   makes the clamp honest: an element with no vertical overflow returns the
   whole of dy, which is what lets the caller pass it on. */
function panLeftover(el, dx, dy) {
  if (!el) return { dx, dy };
  const l0 = el.scrollLeft, t0 = el.scrollTop;
  el.scrollLeft = l0 + dx;
  el.scrollTop  = t0 + dy;
  return { dx: dx - (el.scrollLeft - l0), dy: dy - (el.scrollTop - t0) };
}

/* ── Middle-button panning ──
   The week grid is covered edge to edge in cards, each with its own pointer
   handlers, and the browser's own middle-click autoscroll is easy to lose:
   it needs an unobstructed scroll container under the cursor and a mousedown
   nobody cancelled. Rather than depend on that, drive it ourselves — press the
   middle button anywhere in the view and move to scroll, in both axes.

   Two things were wrong with the first version and both are fixed here.

   It grabbed the canvas — `scrollTop = start - dy`, so moving the mouse DOWN
   panned the view UP. That is the convention for a hand tool you are dragging a
   document with; it is the opposite of the browser's middle-click autoscroll,
   which is what a mouse user pressing the middle button is asking for. Moving
   down scrolls down now.

   And it only ever moved the element it was bound to. Once the grid reached its
   end the drag was dead, and because pointerdown calls preventDefault the
   browser's own autoscroll was not there to take over either — so the glance and
   goals panels below the grid could not be reached by middle-dragging over it at
   all. Whatever the element cannot absorb now chains to the page, the way a
   wheel does.

   Deltas are taken move-to-move rather than from the press anchor, so a run that
   crosses a scroll limit and comes back does not jump: the clamp is applied to
   each step and the leftover is handed on.

   Idempotent: every render rebuilds the contents but the wrap element itself
   survives, so the flag stops listeners from stacking up. */
function attachMiddleDragPan(el) {
  if (!el || el.dataset.midPanBound) return;
  el.dataset.midPanBound = '1';
  let panning = false, lx = 0, ly = 0;
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 1) return;                 // middle button only
    panning = true;
    lx = e.clientX; ly = e.clientY;
    el.setPointerCapture(e.pointerId);
    el.classList.add('is-mid-panning');
    e.preventDefault();                         // suppress the browser's own autoscroll
  });
  el.addEventListener('pointermove', (e) => {
    if (!panning) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    const rest = panLeftover(el, dx, dy);
    if (rest.dx || rest.dy) panLeftover(document.scrollingElement || document.documentElement, rest.dx, rest.dy);
    e.preventDefault();
  });
  const end = (e) => {
    if (!panning) return;
    panning = false;
    el.classList.remove('is-mid-panning');
    try { el.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  // Middle-click on a link/card would otherwise still fire after the drag.
  el.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
}
/* Every scroll surface a plan is read on. .wpp-wrap is in the list even though
   it does not scroll itself: it is where the cursor is when a parent pans the
   print preview, and its leftover — which is all of it — carries the page.
   (.tg2-wrap was here for the same reason, for the retired Day Blocks week.) */
function bindMiddleDragPan() {
  ['.weekly-full-wrap', '.wpp-wrap', '#screen-day .day-workspace']
    .forEach(sel => document.querySelectorAll(sel).forEach(attachMiddleDragPan));
}

function renderFullWeek(keys) {
  const grid = document.getElementById('weeklyFullGrid');
  grid.innerHTML = '';
  const acts = getAllActivities(activeProfile(), { includeArchived: true });

  // ── Week-level conflict summary banner (shown above the grid) ──
  renderWeekConflictBanner(keys);
  renderFamilyChoreBanner('weekFamilyBanner');
  /* Above the grid, and only there — it is a to-do, and the bottom of
     .weekly-full-wrap is 691px of grid below the fold (index.html says why). */
  renderSchoolDayBanner('weekSchoolBannerTop');
  renderWeekStreak(keys);
  renderWeekLegend();

  // Continuous single-column-per-day timeline (matches the Day view): each
  // activity is ONE unbroken block positioned by its real start time on a
  // shared px-per-minute scale, so nothing is ever sliced at a band boundary.
  const PX_PER_MIN = 0.72;
  /* The shortest a card is ever drawn. The stylesheet carries the same number
     (.wf-card min-height in css/app.css) and the two must not drift: this was
     16 here against 18 there, so a 15-minute card was JUDGED at a height it
     never had. blockContentTier saw 16, the `name` tier needs 20, and a card
     that actually rendered 18px tall was told it had no room for its own name
     — the reason a quarter-hour block showed one emoji and nothing else.
     20 is the `name` tier, so the shortest block the app allows can say what
     it is. */
  const WF_CARD_MIN_PX = 20;
  /* What each row of a STACKED card actually costs, measured in the browser at
     the sizes #screen-week ships rather than guessed. The old arithmetic
     budgeted 58px for the four fixed rows and 20px a goal line; the real
     figures are 66 and 17, because the kid readability floor lifted
     .wf-card-time, -dur and -sum to 13.1px and nothing re-measured what fits.
     Worse, .wf-card--tall .wf-card-name allows TWO lines (max-height: 2.3em)
     and the budget only ever counted one. Every stacked card had been
     overflowing its own box by 7-21px, which is how a training block's goals
     came to run straight through the duration underneath them.
     theStackedCardFitsWhatItDraws (tests/smoke.js) is what keeps these
     honest — they are measurements, so a font change invalidates them. */
  const WF_ROW = { icon: 20, name1: 14, name2: 29, dur: 13, time: 13, sum: 15, gap: 2 };
  const WF_NAME_ONE_LINE_CHARS = 13;

  /* What a card of this height can afford to stack, in priority order: the icon
     and name always, then the duration (the one thing the card's position and
     size do not already say precisely), then as many goal lines as fit, then
     the start-time chip with whatever is left. A two-line name is a luxury the
     card buys only if a goal line still fits after it. */
  function wfStackPlan(pxHeight, name) {
    const fixed = WF_ROW.icon + WF_ROW.dur + 3 * WF_ROW.gap;
    /* Reserving two lines for a name that renders on one wastes a goal line on
       every card, and "Skating" has never needed two. The estimate is crude —
       a column is 95-129px and this type is ~7px a character — but it cannot
       overflow, because a plan that says one line ALSO emits .wf-card--nameclamp,
       which holds the name to one line whatever the estimate got wrong. A long
       name a parent typed still gets its second line. */
    const mightWrap = [...String(name || '')].length > WF_NAME_ONE_LINE_CHARS;
    const twoLine = mightWrap && (pxHeight - fixed - WF_ROW.name2) >= (WF_ROW.sum + WF_ROW.gap);
    const nameH = twoLine ? WF_ROW.name2 : WF_ROW.name1;
    let room = pxHeight - fixed - nameH;
    if (room < 0) return { stack: false, rows: 0, twoLine: false, time: false };
    const rows = Math.max(0, Math.floor(room / (WF_ROW.sum + WF_ROW.gap)));
    room -= rows * (WF_ROW.sum + WF_ROW.gap);
    return { stack: true, rows, twoLine, time: room >= WF_ROW.time + WF_ROW.gap };
  }
  const totalH = Math.round(DAY_MIN_SPAN * PX_PER_MIN);

  /* WEEKDAY_BANDS and WEEKEND_BANDS lived here: four hardcoded stretches with
     school at 180–540, which is 9am–3pm, and a `dow === 0 || dow === 6` test to
     choose between them. Both halves were wrong. The band said 9am while
     schoolHours() says 8, so this view disagreed with the day view by an hour;
     and asking the weekday meant Christmas Day, a PD day and every day of July
     drew a full "🏫 School" band. dayZoneSegments (js/08-day-view.js) has been
     the calendar-aware answer all along — it just had one caller. */

  // ── Header row: sideband corner + gutter corner + 7 day headers ──
  const bandCorner = document.createElement('div');
  bandCorner.className = 'wf-corner';
  grid.appendChild(bandCorner);
  const corner = document.createElement('div');
  corner.className = 'wf-corner';
  grid.appendChild(corner);
  keys.forEach((key, ci)=>{
    const d = formatDayKey(key);
    const header = document.createElement('div');
    header.className = 'wf-day-header' + (key===todayKey() ? ' today' : '');
    header.innerHTML = `<div class="wf-col-dow">${DAY_SHORT[ci]}</div><div class="wf-col-date">${d.getDate()}</div>`;
    header.onclick = ()=>openDay(key, ci);
    grid.appendChild(header);
  });

  const firstHour = Math.ceil(START_MIN / 60);
  const lastHour  = Math.floor((START_MIN + DAY_MIN_SPAN) / 60);

  // ── Left sideband: the day view's time-of-day axis for the whole week ──
  const sideband = document.createElement('div');
  sideband.className = 'wf-sideband';
  sideband.style.height = totalH + 'px';
  /* One axis describes seven days, so it has to pick one to describe. The
     week's first school day is the honest choice: it is the rhythm the axis is
     for. A week with no school in it says so rather than drawing a school shape
     nothing on screen has. */
  const axisKey = keys.find(k => isSchoolDay(k)) || null;
  const axisSegs = axisKey
    ? dayZoneSegments(axisKey)
    : [{ start: 0, end: DAY_MIN_SPAN, label: '🎉 Free time', cls: 'tl-band-free' }];
  /* What SHAPE a day has, as one comparable string. A column names its zones
     only when its shape differs from the one the axis is describing — see the
     note on `labelledCol` below. */
  const axisShape = axisSegs.map(x => `${x.start}:${x.end}:${x.label}`).join('|');
  axisSegs.forEach(bd => {
    const seg = document.createElement('div');
    // The day view's palette, so the two screens tint a school day alike.
    seg.className = 'wf-sideband-seg ' + bd.cls.replace('tl-band-', 'wf-band-');
    seg.style.top = (bd.start * PX_PER_MIN + 1) + 'px';
    seg.style.height = Math.max(0, (bd.end - bd.start) * PX_PER_MIN - 3) + 'px';
    seg.textContent = ZONE_SHORT[bd.label] || bd.label;
    seg.title = bd.label;
    sideband.appendChild(seg);
  });
  grid.appendChild(sideband);

  // ── Slim gutter with hour labels down the side ──
  const gutter = document.createElement('div');
  gutter.className = 'wf-gutter';
  gutter.style.height = totalH + 'px';
  for (let h = firstHour; h <= lastHour; h++) {
    const rel = h*60 - START_MIN;
    if (rel < 0 || rel > DAY_MIN_SPAN) continue;
    const lbl = document.createElement('div');
    lbl.className = 'wf-gutter-hour';
    lbl.style.top = (rel * PX_PER_MIN) + 'px';
    lbl.textContent = `${((h+11)%12)+1}${h>=12?'p':'a'}`;
    gutter.appendChild(lbl);
  }
  grid.appendChild(gutter);

  /* ── HOW WIDE A DAY COLUMN REALLY IS ──
     Everything below that refuses a label for not fitting ACROSS needs this
     number, and it was being read off `cell.clientWidth` — from a cell that is
     appended to the grid at the END of its own iteration, so the value was
     always 0 and the `|| 120` fallback was always what got used. That is not a
     near miss: the band label "👕15 🚗15 · 7:40am" costs 118.8px and missed the
     115px that fallback produces by under four pixels, so every buffer strip on
     this surface went silent over a budget nothing had measured.

     The day HEADERS are already in the grid and sit in the same tracks
     (`grid-template-columns: 18px 40px repeat(7, minmax(0, 1fr))`), so one
     header measures every column, once, with no per-cell reflow. A render while
     the screen is hidden measures 0 — then derive from the grid, and only if
     that is 0 too fall back to a realistic column rather than an optimistic
     one. */
  const headerEl = grid.querySelector('.wf-day-header');
  const measuredCol = headerEl ? headerEl.getBoundingClientRect().width : 0;
  const derivedCol = grid.clientWidth ? (grid.clientWidth - 58) / 7 : 0;
  const dayColPx = Math.round(measuredCol || derivedCol || 110);

  // ── One continuous lane per day ──
  keys.forEach((key, ci) => {
    // The calendar decides, not the weekday. Same function the day view uses.
    const bands = dayZoneSegments(key).map(b => ({ ...b, cls: b.cls.replace('tl-band-', 'wf-band-') }));
    /* ── A ZONE NAME IS DRAWN WHERE IT IS NEWS ──
       This was `!isSchoolDay(key) || key !== axisKey`, which silences the axis
       day itself and labels every OTHER identical school day — four columns
       times four zones on an ordinary week, sixteen repeats of what the
       sideband already says once, competing with the cards and the buffer
       times for the same pixels. The same expression failed the other way on a
       week with no school at all: `axisKey` is then null, `key !== axisKey` is
       true everywhere, and all seven columns printed "🎉 Free time".

       A column speaks only when its shape DIFFERS from the axis day's. An
       ordinary school week draws none — the tint carries it and the sideband
       names all four once, vertically, for the whole grid — and a PD day or a
       holiday inside a term week is the one thing worth saying, so it says it.

       Compared as a signature rather than as `isSchoolDay(key) ===
       isSchoolDay(axisKey)`. Those are equivalent today, because schoolHours()
       takes no day argument — but the signature states the rule the screen
       actually follows, so an early-dismissal Wednesday would light up on its
       own instead of needing this line found again. */
    const colShape = bands.map(x => `${x.start}:${x.end}:${x.label}`).join('|');
    const labelledCol = colShape !== axisShape;

    /* The zone names this column draws, kept so a buffer strip landing in the
       same pixels can take one down — see the note at the end of the strip
       pass below. Declared here because the band loop fills it. */
    const bandLabels = [];
    const spokenStrips = [];

    const cell = document.createElement('div');
    cell.className = 'wf-day-col' + (key===todayKey() ? ' today' : '');
    cell.style.height = totalH + 'px';
    cell.onclick = (e)=>{
      // Only open the day when the empty lane (not a card) is tapped.
      // The bands and the hour grid take no pointer events, so a click on either
      // arrives with the cell as its target; only the cards stop it.
      if (e.target === cell || e.target.classList.contains('wf-band')) {
        openDay(key, ci);
      }
    };

    /* Zone tint bands behind everything. The left axis already names the shape
       it describes, so the column that matches it stays unlabelled; every other
       column names its own — which is what makes a holiday in the middle of a
       term readable as one rather than as a column that lost its tint. */
    bands.forEach(bd => {
      const seg = document.createElement('div');
      seg.className = 'wf-band ' + bd.cls;
      seg.style.top = (bd.start * PX_PER_MIN) + 'px';
      seg.style.height = ((bd.end - bd.start) * PX_PER_MIN) + 'px';
      cell.appendChild(seg);
      if (labelledCol && bd.label && (bd.end - bd.start) * PX_PER_MIN >= 24) {
        const lbl = document.createElement('div');
        lbl.className = 'wf-band-label';
        lbl.style.top = (bd.start * PX_PER_MIN + 2) + 'px';
        lbl.textContent = bd.label;
        lbl.dataset.top = String(bd.start * PX_PER_MIN + 2);
        cell.appendChild(lbl);
        bandLabels.push(lbl);
      }
    });

    /* The hour gridlines used to be drawn here, before the cards, at z-index 1
       against .wf-card's 2 — so on a planned day they were under every block
       and the eye had nothing to anchor to. They go on last now, as an overlay,
       and the two loops that draw them no longer disagree: this one skipped 6am
       and 10pm with `<=`/`>=` while the gutter labelled them with `<`/`>`.
       buildHourGrid (js/05-helpers.js) owns both ends of that now. */

    // "Now" marker on today's column.
    if (key === todayKey()) {
      // Same zone as todayKey, or the line lands on the wrong hour of the day.
      const nowMin = nowMinutesInZone() - START_MIN;
      if (nowMin > 0 && nowMin < DAY_MIN_SPAN) {
        const nl = document.createElement('div');
        nl.className = 'wf-now-line';
        nl.style.top = (nowMin * PX_PER_MIN) + 'px';
        cell.appendChild(nl);
      }
    }

    const blocks = (getDayBlocks(key) || []).slice().sort((a,b)=>a.startMin - b.startMin);
    /* One geometry, read by the lane pass, the cards and the overrun layer.
       The 3px lane gap is the same one the cards and strips below lay out
       with. */
    const boxes = wfCardBoxes(blocks, { pxPerMin: PX_PER_MIN, minPx: WF_CARD_MIN_PX, gapPx: 3 });
    const cols = wfAssignColumns(blocks, { boxes, gapPx: 3 });
    /* block id -> { pre?: segs, post?: segs } for the sides whose strips were
       too small to print their own time. Filled by the strip pass below and
       read by the cards, which have the height the strips do not. */
    const silent = new Map();
    /* block id -> { pre?: '👕7:40am', post?: ... } for a side that DID
       speak and was still a figure short, because its width only stretched to
       the leave-by time. Same contract as `silent` above, one rung further in:
       the strips are asked what they printed, the card prints the remainder. */
    const unsaidTimes = new Map();

    const bufferConflicts = computeBufferConflicts(blocks);

    // Travel / get-ready strips (underneath cards), stacked so getting ready and
    // driving never share the same minutes. Coloured to match the activity
    // they belong to, and flagged red when they'd overlap another activity —
    // i.e. there isn't actually enough time to travel/get ready.
    blocks.forEach(b => {
      const act = acts.find(a=>a.id===b.actId);
      const topic = act && act.isTraining ? getTrainingTopic(b.tag) : null;
      /* THE STRIP WEARS THE BLOCK'S COLOUR, from the one owner. This read
         `b.colour` first — the hex a placement SEEDED onto the block — which
         blockColour deliberately ignores when the value is one the table itself
         wrote. So the moment a subgroup's hue changed, every card already on the
         calendar drew in the new colour with its own travel strip still in the
         old one. blockColour is the answer to "what colour is this block", and
         it already handles the training topics this line was special-casing. */
      const segColour = blockColour(b);
      const bc = bufferConflicts.perBlock.get(b.id);
      // Match the buffer strip to its own block's column, so a get-ready/drive
      // strip sits directly under (and the same width as) the card it belongs to
      // instead of spanning the whole day column.
      const slot = cols.get(b.id) || { col: 0, count: 1 };
      const colCount = slot.count || 1;
      const gap = 3;
      const leftCss  = 'calc(' + (slot.col * 100 / colCount) + '% + 1px)';
      const widthCss = 'calc(' + (100 / colCount) + '% - ' + (gap + 2) + 'px)';
      /* How wide this strip will actually be, so a label can be refused for not
         fitting ACROSS as well as for not fitting down. A lane split halves it. */
      const colPx = Math.max(40, dayColPx / colCount - (gap + 2));
      const preBufMin  = getTravelBufMin(b, 'pre') + getGetReadyBufMin(b, 'pre')
                       + getWarmupBufMin(b);
      const postBufMin = getTravelBufMin(b, 'post') + getGetReadyBufMin(b, 'post');
      /* A STRIP STOPS WHERE THE NEXT CARD STARTS. It used to be drawn at its
         full length, straight through whatever it ran into — School Day's
         travel home painted over the top of Homework, so neither the strip nor
         the card's name and tick could be read. bufferClip (js/05-helpers.js)
         is the one owner of how much of the window is real time; the minutes
         that did NOT fit become the overrun layer on the card it runs into, and
         the same figure reaches the banner through computeBufferConflicts. */
      const drawn = bufferDrawSegments(wfBufferSegments(b), b.startMin,
        b.startMin + (b.durationMin || 0), preBufMin, postBufMin,
        blocks.filter(o => o.id !== b.id));
      /* Grouped by side, so a run of segments too short to speak can merge into
         one band that can. Only when some segment cannot carry text: two
         thirty-minute strips keep their own labels, as they always did. */
      ['pre', 'post'].forEach(side => {
        const sideSegs = drawn.segs.filter(x => x.side === side)
          .filter(x => Math.min(x.drawEndRel, DAY_MIN_SPAN) - Math.max(x.drawStartRel, 0) >= 2);
        if (!sideSegs.length) return;
        /* THE FACT NEVER DISAPPEARS. A lone fifteen-minute buffer is 10.8px and
           cannot hold a 13.1px line at any width, so the strip says nothing and
           "when do we leave" is simply gone from the screen. Rather than guess
           at that here — a second copy of the tier ladder is exactly how these
           two would drift — the elements are ASKED whether they muted, and the
           card picks up whatever the strips could not say. */
        silent.set(b.id, silent.get(b.id) || {});
        const spoke = els => els.length > 0 && els.some(el => !el.classList.contains('wf-travel--mute'));
        const record = els => {
          if (!spoke(els)) silent.get(b.id)[side] = sideSegs;
          else {
            const said = els.map(el => el.textContent || '').join(' ');
            const un = wfSideTimeUnsaid(sideSegs, said);
            if (un) unsaidTimes.set(b.id, Object.assign(unsaidTimes.get(b.id) || {}, { [side]: un }));
          }
          // Where a time actually printed, for the band-label pass below.
          els.forEach(el => {
            if (el.classList.contains('wf-travel--mute')) return;
            const top = parseFloat(el.style.top) || 0;
            spokenStrips.push([top, top + (parseFloat(el.style.height) || 0)]);
          });
        };
        const segConflict = !!bc && (side === 'pre' ? bc.pre : bc.post);
        const anyMute = sideSegs.some(x =>
          (Math.min(x.drawEndRel, DAY_MIN_SPAN) - Math.max(x.drawStartRel, 0)) * PX_PER_MIN < WF_TRAVEL_TEXT_MIN_PX);
        if (anyMute && sideSegs.length > 1) {
          const bandS = Math.max(Math.min(...sideSegs.map(x => x.drawStartRel)), 0);
          const bandE = Math.min(Math.max(...sideSegs.map(x => x.drawEndRel)), DAY_MIN_SPAN);
          const band = wfBufferBand(bandS * PX_PER_MIN, (bandE - bandS) * PX_PER_MIN,
            leftCss, widthCss, sideSegs, segColour, segConflict, colPx);
          cell.appendChild(band);
          record([band]);
          return;
        }
        const made = [];
        sideSegs.forEach(seg => {
          const segS = Math.max(seg.drawStartRel, 0);
          const segE = Math.min(seg.drawEndRel, DAY_MIN_SPAN);
          const strip = wfTravelStrip(segS * PX_PER_MIN, (segE - segS) * PX_PER_MIN,
            leftCss, widthCss, seg, segColour, segConflict, null, colPx);
          cell.appendChild(strip);
          made.push(strip);
        });
        record(made);
      });
    });

    /* ── A ZONE NAME IS NOT DRAWN WHERE A BUFFER STRIP SPEAKS ──
       The bands print their own name at the top of each stretch — "🏫 SCHOOL",
       "🎒 AFTER SCHOOL" — and a buffer run that begins on that boundary lands
       its time in exactly those pixels. While the strips were mute nobody could
       see it; restoring the clock times put two lines of text through each
       other, which is the defect WF_TRAVEL_TEXT_MIN_PX exists to prevent.

       The time wins. It is the one fact on this surface a parent acts on, and
       the zone is still said twice over — by the band's own tint, and by the
       left axis, which names every stretch of the day in full. Pure arithmetic
       on inline pixel values, so it needs no layout and costs no reflow. */
    if (bandLabels.length && spokenStrips.length) {
      bandLabels.forEach(lbl => {
        const top = Number(lbl.dataset.top) || 0;
        const bottom = top + WF_BAND_LABEL_PX;
        const hit = spokenStrips.some(([a, z]) => top < z - 0.5 && bottom > a + 0.5);
        if (hit) lbl.remove();
      });
    }

    // Activity cards — one unbroken block each.
    blocks.forEach(b=>{
      const act = acts.find(a=>a.id===b.actId);
      if (!act) return;
      const startMinOfDay = b.startMin;
      const hr = Math.floor(startMinOfDay/60);
      const min = startMinOfDay % 60;
      const timeStr = `${hr>12?hr-12:hr}:${String(min).padStart(2,'0')}${hr>=12?'p':'a'}`;

      const relStart = b.startMin - START_MIN;
      const dur = Math.max(5, b.durationMin || 0);
      /* From the ONE geometry, so the card is drawn exactly where the lane pass
         thought it would be — including the minutes a floored card borrowed
         from the empty time before it. */
      const cardBox = boxes.get(b.id)
        || { topPx: relStart * PX_PER_MIN, hPx: Math.max(dur * PX_PER_MIN, WF_CARD_MIN_PX) };
      const topPx = cardBox.topPx;
      const pxHeight = cardBox.hPx;

      // Training topics carry their own icon + colour (skating/swimming/dryland).
      const topic = act.isTraining ? getTrainingTopic(b.tag) : null;
      const bg = blockColour(b);
      const dispIcon = topic ? topic.icon : act.icon;
      /* blockDisplayName (js/05-helpers.js) is the one owner of what a block is
         called. This wrote its own answer, which is why a competition that had
         been given a name — "Winter Invitational" — still read "Skating 🏆"
         here while the day view said the right thing. The 🏆 stays: it is what
         keeps a competition from reading as a plain Training block. */
      const named = blockDisplayName(b, activeProfile()).name;
      const dispName = act.isCompetition ? `${named} 🏆` : named;
      const card = document.createElement('div');
      // Same ladder the day timeline and the print sheet use — see
      // blockContentTier (js/05-helpers.js). The class names are the ones the
      // stylesheet already knows; what changed is that one function decides
      // them, so a block does not read differently in two views.
      const tier = blockContentTier(pxHeight);
      /* The tier says how much this block may SAY; the plan says how much of it
         actually fits. They disagreed: `detail` starts at 64px and a stacked
         card needs 66 before it draws a single goal line, so the ladder was
         promoting cards into a layout they could not hold. */
      const plan = blockTierAtLeast(tier, 'detail')
        ? wfStackPlan(pxHeight, dispName)
        : { stack: false, rows: 0, twoLine: false, time: false };
      let cls = 'wf-card' + (isLightColour(bg) ? ' light-bg' : '');
      if (plan.stack) {
        cls += ' wf-card--tall'; // room to stack time/icon/name centered
        if (!plan.twoLine) cls += ' wf-card--nameclamp';
        if (!plan.time)    cls += ' wf-card--notime';
      }
      /* Below `meta` a 28px square tick does not fit: at 30px of card, a
         28px box offset 3px from the top overruns the card and is clipped.
         So the tick becomes a full-height strip on the card's edge instead —
         proportional by construction, and it can never again be taller than
         the block it belongs to. There is no icon-only tier any more: the
         floor above IS the `name` tier, so every drawn card can say its name. */
      if (!blockTierAtLeast(tier, 'meta')) cls += ' wf-card--slim wf-card--stripcheck';
      if (isBlockCompleted(b, activeProfile())) cls += ' wf-card--done';
      /* A marker, never a fade. --missed was removed deliberately: an
         UNCONFIRMED block must not be drawn as though the child failed it.
         This is the opposite case — an explicit record a parent made — so it
         gets a ring and a tag, and the fill stays at full strength. */
      const notDone = isBlockNotDone(b);
      if (notDone) cls += ' wf-card--notdone';
      const hasConflict = bufferConflicts.affected.has(b.id);
      if (hasConflict) cls += ' wf-card--conflict';
      card.className = cls;

      const slot = cols.get(b.id) || { col: 0, count: 1 };
      const colCount = slot.count || 1;
      const gap = 3; // px between overlapping columns
      const leftCss  = 'calc(' + (slot.col * 100 / colCount) + '% + 1px)';
      const widthCss = 'calc(' + (100 / colCount) + '% - ' + (gap + 2) + 'px)';
      const colPx = Math.max(20, dayColPx / colCount - (gap + 2));
      /* TOO NARROW TO SAY A WORD. The same question the buffer strips ask about
         their own labels: a seven-day column is about 100px and a lane split
         halves it, so "After-School Routine" renders as a single letter and an
         ellipsis — noise standing where a name should be. The ICON is the
         identifier at that size (it is already the only thing a short card
         draws) and the tooltip still says the whole name. */
      if (colPx < 64) card.classList.add('wf-card--noname');

      const travelMin = getTravelBufMin(b);
      const readyMin  = getGetReadyBufMin(b);
      const warmupMin = getWarmupBufMin(b);
      // Name every buffer kind the block actually carries, instead of
      // collapsing travel + get-ready into a single icon+number.
      const bufKinds = [];
      if (readyMin  > 0) bufKinds.push(`👕${readyMin}m`);
      if (travelMin > 0) bufKinds.push(`🚗${travelMin}m`);
      if (warmupMin > 0) bufKinds.push(`🔥${warmupMin}m`);

      card.style.top = topPx + 'px';
      card.style.height = Math.max(pxHeight - 2, WF_CARD_MIN_PX) + 'px';
      card.style.left  = leftCss;
      card.style.width = widthCss;
      card.style.background = bg;
      /* The buffers already have their own labelled strips beside the card
         ("🚗 7:40a"), so repeating them inside the name is noise — and on a tall
         card it is noise that pushes the name into the rows below. Keep the
         inline tag only where the strips are too short to read.

         WHEN A SIDE WENT SILENT THE CARD SAYS THE TIME, not the minutes, and
         says it at ANY tier. A lone fifteen-minute travel buffer is 10.8px —
         under the height a line of this type needs at any width — so without
         this the one figure a parent acts on is nowhere on the screen. The
         minutes are the wrong fallback for the same reason they are the wrong
         label: the strip's own length already draws them. */
      const mute = silent.get(b.id) || {};
      /* Budgeted, and SHARED when both sides went quiet: a block with a lone
         fifteen-minute leg each way has two facts to fit on one card row, so
         each gets half the width and both fall to their bare form rather than
         one of them running off the edge. */
      /* PRE ONLY. A side that spoke and came up a figure short did so because
         the column is narrow, and on this card the shortfall competes with the
         block's own NAME for the same line. Going out the missing figure is
         when she has to start getting ready, which has a deadline and is worth
         that; coming home it is the unpack time, which has none, so it stays in
         the tooltip rather than pushing "School Day" out of its own card. */
      const short = unsaidTimes.get(b.id) || {};
      const muteSides   = ['pre', 'post'].filter(side => mute[side]);
      const shortSides  = ['pre'].filter(side => short[side]);
      const perSide = (muteSides.length + shortSides.length) > 1 ? (colPx - 6) / 2 : colPx;
      const muteTimes = muteSides
        .map(side => wfSideTimeLabel(mute[side], perSide))
        .filter(Boolean)
        /* And the figure a strip that DID speak still had to drop. In a split
           lane the pre band falls to "🚗7:55" and the moment it starts
           getting ready is nowhere on the grid; this is where it lands. */
        .concat(shortSides.map(side => short[side]).filter(t => wfTextPx(t) <= perSide));
      const travelTag = muteTimes.length
        ? `<span class="wf-card-travel">${muteTimes.join(' ')}</span>`
        : (bufKinds.length && !blockTierAtLeast(tier, 'detail'))
          ? `<span class="wf-card-travel">${bufKinds.join(' ')}</span>` : '';
      const stampEmoji = b.parentStamp && b.parentStamp.emoji ? b.parentStamp.emoji + ' ' : '';
      const conflictTag = hasConflict ? `<span class="wf-card-conflict-badge" title="Not enough travel/get-ready time — overlaps another activity">⚠️</span>` : '';
      const notDoneTag = notDone ? `<span class="wf-card-notdone-badge" title="A grown-up recorded that this did not happen">🚫</span>` : '';
      // Corner flag stays visible on every card size (the inline badge is hidden
      // when a card is too slim for its name), so a clash never hides off-screen.
      /* HOW SHORT, on the flag of the card that is RUN INTO. The overrun layer
         below draws the minutes to scale, but a strip cannot print a number in
         10px and a tooltip does not exist on an iPad — so the round "!" every
         clashing card already carried becomes a pill that says it. It hangs
         above the card's top-left corner, mostly OUTSIDE the card, which is the
         one place that never covers a name at any card height. A card in a
         right-hand lane hangs it at its top-RIGHT, or two lanes' pills collide.
         The partner block — the one whose travel is too long — keeps a plain
         "!": it is not the card being run into. */
      const myShort = clashWorstShort(bufferConflicts, b.id, blocks);
      const conflictFlag = hasConflict
        ? `<div class="wf-card-conflict-flag${myShort ? ' wf-card-conflict-flag--min' : ''}${slot.col > 0 ? ' wf-card-conflict-flag--right' : ''}" title="${escapeAttr(clashTitle(bufferConflicts, b.id, blocks, acts))}">${myShort ? '! ' + myShort + 'm over' : '!'}</div>`
        : '';
      // List as much of "what this block is about" (gear/objectives/note) as
      // the card's own height can hold — gear first since packing is
      // effectively mandatory for a training block, then as many objectives as
      // fit — degrading to a one-line count on cards too short for a list.
      const detailLines = blockDetailLines(b, act);
      let sumHtml = '';
      if (plan.rows && detailLines.length) {
        sumHtml = sliceDetailLines(detailLines, plan.rows)
          .map(r => `<div class="wf-card-sum" title="${escapeHtml(r.text)}">${r.icon} ${escapeHtml(r.text)}</div>`)
          .join('');
      }
      const durHtml = `${formatDuration(b.durationMin)}${(!sumHtml && detailLines.length) ? ' · ' + blockCountsSummary(detailLines) : ''}`;
      card.innerHTML = `
        ${conflictFlag}
        <div class="wf-card-time">${timeStr}</div>
        <div class="wf-card-icon">${escapeHtml(dispIcon)}</div>
        <div class="wf-card-name">${stampEmoji}${notDoneTag}${escapeHtml(dispName)}${travelTag}${conflictTag}</div>
        ${sumHtml}
        <div class="wf-card-dur">${durHtml}</div>
        <button type="button" class="wf-card-check" aria-label="${b.completed?'Mark not done':'Mark done'}"
          onclick="toggleBlockDone('${escapeJsAttr(key)}','${escapeJsAttr(b.id)}',event)">${b.completed?'✓':''}</button>
      `;
      card.title = `${dispIcon} ${dispName} — ${timeStr}, ${formatDuration(b.durationMin)}`
        + (bufKinds.length ? ` · ${bufKinds.join(', ')} each way` : '')
        + (notDone ? ' · 🚫 recorded as not done' : '')
        + (hasConflict ? ' · ⚠️ ' + clashTitle(bufferConflicts, b.id, blocks, acts) : '');
      attachTapGuard(card, ()=> openDayFromWeekCard(key, ci, b.id));
      cell.appendChild(card);
      /* The minutes that did not fit, drawn OVER the card they run into at a
         quarter strength. The overprint used to be the only thing that showed
         how bad a clash was, and it showed it by making both unreadable; this
         keeps the reading — exactly as tall as the overrun, ending in a dashed
         line — while the card's name and tick read straight through it. */
      if (hasConflict && myShort) {
        const ov = document.createElement('div');
        ov.className = 'wf-overrun';
        ov.style.top = topPx + 'px';
        ov.style.height = Math.min(myShort * PX_PER_MIN, pxHeight) + 'px';
        ov.style.left = leftCss;
        ov.style.width = widthCss;
        cell.appendChild(ov);
      }
    });

    /* Rules behind the cards, the hour's mark above them. At 0.72px per minute
       a 15-minute row is under 11px, so this surface keeps the half hour rather
       than taking the day view's quarter rows. See buildHourGrid
       (js/05-helpers.js). */
    cell.appendChild(buildHourGrid(PX_PER_MIN, DAY_MIN_SPAN, { cls: 'hour-grid--wf', layer: 'lines' }));
    cell.appendChild(buildHourGrid(PX_PER_MIN, DAY_MIN_SPAN, { cls: 'hour-grid--wf', layer: 'ticks' }));

    grid.appendChild(cell);
  });
}

/* Scan the whole week for buffer/time clashes and surface a plain-language
   banner so a conflict is obvious the moment the week opens — no hovering, no
   hunting for a red outline. Each day that clashes names the activities that
   don't leave enough travel/get-ready time. */
function renderWeekConflictBanner(keys, bannerId = 'weekConflictBanner') {
  const banner = document.getElementById(bannerId);
  if (!banner) return;
  const acts = getAllActivities(activeProfile(), { includeArchived: true });
  const dayLines = [];
  keys.forEach((key, i) => {
    const blocks = (getDayBlocks(key) || []).slice();
    const conflicts = computeBufferConflicts(blocks);
    if (!conflicts.affected.size) return;
    /* ONE LINE PER CLASHING PAIR, with how short it is. This used to join every
       affected name on the day into a single chain — "School Day ⇆ Homework ⇆
       Ballet ⇆ Evening Routine" — which names four things while saying neither
       which two actually clash nor by how much. Deduped on the sorted id pair,
       so each clash is reported once rather than from both ends. */
    const nameOf = b => {
      const act = acts.find(a => a.id === b.actId);
      const topic = act && act.isTraining ? getTrainingTopic(b.tag) : null;
      return act ? (topic ? topic.name : act.name) : 'Activity';
    };
    const seen = new Set();
    blocks.forEach(b => {
      const sh = conflicts.shortMin && conflicts.shortMin.get(b.id);
      if (!sh) return;
      const partners = (conflicts.partners && conflicts.partners.get(b.id)) || new Set();
      partners.forEach(pid => {
        const other = blocks.find(x => x.id === pid);
        if (!other) return;
        const key2 = [b.id, pid].sort().join('|');
        if (seen.has(key2)) return;
        seen.add(key2);
        const short = other.startMin >= b.startMin ? sh.post : sh.pre;
        dayLines.push(`${DAY_SHORT[i]}: ${nameOf(b)} ⇆ ${nameOf(other)}`
          + (short ? ` · ${short}m short` : ''));
      });
    });
  });
  if (!dayLines.length) { banner.style.display = 'none'; banner.innerHTML = ''; return; }
  const n = dayLines.length;
  banner.style.display = 'flex';
  /* Each pair on its own line rather than joined with " · ": with a shortfall on
     the end, one run-on line is unreadable at exactly the moment it matters. */
  banner.innerHTML =
    `<span class="wcb-icon">⚠️</span>`
    + `<span>${n} time ${n === 1 ? 'clash' : 'clashes'} this week — not enough travel/get-ready time`
    + `<span class="wcb-detail">${dayLines.map(l => '<br>' + escapeHtml(l)).join('')}</span></span>`;
}

/* ── The family's chores, on the week that can still fit them ──
   The count and the rule both belong to js/18-rules.js (mrFamilyChoreStatus);
   this only asks and words the answer.

   Three deliberate limits. It is shown on THIS week only — a week that has
   already gone by cannot be planned, and a banner about it is a reproach with
   nothing to do about it. It hides completely once the floor is met, so it is a
   to-do and never a scoreboard. And it is worded forwards: "still to find a day
   for", not "you didn't do". That is the rule every kid-facing warning in this
   app follows (js/26-chore-kid.js's ck-warn points at a setup mistake to report;
   ck-risk describes exposure that has not happened yet), and it is the reason
   this is its own amber .week-todo-banner rather than the red clash banner —
   nothing here is wrong yet. */
/* ── School days that have no card yet ────────────────────────────
   Its own banner rather than a line inside the blank-week offer, because it is
   not about the week being blank. It follows the same rules as the family
   chores banner: THIS week and the next two only (materialising a 40-week term
   would write hundreds of blocks into a document that uploads whole on every
   change), and it disappears the moment every school day has its card, so it is
   a to-do and never a scoreboard.

   It is drawn ABOVE the grid, and in one place. It used to sit at the bottom of
   .weekly-full-wrap, under 691px of grid plus the colour key and the streak,
   which on a phone is a screen and a half below the fold — and a to-do nobody
   sees is not a to-do. `bannerId` stays a parameter because that is how the host
   stayed swappable and it costs nothing, but there is only one host now. */
function renderSchoolDayBanner(bannerId = 'weekSchoolBannerTop') {
  const banner = document.getElementById(bannerId);
  if (!banner) return;
  const hide = () => { banner.style.display = 'none'; banner.innerHTML = ''; };
  const p = activeProfile();
  if (!p || p === 'parent') return hide();
  const keys = getDayKeys(weekOffset);
  if (!schoolOfferInHorizon(keys)) return hide();
  const days = schoolDaysToOffer(keys, p);
  if (!days.length) return hide();
  banner.style.display = 'flex';
  /* One line that wraps, and the times live in the confirm dialog where they
     are actually being agreed to — this banner is a to-do, not a description of
     the school day.

     A day per chip rather than one all-or-nothing button: the week with a gap
     in it is the week this is for, and refusing four school days because the
     fifth is a PD day the family is away for is the offer being useless at
     exactly the moment it matters. With one day left the chip IS the action, so
     no bulk button is drawn beside it. */
  const chips = days.map(k =>
    `<button type="button" class="wsb-day" onclick="addSchoolDayToDay('${escapeJsAttr(k)}')">`
    + `${escapeHtml(DAY_SHORT[(formatDayKey(k).getDay() + 6) % 7])}</button>`).join('');
  const all = days.length > 1
    ? `<button type="button" class="wins-btn" onclick="addSchoolDaysToWeek('${escapeJsAttr(keys[0])}')">Add all ${days.length}</button>`
    : '';
  banner.innerHTML =
    `<span class="wcb-icon">🏫</span>`
    + `<span>${days.length} school day${days.length === 1 ? '' : 's'} not on the plan</span>`
    + chips + all;
}

function renderFamilyChoreBanner(bannerId = 'weekFamilyBanner') {
  const banner = document.getElementById(bannerId);
  if (!banner) return;
  const kid = activeProfile();
  const hide = () => { banner.style.display = 'none'; banner.innerHTML = ''; };
  if (weekOffset !== 0 || !kid || kid === 'parent' || typeof getFamilyChoreStatus !== 'function') return hide();
  ctPrepareRead();
  const st = getFamilyChoreStatus(kid, ctThisWeekKey());
  /* The first chores of the week are MANDATORY, so a week with fewer than that
     PLANNED is a plan that does not meet the rule — a warning, not a nudge. It
     used to hide as soon as anything was scheduled-or-done, which meant two
     chores merely placed on the calendar silenced it for the week.

     It still measures `planned`, not `fulfilled`: this is the forward-looking
     kid surface, and telling a child on Sunday that she failed a week she can
     no longer change is a reproach with nothing to do about it. The review
     voice — owed / fulfilled / unfulfilled — belongs to the parent and meeting
     screens, which is where a past week's shortfall is always shown. */
  if (!st.stillNeedsADay) return hide();
  const n = st.stillNeedsADay;
  const waiting = st.waiting ? ` · ${st.waiting} waiting for a check` : '';
  banner.style.display = 'flex';
  banner.classList.add('week-todo-banner--warn');
  /* Kept to one line. This is a kid screen with a 200-word budget, and the
     headline already carries the whole instruction — a second line restating
     "tap a day to put them on the plan" was spending words to say it twice. */
  banner.innerHTML =
    `<span class="wcb-icon">🧹</span>`
    + `<span>${st.required} family ${st.required === 1 ? 'chore' : 'chores'} required · ${st.planned} planned · `
    + `${n} still ${n === 1 ? 'needs' : 'need'} a day${waiting}</span>`;
}

/* THE MEASURED cost of one line of buffer-strip text, the way WF_ROW is the
   measured cost of a stacked card's rows. .wf-travel is 0.58rem in the base
   rule, but the kid readability floor at the end of css/app.css lifts
   #screen-week .wf-travel to 0.82rem = 13.12px at line-height 1, and the strip
   is border-box with a 1px dashed border each side — 1.5px once it is a
   conflict strip. 13.12 + 3 = 16.1, so 16 sits exactly on the edge and a
   conflict strip fails it by a fraction. 17 is the first height at which every
   strip can actually hold its own line.

   At the Full week's 0.72px per minute that is 24 minutes: a fifteen-minute
   strip is mute and a thirty-minute band speaks. A type change invalidates this
   number — aBufferStripNeverCoversACard and theStripStillSaysWhenToLeave
   (tests/smoke.js) are what keep it honest. */
const WF_TRAVEL_TEXT_MIN_PX = 17;

/* How tall a zone name is, for the overlap test that takes one down when a
   buffer strip needs the same pixels. A MEASUREMENT, like the constant above:
   .wf-band-label is 0.56rem lifted to the kid floor of 13.1px at line-height 1,
   plus its 1px top padding. */
const WF_BAND_LABEL_PX = 15;

/* -- HOW WIDE A LABEL WILL BE, BEFORE IT IS DRAWN --
   A MEASUREMENT, like the two constants above, and it replaces the
   `text.length * 6.6` this file used to budget with. That estimate charged
   every character the same width, and a buffer label is mostly emoji: the car
   plus "7:55am" is eight units and 65.6 real pixels -- 8.2 each -- while the
   backpack plus " After school" is fifteen units and 100 -- 6.7 each. One
   number was therefore wrong in BOTH directions and wrong by a third: it
   refused labels that fitted, and it accepted labels that then ran off the
   column edge, which is the whole failure the width cap exists to prevent.

   Measured in .wf-travel-band-label's own type (0.82rem lifted to the 13.1px
   kid floor): an emoji is about 21px, an arrow 12, a digit 7.3, a colon 4, a
   letter 9.6. The LETTERS are rounded up, because over-estimating only refuses
   a label that would have fitted while under-estimating draws one that does
   not. The SPACE is charged 1 rather than its own 3.6: every space in a label
   on this surface follows an emoji, whose advance already carries it, and
   charging it in full is what put the two-figure form 4px over a phone column
   it really fits in. A type change invalidates these
   numbers exactly as it invalidates WF_TRAVEL_TEXT_MIN_PX, and
   theStripStillSaysWhenToLeave (tests/smoke.js) measures the real elements
   against what they were allowed to draw. */
function wfTextPx(s) {
  let px = 0;
  for (const ch of String(s == null ? '' : s)) {
    const cp = ch.codePointAt(0);
    if (cp > 0xffff) px += 21;             // emoji
    else if (cp > 0x7f) px += 12;          // arrows and other symbols
    else if (ch >= '0' && ch <= '9') px += 7.3;
    else if (ch >= 'a' && ch <= 'z') px += 9.6;
    else if (ch >= 'A' && ch <= 'Z') px += 10.6;
    else if (ch === ' ') px += 1;          // see the note above
    else px += 4;                          // colon, brackets
  }
  return px;
}

/* Build one travel/get-ready buffer strip for the weekly view. Positioned in
   px within the zone cell, hugging the card it belongs to. Non-interactive so
   taps fall through to the card/cell underneath. */
/* `maxTier` caps how much a strip may say regardless of how tall it is.
   The tier ramp reads HEIGHT, which is the right question in the Full week and
   the day timeline, where a column is wide. It is the wrong question on the Day
   Blocks grid: a column there is a seventh of the screen, so a strip can easily
   be tall enough for the long label and nowhere near wide enough for it — which
   is how "Leave by 5:00pm (30m)" came to be sliced off mid-word at the column
   edge once the grid got taller. Same distinction as BLOCK_TIERS vs the
   stacking threshold: two questions, and height only answers one of them. */
function wfTravelStrip(topPx, hPx, leftCss, widthCss, seg, colour, conflict, maxTier, colPx) {
  const s = document.createElement('div');
  // Per-kind class (ready/travel/warmup) so adjacent strips read as three
  // distinct things even before you can make out the text.
  const kindCls = seg.kind === 'ready' ? ' wf-travel--ready' : seg.kind === 'warmup' ? ' wf-travel--warmup' : ' wf-travel--travel';
  const RANK = { tiny: 0, time: 1, short: 2, long: 3 };
  /* A strip carries text only when a LINE OF TEXT FITS IN IT. The old floor was
     8px, and the kid readability floor lifts this type to 13.1px with a 1px
     dashed border each side (1.5px on a conflict strip) — so at 0.72px per
     minute two stacked fifteen-minute strips, 10.8px each, both printed a label
     and both printed it through the other. That is the mess in the 7:45–8:10
     slot of the screenshot this fixes. See WF_TRAVEL_TEXT_MIN_PX. */
  let tier = hPx >= WF_TRAVEL_TEXT_MIN_PX ? 'long' : 'tiny';
  if (maxTier && RANK[tier] > RANK[maxTier]) tier = maxTier;
  /* And height only answers one of the two questions. A column is 95–129px and
     "🚗 Leave by 7:40am (15m)" is about 168px of this type, so a strip tall
     enough for the long label is routinely nowhere near wide enough.

     WHAT THE LADDER DROPS FIRST MATTERS. It used to fall from `long` straight
     to `short` — "🚗 Travel 15m" — which throws away the clock time, the only
     figure anybody acts on, and keeps the minutes, which the strip's own length
     already draws. The demotion fires on every strip on this surface, so the
     effect was that no time reached the Full week at all.

     `time` is the icon and the clock, about 59px, which holds in a 95px column
     even after a lane split. `short` is not on this ladder: it is BOTH less use
     and wider than `time`, so there is no width at which it is the right
     answer here. It stays in bufferSegLabels because the print sheet
     (js/16-print.js) picks its tiers by block height and does want it. */
  const fitsIn = t => !colPx || wfTextPx(bufferSegLabels(seg, t)) <= colPx;
  if (tier === 'long' && !fitsIn('long')) tier = 'time';
  if (tier === 'time' && !fitsIn('time')) tier = 'tiny';
  const mute = tier === 'tiny';
  s.className = 'wf-travel' + kindCls + ` wf-travel--tier-${tier}`
    + (mute ? ' wf-travel--mute' : ' wf-travel--label')
    + (conflict ? ' wf-travel--conflict' : '');
  s.style.top = topPx + 'px';
  s.style.height = hPx + 'px';
  s.style.left = leftCss;
  s.style.width = widthCss;
  if (colour && !conflict) s.style.setProperty('--wf-travel-colour', colour);
  /* A muted strip still says what it is on hover and to a screen reader; what it
     stops doing is printing a line of text into 10px of space. The tooltip is
     the FULL sentence at every width -- "Leave by 7:55am (15m)" -- because it
     is the one place the clock time can never be squeezed out, and it is what a
     screen reader reads when the visible label has fallen to its bare rung. */
  s.textContent = mute ? '' : (conflict ? `⚠️${seg.min}m` : bufferSegLabels(seg, tier));
  s.title = (conflict ? '⚠️ Overlaps another activity — not enough time. ' : '') + bufferSegLabels(seg, 'long');
  return s;
}

/* ── WHAT ONE SIDE OF A BLOCK IS ABOUT ──
   The two get-ready buffers are NOT the same activity, and that is what decides
   how many times each side prints. Before a block it is preparation — packing
   the bag, shoes on — and it has a hard deadline: it must be finished when the
   car leaves. After a block it is unloading, and it has no deadline at all;
   nothing downstream waits on it.

   So the PRE side has two figures a parent acts on — when you must start, and
   when you must leave — and missing the first makes the second impossible. The
   POST side has one: when you are through the door. The unpack still has to be
   reserved so nothing else is booked into it, but nobody sets an alarm to
   finish putting a bag away.

   It used to print ONE figure per side, and on the pre side that was the start
   of the whole run carrying the TRAVEL icon: `🚗 7:50am` on a block whose car
   does not leave until 8:05. The right number labelled as the wrong event is
   worse than either fact alone.

   THE ARROW READS AWAY FROM HOME AND BACK TO IT — `🏠→🚗` going out, `🚗→🏠`
   coming back — so the direction of travel is in the glyph rather than in a
   word there is no room for. */
function wfSideEdgeRel(segs, side) {
  const list = (segs || []).filter(Boolean);
  if (!list.length) return null;
  if (side === 'pre') return Math.min(...list.map(x => x.drawStartRel != null ? x.drawStartRel : x.startRel));
  const travel = list.filter(x => x.kind === 'travel');
  const use = travel.length ? travel : list;
  return Math.max(...use.map(x => x.drawEndRel != null ? x.drawEndRel : x.endRel));
}

/* The edge of one KIND within a side, so each figure can name its own event.
   Pre: a segment's start is when that thing begins. Post: its end is when that
   thing is finished. */
function wfKindEdgeRel(segs, side, kind) {
  const list = (segs || []).filter(x => x && x.kind === kind);
  if (!list.length) return null;
  return side === 'pre'
    ? Math.min(...list.map(x => x.drawStartRel != null ? x.drawStartRel : x.startRel))
    : Math.max(...list.map(x => x.drawEndRel != null ? x.drawEndRel : x.endRel));
}

/* Every form this side's label can take, widest first. The caller walks the
   list and prints the first that fits — a lane split halves the budget, so the
   last rung has to survive about 55px. Built from the segments the block
   actually has, so a side carrying only one kind never prints a figure for a
   thing that is not there. */
function wfSideTimeForms(segs) {
  const list = (segs || []).filter(Boolean);
  if (!list.length) return [];
  const side = list[0].side || 'pre';
  const at = rel => rel == null ? null : formatTimeFromMin(rel + START_MIN);
  /* NO MERIDIEM WHEN TWO TIMES SHARE THE LABEL. "am" costs two units of a
     budget that is 101px on an iPad in portrait, and it is the least load-
     bearing part of the string: the two figures are minutes apart, and the hour
     gutter is drawn six pixels to the left of them. Keeping it turned the
     two-fact form from 106px into 132px, which is the difference between
     fitting a real column and never being chosen. */
  const bare = t => t == null ? null : t.replace(/(am|pm)$/, '');
  const travelAt = at(wfKindEdgeRel(list, side, 'travel'));
  const readyAt  = at(wfKindEdgeRel(list, side, 'ready'));
  const forms = [];
  if (side === 'pre') {
    /* GOING OUT, BOTH FIGURES MATTER, so the DIRECTION is what is sacrificed
       first. Getting ready before a block has a hard deadline -- it has to be
       finished when the car leaves -- so "start at 7:40, leave at 7:55" is two
       facts a parent acts on separately. The house-and-arrow costs 33px of a
       budget that is about 112px on an iPad; dropping it keeps both times down
       to a 100px column, which is every real one-lane column on this grid. */
    if (readyAt && travelAt) {
      forms.push(`👕${bare(readyAt)} 🏠→🚗${bare(travelAt)}`);
      forms.push(`👕${bare(readyAt)} 🚗${bare(travelAt)}`);
    } else if (travelAt) {
      forms.push(`🏠→🚗 ${travelAt}`);
    }
    if (travelAt) { forms.push(`🚗${travelAt}`); forms.push(`🚗${bare(travelAt)}`); }
    else if (readyAt) { forms.push(`👕 ${readyAt}`); forms.push(`👕${bare(readyAt)}`); }
  } else {
    /* COMING HOME THE SOFT FIGURE GOES FIRST. Unpacking has no deadline --
       nothing downstream waits on it -- so when the width runs out it is the
       unpack time that goes and the direction that stays. Through the door is
       the figure somebody is waiting on. */
    if (travelAt && readyAt) forms.push(`🚗→🏠${bare(travelAt)} 🧺${bare(readyAt)}`);
    if (travelAt) {
      forms.push(`🚗→🏠 ${travelAt}`);
      forms.push(`🏠${travelAt}`);
      forms.push(`🏠${bare(travelAt)}`);
    } else if (readyAt) { forms.push(`🧺 ${readyAt}`); forms.push(`🧺${bare(readyAt)}`); }
  }
  return forms;
}

/* WHAT THIS SIDE COULD NOT SAY, given what it actually printed.

   The ladder above drops the get-ready figure before the leave-by one, and the
   unpack figure before the through-the-door one, so in a split lane a side can
   speak and still be a fact short. That is the same hole the mute mechanism
   already covers for a side that says nothing at all, and it is closed the same
   way: the elements are ASKED what they printed -- a second copy of the ladder
   here is exactly how the two would drift -- and the card carries the
   remainder. Returns '' when the side said everything it had. */
function wfSideTimeUnsaid(segs, saidText) {
  const list = (segs || []).filter(Boolean);
  if (!list.length) return '';
  const side = list[0].side || 'pre';
  const rel = wfKindEdgeRel(list, side, 'ready');
  if (rel == null) return '';
  const t = formatTimeFromMin(rel + START_MIN);
  const bare = t.replace(/(am|pm)$/, '');
  if (String(saidText || '').includes(bare)) return '';
  return (side === 'pre' ? '👕' : '🧺') + t;
}

/* The widest form that fits the width it is given. `colPx` unset means no
   budget — take the fullest. */
function wfSideTimeLabel(segs, colPx) {
  const forms = wfSideTimeForms(segs);
  if (!forms.length) return '';
  if (!colPx) return forms[0];
  return forms.find(f => wfTextPx(f) <= colPx) || '';
}

/* One BAND standing for several segments that are each too short to speak.
   Get-ready and travel run end to end before a block, so at fifteen minutes
   apiece neither can hold a line but the pair can: 30 minutes is 21.6px here,
   which fits one. The per-kind hatches stay as unlabeled children inside it, so
   the band still reads as two different things at a glance.

   THE LABEL IS THE TIME. It used to be "👕15 🚗15 · 7:40am" — eighteen units,
   118.8px, against a column that is 95–129px, so the one path by which a clock
   time could still reach this surface printed nothing more often than not. The
   minutes are already drawn: that is what the band's own length is. The label
   is "🚗 7:40a" going out and "🏠 3:20p" coming back, and the kinds and figures
   stay in the tooltip.

   AND IT NAMES THE RIGHT MOMENT. Coming home the edge was the end of the whole
   run — after the gear is put away, 3:35 — not when you actually get through
   the door, 3:20. The post edge is the end of the last TRAVEL segment; a run
   with no travel in it (gear away alone) still falls back to its own end,
   because then that is the fact. */
function wfBufferBand(topPx, hPx, leftCss, widthCss, segs, colour, conflict, colPx) {
  const s = document.createElement('div');
  s.className = 'wf-travel wf-travel--band' + (conflict ? ' wf-travel--conflict' : '');
  s.style.top = topPx + 'px';
  s.style.height = hPx + 'px';
  s.style.left = leftCss;
  s.style.width = widthCss;
  if (colour && !conflict) s.style.setProperty('--wf-travel-colour', colour);
  const total = segs.reduce((n, x) => n + (x.drawEndRel - x.drawStartRel), 0) || 1;
  let cursor = 0;
  segs.forEach(seg => {
    const segH = (seg.drawEndRel - seg.drawStartRel) / total * 100;
    const kindCls = seg.kind === 'ready' ? ' wf-travel--ready' : seg.kind === 'warmup' ? ' wf-travel--warmup' : ' wf-travel--travel';
    const child = document.createElement('div');
    child.className = 'wf-travel-band-seg' + kindCls;
    child.style.top = cursor + '%';
    child.style.height = segH + '%';
    s.appendChild(child);
    cursor += segH;
  });
  const label = document.createElement('div');
  label.className = 'wf-travel-band-label';
  /* The label PICKS ITS OWN FORM from the width it is given — both figures at
     full width, the leave/arrive time alone in a split lane, the bare time
     below that. Height is the other question and the band still answers it: a
     run too short for one line of this type keeps its hatches and says nothing,
     and the card's own inline tag then carries the fact. */
  const full = hPx >= WF_TRAVEL_TEXT_MIN_PX ? wfSideTimeLabel(segs, colPx) : '';
  const fits = !!full;
  label.textContent = full;
  if (!fits) s.classList.add('wf-travel--mute');
  s.appendChild(label);
  /* Every figure the visible label had to drop, in full. The band prints at
     most two times and loses the meridiem doing it; the tooltip names each
     segment, its minutes and its clock time the long way round. */
  s.title = segs.map(x => bufferSegLabels(x, 'long')).join(' · ');
  return s;
}

/* ── THE DRAWN BOX OF EVERY CARD ON ONE DAY ──
   Computed once, and read by BOTH the lane pass and the cards themselves. A
   lane decided on one geometry and a card drawn on another is the disagreement
   this file records six times over; here it would be invisible, because the
   card that ends up in the wrong lane still looks like a card.

   A CARD FLOORED TO A MINIMUM BORROWS THE MINUTES BEFORE IT, NOT AFTER.
   At 0.72px per minute the WF_CARD_MIN_PX floor is 28 minutes, so every block
   shorter than that is drawn taller than it is. Growing DOWNWARD spends that
   height on the one edge a reader uses to tell where one activity stops and the
   next begins — and it made the grid split lanes for blocks that do not overlap
   at all: a 20-minute After-School Routine ending at 4:00pm pushed a 4:00pm
   Piano into a second half-width lane, while the day view (whose own floor is
   below almost every real duration) drew both full width and was right.

   Growing UPWARD spends it on minutes that are empty by construction. The
   card's bottom edge — when the thing actually ends — stays truthful, which is
   the edge that abuts the next card.

   Room is measured against the other blocks' REAL extents, and against the
   already-decided bottom of the block before it, so two short blocks either
   side of one gap can never both borrow it. A card with nowhere to borrow from
   keeps its full floored height and overruns; the lane pass then splits it,
   which is the only case that should ever halve a column. */
function wfCardBoxes(blocks, opts) {
  const o = opts || {};
  const pxPerMin = o.pxPerMin || 1;
  const minPx = o.minPx || 0;
  const gapPx = o.gapPx || 0;
  const sorted = (blocks || []).slice()
    .sort((a, b) => (a.startMin - b.startMin) || ((a.durationMin || 0) - (b.durationMin || 0)));
  const realTop = b => (b.startMin - START_MIN) * pxPerMin;
  const realBot = b => realTop(b) + Math.max(0, b.durationMin || 0) * pxPerMin;
  const boxes = new Map();
  const tops = sorted.map(realTop);
  /* Starts at the top of the day, not at -Infinity: a 6am block has no earlier
     minutes to borrow, and a card drawn above the canvas is clipped away. */
  let prevDrawnBot = 0;
  sorted.forEach((b, i) => {
    const top = tops[i];
    const natural = Math.max(0, b.durationMin || 0) * pxPerMin;
    let topPx = top, hPx = natural;
    let grow = Math.max(minPx, natural) - natural;
    if (grow > 0) {
      const roomBefore = Math.max(0, top - prevDrawnBot - gapPx);
      // The earliest real top after this one. `tops` is non-decreasing, so the
      // first entry past this block that is strictly lower is the nearest.
      let nextTop = Infinity;
      for (let j = i + 1; j < tops.length; j++) {
        if (tops[j] > top) { nextTop = tops[j]; break; }
      }
      const roomAfter = nextTop === Infinity ? Infinity
        : Math.max(0, nextTop - (top + natural) - gapPx);
      const up = Math.min(grow, roomBefore);
      topPx -= up; hPx += up; grow -= up;
      const down = Math.min(grow, roomAfter);
      hPx += down; grow -= down;
      // Nowhere to borrow: take the height anyway and let the lane pass split.
      if (grow > 0) hPx += grow;
    }
    boxes.set(b.id, { topPx, hPx });
    prevDrawnBot = Math.max(prevDrawnBot, topPx + hPx);
  });
  return boxes;
}

/* Assign overlapping blocks to columns (greedy) so time-positioned cards
   never sit on top of each other. Returns a Map of id -> {col, count} where
   count is the column count of that block's own overlap group.

   LANES ARE DECIDED ON WHAT IS DRAWN, and `wfCardBoxes` above is what says
   what that is. Two cards go side by side when their boxes would touch on
   screen, plus the lane gap — which now happens only when they really do
   overlap in time, or when a floored card had no empty minute to borrow.

   `epsPx` keeps a hair's-breadth graze from halving two long cards for
   nothing. */
function wfAssignColumns(blocks, opts) {
  const gapPx    = (opts && opts.gapPx) || 0;
  const epsPx    = (opts && opts.epsPx != null) ? opts.epsPx : 4;
  const boxes    = (opts && opts.boxes) || wfCardBoxes(blocks, opts);
  const map = new Map();
  const box = b => boxes.get(b.id) || { topPx: 0, hPx: 0 };
  const drawnTop = b => box(b).topPx;
  const drawnBot = b => box(b).topPx + box(b).hPx + gapPx;
  const sorted = blocks.slice().sort((a,b)=> (a.startMin - b.startMin) || (a.durationMin - b.durationMin));
  // Group runs of mutually-overlapping blocks, then column-pack each group.
  let group = [];
  let groupEnd = -Infinity;
  const flush = ()=>{
    if (!group.length) return;
    const colEnds = []; // running drawn bottom per column
    group.forEach(b=>{
      const bTop = drawnTop(b);
      const bBot = drawnBot(b);
      let colIdx = colEnds.findIndex(end => end - bTop <= epsPx);
      if (colIdx === -1) { colIdx = colEnds.length; colEnds.push(bBot); }
      else { colEnds[colIdx] = bBot; }
      map.set(b.id, { col: colIdx });
    });
    const count = colEnds.length;
    group.forEach(b=> { map.get(b.id).count = count; });
    group = [];
    groupEnd = -Infinity;
  };
  sorted.forEach(b=>{
    const bTop = drawnTop(b);
    const bBot = drawnBot(b);
    if (bTop - groupEnd >= -epsPx && group.length) flush();
    group.push(b);
    groupEnd = Math.max(groupEnd, bBot);
  });
  flush();
  return map;
}

