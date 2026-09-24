// Weekly-Planner — sister sync, challenges, and invites.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   SISTER SYNC
════════════════════════════════════════════════════════════════ */
function openSisterSync() {
  if (isParent()) { showToast('View each child separately 👀'); return; }
  /* Today, not Monday. This opened on syncDayIdx = 0 unconditionally while the
     copy underneath read "You're both free for about … today" — so from Tuesday
     onward the screen named one day and answered about another. Falls back to
     the start of the week only when today is not in the week being viewed. */
  const i = getDayKeys(weekOffset).indexOf(todayKey());
  syncDayIdx = i >= 0 ? i : 0;
  showScreen('sync');
  renderSync();
}
function changeSyncDay(d) { syncDayIdx = (syncDayIdx+d+7)%7; renderSync(); }

function renderSync() {
  document.getElementById('syncProfileBadge').textContent = profile==='jenn'?'🐥 Jenn':'🦊 Jess';
  const keys = getDayKeys(weekOffset);
  const key = keys[syncDayIdx];
  const d = formatDayKey(key);
  document.getElementById('syncDayLabel').textContent = `${DAY_LONG[syncDayIdx]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;

  const jB = getDayBlocks(key, 'jenn');
  const sB = getDayBlocks(key, 'jess');

  // Overlaps — genuine "you're both free" time: any 15-min slot in the
  // 6am–9pm window that is either unscheduled or a Free-category block for
  // BOTH girls. (Previously it only counted explicit Free blocks, so two
  // kids who simply left time open never saw an overlap.)
  const overlapWrap = document.getElementById('syncOverlapWrap');
  overlapWrap.innerHTML = '';
  const acts = getAllActivities(activeProfile(), { includeArchived: true });
  const TOTAL = Math.round(DAY_MIN_SPAN / 15);
  const busySlots = (blocks) => {
    const busy = new Set();
    blocks.forEach(b => {
      const a = acts.find(x => x.id === b.actId);
      if (a && a.cat === 'free') return;      // free time = still available to hang out
      const s = Math.floor((b.startMin - START_MIN) / 15);
      const e = Math.ceil((b.startMin - START_MIN + (b.durationMin || 0)) / 15);
      for (let i = Math.max(0, s); i < Math.min(TOTAL, e); i++) busy.add(i);
    });
    return busy;
  };
  const jBusy = busySlots(jB), sBusy = busySlots(sB);
  const freeSlots = [];
  for (let i = 0; i < TOTAL; i++) if (!jBusy.has(i) && !sBusy.has(i)) freeSlots.push(i);
  if (freeSlots.length) {
    // Collapse contiguous slots into readable time ranges (show the first few).
    const ranges = [];
    let runStart = freeSlots[0], prev = freeSlots[0];
    for (let k = 1; k <= freeSlots.length; k++) {
      if (k < freeSlots.length && freeSlots[k] === prev + 1) { prev = freeSlots[k]; continue; }
      ranges.push([runStart, prev + 1]);
      if (k < freeSlots.length) { runStart = freeSlots[k]; prev = freeSlots[k]; }
    }
    // Only surface reasonably-sized windows (≥30 min) as hang-out suggestions.
    const windows = ranges.filter(([a, b]) => (b - a) * 15 >= 30)
      .map(([a, b]) => `${formatTimeFromMin(START_MIN + a*15)}–${formatTimeFromMin(START_MIN + b*15)}`);
    const totalMin = freeSlots.length * 15;
    const overlap = document.createElement('div');
    overlap.className = 'sync-overlap';
    /* "today" was hardcoded, which was wrong on every day the arrows moved to
       and — before this screen opened on today — on six days out of seven. */
    const when = key === todayKey() ? 'today' : `on ${DAY_LONG[syncDayIdx]}`;
    overlap.innerHTML = windows.length
      ? `🎉 You're both free for about <b>${fmtHrsMin(totalMin)}</b> ${when} — e.g. <b>${windows.slice(0, 3).join(', ')}</b>. Why not hang out?`
      : `🎉 You both have about <b>${fmtHrsMin(totalMin)}</b> of free time overlapping ${when}!`;
    overlapWrap.appendChild(overlap);
  }

  // Side-by-side
  const grid = document.getElementById('syncGrid');
  const showAll = sisterDetailsVisibleGlobal();
  const toggleWrap = document.createElement('div');
  toggleWrap.className = 'repeat-toggle';
  toggleWrap.classList.toggle('on', showAll);
  toggleWrap.style.marginBottom = '0.55rem';
  toggleWrap.innerHTML = `
    <div class="toggle-track"><div class="toggle-knob"></div></div>
    <span class="toggle-label">${showAll ? '👯 Sister details: Showing all activities' : '🙈 Sister details: Busy slots only'}</span>
  `;
  toggleWrap.onclick = ()=>setSisterDetailsVisibleGlobal(!showAll);
  overlapWrap.appendChild(toggleWrap);
  grid.innerHTML = '';
  [['jenn','🐥 Jenn',jB], ['jess','🦊 Jess',sB]].forEach(([p, lbl, blocks])=>{
    const col = document.createElement('div');
    col.className = 'sync-day-col';
    col.innerHTML = `<h4>${lbl}</h4>`;
    if (!blocks.length) col.innerHTML += '<p style="font-size:0.8rem;color:var(--ink-light)">Nothing planned</p>';
    const acts = getAllActivities(p, { includeArchived: true });
    const isMe = (p === profile);
    blocks.slice().sort((a,b)=>a.startMin-b.startMin).forEach(b=>{
      const act = acts.find(a=>a.id===b.actId);
      if (!act) return;
      const tStr = formatTimeFromMin(b.startMin);
      const mini = document.createElement('div');
      mini.className = 'sync-block-mini';
      // Sister's private blocks: show time+"Busy" only. Public blocks show details.
      const showDetails = isMe || (showAll && !!b.public);
      if (showDetails) {
        // One owner, so a sister's day is not drawn in a retired hue.
        mini.style.background = blockColour(b, p);
        mini.style.color = '#fff';
        mini.textContent = `${tStr} ${act.icon} ${act.name}`;
      } else {
        mini.style.background = '#cfcfcf';
        mini.style.color = '#555';
        mini.textContent = `${tStr} • Busy`;
      }
      if (isMe) {
        mini.style.cursor='pointer';
        mini.title = 'Tap to invite your sister';
        mini.onclick = ()=>sendInvite(b, p==='jenn'?'jess':'jenn', key);
      }
      col.appendChild(mini);
    });
    grid.appendChild(col);
  });

  renderChallenges();
  renderInvites();
}

/* IS THERE ALREADY ONE OF THESE? The one owner of that question.

   Returns the LIVE invite — pending or accepted — from this block to this
   sister of this kind ('watch' when inv.watch, else 'share'), or null. A
   declined invite is not live: plans change, and a no on Tuesday is not a no
   for ever. The two kinds are separate questions, because asking her to come
   and watch is not the same as asking her to do it too.

   sendInvite refuses a live duplicate through this, and both edit-sheet
   buttons read their sent-state from it. `invitedTo` on the block is the 💌
   badge on the inviter's timeline and nothing else — it is a bare list of
   names and cannot tell a share from a watch. */
function sisterInviteFor(blockId, to, kind) {
  return (state.shared.invites || []).find(inv => inv
    && inv.sourceBlockId === blockId && inv.to === to
    && (inv.watch ? 'watch' : 'share') === kind
    && (inv.status === 'pending' || inv.status === 'accepted')) || null;
}

/* WHAT AN INVITE CARRIES — the one owner.

   An invite was a hand-copied subset of a block, and each round found a fact
   the copy left out or guessed: the sender, the day, and then the buffers — a
   share arrived with no drive and no get-ready, and a watch invite always gave
   her 15 minutes each way however far away the meet was. Everything an invite
   takes from its block is read here and nowhere else.

   Buffers are read ONLY through the per-side readers (getTravelBufMin /
   getGetReadyBufMin, js/03-sync.js), so a block that predates the two-leg split
   carries the symmetric pair it has always drawn. Both objects are always
   written, zeros included: their presence is how inviteToBlock tells an invite
   carrying "no buffers" from one sent before this change. WARM-UP IS NEVER
   CARRIED — it is training-only, and it is the sender's. Plain data inside
   `state.shared.invites`, merged whole-record by mergeArrayById: no new key. */
function inviteSnapshot(block, dayKey) {
  const toMin = getTravelBufMin(block, 'pre'), homeMin = getTravelBufMin(block, 'post');
  const beforeMin = getGetReadyBufMin(block, 'pre'), afterMin = getGetReadyBufMin(block, 'post');
  return {
    actId: block.actId,
    day: dayKey,
    startMin: block.startMin,
    durationMin: block.durationMin,
    sourceBlockId: block.id,
    travel: { to: toMin > 0, toMin, home: homeMin > 0, homeMin },
    ready: { before: beforeMin > 0, beforeMin, after: afterMin > 0, afterMin },
  };
}
/* What she gets, in the words the edit sheet uses: "🚗 20m there · 25m home and
   👕 15m to get ready". Plain text; '' when the invite carries no buffers. */
function inviteBufferWords(inv) {
  const t = inv.travel || {}, r = inv.ready || {};
  const travel = [t.to ? `${fmtHrsMin(t.toMin)} there` : '', t.home ? `${fmtHrsMin(t.homeMin)} home` : '']
    .filter(Boolean);
  const ready = [r.before ? `👕 ${fmtHrsMin(r.beforeMin)} to get ready` : '',
                 r.after ? `🧺 ${fmtHrsMin(r.afterMin)} to unpack` : ''].filter(Boolean);
  return [travel.length ? '🚗 ' + travel.join(' · ') : '', ready.join(' · ')].filter(Boolean).join(' and ');
}

/* WHAT ACCEPTING WRITES — the one owner, for every accept door (the Sister Sync
   inbox and the Day view's pending ghost, both through placeInvite). Puts the
   block on `dayKey` for `profile` (the inbox is hers) and returns it.

   Buffers are written the way the edit sheet writes them — master switch and
   both legs spelled out — so her copy draws, clashes and edits exactly like the
   sender's. A share gets the sender's drive, get-ready and unpack; a watch
   block gets the MEET's own travel and get-ready, and never a warm-up.

   An invite with no snapshot (sent before this change) is placed exactly as it
   always was: a share with no buffers, a watch block with the fixed
   DEFAULT_BUFFER_MIN each way. No migration.

   A WATCH INVITE IS A DIFFERENT KIND OF BLOCK. `watching` is what makes
   blockIsCompetition answer false, which is the whole guard: no result is
   ever asked of her, nothing is adopted as the meet's own block, and nothing
   reaches the money tab. She keeps the meet's name and tag so her card can
   say which meet it is. */
function inviteToBlock(inv, dayKey) {
  const fromName = inv.from === 'jenn' ? 'Jenn' : 'Jess';
  const placed = {
    id: Date.now().toString(36)+Math.random().toString(36).slice(2,5),
    actId: inv.actId, startMin: inv.startMin, durationMin: inv.durationMin,
    colour: CAT_HEX.free, objectives:[], note:`With ${fromName} 💕`, tag:null,
    checklistState: {}, travelBuffer: false,
  };
  if (inv.watch) {
    placed.watching = true;
    placed.compName = inv.compName || null;
    placed.tag = inv.tag || null;
    placed.note = `Watching ${fromName} 👀`;
    placed.warmupBuffer = false;
  }
  const t = inv.travel, r = inv.ready;
  if (t && typeof t === 'object' && r && typeof r === 'object') {
    // Values arrive off a shared document, so they are clamped like any typed figure.
    if (t.to || t.home) {
      const first = clampBufferMin(t.to ? t.toMin : t.homeMin);
      placed.travelBuffer = true;
      placed.travelBufMin = first;
      placed.travelTo = !!t.to;
      placed.travelToMin = t.to ? clampBufferMin(t.toMin) : first;
      placed.travelHome = !!t.home;
      placed.travelHomeMin = t.home ? clampBufferMin(t.homeMin) : first;
    }
    if (r.before || r.after) {
      const first = clampBufferMin(r.before ? r.beforeMin : r.afterMin);
      placed.getReadyBuffer = true;
      placed.getReadyBufMin = first;
      placed.readyBefore = !!r.before;
      placed.readyBeforeMin = r.before ? clampBufferMin(r.beforeMin) : first;
      placed.readyAfter = !!r.after;
      placed.readyAfterMin = r.after ? clampBufferMin(r.afterMin) : first;
    }
  } else if (inv.watch) {
    placed.travelBuffer = true;
    placed.travelBufMin = DEFAULT_BUFFER_MIN;
  }
  const blocks = getDayBlocks(dayKey, profile);
  blocks.push(placed);
  setDayBlocks(dayKey, blocks, profile);
  return placed;
}

/* HAS ITS DAY GONE? Derived from the date, like the rest of the app — nothing
   is written, so there is no status to merge and no new shared state. A series
   invite (its `series.dayKeys`) is missed only once its LAST day has gone. */
function inviteLastDay(inv) {
  const days = (inv && inv.series && Array.isArray(inv.series.dayKeys) && inv.series.dayKeys.length)
    ? inv.series.dayKeys : [inv && inv.day];
  return days.filter(d => typeof d === 'string').sort().pop() || null;
}
function inviteIsMissed(inv) {
  const last = inviteLastDay(inv);
  return !!last && last < todayKey();
}
/* CAN IT BE ACCEPTED NOW? Pending, and not missed. Both accept doors ask this
   one question, so the Day view cannot drift from the inbox. A missed invite is
   answered with 📌 Add it anyway (addInviteAnyway) or Decline, never Accept. */
function inviteAcceptable(inv) {
  return !!inv && inv.status === 'pending' && !inviteIsMissed(inv);
}

/* `opts.watch` turns this into an invitation to COME AND WATCH rather than to
   do the same thing at the same time. An options argument that defaults to {}
   leaves the call sites that pass none sending a plain invite. What either kind
   carries from the block is inviteSnapshot's to say, not this function's.

   THE ONE WRITER of an invite. Sister Sync's tap, the edit sheet's 💌 and its
   👀 all come through here, so the duplicate guard below holds for every door.

   `day` is the day the block is on, and the CALLER says which: Sister Sync
   passes the day it is showing, the edit sheet the day it is editing. It used
   to be read here as `currentDayKey || <the Sync day>`, but currentDayKey is
   left behind by any day-view visit and never cleared — so a tap on
   Thursday's block in Sister Sync, after Monday had been opened, was dated
   Monday, missed the 💌 stamp and landed on her sister's Monday. No day, no
   invite: it refuses rather than guess. */
async function sendInvite(block, to, day, opts = {}) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    showToast('Could not tell which day this is — nothing was sent.');
    return;
  }
  const watch = !!opts.watch;
  /* WHOSE invite this is. It was `profile`, which is the literal switch
     position and reads 'parent' when a grown-up is looking at Jenn's day — so
     an invite sent from the edit sheet in the parent portal would have been
     recorded as coming from nobody. activeProfile() is the child whose plan
     this is, and for a kid the two are the same value, so the existing Sister
     Sync path (which is kid-only anyway) is unchanged. */
  const from = activeProfile();
  const sisterName = to==='jenn'?'Jenn':'Jess';
  /* Refused before the dialog, so she is never asked to confirm something that
     will not happen — and told which state it is in, not just "no". */
  const already = sisterInviteFor(block.id, to, watch ? 'watch' : 'share');
  if (already) {
    showToast(already.status === 'accepted'
      ? (watch ? `${sisterName} already said yes to watching — it's on her plan`
               : `It's already on ${sisterName}'s plan`)
      : (watch ? `${sisterName} is already invited to watch — she hasn't answered yet`
               : `${sisterName} already has this invite — she hasn't answered yet`));
    return;
  }
  const act = findActivity(block.actId, from) || findActivity(block.actId);
  const receiverAct = findActivity(block.actId, to);
  if (!receiverAct) {
    showToast(`${sisterName} cannot receive this activity yet.`);
    return;
  }
  const activityLabel = act ? `${act.icon} ${act.name}` : 'this activity';
  const dayDate = formatDayKey(day);
  const dayIdx = (dayDate.getDay()+6)%7;
  /* The MEET, not just the activity. "Share 🏆 Competition" is every meet this
     season, and a child being asked to give up a Saturday deserves to know
     which one. Falls back to whatever the card already calls it. */
  const meetLabel = (block.compName && String(block.compName).trim())
    || (typeof blockDisplayName === 'function' ? blockDisplayName(block, from).name : '')
    || activityLabel;
  const carried = inviteSnapshot(block, day);
  // Plain text: the dialog escapes it where it lands. No buffers, no sentence.
  const gets = inviteBufferWords(carried);
  const ok = await showConfirm(
    watch
      ? `Invite ${sisterName} to come and watch ${meetLabel} on ${DAY_SHORT[dayIdx]} at ${formatTimeFromMin(block.startMin)}?\n\n`
        + (gets ? `She gets the same ${gets}.\n\n` : '')
        + 'It goes on her plan as something she is watching. She earns nothing for it — it is your meet, not hers.'
      : `Share ${activityLabel} on ${DAY_SHORT[dayIdx]} at ${formatTimeFromMin(block.startMin)} with ${sisterName}?`
        + (gets ? ` She gets the same ${gets}.` : ''),
    { okLabel: watch ? 'Invite her' : 'Share' });
  if (!ok) return;
  const inv = {
    id: 'inv-'+Date.now().toString(36),
    from,
    to,
    ...carried,
    status: 'pending',
    createdAt: syncNow(),
  };
  if (watch) {
    inv.watch = true;
    inv.compName = (block.compName && String(block.compName).trim()) || null;
    inv.tag = block.tag || null;
  }
  state.shared.invites = [...(state.shared.invites||[]), inv];
  // Stamp invitedTo on the source block so the inviter sees the 💌 badge on their own timeline.
  // Find the block in its actual day store — the day the caller passed.
  const sourceProfile = from; // sender
  const blocks = ((state.profiles[sourceProfile]||{}).weeks||{})[day] || [];
  const src = blocks.find(b => b.id === block.id);
  if (src) {
    if (!Array.isArray(src.invitedTo)) src.invitedTo = [];
    if (!src.invitedTo.includes(to)) src.invitedTo.push(to);
  }
  saveAll();
  showToast(`Invite sent to ${to==='jenn'?'Jenn':'Jess'} 💌`);
}

function startBlockStopwatch(blockId) {
  if (!blockId) return;
  const blocks = getDayBlocks(currentDayKey);
  const blk = blocks.find(b=>b.id===blockId);
  if (!blk) return;
  if (!blk.stopwatch || !blk.stopwatch.enabled) {
    showToast('Enable stopwatch in Edit first ⏱');
    return;
  }
  if (blk.stopwatch.running) {
    showToast('Stopwatch already running ⏱');
    return;
  }
  blk.stopwatch.running = true;
  blk.stopwatch.startedAt = Date.now();
  blk.stopwatch.elapsedSec = Math.max(0, blk.stopwatch.elapsedSec|0);
  if (blk.stopwatch.goalSec == null) blk.stopwatch.goalSec = Math.max(60, (blk.durationMin|0) * 60);
  setDayBlocks(currentDayKey, blocks);
  buildTimeline();
  openEditSheet(blockId);
  showToast('Stopwatch started ⏱');
}
/* ════════════════════════════════════════════════════════════════
   CHALLENGES
════════════════════════════════════════════════════════════════ */

function renderChallenges() {
  const list = document.getElementById('challengesList');
  list.innerHTML = '';
  const weekStart = dateToLocalKey(getWeekStart(weekOffset));
  const challenges = (state.shared.challenges||[]).filter(c=>c.weekStart===weekStart);
  if (!challenges.length) {
    list.innerHTML = '<p style="color:var(--ink-light);font-size:0.95rem">No goals yet. Tap ＋ to add one!</p>';
  } else {
    challenges.forEach(c=>{
      const card = document.createElement('div');
      card.className = 'challenge-card';
      const keys = getDayKeys(weekOffset);
      const profiles = c.who==='both' ? ['jenn','jess'] : [c.who];
      const rows = profiles.map(p=>{
        const count = keys.reduce((n, k)=> n + (getDayBlocks(k, p).filter(b=>b.actId===c.activityId).length), 0);
        const pct = Math.min(100, Math.round(count/c.target*100));
        return `
          <div class="challenge-progress">
            <span>${p==='jenn'?'🐥':'🦊'}</span>
            <div class="challenge-bar"><div class="challenge-fill" style="width:${pct}%"></div></div>
            <span>${count}/${c.target}</span>
          </div>`;
      }).join('');
      const teamNote = c.who==='both'
        ? `<div class="ct-meta" style="font-style:italic;margin-bottom:0.2rem">You're a team on this one — cheer each other on! 🤝</div>`
        : '';
      card.innerHTML = `
        <div class="challenge-title">${escapeHtml(c.title)}</div>
        ${teamNote}
        ${rows}
        <div style="display:flex;justify-content:flex-end;margin-top:0.4rem">
          <button class="btn-icon" onclick="deleteChallenge('${escapeJsAttr(c.id)}')" style="padding:2px 8px">🗑</button>
        </div>
      `;
      list.appendChild(card);
    });
  }
}

/* THE INBOX'S OWN QUESTION AND ITS OWN WORDS, shared with Today's 💌 note
   (tdInviteNote, js/31-today.js) so the signpost and the inbox cannot drift:
   the note counts exactly what this list shows, and names each invite with the
   same who / what / day / time and the same fallbacks. A MISSED invite is not
   waiting (inviteAcceptable), so the note never points at a day already gone. */
function invitesWaitingFor(p) {
  return (state.shared.invites || []).filter(i => i && i.to === p && inviteAcceptable(i));
}
/* Pending invites to `p` whose day has passed — the inbox's small Missed group.
   One from before this week drops out of the list so it cannot grow for ever;
   it stays stored (invites are never deleted: no tombstone scope). */
function invitesMissedFor(p) {
  const weekStart = dateToLocalKey(getWeekStart(0));
  return (state.shared.invites || []).filter(i => i && i.to === p && i.status === 'pending'
    && inviteIsMissed(i) && inviteLastDay(i) >= weekStart);
}
/* Plain text; each surface escapes it where it lands. A watch invite's subject
   is the MEET, not the activity — accepting "Competition" and finding out on
   Saturday that it is somebody else's is not an invitation anybody agreed to. */
function inviteFacts(inv) {
  const act = getAllActivities(inv.to, { includeArchived: true }).find(a => a.id === inv.actId);
  const d = formatDayKey(inv.day);
  return {
    from: inv.from === 'jenn' ? 'Jenn' : 'Jess',
    subject: inv.watch
      ? ((inv.compName || '').trim() || (act?.name || 'her competition'))
      : (act ? `${act.icon} ${act.name}` : 'an activity'),
    day: DAY_SHORT[(d.getDay() + 6) % 7],
    time: formatTimeFromMin(inv.startMin),
  };
}

// Activity-sharing invites — task sharing, so they live under Sister Sync.
// THE inbox: Today only signposts it (tdInviteNote); accept and decline live here.
function renderInvites() {
  const inviteList = document.getElementById('invitesList');
  if (!inviteList) return;
  inviteList.innerHTML = '';
  const myInvites = invitesWaitingFor(profile);
  const missed = invitesMissedFor(profile);
  if (!myInvites.length && !missed.length) {
    inviteList.innerHTML = '<p style="color:var(--ink-light);font-size:0.95rem">No invites right now. Tap one of your own activities above to invite your sister.</p>';
    return;
  }
  myInvites.forEach(inv=>{
    const f = inviteFacts(inv);
    const el = document.createElement('div');
    el.className = 'invite-item';
    const what = inv.watch
      ? `👀 come and watch <b>${escapeHtml(f.subject)}</b>`
      : `<b>${escapeHtml(f.subject)}</b>`;
    el.innerHTML = `
      <div>💌 <b>${escapeHtml(f.from)}</b> invited you to<br>
      ${what} on ${escapeHtml(f.day)} at ${escapeHtml(f.time)}</div>
      <div class="invite-actions">
        <button class="pill-btn" onclick="acceptInvite('${escapeJsAttr(inv.id)}')">✅ Accept</button>
        <button class="pill-btn" onclick="declineInvite('${escapeJsAttr(inv.id)}')">❌ Decline</button>
      </div>
    `;
    inviteList.appendChild(el);
  });
  /* MISSED: its day has gone, so there is no Accept. She may have gone anyway —
     📌 puts it on that day through the same writer, unticked — or Decline
     clears it. */
  if (!missed.length) return;
  const head = document.createElement('p');
  head.style.cssText = 'color:var(--ink-light);font-size:0.95rem;margin:0.7rem 0 0.3rem';
  head.textContent = 'Missed';
  inviteList.appendChild(head);
  missed.forEach(inv => {
    const f = inviteFacts(inv);
    const el = document.createElement('div');
    el.className = 'invite-item';
    const what = inv.watch ? `👀 watch <b>${escapeHtml(f.subject)}</b>` : `<b>${escapeHtml(f.subject)}</b>`;
    el.innerHTML = `
      <div>💌 <b>${escapeHtml(f.from)}</b> invited you to ${what} · ${escapeHtml(f.day)} — that day has passed</div>
      <div class="invite-actions">
        <button class="pill-btn" onclick="addInviteAnyway('${escapeJsAttr(inv.id)}')">📌 Add it to my ${escapeHtml(f.day)} anyway</button>
        <button class="pill-btn" onclick="declineInvite('${escapeJsAttr(inv.id)}')">❌ Decline</button>
      </div>
    `;
    inviteList.appendChild(el);
  });
}

function openNewChallenge() {
  const actSel = document.getElementById('chActivity');
  actSel.innerHTML = '';
  getAllActivities().forEach(a=>{
    if (a._locked) return;
    const opt = document.createElement('option');
    opt.value = a.id; opt.textContent = `${a.icon} ${a.name}`;
    actSel.appendChild(opt);
  });
  openSheet('newChallengeOverlay');
}
function confirmNewChallenge() {
  const title = document.getElementById('chTitle').value.trim();
  if (!title) { showToast('Enter a title'); return; }
  const c = {
    id:'ch-'+Date.now().toString(36),
    title,
    activityId: document.getElementById('chActivity').value,
    target: parseInt(document.getElementById('chTarget').value)||1,
    who: document.getElementById('chWho').value,
    createdAt: syncNow(),
    weekStart: dateToLocalKey(getWeekStart(weekOffset)),
  };
  state.shared.challenges = [...(state.shared.challenges||[]), c];
  saveAll();
  closeSheet('newChallengeOverlay');
  renderChallenges();
  document.getElementById('chTitle').value='';
  showToast('Challenge created 🎯');
}
function deleteChallenge(id) {
  state.shared.challenges = (state.shared.challenges||[]).filter(c=>c.id!==id);
  saveAll();
  renderChallenges();
}
function acceptInvite(id) {
  const inv = (state.shared.invites||[]).find(i=>i.id===id);
  /* Only an invite that can be accepted NOW — pending, and its day not gone
     (inviteAcceptable). A double-tap on ✅ Accept used to push a second block
     onto her day, and a late tap put one on a day already past. Anything else
     returns quietly, and the list is redrawn so a stale row goes away. */
  if (!inviteAcceptable(inv)) { refreshInvitesUI(); return; }
  placeInvite(inv, 'Added to your plan! 💕');
}
/* 📌 ADD IT ANYWAY — a missed invite she went to after all. The same writer as
   Accept, onto that past day; the block arrives NOT ticked (whether she did it
   is hers to tick, under the existing XP rules — placing it earns nothing), and
   the invite reads accepted, so the sender's 💌 says it is on her plan. Only a
   pending, missed invite: a second tap finds it accepted and adds nothing. */
function addInviteAnyway(id) {
  const inv = (state.shared.invites||[]).find(i=>i.id===id);
  if (!inv || inv.status !== 'pending' || !inviteIsMissed(inv)) { refreshInvitesUI(); return; }
  placeInvite(inv, 'Added to your plan 📌');
}
/* The shared tail of both: an activity she no longer has declines the invite
   rather than placing a block she cannot open. */
function placeInvite(inv, toast) {
  const receiverAct = findActivity(inv.actId, profile);
  if (!receiverAct) {
    inv.status = 'declined';
    markItemUpdated(inv);
    saveAll();
    refreshInvitesUI();
    showToast('Invite unavailable: activity is not in your tray.');
    return;
  }
  inv.status = 'accepted';
  markItemUpdated(inv);
  inviteToBlock(inv, inv.day);
  refreshInvitesUI();
  showToast(toast);
}
function declineInvite(id) {
  const inv = (state.shared.invites||[]).find(i=>i.id===id);
  // Same guard as acceptInvite: declining an accepted invite changes nothing.
  if (!inv || inv.status !== 'pending') { refreshInvitesUI(); return; }
  inv.status = 'declined';
  markItemUpdated(inv);
  saveAll();
  refreshInvitesUI();
}
// Invites now live in Sister Sync — refresh whichever surface is showing them.
function refreshInvitesUI() {
  const sync = document.getElementById('screen-sync');
  if (sync && sync.classList.contains('active')) renderSync();
  else renderInvites();
}

