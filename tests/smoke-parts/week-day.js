// Smoke group: Week and Day (PR 8, Stage 36). Week and Day draw their buttons and chips from the component kit (.ui-btn, .ui-chip, css/app.css); this group checks they keep the kit's 44px on both screens. tests/smoke.js calls it at its place in the run, on its one shared page; it seeds what it measures and puts it back.
module.exports = async ({ page, want, checks }) => {
  /* Every kit button and chip on the Full week and on the Day view, at the
     iPad and the phone size: at least 44 x 44, and the tap at its centre lands
     on it. Today's Day is seeded with seven of Jenn's blocks, every one with
     its stopwatch on: a two-hour one with goals, a 30-minute one (40px, a
     compact block), a 34-minute one (45.6px, compact), a 35-minute one (47px,
     the shortest block that is not compact, whose 2px border leaves a 43px
     clip), a 36-minute one (48.4px, the shortest block whose clip holds 44px),
     a 45-minute one and a 60-minute one with goals. A block whose clip holds
     44px draws the ✓ and the icon-only ⏱ (.ui-btn--icon, aria-label "Start
     stopwatch", owner answer 2026-10-11) side by side in one head row at its
     top-right, and its name and duration lines end before them; a block whose
     clip is under 44px draws neither. No block carries a worded stopwatch
     button (a planted one must be caught). A kit button on a block must lie
     inside the block's clip (inside its border: .placed-block clips with
     overflow:hidden), or part of it is cut off. The Week draws its Sign this
     week / Unsign button.
     A 47px block and a 40px compact one are each ticked done from their own
     sheet (tapped as a child taps them; owner answer Q10, 2026-10-11).
     Across (owner answer Q11): a block alone, a clash pair and a clash
     triple, at one day on both sizes and three days on the iPad: the ⏱ only
     where the name keeps 60px beside both buttons, the ✓ only where it keeps
     60px beside the ✓, and the name line really keeps 60px; on the phone and
     the iPad's three days the pair draws the ✓ alone and the triple neither.
     Then the same Day is seeded with a clash (a School Day whose travel and
     get-ready run 20 minutes into Homework) and the overrun hatch drawn over
     Homework (.wf-overrun.tl-overrun) must stack above the block. */
  if (want('kitButtonsHold44pxOnWeekAndDay')) {
    const before = page.viewportSize();
    const problems = [];
    for (const [w, h, size] of [[1194, 834, 'iPad'], [390, 844, 'phone']]) {
      await page.setViewportSize({ width: w, height: h });
      problems.push(...await page.evaluate(async ([size]) => {
        const out = [];
        const snap = JSON.stringify(state);
        const wasSpan = localStorage.getItem(DAY_SPAN_LS_KEY);
        const wasProfile = profile, wasViewing = parentViewing, wasOffset = weekOffset, wasView = weekView;
        const k = todayKey();
        const saved = getDayBlocks(k, 'jenn').slice();
        const sw = () => ({ enabled: true, running: false, elapsedSec: 0 });
        const goals = ['Read one chapter', 'Write three new words', 'Tell Mum the story', 'Draw the best part', 'Pick the next book', 'Put the book back'];
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
            { id: 'kit44-day', actId: 'reading', startMin: 13 * 60, durationMin: 120, stopwatch: sw(), objectives: goals },
            { id: 'kit44-30m', actId: 'reading', startMin: 15 * 60 + 30, durationMin: 30, stopwatch: sw() },
            { id: 'kit44-35m', actId: 'reading', startMin: 16 * 60 + 30, durationMin: 35, stopwatch: sw() },
            { id: 'kit44-45m', actId: 'reading', startMin: 17 * 60 + 30, durationMin: 45, stopwatch: sw() },
            { id: 'kit44-60m', actId: 'reading', startMin: 18 * 60 + 30, durationMin: 60, stopwatch: sw(), objectives: goals },
            { id: 'kit44-34m', actId: 'reading', startMin: 19 * 60 + 45, durationMin: 34, stopwatch: sw() },
            { id: 'kit44-36m', actId: 'reading', startMin: 20 * 60 + 30, durationMin: 36, stopwatch: sw() },
          ]), 'jenn');
          goWeek(); setWeekView('full');
          measure('screen-week', 'Week', [['.ui-btn', 'Sign this week / Unsign button']]);
          const keys = getDayKeys(0);
          openDay(k, keys.indexOf(k));
          if (!document.getElementById('block-kit44-30m')) out.push(`${size} Day: the 30-minute block is not drawn`);
          else if (!document.getElementById('block-kit44-30m').classList.contains('compact')) out.push(`${size} Day: the 30-minute block is not compact`);
          measure('screen-day', 'Day', [['.ui-btn--icon[aria-label^="Mark"]', '✓ tick'], ['.ui-btn--icon[aria-label="Start stopwatch"]', '⏱ stopwatch']]);
          /* The head row: on a block whose clip holds 44px, the ✓ and the
             icon-only ⏱ side by side at its top-right, clear of the name and
             duration lines; on a shorter one, neither. */
          const head = (id, want) => {
            const blk = document.getElementById('block-' + id);
            if (!blk) { out.push(`${size} Day: block ${id} is not drawn`); return; }
            const fits = blk.clientHeight >= 44;
            const tick = blk.querySelector(':scope > .ui-btn--icon[aria-label^="Mark"]');
            const swb = blk.querySelector(':scope > .ui-btn--icon[aria-label="Start stopwatch"]');
            const where = `${size} Day: the ${blk.getBoundingClientRect().height.toFixed(1)}px block ${id} (clip ${blk.clientHeight}px)`;
            if (want !== fits) out.push(`${where} ${fits ? 'holds' : 'does not hold'} 44px inside its border, expected ${want ? 'to' : 'not to'}`);
            if (!fits) {
              if (tick || swb) out.push(`${where} is under 44px inside its border but draws ${[tick && '✓', swb && '⏱'].filter(Boolean).join(' and ')}`);
              return;
            }
            if (!tick) out.push(`${where} holds 44px but draws no ✓`);
            if (!swb) { out.push(`${where} holds 44px and has its stopwatch on but draws no ⏱`); return; }
            if (swb.textContent.trim() !== '⏱') out.push(`${where}: the ⏱ button is not icon-only (it reads "${swb.textContent.trim()}")`);
            if (!tick) return;
            const t = tick.getBoundingClientRect(), s = swb.getBoundingClientRect();
            if (Math.abs(t.top - s.top) > 0.5) out.push(`${where}: the ✓ and the ⏱ are not in one row (tops ${Math.round(t.top)}, ${Math.round(s.top)})`);
            if (s.right > t.left + 0.5) out.push(`${where}: the ⏱ is not beside the ✓ on its left (⏱ right ${Math.round(s.right)}, ✓ left ${Math.round(t.left)})`);
            const b = blk.getBoundingClientRect();
            if (Math.abs(t.right - (b.left + blk.clientLeft + blk.clientWidth)) > 0.5 || Math.abs(t.top - (b.top + blk.clientTop)) > 0.5) out.push(`${where}: the ✓ is not flush in the top-right corner`);
            const btnLeft = Math.min(t.left, s.left);
            blk.querySelectorAll(':scope > .block-name, :scope > .block-meta').forEach(line => {
              const r = line.getBoundingClientRect();
              const textRight = r.right - parseFloat(getComputedStyle(line).paddingRight);
              if (r.top < s.bottom && textRight > btnLeft + 0.5) out.push(`${where}: its ${line.className} runs under the head buttons (text ends at ${Math.round(textRight - b.left)}px, buttons start at ${Math.round(btnLeft - b.left)}px)`);
            });
          };
          [['kit44-day', true], ['kit44-30m', false], ['kit44-34m', false], ['kit44-35m', false], ['kit44-36m', true], ['kit44-45m', true], ['kit44-60m', true]].forEach(([id, want]) => head(id, want));
          /* No block carries a worded stopwatch button; the check must catch
             a planted one. */
          const worded = () => [...document.querySelectorAll('.placed-block button')].filter(el => /stopwatch/i.test(el.textContent));
          worded().forEach(el => out.push(`${size} Day: block ${el.closest('.placed-block').id} carries a worded stopwatch button "${el.textContent.trim()}"`));
          const plantIn = document.getElementById('block-kit44-day');
          if (plantIn) {
            const planted = document.createElement('button');
            planted.type = 'button'; planted.className = 'ui-btn ui-btn--secondary'; planted.textContent = '⏱ Start stopwatch';
            plantIn.appendChild(planted);
            if (!worded().includes(planted)) out.push(`${size} Day: the worded-stopwatch check missed a planted "⏱ Start stopwatch" button`);
            planted.remove();
          }
          /* A block too short for the head row is still ticked done from its
             own sheet (owner answer Q10, 2026-10-11): the 47px block, the
             shortest one not compact, and the 40px compact one. Tapped the way
             a child taps it, the sheet's done switch ticked, Save pressed. */
          for (const id of ['kit44-35m', 'kit44-30m']) {
            const blk = document.getElementById('block-' + id);
            const where = `${size} Day: the ${blk ? blk.getBoundingClientRect().height.toFixed(1) : '?'}px block ${id}`;
            if (!blk) { out.push(`${where} is not drawn`); continue; }
            blk.click();
            const ov = document.getElementById('editOverlay');
            if (!ov.classList.contains('open')) { out.push(`${where}: a tap does not open its sheet`); continue; }
            document.getElementById('editCompleteToggle').click();
            ov.querySelector('button[onclick^="saveEditChanges"]').click();
            for (let i = 0; i < 40 && ov.classList.contains('open'); i++) await new Promise(r => setTimeout(r, 25));
            if (ov.classList.contains('open')) { out.push(`${where}: its sheet did not close on Save`); closeSheet('editOverlay'); }
            const saved1 = getDayBlocks(k, 'jenn').find(b => b.id === id);
            if (!saved1 || !isBlockCompleted(saved1, 'jenn')) out.push(`${where}: ticked done on its sheet and saved, but the block is not done`);
            const redrawn = document.getElementById('block-' + id);
            if (!redrawn || !redrawn.classList.contains('placed-block--completed')) out.push(`${where}: done on its sheet but not drawn done on the Day`);
          }
          /* Clash lanes (owner answer Q11, 2026-10-11). The name's room is the
             block's inner width less its padding and the head buttons (44px
             each). The ⏱ shows only when the name keeps 60px beside both
             buttons; the ✓ only when it keeps 60px beside the ✓; and whenever
             a head button shows, the name line really has 60px. A pair and a
             triple of 60-minute blocks with their stopwatch on, and one alone.
             On the phone the pair must come out ✓-only and the triple bare. */
          setDayBlocks(k, [
            { id: 'kit44-solo', actId: 'reading', startMin: 11 * 60, durationMin: 60, stopwatch: sw() },
            { id: 'kit44-pa', actId: 'reading', startMin: 13 * 60, durationMin: 60, stopwatch: sw() },
            { id: 'kit44-pb', actId: 'reading', startMin: 13 * 60, durationMin: 60, stopwatch: sw() },
            { id: 'kit44-ta', actId: 'reading', startMin: 15 * 60, durationMin: 60, stopwatch: sw() },
            { id: 'kit44-tb', actId: 'reading', startMin: 15 * 60, durationMin: 60, stopwatch: sw() },
            { id: 'kit44-tc', actId: 'reading', startMin: 15 * 60, durationMin: 60, stopwatch: sw() },
          ], 'jenn');
          /* Each width the Day is drawn at: one day, and on the iPad three days
             side by side, where a pair and a triple are as narrow as on the phone. */
          for (const span of size === 'iPad' ? [1, 3] : [1]) {
            setDayViewSpan(span);
            openDay(k, keys.indexOf(k));
            const at = span > 1 ? `${size} ${span}-day` : size;
            const drawnAs = {};
            ['kit44-solo', 'kit44-pa', 'kit44-pb', 'kit44-ta', 'kit44-tb', 'kit44-tc'].forEach(id => {
              const blk = document.getElementById('block-' + id);
              if (!blk) { out.push(`${at} Day: clash block ${id} is not drawn`); return; }
              const tick = blk.querySelector(':scope > .ui-btn--icon[aria-label^="Mark"]');
              const swb = blk.querySelector(':scope > .ui-btn--icon[aria-label="Start stopwatch"]');
              const pad = parseFloat(getComputedStyle(blk).paddingLeft);
              const room = n => blk.clientWidth - pad - 44 * n;
              const where = `${at} Day: the ${blk.getBoundingClientRect().width.toFixed(1)}px-wide block ${id} (name room ${room(2).toFixed(1)}px beside ✓ and ⏱, ${room(1).toFixed(1)}px beside ✓)`;
              drawnAs[id] = swb ? 'both' : tick ? 'tick' : 'none';
              if (swb && room(2) < 60) out.push(`${where} draws the ⏱ with under 60px for the name`);
              if (tick && room(1) < 60) out.push(`${where} draws the ✓ with under 60px for the name`);
              if (swb && !tick) out.push(`${where} draws the ⏱ without the ✓`);
              if (!swb && room(2) >= 60) out.push(`${where} has room for the ⏱ but does not draw it`);
              if (!tick && room(1) >= 60) out.push(`${where} has room for the ✓ but does not draw it`);
              if (tick || swb) {
                const name = blk.querySelector(':scope > .block-name');
                const ncs = name && getComputedStyle(name);
                const nameW = name ? name.clientWidth - parseFloat(ncs.paddingLeft) - parseFloat(ncs.paddingRight) : 0;
                if (nameW < 59.5) out.push(`${where}: its name line has ${nameW.toFixed(1)}px beside the head buttons, under 60px`);
              }
            });
            if (size === 'phone' || span === 3) {
              ['kit44-pa', 'kit44-pb'].forEach(id => { if (drawnAs[id] && drawnAs[id] !== 'tick') out.push(`${at} Day: the clash pair's ${id} draws ${drawnAs[id]}, expected the ✓ only`); });
              ['kit44-ta', 'kit44-tb', 'kit44-tc'].forEach(id => { if (drawnAs[id] && drawnAs[id] !== 'none') out.push(`${at} Day: the clash triple's ${id} draws ${drawnAs[id]}, expected no head buttons`); });
            }
            if (drawnAs['kit44-solo'] && drawnAs['kit44-solo'] !== 'both') out.push(`${at} Day: the block alone in its lane draws ${drawnAs['kit44-solo']}, expected the ✓ and the ⏱`);
          }
          if (wasSpan == null) localStorage.removeItem(DAY_SPAN_LS_KEY); else localStorage.setItem(DAY_SPAN_LS_KEY, wasSpan);
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
          if (document.getElementById('editOverlay').classList.contains('open')) closeSheet('editOverlay');
          if (wasSpan == null) localStorage.removeItem(DAY_SPAN_LS_KEY); else localStorage.setItem(DAY_SPAN_LS_KEY, wasSpan);
          setDayBlocks(k, saved, 'jenn');
          // The sheet ticks may have paid XP or stars: put the whole state back.
          const sn = JSON.parse(snap); Object.keys(state).forEach(key => { delete state[key]; }); Object.assign(state, sn); saveLocal();
          profile = wasProfile; parentViewing = wasViewing; weekOffset = wasOffset;
          if (weekView !== wasView) setWeekView(wasView);
          goToday();
        }
        return out;
      }, [size]));
    }
    /* An iPad turned to portrait (Stage 47): the Day drawn at 1194 wide with
       three days and the clash pair, then the window narrowed to 834. The
       timeline is drawn again for the new width (debounced, about 150 ms): as
       many columns as 834px carries, every head button chosen from the new
       lane width by the same 60px name rule, and the schedule's scroll kept. */
    await page.setViewportSize({ width: 1194, height: 834 });
    const rotBefore = await page.evaluate(() => {
      const k = todayKey();
      const sw = () => ({ enabled: true, running: false, elapsedSec: 0 });
      window.__kit44Rot = { snap: JSON.stringify(state), wasSpan: localStorage.getItem(DAY_SPAN_LS_KEY),
        wasProfile: profile, wasViewing: parentViewing, wasOffset: weekOffset };
      profile = 'jenn'; parentViewing = 'jenn'; weekOffset = 0;
      setDayBlocks(k, [
        { id: 'kit44-pa', actId: 'reading', startMin: 13 * 60, durationMin: 60, stopwatch: sw() },
        { id: 'kit44-pb', actId: 'reading', startMin: 13 * 60, durationMin: 60, stopwatch: sw() },
        { id: 'kit44-late', actId: 'reading', startMin: 20 * 60 + 30, durationMin: 60 },
      ], 'jenn');
      setDayViewSpan(3);
      openDay(k, getDayKeys(0).indexOf(k));
      const ws = document.querySelector('#screen-day .day-workspace');
      ws.scrollTop = 200;
      const pa = document.getElementById('block-kit44-pa');
      return { cols: document.querySelectorAll('#timeline .tl-col').length, scrollTop: ws.scrollTop,
        pa: pa ? (pa.querySelector(':scope > .ui-btn--icon[aria-label="Start stopwatch"]') ? 'both' : pa.querySelector(':scope > .ui-btn--icon[aria-label^="Mark"]') ? 'tick' : 'none') : 'missing' };
    });
    await page.setViewportSize({ width: 834, height: 1194 });
    await page.waitForTimeout(400);
    problems.push(...await page.evaluate(([was]) => {
      const out = [];
      const r = window.__kit44Rot;
      try {
        const cols = document.querySelectorAll('#timeline .tl-col').length;
        if (cols !== dayViewSpanEffective()) out.push(`iPad turned 1194→834 Day: ${cols} day columns still drawn (${was.cols} at 1194), the new width carries ${dayViewSpanEffective()}`);
        ['kit44-pa', 'kit44-pb'].forEach(id => {
          const blk = document.getElementById('block-' + id);
          if (!blk) { out.push(`iPad turned 1194→834 Day: clash block ${id} is not drawn`); return; }
          const tick = blk.querySelector(':scope > .ui-btn--icon[aria-label^="Mark"]');
          const swb = blk.querySelector(':scope > .ui-btn--icon[aria-label="Start stopwatch"]');
          const pad = parseFloat(getComputedStyle(blk).paddingLeft);
          const room = n => blk.clientWidth - pad - 44 * n;
          const drawn = swb ? 'both' : tick ? 'tick' : 'none';
          const want = room(2) >= 60 ? 'both' : room(1) >= 60 ? 'tick' : 'none';
          if (drawn !== want) out.push(`iPad turned 1194→834 Day: the ${blk.getBoundingClientRect().width.toFixed(1)}px-wide block ${id} (name room ${room(1).toFixed(1)}px beside ✓) draws ${drawn} (it drew ${was.pa} at 1194), the new width calls for ${want}`);
        });
        const ws = document.querySelector('#screen-day .day-workspace');
        const keep = Math.min(was.scrollTop, ws.scrollHeight - ws.clientHeight);
        if (Math.abs(ws.scrollTop - keep) > 1) out.push(`iPad turned 1194→834 Day: the schedule scrolled from ${was.scrollTop}px to ${ws.scrollTop}px, expected it kept at ${keep}px`);
      } catch (e) {
        out.push(`iPad turned 1194→834: threw ${e.message}`);
      } finally {
        if (r.wasSpan == null) localStorage.removeItem(DAY_SPAN_LS_KEY); else localStorage.setItem(DAY_SPAN_LS_KEY, r.wasSpan);
        const sn = JSON.parse(r.snap); Object.keys(state).forEach(key => { delete state[key]; }); Object.assign(state, sn); saveLocal();
        profile = r.wasProfile; parentViewing = r.wasViewing; weekOffset = r.wasOffset;
        delete window.__kit44Rot;
        goToday();
      }
      return out;
    }, [rotBefore]));
    await page.setViewportSize(before);
    checks.kitButtonsHold44pxOnWeekAndDay = problems.length ? problems : true;
  }
};
