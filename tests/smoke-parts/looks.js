// Smoke group: the looks walks (thePopLookReadsEverywhere, theCalmLookReadsEverywhere, everyTextUsesTheLooksFonts). Moved out of tests/smoke.js (Stage 23) so one worker can edit this group alone; tests/smoke.js calls it at the same point in the run, on its one shared page, with the helpers it names. Since Stage 26 the group seeds the chore week it walks itself (seedLooksChoreWeek below), so it reads the same whether the checks before it ran or not (SMOKE_PART=3, SMOKE_ONLY).
module.exports = async ({ page, want, checks, shot, setLook, clearLooks, KID_SCREENS, defineAuditSeeds }) => {
  /* Wait for a screen or sheet to settle: at least SETTLE_FLOOR ms (an 80 ms
     timer, a re-render on the next frame), then until no finite animation or
     transition is running (a sheet's 0.3 s slide-in, an overlay's fade), never
     longer than `cap` — the fixed wait each step had before, so a step that
     was measured mid-animation then is measured at the same moment now.
     Endless animations (a conflict's pulse) are not waited for, as before. */
  const SETTLE_FLOOR = 100;
  const settle = async (cap) => {
    const end = Date.now() + cap;
    await page.waitForTimeout(SETTLE_FLOOR);
    while (Date.now() < end) {
      const busy = await page.evaluate(() => document.getAnimations().some(a => a.playState === 'running'
        && a.effect && Number.isFinite(a.effect.getComputedTiming().endTime))).catch(() => false);
      if (!busy) return;
      await page.waitForTimeout(Math.min(25, Math.max(1, end - Date.now())));
    }
  };

  /* The chore week the walks read: Jenn's week as the full run leaves it by
     this point. The suite's setup claims Monday-indexed day 2's dishes for her
     ("Something claimed and ungraded", before parentChoreTabRenders) and plans
     a dishes block on today (the 'ckchore' row before it); in the full run
     meetingWontCelebrateHalfDone (part 2) then wipes her claims and grades
     Mon-Wed, and later part-2 checks drop Wednesday's grade and today's block.
     So on 2026-10-07 the full run's Today shows "No jobs set up for this week
     yet" and "✨ 5 answered", where a run without part 2 showed the claim as a
     "with Mum" row. The walks measure what the full run shows: no claims,
     dishes graded Monday and mop Tuesday, five grades she has not seen, nothing
     on today; a grown-up looking at her (profile 'parent'), so the first render
     does not mark the grades seen. Put back after the three checks: her week's
     earnings and today's blocks; lastGradeSeen only if nothing stamped it
     meanwhile (a walk that rendered her own Today stamps it, as in the full run). */
  const seedLooksChoreWeek = () => page.evaluate(() => {
    const kid = 'jenn', wk = ctThisWeekKey(), day = todayKey();
    const p = getProfData(kid);
    const e = mrEnsureEarnings(kid, wk);
    window.__looksHad = { wk, day, e: JSON.stringify(e), today: JSON.stringify(getDayBlocks(day, kid) || []),
      hasSeen: !!p.progress && 'lastGradeSeen' in p.progress, seen: p.progress && p.progress.lastGradeSeen,
      who: [profile, parentViewing, parentUnlockedThisSession] };
    const t = Date.now();
    e.claims = {};
    e.chores = { 0: { dishes: 3 }, 1: { mop: 3 } };
    e.gradedAt = { 0: { dishes: t }, 1: { mop: t, dishes: t }, 2: { vacuum: t }, 3: { bins: t } };
    if (p.progress) delete p.progress.lastGradeSeen;
    setDayBlocks(day, [], kid);
    profile = 'parent'; parentUnlockedThisSession = true; parentViewing = kid;
  });
  const unseedLooksChoreWeek = (walked) => page.evaluate((walked) => {
    const h = window.__looksHad;
    if (!h) return;
    if (!walked) [profile, parentViewing, parentUnlockedThisSession] = h.who;
    const kid = 'jenn', p = getProfData(kid);
    p.earnings[h.wk] = JSON.parse(h.e);
    setDayBlocks(h.day, JSON.parse(h.today), kid);
    if (!p.progress || !('lastGradeSeen' in p.progress)) {
      if (h.hasSeen) { if (!p.progress) p.progress = {}; p.progress.lastGradeSeen = h.seen; }
    }
    window.__looksHad = null;
  }, walked);
  /* Looks stage 2 — the Pop look, read in light mode, everywhere a child (or a
     grown-up) reads it. Pop fills the Now card with its block's colour, fills
     block rows with their wash, turns the main buttons yellow and the today
     markers navy, and makes the text 10% bigger; any of those can put text on
     a colour it does not read on. So every KID_SCREENS row at the phone and the
     iPad sizes, the five parent destinations, the ⋯ More sheet and the block
     edit sheet are measured with darkContrastFindings' method (background
     layers composited, opacity included; no dark emulation here): at least
     4.5:1, and never white text on a pastel. Sheets are measured after their
     slide-in, because mid-animation every word reads 1:1.

     Looks stage 3 made it take the look: the same walk runs in Calm (purple
     buttons with white text, navy selected pills, tinted week blocks, new
     fonts). Looks stage 4 put Calm on the parent portal, so the five
     destinations (with the phone's bottom bar where it shows) and the profile
     picker fail in both looks now, where Stage 3 only reported them. Each kid
     screen, parent destination, the picker, ⋯ More and the edit sheet are
     saved as look-<look>-<screen>-<width>.png, the CI artifact a person
     compares the two looks in. */
  const lookReadsEverywhere = async (look) => {
    const bad = [];
    const was = page.viewportSize();
    const ev = async (label, fn, arg) => {
      try { return await page.evaluate(fn, arg); } catch (e) { bad.push(`${label}: threw ${e.message}`); return undefined; }
    };
    const snap = async (name, w) => {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: shot(`look-${look}-${name}-${w}`) });
    };
    await defineAuditSeeds();   // a page reload above dropped them
    try {
      if (look === 'pop') await clearLooks(); else await setLook(look);
    } catch (e) { bad.push(`the ${look} look could not be applied: ${e.message}`); return { bad }; }
    const on = await page.evaluate(() => document.documentElement.getAttribute('data-look'));
    if (on !== look) bad.push(`<html data-look> is "${on}", not "${look}" — the ${look} look was not what was measured`);
    try {
      for (const [w, h] of [[390, 844], [1194, 834]]) {
        await page.setViewportSize({ width: w, height: h });
        const names = new Set();
        let clashNotes = 0;
        for (const [id, nav, label] of KID_SCREENS) {
          /* Today is seeded under a clock pinned to 9:30 (seedTodayAudit), but its
             undo puts the real clock back before anything is measured. Later in
             the day the next redraw then finds a different "now" and draws Today
             again from the restored blocks, and the seeded clash note is gone
             before its ink is read. So the same 9:30 stays pinned here until
             Today has been measured and shot, whatever the hour of the run. */
          if (id === 'screen-today') await ev('pin Today', () => {
            const RealDate = Date;
            const when = new RealDate(); when.setHours(9, 30, 0, 0);
            Date = function (...a) { return a.length ? new RealDate(...a) : new RealDate(when); };
            Date.prototype = RealDate.prototype;
            Date.now = () => when.getTime(); Date.parse = RealDate.parse; Date.UTC = RealDate.UTC;
            window.__lookTodayUnpin = () => { Date = RealDate; };
          });
          const seeded = await ev(label || id, `(${nav.toString()})()`);
          if (typeof seeded === 'string') bad.push(`${label || id}@${w}: ${seeded}`);
          await settle(250);
          const found = await ev(label || id, ([sid, lab]) => {
            const scr = document.getElementById(sid);
            if (!scr || !scr.classList.contains('active')) return [`${lab}: the screen was not on show, so nothing on it was measured`];
            return darkContrastFindings(scr, lab, '.print-sheet');
          }, [id, `${label || id}@${w}`]);
          if (found) bad.push(...found);
          if (id === 'screen-today') clashNotes += await ev('clash notes', () => document.querySelectorAll('#screen-today .quest-conflict-note').length) || 0;
          let name = (label || id).replace(/^screen-/, '').replace(/[^a-z0-9]+/gi, '-');
          while (names.has(name)) name += '-2';
          names.add(name);
          await snap(name, w);
          if (id === 'screen-today') await ev('unpin Today', () => { window.__lookTodayUnpin(); window.__lookTodayUnpin = null; });
        }
        // The seeded Today always carries an overlap; a run that measured no clash note measured nothing of it.
        if (clashNotes < 1) bad.push(`screen-today@${w}: no .quest-conflict-note was on show, so its ink was not measured`);
        /* R12 (2026-09-27): Today with a missed day this week — 🕓 Catch up open
           under ✏️ Modify my plan, "＋ Add to an earlier day" after it. Measured
           for contrast, 44px controls, 13px words, no sideways scroll and its
           place, in this look at this width. */
        const cu = await ev(`Today catch-up@${w}`, (lab) => {
          window.__lookCu = { unpin: c1.pin(3), k: c1.keep('jenn') };
          profile = 'jenn'; parentViewing = 'jenn';
          ctPrepareRead();
          window.__lookCu.k.clear();
          const keys = mrWeekDayKeys(ctThisWeekKey());
          setDayBlocks(keys[1], [{ id: 'lk-cu', actId: 'chores', startMin: 17 * 60, durationMin: 30, choreTags: ['mop', 'dishes'] },
                                 { id: 'lk-cu-r', actId: 'routine_morning', startMin: 7 * 60, durationMin: 30 }], 'jenn');
          setDayBlocks(keys[3], [{ id: 'lk-cu-t', actId: 'piano', startMin: 16 * 60, durationMin: 60 }], 'jenn');
          goToday();
          const day = document.querySelector(`#tdWrap .td-catchup [data-td-action="catchup-day"][data-td-day="${keys[1]}"]`);
          if (!day) return [`${lab}: no catch-up day to measure`];
          day.click();
          const card = document.querySelector('#tdWrap .td-catchup');
          const row = document.querySelector('#tdWrap [data-td-action="else-earlier"]');
          const out = [...catchUpPlacementFindings().map(f => `${lab}: ${f}`), ...darkContrastFindings(card, lab)];
          if (!card.querySelector('.td-catchup-panel')) out.push(`${lab}: the day did not open`);
          if (row) out.push(...darkContrastFindings(row, `${lab} earlier-day row`));
          const btns = [...card.querySelectorAll('button'), ...(row ? [row] : [])];
          const small = btns.filter(b => { const r = b.getBoundingClientRect(); return r.height < 44 || r.width < 44; });
          if (small.length) out.push(`${lab}: ${small.length} control(s) under 44px: ${small[0].className} ${Math.round(small[0].getBoundingClientRect().height)}px`);
          const tiny = [card, ...(row ? [row] : [])].flatMap(el => [el, ...el.querySelectorAll('*')]).filter(el =>
            [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) < 13);
          if (tiny.length) out.push(`${lab}: text under 13px: .${tiny[0].className} ${getComputedStyle(tiny[0]).fontSize}`);
          if (document.body.scrollWidth > window.innerWidth + 1) out.push(`${lab}: the page scrolls sideways`);
          // The picture: the day folded again, ✏️ Modify my plan near the top, the group under it.
          const again = document.querySelector(`#tdWrap .td-catchup [data-td-action="catchup-day"][data-td-day="${keys[1]}"]`);
          if (again) again.click();
          const plan = document.querySelector('#tdWrap .td-col--day .td-plan');
          if (plan) window.scrollTo(0, Math.max(0, plan.getBoundingClientRect().top + window.scrollY - 140));
          return out;
        }, `Today catch-up@${w}`);
        if (cu) bad.push(...cu);
        await settle(250);
        await page.screenshot({ path: shot(`look-${look}-today-catchup-${w}`) });
        await ev('Today catch-up restore', () => {
          if (!window.__lookCu) return;
          window.__lookCu.unpin(); window.__lookCu.k.restore(); window.__lookCu = null; goToday();
        });
        for (const dest of ['now', 'meeting', 'history', 'setup', 'app']) {
          await ev(`parent ${dest}`, (d) => {
            profile = 'parent'; parentUnlockedThisSession = true; parentViewing = 'jenn';
            showScreen('parent'); renderParentHome(); setParentDest(d); window.scrollTo(0, 0);
          }, dest);
          await settle(250);
          const found = await ev(`parent ${dest}`, (lab) => {
            if (!document.getElementById('screen-parent').classList.contains('active')) return [`${lab}: the portal was not on show, so nothing on it was measured`];
            const nav = document.getElementById('parentNav');
            return [...darkContrastFindings(document.getElementById('screen-parent'), lab),
              ...(nav && !nav.hidden ? darkContrastFindings(nav, `${lab} bottom bar`) : [])];
          }, `Parent › ${dest}@${w}`);
          if (found) bad.push(...found);
          await snap(`parent-${dest}`, w);
        }
        // The profile picker: the first thing anyone sees, in the device's last look.
        await ev('picker', () => { showScreen('profile'); window.scrollTo(0, 0); });
        await settle(250);
        const picker = await ev('picker', (lab) => {
          const scr = document.getElementById('screen-profile');
          if (!scr.classList.contains('active')) return [`${lab}: the picker was not on show, so nothing on it was measured`];
          return darkContrastFindings(scr, lab);
        }, `profile picker@${w}`);
        if (picker) bad.push(...picker);
        await snap('picker', w);
        await ev('More', () => { profile = 'jenn'; parentViewing = 'jenn'; selectProfile('jenn'); goToday(); tdOpenMore(); });
        await settle(450);
        const more = await ev('More', (lab) => darkContrastFindings(document.querySelector('#tdMoreOverlay .sheet'), lab), `⋯ More@${w}`);
        if (more) bad.push(...more);
        await page.screenshot({ path: shot(`look-${look}-more-${w}`) });
        await ev('More close', () => { const ov = document.getElementById('tdMoreOverlay'); if (ov && ov.classList.contains('open')) closeSheet('tdMoreOverlay'); });
        await ev('edit', () => {
          profile = 'jenn'; parentViewing = 'jenn';
          const k = todayKey();
          window.__popHad = getDayBlocks(k, 'jenn');
          setDayBlocks(k, [...window.__popHad.filter(b => b.id !== 'pop-edit'),
            { id: 'pop-edit', actId: 'piano', startMin: 16 * 60, durationMin: 60, checklistState: {} }], 'jenn');
          openDay(k, getDayKeys(0).indexOf(k)); openEditSheet('pop-edit');
        });
        await settle(450);
        const edit = await ev('edit', (lab) => darkContrastFindings(document.querySelector('#editOverlay .sheet'), lab), `block edit sheet@${w}`);
        if (edit) bad.push(...edit);
        await page.screenshot({ path: shot(`look-${look}-edit-sheet-${w}`) });
        await ev('edit close', () => { closeSheet('editOverlay'); setDayBlocks(todayKey(), window.__popHad, 'jenn'); });
      }
    } finally {
      /* Backstop: a throw between pinning Today and its unpin above would leave
         the 9:30 clock pinned for every later check. */
      await ev('unpin Today (backstop)', () => { if (window.__lookTodayUnpin) { window.__lookTodayUnpin(); window.__lookTodayUnpin = null; } });
      try { await clearLooks(); } catch (e) { bad.push('could not put Pop back: ' + e.message); }
      await ev('restore', () => { profile = 'jenn'; parentViewing = 'jenn'; selectProfile('jenn'); goToday(); });
      if (was) await page.setViewportSize(was);
      await page.waitForTimeout(200);
    }
    return { bad };
  };
  /* Seeded before the first want() (a few ms of setup) and put back after the
     last; a run that wants none of the three gets its profile back too. */
  await seedLooksChoreWeek();
  let walked = false;
  if (want('thePopLookReadsEverywhere')) {
    walked = true;
    const r = await lookReadsEverywhere('pop');
    checks.thePopLookReadsEverywhere = r.bad.length ? r.bad : true;
  }
  if (want('theCalmLookReadsEverywhere')) {
    walked = true;
    const r = await lookReadsEverywhere('calm');
    checks.theCalmLookReadsEverywhere = r.bad.length ? r.bad : true;
  }

  /* Looks stage 4C — one font everywhere (owner, 2026-09-27: "different font
     ... PIN, CALM, Exit button on the parent portal"). No base rule gave
     button / input / select / textarea the page font, so every control without
     its own font-family drew in the browser's system font, in both looks.

     Every visible text — an element's own text node, an input's value or
     placeholder, a select's option, an SVG label, a ::before/::after string —
     must draw in one of the look's own font stacks: the first family of its
     computed font-family is the first family of one of the look block's
     --font-* tokens. The tokens are read from the live page (the computed
     style of <html> in that look), not listed here, so a look that changes
     its fonts moves the check with it. Walked on every KID_SCREENS row, the five parent destinations,
     the profile picker and the ⋯ More, block edit, 📋 Copy a day and 🌙
     reflect sheets, at the phone and the iPad, in both looks.

     Named exemptions, each for a reason:
     - .print-sheet (the print sheet and the week's print preview) draws in
       --print-font-*, because print ignores the look (printIgnoresTheLook).
     - Emoji-only text whose computed stack starts with an emoji font: the
       glyphs come from the emoji font whatever the stack says. None is set
       today; the exemption is counted in the log so a new one is seen. */
  const everyTextUsesTheLooksFonts = async () => {
    const bad = [];
    const was = page.viewportSize();
    let exempted = 0;
    const ev = async (label, fn, arg) => {
      try { return await page.evaluate(fn, arg); } catch (e) { bad.push(`${label}: threw ${e.message}`); return undefined; }
    };
    await defineAuditSeeds();
    await page.evaluate(() => {
      window.lookFontFindings = (root, lab) => {
        const look = document.documentElement.getAttribute('data-look');
        const first = (stack) => String(stack || '').split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
        /* The page is a file:// document, so its style sheets' rules cannot be
           read; the computed style of <html> lists every custom property and
           resolves each to the active look's value. The --font-* names are the
           look's fonts (css/app.css: the fonts are a look's, and
           check-look-tokens holds both looks to the same names); --print-font-*
           is print's own and does not match. */
        const rootCs = getComputedStyle(document.documentElement);
        const tokens = [...rootCs].filter(p => /^--font-/.test(p));
        if (!tokens.length) return { found: [`no --font-* tokens on <html> in the ${look} look, so nothing could be checked`], exempt: 0 };
        const allowed = new Set(tokens.map(t => first(rootCs.getPropertyValue(t))).filter(Boolean));
        const EMOJI_FONT = /emoji/i;
        const EMOJI_ONLY = /^[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u200d\ufe0f\u20e3\s]+$/u;
        const found = new Map();
        let exempt = 0;
        /* The look's figures too (Stage 3: Calm lines its figures up with
           tabular-nums, Pop draws them as the font does), read from the live
           --num-variant. Named exemption: the four figure columns that are
           tabular in BOTH looks by their own rule (.mm-xp-n, .co-tier-n,
           .pn-n, .pcw-day-n) — figures stacked in a column line up in Pop too. */
        const numVariant = rootCs.getPropertyValue('--num-variant').trim() || 'normal';
        const OWN_TABULAR = '.mm-xp-n, .co-tier-n, .pn-n, .pcw-day-n';
        const label = (el, text, where) => {
          const cls = (el.getAttribute('class') || '').trim().split(/\s+/)[0];
          const name = `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}${where}`;
          return `${name} "${text.replace(/\s+/g, ' ').slice(0, 24)}"`;
        };
        const judge = (el, cs, text, where) => {
          if (cs.fontVariantNumeric !== numVariant && !el.closest(OWN_TABULAR)) {
            const key = label(el, text, where) + ' figures';
            if (!found.has(key)) found.set(key, `${cs.fontVariantNumeric}, not the look's ${numVariant}`);
          }
          const fam = first(cs.fontFamily);
          if (allowed.has(fam)) return;
          if (EMOJI_ONLY.test(text) && EMOJI_FONT.test(fam)) { exempt++; return; }
          const key = label(el, text, where);
          if (!found.has(key)) found.set(key, cs.fontFamily.split(',')[0].trim());
        };
        root.querySelectorAll('*').forEach(el => {
          if (el.closest('.print-sheet')) return;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return;
          const box = el.getBoundingClientRect();
          if (!box.width || !box.height) return;
          const tag = el.tagName;
          let text = [...el.childNodes].filter(c => c.nodeType === 3).map(c => c.textContent).join('').trim();
          if (tag === 'INPUT' && !/^(checkbox|radio|range|color|hidden|file|image)$/i.test(el.type)) text = (el.value || el.placeholder || '').trim();
          else if (tag === 'TEXTAREA') text = (el.value || el.placeholder || '').trim();
          else if (tag === 'SELECT') text = (el.selectedOptions[0] ? el.selectedOptions[0].textContent : '').trim();
          else if (tag === 'OPTION' || tag === 'STYLE' || tag === 'SCRIPT') text = '';
          if (text) judge(el, cs, text, '');
          for (const pseudo of ['::before', '::after']) {
            const ps = getComputedStyle(el, pseudo);
            const m = /^"(.*)"$/.exec(ps.content || '');
            if (m && m[1].trim() && ps.display !== 'none') judge(el, ps, m[1].trim(), pseudo);
          }
        });
        return { found: [...found].map(([k, f]) => `${k} in ${f}`), exempt };
      };
    });
    const take = async (label, fn, arg) => {
      const r = await ev(label, fn, arg);
      if (!r) return;
      exempted += r.exempt;
      if (r.found.length) bad.push(`${label}: ${r.found.length} text(s) outside the look's fonts or figures: ${r.found.slice(0, 12).join(' · ')}${r.found.length > 12 ? ' …' : ''}`);
    };
    try {
      for (const look of ['pop', 'calm']) {
        try { if (look === 'pop') await clearLooks(); else await setLook(look); } catch (e) { bad.push(`the ${look} look could not be applied: ${e.message}`); continue; }
        for (const [w, h] of [[390, 844], [1194, 834]]) {
          await page.setViewportSize({ width: w, height: h });
          const where = (s) => `[${look}] ${s}@${w}`;
          for (const [id, nav, label] of KID_SCREENS) {
            const seeded = await ev(where(label || id), `(${nav.toString()})()`);
            if (typeof seeded === 'string') bad.push(`${where(label || id)}: ${seeded}`);
            await settle(200);
            await take(where(label || id), ([sid, lab]) => {
              const scr = document.getElementById(sid);
              if (!scr || !scr.classList.contains('active')) return { found: [`the screen was not on show, so nothing on it was measured`], exempt: 0 };
              return lookFontFindings(document.body, lab);
            }, [id, where(label || id)]);
          }
          for (const dest of ['now', 'meeting', 'history', 'setup', 'app']) {
            await ev(where(`Parent › ${dest}`), (d) => {
              profile = 'parent'; parentUnlockedThisSession = true; parentViewing = 'jenn';
              showScreen('parent'); renderParentHome(); setParentDest(d);
            }, dest);
            await settle(250);
            await take(where(`Parent › ${dest}`), (lab) => {
              if (!document.getElementById('screen-parent').classList.contains('active')) return { found: ['the portal was not on show, so nothing on it was measured'], exempt: 0 };
              return lookFontFindings(document.body, lab);
            }, where(`Parent › ${dest}`));
          }
          await ev(where('profile picker'), () => { showScreen('profile'); });
          await settle(250);
          await take(where('profile picker'), (lab) => document.getElementById('screen-profile').classList.contains('active')
            ? lookFontFindings(document.body, lab) : { found: ['the picker was not on show, so nothing on it was measured'], exempt: 0 }, where('profile picker'));
          /* The sheets: each opened on Jenn's Today, measured after its
             slide-in, then closed (and its seed put back). */
          const sheets = [
            ['⋯ More', 'tdMoreOverlay', () => { tdOpenMore(); }],
            ['block edit', 'editOverlay', () => {
              const k = todayKey();
              window.__fontHad = getDayBlocks(k, 'jenn');
              setDayBlocks(k, [...window.__fontHad.filter(b => b.id !== 'font-edit'),
                { id: 'font-edit', actId: 'piano', startMin: 16 * 60, durationMin: 60, checklistState: {} }], 'jenn');
              openDay(k, getDayKeys(0).indexOf(k)); openEditSheet('font-edit');
            }],
            ['📋 Copy a day', 'templateOverlay', () => { openDay(todayKey(), getDayKeys(0).indexOf(todayKey())); openTemplateSheet(); }],
            ['🌙 reflect', 'reflectOverlay', () => { openReflectSheet(todayKey()); }],
          ];
          for (const [name, ov, open] of sheets) {
            await ev(where(name), `(() => { profile = 'jenn'; parentViewing = 'jenn'; selectProfile('jenn'); goToday(); (${open.toString()})(); })()`);
            await settle(450);
            await take(where(name), ([o, lab]) => {
              const sheet = document.querySelector(`#${o}.open .sheet`);
              return sheet ? lookFontFindings(sheet, lab) : { found: ['the sheet did not open, so nothing on it was measured'], exempt: 0 };
            }, [ov, where(name)]);
            await ev(`${where(name)} close`, (o) => {
              if (document.getElementById(o).classList.contains('open')) closeSheet(o);
              if (window.__fontHad) { setDayBlocks(todayKey(), window.__fontHad, 'jenn'); window.__fontHad = null; }
            }, ov);
          }
        }
      }
    } finally {
      try { await clearLooks(); } catch (e) { bad.push('could not put Pop back: ' + e.message); }
      await ev('restore', () => { profile = 'jenn'; parentViewing = 'jenn'; selectProfile('jenn'); goToday(); });
      if (was) await page.setViewportSize(was);
      await page.waitForTimeout(200);
    }
    if (exempted) console.log(`everyTextUsesTheLooksFonts: ${exempted} emoji-only text(s) exempted (drawn in an emoji font)`);
    return bad;
  };
  if (want('everyTextUsesTheLooksFonts')) {
    walked = true;
    const bad = await everyTextUsesTheLooksFonts();
    checks.everyTextUsesTheLooksFonts = bad.length ? bad : true;
  }
  await unseedLooksChoreWeek(walked);
};
