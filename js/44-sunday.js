// Weekly-Planner — ☀️ Sunday: the family meeting's money step (Sunday v15).
// Classic script, global scope — declarations only (see MODULARIZATION_PLAN.md).
/* ════════════════════════════════════════════════════════════════
   SUNDAY v15 — THE RITUAL (Plan v3 §A, §F js/44; Plan v5 §K, §L S1–S5)

   The money step of `screen-meeting` is the owner's Sunday v15 screen
   (docs/handoff/sunday-v15/Sunday v15 Screen.dc.html), one girl at a time:

     1 · Guess     ⛸️ her club sessions ticked, the income tiles, the guess
                   stairs; on the right ⏳ Dad answers first, 💡 clues and
                   🎯 her earning target. "Show me →" waits for every answer.
     2 · Payday    the money in, grouped as approved (S1): 💪 Money I earned
                   (🏠 Home · ⛸️ Club job · 🏆 Competitions — Plan v17) ·
                   🎁 Money I was given · 🌱 Money my money made · 🏦 From my
                   bank · ➖ Taken off; the coins falling into 💰 My pile with
                   the 📌 must-pay line and last week's line. Dad's ✏️ on a
                   line (with a reason) and −/+ on 📌 Must pay; a tap on a line
                   unfolds its working.
     3 · I choose  the waterfall 🧱 Loan · 👛 Spend · 🌱 Save & grow; a tap
                   picks a box, a tap again is +$1, a 2-second hold is +$5;
                   the starts; I get / I give up / 💡 Tip; on the right what I
                   owe, what I own (its scale fixed on entry) and the goal jar.
                   Hold to sign.
     4 · Signed    ⇅ Money in & out with the two verdicts, say it out loud,
                   ↺ Redo my plan · signature · sticker · Next Sunday →; on the
                   right the timeline and 🔮 If every week is like this.

   IT OWNS NO ARITHMETIC. Every figure is the core's (js/43) over one input
   built here from the app's own readers (`sdBuildInput`) — the same input
   the sign (`mnyDoCommit`, js/23) signs, so the screen and the money cannot
   disagree. It owns no money either: answers go through `mnyAnswerRequest`,
   attendance through `mrSetSessionAttendance`, a line's change through
   `mnySetOverride`, the must-pay through `mnySetPaymentOverride`, the Sunday
   routine through the meeting's own routine tick, results / gifts / fines
   through the Record sheet.

   HER CHOICES ARE A DRAFT, not state: `sdDraft` per girl per week, mirrored
   to localStorage `wp_sunday_<kid>_<wk>` (every access in try/catch), never
   synced — the same reasoning as the looks. Sounds are behind a switch kept
   on this device (`wp_sunday_sound`).
   ════════════════════════════════════════════════════════════════ */

const SD_STEP_LABELS = ['1 · Guess', '2 · Payday', '3 · I choose', '4 · Sign'];
const SD_HOLD_MS = 2000;            // hold a box 2 s = +$5
const SD_SIGN_MS = 1400;            // hold to sign 1.4 s (Plan v17 §3)
const SD_SOUND_LS_KEY = 'wp_sunday_sound';
const SD_DRAFT_LS_PREFIX = 'wp_sunday_';
// The three columns of the waterfall: [id, title, boxes, the idea behind its '?'].
const SD_COLS = [
  ['loan', '🧱 Loan', ['fixed', 'extra'], 'debt'],
  ['spend', '👛 Spend', ['spend'], 'spend'],
  ['grow', '🌱 Save & grow', ['ready', 'goal', 'gic', 'stock'], 'ready'],
];
const SD_SUBS = { fixed: '📌 Must pay', extra: '🧱 Extra', spend: '💵 Cash out', ready: '🏦 Savings',
                  goal: '🎯 Goal', gic: '🔒 Locked', stock: '📈 Companies' };
const SD_COL_OF = { fixed: 'loan', extra: 'loan', spend: 'spend', ready: 'grow', goal: 'grow', gic: 'grow', stock: 'grow' };
const SD_GROW_TABS = ['ready', 'goal', 'gic', 'stock'];
// Which channel(s) of the week a Payday tile stands for — what its ✏️ edits.
const SD_TILE_CHANNELS = { home: ['chores', 'learning', 'streak'], club: ['sessions'], comp: ['comp'], fines: ['fines'] };
const SD_CHANNEL_LABEL = { chores: '🧹 Chores', learning: '📘 Learning', streak: '🔥 Routine streak',
                           sessions: '⛸️ Club sessions', comp: '🏆 Competitions', fines: '📦 Fines' };
// "Dad answers first", grouped by kind as the meeting always was (S3).
const SD_ASK_GROUPS = [
  ['results', '🏆 Results', ['comp', 'meet']], ['gifts', '🎁 Gifts', ['gift', 'deposit']],
  ['moves', '🔀 Moves', ['move']], ['early', '⏪ Early cash', ['adv']], ['fines', '📦 Fines', ['dispute']],
  ['club', '⛸️ Club', ['skip']], ['goals', '🎯 Goals', ['goal']],
];

let sdDrafts = {};          // kid|wk → draft (device-local)
let sdOpened = {};          // kid|wk → Sunday open already ran this session
let sdPress = null;         // { k, start, timer, fired } — a box being held
let sdSelTap = false;       // the pointerdown that only selected a box
let sdSignHold = null;      // { p, timer } — hold to sign
let sdCountTimer = null;    // the coins falling on Payday
let sdNudgeUntil = 0;       // "place $X first" shake
let sdAudio = null;
let sdSheet = null;         // what #sundayOverlay is showing: { kind: 'line', tile, edit } or null

/* ── The draft ── */
function sdDraftKey(kid, wk) { return SD_DRAFT_LS_PREFIX + kid + '_' + wk; }
function sdFreshDraft(kid, wk) {
  return { kid, wk, step: 0, guess: null, cat: {}, shown: 0, alloc: sdZero(),
           pull: { ready: 0, cash: 0 }, advMan: 0, sel: { grow: 'ready' }, last: null, lastAt: 0,
           tried: null, focus: null, presetId: null, tmW: 4, goalId: null, scaleMax: null,
           pick: null, adjust: null, newSeen: [], signed: null };
}
function sdDraftFor(kid, wk) {
  const key = kid + '|' + wk;
  if (sdDrafts[key]) return sdDrafts[key];
  let d = null;
  try { d = JSON.parse(localStorage.getItem(sdDraftKey(kid, wk)) || 'null'); } catch (e) { d = null; }
  d = Object.assign(sdFreshDraft(kid, wk), (d && typeof d === 'object') ? d : {});
  d.alloc = sdAlloc(d.alloc);
  sdDrafts[key] = d;
  return d;
}
function sdSave(d) {
  try { localStorage.setItem(sdDraftKey(d.kid, d.wk), JSON.stringify(d)); } catch (e) { /* the page still works */ }
}
function sdCur() { return sdDraftFor(mnyMeetingKid(), mmWeekKey()); }

/* ── Sound, as drawn, behind a switch on this device ── */
function sdSoundOn() {
  try { return localStorage.getItem(SD_SOUND_LS_KEY) !== '0'; } catch (e) { return true; }
}
function sdToggleSound() {
  try { localStorage.setItem(SD_SOUND_LS_KEY, sdSoundOn() ? '0' : '1'); } catch (e) {}
}
function sdBeep(f) {
  if (!sdSoundOn()) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const C = sdAudio || (sdAudio = new AC());
    const o = C.createOscillator(), g = C.createGain();
    o.type = 'triangle'; o.frequency.value = f || 880;
    g.gain.setValueAtTime(0.06, C.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, C.currentTime + 0.18);
    o.connect(g).connect(C.destination); o.start(); o.stop(C.currentTime + 0.2);
  } catch (e) { /* no sound is fine */ }
}
function sdReducedMotion() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
}
function sdM(v) { return sdMoney(v); }
function sdD(v) { const n = money2(v); return (n < 0 ? '−$' : '$') + (Math.abs(n) % 1 ? Math.abs(n).toFixed(2) : String(Math.abs(n))); }

/* ════════════════════════════════════════════════════════════════
   THE INPUT — one girl's Sunday, read from the app's own owners
   ════════════════════════════════════════════════════════════════ */
function sdLedgerHistory(kid, wk) {
  return mnyLedgerRows(kid).filter(r => String(r.weekKey) < String(wk)).slice(0, 4).reverse()
    .map(r => Object.assign(mnyPassbookRow(r), { comp: money2(r.competition), fines: money2(r.fines), row: r }));
}
function sdBuildInput(kid, wk) {
  const d = sdDraftFor(kid, wk);
  const rules = mrSundayRules(wk);
  const b = mrWeekBreakdown(wk, kid);
  const cash = mnyCash(kid);
  // What is in her wallet, by source (Plan v3 §B, Rev 3): this week's gifts,
  // cash from home, a late meet — and anything else, "already in my wallet".
  const deps = mnyDepositsForWeek(kid, wk).filter(x => x && !x.pendingApproval && !x.rejectedAt && x.appliedAt);
  const isHome = sdIsHomeCash;
  let room = cash;
  const take = v => { const t = money2(Math.max(0, Math.min(room, money2(v)))); room = money2(room - t); return t; };
  const giftsIn = take(deps.filter(x => !isHome(x)).reduce((a, x) => a + money2(x.amount), 0));
  const homeIn = take(deps.filter(isHome).reduce((a, x) => a + money2(x.amount), 0));
  const lateIn = take(mnyLateCompTotal(kid, wk));
  const carry = money2(room);
  const prevSun = sdDayKeyAdd(wk, -1);
  const unlocked = money2(Math.min(carry, evList(kid).filter(e => e && e.from === 'locked' && e.to === 'cash'
    && String(e.dayKey || '') >= prevSun).reduce((a, e) => a + money2(e.amount), 0)));
  // ⏪ every yes not yet taken off a Sunday.
  const advReqs = mnyEnsureRequests(kid).filter(r => r && r.kind === 'adv' && r.status === 'yes' && !r.appliedWeek);
  const advOwed = money2(advReqs.reduce((a, r) => a + money2(money2(r.amount) - money2(r.appliedAmount)), 0));
  // 🧱 the loan, as the loan's owner prices this Sunday.
  const debts = mnyEnsureDebts(kid);
  const due = mnyDueThisWeek(kid, wk);
  const loan = {
    principal: money2(debts.reduce((a, x) => a + money2(x.principal), 0)),
    paid: money2(debts.reduce((a, x) => a + money2(x.paid), 0)),
    interest: money2(debts.reduce((a, x) => a + money2(x.arrearsInterest), 0)),
    arrears: money2(debts.reduce((a, x) => a + money2(x.arrears), 0)),
    weekly: money2(mnyOpenDebtsOldestFirst(kid).reduce((a, x) => a + mnyWeeklyDue(x), 0)),
    mustPay: money2(due.reduce((a, x) => a + money2(x.amount), 0)),
  };
  // 🎯 the jars: the one she picked first, then nearest date first.
  const goals = mnyGoalsNearestFirst(kid);
  const chosen = goals.find(g => g.id === d.goalId) || goals[0] || null;
  const goalOrder = chosen ? [chosen, ...goals.filter(g => g !== chosen)] : [];
  const jarNow = money2(goals.reduce((a, g) => a + mnyGoalJarValue(kid, g), 0));
  const goalRoom = money2(goals.reduce((a, g) => a + Math.max(0, money2(g.target) - mnyGoalJarValue(kid, g)), 0));
  const goal = chosen ? { name: (chosen.icon || '🎯') + ' ' + chosen.name, target: money2(jarNow + goalRoom) } : null;
  const pots = { ready: mnySavedTotal(kid), goal: jarNow, gic: mnyLockedTotal(kid), stock: mnyInvestedTotal(kid) };
  const hist = sdLedgerHistory(kid, wk);
  const coming = mnyComingUp(kid).filter(x => x.kind === 'soon').map(x => [x.name, x.when]);
  const homeCash = money2(Math.max(0, Number((d.pull || {}).cash) || 0));
  const pullReady = money2(Math.max(0, Number((d.pull || {}).ready) || 0));
  const lines = [
    { key: 'jobs', label: '🧹 Chores', amount: b.chorePaid },
    ...(money2(b.learnPaid) > 0 ? [{ key: 'jobs', label: '📘 Learning', amount: b.learnPaid }] : []),
    { key: 'streak', label: '🔥 Routine streak', amount: b.streakBonus },
    { key: 'pa', label: '⛸️ Club job', amount: b.sessionsPaid },
    { key: 'comp', label: '🏆 Competitions', amount: money2(b.compPaid + lateIn) },
    { key: 'gifts', label: '🎁 Gifts', amount: giftsIn },
    { key: 'ret', label: '🌱 My pots earned', amount: 0 },
    // What the fines actually took — the app's own floor (a day never below $0).
    { key: 'fine', label: '📦 Fines', amount: -money2(b.gross - b.net) },
  ];
  const w = {
    weekKey: wk, week: 0, lines, loan, pots, locks: [], matured: 0,
    pull: { ready: pullReady, stock: 0, cash: money2(carry + homeIn + homeCash) },
    adv: { owed: advOwed, manual: money2(d.advMan) }, alloc: sdAlloc(d.alloc), goal,
    guess: d.guess, hist: hist.map(r => r.inAmt), coming, stickers: [],
  };
  const f = {
    b, deps, giftsIn, homeIn, lateIn, compIn: money2(b.compPaid + lateIn), carry, unlocked,
    homeCash, pullReady, advOwed, advManual: money2(d.advMan), advReqs, due, debts, goals,
    goalOrder, chosen, hist, presetId: d.presetId,
    lite: { weekKey: wk, loan, goal, coming, pots },
  };
  return { w, rules, f, d };
}

/* ── Sunday opens: once per girl per week (Plan v3 §B) ──
   An approved goal switches the jar; an approved 🧱 wall move is paid; a
   changed "loan per month" rescales her open rows from the first Sunday it is
   in force (Plan v3 §D, Rev 3) — all through their owners, each idempotent. */
function sdOpenSunday(kid, wk) {
  const key = kid + '|' + wk;
  if (sdOpened[key] || !isParent() || mnyIsCommitted(wk, kid)) return;
  sdOpened[key] = true;
  mnySimCatchUp(kid);
  mnyApplyApprovedGoals(kid, wk);
  mnyApplyApprovedWallMoves(kid, wk);
  sdRescaleLoanRows(kid, wk);
}
/* "Loan per month" changed: her open rows are scaled in proportion so they
   sum to the new figure (owner choice, Plan v3 §D), on the first Sunday she
   opens or signs on or after the change — even when the Sunday it started was
   skipped (Stage 4b). Keyed to the rule version (`mrLoanMonthlyChange`): each
   row it scaled carries `monthlyRescaledFor`, and a key already on ANY of her
   rows means this change was applied, so a later Sunday, a row added later or
   a row paid off since never brings it back. */
function sdRescaleLoanRows(kid, wk) {
  const ch = mrLoanMonthlyChange(kid, wk);
  if (!ch || !(ch.now > 0) || !(ch.was > 0)) return 0;
  if (mnyEnsureDebts(kid).some(x => x && x.monthlyRescaledFor === ch.key)) return 0;
  const open = mnyOpenDebtsOldestFirst(kid);
  const sum = money2(open.reduce((a, x) => a + money2(x.monthly), 0));
  if (!(sum > 0)) return 0;
  const next = sdRescaleMonthly(open.map(x => x.monthly), ch.now);
  open.forEach((x, i) => { x.monthly = next[i]; x.monthlyRescaledFor = ch.key; markItemUpdated(x); });
  saveAll();
  return open.length;
}

/* ════════════════════════════════════════════════════════════════
   WHAT THE STEP IS WAITING FOR
   ════════════════════════════════════════════════════════════════ */
/* Every question, planned meet, club session and new wall row Dad answers
   before payday — what the prototype counts as `unsettled`. */
function sdPendingItems(kid, wk) {
  const items = mnyRequestsFor(kid).filter(q => !q.applied && (q.open || q.status === 'yes'))
    .map(q => ({ id: q.id, kind: q.kind, icon: q.icon, text: q.text, status: q.status, open: q.open, store: q.store, q }));
  /* One competition is one item (owner's review S2-5): a planned meet she has
     already told Dad about is her result, above — not also "no result yet". */
  const asked = items.filter(x => x.kind === 'comp' && x.q && x.q.record).map(x => x.q.record);
  const told = (p) => asked.some(r => (p.blockId && r.blockId === p.blockId)
    || (!r.blockId && String(r.dayKey) === String(p.dayKey) && String(r.name || '').trim().toLowerCase() === String(p.name || '').trim().toLowerCase()));
  mmUnrecordedCompetitions(wk, kid).filter(p => !told(p)).forEach(p => items.push({
    id: 'meet:' + p.dayKey + ':' + (p.name || ''), kind: 'meet', icon: p.icon || '🏆', open: true, meet: p,
    text: (p.name || mnySportLabel(p.sport) || 'Competition') + ' · ' + mnyShortDate(p.dayKey) }));
  return items;
}
function sdNewRows(kid, wk) {
  const last = mnyLedgerRows(kid).find(r => String(r.weekKey) < String(wk));
  const since = last ? Number(last.at) || 0 : 0;
  const d = sdDraftFor(kid, wk);
  return mnyEnsureDebts(kid).filter(x => (Number(x.createdAt) || 0) > since && since > 0
    && (x.icon === '🆕' || x.icon === '🌧️') && (d.newSeen || []).indexOf(x.id) < 0);
}
function sdUnsettled(kid, wk) {
  const items = sdPendingItems(kid, wk).filter(x => x.open);
  const sessions = mrSessionsWeek(wk, kid).sessions.filter(x => x.attended == null).length;
  return { asks: items.length, sessions, rows: sdNewRows(kid, wk).length,
           total: items.length + sessions + sdNewRows(kid, wk).length };
}
/* ════════════════════════════════════════════════════════════════
   RENDER
   ════════════════════════════════════════════════════════════════ */
function sdContext(kid, wk) {
  const inp = sdBuildInput(kid, wk);
  const P = sdPile(inp.w, inp.rules);
  const words = Number(mrRuleOr(inp.rules, 'words.' + kid)) || 1;
  return Object.assign(inp, { kid, wk, P, words, name: mnyKidName(kid) });
}
function sdRenderMoneyStep(wk) {
  const kid = mnyMeetingKid();
  sdOpenSunday(kid, wk);
  const d = sdDraftFor(kid, wk);
  const committed = mnyIsCommitted(wk, kid);
  if (committed && d.step !== 3) { d.step = 3; sdSave(d); }
  if (!committed && d.step === 3) { d.step = 2; d.signed = null; sdSave(d); }
  if (committed && !d.signed) d.signed = sdSignedFromLedger(kid, wk);
  const c = sdContext(kid, wk);
  const main = [sdGuessMain, sdPaydayMain, sdChooseMain, sdSignedMain][d.step](c);
  const side = [sdGuessSide, sdPaydaySide, sdChooseSide, sdSignedSide][d.step](c);
  const newRow = d.step === 0 ? sdNewRowCard(c) : '';
  return `<div class="sd" data-sd-step="${d.step}">
      <div class="sd-grid">
        <div class="sd-card sd-main">${main}</div>
        <div class="sd-side">${side}</div>
      </div>
      ${newRow}
    </div>`;
}
/* ── The family meeting's head on the money step (Plan v17 §0, Stage 6h) ──
   Two rows, drawn by the meeting (`renderMeetingMode`, js/15) around these
   two pieces. Row 1 starts with the girls as round pictures: a tap switches
   whose money is on screen, a signed girl wears a green ✓. Row 2 says whose
   money it is, the four Sunday steps (done mint, current accent), and on the
   right 🔊 Sound and 🗣️ Parent's card. No bottom bar: each step's own
   ◀ / → buttons move between steps. */
function sdMeetingAvatars(wk) {
  const cur = mnyMeetingKid();
  return `<span class="sd-avs" role="group" aria-label="Whose Sunday">${['jenn', 'jess'].map(k => {
    const signed = mnyIsCommitted(wk, k);
    return `<button type="button" class="sd-av${k === cur ? ' on' : ''}" data-mny-action="sd-kid" data-sd-kid="${k}" aria-pressed="${k === cur}" aria-label="${escapeAttr(mnyKidName(k) + (signed ? ' ✓ signed' : ''))}">
        <span class="sd-av-pic" aria-hidden="true">${CT_PROFILE_ICON[k]}</span><span class="sd-av-name ph-word">${escapeHtml(mnyKidName(k))}</span>${signed ? '<span class="sd-av-ok" aria-hidden="true">✓</span>' : ''}</button>`;
  }).join('')}</span>`;
}
function sdMeetingStepRow(wk) {
  const kid = mnyMeetingKid();
  const d = sdDraftFor(kid, wk);
  const step = mnyIsCommitted(wk, kid) ? 3 : d.step;
  // On the phone a step is its number, the words hidden (Plan v18 C).
  const steps = SD_STEP_LABELS.map((l, i) => `<span class="sd-stepchip${i === step ? ' on' : i < step ? ' done' : ''}"${i === step ? ' aria-current="step"' : ''}>${escapeHtml(l.split(' · ')[0])}<span class="ph-word"> · ${escapeHtml(l.split(' · ')[1] || '')}</span></span>`).join('');
  return `<span class="sd-for ph-word">2 · The money for ${escapeHtml(mnyKidName(kid))}:</span>
      <span class="sd-steps" aria-label="Sunday steps">${steps}</span>
      <span class="sd-headbtns">
        <button type="button" class="sd-btn" data-mny-action="sd-sound" aria-pressed="${sdSoundOn()}" aria-label="${sdSoundOn() ? 'Sound on' : 'Sound off'}">${sdSoundOn() ? '🔊' : '🔇'}<span class="ph-word">${sdSoundOn() ? ' Sound on' : ' Sound off'}</span></button>
        <button type="button" class="sd-btn sd-btn--dad" data-mny-action="sd-dad" aria-label="Parent's card">🗣️<span class="ph-word"> Parent's card</span></button>
      </span>`;
}

/* ── Step 1 · Guess ── */
function sdStory(c) {
  const b = c.f.b, days = (b.chores.days || []).filter(x => x.paid > 0).length;
  const ses = (b.sessions || {}).attended || 0;
  const bits = [];
  if (days) bits.push(`did chores ${days} day${days === 1 ? '' : 's'}`);
  if (ses) bits.push(`helped at ${ses} club session${ses === 1 ? '' : 's'}`);
  if (b.streak.days) bits.push(`kept my routine ${b.streak.days} day${b.streak.days === 1 ? '' : 's'}`);
  (b.comp.entries || []).forEach(e => bits.push(`${e.sport === 'swim' ? 'swam' : 'skated'} at ${e.name || mnySportLabel(e.sport)}`));
  const givers = c.f.deps.map(x => x.giver).filter(Boolean);
  if (givers.length) bits.push(`${givers[0]} sent a gift`);
  if (!bits.length) return 'A quiet week. Let’s see what came in.';
  const last = bits.pop();
  return 'I ' + (bits.length ? bits.join(', ') + ', and ' + last : last) + '.';
}
function sdCats(c) {
  const b = c.f.b;
  return [
    ['jobs', '🧹', 'Chores', b.chorePaid + b.learnPaid > 0],
    ['streak', '🔥', 'Routine', b.streakBonus > 0],
    ['comp', '🏆', 'Competitions', c.f.compIn > 0],
    ['gifts', '🎁', 'Gifts', c.f.giftsIn > 0],
  ];
}
function sdSundayRoutine(c) {
  // A Sun–Sat money week (Deviation 34, withdrawn by decision 15 — a stored
  // rule only) ends on Saturday: no Sunday routine to ask about.
  if (mrMoneyWeekIsSunday(c.wk)) return { asked: 0, done: false };
  /* Decision 15 (2026-10-06, replaces owner decision #93): the meeting's own
     Sunday (day 6 of the week being settled) is pre-marked — counted as kept
     without the tick (mrStreakRunPure). She still does it that evening. */
  const asked = routineSessionsForDay(c.kid, c.wk, 6);
  return { asked: asked.length, done: true, premarked: true };
}
function sdGuessMain(c) {
  const d = c.d, s = mrSessionsWeek(c.wk, c.kid);
  const rate = sdRule(c.rules, 'sessions.perSession');
  const open = s.sessions.filter(x => x.attended == null).length;
  const paState = open ? `${open} to tick` : (s.attended ? `✓ ${s.attended} × ${sdD(rate)}` : '$0 · missed');
  const chips = s.sessions.map(x => {
    const v = x.attended;
    return `<button type="button" class="sd-att${v == null ? ' open' : v ? ' yes' : ' no'}" data-mny-action="sd-att" data-sd-block="${escapeAttr(x.blockId)}" data-sd-day="${escapeAttr(x.dayKey)}">${escapeHtml(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][formatDayKey(x.dayKey).getDay()] + ' ' + formatDayKey(x.dayKey).getDate())} ${v == null ? '?' : v ? '✓' : '✗'}</button>`;
  }).join('') || `<span class="sd-note">No club sessions on the planner this week.</span>`;
  const sun = sdSundayRoutine(c);
  const cats = sdCats(c).map(([k, icon, name], i) => {
    const v = d.cat[k];
    const tile = `<button type="button" class="sd-cat${v == null ? '' : v ? ' yes' : ' none'}${v == null ? '' : i % 2 ? ' tilt-r' : ' tilt-l'}" data-mny-action="sd-cat" data-sd-cat="${k}">
        <span class="sd-cat-icon">${icon}</span><span>${escapeHtml(name)}</span>
        <b class="sd-pill">${v == null ? '? tap' : v ? '💰 yes' : '🚫 none'}</b></button>`;
    if (k !== 'streak' || !sun.asked) return tile;
    // Decision 15: the meeting Sunday's routine is pre-marked (counted without the tick).
    return `<div class="sd-catwrap">${tile}<button type="button" class="sd-sunroutine${sun.done ? ' on' : ''}" data-mny-action="sd-sunroutine">${sun.premarked ? '✓ Sunday routine — marked for you' : sun.done ? '✓ Sunday routine done' : '☀️ Sunday routine? tick'}</button></div>`;
  }).join('');
  const u = sdUnsettled(c.kid, c.wk);
  const hist = c.f.hist;
  const lastWeek = hist.length ? Math.round(hist[hist.length - 1].inAmt) : 0;
  const avg = hist.length ? hist.reduce((a, r) => a + r.inAmt, 0) / hist.length : 0;
  const rungs = Array.from({ length: 11 }, (_, i) => 10 + i * 5).map((g, i) => {
    const on = d.guess === g;
    const mark = [hist.length && Math.round(lastWeek / 5) * 5 === g ? 'last week' : '',
                  hist.length && Math.round(avg / 5) * 5 === g ? 'my avg' : ''].filter(Boolean).join(' ');
    return `<button type="button" class="sd-rung${on ? ' on' : ''}" data-mny-action="sd-guess" data-sd-v="${g}" aria-pressed="${on}">
        <span class="sd-rung-mark">${escapeHtml(mark)}</span><span class="sd-rung-pin">${on ? '▼' : ''}</span>
        <span class="sd-rung-bar${i % 2 ? ' alt' : ''}" style="height:${(14 + i * 5.8).toFixed(1)}%"><b>$${g}</b></span></button>`;
  }).join('');
  const hint = u.total
    ? [u.asks ? `parents: ${u.asks} to answer` : '', u.sessions ? `my club sessions: ${u.sessions} to tick` : '', u.rows ? 'a new row on my wall' : ''].filter(Boolean).join(' · ') + ' first →'
    : d.guess ? `My guess: $${d.guess}${Object.keys(d.cat).filter(k => d.cat[k] != null).length ? ` · ${Object.keys(d.cat).filter(k => d.cat[k] != null).length} of 4 sources picked` : ''}. Let's see.`
    : hist.length ? `Last week was $${lastWeek}. There is no wrong guess.` : 'There is no wrong guess.';
  const ready = d.guess && !u.total;
  return `<div class="sd-title">🎲 Payday guessing game!</div>
    <div class="sd-script">${escapeHtml(sdStory(c))}</div>
    <div class="sd-q">① Where did money come from this week? Tick my club sessions, then tap the rest.</div>
    <div class="sd-cats">
      <div class="sd-job">
        <div class="sd-job-head"><span class="sd-cat-icon">⛸️</span><span class="sd-nowrap">Club job</span><b class="sd-pill">${escapeHtml(paState)}</b></div>
        <div class="sd-atts">${chips}</div>
        <div class="sd-note">✓ = ${escapeHtml(sdD(rate))} · missed = $0, not a fine</div>
      </div>
      ${cats}
    </div>
    <div class="sd-q">② Climb the stairs to my guess</div>
    <div class="sd-stairs">${rungs}</div>
    <div class="sd-row">
      <span class="sd-note">${escapeHtml(hint)}</span>
      <button type="button" class="sd-go${ready ? '' : ' off'}" data-mny-action="sd-reveal" aria-disabled="${!ready}">Show me →</button>
    </div>`;
}
function sdAskRow(c, it) {
  const d = c.d;
  const q = it.q || null;
  const status = it.kind === 'meet' ? '⏳ planned — no result yet'
    : it.open ? (it.status === 'talk' ? '💬 Parents want to talk' : '⏳ waiting for parents')
    : ({ goal: '✓ new goal starts today', move: '✓ moved', deposit: '✓ in the bank', gift: '✓ in the bank',
         adv: '✓ already spent · comes off today', skip: '✓ marked missed', dispute: '✓ fine taken away' }[it.kind]
       || (q && q.record && q.record.compId ? `✓ yes · ${sdD(mrCompAward(mrCompetitions(c.kid).find(x => x.id === q.record.compId)))} today` : '✓ yes'));
  let btns = '';
  if (it.kind === 'meet') {
    const p = it.meet;
    btns = `<button type="button" class="sd-ans yes" data-mny-action="sd-meet" data-daykey="${escapeAttr(p.dayKey)}" data-name="${escapeAttr(p.name || '')}" data-sport="${escapeAttr(p.sport || '')}">✓ result</button>
      <button type="button" class="sd-ans" data-mny-action="comp-zero" data-daykey="${escapeAttr(p.dayKey)}" data-name="${escapeAttr(p.name || '')}" data-sport="${escapeAttr(p.sport || 'swim')}">No criteria met · $0</button>`;
  } else if (it.open && it.status === 'talk' && q) {
    /* 💬 Talk first, at the meeting (Plan v9 §N, Deviation 41): what she
       asked, the agreed amount a parent steps with − / +, then ✓ Agree (a yes
       with that figure, through mnyAnswerRequest) or Not this time. A skip
       or a dispute has no amount: ✓ / ✗ only. */
    const field = mnyAgreedField(q.store, q.record);
    if (field) {
      const asked = mnyRequestAsked(q.store, q.record);
      const agreed = q.agreed != null ? q.agreed : asked;
      const fig = v => (it.kind === 'adv' ? sdOff$(v, sdD) : sdD(v));   // early cash is taken off (Plan v18 §W)
      btns = `<div class="sd-agree">
          <span class="sd-agree-asked">asked ${escapeHtml(fig(asked))}</span>
          <span class="sd-agree-set"><span>agreed</span><button type="button" class="sd-step" data-mny-action="sd-agreed" data-sd-id="${escapeAttr(it.id)}" data-sd-d="-1" aria-label="A dollar less">−</button><b>${escapeHtml(fig(agreed))}</b><button type="button" class="sd-step" data-mny-action="sd-agreed" data-sd-id="${escapeAttr(it.id)}" data-sd-d="1" aria-label="A dollar more">+</button></span>
        </div>
        <button type="button" class="sd-ans yes" data-mny-action="sd-agree" data-sd-id="${escapeAttr(it.id)}">✓ Agree</button>
        <button type="button" class="sd-ans no" data-mny-action="sd-no" data-sd-id="${escapeAttr(it.id)}">Not this time</button>`;
    } else {
      btns = `<button type="button" class="sd-ans yes" data-mny-action="sd-yes" data-sd-id="${escapeAttr(it.id)}">✓ Yes</button>
        <button type="button" class="sd-ans no" data-mny-action="sd-no" data-sd-id="${escapeAttr(it.id)}">✗ No</button>`;
    }
  } else if (it.open) {
    btns = `<button type="button" class="sd-ans yes" data-mny-action="sd-yes" data-sd-id="${escapeAttr(it.id)}">✓ Yes</button>
      <button type="button" class="sd-ans" data-mny-action="sd-adjust" data-sd-id="${escapeAttr(it.id)}" aria-expanded="${d.adjust === it.id}">✏️ Adjust</button>
      ${it.status === 'talk' ? '' : `<button type="button" class="sd-ans" data-mny-action="sd-talk" data-sd-id="${escapeAttr(it.id)}">💬 Talk first</button>`}`;
  }
  let adjust = '';
  if (it.open && d.adjust === it.id && q) {
    const rec = q.record || {};
    let nums = '';
    if (it.kind === 'comp') {
      // Her figure, as the Approve card reads it (guCompCalc) — Dad starts there.
      const rule = rec.pay != null ? money2(rec.pay) : guCompCalc(rec).amt;
      nums = `<div class="sd-adj-row"><span>A parent makes it</span><button type="button" class="sd-step" data-mny-action="sd-pay" data-sd-id="${escapeAttr(it.id)}" data-sd-d="-1" aria-label="Less">−</button><b>${escapeHtml(sdD(rule))}</b><button type="button" class="sd-step" data-mny-action="sd-pay" data-sd-id="${escapeAttr(it.id)}" data-sd-d="1" aria-label="More">+</button></div>`;
    } else if ((it.kind === 'gift' || it.kind === 'deposit') && rec.pendingApproval) {
      nums = `<div class="sd-adj-row"><span>How much</span><button type="button" class="sd-step" data-mny-action="sd-gift" data-sd-id="${escapeAttr(it.id)}" data-sd-d="-1" aria-label="Less">−</button><b>${escapeHtml(sdD(rec.amount))}</b><button type="button" class="sd-step" data-mny-action="sd-gift" data-sd-id="${escapeAttr(it.id)}" data-sd-d="1" aria-label="More">+</button></div>`;
    } else if (it.kind === 'adv' || it.kind === 'move') {
      nums = `<div class="sd-adj-row"><span>Amount</span><b>${escapeHtml(it.kind === 'adv' ? sdOff$(q.amount, sdD) : sdD(q.amount))}</b></div>`;
    }
    adjust = `<div class="sd-adj">${nums}<button type="button" class="sd-ans no" data-mny-action="sd-no" data-sd-id="${escapeAttr(it.id)}">✗ Not this time</button></div>`;
  }
  return `<div class="sd-ask${it.open ? ' open' : ' done'}">
      <span class="sd-ask-icon">${escapeHtml(it.icon || '❔')}</span>
      <div class="sd-ask-text"><span>${escapeHtml(it.text)}</span><span class="sd-ask-status${it.open ? ' wait' : ''}">${escapeHtml(status)}</span></div>
      ${btns ? `<div class="sd-ask-btns">${btns}</div>` : ''}
      ${adjust}
    </div>`;
}
function sdGuessSide(c) {
  const items = sdPendingItems(c.kid, c.wk);
  // 💬 Talk-first questions come first, as their own group (Plan v9 §N).
  const talk = items.filter(x => x.open && x.status === 'talk');
  const groups = (talk.length ? `<div class="sd-askgroup sd-askgroup--talk"><div class="sd-askgroup-title">💬 To talk about</div>${talk.map(it => sdAskRow(c, it)).join('')}</div>` : '')
    + SD_ASK_GROUPS.map(([id, title, kinds]) => {
    const mine = items.filter(x => kinds.indexOf(x.kind) >= 0 && talk.indexOf(x) < 0);
    if (!mine.length) return '';
    return `<div class="sd-askgroup"><div class="sd-askgroup-title">${escapeHtml(title)}</div>${mine.map(it => sdAskRow(c, it)).join('')}</div>`;
  }).join('');
  const u = sdUnsettled(c.kid, c.wk);
  const note = u.asks ? 'Payday opens when every question has an answer.'
    : u.sessions ? '✓ Parents are done. Tick my club sessions next.'
    : u.rows ? '✓ Parents are done. Read the new row on my wall.' : '✓ All answered. Now I can guess.';
  const y = mrYearToDate(c.kid);
  const target = Number(mrRuleOr(c.rules, 'targets.' + c.kid + '.annual')) || y.target || 0;
  // The same "earned this year" as Grown-ups › Weeks (Plan v17 item 8).
  const earnedYr = guEarnedThisYear(c.kid);
  const pct = target > 0 ? Math.min(100, earnedYr / target * 100) : 0;
  /* Owner's review (screenshot 3, S1-12): 💡 Clues and 🎯 My earning target
     on top, ⏳ Dad answers first below them with "open / total" in its
     title; each clue row on one line. */
  const open = items.filter(x => x.open).length;
  return `<div class="sd-panel">
      <div class="sd-panel-title">💡 Clues for my guess</div>
      ${sdClues(c.rules).map(x => `<div class="sd-clue"><span>${escapeHtml(x.k)}</span><span>${escapeHtml(x.v)}</span></div>`).join('')}
    </div>
    <div class="sd-panel sd-panel--green">
      <div class="sd-panel-head"><span class="sd-panel-title">🎯 My earning target</span><span class="sd-note">set by parents</span></div>
      <div class="sd-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
      <div class="sd-line">${escapeHtml(`$${Math.round(earnedYr)} of $${Math.round(target)} earned so far · about ${sdM(target / 52)} a week keeps me on pace`)}</div>
    </div>
    <div class="sd-panel sd-panel--amber">
      <div class="sd-panel-head"><span class="sd-panel-title">⏳ Parents answer first · ${open} / ${items.length} open</span><span class="sd-note">a parent taps</span></div>
      ${groups || '<div class="sd-note">Nothing waiting.</div>'}
      <div class="sd-adds">
        <button type="button" class="sd-btn" data-mny-action="sd-add" data-sd-kind="meet">➕ result</button>
        <button type="button" class="sd-btn" data-mny-action="sd-add" data-sd-kind="gift">➕ gift</button>
        <button type="button" class="sd-btn" data-mny-action="sd-add" data-sd-kind="fine">➕ fine</button>
      </div>
      <div class="sd-note">${escapeHtml(note)}</div>
    </div>`;
}

/* ── Step 2 · Payday (Plan v17 §2: the round-5 design, Stage 6h) ──
   Money in, in the four income groups (S1): 💪 Money I earned — 🏠 Home ·
   ⛸️ Club job · 🏆 Competitions, each a payday-line button with its working
   beside it — 🎁 Money I was given and 🌱 Money my money made side by side,
   🏦 From my bank (📥 what waits, 🏦 From Savings, 🏠 From home); ➖ Taken
   off (📦 fines, ⏪ drawn early); 💰 My pile, the prototype's coins coloured
   by group with the y-axis on its right and each group's share under it;
   the footer with the loan-first line, a parent's −/+ on it and
   "Now I choose →". A line opens its working in a sheet (`sdOpenLine`). */
function sdGroupNames(words) {
  return words >= 2
    ? { earned: 'Active income', given: 'Gifts', made: 'Passive income' }
    : { earned: '💪 Money I earned', given: '🎁 Money I was given', made: '🌱 Money my money made' };
}
/* The Payday tiles in the order the coins fall, each with its sum. */
function sdTiles(c) {
  const b = c.f.b;
  const passive = mnyPassiveSinceLastMeeting(c.kid);
  const ses = (b.sessions || {}).attended || 0;
  const place = e => ((e.placement || {}).group ? ` · group ${rqOrd(e.placement.group)}` : '');
  return [
    { id: 'home', group: 'earned', name: '🏠 Home', every: true, amount: money2(b.chorePaid + b.learnPaid + b.streakBonus),
      note: `chores ${sdD(money2(b.chorePaid + b.learnPaid))} · routine ${sdD(b.streakBonus)}`, coin: 'earned', badge: 'NICE!' },
    { id: 'club', group: 'earned', name: '⛸️ Club job', every: true, amount: money2(b.sessionsPaid),
      note: `${ses} session${ses === 1 ? '' : 's'} × ${sdD(sdRule(c.rules, 'sessions.perSession'))}`, coin: 'earned', badge: 'WOW' },
    { id: 'comp', group: 'earned', name: '🏆 Competitions', amount: c.f.compIn,
      note: (b.comp.entries || []).map(e => (e.name || mnySportLabel(e.sport)) + place(e)).join(' · ') || (c.f.lateIn ? 'a competition from a settled week' : 'none this week'), coin: 'earned', badge: 'BRAVO!' },
    { id: 'gifts', group: 'given', name: '🎁 Gifts', amount: c.f.giftsIn,
      note: c.f.deps.filter(x => !sdIsHomeCash(x)).map(x => `${x.giver || x.from} ${sdD(x.amount)}`).filter(Boolean).join(' · ') || 'only after a parent says yes', coin: 'given', badge: 'THANKS!' },
    { id: 'made', group: 'made', name: '🌱 My pots earned', amount: money2(Math.max(0, passive)), noCoins: true,
      note: passive < 0 ? `companies ${sdD(passive)} this week` : `Savings interest · ${sdRule(c.rules, 'pots.rates.ready')}% a year`, coin: null },
    { id: 'fines', group: 'off', name: '📦 Fines', amount: money2(-(c.f.b.gross - c.f.b.net)), free: true,
      note: sdFinesNote(b), coin: 'off' },
  ];
}
/* Cash brought from home is not a gift (Plan v17 item 10): it is her own
   money, so it sits under 🏦 From my bank everywhere. */
function sdIsHomeCash(x) { return !!x && (x.requestKind === 'deposit' || /home/i.test(String(x.from || ''))); }
/* The fines line's words: how many were logged, and — when none of them
   cost anything — that they were free (a free fine shows no amount, never
   "−$0", owner's review G4-4). */
function sdFinesNote(b) {
  const charged = Object.keys((b.fines || {}).chargeable || {});
  const n = charged.length;
  if (!n) return 'no fines this week 🎉';
  const costing = charged.filter(id => b.fines.chargeable[id] > 0).length;
  return costing ? `${n} logged · every one is on the record` : `${n} logged · ${n === 1 ? 'it was' : 'all'} free`;
}
/* 📦 Which fines, on which days ("Tue + Thu · skates left out"). */
function sdFinesDays(c) {
  const keys = (c.f.b.chores.days || []).map(x => String(x.dayKey));
  const list = mrFines(c.kid).filter(f => f && keys.indexOf(String(f.dayKey)) >= 0);
  if (!list.length) return '';
  const days = [...new Set(list.map(f => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][formatDayKey(f.dayKey).getDay()]))].join(' + ');
  const what = [...new Set(list.map(f => (typeof guFineLabel === 'function' ? guFineLabel(f.itemId) : f.itemId)))].join(' · ');
  return `${days} · ${what}`;
}
function sdTileHtml(c, t, idx) {
  const d = c.d;
  const on = idx < d.shown;
  const v = t.amount;
  return `<button type="button" class="sd-tile${on ? ' on' : ''}${v === 0 ? ' zero' : v < 0 ? ' neg' : ''}" data-mny-action="sd-line" data-sd-tile="${t.id}">
      ${on && v > 0 && t.badge ? `<span class="sd-badge">${escapeHtml(t.badge)}</span>` : ''}
      <span class="sd-tile-name"><span class="sd-nowrap">${escapeHtml(t.name)}</span> · <b>${escapeHtml(sdM(v))}</b></span>
    </button>`;
}
/* A payday line's working, in a sheet (#sundayOverlay): its channels, the
   days and grades that made it, and a parent's ✏️ with a reason. */
function sdTileDetail(c, id, edit) {
  const chans = (SD_TILE_CHANNELS[id] || []).filter(ch => ch !== 'learning' || money2(c.f.b.learnPaid) > 0 || mnyOverrides(c.kid, c.wk).learning);
  if (!edit) {
    const work = chans.length ? chans.map(ch => `<div class="sd-work-head">${escapeHtml(SD_CHANNEL_LABEL[ch])}</div>${mnyWorking(c.wk, c.kid, ch === 'sessions' ? 'sessions' : ch, c.f.b)}`).join('')
      : `<div class="sd-note">${escapeHtml((sdTiles(c).find(t => t.id === id) || {}).note || '')}</div>`;
    const pen = isParent() && chans.length
      ? `<button type="button" class="sd-btn" data-mny-action="sd-edit" data-sd-tile="${id}">✏️ A parent changes this line</button>` : '';
    return `<div class="sd-work">${work}${pen}</div>`;
  }
  if (!isParent()) return '';
  const b = c.f.b;
  const cur = { chores: b.chorePaid, learning: b.learnPaid, streak: b.streakBonus, sessions: b.sessionsPaid, comp: b.compPaid, fines: b.fines.total };
  const ov = mnyOverrides(c.kid, c.wk);
  const rows = chans.map(ch => `<div class="sd-adj-row"><span>${escapeHtml(SD_CHANNEL_LABEL[ch])}${ov[ch] ? ` <s>${escapeHtml(sdM(b.original[ch]))}</s>` : ''}</span>
      <button type="button" class="sd-step" data-mny-action="sd-ov" data-sd-ch="${ch}" data-sd-d="-1" aria-label="Less">−</button><b>${escapeHtml(sdM(cur[ch]))}</b>
      <button type="button" class="sd-step" data-mny-action="sd-ov" data-sd-ch="${ch}" data-sd-d="1" aria-label="More">+</button>
      ${ov[ch] ? `<button type="button" class="sd-step" data-mny-action="sd-ovreset" data-sd-ch="${ch}" aria-label="Back to the planner's number">↺</button>` : ''}</div>`).join('');
  const reason = mnyWeekReason(c.kid, c.wk);
  return `<div class="sd-work sd-work--edit">${rows}
      ${mnyAnyEdited(c.kid, c.wk) ? `<div class="sd-reasons"><span class="sd-note">Why:</span>${MNY_REASONS.map(r =>
        `<button type="button" class="sd-chip${reason === r.id ? ' on' : ''}" data-mny-action="sd-reason" data-sd-r="${escapeAttr(r.id)}">${escapeHtml(r.label)}</button>`).join('')}</div>` : ''}
    </div>`;
}
/* 💰 My pile: the coins in fall order, coloured by group — 💪 earned green,
   🎁 given gold, 🏦 bank blue — with what was taken off as dashed red ghosts
   on top. Drawn by `sdLayPile` once the card has its size: the coins as big
   as the card allows, five a row, the axis on their right at $10 steps. */
function sdCoins(c) {
  const d = c.d, P = c.P;
  const tiles = sdTiles(c);
  const coins = [];
  const done = d.shown >= tiles.length;
  tiles.forEach((t, i) => {
    if (i >= d.shown || t.noCoins || !t.coin || t.coin === 'off') return;
    for (let n = 0; n < Math.floor(t.amount + 1e-9) && coins.length < 400; n++) coins.push({ cls: t.coin, fresh: i === d.shown - 1 && !done });
  });
  if (done) for (let n = 0; n < Math.floor(P.pullTot + 1e-9) && coins.length < 400; n++) coins.push({ cls: 'bank', fresh: false });
  const fines = Math.ceil(-Math.min(0, P.income.fine) - 0.001);
  const off = fines + (done ? Math.ceil(P.advTaken - 0.001) : 0);
  for (let g = 0; g < off && coins.length; g++) {
    const j = coins.length - 1 - g;
    if (j < 0) break;
    coins[j] = { cls: 'ghost', label: g < fines ? '📦' : '⏪' };
  }
  return coins.map((x, i) => `<span class="sd-coin ${'sd-coin--' + x.cls}${x.fresh ? ' drop' : ''}" data-i="${i}" style="animation-delay:${(i % 8) * 55}ms"><i>${x.label || '$1'}</i></span>`).join('');
}
function sdLayPile() {
  const box = document.querySelector('.sd-pilebox');
  if (!box) return;
  const H = box.clientHeight, W = box.clientWidth;
  if (!H || !W) return;
  const coins = [...box.querySelectorAll('.sd-coin')];
  const AX = 40, colW = (W - AX) / 5;
  const rows = Math.max(1, Math.ceil(coins.length / 5));
  const rowH = Math.min((H - 2) / rows, colW);
  const D = Math.floor(rowH * 0.92);
  coins.forEach((el, n) => {
    el.style.left = ((n % 5) * colW + (colW - D) / 2).toFixed(1) + 'px';
    el.style.bottom = (Math.floor(n / 5) * rowH + (rowH - D) / 2).toFixed(1) + 'px';
    el.style.width = el.style.height = D + 'px';
  });
  const axis = box.querySelector('.sd-ruler');
  if (axis) {
    axis.style.left = (W - AX) + 'px';
    let t = '';
    for (let v = 10; v / 5 * rowH < H - 8; v += 10) t += `<span class="sd-tick" style="bottom:${(v / 5 * rowH).toFixed(1)}px">$${v}</span>`;
    axis.innerHTML = t;
  }
  const must = box.querySelector('.sd-minline');
  if (must) {
    must.style.bottom = Math.min(H - 2, Number(must.getAttribute('data-sd-v')) / 5 * rowH).toFixed(1) + 'px';
    must.style.width = (W - AX + 6) + 'px';
  }
}
function sdPaydayMain(c) {
  const d = c.d, P = c.P, f = c.f;
  const g = sdGroupNames(c.words);
  const tiles = sdTiles(c);
  const tile = id => tiles.find(t => t.id === id);
  const tileOf = id => sdTileHtml(c, tile(id), tiles.findIndex(t => t.id === id));
  const line = (id, note) => `<div class="sd-payline">${tileOf(id)}<span class="sd-payline-note">${escapeHtml(note != null ? note : tile(id).note)}${tile(id).every ? ' · <i class="sd-tag">every week</i>' : ''}</span></div>`;
  const done = d.shown >= tiles.length;
  const earned = money2(tiles.filter(t => t.group === 'earned').reduce((a, t) => a + t.amount, 0));
  const made = tile('made').amount;
  const adv = P.advW;
  const advNote = f.advOwed && d.advMan ? `asked + $${d.advMan} I forgot to ask`
    : f.advOwed ? `${f.advReqs.map(r => r.why || r.day).filter(Boolean).join(' · ') || 'asked parents'} · spent`
    : d.advMan ? 'I forgot to ask · a parent checks it' : 'forgot to ask? tap +';
  const savingsFree = Math.floor(Math.max(0, mnySavedTotal(c.kid) - sdRule(c.rules, 'pots.safety')) + 1e-9);
  const pull = (k, name, sub) => `<div class="sd-pull"><div class="sd-pull-name"><span class="sd-nowrap">${escapeHtml(name)}</span><span class="sd-note">${escapeHtml(sub)}</span></div>
      <button type="button" class="sd-step" data-mny-action="sd-pull" data-sd-k="${k}" data-sd-d="-1" aria-label="Less">−</button><b>$${Number(d.pull[k]) || 0}</b>
      <button type="button" class="sd-step sd-step--gold" data-mny-action="sd-pull" data-sd-k="${k}" data-sd-d="1" aria-label="More">+</button></div>`;
  // 📥 Money that came in since last Sunday joins the pile on its own
  // (Deviation 37); it is one line of the box, so the box adds up to its total.
  const waiting = money2(f.carry + f.homeIn);
  const bankNote = f.unlocked > 0 ? 'a lock came back' : 'only if I need it';
  const mustRows = isParent() ? `<button type="button" class="sd-step" data-mny-action="sd-must" data-sd-d="-1" aria-label="A parent: pay less this week">−</button><button type="button" class="sd-step" data-mny-action="sd-must" data-sd-d="1" aria-label="A parent: back toward the schedule">+</button>` : '';
  const reduced = f.due.filter(x => x.reduced);
  const impact = reduced.length ? ` A parent made it ${sdM(money2(reduced.reduce((a, x) => a + x.scheduled - x.amount, 0)))} less — still owed next Sunday, no interest.` : '';
  const short = P.shortfall > 0 ? ` 🚨 ${sdM(P.shortfall)} is carried to next Sunday — no interest on it.` : '';
  const takenOff = money2(-P.income.fine + P.advTaken);
  const inTotal = money2(earned + f.giftsIn + P.pullTot);
  const gp = sdPercents([earned, f.giftsIn, P.pullTot], inTotal);
  const offPct = inTotal > 0 ? Math.round(takenOff / inTotal * 100) : 0;
  const sw = cls => `<i class="sd-sw ${cls}"></i>`;
  const shares = done
    ? `${sw('sd-sw--earned')}earned <b>${sdPercentLabel(gp[0], earned)}</b> · ${sw('sd-sw--given')}given <b>${sdPercentLabel(gp[1], f.giftsIn)}</b><br>${sw('sd-sw--bank')}bank <b>${sdPercentLabel(gp[2], P.pullTot)}</b> · ${sw('sd-sw--off')}taken off <b>${takenOff > 0 ? '−' + Math.max(1, offPct) + '%' : '0%'}</b>`
    : 'coins are falling…';
  const needReason = mnyAnyEdited(c.kid, c.wk) && !mnyWeekReason(c.kid, c.wk);
  const monthly = money2(f.debts.filter(x => loanBalance(c.kid, x.id) > 0).reduce((a, x) => a + money2(x.monthly), 0));
  const fineDays = sdFinesDays(c);
  // The daily floor (Plan v18, last round): fines that took less than they cost say so.
  const fineRaw = money2(((c.f.b.fines || {}).perDay || []).reduce((a, x) => a + (Number(x.raw) || 0), 0));
  const fineFloor = sdFineFloorNote(fineRaw, money2((c.f.b.fines || {}).total), sdM);
  return `<div class="sd-titlerow"><span class="sd-title">☀️ My payday</span><span class="sd-script">${escapeHtml(sdGuessResult(c))}</span></div>
    <div class="sd-pay">
      <div class="sd-pay-groups">
        <div class="sd-box sd-box--in">
          <div class="sd-box-head"><span class="sd-box-title">💰 Money in</span><b class="sd-teal">${escapeHtml(sdM(inTotal))}</b></div>
          <div class="sd-group sd-group--earned"><div class="sd-group-head"><span>${escapeHtml(g.earned)}</span><b>${escapeHtml(sdM(earned))}</b></div>
            ${line('home')}${line('club')}${line('comp')}</div>
          <div class="sd-group-pair">
            <div class="sd-group sd-group--given"><div class="sd-group-head"><span>${escapeHtml(g.given)}</span><b>${escapeHtml(sdM(f.giftsIn))}</b></div>
              ${tileOf('gifts')}<span class="sd-group-note">${escapeHtml(tile('gifts').note)}</span></div>
            <div class="sd-group sd-group--made"><div class="sd-group-head"><span>${escapeHtml(g.made)}</span><b>${escapeHtml(sdM(made))}</b></div>
              ${tileOf('made')}<span class="sd-group-note">${escapeHtml(tile('made').note)}</span></div>
          </div>
          <div class="sd-bank">
            <div class="sd-group-head"><span class="sd-nowrap">🏦 From my bank</span><span class="sd-note sd-bank-note">${escapeHtml(bankNote)}</span><b>${escapeHtml(sdM(P.pullTot))}</b></div>
            <div class="sd-pulls">
              ${pull('ready', '🏦 From Savings', `$${savingsFree} free`)}
              ${pull('cash', '🏠 From home', 'cash I bring in')}
              ${waiting > 0 ? `<div class="sd-pull"><div class="sd-pull-name"><span class="sd-nowrap">📥 Waiting for Sunday</span><span class="sd-note">came in this week</span></div><b>${escapeHtml(sdM(waiting))}</b></div>` : ''}
            </div>
          </div>
        </div>
        <div class="sd-box sd-box--off">
          <div class="sd-box-head"><span class="sd-box-title">➖ Taken off</span><span class="sd-note">fines · cash I drew before Sunday</span><b class="sd-red">${escapeHtml(sdOff$(takenOff))}</b></div>
          <div class="sd-offs">
            <button type="button" class="sd-off" data-mny-action="sd-line" data-sd-tile="fines"><span>📦 ${escapeHtml(fineDays ? 'Box fine' : 'Fines')}</span>
              <span class="sd-off-foot"><span class="sd-note">${escapeHtml(fineDays || tile('fines').note)}${fineFloor ? ' · ' + escapeHtml(fineFloor) : ''}</span>${-P.income.fine > 0.004 || fineFloor ? `<b class="sd-red">${escapeHtml(sdOff$(fineFloor ? fineRaw : P.income.fine))}</b>` : ''}</span></button>
            <div class="sd-off sd-off--adv">
              <div class="sd-pull-name"><span class="sd-nowrap">⏪ Drawn early <b${adv ? ' class="sd-red"' : ''}>${escapeHtml(sdOff$(adv))}</b></span><span class="sd-note">${escapeHtml(advNote)}</span></div>
              <button type="button" class="sd-step" data-mny-action="sd-adv" data-sd-d="-1" aria-label="Less">−</button>
              <button type="button" class="sd-step sd-step--peach" data-mny-action="sd-adv" data-sd-d="1" aria-label="More">+</button>
            </div>
          </div>
        </div>
      </div>
      <div class="sd-pile">
        <div class="sd-pile-head"><span class="sd-box-title">💰 My pile</span><b class="sd-red">${escapeHtml(sdM(done || sdReducedMotion() ? P.tp : 0))}</b></div>
        <div class="sd-pilebox">
          <div class="sd-stack">${sdCoins(c)}</div>
          <div class="sd-ruler"></div>
          <span class="sd-minline" data-sd-v="${P.mustPay}"><span>📌 loan first ${escapeHtml(sdM(P.mustPay))}</span></span>
        </div>
        <div class="sd-pile-note">${shares}</div>
      </div>
    </div>
    <div class="sd-row sd-payfoot">
      <button type="button" class="sd-btn" data-mny-action="sd-back" data-sd-to="0">◀ Guess</button>
      <span class="sd-payfoot-text">${needReason ? 'A parent changed a line — pick why first.'
        : `📌 Loan first <b>${escapeHtml(sdM(P.minNow))}</b> (${escapeHtml(sdD(monthly))} a month) · then <b>${escapeHtml(sdM(money2(P.tp - P.minNow)))}</b> is mine.${escapeHtml(impact + short)}`}</span>
      ${mustRows}
      <button type="button" class="sd-go${needReason || !done ? ' off' : ''}" data-mny-action="sd-tochoose" aria-disabled="${needReason || !done}">Now I choose →</button>
    </div>`;
}
function sdGuessResult(c) {
  const d = c.d, Pd = c.P.payday;
  if (d.guess == null) return '';
  const cats = sdCats(c).filter(([k]) => d.cat[k] != null);
  const right = cats.filter(([k, , , real]) => d.cat[k] === real).length;
  return (Math.abs(d.guess - Pd) <= 5 ? `$${d.guess} — really close!` : d.guess > Pd ? `$${d.guess} — it's less.` : `$${d.guess} — it's more!`)
    + (cats.length ? ` · ${right} of ${cats.length} sources right` : '');
}
/* 📊 My last 4 Sundays reads each frozen row through `sdHistGroups` (js/43,
   the pure core, so tests/sunday.test.js holds its total to the pile). */
function sdPaydaySide(c) {
  const b = c.f.b;
  // Her money week's own days (Deviation 34: Sun..Sat after the switch).
  const days = b.chores.days.map(x => {
    const L = 'SMTWTFS'[formatDayKey(x.dayKey).getDay()];
    const asked = x.taken ? [] : routineSessionsForDay(c.kid, x.wk, x.d);
    const kept = asked.length && asked.every(s => ctGetMandatory(x.wk, x.d, s, c.kid));
    const paid = money2(x.paid);
    return `<div class="sd-day"><span>${L}</span><span class="sd-dot${kept ? ' kept' : ''}">${kept ? '🔥' : '·'}</span><span>${paid > 0 ? sdD(paid) : '—'}</span></div>`;
  }).join('');
  const hist = c.f.hist;
  const f = v => v == null ? '' : v === 0 ? '—' : Math.abs(v) < 1 ? (v < 0 ? '−' : '') + Math.abs(Math.round(v * 100)) + '¢' : (v < 0 ? '−$' : '$') + Math.abs(Math.round(v));
  const done = c.d.shown >= sdTiles(c).length;
  const tiles = sdTiles(c);
  const amt = id => tiles.find(t => t.id === id).amount;
  const now = { home: amt('home'), club: amt('club'), comp: amt('comp'), given: c.f.giftsIn, made: amt('made'), bank: c.P.pullTot,
                off: -money2(-c.P.income.fine + c.P.advTaken) };
  now.earned = money2(now.home + now.club + now.comp);
  now.total = c.P.tp;
  const cols = Array.from({ length: 4 }, (_, i) => hist[i - (4 - hist.length)] || null).map(r => r ? sdHistGroups(r) : null);
  const rows = [['💪 Money I earned', 'earned'], ['🏠 Home', 'home', true], ['⛸️ Club job', 'club', true],
    ['🏆 Competitions', 'comp', true], ['🎁 Given', 'given'], ['🌱 Made', 'made'],
    ['📥 From my bank', 'bank'], ['➖ Taken off', 'off']];
  const avgOf = k => { const have = cols.filter(x => x && x[k] != null); return have.length ? have.reduce((a, x) => a + x[k], 0) / have.length : null; };
  const table = rows.map(([label, k, sub]) => `<tr${sub ? ' class="sd-l4-sub"' : ''}><td>${escapeHtml(label)}</td>${cols.map(x => `<td>${x ? f(x[k]) : ''}</td>`).join('')}<td class="sd-l4-now${k === 'off' && now.off < 0 ? ' sd-red' : ''}">${done ? f(now[k]) : '…'}</td><td class="sd-l4-avg">${f(avgOf(k))}</td></tr>`).join('');
  const avgT = avgOf('total');
  const noBank = money2(c.P.tp - c.P.pullTot);
  const avgNoBank = (() => { const have = cols.filter(Boolean); return have.length ? have.reduce((a, x) => a + x.total - (x.bank || 0), 0) / have.length : null; })();
  const res = [...(b.comp.entries || []).map(e => ({ n: '🏆 ' + (e.name || mnySportLabel(e.sport)), s: '✓ recorded', a: sdD(mrCompAward(e)), ok: true })),
    ...c.f.deps.filter(x => !sdIsHomeCash(x)).map(x => ({ n: '🎁 ' + (x.giver || x.from || 'A gift'), s: '✓ yes', a: sdD(x.amount), ok: true })),
    ...mnyComingUp(c.kid).filter(x => x.kind === 'soon').map(x => ({ n: (x.icon || '🏆') + ' ' + x.name, s: x.when, a: '' }))].slice(0, 4);
  return `<div class="sd-panel sd-panel--week">
      <div class="sd-panel-title">🔥 My week · chores + routine</div>
      <div class="sd-days">${days}</div>
      <div class="sd-line">${escapeHtml(`${b.streak.days} routine days · chores ${sdM(b.chorePaid)} graded`)}</div>
    </div>
    <div class="sd-panel sd-panel--l4">
      <div class="sd-panel-title">📊 My last 4 Sundays</div>
      <table class="sd-l4"><thead><tr><th></th><th>4 wk</th><th>3 wk</th><th>2 wk</th><th>last</th><th class="sd-l4-now sd-red">now</th><th class="sd-l4-avg">avg</th></tr></thead>
        <tbody>${table}
        <tr class="sd-l4-tot"><td>= Total</td>${cols.map(x => `<td>${x ? f(x.total) : ''}</td>`).join('')}<td class="sd-l4-now sd-red">${done ? f(now.total) : '…'}</td><td class="sd-l4-avg">${f(avgT)}</td></tr></tbody></table>
      <div class="sd-line">${escapeHtml(!done ? 'filling in as the coins fall…' : avgNoBank == null ? 'My first Sunday on the record.' : noBank >= avgNoBank ? `📈 ${sdM(noBank - avgNoBank)} above my 4-week average (before bank)` : `📉 ${sdM(avgNoBank - noBank)} below my 4-week average (before bank)`)}</div>
    </div>
    <div class="sd-panel sd-panel--pink">
      <div class="sd-panel-title">🏆 🎁 Results &amp; gifts</div>
      ${res.length ? res.map(x => `<div class="sd-res"><span>${escapeHtml(x.n)}</span><span class="${x.ok ? 'sd-green' : 'sd-note'}">${escapeHtml(x.s)}</span><b>${escapeHtml(x.a)}</b></div>`).join('') : '<div class="sd-note">None this week.</div>'}
    </div>`;
}

/* ── Step 3 · I choose (Plan v17 §3: the prototype's waterfall, Stage 6h) ──
   Three equal columns — 🧱 Loan, 👛 Spend, 🌱 Save & grow — each a level
   line and a block of pot segments that starts where the column before it
   ended, then one legend column of the seven pots with "−$1" on top. The
   first tap on a pot picks it (`d.pick`); a tap again adds $1 and a coin
   flies from the pile; a 2-second hold adds $5; "−$1" takes $1 back from the
   picked pot. The core's rules (`sdCanPlace`, the spend cap, the gates)
   decide every placement, as before. */
function sdVal(c, k) {
  const a = c.d.alloc, P = c.P;
  if (k === 'fixed') return P.minNow;
  if (k === 'ready') return money2(a.ready + (P.centsTo === 'ready' ? P.cents : 0));
  if (k === 'extra') return money2(a.extra + (P.centsTo === 'extra' ? P.cents : 0));
  return money2(a[k] || 0);
}
function sdCan(c, k) {
  if (k === 'fixed') return { ok: false, why: '📌 taken first, every week' };
  if (k === 'goal' && !c.f.chosen) return { ok: false, why: '🎯 no goal yet · ＋ on My money asks parents' };
  const can = sdCanPlace(k, c.w, c.rules);
  if (!can.ok) return can;
  if (k === 'spend') {
    const cap = sdFloor(c.P.hers * sdRule(c.rules, 'spend.capPct') / 100);
    if (c.d.alloc.spend >= cap) return { ok: false, why: `full · ${sdCapWords(sdRule(c.rules, 'spend.capPct'))} of my share` };
  }
  return { ok: true, why: null };
}
function sdHints(c, k) {
  const r = c.rules, b = sdRule(r, 'loan.extraBonusPct') / 100;
  const can = sdCan(c, k);
  if (k === 'fixed') return '📌 taken first, every week';
  if (!can.ok) return can.why;
  const base = { extra: `each $1 = $${(1 + b).toFixed(2)} off the wall`, spend: 'turns into real money',
    ready: `keep 🛟 $${sdRule(r, 'pots.safety')} · take out any time`, goal: 'its own jar · counts in what I own · earns nothing',
    gic: `locked ${sdRule(r, 'pots.lockWeeks')} weeks · back on a Saturday`, stock: `about ${sdRule(r, 'pots.rates.stock')}% a year · can go down` }[k];
  return (c.d.pick === k ? 'tap = $1 · hold 2 s = $5 · ' : 'tap to pick · ') + base;
}
function sdGetGive(c, k) {
  const r = c.rules, b = sdRule(r, 'loan.extraBonusPct') / 100, a = money2(c.d.alloc[k] || 0), P = c.P;
  const left = sdLeft(c.w.loan), wk = c.w.loan.weekly;
  const weeksSooner = n => wk > 0 ? Math.max(0, Math.ceil(left / wk) - Math.ceil(left / (wk + n * (1 + b)))) : 0;
  const lockW = sdRule(r, 'pots.lockWeeks'), gicR = sdRule(r, 'pots.rates.gic') / 100, stR = sdRule(r, 'pots.rates.stock') / 100;
  const safety = sdRule(r, 'pots.safety');
  const aR = money2(c.w.pots.ready - (c.w.pull.ready || 0) + a);
  const goalLeft = c.w.goal ? money2(Math.max(0, c.w.goal.target - c.w.pots.goal)) : 0;
  const cap = sdFloor(P.hers * sdRule(r, 'spend.capPct') / 100);
  return {
    fixed: ['taken first, every week', 'nothing; it is the deal we made'],
    extra: [a ? `${sdM(a * (1 + b))} off the wall · free ${weeksSooner(a)} weeks sooner` : `each $1 counts as $${(1 + b).toFixed(2)} off the wall`, 'having it. It can’t come back out.'],
    gic: [`${sdM(a)} comes back as ${sdM(a * (1 + gicR * lockW / 52))} on ${sdShortDay(sdLockMaturesOn(c.wk, lockW))}, promised`, `touching it for ${lockW} weeks`],
    stock: [`${sdM(a)} could be ${sdM(a * (1 + stR))} in a year`, 'knowing what it will be worth. It can go down.'],
    ready: [aR >= safety ? `money I can reach any time · ${sdM(aR)} in Savings` : `money I can reach any time · ${sdM(safety - aR)} more to fill 🛟 $${safety}`, `the ${Math.round(b * 100)}% wall bonus`],
    goal: [`${sdM(Math.max(0, goalLeft - a))} left to my goal`, 'using it for anything else until I buy it'],
    spend: [a ? `${sdBuysOf(a, ((r.buys || {}).items) || [])} this week` : `up to $${cap} now — ${sdCapWords(sdRule(r, 'spend.capPct'))}`, 'it leaves the bank. No interest, and it is gone once spent.'],
  }[k] || null;
}
const SD_LEGEND = ['fixed', 'extra', 'spend', 'ready', 'goal', 'gic', 'stock'];
function sdChooseMain(c) {
  const d = c.d, P = c.P, r = c.rules;
  const TP = P.tp, pile = P.pile;
  const gv = SD_COLS.map(([, , keys]) => money2(keys.reduce((a, k) => a + sdVal(c, k), 0)));
  const pc = sdPercents([...gv, Math.max(0, pile)], TP);
  let cum = 0;
  const capPct = sdRule(r, 'spend.capPct');
  const cap = sdFloor(P.hers * capPct / 100);
  const cols = SD_COLS.map(([id, title, keys], i) => {
    const v = gv[i], start = TP ? cum / TP * 100 : 0, h = TP ? v / TP * 100 : 0; cum += v;
    const segs = keys.filter(k => sdVal(c, k) > 0).map(k => `<i class="sd-seg ${'sd-seg--' + k}" style="flex:${sdVal(c, k)} 0 0">${TP && sdVal(c, k) / TP > 0.06 ? SD_SUBS[k].split(' ')[0] : ''}</i>`).join('');
    const note = id === 'loan' ? `🧱 each $1 extra = $${(1 + sdRule(r, 'loan.extraBonusPct') / 100).toFixed(2)} off`
      : id === 'spend' ? (d.alloc.spend >= cap ? `👛 full · ${sdCapWords(capPct)}` : `👛 up to $${cap} · ${sdCapWords(capPct)}`)
      : `🏦 $${sdRule(r, 'pots.safety')} safety first`;
    return `<div class="sd-col ${'sd-col--' + id}">
        <div class="sd-col-head"><span class="sd-col-title">${escapeHtml(title)}</span></div>
        <div class="sd-col-amt"><b>${escapeHtml(sdM(v))}</b><span class="sd-pill">${escapeHtml(sdPercentLabel(pc[i], v))}</span><span class="sd-col-start">starts at ${Math.round(start)}%</span><button type="button" class="sd-ask-q" data-mny-action="sd-help" data-sd-col="${id}" aria-label="What is this?"><span>?</span></button></div>
        <div class="sd-fall"><span class="sd-fall-top" style="bottom:${Math.min(100, start + h).toFixed(2)}%"></span>
          <span class="sd-fall-bar${h >= 1 ? ' edge' : ''}" style="bottom:${start.toFixed(2)}%;height:${h.toFixed(2)}%">${segs}</span></div>
        <div class="sd-colnote">${escapeHtml(note)}</div>
      </div>`;
  }).join('');
  const legend = SD_LEGEND.map(k => {
    const fixed = k === 'fixed';
    const can = sdCan(c, k);
    const shut = !fixed && !can.ok && SD_GATE_STAGE[k] && !sdIsOpen(k, c.w, r);
    const vk = sdVal(c, k);
    const amt = shut ? '🔒' : sdM(vk);
    return `<button type="button" class="sd-cell ${'sd-cell--' + k}${d.pick === k && !fixed ? ' sel' : ''}${!can.ok && !fixed ? ' lock' : ''}${fixed ? ' fixed' : ''}${d.last && d.last.k === k ? ' hot' : ''}" data-sd-cell="${k}" aria-label="${escapeAttr(SD_SUBS[k] + ' ' + amt)}">
        <span class="sd-cell-look"><i class="sd-cell-strip"></i><span class="sd-cell-label">${escapeHtml(SD_SUBS[k])}</span><b>${escapeHtml(amt)}</b></span>
        <span class="sd-cell-hold" style="width:${sdPress && sdPress.k === k ? Math.round(sdPress.p || 0) : 0}%"></span></button>`;
  }).join('');
  const presets = sdPresets(c.w, r).map(p => `<button type="button" class="sd-chip${d.presetId === p.id ? ' on' : ''}${p.locked ? ' lock' : ''}" data-mny-action="sd-preset" data-sd-p="${p.id}">${escapeHtml(p.label)}</button>`).join('');
  const lk = d.last ? d.last.k : null;
  const gg0 = lk ? sdGetGive(c, lk) : null;
  const gg = gg0 && d.last && d.last.d < 0 ? [`↩ $${d.last.n} back in my pile. ` + gg0[0], gg0[1]] : gg0;
  const tip = d.tried ? sdHints(c, d.tried) : lk ? sdHints(c, lk) : 'tap a box to pick it · tap again = $1 · hold 2 s = $5';
  const nudge = Date.now() < sdNudgeUntil;
  const signing = sdSignHold ? sdSignHold.p : 0;
  const centsTxt = P.cents ? ` · ${Math.round(P.cents * 100)}¢ change → ${P.centsTo === 'ready' ? 'Savings' : '🧱 loan'}` : '';
  const sum = `🧱 ${sdM(gv[0])} + 👛 ${sdM(gv[1])} + 🌱 ${sdM(gv[2])} = ${sdM(money2(gv[0] + gv[1] + gv[2]))}${pile > 0 ? ` · $${pile} still in my pile` : ' ✓'}${centsTxt}`;
  const minusOk = d.pick && d.pick !== 'fixed' && (d.alloc[d.pick] || 0) > 0;
  return `<div class="sd-choosehead">
      <button type="button" class="sd-pilechip" data-mny-action="sd-back" data-sd-to="1" aria-label="${escapeAttr('My pile ' + sdM(TP) + (pile > 0 ? ` · $${pile} left` : ''))}"><span class="sd-pilecoins" aria-hidden="true">💰</span><b>${escapeHtml(sdM(TP))}</b>${pile > 0 ? `<span class="sd-note">$${pile} left</span>` : ''}</button>
      <span class="sd-title">🤝 What I do with it</span>
      <button type="button" class="sd-sign${pile > 0 ? '' : ' ready'}${nudge ? ' shake' : ''}" data-sd-sign="1" aria-label="${escapeAttr(pile > 0 ? `Place $${pile} first` : 'Hold to sign my plan')}">
        <span class="sd-sign-fill" style="width:${signing}%"></span>
        <b>${escapeHtml(pile > 0 ? (nudge ? `👇 place $${pile} first` : '✍️ Hold to sign') : (signing > 0 ? 'Keep holding…' : '✍️ Hold to sign'))}</b>
      </button>
    </div>
    <div class="sd-presets">
      <button type="button" class="sd-btn" data-mny-action="sd-back" data-sd-to="1">◀ My pile</button>
      ${presets}
      <button type="button" class="sd-chip" data-mny-action="sd-clear">↺ All back</button>
      <button type="button" class="sd-chip${d.focus === 'all' ? ' dark' : ''}" data-mny-action="sd-all">📊 Everything</button>
    </div>
    <div class="sd-cols">${cols}
      <div class="sd-col sd-col--legend">
        <button type="button" class="sd-btn sd-minus${minusOk ? '' : ' off'}" data-mny-action="sd-minus" aria-label="Take $1 back from the picked pot">−$1</button>
        <div class="sd-legend">${legend}</div>
      </div>
    </div>
    <div class="sd-sum">${escapeHtml(sum)}</div>
    <div class="sd-gg${gg ? '' : ' empty'}">
      <b class="sd-gg-get">${escapeHtml(lk ? SD_SUBS[lk] + ' · I get' : '👆 Tap a box to pick it · I get')}</b><span>${escapeHtml(gg ? gg[0] : 'what each dollar does shows up here.')}</span>
      <b class="sd-gg-give">I give up</b><span>${escapeHtml(gg ? gg[1] : 'every choice gives something up. That is the game.')}</span>
      <b class="sd-gg-tip">💡 Tip</b><span>${escapeHtml(tip)}</span>
    </div>`;
}
function sdChooseSide(c) {
  const d = c.d, P = c.P, r = c.rules, w = c.w;
  const words = c.words;
  const facts = mnyLoanFacts(c.kid);
  const b = sdRule(r, 'loan.extraBonusPct') / 100;
  const left = sdLeft(w.loan), PR = w.loan.principal || 0;
  const extra = sdVal(c, 'extra');
  const payNow = money2(P.minNow + extra * (1 + b));
  const oweAfter = sdOweAfterPlan(w, r);
  const lk = d.last ? d.last.k : null;
  const hk = d.focus === 'all' ? 'all' : ({ fixed: 'loan', extra: 'loan', ready: 'ready', goal: 'goal', gic: 'gic', stock: 'stock' })[lk] || null;
  const hot = id => hk === 'all' || hk === id;
  const burst = id => (hot(id) && d.last && Date.now() - (d.lastAt || 0) < 1300) ? '<span class="sd-burst" aria-hidden="true">🎆✨</span>' : '';
  let bricks = '';
  if (PR > 0) {
    const bz = PR / 100, pd = Math.max(0, PR - Math.max(0, PR - (w.loan.paid || 0)));
    const owedInt = money2(w.loan.interest || 0);
    const intAt = Math.min(99, Math.floor(pd / bz));
    bricks = Array.from({ length: 100 }, (_, i) => {
      const got = Math.max(0, Math.min(bz, pd - i * bz)), pend = Math.max(0, Math.min(bz, pd + payNow - i * bz));
      const fl = pend / bz * 100;
      const red = i === intAt && owedInt > 0 ? Math.max(10, Math.min(100 - fl, owedInt / bz * 100)) : 0;
      return `<span class="sd-brick${got >= bz - 1e-9 ? ' full' : ''}${pend > got ? ' plan' : ''}"><i style="width:${fl.toFixed(1)}%"></i>${red ? `<u style="left:${Math.min(fl, 100 - red).toFixed(1)}%;width:${red.toFixed(1)}%"></u>` : ''}</span>`;
    }).join('');
  }
  const perPlan = w.loan.weekly + extra * (1 + b);
  const free = perPlan > 0 && left > 0 ? sdMonthYear(c.wk, Math.ceil(left / perPlan)) : '—';
  const rate = sdRule(r, 'loan.ratePct'), every = sdRule(r, 'loan.interestEverySundays');
  const nLoans = facts.rows.filter(x => x.left > 0).length;
  const maxA = d.scaleMax || Math.max(20, Math.ceil((Math.max(w.pots.ready + w.pots.goal, w.pots.gic, w.pots.stock) + P.hers + 1) / 10) * 10);
  const safety = sdRule(r, 'pots.safety');
  const aR = money2(w.pots.ready - (w.pull.ready || 0) + sdVal(c, 'ready'));
  const aG = money2(w.pots.gic - (P.matured || 0) + d.alloc.gic), aS = money2(w.pots.stock + d.alloc.stock);
  const goalNow = w.pots.goal, goalTo = money2(goalNow + d.alloc.goal);
  const ownNow = money2(w.pots.ready + w.pots.goal + w.pots.gic + w.pots.stock);
  const ownAfter = money2(aR + goalTo + aG + aS);
  const arow = (id, name, a0, a1) => {
    const dd = money2(a1 - a0), up = dd >= 0;
    const shut = (id === 'gic' || id === 'stock') && !sdIsOpen(id, w, r);
    return `<div class="sd-own${shut ? ' dim' : ''}">
        <span class="sd-own-name">${escapeHtml(name)}</span>
        <span class="sd-ownbar">${id === 'ready' ? `<span class="sd-safe" style="left:${Math.min(100, safety / maxA * 100).toFixed(1)}%"></span>` : ''}<i class="now" style="width:${Math.min(100, (up ? a0 : a1) / maxA * 100).toFixed(1)}%"></i><i class="${up ? 'plan' : 'out'}" style="width:${Math.min(100, Math.abs(dd) / maxA * 100).toFixed(1)}%"></i></span>
        <b class="sd-own-d${up ? ' sd-green' : ' sd-red'}">${dd > 0 ? '+' + sdM(dd) : dd < 0 ? sdM(dd) : ''}</b><b class="sd-own-v">${escapeHtml(sdM(a1))}</b></div>`;
  };
  const club = mnyClubOwes(c.kid);
  const clubA = money2(club.amount + c.f.b.sessionsPaid);
  // 🎯 The chosen jar's own figures (Plan v17 item 4): its saved and its
  // price, never every jar summed. The sign still fills jars nearest first.
  const g = c.f.chosen;
  const gSaved = g ? mnyGoalJarValue(c.kid, g) : 0;
  const gPrice = g ? money2(g.target) : 0;
  const gTo = g ? money2(Math.min(gPrice, gSaved + d.alloc.goal)) : 0;
  const goalMore = c.f.goals.length > 1 ? `<button type="button" class="sd-ask-q sd-goalmore" data-mny-action="sd-goalmenu" aria-label="Which goal this card shows"><span>⋯</span></button>` : '';
  const loanPicked = d.pick === 'extra' || d.pick === 'fixed';
  return `<div class="sd-sidehead">${escapeHtml(words >= 3 ? '💼 Assets & debt' : '💼 What I have & owe')}</div>
    <div class="sd-panel sd-wall${hot('loan') ? ' hot' : ''}${loanPicked ? ' picked' : ''}">${burst('loan')}
      <div class="sd-panel-head"><span class="sd-panel-title">${escapeHtml(words >= 3 ? '🧱 Debt' : '🧱 What I owe')}</span><b class="sd-violet">${escapeHtml(payNow ? `${sdM(left)} → ${sdM(oweAfter)}` : sdM(left))}</b></div>
      ${PR > 0 ? `<div class="sd-bricks" role="img" aria-label="${escapeAttr(Math.round(sdPaidPct(w.loan)) + '% of the loan paid')}">${bricks}</div>` : '<div class="sd-note">Nothing to pay back.</div>'}
      <span class="sd-line sd-teal">${escapeHtml(`🟩 paid · 🟨 this plan · free by ${free}${nLoans ? ` · ${nLoans} loan${nLoans === 1 ? '' : 's'}` : ''}`)}</span>
      <span class="sd-line">📌 <b>${escapeHtml(sdM(P.minNow))}</b> must pay${extra ? ` + 🧱 <b>${escapeHtml(sdM(extra))}</b> extra (counts <b>${escapeHtml(sdM(extra * (1 + b)))}</b>)` : ''}</span>
      <span class="sd-line sd-red">${escapeHtml(facts.lastInterest > 0 ? `🟥 +${sdM(facts.lastInterest)} interest added (${rate}% a year, every ${every} Sundays)` : `🟥 ${rate}% a year interest, added every ${every} Sundays`)}</span>
    </div>
    <div class="sd-panel sd-ownbox${['ready', 'gic', 'stock', 'goal'].some(hot) && hk ? ' hot' : ''}">${burst('ready') || burst('gic') || burst('stock')}
      <div class="sd-panel-head"><span class="sd-panel-title">${escapeHtml(words >= 3 ? '✅ Assets' : '✅ What I own')}</span><b class="sd-teal">${escapeHtml(ownNow === ownAfter ? sdM(ownNow) : `${sdM(ownNow)} → ${sdM(ownAfter)}`)}</b></div>
      <div class="sd-key"><span><i class="sd-sw now"></i>now</span><span><i class="sd-sw plan"></i>this plan</span><span><i class="sd-sw out"></i>taken out</span><span><i class="sd-sw safe"></i>$${safety} safety</span></div>
      ${arow('ready', '🏦 Savings', money2(w.pots.ready + goalNow), money2(aR + goalTo))}
      ${arow('gic', '🔒 Locked away', w.pots.gic, aG)}
      ${arow('stock', '📈 Companies', w.pots.stock, aS)}
      <div class="sd-line sd-teal">${escapeHtml(`${aR >= safety ? `$${safety} safety + ${sdM(aR - safety)} I can use` : `fill Savings to $${safety} first`}${goalTo > 0 ? ` · 🎯 goal jar${c.f.goals.length > 1 ? 's' : ''} ${sdM(goalTo)} counted in the total` : ''}${clubA > 0 ? ` · 🧾 Club owes me ${sdM(clubA)}` : ''}`)}</div>
    </div>
    <div class="sd-panel sd-panel--pink sd-goaljar${hot('goal') ? ' hot' : ''}">${burst('goal')}
      <span class="sd-jar" aria-hidden="true"><i class="to" style="height:${gPrice ? Math.min(100, gTo / gPrice * 100).toFixed(1) : 0}%"></i><i class="now" style="height:${gPrice ? Math.min(100, gSaved / gPrice * 100).toFixed(1) : 0}%"></i></span>
      <div class="sd-jar-body">
        <span class="sd-jar-head"><span class="sd-panel-title sd-jar-title">${escapeHtml(g ? (g.icon || '🎯') + ' ' + g.name : '🎯 No goal yet')}</span>${goalMore}</span>
        <b class="sd-red">${escapeHtml(g ? (gSaved === gTo ? `${sdM(gTo)} of ${sdM(gPrice)}` : `${sdM(gSaved)} → ${sdM(gTo)} of ${sdM(gPrice)}`) : '')}</b>
        <span class="sd-note">${escapeHtml(!g ? '＋ on My money asks my parents for one' : !sdIsOpen('ready', w, r) ? `🔒 Goal jars open with Savings, at ${sdRule(r, 'school.stagePct.ready')}% paid` : gTo >= gPrice ? '🎉 reached! ask parents' : `${sdM(gPrice - gTo)} to go · earns nothing`)}</span>
      </div>
    </div>`;
}

/* ── Step 4 · Signed (Plan v17 §4, Stage 6h) ──
   The step header (no fill): ✍️ title, who signed and when, the money week,
   the MY PLAN stamp, the sticker and ↺ Redo (this girl only). Then
   ⇅ Money in & out with the two verdicts (two lines + ▸ Why in a sheet),
   📉 What I owe vs what I own (`sdOweOwnChart`), and Say it out loud. No
   bottom row: the girl switch and the meeting's steps are in the head. */
function sdSignedFromLedger(kid, wk) {
  const row = (((state.shared.chore.moneyLedger || {})[wk] || {})[kid]) || null;
  if (!row || !row.sunday) return null;
  return { signed: row.sunday.signed, after: row.sunday.after, crossed: row.sunday.crossed, w: row.sunday.w };
}
/* The verdict's two lines on the card; the full working is behind ▸ Why. */
function sdVerdictSummary(k, v, sg) {
  if (k === 'income') {
    const bonus = money2((sg.inBonus || 0) + (sg.inBank || 0));
    const h = (sg.hist || []), avg = h.length ? h.reduce((a, x) => a + x, 0) / h.length : 0;
    return (bonus > 0.004 ? `${sdM(bonus)} came from competitions, gifts and my bank.` : 'All of it came from steady work.')
      + (avg > 0 ? ` My usual week is about ${sdD(Math.round(avg))}.` : '');
  }
  return v.why;
}
function sdOpenVerdict(c, key) {
  const s = c.d.signed;
  if (!s || !s.signed) return;
  const v = sdVerdicts({ signed: s.signed, after: Object.assign({ pots: s.after.pots, left: s.after.left, loan: s.after.loan }, s.after) },
    Object.assign({}, s.w, { alloc: {} }), c.rules)[key];
  sdSheetOpen(v.head, `<div class="sd-whylist">${v.lines.map(t => `<div>${escapeHtml(t)}</div>`).join('')}</div>`);
}
function sdSignedMain(c) {
  const d = c.d, s = d.signed;
  if (!s || !s.signed) {
    return `<div class="sd-title">✍️ Settled without a sign</div>
      <div class="sd-line">A parent entered this week, or the Grandfather rule paid it. The passbook on My money has it.</div>`;
  }
  const sg = s.signed, w = Object.assign({}, s.w, { alloc: {} }), r = c.rules;
  const res = { signed: sg, after: Object.assign({ pots: s.after.pots, left: s.after.left, loan: s.after.loan }, s.after) };
  const v = sdVerdicts(res, w, r);
  const words = c.words;
  const incT = money2(sg.inSteady + sg.inBonus + sg.inBank) || 1;
  const L = sg.lines || [];
  const g = sdGroupNames(words);
  const amt = keys => money2(L.filter(x => keys.indexOf(x[0]) >= 0).reduce((a, x) => a + x[2], 0));
  const home = amt(['jobs', 'streak']), club = amt(['pa']), comp = amt(['comp']), gifts = amt(['gifts']);
  const row = ((((state.shared.chore.moneyLedger || {})[c.wk] || {})[c.kid]) || {});
  const made = money2(Math.max(0, Number((row.groups || {}).made != null ? row.groups.made : row.passive) || 0));
  const inRows = [];
  const add = (k, val, cls, o) => inRows.push(Object.assign({ k, v: val, cls }, o || {}));
  const earnedT = money2(home + club + comp);
  if (earnedT > 0.004) {
    add(g.earned, earnedT, 'earned', { head: true, nobar: true });
    [['🏠 Home', home], ['⛸️ Club job', club], ['🏆 Competitions', comp]].forEach(([k, x]) => { if (x > 0.004) add(k, x, 'earned', { sub: true }); });
  }
  if (gifts > 0.004) add(g.given, gifts, 'given', { head: true });
  if (made > 0.004) add('🌱 My money made', made, 'made', { head: true, nopct: true });
  if (sg.inBank > 0.004) add('📥 From my bank', sg.inBank, 'bank', { head: true });
  const lockW = sdRule(r, 'pots.lockWeeks');
  const cashOut = money2(sg.wallet - (sg.adv || 0));
  const goalName = (w.goal && w.goal.name) || '🎯 Goal';
  const outList = [['📦 Fine', -(sg.outFine || 0), 'fine'], ['⏪ Drawn early', sg.adv || 0, 'adv'],
    [sg.extra ? `🧱 Loan · counts ${sdM(sg.pay)}` : '🧱 Loan', sg.loanCash, 'wall'], ['💵 Cash out', cashOut, 'cash'],
    ['🏦 Savings', sg.ready, 'saved'], [goalName, sg.goal || 0, 'goal', true],
    [`🔒 Locked · back ${sdShortDay(sdLockMaturesOn(c.wk, lockW))}`, sg.gic, 'locked'], ['📈 Companies', sg.stock, 'stock']]
    .filter(x => x[1] > 0.004);
  const mx = Math.max(0.01, ...inRows.filter(x => !x.nobar).map(x => x.v), ...outList.map(x => x[1]));
  const pc = val => Math.round(val / incT * 100) + '%';
  const flow = (k, val, cls, dir, o) => `<div class="sd-flow${o.head ? ' head' : ''}${o.sub ? ' sub' : ''}">
      <span class="sd-flow-k">${escapeHtml(k)}</span>
      <span class="sd-flow-out">${dir < 0 ? `<i class="sd-fill--${cls}" style="width:${(val / mx * 100).toFixed(1)}%"></i>` : ''}</span>
      <span class="sd-flow-in">${dir > 0 && !o.nobar ? `<i class="sd-fill--${cls}" style="width:${(val / mx * 100).toFixed(1)}%"></i>` : ''}</span>
      <span class="sd-flow-pct">${o.nopct ? '' : pc(val)}</span><b${o.off ? ' class="sd-red"' : ''}>${escapeHtml(o.off ? sdOff$(val) : sdM(val))}</b></div>`;
  const io = sdCheckInOut(sg);
  const tone = { good: 'good', warn: 'warn', bad: 'bad', neutral: 'neutral' };
  const verdict = (k, x) => `<div class="sd-verdict ${'sd-verdict--' + (tone[x.tone] || 'neutral')}"><b>${escapeHtml(x.head)}</b>
      <span>${escapeHtml(sdVerdictSummary(k, x, sg))}</span>
      ${x.lines.length ? `<button type="button" class="sd-btn sd-more" data-mny-action="sd-verdict" data-sd-v="${k}">▸ Why</button>` : ''}</div>`;
  const milestone = s.crossed ? `<div class="sd-milestone">${escapeHtml(`🔓 ${sdRule(r, 'school.stagePct.' + SD_GATE_STAGE[s.crossed])}% paid back! "${{ ready: 'Savings', gic: 'Locked away', stock: 'Companies' }[s.crossed]}" is open. Next Sunday I can put money there.`)}</div>` : '';
  const stick = (sg.stickers || sdStickersFor(sg)).map(id => SD_STICKERS.find(x => x[0] === id)).filter(Boolean);
  const say = `I put ${sdM(sg.loanCash)} on my loan${sg.extra ? ` (it counted as ${sdM(sg.pay)})` : ''}, so I owe ${sdM(s.after.left)} now. ${sdM(money2(sg.ready + (sg.goal || 0) + sg.gic + sg.stock))} is saved${cashOut > 0 ? ` and ${sdM(cashOut)} comes out as cash today` : ', and no cash this week'}.`;
  const redo = isParent() && mmUndoHeld(c.kid);
  const gone = mmUndoKidGone[c.kid];
  const at = Number(row.updatedAt || row.at) || 0;
  const when = at ? new Date(at) : null;
  const signedLine = `✓ signed ${mnyDayName(sdSundayOf(c.wk))}${when ? ' · ' + when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase() : ''}`;
  const nSigned = mnyLedgerRows(c.kid).filter(x => x && x.sunday && String(x.weekKey) <= String(c.wk)).length;
  const weekLine = `money week ${mrMoneyWeekLabel(c.wk, c.kid)} · Week ${Math.max(1, nSigned)}`;
  return `<div class="sd-sighead">
      <div class="sd-sighead-text">
        <span class="sd-title">✍️ Signed. This is my plan.</span>
        <span class="sd-sigwho"><span class="sd-sigpic" aria-hidden="true">${CT_PROFILE_ICON[c.kid]}</span><b>${escapeHtml(c.name)}</b><span class="sd-green">${escapeHtml(signedLine)}</span></span>
        <span class="sd-note">${escapeHtml(weekLine)}</span>
      </div>
      <span class="sd-stamp">MY PLAN</span>
      <div class="sd-sighead-side">
        <span class="sd-sticker"><b>⭐ Sticker:</b> ${escapeHtml(stick.length ? stick.map(x => x[1] + ' ' + x[2]).join(' · ') : 'none this week')}</span>
        ${redo ? '<button type="button" class="sd-btn" data-mny-action="sd-redo">↺ Redo my plan</button>'
          : (gone && gone.wk === c.wk ? `<span class="sd-note">${escapeHtml(MM_UNDO_GONE_SENTENCE)}</span>` : '')}
      </div>
    </div>
    ${milestone}
    <div class="sd-inout">
      <div class="sd-inout-head"><span class="sd-box-title">${escapeHtml(words >= 2 ? '⇅ Cash flow' : '⇅ Money in & out')}</span><span class="sd-note">where every dollar came from and went</span></div>
      <div class="sd-inout-part">
        <div class="sd-flows">
          <div class="sd-flow sd-flow--title"><span class="sd-box-title">💰 Money in</span><span class="sd-note">◀ out</span><span class="sd-note">in ▶</span><span></span><b class="sd-teal">${escapeHtml(sdM(io.in))}</b></div>
          ${inRows.map(x => flow(x.k, x.v, x.cls, 1, x)).join('')}
        </div>
        ${verdict('income', v.income)}
      </div>
      <div class="sd-dash"></div>
      <div class="sd-inout-part">
        <div class="sd-flows">
          <div class="sd-flow sd-flow--title"><span class="sd-box-title">💸 Money out</span><span></span><span></span><span></span><b>${escapeHtml(sdM(io.out))}${io.ok ? ' ✓' : ''}</b></div>
          ${outList.map(x => flow(x[0], x[1], x[2], -1, { sub: !!x[3], off: x[2] === 'fine' || x[2] === 'adv' })).join('')}
        </div>
        ${verdict('strategy', v.strategy)}
      </div>
    </div>
    ${sdOweOwnChart(c, sg, s)}
    <div class="sd-say">Say it out loud: “${escapeHtml(say)}”</div>`;
}
/* 📉 What I owe vs what I own — the line chart (Plan v17 §4). Past points
   from the frozen ledger: loan left after each Sunday (`debtBalanceAfter`)
   and what she owned after it (`ownedAfter`, written at the sign from this
   build on); a row without both is left out. The signed point is today's
   sign; the dashed forecast and the label thinning are the core's
   (`sdOweOwnSeries`, `sdThinLabels`). */
function sdOweOwnRows(kid, wk) {
  return mnyLedgerRows(kid).filter(r => String(r.weekKey) < String(wk)).reverse().map(r => ({
    weekKey: r.weekKey,
    owed: r.debtBalanceAfter != null ? Number(r.debtBalanceAfter) : null,
    owned: r.ownedAfter != null ? Number(r.ownedAfter) : null,
  }));
}
function sdOweOwnChart(c, sg, s) {
  const b = sdBonusRate(c.rules);
  const pots = s.after.pots || {};
  const own0 = money2((pots.ready || 0) + (pots.goal || 0) + (pots.gic || 0) + (pots.stock || 0));
  const pay = money2((sg.mustPay || sg.minW || 0) + (sg.extra || 0) * (1 + b));
  const save = money2((sg.ready || 0) + (sg.goal || 0) + (sg.gic || 0) + (sg.stock || 0));
  const all0 = sdOweOwnRows(c.kid, c.wk);
  const ser = sdOweOwnSeries(all0, { weekKey: c.wk, owed: s.after.left, owned: own0 }, pay, save);
  const skipped = all0.filter(r => r.owed == null || r.owned == null).length;
  const sun = (wk, k) => mnyDayMonth(sdDayKeyAdd(sdSundayOf(wk), 7 * k));
  const pts = [...ser.past.map((p, i) => ({ owe: p.owed, own: p.owned, label: i === ser.past.length - 1 ? 'signed ✓' : mnyDayMonth(sdSundayOf(p.weekKey)) })),
    ...ser.forecast.points.map((p, i) => ({ owe: p[0], own: p[1], f: true, label: sun(c.wk, i + 1) }))];
  if (ser.forecast.toFree) pts[pts.length - 1].label = 'free by ' + pts[pts.length - 1].label;
  const pi = ser.past.length - 1;
  const W = 744, H = 104, Lm = 44, Rm = 64, T = 8, B = 22;
  const max = Math.max(200, Math.ceil(Math.max(...pts.map(p => Math.max(p.owe, p.own))) / 200) * 200);
  const x = i => Lm + (pts.length > 1 ? i * (W - Lm - Rm) / (pts.length - 1) : 0);
  const y = v => T + (1 - v / max) * (H - T - B);
  let g = '';
  for (let v = 0; v <= max; v += max / 4) g += `<line x1="${Lm}" x2="${W - Rm}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="sd-nw-grid"/><text x="${Lm - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="sd-nw-tick">$${Math.round(v)}</text>`;
  g += `<rect x="${x(pi).toFixed(1)}" y="${T}" width="${Math.max(0, x(pts.length - 1) - x(pi)).toFixed(1)}" height="${H - T - B}" class="sd-nw-future"/>`;
  const past = pts.slice(0, pi + 1);
  if (past.length > 1) {
    const area = past.map((p, i) => `${x(i).toFixed(1)},${y(p.owe).toFixed(1)}`).join(' ') + ' ' + past.slice().reverse().map((p, i) => `${x(pi - i).toFixed(1)},${y(p.own).toFixed(1)}`).join(' ');
    g += `<polygon points="${area}" class="sd-nw-gap"/>`;
  }
  const line = (from, to, k, cls) => `<polyline points="${pts.slice(from, to + 1).map((p, i) => `${x(from + i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ')}" class="${cls}"/>`;
  g += line(0, pi, 'owe', 'sd-nw-owe') + line(0, pi, 'own', 'sd-nw-own') + line(pi, pts.length - 1, 'owe', 'sd-nw-owe dash') + line(pi, pts.length - 1, 'own', 'sd-nw-own dash');
  const show = sdThinLabels(pts.length, [pi, pts.length - 1], SD_CHART_LABELS);
  pts.forEach((p, i) => {
    const f = i > pi, me = i === pi;
    g += `<circle cx="${x(i).toFixed(1)}" cy="${y(p.owe).toFixed(1)}" r="${me ? 5 : 3}" class="sd-nw-dot owe${f ? ' f' : ''}"/><circle cx="${x(i).toFixed(1)}" cy="${y(p.own).toFixed(1)}" r="${me ? 5 : 3}" class="sd-nw-dot own${f ? ' f' : ''}"/>`;
    if (show.indexOf(i) >= 0) g += `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${i === pts.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'}" class="sd-nw-label${me ? ' me' : f ? ' f' : ''}${i === pts.length - 1 && ser.forecast.toFree ? ' free' : ''}">${escapeHtml(p.label)}</text>`;
  });
  const lx = x(pts.length - 1) + 6, ld = pts[pts.length - 1];
  // The two end labels never sit on top of each other: owe above, own below.
  let yo = y(ld.owe) + 4, yw = y(ld.own) + 4;
  if (Math.abs(yo - yw) < 13) { const mid = (yo + yw) / 2, up = ld.owe >= ld.own; yo = mid + (up ? -7 : 7); yw = mid + (up ? 7 : -7); }
  g += `<text x="${lx.toFixed(1)}" y="${yo.toFixed(1)}" class="sd-nw-end owe">$${Math.round(ld.owe)}</text><text x="${lx.toFixed(1)}" y="${yw.toFixed(1)}" class="sd-nw-end own">$${Math.round(ld.own)}</text>`;
  g += `<text x="${W - Rm - 4}" y="${T + 12}" text-anchor="end" class="sd-nw-note">${escapeHtml(ser.forecast.toFree ? 'dashed: to the Sunday the loan is free' : 'dashed: next 6 Sundays, if every week is like this')}</text>`;
  const now = pts[pi];
  const gapText = `gap $${Math.round(Math.abs(now.owe - now.own))}`;
  const lines = [[0, pi], [pi, pts.length - 1]].flatMap(([a, b]) => ['owe', 'own'].map(k => pts.slice(a, b + 1).map((p, j) => [x(a + j), y(p[k])])));
  const spot = pi < 1 ? null : sdGapLabelSpot(pts.slice(0, pi + 1).map((p, i) => ({ x: x(i), owe: y(p.owe), own: y(p.own) })), lines,
    { w: gapText.length * 6.6, h: 12 }, { l: Lm, r: W - Rm, t: T, b: H - B });
  if (spot) g += `<text x="${spot.x.toFixed(1)}" y="${(spot.y + 4).toFixed(1)}" text-anchor="middle" class="sd-nw-gaplabel">${escapeHtml(gapText)}</text>`;
  if (ser.hidden > 0) g += `<text x="${Lm}" y="${T + 12}" class="sd-nw-note">◀ ${ser.hidden} older Sunday${ser.hidden === 1 ? '' : 's'} in 📒</text>`;
  const note = skipped ? `${skipped} older Sunday${skipped === 1 ? '' : 's'} signed before this chart kept these figures ${skipped === 1 ? 'is' : 'are'} left out.` : '';
  return `<div class="sd-nw" data-sd-forecast="${ser.forecast.toFree ? 'free' : 'six'}:${ser.forecast.n}">
      <div class="sd-nw-head"><span class="sd-box-title">📉 What I owe vs what I own</span>
        <span class="sd-nw-key"><i class="owe"></i>owe <i class="own"></i>own</span>${note ? `<span class="sd-note sd-nw-skip">${escapeHtml(note)}</span>` : ''}</div>
      <svg class="sd-nw-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeAttr(`What I owe and what I own over the last ${ser.past.length} Sundays and ${ser.forecast.toFree ? 'until the loan is free' : 'the next 6'}`)}">${g}</svg>
    </div>`;
}
/* The right side: 📅 My timeline as the prototype (event icons, stacked
   bars — earned below, given on top —, the dashed future and the avg line)
   and 🔮 If every week is like this (only "This week I earned" bordered;
   🧱 I owe directly on top of ✅ I own, one filled block). */
function sdSignedSide(c) {
  const d = c.d, s = d.signed;
  if (!s || !s.signed) return '';
  const sg = s.signed, r = c.rules;
  const hist = c.f.hist;
  const L = sg.lines || [];
  const lineAmt = keys => money2(L.filter(x => keys.indexOf(x[0]) >= 0).reduce((a, x) => a + x[2], 0));
  const earnedOf = h => money2(h.steady + (h.comp || 0));
  const steadyAvg = hist.length ? hist.reduce((a, x) => a + earnedOf(x), 0) / hist.length : sg.inSteady;
  const exp = mnyEnsureExpected(c.kid);
  const months = Array.from({ length: 5 }, (_, i) => {
    const dd = formatDayKey(String(sdSundayOf(c.wk)).slice(0, 8) + '01'); dd.setMonth(dd.getMonth() + i + 1);
    const key = ctDateToKey(dd).slice(0, 7);
    const evs = exp.filter(e => e && e.month === key);
    const comps = rqPlannedInMonth(c.kid, key).filter(p => p.st === 'soon').length;
    return { k: MONTH_SHORT[dd.getMonth()], st: steadyAvg, bn: money2(evs.reduce((a, e) => a + money2(e.amount), 0)),
             ev: (comps ? '🏆' : '') + evs.map(e => String(e.label || '').split(' ')[0]).join(''), kind: 'fut' };
  });
  const rows = [...hist.map((x, i) => ({ k: ['4 wk', '3 wk', '2 wk', 'last'][i + 4 - hist.length], st: earnedOf(x), bn: x.given || 0, ev: x.comp > 0 ? '🏆' : '', kind: 'past' })),
    { k: 'now', st: lineAmt(['jobs', 'streak', 'pa', 'comp']), bn: lineAmt(['gifts']), ev: lineAmt(['comp']) > 0 ? '🏆' : '', kind: 'now' }, ...months];
  const tMax = Math.max(1, ...rows.map(x => x.st + x.bn)) * 1.05;
  const avgW = hist.length ? hist.reduce((a, x) => a + earnedOf(x) + (x.given || 0), 0) / hist.length : 0;
  const tl = rows.map(x => `<div class="sd-tl-col ${x.kind}"><span class="sd-tl-bars">${x.bn > 0 ? `<i class="bn" style="height:${(x.bn / tMax * 100).toFixed(1)}%"></i>` : ''}<i class="st${x.bn > 0 ? '' : ' top'}" style="height:${(x.st / tMax * 100).toFixed(1)}%"></i></span></div>`).join('');
  const fw = sdForecast({ signed: sg, after: s.after }, Object.assign({}, s.w), r, d.tmW || 4);
  const choices = [[1, '1 wk'], [4, '1 mo'], [20, '5 mo']].map(([n, l]) => `<button type="button" class="sd-btn${(d.tmW || 4) === n ? ' on' : ''}" data-mny-action="sd-tm" data-sd-n="${n}">${l}</button>`).join('');
  return `<div class="sd-panel sd-tlcard">
      <div class="sd-panel-head"><span class="sd-panel-title">📅 My timeline</span>
        <span class="sd-key"><span><i class="sd-sw st"></i>earned</span><span><i class="sd-sw bn"></i>given</span><span><i class="sd-sw avg"></i>avg</span></span></div>
      <div class="sd-tl-ev">${rows.map(x => `<span>${escapeHtml(x.ev)}</span>`).join('')}</div>
      <div class="sd-tl">${hist.length ? `<span class="sd-tl-avg" style="bottom:${(avgW / tMax * 100).toFixed(1)}%"><span>avg ${escapeHtml(sdM(avgW))}</span></span>` : ''}${tl}</div>
      <div class="sd-tl-k">${rows.map(x => `<span class="${x.kind}">${escapeHtml(x.k)}</span>`).join('')}</div>
    </div>
    <div class="sd-panel sd-ifcard">
      <div class="sd-panel-title sd-if-title">🔮 If every week is like this</div>
      <div class="sd-tm">${choices}</div>
      <div class="sd-fw-earn"><span>💰 This week I earned</span><b>${escapeHtml(fw.fwEarn)}</b><span class="sd-note">${escapeHtml(fw.fwTimes)}</span><b class="sd-red">${escapeHtml(fw.fwEarnT)}</b></div>
      <div class="sd-fw-block">
        <div class="sd-fw-owe">
          <div class="sd-panel-head"><span>🧱 I owe</span><span class="sd-note sd-teal">${escapeHtml(fw.fwFree)}</span></div>
          <span class="sd-note">${escapeHtml(fw.fwAssume)}</span>
          ${fw.fwLoan.map(x => `<div class="sd-fw-loan"><span>${escapeHtml(x.k)}</span><span class="sd-bar"><i style="width:${Math.min(100, x.w).toFixed(1)}%"></i></span><b>${escapeHtml(x.v)}</b></div>`).join('')}
        </div>
        <div class="sd-fw-own">
          <div class="sd-fw-save head"><span>✅ I own</span><span>I put in</span><span>it earns</span><span>then</span></div>
          ${fw.fwSave.map(x => `<div class="sd-fw-save${x.locked ? ' dim' : ''}${x.key === 'goal' ? ' sub' : ''}"><span class="sd-fw-name">${escapeHtml(x.k)}</span><span>${escapeHtml(x.put)}</span><span class="sd-teal">${escapeHtml(x.earn)}</span><b>${escapeHtml(x.then)}</b></div>`).join('')}
          <div class="sd-fw-save total"><b>= Total</b><b>${escapeHtml(fw.fwPutT)}</b><b class="sd-teal">${escapeHtml(fw.fwEarnI)}</b><b>${escapeHtml(fw.fwThenT)}</b></div>
        </div>
      </div>
      <div class="sd-note">${escapeHtml(fw.fwNote)}</div>
    </div>
    ${isParent() ? sdLastAnswerCard(c.kid, c.wk) : ''}`;
}
/* 💬 "Her answer last week" (owner's review G1-13), for Dad beside her new
   plan: what last week's money was for, in her words. An old plan kept its
   answer to "What is this money for?" (`reflect`); a Sunday plan kept the
   start she picked, and the three starts ARE those three answers (the same
   ids in MNY_REFLECT); a plan placed box by box says so. */
function sdLastAnswer(kid, wk) {
  const prev = mnyPreviousPlan(wk, kid);
  if (!prev) return null;
  const id = prev.reflect || prev.presetId || null;
  const chip = id ? MNY_REFLECT.chips.find(x => x.id === id) : null;
  return {
    said: chip ? chip.label : (prev.reflect || (prev.planId === 'sunday' ? 'She placed it herself, box by box.' : null)),
    guess: prev.guess != null ? prev.guess : null,
  };
}
function sdLastAnswerCard(kid, wk) {
  const a = sdLastAnswer(kid, wk);
  if (!a || !a.said) return '';
  return `<div class="sd-panel">
      <div class="sd-panel-head"><span class="sd-panel-title">💬 Her answer last week</span><span class="sd-note">for parents</span></div>
      <div class="sd-line">${escapeHtml(MNY_REFLECT.question)} “${escapeHtml(a.said)}”${a.guess != null ? escapeHtml(` · she guessed $${a.guess}`) : ''}</div>
      <div class="sd-note">Ask: did this week's plan match it?</div>
    </div>`;
}

/* ── 🆕 A new row on her wall (a commitment or a surprise cost since her
   last signed Sunday — read from the debts, no store of its own) ── */
function sdNewRowCard(c) {
  const row = sdNewRows(c.kid, c.wk)[0];
  if (!row) return '';
  const isSur = row.icon === '🌧️';
  const steady = guSteady(c.kid);
  const p1 = money2(mnyOpenDebtsOldestFirst(c.kid).reduce((a, x) => a + mnyWeeklyDue(x), 0));
  const p0 = money2(p1 - mnyWeeklyDue(row));
  const pct = v => steady > 0 ? Math.round(v / steady * 100) : 0;
  const left = mnyTotalOwing(c.kid);
  const lines = isSur
    ? [['I had to borrow', sdM(row.principal), 'red'], ['Savings now', sdM(mnySavedTotal(c.kid)), '']]
    : [['10% down from my 🏦 Savings', sdM(row.paid), ''], ['My loan payment a week', `${sdM(p0)} → ${sdM(p1)}`, ''],
       ['Part of my steady money', `${pct(p0)}% → ${pct(p1)}%`, pct(p1) > 50 ? 'red' : 'teal'],
       ['Left for me to choose a week', `${sdM(steady - p0)} → ${sdM(steady - p1)}`, ''],
       ['This row is paid off by', mnyWeeklyDue(row) > 0 ? sdMonthYear(c.wk, Math.ceil(loanBalance(c.kid, row.id) / mnyWeeklyDue(row))) : '—', ''],
       ['All my loans free by', p1 > 0 ? sdMonthYear(c.wk, Math.ceil(left / p1)) : '—', '']];
  const over = !isSur && pct(p1) > 50;
  /* 💡 Does it earn back? (owner's review S8-4, the prototype's line): her
     meets' average pay over her last Sundays, and how many meets pay the
     row back. */
  const meets = c.f.hist.map(h => h.comp).filter(v => v > 0);
  const meetAvg = meets.length ? money2(meets.reduce((a, v) => a + v, 0) / meets.length) : 0;
  const payback = isSur ? '' : `<div class="sd-newrow-payback">${escapeHtml(meetAvg > 0
    ? `💡 Does it earn back? My competitions pay me about ${sdM(meetAvg)} each. This row is paid back by about ${Math.ceil(money2(row.principal) / meetAvg)} competitions.`
    : '💡 Does it earn back? No competition has paid me in my last Sundays yet, so my steady money pays it back.')}</div>`;
  // How could I get back under half? — the prototype's three ideas.
  const rate = sdRule(c.rules, 'sessions.perSession');
  const choresAvg = c.f.hist.length ? c.f.hist.reduce((a, h) => a + money2((h.row || {}).chores), 0) / c.f.hist.length : 0;
  const choresMax = sdRule(c.rules, 'chores.dailyCap') * 5;
  const ideas = [['club', `⛸️ One more club session → ${steady + rate > 0 ? Math.round(p1 / (steady + rate) * 100) : 0}%`, false],
    ['chores', choresAvg >= choresMax ? `🧹 More chores · already at ${sdM(choresMax)}` : '🧹 More chores', choresAvg >= choresMax],
    ['dad', '👨 Ask parents: smaller share or longer time', false]];
  const verdict = isSur ? `My safety money wasn't enough, so ${sdM(row.principal)} went on my wall. 🏦 Savings fills first until it's back to $${sdRule(c.rules, 'pots.safety')}.`
    : over ? `⚠️ My loan takes ${pct(p1)}% of my steady money, more than half. My parents' limit is 50%.` : '✅ Still under half of my steady money. My parents\' limit is 50%.';
  return `<div class="sd-scrim"><div class="sd-newrow" role="dialog" aria-modal="true" aria-label="${escapeAttr(isSur ? 'A surprise cost' : 'New row on my wall')}">
      <div class="sd-title">${isSur ? '🌧️ A surprise cost' : '🆕 New row on my wall'}</div>
      <div class="sd-newrow-what">${escapeHtml(row.name + ' · ' + sdM(row.principal) + ' added')}</div>
      ${lines.map(([k, v, cls]) => `<div class="sd-newrow-line"><span>${escapeHtml(k)}</span><b class="${cls ? 'sd-' + cls : ''}">${escapeHtml(v)}</b></div>`).join('')}
      <div class="sd-newrow-verdict${over || isSur ? ' warn' : ''}">${escapeHtml(verdict)}</div>
      ${payback}
      ${over ? `<div class="sd-q">How could I get back under half?</div>
        <div class="sd-ideas">${ideas.map(([id, label, dis]) => `<button type="button" class="sd-chip${c.d.newIdea === id ? ' on' : ''}${dis ? ' lock' : ''}" data-mny-action="sd-newidea" data-sd-id="${id}" aria-pressed="${c.d.newIdea === id}">${escapeHtml(label)}</button>`).join('')}</div>` : ''}
      <button type="button" class="sd-go" data-mny-action="sd-newok" data-sd-id="${escapeAttr(row.id)}">I understand →</button>
    </div></div>`;
}

/* ── 🗣️ Dad's card (a sheet: ASK / SAY / WAIT for the step) ── */
function sdDadScript(c) {
  const P = c.P, hist = c.f.hist;
  const lastWeek = hist.length ? Math.round(hist[hist.length - 1].inAmt) : 0;
  const avg = hist.length ? hist.reduce((a, r) => a + r.inAmt, 0) / hist.length : 0;
  return [
    [...(sdSundayRoutine(c).asked ? [['ASK', "Tonight's routine still counts — it is marked for you."]] : []),
     ['ASK', 'Tick your club sessions first. That is your biggest money. Then tap the rest.'],
     ['SAY', 'Only what parents said yes to counts today. Anything still waiting stays out of your guess.'],
     ['ASK', hist.length ? `Last week was $${lastWeek}. More or less this week? Why?` : 'More or less than you think? Why?']],
    [['SAY', 'Watch the coins fall. Every line is something you did.'],
     ['ASK', `Look at the table: which line is bigger than your average (${sdM(avg)} total)?`],
     ['SAY', `The loan takes its ${sdM(P.minNow)} first — that's the deal we made.`],
     ['ASK', 'Need money from your bank, or cash from home? Use 🏦 From my bank below.']],
    [['ASK', 'What is this money for? Pick a start, or tap a box: tap again = $1, hold = $5.'],
     ['SAY', 'Watch the tile on the right glow — that is what each coin changes.'],
     ['ASK', 'The goal jar earns nothing. Why put money there instead of Savings?'],
     ['WAIT', 'Do not touch the screen. Ask "why there?" once.']],
    [['ASK', 'Say your plan back to me in one sentence.'],
     ['ASK', 'In = Out: point to where every dollar went.'],
     ['ASK', 'Tap 5 mo. When is the loan done if every week is like this?']],
  ][c.d.step];
}
function sdOpenDad() {
  sdSheet = null;
  const kid = mnyMeetingKid(), wk = mmWeekKey();
  const c = sdContext(kid, wk);
  const step = c.d.step;
  const sun = sdSundayRoutine(c);
  const check = [c.d.guess ? '✓ She picked a guess' : '○ Waiting for her guess',
    c.d.shown >= sdTiles(c).length ? '✓ Payday is all in' : '○ Let the coins finish falling',
    c.P.pile <= 0 ? '✓ 100% placed — she can sign' : `○ $${c.P.pile} still to place`,
    '✓ Done — talk about next week'][step];
  const body = document.getElementById('sundayBody');
  if (!body) return;
  // The step sits beside the title, as drawn (S3-2).
  const title = document.getElementById('sdSheetTitle');
  if (title) title.innerHTML = `<span class="sd-nowrap">🗣️ Parent's card</span> <span class="sd-dadstep">${escapeHtml(['Step 1 · Guess', 'Step 2 · Payday', 'Step 3 · Choose', 'Step 4 · Sign'][step])}</span>`;
  body.innerHTML = `<div class="sd-dadcard">
      ${sdDadScript(c).map(([k, v]) => `<div class="sd-script-line ${'sd-script-line--' + k.toLowerCase()}"><b>${k}</b>${escapeHtml(v)}</div>`).join('')}
      ${step === 0 && sun.asked ? `<div class="sd-note">${sun.premarked ? '✓ Sunday routine marked for her' : sun.done ? '✓ Sunday routine ticked' : '○ Sunday routine not ticked yet'}</div>` : ''}
      <div class="sd-teal">${escapeHtml(check)}</div>
      <button type="button" class="sd-go" data-mny-action="sd-dadclose">Back to her</button>
    </div>`;
  openSheet('sundayOverlay');
}

/* ════════════════════════════════════════════════════════════════
   ACTIONS
   ════════════════════════════════════════════════════════════════ */
function sdRerender() {
  if (typeof renderMeetingMode === 'function') renderMeetingMode();
  if (sdSheet && sdSheet.kind === 'line') sdRenderLineSheet();
}
/* After the money step is drawn: the pile's coins need the card's size. */
function sdAfterRender() { sdLayPile(); }
/* ── The step's sheet (#sundayOverlay): 🗣️ Parent's card, a payday line's
   working, a verdict's ▸ Why. One sheet, one writer of its title and body. */
function sdSheetOpen(title, html) {
  const body = document.getElementById('sundayBody');
  if (!body) return;
  const t = document.getElementById('sdSheetTitle');
  if (t) t.textContent = title;
  body.innerHTML = `${html}<button type="button" class="sd-go" data-mny-action="sd-dadclose">Back to her</button>`;
  if (!document.getElementById('sundayOverlay').classList.contains('open')) openSheet('sundayOverlay');
}
function sdOpenLine(tile, edit) {
  sdSheet = { kind: 'line', tile, edit: !!edit };
  sdRenderLineSheet();
}
function sdRenderLineSheet() {
  const ov = document.getElementById('sundayOverlay');
  if (!sdSheet || !ov) return;
  if (!ov.classList.contains('open') && sdSheet.shown) { sdSheet = null; return; }
  const c = sdContext(mnyMeetingKid(), mmWeekKey());
  const t = sdTiles(c).find(x => x.id === sdSheet.tile);
  if (!t) return;
  sdSheet.shown = true;
  sdSheetOpen(`${t.name} · ${sdM(t.amount)}`, sdTileDetail(c, sdSheet.tile, sdSheet.edit));
}
function sdSetStep(d, step) {
  d.step = step; d.tried = null;
  if (step !== 2) d.last = null;
  sdSave(d);
}
/* Coins fall a line at a time; under reduced motion they are all there at once. */
function sdStartCount(d) {
  clearInterval(sdCountTimer);
  const total = 6;
  if (sdReducedMotion()) { d.shown = total; sdSave(d); return; }
  d.shown = 0; sdSave(d);
  sdCountTimer = setInterval(() => {
    if (!(typeof mmIsOpen === 'function' && mmIsOpen()) || d.step !== 1 || d.shown >= total) { clearInterval(sdCountTimer); return; }
    d.shown++;
    sdBeep(600 + d.shown * 60);
    sdSave(d);
    sdRerender();
  }, 700);
}
function sdPlaceIn(c, k, dir, n) {
  const d = c.d;
  const r = sdPlace(Object.assign({}, c.w, { alloc: d.alloc }), k, dir, n, c.rules);
  if (!r.ok || !r.moved) { d.tried = k; sdBeep(220); sdSave(d); return false; }
  d.alloc = r.alloc; d.last = { k, n: r.moved, d: dir }; d.lastAt = Date.now(); d.presetId = null; d.tried = null; d.focus = null;
  sdSave(d);
  sdBeep(dir > 0 ? (r.moved >= 5 ? 392 : k === 'extra' ? 523 : 784) : 300);
  return true;
}
function sdHandleAction(a, el) {
  const kid = mnyMeetingKid(), wk = mmWeekKey();
  const d = sdDraftFor(kid, wk);
  const id = el.getAttribute('data-sd-id');
  const num = Number(el.getAttribute('data-sd-d')) || 0;
  if (a === 'sd-kid') { mnySetMeetKid(el.getAttribute('data-sd-kid')); return; }
  if (a === 'sd-sound') { sdToggleSound(); sdRerender(); return; }
  if (a === 'sd-dad') { sdOpenDad(); return; }
  if (a === 'sd-dadclose') { sdSheet = null; closeSheet('sundayOverlay'); return; }
  if (a === 'sd-att') {
    const s = mrSessionsWeek(wk, kid).sessions.find(x => x.blockId === el.getAttribute('data-sd-block'));
    const next = !s || s.attended == null ? true : s.attended ? false : null;
    if (mrSetSessionAttendance(kid, wk, el.getAttribute('data-sd-block'), next)) sdBeep(next == null ? 500 : 700);
    sdRerender(); return;
  }
  if (a === 'sd-sunroutine') { sdBeep(700); mmToggleAllRoutines(kid, 6); return; }
  if (a === 'sd-cat') {
    const k = el.getAttribute('data-sd-cat');
    d.cat[k] = d.cat[k] == null ? true : d.cat[k] ? false : null;
    sdBeep(d.cat[k] == null ? 500 : 700); sdSave(d); sdRerender(); return;
  }
  if (a === 'sd-guess') { d.guess = Number(el.getAttribute('data-sd-v')); sdBeep(400 + d.guess * 8); sdSave(d); sdRerender(); return; }
  if (a === 'sd-reveal') {
    if (!d.guess || sdUnsettled(kid, wk).total) { sdBeep(220); showToast(d.guess ? 'Parents answer first →' : 'Pick a guess first'); return; }
    const pct = Number(mrRuleOr(mrRulesForWeek(wk), 'market.wobblePct')) || 0;
    if (pct > 0 && isParent()) mnyRevalueStock(kid, -pct, { weekKey: wk, note: '📉 Companies dipped this week' });
    sdSetStep(d, 1); sdStartCount(d); sdRerender(); return;
  }
  if (a === 'sd-back') { clearInterval(sdCountTimer); sdSetStep(d, Number(el.getAttribute('data-sd-to')) || 0); if (d.step === 1) d.shown = 6; sdSave(d); sdRerender(); return; }
  if (a === 'sd-line') { sdOpenLine(el.getAttribute('data-sd-tile'), false); return; }
  if (a === 'sd-edit') { sdOpenLine(el.getAttribute('data-sd-tile'), true); return; }
  if (a === 'sd-ov') {
    const ch = el.getAttribute('data-sd-ch');
    const b = mrWeekBreakdown(wk, kid);
    const cur = { chores: b.chorePaid, learning: b.learnPaid, streak: b.streakBonus, sessions: b.sessionsPaid, comp: b.compPaid, fines: b.fines.total }[ch];
    mnySetOverride(kid, wk, ch, Math.max(0, money2(cur + num)), mnyWeekReason(kid, wk));
    sdRerender(); return;
  }
  if (a === 'sd-ovreset') { mnyClearOverride(kid, wk, el.getAttribute('data-sd-ch')); sdRerender(); return; }
  if (a === 'sd-reason') { mnyPickReason(el.getAttribute('data-sd-r')); return; }
  if (a === 'sd-must') { sdBumpMustPay(kid, wk, num); sdRerender(); return; }
  if (a === 'sd-pull' || a === 'sd-adv') {
    const c = sdContext(kid, wk);
    if (a === 'sd-adv') {
      const r = sdSetAdvance(c.w, num, c.rules);
      if (r.ok) d.advMan = r.adv.manual; else if (r.why) showToast(r.why);
      sdBeep(r.ok ? 600 : 220);
    } else {
      const k = el.getAttribute('data-sd-k');
      const curP = Number(d.pull[k]) || 0;
      if (num < 0 && curP <= 0) { sdBeep(220); return; }
      const coreK = k === 'cash' ? 'cash' : 'ready';
      const r = sdSetPull(c.w, coreK, num, c.rules);
      if (r.ok) d.pull[k] = Math.max(0, curP + num); else if (r.why) showToast(r.why);
      sdBeep(r.ok ? 660 : 220);
    }
    sdSave(d); sdRerender(); return;
  }
  if (a === 'sd-tochoose') {
    const c = sdContext(kid, wk);
    if (d.shown < 6) { sdBeep(220); return; }
    if (mnyAnyEdited(kid, wk) && !mnyWeekReason(kid, wk)) { sdBeep(220); showToast('Pick why a line was changed first'); return; }
    clearInterval(sdCountTimer);
    // Take back anything placed beyond what is hers now (the prototype's toChoose).
    let over = money2(sdPlacedOf(d.alloc) - c.P.hers);
    ['spend', 'stock', 'gic', 'goal', 'ready', 'extra'].forEach(k => { const t = Math.min(d.alloc[k] || 0, Math.max(0, over)); d.alloc[k] = money2((d.alloc[k] || 0) - t); over = money2(over - t); });
    const pots = c.w.pots;
    d.scaleMax = Math.max(20, Math.ceil((Math.max(pots.ready, pots.gic, pots.stock) + c.P.hers + 1) / 10) * 10);
    if (isParent() && !mnyIsConfirmed(wk, kid)) mnyConfirmWeek(wk, kid, 'agreed on Sunday');
    sdSetStep(d, 2); sdRerender(); return;
  }
  if (a === 'sd-preset') {
    const c = sdContext(kid, wk);
    const p = sdPresets(c.w, c.rules).find(x => x.id === el.getAttribute('data-sd-p'));
    if (!p || p.locked) { sdBeep(220); return; }
    d.alloc = sdAlloc(p.alloc); d.presetId = p.id; d.last = null; d.focus = null; d.lastAt = Date.now();
    sdBeep(523); sdSave(d); sdRerender(); return;
  }
  if (a === 'sd-clear') { d.alloc = sdZero(); d.presetId = null; d.last = null; d.focus = null; sdSave(d); sdRerender(); return; }
  if (a === 'sd-all') { d.focus = d.focus === 'all' ? null : 'all'; sdBeep(640); sdSave(d); sdRerender(); return; }
  // "−$1" takes a dollar back from the picked pot (Plan v17 §3).
  if (a === 'sd-minus') {
    if (!d.pick || d.pick === 'fixed' || !((d.alloc[d.pick] || 0) > 0)) { sdBeep(220); showToast('Pick a pot with money in it first'); return; }
    sdPlaceIn(sdContext(kid, wk), d.pick, -1, 1); sdRerender(); return;
  }
  if (a === 'sd-help') {
    const col = el.getAttribute('data-sd-col');
    sdBeep(600);
    if (col === 'grow') mnyShowConcept((d.sel || {}).grow || 'ready', { tabs: SD_GROW_TABS });
    else mnyShowConcept(col === 'loan' ? 'debt' : 'spend');
    return;
  }
  if (a === 'sd-goalmenu') {
    const c = sdContext(mnyMeetingKid(), mmWeekKey());
    const on = c.f.chosen;
    sdSheetOpen('🎯 Which goal does my card show?', `<div class="sd-goalpick">${c.f.goals.map(x => `<button type="button" class="sd-chip${on && on.id === x.id ? ' on' : ''}" data-mny-action="sd-goalpick" data-sd-goal="${escapeAttr(x.id)}">${escapeHtml((x.icon || '🎯') + ' ' + x.name)}</button>`).join('')}</div>`);
    return;
  }
  if (a === 'sd-goalpick') {
    d.goalId = el.getAttribute('data-sd-goal'); sdSave(d);
    if (document.getElementById('sundayOverlay').classList.contains('open')) { sdSheet = null; closeSheet('sundayOverlay'); }
    sdRerender(); return;
  }
  if (a === 'sd-tm') { d.tmW = Number(el.getAttribute('data-sd-n')) || 4; sdSave(d); sdRerender(); return; }
  if (a === 'sd-redo') {
    if (mmUndoRecord(kid)) { sdBeep(500); d.step = 2; d.signed = null; d.last = null; sdSave(d); }
    sdRerender(); return;
  }
  if (a === 'sd-newidea') {
    const id = el.getAttribute('data-sd-id');
    d.newIdea = d.newIdea === id ? null : id;
    sdSave(d); sdRerender(); return;
  }
  if (a === 'sd-verdict') { sdOpenVerdict(sdContext(kid, wk), el.getAttribute('data-sd-v')); return; }
  if (a === 'sd-newok') { d.newSeen = [...(d.newSeen || []), id]; sdBeep(880); sdSave(d); sdRerender(); return; }
  if (a === 'sd-yes' || a === 'sd-no' || a === 'sd-talk') {
    const ans = a === 'sd-yes' ? 'yes' : a === 'sd-no' ? 'no' : 'talk';
    const r = mnyRequestsFor(kid).find(x => x.id === id);
    const opts = {};
    if (ans === 'yes' && r && r.kind === 'comp' && r.record && r.record.pay != null) opts.pay = r.record.pay;
    if (mnyAnswerRequest(kid, id, ans, opts)) { sdBeep(ans === 'yes' ? 880 : 300); d.adjust = null; sdSave(d); }
    sdRerender(); return;
  }
  if (a === 'sd-adjust') { d.adjust = d.adjust === id ? null : id; sdSave(d); sdRerender(); return; }
  // 💬 The agreed amount on a talk-first question (Deviation 41).
  if (a === 'sd-agreed' || a === 'sd-agree') {
    const q = mnyRequestsFor(kid).find(x => x.id === id);
    if (!q) return;
    const base = q.agreed != null ? q.agreed : mnyRequestAsked(q.store, q.record);
    if (a === 'sd-agreed') { mnySetRequestAgreed(kid, id, money2(base + num)); sdBeep(600); sdRerender(); return; }
    if (q.agreed == null) mnySetRequestAgreed(kid, id, base);
    if (mnyAnswerRequest(kid, id, 'yes', { agreed: true })) { sdBeep(880); d.adjust = null; sdSave(d); }
    sdRerender(); return;
  }
  if (a === 'sd-pay') {
    const r = mnyEnsureRequests(kid).find(x => x && x.id === id);
    if (r) mnySetRequestPay(kid, id, money2((r.pay != null ? Number(r.pay) : guCompCalc(r).amt) + num));
    sdRerender(); return;
  }
  if (a === 'sd-gift') {
    const dep = mnyEnsureDeposits(kid).find(x => x && x.id === id);
    if (dep && money2(dep.amount) + num > 0) mnyEditDeposit(kid, id, { amount: money2(dep.amount) + num });
    sdRerender(); return;
  }
  if (a === 'sd-meet') {
    openRecordSheet({ kind: 'meet', kid, dayKey: el.getAttribute('data-daykey'), name: el.getAttribute('data-name') || '', sport: el.getAttribute('data-sport') || '' });
    return;
  }
  if (a === 'sd-add') {
    const kind = el.getAttribute('data-sd-kind');
    const day = mrWeekDayKeys(wk).filter(k => k <= todayKey()).pop() || wk;
    openRecordSheet({ kind, kid, dayKey: day });
    return;
  }
}
/* 📌 Dad's −/+ on the must-pay for this Sunday (the payment override, per
   row): less comes off the newest row first; more gives it back oldest
   first. Never above the schedule; what is agreed down is carried. */
function sdBumpMustPay(kid, wk, dir) {
  if (!isParent()) { showToast('A grown-up changes the payment 🔒'); return; }
  const rows = mnyDueThisWeek(kid, wk);
  if (dir < 0) {
    const r = rows.slice().reverse().find(x => x.amount > 0);
    if (r) mnySetPaymentOverride(kid, wk, r.debtId, money2(Math.max(0, r.amount - 1)));
  } else {
    const r = rows.find(x => x.amount < x.scheduled);
    if (r) { const v = money2(r.amount + 1); mnySetPaymentOverride(kid, wk, r.debtId, v >= r.scheduled ? null : v); }
  }
}

/* ── The boxes: tap, hold, and hold to sign (pointer events, bound in
   js/99-main.js on #familyMeetingBody). A first tap picks a box; a tap again
   is +$1; held 2 s it is +$5, with the red bar filling along its foot. While
   a press is held the screen is NOT redrawn — the bar moves in place — so the
   finger never loses its element. ── */
function sdCellDown(k) {
  const kid = mnyMeetingKid(), wk = mmWeekKey();
  const c = sdContext(kid, wk), d = c.d;
  if (d.step !== 2) return;
  const col = SD_COL_OF[k];
  const fixed = k === 'fixed';
  const can = sdCan(c, k);
  // The first tap picks a pot; a tap again adds (Plan v17 §3).
  const isSel = !fixed && d.pick === k;
  const pick = (snd) => {
    sdBeep(snd); sdSelTap = true;
    if (!fixed && can.ok) { d.pick = k; d.sel = Object.assign({}, d.sel || {}, { [col]: k }); }
    d.tried = k; sdSave(d); sdRerender();
  };
  if (fixed || !can.ok) return pick(220);
  if (!isSel) return pick(560);
  if (c.P.pile <= 0) return pick(220);
  sdSelTap = false;
  clearInterval(sdPress && sdPress.timer);
  sdPress = { k, start: Date.now(), p: 0, fired: false };
  sdPress.timer = setInterval(() => {
    if (!sdPress) return;
    sdPress.p = Math.min(100, (Date.now() - sdPress.start) / SD_HOLD_MS * 100);
    const bar = document.querySelector(`[data-sd-cell="${k}"] .sd-cell-hold`);
    if (bar) bar.style.width = Math.round(sdPress.p) + '%';
    if (sdPress.p >= 100 && !sdPress.fired) {
      sdPress.fired = true; clearInterval(sdPress.timer);
      const kk = sdPress.k; sdPress = null;
      const placed = sdPlaceIn(sdContext(kid, wk), kk, 1, 5);
      sdRerender();
      if (placed) sdFlyCoin(kk, '$5');
    }
  }, 40);
}
function sdCellUp(k) {
  if (sdSelTap) { sdSelTap = false; return; }
  if (!sdPress) return;
  clearInterval(sdPress.timer);
  const was = sdPress; sdPress = null;
  const placed = !was.fired && was.k === k && sdPlaceIn(sdContext(mnyMeetingKid(), mmWeekKey()), k, 1, 1);
  sdRerender();
  if (placed) sdFlyCoin(k, '$1');
}
/* 🪙 A coin flies from the pile chip to the box she tapped, as drawn (owner's
   review S6-3). Decoration only — the money already moved in the draft —
   and nothing at all under prefers-reduced-motion. */
function sdFlyCoin(k, label) {
  if (sdReducedMotion()) return;
  const from = document.querySelector('.sd-pilechip .sd-pilecoins');
  const to = document.querySelector(`[data-sd-cell="${k}"]`);
  if (!from || !to || typeof from.animate !== 'function') return;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  const coin = document.createElement('span');
  coin.className = 'sd-flycoin';
  coin.setAttribute('aria-hidden', 'true');
  coin.textContent = label;
  coin.style.left = (a.left + a.width / 2 - 15) + 'px';
  coin.style.top = (a.top + a.height / 2 - 15) + 'px';
  document.body.appendChild(coin);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = coin.animate([
    { transform: 'translate(0, 0) scale(1.1)', opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 80}px) scale(1.2) rotate(180deg)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.8) rotate(360deg)`, opacity: 0.2 },
  ], { duration: 650, easing: 'cubic-bezier(0.3, 0.9, 0.4, 1)' });
  anim.onfinish = () => coin.remove();
  setTimeout(() => { if (coin.parentNode) coin.remove(); }, 1200);
}
function sdCellCancel() {
  if (!sdPress) return;
  clearInterval(sdPress.timer);
  sdPress = null;
  sdRerender();
}
/* A keyboard press (Enter / Space) is one tap: pick, then +$1. */
function sdCellKey(k) { sdCellDown(k); sdCellUp(k); }
function sdSignDown() {
  const kid = mnyMeetingKid(), wk = mmWeekKey();
  const c = sdContext(kid, wk);
  if (c.d.step !== 2) return;
  if (c.P.pile > 0) {
    sdBeep(220); sdNudgeUntil = Date.now() + 1400; sdRerender();
    setTimeout(() => { if (Date.now() >= sdNudgeUntil) sdRerender(); }, 1450);
    return;
  }
  clearInterval(sdSignHold && sdSignHold.timer);
  sdSignHold = { p: 0 };
  sdSignHold.timer = setInterval(() => {
    if (!sdSignHold) return;
    sdSignHold.p = Math.min(100, sdSignHold.p + 60 / SD_SIGN_MS * 100);
    const fill = document.querySelector('[data-sd-sign] .sd-sign-fill');
    if (fill) fill.style.width = sdSignHold.p + '%';
    if (sdSignHold.p >= 100) { clearInterval(sdSignHold.timer); sdSignHold = null; sdDoSign(kid, wk); }
  }, 60);
}
function sdSignUp() {
  if (!sdSignHold) return;
  clearInterval(sdSignHold.timer);
  sdSignHold = null;
  sdRerender();
}
/* Sign: the sign sequence (mnyDoCommit, js/23) for this girl. */
function sdDoSign(kid, wk) {
  const d = sdDraftFor(kid, wk);
  const out = mnyDoCommit(kid, wk);
  if (!out || !out.ok) { sdRerender(); return out; }
  d.signed = { signed: out.res.signed, after: { left: out.res.after.left, pots: out.res.after.pots, loan: out.res.after.loan },
               crossed: out.res.crossed, w: out.ctx.f.lite };
  sdSetStep(d, 3);
  sdBeep(1046); setTimeout(() => sdBeep(1318), 120);
  sdRerender();
  return out;
}
function sdPointer(e) {
  const t = e.target;
  if (!t || !t.closest) return;
  if (e.type === 'pointerdown') {
    const cell = t.closest('[data-sd-cell]');
    if (cell) { e.preventDefault(); sdCellDown(cell.getAttribute('data-sd-cell')); return; }
    if (t.closest('[data-sd-sign]')) { e.preventDefault(); sdSignDown(); }
    return;
  }
  if (e.type === 'pointerup') {
    const cell = t.closest('[data-sd-cell]');
    if (cell) sdCellUp(cell.getAttribute('data-sd-cell')); else sdCellCancel();
    sdSignUp();
    return;
  }
  // pointercancel, or the finger leaving the element it pressed.
  if (e.type === 'pointercancel' || (e.type === 'pointerout' && !(e.relatedTarget && t.contains(e.relatedTarget)))) {
    if (sdPress && t.closest('[data-sd-cell]')) sdCellCancel();
    if (sdSignHold && t.closest('[data-sd-sign]')) sdSignUp();
  }
}
/* Enter / Space on a box or the sign button (a click with no pointer). */
function sdKeyClick(e) {
  if (e.detail !== 0) return;
  const t = e.target;
  if (!t || !t.closest) return;
  const cell = t.closest('[data-sd-cell]');
  if (cell) { sdCellKey(cell.getAttribute('data-sd-cell')); return; }
  if (t.closest('[data-sd-sign]')) {
    const kid = mnyMeetingKid(), wk = mmWeekKey();
    const c = sdContext(kid, wk);
    if (c.d.step !== 2) return;
    if (c.P.pile > 0) { sdSignDown(); return; }
    sdDoSign(kid, wk);
  }
}
