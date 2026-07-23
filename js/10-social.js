// Weekly-Planner — sister sync, challenges, and invites.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   SISTER SYNC
════════════════════════════════════════════════════════════════ */
function openSisterSync() {
  if (isParent()) { showToast('View each child separately 👀'); return; }
  syncDayIdx = 0;
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
  const acts = getAllActivities();
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
    overlap.innerHTML = windows.length
      ? `🎉 You're both free for about <b>${fmtHrsMin(totalMin)}</b> today — e.g. <b>${windows.slice(0, 3).join(', ')}</b>. Why not hang out?`
      : `🎉 You both have about <b>${fmtHrsMin(totalMin)}</b> of free time overlapping today!`;
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
    const acts = getAllActivities(p);
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
        mini.style.background = b.colour||CAT_HEX[act.cat];
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

async function sendInvite(block, to) {
  const sisterName = to==='jenn'?'Jenn':'Jess';
  const act = getAllActivities(profile).find(a=>a.id===block.actId) || getAllActivities().find(a=>a.id===block.actId);
  const receiverAct = getAllActivities(to).find(a=>a.id===block.actId);
  if (!receiverAct) {
    showToast(`${sisterName} cannot receive this activity yet.`);
    return;
  }
  const activityLabel = act ? `${act.icon} ${act.name}` : 'this activity';
  const day = currentDayKey || getDayKeys(weekOffset)[syncDayIdx];
  const dayDate = formatDayKey(day);
  const dayIdx = (dayDate.getDay()+6)%7;
  const ok = await showConfirm(`Share ${activityLabel} on ${DAY_SHORT[dayIdx]} at ${formatTimeFromMin(block.startMin)} with ${sisterName}?`, { okLabel:'Share' });
  if (!ok) return;
  const inv = {
    id: 'inv-'+Date.now().toString(36),
    from: profile,
    to,
    actId: block.actId,
    day,
    startMin: block.startMin,
    durationMin: block.durationMin,
    status: 'pending',
    createdAt: Date.now(),
    sourceBlockId: block.id,
  };
  state.shared.invites = [...(state.shared.invites||[]), inv];
  // Stamp invitedTo on the source block so the inviter sees the 💌 badge on their own timeline.
  // Find the block in its actual day store (it may not be currentDayKey in sync-screen flow).
  const sourceProfile = profile; // sender
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
// Challenges are now part of Sister Sync — keep this entry point as a redirect
// for any lingering callers/deep links.
function openChallenges() {
  openSisterSync();
}

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
        <div class="challenge-title">${c.title}</div>
        ${teamNote}
        ${rows}
        <div style="display:flex;justify-content:flex-end;margin-top:0.4rem">
          <button class="btn-icon" onclick="deleteChallenge('${c.id}')" style="padding:2px 8px">🗑</button>
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
  const acts = getAllActivities();
  myInvites.forEach(inv=>{
    const act = acts.find(a=>a.id===inv.actId);
    const d = formatDayKey(inv.day);
    const tStr = formatTimeFromMin(inv.startMin);
    const el = document.createElement('div');
    el.className = 'invite-item';
    el.innerHTML = `
      <div>💌 <b>${inv.from==='jenn'?'Jenn':'Jess'}</b> invited you to<br>
      <b>${act?.icon} ${act?.name}</b> on ${DAY_SHORT[(d.getDay()+6)%7]} at ${tStr}</div>
      <div class="invite-actions">
        <button class="pill-btn" onclick="acceptInvite('${inv.id}')">✅ Accept</button>
        <button class="pill-btn" onclick="declineInvite('${inv.id}')">❌ Decline</button>
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
    createdAt: Date.now(),
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
  if (!inv) return;
  const receiverAct = getAllActivities(profile).find(a=>a.id===inv.actId);
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
  blocks.push({
    id: Date.now().toString(36)+Math.random().toString(36).slice(2,5),
    actId: inv.actId, startMin: inv.startMin, durationMin: inv.durationMin,
    colour: CAT_HEX.free, objectives:[], note:`With ${inv.from==='jenn'?'Jenn':'Jess'} 💕`, tag:null,
    checklistState: {}, travelBuffer: false,
  });
  setDayBlocks(inv.day, blocks, profile);
  refreshInvitesUI();
  showToast('Added to your plan! 💕');
}
function declineInvite(id) {
  const inv = (state.shared.invites||[]).find(i=>i.id===id);
  if (!inv) return;
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

