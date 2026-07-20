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

  // Kid money surface: How I earn (no Bank screen for kids)
  checks.kidMoneyLabel = await page.evaluate(() =>
    document.getElementById('weekMoneyBtn').textContent.includes('How I earn'));
  checks.kidCannotOpenBank = await page.evaluate(() => {
    openMoneyScreen();
    return !document.getElementById('screen-money').classList.contains('active');
  });
  await page.evaluate(() => closeSheet('howIEarnOverlay'));

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

  checks.noConsoleErrors = errors.length === 0;

  const failed = Object.entries(checks).filter(([,v]) => !v).map(([k]) => k);
  console.log(JSON.stringify({ checks, errors }, null, 2));
  console.log(failed.length ? `FAILED: ${failed.join(', ')}` : 'ALL SMOKE CHECKS PASSED');
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
