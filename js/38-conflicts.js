// Weekly-Planner — the conflict chooser (parent-only).
//
// Two devices edited the same record while neither could see the other. The
// merge layer (js/04-merge.js) shows the newer stamp and keeps the other whole,
// because a stamp orders two writes and says nothing about which one holds the
// better information. This is where a grown-up says which is right.
//
// It owns no data and no rules. reflGet, mnyGetPlan and the rest still own
// their records; this hands one of two versions the app already holds back to
// the writer that owns it, and marks the row resolved.
//
// Parent-only, deliberately. The girls keep seeing the version the merge chose
// and are never shown a warning about a sync — it is not theirs to fix, and a
// child told her reflection is "in conflict" learns only that the app is
// unreliable.

/* What kind of record is this, in words a parent can act on? The store names
   are the merge layer's; nobody outside it should have to know them. */
const CF_STORE_LABEL = {
  reflections: { icon: '💭', noun: 'reflection', what: 'what she said about her week' },
  weekPlans:   { icon: '💰', noun: 'money plan',  what: 'what she decided to do with her money' },
  weekConfirms:{ icon: '✅', noun: 'week confirmation', what: 'what a grown-up agreed to' },
};
function cfLabel(store) {
  return CF_STORE_LABEL[store] || { icon: '📄', noun: store, what: 'a saved record' };
}
/* 'weekKey/kid' — the key the merge layer stored. Split for display. */
function cfKeyParts(key) {
  const [wk, kid] = String(key || '').split('/');
  return { wk: wk || '', kid: kid || '' };
}
function cfKidName(kid) {
  return kid === 'jenn' ? 'Jenn' : kid === 'jess' ? 'Jess' : (kid || 'someone');
}

/* What this version actually SAYS — not how much of it there is.

   The first draft counted ("2 things that went well · a problem named"), and
   the smoke check caught what that does: two versions of the same reflection
   almost always have the same shape, so both cards read identically and the
   screen asked a parent to choose between two things it refused to show them.
   A chooser that cannot distinguish its options is worse than no chooser — it
   makes a decision look considered when it was a coin toss.

   So it quotes her own words, trimmed to fit. It still derives nothing: every
   field is read off the record, and where there is nothing to show it says so
   rather than inventing a difference. */
function cfShort(text, max) {
  const t = String(text == null ? '' : text).trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return t.length > (max || 60) ? t.slice(0, (max || 60) - 1) + '…' : t;
}
function cfSummarise(store, rec) {
  if (!rec) return 'nothing recorded';
  if (store === 'reflections') {
    const bits = [];
    const well = (rec.wentWell || []).map(x => cfShort(x, 40)).filter(Boolean);
    if (well.length) bits.push('went well: ' + well.join(', '));
    const problem = cfShort(rec.problem || rec.problemText || rec.problemId, 50);
    if (problem) bits.push('problem: ' + problem);
    const action = (typeof reflActionText === 'function') ? reflActionText(rec) : (rec.actionText || '');
    if (action) bits.push('next time: ' + cfShort(action, 50));
    if (rec.parentObservation) bits.push('a grown-up added a note');
    if (rec.skippedAt) bits.push('set aside');
    if (rec.parentReviewedAt) bits.push('talked about');
    return bits.length ? bits.join(' · ') : 'started, nothing answered yet';
  }
  if (store === 'weekPlans') {
    const bits = [];
    if (rec.planId) bits.push(String(rec.planId));
    if (rec.note) bits.push(String(rec.note));
    return bits.length ? bits.join(' · ') : 'a plan with nothing chosen';
  }
  if (store === 'weekConfirms') {
    if (rec.reopenedAt) return `reopened by ${rec.by || 'a grown-up'}`;
    if (rec.at) return `confirmed by ${rec.by || 'a grown-up'}`;
    return 'not confirmed';
  }
  return 'a saved record';
}
/* When, in family time. Never a bare millisecond — the whole point of this
   screen is that the times are not the deciding factor. */
function cfWhen(rec) {
  const ts = Number(rec && (rec.updatedAt || rec.at)) || 0;
  if (!ts) return 'no time recorded';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: APP_TIMEZONE, day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(new Date(ts));
  } catch (e) { return 'no time recorded'; }
}

/* Choose one. It is written back through the store that owns the record, as a
   NEW version descending from the one chosen — so the other device sees an
   ordinary fast-forward rather than a second conflict, and the row closes
   everywhere on the next sync. */
function cfChoose(conflictId, versionIndex) {
  if (!isParent()) { showToast('Ask a grown-up 🔒'); return; }
  const list = (state.shared && state.shared.conflicts) || [];
  const row = list.find(c => c && c.id === conflictId);
  if (!row || row.resolvedAt) return;
  const chosen = (row.versions || [])[versionIndex];
  if (!chosen) return;

  const { wk, kid } = cfKeyParts(row.key);
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c[row.store]) c[row.store] = {};
  if (!c[row.store][wk]) c[row.store][wk] = {};
  /* A new version whose CONTENT is the one a person picked, and whose ancestry
     is the one every device is currently DISPLAYING.

     Those are deliberately different, and getting it wrong was the first thing
     the two-device test caught. Descending from the chosen version looks
     natural — it is the one being kept — but the other device is not holding
     that version, it is holding the one the merge put on screen. So the
     resolution read as yet another divergent edit and raised a SECOND conflict
     about the disagreement a person had just settled.

     baseOpId answers "what was on screen when this was decided", which is
     shownOpId. Content answers "and what should it say instead". Every device
     then sees an ordinary fast-forward and the row closes everywhere. */
  const next = JSON.parse(JSON.stringify(chosen));
  next.baseOpId = row.shownOpId || chosen.opId || null;
  next.opId = (typeof syncOpId === 'function') ? syncOpId() : null;
  next.updatedAt = syncNow();
  c[row.store][wk][kid] = next;

  row.resolvedAt = syncNow();
  row.resolvedOpId = next.opId;
  markItemUpdated(row);
  saveAll();
  cfRenderPanel();
  // And the banner, which lives outside this panel: without it the count sat
  // there claiming a decision was still waiting after it had been made.
  cfRenderBanner();
  showToast('Kept ✅');
}

/* The banner. It sits on the parent portal only, says how many and where to go,
   and is absent entirely when there is nothing to decide — a permanent badge
   for a rare event is a badge nobody reads. */
function cfBannerHtml() {
  const open = (typeof openConflicts === 'function') ? openConflicts() : [];
  if (!open.length) return '';
  const n = open.length;
  return `<div class="cf-banner">
      <span class="cf-banner-icon">🔀</span>
      <span class="cf-banner-text">${n === 1
        ? 'Two devices saved different versions of one record.'
        : `Two devices saved different versions of ${escapeHtml(String(n))} records.`}
        The newer one is showing.</span>
      <button type="button" class="pill-btn" data-cf-open="1">Have a look</button>
    </div>`;
}

/* One delegated listener for the banner and the panel both — data attributes
   rather than inline handlers, because a version's own text reaches this
   screen straight off a shared document. */
function cfHandleClick(e) {
  const open = e.target.closest('[data-cf-open]');
  if (open) { setParentTab('conflicts'); return; }
  const pick = e.target.closest('[data-cf-pick]');
  if (pick) { cfChoose(pick.dataset.cfPick, Number(pick.dataset.cfIndex)); return; }
}

/* Drawn on every parent panel, because the point is that it finds a grown-up
   rather than waiting to be looked for. Empty markup when there is nothing —
   see cfBannerHtml. */
function cfRenderBanner() {
  const host = document.getElementById('parentConflictBanner');
  if (!host) return;
  host.innerHTML = cfBannerHtml();
  host.hidden = !host.innerHTML;
}

function cfRenderPanel() {
  const wrap = document.getElementById('cfWrap');
  if (!wrap) return;
  const list = ((state.shared && state.shared.conflicts) || []).slice()
    .sort((a, b) => (a.resolvedAt ? 1 : 0) - (b.resolvedAt ? 1 : 0) || (b.at || 0) - (a.at || 0));
  const open = list.filter(c => !c.resolvedAt);

  if (!list.length) {
    wrap.innerHTML = `<h3 class="parent-h3">🔀 Two versions</h3>
      <p class="parent-hint">Nothing to decide. This page fills up only when two
      devices save different versions of the same record while neither can see
      the other — which needs both of them offline at once, so it is rare.</p>`;
    return;
  }

  const rows = list.map(c => {
    const lab = cfLabel(c.store);
    const { wk, kid } = cfKeyParts(c.key);
    const vs = (c.versions || []);
    const done = !!c.resolvedAt;
    const cards = vs.map((v, i) => {
      const isShown = c.shownOpId && v.opId === c.shownOpId;
      return `<div class="cf-version${isShown ? ' cf-version--shown' : ''}">
          <div class="cf-version-head">
            <span class="cf-version-what">${escapeHtml(cfSummarise(c.store, v))}</span>
            ${isShown ? '<span class="cf-tag">showing now</span>' : ''}
          </div>
          <div class="cf-version-when">saved ${escapeHtml(cfWhen(v))}</div>
          ${done ? '' : `<button type="button" class="btn-confirm cf-pick"
              data-cf-pick="${escapeAttr(c.id)}" data-cf-index="${i}">Keep this one</button>`}
        </div>`;
    }).join('');
    return `<div class="cf-row${done ? ' cf-row--done' : ''}">
        <div class="cf-row-head">
          <span class="cf-row-icon">${lab.icon}</span>
          <span class="cf-row-title">${escapeHtml(cfKidName(kid))}’s ${escapeHtml(lab.noun)} — week of ${escapeHtml(wk)}</span>
          ${done ? '<span class="cf-tag cf-tag--done">sorted</span>' : ''}
        </div>
        <p class="parent-hint cf-row-sub">${escapeHtml(lab.what)}. Both versions are here; pick the one that is right.</p>
        <div class="cf-versions">${cards}</div>
      </div>`;
  }).join('');

  wrap.innerHTML = `<h3 class="parent-h3">🔀 Two versions</h3>
    <p class="parent-hint">${open.length
      ? 'Two devices saved different versions of the same record while neither could see the other. The newer one is what everybody is looking at — but newer is not the same as right, so pick the one that is.'
      : 'Nothing waiting. Past decisions are kept below.'}</p>
    ${rows}`;
}
