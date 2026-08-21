// Weekly-Planner — boot: load state, init Firebase, first render, global wiring,
// a11y enhancements, timeline mascot patch. Loaded last; the only file with
// top-level executable code. Extracted verbatim from index.html.
/* ════════════════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════════════════ */
loadLocal();
initFirebase();
showScreen('profile');
window._currentRewardPrompt = null;
// Cloud writes are debounced (SYNC_DEBOUNCE_MS, js/03-sync.js). A tab being
// hidden or torn down is the one case where waiting out the window risks losing
// the edit, so flush immediately. pagehide covers iOS Safari, where unload does
// not reliably fire; visibilitychange covers app-switching on a tablet, which is
// how this app is actually used.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { flushPush(); return; }
  // Coming back to the app is the moment Today is most likely to be stale: an
  // iPad put down after breakfast and picked up at four is still showing the
  // morning's hero. Timers do not fire reliably in a backgrounded tab, so the
  // return has to re-resolve rather than wait for the next tick.
  if (typeof tdTick === 'function') tdTick();
});
// Today counts down, so it has to be told the minute has changed. tdTick patches
// the countdown, the bar and the ribbon marker in place, and only re-renders when
// what she is doing actually changes; it returns immediately unless Today is the
// screen on show. A render is not a mutation — nothing here writes to Firestore.
setInterval(() => { try { tdTick(); } catch (e) { console.error('tdTick failed', e); } }, TD_TICK_MS);
window.addEventListener('pagehide', flushPush);
// Chore tab uses event delegation on #choreWrap (survives innerHTML re-renders).
(function(){
  const wrap = document.getElementById('choreWrap');
  if (wrap) wrap.addEventListener('click', ctHandleWrapClick);
})();
// Today delegates for the same reason: every render replaces the whole wrap.
// Bound to the screen rather than #tdWrap, because the panels moved off the day
// timeline are static siblings of the wrap — one listener has to cover both, and
// the screen element is the one thing here that is never replaced.
(function(){
  const wrap = document.getElementById('screen-today');
  if (wrap) wrap.addEventListener('click', tdHandleClick);
  const nav = document.getElementById('kidNav');
  if (nav) nav.addEventListener('click', tdHandleNavClick);
  // The undo toast is a static node outside every screen, so it binds directly
  // rather than through a delegate — nothing ever replaces it.
  const undo = document.getElementById('undoToastBtn');
  if (undo) undo.addEventListener('click', undoLastCompletion);
})();
// The pocket-money pages delegate the same way, for the same reason: every
// render replaces the whole wrap, so a listener bound to a card would be gone
// the first time a number changed.
(function(){
  // familyMeetingBody renders the same mnyTabBar/mnyAskBtn markup as the
  // standalone money pages, so without this binding tabs 4 (Money rules) and
  // 5 (Money school) — and every `?` button — were inert inside the meeting.
  ['mnyPage1Wrap','mnyStoryWrap','mnySchoolWrap','familyMeetingBody'].forEach(id => {
    const wrap = document.getElementById(id);
    if (!wrap) return;
    wrap.addEventListener('click', mnyHandleClick);
    // The saving-goal form types into it, so it needs input/change too.
    wrap.addEventListener('input', mnyHandleInput);
    wrap.addEventListener('change', mnyHandleInput);
  });
  // The meeting's own controls (catch-up week bar, add-a-chore, all-routines)
  // carry data-mm-action. Same reason as above — every step rebuilds the body.
  const meeting = document.getElementById('familyMeetingBody');
  if (meeting) meeting.addEventListener('click', mmHandleClick);
  // The catch-up list lives on the parent hub rather than inside the meeting,
  // and is rebuilt on every hub render, so it needs its own delegated listener
  // on the container rather than handlers on the rows.
  const hub = document.getElementById('meetingHub');
  if (hub) hub.addEventListener('click', mmHandleCatchUpClick);
  // The parent Money rules tab has its own handler: rule paths and holding ids
  // ride on data attributes rather than being interpolated into inline
  // handlers, and its typed fields need input/change as well as click.
  const rules = document.getElementById('mnyRulesWrap');
  if (rules) {
    rules.addEventListener('click', mnyParentClick);
    rules.addEventListener('input', mnyParentInput);
    rules.addEventListener('change', mnyParentInput);
  }
  // The portal's tab strip: arrow keys move between destinations. The strip is
  // static markup, so one listener on the container is enough.
  const ptabs = document.querySelector('#screen-parent .parent-tabs');
  if (ptabs) ptabs.addEventListener('keydown', parentTabsKeydown);
  // Destinations, landings, the back link and the scope pills all ride on data
  // attributes, so the screen itself carries one listener for the lot.
  const portal = document.getElementById('screen-parent');
  if (portal) portal.addEventListener('click', parentHandleNavClick);
  const pnav = document.getElementById('parentNav');
  if (pnav) pnav.addEventListener('click', parentHandleNavClick);
  // Now is rebuilt wholesale on every render, so its rows carry data attributes
  // and the container holds the listener.
  const now = document.getElementById('pnWrap');
  if (now) now.addEventListener('click', pnHandleClick);
})();

/* Desktop: convert vertical wheel scroll to horizontal on the tray + filter */
function enableHorizontalWheelScroll() {
  ['trayScroll','trayFilter'].forEach(id=>{
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('wheel', (e)=>{
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive:false });
  });
}

function enhanceNonButtonClickables(root = document) {
  // Generic clickable divs → role="button" + keyboard access
  const buttonSelectors = [
    '.profile-card[onclick]',
    '.profile-badge[onclick]',
    '.mascot-close[onclick]',
  ];
  root.querySelectorAll(buttonSelectors.join(',')).forEach(el => {
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    if (!el.dataset.a11yKeybound) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
      el.dataset.a11yKeybound = '1';
    }
  });

  // Toggle switches → role="switch" + aria-checked (reflects .on class)
  const switchSelectors = ['.buffer-toggle[onclick]', '.repeat-toggle[onclick]'];
  root.querySelectorAll(switchSelectors.join(',')).forEach(el => {
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'button' || tag === 'a') return;
    if (!el.hasAttribute('role')) el.setAttribute('role', 'switch');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.setAttribute('aria-checked', el.classList.contains('on') ? 'true' : 'false');
    if (!el.dataset.a11yKeybound) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
      el.dataset.a11yKeybound = '1';
    }
    // Keep aria-checked in sync when .on class changes via MutationObserver
    if (!el.dataset.a11yObserved) {
      new MutationObserver(() => {
        el.setAttribute('aria-checked', el.classList.contains('on') ? 'true' : 'false');
      }).observe(el, { attributeFilter: ['class'] });
      el.dataset.a11yObserved = '1';
    }
  });

  // (A zone-tab a11y pass lived here. The morning/afternoon/evening filters
  // were removed from the day topbar, so there is nothing left to enhance.)

  // Chore checkboxes (.ct-check) rendered via innerHTML → add role + aria-checked
  root.querySelectorAll('.ct-check').forEach(el => {
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'button' || tag === 'input') return;
    if (!el.hasAttribute('role')) el.setAttribute('role', 'checkbox');
    if (!el.hasAttribute('tabindex') && el.getAttribute('onclick')) el.setAttribute('tabindex', '0');
    el.setAttribute('aria-checked', el.classList.contains('on') ? 'true' : 'false');
    if (!el.dataset.a11yKeybound && el.getAttribute('onclick')) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
      el.dataset.a11yKeybound = '1';
    }
  });
}

function applyIconButtonAriaLabels(root = document) {
  root.querySelectorAll('button').forEach(btn => {
    if (btn.getAttribute('aria-label')) return;
    const title = (btn.getAttribute('title') || '').trim();
    if (title) {
      btn.setAttribute('aria-label', title);
      return;
    }
    const text = (btn.textContent || '').replace(/\s+/g, ' ').trim();
    const hasLetters = /[A-Za-z]/.test(text);
    if (hasLetters) return;
    const iconTextMap = {
      '◀': 'Back',
      '▶': 'Next',
      '＋': 'Add',
      '🧹': 'Open Weekly Chore',
      '🎯': 'Open Challenges',
      '👯': 'Open Sister Sync',
      '🖨': 'Print',
      '📋': 'Open Templates',
      '🌙': 'Open Reflection',
      '✏️': 'Edit',
      '🗑': 'Delete',
      '↩️': 'Reset',
      '🔗': 'Share',
      '✅': 'Accept',
      '❌': 'Decline',
      'Exit': 'Exit',
    };
    const mapped = iconTextMap[text];
    if (mapped) btn.setAttribute('aria-label', mapped);
  });
}

function enhanceAccessibility(root = document) {
  enhanceNonButtonClickables(root);
  applyIconButtonAriaLabels(root);
  root.querySelectorAll('.profile-badge').forEach((badge) => {
    if (!badge.getAttribute('aria-label')) badge.setAttribute('aria-label', 'Open profile selector');
  });
  root.querySelectorAll('.mascot-close').forEach((closeBtn) => {
    if (!closeBtn.getAttribute('aria-label')) closeBtn.setAttribute('aria-label', 'Close owl helper');
  });
}

function initA11yEnhancements() {
  const run = () => {
    enhanceAccessibility(document);
  };
  run();
  const observer = new MutationObserver(() => run());
  observer.observe(document.body, { childList: true, subtree: true });
}
enableHorizontalWheelScroll();
bindMiddleDragPan();
initA11yEnhancements();
/* Hero Mode is gone (js/05-helpers.js). Drop its key so a switch nobody can see
   is not still remembered on the girls' iPad. */
try { localStorage.removeItem('wp_hero_mode'); } catch (e) {}

// Small onboarding mascot after profile pick (if day is empty)
const _origBuildTimeline = buildTimeline;
buildTimeline = function() {
  _origBuildTimeline();
  const blocks = getDayBlocks(currentDayKey);
  if (!blocks.length && !isParent()) {
    setTimeout(()=>showMascot("Nothing here yet! Start with breakfast 🍳 — tap it below, then tap a morning time."), 400);
  }
};
