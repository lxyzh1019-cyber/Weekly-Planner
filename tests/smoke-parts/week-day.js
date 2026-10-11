// Smoke group: Week and Day (PR 8, Stage 36). Week and Day draw their buttons and chips from the component kit (.ui-btn, .ui-chip, css/app.css); this group checks they keep the kit's 44px on both screens. tests/smoke.js calls it at its place in the run, on its one shared page; it seeds what it measures and puts it back.
module.exports = async ({ page, want, checks }) => {
  /* Every kit button and chip on the Full week and on the Day view, at the
     iPad and the phone size: at least 44 x 44, and the tap at its centre lands
     on it. The Day is seeded with a block long enough to carry its ✓ and with
     a stopwatch, so the tick (.ui-btn--icon) and ⏱ Start stopwatch
     (.ui-btn--secondary) are both drawn; the Week always draws its Sign this
     week / Unsign button. The Week's offered school days (.ui-chip, "Add all")
     and the Sunday review (🎉 See wins, ✕) are measured on the days they show. */
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
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            if (!hit || !(hit === el || el.contains(hit))) out.push(`${size} ${name}: the tap at its centre lands on ${hit ? (hit.id || String(hit.className) || hit.tagName).slice(0, 40) : 'nothing'}`);
          });
        };
        try {
          profile = 'jenn'; parentViewing = 'jenn'; weekOffset = 0;
          setDayBlocks(k, saved.concat([{ id: 'kit44-day', actId: 'reading', startMin: 13 * 60, durationMin: 120,
            stopwatch: { enabled: true, running: false, elapsedSec: 0 } }]), 'jenn');
          goWeek(); setWeekView('full');
          measure('screen-week', 'Week', [['.ui-btn', 'Sign this week / Unsign button']]);
          const keys = getDayKeys(0);
          openDay(k, keys.indexOf(k));
          measure('screen-day', 'Day', [['.ui-btn--icon', '✓ tick'], ['.ui-btn--secondary', '⏱ Start stopwatch']]);
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
