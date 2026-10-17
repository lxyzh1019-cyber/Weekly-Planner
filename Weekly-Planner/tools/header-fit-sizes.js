// Measures the phone header's stepped fit sizes (docs/handoff/header-exact-values.md notes 5-7): per look and width step, the largest half-px size at which the widest text fits. Usage: NODE_PATH=… SMOKE_CHROMIUM=… node tools/header-fit-sizes.js
const path = require('path');
const { chromium } = require('playwright-core');

const STEPS = [360, 375, 390];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Edmonton' });
  for (const p of ['**://firestore.googleapis.com/**', '**://*.firebaseio.com/**', '**://www.gstatic.com/firebasejs/**',
    '**://identitytoolkit.googleapis.com/**', '**://firebaseinstallations.googleapis.com/**']) await page.route(p, r => r.abort());
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(1200);
  const out = [];
  for (const look of ['pop', 'calm']) {
    await page.evaluate(async (l) => {
      applyLook(l);
      // Calm's fonts arrive by a stylesheet applyLook adds: wait for the faces, then load them
      for (let i = 0; i < 50 && l === 'calm' && ![...document.fonts].some(f => /Lexend/.test(f.family)); i++) await new Promise(r => setTimeout(r, 100));
      await Promise.all(['600 16px Lexend', '600 16px "Patrick Hand"', '16px "Patrick Hand"', '16px Lexend']
        .map(f => document.fonts.load(f).catch(() => null)));
      await document.fonts.ready;
    }, look);
    // [what, picture's size, how to open and find the element, the widest text of a year or the fixed text]
    const items = ['week', 'day', 'school'];
    for (const item of items) {
      const res = { look, item, steps: [], fitFrom: null };
      const fitAt = async (w) => {
        await page.setViewportSize({ width: w, height: 844 });
        return page.evaluate((item) => {
          profile = 'jenn'; parentViewing = 'jenn'; navReturnStack = [];
          let el, texts, base, ok;
          if (item === 'week') {
            goWeek(); setWeekView('full');
            el = document.getElementById('weekRangeLabel');
            texts = []; base = 20;
            for (let d = new Date(2026, 0, 5); d.getFullYear() < 2028; d.setDate(d.getDate() + 7)) {
              const z = new Date(d); z.setDate(z.getDate() + 6);
              if (z.getMonth() !== d.getMonth()) texts.push(`${MONTH_SHORT[d.getMonth()]} ${d.getDate()} – ${MONTH_SHORT[z.getMonth()]} ${z.getDate()}`);
            }
            ok = () => el.scrollWidth <= el.clientWidth;
          } else if (item === 'day') {
            goWeek(); openDay(getDayKeys(weekOffset)[0], 0); setDayViewSpan(1);
            el = document.querySelector('#screen-day > .hdr .hdr-context > .hdr-title');
            texts = []; base = 20;
            for (let d = new Date(2026, 0, 1); d.getFullYear() < 2028; d.setDate(d.getDate() + 1)) texts.push(fmtDay(dateToLocalKey(d), 'long'));
            const btn = el.querySelector('.hdr-title-btn');
            ok = () => el.scrollWidth <= el.clientWidth && (!btn || btn.scrollWidth <= el.clientWidth);
          } else {
            goToday(); mnyOpenMyMoney('jenn'); mnyGoTab('school');
            const tabs = document.querySelector('#mnySchoolWrap > header.hdr .hdr-tabs');
            el = tabs.querySelector('.hdr-tab[aria-current="page"]');
            texts = [null]; base = 18;
            const row = tabs.closest('.hdr-row');
            ok = () => tabs.scrollWidth <= tabs.clientWidth && row.scrollWidth <= row.clientWidth
              && [...el.children].every(c => c.getBoundingClientRect().right <= el.getBoundingClientRect().right + 0.5);
          }
          const target = item === 'day' ? (el.querySelector('.hdr-title-btn') || el) : el;
          const saved = target.textContent;
          const fits = (size, text) => {
            el.style.fontSize = size + 'px';
            if (text !== null) target.textContent = text;
            return ok();
          };
          // the widest text at the picture's size
          let widest = texts[0], widestW = -1;
          if (texts[0] !== null) {
            // measured in place, every rule of the header applying: the element at its text's own width
            el.style.fontSize = base + 'px'; el.style.flex = 'none'; el.style.minWidth = '0'; el.style.width = 'max-content';
            for (const t of texts) { target.textContent = t; const w = target.getBoundingClientRect().width; if (w > widestW) { widestW = w; widest = t; } }
            el.style.flex = ''; el.style.minWidth = ''; el.style.width = '';
          }
          let size = base;
          while (size > 8 && !fits(size, widest)) size -= 0.5;
          el.style.fontSize = '';
          if (texts[0] !== null) target.textContent = saved;
          const room = item === 'school' ? null : Math.round(el.clientWidth * 10) / 10;
          let detail = null;
          if (item === 'school') {
            const tabs = el.parentElement;
            detail = [size + 0.5, size].map(z => { fits(z, null); const r = el.getBoundingClientRect();
              return { z, tabsSW: tabs.scrollWidth, tabsCW: tabs.clientWidth, el: Math.round(r.width * 10) / 10,
                kids: [...el.children].map(c => Math.round((c.getBoundingClientRect().right - r.right) * 10) / 10) }; });
            el.style.fontSize = '';
          }
          setWeekView('full'); goToday();
          return { size, widest, widestW: Math.round(widestW * 10) / 10, room, detail };
        }, item);
      };
      for (const w of STEPS) res.steps.push({ w, ...(await fitAt(w)) });
      for (let w = 360; w <= 460; w++) { const r = await fitAt(w); if (r.size === (item === 'school' ? 18 : 20)) { res.fitFrom = w; break; } }
      out.push(res);
    }
  }
  await browser.close();
  for (const r of out) console.log(JSON.stringify(r));
})().catch(e => { console.error(e); process.exit(1); });
