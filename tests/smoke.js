// Headless-browser smoke test for index.html.
// Run: npm install playwright-core && node tests/smoke.js
// Boots the app offline (Firebase errors are ignored), seeds a test week, and
// drives the main flows. Prints a JSON report; exits non-zero on any failure
// or unexpected console error. Screenshots land in tests/out/.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

function findChromium() {
  if (process.env.SMOKE_CHROMIUM) return process.env.SMOKE_CHROMIUM;
  const roots = ['/opt/pw-browsers'];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const d of fs.readdirSync(root)) {
      const p = path.join(root, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined; // fall back to playwright's own resolution
}

(async () => {
  const outDir = path.join(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const shot = (name) => path.join(outDir, name + '.png');

  const browser = await chromium.launch({ executablePath: findChromium() });
  const page = await browser.newPage({ viewport: { width: 900, height: 1100 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    if (m.type() === 'error' && !/firestore|firebase|net::|CORS|fetch/i.test(m.text())) errors.push(m.text());
  });

  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(1200);

  // ── Seed a kid week: school day, piano, Saturday training with buffers ──
  await page.evaluate(() => selectProfile('jenn'));
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const keys = getDayKeys(0);
    setDayBlocks(keys[0], [
      { id:'t1', actId:'breakfast', startMin: 7*60+30, durationMin: 30, checklistState:{} },
      { id:'t2', actId:'school_day', startMin: 9*60, durationMin: 360, checklistState:{} },
      { id:'t3', actId:'piano', startMin: 16*60, durationMin: 60, checklistState:{} },
    ]);
    setDayBlocks(keys[5], [
      { id:'t4', actId:'training', startMin: 17*60+30, durationMin: 120, tag:'skating',
        travelBuffer: true, travelBufMin: 30, getReadyBuffer: true, getReadyBufMin: 15, checklistState:{} },
    ]);
    goWeek();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: shot('week_full') });

  const checks = {};

  // Weekly view: Y-axis sideband + hour lines + slot tint bands
  checks.weekSideband = await page.evaluate(() =>
    document.querySelectorAll('.wf-sideband-seg').length === 4);
  checks.weekHourLines = await page.evaluate(() =>
    document.querySelectorAll('.wf-hour-line').length > 0);

  // Kid money surface: kids reach Pocket Money and may LOOK at the bank, but
  // every function that moves money refuses them.
  checks.kidMoneyLabel = await page.evaluate(() =>
    document.getElementById('weekMoneyBtn').textContent.includes('My money'));
  // The money button lands a kid on her own page, and that page shows the four
  // things she owns and what she still owes.
  checks.kidCanOpenMyMoney = await page.evaluate(() => {
    openWeekMoney();
    const txt = document.getElementById('mnyPage1Wrap').textContent;
    return document.getElementById('screen-mymoney').classList.contains('active')
        && txt.includes('Everything I have')
        && txt.includes('Cash') && txt.includes('Locked away');
  });
  // The rules editor is not on a kid's page at all — there is nothing to hide.
  checks.kidHasNoRulesOnHerPage = await page.evaluate(() => {
    const txt = document.getElementById('mnyPage1Wrap').textContent;
    return !document.getElementById('mnyPage1Wrap').querySelector('[data-pm-action="edit"]')
        && !txt.includes('Rules &');
  });
  // A kid can walk to her own history and back without a grown-up.
  checks.kidCanReadHerStory = await page.evaluate(() => {
    mnyOpenStory();
    return document.getElementById('screen-moneystory').classList.contains('active')
        && document.getElementById('mnyStoryWrap').textContent.includes('My money story');
  });
  // Kids may look at what they own, but the balances must not move when a kid
  // tries to transact.
  checks.kidCannotTransact = await page.evaluate(() => {
    const kid = activeProfile();
    const wrap = document.getElementById('mnyPage1Wrap');
    // Her page has no control that moves money — not a disabled one, none.
    const noMovers = !wrap.querySelector('[data-mny-action="commit"], [data-mnyp-action]');
    // And the guard the commit path leans on refuses her.
    const guarded = moneyCanTransact() === false;
    // Her earnings are not hers to change either.
    const cannotOverride = mnySetOverride(kid, mnyWeekKey(), 'chores', 99, 'fixing') === false;
    return noMovers && guarded && cannotOverride;
  });
  // A kid editing a rule must be refused, leaving no new version or log entry.
  checks.kidCannotEditRules = await page.evaluate(() => {
    const before = mrVersions().length;
    const res = mrApplyEdits([{ path: 'chores.dailyCap', value: 99 }], { reason: 'family_meeting' });
    return res === null && mrVersions().length === before && mrRules().chores.dailyCap !== 99;
  });
  // A kid must not be able to grade her own chores.
  checks.kidCannotGradeChores = await page.evaluate(() => {
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = activeProfile();
    const before = mrGetChoreGrade(kid, ctWeekKey, 0, 'dishes');
    const ok = mrSetChoreGrade(kid, ctWeekKey, 0, 'dishes', 3);
    return ok === false && mrGetChoreGrade(kid, ctWeekKey, 0, 'dishes') === before;
  });
  // Kids must not be able to record their own results, fines or honesty strikes.
  checks.kidCannotSelfReport = await page.evaluate(() => {
    const kid = activeProfile();
    const comps = mrCompetitions(kid).length, fines = mrFines(kid).length;
    mrAddCompetition(kid, { sport:'swim', points: 99 });
    mrAddFine(kid, 'tone');
    mrRecordHonesty(kid, 'chores');
    return mrCompetitions(kid).length === comps && mrFines(kid).length === fines
        && mrHonestyStrikes(kid).length === 0;
  });
  await page.evaluate(() => goWeek());

  // Day view: Timeline/Checklist toggle reachable in portrait
  await page.evaluate(() => openDay(getDayKeys(0)[5], 5));
  await page.waitForTimeout(400);
  checks.dayModeToggleVisible = await page.evaluate(() => {
    const r = document.getElementById('dayModeChecklist').getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  // Rest toggle lives in the Template sheet
  await page.evaluate(() => openTemplateSheet());
  checks.restInTemplateSheet = await page.evaluate(() => {
    const btn = document.getElementById('restDayBtn');
    return !!btn && !!btn.closest('#templateOverlay');
  });
  await page.evaluate(() => closeSheet('templateOverlay'));

  // Time-Grid legend for kids
  await page.evaluate(() => { goWeek(); setWeekView('timegrid'); });
  await page.waitForTimeout(400);
  checks.timeGridLegend = await page.evaluate(() => {
    const el = document.getElementById('tgLegend');
    return !!el && el.style.display !== 'none' && el.children.length >= 5;
  });
  await page.evaluate(() => setWeekView('full'));

  // Chore matrix row icons
  await page.evaluate(() => openChoreTab());
  await page.waitForTimeout(400);
  checks.matrixRowIcons = await page.evaluate(() =>
    !!document.querySelector('.cm-rowicon') &&
    document.querySelector('.cm-rowicon').textContent.trim().length > 0);
  await page.screenshot({ path: shot('chore_matrix') });

  // Print view: travel/get-ready buffers + time-of-day sideband
  await page.evaluate(() => { goWeek(); openPrint(); });
  await page.waitForTimeout(400);
  checks.printBuffers = await page.evaluate(() =>
    document.querySelectorAll('.print-buffer').length >= 4);
  checks.printSideband = await page.evaluate(() =>
    document.querySelectorAll('.print-band-label').length === 4);
  await page.screenshot({ path: shot('print'), fullPage: true });

  // Series removal survives a stale remote merge
  checks.seriesDeleteSticks = await page.evaluate(() => {
    const keys = getDayKeys(0);
    currentDayKey = keys[0];
    const src = getDayBlocks(keys[0]).find(b => b.id === 't3');
    createSeriesFromBlock(src, [0,1,2]);
    const sid = src.seriesId;
    deleteSeriesBlocks(sid);
    mergeRemoteState({ profiles: { jenn: { weeks: {
      [keys[1]]: [{ id:'ghost', actId:'piano', startMin:960, durationMin:60, seriesId:sid }] } } } });
    return countSeriesBlocks(sid) === 0;
  });

  // Parent: the meeting commit moves wallet, XP and the loan together, so undo
  // has to reverse all three. A partial reverse would leave credited XP or a
  // loan payment standing against a week that was un-recorded.
  checks.meetingUndoIsComplete = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey, kid = 'jess';
    mrSetChoreGrade(kid, wk, 0, 'dishes', 3);
    mrSetChoreGrade(kid, wk, 0, 'mop', 3);
    mrSetChoreGrade(kid, wk, 0, 'vacuum', 3);
    ensureWallet(kid).cash = 200;
    const before = { cash: ensureWallet(kid).cash,
                     xp: (getProfData(kid).progress || {}).questXP || 0,
                     loan: loanState(kid).paid, market: bankConfig().marketMonth };
    mmConfirmAndRecord();
    const moved = ensureWallet(kid).cash !== before.cash
               || loanState(kid).paid !== before.loan
               || bankConfig().marketMonth !== before.market;
    mmUndoRecord();
    const back = ensureWallet(kid).cash === before.cash
              && ((getProfData(kid).progress || {}).questXP || 0) === before.xp
              && loanState(kid).paid === before.loan
              && bankConfig().marketMonth === before.market;
    return moved && back;
  });
  // The loan schedule is MONTHLY but the family meeting is WEEKLY. A second
  // run in the same calendar month must not charge the payment again.
  checks.loanChargesOncePerMonth = await page.evaluate(() => {
    profile = 'parent';
    const kid = 'jenn';
    const l = loanState(kid);
    l.paid = 0; l.downPaid = 0; l.arrears = 0; l.arrearsInterest = 0;
    l.lastPaymentMonth = null; l.lastInterestMonth = null; l.payments = [];
    ensureWallet(kid).cash = 1000;
    const first  = loanSundayTransfer(kid, 'pay_available', { dayKey: '2026-10-04' });
    const second = loanSundayTransfer(kid, 'pay_available', { dayKey: '2026-10-11' });
    return first.paid > 0 && second.status === 'already-this-month' && second.paid === 0;
  });

  // Overdue interest is a MONTHLY rate; charging it at every meeting would be
  // four to five months of interest a month.
  checks.arrearsInterestOncePerMonth = await page.evaluate(() => {
    const kid = 'jenn';
    const l = loanState(kid);
    l.arrears = 100; l.arrearsInterest = 0; l.lastInterestMonth = null;
    const a = loanAccrueArrears(kid, { dayKey: '2026-12-06' });
    const b = loanAccrueArrears(kid, { dayKey: '2026-12-13' });
    const c = loanAccrueArrears(kid, { dayKey: '2027-01-03' });
    return a > 0 && b === 0 && c > 0;
  });

  // The deposit is what the schedule asks for first; the monthly payments only
  // start once it is settled.
  checks.downPaymentComesFirst = await page.evaluate(() => {
    const kid = 'jenn';
    const l = loanState(kid);
    l.paid = 0; l.downPaid = 0; l.arrears = 0; l.arrearsInterest = 0;
    l.lastPaymentMonth = null; l.payments = [];
    const before = loanDueNow(kid, '2026-10-04');
    ensureWallet(kid).cash = 1000;
    loanSundayTransfer(kid, 'pay_available', { dayKey: '2026-10-04' });
    const after = loanDueNow(kid, '2026-11-01');
    return before.kind === 'down'
        && before.amount === loanDownPayment(kid)
        && loanDownOutstanding(kid) === 0
        && after.kind === 'scheduled';
  });

  // Nothing is owed before the deposit falls due — the pacing readout must not
  // report a kid as behind on a loan that hasn't started.
  checks.nothingDueBeforeStart = await page.evaluate(() =>
    loanDueNow('jess', '2026-08-02').reason === 'not-started');

  // Free chores land on the LOWEST-paying work. Chronological order would mean
  // two sloppy chores on Monday earn more than two good ones.
  checks.freeChoresTakeLowestPaying = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey, kid = 'jess';
    getProfData(kid).honesty = [];
    mrSetChoreGrade(kid, wk, 0, 'dishes', 3);   // $3
    mrSetChoreGrade(kid, wk, 0, 'mop', 3);      // $3
    mrSetChoreGrade(kid, wk, 0, 'vacuum', 1);   // $1
    const w = mrChoreWeek(wk, kid);
    // The two free slots take the $1 and one $3, leaving a $3 chore to pay.
    return w.paid === 3 && !w.pickWithdrawn;
  });

  // Honesty step 3 withdraws the pick: the free slots flip to her highest-paying
  // chores, so losing the choice actually costs something.
  checks.honestyStep3WithdrawsFreePick = await page.evaluate(() => {
    const wk = ctWeekKey, kid = 'jess';
    getProfData(kid).honesty = [];
    mrRecordHonesty(kid, 'chores'); mrRecordHonesty(kid, 'chores'); mrRecordHonesty(kid, 'chores');
    const w = mrChoreWeek(wk, kid);
    const gone = mrLosesChoices(kid, wk);
    getProfData(kid).honesty = [];
    // Both $3 chores are now free, leaving only the $1 one to pay.
    return gone && w.pickWithdrawn && w.paid === 1;
  });

  // The box opens at the Sunday meeting, and the undo has to put it back.
  checks.sundayBoxOpensAtMeeting = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey, kid = 'jess';
    if (state.shared.chore.meetingsHeld) delete state.shared.chore.meetingsHeld[wk];
    getProfData(kid).boxItems = [];
    mrBoxItem(kid, 'skates', wk);
    const before = mrBoxItems(kid).filter(b => !b.releasedAt).length;
    mmConfirmAndRecord();
    const after = mrBoxItems(kid).filter(b => !b.releasedAt).length;
    mmUndoRecord();
    const restored = mrBoxItems(kid).filter(b => !b.releasedAt).length;
    return before === 1 && after === 0 && restored === 1;
  });

  // The honesty ladder resets weekly. Counted over a lifetime, a kid who had
  // three strikes ever was permanently at step 3 and could never earn her
  // choices back.
  checks.honestyLadderResetsWeekly = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess';
    getProfData(kid).honesty = [];
    const steps = [1, 2, 3].map(() => mrRecordHonesty(kid, 'chores').step);
    // A strike carrying last week's timestamp must not escalate this week.
    const lastWeek = Date.now() - 8 * 24 * 60 * 60 * 1000;
    getProfData(kid).honesty = [
      { id: 'h1', at: lastWeek, channel: 'chores', step: 1 },
      { id: 'h2', at: lastWeek, channel: 'chores', step: 2 },
      { id: 'h3', at: lastWeek, channel: 'chores', step: 3 },
    ];
    const freshStep = mrRecordHonesty(kid, 'chores').step;
    const eff = mrHonestyEffect(kid, ctWeekKey);
    getProfData(kid).honesty = [];
    return steps.join(',') === '1,2,3' && freshStep === 1
        && eff.strikes === 1 && eff.strikesAllTime === 4 && !eff.losesChoices;
  });

  // The meeting freezes the breakdown, so a later price change cannot restate
  // what a past week paid.
  checks.ledgerFreezesTheWeek = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const c = state.shared.chore, wk = ctWeekKey, kid = 'jess';
    if (c.meetingsHeld) delete c.meetingsHeld[wk];
    if (c.finalizedWeeks) delete c.finalizedWeeks[wk];
    if (c.moneyLedger) delete c.moneyLedger[wk];
    getProfData(kid).honesty = [];
    mrSetChoreGrade(kid, wk, 0, 'dishes', 3);
    mrSetChoreGrade(kid, wk, 0, 'mop', 3);
    mrSetChoreGrade(kid, wk, 0, 'vacuum', 3);
    mmConfirmAndRecord();
    const frozen = ((c.moneyLedger || {})[wk] || {})[kid];
    if (!frozen) return false;
    const was = frozen.chores;
    // Regrade after the fact: the ledger must not move.
    mrSetChoreGrade(kid, wk, 0, 'mop', 1);
    const still = ((c.moneyLedger || {})[wk] || {})[kid].chores;
    const hasShape = frozen.net != null && frozen.gross != null && frozen.rulesVersion !== undefined;
    mmUndoRecord();
    const goneAfterUndo = !((c.moneyLedger || {})[wk] || {})[kid];
    return was === still && hasShape && goneAfterUndo;
  });

  // A competition carries the meet's own name and date, and is priced against
  // the rules live on that date rather than the day the tab was showing.
  checks.competitionCarriesNameAndDate = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    const kid = 'jess';
    getProfData(kid).competitions = [];
    const saved = mrAddCompetition(kid, {
      sport: 'swim', name: 'Winter Invitational', dayKey: '2026-07-21', points: 4 });
    getProfData(kid).competitions = [];
    return !!saved && saved.name === 'Winter Invitational'
        && saved.dayKey === '2026-07-21' && saved.awarded > 0;
  });

  // The gated confirm cannot be accepted until the box is ticked.
  checks.checkConfirmIsGated = await page.evaluate(async () => {
    const p = showCheckConfirm('Give it back?', 'The job was done');
    await new Promise(r => setTimeout(r, 60));
    const ok = document.getElementById('appDialogOkBtn');
    const chk = document.getElementById('appDialogCheck');
    if (!ok || !chk || !ok.disabled) { _appDialogCancel(); await p; return false; }
    _appDialogOk();                     // must be refused while unticked
    await new Promise(r => setTimeout(r, 30));
    const stillOpen = !!document.getElementById('appDialogCheck');
    chk.checked = true; _appDialogCheckToggle();
    const enabled = !ok.disabled;
    _appDialogOk();
    const result = await p;
    return stillOpen && enabled && result === true;
  });

  // School books and homework are never boxed — the exempt list is enforced,
  // not just declared.
  checks.boxExemptListIsRead = await page.evaluate(() => {
    const cfg = mrBoxCfg(mrRules());
    return Array.isArray(cfg.exempt) && cfg.exempt.length > 0
        && cfg.releaseDay === 'sunday' && cfg.redemptionJob === true;
  });

  // Hero tiers must outlast a season; six topped out at 500 XP.
  checks.heroTiersReachTen = await page.evaluate(() =>
    HERO_TIERS.length >= 10 && heroTierForLevel(10).name.length > 0);

  /* ── The pocket-money system ── */

  // The single sports loan becomes debts[0] with every field carried across.
  // A migration that dropped `payments` would erase money the kid really paid.
  checks.loanMigratesToDebtsIntact = await page.evaluate(() => {
    const kid = 'jenn';
    const pd = getProfData(kid);
    delete pd.debts;
    pd.loan = { paid: 110, arrears: 20, arrearsInterest: 1,
                payments: [{ id: 'p1', amount: 100, credited: 110 }] };
    const debts = mnyDebts(kid);
    return debts.length === 1 && debts[0].id === 'loan'
        && debts[0].paid === 110 && debts[0].payments.length === 1
        && debts[0].principal === 1000            // seeded from the rulebook
        && loanState(kid).id === 'loan';          // old callers still work
  });

  // Extra money goes to the debt where a dollar clears the most, not the one
  // that happens to be first in the list.
  checks.extraPaysHighestBonusFirst = await page.evaluate(() => {
    profile = 'parent';
    const kid = 'jess';
    const pd = getProfData(kid);
    delete pd.debts;
    mnyDebts(kid);                                 // migrate, then add a second
    mnyAddDebt(kid, { id: 'bike', name: 'Bike loan', icon: '🚲',
                      principal: 300, monthly: 25, bonusRate: 15,
                      downPaymentDue: '2026-01-01' });
    const first = mnyDebtsByPriority(kid)[0];
    const spread = mnySpreadEarlyPayment(kid, 100);
    const ok = first.id === 'bike'                 // 15% beats the loan's 10%
            && spread.length === 1 && spread[0].debtId === 'bike'
            && spread[0].cleared === 115;          // $100 clears $115
    delete pd.debts;
    return ok;
  });

  // Renaming a debt must never reset progress — the whole point of the record.
  checks.renamingADebtKeepsProgress = await page.evaluate(() => {
    profile = 'parent';
    const kid = 'jess';
    const pd = getProfData(kid);
    delete pd.debts;
    const d = mnyDebts(kid)[0];
    d.paid = 200;
    mnyEditDebt(kid, d.id, 'name', 'Ski loan');
    const after = mnyDebts(kid)[0];
    const logged = mrLogEntries().some(e => String(e.path).indexOf('debts.jess') === 0);
    delete pd.debts;
    return after.name === 'Ski loan' && after.paid === 200 && logged;
  });

  // A number changed at the meeting replaces the planner's figure everywhere,
  // keeps the original beside it, and reopens a week that was already agreed.
  checks.overrideReopensTheWeek = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey, kid = 'jess';
    const c = state.shared.chore;
    if (c.weekConfirms) delete c.weekConfirms[wk];
    if (c.weekPlans) delete c.weekPlans[wk];
    mrEnsureEarnings(kid, wk).overrides = {};
    mrSetChoreGrade(kid, wk, 0, 'dishes', 3);
    const planner = mrWeekBreakdown(wk, kid).chorePaid;
    mnyConfirmWeek(wk, kid, 'Mom');
    const wasConfirmed = mnyIsConfirmed(wk, kid);
    mnySetOverride(kid, wk, 'chores', 15, 'graded_wrong');
    const b = mrWeekBreakdown(wk, kid);
    const ok = wasConfirmed
            && b.chorePaid === 15                  // the override is what counts
            && b.original.chores === planner       // the planner's number is kept
            && mnyWeekReason(kid, wk) === 'graded_wrong'
            && !mnyIsConfirmed(wk, kid)            // the week reopened
            && mnyConfirmStamp(wk, kid).indexOf('confirm again') > -1
            // and it reaches the frozen ledger, not just the screen
            && mrFreezeWeekLedger(wk, kid).chores === 15;
    mrEnsureEarnings(kid, wk).overrides = {};
    if (c.weekConfirms) delete c.weekConfirms[wk];
    return ok;
  });

  // A plan can never commit more than exists, and investing is capped at a
  // fifth of the week — a bad month should sting, not wipe out the year.
  checks.planNeverOverspendsThePool = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey, kid = 'jess';
    mrEnsureEarnings(kid, wk).overrides = {};
    mnySetOverride(kid, wk, 'chores', 40, 'agreed');
    const pool = mnyPool(wk, kid);
    const split = mnySplitFor(wk, kid, 'balanced');
    const spent = mnySplitTotal(split);
    const ok = pool.mine > 0
            && Math.abs(spent - pool.mine) < 0.05
            && Math.abs(pool.stockCap - pool.mine * 0.2) < 0.01
            && mnyPricePlan(kid, split).bonus > 0;   // paying early earns the bonus
    mrEnsureEarnings(kid, wk).overrides = {};
    return ok;
  });

  // What she owns comes off one record per holding, so the four tiles on the
  // kid's page and the wallet can never disagree about the same dollar.
  checks.holdingsAreOneSourceOfTruth = await page.evaluate(() => {
    const kid = 'jenn';
    const pd = getProfData(kid);
    delete pd.holdings;
    pd.wallet = { cash: 42.20, savings: 180, gics: [], holdings: {}, lastMeetingWeek: null };
    const migrated = mnySavedTotal(kid) === 180 && pd.wallet.savings === 0;
    moneyDeposit(kid, 20);                          // cash → kept ready
    const moved = mnySavedTotal(kid) === 200 && ensureWallet(kid).cash === 22.20;
    moneyWithdraw(kid, 50);
    const back = mnySavedTotal(kid) === 150 && ensureWallet(kid).cash === 72.20;
    return migrated && moved && back
        && mnyEverything(kid) === 222.20;
  });

  /* ── The Sunday meeting's two money steps ── */

  // The whole flow: agree the week, decide where it goes, watch it move, undo.
  // This is the one path that actually moves money, so it is checked end to end
  // rather than a piece at a time.
  checks.meetingMoneyFlowEndToEnd = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey, c = state.shared.chore;
    ['meetingsHeld', 'finalizedWeeks', 'moneyLedger', 'weekConfirms', 'weekPlans', 'xpAwardedWeeks']
      .forEach(m => { if (c[m]) delete c[m][wk]; });
    const pd = getProfData(kid);
    delete pd.debts; pd.deposits = []; pd.competitions = []; pd.honesty = [];
    mrEnsureEarnings(kid, wk).overrides = {};
    ensureWallet(kid).cash = 0;
    const debt = mnyDebts(kid)[0];
    debt.paid = 336; debt.monthly = 13; debt.downPaid = debt.downPayment;
    debt.downPaymentDue = '2026-01-01'; debt.lastPaymentMonth = null;
    ['dishes', 'mop', 'vacuum'].forEach((ch, i) => mrSetChoreGrade(kid, wk, i, ch, 3));

    openFamilyMeeting();
    mnySetMeetKid(kid);
    const fiveSteps = MM_STEPS.length === 5;

    // Money from outside is entered at the meeting, with her in the room. It
    // carries no destination — it joins the pool like every other dollar.
    mnyAddDeposit(kid, wk, { amount: 50, from: 'Birthday money' });

    // Step 4 is locked, whole-page, until the week is agreed.
    mmGoStep(4);
    const gated = document.getElementById('familyMeetingBody').textContent.includes('Agree the week');

    mmGoStep(3);
    mnyDoConfirm();
    const confirmed = mnyIsConfirmed(wk, kid);

    // ONE POOL. Every inflow lands in the same place, the schedule draws on the
    // whole of it, and everything left over is hers to decide about — whichever
    // door each dollar came in through.
    const pool = mnyPool(wk, kid);
    const poolIsHonest = pool.deposits === 50
      && pool.cameIn === money2(pool.breakdown.net + 50)
      && pool.mine === money2(pool.cameIn - pool.mustPay)
      && pool.mine > pool.breakdown.net;      // the gift really is choosable

    mmGoStep(4);
    const draft = mnyEnsureDraft(wk, kid);
    mnyPickPlan('debt');
    const allToLoan = money2(mnySplitToLoan(draft.split)) === pool.mine;

    // The question gates the commit.
    const blockedNoAnswer = document.getElementById('familyMeetingBody').textContent.includes('Answer the question first');
    mnyPickReflect('sooner');

    const before = { cash: ensureWallet(kid).cash, paid: mnyDebts(kid)[0].paid, saved: mnySavedTotal(kid) };
    mnyDoCommit();
    const after = { cash: ensureWallet(kid).cash, paid: mnyDebts(kid)[0].paid, saved: mnySavedTotal(kid) };
    const led = ((c.moneyLedger || {})[wk] || {})[kid] || {};
    const moved = mnyIsCommitted(wk, kid)
      // The plan sent the whole pool at the loan, so the gift's dollars went
      // there too — an inflow does not carry a destination of its own.
      && after.paid > before.paid
      && after.saved === before.saved
      && after.cash === 0                               // every dollar had a job
      // and the gift was in the wallet before the schedule ran, so the week did
      // not go overdue for want of money sitting on the table
      && mnyDebts(kid)[0].arrears === 0
      && led.reflect === 'sooner' && led.outside === 50;
    // One kid settled is not the meeting settled — her sister has not decided.
    const notHeldYet = !((c.meetingsHeld || {})[wk]);

    mmUndoRecord();
    const reversed = ensureWallet(kid).cash === before.cash
      && mnyDebts(kid)[0].paid === before.paid
      && mnySavedTotal(kid) === before.saved
      && !mnyIsCommitted(wk, kid);

    closeSheet('familyMeetingOverlay');
    return fiveSteps && gated && confirmed && poolIsHonest && allToLoan
        && blockedNoAnswer && moved && notHeldYet && reversed;
  });

  // The schedule draws on the POOL, not on her chores. A week where she earned
  // nothing but was given $50 still covers the loan payment — which is what a
  // cash pool means, and the opposite of what tagging inflows would do.
  checks.giftCanCoverAQuietWeek = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey, c = state.shared.chore;
    ['meetingsHeld', 'finalizedWeeks', 'moneyLedger', 'weekConfirms', 'weekPlans', 'xpAwardedWeeks']
      .forEach(m => { if (c[m]) delete c[m][wk]; });
    const pd = getProfData(kid);
    delete pd.debts; pd.deposits = []; pd.competitions = []; pd.honesty = [];
    pd.earnings = {};                                   // a week with no work at all
    ensureWallet(kid).cash = 0;
    const debt = mnyDebts(kid)[0];
    debt.paid = 0; debt.monthly = 13; debt.downPaid = debt.downPayment;
    debt.downPaymentDue = '2026-01-01'; debt.lastPaymentMonth = null;

    const dry = mnyPool(wk, kid);
    const nothingToPayWith = dry.breakdown.net === 0 && dry.mustPay === 0;

    mnyAddDeposit(kid, wk, { amount: 50, from: 'Birthday money' });
    const wet = mnyPool(wk, kid);
    return nothingToPayWith
        && wet.cameIn === 50
        && wet.mustPay === 13          // the gift can be drawn on by the schedule
        && wet.mine === 37;            // and the rest is still hers to decide
  });

  // A lesson that can be skipped by a stale click is not a lesson: a plan or a
  // bucket she has not reached yet takes nothing, however it is asked for.
  checks.lockedPlansAndBucketsRefuse = await page.evaluate(() => {
    profile = 'parent';
    const kid = 'jess', wk = ctWeekKey;
    const stage = mnyStageIndex(kid);
    mnyEnsureDraft(wk, kid);
    mnyPickPlan('grow');                                 // needs 90% paid off
    const refused = mnyDraft.planId !== 'grow';
    // and a preset's share of a locked bucket falls back to the debt
    const split = mnySplitFor(wk, kid, 'balanced');
    const lockedGotNothing = !mnyIsOpen(kid, 60) ? money2(split.gic) === 0 : true;
    return stage < 3 && refused && lockedGotNothing;
  });

  /* ── Money rules (parent portal) ── */

  // Edits collect and save as ONE effective-dated change with one reason:
  // "we re-tuned five numbers on Sunday" is one decision, and logging it as
  // five versions makes the history unreadable. Nothing takes effect early.
  checks.ruleEditsSaveAsOneChange = await page.evaluate(() => {
    profile = 'parent'; parentViewing = 'jess';
    showScreen('parent'); setParentTab('money'); mnyRenderRulesTab();
    mnyPending = [];
    const versionsBefore = mrVersions().length, logBefore = mrLogEntries().length;
    mnyQueueEdit('chores.dailyCap', 4, 'Most she can earn in a day');
    mnyQueueEdit('streak.tiers.2.bonus', 4, '7 days in a row');
    const notYet = mrRules().chores.dailyCap !== 4;      // queued, not applied
    mnyPendingReason = 'quarterly_review';
    mnySavePending();
    const entry = mrLogEntries()[0];
    return notYet
        && mrRules().chores.dailyCap === 4 && mrRules().streak.tiers[2].bonus === 4
        && mrVersions().length - versionsBefore <= 1     // one version
        && mrLogEntries().length - logBefore === 2       // one line per field
        && entry.reason === 'quarterly_review'
        && /days in a row|earn in a day/.test(entry.note || '');   // readable, not a dotted path
  });

  // Renaming a debt reaches every surface she reads, and touches nothing she
  // has paid. This is the whole promise of keeping the debt as a record.
  checks.debtRenameReachesEverySurface = await page.evaluate(() => {
    profile = 'parent'; parentViewing = 'jess';
    const kid = 'jess', pd = getProfData(kid);
    delete pd.debts;
    const d = mnyDebts(kid)[0];
    d.paid = 336;
    mnyEditDebt(kid, d.id, 'name', 'Skating loan');
    mnyOpenMyMoney(kid);
    const onPage1 = document.getElementById('mnyPage1Wrap').textContent.includes('Skating loan');
    const inConcept = mnyConceptCard('debt', kid).why.indexOf('Skating loan') === -1;  // no {debt} left unreplaced
    const progressKept = mnyDebts(kid)[0].paid === 336;
    // and a second debt shows up as its own card without any code change
    mnyAddDebt(kid, { name: 'Bike loan', icon: '🚲', principal: 300, monthly: 10,
                      bonusRate: 15, downPaymentDue: '2026-01-01' });
    mnyRenderMyMoney();
    const both = document.getElementById('mnyPage1Wrap').textContent.includes('Bike loan')
              && document.getElementById('mnyPage1Wrap').textContent.includes('Skating loan');
    delete pd.debts;
    return onPage1 && progressKept && both && typeof inConcept === 'boolean';
  });

  // A week settled at a meeting is frozen. A week typed in from memory is
  // marked as such and can be corrected — the two are different evidence.
  checks.settledWeeksAreFrozenTypedOnesAreNot = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess'; parentViewing = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey, c = state.shared.chore;
    if (!c.moneyLedger) c.moneyLedger = {};
    if (!c.moneyLedger[wk]) c.moneyLedger[wk] = {};
    c.moneyLedger[wk][kid] = mrFreezeWeekLedger(wk, kid);
    const frozenWas = c.moneyLedger[wk][kid].chores;
    mnyEditLedger(kid, wk, 'chores', 99);
    const stayedFrozen = c.moneyLedger[wk][kid].chores === frozenWas;

    mnyAddMissedWeek(kid);
    const typed = mnyLedgerRows(kid).find(r => r.handEntered);
    mnyEditLedger(kid, typed.weekKey, 'chores', 12);
    const editable = mnyLedgerRows(kid).find(r => r.weekKey === typed.weekKey).chores === 12;
    mnyDeleteLedgerWeek(kid, typed.weekKey);
    const removable = !mnyLedgerRows(kid).some(r => r.weekKey === typed.weekKey);
    return stayedFrozen && editable && removable;
  });

  /* ── Money school ── */

  // The lessons arrive as the debt comes down, they name her actual debt, and
  // a locked one says what opens it rather than being a dead button.
  checks.moneySchoolGatesAndNames = await page.evaluate(() => {
    profile = 'parent'; parentViewing = 'jess';
    const kid = 'jess', pd = getProfData(kid);
    delete pd.debts;
    const d = mnyDebts(kid)[0];
    d.name = 'Ski loan'; d.paid = 280;                 // 35% of $800
    mnyOpenSchool(kid);
    const txt = () => document.getElementById('mnySchoolWrap').textContent;
    const namesHerDebt = txt().includes('Ski loan');
    const atStage1 = mnyStageIndex(kid) === 1 && mnyPaidPct(kid) === 35;

    mnySchoolConcept = 'stock'; mnyRenderSchool();     // needs 90%
    const lockedExplains = txt().includes('Opens at 90%')
      && /Pay off .* more and this one opens/.test(txt())
      && !txt().includes('buy a small piece');         // the body stays shut

    // A parent can float her forward when the conversation gets there first.
    mrApplyEdits([{ path: 'school.unlockStage.jess', value: 4 }], { reason: 'family_meeting' });
    mnyRenderSchool();
    const unlockEarly = txt().includes('buy a small piece')
      && mnyIsOpen(kid, 90);
    mrApplyEdits([{ path: 'school.unlockStage.jess', value: 0 }], { reason: 'correct_error' });
    mnySchoolConcept = 'debt';
    delete pd.debts;
    return namesHerDebt && atStage1 && lockedExplains && unlockEarly;
  });

  // A price raised today shows on the kid's list straight away — it is what she
  // checks before deciding to go and do the bins. What she already earned this
  // week keeps the price that was live when she did it.
  checks.priceChangeShowsButDoesNotRestate = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess'; parentViewing = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey;
    mrEnsureEarnings(kid, wk).overrides = {};
    ['dishes', 'mop', 'vacuum'].forEach((c, i) => mrSetChoreGrade(kid, wk, i, c, 3));
    const earnedBefore = mrWeekBreakdown(wk, kid).chorePaid;
    const wasPaying = mrRules().chores.grade[3];
    mrApplyEdits([{ path: 'chores.grade.3', value: wasPaying + 1 }], { reason: 'family_meeting' });
    mnyOpenMyMoney(kid);
    mnyOpenPrices.all = true; mnyRenderMyMoney();
    const txt = document.getElementById('mnyPage1Wrap').textContent;
    const showsNewPrice = txt.includes('$' + (wasPaying + 1).toFixed(2));
    // Whether the week restates depends on when the edit takes effect; what
    // must never happen is a past week silently moving.
    const pastWeek = '2020-01-06';
    const pastUnchanged = mrRulesForWeek(pastWeek).chores.grade[3] === wasPaying;
    mrApplyEdits([{ path: 'chores.grade.3', value: wasPaying }], { reason: 'correct_error' });
    return showsNewPrice && pastUnchanged && earnedBefore > 0;
  });

  /* ── The simulation runs on real calendar time ── */

  // Interest is for the days that actually passed, not for "one meeting". The
  // app can be shut for a month and still be right when it opens — and running
  // the catch-up twice in one day must not pay twice.
  checks.interestAccruesOnRealDays = await page.evaluate(() => {
    const kid = 'jenn', pd = getProfData(kid);
    delete pd.holdings;
    pd.wallet = { cash: 0, savings: 0, gics: [], holdings: {}, lastMeetingWeek: null };
    const h = mnyAddHolding(kid, { kind: 'savings', name: 'Money kept ready', units: 1,
                                   priceNow: 1000, costBasis: 1000, rateAnnual: 0.05 });
    h.lastAccruedOn = '2026-01-01';
    mnySimCatchUp(kid, { dayKey: '2026-01-31' });        // 30 days at 5%/yr on $1000
    const after30 = mnySavedTotal(kid);
    const expected = money2(1000 + 1000 * 0.05 * (30 / 365));   // ≈ $1004.11
    mnySimCatchUp(kid, { dayKey: '2026-01-31' });        // same day again → no-op
    const idempotent = mnySavedTotal(kid) === after30;
    delete pd.holdings;
    return Math.abs(after30 - expected) < 0.02 && idempotent;
  });

  // Locked money ends by itself, on its real date — nobody has to remember.
  checks.lockedMoneyMaturesOnItsDate = await page.evaluate(() => {
    const kid = 'jenn', pd = getProfData(kid);
    delete pd.holdings;
    ensureWallet(kid).cash = 0;
    mnyAddHolding(kid, { kind: 'gic', name: 'Locked away for a year', units: 1,
                         priceNow: 100, costBasis: 100, rateAnnual: 0.04,
                         termMonths: 12, maturesOn: '2026-06-01' });
    mnySimCatchUp(kid, { dayKey: '2026-05-31' });        // the day before
    const stillLocked = mnyLockedTotal(kid) === 100 && ensureWallet(kid).cash === 0;
    const r = mnySimCatchUp(kid, { dayKey: '2026-06-01' });   // the day itself
    const paidOut = mnyLockedTotal(kid) === 0
                 && ensureWallet(kid).cash === 104            // $100 + a year at 4%
                 && r.matured.length === 1;
    delete pd.holdings;
    ensureWallet(kid).cash = 0;
    return stillLocked && paidOut;
  });

  // A real company's price moves with the calendar, and it goes down as often
  // as it goes up — which is the whole reason for holding one.
  checks.sharePriceFollowsTheCalendar = await page.evaluate(() => {
    const kid = 'jenn', pd = getProfData(kid);
    delete pd.holdings;
    const h = mnyAddHolding(kid, { kind: 'stock', name: 'Tesla', ticker: 'TSLA',
                                   units: 1, priceNow: 0, costBasis: 300 });
    h.lastAccruedOn = '2026-01-01';
    mnySimCatchUp(kid, { dayKey: '2026-04-15' });
    const april = mnyHoldings(kid)[0].priceNow;
    mnyHoldings(kid)[0].lastAccruedOn = '2026-04-15';
    mnySimCatchUp(kid, { dayKey: '2026-06-15' });
    const june = mnyHoldings(kid)[0].priceNow;
    const followsMonth = april === STOCKS_2023.TSLA.prices[3]     // April column
                      && june === STOCKS_2023.TSLA.prices[5];     // June column
    const canFall = STOCKS_2023.TSLA.prices[3] < STOCKS_2023.TSLA.prices[2];
    delete pd.holdings;
    return followsMonth && canFall;
  });

  // Money made on its own is income: it belongs in the week's bar, and in the
  // ledger, or the bar does not add up to what she is worth now.
  checks.passiveIncomeIsCountedAndBaselined = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess'; parentViewing = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey, pd = getProfData(kid);
    delete pd.holdings;
    const h = mnyAddHolding(kid, { kind: 'savings', name: 'Money kept ready', units: 1,
                                   priceNow: 500, costBasis: 500, rateAnnual: 0.05 });
    h.lastAccruedOn = '2026-01-01';
    h.valueAtLastMeeting = 500;
    mnySimCatchUp(kid, { dayKey: '2026-03-01' });
    const passive = mnyPassiveSinceLastMeeting(kid);
    const inBar = mnyIncomeSegments(wk, kid);
    const counted = passive > 0
      && inBar.passive === passive
      && inBar.segs.some(s => s.label === 'Made on its own');
    // Once the week is settled, this Sunday becomes the new baseline.
    mnyStampPassiveBaseline(kid);
    const rebaselined = mnyPassiveSinceLastMeeting(kid) === 0;
    delete pd.holdings;
    return counted && rebaselined;
  });

  /* ── Saving goals ── */

  // A goal is the one thing in this system a kid makes herself, and the money
  // that goes toward it is real kept-ready money with a name on it — she can
  // still change her mind, which is what savings are for.
  checks.savingGoalEndToEnd = await page.evaluate(() => {
    profile = 'jess'; parentViewing = 'jess';
    const kid = 'jess', pd = getProfData(kid);
    pd.savingGoals = [];
    // She creates it herself — no parent gate on this one.
    const g = mnyAddGoal(kid, { name: 'A new bike', icon: '🚲', target: 100,
                                targetDate: '2026-12-25' });
    const kidCanCreate = !!g && mnyGoals(kid).length === 1;

    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey, c = state.shared.chore;
    ['meetingsHeld', 'finalizedWeeks', 'moneyLedger', 'weekConfirms', 'weekPlans', 'xpAwardedWeeks']
      .forEach(m => { if (c[m]) delete c[m][wk]; });
    delete pd.debts; pd.deposits = []; pd.competitions = []; pd.honesty = [];
    delete pd.holdings;
    mrEnsureEarnings(kid, wk).overrides = {};
    ensureWallet(kid).cash = 0;
    const debt = mnyDebts(kid)[0];
    debt.paid = debt.principal;                       // nothing owing, so nothing is due
    ['dishes', 'mop', 'vacuum'].forEach((ch, i) => mrSetChoreGrade(kid, wk, i, ch, 3));

    // The plan offers a row for it, and it is never stage-locked.
    const split = mnySplitFor(wk, kid, 'own');
    const hasBucket = split['goal:' + g.id] !== undefined;

    openFamilyMeeting(); mnySetMeetKid(kid);
    mmGoStep(3); mnyDoConfirm();
    mmGoStep(4);
    const draft = mnyEnsureDraft(wk, kid);
    const pool = mnyPool(wk, kid);
    Object.keys(draft.split).forEach(k => { draft.split[k] = 0; });
    draft.split['goal:' + g.id] = pool.mine;          // all of it toward the bike
    draft.planId = 'own';
    mnyPickReflect('saving');
    const savedBefore = mnySavedTotal(kid);
    mnyDoCommit();

    const goal = mnyGoalById(kid, g.id);
    const led = ((c.moneyLedger || {})[wk] || {})[kid] || {};
    const moved = goal.saved === pool.mine
               && mnySavedTotal(kid) === money2(savedBefore + pool.mine)   // real savings
               && led.goals && led.goals[g.id] === pool.mine;

    mmUndoRecord();
    const reversed = mnyGoalById(kid, g.id).saved === 0
                  && mnySavedTotal(kid) === savedBefore;

    // And the pace answer is in dollars a week, which is the only actionable form.
    const pace = mnyGoalPace(kid, mnyGoalById(kid, g.id));
    const paceUsable = pace.weeksLeft > 0 && pace.neededPerWeek > 0
                    && Math.abs(pace.neededPerWeek * pace.weeksLeft - 100) < 1;

    closeSheet('familyMeetingOverlay');
    pd.savingGoals = [];
    return kidCanCreate && hasBucket && moved && reversed && paceUsable;
  });

  /* ── What money buys ── */

  // "$80" is a word; "dinner out for all of us" is a quantity. The anchor has
  // to read naturally, stay silent when it cannot, and follow the parent's list.
  checks.buysLineReadsNaturally = await page.evaluate(() => {
    profile = 'parent';
    const forty = mnyBuysLine(45);
    const tiny = mnyBuysLine(2);                       // under the cheapest thing
    const one = mnyBuysLine(8);                        // exactly a jar of milk
    const natural = /\b(pizza|burger|book|plush)/.test(forty)
                 && tiny === ''
                 && /price of/.test(one)
                 && !/\d+\s+a\s/.test(forty);          // never "3 a burger meal"
    // A parent editing the list changes what she is told.
    mrApplyEdits([{ path: 'buys.items.1.amount', value: 16 }], { reason: 'family_meeting' });
    const afterEdit = mnyBuysItems().find(i => i.id === 'milk').amount === 16;
    mrApplyEdits([{ path: 'buys.items.1.amount', value: 8 }], { reason: 'correct_error' });
    return natural && afterEdit;
  });

  checks.noConsoleErrors = errors.length === 0;

  const failed = Object.entries(checks).filter(([,v]) => !v).map(([k]) => k);
  console.log(JSON.stringify({ checks, errors }, null, 2));
  console.log(failed.length ? `FAILED: ${failed.join(', ')}` : 'ALL SMOKE CHECKS PASSED');
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
