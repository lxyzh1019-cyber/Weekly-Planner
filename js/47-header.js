/* ════════════════════════════════════════════════════════════════
   THE PAGE HEADER — one header for every screen (Consistency PR 3)

   pageHeader({variant, back, title, context, actions, badge, sub}) returns the
   header's markup: `[◀ back?] [Title] [context] [actions ≤2] [profile badge]`
   in one row, and an optional sub-bar under it for tabs, a stepper or the kid
   switch. Nothing calls it yet: PR 4 moves the kid screens' .topbar,
   .week-topbar, .day-topbar, mnyPageHead and .mm-head--two onto it, PR 5 the
   parent portal's .parent-bar. Its sizes are the --hdr-* tokens and its
   classes the .ph-* rules in css/app.css.

   Variants, row heights as the owner's header pictures draw them
   (docs/handoff/consistency/headers/measurements.txt). The rules sit under
   the rows: a 2.5px rule ends the header (2px at 1x), a 1.5px rule (1px at 1x)
   parts row 1 from a sub-bar or the meeting's second row.
     standard  --hdr-h: 64px on the iPad, 60px on a phone (≤699px)
     money     --hdr-money-h: 72px / 64px, one row; 54px buttons, 52px on a phone
     meeting   two rows, --hdr-meeting-h 62px / 60px + 44px; `sub` fills the
               second row (the step, its dots and the step buttons) instead
               of a sub-bar. The meeting screen's missing bottom bar is the
               screen's, not this.
     parent    standard height on the portal's purple (--accent-purple)

   Slots, every text escaped here (ARCHITECTURE.md, Escaping):
     back     { to, data }           ◀ with aria-label "Back to <to>"
     title    text                   the screen's name, no emoji (D5)
     context  text                   e.g. the date; hidden at ≤699px (D4)
     actions  [{ label, aria, data }] at most two; a third is not drawn
     badge    { text, icon, avatar, aria, data }  always far right; `avatar`
              draws only the icon in a circle (the money pages)
     sub      markup the caller built and escaped (.ui-tabs, .ui-stepper,
              .ui-kids); drawn as the 44px sub-bar (--hdr-sub-h)
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

function phButton(cls, aria, data, contentHtml) {
  const ariaAttr = aria ? ` aria-label="${escapeAttr(aria)}" title="${escapeAttr(aria)}"` : '';
  return `<button type="button" class="${cls}"${ariaAttr}${phDataAttrs(data)}>${contentHtml}</button>`;
}

function phBadgeHtml(b) {
  const iconHtml = b.icon ? `<span class="ph-av" aria-hidden="true">${escapeHtml(b.icon)}</span>` : '';
  if (b.avatar) return phButton('ph-badge ph-badge--avatar', b.aria || b.text, b.data, iconHtml);
  return phButton('ph-badge', b.aria, b.data, iconHtml + escapeHtml(b.text || ''));
}

function pageHeader(o) {
  o = o || {};
  const variant = PH_VARIANTS.indexOf(o.variant) >= 0 ? o.variant : 'standard';
  const backHtml = o.back
    ? phButton('ph-btn ph-back', 'Back to ' + (o.back.to || ''), o.back.data, '<span aria-hidden="true">◀</span>')
    : '';
  const titleHtml = o.title ? `<h2 class="ph-title">${escapeHtml(o.title)}</h2>` : '';
  const contextHtml = o.context ? `<div class="ph-context">${escapeHtml(o.context)}</div>` : '';
  const actionsHtml = (o.actions || []).slice(0, PH_MAX_ACTIONS)
    .map(a => phButton('ph-btn', a.aria, a.data, escapeHtml(a.label || '')))
    .join('');
  const actionsWrapHtml = actionsHtml ? `<div class="ph-actions">${actionsHtml}</div>` : '';
  const badgeHtml = o.badge ? phBadgeHtml(o.badge) : '';
  const subHtml = o.sub || '';
  const mainRowHtml = `<div class="ph-row ph-main">${backHtml}${titleHtml}${contextHtml}${actionsWrapHtml}${badgeHtml}</div>`;
  const lowerHtml = !subHtml ? ''
    : variant === 'meeting' ? `<div class="ph-row ph-r2">${subHtml}</div>`
    : `<div class="ph-row ph-sub">${subHtml}</div>`;
  return `<header class="ph ${PH_VARIANT_CLASS[variant]}">${mainRowHtml}${lowerHtml}</header>`;
}

/* Node reach for tests/helpers.test.js. Same guard as 05-helpers. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { pageHeader, PH_VARIANTS, PH_MAX_ACTIONS };
}
