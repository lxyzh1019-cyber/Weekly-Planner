// Smoke group: the parent portal on the component kit (Consistency PR 10). thePortalKitHolds44px: every kit tab, button, chip and kid switch the portal draws (js/11-parent.js, js/32-parent-now.js) is at least 44×44 at 390×844 and 1194×834, in Pop and in Calm — the day squares, her rating's chips and the learning steppers included (She told me… is opened on every day it offers until each has been drawn). tests/smoke.js calls it near the end of the run, on its one shared page; it gives Jenn's today a training block while She told me… is open (her rating shows only on a training day) and takes it off again, and puts back the look, the size, the profile and the portal's place (unlocked, scope, viewing, tab, History's view), as everyHeaderMeasuresToTheExactValues does.
module.exports = async ({ page, want, checks, setLook, clearLooks }) => {
  if (!want('thePortalKitHolds44px')) return;
  const before = page.viewportSize();
  const problems = [];
  const was = await page.evaluate(() => ({ profile, unlocked: parentUnlockedThisSession, scope: parentScope, viewing: parentViewing, tab: parentTab, history: parentHistoryView, answerDay: pnAnswerDay, answerKid: pnAnswerKid }));
  try {
    for (const look of ['pop', 'calm']) {
      await setLook(look);
      for (const [w, h, size] of [[1194, 834, 'iPad'], [390, 844, 'phone']]) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(100);
        problems.push(...await page.evaluate(async ([look, size]) => {
          const out = [];
          const tag = `${look} ${size}`;
          const wait = (ms) => new Promise(r => setTimeout(r, ms));
          const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
          const KIT = '.ui-btn, .ui-chip, .ui-tabs > button, .ui-kids > button, .ui-stepper > button';
          /* Measure every kit control on show in `root`; `want` names a kind that
             must be there, so a screen that did not open cannot measure clean. */
          const measure = (where, root, wantSel) => {
            if (!root) { out.push(`${tag} ${where}: not drawn`); return; }
            const all = [...root.querySelectorAll(KIT)].filter(shown);
            if (wantSel && !root.querySelector(wantSel)) out.push(`${tag} ${where}: no ${wantSel} drawn, so nothing of it was measured`);
            if (!all.length) out.push(`${tag} ${where}: no kit control on show`);
            all.forEach(b => {
              const r = b.getBoundingClientRect();
              if (r.width < 43.5 || r.height < 43.5) out.push(`${tag} ${where}: "${(b.getAttribute('aria-label') || b.textContent).trim().replace(/\s+/g, ' ').slice(0, 40)}" is ${Math.round(r.width)}×${Math.round(r.height)}, under 44px`);
            });
          };
          profile = 'parent'; parentUnlockedThisSession = true; parentViewing = 'jenn';
          showScreen('parent'); setParentScope('jenn');
          const phone = size === 'phone';
          // The destinations: the header's .ui-tabs on the iPad, the bottom bar's .ui-btn on the phone.
          setParentTab('setup'); await wait(60);
          const tabs = [...document.querySelectorAll('#parentDests > [role="tab"]')].filter(shown);
          const nav = [...document.querySelectorAll('#parentNav > .ui-btn')].filter(shown);
          if (phone ? nav.length !== 6 : tabs.length !== 6) out.push(`${tag}: ${phone ? nav.length + ' bottom-bar' : tabs.length + ' header'} destinations on show, want 6`);
          measure('Setup', document.getElementById('screen-parent'), '.parent-scope.ui-kids > button');
          if (phone) measure('the bottom bar', document.getElementById('parentNav'), '.ui-btn');
          setParentTab('now'); await wait(60);
          measure('Now', document.getElementById('pnWrap'), '.pn-days > .pn-day.ui-chip');
          // Her rating shows only on a day with training: give Jenn's today one, put back after.
          const tk = todayKey(), heldBlocks = JSON.stringify(getDayBlocks(tk, 'jenn') || []);
          if (!ckTrainingBlockOn('jenn', tk)) setDayBlocks(tk, [...JSON.parse(heldBlocks), { id: 'kit44-tr', actId: 'training', tag: 'skating', startMin: 6 * 60, durationMin: 30 }], 'jenn');
          try {
            pnOpenToldSheet(); await wait(350);
            measure('Now › She told me', document.getElementById('pnToldBody'), '.pn-answer-kids > button');
            // Each girl, every day she can be answered for, until her rating and a learning stepper have been drawn.
            let rated = false, stepped = false;
            const days = () => [...document.querySelectorAll('#pnToldBody .pn-days > .pn-day.ui-chip:not(:disabled)')];
            for (const kid of ['jenn', 'jess']) {
              document.querySelector(`#pnToldBody [data-pn-action="answer-kid"][data-kid="${kid}"]`).click(); await wait(60);
              for (let i = 0; i < days().length && !(rated && stepped); i++) {
                days()[i].click(); await wait(60);
                const body = document.getElementById('pnToldBody');
                rated = rated || !!body.querySelector('.pn-rates > .pn-rate.ui-chip');
                stepped = stepped || !!body.querySelector('.pn-learn .ui-stepper > button');
                measure('Now › She told me', body, '.pn-days > .pn-day.ui-chip');
              }
            }
            if (!rated) out.push(`${tag} Now › She told me: no day drew her rating's chips, so none was measured`);
            if (!stepped) out.push(`${tag} Now › She told me: no day drew a learning stepper, so none was measured`);
            pnSheetOpen = false; closeSheet('pnToldOverlay'); await wait(50);
          } finally { setDayBlocks(tk, JSON.parse(heldBlocks), 'jenn'); }
          setParentDest('meeting'); await wait(60);
          measure('Meeting', document.getElementById('ptab-review'), '.review-day-row > .ui-btn');
          setParentDest('history'); await wait(60);
          measure('History', document.getElementById('ptab-history-wrap'), '[data-parent-history].ui-chip');
          setParentTab('analysis'); await wait(60);
          measure('History › Analysis', document.getElementById('ptab-analysis'), '.perf-table > .ui-btn');
          parentMenuToggle(true);
          measure('the 🔒 menu', document.getElementById('parentMenu'), '#parentLookBtn');
          parentMenuToggle(false);
          return out;
        }, [look, size]));
      }
    }
  } finally {
    await page.setViewportSize(before);
    await clearLooks();
    await page.evaluate((was) => {
      profile = was.profile; parentUnlockedThisSession = was.unlocked; parentViewing = was.viewing;
      if (was.tab) parentTab = was.tab;
      parentScope = was.scope; parentHistoryView = was.history; pnAnswerDay = was.answerDay; pnAnswerKid = was.answerKid;
      goToday();
    }, was);
  }
  checks.thePortalKitHolds44px = problems.length ? [...new Set(problems)] : true;
};
