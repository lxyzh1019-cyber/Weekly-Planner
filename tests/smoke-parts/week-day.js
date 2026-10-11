// Smoke group: Week and Day (PR 8, Stage 36). Week and Day draw their buttons and chips from the component kit (.ui-btn, .ui-chip, css/app.css); this group checks they keep the kit's 44px on both screens. tests/smoke.js calls it at its place in the run, on its one shared page; it seeds what it measures and puts it back.
module.exports = async ({ page, want, checks }) => {
  /* Every kit button and chip on the Full week and on the Day view, at the
     iPad and the phone size: at least 44 x 44, and the tap at its centre lands
     on it. Today's Day is seeded with four of Jenn's blocks: a two-hour one
     with its stopwatch on (so the ✓ tick, .ui-btn--icon, and ⏱ Start
     stopwatch, .ui-btn--secondary, are both drawn), a 30-minute one with its
     stopwatch on (40px, a compact block: neither button may show), a
     35-minute one (47px, the shortest block that is not compact) and a
     45-minute one. A kit button on a block must lie inside the block's clip
     (inside its border: .placed-block clips with overflow:hidden), or part of
     it is cut off. The Week draws its Sign this week / Unsign button.
     Then the same Day is seeded with a clash (a School Day whose travel and
     get-ready run 20 minutes into Homework) and the overrun hatch drawn over
     Homework (.wf-overrun.tl-overrun) must stack above the block. */
  if (want('kitButtonsHold44pxOnWeekAndDay')) {
    const before = page.viewportSize();
    const problems = [];
    for (const [w, h, size] of [[1194, 834, 'iPad'], [390, 844, 'phone']]) {
      await page.setViewportSize({ width: w, height: h });
      problems.push(...await page.evaluate(([size]) => {
        const out = [];
        const wasProfile = profile, wasViewing = parentViewing, wasOffset = weekOffset, wasView = weekView;
        const k = todayKey();
        const saved = getDayBlocks(k, 'jenn').slice();
        const sw = () => ({ enabled: true, running: false, elapsedSec: 0 });
        const measure = (screenId, where, need) => {
          const screen = document.getElementById(screenId);
          if (!screen || !screen.classList.contains('active')) { out.push(`${size} ${where}: #${screenId} is not on show`); return; }
          const found = [...screen.querySelectorAll('.ui-btn, .ui-chip')].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
          need.forEach(([sel, what]) => {
            if (!found.some(el => el.matches(sel))) out.push(`${size} ${where}: no ${what} (${sel}) drawn`);
          });
          found.forEach(el => {
            el.scrollIntoView({ block: 'center', inline: 'center' });
            const r = el.getBoundingClientRect();
            const name = `${where} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 30)}" (.${[...el.classList].join('.')})`;
            if (r.width < 43.5 || r.height < 43.5) out.push(`${size} ${name} is ${Math.round(r.width)}x${Math.round(r.height)}, under 44px`);
            const blk = el.closest('.placed-block');
            if (blk) {
              const b = blk.getBoundingClientRect();
              const clip = { left: b.left + blk.clientLeft, top: b.top + blk.clientTop,
                right: b.left + blk.clientLeft + blk.clientWidth, bottom: b.top + blk.clientTop + blk.clientHeight };
              if (r.left < clip.left - 0.5 || r.top < clip.top - 0.5 || r.right > clip.right + 0.5 || r.bottom > clip.bottom + 0.5) {
                out.push(`${size} ${name} on the ${Math.round(b.height)}px block ${blk.id} runs outside the block's clip (button ${Math.round(r.top - clip.top)}..${Math.round(r.bottom - clip.top)}px down a ${Math.round(clip.bottom - clip.top)}px box)`);
              }
            }
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            if (!hit || !(hit === el || el.contains(hit))) out.push(`${size} ${name}: the tap at its centre lands on ${hit ? (hit.id || String(hit.className) || hit.tagName).slice(0, 40) : 'nothing'}`);
          });
        };
        try {
          profile = 'jenn'; parentViewing = 'jenn'; weekOffset = 0;
          setDayBlocks(k, saved.concat([
            { id: 'kit44-day', actId: 'reading', startMin: 13 * 60, durationMin: 120, stopwatch: sw() },
            { id: 'kit44-30m', actId: 'reading', startMin: 15 * 60 + 30, durationMin: 30, stopwatch: sw() },
            { id: 'kit44-35m', actId: 'reading', startMin: 16 * 60 + 30, durationMin: 35 },
            { id: 'kit44-45m', actId: 'reading', startMin: 17 * 60 + 30, durationMin: 45 },
          ]), 'jenn');
          goWeek(); setWeekView('full');
          measure('screen-week', 'Week', [['.ui-btn', 'Sign this week / Unsign button']]);
          const keys = getDayKeys(0);
          openDay(k, keys.indexOf(k));
          if (!document.getElementById('block-kit44-30m')) out.push(`${size} Day: the 30-minute block is not drawn`);
          else if (!document.getElementById('block-kit44-30m').classList.contains('compact')) out.push(`${size} Day: the 30-minute block is not compact`);
          measure('screen-day', 'Day', [['.ui-btn--icon', '✓ tick'], ['.ui-btn--secondary', '⏱ Start stopwatch']]);
          // The overrun hatch over a clashing block.
          setDayBlocks(k, [
            { id: 'kit44-school', actId: 'school_day', startMin: 8 * 60 + 10, durationMin: 400,
              travelBuffer: true, travelBufMin: 15, getReadyBuffer: true, getReadyBufMin: 15 },
            { id: 'kit44-home', actId: 'homework', startMin: 15 * 60, durationMin: 150 },
          ], 'jenn');
          openDay(k, keys.indexOf(k));
          const home = document.getElementById('block-kit44-home');
          const ov = home && home.parentElement.querySelector('.tl-overrun');
          if (!ov) out.push(`${size} Day: no overrun hatch drawn over the clashing Homework`);
          else {
            const zo = Number(getComputedStyle(ov).zIndex), zb = Number(getComputedStyle(home).zIndex);
            if (!(zo > zb)) out.push(`${size} Day: the overrun hatch's z-index ${getComputedStyle(ov).zIndex} is not above the block's ${getComputedStyle(home).zIndex}`);
          }
        } catch (e) {
          out.push(`${size}: threw ${e.message}`);
        } finally {
          setDayBlocks(k, saved, 'jenn');
          profile = wasProfile; parentViewing = wasViewing; weekOffset = wasOffset;
          if (weekView !== wasView) setWeekView(wasView);
          goToday();
        }
        return out;
      }, [size]));
    }
    await page.setViewportSize(before);
    checks.kitButtonsHold44pxOnWeekAndDay = problems.length ? problems : true;
  }
};
