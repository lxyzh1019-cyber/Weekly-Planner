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
          const inkOf = (token) => { const p = document.createElement('i'); p.style.color = `var(${token})`; document.body.appendChild(p); const v = getComputedStyle(p).color; p.remove(); return v; };
          const daysCheck = (where, row, named, needOk = true, toCome = 'future') => {
            const cells = row ? [...row.children] : [];
            if (cells.length !== 7) { out.push(`${tag} ${where}: ${cells.length} day cells, want 7`); return; }
            // Still to come (G2): the smoke date is Wed 2026-10-07, so Thu–Sun (cells 4–7) are dashed in the
            // lighter ink. Now and the hub keep them tappable (.ui-day--future, pointer); the sheet's are :disabled.
            const todayIdx = cells.findIndex(c => c.getAttribute('aria-current') === 'date');
            if (todayIdx === 2) {
              cells.forEach((c, i) => {
                const cs = getComputedStyle(c), come = i > todayIdx;
                if (come && cs.borderTopStyle !== 'dashed') out.push(`${tag} ${where}: to-come day cell ${i + 1} is drawn ${cs.borderTopStyle}, want dashed`);
                if (come && cs.color !== inkOf('--ink-light')) out.push(`${tag} ${where}: to-come day cell ${i + 1} is not in the lighter ink`);
                if (!come && cs.borderTopStyle === 'dashed') out.push(`${tag} ${where}: day cell ${i + 1} is dashed but is not still to come`);
                if (come && toCome === 'future' && (!c.classList.contains('ui-day--future') || c.disabled || cs.cursor !== 'pointer')) out.push(`${tag} ${where}: to-come day cell ${i + 1} must be .ui-day--future, tappable, pointer`);
                if (come && toCome === 'disabled' && !c.disabled) out.push(`${tag} ${where}: to-come day cell ${i + 1} should be disabled`);
                if (come && Number(cs.opacity) < 1) out.push(`${tag} ${where}: to-come day cell ${i + 1} has dropped opacity ${cs.opacity}`);
                if (c.getAttribute('aria-pressed') === 'true' && cs.backgroundColor !== fillOf('--sel', row)) out.push(`${tag} ${where}: chosen day cell ${i + 1} is not its area's picked colour`);
              });
            } else out.push(`${tag} ${where}: today is cell ${todayIdx + 1}, want 3 (Wed) on the smoke date, so to-come cells were not checked`);
            cells.forEach((c, i) => {
              const ok = c.classList.contains('ui-day--ok'), now = c.getAttribute('aria-current') === 'date';
              const want = (now ? '•' : '') + (now && ok ? ' ' : '') + (ok ? '✓' : '');
              if (markOf(c) !== want) out.push(`${tag} ${where}: day cell ${i + 1} mark is "${markOf(c)}", want "${want}"`);
              if (!(c.getAttribute('aria-label') || '').trim()) out.push(`${tag} ${where}: day cell ${i + 1} has no aria-label`);
              if (named && !named.test(c.getAttribute('aria-label') || '')) out.push(`${tag} ${where}: day cell ${i + 1} aria-label "${c.getAttribute('aria-label')}" lacks its state or %`);
            });
            if (!cells.some(c => c.getAttribute('aria-current') === 'date')) out.push(`${tag} ${where}: no cell is today`);
            /* C5: today's tile is no new fill: a plain today looks like a plain day. A plant (today drawn red-orange) must be caught. */
            const todayCell = cells.find(c => c.getAttribute('aria-current') === 'date' && !c.classList.contains('ui-day--ok') && c.getAttribute('aria-pressed') !== 'true');
            const plainCell = cells.find(c => !c.hasAttribute('aria-current') && !c.classList.contains('ui-day--ok') && !c.classList.contains('ui-day--future') && c.getAttribute('aria-pressed') !== 'true' && !c.disabled);
            if (todayCell && plainCell) {
              const todayFill = () => getComputedStyle(todayCell).backgroundColor === getComputedStyle(plainCell).backgroundColor;
              if (!todayFill()) out.push(`${tag} ${where}: today's cell is filled ${getComputedStyle(todayCell).backgroundColor}, not like a plain day`);
              const was = todayCell.style.background;
              todayCell.style.background = '#e8552d';
              if (todayFill()) out.push(`${tag} ${where}: the today-fill check missed its plant (today drawn red-orange)`);
              todayCell.style.background = was;
            }
            if (needOk && !cells.some(c => c.classList.contains('ui-day--ok'))) out.push(`${tag} ${where}: no confirmed cell, so the ✓ mark was not seen`);
          };
          const sizeOf = (where, sel, root, w, h) => {
            const bs = [...root.querySelectorAll(sel)].filter(shown);
            if (!bs.length) { out.push(`${tag} ${where}: no ${sel} drawn`); return; }
            bs.forEach(b => { const r = b.getBoundingClientRect(); if (Math.abs(r.width - w) > 0.5 || Math.abs(r.height - h) > 0.5) out.push(`${tag} ${where}: "${(b.getAttribute('aria-label') || b.textContent).trim().slice(0, 30)}" is ${Math.round(r.width)}×${Math.round(r.height)}, want ${w}×${h}`); });
          };
          const dayLabelRe = new RegExp(`^[A-Za-z]{3} \\d+, (confirmed|not confirmed yet)(, today)?, ${kidLabel('jenn').name} \\d+%, ${kidLabel('jess').name} \\d+%$`);
          const fillOf = (token, where) => { const p = document.createElement('i'); p.style.background = `var(${token})`; (where || document.body).appendChild(p); const v = getComputedStyle(p).backgroundColor; p.remove(); return v; };
          /* C5 (owner 2026-10-12): a day tile on Now and the Meeting hub shows its
             weekday, date, 🐥 %, 🦊 % and "Review ›" (or "Confirmed"). */
          const tileFaults = (c) => {
            const f = [], part = (cl) => { const e = c.querySelector('.' + cl); return e ? e.textContent.trim() : null; };
            if (!/^[A-Za-z]{3}$/.test(part('ui-day-dow') || '')) f.push(`shows no weekday (${part('ui-day-dow')})`);
            if (!/^\d{1,2}$/.test(part('ui-day-date') || '')) f.push(`shows no date (${part('ui-day-date')})`);
            const pcts = [...c.querySelectorAll('.ui-day-pct')].map(e => e.textContent.trim());
            if (pcts.length !== 2 || !/^🐥\d+%$/u.test(pcts[0]) || !/^🦊\d+%$/u.test(pcts[1])) f.push(`shows ${JSON.stringify(pcts)}, want 🐥 % and 🦊 %`);
            const st = part('ui-day-state'), stWant = c.classList.contains('ui-day--ok') ? 'Confirmed' : 'Review ›';
            if (st !== stWant) f.push(`says "${st}", want "${stWant}"`);
            return f;
          };
          const tilesCheck = (where, row) => {
            const cells = row ? [...row.children] : [];
            cells.forEach((c, i) => tileFaults(c).forEach(f => out.push(`${tag} ${where}: day tile ${i + 1} ${f}`)));
            cells.forEach((c, i) => { if (c.scrollWidth > c.clientWidth + 1) out.push(`${tag} ${where}: day tile ${i + 1}'s words overflow it (${c.scrollWidth} in ${c.clientWidth})`); });
            // The phone wraps the tiles (as before C5); every tile one width.
            const rects = cells.map(c => c.getBoundingClientRect());
            if (rects.some(r => Math.abs(r.width - rects[0].width) > 0.5)) out.push(`${tag} ${where}: the day tiles are ${rects.map(r => Math.round(r.width)).join('/')}px, want one width`);
            if (size === 'phone' && new Set(rects.map(r => Math.round(r.top))).size < 2) out.push(`${tag} ${where}: the day tiles do not wrap on a phone`);
            const plant = cells[0] && cells[0].cloneNode(true);
            if (plant) { plant.querySelectorAll('.ui-day-pct').forEach(e => e.remove()); if (!tileFaults(plant).length) out.push(`${tag} ${where}: the tile check missed its plant (a tile without its %)`); }
          };
          /* C4: the kid switch fills what its row leaves it, the girls in equal
             parts. C1/C8: in the parent area the chosen girl is navy with white. */
          const switchFaults = (kids) => {
            const f = [], row = kids.parentElement, rs = getComputedStyle(row), rr = row.getBoundingClientRect(), k = kids.getBoundingClientRect();
            const cells = [...kids.children].map(b => b.getBoundingClientRect().width);
            if (cells.some(w => Math.abs(w - cells[0]) > 0.5)) f.push(`has cells of ${cells.map(Math.round).join(' / ')}px, want equal`);
            const next = kids.nextElementSibling && kids.nextElementSibling.getBoundingClientRect();
            const end = next && Math.abs(next.top - k.top) < 1 ? next.left - (parseFloat(rs.columnGap) || 0) : rr.right - parseFloat(rs.paddingRight) - parseFloat(rs.borderRightWidth);
            if (Math.abs(k.right - end) > 1) f.push(`ends at ${Math.round(k.right)}px, its row leaves it to ${Math.round(end)}px`);
            const line = [...row.children].filter(e => e.getClientRects().length && Math.abs(e.getBoundingClientRect().top - k.top) < 1);
            const rowEnd = rr.right - parseFloat(rs.paddingRight) - parseFloat(rs.borderRightWidth), lineEnd = line.length ? line[line.length - 1].getBoundingClientRect().right : k.right;
            if (Math.abs(lineEnd - rowEnd) > 1) f.push(`leaves ${Math.round(rowEnd - lineEnd)}px of its row empty`);
            const on = kids.querySelector('[aria-pressed="true"]'), oc = on && getComputedStyle(on);
            if (on && (oc.backgroundColor !== 'rgb(28, 34, 64)' || oc.color !== 'rgb(255, 255, 255)')) f.push(`has the chosen girl in ${oc.backgroundColor} / ${oc.color}, want the parent's #1c2240 / #fff`);
            return f;
          };
          // The classes this stage retired from the portal, Grown-ups and the request sheet.
          const OLD = ['.gu-yes', '.gu-talk', '.gu-no', '.gu-undo', '.gu-tab', '.gu-opt', '.gu-step', '.gu-pair', '.gu-x', '.mny-step', '.rq-opt', '.pn-day', '.pn-days', '.review-day-row', '.hub-pct'];
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
          daysCheck('Now', document.querySelector('#pnWrap .pn-sun .ui-days'), dayLabelRe);
          tilesCheck('Now', document.querySelector('#pnWrap .pn-sun .ui-days'));
          const nowKids = [...document.querySelectorAll('#screen-parent .ui-kids')].filter(shown);
          if (nowKids.length !== 1) out.push(`${tag} Now: ${nowKids.length} girl switches on show, want one .ui-kids`);
          else {
            switchFaults(nowKids[0]).forEach(f => out.push(`${tag} Now: the girl switch ${f}`));
            const toggles = nowKids[0].parentElement, head = toggles.parentElement, hr = head.getBoundingClientRect();
            if (Math.abs(toggles.getBoundingClientRect().right - (hr.right - parseFloat(getComputedStyle(head).paddingRight))) > 1) out.push(`${tag} Now: the girl switch's toggles do not reach the end of their row`);
            nowKids[0].style.flex = 'none';
            if (!switchFaults(nowKids[0]).length) out.push(`${tag} Now: the switch width check missed its plant (a switch that does not grow)`);
            nowKids[0].style.flex = '';
            const onCell = nowKids[0].querySelector('[aria-pressed="true"]');
            if (onCell) {
              onCell.style.background = '#ffc83d';
              if (!switchFaults(nowKids[0]).some(f => /chosen girl/.test(f))) out.push(`${tag} Now: the girl switch colour check missed its plant (a yellow chosen girl)`);
              onCell.style.background = '';
            }
          }
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
            const toldKids = document.querySelector('#pnToldBody .pn-answer-kids');
            if (!toldKids) out.push(`${tag} Now › She told me: no body girl switch`);
            else {
              switchFaults(toldKids).forEach(f => out.push(`${tag} Now › She told me: the girl switch ${f}`));
              // C4 (R4): the body switch fills its row like Now's; a plant (shrink-to-fit) must fail.
              toldKids.style.display = 'inline-grid';
              if (!switchFaults(toldKids).length) out.push(`${tag} Now › She told me: the body switch width check missed its plant (a switch that does not grow)`);
              toldKids.style.display = '';
            }
            const chosenDay = document.querySelector('#pnToldBody .ui-days > [aria-pressed="true"]'), cd = chosenDay && getComputedStyle(chosenDay);
            if (!chosenDay) out.push(`${tag} Now › She told me: no chosen day`);
            else if (cd.backgroundColor !== 'rgb(28, 34, 64)' || cd.color !== 'rgb(255, 255, 255)') out.push(`${tag} Now › She told me: the chosen day is ${cd.backgroundColor} / ${cd.color}, want the parent's #1c2240 / #fff`);
            daysCheck('Now › She told me', document.querySelector('#pnToldBody .ui-days'), /^[A-Za-z]{3} \d+/, false, 'disabled');
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
          daysCheck('Meeting', document.querySelector('#meetingHub .ui-days'), dayLabelRe);
          tilesCheck('Meeting', document.querySelector('#meetingHub .ui-days'));
          // C5: the tiles carry the %, so the status line no longer lists them; a plant (the old list) must be caught.
          const pctList = (el) => (el.textContent.match(/(🐥|🦊)\d+%/gu) || []).length;
          const hubStatus = document.querySelector('#meetingHub .hub-status');
          if (!hubStatus) out.push(`${tag} Meeting: no status line`);
          else if (pctList(hubStatus)) out.push(`${tag} Meeting: the status line still lists ${pctList(hubStatus)} day figures`);
          if (hubStatus) {
            const wasLine = hubStatus.textContent;
            hubStatus.textContent = 'Mon 🐥40% 🦊20% · Tue 🐥0% 🦊0%';
            if (!pctList(hubStatus)) out.push(`${tag} Meeting: the status line check missed its plant (the old % list)`);
            hubStatus.textContent = wasLine;
          }
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
          else if (getComputedStyle(yes).backgroundColor !== 'rgb(47, 125, 85)') out.push(`${tag} Grown-ups: the ok button fill is ${getComputedStyle(yes).backgroundColor}, not C8's #2f7d55`);
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
