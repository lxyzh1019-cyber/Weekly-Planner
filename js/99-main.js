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
// Chore tab uses event delegation on #choreWrap (survives innerHTML re-renders).
(function(){
  const wrap = document.getElementById('choreWrap');
  if (wrap) wrap.addEventListener('click', ctHandleWrapClick);
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

  // Zone tabs → already converted to <button role="tab"> in HTML; keep aria-selected in sync
  root.querySelectorAll('.zone-tab[onclick]').forEach(el => {
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'button') return; // already a button — handled by JS setZone()
    if (!el.hasAttribute('role')) el.setAttribute('role', 'tab');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    if (!el.dataset.a11yKeybound) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
      el.dataset.a11yKeybound = '1';
    }
  });

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
initA11yEnhancements();
refreshHeroModeToggle();

// Small onboarding mascot after profile pick (if day is empty)
const _origBuildTimeline = buildTimeline;
buildTimeline = function() {
  _origBuildTimeline();
  const blocks = getDayBlocks(currentDayKey);
  if (!blocks.length && !isParent()) {
    setTimeout(()=>showMascot("Nothing here yet! Start with breakfast 🍳 — tap it below, then tap a morning time."), 400);
  }
};
