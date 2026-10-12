// Dumps the text of 10 Sunday screens (jenn, jess x Guess, Payday girl, Payday parent, I choose, Signed) and their dollar figures.
// Usage: NODE_PATH=<repo>/node_modules SMOKE_CHROMIUM=<chrome> node sunday-figures.js <repo dir> <out.json>
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const repo = process.argv[2], out = process.argv[3];
(async () => {
  const src = fs.readFileSync(path.join(repo, 'tests', 'smoke.js'), 'utf8');
  const a = src.indexOf('const SD_HELPERS_SRC = `') + 'const SD_HELPERS_SRC = `'.length;
  const helpers = src.slice(a, src.indexOf('})();`;', a) + 5).replace(/\\`/g, '`');
  const wanted = Date.UTC(2026, 9, 7, 18, 0, 0); // 2026-10-07 noon Edmonton (MDT = UTC-6)
  const offset = wanted - Date.now();
  const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM });
  const page = await browser.newPage({ viewport: { width: 1194, height: 834 }, timezoneId: 'America/Edmonton' });
  await page.addInitScript((off) => {
    const RealDate = Date;
    function D(...x) { if (!new.target) return new RealDate(RealDate.now() + off).toString(); return x.length ? new RealDate(...x) : new RealDate(RealDate.now() + off); }
    D.prototype = RealDate.prototype; D.now = () => RealDate.now() + off; D.parse = RealDate.parse; D.UTC = RealDate.UTC;
    window.Date = D;
  }, offset);
  for (const p of ['**://firestore.googleapis.com/**', '**://*.firebaseio.com/**', '**://www.gstatic.com/firebasejs/**',
    '**://identitytoolkit.googleapis.com/**', '**://firebaseinstallations.googleapis.com/**']) await page.route(p, r => r.abort());
  await page.goto('file://' + path.join(path.resolve(repo), 'index.html'));
  await page.waitForTimeout(1200);
  if (await page.evaluate(() => !!fbDocRef)) { console.error('reached Firebase, abort'); process.exit(1); }
  await page.evaluate(() => selectProfile('jenn'));
  await page.waitForTimeout(400);
  await page.evaluate(helpers);
  const screens = await page.evaluate(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const text = () => (document.getElementById('familyMeetingBody').innerText || '').replace(/[ \t]+/g, ' ');
    const res = {};
    for (const kid of ['jenn', 'jess']) {
      const snap = sdSnap(), unpin = sdPin(3);
      try {
        const wk = sdSeedWeek(kid);
        renderMeetingMode(); await wait(60);
        sdClick('[data-mny-action="sd-newok"]');
        profile = kid; renderMeetingMode(); await wait(60);
        res[kid + ' guess'] = text();
        const d = sdCur();
        d.step = 1; d.shown = 99; d.guess = 40; sdSave(d);
        profile = kid; renderMeetingMode(); await wait(60);
        res[kid + ' payday girl'] = text();
        profile = 'parent'; parentUnlockedThisSession = true; renderMeetingMode(); await wait(60);
        res[kid + ' payday parent'] = text();
        d.step = 2; sdSave(d); profile = kid; renderMeetingMode(); await wait(60);
        res[kid + ' choose'] = text();
        sdSignHer(kid, wk);
        mnyMeetKid = kid; mmGoTo('money'); renderMeetingMode(); await wait(60);
        res[kid + ' signed'] = text();
      } finally { if (mmIsOpen()) mmHide(); unpin(); sdRestore(snap); }
    }
    return res;
  });
  const figs = {};
  let total = 0;
  for (const [k, t] of Object.entries(screens)) { figs[k] = t.match(/-?\$[0-9][0-9,]*(\.[0-9]+)?/g) || []; total += figs[k].length; }
  fs.writeFileSync(out, JSON.stringify({ total, figs, screens }, null, 1));
  console.log('screens ' + Object.keys(screens).length + ', dollar figures ' + total);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
