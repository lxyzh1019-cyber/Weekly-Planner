// Weekly-Planner — quest board: gamified daily plan view, XP, stickers, pocket money strip.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   QUEST BOARD — gamified daily plan view
════════════════════════════════════════════════════════════════ */
const QUEST_XP_PER_TASK = 20;
const QUEST_XP_PER_LEVEL = 100;
const HERO_TIERS = [
  { lv: 1, name: 'Newbie Hero',   emoji: '🐣' },
  { lv: 2, name: 'Junior Hero',   emoji: '🐤' },
  { lv: 3, name: 'Brave Hero',    emoji: '🦊' },
  { lv: 4, name: 'Mighty Hero',   emoji: '🦁' },
  { lv: 5, name: 'Legendary Hero',emoji: '🦄' },
  { lv: 6, name: '✨ Star Hero ✨', emoji: '🌟' },
];
function heroTierForLevel(lv) {
  return HERO_TIERS[Math.min(lv-1, HERO_TIERS.length-1)] || HERO_TIERS[0];
}
function getQuestXP(p=activeProfile()) {
  const prog = getProfData(p)?.progress || {};
  return prog.questXP || 0;
}
function addQuestXP(amount, p=activeProfile()) {
  const profd = getProfData(p);
  if (!profd) return { leveledUp:false };
  if (!profd.progress) profd.progress = {};
  const before = profd.progress.questXP || 0;
  const after = before + amount;
  profd.progress.questXP = after;
  const lvBefore = Math.floor(before / QUEST_XP_PER_LEVEL) + 1;
  const lvAfter  = Math.floor(after  / QUEST_XP_PER_LEVEL) + 1;
  saveAll();
  return { leveledUp: lvAfter > lvBefore, newLevel: lvAfter };
}

function goQuestBoard() {
  showScreen('quest');
  renderQuestBoard();
}

function renderQuestBoard() {
  const p = activeProfile();
  if (!p) return;
  const profName = p.charAt(0).toUpperCase() + p.slice(1);

  // Hero header
  const xp = getQuestXP(p);
  const level = Math.floor(xp / QUEST_XP_PER_LEVEL) + 1;
  const tier = heroTierForLevel(level);
  const xpIntoLevel = xp % QUEST_XP_PER_LEVEL;
  const pct = Math.round((xpIntoLevel / QUEST_XP_PER_LEVEL) * 100);
  document.getElementById('questHeroAvatar').textContent = tier.emoji;
  document.getElementById('questHeroTitle').textContent = `Lv ${level} — ${tier.name}`;
  document.getElementById('questHeroName').textContent = profName + "'s adventure";
  document.getElementById('questXpFill').style.width = pct + '%';
  document.getElementById('questXpLabel').textContent = `${xpIntoLevel} / ${QUEST_XP_PER_LEVEL} XP  •  Total ${xp}`;

  // Date
  const today = new Date();
  const dateStr = today.toLocaleDateString(undefined, { weekday:'long', month:'short', day:'numeric' });
  document.getElementById('questBoardDate').textContent = dateStr;

  renderQuestMoneyStrip(p);
  renderStickerCollection(p);
  loadKidWeekFeedback(p);

  // Today's quests = today's blocks
  const key = todayKey();
  const blocks = (getDayBlocks(key) || []).filter(b => b && b.startMin != null);
  blocks.sort((a,b)=> (a.startMin||0) - (b.startMin||0));
  const acts = getAllActivities(p);
  const actById = id => acts.find(a => a.id === id);

  const list = document.getElementById('questList');
  if (!blocks.length) {
    list.innerHTML = `
      <div class="quest-empty">
        <div class="quest-empty-emoji">📜</div>
        <div><strong>No quests for today!</strong></div>
        <div style="margin-top:0.4rem;font-size:0.9rem">Tap <strong>＋ Add a quest</strong> above to start your adventure.</div>
        <div class="quest-empty-cta">
          <button class="quest-back-btn" onclick="goWeek()">📋 Plan the whole week</button>
        </div>
      </div>`;
    return;
  }

  list.innerHTML = blocks.map(b => {
    const act = actById(b.actId) || { name:'Quest', icon:'⭐' };
    const time = formatQuestTime(b.startMin);
    const dur = b.durationMin ? `${b.durationMin} min` : '';
    const done = !!b.completed;
    const right = done
      ? `<div class="quest-done-badge">✓</div>`
      : `<button class="quest-complete-btn" onclick="event.stopPropagation();blastQuest('${b.id}', this)" aria-label="Blast this quest complete" title="Blast it! 🎯">🎯</button>`;
    return `
      <div class="quest-card ${done?'quest-done':''}" onclick="openQuestDetail('${b.id}')">
        <div class="quest-time-col">
          <div class="quest-time">${time}</div>
          ${dur?`<div class="quest-dur">${dur}</div>`:''}
        </div>
        <div class="quest-card-icon">${act.icon || '⭐'}</div>
        <div class="quest-card-body">
          <div class="quest-card-name">${escapeHtml(act.name || 'Quest')}</div>
          <div class="quest-card-meta">
            <span class="quest-xp-tag">+${QUEST_XP_PER_TASK} XP</span>
          </div>
        </div>
        ${right}
      </div>
    `;
  }).join('');
}

// Sticker collection on the Quest Board — earned by real habits (#8).
function renderStickerCollection(kid) {
  const el = document.getElementById('questStickers');
  if (!el) return;
  const pd = getProfData(kid);
  const have = new Set((pd && pd.progress && pd.progress.stickers) || []);
  const earned = STICKER_DEFS.filter(d => have.has(d.id)).length;
  const cells = STICKER_DEFS.map(d => {
    const got = have.has(d.id);
    return `<div class="sticker-cell ${got ? 'got' : 'locked'}" title="${escapeHtml(got ? d.name : d.hint)}">
      <div class="sticker-emoji">${got ? d.emoji : '🔒'}</div>
      <div class="sticker-name">${escapeHtml(got ? d.name : '???')}</div>
    </div>`;
  }).join('');
  el.innerHTML = `<div class="sticker-head">🎖️ Sticker collection <span class="sticker-count">${earned}/${STICKER_DEFS.length}</span></div>
    <div class="sticker-grid">${cells}</div>`;
}

// Pocket money on the Quest Board is private by default — kids tap the toggle
// to reveal the full breakdown (cash / savings / investments / GIC).
let showPocketMoney = false;
function togglePocketMoney() {
  showPocketMoney = !showPocketMoney;
  renderQuestMoneyStrip(activeProfile());
}

function renderQuestMoneyStrip(kid) {
  const wrap = document.getElementById('questMoneyWrap');
  if (!wrap) return;
  if (kid !== 'jenn' && kid !== 'jess') { wrap.hidden = true; return; }
  wrap.hidden = false;

  const toggle = document.getElementById('questMoneyToggle');
  const caret = document.getElementById('qmtCaret');
  const panel = document.getElementById('questMoneyPanel');
  if (toggle) toggle.setAttribute('aria-expanded', showPocketMoney ? 'true' : 'false');
  if (caret) caret.textContent = showPocketMoney ? 'Hide ▾' : 'Show ▸';
  if (!showPocketMoney) { panel.hidden = true; panel.innerHTML = ''; return; }

  ctPrepareRead();
  const wk = ctDateToKey(ctMondayOf(new Date()));   // real current week, independent of chore-tab nav
  const today = formatDayKey(todayKey());
  const dayIdx = Math.max(0, Math.min(6, Math.round((today - formatDayKey(wk)) / (24*60*60*1000))));
  const chips = ctGroupsForKid(kid).map(g => {
    const ids = g.choreIds || [];
    const m = ids.length;
    let n, paid;
    if (g.cadence === 'daily') {
      n = ids.filter(c => ctGetOptional(wk, dayIdx, kid, c)).length;
      paid = ctGroupFiredDaily(wk, g.id, kid, dayIdx);
    } else {
      n = ids.filter(c => [0,1,2,3,4,5,6].some(d => ctGetOptional(wk, d, kid, c))).length;
      paid = ctGroupFiredWeekly(wk, g.id, kid);
    }
    return `<span class="qms-chip ${paid ? 'paid' : ''}">${g.icon || '🧺'} ${paid ? '✓' : `${n}/${m}`}</span>`;
  }).join('');

  panel.hidden = false;
  panel.innerHTML = buildHowIEarnCard(kid, wk);
}

/* 3a — "How I earn": one kid-readable card that gathers every money rule and
   the wallet in one place (was split across the chore tab, money screen and
   meeting sheet). Display-only — reads existing chore/money state. */
function buildHowIEarnCard(kid, wk) {
  const cap = CT_MONEY_CAP;
  const earned = ctGroupEarned(wk, kid);                    // fired chore money (sticky)
  const goalBonusEarned = ctGetGoalBonus(wk, kid) ? 1 : 0;
  const weekMoney = ctWeekMoney(wk, kid);                   // min(cap, earned + bonus)
  const goals = ctGetWeekGoals(wk);
  const goal = goals[kid];                                  // points target or null
  const pts = ctMandatoryPoints(wk, kid) + ctOptionalPoints(wk, kid);
  const goalPending = !!goal && !goalBonusEarned;
  const fillPct = Math.max(0, Math.min(100, weekMoney / cap * 100));
  const tickPct = Math.max(0, Math.min(100, (Math.min(cap, earned + goalBonusEarned + (goalPending ? 1 : 0))) / cap * 100));

  // Top earnings card + progress bar to the weekly cap.
  const capNote = [];
  if (earned > 0) capNote.push(`$${earned.toFixed(2)} chores ✓`);
  if (goalBonusEarned) capNote.push(`+$1.00 goal ✓`);
  else if (goalPending) capNote.push(`goal bonus +$1.00 still open${goal ? ` (${pts}/${goal} pts)` : ''}`);
  const earnCard =
      `<div class="hm-earn">`
    +   `<div class="hm-earn-top"><span class="hm-earn-label">This week so far</span><span class="hm-earn-amt">$${weekMoney.toFixed(2)}</span></div>`
    +   `<div class="hm-bar"><div class="hm-bar-fill" style="width:${fillPct}%"></div><div class="hm-bar-tick" style="left:${tickPct}%"></div></div>`
    +   `<div class="hm-earn-note">of $${cap.toFixed(2)} max${capNote.length ? ' · ' + capNote.join(' · ') : ''}</div>`
    + `</div>`;

  // Rule cards — one per weekly chore group, then goal / sticky / meeting.
  const rule = (icon, name, text, chip, chipCls) =>
      `<div class="hm-rule"><span class="hm-rule-icon">${icon}</span>`
    +   `<span class="hm-rule-text"><b>${escapeHtml(name)}</b> — ${text}</span>`
    +   `<span class="hm-rule-chip ${chipCls||''}">${chip}</span></div>`;

  let rules = '';
  ctGroupsForKid(kid).filter(g => g.cadence !== 'daily').forEach(g => {
    const ids = g.choreIds || [];
    const m = ids.length;
    const n = ids.filter(c => [0,1,2,3,4,5,6].some(d => ctGetOptional(wk, d, kid, c))).length;
    const fired = ctGroupFiredWeekly(wk, g.id, kid);
    const val = (Number(g.valueDollars) || 0).toFixed(2);
    rules += rule(g.icon || '🧹', g.name || 'Chore crew',
      `all ${m} done sometime this week → $${val} <i>all or nothing</i>`,
      fired ? `${m}/${m} ✓ $${val}` : `${n}/${m}`,
      fired ? 'chip-green' : '');
  });
  rules += rule('🎯', 'Week goal',
    `routine + chore points reach your goal → $1.00 bonus`,
    goalBonusEarned ? '✓ $1.00' : (goal ? `${pts}/${goal} pts` : 'set a goal'),
    goalBonusEarned ? 'chip-green' : 'chip-yellow');
  rules += rule('🔒', 'Once earned, yours',
    `unchecking never takes money back`, 'sticky', 'chip-plain');
  rules += rule('🤝', 'Family meeting',
    `confirms the week (max $${cap.toFixed(2)}) & moves the money world one month`, 'Sunday', 'chip-plain');

  // Wallet strip.
  const w = ensureWallet(kid);
  const wtile = (label, val, note, cls) =>
      `<div class="hm-wtile ${cls}"><div class="hm-wtile-label">${label}</div>`
    +   `<div class="hm-wtile-amt">$${money2(val).toFixed(2)}</div>`
    +   `<div class="hm-wtile-note">${note}</div></div>`;
  const wallet =
      `<div class="hm-wallet">`
    +   wtile('Cash', w.cash, 'spend or save', 'w-cash')
    +   wtile('Savings', w.savings, 'earns interest', 'w-savings')
    +   wtile('GIC', gicTotal(kid), 'locked, grows more', 'w-gic')
    +   wtile('Stocks', portfolioValue(kid), 'goes up & down', 'w-stocks')
    + `</div>`;

  // Bank & Invest is a parent surface — kids see their balances here but the
  // bank screen itself only opens from parent mode.
  const bankBtn = isParent()
    ? `<button type="button" class="qmp-open" onclick="openMoneyScreen('${kid}')">Open Bank &amp; Invest ›</button>`
    : '';
  return earnCard + `<div class="hm-rules">${rules}</div>` + wallet + bankBtn;
}

/* Week-topbar money button: parents get the full Bank & Invest screen, kids get
   the "How I earn" card (rules + wallet) in a sheet. */
function openWeekMoney() {
  if (isParent()) openMoneyScreen();
  else openHowIEarn();
}

function openHowIEarn() {
  const kid = activeProfile();
  if (kid !== 'jenn' && kid !== 'jess') return;
  ctPrepareRead();
  const wk = ctDateToKey(ctMondayOf(new Date()));
  document.getElementById('howIEarnBody').innerHTML = buildHowIEarnCard(kid, wk);
  openSheet('howIEarnOverlay');
}

// Kid's free-text weekly note to grown-ups — surfaced in the parent review.
function weekFeedbackKey() { return getDayKeys(weekOffset)[0]; }
function loadKidWeekFeedback(kid) {
  const ta = document.getElementById('kidWeekFeedback');
  if (!ta) return;
  const pd = getProfData(kid);
  ta.value = (pd && pd.weekFeedback && pd.weekFeedback[weekFeedbackKey()]) || '';
}
function saveKidWeekFeedback() {
  const ta = document.getElementById('kidWeekFeedback');
  if (!ta) return;
  const pd = getProfData(activeProfile());
  if (!pd) return;
  if (!pd.weekFeedback) pd.weekFeedback = {};
  pd.weekFeedback[weekFeedbackKey()] = ta.value;
  saveAll();
  showToast('Shared with your grown-ups 💬');
}

function formatQuestTime(min) {
  if (min == null) return '';
  const h = Math.floor(min/60), m = min%60;
  const hh = ((h+11)%12)+1;
  const ap = h<12 ? 'am' : 'pm';
  return `${hh}:${String(m).padStart(2,'0')}${ap}`;
}

// Plan-from-home: jump straight into today's day view, ready to add a
// block, instead of routing through the week grid first.
function goPlanToday() {
  const key = todayKey();
  const d = formatDayKey(key);
  const dayIdx = (d.getDay() + 6) % 7; // Monday = 0, matching the week grid
  openDayFromWeekCard(key, dayIdx);
}

function openQuestDetail(blockId) {
  // Reuse existing edit sheet so kids can see/edit details if they tap the card body
  if (typeof openEditSheet === 'function') openEditSheet(blockId);
}

/* Arcade "blast to complete": tapping the 🎯 fires a shot at the quest card,
   which bursts before the quest is marked done — completion feels like a
   shooting game rather than a plain checkbox (item 4). */
function blastQuest(blockId, btn) {
  const card = btn && btn.closest ? btn.closest('.quest-card') : null;
  if (!card || card.classList.contains('quest-blasting')) {
    if (card && card.classList.contains('quest-blasting')) return;
    completeQuest(blockId); return;
  }
  card.classList.add('quest-blasting');
  const rect = card.getBoundingClientRect();
  const bRect = btn.getBoundingClientRect();

  const proj = document.createElement('div');
  proj.className = 'quest-projectile';
  proj.textContent = '💥';
  proj.style.left = (bRect.left - rect.left + bRect.width / 2 - 10) + 'px';
  proj.style.top  = (bRect.top - rect.top + bRect.height / 2 - 10) + 'px';
  card.appendChild(proj);
  // Fly from the blaster toward the quest icon on the far side of the card.
  requestAnimationFrame(() => {
    proj.style.transform = `translateX(-${Math.max(60, rect.width * 0.66)}px) scale(1.7)`;
    proj.style.opacity = '0.15';
  });

  setTimeout(() => {
    proj.remove();
    card.classList.add('quest-burst');
    spawnQuestBurst(card);
    setTimeout(() => completeQuest(blockId), 240);
  }, 300);
}

// Particle burst radiating from a quest card when it's blasted.
function spawnQuestBurst(card) {
  const bits = ['⭐','✨','💫','🌟','🎉'];
  const rect = card.getBoundingClientRect();
  for (let i = 0; i < 9; i++) {
    const el = document.createElement('div');
    el.className = 'quest-spark';
    el.textContent = bits[i % bits.length];
    el.style.left = '30%';
    el.style.top = '50%';
    const ang = (Math.PI * 2 * i) / 9;
    el.style.setProperty('--dx', Math.cos(ang) * (70 + Math.random() * 50) + 'px');
    el.style.setProperty('--dy', Math.sin(ang) * (55 + Math.random() * 45) + 'px');
    card.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
}

function completeQuest(blockId) {
  const key = todayKey();
  const blocks = getDayBlocks(key) || [];
  const blk = blocks.find(b => b.id === blockId);
  if (!blk) return;
  if (blk.completed) return;

  blk.completed = true;
  markItemUpdated(blk); // stamp so the completion wins cross-device merges
  const acts = getAllActivities();
  const act = acts.find(a => a.id === blk.actId) || { name:'Quest', icon:'⭐' };
  // awardBlockLinks is the single source of truth: it awards XP, counts the
  // completion toward sticker milestones, and fires routine/chore links. Do NOT
  // pre-set xpAwarded here — that would skip the sticker counting (bug: quest
  // board taps never advanced the sticker shelf shown right on this screen).
  const result = awardBlockLinks(blk, key);
  setDayBlocks(key, blocks);

  showQuestCompletePopup(act, result);
  spawnQuestSparkles();
  renderQuestBoard();

  // After the popup: rest day → its own warm celebration (rest is a valid state,
  // not a failed perfect day); full clear → Mission Clear; partial progress → a
  // warm, low-pressure nudge (never nothing, so off days don't feel like failure).
  const restKid = isParent() ? parentViewing : activeProfile();
  setTimeout(()=>{
    const scheduled = (getDayBlocks(key)||[]).filter(b => b && b.startMin!=null);
    const remaining = scheduled.filter(b => !b.completed);
    if (isRestDay(key, restKid)) {
      showMissionClear({ emoji:'😌', title:'REST DAY', sub:'Resting is part of the plan — every bit you did still counts, and your streak stays safe. 💛' });
    } else if (remaining.length === 0) {
      showMissionClear();
    } else {
      const done = scheduled.length - remaining.length;
      showToast(`${done} of ${scheduled.length} done — nice work! 🌟 The rest can wait.`);
    }
  }, 1100);
}

/* Unified completion rewards: award XP once per block (sticky, never removed
   or double-counted) and fire the routine → mandatory and House-Chore → money
   links. Called from every completion path (quick-check, quest board, edit
   sheet) so a tick anywhere counts the same. This is the SINGLE source of truth
   for XP + sticker/task counting — callers must NOT award XP or set xpAwarded
   themselves (doing so silently skips the sticker counting below). Returns
   { msg, leveledUp, newLevel } — msg is a short toast suffix; the level fields
   feed the quest-complete popup. */
function awardBlockLinks(blk, dayKey) {
  let msg = '';
  let leveledUp = false, newLevel = null;
  const kid = isParent() ? parentViewing : activeProfile();
  const act = getAllActivities().find(a => a.id === blk.actId);
  if (!blk.xpAwarded) {
    blk.xpAwarded = true;
    const r = addQuestXP(QUEST_XP_PER_TASK);
    leveledUp = !!(r && r.leveledUp);
    newLevel = r && r.newLevel;
    msg = ` +${QUEST_XP_PER_TASK} XP`;
    if (leveledUp) msg += ' • LEVEL UP! 🎉';
    // Count the completion toward the collectible-sticker milestones (#8).
    const pd = getProfData(kid);
    if (pd && pd.progress) {
      pd.progress.tasksCompleted = (pd.progress.tasksCompleted || 0) + 1;
      if (act) {
        pd.progress.completedByCat = pd.progress.completedByCat || {};
        pd.progress.completedByCat[act.cat] = (pd.progress.completedByCat[act.cat] || 0) + 1;
      }
      const newStickers = checkStickerUnlocks(kid);
      if (newStickers.length) msg += ` • New sticker ${newStickers[0].emoji}!`;
    }
  }
  if (act && act.isRoutine && act.routineId) ctAwardMandatoryFromRoutine(act.routineId, kid, dayKey);
  if (blk.actId === 'chores') ctAutoCheckOptionalFromBlock(blk, dayKey);
  return { msg, leveledUp, newLevel };
}

/* ── #5 Parent "proud of you" stamp: a warm mark a parent drops on a block ── */
const PARENT_STAMPS = ['⭐','🏆','💖','👏','🌟','🔥','💪','🦄'];
function renderParentStampPicker(block) {
  const row = document.getElementById('editParentStampRow');
  const picker = document.getElementById('editParentStampPicker');
  if (!row || !picker) return;
  // Only parents can award a stamp; kids just see it on the block.
  if (!isParent()) { row.style.display = 'none'; return; }
  row.style.display = 'flex';
  const cur = block.parentStamp && block.parentStamp.emoji;
  picker.innerHTML = '';
  PARENT_STAMPS.forEach(em => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'stamp-cell' + (cur === em ? ' selected' : '');
    b.textContent = em;
    b.onclick = () => setParentStamp(block.id, cur === em ? null : em);
    picker.appendChild(b);
  });
}
function setParentStamp(blockId, emoji) {
  const blocks = getDayBlocks(currentDayKey);
  const blk = blocks.find(b => b.id === blockId);
  if (!blk) return;
  if (emoji) blk.parentStamp = { emoji, by: parentViewing || 'parent', at: Date.now() };
  else delete blk.parentStamp;
  setDayBlocks(currentDayKey, blocks);
  renderParentStampPicker(blk);
  buildTimeline();
  showToast(emoji ? `${emoji} Proud stamp added!` : 'Stamp removed');
}

/* ── #8 Collectible stickers: unlocked by real habits, not app-opening ── */
const STICKER_DEFS = [
  { id: 'first',   emoji: '🌱', name: 'First Step',    cond: { type: 'total', n: 1 },   hint: 'Finish your first task' },
  { id: 'ten',     emoji: '⭐', name: 'Rising Star',    cond: { type: 'total', n: 10 },  hint: 'Finish 10 tasks' },
  { id: 'fifty',   emoji: '🏅', name: 'Go-Getter',      cond: { type: 'total', n: 50 },  hint: 'Finish 50 tasks' },
  { id: 'hundred', emoji: '🏆', name: 'Century Club',   cond: { type: 'total', n: 100 }, hint: 'Finish 100 tasks' },
  { id: 'reader',  emoji: '📚', name: 'Bookworm',       cond: { type: 'cat', cat: 'school', n: 15 }, hint: '15 learning tasks' },
  { id: 'athlete', emoji: '🏃', name: 'Athlete',        cond: { type: 'cat', cat: 'active', n: 15 }, hint: '15 active tasks' },
  { id: 'helper',  emoji: '🧹', name: 'Home Helper',    cond: { type: 'cat', cat: 'daily',  n: 15 }, hint: '15 daily/chore tasks' },
  { id: 'zen',     emoji: '🌙', name: 'Wind-Down Pro',  cond: { type: 'cat', cat: 'routine', n: 20 }, hint: '20 routines done' },
];
function stickerEarned(prog, def) {
  if (def.cond.type === 'total') return (prog.tasksCompleted || 0) >= def.cond.n;
  return ((prog.completedByCat || {})[def.cond.cat] || 0) >= def.cond.n;
}
function checkStickerUnlocks(kid = activeProfile()) {
  const pd = getProfData(kid);
  if (!pd || !pd.progress) return [];
  const have = new Set(pd.progress.stickers || []);
  const fresh = [];
  STICKER_DEFS.forEach(def => {
    if (!have.has(def.id) && stickerEarned(pd.progress, def)) {
      pd.progress.stickers.push(def.id);
      fresh.push(def);
    }
  });
  if (fresh.length) saveAll();
  return fresh;
}

/* Quick-complete: flip a block's done state straight from the week/day view
   without opening the detail sheet. Now awards XP + fires routine/chore links
   on completion (unified with the quest board). */
function toggleBlockDone(dayKey, blockId, ev) {
  if (ev) ev.stopPropagation();
  const blocks = getDayBlocks(dayKey) || [];
  const blk = blocks.find(b => b.id === blockId);
  if (!blk) return;
  blk.completed = !blk.completed;
  markItemUpdated(blk); // stamp so the completion wins cross-device merges
  const nowDone = blk.completed;
  let extra = '';
  if (nowDone) extra = awardBlockLinks(blk, dayKey).msg;
  setDayBlocks(dayKey, blocks);
  const active = document.querySelector('.screen.active');
  if (active && active.id === 'screen-week') renderWeek();
  else if (active && active.id === 'screen-day') buildTimeline();
  else if (active && active.id === 'screen-quest') renderQuestBoard();
  showToast(nowDone ? ('Done! ✓' + extra) : 'Marked not done');
}

function showQuestCompletePopup(act, result) {
  const pop = document.getElementById('questPopup');
  document.getElementById('questPopupIcon').textContent = act.icon || '⭐';
  document.getElementById('questPopupXp').textContent = `+${QUEST_XP_PER_TASK} XP`;
  const sub = document.getElementById('questPopupSub');
  if (result?.leveledUp) {
    const tier = heroTierForLevel(result.newLevel);
    sub.innerHTML = `🎉 LEVEL UP! You are now <strong>Lv ${result.newLevel} ${tier.name}</strong> ${tier.emoji}`;
  } else {
    sub.textContent = escapeHtml(act.name || '');
  }
  pop.classList.add('show');
  pop.setAttribute('aria-hidden', 'false');
  clearTimeout(window._questPopupT);
  window._questPopupT = setTimeout(()=>{
    pop.classList.remove('show');
    pop.setAttribute('aria-hidden', 'true');
  }, 1400);
}

function spawnQuestSparkles(hostId = 'screen-quest') {
  const sparkles = ['✨','⭐','💫','🌟'];
  const host = document.getElementById(hostId) || document.getElementById('screen-quest');
  if (!host) return;
  for (let i=0; i<6; i++) {
    const el = document.createElement('div');
    el.className = 'quest-spark';
    el.textContent = sparkles[i % sparkles.length];
    el.style.left = (40 + Math.random()*20) + '%';
    el.style.top  = (25 + Math.random()*20) + '%';
    el.style.setProperty('--dx', (Math.random()*180 - 90) + 'px');
    el.style.setProperty('--dy', (-60 - Math.random()*60) + 'px');
    host.appendChild(el);
    setTimeout(()=>el.remove(), 950);
  }
}

/* opts lets a rest day reuse the same celebration with its own warm copy instead
   of the perfect-day "MISSION CLEAR", so an off day is an explicit, celebrated
   state — not a failed perfect day. No opts = the default all-done celebration. */
function showMissionClear(opts) {
  const o = opts || {};
  const m = document.getElementById('missionClear');
  const emoji = document.getElementById('missionClearEmoji');
  const title = document.getElementById('missionClearTitle');
  const sub   = document.getElementById('missionClearSub');
  if (emoji) emoji.textContent = o.emoji || '🏆';
  if (title) title.textContent = o.title || 'MISSION CLEAR!';
  if (sub)   sub.textContent   = o.sub   || "All today's quests done — go enjoy your day! Off days are OK too — your streak stays safe. 💛";
  m.classList.add('show');
  m.setAttribute('aria-hidden', 'false');
}
function closeMissionClear() {
  const m = document.getElementById('missionClear');
  m.classList.remove('show');
  m.setAttribute('aria-hidden', 'true');
}
function goProfile() {
  // Lock parent mode again when leaving the profile picker
  parentUnlockedThisSession = false;
  profile=null; selectedActivity=null; showScreen('profile');
}

/* Quick profile switcher popup — tapping the profile icon pops up a small
   window to hop between Jenn, Jess and Parent Mode without leaving the current
   view for the full profile screen. */
function openProfileSwitcher() {
  const cur = activeProfile();
  const parentNow = isParent();
  const opt = (p, emoji, name) => {
    const on = !parentNow && cur === p;
    return `<button type="button" class="profile-switch-opt${on ? ' current' : ''}" onclick="pickProfileFromSwitcher('${p}')">`
      + `<span class="ps-emoji">${emoji}</span><span class="ps-name">${name}</span>`
      + `${on ? '<span class="ps-check">✓</span>' : ''}</button>`;
  };
  const body = document.getElementById('profileSwitchBody');
  body.innerHTML =
    opt('jenn', '🐥', 'Jenn') +
    opt('jess', '🦊', 'Jess') +
    `<button type="button" class="profile-switch-opt${parentNow ? ' current' : ''}" onclick="pickProfileFromSwitcher('parent')">`
      + `<span class="ps-emoji">🧑‍🧑‍🧒</span><span class="ps-name">Parent Mode</span>`
      + `${parentNow ? '<span class="ps-check">✓</span>' : ''}</button>` +
    `<button type="button" class="profile-switch-opt ps-more" onclick="closeSheet('profileSwitchOverlay'); goProfile();">`
      + `<span class="ps-emoji">👤</span><span class="ps-name">Full profile screen…</span></button>`;
  openSheet('profileSwitchOverlay');
}
async function pickProfileFromSwitcher(p) {
  closeSheet('profileSwitchOverlay');
  await selectProfile(p);
}
function goWeek()    { selectedActivity=null; showScreen('week'); renderWeek(); }
function openChoreTab() {
  selectedActivity = null;
  ctSetCurrentWeekFromPlanner();  // Sync with current weekOffset
  // Default day to today's day of week (within the current week view)
  const todayDate = formatDayKey(todayKey());
  const monDate = getWeekStart(weekOffset);
  const diff = Math.round((todayDate - monDate) / (24*60*60*1000));
  ctDay = Math.max(0, Math.min(6, diff));
  showScreen('chore');
  renderChoreTab();
}

