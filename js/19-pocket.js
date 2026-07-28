// Weekly-Planner — Pocket Money screen: balance & prices, bank, rules editor.
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   POCKET MONEY SCREEN

   One home for the money system, in three sub-tabs:

     balance — what you have and what every task pays. Kids and parents.
     bank    — savings / GIC / stocks. Kids can LOOK, only parents transact.
     setup   — the rules editor. Parent only; the tab is hidden for kids.

   The prices shown on the balance tab and the prices edited on the setup tab
   are the same data (js/18-rules.js), so the two can never drift.
   ════════════════════════════════════════════════════════════════ */
let pocketTab = 'balance';
let pocketKid = 'jess';

/* Kids look at their own money; a parent looks at whichever kid is selected. */
function pocketViewKid() {
  return isParent() ? (pocketKid === 'jenn' ? 'jenn' : 'jess') : activeProfile();
}

/* The three sub-tabs have all moved:
     balance → 💰 My money      (js/22-money-page1.js)
     setup   → the Money rules tab of the parent portal
     bank    → gone; what she owns is now one record per holding, edited on
               the Money rules tab, with no market simulation behind it.
   This stays as the redirect so older call sites and any saved deep link keep
   landing somewhere sensible instead of a blank screen. */
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

function setPocketTab(tab) {
  if (tab === 'setup' && !isParent()) { showToast('Only parents can change the rules 🔒'); return; }
  pocketTab = tab;
  document.querySelectorAll('#screen-pocket .parent-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.pmtab === tab));
  document.querySelectorAll('#screen-pocket .parent-panel').forEach(p =>
    p.hidden = (p.id !== 'pmtab-' + tab));
  renderPocketScreen();
}

function renderPocketScreen() {
  const kid = pocketViewKid();
  const badge = document.getElementById('pocketProfileBadge');
  if (badge) badge.textContent = `${CT_PROFILE_ICON[kid] || ''} ${kid === 'jenn' ? 'Jenn' : 'Jess'}`;
  // The editor tab simply doesn't exist for a kid.
  const setupTab = document.getElementById('pocketSetupTab');
  if (setupTab) setupTab.hidden = !isParent();

  if (pocketTab === 'bank') { renderMoneyScreen(); return; }
  if (pocketTab === 'setup') { pmRenderSetup(); return; }
  pmRenderBalance(kid);
}

/* ── Sub-tab 1: Balance & Prices ──────────────────────────────────
   The kid-facing answer to "what do I have, and what is each thing worth?"
   Every price is read from the active rule version rather than written here,
   so editing a price on the setup tab changes this card immediately. */
function pmRenderBalance(kid) {
  const wrap = document.getElementById('pmBalanceWrap');
  if (!wrap) return;
  const r = mrRules();
  const wk = ctWeekKey || ctDateToKey(ctMondayOf(new Date()));
  const w = ensureWallet(kid);
  const name = kid === 'jenn' ? 'Jenn' : 'Jess';

  const kidPills = isParent()
    ? `<div style="display:flex;gap:0.5rem;margin-bottom:0.6rem">
         <button class="pill-btn ${kid === 'jenn' ? 'active' : ''}" onclick="pmSetKid('jenn')">🐥 Jenn</button>
         <button class="pill-btn ${kid === 'jess' ? 'active' : ''}" onclick="pmSetKid('jess')">🦊 Jess</button>
       </div>` : '';

  let html = `<div class="chore-grid">${kidPills}`;

  // ── What you have ──
  html += `<div class="money-hero">
      <div>Net worth<br><b>$${netWorth(kid).toFixed(2)}</b></div>
      <div class="money-market">💵 $${w.cash.toFixed(2)} cash</div>
    </div>`;

  html += `<div class="chore-card"><h3>💰 ${name}'s money right now</h3>
    <div class="ct-item"><div class="ct-item-left"><span>💵 Cash</span></div><span class="ct-meta">$${w.cash.toFixed(2)}</span></div>
    <div class="ct-item"><div class="ct-item-left"><span>🏦 Savings</span></div><span class="ct-meta">$${w.savings.toFixed(2)}</span></div>
    <div class="ct-item"><div class="ct-item-left"><span>🔒 GIC</span></div><span class="ct-meta">$${gicTotal(kid).toFixed(2)}</span></div>
    <div class="ct-item"><div class="ct-item-left"><span>📈 Stocks</span></div><span class="ct-meta">$${portfolioValue(kid).toFixed(2)}</span></div>
    <div class="ct-meta" style="margin-top:0.4rem">Earned this week so far: <b>$${ctWeekMoney(wk, kid).toFixed(2)}</b> — confirmed Sunday.</div>
  </div>`;

  // ── The loan ──
  const loan = r.loan || {};
  const principal = loanPrincipal(kid);
  if (principal > 0) {
    const l = loanState(kid);
    const left = loanBalance(kid);
    // Honesty step 3 withdraws the loan-surplus choice for the week.
    const choicesGone = (typeof mrLosesChoices === 'function') && mrLosesChoices(kid);
    const pct = Math.max(0, Math.min(100, (l.paid / principal) * 100));
    const pace = loanPacing(kid);
    const paceLine = pace
      ? (pace.status === 'on-pace'
          ? `<div class="ct-meta">✅ On pace — $${pace.paid.toFixed(2)} paid against $${pace.expected.toFixed(2)} due by now.</div>`
          : `<div class="ct-meta">⚠️ Behind by <b>$${pace.behindBy.toFixed(2)}</b> — $${pace.paid.toFixed(2)} paid against $${pace.expected.toFixed(2)} due by now.</div>`)
      : '';
    const arrearsLine = (l.arrears > 0 || l.arrearsInterest > 0)
      ? `<div class="ct-meta">Overdue: $${money2(l.arrears).toFixed(2)}${l.arrearsInterest > 0 ? ` · interest charged $${money2(l.arrearsInterest).toFixed(2)}` : ''}</div>` : '';
    html += `<div class="chore-card"><h3>🎿 Your sports loan</h3>
      <div class="hm-bar"><div class="hm-bar-fill" style="width:${pct}%"></div></div>
      <div class="ct-meta">Paid $${money2(l.paid).toFixed(2)} of $${principal.toFixed(2)} · <b>$${left.toFixed(2)} to go</b></div>
      ${paceLine}${arrearsLine}
      <div class="ct-item"><div class="ct-item-left"><span>Each month after the deposit</span></div><span class="ct-meta">$${loanMonthly(kid).toFixed(2)} × ${loan.months || 0}</span></div>
      <div class="ct-meta" style="margin-top:0.4rem">On schedule: <b>no interest, ever</b>. Behind: ${loan.arrearsRatePct}% a month${loan.simpleInterest ? ' simple' : ''} on what's overdue.</div>
      <div class="ct-meta">Pay early — any amount — and <b>${loan.earlyPaymentBonusPct}% comes off</b>. Put in $100, clear $${(100 * (1 + (Number(loan.earlyPaymentBonusPct) || 0) / 100)).toFixed(0)}.</div>
      ${left > 0 ? `<div class="money-btn-row" style="margin-top:0.5rem">
        ${choicesGone
          ? `<div class="ct-meta">⚖️ Paying extra is paused this week — that choice comes back next week.</div>`
          : `<button class="pill-btn" onclick="loanPayExtraPrompt('${kid}')">🎿 Pay extra (earns ${loan.earlyPaymentBonusPct}%)</button>`}
        ${isParent() ? `<button class="pill-btn" onclick="pmSundayTransfer('${kid}')">📅 Run the monthly transfer</button>` : ''}
      </div>` : `<div class="ct-meta">🎉 Loan cleared.</div>`}
    </div>`;

    html += pmDownPaymentCard(kid, loan);
  }

  // ── What each task pays ──
  html += pmPriceCards(r);
  html += `</div>`;
  wrap.innerHTML = html;
}

/* ── The down payment ─────────────────────────────────────────────
   The deposit is its own thing, not a line item on the loan card. It is a
   single dated obligation that has to be met before the monthly schedule
   starts, and until it is paid it is the only number that matters — so it
   gets a card that says plainly what is owed, by when, and how far along
   she is. */
function pmDownPaymentCard(kid, loan) {
  const total = loanDownPayment(kid);
  if (!(total > 0)) return '';
  const l = loanState(kid);
  const paid = money2(Math.min(total, l.downPaid));
  const owing = loanDownOutstanding(kid);
  const dueDate = (loan || {}).downPaymentDue || '';
  const today = todayKey();
  const settled = owing <= 0;
  const isDue = !!dueDate && today >= dueDate;
  const pct = Math.max(0, Math.min(100, total ? (paid / total) * 100 : 0));

  let status;
  if (settled) {
    status = `<div class="ct-meta">✅ Paid in full — the monthly payments run from here.</div>`;
  } else if (isDue) {
    const days = Math.max(0, Math.round((formatDayKey(today) - formatDayKey(dueDate)) / 86400000));
    status = `<div class="ct-meta">⚠️ <b>Due now</b> — $${owing.toFixed(2)} still to pay${days > 0 ? `, ${days} day${days === 1 ? '' : 's'} past ${escapeHtml(dueDate)}` : ''}. Until it's paid, the monthly payments haven't started.</div>`;
  } else {
    const days = Math.max(0, Math.round((formatDayKey(dueDate) - formatDayKey(today)) / 86400000));
    const perWeek = days > 0 ? money2(owing / Math.max(1, days / 7)) : owing;
    status = `<div class="ct-meta">📅 Due <b>${escapeHtml(dueDate)}</b> — ${days} day${days === 1 ? '' : 's'} away. That's about <b>$${perWeek.toFixed(2)} a week</b> from now to get there.</div>`;
  }

  const w = ensureWallet(kid);
  return `<div class="chore-card"><h3>🏦 Down payment</h3>
    <div class="hm-bar"><div class="hm-bar-fill" style="width:${pct}%"></div></div>
    <div class="ct-meta">Paid $${paid.toFixed(2)} of $${total.toFixed(2)}${owing > 0 ? ` · <b>$${owing.toFixed(2)} to go</b>` : ''}</div>
    ${status}
    <div class="ct-item"><div class="ct-item-left"><span>You have in cash</span></div><span class="ct-meta">$${w.cash.toFixed(2)}</span></div>
    ${owing > 0 ? `<div class="money-btn-row" style="margin-top:0.5rem">
      <button class="pill-btn" onclick="loanPayDownPaymentPrompt('${kid}')">🏦 Pay the down payment</button>
    </div>
    <div class="ct-meta" style="margin-top:0.4rem">You can pay it in pieces — anything you put in now is that much less to find on ${escapeHtml(dueDate)}.</div>` : ''}
  </div>`;
}

function pmSetKid(kid) { pocketKid = kid; renderPocketScreen(); }

/* The Sunday transfer. When the wallet covers the minimum it just moves; when
   it doesn't, SHE picks which of the three prices to pay. That choice is the
   whole lesson, so it's asked out loud rather than resolved silently. */
async function pmSundayTransfer(kid) {
  if (!isParent()) { showToast('This happens together on Sunday 🔒'); return; }
  const duty = loanDueNow(kid);
  if (duty.reason === 'cleared')     { showToast('🎉 Loan already cleared'); return; }
  if (duty.reason === 'not-started') { showToast(`Nothing due yet — the deposit is due ${loanRules().downPaymentDue}`); return; }
  if (loanState(kid).lastPaymentMonth === loanMonthKey()) {
    showToast('Already paid this month ✅ — the schedule is monthly, not weekly');
    return;
  }
  const due = duty.amount;
  const w = ensureWallet(kid);
  let choice = 'pay_available';
  // Step 3 withdraws the choice: a grown-up decides, and it defaults to
  // paying what's there rather than to the cheapest option.
  const choicesGone = (typeof mrLosesChoices === 'function') && mrLosesChoices(kid);
  if (w.cash < due && choicesGone) {
    showToast('⚖️ Choices are withdrawn this week — paying what she has');
  } else if (w.cash < due) {
    const pick = await showPrompt(
      `${kid === 'jenn' ? 'Jenn' : 'Jess'} owes $${due.toFixed(2)} ` +
      `(${duty.kind === 'down' ? 'down payment' : 'this month'}) and has $${w.cash.toFixed(2)}.\n` +
      `1. Pay what she's got — the rest goes overdue at ${loanRules().arrearsRatePct}%\n` +
      `2. Pay nothing this month — all of it goes overdue, costs more\n` +
      `3. Cover it from savings — no interest, but gives up what that money was earning`,
      { value: '1', type: 'number' });
    if (pick == null) return;
    choice = ['pay_available', 'pay_nothing', 'cover_from_savings'][(parseInt(pick, 10) || 1) - 1] || 'pay_available';
  }
  const res = loanSundayTransfer(kid, choice);
  renderPocketScreen();
  const msg = {
    paid: `📅 Paid $${res.paid.toFixed(2)} — on schedule, no interest`,
    'covered-from-savings': `📅 Paid $${res.paid.toFixed(2)}, $${(res.fromSavings || 0).toFixed(2)} from savings — no interest`,
    partial: `📅 Paid $${res.paid.toFixed(2)} · $${res.shortfall.toFixed(2)} now overdue`,
    deferred: `📅 Deferred — $${res.shortfall.toFixed(2)} now overdue`,
    cleared: '🎉 Loan already cleared',
    'nothing-due': 'Nothing due',
    'not-started': 'Nothing due yet',
    'already-this-month': 'Already paid this month ✅',
  }[res.status] || 'Done';
  showToast(msg);
}

/* The price list, rendered straight from the rules so it is always the truth.
   Shared by the balance tab (read-only) and the setup tab (with edit buttons). */
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

/* ── Sub-tab 3: Rules & Prices (parent only) ──────────────────────
   Every save goes through mrApplyEdits, so it is effective-dated and logged.
   Nothing here writes a rule directly. */
function pmRenderSetup() {
  const wrap = document.getElementById('pmSetupWrap');
  if (!wrap) return;
  if (!isParent()) { wrap.innerHTML = `<div class="chore-card"><div class="ct-meta">Parents only 🔒</div></div>`; return; }
  const r = mrRules();
  const v = mrLatestVersion();

  let html = `<div class="chore-grid">`;
  html += `<div class="chore-card"><h3>⚙️ How editing works</h3>
    <div class="ct-meta">Every change is dated and recorded. Past weeks keep the prices that were live when the work was done — changing a price today never rewrites what they already earned.</div>
    <div class="ct-meta" style="margin-top:0.3rem">In effect since <b>${escapeHtml((v && v.effectiveFrom) || '—')}</b> · reason: ${escapeHtml(mrReasonLabel(v && v.reason))}</div>
  </div>`;

  html += pmPriceCards(r, true);

  // Loan terms
  const loan = r.loan || {};
  html += `<div class="chore-card"><h3>🎿 Loan terms</h3>
    <div class="ct-item"><div class="ct-item-left"><span>Jenn / Jess principal</span></div><span class="ct-meta">$${Number((loan.principal||{}).jenn||0).toFixed(0)} / $${Number((loan.principal||{}).jess||0).toFixed(0)}</span></div>
    <div class="ct-item"><div class="ct-item-left"><span>Down payment — due ${escapeHtml(loan.downPaymentDue || '—')}</span></div><span class="ct-meta">$${Number((loan.downPayment||{}).jenn||0).toFixed(0)} / $${Number((loan.downPayment||{}).jess||0).toFixed(0)}</span></div>
    <div class="ct-item"><div class="ct-item-left"><span>Collected so far</span></div><span class="ct-meta">$${money2(loanState('jenn').downPaid).toFixed(2)} / $${money2(loanState('jess').downPaid).toFixed(2)}</span></div>
    <div class="ct-item"><div class="ct-item-left"><span>Monthly after the deposit</span></div><span class="ct-meta">$${Number((loan.monthly||{}).jenn||0).toFixed(0)} / $${Number((loan.monthly||{}).jess||0).toFixed(0)} × ${loan.months || 0}</span></div>
    <div class="ct-item"><div class="ct-item-left"><span>Interest while on schedule</span></div><span class="ct-meta">${loan.onScheduleRatePct}%</span>
      <button type="button" class="btn-icon" data-pm-action="edit" data-pm-path="loan.onScheduleRatePct" aria-label="Edit on-schedule rate">✏️</button></div>
    <div class="ct-item"><div class="ct-item-left"><span>Overdue rate (per month, simple)</span></div><span class="ct-meta">${loan.arrearsRatePct}%</span>
      <button type="button" class="btn-icon" data-pm-action="edit" data-pm-path="loan.arrearsRatePct" aria-label="Edit arrears rate">✏️</button></div>
    <div class="ct-item"><div class="ct-item-left"><span>Early-payment bonus</span></div><span class="ct-meta">${loan.earlyPaymentBonusPct}%</span>
      <button type="button" class="btn-icon" data-pm-action="edit" data-pm-path="loan.earlyPaymentBonusPct" aria-label="Edit early payment bonus">✏️</button></div>
  </div>`;

  // Audit log
  const entries = mrLogEntries().slice(0, 25);
  html += `<div class="chore-card"><h3>📋 Change history</h3>
    ${entries.length ? entries.map(e => `<div class="ct-item">
        <div class="ct-item-left"><span>${escapeHtml(e.path)}</span></div>
        <span class="ct-meta">${escapeHtml(String(e.from))} → <b>${escapeHtml(String(e.to))}</b> · ${escapeHtml(mrReasonLabel(e.reason))} · ${new Date(e.at).toLocaleDateString()}</span>
      </div>`).join('') : `<div class="ct-meta">No changes yet — the starting template is still in effect.</div>`}
  </div>`;

  html += `</div>`;
  wrap.innerHTML = html;
}

/* Delegated clicks: rule paths are data, never interpolated into an inline
   handler (same reason the chore tab uses data-ct-action). */
function pmHandleWrapClick(e) {
  const btn = e.target.closest('[data-pm-action]');
  if (!btn) return;
  if (btn.dataset.pmAction === 'edit') pmPromptEdit(btn.dataset.pmPath);
}

async function pmPromptEdit(path) {
  if (!isParent()) { showToast('Only parents can change the rules 🔒'); return; }
  if (!path) return;
  const cur = mrGetPath(mrRules(), path);
  if (cur != null && typeof cur === 'object') { showToast('Edit this one on the rulebook for now'); return; }
  const val = await showPrompt(`New value for ${path}:`, { value: String(cur ?? ''), type: 'number' });
  if (val == null || val === '') return;
  const num = Number(val);
  if (!isFinite(num) || num < 0) { showToast('Enter a number like 3'); return; }

  const reasonList = MR_REASONS.map((x, i) => `${i + 1}. ${x.label}`).join('\n');
  const pick = await showPrompt(`Why is this changing?\n${reasonList}`, { value: '1', type: 'number' });
  if (pick == null) return;
  const reason = (MR_REASONS[(parseInt(pick, 10) || 1) - 1] || MR_REASONS[0]).id;

  const version = mrApplyEdits([{ path, value: num }], { reason });
  if (!version) { showToast('No change — that was already the value'); return; }
  renderPocketScreen();
  showToast(`✅ ${path} → ${num} · recorded`);
}
