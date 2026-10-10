// Smoke group: the money screens (noLabelIsCutOnTheMoneyScreens, everyMoneyControlClicksClean). Moved out of tests/smoke.js unchanged (Stage 23) so one worker can edit this group alone; tests/smoke.js calls it at the same point in the run, on its one shared page, with the helpers it names.
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
    const fitReset = () => page.evaluate(() => {
      const o = document.getElementById('requestOverlay'); if (o && o.classList.contains('open')) rqClose();
      const idea = document.getElementById('mnyConceptCard'); if (idea) idea.remove();
      if (window.__mv2Snap) { const sn = JSON.parse(window.__mv2Snap); Object.keys(state).forEach(k => { delete state[k]; }); Object.assign(state, sn); window.__mv2Snap = null; saveLocal(); }
      if (window.__sdSweepSnap) { sdRestore(window.__sdSweepSnap); window.__sdSweepSnap = null; if (mmIsOpen()) mmHide(); profile = window.__sdSweepProfile; window.__sdSweepProfile = null; }
      const sdo = document.getElementById('sundayOverlay'); if (sdo && sdo.classList.contains('open')) closeSheet('sundayOverlay');
      profile = 'jenn';   // her screens, as she sees them (Grown-ups' rows leave the parent signed in)
    });
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
            await fitReset();
            // Her request sheets over a My money with long names in the long pass.
            if (long && /^sheet\//.test(String(label))) await page.evaluate(`(() => { ${MV2_HOLD} return said; })()`);
            const said = await page.evaluate(`(${nav.toString()})()`);
            await page.waitForTimeout(200);
            const where = `${label || id} · ${look} · ${w} · ${pass}`;
            if (typeof said === 'string') { fitFindings.push(`${where} · ${said}`); continue; }
            const on = await page.evaluate((sid) => { const el = document.getElementById(sid);
              return !!el && (el.classList.contains('active') || el.classList.contains('open') || el.classList.contains('mny-concept-scrim')); }, id);
            if (!on) { fitFindings.push(`${where} · the screen was not on show`); continue; }
            (await page.evaluate(fitMeasure, id)).forEach(f => fitFindings.push(`${where} · ${f}`));
          }
          await fitReset();
          // Grown-ups' six tabs over a seeded week: questions, fines, a loan, money expected.
          await page.evaluate((L) => {
            window.__fitGuSnap = JSON.stringify(state);
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
            await page.evaluate((t) => {
              profile = 'parent'; parentUnlockedThisSession = true; parentViewing = 'jenn';
              showScreen('parent'); renderParentHome(); setParentTab('money'); mnyParentSection = t; mnyRenderRulesTab();
            }, tab);
            await page.waitForTimeout(200);
            const where = `Grown-ups › ${tab} · ${look} · ${w} · ${pass}`;
            (await page.evaluate(fitMeasure, 'screen-parent')).forEach(f => fitFindings.push(`${where} · ${f}`));
          }
          // Parent › Now over the same seeded week: its money cards are a money surface too.
          await page.evaluate(() => {
            profile = 'parent'; parentUnlockedThisSession = true; parentViewing = 'jenn';
            showScreen('parent'); renderParentHome(); setParentTab('now');
          });
          await page.waitForTimeout(200);
          (await page.evaluate(fitMeasure, 'screen-parent')).forEach(f => fitFindings.push(`Parent › Now · ${look} · ${w} · ${pass} · ${f}`));
          await page.evaluate(() => {
            const s = JSON.parse(window.__fitGuSnap); window.__fitGuSnap = null;
            Object.keys(state).forEach(k => { delete state[k]; }); Object.assign(state, s);
            mnyParentSection = 'approve'; saveLocal();
          });
        }
      }
    }
    await page.evaluate(() => { window.__fitLong = false; });
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

module.exports = { moneyFit, moneyClicks };
