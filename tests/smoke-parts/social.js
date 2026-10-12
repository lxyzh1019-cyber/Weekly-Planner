// Smoke group: Sister Sync and the profile screens on the component kit (Stage 41, owner answer G11). sisterSyncIsOnTheKit: the ◀ ▶ day arrows and the challenge ＋ and 🗑 are kit icon buttons, the section heads .ui-sect-head, every other button on the screen outside the header and the timeline a kit button (the invite answers included), every kit control at least 44×44, no old button class (.btn-icon, .pill-btn, .week-nav) and no inline style except the timeline's drawn-to-scale geometry, a challenge bar's width and a script's show / hide (display). theProfileScreensAreOnTheKit: the picker keeps its private cards (each at least 44×44) with no inline style on the screen but a script's show / hide; the profile switcher's four rows are kit rows (.ui-row with its icon and name slots, at least 44px high), the profile on screen the one aria-current row, none of the old .profile-switch-opt, .ps-emoji, .ps-name, .ps-check, .ps-more left. Both at 1194×834 and 390×844, in Pop and in Calm. tests/smoke.js calls it near the end of the run, on its one shared page; it seeds Sister Sync as the house-rules sweep does (both sisters' day, a waiting and a missed invite) plus a challenge, and puts back the blocks, invites, challenges, profile, look and size.
module.exports = async ({ page, want, checks, setLook, clearLooks }) => {
  const sync = want('sisterSyncIsOnTheKit');
  const prof = want('theProfileScreensAreOnTheKit');
  if (!sync && !prof) return;
  const before = page.viewportSize();
  const syncBad = [], profBad = [];
  const was = await page.evaluate(() => ({ profile, unlocked: parentUnlockedThisSession }));
  try {
    for (const look of ['pop', 'calm']) {
      await setLook(look);
      for (const [w, h, size] of [[1194, 834, 'iPad'], [390, 844, 'phone']]) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(100);
        const got = await page.evaluate(async ([look, size, sync, prof]) => {
          const tag = `${look} ${size}`;
          const s = [], p = [];
          const wait = (ms) => new Promise(r => setTimeout(r, ms));
          const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
          const name = (b) => (b.getAttribute('aria-label') || b.textContent).trim().replace(/\s+/g, ' ').slice(0, 40);
          const small = (out, where, b) => {
            const r = b.getBoundingClientRect();
            if (r.width < 43.5 || r.height < 43.5) out.push(`${tag} ${where}: "${name(b)}" is ${Math.round(r.width)}×${Math.round(r.height)}, under 44px`);
          };
          const isKit = (b) => b.matches('.ui-btn, .ui-chip, .ui-row, .ui-tabs > button, .ui-kids > button, .ui-stepper > button');
          if (sync) {
            const wasProfile = profile;
            if (isParent()) profile = 'jenn';
            const me = activeProfile();
            const sis = me === 'jenn' ? 'jess' : 'jenn';
            const key = todayKey();
            const had = [[me, (getDayBlocks(key, me) || []).slice()], [sis, (getDayBlocks(key, sis) || []).slice()]];
            const hadInvites = state.shared.invites, hadChallenges = state.shared.challenges;
            try {
              setDayBlocks(key, [{ id: 's41-a', actId: 'reading', startMin: 16 * 60, durationMin: 90 }], me);
              setDayBlocks(key, [{ id: 's41-b', actId: 'piano', startMin: 16 * 60, durationMin: 60, public: true }], sis);
              state.shared.invites = [
                { id: 's41-inv', from: sis, to: me, status: 'pending', day: key,
                  actId: 'piano', startMin: 20 * 60, durationMin: 60, sourceBlockId: 's41-src' },
                { id: 's41-old', from: sis, to: me, status: 'pending', day: dayKeyBefore(key),
                  actId: 'reading', startMin: 17 * 60, durationMin: 60, sourceBlockId: 's41-src2' },
              ];
              state.shared.challenges = [{ id: 's41-ch', title: 'Read together', activityId: 'reading', target: 3, who: 'both',
                weekStart: dateToLocalKey(getWeekStart(weekOffset)) }];
              openSisterSync(); await wait(80);
              const scr = document.getElementById('screen-sync');
              if (!scr.classList.contains('active')) s.push(`${tag}: Sister Sync did not open, so nothing was measured`);
              else {
                const arrows = [...scr.querySelectorAll('.sync-day-nav > button')];
                if (arrows.length !== 2) s.push(`${tag}: ${arrows.length} day arrows, want ◀ and ▶`);
                arrows.forEach(b => { if (!b.matches('.ui-btn.ui-btn--icon')) s.push(`${tag}: the day arrow "${name(b)}" is not a kit icon button (.ui-btn.ui-btn--icon): "${b.className}"`); });
                const add = scr.querySelector('[onclick^="openNewChallenge"]');
                if (!add || !add.matches('.ui-btn.ui-btn--icon')) s.push(`${tag}: the challenge ＋ is not a kit icon button`);
                const bins = [...scr.querySelectorAll('#challengesList [onclick^="deleteChallenge"]')];
                if (!bins.length) s.push(`${tag}: no challenge 🗑 drawn, so none was measured`);
                bins.forEach(b => { if (!b.matches('.ui-btn.ui-btn--icon')) s.push(`${tag}: the challenge 🗑 is not a kit icon button: "${b.className}"`); });
                const answers = [...scr.querySelectorAll('#invitesList button')];
                if (answers.length < 4) s.push(`${tag}: ${answers.length} invite answers drawn, want a waiting invite's two and a missed one's two`);
                const heads = [...scr.querySelectorAll('.sync-sect h3')];
                if (heads.length !== 2) s.push(`${tag}: ${heads.length} section heads, want Challenges and Invites`);
                heads.forEach(hd => { if (!hd.classList.contains('ui-sect-head')) s.push(`${tag}: the head "${name(hd)}" is not .ui-sect-head`); });
                // Every button outside the header and the private timeline is a kit part.
                const btns = [...scr.querySelectorAll('button')].filter(b => !b.closest('.hdr') && !b.closest('#syncGrid') && shown(b));
                btns.forEach(b => {
                  if (!isKit(b)) s.push(`${tag}: "${name(b)}" is not a kit button: "${b.className}"`);
                  else small(s, 'Sister Sync', b);
                });
                const old = scr.querySelectorAll('.btn-icon, .pill-btn, .week-nav');
                if (old.length) s.push(`${tag}: ${old.length} old part(s) left (.btn-icon, .pill-btn, .week-nav): ${[...old].map(e => e.className).join(' | ')}`);
                // No inline style but the timeline's geometry, a challenge bar's width and a script's show / hide.
                [scr, ...scr.querySelectorAll('[style]')].filter(e => e.hasAttribute('style')).forEach(e => {
                  if (e.closest('#syncGrid')) return;
                  const props = [...e.style].filter(x => x !== 'display' && !(e.matches('.challenge-fill') && x === 'width'));
                  if (props.length) s.push(`${tag}: inline style on <${e.tagName.toLowerCase()} class="${e.className}">: ${props.join(', ')}`);
                });
              }
            } finally {
              had.forEach(([who, blocks]) => setDayBlocks(key, blocks, who));
              state.shared.invites = hadInvites; state.shared.challenges = hadChallenges;
              profile = wasProfile;
            }
          }
          if (prof) {
            showScreen('profile'); await wait(60);
            const scr = document.getElementById('screen-profile');
            if (!scr.classList.contains('active')) p.push(`${tag}: the profile picker did not open`);
            const cards = [...scr.querySelectorAll('.profile-card')].filter(shown);
            if (cards.length !== 3) p.push(`${tag}: ${cards.length} profile cards on show, want 3`);
            cards.forEach(b => small(p, 'the picker', b));
            // A script's show / hide (js/03-sync.js hides the debug line) is state, not a style.
            [scr, ...scr.querySelectorAll('[style]')].filter(e => e.hasAttribute('style')).forEach(e => {
              const props = [...e.style].filter(x => x !== 'display');
              if (props.length) p.push(`${tag}: inline style on the picker's <${e.tagName.toLowerCase()} class="${e.className}">: ${props.join(', ')}`);
            });
            if (isParent()) profile = 'jenn';
            showScreen('today');
            openProfileSwitcher(); await wait(300);
            const ov = document.getElementById('profileSwitchOverlay');
            if (!ov.classList.contains('open')) p.push(`${tag}: the profile switcher did not open`);
            const rows = [...document.querySelectorAll('#profileSwitchBody > button')];
            if (rows.length !== 4) p.push(`${tag}: ${rows.length} switcher rows, want Jenn, Jess, Parent Mode and Full profile screen`);
            rows.forEach(b => {
              if (!b.classList.contains('ui-row')) p.push(`${tag}: the switcher row "${name(b)}" is not a kit row (.ui-row): "${b.className}"`);
              if (!b.querySelector(':scope > .ui-row-icon') || !b.querySelector(':scope > .ui-row-name')) p.push(`${tag}: the switcher row "${name(b)}" has no .ui-row-icon and .ui-row-name slots`);
              const r = b.getBoundingClientRect();
              if (r.height < 43.5) p.push(`${tag}: the switcher row "${name(b)}" is ${Math.round(r.height)}px high, under 44`);
            });
            const cur = rows.filter(b => b.getAttribute('aria-current') === 'true');
            if (cur.length !== 1 || !/Jenn|Jess/.test(cur[0] ? cur[0].textContent : '')) p.push(`${tag}: ${cur.length} switcher rows are aria-current, want hers alone`);
            const old = ov.querySelectorAll('.profile-switch-opt, .ps-emoji, .ps-name, .ps-check, .ps-more');
            if (old.length) p.push(`${tag}: ${old.length} old switcher part(s) left (.profile-switch-opt, .ps-emoji, .ps-name, .ps-check, .ps-more)`);
            ov.querySelectorAll('[style]').forEach(e => p.push(`${tag}: inline style in the switcher on <${e.tagName.toLowerCase()} class="${e.className}">`));
            closeSheet('profileSwitchOverlay'); await wait(60);
          }
          return { s, p };
        }, [look, size, sync, prof]);
        syncBad.push(...got.s); profBad.push(...got.p);
      }
    }
  } finally {
    await page.setViewportSize(before);
    await clearLooks();
    await page.evaluate((was) => { profile = was.profile; parentUnlockedThisSession = was.unlocked; goToday(); }, was);
  }
  if (sync) {
    checks.sisterSyncIsOnTheKit = syncBad.length ? [...new Set(syncBad)] : true;
  }
  if (prof) {
    checks.theProfileScreensAreOnTheKit = profBad.length ? [...new Set(profBad)] : true;
  }
};
