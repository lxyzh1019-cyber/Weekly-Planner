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
          const KIT = '.ui-btn, .ui-chip, .ui-tabs > button, .ui-kids > button, .ui-stepper > button, .ui-days > button';
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
          /* A seven-day row (Stage 51, G1/G2): 7 cells, each with a spoken name, and its marks
             by CSS (• today, ✓ confirmed, both when both) that agree with the cell's state. */
          const markOf = (c) => { const m = getComputedStyle(c, '::after').content; return m === 'none' || m === 'normal' ? '' : m.replace(/^"|"$/g, '').replace(/ /g, ' '); };
          const daysCheck = (where, row, named, needOk = true) => {
            const cells = row ? [...row.children] : [];
            if (cells.length !== 7) { out.push(`${tag} ${where}: ${cells.length} day cells, want 7`); return; }
            cells.forEach((c, i) => {
              const ok = c.classList.contains('ui-day--ok'), now = c.getAttribute('aria-current') === 'date';
              const want = (now ? '•' : '') + (now && ok ? ' ' : '') + (ok ? '✓' : '');
              if (markOf(c) !== want) out.push(`${tag} ${where}: day cell ${i + 1} mark is "${markOf(c)}", want "${want}"`);
              if (!(c.getAttribute('aria-label') || '').trim()) out.push(`${tag} ${where}: day cell ${i + 1} has no aria-label`);
              if (named && !named.test(c.getAttribute('aria-label') || '')) out.push(`${tag} ${where}: day cell ${i + 1} aria-label "${c.getAttribute('aria-label')}" lacks its state or %`);
            });
            if (!cells.some(c => c.getAttribute('aria-current') === 'date')) out.push(`${tag} ${where}: no cell is today`);
            if (needOk && !cells.some(c => c.classList.contains('ui-day--ok'))) out.push(`${tag} ${where}: no confirmed cell, so the ✓ mark was not seen`);
          };
          const sizeOf = (where, sel, root, w, h) => {
            const bs = [...root.querySelectorAll(sel)].filter(shown);
            if (!bs.length) { out.push(`${tag} ${where}: no ${sel} drawn`); return; }
            bs.forEach(b => { const r = b.getBoundingClientRect(); if (Math.abs(r.width - w) > 0.5 || Math.abs(r.height - h) > 0.5) out.push(`${tag} ${where}: "${(b.getAttribute('aria-label') || b.textContent).trim().slice(0, 30)}" is ${Math.round(r.width)}×${Math.round(r.height)}, want ${w}×${h}`); });
          };
          const fillOf = (token) => { const p = document.createElement('i'); p.style.background = `var(${token})`; document.body.appendChild(p); const v = getComputedStyle(p).backgroundColor; p.remove(); return v; };
          // The classes this stage retired from the portal, Grown-ups and the request sheet.
          const OLD = ['.gu-yes', '.gu-talk', '.gu-no', '.gu-undo', '.gu-tab', '.gu-opt', '.gu-step', '.gu-pair', '.gu-x', '.mny-step', '.rq-opt', '.pn-day', '.pn-days', '.review-day-row'];
          const fullWidth = (btn) => { const p = btn.parentElement, cs = getComputedStyle(p); return Math.abs(btn.getBoundingClientRect().width - (p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))) <= 1.5; };
          const confirmBefore = state.shared.parentDayConfirm;
          const fx = document.createElement('div');
          try {
          profile = 'parent'; parentUnlockedThisSession = true; parentViewing = 'jenn';
          ctPrepareRead();
          state.shared.parentDayConfirm = JSON.parse(JSON.stringify(confirmBefore || {}));
          ['jenn', 'jess'].forEach(k => { (state.shared.parentDayConfirm[k] = state.shared.parentDayConfirm[k] || {})[mmDayKey(0)] = true; });
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
          measure('Now', document.getElementById('pnWrap'), '.ui-days > button');
          daysCheck('Now', document.querySelector('#pnWrap .pn-sun .ui-days'), /^[A-Za-z]{3} \d+(, today)?, (confirmed|not confirmed yet)$/);
          const nowKids = [...document.querySelectorAll('#screen-parent .ui-kids')].filter(shown);
          if (nowKids.length !== 1) out.push(`${tag} Now: ${nowKids.length} girl switches on show, want one .ui-kids`);
          const runBtn = document.querySelector('#pnWrap .pn-sun [data-pn-action="meeting"]');
          if (!runBtn || !runBtn.classList.contains('ui-btn--block') || !fullWidth(runBtn)) out.push(`${tag} Now: Run family meeting is not the full-width kit button`);
          // Her rating shows only on a day with training: give Jenn's today one, put back after.
          const tk = todayKey(), heldBlocks = JSON.stringify(getDayBlocks(tk, 'jenn') || []);
          if (!ckTrainingBlockOn('jenn', tk)) setDayBlocks(tk, [...JSON.parse(heldBlocks), { id: 'kit44-tr', actId: 'training', tag: 'skating', startMin: 6 * 60, durationMin: 30 }], 'jenn');
          try {
            pnOpenToldSheet(); await wait(350);
            measure('Now › She told me', document.getElementById('pnToldBody'), '.pn-answer-kids > button');
            const kidCells = [...document.querySelectorAll('#pnToldBody .pn-answer-kids > button')];
            if (kidCells.length !== 2 || Math.abs(kidCells[1].getBoundingClientRect().left - kidCells[0].getBoundingClientRect().right) > 0.6) out.push(`${tag} Now › She told me: the girl switch cells are not joined (no gap)`);
            daysCheck('Now › She told me', document.querySelector('#pnToldBody .ui-days'), /^[A-Za-z]{3} \d+/, false);
            const doneBtn = document.querySelector('#pnToldBody [data-pn-action="told-close"]');
            if (!doneBtn || !doneBtn.classList.contains('ui-btn--block')) out.push(`${tag} Now › She told me: Done is not the full-width kit button`);
            // Each girl, every day she can be answered for, until her rating and a learning stepper have been drawn.
            let rated = false, stepped = false;
            const days = () => [...document.querySelectorAll('#pnToldBody .ui-days > button:not(:disabled)')];
            for (const kid of ['jenn', 'jess']) {
              document.querySelector(`#pnToldBody [data-pn-action="answer-kid"][data-kid="${kid}"]`).click(); await wait(60);
              for (let i = 0; i < days().length && !(rated && stepped); i++) {
                days()[i].click(); await wait(60);
                const body = document.getElementById('pnToldBody');
                rated = rated || !!body.querySelector('.pn-rates > .pn-rate.ui-chip');
                stepped = stepped || !!body.querySelector('.pn-learn .ui-stepper > button');
                measure('Now › She told me', body, '.ui-days > button');
              }
            }
            if (!rated) out.push(`${tag} Now › She told me: no day drew her rating's chips, so none was measured`);
            if (!stepped) out.push(`${tag} Now › She told me: no day drew a learning stepper, so none was measured`);
            pnSheetOpen = false; closeSheet('pnToldOverlay'); await wait(50);
          } finally { setDayBlocks(tk, JSON.parse(heldBlocks), 'jenn'); }
          setParentDest('meeting'); await wait(60);
          measure('Meeting', document.getElementById('ptab-review'), '.ui-days > button');
          daysCheck('Meeting', document.querySelector('#meetingHub .ui-days'), /^[A-Za-z]{3} \d+, (confirmed|not confirmed yet)(, today)?, Jenn \d+%, Jess \d+%$/);
          [...document.querySelectorAll('#meetingHub .ui-days > button')].forEach((c, i) => { if (!/^[A-Za-z]{3}\s*\d{1,2}$/.test(c.textContent.trim())) out.push(`${tag} Meeting: day cell ${i + 1} shows "${c.textContent.trim()}", want only the day and date`); });
          const hubStatus = document.querySelector('#meetingHub .hub-status');
          if (!hubStatus || (hubStatus.textContent.match(/🐥\d+%/g) || []).length !== 7 || (hubStatus.textContent.match(/🦊\d+%/g) || []).length !== 7) out.push(`${tag} Meeting: the status line does not carry the seven days' 🐥 and 🦊 figures`);
          const hubBtn = document.querySelector('#meetingHub .hub-cta .ui-btn--block');
          if (!hubBtn || !fullWidth(hubBtn)) out.push(`${tag} Meeting: Run family meeting is not the full-width kit button`);
          setParentDest('history'); await wait(60);
          measure('History', document.getElementById('ptab-history-wrap'), '[data-parent-history].ui-chip');
          setParentTab('analysis'); await wait(60);
          measure('History › Analysis', document.getElementById('ptab-analysis'), '.perf-table > .ui-btn');
          // ▶ on the last (this) week is the kit's disabled button.
          const next = document.querySelector('#perfDetail .perf-detail-nav [aria-label="Next week"]');
          if (!next || !next.disabled) out.push(`${tag} Analysis: ▶ on the last week is not disabled`);
          else { const cs = getComputedStyle(next); if (cs.opacity !== '0.45' || cs.boxShadow !== 'none') out.push(`${tag} Analysis: the disabled ▶ is opacity ${cs.opacity}, shadow ${cs.boxShadow}, want the kit's 0.45 and none`); }
          parentMenuToggle(true);
          measure('the 🔒 menu', document.getElementById('parentMenu'), '#parentLookBtn');
          parentMenuToggle(false);
          // Grown-ups (a parent's sizes): the card's buttons, tabs and chips, and the − / + at 44px.
          fx.id = 'kit51-fx'; fx.className = 'gu'; fx.style.cssText = `position:absolute;left:0;top:0;width:${Math.min(innerWidth, 640)}px;opacity:0;pointer-events:none`;
          const q = { kid: 'jenn', id: 'kit51-fx', kind: 'comp', text: 'Fixture', icon: '🏆', record: { sport: 'swim', dayKey: todayKey(), races: [{ ev: '50 Free', time: '', pts: 6 }] } };
          fx.innerHTML = guApproveCard(q) + guApproveCard(Object.assign({}, q, { status: 'yes' })) + guRender('commit') + guRender('rules');
          document.body.appendChild(fx);
          const yes = fx.querySelector('[data-mnyp-action="guyes"]');
          if (!yes || !yes.matches('.ui-btn.ui-btn--ok')) out.push(`${tag} Grown-ups: the yes button is not a kit ok button`);
          else if (getComputedStyle(yes).backgroundColor !== fillOf('--status-done')) out.push(`${tag} Grown-ups: the ok button fill is ${getComputedStyle(yes).backgroundColor}, not --status-done`);
          ['gutalk', 'guno', 'guundo'].forEach(a => { const b = fx.querySelector(`[data-mnyp-action="${a}"]`); if (!b || !b.matches('.ui-btn.ui-btn--secondary') || b.matches('.ui-btn--danger')) out.push(`${tag} Grown-ups: ${a} is not a kit secondary button`); });
          const gsave = fx.querySelector('[data-mnyp-action="gurulesave"]');
          if (!gsave || !gsave.matches('.ui-btn.ui-btn--secondary')) out.push(`${tag} Grown-ups: Save is not a kit secondary button`);
          measure('Grown-ups', fx, '.gu-answer > .ui-btn--ok');
          sizeOf('Grown-ups stepper (a parent: 44)', '.ui-stepper > button', fx, 44, 44);
          if (fx.querySelector('.ui-stepper--kid')) out.push(`${tag} Grown-ups: a stepper only a parent uses is the 52px girl size`);
          const tabs51 = [...fx.querySelectorAll('.gu-tabs > .ui-chip')];
          if (tabs51.length < 10 || tabs51.length % 2) out.push(`${tag} Grown-ups: ${tabs51.length} tab chips over the two renders`);
          if (!tabs51.some(t => t.getAttribute('aria-pressed') === 'true')) out.push(`${tag} Grown-ups: no tab chip is pressed`);
          if (!fx.querySelector('.gu-opts > .ui-chip')) out.push(`${tag} Grown-ups: no amount or reason chip drawn`);
          const leftFx = fx.querySelectorAll(OLD.join(', '));
          if (leftFx.length) out.push(`${tag} Grown-ups: ${leftFx.length} element(s) still wear a retired class (${OLD.join(' ')})`);
          fx.remove();
          // The request sheet is the girl's: its − / + are the 52px kit stepper, its ✕ the kit icon button.
          for (const kind of ['adv', 'gift', 'goal']) {
            mnyOpenRequestSheet(kind, { kid: 'jess' }); await wait(120);
            const body = document.getElementById('requestBody');
            measure(`Request sheet (${kind})`, body, '.ui-stepper--kid > button');
            sizeOf(`Request sheet (${kind}) stepper (the girl: 52)`, '.ui-stepper > button', body, 52, 52);
            const x = body.querySelector('.rq-x');
            if (!x || !x.matches('.ui-btn.ui-btn--icon')) out.push(`${tag} Request sheet (${kind}): the ✕ is not the kit icon button`);
            const leftRq = body.querySelectorAll(OLD.join(', '));
            if (leftRq.length) out.push(`${tag} Request sheet (${kind}): ${leftRq.length} element(s) still wear a retired class`);
            rqClose(); await wait(40);
          }
          const leftPortal = document.querySelectorAll(OLD.map(c => `#screen-parent ${c}`).join(', '));
          if (leftPortal.length) out.push(`${tag} the portal: ${leftPortal.length} element(s) still wear a retired class (${OLD.join(' ')})`);
          return out;
          } finally { fx.remove(); state.shared.parentDayConfirm = confirmBefore; }
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
