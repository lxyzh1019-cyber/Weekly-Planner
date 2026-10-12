// Smoke group: one sheet and one dialog (Stage 43, Part 12; owner answers G13 and P1–P4, 2026-10-12). oneSheetAndOneDialogEverywhere opens each of the 25 pop-ups (the 23 overlays in index.html, the ⋯ More sheet tdMoreOverlay, and the app dialog appDialogOverlay), at the iPad width 1024×768 and the phone width 390×844. A sheet is the kit's .ui-sheet with the same paper, border and corner as every other sheet, at layer --z-sheet (300); it is centred on the iPad and sits on the bottom edge, full width, on the phone, except the three forms (edit, activity, training: .ui-sheet--docked), which on the iPad are the right-side panel on the bottom right edge. Each sheet has exactly one ✕ (.ui-sheet-x), at least 44×44, in its top-right corner, and tapping it closes the sheet. The app dialog (a confirm and a choice) is the kit's .ui-dialog, centred at both widths, at layer --z-dialog (500), with no ✕; its Cancel closes it. tests/smoke.js calls it near the end of the run, on its one shared page; it puts back the profile and the size.
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
        let first = null;
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
            x.click();
            await tick();
            if (ov.classList.contains('open')) { out.push(`${where}: the ✕ did not close it`); closeSheet(id); }
          } else closeSheet(id);
        }
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
};
