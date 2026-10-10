// Smoke group: the house-rules walks (kidScreensMeetTheHouseRules, parentScreensMeetTheHouseRules). Moved out of tests/smoke.js (Stage 23) so one worker can edit this group alone; tests/smoke.js calls it at the same point in the run, on its one shared page, with the helpers it names. Each walk sets up its own starting point and data (Stage 25), so it passes alone (SMOKE_ONLY) and in its part.
module.exports = async ({ page, want, checks, setupNeeded, setLook, clearLooks, kidStandards, KID_SCREENS, KID_SHEETS }) => {
  /* Waits until what a row drew is at rest, instead of a fixed 200 ms (250 on
     the portal) per row: two frames, so layout and any requestAnimationFrame
     work have run, then every running animation with an end (a sheet's
     slide-up, an overlay's fade) is put at its end. Endless ones (pulses,
     twinkles) are left running, as before. */
  const settle = () => page.evaluate(async () => {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (const a of document.getAnimations()) {
      const end = a.effect ? a.effect.getComputedTiming().endTime : Infinity;
      if (a.playState === 'running' && Number.isFinite(end)) a.finish();
    }
  });
  /* In both looks (Looks stage 3). Calm's fonts are wider than Pop's
     handwriting at a smaller scale, so every width that fits in one has to be
     measured in the other; and at 1194×834, the iPad this app lives on. */
  const kidFindings = [];
  if (setupNeeded('kidScreensAudit')) {
    /* The walk's own starting point, whatever the checks before it left: a
       girl signed in (these are her screens; the sheet rows sign her in too, so
       only the first rows used to depend on who was), this week. Each row seeds
       its own data; a Sunday row's seed is undone from the walk's own copy of
       state taken just before that row. */
    await page.evaluate(() => { profile = 'jenn'; parentViewing = 'jenn'; weekOffset = 0; });
    /* Puts the page back between rows: closes what a row left open, undoes a
       Sunday row, and when the next row is a Sunday one, copies state first. */
    const betweenRows = (copyForNext) => page.evaluate((copy) => {
      const o = document.getElementById('requestOverlay'); if (o && o.classList.contains('open')) rqClose();
      const idea = document.getElementById('mnyConceptCard'); if (idea) idea.remove();
      if (window.__hrRowCopy) {
        sdRestore(window.__hrRowCopy.state); if (mmIsOpen()) mmHide(); profile = window.__hrRowCopy.profile;
        window.__hrRowCopy = null;
      }
      // The Sunday rows keep their own copy for other callers; this walk does not read it.
      window.__sdSweepSnap = null; window.__sdSweepProfile = null;
      const sdo = document.getElementById('sundayOverlay'); if (sdo && sdo.classList.contains('open')) closeSheet('sundayOverlay');
      if (copy) window.__hrRowCopy = { state: JSON.stringify(state), profile };
    }, copyForNext);
    for (const look of ['pop', 'calm']) {
      try { await setLook(look); } catch (e) { kidFindings.push(`[${look}] the look could not be applied: ${e.message}`); continue; }
      for (const [w, h] of [[390, 844], [768, 1024], [1024, 768], [1194, 834], [1440, 900], [900, 1100]]) {
        await page.setViewportSize({ width: w, height: h });
        for (const [id, nav, label] of [...KID_SCREENS, ...KID_SHEETS]) {
          // The request sheets and Sunday's steps are measured at the phone and the iPad only.
          const isSheet = /^(sheet|sunday)\//.test(String(label || ''));
          if (isSheet && w !== 390 && w !== 1194) continue;
          // A sheet left open by the row before would cover the next screen; a
          // seeded row's state is put back before the next one draws.
          await betweenRows(/^sunday\//.test(String(label || '')));
          // A row's seed may return a sentence saying what it failed to put on screen.
          const seeded = await page.evaluate(`(${nav.toString()})()`);
          await settle();
          const r = await kidStandards(id);
          const problems = [];
          if (typeof seeded === 'string') problems.push(seeded);
          if (r.error) problems.push(r.error);
          /* A screen that did not open measures as clean: every control on it is
             display:none, so none is "too small". openSisterSync refuses a parent,
             for one — so each row must prove its screen was on show.
             Sideways scroll is the failure a screenshot needs a human to notice and
             an assertion catches by itself: content pushed off the edge of a tablet
             is simply unreachable, and nothing else here would report it. */
          const { onShow, overflow } = await page.evaluate((sid) => {
            const scr = document.getElementById(sid);
            const onShow = !!scr && (scr.classList.contains('active') || (scr.classList.contains('overlay') && scr.classList.contains('open'))
              || scr.classList.contains('mny-concept-scrim'));
            const worst = [...scr.querySelectorAll('*')].reduce((acc, el) => {
              if (el.closest('[style*="overflow"], .ck-gridwrap, .weekly-full-wrap, .tg-wrap')) return acc;
              const r = el.getBoundingClientRect();
              return (r.width && r.right > acc.right) ? { right: r.right, cls: String(el.className).slice(0, 24) } : acc;
            }, { right: 0, cls: '' });
            return { onShow, overflow: { body: document.body.scrollWidth, worst } };
          }, id);
          if (!onShow) problems.push('the screen was not on show, so nothing on it was measured');
          if (overflow.body > w + 1) problems.push(`page scrolls sideways (${overflow.body} > ${w})`);
          if (overflow.worst.right > w + 1) problems.push(`.${overflow.worst.cls} runs to ${Math.round(overflow.worst.right)} (past ${w})`);
          if (r.small && r.small.length) problems.push(`${r.small.length} target(s) under 44px: ${r.small.slice(0, 6).join(', ')}`);
          if (r.minFont < 13) problems.push(`font ${r.minFont}px on .${r.minWhere} (min 13)`);
          if (problems.length) kidFindings.push(`[${look}] ${label || id}@${w}: ${problems.join(' | ')}`);
        }
      }
    }
    await betweenRows(false);
    await clearLooks();
  }
  if (want('kidScreensMeetTheHouseRules')) checks.kidScreensMeetTheHouseRules = kidFindings.length === 0 || kidFindings;

  /* Looks stage 4 — the parent portal's five destinations and the profile
     picker, in both looks, at the phone and the iPad. The parent's Reading
     size is left at its default (it multiplies on top of the look).

     - 44px targets everywhere: a house rule on every screen (CLAUDE.md →
       ARCHITECTURE.md, UI rules), probed with kidStandards' hit test. The five
       destination tabs were 41px in Pop and 38px in Calm until this check.
     - Text: the picker is a child's screen, so nothing on it under 13px in
       either look. The portal's small print predates the looks — History's
       chart axes and tile captions, the meeting's day counts — and the kid
       floor was never applied there (ARCHITECTURE.md, UI rules); raising it
       would change Pop, which this stage keeps. So on the portal a look may not
       PUSH text under 13px: a Calm label under 13px fails unless the same
       label (screen, width, class, text) is under 13px in Pop too. Those that
       are under in both are listed in the log, not failed.
     - Nothing runs past the side of the screen. */
  const parentFindings = [], parentSmallPrint = new Set();
  {
    if (setupNeeded('parentScreensAudit')) {
      const popSize = {};
      /* Grown-ups' five tabs (Sunday v15 Stage 2) are rows too, drawn over real
         questions, fines, commitments and expected money so every card kind is on
         screen while it is measured — seeded once here, put back after. The
         walk reads nothing an earlier check left: it signs in each row itself. */
      await page.evaluate(() => {
        window.__guAuditSnap = JSON.stringify(state);
        const wasProfile = profile;
        const wk = ctThisWeekKey(), days = mrWeekDayKeys(wk);
        profile = 'parent';
        mrAddFine('jess', 'tone', days[1], { who: 'Mom' });
        mrAddFine('jess', 'box_repeat', days[2], { who: 'Dad' });
        const fine = mrFines('jess')[mrFines('jess').length - 1];
        mnyAddExpected('jenn', { month: String(todayKey()).slice(0, 7), label: '🎄 Christmas', amount: 20 });
        setDayBlocks(days[3], [...(getDayBlocks(days[3], 'jess') || []), { id: 'gu-aud-aj', actId: 'assistant_job', startMin: 17 * 60, durationMin: 90 }], 'jess');
        profile = 'jess';
        mnyAddRequest('jess', { kind: 'comp', sport: 'swim', name: 'Swim time trial', custom: true, dayKey: days[2],
          races: [{ ev: '50 Free', time: '0:41.8', pts: 6 }, { ev: '50 Back', time: '0:49.2', pts: 4 }] });
        mnyAddRequest('jess', { kind: 'dispute', fineId: fine.id, why: 'the bag was not mine' });
        mnyAddRequest('jess', { kind: 'skip', blockId: 'gu-aud-aj', dayKey: days[3], why: '🤒 Sick' });
        const adv = mnyAddRequest('jess', { kind: 'adv', amount: 2, why: 'School book fair', text: 'Draw $2 in advance · School book fair' });
        profile = 'jenn';
        mnyAddRequest('jenn', { kind: 'gift', amount: 20, giver: 'Uncle Mike', text: 'Uncle Mike · $20 birthday money' });
        mnyAddRequest('jenn', { kind: 'goal', name: 'New skate guards', icon: '🛼', target: 35 });
        profile = 'parent';
        if (adv) mnyAnswerRequest('jess', adv.id, 'yes');
        // A rule change, so ⚙️ Rules draws its "Last: …" line whether or not an earlier check changed a rule.
        mrLogAppend({ path: 'fines.tone', from: 1, to: 2, note: 'house-rules walk' });
        profile = wasProfile;
      });
      const parentDests = ['picker', 'now', 'meeting', 'history', 'setup', 'app',
        'gu:approve', 'gu:commit', 'gu:fines', 'gu:expect', 'gu:rules', 'gu:weeks'];
      for (const look of ['pop', 'calm']) {
        try { await setLook(look); } catch (e) { parentFindings.push(`[${look}] the look could not be applied: ${e.message}`); continue; }
        for (const [w, h] of [[390, 844], [1194, 834]]) {
          await page.setViewportSize({ width: w, height: h });
          for (const dest of parentDests) {
            const sid = dest === 'picker' ? 'screen-profile' : 'screen-parent';
            const where = `[${look}] ${dest === 'picker' ? 'profile picker' : dest.indexOf('gu:') === 0 ? 'Parent › Grown-ups › ' + dest.slice(3) : 'Parent › ' + dest}@${w}`;
            await page.evaluate((d) => {
              if (d === 'picker') { showScreen('profile'); return; }
              profile = 'parent'; parentUnlockedThisSession = true; parentViewing = 'jenn';
              showScreen('parent'); renderParentHome();
              if (d.indexOf('gu:') === 0) { setParentTab('money'); mnyParentSection = d.slice(3); mnyRenderRulesTab(); return; }
              setParentDest(d);
            }, dest);
            await settle();
            if (!(await page.evaluate((s) => document.getElementById(s).classList.contains('active'), sid))) {
              parentFindings.push(`${where}: the screen was not on show, so nothing on it was measured`);
              continue;
            }
            const r = await kidStandards(sid);
            const problems = [];
            if (r.small && r.small.length) problems.push(`${r.small.length} target(s) under 44px: ${r.small.slice(0, 6).join(', ')}`);
            const m = await page.evaluate((s) => {
              const texts = {};
              document.getElementById(s).querySelectorAll('*').forEach(el => {
                const cs = getComputedStyle(el);
                if (cs.display === 'none' || cs.visibility === 'hidden') return;
                const box = el.getBoundingClientRect();
                if (!box.width || !box.height) return;
                const text = [...el.childNodes].filter(c => c.nodeType === 3).map(c => c.textContent).join('').trim();
                if (!text) return;
                const key = `.${(el.getAttribute('class') || el.tagName).trim().split(/\s+/)[0]} "${text.slice(0, 20)}"`;
                const px = parseFloat(cs.fontSize);
                if (!(key in texts) || px < texts[key]) texts[key] = px;
              });
              return { texts, body: document.body.scrollWidth };
            }, sid);
            if (m.body > w + 1) problems.push(`page scrolls sideways (${m.body} > ${w})`);
            const under = [];
            for (const [key, px] of Object.entries(m.texts)) {
              const id = `${dest}@${w} ${key}`;
              if (look === 'pop') popSize[id] = px;
              if (px >= 13) continue;
              const inPopToo = dest !== 'picker' && (look === 'pop' || (id in popSize && popSize[id] < 13));
              if (inPopToo) parentSmallPrint.add(`${dest}@${w} ${key}`);
              else under.push(`${key} ${Math.round(px * 100) / 100}px${look === 'calm' && id in popSize ? ` (${Math.round(popSize[id] * 100) / 100}px in Pop)` : ''}`);
            }
            if (under.length) problems.push(`${under.length} text(s) under 13px: ${under.slice(0, 6).join(', ')}`);
            if (problems.length) parentFindings.push(`${where}: ${problems.join(' | ')}`);
          }
        }
      }
      await clearLooks();
      await page.evaluate(() => {
        const s = JSON.parse(window.__guAuditSnap);
        Object.keys(state).forEach(k => { delete state[k]; });
        Object.assign(state, s);
        window.__guAuditSnap = null;
        mnyParentSection = 'approve';
        saveLocal();
      });
    }
    await page.evaluate(() => { profile = 'jenn'; parentViewing = 'jenn'; selectProfile('jenn'); goToday(); });
    await page.setViewportSize({ width: 900, height: 1100 });
    if (parentSmallPrint.size) console.log(`Parent portal small print under 13px in both looks (predates the looks; listed, not failed): ${parentSmallPrint.size}\n  ${[...parentSmallPrint].slice(0, 40).join('\n  ')}`);
  }
  if (want('parentScreensMeetTheHouseRules')) checks.parentScreensMeetTheHouseRules = parentFindings.length === 0 || parentFindings;
};
