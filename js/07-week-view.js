// Weekly-Planner — week view: full/compact week render, time grid, week glance & wins.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   WEEK VIEW
════════════════════════════════════════════════════════════════ */
function setWeekView(v) {
  weekView = v;
  // Tab active state
  document.getElementById('viewTabFull').classList.toggle('active', v==='full');
  document.getElementById('viewTabTimeGrid').classList.toggle('active', v==='timegrid');
  // Containers
  document.getElementById('weekFull').style.display     = v==='full' ? 'flex' : 'none';
  // flex, not block, so .tg2-wrap's `flex:1; min-height:0` gives it a bounded
  // height and it becomes a real scroll container (same as #weekFull).
  document.getElementById('weekTimeGrid').style.display = v==='timegrid' ? 'flex' : 'none';
  renderWeek();
}
function changeWeek(d) { weekOffset += d; renderWeek(); }

/* ── Putting back a week that was left blank ───────────────────────
   The planner could only ever copy a week FORWARD (mmPlanNextWeek), which is
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
/* One clone rule, shared with mmPlanNextWeek. Everything that records what
   HAPPENED is dropped, because a copy is a plan — and that includes xpAwarded,
   which mmPlanNextWeek used to carry over: awardBlockLinks only awards when the
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
  if (Array.isArray(b.objectives)) c.objectives = b.objectives.slice();
  if (b.stopwatch) c.stopwatch = Object.assign({}, b.stopwatch, {
    elapsedSec: 0, running: false, startedAt: null,
  });
  return c;
}
/* Days that already hold something are left alone — the same guard
   mmPlanNextWeek uses. A copy must never overwrite a plan somebody made. */
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

function schoolDaysToOffer(keys, p = activeProfile()) {
  return keys.filter(k => isSchoolDay(k) && !(getDayBlocksForProfile(k, p) || []).length);
}

function schoolOfferInHorizon(keys) {
  const off = computeWeekOffsetForDayKey(keys[0]);
  return off >= 0 && off < SCHOOL_FILL_HORIZON_WEEKS;
}

/* Names the days before it writes anything, the way the parent portal's copy
   preview does. One School Day block per day — not the whole school-day
   template, which would also invent a piano lesson and a bedtime routine
   nobody asked for. */
async function addSchoolDaysToWeek(mondayKey) {
  const p = activeProfile();
  const keys = mrWeekDayKeys(mondayKey);
  const days = schoolDaysToOffer(keys, p);
  if (!days.length) { showToast('No empty school days in this week'); return; }
  const names = days.map(k => DAY_LONG[(formatDayKey(k).getDay() + 6) % 7]);
  const h = schoolHours();
  const when = `${formatTimeFromMin(START_MIN + h.startMin)}–${formatTimeFromMin(START_MIN + h.endMin)}`;
  const ok = await showConfirm(
    `Add School Day to ${names.length} day${names.length === 1 ? '' : 's'} — ${names.join(', ')}?\n\n`
    + `${when}, from the school calendar. Nothing else is added, and days that already `
    + 'have something on them are left alone.',
    { okLabel: 'Add them', cancelLabel: 'Not now' });
  if (!ok) return;
  days.forEach(k => {
    const arr = getDayBlocksForProfile(k, p) || [];
    arr.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      actId: 'school_day',
      startMin: START_MIN + h.startMin,
      durationMin: h.endMin - h.startMin,
      objectives: [], note: '', checklistState: {},
      completed: false, confirmed: false,
      createdAt: syncNow(), updatedAt: syncNow(),
    });
    setDayBlocks(k, arr, p);
  });
  saveAll();
  renderWeek();
  showToast(`🏫 Added ${days.length} school day${days.length === 1 ? '' : 's'} — now build round them`);
}

function weekEmptyOffer(keys) {
  const p = activeProfile();
  const plan = `<button class="wins-btn" onclick="goPlanWeek('${escapeJsAttr(keys[0])}')">✏️ Start planning</button>`;
  /* Offered on a blank week only — which is exactly "the new week you are
     planning" — so it cannot become a thing that nags every time a week is
     half full. */
  const schoolDays = schoolOfferInHorizon(keys) ? schoolDaysToOffer(keys, p) : [];
  const school = schoolDays.length
    ? ` <button class="wins-btn" onclick="addSchoolDaysToWeek('${escapeJsAttr(keys[0])}')">🏫 Add ${schoolDays.length} school day${schoolDays.length === 1 ? '' : 's'}</button>`
    : '';
  if (keys[6] >= todayKey()) {
    return `📝 <b>This week is empty.</b> Pick a day and put the first thing in — you can move it later. ${plan}${school}`;
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
        <span class="wk-sig-label">✍️ ${name}, sign your week</span>
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
    applyMeetingLock();
  } else {
    parentBanner.style.display = 'none';
  }

  const p = activeProfile();
  document.getElementById('weekProfileBadge').textContent =
    isParent() ? (parentViewing==='jenn'?'🐥 Jenn':'🦊 Jess')+' (P)' :
    (p==='jenn'?'🐥 Jenn':'🦊 Jess');

  const keys = getDayKeys(weekOffset);
  const mon = formatDayKey(keys[0]);
  const sun = formatDayKey(keys[6]);
  document.getElementById('weekRangeLabel').textContent =
    `${MONTH_SHORT[mon.getMonth()]} ${mon.getDate()} — ${MONTH_SHORT[sun.getMonth()]} ${sun.getDate()}`;

  if (weekView === 'full') renderFullWeek(keys);
  else                     renderTimeGrid(keys);

  /* A parent-only category legend was toggled here. Its markup lived inside the
     permanently hidden compact view, so it could never appear no matter what
     this line set. The Day Blocks view renders a live one from CAT_HEX that
     parent and child both see. */

  // Money button: both roles open 💰 My money. A parent looking at a kid's
  // money should see exactly what the kid sees; everything a parent can change
  // lives on the Money rules tab of the portal instead.
  const moneyBtn = document.getElementById('weekMoneyBtn');
  if (moneyBtn) {
    moneyBtn.innerHTML = '<span aria-hidden="true">💰</span><span class="btn-icon__label">My money</span>';
    moneyBtn.title = 'My money';
    moneyBtn.setAttribute('aria-label', moneyBtn.title);
  }

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
      const learn = fmtHrsMin(t.catMin.school || 0);
      const active = fmtHrsMin((t.catMin.active || 0) + (t.catMin.training || 0));
      const free = fmtHrsMin(t.free);
      coachEl.classList.add('week-review-tip');
      coachEl.style.display = 'block';
      coachEl.innerHTML = `🗓️ <b>Sunday review</b> — this week: 📚 ${learn} learning · 🏃 ${active} active · 🌤 ${free} free. Look back together, then tweak one thing for next week. <button class="wins-btn" onclick="openWeeklyWins()">🎉 See wins</button> <button class="tip-dismiss" aria-label="Dismiss" onclick="dismissWeekReview()">✕</button>`;
    } else if (!isParent()) {
      coachEl.classList.remove('week-review-tip');
      coachEl.style.display = 'block';
      // "Time-Grid" was a name for this view that no longer exists anywhere in
      // the UI — the tab reads Day Blocks.
      coachEl.textContent = '🌟 Tip: Tap a day to see your timeline. Check off routines as you go — each tick is a small win. Use “My free time” in Day Blocks to spot when you can choose rest or a goal.';
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

function tgFreeBrickClass() {
  const p = activeProfile();
  return p === 'jess' ? 'tg-brick-free-jess' : 'tg-brick-free-jenn';
}
function tgFreeCellClass() {
  const p = activeProfile();
  return p === 'jess' ? 'tg-free-jess' : 'tg-free-jenn';
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
/* Short label for the 2a Day-Blocks view — a Skating block reads "Skate", French
   reads "FR", the morning routine reads "AM", etc. Kept compact so a block only a
   few pixels tall still says something useful. */
function tg2ShortLabel(act, b) {
  if (!act) return '';
  if (act.isRoutine) {
    if (act.routineId === 'morning') return 'AM';
    if (act.routineId === 'afterschool') return 'PM';
    if (act.routineId === 'evening') return 'Eve';
    return 'Routine';
  }
  if (act.isTraining) {
    const t = getTrainingTopic(b.tag);
    /* Seven characters, deliberately (CLAUDE.md) — a typed competition name is
       not going to fit here, so this stays the sport's short form. */
    if (act.isCompetition) return t.id === 'general' ? 'Comp' : (t.name.slice(0, 4) + '🏆');
    return ({ skating: 'Skate', swimming: 'Swim', dryland: 'Dry', general: 'Train' })[t.id] || 'Train';
  }
  const idMap = {
    school_day: 'School', french: 'FR', chinese: 'CN', math: 'Math', piano: 'Piano',
    chores: 'Chores', breakfast: '🍳', lunch: '🥗', dinner: '🍽', relax: 'Relax',
    break_quick: 'Break', family: 'Family',
  };
  if (idMap[act.id]) return idMap[act.id];
  const w = (act.name || '').split(/\s+/)[0];
  return w.length > 7 ? w.slice(0, 7) : w;
}

/* 2a "Day Blocks": one column per day, planned activities carry colour + a short
   label, free time is plain lined paper. Conflicts get the same red flag as the
   Full week and the print sheet so the three views agree. */
function renderTimeGrid(keys) {
  const grid = document.getElementById('tgGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const acts = getAllActivities(activeProfile(), { includeArchived: true });
  const today = todayKey();

  /* 0.5px/min put a 30-minute block at 15px tall, which no legible type fits
     in — the labels were drawn at 9.9px to squeeze into it, under the 13px kid
     floor. Density and type size move together: at 0.85 an hour is ~51px and a
     half-hour block ~25px, enough for one 13px line. The grid is then taller
     than an iPad, which is why the week had to become one scroll surface. */
  const PX_PER_MIN = 0.85;
  const totalH = Math.round(DAY_MIN_SPAN * PX_PER_MIN);
  /* The second threshold (see .tg2-block--tiny in css/app.css): below this a
     block shows its icon alone rather than type under the floor. 13px of line
     plus 2px of padding and 3px of border needs about this much. */
  const TG2_LABEL_MIN_H = 22;
  const firstHour = Math.ceil(START_MIN / 60);
  const lastHour  = Math.floor((START_MIN + DAY_MIN_SPAN) / 60);

  // ── Header row: corner + 7 day headers ──
  const corner = document.createElement('div');
  corner.className = 'tg2-corner';
  grid.appendChild(corner);
  keys.forEach((key, i) => {
    const d = formatDayKey(key);
    const head = document.createElement('div');
    head.className = 'tg2-head' + (key === today ? ' today' : '');
    head.innerHTML = `${DAY_SHORT[i]}<small>${d.getDate()}</small>`;
    head.onclick = () => openDay(key, i);
    grid.appendChild(head);
  });

  // ── Body row: time gutter + 7 lanes ──
  const gutter = document.createElement('div');
  gutter.className = 'tg2-gutter';
  gutter.style.height = totalH + 'px';
  for (let h = firstHour; h <= lastHour; h++) {
    const rel = h * 60 - START_MIN;
    if (rel < 0 || rel > DAY_MIN_SPAN) continue;
    const lbl = document.createElement('div');
    lbl.className = 'tg2-gutter-hour';
    lbl.style.top = (rel * PX_PER_MIN) + 'px';
    lbl.textContent = `${((h + 11) % 12) + 1}${h >= 12 ? 'p' : 'a'}`;
    gutter.appendChild(lbl);
  }
  grid.appendChild(gutter);

  keys.forEach((key, dayIdx) => {
    const lane = document.createElement('div');
    lane.className = 'tg2-lane' + (key === today ? ' today' : '');
    lane.style.height = totalH + 'px';
    lane.onclick = () => openDay(key, dayIdx);

    /* SCHOOL HOURS, on the view the week actually opens on. This is the layout
       the app defaults to and the one a parent means by "the weekly planner",
       and it showed nothing school-related at all — a school day and a Sunday
       were the same white lane. Same source as the day view and the Full week:
       dayZoneSegments, which reads the calendar rather than the weekday. */
    dayZoneSegments(key).forEach(bd => {
      const seg = document.createElement('div');
      seg.className = 'tg2-band ' + bd.cls.replace('tl-band-', 'wf-band-');
      seg.style.top = (bd.start * PX_PER_MIN) + 'px';
      seg.style.height = ((bd.end - bd.start) * PX_PER_MIN) + 'px';
      seg.title = bd.label;
      lane.appendChild(seg);
    });

    const blocks = (getDayBlocks(key) || []).slice().sort((a, b) => a.startMin - b.startMin);
    const conflicts = computeBufferConflicts(blocks);
    const cols = wfAssignColumns(blocks);

    // The strips that make a training block possible — get ready, drive, warm
    // up — belong on this view too. Without them a 5pm skate looks like it
    // starts at 5pm, when the day really starts at 4:15. Drawn first so the
    // activity cards sit on top, same as the Full week.
    blocks.forEach(b => {
      const act = acts.find(a => a.id === b.actId);
      const topic = act && act.isTraining ? getTrainingTopic(b.tag) : null;
      const segColour = topic ? trainingBlockColour(b) : (b.colour || (act && CAT_HEX[act.cat]) || '#888');
      const bc = conflicts.perBlock.get(b.id);
      const slot = cols.get(b.id) || { col: 0, count: 1 };
      const cc = slot.count || 1;
      const leftCss  = `calc(${(slot.col * 100 / cc)}% + 1px)`;
      const widthCss = `calc(${100 / cc}% - 3px)`;
      wfBufferSegments(b).forEach(seg => {
        const segS = Math.max(seg.startRel, 0);
        const segE = Math.min(seg.startRel + seg.dur, DAY_MIN_SPAN);
        if (segE - segS < 2) return;
        const segConflict = !!bc && (seg.side === 'pre' ? bc.pre : bc.post);
        /* 'tiny' — icon and minutes. A seventh of a phone is about 60px wide, so
           even "🚗 Get ready 15m" at the 13px floor does not fit, and the week
           grid is the overview: the instruction itself is on the block's title,
           the day screen and the Full week, all of which have the room. */
        lane.appendChild(wfTravelStrip(segS * PX_PER_MIN, (segE - segS) * PX_PER_MIN,
          leftCss, widthCss, seg, segColour, segConflict, 'tiny'));
      });
    });

    blocks.forEach(b => {
      const act = acts.find(a => a.id === b.actId);
      if (!act) return;
      const topic = act.isTraining ? getTrainingTopic(b.tag) : null;
      const bg = blockColour(b);
      const relStart = Math.max(0, b.startMin - START_MIN);
      const relEnd = Math.min(DAY_MIN_SPAN, b.startMin - START_MIN + (b.durationMin || 0));
      if (relEnd - relStart < 1) return;
      const el = document.createElement('div');
      const hasConflict = conflicts.affected.has(b.id);
      const h = Math.max(11, (relEnd - relStart) * PX_PER_MIN - 1);
      // Class names written out rather than built from a ternary — the dead-CSS
      // check matches literal strings.
      el.className = 'tg2-block' + (isLightColour(bg) ? ' light-bg' : '')
        + (isBlockCompleted(b, activeProfile()) ? ' tg2-block--done' : '') + (hasConflict ? ' tg2-block--conflict' : '')
        + (h < TG2_LABEL_MIN_H ? ' tg2-block--tiny' : '');
      el.style.top = (relStart * PX_PER_MIN) + 'px';
      el.style.height = h + 'px';
      el.style.background = bg;
      // Column-pack overlapping blocks so they sit side-by-side, not stacked.
      const slot = cols.get(b.id) || { col: 0, count: 1 };
      const cc = slot.count || 1;
      if (cc > 1) {
        el.style.left = `calc(${(slot.col * 100 / cc)}% + 1px)`;
        el.style.right = 'auto';
        el.style.width = `calc(${100 / cc}% - 3px)`;
      }
      const icon = topic ? topic.icon : act.icon;
      const flag = hasConflict ? `<div class="tg2-block-flag" title="Time clash — not enough travel/get-ready time">!</div>` : '';
      el.innerHTML = `${flag}${icon}<span class="tg2-block-lbl">${escapeHtml(tg2ShortLabel(act, b))}</span>`;
      el.title = `${icon} ${topic ? topic.name : act.name} — ${formatTimeFromMin(b.startMin)}, ${formatDuration(b.durationMin)}`
        + (hasConflict ? ' · ⚠️ overlaps another activity' : '');
      el.onclick = (e) => { e.stopPropagation(); openDay(key, dayIdx, b.id); };
      lane.appendChild(el);
    });

    /* The lane used to carry a 24px repeating-linear-gradient as its "lined
       paper". At 0.85px/min an hour is 51px and a half-hour 25.5px, so those
       rules named no time at all and drifted out of step with the gutter labels
       beside them from the first hour onwards. Real ones, over the blocks. */
    lane.appendChild(buildHourGrid(PX_PER_MIN, DAY_MIN_SPAN, { cls: 'hour-grid--tg2' }));

    grid.appendChild(lane);
  });

  // Week-level clash banner (shared with the Full view), plus the streak + legend.
  renderWeekConflictBanner(keys, 'tgConflictBanner');
  renderFamilyChoreBanner('tgFamilyBanner');
  renderTimeGridStreak(keys);
  const legend = document.getElementById('tgLegend');
  if (legend) {
    legend.style.display = 'flex';
    legend.innerHTML = [
      ['school', '📚 Learning'], ['training', '🏋️ Competitive Sports'],
      ['routine', '📋 Routine'], ['active', '🏃 Active'], ['daily', '🍽 Daily'],
    ].map(([cat, label]) =>
      `<span class="tg-legend-chip"><span class="tg-legend-dot" style="background:${CAT_HEX[cat] || '#999'}"></span>${label}</span>`
    ).join('') + `<span class="tg-legend-chip"><span class="tg-legend-dot tg-legend-dot--free"></span>Free — plain paper</span>`;
  }
}

/* Render the streak banner above the grid */
function renderTimeGridStreak(keys) {
  const el = document.getElementById('tgStreak');
  if (!el) return;
  const stretch = calculateLongestFreeStretch(keys);
  const label = formatStretchLabel(stretch);
  if (!label) {
    el.innerHTML = '<span class="star">✨</span> No free time this week yet';
    return;
  }
  el.innerHTML = `<span class="star">🌟</span> Longest free stretch: <strong>${label}</strong>`;
}

/* Render the weekly overview: 7 days × 30 bricks each (compact, glanceable) */
function renderTimeGridWeekOverview(keys) {
  const wrap = document.getElementById('tgWeekOverview');
  if (!wrap) return;
  wrap.innerHTML = '';
  const today = todayKey();
  const freeCls = tgFreeBrickClass();

  // Spacer in first column to align with grid
  const spacer = document.createElement('div');
  spacer.className = 'tg-wo-label';
  spacer.textContent = '';
  wrap.appendChild(spacer);

  keys.forEach((key, i) => {
    const d = formatDayKey(key);
    const dayEl = document.createElement('div');
    dayEl.className = 'tg-wo-day' + (key === today ? ' today' : '');
    dayEl.onclick = () => openDay(key, i);

    const lbl = document.createElement('div');
    lbl.className = 'tg-wo-daylabel';
    lbl.textContent = `${DAY_SHORT[i]} ${d.getDate()}`;
    dayEl.appendChild(lbl);

    const bricksWrap = document.createElement('div');
    bricksWrap.className = 'tg-wo-bricks';
    const bricks = getBrickStrip(key);
    bricks.forEach(b => {
      const brk = document.createElement('div');
      let cls = 'tg-wo-brick ';
      if (b.category === 'sleep-meal')    cls += 'tg-brick-sleep-meal';
      else if (b.category === 'learning') cls += 'tg-brick-learning';
      else                                cls += freeCls;
      brk.className = cls;
      bricksWrap.appendChild(brk);
    });
    dayEl.appendChild(bricksWrap);

    const count = bricks.filter(b => b.category === 'free').length;
    const cnt = document.createElement('div');
    cnt.className = 'tg-wo-count';
    cnt.textContent = `${count}/30 free`;
    dayEl.appendChild(cnt);

    wrap.appendChild(dayEl);
  });
}

/* Render TODAY's MY FREE TIME panel (kid view only) */
function renderTimeGridMyTime(keys) {
  const panel = document.getElementById('tgMyTime');
  if (!panel) return;
  // Hide for parent (weekly totals will live in parent analytics later)
  if (isParent()) { panel.style.display = 'none'; return; }

  const today = todayKey();
  const todayIdx = keys.indexOf(today);
  const targetKey = todayIdx >= 0 ? today : keys[0];
  const targetIdx = keys.indexOf(targetKey);
  const td = formatDayKey(targetKey);
  const dateStr = `${DAY_SHORT[targetIdx >= 0 ? targetIdx : 0]}, ${MONTH_SHORT[td.getMonth()]} ${td.getDate()}`;
  const dayLabel = (targetKey === today) ? `${dateStr} · Today` : `${dateStr} (this week)`;

  const bricks = getBrickStrip(targetKey);
  const freeCount = bricks.filter(b => b.category === 'free').length;
  const learnCount = bricks.filter(b => b.category === 'learning').length;
  const mealCount = bricks.filter(b => b.category === 'sleep-meal').length;
  const freeMin = freeCount * 30;
  const fh = Math.floor(freeMin / 60), fm = freeMin % 60;
  const valueStr = fh > 0 ? (fm > 0 ? `${fh}h ${fm}m` : `${fh}h`) : `${fm}m`;

  panel.style.display = 'block';
  panel.dataset.profile = activeProfile();
  panel.classList.toggle('tg-mytime--today', targetKey === today);
  document.querySelector('#tgMyTime .tg-mytime-label').innerHTML = `🌟 MY FREE TIME<br><span style="font-size:0.95rem;font-family:'Patrick Hand',sans-serif;font-weight:700">${escapeHtml(dayLabel)}</span>`;
  document.getElementById('tgMyTimeValue').textContent = valueStr;

  // Mini brick strip showing today's bricks across the full 6am–10pm window
  const bricksEl = document.getElementById('tgMyTimeBricks');
  bricksEl.innerHTML = '';
  bricksEl.style.gridTemplateColumns = `repeat(${bricks.length}, 1fr)`;
  const freeCls = tgFreeBrickClass();
  bricks.forEach(b => {
    const brk = document.createElement('div');
    let cls = 'tg-mytime-brick ';
    if (b.category === 'sleep-meal')    cls += 'tg-brick-sleep-meal';
    else if (b.category === 'learning') cls += 'tg-brick-learning';
    else                                cls += freeCls;
    brk.className = cls;
    bricksEl.appendChild(brk);
  });

  // Breakdown line
  const parts = [];
  if (freeCount > 0)  parts.push(`${freeCount} free`);
  if (learnCount > 0) parts.push(`${learnCount} learning`);
  if (mealCount > 0)  parts.push(`${mealCount} meals`);
  document.getElementById('tgMyTimeBreakdown').textContent = parts.length ? parts.join(' · ') + ' (30-min blocks)' : 'Nothing planned yet — your whole day is free!';
}

/* renderCompactWeek lived here — one card per day listing that day's blocks as
   text. It was unreachable: weekView is only ever 'full' or 'timegrid'. */

function renderDayBar(key, blocks) {
  const wrap = document.getElementById('daybar-'+key);
  const pctEl = document.getElementById('daypct-'+key);
  const moodEl = document.getElementById('daymood-'+key);
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!blocks.length) { pctEl.textContent=''; moodEl.textContent=''; return; }

  const filled = new Set();
  blocks.forEach(b=>{
    const startSlot = Math.floor((b.startMin - START_MIN)/15);
    const endSlot = Math.ceil((b.startMin - START_MIN + b.durationMin)/15);
    for(let s=startSlot;s<endSlot;s++) filled.add(s);
  });
  const pct = Math.round(filled.size / TOTAL_SLOTS * 100);
  pctEl.textContent = pct+'%';

  const dayMood = getProfData().dayMoods?.[key];
  moodEl.textContent = dayMood || '';

  const catMap = {};
  const acts = getAllActivities(activeProfile(), { includeArchived: true });
  blocks.forEach(b=>{
    const act = acts.find(a=>a.id===b.actId);
    if(!act) return;
    const cat = act.cat;
    catMap[cat] = (catMap[cat]||0) + (b.durationMin/15);
  });
  // Category breakdown visible only in Parent Mode — kids just see completion %
  if (isParent()) {
    Object.entries(catMap).forEach(([cat, slots])=>{
      const seg = document.createElement('div');
      seg.className = 'day-bar-seg';
      seg.style.height = Math.max(4, Math.round(slots/TOTAL_SLOTS*70))+'px';
      seg.style.background = CAT_COLOUR[cat]||'var(--cat-free)';
      wrap.appendChild(seg);
    });
  } else {
    // Kid view: single soft completion bar (no category judgment)
    const seg = document.createElement('div');
    seg.className = 'day-bar-seg';
    seg.style.height = Math.max(6, Math.round(pct/100*70))+'px';
    seg.style.background = 'var(--accent-yellow)';
    wrap.appendChild(seg);
  }
}

/* Buffer segments for a block, stacked so get-ready/travel/warm-up never occupy
   the same minutes: before the block you get ready FIRST, then travel (drive),
   then warm up right at the venue, then the activity; after it you travel home,
   then put the gear away. Warm-up is one-sided — you don't warm up on the way
   home. Returns segments with startRel (minutes from START_MIN), dur, icon,
   min — time order. Getting skate boots ready can't happen while driving, so
   the buffers are laid end-to-end, not stacked on the same slot. */
function wfBufferSegments(b) {
  const travelMin = getTravelBufMin(b);
  const readyMin  = getGetReadyBufMin(b);
  const warmupMin = getWarmupBufMin(b);
  const relStart = b.startMin - START_MIN;
  const dur = Math.max(5, b.durationMin || 0);
  const relEnd = relStart + dur;
  const segs = [];
  // Before: [get-ready][travel][warm-up][ACTIVITY]
  if (warmupMin > 0) segs.push({ startRel: relStart - warmupMin, dur: warmupMin, icon: '🔥', min: warmupMin, kind: 'warmup', side: 'pre' });
  if (travelMin > 0) segs.push({ startRel: relStart - warmupMin - travelMin, dur: travelMin, icon: '🚗', min: travelMin, kind: 'travel', side: 'pre' });
  if (readyMin  > 0) segs.push({ startRel: relStart - warmupMin - travelMin - readyMin, dur: readyMin, icon: '👕', min: readyMin, kind: 'ready', side: 'pre' });
  // After: [ACTIVITY][travel][get-ready]
  if (travelMin > 0) segs.push({ startRel: relEnd, dur: travelMin, icon: '🚗', min: travelMin, kind: 'travel', side: 'post' });
  if (readyMin  > 0) segs.push({ startRel: relEnd + travelMin, dur: readyMin, icon: '👕', min: readyMin, kind: 'ready', side: 'post' });
  segs.forEach(s => { s.endRel = s.startRel + s.dur; });
  return segs;
}

/* Human label for one buffer segment, at three widths, so a strip reads as a
   real instruction ("leave by 5:30p") rather than a bare "🚗15m" wherever
   there's room for it — the print sheet and the weekly cards both need this,
   not just the day view. `tier` is 'long' | 'short' | 'tiny'. */
function bufferSegLabels(seg, tier) {
  const startAbs = seg.startRel + START_MIN;
  const endAbs = seg.endRel + START_MIN;
  if (tier === 'tiny') return `${seg.icon}${seg.min}m`;
  if (tier === 'short') {
    const kindLabel = seg.kind === 'travel' ? 'Travel' : seg.kind === 'warmup' ? 'Warm up' : 'Get ready';
    return `${seg.icon} ${kindLabel} ${seg.min}m`;
  }
  // long
  if (seg.kind === 'ready' && seg.side === 'pre')  return `${seg.icon} Get ready ${seg.min}m — done by ${formatTimeFromMin(endAbs)}`;
  if (seg.kind === 'travel' && seg.side === 'pre') return `${seg.icon} Leave by ${formatTimeFromMin(startAbs)} (${seg.min}m)`;
  if (seg.kind === 'warmup')                       return `${seg.icon} Warm up by ${formatTimeFromMin(startAbs)} (${seg.min}m)`;
  if (seg.kind === 'travel' && seg.side === 'post') return `${seg.icon} Home about ${formatTimeFromMin(endAbs)} (${seg.min}m)`;
  if (seg.kind === 'ready' && seg.side === 'post')  return `${seg.icon} Put gear away ${seg.min}m`;
  return `${seg.icon} ${seg.min}m`;
}

/* Distinguish a tap from a scroll/drag so a large block (like Training) that
   fills the timeline doesn't open its editor every time the user tries to
   scroll past it. If the pointer moves beyond a small threshold — or the
   browser cancels the pointer to start scrolling — the following click is
   treated as a scroll gesture and ignored. */
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
/* Every scroll surface a plan is read on. .tg2-wrap is in the list even though
   it no longer scrolls itself: it is where the cursor is when a child pans the
   Day Blocks week, and its leftover — which is all of it — carries the page. */
function bindMiddleDragPan() {
  ['.weekly-full-wrap', '.tg2-wrap', '#screen-day .day-workspace']
    .forEach(sel => document.querySelectorAll(sel).forEach(attachMiddleDragPan));
}

function renderFullWeek(keys) {
  const grid = document.getElementById('weeklyFullGrid');
  grid.innerHTML = '';
  const acts = getAllActivities(activeProfile(), { includeArchived: true });

  // ── Week-level conflict summary banner (shown above the grid) ──
  renderWeekConflictBanner(keys);
  renderFamilyChoreBanner('weekFamilyBanner');

  // Continuous single-column-per-day timeline (matches the Day view): each
  // activity is ONE unbroken block positioned by its real start time on a
  // shared px-per-minute scale, so nothing is ever sliced at a band boundary.
  const PX_PER_MIN = 0.72;
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

  // ── One continuous lane per day ──
  keys.forEach((key, ci) => {
    // The calendar decides, not the weekday. Same function the day view uses.
    const bands = dayZoneSegments(key).map(b => ({ ...b, cls: b.cls.replace('tl-band-', 'wf-band-') }));
    const labelledCol = !isSchoolDay(key) || key !== axisKey;

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
        cell.appendChild(lbl);
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
    const cols = wfAssignColumns(blocks);
    const bufferConflicts = computeBufferConflicts(blocks);

    // Travel / get-ready strips (underneath cards), stacked so getting ready and
    // driving never share the same minutes. Coloured to match the activity
    // they belong to, and flagged red when they'd overlap another activity —
    // i.e. there isn't actually enough time to travel/get ready.
    blocks.forEach(b => {
      const act = acts.find(a=>a.id===b.actId);
      const topic = act && act.isTraining ? getTrainingTopic(b.tag) : null;
      const segColour = topic ? trainingBlockColour(b) : (b.colour || (act && CAT_HEX[act.cat]) || '#888');
      const bc = bufferConflicts.perBlock.get(b.id);
      // Match the buffer strip to its own block's column, so a get-ready/drive
      // strip sits directly under (and the same width as) the card it belongs to
      // instead of spanning the whole day column.
      const slot = cols.get(b.id) || { col: 0, count: 1 };
      const colCount = slot.count || 1;
      const gap = 3;
      const leftCss  = 'calc(' + (slot.col * 100 / colCount) + '% + 1px)';
      const widthCss = 'calc(' + (100 / colCount) + '% - ' + (gap + 2) + 'px)';
      wfBufferSegments(b).forEach(seg => {
        const segS = Math.max(seg.startRel, 0);
        const segE = Math.min(seg.startRel + seg.dur, DAY_MIN_SPAN);
        if (segE - segS < 2) return;
        const topPx = segS * PX_PER_MIN;
        const hPx = (segE - segS) * PX_PER_MIN;
        const segConflict = !!bc && (seg.side === 'pre' ? bc.pre : bc.post);
        cell.appendChild(wfTravelStrip(topPx, hPx, leftCss, widthCss, seg, segColour, segConflict));
      });
    });

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
      const topPx = relStart * PX_PER_MIN;
      const pxHeight = Math.max(dur * PX_PER_MIN, 16);

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
      let cls = 'wf-card' + (isLightColour(bg) ? ' light-bg' : '');
      if (blockTierAtLeast(tier, 'detail')) cls += ' wf-card--tall'; // room to stack time/icon/name centered
      if (!blockTierAtLeast(tier, 'meta')) cls += ' wf-card--slim';
      if (!blockTierAtLeast(tier, 'name')) cls += ' wf-card--xslim wf-card--icononly';
      if (isBlockCompleted(b, activeProfile())) cls += ' wf-card--done';
      const hasConflict = bufferConflicts.affected.has(b.id);
      if (hasConflict) cls += ' wf-card--conflict';
      card.className = cls;

      const slot = cols.get(b.id) || { col: 0, count: 1 };
      const colCount = slot.count || 1;
      const gap = 3; // px between overlapping columns
      const leftCss  = 'calc(' + (slot.col * 100 / colCount) + '% + 1px)';
      const widthCss = 'calc(' + (100 / colCount) + '% - ' + (gap + 2) + 'px)';

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
      card.style.height = Math.max(pxHeight - 2, 12) + 'px';
      card.style.left  = leftCss;
      card.style.width = widthCss;
      card.style.background = bg;
      // The buffers already have their own labelled strips beside the card
      // ("Leave by 3:50pm"), so repeating them inside the name is noise — and
      // on a tall card it is noise that pushes the name into the rows below.
      // Keep the inline tag only where the strips are too short to read.
      const travelTag = (bufKinds.length && !blockTierAtLeast(tier, 'detail'))
        ? `<span class="wf-card-travel">${bufKinds.join(' ')}</span>` : '';
      const stampEmoji = b.parentStamp && b.parentStamp.emoji ? b.parentStamp.emoji + ' ' : '';
      const conflictTag = hasConflict ? `<span class="wf-card-conflict-badge" title="Not enough travel/get-ready time — overlaps another activity">⚠️</span>` : '';
      // Corner flag stays visible on every card size (the inline badge is hidden
      // when a card is too slim for its name), so a clash never hides off-screen.
      const conflictFlag = hasConflict ? `<div class="wf-card-conflict-flag" title="Time clash — not enough travel/get-ready time">!</div>` : '';
      // List as much of "what this block is about" (gear/objectives/note) as
      // the card's own height can hold — gear first since packing is
      // effectively mandatory for a training block, then as many objectives as
      // fit — degrading to a one-line count on cards too short for a list.
      const detailLines = blockDetailLines(b, act);
      let sumHtml = '';
      if (blockTierAtLeast(tier, 'detail') && detailLines.length) {
        // Scales continuously above the 'detail' floor, so a long training
        // session gets room for its four checks plus its goals rather than
        // being cut at a fixed row count.
        const maxRows = Math.max(0, Math.floor((pxHeight - 58) / 20) + 1);
        sumHtml = sliceDetailLines(detailLines, maxRows)
          .map(r => `<div class="wf-card-sum" title="${escapeHtml(r.text)}">${r.icon} ${escapeHtml(r.text)}</div>`)
          .join('');
      }
      const durHtml = `${formatDuration(b.durationMin)}${(!sumHtml && detailLines.length) ? ' · ' + blockCountsSummary(detailLines) : ''}`;
      // Done-tick sized to the card's own height, same idea as the print
      // checkboxes, so a slim card doesn't carry an oversized tap target.
      const checkPx = Math.max(14, Math.min(24, Math.round(10 + pxHeight / 4)));
      card.innerHTML = `
        ${conflictFlag}
        <div class="wf-card-time">${timeStr}</div>
        <div class="wf-card-icon">${escapeHtml(dispIcon)}</div>
        <div class="wf-card-name">${stampEmoji}${escapeHtml(dispName)}${travelTag}${conflictTag}</div>
        ${sumHtml}
        <div class="wf-card-dur">${durHtml}</div>
        <button type="button" class="wf-card-check" style="width:${checkPx}px;height:${checkPx}px;font-size:${Math.round(checkPx*0.58)}px" aria-label="${b.completed?'Mark not done':'Mark done'}"
          onclick="toggleBlockDone('${escapeJsAttr(key)}','${escapeJsAttr(b.id)}',event)">${b.completed?'✓':''}</button>
      `;
      card.title = `${dispIcon} ${dispName} — ${timeStr}, ${formatDuration(b.durationMin)}`
        + (bufKinds.length ? ` · ${bufKinds.join(', ')} each way` : '')
        + (hasConflict ? ' · ⚠️ overlaps another activity — not enough time' : '');
      attachTapGuard(card, ()=> openDayFromWeekCard(key, ci, b.id));
      cell.appendChild(card);
    });

    // Last, over the cards. See buildHourGrid (js/05-helpers.js).
    cell.appendChild(buildHourGrid(PX_PER_MIN, DAY_MIN_SPAN, { cls: 'hour-grid--wf' }));

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
    const names = [];
    blocks.forEach(b => {
      if (!conflicts.affected.has(b.id)) return;
      const act = acts.find(a => a.id === b.actId);
      const topic = act && act.isTraining ? getTrainingTopic(b.tag) : null;
      const nm = act ? (topic ? topic.name : act.name) : 'Activity';
      if (!names.includes(nm)) names.push(nm);
    });
    dayLines.push(`${DAY_SHORT[i]}: ${names.join(' ⇆ ')}`);
  });
  if (!dayLines.length) { banner.style.display = 'none'; banner.innerHTML = ''; return; }
  const n = dayLines.length;
  banner.style.display = 'flex';
  banner.innerHTML =
    `<span class="wcb-icon">⚠️</span>`
    + `<span>${n} time ${n === 1 ? 'clash' : 'clashes'} this week — not enough travel/get-ready time`
    + `<span class="wcb-detail"><br>${dayLines.map(escapeHtml).join(' · ')}</span></span>`;
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
  const waiting = st.waiting
    ? ` <span class="wcb-detail">${st.waiting} waiting for a parent check.</span>` : '';
  banner.style.display = 'flex';
  banner.classList.add('week-todo-banner--warn');
  banner.innerHTML =
    `<span class="wcb-icon">🧹</span>`
    + `<span>${st.required} family ${st.required === 1 ? 'chore' : 'chores'} required · ${st.planned} planned · ${n} still ${n === 1 ? 'needs' : 'need'} a day`
    + `<span class="wcb-detail"><br>These are the ones the family shares — tap a day to put ${n === 1 ? 'it' : 'them'} on the plan.</span>${waiting}</span>`;
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
function wfTravelStrip(topPx, hPx, leftCss, widthCss, seg, colour, conflict, maxTier) {
  const s = document.createElement('div');
  // Per-kind class (ready/travel/warmup) so adjacent strips read as three
  // distinct things even before you can make out the text.
  const kindCls = seg.kind === 'ready' ? ' wf-travel--ready' : seg.kind === 'warmup' ? ' wf-travel--warmup' : ' wf-travel--travel';
  const RANK = { tiny: 0, short: 1, long: 2 };
  let tier = hPx >= 13 ? 'long' : hPx >= 8 ? 'short' : 'tiny';
  if (maxTier && RANK[tier] > RANK[maxTier]) tier = maxTier;
  s.className = 'wf-travel' + kindCls + ` wf-travel--tier-${tier}` + (tier !== 'tiny' ? ' wf-travel--label' : '') + (conflict ? ' wf-travel--conflict' : '');
  s.style.top = topPx + 'px';
  s.style.height = hPx + 'px';
  s.style.left = leftCss;
  s.style.width = widthCss;
  if (colour && !conflict) s.style.setProperty('--wf-travel-colour', colour);
  const kindLabel = seg.kind === 'travel' ? 'Travel' : seg.kind === 'warmup' ? 'Warm-up' : 'Get ready';
  s.textContent = conflict ? `⚠️${seg.min}m` : bufferSegLabels(seg, tier);
  s.title = (conflict ? '⚠️ Overlaps another activity — not enough time. ' : '') + `${kindLabel} — ${seg.min} min`;
  return s;
}

/* Assign overlapping blocks to columns (greedy) so time-positioned cards
   never sit on top of each other. Returns a Map of id -> {col, count} where
   count is the column count of that block's own overlap group. */
function wfAssignColumns(blocks) {
  const map = new Map();
  const sorted = blocks.slice().sort((a,b)=> (a.startMin - b.startMin) || (a.durationMin - b.durationMin));
  // Group runs of mutually-overlapping blocks, then column-pack each group.
  let group = [];
  let groupEnd = -Infinity;
  const flush = ()=>{
    if (!group.length) return;
    const colEnds = []; // running end time per column
    group.forEach(b=>{
      const bStart = b.startMin;
      const bEnd = b.startMin + (b.durationMin || 0);
      let colIdx = colEnds.findIndex(end => end <= bStart);
      if (colIdx === -1) { colIdx = colEnds.length; colEnds.push(bEnd); }
      else { colEnds[colIdx] = bEnd; }
      map.set(b.id, { col: colIdx });
    });
    const count = colEnds.length;
    group.forEach(b=> { map.get(b.id).count = count; });
    group = [];
    groupEnd = -Infinity;
  };
  sorted.forEach(b=>{
    const bStart = b.startMin;
    const bEnd = b.startMin + (b.durationMin || 0);
    if (bStart >= groupEnd && group.length) flush();
    group.push(b);
    groupEnd = Math.max(groupEnd, bEnd);
  });
  flush();
  return map;
}

