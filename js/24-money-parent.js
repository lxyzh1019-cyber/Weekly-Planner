// Weekly-Planner — ⚙️ Money rules: the parent's half of the money system.
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   PAGE 4 · MONEY RULES  (parent portal)

   Everything a grown-up can change lives here, and nowhere else. Before this,
   the rules editor was a sub-tab of a screen you reached from the chore tab —
   which meant the one surface that decides what every dollar is worth was
   three taps down a path nobody would guess.

   This is the one page in the money system written for adults. It may say
   "effective date" and "arrears" and mean them. The other four are for a
   nine-year-old and are held to plain words.

   Two things it must never do:

   1. WRITE A RULE DIRECTLY. Every change goes through mrApplyEdits
      (js/18-rules.js), which clones the live version, stamps a new effective
      date and logs a line per field. Past weeks keep the prices that were live
      when the work was done, so a raise today never rewrites what she earned
      in March.

   2. RESET PROGRESS. Renaming a debt, re-rating it, correcting its principal —
      none of it touches `paid` or `payments`. The record is a record.

   Edits collect in a pending list and save as ONE change with one reason,
   because "we sat down on Sunday and re-tuned five numbers" is one decision,
   and logging it as five makes the history unreadable.
   ════════════════════════════════════════════════════════════════ */

let mnyPending = [];        // [{path, value, label}] — not saved until confirmed
let mnyPendingReason = MR_DEFAULT_REASON;
let mnyPendingFrom = null;  // effective date; defaults to today
/* Where Grown-ups is standing: one of its tabs (GU_TABS, js/46-grownups.js).
   The 📖 More tab and its eight sections are retired (Sunday v15 Stage 4b);
   every route that named a section names the tab its contents moved to. */
let mnyParentSection = 'commit';

function mnyParentKid() { return (parentViewing === 'jenn' || parentViewing === 'jess') ? parentViewing : 'jess'; }

/* 👨‍👩‍👧 Grown-ups (Sunday v15): ✅ Approve · ➕ Commitments · 📦 Fines ·
   🎁 Expected · ⚙️ Rules · 📒 Weeks, drawn by js/46-grownups.js. */
function mnyRenderRulesTab() {
  const wrap = document.getElementById('mnyRulesWrap');
  if (!wrap) return;
  if (!isParent()) { wrap.innerHTML = `<div class="mny-card"><div class="mny-note">Parents only 🔒</div></div>`; return; }
  if (!guIsTab(mnyParentSection)) mnyParentSection = 'commit';
  wrap.innerHTML = `<div class="gu">${guRender(mnyParentSection)}</div>`;
  if (mnyParentSection === 'rules' && guRuleSearch) guApplyRuleSearch(wrap);   // 🔎 kept across a redraw
  if (typeof enhanceNonButtonClickables === 'function') enhanceNonButtonClickables(wrap);
  /* Grown-ups' answer cards and tidy-up runners also sit on Parent › Now
     (Plan v9 §N): every writer that redraws this tab redraws Now too while
     Now is the panel on screen. */
  if (typeof parentTab !== 'undefined' && parentTab === 'now' && typeof pnRenderNow === 'function') pnRenderNow();
}

/* ── The four house rules, when this household's rulebook lacks them ──
   `mrHouseRulesPending` (js/18-rules.js) lists what is still missing, found by
   item id in the rules live today; this card shows every change before one
   tap applies it through `mrApplyEdits`. Parent-only because the whole page
   is, and gone for good once applied — see `mrHouseRulesApplied`. One of
   ⚙️ Rules' one-time cards, at the top while it is pending. */
function mnyHouseRulesCard() {
  if (!isParent() || mrHouseRulesApplied()) return '';
  const pending = mrHouseRulesPending();
  if (!pending.length) return '';
  const from = mrHouseRulesFrom();
  const said = (field, v) => {
    if (field === 'amount') return mnyMoney(Number(v) || 0);
    if (field === 'xpOnly') return v === true ? 'XP only' : 'pays money';
    if (field === 'freeRepeats') return (Number(v) || 0) ? (Number(v) + ' free a week') : 'costs from the first';
    if (field === 'graceDays') return (Number(v) || 0) + ' grace day' + ((Number(v) || 0) === 1 ? '' : 's') + ' a week';
    return v == null ? '—' : String(v);
  };
  const rows = pending.map(p => `<div class="gu-kv"><span>${escapeHtml(p.item)} — ${escapeHtml(MR_HOUSE_RULES_FIELDS[p.field] || p.field)}</span>
      <b>${escapeHtml(said(p.field, p.from))} → ${escapeHtml(said(p.field, p.value))}</b></div>`).join('');
  return `<div class="gu-card gu-plain">
      <div class="gu-cardtitle">🏠 The four house rules are not in this rulebook yet</div>
      <div class="gu-line">On 21 Sep the family agreed four rules: homework earns XP, not dollars; tone,
        taking her sister's things, screens and being asked twice are free the first two times in a week;
        one grace day a week on the routine streak; and the year's pace divides by the weeks that passed.
        The fourth is already how the app counts. The rulebook on this household's devices was written
        before the other three, so they are not in force.</div>
      ${rows}
      ${from ? `<div class="gu-line">Takes effect from Monday ${escapeHtml(mnyShortDate(from))}: this week and every
          week after it price under these, and every week before keeps the prices it was lived under.
          Nothing already earned is re-priced. Only the rows above change — the chore pool, prices, caps and
          targets stay exactly as they are.</div>
        <button type="button" class="gu-save ready" data-mnyp-action="houserules"
          >Put ${pending.length === 1 ? 'this change' : 'these ' + pending.length + ' changes'} into the rulebook</button>
        <div class="gu-line">Recorded in 📝 Rule changes as “${escapeHtml(MR_HOUSE_RULES_NOTE)}”. Once it is
          in, this card does not come back — changing one of these later is your decision, and it stays.</div>`
      : `<div class="gu-line">A rules change is already scheduled for ${escapeHtml(mnyShortDate((mrLatestVersion() || {}).effectiveFrom))}.
          These can go in once it has started, so they are not dated in front of it.</div>`}
    </div>`;
}

/* ── The pending list ──
   Nothing is saved until ⚙️ Rules' save card says so, and everything in it
   saves as one change with one reason. Undo just empties the list — no
   version was ever created, so there is nothing to roll back. */
function mnyQueueEdit(path, value, label) {
  const i = mnyPending.findIndex(p => p.path === path);
  const entry = { path, value, label: label || path };
  if (i >= 0) mnyPending[i] = entry; else mnyPending.push(entry);
  mnyRenderRulesTab();
}
function mnySavePending() {
  if (!mnyPending.length) return;
  /* The gates' order is refused HERE, in the handler, as well as at each
     stepper: a pending list can also be built by a stale tap or a second
     device's rules arriving underneath it. */
  if (mnyPending.some(p => String(p.path).indexOf('school.stagePct.') === 0)) {
    const why = mnyStagePctRefusal();
    if (why) { showToast(why); return; }
  }
  const version = mrApplyEdits(mnyPending.map(p => ({ path: p.path, value: p.value, label: p.label })),
    { reason: mnyPendingReason, effectiveFrom: mnyPendingFrom || todayKey() });
  const n = mnyPending.length;
  mnyPending = []; mnyPendingFrom = null;
  mnyRenderRulesTab();
  showToast(version ? `✅ ${n} change${n > 1 ? 's' : ''} saved as one` : 'Nothing changed');
}

/* One name per home, so the queue row, the card and any sheet say the same
   words about the same pot. */
function mnyHomeLabel(home) {
  return ({ cash: 'Waiting for Sunday', ready: 'Savings', locked: 'Locked away', invest: 'Companies' })[String(home)]
    || String(home);
}

/* ── The gates' order ──
   The gates are rule values (`school.stagePct`, ⚙️ Rules › 🌱 Pots), so a
   change goes through the pending list and `mrApplyEdits` like any price:
   dated, logged, one version. The ORDER is checked in the handler
   (`mnyStagePctRefusal`), not only in the markup — a stepper that could put
   "lock it away" before "keep it ready" would open a pot whose lesson is
   still shut. */
const MNY_TUNABLE_STAGES = ['ready', 'locked', 'stock'];
/* A gate as it will be once the pending list is saved: the queued value if
   there is one, the live rule otherwise. */
function mnyStagePctShown(stageId) {
  const p = mnyPending.find(x => x.path === 'school.stagePct.' + stageId);
  return p ? Number(p.value) : mnyStagePct(stageId);
}
/* Why a set of gates cannot be saved, as a sentence, or null. `values` holds
   ready / locked / stock; anything missing reads as it will be once saved. */
function mnyStagePctRefusal(values) {
  const v = {};
  MNY_TUNABLE_STAGES.forEach(id => {
    v[id] = Number((values && values[id] != null) ? values[id] : mnyStagePctShown(id));
  });
  const name = (id) => (MNY_STAGES.find(s => s.id === id) || {}).title || id;
  for (const id of MNY_TUNABLE_STAGES) {
    if (!isFinite(v[id]) || v[id] < 0 || v[id] > 100) {
      return `${name(id)} has to open somewhere between 0% and 100% paid off.`;
    }
  }
  for (let i = 1; i < MNY_TUNABLE_STAGES.length; i++) {
    const a = MNY_TUNABLE_STAGES[i - 1], b = MNY_TUNABLE_STAGES[i];
    if (v[a] > v[b]) {
      return `${name(a)} (${v[a]}%) cannot open after ${name(b).toLowerCase()} (${v[b]}%) — each stage opens no later than the one after it.`;
    }
  }
  return null;
}

/* ── 👴 The Grandfather rule — the flat amount for a week nobody sat down for ──
   mmUnsettledWeeks looks back eight weeks and stops, so weeks older than that
   are invisible AND unsettleable: the catch-up list cannot show them and there
   is no other door. They sit unsettled forever, and the money for them is
   simply never credited.

   The owner's rule, in their words: "I have 8 weeks review window, any week
   that does not in this 8 weeks review windows and no family meeting record
   get $3 default pocket money." And: "I will input the start week … this does
   not close the door to enter the competition."

   So ONE test, and it is theirs. A week gets the flat amount for a child when
     · it is on or after the start week the family entered,
     · it is OUTSIDE the eight-week review window — no newer than this week
       minus MNY_CATCHUP_REACH + 1, the same reach mmUnsettledWeeks has,
     · it has no family meeting record — neither `meetingsMet` (we sat down)
       nor `meetingsHeld` (the money moved), the two facts mmIsMet and
       mmIsSettled read,
     · and her week is not already credited (`finalizedWeeks[wk][kid]`).
   Chores, fines, gifts and overrides in the week do NOT stop it: a week with
   no meeting never had its chores settled, which is exactly the week this is
   for. A meet already on file is paid ON TOP, because a settled week does not
   close its meets (js/21-money-data.js, `mnyLateCompSync`).

   There used to be two sweeps with two tests — "no meeting held" for the
   hub's default and "no money record at all" between two typed dates for this
   one. That is gone: the hub offers this plan, from the rule saved here. */
const MNY_DEFAULT_WEEK = 3;
const MNY_CATCHUP_REACH = 8;

/* The start week and amount, ENTERED ONCE and kept as a dated rule
   (`grandma.from` / `grandma.amount`, written through `mrApplyEdits`, logged
   in 🕰️ Change history like any price). Read from the NEWEST version rather
   than the one live today: this rule prices no week of its own — it names
   which old weeks the flat amount reaches — so the latest answer a parent gave
   is the answer, even when it was filed into a version scheduled ahead. A
   rulebook without it falls back to the family's first week on file and
   MNY_DEFAULT_WEEK, and says it is not saved: the hub will not offer a credit
   from a start week nobody entered. */
function mnyGrandmaRule() {
  const v = mrLatestVersion();
  const g = ((v && v.rules) || {}).grandma || {};
  const saved = /^\d{4}-\d{2}-\d{2}$/.test(String(g.from || ''));
  const amount = (g.amount != null) ? money2(Math.max(0, Number(g.amount) || 0)) : MNY_DEFAULT_WEEK;
  return { from: saved ? String(g.from) : String(mrStartWeek()), amount, saved };
}

/* Read-only, so the card and the hub can show the total and the weeks BEFORE
   anything moves. Sixteen weeks is a real amount of money and it must never
   arrive as a surprise — the same shape as Copy a plan, which shows its work
   first. Never reaches the current week, a future one, or the eight the
   catch-up list still settles on real numbers: it walks backwards from one
   week beyond that reach, so the $3 is backfill, never a floor. */
function mnyDefaultSweepPlan() {
  ctEnsureShared();
  const c = state.shared.chore;
  const rule = mnyGrandmaRule();
  const amount = rule.amount;
  const out = { weeks: [], total: 0, perKid: { jenn: 0, jess: 0 }, comp: { jenn: 0, jess: 0 },
                skipped: 0, amount, from: null, latest: null, saved: rule.saved };
  const latest = formatDayKey(ctThisWeekKey());
  latest.setDate(latest.getDate() - (MNY_CATCHUP_REACH + 1) * 7);
  out.latest = ctDateToKey(latest);
  const floor = String(ctWeekKeyForDate(rule.from));
  out.from = floor;
  if (!(amount > 0)) return out;
  const mon = new Date(latest);
  for (let i = 0; i < 260; i++) {
    const wk = ctDateToKey(mon);
    if (String(wk) < floor) break;
    if (mnyWeekHadMeeting(wk)) out.skipped++;
    else {
      const kids = ['jenn', 'jess'].filter(k => ((c.finalizedWeeks || {})[wk] || {})[k] == null);
      if (kids.length) {
        const comp = {};
        kids.forEach(k => {
          comp[k] = mrCompetitionWeek(wk, k).paid;
          out.perKid[k] = money2(out.perKid[k] + amount + comp[k]);
          out.comp[k] = money2(out.comp[k] + comp[k]);
        });
        out.weeks.push({ wk, kids, comp, amount: money2(kids.reduce((s, k) => s + amount + comp[k], 0)) });
      }
    }
    mon.setDate(mon.getDate() - 7);
  }
  out.total = money2(out.weeks.reduce((s, w) => s + w.amount, 0));
  return out;
}
/* A family meeting record, of either kind. Read straight off the two maps so
   asking writes nothing (mmIsMet would create `meetingsMet` to answer). */
function mnyWeekHadMeeting(wk) {
  const c = state.shared.chore;
  return !!((c.meetingsMet || {})[wk] || (c.meetingsHeld || {})[wk]);
}

/* The writer. Idempotent through the SAME guard commitKidWeek already uses —
   finalizedWeeks[wk][kid] == null is the has-been-credited test — so this can
   run twice, on two devices, in any merge order, and credit once. The guard
   and the meeting test are read again at write time rather than trusted from
   the plan.

   A defaulted week is LABELLED, not disguised: the ledger row carries
   `defaulted` and `defaultReason: 'grandma'` so the money story says so rather
   than presenting $3 as a week's earnings. Rows an older build wrote with
   `defaultReason: 'default'` still read "nobody met". It also carries
   handEntered, as every row an older build wrote did, but `defaulted` is read
   first: mnyEditLedger and mnyDeleteLedgerWeek refuse a defaulted row, whose
   money is already in her wallet — its meets correct through the meet.

   The meets on file are paid in the same settlement, as their own line — the
   flat amount is `earned`, the meets are `prize` — so the ledger's
   competition figure is what `mnyLateCompSync` later compares against. */
async function mnyRunDefaultSweep() {
  if (!isParent()) { showToast('A grown-up settles the weeks 🔒'); return; }
  const plan = mnyDefaultSweepPlan();
  if (!plan.saved) { showToast('Enter the start week first — Money rules › 👴 Grandfather rule'); return; }
  if (!plan.weeks.length) { showToast('No weeks outside the review window need it — nothing to credit'); return; }
  const span = `${mnyShortDate(plan.weeks[plan.weeks.length - 1].wk)} to ${mnyShortDate(plan.weeks[0].wk)}`;
  const comps = money2(plan.comp.jenn + plan.comp.jess);
  const sk = plan.skipped;
  const ok = await showConfirm(
    `Credit ${mnyMoney(plan.total)} under the Grandfather rule?\n\n`
    + ['jenn', 'jess'].map(k => `${mnyKidName(k)}: ${mnyMoney(plan.perKid[k])}`).join(' · ')
    + `\n\n${mnyMoney(plan.amount)} per child for each week with no family meeting, ${span}`
    + (comps > 0 ? `, and ${mnyMoney(comps)} of competitions already on file in those weeks on top.` : '.')
    + (sk ? `\n\n${sk} week${sk === 1 ? '' : 's'} had a family meeting and ${sk === 1 ? 'is' : 'are'} left alone.` : '')
    + `\n\nThe last ${MNY_CATCHUP_REACH} weeks are left to the catch-up list.`,
    { okLabel: 'Credit it', cancelLabel: 'Not now' });
  if (!ok) return;

  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.moneyLedger) c.moneyLedger = {};
  if (!c.finalizedWeeks) c.finalizedWeeks = {};
  let credited = 0, moved = 0;
  plan.weeks.forEach(w => {
    if (mnyWeekHadMeeting(w.wk)) return;
    if (!c.moneyLedger[w.wk]) c.moneyLedger[w.wk] = {};
    if (!c.finalizedWeeks[w.wk]) c.finalizedWeeks[w.wk] = {};
    w.kids.forEach(kid => {
      // The guard, re-read at write time rather than trusted from the plan.
      if (c.finalizedWeeks[w.wk][kid] != null) return;
      const cw = mrCompetitionWeek(w.wk, kid);
      const comp = cw.paid;
      const pay = money2(plan.amount + comp);
      moneyAddCash(kid, plan.amount, {
        kind: 'settle', from: 'earned', dayKey: w.wk, weekKey: w.wk, ref: w.wk,
        note: 'Week of ' + w.wk + ' — Grandfather rule' });
      if (comp > 0) {
        const names = cw.entries.map(e => e.name || mnySportLabel(e.sport)).join(', ');
        moneyAddCash(kid, comp, {
          kind: 'settle', from: 'prize', dayKey: w.wk, weekKey: w.wk, ref: w.wk,
          note: names + ', week of ' + mnyShortDate(w.wk) + ' — on top of the Grandfather rule' });
      }
      evMirror(kid, { kind: 'settle', amount: 0, dayKey: w.wk, weekKey: w.wk, ref: w.wk,
                      note: 'Week of ' + w.wk + ' — settled under the Grandfather rule' });
      c.finalizedWeeks[w.wk][kid] = pay;
      c.moneyLedger[w.wk][kid] = {
        at: Date.now(), handEntered: true, defaulted: true, defaultReason: 'grandma',
        updatedAt: syncNow(),
        chores: 0, learning: 0, streak: 0, competition: comp, fines: 0, outside: 0,
        ready: 0, gic: 0, stock: 0, debtExtra: 0,
        gross: pay, net: pay,
        xp: 0, boxReleased: 0, loan: null,
      };
      credited = money2(credited + pay);
      moved++;
    });
    if (typeof ctStampWeekState === 'function') ctStampWeekState(w.wk);
  });
  saveAll();
  mnyRenderRulesTab();
  showToast(moved
    ? `Credited ${mnyMoney(credited)} across ${plan.weeks.length} week${plan.weeks.length === 1 ? '' : 's'}`
    : 'Those weeks were already credited');
}

/* ── 👴 The Grandfather rule's section ──
   The start week and the amount are asked once and SAVED as a rule; the
   preview and the credit read the saved rule, never the form. The form is a
   module draft until Save, so typing a date writes nothing. There is no
   to-date: the review window is the upper end, whatever the date. */
let mnyGrandmaDraft = null;   // { from, amount } — the form, until Save
function mnyGrandmaForm() {
  if (!mnyGrandmaDraft) {
    const r = mnyGrandmaRule();
    mnyGrandmaDraft = { from: r.from, amount: r.amount };
  }
  return mnyGrandmaDraft;
}
/* One dated rule version, logged a line per field. Dated today — or joined to
   a version already scheduled ahead, because `mrApplyEdits` clones the NEWEST
   version, and a version dated today built from a scheduled one would drag
   its prices forward. The start week is stored as its Monday, the key every
   week in this app has. */
function mnySaveGrandmaRule() {
  if (!isParent()) { showToast('A grown-up sets this 🔒'); return; }
  const f = mnyGrandmaForm();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(f.from || ''))) { showToast('Pick the start week first'); return; }
  const latest = mrLatestVersion();
  const from = (latest && latest.effectiveFrom > todayKey()) ? latest.effectiveFrom : todayKey();
  const v = mrApplyEdits([
    { path: 'grandma.from', value: String(ctWeekKeyForDate(f.from)), label: '👴 Grandfather rule — starts the week of' },
    { path: 'grandma.amount', value: money2(Math.max(0, Number(f.amount) || 0)), label: '👴 Grandfather rule — each child, each week' },
  ], { reason: MR_DEFAULT_REASON, effectiveFrom: from });
  mnyGrandmaDraft = null;
  mnyRenderRulesTab();
  showToast(v ? '👴 Saved — the Grandfather rule starts the week of ' + mnyShortDate(mnyGrandmaRule().from) : 'Nothing changed');
}
async function mnyRunPayMeets() {
  if (!isParent()) { showToast('A grown-up settles the weeks 🔒'); return; }
  const plans = mnyUnpaidMeetsPlan();
  const total = money2(plans.reduce((n, p) => n + p.total, 0));
  const weeks = plans.reduce((n, p) => n + p.weeks.length, 0);
  if (!weeks) { showToast('Every competition is paid ✅'); return; }
  const lines = plans.filter(p => p.weeks.length).map(p =>
    `${mnyKidName(p.kid)}: ${mnyMoney(p.total)} across ${p.weeks.length} week${p.weeks.length === 1 ? '' : 's'}`);
  const ok = await showConfirm(
    `Pay ${mnyMoney(total)} for competitions ${weeks} settled week${weeks === 1 ? ' never' : 's never'} paid?\n\n` +
    `${lines.join('\n')}\n\nEach week is brought up to what its competitions are worth, and nothing is ever taken back.`,
    { okLabel: 'Pay it', cancelLabel: 'Not now' });
  if (!ok) return;
  const res = mnyPayUnpaidMeets();
  showToast(`✅ ${mnyMoney(res.paid)} across ${res.weeks} week${res.weeks === 1 ? '' : 's'}`);
  mnyRenderRulesTab();
}

async function mnyRunRepair() {
  if (!isParent()) { showToast('A grown-up settles the weeks 🔒'); return; }
  const plans = evRepairPlan();
  const total = money2(plans.reduce((n, p) => n + p.total, 0));
  const weeks = plans.reduce((n, p) => n + p.weeks.length, 0);
  if (!weeks) { showToast('Nothing owed ✅'); return; }
  const lines = plans.filter(p => p.weeks.length).map(p =>
    `${mnyKidName(p.kid)}: ${mnyMoney(p.total)} across ${p.weeks.length} week${p.weeks.length === 1 ? '' : 's'}`);
  const ok = await showConfirm(
    `Pay ${mnyMoney(total)} that ${weeks} settled week${weeks === 1 ? ' was' : 's were'} short?\n\n` +
    `${lines.join('\n')}\n\nEach week is re-priced under its own rules, and nothing is ever taken away.`,
    { okLabel: 'Pay it', cancelLabel: 'Not now' });
  if (!ok) return;
  const res = evRunRepair();
  showToast(`✅ ${mnyMoney(res.credited)} across ${res.weeks} week${res.weeks === 1 ? '' : 's'}`);
  mnyRenderRulesTab();
}

/* ════════════════════════════════════════════════════════════════
   CLICKS — one delegated handler, actions on data attributes
   ════════════════════════════════════════════════════════════════ */
function mnyParentClick(ev) {
  const el = ev.target.closest('[data-mnyp-action]');
  if (!el) return;
  const a = el.getAttribute('data-mnyp-action');

  // Grown-ups' own tabs, cards and fix sheets (js/46-grownups.js).
  if (a.indexOf('gu') === 0) { guAction(a, el); return; }
  // The credit reads the SAVED rule, never the form; Save is what writes it.
  if (a === 'grandma') { mnyRunDefaultSweep(); return; }
  if (a === 'gmsave')  { mnySaveGrandmaRule(); return; }
  if (a === 'gmamt') {
    const f = mnyGrandmaForm();
    f.amount = Math.max(0, money2(f.amount + Number(el.getAttribute('data-mnyp-d'))));
    mnyRenderRulesTab();
    return;
  }
  if (a === 'migrate')      { mnyRunStreamSetup(); return; }
  if (a === 'repair')       { mnyRunRepair(); return; }
  if (a === 'paymeets')     { mnyRunPayMeets(); return; }
  if (a === 'houserules') {
    if (mrApplyHouseRules()) showToast('✅ The four house rules are in the rulebook');
    mnyRenderRulesTab();
    return;
  }
}

/* Writes the stream's opening record, after saying what it will do. Separate
   from `evRunMigration` (js/40-stream.js) for the reason every writer in this
   app is: that one owns the decision and writes nothing a preview did not
   show, this one owns the conversation with the parent. */
async function mnyRunStreamSetup() {
  if (!isParent()) { showToast('A grown-up sets this up 🔒'); return; }
  const plans = evMigrationPlan();
  const rows = plans.reduce((n, p) => n + p.rows.length, 0);
  if (!rows) { showToast('Already set up ✅'); return; }
  const lines = plans.filter(p => !p.alreadyDone).map(p =>
    `${mnyKidName(p.kid)}: ${p.weeks} settled week${p.weeks === 1 ? '' : 's'}, ` +
    `${p.gifts} gift${p.gifts === 1 ? '' : 's'}, opening ${mnyMoney(p.opening.cash)} in hand`);
  const ok = await showConfirm(
    `Record ${rows} movements from what is already on file?\n\n${lines.join('\n')}\n\n` +
    `No money moves — every total stays exactly as it reads today.`,
    { okLabel: 'Set it up', cancelLabel: 'Not now' });
  if (!ok) return;
  const res = evRunMigration();
  const left = ['jenn', 'jess'].reduce((all, k) => all.concat(evShadowDrift(k)), []);
  showToast(left.length
    ? `Recorded ${res.written} — but ${left.length} total${left.length === 1 ? '' : 's'} disagree`
    : `✅ Recorded ${res.written} movements — every total agrees`);
  mnyRenderRulesTab();
}

/* ONE date now. There used to be two — `programStartDate` and
   `moneyModelStartWeek` — gating different things and both self-seeding to the
   current Monday, so a household running for months was told its record began
   this week and its whole backlog fell out of reach. `mrStartWeek`
   (js/18-rules.js) derives it from the earliest week on file when nobody has
   set it; this is how a family says their real beginning was earlier still.

   Stamped, because `deepMergeObj` lets a REMOTE SCALAR WIN: without a stamp a
   device still holding its own older idea of the start date would push it
   straight back over a parent's choice, silently. `mergeSharedChore` arbitrates
   the pair newest-wins. Normalised to the MONDAY of whatever date was typed,
   because every week key in this app is a Monday. */
function mnySetStartWeek(value) {
  if (!isParent()) { showToast('A grown-up sets this 🔒'); return; }
  if (!value) return;
  const d = formatDayKey(value);
  if (!d || isNaN(d)) return;
  const wk = (typeof ctWeekKeyForDate === 'function') ? ctWeekKeyForDate(value) : value;
  ctEnsureShared();
  const c = state.shared.chore;
  c.programStartDate = wk;
  c.programStartDateAt = syncNow();
  /* `moneyModelStartWeek` and `routineRuleStartWeek` are retired but NOT
     deleted. A delete inside state.shared.chore cannot propagate — deepMergeObj
     iterates the keys the remote has, so the next snapshot puts them straight
     back — and tidying them would churn the document on every sync to no
     effect. Nothing reads them any more; a stored copy is left where it lies,
     the same reasoning as the retired `unlockedActs`. */
  saveAll();
  mnyRenderRulesTab();
  showToast('Pocket money starts the week of ' + mnyShortDate(wk));
}

/* Typed fields need input/change rather than click. */
function mnyParentInput(ev) {
  const el = ev.target.closest('[data-mnyp-action]');
  if (!el) return;
  const a = el.getAttribute('data-mnyp-action');
  if (a.indexOf('gu') === 0) { guInput(a, el, ev.type); return; }
  if (a === 'startweek') { mnySetStartWeek(el.value); return; }
  /* The Grandfather rule's start week: kept in the draft on every keystroke,
     drawn again only once the date is committed, so typing a date is never
     interrupted. Nothing is stored until Save. */
  if (a === 'gmfrom') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(el.value)) return;
    mnyGrandmaForm().from = el.value;
    if (ev.type === 'change') mnyRenderRulesTab();
    return;
  }
}

/* ── Weeks that happened before the app did ──
   Typed in one at a time, walking backwards from the earliest week on record,
   and always marked `handEntered` so nobody later mistakes a memory for a
   measurement. */
function mnyAddMissedWeek(kid) {
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.moneyLedger) c.moneyLedger = {};
  const existing = Object.keys(c.moneyLedger).filter(wk => c.moneyLedger[wk] && c.moneyLedger[wk][kid]).sort();
  const anchor = existing.length ? existing[0] : mnyWeekKey();
  const d = formatDayKey(anchor);
  d.setDate(d.getDate() - 7);
  const wk = ctDateToKey(d);
  if (!c.moneyLedger[wk]) c.moneyLedger[wk] = {};
  if (c.moneyLedger[wk][kid]) { showToast('That week is already on record'); return; }
  if (typeof ctStampWeekState === 'function') ctStampWeekState(wk);
  c.moneyLedger[wk][kid] = {
    at: Date.now(), handEntered: true, updatedAt: syncNow(),
    chores: 0, learning: 0, streak: 0, competition: 0, fines: 0, outside: 0,
    ready: 0, gic: 0, stock: 0, debtExtra: 0, gross: 0, net: 0,
    xp: 0, boxReleased: 0, loan: null,
  };
  saveAll();
  showToast('Added the week of ' + mnyShortDate(wk));
}
/* ── A $3 week's record stays true to its money ──
   A `defaulted` row is the record of money the rule already put in her wallet,
   and finalizedWeeks says the same figure. Editing a field or removing the row
   touched the record alone — the wallet kept the money and the week stayed
   settled — and an edit also recomputed gross from the channels, which drops
   the flat amount (it sits in no channel). Two answers to one question, the
   defect this repo keeps recording. So a defaulted row is refused by BOTH
   writers, not only hidden in the editor: its meets correct through the meet
   itself (mnyLateCompSync keeps the row in step), and its flat amount is the
   rule's. Hand-typed rows without `defaulted` keep the editor as they were. */
function mnyDefaultedRowRefusal(row) {
  return `That week was credited by ${row.defaultReason === 'grandma' ? 'the Grandfather rule' : 'the flat default'}, and the money is already in her wallet — it is not edited here. To correct a competition, change the competition itself.`;
}
function mnyEditLedger(kid, wk, field, delta) {
  ctEnsureShared();
  const row = ((state.shared.chore.moneyLedger || {})[wk] || {})[kid];
  if (row && row.defaulted) { showToast(mnyDefaultedRowRefusal(row)); return; }
  // A settled week is frozen. It is a record of what was agreed, and editing it
  // after the fact would make every history in the app un-trustable.
  if (!row || !row.handEntered) { showToast('That week was settled at a meeting — it cannot be edited'); return; }
  row[field] = Math.max(0, money2(money2(row[field]) + delta));
  row.gross = money2(money2(row.chores) + money2(row.learning) + money2(row.streak) + money2(row.competition));
  row.net = money2(Math.max(0, row.gross - money2(row.fines)));
  row.updatedAt = syncNow();
  saveAll();
}
function mnyDeleteLedgerWeek(kid, wk) {
  ctEnsureShared();
  const led = state.shared.chore.moneyLedger || {};
  const row = (led[wk] || {})[kid];
  if (row && row.defaulted) { showToast(mnyDefaultedRowRefusal(row)); return; }
  if (!row || !row.handEntered) { showToast('Only weeks you typed in can be removed'); return; }
  delete led[wk][kid];
  saveAll();
}
