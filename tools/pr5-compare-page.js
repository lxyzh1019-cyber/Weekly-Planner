// Builds docs/handoff/consistency/pr5-parent-headers-compare.html: the owner's PARENT v2 pictures beside the build's parent headers (portal, viewing a girl, Monthly; 1194 and 390, Pop and Calm), and the numbered differences of header-exact-values.md as picture pairs. Usage: SMOKE_CHROMIUM=… node tools/pr5-compare-page.js
const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright-core'));

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'handoff', 'consistency', 'pr5-parent-headers-compare.html');
const PICS = path.join(ROOT, 'docs', 'handoff', 'consistency', 'headers');
const b64 = (buf) => 'data:image/png;base64,' + buf.toString('base64');
const owner = (name) => b64(fs.readFileSync(path.join(PICS, name)));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function shot(page, look, w, h, open) {
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(async (l) => {
    ['jenn', 'jess', 'parent'].forEach(k => { try { localStorage.setItem('wp_look_' + k, l); } catch (e) {} });
    applyLook(l);
    await document.fonts.ready;
  }, look);
  const sel = await page.evaluate((open) => {
    profile = 'parent'; parentUnlockedThisSession = true; parentViewing = 'jenn'; mmReturn = null;
    if (open === 'portal-setup' || open === 'portal-now') {
      showScreen('parent'); setParentScope('jenn'); setParentTab(open === 'portal-now' ? 'now' : 'setup');
      return '#screen-parent > .hdr';
    }
    if (open === 'prefs') { showScreen('parent'); setParentTab('prefs'); return '#paPrefsWrap'; }
    if (open === 'monthly') { openParentMonthly('jenn'); return '#screen-parent-monthly > .hdr'; }
    goWeek(); setWeekView('full');
    if (open === 'view-day') { openDay(getDayKeys(weekOffset)[0], 0); return '#screen-day > .hdr'; }
    return '#screen-week > .hdr';
  }, open);
  await page.waitForTimeout(300);
  return b64(await page.locator(sel).first().screenshot());
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM });
  const page = await browser.newPage({ viewport: { width: 1194, height: 834 } });
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForTimeout(1500);
  const looks = [['pop', 'Pop'], ['calm', 'Calm']];
  const sizes = [['ipad', 'iPad 1194', 1194, 834], ['phone', 'phone 390', 390, 844]];
  const build = {};
  for (const [sz, , w, h] of sizes) for (const [lk] of looks) {
    for (const open of ['portal-setup', 'portal-now', 'view-week', 'view-day', 'monthly']) build[`${sz}-${lk}-${open}`] = await shot(page, lk, w, h, open);
  }
  build['ipad-pop-prefs'] = await shot(page, 'pop', 1194, 834, 'prefs');
  await browser.close();

  const img = (src, alt) => `<img src="${src}" alt="${esc(alt)}">`;
  const pair = (leftTitle, left, rightTitle, right) => `<div class="pair"><figure><figcaption>${esc(leftTitle)}</figcaption>${left}</figure><figure><figcaption>${esc(rightTitle)}</figcaption>${right}</figure></div>`;
  const noRef = '<div class="noref">No reference picture</div>';
  let body = '';
  body += '<h2>Overview (iPad Pop first)</h2>';
  for (const [sz, szName] of sizes) for (const [lk, lkName] of looks) {
    const b = (o) => img(build[`${sz}-${lk}-${o}`], `${szName} ${lkName} ${o}`);
    const right = sz === 'ipad'
      ? `${b('portal-setup')}<p>Portal (Setup)</p>${b('view-week')}<p>Parent viewing Jenn's week</p>`
      : `${b('portal-setup')}<p>Portal (Setup)</p>`;
    body += `<h3>${esc(szName)} · ${esc(lkName)}</h3>` + pair('Owner picture (PARENT v2)', img(owner(`parent-${sz}-${lk}.png`), 'owner'), 'Build', right);
  }
  const d = (n, title, text, pairHtml) => `<section class="diff"><h2>${n}. ${esc(title)}</h2><p>${esc(text)}</p>${pairHtml}</section>`;
  const ip = (o) => img(build[`ipad-pop-${o}`], o), ph = (o) => img(build[`phone-pop-${o}`], o);
  body += '<h2>Numbered differences (header-exact-values.md, "The parent header"); the owner decides each at Stage 31</h2>';
  body += d(1, 'The girl switch hides on Now', 'The picture draws Both · Jenn · Jess on Now (All · 🐥 · 🦊 on the phone). Now has its own girl switch, so the portal\'s stays hidden there, as today; it shows on every other destination.',
    pair('Owner: iPad Pop', img(owner('parent-ipad-pop.png'), 'owner'), 'Build: Now, iPad then phone (Pop)', ip('portal-now') + ph('portal-now')));
  body += d(2, 'Viewing a girl keeps the kid\'s row; 44px buttons and switch cells', 'Row 1 keeps the kid\'s 52px buttons and 52px pink avatar (picture 44); the sub-bar buttons are 44px (picture 36) and the girl switch\'s cells 44px high (picture 42), the grown-ups\' tap floor.',
    pair('Owner: iPad Pop', img(owner('parent-ipad-pop.png'), 'owner'), 'Build: Week, then Day (iPad Pop)', ip('view-week') + ip('view-day')));
  body += d(3, 'Parent Monthly has no picture', '◀ Parent, "Monthly", ◀ month ▶ in the middle (between the arrows on a phone, "Oct 2026") and the Jenn / Jess switch; no badge.',
    pair('Owner', noRef, 'Build: iPad Pop, phone Pop, iPad Calm', ip('monthly') + ph('monthly') + img(build['ipad-calm-monthly'], 'monthly calm')));
  body += d(4, 'The way back is in the sub-bar', 'The picture puts "◀ Now" at row 1\'s left; the build keeps the kid\'s row and puts "◀ Hub" ("◀ Back to weekly meeting" while a meeting waits) first in the sub-bar.',
    pair('Owner: iPad Pop', img(owner('parent-ipad-pop.png'), 'owner'), 'Build: Week (iPad Pop)', ip('view-week')));
  body += d(5, 'The Week\'s sub-bar has Switch; Confirm all and Mark reviewed are on the Day\'s', 'Confirming and reviewing are per day, with the child\'s name in the words.',
    pair('Build: Week', ip('view-week'), 'Build: Day', ip('view-day')));
  body += d(6, 'The phone sub-bar has no picture', 'The iPad\'s parts with the words in the labels: ◀, the girl\'s name, ✅ (count), 🚫 (count), 📋.',
    pair('Owner', noRef, 'Build: phone Week then Day (Pop, Calm)', ph('view-week') + ph('view-day') + img(build['phone-calm-view-day'], 'day calm')));
  body += d(7, 'Reading size default 1.2 (a question)', 'With nothing stored the grown-up pages read at 1.2; "Larger" is now 1.2 (was 1.15) so the default is a listed choice, and a stored 1.15 reads as Larger.',
    pair('Owner', noRef, 'Build: App › Preferences (iPad Pop, default)', ip('prefs')));
  body += d(8, 'The portal\'s tabs as the picture', 'The current destination shows its icon, the others their word alone; ⚙️ App its icon; no date in the bar.',
    pair('Owner: iPad Pop', img(owner('parent-ipad-pop.png'), 'owner'), 'Build: Setup (iPad Pop)', ip('portal-setup')));
  body += d(9, 'Two ways back on a parent\'s Day and Week', 'Row 1 has "◀ Hub" and the sub-bar has "◀ Hub" too (the old banner also had two). Question: keep only the one in row 1?',
    pair('Owner', noRef, 'Build: Day (iPad Pop)', ip('view-day')));
  body += d(10, 'The old banner hint is gone', 'The old Parent Mode banner said "Pin activities with long-tap"; the new sub-bar shows "Reviewing Jenn\'s day" instead. Question: bring the hint back (e.g. in the sub-bar or a tooltip) or leave it out?',
    pair('Owner', noRef, 'Build: Day (iPad Pop)', ip('view-day')));
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>PR 5 parent headers — owner picture beside the build</title>
<style>body{font:15px/1.4 system-ui,sans-serif;margin:24px;color:#1c2240}h2{margin-top:32px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}figure{margin:0;border:1px solid #ccc;padding:8px}figcaption{font-weight:600;margin-bottom:6px}img{max-width:100%;display:block;margin-bottom:6px;border:1px solid #eee}.noref{padding:40px;text-align:center;background:#f4f4f4;color:#666}.diff{border-top:2px solid #1c2240;margin-top:28px}</style>
<h1>PR 5 — parent headers: the owner's picture beside the build</h1>
<p>Stage 30. Source: docs/handoff/consistency/headers/parent-*.png (PARENT v2, SRC 258-329). Build: this branch, captured by tools/pr5-compare-page.js. Values: docs/handoff/header-exact-values.md, Parent rows.</p>
<p><b>Proof: pictures 33 screens × 2 sizes (iPad 1194×834, phone 390×844) × 2 looks, 132 changed (all planned) · figures: parent header rows measured by everyHeaderMeasuresToTheExactValues (portal, Week, Day, Monthly × 2 sizes × 2 looks) · tests: 21/21 header and parent checks on this PC; GitHub run 38093037239 on 45ad22b: 15/15 jobs green, pictures included; references refreshed from run 38092283483</b></p>
${body}</html>`;
  fs.writeFileSync(OUT, html);
  console.log('wrote', path.relative(ROOT, OUT), Math.round(html.length / 1024) + ' KB');
})();
