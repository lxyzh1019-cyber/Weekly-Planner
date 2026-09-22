// Weekly-Planner — the price list, shared by the kid's page and the parent's.
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   WHAT THINGS PAY

   All that survives of the old Pocket Money screen. Its three sub-tabs have
   moved to where each of them belonged:

     balance → 💰 My money             (js/22-money-page1.js)
     setup   → ⚙️ Money rules          (js/24-money-parent.js)
     bank    → gone. What she owns is one record per holding now, edited by a
               parent with no market simulation behind it.

   What is left is the price list itself, which is worth keeping in one place
   because two surfaces render it — 💰 My money and 🎓 Money school — and
   building it twice is how they would start to disagree.
   ════════════════════════════════════════════════════════════════ */
let pocketKid = 'jess';

/* Kids look at their own money; a parent looks at whichever kid is selected. */
function pocketViewKid() {
  return isParent() ? (pocketKid === 'jenn' ? 'jenn' : 'jess') : activeProfile();
}

/* Kept as a redirect so older call sites and any saved deep link land
   somewhere sensible instead of on a screen that no longer exists. */
function openPocketMoney(kid, tab) {
  ctPrepareRead();
  if (isParent() && (kid === 'jenn' || kid === 'jess')) pocketKid = kid;
  if (tab === 'setup' && isParent()) {
    showScreen('parent');
    if (typeof setParentTab === 'function') setParentTab('money');
    return;
  }
  mnyOpenMyMoney(kid || pocketViewKid());
}

/* The price list, rendered straight from the rules so it is always the truth.
   Read-only: the parent edits prices on Money rules (js/24-money-parent.js),
   which has its own steppers. An `editable` mode that drew ✏️ buttons here was
   removed — nothing ever handled their clicks, and its only caller passed
   false. */
function pmPriceCards(r) {
  const row = (label, value) => `<div class="ct-item"><div class="ct-item-left"><span>${label}</span></div>
      <span class="ct-meta">${value}</span></div>`;
  const g = (r.chores && r.chores.grade) || {};
  let html = '';

  html += `<div class="chore-card"><h3>🧹 Household chores</h3>
    <div class="ct-meta">${(r.chores || {}).freeChoresPerWeek} each week are free — every chore after that pays. The free ones are always your <b>lowest-paying</b> chores, so doing your best work first never costs you.</div>
    ${row('On time <b>and</b> to standard', '$' + Number(g[3] || 0).toFixed(2))}
    ${row('To standard, but late', '$' + Number(g[2] || 0).toFixed(2))}
    ${row('Redone, then to standard', '$' + Number(g[1] || 0).toFixed(2))}
    ${row('Not done, or fails the redo', '$0.00')}
    ${row('Most you can earn in a day', '$' + Number((r.chores || {}).dailyCap || 0).toFixed(2))}
    <div class="ct-meta">Past your daily max, extra chores earn <b>XP</b> instead of money.</div>
  </div>`;

  const pool = r.chorePool || [];
  if (pool.length) {
    html += `<div class="chore-card"><h3>⏰ When each chore is due</h3>
      <div class="ct-meta">"On time" is different for every chore — check the chore, not the clock.</div>
      ${pool.map(c => row(escapeHtml(c.label), escapeHtml(c.deadline || '—'))).join('')}
    </div>`;
  }

  const li = (r.learning && r.learning.items) || [];
  html += `<div class="chore-card"><h3>📘 Learning</h3>
    ${li.map(it => row(
        escapeHtml(it.label) + ` <span class="ct-meta">(${it.perUnit} ${escapeHtml(it.unit)})</span>`,
        it.xpOnly ? 'XP only' : '$' + Number(it.amount || 0).toFixed(2))).join('')}
    <div class="ct-meta">It has to be new material. Every Sunday ${(r.learning || {}).sundayCheckCount} get picked at random — can't answer, it's unpaid and you do it again.</div>
  </div>`;

  const tiers = ((r.streak || {}).tiers) || [];
  html += `<div class="chore-card"><h3>🔥 Routine streak</h3>
    ${tiers.map(t => row(t.days + ' days in a row', '+$' + Number(t.bonus || 0).toFixed(2))).join('')}
    <div class="ct-meta">${pmStreakNote(r.streak || {})}</div>
  </div>`;

  const cp = r.competition || {};
  html += `<div class="chore-card"><h3>🏆 Competition days</h3>
    ${row('Swim — per point', '$' + Number((cp.swim || {}).perPoint || 0).toFixed(2))}
    ${row('Qualify for Provincials', '+$' + Number((cp.swim || {}).qualifyBonus || 0).toFixed(2))}
    ${row('Provincials — per point', '$' + Number((cp.swim || {}).provincialPerPoint || 0).toFixed(2))}
    ${row('Skating — per point', '$' + Number((cp.skate || {}).perPoint || 0).toFixed(2))}
    ${row('Skating placement — group / overall (1st)', '$' + Number((((cp.skate||{}).placement||{}).group||{})[1] || 0).toFixed(2) + ' each')}
    ${row('Dance — Silver / Gold per item', '$' + Number((cp.dance || {}).silverPerItem || 0).toFixed(2) + ' / $' + Number((cp.dance || {}).goldPerItem || 0).toFixed(2))}
    ${row('Dance — all Gold', '+$' + Number((cp.dance || {}).allGoldBonus || 0).toFixed(2) + ' (test max $' + Number((cp.dance || {}).testCap || 0).toFixed(0) + ')')}
    <div class="ct-meta">Both skating placements stack. <b>No cap on points.</b> The official results sheet decides — not Mom, not Dad, not you.</div>
  </div>`;

  const fi = (r.fines && r.fines.items) || [];
  html += `<div class="chore-card"><h3>📦 Sunday Box &amp; fines</h3>
    <div class="ct-meta">${pmFinesNote(fi)}</div>
    ${fi.map(f => row(escapeHtml(f.label), '−$' + Number(f.amount || 0).toFixed(2)
      + pmFineWhen(f, fi))).join('')}
    <div class="ct-meta">A day never goes below $0. Fines can take what you earned that day — they can't put you in debt.</div>
  </div>`;

  const xp = (r.xp && r.xp.awards) || [];
  html += `<div class="chore-card"><h3>⭐ XP</h3>
    <div class="ct-meta">XP isn't money — it's the record of everything money doesn't capture. ${(r.xp || {}).perLevel} XP = one level.</div>
    ${xp.map(a => row(escapeHtml(a.label), a.xp + ' XP')).join('')}
  </div>`;

  return html;
}

/* ── What the rules SAY, in words, from the rules ──
   The fines card and the streak card used to be literal prose, so when the
   house rules of 21 Sep gave four fines two free times a week and the streak a
   grace day, the page she reads went on saying the opposite. Both sentences
   are now written from the live values: with none set, each says exactly what
   it always said. */
function pmOrdinal(n) {
  return ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'][n - 1] || (n + 'th');
}
function pmCountWord(n) {
  return ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'][n] || String(n);
}

function pmFinesNote(items) {
  const box = `Leave something out and it's boxed until Sunday — it comes back at the family meeting. <b>Box first, fine on repeat</b> — the second time that week, it's boxed <i>and</i> it costs.`;
  const talk = items.filter(f => Math.round(Number(f.freeRepeats) || 0) > 0);
  if (!talk.length) return box;
  const ns = [...new Set(talk.map(f => Math.round(Number(f.freeRepeats))))];
  const first = ns.length === 1
    ? (ns[0] === 1 ? 'the first time in a week is' : `the first ${pmCountWord(ns[0])} times in a week are`)
    : 'the first few times in a week are';
  const rest = talk.length < items.length ? ' Anything that says <b>every time</b> costs from the first.' : '';
  return `${box} Some of these start as a conversation: <b>${first}</b> a talk, not a fine, and each time after that costs what it says.${rest}`;
}

/* The short "when" beside a fine, so the row and the sentence above it say the
   same thing. Nothing when no fine has free times — then every one costs from
   the first, and the old card said so without a label. */
function pmFineWhen(f, items) {
  if (!items.some(x => Math.round(Number(x.freeRepeats) || 0) > 0)) return '';
  const n = Math.round(Number(f.freeRepeats) || 0);
  return n > 0 ? ` from the ${pmOrdinal(n + 1)} time` : ' every time';
}

function pmStreakNote(streak) {
  const grace = Math.max(0, Math.round(Number(streak.graceDays) || 0));
  if (!grace) {
    return `<b>Highest one only</b> — they don't add up. Miss a day and the run starts over, but <b>your best run of the week</b> is what pays. Resets Sunday.`;
  }
  const days = grace === 1
    ? `One missed day a week won't break your run — it just doesn't count as a day. Miss a second and the run starts over`
    : `Up to ${pmCountWord(grace)} missed days a week won't break your run — they just don't count as days. Miss one more and the run starts over`;
  return `<b>Highest one only</b> — they don't add up. ${days}, and <b>your best run of the week</b> is what pays. Resets Sunday.`;
}
