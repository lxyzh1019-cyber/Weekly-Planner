// Weekly-Planner — quest board: gamified daily plan view, XP, stickers, pocket money strip.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   QUEST BOARD — gamified daily plan view
════════════════════════════════════════════════════════════════ */
const QUEST_XP_PER_TASK = 20;
const QUEST_XP_PER_LEVEL = 100;
/* Tiers run to 10. Six topped out at 500 XP, which the chore-overflow and
   personal-best awards clear well inside a single season — a kid who stays at
   the top tier from October onward has nothing left to climb. */
const HERO_TIERS = [
  { lv: 1, name: 'Newbie Hero',   emoji: '🐣' },
  { lv: 2, name: 'Junior Hero',   emoji: '🐤' },
  { lv: 3, name: 'Brave Hero',    emoji: '🦊' },
  { lv: 4, name: 'Mighty Hero',   emoji: '🦁' },
  { lv: 5, name: 'Legendary Hero',emoji: '🦄' },
  { lv: 6, name: '✨ Star Hero ✨', emoji: '🌟' },
  { lv: 7, name: 'Comet Hero',    emoji: '☄️' },
  { lv: 8, name: 'Galaxy Hero',   emoji: '🌌' },
  { lv: 9, name: 'Champion Hero', emoji: '🏅' },
  { lv: 10, name: '👑 Legend 👑',  emoji: '👑' },
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

/* goQuestBoard / renderQuestBoard / goQuestsToday lived here, and with them the
   Quest Board's hero header, its date line and its "open today's quests" card.

   The board was the fourth rendering of one day — Checklist mode, then its own
   quest list, then day-view Quest mode, now this — and CLAUDE.md names that as
   the mistake: a tick that can happen in two places is a tick that can disagree
   with itself. Today is the one list, and it already carried the same hero
   strip (tdQuestHero), so the board's copy was a second Lv/XP readout of the
   same XP.

   Nothing that OWNS anything was removed. completeQuest, blastQuest,
   awardBlockLinks, getQuestXP, heroTierForLevel, showQuestCompletePopup,
   spawnQuestSparkles and the sticker store are all below, unchanged, and Today
   calls every one of them. The board's two unique panels — the sticker
   collection and the note to grown-ups — moved into Today's disclosure and are
   still rendered by the functions right here. */

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

/* showPocketMoney / togglePocketMoney / renderQuestMoneyStrip lived here. They
   rendered into #questMoneyWrap on the Quest Board, which is gone; Today's own
   money card (tdMoneyChart) is the kid-facing summary now, and 💰 My money is
   still the page that owns the detail. buildHowIEarnCard, which this called,
   is untouched — the money pages use it. */

/* The Quest Board keeps a three-line answer to "how am I doing?" and hands the
   rest to 💰 My money (js/22-money-page1.js). This used to be the whole money
   card; a board about today's quests is the wrong place for a wallet, a debt
   and a year's pacing, and duplicating them here meant two screens that could
   disagree about the same dollar. */
function mnyQuestSummary(kid, wk) {
  const b = mrWeekBreakdown(wk, kid);
  const owing = mnyTotalOwing(kid);
  const pct = mnyPaidPct(kid);
  return `<div class="mny-card">
      <div class="mny-row"><span>Earned this week so far</span><b>${mnyMoney(b.net)}</b></div>
      <div class="mny-row"><span>Everything I have</span><b>${mnyMoney(mnyEverything(kid))}</b></div>
      ${owing > 0
        ? `<div class="mny-row"><span>Still to pay off</span><b>${mnyMoney(owing)}</b></div>
           <div class="mny-progress"><div class="mny-progress-fill green" style="width:${pct}%"></div></div>`
        : ''}
      <button type="button" class="mny-btn wide primary" onclick="mnyOpenMyMoney('${escapeJsAttr(kid)}')">💰 Open My money ›</button>
    </div>`;
}

/* 3a — "How I earn": one kid-readable card that gathers every money rule and
   the wallet in one place. Display-only — reads existing chore/money state.

   Weeks under the rulebook model read from the rules, so a price edited on the
   Pocket Money setup tab shows up here immediately and this card can never go
   stale against it. Weeks before the switch keep the legacy card, because
   those weeks really were earned under the $6-cap group model. */
function buildHowIEarnCard(kid, wk) {
  if (typeof mrUsesNewModel === 'function' && mrUsesNewModel(wk)) {
    return mnyQuestSummary(kid, wk);
  }
  return buildHowIEarnCardLegacy(kid, wk);
}

function buildHowIEarnCardLegacy(kid, wk) {
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
  else if (goalPending) {
    const target = ctGoalPoints(goal);
    capNote.push(`goal bonus +$1.00 still open${target != null ? ` (${pts}/${target} pts)` : (goal ? ` (${ctGoalLabel(goal)})` : '')}`);
  }
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
    goalBonusEarned ? '✓ $1.00'
      : (goal ? (ctGoalPoints(goal) != null ? `${pts}/${ctGoalPoints(goal)} pts` : ctGoalLabel(goal)) : 'set a goal'),
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
    // savingsTotal, not w.savings: the legacy field is zeroed once holdings are
    // migrated (mnyEnsureHoldings), so reading it showed $0.00 here while the
    // money page showed the real figure. The other tiles already read through
    // the accessors.
    +   wtile('Savings', savingsTotal(kid), 'earns interest', 'w-savings')
    +   wtile('GIC', gicTotal(kid), 'locked, grows more', 'w-gic')
    +   wtile('Stocks', portfolioValue(kid), 'goes up & down', 'w-stocks')
    + `</div>`;

  // Bank & Invest is a parent surface — kids see their balances here but the
  // bank screen itself only opens from parent mode.
  const bankBtn = isParent()
    ? `<button type="button" class="qmp-open" onclick="mnyOpenMyMoney('${escapeJsAttr(kid)}')">Open My money ›</button>`
    : '';
  return earnCard + `<div class="hm-rules">${rules}</div>` + wallet + bankBtn;
}

/* Week-topbar money button. Both roles land on 💰 My money — a parent looking
   at a kid's money should see exactly what the kid sees, and everything a
   parent can CHANGE lives on the Money rules tab of the portal instead. */
function openWeekMoney() {
  mnyOpenMyMoney(isParent() ? ctParentKid : activeProfile());
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

/* openQuestDetail lived here: it opened the edit sheet when a kid tapped a
   quest card's body on the Quest Board. The board no longer renders that list —
   the day view's Quest mode does, and its cards already route a body tap
   through onTimelineBlockTap, which knows about routines and training blocks
   as well. */

/* Arcade "blast to complete": tapping the 🎯 fires a shot at the quest card,
   which bursts before the quest is marked done — completion feels like a
   shooting game rather than a plain checkbox (item 4). */
function blastQuest(blockId, btn, dayKey) {
  const key = dayKey || todayKey();
  const card = btn && btn.closest ? btn.closest('.quest-card') : null;
  if (!card || card.classList.contains('quest-blasting')) {
    if (card && card.classList.contains('quest-blasting')) return;
    completeQuest(blockId, key); return;
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
    setTimeout(() => completeQuest(blockId, key), 240);
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

/* The one completion path with the arcade blast behind it. `dayKey` defaults
   to today because the Quest Board only ever shows today; the day view passes
   its own day, which is why this can no longer assume one. */
function completeQuest(blockId, dayKey) {
  const key = dayKey || todayKey();
  const blocks = getDayBlocks(key) || [];
  const blk = blocks.find(b => b.id === blockId);
  if (!blk) return;
  if (blk.completed) return;

  blk.completed = true;
  markItemUpdated(blk); // stamp so the completion wins cross-device merges
  const acts = getAllActivities(activeProfile(), { includeArchived: true });
  const act = acts.find(a => a.id === blk.actId) || { name:'Quest', icon:'⭐' };
  // awardBlockLinks is the single source of truth: it awards XP, counts the
  // completion toward sticker milestones, and fires routine/chore links. Do NOT
  // pre-set xpAwarded here — that would skip the sticker counting (bug: quest
  // board taps never advanced the sticker shelf shown right on this screen).
  const result = awardBlockLinks(blk, key);
  setDayBlocks(key, blocks);

  showQuestCompletePopup(act, result);
  spawnQuestSparkles();
  // Redraw whichever screen the tick came from — Today, the day timeline and the
  // board all share this path, so it can't assume any one of them.
  const active = document.querySelector('.screen.active');
  if (active && active.id === 'screen-day') buildTimeline();
  else if (active && active.id === 'screen-today') tdRenderToday();

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
  const act = findActivity(blk.actId);
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
  // A finished chore block has to land in the parent's grading queue. It used
  // to write to ctSetOptional — the retired group store, which no surface reads
  // any more — so a chore ticked in the planner simply never appeared in the
  // portal. Now it asks how it went and files that as a claim, exactly as the
  // chore tab does.
  if (blk.actId === 'chores') claimChoresFromBlock(blk, dayKey, kid);
  return { msg, leveledUp, newLevel };
}

/* Every pool chore this block is tagged with, resolved for a given day.
   Returns [{ choreId, label }] — tags that match no pool row are dropped here
   and surfaced separately by mrUnresolvedTags, which is where a parent can
   actually fix them. */
function blockChoreTargets(blk, dayKey, kid) {
  const wk = ctWeekKeyForDate(dayKey);
  const dayIdx = Math.round((formatDayKey(dayKey) - formatDayKey(wk)) / 864e5);
  if (dayIdx < 0 || dayIdx > 6) return { wk, dayIdx: -1, targets: [] };
  const tags = (Array.isArray(blk.choreTags) && blk.choreTags.length)
    ? blk.choreTags
    : (blk.choreTag ? [blk.choreTag] : []);
  const seen = new Set();
  const targets = [];
  tags.filter(t => t && t !== 'General').forEach(t => {
    const row = mrPoolRowForTag(t, wk);
    if (!row || seen.has(row.id)) return;
    if (!mrLanePays(row.lane)) return;         // 'own'/'helping' are never claimed for money
    if (row.who !== 'both' && row.who !== kid) return;
    seen.add(row.id);
    targets.push({ choreId: row.id, label: row.label });
  });
  return { wk, dayIdx, targets };
}

/* Marking the block done → one claim prompt per tagged chore, in sequence.
   Already-graded chores are skipped: a grade is Mom's answer and the planner
   does not get to overwrite it. */
function claimChoresFromBlock(blk, dayKey, kid) {
  const { wk, dayIdx, targets } = blockChoreTargets(blk, dayKey, kid);
  if (dayIdx < 0 || !targets.length) return;
  const pending = targets.filter(t => !(mrGetChoreGrade(kid, wk, dayIdx, t.choreId) > 0));
  if (!pending.length) return;
  // Sequential rather than all at once — three overlapping dialogs is not a
  // question, it's a pile-up.
  pending.reduce(
    (chain, t) => chain.then(() => openChoreClaimPrompt(kid, wk, dayIdx, t.choreId, t.label)),
    Promise.resolve()
  ).then(() => {
    const active = document.querySelector('.screen.active');
    if (active && active.id === 'screen-chore') renderChoreTab();
  });
}

/* A PARENT confirming a chore block is the grading act, not a claim — she is
   the one who decides. Agrees at what the kid claimed, or "on time" if the kid
   never answered, matching how a tap in the meeting's Step 1 behaves. */
function gradeChoresFromBlock(blk, dayKey, kid) {
  const { wk, dayIdx, targets } = blockChoreTargets(blk, dayKey, kid);
  if (dayIdx < 0) return;
  targets.forEach(t => {
    if (mrGetChoreGrade(kid, wk, dayIdx, t.choreId) > 0) return;
    const claim = mrGetClaim(kid, wk, dayIdx, t.choreId);
    mrSetChoreGrade(kid, wk, dayIdx, t.choreId, claim > 0 ? claim : 3);
  });
}

/* Un-ticking the block takes the claim back — but never an answer Mom has
   already given. */
function unclaimChoresFromBlock(blk, dayKey, kid) {
  const { wk, dayIdx, targets } = blockChoreTargets(blk, dayKey, kid);
  if (dayIdx < 0) return;
  targets.forEach(t => {
    if (mrGetChoreGrade(kid, wk, dayIdx, t.choreId) > 0) return;
    if (mrGetClaim(kid, wk, dayIdx, t.choreId) > 0) mrSetClaim(kid, wk, dayIdx, t.choreId, 0);
  });
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
  else if (blk.actId === 'chores') {
    unclaimChoresFromBlock(blk, dayKey, isParent() ? parentViewing : activeProfile());
  }
  setDayBlocks(dayKey, blocks);
  const active = document.querySelector('.screen.active');
  if (active && active.id === 'screen-week') renderWeek();
  else if (active && active.id === 'screen-day') buildTimeline();
  else if (active && active.id === 'screen-today') tdRenderToday();
  showToast(nowDone ? ('Done! ✓' + extra) : 'Marked not done');
}

function showQuestCompletePopup(act, result) {
  const pop = document.getElementById('questPopup');
  document.getElementById('questPopupIcon').textContent = act.icon || '⭐';
  document.getElementById('questPopupXp').textContent = `+${QUEST_XP_PER_TASK} XP`;
  const sub = document.getElementById('questPopupSub');
  if (result?.leveledUp) {
    const tier = heroTierForLevel(result.newLevel);
    sub.innerHTML = `🎉 LEVEL UP! You are now <strong>Lv ${result.newLevel} ${escapeHtml(tier.name)}</strong> ${tier.emoji}`;
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

/* Defaults to Today now that the Quest Board is gone — it is where a quest gets
   ticked, so it is where the sparkles belong. Callers that name their own host
   (the chore screen does) are unaffected. */
function spawnQuestSparkles(hostId = 'screen-today') {
  const sparkles = ['✨','⭐','💫','🌟'];
  const host = document.getElementById(hostId) || document.getElementById('screen-today');
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
    return `<button type="button" class="profile-switch-opt${on ? ' current' : ''}" onclick="pickProfileFromSwitcher('${escapeJsAttr(p)}')">`
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
  // Today, resolved the one way the rest of the chore tab resolves a day.
  ctDay = ctTodayIndex();
  showScreen('chore');
  renderChoreTab();
}

