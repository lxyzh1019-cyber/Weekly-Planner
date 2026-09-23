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
        mini.onclick = ()=>sendInvite(b, p==='jenn'?'jess':'jenn');
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

/* `opts.watch` turns this into an invitation to COME AND WATCH rather than to
   do the same thing at the same time. Everything else is the existing
   mechanism, untouched: a third argument that defaults to {} keeps both
   two-argument call sites working exactly as they did.

   THE ONE WRITER of an invite. Sister Sync's tap, the edit sheet's 💌 and its
   👀 all come through here, so the duplicate guard below holds for every door. */
async function sendInvite(block, to, opts = {}) {
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
  const day = currentDayKey || getDayKeys(weekOffset)[syncDayIdx];
  const dayDate = formatDayKey(day);
  const dayIdx = (dayDate.getDay()+6)%7;
  /* The MEET, not just the activity. "Share 🏆 Competition" is every meet this
     season, and a child being asked to give up a Saturday deserves to know
     which one. Falls back to whatever the card already calls it. */
  const meetLabel = (block.compName && String(block.compName).trim())
    || (typeof blockDisplayName === 'function' ? blockDisplayName(block, from).name : '')
    || activityLabel;
  const ok = await showConfirm(
    watch
      ? `Invite ${sisterName} to come and watch ${meetLabel} on ${DAY_SHORT[dayIdx]} at ${formatTimeFromMin(block.startMin)}?\n\n`
        + 'It goes on her plan as something she is watching. She earns nothing for it — it is your meet, not hers.'
      : `Share ${activityLabel} on ${DAY_SHORT[dayIdx]} at ${formatTimeFromMin(block.startMin)} with ${sisterName}?`,
    { okLabel: watch ? 'Invite her' : 'Share' });
  if (!ok) return;
  const inv = {
    id: 'inv-'+Date.now().toString(36),
    from,
    to,
    actId: block.actId,
    day,
    startMin: block.startMin,
    durationMin: block.durationMin,
    status: 'pending',
    createdAt: syncNow(),
    sourceBlockId: block.id,
  };
  if (watch) {
    inv.watch = true;
    inv.compName = (block.compName && String(block.compName).trim()) || null;
    inv.tag = block.tag || null;
  }
  state.shared.invites = [...(state.shared.invites||[]), inv];
  // Stamp invitedTo on the source block so the inviter sees the 💌 badge on their own timeline.
  // Find the block in its actual day store (it may not be currentDayKey in sync-screen flow).
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

// Activity-sharing invites — task sharing, so they live under Sister Sync.
function renderInvites() {
  const inviteList = document.getElementById('invitesList');
  if (!inviteList) return;
  inviteList.innerHTML = '';
  const myInvites = (state.shared.invites||[]).filter(i=>i.to===profile && i.status==='pending');
  if (!myInvites.length) {
    inviteList.innerHTML = '<p style="color:var(--ink-light);font-size:0.95rem">No invites right now. Tap one of your own activities above to invite your sister.</p>';
    return;
  }
  const acts = getAllActivities(activeProfile(), { includeArchived: true });
  myInvites.forEach(inv=>{
    const act = acts.find(a=>a.id===inv.actId);
    const d = formatDayKey(inv.day);
    const tStr = formatTimeFromMin(inv.startMin);
    const el = document.createElement('div');
    el.className = 'invite-item';
    /* A watch invite says so, and names the meet. Accepting "Competition" and
       finding out on Saturday that it is somebody else's is not an invitation
       anybody agreed to. */
    const what = inv.watch
      ? `👀 come and watch <b>${escapeHtml((inv.compName || '').trim() || (act?.name || 'her competition'))}</b>`
      : `<b>${act?.icon} ${escapeHtml(act?.name)}</b>`;
    el.innerHTML = `
      <div>💌 <b>${inv.from==='jenn'?'Jenn':'Jess'}</b> invited you to<br>
      ${what} on ${DAY_SHORT[(d.getDay()+6)%7]} at ${tStr}</div>
      <div class="invite-actions">
        <button class="pill-btn" onclick="acceptInvite('${escapeJsAttr(inv.id)}')">✅ Accept</button>
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
  /* Only a PENDING invite can be answered. A double-tap on ✅ Accept used to
     push a second block onto her day. Anything else returns quietly, and the
     list is redrawn so a stale row goes away. */
  if (!inv || inv.status !== 'pending') { refreshInvitesUI(); return; }
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
  // Place a matching block in this profile's schedule
  const blocks = getDayBlocks(inv.day, profile);
  const placed = {
    id: Date.now().toString(36)+Math.random().toString(36).slice(2,5),
    actId: inv.actId, startMin: inv.startMin, durationMin: inv.durationMin,
    colour: CAT_HEX.free, objectives:[], note:`With ${inv.from==='jenn'?'Jenn':'Jess'} 💕`, tag:null,
    checklistState: {}, travelBuffer: false,
  };
  /* A WATCH INVITE IS A DIFFERENT KIND OF BLOCK, and only this branch touches
     it — the plain path above is the one mechanism that already puts an event
     on both calendars and it stays exactly as it was.

     `watching` is what makes blockIsCompetition answer false, which is the
     whole guard: no result is ever asked of her, nothing is adopted as the
     meet's own block, and nothing reaches the money tab. She keeps the meet's
     name and tag so her card can say which meet it is, and she travels there —
     but there is no warm-up, because she is not competing. */
  if (inv.watch) {
    placed.watching = true;
    placed.compName = inv.compName || null;
    placed.tag = inv.tag || null;
    placed.note = `Watching ${inv.from==='jenn'?'Jenn':'Jess'} 👀`;
    placed.travelBuffer = true;
    placed.travelBufMin = DEFAULT_BUFFER_MIN;
    placed.warmupBuffer = false;
  }
  blocks.push(placed);
  setDayBlocks(inv.day, blocks, profile);
  refreshInvitesUI();
  showToast('Added to your plan! 💕');
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

