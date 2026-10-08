// Weekly-Planner — the picture test (Plan v1 "consistency pass", PR 0-A).
//
// Run: npm run test:pictures                      compare with tests/reference/
//      PICTURES_UPDATE=1 npm run test:pictures    write tests/reference/ instead
//
// Every screen and state the consistency pass touches is opened from ONE fixed
// fixture at ONE fixed clock, for Jenn, Jess and the parent where the screen
// differs by user, at the two sizes (iPad 1194×834, phone 390×844) in both
// looks (Pop, Calm). Each picture is compared pixel by pixel with its
// reference INSIDE the browser, on canvases (owner decision 1: no new package),
// and only the pictures that differ are printed.
//
// Stability rule: references are made and compared only on the CI Linux runner
// with the pinned browser. Fonts and the browser build differ elsewhere, so a
// run without CI set reports what differs and exits 0 ("local run — not
// gating"). Under CI an empty tests/reference/ is a failure ("no references
// in tests/reference/"), so the gate can never pass by comparing nothing; a
// local run with no references reports the fresh set and exits 0. The first
// set is taken from a CI run's `pictures` artifact (uploaded even when the
// step fails).
//
// Every run also writes the fresh set to tests/out/pictures-new/ and, for each
// picture that differs, a diff to tests/out/pictures-diff/ (the reference
// faded, the differing pixels red). The comparator checks itself first on
// every run: a picture against itself must give 0 differences, and the same
// picture with one planted changed pixel must be caught.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const REF_DIR = path.join(__dirname, 'reference');
const NEW_DIR = path.join(__dirname, 'out', 'pictures-new');
const DIFF_DIR = path.join(__dirname, 'out', 'pictures-diff');
const UPDATE = process.env.PICTURES_UPDATE === '1';
const GATING = !!process.env.CI;

/* A channel may differ by this much and still count as the same (anti-aliasing
   jitter). The allowed count of differing pixels is 0: the self-check requires a
   single planted pixel to fail its picture, so any allowance above 0 would let
   exactly that change through. */
const CHANNEL_TOLERANCE = 2;
const ALLOWED_PIXELS = 0;
/* A picture that differs is shot again, alone, in a brand-new browser context
   (a context never shares a renderer process with another, so no cache or
   state of the first shot carries over), up to this many times. It passes only
   when a re-shot matches the reference under the same tolerance and 0 pixels;
   each such pass is logged as "matched on retry N". Why: on the CI Linux runner
   colour emoji are scaled from a bitmap font, and their edges came out a few
   levels apart between two runs of the same code (parent-money, phone, Pop:
   14 pixels on the ⛸️ of one button), while a real change differs every time.
   The self-check does not retry. */
const RETRIES = 2;

const SIZES = { ipad: { width: 1194, height: 834 }, phone: { width: 390, height: 844 } };
const LOOKS = ['pop', 'calm'];

// The same browser search as tests/smoke.js and tests/cleanup-tool.test.js, in
// the same order (ARCHITECTURE.md, Verification), copied as they copy it.
function findChromium() {
  if (process.env.SMOKE_CHROMIUM) return process.env.SMOKE_CHROMIUM;
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    '/opt/pw-browsers',
    path.join(os.homedir(), '.cache', 'ms-playwright'),
    path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright')
  ];
  const binaries = [
    ['chrome-linux', 'chrome'],
    ['chrome-linux', 'headless_shell'],
    ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
    ['chrome-win', 'chrome.exe'],
    ['chrome-win64', 'chrome.exe']
  ];
  for (const root of roots) {
    if (!root || !fs.existsSync(root)) continue;
    for (const d of fs.readdirSync(root)) {
      if (!d.startsWith('chromium')) continue;
      for (const parts of binaries) {
        const p = path.join(root, d, ...parts);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]) {
    if (!base) continue;
    const p = path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe');
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

/* ── The fixture ──────────────────────────────────────────────────────────
   One explicit description of the family's data. It is applied once, through
   the app's own functions (so it always has the shape the app stores), in a
   builder page at two fixed clocks: the Sunday that closes last money week,
   where both girls sign, then the Wednesday every picture is taken at. What the
   builder leaves in localStorage is the stored state every picture page boots
   from (an init script writes it before the app's first line runs). Math.random
   is a fixed sequence, so ids and any random pick are the same on every run. */
const FIXTURE = {
  timezone: 'America/Edmonton',
  // Sunday 4 Oct 2026, 19:00 MDT — closes the money week Mon 28 Sep – Sun 4 Oct.
  settledSunday: '2026-10-04T19:00:00-06:00',
  // Wednesday 7 Oct 2026, 12:00 MDT — the clock of every picture.
  now: '2026-10-07T12:00:00-06:00',
  randomSeed: 20261007,
  kids: {
    jenn: {
      loan: { principal: 1000, paid: 336, monthly: 70 },
      chores: ['dishes', 'mop', 'vacuum', 'bins'], grade: 3,
      gift: { amount: 5, from: 'A gift', giver: 'Grandma' },
      goal: { name: 'New skate guards', icon: '🛼', target: 35 },
      sport: 'skating',
    },
    jess: {
      loan: { principal: 600, paid: 120, monthly: 40 },
      chores: ['dishes', 'bins', 'vacuum'], grade: 2,
      gift: { amount: 10, from: 'A gift', giver: 'Uncle Mike' },
      goal: { name: 'Book set', icon: '📚', target: 50 },
      sport: 'swimming',
    },
  },
  // This week's plan, the same shape for both girls (index into the planner's
  // Monday-first week).
  week: [
    [0, { id: 'fx-b0', actId: 'breakfast', startMin: 7 * 60 + 30, durationMin: 30 }],
    [0, { id: 'fx-s0', actId: 'school_day', startMin: 9 * 60, durationMin: 360 }],
    [1, { id: 'fx-s1', actId: 'school_day', startMin: 9 * 60, durationMin: 360 }],
    [1, { id: 'fx-p1', actId: 'piano', startMin: 16 * 60, durationMin: 60 }],
    [2, { id: 'fx-b2', actId: 'breakfast', startMin: 7 * 60 + 30, durationMin: 30 }],
    [2, { id: 'fx-s2', actId: 'school_day', startMin: 9 * 60, durationMin: 360 }],
    [2, { id: 'fx-c2', actId: 'chores', startMin: 17 * 60, durationMin: 30, choreTags: ['dishes', 'vacuum'] }],
    [2, { id: 'fx-r2', actId: 'reading', startMin: 19 * 60, durationMin: 45 }],
    [3, { id: 'fx-s3', actId: 'school_day', startMin: 9 * 60, durationMin: 360 }],
    [4, { id: 'fx-s4', actId: 'school_day', startMin: 9 * 60, durationMin: 360 }],
    [5, { id: 'fx-t5', actId: 'training', startMin: 17 * 60 + 30, durationMin: 120, sportTag: true,
          travelBuffer: true, travelBufMin: 30, getReadyBuffer: true, getReadyBufMin: 15 }],
  ],
  // This week's money: requests waiting for a parent, a fine, an expected gift.
  requests: [
    ['jess', { kind: 'comp', sport: 'swim', name: 'Swim time trial', custom: true, day: 2,
               races: [{ ev: '50 Free', time: '0:41.8', pts: 6 }] }],
    ['jenn', { kind: 'gift', amount: 20, giver: 'Uncle Mike' }],
    ['jenn', { kind: 'goal', name: 'Bike helmet', icon: '🚲', target: 40 }],
  ],
  fines: [['jess', 'tone', 1, 'Mom']],
  expected: [['jenn', { label: '🎄 Christmas', amount: 20 }]],
};

// Runs in the builder page at the settled Sunday: each girl's week of chores,
// a session and a gift, a loan, then her Sunday signed through the real sign
// sequence (mnyDoCommit), as tests/smoke.js signs one.
function seedSettledSunday(fx) {
  const out = {};
  for (const kid of Object.keys(fx.kids)) {
    const k = fx.kids[kid];
    profile = 'parent'; parentUnlockedThisSession = true; ctParentKid = kid;
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const d = mnyEnsureDebts(kid)[0];
    getProfData(kid).debts = [d];
    Object.assign(d, { principal: k.loan.principal, paid: k.loan.paid, arrears: 0, arrearsInterest: 0,
      monthly: k.loan.monthly, payments: [], sundaysSinceInterest: 0, lastInterestSunday: null,
      lastSundayPaidWeek: null, bonusRate: 10, createdAt: 1 });
    mrEnsureEarnings(kid, wk);
    k.chores.forEach((ch, i) => mrSetChoreGrade(kid, wk, i, ch, k.grade));
    const days = mrWeekDayKeys(wk);
    setDayBlocks(days[1], [{ id: 'fx-aj', actId: 'assistant_job', startMin: 17 * 60, durationMin: 90 }], kid);
    mrSetSessionAttendance(kid, wk, 'fx-aj', true);
    mnyAddDeposit(kid, wk, { amount: k.gift.amount, from: k.gift.from, giver: k.gift.giver, dayKey: days[0] });
    const draft = sdDraftFor(kid, wk);
    Object.assign(draft, sdFreshDraft(kid, wk));
    draft.alloc = sdAlloc({ extra: sdContext(kid, wk).P.hers });
    const res = mnyDoCommit(kid, wk);
    out[kid] = { wk, ok: !!(res && res.ok), why: res && res.why };
  }
  saveLocal();
  return out;
}

// Runs in the builder page at the picture clock: this week's plan for both
// girls, a goal each, the requests, a fine and an expected gift.
function seedThisWeek(fx) {
  const keys = getDayKeys(0);
  for (const kid of Object.keys(fx.kids)) {
    const k = fx.kids[kid];
    const byDay = {};
    fx.week.forEach(([i, b]) => {
      const blk = Object.assign({ checklistState: {} }, b, { id: b.id + '-' + kid });
      if (blk.sportTag) { delete blk.sportTag; blk.tag = k.sport; }
      (byDay[i] = byDay[i] || []).push(blk);
    });
    Object.keys(byDay).forEach(i => setDayBlocks(keys[i], byDay[i], kid));
    mnyAddGoal(kid, k.goal);
  }
  const wk = ctThisWeekKey(), days = mrWeekDayKeys(wk);
  profile = 'parent'; parentUnlockedThisSession = true;
  fx.fines.forEach(([kid, rule, day, who]) => mrAddFine(kid, rule, days[day], { who }));
  fx.expected.forEach(([kid, e]) => mnyAddExpected(kid, { month: String(todayKey()).slice(0, 7), label: e.label, amount: e.amount }));
  fx.requests.forEach(([kid, r]) => {
    profile = kid;
    const fields = Object.assign({}, r);
    if (fields.day != null) { fields.dayKey = days[fields.day]; delete fields.day; }
    mnyAddRequest(kid, fields);
  });
  profile = null;
  saveLocal();
  return { wk };
}

/* ── The state list ───────────────────────────────────────────────────────
   One row per screen or state the consistency pass (PRs 1–12) touches. `users`
   are the people it is shot for: 'jenn' / 'jess' open it as that girl
   (selectProfile), 'parent' as the parent past the PIN, 'any' straight from
   boot. `open` runs in the page; its argument is the user. `sheet: true` marks
   an open overlay or dialog, shot as the window shows it; `shows` (a CSS
   selector) must then match, or the row failed to open. Each picture is a
   fresh page load of the fixture, so no state leaks into the next.
   File: tests/reference/<state>-<user>-<ipad|phone>-<pop|calm>.png */
const KIDS = ['jenn', 'jess'];
const ALL = ['jenn', 'jess', 'parent'];
const P = ['parent'];
const parentTab = (tab) => `() => { setParentTab('${tab}'); }`;
const guTab = (t) => `() => { setParentTab('money'); mnyParentSection = '${t}'; mnyRenderRulesTab(); }`;
const meetingAt = (kid, extra) => `async () => {
  openFamilyMeeting(); mnyMeetKid = '${kid}'; mmGoTo('money');
  ${extra || ''}
}`;
// A Sunday moved to step n (1 Payday, 2 Choose) with the guess made and every
// payday tile shown.
// The day view of this week's day i (0 = Monday; the picture clock is day 2).
const dayAt = (i, extra) => `() => { const k = getDayKeys(0)[${i}]; openDay(k, ${i}); ${extra} }`;
const sdStep = (n) => `const d = sdCur(); d.step = ${n}; d.guess = 40; d.shown = 99; sdSave(d); renderMeetingMode();`;
const STATES = [
  // The 13 screens and their tabs.
  { state: 'profile',            users: ['any'], open: `() => {}` },
  { state: 'today',              users: KIDS,    open: `() => goToday()` },
  { state: 'week-full',          users: ALL,     open: `() => { goWeek(); setWeekView('full'); }` },
  { state: 'week-print-preview', users: KIDS,    open: `() => { goWeek(); setWeekView('preview'); }` },
  { state: 'day',                users: ALL,     open: `() => { const k = todayKey(); openDay(k, getDayKeys(0).indexOf(k)); }` },
  { state: 'chore',              users: ALL,     open: `() => openChoreTab()` },
  { state: 'mymoney',            users: ALL,     open: `(u) => mnyOpenMyMoney(u === 'parent' ? 'jenn' : u)` },
  { state: 'moneyschool',        users: ALL,     open: `(u) => mnyOpenSchool(u === 'parent' ? 'jenn' : u)` },
  { state: 'all-my-sundays',     users: KIDS,    open: `(u) => { mnyOpenMyMoney(u); mnyOpenSundays(); }` },
  { state: 'by-month',           users: KIDS,    open: `(u) => { mnyOpenMyMoney(u); mnyOpenByMonth(); }` },
  { state: 'sync',               users: KIDS,    open: `() => openSisterSync()` },
  { state: 'print',              users: KIDS,    open: `() => openPrint()` },
  { state: 'parent-monthly',     users: P,       open: `() => openParentMonthly('jenn')` },
  // The meeting, each step, and the Sunday's steps inside "The money".
  { state: 'meeting-week',       users: P,       open: `() => { openFamilyMeeting(); mmGoTo('week'); }` },
  // "The money" opens on the Sunday's first step, Guess: these two rows are
  // that step for each girl (a separate sunday-guess row was the same picture).
  { state: 'meeting-money-jenn', users: P,       open: meetingAt('jenn') },
  { state: 'meeting-money-jess', users: P,       open: meetingAt('jess') },
  { state: 'sunday-payday',      users: P,       open: meetingAt('jenn', sdStep(1)) },
  { state: 'sunday-choose',      users: P,       open: meetingAt('jenn', sdStep(2)) },
  { state: 'sunday-signed',      users: P,       open: meetingAt('jenn', `const out = sdDoSign('jenn', mmWeekKey()); if (!out || !out.ok) throw new Error('the sign refused: ' + (out && out.why));`) },
  { state: 'meeting-close',      users: P,       open: `() => { openFamilyMeeting(); mmGoTo('close'); }` },
  // The parent portal: the six destinations, their details, Grown-ups' tabs.
  { state: 'parent-now',         users: P,       open: parentTab('now') },
  { state: 'parent-review',      users: P,       open: parentTab('review') },
  { state: 'parent-history',     users: P,       open: parentTab('history') },
  { state: 'parent-trends',      users: P,       open: parentTab('trends') },
  { state: 'parent-analysis',    users: P,       open: parentTab('analysis') },
  { state: 'parent-money',       users: P,       open: parentTab('money') },
  { state: 'parent-setup',       users: P,       open: parentTab('setup') },
  { state: 'parent-options',     users: P,       open: parentTab('options') },
  { state: 'parent-routines',    users: P,       open: parentTab('routines') },
  { state: 'parent-tasks',       users: P,       open: parentTab('tasks') },
  { state: 'parent-rules',       users: P,       open: parentTab('rules') },
  { state: 'parent-copyweek',    users: P,       open: parentTab('copyweek') },
  { state: 'parent-app',         users: P,       open: parentTab('app') },
  { state: 'parent-access',      users: P,       open: parentTab('access') },
  { state: 'parent-profiles',    users: P,       open: parentTab('profiles') },
  { state: 'parent-prefs',       users: P,       open: parentTab('prefs') },
  { state: 'parent-school',      users: P,       open: parentTab('school') },
  { state: 'parent-backup',      users: P,       open: parentTab('backup') },
  { state: 'parent-conflicts',   users: P,       open: parentTab('conflicts') },
  // ➕ Commitments is the Money tab's home, so parent-money above is its picture.
  { state: 'grownups-fines',     users: P,       open: guTab('fines') },
  { state: 'grownups-expect',    users: P,       open: guTab('expect') },
  { state: 'grownups-rules',     users: P,       open: guTab('rules') },
  { state: 'grownups-weeks',     users: P,       open: guTab('weeks') },
  // The four overlays, a representative sheet and a confirm dialog.
  { state: 'sunday-overlay',     users: P, sheet: true, open: meetingAt('jenn', `sdOpenDad();`) },
  { state: 'grownups-overlay',   users: P, sheet: true, open: `() => { setParentTab('money'); guOpenSheet('loan', 'jenn', getProfData('jenn').debts[0].id); }` },
  { state: 'request-overlay',    users: KIDS, sheet: true, open: `(u) => { mnyOpenMyMoney(u); mnyOpenRequestSheet('gift', { kid: u }); }` },
  { state: 'told-overlay',       users: P, sheet: true, open: `() => { setParentTab('now'); pnOpenToldSheet(); }` },
  { state: 'info-sheet-sunday',  users: KIDS, sheet: true, open: `(u) => { mnyOpenMyMoney(u); mnyOpenInfoSheet('sunday', { id: '${'${WK_SETTLED}'}' }); }` },
  { state: 'confirm-dialog',     users: ['jenn'], sheet: true, open: `() => { goToday(); showConfirm('Remove this goal?', { danger: true, okLabel: 'Remove' }); }` },
  // Every other sheet, one user each, and the two pop-ups built in code. The
  // meeting's old familyMeetingOverlay is gone (it is screen-meeting, above).
  { state: 'record-sheet',       users: P, sheet: true, shows: '#recordOverlay.open', open: `() => { setParentTab('now'); openRecordSheet({ kid: 'jenn' }); }` },
  { state: 'sunday-line-sheet',  users: P, sheet: true, shows: '#sundayOverlay.open', open: meetingAt('jenn', sdStep(1) + ` sdOpenLine(document.querySelector('[data-mny-action="sd-line"]').getAttribute('data-sd-tile'), false);`) },
  { state: 'profile-switch',     users: ['jenn'], sheet: true, shows: '#profileSwitchOverlay.open', open: `() => { goToday(); openProfileSwitcher(); }` },
  { state: 'slot-picker',        users: ['jenn'], sheet: true, shows: '#slotPickerOverlay.open', open: dayAt(2, `openSlotPicker(15 * 60);`) },
  { state: 'activity-sheet',     users: ['jenn'], sheet: true, shows: '#activityOverlay.open', open: dayAt(2, `selectedActivity = findActivity('reading'); pendingStartMin = 20 * 60; as_ = activityPlacementDraft(selectedActivity); openActivitySheet();`) },
  { state: 'training-sheet',     users: ['jenn'], sheet: true, shows: '#trainingOverlay.open', open: dayAt(2, `selectedActivity = findActivity('training'); pendingStartMin = 17 * 60 + 30; ts = activityPlacementDraft(selectedActivity); openTrainingSheet();`) },
  { state: 'edit-sheet',         users: ['jenn'], sheet: true, shows: '#editOverlay.open', open: dayAt(2, `openEditSheet('fx-r2-jenn');`) },
  { state: 'kid-routine-quick',  users: ['jenn'], sheet: true, shows: '#kidRoutineOverlay.open', open: `() => { const k = getDayKeys(0)[2];
    setDayBlocks(k, getDayBlocks(k, 'jenn').concat([{ id: 'fx-rt-jenn', actId: 'routine_morning', startMin: 6 * 60 + 45, durationMin: 30, checklistState: {} }]), 'jenn');
    openDay(k, 2); openKidRoutineQuick('fx-rt-jenn'); }` },
  { state: 'kid-training-quick', users: ['jenn'], sheet: true, shows: '#kidTrainingOverlay.open', open: dayAt(5, `openKidTrainingQuick('fx-t5-jenn');`) },
  { state: 'template-sheet',     users: ['jenn'], sheet: true, shows: '#templateOverlay.open', open: dayAt(2, `openTemplateSheet();`) },
  { state: 'reflect-sheet',      users: ['jenn'], sheet: true, shows: '#reflectOverlay.open', open: `() => { goToday(); openReflectSheet(todayKey()); }` },
  { state: 'custom-activity',    users: ['jenn'], sheet: true, shows: '#customOverlay.open', open: dayAt(2, `openCustomActivity('all');`) },
  { state: 'custom-task',        users: ['jenn'], sheet: true, shows: '#customTaskOverlay.open', open: dayAt(2, `openCustomTask();`) },
  { state: 'weekly-wins',        users: ['jenn'], sheet: true, shows: '#weeklyWinsOverlay.open', open: `() => { goWeek(); openWeeklyWins(); }` },
  { state: 'level-sheet',        users: ['jenn'], sheet: true, shows: '#tdLevelOverlay.open', open: `() => { goToday(); tdOpenLevel('jenn'); }` },
  { state: 'more-sheet',         users: ['jenn'], sheet: true, shows: '#tdMoreOverlay.open', open: `() => { goToday(); tdOpenMore(); }` },
  { state: 'new-challenge',      users: ['jenn'], sheet: true, shows: '#newChallengeOverlay.open', open: `() => { goToday(); openNewChallenge(); }` },
  // The quest pop-up hides itself after 1.4 s; its timer is cleared so it stays.
  { state: 'quest-popup',        users: ['jenn'], sheet: true, shows: '#questPopup.show', open: `() => { goToday(); showQuestCompletePopup(findActivity('reading'), { awarded: 8 }); clearTimeout(window._questPopupT); }` },
  { state: 'custom-sport',       users: P, sheet: true, shows: '#customSportOverlay.open', open: `() => { setParentTab('options'); openCustomSport(); }` },
  { state: 'parent-activity',    users: P, sheet: true, shows: '#parentActivityOverlay.open', open: `() => { setParentTab('options'); openParentActivityEditor(); }` },
  { state: 'new-rule',           users: P, sheet: true, shows: '#newRuleOverlay.open', open: `() => { setParentTab('rules'); openNewLevelRule(); }` },
  { state: 'new-routine',        users: P, sheet: true, shows: '#newRoutineOverlay.open', open: `() => { setParentTab('routines'); openNewRoutine(); }` },
  { state: 'chore-group',        users: P, sheet: true, shows: '#choreGroupOverlay.open', open: `() => { openChoreTab(); ctOpenGroupEditor(null); }` },
];

/* ── Pages ────────────────────────────────────────────────────────────── */

// Firebase hosts are cut off exactly as in tests/smoke.js: there is one live
// document and no test one. Google Fonts stay reachable, so the pictures show
// the typeface a child sees.
const FIREBASE = ['**://firestore.googleapis.com/**', '**://*.firebaseio.com/**', '**://www.gstatic.com/firebasejs/**',
  '**://identitytoolkit.googleapis.com/**', '**://firebaseinstallations.googleapis.com/**'];

// No transitions, no caret, no smooth scroll. Animations are also finished by
// the screenshot itself (`animations: 'disabled'`).
const STILL_CSS = `*, *::before, *::after { transition: none !important; animation-duration: 0s !important;
  animation-delay: 0s !important; caret-color: transparent !important; scroll-behavior: auto !important; }`;

async function newContext(browser, size, clock) {
  const ctx = await browser.newContext({ viewport: SIZES[size], deviceScaleFactor: 1,
    timezoneId: FIXTURE.timezone, reducedMotion: 'reduce', locale: 'en-CA' });
  for (const p of FIREBASE) await ctx.route(p, r => r.abort());
  await ctx.clock.setFixedTime(new Date(clock));
  // A fixed Math.random, restarted on every load.
  await ctx.addInitScript((seed) => {
    let s = seed >>> 0;
    Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, FIXTURE.randomSeed);
  return ctx;
}

async function boot(page) {
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction(() => typeof showScreen === 'function' && !!document.querySelector('#screen-profile.active'));
  const live = await page.evaluate(() => !!fbDocRef);
  if (live) throw new Error('ABORTING: the app reached Firebase. Check the route blocks.');
  await page.addStyleTag({ content: STILL_CSS });
  // Toasts come and go on a timer; a picture is of the screen, not of a toast.
  await page.evaluate(() => { window.showToast = () => {}; });
}

// Waits until the page has stopped changing: every web font loaded and no DOM
// mutation for 200 ms (at most 3 s), then two frames.
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => {
      let t = setTimeout(done, 200);
      const end = setTimeout(done, 3000);
      const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(done, 200); });
      mo.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
      function done() { mo.disconnect(); clearTimeout(t); clearTimeout(end); resolve(); }
    });
    await document.fonts.ready;
    await Promise.all([...document.fonts].filter(f => f.status === 'loading').map(f => f.loaded.catch(() => null)));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

// A sticky element gets its own compositor layer, and Chromium places that
// layer at a fractional offset differently from one load to the next (the
// Full week's day headers came out a pixel apart). Every picture is taken
// scrolled to the top, where a sticky element sits exactly where the flow puts
// it, so pinning it there (relative, no offsets) changes nothing on the
// picture except the layer.
async function unstick(page) {
  await page.evaluate(() => {
    document.querySelectorAll('*').forEach(e => {
      if (e.dataset.pxUnstuck || getComputedStyle(e).position !== 'sticky') return;
      e.dataset.pxUnstuck = '1';
      e.style.setProperty('position', 'relative', 'important');
      ['top', 'bottom', 'left', 'right'].forEach(p => e.style.setProperty(p, 'auto', 'important'));
    });
  });
}

// A picture is kept only when two taken in a row are the same, so a late
// re-render (a web font arriving, a measured label re-drawn) cannot be caught
// half way. Up to five tries.
// A screen is shot whole (fullPage); an open sheet or dialog covers the
// window, so it is shot as the window shows it.
async function stillShot(page, sheet) {
  let last = null;
  for (let i = 0; i < 5; i++) {
    await unstick(page);
    await settle(page);
    const png = await page.screenshot({ fullPage: !sheet, animations: 'disabled', caret: 'hide' });
    if (last && last.equals(png)) return png;
    last = png;
  }
  return null;
}

async function buildStorage(browser) {
  const ctx = await newContext(browser, 'ipad', FIXTURE.settledSunday);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await boot(page);
  const past = await page.evaluate(seedSettledSunday, FIXTURE);
  const bad = Object.entries(past).filter(([, r]) => !r.ok);
  if (bad.length) throw new Error('fixture: the settled Sunday did not sign: ' + JSON.stringify(bad));
  await ctx.clock.setFixedTime(new Date(FIXTURE.now));
  await boot(page);
  await page.evaluate(seedThisWeek, FIXTURE);
  const storage = await page.evaluate(() => {
    const o = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!/^wp_look_/.test(k)) o[k] = localStorage.getItem(k);
    }
    return o;
  });
  await ctx.close();
  if (errors.length) throw new Error('fixture: the app threw while seeding:\n  ' + errors.join('\n  '));
  return { storage, settledWeek: past.jenn.wk };
}

// One size in one look: every state, each from a fresh load of the fixture.
// With `only` (a picture name), just that one picture, in a context of its own.
async function shootAll(browser, size, look, storage, settledWeek, only) {
  const ctx = await newContext(browser, size, FIXTURE.now);
  await ctx.addInitScript(({ storage, look }) => {
    localStorage.clear();
    Object.entries(storage).forEach(([k, v]) => localStorage.setItem(k, v));
    ['jenn', 'jess', 'parent', 'last'].forEach(k => localStorage.setItem('wp_look_' + k, look));
  }, { storage, look });
  const page = await ctx.newPage();
  let errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    if (m.type() === 'error' && !/firestore|firebase|net::|CORS|fetch/i.test(m.text())) errors.push(m.text());
  });
  const shots = [], problems = [];
  for (const s of STATES) {
    for (const user of s.users) {
      const name = `${s.state}-${user}-${size}-${look}`;
      if (only && name !== only) continue;
      errors = [];
      try {
        await boot(page);
        await page.evaluate(async (u) => {
          if (u === 'parent') {
            profile = 'parent'; parentUnlockedThisSession = true; parentViewing = 'jenn';
            showScreen('parent'); renderParentHome();
          } else if (u !== 'any') {
            await selectProfile(u);
          }
        }, user);
        const src = s.open.replace('${WK_SETTLED}', settledWeek);
        await page.evaluate(`(${src})(${JSON.stringify(user)})`);
        await page.evaluate(async (l) => {
          applyLook(l);
          if (l === 'calm') {
            await Promise.all(['16px Lexend', '600 16px Lexend', '700 16px "Baloo 2"', '800 16px "Baloo 2"']
              .map(f => document.fonts.load(f).catch(() => null)));
          }
          /* The Full week sizes its labels from type measured on screen and
             re-draws when a font arrives — but only when the measure changed,
             so whether the first draw happened before or after a font landed
             could leave either layout. With every font in, measure afresh and
             draw once more, as a device does once its fonts are in. */
          await document.fonts.ready;
          if (document.getElementById('screen-week').classList.contains('active') && weekView === 'full') {
            wfTypeCache = null; wfTextWidthCache = new Map(); renderWeek();
          }
          window.scrollTo(0, 0);
        }, look);
        if (s.shows && !(await page.evaluate((sel) => !!document.querySelector(sel), s.shows))) {
          throw new Error(`${s.shows} is not on show after open`);
        }
        const png = await stillShot(page, !!s.sheet);
        if (!png) problems.push(`${name}: never held still for two pictures in a row`);
        else shots.push({ name, png, size, look });
        if (errors.length) problems.push(`${name}: the app reported an error — ${errors.join(' | ')}`);
      } catch (e) {
        if (/^ABORTING/.test(e.message)) throw e;
        problems.push(`${name}: could not be opened — ${String(e.message || e).split('\n')[0]}`);
      }
    }
  }
  await ctx.close();
  return { shots, problems };
}

/* ── The compare, in the browser ──────────────────────────────────────────
   Two PNGs go in as data URLs, are drawn onto canvases and compared RGBA by
   RGBA. Returns the count of differing pixels, their bounding box and, when
   any differ, a diff PNG (data URL). Pictures of different sizes differ
   everywhere outside the shared area. */
function compareInPage({ a, b, tol, wantDiff }) {
  const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('not a PNG')); i.src = src; });
  return Promise.all([load(a), load(b)]).then(([ia, ib]) => {
    const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
    const pix = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const pa = pix(ia), pb = pix(ib);
    const inA = (x, y) => x < ia.width && y < ia.height, inB = (x, y) => x < ib.width && y < ib.height;
    let count = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
    const diff = wantDiff ? new Uint8ClampedArray(w * h * 4) : null;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        let same = inA(x, y) === inB(x, y);
        if (same && inA(x, y)) {
          same = Math.abs(pa[i] - pb[i]) <= tol && Math.abs(pa[i + 1] - pb[i + 1]) <= tol &&
                 Math.abs(pa[i + 2] - pb[i + 2]) <= tol && Math.abs(pa[i + 3] - pb[i + 3]) <= tol;
        }
        if (!same) { count++; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
        if (diff) {
          if (same) { const g = 255 - (255 - (pa[i] + pa[i + 1] + pa[i + 2]) / 3) * 0.25; diff[i] = diff[i + 1] = diff[i + 2] = g; }
          else { diff[i] = 255; diff[i + 1] = 0; diff[i + 2] = 0; }
          diff[i + 3] = 255;
        }
      }
    }
    let diffUrl = null;
    if (diff && count) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').putImageData(new ImageData(diff, w, h), 0, 0);
      diffUrl = c.toDataURL('image/png');
    }
    return { count, box: count ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null, diffUrl,
             size: [ia.width, ia.height, ib.width, ib.height] };
  });
}

// One pixel of a PNG changed past the tolerance, for the self-check.
function plantPixelInPage({ a, x, y }) {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = a; }).then(img => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(x, y, 1, 1);
    for (let k = 0; k < 3; k++) d.data[k] = d.data[k] < 128 ? 255 : 0;
    d.data[3] = 255;
    ctx.putImageData(d, x, y);
    return c.toDataURL('image/png');
  });
}

const dataUrl = (buf) => 'data:image/png;base64,' + buf.toString('base64');
const fromDataUrl = (u) => Buffer.from(u.slice(u.indexOf(',') + 1), 'base64');

async function selfCheck(cmp, png) {
  const a = dataUrl(png);
  const same = await cmp.evaluate(compareInPage, { a, b: a, tol: CHANNEL_TOLERANCE, wantDiff: false });
  const planted = await cmp.evaluate(plantPixelInPage, { a, x: 7, y: 5 });
  const caught = await cmp.evaluate(compareInPage, { a, b: planted, tol: CHANNEL_TOLERANCE, wantDiff: false });
  const problems = [];
  if (same.count !== 0) problems.push(`a picture against itself gave ${same.count} differing pixels, expected 0`);
  if (caught.count !== 1 || !caught.box || caught.box.x !== 7 || caught.box.y !== 5) {
    problems.push(`one planted pixel at (7,5) gave ${caught.count} differing pixels at ${JSON.stringify(caught.box)}, expected 1 at (7,5)`);
  }
  if (!(caught.count > ALLOWED_PIXELS)) problems.push('one planted pixel does not fail its picture under the allowed-pixel count');
  return problems;
}

(async () => {
  const started = Date.now();
  // Text drawn the same way on every run: no font hinting, no LCD (subpixel)
  // anti-aliasing, software raster.
  const browser = await chromium.launch({ executablePath: findChromium(),
    args: ['--font-render-hinting=none', '--disable-lcd-text', '--disable-gpu', '--num-raster-threads=1',
      '--disable-partial-raster', '--disable-skia-runtime-opts', '--disable-threaded-scrolling', '--disable-checker-imaging'] });
  let exitCode = 0;
  try {
    const { storage, settledWeek } = await buildStorage(browser);

    const runs = [];
    for (const size of Object.keys(SIZES)) for (const look of LOOKS) runs.push(shootAll(browser, size, look, storage, settledWeek));
    const results = await Promise.all(runs);
    const shots = results.flatMap(r => r.shots);
    const openProblems = results.flatMap(r => r.problems);
    // Every picture the state list names, whether or not it was taken this run.
    const listed = new Set();
    STATES.forEach(st => st.users.forEach(u => Object.keys(SIZES).forEach(z => LOOKS.forEach(l => listed.add(`${st.state}-${u}-${z}-${l}.png`)))));
    const stateRows = STATES.reduce((n, s) => n + s.users.length, 0);
    console.log(`pictures: ${STATES.length} states, ${stateRows} state × user rows × ${Object.keys(SIZES).length} sizes × ${LOOKS.length} looks = ${shots.length} pictures in ${((Date.now() - started) / 1000).toFixed(0)} s`);

    const cmpCtx = await browser.newContext();
    const cmp = await cmpCtx.newPage();
    await cmp.goto('about:blank');

    // 1. The comparator checks itself, on a real picture.
    const selfProblems = shots.length ? await selfCheck(cmp, shots[0].png) : ['no picture was taken, so the comparator could not check itself'];
    if (selfProblems.length) {
      console.error('FAIL  the pixel compare is broken:\n  ' + selfProblems.join('\n  '));
      process.exitCode = 1;
      return;
    }
    console.log('self-check: a picture against itself = 0 differences; one planted pixel = caught');

    fs.rmSync(NEW_DIR, { recursive: true, force: true });
    fs.rmSync(DIFF_DIR, { recursive: true, force: true });
    fs.mkdirSync(NEW_DIR, { recursive: true });
    shots.forEach(s => fs.writeFileSync(path.join(NEW_DIR, s.name + '.png'), s.png));

    if (UPDATE) {
      fs.mkdirSync(REF_DIR, { recursive: true });
      fs.readdirSync(REF_DIR).filter(f => f.endsWith('.png') && !listed.has(f)).forEach(f => fs.rmSync(path.join(REF_DIR, f)));
      shots.forEach(s => fs.writeFileSync(path.join(REF_DIR, s.name + '.png'), s.png));
      console.log(`PICTURES_UPDATE=1: ${shots.length} references written to tests/reference/`);
      if (openProblems.length) {
        console.error(`\n${openProblems.length} state(s) did not open cleanly:\n  ${openProblems.join('\n  ')}`);
        if (GATING) exitCode = 1;
      }
      return;
    }

    const refs = fs.existsSync(REF_DIR) ? fs.readdirSync(REF_DIR).filter(f => f.endsWith('.png')) : [];
    const problems = openProblems.slice();
    if (!refs.length) {
      if (GATING) problems.push('no references in tests/reference/ — copy the CI artifact `pictures` (pictures-new/*.png) into tests/reference/');
      else console.log(`no references in tests/reference/ — ${shots.length} pictures written to tests/out/pictures-new/; take the first set from the CI artifact \`pictures\` into tests/reference/`);
    } else {
      refs.filter(f => !listed.has(f)).forEach(f => problems.push(`${f}: a reference with no state in the list`));
      let differ = 0;
      const retried = [];
      for (const s of shots) {
        const refPath = path.join(REF_DIR, s.name + '.png');
        if (!fs.existsSync(refPath)) { problems.push(`${s.name}: missing reference`); continue; }
        const ref = dataUrl(fs.readFileSync(refPath));
        const r = await cmp.evaluate(compareInPage, { a: ref, b: dataUrl(s.png), tol: CHANNEL_TOLERANCE, wantDiff: true });
        let matched = false;
        for (let n = 1; r.count > ALLOWED_PIXELS && !matched && n <= RETRIES; n++) {
          const again = (await shootAll(browser, s.size, s.look, storage, settledWeek, s.name)).shots[0];
          if (!again) continue;
          const rr = await cmp.evaluate(compareInPage, { a: ref, b: dataUrl(again.png), tol: CHANNEL_TOLERANCE, wantDiff: false });
          if (rr.count <= ALLOWED_PIXELS) {
            matched = true;
            retried.push(s.name);
            console.log(`matched on retry ${n}: ${s.name} (first shot: ${r.count} pixels differed, box x=${r.box.x} y=${r.box.y} w=${r.box.w} h=${r.box.h})`);
            fs.writeFileSync(path.join(NEW_DIR, s.name + '.png'), again.png);
          }
        }
        if (r.count > ALLOWED_PIXELS && !matched) {
          differ++;
          fs.mkdirSync(DIFF_DIR, { recursive: true });
          if (r.diffUrl) fs.writeFileSync(path.join(DIFF_DIR, s.name + '.png'), fromDataUrl(r.diffUrl));
          const sz = (r.size[0] !== r.size[2] || r.size[1] !== r.size[3]) ? ` (size ${r.size[0]}×${r.size[1]} → ${r.size[2]}×${r.size[3]})` : '';
          problems.push(`${s.name}: ${r.count} pixels differ, box x=${r.box.x} y=${r.box.y} w=${r.box.w} h=${r.box.h}${sz}; still differs after ${RETRIES} re-shots in a new context`);
        }
      }
      console.log(`compared ${shots.length} pictures with tests/reference/: ${differ} differ` +
        `, ${retried.length} matched only on a retry (up to ${RETRIES} re-shots each in a new context)`);
    }
    if (problems.length) {
      console.error(`\n${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
      if (GATING) { console.error('\nFAIL  picture test (diffs in tests/out/pictures-diff/, fresh set in tests/out/pictures-new/)'); exitCode = 1; }
      else console.log('\nlocal run — not gating (references are made and compared on the CI Linux runner only)');
    } else {
      console.log(refs.length ? 'ALL PICTURES MATCH' : 'pictures taken; nothing to compare yet');
    }
  } catch (e) {
    console.error('FAIL  ' + (e && e.stack || e));
    exitCode = 1;
  } finally {
    await browser.close();
    if (exitCode) process.exitCode = exitCode;
  }
})();
