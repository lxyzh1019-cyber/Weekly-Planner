// Weekly-Planner — Setup › Copy a week.
//
// The planner could already copy a week in two places, and neither was
// something a parent could ask for. The meeting used to copy
// THIS week into next, from inside the meeting, for both girls, with no choice
// about any of it. fillWeekFromNearest (js/07-week-view.js) fills a blank week
// from whichever neighbour it picks, and refuses if the week is not blank. A
// parent who wants the week before last put onto the week after next, or Jenn's
// swimming term put onto Jess's, had nothing to press.
//
// This owns no clone rule of its own. weekCloneBlock (js/07-week-view.js) is
// still the one place that decides what a copied block arrives as — not done,
// not confirmed, no XP, no ticked checklist — because a second answer to "what
// is a copy" is a second answer that can disagree with the first, and every
// copy here is a plan, never a claim about what happened.
//
// Setup rather than App, by the portal's boundary test: a copied week changes
// what the girls are asked to do.
//
// Declarations only; the delegated listener is bound in js/99-main.js.

/* How far either end may reach. Twelve weeks back covers "put back the term we
   never planned"; eight ahead covers a season booked in advance. */
const PCW_MIN_OFFSET = -12;
const PCW_MAX_OFFSET = 8;

let pcwFromOffset = -1;      // source week, relative to the week we are in
let pcwToOffset   = 0;       // destination week
let pcwOnClash    = 'skip';  // 'skip' | 'replace' — what to do with a day that already has a plan
let pcwTargetKid  = 'same';  // 'same' | 'jenn' | 'jess' — only reachable when the scope is one kid
/* A whole week or one day. Not a second screen: the decision, the preview and
   the commit are the same three functions either way, and a day copy that grew
   its own panel would be a second thing that could disagree with this one about
   what a copy is. In day mode the two weekday pickers below say which day comes
   from where — the source and the destination need not be the same weekday,
   because "put Tuesday's shape on Thursday" is a real thing to want. */
let pcwSpan    = 'week';     // 'week' | 'day'
let pcwFromDay = 0;          // 0..6, Monday first — source weekday, day mode only
let pcwToDay   = 0;          // 0..6 — destination weekday

function pcwClamp(o) { return Math.max(PCW_MIN_OFFSET, Math.min(PCW_MAX_OFFSET, o)); }
// perfMondayKey (js/11-parent.js) already turns an offset into a Monday key.
function pcwMonday(offset) { return perfMondayKey(pcwClamp(offset)); }
function pcwKidName(kid) { return kid === 'jenn' ? 'Jenn' : 'Jess'; }

/* Who copies to whom. parentScope is the portal's one switcher, so it decides
   the source: Both means each girl copies from her own week, which is the case
   a family meeting actually produces. A single kid opens the second question —
   whether the plan is for her or for her sister — and Both must never ask it,
   because "both girls' weeks onto Jess" is not a thing anyone means. */
function pcwPairs() {
  const scoped = parentScopeKid();
  if (!scoped) return [['jenn', 'jenn'], ['jess', 'jess']];
  const dst = (pcwTargetKid === 'jenn' || pcwTargetKid === 'jess') ? pcwTargetKid : scoped;
  return [[scoped, dst]];
}

/* pcwPlaceableIds lived here. The day copy needs the same answer now, so it is
   placeableActivityIds in js/05-helpers.js — one owner, since two screens
   deciding for themselves what the other child can resolve is exactly how they
   would come to disagree. */

function pcwWeekBlockCount(mondayKey, kid) {
  return mrWeekDayKeys(mondayKey)
    .reduce((n, k) => n + (getDayBlocksForProfile(k, kid) || []).length, 0);
}

/* ── One decision, read twice ──
   The preview and the commit both read this, so what a parent is shown is
   literally what will happen. It reads every source day BEFORE anything is
   written, which is also what makes a same-week cross-child copy safe: Jenn's
   Monday is captured before Jess's Monday is replaced. */
function pcwPlan() {
  const fromKey = pcwMonday(pcwFromOffset);
  const toKey   = pcwMonday(pcwToOffset);
  const srcDays = mrWeekDayKeys(fromKey);
  const dstDays = mrWeekDayKeys(toKey);
  const day = pcwSpan === 'day';
  const plan = { fromKey, toKey, day, rows: [], copy: 0, skipped: 0, replaced: 0, dropped: 0, sameSpot: false };

  pcwPairs().forEach(([srcKid, dstKid]) => {
    const cross = srcKid !== dstKid;
    // A week onto itself for the same child is not a copy, it is a no-op with a
    // confirmation dialog in front of it. In day mode the same is true only
    // when it is also the same weekday.
    const samePlace = day ? (fromKey === toKey && pcwFromDay === pcwToDay) : fromKey === toKey;
    if (!cross && samePlace) { plan.sameSpot = true; return; }
    const canPlace = cross ? placeableActivityIds(dstKid) : null;
    const pairs = day ? [[srcDays[pcwFromDay], dstDays[pcwToDay], pcwFromDay, pcwToDay]]
                      : srcDays.map((k, i) => [k, dstDays[i], i, i]);
    const days = pairs.map(([srcKey, dstKey, si, di]) => {
      const i = si, toIdx = di;
      const all = getDayBlocksForProfile(srcKey, srcKid) || [];
      const usable = canPlace ? all.filter(b => !b.actId || canPlace.has(b.actId)) : all.slice();
      const existing = getDayBlocksForProfile(dstKey, dstKid) || [];
      const dropped = all.length - usable.length;
      let action = 'none';
      if (usable.length) {
        action = existing.length ? (pcwOnClash === 'replace' ? 'replace' : 'skip') : 'copy';
      }
      if (action === 'copy' || action === 'replace') plan.copy += usable.length;
      if (action === 'skip') plan.skipped += usable.length;
      if (action === 'replace') plan.replaced += existing.length;
      plan.dropped += dropped;
      return {
        i, toIdx, srcKey, dstKey, action, dropped,
        usable, existingIds: existing.map(b => b.id), existing: existing.length,
      };
    });
    plan.rows.push({ srcKid, dstKid, cross, days });
  });
  return plan;
}

/* The write, with no UI in it — which is also how tests/smoke.js drives it.
   Tombstoning a replaced day is not optional: without it a merge from another
   device brings the old blocks straight back (js/04-merge.js), and the parent
   is left with both plans on one day. */
function pcwCommit(plan) {
  if (!plan || plan.sameSpot) return 0;
  let landed = 0;
  plan.rows.forEach(row => {
    row.days.forEach(d => {
      if (d.action !== 'copy' && d.action !== 'replace') return;
      if (d.action === 'replace' && d.existingIds.length) tombstoneBlockIds(d.existingIds);
      setDayBlocks(d.dstKey, d.usable.map(b => weekCloneBlock(b)), row.dstKid);
      landed += d.usable.length;
    });
  });
  saveAll();
  return landed;
}

async function pcwApply() {
  if (!isParent()) { showToast('Parents run this 🔒'); return; }
  const plan = pcwPlan();
  if (plan.sameSpot) { showToast('Pick two different weeks'); return; }
  if (!plan.copy) { showToast('Nothing to copy'); return; }
  if (plan.replaced) {
    const n = plan.replaced;
    const ok = await showConfirm(
      `Replace ${n} block${n === 1 ? '' : 's'} already planned ${plan.day
        ? `on ${DAY_LONG[pcwToDay]}, ${mmWeekLabel(plan.toKey)}` : `in ${mmWeekLabel(plan.toKey)}`}?\n\n`
      + `${plan.copy} block${plan.copy === 1 ? '' : 's'} from ${plan.day
        ? `${DAY_LONG[pcwFromDay]}, ${mmWeekLabel(plan.fromKey)}` : mmWeekLabel(plan.fromKey)} go in their place. `
      + `Nothing in ${mmWeekLabel(plan.fromKey)} is touched.`,
      { danger: true, okLabel: 'Replace them' });
    if (!ok) return;
  }
  const n = pcwCommit(plan);
  pcwRender();
  showToast(n ? `📋 Copied ${n} block${n === 1 ? '' : 's'} — now fix what's wrong` : 'Nothing to copy');
}

/* ── The panel ──
   Two week pickers, who it is for, what happens to a day that is already
   planned, and then the whole thing written out day by day before anything
   moves. A copy that silently skipped four of seven days is how a parent ends
   up believing a week is planned when it is not. */
function pcwWeekPicker(which, offset) {
  const key = pcwMonday(offset);
  const label = mmWeekLabel(key);
  const counts = ['jenn', 'jess'].map(kid =>
    `${CT_PROFILE_ICON[kid]} ${pcwWeekBlockCount(key, kid)}`).join(' · ');
  const rel = offset === 0 ? 'this week'
            : offset === -1 ? 'last week'
            : offset === 1 ? 'next week'
            : offset < 0 ? `${-offset} weeks back` : `${offset} weeks ahead`;
  return `<div class="pcw-pick">
      <button type="button" class="pcw-step" data-pcw-step="${which}" data-pcw-d="-1"
        aria-label="Earlier week">◀</button>
      <span class="pcw-wk">
        <span class="pcw-wk-label">${escapeHtml(label)}</span>
        <span class="pcw-wk-sub">${escapeHtml(rel)} · blocks: ${counts}</span>
      </span>
      <button type="button" class="pcw-step" data-pcw-step="${which}" data-pcw-d="1"
        aria-label="Later week">▶</button>
    </div>`;
}

const PCW_ACTION_TEXT = {
  copy:    ['pcw-tag-copy',    'copy'],
  replace: ['pcw-tag-replace', 'replace'],
  skip:    ['pcw-tag-skip',    'skip — already planned'],
  none:    ['pcw-tag-none',    'nothing to copy'],
};

function pcwPreviewRow(row) {
  const who = row.cross
    ? `${CT_PROFILE_ICON[row.srcKid]} ${pcwKidName(row.srcKid)} → ${CT_PROFILE_ICON[row.dstKid]} ${pcwKidName(row.dstKid)}`
    : `${CT_PROFILE_ICON[row.srcKid]} ${pcwKidName(row.srcKid)}`;
  /* Seven identical "nothing to copy" rows is not a description of a blank
     week, it is padding a parent has to read past to reach the girl whose week
     actually has something in it. One line says the same thing. */
  if (row.days.every(d => d.action === 'none')) {
    const why = row.days.some(d => d.dropped)
      ? `nothing here that ${escapeHtml(pcwKidName(row.dstKid))} can use — those activities are not on her list`
      : 'nothing was planned that week';
    return `<div class="pn-card pcw-preview">
        <div class="pcw-who">${escapeHtml(who)}</div>
        <div class="pcw-empty">— ${why}</div>
      </div>`;
  }
  const days = row.days.map(d => {
    const [cls, word] = PCW_ACTION_TEXT[d.action];
    const n = d.action === 'none' ? '—' : String(d.usable.length);
    const extra = d.action === 'replace' ? ` (${d.existing} removed)` : '';
    // In day mode the two ends can be different weekdays, so the row has to say
    // which one it lands on — "Tue" alone would not tell you it becomes Thursday.
    const dow = (d.toIdx != null && d.toIdx !== d.i)
      ? `${DAY_SHORT[d.i]} → ${DAY_SHORT[d.toIdx]}` : DAY_SHORT[d.i];
    return `<div class="pcw-day">
        <span class="pcw-day-dow">${escapeHtml(dow)}</span>
        <span class="pcw-day-n">${n}</span>
        <span class="pcw-tag ${cls}">${escapeHtml(word + extra)}</span>
      </div>`;
  }).join('');
  const dropped = row.days.reduce((n, d) => n + d.dropped, 0);
  const note = dropped
    ? `<p class="pn-note">${dropped} block${dropped === 1 ? '' : 's'} left behind — ${escapeHtml(pcwKidName(row.dstKid))} does not have
        ${dropped === 1 ? 'that activity' : 'those activities'} on her list. Share it in Setup › Activities and sports first.</p>`
    : '';
  return `<div class="pn-card pcw-preview">
      <div class="pcw-who">${escapeHtml(who)}</div>
      <div class="pcw-days">${days}</div>${note}
    </div>`;
}

function pcwRender() {
  const wrap = document.getElementById('pcwWrap');
  if (!wrap) return;
  if (!isParent()) { wrap.innerHTML = `<div class="pn-card">Parents only 🔒</div>`; return; }
  const plan = pcwPlan();
  const scoped = parentScopeKid();

  /* The second question only exists when the scope names one child, and it is
     genuinely two different jobs: "do last week again" and "give Jess her
     sister's swimming term". */
  const targets = scoped ? [
    ['same', `${CT_PROFILE_ICON[scoped]} Her own plan`],
    [scoped === 'jenn' ? 'jess' : 'jenn',
      `${CT_PROFILE_ICON[scoped === 'jenn' ? 'jess' : 'jenn']} Over to ${pcwKidName(scoped === 'jenn' ? 'jess' : 'jenn')}`],
  ] : null;
  const cur = (pcwTargetKid === 'jenn' || pcwTargetKid === 'jess') ? pcwTargetKid : 'same';
  const whoCard = targets
    ? `<p class="pn-cap">Onto whose plan</p>
       <div class="pn-toggle">${targets.map(([id, label]) =>
          `<button type="button" class="pill-btn${id === cur ? ' active' : ''}"
             data-pcw-target="${id}">${escapeHtml(label)}</button>`).join('')}</div>`
    : `<p class="pn-note">Both girls — each one copies from her own plan. Pick a single
        child above to send one girl's plan over to her sister.</p>`;

  const clash = [['skip', 'Leave it alone'], ['replace', 'Replace it']];
  const held = !!(((state.shared.chore || {}).meetingsHeld || {})[plan.toKey]);
  const day = pcwSpan === 'day';
  const spanToggle = [['week', '🗓 A whole week'], ['day', '📅 One day']];
  const dayPicker = (which, cur) => `<div class="pcw-days-pick">${DAY_SHORT.map((d, i) =>
      `<button type="button" class="pill-btn pcw-daybtn${i === cur ? ' active' : ''}"
         data-pcw-day="${which}" data-pcw-i="${i}"
         aria-pressed="${i === cur}">${escapeHtml(d)}</button>`).join('')}</div>`;

  /* Three empty cases, each saying which one it is — a card must never render
     blank, and "nothing will happen" has three different fixes. */
  let summary;
  if (plan.sameSpot) {
    summary = `<div class="pn-card pn-clear">Those are the same week. Move one end, or send this
      week over to her sister.</div>`;
  } else if (!plan.copy && !plan.skipped) {
    summary = `<div class="pn-card pn-clear">Nothing was planned ${day
      ? `on ${escapeHtml(DAY_LONG[pcwFromDay])} in ${escapeHtml(mmWeekLabel(plan.fromKey))}`
      : `in ${escapeHtml(mmWeekLabel(plan.fromKey))}`},
      so there is nothing to copy. Pick a ${day ? 'day' : 'week'} that has a plan in it.</div>`;
  } else if (!plan.copy) {
    summary = `<div class="pn-card pn-clear">${day
      ? `${escapeHtml(DAY_LONG[pcwToDay])} in ${escapeHtml(mmWeekLabel(plan.toKey))} already has a plan`
      : `Every day in ${escapeHtml(mmWeekLabel(plan.toKey))} already has a plan`},
      so all ${plan.skipped} block${plan.skipped === 1 ? '' : 's'} would be skipped. Choose
      <b>Replace it</b> above to overwrite them.</div>`;
  } else {
    const where = day
      ? `${DAY_LONG[pcwToDay]}, ${mmWeekLabel(plan.toKey)}`
      : mmWeekLabel(plan.toKey);
    summary = `<button type="button" class="btn-confirm pn-wide" data-pcw-go="1">📋 Copy ${plan.copy}
      block${plan.copy === 1 ? '' : 's'} into ${escapeHtml(where)}</button>`;
  }

  wrap.innerHTML = `<p class="pn-cap">Copy a plan</p>
    <div class="pn-card pn-clear">Take the shape of one week — or one day — and put it somewhere
      else: a term that repeats, a fortnight nobody planned, or one girl's schedule handed to her
      sister. Every copy arrives as a plan: nothing is ticked, confirmed, or paid.</div>

    <div class="pn-toggle" style="margin-top:0.6rem">${spanToggle.map(([id, label]) =>
      `<button type="button" class="pill-btn${id === pcwSpan ? ' active' : ''}"
         data-pcw-span="${id}">${escapeHtml(label)}</button>`).join('')}</div>

    <p class="pn-cap" style="margin-top:0.8rem">Copy from</p>
    <div class="pn-card">${pcwWeekPicker('from', pcwFromOffset)}${day ? dayPicker('from', pcwFromDay) : ''}</div>

    <p class="pn-cap" style="margin-top:0.8rem">Copy to</p>
    <div class="pn-card">${pcwWeekPicker('to', pcwToOffset)}${day ? dayPicker('to', pcwToDay) : ''}</div>
    ${held ? `<p class="pn-note">⚠️ ${escapeHtml(mmWeekLabel(plan.toKey))} was already settled at a meeting.
      The money that was paid does not move, but changing the plan changes what History reads back
      for that week.</p>` : ''}

    <div style="margin-top:0.8rem">${whoCard}</div>

    <p class="pn-cap" style="margin-top:0.8rem">If a day already has a plan</p>
    <div class="pn-toggle">${clash.map(([id, label]) =>
      `<button type="button" class="pill-btn${id === pcwOnClash ? ' active' : ''}"
         data-pcw-clash="${id}">${escapeHtml(label)}</button>`).join('')}</div>
    <p class="pn-note">${pcwOnClash === 'replace'
      ? 'A day that already has blocks is emptied first. Days in every other week are untouched.'
      : 'A day that already has blocks is left exactly as it is — a copy never overwrites a plan somebody made.'}</p>

    <p class="pn-cap" style="margin-top:0.8rem">What will happen</p>
    ${plan.rows.map(pcwPreviewRow).join('') || `<div class="pn-card pn-clear">Nothing to show yet.</div>`}
    <div style="margin-top:0.6rem">${summary}</div>`;
}

/* One delegated listener, bound in js/99-main.js — every render replaces the
   whole wrap, so a handler bound to a button would be gone the first time a
   week changed. */
function pcwHandleClick(e) {
  const step = e.target.closest('[data-pcw-step]');
  if (step) {
    const d = Number(step.getAttribute('data-pcw-d')) || 0;
    if (step.getAttribute('data-pcw-step') === 'from') pcwFromOffset = pcwClamp(pcwFromOffset + d);
    else pcwToOffset = pcwClamp(pcwToOffset + d);
    pcwRender();
    return;
  }
  const span = e.target.closest('[data-pcw-span]');
  if (span) { pcwSpan = span.getAttribute('data-pcw-span'); pcwRender(); return; }
  const dayBtn = e.target.closest('[data-pcw-day]');
  if (dayBtn) {
    const i = Math.max(0, Math.min(6, Number(dayBtn.getAttribute('data-pcw-i')) || 0));
    if (dayBtn.getAttribute('data-pcw-day') === 'from') pcwFromDay = i; else pcwToDay = i;
    pcwRender();
    return;
  }
  const target = e.target.closest('[data-pcw-target]');
  if (target) { pcwTargetKid = target.getAttribute('data-pcw-target'); pcwRender(); return; }
  const clash = e.target.closest('[data-pcw-clash]');
  if (clash) { pcwOnClash = clash.getAttribute('data-pcw-clash'); pcwRender(); return; }
  if (e.target.closest('[data-pcw-go]')) { pcwApply(); return; }
}
