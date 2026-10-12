// Smoke group: one sheet and one dialog (Stage 43, Part 12; owner answers G13 and P1–P4, 2026-10-12). oneSheetAndOneDialogEverywhere opens each of the 25 pop-ups (the 23 overlays in index.html, the ⋯ More sheet tdMoreOverlay, and the app dialog appDialogOverlay), at the iPad width 1024×768 and the phone width 390×844. A sheet is the kit's .ui-sheet with the same paper, border and corner as every other sheet, at layer --z-sheet (300); it is centred on the iPad and sits on the bottom edge, full width, on the phone, except the three forms (edit, activity, training: .ui-sheet--docked), which on the iPad are the right-side panel on the bottom right edge. Each sheet has exactly one ✕ (.ui-sheet-x), at least 44×44, in its top-right corner, and tapping it closes the sheet. The app dialog (a confirm and a choice) is the kit's .ui-dialog, centred at both widths, at layer --z-dialog (500), with no ✕; its Cancel closes it. Stage 63 (owner P5, P6, 2026-10-12): the handle bar shows only on a phone sheet (390 wide), never on an iPad sheet, centred or docked; on a sheet made tall (a 1600px spacer) and scrolled to the bottom, the ✕ is still inside the visible sheet at its top right and a tap lands on it; the ✕ does not cover the title's words; a danger confirm's OK is .ui-btn--danger, a plain one's .ui-btn--primary, both .act-guard. tests/smoke.js calls it near the end of the run, on its one shared page; it puts back the profile and the size.
module.exports = async ({ page, want, checks }) => {
  if (!want('oneSheetAndOneDialogEverywhere')) return;
  const before = page.viewportSize();
  const bad = [];
  try {
    for (const [w, h, size] of [[1024, 768, 'iPad'], [390, 844, 'phone']]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(150);
      const found = await page.evaluate(async (size) => {
        const out = [];
        const tick = () => new Promise(r => setTimeout(r, 30));
        const settle = (el) => { if (el && el.getAnimations) el.getAnimations({ subtree: true }).forEach(a => { try { a.finish(); } catch (e) {} }); };
        const DOCKED = ['editOverlay', 'activityOverlay', 'trainingOverlay'];
        // Each pop-up's opener. A body built in code carries its ✕ (request, Sunday, She told me, More).
        const OPEN = {
          requestOverlay: () => { mnyOpenMyMoney('jenn'); mnyOpenRequestSheet('gift', { kid: 'jenn' }); },
          sundayOverlay: () => { sdSheetOpen('Test', '<p>A line</p>'); },
          pnToldOverlay: () => { pnOpenToldSheet(); },
          tdMoreOverlay: () => { goToday(); tdOpenMore(); },
        };
        const statics = [...document.querySelectorAll('.overlay[id]')].map(o => o.id).filter(id => id !== 'appDialogOverlay' && id !== 'tdMoreOverlay');
        if (statics.length !== 23) out.push(`${statics.length} overlays in index.html, expected 23`);
        const ids = statics.concat(['tdMoreOverlay']);
        const vw = window.innerWidth, vh = window.innerHeight;
        let first = null, handles = 0;
        for (const id of ids) {
          const where = `${id}@${size}`;
          profile = 'jenn'; parentViewing = 'jenn';
          try { (OPEN[id] || (() => openSheet(id)))(); } catch (e) { out.push(`${where}: opening threw ${e.message}`); continue; }
          const ov = document.getElementById(id);
          if (!ov || !ov.classList.contains('open')) { out.push(`${where}: did not open`); continue; }
          const sheet = ov.querySelector(':scope > .ui-sheet');
          if (!sheet) { out.push(`${where}: no .ui-sheet inside the overlay (classes: ${(ov.firstElementChild || {}).className})`); ov.classList.remove('open'); continue; }
          settle(ov); settle(sheet);
          const cs = getComputedStyle(sheet);
          const look = { paper: cs.backgroundColor, border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor, corner: cs.borderTopLeftRadius };
          if (!first) first = { id, look };
          else ['paper', 'border', 'corner'].forEach(k => { if (look[k] !== first.look[k]) out.push(`${where}: ${k} is ${look[k]}, ${first.id} has ${first.look[k]} — two sheet looks`); });
          const z = getComputedStyle(ov).zIndex;
          if (z !== '300') out.push(`${where}: the overlay's layer is ${z}, not --z-sheet 300`);
          const r = sheet.getBoundingClientRect();
          const docked = DOCKED.includes(id) && size === 'iPad';
          if (size === 'phone') {
            if (Math.abs(r.bottom - vh) > 1 || r.left > 1 || Math.abs(r.right - vw) > 1) out.push(`${where}: not a bottom sheet (left ${Math.round(r.left)}, right ${Math.round(r.right)}, bottom ${Math.round(r.bottom)} of ${vw}×${vh})`);
          } else if (docked) {
            if (Math.abs(r.bottom - vh) > 1 || Math.abs(r.right - vw) > 1 || r.left < vw * 0.2) out.push(`${where}: not the right-side panel (left ${Math.round(r.left)}, right ${Math.round(r.right)}, bottom ${Math.round(r.bottom)})`);
          } else {
            const dx = (r.left + r.right) / 2 - vw / 2, dy = (r.top + r.bottom) / 2 - vh / 2;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) out.push(`${where}: not centred (off by ${Math.round(dx)}, ${Math.round(dy)}; box ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)})`);
          }
          // P5 (owner 2026-10-12): the handle bar shows only on a phone sheet that comes from the bottom, never on a centred or docked iPad sheet.
          for (const h of sheet.querySelectorAll('.sheet-handle')) {
            const shown = getComputedStyle(h).display !== 'none' && h.getBoundingClientRect().height > 0;
            if (size === 'phone') handles++;
            if (size === 'phone' && !shown) out.push(`${where}: no handle bar on a phone sheet`);
            if (size === 'iPad' && shown) out.push(`${where}: a handle bar on an iPad sheet (${docked ? 'docked' : 'centred'})`);
          }
          const xs = [...sheet.querySelectorAll('.ui-sheet-x')];
          const glyphs = [...sheet.querySelectorAll('button')].filter(b => /^[×✕✖]$/.test(b.textContent.trim()));
          if (xs.length !== 1) out.push(`${where}: ${xs.length} kit ✕ (.ui-sheet-x), want 1`);
          if (glyphs.length !== 1) out.push(`${where}: ${glyphs.length} ✕ buttons, want 1`);
          const x = xs[0];
          if (x) {
            const b = x.getBoundingClientRect();
            if (b.width < 44 - 0.5 || b.height < 44 - 0.5) out.push(`${where}: the ✕ is ${Math.round(b.width)}×${Math.round(b.height)}, under 44×44`);
            if (b.right < r.right - 24 || b.top > r.top + 24) out.push(`${where}: the ✕ is not top right (✕ ${Math.round(b.right)},${Math.round(b.top)}; sheet ${Math.round(r.right)},${Math.round(r.top)})`);
            const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
            if (!hit || !x.contains(hit)) out.push(`${where}: a tap on the ✕ lands on ${hit ? hit.tagName + '.' + hit.className : 'nothing'}`);
            // P6 (owner 2026-10-12): the ✕ stays in view at the top right while a tall sheet scrolls. A spacer makes this sheet tall; at the bottom of the scroll the ✕ is still inside the visible sheet box, near its top right, and a tap on it lands on it.
            const spacer = document.createElement('div');
            spacer.style.height = '1600px';
            x.parentNode.insertBefore(spacer, x);
            sheet.scrollTop = sheet.scrollHeight;
            await tick();
            const sr = sheet.getBoundingClientRect(), b2 = x.getBoundingClientRect();
            if (sheet.scrollTop < 100) out.push(`${where}: the tall sheet did not scroll (scrollTop ${Math.round(sheet.scrollTop)})`);
            else if (b2.top < sr.top - 0.5 || b2.bottom > sr.bottom + 0.5 || b2.top > sr.top + 24 || b2.right < sr.right - 24) out.push(`${where}: after scrolling to the bottom the ✕ left the visible sheet (✕ ${Math.round(b2.right)},${Math.round(b2.top)}–${Math.round(b2.bottom)}; sheet ${Math.round(sr.right)},${Math.round(sr.top)}–${Math.round(sr.bottom)})`);
            else {
              const hit2 = document.elementFromPoint(b2.left + b2.width / 2, b2.top + b2.height / 2);
              if (!hit2 || !x.contains(hit2)) out.push(`${where}: after scrolling a tap on the ✕ lands on ${hit2 ? hit2.tagName + '.' + hit2.className : 'nothing'}`);
            }
            sheet.scrollTop = 0;
            spacer.remove();
            await tick();
            // The ✕ never covers the title's words.
            const h3 = sheet.querySelector(':scope > h3');
            if (h3) {
              const rg = document.createRange();
              rg.selectNodeContents(h3);
              const tr = rg.getBoundingClientRect(), b3 = x.getBoundingClientRect();
              if (tr.width && tr.right > b3.left + 0.5 && tr.bottom > b3.top && tr.top < b3.bottom) out.push(`${where}: the ✕ covers the title text (title right ${Math.round(tr.right)}, ✕ left ${Math.round(b3.left)})`);
            }
            x.click();
            await tick();
            if (ov.classList.contains('open')) { out.push(`${where}: the ✕ did not close it`); closeSheet(id); }
          } else closeSheet(id);
        }
        if (size === 'phone' && !handles) out.push('no sheet has a handle bar on the phone');
        // The app dialog: a confirm and a choice.
        for (const [kind, open] of [['confirm', () => showConfirm('Sure?')], ['choice', () => showChoice('How did it go?', [{ id: 'a', label: 'Fine' }, { id: 'b', label: 'Not fine' }])]]) {
          const where = `appDialog ${kind}@${size}`;
          const p = open();
          await tick();
          const ov = document.getElementById('appDialogOverlay');
          const dlg = ov && ov.querySelector(':scope > .ui-dialog');
          if (!dlg) { out.push(`${where}: no .ui-dialog`); _closeAppDialog(null); await p; continue; }
          settle(ov); settle(dlg);
          if (ov.querySelector('.ui-sheet')) out.push(`${where}: the dialog is also a .ui-sheet`);
          const z = getComputedStyle(ov).zIndex;
          if (z !== '500') out.push(`${where}: the dialog's layer is ${z}, not --z-dialog 500`);
          const cs = getComputedStyle(dlg);
          if (first && cs.backgroundColor !== first.look.paper) out.push(`${where}: paper ${cs.backgroundColor}, the sheets have ${first.look.paper}`);
          const r = dlg.getBoundingClientRect();
          const dx = (r.left + r.right) / 2 - vw / 2, dy = (r.top + r.bottom) / 2 - vh / 2;
          if (Math.abs(dx) > 2 || Math.abs(dy) > 2) out.push(`${where}: not centred (off by ${Math.round(dx)}, ${Math.round(dy)})`);
          if (dlg.querySelector('.ui-sheet-x') || [...dlg.querySelectorAll('button')].some(b => /^[×✕✖]$/.test(b.textContent.trim()))) out.push(`${where}: the dialog has a ✕; Cancel is its only way out`);
          const cancel = dlg.querySelector('.app-dialog-cancel');
          if (!cancel) { out.push(`${where}: no Cancel`); _closeAppDialog(null); }
          else cancel.click();
          await p;
          if (ov.classList.contains('open')) out.push(`${where}: Cancel did not close it`);
        }
        // Stage 63: a danger confirm's OK is the kit's danger button (C8), a plain one's the primary; both stay under the double-tap guard (act-guard), which no longer keys on every .ui-btn--primary.
        for (const danger of [false, true]) {
          const p = showConfirm('Sure?', danger ? { danger: true } : {});
          await tick();
          const ok = document.getElementById('appDialogOkBtn');
          const want = danger ? 'ui-btn--danger' : 'ui-btn--primary';
          if (!ok || !ok.classList.contains(want) || !ok.classList.contains('act-guard')) out.push(`appDialog ${danger ? 'danger' : 'plain'} confirm@${size}: the OK is ${ok ? ok.className : 'missing'}, want .${want}.act-guard`);
          _closeAppDialog(null);
          await p;
        }
        profile = 'jenn'; parentViewing = 'jenn'; goToday();
        return out;
      }, size);
      bad.push(...found);
    }
  } catch (e) {
    bad.push('the check threw: ' + e.message);
  } finally {
    if (before) await page.setViewportSize(before);
    await page.waitForTimeout(100);
  }
  checks.oneSheetAndOneDialogEverywhere = bad.length === 0 || bad;
  await theRedOkIsOnlyForWhatCannotBeUndone({ page, want, checks });
};

/* Part 13 (owner P7–P9, 2026-10-12): the red (danger) OK only on a confirm
   that cannot be undone. The 14 confirms that carried it, each read from the
   loaded function's own source with the variant it must have: 'danger', 'main'
   (no danger option, or danger: false) or 'lost' (red only when planned blocks
   are lost). The two 'lost' ones are also driven: red, and the question names
   the real count, when planned blocks go; the main button when none do. */
async function theRedOkIsOnlyForWhatCannotBeUndone({ page, want, checks }) {
  if (!want('theRedOkIsOnlyForWhatCannotBeUndone')) return;
  let bad = [];
  try {
    bad = await page.evaluate(async () => {
      const out = [];
      const tick = () => new Promise(r => setTimeout(r, 30));
      const LIST = [
        ['ctClearWeek', 'Reset', 'danger'],                     // js/13 Reset week
        ['clearDay', 'Start over', 'danger'],                   // js/09 Start day over
        ['buildGoalRow', 'Remove', 'danger'],                   // js/12 Remove goal
        ['deleteParentActivity', 'Take it off', 'danger'],      // js/11 future blocks removed
        ['resetBuiltInRoutine', 'Reset', 'danger'],             // js/11 Reset routine
        ['deleteRoutine', 'Delete', 'danger'],                  // js/11 Delete routine
        ['bkHandleImportFile', 'Replace everything', 'danger'], // js/30 backup replace (showCheckConfirm)
        ['pcwApply', 'Replace them', 'danger'],                 // js/34 Replace blocks
        ['ctPromptBoxItem', 'Box it anyway', 'main'],           // js/13
        ['rejectKidTask', 'Take it off', 'main'],               // js/11 exercise off the list
        ['rejectKidActivity', 'Take it off', 'main'],           // js/11 child-added activity off the list
        ['coRetire', 'Retire', 'main'],                         // js/29 Retire chore
        ['applySeriesUntil', 'Update it', 'lost'],              // js/09 a repeat cut short
        ['confirmCopyDay', 'Copy it', 'lost'],                  // js/09 copy over planned blocks
      ];
      for (const [fn, label, variant] of LIST) {
        const f = window[fn];
        if (typeof f !== 'function') { out.push(`${fn}: not loaded`); continue; }
        const src = f.toString().replace(/\s+/g, ' ');
        const at = src.search(new RegExp(`okLabel: ?'${label}'`));
        if (at < 0) { out.push(`${fn}: no confirm with OK "${label}"`); continue; }
        const open = src.lastIndexOf('{', at), close = src.indexOf('}', at);
        const opts = src.slice(open, close + 1);
        const d = ((opts.match(/danger: ?([^,}]+)/) || [])[1] || '').trim();
        const got = !d || d === 'false' ? 'main' : d === 'true' ? 'danger' : /^(lose|lost) > 0$/.test(d) ? 'lost' : 'other: ' + d;
        if (got !== variant) out.push(`${fn} "${label}": OK is ${got}, want ${variant}`);
      }
      const okOf = async (run) => {
        const p = run();
        await tick();
        const ok = document.getElementById('appDialogOkBtn');
        const msg = (document.getElementById('appDialogMsg') || {}).textContent || '';
        const cls = ok ? ok.className : '';
        const cancel = document.querySelector('#appDialogOverlay .app-dialog-cancel');
        if (cancel) cancel.click(); else _closeAppDialog(false);
        await p;
        return { red: /ui-btn--danger/.test(cls), main: /ui-btn--primary/.test(cls), msg };
      };
      const wasProfile = profile, wasViewing = parentViewing;
      const wk = getDayKeys(0);
      const keep = wk.map(k => [k, getDayBlocksForProfile(k, 'jenn')]);
      const inp = document.getElementById('seriesUntilInput');
      const wasVal = inp ? inp.value : '';
      try {
        profile = 'jenn'; parentViewing = 'jenn';
        const [dst, src, empty] = [wk[1], wk[3], wk[5]];
        // Copy a day: two planned blocks on the target are replaced → red, "2 planned blocks will be replaced".
        setDayBlocks(dst, [{ id: 'ro-a', actId: 'breakfast', startMin: 480, durationMin: 30 },
                           { id: 'ro-b', actId: 'dinner', startMin: 1080, durationMin: 30 }], 'jenn');
        setDayBlocks(src, [{ id: 'ro-c', actId: 'dinner', startMin: 1050, durationMin: 60 }], 'jenn');
        setDayBlocks(empty, [], 'jenn');
        copyDaySrcWeek = 0; copyDayDstKid = 'jenn';
        openDay(dst, 1);
        let r = await okOf(() => confirmCopyDay(src, 'Thursday'));
        if (!r.red || !/2 planned blocks will be replaced/.test(r.msg)) out.push(`copy over 2 planned blocks: red ${r.red}, question "${r.msg.slice(0, 120)}"`);
        // Onto an empty day nothing is lost → the main button, no count.
        openDay(empty, 1);
        r = await okOf(() => confirmCopyDay(src, 'Thursday'));
        if (!r.main || /will be replaced/.test(r.msg)) out.push(`copy onto an empty day: main ${r.main}, question "${r.msg.slice(0, 120)}"`);
        // A repeat cut short: its later, untouched blocks go → red with the count; made longer → main.
        if (!inp) out.push('no seriesUntilInput on the page');
        else {
          const series = { seriesId: 'ro-s', seriesDays: [0, 1, 2, 3, 4, 5, 6], seriesEvery: 1, seriesStart: wk[0], seriesEnd: wk[6] };
          wk.forEach((k, i) => setDayBlocks(k, [Object.assign({ id: 'ro-s' + i, actId: 'reading', startMin: 1200, durationMin: 30 }, series)], 'jenn'));
          openDay(wk[0], 1);
          currentDayKey = wk[0]; editingBlockId = 'ro-s0';
          inp.value = wk[3];
          r = await okOf(() => applySeriesUntil());
          if (!r.red || !/3 planned blocks will be removed/.test(r.msg)) out.push(`a repeat cut to ${wk[3]}: red ${r.red}, question "${r.msg.slice(0, 160)}"`);
          inp.value = getDayKeys(1)[6];
          r = await okOf(() => applySeriesUntil());
          if (!r.main || /will be removed/.test(r.msg)) out.push(`a repeat made longer: main ${r.main}, question "${r.msg.slice(0, 160)}"`);
        }
      } finally {
        keep.forEach(([k, b]) => setDayBlocks(k, b || [], 'jenn'));
        if (inp) inp.value = wasVal;
        profile = wasProfile; parentViewing = wasViewing;
        goToday();
      }
      return out;
    });
  } catch (e) {
    bad = ['the check threw: ' + e.message];
  }
  checks.theRedOkIsOnlyForWhatCannotBeUndone = bad.length === 0 || bad;
}
