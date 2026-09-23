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
  /* SMOKE_ONLY=checkA,checkB — run a named subset while iterating.

     The full suite is eight to ten minutes; iterating on one check should not
     be. Every check statement is prefixed `if (want('name'))`, which skips that
     one statement and nothing else, so the setup between checks still runs in
     order. What it cannot keep is what a SKIPPED check's own body did to the
     page, so a subset result is a hint, not a verdict — and the subset is never
     the gate: it refuses to run under CI, a typo'd name exits 1 rather than
     running nothing and passing, and it never prints ALL SMOKE CHECKS PASSED.

     The names are read from this file, not listed by hand, so a new check is
     selectable the moment it is written. noConsoleErrors has no guard: an error
     raised by the checks being worked on is exactly what a subset must show. */
  const ONLY = (process.env.SMOKE_ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
  const want = (name) => ONLY.length === 0 || ONLY.includes(name);
  const ALL_CHECKS = [...fs.readFileSync(__filename, 'utf8')
    .matchAll(/^\s*(?:if \(want\('[^']*'\)\) )?checks\.([A-Za-z0-9_$]+)\s*=(?!=)/gm)].map(m => m[1]);
  if (ONLY.length) {
    if (process.env.CI) {
      console.error('SMOKE_ONLY is set under CI. A subset is for iterating locally; the full suite is the only thing CI may run, so this run is refused.');
      process.exit(1);
    }
    const unknown = ONLY.filter(n => !ALL_CHECKS.includes(n));
    if (unknown.length) {
      console.error(`SMOKE_ONLY names no such check: ${unknown.join(', ')}`);
      process.exit(1);
    }
  }

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
  if (want('weekOpensOnTheLayoutYouCanPlanIn')) checks.weekOpensOnTheLayoutYouCanPlanIn = await page.evaluate(() => {
    const bad = [];
    if (weekView !== 'full') bad.push(`default weekView is '${weekView}', expected 'full'`);
    if (getComputedStyle(document.getElementById('weekFull')).display === 'none') {
      bad.push('index.html hides #weekFull, which the default weekView selects');
    }
    if (getComputedStyle(document.getElementById('weekPrintPreview')).display !== 'none') {
      bad.push('index.html leaves the print preview visible too');
    }
    if (!document.getElementById('viewTabFull').classList.contains('active')) {
      bad.push('the Full tab is not marked active in index.html');
    }
    if (document.getElementById('viewTabPrintPreview').classList.contains('active')) {
      bad.push('the preview tab is marked active in index.html');
    }
    /* Anything still asking for the retired layout lands somewhere you can
       plan, not on a container that no longer exists. */
    setWeekView('timegrid');
    if (weekView !== 'full') bad.push(`a stale 'timegrid' left weekView at '${weekView}'`);
    if (getComputedStyle(document.getElementById('weekFull')).display === 'none') {
      bad.push("a stale 'timegrid' showed nothing");
    }
    return bad.length === 0 || bad;
  });

  /* The school calendar. The band used to be hardcoded 9am–3pm Mon–Fri while
     SCHOOL_TEMPLATE placed the school block at 8am, so the two contradicted each
     other and both were wrong on every holiday and all summer. The arithmetic
     assertion is the one that matters: the published calendar states 177
     instructional days for K-8, so if a date was mistyped the count moves. */
  if (want('schoolCalendarIsRight')) checks.schoolCalendarIsRight = await page.evaluate(() => {
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
  if (want('dayBandsFollowTheCalendar')) checks.dayBandsFollowTheCalendar = await page.evaluate(() => {
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
     calendar-driven for a long time; the week layouts and the print sheet were
     not. Full week and print each carried their own hardcoded 9am–3pm bands
     chosen by `dow === 0 || dow === 6`, so they disagreed with the rest of the
     app by an hour AND drew "🏫 School" on Christmas Day, on a PD day, and on
     every day of July. Day Blocks was the third surface and drew nothing
     school-related at all; it is retired, and the preview that replaced it
     describes the week with one axis rather than seven bands. */
  if (want('everyWeekViewFollowsTheSchoolCalendar')) checks.everyWeekViewFollowsTheSchoolCalendar = await page.evaluate(() => {
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

    /* Two surfaces now, not three. Day Blocks was the third and is retired; the
       tab in its place is a preview of the print sheet, whose sideband is ONE
       axis describing seven days, so it has no per-day band to test — that
       axis is held by printSideband instead. */
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
  if (want('schoolHoursAreTheParentsToSet')) checks.schoolHoursAreTheParentsToSet = await page.evaluate(() => {
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
  if (want('anIcsFileBecomesDaysOffOnlyAfterReview')) checks.anIcsFileBecomesDaysOffOnlyAfterReview = await page.evaluate(() => {
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
  if (want('aBlankWeekOffersItsSchoolDays')) checks.aBlankWeekOffersItsSchoolDays = await page.evaluate(async () => {
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
    goWeek(); setWeekView('full'); renderWeek();
    /* The blank-week coach tip above the grid used to carry a 🏫 button of its
       own, and this arm read it there. It does not any more: the coach tip's
       copy only ever appeared on a WHOLLY blank week and the stale-calendar
       branch pre-empted it, so it was the one copy that vanished the moment a
       block landed. The offer above the grid is #weekSchoolBannerTop now, on
       the same condition as the below-grid copy, so the assertion moves rather
       than going away — a blank term week must still SAY it has school days
       missing, above the grid, in the same words. */
    const topOffer = document.getElementById('weekSchoolBannerTop');
    if (!topOffer || topOffer.style.display === 'none') {
      bad.push(`a blank term week does not offer its ${schoolKeys.length} school days above the grid`);
    } else if (!new RegExp(`${schoolKeys.length} school day`).test(topOffer.textContent)) {
      bad.push(`the offer above the grid does not name the ${schoolKeys.length} missing school days: "${topOffer.textContent.trim().slice(0, 120)}"`);
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

    /* Travel and get-ready come on with it. You go to school, so the journey
       and being ready for it are part of the morning — and Today's "get ready
       by" has nothing to compute from without them. */
    if (!b.travelBuffer) bad.push('an offered School Day arrived with no travel time');
    if (!b.getReadyBuffer) bad.push('an offered School Day arrived with no get-ready time');

    /* THE OFFER IS ABOUT THE SCHOOL CARD, NOT ABOUT THE DAY BEING EMPTY.
       This used to test whether the day held anything at all, which is a
       different question and the wrong one: the pale School band is a
       time-zone — business hours, and what makes the summer break legible —
       while the card is the plan. They are not duplicates of each other. So one
       meal on a Monday disqualified that Monday from ever being offered its
       school card, and the offer only ever appeared on a WHOLLY blank week. */
    keys.forEach(k => setDayBlocks(k, [], 'jenn'));
    setDayBlocks(schoolKeys[0], [{ id: 'sd-keep', actId: 'breakfast', startMin: 7 * 60, durationMin: 30 }], 'jenn');
    const offer = schoolDaysToOffer(keys, 'jenn');
    if (!offer.includes(schoolKeys[0])) {
      bad.push('a school day with breakfast on it was never offered its school card');
    }
    // …but a day that already HAS its school card is left alone.
    setDayBlocks(schoolKeys[0], [{ id: 'sd-has', actId: 'school_day', startMin: 9 * 60, durationMin: 300 }], 'jenn');
    if (schoolDaysToOffer(keys, 'jenn').includes(schoolKeys[0])) {
      bad.push('a day that already has its School Day was offered another');
    }

    /* And it is its own banner, not a line inside the blank-week offer — which
       is the whole point of this arm: a PART-planned week must still surface
       the school days it is missing. It used to read #weekSchoolBanner, the
       copy at the bottom of .weekly-full-wrap. That host is retired at the
       owner's instruction — one offer, above the grid — so the assertion moves
       to the surviving host rather than going away. */
    keys.forEach(k => setDayBlocks(k, [], 'jenn'));
    setDayBlocks(schoolKeys[0], [{ id: 'sd-keep2', actId: 'breakfast', startMin: 7 * 60, durationMin: 30 }], 'jenn');
    goWeek(); setWeekView('full'); renderWeek();
    const sb = document.getElementById('weekSchoolBannerTop');
    if (!sb || sb.style.display === 'none') {
      bad.push('a part-planned week does not surface its missing school days');
    } else if (!/school day/.test(sb.textContent)) {
      bad.push(`the school banner says "${sb.textContent.trim().slice(0, 80)}"`);
    }
    /* And there is exactly ONE of it. The below-grid host is gone from the
       markup, not merely undrawn: leaving it there is how somebody reinstates
       the second copy by reflex, and check-dead-ids.js would fail on an id
       nothing reads anyway. */
    if (document.getElementById('weekSchoolBanner')) {
      bad.push('#weekSchoolBanner is back in the document — the offer is meant to appear above the grid and nowhere else');
    }

    // And a week months out is not offered at all.
    if (schoolOfferInHorizon(getDayKeys(SCHOOL_FILL_HORIZON_WEEKS + 6))) {
      bad.push('a week months away is still offered its school days');
    }

    restore.forEach(([k, blocks]) => setDayBlocks(k, blocks, 'jenn'));
    weekOffset = wasOffset; profile = wasProfile;
    goWeek(); renderWeek();
    return bad.length === 0 || bad;
  });

  /* A TO-DO THAT ONLY SHOWS BELOW THE GRID IS A TO-DO NOBODY SEES. The offer to
     add the missing School Day cards had two hosts and lost one — #tgSchoolBanner
     went with the Day Blocks tab — leaving only the copy inside .weekly-full-wrap,
     which sits after about 691px of grid (960 minutes at 0.72px/min) plus the
     colour key and the streak. On a 390x844 phone that is a screen and a half
     below the fold. The coach-tip copy above the grid was not a substitute: it
     needed the whole week blank, so booking one block anywhere took the offer off
     the visible page entirely, on exactly the weeks somebody is planning.
     The below-grid copy is now retired at the owner's instruction and
     #weekSchoolBannerTop is the one host; this measures where it lands.
     Measured at a real phone viewport rather than read off the markup — "above
     the grid" is a fact about two rectangles, not about DOM order. */
  await page.setViewportSize({ width: 390, height: 844 });
  if (want('theSchoolOfferIsAboveTheWeekGrid')) checks.theSchoolOfferIsAboveTheWeekGrid = await page.evaluate(() => {
    const problems = [];
    const wasOffset = weekOffset, wasProfile = profile, wasView = weekView;
    profile = 'jenn';
    let wk = null;
    for (let w = 0; w < SCHOOL_FILL_HORIZON_WEEKS; w++) {
      if (getDayKeys(w).some(k => isSchoolDay(k))) { wk = w; break; }
    }
    if (wk == null) {
      profile = wasProfile;
      problems.push('no week inside SCHOOL_FILL_HORIZON_WEEKS has a school day, so the offer above the grid cannot be measured');
      return problems;
    }
    const keys = getDayKeys(wk);
    const restore = keys.map(k => [k, getDayBlocks(k, 'jenn')]);
    const schoolKeys = keys.filter(k => isSchoolDay(k));

    /* PART-PLANNED, which is the case the lost host was the only one serving:
       one non-school block on one day, every school card still missing. */
    keys.forEach(k => setDayBlocks(k, [], 'jenn'));
    setDayBlocks(keys[0], [{ id: 'sd-above-grid', actId: 'breakfast', startMin: 7 * 60, durationMin: 30 }], 'jenn');

    weekOffset = wk;
    goWeek(); setWeekView('full'); renderWeek();

    const top = document.getElementById('weekSchoolBannerTop');
    const grid = document.getElementById('weeklyFullGrid');
    if (!top) {
      problems.push('#weekSchoolBannerTop does not exist — the week grid has no offer to add its missing School Day cards above it');
    } else if (getComputedStyle(top).display === 'none' || !top.getBoundingClientRect().height) {
      problems.push(`a part-planned week missing ${schoolKeys.length} School Day cards leaves #weekSchoolBannerTop hidden`);
    } else if (!/school day/i.test(top.textContent)) {
      problems.push(`#weekSchoolBannerTop is shown but does not name the offer: "${top.textContent.trim().slice(0, 80)}"`);
    } else if (top.getBoundingClientRect().top >= grid.getBoundingClientRect().top) {
      problems.push('#weekSchoolBannerTop is not above #weeklyFullGrid — the offer still sits below the grid it is about');
    }

    /* The preview tab is read-only, and renderSchoolDayBanner is only ever
       called from renderFullWeek — so without an explicit hide the top host
       keeps whatever it last said, on a surface where nothing can be added. */
    setWeekView('preview');
    const onPreview = document.getElementById('weekSchoolBannerTop');
    if (onPreview && getComputedStyle(onPreview).display !== 'none') {
      problems.push('the school-day offer is still drawn over the read-only print preview, where nothing can be added');
    }
    setWeekView('full');

    restore.forEach(([k, blocks]) => setDayBlocks(k, blocks, 'jenn'));
    weekOffset = wasOffset; profile = wasProfile;
    setWeekView(wasView); goWeek(); renderWeek();
    return problems.length ? problems : true;
  });
  await page.setViewportSize({ width: 900, height: 1100 });

  /* ONE DAY IS A REAL ANSWER. The offer could only ever be taken whole — "Add
     them", every missing school day at once — which is wrong for the week that
     actually has a gap in it: a PD day the family is away for, a Thursday the
     child is at her grandmother's. A chip per offered day makes the smallest
     true answer available, and with a single day left the chip IS the action,
     so no bulk button is drawn beside it. Asserted for a kid profile and again
     for a parent viewing that kid, because activeProfile() is what decides
     whose week is written and a parent looking at Jenn must write Jenn's. */
  if (want('oneSchoolDayCanBeAddedOnItsOwn')) checks.oneSchoolDayCanBeAddedOnItsOwn = await page.evaluate(async () => {
    const problems = [];
    const wasOffset = weekOffset, wasProfile = profile, wasViewing = parentViewing;
    let wk = null;
    for (let w = 0; w < SCHOOL_FILL_HORIZON_WEEKS; w++) {
      if (getDayKeys(w).some(k => isSchoolDay(k))) { wk = w; break; }
    }
    if (wk == null) {
      problems.push('no week inside SCHOOL_FILL_HORIZON_WEEKS has a school day, so a single-day add cannot be told apart from adding all of them');
      return problems;
    }
    const keys = getDayKeys(wk);
    const restore = keys.map(k => [k, getDayBlocks(k, 'jenn')]);
    weekOffset = wk;

    const arm = async (label) => {
      const kid = activeProfile();
      keys.forEach(k => setDayBlocks(k, [], kid));
      setDayBlocks(keys[0], [{ id: 'one-sd-keep', actId: 'breakfast', startMin: 7 * 60, durationMin: 30 }], kid);
      goWeek(); setWeekView('full'); renderWeek();

      const offered = schoolDaysToOffer(keys, kid);
      const host = () => document.getElementById('weekSchoolBannerTop');
      const banner = host();
      if (!banner || getComputedStyle(banner).display === 'none') {
        problems.push(`${label}: the week grid's school-day offer is not shown at all, so ${kid}'s ${offered.length} missing cards cannot be added`);
        return;
      }
      if (offered.length < 2) {
        problems.push(`${label}: the fixture week offers only ${offered.length} school day, so adding one on its own cannot be distinguished from adding them all`);
        return;
      }
      let chips = [...banner.querySelectorAll('.wsb-day')];
      if (chips.length !== offered.length) {
        problems.push(`${label}: the offer draws ${chips.length} day chips for ${offered.length} school days missing their card`);
        return;
      }

      const target = offered[0], others = offered.slice(1);
      chips[0].click();
      await new Promise(r => setTimeout(r, 40));
      const ok = document.getElementById('appDialogOkBtn');
      if (!ok) {
        problems.push(`${label}: tapping one day's chip wrote without asking first`);
        return;
      }
      ok.click();
      await new Promise(r => setTimeout(r, 80));

      const wrote = (getDayBlocks(target, kid) || []).filter(b => b && b.actId === 'school_day');
      if (wrote.length !== 1) {
        problems.push(`${label}: tapping ${target}'s chip put ${wrote.length} school_day blocks on that day, and one chip is one day`);
      }
      const strays = others.filter(k => (getDayBlocks(k, kid) || []).some(b => b && b.actId === 'school_day'));
      if (strays.length) {
        problems.push(`${label}: tapping ${target}'s chip also wrote a School Day to ${strays.join(', ')}, which nobody asked for`);
      }

      renderWeek();
      const after = host();
      chips = after ? [...after.querySelectorAll('.wsb-day')] : [];
      const gone = DAY_SHORT[(formatDayKey(target).getDay() + 6) % 7];
      if (chips.some(c => c.textContent.trim() === gone)) {
        problems.push(`${label}: ${gone} is still offered a School Day card after one landed on it`);
      }
      if (chips.length !== others.length) {
        problems.push(`${label}: ${chips.length} day chips remain, but ${others.length} school days are still missing their card`);
      }
      const bulk = after ? [...after.querySelectorAll('button')].filter(b => !b.classList.contains('wsb-day')) : [];
      if (others.length > 1 && !bulk.length) {
        problems.push(`${label}: ${others.length} days are still missing their card and there is no way to add them all at once`);
      }
      if (others.length === 1 && bulk.length) {
        problems.push(`${label}: one offered day still draws a bulk "add all" button beside the chip that already is that action`);
      }
    };

    profile = 'jenn'; parentViewing = wasViewing;
    await arm('as Jenn');
    /* Same arm as a grown-up looking at Jenn's week. activeProfile() returns
       parentViewing, so this should already hold — the point is to pin it, the
       way every other write on this screen is pinned for the portal. */
    profile = 'parent'; parentViewing = 'jenn';
    await arm('as a parent viewing Jenn');

    restore.forEach(([k, blocks]) => setDayBlocks(k, blocks, 'jenn'));
    weekOffset = wasOffset; profile = wasProfile; parentViewing = wasViewing;
    goWeek(); renderWeek();
    return problems.length ? problems : true;
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
  if (want('weekSideband')) checks.weekSideband = await page.evaluate(() => {
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
  if (want('weekHourLines')) checks.weekHourLines = await page.evaluate(() =>
    document.querySelectorAll('.wf-day-col .hour-grid-line--hour').length > 0);
  /* THE SECOND TAB IS A READ-ONLY PREVIEW OF THE PRINTED SHEET.
     It renders the week and child the screen is already showing, through the
     SAME renderer the Print button uses, and exposes no way to change anything:
     the print markup carries no handlers at all, which is what makes read-only
     free to enforce rather than a promise. */
  if (want('theSecondWeekTabPreviewsThePrintedSheet')) checks.theSecondWeekTabPreviewsThePrintedSheet = await page.evaluate(() => {
    const bad = [];
    goWeek(); setWeekView('preview'); renderWeek();
    const host = document.getElementById('weekPreviewSheet');
    if (!host) return ['there is no preview host'];
    if (!host.querySelector('.print-week-grid')) bad.push('the preview did not render the print grid');
    if (!host.querySelector('.print-header-cell')) bad.push('the preview has no day headers');
    // Read-only: no handler, no mutation hook, no tick.
    if (host.querySelector('[onclick]')) bad.push('the preview carries a click handler');
    if (host.querySelector('.wf-card-check')) bad.push('the preview offers a completion tick');
    if (host.innerHTML.includes('data-mm-action') || host.innerHTML.includes('data-pa-')) {
      bad.push('the preview carries a mutation hook');
    }
    // It follows the week and child the screen is showing, not the print globals.
    const heading = (host.querySelector('.print-header h1') || {}).textContent || '';
    if (!new RegExp(activeProfile() === 'jenn' ? 'Jenn' : 'Jess').test(heading)) {
      bad.push(`the preview names the wrong child: "${heading}"`);
    }
    // Two live copies must not fight over --print-slot: it is set on the host.
    if (document.documentElement.style.getPropertyValue('--print-slot')) {
      bad.push('the renderer still sets --print-slot on <html>');
    }
    // And the Full week is still the one you can tick in.
    setWeekView('full'); renderWeek();
    if (!document.querySelector('#weekFull .wf-card-check')) {
      bad.push('the Full week lost its quick-complete tick');
    }
    return bad.length === 0 || bad;
  });

  /* ONE TOPBAR ROW. The week selector and the controls that act on the week it
     names were split across two rows separated by a dashed rule, which cost
     about a third of an iPad's first screen before the plan itself began.
     Checked by geometry, not by markup: "they are in the same div" is satisfied
     by a div that wraps, and what matters is that they are on one line. */
  if (want('weekTopbarIsOneRow')) checks.weekTopbarIsOneRow = await page.evaluate(() => {
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
  if (want('weekSummariesSitUnderThePlan')) checks.weekSummariesSitUnderThePlan = await page.evaluate(() => {
    const bad = [];
    const after = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    setWeekView('full'); renderWeek();
    const grid = document.getElementById('weeklyFullGrid');
    if (!after(grid, document.getElementById('weekStreak'))) bad.push('the free-stretch line is still above the grid');
    if (!after(grid, document.getElementById('weekConflictBanner'))) bad.push('the clash banner is still above the cards');
    return bad.length === 0 || bad;
  });

  /* One scroll surface on the week, the same rule the day screen is held to.
     The grid used to be its own scroller inside a flex column, so the week had
     two: the grid, and the page carrying the glance and goals under it. A wheel
     over the grid moved the grid, reached its end, and stopped —
     overscroll-behavior: contain made sure nothing chained to the page — so the
     panels below could not be reached by scrolling over the grid at all. */
  if (want('weekScrollsAsOneSurface')) checks.weekScrollsAsOneSurface = await page.evaluate(() => {
    const bad = [];
    ['full', 'preview'].forEach(view => {
      setWeekView(view); renderWeek();
      const host = view === 'full' ? '#weekFull' : '#weekPrintPreview';
      const inner = [...document.querySelectorAll(`${host}, ${host} *`)].filter(el => {
        const st = getComputedStyle(el);
        return /(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 4;
      });
      if (inner.length) {
        bad.push(`nested scrollers under ${view}: ${inner.map(e => e.className || e.tagName).join(' | ')}`);
      }
    });
    setWeekView('full'); renderWeek();
    return bad.length === 0 || bad;
  });

  /* A SHORT BLOCK STILL SAYS WHAT IT IS, and its tick fits inside it.

     Three defects met on the quarter-hour card and none of them was visible to
     this suite. The tick's size was written inline by the renderer and then
     overridden by min-width/min-height in css/app.css — different properties,
     so they beat the inline width rather than losing to it. Every tick was
     28x28 at every height, which on an 18px card is TALLER THAN THE CARD, and
     the name was dropped to make room for a control that did not fit either.
     Meanwhile blockContentTier was asked about a height the card never had
     (16 in JS against an 18px CSS floor), so a card that could have shown its
     name was told it could not.

     Asserts the invariant rather than the pixel count: whatever the tick's
     size rule becomes, it may never exceed the block it belongs to, and a
     rendered block always says its own name. */
  if (want('aShortBlockStillSaysWhatItIs')) checks.aShortBlockStillSaysWhatItIs = await page.evaluate(() => {
    goWeek(); setWeekView('full');
    const kid = activeProfile();
    const key = getDayKeys(0)[2];
    const had = (getDayBlocks(key) || []).slice();
    const bad = [];
    try {
      setDayBlocks(key, [
        { id: 'wk-min-a', actId: 'break_quick',     startMin: 6 * 60,      durationMin: 15, completed: true },
        { id: 'wk-min-b', actId: 'routine_evening', startMin: 6 * 60 + 30, durationMin: 20 },
        { id: 'wk-min-c', actId: 'piano',           startMin: 8 * 60,      durationMin: 60 },
      ], kid);
      weekOffset = 0; renderWeek();

      const cards = [...document.querySelectorAll('#screen-week .wf-card')]
        .filter(c => ['wk-min-a', 'wk-min-b', 'wk-min-c'].some(id => (c.outerHTML || '').includes(id)));
      if (cards.length < 3) return [`seeded 3 blocks, the week drew ${cards.length}`];

      cards.forEach(c => {
        const box  = c.getBoundingClientRect();
        const name = c.querySelector('.wf-card-name');
        const tick = c.querySelector('.wf-card-check');
        const label = (name && name.textContent.trim()) || '(unnamed)';

        if (!name || getComputedStyle(name).display === 'none' || name.getBoundingClientRect().width < 1) {
          bad.push(`${label}: a ${Math.round(box.height)}px card renders no name`);
        }
        if (!tick) {
          bad.push(`${label}: no way to check the block off`);
          return;
        }
        const t = tick.getBoundingClientRect();
        // The defect, stated directly.
        if (t.height > box.height + 0.5) {
          bad.push(`${label}: tick is ${Math.round(t.height)}px tall on a ${Math.round(box.height)}px card`);
        }
        // The glyph is only measurable on a completed block; the font sweep in
        // kidScreensMeetTheHouseRules skips a button with no text node, which
        // is why an 8px tick survived it.
        if (tick.textContent.trim()) {
          const f = parseFloat(getComputedStyle(tick).fontSize);
          if (f < 13) bad.push(`${label}: the tick's glyph is ${f}px, under the 13px floor`);
        }
      });
    } finally { setDayBlocks(key, had, kid); renderWeek(); }
    return bad.length === 0 || bad;
  });




  /* EVERY ACTIVITY KNOWS WHICH SUBGROUP IT IS IN, and every subgroup is
     reachable. `cat` answers what colour a block is and `group` what the time is
     FOR; neither is a shape a person can navigate, which is why there is a third
     table. A subgroup nothing lands in is a heading the picker can never draw,
     and an activity whose subgroup is not in the table would be filed under the
     neutral landing with nothing to say so. */
  if (want('everyActivityHasASubgroup')) checks.everyActivityHasASubgroup = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'jenn';
    try {
      const all = getAllActivities('jenn', { includeArchived: true });
      all.forEach(a => {
        if (a.custom) return;   // a family's own is derived, never stamped
        if (!a.sub) { bad.push(`${a.id} names no subgroup`); return; }
        if (!ACTIVITY_SUBS[a.sub]) { bad.push(`${a.id} is filed under "${a.sub}", which is not a subgroup`); return; }
        if (!GROUP_ORDER.includes(activityGroup(a))) {
          bad.push(`${a.id} groups as "${activityGroup(a)}", which no chart row draws`);
        }
      });
      // Every subgroup has something pickable in it.
      const pickable = getAllActivities('jenn');
      Object.keys(ACTIVITY_SUBS).forEach(sg => {
        if (!pickable.some(a => activitySub(a).id === sg)) {
          bad.push(`nothing is filed under "${sg}" — its heading can never draw`);
        }
      });
      // And every subgroup belongs to exactly one category.
      const seen = new Set();
      ACTIVITY_CATEGORIES.forEach(c => c.subs.forEach(sg => {
        if (seen.has(sg.id)) bad.push(`"${sg.id}" is in two categories`);
        seen.add(sg.id);
      }));
      /* A family's own activity has no `sub` and never will — deriving it at
         read time is the same answer in any merge order, which is why nothing
         is migrated (see activitySub, and xp2 before it). */
      const derived = activitySub({ id: 'legacy', cat: 'school', name: 'Old' });
      if (!derived || derived.id !== 'school') {
        bad.push(`a legacy cat:'school' activity derives as "${derived && derived.id}"`);
      }
      if (activitySub({ cat: 'daily', group: 'chores' }).id !== 'helping') {
        bad.push('a legacy house chore does not derive as helping hands');
      }
      // Reading twice changes nothing.
      const a1 = activitySub({ cat: 'free' }).id, a2 = activitySub({ cat: 'free' }).id;
      if (a1 !== a2) bad.push('deriving a subgroup is not stable');
    } finally { profile = wasProfile; }
    return bad.length === 0 || bad;
  });

  /* THE PICKER KEEPS ITS HEIGHT. The list was `max-height`, so the sheet was as
     tall as whichever category happened to be open — twelve tiles under Play &
     Rest, six under Fuel & Care — and the whole dialog jumped every time a chip
     was tapped, moving the chips themselves out from under her thumb. The chip
     row wrapped for the same reason. Both are fixed now; this measures it. */
  if (want('thePickerKeepsItsHeight')) checks.thePickerKeepsItsHeight = await page.evaluate(() => {
    const bad = [];
    const wasKey = currentDayKey;
    currentDayKey = getDayKeys(0)[0];
    openSlotPicker(15 * 60 + 30);
    const list = document.getElementById('slotPickerList');
    const sheet = document.querySelector('#slotPickerOverlay .sheet');
    const chipRow = document.getElementById('slotPickerFilter');
    if (!list || !sheet || !chipRow) return ['the picker did not open'];
    const chips = [...chipRow.querySelectorAll('.filter-chip')];
    if (chips.length < 6) bad.push(`only ${chips.length} chips — the six categories should all be there`);
    const h0 = Math.round(list.getBoundingClientRect().height);
    const s0 = Math.round(sheet.getBoundingClientRect().height);
    const r0 = Math.round(chipRow.getBoundingClientRect().height);
    chips.forEach(c => {
      c.click();
      const h = Math.round(list.getBoundingClientRect().height);
      const s = Math.round(sheet.getBoundingClientRect().height);
      const r = Math.round(chipRow.getBoundingClientRect().height);
      if (Math.abs(h - h0) > 1) bad.push(`"${c.textContent.trim()}" changes the list from ${h0}px to ${h}px`);
      if (Math.abs(s - s0) > 1) bad.push(`"${c.textContent.trim()}" changes the sheet from ${s0}px to ${s}px`);
      if (Math.abs(r - r0) > 1) bad.push(`"${c.textContent.trim()}" makes the chip row wrap: ${r0}px to ${r}px`);
    });
    /* And when a category does outgrow the box it scrolls INSIDE it rather than
       pushing the sheet taller. Not "it must scroll" — the 336px was chosen so
       the largest category fits on an iPad, and fitting is the better outcome;
       what must hold is that the overflow has somewhere to go. */
    const play = chips.find(c => /Play/.test(c.textContent));
    if (play) {
      play.click();
      if (getComputedStyle(list).overflowY !== 'auto') {
        bad.push('the list cannot scroll, so a long category would push the sheet taller');
      }
      if (Math.round(list.getBoundingClientRect().height) !== h0) {
        bad.push('the longest category still resizes the list');
      }
    }
    closeSheet('slotPickerOverlay');
    currentDayKey = wasKey;
    return bad.length === 0 || bad;
  });

  /* THE PICKER LEADS WITH WHAT FITS THE TIME. Every activity has carried a
     suitableTime window since the catalog was written and the picker never
     asked — a child tapping 7:15 on a school morning was offered a six-hour day
     trip in the same undifferentiated list as Breakfast. It RANKS rather than
     filters: the rest of the library follows underneath, because a picker that
     hides things is one she stops trusting. */
  if (want('thePickerLeadsWithWhatFitsTheTime')) checks.thePickerLeadsWithWhatFitsTheTime = await page.evaluate(() => {
    const bad = [];
    const keys = getDayKeys(0);
    const schoolKey = keys.find(k => isSchoolDay(k));
    const freeKey = keys.find(k => !isSchoolDay(k));
    /* Everything this check seeds is put back. The suite shares one week and
       later checks read blocks seeded at boot, so a day left empty here is a
       crash three hundred lines further down — which is exactly what the first
       draft of this did. */
    const wasKey = currentDayKey;
    const hadSchool = schoolKey ? (getDayBlocks(schoolKey, 'jenn') || []).slice() : null;
    try {
    const names = () => [...document.querySelectorAll('#slotPickerList .slot-pick-chip .spc-name')]
      .map(n => n.textContent);
    const headings = () => [...document.querySelectorAll('#slotPickerList .spc-subhead')]
      .map(h => h.textContent.trim());

    if (schoolKey) {
      currentDayKey = schoolKey;
      openSlotPicker(7 * 60 + 15);
      if (slotPickerWindow() !== 'before-school') {
        bad.push(`7:15 on a school day reads as "${slotPickerWindow()}"`);
      }
      const head = headings().find(h => /Good for/.test(h));
      if (!head) bad.push('a school morning suggests nothing');
      // Everything above "Everything else" must genuinely fit the morning.
      const all = names();
      const cut = all.indexOf(
        [...document.querySelectorAll('#slotPickerList .slot-pick-chip, #slotPickerList .spc-subhead')]
          .filter(e => e.classList.contains('slot-pick-chip'))
          .map(e => e.querySelector('.spc-name').textContent)[0]);
      const lib = getAllActivities();
      const shown = [...document.querySelectorAll('#slotPickerList > *')];
      let inSug = false;
      shown.forEach(el => {
        if (el.classList.contains('spc-subhead')) {
          inSug = /Good for/.test(el.textContent);
          return;
        }
        if (!inSug) return;
        const nm = (el.querySelector('.spc-name') || {}).textContent;
        const act = lib.find(a => a.name === nm);
        if (act && !(act.suitableTime || []).includes('before-school')) {
          bad.push(`"${nm}" is suggested for a school morning and does not fit it`);
        }
      });
      // The hint says how much room there is, not "pick what goes here".
      const hint = (document.getElementById('slotPickerHint') || {}).textContent || '';
      if (!/free/.test(hint)) bad.push(`the hint reads "${hint}" and names no free time`);
      closeSheet('slotPickerOverlay');
    }

    /* AND HOW MUCH ROOM IS LEFT, not only the moment. A seven-hour School Day
       matches the school window and cannot go in the hour before dinner. */
    if (schoolKey) {
      currentDayKey = schoolKey;
      setDayBlocks(schoolKey, [{ id: 'fit-dinner', actId: 'dinner', startMin: 17 * 60, durationMin: 45 }], 'jenn');
      openSlotPicker(16 * 60);   // one hour before dinner
      const lib2 = getAllActivities();
      let inSug2 = false;
      [...document.querySelectorAll('#slotPickerList > *')].forEach(el => {
        if (el.classList.contains('spc-subhead')) { inSug2 = /Good for/.test(el.textContent); return; }
        if (!inSug2) return;
        const nm = (el.querySelector('.spc-name') || {}).textContent;
        const act = lib2.find(a => a.name === nm);
        if (act && (activityDefaultDuration(act) || 60) > 60) {
          bad.push(`"${nm}" is suggested for a 1h gap and wants ${activityDefaultDuration(act)}m`);
        }
      });
      /* An appointment is a time somebody else set, not something she picks to
         fill an afternoon. It ranks last in the row rather than being hidden. */
      const sugNames = [];
      let inSug3 = false;
      [...document.querySelectorAll('#slotPickerList > *')].forEach(el => {
        if (el.classList.contains('spc-subhead')) { inSug3 = /Good for/.test(el.textContent); return; }
        if (inSug3) sugNames.push((el.querySelector('.spc-name') || {}).textContent);
      });
      const isAppt = nm => { const a = lib2.find(x => x.name === nm); return a && activitySub(a).id === 'appts'; };
      const firstAppt = sugNames.findIndex(isAppt);
      const lastPlain = sugNames.map(isAppt).lastIndexOf(false);
      if (firstAppt !== -1 && lastPlain !== -1 && firstAppt < lastPlain) {
        bad.push(`an appointment leads the suggestions: ${JSON.stringify(sugNames)}`);
      }
      closeSheet('slotPickerOverlay');
    }

    if (freeKey) {
      currentDayKey = freeKey;
      openSlotPicker(10 * 60);
      if (slotPickerWindow() !== 'weekend') {
        bad.push(`10am on a day with no school reads as "${slotPickerWindow()}"`);
      }
      closeSheet('slotPickerOverlay');
    }

    /* Which kind of day it is comes from the calendar, never the day of the
       week: a Tuesday in July is not a school day and neither is a PD day. */
    const pd = keys.find(k => !isSchoolDay(k) && [1,2,3,4,5].includes(formatDayKey(k).getDay()));
    if (pd) {
      currentDayKey = pd;
      openSlotPicker(10 * 60);
      if (slotPickerWindow() === 'school') {
        bad.push('a weekday with no school is still being called school time');
      }
      closeSheet('slotPickerOverlay');
    }
    } finally {
      if (schoolKey) setDayBlocks(schoolKey, hadSchool, 'jenn');
      currentDayKey = wasKey;
      closeSheet('slotPickerOverlay');
    }
    return bad.length === 0 || bad;
  });

  /* A NEW ACTIVITY STARTS IN THE CATEGORY IT CAME FROM, and carries enough for
     the picker to offer it again. The kid dialog used to save a `cat` and a
     duration and nothing else — so an activity she invented for a Tuesday
     evening had no window, and with the picker now leading on what fits the
     moment she tapped it would sit permanently in "everything else". */
  if (want('aNewActivityStartsInTheCategoryItCameFrom')) checks.aNewActivityStartsInTheCategoryItCameFrom = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'jenn';
    const had = (getProfData('jenn').customActivities || []).slice();
    const wasKey = currentDayKey;
    try {
      currentDayKey = getDayKeys(0)[0];
      openSlotPicker(19 * 60);
      const chips = [...document.querySelectorAll('#slotPickerFilter .filter-chip')];
      const brain = chips.find(c => /Brain/.test(c.textContent));
      if (!brain) return ['no Brain chip to add from'];
      brain.click();
      const add = document.querySelector('#slotPickerList .slot-pick-add');
      if (!add) return ['no "custom activity" tile'];
      add.click();

      const catSel = document.getElementById('customCat');
      const subSel = document.getElementById('customSub');
      if (!catSel || catSel.value !== 'brain') {
        bad.push(`added from Brain, the form opens on "${catSel && catSel.value}"`);
      }
      // The subgroup select offers only kinds of Brain.
      const brainSubs = catDef('brain').subs.map(sg => sg.id);
      [...subSel.options].forEach(o => {
        if (!brainSubs.includes(o.value)) bad.push(`"Kind" offers ${o.value}, not a kind of Brain`);
      });
      subSel.value = 'arts';

      document.getElementById('customName').value = 'Ukulele';
      document.getElementById('customIcon').value = '🎸';
      document.getElementById('customDur').value = '30';
      confirmCustomActivity();

      const made = (getProfData('jenn').customActivities || []).find(a => a.name === 'Ukulele');
      if (!made) return ['the activity was not saved'];
      if (made.sub !== 'arts') bad.push(`saved under "${made.sub}", not arts`);
      /* `cat` is still written, derived from the subgroup: the stickers, the
         Athlete achievement and ACTIVITY_OBJECTIVES_BY_CAT all key on it, and a
         record without one drops out of all three. */
      if (made.cat !== catForSub('arts')) bad.push(`its legacy cat is "${made.cat}"`);
      if (!Array.isArray(made.suitableTime) || !made.suitableTime.length) {
        bad.push('it carries no window, so the picker can never suggest it');
      }
      if (!made.suitableTime.includes('evening')) {
        bad.push(`invented at 7pm, its window is ${JSON.stringify(made.suitableTime)}`);
      }
      // It wears its subgroup's colour, and is findable under its own chip.
      if (blockColour({ id: 'z', actId: made.id }, 'jenn') !== subDef('arts').hex) {
        bad.push('it does not wear the Arts colour');
      }
      if (!activityMatchesFilter(made, 'brain')) bad.push('it cannot be found under Brain');
    } finally {
      getProfData('jenn').customActivities = had;
      profile = wasProfile;
      currentDayKey = wasKey;
      closeSheet('customOverlay');
    }
    return bad.length === 0 || bad;
  });

  /* GET-READY IS EDITABLE ON ANYTHING THAT CARRIES IT.

     The toggle and the minutes box have been in index.html all along, and
     openEditSheet showed them for a TRAINING block only — so travel could be
     adjusted on any block and get-ready on almost none. Exactly backwards:
     placing an activity sets getReadyBuffer from activityTravels(), so School
     Day, the five appointments, Ballet, Swimming, Skating and the Explore
     outings all arrive with the buffer ON, and not one of them is isTraining.
     Every block that carried it by default was a block that could not edit it. */
  if (want('getReadyIsEditableOnAnythingThatCarriesIt')) checks.getReadyIsEditableOnAnythingThatCarriesIt = await page.evaluate(async () => {
    const kid = activeProfile();
    const key = getDayKeys(0)[3];
    const had = (getDayBlocks(key) || []).slice();
    const bad = [];
    try {
      setDayBlocks(key, [{ id: 'gr-swim', actId: 'swimming', startMin: 16 * 60, durationMin: 60,
        travelBuffer: true, travelBufMin: 20, getReadyBuffer: true, getReadyBufMin: 15 }], kid);
      currentDayKey = key;
      openEditSheet('gr-swim');

      const tg = document.getElementById('editReadyToggle');
      const row = document.getElementById('editReadyDurRow');
      const box = document.getElementById('editReadyBufMin');
      if (!tg || getComputedStyle(tg).display === 'none') {
        bad.push('a swimming block offers no get-ready toggle');
      }
      if (!row || getComputedStyle(row).display === 'none') {
        bad.push('a swimming block offers no get-ready minutes');
      }
      if (box && box.value !== '15') {
        bad.push(`the box reads "${box.value}" rather than the block's own 15`);
      }
      // Warm-up stays training-only: a car journey in front of Breakfast is what
      // the buffer-default rule exists to prevent.
      const wu = document.getElementById('editWarmupToggle');
      if (wu && getComputedStyle(wu).display !== 'none') {
        bad.push('warm-up is offered on a block that is not training');
      }

      // Change it, save it, read it back off the block.
      if (box) { box.value = '25'; onEditBufferMinInput(); }
      await saveEditChanges();
      const after = (getDayBlocks(key, kid) || []).find(b => b.id === 'gr-swim');
      if (!after || getGetReadyBufMin(after) !== 25) {
        bad.push(`saved get-ready is ${after ? getGetReadyBufMin(after) : 'gone'}, not 25`);
      }

      // And it can be switched off entirely.
      openEditSheet('gr-swim');
      toggleEditGetReadyBuffer();
      await saveEditChanges();
      const off = (getDayBlocks(key, kid) || []).find(b => b.id === 'gr-swim');
      if (off && getGetReadyBufMin(off) !== 0) {
        bad.push(`get-ready survived being switched off at ${getGetReadyBufMin(off)}m`);
      }
    } finally { setDayBlocks(key, had, kid); closeSheet('editOverlay'); }
    return bad.length === 0 || bad;
  });

  /* CHANGING TRAVEL DOES NOT REWRITE GET-READY.

     The quieter half of the same defect. onEditBufferMinInput read all three
     number inputs unconditionally, but the non-training branch never loaded the
     get-ready box from the block — so it kept its static value="15" from
     index.html, or whatever was typed on the last training block opened this
     session. Touch the TRAVEL minutes on a swimming block and that stale number
     was copied into the block's get-ready and saved: a field with no visible
     control silently rewriting itself from another block's value. */
  if (want('changingTravelDoesNotRewriteGetReady')) checks.changingTravelDoesNotRewriteGetReady = await page.evaluate(async () => {
    const kid = activeProfile();
    const key = getDayKeys(0)[4];
    const had = (getDayBlocks(key) || []).slice();
    const bad = [];
    try {
      setDayBlocks(key, [
        { id: 'rw-train', actId: 'training', startMin: 10 * 60, durationMin: 120, tag: 'skating',
          travelBuffer: true, travelBufMin: 30, getReadyBuffer: true, getReadyBufMin: 15 },
        { id: 'rw-swim', actId: 'swimming', startMin: 16 * 60, durationMin: 60,
          travelBuffer: true, travelBufMin: 20, getReadyBuffer: true, getReadyBufMin: 45 },
      ], kid);
      currentDayKey = key;

      // Leave a big number in the get-ready box via a training block.
      openEditSheet('rw-train');
      const gr = document.getElementById('editReadyBufMin');
      if (gr) { gr.value = '40'; onEditBufferMinInput(); }
      closeSheet('editOverlay');

      // Now touch ONLY the travel minutes on the swimming block.
      openEditSheet('rw-swim');
      const tv = document.getElementById('editTravelBufMin');
      if (tv) { tv.value = '35'; onEditBufferMinInput(); }
      await saveEditChanges();

      const swim = (getDayBlocks(key, kid) || []).find(b => b.id === 'rw-swim');
      if (!swim) return ['the swimming block vanished'];
      if (getGetReadyBufMin(swim) !== 45) {
        bad.push(`its get-ready became ${getGetReadyBufMin(swim)}m — it was never touched, and was 45`);
      }
      if (getTravelBufMin(swim) !== 35) {
        bad.push(`its travel is ${getTravelBufMin(swim)}m, not the 35 that was typed`);
      }
    } finally { setDayBlocks(key, had, kid); closeSheet('editOverlay'); }
    return bad.length === 0 || bad;
  });

  /* A BUFFER STRIP NEVER COVERS A CARD, AND NEVER SAYS MORE THAN IT CAN SHOW.

     Two separate defects, one fixture — the Wednesday from the screenshot that
     prompted this work.

     (1) A travel/get-ready strip was drawn at its full length whatever was in
     the way, so School Day's thirty minutes of driving home painted straight
     over the top of Homework: the strip could not be read, and neither could
     the card's name or its tick. bufferClip (js/05-helpers.js) now trims a
     strip to the minutes that actually exist, and the minutes that did not fit
     are drawn OVER the card at a quarter strength (.wf-overrun) so how bad the
     clash is still reads at a glance.

     (2) At 0.72px per minute a fifteen-minute strip is 10.8px tall, and the kid
     readability floor sets its text to 13.1px — so two stacked strips each
     printed a label through the other. A strip speaks only when a line fits
     (WF_TRAVEL_TEXT_MIN_PX, a measurement), and a run of short same-side
     segments merges into one band that can.

     Geometry, not classes: it measures real rectangles, because a z-index or a
     clip that silently stopped applying is exactly the failure that still looks
     plausible in the DOM. */
  if (want('aBufferStripNeverCoversACard')) checks.aBufferStripNeverCoversACard = await page.evaluate(() => {
    goWeek(); setWeekView('full');
    const kid = activeProfile();
    const key = getDayKeys(0)[2];
    const had = (getDayBlocks(key) || []).slice();
    const bad = [];
    const overlaps = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5
                            && a.top  < b.bottom - 0.5 && a.bottom > b.top + 0.5;
    try {
      setDayBlocks(key, [
        { id: 'bs-school', actId: 'school_day', startMin: 8 * 60 + 10, durationMin: 400,
          travelBuffer: true, travelBufMin: 15, getReadyBuffer: true, getReadyBufMin: 15 },
        { id: 'bs-home',   actId: 'homework',   startMin: 15 * 60, durationMin: 150 },
        { id: 'bs-ballet', actId: 'ballet',     startMin: 20 * 60, durationMin: 45,
          travelBuffer: true, travelBufMin: 25, getReadyBuffer: true, getReadyBufMin: 15 },
        { id: 'bs-eve',    actId: 'routine_evening', startMin: 21 * 60, durationMin: 30 },
      ], kid);
      weekOffset = 0; renderWeek();

      const cell = document.querySelectorAll('#weeklyFullGrid .wf-daycell')[2]
                || document.querySelectorAll('#weeklyFullGrid > *')[2];
      const strips = [...document.querySelectorAll('#screen-week .wf-travel')];
      const cards  = [...document.querySelectorAll('#screen-week .wf-card')];
      if (!strips.length) return ['no buffer strips drew at all'];
      if (cards.length < 4) return [`seeded 4 blocks, the week drew ${cards.length} cards`];

      // (1) No strip may cover any card.
      strips.forEach(s => {
        const sr = s.getBoundingClientRect();
        if (sr.height < 1) return;
        cards.forEach(c => {
          if (overlaps(sr, c.getBoundingClientRect())) {
            const nm = (c.querySelector('.wf-card-name') || {}).textContent || '(card)';
            bad.push(`a ${Math.round(sr.height)}px strip is drawn over "${nm.trim()}"`);
          }
        });
      });

      // (2) Anything that speaks must fit, down AND across.
      strips.forEach(s => {
        const txt = (s.textContent || '').trim();
        if (!txt) return;
        if (s.scrollHeight > s.clientHeight + 1) {
          bad.push(`strip "${txt}" needs ${s.scrollHeight}px of height in ${s.clientHeight}px`);
        }
        if (s.scrollWidth > s.clientWidth + 1) {
          bad.push(`strip "${txt}" needs ${s.scrollWidth}px of width in ${s.clientWidth}px`);
        }
      });

      // (3) The shortfall is stated in words, on the flag and in the banner.
      const blocks = getDayBlocks(key, kid);
      const conflicts = computeBufferConflicts(blocks);
      const schoolShort = conflicts.shortMin && conflicts.shortMin.get('bs-school');
      if (!schoolShort || schoolShort.post !== 20) {
        bad.push(`School Day should be 20m short after; got ${schoolShort ? schoolShort.post : 'nothing'}`);
      }
      const balletShort = conflicts.shortMin && conflicts.shortMin.get('bs-ballet');
      if (!balletShort || balletShort.post !== 25) {
        bad.push(`Ballet should be 25m short after; got ${balletShort ? balletShort.post : 'nothing'}`);
      }
      const banner = document.getElementById('weekConflictBanner');
      const bText = (banner && banner.textContent) || '';
      if (!/20m short/.test(bText)) bad.push('the banner never says how short School Day is');
      if (!/Homework/.test(bText))  bad.push('the banner does not name what School Day runs into');
      /* One line per clashing PAIR, not one chain per day: the old banner read
         "School Day ⇆ Homework ⇆ Ballet ⇆ Evening Routine", which names four
         things while saying neither which two clash nor by how much. Split on
         the real line breaks, because textContent runs them together. */
      const lines = ((banner && banner.innerHTML) || '').split(/<br\s*\/?>/i).slice(1);
      if (lines.length !== 2) bad.push(`the banner drew ${lines.length} clash lines, not 2`);
      lines.forEach(l => {
        const n = (l.match(/⇆/g) || []).length;
        if (n !== 1) bad.push(`a banner line names ${n + 1} activities: "${l.replace(/<[^>]*>/g, '').trim()}"`);
        if (!/\dm short/.test(l)) bad.push(`a banner line says no shortfall: "${l.replace(/<[^>]*>/g, '').trim()}"`);
      });

      // (4) The overrun is drawn on the card that is run into, to scale, and the
      // card underneath still reads through it.
      const ov = [...document.querySelectorAll('#screen-week .wf-overrun')];
      if (!ov.length) bad.push('no overrun is drawn for either clash');
      ov.forEach(o => {
        if (getComputedStyle(o).pointerEvents !== 'none') {
          bad.push('the overrun swallows taps meant for the card');
        }
      });
      const homeCard = cards.find(c => (c.outerHTML || '').includes('bs-home'));
      if (homeCard) {
        const flag = homeCard.querySelector('.wf-card-conflict-flag');
        if (!flag) bad.push('Homework carries no clash flag');
        else if (!/20m over/.test(flag.textContent || '')) {
          bad.push(`Homework's flag reads "${(flag.textContent || '').trim()}" rather than the minutes`);
        }
        const nm = homeCard.querySelector('.wf-card-name');
        if (nm) {
          const r = nm.getBoundingClientRect();
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (at && at.classList.contains('wf-overrun')) {
            bad.push('the overrun sits on top of the name it is supposed to leave readable');
          }
        }
      }
    } finally { setDayBlocks(key, had, kid); renderWeek(); }
    return bad.length === 0 || bad;
  });

  /* THE SUGGESTIONS ANSWER THE CLOCK.

     Tapping 12:30 on a free day offered Evening Routine, Morning Routine and
     Dinner ahead of Lunch. Two defects compounding, and neither was about the
     picker's wording.

     `zoneForGap` answers 'weekend' on its FIRST LINE for every minute from six
     in the morning to ten at night, so the zone carried no time-of-day
     information at all — and 47 of the 70 catalog entries declare 'weekend', so
     they all "fit" equally. The row then fell through to `slotPickerRecentActIds`,
     which is placement frequency over four weeks: the observed order was exactly
     the household's most-placed six. The hour she tapped changed nothing but the
     heading text.

     What must hold is an ORDERING, not the presence of a heading — the previous
     check here asserted only that "Good for" existed, which was true throughout
     and is why this shipped. */
  if (want('theSuggestionsAnswerTheClock')) checks.theSuggestionsAnswerTheClock = await page.evaluate(() => {
    const bad = [];
    const keyFor = want => getDayKeys(0).find(k => isSchoolDay(k) === want);
    const namesIn = () => [...document.querySelectorAll('#slotPickerList .slot-pick-chip')]
      .map(t => (t.textContent || '').trim());
    const headings = () => [...document.querySelectorAll('#slotPickerList .spc-subhead')]
      .map(h => (h.textContent || '').trim());
    const suggestedNames = () => {
      /* Everything between the first heading and "Everything else" — read off
         the rendered list rather than the internals, so this measures what a
         child is actually shown. */
      const kids = [...document.querySelectorAll('#slotPickerList > *')];
      const start = kids.findIndex(el => el.classList.contains('spc-subhead'));
      const end = kids.findIndex((el, i) => i > start && el.classList.contains('spc-subhead'));
      if (start === -1 || end === -1) return [];
      return kids.slice(start + 1, end).map(t => (t.textContent || '').trim());
    };

    const freeKey = keyFor(false);
    const schoolKey = keyFor(true);
    if (!freeKey || !schoolKey) return ['the week holds no school day and free day to test with'];

    const had = { free: (getDayBlocks(freeKey) || []).slice(),
                  school: (getDayBlocks(schoolKey) || []).slice() };
    const kid = activeProfile();
    try {
      // ── 12:30 on a day with no school. Nothing else planned, so room is not
      //    what is being tested here.
      setDayBlocks(freeKey, [], kid);
      currentDayKey = freeKey;
      openDay(freeKey);
      openSlotPicker(12 * 60 + 30);
      const sug = suggestedNames();
      if (!sug.length) bad.push('nothing at all was suggested for 12:30 on a free day');

      const has = re => sug.some(n => re.test(n));
      if (!has(/Lunch/)) bad.push(`Lunch is not suggested at 12:30 — got: ${sug.join(', ')}`);
      [[/Evening Routine/, 'Evening Routine'], [/Morning Routine/, 'Morning Routine'],
       [/Breakfast/, 'Breakfast'], [/Dinner/, 'Dinner']].forEach(([re, name]) => {
        if (has(re)) bad.push(`${name} is still suggested at half past twelve`);
      });
      closeSheet('slotPickerOverlay');

      // ── The same list at half past seven in the morning: now the breakfast
      //    end of the day is right and Lunch is the one that does not belong.
      openSlotPicker(7 * 60 + 30);
      const morning = suggestedNames();
      if (morning.length) {
        if (!morning.some(n => /Breakfast|Morning Routine/.test(n))) {
          bad.push(`nothing morning-ish suggested at 7:30 — got: ${morning.join(', ')}`);
        }
        if (morning.some(n => /Dinner|Evening Routine/.test(n))) {
          bad.push('the evening is still suggested at half past seven in the morning');
        }
      }
      closeSheet('slotPickerOverlay');

      /* ── BOTH HEADINGS SURVIVE AN EMPTY ROW. On a real school day at 12:30
         the only activity matching the school band is School Day itself, which
         is far too long to fit — so the suggestion row is empty, and both
         headings used to disappear together leaving a bare list with nothing to
         say the app had looked. */
      setDayBlocks(schoolKey, [], kid);
      currentDayKey = schoolKey;
      openDay(schoolKey);
      openSlotPicker(12 * 60 + 30);
      const hs = headings();
      if (!hs.some(h => /Good for|Nothing obvious/.test(h))) {
        bad.push(`the picker lost its first heading on a school day: ${hs.join(' | ')}`);
      }
      if (!hs.some(h => /Everything else/.test(h))) {
        bad.push(`the picker lost "Everything else" on a school day: ${hs.join(' | ')}`);
      }
      if (!namesIn().length) bad.push('the school-day picker listed nothing at all');
      closeSheet('slotPickerOverlay');
    } finally {
      setDayBlocks(freeKey, had.free, kid);
      setDayBlocks(schoolKey, had.school, kid);
    }
    return bad.length === 0 || bad;
  });

  /* A BLOCK CAN GO STRAIGHT ON WITHOUT COMING HOME.

     `travelBufMin` was one number drawn before a block and after it, so the
     ordinary Tuesday could not be said at all: school, then straight on to
     training, then home. There is no drive home from school that day, the drive
     to training leaves from the school gates rather than the house, and the
     drive home afterwards is longer than either.

     Three things have to hold. The legs are independent and carry their own
     minutes. A block that predates the split behaves EXACTLY as it does today,
     with nothing written to it — derived, never migrated, the same rule as xp2.
     And the clash arithmetic follows: a School Day with no drive home must stop
     being reported as running into whatever comes next. */
  if (want('aBlockCanGoStraightOnWithoutComingHome')) checks.aBlockCanGoStraightOnWithoutComingHome = await page.evaluate(() => {
    const bad = [];

    // (1) A legacy block — only the symmetric fields — is unchanged.
    const legacy = { id: 'lg', startMin: 8 * 60, durationMin: 60,
      travelBuffer: true, travelBufMin: 20, getReadyBuffer: true, getReadyBufMin: 10 };
    if (getTravelBufMin(legacy, 'pre') !== 20) bad.push('legacy pre travel is not 20');
    if (getTravelBufMin(legacy, 'post') !== 20) bad.push('legacy post travel is not 20');
    if (getGetReadyBufMin(legacy, 'pre') !== 10) bad.push('legacy pre get-ready is not 10');
    if (getGetReadyBufMin(legacy, 'post') !== 10) bad.push('legacy post get-ready is not 10');
    // Asked without a side — the shape every existing caller uses — it still answers.
    if (getTravelBufMin(legacy) !== 20) bad.push('legacy sideless travel is not 20');

    // (2) Tuesday: school with a drive there and none home.
    const school = { id: 'tu-school', startMin: 8 * 60, durationMin: 400,
      travelBuffer: true, travelBufMin: 15,
      travelTo: true, travelToMin: 15, travelHome: false,
      getReadyBuffer: true, getReadyBufMin: 15,
      readyBefore: true, readyBeforeMin: 15, readyAfter: false };
    if (getTravelBufMin(school, 'pre') !== 15) bad.push('the drive to school is not 15');
    if (getTravelBufMin(school, 'post') !== 0) bad.push('a drive home was drawn from a day with none');
    if (getGetReadyBufMin(school, 'post') !== 0) bad.push('gear-away was drawn after a straight-on day');

    // …and the training it goes on to: a short hop there, a longer drive back.
    const training = { id: 'tu-train', startMin: 15 * 60 + 30, durationMin: 90,
      travelBuffer: true, travelBufMin: 20,
      travelTo: true, travelToMin: 20, travelHome: true, travelHomeMin: 35 };
    if (getTravelBufMin(training, 'pre') !== 20) bad.push('the hop from school is not 20');
    if (getTravelBufMin(training, 'post') !== 35) bad.push('the drive home is not 35');

    // (3) The segments drawn follow, and so does the clash arithmetic.
    const segs = wfBufferSegments(school);
    const post = segs.filter(s => s.side === 'post');
    if (post.length) bad.push(`${post.length} segment(s) drawn after a block with no return leg`);
    const pre = segs.filter(s => s.side === 'pre');
    if (pre.length !== 2) bad.push(`expected get-ready and travel before school, got ${pre.length}`);

    /* The whole point: with no drive home, School Day no longer runs into the
       thing after it. The same pair WITH a return leg is a 20-minute clash —
       assert both, or this only proves the conflict test can return nothing. */
    const after = { id: 'tu-next', startMin: 15 * 60, durationMin: 60 };
    const quiet = computeBufferConflicts([school, after]);
    if (quiet.affected.has('tu-next')) {
      bad.push('a block with no drive home is still reported as clashing');
    }
    const symmetric = Object.assign({}, school, { travelHome: true, readyAfter: true });
    const loud = computeBufferConflicts([symmetric, after]);
    if (!loud.affected.has('tu-next')) {
      bad.push('the same pair WITH a return leg reports no clash — the test proves nothing');
    }

    /* (4) AND THE SHEET SAYS EACH LEG FROM ITS OWN FIGURE. renderSheetTimeSummary
       (js/08-day-view.js) took ONE travel number and ONE get-ready number and
       applied both symmetrically, so the training above read "15m before + 15m
       after" while its real drive home is 35, and the Tuesday school block
       promised a drive home it does not have. Rendered into a scratch host, so
       this tests the function every sheet calls rather than one sheet's
       plumbing. */
    const host = document.createElement('div');
    host.id = 'smk-time-summary';
    document.body.appendChild(host);
    try {
      renderSheetTimeSummary('smk-time-summary', training.startMin, training.durationMin,
        true, 20, true, 15, false, 20,
        { travelHome: true, travelHomeMin: 35, readyAfter: true, readyAfterMin: 25 });
      const t = host.textContent || '';
      if (!t.includes('35m')) bad.push(`the sheet does not name the 35m drive home: "${t}"`);
      if (!t.includes('25m')) bad.push(`the sheet does not name the 25m unpack: "${t}"`);
      const wantHome = formatTimeFromMin(training.startMin + training.durationMin + 35);
      if (!t.includes(wantHome)) bad.push(`the sheet puts her home at something other than ${wantHome}: "${t}"`);

      renderSheetTimeSummary('smk-time-summary', school.startMin, school.durationMin,
        true, 15, true, 15, false, 20, { travelHome: false, readyAfter: false });
      const u = host.textContent || '';
      if (/Home about/i.test(u)) bad.push('a block with no drive home still promises one');
      if (!/straight on/i.test(u)) bad.push('a block with no drive home says nothing about it');
      if (/Unpack/i.test(u)) bad.push('a block with no return leg still offers unpacking');
    } finally { host.remove(); }

    // (5) A block carrying the new fields survives the merge whole.
    const merged = mergeArrayById([school], [Object.assign({}, school,
      { travelHomeMin: 40, updatedAt: Date.now() + 1000 })]);
    const got = merged.find(x => x.id === 'tu-school');
    if (!got || got.travelHome !== false) {
      bad.push('travelHome did not survive a whole-record merge');
    }
    return bad.length === 0 || bad;
  });

  /* EVERY SUBGROUP TELLS ITSELF APART.

     Five of the twelve subgroups were crowded into one green-teal corner, and
     the worst pair — Helping hands and Play — sat at CIEDE2000 2.9, which is
     not a difference an eye can report. They are in DIFFERENT categories, so a
     chore and an afternoon of Minecraft drew as the same colour.

     Two things this asserts, and the second is the subtler one.

     THE METRIC. The palette was first separated with CIE76, which overstates
     the distance between saturated greens by about double — it scored that same
     pair at 49 after a "fix" that had not fixed it. colourDistance
     (js/05-helpers.js) is CIEDE2000, and this check measures the same way the
     table was chosen, rather than carrying its own copy.

     WHICH PAIRS COUNT. Two subgroups inside ONE category are meant to look
     related — Meals and Appointments are both Fuel & Care and sit at 9.8, and
     that is the design working, not a defect. The floor applies to pairs that
     cross a category boundary; within one, all that is required is that they
     are not literally the same value. */
  if (want('everySubgroupTellsItselfApart')) checks.everySubgroupTellsItselfApart = await page.evaluate(() => {
    const bad = [];
    /* 14 is the floor this palette clears with room (its worst cross-category
       pair is Arts vs Outings at 15.0) and is comfortably above the ~5 at which
       two colours stop being reliably distinguishable on a small card. Raising
       it is a design decision, not a bug fix — six categories over a pastel
       wheel that must all take dark ink is a genuinely tight budget. */
    const FLOOR = 14;
    const subs = [];
    ACTIVITY_CATEGORIES.forEach(c => c.subs.forEach(sg => {
      subs.push({ id: sg.id, label: sg.label, hex: sg.hex, cat: c.id });
    }));
    if (subs.length < 12) bad.push(`only ${subs.length} subgroups found`);

    for (let i = 0; i < subs.length; i++) {
      for (let j = i + 1; j < subs.length; j++) {
        const a = subs[i], b = subs[j];
        const d = colourDistance(a.hex, b.hex);
        if (a.cat === b.cat) {
          if (a.hex.toLowerCase() === b.hex.toLowerCase()) {
            bad.push(`${a.label} and ${b.label} are the same hex ${a.hex}`);
          }
          continue;
        }
        if (d < FLOOR) {
          bad.push(`${a.label} (${a.cat}) and ${b.label} (${b.cat}) are ${d.toFixed(1)} apart, under ${FLOOR}`);
        }
      }
    }

    /* Dark ink on every one of them, to AA. White text fails on all these
       pastels (CLAUDE.md, UI rules), so a value too dark for ink has no legible
       text at all — Training shipped at 4.27 until this check went in. */
    subs.forEach(sg => {
      if (!isLightColour(sg.hex)) bad.push(`${sg.label} ${sg.hex} is too dark for ink`);
      const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      const v = [1, 3, 5].map(i => parseInt(sg.hex.substr(i, 2), 16));
      const L = 0.2126 * lin(v[0]) + 0.7152 * lin(v[1]) + 0.0722 * lin(v[2]);
      const Link = 0.2126 * lin(0x2a) + 0.7152 * lin(0x23) + 0.0722 * lin(0x20);
      const ratio = (L + 0.05) / (Link + 0.05);
      if (ratio < 4.5) bad.push(`${sg.label} ${sg.hex} gives ink only ${ratio.toFixed(2)}:1`);
    });

    /* EVERY RETIRED HEX IS STILL SEEDED. blockColour ignores b.colour only
       while the value is one the table itself wrote, so a hex dropped from
       SEEDED_HEX_VALUES makes every block already carrying it read as a colour
       somebody CHOSE — frozen at the old hue forever, with no migration
       possible. This is the half of a recolour that fails silently. */
    RETIRED_SEEDED_HEXES.forEach(h => {
      if (!SEEDED_HEX_VALUES.has(h.toLowerCase())) {
        bad.push(`retired hex ${h} is not in SEEDED_HEX_VALUES`);
      }
    });
    const kid = activeProfile();
    const key = getDayKeys(0)[0];
    const had = (getDayBlocks(key) || []).slice();
    try {
      // A block seeded with a retired hue re-derives rather than keeping it.
      setDayBlocks(key, [{ id: 'pal-old', actId: 'chores', startMin: 17 * 60,
        durationMin: 30, colour: '#9fd3b8' }], kid);
      const drew = blockColour(getDayBlocks(key, kid)[0], kid);
      if (drew.toLowerCase() === '#9fd3b8') {
        bad.push('a block seeded with the retired Helping hands hue still wears it');
      }
      // …while a colour a person really picked is left alone.
      setDayBlocks(key, [{ id: 'pal-mine', actId: 'chores', startMin: 17 * 60,
        durationMin: 30, colour: '#123456' }], kid);
      if (blockColour(getDayBlocks(key, kid)[0], kid).toLowerCase() !== '#123456') {
        bad.push('a hand-picked colour was overridden');
      }
    } finally { setDayBlocks(key, had, kid); }

    /* ONE OWNER. groupHex used to be a second table holding four of these hexes
       again, so a recolour would have moved the cards and left the hours charts
       and the meeting bars on the old values. */
    ACTIVITY_CATEGORIES.forEach(c => c.subs.forEach(sg => {
      const g = groupHex(sg.group);
      const anyWithGroup = [];
      ACTIVITY_CATEGORIES.forEach(c2 => c2.subs.forEach(s2 => {
        if (s2.group === sg.group) anyWithGroup.push(s2.hex.toLowerCase());
      }));
      if (!anyWithGroup.includes(String(g).toLowerCase())) {
        bad.push(`groupHex('${sg.group}') is ${g}, which no subgroup wears`);
      }
    }));

    return bad.length === 0 || bad;
  });

  /* THE STRIP STILL SAYS WHEN TO LEAVE, AND WHEN YOU ARE BACK.

     Every clock time vanished from this surface. Three causes, compounding:

     (1) `colPx`, the width every label is checked against, was read off a cell
     that is appended to the grid at the END of its own iteration — always 0, so
     the `|| 120` fallback was always the answer. (2) Every label carrying a time
     is 158–211px of this type, so against that 115px budget the `long` tier was
     structurally unreachable, and the ladder's next rung threw the CLOCK away
     and kept the MINUTES — which the strip's own length already draws. (3) A
     lone fifteen-minute buffer is 10.8px and cannot hold a 13.1px line at any
     width, so it says nothing at all.

     What must hold is the FACT, not the mechanism: for a block that carries
     travel, the time it has to be left by and the time it is back must appear
     somewhere on that day — on the strip, on the merged band, or on the card —
     at one lane and at two, and without overflowing whatever draws it.

     AND NOW THERE ARE TWO FACTS A SIDE, not one. Going out, the moment she
     starts getting ready and the moment the car leaves are half an hour apart
     and a parent acts on both; a label that prints the first figure under the
     travel icon is the right number wearing the wrong name. Both must be
     VISIBLE in a full column. In a split lane they cannot be — the column is
     about 54px and two clock times are 130 — so what is required there is that
     the leave-by time is visible and the other is spelled out in a tooltip,
     which is also what a screen reader gets at every width. That is the
     distinction the old check could not make: it searched the label text and
     the tooltips together, so an overflowing label and a fitted one read the
     same to it. */
  if (want('theStripStillSaysWhenToLeave')) checks.theStripStillSaysWhenToLeave = await page.evaluate(() => {
    goWeek(); setWeekView('full');
    const kid = activeProfile();
    const key = getDayKeys(0)[3];
    const had = (getDayBlocks(key) || []).slice();
    const bad = [];
    const col = () => {
      const cells = [...document.querySelectorAll('#weeklyFullGrid .wf-day-col')];
      return cells[3] || cells[0] || null;
    };
    // Drawn text and tooltip text are kept APART, because they answer different
    // questions: what a parent can read at a glance, and what the record holds.
    const seen = () => (col() ? col().textContent || '' : '');
    const tips = () => (col()
      ? [...col().querySelectorAll('[title]')].map(el => el.getAttribute('title')).join(' ')
      : '');
    /* A visible figure may have dropped its meridiem — two times sharing one
       label cannot afford "am" twice — so the bare form counts on screen while
       the tooltip is held to the whole thing. */
    const wants = (label, mins) => {
      const full = formatTimeFromMin(mins);
      const bare = full.replace(/(am|pm)$/, '');
      if (!seen().includes(bare)) bad.push(`${label}: nothing on the day shows ${full}`);
      if (!tips().includes(full)) bad.push(`${label}: no tooltip spells out ${full}`);
    };
    // For a figure the visible surface has no room for: the record still has it.
    const wantsOnRecord = (label, mins) => {
      const full = formatTimeFromMin(mins);
      if (!tips().includes(full)) bad.push(`${label}: no tooltip spells out ${full}`);
    };
    try {
      /* School Day 8:10am–2:50pm, fifteen minutes of getting ready and fifteen
         of driving each way. Leave by 7:40, back through the door at 3:05 —
         the run's start going out, the end of the TRAVEL coming back, never the
         end of the put-the-gear-away that follows it. */
      setDayBlocks(key, [
        { id: 'ts-school', actId: 'school_day', startMin: 8 * 60 + 10, durationMin: 400,
          travelBuffer: true, travelBufMin: 15, getReadyBuffer: true, getReadyBufMin: 15 },
      ], kid);
      weekOffset = 0; renderWeek();
      wants('one lane, get ready from', 8 * 60 + 10 - 30);
      wants('one lane, leave by',       8 * 60 + 10 - 15);
      wants('one lane, home by',        8 * 60 + 10 + 400 + 15);
      // Unpacking has no deadline, so it is the figure the label drops first.
      wantsOnRecord('one lane, unpacked by', 8 * 60 + 10 + 400 + 30);

      /* A LONE SHORT BUFFER. Travel only, no get-ready: 10.8px, under the height
         a line needs at any width, so the strip cannot speak and the card has to.
         This is the case that has no band to fall back on. */
      setDayBlocks(key, [
        { id: 'ts-solo', actId: 'ballet', startMin: 17 * 60, durationMin: 60,
          travelBuffer: true, travelBufMin: 15, getReadyBuffer: false },
      ], kid);
      renderWeek();
      wants('lone strip', 17 * 60 - 15);

      /* AND IN HALF A COLUMN. A lane split halves every width budget, which is
         where the old code went silent first. */
      setDayBlocks(key, [
        { id: 'ts-a', actId: 'school_day', startMin: 8 * 60 + 10, durationMin: 400,
          travelBuffer: true, travelBufMin: 15, getReadyBuffer: true, getReadyBufMin: 15 },
        { id: 'ts-b', actId: 'homework', startMin: 10 * 60, durationMin: 120 },
      ], kid);
      renderWeek();
      const lanes = [...document.querySelectorAll('#weeklyFullGrid .wf-day-col')][3];
      const cards = lanes ? [...lanes.querySelectorAll('.wf-card')] : [];
      if (cards.length === 2 && cards[0].getBoundingClientRect().width > 20) {
        // Half a column holds one clock time. It has to be the leave-by one.
        wants('two lanes, leave by', 8 * 60 + 10 - 15);
        wantsOnRecord('two lanes, get ready from', 8 * 60 + 10 - 30);
      }

      /* Whatever spoke must fit what it drew — no ellipsis, no second line.
         .wf-travel-band-label is in this list deliberately: it is the element
         that actually carries a band's text, and while it was left out a band
         label 30px too wide for its column passed this sweep untouched. */
      [...document.querySelectorAll('#screen-week .wf-travel, #screen-week .wf-travel-band-label, #screen-week .wf-card-travel')]
        .forEach(el => {
          const txt = (el.textContent || '').trim();
          if (!txt) return;
          if (el.scrollWidth > el.clientWidth + 1) {
            bad.push(`"${txt}" needs ${el.scrollWidth}px of width in ${el.clientWidth}px`);
          }
          if (el.scrollHeight > el.clientHeight + 1) {
            bad.push(`"${txt}" needs ${el.scrollHeight}px of height in ${el.clientHeight}px`);
          }
        });

      /* AND NOTHING IS PRINTED THROUGH IT. The zone bands name each stretch of
         the day at its top edge, and a buffer run beginning on that boundary
         lands its time in the same pixels — invisible while the strips were
         mute, and two lines of text through each other the moment they spoke
         again. Restore the first fix and this is what it missed. */
      const spoken = [...document.querySelectorAll('#screen-week .wf-travel')]
        .filter(el => (el.textContent || '').trim());
      [...document.querySelectorAll('#screen-week .wf-band-label')].forEach(lbl => {
        const lr = lbl.getBoundingClientRect();
        if (lr.height < 1) return;
        spoken.forEach(el => {
          const sr = el.getBoundingClientRect();
          const hit = lr.left < sr.right - 0.5 && lr.right > sr.left + 0.5
                   && lr.top  < sr.bottom - 0.5 && lr.bottom > sr.top + 0.5;
          if (hit) {
            bad.push(`"${lbl.textContent.trim()}" is printed through "${el.textContent.trim()}"`);
          }
        });
      });
    } finally { setDayBlocks(key, had, kid); renderWeek(); }
    return bad.length === 0 || bad;
  });

  /* THE AFTER-BUFFER IS UNPACKING, AND SAYS SO.

     The two get-ready buffers are not the same job. Before a block it is
     preparation and it has a hard deadline -- it has to be finished when the
     car leaves. After it, it is unloading: wet kit out, gear away, and nothing
     downstream waits on it. Three of the four places that named a buffer kind
     were not side-aware, so the post side read "Get ready" on the print sheet
     and in every tooltip, and `seg.side` was in scope at each one of them and
     simply not asked.

     Held on the VOCABULARY and on the screens both, because one owner answering
     correctly proves nothing if a surface still writes its own ternary -- which
     is exactly the state this found. */
  if (want('theAfterBufferIsNotCalledGettingReady')) checks.theAfterBufferIsNotCalledGettingReady = await page.evaluate(() => {
    const bad = [];
    const seg = (side, kind) => ({
      side, kind, min: 15, icon: kind === 'travel' ? '🚗' : '👕',
      startRel: 9 * 60, endRel: 9 * 60 + 15,
    });
    // 1. Every tier any surface may pick, in both directions.
    ['tiny', 'time', 'short', 'long'].forEach(t => {
      const post = bufferSegLabels(seg('post', 'ready'), t);
      const pre  = bufferSegLabels(seg('pre',  'ready'), t);
      if (/get\s*ready/i.test(post)) bad.push(`post ${t}: "${post}" still says get ready`);
      if (/unpack/i.test(pre))       bad.push(`pre ${t}: "${pre}" says unpack before the block`);
    });
    // The words themselves, so a silently empty label cannot pass the test above.
    if (!/unpack/i.test(bufferSegLabels(seg('post', 'ready'), 'short'))) bad.push('the short tier does not say unpack');
    if (!/unpack/i.test(bufferSegLabels(seg('post', 'ready'), 'long')))  bad.push('the long tier does not say unpack');
    if (!/get\s*ready/i.test(bufferSegLabels(seg('pre', 'ready'), 'long'))) bad.push('the long tier no longer says get ready before a block');
    if (bufferKindLabel(seg('post', 'ready')) !== 'Unpack')    bad.push(`bufferKindLabel: "${bufferKindLabel(seg('post', 'ready'))}" after a block`);
    if (bufferKindLabel(seg('pre',  'ready')) !== 'Get ready') bad.push(`bufferKindLabel: "${bufferKindLabel(seg('pre',  'ready'))}" before a block`);

    // 2. And on the surfaces, where the copies used to live.
    const kid = activeProfile();
    const key = getDayKeys(0)[2];
    const had = (getDayBlocks(key) || []).slice();
    try {
      setDayBlocks(key, [
        { id: 'unp-1', actId: 'swimming', startMin: 16 * 60, durationMin: 60,
          travelBuffer: true, travelBufMin: 15, getReadyBuffer: true, getReadyBufMin: 15 },
      ], kid);

      // The week grid: labels and tooltips alike.
      goWeek(); setWeekView('full'); weekOffset = 0; renderWeek();
      const cols = [...document.querySelectorAll('#weeklyFullGrid .wf-day-col')];
      const cell = cols[2];
      const wkText = cell ? (cell.textContent || '') + ' '
        + [...cell.querySelectorAll('[title]')].map(e => e.getAttribute('title')).join(' ') : '';
      if (!/unpack/i.test(wkText)) bad.push('the week grid never says unpack for a block with a return leg');
      if (!/get\s*ready/i.test(wkText)) bad.push('the week grid no longer says get ready');

      // The print sheet, which carried its own copy of the ternary.
      openPrint();
      const printText = [...document.querySelectorAll('.print-travel, .print-travel [title], .print-sheet [title]')]
        .map(e => (e.textContent || '') + ' ' + (e.getAttribute('title') || '')).join(' ');
      if (/get\s*ready/i.test(printText) && !/unpack/i.test(printText)) {
        bad.push('the print sheet names the after-buffer as getting ready');
      }
      goWeek();

      // The day view's two strip labels. The arrow is what says which side.
      currentDayKey = key;
      openDay(key);
      [...document.querySelectorAll('#screen-day .placed-block.travel-buf')].forEach(el => {
        const txt = (el.textContent || '').trim();
        if (txt.includes('⬅') && /get\s*ready/i.test(txt)) {
          bad.push(`the day view draws "${txt}" after a block`);
        }
      });
      const dayText = document.getElementById('screen-day').textContent || '';
      if (!/unpack/i.test(dayText)) bad.push('the day view never says unpack for a block with a return leg');
    } finally {
      setDayBlocks(key, had, kid);
      goWeek(); setWeekView('full'); renderWeek();
    }
    return bad.length === 0 || bad;
  });

  /* A ZONE NAME IS DRAWN WHERE IT IS NEWS.

     `labelledCol` was `!isSchoolDay(key) || key !== axisKey`, which silences the
     axis day itself and labels every OTHER identical school day: four columns
     times four zones on an ordinary week, sixteen repeats of what the left
     sideband already says once, competing with the cards and the buffer times
     for the same pixels. The same expression failed the other way round on a
     week with no school in it at all -- `axisKey` is then null, `key !==
     axisKey` is true everywhere, and all seven columns printed the same
     "Free time".

     The rule now: a column names its zones only when its SHAPE differs from the
     day the axis is describing. So the school columns of a term week say
     nothing, a Saturday inside one still speaks because it really is different,
     and a week that is all holiday says it once on the axis. */
  if (want('aZoneNameIsDrawnOnlyWhereItIsNews')) checks.aZoneNameIsDrawnOnlyWhereItIsNews = await page.evaluate(() => {
    const bad = [];
    const wasOffset = weekOffset;
    const perCol = () => [...document.querySelectorAll('#weeklyFullGrid .wf-day-col')]
      .map(c => [...c.querySelectorAll('.wf-band-label')]
        .map(l => (l.textContent || '').trim()).filter(Boolean));
    try {
      const termWeek = (() => {
        for (let w = -20; w <= 40; w++) if (getDayKeys(w).some(k => isSchoolDay(k))) return w;
        return null;
      })();
      if (termWeek == null) return ['no week in range has a school day'];

      goWeek(); setWeekView('full');
      weekOffset = termWeek; renderWeek();
      const keys = getDayKeys(termWeek);
      const cols = perCol();
      keys.forEach((k, i) => {
        const drew = cols[i] || [];
        if (isSchoolDay(k) && drew.length) {
          bad.push(`${k}: a school column repeats "${drew.join('", "')}" that the axis already says`);
        }
        if (!isSchoolDay(k) && !drew.length) {
          bad.push(`${k}: a day unlike the axis day names none of its zones`);
        }
      });

      /* And the July case: every column has the axis's own shape, so not one of
         them is news. This is the half the old expression got exactly backwards. */
      const summerWeek = (() => {
        for (let w = 0; w <= 60; w++) if (getDayKeys(w).every(k => !isSchoolDay(k))) return w;
        return null;
      })();
      if (summerWeek != null) {
        weekOffset = summerWeek; renderWeek();
        const n = perCol().reduce((a, x) => a + x.length, 0);
        if (n) bad.push(`a week with no school in it labels ${n} zones across its columns`);
      }
    } finally {
      weekOffset = wasOffset; goWeek(); setWeekView('full'); renderWeek();
    }
    return bad.length === 0 || bad;
  });

  /* A FLOORED CARD NEVER SITS ON THE ONE BELOW IT — AND NEVER COSTS IT A LANE.

     At 0.72px per minute the 20px floor is 28 minutes, so every block shorter
     than that is drawn taller than it is. Two answers to that have now been
     wrong in opposite directions. Comparing startMin and durationMin drew a
     ten-minute After-School Routine at 8:50pm straight THROUGH a 9:00pm Evening
     Routine. Comparing the floored pixels stopped that, but then split a lane
     for any near neighbour — a 3:40pm routine and a 4:00pm piano lesson, which
     do not overlap by a single minute, came out as two half-width cards with
     their names erased.

     wfCardBoxes settles it: the floor borrows the EMPTY minutes before the
     block, so the card's bottom edge — the one that abuts the next card — stays
     truthful, and a lane is split only when the two really do overlap or when
     there was nothing to borrow.

     Both cases here, on one fixture each: the Tuesday evening from the original
     screenshot, and the Wednesday from this one. */
  if (want('aFlooredCardNeverSitsOnTheOneBelowIt')) checks.aFlooredCardNeverSitsOnTheOneBelowIt = await page.evaluate(() => {
    goWeek(); setWeekView('full');
    const kid = activeProfile();
    const key = getDayKeys(0)[1];
    const had = (getDayBlocks(key) || []).slice();
    const bad = [];
    const cardFor = id => [...document.querySelectorAll('#screen-week .wf-card')]
      .find(c => (c.outerHTML || '').includes(id));
    const colWidth = () => {
      const h = document.querySelector('#screen-week .wf-day-header');
      return h ? h.getBoundingClientRect().width : 0;
    };
    try {
      // (1) Two short routines minutes apart: drawn clear of each other …
      setDayBlocks(key, [
        { id: 'fl-after', actId: 'routine_afterschool', startMin: 20 * 60 + 50, durationMin: 10 },
        { id: 'fl-eve',   actId: 'routine_evening',     startMin: 21 * 60,      durationMin: 30 },
      ], kid);
      weekOffset = 0; renderWeek();

      const a = cardFor('fl-after'), b = cardFor('fl-eve');
      if (!a || !b) return ['the two routines did not both draw'];
      const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      const hit = ar.left < br.right - 0.5 && ar.right > br.left + 0.5
               && ar.top  < br.bottom - 0.5 && ar.bottom > br.top + 0.5;
      if (hit) bad.push('the two cards are still drawn on top of each other');
      // … and still the same width as each other, whichever width that is.
      if (ar.width > br.width * 1.6 || br.width > ar.width * 1.6) {
        bad.push(`the lanes are uneven: ${Math.round(ar.width)}px against ${Math.round(br.width)}px`);
      }
      // And both still say what they are.
      [[a, 'After-School'], [b, 'Evening']].forEach(([card, want]) => {
        const nm = card.querySelector('.wf-card-name');
        if (!nm || !nm.textContent.trim()) bad.push(`the ${want} card draws no name`);
      });

      /* (2) THE WEDNESDAY. A 20-minute After-School Routine ending at 4:00pm
         and a 4:00pm Piano lesson share not one minute, so neither may lose
         half its column — the day view draws both full width and is right. */
      setDayBlocks(key, [
        { id: 'fl-asr',   actId: 'routine_afterschool', startMin: 15 * 60 + 40, durationMin: 20 },
        { id: 'fl-piano', actId: 'piano',               startMin: 16 * 60,      durationMin: 30 },
      ], kid);
      renderWeek();

      const asr = cardFor('fl-asr'), piano = cardFor('fl-piano');
      if (!asr || !piano) {
        bad.push('the routine and the piano lesson did not both draw');
      } else {
        const pr = asr.getBoundingClientRect(), qr = piano.getBoundingClientRect();
        const clash = pr.left < qr.right - 0.5 && pr.right > qr.left + 0.5
                   && pr.top  < qr.bottom - 0.5 && pr.bottom > qr.top + 0.5;
        if (clash) bad.push('the routine and the piano lesson overlap on screen');
        /* Full width: they do not overlap in TIME, so nothing may halve them.
           Measured against the real column rather than a constant, because the
           column width is exactly the number this surface kept getting wrong. */
        const col = colWidth();
        if (!col) bad.push('could not measure a day column');
        else [[asr, 'After-School Routine'], [piano, 'Piano']].forEach(([card, want]) => {
          const w = card.getBoundingClientRect().width;
          if (w < col * 0.8) {
            bad.push(`${want} is ${Math.round(w)}px in a ${Math.round(col)}px column — it lost a lane to nothing`);
          }
          const nm = card.querySelector('.wf-card-name');
          if (!nm || !nm.textContent.trim()) bad.push(`${want} draws no name`);
        });
        // The bottom edge stays truthful: a floored card grows upward, never past 4:00pm.
        if (pr.bottom > qr.top + 1.5) {
          bad.push('the floored routine is drawn past the start of the piano lesson');
        }
      }
    } finally { setDayBlocks(key, had, kid); renderWeek(); }
    return bad.length === 0 || bad;
  });

  /* THE DAY VIEW SAYS THE SAME THING ABOUT A CLASH.

     The quantified half of the clash story was week-grid-only. The day view drew
     a red outline and a ⚠️ whose tooltip read "overlaps another activity" —
     naming nothing, counting nothing — which is backwards: the week grid is
     where you SEE a clash, the day view is where you drag it away, and only the
     first would tell you how big it was. A tooltip is also no use on an iPad.

     The failure to guard against is not "the badge is missing" but "the two
     surfaces disagree", so this seeds one fixture and asserts the SAME number
     and the SAME partner name on both. */
  if (want('theDayViewSaysTheSameThingAboutAClash')) checks.theDayViewSaysTheSameThingAboutAClash = await page.evaluate(() => {
    const kid = activeProfile();
    const key = getDayKeys(0)[4];
    const had = (getDayBlocks(key) || []).slice();
    const bad = [];
    const minutesIn = s => {
      const m = (s || '').match(/(\d+)\s*m\s*(over|short)/);
      return m ? Number(m[1]) : null;
    };
    try {
      /* School Day home at 2:50pm with fifteen minutes of driving and fifteen of
         putting things away — thirty minutes of buffer into a 3:00pm Homework
         block, so twenty of them do not fit. */
      setDayBlocks(key, [
        { id: 'cl-school', actId: 'school_day', startMin: 8 * 60 + 10, durationMin: 400,
          travelBuffer: true, travelBufMin: 15, getReadyBuffer: true, getReadyBufMin: 15 },
        { id: 'cl-home', actId: 'homework', startMin: 15 * 60, durationMin: 150 },
      ], kid);

      // What the shared owner says, which is what both screens must show.
      const blocks = getDayBlocks(key, kid);
      const conflicts = computeBufferConflicts(blocks);
      const want = clashWorstShort(conflicts, 'cl-home', blocks);
      if (want !== 20) bad.push(`the fixture is ${want}m over, expected 20`);

      // ── The week grid.
      goWeek(); setWeekView('full'); weekOffset = 0; renderWeek();
      const wkCard = [...document.querySelectorAll('#screen-week .wf-card')]
        .find(c => (c.outerHTML || '').includes('cl-home'));
      const wkFlag = wkCard && wkCard.querySelector('.wf-card-conflict-flag');
      const wkMin = wkFlag && minutesIn(wkFlag.textContent);
      if (wkMin !== want) bad.push(`the week grid says ${wkMin}, the owner says ${want}`);

      // ── The day view, on the same fixture.
      currentDayKey = key;
      openDay(key);
      const dvBlock = document.getElementById('block-cl-home');
      if (!dvBlock) return bad.concat(['Homework did not draw on the day view']);
      if (!dvBlock.classList.contains('placed-block--conflict')) {
        bad.push('the day view does not mark Homework as clashing');
      }
      const dvBadge = dvBlock.querySelector('.badge-clash');
      const dvMin = dvBadge && minutesIn(dvBadge.textContent);
      if (dvMin !== want) {
        bad.push(`the day view says ${dvMin === null ? 'nothing' : dvMin}, the owner says ${want}`);
      }
      // It names what it runs into, rather than "another activity".
      const dvTitle = (dvBadge && dvBadge.getAttribute('title')) || '';
      if (!/School Day/.test(dvTitle)) {
        bad.push(`the day view does not name the partner: "${dvTitle}"`);
      }
      if (/another activity/.test(dvTitle)) {
        bad.push('the day view still says "another activity"');
      }
      // And the shortfall is drawn to scale, without swallowing taps.
      const ov = dvBlock.parentElement.querySelector('.tl-overrun');
      if (!ov) bad.push('the day view draws no overrun');
      else {
        if (getComputedStyle(ov).pointerEvents !== 'none') {
          bad.push('the day-view overrun swallows taps meant for the block');
        }
        const drawn = ov.getBoundingClientRect().height;
        const expect = want * PX_PER_MIN;
        if (Math.abs(drawn - expect) > 2) {
          bad.push(`the overrun is ${Math.round(drawn)}px for ${want}m, expected ${Math.round(expect)}px`);
        }
      }
    } finally { setDayBlocks(key, had, kid); }
    return bad.length === 0 || bad;
  });

  /* THE DAY VIEW CLIPS ITS BUFFERS THE SAME WAY.

     Strips there sit UNDER the blocks, so nothing was overprinted — but a strip
     drawn at full length still claimed minutes the next activity was using, and
     its centred label landed beneath a card where nobody could read it. Same
     owner, same answer: three surfaces, one rule. */
  if (want('theDayViewClipsItsBuffersTheSameWay')) checks.theDayViewClipsItsBuffersTheSameWay = await page.evaluate(() => {
    const kid = activeProfile();
    const key = getDayKeys(0)[2];
    const had = (getDayBlocks(key) || []).slice();
    const bad = [];
    try {
      setDayBlocks(key, [
        { id: 'dv-school', actId: 'school_day', startMin: 8 * 60 + 10, durationMin: 400,
          travelBuffer: true, travelBufMin: 15, getReadyBuffer: true, getReadyBufMin: 15 },
        { id: 'dv-home',   actId: 'homework',   startMin: 15 * 60, durationMin: 150 },
      ], kid);
      currentDayKey = key;
      openDay(key);

      const strips = [...document.querySelectorAll('#timeline .placed-block.travel-buf')];
      const blocks = [...document.querySelectorAll('#timeline .placed-block')]
        .filter(el => !el.classList.contains('travel-buf'));
      if (!strips.length) return ['the day view drew no buffer strips'];

      strips.forEach(s => {
        const sr = s.getBoundingClientRect();
        if (sr.height < 1) return;
        blocks.forEach(b => {
          const br = b.getBoundingClientRect();
          const hit = sr.left < br.right - 0.5 && sr.right > br.left + 0.5
                   && sr.top  < br.bottom - 0.5 && sr.bottom > br.top + 0.5;
          if (hit) bad.push(`a ${Math.round(sr.height)}px strip runs under ${b.id}`);
        });
        // A strip too short for a line says nothing rather than printing over itself.
        const meta = s.querySelector('.block-meta');
        const txt = (meta && meta.textContent.trim()) || '';
        if (txt && sr.height < 17) {
          bad.push(`a ${Math.round(sr.height)}px strip still prints "${txt}"`);
        }
      });
    } finally { setDayBlocks(key, had, kid); }
    return bad.length === 0 || bad;
  });

  /* A STACKED CARD FITS WHAT IT DRAWS.

     The week card's tall layout budgeted 58px for its four fixed rows and 20px
     a goal line. At the sizes this grid actually ships those rows cost 66 and
     17 — the kid readability floor lifted .wf-card-time, -dur and -sum to
     13.1px and nothing re-measured what fits — and .wf-card--tall .wf-card-name
     is allowed TWO lines, which the budget never counted at all. So every
     stacked card overflowed its own box by 7-21px and a training block's goal
     lines ran straight through the duration underneath them.

     Measures the real thing: the in-flow children of each stacked card against
     the card's own height. The tick is absolutely positioned and deliberately
     excluded — it is the one child that is meant to sit outside the flow. Same
     shape of assertion as aShortBlockStillSaysWhatItIs: whatever the row costs
     become, a card may never draw more than it can hold. */
  if (want('theStackedCardFitsWhatItDraws')) checks.theStackedCardFitsWhatItDraws = await page.evaluate(() => {
    goWeek(); setWeekView('full');
    const kid = activeProfile();
    const key = getDayKeys(0)[2];
    const had = (getDayBlocks(key) || []).slice();
    const bad = [];
    try {
      /* Training blocks carry the most rows of anything in the app — four gear
         checks plus their goals — so they are where the budget breaks first.
         The ladder spans every stacked height the grid can draw. */
      setDayBlocks(key, [
        { id: 'st-90',  actId: 'training', startMin: 7 * 60,  durationMin: 90,  tag: 'skating',
          gearState: {}, objectives: ['Double Axel attempts', 'Layback spin'] },
        { id: 'st-120', actId: 'training', startMin: 9 * 60,  durationMin: 120, tag: 'skating',
          gearState: {}, objectives: ['Double Axel attempts', 'Layback spin', 'Footwork sequence'] },
        { id: 'st-180', actId: 'training', startMin: 11 * 60 + 30, durationMin: 180, tag: 'swimming',
          gearState: {}, objectives: ['Breaststroke KICK (board only)', 'Butterfly strength set', 'Freestyle endurance'] },
        { id: 'st-240', actId: 'competition', startMin: 15 * 60, durationMin: 240, tag: 'skating',
          gearState: {}, objectives: ['Program run-through', 'Land my key jumps clean'] },
      ], kid);
      weekOffset = 0; renderWeek();

      const tall = [...document.querySelectorAll('#screen-week .wf-card--tall')];
      if (tall.length < 4) return [`seeded 4 stackable blocks, the week stacked ${tall.length}`];

      tall.forEach(c => {
        const box = c.getBoundingClientRect();
        const gap = parseFloat(getComputedStyle(c).rowGap) || 0;
        const rows = [...c.children].filter(e => {
          const st = getComputedStyle(e);
          // The tick sits outside the flow on purpose; everything else stacks.
          return st.display !== 'none' && st.position !== 'absolute';
        });
        let content = 0;
        rows.forEach(e => { content += e.getBoundingClientRect().height; });
        content += gap * Math.max(0, rows.length - 1);

        const name = c.querySelector('.wf-card-name');
        const label = (name && name.textContent.trim()) || '(unnamed)';
        if (content > box.height + 0.5) {
          bad.push(`${label}: ${rows.length} rows need ${Math.round(content)}px in a ${Math.round(box.height)}px card`);
        }
        // A stacked card that cannot even show its name has no business being
        // stacked — that is what the one-row layout is for.
        if (!name || getComputedStyle(name).display === 'none') {
          bad.push(`a ${Math.round(box.height)}px stacked card renders no name`);
        }
      });
    } finally { setDayBlocks(key, had, kid); renderWeek(); }
    return bad.length === 0 || bad;
  });

  /* THE WEEK KEEPS ITS COLUMN FLOOR ON A PHONE.

     css/app.css carried `@media (max-width:600px){ .weekly-full{min-width:560px} }`
     under a comment saying the 7 columns would otherwise be too thin to read —
     and the plain `.weekly-full` block eight lines BELOW it set `min-width: 0`
     at the same specificity, so the floor never applied once. At 430px every
     column was 44px wide and NO card name rendered at ANY duration: a two-hour
     training block was as nameless as a fifteen-minute break.

     Measured at a real phone viewport rather than by reading the rule — the
     suite runs over file://, where cssRules on a linked stylesheet throws, and
     a check that silently reads nothing would pass on an empty set. What
     matters is the rendered column anyway, not which rule produced it. */
  await page.setViewportSize({ width: 390, height: 844 });
  if (want('theWeekGridKeepsItsColumnFloor')) checks.theWeekGridKeepsItsColumnFloor = await page.evaluate(() => {
    goWeek(); setWeekView('full');
    const kid = activeProfile();
    const key = getDayKeys(0)[2];
    const had = (getDayBlocks(key) || []).slice();
    const bad = [];
    try {
      setDayBlocks(key, [
        { id: 'wk-floor-a', actId: 'piano', startMin: 8 * 60, durationMin: 60 },
      ], kid);
      weekOffset = 0; renderWeek();

      const wrap = document.querySelector('.weekly-full-wrap');
      const card = [...document.querySelectorAll('#screen-week .wf-card')]
        .find(c => (c.outerHTML || '').includes('wk-floor-a'));
      if (!card) return ['the week drew no card to measure'];

      // 7 columns plus the 58px sideband + gutter. Below roughly 700 a column
      // cannot hold an icon and a name together, which is the point of a floor.
      const col = card.getBoundingClientRect().width;
      if (col < 90) bad.push(`a phone column is ${Math.round(col)}px, too thin to name a block`);

      const name = card.querySelector('.wf-card-name');
      if (!name || name.getBoundingClientRect().width < 20) {
        bad.push(`a 60-minute block gets ${name ? Math.round(name.getBoundingClientRect().width) : 0}px of name on a phone`);
      }
      // The floor is only survivable because this one view scrolls sideways.
      if (wrap && !/(auto|scroll)/.test(getComputedStyle(wrap).overflowX)) {
        bad.push('the floor has nothing to scroll in: .weekly-full-wrap is not an x-scroller');
      }
    } finally { setDayBlocks(key, had, kid); renderWeek(); }
    return bad.length === 0 || bad;
  });
  await page.setViewportSize({ width: 900, height: 1100 });

  /* MIDDLE-BUTTON PANNING follows the cursor, and carries on past the grid.
     Two defects, one check. It panned like a hand tool — moving the mouse down
     scrolled UP — which is the opposite of the middle-click autoscroll a mouse
     user is asking for. And it only ever moved the element it was bound to, so
     once that element ran out there was nowhere left to go; pointerdown calls
     preventDefault, so the browser's own autoscroll was not there to take over
     either. Drives real pointer events rather than calling the handler. */
  if (want('middleDragFollowsTheCursorAndChains')) checks.middleDragFollowsTheCursorAndChains = await page.evaluate(() => {
    goWeek(); setWeekView('full'); renderWeek();
    const bad = [];
    const el = document.querySelector('.weekly-full-wrap');
    if (!el) return ['no week wrap to pan'];
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
  if (want('kidMoneyLabel')) checks.kidMoneyLabel = await page.evaluate(() => {
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
  if (want('kidCanOpenMyMoney')) checks.kidCanOpenMyMoney = await page.evaluate(() => {
    openWeekMoney();
    const txt = document.getElementById('mnyPage1Wrap').textContent;
    return document.getElementById('screen-mymoney').classList.contains('active')
        && txt.includes('Everything I have')
        && txt.includes('Cash') && txt.includes('Locked away');
  });
  // The rules editor is not on a kid's page at all — there is nothing to hide.
  if (want('kidHasNoRulesOnHerPage')) checks.kidHasNoRulesOnHerPage = await page.evaluate(() => {
    const txt = document.getElementById('mnyPage1Wrap').textContent;
    return !document.getElementById('mnyPage1Wrap').querySelector('[data-pm-action="edit"]')
        && !txt.includes('Rules &');
  });
  // A kid can walk to her own history and back without a grown-up.
  if (want('kidCanReadHerStory')) checks.kidCanReadHerStory = await page.evaluate(() => {
    mnyOpenStory();
    return document.getElementById('screen-moneystory').classList.contains('active')
        && document.getElementById('mnyStoryWrap').textContent.includes('My money story');
  });
  // Kids may look at what they own, but the balances must not move when a kid
  // tries to transact.
  if (want('kidCannotTransact')) checks.kidCannotTransact = await page.evaluate(() => {
    const kid = activeProfile();
    const wrap = document.getElementById('mnyPage1Wrap');
    // Her page has no control that moves money — not a disabled one, none.
    const noMovers = !wrap.querySelector('[data-mny-action="commit"], [data-mnyp-action]');
    // And the guard the commit path leans on refuses her — as do the two doors
    // back to cash on the parent's holdings page, if she ever reaches them.
    const guarded = moneyCanTransact() === false;
    const cashBefore = mnyCash(kid);
    mnyAskMoveSavedToCash(kid);
    const noDoor = !document.querySelector('#appDialogOverlay.open') && mnyCash(kid) === cashBefore;
    // Her earnings are not hers to change either.
    const cannotOverride = mnySetOverride(kid, mnyWeekKey(), 'chores', 99, 'fixing') === false;
    return noMovers && guarded && noDoor && cannotOverride;
  });
  // A kid editing a rule must be refused, leaving no new version or log entry.
  if (want('kidCannotEditRules')) checks.kidCannotEditRules = await page.evaluate(() => {
    const before = mrVersions().length;
    const res = mrApplyEdits([{ path: 'chores.dailyCap', value: 99 }], { reason: 'family_meeting' });
    return res === null && mrVersions().length === before && mrRules().chores.dailyCap !== 99;
  });
  // A kid must not be able to grade her own chores.
  if (want('kidCannotGradeChores')) checks.kidCannotGradeChores = await page.evaluate(() => {
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = activeProfile();
    const before = mrGetChoreGrade(kid, ctWeekKey, 0, 'dishes');
    const ok = mrSetChoreGrade(kid, ctWeekKey, 0, 'dishes', 3);
    return ok === false && mrGetChoreGrade(kid, ctWeekKey, 0, 'dishes') === before;
  });
  // ── Redesign phase 1: claims, the pool↔planner seam, goal shapes ──
  // A kid CAN say how a chore went, and saying so moves no money.
  if (want('claimIsNotPayment')) checks.claimIsNotPayment = await page.evaluate(() => {
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
  if (want('gradingClearsTheQueue')) checks.gradingClearsTheQueue = await page.evaluate(() => {
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
  if (want('kidCannotClaimForSister')) checks.kidCannotClaimForSister = await page.evaluate(() => {
    const other = activeProfile() === 'jenn' ? 'jess' : 'jenn';
    const before = mrGetClaim(other, ctWeekKey, 0, 'dishes');
    const ok = mrSetClaim(other, ctWeekKey, 0, 'dishes', 3);
    return ok === false && mrGetClaim(other, ctWeekKey, 0, 'dishes') === before;
  });
  // The planner owns the schedule: a chore is on a day only if a block tags it.
  if (want('plannerOwnsTheSchedule')) checks.plannerOwnsTheSchedule = await page.evaluate(() => {
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
  if (want('legacyTagsStillResolve')) checks.legacyTagsStillResolve = await page.evaluate(() => {
    const wk = ctWeekKey;
    const byName = mrPoolRowForTag('Mop', wk);
    const byId = mrPoolRowForTag('mop', wk);
    const messy = mrPoolRowForTag('dishes & DISHWASHER', wk);
    const unknown = mrPoolRowForTag('Polish the cat', wk);
    return byName && byName.id === 'mop' && byId && byId.id === 'mop'
        && messy && messy.id === 'dishes' && unknown === null;
  });
  if (want('unknownTagIsSurfaced')) checks.unknownTagIsSurfaced = await page.evaluate(() => {
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
  if (want('whoScopesAPoolRow')) checks.whoScopesAPoolRow = await withPool(({ wk, original, edit, mrDeepCopy }) => {
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
  if (want('standingLanesNeedNoBlock')) checks.standingLanesNeedNoBlock = await withPool(({ wk, original, edit, mrDeepCopy }) => {
    edit([...mrDeepCopy(original),
      { id:'water', label:'Water the plants', lane:'helping', who:'both', due:'18:00' }]);
    const row = mrChoresForDay('jenn', wk, 6).rows.find(r => r.row.id === 'water');
    return !!row && row.scheduled === false && row.row.lane === 'helping';
  });
  // A goal written as a bare number still fires the +$1 on the old rule.
  if (want('legacyGoalStillFires')) checks.legacyGoalStillFires = await page.evaluate(() => {
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
  if (want('dueTimesRespectBedtime')) checks.dueTimesRespectBedtime = await page.evaluate(() =>
    mrDueIsValid('19:30') && mrDueIsValid('7:30pm') && mrDueIsValid('20:30')
    && !mrDueIsValid('21:00') && !mrDueIsValid('9:00pm') && !mrDueIsValid('teatime')
    && mrFormatClock(mrParseClock('19:30')) === '7:30pm');

  // Kids must not be able to record their own results, fines or honesty strikes.
  if (want('kidCannotSelfReport')) checks.kidCannotSelfReport = await page.evaluate(() => {
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
  if (want('dayScreenIsPlanningOnly')) checks.dayScreenIsPlanningOnly = await page.evaluate(() => {
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
  if (want('dayScreenScrollsAsOneSurface')) checks.dayScreenScrollsAsOneSurface = await page.evaluate(() => {
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
  if (want('shortBlocksDoNotClipTheirName')) checks.shortBlocksDoNotClipTheirName = await page.evaluate(() => {
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
  if (want('multiDayColumnsPlaceOnTheirOwnDay')) checks.multiDayColumnsPlaceOnTheirOwnDay = await page.evaluate(() => {
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

  /* ── Dragging a placed block (js/39-block-drag.js) ──
     One in-page helper drives every drag check. PointerEvent triples with
     pointerId 1, and setPointerCapture stubbed before dispatch: without the
     pointer id Chrome throws NotFoundError from inside the handler, which lands
     in errors[] and fails noConsoleErrors rather than the check you wrote.
     Mirrors middleDragFollowsTheCursorAndChains. */
  await page.evaluate(() => {
    window.dragHandle = (blockId, sel, dx, dy, steps = 4, hold = false) => {
      const el = document.getElementById('block-' + blockId);
      if (!el) return 'no block ' + blockId;
      const h = el.querySelector(sel);
      if (!h) return 'no handle ' + sel + ' on ' + blockId;
      h.setPointerCapture = h.setPointerCapture || (() => {});
      h.releasePointerCapture = h.releasePointerCapture || (() => {});
      const r = h.getBoundingClientRect();
      const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
      const send = (type, x, y) => h.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerId: 1, button: 0, buttons: 1,
        clientX: x, clientY: y,
      }));
      send('pointerdown', x0, y0);
      for (let i = 1; i <= steps; i++) send('pointermove', x0 + dx * i / steps, y0 + dy * i / steps);
      if (hold) { window._dragRelease = () => { send('pointerup', x0 + dx, y0 + dy); window._dragRelease = null; }; return null; }
      send('pointerup', x0 + dx, y0 + dy);
      return null;
    };
    // One 60-minute block at 9am on a known day, and the day put back after.
    window.seedDragDay = (dur = 60, startMin = 9 * 60) => {
      const key = getDayKeys(0)[3];
      const before = (getDayBlocks(key, 'jenn') || []).slice();
      setDayBlocks(key, [{
        id: 'dg1', actId: 'piano', startMin, durationMin: dur,
        objectives: [], note: '', checklistState: {},
      }], 'jenn');
      openDay(key, 3);
      return { key, undo: () => { setDayBlocks(key, before, 'jenn'); openDay(key, 3); } };
    };
  });

  if (want('draggingABlockMovesItToTheTimeItWasDroppedAt')) checks.draggingABlockMovesItToTheTimeItWasDroppedAt = await page.evaluate(() => {
    const bad = [];
    profile = 'jenn'; parentViewing = 'jenn';
    const { key, undo } = seedDragDay();
    try {
      const err = dragHandle('dg1', '.block-grip', 0, 120 * PX_PER_MIN);
      if (err) { bad.push(err); return bad; }
      const b = (getDayBlocks(key, 'jenn') || [])[0];
      if (!b) bad.push('the block is gone after a drag');
      else {
        if (b.startMin !== 11 * 60) bad.push(`dropped two hours down and landed at ${b.startMin}, not ${11 * 60}`);
        if (b.durationMin !== 60) bad.push(`moving changed the duration to ${b.durationMin}`);
        if (b.id !== 'dg1') bad.push('a same-day move changed the block id');
        const el = document.getElementById('block-dg1');
        const topPx = el ? parseFloat(el.style.top) : -1;
        const want = (11 * 60 - START_MIN) * PX_PER_MIN;
        if (Math.abs(topPx - want) > 2) bad.push(`redrawn at ${topPx}px, expected about ${want}px`);
      }
    } finally { undo(); }
    return bad.length === 0 || bad;
  });

  /* THE regression this exists for. An unstamped edit loses whole-record
     arbitration to a stale remote copy and the move is silently undone on the
     next sync — invisible on every screen, which is why it is asserted rather
     than trusted. baseOpId is the half that proves markItemUpdated ran rather
     than something merely touching updatedAt. */
  if (want('aDraggedBlockIsStampedSoAMergeCannotLoseIt')) checks.aDraggedBlockIsStampedSoAMergeCannotLoseIt = await page.evaluate(() => {
    const bad = [];
    const { key, undo } = seedDragDay();
    try {
      const b0 = getDayBlocks(key, 'jenn')[0];
      b0.opId = 'op-before'; b0.updatedAt = 1;
      const err = dragHandle('dg1', '.block-grip', 0, 60 * PX_PER_MIN);
      if (err) { bad.push(err); return bad; }
      const b = getDayBlocks(key, 'jenn')[0];
      if (!b.updatedAt || b.updatedAt <= 1) bad.push('the drag did not move updatedAt');
      if (!b.opId || b.opId === 'op-before') bad.push('the drag did not mint a new opId');
      if (b.baseOpId !== 'op-before') bad.push(`baseOpId is ${b.baseOpId}, so markItemUpdated did not run`);
    } finally { undo(); }
    return bad.length === 0 || bad;
  });

  if (want('resizingABlockChangesOnlyItsDuration')) checks.resizingABlockChangesOnlyItsDuration = await page.evaluate(() => {
    const bad = [];
    const at = (id, k) => { const b = (getDayBlocks(k, 'jenn') || [])[0]; return b ? b[id] : null; };

    let s = seedDragDay(60, 9 * 60);
    try {
      dragHandle('dg1', '.block-resize--bottom', 0, 30 * PX_PER_MIN);
      if (at('startMin', s.key) !== 9 * 60) bad.push('the bottom edge moved the start');
      if (at('durationMin', s.key) !== 90) bad.push(`the bottom edge gave ${at('durationMin', s.key)} minutes, not 90`);
    } finally { s.undo(); }

    // A top edge moves the start and HOLDS the end.
    s = seedDragDay(60, 9 * 60);
    try {
      dragHandle('dg1', '.block-resize--top', 0, 15 * PX_PER_MIN);
      const st = at('startMin', s.key), du = at('durationMin', s.key);
      if (st !== 9 * 60 + 15) bad.push(`the top edge put the start at ${st}`);
      if (st + du !== 10 * 60) bad.push(`the top edge moved the END to ${st + du}, it must stay at ${10 * 60}`);
    } finally { s.undo(); }

    // Dragged past itself it stops at the floor, never at zero or below.
    s = seedDragDay(60, 9 * 60);
    try {
      dragHandle('dg1', '.block-resize--bottom', 0, -300 * PX_PER_MIN);
      const du = at('durationMin', s.key);
      if (du !== BLOCK_DRAG_MIN_DUR) bad.push(`shrunk past the floor to ${du}`);
    } finally { s.undo(); }

    // And it cannot be grown out through the end of the day.
    s = seedDragDay(60, END_MIN - 90);
    try {
      dragHandle('dg1', '.block-resize--bottom', 0, 300 * PX_PER_MIN);
      const st = at('startMin', s.key), du = at('durationMin', s.key);
      if (st + du > END_MIN) bad.push(`a late block was grown to ${st + du}, past END_MIN ${END_MIN}`);
    } finally { s.undo(); }

    return bad.length === 0 || bad;
  });

  /* Every mutation is a full-document Firestore upload with no debounce, so a
     drag that wrote per pointermove would upload the family document eight
     times for one gesture. Counted, not trusted — the same discipline
     reflCommitDraft's check uses. */
  if (want('aDragWritesOnceAndOnlyOnDrop')) checks.aDragWritesOnceAndOnlyOnDrop = await page.evaluate(() => {
    const bad = [];
    const { key, undo } = seedDragDay();
    const realSave = window.saveAll;
    let n = 0;
    try {
      window.saveAll = function (...a) { n++; return realSave.apply(this, a); };
      dragHandle('dg1', '.block-grip', 0, 90 * PX_PER_MIN, 8);
      if (n !== 1) bad.push(`eight pointermoves and a drop wrote ${n} times, expected exactly 1`);
    } finally { window.saveAll = realSave; undo(); }
    return bad.length === 0 || bad;
  });

  /* attachTapGuard (js/07-week-view.js) is the whole click suppression: it owns
     blockEl.onclick and its `moved` flag is set by a pointermove on any
     DESCENDANT, and the handles are descendants. Nothing on the drag side would
     notice if that stopped being true, so it is asserted from both ends — a
     drag must not open the editor, and a still tap must still open it. */
  if (want('aDraggedBlockDoesNotAlsoOpenItsEditor')) checks.aDraggedBlockDoesNotAlsoOpenItsEditor = await page.evaluate(() => {
    const bad = [];
    const { key, undo } = seedDragDay();
    try {
      editingBlockId = null;
      closeSheet('editOverlay');
      dragHandle('dg1', '.block-grip', 0, 60 * PX_PER_MIN);
      if (editingBlockId) bad.push(`the drag also opened the editor on ${editingBlockId}`);
      const ov = document.getElementById('editOverlay');
      if (ov && ov.classList.contains('open')) bad.push('the drag left the edit sheet open');

      // The other direction: a tap on the block body still opens it.
      const el = document.getElementById('block-dg1');
      if (el) { el.click(); }
      if (!editingBlockId) bad.push('a still tap on the block no longer opens the editor');
      closeSheet('editOverlay'); editingBlockId = null;
    } finally { undo(); }
    return bad.length === 0 || bad;
  });

  /* Two thresholds, two questions — and the handles answer the second. Below
     BLOCK_STACK_MIN a block is 22-40px tall and two edge strips plus a grip
     would leave nothing to tap, swallowing the gesture that opens it: the very
     failure .wf-card-check is exempted for. Asserted at every duration a short
     block is actually used at. */
  if (want('onlyBlocksWithRoomToSpareOfferDragHandles')) checks.onlyBlocksWithRoomToSpareOfferDragHandles = await page.evaluate(() => {
    const bad = [];
    const key = getDayKeys(0)[3];
    const before = (getDayBlocks(key, 'jenn') || []).slice();
    const durs = [15, 30, 45, 60, 120];
    try {
      setDayBlocks(key, durs.map((d, i) => ({
        id: 'hz-' + d, actId: 'piano', startMin: 7 * 60 + i * 150, durationMin: d,
        objectives: [], note: '', checklistState: {},
      })), 'jenn');
      openDay(key, 3);
      durs.forEach(d => {
        const el = document.getElementById('block-hz-' + d);
        if (!el) { bad.push(`no block rendered for ${d} min`); return; }
        const h = parseFloat(el.style.height) || 0;
        const grip = el.querySelector('.block-grip');
        const edges = el.querySelectorAll('.block-resize');
        if (h < BLOCK_STACK_MIN) {
          if (grip || edges.length) bad.push(`${d}-min block (${h}px) offers handles it has no room for`);
          return;
        }
        if (!grip) { bad.push(`${d}-min block (${h}px) has no grip`); return; }
        if (edges.length !== 2) bad.push(`${d}-min block has ${edges.length} resize handles, not 2`);
        // The handles must TILE the edges, never overlap: an overlap means one
        // gesture silently shadows another.
        const g = grip.getBoundingClientRect();
        if (g.width < 28) bad.push(`the grip is only ${Math.round(g.width)}px wide`);
        if (g.height < 44) bad.push(`the grip is only ${Math.round(g.height)}px tall`);
        edges.forEach(e => {
          const r = e.getBoundingClientRect();
          if (r.left < g.right - 1) bad.push(`a resize handle overlaps the grip on the ${d}-min block`);
        });
        // And the body is still reachable: the point under the block's own
        // centre-right must not be a handle.
        const br = el.getBoundingClientRect();
        const hit = document.elementFromPoint(br.right - 8, br.top + br.height / 2);
        if (hit && hit.classList && hit.classList.contains('block-drag-handle')) {
          bad.push(`${d}-min block: a handle covers the body, so the tap that opens it is gone`);
        }
      });
    } finally { setDayBlocks(key, before, 'jenn'); openDay(key, 3); }
    return bad.length === 0 || bad;
  });

  /* A block a child may not move offers no grip at all. Refusing at the drop
     instead would be a control that lets her drag for two seconds and then
     announces it did nothing. */
  if (want('aPinnedBlockOffersNoGripToDragItBy')) checks.aPinnedBlockOffersNoGripToDragItBy = await page.evaluate(() => {
    const bad = [];
    const key = getDayKeys(0)[3];
    const before = (getDayBlocks(key, 'jenn') || []).slice();
    const wasProfile = profile;
    try {
      profile = 'jenn';
      setDayBlocks(key, [{
        id: 'pin1', actId: 'training', startMin: 16 * 60, durationMin: 120,
        parentPinned: true, objectives: [], note: '', checklistState: {},
      }], 'jenn');
      openDay(key, 3);
      const el = document.getElementById('block-pin1');
      if (!el) bad.push('the pinned block did not render');
      else if (el.querySelector('.block-grip')) bad.push('a kid is offered a grip on a parent-pinned block');
      // The writer refuses it too, whatever the UI did.
      const moved = moveBlockToDay(key, key, 'pin1', { startMin: 10 * 60, durationMin: 120 });
      if (moved) bad.push('moveBlockToDay moved a pinned block for a kid');
      if ((getDayBlocks(key, 'jenn')[0] || {}).startMin !== 16 * 60) bad.push('the pinned block moved anyway');
    } finally { profile = wasProfile; setDayBlocks(key, before, 'jenn'); openDay(key, 3); }
    return bad.length === 0 || bad;
  });

  /* The day screen has exactly one scroller and there is no touch-action
     anywhere else in the project. Neither dayScreenScrollsAsOneSurface (which
     walks the DOM for scrollers) nor onlyTheScheduleScrollsOnTheDayScreen
     (which watches the document) can see a flick a handle swallowed, so the
     positions are measured across a real gesture. */
  if (want('theScheduleStaysTheOnlyThingThatScrollsWhileDragging')) checks.theScheduleStaysTheOnlyThingThatScrollsWhileDragging = await page.evaluate(() => {
    const bad = [];
    const { key, undo } = seedDragDay();
    try {
      const doc = document.scrollingElement || document.documentElement;
      const ws = document.querySelector('#screen-day .day-workspace');
      const d0 = doc.scrollTop, w0 = ws ? ws.scrollTop : 0;
      dragHandle('dg1', '.block-grip', 0, 100 * PX_PER_MIN, 6);
      if (doc.scrollTop !== d0) bad.push(`the document scrolled ${doc.scrollTop - d0}px during a drag`);
      if (ws && ws.scrollTop !== w0) bad.push(`the workspace scrolled ${ws.scrollTop - w0}px during a drag`);
      // And the handles are the ONLY things carrying touch-action.
      const offenders = [];
      ['.placed-block', '.tl-canvas', '.day-workspace', '.tl-col'].forEach(sel => {
        const el = document.querySelector('#screen-day ' + sel);
        if (el && getComputedStyle(el).touchAction === 'none') offenders.push(sel);
      });
      if (offenders.length) bad.push('touch-action:none has spread to ' + offenders.join(', '));
    } finally { undo(); }
    return bad.length === 0 || bad;
  });

  /* ── Cross-day dragging ──
     Needs more than one column, so the viewport is widened the way
     multiDayColumnsPlaceOnTheirOwnDay does it. The failure this catches is a
     drop that wrote through the currentDayKey global — which placeBlock still
     does by design — and would land the block on column 1 whatever column it
     was dropped on. */
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.waitForTimeout(150);
  if (want('draggingAcrossColumnsWritesToTheColumnItWasDroppedOn')) checks.draggingAcrossColumnsWritesToTheColumnItWasDroppedOn = await page.evaluate(() => {
    const bad = [];
    profile = 'jenn'; parentViewing = 'jenn';
    const keys = getDayKeys(0);
    const spanBefore = dayViewSpan();
    const had = keys.slice(0, 3).map(k => (getDayBlocks(k, 'jenn') || []).slice());
    try {
      keys.slice(0, 3).forEach(k => setDayBlocks(k, [], 'jenn'));
      setDayBlocks(keys[0], [{
        id: 'xd1', actId: 'piano', startMin: 9 * 60, durationMin: 60,
        objectives: [], note: '', checklistState: {},
      }], 'jenn');
      openDay(keys[0], 0);
      setDayViewSpan(3);
      const cols = [...document.querySelectorAll('#timeline .tl-col')];
      if (cols.length !== 3) { bad.push(`asked for 3 columns, rendered ${cols.length}`); return bad; }
      const from = document.getElementById('block-xd1');
      const to = cols[2].getBoundingClientRect();
      if (!from) { bad.push('the block did not render in column 1'); return bad; }
      const dx = (to.left + to.width / 2) - from.getBoundingClientRect().left;

      /* Held mid-gesture, because this is where the one thing no data
         assertion can see would go wrong: .tl-canvas clips its overflow and is
         a stacking context, so without the lift into #timeline the block is
         simply cut off at its own column's edge on the way across. */
      let err = dragHandle('xd1', '.block-grip', dx, 0, 5, true);
      if (err) { bad.push(err); return bad; }
      const mid = document.getElementById('block-xd1');
      if (!mid) bad.push('the block disappeared mid-drag');
      else {
        const mr = mid.getBoundingClientRect();
        if (mr.width < 8 || mr.height < 8) bad.push(`mid-drag the block is ${Math.round(mr.width)}x${Math.round(mr.height)} — it is being clipped`);
        const centre = mr.left + mr.width / 2;
        if (centre < to.left - 4 || centre > to.right + 4) {
          bad.push(`mid-drag the block sits at ${Math.round(centre)}, not over the target column ${Math.round(to.left)}-${Math.round(to.right)}`);
        }
        // And it must actually be the topmost thing at its own centre, or it is
        // painted under the column it is being dragged over.
        const hit = document.elementFromPoint(centre, mr.top + mr.height / 2);
        if (hit && !mid.contains(hit) && hit !== mid) {
          bad.push(`mid-drag something else is on top of the block: .${(hit.className || '').toString().split(' ')[0]}`);
        }
      }
      window._dragRelease();

      const src = getDayBlocks(keys[0], 'jenn') || [];
      const dst = getDayBlocks(keys[2], 'jenn') || [];
      if (src.length !== 0) bad.push(`the block is still on its old day (${src.length} there)`);
      if (dst.length !== 1) bad.push(`column 3 holds ${dst.length} blocks, expected exactly 1`);
      if (dst[0]) {
        if (dst[0].actId !== 'piano') bad.push('something other than the dragged block arrived');
        if (dst[0].startMin !== 9 * 60) bad.push(`it landed at ${dst[0].startMin}, not ${9 * 60}`);
        /* The id MUST change. mergeWeeks unions by id per day key, so an
           absence cannot be expressed — see moveBlockToDay, and the two-device
           proof in tests/merge.test.js. */
        if (dst[0].id === 'xd1') bad.push('the moved block kept its id, so a stale device will restore it on its old day');
      }
      const t = (state.shared.tombstones || {})['xd1'];
      if (!t) bad.push('no tombstone for the old id — the removal cannot travel');
      /* Asked of the real merge predicate rather than restated as a timestamp
         comparison: what must be true is that the next merge does not delete
         the block that just arrived. Reusing the id would make this fail, which
         is the trap the two ids exist to avoid. */
      if (dst[0] && blockTombstoned(dst[0])) {
        bad.push('the arrival is itself tombstoned, so the next merge deletes it');
      }
      if (currentDayKey !== keys[2]) bad.push(`the screen still names ${currentDayKey} after dropping on ${keys[2]}`);
      if (getDayBlocks(keys[1], 'jenn').length) bad.push('a column nobody dropped on gained a block');
    } finally {
      setDayViewSpan(spanBefore);
      keys.slice(0, 3).forEach((k, i) => setDayBlocks(k, had[i], 'jenn'));
      openDay(keys[0], 0);
    }
    return bad.length === 0 || bad;
  });

  /* Off its own weekday a block is no longer one of the series' days, so the
     move says so and drops the repeat rather than leaving a record claiming a
     repeat it is not part of — which seriesExtendTo would later act on. */
  if (want('aRepeatDraggedToAnotherDayLeavesItsRepeat')) checks.aRepeatDraggedToAnotherDayLeavesItsRepeat = await page.evaluate(async () => {
    const bad = [];
    const keys = getDayKeys(0);
    const had = keys.slice(0, 3).map(k => (getDayBlocks(k, 'jenn') || []).slice());
    const wasConfirm = window.showConfirm;
    try {
      keys.slice(0, 3).forEach(k => setDayBlocks(k, [], 'jenn'));
      const mk = () => ({
        id: 'sr1', actId: 'piano', startMin: 9 * 60, durationMin: 60,
        seriesId: 'sr-x', seriesDays: [1, 3], seriesEvery: 1,
        objectives: [], note: '', checklistState: {},
      });
      setDayBlocks(keys[0], [mk()], 'jenn');
      setDayBlocks(keys[1], [Object.assign(mk(), { id: 'sr2' })], 'jenn');
      openDay(keys[0], 0);

      let asked = 0;
      window.showConfirm = async () => { asked++; return true; };
      const moved = moveBlockToDay(keys[0], keys[2], 'sr1', { startMin: 9 * 60, durationMin: 60 });
      if (!moved) bad.push('the cross-day move refused a series block outright');
      const dst = (getDayBlocks(keys[2], 'jenn') || [])[0];
      if (!dst) bad.push('the series block did not arrive on the new day');
      else {
        ['seriesId', 'seriesDays', 'seriesEvery', 'seriesStart', 'seriesEnd'].forEach(k => {
          if (dst[k] !== undefined) bad.push(`the moved copy still carries ${k}`);
        });
      }
      // The other member is untouched where it was.
      const sib = (getDayBlocks(keys[1], 'jenn') || [])[0];
      if (!sib || sib.seriesId !== 'sr-x') bad.push('moving one member disturbed the rest of the series');
    } finally {
      window.showConfirm = wasConfirm;
      keys.slice(0, 3).forEach((k, i) => setDayBlocks(k, had[i], 'jenn'));
      openDay(keys[0], 0);
    }
    return bad.length === 0 || bad;
  });
  /* Deliberately NOT narrowed again: this section inherited the wide viewport
     from multiDayColumnsPlaceOnTheirOwnDay, and theHourLadderLinesUpWithTheSchedule
     below needs 3 columns to be available at all — at 900px
     dayViewSpanAvailable() is 2 and it fails on a viewport, not on a bug. */

  /* ── The category remembers what she last added from it ──
     Recorded by placeBlock, not by pickFromSlot: picking only opens a sheet and
     a cancel is one tap away, so recording at pick time would have a category
     remembering something that never landed on a day. */
  if (want('aCategoryOffersWhatSheAddedFromItLastTime')) checks.aCategoryOffersWhatSheAddedFromItLastTime = await page.evaluate(() => {
    const bad = [];
    profile = 'jenn'; parentViewing = 'jenn';
    const key = getDayKeys(0)[3];
    const before = (getDayBlocks(key, 'jenn') || []).slice();
    try {
      localStorage.removeItem('wp_slot_last_by_cat');
      setDayBlocks(key, [], 'jenn');
      openDay(key, 3);

      openSlotPicker(9 * 60);
      const chips = [...document.querySelectorAll('#slotPickerFilter .filter-chip')];
      /* The chip is a CATEGORY now — Daily Rhythm, which holds the routines and
         the helping hands. The per-chip memory is unchanged; what it is keyed
         to is the category rather than one of nine flat `cat` values. */
      const routines = chips.find(c => /Daily Rhythm/i.test(c.textContent));
      if (!routines) { bad.push('no Daily Rhythm chip in the picker'); return bad; }
      routines.click();
      const listed = [...document.querySelectorAll('#slotPickerList .slot-pick-chip:not(.slot-pick-add)')];
      if (listed.length < 2) { bad.push('the Daily Rhythm category has too few entries to reorder'); return bad; }
      const wantedName = listed[listed.length - 1].querySelector('.spc-name').textContent;
      listed[listed.length - 1].click();          // NOT the one already at the top
      confirmActivity();

      openSlotPicker(13 * 60);
      const chips2 = [...document.querySelectorAll('#slotPickerFilter .filter-chip')];
      chips2.find(c => /Daily Rhythm/i.test(c.textContent)).click();
      const first = document.querySelector('#slotPickerList .slot-pick-chip');
      const firstName = first ? first.querySelector('.spc-name').textContent : '';
      if (firstName !== wantedName) {
        bad.push(`the category leads with "${firstName}", not the "${wantedName}" she added from it`);
      }
      if (first && !first.classList.contains('slot-pick-chip--last')) {
        bad.push('the lifted chip does not say why it moved');
      }

      /* The All tab has exactly TWO rules and they are in this order: what fits
         the time she tapped, then what the household has actually been doing.
         Everything under "Everything else" is still recency-ranked — the
         suggestion row leads, it does not replace. */
      const allChip = chips2.find(c => c.textContent.trim() === 'All');
      allChip.click();
      const heads = [...document.querySelectorAll('#slotPickerList .spc-subhead')]
        .map(h => h.textContent.trim());
      const zone = slotPickerWindow();
      const anyFits = getAllActivities().some(a => !a._locked
        && Array.isArray(a.suitableTime) && a.suitableTime.includes(zone));
      if (anyFits && !heads.some(h => /Good for/.test(h))) {
        bad.push('nothing leads on what fits the time she tapped');
      }
      if (anyFits && !heads.some(h => /Everything else/.test(h))) {
        bad.push('the rest of the library is not offered under the suggestions');
      }
      /* And a suggestion is genuinely for this time of day, not just the top of
         the old list wearing a new heading. */
      const firstTile = document.querySelector('#slotPickerList .slot-pick-chip');
      if (anyFits && firstTile) {
        const nm = firstTile.querySelector('.spc-name').textContent;
        const act = getAllActivities().find(a => a.name === nm);
        if (act && !(act.suitableTime || []).includes(zone)) {
          bad.push(`"${nm}" is suggested for ${zone}, which it does not fit`);
        }
      }
      closeSheet('slotPickerOverlay');

      // A placement she backed out of teaches the category nothing.
      openSlotPicker(15 * 60);
      const chips3 = [...document.querySelectorAll('#slotPickerFilter .filter-chip')];
      chips3.find(c => /Daily Rhythm/i.test(c.textContent)).click();
      const others = [...document.querySelectorAll('#slotPickerList .slot-pick-chip:not(.slot-pick-add)')]
        .filter(c => c.querySelector('.spc-name').textContent !== wantedName);
      if (others.length) {
        others[0].click();
        cancelCreatePlacement('activityOverlay');
        openSlotPicker(16 * 60);
        const chips4 = [...document.querySelectorAll('#slotPickerFilter .filter-chip')];
        chips4.find(c => /Daily Rhythm/i.test(c.textContent)).click();
        const stillFirst = document.querySelector('#slotPickerList .slot-pick-chip');
        const n = stillFirst ? stillFirst.querySelector('.spc-name').textContent : '';
        if (n !== wantedName) bad.push(`a cancelled placement was remembered: the category now leads with "${n}"`);
      }
      closeSheet('slotPickerOverlay');

      // And the picker itself still opens on All — a category it reopened into
      // would be a mode nobody chose.
      openSlotPicker(17 * 60);
      if (slotPickerFilter !== 'all') bad.push(`the picker reopened on "${slotPickerFilter}" instead of All`);
      closeSheet('slotPickerOverlay');
    } finally {
      localStorage.removeItem('wp_slot_last_by_cat');
      setDayBlocks(key, before, 'jenn');
      openDay(key, 3);
    }
    return bad.length === 0 || bad;
  });

  /* Answered at read time and never pruned — the same reasoning as xp2 and
     achievementActivityId. A season comes back and an archive can be undone, so
     a memory is not deleted for pointing at something temporarily unavailable;
     it just does not get to reorder anything. */
  if (want('aRememberedActivityThatIsGoneDoesNotBreakItsCategory')) checks.aRememberedActivityThatIsGoneDoesNotBreakItsCategory = await page.evaluate(() => {
    const bad = [];
    const seen = [];
    try {
      // _locked (out of season) is the only lock left; the reward gate retired.
      const locked = getAllActivities().find(a => a._locked);
      const store = { jenn: { routine: 'no-such-activity-at-all' } };
      if (locked) store.jenn[locked.cat] = locked.id;
      localStorage.setItem('wp_slot_last_by_cat', JSON.stringify(store));

      Object.keys(store.jenn).forEach(cat => {
        openSlotPicker(9 * 60);
        const chip = [...document.querySelectorAll('#slotPickerFilter .filter-chip')]
          .find(c => c.dataset.f === cat) ||
          [...document.querySelectorAll('#slotPickerFilter .filter-chip')][1];
        if (!chip) return;
        slotPickerFilter = cat;
        renderSlotPicker();
        const list = [...document.querySelectorAll('#slotPickerList .slot-pick-chip:not(.slot-pick-add)')];
        seen.push(cat + ':' + list.length);
        if (!list.length) { bad.push(`the "${cat}" category rendered nothing at all`); return; }
        if (list[0].classList.contains('locked')) {
          bad.push(`the "${cat}" category leads with a locked activity, which pickFromSlot refuses`);
        }
        closeSheet('slotPickerOverlay');
      });
      // Corrupt storage must not take the picker with it.
      localStorage.setItem('wp_slot_last_by_cat', '{not json at all');
      slotPickerFilter = 'routine';
      renderSlotPicker();
      if (!document.querySelectorAll('#slotPickerList .slot-pick-chip').length) {
        bad.push('a corrupt memory emptied the picker');
      }
    } finally {
      localStorage.removeItem('wp_slot_last_by_cat');
      slotPickerFilter = 'all';
      closeSheet('slotPickerOverlay');
    }
    return bad.length === 0 || bad;
  });

  /* A drag is the easiest way there has ever been to make two blocks overlap —
     a child drops swimming on top of dinner in two seconds. tdProgressRibbon is
     one nowrap flex row of percentages with nothing able to shrink, and
     CLAUDE.md records that it shipped without its clamp and every check passed
     because no fixture had an overlap. So the overlap here is made BY A DRAG,
     the way a real one will be, rather than seeded straight into the record. */
  if (want('aDragThatCreatesAnOverlapDoesNotBreakTodaysRibbon')) checks.aDragThatCreatesAnOverlapDoesNotBreakTodaysRibbon = await page.evaluate(() => {
    const bad = [];
    profile = 'jenn'; parentViewing = 'jenn';
    const key = todayKey();
    const before = (getDayBlocks(key, 'jenn') || []).slice();
    try {
      setDayBlocks(key, [
        { id: 'ov1', actId: 'dinner', startMin: 17 * 60, durationMin: 60, objectives: [], note: '', checklistState: {} },
        { id: 'ov2', actId: 'training', startMin: 19 * 60, durationMin: 120, tag: 'skating',
          travelBuffer: true, travelBufMin: 30, getReadyBuffer: true, getReadyBufMin: 15,
          objectives: [], note: '', checklistState: {} },
      ], 'jenn');
      openDay(key, dayIdxOfKey(key));

      // Drag the training block back on top of dinner.
      const err = dragHandle('ov2', '.block-grip', 0, -120 * PX_PER_MIN, 5);
      if (err) { bad.push(err); return bad; }
      const blocks = getDayBlocks(key, 'jenn');
      const a = blocks.find(b => b.id === 'ov1'), b = blocks.find(b => b.id === 'ov2');
      if (!a || !b) { bad.push('a block vanished during the overlapping drag'); return bad; }
      const overlaps = b.startMin < a.startMin + a.durationMin && a.startMin < b.startMin + b.durationMin;
      if (!overlaps) bad.push(`the drag did not actually overlap them (${a.startMin}+${a.durationMin} vs ${b.startMin})`);

      goToday();
      tdRenderToday();
      const strip = document.querySelector('#screen-today .td-rib-strip');
      if (!strip) { bad.push('Today rendered no ribbon over an overlapping day'); return bad; }
      /* The row has to add up to a day. Percentages, nothing able to shrink, so
         anything over 100 pushes the last cell through the edge of its column. */
      const cells = [...strip.children].filter(c => !c.classList.contains('td-rib-now'));
      const total = cells.reduce((n, c) => n + (parseFloat((c.style.flexBasis || '0')) || 0), 0);
      if (total > 100.5) bad.push(`the ribbon oversubscribes its row at ${total.toFixed(1)}%`);
      if (strip.scrollWidth > strip.clientWidth + 1) {
        bad.push(`the ribbon overflows its own box (${strip.scrollWidth}px into ${strip.clientWidth}px)`);
      }
    } finally {
      setDayBlocks(key, before, 'jenn');
      goToday();
    }
    return bad.length === 0 || bad;
  });

  /* The hour ladder must name the line it sits beside. It did not: .tl-col-head
     lived inside .tl-col and pushed .tl-canvas down, while .tl-gutter — a
     sibling of the whole column stack — started at the top of the header. At 2
     and 3 days every label read 46px, about 33 minutes, above its own line, and
     1 day was 2px out from the canvas border. One day has no header, which is
     why nobody saw it. Measured at every column count, because that is the
     variable that broke it. */
  if (want('theHourLadderLinesUpWithTheSchedule')) checks.theHourLadderLinesUpWithTheSchedule = await page.evaluate(() => {
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
      /* The rules are grid-row boundaries now, not positioned elements, so
         9am is the TOP EDGE of the row that starts at 9am — index
         (9*60 - START_MIN) / 15 into the day. Measuring the boundary rather
         than an inline `top` is the whole point of the row grid: if the browser
         distributes a fractional row height differently from the way the blocks
         are positioned, this is what catches it. */
      const rows = [...canvas.querySelectorAll('.slot-grid--day .slot-row')];
      const row = rows[(9 * 60 - START_MIN) / 15];
      if (!label) { bad.push(`no 9am label at ${span} day(s)`); return; }
      if (!row) { bad.push(`no 9am row at ${span} day(s)`); return; }
      if (!row.classList.contains('slot-row--hour')) {
        bad.push(`the row at 9am is not drawn as an hour boundary at ${span} day(s)`);
      }
      const lr = label.getBoundingClientRect(), pr = row.getBoundingClientRect();
      const off = (lr.top + lr.height / 2) - pr.top;
      if (Math.abs(off) > 1) {
        bad.push(`at ${span} day(s) the 9am label is ${off.toFixed(1)}px from its own rule`);
      }
      // And the mark above the cards lands on the same line.
      const mark = [...canvas.querySelectorAll('.hour-grid-tick')]
        .find(m => Math.abs(parseFloat(m.style.top) - (9 * 60 - START_MIN) * PX_PER_MIN) < 0.5);
      if (!mark) { bad.push(`no 9am mark at ${span} day(s)`); return; }
      const mr = mark.getBoundingClientRect();
      if (Math.abs((mr.top + mr.height / 2) - pr.top) > 1.5) {
        bad.push(`at ${span} day(s) the 9am mark is ${((mr.top + mr.height / 2) - pr.top).toFixed(1)}px from its rule`);
      }
    });
    setDayViewSpan(spanBefore);
    return bad.length === 0 || bad;
  });

  /* THE DAY ENDS WHERE THE DAY ENDS.

     The schedule was drawn 6am–10pm whatever was on it, and `.timeline` carried
     min-height: 1344px with 200px of padding under that — so an evening whose
     last block finishes at a quarter to nine showed an hour of empty grid and
     then most of a screen of nothing, and no trimming in JS could have taken
     either back.

     Three things have to hold together, and the third is the one that would
     rot quietly: the canvas ends shortly after the last thing planned; the
     expander reaches the rest of the evening and says which state it is in; and
     every OTHER number derived from the day — the gutter's last hour, where a
     tap lands, where a drag may be dropped — follows the canvas rather than the
     global. A gutter label hanging below its own canvas is the exact shape of
     the phase bug this file already records. */
  if (want('theDayEndsWhereTheDayEnds')) checks.theDayEndsWhereTheDayEnds = await page.evaluate(() => {
    const kid = activeProfile();
    const key = getDayKeys(0)[2];
    const had = (getDayBlocks(key) || []).slice();
    const spanBefore = dayViewSpan();
    const showBefore = dayViewShowAll();
    const bad = [];
    const canvasMin = () => {
      const c = document.querySelector('#timeline .tl-canvas');
      return c ? c.getBoundingClientRect().height / PX_PER_MIN : 0;
    };
    try {
      setDayViewSpan(1);
      setDayViewShowAll(false);
      // A day that finishes at 8:45pm, the evening from the screenshot.
      setDayBlocks(key, [
        { id: 'de-eve', actId: 'routine_evening', startMin: 20 * 60 + 15, durationMin: 30 },
      ], kid);
      currentDayKey = key;
      openDay(key);

      const drawn = canvasMin();
      const lastEnd = 20 * 60 + 45 - START_MIN;
      if (drawn >= DAY_MIN_SPAN) bad.push('the canvas still runs to the end of the day');
      if (drawn < lastEnd) bad.push(`the canvas stops at ${Math.round(drawn)}m, before the 8:45pm block ends`);
      if (drawn > lastEnd + 75) {
        bad.push(`the canvas runs ${Math.round(drawn - lastEnd)}m past the last block`);
      }
      if (Math.abs(drawn - Math.round(drawn / 15) * 15) > 0.5) {
        bad.push(`the canvas is ${drawn.toFixed(1)} minutes — not a whole number of 15-minute rows`);
      }

      // The gutter stops with it: no hour label hanging below its own canvas.
      const gutter = document.querySelector('#timeline .tl-gutter');
      const gr = gutter && gutter.getBoundingClientRect();
      [...document.querySelectorAll('#timeline .tl-hour-label')].forEach(l => {
        const r = l.getBoundingClientRect();
        if (gr && r.top > gr.bottom + 1) {
          bad.push(`the hour label "${l.textContent.trim()}" hangs below the canvas`);
        }
      });

      // A tap at the very bottom resolves to a time inside the drawn day.
      const canvas = document.querySelector('#timeline .tl-canvas');
      const cr = canvas.getBoundingClientRect();
      const snapped = canvasSnapMin(canvas, cr.bottom - 1);
      if (snapped > drawn - 15 + 0.5) {
        bad.push(`a tap at the bottom gives ${snapped}m on a ${Math.round(drawn)}m canvas`);
      }

      // The expander says which state it is in, and reaches the whole evening.
      const later = document.querySelector('#timeline .tl-later');
      if (!later) return bad.concat(['a trimmed day offers no way to the evening']);
      if (!/Planning something after/.test(later.textContent)) {
        bad.push(`the expander reads "${later.textContent.trim()}"`);
      }
      later.click();
      if (canvasMin() < DAY_MIN_SPAN - 0.5) {
        bad.push('the expander did not open the rest of the evening');
      }
      const back = document.querySelector('#timeline .tl-later');
      if (!back || !/Stop at the last thing/.test(back.textContent)) {
        bad.push('the expander does not offer the way back');
      }

      /* AND A DAY THAT REALLY RUNS LATE IS NOT TRIMMED. The trim must follow the
         plan, not a preference about evenings. */
      setDayViewShowAll(false);
      setDayBlocks(key, [
        { id: 'de-late', actId: 'routine_evening', startMin: 21 * 60 + 30, durationMin: 30 },
      ], kid);
      openDay(key);
      if (canvasMin() < DAY_MIN_SPAN - 0.5) {
        bad.push('a block ending at 10pm still got its evening trimmed');
      }
    } finally {
      setDayBlocks(key, had, kid);
      setDayViewShowAll(showBefore);
      setDayViewSpan(spanBefore);
    }
    return bad.length === 0 || bad;
  });

  /* The schedule is the only thing that moves. #screen-day carried min-height
     rather than a height, so the flex column grew to the 1344px schedule and
     the DOCUMENT scrolled instead — 832px of it. The wheel hid that
     (overscroll-behavior: contain), but middle-drag hands its leftover to the
     page on purpose, so the one input that reached the document was the middle
     button, and it carried the topbar off screen. dayScreenScrollsAsOneSurface
     cannot see this: it only walks INSIDE #screen-day. */
  if (want('onlyTheScheduleScrollsOnTheDayScreen')) checks.onlyTheScheduleScrollsOnTheDayScreen = await page.evaluate(() => {
    const bad = [];
    /* A DAY TALL ENOUGH TO SCROLL, seeded rather than assumed. This opened
       whatever the fixture happened to hold and relied on the canvas always
       being the full 1344px — which stopped being true when the day started
       ending where the plan ends. A workspace that does not overflow is not a
       defect, it is a short day; what must never happen is the DOCUMENT
       scrolling instead, and that needs a schedule taller than the viewport to
       be worth asserting at all. */
    const kid = activeProfile();
    const key = getDayKeys(0)[0];
    const had = (getDayBlocks(key) || []).slice();
    const showBefore = dayViewShowAll();
    try {
      setDayViewShowAll(true);
      setDayBlocks(key, [
        { id: 'sc-early', actId: 'breakfast', startMin: 7 * 60, durationMin: 30 },
        { id: 'sc-late', actId: 'routine_evening', startMin: 21 * 60 + 30, durationMin: 30 },
      ], kid);
      openDay(key, 0);
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
    } finally {
      setDayBlocks(key, had, kid);
      setDayViewShowAll(showBefore);
    }
    return bad.length === 0 || bad;
  });

  /* NO RULE CROSSES A CARD'S TEXT, AND THE HOUR IS STILL FINDABLE.
     The grid used to be a single layer appended last, so every rule read
     THROUGH a placed block: right on an empty morning, wrong on a planned
     afternoon, which came out hatched with rules drawn over the top of the
     things they were meant to help you place. Half of it was fixed by putting
     the half-hour rules behind — but the hour stayed above, a full-width rule
     across every card on the day.

     Both surfaces now put every full-width rule behind, the way the printed
     sheet does: a block sits on its cell borders, so a line cannot cross its
     text. What survives above a card is the short mark at the gutter edge, so
     "where is four o'clock" still has an answer that nothing can hide.

     Checked by stacking order rather than by eye, and each side asserted
     separately — a z-index that silently stopped applying is exactly the
     failure that would otherwise look fine. */
  if (want('noRuleIsDrawnAcrossACard')) checks.noRuleIsDrawnAcrossACard = await page.evaluate(() => {
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

    /* `back` is whatever draws the full-width rules on this surface — the day
       view's row grid or the week's behind layer. `ticks` is the mark layer.
       Neither may put anything full-width over a card; the marks must stay
       above one; nothing in either may take a tap. */
    const surface = (name, root, backSel, tickSel, blockSel, wantQuarters, pxPerMin) => {
      const back = root && root.querySelector(backSel);
      const ticks = root && root.querySelector(tickSel);
      const block = root && root.querySelector(blockSel);
      if (!back) { bad.push(`${name}: nothing draws the rules`); return; }
      if (!ticks) { bad.push(`${name}: no hour-mark layer`); return; }
      if (!block) { bad.push(`${name}: nothing placed to read against`); return; }

      // Nothing full-width above the cards.
      if (ticks.querySelector('.hour-grid-line')) {
        bad.push(`${name}: a full-width rule rode above the cards`);
      }
      if (zOf(back) >= zOf(block)) {
        bad.push(`${name}: the rules (z${zOf(back)}) still ride over the block (z${zOf(block)})`);
      }
      // The hour mark is above, and it is a mark rather than a rule.
      const tick = ticks.querySelector('.hour-grid-tick');
      if (!tick) { bad.push(`${name}: no hour mark`); return; }
      if (zOf(ticks) <= zOf(block)) {
        bad.push(`${name}: the hour marks (z${zOf(ticks)}) are under the block (z${zOf(block)})`);
      }
      if (tick.getBoundingClientRect().width > 20) {
        bad.push(`${name}: the hour mark is ${Math.round(tick.getBoundingClientRect().width)}px wide — that is a rule`);
      }
      /* One mark per whole hour the surface actually DRAWS. This was a flat
         `< 17` — hours 6 through 22 — which is right for the week grid and
         wrong for the day view the moment it stops at the last thing planned.
         Derived from the rendered height, so it still catches a layer that
         silently stopped emitting marks. */
      const marks = [...ticks.querySelectorAll('.hour-grid-tick')];
      const drawnMin = root.getBoundingClientRect().height / pxPerMin;
      const wantMarks = Math.floor((START_MIN + drawnMin) / 60) - Math.ceil(START_MIN / 60) + 1;
      if (marks.length < wantMarks) {
        bad.push(`${name}: ${marks.length} hour marks over ${Math.round(drawnMin)} minutes, expected ${wantMarks}`);
      }
      if (!marks.some(m => crosses(m, block))) {
        bad.push(`${name}: no hour mark sits beside the block at all`);
      }
      // Appended after the blocks, so the marks earn their place by stacking.
      if (!(block.compareDocumentPosition(ticks) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        bad.push(`${name}: the hour marks are drawn before the block`);
      }
      // The density decision: quarters on the day, never on the week.
      const quarters = back.querySelectorAll('.slot-row--quarter').length;
      if (wantQuarters && !quarters) bad.push(`${name}: no quarter-hour rows`);
      if (!wantQuarters && quarters) bad.push(`${name}: drew ${quarters} quarter-hour rules at this scale`);
      [['rules', back], ['hour marks', ticks]].forEach(([what, g]) => {
        if (getComputedStyle(g).pointerEvents !== 'none') {
          bad.push(`${name}: the ${what} take pointer events and would swallow taps`);
        }
      });
    };

    setDayViewSpan(1);
    openDay(keys[0], 0);
    surface('day view', document.querySelector('#timeline .tl-canvas'),
            '.slot-grid--day', '.hour-grid--day', '.placed-block', true, PX_PER_MIN);
    /* The day divides exactly: 15-minute rows at 1.4px/min tile its canvas with
       nothing left over, which is why it can take Print's mechanism whole. The
       count was a flat 64 — the whole 6am–10pm day — and the canvas is trimmed
       to what is planned now, so the figure comes from the rendered height. The
       property that matters is that it divides, not that it is 64. */
    const dayCanvas = document.querySelector('#timeline .tl-canvas');
    const rows = document.querySelectorAll('#timeline .tl-canvas .slot-grid--day .slot-row');
    const canvasMin = dayCanvas.getBoundingClientRect().height / PX_PER_MIN;
    const wantRows = Math.round(canvasMin / 15);
    if (Math.abs(canvasMin - wantRows * 15) > 0.5) {
      bad.push(`the day canvas is ${canvasMin.toFixed(1)} minutes, not a whole number of 15-minute rows`);
    }
    if (rows.length !== wantRows) {
      bad.push(`the day draws ${rows.length} slot rows over ${Math.round(canvasMin)} minutes, expected ${wantRows}`);
    }

    /* Two surfaces, not three: the Day Blocks arm had no successor. The tab
       that replaced it previews the print sheet, whose rules ARE cell borders
       and which draws no grid layer of its own. */
    goWeek(); setWeekView('full'); renderWeek();
    // 0.72px/min — the week grid shadows PX_PER_MIN at its own scale.
    surface('Full week', document.querySelector('.wf-day-col'),
            '.hour-grid--wf.hour-grid--behind', '.hour-grid--wf:not(.hour-grid--behind)',
            '.wf-card', false, 0.72);

    // 6am and 10pm both get a rule: the gutter used < / > and the line loop
    // <= / >=, so the two ends were labelled but never drawn.
    const tops = [...document.querySelector('.wf-day-col')
      .querySelectorAll('.hour-grid--wf.hour-grid--behind .hour-grid-line--hour')]
      .map(l => Math.round(parseFloat(l.style.top)));
    if (!tops.includes(0)) bad.push('the Full week labels 6am but draws no rule for it');

    setWeekView('full');
    setDayBlocks(keys[0], before, 'jenn');
    openDay(keys[0], 0);
    return bad.length === 0 || bad;
  });

  /* Three columns on a phone is confetti, not a plan. The preference is kept —
     a narrow viewport serves fewer without forgetting what was chosen. */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  if (want('narrowScreensGetOneDay')) checks.narrowScreensGetOneDay = await page.evaluate(() => {
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
  if (want('copyDayReplacesCleanly')) checks.copyDayReplacesCleanly = await page.evaluate(() => {
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
  if (want('restInTemplateSheet')) checks.restInTemplateSheet = await page.evaluate(() => {
    const btn = document.getElementById('restDayBtn');
    return !!btn && !!btn.closest('#templateOverlay');
  });
  await page.evaluate(() => closeSheet('templateOverlay'));

  // The week legend, for kids
  await page.evaluate(() => { goWeek(); setWeekView('full'); });
  await page.waitForTimeout(400);
  if (want('weekLegend')) checks.weekLegend = await page.evaluate(() => {
    const el = document.getElementById('weekLegend');
    return !!el && el.style.display !== 'none' && el.children.length >= 5;
  });

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
  if (want('kidTabRenders')) checks.kidTabRenders = await page.evaluate(() =>
    !!document.querySelector('.ck-tab') && !!document.querySelector('.ck-rail')
    && document.querySelectorAll('.ck-day').length === 7
    && !!document.querySelector('.ck-bar'));
  // A kid's tab carries no grading control anywhere on it.
  if (want('kidTabHasNoGrading')) checks.kidTabHasNoGrading = await page.evaluate(() =>
    !document.querySelector('[data-ct-action="grade-chore"]'));
  // Layout C: the row is the tap target, and only the tapped row opens.
  if (want('tapOpensOneChoreOnly')) checks.tapOpensOneChoreOnly = await page.evaluate(() => {
    const row = document.querySelector('[data-ct-action="ck-chore-row"]');
    if (!row) return false;
    row.click();
    return document.querySelectorAll('.ck-chore.open').length === 1
        && document.querySelectorAll('[data-ct-action="ck-claim"]').length === 3;
  });
  await page.screenshot({ path: shot('kid_chore_day') });
  // Picking a word writes a claim, collapses the row, and moves no money.
  if (want('claimFromTheRow')) checks.claimFromTheRow = await page.evaluate(() => {
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
  if (want('gradedRowIsClosedToHer')) checks.gradedRowIsClosedToHer = await page.evaluate(() => {
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
  if (want('weekGridClaimsAndGreys')) checks.weekGridClaimsAndGreys = await page.evaluate(() => {
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
  if (want('railSitsBesideAtIpad')) checks.railSitsBesideAtIpad = await page.evaluate(() => {
    const main = document.querySelector('.ck-main').getBoundingClientRect();
    const rail = document.querySelector('.ck-rail').getBoundingClientRect();
    return rail.left >= main.right - 2 && rail.width > 200;
  });
  await page.screenshot({ path: shot('kid_chore_ipad') });
  await page.setViewportSize({ width: 900, height: 1100 });
  await page.waitForTimeout(200);
  // A day with nothing planned says so rather than showing an empty box.
  if (want('emptyDaySaysSo')) checks.emptyDaySaysSo = await page.evaluate(() => {
    ckSelectDay(4);
    const txt = document.querySelector('.ck-main').textContent;
    ckSelectDay(2);
    return /Nothing on today's plan/.test(txt);
  });

  /* Print is on the week it prints. It used to be reachable only from the More
     sheet, which is a menu you have to know to open; the week is where you are
     when you want a paper copy. Both doors call openPrint, so this asserts the
     button exists on the week AND that it is the same call, not a second one. */
  if (want('printIsOnTheWeek')) checks.printIsOnTheWeek = await page.evaluate(() => {
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
  if (want('durationsGoAsLongAsTheDay')) checks.durationsGoAsLongAsTheDay = await page.evaluate(() => {
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
  if (want('aCustomSportCanBeAdded')) checks.aCustomSportCanBeAdded = await page.evaluate(() => {
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
  if (want('retiringAnActivityKeepsItsHistory')) checks.retiringAnActivityKeepsItsHistory = await page.evaluate(async () => {
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
  if (want('everyCategoryIsReachable')) checks.everyCategoryIsReachable = await page.evaluate(() => {
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
    pendingStartMin = 9 * 60;
    openSlotPicker(9 * 60);
    const chipLabels = [...document.querySelectorAll('#slotPickerFilter .filter-chip')].map(c => c.textContent);
    ACTIVITY_FILTERS.forEach(f => {
      const shown = chipLabels.includes(f.label);
      const matches = acts.some(a => activityMatchesFilter(a, f.id));
      if (shown !== matches) bad.push(`chip "${f.label}" is ${shown ? 'offered with nothing behind it' : 'hidden despite having matches'}`);
    });
    closeSheet('slotPickerOverlay');
    getProfData('jenn').customActivities = had;
    /* Every category a parent or kid can file something under is a chip, and
       every SUBGROUP offered belongs to the category above it — a "Kind" select
       listing something the chosen category does not hold is a record filed
       where no chip will ever find it. Both dialogs are rendered from one table
       now; they used to hold a hardcoded eight each, copied byte for byte. */
    /* Opened, because both selects are rendered when the dialog opens rather
       than sitting in the markup — one table fills them, so reading them cold
       would be reading an empty shell and calling it a pass. */
    openCustomActivity('brain');
    openParentActivityEditor();
    [['customCat', 'customSub'], ['paCat', 'paSub']].forEach(([catId, subId]) => {
      const sel = document.getElementById(catId);
      const sub = document.getElementById(subId);
      if (!sel) { bad.push(`no #${catId} select`); return; }
      if (!sub) { bad.push(`no #${subId} select`); return; }
      if (!sel.options.length) bad.push(`#${catId} is empty — nothing rendered it`);
      [...sel.options].forEach(o => {
        if (!ACTIVITY_FILTERS.some(f => f.id === o.value)) {
          bad.push(`#${catId} offers "${o.value}" but nothing can filter to it`);
        }
      });
      const cat = catDef(sel.value);
      [...sub.options].forEach(o => {
        if (!cat.subs.some(sg => sg.id === o.value)) {
          bad.push(`#${subId} offers "${o.value}", which is not a kind of ${cat.short}`);
        }
      });
    });
    /* And it opens on the chip she came from: adding a drawing from inside
       Brain and being handed a form that says Play & Rest is the app forgetting
       where she was one tap ago. */
    const openedOn = document.getElementById('customCat');
    if (openedOn && openedOn.value !== 'brain') {
      bad.push(`opened from the Brain chip, the form says "${openedOn.value}"`);
    }
    closeSheet('customOverlay'); closeSheet('parentActivityOverlay');
    // Appointments arrived with something in them.
    if (!acts.some(a => activitySub(a).id === 'appts')) bad.push('the appointment subgroup is empty');
    if (!subDef('appts').hex) bad.push('appointments have no colour');
    return bad.length === 0 || bad;
  });

  // Print view: travel/get-ready buffers + time-of-day sideband
  await page.evaluate(() => { goWeek(); openPrint(); });
  await page.waitForTimeout(400);
  if (want('printBuffers')) checks.printBuffers = await page.evaluate(() =>
    document.querySelectorAll('.print-buffer').length >= 4);
  // Same for the printed axis, and for the same reason — it carried its own
  // copy of the 9am–3pm constants.
  if (want('printSideband')) checks.printSideband = await page.evaluate(() => {
    const keys = getDayKeys(weekOffset);
    const axisKey = keys.find(k => isSchoolDay(k)) || null;
    const want = axisKey ? dayZoneSegments(axisKey).length : 1;
    /* Scoped to the print SHEET. The week's preview tab renders the same
       markup through the same renderer, so an unscoped query counts both and
       reports exactly double. */
    const got = document.querySelectorAll('#printSheet .print-band-label').length;
    return got === want || [`the printed axis draws ${got} stretches for a day that has ${want}`];
  });
  await page.screenshot({ path: shot('print'), fullPage: true });

  // Series removal survives a stale remote merge
  if (want('seriesDeleteSticks')) checks.seriesDeleteSticks = await page.evaluate(() => {
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
  if (want('aSeriesRemembersItsDatesAndFrequency')) checks.aSeriesRemembersItsDatesAndFrequency = await page.evaluate(() => {
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
  if (want('aCompetitionCanCarryItsOwnName')) checks.aCompetitionCanCarryItsOwnName = await page.evaluate(() => {
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
    setWeekView('full');

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
  if (want('aNewExerciseWaitsForAGrownUp')) checks.aNewExerciseWaitsForAGrownUp = await page.evaluate(async () => {
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
  if (want('parentChoreTabRenders')) checks.parentChoreTabRenders = await page.evaluate(() => {
    const panel = document.getElementById('ptab-chores');
    return !!panel && panel.hidden === false && !!document.querySelector('.cp-tab')
        && !!document.querySelector('[data-cp-action="settle"]');
  });
  // The queue shows her claim, ringed on the grade the claim matches.
  if (want('queueShowsTheClaim')) checks.queueShowsTheClaim = await page.evaluate(() => {
    const ringed = document.querySelector('.cp-gbtn.agrees');
    return !!ringed && /waiting on you/i.test(document.querySelector('.cp-tab').textContent);
  });
  await page.screenshot({ path: shot('parent_chore_day') });
  // Grading from the queue records the grade and clears the row out of it.
  // It does NOT necessarily pay: her first two chores of the week are free, so
  // asserting money moved on chore one would be asserting the wrong rule.
  if (want('gradeFromQueueClearsIt')) checks.gradeFromQueueClearsIt = await page.evaluate(() => {
    const btn = document.querySelector('[data-cp-action="grade"][data-chore-id="dishes"][data-day="2"][data-grade="3"]');
    if (!btn) return false;
    btn.click();
    return mrGetChoreGrade('jenn', ctWeekKey, 2, 'dishes') === 3
        && !mrClaimQueue(ctWeekKey, 'jenn').some(q => q.choreId === 'dishes' && q.dayIdx === 2);
  });
  // Past the free two, a grade does move the week's money.
  if (want('gradingPastTheFreeTwoPays')) checks.gradingPastTheFreeTwoPays = await page.evaluate(() => {
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
  if (want('settleOnlyOpensTheMeeting')) checks.settleOnlyOpensTheMeeting = await page.evaluate(() => {
    const before = JSON.stringify(state.shared.chore.finalizedWeeks || {});
    document.querySelector('[data-cp-action="settle"]').click();
    const opened = mmIsOpen();
    // Settle is a run-the-meeting button, so it also asks about weeks nobody
    // settled (mmMaybeAskCatchUp). Answer it — a live .overlay is fixed/inset-0
    // at z-index 300, so leaving one up puts an invisible sheet of glass over
    // every hit-test that follows, which is what broke the 44px kid audit.
    _closeAppDialog(null);
    mmHide();
    return opened && JSON.stringify(state.shared.chore.finalizedWeeks || {}) === before;
  });
  // The planner panel schedules a chore onto the day, and takes it off again.
  if (want('parentSchedulesFromTheTab')) checks.parentSchedulesFromTheTab = await page.evaluate(() => {
    setParentTab('chores'); cpDay = 3; cpRenderChoreTab();
    const has = () => mrChoresForDay('jenn', ctWeekKey, 3).rows.some(r => r.row.id === 'mop');
    const wasOff = !has();
    document.querySelector('[data-cp-action="schedule"][data-chore-id="mop"]').click();
    const nowOn = has();
    document.querySelector('[data-cp-action="unschedule"][data-chore-id="mop"]').click();
    return wasOff && nowOn && !has();
  });
  // The dual grid shows both girls on one row, and greys days nobody planned.
  if (want('dualGridStripesBothKids')) checks.dualGridStripesBothKids = await page.evaluate(() => {
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
    // One money model for every week now, so nothing has to be walked back for
    // these bars to draw. The start date still has to cover the window, or the
    // weeks sit before the family's own record.
    const back = new Date(cur); back.setDate(cur.getDate() - 8 * 7);
    ctEnsureShared();
    state.shared.chore.programStartDate = ctDateToKey(back);
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
  if (want('trendsRenders')) checks.trendsRenders = await page.evaluate(() => {
    const p = document.getElementById('ptab-trends');
    return !!p && p.hidden === false && p.querySelectorAll('.ctr-svg').length === 2
        && p.querySelectorAll('.ctr-card').length === 2
        && !!p.querySelector('.ctr-heat-cell');
  });
  // Two panels, two scales — never one plot with two y-axes.
  if (want('noDualAxis')) checks.noDualAxis = await page.evaluate(() => {
    const svgs = [...document.querySelectorAll('#ptab-trends .ctr-svg')];
    const bars = svgs[0].querySelectorAll('rect').length;
    const lines = svgs[1].querySelectorAll('polyline').length;
    // The bar panel carries no polylines and the line panel carries no bars.
    return svgs[0].querySelectorAll('polyline').length === 0
        && svgs[1].querySelectorAll('rect').length === 0
        && lines === 2 && bars >= 0;
  });
  // Identity is never colour-alone: a legend is present and cells carry numbers.
  if (want('trendsIdentityNotColourAlone')) checks.trendsIdentityNotColourAlone = await page.evaluate(() =>
    document.querySelectorAll('#ptab-trends .ctr-legend-item').length === 2
    && [...document.querySelectorAll('#ptab-trends .ctr-heat-cell')].every(c => c.textContent.trim().length > 0));
  // The window pages back, and cannot page past now.
  if (want('trendsPagingIsBounded')) checks.trendsPagingIsBounded = await page.evaluate(() => {
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
  if (want('trendsPrefersTheFrozenLedger')) checks.trendsPrefersTheFrozenLedger = await page.evaluate(() => {
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
  if (want('portalPrintsNoBrokenNumbers')) checks.portalPrintsNoBrokenNumbers = await page.evaluate(() => {
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
  if (want('readIgnoresTheUnfinishedWeek')) checks.readIgnoresTheUnfinishedWeek = await page.evaluate(() => {
    const t = document.querySelector('#ptab-trends .cp-sect:last-child').textContent;
    return /still being lived/.test(t) && !/^\s*$/.test(t);
  });
  await page.screenshot({ path: shot('parent_trends') });

  // ── Redesign phase 5: chore setup ──
  await page.evaluate(() => { setParentTab('options'); coRenderOptions(); });
  await page.waitForTimeout(300);
  if (want('optionsRenders')) checks.optionsRenders = await page.evaluate(() => {
    const p = document.getElementById('ptab-options');
    return !!p && p.hidden === false && document.querySelectorAll('.co-row').length > 1
        && !!document.querySelector('[data-co-action="add"]');
  });
  // Adding a chore writes an effective-dated rule version, and it shows up in
  // the pool for the week on screen.
  if (want('addingAChoreIsAnAuditedRuleEdit')) checks.addingAChoreIsAnAuditedRuleEdit = await page.evaluate(() => {
    const before = mrVersions().length, logBefore = mrLogEntries().length;
    coDraft = { label: 'Water the plants', due: '6:00pm', who: 'jess', lane: 'helping' };
    coRenderOptions();
    document.querySelector('[data-co-action="add"]').click();
    const row = mrPoolRows(ctWeekKey).find(p => p.label === 'Water the plants');
    return !!row && row.lane === 'helping' && row.who === 'jess' && row.due === '6pm'
        && mrLogEntries().length > logBefore && mrVersions().length >= before;
  });
  // Bedtime is a wall: a due time after it is refused, and the pool is unchanged.
  if (want('bedtimeIsAWall')) checks.bedtimeIsAWall = await page.evaluate(() => {
    const row = mrPoolRows(ctWeekKey).find(p => p.label === 'Water the plants');
    coSetDue(row.id, '9:30pm');
    const after = mrPoolRows(ctWeekKey).find(p => p.id === row.id);
    return after.due === '6pm';
  });
  // A planner tag matching no pool row is surfaced here, and can be adopted.
  if (want('orphanTagsAreOfferedAFix')) checks.orphanTagsAreOfferedAFix = await page.evaluate(() => {
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
  if (want('bothGoalHalvesMustLand')) checks.bothGoalHalvesMustLand = await page.evaluate(() => {
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
  if (want('tagPickerWritesPoolIds')) checks.tagPickerWritesPoolIds = await page.evaluate(() => {
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
  if (want('redesignEndToEnd')) checks.redesignEndToEnd = await page.evaluate(() => {
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
    step.meetingOpens = mmIsOpen();
    step.nothingSettledYet = JSON.stringify(state.shared.chore.finalizedWeeks || {}) === finalBefore;
    _closeAppDialog(null);   // settle asks about unsettled weeks too — see above
    mmHide();

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
  if (want('routineItemsAlwaysHaveAnIcon')) checks.routineItemsAlwaysHaveAnIcon = await page.evaluate(() => {
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
  if (want('kidTabShowsRoutineIcons')) checks.kidTabShowsRoutineIcons = await page.evaluate(() => {
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

    /* The WORD COUNT is gone, at the owner's instruction, and the counting code
       with it. It was a hard cap of 200 visible words per kid screen, and what
       it actually bought was not brevity: it pushed real explanation behind
       disclosure toggles, where a nine-year-old does not go looking. A screen
       that has something worth saying now says it.

       What it does NOT license is padding. The editorial rules in CLAUDE.md
       still hold — lead with autonomy, no performance-identity framing, money
       is a lesson and not a payment — and those are judgement, which is what a
       word count was standing in for and could never actually measure.

       The 44px target floor and the 13px font floor stay. Those are reach and
       legibility on a child's hands and eyes, not editorial taste, and nothing
       about the budget coming off touches them. */

    // The week card's done-tick sits at a card corner, so a 44px hit area there
    // would swallow the tap that opens the day. Exempted deliberately, by name,
    // with the reason in css/app.css — the Today-first rebuild is what actually
    // relieves that grid. It is 28px square where a square fits and a full-height
    // 20px edge strip below that; the earlier note here described inline sizing
    // that never applied, because min-width/min-height in css/app.css beat it.
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

    return { screen: screenId, small, minFont: Math.round(minFont * 100) / 100, minWhere };
  }, screenId);

  /* The per-screen word budgets (WORD_BUDGET) lived here, with a dated note
     for every time one was raised or tightened. They went with the count
     itself — see the kidStandards comment above. The history is in git; the
     rule is not in force. */
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
    /* The week WITH SOMETHING ON IT. By the time the sweep runs the earlier
       checks have emptied the week, so an audit of the bare screen measures no
       cards at all — and the type inside a card is exactly what the 13px floor
       is about. A rule the suite renders no content for is a rule that is not
       enforced.

       Seed one real day, then put it back exactly as it was — the same
       discipline the Sunday row uses. */
    ['screen-week',    () => {
      goWeek();
      const kid = activeProfile();
      const key = getDayKeys(0)[2];
      const had = (getDayBlocks(key) || []).slice();
      try {
        setDayBlocks(key, [
          /* The shortest block the app allows, and for a long time the shortest
             this fixture did NOT contain: every row here started at 30 minutes,
             one notch above the tier boundary, so the sliver path was never
             drawn and none of its type was ever measured. It is `completed` on
             purpose too — the font sweep below skips an element with no text
             node, and an unticked button holds none, so the tick's own glyph
             (8px, inline, under the floor) could not be seen either. */
          { id: 'wk-audit-s', actId: 'break_quick', startMin: 6 * 60, durationMin: 15, completed: true },
          // A 30-minute block is the case that forced the density change: at the
          // old scale it was 15px tall, which no legible type fits inside.
          { id: 'wk-audit-a', actId: 'routine_morning', startMin: 7 * 60, durationMin: 30 },
          { id: 'wk-audit-b', actId: 'school_day', startMin: 9 * 60, durationMin: 5 * 60 },
          { id: 'wk-audit-c', actId: 'training', startMin: 17 * 60, durationMin: 90, tag: 'skating' },
        ], kid);
        weekOffset = 0;
        setWeekView('full');
        renderWeek();
      } finally { setDayBlocks(key, had, kid); }
    }, 'screen-week/planned'],
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
    /* The money story is a KID screen and was never in this audit, which is how
       it could have shipped the Flow's 26px-wide month columns with no floor
       enforced on them. Seeded, because an empty story draws no strip and no
       ribbons and would pass this audit by having nothing on it. */
    ['screen-moneystory', () => {
      const pd = getProfData('jenn');
      if (!(pd.events || []).length) {
        evAdd('jenn', { kind: 'in', from: 'earned', to: 'cash', amount: 40, dayKey: todayKey() });
        evAdd('jenn', { kind: 'out', from: 'cash', to: 'spent', amount: 12, dayKey: todayKey() });
      }
      mnyOpenStory();
    }],
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
      if (r.small && r.small.length) problems.push(`${r.small.length} target(s) under 44px: ${r.small.slice(0, 6).join(', ')}`);
      if (r.minFont < 13) problems.push(`font ${r.minFont}px on .${r.minWhere} (min 13)`);
      if (problems.length) kidFindings.push(`${label || id}@${w}: ${problems.join(' | ')}`);
    }
  }
  if (want('kidScreensMeetTheHouseRules')) checks.kidScreensMeetTheHouseRules = kidFindings.length === 0 || kidFindings;

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
  if (want('kidTabFitsAPhone')) checks.kidTabFitsAPhone =
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
  if (want('portalFitsAPhone')) checks.portalFitsAPhone = portal.length === 0 || portal;
  await page.setViewportSize({ width: 900, height: 1100 });
  await page.waitForTimeout(200);

  // Parent: the meeting commit moves wallet, XP and the loan together, so undo
  // has to reverse all three. A partial reverse would leave credited XP or a
  // loan payment standing against a week that was un-recorded.
  if (want('meetingUndoIsComplete')) checks.meetingUndoIsComplete = await page.evaluate(() => {
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
  if (want('loanChargesOncePerMonth')) checks.loanChargesOncePerMonth = await page.evaluate(() => {
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
  if (want('arrearsInterestOncePerMonth')) checks.arrearsInterestOncePerMonth = await page.evaluate(() => {
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
  if (want('downPaymentComesFirst')) checks.downPaymentComesFirst = await page.evaluate(() => {
    const kid = 'jenn';
    const l = loanState(kid);
    l.paid = 0; l.downPaid = 0; l.arrears = 0; l.arrearsInterest = 0;
    l.lastPaymentMonth = null; l.payments = [];
    const before = loanDueNow(kid, '2026-10-04');
    ensureWallet(kid).cash = 1000;
    loanSundayTransfer(kid, 'pay_available', { dayKey: '2026-10-04' });
    const after = loanDueNow(kid, '2026-11-01');
    return before.kind === 'down'
        && before.amount === money2(loanState(kid).downPayment)
        && loanDownOutstanding(kid) === 0
        && after.kind === 'scheduled';
  });

  // Nothing is owed before the deposit falls due — the pacing readout must not
  // report a kid as behind on a loan that hasn't started.
  if (want('nothingDueBeforeStart')) checks.nothingDueBeforeStart = await page.evaluate(() =>
    loanDueNow('jess', '2026-08-02').reason === 'not-started');

  // Free chores land on the LOWEST-paying work. Chronological order would mean
  // two sloppy chores on Monday earn more than two good ones.
  if (want('freeChoresTakeLowestPaying')) checks.freeChoresTakeLowestPaying = await page.evaluate(() => {
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
  if (want('honestyStep3WithdrawsFreePick')) checks.honestyStep3WithdrawsFreePick = await page.evaluate(() => {
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
  if (want('sundayBoxOpensAtMeeting')) checks.sundayBoxOpensAtMeeting = await page.evaluate(() => {
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
  if (want('honestyLadderResetsWeekly')) checks.honestyLadderResetsWeekly = await page.evaluate(() => {
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
  if (want('ledgerFreezesTheWeek')) checks.ledgerFreezesTheWeek = await page.evaluate(() => {
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
  if (want('competitionCarriesNameAndDate')) checks.competitionCarriesNameAndDate = await page.evaluate(() => {
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
  if (want('checkConfirmIsGated')) checks.checkConfirmIsGated = await page.evaluate(async () => {
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
  if (want('boxExemptListIsRead')) checks.boxExemptListIsRead = await page.evaluate(() => {
    const cfg = mrBoxCfg(mrRules());
    return Array.isArray(cfg.exempt) && cfg.exempt.length > 0
        && cfg.releaseDay === 'sunday' && cfg.redemptionJob === true;
  });

  // Hero tiers must outlast a season; six topped out at 500 XP.
  if (want('heroTiersReachTen')) checks.heroTiersReachTen = await page.evaluate(() =>
    HERO_TIERS.length >= 10 && heroTierForLevel(10).name.length > 0);

  /* ── The pocket-money system ── */

  // The single sports loan becomes debts[0] with every field carried across.
  // A migration that dropped `payments` would erase money the kid really paid.
  if (want('loanMigratesToDebtsIntact')) checks.loanMigratesToDebtsIntact = await page.evaluate(() => {
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
  if (want('extraPaysHighestBonusFirst')) checks.extraPaysHighestBonusFirst = await page.evaluate(() => {
    profile = 'parent';
    const kid = 'jess';
    const pd = getProfData(kid);
    delete pd.debts;
    mnyDebts(kid);                                 // migrate, then add a second
    mnyAddDebt(kid, { id: 'bike', name: 'Bike loan', icon: '🚲',
                      principal: 300, monthly: 25, bonusRate: 15,
                      downPaymentDue: '2026-01-01' });
    const first = mnyDebtsByPriority(kid)[0];
    const rec = loanRecordPayment(kid, 100, 'early', first.id);
    const ok = first.id === 'bike'                 // 15% beats the loan's 10%
            && rec && rec.debtId === 'bike'
            && rec.credited === 115;               // $100 clears $115
    delete pd.debts;
    return ok;
  });

  // Renaming a debt must never reset progress — the whole point of the record.
  if (want('renamingADebtKeepsProgress')) checks.renamingADebtKeepsProgress = await page.evaluate(() => {
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
  if (want('overrideReopensTheWeek')) checks.overrideReopensTheWeek = await page.evaluate(() => {
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
  if (want('planNeverOverspendsThePool')) checks.planNeverOverspendsThePool = await page.evaluate(() => {
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
  if (want('holdingsAreOneSourceOfTruth')) checks.holdingsAreOneSourceOfTruth = await page.evaluate(() => {
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

  // Money went INTO savings and companies through the meeting, but the way
  // back out left with the old pocket-money screen: moneyWithdraw and
  // moneySellStock kept working with nothing to call them. The parent's
  // holdings page is the door now, and it opens only for a grown-up.
  if (want('parentCanMoveSavedBackToCash')) checks.parentCanMoveSavedBackToCash = await page.evaluate(async () => {
    const bad = [];
    const kid = 'jenn';
    profile = 'parent'; parentViewing = kid;
    const pd = getProfData(kid);
    pd.holdings = [];
    pd.wallet = { cash: 10, savings: 0, gics: [], holdings: {}, lastMeetingWeek: null };
    mnyAddToSaved(kid, 100);
    mnyAddHolding(kid, { kind: 'stock', name: 'Lemonade Co', units: 4, priceNow: 12.5, costBasis: 40 });
    showScreen('parent'); setParentTab('money'); mnySetParentSection('holdings'); mnyRenderRulesTab();
    const wrap = document.getElementById('mnyRulesWrap') || document.querySelector('#ptab-money');
    if (!wrap.querySelector('[data-mnyp-action="saved2cash"]')) bad.push('no way to move kept-ready money back to cash');
    const sell = wrap.querySelector('[data-mnyp-action="holdsell"]');
    if (!sell) bad.push('no way to sell a company holding');

    // Through the real prompt: type an amount, press OK.
    const answer = async (v) => {
      for (let i = 0; i < 50 && !document.querySelector('#appDialogOverlay.open'); i++) await new Promise(r => setTimeout(r, 10));
      const inp = document.getElementById('appDialogInput');
      if (!inp) return false;
      inp.value = String(v);
      document.getElementById('appDialogOkBtn').click();
      for (let i = 0; i < 50 && document.querySelector('#appDialogOverlay.open'); i++) await new Promise(r => setTimeout(r, 10));
      await new Promise(r => setTimeout(r, 20));
      return true;
    };
    wrap.querySelector('[data-mnyp-action="saved2cash"]').click();
    if (!(await answer(30))) bad.push('moving to cash asked no amount');
    if (mnyCash(kid) !== 40) bad.push(`cash after withdraw is ${mnyCash(kid)}, expected 40`);
    if (mnySavedTotal(kid) !== 70) bad.push(`kept ready after withdraw is ${mnySavedTotal(kid)}, expected 70`);

    if (sell) {
      document.querySelector('[data-mnyp-action="holdsell"]').click();
      if (!(await answer(2))) bad.push('selling asked no count');
      if (mnyCash(kid) !== 65) bad.push(`cash after sale is ${mnyCash(kid)}, expected 65`);
      const h = mnyHoldingsOfKind(kid, 'stock')[0];
      if (!h || h.units !== 2) bad.push('two shares did not remain after selling two');
      if (h && money2(h.costBasis) !== 20) bad.push('cost basis did not come off in proportion');
    }
    // Asking for more than she has is capped, never overdrawn.
    moneyWithdraw(kid, 999);
    if (mnySavedTotal(kid) !== 0 || mnyCash(kid) !== 135) bad.push('overdrawing kept-ready money was not capped at what there was');
    pd.holdings = []; pd.wallet.cash = 0;
    return bad.length === 0 || bad;
  });

  // A split bumped past what clears a debt used to hand the difference to
  // nobody: the wallet lost it and the loan credited only what was owed.
  if (want('splitCannotOverpayADebt')) checks.splitCannotOverpayADebt = await page.evaluate(() => {
    const bad = [];
    const kid = 'jess';
    profile = 'parent'; ctParentKid = kid;
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const pd = getProfData(kid);
    delete pd.debts;
    mnyDebts(kid);
    mnyAddDebt(kid, { id: 'kite', name: 'Kite loan', icon: '🪁', principal: 50, monthly: 5, bonusRate: 10,
                      downPaymentDue: '2026-01-01' });
    const need = mnyCashToClear(kid, mnyDebtById(kid, 'kite'));
    if (Math.abs(need - 45.45) > 0.01) bad.push(`$50 at 10% needs ${need} of cash, expected 45.45`);
    mrEnsureEarnings(kid, wk).overrides = {};
    mnySetOverride(kid, wk, 'chores', 80, 'agreed');
    const d = mnyEnsureDraft(wk, kid);
    d.split['loan:kite'] = need;
    mnyTuneBucket('loan:kite', 1);
    if (money2(d.split['loan:kite']) !== need) bad.push('the stepper let the loan share pass what clears it');
    mrEnsureEarnings(kid, wk).overrides = {};
    delete pd.debts; mnyDraft = null;
    return bad.length === 0 || bad;
  });

  /* ── The Sunday meeting's two money steps ── */

  // The whole flow: agree the week, decide where it goes, watch it move, undo.
  // This is the one path that actually moves money, so it is checked end to end
  // rather than a piece at a time.
  if (want('meetingMoneyFlowEndToEnd')) checks.meetingMoneyFlowEndToEnd = await page.evaluate(() => {
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
    /* The shape, by the ids it is made of rather than by a count — a length
       check passes for any three steps, including three wrong ones. */
    const threeSteps = MM_STEPS.map(x => x.id).join(',') === 'week,money,close';

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

    mmHide();

    /* Findings, not a bare false. This is the longest end-to-end in the suite —
       nine named facts about a week's money moving — and every one of them was
       collapsed into a single boolean, so a failure said "the money flow broke"
       and nothing about which part. */
    const problems = [];
    if (!threeSteps) problems.push('the meeting is not week · money · close — it is ' + MM_STEPS.map(x => x.id).join(', '));
    if (!gated) problems.push('the split is not locked behind agreeing the week');
    if (!confirmed) problems.push('agreeing the week did not record it as confirmed');
    if (!poolIsHonest) problems.push('the pool does not add up: a $50 gift should join the same pool as everything else and be hers to decide about');
    if (!allToLoan) problems.push('the all-to-the-loan plan did not send the whole pool at the loan');
    if (!blockedNoAnswer) problems.push('the commit was not blocked while her question was unanswered');
    if (!moved) problems.push('committing did not move the money as the plan said: paid '
      + before.paid + ' → ' + after.paid + ', cash ' + before.cash + ' → ' + after.cash
      + ', saved ' + before.saved + ' → ' + after.saved
      + ', committed ' + mnyIsCommitted(wk, kid) + ', arrears ' + mnyDebts(kid)[0].arrears);
    if (!notHeldYet) problems.push('one child settling marked the whole meeting held — her sister has not decided');
    if (!reversed) problems.push('undo did not put every pot back where it was');
    return problems.length ? problems : true;
  });

  /* ── THE MONEY STREAM AGREES WITH THE WALLET ──────────────────────
     js/40-stream.js records every movement of money — where it came from and
     where it went — and derives every balance from those, instead of trusting
     one stored `wallet.cash` that eight separate functions had to remember to
     update. Stage 1 runs it in SHADOW: both are written, nothing on screen
     reads the stream yet, and this is the check that licenses retiring the
     stored number.

     It drives the REAL writers — a settlement, a gift, money into savings, a
     loan payment, a company bought and sold — and then asks whether the two
     ways of counting arrive at the same figure. `evShadowDrift` returns the
     findings rather than a boolean, so a failure says WHICH pot drifted and by
     how much; a bare `true` here would be a check that reports a problem and
     returns success, which is the exact shape CLAUDE.md records twice. */
  if (want('theMoneyStreamAgreesWithTheWallet')) checks.theMoneyStreamAgreesWithTheWallet = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jenn', wk = ctWeekKey, c = state.shared.chore;
    ['meetingsHeld', 'finalizedWeeks', 'moneyLedger', 'weekConfirms', 'weekPlans', 'xpAwardedWeeks']
      .forEach(m => { if (c[m]) delete c[m][wk]; });
    const pd = getProfData(kid);
    pd.deposits = []; pd.competitions = []; pd.honesty = []; pd.holdings = [];
    pd.events = [];                     // a clean stream, so drift is this test's
    delete pd.debts;
    ensureWallet(kid).cash = 0;
    mrEnsureEarnings(kid, wk).overrides = {};

    const problems = [];
    const drift = (where) => {
      const found = evShadowDrift(kid);
      if (found.length) problems.push(where + ': ' + found.join(', '));
    };

    // An empty stream and an empty wallet already agree — the base case, and
    // the one that would hide a sign error in every case after it.
    drift('at the start');

    // 1 · money arrives: a settled week and a birthday gift on their own days.
    //     Four chores, not two: the first two each week are free by the rules,
    //     so a two-chore week pays nothing and would prove nothing here.
    ['dishes', 'mop', 'vacuum', 'bins'].forEach((ch, i) => mrSetChoreGrade(kid, wk, i, ch, 3));
    mnyAddDeposit(kid, wk, { amount: 50, from: 'Birthday money', giver: 'Grandma' });
    commitKidWeek(wk, kid);
    drift('after a week was settled and a gift arrived');

    // 2 · money moves between pots, and out to a company and back.
    const cash = mnyCash(kid);
    if (cash > 20) {
      moneyDeposit(kid, 10);            // cash → kept ready
      drift('after putting money aside');
      moneyWithdraw(kid, 4);            // and back again
      drift('after taking some of it back');
      moneyOpenGIC(kid, 5, 12);         // cash → locked away
      drift('after locking money away');
      mnyBuyChosenFund(kid, 5);         // cash → a company
      drift('after buying into a company');
      const held = mnyHoldingsOfKind(kid, 'stock')[0];
      if (held) {
        mnyEditHolding(kid, held.id, 'priceNow', money2(money2(held.priceNow) + 3));
        drift('after the company went up');
        mnyEditHolding(kid, held.id, 'priceNow', money2(Math.max(0, money2(held.priceNow) - 7)));
        drift('after the company went down');
      }
    } else {
      problems.push('the seeded week earned too little to move anything: ' + cash);
    }

    // 3 · a gift taken back takes its money with it.
    const gift = (pd.deposits || [])[0];
    if (gift) { mnyRemoveDeposit(kid, gift.id); drift('after a gift was taken back'); }
    else problems.push('the gift was not recorded at all');

    // 4 · and the stream can say what the wallet never could: where it came
    //     from, where it went, and that a settled week is a settled week.
    const flow = evFlow(kid, null, null);
    if (!(flow.sources.earned > 0)) problems.push('nothing is recorded as earned');
    if (!(flow.dests.ready > 0)) problems.push('money put aside is not on the flow');
    if (!evWeekIsSettled(kid, wk)) problems.push('the settled week is not on the stream');
    // Every dollar in hand is accounted for by what came in and what went out.
    if (money2(flow.inTotal - flow.outTotal) !== evWorth(kid)) {
      problems.push('in minus out does not equal what she has: '
        + money2(flow.inTotal - flow.outTotal) + ' vs ' + evWorth(kid));
    }

    return problems.length ? problems : true;
  });

  /* ── THE FOUR HOUSE RULES ─────────────────────────────────────────
     Homework earns XP and not dollars · a behaviour fine is a conversation and
     not a deduction · one grace day a week in the routine streak · the pace
     figure divides by the weeks that PASSED.

     Each is a rule the family agreed, and each is the kind of change that goes
     wrong quietly: a channel that stops paying, a deduction that stops
     deducting, a streak that gets easier, a denominator that changes. The
     calibration tools hold the money; this holds the behaviour. */
  if (want('theFourHouseRulesHold')) checks.theFourHouseRulesHold = await page.evaluate(() => {
    const problems = [];
    profile = 'parent'; ctParentKid = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jenn', wk = ctWeekKey;
    const pd = getProfData(kid);
    const savedFines = (pd.fines || []).slice();
    const savedEarn = JSON.parse(JSON.stringify(mrEnsureEarnings(kid, wk)));
    /* The routine marks are a TOGGLE store and this check rewrites a whole
       week of them. Left behind they break blankPastWeekCanBeMadeUp thirty
       checks later — which is exactly how the streak fixture bit once already. */
    const savedMand = JSON.parse(JSON.stringify(getProfData(kid).chore.mandatoryByWeek[wk] || {}));
    const keys = mrWeekDayKeys(wk);
    try {
      // ── 1 · Homework earns XP, not dollars.
      const learn = ((mrRulesForWeek(wk) || {}).learning || {}).items || [];
      const paid = learn.filter(i => !i.xpOnly && Number(i.amount) > 0);
      if (paid.length) {
        problems.push('homework still pays money: ' + paid.map(i => i.id).join(', '));
      }
      mrSetLearning(kid, wk, 0, 'math', 6);          // two bundles of 3 pages
      const b = mrWeekBreakdown(wk, kid);
      if (money2(b.learnPaid) !== 0) problems.push('a homework bundle paid ' + b.learnPaid);
      if (!(b.learning.xpLevels > 0)) problems.push('a homework bundle earned no XP either — it should still count');

      // ── 2 · Twice is a conversation; the third time costs.
      const rich = [9, 9, 9, 9, 9, 9, 9];       // earnings high, so the daily floor never bites
      const fineItems = ((mrRulesForWeek(wk) || {}).fines || {}).items || [];
      const talk = fineItems.find(i => Number(i.freeRepeats) > 0);
      const money = fineItems.find(i => !Number(i.freeRepeats) && Number(i.amount) > 0);
      if (!talk) { problems.push('no behaviour fine is forgiven the first two times'); }
      if (!money) { problems.push('every fine became forgivable — the Sunday Box repeat should cost from the first'); }
      if (talk) {
        const charge = (n) => {
          pd.fines = [];
          for (let i = 0; i < n; i++) mrAddFine(kid, talk.id, keys[i % 7]);
          return money2(mrFinesWeek(wk, kid, rich).total);
        };
        if (charge(1) !== 0) problems.push('a first slip cost money');
        if (charge(2) !== 0) problems.push('a second cost money');
        if (charge(3) !== money2(talk.amount)) {
          problems.push('the third cost ' + charge(3) + ', not ' + talk.amount);
        }
        if (charge(4) !== money2(talk.amount * 2)) {
          problems.push('the fourth did not cost another ' + talk.amount);
        }
        // Recorded every time, forgiven or not — the record is the point.
        if (mrFines(kid).length !== 4) problems.push('only ' + mrFines(kid).length + ' of 4 were recorded');

        /* And she is told, in her own tab, what it is and what happens next —
           a rule a child finds out about by being charged is a rule she was
           never given a chance to keep. */
        pd.fines = [];
        mrAddFine(kid, talk.id, keys[1]);
        mrAddFine(kid, talk.id, keys[2]);
        const ev = reflEvidence(wk, kid, 'needsWork');
        const row = ev.find(e => String(e.id).indexOf('fine_') === 0);
        if (!row) problems.push('the incident is recorded but never reaches her reflection');
        else if (!/cost/.test(row.text)) {
          problems.push('her reflection does not say what happens next: ' + row.text);
        }
      }
      if (money) {
        pd.fines = [];
        mrAddFine(kid, money.id, keys[1]);
        if (!(money2(mrFinesWeek(wk, kid, rich).total) > 0)) {
          problems.push('the Sunday Box repeat stopped costing anything');
        }
      }
      pd.fines = [];

      // ── 3 · One grace day, and only one.
      const streak = (mrRulesForWeek(wk) || {}).streak || {};
      if (Number(streak.graceDays) !== 1) problems.push('the streak grants ' + streak.graceDays + ' grace days, not 1');
      /* ctSetMandatory(weekKey, dayIdx, session, kid, value) — the kid comes
         BEFORE the value, and getting that round the wrong way silently writes
         a routine mark for a child called `true`. */
      const setWeek = (pattern) => {
        getProfData(kid).chore.mandatoryByWeek[wk] = {};
        pattern.forEach((keptDay, d) => {
          mrRoutineSessionsFor(wk, kid, d).forEach(sess => ctSetMandatory(wk, d, sess, kid, keptDay));
        });
      };
      // Six kept with one miss in the middle: the grace carries the run across
      // it, and the day itself is NOT credited — so this is 6, not 7.
      setWeek([true, true, true, false, true, true, true]);
      const oneMiss = mrStreakWeek(wk, kid);
      if (oneMiss.days !== 6) problems.push('one miss gave a run of ' + oneMiss.days + ', not 6');
      // Two misses: the grace is spent on the first, the second ends the run.
      setWeek([true, true, false, true, true, false, true]);
      const twoMiss = mrStreakWeek(wk, kid);
      if (twoMiss.days >= 6) problems.push('two misses still gave a run of ' + twoMiss.days);
      // A clean week is still seven — grace must not inflate the top tier.
      setWeek([true, true, true, true, true, true, true]);
      const clean = mrStreakWeek(wk, kid);
      if (clean.days !== 7) problems.push('a clean week reads ' + clean.days + ', not 7');

      // ── 4 · The pace divides by the weeks that PASSED.
      const ytd = mrYearToDate(kid);
      if (typeof ytd.weeksElapsed !== 'number') problems.push('the pace does not report weeks elapsed');
      else if (ytd.weeksElapsed < ytd.weeks) {
        problems.push('weeks elapsed (' + ytd.weeksElapsed + ') is fewer than weeks settled (' + ytd.weeks + ')');
      }
      if (typeof mrWeeksElapsed !== 'function') problems.push('there is no one owner of weeks elapsed');
      else if (!(mrWeeksElapsed() > 0)) problems.push('weeks elapsed came out ' + mrWeeksElapsed());
    } catch (e) {
      problems.push('threw: ' + e.message);
    } finally {
      pd.fines = savedFines;
      getProfData(kid).earnings[wk] = savedEarn;
      getProfData(kid).chore.mandatoryByWeek[wk] = savedMand;
    }
    return problems.length ? problems : true;
  });

  /* ── THE FLOW SAYS WHERE IT WENT ──────────────────────────────────
     Stage 1 stored movements instead of balances FOR THIS SCREEN, and until
     now nothing read them: `evFlow`, `evMonths` and `evTypicalMonth` were
     unit-tested and had no caller. A calculation with no reader is a
     calculation nobody finds out is wrong.

     The owner's instruction is the thing to hold here: *I do not want the kids
     to see the end money, they need to understand the cash flow.* So this
     asserts what the screen LEADS with, not only that it renders — a screen
     whose first figure is a balance has quietly become the thing it replaced,
     and nothing else in the suite would notice. */
  if (want('theFlowSaysWhereItWent')) checks.theFlowSaysWhereItWent = await page.evaluate(() => {
    const problems = [];
    profile = 'jenn'; parentViewing = 'jenn';
    const kid = 'jenn';
    const pd = getProfData(kid);
    const savedEvents = (pd.events || []).slice();
    const savedPeriod = flPeriod, savedMonth = flMonth;
    try {
      /* Three months, with the middle one EMPTY on purpose — a gap is a fact
         the strip has to keep, and a month silently dropped from a chart reads
         as a month that did not happen. */
      const today = todayKey();
      const [yy, mm] = today.split('-').map(Number);
      const back = (n) => {
        let y = yy, m = mm - n;
        while (m < 1) { m += 12; y -= 1; }
        return y + '-' + String(m).padStart(2, '0');
      };
      const m0 = back(2), m2 = back(0);
      pd.events = [];
      evAdd(kid, { kind: 'in', from: 'earned', to: 'cash', amount: 40, dayKey: m0 + '-10' });
      evAdd(kid, { kind: 'in', from: 'gift',   to: 'cash', amount: 50, dayKey: m0 + '-20' });
      evAdd(kid, { kind: 'out', from: 'cash', to: 'spent', amount: 12, dayKey: m0 + '-25' });
      evAdd(kid, { kind: 'in', from: 'earned', to: 'cash', amount: 20, dayKey: m2 + '-05' });
      evAdd(kid, { kind: 'ready', from: 'cash', to: 'ready', amount: 30, dayKey: m2 + '-06' });

      mnyOpenStory();
      const host = document.getElementById('mnyStoryWrap');
      const text = () => host.innerText;

      // ── It does NOT lead with a balance.
      const storyEl = host.querySelector('.fl-story');
      if (!storyEl) { problems.push('the flow did not render'); return problems; }
      const lead = storyEl.innerText;
      if (!/came in/.test(lead)) problems.push('the flow does not lead with what came in: ' + lead);
      if (lead.indexOf('came in') > lead.indexOf('You have')) {
        problems.push('the balance is said before the movement — the one thing this screen must not do');
      }

      // ── This month: 20 in, 30 put away, nothing out.
      flPeriod = 'month'; flMonth = m2; mnyRenderStory();
      if (!/\$20\.00/.test(text())) problems.push('this month does not name the $20 that came in');
      if (!/Kept ready/.test(text())) problems.push('money moved to kept-ready is not drawn as somewhere it went');

      // ── All of it: every ribbon, across all three months.
      flPeriod = 'all'; mnyRenderStory();
      const all = text();
      ['Jobs and routines', 'Gifts', 'Spent', 'Kept ready'].forEach(l => {
        if (all.indexOf(l) < 0) problems.push('"' + l + '" is missing from the whole story');
      });
      if (!/\$60\.00/.test(all)) problems.push('jobs across all months do not total $60');
      if (!/\$12\.00/.test(all)) problems.push('what was spent is not shown');

      // ── The figure left is a BALANCE, not in minus out.
      const flow = evFlow(kid);
      const leftShown = (host.querySelector('.fl-left') || {}).innerText || '';
      if (leftShown.indexOf(mnyMoney(flow.inHand)) < 0) {
        problems.push('the left figure is not the cash balance: ' + leftShown);
      }
      if (money2(flow.inHand) === money2(flow.inTotal - flow.outTotal)) {
        // Only a warning shape: with this fixture they must differ, because 30
        // went to kept-ready, which is not "out".
        problems.push('left equals in minus out — allocations are being counted as money gone');
      }

      // ── A typical month divides by months ELAPSED, empty ones included.
      flPeriod = 'typical'; mnyRenderStory();
      const typ = evTypicalMonth(kid);
      if (typ.months < 3) problems.push('the typical month skipped the empty month: ' + typ.months);
      if (money2(typ.sources.earned) !== money2(60 / typ.months)) {
        problems.push('the typical month is not the total over months elapsed');
      }

      // ── The strip keeps the empty month, and is a picker.
      const cols = [...host.querySelectorAll('.fl-col')];
      if (cols.length < 3) problems.push('the history strip shows ' + cols.length + ' months, not 3');
      if (!host.querySelector('.fl-col.empty')) problems.push('the empty month was dropped from the strip');
      const target = cols.find(c => c.getAttribute('data-fl-month') === m0);
      if (!target) { problems.push('the oldest month is not on the strip'); return problems; }
      target.click();
      if (flPeriod !== 'month' || flMonth !== m0) {
        problems.push('tapping a month did not select it');
      }
      if (!/\$50\.00/.test(host.innerText)) problems.push('selecting that month did not show its gift');

      /* ── The settled-week list is still there, UNDER it, and drawn.
         Two assertions rather than one, because they fail for different
         reasons: rendered-at-all (the Flow replaced it instead of leading it)
         and has-a-box (it is in the markup but the Flow above it has collapsed
         or clipped it, which reads to a child exactly like it being gone).

         Written against innerHTML plus a measured rect rather than innerText.
         innerText answers "what does this element read as", which for a long
         screen is a rendering question this assertion never wanted to ask —
         it reported the card missing while the card was present and correct. */
      const weekCard = [...host.querySelectorAll('.mny-card')]
        .find(c => c.innerHTML.indexOf('Week by week') >= 0);
      if (!weekCard) {
        problems.push('the settled-week record was lost when the flow went in');
      } else {
        const r = weekCard.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0)) {
          problems.push('the settled-week card is in the markup but draws nothing: '
            + Math.round(r.width) + '×' + Math.round(r.height));
        }
        const flowCard = host.querySelector('.fl-story');
        if (flowCard && flowCard.getBoundingClientRect().top > r.top) {
          problems.push('the settled weeks are drawn ABOVE the flow — the narrower answer leads');
        }
      }
    } catch (e) {
      problems.push('threw: ' + e.message);
    } finally {
      pd.events = savedEvents;
      flPeriod = savedPeriod; flMonth = savedMonth;
    }
    return problems.length ? problems : true;
  });

  /* ── MONEY CAN MOVE BETWEEN SUNDAYS ──────────────────────────────
     Until now the ONLY way a dollar left cash was the Sunday split. The two
     doors that existed went one way — kept-ready back to cash, a company back
     to cash — and both were buried on the parent's Money rules page. So a gift
     that arrived on a Tuesday sat in cash until the following Sunday whatever
     anybody wanted, which is the "$50 with nowhere to go" that started this.

     The gates matter more than the movement: Money school opens the pots as the
     loan comes down, and a sheet that moved money into a pot she has not
     reached would make the whole ladder decorative. */
  if (want('moneyCanMoveOutsideAMeeting')) checks.moneyCanMoveOutsideAMeeting = await page.evaluate(() => {
    const problems = [];
    profile = 'parent'; ctParentKid = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jenn', pd = getProfData(kid);
    const savedHold = (pd.holdings || []).slice();
    const savedReq = (pd.moveRequests || []).slice();
    const savedEvents = (pd.events || []).slice();
    const savedDebts = pd.debts ? JSON.parse(JSON.stringify(pd.debts)) : null;
    /* The seeded cash is an UNMIRRORED write, so it is drift this check makes
       and must take away with it: `aGiftHasADate`, thirty checks later, reads
       `evShadowDrift` absolutely and would otherwise report this fixture's
       leftovers as a defect in dating a gift. */
    const savedCash = ensureWallet(kid).cash;
    const r = mrRules();
    const savedUnlock = JSON.parse(JSON.stringify((r.school || {}).unlockStage || {}));
    try {
      pd.holdings = []; pd.moveRequests = [];
      ensureWallet(kid).cash = 100;
      // Money school fully open, so the movement itself is what is measured.
      if (!r.school) r.school = {};
      r.school.unlockStage = Object.assign({}, savedUnlock, { [kid]: 4 });

      const cash0 = mnyCash(kid);
      const stream0 = evBalance(kid, 'cash');

      // ── cash → kept ready → cash, both ways, both mirrored.
      if (!mnyMoveMoney(kid, 'cash', 'ready', 25)) problems.push('cash to kept-ready was refused');
      if (mnySavedTotal(kid) !== 25) problems.push('kept ready holds ' + mnySavedTotal(kid) + ', not 25');
      if (mnyCash(kid) !== money2(cash0 - 25)) problems.push('cash did not go down by 25');
      if (!mnyMoveMoney(kid, 'ready', 'cash', 10)) problems.push('kept-ready back to cash was refused');
      if (mnySavedTotal(kid) !== 15) problems.push('kept ready holds ' + mnySavedTotal(kid) + ', not 15');
      // Stream and wallet moved together — the whole contract of Stage 1.
      if (money2(evBalance(kid, 'cash') - stream0) !== money2(mnyCash(kid) - cash0)) {
        problems.push('the stream and the wallet disagree about the move');
      }
      // Every movement is NAMED, which is what the old one-way doors never did.
      const moves = evList(kid).filter(e => e && e.kind === 'move' && e.note);
      if (!moves.length) problems.push('a move reached the stream with nothing said about it');

      // ── The refusals a child must be told, not silently denied.
      if (!mnyMoveRefusal(kid, 'cash', 'cash', 5)) problems.push('moving money to where it already is was allowed');
      if (!mnyMoveRefusal(kid, 'cash', 'ready', 0)) problems.push('a zero move was allowed');
      if (!mnyMoveRefusal(kid, 'cash', 'ready', 99999)) problems.push('she could move money she does not have');
      if (!mnyMoveRefusal(kid, 'locked', 'cash', 5)) problems.push('locked money came out early');

      // ── The Money-school gate, with the ladder back where it starts.
      r.school.unlockStage = Object.assign({}, savedUnlock, { [kid]: 0 });
      if (typeof mnyTotalPrincipal === 'function' && mnyTotalPrincipal(kid) > 0) {
        const gated = mnyMoveRefusal(kid, 'cash', 'invest', 5);
        if (!gated) problems.push('companies were open before Money school opened them');
        else if (!/Opens at/.test(gated)) problems.push('the refusal does not say when it opens: ' + gated);
        if (mnyMoveMoney(kid, 'cash', 'invest', 5)) problems.push('the gate greyed the row but the move still ran');
      }
      r.school.unlockStage = Object.assign({}, savedUnlock, { [kid]: 4 });

      // ── She proposes; it waits; a grown-up says yes.
      profile = 'jenn';
      const req = mnyRequestMove(kid, 'cash', 'ready', 5, 'for my bike');
      if (!req) { problems.push('a child could not ask'); return problems; }
      if (mnyPendingMoves(kid).length !== 1) problems.push('the request is not waiting');
      /* A request nobody can answer is worse than one that cannot be made, so
         the answering surface has to exist BEFORE the asking one. Both halves:
         a grown-up is told, and the control to answer is on the page. */
      profile = 'parent';
      const qrow = pnQueueRows().find(r => r.action === 'moves');
      if (!qrow) problems.push('a waiting move is not in the Waiting-on-you queue');
      else if (!/5/.test(qrow.sub)) problems.push('the queue row does not say how much: ' + qrow.sub);
      const card = mnyMoveRequestsCard(kid);
      if (!/data-mnyp-action="mvok"/.test(card) || !/data-mnyp-action="mvno"/.test(card)) {
        problems.push('the money page offers no way to answer the request');
      }
      if (!/for my bike/.test(card)) problems.push('the card drops her reason for asking');
      profile = 'jenn';
      const heldReady = mnySavedTotal(kid);
      if (mnyMoveMoney(kid, 'cash', 'ready', 5)) problems.push('a child moved money without asking');
      if (mnySavedTotal(kid) !== heldReady) problems.push('a refused move moved money anyway');

      profile = 'parent';
      if (!mnyApproveMove(kid, req.id)) problems.push('a grown-up could not approve it');
      if (mnySavedTotal(kid) !== money2(heldReady + 5)) problems.push('approving moved nothing');
      if (mnyPendingMoves(kid).length !== 0) problems.push('an answered request is still waiting');
      // Twice is once: two devices will each see the row.
      if (mnyApproveMove(kid, req.id)) problems.push('approving twice moved the money twice');

      // A refusal is an answer, and stays readable.
      const no = mnyRequestMove(kid, 'cash', 'ready', 5, 'again');
      mnyRejectMove(kid, no.id, 'we talked about it');
      const kept = mnyEnsureMoveRequests(kid).find(x => x.id === no.id);
      if (!kept || !kept.rejectedAt) problems.push('a refused request was thrown away rather than answered');
      if (mnyPendingMoves(kid).length !== 0) problems.push('a refused request is still waiting');
    } catch (e) {
      problems.push('threw: ' + e.message);
    } finally {
      profile = 'parent';
      pd.holdings = savedHold;
      pd.moveRequests = savedReq;
      pd.events = savedEvents;
      ensureWallet(kid).cash = savedCash;
      if (savedDebts) pd.debts = savedDebts;
      const rr = mrRules();
      if (rr.school) rr.school.unlockStage = savedUnlock;
    }
    return problems.length ? problems : true;
  });

  /* ── EVERY RECORD HAS ONE DOOR ────────────────────────────────────
     Five facts, five entry roads, none of them complete and three of them
     chains of sequential prompt dialogs — eleven of them for a meet result.
     A prompt chain is the worst shape a form can have: you cannot see what you
     already answered, you cannot change it, and backing out of the last one
     throws away all of it.

     What this asserts is that the sheet REACHES EVERY WRITER — not that it
     renders. A door that opens onto nothing is exactly the defect
     `aLegacyRoutineCarryIsOfferedAgain` records: the app said "Attached ✅" and
     no to-do existed, and the check of the day asserted the FIELD rather than
     the consequence, so it passed green over a complete no-op. */
  if (want('everyRecordHasOneDoor')) checks.everyRecordHasOneDoor = await page.evaluate(() => {
    const problems = [];
    profile = 'parent'; ctParentKid = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jenn', wk = ctWeekKey;
    const pd = getProfData(kid);
    const savedDeps = (pd.deposits || []).slice();
    const savedComps = (pd.competitions || []).slice();
    const savedFines = (pd.fines || []).slice();
    const savedEvents = (pd.events || []).slice();
    const savedHold = (pd.holdings || []).slice();
    const savedReq = (pd.moveRequests || []).slice();
    const savedCash = ensureWallet(kid).cash;
    /* The grade this check records is real money in a real week, so the week's
       earnings go back exactly as they were. Thirty checks run after this one
       and every money figure they read is the same week. */
    const savedEarn = JSON.parse(JSON.stringify(mrEnsureEarnings(kid, wk)));
    const keys = mrWeekDayKeys(wk);
    const savedBlocks = keys.map(k => (getDayBlocks(k, kid) || []).slice());
    const r = mrRules();
    const savedUnlock = JSON.parse(JSON.stringify((r.school || {}).unlockStage || {}));
    try {
      pd.deposits = []; pd.competitions = []; pd.fines = [];
      pd.holdings = []; pd.moveRequests = [];
      keys.forEach(k => setDayBlocks(k, [], kid));
      ensureWallet(kid).cash = 100;
      if (!r.school) r.school = {};
      r.school.unlockStage = Object.assign({}, savedUnlock, { [kid]: 4 });

      // ── The sheet asks which record this is when nobody has said.
      openRecordSheet({ kid });
      if (!rcDraft) { problems.push('the sheet did not open'); return problems; }
      if (rcDraft.kind) problems.push('it chose a record for a parent who had not');
      const shown = document.getElementById('recordBody').innerHTML;
      RC_KINDS.forEach(k => {
        if (shown.indexOf('data-rc-id="' + k.id + '"') < 0) {
          problems.push('a parent is not offered ' + k.id);
        }
      });

      // ── 🏆 a meet, which also has to place its block (the Stage 3 join).
      const satKey = keys[5];
      openRecordSheet({ kind: 'meet', kid, dayKey: satKey });
      Object.assign(rcDraft, { name: 'Winter Invitational', sport: 'swim', points: 12 });
      rcSave();
      const comp = mrCompetitions(kid).find(c => c && c.name === 'Winter Invitational');
      if (!comp) problems.push('the meet never reached mrAddCompetition');
      else {
        if (comp.dayKey !== satKey) problems.push('the meet lost the day it was given');
        const block = (getDayBlocks(satKey, kid) || []).find(b => b && b.compId === comp.id);
        if (!block) problems.push('recording a meet drew no block on the calendar');
      }
      if (rcDraft) problems.push('the sheet stayed open after recording');

      // Correcting it goes through the SAME door, keeping the id.
      if (comp) {
        openRecordSheet({ kind: 'meet', kid, id: comp.id });
        if (rcDraft.name !== 'Winter Invitational') problems.push('the correction form did not load the meet');
        rcDraft.points = 20;
        rcSave();
        const again = mrCompetitions(kid).filter(c => c && c.name === 'Winter Invitational');
        if (again.length !== 1) problems.push('correcting a meet made a second one');
        else if (again[0].points !== 20) problems.push('the correction was not saved');
      }

      // ── 🎁 a gift.
      openRecordSheet({ kind: 'gift', kid });
      Object.assign(rcDraft, { amount: 25, from: 'Birthday money', giver: 'Grandma' });
      rcSave();
      if (!mnyEnsureDeposits(kid).some(d => d && money2(d.amount) === 25)) {
        problems.push('the gift never reached mnyAddDeposit');
      }

      // ── 📦 a fine, from the week's own catalog.
      const fineItems = ((mrRulesForWeek(wk).fines) || {}).items || [];
      if (fineItems.length) {
        openRecordSheet({ kind: 'fine', kid, dayKey: keys[0] });
        rcDraft.fineId = fineItems[0].id;
        rcSave();
        if (!mrFines(kid).some(f => f && f.itemId === fineItems[0].id)) {
          problems.push('the fine never reached mrAddFine');
        }
      }

      // ── 🧹 a chore grade.
      const pool = mrChoresForDay(kid, wk, 0);
      if (pool.rows.length) {
        const choreId = pool.rows[0].row.id;
        openRecordSheet({ kind: 'chore', kid, dayKey: keys[0] });
        Object.assign(rcDraft, { choreId, grade: 2 });
        rcSave();
        if (mrGetChoreGrade(kid, wk, 0, choreId) !== 2) {
          problems.push('the grade never reached mrSetChoreGrade');
        }
      }

      // ── 🔀 a move.
      const ready0 = mnySavedTotal(kid);
      openRecordSheet({ kind: 'move', kid });
      Object.assign(rcDraft, { moveFrom: 'cash', moveTo: 'ready', amount: 15, why: 'my bike' });
      rcSave();
      if (mnySavedTotal(kid) !== money2(ready0 + 15)) problems.push('the move never reached mnyMoveMoney');

      // ── A child gets the two that are hers, and none of the three that are a
      //    grown-up's judgement about her week.
      profile = 'jenn';
      const hers = rcKindsFor().map(k => k.id).sort().join(',');
      if (hers !== 'gift,move') problems.push('a child is offered ' + hers);
      openRecordSheet({ kind: 'move', kid });
      Object.assign(rcDraft, { moveFrom: 'cash', moveTo: 'ready', amount: 5, why: 'saving' });
      const beforeAsk = mnySavedTotal(kid);
      rcSave();
      if (mnySavedTotal(kid) !== beforeAsk) problems.push("a child's move moved money without asking");
      if (mnyPendingMoves(kid).length !== 1) problems.push("a child's move did not wait for a grown-up");
      profile = 'parent';

      // ── The prompt chains are GONE, not merely bypassed. A retired chain left
      //    reachable is a second entry road with different rules.
      if (typeof ctPromptCompetition !== 'undefined') problems.push('ctPromptCompetition is still here');
      if (typeof mnyPromptGift !== 'undefined') problems.push('mnyPromptGift is still here');
    } catch (e) {
      problems.push('threw: ' + e.message);
    } finally {
      if (typeof closeRecordSheet === 'function') closeRecordSheet();
      profile = 'parent';
      pd.deposits = savedDeps; pd.competitions = savedComps; pd.fines = savedFines;
      pd.events = savedEvents; pd.holdings = savedHold; pd.moveRequests = savedReq;
      ensureWallet(kid).cash = savedCash;
      getProfData(kid).earnings[wk] = savedEarn;
      keys.forEach((k, i) => setDayBlocks(k, savedBlocks[i], kid));
      const rr = mrRules();
      if (rr.school) rr.school.unlockStage = savedUnlock;
    }
    return problems.length ? problems : true;
  });

  /* ── A GIFT HAS A DATE, AND TWO QUESTIONS ─────────────────────────
     `mnyAddDeposit` hardcoded `dayKey: todayKey()` and NO FORM ANYWHERE offered
     a date, so a birthday recorded a fortnight later sat in the wrong month of
     her history. Worse, the week came from whatever week the PLANNER happened
     to be showing — and a gift landing in a committed week called
     `mnyReopenWeek`, which returns false for exactly that case, so the gift
     credited her cash and then belonged to no week's split at all, silently.

     Two fields, two questions: `dayKey` is when it came, `weekKey` is which
     Sunday decides where it goes. */
  if (want('aGiftHasADate')) checks.aGiftHasADate = await page.evaluate(() => {
    const problems = [];
    profile = 'parent'; ctParentKid = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jenn', c = state.shared.chore;
    const pd = getProfData(kid);
    const savedDeps = (pd.deposits || []).slice();
    const savedEvents = (pd.events || []).slice();
    const savedPlans = JSON.parse(JSON.stringify(c.weekPlans || {}));
    try {
      pd.deposits = [];
      // A birthday three weeks ago, recorded today.
      const back = formatDayKey(todayKey()); back.setDate(back.getDate() - 21);
      const birthday = ctDateToKey(back);
      const itsWeek = ctWeekKeyForDate(birthday);

      const g = mnyAddDeposit(kid, ctWeekKey, {
        amount: 50, from: 'Birthday money', giver: 'Grandma', dayKey: birthday });
      if (!g) { problems.push('the gift was not recorded'); return problems; }
      if (g.dayKey !== birthday) problems.push('the gift lost its own date: ' + g.dayKey);
      if (g.weekKey !== itsWeek) problems.push('an open week did not decide it: ' + g.weekKey);
      // It reads in the month it arrived, which is the whole point.
      const flow = evFlow(kid, birthday, birthday);
      if (!(flow.sources.gift >= 50)) {
        problems.push('the gift is not on the flow for the day it arrived');
      }

      // ── Now the same gift into a SETTLED week.
      pd.deposits = [];
      if (!c.weekPlans) c.weekPlans = {};
      if (!c.weekPlans[itsWeek]) c.weekPlans[itsWeek] = {};
      c.weekPlans[itsWeek][kid] = { planId: 'balanced', committedAt: syncNow() };
      if (!mnyIsCommitted(itsWeek, kid)) problems.push('the fixture did not settle the week');

      const g2 = mnyAddDeposit(kid, ctWeekKey, {
        amount: 20, from: 'A gift', dayKey: birthday });
      if (!g2) { problems.push('a gift into a settled week was refused outright'); return problems; }
      if (g2.dayKey !== birthday) problems.push('it lost its date to protect a settled week');
      if (g2.weekKey === itsWeek) problems.push('a settled week was given something to decide');
      if (mnyIsCommitted(g2.weekKey, kid)) problems.push('it was handed to another settled week');
      // And the app can say so rather than leaving a parent to find out.
      if (!mnyGiftDecidedElsewhere(kid, birthday)) {
        problems.push('nothing says the decision moved to another week');
      }
      // The settled week is still settled — nothing reopened it.
      if (!mnyIsCommitted(itsWeek, kid)) problems.push('recording a gift reopened a settled week');

      // ── No caller regression: a gift with no date is still today's week.
      pd.deposits = [];
      const plain = mnyAddDeposit(kid, ctWeekKey, { amount: 5, from: 'A gift' });
      if (!plain || plain.dayKey !== todayKey()) {
        problems.push('an undated gift no longer falls back to today');
      }
      evShadowDrift(kid).forEach(d => problems.push('after dating gifts — ' + d));
    } catch (e) {
      problems.push('threw: ' + e.message);
    } finally {
      pd.deposits = savedDeps;
      pd.events = savedEvents;
      c.weekPlans = savedPlans;
    }
    return problems.length ? problems : true;
  });

  /* ── A CORRECTION IS A REVERSAL, NEVER A SILENT EDIT ──────────────
     Neither a gift nor a meet could be edited at all: a typo meant
     delete-and-retype, which for a gift debited the wallet and re-credited it
     and left two unexplained rows, and for a meet minted a new id — breaking
     the link to its block and making the planned meet read as unrecorded again.

     The wallet must move by the DIFFERENCE only, and both the mistake and its
     correction must stay readable. */
  if (want('aCorrectionIsAReversal')) checks.aCorrectionIsAReversal = await page.evaluate(() => {
    const problems = [];
    profile = 'parent'; ctParentKid = 'jess'; parentViewing = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey;
    const pd = getProfData(kid);
    const savedDeps = (pd.deposits || []).slice();
    const savedComps = (pd.competitions || []).slice();
    const savedEvents = (pd.events || []).slice();
    const keys = mrWeekDayKeys(wk);
    const savedBlocks = keys.map(k => (getDayBlocks(k, kid) || []).slice());
    try {
      pd.deposits = []; pd.competitions = [];
      keys.forEach(k => setDayBlocks(k, [], kid));

      /* ── A gift typed as $50 that was really $30.
         Drift is measured as a DELTA, not as absolute agreement: earlier checks
         in this suite set `ensureWallet(kid).cash` by hand to seed a fixture,
         which no writer can mirror, so jess's stream and wallet are already
         apart before this runs. What matters is that a correction moves both by
         the same amount — which is exactly what the first attempt got wrong,
         reversing the whole original while the wallet moved by the difference. */
      const cash0 = mnyCash(kid);
      const stream0 = evBalance(kid, 'cash');
      const g = mnyAddDeposit(kid, wk, { amount: 50, from: 'Birthday money', giver: 'Grandma' });
      if (mnyCash(kid) !== money2(cash0 + 50)) problems.push('the gift did not credit 50');
      mnyEditDeposit(kid, g.id, { amount: 30 });
      if (mnyCash(kid) !== money2(cash0 + 30)) {
        problems.push('correcting 50 to 30 left ' + mnyCash(kid) + ', not ' + money2(cash0 + 30));
      }
      if (money2(evBalance(kid, 'cash') - stream0) !== 30) {
        problems.push('the stream moved ' + money2(evBalance(kid, 'cash') - stream0)
          + ' where the wallet moved 30');
      }
      // The mistake is still readable — the original row is not rewritten.
      const fifty = evList(kid).filter(e => e && e.ref === g.id && money2(e.amount) === 50);
      if (!fifty.length) problems.push('the $50 that was recorded is no longer in the history');
      const corrected = evList(kid).some(e => e && e.ref === g.id && e.kind === 'correction');
      if (!corrected) problems.push('the correction itself is not on the record');

      /* Removing it takes back what is actually there, and — because the whole
         gift is still in hand — MARKS the original as reversed. A gift already
         spent would give back only what is left and would not claim to be a
         reversal, which is why this is asserted here and not on the edit. */
      mnyRemoveDeposit(kid, g.id);
      if (mnyCash(kid) !== cash0) {
        problems.push('removing the corrected gift left ' + mnyCash(kid) + ', not ' + cash0);
      }
      if (money2(evBalance(kid, 'cash') - stream0) !== 0) {
        problems.push('the stream did not come back with the wallet');
      }
      if (!evList(kid).some(e => e && e.reverses)) {
        problems.push('taking a whole gift back did not mark the original as reversed');
      }

      // ── A meet recorded with the wrong points, on the wrong day.
      const sat = keys[5], sun = keys[6];
      const meet = mrAddCompetition(kid, { dayKey: sat, sport: 'swim', name: 'City Meet', points: 3 });
      const firstAward = money2(meet.awarded);
      const blockId = meet.blockId;
      if (!blockId) problems.push('the meet was not linked to a block');

      const fixed = mrUpdateCompetition(kid, meet.id, { points: 9, dayKey: sun, name: 'City Open' });
      if (!fixed) { problems.push('the meet could not be corrected'); return problems; }
      if (fixed.id !== meet.id) problems.push('correcting a meet minted a new id');
      if (money2(fixed.awarded) === firstAward) problems.push('the award was not re-scored');
      if (fixed.dayKey !== sun) problems.push('the date did not move');
      // The block moved with it — a face left behind is a second meet nobody held.
      const onOld = (getDayBlocks(sat, kid) || []).filter(blockIsCompetition).length;
      const onNew = (getDayBlocks(sun, kid) || []).find(b => b.compId === meet.id);
      if (onOld !== 0) problems.push('a block was left behind on the old day');
      if (!onNew) problems.push('the block did not follow the meet to its new day');
      if (onNew && onNew.compName !== 'City Open') problems.push('the block kept the old name');
      // And it still reads as recorded, not as a meet waiting for a result.
      if (mmUnrecordedCompetitions(wk, kid).some(p => p.dayKey === sun)) {
        problems.push('a corrected meet reads as unrecorded');
      }
    } catch (e) {
      problems.push('threw: ' + e.message);
    } finally {
      pd.deposits = savedDeps;
      pd.competitions = savedComps;
      pd.events = savedEvents;
      keys.forEach((k, i) => setDayBlocks(k, savedBlocks[i], kid));
    }
    return problems.length ? problems : true;
  });

  /* ── A MEET IS ONE FACT WITH TWO FACES ────────────────────────────
     A competition is a record of what it was worth AND a block on the calendar,
     and either side may be created first. They carry each other's id now, which
     is what makes the pair survive an edit.

     The defect this closes: the planned/recorded join was `dayKey` plus the
     LOWERCASED NAME, and both sides are mutable. A parent who fixed a spelling
     while recording the result left the planned meet permanently unrecorded —
     and an unrecorded planned meet DISABLES THE CONFIRM BAR, so the week could
     not settle and nothing on screen said why. */
  if (want('aMeetIsOneFactWithTwoFaces')) checks.aMeetIsOneFactWithTwoFaces = await page.evaluate(() => {
    const problems = [];
    profile = 'parent'; ctParentKid = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jenn', wk = ctWeekKey;
    const pd = getProfData(kid);
    const savedComps = (pd.competitions || []).slice();
    const keys = mrWeekDayKeys(wk);
    const satKey = keys[5];
    const savedBlocks = keys.map(k => (getDayBlocks(k, kid) || []).slice());
    try {
      pd.competitions = [];
      keys.forEach(k => setDayBlocks(k, [], kid));

      // ── Record → block. A result on a day with nothing planned places one.
      const meet = mrAddCompetition(kid, {
        dayKey: satKey, sport: 'swim', name: 'Regional meet', points: 8 });
      if (!meet) { problems.push('the meet was not recorded at all'); return problems; }
      const block = (getDayBlocks(satKey, kid) || []).find(b => b.compId === meet.id);
      if (!block) problems.push('recording a meet placed no block on its day');
      else {
        if (block.startMin !== COMP_BLOCK_START) problems.push('the block does not start at 8am: ' + block.startMin);
        if (block.durationMin !== COMP_BLOCK_DUR) problems.push('the block is not 8am–3pm: ' + block.durationMin);
        // Both legs and the warm-up, per side — the readers ask by side.
        if (getTravelBufMin(block, 'pre') !== COMP_TRAVEL_MIN) problems.push('no travel out');
        if (getTravelBufMin(block, 'post') !== COMP_TRAVEL_MIN) problems.push('no travel home');
        if (getWarmupBufMin(block) !== COMP_WARMUP_MIN) problems.push('no warm-up');
        if (block.tag !== 'swimming') problems.push('the block was not tagged with its sport: ' + block.tag);
        if (meet.blockId !== block.id) problems.push('the record does not name its block');
      }
      // It reads as recorded, not as a meet still waiting for a result.
      if (mmUnrecordedCompetitions(wk, kid).some(p => p.dayKey === satKey)) {
        problems.push('a meet with a result still reads as unrecorded');
      }

      // ── Recording twice on one day does not draw two 🏆.
      const before = (getDayBlocks(satKey, kid) || []).filter(blockIsCompetition).length;
      mrAddCompetition(kid, { dayKey: satKey, sport: 'swim', name: 'Regional meet', points: 8 });
      const after = (getDayBlocks(satKey, kid) || []).filter(blockIsCompetition).length;
      if (after !== before + 1) {
        problems.push('a second meet on one day drew ' + (after - before) + ' blocks, not 1');
      }

      // ── Block → record, and THE CORRECTED SPELLING. A planned block is
      //    offered; recording it under a fixed name must still satisfy it.
      pd.competitions = [];
      keys.forEach(k => setDayBlocks(k, [], kid));
      const planned = {
        id: 'cb-test-1', actId: 'competition', compName: 'Wnter Invitatonal',
        tag: 'skating', startMin: COMP_BLOCK_START, durationMin: COMP_BLOCK_DUR,
        objectives: [], checklistState: {}, gearState: {},
      };
      setDayBlocks(satKey, [planned], kid);
      const offered = mmUnrecordedCompetitions(wk, kid);
      const row = offered.find(p => p.dayKey === satKey);
      if (!row) problems.push('a planned meet was not offered for recording');
      else {
        if (row.blockId !== 'cb-test-1') problems.push('the offer throws the block id away');
        if (row.sport !== 'skate') problems.push('a skating block did not resolve to skate: ' + row.sport);
        // Record it with the spelling CORRECTED — the case that used to jam.
        mrAddCompetition(kid, { dayKey: satKey, sport: 'skate',
                                name: 'Winter Invitational', points: 3,
                                blockId: row.blockId });
        if (mmUnrecordedCompetitions(wk, kid).some(p => p.dayKey === satKey)) {
          problems.push('correcting the spelling left the planned meet unrecorded for ever');
        }
        // And the name the join could not survive really did change.
        if (mmCompKey(satKey, 'Wnter Invitatonal') === mmCompKey(satKey, 'Winter Invitational')) {
          problems.push('the fixture did not actually change the name');
        }
      }

      // ── Deleting the result keeps the block: the meet still happened.
      const rec = mrCompetitions(kid).find(c => c.dayKey === satKey);
      if (rec) mrDeleteCompetition(kid, rec.id);
      const stillThere = (getDayBlocks(satKey, kid) || []).find(b => b.id === 'cb-test-1');
      if (!stillThere) problems.push('deleting a result deleted the meet from the calendar');
      else if (stillThere.compId) problems.push('the block still claims a record that is gone');
    } catch (e) {
      problems.push('threw: ' + e.message);
    } finally {
      pd.competitions = savedComps;
      keys.forEach((k, i) => setDayBlocks(k, savedBlocks[i], kid));
    }
    return problems.length ? problems : true;
  });

  /* ── WATCHING IS NOT COMPETING ────────────────────────────────────
     A sister can be invited to WATCH a meet, and the danger is the invite
     mechanism itself: acceptInvite copies actId verbatim, and `competition` is
     a plain default activity carrying isCompetition — so the watcher's block
     WAS a competition. mmPlannedCompetitions would have chased her at Sunday's
     meeting for a result she never swam, and mrPlaceCompetitionBlock's orphan
     adoption would have handed her watch block to the meet as its own.

     The guard is one seam: blockIsCompetition returns false for a watching
     block, so all five production callers go quiet at once, in the direction
     that is safe by default. This check is the reason that narrowing exists —
     it is worth more than the rest of the feature. */
  if (want('aWatchedMeetIsNeverChasedForAResult')) checks.aWatchedMeetIsNeverChasedForAResult = await page.evaluate(async () => {
    const problems = [];
    const wasProfile = profile, wasViewing = parentViewing, wasDayKey = currentDayKey;
    const wasOffset = weekOffset;
    const wasInvites = state.shared.invites;
    const keys = getDayKeys(0);
    const satKey = keys[5];
    const savedJenn = keys.map(k => getDayBlocks(k, 'jenn'));
    const savedJess = keys.map(k => getDayBlocks(k, 'jess'));
    const jessComps = getProfData('jess').competitions;
    try {
      state.shared.invites = [];
      keys.forEach(k => { setDayBlocks(k, [], 'jenn'); setDayBlocks(k, [], 'jess'); });
      getProfData('jess').competitions = [];

      // Jenn's meet, with a name a parent typed.
      const meetBlock = {
        id: 'cb-watch-src', actId: 'competition', compName: 'Winter Invitational',
        tag: 'skating', startMin: COMP_BLOCK_START, durationMin: COMP_BLOCK_DUR,
        objectives: [], checklistState: {}, gearState: {},
        travelBuffer: true, travelBufMin: 15, warmupBuffer: true, warmupBufMin: 20,
      };
      setDayBlocks(satKey, [meetBlock], 'jenn');

      // Jenn invites Jess to WATCH. Through the real door, dialog and all.
      profile = 'jenn'; currentDayKey = satKey;
      const p1 = sendInvite(meetBlock, 'jess', { watch: true });
      await new Promise(r => setTimeout(r, 40));
      const ok = document.getElementById('appDialogOkBtn');
      if (!ok) { problems.push('inviting a sister to watch did not ask first'); return problems; }
      /* The dialog has to name the MEET. "Share 🏆 Competition" is every meet
         this season, and a child agreeing to a Saturday deserves to know which. */
      const dlgText = (document.getElementById('appDialogMsg') || {}).textContent || '';
      if (!/Winter Invitational/.test(dlgText)) {
        problems.push(`the watch invite does not name the meet: "${dlgText.trim().slice(0, 120)}"`);
      }
      ok.click();
      await p1;

      const inv = (state.shared.invites || []).find(i => i && i.to === 'jess');
      if (!inv) { problems.push('no invite reached Jess'); return problems; }
      if (!inv.watch) problems.push('the invite does not say it is an invitation to watch');

      profile = 'jess';
      acceptInvite(inv.id);
      const watchBlock = (getDayBlocks(satKey, 'jess') || [])[0];
      if (!watchBlock) { problems.push('accepting the watch invite put nothing on Jess’s day'); return problems; }
      if (!watchBlock.watching) problems.push('the accepted block does not carry watching: true');
      if (watchBlock.compName !== 'Winter Invitational') {
        problems.push(`the watcher's block does not carry the meet's name: "${watchBlock.compName}"`);
      }

      // ── The seam itself.
      if (typeof blockIsWatching !== 'function') {
        problems.push('blockIsWatching is not declared — nothing owns the question');
      } else if (!blockIsWatching(watchBlock)) {
        problems.push('blockIsWatching says the watch block is not a watch block');
      }
      if (blockIsCompetition(watchBlock)) {
        problems.push('blockIsCompetition says a watch block IS a competition — every competition surface will treat Jess as a competitor');
      }
      if (!blockIsCompetition(meetBlock)) {
        problems.push('the narrowing went too far: Jenn’s own meet stopped being a competition');
      }

      // ── She is never listed, so never scored and never paid.
      const wk = ctThisWeekKey();
      if (mmPlannedCompetitions(wk, 'jess').some(p => p.blockId === watchBlock.id)) {
        problems.push('the meeting lists Jess’s watch block as a competition she planned');
      }
      if (mmUnrecordedCompetitions(wk, 'jess').some(p => p.blockId === watchBlock.id)) {
        problems.push('Jess is chased at the meeting for the result of a meet she watched');
      }
      if (!mmPlannedCompetitions(wk, 'jenn').some(p => p.blockId === meetBlock.id)) {
        problems.push('Jenn’s own meet fell out of the meeting');
      }

      // ── And the orphan adoption does not take it.
      const comp = { id: 'comp-watch-test', dayKey: satKey, name: 'Winter Invitational', sport: 'skate' };
      const placed = mrPlaceCompetitionBlock('jess', comp);
      if (placed && placed.id === watchBlock.id) {
        problems.push('recording a meet adopted Jess’s watch block as the meet’s own — she is now the competitor');
      }
      if (watchBlock.compId) {
        problems.push('the watch block was given a compId, which is the link to the money tab');
      }

      // ── No competition money for her: nothing was ever recorded against it.
      if (mrCompetitions('jess').some(c => c && c.blockId === watchBlock.id)) {
        problems.push('a competition result is filed against Jess’s watch block');
      }

      // ── And the block stops claiming a trophy.
      const head = buildBlockTrainingChecks(watchBlock).textContent || '';
      if (/🏆/.test(head)) {
        problems.push(`the watch block still says "${head.trim().slice(0, 40)}" — it calls her a competitor on her own calendar`);
      }
    } catch (e) {
      problems.push('threw: ' + e.message);
    } finally {
      state.shared.invites = wasInvites;
      getProfData('jess').competitions = jessComps;
      keys.forEach((k, i) => { setDayBlocks(k, savedJenn[i], 'jenn'); setDayBlocks(k, savedJess[i], 'jess'); });
      profile = wasProfile; parentViewing = wasViewing;
      currentDayKey = wasDayKey; weekOffset = wasOffset;
      closeSheet('editOverlay');
    }
    return problems.length ? problems : true;
  });

  /* ── A WATCH BLOCK SAYS WHAT IT IS ────────────────────────────────
     Safety is the previous check; this is whether the thing is legible. A card
     reading "Winter Invitational" on Jess's Saturday claims the meet is hers.
     And a watcher does not warm up and does not pack a skater's kit — she does
     still travel there, which is the one buffer that stays. */
  if (want('aWatchInviteNamesTheMeet')) checks.aWatchInviteNamesTheMeet = await page.evaluate(() => {
    const problems = [];
    const wasProfile = profile;
    const keys = getDayKeys(0);
    const satKey = keys[5];
    const saved = getDayBlocks(satKey, 'jess');
    try {
      const watchBlock = {
        id: 'cb-watch-card', actId: 'competition', compName: 'Winter Invitational',
        watching: true, tag: 'skating', startMin: COMP_BLOCK_START, durationMin: 180,
        objectives: [], note: '', checklistState: {}, gearState: {},
        travelBuffer: true, travelBufMin: 15,
      };
      setDayBlocks(satKey, [watchBlock], 'jess');
      profile = 'jess';

      const disp = blockDisplayName(watchBlock, 'jess', satKey);
      if (!/watching/i.test(disp.name)) {
        problems.push(`the watcher's card reads "${disp.name}" — it names the meet as if she were in it`);
      }
      if (!/Winter Invitational/.test(disp.name)) {
        problems.push(`the watcher's card does not say which meet: "${disp.name}"`);
      }
      // …and an unnamed meet still reads sensibly rather than "Watching — ".
      const unnamed = { ...watchBlock, id: 'cb-watch-noname', compName: '' };
      const dispU = blockDisplayName(unnamed, 'jess');
      if (!/watching/i.test(dispU.name) || /—\s*$/.test(dispU.name.trim())) {
        problems.push(`an unnamed meet gives the watcher "${dispU.name}"`);
      }

      // ── Travel stays, warm-up goes.
      if (!watchBlock.travelBuffer) problems.push('the watch block has no travel time — she does go to the rink');
      if (watchBlock.warmupBuffer) problems.push('the watch block carries a warm-up — she is not competing');

      // ── No gear list, no training checks.
      renderTrainingChecks('kidTrainingChecks', watchBlock);
      const checksWrap = document.getElementById('kidTrainingChecks');
      if (checksWrap && checksWrap.children.length) {
        problems.push(`a watcher is given ${checksWrap.children.length} training checks to answer about somebody else's session`);
      }
      renderTrainingGearChecklist('kidTrainingGear', watchBlock, watchBlock.tag, false, true);
      const gearWrap = document.getElementById('kidTrainingGear');
      if (gearWrap && gearWrap.children.length) {
        problems.push(`a watcher is given a skater's packing list (${gearWrap.children.length} items)`);
      }
    } catch (e) {
      problems.push('threw: ' + e.message);
    } finally {
      setDayBlocks(satKey, saved, 'jess');
      profile = wasProfile;
      ['kidTrainingChecks', 'kidTrainingGear'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
      });
    }
    return problems.length ? problems : true;
  });

  /* ── AN INVITE CANNOT BE SENT, OR ACCEPTED, TWICE ─────────────────
     There were two writers of an ordinary invite — sendInvite, and an inline
     copy in inviteSisterFromEdit — and neither asked whether one was already
     out. acceptInvite had no status guard, so a double-tap on ✅ Accept put two
     blocks on her day. And the edit sheet's share button answered "sent?" from
     `invitedTo`, which cannot tell a share from a watch.

     One owner now: sendInvite is the only writer, sisterInviteFor answers
     "is there already one of these", and each button asks about its own kind.
     A declined invite may go again — a no on Tuesday is not a no for ever. */
  if (want('anInviteCannotBeSentTwice')) checks.anInviteCannotBeSentTwice = await page.evaluate(async () => {
    const problems = [];
    const wasProfile = profile, wasViewing = parentViewing, wasDayKey = currentDayKey;
    const wasOffset = weekOffset, wasSyncIdx = syncDayIdx;
    const wasInvites = state.shared.invites;
    const keys = getDayKeys(0);
    const wedKey = keys[2], friKey = keys[4], satKey = keys[5], sunKey = keys[6];
    const savedJenn = keys.map(k => getDayBlocks(k, 'jenn'));
    const savedJess = keys.map(k => getDayBlocks(k, 'jess'));
    const settle = () => new Promise(r => setTimeout(r, 40));
    const toastEl = () => document.getElementById('toast');
    /* Run one door and say yes if it asks. Reports whether it asked and what
       the toast said, so "refused" and "refused, and said why" are separate. */
    const attempt = async (fn) => {
      toastEl().textContent = '';
      const p = fn();
      await settle();
      const asked = !!document.querySelector('#appDialogOverlay.open');
      if (asked) document.getElementById('appDialogOkBtn').click();
      await p;
      return { asked, toast: (toastEl().textContent || '').trim() };
    };
    const invitesOf = (blockId, kind) => (state.shared.invites || []).filter(i =>
      i && i.sourceBlockId === blockId && i.to === 'jess' && (kind === 'watch' ? !!i.watch : !i.watch));
    const live = (arr) => arr.filter(i => i.status === 'pending' || i.status === 'accepted');
    // Displayed inside the edit sheet: no ancestor below the overlay is display:none.
    const shown = (id) => {
      let el = document.getElementById(id);
      if (!el) return false;
      for (; el && el.id !== 'editOverlay'; el = el.parentElement) {
        if (getComputedStyle(el).display === 'none') return false;
      }
      return true;
    };
    const openAs = (who, dayKey, blockId) => {
      if (who === 'parent') { profile = 'parent'; parentViewing = 'jenn'; } else profile = who;
      currentDayKey = dayKey;
      openEditSheet(blockId);
    };
    const btn = (id) => document.getElementById(id) || {};
    try {
      state.shared.invites = [];
      keys.forEach(k => { setDayBlocks(k, [], 'jenn'); setDayBlocks(k, [], 'jess'); });
      const base = { objectives: [], checklistState: {}, gearState: {} };
      const reading = { ...base, id: 'inv1-read', actId: 'reading', startMin: 16 * 60, durationMin: 30 };
      const meetA = { ...base, id: 'inv1-meetA', actId: 'competition', compName: 'Spring Cup', tag: 'skating',
        startMin: COMP_BLOCK_START, durationMin: COMP_BLOCK_DUR };
      const meetB = { ...base, id: 'inv1-meetB', actId: 'competition', compName: 'Autumn Open', tag: 'skating',
        startMin: COMP_BLOCK_START, durationMin: COMP_BLOCK_DUR };
      const watchingBlk = { ...base, id: 'inv1-watching', actId: 'competition', compName: 'Fall Classic',
        watching: true, tag: 'skating', startMin: COMP_BLOCK_START, durationMin: 180 };
      setDayBlocks(wedKey, [reading], 'jenn');
      setDayBlocks(friKey, [watchingBlk], 'jenn');
      setDayBlocks(satKey, [meetA], 'jenn');
      setDayBlocks(sunKey, [meetB], 'jenn');

      // ── A kid sees the share button on an ordinary block; the public toggle stays a parent's.
      openAs('jenn', wedKey, reading.id);
      if (!shown('inviteSisterBtn')) problems.push('a kid does not see 💌 Invite on her own ordinary block — her only way is the Sister Sync screen');
      if (shown('publicToggle')) problems.push('the public toggle is showing for a kid — it is parent-only');
      if (btn('inviteSisterBtn').disabled) problems.push('the share button is disabled before anything was sent');

      // ── Share twice from the edit sheet: one invite, and the second attempt says why.
      const s1 = await attempt(() => inviteSisterFromEdit());
      if (!s1.asked) problems.push('the first share from the edit sheet did not ask first');
      const first = invitesOf(reading.id, 'share');
      if (first.length !== 1) problems.push(`the first share from the edit sheet made ${first.length} invites, not 1`);
      else {
        if (first[0].day !== wedKey) problems.push(`the edit-sheet share was dated ${first[0].day}, not the day being edited (${wedKey})`);
        if (first[0].from !== 'jenn') problems.push(`the edit-sheet share is from "${first[0].from}", not jenn`);
      }
      const src = (getDayBlocks(wedKey, 'jenn') || []).find(b => b.id === reading.id);
      if (!src || !Array.isArray(src.invitedTo) || !src.invitedTo.includes('jess')) {
        problems.push('the 💌 badge stamp (invitedTo) did not land on Jenn’s own block');
      }
      openAs('jenn', wedKey, reading.id);
      if (!btn('inviteSisterBtn').disabled || !/sent/i.test(btn('inviteSisterBtn').textContent || '')) {
        problems.push(`with a share out, the share button reads "${btn('inviteSisterBtn').textContent}" and is ${btn('inviteSisterBtn').disabled ? '' : 'not '}disabled`);
      }
      const s2 = await attempt(() => inviteSisterFromEdit());
      if (invitesOf(reading.id, 'share').length !== 1) problems.push(`sharing twice from the edit sheet made ${invitesOf(reading.id, 'share').length} invites`);
      if (s2.asked) problems.push('the second share asked her to confirm something that should be refused');
      if (!/Jess/.test(s2.toast) || !/answer/i.test(s2.toast)) problems.push(`the second share did not say why: "${s2.toast}"`);

      // ── The Sister Sync tap path refuses it too: one owner, not two.
      profile = 'jenn'; weekOffset = 0; syncDayIdx = 2;
      renderSync();
      const mini = [...document.querySelectorAll('#syncGrid .sync-day-col:first-child .sync-block-mini')]
        .find(el => /Reading/.test(el.textContent || ''));
      if (!mini) problems.push('Sister Sync did not draw Jenn’s Reading block to tap');
      else {
        const s3 = await attempt(() => { mini.click(); });
        if (invitesOf(reading.id, 'share').length !== 1) problems.push('the Sister Sync tap sent a second copy of an invite the edit sheet already sent');
        if (s3.asked) problems.push('the Sister Sync tap asked to confirm a duplicate');
        if (!/Jess/.test(s3.toast)) problems.push(`the Sister Sync tap was refused without saying why: "${s3.toast}"`);
      }

      // ── Share then watch on one meet: both allowed. The watch does not mark the share sent, nor the reverse.
      openAs('jenn', satKey, meetA.id);
      if (!shown('inviteSisterBtn')) problems.push('the share button is hidden on Jenn’s own meet');
      const w1 = await attempt(() => inviteSisterFromEdit());
      if (!w1.asked || invitesOf(meetA.id, 'share').length !== 1) problems.push('sharing her own meet was refused');
      openAs('jenn', satKey, meetA.id);
      if (btn('watchSisterBtn').disabled || /is invited/i.test(btn('watchSisterBtn').textContent || '')) {
        problems.push(`a SHARE marked the watch button sent: "${btn('watchSisterBtn').textContent}"`);
      }
      const w2 = await attempt(() => inviteSisterToWatch());
      if (!w2.asked || invitesOf(meetA.id, 'watch').length !== 1) problems.push('a watch invite was refused because a share of the same meet was out');
      const w3 = await attempt(() => inviteSisterToWatch());
      if (invitesOf(meetA.id, 'watch').length !== 1) problems.push(`inviting her to watch twice made ${invitesOf(meetA.id, 'watch').length} watch invites`);
      if (w3.asked || !/Jess/.test(w3.toast)) problems.push(`the second watch invite was not refused with a reason: "${w3.toast}"`);
      openAs('jenn', satKey, meetA.id);
      if (!btn('watchSisterBtn').disabled || !/Jess is invited to watch/.test(btn('watchSisterBtn').textContent || '')) {
        problems.push(`with a watch invite out, the watch button reads "${btn('watchSisterBtn').textContent}"`);
      }

      // ── Watch then share, from the PARENT portal: allowed, recorded as Jenn's, and kinds kept apart.
      openAs('parent', sunKey, meetB.id);
      if (!shown('inviteSisterBtn')) problems.push('a parent no longer sees the share button');
      if (!shown('publicToggle')) problems.push('a parent no longer sees the public toggle');
      const v1 = await attempt(() => inviteSisterToWatch());
      if (!v1.asked || invitesOf(meetB.id, 'watch').length !== 1) problems.push('a watch invite from the parent portal was not sent');
      openAs('parent', sunKey, meetB.id);
      if (btn('inviteSisterBtn').disabled || /sent/i.test(btn('inviteSisterBtn').textContent || '')) {
        problems.push(`a WATCH invite marked the share button sent: "${btn('inviteSisterBtn').textContent}"`);
      }
      const v2 = await attempt(() => inviteSisterFromEdit());
      const bShare = invitesOf(meetB.id, 'share');
      if (!v2.asked || bShare.length !== 1) problems.push('a share was refused because a watch invite of the same meet was out');
      else if (bShare[0].from !== 'jenn' || bShare[0].day !== sunKey) {
        problems.push(`the parent-portal share is from "${bShare[0].from}" on ${bShare[0].day}, not jenn on ${sunKey}`);
      }
      const srcB = (getDayBlocks(sunKey, 'jenn') || []).find(b => b.id === meetB.id);
      if (!srcB || !(srcB.invitedTo || []).includes('jess')) problems.push('the parent-portal send did not stamp Jenn’s block');

      // ── A watching block: no share button (it would clone her meet onto the competitor's calendar).
      openAs('jenn', friKey, watchingBlk.id);
      if (shown('inviteSisterBtn')) problems.push('the share button shows on a watching block — it would put somebody else’s meet on her calendar as a plain block');
      if (shown('watchSisterBtn')) problems.push('the watch button shows on a watching block');

      // ── Declined can go again.
      profile = 'jess';
      const pendingRead = invitesOf(reading.id, 'share').find(i => i.status === 'pending');
      if (!pendingRead) problems.push('no pending Reading share for Jess to decline');
      else {
        declineInvite(pendingRead.id);
        if (pendingRead.status !== 'declined') problems.push(`declining left the invite "${pendingRead.status}"`);
        openAs('jenn', wedKey, reading.id);
        if (btn('inviteSisterBtn').disabled) problems.push('after a decline the share button still says it was sent');
        const d1 = await attempt(() => inviteSisterFromEdit());
        if (!d1.asked || live(invitesOf(reading.id, 'share')).length !== 1) {
          problems.push('after Jess declined, the share could not be sent again');
        }
      }

      // ── Accepting twice leaves one block; declining an accepted invite changes nothing.
      profile = 'jess';
      const again = live(invitesOf(reading.id, 'share'))[0];
      if (!again) problems.push('no re-sent share for Jess to accept');
      else {
        acceptInvite(again.id);
        acceptInvite(again.id);
        const hers = (getDayBlocks(wedKey, 'jess') || []).filter(b => b.actId === 'reading');
        if (hers.length !== 1) problems.push(`accepting twice put ${hers.length} Reading blocks on Jess’s day`);
        declineInvite(again.id);
        if (again.status !== 'accepted') problems.push(`declining an accepted invite turned it "${again.status}"`);
        if ((getDayBlocks(wedKey, 'jess') || []).filter(b => b.actId === 'reading').length !== hers.length) {
          problems.push('declining an accepted invite changed Jess’s day');
        }
        const a2 = await attempt(() => { profile = 'jenn'; currentDayKey = wedKey; editingBlockId = reading.id; return inviteSisterFromEdit(); });
        if (live(invitesOf(reading.id, 'share')).length !== 1) problems.push('an accepted share could be sent again');
        if (a2.asked || !/plan/i.test(a2.toast)) problems.push(`re-sending an accepted share did not say it is already on her plan: "${a2.toast}"`);
      }
    } catch (e) {
      problems.push('threw: ' + e.message);
    } finally {
      closeSheet('editOverlay');
      state.shared.invites = wasInvites;
      keys.forEach((k, i) => { setDayBlocks(k, savedJenn[i], 'jenn'); setDayBlocks(k, savedJess[i], 'jess'); });
      profile = wasProfile; parentViewing = wasViewing;
      currentDayKey = wasDayKey; weekOffset = wasOffset; syncDayIdx = wasSyncIdx;
    }
    return problems.length ? problems : true;
  });

  /* ── THE SYSTEM DID NOT BEGIN TODAY ───────────────────────────────
     Three stores answered "when did this family start", and every one of them
     SEEDED ITSELF to the current Monday the first time anything read it. On a
     device that first ran a build in September that made every earlier week a
     different kind of week: priced by a retired formula, its competition and
     gift forms absent from the meeting, and out of reach of both the catch-up
     list and the default sweep. "Unset" was being read as "the system began
     today", which is the one thing it cannot mean.

     One store now, DERIVED from the earliest week on file and never written —
     so it costs no sync, cannot be frozen wrong by whichever device looked
     first, and moves back on its own when an older week arrives. */
  if (want('theSystemDidNotBeginToday')) checks.theSystemDidNotBeginToday = await page.evaluate(() => {
    const problems = [];
    profile = 'parent'; ctParentKid = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const c = state.shared.chore;
    const savedProgram = c.programStartDate, savedAt = c.programStartDateAt;
    const savedLedger = c.moneyLedger, savedFin = c.finalizedWeeks;
    try {
      // A household with three months of history and nobody having set a date.
      delete c.programStartDate; delete c.programStartDateAt;
      const back = (n) => {
        const d = formatDayKey(ctThisWeekKey()); d.setDate(d.getDate() - n * 7);
        return ctDateToKey(d);
      };
      c.moneyLedger = {}; c.moneyLedger[back(12)] = { jenn: { net: 5 } };
      c.finalizedWeeks = {}; c.finalizedWeeks[back(12)] = { jenn: 5 };

      const derived = mrStartWeek();
      if (derived !== back(12)) {
        problems.push('derived start is ' + derived + ', not the earliest week on file ' + back(12));
      }
      // Derived, not written: nothing may be stored by having asked.
      if (c.programStartDate) problems.push('asking for the start date wrote one');
      // And the backlog is reachable because of it.
      if (mmCatchUpFloor() !== back(12)) {
        problems.push('the catch-up floor is ' + mmCatchUpFloor() + ', not the start');
      }
      // A parent can still say the family began earlier, and that is stamped —
      // without a stamp a stale device pushes its own idea straight back.
      mnySetStartWeek(back(30));
      if (String(mrStartWeek()) !== back(30)) problems.push('a parent could not set the start date');
      if (!c.programStartDateAt) problems.push('the parent\'s choice was not stamped');
    } catch (e) {
      problems.push('threw: ' + e.message);
    } finally {
      c.programStartDate = savedProgram; c.programStartDateAt = savedAt;
      if (savedProgram === undefined) delete c.programStartDate;
      if (savedAt === undefined) delete c.programStartDateAt;
      c.moneyLedger = savedLedger; c.finalizedWeeks = savedFin;
    }
    return problems.length ? problems : true;
  });

  /* ── A FULL WEEK OF ROUTINES PAYS THE FULL STREAK ─────────────────
     The defect this whole redesign started from, asserted on its own fixture.

     Mon 7 Sep 2026 is Labour Day. Under the held-back rule the money asked for
     three routines on every day of that week, so Monday, Saturday and Sunday
     each wanted an after-school routine no plan contained — the longest clean
     run came to four days instead of seven, and a child who kept every routine
     she was asked for was paid the 3-day step, $1 instead of $3, with her own
     week grid reading 7/7 beside it.

     Seeded rather than assumed: the week has to actually open on a day with no
     school, or the check proves nothing about the case it is named for. */
  if (want('aFullWeekOfRoutinesPaysTheFullStreak')) checks.aFullWeekOfRoutinesPaysTheFullStreak = await page.evaluate(() => {
    const problems = [];
    profile = 'parent'; ctParentKid = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead();
    const kid = 'jenn';
    // Walk back to a week whose Monday is a no-school day — a holiday Monday.
    let wk = null;
    for (let i = 1; i <= 60; i++) {
      const d = formatDayKey(ctThisWeekKey()); d.setDate(d.getDate() - i * 7);
      const key = ctDateToKey(d);
      if (!isSchoolDay(key)) { wk = key; break; }
    }
    if (!wk) return ['no holiday Monday within a year to test on'];
    const keys = mrWeekDayKeys(wk);
    const saved = keys.map(k => (getDayBlocks(k, kid) || []).slice());
    /* The routine marks go back too, not just the blocks. Leaving a week fully
       ticked made `blankPastWeekCanBeMadeUp` fail thirty checks later, because
       `mmToggleAllRoutines` is a TOGGLE and an already-clean day turns OFF. A
       check that leaves state behind is a check that breaks its neighbours. */
    const savedMarks = [];
    for (let d = 0; d < 7; d++) {
      savedMarks.push(CT_SESSIONS.map(sn => !!ctGetMandatory(wk, d, sn, kid)));
    }
    try {
      keys.forEach(k => setDayBlocks(k, [], kid));
      // She keeps every routine each day ASKED her for — nothing more.
      for (let d = 0; d < 7; d++) {
        CT_SESSIONS.forEach(sn => ctSetMandatory(wk, d, sn, kid, false));
        routineSessionsForDay(kid, wk, d).forEach(sn => ctSetMandatory(wk, d, sn, kid, true));
      }
      const streak = mrStreakWeek(wk, kid);
      if (streak.days !== 7) {
        problems.push('a week of kept routines counts ' + streak.days + ' clean days, not 7');
      }
      const top = MR_DEFAULT_RULES.streak.tiers.reduce((a, b) => (b.days > a.days ? b : a));
      if (money2(streak.bonus) !== money2(top.bonus)) {
        problems.push('it pays ' + mnyMoney(streak.bonus) + ', not the top tier ' + mnyMoney(top.bonus));
      }
      // The half that made it invisible: the screen and the money must ask the
      // same question of the same day, on the holiday Monday itself.
      const shown = routineSessionsForDay(kid, wk, 0).length;
      const priced = mrRoutineSessionsFor(wk, kid, 0).length;
      if (shown !== priced) {
        problems.push('on the holiday Monday the screen asks ' + shown + ' and the money asks ' + priced);
      }
    } catch (e) {
      problems.push('threw: ' + e.message);
    } finally {
      keys.forEach((k, i) => setDayBlocks(k, saved[i], kid));
      for (let d = 0; d < 7; d++) {
        CT_SESSIONS.forEach((sn, i) => ctSetMandatory(wk, d, sn, kid, savedMarks[d][i]));
      }
    }
    return problems.length ? problems : true;
  });

  /* ── A WEEK THE RETIRED BRANCH SHORT-CHANGED IS PAID, ONCE ────────
     A competition recorded in a week that settled under the retired formula
     reached the wallet as $0, and `finalizedWeeks[wk][kid] == null` then
     refused to credit it ever again — which is how $21 of prize money came to
     sit in a settled week with no way to collect it.

     The repair re-prices each week under ITS OWN rules, only ever adds, and is
     idempotent, because two devices will each run it and then sync. */
  if (want('aShortChangedWeekIsPaidOnce')) checks.aShortChangedWeekIsPaidOnce = await page.evaluate(() => {
    const problems = [];
    profile = 'parent'; ctParentKid = 'jess'; parentViewing = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', c = state.shared.chore;
    const mon = formatDayKey(ctThisWeekKey()); mon.setDate(mon.getDate() - 21);
    const wk = ctDateToKey(mon);
    const pd = getProfData(kid);
    const savedComp = (pd.competitions || []).slice();
    const savedEvents = (pd.events || []).slice();
    const savedFin = JSON.parse(JSON.stringify(c.finalizedWeeks || {}));
    const savedLed = JSON.parse(JSON.stringify(c.moneyLedger || {}));
    const savedProgram = c.programStartDate;
    try {
      c.programStartDate = wk;
      pd.competitions = [];
      // A real meet in that week, scored at entry — 21 points, $1 a point.
      mrAddCompetition(kid, { dayKey: mrWeekDayKeys(wk)[5], sport: 'swim',
                              name: 'Regional meet', points: 21 });
      const worth = money2(mrWeekBreakdown(wk, kid).net);
      if (!(worth >= 21)) problems.push('the seeded meet is only worth ' + worth);

      // The week as the retired branch left it: settled, and paid nothing.
      if (!c.finalizedWeeks[wk]) c.finalizedWeeks[wk] = {};
      c.finalizedWeeks[wk][kid] = 0;
      if (!c.moneyLedger[wk]) c.moneyLedger[wk] = {};
      c.moneyLedger[wk][kid] = { at: Date.now(), chores: 0, learning: 0, streak: 0,
                                 competition: 0, fines: 0, gross: 0, net: 0 };

      const plan = evRepairPlanFor(kid);
      const row = plan.weeks.find(w => w.wk === wk);
      if (!row) problems.push('the short-changed week is not in the plan');
      else if (money2(row.gap) !== worth) problems.push('the plan offers ' + row.gap + ', not ' + worth);

      const before = mnyCash(kid);
      const streamBefore = evBalance(kid, 'cash');
      evRunRepair();
      const after = mnyCash(kid);
      if (money2(after - before) !== worth) {
        problems.push('the wallet moved ' + money2(after - before) + ', not ' + worth);
      }
      // The frozen ledger has to agree with the wallet, or the money story and
      // the year total keep quoting the figure the retired branch produced.
      const led = c.moneyLedger[wk][kid];
      if (money2(led.competition) !== money2(mrWeekBreakdown(wk, kid).compPaid)) {
        problems.push('the ledger still says competition ' + led.competition);
      }
      if (!led.repricedAt) problems.push('the correction is not on the record');

      // Twice must be once: two devices will each run this and then sync.
      const second = evRunRepair();
      if (second.weeks !== 0) problems.push('running it twice repaired ' + second.weeks + ' more');
      if (mnyCash(kid) !== after) problems.push('running it twice moved the wallet again');
      /* The repair's own movement has to reach the stream. Measured as a DELTA,
         not as absolute agreement: earlier checks in this suite set
         `ensureWallet(kid).cash` by hand to seed a fixture, which no writer can
         mirror, so jess's stream and wallet are already apart by then. What
         matters here is that the repair moved both by the same amount. */
      const streamMoved = money2(evBalance(kid, 'cash') - streamBefore);
      if (streamMoved !== worth) {
        problems.push('the stream recorded ' + streamMoved + ' where the wallet moved ' + worth);
      }
    } catch (e) {
      problems.push('threw: ' + e.message);
    } finally {
      pd.competitions = savedComp;
      pd.events = savedEvents;
      c.finalizedWeeks = savedFin;
      c.moneyLedger = savedLed;
      c.programStartDate = savedProgram;
      if (savedProgram === undefined) delete c.programStartDate;
    }
    return problems.length ? problems : true;
  });

  /* Setting the stream up on a household that already has months of history
     must leave every total EXACTLY as it reads today — it records where money
     went, it does not move any. And running it twice must change nothing,
     because two devices will each run it and then sync. */
  if (want('settingUpTheStreamMovesNoMoney')) checks.settingUpTheStreamMovesNoMoney = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess';
    const pd = getProfData(kid);
    pd.events = [];
    const before = { cash: mnyCash(kid), ready: mnySavedTotal(kid),
                     locked: mnyLockedTotal(kid), invest: mnyInvestedTotal(kid) };

    const plan = evMigrationPlanFor(kid);
    const previewed = plan.rows.length;
    const res = evRunMigration();
    const after = { cash: mnyCash(kid), ready: mnySavedTotal(kid),
                    locked: mnyLockedTotal(kid), invest: mnyInvestedTotal(kid) };

    const problems = [];
    Object.keys(before).forEach(h => {
      if (before[h] !== after[h]) problems.push(h + ' moved: ' + before[h] + ' → ' + after[h]);
    });
    // The whole point: what the stream derives now equals what the app stores.
    evShadowDrift(kid).forEach(d => problems.push('after setting up — ' + d));
    // The preview is what ran, not an estimate of it.
    if (res.written < previewed) {
      problems.push('preview said ' + previewed + ', wrote ' + res.written);
    }
    // Idempotent: a second run has nothing left to do.
    const second = evRunMigration();
    if (second.written !== 0) problems.push('running it twice wrote ' + second.written + ' more');
    evShadowDrift(kid).forEach(d => problems.push('after running twice — ' + d));

    return problems.length ? problems : true;
  });

  // The schedule draws on the POOL, not on her chores. A week where she earned
  // nothing but was given $50 still covers the loan payment — which is what a
  // cash pool means, and the opposite of what tagging inflows would do.
  if (want('giftCanCoverAQuietWeek')) checks.giftCanCoverAQuietWeek = await page.evaluate(() => {
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
  if (want('lockedPlansAndBucketsRefuse')) checks.lockedPlansAndBucketsRefuse = await page.evaluate(() => {
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
  if (want('ruleEditsSaveAsOneChange')) checks.ruleEditsSaveAsOneChange = await page.evaluate(() => {
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
  if (want('debtRenameReachesEverySurface')) checks.debtRenameReachesEverySurface = await page.evaluate(() => {
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
  if (want('settledWeeksAreFrozenTypedOnesAreNot')) checks.settledWeeksAreFrozenTypedOnesAreNot = await page.evaluate(() => {
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
  if (want('moneySchoolGatesAndNames')) checks.moneySchoolGatesAndNames = await page.evaluate(() => {
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
  if (want('priceChangeShowsButDoesNotRestate')) checks.priceChangeShowsButDoesNotRestate = await page.evaluate(() => {
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
  if (want('interestAccruesOnRealDays')) checks.interestAccruesOnRealDays = await page.evaluate(() => {
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
  if (want('lockedMoneyMaturesOnItsDate')) checks.lockedMoneyMaturesOnItsDate = await page.evaluate(() => {
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
  if (want('sharePriceFollowsTheCalendar')) checks.sharePriceFollowsTheCalendar = await page.evaluate(() => {
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
  if (want('passiveIncomeIsCountedAndBaselined')) checks.passiveIncomeIsCountedAndBaselined = await page.evaluate(() => {
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
  if (want('savingGoalEndToEnd')) checks.savingGoalEndToEnd = await page.evaluate(() => {
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

    mmHide();
    pd.savingGoals = [];
    return kidCanCreate && hasBucket && moved && reversed && paceUsable;
  });

  /* ── What money buys ── */

  // "$80" is a word; "dinner out for all of us" is a quantity. The anchor has
  // to read naturally, stay silent when it cannot, and follow the parent's list.
  if (want('buysLineReadsNaturally')) checks.buysLineReadsNaturally = await page.evaluate(() => {
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
  if (want('tabBarOnEveryMoneySurface')) checks.tabBarOnEveryMoneySurface = await page.evaluate(() => {
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
    mmHide();

    // And it navigates: tapping 5 from page 1 lands on Money school.
    mnyOpenMyMoney('jess');
    mnyGoTab('school');
    const navigates = document.getElementById('screen-moneyschool').classList.contains('active');

    /* Findings, not a bare false. Every name below was already computed and
       already meant something, and `return a && b && c` threw all of it away —
       so a failure said only which check broke, and finding out which surface
       had lost its bar cost a whole extra run of this suite. */
    const problems = [];
    if (!onMoney)  problems.push('💰 My money has no five-page bar, or none of its tabs is marked current');
    if (!onStory)  problems.push('🌊 My money story has no five-page bar');
    if (!onSchool) problems.push('🎓 Money school has no five-page bar');
    if (!onRules)  problems.push("the parent's Money rules page is missing its section rail, or does not say which rule version is in effect");
    if (!onEarned) problems.push('the meeting\'s money screen does not carry the bar exactly once — it draws '
      + document.getElementById('familyMeetingBody').querySelectorAll('.mny-tab').length + ' tabs');
    if (!onDecide) problems.push('arriving at the split through the legacy step 4 loses the bar');
    if (!navigates) problems.push('tapping Money school on the bar does not reach it');
    return problems.length ? problems : true;
  });

  // A kid tapping a grown-up's page is told what it is, not silently refused —
  // and is never dropped into a screen she cannot use.
  if (want('kidTabsExplainRatherThanRefuse')) checks.kidTabsExplainRatherThanRefuse = await page.evaluate(() => {
    profile = 'jess';
    mnyOpenMyMoney('jess');
    mnyGoTab('rules');
    const stayedPut = !document.getElementById('screen-parent').classList.contains('active');
    mnyGoTab('grow');
    const noMeeting = !mmIsOpen();
    return stayedPut && noMeeting;
  });

  // Last week's plan, ghosted under this week's — but only once there IS a last
  // week. A ghost of nothing is a puzzle, not a comparison.
  if (want('ghostBarOnlyWithHistory')) checks.ghostBarOnlyWithHistory = await page.evaluate(() => {
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
  if (want('tourOpensPagesAndCloses')) checks.tourOpensPagesAndCloses = await page.evaluate(() => {
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
  if (want('plannerChoreReachesTheQueue')) checks.plannerChoreReachesTheQueue = await page.evaluate(async () => {
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
  if (want('step1GradeReachesStep3')) checks.step1GradeReachesStep3 = await page.evaluate(() => {
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
    // Keyed by kind and key now, never by position — see mmToggleItem.

    const before = mrWeekBreakdown(wk, kid).chorePaid;
    mmToggleItem(kid, 2, 'chore', 'vacuum');         // the tap IS the grading
    const graded = mrGetChoreGrade(kid, wk, 2, 'vacuum') === 3;
    const after = mrWeekBreakdown(wk, kid).chorePaid;

    // Step 3 must show the same figure the grade just produced.
    mnySetMeetKid(kid); mmGoStep(3);
    const shown = document.getElementById('familyMeetingBody').textContent
      .includes(mnyMoney(after));

    mmToggleItem(kid, 2, 'chore', 'vacuum');         // and it is reversible
    const ungraded = mrGetChoreGrade(kid, wk, 2, 'vacuum') === 0;

    mmHide();
    setDayBlocks(dayKey, [], kid);
    return bothKinds && graded && after > before && shown && ungraded;
  });

  // Typing into the meeting must not throw the caret away on every letter.
  if (want('meetingKeepsFocusAndScroll')) checks.meetingKeepsFocusAndScroll = await page.evaluate(() => {
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
    mmHide();
    return keptWhileTyping && restored && draftKept;
  });

  // Tabs 4 and 5 were dead inside the meeting: the delegated handler was only
  // bound to the standalone money pages.
  if (want('moneyTabsWorkInsideTheMeeting')) checks.moneyTabsWorkInsideTheMeeting = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead(); openFamilyMeeting(); mmGoStep(3);
    const tab = document.querySelector('#familyMeetingBody [data-mny-action="tab"][data-mny-tab="school"]');
    if (!tab) return false;
    tab.click();
    const landed = document.getElementById('screen-moneyschool').classList.contains('active');
    mmHide();
    return landed;
  });

  // Paying less than the schedule frees money now and costs arrears later. It
  // must never quietly forgive the difference.
  if (want('loanPaymentIsArguableNotForgiven')) checks.loanPaymentIsArguableNotForgiven = await page.evaluate(() => {
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
  if (want('spendingIsAnOptionAndCapped')) checks.spendingIsAnOptionAndCapped = await page.evaluate(() => {
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
  if (want('oneCurrentWeekEverywhere')) checks.oneCurrentWeekEverywhere = await page.evaluate(() => {
    const planner = dateToLocalKey(getWeekStart(0));
    return ctThisWeekKey() === planner
        && mnyWeekKey() === (ctWeekKey || planner);
  });

  /* ══════════════════════════════════════════════════════════════
     ROUND 2 — the places the flow was leaking. Each of these fails
     silently in the app: every screen still renders, the record just
     stops being true.
     ══════════════════════════════════════════════════════════════ */

  // The week is only recorded when BOTH kids are settled, so the last step has
  // to say when one isn't rather than offering a celebration.
  if (want('meetingWontCelebrateHalfDone')) checks.meetingWontCelebrateHalfDone = await page.evaluate(() => {
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
    mmHide();
    return neitherDone && namesJenn && jessTicks && notHeld && noCelebration;
  });

  // An override wins, but the grades behind it must stop claiming to decide
  // anything — on BOTH surfaces that still show them.
  if (want('overrideIsFlaggedWhereverGradesShow')) checks.overrideIsFlaggedWhereverGradesShow = await page.evaluate(() => {
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
    mmHide();

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
  if (want('unplannedChoreIsClaimable')) checks.unplannedChoreIsClaimable = await page.evaluate(async () => {
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
  if (want('kidSeesWaitingAndAnswered')) checks.kidSeesWaitingAndAnswered = await page.evaluate(() => {
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
  if (want('trainingChecksScaleWithTheBlock')) checks.trainingChecksScaleWithTheBlock = await page.evaluate(() => {
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
  if (want('thereIsExactlyOneListOfToday')) checks.thereIsExactlyOneListOfToday = await page.evaluate(() => {
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
       and nowhere else in the document.

       EXCEPT THE RUNNING ONE, which is in the hero and deliberately nowhere
       else (theHeroIsTheOnlyPlaceTheRunningBlockAppears, below). This counted a
       flat 2 and so FAILED for an hour and a half every day — whenever the
       browser's own clock sat inside 7:00–7:30 or 16:00–17:00, which is where
       these two fixtures are pinned. A check that passes or fails by the time
       of day is the `|| break` bug in another costume: it reports a defect that
       is not there, and it reports nothing at all the rest of the time. So the
       expected count is derived from the clock rather than written down, and
       the hero is asserted to hold exactly what the list is missing. */
    if (!tdEarlierOpen()) tdToggleEarlier();
    if (!tdLaterOpen()) tdToggleLater();
    const now = tdNowMin();
    const seeded = (getDayBlocks(key, 'jenn') || []);
    const running = seeded.filter(b => now >= b.startMin && now < b.startMin + (b.durationMin || 0));
    const sel = '.quest-card:not(.quest-card--free)';
    const here = document.querySelectorAll('#tdWrap ' + sel).length;
    const wantListed = 2 - running.length;
    if (here !== wantListed) {
      bad.push(`Today lists ${here} of ${wantListed} blocks`
        + (running.length ? ` (${running.length} running, so in the hero)` : ''));
    }
    const hero = document.querySelector('#tdWrap .td-now');
    if (!hero) bad.push('Today draws no NOW card');
    else running.forEach(b => {
      const act = findActivity(b.actId, 'jenn');
      const nm = act && blockDisplayName(b, 'jenn').name;
      if (nm && !hero.textContent.includes(nm)) {
        bad.push(`${nm} is running but the hero does not name it`);
      }
    });
    const everywhere = document.querySelectorAll(sel).length;
    if (everywhere !== here) bad.push(`quest cards render in ${everywhere - here} other place(s)`);
    tdToggleEarlier();
    tdToggleLater();
    setDayBlocks(key, [], 'jenn');
    return bad.length === 0 || bad;
  });

  // "Before we start" is a pre-flight list; it used to render after the week
  // had already been agreed.
  if (want('readinessListComesBeforeTheReview')) checks.readinessListComesBeforeTheReview = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess';
    ctPrepareRead();
    openFamilyMeeting(); mmGoStep(1);
    const onStep1 = document.getElementById('familyMeetingBody').textContent
      .includes('Before we start');
    mmGoStep(4);
    const offStep4 = !document.getElementById('familyMeetingBody').textContent
      .includes('Before we start');
    mmHide();
    return onStep1 && offStep4;
  });

  /* The seed-version rule, tested on purpose rather than by luck.

     priceChangeShowsButDoesNotRestate only reaches this code path when
     programStartDate happens to equal today — i.e. on the day the programme
     starts, which in a fresh smoke run means Mondays. That is how the bug it
     guards survived: six days a week the test agreed with a broken build. This
     one builds the precondition explicitly, so it fails every day or none. */
  if (want('earliestRuleVersionIsNeverRewritten')) checks.earliestRuleVersionIsNeverRewritten = await page.evaluate(() => {
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

  /* THE BADGE THAT SAYS IT IS A BUTTON AND IS NOT ONE. Three of the five
     profile badges were bare <div>s with no handler — Today, the chore tab and
     Sister Sync — while the week's and the day's were real buttons calling
     openProfileSwitcher(). Worse than merely inert: js/99-main.js labels EVERY
     .profile-badge `aria-label="Open profile selector"` with no [onclick]
     filter, while the role/keyboard pass beside it does filter — and
     css/app.css gives them cursor:pointer and a 44px box. So the app announced
     a control to a screen reader, drew one, sized one for a thumb, and then did
     nothing when it was pressed.

     Asserted by ACTIVATING it, never by reading its markup: a badge can carry
     every attribute on the list and still open nothing.

     Arm 2 is about the other half — a lock that can be applied and never
     lifted is the same defect wearing a different hat. */
  if (want('everyProfileBadgeSwitchesProfile')) checks.everyProfileBadgeSwitchesProfile = await page.evaluate(() => {
    const problems = [];
    const wasProfile = profile, wasViewing = parentViewing, wasParentKid = ctParentKid;
    const wasOffset = weekOffset, wasSyncDay = syncDayIdx, wasDayKey = currentDayKey;
    const wasReturn = mmReturn;
    try {
      const overlay = () => document.getElementById('profileSwitchOverlay');
      const shown = (el) => {
        if (!el || el.hidden) return false;
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };

      /* ── Arm 1: every badge is a control, and it opens the switcher ── */
      const screens = [
        ['Today',       'todayProfileBadge', () => goToday()],
        ['the week',    'weekProfileBadge',  () => { goWeek(); renderWeek(); }],
        ['the day',     'dayProfileBadge',   () => openDay(getDayKeys(weekOffset)[0], 0)],
        ['the chores',  'choreProfileBadge', () => openChoreTab()],
        ['Sister Sync', 'syncProfileBadge',  () => openSisterSync()],
      ];
      for (const [label, id, nav] of screens) {
        profile = 'jenn';
        nav();
        const badge = document.getElementById(id);
        if (!badge) { problems.push(`${label}: #${id} is not in the document`); continue; }
        if (!shown(badge)) {
          problems.push(`${label}: the profile badge #${id} is not visible, so a child cannot reach the switcher from this screen`);
          continue;
        }
        const tag = (badge.tagName || '').toLowerCase();
        const hasClickPath = tag === 'button' || badge.hasAttribute('onclick')
          || (badge.getAttribute('role') === 'button' && badge.hasAttribute('tabindex'));
        if (!hasClickPath) {
          problems.push(`${label}: the profile badge #${id} is a <${tag}> with no onclick and no role=button + tabindex — it is announced and styled as a control with no way to press it`);
        }
        closeSheet('profileSwitchOverlay');
        badge.click();
        if (!overlay().classList.contains('open')) {
          problems.push(`${label}: tapping the profile badge #${id} did not open the profile switcher`);
        }
        closeSheet('profileSwitchOverlay');
      }

      /* And nothing is ANNOUNCED as a control that is not one. The aria pass in
         js/99-main.js used to label every .profile-badge with no [onclick]
         filter, so a screen reader was told three <div>s opened the profile
         selector. That is the half of this defect a sighted test cannot see. */
      const lying = [...document.querySelectorAll('.profile-badge')].filter(b => {
        const tag = (b.tagName || '').toLowerCase();
        const isControl = tag === 'button' || tag === 'a'
          || b.hasAttribute('onclick') || b.getAttribute('role') === 'button';
        return !isControl && b.hasAttribute('aria-label');
      }).map(b => '#' + (b.id || '(unnamed)'));
      if (lying.length) {
        problems.push(`${lying.join(', ')} carries an aria-label but has no click path — announced to a screen reader as a control that does nothing`);
      }

      /* ── Arm 2: the meeting lock ENGAGES, and then it lets go ──
         applyMeetingLock hides the switchers a parent must not press mid-
         sitting. Two things were wrong. It swept the whole document, so a
         sitting on the week screen hid the badge on Today, the chore tab and
         Sister Sync as well. And `locked` was mmHasReturn() alone while both
         call sites sat inside `if (isParent())`, so nothing ever ran it with
         locked === false: start a meeting, look at the week, switch to a kid,
         and the switcher was gone for the rest of the session — a kid's own
         renderWeek() would have re-hidden it anyway, because locked ignored
         who was asking. mmClearReturn() only nulls the variable; it un-hides
         nothing.

         The state is set directly rather than through mmCaptureReturn, which
         commits a reflection draft as a side effect.

         The release is checked on the screens a child actually reaches, in the
         order she reaches them — switch, land on Today, then open the week and
         the day. A badge on a screen nobody has rendered is not a control
         anybody can be denied; a badge still hidden after its own screen has
         been drawn is. */
      profile = 'parent'; parentViewing = 'jenn'; ctParentKid = 'jenn';
      mmReturn = { source: 'weekly-meeting', weekKey: ctThisWeekKey(), step: 1,
                   child: 'jenn', selectedDay: 0, scrollTop: 0 };
      if (!mmHasReturn()) {
        problems.push('the meeting-return state could not be set, so the lock on the profile badges cannot be tested');
      } else {
        const hiddenNow = () => [...document.querySelectorAll('.profile-badge')]
          .filter(b => b.hidden).map(b => '#' + (b.id || '(unnamed)'));

        // It has to engage, or there is nothing to release.
        goWeek(); renderWeek();
        const locked = hiddenNow();
        if (!locked.includes('#weekProfileBadge')) {
          problems.push('a waiting meeting did not hide the week profile switcher — a parent can press it and silently lose the sitting');
        }
        // …and only the two switchers the lock is about.
        const overreach = locked.filter(id => id !== '#weekProfileBadge' && id !== '#dayProfileBadge');
        if (overreach.length) {
          problems.push(`a meeting on the week screen also hid ${overreach.join(', ')} — the lock is about the week and day switchers, not every badge in the app`);
        }

        // Switch to a kid, the way selectProfile does it: land on Today.
        profile = 'jenn';
        goToday();
        const onToday = hiddenNow().filter(id => id === '#todayProfileBadge');
        if (onToday.length) {
          problems.push('a child landing on Today after a meeting has no profile switcher — the lock reached a screen it is not about');
        }
        // Then the two screens the lock IS about.
        goWeek(); renderWeek();
        openDay(getDayKeys(weekOffset)[0], 0);
        const stuck = hiddenNow();
        if (stuck.length) {
          problems.push(`a meeting left ${stuck.join(', ')} hidden for a child after her own screens were drawn — the lock is applied and never lifted, so the switcher does not come back`);
        }
      }
    } finally {
      mmReturn = wasReturn;
      profile = wasProfile; parentViewing = wasViewing; ctParentKid = wasParentKid;
      weekOffset = wasOffset; syncDayIdx = wasSyncDay; currentDayKey = wasDayKey;
      closeSheet('profileSwitchOverlay');
      document.querySelectorAll('.profile-badge').forEach(b => { b.hidden = false; });
      document.body.classList.remove('meeting-return-pending');
      goToday();
    }
    return problems.length ? problems : true;
  });

  // The one-line wirings behind the new affordances — each is a place a tap
  // can silently stop going anywhere.
  if (want('newAffordancesActuallyNavigate')) checks.newAffordancesActuallyNavigate = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess'; parentViewing = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey;
    const e = mrEnsureEarnings(kid, wk);
    e.chores = {}; e.claims = {}; e.overrides = {};

    // "See the change" on the override notice → step 3, that row expanded.
    mrSetChoreGrade(kid, wk, 2, 'vacuum', 3);
    mnySetOverride(kid, wk, 'chores', 99, 'graded_wrong');
    mnyShowTheChange(kid, 'chores');
    /* By ID, not by position. `mmStep === 3` meant "what I earned" while the
       meeting had five steps and meant "Close" the moment it had three — the
       same defect the app's own MM_LEGACY_STEP exists to stop. */
    const toTheChange = mmStepId() === 'money' && mnyExpandRow === 'chores';
    mmHide();
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

    /* Findings, not a bare false: three unrelated affordances in one check, and
       "false" named none of them. */
    const problems = [];
    if (!toTheChange) problems.push('"See the change" on an override notice does not reach the money screen with that row open — landed on '
      + mmStepId() + ', row ' + String(mnyExpandRow));
    if (!toWaiting) problems.push('her "waiting for Mom" chip does not jump to the first day something is waiting on — landed on day ' + ctDay + ', not 4');
    if (!toSheet) problems.push('the training chip on a short block does not open the sheet with all four checks on it');
    return problems.length ? problems : true;
  });

  // ── Durability (Branch 1) ────────────────────────────────────────────────
  // The old export copied only the chore slices, so a "backup" silently left
  // out every week, goal and progress record — the whole planner. These checks
  // exist because that failure is invisible: the file downloads, it is valid
  // JSON, and it looks like a backup right up until someone needs it.
  if (want('fullBackupCarriesTheWholePlanner')) checks.fullBackupCarriesTheWholePlanner = await page.evaluate(() => {
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
    /* dataEpoch MUST differ, and that is the point of it: a Replace increments
       it so every other device takes the restore whole instead of merging its
       own newer-stamped records back over the top. A restore that left the
       epoch alone would be the bug. */
    const RECOMPUTED = new Set(['streakFreezeWeek', 'streakFreezeTokens', 'unlockedThisWeek',
                                'dataEpoch']);
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

    if (want('restoreBringsBackWhatWasLost')) checks.restoreBringsBackWhatWasLost = problems.length === 0 || problems;
  }

  // ctExportBackup also writes a .json with a top-level `profiles` key, but
  // each profile there holds only the chore slice. Importing one as a full
  // restore would swap real planner profiles for chore fragments, so it has to
  // be named and refused rather than half-applied.
  if (want('choreOnlyFileIsRefusedNotHalfApplied')) checks.choreOnlyFileIsRefusedNotHalfApplied = await page.evaluate(() => {
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
  if (want('rapidEditsCoalesceIntoOneWrite')) checks.rapidEditsCoalesceIntoOneWrite = await page.evaluate(async () => {
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
  if (want('cloudSizeWarnsBeforeTheCeiling')) checks.cloudSizeWarnsBeforeTheCeiling = await page.evaluate(() => {
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
  if (want('aBigStateActuallyTripsTheWarning')) checks.aBigStateActuallyTripsTheWarning = await page.evaluate(async () => {
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
  if (want('backupTabIsUsable')) checks.backupTabIsUsable = await page.evaluate(() => {
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
  if (want('escapingMatchesTheDomReference')) checks.escapingMatchesTheDomReference = await page.evaluate(() => {
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

    /* The week and its print preview both render user text and both must be
       proved. They need different proofs: the Full view prints the whole name,
       but the print sheet truncates a long title to the height of its block —
       so demanding the entire payload there would fail on a surface that is
       behaving correctly. For that one the proof of render is that a block
       element exists at all; the assertions that matter — no <img> built, no
       onerror fired — are identical. */
    const SURFACES = [
      ['week',         () => { goWeek(); setWeekView('full'); }, true],
      ['week-preview', () => { goWeek(); setWeekView('preview'); }, false],
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
          // The print sheet truncates by height; a rendered block title is the
          // proof that this surface drew the hostile block at all.
          rendered: !!document.querySelector('.print-block-title'),
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
    if (want('escapingHoldsOnEverySurface')) checks.escapingHoldsOnEverySurface = problems.length === 0 || problems;
  }

  // Reference material is allowed to be long only because it starts collapsed —
  // which is a promise that it is still one tap away, and that the choice sticks.
  // The word budget alone would be satisfied by content that is simply unreachable.
  if (want('collapsedReferenceIsOneTapAway')) checks.collapsedReferenceIsOneTapAway = await page.evaluate(async () => {
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
  if (want('hostileNamesCannotBecomeCode')) checks.hostileNamesCannotBecomeCode = await page.evaluate(async () => {
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
  if (want('stampsUseServerCorrectedTime')) checks.stampsUseServerCorrectedTime = await page.evaluate(() => {
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
      /* The shell is cached by sw.js, network-first with the cache as the
         fallback — so being online always gets the deployed code, and offline
         gets the shell. Prove all three: the worker registers, the shell is in
         its cache, and the page comes back with the network off. */
      const sw = await httpPage.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return { err: 'no serviceWorker API in this browser' };
        const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 8000))]);
        if (!reg) return { err: 'the worker never became ready' };
        let name = null, cache = null;
        for (let i = 0; i < 100 && !cache; i++) {
          name = (await caches.keys()).find(k => k.startsWith('wp-shell-'));
          if (name) { const c = await caches.open(name); if (await c.match('./js/99-main.js')) cache = c; }
          if (!cache) await new Promise(r => setTimeout(r, 100));
        }
        if (!cache) return { err: 'no wp-shell cache holding the scripts' };
        const missing = [];
        for (const u of ['./index.html', './manifest.json', './css/app.css', './js/01-config.js', './js/99-main.js', './assets/icons/icon-192.png']) {
          if (!(await cache.match(u))) missing.push(u);
        }
        return { name, missing };
      });
      if (sw.err) problems.push(sw.err);
      else if (sw.missing.length) problems.push(`shell files not cached: ${sw.missing.join(', ')}`);
      if (!sw.err) {
        await httpPage.reload();                       // now controlled by the worker
        await httpPage.context().setOffline(true);
        try {
          const off = await httpPage.goto(`http://127.0.0.1:${port}/index.html`);
          if (!off || !off.ok()) problems.push('offline, the page did not come back from the cache');
          const booted = await httpPage.evaluate(() => typeof showScreen === 'function' && !!document.getElementById('screen-today'));
          if (!booted) problems.push('offline, the shell loaded but the app did not boot');
        } catch (e) {
          problems.push(`offline navigation failed: ${e.message.split('\n')[0]}`);
        }
        await httpPage.context().setOffline(false);
        await httpPage.evaluate(async () => {
          for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
          for (const k of await caches.keys()) await caches.delete(k);
        });
      }
      await httpPage.close();
    } finally {
      server.close();
    }
    if (want('installsToTheHomeScreen')) checks.installsToTheHomeScreen = problems.length === 0 || problems;
  }

  // ── Today (Branch 4) ─────────────────────────────────────────────────────
  // The whole claim of this screen is that a child can answer "what now?" and
  // act on it without entering the planner. So: does it name the current thing,
  // and does a tap reach the place that owns the action?
  if (want('todayAnswersWhatNow')) checks.todayAnswersWhatNow = await page.evaluate(() => {
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
  if (want('todayLeadsWithWhatIsNext')) checks.todayLeadsWithWhatIsNext = await page.evaluate(() => {
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
  if (want('todayShowsThreeThingsAndFoldsTheRest')) checks.todayShowsThreeThingsAndFoldsTheRest = await page.evaluate(() => {
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
  if (want('todayNamesFreeTime')) checks.todayNamesFreeTime = await page.evaluate(() => {
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
  if (want('todayTellsHerWhenToStartMoving')) checks.todayTellsHerWhenToStartMoving = await page.evaluate(() => {
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
  if (want('familyChoreFloorIsFlaggedWhileItCanBeFixed')) checks.familyChoreFloorIsFlaggedWhileItCanBeFixed = await page.evaluate(() => {
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
      goWeek(); setWeekView('full'); renderWeek();
      const banner = document.getElementById('weekFamilyBanner');
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
      if (document.getElementById('weekFamilyBanner').style.display !== 'none') {
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
      if (document.getElementById('weekFamilyBanner').style.display !== 'none') {
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
  if (want('familyChoreFlagIsForwardLookingNotBlame')) checks.familyChoreFlagIsForwardLookingNotBlame = await page.evaluate(() => {
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
      goWeek(); setWeekView('full'); renderWeek();
      goToday();
      const chip = document.querySelector('#tdWrap .td-chip-family');
      const banner = document.getElementById('weekFamilyBanner');
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
  if (want('todayKnowsWhenTheDayIsOver')) checks.todayKnowsWhenTheDayIsOver = await page.evaluate(() => {
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
  if (want('jobsCardIsNeverBlank')) checks.jobsCardIsNeverBlank = await page.evaluate(() => {
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
  if (want('todayMoneyChartMatchesTheAccessors')) checks.todayMoneyChartMatchesTheAccessors = await page.evaluate(() => {
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
  if (want('todayHandsOffRatherThanActing')) checks.todayHandsOffRatherThanActing = await page.evaluate(() => {
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
  if (want('todayAgreesWithTheChoreScreen')) checks.todayAgreesWithTheChoreScreen = await page.evaluate(() => {
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
  /* The clock passing is not the same fact as having done it.

     tdCurrentAndNext is driven entirely by tdNowMin: once the last block's
     window closes, `current` and `next` are both null whatever was actually
     ticked. Three pieces of copy hung off that and read as reassurance —
     "Everything on today is done. That is the whole day.", "the rest of today
     is yours", and the quiet-hours "nothing left tonight" — while the hero
     four centimetres above printed a real 2/8 counted through isBlockCompleted.
     Two numbers on one screen, disagreeing, and the cheerful one was wrong.

     This seeds a day whose blocks have all elapsed and NONE of which were
     ticked, then ticks them. */
  /* Two devices saved different versions of one record, and a grown-up decides.

     The merge layer settles what is DISPLAYED by the stamp, because something
     has to be on screen and the girls must never be shown a warning about a
     sync. But a stamp orders two writes and says nothing about which one holds
     the better information, so the loser is kept and this is where it is
     chosen between. What this drives is the real panel and the real writer —
     cfChoose, not a hand-written flag. */
  if (want('aConflictIsAParentsToDecideNotTheClocks')) checks.aConflictIsAParentsToDecideNotTheClocks = await page.evaluate(async () => {
    const bad = [];
    profile = 'parent'; parentViewing = 'jenn';
    ctEnsureShared();
    const wk = ctThisWeekKey();
    const older = { opId: 'ipad-2',  baseOpId: 'seed-1', updatedAt: 200, wentWell: ['swimming'] };
    const newer = { opId: 'phone-2', baseOpId: 'seed-1', updatedAt: 300, wentWell: ['reading'] };
    // What the merge would have left behind, recorded the way mergeWholeRecord
    // records it — both versions, and which one went on screen.
    state.shared.chore.reflections = state.shared.chore.reflections || {};
    state.shared.chore.reflections[wk] = { jenn: JSON.parse(JSON.stringify(newer)) };
    state.shared.conflicts = [{
      id: conflictId('reflections', wk + '/jenn', 'ipad-2', 'phone-2'),
      store: 'reflections', key: wk + '/jenn',
      at: Date.now(), updatedAt: Date.now(), shownOpId: 'phone-2',
      versions: [JSON.parse(JSON.stringify(older)), JSON.parse(JSON.stringify(newer))],
    }];

    if (openConflicts().length !== 1) bad.push('the open conflict was not counted');

    // On screen for real: the 44px measurement below reads a live rect, and a
    // hidden panel measures zero.
    showScreen('parent');
    // The banner has to find a grown-up rather than wait to be looked for, so
    // it is drawn on whichever parent panel is open.
    setParentTab('now');
    const banner = document.getElementById('parentConflictBanner');
    if (!banner || banner.hidden) bad.push('no banner on the parent portal');
    else if (!/different versions/.test(banner.textContent)) {
      bad.push('banner does not say what happened: ' + banner.textContent.trim());
    }

    // The panel offers both, and marks which is on screen without favouring it.
    setParentTab('conflicts');
    const cards = [...document.querySelectorAll('#cfWrap .cf-version')];
    if (cards.length !== 2) bad.push(`expected 2 versions offered, got ${cards.length}`);
    const shownTags = [...document.querySelectorAll('#cfWrap .cf-version--shown')];
    if (shownTags.length !== 1) bad.push('exactly one version should be marked as showing');
    const text = (document.getElementById('cfWrap') || {}).textContent || '';
    if (!/swimming/.test(text) || !/reading/.test(text)) {
      bad.push('both versions must be legible, got: ' + text.slice(0, 200));
    }
    // Every pick button clears the house 44px floor — a parent surface, but the
    // floor is about thumbs, not about which screen.
    const picks = [...document.querySelectorAll('#cfWrap [data-cf-pick]')];
    if (picks.length !== 2) bad.push(`expected 2 pick buttons, got ${picks.length}`);
    picks.forEach((b, i) => {
      const r = b.getBoundingClientRect();
      if (r.height < 44) bad.push(`pick button ${i} is ${Math.round(r.height)}px tall`);
    });

    // Choose the OLDER one. That is the whole point: newer is not right.
    const olderBtn = picks.find(b => b.closest('.cf-version').textContent.includes('swimming'));
    if (!olderBtn) { bad.push('could not find the older version to keep'); return bad; }
    olderBtn.click();

    const kept = state.shared.chore.reflections[wk].jenn;
    if (!kept || kept.wentWell[0] !== 'swimming') {
      bad.push('the chosen version was not written back: ' + JSON.stringify(kept));
    }
    // Ancestry is the version that was ON SCREEN, not the one chosen — or the
    // other device raises a second conflict about a settled question.
    if (kept.baseOpId !== 'phone-2') bad.push('resolution does not descend from what was displayed');
    if (!kept.opId || kept.opId === 'ipad-2') bad.push('the resolution is not a new version');
    if (openConflicts().length !== 0) bad.push('the row is still open after choosing');
    const bannerAfter = document.getElementById('parentConflictBanner');
    if (bannerAfter && !bannerAfter.hidden) bad.push('the banner outlived the decision');

    state.shared.conflicts = [];
    return bad.length ? bad : true;
  });

  if (want('todayDoesNotCallAnUntickedDayDone')) checks.todayDoesNotCallAnUntickedDayDone = await page.evaluate(async () => {
    profile = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const key = todayKey();
    const bad = [];
    const now = tdNowMin();
    // Before about half past midnight nothing can have elapsed yet, and an
    // empty-so-far day is a real answer rather than the case under test.
    if (now <= 35) return true;
    const s1 = Math.max(0, now - 180);
    const s2 = Math.max(0, now - 120);
    setDayBlocks(key, [
      { id: 'td-open1', actId: 'piano',     startMin: s1, durationMin: 30 },
      { id: 'td-open2', actId: 'breakfast', startMin: s2, durationMin: 30 },
    ], 'jenn');

    const before = tdCurrentAndNext('jenn');
    if (before.current || before.next) bad.push('fixture blocks have not all elapsed');
    if (before.openCount !== 2) bad.push('expected 2 open blocks, got ' + before.openCount);
    // The one claim that must hold whichever branch of tdEncouragement fires
    // (a pending grade outranks the block lines, and other checks leave some).
    if (/Everything on today is done/.test(tdEncouragement('jenn'))) {
      bad.push('called a wholly unticked day done');
    }

    tdRenderToday();
    const heroBefore = (document.querySelector('#tdWrap .td-now-head') || {}).textContent || '';
    if (/the rest of today is yours/.test(heroBefore)) bad.push('hero handed her a day she has not finished');
    if (!/still open|to tick/.test(heroBefore)) bad.push('hero does not say what is open: ' + heroBefore.trim());

    // Tick both through the owner rather than by writing the flag. completeQuest
    // takes (blockId, dayKey) — the child comes from the active profile.
    const keyBefore = tdTickKey('jenn');
    completeQuest('td-open1', key);
    completeQuest('td-open2', key);
    const after = tdCurrentAndNext('jenn');
    if (after.openCount !== 0) bad.push('ticking did not close them, openCount ' + after.openCount);
    // The minute-tick cache has to notice, or the hero keeps the stale count.
    if (tdTickKey('jenn') === keyBefore) bad.push('the tick key did not move, so a tick would not repaint');

    tdRenderToday();
    const heroAfter = (document.querySelector('#tdWrap .td-now-head') || {}).textContent || '';
    if (/still open/.test(heroAfter)) bad.push('hero still claims something is open: ' + heroAfter.trim());

    return bad.length ? bad : true;
  });

  if (want('todayIsWhereTheDayGetsDone')) checks.todayIsWhereTheDayGetsDone = await page.evaluate(async () => {
    profile = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const key = todayKey();
    const bad = [];
    /* Both windows are placed relative to NOW, and neither can contain it.

       They used to be fixed at 3pm and 7am, which made this a check that passed
       twenty-three hours a day: run it between 3 and 4 in the afternoon and the
       piano block is the RUNNING one, the hero owns it, and it is deliberately
       absent from the list below (theHeroIsTheOnlyPlaceTheRunningBlockAppears
       holds that on purpose) — so the count came to 1 and this failed. A test
       that reports a problem by the hour of day is the same shape as the ones
       CLAUDE.md already records: it cannot be trusted either way. */
    const now = tdNowMin();
    const q1Start = Math.min(now + 60, 1380);                              // always ahead
    const q2Start = now >= 150 ? now - 150 : Math.min(now + 150, 1380);    // never running
    setDayBlocks(key, [
      { id: 'td-q1', actId: 'piano',      startMin: q1Start, durationMin: 60 },
      { id: 'td-q2', actId: 'breakfast',  startMin: q2Start, durationMin: 30 },
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
    const wantQ1 = formatTimeFromMin(q1Start), wantQ2 = formatTimeFromMin(q2Start);
    if (!times.includes(wantQ1) || !times.includes(wantQ2)) {
      bad.push(`the day is not fully listed: want ${wantQ2} and ${wantQ1}, got ${times.join(', ')}`);
    }

    /* 🎯 completes through the owning path: block marked done AND XP moved.

       Blasted on the PIANO block, not the breakfast one. XP is priced by what
       the time is for now, and a meal is deliberately worth nothing — so
       blasting breakfast would prove only that meals earn nothing, which is a
       different check's job (dailyBlocksEarnNoXp). What this one is for is that
       the tick routes through completeQuest rather than writing a flag itself,
       and for that it needs a block that actually earns. */
    const xpBefore = getQuestXP('jenn');
    const readBlock = () => (getDayBlocks(key, 'jenn') || []).find(b => b.id === 'td-q1');
    const blast = document.querySelector('#tdWrap [data-td-action="blast"][data-td-block="td-q1"]');
    const before = readBlock();
    if (!blast) { bad.push('no 🎯 on a quest card'); }
    else if (!before) { bad.push('the block this check blasts is not on the day'); }
    else if (before.completed) {
      /* Named rather than silently tolerated. If something earlier in the suite
         left this block done, the assertions below would pass without the tap
         proving anything — which is the shape CLAUDE.md keeps recording. */
      bad.push('td-q1 was already completed before the tap, so the tap proves nothing');
    } else {
      const card = blast.closest('.quest-card');
      blast.click();
      /* WAIT FOR THE CONDITION, NOT FOR A DURATION. This was a flat 900ms
         against a chain that costs 540 (projectile 300, burst 240) — fine on a
         laptop, and it went red on a CI runner while passing locally. A test
         that reports a problem according to how busy the machine is cannot be
         trusted either way: it is the same shape as the fixed 3pm window this
         check's own comment above already had to fix.

         Polling is not a weaker assertion. It still fails if the completion
         never lands; it only stops failing when the completion is merely late,
         and it says WHICH of those happened. */
      let waited = 0;
      while (waited < 5000 && !(readBlock() || {}).completed) {
        await new Promise(r => setTimeout(r, 50));
        waited += 50;
      }
      const blk = readBlock();
      if (!blk || !blk.completed) {
        /* blastQuest's one silent no-op is a card already carrying
           `quest-blasting` — it returns without completing. Say so, because
           "did not complete" on its own sent a previous investigation looking
           at timing when the cause may be a stuck class from an earlier tap. */
        bad.push('🎯 did not complete the block after ' + waited + 'ms · card classes: '
          + (card ? card.className : 'no card') );
      }
      if (getQuestXP('jenn') <= xpBefore) {
        bad.push('🎯 completed without awarding XP (' + xpBefore + ' → ' + getQuestXP('jenn') + ')');
      }
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
  if (want('todayIsTheFrontDoor')) checks.todayIsTheFrontDoor = await page.evaluate(async () => {
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
  if (want('kidNavIsUsableAndScoped')) checks.kidNavIsUsableAndScoped = await page.evaluate(() => {
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
  if (want('navReachesEverythingAndOldRoutesStillWork')) checks.navReachesEverythingAndOldRoutesStillWork = await page.evaluate(() => {
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
  if (want('onePoolReadsTheSameOnEveryScreen')) checks.onePoolReadsTheSameOnEveryScreen = await page.evaluate(() => {
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
    mmHide();

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
  if (want('blankPastWeekCanBeMadeUp')) checks.blankPastWeekCanBeMadeUp = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jenn', c = state.shared.chore;
    const startBefore = c.programStartDate;
    const mon = formatDayKey(ctThisWeekKey()); mon.setDate(mon.getDate() - 14);
    const past = ctDateToKey(mon);
    // The family's record has to reach the week, or it is before they began.
    c.programStartDate = past;
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

    /* Routines are reconstructable too — and they must stay out of the chore
       channel, feeding the streak instead.

       "Every routine the day ASKED for", not "all three": a blank week plans no
       routine block, so each day falls back to its own default — three on a
       school day, two on a weekend, because there is no after-school routine on
       a day with no school. Asserting three here asserted the retired rule, and
       the bulk control now writes exactly the set its own label counted. */
    const choresAfterChore = mrWeekBreakdown(past, kid).chorePaid;
    const askedThatDay = routineSessionsForDay(kid, past, 1);
    mmToggleAllRoutines(kid, 1);
    const allThree = askedThatDay.length > 0
      && askedThatDay.every(s => ctGetMandatory(past, 1, s, kid))
      // …and it did not reach past what the day asked for.
      && CT_SESSIONS.filter(s => !askedThatDay.includes(s))
           .every(s => !ctGetMandatory(past, 1, s, kid));
    const routinesDontPayChores = mrWeekBreakdown(past, kid).chorePaid === choresAfterChore;

    mmHide();
    e.chores = {}; e.claims = {};
    c.programStartDate = startBefore;
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
  if (want('unsettledWeeksAreOfferedNotHidden')) checks.unsettledWeeksAreOfferedNotHidden = await page.evaluate(() => {
    const bad = [];
    profile = 'parent'; ctParentKid = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const c = state.shared.chore;
    const heldBefore = JSON.parse(JSON.stringify(c.meetingsHeld || {}));
    const metBefore = JSON.parse(JSON.stringify(c.meetingsMet || {}));
    const progBefore = c.programStartDate;
    const mon = formatDayKey(ctThisWeekKey()); mon.setDate(mon.getDate() - 21);
    // A family three weeks in. Both floors, because the look-back stops at
    // whichever is later — a week before the family existed is not a week
    // they missed.
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

    // Weeks before the family's own record began are a dead end — never
    // offered. One date decides this now; it used to be the later of two.
    c.programStartDate = ctThisWeekKey();
    if (mmUnsettledWeeks(8).length !== 0) bad.push('weeks before the record began are still offered');

    c.meetingsHeld = heldBefore; c.meetingsMet = metBefore;
    c.programStartDate = progBefore;
    return bad.length === 0 || bad;
  });

  /* ── The "8 weeks never settled" bug ──
     meetingsHeld is written only when BOTH kids finish step 4, so a family that
     reviewed, celebrated and agreed the numbers recorded nothing — and the
     catch-up list called every one of the last eight weeks never settled,
     saturating at its own ceiling. That is where the number 8 came from. The
     same press credits the money, which is why the wallet read $0.00 while the
     meeting showed real figures: one bug, seen from two ends. */
  if (want('meetingMetIsNotMeetingSettled')) checks.meetingMetIsNotMeetingSettled = await page.evaluate(() => {
    const bad = [];
    profile = 'parent'; ctParentKid = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const c = state.shared.chore;
    const heldBefore = JSON.parse(JSON.stringify(c.meetingsHeld || {}));
    const metBefore = JSON.parse(JSON.stringify(c.meetingsMet || {}));
    const progBefore = c.programStartDate;
    const back = n => { const m = formatDayKey(ctThisWeekKey()); m.setDate(m.getDate() - n * 7); return ctDateToKey(m); };
    c.programStartDate = back(3);
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
    c.programStartDate = progBefore;
    renderParentHome();
    return bad.length === 0 || bad;
  });

  /* ── Nothing was lost on the way to five destinations ──
     Ten tabs became five destinations, and the failure a restructure produces
     is not a crash — it is a panel that quietly stops being reachable, which a
     person walking a checklist misses. So the §2 mapping is asserted rather
     than walked: every original panel is opened through the new nav and has to
     render something. */
  if (want('everyOldTabIsStillReachable')) checks.everyOldTabIsStillReachable = await page.evaluate(() => {
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
  if (want('copyingAWeekIsAPlanNotAClaim')) checks.copyingAWeekIsAPlanNotAClaim = await page.evaluate(async () => {
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
  if (want('aCopiedPlanIsNotPartOfTheOriginalsSeries')) checks.aCopiedPlanIsNotPartOfTheOriginalsSeries = await page.evaluate(() => {
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
  if (want('copyingADayCrossesWeeksAndKids')) checks.copyingADayCrossesWeeksAndKids = await page.evaluate(() => {
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
  if (want('everyDayConfirmsWhereItIs')) checks.everyDayConfirmsWhereItIs = await page.evaluate(async () => {
    const bad = [];
    const wasConfirm = window.showConfirm;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const store = state.shared.parentDayConfirm || {};
    const before = JSON.parse(JSON.stringify(store));
    const day0 = mmDayKey(0);
    const hadBlocks = ['jenn', 'jess'].map(k => (getDayBlocks(day0, k) || []).slice());
    ['jenn', 'jess'].forEach(k => { if (store[k]) delete store[k][day0]; });

    /* This check is about WHERE the control lives and that it toggles — the
       gate deciding whether a day may be reviewed at all has its own check
       (aDayIsNotReviewableUntilItHasHappened). So give it a day that can
       actually be reviewed: unconfirmed blocks on that day made the click a
       no-op and the failure read as "confirming from the row did not take".
       If day 0 is today it is also 'open', which asks before it signs off. */
    ['jenn', 'jess'].forEach(k => {
      const blocks = (getDayBlocks(day0, k) || []).map(b =>
        Object.assign({}, b, { completed: true, confirmed: true }));
      setDayBlocks(day0, blocks, k);
    });
    window.showConfirm = async () => true;

    openFamilyMeeting(); mmGoStep(1);
    const body = document.getElementById('familyMeetingBody');
    const rows = body.querySelectorAll('.mm-drow');
    if (rows.length !== 7) bad.push(`${rows.length} day rows, expected 7`);
    const btn = body.querySelector('[data-mm-action="confirmday"][data-day="0"]');
    if (!btn) bad.push('Monday cannot be confirmed from its own row');
    else {
      if (mmIsDayConfirmed(0)) bad.push('fixture started confirmed');
      /* Signing off an open day asks first, so the handler is async now — let
         its confirmation settle before reading the record back. */
      btn.click();
      await new Promise(r => setTimeout(r, 0));
      if (!mmIsDayConfirmed(0)) bad.push('confirming from the row did not take');
      // And it stays a toggle — a mis-tap has a way back.
      body.querySelector('[data-mm-action="confirmday"][data-day="0"]').click();
      await new Promise(r => setTimeout(r, 0));
      if (mmIsDayConfirmed(0)) bad.push('a day cannot be un-confirmed');
    }
    // The detail still opens, in the row it belongs to.
    const open = body.querySelector('[data-mm-action="openday"][data-day="2"]');
    if (open) {
      open.click();
      const row = document.getElementById('familyMeetingBody').querySelectorAll('.mm-drow')[2];
      if (!row || !row.querySelector('.mm-drow-body')) bad.push('a day row does not open its detail');
    }
    mmHide();
    window.showConfirm = wasConfirm;
    ['jenn', 'jess'].forEach((k, i) => setDayBlocks(day0, hadBlocks[i], k));
    state.shared.parentDayConfirm = before;
    return bad.length === 0 || bad;
  });

  /* One switcher, and it must not be able to hand the rest of the app a child
     that does not exist. parentViewing is read in 27 places outside this
     portal, every one of which assumes a real kid. */
  if (want('oneKidSwitcherThatCannotBreakTheRest')) checks.oneKidSwitcherThatCannotBreakTheRest = await page.evaluate(() => {
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
  if (want('nowCountsMatchTheirOwners')) checks.nowCountsMatchTheirOwners = await page.evaluate(() => {
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
  if (want('catchUpCommitsThroughTheMeeting')) checks.catchUpCommitsThroughTheMeeting = await page.evaluate(() => {
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
  if (want('theCatchUpListDoesNotGrowWithoutLimit')) checks.theCatchUpListDoesNotGrowWithoutLimit = await page.evaluate(() => {
    const bad = [];
    profile = 'parent';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const c = state.shared.chore;
    const heldBefore = JSON.parse(JSON.stringify(c.meetingsHeld || {}));
    const metBefore = JSON.parse(JSON.stringify(c.meetingsMet || {}));
    const progBefore = c.programStartDate;
    const mon = formatDayKey(ctThisWeekKey()); mon.setDate(mon.getDate() - 8 * 7);
    c.programStartDate = ctDateToKey(mon);
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
    c.programStartDate = progBefore;
    return bad.length === 0 || bad;
  });

  /* The readout whose absence made $0.00 look like data loss: a week that has
     been agreed but not paid out has to say so somewhere she will look. */
  if (want('agreedButUnpaidIsVisible')) checks.agreedButUnpaidIsVisible = await page.evaluate(() => {
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
  if (want('blankPastWeekCanBeFilledFromAnother')) checks.blankPastWeekCanBeFilledFromAnother = await page.evaluate(() => {
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
    mmHide();

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
  if (want('meetingSaysWhereYouLeftOff')) checks.meetingSaysWhereYouLeftOff = await page.evaluate(async () => {
    profile = 'parent'; ctParentKid = 'jenn'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const c = state.shared.chore;
    const heldBefore = JSON.parse(JSON.stringify(c.meetingsHeld || {}));
    const metBefore = JSON.parse(JSON.stringify(c.meetingsMet || {}));
    const progBefore = c.programStartDate;
    const askedBefore = mmCatchUpAsked;
    const back = (n) => {
      const d = formatDayKey(ctThisWeekKey()); d.setDate(d.getDate() - n * 7);
      return ctDateToKey(d);
    };
    // One floor: the look-back stops at the family's own start, because a week
    // before the family existed is not a week they missed.
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
    mmHide();

    const dlgOpen = () => {
      const ov = document.getElementById('appDialogOverlay');
      return !!ov && ov.classList.contains('open');
    };
    // A programmatic open must stay silent.
    mmCatchUpAsked = false;
    openFamilyMeeting();
    const quietOnDeepLink = !dlgOpen();
    mmHide();

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
    mmHide();

    // Caught up → no question at all.
    ctWeekKey = ctThisWeekKey();
    mmUnsettledWeeks(8).forEach(x => { c.meetingsHeld[x.wk] = true; });
    mmCatchUpAsked = false;
    openFamilyMeetingAsk();
    const quietWhenCaughtUp = !dlgOpen();
    mmHide();

    c.meetingsHeld = heldBefore; c.meetingsMet = metBefore;
    c.programStartDate = progBefore;
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
  if (want('marketClockFollowsTheCalendar')) checks.marketClockFollowsTheCalendar = await page.evaluate(() => {
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
  if (want('lateSettlementIsOnTheRecord')) checks.lateSettlementIsOnTheRecord = await page.evaluate(() => {
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
  if (want('competitionMoneyReachesThePool')) checks.competitionMoneyReachesThePool = await page.evaluate(() => {
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
  if (want('pocketMoneySoFarIsThePoolsNumber')) checks.pocketMoneySoFarIsThePoolsNumber = await page.evaluate(() => {
    profile = 'parent'; ctParentKid = 'jess'; parentViewing = 'jess';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const kid = 'jess', wk = ctWeekKey;
    mrEnsureEarnings(kid, wk).overrides = {};
    /* savingGoalEndToEnd settles this same week for this same child and never
       undoes it, and a settled week's split has already run — so a gift dated
       into it is now decided at the NEXT open meeting instead of belonging
       nowhere. This check is about the hub printing the pool's figure rather
       than the net, so it needs a week that can still take one. */
    const wasPlan = ((state.shared.chore.weekPlans || {})[wk] || {})[kid];
    if (wasPlan) delete (state.shared.chore.weekPlans[wk] || {})[kid];
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
    if (wasPlan) state.shared.chore.weekPlans[wk][kid] = wasPlan;
    return (giftMatters && showsPool && hidesNet) || [{ giftMatters, showsPool, hidesNet }];
  });

  /* The pool must not reserve a loan payment that has already been made.
     The schedule is monthly, the meeting weekly, so on three Sundays in four a
     paid-up debt still has a monthly figure attached — and mnyPool was reading
     it, understating "mine to choose" while the commit correctly moved nothing.

     THIS IS THE ONE POOL CHECK THAT MUST NOT RESET lastPaymentMonth. Every
     neighbour resets it at the top, which is precisely why the bug survived. */
  if (want('poolDoesNotReserveAPaymentAlreadyMade')) checks.poolDoesNotReserveAPaymentAlreadyMade = await page.evaluate(() => {
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
  if (want('kidPageShowsWhatIsActuallyHers')) checks.kidPageShowsWhatIsActuallyHers = await page.evaluate(() => {
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

  /* The wallet tiles must read the ACCESSORS, not the legacy `wallet.savings`
     field that `mnyEnsureHoldings` zeroes on migration — that field showed
     Savings $0.00 while the money page showed the real figure.

     This used to drive `buildHowIEarnCardLegacy`, which only rendered for weeks
     before the rulebook model. There is one model now and that card is gone, so
     it asserts the same fact on the surface a child actually opens. Worth
     keeping pointed at a live screen for its own sake: while the only reference
     to those class names was this test's own regex, `check-dead-css` read them
     as referenced and the rules outlived the markup.

     Asserting the number alone would pass on unmigrated data, so assert the old
     field really is empty by then — that is what makes it a regression test. */
  if (want('walletTilesReadTheRealSavings')) checks.walletTilesReadTheRealSavings = await page.evaluate(() => {
    profile = 'jess'; parentViewing = 'jess';
    ctPrepareRead();
    const kid = 'jess';
    const pd = getProfData(kid);
    delete pd.holdings;
    pd.wallet = { cash: 42.20, savings: 180, gics: [], holdings: {}, lastMeetingWeek: null };

    const html = mnyWalletCard(kid).replace(/\s+/g, ' ');
    const legacyZeroed = money2(getProfData(kid).wallet.savings) === 0;
    const migrated = mnySavedTotal(kid) === 180;
    // The kept-ready tile, and only it, must carry the real figure.
    const tile = /Kept ready.*?mny-tile-val">([^<]+)</.exec(html);
    const shows = !!tile && tile[1].trim() === '$180.00';
    const problems = [];
    if (!shows) problems.push('the kept-ready tile reads ' + (tile ? tile[1].trim() : 'nothing'));
    if (!legacyZeroed) problems.push('the legacy wallet.savings field was not zeroed');
    if (!migrated) problems.push('mnySavedTotal reads ' + mnySavedTotal(kid) + ', not 180');
    return problems.length ? problems : true;
  });

  /* ── Today ───────────────────────────────────────────────────────────────
     What a job is worth, in both states. A flat price would be a lie once the
     daily cap is spent, so the check is only meaningful if it sees the flip. */
  if (want('todayShowsWhatAChoreWouldPay')) checks.todayShowsWhatAChoreWouldPay = await page.evaluate(() => {
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
  if (want('todayMoneyRowMatchesMyMoney')) checks.todayMoneyRowMatchesMyMoney = await page.evaluate(() => {
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
  if (want('anEmptyDayOffersToBePlanned')) checks.anEmptyDayOffersToBePlanned = await page.evaluate(() => {
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
  if (want('glanceSeparatesSleepFromUnscheduled')) checks.glanceSeparatesSleepFromUnscheduled = await page.evaluate(() => {
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
  if (want('ageIsNeverAskedAndRollsOverInAugust')) checks.ageIsNeverAskedAndRollsOverInAugust = await page.evaluate(() => {
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
  if (want('achievementsStartUnassigned')) checks.achievementsStartUnassigned = await page.evaluate(() => {
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
  if (want('choreTabAndSisterSyncOpenOnToday')) checks.choreTabAndSisterSyncOpenOnToday = await page.evaluate(() => {
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
  if (want('routinesCloseInOneTap')) checks.routinesCloseInOneTap = await page.evaluate(() => {
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
  if (want('kidScreensDoNotScrollOnATablet')) checks.kidScreensDoNotScrollOnATablet = await page.evaluate(() => {
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
  if (want('todayShoutsAtWhatIsNextAndWhispersAtTheRest')) checks.todayShoutsAtWhatIsNextAndWhispersAtTheRest = await (async () => {
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
  if (want('theNextBlockSaysWhenToLeave')) checks.theNextBlockSaysWhenToLeave = await page.evaluate(() => {
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
  if (want('todayShowsTheShapeOfTheDay')) checks.todayShowsTheShapeOfTheDay = await (async () => {
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
  if (want('theHeroIsTheOnlyPlaceTheRunningBlockAppears')) checks.theHeroIsTheOnlyPlaceTheRunningBlockAppears = await page.evaluate(() => {
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
  if (want('theHeroCountsDownTheBlockSheIsIn')) checks.theHeroCountsDownTheBlockSheIsIn = await page.evaluate(() => {
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
  if (want('aShortGapReadsAsABreak')) checks.aShortGapReadsAsABreak = await page.evaluate(() => {
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
  if (want('aBlockYouTravelToStartsWhenYouStartGettingReady')) checks.aBlockYouTravelToStartsWhenYouStartGettingReady = await page.evaluate(() => {
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
  if (want('todayFlagsAClashTheSameWayTheWeekDoes')) checks.todayFlagsAClashTheSameWayTheWeekDoes = await page.evaluate(() => {
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
  if (want('repeatsAreNumberedWithinTheDay')) checks.repeatsAreNumberedWithinTheDay = await page.evaluate(() => {
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
  if (want('oneAnswerForWhatColourABlockIs')) checks.oneAnswerForWhatColourABlockIs = await page.evaluate(() => {
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
    /* THE SUBGROUP IS THE HUE, not the category. `cat` used to decide this, and
       nine flat values could not tell a piano lesson from a French lesson from
       a school day — all three came out the same blue. Piano is Arts. */
    if (blockColour(piano, 'jenn') !== activitySub(findActivity('piano', 'jenn')).hex) {
      out.push('a plain block is not its subgroup colour');
    }
    if (blockColour(piano, 'jenn') === blockColour({ id: 'c6', actId: 'school_day' }, 'jenn')) {
      out.push('a piano practice and a school day are still the same colour');
    }
    /* A colour every placement SEEDED is not a colour anybody chose. Each path
       wrote one out of the shipped table, so a stored value equal to one of
       those is the old default written down, and blockColour derives instead —
       otherwise changing a subgroup's hue would leave every block already
       placed wearing the one it replaced. */
    const seeded = { id: 'c7', actId: 'piano', startMin: 9 * 60, durationMin: 30, colour: CAT_HEX.school };
    if (blockColour(seeded, 'jenn') !== activitySub(findActivity('piano', 'jenn')).hex) {
      out.push('a seeded default colour is being treated as a decision');
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
  if (want('theUndoToastIsOutsideTheWordBudget')) checks.theUndoToastIsOutsideTheWordBudget = await page.evaluate(() => {
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
  if (want('undoPutsTheBlockBackButKeepsTheXp')) checks.undoPutsTheBlockBackButKeepsTheXp = await (async () => {
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
  if (want('theAppTellsFamilyTimeOnAnyDevice')) checks.theAppTellsFamilyTimeOnAnyDevice = await (async () => {
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
  if (want('oneRoutineAnswerOnEveryScreen')) checks.oneRoutineAnswerOnEveryScreen = await page.evaluate(() => {
    const bad = [];
    const kid = 'jenn';
    profile = 'jenn'; parentViewing = 'jenn'; weekOffset = 0;
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const keys = mrWeekDayKeys(wk);
    /* One of the five surfaces this check reads is TODAY, so the routine has to
       be on today — pinning it to keys[0] meant the Today assertion could only
       ever pass when the suite happened to run on a Monday. The other four are
       week-scoped and do not care which day of the week it sits on. */
    const day = keys.includes(todayKey()) ? todayKey() : keys[0];
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
  if (want('confirmingIsNotReviewing')) checks.confirmingIsNotReviewing = await page.evaluate(async () => {
    const bad = [];
    const wasConfirm = window.showConfirm;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wasWeek = ctWeekKey;
    /* LAST week's Monday, not this week's. mrWeekDayKeys(ctWeekKey)[0] is the
       CURRENT week's Monday, so on a Monday it IS today — and canReviewDay
       refuses today: 'running' while any block has not ended, 'open' once none
       has. Both refusals are correct behaviour this check is not about, so one
       day in seven it reported five failures for a day that simply had not been
       lived yet. A day from the previous week is unambiguously past on all
       seven days, which is what lets the same assertions run every day rather
       than skipping themselves on Mondays — the lesson CLAUDE.md already
       records for the Sunday review banner.

       Nothing else has to change: parentDayConfirm is keyed by a bare day key
       with no week dimension, so reviewing a day from another week is the same
       operation on the same store. The clock-sensitive half of this check is
       the `todayKey()` section further down, which is deliberately about today
       and stays there. */
    const wk = getDayKeys(-1)[0];
    const keys = mrWeekDayKeys(wk);
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

      /* The fixture's own precondition, stated once. Without it, moving this
         day back onto today fails as five confusing sentences about confirming
         and reviewing instead of one about the day. */
      const pre = canReviewDay('jenn', day);
      if (pre.reason === 'running' || pre.reason === 'open') {
        bad.push(`the fixture day ${day} is today — canReviewDay says "${pre.reason}", so this check cannot run`);
      }

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
      // Pointed at the fixture's own week: step 1's rows are indexed within
      // whichever week the meeting holds, so data-day="0" is only this Monday
      // if the meeting is on this week.
      mmGoToWeek(wk); mmGoStep(1);
      const one = document.querySelector('#familyMeetingBody [data-mm-action="reviewday"][data-kid="jenn"][data-day="0"]');
      if (!one) bad.push('the meeting has no per-child review control');
      else {
        one.click();
        if (!isDayReviewed('jenn', day)) bad.push('the per-child control did not review Jenn');
        if (isDayReviewed('jess', day)) bad.push('reviewing Jenn in the meeting also reviewed Jess');
      }
      const both = document.querySelector('#familyMeetingBody [data-mm-action="confirmday"][data-day="0"]');
      if (!both || !/Both/.test(both.textContent)) bad.push('the meeting does not label the both-children control');
      mmHide();
    } finally {
      window.showConfirm = wasConfirm;
      setDayBlocks(day, beforeJ, 'jenn');
      setDayBlocks(day, beforeS, 'jess');
      state.shared.parentDayConfirm = store;
      // mmGoToWeek moved the chore week; put it back for whatever runs next.
      ctWeekKey = wasWeek;
      profile = 'jenn';
    }
    return bad.length === 0 || bad;
  });

  /* THE ACTION IS SAVED EITHER WAY; PUTTING IT IN A PLAN IS A SEPARATE ACT.
     A reflection that only files the action changes nothing about next week,
     and one that writes into the planner on its own is a screen taking a
     decision the family did not make. So: saved in the record the moment she
     picks it, and carried into a plan only behind a confirmation that says
     which child, which week and what will appear.

     The week it lands on is not "the one after the week on screen" — a meeting
     held six weeks late must not write into a week that has already happened,
     which is the defect that retired mmPlanNextWeek. */
  if (want('theActionCanBeCarriedIntoAPlan')) checks.theActionCanBeCarriedIntoAPlan = await page.evaluate(async () => {
    const bad = [];
    const wasProfile = profile;
    const wasConfirm = window.showConfirm;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const hadRefl = JSON.parse(JSON.stringify(state.shared.chore.reflections || {}));
    const hadTodos = JSON.parse(JSON.stringify(getProfData('jenn').todos || []));
    try {
      state.shared.chore.reflections = {}; reflDraft = null;
      getProfData('jenn').todos = [];
      mmGoToWeek(wk); mmGoStep(2); mnySetMeetKid('jenn');
      reflTab = 'planNext'; renderMeetingMode();
      const host = document.getElementById('familyMeetingBody');

      // Nothing is offered until she has chosen an action.
      if (host.querySelector('[data-mm-action="refl-carry"]')) {
        bad.push('carrying forward was offered before an action was chosen');
      }
      host.querySelector('[data-mm-action="refl-action"]').click();
      if (!reflWorking(wk, 'jenn').planNext.actionId) bad.push('the action did not save');
      if (!host.querySelector('[data-mm-action="refl-carry"]')) {
        bad.push('the action was chosen but cannot be carried forward');
      }

      // Declining the confirmation writes nothing at all.
      window.showConfirm = async () => false;
      const carryBtns = [...host.querySelectorAll('[data-mm-action="refl-carry"]')];
      const todoBtn = carryBtns[carryBtns.length - 1];
      await reflAddToPlan(wk, 'jenn', '');
      if ((getProfData('jenn').todos || []).length) bad.push('a declined preview still wrote a to-do');
      if (reflCarriedForward(reflWorking(wk, 'jenn'))) bad.push('a declined preview recorded a carry');

      // Accepting writes exactly one to-do, on the week she will live it.
      window.showConfirm = async () => true;
      await reflAddToPlan(wk, 'jenn', '');
      const todos = getProfData('jenn').todos || [];
      if (todos.length !== 1) bad.push(`accepting wrote ${todos.length} to-dos`);
      else {
        if (todos[0].weekKey === wk) bad.push('the to-do landed on the week being reviewed, not the one ahead');
        if (todos[0].weekKey !== reflTargetWeek(wk)) bad.push('the to-do did not land on the target week');
        if (!/timer|Check|Ask|Finish|Prepare|Repeat|Follow/i.test(todos[0].text)) {
          bad.push(`the to-do does not name the action: "${todos[0].text}"`);
        }
      }
      if (!reflCarriedForward(reflWorking(wk, 'jenn'))) bad.push('the carry was not recorded');
      // …and it cannot be written twice.
      renderMeetingMode();
      if (host.querySelector('[data-mm-action="refl-carry"]')) {
        bad.push('a carried action was still offered for carrying');
      }

      /* A past week plans into the present, never into the week after itself. */
      const past = mrWeekDayKeys(wk)[0].slice(0, 8) + '01';
      if (reflTargetWeek('2020-01-06') !== ctThisWeekKey()) {
        bad.push('a historical week plans forward into another historical week');
      }
      /* CHOOSING A ROUTINE DECIDES WHAT THE TO-DO IS TIED TO, NOT WHETHER ONE
         EXISTS. This assertion used to be `linkedRoutineId was recorded` — a
         field nothing in the app reads — so it passed green while the button
         did nothing at all and told the parent "Attached ✅". Assert the
         EFFECT: a real to-do, on the target week, linked to that routine and
         resolvable through the planner's own accessor. */
      state.shared.chore.reflections = {}; reflDraft = null;
      getProfData('jenn').todos = [];
      const routine = reflLinkTargets('jenn')[0];
      if (!routine) bad.push('there is nothing to attach an action to');
      else {
        reflEdit(wk, 'jenn', r => { r.planNext.actionId = 'timer'; });
        await reflAddToPlan(wk, 'jenn', routine.id);
        const rt = getProfData('jenn').todos || [];
        if (rt.length !== 1) bad.push(`attaching to a routine wrote ${rt.length} to-dos, expected 1`);
        else {
          if (rt[0].weekKey !== reflTargetWeek(wk)) bad.push('the linked to-do did not land on the target week');
          if (rt[0].linkType !== 'activity') bad.push(`the to-do is not linked to an activity (linkType=${rt[0].linkType})`);
          if (rt[0].linkActId !== routine.id) bad.push('the to-do is not linked to the routine that was chosen');
          if (!getTodoLinkStats(rt[0])) bad.push('the planner cannot resolve the link the carry created');
        }
        if (reflGet(wk, 'jenn').planNext.linkedRoutineId !== routine.id) bad.push('the routine link was not recorded');
        if (!reflGet(wk, 'jenn').planNext.carriedTodoId) bad.push('the record does not name the to-do it created');
        if (!/to-dos/.test(reflCarryLabel(reflGet(wk, 'jenn'), 'jenn'))) {
          bad.push(`the carry does not describe itself: "${reflCarryLabel(reflGet(wk, 'jenn'), 'jenn')}"`);
        }
      }
    } finally {
      window.showConfirm = wasConfirm;
      state.shared.chore.reflections = hadRefl;
      getProfData('jenn').todos = hadTodos;
      reflDraft = null;
      mmHide();
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* HOW THE ANSWER WAS GIVEN, AND WHOSE ANSWER IT IS.
     Two things the reflection has to keep apart from her own words. "Said out
     loud" is a complete answer — a child who explained it well to her parent
     has answered, and making her type it to make it count turns a conversation
     into a form. "Parent noticed" is a second account of the week, stored in
     its own field and labelled, because a grown-up's reading must never
     overwrite the child's. */
  if (want('theReflectionKeepsVoicesApart')) checks.theReflectionKeepsVoicesApart = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const hadRefl = JSON.parse(JSON.stringify(state.shared.chore.reflections || {}));
    try {
      state.shared.chore.reflections = {}; reflDraft = null;
      mmGoToWeek(wk); mmGoStep(2); mnySetMeetKid('jenn');
      reflTab = 'doingWell'; renderMeetingMode();
      const host = document.getElementById('familyMeetingBody');

      // Spoken is the default: recording it should cost nothing.
      const aloud = host.querySelector('[data-mm-action="refl-aloud"]');
      if (!aloud) { bad.push('there is no way to say the answer was spoken'); }
      else {
        if (aloud.getAttribute('aria-pressed') !== 'true') bad.push('spoken is not the default');
        // A chip answer plus "said out loud" finishes the tab with no typing.
        host.querySelector('[data-mm-action="refl-well"]').click();
        if (!reflTabComplete(reflWorking(wk, 'jenn'), 'doingWell')) {
          bad.push('a tapped answer did not finish the tab without the keyboard');
        }
        host.querySelector('[data-mm-action="refl-aloud"]').click();
        if (reflWorking(wk, 'jenn').doingWell.inputMode !== 'parent_scribed') {
          bad.push('how the answer was given was not recorded');
        }
        // …and it changes nothing about WHAT she answered.
        if (!(reflWorking(wk, 'jenn').doingWell.answerIds || []).length) {
          bad.push('recording how it was given changed what was answered');
        }
      }

      // Parent noticed: its own field, and it cannot reach her answer.
      reflTab = 'needsWork'; renderMeetingMode();
      host.querySelector('[data-mm-action="refl-problem"]').click();
      const her = reflWorking(wk, 'jenn').needsWork.answerId;
      const field = document.querySelector('[data-refl-field="refl-parent"]');
      if (!field) { bad.push('there is nowhere to record what a parent noticed'); }
      else {
        if (!/Parent noticed/i.test(host.textContent)) bad.push("the parent's line is not labelled as theirs");
        field.value = 'she was tired all week';
        field.dispatchEvent(new Event('input', { bubbles: true }));
        const rec = reflWorking(wk, 'jenn');
        if (rec.needsWork.parentObservation !== 'she was tired all week') {
          bad.push('the parent observation did not record');
        }
        if (rec.needsWork.answerId !== her) bad.push("the parent's note overwrote the child's answer");
        if (rec.needsWork.controllableText === 'she was tired all week') {
          bad.push("the parent's note landed in the child's own field");
        }
      }

      /* What the app was OFFERING when she answered is kept, so a reflection
         read a year later shows what she was looking at. It is never what she
         picked — nothing here selects an answer. */
      const rec = reflWorking(wk, 'jenn');
      if (!Array.isArray(rec.needsWork.evidenceIds)) bad.push('the evidence shown was not recorded');
      if (rec.needsWork.evidenceIds.includes(rec.needsWork.answerId)) {
        bad.push('the evidence list is storing her answer rather than what was shown');
      }
    } finally {
      state.shared.chore.reflections = hadRefl;
      reflDraft = null;
      mmHide();
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* A CLOSED WEEK'S REFLECTION IS A RECORD.
     The money is frozen when a week closes and the grades are frozen with it.
     The reflection has to match, or a parent can reopen step 2 on a settled
     week months later and change what a child said about it. Reopening the
     week is the way back in — the same door every other frozen fact uses. */
  if (want('aClosedWeeksReflectionCannotBeRewritten')) checks.aClosedWeeksReflectionCannotBeRewritten = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const hadRefl = JSON.parse(JSON.stringify(state.shared.chore.reflections || {}));
    const hadClosed = JSON.parse(JSON.stringify(state.shared.chore.weeksClosed || {}));
    try {
      state.shared.chore.reflections = {}; reflDraft = null;
      setWeekClosed(wk, false);
      mmGoToWeek(wk); mmGoStep(2); mnySetMeetKid('jenn');
      reflTab = 'doingWell'; renderMeetingMode();
      const host = document.getElementById('familyMeetingBody');
      host.querySelector('[data-mm-action="refl-well"]').click();
      const answered = (reflWorking(wk, 'jenn').doingWell.answerIds || []).slice();
      if (!answered.length) bad.push('the answer did not record while the week was open');
      reflCommitDraft();

      setWeekClosed(wk, true);
      renderMeetingMode();
      if (!/closed/i.test(host.textContent)) bad.push('a closed week does not say so on the reflection');

      // Every edit path refuses: a chip, the keyboard, and the two footer writes.
      const chip = host.querySelector('[data-mm-action="refl-well"]:not([aria-pressed="true"])');
      if (chip) chip.click();
      if (JSON.stringify(reflGet(wk, 'jenn').doingWell.answerIds) !== JSON.stringify(answered)) {
        bad.push('a tap changed a closed week\'s answers');
      }
      /* Asserted against the WORKING record, not the stored one. reflEdit
         writes to a draft that is only committed later, so reading the store
         here would report success while the edit sat in memory waiting to be
         written — which is exactly what it did the first time this was run. */
      reflEdit(wk, 'jenn', r => { r.needsWork.answerId = 'rushed'; });
      if (reflWorking(wk, 'jenn').needsWork.answerId === 'rushed') {
        bad.push('reflEdit wrote through on a closed week');
      }
      reflCommitDraft();
      if (reflGet(wk, 'jenn').needsWork.answerId === 'rushed') {
        bad.push('a closed week\'s edit reached the document');
      }
      if (host.querySelector('[data-mm-action="refl-talked"]')) bad.push('the parent tick is still offered');
      if (host.querySelector('[data-mm-action="refl-skip"]')) bad.push('skipping is still offered');
      const note = host.querySelector('.refl-note');
      if (note && !note.readOnly) bad.push('a scribed note is still editable');

      // Reading it is still allowed — a record you cannot page through is poor.
      const tab = host.querySelector('[data-mm-action="refl-tab"][data-refl-tab="needsWork"]');
      if (tab) tab.click();
      if (reflTab !== 'needsWork') bad.push('a closed week cannot be paged through');

      // Reopening is the way back in.
      setWeekClosed(wk, false);
      reflTab = 'doingWell'; renderMeetingMode();
      const again = host.querySelector('[data-mm-action="refl-well"]:not([aria-pressed="true"])');
      if (again) again.click();
      if ((reflWorking(wk, 'jenn').doingWell.answerIds || []).length === answered.length) {
        bad.push('reopening the week did not make the reflection editable again');
      }
    } finally {
      state.shared.chore.reflections = hadRefl;
      state.shared.chore.weeksClosed = hadClosed;
      reflDraft = null;
      mmHide();
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* STEP 5 SHOWS THE WHOLE WEEK BEFORE IT CLOSES IT.
     Closing is the confirmation the old workflow never had, and it was offered
     against a gate whose reasons a parent could not see. The summary is the
     last place in the sitting where both children's weeks are visible at once —
     days reviewed, reflection, money, and the action each child carries
     forward — and it OWNS none of them: every figure is read through the
     accessor that already answers that question. A day that has not happened is
     not counted against her. */
  if (want('closingAWeekShowsWhatItStandsAt')) checks.closingAWeekShowsWhatItStandsAt = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const hadRefl = JSON.parse(JSON.stringify(state.shared.chore.reflections || {}));
    try {
      state.shared.chore.reflections = { [wk]: { jenn: Object.assign(reflBlank(), {
        doingWell: { answerIds: ['finished'], evidenceIds: [], customNote: '', inputMode: 'spoken' },
        needsWork: { answerId: 'rushed', evidenceIds: [], customNote: '', controllableText: 'slow down',
                     needsHelpFindingControl: false, parentObservation: '', inputMode: 'spoken' },
        planNext: Object.assign(reflBlank().planNext, { actionId: 'timer' }),
      }) } };
      mmGoToWeek(wk); mmGoStep(5); renderMeetingMode();
      const host = document.getElementById('familyMeetingBody');
      const txt = host.textContent.replace(/\s+/g, ' ');

      if (!/Days reviewed/.test(txt)) bad.push('the summary does not say how many days were reviewed');
      if (!/Reflection/.test(txt)) bad.push('the summary does not say where the reflection stands');
      if (!/Money/.test(txt)) bad.push('the summary does not say whether the money moved');
      // A finished reflection carries its action forward by name.
      if (!/Use a timer/.test(txt)) bad.push('the action she chose is not carried into the close');
      if (!/complete/.test(txt)) bad.push("a finished reflection does not read as complete");
      // Jess answered nothing; hers must read as unfinished rather than absent.
      if (!/0\/3|—/.test(txt)) bad.push("an unanswered reflection is not shown as unfinished");

      /* Only days that could be reviewed count. Seeding a future-heavy week
         must not make the denominator the whole seven regardless. */
      const kids = host.querySelectorAll('.mm-close-kid');
      if (kids.length !== 2) bad.push(`the summary shows ${kids.length} children`);
      // No space: the label and the figure are two spans in one row.
      const denom = (txt.match(/Days reviewed\s*(\d+)\/(\d+)/) || [])[2];
      /* ONLY a future day is excused. A running day used to be excluded here
         and in canCloseWeek alike, which is how a week closed over a Sunday
         whose swimming was still in the pool while the summary read 6/6. */
      const due = weekDaysAwaitingReview('jenn', wk).length
                + mrWeekDayKeys(wk).filter(k => canReviewDay('jenn', k).reason !== 'future'
                                             && isDayReviewed('jenn', k)).length;
      if (Number(denom) !== due) bad.push(`the summary counts ${denom} reviewable days, the close gate says ${due}`);

      // And it says what became of the action, not just what it was.
      if (!/not carried forward|to-dos/.test(txt)) {
        bad.push('the summary does not say whether the action reached a plan');
      }

      // Copying a plan forward is still not offered here.
      if (/Copy this week/i.test(txt)) bad.push('step 5 offers to copy the week again');
    } finally {
      state.shared.chore.reflections = hadRefl;
      mmHide();
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* THE WEEKLY REFLECTION IS THE CHILD'S ANSWER, NOT THE APP'S.
     Step 2 used to show a list the app had written about her. She answers now:
     what went well, what problem she noticed, what she will do next time — in
     that order, because a child asked what went wrong before she is asked what
     went right has been told what the conversation is about.

     The rules that matter, and what each would look like if it broke:
       · evidence never selects an answer — the app answering for her;
       · at most two things went well, exactly one problem, exactly one action;
       · naming a cause does not finish the second tab — an explanation is not
         a solution, and "I need help finding one" is a real answer;
       · the parent's tick records the conversation and changes nothing else;
       · skipping is explicit and does not block the money;
       · a tap does not upload the whole family document. */
  if (want('theReflectionIsHerAnswer')) checks.theReflectionIsHerAnswer = await page.evaluate(async () => {
    const bad = [];
    const wasProfile = profile;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const hadRefl = JSON.parse(JSON.stringify((state.shared.chore.reflections || {})));
    const wasSave = window.saveAll;
    try {
      state.shared.chore.reflections = {};
      reflDraft = null;
      mmGoToWeek(wk); mmGoStep(2); mnySetMeetKid('jenn');
      reflTab = 'doingWell'; reflEvidenceOpen = false;
      renderMeetingMode();

      const host = document.getElementById('familyMeetingBody');
      const chips = () => [...host.querySelectorAll('[data-mm-action="refl-well"]')];
      const tap = (sel) => { const el = host.querySelector(sel); if (el) el.click(); return !!el; };

      // The prompts, in the order they must be asked.
      const tabs = [...host.querySelectorAll('[data-mm-action="refl-tab"]')].map(t => t.textContent.trim());
      if (!/Doing well/.test(tabs[0] || '')) bad.push(`first tab is "${tabs[0]}"`);
      if (!/Needs work/.test(tabs[1] || '')) bad.push(`second tab is "${tabs[1]}"`);
      if (!/Plan next/.test(tabs[2] || '')) bad.push(`third tab is "${tabs[2]}"`);
      if (/\bBad\b/.test(host.textContent)) bad.push('a tab is labelled "Bad"');
      if (!/What went well\?/.test(host.textContent)) bad.push('the first prompt is not asked');

      // Nothing is selected for her, whatever the week shows.
      if (chips().some(c => c.getAttribute('aria-pressed') === 'true')) {
        bad.push('an answer was preselected');
      }

      // At most two.
      chips()[0].click(); chips()[1].click();
      let on = chips().filter(c => c.getAttribute('aria-pressed') === 'true');
      if (on.length !== 2) bad.push(`two taps selected ${on.length}`);
      const third = chips().find(c => c.getAttribute('aria-pressed') !== 'true');
      if (!third.disabled) bad.push('a third answer was still offered');
      /* And the cap is in the handler, not only in the markup. A disabled
         attribute is a hint to the pointer; the rule has to hold when something
         reaches the action anyway — a stale render, a keyboard, a stray tap
         between paints. */
      third.disabled = false;
      third.click();
      if (chips().filter(c => c.getAttribute('aria-pressed') === 'true').length > 2) {
        bad.push('a third answer was accepted once the markup stopped refusing');
      }
      /* Re-queried: every tap rebuilds the body, so an element captured before
         one is detached and clicking it does nothing at all. */
      chips().find(c => c.getAttribute('aria-pressed') === 'true').click();
      if (chips().filter(c => c.getAttribute('aria-pressed') === 'true').length !== 1) {
        bad.push('unticking an answer did not take it back');
      }

      // Evidence is offered, folded, and underneath her answer.
      const toggle = host.querySelector('[data-mm-action="refl-evidence"]');
      if (!toggle) bad.push('the week shows nothing at all');
      else {
        if (host.querySelector('.refl-ev-list')) bad.push('the evidence is open by default');
        toggle.click();
        const list = host.querySelector('.refl-ev-list');
        if (!list) bad.push('the evidence did not open');
        const answers = host.querySelector('.refl-chips');
        if (list && answers && !(answers.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING)) {
          bad.push('the evidence is drawn above her own answer');
        }
        if (chips().filter(c => c.getAttribute('aria-pressed') === 'true').length !== 1) {
          bad.push('opening the evidence changed her answer');
        }
      }

      // Tab 2: exactly one problem, and a cause is not yet a solution.
      tap('[data-mm-action="refl-tab"][data-refl-tab="needsWork"]');
      const probs = () => [...host.querySelectorAll('[data-mm-action="refl-problem"]')];
      probs()[0].click(); probs()[1].click();
      if (probs().filter(p => p.getAttribute('aria-pressed') === 'true').length !== 1) {
        bad.push('two problems were selectable at once');
      }
      let rec = reflWorking(wk, 'jenn');
      if (reflTabComplete(rec, 'needsWork')) {
        bad.push('naming a cause finished the tab without a controllable part');
      }
      tap('[data-mm-action="refl-needhelp"]');
      rec = reflWorking(wk, 'jenn');
      if (!reflTabComplete(rec, 'needsWork')) bad.push('"I need help finding one" did not close the tab');

      // Tab 3: one action, and the app may suggest but never choose.
      tap('[data-mm-action="refl-tab"][data-refl-tab="planNext"]');
      const acts = [...host.querySelectorAll('[data-mm-action="refl-action"]')];
      if (acts.some(a => a.getAttribute('aria-pressed') === 'true')) {
        bad.push('an action was preselected from the problem');
      }
      if (!host.querySelector('[data-refl-suggested]')) {
        bad.push('no action was connected to the problem she named');
      }
      acts[0].click();
      rec = reflWorking(wk, 'jenn');
      if (!reflTabComplete(rec, 'planNext')) bad.push('one action did not finish the tab');
      if (reflDoneCount(rec) !== 3) bad.push(`the reflection reads ${reflDoneCount(rec)}/3 when all three are answered`);

      // Both children keep their own, and the selector says where each is.
      tap('[data-mm-action="refl-kid"][data-kid="jess"]');
      if (reflDoneCount(reflWorking(wk, 'jess')) !== 0) bad.push("Jenn's answers followed the child switch");
      tap('[data-mm-action="refl-kid"][data-kid="jenn"]');
      if (reflDoneCount(reflWorking(wk, 'jenn')) !== 3) bad.push("Jenn's answers did not survive the switch");

      /* The parent's tick records the conversation and nothing else. */
      const beforeMoney = JSON.stringify(state.shared.chore.finalizedWeeks || {});
      const beforeXp = JSON.stringify(state.shared.chore.xpAwardedWeeks || {});
      tap('[data-mm-action="refl-talked"]');
      if (!reflGet(wk, 'jenn').parentReviewedAt) bad.push('the parent tick did not record');
      if (JSON.stringify(state.shared.chore.finalizedWeeks || {}) !== beforeMoney) bad.push('the parent tick moved money');
      if (JSON.stringify(state.shared.chore.xpAwardedWeeks || {}) !== beforeXp) bad.push('the parent tick moved XP');

      /* Skipping is explicit, and reversible. It is offered while there is
         still something to skip: setting aside a reflection that is already
         answered is a contradiction, and completing one takes the skip back
         (see aReflectionCannotBeSkippedAndComplete), so the button would
         silently do nothing here. Un-answer the last tab to get it back. */
      tap('[data-mm-action="refl-tab"][data-refl-tab="planNext"]');
      host.querySelector('[data-mm-action="refl-action"][aria-pressed="true"]').click();
      if (reflIsComplete(reflWorking(wk, 'jenn'))) bad.push('the action could not be un-chosen');
      tap('[data-mm-action="refl-skip"]');
      if (!reflIsSkipped(reflGet(wk, 'jenn'))) bad.push('skipping was not recorded');
      tap('[data-mm-action="refl-skip"]');
      if (reflIsSkipped(reflGet(wk, 'jenn'))) bad.push('a skip could not be picked back up');

      /* A tap edits a device-local draft. Every write here is a full-document
         upload, and this is the tap-heaviest screen in the app. */
      let saves = 0;
      window.saveAll = () => { saves++; };
      reflTab = 'doingWell'; renderMeetingMode();
      [...host.querySelectorAll('[data-mm-action="refl-well"]')].slice(0, 2).forEach(c => c.click());
      if (saves !== 0) bad.push(`${saves} document writes for two chip taps`);
      reflCommitDraft();
      if (saves !== 1) bad.push(`committing the reflection wrote ${saves} times`);
    } finally {
      window.saveAll = wasSave;
      state.shared.chore.reflections = hadRefl;
      reflDraft = null;
      mmHide();
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* CHANGING SCHOOL HOURS RECONCILES THE CARDS ALREADY PLACED.
     schoolHours() drives the bands and any NEW School Day card, so moving the
     hours left every card already on the calendar at the old time — the app
     disagreeing with itself, visible only by opening each week.

     The three things this has to get right are the ones a careless sweep gets
     wrong: a completed or confirmed card is a record and must not move, a past
     day is not touched at all, and everything the card carries besides its two
     time fields has to survive. Plus the write count: setDayBlocks saves on
     every call, so a per-card write would upload the whole family document once
     per card. */
  if (want('schoolHoursReconcileTheCardsAlreadyPlaced')) checks.schoolHoursReconcileTheCardsAlreadyPlaced = await page.evaluate(async () => {
    const bad = [];
    const wasProfile = profile;
    const wasCal = JSON.parse(JSON.stringify(state.shared.schoolCal || {}));
    const wasWeeks = JSON.parse(JSON.stringify(state.profiles.jenn.weeks || {}));
    const wasChoice = window.showChoice;
    const wasSave = window.saveAll;
    profile = 'parent'; parentViewing = 'jenn';
    const today = todayKey();
    const soon = toDayKeyInZone(new Date(Date.now() + 2 * 864e5));
    const past = toDayKeyInZone(new Date(Date.now() - 2 * 864e5));
    try {
      const before = schoolHours();
      const oldStart = START_MIN + before.startMin;
      const oldDur = before.endMin - before.startMin;
      const card = (id, extra) => Object.assign({
        id, actId: 'school_day', startMin: oldStart, durationMin: oldDur,
        objectives: [{ id: 'o1', text: 'keep' }], note: 'do not lose me', checklistState: {},
        travelBuffer: true, travelBufMin: 15, getReadyBuffer: true, getReadyBufMin: 15,
        seriesId: 'sr-keep', completed: false, confirmed: false,
      }, extra || {});

      state.profiles.jenn.weeks[soon] = [card('sc-move')];
      state.profiles.jenn.weeks[today] = [card('sc-done', { completed: true, confirmed: true })];
      state.profiles.jenn.weeks[past] = [card('sc-past')];

      const next = { startMin: before.startMin + 60, endMin: before.endMin + 60,
                     lunchStartMin: null, lunchMin: 0 };
      const plan = paSchoolCardPlan(next);
      const ids = plan.update.map(u => u.id);
      if (!ids.includes('sc-move')) bad.push('a movable future card was not in the plan');
      if (ids.includes('sc-done')) bad.push('a confirmed card was going to be rewritten');
      if (ids.includes('sc-past')) bad.push('a card on a past day was going to be rewritten');
      if (!plan.locked.some(l => l.id === 'sc-done')) bad.push('the confirmed card was not reported as protected');

      // A clash is reported, and the other activity is not moved.
      state.profiles.jenn.weeks[soon] = [card('sc-move'),
        { id: 'sc-other', actId: 'piano', startMin: oldStart + 60, durationMin: 60, checklistState: {} }];
      const clashPlan = paSchoolCardPlan(next);
      if (!clashPlan.clashes) bad.push('an overlap after the move was not reported');

      /* One write for the setting and every card it touches. */
      let saves = 0;
      window.saveAll = () => { saves++; };
      window.showChoice = async () => 'update';
      document.getElementById('paSchoolStart').value =
        `${String(Math.floor((START_MIN + next.startMin) / 60)).padStart(2, '0')}:${String((START_MIN + next.startMin) % 60).padStart(2, '0')}`;
      document.getElementById('paSchoolEnd').value =
        `${String(Math.floor((START_MIN + next.endMin) / 60)).padStart(2, '0')}:${String((START_MIN + next.endMin) % 60).padStart(2, '0')}`;
      document.getElementById('paSchoolLunchMin').value = '0';
      await paSaveSchoolHours();
      if (saves !== 1) bad.push(`saving the hours wrote ${saves} times, expected 1`);

      const moved = (state.profiles.jenn.weeks[soon] || []).find(b => b.id === 'sc-move');
      if (!moved) bad.push('the card being reconciled disappeared');
      else {
        if (moved.startMin !== START_MIN + next.startMin) bad.push('the card did not take the new start');
        if (moved.durationMin !== next.endMin - next.startMin) bad.push('the card did not take the new length');
        if (moved.note !== 'do not lose me') bad.push('the note was lost');
        if (!moved.objectives || !moved.objectives.length) bad.push('the objectives were lost');
        if (!moved.travelBuffer || !moved.getReadyBuffer) bad.push('the buffers were lost');
        if (moved.seriesId !== 'sr-keep') bad.push('the series link was lost');
        if (moved.id !== 'sc-move') bad.push('the card came back with a different id');
      }
      const other = (state.profiles.jenn.weeks[soon] || []).find(b => b.id === 'sc-other');
      if (other && other.startMin !== oldStart + 60) bad.push('the clashing activity was moved automatically');
      const done = (state.profiles.jenn.weeks[today] || []).find(b => b.id === 'sc-done');
      if (done && done.startMin !== oldStart) bad.push('the confirmed card moved after all');
      const old = (state.profiles.jenn.weeks[past] || []).find(b => b.id === 'sc-past');
      if (old && old.startMin !== oldStart) bad.push('a past card moved after all');

      /* Choosing "new school days only" saves the hours and leaves cards be. */
      state.profiles.jenn.weeks[soon] = [card('sc-stay')];
      window.showChoice = async () => 'hours';
      document.getElementById('paSchoolStart').value = '08:15';
      document.getElementById('paSchoolEnd').value = '15:15';
      await paSaveSchoolHours();
      const stayed = (state.profiles.jenn.weeks[soon] || []).find(b => b.id === 'sc-stay');
      if (stayed && stayed.startMin !== oldStart) bad.push('"new days only" moved an existing card');
      if (schoolHours().startMin !== timeStrToRelMin('08:15')) bad.push('"new days only" did not save the hours');
    } finally {
      window.showChoice = wasChoice;
      window.saveAll = wasSave;
      state.shared.schoolCal = wasCal;
      state.profiles.jenn.weeks = wasWeeks;
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* NO ACTIVITY HAS TO BE EARNED — and seasonal locking still works.

     Family Hero went first: its four activities sat in REWARD_POOLS with
     rewardLocked:true, so the thing a child had to earn was the right to help
     at home, and the first-run overlay's whole content was picking one of them
     as an unlocked "starter". Whoever did the chore is the hero.

     The remaining nine followed. The grant was never a level-up, whatever the
     surrounding prose said — it was a placed-block milestone at 10/15/20, so
     the app's answer to "you have planned ten things" was to hand back the
     right to plan an eleventh KIND of thing.

     Two things this check has to hold that the removal could easily have
     broken. The ids do not move: every block ever placed against one still has
     to resolve, or it renders as nothing at all. And _locked had TWO writers —
     reward-locking and the seasonal out-of-season rule — so retiring the first
     must leave the second exactly as it was, or Beach Day turns up in January.

     The routine-streak checklist rewards are a different feature sharing the
     same prompt widget, and they stay; asserted here so a later tidy-up does
     not take them along by association. */
  if (want('noActivityHasToBeEarned')) checks.noActivityHasToBeEarned = await page.evaluate(() => {
    const bad = [];
    /* The four Family Hero chores have since been ARCHIVED — they named four
       specific jobs the paid pool already holds, and mrChoreTagsForDay keys on
       `actId !== 'chores'`, so a child could do the washing-up under Kitchen
       Helper Quest and be paid nothing for it. "Not on the picker" is the right
       answer for them now, and theCatalogResolvesEveryBlockItEverNamed is what
       holds their history. What this check still owns is that the retirement
       was not a DELETE and did not change what they count as. */
    const FAMILY = [];
    const FAMILY_RETIRED = ['family_set_table', 'family_prep_bag', 'family_laundry_fold', 'family_kitchen_helper'];
    /* The nine that were locked. Five have since been RETIRED by the catalog
       rewrite — they are asserted by theCatalogResolvesEveryBlockItEverNamed
       instead, because "not on the picker" is now the correct answer for them
       and demanding both would be two checks contradicting each other. */
    const FORMERLY_EARNED = [
      'health_recovery_fuel', 'health_stretch_reset',
      'culture_story_circle', 'culture_festival_prep',
    ];
    const wasProfile = profile;
    profile = 'jenn';
    try {
      const avail = getAllActivities('jenn');

      [...FAMILY, ...FORMERLY_EARNED].forEach(id => {
        const act = avail.find(a => a.id === id);
        if (!act) { bad.push(`${id} is not on the picker at all`); return; }
        if (act._rewardLocked) bad.push(`${id} is still reward-locked`);
        if (act._locked) bad.push(`${id} is still locked`);
        // The id resolves for a block placed against it in any past week.
        if (!findActivity(id, 'jenn')) bad.push(`a historical block naming ${id} no longer resolves`);
        const shown = blockDisplayName({ actId: id }, 'jenn');
        if (!shown || !shown.name || shown.name === 'Something') {
          bad.push(`${id} renders as "${shown && shown.name}"`);
        }
      });

      /* Retired from the pickers, and still a chore wherever a block names one:
         an hours chart that reclassified two years of Family Hero blocks would
         be the archive rule failing in the direction it exists to prevent. */
      FAMILY_RETIRED.forEach(id => {
        if (avail.some(a => a.id === id)) bad.push(`${id} is retired but still on the picker`);
        const act = findActivity(id, 'jenn');
        if (!act) { bad.push(`a historical block naming ${id} no longer resolves`); return; }
        if (activityGroup(act) !== 'chores') {
          bad.push(`${id} is grouped as '${activityGroup(act)}', not a chore`);
        }
        const shown = blockDisplayName({ actId: id }, 'jenn');
        if (!shown || !shown.name || shown.name === 'Something') {
          bad.push(`${id} renders as "${shown && shown.name}"`);
        }
      });

      // The machinery is gone, not merely unreachable.
      ['REWARD_POOLS', 'enqueueMilestoneRewards', 'pickLockedReward', 'unlockRewardAct', 'queueReward',
       'openTutorial', 'chooseTutorialStarter', 'skipTutorial', 'TUTORIAL_STARTER_CHOICES']
        .forEach(name => {
          if (typeof window[name] !== 'undefined') bad.push(`${name} is still defined`);
        });
      if (document.getElementById('tutorialOverlay')) bad.push('the tutorial overlay is still in the markup');
      if (getAllActivities('jenn').some(a => a.rewardLocked)) bad.push('an activity still carries rewardLocked');

      /* SEASONAL LOCKING, the other writer of _locked. Asserted against the
         real current season rather than a fixed month, so it holds all year. */
      const season = getCurrentSeason();
      const offSeason = SEASONAL_ACTIVITIES.find(a => a.season !== season);
      const inSeason  = SEASONAL_ACTIVITIES.find(a => a.season === season);
      if (!offSeason) {
        bad.push('no out-of-season activity to test seasonal locking with');
      } else {
        const act = avail.find(a => a.id === offSeason.id);
        if (!act) bad.push(`${offSeason.id} vanished from the picker`);
        else if (!act._locked) bad.push(`${offSeason.id} is a ${offSeason.season} activity and is not locked in ${season}`);
      }
      if (inSeason) {
        const act = avail.find(a => a.id === inSeason.id);
        if (act && act._locked) bad.push(`${inSeason.id} is in season (${season}) and is locked anyway`);
      }

      /* The checklist rewards, deliberately kept: a different feature that
         earns an extra checklist ITEM off a real streak. */
      ['queueChecklistReward', 'getUnlockedRoutineRewards', 'maybeShowRewardPrompt', 'acceptRewardPrompt']
        .forEach(name => {
          if (typeof window[name] !== 'function') bad.push(`${name} went with the activity unlocks`);
        });
      const items = [...AFTERSCHOOL_REWARD_ITEMS, ...AFTERSCHOOL_CHECKLIST_REWARDS];
      const heroItem = items.find(i => /family hero/i.test(i.text));
      if (heroItem) bad.push(`a Family Hero reward item survives: "${heroItem.text}"`);
      if (items.length < 4) bad.push('the unrelated Focus/Culture reward items went too');
      if (!document.getElementById('dayRewardPrompt')) bad.push('the reward prompt the checklist rewards still use is gone');
    } finally {
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* THE CATALOG STILL RESOLVES EVERY BLOCK IT EVER NAMED.

     Retiring an activity is the one change in this app that fails INVISIBLY.
     A block whose actId nothing can resolve does not warn and does not fall
     back — it renders as nothing at all, and the only way to notice is to open
     the week it was in. So every retired id has to answer three ways: gone from
     the pickers, still resolvable, and still able to say its own name.

     The mechanism this exercises was half-built until now. getAllActivities
     applied its `archived` filter to the custom and shared lists only, so the
     flag on a built-in was read by nobody — the catalog rewrite is the first
     thing that needed it, and a rule that covers half a catalog is worse than
     no rule, because it reads as though it works. */
  if (want('theCatalogResolvesEveryBlockItEverNamed')) checks.theCatalogResolvesEveryBlockItEverNamed = await page.evaluate(() => {
    const bad = [];
    const RETIRED = [
      'acad_focus_sprint', 'acad_preview_power', 'acad_reading_star',
      'health_pack_tomorrow', 'culture_calligraphy_play',
      'leaf_hike', 'rainy_craft',
      /* The four Family Hero chores: four named jobs the paid pool already
         holds row by row, and never claimable as chores because the money side
         keys on actId === 'chores'. House Chore plus a pool row is the one way
         to say it now. */
      'family_set_table', 'family_prep_bag', 'family_laundry_fold', 'family_kitchen_helper',
    ];
    const wasProfile = profile;
    profile = 'jenn';
    try {
      const pickable = getAllActivities('jenn');
      RETIRED.forEach(id => {
        if (pickable.some(a => a.id === id)) bad.push(`${id} is retired but still offered in the picker`);

        const act = findActivity(id, 'jenn');
        if (!act) { bad.push(`a block naming ${id} resolves to nothing and would render blank`); return; }
        if (!act.name) bad.push(`${id} resolves but has no name`);
        if (!act.icon) bad.push(`${id} resolves but has no icon`);

        const shown = blockDisplayName({ actId: id }, 'jenn');
        if (!shown || !shown.name || shown.name === 'Something') {
          bad.push(`${id} renders as "${shown && shown.name}"`);
        }
        // Colour comes off the category, and an unresolvable block goes grey.
        const col = blockColour({ actId: id }, 'jenn');
        if (!col || col === '#888') bad.push(`${id} draws as the unknown-activity grey`);
        // It still counts in the hours, under a real group.
        if (!GROUP_ORDER.includes(activityGroup(act))) {
          bad.push(`${id} groups as "${activityGroup(act)}", which is not a group`);
        }
      });

      // And the half that was never wired: the flag has to actually do something.
      const all = getAllActivities('jenn', { includeArchived: true });
      if (!all.some(a => a.archived)) bad.push('nothing is archived, so this check proves nothing');
      if (pickable.some(a => a.archived)) bad.push('an archived activity reached the picker');
    } finally { profile = wasProfile; }
    return bad.length === 0 || bad;
  });

  /* EVERY ACTIVITY KNOWS WHAT IT IS FOR.

     Three fields decide where an activity's time is counted, when it is
     suggested, and what a child is asked to aim at. A new row in the catalog
     that forgets one of them does not break anything loudly: it just files its
     hours under Daily, never gets suggested, and offers an empty goal sheet. */
  if (want('everyActivityKnowsWhatItIsFor')) checks.everyActivityKnowsWhatItIsFor = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'jenn';
    /* Routines answer with their checklist instead (CLAUDE.md: a routine's
       completion IS its checklist), and Rest is deliberately a state rather
       than a task list. */
    const NO_GOALS_BY_DESIGN = ['routine_morning', 'routine_afterschool', 'routine_evening'];
    try {
      getAllActivities('jenn', { includeArchived: true }).forEach(act => {
        if (act.custom) return;   // a family's own activity sets its own terms
        const g = activityGroup(act);
        if (!GROUP_ORDER.includes(g)) bad.push(`${act.id} groups as "${g}", which is not a group`);
        if (!Array.isArray(act.suitableTime) || !act.suitableTime.length) {
          bad.push(`${act.id} says nothing about when it suits, so it is never suggested`);
        }
        if (act.isTraining || act.isRoutine || NO_GOALS_BY_DESIGN.includes(act.id)) return;
        if (!getObjectivePresets(act).length) {
          bad.push(`${act.id} offers an empty goal sheet`);
        }
      });

      // Every group the app declares must be reachable by something, or it is a
      // row on a chart that can never draw.
      const groups = new Set(getAllActivities('jenn').map(a => activityGroup(a)));
      GROUP_ORDER.forEach(g => {
        if (!groups.has(g)) bad.push(`no activity lands in "${g}" — the chart row can never draw`);
      });
    } finally { profile = wasProfile; }
    return bad.length === 0 || bad;
  });

  /* A LEGACY ACTIVITY REWARD DRAINS INSTEAD OF STICKING.
     pendingRewards syncs, and a device serving an older bundle out of a Pages
     cache can still queue an {actId} entry. There is nothing left to grant —
     she can already use the activity — so the prompt must drop it rather than
     show an offer that cannot be accepted, which would wedge the widget for
     the checklist rewards queued behind it. */
  if (want('aLegacyActivityRewardDrainsAway')) checks.aLegacyActivityRewardDrainsAway = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'jenn';
    const pr = getProfData('jenn').progress;
    const wasPending = (pr.pendingRewards || []).slice();
    try {
      pr.pendingRewards = [
        { id: 'rw-legacy', actId: 'culture_story_circle', reason: 'Placed 20 blocks' },
        { id: 'rw-list', type: 'checklist', routineId: 'morning',
          item: { id: 'mw1', text: 'Warm water with breakfast' }, reason: '5-day streak' },
      ];
      maybeShowRewardPrompt();
      const left = (pr.pendingRewards || []).map(r => r.id);
      if (left.includes('rw-legacy')) bad.push('the legacy activity reward is still queued');
      if (!left.includes('rw-list')) bad.push('draining the legacy reward took the checklist reward with it');
      const txt = (document.getElementById('dayRewardText') || {}).textContent || '';
      if (!/Warm water/.test(txt)) bad.push(`the prompt shows "${txt}" instead of the checklist reward behind it`);
    } finally {
      pr.pendingRewards = wasPending;
      profile = wasProfile;
      maybeShowRewardPrompt();
    }
    return bad.length === 0 || bad;
  });

  /* A DAY CANNOT BE REVIEWED BEFORE IT HAS HAPPENED.
     Eligibility used to ask whether a block had STARTED, so a swim that began
     ten minutes ago and runs for another hour counted as something a parent
     could sign off — the app asserting a fact about an hour nobody had lived
     yet. And a day holding NO blocks passed every check trivially, so a
     Thursday three weeks out could be marked reviewed because there was
     nothing there to object.

     canReviewDay (js/36-status.js) is the one decision now, and this asserts
     both halves plus the sentence a refused control says. */
  if (want('aDayIsNotReviewableUntilItHasHappened')) checks.aDayIsNotReviewableUntilItHasHappened = await page.evaluate(async () => {
    const bad = [];
    const wasConfirm = window.showConfirm;
    profile = 'parent'; parentViewing = 'jenn';
    const store = JSON.parse(JSON.stringify(state.shared.parentDayConfirm || {}));
    const today = todayKey();
    const past = toDayKeyInZone(new Date(Date.now() - 3 * 864e5));
    const future = toDayKeyInZone(new Date(Date.now() + 3 * 864e5));
    const beforeToday = (getDayBlocks(today, 'jenn') || []).slice();
    const beforePast = (getDayBlocks(past, 'jenn') || []).slice();
    const beforeFuture = (getDayBlocks(future, 'jenn') || []).slice();
    try {
      window.showConfirm = async () => true;
      ['jenn', 'jess'].forEach(k => [today, past, future].forEach(d => markDayReviewed(k, d, false)));

      /* ── Still running: started, but not over ── */
      const now = tdNowMin();
      setDayBlocks(today, [{ id: 'cr1', actId: 'piano', startMin: Math.max(0, now - 10),
                             durationMin: 120, checklistState: {} }], 'jenn');
      if (dayBlocksEligibleToConfirm(today, 'jenn').some(b => b.id === 'cr1')) {
        bad.push('a block that has started but not ended was eligible to confirm');
      }
      const running = canReviewDay('jenn', today);
      if (running.ok) bad.push('today was reviewable while an activity was still running');
      if (running.reason !== 'running') bad.push(`a running day gave reason '${running.reason}'`);
      if (!/ends at/.test(reviewBlockedReason(running))) {
        bad.push(`the refusal does not say when it ends: "${reviewBlockedReason(running)}"`);
      }
      await markDayReviewedForChild('jenn', today);
      if (isDayReviewed('jenn', today)) bad.push('a day with a running activity was marked reviewed anyway');

      /* ── Over, but nobody has confirmed it ── */
      setDayBlocks(past, [{ id: 'cp1', actId: 'piano', startMin: 9 * 60,
                            durationMin: 60, checklistState: {} }], 'jenn');
      const unconf = canReviewDay('jenn', past);
      if (unconf.ok) bad.push('a past day was reviewable with a block still unconfirmed');
      if (unconf.reason !== 'unconfirmed') bad.push(`an unconfirmed day gave reason '${unconf.reason}'`);
      if (unconf.pendingCount !== 1) bad.push(`pendingCount was ${unconf.pendingCount}, expected 1`);
      const blocks = getDayBlocks(past, 'jenn');
      blocks.forEach(b => { b.completed = true; b.confirmed = true; });
      setDayBlocks(past, blocks, 'jenn');
      const ready = canReviewDay('jenn', past);
      if (!ready.ok) bad.push(`a finished, confirmed past day was still refused: ${ready.reason}`);
      if (ready.reason !== 'ready') bad.push(`a finished day gave reason '${ready.reason}'`);

      /* ── A day that has not arrived, empty or not ── */
      setDayBlocks(future, [], 'jenn');
      const ahead = canReviewDay('jenn', future);
      if (ahead.ok) bad.push('an empty future day was reviewable');
      if (ahead.reason !== 'future') bad.push(`a future day gave reason '${ahead.reason}'`);
      await markDayReviewedForChild('jenn', future);
      if (isDayReviewed('jenn', future)) bad.push('an empty future day was marked reviewed');

      /* ── An empty PAST day is reviewable, but says it is empty ── */
      setDayBlocks(past, [], 'jenn');
      const blank = canReviewDay('jenn', past);
      if (!blank.ok) bad.push('a past day with nothing on it could not be reviewed');
      if (blank.reason !== 'empty') bad.push(`a blank past day gave reason '${blank.reason}'`);

      /* ── The refused control carries the reason, not a generic line ── */
      setDayBlocks(today, [{ id: 'cr2', actId: 'piano', startMin: Math.max(0, now - 10),
                             durationMin: 120, checklistState: {} }], 'jenn');
      currentDayKey = today;
      renderParentBanners();
      const btn = document.querySelector('#parentDayActions .pb-action[disabled]');
      if (!btn) bad.push('the review button was not disabled while an activity was running');
      else if (!/ends at/.test(btn.getAttribute('title') || '')) {
        bad.push(`the disabled button does not say why: "${btn.getAttribute('title')}"`);
      }

      /* ── The week cannot be held open by a day that has not happened ── */
      const futureOnly = canReviewDay('jenn', future);
      if (futureOnly.reason !== 'future') bad.push('the week-close gate would count a future day');
    } finally {
      window.showConfirm = wasConfirm;
      setDayBlocks(today, beforeToday, 'jenn');
      setDayBlocks(past, beforePast, 'jenn');
      setDayBlocks(future, beforeFuture, 'jenn');
      state.shared.parentDayConfirm = store;
      profile = 'jenn';
    }
    return bad.length === 0 || bad;
  });

  /* A SKIPPED BLOCK IS RECORDED, NOT DELETED.
     Reviewing a past week, a day whose chores were planned and not done could
     not be marked reviewed at all: canReviewDay wanted every elapsed block
     confirmed, and every route out of that stated something false. "Confirm
     all" marks them done AND grades their chores at "on time"; the edit
     sheet's confirm toggle grades a chore nobody claimed; deleting the blocks
     rewrites the plan the reflection reads. The day then held the whole week
     open through canCloseWeek, for the one reason a parent had no move
     against.

     This asserts the third answer end to end: the plan survives, nothing reads
     as done, the money comes back, and the day becomes reviewable. */
  if (want('aSkippedBlockIsRecordedNotDeleted')) checks.aSkippedBlockIsRecordedNotDeleted = await page.evaluate(async () => {
    const bad = [];
    const wasProfile = profile;
    const wasConfirm = window.showConfirm;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const past = toDayKeyInZone(new Date(Date.now() - 3 * 864e5));
    const wk = ctWeekKeyForDate(past);
    const dayIdx = Math.round((formatDayKey(past) - formatDayKey(wk)) / 864e5);
    const before = (getDayBlocks(past, 'jenn') || []).slice();
    const store = JSON.parse(JSON.stringify(state.shared.parentDayConfirm || {}));
    try {
      window.showConfirm = async () => true;
      markDayReviewed('jenn', past, false);
      setDayBlocks(past, [{ id: 'nd1', actId: 'piano', startMin: 9 * 60,
                            durationMin: 60, checklistState: {} }], 'jenn');

      if (canReviewDay('jenn', past).reason !== 'unconfirmed') {
        bad.push('a past day with an unanswered block did not report unconfirmed');
      }
      await markRemainingNotDoneForChild('jenn', past);

      const after = getDayBlocks(past, 'jenn') || [];
      const blk = after.find(b => b.id === 'nd1');
      // The plan is what the reflection reads. Recording is not deleting.
      if (!blk) bad.push('the block was removed rather than recorded');
      if (blk && !isBlockNotDone(blk)) bad.push('the block was not marked as not done');
      if (blk && isBlockConfirmed(blk)) bad.push('a not-done block also reads as confirmed');
      if (blk && isBlockCompleted(blk, 'jenn')) bad.push('a not-done block reads as completed');
      if (blk && !blk.updatedAt) bad.push('the write was not stamped, so a sync can undo it');

      // It stops being something left to confirm, so "Confirm all" cannot
      // sweep it back into being done.
      if (dayBlocksEligibleToConfirm(past, 'jenn').some(b => b.id === 'nd1')) {
        bad.push('a not-done block was still eligible for Confirm all');
      }
      if (dayBlocksAwaitingAccount('jenn', past).length !== 0) {
        bad.push('the day still reports something waiting after it was answered');
      }
      // …and the day can finally be reviewed.
      const can = canReviewDay('jenn', past);
      if (!can.ok) bad.push(`the day was still refused after being answered: ${can.reason}`);

      /* The marker renders on both surfaces. A record nobody can see is the
         same as no record — and it must be a MARKER, not a fade: --missed was
         removed deliberately, so the block keeps its own colour at full
         strength. */
      currentDayKey = past; dayViewAnchorKey = past;
      buildTimeline();
      const dayEl = document.querySelector('#screen-day .placed-block--notdone');
      if (!dayEl) bad.push('the day view does not mark a not-done block');
      if (dayEl && !dayEl.querySelector('.badge-notdone')) {
        bad.push('the day view marker carries no badge');
      }
      if (dayEl) {
        const cs = getComputedStyle(dayEl);
        if (Number(cs.opacity) < 1) bad.push('a not-done block is faded, which reads as failure');
      }
    } catch (e) {
      bad.push('threw: ' + e.message);
    } finally {
      window.showConfirm = wasConfirm;
      setDayBlocks(past, before, 'jenn');
      state.shared.parentDayConfirm = store;
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* RECORDING IT TAKES THE MONEY BACK, AND SAYS SO FIRST.
     A chore block's grade IS money: a parent confirming the block grades it at
     "on time" and that pays. So a block recorded as not having happened must
     not leave its chore reading as fulfilled and paid — and a parent taking
     money back must be shown the figure before it moves, never discover it
     afterwards. */
  if (want('recordingNotDoneTakesTheMoneyBack')) checks.recordingNotDoneTakesTheMoneyBack = await page.evaluate(async () => {
    const bad = [];
    const wasProfile = profile;
    const wasConfirm = window.showConfirm;
    let sawMessage = '';
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const past = toDayKeyInZone(new Date(Date.now() - 3 * 864e5));
    const wk = ctWeekKeyForDate(past);
    const dayIdx = Math.round((formatDayKey(past) - formatDayKey(wk)) / 864e5);
    const before = (getDayBlocks(past, 'jenn') || []).slice();
    const row = (mrPoolRows(wk) || []).find(r => mrLanePays(r.lane)
      && (r.who === 'both' || r.who === 'jenn'));
    try {
      if (!row) { bad.push('no paying chore in the pool to test with'); return bad; }
      window.showConfirm = async (msg) => { sawMessage = String(msg || ''); return true; };

      setDayBlocks(past, [{ id: 'ndm1', actId: 'chores', choreTags: [row.id],
                            startMin: 9 * 60, durationMin: 30, checklistState: {} }], 'jenn');
      mrSetChoreGrade('jenn', wk, dayIdx, row.id, 3);
      if (!(mrGetChoreGrade('jenn', wk, dayIdx, row.id) > 0)) {
        bad.push('the fixture grade did not take');
      }
      const paidBefore = getFamilyChoreStatus('jenn', wk).fulfilled;

      await markRemainingNotDoneForChild('jenn', past);

      // The confirmation named the chore and the figure BEFORE anything moved.
      if (!/\$/.test(sawMessage)) bad.push('the confirmation did not name any money');
      if (sawMessage && sawMessage.indexOf(row.label) === -1) {
        bad.push('the confirmation did not name the chore losing its grade');
      }
      if (!/XP/.test(sawMessage)) {
        bad.push('the confirmation did not say XP already earned stays');
      }
      // …and then it actually moved.
      if (mrGetChoreGrade('jenn', wk, dayIdx, row.id) !== 0) {
        bad.push('the grade survived, so the week still pays for work nobody did');
      }
      if (mrGetClaim('jenn', wk, dayIdx, row.id) !== 0) {
        bad.push('an unanswered claim survived');
      }
      const st = getFamilyChoreStatus('jenn', wk);
      if (st.fulfilled >= paidBefore && paidBefore > 0) {
        bad.push('the chore still reads as fulfilled');
      }
    } catch (e) {
      bad.push('threw: ' + e.message);
    } finally {
      window.showConfirm = wasConfirm;
      try { mrSetChoreGrade('jenn', wk, dayIdx, row && row.id, 0); } catch (e) {}
      setDayBlocks(past, before, 'jenn');
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* THE MEETING OFFERS A WAY OUT OF AN UNCONFIRMED DAY, AND A WAY TO THE PLAN.
     Two findings drove this. A day refused only for `unconfirmed` was a hard
     refusal everywhere, so a backlogged week stuck with no move a parent could
     make. And step 1 had NO route to the day or the week at all: openkidday
     was dispatched with no button anywhere rendering it, and the only openweek
     button in the app was in step 2.

     The offer is inline on the row rather than a modal, because a three-button
     sheet would be a second dialog mechanism beside openSheet/closeSheet, which
     own focus and Escape. */
  if (want('theMeetingOffersAWayOutOfAnUnconfirmedDay')) checks.theMeetingOffersAWayOutOfAnUnconfirmedDay = await page.evaluate(async () => {
    const bad = [];
    const wasProfile = profile;
    const wasConfirm = window.showConfirm;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead();
    const past = toDayKeyInZone(new Date(Date.now() - 3 * 864e5));
    const wk = ctWeekKeyForDate(past);
    const dayIdx = Math.round((formatDayKey(past) - formatDayKey(wk)) / 864e5);
    const today = todayKey();
    const store = JSON.parse(JSON.stringify(state.shared.parentDayConfirm || {}));
    const beforePast = (getDayBlocks(past, 'jenn') || []).slice();
    const beforeToday = (getDayBlocks(today, 'jenn') || []).slice();
    try {
      window.showConfirm = async () => true;
      openFamilyMeeting();
      mmGoToWeek(wk);
      mmGoStep(1);
      markDayReviewed('jenn', past, false);
      setDayBlocks(past, [{ id: 'mb1', actId: 'piano', startMin: 9 * 60,
                            durationMin: 60, checklistState: {} }], 'jenn');
      renderMeetingMode();

      /* ── The offer is on the row, with all three answers ── */
      const offer = document.querySelector('#screen-meeting .mm-drow-offer');
      if (!offer) bad.push('an unconfirmed day row carries no offer');
      const actions = offer
        ? Array.from(offer.querySelectorAll('[data-mm-action]')).map(b => b.getAttribute('data-mm-action'))
        : [];
      ['nd-leave', 'nd-open', 'nd-record'].forEach(a => {
        if (actions.indexOf(a) === -1) bad.push(`the offer is missing ${a}`);
      });
      // Every control a grown-up taps keeps the 44px floor.
      (offer ? Array.from(offer.querySelectorAll('button')) : []).forEach(b => {
        if (b.getBoundingClientRect().height < 44) {
          bad.push('an offer button is under the 44px floor');
        }
      });

      /* ── The control is enabled for `unconfirmed`, refused for `running` ── */
      const cell = document.querySelector(
        `#screen-meeting .mm-drow-kid[data-kid="jenn"][data-day="${dayIdx}"]`);
      if (cell && cell.disabled) bad.push('an unconfirmed day is still a hard refusal');
      if (cell && !(cell.getAttribute('title') || '').length) {
        bad.push('the enabled control does not say why it is offering anything');
      }

      /* ── STEP 1 AND STEP 2 BOTH REACH THE WEEK, on a PAST week ── */
      const wkBtns = document.querySelectorAll(
        '#screen-meeting [data-mm-action="openweek"]');
      if (wkBtns.length < 2) {
        bad.push(`step 1 offers ${wkBtns.length} open-week buttons, expected one per child`);
      }
      mmGoStep(2);
      const wkBtns2 = document.querySelectorAll(
        '#screen-meeting [data-mm-action="openweek"]');
      if (wkBtns2.length < 2) {
        bad.push(`step 2 offers ${wkBtns2.length} open-week buttons on a past week`);
      }
      mmGoStep(1);

      /* ── "Leave them" reviews and moves nothing ── */
      mmReviewLeavingBlocks('jenn', dayIdx);
      if (!isDayReviewed('jenn', past)) bad.push('Leave them did not review the day');
      const kept = (getDayBlocks(past, 'jenn') || []).find(b => b.id === 'mb1');
      if (!kept) bad.push('Leave them removed the block');
      if (kept && (kept.confirmed || kept.notDone || kept.completed)) {
        bad.push('Leave them changed what the block says');
      }

      /* ── A running day is still refused outright ── */
      const now = tdNowMin();
      markDayReviewed('jenn', today, false);
      setDayBlocks(today, [{ id: 'mb2', actId: 'piano', startMin: Math.max(0, now - 10),
                             durationMin: 180, checklistState: {} }], 'jenn');
      const run = canReviewDay('jenn', today);
      if (mmOverridableRefusal(run)) bad.push('a running day was treated as overridable');
      renderMeetingMode();
      const todayIdx = Math.round((formatDayKey(today) - formatDayKey(ctWeekKeyForDate(today))) / 864e5);

      /* ── …and the DAY BANNER keeps its hard refusal. The override is the
            meeting's, not the day screen's. ── */
      markDayReviewed('jenn', past, false);
      currentDayKey = past;
      renderParentBanners();
      const banner = document.querySelector('#parentDayActions .pb-action[disabled]');
      if (!banner) bad.push('the day banner stopped refusing an unconfirmed day');
    } catch (e) {
      bad.push('threw: ' + e.message);
    } finally {
      window.showConfirm = wasConfirm;
      try { mmHide(); } catch (e) {}
      setDayBlocks(past, beforePast, 'jenn');
      setDayBlocks(today, beforeToday, 'jenn');
      state.shared.parentDayConfirm = store;
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* ONLY THE ROUTINES A DAY ASKED FOR ARE EVALUATED.
     All three sessions were evaluated on every day of every week, so a family
     that never planned an after-school routine was permanently marked down for
     one: a tick offered for something nobody had asked the child to do, counted
     against her in the day percentage, and a clean day she could never reach.

     The rule: the plan decides when there IS one, and otherwise the day type
     does — three on a school day, two on a weekend or school-free day, because
     there is no after-school routine on a day with no school. Which kind of day
     it is comes from isSchoolDay, never from the day of the week. */
  if (want('onlyThePlannedRoutinesAreEvaluated')) checks.onlyThePlannedRoutinesAreEvaluated = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const keys = mrWeekDayKeys(wk);
    const schoolIdx = keys.findIndex(k => isSchoolDay(k));
    const offIdx = keys.findIndex(k => !isSchoolDay(k));
    const saved = {};
    keys.forEach((k, i) => { saved[i] = (getDayBlocks(k, 'jenn') || []).slice(); });
    try {
      if (schoolIdx < 0 || offIdx < 0) {
        bad.push('this week has no school day and no off day to compare');
        return bad;
      }
      // Nothing planned anywhere: the DEFAULT for each kind of day stands.
      keys.forEach(k => setDayBlocks(k, [], 'jenn'));
      const onSchool = routineSessionsForDay('jenn', wk, schoolIdx);
      const onOff = routineSessionsForDay('jenn', wk, offIdx);
      if (onSchool.length !== 3) {
        bad.push(`a school day with nothing planned asked for ${onSchool.length}, expected 3`);
      }
      if (onOff.length !== 2) {
        bad.push(`an off day with nothing planned asked for ${onOff.length}, expected 2`);
      }
      const afternoon = CT_ROUTINE_SESSION_MAP.afterschool;
      if (onOff.includes(afternoon)) {
        bad.push('an off day still asks for the after-school routine');
      }

      // Plan ONE routine on the school day: that is now the whole ask.
      setDayBlocks(keys[schoolIdx], [{ id: 'rs1', actId: 'routine_morning',
        startMin: 7 * 60, durationMin: 30, checklistState: {} }], 'jenn');
      const planned = routineSessionsForDay('jenn', wk, schoolIdx);
      if (planned.length !== 1 || planned[0] !== CT_ROUTINE_SESSION_MAP.morning) {
        bad.push(`a day planning one routine asked for ${JSON.stringify(planned)}`);
      }

      /* The money reads the SAME owner, so a clean day and the rows a parent
         sees cannot disagree. Ticking just the planned one makes the day
         clean. */
      CT_SESSIONS.forEach(sn => ctSetMandatory(wk, schoolIdx, sn, 'jenn', false));
      ctSetMandatory(wk, schoolIdx, CT_ROUTINE_SESSION_MAP.morning, 'jenn', true);
      if (!mrStreakDayDone(wk, 'jenn', schoolIdx)) {
        bad.push('a day whose only planned routine was kept did not count as clean');
      }

      /* The meeting shows exactly those rows, and its bulk control writes
         exactly those sessions — the label and the button must move together or
         the label lies about what the button did. */
      const rows = mmReviewRows('jenn', schoolIdx).filter(r => r.kind === 'routine');
      if (rows.length !== 1) bad.push(`the meeting offered ${rows.length} routine rows, expected 1`);
      mmSelectDay(schoolIdx);
      openFamilyMeeting(); mmGoStep(1); renderMeetingMode();
      const footer = document.querySelector('#screen-meeting .mm-routine-all');
      if (footer && /three/i.test(footer.textContent)) {
        bad.push(`the footer still says three: "${footer.textContent.trim()}"`);
      }
      mmToggleAllRoutines('jenn', schoolIdx);
      if (ctGetMandatory(wk, schoolIdx, afternoon, 'jenn')) {
        bad.push('the bulk control ticked a routine the day never asked for');
      }

      /* A denominator worked out on two screens is the drift this change
         exists to end: the parent day card said "/3" whatever the day asked. */
      cpDay = offIdx;
      const cp = cpDayCards();
      if (/\/3 routines closed/.test(cp) && onOff.length !== 3) {
        bad.push('the parent day card still counts routines out of three');
      }
    } catch (e) {
      bad.push('threw: ' + e.message);
    } finally {
      try { mmHide(); } catch (e) {}
      keys.forEach((k, i) => setDayBlocks(k, saved[i], 'jenn'));
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* …AND EVERY WEEK IS PRICED BY IT, INCLUDING THE ONES ALREADY LIVED.
     This check used to assert the opposite, and the opposite was the defect.

     The rule was held back behind `routineRuleStartWeek` so that requiring
     fewer routines could not quietly pay more for weeks already lived. The
     reasoning was sound; the mechanism was not. That store SEEDED ITSELF to
     the current Monday, so on any device running a new build it held back the
     rule for every week the family had ever lived — and the money then asked
     for three routines a day on days no plan contained one.

     The exact cost, which is where this whole redesign started: the week of
     Mon 7 Sep 2026 opens on Labour Day, so Monday, Saturday and Sunday each
     wanted an after-school routine that was never planned. The longest clean
     run came to four days instead of seven, the streak paid the 3-day step —
     $1 instead of $3 — and her own week grid read 7/7 beside it with nothing
     anywhere to say why.

     So: an off day asks for two routines, and keeping both makes the day clean
     for the MONEY as well as on the screen, in a week from any time. */
  if (want('theRoutineRulePricesEveryWeekAlike')) checks.theRoutineRulePricesEveryWeekAlike = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead();
    // A week well before anything this family has on file.
    const oldMon = formatDayKey(ctThisWeekKey());
    oldMon.setDate(oldMon.getDate() - 28 * 7);
    const oldWk = ctDateToKey(oldMon);
    const keys = mrWeekDayKeys(oldWk);
    const offIdx = keys.findIndex(k => !isSchoolDay(k));
    const saved = {};
    keys.forEach((k, i) => { saved[i] = (getDayBlocks(k, 'jenn') || []).slice(); });
    try {
      if (offIdx < 0) { bad.push('no off day in the sample old week'); return bad; }
      keys.forEach(k => setDayBlocks(k, [], 'jenn'));
      CT_SESSIONS.forEach(sn => ctSetMandatory(oldWk, offIdx, sn, 'jenn', false));
      const asked = routineSessionsForDay('jenn', oldWk, offIdx);
      asked.forEach(sn => ctSetMandatory(oldWk, offIdx, sn, 'jenn', true));

      // A day with no school asks for two, on screen and in the money alike.
      if (asked.length !== 2) bad.push('an off day does not ask for two routines');
      if (!mrStreakDayDone(oldWk, 'jenn', offIdx)) {
        bad.push('keeping every routine an old off day asked for is not a clean day');
      }
      // And the money side asks the same question the screen does — one owner,
      // so a parent ticking everything offered can never watch the streak sit
      // still with nothing to explain it.
      const moneyAsked = mrRoutineSessionsFor(oldWk, 'jenn', offIdx);
      if (moneyAsked.length !== asked.length) {
        bad.push('the money asks for ' + moneyAsked.length + ' where the screen shows ' + asked.length);
      }
    } catch (e) {
      bad.push('threw: ' + e.message);
    } finally {
      keys.forEach((k, i) => setDayBlocks(k, saved[i], 'jenn'));
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* A PLANNED COMPETITION MUST BE SCORED BEFORE THE WEEK SETTLES.
     A meet could be planned and then never recorded, and nothing asked. Worse,
     the answer was unsayable: $0 in the totals reads identically for "no meet",
     "a meet worth nothing", "a voided channel" and "an override to zero". */
  if (want('aPlannedCompetitionMustBeScored')) checks.aPlannedCompetitionMustBeScored = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const keys = mrWeekDayKeys(wk);
    const dayKey = keys[1];
    const before = (getDayBlocks(dayKey, 'jenn') || []).slice();
    const compsBefore = mrCompetitions('jenn').slice();
    try {
      setDayBlocks(dayKey, [{ id: 'cmp1', actId: 'competition', compName: 'City Meet',
                              tag: 'swimming', startMin: 9 * 60, durationMin: 180,
                              checklistState: {} }], 'jenn');
      const planned = mmPlannedCompetitions(wk, 'jenn');
      if (!planned.length) bad.push('a competition block was not read off the plan');
      if (!mmUnrecordedCompetitions(wk, 'jenn').length) {
        bad.push('a planned meet with no result did not read as unrecorded');
      }
      // It blocks settling…
      const barBlocked = mnyConfirmBar(wk, 'jenn');
      if (!/no result yet/.test(barBlocked)) {
        bad.push('an unscored competition does not block the confirm bar');
      }
      // …and an explicit $0 is a real answer that clears it.
      mnyRecordCompZero('jenn', dayKey, 'City Meet', 'swim');
      const rec = mrCompetitions('jenn').find(c => c.name === 'City Meet');
      if (!rec) bad.push('a no-criteria-met result was not persisted');
      if (rec && rec.awarded !== 0) bad.push(`a zero result was worth ${rec.awarded}`);
      if (mmUnrecordedCompetitions(wk, 'jenn').length) {
        bad.push('a saved $0 result did not clear the unrecorded list');
      }
      const barClear = mnyConfirmBar(wk, 'jenn');
      if (/no result yet/.test(barClear)) bad.push('a saved $0 result still blocks settling');

      /* Two meets on one day are two questions. Matching on dayKey alone meant
         recording either one answered for both. */
      const second = mmCompKey(dayKey, 'Other Meet') !== mmCompKey(dayKey, 'City Meet');
      if (!second) bad.push('two meets on one day share a key');

      // The NaN: a rules version with no provincialPerPoint must score 0, not NaN.
      const score = mrScoreCompetition(
        { sport: 'swim', points: 6, provincial: true },
        { competition: { swim: { perPoint: 1, qualifyBonus: 20 } } });
      if (!Number.isFinite(score)) bad.push('a missing provincial rate still yields NaN');
    } catch (e) {
      bad.push('threw: ' + e.message);
    } finally {
      setDayBlocks(dayKey, before, 'jenn');
      getProfData('jenn').competitions = compsBefore;
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* A GIFT A CHILD RECORDS IS A PROPOSAL, NOT A CREDIT.
     mnyAddDeposit was the one money mutator in the app with no isParent()
     check, which was safe only while it lived behind the meeting. Now that a
     gift credits the wallet the moment it is recorded, and can be recorded from
     a kid-visible page, its absence would let a child hand herself any sum. */
  if (want('aGiftFromAChildWaitsForAGrownUp')) checks.aGiftFromAChildWaitsForAGrownUp = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctThisWeekKey();
    const depsBefore = (getProfData('jenn').deposits || []).slice();
    const cashBefore = ensureWallet('jenn').cash;
    try {
      /* ── As the CHILD: proposed, and nothing moves ── */
      profile = 'jenn';
      const proposed = mnyAddDeposit('jenn', wk, { amount: 20, from: 'Birthday money', giver: 'Grandma' });
      if (!proposed) { bad.push('a child could not even propose a gift'); return bad; }
      if (!proposed.pendingApproval) bad.push('a child\'s gift was not marked as waiting');
      if (proposed.appliedAt) bad.push('a child\'s gift reached the wallet at once');
      if (ensureWallet('jenn').cash !== cashBefore) {
        bad.push('a child credited herself');
      }
      if (proposed.giver !== 'Grandma') bad.push('the giver was not kept');
      // It is not money yet, so it must not raise the pool or its caps.
      if (mnyDepositTotal('jenn', wk) !== 0) {
        bad.push('an unapproved gift counted as money that came in');
      }

      /* ── A parent approves it: the money moves ONCE ── */
      profile = 'parent'; parentViewing = 'jenn';
      mnyApproveDeposit('jenn', proposed.id);
      const after = (getProfData('jenn').deposits || []).find(d => d.id === proposed.id);
      if (after && after.pendingApproval) bad.push('approval did not clear the wait');
      if (!after || !after.appliedAt) bad.push('approval did not stamp it as applied');
      if (ensureWallet('jenn').cash !== cashBefore + 20) {
        bad.push(`approval credited ${ensureWallet('jenn').cash - cashBefore}, expected 20`);
      }
      // …and cannot move it again.
      mnyApproveDeposit('jenn', proposed.id);
      if (ensureWallet('jenn').cash !== cashBefore + 20) {
        bad.push('approving twice credited twice');
      }

      /* ── Taking the record away takes the money with it ── */
      mnyRemoveDeposit('jenn', proposed.id);
      if (ensureWallet('jenn').cash !== cashBefore) {
        bad.push('removing an applied gift left the cash behind');
      }

      /* ── A PARENT's own entry needs no approval ── */
      const direct = mnyAddDeposit('jenn', wk, { amount: 5, from: 'A gift' });
      if (direct && direct.pendingApproval) bad.push('a parent\'s own gift was held for approval');
      if (ensureWallet('jenn').cash !== cashBefore + 5) {
        bad.push('a parent\'s own gift did not credit at once');
      }
      if (direct) mnyRemoveDeposit('jenn', direct.id);
    } catch (e) {
      bad.push('threw: ' + e.message);
    } finally {
      getProfData('jenn').deposits = depsBefore;
      ensureWallet('jenn').cash = cashBefore;
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* THE DEFAULT SWEEP CREDITS ONCE, AND LEAVES THE REACHABLE WEEKS ALONE.
     mmUnsettledWeeks looks back eight weeks and stops, so older un-met weeks
     are invisible AND unsettleable — they sit there forever and their money is
     never credited. A flat default clears them, and the guard that makes it
     safe is the one commitKidWeek already uses. */
  if (want('theDefaultSweepCreditsOldWeeksOnce')) checks.theDefaultSweepCreditsOldWeeksOnce = await page.evaluate(async () => {
    const bad = [];
    const wasProfile = profile;
    const wasConfirm = window.showConfirm;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead();
    const c = state.shared.chore;
    const savedFinal = JSON.parse(JSON.stringify(c.finalizedWeeks || {}));
    const savedLedger = JSON.parse(JSON.stringify(c.moneyLedger || {}));
    const savedHeld = JSON.parse(JSON.stringify(c.meetingsHeld || {}));
    const savedProgram = c.programStartDate;
    const cashBefore = { jenn: ensureWallet('jenn').cash, jess: ensureWallet('jess').cash };
    try {
      window.showConfirm = async () => true;
      // A start date well back, so there are weeks beyond the catch-up reach.
      const mon = formatDayKey(ctThisWeekKey());
      mon.setDate(mon.getDate() - 16 * 7);
      const start = ctDateToKey(mon);
      c.programStartDate = start;
      c.finalizedWeeks = {}; c.moneyLedger = {}; c.meetingsHeld = {};

      const plan = mnyDefaultSweepPlan();
      if (!plan.weeks.length) { bad.push('no weeks were found beyond the catch-up reach'); return bad; }

      // Nothing inside the catch-up window may be touched.
      const reachable = new Set(mmUnsettledWeeks(8).map(u => u.wk));
      if (plan.weeks.some(w => reachable.has(w.wk))) {
        bad.push('the sweep reached a week the catch-up list can still settle');
      }
      /* ── THE $3 DEFAULT IS BACKFILL, NEVER A FLOOR ──
         It was agreed for weeks that had already gone by before the family
         switched to earning and spending. Going forward a quiet week pays what
         she earned, which may be nothing, and that is the system working — a
         guaranteed $3 for a week nobody sat down for would pay better than a
         quiet week actually lived, and would teach the opposite of the thing
         this whole redesign is for.

         `mnyDefaultSweepPlan` walks BACKWARDS from one week beyond the reach,
         so this holds today. It is asserted because the failure would be
         silent and generous: money appearing in a child's wallet for a week
         she is still living. */
      const thisWk = ctThisWeekKey();
      const forward = plan.weeks.filter(w => String(w.wk) >= String(thisWk));
      if (forward.length) {
        bad.push('the sweep would credit the current or a future week: ' + forward.map(w => w.wk).join(', '));
      }

      const expect = plan.total;
      await mnyRunDefaultSweep();
      const moved = (ensureWallet('jenn').cash - cashBefore.jenn)
                  + (ensureWallet('jess').cash - cashBefore.jess);
      if (Math.abs(moved - expect) > 0.005) {
        bad.push(`the sweep credited ${moved}, the preview said ${expect}`);
      }
      // Labelled, not disguised as a week's earnings.
      const row = (c.moneyLedger[plan.weeks[0].wk] || {}).jenn;
      if (!row) bad.push('no ledger row was written for a defaulted week');
      if (row && !row.defaulted) bad.push('a defaulted week is not marked as one');
      if (row && !row.handEntered) bad.push('a defaulted row cannot be corrected by mnyEditLedger');

      // Idempotent: running it again credits nothing.
      await mnyRunDefaultSweep();
      const movedAgain = (ensureWallet('jenn').cash - cashBefore.jenn)
                       + (ensureWallet('jess').cash - cashBefore.jess);
      if (Math.abs(movedAgain - expect) > 0.005) {
        bad.push('a second run credited again');
      }
    } catch (e) {
      bad.push('threw: ' + e.message);
    } finally {
      window.showConfirm = wasConfirm;
      c.finalizedWeeks = savedFinal; c.moneyLedger = savedLedger; c.meetingsHeld = savedHeld;
      c.programStartDate = savedProgram;
      ensureWallet('jenn').cash = cashBefore.jenn;
      ensureWallet('jess').cash = cashBefore.jess;
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* SETTLED MONEY CANNOT BE TAKEN BACK, AND NOTHING MAY CLAIM IT CAN.
     A week's money is committed at the meeting and there is genuinely no way
     back: nothing clears committedAt, mnyReopenWeek refuses a committed week
     outright, and the meeting's Undo is a session-local snapshot gone the
     moment the sheet closes.

     Writing this check is what found the bug it now guards. An earlier draft
     of the meeting's offer said "Reopen her week", called mnyReopenWeek — which
     returns false for exactly this case — and then toasted that it had
     reopened. A button announcing something it had not done.

     The guard is narrow on purpose: it refuses the blocks whose GRADES would
     move, not the day. A swim recorded as not done in a settled week costs
     nothing, and refusing it would make a whole week unrecordable to protect a
     grade that is not there. */
  if (want('settledMoneyCannotBeQuietlyTakenBack')) checks.settledMoneyCannotBeQuietlyTakenBack = await page.evaluate(async () => {
    const bad = [];
    const wasProfile = profile;
    const wasConfirm = window.showConfirm;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const past = toDayKeyInZone(new Date(Date.now() - 3 * 864e5));
    const wk = ctWeekKeyForDate(past);
    const dayIdx = Math.round((formatDayKey(past) - formatDayKey(wk)) / 864e5);
    const before = (getDayBlocks(past, 'jenn') || []).slice();
    const c = mnyEnsureWeekMaps();
    const savedPlans = JSON.parse(JSON.stringify(c.weekPlans || {}));
    const row = (mrPoolRows(wk) || []).find(r => mrLanePays(r.lane)
      && (r.who === 'both' || r.who === 'jenn'));
    try {
      if (!row) { bad.push('no paying chore in the pool to test with'); return bad; }
      window.showConfirm = async () => true;

      /* A graded chore block and a plain block on the same settled day. */
      setDayBlocks(past, [
        { id: 'fz1', actId: 'chores', choreTags: [row.id], startMin: 9 * 60, durationMin: 30, checklistState: {} },
        { id: 'fz2', actId: 'piano', startMin: 15 * 60, durationMin: 45, checklistState: {} },
      ], 'jenn');
      mrSetChoreGrade('jenn', wk, dayIdx, row.id, 3);

      // Settle the week for Jenn, exactly as step 4 does.
      if (!c.weekPlans[wk]) c.weekPlans[wk] = {};
      c.weekPlans[wk].jenn = { planId: 'balanced', committedAt: syncNow(), updatedAt: syncNow() };
      if (!mnyIsCommitted(wk, 'jenn')) { bad.push('the fixture did not settle the week'); return bad; }

      /* mnyReopenWeek is NOT a door out of a settled week — this is the fact the
         earlier draft got wrong, asserted so it cannot be got wrong again. */
      if (mnyReopenWeek('jenn', wk) !== false) {
        bad.push('mnyReopenWeek claimed it reopened a committed week');
      }
      if (!mnyIsCommitted(wk, 'jenn')) bad.push('a committed week came uncommitted');

      const gradeBefore = mrGetChoreGrade('jenn', wk, dayIdx, row.id);
      const n = await markRemainingNotDoneForChild('jenn', past);

      // The graded chore keeps its grade…
      if (mrGetChoreGrade('jenn', wk, dayIdx, row.id) !== gradeBefore) {
        bad.push('a settled week lost a grade the wallet had already paid');
      }
      const blocks = getDayBlocks(past, 'jenn') || [];
      const chore = blocks.find(b => b.id === 'fz1');
      if (chore && isBlockNotDone(chore)) {
        bad.push('the graded chore block was recorded not done anyway');
      }
      // …and the block that costs nothing is still recordable, so the review
      // can finish rather than the whole day being held hostage to one grade.
      const piano = blocks.find(b => b.id === 'fz2');
      if (!piano || !isBlockNotDone(piano)) {
        bad.push('a block with no money on it was refused too');
      }
      if (n !== 1) bad.push(`recorded ${n} blocks, expected only the free one`);
    } catch (e) {
      bad.push('threw: ' + e.message);
    } finally {
      window.showConfirm = wasConfirm;
      try { mrSetChoreGrade('jenn', wk, dayIdx, row && row.id, 0); } catch (e) {}
      c.weekPlans = savedPlans;
      setDayBlocks(past, before, 'jenn');
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* A MEETING TAP HITS THE ROW IT NAMES — BEFORE AND AFTER THE SET CHANGES.
     mmToggleItem used to take a position and index mmReviewRows(kid,d)[idx],
     with the rendered button carrying that index. Safe only while every day
     produced the same rows. Now that the routine set varies per day, a stale
     index would toggle the wrong session — or fall past the routines into the
     chore branch and write a GRADE, which is money.

     The second half is the one that matters: re-render with MORE rows and tap
     again. A positional scheme passes the first half and fails this. */
  if (want('theMeetingTapHitsTheRowItNames')) checks.theMeetingTapHitsTheRowItNames = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const keys = mrWeekDayKeys(wk);
    const d = 2;
    const dayKey = keys[d];
    const before = (getDayBlocks(dayKey, 'jenn') || []).slice();
    const row = (mrPoolRows(wk) || []).find(r => mrLanePays(r.lane)
      && (r.who === 'both' || r.who === 'jenn'));
    const morning = CT_ROUTINE_SESSION_MAP.morning;
    const afternoon = CT_ROUTINE_SESSION_MAP.afterschool;
    try {
      if (!row) { bad.push('no paying chore in the pool to test with'); return bad; }
      const clean = () => {
        CT_SESSIONS.forEach(sn => ctSetMandatory(wk, d, sn, 'jenn', false));
        mrSetChoreGrade('jenn', wk, d, row.id, 0);
      };

      /* ── One routine planned, plus the chore ── */
      setDayBlocks(dayKey, [
        { id: 'tp1', actId: 'routine_morning', startMin: 7 * 60, durationMin: 30, checklistState: {} },
        { id: 'tp2', actId: 'chores', choreTags: [row.id], startMin: 10 * 60, durationMin: 30, checklistState: {} },
      ], 'jenn');
      clean();
      const rows1 = mmReviewRows('jenn', d);
      if (rows1.filter(r => r.kind === 'routine').length !== 1) {
        bad.push(`expected one routine row, got ${rows1.filter(r => r.kind === 'routine').length}`);
      }

      // Tap the CHORE by name. It must grade that chore and flip no session.
      mmToggleItem('jenn', d, 'chore', row.id);
      if (!(mrGetChoreGrade('jenn', wk, d, row.id) > 0)) {
        bad.push('tapping the chore row did not grade that chore');
      }
      if (CT_SESSIONS.some(sn => ctGetMandatory(wk, d, sn, 'jenn'))) {
        bad.push('tapping the chore row flipped a routine session');
      }
      // Tap the ROUTINE by name. It must flip that session and move no money.
      const paidBefore = mrWeekBreakdown(wk, 'jenn').chorePaid;
      mmToggleItem('jenn', d, 'routine', morning);
      if (!ctGetMandatory(wk, d, morning, 'jenn')) {
        bad.push('tapping the routine row did not set that session');
      }
      if (mrWeekBreakdown(wk, 'jenn').chorePaid !== paidBefore) {
        bad.push('tapping a routine row moved chore money');
      }

      /* ── Now the row set GROWS. A positional scheme breaks here. ── */
      clean();
      setDayBlocks(dayKey, [
        { id: 'tp1', actId: 'routine_morning', startMin: 7 * 60, durationMin: 30, checklistState: {} },
        { id: 'tp3', actId: 'routine_afterschool', startMin: 16 * 60, durationMin: 30, checklistState: {} },
        { id: 'tp2', actId: 'chores', choreTags: [row.id], startMin: 10 * 60, durationMin: 30, checklistState: {} },
      ], 'jenn');
      const rows2 = mmReviewRows('jenn', d);
      if (rows2.filter(r => r.kind === 'routine').length !== 2) {
        bad.push(`expected two routine rows after the plan grew, got ${rows2.filter(r => r.kind === 'routine').length}`);
      }
      mmToggleItem('jenn', d, 'chore', row.id);
      if (!(mrGetChoreGrade('jenn', wk, d, row.id) > 0)) {
        bad.push('after the row set grew, the chore tap missed its chore');
      }
      if (CT_SESSIONS.some(sn => ctGetMandatory(wk, d, sn, 'jenn'))) {
        bad.push('after the row set grew, the chore tap flipped a session');
      }
      mmToggleItem('jenn', d, 'routine', afternoon);
      if (!ctGetMandatory(wk, d, afternoon, 'jenn')) {
        bad.push('after the row set grew, the routine tap missed its session');
      }
      if (ctGetMandatory(wk, d, morning, 'jenn')) {
        bad.push('the routine tap flipped the wrong session');
      }

      /* A tap naming a row that is no longer there does NOTHING — the render is
         stale, and guessing is what wrote a grade by accident. */
      const gradeNow = mrGetChoreGrade('jenn', wk, d, row.id);
      mmToggleItem('jenn', d, 'routine', 'NotASession');
      mmToggleItem('jenn', d, 'chore', 'no-such-chore');
      if (mrGetChoreGrade('jenn', wk, d, row.id) !== gradeNow) {
        bad.push('a tap naming a row that does not exist still wrote something');
      }
      clean();
    } catch (e) {
      bad.push('threw: ' + e.message);
    } finally {
      try { mrSetChoreGrade('jenn', wk, d, row && row.id, 0); } catch (e) {}
      CT_SESSIONS.forEach(sn => { try { ctSetMandatory(wk, d, sn, 'jenn', false); } catch (e) {} });
      setDayBlocks(dayKey, before, 'jenn');
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* THE NOT-DONE MARKER READS AT EVERY CARD HEIGHT.
     The plan said to check this by eye on the screenshots, which is exactly how
     a marker that vanishes on a slim card survives a review. Asserted instead,
     at three heights, because BLOCK_TIERS drops content as a card shrinks and a
     badge is the first thing to go.

     A RING, never a fade: --missed was removed deliberately because an
     unconfirmed block must not be drawn as though the child failed it, and this
     is the opposite case — a fact a grown-up wrote down. */
  if (want('theNotDoneMarkerSurvivesEveryCardHeight')) checks.theNotDoneMarkerSurvivesEveryCardHeight = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const keys = mrWeekDayKeys(wk);
    const dayKey = keys[1];
    const before = (getDayBlocks(dayKey, 'jenn') || []).slice();
    try {
      // Short, medium and tall — the three tiers a card passes through.
      setDayBlocks(dayKey, [
        { id: 'h15', actId: 'piano', startMin: 8 * 60, durationMin: 15, notDone: true, checklistState: {} },
        { id: 'h45', actId: 'piano', startMin: 10 * 60, durationMin: 45, notDone: true, checklistState: {} },
        { id: 'h120', actId: 'piano', startMin: 13 * 60, durationMin: 120, notDone: true, checklistState: {} },
      ], 'jenn');

      weekOffset = computeWeekOffsetForDayKey(wk);
      showScreen('week');
      renderWeek();

      const cards = Array.from(document.querySelectorAll('#screen-week .wf-card--notdone'));
      if (cards.length !== 3) {
        bad.push(`${cards.length} of 3 heights carry the not-done class`);
      }
      cards.forEach(el => {
        const cs = getComputedStyle(el);
        const h = Math.round(el.getBoundingClientRect().height);
        // The ring, and no fade.
        if (!/inset/.test(cs.boxShadow)) bad.push(`the ring is missing at ${h}px`);
        if (Number(cs.opacity) < 1) bad.push(`a not-done card is faded at ${h}px`);
        if (/line-through/.test(cs.textDecorationLine || '')) {
          bad.push(`a not-done card is struck through at ${h}px`);
        }
        // …and it says what it is, even where the badge cannot fit.
        if (!/not done/i.test(el.getAttribute('title') || '')) {
          bad.push(`the card at ${h}px does not say it was recorded as not done`);
        }
      });

      /* The day view carries it at every height too, where the badge folds. */
      currentDayKey = dayKey; dayViewAnchorKey = dayKey;
      showScreen('day');
      buildTimeline();
      const placed = Array.from(document.querySelectorAll('#screen-day .placed-block--notdone'));
      if (placed.length !== 3) {
        bad.push(`${placed.length} of 3 heights carry the marker on the day view`);
      }
      placed.forEach(el => {
        const h = Math.round(el.getBoundingClientRect().height);
        if (Number(getComputedStyle(el).opacity) < 1) {
          bad.push(`a not-done block is faded on the day view at ${h}px`);
        }
      });
    } catch (e) {
      bad.push('threw: ' + e.message);
    } finally {
      setDayBlocks(dayKey, before, 'jenn');
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* A WEEK DOES NOT CLOSE OVER A DAY STILL BEING LIVED.
     canReviewDay always refused a running day, but canCloseWeek excused it
     alongside a future one — so a Sunday sitting held while the swimming was
     still in the pool counted six of six reviewable days and closed. The
     summary carried the SAME exclusion, so the figure a parent read agreed with
     the gate they pressed while both were wrong together. */
  if (want('aRunningDayHoldsTheWeekOpen')) checks.aRunningDayHoldsTheWeekOpen = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const today = todayKey();
    const store = JSON.parse(JSON.stringify(state.shared.parentDayConfirm || {}));
    const before = (getDayBlocks(today, 'jenn') || []).slice();
    try {
      // Every day of the week signed off, so only the running day can be at issue.
      ['jenn', 'jess'].forEach(k => mrWeekDayKeys(wk).forEach(d => markDayReviewed(k, d, true)));
      const now = tdNowMin();
      setDayBlocks(today, [{ id: 'rw1', actId: 'piano', startMin: Math.max(0, now - 10),
                             durationMin: 180, checklistState: {} }], 'jenn');
      markDayReviewed('jenn', today, false);

      if (canReviewDay('jenn', today).reason !== 'running') {
        bad.push('the fixture did not produce a running day');
      }
      if (weekDaysAwaitingReview('jenn', wk).indexOf(today) < 0) {
        bad.push('a running day was excused from the days the week is waiting on');
      }
      const gate = canCloseWeek(wk);
      if (gate.ok) bad.push('the week closed with an activity still running');
      if (!gate.missing.some(m => m.kid === 'jenn' && m.reason === 'days')) {
        bad.push('the refusal does not name the unreviewed day');
      }
      // …and the summary must not report that day as already accounted for.
      mmGoToWeek(wk); mmGoStep(5); renderMeetingMode();
      const txt = document.getElementById('familyMeetingBody')
        .textContent.replace(/\s+/g, ' ');
      const m = txt.match(/Days reviewed\s*(\d+)\/(\d+)/);
      if (!m) bad.push('the summary does not report days reviewed');
      else if (Number(m[1]) === Number(m[2])) {
        bad.push(`the summary reads ${m[1]}/${m[2]} while the gate is refusing`);
      }
      // A future day is still excused — the fix must not close that door.
      const future = toDayKeyInZone(new Date(Date.now() + 3 * 864e5));
      if (mrWeekDayKeys(wk).includes(future)
          && weekDaysAwaitingReview('jenn', wk).includes(future)) {
        bad.push('a day that has not happened is being counted against her');
      }
    } finally {
      setDayBlocks(today, before, 'jenn');
      state.shared.parentDayConfirm = store;
      mmHide();
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* TODAY IS NOT OVER JUST BECAUSE IT IS QUIET RIGHT NOW.
     An empty PAST day is a real answer — a quiet Sunday happened. Today is not:
     at nine in the morning it holds nothing because the day has not been lived,
     not because nothing was asked of her, and signing it off then reviews
     activities that have not been put on it yet. It stays reviewable, but only
     through an explicit "nothing else is planned", the way an empty day already
     asks before it is signed off blank. */
  if (want('todayIsNotReviewedByAccident')) checks.todayIsNotReviewedByAccident = await page.evaluate(async () => {
    const bad = [];
    const wasConfirm = window.showConfirm;
    const wasProfile = profile;
    profile = 'parent'; parentViewing = 'jenn';
    const today = todayKey();
    const past = toDayKeyInZone(new Date(Date.now() - 3 * 864e5));
    const store = JSON.parse(JSON.stringify(state.shared.parentDayConfirm || {}));
    const beforeToday = (getDayBlocks(today, 'jenn') || []).slice();
    const beforePast = (getDayBlocks(past, 'jenn') || []).slice();
    try {
      ['jenn', 'jess'].forEach(k => [today, past].forEach(d => markDayReviewed(k, d, false)));

      // An empty today reports 'open', not 'empty' — the two are different facts.
      setDayBlocks(today, [], 'jenn');
      const open = canReviewDay('jenn', today);
      if (open.reason !== 'open') bad.push(`an empty today gave reason '${open.reason}'`);
      if (!/not over/i.test(reviewBlockedReason({ ok: false, reason: 'open' }))) {
        bad.push('an open day has no sentence of its own');
      }

      // A today whose blocks have all ENDED is open too — the hole is not just emptiness.
      setDayBlocks(today, [{ id: 'op1', actId: 'piano', startMin: 0, durationMin: 1,
                             completed: true, confirmed: true, checklistState: {} }], 'jenn');
      if (canReviewDay('jenn', today).reason !== 'open') {
        bad.push('a today whose blocks have all finished was treated as a finished day');
      }

      // Declining the confirmation reviews nothing.
      window.showConfirm = async () => false;
      await markDayReviewedForChild('jenn', today);
      if (isDayReviewed('jenn', today)) bad.push('today was reviewed without anybody confirming it');

      // Accepting it does.
      window.showConfirm = async () => true;
      await markDayReviewedForChild('jenn', today);
      if (!isDayReviewed('jenn', today)) {
        bad.push('today could not be reviewed even after "nothing else today"');
      }

      // An empty PAST day is untouched by this — it is still 'empty'.
      setDayBlocks(past, [], 'jenn');
      if (canReviewDay('jenn', past).reason !== 'empty') {
        bad.push('a quiet past day stopped being a real answer');
      }
    } finally {
      window.showConfirm = wasConfirm;
      setDayBlocks(today, beforeToday, 'jenn');
      setDayBlocks(past, beforePast, 'jenn');
      state.shared.parentDayConfirm = store;
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* A BLANK REFLECTION DOES NOT CLOSE A WEEK.
     Step 5 displayed 0/3 and closed anyway, so a week could be recorded as
     reviewed and settled with neither child having been asked. Either she
     answered it or it was deliberately set aside — both are answers, and a
     blank record is neither. The money stays independent of it. */
  if (want('aBlankReflectionHoldsTheWeekOpen')) checks.aBlankReflectionHoldsTheWeekOpen = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const hadRefl = JSON.parse(JSON.stringify(state.shared.chore.reflections || {}));
    const store = JSON.parse(JSON.stringify(state.shared.parentDayConfirm || {}));
    const done = () => Object.assign(reflBlank(), {
      doingWell: { answerIds: ['finished'], evidenceIds: [], customNote: '', inputMode: 'spoken' },
      needsWork: { answerId: 'rushed', evidenceIds: [], customNote: '', controllableText: 'slow down',
                   needsHelpFindingControl: false, parentObservation: '', inputMode: 'spoken' },
      planNext: Object.assign(reflBlank().planNext, { actionId: 'timer' }),
    });
    try {
      ['jenn', 'jess'].forEach(k => mrWeekDayKeys(wk).forEach(d => markDayReviewed(k, d, true)));
      state.shared.chore.reflections = {}; reflDraft = null;

      const blank = canCloseWeek(wk);
      if (blank.ok) bad.push('the week closed with both reflections blank');
      if (!blank.missing.some(m => m.reason === 'reflection')) {
        bad.push('the refusal does not name the reflection');
      }

      // A finished one satisfies it…
      state.shared.chore.reflections = { [wk]: { jenn: done(), jess: done() } };
      if (canCloseWeek(wk).missing.some(m => m.reason === 'reflection')) {
        bad.push('a finished reflection still held the week open');
      }
      // …and so does one deliberately set aside.
      state.shared.chore.reflections = { [wk]: {
        jenn: Object.assign(reflBlank(), { skippedAt: Date.now() }),
        jess: Object.assign(reflBlank(), { skippedAt: Date.now() }) } };
      if (canCloseWeek(wk).missing.some(m => m.reason === 'reflection')) {
        bad.push('a skipped reflection held the week open');
      }
      // The refusal has to be sayable, not a blank line under the button.
      mmGoToWeek(wk); mmGoStep(5);
      state.shared.chore.reflections = {}; reflDraft = null;
      renderMeetingMode();
      const txt = document.getElementById('familyMeetingBody')
        .textContent.replace(/\s+/g, ' ');
      if (!/reflection/i.test(txt)) bad.push('the close gate does not say the reflection is why');
    } finally {
      state.shared.chore.reflections = hadRefl;
      state.shared.parentDayConfirm = store;
      reflDraft = null;
      mmHide();
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* A REFLECTION CANNOT BE TWO THINGS AT ONCE.
     Three states could contradict each other: the parent's "we talked about
     this" survived the child rewriting the answer it described, a skipped
     record could reach 3/3 and still print "left unfinished on purpose", and
     the tick could be pressed against a blank record — which, now that closing
     the week counts it, would be a conversation recorded about nothing. */
  if (want('aReflectionCannotBeSkippedAndComplete')) checks.aReflectionCannotBeSkippedAndComplete = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const hadRefl = JSON.parse(JSON.stringify(state.shared.chore.reflections || {}));
    try {
      state.shared.chore.reflections = {}; reflDraft = null;

      // Nothing to confirm on a blank record — in the markup AND in the handler.
      if (reflIsSettled(reflGet(wk, 'jenn'))) bad.push('a blank reflection offered the parent tick');
      mmGoToWeek(wk); mmGoStep(2); mnySetMeetKid('jenn');
      reflTab = 'doingWell'; renderMeetingMode();
      const host = document.getElementById('familyMeetingBody');
      if (host.querySelector('[data-mm-action="refl-talked"]')) {
        bad.push('the parent tick was drawn against a 0/3 reflection');
      }
      reflHandleAction('refl-talked', document.createElement('button'), wk);
      if (reflWorking(wk, 'jenn').parentReviewedAt) {
        bad.push('the handler recorded a conversation about a blank reflection');
      }

      // Finish it, and the tick becomes available and sticks.
      reflEdit(wk, 'jenn', r => {
        r.doingWell.answerIds = ['finished'];
        r.needsWork.answerId = 'rushed';
        r.needsWork.controllableText = 'slow down';
        r.planNext.actionId = 'timer';
      });
      if (!reflIsComplete(reflWorking(wk, 'jenn'))) bad.push('the fixture did not complete the reflection');
      reflHandleAction('refl-talked', document.createElement('button'), wk);
      if (!reflWorking(wk, 'jenn').parentReviewedAt) bad.push('the parent tick did not take');

      // The parent's own observation is not her answer — the tick survives it.
      reflEdit(wk, 'jenn', r => { r.needsWork.parentObservation = 'she tried hard'; });
      if (!reflWorking(wk, 'jenn').parentReviewedAt) {
        bad.push('the tick cleared when the parent wrote in their own field');
      }

      // Her changing her answer clears it: it described a different record.
      reflEdit(wk, 'jenn', r => { r.needsWork.answerId = 'forgot'; });
      if (reflWorking(wk, 'jenn').parentReviewedAt) {
        bad.push('"we talked about this" survived the child changing her answer');
      }

      // Skipped, then finished — the skip goes, and cannot print alongside it.
      reflEdit(wk, 'jenn', r => { r.skippedAt = Date.now(); r.planNext.actionId = ''; });
      if (!reflIsSkipped(reflWorking(wk, 'jenn'))) bad.push('the fixture did not skip the reflection');
      reflEdit(wk, 'jenn', r => { r.planNext.actionId = 'timer'; });
      const rec = reflWorking(wk, 'jenn');
      if (!reflIsComplete(rec)) bad.push('completing after a skip did not finish it');
      if (reflIsSkipped(rec)) bad.push('a finished reflection still reads as skipped');
      renderMeetingMode();
      const txt = document.getElementById('familyMeetingBody').textContent;
      if (/unfinished on purpose/.test(txt)) {
        bad.push('a completed reflection still prints "left unfinished on purpose"');
      }
    } finally {
      state.shared.chore.reflections = hadRefl;
      reflDraft = null;
      mmHide();
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* EVIDENCE COUNTS WHAT HAS ENDED, AND NAMES WHAT IS WAITING.
     Needs Work read the week from midnight, so a swim at six was offered to a
     child at breakfast as a block she had "not marked done" — the app telling
     her she had failed at something she had not yet had the chance to do. And a
     chore she had DONE and claimed was reported as "still owed" while it sat in
     a parent's queue, which blames a child for somebody else's inbox. */
  if (want('evidenceCountsOnlyWhatHasEnded')) checks.evidenceCountsOnlyWhatHasEnded = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const today = todayKey();
    const before = (getDayBlocks(today, 'jenn') || []).slice();
    try {
      const now = tdNowMin();
      const has = (id) => reflEvidence(wk, 'jenn', 'needsWork').some(e => e.id === id);
      const line = (id) => (reflEvidence(wk, 'jenn', 'needsWork')
        .find(e => e.id === id) || {}).text || '';

      // Nothing but a block still to come, unticked. It is not a failure yet.
      setDayBlocks(today, [{ id: 'ev1', actId: 'piano', startMin: Math.min(23 * 60, now + 120),
                             durationMin: 60, checklistState: {} }], 'jenn');
      const ahead = /(\d+) planned block/.exec(line('not_done'));
      const aheadN = ahead ? Number(ahead[1]) : 0;

      // The same block, moved into the past and still unticked, IS one.
      setDayBlocks(today, [{ id: 'ev1', actId: 'piano', startMin: 0,
                             durationMin: 1, checklistState: {} }], 'jenn');
      const behind = /(\d+) planned block/.exec(line('not_done'));
      const behindN = behind ? Number(behind[1]) : 0;
      if (!(behindN > aheadN)) {
        bad.push(`a finished unticked block did not count (ahead ${aheadN}, behind ${behindN})`);
      }
      if (!blockHasEnded({ startMin: 0, durationMin: 1 }, today)) {
        bad.push('blockHasEnded says a block finished at 00:01 has not ended');
      }
      if (blockHasEnded({ startMin: 23 * 60 + 59, durationMin: 60 }, today)) {
        bad.push('blockHasEnded says a block late tonight has already ended');
      }

      // Claimed work is never described as owed.
      const fam = getFamilyChoreStatus('jenn', wk);
      if (fam.waiting && !has('chores_waiting')) {
        bad.push('work waiting on a grown-up is not named as waiting');
      }
      if (/still owed/.test(line('chores_short'))) {
        bad.push('the chore line still uses the word "owed"');
      }
      const owedM = /(\d+) family chore/.exec(line('chores_short'));
      if (owedM && Number(owedM[1]) > Math.max(0, fam.required - fam.fulfilled - fam.waiting)) {
        bad.push('the chore line counts claimed work as outstanding');
      }
      // Nothing on this screen may select an answer.
      if (reflEvidence(wk, 'jenn', 'needsWork').some(e => e.selected)) {
        bad.push('evidence selected an answer for her');
      }
    } finally {
      setDayBlocks(today, before, 'jenn');
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* A RECORDED ACTION KEEPS ITS OWN WORDS.
     `actionText` was written on every change and read by nothing: the display
     rebuilt the label from the current answer list, so rewording an option
     would silently change what a reflection from six months ago appears to
     say. The stored words win; the live label is the fallback only. */
  if (want('aRecordedActionKeepsItsOwnWords')) checks.aRecordedActionKeepsItsOwnWords = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const hadRefl = JSON.parse(JSON.stringify(state.shared.chore.reflections || {}));
    const timer = REFL_PLAN_NEXT.find(a => a.id === 'timer');
    const wasText = timer.text;
    try {
      state.shared.chore.reflections = {}; reflDraft = null;
      reflEdit(wk, 'jenn', r => { r.planNext.actionId = 'timer'; });
      const stored = reflWorking(wk, 'jenn').planNext.actionText;
      if (stored !== wasText) bad.push(`choosing an action stored "${stored}", expected "${wasText}"`);

      // Reword the option underneath the record.
      timer.text = 'Set a stopwatch instead';
      if (reflActionText(reflWorking(wk, 'jenn')) !== wasText) {
        bad.push('rewording the answer list changed what an existing record says');
      }
      if (reflActionLabel({ planNext: { actionId: 'timer' } }) !== 'Set a stopwatch instead') {
        bad.push('the live label did not follow the answer list');
      }
      // A record written before the field existed still reads correctly.
      if (reflActionText({ planNext: { actionId: 'timer', actionText: '' } })
          !== 'Set a stopwatch instead') {
        bad.push('a record with no stored words lost its action entirely');
      }
    } finally {
      timer.text = wasText;
      state.shared.chore.reflections = hadRefl;
      reflDraft = null;
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* A RECORD OF A TO-DO THAT WAS NEVER WRITTEN IS WORSE THAN NO RECORD.
     The broken "Add to routine" button wrote targetWeek + linkedRoutineId and
     no to-do at all. Treating that shape as carried would state "in next week's
     to-dos · with Morning Routine" about something that has never existed, and
     never offer the button again — the old build failed silently, this would
     fail confidently. It reads as not carried, so the offer comes back and the
     next tap writes the real thing.

     The legacy TO-DO shape is a different case and must not be swept up with
     it: that path set linkedBlockId and DID write a to-do. */
  if (want('aLegacyRoutineCarryIsOfferedAgain')) checks.aLegacyRoutineCarryIsOfferedAgain = await page.evaluate(async () => {
    const bad = [];
    const wasProfile = profile;
    const wasConfirm = window.showConfirm;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const hadRefl = JSON.parse(JSON.stringify(state.shared.chore.reflections || {}));
    const hadTodos = JSON.parse(JSON.stringify(getProfData('jenn').todos || []));
    const seed = (extra) => {
      state.shared.chore.reflections = { [wk]: { jenn: Object.assign(reflBlank(), {
        planNext: Object.assign(reflBlank().planNext, Object.assign({
          actionId: 'timer', targetWeek: reflTargetWeek(wk),
        }, extra)),
      }) } };
      reflDraft = null;
    };
    try {
      const routine = reflLinkTargets('jenn')[0];
      if (!routine) bad.push('there is no routine to attach an action to');

      /* ── The broken era's output: a routine id, and no to-do anywhere ── */
      getProfData('jenn').todos = [];
      seed({ linkedRoutineId: routine ? routine.id : 'r1' });
      if (reflCarriedForward(reflGet(wk, 'jenn'))) {
        bad.push('a routine-linked record with no to-do still reads as carried');
      }
      mmGoToWeek(wk); mmGoStep(2); mnySetMeetKid('jenn');
      reflTab = 'planNext'; renderMeetingMode();
      const host = document.getElementById('familyMeetingBody');
      if (!host.querySelector('[data-mm-action="refl-carry"]')) {
        bad.push('the carry was not offered again for a record that never wrote one');
      }
      const txt = host.textContent.replace(/\s+/g, ' ');
      if (/In (this|next) week's to-dos/.test(txt)) {
        bad.push('the screen claims a to-do exists that was never written');
      }
      // Taking the offer repairs it, and writes the real linked to-do.
      window.showConfirm = async () => true;
      await reflAddToPlan(wk, 'jenn', routine ? routine.id : '');
      const made = getProfData('jenn').todos || [];
      if (made.length !== 1) bad.push(`repairing the record wrote ${made.length} to-dos`);
      else if (made[0].linkActId !== (routine && routine.id)) {
        bad.push('the repaired to-do is not linked to the routine');
      }
      if (!reflGet(wk, 'jenn').planNext.carriedTodoId) {
        bad.push('the repaired record does not name the to-do it created');
      }
      if (!reflCarriedForward(reflGet(wk, 'jenn'))) bad.push('the repair did not record a carry');

      /* ── The legacy TO-DO shape did write one, and still counts ── */
      getProfData('jenn').todos = [];
      seed({ linkedBlockId: 'todo' });
      if (!reflCarriedForward(reflGet(wk, 'jenn'))) {
        bad.push('a legacy to-do carry stopped being recognised');
      }
      /* ── And a record with no target at all is not carried ── */
      state.shared.chore.reflections = { [wk]: { jenn: Object.assign(reflBlank(), {
        planNext: Object.assign(reflBlank().planNext, { actionId: 'timer' }) }) } };
      reflDraft = null;
      if (reflCarriedForward(reflGet(wk, 'jenn'))) bad.push('an uncarried action reads as carried');
    } finally {
      window.showConfirm = wasConfirm;
      state.shared.chore.reflections = hadRefl;
      getProfData('jenn').todos = hadTodos;
      reflDraft = null;
      mmHide();
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* A WEEK DOES NOT CLOSE ON A CONVERSATION THAT DID NOT HAPPEN.
     Step 2 exists to produce a conversation. All three prompts could be
     answered and the week closed without the parent and child ever sitting
     down, and the record would then say the reflection happened. A skipped
     reflection is exempt — there was nothing to talk about, and a skip must
     never be able to trap the family. */
  if (want('aWeekDoesNotCloseOnAConversationThatDidNotHappen')) checks.aWeekDoesNotCloseOnAConversationThatDidNotHappen = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const hadRefl = JSON.parse(JSON.stringify(state.shared.chore.reflections || {}));
    const store = JSON.parse(JSON.stringify(state.shared.parentDayConfirm || {}));
    const done = () => Object.assign(reflBlank(), {
      doingWell: { answerIds: ['finished'], evidenceIds: [], customNote: '', inputMode: 'spoken' },
      needsWork: { answerId: 'rushed', evidenceIds: [], customNote: '', controllableText: 'slow down',
                   needsHelpFindingControl: false, parentObservation: '', inputMode: 'spoken' },
      planNext: Object.assign(reflBlank().planNext, { actionId: 'timer' }),
    });
    const reasons = () => canCloseWeek(wk).missing.map(m => m.reason);
    try {
      ['jenn', 'jess'].forEach(k => mrWeekDayKeys(wk).forEach(d => markDayReviewed(k, d, true)));

      // Answered by both, ticked by nobody.
      state.shared.chore.reflections = { [wk]: { jenn: done(), jess: done() } };
      reflDraft = null;
      if (!reasons().includes('reflection-talk')) {
        bad.push('the week closed on a reflection nobody talked through');
      }
      if (reflIsClosable(reflGet(wk, 'jenn'))) bad.push('an unticked reflection reads as closable');

      // The tick clears it.
      ['jenn', 'jess'].forEach(k => {
        state.shared.chore.reflections[wk][k].parentReviewedAt = Date.now();
      });
      if (reasons().includes('reflection-talk')) {
        bad.push('the conversation was recorded and the week still refused');
      }

      // A skipped reflection needs no tick.
      state.shared.chore.reflections = { [wk]: {
        jenn: Object.assign(reflBlank(), { skippedAt: Date.now() }),
        jess: Object.assign(reflBlank(), { skippedAt: Date.now() }) } };
      if (reasons().some(r => r === 'reflection' || r === 'reflection-talk')) {
        bad.push('a deliberately skipped reflection held the week open');
      }

      /* Her changing an answer after they talked re-opens it — the tick
         described a record that no longer exists. */
      state.shared.chore.reflections = { [wk]: { jenn: done(), jess: done() } };
      ['jenn', 'jess'].forEach(k => {
        state.shared.chore.reflections[wk][k].parentReviewedAt = Date.now();
      });
      reflDraft = null;
      reflEdit(wk, 'jenn', r => { r.needsWork.answerId = 'forgot'; });
      reflCommitDraft();
      if (!reasons().includes('reflection-talk')) {
        bad.push('rewriting an answer did not re-open the conversation requirement');
      }

      // Step 5 names the state rather than just saying "complete".
      state.shared.chore.reflections = { [wk]: { jenn: done(), jess: done() } };
      reflDraft = null;
      mmGoToWeek(wk); mmGoStep(5); renderMeetingMode();
      const txt = document.getElementById('familyMeetingBody')
        .textContent.replace(/\s+/g, ' ');
      if (!/conversation not confirmed/.test(txt)) {
        bad.push('step 5 does not say the conversation is what is missing');
      }
    } finally {
      state.shared.chore.reflections = hadRefl;
      state.shared.parentDayConfirm = store;
      reflDraft = null;
      mmHide();
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* CLOSING A WEEK THAT HAS NOT ENDED IS AN EXPLICIT CHOICE.
     Every elapsed day being reviewed is not the same as the week being over —
     with today signed off through "nothing else today", a Tuesday satisfies the
     gate. Closing is reversible and does not touch the money, so this asks
     rather than refuses, and names the days still to come. */
  if (want('closingAWeekEarlyIsAnExplicitChoice')) checks.closingAWeekEarlyIsAnExplicitChoice = await page.evaluate(async () => {
    const bad = [];
    const wasProfile = profile;
    const wasConfirm = window.showConfirm;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey;
    const hadRefl = JSON.parse(JSON.stringify(state.shared.chore.reflections || {}));
    const store = JSON.parse(JSON.stringify(state.shared.parentDayConfirm || {}));
    const wasClosed = JSON.parse(JSON.stringify(state.shared.chore.weeksClosed || {}));
    let realGateRef = null;
    try {
      const ahead = mmDaysStillAhead(wk);
      // Every day named must be a real day of this week, and still to come.
      const keys = mrWeekDayKeys(wk);
      ahead.forEach(d => {
        if (!keys.includes(d.key)) bad.push(`${d.key} is not a day of this week`);
        if (d.key <= todayKey()) bad.push(`${d.key} is named as still ahead but is not`);
        if (!d.name) bad.push(`${d.key} was named with nothing`);
      });
      if (ahead.length !== keys.filter(k => k > todayKey()).length) {
        bad.push('the days still ahead do not match the week');
      }

      mmGoToWeek(wk);
      /* The gate — days reviewed, reflections settled and talked through, money
         committed — has its own checks. This one is about what happens AFTER it
         passes, so stand it up rather than rebuilding a whole settled week here.
         The refusal-before-confirm ordering is asserted first, against the real
         gate. */
      const realGate = canCloseWeek;
      realGateRef = realGate;
      if (!realGate(wk).ok) {
        let askedWhileRefusing = 0;
        window.showConfirm = async () => { askedWhileRefusing++; return true; };
        await mmCloseWeekNow();
        if (askedWhileRefusing) bad.push('an unclosable week still asked about closing early');
        if (isWeekClosed(wk)) bad.push('a week closed while the gate was refusing');
      }
      canCloseWeek = () => ({ ok: true, missing: [] });
      if (ahead.length) {
        // Declining writes nothing at all.
        setWeekClosed(wk, false);
        let asked = 0;
        window.showConfirm = async (msg) => { asked++;
          if (!new RegExp(ahead[0].name).test(String(msg))) {
            bad.push('the warning does not name the days still to come');
          }
          if (!/reopen/i.test(String(msg))) bad.push('the warning does not say it can be undone');
          return false; };
        await mmCloseWeekNow();
        if (!asked) bad.push('closing a week mid-week did not ask first');
        if (isWeekClosed(wk)) bad.push('a declined early close closed the week anyway');

        // Accepting does close it.
        window.showConfirm = async () => true;
        await mmCloseWeekNow();
        if (!isWeekClosed(wk)) bad.push('accepting the warning did not close the week');
      }
      canCloseWeek = realGate;
      /* On the last day of the week there is nothing ahead, so the ordinary
         Sunday-afternoon meeting is never asked to justify itself. */
      if (!keys.filter(k => k > todayKey()).length && ahead.length) {
        bad.push('the last day of the week still counts days ahead');
      }
    } finally {
      if (typeof realGateRef === 'function') canCloseWeek = realGateRef;
      window.showConfirm = wasConfirm;
      state.shared.chore.weeksClosed = wasClosed;
      state.shared.chore.reflections = hadRefl;
      state.shared.parentDayConfirm = store;
      reflDraft = null;
      mmHide();
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* AN ACHIEVEMENT NOBODY CHOSE IS NOT AN ACHIEVEMENT.
     addAchievement used to seed getAllActivities()[0] — Breakfast — so every
     achievement ever added arrived reading "🍳 Breakfast · count target 1".
     New ones start unassigned, but the records already written were never
     corrected. The seeded shape is identifiable exactly: the old creator wrote
     createdAt and never updatedAt, and every edit path stamps updatedAt. Read,
     never migrated — achievements is an array and deepMergeObj treats an array
     as a scalar, so a cleanup written to the document could be pushed back. */
  if (want('aSeededAchievementIsNotAChoice')) checks.aSeededAchievementIsNotAChoice = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'jenn';
    const p = getProfData('jenn');
    const had = JSON.parse(JSON.stringify(p.achievements || []));
    try {
      const acts = getAllActivities('jenn');
      const breakfast = acts.find(a => /breakfast/i.test(a.name)) || acts[0];
      if (!breakfast) { bad.push('there are no activities to seed from'); return bad; }

      const seeded = { id: 'a-old', activityId: breakfast.id, mode: 'count',
                       target: 1, createdAt: 1 };
      const chosen = { id: 'a-new', activityId: breakfast.id, mode: 'count',
                       target: 1, createdAt: 1, updatedAt: 2 };
      const fresh   = { id: 'a-blank', activityId: null, mode: 'count',
                        target: 1, createdAt: 1 };
      p.achievements = [seeded, chosen, fresh];

      if (achievementActivityId(seeded)) bad.push('a seeded achievement still names an activity');
      if (achievementActivityId(chosen) !== breakfast.id) {
        bad.push('an achievement somebody chose lost its activity');
      }
      if (achievementActivityId(fresh)) bad.push('a new achievement gained an activity');
      if (progressForAchievement(seeded)) bad.push('a seeded achievement reports progress');
      if (!progressForAchievement(chosen)) bad.push('a chosen achievement stopped reporting progress');

      // The row says to pick one rather than naming a meal.
      renderGoalsTodos();
      const rows = [...document.querySelectorAll('.gt-achievement-row')];
      const seededRow = rows[0];
      if (!seededRow) bad.push('the achievements did not render');
      else {
        if (!/No activity yet/.test(seededRow.textContent)) {
          bad.push(`a seeded achievement still reads: "${seededRow.textContent.slice(0, 60)}"`);
        }
        if (/Breakfast/.test(seededRow.textContent)) {
          bad.push('a seeded achievement still names Breakfast');
        }
        if (!/Link activity/.test(seededRow.textContent)) {
          bad.push('the row does not say how to choose one');
        }
      }

      /* Derived, not migrated: reading it must not change what is stored, and
         must give the same answer however many times it runs. */
      const after = JSON.stringify(p.achievements);
      renderGoalsTodos();
      achievementActivityId(seeded); progressForAchievement(seeded);
      if (JSON.stringify(p.achievements) !== after) {
        bad.push('reading an achievement rewrote the stored record');
      }
      if (p.achievements[0].activityId !== breakfast.id) {
        bad.push('the stored activityId was cleaned up rather than derived');
      }
    } finally {
      p.achievements = had;
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* MEALS ARE NOT CHORES. cat:'daily' held breakfast, dinner, the house chore
     and four Family Hero tasks, and was labelled "🧹 Chores" on two screens and
     "🍽 Daily" on three. */
  if (want('mealsAreNotChores')) checks.mealsAreNotChores = await page.evaluate(() => {
    const bad = [];
    const want = {
      breakfast: 'daily', lunch: 'daily', dinner: 'daily', appt_medical: 'daily',
      chores: 'chores', family_set_table: 'chores', family_laundry_fold: 'chores',
      school_day: 'brain', math: 'brain', french: 'brain', piano: 'brain',
      routine_morning: 'routine', health_pack_tomorrow: 'routine',
      training: 'body', competition: 'body',
      family: 'free', relax: 'free', break_quick: 'free', snow_play: 'free',
      /* The family sitting down together is filed BESIDE the routines, because
         that is where it belongs in her week — but it is not a routine session
         and must never be counted as one, so it carries an explicit group. */
      family_meeting: 'daily',
      /* Everyday movement is hers, not a coach's — a Saturday swim is not the
         same ask as a coached hour, and both used to land in one place.
         `relax` stays Free on purpose: rest that scores is rest turned into
         another thing to perform. */
      swimming: 'move', skating: 'move', bike_ride: 'move', health_stretch_reset: 'move',
      // Outings carry an explicit group; cat is busy saying what colour they are.
      day_trip: 'explore', museum: 'explore', nature_walk: 'explore', beach_day: 'explore',
      // A seasonal treat is not training, whatever its category says.
      garden_time: 'free',
    };
    Object.keys(want).forEach(id => {
      const got = activityGroup(findActivity(id, 'jenn'));
      if (got !== want[id]) bad.push(`${id} groups as ${got}, expected ${want[id]}`);
    });
    if (GROUP_ORDER.length !== 8) bad.push(`${GROUP_ORDER.length} groups, expected 8`);
    /* groupDef's fallback used to be the positional ACTIVITY_GROUPS[4], which
       was 'daily' only because daily happened to be fifth — so adding a group
       above it would have re-pointed every unknown-group lookup at a different
       row in silence. Nothing tested it; this does. */
    if (groupDef('no-such-group').id !== 'daily') {
      bad.push(`an unknown group falls back to ${groupDef('no-such-group').id}, expected daily`);
    }
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
  if (want('aPastWeekCannotPlanForward')) checks.aPastWeekCannotPlanForward = await page.evaluate(() => {
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
      mmHide();
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
  if (want('celebrationCountsWhatHappened')) checks.celebrationCountsWhatHappened = await page.evaluate(() => {
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

      /* Step 2 asks the child first; what the week SHOWS is evidence under her
         own answer, and it ships folded because the screen has a word budget.
         Open it, and hold the same invariants the wins list was holding. */
      mmGoToWeek(wk); mmGoStep(2);
      mnySetMeetKid(kid);
      reflEvidenceOpen = true; reflTab = 'doingWell';
      renderMeetingMode();
      const body = document.getElementById('familyMeetingBody').textContent.replace(/\s+/g, ' ');
      if (!/kept all 1 of your routines|kept 1 of 1 routines/.test(body)) {
        bad.push(`routines are not counted from the checklists: "${body.slice(0, 240)}"`);
      }
      if (!/1 family chore checked off by a grown-up/.test(body)) bad.push('a graded chore is not celebrated');
      if (!/planned hours completed/.test(body)) bad.push('the hours are not read from the shared computation');
      // The preliminary figure must never be worded as though it were recorded.
      if (/\$[\d.]+ recorded/.test(body)) bad.push('an unsettled week claims money was recorded');

      /* And the retired store must not be able to bring it back to life: fill
         optionalByWeek and the evidence must not change. */
      const withoutLegacy = body;
      ctSetOptional(wk, 2, kid, 'dishes', true);
      renderMeetingMode();
      const after = document.getElementById('familyMeetingBody').textContent.replace(/\s+/g, ' ');
      if (after !== withoutLegacy) bad.push('the evidence still reads the retired chore-group store');
      mmHide();
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
  if (want('undoReturnsBothChildren')) checks.undoReturnsBothChildren = await page.evaluate(() => {
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

  /* YOU TRAVEL TO TRAINING, AND THE PLANNER SHOULD KNOW.
     Both placement sheets started every buffer off, so a swim was planned as
     though it happened at the kitchen table and tdActionableStart — the get-
     ready time Today leads with — had nothing to compute from until somebody
     remembered the toggle. The default comes from the activity, because
     flipping it globally would put a car journey in front of Breakfast. */
  if (want('youTravelToTraining')) checks.youTravelToTraining = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile, wasKey = currentDayKey;
    profile = 'jenn'; weekOffset = 0;
    const keys = getDayKeys(0), day = keys[3];
    const before = (getDayBlocks(day, 'jenn') || []).slice();
    currentDayKey = day;
    const place = (id) => {
      setDayBlocks(day, [], 'jenn');
      const act = findActivity(id, 'jenn');
      if (!act) { bad.push(`no activity called ${id}`); return null; }
      startPlacingActivity(act);
      (act.isTraining ? confirmTraining : confirmActivity)();
      return (getDayBlocks(day, 'jenn') || [])[0] || null;
    };
    try {
      // Things you GO to.
      ['training', 'competition', 'appt_medical', 'school_day'].forEach(id => {
        const b = place(id);
        if (!b) { bad.push(`${id} placed nothing`); return; }
        if (!b.travelBuffer) bad.push(`${id} arrived with no travel time`);
        if (!b.getReadyBuffer) bad.push(`${id} arrived with no get-ready time`);
        if (b.travelBufMin !== DEFAULT_BUFFER_MIN) bad.push(`${id} travel is ${b.travelBufMin}, expected the default`);
      });
      // Things you do at home. A car journey before Breakfast is the failure
      // a global default would have produced.
      ['breakfast', 'piano', 'chores', 'family', 'routine_morning'].forEach(id => {
        const b = place(id);
        if (!b) { bad.push(`${id} placed nothing`); return; }
        if (b.travelBuffer) bad.push(`${id} arrived with travel time it does not need`);
        if (b.getReadyBuffer) bad.push(`${id} arrived with get-ready time it does not need`);
      });
      // And Today reads the lead time without anyone touching a toggle.
      const t = place('training');
      if (t) {
        const lead = tdActionableStart(t);
        if (!(lead < t.startMin)) {
          bad.push(`Today's get-ready time (${lead}) is not before the block (${t.startMin})`);
        }
      }
    } finally {
      setDayBlocks(day, before, 'jenn');
      profile = wasProfile; currentDayKey = wasKey;
    }
    return bad.length === 0 || bad;
  });

  /* THE MEETING IS ONE SCROLLER, AND ITS ENDS RESERVE THEIR OWN SPACE.
     A five-step sitting spends its time in the middle of a long panel, and the
     week you were reviewing, the step you were on and the only way to the next
     one all used to scroll away with the content.

     Sticky fixed that and introduced the next fault: a pinned band FLOATS over
     the content, taking no layout space, so on an iPad the last card of a step
     sat underneath the Back/Next bar with nothing to say it was there. The
     sheet is a bounded flex column now and .mm-body is the only scroller, so
     this asserts the layering rather than just the pinning — at every scroll
     position, neither band may overlap a card. */
  if (want('theMeetingKeepsItsHeadAndFeet')) checks.theMeetingKeepsItsHeadAndFeet = await page.evaluate(() => {
    const bad = [];
    const wasProfile = profile;
    profile = 'parent'; parentViewing = 'jenn';
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    try {
      openFamilyMeeting(); mmGoStep(3);
      const sheet = document.querySelector('#screen-meeting .mm-screen');
      const head = document.querySelector('#familyMeetingBody .mm-head');
      const nav = document.querySelector('#familyMeetingBody .mm-nav');
      if (!head) bad.push('the week and step header is not its own band');
      if (!nav) bad.push('there is no navigation band');
      /* Ordinary flex children, not floated over the content. Sticky or fixed
         here is the bug: both take the band out of the layout. */
      [['header', head], ['Back/Next bar', nav]].forEach(([label, el]) => {
        if (!el) return;
        const pos = getComputedStyle(el).position;
        if (pos === 'sticky' || pos === 'fixed') {
          bad.push(`the ${label} is ${pos} — it floats over the cards instead of reserving room`);
        }
      });
      const sheetPos = sheet ? getComputedStyle(sheet) : null;
      if (sheetPos && sheetPos.display !== 'flex') bad.push('the meeting screen is not a flex column');

      // One scroller. A second one inside the sheet is how a flick on an iPad
      // comes to move the wrong thing.
      const scrollers = [...document.querySelectorAll('#screen-meeting *')].filter(el => {
        const o = getComputedStyle(el).overflowY;
        return (o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight + 4;
      });
      if (scrollers.length > 1) {
        bad.push(`${scrollers.length} scrollers inside the meeting: ${scrollers.map(e => '.' + String(e.className).split(' ')[0]).join(', ')}`);
      }
      const body = document.querySelector('#familyMeetingBody .mm-body');
      if (!body) bad.push('there is no meeting body to scroll');
      if (scrollers.length === 1 && scrollers[0] !== body) {
        bad.push('the meeting scrolls something other than .mm-body');
      }
      if (sheet && sheet.scrollHeight > sheet.clientHeight + 4) {
        bad.push('the meeting screen itself scrolls — it is meant to be a bounded column');
      }

      /* At the top, the middle and the bottom of the longest step, neither band
         may cover a card. mmScroller() is the app's own answer to "what
         scrolls", so a future layout change moves one selector and this check
         follows it. */
      if (body && mmScroller() !== body) bad.push('mmScroller() does not point at the scroller');
      if (body && body.scrollHeight > body.clientHeight) {
        const overlaps = (a, b) => {
          const r = a.getBoundingClientRect(), c = b.getBoundingClientRect();
          return r.left < c.right && r.right > c.left && r.top < c.bottom && r.bottom > c.top;
        };
        [0, Math.floor(body.scrollHeight / 2), body.scrollHeight].forEach(pos => {
          body.scrollTop = pos;
          const cards = [...body.querySelectorAll('.chore-card, .mm-drow, .mm-pay-row')]
            .filter(el => el.getBoundingClientRect().height > 4);
          [['header', head], ['Back/Next bar', nav]].forEach(([label, band]) => {
            if (!band) return;
            const hit = cards.find(c => overlaps(band, c));
            if (hit) {
              bad.push(`at scrollTop ${pos} the ${label} covers a ${String(hit.className).split(' ')[0]}`);
            }
          });
        });
        body.scrollTop = 0;
        // Dead space under the buttons is what the pinned footer removes.
        if (body.scrollHeight - (body.scrollTop + body.clientHeight) > 2) {
          body.scrollTop = body.scrollHeight;
          if (body.scrollHeight - (body.scrollTop + body.clientHeight) > 2) {
            bad.push('there is blank space left under the buttons');
          }
          body.scrollTop = 0;
        }
      }

      /* The scroll position survives a re-render and a return. Every tap in
         steps 3 and 4 rebuilds the body wholesale, and the readers that put it
         back used to name .sheet — which no longer scrolls. */
      if (body && body.scrollHeight > body.clientHeight + 40) {
        body.scrollTop = 40;
        renderMeetingMode();
        const after = mmScroller();
        if (!after || Math.abs(after.scrollTop - 40) > 2) {
          bad.push(`a re-render lost the scroll position (${after ? after.scrollTop : 'no scroller'}, expected 40)`);
        }
        if (after) after.scrollTop = 0;
      }
      mmHide();
    } finally {
      profile = wasProfile;
    }
    return bad.length === 0 || bad;
  });

  /* MEAL BLOCKS SAY THEIR NAME. The week grid rendered meals as a bare icon
     next to the block's OWN icon, so a cell showed the same glyph twice and
     named nothing. Asked of blockDisplayName, which is the one owner of what a
     block is called — tg2ShortLabel was the compressing form and went with the
     Day Blocks layout. */
  if (want('mealsAreNamedNotJustDrawn')) checks.mealsAreNamedNotJustDrawn = await page.evaluate(() => {
    const bad = [];
    const want = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
    Object.keys(want).forEach(id => {
      const label = blockDisplayName({ actId: id }, 'jenn').name;
      if (label !== want[id]) bad.push(`${id} reads "${label}", expected "${want[id]}"`);
      if (/\p{Extended_Pictographic}/u.test(label)) bad.push(`${id}'s label is still an emoji`);
    });
    return bad.length === 0 || bad;
  });

  /* DAILY BLOCKS EARN NO XP, AND ONE ALLOWANCE COVERS BOTH WRITERS.
     Every completed block used to earn a flat 20 against 100 per level, so five
     blocks was a level and a bowl of cereal was worth the same as a swim. There
     was no cap, and the meeting credited its weekly awards on top through a
     second path that knew nothing about the first. */
  if (want('dailyBlocksEarnNoXp')) checks.dailyBlocksEarnNoXp = await page.evaluate(() => {
    const bad = [];
    const kid = 'jenn';
    profile = 'jenn'; parentViewing = 'jenn'; weekOffset = 0;
    ctPrepareRead(); ctSetCurrentWeekFromPlanner();
    const wk = ctWeekKey, keys = mrWeekDayKeys(wk), day = keys[0];
    const before = keys.map(k => (getDayBlocks(k, kid) || []).slice());
    const prog = getProfData(kid).progress;
    const hadXp2 = prog.xp2, hadXp = prog.questXP;
    const hadByWeek = JSON.parse(JSON.stringify(prog.xpByWeek || {}));
    try {
      keys.forEach(k => setDayBlocks(k, [], kid));
      prog.xp2 = 0; prog.questXP = 0; prog.xpByWeek = {};

      // A week of nothing but meals and appointments earns nothing at all.
      setDayBlocks(day, [
        { id: 'x1', actId: 'breakfast', startMin: 7 * 60, durationMin: 30, checklistState: {} },
        { id: 'x2', actId: 'lunch', startMin: 12 * 60, durationMin: 30, checklistState: {} },
        { id: 'x3', actId: 'dinner', startMin: 18 * 60, durationMin: 60, checklistState: {} },
        { id: 'x4', actId: 'appt_medical', startMin: 15 * 60, durationMin: 30, checklistState: {} },
        { id: 'x5', actId: 'family', startMin: 19 * 60 + 30, durationMin: 30, checklistState: {} },
      ], kid);
      currentDayKey = day;
      ['x1', 'x2', 'x3', 'x4', 'x5'].forEach(id => completeQuest(id, day));
      if (getQuestXP(kid) !== 0) bad.push(`a week of meals earned ${getQuestXP(kid)} XP`);

      // Work does earn, and it is priced by what the time is for.
      keys.forEach(k => setDayBlocks(k, [], kid));
      prog.xp2 = 0; prog.questXP = 0; prog.xpByWeek = {};
      setDayBlocks(day, [
        { id: 'y1', actId: 'training', startMin: 17 * 60, durationMin: 60, tag: 'skating', checklistState: {} },
      ], kid);
      completeQuest('y1', day);
      const bodyXp = getQuestXP(kid);
      if (bodyXp !== QUEST_XP_BY_GROUP.body) bad.push(`a training block earned ${bodyXp}, expected ${QUEST_XP_BY_GROUP.body}`);

      /* ONE ALLOWANCE. Spend it with block XP, then ask the meeting to credit
         its weekly awards: it must find nothing left rather than adding its own
         total on top. */
      prog.xp2 = 0; prog.questXP = 0;
      prog.xpByWeek = {}; prog.xpByWeek[wk] = XP_WEEKLY_CAP;
      const r = addQuestXP(50, kid, wk);
      if (r.awarded !== 0) bad.push(`a full week still credited ${r.awarded} XP`);
      if (!r.capped) bad.push('a credit past the cap did not report itself as capped');
      if (xpWeekTally(kid, wk) !== XP_WEEKLY_CAP) bad.push('a full week does not read as full');

      // Under the cap, a credit lands whole and the tally follows it.
      prog.xpByWeek = {}; prog.xp2 = 0;
      const r2 = addQuestXP(30, kid, wk);
      if (r2.awarded !== 30) bad.push(`a credit under the cap awarded ${r2.awarded}`);
      if (xpWeekTally(kid, wk) !== 30) bad.push('the weekly tally did not follow the credit');

      /* ONE LEVEL CALCULATION. Today's hero and the parent portal each used to
         do this arithmetic themselves and could disagree about the same child. */
      prog.xp2 = QUEST_XP_PER_LEVEL * 2 + 10;
      const info = mrXpLevelInfo(kid);
      if (info.level !== 3) bad.push(`mrXpLevelInfo says level ${info.level}, expected 3`);
      if (info.perLevel !== QUEST_XP_PER_LEVEL) bad.push('the portal is using a different level threshold');

      /* Raising the threshold must not demote a child whose XP was banked on
         the old scale: with no xp2 stored the answer is DERIVED, so it is the
         same however many times anything runs and in whatever merge order. */
      delete prog.xp2;
      prog.questXP = 300;              // level 4 under the old 100-per-level scale
      if (mrXpLevelInfo(kid).level !== 4) {
        bad.push(`a child banked on the old scale reads as level ${mrXpLevelInfo(kid).level}, expected 4`);
      }
      const twice = getQuestXP(kid);
      if (getQuestXP(kid) !== twice) bad.push('reading the legacy total twice gives different answers');
    } finally {
      keys.forEach((k, i) => setDayBlocks(k, before[i], kid));
      prog.xp2 = hadXp2; prog.questXP = hadXp; prog.xpByWeek = hadByWeek;
    }
    return bad.length === 0 || bad;
  });

  /* ── Semantics an outside audit found missing ──
     None of the 19 sheets said it was a dialog, Escape did nothing, and focus
     stayed on the page behind. The markup carries the roles now, and
     openSheet/closeSheet own focus. The roles are asserted on the FILE, not
     the DOM: js/99-main.js patches the DOM at load, and a check that read the
     patched tree would pass on markup that says nothing. */
  {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const bad = [];
    const count = (re) => (html.match(re) || []).length;
    if (count(/<main\b/g) !== 1) bad.push(`${count(/<main\b/g)} <main> elements, want 1`);
    if (count(/<header class="topbar/g) !== 8) bad.push(`${count(/<header class="topbar/g)} topbars are <header>, want 8`);
    if (count(/<div class="topbar(?:\s|")/g)) bad.push('a topbar is still a <div>');
    const toggles = html.match(/<div class="(?:buffer|repeat)-toggle[^>]*>/g) || [];
    const bare = toggles.filter(t => !/role="switch"/.test(t) || !/tabindex="0"/.test(t) || !/aria-checked=/.test(t));
    if (bare.length) bad.push(`${bare.length} of ${toggles.length} toggles carry no switch semantics in the markup`);
    const overlays = html.match(/<div class="overlay[^"]*" id="[^"]+"/g) || [];
    /* 19: up one for the Record sheet (js/41-record.js), then down one when the
       weekly meeting stopped being a sheet and became `screen-meeting`. The
       count is stated rather than derived on purpose: a NEW overlay is a new
       dialog mechanism unless it goes through openSheet/closeSheet, which own
       focus and Escape, so one appearing unannounced is worth being told about.
       A DEPARTING one is worth being told about too — this number going down is
       how you find out a dialog was replaced by something else. */
    if (overlays.length !== 19) bad.push(`${overlays.length} static overlays, expected 19`);
    if (count(/role="tabpanel"/g) !== 5) bad.push(`${count(/role="tabpanel"/g)} tabpanels in the file, want 5 (one per tab)`);
    if (count(/<h4>✅ To-do<\/h4>/g)) bad.push('the To-do heading still skips from h2 to h4');
    if (want('theMarkupSaysWhatThingsAre')) checks.theMarkupSaysWhatThingsAre = bad.length === 0 || bad;
  }

  if (want('sheetsAreDialogsYouCanLeave')) checks.sheetsAreDialogsYouCanLeave = await page.evaluate(async () => {
    const bad = [];
    profile = 'jenn'; parentViewing = 'jenn';
    showScreen('week');
    // Every static overlay's sheet is a labelled modal dialog.
    document.querySelectorAll('.overlay[id]').forEach(ov => {
      if (ov.id === 'appDialogOverlay') return;
      const sheet = ov.querySelector('.sheet');
      if (!sheet) { bad.push(`${ov.id}: no sheet`); return; }
      if (sheet.getAttribute('role') !== 'dialog') bad.push(`${ov.id}: sheet is not role=dialog`);
      if (sheet.getAttribute('aria-modal') !== 'true') bad.push(`${ov.id}: not aria-modal`);
      const by = sheet.getAttribute('aria-labelledby');
      const named = (sheet.getAttribute('aria-label') || '').trim() || (by && document.getElementById(by));
      if (!named) bad.push(`${ov.id}: the dialog has no accessible name`);
    });
    // Open one from a button: focus moves in, Escape closes it, focus comes back.
    const opener = document.querySelector('#screen-week button');
    opener.focus();
    openSheet('templateOverlay');
    const ov = document.getElementById('templateOverlay');
    if (!ov.classList.contains('open')) bad.push('openSheet did not open the sheet');
    if (!ov.contains(document.activeElement)) bad.push('opening a sheet left focus on the page behind it');
    if (ov._opener !== opener) bad.push('the sheet did not remember what opened it');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 20));
    if (ov.classList.contains('open')) bad.push('Escape did not close the sheet');
    if (document.activeElement !== opener) bad.push('closing the sheet did not give focus back to the opener');
    // Escape with nothing open is nobody's business.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    // The app dialog owns Escape while it is up: a sheet under it must survive.
    openSheet('templateOverlay');
    const p = showPrompt('name?');
    await new Promise(r => setTimeout(r, 20));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await p;
    await new Promise(r => setTimeout(r, 20));
    if (!ov.classList.contains('open')) bad.push('Escape on the app dialog also closed the sheet beneath it');
    closeSheet('templateOverlay');
    // The runtime dialogs are named too.
    const q = showConfirm('sure?');
    const dlg = document.querySelector('#appDialogOverlay .sheet');
    const by = dlg && dlg.getAttribute('aria-labelledby');
    if (!by || !document.getElementById(by) || !document.getElementById(by).textContent.trim()) bad.push('the app dialog has no accessible name');
    _appDialogCancel(); await q;
    return bad.length === 0 || bad;
  });

  // The portal's five destinations are tabs; the fifteen detail panels under
  // them are not, and a screen reader must not be told a tab exists for them.
  if (want('theParentPortalTellsATabFromARegion')) checks.theParentPortalTellsATabFromARegion = await page.evaluate(() => {
    const bad = [];
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    if (tabs.length !== 5) bad.push(`${tabs.length} tabs, expected 5`);
    tabs.forEach(t => {
      const panel = document.getElementById(t.getAttribute('aria-controls') || '');
      if (!panel) { bad.push(`${t.id}: aria-controls points at nothing`); return; }
      if (panel.getAttribute('role') !== 'tabpanel') bad.push(`${t.id}: its panel is not a tabpanel`);
      if (panel.getAttribute('aria-labelledby') !== t.id) bad.push(`${panel.id}: not labelled by its tab`);
    });
    document.querySelectorAll('.parent-panel').forEach(p => {
      const role = p.getAttribute('role');
      if (role === 'tabpanel') return;
      if (role !== 'region') { bad.push(`${p.id}: role is ${role}, want region`); return; }
      if (!p.getAttribute('aria-label')) bad.push(`${p.id}: region with no name`);
    });
    // The Meeting tab used to control a panel that did not exist.
    profile = 'parent'; showScreen('parent'); setParentTab('review');
    const meetingPanel = document.getElementById(document.getElementById('pdestbtn-meeting').getAttribute('aria-controls'));
    if (!meetingPanel || meetingPanel.hidden) bad.push('the Meeting tab does not show the panel it claims to control');
    return bad.length === 0 || bad;
  });

  // Every form control has a name a screen reader can say. Placeholder text
  // is not one: it vanishes the moment she types.
  if (want('everyControlHasAName')) checks.everyControlHasAName = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('input[id]:not([type=hidden]), select[id], textarea[id]').forEach(el => {
      const named = (el.getAttribute('aria-label') || '').trim()
        || el.getAttribute('aria-labelledby')
        || document.querySelector(`label[for="${el.id}"]`)
        || el.closest('label');
      if (!named) bad.push(el.id);
    });
    return bad.length === 0 || bad;
  });

  // The build number is on the page. The service worker answers offline from a
  // cached shell, so a device can run an old build for a long time, and "which
  // one is this?" had no answer anywhere a parent could read it. BUILD
  // (js/01-config.js) is the page's copy of SW_VERSION — tests/check-sw-shell.js
  // holds the two equal — and it is shown in two places: under the tiles of the
  // Today More sheet, and under the list on the parent portal's App landing.
  if (want('theBuildNumberIsOnThePage')) checks.theBuildNumberIsOnThePage = await page.evaluate(() => {
    const problems = [];
    const build = (typeof BUILD === 'string') ? BUILD.trim() : '';
    if (!build) problems.push('BUILD is not declared as a non-empty string — there is no build number for a screen to show');
    const click = (sel) => { const el = document.querySelector(sel); if (el) el.click(); return !!el; };

    // 1 · Today → bottom nav → More → the line under the tiles.
    profile = 'jenn'; parentViewing = 'jenn';
    goToday();
    if (!click('#kidNav [data-td-nav="more"]')) problems.push('the kid nav has no More button');
    const sheet = document.querySelector('#tdMoreOverlay .td-more-sheet');
    if (!sheet) {
      problems.push('the More sheet did not open');
    } else {
      const line = sheet.querySelector('.td-more-grid ~ *');
      const text = line ? line.textContent : '';
      if (!build || !text.includes(build)) problems.push(`the More sheet has no line under the tiles naming build ${build || '(none)'} — found "${text.trim()}"`);
      // The sheet is reached from a kid screen, so the kid 13px floor applies.
      if (line && parseFloat(getComputedStyle(line).fontSize) < 13) problems.push(`the More sheet's build line is ${getComputedStyle(line).fontSize}, under the 13px floor`);
    }
    document.getElementById('tdMoreOverlay')?.classList.remove('open');

    // 2 · Parent Mode → App → the line under the list.
    profile = 'parent'; showScreen('parent'); renderParentHome();
    if (!click('#pdestbtn-app')) problems.push('the portal has no App destination');
    const wrap = document.getElementById('ptab-app-wrap');
    const card = wrap && wrap.querySelector('.pn-card');
    const after = card && card.nextElementSibling;
    const appText = after ? after.textContent : '';
    if (!card) problems.push('the App landing drew no list');
    else if (!build || !appText.includes(build)) problems.push(`the App landing has no line under the list naming build ${build || '(none)'} — found "${appText.trim()}"`);
    // Only App carries it: Setup is the other landing and says nothing about builds.
    setParentDest('setup');
    const setupWrap = document.getElementById('ptab-setup-wrap');
    if (build && setupWrap && setupWrap.textContent.includes(build)) problems.push('the Setup landing shows the build number too — it belongs on App only');

    profile = 'jenn'; goToday();
    return problems.length ? problems : true;
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
  if (ONLY.length) {
    // A named check that recorded nothing is a failure, not a quiet skip.
    const neverRan = ONLY.filter(n => !(n in checks));
    if (failed.length) console.log(`FAILED: ${failed.join(', ')}`);
    if (neverRan.length) console.log(`NEVER RAN: ${neverRan.join(', ')} (named in SMOKE_ONLY, no result recorded)`);
    console.log(`PARTIAL RUN (SMOKE_ONLY): ${Object.keys(checks).length} of ${ALL_CHECKS.length} checks — not a pass of the suite`);
    await browser.close();
    process.exit(failed.length || neverRan.length ? 1 : 0);
  }
  console.log(failed.length ? `FAILED: ${failed.join(', ')}` : 'ALL SMOKE CHECKS PASSED');
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
