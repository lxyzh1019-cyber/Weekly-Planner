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
  /* Run the browser in the family's timezone, not the runner's.

     The app is inconsistent about zones, and only this pin hides it: todayKey()
     goes through toDayKeyInZone (js/05-helpers.js:809, fixed to America/Edmonton)
     while getDayKeys, dateToLocalKey and tdNowMin all read the machine's local
     clock. On the iPad and the phone those agree, so nothing shows. On a UTC
     runner they diverge for the six hours after Edmonton's 18:00, and the checks
     that pin a wall-clock hour then write to one day key and read back from the
     next — the blocks simply vanish. todayNamesFreeTime is where it lands first,
     dereferencing a free-time card that was never rendered.

     That made the suite pass or fail by the hour of day it happened to run, both
     here and on the nightly CI schedule. Pinning the context zone makes every
     run reproduce the devices the app is actually used on. */
  const page = await browser.newPage({
    viewport: { width: 900, height: 1100 },
    timezoneId: 'America/Edmonton',
  });
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
    // Template and band cannot disagree: both come from schoolHours(), which is
    // a function precisely so a parent's setting reaches both.
    const tpl = schoolTemplate().find(b => b.actId === 'school_day');
    if (!tpl || tpl.startMin !== schoolHours().startMin
             || tpl.durationMin !== schoolHours().endMin - schoolHours().startMin)
      bad.push('the school-day template no longer derives from schoolHours()');

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
    if (!school.some(l => /School/i.test(l))) bad.push(`no school band on a term Tuesday: ${school.join(' / ')}`);
    openDay('2026-12-25', 4);                       // Christmas Day
    const holiday = labels();
    if (!holiday.some(l => /Free time/i.test(l))) bad.push(`Christmas Day did not read as free: ${holiday.join(' / ')}`);
    if (holiday.some(l => /School/i.test(l))) bad.push(`Christmas Day claimed a school band: ${holiday.join(' / ')}`);
    openDay('2027-07-14', 2);                       // mid-summer
    const summer = labels();
    if (!summer.some(l => /Free time/i.test(l))) bad.push(`a July day did not read as free: ${summer.join(' / ')}`);

    /* The labels used to be set sideways, so a band's height was the line
       length its text had to fit into — and "BEFORE SCHOOL" wanted ~171px in
       the 166px an 8am start leaves, so it clipped. They are painted as the
       day's background now and read left to right, so the constraint is width,
       not height. Measure the text against its box either way: overflow:hidden
       means a clipped label still reports a tidy scrollHeight. */
    openDay('2026-09-08', 1);
    [...document.querySelectorAll('#screen-day .tl-band-seg')].forEach(el => {
      const lab = el.querySelector('.tl-band-label');
      if (!lab) return;                       // too short for a label at all — by design
      const r = document.createRange(); r.selectNodeContents(lab);
      const rect = r.getBoundingClientRect(), box = el.getBoundingClientRect();
      if (rect.height > box.height + 1) bad.push(`band "${lab.textContent}" needs ${Math.round(rect.height)}px in ${Math.round(box.height)}px`);
      if (rect.width > box.width + 1) bad.push(`band "${lab.textContent}" needs ${Math.round(rect.width)}px of width in ${Math.round(box.width)}px`);
    });
    // The bands are the day's background: they must never eat a tap meant for
    // the canvas underneath them.
    const seg = document.querySelector('#screen-day .tl-band-seg');
    if (seg && getComputedStyle(seg).pointerEvents !== 'none') bad.push('a zone band is intercepting taps');
    return bad.length === 0 || bad;
  });

  /* THE WEEK TWIN of dayBandsFollowTheCalendar. The day view has been
     calendar-driven for a long time; the two week layouts and the print sheet
     were not. Day Blocks — the layout the week actually opens on — showed
     nothing school-related at all, so a school day and a Sunday were the same
     white lane. Full week and print each carried their own hardcoded 9am–3pm
     bands chosen by `dow === 0 || dow === 6`, so they disagreed with the rest of
     the app by an hour AND drew "🏫 School" on Christmas Day, on a PD day, and
     on every day of July. */
  checks.everyWeekViewFollowsTheSchoolCalendar = await page.evaluate(() => {
    const bad = [];
    const wasOffset = weekOffset, wasView = weekView;
    const startPx = (el) => parseFloat(el.style.top) || 0;

    // A week inside the term, and a week that is nothing but holiday.
    const termWeek = (() => {
      for (let w = -20; w <= 40; w++) if (getDayKeys(w).some(k => isSchoolDay(k))) return w;
      return null;
    })();
    if (termWeek == null) { bad.push('no week in range has a school day'); return bad; }

    weekOffset = termWeek;
    const keys = getDayKeys(termWeek);
    const schoolKey = keys.find(k => isSchoolDay(k));
    const idx = keys.indexOf(schoolKey);
    const offKey = keys.find(k => !isSchoolDay(k));
    const offIdx = keys.indexOf(offKey);
    const wantStart = dayZoneSegments(schoolKey).find(b => b.label === '🏫 School').start;

    // Day Blocks — the default layout.
    goWeek(); setWeekView('timegrid'); renderWeek();
    const lanes = document.querySelectorAll('.tg2-lane');
    const schoolBand = lanes[idx] && lanes[idx].querySelector('.wf-band-school');
    if (!schoolBand) bad.push('Day Blocks draws no school band on a term school day');
    if (offIdx >= 0 && lanes[offIdx] && lanes[offIdx].querySelector('.wf-band-school')) {
      bad.push('Day Blocks draws a school band on a day the calendar says is not school');
    }

    // Full week.
    setWeekView('full'); renderWeek();
    const cols = document.querySelectorAll('.wf-day-col');
    const wfBand = cols[idx] && cols[idx].querySelector('.wf-band-school');
    if (!wfBand) bad.push('the Full week draws no school band on a term school day');
    if (offIdx >= 0 && cols[offIdx] && cols[offIdx].querySelector('.wf-band-school')) {
      bad.push('the Full week draws a school band on a day that is not school');
    }
    /* The hour, not just the presence of a band: 9am-vs-8am is exactly the
       disagreement this replaced, and a band drawn at the wrong time still
       looks like a band. */
    if (wfBand) {
      const gotMin = Math.round(startPx(wfBand) / 0.72);
      if (Math.abs(gotMin - wantStart) > 1) {
        bad.push(`the Full week starts school at minute ${gotMin}, the calendar says ${wantStart}`);
      }
    }

    // Print.
    openPrint();
    const printLabels = [...document.querySelectorAll('.print-band-label')].map(e => e.textContent);
    if (!printLabels.some(t => /School/.test(t))) bad.push('the print sheet lost its school band');
    goWeek();

    /* And a week with no school in it anywhere — the July case. Nothing may
       claim school on any of the three. */
    const summerWeek = (() => {
      for (let w = 0; w <= 60; w++) if (getDayKeys(w).every(k => !isSchoolDay(k))) return w;
      return null;
    })();
    if (summerWeek != null) {
      weekOffset = summerWeek;
      setWeekView('timegrid'); renderWeek();
      if (document.querySelector('.tg2-lane .wf-band-school')) {
        bad.push('Day Blocks draws school in a week with no school in it');
      }
      setWeekView('full'); renderWeek();
      if (document.querySelector('.wf-day-col .wf-band-school')) {
        bad.push('the Full week draws school in a week with no school in it');
      }
      if (document.querySelector('.wf-sideband .wf-band-school')) {
        bad.push('the axis describes a school day in a week that has none');
      }
    }

    weekOffset = wasOffset; setWeekView(wasView); renderWeek();
    return bad.length === 0 || bad;
  });

  /* SCHOOL HOURS ARE THE PARENT'S TO SET. They were a const in js/01-config.js,
     which meant a district's bell times could only be corrected by editing the
     source — and the shipped calendar never knew about lunch recess at all.
     SCHOOL_TEMPLATE had to become schoolTemplate() for this: a const evaluated
     at load can only ever see the shipped fallback. */
  checks.schoolHoursAreTheParentsToSet = await page.evaluate(() => {
    const bad = [];
    const before = state.shared.schoolCal;
    const shipped = schoolHours();
    if (shipped.startMin !== SCHOOL_HOURS.startMin) bad.push('with nothing set, the shipped hours are not used');

    state.shared.schoolCal = { hours: { startMin: 150, endMin: 555, lunchStartMin: 330, lunchMin: 45 } };
    const h = schoolHours();
    if (h.startMin !== 150 || h.endMin !== 555) bad.push("the parent's hours are not what the app reads");
    const tpl = schoolTemplate().find(t => t.actId === 'school_day');
    if (!tpl || tpl.startMin !== 150 || tpl.durationMin !== 405) {
      bad.push('the School Day template did not follow the hours');
    }
    const termKey = (() => {
      for (let w = -20; w <= 40; w++) { const k = getDayKeys(w).find(isSchoolDay); if (k) return k; }
      return null;
    })();
    const segs = dayZoneSegments(termKey);
    const lunch = segs.find(b => b.label === '🥪 Lunch recess');
    if (!lunch) bad.push('a lunch recess was set and no band drew it');
    else if (lunch.start !== 330 || lunch.end !== 375) bad.push('the lunch band is not where it was set');
    if (segs.filter(b => b.label === '🏫 School').length !== 2) {
      bad.push('lunch does not split the school day in two');
    }

    // A recess that does not fit inside the day is dropped, not drawn hanging
    // off the end of the afternoon.
    state.shared.schoolCal = { hours: { startMin: 150, endMin: 555, lunchStartMin: 540, lunchMin: 45 } };
    if (schoolHours().lunchMin !== 0) bad.push('a lunch recess running past home time was kept');

    // Term dates too.
    state.shared.schoolCal = { termStart: '2030-01-07', termEnd: '2030-06-20', nextStart: '2030-08-26' };
    if (schoolTerm().start !== '2030-01-07') bad.push("the parent's term start is not what the app reads");
    if (isSchoolDay('2026-09-08')) bad.push('a date outside the set term still counts as school');

    // And clearing it returns to the shipped calendar rather than a frozen copy,
    // so next August's replacement reaches the family with nothing to press.
    delete state.shared.schoolCal;
    if (schoolHours().startMin !== SCHOOL_HOURS.startMin) bad.push('clearing the override did not restore the shipped hours');
    if (schoolTerm().start !== SCHOOL_TERM.start) bad.push('clearing the override did not restore the shipped term');

    state.shared.schoolCal = before;
    return bad.length === 0 || bad;
  });

  /* AN IMPORTED CALENDAR CHANGES NOTHING UNTIL IT IS REVIEWED. A file that
     silently marked twelve days as no-school is how a family comes to believe a
     term is set up when it is wrong, so every date the parser produces goes
     into a preview with a tick beside it — the same discipline pcwPlan keeps
     for copying a week.

     The fixture carries the cases that actually bite: a folded SUMMARY line, an
     escaped comma, an all-day span whose DTEND is exclusive, a fortnightly
     RRULE, an RRULE this deliberately does not understand, and a statutory
     holiday whose name contains none of the day-off keywords. */
  checks.anIcsFileBecomesDaysOffOnlyAfterReview = await page.evaluate(() => {
    const bad = [];
    const wasCal = state.shared.schoolCal;
    const wasProfile = profile, wasViewing = parentViewing;
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0',
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20260831', 'SUMMARY:First Day of School', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261221', 'DTEND;VALUE=DATE:20261225', 'SUMMARY:Winter Break', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261225', 'DTEND;VALUE=DATE:20261226', 'SUMMARY:Christmas Day', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261015', 'SUMMARY:Picture Day', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20260918', 'SUMMARY:Staff Professional Develop', ' ment Day', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20270625', 'SUMMARY:Last Day of School', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART:20260908T160000', 'DTEND:20260908T170000', 'SUMMARY:Physio\\, left knee',
        'RRULE:FREQ=WEEKLY;BYDAY=TU;INTERVAL=2;COUNT=3', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART:20261001T090000', 'SUMMARY:Monthly thing', 'RRULE:FREQ=MONTHLY;COUNT=4', 'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    state.shared.schoolCal = {};
    const d = scBuildDraft(ics, 'test');

    // Parsing writes nothing.
    if (Object.keys(state.shared.schoolCal).length) bad.push('parsing the file changed the calendar');

    const off = d.offDays.map(o => o.date);
    // Winter Break's DTEND is exclusive: 21st through 24th, not the 25th.
    ['2026-12-21', '2026-12-22', '2026-12-23', '2026-12-24'].forEach(k => {
      if (!off.includes(k)) bad.push(`the all-day span dropped ${k}`);
    });
    const brk = d.offDays.filter(o => o.label === 'Winter Break');
    if (brk.length !== 4) bad.push(`the break expanded to ${brk.length} days, expected 4`);
    // A folded line is one summary, not two.
    if (!d.offDays.some(o => o.label === 'Staff Professional Development Day')) {
      bad.push('a folded SUMMARY was not rejoined');
    }
    /* Every all-day entry is listed, ticked or not: a keyword list cannot be
       complete, and "Christmas Day" contains none of the words. */
    if (!off.includes('2026-12-25')) bad.push('Christmas Day was not even offered');
    if (!off.includes('2026-10-15')) bad.push('an all-day entry that is not a day off was hidden rather than shown unticked');
    const tick = (date) => (d.offDays.find(o => o.date === date) || {}).on;
    if (!tick('2026-12-25')) bad.push('Christmas Day arrived unticked');
    if (!tick('2026-09-18')) bad.push('a staff day arrived unticked');
    if (tick('2026-10-15')) bad.push('Picture Day arrived ticked — that is a school day');

    // Term dates are proposed from the file's own naming, and NOT taken by default.
    if (d.termStart !== '2026-08-31' || d.termEnd !== '2027-06-25') {
      bad.push(`term read as ${d.termStart}..${d.termEnd}`);
    }
    if (d.takeTerm) bad.push('the term dates were ticked by default — that is a year-long guess');

    // Timed events: a fortnightly Tuesday, three times, with the escape undone.
    const phys = d.timed.filter(e => e.summary === 'Physio, left knee');
    if (phys.length !== 3) bad.push(`the fortnightly rule expanded to ${phys.length}, expected 3`);
    if (phys[0] && phys[0].startMin !== 16 * 60) bad.push('a timed event lost its start time');
    if (phys[0] && phys[0].durationMin !== 60) bad.push('a timed event lost its length');
    if (phys[1] && phys[1].dayKey !== '2026-09-22') bad.push(`INTERVAL=2 landed on ${phys[1].dayKey}`);
    // And a rule it does not understand is counted, not half-applied.
    if (d.skipped !== 1) bad.push(`${d.skipped} events reported skipped, expected the 1 monthly rule`);
    if (d.timed.some(e => e.summary === 'Monthly thing')) bad.push('a rule it cannot read was expanded anyway');

    // Committing takes the ticked rows only.
    profile = 'parent'; parentViewing = 'jenn';
    scDraft = d;
    d.offDays.forEach(o => { o.on = (o.date === '2026-12-25'); });
    scCommitSchool();
    const saved = (state.shared.schoolCal.offDays || []).map(x => x.date);
    if (saved.join(',') !== '2026-12-25') bad.push(`committed ${saved.length} days, expected only the ticked one`);
    if (state.shared.schoolCal.termStart) bad.push('an unticked term was written anyway');
    if (!isSchoolDay('2026-10-15')) bad.push('an unticked day off took effect');

    // Timed events land as blocks on the chosen child, once.
    const restore = [];
    ['2026-09-08', '2026-09-22', '2026-10-06'].forEach(k => {
      restore.push([k, getDayBlocksForProfile(k, 'jenn')]);
      setDayBlocks(k, [], 'jenn');
    });
    scDraft = scBuildDraft(ics, 'test');
    scBlockKid = 'jenn'; scBlockActId = 'piano';
    scCommitBlocks();
    const landed = getDayBlocksForProfile('2026-09-08', 'jenn') || [];
    if (landed.length !== 1) bad.push(`${landed.length} blocks landed on the first physio day`);
    else {
      if (landed[0].actId !== 'piano') bad.push('the block is not the chosen activity');
      if (landed[0].startMin !== 16 * 60) bad.push('the block did not take the event time');
      if (!/Physio/.test(landed[0].note || '')) bad.push('the block lost what the event was called');
    }
    // Importing the same file twice must not double it up.
    scDraft = scBuildDraft(ics, 'test');
    scCommitBlocks();
    if ((getDayBlocksForProfile('2026-09-08', 'jenn') || []).length !== 1) {
      bad.push('a second import of the same calendar doubled the appointment');
    }

    restore.forEach(([k, b]) => setDayBlocks(k, b, 'jenn'));
    scDraft = null;
    state.shared.schoolCal = wasCal;
    profile = wasProfile; parentViewing = wasViewing;
    return bad.length === 0 || bad;
  });

  /* SCHOOL DAYS ARE OFFERED, NOT ASSUMED. The calendar knows which days of a
     week are school days; what it must not do is quietly fill them in, because
     a week that arrived pre-planned is a week nobody decided. And only near the
     front: a term is 40-odd weeks, and materialising all of it would write
     hundreds of blocks into a document that uploads whole on every change, to
     describe a Tuesday in May nobody is planning yet. */
  checks.aBlankWeekOffersItsSchoolDays = await page.evaluate(async () => {
    const bad = [];
    const wasOffset = weekOffset, wasProfile = profile;
    profile = 'jenn';
    // The first week in the horizon that has school days in it.
    let wk = null;
    for (let w = 0; w < SCHOOL_FILL_HORIZON_WEEKS; w++) {
      if (getDayKeys(w).some(k => isSchoolDay(k))) { wk = w; break; }
    }
    if (wk == null) { bad.push('no week inside the horizon has a school day'); return bad; }
    const keys = getDayKeys(wk);
    const restore = keys.map(k => [k, getDayBlocks(k, 'jenn')]);
    keys.forEach(k => setDayBlocks(k, [], 'jenn'));
    const schoolKeys = keys.filter(k => isSchoolDay(k));

    weekOffset = wk;
    goWeek(); renderWeek();
    const tip = (document.getElementById('weekCoachTip') || {}).textContent || '';
    if (!new RegExp(`Add ${schoolKeys.length} school day`).test(tip)) {
      bad.push(`a blank term week does not offer its ${schoolKeys.length} school days: "${tip.slice(0, 120)}"`);
    }

    // Nothing is written until it is confirmed.
    const p1 = addSchoolDaysToWeek(keys[0]);
    await new Promise(r => setTimeout(r, 30));
    const cancel = document.querySelector('.app-dialog-cancel');
    if (!cancel) bad.push('adding school days was not confirmed first');
    else cancel.click();
    await p1;
    if (keys.some(k => (getDayBlocks(k, 'jenn') || []).length)) {
      bad.push('declining the offer still wrote blocks');
    }

    const p2 = addSchoolDaysToWeek(keys[0]);
    await new Promise(r => setTimeout(r, 30));
    const ok = document.getElementById('appDialogOkBtn');
    if (ok) ok.click();
    await p2;
    const got = keys.filter(k => (getDayBlocks(k, 'jenn') || []).length);
    if (got.join(',') !== schoolKeys.join(',')) {
      bad.push(`blocks landed on ${got.length} days, the calendar names ${schoolKeys.length}`);
    }
    const h = schoolHours();
    const b = (getDayBlocks(schoolKeys[0], 'jenn') || [])[0] || {};
    if (b.actId !== 'school_day') bad.push('what landed is not a School Day block');
    if (b.startMin !== START_MIN + h.startMin) bad.push('the School Day does not start when school does');
    if (b.durationMin !== h.endMin - h.startMin) bad.push('the School Day is not as long as school');
    if (b.confirmed) bad.push('an offered School Day arrived pre-confirmed');

    // A day that already holds a plan is left alone.
    keys.forEach(k => setDayBlocks(k, [], 'jenn'));
    setDayBlocks(schoolKeys[0], [{ id: 'sd-keep', actId: 'piano', startMin: 600, durationMin: 60 }], 'jenn');
    const offer = schoolDaysToOffer(keys, 'jenn');
    if (offer.includes(schoolKeys[0])) bad.push('a day that already has a plan was offered anyway');

    // And a week months out is not offered at all.
    if (schoolOfferInHorizon(getDayKeys(SCHOOL_FILL_HORIZON_WEEKS + 6))) {
      bad.push('a week months away is still offered its school days');
    }

    restore.forEach(([k, blocks]) => setDayBlocks(k, blocks, 'jenn'));
    weekOffset = wasOffset; profile = wasProfile;
    goWeek(); renderWeek();
    return bad.length === 0 || bad;
  });

  /* Weekly view: Y-axis sideband + hour lines + slot tint bands. These belong to
     the Full layout, which is no longer the one the week opens on — Day Blocks
     is. So select it first rather than assuming: the alternate layout still has
     to work, and an assertion that silently measured whichever view happened to
     be default would stop testing anything the day the default moved. */
  /* The sideband is one axis describing seven days, so what matters is that it
     describes a real one. It used to be four hardcoded stretches with school at
     9am–3pm — an hour later than the rest of the app — drawn on every week of
     the year. Counting segments is what let that stand: it asserted 4 and got 4,
     on Christmas week as readily as on a term Tuesday. */
  checks.weekSideband = await page.evaluate(() => {
    const bad = [];
    setWeekView('full');
    const keys = getDayKeys(weekOffset);
    const axisKey = keys.find(k => isSchoolDay(k)) || null;
    const want = axisKey
      ? dayZoneSegments(axisKey)
      : [{ start: 0, end: DAY_MIN_SPAN, label: '🎉 Free time' }];
    const segs = [...document.querySelectorAll('.wf-sideband-seg')];
    if (segs.length !== want.length) {
      bad.push(`the axis draws ${segs.length} stretches for a day that has ${want.length}`);
    } else {
      want.forEach((w, i) => {
        if ((segs[i].title || '') !== w.label) {
          bad.push(`axis stretch ${i} says "${segs[i].title}", the day says "${w.label}"`);
        }
      });
    }
    return bad.length === 0 || bad;
  });
  checks.weekHourLines = await page.evaluate(() =>
    document.querySelectorAll('.wf-day-col .hour-grid-line--hour').length > 0);
  // Day Blocks renders once selected.
  checks.dayBlocksRenders = await page.evaluate(() => {
    setWeekView('timegrid');
    return document.querySelectorAll('.tg2-lane').length === 7 || ['no day lanes in Day Blocks'];
  });

  /* ONE TOPBAR ROW. The week selector and the controls that act on the week it
     names were split across two rows separated by a dashed rule, which cost
     about a third of an iPad's first screen before the plan itself began.
     Checked by geometry, not by markup: "they are in the same div" is satisfied
     by a div that wraps, and what matters is that they are on one line. */
  checks.weekTopbarIsOneRow = await page.evaluate(() => {
    goWeek(); renderWeek();
    const bad = [];
    if (document.querySelector('#screen-week .week-topbar__row2')) {
      bad.push('the second topbar row is back');
    }
    const label = document.getElementById('weekRangeLabel');
    const tabs  = document.querySelector('#screen-week .view-tabs');
    const print = document.querySelector('#screen-week .week-print-btn');
    if (!label || !tabs || !print) return ['week selector, view tabs or print button missing'];
    const mid = el => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
    // Same line, within a tolerance that allows for different control heights.
    if (Math.abs(mid(tabs) - mid(label)) > 30) bad.push('the view tabs are not on the week selector\'s row');
    if (Math.abs(mid(print) - mid(label)) > 30) bad.push('Print is not on the week selector\'s row');
    // And they sit to the RIGHT of it, which is what was asked for.
    if (tabs.getBoundingClientRect().left < label.getBoundingClientRect().right) {
      bad.push('the view tabs are not to the right of the week selector');
    }
    return bad.length === 0 || bad;
  });

  /* CONCLUSIONS COME AFTER THE THING THEY ARE ABOUT. "Longest free stretch" and
     the clash warning are both summaries of the grid, and both used to render
     above it — so a child was told what her week added up to before she could
     see the week. Document order, in both views. */
  checks.weekSummariesSitUnderThePlan = await page.evaluate(() => {
    const bad = [];
    const after = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    setWeekView('timegrid'); renderWeek();
    const grid = document.getElementById('tgGrid');
    if (!after(grid, document.getElementById('tgStreak'))) bad.push('the free-stretch line is still above the grid');
    if (!after(grid, document.getElementById('tgConflictBanner'))) bad.push('the clash banner is still above the grid');
    setWeekView('full'); renderWeek();
    if (!after(document.getElementById('weeklyFullGrid'), document.getElementById('weekConflictBanner'))) {
      bad.push('the Full view clash banner is still above the cards');
    }
    setWeekView('timegrid'); renderWeek();
    return bad.length === 0 || bad;
  });

  /* One scroll surface on Day Blocks, the same rule the day screen is held to.
     The grid was its own scroller inside a flex column, so the week had two: the
     grid, and the page carrying the glance and goals under it. A wheel over the
     grid moved the grid, reached its end, and stopped — overscroll-behavior:
     contain made sure nothing chained to the page — so the panels below could
     not be reached by scrolling over the grid at all. */
  checks.weekScrollsAsOneSurfaceOnDayBlocks = await page.evaluate(() => {
    setWeekView('timegrid'); renderWeek();
    const bad = [];
    const inner = [...document.querySelectorAll('#weekTimeGrid, #weekTimeGrid *')].filter(el => {
      const st = getComputedStyle(el);
      return /(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 4;
    });
    if (inner.length) bad.push(`nested scrollers under Day Blocks: ${inner.map(e => e.className || e.tagName).join(' | ')}`);
    const wrap = document.querySelector('.tg2-wrap');
    if (wrap && /contain/.test(getComputedStyle(wrap).overscrollBehaviorY)) {
      bad.push('the grid still refuses to chain its scroll to the page');
    }
    return bad.length === 0 || bad;
  });

  /* MIDDLE-BUTTON PANNING follows the cursor, and carries on past the grid.
     Two defects, one check. It panned like a hand tool — moving the mouse down
     scrolled UP — which is the opposite of the middle-click autoscroll a mouse
     user is asking for. And it only ever moved the element it was bound to, so
     once that element ran out there was nowhere left to go; pointerdown calls
     preventDefault, so the browser's own autoscroll was not there to take over
     either. Drives real pointer events rather than calling the handler. */
  checks.middleDragFollowsTheCursorAndChains = await page.evaluate(() => {
    goWeek(); setWeekView('timegrid'); renderWeek();
    const bad = [];
    const el = document.querySelector('.tg2-wrap');
    if (!el) return ['no Day Blocks wrap to pan'];
    const doc = document.scrollingElement || document.documentElement;
    if (doc.scrollHeight <= doc.clientHeight + 4) return ['the week does not scroll at all, so panning cannot be tested'];

    const send = (type, x, y, button) => el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 1, button, buttons: button === 1 ? 4 : 0,
      clientX: x, clientY: y,
    }));
    // Some engines have no real pointer capture on a detached run; the handler
    // guards it, but keep the check honest about what it drove.
    el.setPointerCapture = el.setPointerCapture || (() => {});
    el.releasePointerCapture = el.releasePointerCapture || (() => {});

    doc.scrollTop = 0;
    send('pointerdown', 400, 400, 1);
    send('pointermove', 400, 260, 1);      // cursor moves UP by 140
    send('pointerup',   400, 260, 1);
    const afterUp = doc.scrollTop;
    if (afterUp !== 0) bad.push(`moving the cursor up from the top scrolled to ${afterUp}, expected to stay at 0`);

    send('pointerdown', 400, 200, 1);
    send('pointermove', 400, 340, 1);      // cursor moves DOWN by 140
    send('pointerup',   400, 340, 1);
    const afterDown = doc.scrollTop;
    // Down means down, and it reached the page rather than dying in the grid.
    if (afterDown <= 0) bad.push(`moving the cursor down scrolled to ${afterDown}, expected the page to move down`);

    doc.scrollTop = 0;

    /* THE DAY SCREEN, which is where this was reported broken. The workspace is
       the scroller there, so a middle-drag must move IT and leave the document —
       and the topbar with it — exactly where it was. That is the whole of the
       bug: #screen-day was unbounded, the workspace could not scroll, and
       panLeftover handed the entire gesture to the page.

       Driven from a block as well as from open canvas, because the block's own
       pointerdown handlers used to stopPropagation unconditionally, so a drag
       that began two pixels inside a card did nothing at all. */
    // The Saturday the suite seeded a training block on, so the gear rows and
    // the training chip — the elements that used to swallow the press — exist.
    openDay(getDayKeys(0)[5], 5);
    const ws = document.querySelector('#screen-day .day-workspace');
    if (!ws) { bad.push('no day workspace to pan'); return bad; }
    if (ws.scrollHeight <= ws.clientHeight + 4) bad.push('the day workspace does not scroll, so nothing can pan it');
    ws.setPointerCapture = ws.setPointerCapture || (() => {});
    ws.releasePointerCapture = ws.releasePointerCapture || (() => {});
    /* pointerId 1, like the week drag above: Chrome treats the primary mouse
       pointer as active, so setPointerCapture inside the handler resolves
       instead of throwing an uncaught NotFoundError on a synthetic id. */
    const sendOn = (target, type, x, y, button) => target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 1, button, buttons: button === 1 ? 4 : 0,
      clientX: x, clientY: y,
    }));

    const from = (target, label) => {
      ws.scrollTop = 0;
      doc.scrollTop = 0;
      const r = ws.getBoundingClientRect();
      const x = r.left + r.width / 2;
      // Cursor moves DOWN, which is the direction the browser's own autoscroll
      // would take — the first version of attachMiddleDragPan had it inverted.
      sendOn(target, 'pointerdown', x, r.top + 180, 1);
      sendOn(target, 'pointermove', x, r.top + 320, 1);
      sendOn(target, 'pointerup',   x, r.top + 320, 1);
      if (ws.scrollTop <= 0) bad.push(`a middle-drag ${label} did not move the schedule`);
      if (doc.scrollTop > 1) bad.push(`a middle-drag ${label} scrolled the page instead of the schedule`);
      ws.scrollTop = 0;
    };
    from(ws, 'on open canvas');
    /* Specifically an element that stops pointerdown, not just any block:
       .block-gear-item and .block-train-chip called stopPropagation
       unconditionally, so a drag beginning two pixels inside a card did nothing
       while the same drag on open canvas panned the day. Asserted rather than
       skipped — falling back to a plain .placed-block would let this coverage
       lapse the moment the fixture changed. */
    const chip = document.querySelector('#timeline .block-train-chip')
              || document.querySelector('#timeline .block-gear-item');
    if (!chip) bad.push('no training chip or gear row on the seeded day — this case is untested');
    else from(chip, 'starting on a block');

    ws.scrollTop = 0;
    doc.scrollTop = 0;
    return bad.length === 0 || bad;
  });

  // Kid money surface: kids reach Pocket Money and may LOOK at the bank, but
  // every function that moves money refuses them.
  /* One label for one destination (audit P2-4). The Quest Board used to call it
     "My pocket money" while three other entry points called it "My money"; both
     the shortcut row and the board are gone, so this now checks the two routes
     that survive — the nav and Today's own money card — and that neither has
     picked the old wording back up. */
  checks.kidMoneyLabel = await page.evaluate(() => {
    const bad = [];
    profile = 'jenn'; goToday();
    const nav = document.querySelector('#kidNav [data-td-nav="money"]');
    if (!nav || !nav.textContent.includes('Money')) bad.push('the nav does not say Money');
    const card = document.querySelector('#tdWrap [data-td-action="money"]');
    if (!card) bad.push('Today has no money card');
    if (/pocket money/i.test(document.getElementById('screen-today').textContent)) {
      bad.push('"pocket money" wording is back on Today');
    }
    goWeek();
    return bad.length === 0 || bad;
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
    /* The activity rail used to be asserted here as a thing that must be
       present. It is gone: placement goes through the picker that opens where
       you tap, and the schedule has the width back. The assertion is now that
       neither the rail nor the pick-then-tap machinery comes back. */
    if (document.querySelector('.day-right-rail')) bad.push('the activity rail is back on the day screen');
    if (document.querySelector('#screen-day .activity-tray')) bad.push('the activity tray is back');
    if (typeof buildTray === 'function') bad.push('buildTray still exists');
    if (typeof setDayFocusPane === 'function') bad.push('setDayFocusPane still exists');
    if (document.querySelector('#screen-day .day-topbar__row2')) bad.push('the day topbar grew a second row again');
    return bad.length === 0 || bad;
  });

  /* One scroll surface. It used to be three nested ones — .day-workspace, then
     .day-center-lane, then .timeline-wrap — so on an iPad the schedule scrolled
     inside a box inside a page and a flick could move the wrong one. */
  checks.dayScreenScrollsAsOneSurface = await page.evaluate(() => {
    const bad = [];
    const scroller = el => {
      const st = getComputedStyle(el);
      return /(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 4;
    };
    const inner = [...document.querySelectorAll('#screen-day *')].filter(scroller);
    const notWorkspace = inner.filter(el => !el.classList.contains('day-workspace'));
    if (notWorkspace.length) {
      bad.push(`nested scrollers on the day screen: ${notWorkspace.map(e => e.className || e.tagName).join(' | ')}`);
    }
    return bad.length === 0 || bad;
  });

  /* The reported bug, as a check: a 30-minute block is 40px tall and used to
     take the two-line layout, which needs ~46px — so "Breakfast" rendered with
     its own title sliced in half. Measures the real box, at every length a
     short block actually gets used at. */
  checks.shortBlocksDoNotClipTheirName = await page.evaluate(() => {
    const bad = [];
    const key = getDayKeys(0)[4];
    const before = getDayBlocks(key, 'jenn');
    setDayBlocks(key, [15, 30, 45, 60].map((dur, i) => ({
      id: 'clip-' + dur, actId: 'breakfast', startMin: 7 * 60 + i * 120,
      durationMin: dur, objectives: [], note: '',
    })), 'jenn');
    openDay(key, 4);
    [15, 30, 45, 60].forEach(dur => {
      const el = document.getElementById('block-clip-' + dur);
      if (!el) { bad.push(`no block rendered for ${dur} min`); return; }
      if (el.scrollHeight > el.clientHeight + 1) {
        bad.push(`${dur}-min block clips its own content (${el.scrollHeight}px into ${el.clientHeight}px)`);
      }
      const name = el.querySelector('.block-name');
      if (name && name.scrollWidth > name.clientWidth + 1 && !name.textContent.trim()) {
        bad.push(`${dur}-min block has no readable name`);
      }
    });
    setDayBlocks(key, before, 'jenn');
    openDay(key, 4);
    return bad.length === 0 || bad;
  });

  /* Two and three days at once. The thing that must hold is that a tap in
     column 2 places into column 2's day — reading currentDayKey instead would
     drop every block onto whichever day the topbar happened to name, and a
     child has no way to see that happen. */
  // Wide enough for three columns to actually be offered — under ~1000px the
  // day view deliberately serves fewer, whatever the stored preference says.
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.waitForTimeout(150);
  checks.multiDayColumnsPlaceOnTheirOwnDay = await page.evaluate(() => {
    const bad = [];
    const keys = getDayKeys(0);
    const spanBefore = dayViewSpan();
    openDay(keys[0], 0);
    setDayViewSpan(3);
    const cols = [...document.querySelectorAll('#timeline .tl-col')];
    if (cols.length !== 3) bad.push(`asked for 3 columns, rendered ${cols.length}`);
    if (document.querySelectorAll('#timeline .tl-gutter').length !== 1) {
      bad.push('the hour ladder is drawn once per column instead of once');
    }
    if (cols[1] && cols[1].dataset.dayKey !== keys[1]) bad.push('column 2 is not the next day');
    // A tap in column 2 must target column 2's day.
    const canvas2 = cols[1] && cols[1].querySelector('.tl-canvas');
    if (!canvas2) bad.push('column 2 has no canvas');
    else {
      const r = canvas2.getBoundingClientRect();
      canvas2.dispatchEvent(new MouseEvent('click', { clientY: r.top + 140, clientX: r.left + 10, bubbles: true }));
      if (currentDayKey !== keys[1]) bad.push(`tapping column 2 left the edit target on ${currentDayKey}`);
      const title = (document.getElementById('slotPickerTitle') || {}).textContent || '';
      if (!/Tue/.test(title)) bad.push(`the picker does not name the day it will place on: "${title}"`);
      closeSheet('slotPickerOverlay');
    }
    setDayViewSpan(spanBefore);
    if (document.querySelectorAll('#timeline .tl-col').length !== 1) bad.push('going back to 1 day left extra columns');
    return bad.length === 0 || bad;
  });

  /* The hour ladder must name the line it sits beside. It did not: .tl-col-head
     lived inside .tl-col and pushed .tl-canvas down, while .tl-gutter — a
     sibling of the whole column stack — started at the top of the header. At 2
     and 3 days every label read 46px, about 33 minutes, above its own line, and
     1 day was 2px out from the canvas border. One day has no header, which is
     why nobody saw it. Measured at every column count, because that is the
     variable that broke it. */
  checks.theHourLadderLinesUpWithTheSchedule = await page.evaluate(() => {
    const bad = [];
    const spanBefore = dayViewSpan();
    const keys = getDayKeys(0);
    [1, 2, 3].forEach(span => {
      setDayViewSpan(span);
      openDay(keys[0], 0);
      const cols = document.querySelectorAll('#timeline .tl-col').length;
      if (cols !== span) { bad.push(`asked for ${span} columns, got ${cols}`); return; }
      const label = [...document.querySelectorAll('#timeline .tl-hour-label')]
        .find(l => l.textContent.trim() === '9am');
      const canvas = document.querySelector('#timeline .tl-canvas');
      // 9am is (9*60 - START_MIN) * PX_PER_MIN from the top of the day.
      const wantTop = (9 * 60 - START_MIN) * PX_PER_MIN;
      const line = [...canvas.querySelectorAll('.hour-grid-line--hour')]
        .find(l => Math.abs(parseFloat(l.style.top) - wantTop) < 0.5);
      if (!label) { bad.push(`no 9am label at ${span} day(s)`); return; }
      if (!line) { bad.push(`no 9am rule at ${span} day(s)`); return; }
      const lr = label.getBoundingClientRect(), pr = line.getBoundingClientRect();
      const off = (lr.top + lr.height / 2) - (pr.top + pr.height / 2);
      if (Math.abs(off) > 1) {
        bad.push(`at ${span} day(s) the 9am label is ${off.toFixed(1)}px from its own rule`);
      }
    });
    setDayViewSpan(spanBefore);
    return bad.length === 0 || bad;
  });

  /* The schedule is the only thing that moves. #screen-day carried min-height
     rather than a height, so the flex column grew to the 1344px schedule and
     the DOCUMENT scrolled instead — 832px of it. The wheel hid that
     (overscroll-behavior: contain), but middle-drag hands its leftover to the
     page on purpose, so the one input that reached the document was the middle
     button, and it carried the topbar off screen. dayScreenScrollsAsOneSurface
     cannot see this: it only walks INSIDE #screen-day. */
  checks.onlyTheScheduleScrollsOnTheDayScreen = await page.evaluate(() => {
    const bad = [];
    openDay(getDayKeys(0)[0], 0);
    const ws = document.querySelector('#screen-day .day-workspace');
    const doc = document.scrollingElement;
    if (!(ws.scrollHeight > ws.clientHeight + 4)) {
      bad.push('the workspace does not scroll, so nothing does');
    }
    const overflow = doc.scrollHeight - window.innerHeight;
    if (overflow > 4) bad.push(`the document itself has ${overflow}px of scroll`);
    const topbar = document.querySelector('#screen-day .day-topbar');
    const before = topbar.getBoundingClientRect().top;
    ws.scrollTop = 0;
    ws.scrollTop = 300;
    if (ws.scrollTop < 250) bad.push('the workspace refused to scroll');
    const moved = topbar.getBoundingClientRect().top - before;
    if (Math.abs(moved) > 1) bad.push(`the topbar moved ${moved.toFixed(1)}px with the schedule`);
    ws.scrollTop = 0;
    return bad.length === 0 || bad;
  });

  /* :00 and :30 survive a block being placed over them. Every surface drew its
     rules BEFORE the blocks, so the grid said nothing the moment a day was
     actually planned — and the Day Blocks lane drew a 24px repeating gradient
     that, at 0.85px/min, was neither an hour (51px) nor a half-hour (25.5px).
     Checked by stacking order rather than by eye: the grid must out-rank the
     block it crosses, and take no pointer events while doing it. */
  checks.theHourGridReadsThroughABlock = await page.evaluate(() => {
    const bad = [];
    const zOf = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const z = getComputedStyle(n).zIndex;
        if (z !== 'auto') return parseInt(z, 10);
      }
      return 0;
    };
    const crosses = (line, block) => {
      const a = line.getBoundingClientRect(), b = block.getBoundingClientRect();
      return a.top >= b.top - 1 && a.top <= b.bottom + 1 && a.right > b.left && a.left < b.right;
    };
    const keys = getDayKeys(0);
    const before = getDayBlocks(keys[0], 'jenn');
    setDayBlocks(keys[0], [{ id: 'grid-probe', actId: 'school_day',
      startMin: 9 * 60, durationMin: 180, checklistState: {} }], 'jenn');

    const surface = (name, root, gridSel, blockSel) => {
      const grid = root && root.querySelector(gridSel);
      const block = root && root.querySelector(blockSel);
      if (!grid) { bad.push(`${name}: no hour grid`); return; }
      if (!block) { bad.push(`${name}: nothing placed to read through`); return; }
      const hours = [...grid.querySelectorAll('.hour-grid-line--hour')];
      const halves = [...grid.querySelectorAll('.hour-grid-line--half')];
      if (hours.length < 17) bad.push(`${name}: ${hours.length} hour rules, expected the whole day`);
      if (!halves.length) bad.push(`${name}: no half-hour rules`);
      if (!hours.some(h => crosses(h, block))) bad.push(`${name}: no hour rule crosses the block`);
      if (zOf(grid) <= zOf(block)) {
        bad.push(`${name}: the grid (z${zOf(grid)}) is under the block (z${zOf(block)})`);
      }
      if (!(block.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        bad.push(`${name}: the grid is drawn before the block`);
      }
      if (getComputedStyle(grid).pointerEvents !== 'none') {
        bad.push(`${name}: the grid takes pointer events and would swallow taps`);
      }
    };

    setDayViewSpan(1);
    openDay(keys[0], 0);
    surface('day view', document.querySelector('#timeline .tl-canvas'),
            '.hour-grid--day', '.placed-block');
    goWeek();
    setWeekView('timegrid'); renderWeek();
    surface('Day Blocks week', document.querySelector('.tg2-lane'),
            '.hour-grid--tg2', '.tg2-block');
    setWeekView('full'); renderWeek();
    surface('Full week', document.querySelector('.wf-day-col'),
            '.hour-grid--wf', '.wf-card');

    // 6am and 10pm both get a rule: the gutter used < / > and the line loop
    // <= / >=, so the two ends were labelled but never drawn.
    const tops = [...document.querySelector('.wf-day-col')
      .querySelectorAll('.hour-grid-line--hour')].map(l => Math.round(parseFloat(l.style.top)));
    if (!tops.includes(0)) bad.push('the Full week labels 6am but draws no rule for it');

    setWeekView('timegrid');
    setDayBlocks(keys[0], before, 'jenn');
    openDay(keys[0], 0);
    return bad.length === 0 || bad;
  });

  /* Three columns on a phone is confetti, not a plan. The preference is kept —
     a narrow viewport serves fewer without forgetting what was chosen. */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  checks.narrowScreensGetOneDay = await page.evaluate(() => {
    const bad = [];
    const spanBefore = dayViewSpan();
    setDayViewSpan(3);
    openDay(getDayKeys(0)[0], 0);
    const n = document.querySelectorAll('#timeline .tl-col').length;
    if (n !== 1) bad.push(`a 390px viewport rendered ${n} day columns`);
    if (dayViewSpan() !== 3) bad.push('the stored preference was overwritten rather than overridden');
    setDayViewSpan(spanBefore);
    return bad.length === 0 || bad;
  });
  await page.setViewportSize({ width: 900, height: 1100 });
  await page.waitForTimeout(150);

  /* Copying a day is how a week actually gets built — a Tuesday and a Thursday
     that look alike were two days built by hand. Clones must be fresh (no
     inherited completion or XP) and a replaced day must be tombstoned, or a
     merge from another device brings the old blocks straight back. */
  checks.copyDayReplacesCleanly = await page.evaluate(() => {
    const bad = [];
    const keys = getDayKeys(0);
    const [src, dst] = [keys[0], keys[2]];
    const beforeSrc = getDayBlocks(src, 'jenn'), beforeDst = getDayBlocks(dst, 'jenn');
    setDayBlocks(src, [{ id: 'cd-src', actId: 'piano', startMin: 600, durationMin: 60,
                         completed: true, confirmed: true, xpAwarded: true, checklistState: { a: true } }], 'jenn');
    setDayBlocks(dst, [{ id: 'cd-old', actId: 'breakfast', startMin: 480, durationMin: 30 }], 'jenn');
    const n = copyDayInto(src, dst, 'jenn').copied;
    const got = getDayBlocks(dst, 'jenn');
    if (n !== 1) bad.push(`copied ${n} blocks, expected 1`);
    if (got.length !== 1) bad.push(`destination holds ${got.length} blocks, expected 1`);
    else {
      const b = got[0];
      if (b.id === 'cd-src') bad.push('the copy reused the source id');
      if (b.actId !== 'piano') bad.push('the copy is not the source activity');
      if (b.completed || b.confirmed || b.xpAwarded) bad.push('the copy arrived pre-completed');
      if (Object.keys(b.checklistState || {}).length) bad.push('the copy arrived pre-ticked');
    }
    if (!(state.shared.tombstones || {})['cd-old']) bad.push('the replaced block was not tombstoned — a merge will resurrect it');
    // And the source is untouched.
    if ((getDayBlocks(src, 'jenn')[0] || {}).id !== 'cd-src') bad.push('copying changed the source day');
    setDayBlocks(src, beforeSrc, 'jenn'); setDayBlocks(dst, beforeDst, 'jenn');
    return bad.length === 0 || bad;
  });
  await page.evaluate(() => openDay(getDayKeys(0)[5], 5));
  await page.waitForTimeout(300);
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

  /* Print is on the week it prints. It used to be reachable only from the More
     sheet, which is a menu you have to know to open; the week is where you are
     when you want a paper copy. Both doors call openPrint, so this asserts the
     button exists on the week AND that it is the same call, not a second one. */
  checks.printIsOnTheWeek = await page.evaluate(() => {
    goWeek();
    const bad = [];
    const btn = document.querySelector('#screen-week .week-print-btn');
    if (!btn) { bad.push('no print button on the week topbar'); return bad; }
    const r = btn.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) bad.push(`print button is ${Math.round(r.width)}×${Math.round(r.height)}, under 44`);
    if (!/openPrint\(\)/.test(btn.getAttribute('onclick') || '')) bad.push('the week print button does not call openPrint');
    btn.click();
    if (document.querySelector('.screen.active').id !== 'screen-print') bad.push('the week print button did not open the print screen');
    goWeek();
    return bad.length === 0 || bad;
  });

  /* A training session had no custom-length field at all — the presets were the
     whole of it — and the two sheets that did have one clamped at 480 minutes,
     below the app's own 600-minute competition preset. The ceiling is the day. */
  checks.durationsGoAsLongAsTheDay = await page.evaluate(() => {
    const bad = [];
    const keys = getDayKeys(0);
    currentDayKey = keys[1];
    selectedActivity = getAllActivities('jenn').find(a => a.id === 'training');
    pendingStartMin = 8 * 60;
    ts = { durationMin: 120, colour: CAT_HEX.training, tag: 'skating', objectives: [], note: '',
           repeat: false, repeatDays: [], travelBuffer: false, getReadyBuffer: false,
           warmupBuffer: false, gearState: {}, travelBufMin: 15, getReadyBufMin: 15, warmupBufMin: 20 };
    openTrainingSheet();
    const inp = document.querySelector('#trainingCustomDur input');
    if (!inp) bad.push('the training sheet still has no custom duration field');
    else {
      if (Number(inp.max) !== DAY_MIN_SPAN) bad.push(`training custom duration caps at ${inp.max}, not the day (${DAY_MIN_SPAN})`);
      inp.value = '75';
      inp.onchange();
      if (ts.durationMin !== 75) bad.push('a typed training duration did not stick');
    }
    const actInp = document.querySelector('#activityCustomDur input');
    if (actInp && Number(actInp.max) < 600) bad.push(`the activity sheet still caps below its own presets (${actInp.max})`);
    closeSheet('trainingOverlay');
    selectedActivity = null;
    return bad.length === 0 || bad;
  });

  /* A family takes up a sport the four built-in tags do not cover. It has to be
     addable, it has to render on a block, and retiring it must not rewrite the
     blocks that already name it. */
  checks.aCustomSportCanBeAdded = await page.evaluate(() => {
    const bad = [];
    const wasParent = profile;
    profile = 'parent';
    const before = (state.shared.customSports || []).length;
    openCustomSport();
    document.getElementById('sportName').value = 'Gymnastics';
    document.getElementById('sportIcon').value = '🤸';
    confirmCustomSport();
    const mine = state.shared.customSports || [];
    if (mine.length !== before + 1) bad.push('the sport was not added');
    const s = mine[mine.length - 1];
    if (getTrainingTags().every(t => t.id !== s.id)) bad.push('the new sport is not in the tag list');
    if (getTrainingTopic(s.id).name !== 'Gymnastics') bad.push('a block cannot resolve the new sport');
    // Retiring drops it from the picker but NOT from the resolver — a session
    // already tagged with it still says what it was.
    retireCustomSport(s.id);
    if (getTrainingTags().some(t => t.id === s.id)) bad.push('a retired sport is still offered');
    if (getTrainingTopic(s.id).name !== 'Gymnastics') bad.push('a retired sport stopped resolving — past blocks would lose their name');
    state.shared.customSports = state.shared.customSports.filter(x => x.id !== s.id);
    profile = wasParent;
    return bad.length === 0 || bad;
  });

  /* Taking an activity off the list used to sweep BOTH kids' weeks with no date
     filter — deleting every block that had ever named it, from last March as
     readily as from next Tuesday, tombstoned so sync could not bring them back,
     and then rebuilding the level-up counts from what was left. A piano teacher
     stops and two years of piano goes with her. It archives now: the record
     stays so history still renders, the list loses it, and only the plan ahead
     is cleared. */
  checks.retiringAnActivityKeepsItsHistory = await page.evaluate(async () => {
    const bad = [];
    const wasProfile = profile;
    profile = 'parent'; parentViewing = 'jenn';
    // An activity of our own, with one block behind us and one ahead.
    const act = { id: 'arch-test', name: 'Cello', icon: '🎻', cat: 'school', durationMin: 45, custom: true };
    state.shared.sharedActivities = [...(state.shared.sharedActivities || []), act];
    const past = new Date(); past.setDate(past.getDate() - 21);
    const future = new Date(); future.setDate(future.getDate() + 3);
    const pastKey = dateToLocalKey(past), futureKey = dateToLocalKey(future);
    const hadPast = getDayBlocks(pastKey, 'jenn'), hadFuture = getDayBlocks(futureKey, 'jenn');
    setDayBlocks(pastKey, [{ id: 'arch-old', actId: 'arch-test', startMin: 16 * 60, durationMin: 45, completed: true, confirmed: true }], 'jenn');
    setDayBlocks(futureKey, [{ id: 'arch-new', actId: 'arch-test', startMin: 16 * 60, durationMin: 45 }], 'jenn');
    const countsBefore = JSON.stringify(getProfData('jenn').activityCounts || {});

    // Answer the confirm, then retire it.
    const p = deleteParentActivity('shared', 'arch-test');
    await new Promise(r => setTimeout(r, 30));
    const ok = document.getElementById('appDialogOkBtn');
    if (!ok) bad.push('no confirmation was asked before retiring');
    else {
      if (!/earlier/i.test(document.querySelector('.app-dialog-msg').textContent)) {
        bad.push('the confirmation does not say the past is kept');
      }
      ok.click();
    }
    await p;

    // The record survives, marked — and is NOT tombstoned, or a merge from
    // another device would delete it for good.
    const rec = (state.shared.sharedActivities || []).find(a => a.id === 'arch-test');
    if (!rec) bad.push('the activity record was deleted, not archived');
    else if (!rec.archived) bad.push('the activity was not marked archived');
    if ((state.shared.tombstones || {})['sa:arch-test']) bad.push('the activity was tombstoned — sync will delete it for good');

    // Gone from what you can pick…
    profile = 'jenn'; parentViewing = 'jenn';
    if (getAllActivities('jenn').some(a => a.id === 'arch-test')) bad.push('a retired activity is still offered in the picker');
    // …but a block that names it still renders as what it was.
    const resolved = findActivity('arch-test', 'jenn');
    if (!resolved || resolved.name !== 'Cello') bad.push('a past block can no longer resolve its activity');
    openDay(pastKey, (formatDayKey(pastKey).getDay() + 6) % 7);
    const el = document.getElementById('block-arch-old');
    if (!el) bad.push('the past block stopped rendering');
    else if (!/Cello/.test(el.textContent)) bad.push(`the past block lost its name: "${el.textContent.slice(0, 40)}"`);

    // History kept, plan ahead cleared, counts untouched.
    if (!getDayBlocks(pastKey, 'jenn').some(b => b.id === 'arch-old')) bad.push('the past block was deleted');
    if (getDayBlocks(futureKey, 'jenn').some(b => b.id === 'arch-new')) bad.push('the future block was left behind pointing at a retired activity');
    if (JSON.stringify(getProfData('jenn').activityCounts || {}) !== countsBefore) bad.push('level-up counts were rewritten');

    // And it can come back.
    profile = 'parent';
    unarchiveParentActivity('shared', 'arch-test');
    if (!getAllActivities('jenn').some(a => a.id === 'arch-test')) bad.push('a retired activity cannot be put back');

    state.shared.sharedActivities = (state.shared.sharedActivities || []).filter(a => a.id !== 'arch-test');
    setDayBlocks(pastKey, hadPast, 'jenn'); setDayBlocks(futureKey, hadFuture, 'jenn');
    profile = wasProfile;
    return bad.length === 0 || bad;
  });

  /* Every category must be reachable from both ends. "Rest" and a kid's own
     custom activities were offered when creating one but had no filter chip, so
     anything filed there could only ever be found under "All"; "Routines" had a
     chip but was in neither select. One table drives the chips now. */
  checks.everyCategoryIsReachable = await page.evaluate(() => {
    const bad = [];
    profile = 'jenn';
    /* A custom activity, because "Mine" is legitimately empty until the family
       makes one — and it was the gap that started this: filed as Free Time, it
       could be found under Free but never under a chip of its own, and filed as
       "custom" it could not be found under any chip at all. */
    const had = (getProfData('jenn').customActivities || []).slice();
    getProfData('jenn').customActivities = [...had,
      { id: 'cat-test', name: 'Cartwheels', icon: '🤸', cat: 'free', durationMin: 30, custom: true }];
    const acts = getAllActivities('jenn');
    ACTIVITY_FILTERS.forEach(f => {
      if (!acts.some(a => activityMatchesFilter(a, f.id))) {
        // Seasonal is the one that legitimately empties: out-of-season entries
        // are still in the library, marked locked, so this only fires if the
        // table itself has gone wrong.
        bad.push(`filter "${f.label}" matches nothing in the library`);
      }
    });
    if (!activityMatchesFilter(acts.find(a => a.id === 'cat-test'), 'custom')) {
      bad.push('an activity the family made is not findable under "Mine"');
    }
    /* And the picker hides a chip with nothing behind it rather than offering a
       dead end — which is what makes an always-populated table safe. */
    currentDayKey = getDayKeys(0)[0];
    openSlotPicker(9 * 60);
    const chipLabels = [...document.querySelectorAll('#slotPickerFilter .filter-chip')].map(c => c.textContent);
    ACTIVITY_FILTERS.forEach(f => {
      const shown = chipLabels.includes(f.label);
      const matches = acts.some(a => activityMatchesFilter(a, f.id));
      if (shown !== matches) bad.push(`chip "${f.label}" is ${shown ? 'offered with nothing behind it' : 'hidden despite having matches'}`);
    });
    closeSheet('slotPickerOverlay');
    getProfData('jenn').customActivities = had;
    // Every category a parent or kid can file something under has a chip.
    ['customCat', 'paCat'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) { bad.push(`no #${id} select`); return; }
      [...sel.options].forEach(o => {
        if (!ACTIVITY_FILTERS.some(f => f.id === o.value)) {
          bad.push(`#${id} offers "${o.value}" but nothing can filter to it`);
        }
      });
    });
    // Appointments arrived with something in them.
    if (!acts.some(a => a.cat === 'appointment')) bad.push('the appointment category is empty');
    if (!CAT_HEX.appointment) bad.push('appointments have no colour');
    return bad.length === 0 || bad;
  });

  // Print view: travel/get-ready buffers + time-of-day sideband
  await page.evaluate(() => { goWeek(); openPrint(); });
  await page.waitForTimeout(400);
  checks.printBuffers = await page.evaluate(() =>
    document.querySelectorAll('.print-buffer').length >= 4);
  // Same for the printed axis, and for the same reason — it carried its own
  // copy of the 9am–3pm constants.
  checks.printSideband = await page.evaluate(() => {
    const keys = getDayKeys(weekOffset);
    const axisKey = keys.find(k => isSchoolDay(k)) || null;
    const want = axisKey ? dayZoneSegments(axisKey).length : 1;
    const got = document.querySelectorAll('.print-band-label').length;
    return got === want || [`the printed axis draws ${got} stretches for a day that has ${want}`];
  });
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

  /* A REPEAT REMEMBERS WHAT IT IS. The days, the frequency and the two dates
     were read off the form, used once to decide where blocks went, and dropped
     — so nothing afterwards could say what the repeat was, and the date inputs
     were shown to a parent only (and on the activity sheet, only for the school
     category). Runs in a far-future week so it cannot disturb the seeded one. */
  checks.aSeriesRemembersItsDatesAndFrequency = await page.evaluate(() => {
    const bad = [];
    const wasDay = currentDayKey, wasOffset = weekOffset, wasProfile = profile;
    profile = 'jenn';
    const plus = (key, n) => { const d = formatDayKey(key); d.setDate(d.getDate() + n); return dateToLocalKey(d); };
    const touched = [];
    for (let w = 10; w <= 17; w++) getDayKeys(w).forEach(k => { touched.push(k); setDayBlocks(k, [], 'jenn'); });

    const tue = getDayKeys(10)[1];
    currentDayKey = tue; weekOffset = 10;
    placeBlock('training', 17 * 60, 60, null, [], '', {
      tag: 'swimming', repeatDays: [1, 3], repeatEvery: 2,
      repeatDateStart: tue, repeatDateEnd: plus(tue, 28),
    });

    // Tuesday and Thursday, every second week, stopping at the end date.
    const want = [tue, plus(tue, 2), plus(tue, 14), plus(tue, 16), plus(tue, 28)].sort();
    const got = [];
    for (let w = 10; w <= 17; w++) getDayKeys(w).forEach(k => {
      if ((getDayBlocks(k, 'jenn') || []).some(b => b.seriesId)) got.push(k);
    });
    got.sort();
    if (got.join(',') !== want.join(',')) {
      bad.push(`every-2-weeks landed on ${got.join(', ')}, expected ${want.join(', ')}`);
    }

    const b0 = (getDayBlocks(tue, 'jenn') || [])[0] || {};
    if ((b0.seriesDays || []).join(',') !== '1,3') bad.push(`the block forgot its days (${b0.seriesDays})`);
    if (b0.seriesEvery !== 2) bad.push(`the block forgot its frequency (${b0.seriesEvery})`);
    if (b0.seriesStart !== tue) bad.push('the block forgot its start date');
    if (b0.seriesEnd !== plus(tue, 28)) bad.push('the block forgot its end date');
    const spec = seriesSpecText(b0);
    if (!/Tuesdays/.test(spec) || !/every 2 weeks/.test(spec) || !/until/.test(spec)) {
      bad.push(`the repeat does not read back: "${spec}"`);
    }

    // Moving the last day moves real blocks, in both directions.
    const shrink = seriesExtendTo(b0.seriesId, plus(tue, 16));
    if (shrink.removed !== 1) bad.push(`pulling the end back removed ${shrink.removed}, expected 1`);
    if (countSeriesBlocks(b0.seriesId) !== 4) bad.push('the series did not shrink');
    const grow = seriesExtendTo(b0.seriesId, plus(tue, 42));
    if (grow.added !== 3) bad.push(`pushing the end out added ${grow.added}, expected 3`);
    if (countSeriesBlocks(b0.seriesId) !== 7) bad.push('the series did not grow');

    // A day already lived is a record, not a line in a plan: it is kept.
    const late = getDayBlocks(plus(tue, 42), 'jenn');
    if (late[0]) { late[0].confirmed = true; setDayBlocks(plus(tue, 42), late, 'jenn'); }
    const keep = seriesExtendTo(b0.seriesId, plus(tue, 16));
    if (keep.kept !== 1) bad.push(`${keep.kept} confirmed days kept, expected 1`);
    if (!(getDayBlocks(plus(tue, 42), 'jenn') || []).length) {
      bad.push('a confirmed day was deleted by shortening the repeat');
    }

    // The span control is not a parent's alone any more.
    profile = 'jenn';
    openDay(getDayKeys(0)[0], 0);
    startPlacingActivity('piano');
    const range = document.getElementById('activityDateRange');
    if (range && range.style.display === 'none') {
      bad.push('a child placing a block is not offered a start and end date');
    }
    const every = document.getElementById('activityRepeatEvery');
    if (!every || !every.options.length) bad.push('there is no way to say how often the repeat comes round');
    cancelCreatePlacement('activityOverlay');

    touched.forEach(k => setDayBlocks(k, [], 'jenn'));
    currentDayKey = wasDay; weekOffset = wasOffset; profile = wasProfile;
    return bad.length === 0 || bad;
  });

  /* A COMPETITION IS CALLED WHAT IT IS CALLED. The block's label was derived
     from the sport tag, so every meet on every screen read "Skating Comp." and
     the one thing that told two of them apart lived only in a note. Checked on
     every surface, because three of them wrote their own answer rather than
     asking blockDisplayName — which is exactly how the Full week and the print
     sheet came to disagree with the day view. */
  checks.aCompetitionCanCarryItsOwnName = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile, wasDay = currentDayKey;
    profile = 'jenn';
    const key = getDayKeys(0)[5];
    const before = getDayBlocks(key, 'jenn');
    const hostile = 'Winter <img src=x onerror=alert(1)> Invitational';
    setDayBlocks(key, [{ id: 'comp-1', actId: 'competition', startMin: 9 * 60, durationMin: 240,
      tag: 'skating', compName: hostile, checklistState: {} }], 'jenn');
    const b = getDayBlocks(key, 'jenn')[0];

    if (blockDisplayName(b, 'jenn').name !== hostile) {
      bad.push(`blockDisplayName says "${blockDisplayName(b, 'jenn').name}", not the name it was given`);
    }
    /* Escaping is what puts the angle brackets into textContent, so finding
       them there proves nothing either way — the assertion that means something
       is that no <img> element was ever built. */
    const sawIt = (where, text) => {
      if (!text.includes('Winter')) bad.push(`${where} does not use the competition's name`);
    };
    // Day view.
    currentDayKey = key;
    openDay(key, 5);
    sawIt('the day view', document.getElementById('timeline').textContent || '');
    if (document.querySelector('#timeline img')) bad.push('the day view built an element out of the name');
    // Full week.
    goWeek(); setWeekView('full'); renderWeek();
    sawIt('the Full week', document.getElementById('weeklyFullGrid').textContent || '');
    if (document.querySelector('#weeklyFullGrid img')) bad.push('the Full week built an element out of the name');
    // Print.
    openPrint();
    sawIt('the print sheet', (document.getElementById('screen-print') || {}).textContent || '');
    if (document.querySelector('#screen-print img')) bad.push('the print sheet built an element out of the name');
    goWeek();
    setWeekView('timegrid');

    /* And the meeting reads it from the planner rather than asking for it to be
       typed a second time. Two records of one afternoon kept in agreement by
       hand is how they come to disagree. */
    const wk = getDayKeys(0)[0];
    const planned = mmPlannedCompetitions(wk, 'jenn');
    if (!planned.length) bad.push('the meeting cannot see the competition on the plan');
    else {
      if (planned[0].name !== hostile) bad.push('the meeting reads the wrong name off the plan');
      if (planned[0].sport !== 'skate') bad.push(`the meeting read the sport as ${planned[0].sport}`);
      if (planned[0].dayKey !== key) bad.push('the meeting read the wrong day');
    }
    const seeded = mmSeedCompDraft(wk, 'jenn');
    if (seeded.name !== hostile) bad.push('the competition form does not prefill from the plan');
    if (seeded.dayKey !== key) bad.push('the competition form prefills the wrong day');

    // With nothing planned it is the empty form it always was.
    setDayBlocks(key, [], 'jenn');
    const empty = mmSeedCompDraft(wk, 'jenn');
    if (empty.name !== '') bad.push('an unplanned week does not get an empty name to type into');

    setDayBlocks(key, before, 'jenn');
    profile = wasProfile; currentDayKey = wasDay;
    return bad.length === 0 || bad;
  });

  /* A NEW EXERCISE WAITS FOR A GROWN-UP. state.shared.customTasks is the girls'
     drill library, and anything either of them typed went straight into it with
     nothing to tell a parent it had happened — while a new ACTIVITY had had an
     approval queue all along. She can still use it in the session she typed it
     for; what changed is that a parent gets to keep or drop it. */
  checks.aNewExerciseWaitsForAGrownUp = await page.evaluate(async () => {
    const bad = [];
    const wasProfile = profile, wasViewing = parentViewing;
    const before = (state.shared.customTasks || []).slice();
    state.shared.customTasks = [];

    profile = 'jenn';
    customTaskContext = 'training';
    ts = { durationMin: 60, colour: '#888', tag: 'swimming', objectives: [], note: '', compName: '',
           repeat: false, repeatDays: [], travelBuffer: false, getReadyBuffer: false,
           warmupBuffer: false, gearState: {}, travelBufMin: 15, getReadyBufMin: 15, warmupBufMin: 20 };
    const hostile = '50m <b>Free</b>style';
    document.getElementById('taskName').value = hostile;
    document.getElementById('taskSport').value = 'swimming';
    document.getElementById('taskReps').value = 'x4';
    document.getElementById('taskNotes').value = '';
    confirmCustomTask();

    const t = (state.shared.customTasks || [])[0];
    if (!t) { bad.push('the exercise was not saved at all'); }
    else {
      if (!t.pendingApproval) bad.push("a child's new exercise did not go to a grown-up");
      if (t.addedBy !== 'jenn') bad.push(`the exercise records addedBy=${t.addedBy}`);
    }

    /* First letter up, on the way in. Typed in a hurry on a phone it comes out
       "backstroke drill", and it is then the label on every session that uses
       it. Not title case, and a name starting with a digit is left alone —
       "50m freestyle" must not become "50m Freestyle". */
    const cap = (typed) => {
      document.getElementById('taskName').value = typed;
      document.getElementById('taskReps').value = '';
      confirmCustomTask();
      const last = (state.shared.customTasks || []).slice(-1)[0] || {};
      return last.name;
    };
    const got = cap('backstroke drill');
    if (got !== 'Backstroke drill') bad.push(`"backstroke drill" saved as "${got}"`);
    const digits = cap('50m freestyle kick');
    if (digits !== '50m freestyle kick') bad.push(`a name starting with a digit was changed to "${digits}"`);
    const already = cap('Dryland circuit');
    if (already !== 'Dryland circuit') bad.push(`an already-capitalised name became "${already}"`);
    state.shared.customTasks = state.shared.customTasks.slice(0, 1);

    // She can tick it now — the point of not making her wait.
    renderTrainingSheet();
    const list = document.getElementById('objectivesList');
    const txt = (list || {}).textContent || '';
    if (!txt.includes('50m')) bad.push('the exercise she just typed is not offered in this session');
    if (!/waiting/i.test(txt)) bad.push('nothing says the exercise is waiting for a grown-up');
    if (list && list.querySelector('b')) bad.push('the exercise name was rendered as markup');

    // The parent sees it, and Now counts it.
    profile = 'parent'; parentViewing = 'jenn';
    if (pendingApprovalTasks().length !== 1) bad.push('the parent queue does not hold the new exercise');
    showScreen('parent'); renderParentHome(); setParentTab('tasks');
    const q = (document.getElementById('pendingTaskList') || {}).textContent || '';
    if (!q.includes('50m')) bad.push('the approval list does not show the exercise');
    if (document.querySelector('#pendingTaskList b')) bad.push('the approval list rendered the name as markup');
    pnRenderNow();
    if (!/exercise/i.test((document.getElementById('pnWrap') || {}).textContent || '')) {
      bad.push('Now does not mention an exercise waiting');
    }

    // Approving keeps it; the queue empties.
    approveKidTask(t.id);
    if (t.pendingApproval) bad.push('approving did not clear the flag');
    if (pendingApprovalTasks().length) bad.push('the queue still holds an approved exercise');

    // Rejecting archives rather than deletes, and it leaves the picker.
    t.pendingApproval = true;
    const p = rejectKidTask(t.id);
    await new Promise(r => setTimeout(r, 30));
    const ok = document.getElementById('appDialogOkBtn');
    if (!ok) bad.push('rejecting an exercise was not confirmed first');
    else ok.click();
    await p;
    const still = (state.shared.customTasks || []).find(x => x.id === t.id);
    if (!still) bad.push('rejecting deleted the record instead of archiving it');
    else if (!still.archived) bad.push('a rejected exercise was not archived');
    profile = 'jenn';
    renderTrainingSheet();
    if (((document.getElementById('objectivesList') || {}).textContent || '').includes('50m')) {
      bad.push('a rejected exercise is still offered in the picker');
    }

    state.shared.customTasks = before;
    profile = wasProfile; parentViewing = wasViewing;
    showScreen('today');
    return bad.length === 0 || bad;
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
    // Settle is a run-the-meeting button, so it also asks about weeks nobody
    // settled (mmMaybeAskCatchUp). Answer it — a live .overlay is fixed/inset-0
    // at z-index 300, so leaving one up puts an invisible sheet of glass over
    // every hit-test that follows, which is what broke the 44px kid audit.
    _closeAppDialog(null);
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
    _closeAppDialog(null);   // settle asks about unsettled weeks too — see above
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
     bump, and the check stays in place. The 200 target is unchanged.

     ── 2026-08-19, 277 → 261, tightened ──
     The routines section's instruction line ("Tap when it's done · all three
     closed counts the day toward the routine bonus") went, and a one-tap "all 3
     done" button above the three routines went in — which is the same sentence
     as a control you can press. A ratchet is tightened whenever the real number
     comes down: 346 at the audit, 280 after the disclosures, 276 once the
     duplicate shortcut rows went, 277 for the honest earnings label, 261 now. */
  const WORD_BUDGET = { 'screen-today': 200, 'screen-week': 200,
                        'screen-mymoney': 200, 'screen-chore': 261 };
  const KID_SCREENS = [
    // Today is held to the full 200 with no ratchet: it was built to these rules
    // rather than measured against them afterwards, which was the point of
    // landing them first.
    ['screen-today',   () => { const undo = seedTodayAudit(); goToday(); undo(); }],
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
    /* The same screen showing DAY BLOCKS, with something on it.
       This row exists because the audit above could not see the view the week
       actually opens on. renderWeek() draws whichever view is selected, and by
       the time the sweep runs the earlier checks have emptied the week — so
       there were no .tg2-block elements to measure and the grid's labels sat at
       9.9px (8.8px on a phone) and its hour gutter at 9.6px, right through every
       run of this audit. A rule the suite renders the wrong branch for is a rule
       that is not enforced.

       Seed one real day, switch to the view, then put the day back exactly as it
       was — the same discipline the Sunday row uses. */
    ['screen-week',    () => {
      goWeek();
      const kid = activeProfile();
      const key = getDayKeys(0)[2];
      const had = (getDayBlocks(key) || []).slice();
      try {
        setDayBlocks(key, [
          // A 30-minute block is the case that forced the density change: at the
          // old scale it was 15px tall, which no legible type fits inside.
          { id: 'tg2-audit-a', actId: 'routine_morning', startMin: 7 * 60, durationMin: 30 },
          { id: 'tg2-audit-b', actId: 'school_day', startMin: 9 * 60, durationMin: 5 * 60 },
          { id: 'tg2-audit-c', actId: 'training', startMin: 17 * 60, durationMin: 90, tag: 'skating' },
        ], kid);
        weekOffset = 0;
        setWeekView('timegrid');
        renderWeek();
      } finally { setDayBlocks(key, had, kid); }
    }, 'screen-week/dayblocks'],
    /* screen-quest was audited here. The Quest Board is retired; its two unique
       panels moved into Today's disclosure, which the screen-today row already
       covers — with the disclosure opened, so the panels are actually measured
       rather than skipped for being display:none. */
    ['screen-today',   () => {
      const undo = seedTodayAudit();
      goToday(); if (!tdExtrasOpen()) tdToggleExtras();
      undo();
    }, 'screen-today/extras'],
    ['screen-chore',   () => { openChoreTab(); ckSelectDay(2); }],
    ['screen-mymoney', () => { mnyOpenMyMoney('jenn'); }],
  ];
  // Four real devices, not two. The plan asked for these and the branch that
  // changed nearly every layout only ever checked a phone and a desktop-ish
  // window, so iPad portrait and landscape — the sizes this app actually lives
  // on — went unmeasured through the whole rebuild.
  /* ── Today gets a real day for the audit ─────────────────────────────────
     Both screen-today rows used to be a bare goToday(), which measured whatever
     blocks happened to be on today at this point in the run — and the
     screen-week row a few lines up seeds its own fixture precisely because that
     is not good enough. So the surfaces added with the hero refit (the running
     block's countdown, the break chip and connector, the get-ready time column,
     the clash frames) were never on screen while the five viewports were being
     swept, and .quest-start-at's white-space: nowrap had never been measured
     for overflow at any width.

     Seeded, rendered, then put back — the same discipline as screen-week, plus
     the clock, because none of it is reachable without pinning the time. The
     Later fold is opened for the same reason the extras row opens its
     disclosure: a panel behind display:none is a panel this audit skips.

     Returns its own undo, so the caller reads seed → render → restore in order. */
  await page.evaluate(() => {
    window.seedTodayAudit = () => {
      const kid = activeProfile();
      const key = todayKey();
      const hadBlocks = (getDayBlocks(key, kid) || []).slice();
      const hadLater = tdLaterOpen();
      const RealDate = Date;
      const when = new RealDate(); when.setHours(9, 30, 0, 0);
      Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(when); };
      Date.prototype = RealDate.prototype;
      Date.now = () => when.getTime(); Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
      setDayBlocks(key, [
        // Running at 9:30 — the hero, its countdown and its 🎯.
        { id: 'aud-a', actId: 'piano', startMin: 9 * 60, durationMin: 60 },
        // 15 minutes after it: the break chip on the hero's NEXT line.
        { id: 'aud-b', actId: 'math', startMin: 10 * 60 + 15, durationMin: 45 },
        // 15 more between two list cards: the break connector. Ends 12:45.
        { id: 'aud-c', actId: 'dinner', startMin: 11 * 60 + 15, durationMin: 90 },
        /* Needs her at 12:35 (10m kit + 15m car), which lands inside the block
           above — so this is the get-ready time column AND the clash, on both
           blocks it names. */
        { id: 'aud-d', actId: 'training', tag: 'swimming', startMin: 13 * 60, durationMin: 60,
          getReadyBuffer: true, getReadyBufMin: 10, travelBuffer: true, travelBufMin: 15 },
        // An hour after that one ends: the free-time card.
        { id: 'aud-e', actId: 'french', startMin: 15 * 60, durationMin: 45 },
      ], kid);
      if (!tdLaterOpen()) tdToggleLater();
      return () => {
        Date = RealDate;
        if (tdLaterOpen() !== hadLater) tdToggleLater();
        setDayBlocks(key, hadBlocks, kid);
      };
    };
  });

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
      // Scroll position survives navigation, so these artifacts were being shot
      // wherever the last check happened to leave the page — usually halfway
      // down. The top of the screen is the part worth looking at.
      await page.evaluate(() => window.scrollTo(0, 0));
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

  /* The same numbered tab bar on every money surface a CHILD reaches. Five
     pages that look like five separate pages are five separate apps.

     The parent's Money rules page is deliberately no longer one of them. It is
     reached from Setup › Money rules, not from the girls' money nav, and the
     bar rendered above the section rail — so a grown-up got the portal's nav,
     then the kids' nav, then the sections: three rows before a single number.
     The bar is the girls' wayfinding through their own five pages, and a parent
     editing rates is not walking that path. It stays on all three kid pages and
     inside the meeting, which is where the invariant was actually earning its
     keep. */
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
    // The parent's rules page carries the section rail instead, and must show
    // which version is being edited without being asked.
    showScreen('parent'); setParentTab('money'); mnyRenderRulesTab();
    const rulesWrap = document.getElementById('mnyRulesWrap');
    const onRules = !rulesWrap.querySelector('.mny-tab')
      && rulesWrap.querySelectorAll('.mny-rail-item').length === MNY_PARENT_SECTIONS.length
      && /In effect since/.test(rulesWrap.textContent);
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
  /* The Quest Board was the fourth rendering of one day and is now retired.
     What must hold is that it does not come back and that Today is still the
     only place today's blocks are listed with ticks beside them — the invariant
     the board's removal was for. */
  checks.thereIsExactlyOneListOfToday = await page.evaluate(() => {
    const bad = [];
    profile = 'jenn'; parentViewing = 'jenn';
    const key = todayKey();
    setDayBlocks(key, [
      { id: 'qb1', actId: 'breakfast', startMin: 7 * 60, durationMin: 30 },
      { id: 'qb2', actId: 'piano', startMin: 16 * 60, durationMin: 60 },
    ], 'jenn');
    if (document.getElementById('screen-quest')) bad.push('the Quest Board screen is back');
    if (typeof goQuestBoard === 'function') bad.push('goQuestBoard is back');
    if (typeof renderQuestBoard === 'function') bad.push('renderQuestBoard is back');
    goToday();
    /* Both blocks are listed once, across the up-next list, the "later today"
       fold and the "earlier today" fold — so both folds open before counting.
       Blocks only: free-time cards share the .quest-card shell but describe the
       gaps BETWEEN blocks, and counting them here would be counting holes as
       things. The invariant is unchanged — every block of the day is in #tdWrap
       and nowhere else in the document. */
    if (!tdEarlierOpen()) tdToggleEarlier();
    if (!tdLaterOpen()) tdToggleLater();
    const sel = '.quest-card:not(.quest-card--free)';
    const here = document.querySelectorAll('#tdWrap ' + sel).length;
    if (here !== 2) bad.push(`Today lists ${here} of 2 blocks`);
    const everywhere = document.querySelectorAll(sel).length;
    if (everywhere !== here) bad.push(`quest cards render in ${everywhere - here} other place(s)`);
    tdToggleEarlier();
    tdToggleLater();
    setDayBlocks(key, [], 'jenn');
    return bad.length === 0 || bad;
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
    /* The hero names the running block's own window and what is left of it.
       It used to say "now · started 8:15am", which made a child work out how
       much longer she had from a time that had already gone past. */
    const bad = [];
    const sub = wrap.querySelector('.td-now-sub');
    const subTxt = sub ? sub.textContent : '';
    /* A full range, either shape tdTimeRange produces: "9:00–10:00am" when both
       ends share a meridiem and "11:42am–12:42pm" when they do not. The first
       version of this asked for a digit either side of the dash, which is only
       true of the first shape — so it passed or failed depending on what time
       of day the suite happened to run, and nothing noticed until a fixture
       moved the clock across noon. */
    if (!/\d{1,2}:\d\d(am|pm)?–\d{1,2}:\d\d(am|pm)/.test(subTxt)) {
      bad.push('the hero does not give the block\'s window: "' + subTxt + '"');
    }
    if (!/left/.test(subTxt)) bad.push('the hero does not say how much is left: "' + subTxt + '"');
    if (!wrap.querySelector('.td-now-bar-fill')) bad.push('the countdown is not drawn');
    if (!/Jobs I can do/.test(txt)) bad.push('the jobs card is gone');
    const say = wrap.querySelector('.td-say');
    if (!say || !say.textContent.trim()) bad.push('nothing is said to her');

    // With nothing on today it must not read as a failure — off days are valid.
    setDayBlocks(dk, [], 'jenn');
    goToday();
    if (!/allowed|yours|quiet|rest/i.test(document.getElementById('tdWrap').textContent)) {
      bad.push('an empty day reads as a failure');
    }
    return bad.length ? bad : true;
  });

  /* Next at the top. The list ran in plain time order, so from mid-morning
     onward the thing she was about to do sat below a breakfast she had already
     eaten — the top of the screen was about the past.

     What this asserts is that THE PAST is not above the future, so it counts
     block cards and ignores free-time ones. A free stretch between now and the
     next block legitimately sits above it: "you have an hour, then piano" is the
     order the afternoon actually happens in, and it is still not the past. */
  checks.todayLeadsWithWhatIsNext = await page.evaluate(() => {
    const bad = [];
    profile = 'jenn'; parentViewing = 'jenn';
    const dk = todayKey();
    const now = new Date().getHours() * 60 + new Date().getMinutes();
    const past = Math.max(0, now - 180), soon = Math.min(23 * 60, now + 60);
    if (past + 30 > now || soon <= now) return true;   // too close to midnight to test honestly
    setDayBlocks(dk, [
      { id: 'td-past', actId: 'breakfast', startMin: past, durationMin: 30 },
      { id: 'td-soon', actId: 'piano', startMin: soon, durationMin: 30 },
    ], 'jenn');
    const wasOpen = tdEarlierOpen();
    if (wasOpen) tdToggleEarlier();
    goToday();
    const wrap = document.getElementById('tdWrap');
    const blocks = () => [...document.querySelectorAll('#tdWrap .quest-card:not(.quest-card--free)')];
    const cards = blocks();
    if (cards.length !== 1) bad.push(`${cards.length} block cards shown with the fold closed, expected just the upcoming one`);
    if (cards[0] && !/Piano/.test(cards[0].textContent)) bad.push('the block at the top is not the next thing');
    // The breakfast is behind the fold, so nothing on the screen is in the past.
    if (/Breakfast/.test(wrap.textContent)) bad.push('a finished block is showing with the fold closed');
    const fold = wrap.querySelector('[data-td-action="earlier"]');
    if (!fold) bad.push('finished blocks are not folded away');
    else {
      if (!/1/.test(fold.textContent)) bad.push('the fold does not say how many are behind it');
      fold.click();
      const after = blocks();
      if (after.length !== 2) bad.push(`opening the fold showed ${after.length} block cards, expected 2`);
      // Order: next first, earlier below.
      if (after[0] && !/Piano/.test(after[0].textContent)) bad.push('the earlier block came back above the next one');
      tdToggleEarlier();
    }
    if (wasOpen) tdToggleEarlier();
    setDayBlocks(dk, [], 'jenn');
    return bad.length === 0 || bad;
  });

  /* THREE THINGS LOUD, THE REST ONE TAP AWAY.
     A ten-block day put ten cards on the screen, which is a list, which is what
     Today replaced. The distinction this check exists to hold is between a CAP
     and a DISCLOSURE: a cap deleted the overflow and a child never saw it (see
     TD_MAX_QUESTS, retired for exactly that); a disclosure defers it and one tap
     brings it back. So it asserts both halves — few by default, all reachable.

     The clock is pinned so the fixture is the same at 6am and at 6pm: an
     unpinned "six blocks from now" drifts past END_MIN in the evening and the
     check would test a different day depending on when CI ran. */
  checks.todayShowsThreeThingsAndFoldsTheRest = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    const bad = [];
    const key = todayKey();
    const before = (getDayBlocks(key, 'jenn') || []).slice();
    const wasLater = tdLaterOpen();
    const RealDate = Date;
    const pin = (h, m) => {
      const when = new RealDate(); when.setHours(h, m, 0, 0);
      Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(when); };
      Date.prototype = RealDate.prototype;
      Date.now = () => when.getTime(); Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
    };
    const cards = () => [...document.querySelectorAll('#tdWrap .quest-card')];
    const blocks = () => [...document.querySelectorAll('#tdWrap .quest-card:not(.quest-card--free)')];
    const fold = () => document.querySelector('#tdWrap [data-td-action="later"]');
    try {
      if (wasLater) tdToggleLater();
      /* 9am sharp, and six back-to-back blocks from 9am: no gap before the first
         and none between any of them, so nothing here is a free-time card and
         the count is purely about the fold. Free time gets its own check. */
      pin(9, 0);
      setDayBlocks(key, [0, 1, 2, 3, 4, 5].map(i => ({
        id: 'td-many-' + i, actId: 'piano', startMin: (9 + i) * 60, durationMin: 60,
      })), 'jenn');
      goToday();

      /* The 9am block is running, so the hero IS it and the list starts at 10.
         Reachability is what matters, not which surface carries it, so the hero
         counts alongside the cards — see the note above the check. */
      const heroSub = () => (document.querySelector('#tdWrap .td-now-sub') || {}).textContent || '';
      const reachable = () => [...document.querySelectorAll('#tdWrap .quest-time')]
        .map(e => e.textContent.trim()).concat(heroSub());
      if (blocks().length !== 3) bad.push(`${blocks().length} blocks loud, expected TD_UP_NEXT + 1 = 3`);
      if (!/9:00/.test(heroSub())) bad.push(`the running block is not on the hero: "${heroSub()}"`);
      if (blocks().some(c => /9:00am/.test(c.textContent))) {
        bad.push('the running block is on the hero AND in the list');
      }
      const f = fold();
      if (!f) return ['the rest of the day is not folded away'];
      if (!/2/.test(f.textContent)) bad.push(`the fold does not say how many are behind it: "${f.textContent.trim()}"`);
      // Reachable — the half a cap could never satisfy.
      f.click();
      if (blocks().length !== 5) bad.push(`opening the fold showed ${blocks().length} of the 5 blocks not on the hero`);
      const times = reachable();
      const missing = ['9:00', '10:00am', '11:00am', '12:00pm', '1:00pm', '2:00pm']
        .filter(t => !times.some(x => x.includes(t)));
      if (missing.length) bad.push(`the whole day is not reachable: missing ${missing.join(', ')}`);
      tdToggleLater();

      /* A fold over ONE card hides as much as it saves, so at one there is no
         fold and the card simply shows. Four blocks: three loud, one over. */
      setDayBlocks(key, [0, 1, 2, 3].map(i => ({
        id: 'td-four-' + i, actId: 'piano', startMin: (9 + i) * 60, durationMin: 60,
      })), 'jenn');
      goToday();
      if (fold()) bad.push('a fold was drawn over a single card');
      // Three in the list, the fourth on the hero: four blocks, none hidden.
      if (blocks().length !== 3) bad.push(`${blocks().length} of the 3 off-hero blocks showing when the fold is not worth drawing`);
      if (cards().length !== blocks().length) bad.push('a free-time card appeared in a back-to-back day');
    } finally {
      Date = RealDate;
      if (tdLaterOpen() !== wasLater) tdToggleLater();
      setDayBlocks(key, before, 'jenn');
      goToday();
    }
    return bad.length === 0 || bad;
  });

  /* FREE TIME IS A THING ON THE LIST. A list that names only blocks cannot
     answer "what now" on an afternoon whose next block is two hours off — the
     honest answer is "nothing until four, it is yours", and that is an item.
     It is presentation only: no id, nothing written, and tdQuestsToday still
     returns exactly the blocks the day contains. */
  checks.todayNamesFreeTime = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    const bad = [];
    const key = todayKey();
    const before = (getDayBlocks(key, 'jenn') || []).slice();
    const RealDate = Date;
    const pin = (h, m) => {
      const when = new RealDate(); when.setHours(h, m, 0, 0);
      Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(when); };
      Date.prototype = RealDate.prototype;
      Date.now = () => when.getTime(); Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
    };
    const free = () => [...document.querySelectorAll('#tdWrap .quest-card--free')];
    try {
      pin(9, 0);
      // 9–10 piano, then a 90-minute hole, then 11:30 dinner.
      setDayBlocks(key, [
        { id: 'td-g1', actId: 'piano',  startMin: 9 * 60,      durationMin: 60 },
        { id: 'td-g2', actId: 'dinner', startMin: 11 * 60 + 30, durationMin: 60 },
      ], 'jenn');
      goToday();
      const gaps = free();
      if (gaps.length !== 1) bad.push(`${gaps.length} free-time cards, expected 1`);
      else {
        const t = gaps[0].textContent;
        if (!/Free time/.test(t)) bad.push('the free card does not say what it is');
        if (!/1h\s?30m/.test(t)) bad.push(`the free card does not say how long: "${t.replace(/\s+/g, ' ').trim()}"`);
        if (!/10:00am/.test(t)) bad.push('the free card does not say when it starts');
        if (!/11:30am/.test(t)) bad.push('the free card does not say when it ends');
      }
      /* In time order. The 9am block is running, so the hero has it and the
         list opens on the hole it leaves behind — "you have an hour and a half,
         then dinner" is the order the morning actually happens in. */
      const all = [...document.querySelectorAll('#tdWrap .dq-list .quest-card')];
      if (all.length !== 2 || !all[0].classList.contains('quest-card--free')
          || all[1].classList.contains('quest-card--free')) {
        bad.push('the free stretch is not in time order before the block it precedes');
      }
      // It offers itself: tapping opens the day screen to fill it.
      free()[0].querySelector('[data-td-action="plan"]').click();
      if (document.querySelector('.screen.active').id !== 'screen-day') {
        bad.push('a free-time card does not offer to be planned');
      }
      goToday();
      // It owns nothing: the day still contains exactly the two real blocks.
      if (tdQuestsToday('jenn').length !== 2) bad.push('a free-time card became a block');

      /* FREE TIME ENDS WHEN GETTING READY STARTS. A 5pm skate with kit, car and
         warm-up in front of it is not something she is free until 5 o'clock for.
         Without this the card read "free until 5:00pm" directly under a NOW card
         reading "be moving by 3:55pm" — the screen contradicting itself about
         the only number on it that matters. */
      setDayBlocks(key, [
        { id: 'td-g1', actId: 'piano', startMin: 9 * 60, durationMin: 60 },
        { id: 'td-g2', actId: 'training', tag: 'skating', startMin: 12 * 60, durationMin: 90,
          getReadyBuffer: true, getReadyBufMin: 15, travelBuffer: true, travelBufMin: 30 },
      ], 'jenn');
      goToday();
      const trimmed = free();
      if (trimmed.length !== 1) bad.push(`${trimmed.length} free cards before a block with prep, expected 1`);
      else {
        const t = trimmed[0].textContent;
        // 12:00 − 30 travel − 15 ready = 11:15, so 10:00–11:15 is 1h15m.
        if (!/11:15am/.test(t)) bad.push(`free time runs past the get-ready time: "${t.replace(/\s+/g, ' ').trim()}"`);
        if (/12:00pm/.test(t)) bad.push('free time claims the get-ready and travel time as hers');
        if (!/1h\s?15m/.test(t)) bad.push(`the trimmed gap is the wrong length: "${t.replace(/\s+/g, ' ').trim()}"`);
      }
      // Trimming can take a gap under the threshold — then it was never free
      // time, it was the run-up to the next thing.
      setDayBlocks(key, [
        { id: 'td-g1', actId: 'piano', startMin: 9 * 60, durationMin: 60 },
        { id: 'td-g2', actId: 'training', tag: 'skating', startMin: 10 * 60 + 50, durationMin: 90,
          getReadyBuffer: true, getReadyBufMin: 15, travelBuffer: true, travelBufMin: 30 },
      ], 'jenn');
      goToday();
      if (free().length) bad.push('a 50-minute run-up was named as free time once prep was taken off it');

      // Under TD_FREE_MIN is turnaround, not free time.
      setDayBlocks(key, [
        { id: 'td-g1', actId: 'piano',  startMin: 9 * 60,      durationMin: 60 },
        { id: 'td-g2', actId: 'dinner', startMin: 10 * 60 + 20, durationMin: 60 },
      ], 'jenn');
      goToday();
      if (free().length) bad.push('a 20-minute turnaround was named as free time');
    } finally {
      Date = RealDate;
      setDayBlocks(key, before, 'jenn');
      goToday();
    }
    return bad.length === 0 || bad;
  });

  /* WHEN TO START MOVING. A block can carry get-ready, travel and warm-up time,
     and the app has always known how to word it — the week grid, the Full week
     and the print sheet all read wfBufferSegments/bufferSegLabels. Today, the
     screen a child actually looks at before leaving the house, never mentioned
     it. This asserts the number, the wording and the silence: the wording has to
     be the SAME STRINGS the week grid uses, because two screens that word "leave
     by" differently will eventually disagree about the time too. */
  checks.todayTellsHerWhenToStartMoving = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    const bad = [];
    const key = todayKey();
    const before = (getDayBlocks(key, 'jenn') || []).slice();
    const RealDate = Date;
    const pin = (h, m) => {
      const when = new RealDate(); when.setHours(h, m, 0, 0);
      Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(when); };
      Date.prototype = RealDate.prototype;
      Date.now = () => when.getTime(); Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
    };
    const block = {
      id: 'td-prep', actId: 'training', tag: 'skating',
      startMin: 17 * 60, durationMin: 90,
      getReadyBuffer: true, getReadyBufMin: 15,
      travelBuffer: true, travelBufMin: 30,
      warmupBuffer: true, warmupBufMin: 20,
    };
    try {
      setDayBlocks(key, [block], 'jenn');
      // 17:00 − 20 warm-up − 30 travel − 15 get-ready = 15:55.
      const expect = 17 * 60 - 20 - 30 - 15;
      const prep = tdPrepFor(block);
      if (!prep) return ['tdPrepFor found no preparation on a block that has all three'];
      if (prep.moveByMin !== expect) bad.push(`move-by ${prep.moveByMin}, expected ${expect}`);

      pin(15, 0);   // before the deadline
      goToday();
      const wrap = document.getElementById('tdWrap');
      const move = wrap.querySelector('.td-now-move');
      if (!move) return ['the NOW card says nothing about getting ready'];
      if (!/3:55pm/.test(move.textContent)) bad.push(`the headline reads "${move.textContent.trim()}", expected 3:55pm`);
      if (/Time to get moving/.test(move.textContent)) bad.push('it says the deadline has arrived two hours early');
      // The steps are the week grid's own words, not a second wording of them.
      const steps = [...wrap.querySelectorAll('.td-now-steps span')].map(e => e.textContent.trim());
      const owned = wfBufferSegments(block).filter(s => s.side === 'pre')
        .sort((a, b) => a.startRel - b.startRel).map(s => bufferSegLabels(s, 'long'));
      if (steps.join('|') !== owned.join('|')) {
        bad.push(`the steps are a second wording: ${steps.join(' / ')} vs ${owned.join(' / ')}`);
      }

      pin(16, 30);  // past it
      goToday();
      const late = document.querySelector('#tdWrap .td-now-move');
      if (!late || !/Time to get moving/.test(late.textContent)) {
        bad.push('past the deadline it still reads as if there were time');
      }
      if (!late.classList.contains('td-now-move--now')) bad.push('an arrived deadline does not look different');

      // A block with no buffers says nothing — most blocks, and silence is right.
      setDayBlocks(key, [{ id: 'td-plain', actId: 'piano', startMin: 17 * 60, durationMin: 60 }], 'jenn');
      goToday();
      if (document.querySelector('#tdWrap .td-now-move')) {
        bad.push('a block with no travel or get-ready time invented some');
      }
      if (tdPrepFor({ id: 'x', actId: 'piano', startMin: 600, durationMin: 60 }) !== null) {
        bad.push('tdPrepFor returns something for a block with no buffers');
      }
    } finally {
      Date = RealDate;
      setDayBlocks(key, before, 'jenn');
      goToday();
    }
    return bad.length === 0 || bad;
  });

  /* THE FAMILY'S SHARE OF THE WEEK — three numbers, not one.
     "2 free chores left this week — those belong to the family" is a PRICING
     rule: mrChoreWeek takes that many graded chores and pays nothing for them.
     Nothing checked that they get done, so a week with no chores planned at all
     priced out perfectly and was silently fine. The same number is also a floor.

     It used to be checked against ONE count that mixed scheduled and done
     together, which is the bug this rewrite is about: two chores merely placed
     on the calendar satisfied the family's share without anybody lifting
     anything. getFamilyChoreStatus (js/36-status.js) keeps planned, fulfilled
     and waiting apart, and only a positive PARENT GRADE is fulfilled — a claim
     is the child's account of it and sits as `waiting` until it is answered. */
  checks.familyChoreFloorIsFlaggedWhileItCanBeFixed = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn'; weekOffset = 0;
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const bad = [];
    const kid = 'jenn', wk = ctWeekKey;
    const keys = mrWeekDayKeys(wk);
    const before = keys.map(k => (getDayBlocks(k, kid) || []).slice());
    const e = mrEnsureEarnings(kid, wk);
    const hadChores = JSON.stringify(e.chores), hadClaims = JSON.stringify(e.claims);
    try {
      keys.forEach(k => setDayBlocks(k, [], kid));
      e.chores = {}; e.claims = {};

      const st0 = getFamilyChoreStatus(kid, wk);
      if (st0.required !== 2) bad.push(`the floor is ${st0.required}, expected freeChoresPerWeek = 2`);
      if (st0.planned !== 0) bad.push(`an empty week reports ${st0.planned} planned`);
      if (st0.fulfilled !== 0) bad.push(`an empty week reports ${st0.fulfilled} fulfilled`);
      if (st0.stillNeedsADay !== 2) bad.push(`an empty week needs ${st0.stillNeedsADay} days, expected 2`);
      if (st0.unfulfilled !== 2) bad.push(`an empty week is ${st0.unfulfilled} unfulfilled, expected 2`);

      // Both surfaces say so, and they say the same number.
      goToday();
      const chip = document.querySelector('#tdWrap [data-td-action="chore"].td-chip-family');
      if (!chip) bad.push('Today does not mention the family chores');
      else if (!/2/.test(chip.textContent)) bad.push(`the chip says "${chip.textContent.trim()}"`);
      goWeek(); setWeekView('timegrid'); renderWeek();
      const banner = document.getElementById('tgFamilyBanner');
      if (!banner || banner.style.display === 'none') bad.push('the week does not mention the family chores');
      else if (!/2 family chores/.test(banner.textContent)) bad.push(`the banner says "${banner.textContent.trim()}"`);

      /* SCHEDULED IS NOT FULFILLED. Two chores on the calendar and nothing
         graded is 0 of 2 — this is the acceptance test the whole rewrite is
         for, and the old single count reported it as satisfied. */
      setDayBlocks(keys[1], [{ id: 'fam-a', actId: 'chores', startMin: 17 * 60, durationMin: 30, choreTags: ['dishes'] }], kid);
      setDayBlocks(keys[2], [{ id: 'fam-b', actId: 'chores', startMin: 17 * 60, durationMin: 30, choreTags: ['mop'] }], kid);
      const st1 = getFamilyChoreStatus(kid, wk);
      if (st1.planned !== 2) bad.push(`two scheduled chores counted as ${st1.planned} planned`);
      if (st1.fulfilled !== 0) bad.push(`a merely scheduled chore counted as fulfilled (${st1.fulfilled} of 2)`);
      if (st1.unfulfilled !== 2) bad.push(`two scheduled, none done, reported ${st1.unfulfilled} unfulfilled`);
      if (st1.stillNeedsADay !== 0) bad.push('two planned chores still ask for a day');

      /* A CLAIM IS NOT A GRADE. She says she did it; until a grown-up answers
         it is waiting, and it counts as neither done nor undone. */
      mrSetClaim(kid, wk, 1, 'dishes', 3);
      const st2 = getFamilyChoreStatus(kid, wk);
      if (st2.waiting !== 1) bad.push(`a claim without a grade reported ${st2.waiting} waiting, expected 1`);
      if (st2.fulfilled !== 0) bad.push('a claim counted as fulfilled without a parent grade');

      /* ONE PARENT GRADE IS ONE FULFILLED. */
      const wasParent = profile; profile = 'parent';
      mrSetChoreGrade(kid, wk, 1, 'dishes', 3);
      profile = wasParent;
      const st3a = getFamilyChoreStatus(kid, wk);
      if (st3a.fulfilled !== 1) bad.push(`a graded chore reported ${st3a.fulfilled} fulfilled, expected 1`);
      if (st3a.waiting !== 0) bad.push('a graded chore is still shown as waiting');
      if (st3a.unfulfilled !== 1) bad.push(`1 of 2 graded reported ${st3a.unfulfilled} unfulfilled`);

      /* The kid-facing surfaces measure what is still UNPLANNED — the one
         number a child can act on today — so both go quiet once every chore has
         a day, even while a grade is outstanding. A to-do, not a scoreboard. */
      goToday();
      if (document.querySelector('#tdWrap .td-chip-family')) bad.push('the chip stayed after every chore had a day');
      goWeek(); renderWeek();
      if (document.getElementById('tgFamilyBanner').style.display !== 'none') {
        bad.push('the banner stayed after every chore had a day');
      }

      /* THE REVIEW VOICE. A parent has to be able to see a shortfall, and it
         must not be hidden on a week that has already gone by. */
      const review = mmFamilyChoreReview(wk);
      if (!/2 family chores owed/.test(review)) bad.push('the review does not say how many are owed');
      if (!/1 fulfilled/.test(review)) bad.push('the review does not say how many were fulfilled');
      if (!/1 unfulfilled/.test(review)) bad.push('the review hides the shortfall');

      /* Standing responsibilities do not count. `own` and `helping` need no
         block and show every day, so counting them would satisfy the floor
         without anyone lifting anything. */
      keys.forEach(k => setDayBlocks(k, [], kid));
      e.chores = {}; e.claims = {};
      const st3 = getFamilyChoreStatus(kid, wk);
      if (st3.planned !== 0) bad.push(`own/helping rows counted toward the floor (planned ${st3.planned})`);

      // A week that has gone by cannot be PLANNED, so the child's forward-looking
      // banner still says nothing about it. The review voice above is where a
      // past week's shortfall is shown instead.
      weekOffset = -1;
      goWeek(); renderWeek();
      if (document.getElementById('tgFamilyBanner').style.display !== 'none') {
        bad.push('a past week is nagged about chores nobody can still plan');
      }
      weekOffset = 0;
    } finally {
      weekOffset = 0;
      keys.forEach((k, i) => setDayBlocks(k, before[i], kid));
      const en = mrEnsureEarnings(kid, wk);
      en.chores = JSON.parse(hadChores); en.claims = JSON.parse(hadClaims);
      goToday();
    }
    return bad.length === 0 || bad;
  });

  /* …AND IT IS A TO-DO, NOT BLAME.
     Every kid-facing warning in this app is either a setup mistake to report
     (ck-warn) or exposure that has not happened yet (ck-risk) — never "you
     failed to do X". That is a house rule about a nine-year-old's screen, and a
     rule kept only in a comment is a rule one edit away from being lost. */
  checks.familyChoreFlagIsForwardLookingNotBlame = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn'; weekOffset = 0;
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const bad = [];
    const kid = 'jenn', wk = ctWeekKey;
    const keys = mrWeekDayKeys(wk);
    const before = keys.map(k => (getDayBlocks(k, kid) || []).slice());
    const e = mrEnsureEarnings(kid, wk);
    const hadChores = JSON.stringify(e.chores), hadClaims = JSON.stringify(e.claims);
    try {
      keys.forEach(k => setDayBlocks(k, [], kid));
      e.chores = {}; e.claims = {};
      goWeek(); setWeekView('timegrid'); renderWeek();
      goToday();
      const chip = document.querySelector('#tdWrap .td-chip-family');
      const banner = document.getElementById('tgFamilyBanner');
      const copy = [chip ? chip.textContent : '', banner ? banner.textContent : ''].join(' ');
      if (!/to plan|find a day/i.test(copy)) bad.push(`the copy is not forward-looking: "${copy.replace(/\s+/g, ' ').trim()}"`);
      if (/didn'?t|failed|missed|should have|behind/i.test(copy)) {
        bad.push(`the copy blames her: "${copy.replace(/\s+/g, ' ').trim()}"`);
      }
    } finally {
      keys.forEach((k, i) => setDayBlocks(k, before[i], kid));
      const en = mrEnsureEarnings(kid, wk);
      en.chores = JSON.parse(hadChores); en.claims = JSON.parse(hadClaims);
      goToday();
    }
    return bad.length === 0 || bad;
  });

  /* At 8:57pm with nothing left, "the rest of today is yours" is true and
     useless: the rest of that day is sleep. Drives the real render with the
     clock pinned, then puts Date back — a fake clock left installed would
     quietly poison every check after this one. */
  checks.todayKnowsWhenTheDayIsOver = await page.evaluate(() => {
    const bad = [];
    profile = 'jenn'; parentViewing = 'jenn';
    const dk = todayKey();
    setDayBlocks(dk, [], 'jenn');
    const RealDate = Date;
    const at = h => {
      const d = new RealDate(); d.setHours(h, 0, 0, 0);
      Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(d); };
      Date.prototype = RealDate.prototype;
      Date.now = RealDate.now; Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
    };
    try {
      at(21);
      goToday();
      const night = document.getElementById('tdWrap').textContent;
      if (/Nothing scheduled/.test(night)) bad.push('9pm still reads "Nothing scheduled"');
      if (!/wind|rest/i.test(night)) bad.push(`9pm does not read as wind-down: "${night.slice(0, 90)}"`);
      at(15);
      goToday();
      const afternoon = document.getElementById('tdWrap').textContent;
      if (/[Ww]inding down/.test(afternoon)) bad.push('3pm reads as wind-down');
    } finally { Date = RealDate; }
    goToday();
    return bad.length === 0 || bad;
  });

  /* "Jobs I can do" listed only what was still claimable, so on the day she
     actually finished everything the card rendered nothing — the reward for
     finishing was an empty box. It must always say which of the three
     situations this is. */
  checks.jobsCardIsNeverBlank = await page.evaluate(() => {
    const bad = [];
    profile = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead();
    const wk = ctThisWeekKey(), d = tdTodayIndex();
    if (d == null) return true;
    const jobs = tdJobsToday('jenn');
    goToday();
    const card = [...document.querySelectorAll('#tdWrap .td-card')]
      .find(c => /Jobs I can do/.test(c.textContent));
    if (!card) { bad.push('no jobs card on Today'); return bad; }
    const body = card.textContent.replace(/Jobs I can do/, '').trim();
    if (!body) bad.push('the jobs card is blank');
    if (!jobs.hasPool && !/No jobs set up/.test(body)) {
      bad.push(`no pool this week, but the card says "${body.slice(0, 60)}"`);
    }
    // With a pool and nothing left to claim, it must celebrate rather than empty.
    if (jobs.hasPool && jobs.rows.every(r => r.state !== 'todo') && !/done/i.test(body)) {
      bad.push(`everything is done, but the card says "${body.slice(0, 60)}"`);
    }
    return bad.length === 0 || bad;
  });

  /* Money as a picture. The bar must be the accessors' own figures — a chart
     that draws its own arithmetic is a second answer to "how much have I got".
     The sparkline stays away until there are enough settled weeks to mean
     something, so it is never a blank box. */
  checks.todayMoneyChartMatchesTheAccessors = await page.evaluate(() => {
    const bad = [];
    profile = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead();
    const kid = 'jenn';
    const parts = tdMoneyParts(kid);
    const total = money2(parts.cash + parts.saved + parts.locked + parts.stock);
    goToday();
    const card = document.querySelector('#tdWrap [data-td-action="money"]');
    if (!card) { bad.push('no money card'); return bad; }
    const shown = (card.querySelector('.td-money-total') || {}).textContent || '';
    if (!shown.includes(mnyMoney(total))) bad.push(`card says "${shown}", accessors say ${mnyMoney(total)}`);
    const segs = [...card.querySelectorAll('.td-bar-seg')];
    if (total > 0) {
      const widths = segs.map(s => parseFloat(s.style.width) || 0);
      const sum = widths.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > 0.5) bad.push(`bar segments total ${sum.toFixed(1)}%, not 100%`);
    }
    const weeks = tdMoneyHistory(kid).length;
    const hasSpark = !!card.querySelector('.td-spark');
    if (weeks < TD_MONEY_SPARK_MIN_WEEKS && hasSpark) bad.push(`sparkline drawn from only ${weeks} settled weeks`);
    if (weeks >= TD_MONEY_SPARK_MIN_WEEKS && !hasSpark) bad.push(`${weeks} settled weeks but no sparkline`);
    // Nothing on Today moves money.
    const before = mnyCash(kid);
    card.click();
    const after = mnyCash(kid);
    if (before !== after) bad.push('tapping the money card moved money');
    goToday();
    return bad.length === 0 || bad;
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
    /* The footer used to carry three static shortcuts and this checked the two
       that repeated the nav. Those are gone — a second Week and Money button on
       a screen whose nav already has Week and Money is exactly the drift
       CLAUDE.md warns about — so what is left to check is the money card, which
       is itself one big data-td-action="money" button, and the plan button. */
    goToday();
    document.querySelector('#screen-today [data-td-action="money"]').click();
    const toMoney = document.getElementById('screen-mymoney').classList.contains('active');
    goToday();
    document.querySelector('#screen-today .td-plan').click();
    const toDay = document.getElementById('screen-day').classList.contains('active');

    goToday();
    const untouched = JSON.stringify(mrEnsureEarnings('jenn', wk)) === before;
    return toMoney && toDay && untouched;
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
    /* The list leads with what is NEXT now, so a 7am breakfast is behind the
       "earlier today" fold by mid-morning, and anything past the third item is
       behind "later today". Open both.

       THE INVARIANT IS UNCHANGED and it is worth being exact about why, because
       it looks like the capped teaser this check exists to forbid. A cap deletes:
       the blocks past the limit were gone from Today and a child never saw them.
       A disclosure defers: every block of the day is still on this screen, and
       one tap reaches it. What the check holds is reachability, so it opens the
       folds and then demands the whole day — which is exactly what it always
       did. If a future change makes a block unreachable from here, this fails. */
    const wasOpen = tdEarlierOpen(), wasLater = tdLaterOpen();
    if (!wasOpen) tdToggleEarlier();
    if (!wasLater) tdToggleLater();
    goToday();

    // Blocks only: free-time cards describe the gaps between them.
    const cards = [...document.querySelectorAll('#tdWrap .quest-card:not(.quest-card--free)')];
    if (cards.length !== 2) bad.push(`expected 2 quest cards, got ${cards.length}`);
    // Within each group the order is still the day's own order.
    const times = [...document.querySelectorAll('#tdWrap .quest-time')].map(e => e.textContent.trim());
    if (!times.includes('7:00am') || !times.includes('3:00pm')) {
      bad.push(`the day is not fully listed: ${times.join(', ')}`);
    }

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
    /* The two break buttons used to be asserted here. They are gone — a
       permanent row for something asked for a handful of times — so the check is
       now that they stay gone rather than that they arrived. */
    if (document.querySelector('#screen-today .btn-break-quick')) bad.push('the break buttons came back');
    const body = document.getElementById('tdExtrasBody');
    if (!body || getComputedStyle(body).display !== 'none') bad.push('the extras panel is not collapsed by default');
    tdToggleExtras();
    if (getComputedStyle(document.getElementById('tdExtrasBody')).display === 'none') bad.push('the extras panel does not open');
    tdToggleExtras();

    if (!wasOpen) tdToggleEarlier();
    if (!wasLater) tdToggleLater();
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
    // goQuestBoard was checked here; the Quest Board is retired.
    const oldQuest = true;
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

  /* ── Catching up on a week nobody wrote down ──
     The meeting always ran on ctWeekKey, so settling a past week worked — but a
     week with no planner blocks in it offered three routines a day and NOT ONE
     priced chore, because the `chores` lane is needsBlock: true. The money
     channel the meeting exists to agree was unreachable on exactly the weeks a
     busy fortnight produces. This walks the real repair: a blank week, no chore
     to tick, add what happened, and the pay follows.

     The chore→money hand-off is the assertion that matters here (CLAUDE.md:
     when that join broke, every screen still rendered and only the numbers were
     wrong), so this checks mrWeekBreakdown, not just the row. */
  checks.blankPastWeekCanBeMadeUp = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jenn', c = state.shared.chore;
    const startBefore = c.moneyModelStartWeek;
    const mon = formatDayKey(ctThisWeekKey()); mon.setDate(mon.getDate() - 14);
    const past = ctDateToKey(mon);
    // The model has to cover the week, or step 4 says "nothing to decide".
    c.moneyModelStartWeek = past;
    // Exactly what a fortnight nobody opened the app in leaves behind.
    const e = mrEnsureEarnings(kid, past);
    e.chores = {}; e.claims = {}; e.overrides = {};
    mrWeekDayKeys(past).forEach(k => setDayBlocks(k, [], kid));

    mmGoToWeek(past);
    const body = () => document.getElementById('familyMeetingBody').textContent;
    const onPastWeek = ctWeekKey === past;
    // Three catch-ups in a row used to look identical while step 4 moved money.
    const labelled = body().includes('catching up') && body().includes('2 weeks ago');

    mmSelectDay(1);
    const noChores = mmReviewRows(kid, 1).filter(r => r.kind === 'chore').length === 0;
    const opts = mmAddChoreOptions(kid, 1);
    const canAdd = opts.length > 0;
    const picker = body().includes('Add a chore that happened');

    const paidBefore = mrWeekBreakdown(past, kid).chorePaid;
    /* Three chores, on three days. Two facts about a made-up week fall out of
       the rules and both are easy to mistake for this feature being broken:
       the week's cheapest two graded chores are unpaid by design
       (rules.chores.freeChoresPerWeek = 2), and the daily cap fits one grade-3
       chore. So a reconstructed week starts paying on the THIRD chore. Asserted
       rather than worked around — it is the chore→money join, and the join is
       what fails silently. */
    const picks = opts.slice(0, 3).map(o => o.id);
    picks.forEach((id, i) => mmAddChoreHappened(kid, i + 1, id));
    // Surfaced by mrChoresForDay's unplanned branch, with no new store behind it.
    const nowListed = picks.length === 3 && picks.every((id, i) =>
      mmReviewRows(kid, i + 1).some(r => r.kind === 'chore' && r.key === id && r.on));
    const paid = mrWeekBreakdown(past, kid).chorePaid > paidBefore;

    // Routines are reconstructable too — and they must stay out of the chore
    // channel, feeding the streak instead.
    const choresAfterChore = mrWeekBreakdown(past, kid).chorePaid;
    mmToggleAllRoutines(kid, 1);
    const allThree = CT_SESSIONS.every(s => ctGetMandatory(past, 1, s, kid));
    const routinesDontPayChores = mrWeekBreakdown(past, kid).chorePaid === choresAfterChore;

    closeSheet('familyMeetingOverlay');
    e.chores = {}; e.claims = {};
    c.moneyModelStartWeek = startBefore;
    ctSetCurrentWeekFromPlanner();
    return (onPastWeek && labelled && noChores && canAdd && picker && nowListed
            && paid && allThree && routinesDontPayChores) || [{ onPastWeek, labelled,
              noChores, canAdd, picker, nowListed, paid, allThree, routinesDontPayChores }];
  });

  /* A skipped week has to be findable. Nothing read meetingsHeld looking for a
     gap — every reader asked only "is THIS week held?" — so the one place a
     missed week showed at all was as a row without a tick in the 8-week trend.
     And mnyAddMissedWeek cannot reach a gap in the middle: it only ever steps
     back from the earliest week on record. */
  checks.unsettledWeeksAreOfferedNotHidden = await page.evaluate(() => {
    const bad = [];
    profile = 'parent'; ctParentKid = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const c = state.shared.chore;
    const heldBefore = JSON.parse(JSON.stringify(c.meetingsHeld || {}));
    const metBefore = JSON.parse(JSON.stringify(c.meetingsMet || {}));
    const startBefore = c.moneyModelStartWeek, progBefore = c.programStartDate;
    const mon = formatDayKey(ctThisWeekKey()); mon.setDate(mon.getDate() - 21);
    // A family three weeks in. Both floors, because the look-back stops at
    // whichever is later — a week before the family existed is not a week
    // they missed.
    c.moneyModelStartWeek = ctDateToKey(mon);
    c.programStartDate = ctDateToKey(mon);

    c.meetingsHeld = {}; c.meetingsMet = {};
    if (mmUnsettledWeeks(8).length !== 3) bad.push(`${mmUnsettledWeeks(8).length} open weeks, expected 3`);
    if (mmUnsettledWeeks(8)[0].weeksLate !== 1) bad.push('the list does not start with the most recent');

    // Settle the middle one: it drops out, and the gap either side stays
    // reachable. This is the case the hand-entry path structurally cannot do.
    const middle = mmUnsettledWeeks(8)[1].wk;
    c.meetingsHeld[middle] = true;
    const list = mmUnsettledWeeks(8);
    if (list.length !== 2 || list.some(x => x.wk === middle)) bad.push('a settled week did not drop out of the list');

    showScreen('parent'); renderParentHome(); setParentTab('review');
    const hub = document.getElementById('meetingHub');
    if (!hub.querySelector('.mm-catchup-row')) bad.push('the catch-up list is not on the hub');
    // A way in, not a telling-off: the copy must not scold a busy fortnight.
    if (!hub.textContent.includes('Nothing expires')) bad.push('the copy scolds instead of offering');

    // Weeks before the money model began are a dead end — never offered.
    c.moneyModelStartWeek = ctThisWeekKey();
    if (mmUnsettledWeeks(8).length !== 0) bad.push('weeks before the money model started are still offered');

    c.meetingsHeld = heldBefore; c.meetingsMet = metBefore;
    c.moneyModelStartWeek = startBefore; c.programStartDate = progBefore;
    return bad.length === 0 || bad;
  });

  /* ── The "8 weeks never settled" bug ──
     meetingsHeld is written only when BOTH kids finish step 4, so a family that
     reviewed, celebrated and agreed the numbers recorded nothing — and the
     catch-up list called every one of the last eight weeks never settled,
     saturating at its own ceiling. That is where the number 8 came from. The
     same press credits the money, which is why the wallet read $0.00 while the
     meeting showed real figures: one bug, seen from two ends. */
  checks.meetingMetIsNotMeetingSettled = await page.evaluate(() => {
    const bad = [];
    profile = 'parent'; ctParentKid = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const c = state.shared.chore;
    const heldBefore = JSON.parse(JSON.stringify(c.meetingsHeld || {}));
    const metBefore = JSON.parse(JSON.stringify(c.meetingsMet || {}));
    const startBefore = c.moneyModelStartWeek, progBefore = c.programStartDate;
    const back = n => { const m = formatDayKey(ctThisWeekKey()); m.setDate(m.getDate() - n * 7); return ctDateToKey(m); };
    c.moneyModelStartWeek = back(3); c.programStartDate = back(3);
    c.meetingsHeld = {}; c.meetingsMet = {};

    // Two of the three were actually met. They must stop being nagged about…
    mmMarkWeekMet(back(1));
    mmMarkWeekMet(back(2));
    const unopened = mmUnopenedWeeks(8);
    if (unopened.length !== 1) bad.push(`${unopened.length} weeks still read as never opened, expected 1`);
    // …without becoming settled, because the money genuinely has not moved.
    if (mmIsSettled(back(1))) bad.push('marking a week met marked it settled');
    if (mmUnsettledWeeks(8).length !== 3) bad.push('a met week dropped out of the unsettled list — its money is still waiting');
    const met1 = mmUnsettledWeeks(8).find(x => x.wk === back(1));
    if (!met1 || met1.status !== 'met') bad.push('a met week is not reported as met');

    /* The hub says which is which, and offers the action that fits each — so it
       has to be read while one week is still unopened and two are met. */
    showScreen('parent'); renderParentHome(); setParentTab('review');
    const hub = document.getElementById('meetingHub');
    if (!hub.querySelector('[data-mm-catch="settle"]')) bad.push('a met week is not offered a way to settle its money');
    if (!hub.querySelector('[data-mm-catch="met"]')) bad.push('an unopened week cannot be ticked off as already done');
    if (/never settled/.test(hub.textContent)) bad.push('the hub still calls a week the family met about "never settled"');

    // And ticking one off moves no money.
    const cashBefore = mnyCash('jenn');
    mmMarkWeekMet(back(3));
    if (mnyCash('jenn') !== cashBefore) bad.push('marking a week met moved money');
    if (mmUnopenedWeeks(8).length !== 0) bad.push('ticking off the last unopened week did not take it off the list');

    c.meetingsHeld = heldBefore; c.meetingsMet = metBefore;
    c.moneyModelStartWeek = startBefore; c.programStartDate = progBefore;
    renderParentHome();
    return bad.length === 0 || bad;
  });

  /* ── Nothing was lost on the way to five destinations ──
     Ten tabs became five destinations, and the failure a restructure produces
     is not a crash — it is a panel that quietly stops being reachable, which a
     person walking a checklist misses. So the §2 mapping is asserted rather
     than walked: every original panel is opened through the new nav and has to
     render something. */
  checks.everyOldTabIsStillReachable = await page.evaluate(() => {
    const bad = [];
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    showScreen('parent'); renderParentHome();

    // panel id -> the destination that must own it
    const MAP = {
      review: 'meeting', chores: 'now', trends: 'history', options: 'setup',
      analysis: 'history', routines: 'setup', tasks: 'setup', money: 'setup',
      rules: 'setup', copyweek: 'setup', backup: 'app',
      // App's own four, built so the landing stops drawing rows for screens
      // that were only ever proposals.
      access: 'app', profiles: 'app', prefs: 'app', school: 'app',
    };
    Object.entries(MAP).forEach(([panel, dest]) => {
      setParentTab(panel);
      if (parentDest !== dest) bad.push(`${panel} lands on ${parentDest}, not ${dest}`);
      const el = document.getElementById('ptab-' + panel);
      if (!el) { bad.push(`${panel}: no panel`); return; }
      if (el.hidden) bad.push(`${panel}: opened but still hidden`);
      if (!el.textContent.trim()) bad.push(`${panel}: rendered blank`);
    });

    // Every destination's home renders, and each is reachable from the nav.
    PARENT_DESTS.forEach(d => {
      setParentDest(d.id);
      const el = document.getElementById('ptab-' + d.home);
      if (!el || el.hidden || !el.textContent.trim()) bad.push(`destination ${d.id} does not open`);
    });

    // Landings must actually offer their rows, or a panel is orphaned.
    Object.entries(PARENT_LANDINGS).forEach(([dest, rows]) => {
      setParentDest(dest);
      const wrap = document.getElementById('ptab-' + dest + '-wrap');
      rows.forEach(r => {
        if (!wrap || !wrap.querySelector(`[data-parent-panel="${r.panel}"]`)) {
          bad.push(`${dest} does not offer ${r.panel}`);
        }
      });
    });

    // And every panel that exists is owned by exactly one destination —
    // an unmapped panel is one nothing can reach.
    document.querySelectorAll('#screen-parent .parent-panel').forEach(el => {
      const id = el.id.replace(/^ptab-/, '');
      if (!PARENT_PANEL_DEST[id]) bad.push(`panel ${id} belongs to no destination`);
    });

    /* Age is a once-a-year correction and it must be somewhere. It moved off the
       weekly screen it used to sit on, so assert it landed rather than trusting
       that it did. */
    setParentTab('profiles');
    const ages = document.querySelectorAll('[data-pa-age]');
    if (ages.length !== 2) bad.push(`${ages.length} age fields in Profiles, expected one per kid`);
    else if (String(ages[0].value) !== String(currentAge('jenn'))) {
      bad.push(`Profiles shows "${ages[0].value}" for Jenn, not ${currentAge('jenn')}`);
    }

    setParentDest('now');
    return bad.length === 0 || bad;
  });

  /* Copying a week is the parent's answer to a fortnight nobody planned, so it
     has to be a plan and never a claim: fresh ids, nothing ticked, nothing paid.
     The other half is what it must NOT do — a day that already holds a plan is
     left alone unless a parent asked for it to be replaced, and a replaced day
     has to be tombstoned or a merge from another device brings the old blocks
     straight back and the parent ends up with two plans on one day. */
  checks.copyingAWeekIsAPlanNotAClaim = await page.evaluate(async () => {
    const bad = [];
    const wasProfile = profile, wasScope = parentScope, wasViewing = parentViewing;
    profile = 'parent'; parentViewing = 'jenn'; parentScope = 'jenn';
    pcwFromOffset = -1; pcwToOffset = 0; pcwOnClash = 'skip'; pcwTargetKid = 'same';

    const src = mrWeekDayKeys(pcwMonday(-1)), dst = mrWeekDayKeys(pcwMonday(0));
    const restore = [];
    const seed = (key, kid, blocks) => {
      restore.push([key, kid, getDayBlocksForProfile(key, kid)]);
      setDayBlocks(key, blocks, kid);
    };
    ['jenn', 'jess'].forEach(k => { src.forEach(d => seed(d, k, [])); dst.forEach(d => seed(d, k, [])); });
    // Monday copies onto a free day; Wednesday copies onto one that is taken.
    seed(src[0], 'jenn', [{ id: 'cw-a', actId: 'piano', startMin: 600, durationMin: 60,
      completed: true, confirmed: true, xpAwarded: true, checklistState: { a: true } }]);
    seed(src[2], 'jenn', [{ id: 'cw-b', actId: 'breakfast', startMin: 480, durationMin: 30 }]);
    seed(dst[2], 'jenn', [{ id: 'cw-here', actId: 'homework', startMin: 900, durationMin: 45 }]);

    // The preview is the commit's own plan, so what it says is what happens.
    const plan = pcwPlan();
    if (plan.copy !== 1) bad.push(`preview says ${plan.copy} blocks will copy, expected 1`);
    if (plan.skipped !== 1) bad.push(`preview says ${plan.skipped} skipped, expected 1`);

    setParentTab('copyweek');
    const shown = (document.getElementById('pcwWrap') || {}).textContent || '';
    if (!/skip/i.test(shown)) bad.push('the panel does not say a day will be skipped');

    if (pcwCommit(pcwPlan()) !== 1) bad.push('the commit did not copy exactly the one free day');
    const landed = getDayBlocksForProfile(dst[0], 'jenn');
    if (landed.length !== 1) bad.push(`${landed.length} blocks landed on Monday, expected 1`);
    else {
      const b = landed[0];
      if (b.id === 'cw-a') bad.push('the copy reused the source id');
      if (b.actId !== 'piano') bad.push('the copy is not the source activity');
      if (b.completed || b.confirmed || b.xpAwarded) bad.push('the copy arrived pre-completed');
      if (Object.keys(b.checklistState || {}).length) bad.push('the copy arrived pre-ticked');
    }
    if ((getDayBlocksForProfile(dst[2], 'jenn')[0] || {}).id !== 'cw-here') {
      bad.push('a day that already had a plan was overwritten without being asked');
    }
    if ((getDayBlocksForProfile(src[0], 'jenn')[0] || {}).id !== 'cw-a') bad.push('copying changed the source week');

    // Replace: asked for, confirmed, and the replaced block tombstoned.
    setDayBlocks(dst[0], [], 'jenn');
    pcwOnClash = 'replace';
    pcwRender();
    const go = document.querySelector('#pcwWrap [data-pcw-go]');
    if (!go) bad.push('replace mode offers no way to run the copy');
    else {
      const p = pcwApply();
      await new Promise(r => setTimeout(r, 30));
      const ok = document.getElementById('appDialogOkBtn');
      if (!ok) bad.push('replacing a planned day was not confirmed first');
      else ok.click();
      await p;
    }
    if ((getDayBlocksForProfile(dst[2], 'jenn')[0] || {}).id === 'cw-here') bad.push('replace left the old block behind');
    if (!(state.shared.tombstones || {})['cw-here']) bad.push('the replaced block was not tombstoned — a merge will resurrect it');

    // A week onto itself for the same child is a no-op, not a copy.
    pcwFromOffset = 0; pcwToOffset = 0; pcwOnClash = 'skip';
    if (!pcwPlan().sameSpot) bad.push('copying a week onto itself was not refused');
    if (pcwCommit(pcwPlan()) !== 0) bad.push('copying a week onto itself wrote blocks');

    /* Cross-child: the same week is a legitimate target, and a block naming an
       activity only Jenn has must not land on Jess as something that renders as
       nothing at all. */
    pcwFromOffset = -1; pcwToOffset = -1; pcwTargetKid = 'jess';
    const priv = { id: 'cw-private', name: 'Jenn only', icon: '🎈', cat: 'free', durationMin: 30, custom: true };
    state.profiles.jenn.customActivities = [...(state.profiles.jenn.customActivities || []), priv];
    setDayBlocks(src[1], [{ id: 'cw-p', actId: 'cw-private', startMin: 600, durationMin: 30 },
                          { id: 'cw-q', actId: 'breakfast', startMin: 480, durationMin: 30 }], 'jenn');
    const cross = pcwPlan();
    if (cross.sameSpot) bad.push('a cross-child copy in the same week was refused');
    if (cross.dropped !== 1) bad.push(`${cross.dropped} blocks left behind, expected the 1 Jess cannot resolve`);
    pcwCommit(cross);
    const onJess = getDayBlocksForProfile(src[1], 'jess');
    if (onJess.length !== 1) bad.push(`${onJess.length} blocks landed on Jess, expected 1`);
    else if (onJess[0].actId !== 'breakfast') bad.push('Jess was given a block she cannot resolve');
    state.profiles.jenn.customActivities = (state.profiles.jenn.customActivities || []).filter(a => a.id !== 'cw-private');

    restore.forEach(([key, kid, blocks]) => setDayBlocks(key, blocks, kid));
    pcwFromOffset = -1; pcwToOffset = 0; pcwOnClash = 'skip'; pcwTargetKid = 'same';
    profile = wasProfile; parentScope = wasScope; parentViewing = wasViewing;
    setParentTab('now');
    return bad.length === 0 || bad;
  });

  /* A COPY IS A NEW PLAN. weekCloneBlock carried seriesId through, and every
     consequence was invisible until it bit: countSeriesBlocks scans every week
     of the profile, so editing a copied block offered "update all" and rewrote
     the weeks it was copied FROM, and "remove all in series" tombstoned
     'sr:'+seriesId in state.shared.tombstones — which is shared, not
     per-profile, so via blockTombstoned the same delete could drop the sister's
     cross-copied blocks on the next merge. Also checks the shallow-copy half:
     Object.assign shared the objectives array and the gear/check objects by
     reference until the next reload. */
  checks.aCopiedPlanIsNotPartOfTheOriginalsSeries = await page.evaluate(() => {
    const bad = [];
    const keys = getDayKeys(0);
    const [src, dst] = [keys[0], keys[3]];
    const beforeSrc = getDayBlocks(src, 'jenn'), beforeDst = getDayBlocks(dst, 'jenn');
    const beforeJess = getDayBlocks(dst, 'jess');
    const sid = 'sr-copytest';
    setDayBlocks(src, [{ id: 'sr-1', actId: 'training', startMin: 600, durationMin: 60,
      tag: 'skating', seriesId: sid, objectives: ['one'],
      gearState: { 'gear-skating-0': true }, trainingCheck: { ready: true },
      stopwatch: { enabled: true, running: true, elapsedSec: 900, startedAt: 123 } }], 'jenn');
    setDayBlocks(dst, [], 'jenn');

    const inSeriesBefore = countSeriesBlocks(sid);
    copyDayInto(src, dst, 'jenn');
    const copy = (getDayBlocks(dst, 'jenn') || [])[0];
    if (!copy) { bad.push('nothing was copied'); }
    else {
      if (copy.seriesId) bad.push(`the copy joined the original's series (${copy.seriesId})`);
      if (Object.keys(copy.gearState || {}).length) bad.push('the copy arrived with the gear already ticked');
      if (Object.keys(copy.trainingCheck || {}).length) bad.push('the copy arrived with the training checks already ticked');
      if ((copy.stopwatch || {}).elapsedSec) bad.push("the copy carried the original's stopwatch minutes");
      if ((copy.stopwatch || {}).running) bad.push('the copy arrived with a running stopwatch');
      // Deep, not shared: pushing to one must not reach the other.
      copy.objectives.push('two');
      const source = (getDayBlocks(src, 'jenn') || [])[0] || {};
      if ((source.objectives || []).length !== 1) {
        bad.push('the copy and the original share one objectives array');
      }
      if (source.objectives === copy.objectives) bad.push('the objectives array is the same object');
    }
    if (countSeriesBlocks(sid) !== inSeriesBefore) {
      bad.push(`copying changed the size of the original series (${inSeriesBefore} → ${countSeriesBlocks(sid)})`);
    }

    /* And the sister: a cross-child copy that carried the series would let a
       later "remove all in series" tombstone reach across profiles. */
    setDayBlocks(dst, [], 'jess');
    copyDayInto(src, dst, 'jenn', 'jess');
    const hers = (getDayBlocks(dst, 'jess') || [])[0];
    if (hers && hers.seriesId) bad.push("the sister's copy joined Jenn's series");

    setDayBlocks(src, beforeSrc, 'jenn');
    setDayBlocks(dst, beforeDst, 'jenn');
    setDayBlocks(dst, beforeJess, 'jess');
    return bad.length === 0 || bad;
  });

  /* Copying a day reaches other weeks and — for a parent — the other child.
     The engine always could; only its callers were narrow. Cross-child stays
     parent-only: a copy REPLACES the destination day, so a child able to do it
     could overwrite her sister's week from her own screen. */
  checks.copyingADayCrossesWeeksAndKids = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile, wasViewing = parentViewing;
    const thisWk = getDayKeys(0), lastWk = getDayKeys(-1);
    const restore = [];
    const seed = (key, kid, blocks) => {
      restore.push([key, kid, getDayBlocksForProfile(key, kid)]);
      setDayBlocks(key, blocks, kid);
    };
    seed(lastWk[1], 'jenn', [{ id: 'cx-a', actId: 'piano', startMin: 600, durationMin: 60 }]);
    seed(thisWk[1], 'jenn', []);
    seed(thisWk[1], 'jess', []);

    // The kid sheet offers three weeks, and last week's Tuesday is one of them.
    profile = 'jenn';
    openDay(thisWk[1], 1);
    openTemplateSheet();
    if (!document.querySelector('#copyDayWeekTabs [data-copyday-week="-1"]')) {
      bad.push('the copy sheet does not offer last week');
    }
    if (!document.getElementById('copyDayKidTabs').hidden) {
      bad.push("a child is offered her sister's day — a copy replaces, so that is a parent's call");
    }
    copyDayHandleClick({ target: document.querySelector('#copyDayWeekTabs [data-copyday-week="-1"]') });
    if (copyDaySrcWeek !== -1) bad.push('picking last week did not take');
    const rows = [...document.querySelectorAll('#copyDayList .copy-day-row')].filter(r => !r.disabled);
    if (!rows.length) bad.push("last week's planned day is not offered to copy");
    closeSheet('templateOverlay');

    // Across weeks, through the engine the sheet calls.
    const across = copyDayInto(lastWk[1], thisWk[1], 'jenn');
    if (across.copied !== 1) bad.push(`copying across weeks moved ${across.copied} blocks, expected 1`);

    // Cross-child drops what the sister cannot resolve, and says how many.
    const priv = { id: 'cx-private', name: 'Jenn only', icon: '🎈', cat: 'free', durationMin: 30, custom: true };
    state.profiles.jenn.customActivities = [...(state.profiles.jenn.customActivities || []), priv];
    setDayBlocks(lastWk[1], [{ id: 'cx-p', actId: 'cx-private', startMin: 600, durationMin: 30 },
                             { id: 'cx-q', actId: 'breakfast', startMin: 480, durationMin: 30 }], 'jenn');
    const cross = copyDayInto(lastWk[1], thisWk[1], 'jenn', 'jess');
    if (cross.copied !== 1) bad.push(`${cross.copied} blocks landed on Jess, expected 1`);
    if (cross.dropped !== 1) bad.push(`${cross.dropped} reported left behind, expected 1`);
    const onJess = getDayBlocksForProfile(thisWk[1], 'jess');
    if ((onJess[0] || {}).actId !== 'breakfast') bad.push('Jess was given a block she cannot resolve');
    state.profiles.jenn.customActivities = (state.profiles.jenn.customActivities || []).filter(a => a.id !== 'cx-private');

    /* The parent portal's one-day mode: same decision object, one day in it,
       and the two ends need not be the same weekday. */
    profile = 'parent'; parentViewing = 'jenn';
    const wasSpan = pcwSpan, wasFrom = pcwFromDay, wasTo = pcwToDay;
    pcwSpan = 'day'; pcwFromDay = 1; pcwToDay = 3;
    const plan = pcwPlan();
    if (!plan.day) bad.push('the plan does not know it is a one-day copy');
    const row = plan.rows[0];
    if (!row) bad.push('the one-day plan has no rows');
    else {
      if (row.days.length !== 1) bad.push(`the one-day plan covers ${row.days.length} days`);
      if (row.days[0].toIdx !== 3) bad.push('the one-day plan ignores which weekday it lands on');
    }
    pcwSpan = wasSpan; pcwFromDay = wasFrom; pcwToDay = wasTo;

    restore.forEach(([key, kid, blocks]) => setDayBlocks(key, blocks, kid));
    setDayBlocks(lastWk[1], [], 'jenn');
    profile = wasProfile; parentViewing = wasViewing;
    copyDaySrcWeek = 0; copyDayDstKid = null;
    return bad.length === 0 || bad;
  });

  /* Step 1 confirms a day where the day is, not in a panel below a chart.
     Twenty-eight movements for a week where nothing was wrong is the friction
     this whole phase exists to remove, so it is worth an assertion. */
  checks.everyDayConfirmsWhereItIs = await page.evaluate(() => {
    const bad = [];
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const store = state.shared.parentDayConfirm || {};
    const before = JSON.parse(JSON.stringify(store));
    ['jenn', 'jess'].forEach(k => { if (store[k]) delete store[k][mmDayKey(0)]; });

    openFamilyMeeting(); mmGoStep(1);
    const body = document.getElementById('familyMeetingBody');
    const rows = body.querySelectorAll('.mm-drow');
    if (rows.length !== 7) bad.push(`${rows.length} day rows, expected 7`);
    const btn = body.querySelector('[data-mm-action="confirmday"][data-day="0"]');
    if (!btn) bad.push('Monday cannot be confirmed from its own row');
    else {
      if (mmIsDayConfirmed(0)) bad.push('fixture started confirmed');
      btn.click();
      if (!mmIsDayConfirmed(0)) bad.push('confirming from the row did not take');
      // And it stays a toggle — a mis-tap has a way back.
      body.querySelector('[data-mm-action="confirmday"][data-day="0"]').click();
      if (mmIsDayConfirmed(0)) bad.push('a day cannot be un-confirmed');
    }
    // The detail still opens, in the row it belongs to.
    const open = body.querySelector('[data-mm-action="openday"][data-day="2"]');
    if (open) {
      open.click();
      const row = document.getElementById('familyMeetingBody').querySelectorAll('.mm-drow')[2];
      if (!row || !row.querySelector('.mm-drow-body')) bad.push('a day row does not open its detail');
    }
    closeSheet('familyMeetingOverlay');
    state.shared.parentDayConfirm = before;
    return bad.length === 0 || bad;
  });

  /* One switcher, and it must not be able to hand the rest of the app a child
     that does not exist. parentViewing is read in 27 places outside this
     portal, every one of which assumes a real kid. */
  checks.oneKidSwitcherThatCannotBreakTheRest = await page.evaluate(() => {
    const bad = [];
    profile = 'parent';
    showScreen('parent'); renderParentHome();
    const pills = document.querySelectorAll('[data-parent-scope]');
    if (pills.length !== 3) bad.push(`${pills.length} scope options, expected Both/Jenn/Jess`);
    // The two that used to draw their own are gone.
    if (document.getElementById('parentWeekKidPills')) bad.push('the Weekly Review pills are still there');
    setParentTab('money');
    if (document.querySelector('[data-mnyp-action="kid"]')) bad.push('money rules still has its own switcher');
    /* The chore tab's day cards still pick whose queue you are looking at, which
       is a real job — with scope on Both something has to. What must not happen
       is one of them writing parentViewing directly and leaving the top bar
       showing the other child, which is exactly how the three switchers used to
       disagree. So: tap the card, and the one switcher has to follow. */
    setParentTab('chores');
    setParentScope('jenn');
    const card = document.querySelector('[data-cp-action="kid"][data-kid="jess"]');
    if (!card) bad.push('the chore tab lost its way to pick a kid');
    else {
      card.click();
      if (parentViewing !== 'jess') bad.push('the day card did not change who is shown');
      if (parentScope !== 'jess') bad.push('the day card left the top-bar switcher stale');
      const active = document.querySelector('[data-parent-scope].active');
      if (!active || active.getAttribute('data-parent-scope') !== 'jess') {
        bad.push('the top-bar switcher does not show what the chore tab is showing');
      }
    }

    setParentScope('both');
    if (parentScope !== 'both') bad.push('Both did not take');
    if (parentViewing !== 'jenn' && parentViewing !== 'jess') {
      bad.push(`Both left parentViewing as "${parentViewing}" — the rest of the app cannot use that`);
    }
    setParentScope('jess');
    if (parentViewing !== 'jess') bad.push('picking a kid did not point parentViewing at her');
    setParentScope('both');
    return bad.length === 0 || bad;
  });

  /* ── Now counts, it does not decide ──
     Every number on the front door is read through the accessor the owning
     screen already uses. The failure this guards is the one the whole screen is
     arranged against: a second place that works out how many chores are waiting
     and quietly disagrees with the queue itself, leaving a parent no way to
     tell which is lying. So each count is asserted against its owner, and the
     rows are asserted to link rather than to act. */
  checks.nowCountsMatchTheirOwners = await page.evaluate(() => {
    const bad = [];
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;

    // A claim with no grade is what the queue is made of.
    ['jenn', 'jess'].forEach(k => mrSetClaim(k, wk, 2, 'dishes', 3));
    const owner = ['jenn', 'jess'].reduce((n, k) => n + mrClaimQueue(wk, k).length, 0);
    const now = pnClaimCounts();
    if (now.total !== owner) bad.push(`Now says ${now.total} chores waiting, the queue has ${owner}`);
    if (!owner) bad.push('the fixture produced no claims — nothing to compare');

    if (pnPendingActs().length !== pendingApprovalActs().length) {
      bad.push('Now disagrees with the pending-approval list');
    }
    if (pnBacklog().length !== mmUnsettledWeeks(8).length) {
      bad.push('Now disagrees with the backlog');
    }

    // The screen renders, says the real number, and every row is a link.
    showScreen('parent'); renderParentHome(); setParentTab('now');
    const wrap = document.getElementById('pnWrap');
    if (!wrap || !wrap.textContent.trim()) bad.push('Now rendered blank');
    if (!wrap.textContent.includes(String(owner))) bad.push('the queue count is not on screen');
    const rows = [...wrap.querySelectorAll('[data-pn-action]')];
    if (!rows.length) bad.push('Now has no actionable rows');
    // Nothing on this screen may be a way to grade, settle or approve in place.
    if (wrap.querySelector('[data-cp-action="grade"], [data-mm-action="express-commit"]')) {
      bad.push('Now contains a control that decides something instead of linking');
    }

    /* Grading removes what was graded. Not "clears the queue": earlier checks in
       this page leave claims of their own in shared state, and asserting an
       empty queue here would be asserting something this check does not
       control. What it does control is its own two claims. */
    const before = pnClaimCounts().total;
    ['jenn', 'jess'].forEach(k => mrSetChoreGrade(k, wk, 2, 'dishes', 3));
    const after = pnClaimCounts().total;
    if (after !== before - 2) bad.push(`grading 2 claims moved the count ${before}→${after}`);
    if (after !== ['jenn', 'jess'].reduce((n, k) => n + mrClaimQueue(wk, k).length, 0)) {
      bad.push('Now and the queue disagreed after a grade');
    }
    return bad.length === 0 || bad;
  });

  /* ── The catch-up screen is a shorter road, not a second one ──
     A backlogged week closed from the catch-up screen has to land the family in
     exactly the state a full sitting would have. The failure this guards is the
     one the whole design is arranged against: a second path to pocket money
     that drifts from commitFamilyMeeting and pays a different number.

     It also holds the two facts apart. Ticking "we talked about this week"
     alone must move nothing — that is mmMarkWeekMet's job, and it is not a
     settle. */
  checks.catchUpCommitsThroughTheMeeting = await page.evaluate(() => {
    const bad = [];
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const c = state.shared.chore;
    const heldBefore = JSON.parse(JSON.stringify(c.meetingsHeld || {}));
    const metBefore = JSON.parse(JSON.stringify(c.meetingsMet || {}));
    const weekBefore = ctWeekKey;

    // A week three back, with something actually earned in it.
    const mon = formatDayKey(ctThisWeekKey()); mon.setDate(mon.getDate() - 21);
    const wk = ctDateToKey(mon);
    c.meetingsHeld = {}; c.meetingsMet = {};
    // Enough chores to clear freeChoresPerWeek (2) and the daily cap, spread
    // across days — two graded chores would net $0, and an assertion that
    // 0 === 0 proves nothing about the commit path.
    ['jenn', 'jess'].forEach(k => {
      [['dishes', 1], ['mop', 2], ['vacuum', 3], ['laundry', 4], ['bins', 5]]
        .forEach(([id, day]) => mrSetChoreGrade(k, wk, day, id, 3));
    });
    const owed = ['jenn', 'jess'].map(k => mrWeekBreakdown(wk, k).net);
    if (!owed.every(v => v > 0)) bad.push(`the fixture week owes ${owed} — nothing to prove`);

    // 1. "We talked about it" on its own moves no money.
    const cashBefore = ['jenn', 'jess'].map(k => ensureWallet(k).cash);
    mmOpenExpress(wk);
    if (mmExpressWeek !== wk) bad.push('the catch-up screen did not open on the week asked for');
    mmExpressToggle('money');            // money OFF, met ON — the record-only case
    mmExpressToggle('met');
    mmExpressCommit();
    const cashAfterMet = ['jenn', 'jess'].map(k => ensureWallet(k).cash);
    if (String(cashAfterMet) !== String(cashBefore)) bad.push('marking a week met moved money');
    if (!mmIsMet(wk)) bad.push('marking a week met did not record it');
    if (mmIsSettled(wk)) bad.push('marking a week met settled it');

    // 2. Now record the money, and it must match what the week actually owed.
    mmOpenExpress(wk);
    mmExpressCommit();                   // money ON by default
    const cashAfterPay = ['jenn', 'jess'].map(k => ensureWallet(k).cash);
    const moved = cashAfterPay.map((v, i) => Math.round((v - cashBefore[i]) * 100) / 100);
    if (String(moved) !== String(owed.map(v => Math.round(v * 100) / 100))) {
      bad.push(`catch-up paid ${moved} but the week owed ${owed}`);
    }
    if (!mmIsSettled(wk)) bad.push('a closed catch-up week is not settled');

    // 3. And it drops out of the list it came from.
    if (mmUnsettledWeeks(8).some(x => x.wk === wk)) bad.push('a settled week is still offered');

    c.meetingsHeld = heldBefore; c.meetingsMet = metBefore;
    mmExpressWeek = null; ctWeekKey = weekBefore;
    return bad.length === 0 || bad;
  });

  /* The catch-up list is a way in, not a wall. Eight open weeks is eight rows
     of guilt; four and a count says the same thing. */
  checks.theCatchUpListDoesNotGrowWithoutLimit = await page.evaluate(() => {
    const bad = [];
    profile = 'parent';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const c = state.shared.chore;
    const heldBefore = JSON.parse(JSON.stringify(c.meetingsHeld || {}));
    const metBefore = JSON.parse(JSON.stringify(c.meetingsMet || {}));
    const startBefore = c.moneyModelStartWeek, progBefore = c.programStartDate;
    const mon = formatDayKey(ctThisWeekKey()); mon.setDate(mon.getDate() - 8 * 7);
    c.moneyModelStartWeek = ctDateToKey(mon); c.programStartDate = ctDateToKey(mon);
    c.meetingsHeld = {}; c.meetingsMet = {};

    const open = mmUnsettledWeeks(8).length;
    if (open <= MM_CATCHUP_VISIBLE) bad.push(`only ${open} open weeks — cannot test the roll-up`);
    const html = mmCatchUpBanner();
    const host = document.createElement('div'); host.innerHTML = html;
    const rows = host.querySelectorAll('.mm-catchup-row:not(.mm-catchup-more)').length;
    if (rows > MM_CATCHUP_VISIBLE) bad.push(`${rows} rows shown, ceiling is ${MM_CATCHUP_VISIBLE}`);
    if (!host.querySelector('.mm-catchup-more')) bad.push('the older weeks are not reachable');
    // The rolled-up weeks are still counted in the caption, not hidden from it.
    if (!/nobody has opened/.test(host.textContent)) bad.push('the caption stopped saying how many are open');

    c.meetingsHeld = heldBefore; c.meetingsMet = metBefore;
    c.moneyModelStartWeek = startBefore; c.programStartDate = progBefore;
    return bad.length === 0 || bad;
  });

  /* The readout whose absence made $0.00 look like data loss: a week that has
     been agreed but not paid out has to say so somewhere she will look. */
  checks.agreedButUnpaidIsVisible = await page.evaluate(() => {
    const bad = [];
    profile = 'parent'; parentViewing = 'jenn'; mnyKid = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const c = state.shared.chore;
    const finBefore = JSON.parse(JSON.stringify(c.finalizedWeeks || {}));
    const lastWk = (() => { const m = formatDayKey(ctThisWeekKey()); m.setDate(m.getDate() - 7); return ctDateToKey(m); })();
    const owed = money2(ctWeekMoney(lastWk, 'jenn'));
    // Only meaningful if last week actually earned something.
    if (owed <= 0) { c.finalizedWeeks = finBefore; return true; }
    c.finalizedWeeks = JSON.parse(JSON.stringify(finBefore));
    if (c.finalizedWeeks[lastWk]) delete c.finalizedWeeks[lastWk].jenn;
    const rows = mnyUnpaidWeeks('jenn', 8);
    if (!rows.some(r => r.wk === lastWk)) bad.push('an uncredited week is not counted as unpaid');
    mnyOpenMyMoney('jenn');
    const txt = document.getElementById('mnyPage1Wrap').textContent;
    if (!/still to come/.test(txt)) bad.push('My money does not say the money is still waiting');
    /* Through mnyUnpaidTotal, not by re-summing mnyUnpaidWeeks.

       This used to add up the unfiltered rows and demand the page match, which
       it never did and never should have: mnyUnpaidWeeks answers "which weeks
       are uncredited" and includes the week running now, while "still to come"
       is what is WAITING for her — and the week in progress is not waiting, it
       is being earned. The check reported the page as wrong by exactly the
       current week's earnings for as long as it has existed. The predicate now
       has one owner and this asks that owner. */
    if (!txt.includes(mnyMoney(mnyUnpaidTotal('jenn')))) {
      bad.push('the unpaid figure on the page is not the accessors\' own');
    }

    /* And the distinction the filter exists for, which nothing held in place —
       which is how the two sums drifted apart unnoticed. This week's earnings
       stay out of "still to come" until the family agrees them, and go in the
       moment they do. */
    const thisWk = ctThisWeekKey();
    const live = money2(ctWeekMoney(thisWk, 'jenn'));
    if (live > 0 && !mnyIsConfirmed(thisWk, 'jenn')) {
      const withoutIt = mnyUnpaidTotal('jenn');
      const cf = mnyEnsureWeekMaps();
      const hadConfirm = JSON.parse(JSON.stringify(cf.weekConfirms[thisWk] || {}));
      cf.weekConfirms[thisWk] = Object.assign({}, hadConfirm, { jenn: { at: Date.now() } });
      const withIt = mnyUnpaidTotal('jenn');
      cf.weekConfirms[thisWk] = hadConfirm;
      if (money2(withIt - withoutIt) !== live) {
        bad.push(`agreeing this week moved "still to come" by ${money2(withIt - withoutIt)}, not its ${live}`);
      }
    }
    // Once the week is credited the note goes away rather than double-counting.
    if (!c.finalizedWeeks[lastWk]) c.finalizedWeeks[lastWk] = {};
    c.finalizedWeeks[lastWk].jenn = owed;
    if (mnyUnpaidWeeks('jenn', 8).some(r => r.wk === lastWk)) bad.push('a credited week is still counted as unpaid');
    c.finalizedWeeks = finBefore;
    return bad.length === 0 || bad;
  });

  /* ── A kid puts back a fortnight she never planned ──
     The whole scenario, as the KID and not the parent: two weeks went by with
     nothing in the planner, she goes back to them, fills them from a week she
     did plan, and the family reviews them in the meeting.

     The copy direction is the point. mmPlanNextWeek only ever went forward,
     which is the wrong way round for the case that actually happens — and
     placing fourteen days one block at a time is the real reason the review
     never happens. */
  checks.blankPastWeekCanBeFilledFromAnother = await page.evaluate(() => {
    // As the kid. activeProfile() must resolve to her, not to a parent view.
    profile = 'jenn'; parentViewing = 'jenn'; ctParentKid = 'jenn';
    ctPrepareRead();
    const asHer = !isParent() && activeProfile() === 'jenn';
    const back = (n) => {
      const d = formatDayKey(ctThisWeekKey()); d.setDate(d.getDate() - n * 7);
      return ctDateToKey(d);
    };
    const src = back(1), gap = back(2);
    // A planned week to borrow from, and a blank one to fill. Two days in the
    // source, one of them already done, so the clone rules get exercised.
    const act = getAllActivities('jenn').find(a => a.cat === 'training');
    mrWeekDayKeys(src).forEach(k => setDayBlocks(k, [], 'jenn'));
    mrWeekDayKeys(gap).forEach(k => setDayBlocks(k, [], 'jenn'));
    setDayBlocks(mrWeekDayKeys(src)[1], [{ id: 's1', actId: act.id, startMin: 16 * 60,
      durationMin: 60, completed: true, confirmed: true, xpAwarded: true,
      checklistState: { a: true } }], 'jenn');
    setDayBlocks(mrWeekDayKeys(src)[3], [{ id: 's2', actId: act.id, startMin: 17 * 60,
      durationMin: 30, completed: false }], 'jenn');

    const blankSeen = weekIsBlank(gap, 'jenn') && !weekIsBlank(src, 'jenn');
    // Equal distance either side goes to the later week; here only src has a plan.
    const foundSource = nearestPlannedWeek(gap, 'jenn', 8) === src;

    // She is on the blank week, and the offer is the past-week wording.
    showScreen('week'); weekOffset = -2; renderWeek();
    const coach = document.getElementById('screen-week').textContent;
    const offered = coach.includes('Nothing was planned this week')
                 && coach.includes('Copy ' + mmWeekLabel(src));

    fillWeekFromNearest(gap);
    const got = mrWeekDayKeys(gap).map(k => getDayBlocksForProfile(k, 'jenn'));
    const copied = got[1].length === 1 && got[3].length === 1 && got[0].length === 0;
    /* A copy is a plan, never a claim about what happened — and xpAwarded is the
       one that bites silently: carried over, awardBlockLinks can never pay XP
       for the block however often it is done. */
    const b = got[1][0];
    const arrivesAsAPlan = b.completed === false && b.confirmed === false
      && b.xpAwarded === false && Object.keys(b.checklistState || {}).length === 0
      && b.id !== 's1' && b.actId === act.id && b.durationMin === 60;
    // A day that already has something is never overwritten.
    setDayBlocks(mrWeekDayKeys(gap)[5], [{ id: 'keep', actId: act.id,
      startMin: 9 * 60, durationMin: 15 }], 'jenn');
    mrWeekDayKeys(gap).slice(0, 5).forEach(k => setDayBlocks(k, [], 'jenn'));
    copyWeekInto(src, gap, 'jenn');
    const keptMine = (getDayBlocksForProfile(mrWeekDayKeys(gap)[5], 'jenn')[0] || {}).id === 'keep';

    // Start planning must stay inside the week on screen, not jump to today.
    goPlanWeek(gap);
    const stayedInTheWeek = mrWeekDayKeys(gap).indexOf(currentDayKey) >= 0;

    // She ticks one, then the meeting reviews that week.
    const mine = getDayBlocksForProfile(mrWeekDayKeys(gap)[1], 'jenn');
    toggleBlockDone(mrWeekDayKeys(gap)[1], mine[0].id);
    const sheTicked = !!getDayBlocksForProfile(mrWeekDayKeys(gap)[1], 'jenn')[0].completed;

    profile = 'parent'; ctPrepareRead();
    mmCatchUpAsked = true;                 // not what this check is about
    mmGoToWeek(gap); mmGoStep(2);
    const body = document.getElementById('familyMeetingBody').textContent.replace(/\s+/g, ' ');
    /* Pinned, not fuzzy-matched. 60 + 30 copied in, plus the 15-minute block the
       clobber guard above left standing = 1h 45m planned; one of them ticked =
       1h completed. The arithmetic is the whole point — a copy that silently
       arrived already "done" would still render a chart, just a lying one.

       Wording follows the chart: "planned hours completed", never "done", and
       Competitive Sports is now Body Construction. */
    const meetingCounts = body.includes('1h completed / 1h 45m planned')
                       && body.includes('Body Construction 1h / 1h 45m');
    // …and it hands off to the screen that owns the blocks rather than listing
    // them a fourth time.
    const handsOff = !!document.querySelector('#familyMeetingBody [data-mm-action="openweek"]')
      && body.includes('not here');
    closeSheet('familyMeetingOverlay');

    mrWeekDayKeys(src).forEach(k => setDayBlocks(k, [], 'jenn'));
    mrWeekDayKeys(gap).forEach(k => setDayBlocks(k, [], 'jenn'));
    profile = 'parent'; weekOffset = 0; ctSetCurrentWeekFromPlanner();
    return (asHer && blankSeen && foundSource && offered && copied && arrivesAsAPlan
            && keptMine && stayedInTheWeek && sheTicked && meetingCounts && handsOff)
      || [{ asHer, blankSeen, foundSource, offered, copied, arrivesAsAPlan, keptMine,
            stayedInTheWeek, sheTicked, meetingCounts, handsOff, body: body.slice(0, 200) }];
  });

  /* Opening the meeting has to answer "where did we leave off?" and then offer
     the gap — the two things a family coming back after a busy fortnight needs
     before anything else. The ask hangs off the run-the-meeting buttons, NOT
     openFamilyMeeting: half that function's callers are deep links (a day from
     the hub strip, step 3 to show an override, the tab rail), and a question
     about another week on top of one of those is a question about something
     nobody asked for. */
  checks.meetingSaysWhereYouLeftOff = await page.evaluate(async () => {
    profile = 'parent'; ctParentKid = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const c = state.shared.chore;
    const heldBefore = JSON.parse(JSON.stringify(c.meetingsHeld || {}));
    const metBefore = JSON.parse(JSON.stringify(c.meetingsMet || {}));
    const startBefore = c.moneyModelStartWeek, progBefore = c.programStartDate;
    const askedBefore = mmCatchUpAsked;
    const back = (n) => {
      const d = formatDayKey(ctThisWeekKey()); d.setDate(d.getDate() - n * 7);
      return ctDateToKey(d);
    };
    // Both floors: the look-back stops at whichever is later, because a week
    // before the family existed is not a week they missed.
    c.moneyModelStartWeek = back(3);
    c.programStartDate = back(3);
    // Settled three weeks ago and nothing since: two weeks open behind us.
    c.meetingsHeld = {}; c.meetingsHeld[back(3)] = true;
    c.meetingsMet = {};

    const last = mmLastReviewed();
    const lastIs = !!last && last.wk === back(3) && last.weeksAgo === 3;

    // The readout is on screen whichever week the meeting is on.
    mmCatchUpAsked = true;                  // suppress the ask for this part
    openFamilyMeeting();
    const body = document.getElementById('familyMeetingBody').textContent;
    /* The copy names WHICH kind of open each week is. It used to lump them
       together as "still open", which is how a family that had met twice was
       told it had missed eight weeks. */
    const shows = body.includes('Last settled') && body.includes('2 earlier weeks not yet opened');
    closeSheet('familyMeetingOverlay');

    const dlgOpen = () => {
      const ov = document.getElementById('appDialogOverlay');
      return !!ov && ov.classList.contains('open');
    };
    // A programmatic open must stay silent.
    mmCatchUpAsked = false;
    openFamilyMeeting();
    const quietOnDeepLink = !dlgOpen();
    closeSheet('familyMeetingOverlay');

    // The deliberate one asks, and taking the offer moves the meeting.
    mmCatchUpAsked = false;
    openFamilyMeetingAsk();
    const asked = dlgOpen()
      && document.getElementById('appDialogOverlay').textContent.includes('nobody has opened');
    const btn = document.querySelector('#appDialogOverlay [data-choice="0"]');
    if (btn) btn.click();
    await new Promise(r => setTimeout(r, 20));
    const movedToGap = ctWeekKey === back(1);
    // …and it is one ask per load, not one per open.
    openFamilyMeetingAsk();
    const askedOnce = !dlgOpen();
    closeSheet('familyMeetingOverlay');

    // Caught up → no question at all.
    ctWeekKey = ctThisWeekKey();
    mmUnsettledWeeks(8).forEach(x => { c.meetingsHeld[x.wk] = true; });
    mmCatchUpAsked = false;
    openFamilyMeetingAsk();
    const quietWhenCaughtUp = !dlgOpen();
    closeSheet('familyMeetingOverlay');

    c.meetingsHeld = heldBefore; c.meetingsMet = metBefore;
    c.moneyModelStartWeek = startBefore; c.programStartDate = progBefore;
    mmCatchUpAsked = askedBefore;
    ctSetCurrentWeekFromPlanner();
    return (lastIs && shows && quietOnDeepLink && asked && movedToGap && askedOnce
            && quietWhenCaughtUp) || [{ lastIs, shows, quietOnDeepLink, asked,
              movedToGap, askedOnce, quietWhenCaughtUp }];
  });

  /* The market clock must not be a register of attendance. It was incremented
     once per meeting, so settling three missed weeks in one evening moved share
     prices three months — and a family that met fortnightly saw a different
     year of prices than one that met weekly, for the same year. */
  checks.marketClockFollowsTheCalendar = await page.evaluate(() => {
    ctPrepareRead();
    const c = state.shared.chore;
    const cfg = bankConfig();
    const before = cfg.marketMonth;
    const heldBefore = JSON.parse(JSON.stringify(c.meetingsHeld || {}));
    ['2020-01-06', '2020-01-13', '2020-01-20'].forEach(wk => commitMeetingShared(wk));
    const after = cfg.marketMonth;
    const steady = after === Math.max(before, bankMarketMonthForToday());
    // …and it never rewinds a price a kid has already been shown.
    cfg.marketMonth = 99;
    bankSyncMarketMonth();
    const monotonic = cfg.marketMonth === 99;
    cfg.marketMonth = before;
    c.meetingsHeld = heldBefore;
    return (steady && monotonic) || [{ before, after, steady, monotonic }];
  });

  /* A week agreed three weeks after it ended was reconstructed from memory.
     The parent side already marked a hand-typed week "typed in" for exactly
     this reason; a late settlement is the same class of evidence, and both the
     kid's story and the parent's history have to say so. */
  checks.lateSettlementIsOnTheRecord = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess'; parentViewing = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', c = state.shared.chore;
    const nowWk = ctThisWeekKey();
    const mon = formatDayKey(nowWk); mon.setDate(mon.getDate() - 14);
    const past = ctDateToKey(mon);

    const counts = mrWeeksSince(past) === 2 && mrWeeksSince(nowWk) === 0;
    const stamped = mrFreezeWeekLedger(past, kid).weeksLate === 2;
    const onTimeIsClean = mrFreezeWeekLedger(nowWk, kid).weeksLate === 0;

    // Both readers, called directly — each returns its own markup.
    const row = Object.assign(mrFreezeWeekLedger(past, kid),
                              { weekKey: past, net: 12, chores: 12 });
    const hers = mnyStoryWeek(kid, row).includes('after this one finished');

    if (!c.moneyLedger) c.moneyLedger = {};
    if (!c.moneyLedger[past]) c.moneyLedger[past] = {};
    const kept = c.moneyLedger[past][kid];
    c.moneyLedger[past][kid] = row;
    const theirs = mnyHistoryEditor(kid).includes('settled 2wk late');
    if (kept == null) delete c.moneyLedger[past][kid]; else c.moneyLedger[past][kid] = kept;

    return (counts && stamped && onTimeIsClean && hers && theirs)
      || [{ counts, stamped, onTimeIsClean, hers, theirs }];
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
    /* …but the money page's competition card is a MONTH calendar, and a week
       straddles a month roughly once a month — this Monday is 31 August and the
       mid-week day is 3 September. Point the card at the competition's own
       month before reading it, or this check fails on the calendar rather than
       on anything the app got wrong. */
    mnyCalMonth = String(dayKey).slice(0, 7);
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
    mnyCalMonth = null;
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
    const bad = [];
    profile = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jenn', wk = ctWeekKey;
    goToday();
    const row = document.querySelector('#tdWrap .td-money');
    if (!row) { bad.push('no money row on Today'); return bad; }
    const txt = row.textContent;
    /* The three tiles this used to check became a stacked bar plus its key —
       the same figures, drawn. Cash is now a key entry rather than a tile, and
       the total is stated outright; both still have to be the accessors' own
       numbers, which is what this asserts. */
    if (!txt.includes(mnyMoney(mnyCash(kid)))) bad.push(`card does not show cash ${mnyMoney(mnyCash(kid))}`);
    const owing = mnyTotalOwing(kid);
    if (owing > 0 ? !txt.includes(mnyMoney(owing)) : /owes/.test(txt)) {
      bad.push(`owing shown wrong (owes ${mnyMoney(owing)}): "${txt.slice(0, 80)}"`);
    }
    const earn = mnyEarnLeftToday(kid, wk);
    const want = earn.left == null ? earn.done : earn.left;
    if (!txt.includes(mnyMoney(want))) bad.push(`card does not show the earn figure ${mnyMoney(want)}`);
    // …and My money must print the same figure from the same reader.
    mnyOpenMyMoney(kid);
    if (!document.getElementById('mnyPage1Wrap').textContent.includes(mnyMoney(want))) {
      bad.push('My money and Today disagree about what is still to earn');
    }
    goToday();
    return bad.length === 0 || bad;
  });

  /* An empty day offers to be planned; a day with blocks on it does not. Both
     halves, or this only proves a button exists. */
  /* ONE DOOR ONTO THE DAY, and it says which trip it is.
     There used to be two affordances and a duplicate nav beside them: a
     "Nothing planned — build a day?" row inside the "On today" card when the day
     was empty, a permanent "✏️ Plan my day" button in a static footer row for
     when it was not, and — next to that button — "The whole week" and "My money",
     which are the Week and Money tabs of the persistent nav under other names.

     So the invariant flips. It is no longer "the offer appears only on an empty
     day"; it is that there is exactly ONE plan control, it is always there, its
     verb tells her whether she is building a day or changing one, and either way
     it lands on the day screen. Plus: no second Week button on a screen whose
     nav has Week on it.

     .td-plan, not [data-td-action="plan"]: every quest card's body carries that
     action too, so the bare attribute would match several things. */
  checks.anEmptyDayOffersToBePlanned = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const key = todayKey();
    const before = JSON.stringify(getDayBlocks(key, 'jenn') || []);
    const bad = [];
    const buttons = () => [...document.querySelectorAll('#tdWrap .td-plan')];
    const reaches = () => {
      const b = buttons()[0];
      if (!b) return false;
      b.click();
      const landed = document.getElementById('screen-day').classList.contains('active');
      goToday();
      return landed;
    };

    setDayBlocks(key, [], 'jenn');
    goToday();
    let btns = buttons();
    if (btns.length !== 1) bad.push(`${btns.length} plan buttons on an empty day, expected 1`);
    else if (!/plan my day/i.test(btns[0].textContent)) bad.push(`empty day reads "${btns[0].textContent.trim()}"`);
    if (!reaches()) bad.push('the plan button did not reach the day screen from an empty day');

    // A day with a plan gets the same one button, saying the other thing.
    setDayBlocks(key, [{ id: 'td-plan-x', actId: 'piano', startMin: 15 * 60, durationMin: 60 }], 'jenn');
    goToday();
    btns = buttons();
    if (btns.length !== 1) bad.push(`${btns.length} plan buttons on a planned day, expected 1`);
    else if (!/modify my plan/i.test(btns[0].textContent)) bad.push(`planned day reads "${btns[0].textContent.trim()}"`);
    if (!reaches()) bad.push('the plan button did not reach the day screen from a planned day');

    // And the nav is not repeated inside the screen.
    if (document.querySelector('#screen-today [data-td-action="week"]')) {
      bad.push('a second Week button is back on Today');
    }

    setDayBlocks(key, JSON.parse(before), 'jenn');
    goToday();
    return bad.length === 0 || bad;
  });

  /* SLEEP IS NOT UNSCHEDULED TIME. The glance reported "🌤 Unscheduled: 41h"
     with nothing beside it about the nights, which reads as if the eight hours
     she is in bed are hours nobody has claimed. They were never in the number —
     the window is 6am–10pm — but a figure that is right and reads wrong is a
     figure that will be acted on wrongly. Both facts are now stated, and this
     holds them apart arithmetically as well as on screen.

     Also: every category leads with a per-day average, because a week total is
     not a number a nine-year-old can use without dividing it by seven. */
  checks.glanceSeparatesSleepFromUnscheduled = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    const bad = [];
    const keys = getDayKeys(0);
    const kid = 'jenn';
    const before = keys.map(k => (getDayBlocks(k, kid) || []).slice());
    try {
      keys.forEach(k => setDayBlocks(k, [], kid));
      // Four hours of school on the Monday, and nothing else all week.
      setDayBlocks(keys[0], [{ id: 'gl-1', actId: 'school_day', startMin: 9 * 60, durationMin: 240 }], kid);
      const t = computeWeekTotals(keys);

      // Grouped by what the time is FOR: the school day is Brain Construction,
      // alongside homework. `cat` still decides colour; it no longer decides
      // this, which is what stopped dinner being counted as a chore.
      if (t.catMin.brain !== 240) bad.push(`school counted as ${t.catMin.brain} under Brain, expected 240`);
      // Awake, unclaimed: the whole 6am–10pm week minus the one block.
      const expectFree = DAY_MIN_SPAN * 7 - 240;
      if (t.free !== expectFree) bad.push(`unscheduled ${t.free}, expected ${expectFree}`);
      // The nights, stated on their own and NOT inside `free`.
      const expectNight = (1440 - DAY_MIN_SPAN) * 7;
      if (t.nightMin !== expectNight) bad.push(`overnight ${t.nightMin}, expected ${expectNight}`);
      if (t.free + t.planned + t.nightMin !== 1440 * 7) {
        bad.push('planned + unscheduled + overnight does not add up to the week');
      }

      goWeek(); renderWeek();
      if (!weekGlanceOpen()) toggleWeekGlance();
      renderWeekGlance(keys);
      const body = document.getElementById('weekGlanceBody');
      const text = body ? body.textContent : '';
      if (!/Overnight/.test(text)) bad.push('the glance does not name overnight at all');
      if (!/Unscheduled/.test(text)) bad.push('the glance does not name unscheduled time');
      // Per-day leads. 240 minutes over 7 days is 34 minutes, not 4h.
      const school = [...body.querySelectorAll('.glance-row')]
        .find(r => /Brain/.test(r.textContent));
      if (!school) bad.push('no Brain Construction row in the glance');
      else if (!/34m\/day/.test(school.textContent.replace(/\s+/g, ''))) {
        bad.push(`Brain reads "${school.textContent.trim().replace(/\s+/g, ' ')}", expected a 34m/day average`);
      }
      if (weekGlanceOpen()) toggleWeekGlance();
    } finally {
      keys.forEach((k, i) => setDayBlocks(k, before[i], kid));
    }
    return bad.length === 0 || bad;
  });

  /* A CHILD IS NEVER ASKED HER AGE, and the answer does not go stale.
     There was a 🎂 number field on her own week view, inside a reference panel,
     which is an app asking a nine-year-old how old she is in order to show her a
     sleep guideline. It is a grown-up's setting and it now lives in the portal;
     the app assumes 10 and adds a year each August.

     The clock stand-in is the idiom the Sunday row uses — only bare `new Date()`
     is answered, every explicit form still builds the date it was given, and the
     real Date goes back in a finally, because a fake clock left installed would
     poison every check after this one. */
  checks.ageIsNeverAskedAndRollsOverInAugust = await page.evaluate(() => {
    const bad = [];
    const kid = 'jenn';
    const pd = getProfData(kid);
    const hadAge = pd.age, hadYear = pd.ageYear;
    const RealDate = Date;
    const at = (y, m, d) => {
      const when = new RealDate(y, m, d, 10, 0, 0);
      Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(when); };
      Date.prototype = RealDate.prototype;
      Date.now = () => when.getTime(); Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
    };
    try {
      // Never set: she is ten, as of this August.
      delete pd.age; delete pd.ageYear;
      at(2026, 8, 15);                       // September 2026
      if (currentAge(kid) !== 10) bad.push(`an unset age read ${currentAge(kid)}, expected 10`);
      if (pd.ageYear !== 2026) bad.push(`seeded ageYear ${pd.ageYear}, expected 2026`);

      // Later the same school year: still ten. The rollover is August, not New Year.
      at(2027, 2, 3);                        // March 2027
      if (currentAge(kid) !== 10) bad.push('the age moved before August');

      // First week of August: eleven, and only once however often it is read.
      at(2027, 7, 3);                        // 3 August 2027
      if (currentAge(kid) !== 11) bad.push(`August did not roll the age over (got ${currentAge(kid)})`);
      if (currentAge(kid) !== 11) bad.push('reading the age twice aged her twice');

      // Two Augusts missed at once — a device left in a drawer catches up whole.
      at(2029, 8, 1);                        // September 2029
      if (currentAge(kid) !== 13) bad.push(`two missed Augusts gave ${currentAge(kid)}, expected 13`);

      // A grown-up's correction sticks, and is not immediately aged up again.
      setKidAge(8, kid);
      if (currentAge(kid) !== 8) bad.push('a corrected age did not stick');
    } finally {
      Date = RealDate;
      if (hadAge === undefined) delete pd.age; else pd.age = hadAge;
      if (hadYear === undefined) delete pd.ageYear; else pd.ageYear = hadYear;
    }

    // Nothing on a kid screen asks for it.
    profile = 'jenn'; parentViewing = 'jenn';
    goWeek(); renderWeek();
    if (!weekGlanceOpen()) toggleWeekGlance();
    renderWeek();
    if (document.getElementById('weekAge')) bad.push('the age field is back on the week view');
    if (document.querySelector('#screen-week input[type="number"]')) {
      bad.push('a number field appeared on the week view');
    }
    if (weekGlanceOpen()) toggleWeekGlance();
    /* The grown-up's copy exists and reads the right child. It lives in
       App › Profiles now — it used to sit in the primary filter row of the
       weekly screen, which is a lot of prominence for a once-a-year
       correction — and Profiles draws one field per kid rather than one field
       that follows whoever is selected. */
    profile = 'parent'; parentUnlockedThisSession = true; parentViewing = 'jess';
    showScreen('parent'); renderParentHome(); setParentTab('profiles');
    const el = document.querySelector('[data-pa-age="jess"]');
    if (!el) bad.push('there is nowhere for a parent to correct the age');
    else if (String(el.value) !== String(currentAge('jess'))) {
      bad.push(`Profiles shows "${el.value}" for Jess, not ${currentAge('jess')}`);
    }
    profile = 'jenn'; parentViewing = 'jenn'; goToday();
    return bad.length === 0 || bad;
  });

  /* AN ACHIEVEMENT STARTS UNASSIGNED. Every new one arrived reading
     "🍳 Breakfast · count target 1", because it was seeded with
     getAllActivities()[0] and DEFAULT_ACTIVITIES[0] is Breakfast. Nobody chose
     that, and eating breakfast is not an achievement — it was alphabetical
     accident wearing the clothes of a decision. */
  checks.achievementsStartUnassigned = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    const bad = [];
    const p = getProfData('jenn');
    const before = (p.achievements || []).slice();
    try {
      p.achievements = [];
      addAchievement();
      const a = p.achievements[p.achievements.length - 1];
      if (!a) return ['adding an achievement produced nothing'];
      if (a.activityId != null) bad.push(`a new achievement was pre-filled with "${a.activityId}"`);
      if (progressForAchievement(a) !== null) bad.push('an unassigned achievement reports progress');

      goWeek(); renderWeek();
      const row = document.querySelector('#achievementsList .gt-achievement-row');
      if (!row) bad.push('the achievement row did not render');
      else {
        if (/Breakfast/.test(row.textContent)) bad.push('the row still says Breakfast');
        if (!/Link activity/.test(row.textContent)) bad.push('the row does not offer to link an activity');
      }
      // Once linked it behaves exactly as before.
      setAchievementActivity(a.id, 'piano');
      const prog = progressForAchievement(p.achievements[p.achievements.length - 1]);
      if (!prog || typeof prog.value !== 'number') bad.push('a linked achievement stopped reporting progress');
    } finally {
      p.achievements = before;
      saveAll();
    }
    return bad.length === 0 || bad;
  });

  /* THE TWO SCREENS ABOUT TODAY OPEN ON TODAY.
     Sister Sync forced syncDayIdx = 0 on every open — Monday of the week being
     viewed — while the copy underneath read "you're both free … today", so from
     Tuesday onward it named one day and answered about another. The chore tab
     had the same shape of bug one level along: it worked today out correctly on
     open but ctChangeWeek reset it to Monday, so paging a week and coming back
     left it on a day nobody was looking at. Both read the same helper now. */
  checks.choreTabAndSisterSyncOpenOnToday = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn'; weekOffset = 0;
    const bad = [];
    const todayIdx = getDayKeys(0).indexOf(todayKey());
    if (todayIdx < 0) return ['today is not in the current week, so this cannot be tested'];

    openSisterSync();
    if (syncDayIdx !== todayIdx) bad.push(`Sister Sync opened on day ${syncDayIdx}, today is ${todayIdx}`);
    const label = document.getElementById('syncDayLabel').textContent;
    const d = formatDayKey(todayKey());
    if (!label.includes(String(d.getDate())) || !label.includes(MONTH_SHORT[d.getMonth()])) {
      bad.push(`Sister Sync says "${label}", not today's date`);
    }

    openChoreTab();
    if (ctDay !== todayIdx) bad.push(`the chore tab opened on day ${ctDay}, today is ${todayIdx}`);
    // Page away and back: the day must not have collapsed to Monday.
    ctChangeWeek(-1);
    ctChangeWeek(1);
    if (ctDay !== todayIdx) bad.push(`paging weeks left the chore tab on day ${ctDay}, not ${todayIdx}`);
    // A week that does not contain today has no "today" to land on.
    ctChangeWeek(-1);
    if (ctDay !== 0) bad.push(`another week opened on day ${ctDay}, expected its first day`);
    ctChangeWeek(1);
    goToday();
    return bad.length === 0 || bad;
  });

  /* THE WHOLE DAY'S ROUTINES, IN ONE TAP — and still through the owner.
     There was an "all" button per routine block and nothing above them, so
     closing a normal evening was three presses in three places; the routine
     bonus needs all three, which made the thing she was aiming at the one thing
     with no control. The bulk button writes the same checklistState the per-block
     one writes and hands each block to ckAfterRoutineChange, so
     ctAwardMandatoryFromRoutine still owns the award — Today's rule, applied
     here: call an owner, never contain one. */
  checks.routinesCloseInOneTap = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const bad = [];
    const kid = 'jenn';
    const dayKey = mrWeekDayKeys(ctWeekKey)[ctDay];
    const before = (getDayBlocks(dayKey, kid) || []).slice();
    try {
      setDayBlocks(dayKey, [
        { id: 'rt-m', actId: 'routine_morning',     startMin: 7 * 60,  durationMin: 30 },
        { id: 'rt-a', actId: 'routine_afterschool', startMin: 15 * 60, durationMin: 30 },
        { id: 'rt-e', actId: 'routine_evening',     startMin: 20 * 60, durationMin: 20 },
      ], kid);
      openChoreTab();

      const btn = () => document.querySelector('#choreWrap [data-ct-action="ck-routine-all-day"]');
      if (!btn()) return ['no one-tap control above the day\'s routines'];
      const r = btn().getBoundingClientRect();
      if (r.width < 44 || r.height < 44) bad.push(`the bulk button is ${Math.round(r.width)}x${Math.round(r.height)}, under 44`);

      btn().click();
      const closed = ckRoutineBlocks(kid, ctDay);
      const allShut = closed.length === 3 && closed.every(b => b.total > 0 && b.done >= b.total);
      if (!allShut) bad.push('one tap did not close all three routines');
      // The award path fired for each — the same one the per-block button uses.
      const kept = CT_SESSIONS.filter(s => ctGetMandatory(ctWeekKey, ctDay, s, kid)).length;
      if (kept !== 3) bad.push(`${kept} routines recorded as kept, expected 3`);

      // Pressing it again on a fully closed day clears, and only then.
      btn().click();
      const reopened = ckRoutineBlocks(kid, ctDay);
      if (reopened.some(b => b.done > 0)) bad.push('a second tap did not clear the day');

      // Half-done must close rather than clear: "all" cannot lose work she did.
      ckToggleRoutineItem('rt-m', ckRoutineItems('morning')[0].id);
      btn().click();
      const afterHalf = ckRoutineBlocks(kid, ctDay);
      if (!afterHalf.every(b => b.total > 0 && b.done >= b.total)) {
        bad.push('pressing "all" on a half-done day cleared it instead of closing it');
      }

      // Nothing planned, nothing to tick — a travel day is not three empty lists.
      setDayBlocks(dayKey, [], kid);
      renderChoreTab();
      if (btn()) bad.push('the bulk button shows on a day with no routines planned');
      if (!/No routine on this day/i.test(document.getElementById('choreWrap').textContent)) {
        bad.push('a day with no routines does not say so');
      }
    } finally {
      setDayBlocks(dayKey, before, kid);
      renderChoreTab();
    }
    return bad.length === 0 || bad;
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

  /* ── THE REDESIGN'S OWN CHECKS ────────────────────────────────────────────
     Today was six cards of identical weight; it now ranks them by shadow depth,
     lays out in two columns on the tablet it is used on, draws the day as a row
     of squares, and offers a way back from a mis-tapped tick. Each of those
     needs an assertion or it will erode. */

  /* THE HIERARCHY IS REAL, AND MEASURED.
     This is the one that matters. "Make current and next stand out" is a
     property of computed style, not of intent, and the way it dies is not a
     revert — it is six months of small edits each of which flattens one step.
     So: depth strictly decreases down the ladder, at every viewport, and only
     one thing is ever at the top of it. */
  checks.todayShoutsAtWhatIsNextAndWhispersAtTheRest = await (async () => {
    const findings = [];
    for (const [w, h] of [[390, 844], [768, 1024], [1024, 768], [1440, 900], [900, 1100]]) {
      await page.setViewportSize({ width: w, height: h });
      const r = await page.evaluate((where) => {
        profile = 'jenn'; parentViewing = 'jenn'; selectProfile('jenn');
        const key = todayKey();
        const RealDate = Date;
        const when = new RealDate(); when.setHours(15, 30, 0, 0);
        Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(when); };
        Date.prototype = RealDate.prototype;
        Date.now = () => when.getTime(); Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
        const before = (getDayBlocks(key, 'jenn') || []).slice();
        try {
          setDayBlocks(key, [
            { id: 'h1', actId: 'breakfast', startMin: 8 * 60, durationMin: 30, completed: true },
            { id: 'h2', actId: 'piano', startMin: 15 * 60, durationMin: 60 },
            { id: 'h3', actId: 'homework', startMin: 16 * 60 + 30, durationMin: 45 },
            { id: 'h4', actId: 'dinner', startMin: 18 * 60, durationMin: 45 },
          ], 'jenn');
          goToday();
          const bad = [];
          // First px of a "Xpx Ypx 0 colour" offset shadow. 0 when there is none.
          const depth = el => {
            if (!el) return null;
            const m = /(-?[\d.]+)px/.exec(getComputedStyle(el).boxShadow || '');
            return m ? Math.abs(parseFloat(m[1])) : 0;
          };
          const fontOf = el => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
          const now = document.querySelector('#tdWrap .td-now');
          const next = document.querySelector('#tdWrap .quest-card--next');
          const plain = [...document.querySelectorAll('#tdWrap .quest-card')]
            .find(c => !c.classList.contains('quest-card--next')
                    && !c.classList.contains('quest-card--free'));
          if (!now) bad.push('no NOW card');
          if (!next) bad.push('nothing is marked as the next block');
          if (!plain) bad.push('no ordinary quest card to compare against');
          if (now && next && plain) {
            const dn = depth(now), dx = depth(next), dp = depth(plain);
            if (!(dn > dx)) bad.push(`NOW shadow ${dn} is not deeper than NEXT ${dx}`);
            if (!(dx > dp)) bad.push(`NEXT shadow ${dx} is not deeper than an ordinary card ${dp}`);
            const sn = fontOf(now.querySelector('.td-now-name'));
            const sx = fontOf(next.querySelector('.quest-card-name'));
            if (!(sn > sx)) bad.push(`the NOW name ${sn}px is not bigger than the next block's ${sx}px`);
          }
          // Exactly one thing at the top of the ladder.
          const tier1 = [...document.querySelectorAll('#tdWrap .td-now')].length;
          if (tier1 !== 1) bad.push(`${tier1} cards at the top tier, expected exactly 1`);
          const marked = document.querySelectorAll('#tdWrap .quest-card--next').length;
          if (marked > 1) bad.push(`${marked} blocks marked as next`);
          return bad.map(b => `${where}: ${b}`);
        } finally {
          Date = RealDate;
          setDayBlocks(key, before, 'jenn');
        }
      }, `${w}x${h}`);
      findings.push(...r);
    }
    await page.setViewportSize({ width: 900, height: 1100 });
    await page.evaluate(() => goToday());
    return findings.length === 0 || findings;
  })();

  /* THE HERO NAMES THE NEXT BLOCK, AND SAYS WHEN TO LEAVE FOR IT.
     tdPrepFor has always been asked about the NEXT block, but its answer used to
     render inside the CURRENT block's text column — the most actionable line on
     the screen, filed under the wrong thing. This holds the placement, and holds
     the two names in agreement: the hero and the card below it must call one
     block by one name. */
  checks.theNextBlockSaysWhenToLeave = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn'; selectProfile('jenn');
    const bad = [];
    const key = todayKey();
    const before = (getDayBlocks(key, 'jenn') || []).slice();
    const RealDate = Date;
    const pin = (h, m) => {
      const when = new RealDate(); when.setHours(h, m, 0, 0);
      Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(when); };
      Date.prototype = RealDate.prototype;
      Date.now = () => when.getTime(); Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
    };
    try {
      setDayBlocks(key, [
        { id: 'p-now', actId: 'piano', startMin: 15 * 60, durationMin: 60 },
        { id: 'p-next', actId: 'training', tag: 'skating',
          startMin: 17 * 60, durationMin: 90,
          getReadyBuffer: true, getReadyBufMin: 15,
          travelBuffer: true, travelBufMin: 30,
          warmupBuffer: true, warmupBufMin: 20 },
      ], 'jenn');
      pin(15, 30);
      goToday();
      const nextBox = document.querySelector('#tdWrap .td-now-next');
      if (!nextBox) return ['the hero says nothing about what is next'];
      // The prep is INSIDE the NEXT section, not in the current block's column.
      const move = nextBox.querySelector('.td-now-move');
      if (!move) bad.push('the leave-by time is not under NEXT');
      else if (!/3:55pm/.test(move.textContent)) {
        bad.push(`leave-by reads "${move.textContent.trim()}", expected 3:55pm`);
      }
      const head = document.querySelector('#tdWrap .td-now-head');
      if (head && head.querySelector('.td-now-move')) {
        bad.push('the leave-by time is still inside the current block');
      }
      const steps = [...nextBox.querySelectorAll('.td-now-steps span')].map(e => e.textContent.trim());
      if (steps.length !== 3) bad.push(`${steps.length} preparation steps under NEXT, expected 3`);

      /* One block, one name. The training/competition unwrapping used to live
         only in the card builder, so the hero said "Training" while the card for
         the same block said "Skating". */
      const heroName = (nextBox.querySelector('.td-now-nextname') || {}).textContent || '';
      const cardName = (document.querySelector('#tdWrap .quest-card--next .quest-card-name') || {}).textContent || '';
      if (!heroName.trim()) bad.push('the hero does not name the next block');
      if (heroName.trim() !== cardName.trim()) {
        bad.push(`the hero calls it "${heroName.trim()}" and the card calls it "${cardName.trim()}"`);
      }

      // A block with no buffers gets no strip — most blocks, and silence is right.
      setDayBlocks(key, [
        { id: 'p-now', actId: 'piano', startMin: 15 * 60, durationMin: 60 },
        { id: 'p-plain', actId: 'dinner', startMin: 18 * 60, durationMin: 45 },
      ], 'jenn');
      goToday();
      if (document.querySelector('#tdWrap .td-now-prep')) {
        bad.push('a next block with no travel or get-ready time invented some');
      }
      if (!document.querySelector('#tdWrap .td-now-next')) {
        bad.push('the hero stopped naming what is next when there was no prep to show');
      }
    } finally {
      Date = RealDate;
      setDayBlocks(key, before, 'jenn');
      goToday();
    }
    return bad.length === 0 || bad;
  });

  /* THE RIBBON IS A PICTURE OF THE LIST BESIDE IT.
     It reads the array tdRenderToday already computed, so the only way these can
     disagree is if someone gives the ribbon its own reader. Plus the density
     case, asserted rather than eyeballed: twenty blocks on a phone stay one row
     inside the viewport, because an overflow container is what puts content out
     of a child's reach on a tablet. */
  checks.todayShowsTheShapeOfTheDay = await (async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const bad = await page.evaluate(() => {
      profile = 'jenn'; parentViewing = 'jenn'; selectProfile('jenn');
      const out = [];
      const key = todayKey();
      const before = (getDayBlocks(key, 'jenn') || []).slice();
      const RealDate = Date;
      const when = new RealDate(); when.setHours(15, 30, 0, 0);
      Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(when); };
      Date.prototype = RealDate.prototype;
      Date.now = () => when.getTime(); Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
      try {
        setDayBlocks(key, [
          { id: 'r1', actId: 'breakfast', startMin: 8 * 60, durationMin: 30, completed: true },
          { id: 'r2', actId: 'school', startMin: 9 * 60, durationMin: 300, completed: true },
          { id: 'r3', actId: 'piano', startMin: 15 * 60, durationMin: 60 },
          { id: 'r4', actId: 'homework', startMin: 16 * 60 + 30, durationMin: 45 },
          { id: 'r5', actId: 'dinner', startMin: 18 * 60, durationMin: 45 },
          { id: 'r6', actId: 'reading', startMin: 20 * 60, durationMin: 30 },
        ], 'jenn');
        goToday();
        const strip = document.querySelector('#tdWrap .td-rib-strip');
        if (!strip) return ['there is no ribbon'];
        const cells = [...strip.querySelectorAll('.td-rib-cell')];
        const blocks = tdQuestsToday('jenn');
        if (cells.length !== blocks.length) {
          out.push(`${cells.length} cells for ${blocks.length} blocks`);
        }
        const doneCells = strip.querySelectorAll('.td-rib-cell--done').length;
        const doneBlocks = blocks.filter(b => b.completed).length;
        if (doneCells !== doneBlocks) out.push(`${doneCells} closed cells for ${doneBlocks} finished blocks`);
        const nowCells = strip.querySelectorAll('.td-rib-cell--now').length;
        if (nowCells !== 1) out.push(`${nowCells} cells marked as running, expected 1`);

        /* COLOUR IS THE CATEGORY, THE BORDER IS THE STATUS.
           Fill used to carry status — green done, yellow now, white to come —
           which said how much was ticked and nothing about what any of it was.
           Colour now comes from blockColour, the same answer the day view and
           the week grid render, and status moved to the border.

           The assertion that matters is the SECOND one: every cell stays solid,
           whether or not it is confirmed. A child does not get to tick things
           every hour, so an unconfirmed block must never be drawn faded or
           hollow as though she had failed it. */
        const rgb = s => (s.match(/\d+/g) || []).slice(0, 3).join(',');
        const cellFor = id => cells[blocks.findIndex(b => b.id === id)];
        blocks.forEach(b => {
          const el = cellFor(b.id);
          if (!el) { out.push(`no ribbon cell for ${b.id}`); return; }
          const cs = getComputedStyle(el);
          const want = blockColour(b, 'jenn');
          const probe = document.createElement('span');
          probe.style.color = want; document.body.appendChild(probe);
          const wantRgb = rgb(getComputedStyle(probe).color);
          probe.remove();
          if (rgb(cs.backgroundColor) !== wantRgb) {
            out.push(`${b.id} is ${cs.backgroundColor}, not its own ${want}`);
          }
          // Never faded, never hollow — solid at full strength either way.
          if (parseFloat(cs.opacity) < 1) out.push(`${b.id} is faded to ${cs.opacity}`);
          if (cs.backgroundColor === 'rgba(0, 0, 0, 0)') out.push(`${b.id} has no fill`);
        });

        // Confirmed vs not differs in BORDER STYLE, and in nothing else.
        const doneEl = cellFor(blocks.find(b => b.completed).id);
        const todoEl = cellFor(blocks.find(b => !b.completed && b.id !== 'r3').id);
        const dcs = getComputedStyle(doneEl), tcs = getComputedStyle(todoEl);
        if (dcs.borderTopStyle !== 'solid') out.push(`a confirmed block's border is ${dcs.borderTopStyle}`);
        if (tcs.borderTopStyle !== 'dashed') out.push(`an unconfirmed block's border is ${tcs.borderTopStyle}`);
        if (dcs.opacity !== tcs.opacity) out.push('confirmed and unconfirmed differ in opacity, not just border');

        // --missed is retired: an unticked morning is not a reprimand.
        if (strip.querySelector('.td-rib-cell--missed')) {
          out.push('a passed block is still singled out as missed');
        }
        // The spoken label carries the same figures the strip draws, and lives
        // on the button — the strip itself is aria-hidden, because twenty cells
        // read out one at a time is not a description of a day.
        const btn = document.querySelector('#tdWrap .td-rib-btn');
        if (!btn) return ['the ribbon does not open anything'];
        const label = btn.getAttribute('aria-label') || '';
        if (!label.includes(`${doneBlocks} of ${blocks.length}`)) {
          out.push(`the spoken label reads "${label}", which is not ${doneBlocks} of ${blocks.length}`);
        }
        /* ONE control, not twenty. The cells were never tappable — a 14px square
           is not a reachable target — and making the strip open the day must not
           turn each cell into its own tab stop. */
        if (strip.querySelector('button, [onclick], [role="button"], a[href]')) {
          out.push('the ribbon has tappable cells — the strip is one control, not twenty');
        }
        const hit = btn.getBoundingClientRect();
        if (hit.height < 44) out.push(`the ribbon's tap target is ${Math.round(hit.height)}px tall`);

        /* DRAWN TO SCALE. Equal squares said how many things were on the day and
           nothing about its shape: a five-minute vitamin and a five-hour school
           day drew the same box. School is ten times piano's length, so its cell
           has to be about ten times as wide. Ratios rather than absolutes, with
           room for the minimum-width floor on the small ones. */
        const w = id => {
          const i = blocks.findIndex(b => b.id === id);
          return cells[i].getBoundingClientRect().width;
        };
        const ratio = w('r2') / w('r3');   // 300 minutes against 60
        if (ratio < 3.5) out.push(`a 5h block is only ${ratio.toFixed(1)}× the width of a 1h one`);
        // Gaps are real empty space, not a uniform separator.
        if (!strip.querySelector('.td-rib-gap')) out.push('the day has holes in it and the ribbon shows none');
        // And the marker says where in that shape she is.
        const marker = strip.querySelector('.td-rib-now');
        if (!marker) out.push('the ribbon does not say where in the day she is');

        // Twenty blocks on a phone: one row, inside the viewport, no scroller.
        setDayBlocks(key, Array.from({ length: 20 }, (_, i) => ({
          id: 'd' + i, actId: 'piano', startMin: 6 * 60 + i * 40, durationMin: 30,
          completed: i < 9,
        })), 'jenn');
        goToday();
        /* TAPPING IT OPENS THE DAY SCREEN — the surface that already draws today
           at absolute times with its breaks and free stretches. Deliberately not
           a second copy of the day unfolded here: four renderings of one day have
           been retired in this app already (CLAUDE.md). */
        document.querySelector('#tdWrap .td-rib-btn').click();
        if (document.querySelector('.screen.active').id !== 'screen-day') {
          out.push('tapping the ribbon does not open the day');
        }
        goToday();

        const s2 = document.querySelector('#tdWrap .td-rib-strip');
        const c2 = [...s2.querySelectorAll('.td-rib-cell')];
        if (c2.length !== 20) out.push(`${c2.length} cells for 20 blocks`);
        const box = s2.getBoundingClientRect(), cell = c2[0].getBoundingClientRect();
        const rows = Math.round(box.height / Math.max(1, cell.height));
        if (rows > 1) out.push(`20 blocks wrapped onto ${rows} rows on a phone`);
        if (box.right > window.innerWidth + 1) {
          out.push(`the ribbon runs ${Math.round(box.right - window.innerWidth)}px past the screen edge`);
        }
        if (document.body.scrollWidth > window.innerWidth + 1) {
          out.push('the ribbon put a horizontal scrollbar on the page');
        }
      } finally {
        Date = RealDate;
        setDayBlocks(key, before, 'jenn');
        goToday();
      }
      return out;
    });
    /* ── And on an iPad in landscape ──────────────────────────────────────
       Everything above ran at 390px. At 980px and up in landscape .td-wrap
       becomes a 1.42fr 1fr grid and the ribbon moves into the NARROWER right
       column — so "it fits" at phone width says nothing about the width it
       actually has to survive. Its column, not the viewport, is the edge that
       matters here: a strip inside a 1fr column can overflow its column while
       sitting comfortably inside the window. */
    await page.setViewportSize({ width: 1024, height: 768 });
    const land = await page.evaluate(() => {
      profile = 'jenn'; parentViewing = 'jenn'; selectProfile('jenn');
      const out = [];
      const key = todayKey();
      const before = (getDayBlocks(key, 'jenn') || []).slice();
      const RealDate = Date;
      const when = new RealDate(); when.setHours(15, 30, 0, 0);
      Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(when); };
      Date.prototype = RealDate.prototype;
      Date.now = () => when.getTime(); Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
      try {
        setDayBlocks(key, [
          { id: 'r1', actId: 'breakfast', startMin: 8 * 60, durationMin: 30, completed: true },
          { id: 'r2', actId: 'school', startMin: 9 * 60, durationMin: 300, completed: true },
          { id: 'r3', actId: 'piano', startMin: 15 * 60, durationMin: 60 },
          { id: 'r4', actId: 'homework', startMin: 16 * 60 + 30, durationMin: 45 },
          { id: 'r5', actId: 'dinner', startMin: 18 * 60, durationMin: 45 },
          { id: 'r6', actId: 'reading', startMin: 20 * 60, durationMin: 30 },
        ], 'jenn');
        goToday();

        const side = document.querySelector('#tdWrap .td-col--side');
        const strip = document.querySelector('#tdWrap .td-rib-strip');
        const btn = document.querySelector('#tdWrap .td-rib-btn');
        if (!side || !strip || !btn) return ['the ribbon is not in the side column at landscape'];

        const sBox = side.getBoundingClientRect(), box = strip.getBoundingClientRect();
        if (box.right > sBox.right + 1) {
          out.push(`the ribbon runs ${Math.round(box.right - sBox.right)}px past its own column`);
        }
        const cells = [...strip.querySelectorAll('.td-rib-cell')];
        if (cells.length !== 6) out.push(`${cells.length} cells for 6 blocks at landscape`);
        const rows = Math.round(box.height / Math.max(1, cells[0].getBoundingClientRect().width ? cells[0].getBoundingClientRect().height : 1));
        if (rows > 1) out.push(`the ribbon wrapped onto ${rows} rows in its column`);
        // Still to scale in a column half the width — 5h against 1h.
        const ratio = cells[1].getBoundingClientRect().width / cells[2].getBoundingClientRect().width;
        if (ratio < 3.5) out.push(`at landscape a 5h block is only ${ratio.toFixed(1)}× a 1h one`);
        if (!strip.querySelector('.td-rib-now')) out.push('the now-marker is gone at landscape');
        const hit = btn.getBoundingClientRect();
        if (hit.height < 44) out.push(`the landscape tap target is ${Math.round(hit.height)}px tall`);
        if (document.body.scrollWidth > window.innerWidth + 1) {
          out.push('the ribbon put a horizontal scrollbar on an iPad in landscape');
        }

        /* A DAY THAT OVERLAPS ITSELF STILL FITS.
           The case every other fixture here misses, and the one that actually
           broke: a block whose get-ready begins inside the block before it —
           the clash this screen draws in red. Measured from its own start its
           cell claims minutes the previous cell has already drawn, the row adds
           up to more than 100%, and on a nowrap flex row with nothing to shrink
           the last cell goes straight through the right edge of the column.
           It shipped that way and no assertion saw it; a screenshot did. */
        setDayBlocks(key, [
          { id: 'o1', actId: 'math', startMin: 14 * 60, durationMin: 45, completed: true },
          { id: 'o2', actId: 'piano', startMin: 15 * 60 + 30, durationMin: 30 },
          { id: 'o3', actId: 'training', tag: 'swimming', startMin: 16 * 60, durationMin: 60,
            getReadyBuffer: true, getReadyBufMin: 10, travelBuffer: true, travelBufMin: 15 },
          { id: 'o4', actId: 'dinner', startMin: 17 * 60 + 30, durationMin: 45 },
        ], 'jenn');
        goToday();
        const oSide = document.querySelector('#tdWrap .td-col--side');
        const oStrip = document.querySelector('#tdWrap .td-rib-strip');
        const oBox = oStrip.getBoundingClientRect(), oCol = oSide.getBoundingClientRect();
        if (oBox.right > oCol.right + 1) {
          out.push(`an overlapping day pushes the ribbon ${Math.round(oBox.right - oCol.right)}px past its column`);
        }
        // The row itself must not add up to more than one day.
        const sum = [...oStrip.children]
          .filter(el => el.classList.contains('td-rib-cell') || el.classList.contains('td-rib-gap'))
          .reduce((a, el) => a + parseFloat(el.style.flexBasis || el.style.flex || 0), 0);
        if (sum > 100.5) out.push(`the ribbon's segments add up to ${sum.toFixed(1)}% of the day`);
        if (document.body.scrollWidth > window.innerWidth + 1) {
          out.push('an overlapping day put a horizontal scrollbar on the page');
        }
      } finally {
        Date = RealDate;
        setDayBlocks(key, before, 'jenn');
        goToday();
      }
      return out;
    });

    await page.setViewportSize({ width: 900, height: 1100 });
    await page.evaluate(() => goToday());
    const all = bad.concat(land);
    return all.length === 0 || all;
  })();

  /* THE HERO OWNS THE RUNNING BLOCK, AND OWNS IT ALONE.
     The screen used to draw it twice: a NOW card saying "now · started 8:15am"
     with a green ✓, and — four centimetres below — the very same block as a card
     with a ✓ of its own. Two controls for one action, two glyphs for one meaning,
     and no way for a child to tell which tick did what. The hero is the only
     place it appears and the only place it can be closed, and its button is the
     🎯 the cards below carry rather than a tick that could be mistaken for the
     one marking history. */
  checks.theHeroIsTheOnlyPlaceTheRunningBlockAppears = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn'; selectProfile('jenn');
    const out = [];
    const key = todayKey();
    const before = (getDayBlocks(key, 'jenn') || []).slice();
    const RealDate = Date;
    const when = new RealDate(); when.setHours(9, 30, 0, 0);
    Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(when); };
    Date.prototype = RealDate.prototype;
    Date.now = () => when.getTime(); Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
    try {
      setDayBlocks(key, [
        { id: 'h1', actId: 'piano',    startMin: 9 * 60,  durationMin: 60 },
        { id: 'h2', actId: 'homework', startMin: 11 * 60, durationMin: 45 },
      ], 'jenn');
      goToday();

      if (!document.querySelector('#tdWrap .td-now')) return ['there is no NOW card'];
      // Open both folds FIRST: each toggle re-renders the wrap, and a node held
      // across that render is detached — which measures 0×0 and computes as
      // unstyled, so every assertion below would be about a corpse.
      if (tdEarlierOpen()) tdToggleEarlier();
      if (!tdLaterOpen()) tdToggleLater();

      const tick = document.querySelector('#tdWrap .td-now .td-now-tick');
      if (!tick) return ['the running block cannot be closed from the hero'];
      if (tick.getAttribute('data-td-block') !== 'h1') {
        out.push('the hero tick does not point at the running block');
      }
      const listed = [...document.querySelectorAll('#tdWrap .quest-card [data-td-block="h1"]')];
      if (listed.length) out.push(`the running block is on the hero AND ${listed.length}× in the list`);

      /* ONE GLYPH FOR ONE ACTION. The hero button and the card buttons are the
         same control in two sizes, so they must not differ in anything else. */
      const row = document.querySelector('#tdWrap .quest-complete-btn');
      if (!row) out.push('no card carries a completion button to compare against');
      else {
        if (tick.textContent.trim() !== row.textContent.trim()) {
          out.push(`the hero says "${tick.textContent.trim()}" where a card says "${row.textContent.trim()}"`);
        }
        const a = getComputedStyle(tick), b = getComputedStyle(row);
        if (a.backgroundColor !== b.backgroundColor) out.push('the hero button is not the cards\' green');
        if (a.borderTopWidth !== b.borderTopWidth) out.push('the hero button is not the cards\' border');
        if (a.borderRadius !== b.borderRadius) out.push('the hero button is not the cards\' shape');
      }
      // Still past the 44px floor, and still one completion path.
      const box = tick.getBoundingClientRect();
      if (box.width < 44 || box.height < 44) {
        out.push(`the hero button is ${Math.round(box.width)}×${Math.round(box.height)}px`);
      }
      if (tick.getAttribute('data-td-action') !== 'blast') {
        out.push('the hero does not route through the one completion path');
      }
    } finally {
      Date = RealDate;
      setDayBlocks(key, before, 'jenn');
      goToday();
    }
    return out.length === 0 || out;
  });

  /* THE HERO COUNTS DOWN.
     "now · started 8:15am" is the time she is already past, and it left her to
     work out how much longer she had. The window and what is left of it, with
     the same fact drawn underneath so it can be glanced at. The bar is checked
     at two clock times because a bar that renders once and never moves looks
     identical to a working one in a single screenshot. */
  checks.theHeroCountsDownTheBlockSheIsIn = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn'; selectProfile('jenn');
    const out = [];
    const key = todayKey();
    const before = (getDayBlocks(key, 'jenn') || []).slice();
    const RealDate = Date;
    const pin = (h, m) => {
      const when = new RealDate(); when.setHours(h, m, 0, 0);
      Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(when); };
      Date.prototype = RealDate.prototype;
      Date.now = () => when.getTime(); Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
    };
    const read = () => {
      const sub = document.querySelector('#tdWrap .td-now-sub');
      const bar = document.querySelector('#tdWrap .td-now-bar');
      const fill = document.querySelector('#tdWrap .td-now-bar-fill');
      return {
        text: sub ? sub.textContent.replace(/\s+/g, ' ').trim() : '',
        pct: (bar && fill)
          ? fill.getBoundingClientRect().width / Math.max(1, bar.getBoundingClientRect().width)
          : null,
      };
    };
    try {
      // 9:00–10:00. A quarter through at 9:15, three quarters through at 9:45.
      setDayBlocks(key, [{ id: 'cd1', actId: 'piano', startMin: 9 * 60, durationMin: 60 }], 'jenn');
      pin(9, 15); goToday();
      const early = read();
      if (!/9:00–10:00am/.test(early.text)) out.push(`the hero does not give the window: "${early.text}"`);
      if (!/45m left/.test(early.text)) out.push(`the hero does not count down: "${early.text}"`);
      if (early.pct === null) return ['the countdown is not drawn'];

      pin(9, 45); goToday();
      const late = read();
      if (!/15m left/.test(late.text)) out.push(`the countdown did not move: "${late.text}"`);
      if (!(late.pct > early.pct + 0.2)) {
        out.push(`the bar sat at ${Math.round(early.pct * 100)}% then ${Math.round(late.pct * 100)}%`);
      }
      // No second clock: absolute time belongs to the day screen.
      const heroTxt = document.querySelector('#tdWrap .td-now').textContent;
      if (/\b9:4[0-9](am)?\b/.test(heroTxt)) out.push('the hero has grown a clock');
    } finally {
      Date = RealDate;
      setDayBlocks(key, before, 'jenn');
      goToday();
    }
    return out.length === 0 || out;
  });

  /* A SHORT GAP IS A BREAK; A LONG ONE IS FREE TIME. NEVER BOTH.
     Two descriptions of one stretch is a screen contradicting itself, so the
     thresholds have to meet exactly: under TD_FREE_MIN it is a break chip, from
     TD_FREE_MIN up it is the free-time card that already existed, and neither
     case may produce the other. */
  checks.aShortGapReadsAsABreak = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn'; selectProfile('jenn');
    const out = [];
    const key = todayKey();
    const before = (getDayBlocks(key, 'jenn') || []).slice();
    const wasLater = tdLaterOpen();
    const RealDate = Date;
    const when = new RealDate(); when.setHours(9, 30, 0, 0);
    Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(when); };
    Date.prototype = RealDate.prototype;
    Date.now = () => when.getTime(); Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
    try {
      if (!tdLaterOpen()) tdToggleLater();
      /* 9–10, then fifteen minutes, then 10:15–11, then fifteen more. The hero
         names the gap it is standing in front of; the list threads the one
         between the two cards it shows. */
      setDayBlocks(key, [
        { id: 'b1', actId: 'piano',    startMin: 9 * 60,       durationMin: 60 },
        { id: 'b2', actId: 'homework', startMin: 10 * 60 + 15, durationMin: 45 },
        { id: 'b3', actId: 'reading',  startMin: 11 * 60 + 15, durationMin: 45 },
      ], 'jenn');
      goToday();
      const chip = document.querySelector('#tdWrap .td-now-next .td-break-chip');
      if (!chip) out.push('the hero does not name the break before the next thing');
      else if (!/15m/.test(chip.textContent)) {
        out.push(`the hero calls it "${chip.textContent.trim()}", not a 15m break`);
      }
      const conn = [...document.querySelectorAll('#tdWrap .td-gap-break')];
      if (conn.length !== 1) out.push(`${conn.length} break connectors in the list, expected 1`);
      if (document.querySelector('#tdWrap .quest-card--free')) {
        out.push('a 15-minute gap was also drawn as free time');
      }
      // A connector is a readout, not a third thing to do.
      if (conn[0] && conn[0].querySelector('button, [data-td-action]')) {
        out.push('the break connector is tappable');
      }

      /* Forty-five minutes is over TD_FREE_MIN, so it is free time and gets the
         card it always got — and no chip, because the card already says it. */
      setDayBlocks(key, [
        { id: 'b1', actId: 'piano',    startMin: 9 * 60,       durationMin: 60 },
        { id: 'b2', actId: 'homework', startMin: 10 * 60 + 45, durationMin: 45 },
      ], 'jenn');
      goToday();
      if (!document.querySelector('#tdWrap .quest-card--free')) {
        out.push('a 45-minute hole was not named as free time');
      }
      if (document.querySelector('#tdWrap .td-break-chip')) {
        out.push('free time was also called a break');
      }
    } finally {
      Date = RealDate;
      if (tdLaterOpen() !== wasLater) tdToggleLater();
      setDayBlocks(key, before, 'jenn');
      goToday();
    }
    return out.length === 0 || out;
  });

  /* A BLOCK YOU TRAVEL TO STARTS WHEN YOU START GETTING READY.
     Swimming at four o'clock does not mean leaving the house at four o'clock:
     with ten minutes of kit and fifteen in the car, the first minute she has to
     do something is 3:35, and a card leading with 4:00 names a time she is
     already late for. The card leads with the actionable minute and the block's
     own start follows it, so it still tells the truth about when swimming is.

     The size assertion is the load-bearing one. A get-ready time shrunk to a
     footnote on a folded card is exactly the case where it matters most — she
     is looking at the rest of the day, not the next hour — so .quest-time must
     compute identically on the --next card, a plain card and a quiet one. */
  checks.aBlockYouTravelToStartsWhenYouStartGettingReady = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn'; selectProfile('jenn');
    const out = [];
    const key = todayKey();
    const before = (getDayBlocks(key, 'jenn') || []).slice();
    const wasLater = tdLaterOpen();
    const RealDate = Date;
    const when = new RealDate(); when.setHours(13, 0, 0, 0);
    Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(when); };
    Date.prototype = RealDate.prototype;
    Date.now = () => when.getTime(); Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
    const travel = (id, startMin) => ({
      id, actId: 'training', tag: 'swimming', startMin, durationMin: 60,
      getReadyBuffer: true, getReadyBufMin: 10, travelBuffer: true, travelBufMin: 15,
    });
    try {
      if (!tdLaterOpen()) tdToggleLater();
      /* Five blocks she has to travel to. Spaced by exactly 85 minutes — the
         hour they run plus the 25 of kit and car in front of the next one — so
         each one's get-ready begins the moment the last one ends and no free
         stretch or break comes between them. Free-time cards are legitimate
         items and would otherwise spend the loud slots, leaving no plain block
         card in the loud list to compare the folded ones against. */
      setDayBlocks(key, [0, 1, 2, 3, 4].map(i => travel('tv' + i, 16 * 60 + i * 85)), 'jenn');
      goToday();

      // :not(--free) throughout — a free stretch legitimately sits above the
      // block it precedes, and it is not the card under test.
      const first = document.querySelector('#tdWrap .quest-card:not(.quest-card--free)');
      if (!first) return ['no block cards rendered'];
      const lead = first.querySelector('.quest-time').textContent.trim();
      // 4:00pm minus 15m travel minus 10m getting ready.
      if (lead !== '3:35pm') out.push(`the card leads with ${lead}, not the 3:35pm she has to move at`);
      if (!/get ready/i.test(first.textContent)) out.push('the card does not say what 3:35pm is');
      if (!/4:00pm/.test(first.textContent)) out.push('the card no longer says when swimming actually is');

      /* The one number the app is allowed to compute here is the one
         wfBufferSegments already computes for the week grid and the print sheet.
         Not a second calculation — the same one. */
      const blocks = tdQuestsToday('jenn');
      const seg = wfBufferSegments(blocks[0]).filter(s => s.side === 'pre')
        .sort((a, b) => a.startRel - b.startRel)[0];
      if (formatQuestTime(seg.startRel + START_MIN) !== lead) {
        out.push('the card\'s time is not the one wfBufferSegments gives');
      }

      // Same size and colour wherever the card sits.
      const at = sel => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return cs.fontSize + '/' + cs.color;
      };
      const next = at('#tdWrap .quest-card--next .quest-time');
      const plain = at('#tdWrap .dq-list:not(.dq-list--quiet) .quest-card:not(.quest-card--next):not(.quest-card--free) .quest-time');
      const quiet = at('#tdWrap .dq-list--quiet .quest-card:not(.quest-card--free) .quest-time');
      if (!next || !plain || !quiet) {
        out.push('the fixture did not produce a next, a plain and a folded card');
      } else {
        if (next !== plain) out.push(`the next card's time is ${next}, a plain one's is ${plain}`);
        if (next !== quiet) out.push(`the next card's time is ${next}, a folded one's is ${quiet}`);
      }

      /* AND THE LIST IS ORDERED BY IT. A 6:30 skate she has to leave for at 5:50
         belongs where 5:50 belongs — sorting by the block's own start put it
         under a six o'clock block she would already have left the house for. */
      setDayBlocks(key, [
        travel('tv-late', 18 * 60 + 30),                                        // needs her at 6:05
        { id: 'tv-mid', actId: 'homework', startMin: 18 * 60, durationMin: 30 }, // starts at 6:00
      ], 'jenn');
      goToday();
      const order = [...document.querySelectorAll('#tdWrap .quest-card:not(.quest-card--free) .quest-time')]
        .map(e => e.textContent.trim());
      if (order[0] !== '6:00pm') out.push(`the list opens at ${order[0]}, not the 6:00pm homework`);
      if (order[1] !== '6:05pm') out.push(`the skate she must leave for sits at ${order[1]}, not 6:05pm`);

      // A block with no buffers is untouched: one time, and it is its own.
      setDayBlocks(key, [{ id: 'tv-plain', actId: 'piano', startMin: 16 * 60, durationMin: 60 }], 'jenn');
      goToday();
      const plainCard = document.querySelector('#tdWrap .quest-card:not(.quest-card--free)');
      if (plainCard.querySelector('.quest-ready-lab')) {
        out.push('a block with no travel was given a get-ready time');
      }
      if (plainCard.querySelector('.quest-time').textContent.trim() !== '4:00pm') {
        out.push('a block with no travel no longer leads with its own start');
      }
    } finally {
      Date = RealDate;
      if (tdLaterOpen() !== wasLater) tdToggleLater();
      setDayBlocks(key, before, 'jenn');
      goToday();
    }
    return out.length === 0 || out;
  });

  /* A CLASH READS THE SAME WAY IT DOES ON THE WEEK.
     Piano runs 3:30–4:00 but swimming's get-ready starts at 3:35, so the plan
     is not workable. computeBufferConflicts already finds this and the week grid
     already draws it in red; Today asks the same function and uses the same red,
     because two screens flagging one problem two different ways is how a child
     learns to trust neither. Both blocks it names take the frame — a clash has
     two sides and blaming one of them is arbitrary. */
  checks.todayFlagsAClashTheSameWayTheWeekDoes = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn'; selectProfile('jenn');
    const out = [];
    const key = todayKey();
    const before = (getDayBlocks(key, 'jenn') || []).slice();
    const RealDate = Date;
    const when = new RealDate(); when.setHours(15, 40, 0, 0);
    Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(when); };
    Date.prototype = RealDate.prototype;
    Date.now = () => when.getTime(); Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
    const swim = start => ({
      id: 'cf-swim', actId: 'training', tag: 'swimming', startMin: start, durationMin: 60,
      getReadyBuffer: true, getReadyBufMin: 10, travelBuffer: true, travelBufMin: 15,
    });
    try {
      setDayBlocks(key, [
        { id: 'cf-read', actId: 'piano', startMin: 15 * 60 + 30, durationMin: 30 },
        swim(16 * 60),
      ], 'jenn');
      goToday();

      // The owner's own answer, which is the only one Today is allowed to have.
      const { affected } = computeBufferConflicts(tdQuestsToday('jenn'));
      if (affected.size !== 2) return [`the fixture does not clash: ${affected.size} blocks affected`];

      // Piano is running, so it is on the hero; swimming is the next card.
      const hero = document.querySelector('#tdWrap .td-now');
      if (!hero.classList.contains('td-now--conflict')) {
        out.push('the running block is in a clash and the hero does not show it');
      }
      const card = document.querySelector('#tdWrap .quest-card:not(.quest-card--free)');
      if (!card.classList.contains('quest-card--conflict')) {
        out.push('the block it clashes with is not framed');
      }
      /* The frame composes with the tier rather than replacing it: the next block
         is still the next block whether or not its buffers fit, and dropping
         --next would leave the screen with no T2 card for the hero's NEXT line
         to agree with. */
      if (!card.classList.contains('quest-card--next')) {
        out.push('a clashing next block stopped being the next block');
      }
      if (!card.querySelector('.quest-conflict-flag')) out.push('the clash has no flag');
      const note = card.querySelector('.quest-conflict-note');
      if (!note) out.push('the card does not say what it clashes with');
      else if (!/Piano/.test(note.textContent)) {
        out.push(`the note reads "${note.textContent.trim()}" and does not name the piano it runs into`);
      }
      // Stated, never scolded — off days and imperfect plans are valid states.
      const said = (note ? note.textContent : '') + hero.textContent;
      if (/late|missed|failed|should|too slow/i.test(said)) {
        out.push(`a clash is worded as a telling-off: "${said.replace(/\s+/g, ' ').trim()}"`);
      }

      /* AND IT GOES AWAY WHEN THE PLAN WORKS. Move reading an hour earlier and
         the buffers fit, so nothing is framed — a warning that never clears is
         one a child learns to ignore. */
      setDayBlocks(key, [
        { id: 'cf-read', actId: 'piano', startMin: 14 * 60, durationMin: 30 },
        swim(16 * 60),
      ], 'jenn');
      goToday();
      if (document.querySelector('#tdWrap .quest-card--conflict, #tdWrap .td-now--conflict')) {
        out.push('a day whose buffers fit is still flagged as clashing');
      }
    } finally {
      Date = RealDate;
      setDayBlocks(key, before, 'jenn');
      goToday();
    }
    return out.length === 0 || out;
  });

  /* A REPEAT IS NUMBERED; A ONE-OFF IS NOT.
     Five homework blocks in one day drew five identical cards, with nothing to
     say which was which. The rule is conditional and per-day: one Homework
     stays "Homework", five become Block 1…5.

     Numbered by startMin and not by the order the caller holds them in. Today
     sorts its list by tdActionableStart and the day view lays blocks out by
     position; if the number followed either, Block 2 would be a different block
     on the two screens — which is the drift the shared helper exists to stop,
     so both are asserted here against the same day. */
  checks.repeatsAreNumberedWithinTheDay = await page.evaluate(() => {
    profile = 'jenn'; parentViewing = 'jenn'; selectProfile('jenn');
    const out = [];
    const key = todayKey();
    const before = (getDayBlocks(key, 'jenn') || []).slice();
    const wasLater = tdLaterOpen();
    const RealDate = Date;
    const when = new RealDate(); when.setHours(9, 30, 0, 0);
    Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(when); };
    Date.prototype = RealDate.prototype;
    Date.now = () => when.getTime(); Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
    try {
      if (!tdLaterOpen()) tdToggleLater();
      /* Three maths and one piano. Deliberately seeded out of time order so a
         helper that numbered by array position rather than by clock would be
         caught. */
      setDayBlocks(key, [
        { id: 'rp-c', actId: 'math',  startMin: 13 * 60, durationMin: 45 },
        { id: 'rp-a', actId: 'math',  startMin: 9 * 60,  durationMin: 60 },
        { id: 'rp-solo', actId: 'piano', startMin: 15 * 60, durationMin: 45 },
        { id: 'rp-b', actId: 'math',  startMin: 11 * 60, durationMin: 45 },
      ], 'jenn');
      goToday();

      const n = id => {
        const r = blockDisplayName(getDayBlocks(key, 'jenn').find(b => b.id === id), 'jenn', key);
        return r.n;
      };
      if (n('rp-a') !== 1) out.push(`the 9am maths is Block ${n('rp-a')}, not Block 1`);
      if (n('rp-b') !== 2) out.push(`the 11am maths is Block ${n('rp-b')}, not Block 2`);
      if (n('rp-c') !== 3) out.push(`the 1pm maths is Block ${n('rp-c')}, not Block 3`);
      // The condition: a thing that does not repeat is not numbered.
      if (n('rp-solo') !== 0) out.push(`the one piano block was numbered Block ${n('rp-solo')}`);

      // On screen: the hero is the 9am maths, so it is Block 1.
      const hero = document.querySelector('#tdWrap .td-now-name');
      if (!/Block 1\b/.test(hero.textContent)) {
        out.push(`the hero reads "${hero.textContent.replace(/\s+/g, ' ').trim()}"`);
      }
      const tags = [...document.querySelectorAll('#tdWrap .quest-card .td-blk')]
        .map(e => e.textContent.trim());
      if (!tags.includes('Block 2') || !tags.includes('Block 3')) {
        out.push(`the cards read ${JSON.stringify(tags)}`);
      }
      // And the piano card carries no number at all.
      const pianoCard = [...document.querySelectorAll('#tdWrap .quest-card')]
        .find(c => /Piano/.test(c.textContent));
      if (pianoCard && pianoCard.querySelector('.td-blk')) {
        out.push('the one piano block was given a number on its card');
      }

      /* AND THE DAY SCREEN AGREES. Both read blockDisplayName on the same day,
         so a block Today calls Block 2 cannot be Block 3 over there. */
      openDayFromWeekCard(key, tdTodayIndex(), null);
      const dayTxt = document.getElementById('screen-day').textContent;
      if (!/Block 1/.test(dayTxt) || !/Block 3/.test(dayTxt)) {
        out.push('the day screen does not number the same repeats');
      }
      goToday();
    } finally {
      Date = RealDate;
      if (tdLaterOpen() !== wasLater) tdToggleLater();
      setDayBlocks(key, before, 'jenn');
      goToday();
    }
    return out.length === 0 || out;
  });

  /* ONE ANSWER FOR WHAT COLOUR A BLOCK IS.
     The formula was written out four times — the week grid twice, the day view
     and the print sheet — and two had already drifted: an unknown category came
     out green on the week grid and grey everywhere else. Today's ribbon colours
     by category now, which would have been a fifth copy.

     A training block is the interesting case: Skating and Swimming are both cat
     'training' and must NOT be the same pink, so a formula that reached for the
     category first would collapse them together. */
  checks.oneAnswerForWhatColourABlockIs = await page.evaluate(() => {
    const out = [];
    const skate = { id: 'c1', actId: 'training', tag: 'skating', startMin: 9 * 60, durationMin: 60 };
    const swim = { id: 'c2', actId: 'training', tag: 'swimming', startMin: 11 * 60, durationMin: 60 };
    const piano = { id: 'c3', actId: 'piano', startMin: 13 * 60, durationMin: 60 };
    const picked = { id: 'c4', actId: 'piano', startMin: 15 * 60, durationMin: 60, colour: '#123456' };

    if (blockColour(skate, 'jenn') === blockColour(swim, 'jenn')) {
      out.push('skating and swimming come out the same colour');
    }
    // The topic beats the category for training…
    if (blockColour(skate, 'jenn') !== getTrainingTopic('skating').colour) {
      out.push('a skating block is not its topic colour');
    }
    // …and an explicit choice beats the category for everything else.
    if (blockColour(picked, 'jenn') !== '#123456') out.push('a hand-picked colour was ignored');
    if (blockColour(piano, 'jenn') !== CAT_HEX[findActivity('piano', 'jenn').cat]) {
      out.push('a plain block is not its category colour');
    }
    // An unknown activity has one fallback, not two.
    if (blockColour({ id: 'c5', actId: 'nope-not-real' }, 'jenn') !== '#888') {
      out.push('an unknown activity does not fall back to the one grey');
    }
    // And nothing computes it for itself any more.
    if (typeof blockColour !== 'function') out.push('blockColour is not the owner');
    return out.length === 0 || out;
  });

  /* THE UNDO TOAST IS STRUCTURALLY OUTSIDE THE BUDGET.
     One line, and it exists to say why. The word-budget sweep and the 44px probe
     both walk only #screen-today; move this node inside "to keep the markup
     together" and every viewport starts failing intermittently, depending on
     whether a six-second timer happened to be running when the sweep ran. */
  checks.theUndoToastIsOutsideTheWordBudget = await page.evaluate(() => {
    const bad = [];
    const box = document.getElementById('undoToast');
    if (!box) return ['there is no undo toast'];
    if (document.getElementById('screen-today').contains(box)) {
      bad.push('the undo toast is inside #screen-today, where the word budget counts it');
    }
    if (!box.hidden) bad.push('the undo toast is showing when nothing has been completed');
    return bad.length === 0 || bad;
  });

  /* COMPLETING OFFERS A WAY BACK, AND UNDO PUTS THE BLOCK BACK.
     Both halves in one fixture because the second needs the first. The XP
     assertion is the interesting one: it holds a deliberate decision in place
     rather than a behaviour — undo un-ticks the block and the level bar does not
     move, because a child who mis-tapped should not watch her level go
     backwards. Without this, the next reader "fixes" it. */
  checks.undoPutsTheBlockBackButKeepsTheXp = await (async () => {
    const setup = await page.evaluate(() => {
      profile = 'jenn'; parentViewing = 'jenn'; selectProfile('jenn');
      const key = todayKey();
      const RealDate = Date;
      const when = new RealDate(); when.setHours(9, 30, 0, 0);
      Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(when); };
      Date.prototype = RealDate.prototype;
      Date.now = () => when.getTime(); Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
      window.__undoBefore = (getDayBlocks(key, 'jenn') || []).slice();
      window.__realDate = RealDate;
      setDayBlocks(key, [{ id: 'un1', actId: 'piano', startMin: 9 * 60, durationMin: 60 }], 'jenn');
      goToday();
      return { xp: getQuestXP('jenn'), tick: !!document.querySelector('#tdWrap .td-now-tick') };
    });
    const bad = [];
    if (!setup.tick) bad.push('the running block has no tick in the NOW card');
    else {
      await page.evaluate(() => document.querySelector('#tdWrap .td-now-tick').click());
      await page.waitForTimeout(900);   // the blast animation, as todayIsWhereTheDayGetsDone waits
      const after = await page.evaluate(() => {
        const box = document.getElementById('undoToast');
        return {
          done: !!(getDayBlocks(todayKey(), 'jenn')[0] || {}).completed,
          shown: !box.hidden,
          text: (document.getElementById('undoToastText') || {}).textContent || '',
          xp: getQuestXP('jenn'),
        };
      });
      if (!after.done) bad.push('the tick did not complete the block');
      if (!after.shown) bad.push('completing offered no undo');
      if (!/Piano/i.test(after.text)) bad.push(`the toast does not name the block: "${after.text}"`);
      if (!(after.xp > setup.xp)) bad.push('completing awarded no XP');

      const undone = await page.evaluate(() => {
        document.getElementById('undoToastBtn').click();
        return {
          done: !!(getDayBlocks(todayKey(), 'jenn')[0] || {}).completed,
          hidden: document.getElementById('undoToast').hidden,
          xp: getQuestXP('jenn'),
        };
      });
      if (undone.done) bad.push('undo did not put the block back');
      if (!undone.hidden) bad.push('the toast stayed up after undo');
      if (undone.xp !== after.xp) {
        bad.push(`undo moved the XP from ${after.xp} to ${undone.xp}; it is meant to hold`);
      }

      /* toggleBlockDone is a TOGGLE, so undo has to check the block is still
         completed before calling it. The hazard is not a double press — the
         first press clears the toast's target — it is the toast still being up
         when something else un-completes the block underneath it: the day
         screen, or a remote merge landing between the tick and the press.
         Without the guard, pressing undo then RE-completes it and awards
         nothing, silently. Staged here by un-completing behind the toast. */
      const stale = await page.evaluate(() => {
        const key = todayKey();
        showUndoLastCompletion('un1', key, 'Piano Practice');   // toast back up
        toggleBlockDone(key, 'un1');                            // now completed again
        toggleBlockDone(key, 'un1');                            // and not-done again
        document.getElementById('undoToastBtn').click();
        return { done: !!(getDayBlocks(key, 'jenn')[0] || {}).completed };
      });
      if (stale.done) {
        bad.push('undo re-completed a block that was already not-done — toggleBlockDone needs a guard');
      }
    }
    await page.evaluate(() => {
      if (window.__realDate) Date = window.__realDate;
      setDayBlocks(todayKey(), window.__undoBefore || [], 'jenn');
      hideUndoToast();
      goToday();
    });
    return bad.length === 0 || bad;
  })();

  /* THE APP TELLS FAMILY TIME, ON WHATEVER DEVICE IT IS OPENED.
     todayKey() has always been fixed to America/Edmonton, but the TIME of day
     came from the device clock — so the date and the hours inside it were read
     from two different clocks. At home they agree and nothing shows. They come
     apart on a device whose zone is set wrong or a laptop left on another one,
     and then the app draws the "now" line hours from where the child actually
     is in her day, or shows tomorrow's date against today's afternoon.

     This is the only check in the suite that runs in a second timezone. The
     whole rest of the run is pinned to Edmonton precisely so fixtures mean what
     they say, which also means nothing else here can see this class of bug. */
  checks.theAppTellsFamilyTimeOnAnyDevice = await (async () => {
    const away = await browser.newContext({ timezoneId: 'Pacific/Auckland' });
    const p2 = await away.newPage();
    for (const pattern of [
      '**://firestore.googleapis.com/**', '**://*.firebaseio.com/**',
      '**://www.gstatic.com/firebasejs/**', '**://identitytoolkit.googleapis.com/**',
      '**://firebaseinstallations.googleapis.com/**',
    ]) await p2.route(pattern, r => r.abort());
    try {
      await p2.goto('file://' + path.join(__dirname, '..', 'index.html'));
      await p2.waitForTimeout(1200);
      const r = await p2.evaluate(() => {
        const bad = [];
        // What Edmonton says, worked out independently of the app's helpers.
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Edmonton', hour12: false,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit',
        }).formatToParts(new Date()).reduce((o, x) => (o[x.type] = x.value, o), {});
        const wantKey = `${parts.year}-${parts.month}-${parts.day}`;
        const wantMin = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
        // The device is 18-20 hours ahead, so its own clock cannot agree by luck.
        const deviceMin = new Date().getHours() * 60 + new Date().getMinutes();
        if (deviceMin === wantMin) bad.push('the away device is not actually in another timezone');
        if (todayKey() !== wantKey) bad.push(`todayKey is ${todayKey()}, Edmonton says ${wantKey}`);
        if (tdNowMin() !== wantMin) {
          bad.push(`tdNowMin is ${tdNowMin()}, Edmonton says ${wantMin} (device says ${deviceMin})`);
        }
        if (nowMinutesInZone() !== wantMin) bad.push('nowMinutesInZone disagrees with Edmonton');
        // The date and the time of day must come from the same clock, always.
        if (getDayKeys(0).indexOf(todayKey()) < 0) {
          bad.push('today is not in the week the app is showing');
        }
        /* And the header now SAYS which day it is, which makes it a second place
           the app can get this wrong — on a device eighteen hours ahead, a date
           read from new Date() would name tomorrow to a child looking at today. */
        profile = 'jenn'; parentViewing = 'jenn'; selectProfile('jenn');
        goToday();
        const shown = (document.getElementById('tdTodayDate') || {}).textContent || '';
        const wantWeekday = new Intl.DateTimeFormat(undefined, {
          timeZone: 'America/Edmonton', weekday: 'long',
        }).format(new Date());
        const wantDay = String(Number(parts.day));
        if (!shown.trim()) bad.push('the header does not say what day it is');
        else if (!shown.includes(wantWeekday) || !shown.includes(wantDay)) {
          bad.push(`the header reads "${shown}", Edmonton says ${wantWeekday} the ${wantDay}`);
        }
        return bad;
      });
      return r.length === 0 || r;
    } finally {
      await away.close();
    }
  })();

  /* ══ RELEASE 1: the status vocabulary ══════════════════════════════
     Every check below pins something that was DEMONSTRABLY disagreeing between
     screens before this release. They return `true` or the list of what went
     wrong — never a bare truthy value, which is the house rule. */

  /* ONE ANSWER TO "IS THIS ROUTINE DONE?", ON EVERY SCREEN.
     The checklist and the block's completed flag were two records that never
     spoke: ticking every item in Jenn's morning routine left the block reading
     not-done on Today, the week, the portal and the meeting. Then unticking one
     could not take anything back, because the day-level mark was sticky. */
  checks.oneRoutineAnswerOnEveryScreen = await page.evaluate(() => {
    const bad = [];
    const kid = 'jenn';
    profile = 'jenn'; parentViewing = 'jenn'; weekOffset = 0;
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const keys = mrWeekDayKeys(wk);
    const day = keys[0];
    const before = keys.map(k => (getDayBlocks(k, kid) || []).slice());
    const e = mrEnsureEarnings(kid, wk);
    const hadMand = JSON.stringify(getProfData(kid).chore || {});
    try {
      keys.forEach(k => setDayBlocks(k, [], kid));
      /* ctMandatoryPoints is a WEEK-WIDE count and earlier checks in this suite
         have already written into it, so clear this week's marks or every
         assertion below is measuring somebody else's fixture. */
      {
        const pd = getProfData(kid);
        ctEnsureProfile(pd);
        delete pd.chore.mandatoryByWeek[wk];
        if (pd.chore.mandatoryAutoByWeek) delete pd.chore.mandatoryAutoByWeek[wk];
      }
      setDayBlocks(day, [{ id: 'rr1', actId: 'routine_morning', startMin: 7 * 60,
                           durationMin: 30, checklistState: {} }], kid);
      currentDayKey = day; dayViewAnchorKey = day;

      const items = routineItemsFor('morning', kid);
      if (!items.length) bad.push('the morning routine has no items to tick');

      const readAll = () => {
        const b = getDayBlocks(day, kid)[0];
        return {
          shared: isBlockCompleted(b, kid),
          flag: !!b.completed,
          hours: getWeeklyHours(kid, wk).byGroup.routine.completed,
          weekWins: computeWeekWins(keys).done,
          today: (() => { goToday(); const r = document.querySelector('#tdWrap .td-rib-cell--done'); return !!r; })(),
          portal: (() => {
            const st = perfWeekStats(wk, kid);
            return st.byCat.routine ? st.byCat.routine.completed : 0;
          })(),
          meeting: (() => {
            const was = profile; profile = 'parent';
            const html = mm2b(kid, 600);
            profile = was;
            return html;
          })(),
        };
      };

      const zero = readAll();
      if (zero.shared || zero.flag) bad.push('an untouched routine already reads as done');
      if (zero.hours !== 0) bad.push(`an untouched routine counts ${zero.hours} completed minutes`);

      // Tick every item, the way the chore tab's one-tap does.
      {
        const blocks = getDayBlocks(day, kid);
        const b = blocks[0];
        items.forEach(i => { b.checklistState[i.id] = true; });
        syncRoutineCompletion(b, kid);
        ctSyncMandatoryFromRoutine('morning', kid, day, true);
        setDayBlocks(day, blocks, kid);
      }
      const full = readAll();
      if (!full.shared) bad.push('a fully ticked routine does not read as completed');
      if (!full.flag) bad.push('block.completed was not derived from the checklist');
      if (full.hours !== 30) bad.push(`the weekly hours count ${full.hours} routine minutes, expected 30`);
      if (full.weekWins !== 1) bad.push('the week view does not count the routine as done');
      if (!full.today) bad.push('Today does not draw the routine as done');
      if (full.portal !== 30) bad.push(`the parent portal counts ${full.portal} routine minutes, expected 30`);
      if (!/30m \/ 30m/.test(full.meeting)) bad.push('the meeting chart does not show the routine as completed');
      if (ctMandatoryPoints(wk, kid) !== 1) bad.push('the day-level routine mark did not follow the checklist');

      // Untick ONE. Everything has to come back.
      {
        const blocks = getDayBlocks(day, kid);
        const b = blocks[0];
        b.checklistState[items[0].id] = false;
        syncRoutineCompletion(b, kid);
        ctSyncMandatoryFromRoutine('morning', kid, day, false);
        setDayBlocks(day, blocks, kid);
      }
      const partial = readAll();
      if (partial.shared) bad.push('unticking an item left the routine reading as completed');
      if (partial.flag) bad.push('unticking an item left block.completed set');
      if (partial.hours !== 0) bad.push(`unticking left ${partial.hours} completed minutes in the hours`);
      if (partial.weekWins !== 0) bad.push('unticking left the week view counting it as done');
      if (partial.today) bad.push('unticking left Today drawing it as done');
      if (partial.portal !== 0) bad.push('unticking left the parent portal counting it');
      if (ctMandatoryPoints(wk, kid) !== 0) bad.push('the sticky day mark survived an untick');

      /* A parent's OWN tick is not the app's to undo. She is asserting the day
         from memory; a child unticking an item afterwards must not silently
         overrule her. */
      {
        const was = profile; profile = 'parent';
        ctSetMandatory(wk, 0, 'Morning', kid, true);
        profile = was;
      }
      ctSyncMandatoryFromRoutine('morning', kid, day, false);
      if (ctMandatoryPoints(wk, kid) !== 1) bad.push("a child's untick cleared a mark a parent made by hand");

      /* A stale tick from an item that no longer exists is not progress — this
         is what made the same block read 4/3 on one screen and 3/3 on another. */
      {
        const blocks = getDayBlocks(day, kid);
        const b = blocks[0];
        items.forEach(i => { b.checklistState[i.id] = true; });
        b.checklistState['gone-item-nobody-has'] = true;
        const act = findActivity('routine_morning', kid);
        const t = routineTally(b, act, kid);
        if (t.done !== items.length) bad.push(`a removed item's tick still counts (${t.done} of ${t.total})`);
      }

      /* Confirming is not completing. A parent may confirm an unfinished
         routine, and it must not start reading as finished. */
      {
        const blocks = getDayBlocks(day, kid);
        const b = blocks[0];
        b.checklistState = {};
        b.confirmed = true;
        syncRoutineCompletion(b, kid);
        setDayBlocks(day, blocks, kid);
        const c = getDayBlocks(day, kid)[0];
        if (isBlockCompleted(c, kid)) bad.push('confirming an empty checklist made it read as completed');
        if (!isBlockConfirmed(c)) bad.push('the confirmation was lost');
      }
    } finally {
      keys.forEach((k, i) => setDayBlocks(k, before[i], kid));
      getProfData(kid).chore = JSON.parse(hadMand);
      profile = 'jenn'; weekOffset = 0;
    }
    return bad.length === 0 || bad;
  });

  /* CONFIRMING IS NOT REVIEWING, AND IT TICKS WHAT IT CLAIMS TO TICK.
     "Confirm all today" set `confirmed` and nothing else, while every screen
     draws its tick from `completed` — so pressing it moved one badge that is
     hidden on short blocks, and on a busy day nothing visible changed. It also
     repainted only the day timeline, and the meeting's day-confirm wrote BOTH
     girls from one press. */
  checks.confirmingIsNotReviewing = await page.evaluate(async () => {
    const bad = [];
    const wasConfirm = window.showConfirm;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const keys = mrWeekDayKeys(ctWeekKey);
    const day = keys[0];
    const beforeJ = (getDayBlocks(day, 'jenn') || []).slice();
    const beforeS = (getDayBlocks(day, 'jess') || []).slice();
    const store = JSON.parse(JSON.stringify(state.shared.parentDayConfirm || {}));
    try {
      ['jenn', 'jess'].forEach(k => markDayReviewed(k, day, false));
      setDayBlocks(day, [
        { id: 'ca1', actId: 'piano', startMin: 7 * 60, durationMin: 60, checklistState: {} },
        { id: 'ca2', actId: 'french', startMin: 8 * 60, durationMin: 60, checklistState: {} },
      ], 'jenn');
      setDayBlocks(day, [
        { id: 'cs1', actId: 'piano', startMin: 7 * 60, durationMin: 60, checklistState: {} },
      ], 'jess');
      currentDayKey = day;
      window.showConfirm = async () => true;

      await confirmAllBlocksForChild('jenn', day);

      const j = getDayBlocks(day, 'jenn');
      if (!j.every(b => isBlockCompleted(b, 'jenn'))) bad.push('confirm-all left blocks not marked completed');
      if (!j.every(b => isBlockConfirmed(b))) bad.push('confirm-all left blocks unconfirmed');
      const sB = getDayBlocks(day, 'jess');
      if (sB.some(b => isBlockCompleted(b, 'jess') || isBlockConfirmed(b))) bad.push("confirming Jenn touched Jess's day");
      if (isDayReviewed('jenn', day)) bad.push('confirm-all marked the day reviewed');

      await markDayReviewedForChild('jenn', day);
      if (!isDayReviewed('jenn', day)) bad.push('marking the day reviewed did not take');
      if (isDayReviewed('jess', day)) bad.push("reviewing Jenn's day marked Jess's too");
      if (!getDayBlocks(day, 'jenn').every(b => isBlockCompleted(b, 'jenn'))) {
        bad.push('marking the day reviewed changed activity completion');
      }

      // The banner names the child it is acting on.
      renderParentBanners();
      const barTxt = (document.getElementById('parentDayActions') || {}).textContent || '';
      if (!/Jenn/.test(barTxt)) bad.push(`the banner does not name the child: "${barTxt.trim()}"`);

      /* A block later TODAY has not happened, and confirming it would be the
         app inventing a fact. */
      const today = todayKey();
      const beforeToday = (getDayBlocks(today, 'jenn') || []).slice();
      setDayBlocks(today, [
        { id: 'el1', actId: 'piano', startMin: 1, durationMin: 30, checklistState: {} },
        { id: 'el2', actId: 'french', startMin: 23 * 60 + 55, durationMin: 5, checklistState: {} },
      ], 'jenn');
      const elig = dayBlocksEligibleToConfirm(today, 'jenn').map(b => b.id);
      if (elig.includes('el2')) bad.push('a block later today was eligible to be confirmed');
      if (!elig.includes('el1')) bad.push('a block that already started was not eligible');
      setDayBlocks(today, beforeToday, 'jenn');

      /* The meeting reviews ONE child per control, and says "Both" when it
         means both. */
      ['jenn', 'jess'].forEach(k => markDayReviewed(k, day, false));
      openFamilyMeeting(); mmGoStep(1);
      const one = document.querySelector('#familyMeetingBody [data-mm-action="reviewday"][data-kid="jenn"][data-day="0"]');
      if (!one) bad.push('the meeting has no per-child review control');
      else {
        one.click();
        if (!isDayReviewed('jenn', day)) bad.push('the per-child control did not review Jenn');
        if (isDayReviewed('jess', day)) bad.push('reviewing Jenn in the meeting also reviewed Jess');
      }
      const both = document.querySelector('#familyMeetingBody [data-mm-action="confirmday"][data-day="0"]');
      if (!both || !/Both/.test(both.textContent)) bad.push('the meeting does not label the both-children control');
      closeSheet('familyMeetingOverlay');
    } finally {
      window.showConfirm = wasConfirm;
      setDayBlocks(day, beforeJ, 'jenn');
      setDayBlocks(day, beforeS, 'jess');
      state.shared.parentDayConfirm = store;
      profile = 'jenn';
    }
    return bad.length === 0 || bad;
  });

  /* MEALS ARE NOT CHORES. cat:'daily' held breakfast, dinner, the house chore
     and four Family Hero tasks, and was labelled "🧹 Chores" on two screens and
     "🍽 Daily" on three. */
  checks.mealsAreNotChores = await page.evaluate(() => {
    const bad = [];
    const want = {
      breakfast: 'daily', lunch: 'daily', dinner: 'daily', appt_medical: 'daily',
      chores: 'chores', family_set_table: 'chores', family_laundry_fold: 'chores',
      school_day: 'brain', math: 'brain', french: 'brain', piano: 'brain',
      routine_morning: 'routine', health_pack_tomorrow: 'routine',
      training: 'body', competition: 'body',
      family: 'free', relax: 'free', break_quick: 'free', snow_play: 'free',
    };
    Object.keys(want).forEach(id => {
      const got = activityGroup(findActivity(id, 'jenn'));
      if (got !== want[id]) bad.push(`${id} groups as ${got}, expected ${want[id]}`);
    });
    if (GROUP_ORDER.length !== 6) bad.push(`${GROUP_ORDER.length} groups, expected 6`);
    // Every group has a label and a short form that fits a week-grid cell.
    GROUP_ORDER.forEach(g => {
      if (!groupLabel(g)) bad.push(`${g} has no label`);
      if (groupShort(g).length > 7) bad.push(`${g}'s short form "${groupShort(g)}" is too long for the grid`);
    });
    // An activity nothing can resolve is filed, never dropped: an hours total
    // that silently omits blocks is worse than one that files them vaguely.
    if (activityGroup(null) !== 'daily') bad.push('an unresolved activity is not filed anywhere');
    return bad.length === 0 || bad;
  });

  /* A PAST WEEK CANNOT PLAN FORWARD. The last step used to offer "copy this
     week → next week" whatever week the meeting pointed at, and the copy ran
     off the CURRENT week — so a six-week-old sitting wrote its plan over the
     following historical week. */
  checks.aPastWeekCannotPlanForward = await page.evaluate(() => {
    const bad = [];
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const now = ctThisWeekKey();
    const past = dateToLocalKey(new Date(formatDayKey(now).getTime() - 14 * 864e5));
    const future = dateToLocalKey(new Date(formatDayKey(now).getTime() + 14 * 864e5));
    try {
      if (mmWeekPosition(past) !== 'past') bad.push('a two-week-old week is not read as past');
      if (mmWeekPosition(now) !== 'current') bad.push('this week is not read as current');
      if (mmWeekPosition(future) !== 'future') bad.push('a future week is not read as future');

      mmCatchUpAsked = true;
      mmGoToWeek(past); mmGoStep(5);
      const pastBody = document.getElementById('familyMeetingBody').textContent;
      if (/Copy this week/.test(pastBody)) bad.push('a past week still offers to copy itself forward');
      if (/Plan next/.test(pastBody.replace(/\d·Plan next/g, ''))) bad.push('a past week still offers to plan next');
      if (!/Finish reviewing this week/.test(pastBody)) bad.push('a past week does not offer to finish its review');
      if (!/Return to this week/.test(pastBody)) bad.push('a past week offers no way back to the present');

      mmGoToWeek(future); mmGoStep(5);
      const futureBody = document.getElementById('familyMeetingBody').textContent;
      if (!/hasn't happened yet/.test(futureBody)) bad.push('a future week does not say it cannot be reviewed');
      if (/Close the week/.test(futureBody)) bad.push('a future week offers to be closed');

      mmGoToWeek(now); mmGoStep(5);
      const nowBody = document.getElementById('familyMeetingBody').textContent;
      if (!/Close the week/.test(nowBody)) bad.push('the current week cannot be closed');
      if (!/Open next week/.test(nowBody)) bad.push('the current week does not offer to open the next one');

      /* Closing asserts BOTH girls were reviewed and settled, so it must refuse
         until that is true — a record that can claim more than happened is the
         thing this release is removing. */
      if (canCloseWeek(now).ok) bad.push('a week with unreviewed days says it can be closed');
      if (isWeekClosed(now)) bad.push('the week started out closed');
      mmCloseWeekNow();
      if (isWeekClosed(now)) bad.push('the week closed without both girls being reviewed and settled');
      closeSheet('familyMeetingOverlay');
    } finally {
      ctSetCurrentWeekFromPlanner();
      profile = 'jenn';
    }
    return bad.length === 0 || bad;
  });

  /* CELEBRATION COUNTS WHAT HAPPENED. Step 2 counted chores through
     ctGetOptional — `optionalByWeek`, the retired chore-GROUP store that three
     comments in this repo say nothing reads. On a week of real graded work it
     reported zero, and it showed the preliminary money figure as though it had
     been recorded. */
  checks.celebrationCountsWhatHappened = await page.evaluate(() => {
    const bad = [];
    const kid = 'jenn';
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey, keys = mrWeekDayKeys(wk);
    const before = keys.map(k => (getDayBlocks(k, kid) || []).slice());
    const e = mrEnsureEarnings(kid, wk);
    const hadChores = JSON.stringify(e.chores), hadClaims = JSON.stringify(e.claims);
    const hadFinal = JSON.stringify((state.shared.chore.finalizedWeeks || {})[wk] || null);
    try {
      keys.forEach(k => setDayBlocks(k, [], kid));
      e.chores = {}; e.claims = {};
      /* An earlier check settles a week, so clear the frozen figure — otherwise
         "money was recorded" is true and this asserts nothing. */
      if (state.shared.chore.finalizedWeeks) delete state.shared.chore.finalizedWeeks[wk];
      if (state.shared.chore.xpAwardedWeeks) delete state.shared.chore.xpAwardedWeeks[wk];
      // A routine finished by its checklist, and a chore graded by a parent.
      const items = routineItemsFor('morning', kid);
      const st = {}; items.forEach(i => { st[i.id] = true; });
      setDayBlocks(keys[1], [
        { id: 'cel1', actId: 'routine_morning', startMin: 7 * 60, durationMin: 30, checklistState: st, completed: true },
        { id: 'cel2', actId: 'chores', startMin: 17 * 60, durationMin: 30, choreTags: ['dishes'], checklistState: {} },
      ], kid);
      mrSetChoreGrade(kid, wk, 1, 'dishes', 3);

      mmGoToWeek(wk); mmGoStep(2);
      const body = document.getElementById('familyMeetingBody').textContent.replace(/\s+/g, ' ');
      if (!/1\/1 routine kept/.test(body)) bad.push(`routines are not counted from the checklists: "${body.slice(0, 200)}"`);
      if (!/1 chore checked off by a grown-up/.test(body)) bad.push('a graded chore is not celebrated');
      if (!/planned hours completed/.test(body)) bad.push('the hours are not read from the shared computation');
      // The preliminary figure must never be worded as though it were recorded.
      if (/\$[\d.]+ recorded/.test(body)) bad.push('an unsettled week claims money was recorded');

      /* And the retired store must not be able to bring it back to life: fill
         optionalByWeek and the celebration must not change. */
      const withoutLegacy = body;
      ctSetOptional(wk, 2, kid, 'dishes', true);
      mmGoStep(2);
      const after = document.getElementById('familyMeetingBody').textContent.replace(/\s+/g, ' ');
      if (after !== withoutLegacy) bad.push('the celebration still reads the retired chore-group store');
      closeSheet('familyMeetingOverlay');
    } finally {
      keys.forEach((k, i) => setDayBlocks(k, before[i], kid));
      e.chores = JSON.parse(hadChores); e.claims = JSON.parse(hadClaims);
      const fin = JSON.parse(hadFinal);
      if (fin && state.shared.chore.finalizedWeeks) state.shared.chore.finalizedWeeks[wk] = fin;
      profile = 'jenn';
    }
    return bad.length === 0 || bad;
  });

  /* UNDO RETURNS BOTH CHILDREN.
     mnyDoCommit took a fresh snapshot every time it ran, once per child.
     Settling Jenn stored the state before Jenn; settling Jess overwrote it with
     the state AFTER Jenn. Undo then put Jess back, left Jenn's money moved, and
     printed "nothing was recorded" — false, in the one direction the family had
     no way to notice. The snapshot is idempotent per week now. */
  checks.undoReturnsBothChildren = await page.evaluate(() => {
    const bad = [];
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const c = state.shared.chore;
    const keep = {};
    ['finalizedWeeks', 'xpAwardedWeeks', 'moneyLedger', 'weekPlans', 'weekConfirms',
     'meetingsHeld', 'meetingsMet'].forEach(k => {
      keep[k] = (c[k] && c[k][wk]) ? JSON.parse(JSON.stringify(c[k][wk])) : null;
      if (c[k]) delete c[k][wk];
    });
    const hadCash = { jenn: ensureWallet('jenn').cash, jess: ensureWallet('jess').cash };
    const hadUndo = mmUndo;
    try {
      mmUndo = null;
      const read = k => ({
        cash: ensureWallet(k).cash,
        xp: (getProfData(k).progress || {}).questXP || 0,
        committed: isChildMoneyCommitted(k, wk),
      });
      ['jenn', 'jess'].forEach(k => { ensureWallet(k).cash = 5; mnyConfirmWeek(wk, k, 'a grown-up'); });
      const seeded = { jenn: read('jenn'), jess: read('jess') };

      mnySetMeetKid('jenn'); mmStep = 4; mnyDraft = null; mnyRenderDecide(wk);
      mnyDoCommit();
      if (!read('jenn').committed) bad.push("committing Jenn did not settle her week");
      const firstSnapshot = mmUndo;
      if (!firstSnapshot) bad.push('committing took no undo snapshot at all');

      mnySetMeetKid('jess'); mnyDraft = null; mnyRenderDecide(wk);
      mnyDoCommit();
      if (mmUndo !== firstSnapshot) bad.push('settling the second girl replaced the snapshot taken before the first');
      if (!read('jess').committed) bad.push('committing Jess did not settle her week');

      mmUndoRecord();
      const after = { jenn: read('jenn'), jess: read('jess') };
      ['jenn', 'jess'].forEach(k => {
        if (after[k].cash !== seeded[k].cash) bad.push(`${k}'s wallet came back as ${after[k].cash}, expected ${seeded[k].cash}`);
        if (after[k].xp !== seeded[k].xp) bad.push(`${k}'s XP came back as ${after[k].xp}, expected ${seeded[k].xp}`);
        if (after[k].committed) bad.push(`${k} is still settled after the undo`);
      });
      if ((c.moneyLedger || {})[wk]) bad.push('the frozen ledger survived the undo');
      if ((c.meetingsHeld || {})[wk]) bad.push('the week still reads as recorded after the undo');
      if ((c.weekPlans || {})[wk]) bad.push("the girls' money plans survived the undo");
    } finally {
      ['finalizedWeeks', 'xpAwardedWeeks', 'moneyLedger', 'weekPlans', 'weekConfirms',
       'meetingsHeld', 'meetingsMet'].forEach(k => {
        if (!c[k]) return;
        if (keep[k]) c[k][wk] = keep[k]; else delete c[k][wk];
      });
      ensureWallet('jenn').cash = hadCash.jenn;
      ensureWallet('jess').cash = hadCash.jess;
      mmUndo = hadUndo;
      mnyDraft = null;
      profile = 'jenn';
    }
    return bad.length === 0 || bad;
  });

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
