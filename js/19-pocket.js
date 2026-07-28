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
   because two surfaces render it: the kid's page reads it and the parent's
   page edits it, and building it twice is how they would start to disagree.
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
   `editable` adds the pencils the parent page uses; the kid's page reads it. */
function pmPriceCards(r, editable) {
  const row = (label, value, path) => {
    const btn = (editable && path)
      ? `<button type="button" class="btn-icon" data-pm-action="edit" data-pm-path="${escapeAttr(path)}" aria-label="Edit ${escapeAttr(label)}">✏️</button>`
      : '';
    return `<div class="ct-item"><div class="ct-item-left"><span>${label}</span></div>
      <span class="ct-meta">${value}</span>${btn}</div>`;
  };
  const g = (r.chores && r.chores.grade) || {};
  let html = '';

  html += `<div class="chore-card"><h3>🧹 Household chores</h3>
    <div class="ct-meta">${(r.chores || {}).freeChoresPerWeek} each week are free — every chore after that pays. The free ones are always your <b>lowest-paying</b> chores, so doing your best work first never costs you.</div>
    ${row('On time <b>and</b> to standard', '$' + Number(g[3] || 0).toFixed(2), 'chores.grade.3')}
    ${row('To standard, but late', '$' + Number(g[2] || 0).toFixed(2), 'chores.grade.2')}
    ${row('Redone, then to standard', '$' + Number(g[1] || 0).toFixed(2), 'chores.grade.1')}
    ${row('Not done, or fails the redo', '$0.00', null)}
    ${row('Most you can earn in a day', '$' + Number((r.chores || {}).dailyCap || 0).toFixed(2), 'chores.dailyCap')}
    <div class="ct-meta">Past your daily max, extra chores earn <b>XP</b> instead of money.</div>
  </div>`;

  const pool = r.chorePool || [];
  if (pool.length) {
    html += `<div class="chore-card"><h3>⏰ When each chore is due</h3>
      <div class="ct-meta">"On time" is different for every chore — check the chore, not the clock.</div>
      ${pool.map(c => row(escapeHtml(c.label), escapeHtml(c.deadline || '—'), null)).join('')}
    </div>`;
  }

  const li = (r.learning && r.learning.items) || [];
  html += `<div class="chore-card"><h3>📘 Learning</h3>
    ${li.map(it => row(
        escapeHtml(it.label) + ` <span class="ct-meta">(${it.perUnit} ${escapeHtml(it.unit)})</span>`,
        it.xpOnly ? 'XP only' : '$' + Number(it.amount || 0).toFixed(2),
        it.xpOnly ? null : 'learning.items')).join('')}
    <div class="ct-meta">It has to be new material. Every Sunday ${(r.learning || {}).sundayCheckCount} get picked at random — can't answer, it's unpaid and you do it again.</div>
  </div>`;

  const tiers = ((r.streak || {}).tiers) || [];
  html += `<div class="chore-card"><h3>🔥 Routine streak</h3>
    ${tiers.map(t => row(t.days + ' days in a row', '+$' + Number(t.bonus || 0).toFixed(2), null)).join('')}
    <div class="ct-meta"><b>Highest one only</b> — they don't add up. Miss a day and the run starts over, but <b>your best run of the week</b> is what pays. Resets Sunday.</div>
  </div>`;

  const cp = r.competition || {};
  html += `<div class="chore-card"><h3>🏆 Competition days</h3>
    ${row('Swim — per point', '$' + Number((cp.swim || {}).perPoint || 0).toFixed(2), 'competition.swim.perPoint')}
    ${row('Qualify for Provincials', '+$' + Number((cp.swim || {}).qualifyBonus || 0).toFixed(2), 'competition.swim.qualifyBonus')}
    ${row('Provincials — per point', '$' + Number((cp.swim || {}).provincialPerPoint || 0).toFixed(2), 'competition.swim.provincialPerPoint')}
    ${row('Skating — per point', '$' + Number((cp.skate || {}).perPoint || 0).toFixed(2), 'competition.skate.perPoint')}
    ${row('Skating placement — group / overall (1st)', '$' + Number((((cp.skate||{}).placement||{}).group||{})[1] || 0).toFixed(2) + ' each', null)}
    ${row('Dance — Silver / Gold per item', '$' + Number((cp.dance || {}).silverPerItem || 0).toFixed(2) + ' / $' + Number((cp.dance || {}).goldPerItem || 0).toFixed(2), null)}
    ${row('Dance — all Gold', '+$' + Number((cp.dance || {}).allGoldBonus || 0).toFixed(2) + ' (test max $' + Number((cp.dance || {}).testCap || 0).toFixed(0) + ')', 'competition.dance.testCap')}
    <div class="ct-meta">Both skating placements stack. <b>No cap on points.</b> The official results sheet decides — not Mom, not Dad, not you.</div>
  </div>`;

  const fi = (r.fines && r.fines.items) || [];
  html += `<div class="chore-card"><h3>📦 Sunday Box &amp; fines</h3>
    <div class="ct-meta">Leave something out and it's boxed until Sunday — it comes back at the family meeting. <b>Box first, fine on repeat</b> — the second time that week, it's boxed <i>and</i> it costs.</div>
    ${fi.map(f => row(escapeHtml(f.label), '−$' + Number(f.amount || 0).toFixed(2), null)).join('')}
    <div class="ct-meta">A day never goes below $0. Fines can take what you earned that day — they can't put you in debt.</div>
  </div>`;

  const xp = (r.xp && r.xp.awards) || [];
  html += `<div class="chore-card"><h3>⭐ XP</h3>
    <div class="ct-meta">XP isn't money — it's the record of everything money doesn't capture. ${(r.xp || {}).perLevel} XP = one level.</div>
    ${xp.map(a => row(escapeHtml(a.label), a.xp + ' XP', null)).join('')}
  </div>`;

  return html;
}
