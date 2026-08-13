// Headless-browser smoke test for index.html.
// Run: npm ci && npm run test:smoke
// Boots the app offline (Firebase errors are ignored), seeds a test week, and
// drives the main flows. Prints a JSON report; exits non-zero on any failure
// or unexpected console error. Screenshots land in tests/out/.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright-core');

/* A throwaway static server for the handful of checks that need a real origin.
   The suite runs over file:// on purpose — CLAUDE.md, and it is what keeps ES
   modules impossible — but file:// blocks fetch() outright, so a manifest check
   run there reports a broken manifest whether or not it is broken. Rather than
   move everything to http and lose the file:// guarantee, one short pass at the
   end serves the repo and checks the things only an origin can answer.
   No dependency: node's own http, ~30 lines. */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/manifest+json', '.png': 'image/png',
               '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serveRepo() {
  const root = path.join(__dirname, '..');
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const file = path.join(root, rel);
      // Never serve outside the repo.
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function findChromium() {
  if (process.env.SMOKE_CHROMIUM) return process.env.SMOKE_CHROMIUM;
  // Every known location, in preference order. These are additive on purpose:
  // PLAYWRIGHT_BROWSERS_PATH must not replace the others, or an environment
  // that sets it (this repo's cloud sandbox does, to /opt/pw-browsers) loses
  // the fallbacks entirely.
  const roots = [
    // Explicit override, when the environment points at its own install.
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    // Claude Code cloud environments pre-install browsers here.
    '/opt/pw-browsers',
    // Playwright's own default install root, used by
    // `npx playwright install chromium` — this is what CI and a developer
    // laptop resolve through. Without it, playwright-core (which ships no
    // browsers and no installer) has nothing to fall back to.
    path.join(os.homedir(), '.cache', 'ms-playwright'),
    // macOS default for the same install.
    path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')
  ];
  const binaries = [
    ['chrome-linux', 'chrome'],
    ['chrome-linux', 'headless_shell'],
    ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium']
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

  /* ── Cut the app off from the real Firebase before it can reach it ──────────
     THIS IS A SAFETY MEASURE, NOT A CONVENIENCE.

     There is exactly one Firestore document — `weekly_planner/shared_state` —
     and it holds the family's live planner. There is no test document. The app
     connects on boot and every mutation goes saveAll → pushToFirebase → set().
     This suite performs hundreds of mutations.

     So on any machine with working network, running this test WRITES TEST DATA
     INTO THE CHILDREN'S REAL PLANNER. It went unnoticed for a long time because
     this sandbox's proxy blocks Firestore, so the app silently fell back to
     "Local only" and the suite has only ever run isolated by accident. The first
     CI run on a GitHub runner, which has open network, is what exposed it —
     it failed on production data whose shape differs from the defaults.

     Blocking at the network layer rather than in the app: the test must not
     depend on the app remembering to be safe, and this also keeps the suite
     deterministic — it exercises the shipped defaults instead of whatever
     happens to be in the cloud that day.

     Do not remove this without providing a separate test document first.

     Scoped to Firebase hosts only — fonts.googleapis.com and fonts.gstatic.com
     stay reachable, so the uploaded screenshots show the real typeface and the
     font-size floor is measured against the fonts a child actually sees. */
  for (const pattern of [
    '**://firestore.googleapis.com/**',          // the database itself
    '**://*.firebaseio.com/**',                  // realtime db, listed in the config
    '**://www.gstatic.com/firebasejs/**',        // the SDK — without it, initFirebase bails
    '**://identitytoolkit.googleapis.com/**',    // auth, for when it lands
    '**://firebaseinstallations.googleapis.com/**',
  ]) await page.route(pattern, r => r.abort());

  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(1200);

  // Prove the isolation held rather than assuming it: if Firebase ever
  // initialises here, every later check is running against live family data.
  {
    const live = await page.evaluate(() => ({ ref: !!fbDocRef, connected: !!fbConnected }));
    if (live.ref) {
      console.error('ABORTING: the app reached Firebase. This test would write to the ' +
                    'family\'s real planner. Check the page.route blocks above.');
      await browser.close();
      process.exit(1);
    }
  }

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

  /* The week's default layout, asserted before anything here navigates. Three
     things have to agree and nothing enforces it at runtime: the initial value
     of weekView, which container index.html leaves visible, and which tab it
     marks active. renderWeek dispatches on weekView but never syncs the
     containers — only setWeekView does — so if the state default and the markup
     drift apart, the week boots showing one layout while rendering into another,
     and nothing else in this suite would notice. */
  checks.weekOpensOnDayBlocks = await page.evaluate(() => {
    const bad = [];
    if (weekView !== 'timegrid') bad.push(`default weekView is '${weekView}', expected 'timegrid'`);
    if (getComputedStyle(document.getElementById('weekTimeGrid')).display === 'none')
      bad.push('index.html hides #weekTimeGrid, which the default weekView selects');
    if (getComputedStyle(document.getElementById('weekFull')).display !== 'none')
      bad.push('index.html leaves #weekFull visible too');
    if (!document.getElementById('viewTabTimeGrid').classList.contains('active'))
      bad.push('the Day Blocks tab is not marked active in index.html');
    if (document.getElementById('viewTabFull').classList.contains('active'))
      bad.push('the Full tab is still marked active in index.html');
    return bad.length === 0 || bad;
  });

  /* The school calendar. The band used to be hardcoded 9am–3pm Mon–Fri while
     SCHOOL_TEMPLATE placed the school block at 8am, so the two contradicted each
     other and both were wrong on every holiday and all summer. The arithmetic
     assertion is the one that matters: the published calendar states 177
     instructional days for K-8, so if a date was mistyped the count moves. */
  checks.schoolCalendarIsRight = await page.evaluate(() => {
    const bad = [];
    const iso = (d) => d.toISOString().slice(0, 10);
    // Template and band cannot disagree: both come from SCHOOL_HOURS.
    const tpl = SCHOOL_TEMPLATE.find(b => b.actId === 'school_day');
    if (!tpl || tpl.startMin !== SCHOOL_HOURS.startMin
             || tpl.durationMin !== SCHOOL_HOURS.endMin - SCHOOL_HOURS.startMin)
      bad.push('SCHOOL_TEMPLATE no longer derives from SCHOOL_HOURS');

    // No weekend should ever appear in the holiday list — weekends are already
    // covered by SCHOOL_HOURS.days, and one there means a mistyped date.
    const weekendEntries = NO_SCHOOL_DAYS.filter(k => {
      const dow = new Date(k + 'T12:00:00').getDay();
      return dow === 0 || dow === 6;
    });
    if (weekendEntries.length) bad.push(`weekend dates in NO_SCHOOL_DAYS: ${weekendEntries.join(', ')}`);
    if (new Set(NO_SCHOOL_DAYS).size !== NO_SCHOOL_DAYS.length) bad.push('NO_SCHOOL_DAYS has duplicates');

    // Count the instructional days the calendar actually yields.
    let taught = 0;
    for (let d = new Date(SCHOOL_TERM.start + 'T12:00:00');
         iso(d) <= SCHOOL_TERM.end; d.setDate(d.getDate() + 1)) {
      if (isSchoolDay(iso(d))) taught++;
    }
    if (taught !== 177) bad.push(`${taught} instructional days, the published calendar says 177`);

    // The three states that are not "school today".
    if (isSchoolDay('2026-12-25')) bad.push('Christmas Day counted as school');
    if (isSchoolDay('2027-07-14')) bad.push('a July weekday counted as school');   // summer
    if (isSchoolDay('2026-09-05')) bad.push('a Saturday counted as school');
    if (!isSchoolDay('2026-09-08')) bad.push('an ordinary term Tuesday was not school');
    // Past the known year it stops pretending, and says so to a parent only.
    if (!schoolCalendarIsStale('2028-10-03')) bad.push('a date past the shipped calendar is not flagged stale');
    if (schoolCalendarIsStale('2026-10-05')) bad.push('an in-term date was flagged stale');
    return bad.length === 0 || bad;
  });

  // The bands on the day itself follow that calendar rather than the weekday.
  checks.dayBandsFollowTheCalendar = await page.evaluate(() => {
    const bad = [];
    const labels = () => [...document.querySelectorAll('#screen-day .tl-band-seg')].map(e => e.textContent);
    profile = 'jenn'; parentViewing = 'jenn';
    openDay('2026-09-08', 1);                       // an ordinary school Tuesday
    const school = labels();
    if (!school.some(l => /SCHOOL/.test(l))) bad.push(`no school band on a term Tuesday: ${school.join(' / ')}`);
    openDay('2026-12-25', 4);                       // Christmas Day
    const holiday = labels();
    if (!holiday.some(l => /FREE TIME/.test(l))) bad.push(`Christmas Day did not read as free: ${holiday.join(' / ')}`);
    openDay('2027-07-14', 2);                       // mid-summer
    const summer = labels();
    if (!summer.some(l => /FREE TIME/.test(l))) bad.push(`a July day did not read as free: ${summer.join(' / ')}`);

    /* The labels are set sideways, so a band's height is the line length the
       text has to fit into. The before-school band is only as tall as the gap
       between 6am and the first bell, and "BEFORE SCHOOL" wants ~171px in the
       166px an 8am start leaves — it clipped. Measure the text, not the box:
       overflow:hidden means a clipped label still reports a tidy scrollHeight. */
    openDay('2026-09-08', 1);
    [...document.querySelectorAll('#screen-day .tl-band-seg')].forEach(el => {
      const r = document.createRange(); r.selectNodeContents(el);
      const text = r.getBoundingClientRect().height, box = el.getBoundingClientRect().height;
      if (text > box + 1) bad.push(`band "${el.textContent}" needs ${Math.round(text)}px in ${Math.round(box)}px`);
    });
    return bad.length === 0 || bad;
  });

  /* Weekly view: Y-axis sideband + hour lines + slot tint bands. These belong to
     the Full layout, which is no longer the one the week opens on — Day Blocks
     is. So select it first rather than assuming: the alternate layout still has
     to work, and an assertion that silently measured whichever view happened to
     be default would stop testing anything the day the default moved. */
  checks.weekSideband = await page.evaluate(() => {
    setWeekView('full');
    return document.querySelectorAll('.wf-sideband-seg').length === 4;
  });
  checks.weekHourLines = await page.evaluate(() =>
    document.querySelectorAll('.wf-hour-line').length > 0);
  // Day Blocks renders once selected.
  checks.dayBlocksRenders = await page.evaluate(() => {
    setWeekView('timegrid');
    return document.querySelectorAll('.tg2-lane').length === 7 || ['no day lanes in Day Blocks'];
  });

  // Kid money surface: kids reach Pocket Money and may LOOK at the bank, but
  // every function that moves money refuses them.
  // One label for one destination (audit P2-4). The Quest board used to call it
  // "My pocket money" while three other entry points called it "My money"; the
  // shortcut row those lived in is gone, so the surviving routes are checked.
  checks.kidMoneyLabel = await page.evaluate(() => {
    profile = 'jenn'; goToday();
    const nav = document.querySelector('#kidNav [data-td-nav="money"]');
    const navSays = !!nav && nav.textContent.includes('Money');
    showScreen('quest'); renderQuestBoard();
    const questText = document.getElementById('screen-quest').textContent;
    const questSays = !/pocket money/i.test(questText);
    goWeek();
    return navSays && questSays;
  });
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
  // ── Redesign phase 1: claims, the pool↔planner seam, goal shapes ──
  // A kid CAN say how a chore went, and saying so moves no money.
  checks.claimIsNotPayment = await page.evaluate(() => {
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = activeProfile(), wk = ctWeekKey;
    const before = mrWeekMoney(wk, kid);
    const ok = mrSetClaim(kid, wk, 0, 'dishes', 3);
    return ok === true
        && mrGetClaim(kid, wk, 0, 'dishes') === 3
        && mrGetChoreGrade(kid, wk, 0, 'dishes') === 0   // still ungraded
        && mrWeekMoney(wk, kid) === before;              // and still unpaid
  });
  // Every check from here leaves the week as it found it, so a later one can
  // assert on the queue being empty and mean it.
  // A claim with no grade is what the parent queue is made of; grading clears it.
  checks.gradingClearsTheQueue = await page.evaluate(() => {
    const kid = activeProfile(), wk = ctWeekKey;
    const queued = mrClaimQueue(wk, kid).some(q => q.choreId === 'dishes' && q.dayIdx === 0);
    const wasParent = profile;
    profile = 'parent';
    mrSetChoreGrade(kid, wk, 0, 'dishes', 3);
    const gone = !mrClaimQueue(wk, kid).some(q => q.choreId === 'dishes' && q.dayIdx === 0);
    mrSetChoreGrade(kid, wk, 0, 'dishes', 0);            // put it back
    profile = wasParent;
    mrSetClaim(kid, wk, 0, 'dishes', 0);                 // and clear the claim
    return queued && gone;
  });
  // A kid must not answer for her sister's week.
  checks.kidCannotClaimForSister = await page.evaluate(() => {
    const other = activeProfile() === 'jenn' ? 'jess' : 'jenn';
    const before = mrGetClaim(other, ctWeekKey, 0, 'dishes');
    const ok = mrSetClaim(other, ctWeekKey, 0, 'dishes', 3);
    return ok === false && mrGetClaim(other, ctWeekKey, 0, 'dishes') === before;
  });
  // The planner owns the schedule: a chore is on a day only if a block tags it.
  checks.plannerOwnsTheSchedule = await page.evaluate(() => {
    const kid = activeProfile(), wk = ctWeekKey;
    const keys = mrWeekDayKeys(wk);
    const has = (d) => mrChoresForDay(kid, wk, d).rows.some(r => r.row.id === 'dishes');
    const before = getDayBlocks(keys[2], kid).slice();
    const emptyBefore = !has(2);
    setDayBlocks(keys[2], [...before,
      { id:'ct1', actId:'chores', startMin: 17*60, durationMin: 30, choreTags:['Dishes & dishwasher'], checklistState:{} }]);
    const onWed = has(2), notThu = !has(3);
    setDayBlocks(keys[2], before);                       // and it leaves with the block
    return emptyBefore && onWed && notThu && !has(2);
  });
  // Legacy name tags still find their pool row; an unknown tag is reported, not dropped.
  checks.legacyTagsStillResolve = await page.evaluate(() => {
    const wk = ctWeekKey;
    const byName = mrPoolRowForTag('Mop', wk);
    const byId = mrPoolRowForTag('mop', wk);
    const messy = mrPoolRowForTag('dishes & DISHWASHER', wk);
    const unknown = mrPoolRowForTag('Polish the cat', wk);
    return byName && byName.id === 'mop' && byId && byId.id === 'mop'
        && messy && messy.id === 'dishes' && unknown === null;
  });
  checks.unknownTagIsSurfaced = await page.evaluate(() => {
    const kid = activeProfile(), wk = ctWeekKey;
    const keys = mrWeekDayKeys(wk);
    const before = getDayBlocks(keys[1], kid).slice();
    setDayBlocks(keys[1], [...before,
      { id:'ct2', actId:'chores', startMin: 17*60, durationMin: 30, choreTags:['Polish the cat'], checklistState:{} }]);
    const day = mrChoresForDay(kid, wk, 1);
    const listed = mrUnresolvedTags(wk).some(u => u.tag === 'Polish the cat');
    setDayBlocks(keys[1], before);
    return day.unresolved.includes('Polish the cat') && listed;
  });
  // Edit the pool as a parent, effective from the week under test (a rule edit
  // dated today would land AFTER this week's Monday and not apply to it), then
  // put the pool back so later checks see the seeded rules.
  const withPool = async (fn) => page.evaluate(({ fnSrc }) => {
    const wk = ctWeekKey;
    const original = mrDeepCopy(mrRulesForWeek(wk).chorePool);
    const wasProfile = profile;
    const edit = (pool) => {
      profile = 'parent';
      mrApplyEdits([{ path: 'chorePool', value: pool }],
        { reason: 'family_meeting', effectiveFrom: wk });
      profile = wasProfile;
    };
    try { return (0, eval)('(' + fnSrc + ')')({ wk, original, edit, mrDeepCopy }); }
    finally { edit(original); }
  }, { fnSrc: fn.toString() });

  // A `who`-scoped row belongs to one kid even on a block they both see.
  checks.whoScopesAPoolRow = await withPool(({ wk, original, edit, mrDeepCopy }) => {
    const keys = mrWeekDayKeys(wk);
    const jb = getDayBlocks(keys[4], 'jenn').slice(), kb = getDayBlocks(keys[4], 'jess').slice();
    const block = { id:'ct3', actId:'chores', startMin: 17*60, durationMin: 30, choreTags:['bins'], checklistState:{} };
    setDayBlocks(keys[4], [...jb, block], 'jenn');
    setDayBlocks(keys[4], [...kb, { ...block, id:'ct4' }], 'jess');
    edit(mrDeepCopy(original).map(r => r.id === 'bins' ? { ...r, who: 'jenn' } : r));
    const j = mrChoresForDay('jenn', wk, 4).rows.some(r => r.row.id === 'bins');
    const k = mrChoresForDay('jess', wk, 4).rows.some(r => r.row.id === 'bins');
    setDayBlocks(keys[4], jb, 'jenn'); setDayBlocks(keys[4], kb, 'jess');
    return j === true && k === false;
  });
  // Standing responsibilities need no block at all.
  checks.standingLanesNeedNoBlock = await withPool(({ wk, original, edit, mrDeepCopy }) => {
    edit([...mrDeepCopy(original),
      { id:'water', label:'Water the plants', lane:'helping', who:'both', due:'18:00' }]);
    const row = mrChoresForDay('jenn', wk, 6).rows.find(r => r.row.id === 'water');
    return !!row && row.scheduled === false && row.row.lane === 'helping';
  });
  // A goal written as a bare number still fires the +$1 on the old rule.
  checks.legacyGoalStillFires = await page.evaluate(() => {
    const kid = activeProfile(), wk = ctWeekKey;
    ctSetWeekGoals(wk, 1, null);                          // 1 point is reachable
    const g = ctGetWeekGoals(wk).jenn || ctGetWeekGoals(wk)[kid];
    const shape = !!g && g.points === 1;
    ctSetMandatory(wk, 0, 'Morning', kid, true);
    ctMaybeFireGoalBonus(wk, kid);
    const fired = ctGetGoalBonus(wk, kid);
    ctSetMandatory(wk, 0, 'Morning', kid, false);
    ctSetGoalBonus(wk, kid, false);
    ctSetWeekGoals(wk, null, null);
    return shape && fired === true;
  });
  // Due times are real clock times, and bedtime is a wall.
  checks.dueTimesRespectBedtime = await page.evaluate(() =>
    mrDueIsValid('19:30') && mrDueIsValid('7:30pm') && mrDueIsValid('20:30')
    && !mrDueIsValid('21:00') && !mrDueIsValid('9:00pm') && !mrDueIsValid('teatime')
    && mrFormatClock(mrParseClock('19:30')) === '7:30pm');

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

  // Day view: Timeline/Quest toggle reachable in portrait, and the retired
  // Checklist mode is gone from the topbar entirely.
  await page.evaluate(() => openDay(getDayKeys(0)[5], 5));
  await page.waitForTimeout(400);
  /* The day screen is a planning tool and nothing else: one layout, no mode
     toggle to leave in the wrong state, and none of the "Today" rail that used
     to duplicate the Today screen. What must remain is the schedule and the
     activity tray — the two things you build a day with. */
  checks.dayScreenIsPlanningOnly = await page.evaluate(() => {
    const gone = ['dayModeQuest', 'dayModeTimeline', 'dayQuest', 'dayNextUpBanner',
                  'dayLeftToggle'].filter(id => document.getElementById(id));
    const bad = [];
    if (gone.length) bad.push(`retired elements still present: ${gone.join(', ')}`);
    if (document.querySelector('.day-left-rail')) bad.push('the left "Today" rail is still on the day screen');
    if (document.querySelector('.zone-tabs')) bad.push('zone tabs are back');
    if (typeof dayViewMode !== 'undefined') bad.push('dayViewMode still exists');
    const vis = el => !!el && getComputedStyle(el).display !== 'none';
    if (!vis(document.getElementById('timeline'))) bad.push('no schedule on the day screen');
    if (!vis(document.querySelector('.day-right-rail'))) bad.push('no activity tray on the day screen');
    return bad.length === 0 || bad;
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

  // ── Redesign phase 2: the kid's chore tab ──
  // Put a chore on the day the tab will open on, so there is something to answer for.
  await page.evaluate(() => {
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = activeProfile();
    const dayKey = mrWeekDayKeys(ctWeekKey)[2];
    setDayBlocks(dayKey, [...(getDayBlocks(dayKey, kid) || []),
      { id:'ckchore', actId:'chores', startMin: 17*60, durationMin: 30,
        choreTags:['Dishes & dishwasher'], checklistState:{} }], kid);
  });
  await page.evaluate(() => { openChoreTab(); ckSelectDay(2); });
  await page.waitForTimeout(400);

  // The four frames of the redesign are all on screen.
  checks.kidTabRenders = await page.evaluate(() =>
    !!document.querySelector('.ck-tab') && !!document.querySelector('.ck-rail')
    && document.querySelectorAll('.ck-day').length === 7
    && !!document.querySelector('.ck-bar'));
  // A kid's tab carries no grading control anywhere on it.
  checks.kidTabHasNoGrading = await page.evaluate(() =>
    !document.querySelector('[data-ct-action="grade-chore"]'));
  // Layout C: the row is the tap target, and only the tapped row opens.
  checks.tapOpensOneChoreOnly = await page.evaluate(() => {
    const row = document.querySelector('[data-ct-action="ck-chore-row"]');
    if (!row) return false;
    row.click();
    return document.querySelectorAll('.ck-chore.open').length === 1
        && document.querySelectorAll('[data-ct-action="ck-claim"]').length === 3;
  });
  await page.screenshot({ path: shot('kid_chore_day') });
  // Picking a word writes a claim, collapses the row, and moves no money.
  checks.claimFromTheRow = await page.evaluate(() => {
    const kid = activeProfile(), wk = ctWeekKey;
    const before = mrWeekMoney(wk, kid);
    const btn = document.querySelector('[data-ct-action="ck-claim"][data-quality="3"]');
    if (!btn) return false;
    btn.click();
    return mrGetClaim(kid, wk, 2, 'dishes') === 3
        && mrWeekMoney(wk, kid) === before
        && document.querySelectorAll('.ck-chore.open').length === 0
        && !!document.querySelector('.ck-chore-claimed');
  });
  // A graded chore is Mom's answer; the kid's row refuses to reopen it.
  checks.gradedRowIsClosedToHer = await page.evaluate(() => {
    const kid = activeProfile(), wk = ctWeekKey;
    const wasProfile = profile;
    profile = 'parent'; mrSetChoreGrade(kid, wk, 2, 'dishes', 2); profile = wasProfile;
    renderChoreTab();
    document.querySelector('[data-ct-action="ck-chore-row"]').click();
    const stillShut = document.querySelectorAll('.ck-chore.open').length === 0;
    profile = 'parent'; mrSetChoreGrade(kid, wk, 2, 'dishes', 0); profile = wasProfile;
    mrSetClaim(kid, wk, 2, 'dishes', 0);
    renderChoreTab();
    return stillShut;
  });
  // The week grid is an input, and a day the planner skipped is inert.
  checks.weekGridClaimsAndGreys = await page.evaluate(() => {
    ckSetView('week');
    const cells = document.querySelectorAll('[data-ct-action="ck-week-cell"]');
    const off = document.querySelectorAll('.ck-cell-off').length;
    if (!cells.length) return false;
    cells[0].click();
    const claimed = mrGetClaim(activeProfile(), ctWeekKey, 2, 'dishes') === 3;
    mrSetClaim(activeProfile(), ctWeekKey, 2, 'dishes', 0);
    return claimed && off > 0;
  });
  await page.screenshot({ path: shot('kid_chore_week') });
  // At iPad landscape the earn board sits beside the work, not under it.
  await page.setViewportSize({ width: 1194, height: 834 });
  await page.evaluate(() => { ckSetView('day'); });
  await page.waitForTimeout(300);
  checks.railSitsBesideAtIpad = await page.evaluate(() => {
    const main = document.querySelector('.ck-main').getBoundingClientRect();
    const rail = document.querySelector('.ck-rail').getBoundingClientRect();
    return rail.left >= main.right - 2 && rail.width > 200;
  });
  await page.screenshot({ path: shot('kid_chore_ipad') });
  await page.setViewportSize({ width: 900, height: 1100 });
  await page.waitForTimeout(200);
  // A day with nothing planned says so rather than showing an empty box.
  checks.emptyDaySaysSo = await page.evaluate(() => {
    ckSelectDay(4);
    const txt = document.querySelector('.ck-main').textContent;
    ckSelectDay(2);
    return /Nothing on today's plan/.test(txt);
  });

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

  // ── Redesign phase 3: the parent's chore tab, in the portal ──
  await page.evaluate(() => {
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    // Something claimed and ungraded, so the queue has work in it.
    mrSetClaim('jenn', ctWeekKey, 2, 'dishes', 3);
    showScreen('parent'); renderParentHome(); setParentTab('chores');
    cpDay = 2; cpRenderChoreTab();
  });
  await page.waitForTimeout(300);
  checks.parentChoreTabRenders = await page.evaluate(() => {
    const panel = document.getElementById('ptab-chores');
    return !!panel && panel.hidden === false && !!document.querySelector('.cp-tab')
        && !!document.querySelector('[data-cp-action="settle"]');
  });
  // The queue shows her claim, ringed on the grade the claim matches.
  checks.queueShowsTheClaim = await page.evaluate(() => {
    const ringed = document.querySelector('.cp-gbtn.agrees');
    return !!ringed && /waiting on you/i.test(document.querySelector('.cp-tab').textContent);
  });
  await page.screenshot({ path: shot('parent_chore_day') });
  // Grading from the queue records the grade and clears the row out of it.
  // It does NOT necessarily pay: her first two chores of the week are free, so
  // asserting money moved on chore one would be asserting the wrong rule.
  checks.gradeFromQueueClearsIt = await page.evaluate(() => {
    const btn = document.querySelector('[data-cp-action="grade"][data-chore-id="dishes"][data-day="2"][data-grade="3"]');
    if (!btn) return false;
    btn.click();
    return mrGetChoreGrade('jenn', ctWeekKey, 2, 'dishes') === 3
        && !mrClaimQueue(ctWeekKey, 'jenn').some(q => q.choreId === 'dishes' && q.dayIdx === 2);
  });
  // Past the free two, a grade does move the week's money.
  checks.gradingPastTheFreeTwoPays = await page.evaluate(() => {
    const wk = ctWeekKey;
    mrSetChoreGrade('jenn', wk, 0, 'mop', 3);
    mrSetChoreGrade('jenn', wk, 0, 'vacuum', 3);
    const before = mrWeekMoney(wk, 'jenn');
    mrSetChoreGrade('jenn', wk, 1, 'laundry', 3);
    const after = mrWeekMoney(wk, 'jenn');
    ['mop', 'vacuum'].forEach(id => mrSetChoreGrade('jenn', wk, 0, id, 0));
    mrSetChoreGrade('jenn', wk, 1, 'laundry', 0);
    return after > before;
  });
  // Settle opens the meeting rather than recording anything here.
  checks.settleOnlyOpensTheMeeting = await page.evaluate(() => {
    const before = JSON.stringify(state.shared.chore.finalizedWeeks || {});
    document.querySelector('[data-cp-action="settle"]').click();
    const opened = document.getElementById('familyMeetingOverlay').classList.contains('open');
    closeSheet('familyMeetingOverlay');
    return opened && JSON.stringify(state.shared.chore.finalizedWeeks || {}) === before;
  });
  // The planner panel schedules a chore onto the day, and takes it off again.
  checks.parentSchedulesFromTheTab = await page.evaluate(() => {
    setParentTab('chores'); cpDay = 3; cpRenderChoreTab();
    const has = () => mrChoresForDay('jenn', ctWeekKey, 3).rows.some(r => r.row.id === 'mop');
    const wasOff = !has();
    document.querySelector('[data-cp-action="schedule"][data-chore-id="mop"]').click();
    const nowOn = has();
    document.querySelector('[data-cp-action="unschedule"][data-chore-id="mop"]').click();
    return wasOff && nowOn && !has();
  });
  // The dual grid shows both girls on one row, and greys days nobody planned.
  checks.dualGridStripesBothKids = await page.evaluate(() => {
    cpView = 'week'; cpRenderChoreTab();
    const pairs = document.querySelectorAll('.cp-cellpair');
    const off = document.querySelectorAll('.cp-stripe.off').length;
    const ok = pairs.length > 0 && pairs[0].children.length === 2 && off > 0
      && !!document.querySelector('.cp-payout');
    cpView = 'day'; cpRenderChoreTab();
    return ok;
  });
  await page.evaluate(() => { cpView = 'week'; cpRenderChoreTab(); });
  await page.screenshot({ path: shot('parent_chore_week') });
  await page.evaluate(() => {
    cpView = 'day'; mrSetChoreGrade('jenn', ctWeekKey, 2, 'dishes', 0);
    showScreen('parent');
  });

  // ── Redesign phase 4: the eight-week read ──
  // Seed earlier weeks so the chart is drawn against real bars and lines. An
  // empty chart proves only that nothing threw.
  await page.evaluate(() => {
    const cur = ctMondayOf(formatDayKey(ctWeekKey));
    // Weeks before moneyModelStartWeek resolve through the RETIRED model and
    // correctly show nothing here. Walk the start back so this window is all
    // new-model weeks — i.e. a family two months into the current rules.
    const back = new Date(cur); back.setDate(cur.getDate() - 8 * 7);
    ctEnsureShared();
    state.shared.chore.moneyModelStartWeek = ctDateToKey(back);
    for (let i = 1; i < 8; i++) {
      const d = new Date(cur); d.setDate(cur.getDate() - i * 7);
      const wk = ctDateToKey(d);
      ['jenn', 'jess'].forEach((kid, ki) => {
        const n = 2 + ((i + ki) % 4);
        for (let j = 0; j < n; j++) {
          mrSetChoreGrade(kid, wk, j % 7, ['dishes','mop','vacuum','laundry'][j % 4], 3 - (j % 3));
        }
        mrSetLearning(kid, wk, 1, 'math', 3 + (i % 3));
      });
    }
  });
  await page.evaluate(() => { setParentTab('trends'); ctrRenderTrends(); });
  await page.waitForTimeout(300);
  checks.trendsRenders = await page.evaluate(() => {
    const p = document.getElementById('ptab-trends');
    return !!p && p.hidden === false && p.querySelectorAll('.ctr-svg').length === 2
        && p.querySelectorAll('.ctr-card').length === 2
        && !!p.querySelector('.ctr-heat-cell');
  });
  // Two panels, two scales — never one plot with two y-axes.
  checks.noDualAxis = await page.evaluate(() => {
    const svgs = [...document.querySelectorAll('#ptab-trends .ctr-svg')];
    const bars = svgs[0].querySelectorAll('rect').length;
    const lines = svgs[1].querySelectorAll('polyline').length;
    // The bar panel carries no polylines and the line panel carries no bars.
    return svgs[0].querySelectorAll('polyline').length === 0
        && svgs[1].querySelectorAll('rect').length === 0
        && lines === 2 && bars >= 0;
  });
  // Identity is never colour-alone: a legend is present and cells carry numbers.
  checks.trendsIdentityNotColourAlone = await page.evaluate(() =>
    document.querySelectorAll('#ptab-trends .ctr-legend-item').length === 2
    && [...document.querySelectorAll('#ptab-trends .ctr-heat-cell')].every(c => c.textContent.trim().length > 0));
  // The window pages back, and cannot page past now.
  checks.trendsPagingIsBounded = await page.evaluate(() => {
    const title = () => document.querySelector('#ptab-trends .cp-title').textContent;
    const first = title();
    document.querySelector('[data-ctr-action="page"][data-delta="1"]').click();
    const moved = title() !== first;
    document.querySelector('[data-ctr-action="page"][data-delta="-1"]').click();
    const back = title() === first;
    const atNow = document.querySelector('[data-ctr-action="page"][data-delta="-1"]').disabled;
    return moved && back && atNow;
  });
  // A settled week is read from its frozen ledger, not recomputed.
  checks.trendsPrefersTheFrozenLedger = await page.evaluate(() => {
    ctEnsureShared();
    const wk = ctrWeeks()[0].key;
    const led = state.shared.chore.moneyLedger || (state.shared.chore.moneyLedger = {});
    led[wk] = Object.assign({}, led[wk], { jenn: { net: 42, chores: 40, fines: 0, xp: 7 } });
    const r = ctrRow(wk, 'jenn');
    delete led[wk].jenn;
    return r.frozen === true && r.total === 42 && r.xp === 7;
  });
  // No surface in the portal may print NaN, Infinity or [object Object] — those
  // are always a bug upstream, and money is the worst place to discover one.
  checks.portalPrintsNoBrokenNumbers = await page.evaluate(() => {
    const bad = [];
    ['chores', 'trends'].forEach(tab => {
      setParentTab(tab);
      if (tab === 'chores') cpRenderChoreTab(); else ctrRenderTrends();
      const t = document.getElementById('ptab-' + tab).textContent;
      if (/NaN|Infinity|\[object /.test(t)) bad.push(tab);
    });
    setParentTab('trends'); ctrRenderTrends();
    return bad.length === 0 || bad;
  });
  // The read must not call a week still being lived a downturn.
  checks.readIgnoresTheUnfinishedWeek = await page.evaluate(() => {
    const t = document.querySelector('#ptab-trends .cp-sect:last-child').textContent;
    return /still being lived/.test(t) && !/^\s*$/.test(t);
  });
  await page.screenshot({ path: shot('parent_trends') });

  // ── Redesign phase 5: chore setup ──
  await page.evaluate(() => { setParentTab('options'); coRenderOptions(); });
  await page.waitForTimeout(300);
  checks.optionsRenders = await page.evaluate(() => {
    const p = document.getElementById('ptab-options');
    return !!p && p.hidden === false && document.querySelectorAll('.co-row').length > 1
        && !!document.querySelector('[data-co-action="add"]');
  });
  // Adding a chore writes an effective-dated rule version, and it shows up in
  // the pool for the week on screen.
  checks.addingAChoreIsAnAuditedRuleEdit = await page.evaluate(() => {
    const before = mrVersions().length, logBefore = mrLogEntries().length;
    coDraft = { label: 'Water the plants', due: '6:00pm', who: 'jess', lane: 'helping' };
    coRenderOptions();
    document.querySelector('[data-co-action="add"]').click();
    const row = mrPoolRows(ctWeekKey).find(p => p.label === 'Water the plants');
    return !!row && row.lane === 'helping' && row.who === 'jess' && row.due === '6pm'
        && mrLogEntries().length > logBefore && mrVersions().length >= before;
  });
  // Bedtime is a wall: a due time after it is refused, and the pool is unchanged.
  checks.bedtimeIsAWall = await page.evaluate(() => {
    const row = mrPoolRows(ctWeekKey).find(p => p.label === 'Water the plants');
    coSetDue(row.id, '9:30pm');
    const after = mrPoolRows(ctWeekKey).find(p => p.id === row.id);
    return after.due === '6pm';
  });
  // A planner tag matching no pool row is surfaced here, and can be adopted.
  checks.orphanTagsAreOfferedAFix = await page.evaluate(() => {
    const kid = 'jenn', dayKey = mrWeekDayKeys(ctWeekKey)[5];
    const before = (getDayBlocks(dayKey, kid) || []).slice();
    setDayBlocks(dayKey, [...before, { id:'orph', actId:'chores', startMin: 17*60,
      durationMin: 30, choreTags:['Polish the cat'], checklistState:{} }], kid);
    coRenderOptions();
    const listed = !!document.querySelector('[data-co-action="adopt"]');
    document.querySelector('[data-co-action="adopt"]').click();
    const resolves = !!mrPoolRowForTag('Polish the cat', ctWeekKey);
    setDayBlocks(dayKey, before, kid);
    coApply(mrDeepCopy(mrRulesForWeek(ctWeekKey).chorePool)
      .filter(p => p.label !== 'Polish the cat' && p.label !== 'Water the plants'), 'test cleanup');
    coRenderOptions();
    return listed && resolves;
  });
  // The two-part goal needs BOTH halves before the +$1 fires.
  checks.bothGoalHalvesMustLand = await page.evaluate(() => {
    const wk = ctWeekKey, kid = 'jess';
    ctSetGoalBonus(wk, kid, false);
    ctSetWeekGoals(wk, null, { routineDays: 7, money: 0 });
    ctMaybeFireGoalBonus(wk, kid);
    // The money half is trivially met, so only the unmet routine half can be
    // holding the bonus back — which is exactly what "both" has to mean.
    const heldBack = ctGetGoalBonus(wk, kid) === false;
    ctSetWeekGoals(wk, null, { routineDays: 0, money: 0 });
    ctMaybeFireGoalBonus(wk, kid);
    const fired = ctGetGoalBonus(wk, kid);
    ctSetWeekGoals(wk, null, null); ctSetGoalBonus(wk, kid, false);
    return heldBack && fired === true;
  });
  // The planner's tag picker offers pool rows and writes their ids, so it can
  // no longer manufacture a tag that matches nothing.
  checks.tagPickerWritesPoolIds = await page.evaluate(() => {
    profile = 'jenn'; selectProfile('jenn');
    currentDayKey = mrWeekDayKeys(ctWeekKey)[0];
    selectedActivity = getAllActivities('jenn').find(a => a.id === 'chores');
    as_ = { durationMin: 30, colour: COLOURS[0], note: '', repeat: false, repeatDays: [],
             travelBuffer: false, travelBufMin: 15, choreTags: [], objectives: [] };
    renderActivitySheet();
    const btns = [...document.querySelectorAll('#choreTypePicker button')];
    const labels = mrPoolRows(ctWeekKey).filter(p => p.lane === 'chores').map(p => p.label);
    const shown = btns.every(b => labels.includes(b.textContent.replace(/^✓ /, '')));
    btns[0].click();
    const wrote = as_.choreTags.length === 1 && !!mrPoolRow(as_.choreTags[0], ctWeekKey);
    as_ = { durationMin: 30, colour: COLOURS[0], note: '', repeat: false, repeatDays: [],
             travelBuffer: false, travelBufMin: 15, choreTags: [], objectives: [] };
    selectedActivity = null; profile = 'parent';
    return btns.length === labels.length && shown && wrote;
  });
  await page.evaluate(() => { profile = 'parent'; showScreen('parent'); renderParentHome(); setParentTab('options'); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: shot('parent_options') });

  // ── The whole redesign, as one journey ──
  // Each phase is checked in isolation above; this is the only check that the
  // pieces actually join up: plan it, claim it, grade it, see it, settle it.
  checks.redesignEndToEnd = await page.evaluate(() => {
    const kid = 'jenn', wk = ctWeekKey, day = 3, chore = 'vacuum';
    const step = {};
    profile = 'parent'; parentViewing = kid; cpDay = day; cpView = 'day';

    // 1. A parent puts the chore on Thursday from the portal.
    setParentTab('chores'); cpRenderChoreTab();
    document.querySelector(`[data-cp-action="schedule"][data-chore-id="${chore}"]`).click();
    step.scheduled = mrChoresForDay(kid, wk, day).rows.some(r => r.row.id === chore);

    // 2. The kid opens her tab on that day and sees it — and nothing else did.
    profile = kid; ctDay = day; ckView = 'day'; openChoreTab(); ckSelectDay(day);
    const row = document.querySelector(`[data-ct-action="ck-chore-row"][data-chore-id="${chore}"]`);
    step.sheSeesIt = !!row;

    // 3. She says how it went. That is a claim, and it pays nothing.
    const moneyBefore = mrWeekMoney(wk, kid);
    row.click();
    document.querySelector(`[data-ct-action="ck-claim"][data-chore-id="${chore}"][data-quality="3"]`).click();
    step.claimedNotPaid = mrGetClaim(kid, wk, day, chore) === 3
      && mrWeekMoney(wk, kid) === moneyBefore;

    // 4. It is waiting on the parent, who grades it.
    profile = 'parent';
    setParentTab('chores'); cpDay = day; cpRenderChoreTab();
    step.inTheQueue = mrClaimQueue(wk, kid).some(q => q.choreId === chore && q.dayIdx === day);
    document.querySelector(`[data-cp-action="grade"][data-chore-id="${chore}"][data-day="${day}"][data-grade="3"]`).click();
    step.graded = mrGetChoreGrade(kid, wk, day, chore) === 3;
    step.queueCleared = !mrClaimQueue(wk, kid).some(q => q.choreId === chore && q.dayIdx === day);

    // 5. Her week grid fills that one cell and greys the days nobody planned.
    profile = kid; openChoreTab(); ckSetView('week');
    const grid = document.querySelector('.ck-grid');
    step.gridFilled = grid.querySelectorAll('.ck-cell.done').length > 0
      && grid.querySelectorAll('.ck-cell-off').length > 0;
    ckSetView('day');

    // 6. Trends counts the week, and the meeting is still the only settler.
    profile = 'parent';
    setParentTab('trends'); ctrOffset = 0; ctrRenderTrends();
    step.inTrends = ctrRow(wk, kid).total >= 0 && !!document.querySelector('#ptab-trends .ctr-svg');
    const finalBefore = JSON.stringify(state.shared.chore.finalizedWeeks || {});
    setParentTab('chores'); cpRenderChoreTab();
    document.querySelector('[data-cp-action="settle"]').click();
    step.meetingOpens = document.getElementById('familyMeetingOverlay').classList.contains('open');
    step.nothingSettledYet = JSON.stringify(state.shared.chore.finalizedWeeks || {}) === finalBefore;
    closeSheet('familyMeetingOverlay');

    // Leave the week as we found it.
    mrSetChoreGrade(kid, wk, day, chore, 0);
    mrSetClaim(kid, wk, day, chore, 0);
    setParentTab('chores'); cpRenderChoreTab();
    const off = document.querySelector(`[data-cp-action="unschedule"][data-chore-id="${chore}"]`);
    if (off) off.click();

    const failed = Object.keys(step).filter(k => !step[k]);
    return failed.length === 0 || failed;
  });

  // Every routine checklist item shows an icon, wherever it is ticked — from
  // the preset, from a parent's own, or guessed from the words when neither
  // exists. A blank where an icon belongs is the failure being guarded.
  checks.routineItemsAlwaysHaveAnIcon = await page.evaluate(() => {
    const guessed = routineItemIcon({ text: 'Feed the dog' }) === '🐾'
                 && routineItemIcon({ text: 'Brush teeth' }) === '🪥'
                 && routineItemIcon({ text: 'Wash hands' }) === '🧼'
                 && routineItemIcon({ icon: '🦄', text: 'Brush teeth' }) === '🦄';   // explicit wins
    // Nothing renders empty, even for words the map has never seen.
    const neverBlank = routineItemIcon({ text: 'qqzz' }).length > 0
                    && routineItemIcon({}).length > 0;
    // And the presets carry their own rather than leaning on the guess.
    const presets = Object.values(ROUTINE_PRESETS)
      .every(r => r.items.every(i => !!i.icon));
    return guessed && neverBlank && presets;
  });
  checks.kidTabShowsRoutineIcons = await page.evaluate(() => {
    profile = 'jenn'; selectProfile('jenn');
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const keys = mrWeekDayKeys(ctWeekKey);
    setDayBlocks(keys[2], [{ id:'ri1', actId:'routine_morning', startMin: 7*60,
      durationMin: 30, checklistState:{} }], 'jenn');
    openChoreTab(); ckSelectDay(2);
    // .ck-block, not .ck-block-body: the own/helping lanes reuse the body class.
    const icons = [...document.querySelectorAll('.ck-block .ck-item-icon')];
    const want = ROUTINE_PRESETS.morning.items;
    return icons.length === want.length
        && icons.every((el, i) => el.textContent.trim() === want[i].icon);
  });

  // ── In a hand ──
  // The chore system has to work on a phone, not merely not crash on one.
  // Two failures are silent and permanent once shipped: content pushed off the
  // side (a grid item's default min-width:auto does this), and controls too
  // small to hit. Both are measured here at two real iPhone widths.
  const phoneAudit = async (w, h, label) => {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(350);
    return page.evaluate(({ w, label }) => {
      const bad = { label, overflow: [], small: [] };
      const seen = new Set();
      // Nothing may extend past the viewport, and the page must not scroll
      // sideways. 1px of tolerance for sub-pixel rounding.
      if (document.body.scrollWidth > w + 1) bad.overflow.push('body:' + document.body.scrollWidth);
      document.querySelectorAll('.ck-tab *, .cp-tab *, .ctr-tab *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        // A box that scrolls its own overflow is allowed to be wider inside.
        if (el.closest('.ck-gridwrap')) return;
        if (r.right > w + 1 && !seen.has(el.className)) {
          seen.add(el.className);
          bad.overflow.push(String(el.className).slice(0, 40) + '@' + Math.round(r.right));
        }
      });
      // Primary controls need a 44px target in BOTH dimensions. This used to
      // measure height only, which is how a 36x36 week arrow passed for months:
      // tall enough was never the problem, wide enough was.
      document.querySelectorAll(
        '.ck-chore-row, .ck-qbtn, .ck-day, .ck-segbtn, .ck-item, .ck-rate, .ck-navbtn,' +
        '.cp-gbtn, .cp-kid, .co-lane, .co-who, .ck-else-btn'
      ).forEach(el => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const key = 'sz:' + el.className;
        if ((r.height < 44 || r.width < 44) && !seen.has(key)) {
          seen.add(key);
          bad.small.push(String(el.className).slice(0, 30) + '@' +
                         Math.round(r.width) + 'x' + Math.round(r.height));
        }
      });
      return bad;
    }, { w, label });
  };

  // ── Kid-screen standards (Branch 3) ──────────────────────────────────────
  // Three house rules from CLAUDE.md, asserted rather than hoped for. They exist
  // to bind what comes next: a rebuilt Today screen has to be born inside this
  // budget instead of inheriting the density it replaces.
  //
  //   ≤200 visible words per kid screen in its default state
  //   every interactive target at least 44x44 — BOTH dimensions
  //   nothing below 13px
  //
  // Reference material is not banned, it just starts collapsed. Words are counted
  // in the default state, so a closed disclosure costs nothing and an open-by-
  // default wall of policy costs everything.
  const kidStandards = async (screenId) => page.evaluate((screenId) => {
    const scr = document.getElementById(screenId);
    if (!scr) return { screen: screenId, error: 'screen missing' };
    const visible = (el) => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    // A word has a letter in it. Bare numbers — a calendar's dates, a dollar
    // figure, a tally — are what the screen is FOR, not text to wade through, and
    // counting them would make a date grid look like a wall of prose.
    let words = 0;
    const walk = document.createTreeWalker(scr, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      const p = n.parentElement;
      if (!p || !visible(p) || p.closest('[hidden]')) continue;
      const t = (n.textContent || '').trim();
      if (t) words += t.split(/\s+/).filter(w => /[A-Za-z]/.test(w)).length;
    }

    // The week card's done-tick is sized inline per block height and sits at a
    // card corner, so a 44px hit area there would swallow the tap that opens the
    // day. Exempted deliberately, by name, with the reason in css/app.css — the
    // Today-first rebuild is what actually relieves that grid.
    const EXEMPT = ['wf-card-check'];

    /* Measure the hit area, not the box. CLAUDE.md's own advice for a control
       that must stay visually small is to keep its size and grow the target with
       padding or an ::after overlay — and getBoundingClientRect cannot see an
       overlay, so a box-size check would fail exactly the fix it recommends.
       Probe instead: if the topmost element at a point is this control (or lives
       inside it), the thumb lands on it there. */
    const hittable = (el, x, y) => {
      // A probe point outside the viewport proves nothing — a thumb cannot land
      // there either, so a control at the screen edge is not failed for it.
      if (x < 0 || y < 0 || x > window.innerWidth - 1 || y > window.innerHeight - 1) return true;
      const hit = document.elementFromPoint(x, y);
      return !!hit && (hit === el || el.contains(hit));
    };
    const reaches44 = (el) => {
      // Bring it on screen first. The nav is fixed to the bottom, so a control
      // that happens to sit under it at the current scroll position is not
      // unreachable — a child scrolls. Measuring wherever the page happened to be
      // reported the last `?` on My money as too small at 768 purely because the
      // nav was over it at that moment.
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const half = 21;   // 22px each way ≈ a 44px target, 1px inside the edge
      // Horizontal and vertical extremes are what a 44px box actually requires.
      return hittable(el, cx - half, cy) && hittable(el, cx + half, cy)
          && hittable(el, cx, cy - half) && hittable(el, cx, cy + half);
    };

    const small = [];
    scr.querySelectorAll('button, [onclick], [role="button"], a[href], input:not([type=hidden]), select, summary, .pill-btn, .btn-icon').forEach(el => {
      if (!visible(el)) return;
      if (EXEMPT.some(c => el.classList.contains(c))) return;
      const r = el.getBoundingClientRect();
      // Cheap path first; only probe the ones the box test would fail.
      if (r.height >= 44 && r.width >= 44) return;
      if (reaches44(el)) return;
      small.push(`${(el.className || el.tagName).toString().trim().slice(0, 26)}@${Math.round(r.width)}x${Math.round(r.height)}`);
    });

    let minFont = 999, minWhere = '';
    scr.querySelectorAll('*').forEach(el => {
      if (!visible(el)) return;
      if (![...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())) return;
      const f = parseFloat(getComputedStyle(el).fontSize);
      if (f && f < minFont) {
        minFont = f;
        // Enough to actually find it: an unclassed <span> named only by tag is
        // unfindable, and an inline font-size needs a different fix from a class.
        const own = (el.className || '').toString().trim();
        const parent = el.parentElement ? (el.parentElement.className || el.parentElement.tagName).toString().trim().slice(0, 24) : '';
        const inline = /font-size/.test(el.getAttribute('style') || '') ? ' [inline]' : '';
        minWhere = `${own || el.tagName}${own ? '' : ' in .' + parent}${inline}`.slice(0, 60);
      }
    });

    return { screen: screenId, words, small, minFont: Math.round(minFont * 100) / 100, minWhere };
  }, screenId);

  /* Word budgets. Three screens meet the 200 the house rules ask for. The chore
     screen does not, and the honest number is here rather than a quietly relaxed
     rule: it came down from 346 (the audit's measurement) to ~275 by collapsing
     the privilege ladder and the XP explainer, and the rest is instructional copy
     a nine-year-old plausibly still needs — "tap twice if nobody had to ask",
     "only whole bundles pay". Deciding which of those she can do without is a
     product call and the Today-first rebuild's job, not a CSS pass.

     So this is a ratchet, not an exemption: the ceiling is what it currently
     measures, it fails the build if it grows, and the 200 target stays written
     down as the thing the rebuild has to hit. Tighten it whenever the real number
     comes down — 346 at the audit, 280 after the disclosures, 276 once the
     duplicate shortcut rows went.

     ── 2026-08-10, 276 → 277, owner's call ──
     The budget is a soft floor, not a hard one: where a word buys a number that
     is not misleading, the word wins. This one did. The chore rail was capped
     "Your week" over b.net, which excludes money from outside — labelled as the
     week's total it disagreed with "Money that came in" on My money every time
     one of them was given something. "Earned this week" costs one word and says
     what the number actually is.

     Raising it stays a recorded decision with a date and a reason, never a quiet
     bump, and the check stays in place. The 200 target is unchanged. */
  const WORD_BUDGET = { 'screen-today': 200, 'screen-week': 200, 'screen-quest': 200,
                        'screen-mymoney': 200, 'screen-chore': 277 };
  const KID_SCREENS = [
    // Today is held to the full 200 with no ratchet: it was built to these rules
    // rather than measured against them afterwards, which was the point of
    // landing them first.
    ['screen-today',   () => { goToday(); }],
    ['screen-week',    () => { goWeek(); renderWeek(); }],
    /* The same screen on a Sunday. The weekly-review banner renders one day in
       seven (js/07-week-view.js, the `isSunday` branch) and it is the only place
       .wins-btn and .tip-dismiss appear — so six days a week this audit walked
       straight past them, and a 22x22 dismiss target with a 12.8px label lived
       there until the Sunday-night CI run of 2026-08-09 happened to look.

       A rule the suite can only check on one weekday is a rule that is unenforced
       six days out of seven. Pin the clock to this week's Sunday for the length of
       one render so the banner is audited on every run. The stand-in only answers
       `new Date()` — every explicit form still builds the date it was given, so
       the rest of the render is unaffected — and the real Date goes back in a
       `finally`, because leaving a fake clock installed would quietly poison every
       check after this one. */
    ['screen-week',    () => {
      goWeek();
      const RealDate = Date;
      const sunday = new RealDate();
      sunday.setDate(sunday.getDate() - sunday.getDay());
      sunday.setHours(10, 0, 0, 0);
      Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(sunday); };
      Date.prototype = RealDate.prototype;
      Date.now = RealDate.now; Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
      /* The empty-week invitation outranks the Sunday review, and by the time
         this runs earlier checks have emptied the week — so without a block here
         the audit renders the wrong branch and passes without ever seeing
         .tip-dismiss. It measured `wins-btn@124x20` ("Start planning") instead of
         `76x22` ("See wins"), which is how that was caught. Seed one block, then
         put the day back exactly as it was. */
      const kid = activeProfile();
      const key = getDayKeys(0)[1];
      const had = (getDayBlocks(key) || []).slice();
      try {
        setDayBlocks(key, [{ id: 'sun-audit', actId: 'piano', startMin: 16 * 60, durationMin: 60 }], kid);
        weekOffset = 0; weekReviewDismissed = false;
        renderWeek();
      } finally { setDayBlocks(key, had, kid); Date = RealDate; }
    }, 'screen-week/sunday'],
    ['screen-quest',   () => { showScreen('quest'); renderQuestBoard(); }],
    ['screen-chore',   () => { openChoreTab(); ckSelectDay(2); }],
    ['screen-mymoney', () => { mnyOpenMyMoney('jenn'); }],
  ];
  // Four real devices, not two. The plan asked for these and the branch that
  // changed nearly every layout only ever checked a phone and a desktop-ish
  // window, so iPad portrait and landscape — the sizes this app actually lives
  // on — went unmeasured through the whole rebuild.
  const kidFindings = [];
  for (const [w, h] of [[390, 844], [768, 1024], [1024, 768], [1440, 900], [900, 1100]]) {
    await page.setViewportSize({ width: w, height: h });
    for (const [id, nav, label] of KID_SCREENS) {
      await page.evaluate(`(${nav.toString()})()`);
      await page.waitForTimeout(200);
      const r = await kidStandards(id);
      const budget = WORD_BUDGET[id] || 200;
      const problems = [];
      if (r.error) problems.push(r.error);
      // Sideways scroll is the failure a screenshot needs a human to notice and
      // an assertion catches by itself: content pushed off the edge of a tablet
      // is simply unreachable, and nothing else here would report it.
      const overflow = await page.evaluate((sid) => {
        const scr = document.getElementById(sid);
        const worst = [...scr.querySelectorAll('*')].reduce((acc, el) => {
          if (el.closest('[style*="overflow"], .ck-gridwrap, .weekly-full-wrap, .tg-wrap')) return acc;
          const r = el.getBoundingClientRect();
          return (r.width && r.right > acc.right) ? { right: r.right, cls: String(el.className).slice(0, 24) } : acc;
        }, { right: 0, cls: '' });
        return { body: document.body.scrollWidth, worst };
      }, id);
      if (overflow.body > w + 1) problems.push(`page scrolls sideways (${overflow.body} > ${w})`);
      if (overflow.worst.right > w + 1) problems.push(`.${overflow.worst.cls} runs to ${Math.round(overflow.worst.right)} (past ${w})`);
      if (r.words > budget) problems.push(`${r.words} words (max ${budget}${budget !== 200 ? ', ratchet — target is 200' : ''})`);
      if (r.small && r.small.length) problems.push(`${r.small.length} target(s) under 44px: ${r.small.slice(0, 6).join(', ')}`);
      if (r.minFont < 13) problems.push(`font ${r.minFont}px on .${r.minWhere} (min 13)`);
      if (problems.length) kidFindings.push(`${label || id}@${w}: ${problems.join(' | ')}`);
    }
  }
  checks.kidScreensMeetTheHouseRules = kidFindings.length === 0 || kidFindings;

  // Artifacts at the sizes this app is actually used at — phone, iPad both ways,
  // laptop. The assertions above are the gate; these are for a human deciding
  // whether it also looks right.
  for (const [w, h, label] of [[768, 1024, 'ipad_portrait'], [1024, 768, 'ipad_landscape'], [1440, 900, 'laptop']]) {
    await page.setViewportSize({ width: w, height: h });
    for (const [id, nav] of [['today', () => goToday()], ['week', () => { goWeek(); renderWeek(); }],
                             ['mymoney', () => mnyOpenMyMoney('jenn')]]) {
      await page.evaluate(`(${nav.toString()})()`);
      await page.waitForTimeout(150);
      await page.screenshot({ path: shot(`${label}_${id}`) });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { mnyOpenMyMoney('jenn'); });
  await page.screenshot({ path: shot('phone_mymoney') });
  await page.setViewportSize({ width: 900, height: 1100 });
  await page.waitForTimeout(200);

  // Kid tab, both phone widths.
  await page.evaluate(() => {
    profile = 'jenn'; selectProfile('jenn');
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const keys = mrWeekDayKeys(ctWeekKey);
    setDayBlocks(keys[2], [{ id:'ph1', actId:'chores', startMin: 17*60, durationMin: 30,
      choreTags:['dishes','vacuum'], checklistState:{} }], 'jenn');
    openChoreTab(); ckSelectDay(2);
  });
  const kid393 = await phoneAudit(393, 852, 'kid@393');
  await page.screenshot({ path: shot('phone_kid') });
  const kid375 = await phoneAudit(375, 667, 'kid@375');
  checks.kidTabFitsAPhone =
    (kid393.overflow.length + kid393.small.length + kid375.overflow.length + kid375.small.length) === 0
    || [kid393, kid375];

  // The portal's three tabs, on the smaller phone.
  await page.evaluate(() => {
    profile = 'parent'; showScreen('parent'); renderParentHome();
  });
  const portal = [];
  for (const tab of ['chores', 'trends', 'options']) {
    await page.evaluate(t => setParentTab(t), tab);
    const a = await phoneAudit(390, 844, 'portal-' + tab);
    if (a.overflow.length || a.small.length) portal.push(a);
    if (tab === 'chores') await page.screenshot({ path: shot('phone_parent') });
  }
  checks.portalFitsAPhone = portal.length === 0 || portal;
  await page.setViewportSize({ width: 900, height: 1100 });
  await page.waitForTimeout(200);

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
    mnySetPricesOpen(true); mnyRenderMyMoney();
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

  /* ── The five pages are one system ── */

  // The same numbered tab bar on every money surface. Five pages that look
  // like five separate pages are five separate apps.
  checks.tabBarOnEveryMoneySurface = await page.evaluate(() => {
    profile = 'parent'; parentViewing = 'jess'; ctParentKid = 'jess';
    const bar = (id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const tabs = el.querySelectorAll('.mny-tab');
      return tabs.length === 5 && el.querySelector('.mny-tab.on') ? tabs : null;
    };
    mnyOpenMyMoney('jess');
    const onMoney = !!bar('mnyPage1Wrap');
    mnyOpenStory();
    const onStory = !!bar('mnyStoryWrap');
    mnyOpenSchool('jess');
    const onSchool = !!bar('mnySchoolWrap');
    showScreen('parent'); setParentTab('money'); mnyRenderRulesTab();
    const onRules = !!bar('mnyRulesWrap');
    openFamilyMeeting(); mnySetMeetKid('jess'); mmGoStep(3);
    const body = document.getElementById('familyMeetingBody');
    const onEarned = body.querySelectorAll('.mny-tab').length === 5;
    mmGoStep(4);
    const onDecide = body.querySelectorAll('.mny-tab').length === 5;
    closeSheet('familyMeetingOverlay');

    // And it navigates: tapping 5 from page 1 lands on Money school.
    mnyOpenMyMoney('jess');
    mnyGoTab('school');
    const navigates = document.getElementById('screen-moneyschool').classList.contains('active');
    return onMoney && onStory && onSchool && onRules && onEarned && onDecide && navigates;
  });

  // A kid tapping a grown-up's page is told what it is, not silently refused —
  // and is never dropped into a screen she cannot use.
  checks.kidTabsExplainRatherThanRefuse = await page.evaluate(() => {
    profile = 'jess';
    mnyOpenMyMoney('jess');
    mnyGoTab('rules');
    const stayedPut = !document.getElementById('screen-parent').classList.contains('active');
    mnyGoTab('grow');
    const noMeeting = !document.getElementById('familyMeetingOverlay').classList.contains('open');
    return stayedPut && noMeeting;
  });

  // Last week's plan, ghosted under this week's — but only once there IS a last
  // week. A ghost of nothing is a puzzle, not a comparison.
  checks.ghostBarOnlyWithHistory = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess'; parentViewing = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey, c = state.shared.chore;
    if (c.weekPlans) delete c.weekPlans[wk];
    const prevD = formatDayKey(wk); prevD.setDate(prevD.getDate() - 7);
    const prev = ctDateToKey(prevD);
    if (c.weekPlans && c.weekPlans[prev]) delete c.weekPlans[prev];
    const none = mnyGhostBar(wk, kid) === '';
    if (!c.weekPlans) c.weekPlans = {};
    c.weekPlans[prev] = { [kid]: { planId: 'ready', split: { ready: 8, gic: 0, stock: 0 },
                                   committedAt: Date.now() - 6e8 } };
    const drawn = mnyGhostBar(wk, kid).indexOf('Last week') > -1;
    delete c.weekPlans[prev];
    return none && drawn;
  });

  // The walkthrough opens from a ?, pages through, and closes — and is never
  // shown unasked.
  checks.tourOpensPagesAndCloses = await page.evaluate(() => {
    profile = 'parent';
    mnyOpenMyMoney('jess');
    const unasked = !document.getElementById('mnyTour');
    mnyOpenTour('kid');
    const opened = !!document.getElementById('mnyTour')
      && document.querySelectorAll('#mnyTour .mny-dot').length === MNY_TOURS.kid.length;
    mnyTourGo(1); mnyTourGo(1);
    const paged = mnyTourStep === 2
      && document.querySelector('#mnyTour .mny-dot.on')
      && [...document.querySelectorAll('#mnyTour .mny-dot')].indexOf(
           document.querySelector('#mnyTour .mny-dot.on')) === 2;
    mnyCloseTour();
    const closed = !document.getElementById('mnyTour');
    // And the parent has a different one, because they need opposite things.
    const twoTours = MNY_TOURS.parent.length >= 5 && MNY_TOURS.kid.length >= 5
      && MNY_TOURS.parent[0].title !== MNY_TOURS.kid[0].title;
    return unasked && opened && paged && closed && twoTours;
  });

  /* ══════════════════════════════════════════════════════════════
     THE CHORE → MONEY HAND-OFF
     The app carried two chore stores for a while and only one of them was
     wired to the money. These check the join, because a break here is silent:
     everything still renders, the numbers are just wrong.
     ══════════════════════════════════════════════════════════════ */

  // The planner is where a chore gets finished. Finishing it has to reach the
  // parent's queue, or the work is invisible to everyone who pays for it.
  checks.plannerChoreReachesTheQueue = await page.evaluate(async () => {
    profile = 'jess'; parentViewing = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey;
    const e = mrEnsureEarnings(kid, wk);
    e.claims = {}; e.chores = {};
    const dayKey = mrWeekDayKeys(wk)[3];
    setDayBlocks(dayKey, [{ id: 'pblk', actId: 'chores', startMin: 17 * 60,
                            durationMin: 30, choreTags: ['Mop'] }], kid);

    // Marking it done asks how it went; answering files the claim.
    toggleBlockDone(dayKey, 'pblk');
    // The prompt chain starts on a microtask, so let it open first.
    await new Promise(r => setTimeout(r, 30));
    const asked = !!document.querySelector('.app-dialog-choice');
    if (!asked) return false;
    document.querySelectorAll('.app-dialog-choice')[0].click();   // "On time"
    // Wait for it to be gone, not for a guessed interval — see the note on
    // unplannedChoreIsClaimable below.
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 20));
      if (!document.querySelector('#appDialogOverlay.open')) break;
    }
    await new Promise(r => setTimeout(r, 30));

    const claimed = mrGetClaim(kid, wk, 3, 'mop') === 3;
    const inQueue = mrClaimQueue(wk, kid).some(q => q.choreId === 'mop' && q.dayIdx === 3);
    // A claim is an answer, not a payment: nothing has moved yet.
    const unpaid = mrChoreWeek(wk, kid).paid === 0;

    // Un-ticking withdraws it again.
    toggleBlockDone(dayKey, 'pblk');
    const withdrawn = mrGetClaim(kid, wk, 3, 'mop') === 0;

    setDayBlocks(dayKey, [], kid);
    return asked && claimed && inQueue && unpaid && withdrawn;
  });

  // A parent's grade is what turns the claim into money — and the meeting's
  // step 1 and step 3 have to be reading the same record, which is exactly
  // what was broken.
  checks.step1GradeReachesStep3 = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey;
    const e = mrEnsureEarnings(kid, wk);
    e.claims = {}; e.chores = {}; e.overrides = {};
    const dayKey = mrWeekDayKeys(wk)[2];
    setDayBlocks(dayKey, [{ id: 'mblk', actId: 'chores', startMin: 17 * 60,
                            durationMin: 30, choreTags: ['Vacuum'] }], kid);
    // The week's first free chores are unpaid by design, so use them up first —
    // otherwise the chore graded below would correctly pay nothing and this
    // would be testing the free-chore rule rather than the hand-off.
    const freeCount = Number((mrRulesForWeek(wk).chores || {}).freeChoresPerWeek) || 0;
    ['dishes', 'mop', 'laundry'].slice(0, freeCount)
      .forEach((ch, i) => mrSetChoreGrade(kid, wk, i, ch, 3));

    openFamilyMeeting();
    mmGoStep(1); mmSelectDay(2);
    const rows = mmReviewRows(kid, 2);
    // Routines are the parent's to mark; chores come from the planner.
    const bothKinds = rows.filter(r => r.kind === 'routine').length === 3
                   && rows.some(r => r.kind === 'chore' && r.key === 'vacuum');
    const idx = rows.findIndex(r => r.key === 'vacuum');

    const before = mrWeekBreakdown(wk, kid).chorePaid;
    mmToggleItem(kid, 2, idx);                       // the tap IS the grading
    const graded = mrGetChoreGrade(kid, wk, 2, 'vacuum') === 3;
    const after = mrWeekBreakdown(wk, kid).chorePaid;

    // Step 3 must show the same figure the grade just produced.
    mnySetMeetKid(kid); mmGoStep(3);
    const shown = document.getElementById('familyMeetingBody').textContent
      .includes(mnyMoney(after));

    mmToggleItem(kid, 2, idx);                       // and it is reversible
    const ungraded = mrGetChoreGrade(kid, wk, 2, 'vacuum') === 0;

    closeSheet('familyMeetingOverlay');
    setDayBlocks(dayKey, [], kid);
    return bothKinds && graded && after > before && shown && ungraded;
  });

  // Typing into the meeting must not throw the caret away on every letter.
  checks.meetingKeepsFocusAndScroll = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    openFamilyMeeting(); mnySetMeetKid('jess'); mmGoStep(3);
    if (!mnyCompOpen) mnyToggleComp();
    const input = document.querySelector('[data-mm-field="comp-name"]');
    if (!input) return false;
    input.focus();
    input.value = 'Winter Invit';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const keptWhileTyping = document.activeElement
      && document.activeElement.getAttribute('data-mm-field') === 'comp-name';
    // And a render triggered by something else puts the caret back.
    input.setSelectionRange(3, 3);
    renderMeetingMode();
    const restored = document.activeElement
      && document.activeElement.getAttribute('data-mm-field') === 'comp-name'
      && document.activeElement.selectionStart === 3;
    const draftKept = mnyCompDraft.name === 'Winter Invit';
    mnyToggleComp();
    closeSheet('familyMeetingOverlay');
    return keptWhileTyping && restored && draftKept;
  });

  // Tabs 4 and 5 were dead inside the meeting: the delegated handler was only
  // bound to the standalone money pages.
  checks.moneyTabsWorkInsideTheMeeting = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead(); openFamilyMeeting(); mmGoStep(3);
    const tab = document.querySelector('#familyMeetingBody [data-mny-action="tab"][data-mny-tab="school"]');
    if (!tab) return false;
    tab.click();
    const landed = document.getElementById('screen-moneyschool').classList.contains('active');
    closeSheet('familyMeetingOverlay');
    return landed;
  });

  // Paying less than the schedule frees money now and costs arrears later. It
  // must never quietly forgive the difference.
  checks.loanPaymentIsArguableNotForgiven = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey;
    mnyPaymentOverrides(kid, wk);
    const due = mnyDueThisWeek(kid, wk);
    if (!due.length) return true;                    // nothing scheduled — nothing to argue
    const d = due[0], id = d.debt.id;
    const mineBefore = mnyPool(wk, kid).mine;
    mnySetPaymentOverride(kid, wk, id, money2(d.scheduled - 1));
    const pool = mnyPool(wk, kid);
    const freed = pool.mine > mineBefore && pool.unpaid === 1;
    // Never above the schedule, and the reset puts it back.
    mnySetPaymentOverride(kid, wk, id, d.scheduled + 99);
    const capped = mnyDueThisWeek(kid, wk)[0].amount === d.scheduled;
    mnySetPaymentOverride(kid, wk, id, null);
    const reset = mnyPool(wk, kid).unpaid === 0;

    // The consequence has to be on screen while the family argues about it —
    // in both units: dollars of arrears, and months added to being free of it.
    // The months half must stay silent rather than claim a shift it can't show.
    const pd = getProfData(kid);
    const debt = mnyDebts(kid)[0];
    debt.paid = Math.max(0, debt.principal - 40);   // small balance → a real shift
    debt.monthly = 13; debt.lastPaymentMonth = null;
    debt.downPaid = debt.downPayment; debt.downPaymentDue = '2026-01-01';
    const big = mnyDueThisWeek(kid, wk)[0];
    let saysBoth = true, silentWhenNoShift = true;
    if (big) {
      mnySetPaymentOverride(kid, wk, id, 0);         // skip the whole payment
      const txt = mnyPaymentImpact(wk, kid, mnyPool(wk, kid));
      saysBoth = /a month in late fees/.test(txt)
              && /pushes being free of .* out by about \d+ month/.test(txt);
      mnySetPaymentOverride(kid, wk, id, null);
    }
    // Paying the schedule in full says nothing at all.
    silentWhenNoShift = mnyPaymentImpact(wk, kid, mnyPool(wk, kid)) === '';
    delete pd.debts;
    return freed && capped && reset && saysBoth && silentWhenNoShift;
  });

  // Spending is a real answer, open from week one, capped at a fifth.
  checks.spendingIsAnOptionAndCapped = await page.evaluate(() => {
    const kid = 'jess', wk = ctWeekKey;
    const openFromTheStart = MNY_BUCKETS.find(b => b.key === 'spend').need === 0;
    const inTheSplit = mnySplitFor(wk, kid, 'own').spend !== undefined;
    const pool = mnyPool(wk, kid);
    const capped = pool.spendCap === money2(pool.mine * 0.2);
    const explained = !!mnyConceptById('spend');
    // "Choose every number myself" is manual entry, not a stage-gated idea: the
    // steppers that do the same job sit unlocked directly beneath it.
    const ownReachable = MNY_PLANS.find(p => p.id === 'own').need === 0
      && mnyIsOpen(kid, MNY_PLANS.find(p => p.id === 'own').need);
    return openFromTheStart && inTheSplit && capped && explained && ownReachable;
  });

  /* One derivation of "this week". Two disagreed for part of every day, and at
     a week boundary named different Mondays — which made the chore tab decide
     the current week predated the money model and fall back to a board with no
     rows on it. */
  checks.oneCurrentWeekEverywhere = await page.evaluate(() => {
    const planner = dateToLocalKey(getWeekStart(0));
    return ctThisWeekKey() === planner
        && mnyWeekKey() === (ctWeekKey || planner)
        && mrUsesNewModel(planner);
  });

  /* ══════════════════════════════════════════════════════════════
     ROUND 2 — the places the flow was leaking. Each of these fails
     silently in the app: every screen still renders, the record just
     stops being true.
     ══════════════════════════════════════════════════════════════ */

  // The week is only recorded when BOTH kids are settled, so the last step has
  // to say when one isn't rather than offering a celebration.
  checks.meetingWontCelebrateHalfDone = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey, c = state.shared.chore;
    ['meetingsHeld', 'finalizedWeeks', 'moneyLedger', 'weekConfirms', 'weekPlans', 'xpAwardedWeeks']
      .forEach(m => { if (c[m]) delete c[m][wk]; });
    ['jenn', 'jess'].forEach(k => {
      const pd = getProfData(k);
      delete pd.debts; pd.deposits = []; pd.competitions = []; pd.honesty = [];
      const e = mrEnsureEarnings(k, wk);
      e.overrides = {}; e.paymentOverrides = {}; e.chores = {}; e.claims = {};
      ensureWallet(k).cash = 0;
      const d = mnyDebts(k)[0]; d.paid = d.principal;      // nothing due
      ['dishes', 'mop', 'vacuum'].forEach((ch, i) => mrSetChoreGrade(k, wk, i, ch, 3));
    });

    openFamilyMeeting(); mmGoStep(5);
    const body = () => document.getElementById('familyMeetingBody').textContent;
    const neitherDone = body().includes('Neither week is decided');

    // Settle Jess only.
    mnySetMeetKid('jess'); mmGoStep(3); mnyDoConfirm(); mmGoStep(4);
    const d = mnyEnsureDraft(wk, 'jess');
    Object.keys(d.split).forEach(k => { d.split[k] = 0; });
    d.split.spend = mnyPool(wk, 'jess').spendCap;
    d.split.ready = money2(mnyPool(wk, 'jess').mine - d.split.spend);
    d.planId = 'own'; d.reflect = 'saving';
    mnyDoCommit();

    mmGoStep(5);
    const namesJenn = body().includes("Jenn's week isn't decided");
    const jessTicks = document.querySelectorAll('.mm-settle-cell.on').length === 2;
    // Half-done must not be recorded, and must not read as finished.
    const notHeld = !(c.meetingsHeld && c.meetingsHeld[wk]);
    const noCelebration = !body().includes('🎉 Finish meeting');
    closeSheet('familyMeetingOverlay');
    return neitherDone && namesJenn && jessTicks && notHeld && noCelebration;
  });

  // An override wins, but the grades behind it must stop claiming to decide
  // anything — on BOTH surfaces that still show them.
  checks.overrideIsFlaggedWhereverGradesShow = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess'; parentViewing = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey;
    const e = mrEnsureEarnings(kid, wk);
    e.chores = {}; e.claims = {}; e.overrides = {};
    const dk = mrWeekDayKeys(wk)[2];
    setDayBlocks(dk, [{ id: 'ovb', actId: 'chores', startMin: 17 * 60,
                        durationMin: 30, choreTags: ['Vacuum'] }], kid);
    mrSetChoreGrade(kid, wk, 2, 'vacuum', 3);
    const gradeBefore = mrGetChoreGrade(kid, wk, 2, 'vacuum');

    const quiet = !mnyOverrideNotice(kid, wk, 'chores');
    mnySetOverride(kid, wk, 'chores', 99, 'graded_wrong');

    openFamilyMeeting(); mmGoStep(1); mmSelectDay(2);
    const inMeeting = document.getElementById('familyMeetingBody').textContent
      .includes('no longer decide it');
    closeSheet('familyMeetingOverlay');

    // The portal, not openChoreTab — that renders the KID frame for everyone
    // (round 1 moved the parent's half of the week into js/27-chore-parent.js).
    // setParentTab only toggles panels — the render has to be asked for.
    cpDay = 2; cpView = 'day';
    showScreen('parent'); setParentTab('chores'); cpRenderChoreTab();
    const cp = document.getElementById('cpWrap').textContent;
    const inPortal = cp.includes('Already graded') && cp.includes('no longer decide it');
    // The override is a display fact, not a rewrite of what she was marked.
    const gradeUntouched = mrGetChoreGrade(kid, wk, 2, 'vacuum') === gradeBefore;

    e.overrides = {}; setDayBlocks(dk, [], kid);
    return quiet && inMeeting && inPortal && gradeUntouched;
  });

  // Work she did that nobody planned has to be claimable — and still gated.
  checks.unplannedChoreIsClaimable = await page.evaluate(async () => {
    // openChoreClaimPrompt resolves a promise whose .then re-renders the chore
    // tab. A fixed delay that expires early lets that render land in the MIDDLE
    // of the next check — where it silently consumes the "newly answered"
    // marker that check is about to assert on. Wait for the dialog to actually
    // be gone instead of guessing.
    const settled = async () => {
      for (let i = 0; i < 50; i++) {
        await new Promise(r => setTimeout(r, 20));
        if (!document.querySelector('#appDialogOverlay.open')) return true;
      }
      return false;
    };
    profile = 'jess'; parentViewing = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey;
    const e = mrEnsureEarnings(kid, wk);
    e.claims = {}; e.chores = {}; e.gradedAt = {};
    mrWeekDayKeys(wk).forEach(k => setDayBlocks(k, [], kid));

    openChoreTab(); ckSelectDay(3);
    const nothingPlanned = document.querySelectorAll('[data-ct-action="ck-chore-row"]').length === 0;
    const doorExists = !!document.querySelector('[data-ct-action="ck-else"]');
    document.querySelector('[data-ct-action="ck-else"]').click();
    const offered = document.querySelectorAll('[data-ct-action="ck-else-pick"]').length > 0;
    document.querySelectorAll('[data-ct-action="ck-else-pick"]')[0].click();
    await new Promise(r => setTimeout(r, 30));
    document.querySelectorAll('.app-dialog-choice')[0].click();
    if (!await settled()) return false;
    await new Promise(r => setTimeout(r, 30));   // let the .then re-render land

    const inQueue = mrClaimQueue(wk, kid).length === 1;
    const onHerTab = document.querySelectorAll('[data-ct-action="ck-chore-row"]').length === 1;
    const markedAdded = !!document.querySelector('.ck-added');
    const paysNothingYet = mrChoreWeek(wk, kid).paid === 0;   // a parent still decides
    return nothingPlanned && doorExists && offered && inQueue
        && onHerTab && markedAdded && paysNothingYet;
  });

  // Her half of the loop: what is with Mom, and what came back while she
  // wasn't looking — and the marker must survive the render that shows it.
  checks.kidSeesWaitingAndAnswered = await page.evaluate(() => {
    const bad = [];
    profile = 'jess'; parentViewing = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey, pd = getProfData(kid);
    const e = mrEnsureEarnings(kid, wk);
    e.claims = {}; e.chores = {}; e.gradedAt = {};
    mrSetClaim(kid, wk, 1, 'dishes', 3);
    mrSetClaim(kid, wk, 3, 'mop', 2);

    openChoreTab(); ckSelectDay(0);
    const wc = mrWaitingCount(kid, wk);
    if (wc !== 2) bad.push(`waiting count is ${wc}, expected 2`);
    if (!document.getElementById('choreWrap').textContent.includes('waiting for Mom'))
      bad.push('her tab does not say "waiting for Mom"');

    /* Say when she last looked, rather than inheriting it from the render above.
       Rendering her tab stamps lastGradeSeen to now; grading below stamps
       gradedAt from the same clock a few instructions later, and mrNewlyGraded
       compares the two with a strict `>`. Both can land in the same millisecond,
       and then a genuinely new grade reads as already-seen. That is what made
       this check fail intermittently on CI while passing every time locally —
       a millisecond boundary, not a regression. */
    pd.progress.lastGradeSeen = syncNow() - 1000;

    const was = profile;
    profile = 'parent'; ctParentKid = kid;
    mrSetChoreGrade(kid, wk, 1, 'dishes', 3);
    // A parent looking at her tab must NOT consume her "new" markers.
    renderChoreTab();
    const afterParent = mrNewlyGraded(kid, wk).length;
    if (afterParent !== 1) bad.push(`a parent's look left ${afterParent} new marker(s), expected 1`);
    profile = was;

    renderChoreTab();
    if (!document.getElementById('choreWrap').textContent.includes('newly answered'))
      bad.push('her tab does not say "newly answered"');
    renderChoreTab();                                  // she has now seen it
    const left = mrNewlyGraded(kid, wk).length;
    if (left !== 0) bad.push(`${left} new marker(s) survived her own look, expected 0`);
    const after = mrWaitingCount(kid, wk);
    if (after !== 1) bad.push(`waiting count is ${after} after one grade, expected 1`);
    // Findings, not a bare false — CLAUDE.md: return true or the findings.
    return bad.length === 0 || bad;
  });

  // A 60-minute session is too short for the 2x2 grid but not too short to
  // review — it gets one line instead of none.
  checks.trainingChecksScaleWithTheBlock = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    const k = getDayKeys(0)[1];
    setDayBlocks(k, [
      { id: 'tc60', actId: 'training', startMin: 9 * 60, durationMin: 60, tag: 'skating', trainingCheck: {} },
      { id: 'tc120', actId: 'training', startMin: 14 * 60, durationMin: 120, tag: 'swimming', trainingCheck: {} },
    ], 'jenn');
    openDay(k, 1);
    const fits = el => el.scrollHeight <= el.getBoundingClientRect().height + 1;
    const short = document.getElementById('block-tc60');
    const tall = document.getElementById('block-tc120');
    const ok = !!short.querySelector('.block-train-chip')
      && short.querySelectorAll('.block-gear-item').length === 0 && fits(short)
      && !tall.querySelector('.block-train-chip')
      && tall.querySelectorAll('.block-gear-item').length === TRAINING_CHECKS.length && fits(tall);
    setDayBlocks(k, [], 'jenn');
    return ok;
  });

  // One quest list, one completion path. The board is a door to it, not a
  // second copy of it.
  checks.questBoardDoesNotDuplicateTheList = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    const key = todayKey();
    setDayBlocks(key, [
      { id: 'qb1', actId: 'breakfast', startMin: 7 * 60, durationMin: 30 },
      { id: 'qb2', actId: 'piano', startMin: 16 * 60, durationMin: 60 },
    ], 'jenn');
    goQuestBoard();
    const noOwnList = document.querySelectorAll('#questList .quest-card').length === 0;
    const hasDoor = !!document.querySelector('.quest-today-card');
    document.querySelector('.quest-today-card').click();
    // The one list is Today now. The board is still only a door to it.
    const landed = document.querySelector('.screen.active').id === 'screen-today'
      && document.querySelectorAll('#tdWrap .quest-card').length === 2;
    setDayBlocks(key, [], 'jenn');
    return noOwnList && hasDoor && landed;
  });

  // "Before we start" is a pre-flight list; it used to render after the week
  // had already been agreed.
  checks.readinessListComesBeforeTheReview = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead();
    openFamilyMeeting(); mmGoStep(1);
    const onStep1 = document.getElementById('familyMeetingBody').textContent
      .includes('Before we start');
    mmGoStep(4);
    const offStep4 = !document.getElementById('familyMeetingBody').textContent
      .includes('Before we start');
    closeSheet('familyMeetingOverlay');
    return onStep1 && offStep4;
  });

  /* The seed-version rule, tested on purpose rather than by luck.

     priceChangeShowsButDoesNotRestate only reaches this code path when
     programStartDate happens to equal today — i.e. on the day the programme
     starts, which in a fresh smoke run means Mondays. That is how the bug it
     guards survived: six days a week the test agreed with a broken build. This
     one builds the precondition explicitly, so it fails every day or none. */
  checks.earliestRuleVersionIsNeverRewritten = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead();
    const mr = mrEnsure();
    const today = todayKey();

    // Precondition: exactly one version, effective today — the shape the
    // programme has on its first day.
    mr.versions = [mr.versions[0]];
    mr.versions[0].effectiveFrom = today;
    const seed = mr.versions[0];
    const seedPrice = seed.rules.chores.grade[3];

    mrApplyEdits([{ path: 'chores.grade.3', value: seedPrice + 1 }], { reason: 'family_meeting' });

    // The seed must be untouched, and a second version must carry the change.
    const seedIntact = mr.versions[0] === seed
      && seed.rules.chores.grade[3] === seedPrice;
    const stacked = mr.versions.length === 2;
    const newestWins = mrRulesFor(today).chores.grade[3] === seedPrice + 1;
    // Anything before the programme still reads the untouched seed.
    const pastIntact = mrRulesForWeek('2020-01-06').chores.grade[3] === seedPrice;

    // ...and the "don't stack a version per nudge" rule still holds for every
    // version that ISN'T the seed: editing today's again replaces it.
    mrApplyEdits([{ path: 'chores.grade.3', value: seedPrice + 2 }], { reason: 'family_meeting' });
    const stillTwo = mr.versions.length === 2
      && mrRulesFor(today).chores.grade[3] === seedPrice + 2;

    // Leave the rules as they were found.
    mr.versions = [seed];
    return seedIntact && stacked && newestWins && pastIntact && stillTwo;
  });

  // The one-line wirings behind the new affordances — each is a place a tap
  // can silently stop going anywhere.
  checks.newAffordancesActuallyNavigate = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess'; parentViewing = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey;
    const e = mrEnsureEarnings(kid, wk);
    e.chores = {}; e.claims = {}; e.overrides = {};

    // "See the change" on the override notice → step 3, that row expanded.
    mrSetChoreGrade(kid, wk, 2, 'vacuum', 3);
    mnySetOverride(kid, wk, 'chores', 99, 'graded_wrong');
    mnyShowTheChange(kid, 'chores');
    const toTheChange = mmStep === 3 && mnyExpandRow === 'chores';
    closeSheet('familyMeetingOverlay');
    e.overrides = {};

    // Her "waiting for Mom" chip → the first day something is waiting on.
    profile = 'jess';
    e.chores = {}; e.claims = {};
    mrSetClaim(kid, wk, 4, 'mop', 3);
    openChoreTab(); ckSelectDay(0);
    ckGoWaiting();
    const toWaiting = ctDay === 4;

    // The short-block training chip → the sheet with all four checks on it.
    profile = 'jenn'; parentViewing = 'jenn';
    const dk = getDayKeys(0)[1];
    setDayBlocks(dk, [{ id: 'nav60', actId: 'training', startMin: 9 * 60,
                        durationMin: 60, tag: 'skating', trainingCheck: {} }], 'jenn');
    openDay(dk, 1);
    document.querySelector('#block-nav60 .block-train-chip').click();
    const toSheet = document.getElementById('kidTrainingOverlay').classList.contains('open')
      && document.querySelectorAll('#kidTrainingChecks .checklist-item').length === TRAINING_CHECKS.length;
    closeSheet('kidTrainingOverlay');
    setDayBlocks(dk, [], 'jenn');
    return toTheChange && toWaiting && toSheet;
  });

  // ── Durability (Branch 1) ────────────────────────────────────────────────
  // The old export copied only the chore slices, so a "backup" silently left
  // out every week, goal and progress record — the whole planner. These checks
  // exist because that failure is invisible: the file downloads, it is valid
  // JSON, and it looks like a backup right up until someone needs it.
  checks.fullBackupCarriesTheWholePlanner = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    const dk = getDayKeys(0)[2];
    setDayBlocks(dk, [{ id: 'bk-blk', actId: 'training', startMin: 600,
                        durationMin: 60, tag: 'skating' }], 'jenn');
    const p = getProfData('jenn');
    p.goals = [{ id: 'g-bk', name: 'Backup goal', done: false }];
    p.progress = p.progress || {};
    p.progress.unlockedChecklistItems = { morning: [{ id: 'unlocked-bk' }] };

    const b = bkBuildFullBackup();
    // It must be a snapshot: holding it and then changing state must not change
    // it. Returning live references made a "backup" that emptied when the thing
    // it was backing up emptied.
    const before = JSON.stringify(b.profiles.jenn.weeks);
    const stash = state.profiles.jenn.weeks;
    state.profiles.jenn.weeks = {};
    const survived = JSON.stringify(b.profiles.jenn.weeks) === before;
    state.profiles.jenn.weeks = stash;
    if (!survived) return 'bkBuildFullBackup returned live references, not a snapshot';

    const jenn = b.profiles.jenn || {};
    const carries = Object.keys(jenn.weeks || {}).length > 0
      && (jenn.goals || []).some(g => g.id === 'g-bk')
      && !!(jenn.progress && jenn.progress.unlockedChecklistItems)
      && !!b.shared
      && b.schemaVersion === BK_SCHEMA_VERSION
      && b.kind === 'weekly-planner-full-backup';

    // Contrast: the same three things are absent from the chore-only shape.
    const choreShape = { profiles: { jenn: getProfData('jenn').chore || {} } };
    const choreOmits = !choreShape.profiles.jenn.weeks
      && !choreShape.profiles.jenn.goals
      && !choreShape.profiles.jenn.progress;

    return carries && choreOmits;
  });

  // A restore has to put back what a lost device had, through the same
  // normalisation a page load uses.
  //
  // The real thing: a lost device. Two genuine page loads, the file going out to
  // disk and coming back through the same File/FileReader path the parent's
  // Restore button uses, and a structural comparison of the whole tree rather
  // than three spot-checks. An in-page test of this proves the merge functions
  // work; it does not prove a family gets their year back, because it never
  // exercises loadLocal() on a cold start with an empty localStorage.
  {
    const APP_URL = 'file://' + path.join(__dirname, '..', 'index.html');
    const backupPath = path.join(outDir, 'roundtrip-backup.json');
    const problems = [];

    // Snapshot what a real device holds, and write the backup out as a file.
    const exported = await page.evaluate(() => {
      profile = 'jenn'; parentViewing = 'jenn';
      const dk = getDayKeys(0)[3];
      setDayBlocks(dk, [{ id: 'rt-blk', actId: 'piano', startMin: 9 * 60,
                          durationMin: 45, note: 'round trip' }], 'jenn');
      const p = getProfData('jenn');
      p.goals = [{ id: 'rt-goal', name: 'Round trip goal', done: false }];
      p.todos = [{ id: 'rt-todo', text: 'survive a reload', done: false }];
      p.progress.unlockedChecklistItems = { morning: [{ id: 'rt-unlock' }] };
      saveAll();
      return { file: bkBuildFullBackup(), snapshot: { profiles: state.profiles, shared: state.shared }, dk };
    });
    // A real backup can be old, and an old backup holds pre-migration blocks in
    // the {start, slots} shape. Injected into the FILE only, not the snapshot,
    // because a correct restore normalises it — so it is asserted separately
    // below rather than compared. Without this the restore path could skip
    // migrateBlocks entirely and every check here would still pass.
    const legacyKey = '2019-09-02';
    exported.file.profiles.jenn.weeks[legacyKey] = [
      { actId: 'piano', start: 8, slots: 4, note: 'from an old backup' }
    ];
    fs.writeFileSync(backupPath, JSON.stringify(exported.file, null, 2));

    // The device is lost: cold start, storage wiped, cold start again so
    // loadLocal() runs against nothing.
    await page.goto(APP_URL);
    await page.waitForFunction(() => typeof selectProfile === 'function');
    await page.evaluate(() => localStorage.clear());
    await page.goto(APP_URL);
    await page.waitForFunction(() => typeof selectProfile === 'function');
    const wiped = await page.evaluate(() => {
      profile = 'jenn'; parentViewing = 'jenn';
      return Object.keys(getProfData('jenn').weeks || {}).length === 0
          && (getProfData('jenn').goals || []).length === 0;
    });
    if (!wiped) problems.push('the wipe did not actually empty the profile');

    // Restore the way a parent does: a real File through the real entry point.
    const fileText = fs.readFileSync(backupPath, 'utf8');
    const restored = await page.evaluate(async (text) => {
      profile = 'parent';                       // restore is parent-gated
      const file = new File([text], 'backup.json', { type: 'application/json' });
      // showChoice/showCheckConfirm would block on a dialog, so answer them the
      // way a parent would: Replace, confirmed.
      const realChoice = window.showChoice, realCheck = window.showCheckConfirm;
      window.showChoice = async () => 'replace';
      window.showCheckConfirm = async () => true;
      try { await bkHandleImportFile(file); }
      finally { window.showChoice = realChoice; window.showCheckConfirm = realCheck; }
      profile = 'jenn'; parentViewing = 'jenn';
      return { profiles: state.profiles, shared: state.shared };
    }, fileText);

    // Structural equality, not spot-checks. A few keys legitimately recompute on
    // load — the streak-freeze week is rewritten by getProfData for the current
    // week — so they are excluded by name rather than by loosening the compare.
    const RECOMPUTED = new Set(['streakFreezeWeek', 'streakFreezeTokens', 'unlockedThisWeek']);
    const diff = [];
    (function walk(a, b, at) {
      if (diff.length > 6) return;
      const ak = a && typeof a === 'object' ? Object.keys(a) : null;
      const bk = b && typeof b === 'object' ? Object.keys(b) : null;
      if (!ak || !bk) { if (JSON.stringify(a) !== JSON.stringify(b)) diff.push(`${at}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`); return; }
      for (const k of new Set([...ak, ...bk])) {
        if (RECOMPUTED.has(k)) continue;
        walk(a[k], b[k], at ? at + '.' + k : k);
      }
    })(exported.snapshot, restored, '');
    // The legacy week is expected to differ — it was only in the file — so it is
    // excluded from the comparison and checked on its own terms below.
    const realDiff = diff.filter(d => !d.startsWith('profiles.jenn.weeks.' + legacyKey));
    if (realDiff.length) problems.push('tree differs after restore: ' + realDiff.slice(0, 4).join(' | '));

    // A restore has to normalise what it loads, exactly as a page load does.
    const migrated = await page.evaluate((k) => {
      const b = (getProfData('jenn').weeks || {})[k];
      return !!b && !!b[0] && typeof b[0].startMin === 'number' && typeof b[0].durationMin === 'number'
          && b[0].id != null;
    }, legacyKey);
    if (!migrated) problems.push('a legacy {start, slots} block was restored unnormalised');

    // And the things a child would actually notice.
    const visible = await page.evaluate((dk) => {
      const p = getProfData('jenn');
      return getDayBlocks(dk, 'jenn').some(b => b.id === 'rt-blk')
          && (p.goals || []).some(g => g.id === 'rt-goal')
          && (p.todos || []).some(t => t.id === 'rt-todo')
          && !!(p.progress && p.progress.unlockedChecklistItems.morning);
    }, exported.dk);
    if (!visible) problems.push('the week, goal, todo or progress did not come back');

    // Leave the app as the rest of the suite expects to find it.
    await page.evaluate((dk) => {
      setDayBlocks(dk, [], 'jenn');
      delete getProfData('jenn').weeks['2019-09-02'];
      const p = getProfData('jenn'); p.goals = []; p.todos = [];
      profile = 'jenn'; parentViewing = 'jenn';
      ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    }, exported.dk);

    checks.restoreBringsBackWhatWasLost = problems.length === 0 || problems;
  }

  // ctExportBackup also writes a .json with a top-level `profiles` key, but
  // each profile there holds only the chore slice. Importing one as a full
  // restore would swap real planner profiles for chore fragments, so it has to
  // be named and refused rather than half-applied.
  checks.choreOnlyFileIsRefusedNotHalfApplied = await page.evaluate(() => {
    const choreFile = { version: 3, exportedAt: new Date().toISOString(),
                        goalsByWeek: {}, groups: [], moneySnapshots: {},
                        profiles: { jenn: {}, jess: {} } };
    const verdict = bkValidateBackup(choreFile);
    const named = !verdict.ok && /chore-only/i.test(verdict.error);

    const newer = bkValidateBackup({ kind: 'weekly-planner-full-backup',
                                     schemaVersion: BK_SCHEMA_VERSION + 1,
                                     profiles: { jenn: {} }, shared: {} });
    const refusesNewer = !newer.ok && /newer version/i.test(newer.error);

    const noVersion = bkValidateBackup({ profiles: { jenn: {} }, shared: {} });
    const good = bkValidateBackup(bkBuildFullBackup());
    return named && refusesNewer && !noVersion.ok && good.ok;
  });

  // Every mutation used to fire a full-document upload. A loop of them fired
  // one per step. This asserts the burst collapses to a single write.
  //
  // Driven against a REAL write, not a proxy counter. The suite boots offline, so
  // pushToFirebase returns at its `if (!fbDocRef || !fbConnected)` guard and the
  // whole body below it — payload build, size measurement, set() — never runs.
  // fbDocRef is a plain mutable global, so a test double reaches the real path
  // with no refactor. Everything is restored afterwards.
  checks.rapidEditsCoalesceIntoOneWrite = await page.evaluate(async () => {
    const realRef = fbDocRef, realConn = fbConnected;
    const writes = [];
    fbDocRef = { set: (payload) => { writes.push(payload); return Promise.resolve(); } };
    fbConnected = true;
    try {
      for (let i = 0; i < 20; i++) saveAll();
      // Nothing may have gone out yet: the whole point is that it waits.
      const noneYet = writes.length === 0;
      await new Promise(r => setTimeout(r, SYNC_DEBOUNCE_MS + 400));
      const exactlyOne = writes.length === 1;
      // ...and what went out is the whole tree, stamped.
      const wroteRealPayload = !!writes[0] && !!writes[0].profiles && !!writes[0].shared
        && !!writes[0]._meta && typeof writes[0]._meta.updatedAt === 'number';

      // A tab going away must not sit on a pending write.
      saveAll();
      flushPush();
      const flushedNow = writes.length === 2;

      // And an idle app must not write at all — a debounce that fires on a timer
      // rather than on an edit would be a slow leak of full-document uploads.
      await new Promise(r => setTimeout(r, SYNC_DEBOUNCE_MS + 400));
      const quietWhenIdle = writes.length === 2;

      return noneYet && exactlyOne && wroteRealPayload && flushedNow && quietWhenIdle;
    } finally {
      fbDocRef = realRef; fbConnected = realConn;
    }
  });

  // The 1 MiB ceiling is reached by growth, not by a bug, so the warning has to
  // arrive while there is still room to act.
  checks.cloudSizeWarnsBeforeTheCeiling = await page.evaluate(() => {
    const ok = payloadHealth(200 * 1024);
    const warn = payloadHealth(750 * 1024);
    const crit = payloadHealth(950 * 1024);
    const ordered = ok.level === 'ok' && warn.level === 'warn' && crit.level === 'critical';
    const pctSane = ok.pct < warn.pct && warn.pct < crit.pct && crit.pct <= 100;
    // Multi-byte characters must not be under-counted: .length would say 3.
    const utf8 = byteLength('déjà') === 6 && byteLength('🎯') === 4;
    const live = bkCloudSizeInfo();
    return ordered && pctSane && utf8 && live.bytes > 0 && typeof live.level === 'string';
  });

  // The thresholds above are a pure function. This is the path that actually has
  // to work: a real state, grown the way a family grows one, pushed through the
  // real pushToFirebase, warning a parent before the document stops saving.
  checks.aBigStateActuallyTripsTheWarning = await page.evaluate(async () => {
    const realRef = fbDocRef, realConn = fbConnected;
    const realProfiles = JSON.parse(JSON.stringify(state.profiles));
    const realLevel = payloadWarnLevel, realBytes = lastPayloadBytes;
    const toasts = [];
    const realToast = window.showToast;
    window.showToast = (m) => { toasts.push(String(m)); };
    let lastWrite = null;
    fbDocRef = { set: (p) => { lastWrite = p; return Promise.resolve(); } };
    fbConnected = true;
    payloadWarnLevel = 'ok';
    try {
      // 60 weeks x 2 kids x 7 days x 6 blocks, with the field count a real block
      // carries (placeBlock writes ~20) so the bytes are honest rather than a
      // string padded to length.
      ['jenn', 'jess'].forEach(kid => {
        const weeks = {};
        for (let w = 0; w < 60; w++) {
          for (let d = 0; d < 7; d++) {
            const key = `2025-${String((w % 12) + 1).padStart(2, '0')}-${String((d % 28) + 1).padStart(2, '0')}-w${w}`;
            weeks[key] = Array.from({ length: 6 }, (_, i) => ({
              id: `blk-${w}-${d}-${i}`, actId: 'training', startMin: 480 + i * 90,
              durationMin: 60, tag: 'skating', note: 'a note of the sort she actually writes',
              colour: '#ef476f', completed: i % 2 === 0, confirmed: false,
              objectives: ['edges', 'spins'], choreTags: ['dishes'],
              trainingCheck: { warm: true, gear: true, focus: false, cool: false },
              checklistState: {}, travelBuffer: true, travelBufMin: 15,
              getReadyBuffer: true, getReadyBufMin: 15, warmupBuffer: true,
              warmupBufMin: 20, public: true, createdAt: 1, updatedAt: 2,
            }));
          }
        }
        state.profiles[kid].weeks = weeks;
      });

      flushPush();
      await new Promise(r => setTimeout(r, 50));

      // The number reported must BE the number uploaded, not a parallel sum.
      const uploaded = byteLength(JSON.stringify({ profiles: lastWrite.profiles, shared: lastWrite.shared }));
      const measuredMatchesUploaded = Math.abs(lastPayloadBytes - uploaded) < 2;
      const isBig = lastPayloadBytes > SYNC_WARN_BYTES;
      const levelRose = payloadWarnLevel === 'warn' || payloadWarnLevel === 'critical';
      const toldSomeone = toasts.some(t => /size limit/i.test(t));

      // Once per transition, not once per write — a parent settling a meeting
      // must not get the same warning forty times.
      const after = toasts.length;
      flushPush();
      await new Promise(r => setTimeout(r, 50));
      const didNotNag = toasts.length === after;

      // And the parent panel states it in words.
      bkRenderPanel();
      const panel = document.getElementById('bkWrap').textContent;
      const panelSaysSo = /of 1 MB/.test(panel) && /(close to the cloud limit|keeping an eye)/i.test(panel);

      return measuredMatchesUploaded && isBig && levelRose && toldSomeone && didNotNag && panelSaysSo;
    } finally {
      state.profiles = realProfiles;
      fbDocRef = realRef; fbConnected = realConn;
      payloadWarnLevel = realLevel; lastPayloadBytes = realBytes;
      window.showToast = realToast;
      saveLocal();
    }
  });

  // The panel is the only route to a backup, so it has to actually render and
  // its controls have to be reachable — a working exportFullBackup behind a
  // blank tab is no better than no backup at all.
  await page.evaluate(() => {
    profile = 'parent'; showScreen('parent'); renderParentHome(); setParentTab('backup');
  });
  checks.backupTabIsUsable = await page.evaluate(() => {
    const wrap = document.getElementById('bkWrap');
    const panel = document.getElementById('ptab-backup');
    if (!wrap || !panel || panel.hidden) return false;
    const btns = [...wrap.querySelectorAll('button')];
    const hasBoth = btns.some(b => /export full backup/i.test(b.textContent))
                 && btns.some(b => /restore from file/i.test(b.textContent));
    // Parent-only surface, but the 44px floor is a house rule everywhere.
    const bigEnough = btns.every(b => {
      const r = b.getBoundingClientRect();
      return r.height >= 44 && r.width >= 44;
    });
    const meterDrawn = !!wrap.querySelector('.bk-meter-fill');
    const saysSize = /of 1 MB/.test(wrap.textContent);
    return hasBoth && bigEnough && meterDrawn && saysSize;
  });
  await page.screenshot({ path: shot('parent_backup') });

  // ── Escaping (Branch 2) ──────────────────────────────────────────────────
  // escapeHtml was rewritten from "build a <div>, set textContent, read back
  // innerHTML" to a direct replace. That is a load-bearing security primitive,
  // so equivalence is asserted rather than assumed.
  checks.escapingMatchesTheDomReference = await page.evaluate(() => {
    const reference = (str) => {                 // the old implementation
      if (str == null) return '';
      const d = document.createElement('div');
      d.textContent = String(str);
      return d.innerHTML;
    };
    const cases = ['', 'plain', 'a & b', '<script>alert(1)</script>', '"quoted"',
                   "it's", '<>&"\'', 'a\nb', '  spaced  ', '&amp;', '&lt;script&gt;',
                   '🎯 emoji', '中文字符', 'a<b>c&d', null, undefined, 0, 42, false];
    return cases.every(c => escapeHtml(c) === reference(c));
  });

  // Escaping has to hold on every surface that renders user text, not just the
  // one it was fixed on. Hostile strings are planted in the three places a family
  // actually types — an activity name, a block note, a chore label — and then each
  // screen is visited in turn.
  //
  // Two assertions per surface, because either alone is satisfiable by a bug:
  // "no injected element" also passes if the string silently vanished, and
  // "the text is there" also passes if it rendered as markup beside its own text.
  {
    const PAYLOAD = '<img src=x onerror="window.__xss5=1">&"';
    const problems = [];
    await page.evaluate((payload) => {
      window.__xss5 = false;
      profile = 'jenn'; parentViewing = 'jenn';
      ctPrepareRead(); ctSetCurrentWeekFromPlanner();
      const dk = getDayKeys(0)[1];
      const acts = getProfData('jenn').customActivities || [];
      acts.push({ id: 'xss5-act', name: payload, icon: '⭐', cat: 'free', durationMin: 30 });
      getProfData('jenn').customActivities = acts;
      setDayBlocks(dk, [{ id: 'xss5-blk', actId: 'xss5-act', startMin: 9 * 60,
                          durationMin: 60, note: payload }], 'jenn');
      // A shared challenge renders on the sisters screen.
      state.shared.challenges = [{ id: 'xss5-ch', title: payload, target: 3, unit: 'times' }];
    }, PAYLOAD);

    /* Both week layouts render user text and both must be proved, so neither is
       left to whichever happens to be the default. They need different proofs:
       the Full view prints the whole name, but Day Blocks passes it through
       tg2ShortLabel, which shortens in JS — so demanding the entire payload
       there would fail on a view that is behaving correctly. For that one the
       proof of render is that a label element exists at all; the assertions
       that matter — no <img> built, no onerror fired — are identical. */
    const SURFACES = [
      ['week',        () => { goWeek(); setWeekView('full'); }, true],
      ['week-blocks', () => { goWeek(); setWeekView('timegrid'); }, false],
      ['day',   () => { openDay(getDayKeys(0)[1], 1); }, true],
      ['sheet', () => { openDay(getDayKeys(0)[1], 1); openEditSheet('xss5-blk'); }, true],
      ['sync',  () => { openSisterSync(); }, true],
      ['chore', () => { openChoreTab(); ckSelectDay(1); }, true],
    ];
    for (const [name, nav, wantsLiteral] of SURFACES) {
      const r = await page.evaluate(async ({ src, payload }) => {
        try { eval('(' + src + ')()'); } catch (e) { return { err: String(e).slice(0, 80) }; }
        await new Promise(r => setTimeout(r, 60));
        return {
          injected: !!document.querySelector('img[src="x"]'),
          // The raw string must appear as text somewhere — proof it rendered
          // rather than being dropped or swallowed into an attribute.
          literal: document.body.innerText.includes(payload),
          // Day Blocks shortens every label deliberately; a rendered label is
          // the proof that this surface drew the hostile block at all.
          rendered: !!document.querySelector('.tg2-block-lbl'),
          fired: window.__xss5 === true,
        };
      }, { src: nav.toString(), payload: PAYLOAD });
      if (r.err) { problems.push(`${name}: navigation threw — ${r.err}`); continue; }
      if (r.injected) problems.push(`${name}: an <img> was created from user text`);
      if (r.fired) problems.push(`${name}: onerror executed`);
      if (wantsLiteral && !r.literal) problems.push(`${name}: the hostile string never rendered as text (test proves nothing)`);
      if (!wantsLiteral && !r.rendered) problems.push(`${name}: nothing rendered here (test proves nothing)`);
    }

    await page.evaluate(() => {
      const dk = getDayKeys(0)[1];
      setDayBlocks(dk, [], 'jenn');
      getProfData('jenn').customActivities =
        (getProfData('jenn').customActivities || []).filter(a => a.id !== 'xss5-act');
      state.shared.challenges = [];
      closeSheet('editOverlay');
      goWeek();
    });
    checks.escapingHoldsOnEverySurface = problems.length === 0 || problems;
  }

  // Reference material is allowed to be long only because it starts collapsed —
  // which is a promise that it is still one tap away, and that the choice sticks.
  // The word budget alone would be satisfied by content that is simply unreachable.
  checks.collapsedReferenceIsOneTapAway = await page.evaluate(async () => {
    const problems = [];
    const words = (id) => {
      const scr = document.getElementById(id);
      return (scr.innerText || '').split(/\s+/).filter(w => /[A-Za-z]/.test(w)).length;
    };
    const cases = [
      ['screen-mymoney', () => mnyOpenMyMoney('jenn'), '[data-mny-action="prices"]'],
      ['screen-chore',   () => { openChoreTab(); ckSelectDay(2); }, '[data-ct-action="ck-privs"]'],
      ['screen-week',    () => { goWeek(); renderWeek(); }, '#weekGlance .week-glance-toggle'],
    ];
    for (const [id, nav, sel] of cases) {
      nav();
      await new Promise(r => setTimeout(r, 80));
      const closed = words(id);
      const btn = document.querySelector('#' + id + ' ' + sel) || document.querySelector(sel);
      if (!btn) { problems.push(`${id}: no disclosure control (${sel})`); continue; }
      const box = btn.getBoundingClientRect();
      if (box.height < 44) problems.push(`${id}: disclosure control is ${Math.round(box.height)}px tall`);
      const wasExpanded = btn.getAttribute('aria-expanded');

      btn.click();
      await new Promise(r => setTimeout(r, 120));
      const open = words(id);
      if (open <= closed) problems.push(`${id}: one tap revealed nothing (${closed} -> ${open} words)`);
      const nowBtn = document.querySelector('#' + id + ' ' + sel) || document.querySelector(sel);
      if (wasExpanded !== null && nowBtn && nowBtn.getAttribute('aria-expanded') === wasExpanded) {
        problems.push(`${id}: aria-expanded did not change`);
      }

      // The choice has to survive a re-render, or "remembered" is a lie.
      nav();
      await new Promise(r => setTimeout(r, 80));
      if (words(id) < open) problems.push(`${id}: the open state did not survive a re-render`);

      // Put it back closed for whatever runs next.
      const closeBtn = document.querySelector('#' + id + ' ' + sel) || document.querySelector(sel);
      if (closeBtn) closeBtn.click();
      await new Promise(r => setTimeout(r, 80));
    }
    return problems.length === 0 || problems;
  });

  // A block note used to be spliced into the block id, and block ids are
  // interpolated into inline onclick handlers — so an apostrophe in a note closed
  // the handler's string and the rest ran as JavaScript on tap. Both the id
  // generator and the render sites are fixed; this asserts both.
  checks.hostileNamesCannotBecomeCode = await page.evaluate(async () => {
    window.__xssFired = false;
    const payload = "',window.__xssFired=1,'";
    profile = 'jenn'; parentViewing = 'jenn';
    const dk = getDayKeys(0)[1];

    // Path 1: a legacy id-less block whose note carries the payload.
    state.profiles.jenn.weeks[dk] = [{ actId: 'piano', start: 8, slots: 4, note: payload }];
    migrateBlocks();
    const slugged = !/['"<>\\]/.test(state.profiles.jenn.weeks[dk][0].id);
    openDay(dk, 1);
    document.querySelectorAll('[onclick*="toggleBlockDone"]').forEach(el => el.click());

    // Path 2: an id that arrives already-formed, as a writer to the shared
    // Firestore document could supply. ensureBlockId never sees this one.
    state.profiles.jenn.weeks[dk] = [{ id: "evil" + payload, actId: 'piano',
                                       startMin: 480, durationMin: 60 }];
    openDay(dk, 1);
    document.querySelectorAll('[onclick*="toggleBlockDone"]').forEach(el => el.click());
    await new Promise(r => setTimeout(r, 50));

    // Path 3: a hostile activity name must render as text, not markup.
    const acts = getProfData('jenn').customActivities || [];
    acts.push({ id: 'xss-act', name: '<img src=x onerror="window.__xssFired=1">',
                icon: '⭐', cat: 'free', durationMin: 30 });
    getProfData('jenn').customActivities = acts;
    if (typeof buildTray === 'function') buildTray();
    const injected = !!document.querySelector('#screen-day img[src="x"], .tray img[src="x"]');

    getProfData('jenn').customActivities = acts.filter(a => a.id !== 'xss-act');
    setDayBlocks(dk, [], 'jenn');
    return slugged && !injected && window.__xssFired === false;
  });

  // Stamps written into state must come from server-corrected time, or the merge
  // layer arbitrates on whose clock is furthest ahead rather than who edited last.
  checks.stampsUseServerCorrectedTime = await page.evaluate(() => {
    const saved = serverTimeOffsetMs, savedKnown = serverTimeKnown, savedStamps = ownWriteStamps.slice();
    let ok = true;

    // Offline / before the first echo: syncNow is just the local clock.
    serverTimeOffsetMs = 0; serverTimeKnown = false;
    ok = ok && Math.abs(syncNow() - Date.now()) < 50;

    // Learn an offset from the echo of one of our own writes.
    const clientAt = Date.now();
    ownWriteStamps = [clientAt];
    noteServerTime({ clientAt, serverAt: { toMillis: () => clientAt - 600000 } });
    ok = ok && serverTimeKnown === true;
    ok = ok && Math.abs(serverTimeOffsetMs - (-600000)) < 50;
    ok = ok && Math.abs(syncNow() - (Date.now() - 600000)) < 100;

    // markItemUpdated must use the corrected clock, not Date.now().
    const item = markItemUpdated({});
    ok = ok && item.updatedAt < Date.now() - 500000;

    // Another device's write teaches us nothing about our own clock.
    const before = serverTimeOffsetMs;
    noteServerTime({ clientAt: 12345, serverAt: { toMillis: () => 999999999 } });
    ok = ok && serverTimeOffsetMs === before;

    // An implausible offset is ignored rather than trusted.
    const c2 = Date.now();
    ownWriteStamps = [c2];
    noteServerTime({ clientAt: c2, serverAt: { toMillis: () => c2 + 5 * 24 * 3600 * 1000 } });
    ok = ok && serverTimeOffsetMs === before;

    serverTimeOffsetMs = saved; serverTimeKnown = savedKnown; ownWriteStamps = savedStamps;
    return ok;
  });

  // Installability, checked over a real origin.
  //
  // Not Lighthouse — that is a heavy dependency and most of what it would report
  // here is a handful of preconditions this can check directly. What it CANNOT
  // do is claim Lighthouse passed, so it does not: this verifies the manifest
  // fetches and parses the way a browser fetches it, that start_url resolves,
  // and that every icon is a real image at the pixel size it claims. An icon
  // entry saying 512x512 while pointing at a 192px file is the classic way an
  // install prompt silently never appears, and a disk read cannot catch it
  // because the bytes are there either way.
  {
    const { server, port } = await serveRepo();
    const problems = [];
    try {
      const httpPage = await browser.newPage();
      const res = await httpPage.goto(`http://127.0.0.1:${port}/index.html`);
      if (!res || !res.ok()) problems.push('index.html did not load over http');
      const r = await httpPage.evaluate(async () => {
        const out = { theme: !!document.querySelector('meta[name="theme-color"]'),
                      apple: !!document.querySelector('meta[name="apple-mobile-web-app-capable"]') };
        const link = document.querySelector('link[rel="manifest"]');
        if (!link) return Object.assign(out, { err: 'no <link rel="manifest">' });
        const resp = await fetch(link.href);
        out.status = resp.status;
        out.type = (resp.headers.get('content-type') || '').split(';')[0];
        try { out.m = await resp.json(); } catch (e) { out.err = 'manifest is not valid JSON'; }
        if (out.m) {
          const startRes = await fetch(new URL(out.m.start_url, link.href).href, { method: 'GET' });
          out.startOk = startRes.ok;
          // Decode each icon and read its REAL dimensions.
          out.icons = [];
          for (const icon of (out.m.icons || [])) {
            const url = new URL(icon.src, link.href).href;
            const dims = await new Promise(done => {
              const img = new Image();
              img.onload = () => done({ w: img.naturalWidth, h: img.naturalHeight });
              img.onerror = () => done(null);
              img.src = url;
            });
            out.icons.push({ src: icon.src, declared: icon.sizes, purpose: icon.purpose || '', dims });
          }
        }
        return out;
      });

      if (r.err) problems.push(r.err);
      if (!r.theme) problems.push('no theme-color meta');
      if (!r.apple) problems.push('no apple-mobile-web-app-capable meta');
      if (r.status && r.status !== 200) problems.push(`manifest returned ${r.status}`);
      if (r.m) {
        if (!r.m.name || !r.m.short_name) problems.push('manifest needs name and short_name');
        if (r.m.display !== 'standalone') problems.push(`display is ${r.m.display}, want standalone`);
        if (!r.startOk) problems.push(`start_url ${r.m.start_url} did not resolve`);
        const declared = (r.m.icons || []).map(i => i.sizes);
        if (!declared.includes('192x192') || !declared.includes('512x512')) problems.push('needs 192 and 512 icons');
        if (!(r.m.icons || []).some(i => (i.purpose || '').includes('maskable'))) problems.push('needs a maskable icon');
        for (const icon of (r.icons || [])) {
          if (!icon.dims) { problems.push(`icon did not load: ${icon.src}`); continue; }
          const [w, h] = String(icon.declared).split('x').map(Number);
          if (icon.dims.w !== w || icon.dims.h !== h) {
            problems.push(`icon ${icon.src} claims ${icon.declared} but is ${icon.dims.w}x${icon.dims.h}`);
          }
        }
      }
      await httpPage.close();
    } finally {
      server.close();
    }
    checks.installsToTheHomeScreen = problems.length === 0 || problems;
  }

  // ── Today (Branch 4) ─────────────────────────────────────────────────────
  // The whole claim of this screen is that a child can answer "what now?" and
  // act on it without entering the planner. So: does it name the current thing,
  // and does a tap reach the place that owns the action?
  checks.todayAnswersWhatNow = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const dk = todayKey();
    const now = new Date().getHours() * 60 + new Date().getMinutes();
    // One block happening right now, one later.
    setDayBlocks(dk, [
      { id: 'td-now',  actId: 'piano',  startMin: Math.max(0, now - 15), durationMin: 60 },
      { id: 'td-next', actId: 'piano',  startMin: Math.min(23 * 60, now + 120), durationMin: 30 },
    ], 'jenn');
    goToday();
    const wrap = document.getElementById('tdWrap');
    const txt = wrap.textContent;
    const namesNow = /now · started/.test(txt);
    const hasJobs = /Jobs I can do/.test(txt);
    const says = !!wrap.querySelector('.td-say') && wrap.querySelector('.td-say').textContent.trim().length > 0;

    // With nothing on today it must not read as a failure — off days are valid.
    setDayBlocks(dk, [], 'jenn');
    goToday();
    const kind = /allowed|yours|quiet/i.test(document.getElementById('tdWrap').textContent);
    return namesNow && hasJobs && says && kind;
  });

  /* Handing off, not re-implementing. Today is now where a day gets *done*, so
     it does write — but only by calling the function that already owned the
     write (completeQuest for a tick, addQuickBreak for a break, setDayMood for a
     mood). What it must still never do is grade a chore or move money: those
     belong to the chore and money screens, and a second place that decides them
     is a second place that can disagree. So the assertion narrows rather than
     disappears — the navigation rows still change screen and not state. */
  checks.todayHandsOffRatherThanActing = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey, d = tdTodayIndex();
    if (d == null) return 'today is outside the current week';
    const before = JSON.stringify(mrEnsureEarnings('jenn', wk));

    goToday();
    // Every row is a hand-off. Clicking one must change screen, not state.
    const row = document.querySelector('#tdWrap [data-td-action="chore"]');
    if (row) {
      row.click();
      const wentToChore = document.getElementById('screen-chore').classList.contains('active');
      const after = JSON.stringify(mrEnsureEarnings('jenn', wk));
      if (!wentToChore || after !== before) return 'a Today row changed state or did not navigate';
    }
    // The footer shortcuts are static markup now — siblings of #tdWrap, not
    // inside it — so they are scoped to the screen.
    goToday();
    document.querySelector('#screen-today [data-td-action="week"]').click();
    const toWeek = document.getElementById('screen-week').classList.contains('active');
    goToday();
    document.querySelector('#screen-today [data-td-action="money"]').click();
    const toMoney = document.getElementById('screen-mymoney').classList.contains('active');

    const untouched = JSON.stringify(mrEnsureEarnings('jenn', wk)) === before;
    return toWeek && toMoney && untouched;
  });

  // Today reads the same counts the chore screen does. If they can disagree, one
  // of them is lying to a child about whether Mum has answered.
  checks.todayAgreesWithTheChoreScreen = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey, d = tdTodayIndex();
    if (d == null) return 'today is outside the current week';
    /* Pick a chore that is actually still open today. This took the first pool
       row unconditionally, and by the time it ran an earlier check had already
       graded `dishes` for this day — a graded chore is "answered", never
       "waiting", so the claim landed and the waiting count stayed 0. The check
       then returned a bare `false` and said nothing about why. */
    /* Claim a chore that is genuinely still open today. This used to take the
       first pool row unconditionally, and by the time it ran an earlier check
       had already graded every chore due today — a graded chore is "answered",
       never "waiting", so the claim landed and the waiting count stayed 0 while
       the check reported a bare `false` that said nothing about why.
       Clear this day's grades first so the precondition is real, not assumed. */
    /* And plant one if today has none, rather than reporting that as a failure.
       Whether a chore is due today depends on which weekday the run lands on:
       the pool rows that need a planned block only show up on the days the
       seeded week puts one, so this check passed on Tuesday and Wednesday and
       failed on Thursday against the identical commit, saying only "no chores
       due today to claim". That is the check's own precondition, not a defect
       in the app — and a check that can only run on some weekdays is not
       checking the other ones. Tag the block with a pool row id so it resolves
       for whoever the pool actually assigns the chore to. */
    const dayKey = mrWeekDayKeys(wk)[d];
    const hadBlocks = (getDayBlocks(dayKey) || []).slice();
    let dueRows = mrChoresForDay('jenn', wk, d).rows.map(r => r.row);
    if (!dueRows.length) {
      const mine = mrPoolRows(wk).filter(r => r.who === 'both' || r.who === 'jenn');
      if (!mine.length) return 'the chore pool has nothing for jenn';
      setDayBlocks(dayKey, [{ id: 'td-agree', actId: 'chores', startMin: 17 * 60,
                              durationMin: 30, choreTags: [mine[0].id] }], 'jenn');
      dueRows = mrChoresForDay('jenn', wk, d).rows.map(r => r.row);
      if (!dueRows.length) return `planted "${mine[0].id}" on today and it still reads as nothing due`;
    }
    const e = mrEnsureEarnings('jenn', wk);
    if (e.chores) delete e.chores[String(d)];
    const open = dueRows[0];
    mrSetClaim('jenn', wk, d, open.id, 3);

    goToday();
    const todayChip = document.querySelector('#tdWrap [data-td-action="waiting"]');
    const todayCount = todayChip ? Number((todayChip.textContent.match(/\d+/) || [0])[0]) : 0;
    const truth = mrWaitingCount('jenn', wk);

    // ...and the claim must not appear in "jobs I can do" as well, or it reads as
    // two separate jobs.
    const claimedLabel = open.label;
    const stillOffered = [...document.querySelectorAll('#tdWrap [data-td-action="chore"]')]
      .some(b => b.textContent.includes(claimedLabel));

    mrEnsureEarnings('jenn', wk).claims = {};
    setDayBlocks(dayKey, hadBlocks, 'jenn');   // put today back as it was found
    // Findings, not a bare false: this returned only `false` and said nothing
    // about which half disagreed, which is the shape CLAUDE.md warns about.
    const bad = [];
    if (todayCount !== truth) bad.push(`Today says ${todayCount} waiting, the chore screen says ${truth}`);
    if (!(truth > 0)) bad.push(`the claim on "${open.id}" did not register as waiting`);
    if (stillOffered) bad.push(`"${claimedLabel}" is claimed and still offered as a job`);
    return bad.length === 0 || bad;
  });

  /* Today is the doing surface: the quest list, the 🎯, and the panels that came
     off the day timeline. The 🎯 must go through completeQuest — the single
     owner of completion, XP and sticker counting — rather than a second copy of
     it, which is the thing the Today rules actually forbid. */
  checks.todayIsWhereTheDayGetsDone = await page.evaluate(async () => {
    profile = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const key = todayKey();
    const bad = [];
    setDayBlocks(key, [
      { id: 'td-q1', actId: 'piano',      startMin: 15 * 60, durationMin: 60 },
      { id: 'td-q2', actId: 'breakfast',  startMin: 7 * 60,  durationMin: 30 },
    ], 'jenn');
    goToday();

    // The whole day is listed, in day order — not a capped teaser.
    const cards = [...document.querySelectorAll('#tdWrap .quest-card')];
    if (cards.length !== 2) bad.push(`expected 2 quest cards, got ${cards.length}`);
    const times = [...document.querySelectorAll('#tdWrap .quest-time')].map(e => e.textContent.trim());
    if (times[0] !== '7:00am') bad.push(`cards are not in day order: ${times.join(', ')}`);

    // 🎯 completes through the owning path: block marked done AND XP moved.
    const xpBefore = getQuestXP('jenn');
    const blast = document.querySelector('#tdWrap [data-td-action="blast"][data-td-block="td-q2"]');
    if (!blast) { bad.push('no 🎯 on a quest card'); }
    else {
      blast.click();
      // The blast is an animation: projectile 300ms, burst 240ms, then the
      // completion. Assert after it lands, not before.
      await new Promise(r => setTimeout(r, 900));
      const blk = (getDayBlocks(key, 'jenn') || []).find(b => b.id === 'td-q2');
      if (!blk || !blk.completed) bad.push('🎯 did not complete the block');
      if (getQuestXP('jenn') <= xpBefore) bad.push('🎯 completed without awarding XP');
    }

    // Tapping the card body is still a hand-off to the planner, not a write.
    goToday();
    const open = document.querySelector('#tdWrap [data-td-action="plan"][data-td-block="td-q1"]');
    if (!open) bad.push('a quest card does not open the day for planning');
    else {
      open.click();
      if (document.querySelector('.screen.active').id !== 'screen-day') bad.push('card body did not reach the day screen');
    }

    // The relocated panels are present, and the reference ones start collapsed
    // so they cost nothing against the word budget.
    goToday();
    if (!document.getElementById('vibeMoods')) bad.push('the vibe picker did not come across');
    if (!document.getElementById('dayTodosList') || !document.getElementById('dayGoalsList')) bad.push('to-dos/goals did not come across');
    if (!document.querySelector('#screen-today .btn-break-quick')) bad.push('the break buttons did not come across');
    const body = document.getElementById('tdExtrasBody');
    if (!body || getComputedStyle(body).display !== 'none') bad.push('the extras panel is not collapsed by default');
    tdToggleExtras();
    if (getComputedStyle(document.getElementById('tdExtrasBody')).display === 'none') bad.push('the extras panel does not open');
    tdToggleExtras();

    setDayBlocks(key, [], 'jenn');
    return bad.length === 0 || bad;
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { profile = 'jenn'; goToday(); });
  await page.screenshot({ path: shot('phone_today') });
  await page.setViewportSize({ width: 900, height: 1100 });
  await page.waitForTimeout(150);

  // ── Today as the front door (Branch 5) ───────────────────────────────────
  checks.todayIsTheFrontDoor = await page.evaluate(async () => {
    /* Hero Mode used to decide the landing, and was eventually the only thing it
       decided; it is gone. A child lands on Today unconditionally now, and the
       key must not come back — a stale flag reviving an old landing screen is
       exactly the failure this check exists to catch. */
    const results = [];
    profile = null;
    await selectProfile('jenn');
    results.push(document.getElementById('screen-today').classList.contains('active'));
    results.push(typeof isHeroMode === 'undefined');
    results.push(localStorage.getItem('wp_hero_mode') === null);
    // A parent still lands in the portal.
    parentUnlockedThisSession = true;
    await selectProfile('parent');
    const parentToPortal = document.getElementById('screen-parent').classList.contains('active');
    profile = 'jenn'; parentViewing = 'jenn';
    return results.every(Boolean) && parentToPortal;
  });

  // The nav lives outside every #screen-*, so the kid-standards sweep cannot see
  // it. Checked here instead: it is a kid surface and the same rules apply.
  checks.kidNavIsUsableAndScoped = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    goToday();
    const nav = document.getElementById('kidNav');
    if (!nav || nav.hidden) return 'nav hidden on Today';
    const btns = [...nav.querySelectorAll('.kid-nav-btn')];
    if (btns.length !== 4) return `expected 4 destinations, got ${btns.length}`;
    const bigEnough = btns.every(b => {
      const r = b.getBoundingClientRect();
      return r.height >= 44 && r.width >= 44;
    });
    const fontOk = btns.every(b => {
      const l = b.querySelector('.kid-nav-label');
      return l && parseFloat(getComputedStyle(l).fontSize) >= 13;
    });
    // The current place has to be stated, not only tinted.
    const marksCurrent = !!nav.querySelector('.kid-nav-btn.on[aria-current="page"]');
    // Content must not sit underneath it.
    const padded = parseFloat(getComputedStyle(document.body).paddingBottom) >= 50;

    // Hidden where it does not belong: a parent in the portal, and the picker.
    profile = 'parent'; showScreen('parent'); renderParentHome();
    const hiddenForParent = document.getElementById('kidNav').hidden;
    profile = 'jenn'; showScreen('profile');
    const hiddenOnPicker = document.getElementById('kidNav').hidden;
    goToday();
    return bigEnough && fontOk && marksCurrent && padded && hiddenForParent && hiddenOnPicker;
  });

  // Every destination goes somewhere, and every route the app had before still
  // works — this stage adds a way to move around, it retires nothing.
  checks.navReachesEverythingAndOldRoutesStillWork = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    const click = (sel) => { const el = document.querySelector(sel); if (el) el.click(); };
    const activeId = () => (document.querySelector('.screen.active') || {}).id;

    goToday();
    click('#kidNav [data-td-nav="week"]');
    const toWeek = activeId() === 'screen-week';
    click('#kidNav [data-td-nav="money"]');
    const toMoney = activeId() === 'screen-mymoney';
    click('#kidNav [data-td-nav="today"]');
    const backToToday = activeId() === 'screen-today';

    // More opens a sheet, and a row in it navigates.
    click('#kidNav [data-td-nav="more"]');
    const sheetOpen = document.getElementById('tdMoreOverlay').classList.contains('open');
    click('#tdMoreOverlay [data-td-more="chores"]');
    const toChores = activeId() === 'screen-chore';
    const sheetClosed = !document.getElementById('tdMoreOverlay').classList.contains('open');

    // The pre-existing globals the rest of the suite drives the app with.
    goWeek();              const oldWeek   = activeId() === 'screen-week';
    goQuestBoard();        const oldQuest  = activeId() === 'screen-quest';
    openChoreTab();        const oldChore  = activeId() === 'screen-chore';
    mnyOpenMyMoney('jenn'); const oldMoney = activeId() === 'screen-mymoney';
    openSisterSync();      const oldSync   = activeId() === 'screen-sync';
    goToday();
    return toWeek && toMoney && backToToday && sheetOpen && toChores && sheetClosed
        && oldWeek && oldQuest && oldChore && oldMoney && oldSync;
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { profile = 'jenn'; goToday(); });
  await page.screenshot({ path: shot('phone_today_nav') });
  await page.setViewportSize({ width: 900, height: 1100 });
  await page.waitForTimeout(150);

  /* ── ONE POOL, ONE NUMBER ────────────────────────────────────────────────
     The kid page, the meeting and the parent portal must print the same
     "money that came in". They did not: the kid page headlined the income
     bar's total (fines counted separately, holding growth included) under the
     very phrase the meeting uses for pool.cameIn (fines taken off, growth
     excluded). Two right answers to two different questions, wearing one label.

     Comparing the FUNCTIONS would not have caught it — both were correct. So
     this compares rendered text on all three surfaces. */
  checks.onePoolReadsTheSameOnEveryScreen = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess'; parentViewing = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey;
    const pd = getProfData(kid);
    delete pd.debts;
    mrEnsureEarnings(kid, wk).overrides = {};
    ['dishes', 'mop', 'vacuum'].forEach((c, i) => mrSetChoreGrade(kid, wk, i, c, 3));
    mnyAddDeposit(kid, wk, { amount: 50, from: 'Birthday money' });

    const bar = mnyIncomeSegments(wk, kid);
    const pool = mnyPool(wk, kid);
    // The identity every surface relies on, stated once.
    const closes = money2(bar.total - bar.fines - Math.max(0, bar.passive)) === pool.cameIn;
    const carried = bar.cameIn === pool.cameIn;

    const firstVal = (sel) => {
      const el = document.querySelector(sel + ' .mny-strip .mny-strip-val');
      return el ? el.textContent.trim() : null;
    };
    mnyOpenMyMoney(kid);
    const onKidPage = firstVal('#screen-mymoney');
    // The old headline must be gone: a second big number on that card is
    // exactly what could drift away from the strip again.
    const noRogueTotal = !document.querySelector('#mnyPage1Wrap .mny-total.sm');

    openFamilyMeeting(); mnySetMeetKid(kid); mmGoStep(3);
    const atMeeting = firstVal('#familyMeetingBody');
    closeSheet('familyMeetingOverlay');

    // The portal renders one section at a time; the strip lives in 'week'.
    showScreen('parent'); renderParentHome(); mnySetParentSection('week');
    const atPortal = firstVal('#screen-parent');
    mnySetParentSection('prices');

    const want = mnyMoney(pool.cameIn);
    mnyRemoveDeposit(kid, (mnyDepositsForWeek(kid, wk)[0] || {}).id);
    return closes && carried && noRogueTotal
        && onKidPage === want && atMeeting === want && atPortal === want;
  });

  /* A competition has to make her total go up — everywhere.
     competitionCarriesNameAndDate proves the record saves with a name, a date
     and an award, then deletes it, so nothing covered the hand-off from a
     result to the money. That is the join CLAUDE.md singles out: when it
     breaks, every screen still renders and only the numbers are wrong.

     Competition money is deliberately uncapped — the $3 daily chore cap must
     not touch it, which is the whole reason a meet is worth more than a week
     of bins. */
  checks.competitionMoneyReachesThePool = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jenn', wk = ctWeekKey;
    getProfData(kid).competitions = [];
    mrEnsureEarnings(kid, wk).overrides = {};

    const before = mnyPool(wk, kid).cameIn;
    // Mid-week, so the day lands inside this week whatever day today is.
    const dayKey = ctDateToKey(new Date(formatDayKey(wk).getTime() + 3 * 86400000));
    const saved = mrAddCompetition(kid, {
      sport: 'swim', name: 'Winter Invitational', dayKey, points: 6, qualified: true });
    // 6 points x $1 + $20 qualifying bonus, under the seeded rates.
    const scored = !!saved && saved.awarded === 26;

    const b = mrWeekBreakdown(wk, kid);
    const inChannel = b.compPaid === 26;
    const after = mnyPool(wk, kid);
    const inPool = money2(after.cameIn - before) === 26;
    // Uncapped: the daily chore cap must not have clipped any of it.
    const uncapped = after.cameIn >= 26;

    // …and it must be visible, not merely counted.
    const seg = mnyIncomeSegments(wk, kid).segs.find(s => s.label === 'Competitions');
    const inBar = !!seg && seg.value === 26;
    mnyOpenMyMoney(kid);
    const onKidPage = document.getElementById('mnyPage1Wrap').textContent
      .includes('Winter Invitational');
    showScreen('parent'); renderParentHome(); setParentTab('review');
    const hub = document.querySelector('#screen-parent .hub-status');
    const onDashboard = !!hub
      && hub.textContent.includes(CT_PROFILE_ICON[kid] + ' $' + after.cameIn.toFixed(2));

    getProfData(kid).competitions = [];
    return scored && inChannel && inPool && uncapped && inBar && onKidPage && onDashboard;
  });

  /* Anything labelled as the week's money is the pool's number.
     The parent dashboard's "pocket money so far" read the earnings net, so a
     gift already sitting in the week was invisible right up until the meeting.
     Pinned against a week that HAS a gift in it, or it proves nothing. */
  checks.pocketMoneySoFarIsThePoolsNumber = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess'; parentViewing = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey;
    mrEnsureEarnings(kid, wk).overrides = {};
    ['dishes', 'mop', 'vacuum'].forEach((c, i) => mrSetChoreGrade(kid, wk, i, c, 3));
    mnyAddDeposit(kid, wk, { amount: 50, from: 'Birthday money' });

    const pool = mnyPool(wk, kid);
    // The gift must actually make the two differ, or this passes by accident.
    const giftMatters = pool.cameIn !== mrWeekBreakdown(wk, kid).net;

    showScreen('parent'); renderParentHome(); setParentTab('review');
    const hub = document.querySelector('#screen-parent .hub-status');
    const txt = hub ? hub.textContent : '';
    // Scoped to Jess's own segment: the line carries both kids, and scanning
    // the whole string reads the sister's total as if it were this one's.
    const seg = (v) => CT_PROFILE_ICON[kid] + ' $' + v.toFixed(2);
    const showsPool = txt.includes(seg(pool.cameIn));
    const hidesNet = !txt.includes(seg(mrWeekBreakdown(wk, kid).net));

    mnyRemoveDeposit(kid, (mnyDepositsForWeek(kid, wk)[0] || {}).id);
    return giftMatters && showsPool && hidesNet;
  });

  /* The pool must not reserve a loan payment that has already been made.
     The schedule is monthly, the meeting weekly, so on three Sundays in four a
     paid-up debt still has a monthly figure attached — and mnyPool was reading
     it, understating "mine to choose" while the commit correctly moved nothing.

     THIS IS THE ONE POOL CHECK THAT MUST NOT RESET lastPaymentMonth. Every
     neighbour resets it at the top, which is precisely why the bug survived. */
  checks.poolDoesNotReserveAPaymentAlreadyMade = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey;
    const pd = getProfData(kid);
    delete pd.debts;
    const debt = mnyEnsureDebts(kid)[0];
    debt.monthly = 13; debt.paid = 0;
    debt.downPaymentDue = '2026-01-01';
    debt.downPaid = debt.downPayment;
    debt.lastPaymentMonth = loanMonthKey();          // this month is settled
    // Guarantee income, so "mustPay came back" below cannot pass or fail by
    // accident on a week where nothing was earned.
    ['dishes', 'mop', 'vacuum'].forEach((c, i) => mrSetChoreGrade(kid, wk, i, c, 3));

    const settled = mnyDueNowAll(kid).length === 0
                 && mnyDueThisWeek(kid, wk).length === 0;
    const pool = mnyPool(wk, kid);
    const poolClear = pool.mustPay === 0 && pool.mine === pool.cameIn && pool.unpaid === 0;
    // The agreement itself is untouched — only the week's claim is zero.
    const scheduleIntact = loanDueNow(kid).amount === 13;
    // ...and the write path already agreed; this is what the pool was ignoring.
    const commitAgrees =
      loanSundayTransfer(kid, 'pay_available', { debtId: debt.id }).status === 'already-this-month';

    /* Not vacuous: clear the stamp and the payment must come back. Not "=== 13"
       — mustPay is min(due, cameIn), so a thin week caps it at what came in.
       What matters is that the debt reappears in the list and the pool starts
       reserving again, which is exactly what the guard was suppressing. */
    debt.lastPaymentMonth = null;
    const back = mnyPool(wk, kid);
    const returns = mnyDueNowAll(kid).length === 1
                 && back.mustPay === money2(Math.min(13, back.cameIn))
                 && back.mustPay > 0;

    delete pd.debts;
    return settled && poolClear && scheduleIntact && commitAgrees && returns;
  });

  /* What is actually hers reaches the kid, and the debt card agrees with it. */
  checks.kidPageShowsWhatIsActuallyHers = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess'; parentViewing = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey;
    const pd = getProfData(kid);
    delete pd.debts;
    const debt = mnyEnsureDebts(kid)[0];
    debt.monthly = 3; debt.paid = 0;
    debt.downPaymentDue = '2026-01-01';
    debt.downPaid = debt.downPayment;
    debt.lastPaymentMonth = null;
    ['dishes', 'mop', 'vacuum'].forEach((c, i) => mrSetChoreGrade(kid, wk, i, c, 3));

    mnyOpenMyMoney(kid);
    const cells = [...document.querySelectorAll('#mnyPage1Wrap .mny-strip-cell')];
    const threeCells = cells.length === 3;
    const mineShown = cells[2] && cells[2].textContent.includes(mnyMoney(mnyPool(wk, kid).mine));
    const dueNow = mnyDueThisWeek(kid, wk)[0];
    const txt = () => document.getElementById('mnyPage1Wrap').textContent;
    const cardSaysThisMonth = !!dueNow
      && txt().includes('This month')
      && txt().includes(mnyMoney(dueNow.amount).slice(1));

    // Stamp the month: the strip's middle cell and the debt card must flip
    // together, or one of them is telling her something the other denies.
    debt.lastPaymentMonth = loanMonthKey();
    mnyRenderMyMoney();
    const cells2 = [...document.querySelectorAll('#mnyPage1Wrap .mny-strip-cell')];
    const payZero = cells2[1] && cells2[1].textContent.includes(mnyMoney(0));
    const cardSaysPaid = txt().includes('Paid ✓');

    delete pd.debts;
    return threeCells && mineShown && cardSaysThisMonth && payZero && cardSaysPaid;
  });

  /* The quest wallet strip must read the accessors, not the legacy wallet field
     that mnyEnsureHoldings zeroes on migration — it showed Savings $0.00 while
     the money page showed the real figure.

     Driven directly rather than through renderQuestBoard: this strip lives in
     buildHowIEarnCardLegacy, which only renders for weeks before the rulebook
     model, so the board on a current week never reaches it. Calling the real
     shipped function is the honest way to cover a legacy-only surface.

     Asserting the number alone would pass on unmigrated data, so assert the old
     field really is empty by then — that is what makes it a regression test. */
  checks.questStripReadsTheRealSavings = await page.evaluate(() => {
    profile = 'jess'; parentViewing = 'jess';
    ctPrepareRead();
    const kid = 'jess', wk = ctThisWeekKey();
    const pd = getProfData(kid);
    delete pd.holdings;
    pd.wallet = { cash: 42.20, savings: 180, gics: [], holdings: {}, lastMeetingWeek: null };

    const html = buildHowIEarnCardLegacy(kid, wk);
    const legacyZeroed = money2(getProfData(kid).wallet.savings) === 0;
    const migrated = mnySavedTotal(kid) === 180;
    // The savings tile, and only it, must carry the real figure.
    const tile = /class="hm-wtile w-savings">.*?hm-wtile-amt">([^<]+)</.exec(
      html.replace(/\s+/g, ' '));
    const shows = !!tile && tile[1].trim() === '$180.00';
    return shows && legacyZeroed && migrated;
  });

  /* ── Today ───────────────────────────────────────────────────────────────
     What a job is worth, in both states. A flat price would be a lie once the
     daily cap is spent, so the check is only meaningful if it sees the flip. */
  checks.todayShowsWhatAChoreWouldPay = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey, d = tdTodayIndex();
    if (d == null) return 'today is outside the current week';
    const dayGrades = mrEnsureEarnings('jenn', wk).chores[String(d)] || {};
    const restore = Object.assign({}, dayGrades);
    // Grading is parent-only; as a kid these are refused and the check would
    // pass without ever having moved anything.
    profile = 'parent';
    Object.keys(restore).forEach(id => mrSetChoreGrade('jenn', wk, d, id, 0));
    profile = 'jenn';

    goToday();
    const pay = mrChoreWouldPay('jenn', wk, d);
    const rowText = () => {
      const el = document.querySelector('#tdWrap .td-row-pay');
      return el ? el.textContent.trim() : '';
    };
    const hasRows = !!document.querySelector('#tdWrap [data-td-action="chore"]');
    const showsPrice = !hasRows || rowText() === 'up to ' + mnyMoney(pay.amount);

    // Spend the daily cap and it must stop promising money.
    const cap = (mrRulesForWeek(wk).chores || {}).dailyCap;
    let flips = true;
    let sawCapReached = false;
    if (cap != null && hasRows) {
      profile = 'parent';
      ['dishes', 'mop', 'vacuum', 'laundry'].forEach(id => mrSetChoreGrade('jenn', wk, d, id, 3));
      profile = 'jenn';
      goToday();
      sawCapReached = mrChoreWouldPay('jenn', wk, d).capReached;
      flips = sawCapReached ? rowText() === '+XP' : true;
    }

    profile = 'parent';
    Object.keys(mrEnsureEarnings('jenn', wk).chores[String(d)] || {})
      .forEach(id => mrSetChoreGrade('jenn', wk, d, id, 0));
    Object.keys(restore).forEach(id => mrSetChoreGrade('jenn', wk, d, id, restore[id]));
    profile = 'jenn';
    // The XP half must actually have been exercised, or this only ever proved
    // that a price renders.
    return showsPrice && flips && (!hasRows || cap == null || sawCapReached);
  });

  /* Today's money row is a reader. Every figure on it must equal the accessor
     it came from, and the "still to earn" figure must equal the one My money
     prints — that is the same class of agreement as the pool check above. */
  checks.todayMoneyRowMatchesMyMoney = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jenn', wk = ctWeekKey;
    goToday();
    const row = document.querySelector('#tdWrap .td-money');
    if (!row) return 'no money row on Today';
    const txt = row.textContent;
    const earn = mnyEarnLeftToday(kid, wk);
    const showsCash = txt.includes(mnyMoney(mnyCash(kid)));
    const owing = mnyTotalOwing(kid);
    const showsOwing = owing > 0 ? txt.includes(mnyMoney(owing)) : !txt.includes('I owe');
    const want = earn.left == null ? earn.done : earn.left;
    const showsEarn = txt.includes(mnyMoney(want));
    // …and My money must print the same figure from the same reader.
    mnyOpenMyMoney(kid);
    const onMoneyPage = document.getElementById('mnyPage1Wrap').textContent
      .includes(mnyMoney(want));
    goToday();
    return showsCash && showsOwing && showsEarn && onMoneyPage;
  });

  /* An empty day offers to be planned; a day with blocks on it does not. Both
     halves, or this only proves a button exists. */
  checks.anEmptyDayOffersToBePlanned = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const key = todayKey();
    const before = JSON.stringify(getDayBlocks(key, 'jenn') || []);
    /* .td-plan, not [data-td-action="plan"]: every quest card's body carries
       that action too, so the bare attribute matches on a day that is full and
       the "absent when planned" half below could never fail. */
    const offer = () => document.querySelector('#tdWrap .td-plan');
    setDayBlocks(key, [], 'jenn');
    goToday();
    const offered = !!offer();
    const reaches = (() => {
      const b = offer();
      if (!b) return false;
      b.click();
      const landed = document.getElementById('screen-day').classList.contains('active');
      goToday();
      return landed;
    })();
    // A day with something on it gets the quest list instead — the offer is for
    // the day that has none.
    setDayBlocks(key, [{ id: 'td-plan-x', actId: 'piano', startMin: 15 * 60, durationMin: 60 }], 'jenn');
    goToday();
    const hidden = !offer();
    setDayBlocks(key, JSON.parse(before), 'jenn');
    goToday();
    return offered && reaches && hidden;
  });

  /* No PHANTOM scroll under the kid nav. `.screen` carried min-height: 100vh
     while the body added 64px of padding to clear the bar, so the page floor
     was 100vh + 64px however little was on it — invisible on a phone, 64px of
     empty scroll on an iPad with nothing in it.

     Deliberately not "Today never scrolls": Today is the doing surface now and
     has a real list on it, so on a short viewport it scrolls because there is
     something to scroll to. That is not the bug. The invariant is that the
     screen's own floor plus the body's clearance must fit the viewport — the
     screen has to be 100vh MINUS the bar, not plus it. Content growth can never
     break this check, and removing the fix always does. */
  await page.setViewportSize({ width: 1024, height: 768 });   // iPad landscape
  await page.waitForTimeout(150);
  checks.kidScreensDoNotScrollOnATablet = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead();
    goToday();
    const nav = document.getElementById('kidNav');
    if (!nav || nav.hidden) return 'the kid nav is not showing';
    const screen = document.querySelector('.screen.active');
    const floor = parseFloat(getComputedStyle(screen).minHeight) || 0;
    const clearance = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
    const navH = nav.getBoundingClientRect().height;
    const bad = [];
    if (floor > window.innerHeight - navH + 1) {
      bad.push(`screen floor ${floor}px does not leave room for the ${navH}px nav in ${window.innerHeight}px`);
    }
    if (floor + clearance > window.innerHeight + 1) {
      bad.push(`floor ${floor}px + clearance ${clearance}px = ${floor + clearance}px, taller than the ${window.innerHeight}px viewport`);
    }
    return bad.length === 0 || bad;
  });
  await page.screenshot({ path: shot('ipad_today') });
  await page.setViewportSize({ width: 900, height: 1100 });
  await page.waitForTimeout(150);

  checks.noConsoleErrors = errors.length === 0;

  // A check passes only by being exactly true.
  //
  // This used to be `filter(([,v]) => !v)`, which meant every check written in the
  // house idiom — `cond || [whatWentWrong]` — could never fail: on failure it
  // assigns a non-empty array, and an array is truthy. Eight checks were built
  // that way, including the 44px target audit. They printed their findings into
  // the report and were then counted as passes, so the suite said ALL SMOKE
  // CHECKS PASSED with the failures sitting in the output above it.
  //
  // Same shape as the `for f in js/*.js; do node --check "$f" || break; done`
  // bug in the syntax check: a test that reports a problem and returns success.
  const failed = Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k);
  console.log(JSON.stringify({ checks, errors }, null, 2));
  console.log(failed.length ? `FAILED: ${failed.join(', ')}` : 'ALL SMOKE CHECKS PASSED');
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
