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
                   (🏠 Helping at home · ⛸️ My club job · 🏆 Prizes) ·
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
const SD_TILE_CHANNELS = { home: ['chores', 'learning', 'streak'], club: ['sessions'], prizes: ['comp'], fines: ['fines'] };
const SD_CHANNEL_LABEL = { chores: '🧹 Chores', learning: '📘 Learning', streak: '🔥 Routine streak',
                           sessions: '⛸️ Club sessions', comp: '🏆 Prizes', fines: '📦 Fines' };
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

/* ── The draft ── */
function sdDraftKey(kid, wk) { return SD_DRAFT_LS_PREFIX + kid + '_' + wk; }
function sdFreshDraft(kid, wk) {
  return { kid, wk, step: 0, guess: null, cat: {}, shown: 0, alloc: sdZero(),
           pull: { ready: 0, cash: 0 }, advMan: 0, sel: { grow: 'ready' }, last: null, lastAt: 0,
           tried: null, focus: null, presetId: null, tmW: 4, goalId: null, scaleMax: null,
           editTile: null, adjust: null, newSeen: [], signed: null };
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
  const isHome = x => x.requestKind === 'deposit' || /home/i.test(String(x.from || ''));
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
    { key: 'pa', label: '⛸️ My club job', amount: b.sessionsPaid },
    { key: 'comp', label: '🏆 Prizes', amount: money2(b.compPaid + lateIn) },
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
  open.forEach(x => { x.monthly = money2(money2(x.monthly) * ch.now / sum); x.monthlyRescaledFor = ch.key; markItemUpdated(x); });
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
  mmUnrecordedCompetitions(wk, kid).forEach(p => items.push({
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
      ${sdHead(c)}
      <div class="sd-grid">
        <div class="sd-card sd-main">${main}</div>
        <div class="sd-side">${side}</div>
      </div>
      ${newRow}
    </div>`;
}
function sdHead(c) {
  const d = c.d;
  const kids = ['jenn', 'jess'].map(k => `<button type="button" class="sd-kid${k === c.kid ? ' on' : ''}" data-mny-action="sd-kid" data-sd-kid="${k}">${CT_PROFILE_ICON[k]} ${escapeHtml(mnyKidName(k))}${mnyIsCommitted(c.wk, k) ? ' ✓' : ''}</button>`).join('');
  const steps = SD_STEP_LABELS.map((l, i) => `<span class="sd-stepchip${i === d.step ? ' on' : i < d.step ? ' done' : ''}">${escapeHtml(l)}</span>`).join('');
  return `<div class="sd-head">
      <div class="sd-kids" role="group" aria-label="Whose Sunday">${kids}</div>
      <div class="sd-steps" aria-label="Sunday steps">${steps}</div>
      <div class="sd-headbtns">
        <button type="button" class="sd-btn" data-mny-action="sd-sound" aria-pressed="${sdSoundOn()}">${sdSoundOn() ? '🔊 Sound on' : '🔇 Sound off'}</button>
        <button type="button" class="sd-btn sd-btn--dad" data-mny-action="sd-dad">🗣️ Dad's card</button>
      </div>
    </div>`;
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
  const asked = routineSessionsForDay(c.kid, c.wk, 6);
  return { asked: asked.length, done: asked.length > 0 && asked.every(s => ctGetMandatory(c.wk, 6, s, c.kid)) };
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
    // Owner decision #93: "Did you do your Sunday routine?" — a tick counts the day.
    return `<div class="sd-catwrap">${tile}<button type="button" class="sd-sunroutine${sun.done ? ' on' : ''}" data-mny-action="sd-sunroutine">${sun.done ? '✓ Sunday routine done' : '☀️ Sunday routine? tick'}</button></div>`;
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
    ? [u.asks ? `Dad: ${u.asks} to answer` : '', u.sessions ? `my club sessions: ${u.sessions} to tick` : '', u.rows ? 'a new row on my wall' : ''].filter(Boolean).join(' · ') + ' first →'
    : d.guess ? `My guess: $${d.guess}${Object.keys(d.cat).filter(k => d.cat[k] != null).length ? ` · ${Object.keys(d.cat).filter(k => d.cat[k] != null).length} of 4 sources picked` : ''}. Let's see.`
    : hist.length ? `Last week was $${lastWeek}. There is no wrong guess.` : 'There is no wrong guess.';
  const ready = d.guess && !u.total;
  return `<div class="sd-title">🎲 Payday guessing game!</div>
    <div class="sd-script">${escapeHtml(sdStory(c))}</div>
    <div class="sd-q">① Where did money come from this week? Tick my club sessions, then tap the rest.</div>
    <div class="sd-cats">
      <div class="sd-job">
        <div class="sd-job-head"><span class="sd-cat-icon">⛸️</span><span class="sd-ellip">My club job</span><b class="sd-pill">${escapeHtml(paState)}</b></div>
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
    : it.open ? (it.status === 'talk' ? '💬 Dad wants to talk' : '⏳ waiting for Dad')
    : ({ goal: '✓ new goal starts today', move: '✓ moved', deposit: '✓ in the bank', gift: '✓ in the bank',
         adv: '✓ already spent · comes off today', skip: '✓ marked missed', dispute: '✓ fine taken away' }[it.kind]
       || (q && q.record && q.record.compId ? `✓ yes · ${sdD(mrCompAward(mrCompetitions(c.kid).find(x => x.id === q.record.compId)))} today` : '✓ yes'));
  let btns = '';
  if (it.kind === 'meet') {
    const p = it.meet;
    btns = `<button type="button" class="sd-ans yes" data-mny-action="sd-meet" data-daykey="${escapeAttr(p.dayKey)}" data-name="${escapeAttr(p.name || '')}" data-sport="${escapeAttr(p.sport || '')}">✓ result</button>
      <button type="button" class="sd-ans" data-mny-action="comp-zero" data-daykey="${escapeAttr(p.dayKey)}" data-name="${escapeAttr(p.name || '')}" data-sport="${escapeAttr(p.sport || 'swim')}">No criteria met · $0</button>`;
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
      const rule = rec.pay != null ? money2(rec.pay) : rqResultPay(c.kid, rec);
      nums = `<div class="sd-adj-row"><span>Dad makes it</span><button type="button" class="sd-step" data-mny-action="sd-pay" data-sd-id="${escapeAttr(it.id)}" data-sd-d="-1" aria-label="Less">−</button><b>${escapeHtml(sdD(rule))}</b><button type="button" class="sd-step" data-mny-action="sd-pay" data-sd-id="${escapeAttr(it.id)}" data-sd-d="1" aria-label="More">+</button></div>`;
    } else if ((it.kind === 'gift' || it.kind === 'deposit') && rec.pendingApproval) {
      nums = `<div class="sd-adj-row"><span>How much</span><button type="button" class="sd-step" data-mny-action="sd-gift" data-sd-id="${escapeAttr(it.id)}" data-sd-d="-1" aria-label="Less">−</button><b>${escapeHtml(sdD(rec.amount))}</b><button type="button" class="sd-step" data-mny-action="sd-gift" data-sd-id="${escapeAttr(it.id)}" data-sd-d="1" aria-label="More">+</button></div>`;
    } else if (it.kind === 'adv' || it.kind === 'move') {
      nums = `<div class="sd-adj-row"><span>Amount</span><b>${escapeHtml(sdD(q.amount))}</b></div>`;
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
  const groups = SD_ASK_GROUPS.map(([id, title, kinds]) => {
    const mine = items.filter(x => kinds.indexOf(x.kind) >= 0);
    if (!mine.length) return '';
    return `<div class="sd-askgroup"><div class="sd-askgroup-title">${escapeHtml(title)}</div>${mine.map(it => sdAskRow(c, it)).join('')}</div>`;
  }).join('');
  const u = sdUnsettled(c.kid, c.wk);
  const note = u.asks ? 'Payday opens when every question has an answer.'
    : u.sessions ? '✓ Dad is done. Tick my club sessions next.'
    : u.rows ? '✓ Dad is done. Read the new row on my wall.' : '✓ All answered. Now I can guess.';
  const y = mrYearToDate(c.kid);
  const target = Number(mrRuleOr(c.rules, 'targets.' + c.kid + '.annual')) || y.target || 0;
  const pct = target > 0 ? Math.min(100, y.paidTotal / target * 100) : 0;
  return `<div class="sd-panel sd-panel--amber">
      <div class="sd-panel-head"><span class="sd-panel-title">⏳ Dad answers first</span><span class="sd-note">Dad taps</span></div>
      ${groups || '<div class="sd-note">Nothing waiting.</div>'}
      <div class="sd-adds">
        <button type="button" class="sd-btn" data-mny-action="sd-add" data-sd-kind="meet">➕ result</button>
        <button type="button" class="sd-btn" data-mny-action="sd-add" data-sd-kind="gift">➕ gift</button>
        <button type="button" class="sd-btn" data-mny-action="sd-add" data-sd-kind="fine">➕ fine</button>
      </div>
      <div class="sd-note">${escapeHtml(note)}</div>
    </div>
    <div class="sd-panel">
      <div class="sd-panel-title">💡 Clues for my guess</div>
      ${sdClues(c.rules).map(x => `<div class="sd-clue"><span>${escapeHtml(x.k)}</span><span>${escapeHtml(x.v)}</span></div>`).join('')}
    </div>
    <div class="sd-panel sd-panel--green">
      <div class="sd-panel-head"><span class="sd-panel-title">🎯 My earning target</span><span class="sd-note">set by Dad</span></div>
      <div class="sd-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
      <div class="sd-line">${escapeHtml(`$${Math.round(y.paidTotal)} of $${Math.round(target)} earned so far · about ${sdM(target / 52)} a week keeps me on pace`)}</div>
    </div>`;
}

/* ── Step 2 · Payday ── */
function sdGroupNames(words) {
  return words >= 2
    ? { earned: 'Active income', given: 'Gifts', made: 'Passive income' }
    : { earned: '💪 Money I earned', given: '🎁 Money I was given', made: '🌱 Money my money made' };
}
/* The Payday tiles in the order the coins fall, each with its sum. */
function sdTiles(c) {
  const b = c.f.b;
  const passive = mnyPassiveSinceLastMeeting(c.kid);
  return [
    { id: 'home', group: 'earned', name: '🏠 Helping at home', every: true, amount: money2(b.chorePaid + b.learnPaid + b.streakBonus),
      note: `chores ${sdD(money2(b.chorePaid + b.learnPaid))} · routine ${sdD(b.streakBonus)}`, coin: 'earned', badge: 'NICE!' },
    { id: 'club', group: 'earned', name: '⛸️ My club job', every: true, amount: money2(b.sessionsPaid),
      note: `${(b.sessions || {}).attended || 0} session${((b.sessions || {}).attended || 0) === 1 ? '' : 's'} × ${sdD(sdRule(c.rules, 'sessions.perSession'))}`, coin: 'earned', badge: 'WOW' },
    { id: 'prizes', group: 'earned', name: '🏆 Prizes', amount: c.f.compIn,
      note: (b.comp.entries || []).map(e => e.name || mnySportLabel(e.sport)).join(' · ') || (c.f.lateIn ? 'a meet from a settled week' : 'none this week'), coin: 'earned', badge: 'BRAVO!' },
    { id: 'gifts', group: 'given', name: '🎁 Gifts', amount: c.f.giftsIn,
      note: c.f.deps.map(x => x.giver || x.from).filter(Boolean).join(' · ') || 'only after Dad says yes', coin: 'given', badge: 'THANKS!' },
    { id: 'made', group: 'made', name: '🌱 My pots earned', amount: money2(Math.max(0, passive)), noCoins: true,
      note: passive < 0 ? `companies ${sdD(passive)} this week` : 'stays in my pots · not in my pile', coin: null },
    { id: 'fines', group: 'off', name: '📦 Fines', amount: money2(-(b.gross - b.net)),
      note: (b.fines.perDay || []).filter(x => x.raw > 0).length ? `${(b.fines.perDay || []).filter(x => x.raw > 0).length} day${(b.fines.perDay || []).filter(x => x.raw > 0).length === 1 ? '' : 's'} · every one is logged` : 'no fines this week 🎉', coin: 'off' },
  ];
}
function sdTileHtml(c, t, idx) {
  const d = c.d;
  const on = idx < d.shown;
  const v = t.amount;
  return `<div class="sd-tile${on ? ' on' : ''}${v === 0 ? ' zero' : v < 0 ? ' neg' : ''}${on && v > 0 && t.badge ? ' tilt-' + (idx % 2 ? 'r' : 'l') : ''}">
      ${on && v > 0 && t.badge ? `<span class="sd-badge">${escapeHtml(t.badge)}</span>` : ''}
      <button type="button" class="sd-tile-tap" data-mny-action="sd-line" data-sd-tile="${t.id}" aria-expanded="${d.editTile === 'w:' + t.id || d.editTile === 'e:' + t.id}">
        <span class="sd-ellip">${escapeHtml(t.name)}${t.every ? ' <i class="sd-tag">every week</i>' : ''}</span>
        <span class="sd-tile-foot"><span class="sd-ellip sd-tile-note">${escapeHtml(t.note)}</span><b>${escapeHtml(sdM(v))}</b></span>
      </button>
    </div>`;
}
function sdTileDetail(c) {
  const d = c.d, et = d.editTile;
  if (!et) return '';
  const id = et.slice(2);
  const chans = (SD_TILE_CHANNELS[id] || []).filter(ch => ch !== 'learning' || money2(c.f.b.learnPaid) > 0 || mnyOverrides(c.kid, c.wk).learning);
  if (et[0] === 'w') {
    const work = chans.length ? chans.map(ch => `<div class="sd-work-head">${escapeHtml(SD_CHANNEL_LABEL[ch])}</div>${mnyWorking(c.wk, c.kid, ch === 'sessions' ? 'sessions' : ch, c.f.b)}`).join('')
      : `<div class="sd-note">${escapeHtml((sdTiles(c).find(t => t.id === id) || {}).note || '')}</div>`;
    // Dad's ✏️ on the line (Plan v5 §K): its channels, a reason, one writer.
    const pen = isParent() && chans.length
      ? `<button type="button" class="sd-btn" data-mny-action="sd-edit" data-sd-tile="${id}">✏️ Dad changes this line</button>` : '';
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
function sdCoins(c) {
  const d = c.d, P = c.P;
  const tiles = sdTiles(c);
  const hist = c.f.hist;
  const lastWeek = hist.length ? hist[hist.length - 1].inAmt : 0;
  const ymax = Math.max(50, Math.ceil(Math.max(P.total, lastWeek, P.mustPay) / 10) * 10);
  const coins = [];
  const done = d.shown >= tiles.length;
  tiles.forEach((t, i) => {
    if (i >= d.shown || t.noCoins || !t.coin || t.coin === 'off') return;
    for (let n = 0; n < Math.floor(t.amount + 1e-9) && coins.length < ymax; n++) coins.push({ cls: t.coin, fresh: i === d.shown - 1 && !done });
  });
  if (done) for (let n = 0; n < Math.floor(P.pullTot + 1e-9) && coins.length < ymax; n++) coins.push({ cls: 'bank', fresh: false });
  // Taken off: dashed ghosts at the top of the stack.
  const off = Math.ceil(-Math.min(0, P.income.fine) - 0.001) + (done ? Math.ceil(P.advTaken - 0.001) : 0);
  for (let g = 0; g < off && coins.length; g++) {
    const j = coins.length - 1 - g;
    if (j < 0) break;
    coins[j] = { cls: 'ghost', label: g < Math.ceil(-Math.min(0, P.income.fine) - 0.001) ? '📦' : '⏪' };
  }
  const rowH = 500 / ymax;
  const html = coins.map((x, i) => `<span class="sd-coin ${'sd-coin--' + x.cls}${x.fresh ? ' drop' : ''}" style="left:${(i % 5) * 20}%;bottom:${(Math.floor(i / 5) * rowH).toFixed(2)}%;height:${rowH.toFixed(2)}%;animation-delay:${(i % 8) * 55}ms"><i>${x.label || '$1'}</i></span>`).join('');
  const step = ymax > 60 ? 20 : 10;
  const ticks = Array.from({ length: ymax / step }, (_, i) => (i + 1) * step)
    .map(t => `<span class="sd-tick" style="bottom:${(t / ymax * 100).toFixed(2)}%">$${t}</span>`).join('');
  return { html, ticks, ymax, lastWeek, minPct: Math.min(100, P.mustPay / ymax * 100), ghostPct: Math.min(100, lastWeek / ymax * 100) };
}
function sdPaydayMain(c) {
  const d = c.d, P = c.P, f = c.f;
  const g = sdGroupNames(c.words);
  const tiles = sdTiles(c);
  const tileOf = id => sdTileHtml(c, tiles.find(t => t.id === id), tiles.findIndex(t => t.id === id));
  const done = d.shown >= tiles.length;
  const earned = money2(tiles.filter(t => t.group === 'earned').reduce((a, t) => a + t.amount, 0));
  const ss = c.words >= 3;
  const coins = sdCoins(c);
  const adv = P.advW;
  const advNote = f.advOwed && d.advMan ? `asked + $${d.advMan} I forgot to ask`
    : f.advOwed ? `${f.advReqs.map(r => r.why || r.day).filter(Boolean).join(' · ') || 'asked Dad'} · spent`
    : d.advMan ? 'I forgot to ask · Dad checks it' : `forgot to ask? tap + · up to $${sdRule(c.rules, 'advance.maxPerWeek')}`;
  const savingsFree = Math.floor(Math.max(0, mnySavedTotal(c.kid) - sdRule(c.rules, 'pots.safety')) + 1e-9);
  const pull = (k, name, sub) => `<div class="sd-pull"><div class="sd-pull-name"><span class="sd-ellip">${escapeHtml(name)}</span><span class="sd-note">${escapeHtml(sub)}</span></div>
      <button type="button" class="sd-step" data-mny-action="sd-pull" data-sd-k="${k}" data-sd-d="-1" aria-label="Less">−</button><b>$${Number(d.pull[k]) || 0}</b>
      <button type="button" class="sd-step sd-step--gold" data-mny-action="sd-pull" data-sd-k="${k}" data-sd-d="1" aria-label="More">+</button></div>`;
  const bankNote = f.unlocked > 0 ? `🔓 ${sdM(f.unlocked)} locked money came back` : 'only if I need it';
  const mustRows = isParent() ? `<span class="sd-must-steps"><button type="button" class="sd-step" data-mny-action="sd-must" data-sd-d="-1" aria-label="Pay less this week">−</button><button type="button" class="sd-step" data-mny-action="sd-must" data-sd-d="1" aria-label="Back toward the schedule">+</button></span>` : '';
  const reduced = f.due.filter(x => x.reduced);
  const impact = reduced.length ? `Dad made it ${sdM(money2(reduced.reduce((a, x) => a + x.scheduled - x.amount, 0)))} less this week. It is still owed next Sunday — no interest on it.` : '';
  const short = P.shortfall > 0 ? `🚨 Not enough for the loan this week: it takes ${sdM(P.minNow)}, and ${sdM(P.shortfall)} is carried to next Sunday — no interest on it.` : '';
  const gp = sdPercents([earned, f.giftsIn, P.pullTot], money2(earned + f.giftsIn + P.pullTot));
  const takenOff = money2(-P.income.fine + P.advTaken);
  const countNote = done
    ? `🟩 ${sdM(earned)} (${sdPercentLabel(gp[0], earned)})${f.giftsIn ? ` + 🟨 ${sdM(f.giftsIn)} (${sdPercentLabel(gp[1], f.giftsIn)})` : ''}${P.pullTot ? ` + 🟦 ${sdM(P.pullTot)} (${sdPercentLabel(gp[2], P.pullTot)})` : ''}${takenOff > 0.004 ? ` − ${sdM(takenOff)} taken off` : ''} = ${sdM(P.tp)}`
    : 'coins are falling…';
  const needReason = mnyAnyEdited(c.kid, c.wk) && !mnyWeekReason(c.kid, c.wk);
  const monthly = money2(f.debts.filter(x => loanBalance(c.kid, x.id) > 0).reduce((a, x) => a + money2(x.monthly), 0));
  return `<div class="sd-titlerow"><div class="sd-title">☀️ My payday</div><div class="sd-script">${escapeHtml(sdGuessResult(c))}</div></div>
    <div class="sd-pay">
      <div class="sd-pay-groups">
        <div class="sd-box">
          <div class="sd-box-head"><span class="sd-box-title">💰 Money in</span><b>${escapeHtml(sdM(money2(P.income.steady + P.income.bonus + P.pullTot)))}</b></div>
          <div class="sd-group sd-group--earned"><div class="sd-group-head"><span>${escapeHtml(g.earned)}${ss ? ' <i class="sd-tag">earned</i>' : ''}</span><b>${escapeHtml(sdM(earned))}</b></div>
            <div class="sd-lines">${tileOf('home')}${tileOf('club')}${tileOf('prizes')}</div></div>
          <div class="sd-group-pair">
            <div class="sd-group sd-group--given"><div class="sd-group-head"><span>${escapeHtml(g.given)}${ss ? ' <i class="sd-tag">unearned</i>' : ''}</span><b>${escapeHtml(sdM(f.giftsIn))}</b></div>
              <div class="sd-lines one">${tileOf('gifts')}</div></div>
            <div class="sd-group sd-group--made"><div class="sd-group-head"><span>${escapeHtml(g.made)}${ss ? ' <i class="sd-tag">unearned</i>' : ''}</span></div>
              <div class="sd-lines one">${tileOf('made')}</div></div>
          </div>
          <div class="sd-group sd-group--bank"><div class="sd-group-head"><span>🏦 From my bank</span><span class="sd-note sd-ellip">${escapeHtml(bankNote)}</span><b>${escapeHtml(sdM(P.pullTot))}</b></div>
            <div class="sd-pulls">
              ${f.carry > 0 ? `<div class="sd-pull"><div class="sd-pull-name"><span class="sd-ellip">👛 Already in my wallet</span><span class="sd-note">it joins my pile</span></div><b>${escapeHtml(sdM(f.carry + f.homeIn))}</b></div>` : ''}
              ${pull('ready', '🏦 From Savings', `$${savingsFree} free above 🛟`)}
              ${pull('cash', '💵 From home', 'cash I bring in')}
            </div></div>
        </div>
        <div class="sd-box sd-box--off">
          <div class="sd-box-head"><span class="sd-box-title">➖ Taken off</span><span class="sd-note">fines · cash I drew before Sunday</span><b>${escapeHtml(sdM(money2(P.income.fine - P.advW)))}</b></div>
          <div class="sd-lines two">${tileOf('fines')}
            <div class="sd-tile sd-tile--adv${done ? ' on' : ''}${adv ? ' neg' : ' zero'}">
              <div class="sd-pull-name"><span class="sd-ellip">⏪ Drawn in advance <b>${escapeHtml(adv ? sdM(-adv) : '$0.00')}</b></span><span class="sd-note sd-ellip">${escapeHtml(advNote)}</span></div>
              <button type="button" class="sd-step" data-mny-action="sd-adv" data-sd-d="-1" aria-label="Less">−</button>
              <button type="button" class="sd-step sd-step--peach" data-mny-action="sd-adv" data-sd-d="1" aria-label="More">+</button>
            </div>
          </div>
        </div>
        ${sdTileDetail(c)}
        <div class="sd-must">📌 Must pay first <b>${escapeHtml(sdM(P.mustPay))}</b>${mustRows}
          ${impact ? `<span class="sd-note">${escapeHtml(impact)}</span>` : ''}
          ${short ? `<span class="sd-warn">${escapeHtml(short)}</span>` : ''}</div>
      </div>
      <div class="sd-pile">
        <div class="sd-pile-head"><span class="sd-box-title">💰 My pile</span><b>${escapeHtml(sdM(done ? P.tp : 0))}</b></div>
        <div class="sd-stack">${coins.html}</div>
        <div class="sd-ruler">${coins.ticks}
          ${coins.lastWeek ? `<span class="sd-lastline" style="bottom:${coins.ghostPct.toFixed(2)}%"></span>` : ''}
          <span class="sd-minline" style="bottom:${coins.minPct.toFixed(2)}%"><span>📌 loan first ${escapeHtml(sdM(P.mustPay))}</span></span></div>
        <div class="sd-pile-note">${escapeHtml(countNote)}</div>
      </div>
    </div>
    <div class="sd-row">
      <button type="button" class="sd-btn" data-mny-action="sd-back" data-sd-to="0">◀ Guess</button>
      <span class="sd-note">${escapeHtml(needReason ? 'Dad changed a line — pick why first.' : `The loan takes its ${sdM(P.minNow)} first (${sdD(monthly)} a month). Then ${sdM(money2(P.tp - P.minNow))} is mine to decide about.`)}</span>
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
function sdPaydaySide(c) {
  const b = c.f.b;
  const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const days = letters.map((L, i) => {
    const asked = routineSessionsForDay(c.kid, c.wk, i);
    const kept = asked.length && asked.every(s => ctGetMandatory(c.wk, i, s, c.kid));
    const paid = money2((b.chores.days[i] || {}).paid);
    return `<div class="sd-day"><span>${L}</span><span class="sd-dot${kept ? ' kept' : ''}">${kept ? '🔥' : '·'}</span><span>${paid > 0 ? sdD(paid) : '—'}</span></div>`;
  }).join('');
  const hist = c.f.hist;
  const f = v => v === 0 ? '—' : Math.abs(v) < 1 ? (v < 0 ? '−' : '') + Math.abs(Math.round(v * 100)) + '¢' : (v < 0 ? '−$' : '$') + Math.abs(Math.round(v));
  const now = { steady: c.P.income.steady, comp: c.f.compIn, gifts: c.f.giftsIn, made: Math.max(0, mnyPassiveSinceLastMeeting(c.kid)), fines: c.P.income.fine };
  const rows = [['📅 Steady', r => r.steady, 'steady'], ['🏆 Prizes', r => r.comp, 'comp'], ['🎁 Gifts', r => r.given, 'gifts'],
                ['🌱 Pots', r => r.made, 'made'], ['📦 Fines', r => -r.fines, 'fines']];
  const cols = Array.from({ length: 4 }, (_, i) => hist[i - (4 - hist.length)] || null);
  const done = c.d.shown >= sdTiles(c).length;
  const table = rows.map(([k, get, key]) => {
    const vals = cols.map(r => r ? get(r) : null);
    const have = vals.filter(v => v != null);
    const avg = have.length ? have.reduce((a, v) => a + v, 0) / have.length : 0;
    return `<div class="sd-hist"><span>${escapeHtml(k)}</span>${vals.map(v => `<span>${v == null ? '' : f(v)}</span>`).join('')}<b>${done ? f(now[key]) : '…'}</b><span class="sd-hist-avg">${have.length ? f(avg) : ''}</span></div>`;
  }).join('');
  const tot = cols.map(r => r ? r.inAmt : null), have = tot.filter(v => v != null);
  const avgT = have.length ? have.reduce((a, v) => a + v, 0) / have.length : 0;
  const res = [...(b.comp.entries || []).map(e => ({ n: '🏆 ' + (e.name || mnySportLabel(e.sport)), s: '✓ recorded', a: sdD(mrCompAward(e)) })),
    ...c.f.deps.map(x => ({ n: '🎁 ' + (x.giver || x.from || 'A gift'), s: '✓ Dad said yes', a: sdD(x.amount) })),
    ...mnyComingUp(c.kid).filter(x => x.kind === 'soon').map(x => ({ n: (x.icon || '🏆') + ' ' + x.name, s: 'coming up', a: '' }))].slice(0, 4);
  return `<div class="sd-sidehead">How I earned it</div>
    <div class="sd-panel">
      <div class="sd-panel-title">🔥 My week · chores + routine</div>
      <div class="sd-days">${days}</div>
      <div class="sd-line">${escapeHtml(`${b.streak.days} routine days · chores ${sdM(b.chorePaid)} graded`)}</div>
    </div>
    <div class="sd-panel">
      <div class="sd-panel-title">📊 My last 4 Sundays</div>
      <div class="sd-hist sd-hist--head"><span></span><span>4 wk</span><span>3 wk</span><span>2 wk</span><span>last</span><b>now</b><span class="sd-hist-avg">avg</span></div>
      ${table}
      <div class="sd-hist sd-hist--total"><span>= Total</span>${tot.map(v => `<span>${v == null ? '' : f(v)}</span>`).join('')}<b>${done ? f(c.P.tp) : '…'}</b><span class="sd-hist-avg">${have.length ? f(avgT) : ''}</span></div>
      <div class="sd-line">${escapeHtml(!done ? 'filling in as the coins fall…' : !have.length ? 'My first Sunday on the record.' : c.P.tp >= avgT ? `📈 ${sdM(c.P.tp - avgT)} above my 4-week average` : `📉 ${sdM(avgT - c.P.tp)} below my 4-week average`)}</div>
    </div>
    <div class="sd-panel sd-panel--pink">
      <div class="sd-panel-title">🏆 🎁 Results &amp; gifts</div>
      ${res.length ? res.map(x => `<div class="sd-res"><span class="sd-ellip">${escapeHtml(x.n)}</span><span class="sd-note">${escapeHtml(x.s)}</span><b>${escapeHtml(x.a)}</b></div>`).join('') : '<div class="sd-note">None this week.</div>'}
    </div>`;
}

/* ── Step 3 · I choose ── */
function sdVal(c, k) {
  const a = c.d.alloc, P = c.P;
  if (k === 'fixed') return P.minNow;
  if (k === 'ready') return money2(a.ready + (P.centsTo === 'ready' ? P.cents : 0));
  if (k === 'extra') return money2(a.extra + (P.centsTo === 'extra' ? P.cents : 0));
  return money2(a[k] || 0);
}
function sdCan(c, k) {
  if (k === 'fixed') return { ok: false, why: '📌 taken first, every week' };
  if (k === 'goal' && !c.f.chosen) return { ok: false, why: '🎯 no goal yet · ✏️ New goal on My money' };
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
  const sel = (c.d.sel || {})[SD_COL_OF[k]] === k || k === 'extra' && SD_COL_OF[k] === 'loan' && !(c.d.sel || {}).loan || k === 'spend';
  const base = { extra: `each $1 = $${(1 + b).toFixed(2)} off the wall`, spend: 'turns into real money',
    ready: `keep 🛟 $${sdRule(r, 'pots.safety')} · take out any time`, goal: 'its own jar · counts in what I own · earns nothing',
    gic: `locked ${sdRule(r, 'pots.lockWeeks')} weeks · back on a Saturday`, stock: `about ${sdRule(r, 'pots.rates.stock')}% a year · can go down` }[k];
  return (sel ? 'tap = $1 · hold 2 s = $5 · ' : 'tap to pick · ') + base;
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
    extra: [a ? `${sdM(a * (1 + b))} off the wall · free ${weeksSooner(a)} weeks sooner` : `each $1 counts as $${(1 + b).toFixed(2)} off the wall`, 'having it. It can’t come back out.'],
    gic: [`${sdM(a)} comes back as ${sdM(a * (1 + gicR * lockW / 52))} on ${sdShortDay(sdLockMaturesOn(c.wk, lockW))}, promised`, `touching it for ${lockW} weeks`],
    stock: [`${sdM(a)} could be ${sdM(a * (1 + stR))} in a year`, 'knowing what it will be worth. It can go down.'],
    ready: [aR >= safety ? `money I can reach any time · ${sdM(aR)} in Savings` : `money I can reach any time · ${sdM(safety - aR)} more to fill 🛟 $${safety}`, `the ${Math.round(b * 100)}% wall bonus`],
    goal: [`${sdM(Math.max(0, goalLeft - a))} left to my goal`, 'using it for anything else until I buy it'],
    spend: [a ? `${sdBuysOf(a, ((r.buys || {}).items) || [])} this week` : `up to $${cap} now — ${sdCapWords(sdRule(r, 'spend.capPct'))}`, 'it leaves the bank. No interest, and it is gone once spent.'],
  }[k] || null;
}
function sdChooseMain(c) {
  const d = c.d, P = c.P, r = c.rules;
  const TP = P.tp, pile = P.pile;
  const gv = SD_COLS.map(([, , keys]) => money2(keys.reduce((a, k) => a + sdVal(c, k), 0)));
  const pc = sdPercents([...gv, Math.max(0, pile)], TP);
  const live = true;
  const fresh = d.last && Date.now() - (d.lastAt || 0) < 1100;
  let cum = 0;
  const cols = SD_COLS.map(([id, title, keys, idea], i) => {
    const v = gv[i], start = TP ? cum / TP * 100 : 0, h = TP ? v / TP * 100 : 0; cum += v;
    const selK = id === 'loan' ? 'extra' : id === 'spend' ? 'spend' : ((d.sel || {}).grow || 'ready');
    const lessOk = (d.alloc[selK] || 0) > 0;
    const segs = keys.filter(k => sdVal(c, k) > 0).map(k => `<i class="sd-seg ${'sd-seg--' + k}" style="flex:${sdVal(c, k)} 0 0">${TP && sdVal(c, k) / TP > 0.06 ? SD_SUBS[k].split(' ')[0] : ''}</i>`).join('');
    const cells = keys.map(k => {
      const fixed = k === 'fixed';
      const can = sdCan(c, k);
      const isSel = !fixed && (k === selK);
      const hot = d.last && d.last.k === k;
      const vk = sdVal(c, k);
      const amt = vk > 0 && vk < 1 ? Math.round(vk * 100) + '¢' : (vk % 1 ? sdM(vk) : '$' + vk);
      const fly = fresh && hot && d.last.d > 0 ? `<span class="sd-fly" aria-hidden="true">${d.last.n >= 5 ? '$5' : '$1'}</span>` : '';
      return `<button type="button" class="sd-cell ${'sd-cell--' + k}${isSel ? ' sel' : ''}${hot ? ' hot' : ''}${!can.ok && !fixed ? ' lock' : ''}${fixed ? ' fixed' : ''}" data-sd-cell="${k}" aria-label="${escapeAttr(SD_SUBS[k] + ' ' + amt)}">
          <span class="sd-cell-strip"></span><span class="sd-cell-label">${escapeHtml(SD_SUBS[k])}</span><b>${escapeHtml(amt)}</b>
          <span class="sd-cell-hold" style="width:${sdPress && sdPress.k === k ? Math.round(sdPress.p || 0) : 0}%"></span>${fly}</button>`;
    }).join('');
    const capPct = sdRule(r, 'spend.capPct');
    const cap = sdFloor(P.hers * capPct / 100);
    const note = id === 'loan' ? `🧱 each $1 extra = $${(1 + sdRule(r, 'loan.extraBonusPct') / 100).toFixed(2)} off the wall`
      : id === 'spend' ? (d.alloc.spend >= cap ? `👛 full · ${sdCapWords(capPct)} of my share` : `👛 up to $${cap} · ${sdCapWords(capPct)} of my share`) : '';
    return `<div class="sd-col ${'sd-col--' + id}">
        <div class="sd-col-head"><span class="sd-col-title sd-ellip">${escapeHtml(title)}</span><button type="button" class="sd-ask-q" data-mny-action="sd-help" data-sd-col="${id}" aria-label="What is this?">?</button></div>
        <div class="sd-col-amt"><b>${escapeHtml(sdM(v))}</b><span class="sd-pill">${escapeHtml(sdPercentLabel(pc[i], v))}</span>
          <button type="button" class="sd-step${lessOk ? '' : ' off'}" data-mny-action="sd-less" data-sd-col="${id}" aria-label="Take $1 back">−</button></div>
        <div class="sd-fall"><span class="sd-fall-top" style="bottom:${Math.min(100, start + h).toFixed(2)}%"></span>
          <span class="sd-fall-bar${h >= 1 ? ' edge' : ''}" style="bottom:${start.toFixed(2)}%;height:${h.toFixed(2)}%">${segs}</span></div>
        <div class="sd-cells${keys.length > 1 ? ' two' : ''}">${cells}</div>
        ${note ? `<div class="sd-note">${escapeHtml(note)}</div>` : ''}
      </div>`;
  }).join('');
  const presets = sdPresets(c.w, r).map(p => `<button type="button" class="sd-chip${d.presetId === p.id ? ' on' : ''}${p.locked ? ' lock' : ''}" data-mny-action="sd-preset" data-sd-p="${p.id}">${escapeHtml(p.label)}</button>`).join('');
  const lk = d.last ? d.last.k : null;
  const gg0 = lk ? sdGetGive(c, lk) : null;
  const gg = gg0 && d.last && d.last.d < 0 ? [`↩ $${d.last.n} back in my pile. ` + gg0[0], gg0[1]] : gg0;
  const tip = d.tried ? sdHints(c, d.tried) : lk ? sdHints(c, lk) : 'tap a box to pick it · tap again = $1 · hold 2 s = $5';
  const nudge = Date.now() < sdNudgeUntil;
  const signing = sdSignHold ? sdSignHold.p : 0;
  const centsTxt = P.cents ? ` · 🪙 ${Math.round(P.cents * 100)}¢ change → ${P.centsTo === 'ready' ? 'Savings' : '🧱 loan'}` : '';
  const sum = `🧱 ${sdM(gv[0])} + 👛 ${sdM(gv[1])} + 🌱 ${sdM(gv[2])}${pile > 0 ? ' + 💰 $' + pile + ' left' : ''} = ${sdM(TP)}${pile > 0 ? '' : ' ✓'}${centsTxt}`;
  return `<div class="sd-choosehead">
      <div class="sd-pilechip"><span class="sd-pilecoins" aria-hidden="true"><i></i><i></i></span>
        <span class="sd-pilechip-text"><span class="sd-note">${escapeHtml(P.pullTot ? `payday ${sdM(money2(P.payday - P.advTaken))} + bank ${sdM(P.pullTot)}` : 'my pile')}</span><b>${escapeHtml(sdM(TP))}</b></span></div>
      <div class="sd-title">🤝 What I do with it</div>
      <button type="button" class="sd-sign${pile > 0 ? '' : ' ready'}${nudge ? ' shake' : ''}" data-sd-sign="1" aria-label="${escapeAttr(pile > 0 ? `Place $${pile} first` : 'Hold to sign my plan')}">
        <span class="sd-sign-fill" style="width:${signing}%"></span>
        <b>${escapeHtml(pile > 0 ? '$' + pile + ' left' : (signing > 0 ? 'Keep holding…' : '✍️ Hold to sign'))}</b>
        <span>${escapeHtml(pile > 0 ? (nudge ? `👇 place $${pile} first, then hold` : `${sdPercentLabel(pc[3], pile)} of my week still to place`) : '100% placed ✓ · this is my plan')}</span>
      </button>
    </div>
    <div class="sd-presets">
      <button type="button" class="sd-btn" data-mny-action="sd-back" data-sd-to="1">◀ My pile</button>
      ${presets}
      <button type="button" class="sd-chip" data-mny-action="sd-clear">↺ All back</button>
      <button type="button" class="sd-chip${d.focus === 'all' ? ' dark' : ''}" data-mny-action="sd-all">📊 Everything</button>
    </div>
    <div class="sd-cols">${cols}</div>
    <div class="sd-sum">${escapeHtml(sum)}</div>
    <div class="sd-gg${gg ? '' : ' empty'}">
      <b class="sd-gg-get">${escapeHtml(lk ? SD_SUBS[lk] : '👆 Tap a box to pick it')} · I get</b><span>${escapeHtml(gg ? gg[0] : 'what each dollar does shows up here.')}</span>
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
  const payNow = money2(P.minNow + sdVal(c, 'extra') * (1 + b));
  const oweAfter = money2(Math.max(0, left - payNow));
  const lk = d.last ? d.last.k : null;
  const hk = d.focus === 'all' ? 'all' : ({ fixed: 'loan', extra: 'loan', ready: 'ready', goal: 'goal', gic: 'gic', stock: 'stock' })[lk] || null;
  const hot = id => hk === 'all' || hk === id;
  const dim = id => !!hk && hk !== 'all' && hk !== id;
  const burst = id => (hot(id) && d.last && Date.now() - (d.lastAt || 0) < 1300) ? '<span class="sd-burst" aria-hidden="true">🎆✨</span>' : '';
  let bricks = '';
  if (PR > 0) {
    const bz = PR / 100, pd = PR - left + Math.min(0, 0);
    bricks = Array.from({ length: 100 }, (_, i) => {
      const got = Math.max(0, Math.min(bz, pd - i * bz)), pend = Math.max(0, Math.min(bz, pd + payNow - i * bz));
      return `<span class="sd-brick${got >= bz - 1e-9 ? ' full' : ''}${pend > got ? ' plan' : ''}"><i style="width:${(pend / bz * 100).toFixed(1)}%"></i></span>`;
    }).join('');
  }
  const perPlan = w.loan.weekly + sdVal(c, 'extra') * (1 + b);
  const free = perPlan > 0 && left > 0 ? sdMonthYear(c.wk, Math.ceil(left / perPlan)) : '—';
  const rate = sdRule(r, 'loan.ratePct'), every = sdRule(r, 'loan.interestEverySundays');
  const maxA = d.scaleMax || Math.max(20, Math.ceil((Math.max(w.pots.ready, w.pots.gic, w.pots.stock) + P.hers + 1) / 10) * 10);
  const safety = sdRule(r, 'pots.safety');
  const aR = money2(w.pots.ready - (w.pull.ready || 0) + sdVal(c, 'ready'));
  const aG = money2(w.pots.gic + d.alloc.gic), aS = money2(w.pots.stock + d.alloc.stock);
  const goalNow = w.pots.goal, goalTo = money2(goalNow + d.alloc.goal);
  const ownNow = money2(w.pots.ready + w.pots.goal + w.pots.gic + w.pots.stock);
  const ownAfter = money2(aR + goalTo + aG + aS);
  const lockW = sdRule(r, 'pots.lockWeeks');
  const arow = (id, name, a0, a1, sub) => {
    const dd = money2(a1 - a0), up = dd >= 0;
    const lockedTxt = (id === 'gic' || id === 'stock') && !sdIsOpen(id, w, r) ? `🔒 opens at ${sdRule(r, 'school.stagePct.' + SD_GATE_STAGE[id])}% paid` : sub;
    return `<div class="sd-own${hot(id) ? ' hot' : ''}${dim(id) ? ' dim' : ''}">
        <span class="sd-ellip">${escapeHtml(name)}</span>
        <span class="sd-ownbar">${id === 'ready' ? `<span class="sd-safe" style="left:${(safety / maxA * 100).toFixed(1)}%"></span>` : ''}<i class="now" style="width:${((up ? a0 : a1) / maxA * 100).toFixed(1)}%"></i><i class="${up ? 'plan' : 'out'}" style="width:${(Math.abs(dd) / maxA * 100).toFixed(1)}%"></i></span>
        <span class="sd-own-d${up ? '' : ' neg'}">${dd > 0 ? '+' + sdM(dd) : dd < 0 ? sdM(dd) : ''}</span><b>${escapeHtml(sdM(a1))}</b>
        <span class="sd-own-sub">${escapeHtml(lockedTxt)}</span></div>`;
  };
  const club = mnyClubOwes(c.kid);
  const clubA = money2(club.amount + c.f.b.sessionsPaid);
  const g = c.f.chosen;
  const GT = c.w.goal ? c.w.goal.target : 0;
  const goalPicker = c.f.goals.length > 1 ? `<div class="sd-goalpick">${c.f.goals.map(x => `<button type="button" class="sd-chip${g && g.id === x.id ? ' on' : ''}" data-mny-action="sd-goalpick" data-sd-goal="${escapeAttr(x.id)}">${escapeHtml((x.icon || '🎯') + ' ' + x.name)}</button>`).join('')}</div>` : '';
  return `<div class="sd-sidehead">${escapeHtml(words >= 3 ? '💼 Assets & debt' : '💼 What I have & owe')}</div>
    <div class="sd-panel sd-wall${hot('loan') ? ' hot' : ''}${dim('loan') ? ' dim' : ''}">${burst('loan')}
      <div class="sd-panel-head"><span class="sd-panel-title">${escapeHtml(words >= 3 ? '🧱 Debt' : '🧱 I owe')}</span><b class="sd-violet">${escapeHtml(payNow ? `${sdM(left)} → ${sdM(oweAfter)}` : sdM(left))}</b></div>
      ${PR > 0 ? `<div class="sd-bricks" role="img" aria-label="${escapeAttr(Math.round(sdPaidPct(w.loan)) + '% of the loan paid')}">${bricks}</div>` : '<div class="sd-note">Nothing to pay back.</div>'}
      <span class="sd-line">${escapeHtml(`🟩 paid · 🟨 this plan · free by ${free}${facts.rows.length ? ' · ' + facts.rows.filter(x => x.left > 0).map(x => x.icon + ' ' + x.name).join(' · ') : ''}`)}</span>
      <span class="sd-red">${escapeHtml(facts.lastInterest > 0 ? `🟥 +${sdM(facts.lastInterest)} interest added (${rate}% a year, every ${every} Sundays)` : `${rate}% a year interest, added every ${every} Sundays`)}</span>
    </div>
    <div class="sd-panel sd-ownbox${['ready', 'gic', 'stock'].some(hot) && hk ? ' hot' : ''}">${burst('ready') || burst('gic') || burst('stock')}
      <div class="sd-panel-head"><span class="sd-panel-title">${escapeHtml(words >= 3 ? '✅ Assets' : '✅ What I own')}</span><b class="sd-teal">${escapeHtml(ownNow === ownAfter ? sdM(ownNow) : `${sdM(ownNow)} → ${sdM(ownAfter)}`)}</b></div>
      <div class="sd-key"><span><i class="sd-sw now"></i>now</span><span><i class="sd-sw plan"></i>this plan</span><span><i class="sd-sw out"></i>taken out</span><span><i class="sd-sw safe"></i>🛟 $${safety} safety</span></div>
      ${arow('ready', '🏦 Savings', w.pots.ready, aR, aR >= safety ? `🛟 $${safety} safety + ${sdM(aR - safety)} I can use` : `🛟 fill to $${safety} first`)}
      ${arow('gic', '🔒 Locked away', w.pots.gic, aG, d.alloc.gic ? `back ${sdShortDay(sdLockMaturesOn(c.wk, lockW))}` : `${lockW} weeks at a time`)}
      ${arow('stock', '📈 Companies', w.pots.stock, aS, 'worth more or less each week')}
      <div class="sd-line">${escapeHtml(`🎯 goal jar counted in the total · 🧾 Club owes me ${sdM(clubA)} (assistant job · paid twice a year)`)}</div>
    </div>
    <div class="sd-panel sd-panel--pink sd-goaljar${hot('goal') ? ' hot' : ''}${dim('goal') ? ' dim' : ''}">${burst('goal')}
      <span class="sd-jar" aria-hidden="true"><i class="to" style="height:${GT ? Math.min(100, goalTo / GT * 100).toFixed(1) : 0}%"></i><i class="now" style="height:${GT ? Math.min(100, goalNow / GT * 100).toFixed(1) : 0}%"></i></span>
      <div class="sd-jar-body">
        <span class="sd-panel-title sd-ellip">${escapeHtml(g ? (g.icon || '🎯') + ' ' + g.name : '🎯 No goal yet')}</span>
        <b class="sd-red">${escapeHtml(g ? (goalNow === goalTo ? `${sdM(goalTo)} of ${sdM(GT)}` : `${sdM(goalNow)} → ${sdM(goalTo)} of ${sdM(GT)}`) : '')}</b>
        <span class="sd-note">${escapeHtml(!g ? '✏️ New goal on My money asks Dad for one' : !sdIsOpen('ready', w, r) ? `🔒 Goal jars open with Savings, at ${sdRule(r, 'school.stagePct.ready')}% paid` : goalTo >= GT ? '🎉 reached! ask Dad to buy it' : `its own jar · counts in what I own · earns nothing · ${sdM(GT - goalTo)} to go`)}</span>
        ${goalPicker}
      </div>
    </div>`;
}

/* ── Step 4 · Signed ── */
function sdSignedFromLedger(kid, wk) {
  const row = (((state.shared.chore.moneyLedger || {})[wk] || {})[kid]) || null;
  if (!row || !row.sunday) return null;
  return { signed: row.sunday.signed, after: row.sunday.after, crossed: row.sunday.crossed, w: row.sunday.w };
}
function sdSignedMain(c) {
  const d = c.d, s = d.signed;
  if (!s || !s.signed) {
    return `<div class="sd-title">✍️ Signed.</div>
      <div class="sd-line">${escapeHtml(c.name)}'s money for this week has moved. The passbook on My money has the week.</div>
      <div class="sd-row"><span class="sd-sigline">${escapeHtml(c.name)} ✓</span>
        <button type="button" class="sd-go" data-mny-action="sd-next">Next Sunday →</button></div>`;
  }
  const sg = s.signed, w = Object.assign({}, s.w, { alloc: {} }), r = c.rules;
  const res = { signed: sg, after: Object.assign({ pots: s.after.pots, left: s.after.left, loan: s.after.loan }, s.after) };
  const v = sdVerdicts(res, w, r);
  const words = c.words;
  const incT = money2(sg.inSteady + sg.inBonus + sg.inBank) || 1;
  const L = sg.lines || [];
  const g = sdGroupNames(words);
  const inRows = [];
  const add = (k, val, cls, opts) => inRows.push(Object.assign({ k, v: val, cls, dir: 1 }, opts || {}));
  const earnedLines = L.filter(x => ['jobs', 'streak', 'pa', 'comp'].indexOf(x[0]) >= 0 && x[2] >= 0.005);
  const earnedT = money2(earnedLines.reduce((a, x) => a + x[2], 0));
  if (earnedT) { add(g.earned, earnedT, 'earned', { head: true }); earnedLines.forEach(x => add(x[1], x[2], 'earned')); }
  const gifts = L.filter(x => x[0] === 'gifts' && x[2] >= 0.005);
  if (gifts.length) { add(g.given, money2(gifts.reduce((a, x) => a + x[2], 0)), 'given', { head: true }); }
  if (sg.inBank > 0.004) add('🏦 From my bank', sg.inBank, 'bank', { head: true });
  const lockW = sdRule(r, 'pots.lockWeeks');
  const cashOut = money2(sg.wallet - (sg.adv || 0));
  const outList = [['📦 Fine', -(sg.outFine || 0), 'fine'], ['⏪ Spent in advance', sg.adv || 0, 'adv'],
    [sg.extra ? `🧱 Loan · counts ${sdM(sg.pay)}` : '🧱 Loan', sg.loanCash, 'wall'], ['💵 Cash out', cashOut, 'cash'],
    ['🏦 Savings', sg.ready, 'saved'], [(w.goal ? w.goal.name : '🎯 Goal'), sg.goal || 0, 'goal'],
    [`🔒 Locked · back ${sdShortDay(sdLockMaturesOn(c.wk, lockW))}`, sg.gic, 'locked'], ['📈 Companies', sg.stock, 'stock']]
    .filter(x => x[1] > 0.004);
  const mx = Math.max(0.01, ...inRows.map(x => x.v), ...outList.map(x => x[1]));
  const pc = val => Math.round(val / incT * 100) + '%';
  const row = (k, val, cls, dir, head) => `<div class="sd-flow${head ? ' head' : ''}">
      <span class="sd-ellip">${escapeHtml(k)}</span>
      <span class="sd-flow-out">${dir < 0 ? `<i class="sd-fill--${cls}" style="width:${(val / mx * 100).toFixed(1)}%"></i>` : ''}</span>
      <span class="sd-flow-in">${dir > 0 ? `<i class="sd-fill--${cls}" style="width:${(val / mx * 100).toFixed(1)}%"></i>` : ''}</span>
      <span class="sd-flow-pct">${dir > 0 ? pc(val) : ''}</span><b>${escapeHtml(sdM(val))}</b></div>`;
  const io = sdCheckInOut(sg);
  const tone = { good: 'good', warn: 'warn', bad: 'bad', neutral: 'neutral' };
  const milestone = s.crossed ? `<div class="sd-milestone">${escapeHtml(`🔓 ${sdRule(r, 'school.stagePct.' + SD_GATE_STAGE[s.crossed])}% paid back! "${{ ready: 'Savings', gic: 'Locked away', stock: 'Companies' }[s.crossed]}" is open. Next Sunday I can put money there.`)}</div>` : '';
  const stick = (sg.stickers || sdStickersFor(sg)).map(id => SD_STICKERS.find(x => x[0] === id)).filter(Boolean);
  const say = `I put ${sdM(sg.loanCash)} on my loan${sg.extra ? ` (it counted as ${sdM(sg.pay)})` : ''}, so I owe ${sdM(s.after.left)} now. ${sdM(money2(sg.ready + (sg.goal || 0) + sg.gic + sg.stock))} is saved${cashOut > 0 ? ` and ${sdM(cashOut)} comes out as cash today` : ', and no cash this week'}.`;
  const redo = isParent() && mmUndoHeld(c.kid);
  const gone = mmUndoKidGone[c.kid];
  return `<div class="sd-title">✍️ Signed. This is my plan.</div>
    ${milestone}
    <div class="sd-inout">
      <div class="sd-inout-head"><span class="sd-box-title">${escapeHtml(words >= 2 ? '⇅ Cash flow' : '⇅ Money in & out')}</span><span class="sd-note">${escapeHtml('Sunday ' + mnyDayMonth(sdSundayOf(c.wk)))}</span><span class="sd-stamp">MY PLAN</span></div>
      <div class="sd-inout-part">
        <div class="sd-flows">
          <div class="sd-flow head"><span class="sd-box-title">💰 Money in</span><span class="sd-note">◀ out</span><span class="sd-note">in ▶</span><span></span><b class="sd-teal">${escapeHtml(sdM(io.in))}</b></div>
          ${inRows.map(x => row(x.k, x.v, x.cls, 1, x.head)).join('')}
        </div>
        <div class="sd-verdict ${'sd-verdict--' + (tone[v.income.tone] || 'neutral')}"><b>${escapeHtml(v.income.head)}</b>${v.income.lines.map(t => `<div>${escapeHtml(t)}</div>`).join('')}</div>
      </div>
      <div class="sd-dash"></div>
      <div class="sd-inout-part">
        <div class="sd-flows">
          <div class="sd-flow head"><span class="sd-box-title">💸 Money out</span><span></span><span></span><span></span><b>${escapeHtml(sdM(io.out))} ${io.ok ? '✓' : ''}</b></div>
          ${outList.map(x => row(x[0], x[1], x[2], -1)).join('')}
        </div>
        <div class="sd-verdict ${'sd-verdict--' + (tone[v.strategy.tone] || 'neutral')}"><b>${escapeHtml(v.strategy.head)}</b>${v.strategy.lines.map(t => `<div>${escapeHtml(t)}</div>`).join('')}</div>
      </div>
    </div>
    <div class="sd-say">Say it out loud: “${escapeHtml(say)}”</div>
    <div class="sd-row">
      ${redo ? '<button type="button" class="sd-btn" data-mny-action="sd-redo">↺ Redo my plan</button>'
        : (gone && gone.wk === c.wk ? `<span class="sd-note">${escapeHtml(MM_UNDO_GONE_SENTENCE)}</span>` : '')}
      <span class="sd-sigline">${escapeHtml(c.name)} ✓</span>
      <div class="sd-sticker"><b>⭐ Sticker:</b> ${escapeHtml(stick.length ? stick.map(x => x[1] + ' ' + x[2]).join(' · ') : 'None this week — try a bigger move next Sunday.')}</div>
      <button type="button" class="sd-go" data-mny-action="sd-next">Next Sunday →</button>
    </div>`;
}
function sdSignedSide(c) {
  const d = c.d, s = d.signed;
  if (!s || !s.signed) return '';
  const sg = s.signed, r = c.rules;
  const hist = c.f.hist;
  const steadyAvg = hist.length ? hist.reduce((a, x) => a + x.steady, 0) / hist.length : sg.inSteady;
  const exp = mnyEnsureExpected(c.kid);
  const months = Array.from({ length: 5 }, (_, i) => {
    const dd = formatDayKey(String(sdSundayOf(c.wk)).slice(0, 8) + '01'); dd.setMonth(dd.getMonth() + i + 1);
    const key = ctDateToKey(dd).slice(0, 7);
    const evs = exp.filter(e => e && e.month === key);
    return { k: MONTH_SHORT[dd.getMonth()], st: steadyAvg, bn: money2(evs.reduce((a, e) => a + money2(e.amount), 0) / 4.3), ev: evs.map(e => String(e.label || '').split(' ')[0]).join(''), kind: 'future' };
  });
  const rows = [...hist.map((x, i) => ({ k: ['4 wk', '3 wk', '2 wk', 'last'][i + 4 - hist.length], st: x.steady, bn: x.bonus, ev: '', kind: 'past' })),
    { k: 'now', st: sg.inSteady, bn: sg.inBonus, ev: '', kind: 'now' }, ...months];
  const tMax = Math.max(1, ...rows.map(x => x.st + x.bn)) * 1.05;
  const avgW = hist.length ? hist.reduce((a, x) => a + x.steady + x.bonus, 0) / hist.length : 0;
  const tl = rows.map(x => `<div class="sd-tl-col ${x.kind}"><span class="sd-tl-ev">${escapeHtml(x.ev)}</span>
      <span class="sd-tl-bars"><i class="bn" style="height:${(x.bn / tMax * 100).toFixed(1)}%"></i><i class="st" style="height:${(x.st / tMax * 100).toFixed(1)}%"></i></span>
      <span class="sd-tl-k">${escapeHtml(x.k)}</span></div>`).join('');
  const fw = sdForecast({ signed: sg, after: s.after }, Object.assign({}, s.w), r, d.tmW || 4);
  const choices = [[1, '1 wk'], [4, '1 mo'], [20, '5 mo']].map(([n, l]) => `<button type="button" class="sd-chip${(d.tmW || 4) === n ? ' dark' : ''}" data-mny-action="sd-tm" data-sd-n="${n}">${l}</button>`).join('');
  return `<div class="sd-panel">
      <div class="sd-panel-head"><span class="sd-panel-title">📅 My timeline</span>
        <span class="sd-key"><span><i class="sd-sw st"></i>steady</span><span><i class="sd-sw bn"></i>bonus</span><span><i class="sd-sw avg"></i>avg</span></span></div>
      <div class="sd-tl">${hist.length ? `<span class="sd-tl-avg" style="bottom:${(avgW / tMax * 100).toFixed(1)}%"><span>avg ${escapeHtml(sdM(avgW))}</span></span>` : ''}${tl}</div>
    </div>
    <div class="sd-panel">
      <div class="sd-panel-head"><span class="sd-panel-title">🔮 If every week is like this</span><span class="sd-tm">${choices}</span></div>
      <div class="sd-fw-earn"><span>💰 This week I earned</span><b>${escapeHtml(fw.fwEarn)}</b><span class="sd-note">${escapeHtml(fw.fwTimes)}</span><b class="sd-red">${escapeHtml(fw.fwEarnT)}</b></div>
      <div class="sd-panel-head"><span>🧱 I owe</span><span class="sd-note sd-teal">${escapeHtml(fw.fwFree)}</span></div>
      <span class="sd-note">${escapeHtml(fw.fwAssume)}</span>
      ${fw.fwLoan.map(x => `<div class="sd-fw-loan"><span>${escapeHtml(x.k)}</span><span class="sd-bar"><i class="${x.k === 'now' ? 'wall' : 'wall2'}" style="width:${Math.min(100, x.w).toFixed(1)}%"></i></span><b>${escapeHtml(x.v)}</b></div>`).join('')}
      <div class="sd-fw-save head"><span>✅ I own</span><span>I put in</span><span>it earns</span><span>then</span></div>
      ${fw.fwSave.map(x => `<div class="sd-fw-save${x.locked ? ' dim' : ''}"><span class="sd-ellip">${escapeHtml(x.k)}</span><span>${escapeHtml(x.put)}</span><span class="sd-teal">${escapeHtml(x.earn)}</span><b>${escapeHtml(x.then)}</b></div>`).join('')}
      <div class="sd-fw-save total"><b>= Total</b><b>${escapeHtml(fw.fwPutT)}</b><b class="sd-teal">${escapeHtml(fw.fwEarnI)}</b><b>${escapeHtml(fw.fwThenT)}</b></div>
      <div class="sd-note">${escapeHtml(fw.fwNote)}</div>
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
  const verdict = isSur ? `My safety money wasn't enough, so ${sdM(row.principal)} went on my wall. 🏦 Savings fills first until it's back to $${sdRule(c.rules, 'pots.safety')}.`
    : over ? `⚠️ My loan takes ${pct(p1)}% of my steady money, more than half. Dad's limit is 50%.` : '✅ Still under half of my steady money. Dad\'s limit is 50%.';
  return `<div class="sd-scrim"><div class="sd-newrow" role="dialog" aria-modal="true" aria-label="${escapeAttr(isSur ? 'A surprise cost' : 'New row on my wall')}">
      <div class="sd-title">${isSur ? '🌧️ A surprise cost' : '🆕 New row on my wall'}</div>
      <div class="sd-newrow-what">${escapeHtml(row.name + ' · ' + sdM(row.principal) + ' added')}</div>
      ${lines.map(([k, v, cls]) => `<div class="sd-newrow-line"><span>${escapeHtml(k)}</span><b class="${cls ? 'sd-' + cls : ''}">${escapeHtml(v)}</b></div>`).join('')}
      <div class="sd-newrow-verdict${over || isSur ? ' warn' : ''}">${escapeHtml(verdict)}</div>
      ${over ? `<div class="sd-note">How could I get back under half? ⛸️ One more club session · 🧹 More chores · 👨 Ask Dad: smaller share or longer time</div>` : ''}
      <button type="button" class="sd-go" data-mny-action="sd-newok" data-sd-id="${escapeAttr(row.id)}">I understand →</button>
    </div></div>`;
}

/* ── 🗣️ Dad's card (a sheet: ASK / SAY / WAIT for the step) ── */
function sdDadScript(c) {
  const P = c.P, hist = c.f.hist;
  const lastWeek = hist.length ? Math.round(hist[hist.length - 1].inAmt) : 0;
  const avg = hist.length ? hist.reduce((a, r) => a + r.inAmt, 0) / hist.length : 0;
  return [
    [['ASK', 'Did you do your Sunday routine? Tick it on the 🔥 Routine tile — it counts the day.'],
     ['ASK', 'Tick your club sessions first. That is your biggest money. Then tap the rest.'],
     ['SAY', 'Only what Dad said yes to counts today. Anything still waiting stays out of your guess.'],
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
  body.innerHTML = `<div class="sd-dadcard">
      <div class="sd-panel-head"><span class="sd-note">${escapeHtml(['Step 1 · Guess', 'Step 2 · Payday', 'Step 3 · Choose', 'Step 4 · Sign'][step])} · ${escapeHtml(c.name)}</span></div>
      ${sdDadScript(c).map(([k, v]) => `<div class="sd-script-line ${'sd-script-line--' + k.toLowerCase()}"><b>${k}</b>${escapeHtml(v)}</div>`).join('')}
      ${step === 0 && sun.asked ? `<div class="sd-note">${sun.done ? '✓ Sunday routine ticked' : '○ Sunday routine not ticked yet'}</div>` : ''}
      <div class="sd-teal">${escapeHtml(check)}</div>
      <button type="button" class="sd-go" data-mny-action="sd-dadclose">Back to her</button>
    </div>`;
  openSheet('sundayOverlay');
}

/* ════════════════════════════════════════════════════════════════
   ACTIONS
   ════════════════════════════════════════════════════════════════ */
function sdRerender() { if (typeof renderMeetingMode === 'function') renderMeetingMode(); }
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
  if (a === 'sd-dadclose') { closeSheet('sundayOverlay'); return; }
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
    if (!d.guess || sdUnsettled(kid, wk).total) { sdBeep(220); showToast(d.guess ? 'Dad answers first →' : 'Pick a guess first'); return; }
    const pct = Number(mrRuleOr(mrRulesForWeek(wk), 'market.wobblePct')) || 0;
    if (pct > 0 && isParent()) mnyRevalueStock(kid, -pct, { weekKey: wk, note: '📉 Companies dipped this week' });
    sdSetStep(d, 1); sdStartCount(d); sdRerender(); return;
  }
  if (a === 'sd-back') { clearInterval(sdCountTimer); sdSetStep(d, Number(el.getAttribute('data-sd-to')) || 0); if (d.step === 1) d.shown = 6; sdSave(d); sdRerender(); return; }
  if (a === 'sd-line') { const t = 'w:' + el.getAttribute('data-sd-tile'); d.editTile = d.editTile === t ? null : t; sdSave(d); sdRerender(); return; }
  if (a === 'sd-edit') { const t = 'e:' + el.getAttribute('data-sd-tile'); d.editTile = d.editTile === t ? null : t; sdSave(d); sdRerender(); return; }
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
  if (a === 'sd-less') {
    const col = el.getAttribute('data-sd-col');
    const k = col === 'loan' ? 'extra' : col === 'spend' ? 'spend' : ((d.sel || {}).grow || 'ready');
    sdPlaceIn(sdContext(kid, wk), k, -1, 1); sdRerender(); return;
  }
  if (a === 'sd-help') {
    const col = el.getAttribute('data-sd-col');
    sdBeep(600);
    if (col === 'grow') mnyShowConcept((d.sel || {}).grow || 'ready', { tabs: SD_GROW_TABS });
    else mnyShowConcept(col === 'loan' ? 'debt' : 'spend');
    return;
  }
  if (a === 'sd-goalpick') { d.goalId = el.getAttribute('data-sd-goal'); sdSave(d); sdRerender(); return; }
  if (a === 'sd-tm') { d.tmW = Number(el.getAttribute('data-sd-n')) || 4; sdSave(d); sdRerender(); return; }
  if (a === 'sd-redo') {
    if (mmUndoRecord(kid)) { sdBeep(500); d.step = 2; d.signed = null; d.last = null; sdSave(d); }
    sdRerender(); return;
  }
  if (a === 'sd-next') {
    const other = kid === 'jenn' ? 'jess' : 'jenn';
    if (!mnyIsCommitted(wk, other)) mnySetMeetKid(other); else mmGoTo('close');
    return;
  }
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
  if (a === 'sd-pay') {
    const r = mnyEnsureRequests(kid).find(x => x && x.id === id);
    if (r) mnySetRequestPay(kid, id, money2((r.pay != null ? Number(r.pay) : rqResultPay(kid, r)) + num));
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
  const isSel = !fixed && (col === 'loan' ? k === 'extra' : col === 'spend' ? true : (d.sel || {}).grow === k);
  const pick = (snd) => {
    sdBeep(snd); sdSelTap = true;
    if (!fixed) d.sel = Object.assign({}, d.sel || {}, { [col]: k });
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
      sdPlaceIn(sdContext(kid, wk), kk, 1, 5);
      sdRerender();
    }
  }, 40);
}
function sdCellUp(k) {
  if (sdSelTap) { sdSelTap = false; return; }
  if (!sdPress) return;
  clearInterval(sdPress.timer);
  const was = sdPress; sdPress = null;
  if (!was.fired && was.k === k) { sdPlaceIn(sdContext(mnyMeetingKid(), mmWeekKey()), k, 1, 1); }
  sdRerender();
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
    sdSignHold.p = Math.min(100, sdSignHold.p + 10);
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
