// Smoke group: the money screens (noLabelIsCutOnTheMoneyScreens, everyMoneyControlClicksClean, theSundayKitHolds44pxInItsBoxes, theSundayChooseRowFitsTwoRows). Moved out of tests/smoke.js (Stage 23) so one worker can edit this group alone; since PR 14 the fit check puts back its own copy of the state it found before every row, not the shared snapshots; tests/smoke.js calls it at the same point in the run, on its one shared page, with the helpers it names.
async function moneyFit({ page, want, checks, setLook, clearLooks, MV2_SEED_SRC, KID_SCREENS, KID_SHEETS }) {
  /* ✂️ The money fit check (Plan v6 §M 5a, grown by Money fit and logic PR 5).
     Every money screen and sheet — My money, Money school, All my Sundays, By
     month, her request and info sheets (the Sunday sheet among them), the '?'
     card, Sunday's four steps and Grown-ups' six tabs — in both looks, at the
     phone (390×844) and the iPad (1194×834), after the look's fonts load; then
     again seeded with long names (12+ letters) and 4-digit amounts
     (window.__fitLong). Three rules for every visible text:
       clip    — its box is no narrower than its text (scrollWidth ≤ clientWidth+1,
                 with or without "…");
       spill   — it stays inside its nearest bordered box (1px allowed), and
                 nothing runs past the screen's left or right edge;
       overlap — no two texts sit on each other (1px allowed).
     A scroll container (Calm's .mm-body, a sheet) may scroll: text scrolled
     out of its view is not measured, and its own overflow is not a clip. */
  if (want('noLabelIsCutOnTheMoneyScreens')) {
    const fitFindings = [];
    const fitMeasure = (rootId) => {
      const host = document.getElementById(rootId);
      if (!host) return ['no element #' + rootId];
      /* The money roots are found by their attribute, not a list (PR 1 money
         re-check): the row's element when it is one, else every outermost
         [data-money-surface] on show inside it — My money and its head, Money
         school, All my Sundays, By month, the meeting's head and Sunday step,
         Grown-ups, Parent › Now and the money sheets. A screen with none fails.
         The '?' explainer is not a money surface; it is measured as itself. */
      const SURFACE = '[data-money-surface]';
      const roots = host.matches(SURFACE) ? [host]
        : [...host.querySelectorAll(SURFACE)].filter(el => el.getClientRects().length && !el.parentElement.closest(SURFACE));
      if (!roots.length && rootId !== 'mnyConceptCard') return ['no money surface ([data-money-surface]) on show in #' + rootId];
      if (!roots.length) roots.push(host);
      const vw = document.documentElement.clientWidth;
      const out = new Set();
      const css = new Map();
      const cs = (el) => { let c = css.get(el); if (!c) { c = getComputedStyle(el); css.set(el, c); } return c; };
      const name = (el) => el.tagName.toLowerCase() + [...el.classList].slice(0, 2).map(c => '.' + c).join('');
      const scrolls = (el) => /auto|scroll/.test(cs(el).overflowX + ' ' + cs(el).overflowY);
      const borders = (c) => ['Top', 'Right', 'Bottom', 'Left'].map(s => (c['border' + s + 'Style'] === 'none' ? 0 : parseFloat(c['border' + s + 'Width']) || 0));
      // A box has a border on all four sides; a single rule (a dashed line, a head's underline) is not one.
      const boxed = (c) => borders(c).every(v => v > 0);
      /* Lines from every root on show are compared with each other: a screen's
         head and its body are separate money roots, and a head drawn over the
         body is still an overlap. */
      const lines = [];
      for (const root of roots) {
        const shown = (el) => {
          for (let e = el; e; e = e.parentElement) {
            const c = cs(e);
            if (c.display === 'none' || c.visibility === 'hidden' || c.opacity === '0') return false;
            if (e === root) break;
          }
          return true;
        };
        const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n; (n = tw.nextNode());) {
          const text = n.textContent.replace(/\s+/g, ' ').trim();
          if (!text) continue;
          const el = n.parentElement;
          if (!el || el.closest('svg, script, style, noscript, template') || !shown(el)) continue;
          if (cs(el).position === 'absolute' && el.getBoundingClientRect().width <= 1) continue;   // screen-reader only
          const range = document.createRange(); range.selectNodeContents(n);
          /* A text's box is its line, not the font's whole ascent and descent:
             Pop's handwriting fonts reach well past a tight line-height, which
             draws nothing over the line above. */
          const ec = cs(el), lh = parseFloat(ec.lineHeight) || parseFloat(ec.fontSize) * 1.2;
          let rects = [...range.getClientRects()].filter(r => r.width > 0.5 && r.height > 0.5).map(r => {
            const trim = Math.max(0, (r.height - lh) / 2);
            return { left: r.left, right: r.right, top: r.top + trim, bottom: r.bottom - trim };
          });
          if (!rects.length) continue;
          let block = null, bordered = null, scroller = null;
          const ruled = [];
          for (let e = el; e; e = e.parentElement) {
            const c = cs(e);
            if (!bordered && !scroller && borders(c).some(v => v > 0)) ruled.push(e);
            if (!block && c.display !== 'inline' && c.display !== 'contents') block = e;
            if (!bordered && !scroller && boxed(c)) bordered = e;
            if (!scroller && scrolls(e) && e !== document.documentElement && e !== document.body) scroller = e;
            if (e === root || (bordered && scroller)) break;
          }
          /* Text a scroll container has scrolled out of view is still measured
             against its own boxes; it is only not compared with text outside
             that container, which it passes under as it scrolls. */
          const view = scroller && scroller.getBoundingClientRect();
          const inView = (r) => !view || (r.right > view.left && r.left < view.right && r.bottom > view.top && r.top < view.bottom);
          const tag = `${name(el)} "${text.slice(0, 32)}"`;
          // Cut: the box is narrower than its text, and it is this text that runs past it.
          const bx = block && block.getBoundingClientRect();
          if (block && !scrolls(block) && block.clientWidth > 0 && block.scrollWidth > block.clientWidth + 1
              && rects.some(r => r.right > bx.left + block.clientLeft + block.clientWidth + 1 || r.left < bx.left + block.clientLeft - 1)) {
            out.add(`clip · ${block === el ? tag : name(block) + ' › ' + tag} (${block.scrollWidth} > ${block.clientWidth})`);
          }
          if (bordered) {
            const b = bordered.getBoundingClientRect(), [bt, br, bb, bl] = borders(cs(bordered));
            const inner = { left: b.left + bl, right: b.right - br, top: b.top + bt, bottom: b.bottom - bb };
            if (rects.some(r => r.left < inner.left - 1 || r.right > inner.right + 1 || r.top < inner.top - 1 || r.bottom > inner.bottom + 1)) {
              out.add(`spill · ${tag} out of ${name(bordered)}`);
            }
          }
          // Nor may it sit on a line drawn by a box or rule around it.
          ruled.forEach(e => {
            const b = e.getBoundingClientRect(), [bt, br, bb, bl] = borders(cs(e));
            const strips = [bt && { left: b.left, right: b.right, top: b.top, bottom: b.top + bt }, br && { left: b.right - br, right: b.right, top: b.top, bottom: b.bottom },
              bb && { left: b.left, right: b.right, top: b.bottom - bb, bottom: b.bottom }, bl && { left: b.left, right: b.left + bl, top: b.top, bottom: b.bottom }].filter(Boolean);
            if (rects.some(r => strips.some(t => Math.min(r.right, t.right) - Math.max(r.left, t.left) > 1 && Math.min(r.bottom, t.bottom) - Math.max(r.top, t.top) > 1))) {
              out.add(`spill · ${tag} on the border of ${name(e)}`);
            }
          });
          // Past the screen's side: only the part a scroll container shows counts.
          const shownPart = (r) => (view ? { left: Math.max(r.left, view.left), right: Math.min(r.right, view.right) } : r);
          if (rects.some(r => inView(r) && (shownPart(r).right > vw + 1 || shownPart(r).left < -1))) out.add(`spill · ${tag} past the screen edge`);
          rects.forEach(r => lines.push({ r, tag, n, scroller, seen: inView(r) }));
        }
        // A bordered box past the screen's side (a card edge peeking in or out).
        root.querySelectorAll('*').forEach(el => {
          if (!shown(el) || !boxed(cs(el))) return;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return;
          for (let e = el.parentElement; e && e !== root; e = e.parentElement) if (/auto|scroll|hidden|clip/.test(cs(e).overflowX)) return;
          if (r.right > vw + 1 || r.left < -1) out.add(`spill · ${name(el)} box past the screen edge (${Math.round(r.left)} to ${Math.round(r.right)})`);
          /* A box laid out in the flow stays inside the box around it (a sticker
             placed on purpose is position:absolute and is not held to this). */
          if (/absolute|fixed/.test(cs(el).position)) return;
          for (let e = el.parentElement; e && root.contains(e); e = e.parentElement) {
            if (boxed(cs(e))) {
              const p = e.getBoundingClientRect(), [pt, pr, pb, pl] = borders(cs(e));
              if (r.left < p.left + pl - 1 || r.right > p.right - pr + 1) out.add(`spill · ${name(el)} box in ${name(el.parentElement)} "${el.textContent.trim().slice(0, 20)}" out of ${name(e)} (${Math.round(r.left)} to ${Math.round(r.right)} past ${Math.round(p.right - pr)})`);
              break;
            }
            if (scrolls(e)) break;
          }
        });
      }
      for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < lines.length; j++) {
          const a = lines[i], b = lines[j];
          if (a.n === b.n || (a.scroller !== b.scroller && !(a.seen && b.seen))) continue;
          const ix = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
          const iy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
          if (ix > 1 && iy > 1) out.add(`overlap · ${a.tag} × ${b.tag}`);
        }
      }
      return [...out];
    };
    /* The group's own starting point (PR 14). The state it finds is copied
       once, and every row, the Grown-ups block and the end put that copy back:
       no row reads what the row before it left, and nothing is restored from
       the shared window.__mv2Snap / __sdSweepSnap an earlier check may have
       left behind. The rows still set those two (KID_SHEETS and MV2_HOLD are
       shared with the house-rules walk); here they are only cleared. The
       measure, the reset and the settle are put on the page once, so each row
       costs two round trips. */
    await page.evaluate(`(() => {
      window.__moneyFitBase = JSON.stringify(state);
      window.__moneyFitMeasure = ${fitMeasure.toString()};
      window.__moneyFitReset = () => {
        const o = document.getElementById('requestOverlay'); if (o && o.classList.contains('open')) rqClose();
        const idea = document.getElementById('mnyConceptCard'); if (idea) idea.remove();
        const s = JSON.parse(window.__moneyFitBase);
        Object.keys(state).forEach(k => { delete state[k]; }); Object.assign(state, s);
        mmUndoKid = {}; mmUndoKidGone = {}; sdDrafts = {}; sdOpened = {};
        window.__mv2Snap = null; window.__sdSweepSnap = null; window.__sdSweepProfile = null;
        saveLocal();
        if (mmIsOpen()) mmHide();
        const sdo = document.getElementById('sundayOverlay'); if (sdo && sdo.classList.contains('open')) closeSheet('sundayOverlay');
        profile = 'jenn';   // her screens, as she sees them (Grown-ups' rows leave the parent signed in)
      };
      /* In place of a fixed 200 ms: two frames (layout, and anything a render
         left for requestAnimationFrame), the fonts the new text asked for, and
         the overlay's fade and the sheet's slide run to their end — each moves
         or fades the whole sheet at once, so no clip, spill or overlap differs
         between their frames. Any other animation still running (Sunday's
         coin, stamp and burst, a transition) keeps the old 200 ms from the end of the drawing, so
         those rows are measured on the same frame as before. */
      window.__moneyFitSettle = async () => {
        const t0 = performance.now();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        await document.fonts.ready;
        let other = false;
        document.getAnimations().forEach(a => {
          if (a.playState !== 'running' || !a.effect || !isFinite(a.effect.getComputedTiming().endTime)) return;
          if (a.animationName === 'fadeIn' || a.animationName === 'slideUp') a.finish(); else other = true;
        });
        const left = 200 - (performance.now() - t0);
        if (other && left > 0) await new Promise(r => setTimeout(r, left));
      };
    })()`);
    const MV2_HOLD = `${MV2_SEED_SRC}
      window.__mv2Snap = window.__mv2Snap || JSON.stringify(state);
      const said = window.mv2Seed('jenn');`;
    const FIT_KID_ROWS = [
      ...KID_SCREENS.filter(r => /^screen-(mymoney\/seeded|moneyschool\/seeded|moneystory\/(sundays|bymonth))$/.test(String(r[2] || ''))),
      ...KID_SHEETS,
      // A grown-up's My money: the head carries the whole rail.
      ['screen-mymoney', `() => { profile = 'parent'; parentUnlockedThisSession = true; mnyOpenMyMoney('jenn'); }`, 'screen-mymoney/parent'],
      // Her info sheets over My money, the 📒 Sunday sheet among them.
      ...['week', 'loans', 'waiting', 'goals', 'month', 'sunday'].map(kind => ['requestOverlay', `() => {
        ${MV2_HOLD}
        const row = mnyLedgerRows('jenn')[0];
        mnyOpenInfoSheet('${kind}', '${kind}' === 'sunday' ? { id: row && row.weekKey } : {});
        if (!document.getElementById('requestOverlay').classList.contains('open')) return 'the ${kind} info sheet did not open';
        return said;
      }`, 'info/' + kind]),
    ];
    const GU_TABS = ['approve', 'commit', 'fines', 'expect', 'rules', 'weeks'];
    for (const long of [false, true]) {
      await page.evaluate((l) => { window.__fitLong = l; }, long);
      const pass = long ? 'long' : 'short';
      for (const look of ['pop', 'calm']) {
        try { await setLook(look); } catch (e) { fitFindings.push(`[${look}] the look could not be applied: ${e.message}`); continue; }
        for (const [w, h] of [[390, 844], [1194, 834]]) {
          await page.setViewportSize({ width: w, height: h });
          for (const [id, nav, label] of FIT_KID_ROWS) {
            // Her request sheets over a My money with long names in the long pass.
            const hold = long && /^sheet\//.test(String(label)) ? `{ ${MV2_HOLD} }` : '';
            const said = await page.evaluate(`(async () => {
              window.__moneyFitReset();
              ${hold}
              const said = (${nav.toString()})();
              await window.__moneyFitSettle();
              return said;
            })()`);
            const where = `${label || id} · ${look} · ${w} · ${pass}`;
            if (typeof said === 'string') { fitFindings.push(`${where} · ${said}`); continue; }
            const found = await page.evaluate((sid) => {
              const el = document.getElementById(sid);
              const on = !!el && (el.classList.contains('active') || el.classList.contains('open') || el.classList.contains('mny-concept-scrim'));
              return on ? window.__moneyFitMeasure(sid) : null;
            }, id);
            if (!found) { fitFindings.push(`${where} · the screen was not on show`); continue; }
            found.forEach(f => fitFindings.push(`${where} · ${f}`));
          }
          // Grown-ups' six tabs over a seeded week: questions, fines, a loan, money expected.
          await page.evaluate((L) => {
            window.__moneyFitReset();
            const was = profile, wasToast = window.showToast; window.showToast = () => {};
            try {
              const wk = ctThisWeekKey(), days = mrWeekDayKeys(wk);
              profile = 'parent';
              if (L) Object.assign(mnyEnsureDebts('jenn')[0], { name: 'Winter skating camp', principal: 1454.56, paid: 220 });
              mrAddFine('jess', 'tone', days[1], { who: 'Mom' });
              mrAddFine('jess', 'box_repeat', days[2], { who: 'Dad' });
              const fine = mrFines('jess')[mrFines('jess').length - 1];
              mnyAddExpected('jenn', { month: String(todayKey()).slice(0, 7), label: L ? '🎄 Grandma Rosalind' : '🎄 Christmas', amount: L ? 1050 : 20 });
              profile = 'jess';
              mnyAddRequest('jess', { kind: 'comp', sport: 'swim', name: L ? 'Championship entries' : 'Swim time trial', custom: true, dayKey: days[2],
                races: [{ ev: '50 Free', time: '0:41.8', pts: 6 }] });
              mnyAddRequest('jess', { kind: 'dispute', fineId: fine.id, why: 'the bag was not mine' });
              profile = 'jenn';
              mnyAddRequest('jenn', { kind: 'gift', amount: L ? 1050 : 20, giver: L ? 'Grandma Rosalind' : 'Uncle Mike' });
              mnyAddRequest('jenn', { kind: 'goal', name: L ? 'Winter skating camp' : 'New skate guards', icon: '🛼', target: L ? 1050 : 35 });
            } finally { profile = was; window.showToast = wasToast; }
          }, long);
          for (const tab of GU_TABS) {
            const found = await page.evaluate(async (t) => {
              profile = 'parent'; parentUnlockedThisSession = true; parentViewing = 'jenn';
              showScreen('parent'); renderParentHome(); setParentTab('money'); mnyParentSection = t; mnyRenderRulesTab();
              await window.__moneyFitSettle();
              return window.__moneyFitMeasure('screen-parent');
            }, tab);
            found.forEach(f => fitFindings.push(`Grown-ups › ${tab} · ${look} · ${w} · ${pass} · ${f}`));
          }
          // Parent › Now over the same seeded week: its money cards are a money surface too.
          const now = await page.evaluate(async () => {
            profile = 'parent'; parentUnlockedThisSession = true; parentViewing = 'jenn';
            showScreen('parent'); renderParentHome(); setParentTab('now');
            await window.__moneyFitSettle();
            return window.__moneyFitMeasure('screen-parent');
          });
          now.forEach(f => fitFindings.push(`Parent › Now · ${look} · ${w} · ${pass} · ${f}`));
          await page.evaluate(() => { window.__moneyFitReset(); mnyParentSection = 'approve'; });
        }
      }
    }
    await page.evaluate(() => {
      window.__fitLong = false;
      ['__moneyFitBase', '__moneyFitMeasure', '__moneyFitReset', '__moneyFitSettle'].forEach(k => { delete window[k]; });
    });
    await clearLooks();
    await page.evaluate(() => { profile = 'jenn'; parentViewing = 'jenn'; selectProfile('jenn'); goToday(); });
    await page.setViewportSize({ width: 900, height: 1100 });
    if (fitFindings.length) console.log(`Money fit findings (${fitFindings.length}):\n  ${fitFindings.join('\n  ')}`);
    checks.noLabelIsCutOnTheMoneyScreens = fitFindings.length === 0 || fitFindings;
  }
}

async function moneyClicks({ page, want, checks }) {
  /* ── EVERY MONEY CONTROL CAN BE PRESSED ───────────────────────────
     Two buttons on the parent's Money rules page were dead for as long as the
     page existed, and a whole class of move could be filed and never answered.
     Every check in this file drove the FUNCTIONS; none pressed the buttons, so a
     button wired to nothing — or to something that throws — was invisible.

     This presses every one. Each money surface is rendered as the person who
     uses it (the three kid pages as a child; every Money rules section, the
     meeting's money step and all five Record forms as a grown-up; the two
     Record forms a child is offered, as a child). Every button and every
     data-action control is clicked ONE AT A TIME, with `state`, the device's
     view preferences and the surface's own module state put back from a
     snapshot and the surface drawn afresh before each, so a click is measured
     against the page a person would actually have in front of them — not
     against the wreckage of the click before it.

     The app's dialogs are stubbed to answer "no", so nothing a confirm guards
     is ever committed. A failure is any exception, thrown during the click or
     afterwards from a promise, named by surface and by the control's label.
     No fixed sleeps: two macrotask turns after each click is what lets a
     promise-chained handler finish, and nothing here waits on a clock.

     Exceptions are caught HERE, from `pageerror`, not by a listener in the
     page: over file:// Chrome mutes a script's errors to "Script error." and
     does not fire `unhandledrejection` at all. Before each control the page
     names it with a console.debug line; the protocol delivers console lines
     and exceptions in the order the page produced them, so every error
     arrives between two names and is filed under the right one. (A binding
     the page awaited did the same at ~16ms a round trip — a fifth of the
     budget, spent on bookkeeping.) */
  const moneySweep = { at: null, found: [], started: Date.now() };
  const MONEY_SWEEP_AT = 'money-sweep-at:';
  const moneySweepConsole = (m) => {
    const t = m.text();
    if (t.indexOf(MONEY_SWEEP_AT) === 0) moneySweep.at = t.slice(MONEY_SWEEP_AT.length) || null;
  };
  const moneySweepError = (e) => {
    if (moneySweep.at) moneySweep.found.push(moneySweep.at + ': threw ' + ((e && e.message) || e));
  };
  page.on('console', moneySweepConsole);
  page.on('pageerror', moneySweepError);
  if (want('everyMoneyControlClicksClean')) checks.everyMoneyControlClicksClean = await page.evaluate(async () => {
    const problems = [];
    const t0 = performance.now();
    const at = (label) => { console.debug('money-sweep-at:' + (label || '')); };
    const snapState = JSON.stringify(state);
    const snapLS = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== LS_KEY) snapLS[k] = localStorage.getItem(k);
    }
    const was = {
      profile, parentViewing, parentScope, ctParentKid, mnyKid, mnyParentSection, mnyMeetKid,
      _appDialog: window._appDialog, showChoice: window.showChoice, open: window.open,
    };
    let current = 'before any click';
    window._appDialog = (o) => Promise.resolve(o && o.kind === 'prompt' ? null : false);
    window.showChoice = () => Promise.resolve(null);
    window.open = () => null;

    const restore = () => {
      if (document.getElementById('mnyTour')) mnyCloseTour();
      const card = document.getElementById('mnyConceptCard');
      if (card) card.remove();
      if (rcDraft) closeRecordSheet();
      if (rqDraft) rqClose();
      guCommitDraft = null; guFineDraft = null; guOneOffDraft = null;
      document.querySelectorAll('.overlay.open').forEach(ov => closeSheet(ov.id));
      if (mmIsOpen()) mmHide();
      const s = JSON.parse(snapState);
      Object.keys(state).forEach(k => { delete state[k]; });
      Object.assign(state, s);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k !== LS_KEY && !(k in snapLS)) localStorage.removeItem(k);
      }
      Object.entries(snapLS).forEach(([k, v]) => { if (localStorage.getItem(k) !== v) localStorage.setItem(k, v); });
      mnyPending = []; mnyPendingFrom = null; mnyPendingReason = MR_DEFAULT_REASON;
      guSheet = null; guOvOpen = {}; guWeekOpen = null; guWeeksKid = 'jenn'; guRuleReason = 'grownups';
      flPeriod = 'month'; flMonth = null;
      mnySundaysMode = 'week'; mnySundaysMonth = null; mnyHistPage = 'sundays'; mnySchoolConcept = 'debt'; navReturnStack = [];
      // The meeting's money drafts, as mnySetMeetKid('jenn') would leave them —
      // set here rather than by calling it, which would draw the meeting a
      // third time per click and put this sweep past its budget.
      mnyMeetKid = 'jenn'; mnyExpandRow = null;
      // The Sunday ritual's drafts and timers (js/44), device-local.
      // sdNudgeUntil too: the "place $X first" shake runs 1.4 s of real time, so a
      // press of the sign on one drawing still showed on the next surface's first
      // drawing on a fast runner and was gone by its second (CI, 2026-10-01 and -07).
      clearInterval(sdCountTimer); sdDrafts = {}; sdOpened = {}; sdPress = null; sdSignHold = null; sdNudgeUntil = 0;
    };
    const as = (who) => {
      profile = who; parentViewing = 'jenn'; ctParentKid = 'jenn'; mnyKid = 'jenn';
      if (who === 'parent') parentScope = 'jenn';
    };
    /* Drawn afresh every time; the portal around it is only re-entered when a
       click has left it, because re-entering it is most of what a click costs. */
    const rules = () => {
      const sp = document.getElementById('screen-parent');
      if (!(sp && sp.classList.contains('active') && parentTab === 'money')) { showScreen('parent'); setParentTab('money'); }
      mnyRenderRulesTab();
    };
    const surfaces = [
      { name: 'My money (child)', as: 'jenn', host: 'mnyPage1Wrap', open: () => mnyOpenMyMoney('jenn') },
      { name: 'All my Sundays (child)', as: 'jenn', host: 'mnyStoryWrap', open: () => mnyOpenSundays() },
      { name: 'By month (child)', as: 'jenn', host: 'mnyStoryWrap', open: () => mnyOpenByMonth() },
      { name: 'Money school (child)', as: 'jenn', host: 'mnySchoolWrap', open: () => mnyOpenSchool('jenn') },
      { name: 'Meeting › the money', as: 'parent', host: 'screen-meeting',
        open: () => { openFamilyMeeting(); mmGoStep(3); } },
      // Sunday v15's four steps (js/44), each drawn from a seeded draft.
      ...[1, 2, 3].map(step => ({ name: 'Meeting › Sunday step ' + (step + 1), as: 'parent', host: 'screen-meeting',
        open: () => {
          openFamilyMeeting(); mnyMeetKid = 'jenn'; mmGoTo('money');
          const d = sdCur(); d.step = step; d.shown = 6; d.guess = 40;
          if (step === 3) d.signed = null;
          renderMeetingMode();
        } })),
      ...RC_KINDS.map(k => ({ name: 'Record › ' + k.label + ' (grown-up)', as: 'parent', host: 'recordOverlay',
        open: () => openRecordSheet({ kind: k.id, kid: 'jenn' }) })),
      ...RC_KINDS.filter(k => k.kid).map(k => ({ name: 'Record › ' + k.label + ' (child)', as: 'jenn', host: 'recordOverlay',
        open: () => openRecordSheet({ kind: k.id, kid: 'jenn' }) })),
      // Grown-ups' five tabs (js/46) and her request sheets (js/45).
      ...GU_TABS.map(t => ({ name: 'Grown-ups › ' + t.label, as: 'parent', host: 'mnyRulesWrap',
        open: () => { mnyParentSection = t.id; rules(); } })),
      // The fix sheets (Stage 4b): a loan row, what she owns, every rule change.
      { name: 'Grown-ups › ✏️ Fix this row', as: 'parent', host: 'grownupsOverlay',
        open: () => { rules(); guOpenSheet('loan', 'jenn', (mnyEnsureDebts('jenn')[0] || {}).id); } },
      { name: 'Grown-ups › ✏️ Fix what she owns', as: 'parent', host: 'grownupsOverlay',
        open: () => { rules(); guOpenSheet('owns', 'jenn'); } },
      { name: 'Grown-ups › 📝 Every rule change', as: 'parent', host: 'grownupsOverlay',
        open: () => { rules(); guOpenSheet('log'); } },
      ...['result', 'club', 'move', 'adv', 'goal', 'list'].map(kind => ({ name: 'Request sheet › ' + kind + ' (child)', as: 'jenn',
        host: 'requestOverlay', open: () => mnyOpenRequestSheet(kind, { kid: 'jenn' }) })),
    ];
    const SEL = 'button, [data-mny-action], [data-mnyp-action], [data-rc-action]';
    const text = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ');
    const sig = (el) => [el.tagName, el.getAttribute('data-mny-action'), el.getAttribute('data-mnyp-action'),
      el.getAttribute('data-rc-action'), el.getAttribute('data-mnyp-id'), el.getAttribute('data-rc-id'),
      el.getAttribute('data-mnyp-path'), el.getAttribute('data-mnyp-d'), el.getAttribute('onclick'),
      text(el).slice(0, 60)].join('|');
    const label = (el) => (el.getAttribute('aria-label') || text(el) || el.getAttribute('placeholder')
      || el.getAttribute('data-mny-action') || el.getAttribute('data-mnyp-action')
      || el.getAttribute('data-rc-action') || el.tagName).slice(0, 50);
    const tick = () => new Promise(r => setTimeout(r, 0));
    /* One message-port turn before each control is drawn and pressed: the
       loop runs on from timer callbacks, so Chrome's nested-timer rule would
       hold every tick to 4 ms (about 5 s over the sweep). Drawn and clicked
       in one go from a message task, the click's own zero-delay timers and
       the two ticks after it run unclamped, in the same order as before. */
    const hop = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
    let clicked = 0;
    try {
      for (const s of surfaces) {
        restore(); as(s.as);
        current = s.name + ' (opening it)';
        at(current);
        try { s.open(); } catch (e) { problems.push(current + ': threw ' + e.message); continue; }
        const host0 = document.getElementById(s.host);
        const found = host0 ? [...host0.querySelectorAll(SEL)] : [];
        const sigs = found.map(sig), labels = found.map(label);
        if (!sigs.length) { problems.push(s.name + ': rendered no controls at all'); continue; }
        for (let i = 0; i < sigs.length; i++) {
          await hop();
          restore(); as(s.as);
          current = s.name + ' › "' + labels[i] + '"';
          at(current);
          try { s.open(); } catch (e) { problems.push(s.name + ' (opening it): threw ' + e.message); break; }
          const els = [...document.getElementById(s.host).querySelectorAll(SEL)];
          let el = els[i];
          if (!el || sig(el) !== sigs[i]) el = els.find(x => sig(x) === sigs[i]);
          if (!el) { problems.push(s.name + ': a control was not there on a second drawing — ' + sigs[i]); continue; }
          try { el.click(); } catch (e) { problems.push(current + ': threw ' + e.message); }
          await tick(); await tick();
          clicked++;
        }
      }
      if (clicked < 100) problems.push('only ' + clicked + ' controls were pressed — the sweep is not reaching the surfaces');
    } catch (e) {
      problems.push(current + ': the sweep itself threw ' + e.message);
    } finally {
      current = 'after the sweep';
      at(current);
      restore();
      at(null);
      window._appDialog = was._appDialog; window.showChoice = was.showChoice; window.open = was.open;
      profile = was.profile; parentViewing = was.parentViewing; parentScope = was.parentScope;
      ctParentKid = was.ctParentKid; mnyKid = was.mnyKid; mnyParentSection = was.mnyParentSection;
      mnyMeetKid = was.mnyMeetKid;
      saveLocal();
      window.__moneySweep = { clicked, ms: Math.round(performance.now() - t0) };
    }
    return problems.length ? problems : true;
  });
  page.off('pageerror', moneySweepError);
  page.off('console', moneySweepConsole);
  if (moneySweep.found.length) {
    checks.everyMoneyControlClicksClean = (Array.isArray(checks.everyMoneyControlClicksClean)
      ? checks.everyMoneyControlClicksClean : []).concat(moneySweep.found);
  }
  console.log('money click sweep: ' + JSON.stringify(await page.evaluate(() => window.__moneySweep))
    + ', ' + (Date.now() - moneySweep.started) + 'ms wall');
}

async function sundayKit({ page, want, checks, setLook, clearLooks }) {
  /* PR 9: the Sunday steps (js/44-sunday.js) on the component kit. Every kit
     button, chip, stepper and girl the four steps draw — the girls in the
     meeting's head, Guess with its questions open (✏️ Adjust's and Talk
     first's steppers, the new-row card), Payday as a grown-up (the bank,
     drawn-early and must-pay steppers, Home's ✏️ sheet before and after a
     line edit with its "Why" reason chips, the parent's card and its "Back to
     her"), I choose (and the which-goal sheet's chips), and Signed (the 1 wk / 1 mo / 5 mo chips, ▸ Why) — is at least 44×44 and lies
     whole inside every box that clips it (overflow hidden or clip: the step's
     card, an I choose column), at 390×844 and 1194×834, in Pop and in Calm.
     Each stage names controls that must be drawn, so a stage that did not
     open cannot measure clean. Stage 52 (Kit 1.1): the ✓ result / ✓ Agree /
     ✓ Yes buttons, a club session she went to and the ticked Sunday routine
     are the kit's ok button (K7, C8: #2f7d55 with white, both looks); every chip 11px and every − / + round (C3), a picked chip the money teal (C1/C8);
     a stepper the girl uses (From home / From my bank, Drawn early) is 52×52
     (.ui-stepper--kid), one only a parent uses (✏️ Adjust, 💬 Talk first,
     the must-pay steppers, a line edit) 44×44 (K10, G4). Puts back the
     state (sdRestore), the clock, the look, the size and the profile. */
  await sundayChooseRow({ page, want, checks, setLook, clearLooks });
  if (!want('theSundayKitHolds44pxInItsBoxes')) return;
  const before = page.viewportSize();
  const problems = [];
  const was = await page.evaluate(() => ({ profile, unlocked: parentUnlockedThisSession, viewing: parentViewing, meetKid: mnyMeetKid }));
  try {
    for (const look of ['pop', 'calm']) {
      await setLook(look);
      for (const [w, h, size] of [[1194, 834, 'iPad'], [390, 844, 'phone']]) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(100);
        problems.push(...await page.evaluate(async ([look, size]) => {
          const out = [], tag = `${look} ${size}`;
          const wait = (ms) => new Promise(r => setTimeout(r, ms));
          const KIT = '.ui-btn, .ui-chip, .ui-tabs > button, .ui-kids > button, .ui-stepper > button';
          const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
          const name = (b) => (b.getAttribute('aria-label') || b.textContent).trim().replace(/\s+/g, ' ').slice(0, 40);
          const measure = (where, roots, wants) => {
            roots = roots.filter(Boolean);
            shapeCheck(where, roots);
            if (!roots.length) { out.push(`${tag} ${where}: not drawn`); return; }
            wants.forEach(sel => { if (!roots.some(r => r.querySelector(sel))) out.push(`${tag} ${where}: no ${sel} drawn, so it was not measured`); });
            const all = roots.flatMap(r => [...r.querySelectorAll(KIT)]).filter(shown);
            if (!all.length) out.push(`${tag} ${where}: no kit control on show`);
            all.forEach(b => {
              const r = b.getBoundingClientRect();
              if (r.width < 43.5 || r.height < 43.5) out.push(`${tag} ${where}: "${name(b)}" is ${Math.round(r.width)}×${Math.round(r.height)}, under 44px`);
              for (let p = b.parentElement; p && p !== document.body; p = p.parentElement) {
                const cs = getComputedStyle(p), ov = cs.overflowX + ' ' + cs.overflowY;
                // A scroller (the meeting's .mm-body) brings what is below it into view: the boxes past it do not cut.
                if (/auto|scroll/.test(ov)) break;
                if (!/hidden|clip/.test(ov)) continue;
                const q = p.getBoundingClientRect();
                if (r.left < q.left - 1 || r.right > q.right + 1 || r.top < q.top - 1 || r.bottom > q.bottom + 1) {
                  out.push(`${tag} ${where}: "${name(b)}" (${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}) is cut by ${p.tagName.toLowerCase()}.${[...p.classList].join('.')} (${Math.round(q.left)},${Math.round(q.top)} ${Math.round(q.width)}×${Math.round(q.height)})`);
                  break;
                }
              }
            });
          };
          // K7, C8 (owner 2026-10-12): the ok green #2f7d55 with white, both looks.
          const okWant = ['rgb(47, 125, 85)', 'rgb(255, 255, 255)'];
          /* C3: every chip on the Sunday screens is a rounded rectangle (11px), every
             − / + round; C1/C8: a picked chip in the money area is teal #2f7f77 with
             white in both looks. Each meets a plant it must catch. */
          const shapeFaults = (b) => {
            const cs = getComputedStyle(b);
            if (b.matches('.ui-chip') && cs.borderTopLeftRadius !== '11px') return [`chip "${name(b)}" has a ${cs.borderTopLeftRadius} corner, want 11px`];
            if (b.matches('.ui-stepper > button') && cs.borderTopLeftRadius !== '999px') return [`− / + "${name(b)}" has a ${cs.borderTopLeftRadius} corner, want round`];
            if (b.matches('.ui-chip[aria-pressed="true"]') && (cs.backgroundColor !== 'rgb(47, 127, 119)' || cs.color !== 'rgb(255, 255, 255)')) return [`picked chip "${name(b)}" is ${cs.backgroundColor} / ${cs.color}, want the money teal #2f7f77 / #fff`];
            return [];
          };
          let shapes = 0;
          const shapeCheck = (where, roots) => roots.filter(Boolean).forEach(r => r.querySelectorAll('.ui-chip, .ui-stepper > button').forEach(b => {
            if (!shown(b)) return;
            shapes++;
            shapeFaults(b).forEach(f => out.push(`${tag} ${where}: ${f}`));
          }));
          const okLook = (where, what, els) => {
            els = els.filter(shown);
            if (!els.length) { out.push(`${tag} ${where}: no ${what} drawn, so its ok look was not measured`); return; }
            els.forEach(b => {
              const cs = getComputedStyle(b);
              if (!b.classList.contains('ui-btn--ok')) out.push(`${tag} ${where}: ${what} "${name(b)}" is not the kit ok button (.ui-btn--ok)`);
              else if (cs.backgroundColor !== okWant[0] || cs.color !== okWant[1]) out.push(`${tag} ${where}: ${what} "${name(b)}" is ${cs.backgroundColor} on ${cs.color}, not the ok green ${okWant[0]} on ${okWant[1]}`);
            });
          };
          const stepperSize = (where, root, sel, px) => {
            const bs = root ? [...root.querySelectorAll(sel)].filter(shown) : [];
            if (!bs.length) { out.push(`${tag} ${where}: no ${sel} drawn, so its size was not measured`); return; }
            bs.forEach(b => {
              const r = b.getBoundingClientRect();
              if (Math.abs(r.width - px) > 0.5 || Math.abs(r.height - px) > 0.5) out.push(`${tag} ${where}: stepper button "${name(b)}" (${sel}) is ${Math.round(r.width)}×${Math.round(r.height)}, not ${px}×${px} (${px === 52 ? 'the girl uses it' : 'only a parent uses it'})`);
            });
          };
          const step = () => document.querySelector('#familyMeetingBody .sd');
          const head = () => document.querySelector('#familyMeetingBody .sd-avs');
          const sheet = () => (document.getElementById('sundayOverlay').classList.contains('open') ? document.getElementById('sundayBody') : null);
          const draw = async () => { renderMeetingMode(); await wait(60); };
          const snap = sdSnap(), unpin = sdPin(3);
          try {
            const kid = 'jenn', wk = sdSeedWeek(kid);
            profile = kid;
            mnyAddRequest(kid, { kind: 'gift', amount: 20, giver: 'Uncle Mike' });
            mnyAddRequest(kid, { kind: 'adv', amount: 2, why: 'School book fair' });
            profile = 'parent'; parentUnlockedThisSession = true;
            const prev = sdDayKeyAdd(wk, -7), prev2 = sdDayKeyAdd(wk, -14);
            const c = state.shared.chore;
            c.moneyLedger = c.moneyLedger || {}; c.finalizedWeeks = c.finalizedWeeks || {};
            [[prev, 10], [prev2, 14]].forEach(([w, comp]) => {
              (c.moneyLedger[w] = c.moneyLedger[w] || {})[kid] = { at: 1, chores: 2, learning: 0, streak: 0, sessionsPaid: 0, sessions: 0,
                competition: comp, fines: 0, gross: 2 + comp, net: 2 + comp, loan: { paid: 1 }, ready: 0, gic: 0, stock: 0, spend: 0 };
              (c.finalizedWeeks[w] = c.finalizedWeeks[w] || {})[kid] = 2 + comp;
            });
            const row = mnyAddDebt(kid, { name: 'Winter entry', icon: '🆕', principal: 27, monthly: 20 });
            row.createdAt = Date.now();
            await draw();
            measure('Guess · new row on my wall', [step(), head()], ['.sd-scrim > .ui-card .ui-btn--primary', '.sd-avs > button']);
            sdClick('[data-mny-action="sd-newok"]'); await draw();
            measure('Guess', [step()], ['.sd-ask .ui-btn--ok', '.sd-atts > .ui-btn', '.sd-adds > .ui-btn']);
            okLook('Guess', '✓ Yes', [...step().querySelectorAll('[data-mny-action="sd-yes"], [data-mny-action="sd-meet"]')]);
            okLook('Guess', 'a club session she went to', [...step().querySelectorAll('.sd-atts > .ui-btn')].filter(b => /✓$/.test(b.textContent.trim())));
            // The ticked Sunday routine shows when the meeting Sunday has routine sessions to ask about.
            if (sdSundayRoutine({ kid, wk }).asked) okLook('Guess', 'the ticked Sunday routine', [...step().querySelectorAll('[data-mny-action="sd-sunroutine"]')]);
            sdClick('[data-mny-action="sd-adjust"]'); await draw();
            measure('Guess · ✏️ Adjust', [step()], ['.sd-adj-row.ui-stepper > button']);
            stepperSize('Guess · ✏️ Adjust', step(), '.sd-adj-row.ui-stepper > button', 44);
            sdClick('[data-mny-action="sd-talk"]'); await draw();
            measure('Guess · 💬 Talk first', [step()], ['.sd-agree-set.ui-stepper > button']);
            stepperSize('Guess · 💬 Talk first', step(), '.sd-agree-set.ui-stepper > button', 44);
            okLook('Guess · 💬 Talk first', '✓ Agree', [...step().querySelectorAll('[data-mny-action="sd-agree"]')]);
            const d = sdCur();
            d.step = 1; d.shown = 99; d.guess = 40; sdSave(d); await draw();
            measure('Payday', [step()], ['.sd-pull.ui-stepper > button', '.sd-off--adv.ui-stepper > button', '.sd-payfoot .ui-stepper > button', '.sd-row > .ui-btn--primary']);
            stepperSize('Payday', step(), '.sd-pull.ui-stepper > button', 52);
            stepperSize('Payday', step(), '.sd-off--adv.ui-stepper > button', 52);
            stepperSize('Payday', step(), '.sd-payfoot .ui-stepper > button', 44);
            sdOpenLine('home', true); await wait(350);
            measure('Payday · 🏠 Home changed by a parent', [sheet()], ['.sd-adj-row.ui-stepper > button', '[data-mny-action="sd-dadclose"]']);
            stepperSize('Payday · 🏠 Home changed by a parent', sheet(), '.sd-adj-row.ui-stepper > button', 44);
            // A line edit brings the "Why" reason chips (sdTileDetail).
            const more = document.querySelector('#sundayBody [data-mny-action="sd-ov"][data-sd-d="1"]');
            if (more) { more.click(); await wait(60); } else out.push(`${tag} Payday · line edit: no + to change a line`);
            measure('Payday · 🏠 Home after a line edit', [sheet()], ['.sd-reasons > .ui-chip', '[data-mny-action="sd-dadclose"]']);
            sdSheet = null; closeSheet('sundayOverlay'); await wait(60);
            sdOpenDad(); await wait(350);
            measure("Payday · 🗣️ Parent's card", [sheet()], ['[data-mny-action="sd-dadclose"]']);
            sdSheet = null; closeSheet('sundayOverlay'); await wait(60);
            d.step = 2; sdSave(d); await draw();
            measure('I choose', [step()], ['.sd-presets > .ui-chip', '.sd-presets > .ui-btn', '.sd-minus.ui-btn']);
            // The goal-pick sheet needs two goals to choose between.
            mnyAddGoal(kid, { name: 'Skates', icon: '⛸️', target: 80 });
            mnyAddGoal(kid, { name: 'Book', icon: '📚', target: 15 });
            sdHandleAction('sd-goalmenu', document.body); await wait(350);
            measure('I choose · 🎯 which goal', [sheet()], ['.sd-goalpick > .ui-chip', '[data-mny-action="sd-dadclose"]']);
            sdSheet = null; closeSheet('sundayOverlay'); await wait(60);
            const signed = sdSignHer(kid, wk);
            if (!signed || signed.ok === false) out.push(`${tag} Signed: the sign refused (${JSON.stringify(signed)})`);
            mnyMeetKid = kid; mmGoTo('money'); await draw();
            measure('Signed', [step(), head()], ['.sd-tm > .ui-chip', '.sd-more.ui-btn']);
            if (!shapes) out.push(`${tag}: no chip or − / + was drawn, so no shape was measured`);
            const fx = document.createElement('div');
            fx.setAttribute('data-area', 'money');
            fx.innerHTML = '<button type="button" class="ui-chip" style="border-radius:999px">pill</button><span class="ui-stepper"><button type="button" style="border-radius:11px">−</button></span><button type="button" class="ui-chip" aria-pressed="true" style="background:#ffc83d">$5</button>';
            document.getElementById('sundayOverlay').appendChild(fx);
            const caught = [...fx.querySelectorAll('button')].filter(b => shapeFaults(b).length).length;
            fx.remove();
            if (caught !== 3) out.push(`${tag}: the shape and picked-colour checks caught ${caught} of their 3 plants (a pill chip, an 11px − / +, a yellow picked chip)`);
          } finally {
            if (document.getElementById('sundayOverlay').classList.contains('open')) { sdSheet = null; closeSheet('sundayOverlay'); }
            if (mmIsOpen()) mmHide();
            unpin(); sdRestore(snap);
          }
          return out;
        }, [look, size]));
      }
    }
  } catch (e) {
    problems.push('threw: ' + e.message);
  } finally {
    await page.setViewportSize(before);
    await clearLooks();
    await page.evaluate((was) => {
      profile = was.profile; parentUnlockedThisSession = was.unlocked; parentViewing = was.viewing; mnyMeetKid = was.meetKid;
      goToday();
    }, was);
  }
  checks.theSundayKitHolds44pxInItsBoxes = problems.length ? [...new Set(problems)] : true;
}

async function sundayChooseRow({ page, want, checks, setLook, clearLooks }) {
  /* G7 (Stage 52, Kit 1.1 K12): the whole Sunday choose row as she sees it —
     ◀ My pile, the preset chips, ↺ All back and 📊 Everything — takes at most
     2 rows on a 390×844 phone in Pop, for each girl. A row is the controls
     whose boxes overlap in height; each named control must be drawn. Puts
     back the state (sdRestore), the clock, the look, the size and the
     profile. */
  if (!want('theSundayChooseRowFitsTwoRows')) return;
  const before = page.viewportSize();
  const problems = [];
  const was = await page.evaluate(() => ({ profile, unlocked: parentUnlockedThisSession, viewing: parentViewing, meetKid: mnyMeetKid }));
  try {
    await setLook('pop');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    problems.push(...await page.evaluate(async () => {
      const out = [];
      const wait = (ms) => new Promise(r => setTimeout(r, ms));
      const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
      const name = (b) => (b.getAttribute('aria-label') || b.textContent).trim().replace(/\s+/g, ' ').slice(0, 30);
      for (const kid of ['jenn', 'jess']) {
        const snap = sdSnap(), unpin = sdPin(3);
        try {
          sdSeedWeek(kid);
          const d = sdCur();
          d.step = 2; d.shown = 99; d.guess = 40; sdSave(d);
          profile = kid; renderMeetingMode(); await wait(60);
          const row = document.querySelector('#familyMeetingBody .sd-presets');
          if (!row) { out.push(`${kid}: I choose drew no choose row (.sd-presets)`); continue; }
          const items = [...row.children].filter(shown);
          ['sd-back', 'sd-preset', 'sd-clear', 'sd-all'].forEach(a => {
            if (!items.some(e => e.getAttribute('data-mny-action') === a)) out.push(`${kid}: the choose row shows no ${a} control, so it was not counted`);
          });
          const rows = [];
          items.map(e => ({ e, r: e.getBoundingClientRect() })).sort((a, b) => a.r.top - b.r.top).forEach(({ e, r }) => {
            const last = rows[rows.length - 1];
            if (!last || r.top >= last.bottom - 1) rows.push({ bottom: r.bottom, names: [name(e)] });
            else { last.bottom = Math.max(last.bottom, r.bottom); last.names.push(name(e)); }
          });
          if (rows.length > 2) out.push(`${kid}: the choose row takes ${rows.length} rows at 390×844 in Pop, over 2: ${rows.map(x => '[' + x.names.join(' | ') + ']').join(' ')}`);
        } catch (e) {
          out.push(`${kid}: threw ${e.message}`);
        } finally {
          if (mmIsOpen()) mmHide();
          unpin(); sdRestore(snap);
        }
      }
      return out;
    }));
  } catch (e) {
    problems.push('threw: ' + e.message);
  } finally {
    await page.setViewportSize(before);
    await clearLooks();
    await page.evaluate((was) => {
      profile = was.profile; parentUnlockedThisSession = was.unlocked; parentViewing = was.viewing; mnyMeetKid = was.meetKid;
      goToday();
    }, was);
  }
  checks.theSundayChooseRowFitsTwoRows = problems.length ? problems : true;
}

module.exports = { moneyFit, moneyClicks, sundayKit };
