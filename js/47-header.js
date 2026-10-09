/* ════════════════════════════════════════════════════════════════
   THE PAGE HEADER — one header for every screen (Consistency PR 3)

   pageHeader({variant, back, title, context, actions, badge, sub}) returns the
   header's markup: `[◀ back?] [Title] [context] [actions ≤2] [profile badge]`
   in one row, and an optional sub-bar under it for tabs, a stepper or the kid
   switch. PR 4 moves the kid screens onto it — Today, Week, Day, Sister Sync
   and Print first (phMount below), then mnyPageHead and .mm-head--two — and
   PR 5 the parent portal's .parent-bar. Its sizes are the --hdr-* tokens and
   its classes the .ph-* rules in css/app.css.

   Variants, row heights as the owner's header pictures draw them
   (docs/handoff/consistency/headers/measurements.txt). The rules sit under
   the rows: a 2.5px rule ends the header (2px at 1x), a 1.5px rule (1px at 1x)
   parts row 1 from a sub-bar or the meeting's second row.
     standard  --hdr-h: 64px on the iPad, 60px on a phone (≤699px); the kid
               screens, so its buttons and badge are 52px (the kids' tap
               rule; parent buttons stay 44px)
     money     --hdr-money-h: 72px / 64px, one row; 54px buttons, 52px on a phone
     meeting   two rows, --hdr-meeting-h 62px / 60px + 44px; `sub` fills the
               second row (the step, its dots and the step buttons) instead
               of a sub-bar. The meeting screen's missing bottom bar is the
               screen's, not this.
     parent    standard height on the portal's purple (--accent-purple)

   Slots, every text escaped here (ARCHITECTURE.md, Escaping):
     back     { to, data, named }    ◀ with aria-label "Back to <to>"; `named`
              also writes <to> beside the ◀ (Day's "◀ Week")
     title    text                   the screen's name, no emoji (D5)
     step     { prev, next }         ◀ ▶ either side of the title, each
              { aria, data } (Day: the date is the title)
     context  text                   e.g. the date; hidden at ≤699px (D4)
     tools    markup the caller built and escaped, in the row after the
              title (Week's stepper and view tabs, Day's 1 2 3)
     actions  [{ label, aria, data }] at most two; a third is not drawn
     badge    { text, icon, avatar, aria, data, id }  always far right;
              `avatar` draws only the icon in a circle (the money pages);
              otherwise the icon, then the text, which a phone hides
     sub      markup the caller built and escaped (.ui-tabs, .ui-stepper,
              .ui-kids); drawn as the 44px sub-bar (--hdr-sub-h)
     noPrint  true: the header is not printed (Print's own header)
   `data` is { 'mny-action': 'x', … } and becomes data-mny-action="x": the
   header wires no handler of its own; the screen's delegated listener reads
   the button the way it reads its own (ARCHITECTURE.md prefers data
   attributes to inline handlers). tests/check-dead-actions.js cannot see an
   action built this way, so each header action is checked by hand (PR 5).

   Classic script, declarations only (the load-order rule). The guard at the
   end lets tests/helpers.test.js render every slot combination in Node.
   ════════════════════════════════════════════════════════════════ */
/* Each variant's class, written out whole so tests/check-dead-css.js finds it. */
const PH_VARIANT_CLASS = { standard: 'ph--standard', money: 'ph--money', meeting: 'ph--meeting', parent: 'ph--parent' };
const PH_VARIANTS = Object.keys(PH_VARIANT_CLASS);
const PH_MAX_ACTIONS = 2;

/* data-* attributes from { name: value }. A name that is not lower-case
   letters, digits and hyphens is dropped rather than written into markup. */
function phDataAttrs(data) {
  if (!data) return '';
  return Object.keys(data)
    .filter(k => /^[a-z][a-z0-9-]*$/.test(k))
    .map(k => ` data-${k}="${escapeAttr(data[k])}"`)
    .join('');
}

function phButton(cls, aria, data, contentHtml, id) {
  const ariaAttr = aria ? ` aria-label="${escapeAttr(aria)}" title="${escapeAttr(aria)}"` : '';
  const idAttr = id ? ` id="${escapeAttr(id)}"` : '';
  return `<button type="button" class="${cls}"${ariaAttr}${phDataAttrs(data)}${idAttr}>${contentHtml}</button>`;
}

/* The text badge keeps the icon and the text as two spans with a space
   between, so its textContent is the caller's whole wording (profileBadgeText
   gives "🐥 Jenn") while a phone hides the text and keeps the avatar. */
function phBadgeHtml(b) {
  const iconHtml = b.icon ? `<span class="ph-av" aria-hidden="true">${escapeHtml(b.icon)}</span>` : '';
  if (b.avatar) return phButton('ph-badge ph-badge--avatar', b.aria || b.text, b.data, iconHtml, b.id);
  const textHtml = b.text ? `${iconHtml ? ' ' : ''}<span class="ph-badge-text">${escapeHtml(b.text)}</span>` : '';
  return phButton('ph-badge', b.aria, b.data, iconHtml + textHtml, b.id);
}

function phStepButton(s, glyph) {
  return phButton('ph-btn ph-step-btn', s && s.aria, s && s.data, `<span aria-hidden="true">${glyph}</span>`);
}

function pageHeader(o) {
  o = o || {};
  const variant = PH_VARIANTS.indexOf(o.variant) >= 0 ? o.variant : 'standard';
  const backNameHtml = o.back && o.back.named && o.back.to ? ` <span class="ph-back-to">${escapeHtml(o.back.to)}</span>` : '';
  const backHtml = o.back
    ? phButton('ph-btn ph-back', 'Back to ' + (o.back.to || ''), o.back.data, '<span aria-hidden="true">◀</span>' + backNameHtml)
    : '';
  const bareTitleHtml = o.title ? `<h2 class="ph-title">${escapeHtml(o.title)}</h2>` : '';
  const titleHtml = o.step
    ? `<div class="ph-step">${phStepButton(o.step.prev, '◀')}${bareTitleHtml}${phStepButton(o.step.next, '▶')}</div>`
    : bareTitleHtml;
  const contextHtml = o.context ? `<div class="ph-context">${escapeHtml(o.context)}</div>` : '';
  const toolsHtml = o.tools ? `<div class="ph-tools">${o.tools}</div>` : '';
  const actionsHtml = (o.actions || []).slice(0, PH_MAX_ACTIONS)
    .map(a => phButton('ph-btn', a.aria, a.data, escapeHtml(a.label || '')))
    .join('');
  const actionsWrapHtml = actionsHtml ? `<div class="ph-actions">${actionsHtml}</div>` : '';
  const badgeHtml = o.badge ? phBadgeHtml(o.badge) : '';
  const subHtml = o.sub || '';
  const mainRowHtml = `<div class="ph-row ph-main">${backHtml}${titleHtml}${contextHtml}${toolsHtml}${actionsWrapHtml}${badgeHtml}</div>`;
  const lowerHtml = !subHtml ? ''
    : variant === 'meeting' ? `<div class="ph-row ph-r2">${subHtml}</div>`
    : `<div class="ph-row ph-sub">${subHtml}</div>`;
  const printCls = o.noPrint ? ' no-print' : '';
  return `<header class="ph ${PH_VARIANT_CLASS[variant]}${printCls}">${mainRowHtml}${lowerHtml}</header>`;
}

/* ── The kid screens' standard headers (PR 4) ──
   Today, Week, Day, Sister Sync and Print each keep one <header class="ph …">
   as a direct child of their screen; phMount swaps it for a fresh pageHeader
   on every render of that screen, so the header always says what the screen
   under it says. Their buttons carry data-ph-action, answered by kidHeadClick
   below — bound once per screen in js/99-main.js (KID_HEAD_SCREENS),
   delegated like every rebuilt surface here. */
const KID_HEAD_SCREENS = ['screen-today', 'screen-week', 'screen-day', 'screen-sync', 'screen-print'];

function phMount(screenId, o) {
  const old = document.querySelector('#' + screenId + ' > header.ph');
  if (old) old.outerHTML = pageHeader(o);
}

/* The profile badge on every kid header: the one wording (profileBadgeText,
   in two parts from profileBadgeParts), far right, opening the switcher.
   `id` is the screen's own badge id — applyMeetingLock hides the week's and
   the day's by id, so a header is mounted before the lock is applied. */
function kidHeadBadge(id, kid, asParent) {
  const parts = profileBadgeParts(kid, asParent);
  return { id, icon: parts.icon, text: parts.name, aria: 'Switch profile', data: { 'ph-action': 'profile' } };
}

function kidHeadClick(e) {
  const el = e.target.closest('button');
  if (!el || !el.dataset.phAction) return;
  switch (el.dataset.phAction) {
    case 'profile': openProfileSwitcher(); break;
    case 'back': navReturnBack(el.dataset.phFallback || 'week'); break;
    case 'week-prev': changeWeek(-1); break;
    case 'week-next': changeWeek(1); break;
    case 'view-full': setWeekView('full'); break;
    case 'view-preview': setWeekView('preview'); break;
    case 'print-open': openPrint(); break;
    case 'print-now': window.print(); break;
    case 'day-prev': navDay(-1); break;
    case 'day-next': navDay(1); break;
    case 'day-copy': openTemplateSheet(); break;
    default: break;
  }
}

/* Node reach for tests/helpers.test.js. Same guard as 05-helpers. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { pageHeader, PH_VARIANTS, PH_MAX_ACTIONS };
}
