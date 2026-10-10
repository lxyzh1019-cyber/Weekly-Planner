/* ════════════════════════════════════════════════════════════════
   THE PAGE HEADER — one header for every screen (Consistency PR 3, rebuilt
   in Stage 20 from the owner's turn-2 picture)

   pageHeader({variant, back, lead, title, step, context, centre, tools,
   actions, badge, sub}) returns the header's markup: one row of three groups
   on a grid (css/app.css, THE PAGE HEADER):
     .hdr-start   [◀ back] [lead] [Title]
     .hdr-context in the middle of the BAR — the date, the week's ◀ label ▶,
                  the Day's ◀ date ▶ (its date is its title) or the meeting's
                  steps
     .hdr-end     [tools] [actions ≤2] [profile badge, always last]
   and an optional second row under it. A header with no centre draws its two
   groups at the ends (.hdr-row--ends). The values are the per-screen table in
   docs/handoff/header-exact-values.md, measured by
   everyHeaderMeasuresToTheExactValues (tests/smoke.js). PR 4 moves the kid
   screens onto it — Today, Week, Day, Sister Sync and Print (hdrMount below),
   the money pages (mnyHead, js/22) and the family meeting (mmHead, js/15) —
   and PR 5 the parent portal's .parent-bar.

   Variants (row heights from the table; a 2.5px ink rule ends the header):
     standard  64px on the iPad, 60px on a phone (≤699px); the kid screens,
               so its buttons and badge are 52px (the kids' tap rule)
     money     72px / 64px, one row; 54px buttons and badge, 52px on a phone
     meeting   two rows, 62px / 60px + 44px under a 1.5px dashed rule in the
               page's grid colour; `sub` fills the second row
     parent    standard height on the portal's purple (--accent-purple)

   Slots, every text escaped here (ARCHITECTURE.md, Escaping):
     back     { to, data, named }    ◀ with aria-label "Back to <to>"; `named`
              also writes <to> beside the ◀ (Day's "◀ Week")
     lead     markup the caller built and escaped, in the left group after
              ◀ (the meeting's girls, a kid's money tabs)
     title    text                   the screen's name, no emoji (D5)
     step     { prev, next, titleAction, labelId }  ◀ ▶ in the centre, each
              { aria, data }, either side of `context` when there is one (the
              Week's week; `labelId` is its id) or else of the title (the Day:
              the date is the title, in the centre). titleAction { aria, data }
              makes the title itself a button (.hdr-title-btn: on a phone,
              tapping the Day's date is Copy a day, D27)
     context  text                   the date; a phone hides it on the money
              header only (D26)
     centre   markup the caller built and escaped, in the centre (the
              meeting's steps)
     tools    markup the caller built and escaped, in the right group (the
              Week's Full / Preview switch, the Day's 1 2 3)
     actions  [{ label, aria, data, pressed, cls }] at most two; a third is
              not drawn; `pressed` (true/false) writes aria-pressed (the
              meeting's 🔊 Sound); `cls` adds a class (hdr-print: the Week's
              Print; hdr-btn--word: a button with a word)
     badge    { text, icon, avatar, aria, data, id }  always far right;
              `avatar` draws only the icon in a circle, its words in the
              aria-label (every kid header, D25); otherwise the icon, then
              the text
     sub      markup the caller built and escaped: the second row (.hdr-sub,
              or .hdr-r2 on the meeting)
     noPrint  true: the header is not printed (Print's own header)
     moneySurface  true: the header is a money root (data-money-surface,
              ARCHITECTURE.md) — the money pages' and the meeting's
   `data` is { 'mny-action': 'x', … } and becomes data-mny-action="x": the
   header wires no handler of its own; the screen's delegated listener reads
   the button the way it reads its own (ARCHITECTURE.md prefers data
   attributes to inline handlers). tests/check-dead-actions.js cannot see an
   action built this way, so each header action is checked by hand (PR 5).

   Classic script, declarations only (the load-order rule). The guard at the
   end lets tests/helpers.test.js render every slot combination in Node.
   ════════════════════════════════════════════════════════════════ */
/* Each variant's class, written out whole so tests/check-dead-css.js finds it. */
const HDR_VARIANT_CLASS = { standard: 'hdr--standard', money: 'hdr--money', meeting: 'hdr--meeting', parent: 'hdr--parent' };
const HDR_VARIANTS = Object.keys(HDR_VARIANT_CLASS);
const HDR_MAX_ACTIONS = 2;

/* data-* attributes from { name: value }. A name that is not lower-case
   letters, digits and hyphens is dropped rather than written into markup. */
function hdrDataAttrs(data) {
  if (!data) return '';
  return Object.keys(data)
    .filter(k => /^[a-z][a-z0-9-]*$/.test(k))
    .map(k => ` data-${k}="${escapeAttr(data[k])}"`)
    .join('');
}

function hdrButton(cls, aria, data, contentHtml, id, pressed) {
  const ariaAttr = aria ? ` aria-label="${escapeAttr(aria)}" title="${escapeAttr(aria)}"` : '';
  const idAttr = id ? ` id="${escapeAttr(id)}"` : '';
  const pressedAttr = typeof pressed === 'boolean' ? ` aria-pressed="${pressed}"` : '';
  return `<button type="button" class="${cls}"${ariaAttr}${pressedAttr}${hdrDataAttrs(data)}${idAttr}>${contentHtml}</button>`;
}

/* The text badge keeps the icon and the text as two spans with a space
   between, so its textContent is the caller's whole wording. */
function hdrBadgeHtml(b) {
  const iconHtml = b.icon ? `<span aria-hidden="true">${escapeHtml(b.icon)}</span>` : '';
  if (b.avatar) return hdrButton('hdr-badge', b.aria || b.text, b.data, iconHtml, b.id);
  const textHtml = b.text ? `${iconHtml ? ' ' : ''}<span class="hdr-badge-text">${escapeHtml(b.text)}</span>` : '';
  return hdrButton('hdr-badge hdr-badge--text', b.aria, b.data, iconHtml + textHtml, b.id);
}

function hdrStepButton(s, glyph) {
  return hdrButton('hdr-btn hdr-step', s && s.aria, s && s.data, `<span aria-hidden="true">${glyph}</span>`);
}

function pageHeader(o) {
  o = o || {};
  const variant = HDR_VARIANTS.indexOf(o.variant) >= 0 ? o.variant : 'standard';
  const backNameHtml = o.back && o.back.named && o.back.to ? ` <span class="hdr-back-to">${escapeHtml(o.back.to)}</span>` : '';
  const backHtml = o.back
    ? hdrButton('hdr-btn hdr-back', 'Back to ' + (o.back.to || ''), o.back.data, '<span aria-hidden="true">◀</span>' + backNameHtml)
    : '';
  const step = o.step;
  const titleAction = step && step.titleAction;
  const titleInnerHtml = titleAction
    ? `<button type="button" class="hdr-title-btn"${hdrDataAttrs(titleAction.data)} aria-label="${escapeAttr(titleAction.aria || '')}">${escapeHtml(o.title || '')}</button>`
    : escapeHtml(o.title || '');
  const titleHtml = o.title ? `<h2 class="hdr-title">${titleInnerHtml}</h2>` : '';
  /* The title stays in the left group unless ◀ ▶ step through it (the Day). */
  const titleInCentre = !!step && !o.context;
  const labelIdAttr = step && step.labelId ? ` id="${escapeAttr(step.labelId)}"` : '';
  const stepMiddleHtml = titleInCentre ? titleHtml
    : `<span class="hdr-label"${labelIdAttr}>${escapeHtml(o.context || '')}</span>`;
  const centreInner = step
    ? hdrStepButton(step.prev, '◀') + stepMiddleHtml + hdrStepButton(step.next, '▶')
    : o.centre ? o.centre
    : o.context ? escapeHtml(o.context) : '';
  const centreHtml = centreInner ? `<div class="hdr-context">${centreInner}</div>` : '';
  const leadHtml = o.lead ? `<div class="hdr-lead">${o.lead}</div>` : '';
  const startHtml = `<div class="hdr-start">${backHtml}${leadHtml}${titleInCentre ? '' : titleHtml}</div>`;
  const toolsHtml = o.tools ? `<div class="hdr-tools">${o.tools}</div>` : '';
  const actionsHtml = (o.actions || []).slice(0, HDR_MAX_ACTIONS)
    .map(a => hdrButton('hdr-btn' + (a.cls ? ' ' + a.cls : ''), a.aria, a.data, escapeHtml(a.label || ''), null, a.pressed))
    .join('');
  const actionsWrapHtml = actionsHtml ? `<div class="hdr-actions">${actionsHtml}</div>` : '';
  const badgeHtml = o.badge ? hdrBadgeHtml(o.badge) : '';
  const endHtml = `<div class="hdr-end">${toolsHtml}${actionsWrapHtml}${badgeHtml}</div>`;
  const rowCls = centreHtml ? 'hdr-row' : 'hdr-row hdr-row--ends';
  const subHtml = o.sub || '';
  const lowerHtml = !subHtml ? ''
    : variant === 'meeting' ? `<div class="hdr-r2">${subHtml}</div>`
    : `<div class="hdr-sub">${subHtml}</div>`;
  const printCls = o.noPrint ? ' no-print' : '';
  const surfaceAttr = o.moneySurface ? ' data-money-surface' : '';
  return `<header class="hdr ${HDR_VARIANT_CLASS[variant]}${printCls}"${surfaceAttr}><div class="${rowCls}">${startHtml}${centreHtml}${endHtml}</div>${lowerHtml}</header>`;
}

/* ── The kid screens' headers (PR 4) ──
   Today, Week, Day, Sister Sync and Print each keep one <header class="hdr …">
   as a direct child of their screen; hdrMount swaps it for a fresh pageHeader
   on every render of that screen, so the header always says what the screen
   under it says. The money pages draw theirs at the top of their wrap
   (mnyHead, js/22). Their buttons carry data-hdr-action, answered by
   kidHeadClick below — bound once per screen in js/99-main.js
   (KID_HEAD_SCREENS), delegated like every rebuilt surface here. */
const KID_HEAD_SCREENS = ['screen-today', 'screen-week', 'screen-day', 'screen-sync', 'screen-print',
  'screen-mymoney', 'screen-moneyschool', 'screen-moneystory'];

function hdrMount(screenId, o) {
  const old = document.querySelector('#' + screenId + ' > header.hdr');
  if (old) old.outerHTML = pageHeader(o);
}

/* The profile badge on every kid header: the 52px round avatar at every
   width, as the owner's pictures draw it (D25), far right, opening the
   switcher. Its words are the one wording (profileBadgeParts, the two parts
   of profileBadgeText) in the aria-label: "Jenn, switch profile",
   "Parent (Jenn), switch profile". `id` is the screen's own badge id —
   applyMeetingLock hides the week's and the day's by id, so a header is
   mounted before the lock is applied. */
function kidHeadBadge(id, kid, asParent) {
  const parts = profileBadgeParts(kid, asParent);
  const aria = parts.name ? `${parts.name}, switch profile` : 'Switch profile';
  return { id, icon: parts.icon, text: parts.name, avatar: true, aria, data: { 'hdr-action': 'profile' } };
}

function kidHeadClick(e) {
  const el = e.target.closest('button');
  if (!el || !el.dataset.hdrAction) return;
  switch (el.dataset.hdrAction) {
    case 'profile': openProfileSwitcher(); break;
    case 'back': navReturnBack(el.dataset.hdrFallback || 'week'); break;
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
  module.exports = { pageHeader, HDR_VARIANTS, HDR_MAX_ACTIONS };
}
