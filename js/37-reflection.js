/* ════════════════════════════════════════════════════════════════
   THE WEEKLY REFLECTION — what a child says about her own week
   ════════════════════════════════════════════════════════════════

   Three questions, asked in this order and no other:

     Doing well   What went well?
     Needs work   What problem did you notice?
     Plan next    What will you do next time?

   The order is the point. A child who is asked what went wrong before she is
   asked what went right has been told what the conversation is about. And the
   third question is what stops the second from being a list of failures: a
   problem without a next step is an accusation.

   This file owns the RECORD and nothing else. Every number the screen shows is
   read through the accessor that already owns it — getWeeklyHours,
   getFamilyChoreStatus, isRoutineCompleted — and it writes nothing but the
   child's own answers. It grades nothing, moves no money, and changes no
   completion: a second place that decides how a chore went is a second place
   that can disagree with the first.

   ── Why the answers are a fixed list ──
   The meeting is a conversation, not a writing assignment. A nine-year-old
   asked to type an explanation writes less than she says, so she SAYS the
   answer and taps to record it. "I said it out loud" is a complete answer.
   `Something else` opens one short note a parent scribes.

   Stored by ID, never by display text, so rewording a prompt does not
   invalidate a year of history.
════════════════════════════════════════════════════════════════ */

/* Answer tables. Ids are permanent; text is not. */
const REFL_DOING_WELL = [
  { id: 'finished',  text: 'I finished what I planned' },
  { id: 'kept_at_it', text: 'I kept trying when it was difficult' },
  { id: 'asked',     text: 'I asked for help' },
  { id: 'improved',  text: 'I improved a skill' },
  { id: 'managed',   text: 'I managed my time' },
  { id: 'helped',    text: 'I helped the family' },
  { id: 'corrected', text: 'I corrected a mistake' },
  { id: 'other',     text: 'Something else' },
];

const REFL_NEEDS_WORK = [
  { id: 'distracted', text: 'I became distracted' },
  { id: 'said_done',  text: 'I said "done" before checking' },
  { id: 'avoided',    text: 'I avoided something difficult' },
  { id: 'forgot',     text: 'I forgot part of my plan' },
  { id: 'no_help',    text: 'I did not ask for help' },
  { id: 'rushed',     text: 'I rushed' },
  { id: 'unrealistic', text: 'My plan was unrealistic' },
  { id: 'other',      text: 'Something else' },
];

const REFL_PLAN_NEXT = [
  { id: 'check_pages', text: 'Check every page before saying "done"', fixes: ['said_done'] },
  { id: 'ask_after',   text: 'Ask for help after making a real attempt', fixes: ['no_help', 'avoided'] },
  { id: 'finish_first', text: 'Finish the current task before switching', fixes: ['distracted'] },
  { id: 'timer',       text: 'Use a timer', fixes: ['distracted', 'rushed'] },
  { id: 'prep_night',  text: 'Prepare equipment the night before', fixes: ['forgot'] },
  { id: 'repeat_back', text: 'Repeat the instruction before starting', fixes: ['forgot', 'rushed'] },
  { id: 'follow_plan', text: 'Follow the plan before asking to change it', fixes: ['unrealistic'] },
  { id: 'other',       text: 'Custom action' },
];

const REFL_MAX_NOTE = 160;      // one short line, scribed by a parent
const REFL_MAX_WELL = 2;        // at most two, so the meeting stays focused

/* ── The record ───────────────────────────────────────────────────
   state.shared.chore.reflections[weekKey][kid], matching weekConfirms and
   weekPlans — the same two-level shape, in the same container, arbitrated the
   same way. mergeSharedChore (js/04-merge.js) takes the whole per-kid record
   from the strictly-newer side, which is what makes UNTICKING an answer stick:
   deepMergeObj treats an array as a scalar, so a plain union would let a stale
   device put a removed answer back. */
function reflEnsureStore() {
  ctEnsureShared();
  const c = state.shared.chore;
  if (!c.reflections) c.reflections = {};
  return c.reflections;
}

function reflBlank() {
  return {
    version: 1,
    doingWell: { answerIds: [], evidenceIds: [], customNote: '', inputMode: 'spoken' },
    needsWork: { answerId: '', evidenceIds: [], customNote: '', controllableText: '',
                 needsHelpFindingControl: false, parentObservation: '', inputMode: 'spoken' },
    planNext:  { actionId: '', customNote: '', actionText: '', whenText: '', helpText: '',
                 doneText: '', targetWeek: '', linkedBlockId: '', linkedRoutineId: '',
                 inputMode: 'spoken' },
    childCompletedAt: null,
    parentReviewedAt: null,
    skippedAt: null,
    updatedAt: 0,
  };
}

/* Read-only. Returns a blank record rather than null so every caller can read
   through it without guarding — an absent reflection and an empty one are the
   same thing to a reader. */
function reflGet(wk, kid) {
  const store = (state.shared && state.shared.chore && state.shared.chore.reflections) || {};
  return (store[wk] || {})[kid] || reflBlank();
}

/* ── The draft ────────────────────────────────────────────────────
   Every mutation in this app is a full-document Firestore upload with no
   debounce, and step 2 is the tap-heaviest screen in it: three tabs of chips,
   two children, one sitting. Writing on every tap would be twenty uploads of
   the whole family document per child.

   So a tap edits a module-local draft and the record is committed on the moves
   that mean the child has finished with a tab — switching tab, switching child,
   closing the meeting, and the parent's "we talked about this". Three writes
   instead of twenty. The draft is per device and never synced: it describes
   what THIS iPad is in the middle of. */
let reflDraft = null;    // { wk, kid, rec }

function reflWorking(wk, kid) {
  if (reflDraft && reflDraft.wk === wk && reflDraft.kid === kid) return reflDraft.rec;
  return reflGet(wk, kid);
}

function reflEdit(wk, kid, mutate) {
  if (!reflDraft || reflDraft.wk !== wk || reflDraft.kid !== kid) {
    reflDraft = { wk, kid, rec: JSON.parse(JSON.stringify(reflGet(wk, kid))) };
  }
  mutate(reflDraft.rec);
  return reflDraft.rec;
}

/* Write the draft through, once. Safe to call when there is nothing pending. */
function reflCommitDraft() {
  if (!reflDraft) return false;
  const { wk, kid, rec } = reflDraft;
  reflDraft = null;
  const store = reflEnsureStore();
  if (!store[wk]) store[wk] = {};
  rec.updatedAt = (typeof syncNow === 'function') ? syncNow() : Date.now();
  store[wk][kid] = rec;
  saveAll();
  return true;
}

/* ── Is a tab finished? ───────────────────────────────────────────
   Each answers its own question, and "finished" is deliberately low: one or two
   things that went well, one problem, one action. A reflection that demands
   more than that stops being a conversation. */
function reflTabComplete(rec, tab) {
  if (!rec) return false;
  if (tab === 'doingWell') {
    const d = rec.doingWell || {};
    if (!(d.answerIds || []).length) return false;
    // "Something else" is only an answer once somebody has written the else.
    if (d.answerIds.includes('other') && !(d.customNote || '').trim()) return false;
    return true;
  }
  if (tab === 'needsWork') {
    const n = rec.needsWork || {};
    if (!n.answerId) return false;
    if (n.answerId === 'other' && !(n.customNote || '').trim()) return false;
    /* Naming a cause is not the same as finding the part you can change, and
       the difference is the whole value of the question. "I need help finding
       one" is a real answer and closes the tab; silence does not. */
    return !!(n.controllableText || '').trim() || !!n.needsHelpFindingControl;
  }
  if (tab === 'planNext') {
    const p = rec.planNext || {};
    if (!p.actionId) return false;
    if (p.actionId === 'other' && !(p.customNote || '').trim()) return false;
    return true;
  }
  return false;
}

const REFL_TABS = [
  { id: 'doingWell', label: 'Doing well', prompt: 'What went well?' },
  { id: 'needsWork', label: 'Needs work', prompt: 'What problem did you notice?' },
  { id: 'planNext',  label: 'Plan next',  prompt: 'What will you do next time?' },
];

function reflDoneCount(rec) {
  return REFL_TABS.filter(t => reflTabComplete(rec, t.id)).length;
}

/* Complete when all three are, or explicitly skipped. Skipping is a state, not
   an absence: a difficult reflection must not be able to trap the family and
   block the money, and it must not be quietly recorded as done either. */
function reflIsComplete(rec) { return reflDoneCount(rec) === REFL_TABS.length; }
function reflIsSkipped(rec) { return !!(rec && rec.skippedAt); }

/* ── Evidence ─────────────────────────────────────────────────────
   What the week SHOWS, offered underneath her own answer and never above it.
   Nothing here selects anything: a suggestion that fills in the answer has
   answered for her, which is the one thing this screen must not do.

   Every line is read through the accessor that already owns that fact. This
   file computes no totals of its own. */
function reflEvidence(wk, kid, tab) {
  const out = [];
  const add = (id, text) => { if (out.length < 5) out.push({ id, text }); };
  const info = (typeof ctWeekInfo === 'function') ? ctWeekInfo() : { keys: [] };

  if (tab === 'doingWell') {
    let rDone = 0, rTotal = 0;
    (info.keys || []).forEach(key => {
      (getDayBlocksForProfile(key, kid) || []).forEach(b => {
        const act = findActivity(b.actId, kid);
        if (!act || !act.isRoutine) return;
        rTotal++;
        if (isRoutineCompleted(b, kid)) rDone++;
      });
    });
    if (rTotal && rDone === rTotal) add('routines_all', `You kept all ${rTotal} of your routines.`);
    else if (rDone) add('routines_some', `You kept ${rDone} of ${rTotal} routines.`);

    const fam = getFamilyChoreStatus(kid, wk);
    if (fam.fulfilled) add('chores', `${fam.fulfilled} family chore${fam.fulfilled === 1 ? '' : 's'} checked off by a grown-up.`);

    const h = getWeeklyHours(kid, wk);
    if (h.planned && h.completed) {
      add('hours', `${fmtHrsMin(h.completed)} of ${fmtHrsMin(h.planned)} planned hours completed.`);
    }
    if (typeof ctGetGoalBonus === 'function' && ctGetGoalBonus(wk, kid)) {
      add('goal', 'You reached your weekly goal.');
    }
  }

  if (tab === 'needsWork') {
    const fam = getFamilyChoreStatus(kid, wk);
    if (fam.required > fam.fulfilled) {
      add('chores_short', `${fam.required - fam.fulfilled} family chore${fam.required - fam.fulfilled === 1 ? '' : 's'} still owed.`);
    }
    let missed = 0;
    (info.keys || []).forEach(key => {
      (getDayBlocksForProfile(key, kid) || []).forEach(b => {
        if (key > todayKey()) return;
        if (!isBlockCompleted(b, kid)) missed++;
      });
    });
    if (missed) add('not_done', `${missed} planned block${missed === 1 ? '' : 's'} not marked done.`);
    const unreviewed = (info.keys || []).filter(k => k <= todayKey() && !isDayReviewed(kid, k)).length;
    if (unreviewed) add('unreviewed', `${unreviewed} day${unreviewed === 1 ? '' : 's'} not reviewed yet.`);
    /* A clash is the week's own finding, drawn the week's way. Asked, not
       recomputed — computeBufferConflicts owns it. */
    let clashes = 0;
    (info.keys || []).forEach(key => {
      const blocks = getDayBlocksForProfile(key, kid) || [];
      if (typeof computeBufferConflicts === 'function') {
        clashes += computeBufferConflicts(blocks).affected.size;
      }
    });
    if (clashes) add('clash', `${clashes} block${clashes === 1 ? '' : 's'} ran into something else.`);
  }
  return out;
}

/* Which actions connect to the problem she chose. A suggestion, drawn first in
   the list — never preselected, and never the only thing offered. */
function reflSuggestedActions(problemId) {
  if (!problemId) return [];
  return REFL_PLAN_NEXT.filter(a => (a.fixes || []).includes(problemId)).map(a => a.id);
}

/* ════════════════════════════════════════════════════════════════
   STEP 2 — Reflect & celebrate
   ════════════════════════════════════════════════════════════════
   One child at a time, three tabs, and the child's own answer above the
   evidence rather than below it. Everything rides on data attributes and the
   meeting's one delegated listener — nothing is interpolated into an inline
   handler, which is the hole escapeJsAttr exists to plug and the pattern
   CLAUDE.md asks for in new code.

   The word budget bites here: three tabs of eight answers is far past the 200
   a kid screen gets, so only the open tab's answers are drawn, the evidence
   ships behind a fold, and the four Plan-next fields are one line each. */

let reflTab = 'doingWell';   // which tab is open; per device, per sitting
let reflEvidenceOpen = false;

function reflSetTab(tab) {
  if (!REFL_TABS.some(t => t.id === tab)) return;
  reflCommitDraft();          // leaving a tab is a natural place to write
  reflTab = tab;
  renderMeetingMode();
}
function reflToggleEvidence() { reflEvidenceOpen = !reflEvidenceOpen; renderMeetingMode(); }

/* The chips a child taps. Each carries its id in a data attribute and nothing
   else — the label is text, never markup, and never part of a handler. */
function reflChip(id, text, on, action, extra) {
  return `<button type="button" class="refl-chip${on ? ' on' : ''}"
      data-mm-action="${action}" data-refl-id="${escapeAttr(id)}"${extra || ''}
      aria-pressed="${on ? 'true' : 'false'}">${escapeHtml(text)}</button>`;
}

function reflRenderEvidence(wk, kid, tab) {
  const items = reflEvidence(wk, kid, tab);
  if (!items.length) return '';
  return `<div class="refl-ev">
      <button type="button" class="refl-ev-toggle" data-mm-action="refl-evidence"
        aria-expanded="${reflEvidenceOpen ? 'true' : 'false'}"
        >${reflEvidenceOpen ? '▾' : '▸'} What the week shows (${items.length})</button>
      ${reflEvidenceOpen ? `<div class="refl-ev-list">${items.map(i =>
        `<div class="refl-ev-item">${escapeHtml(i.text)}</div>`).join('')}</div>` : ''}
    </div>`;
}

function reflRenderDoingWell(wk, kid, rec) {
  const d = rec.doingWell || {};
  const picked = d.answerIds || [];
  const full = picked.length >= REFL_MAX_WELL;
  return `<p class="refl-prompt">What went well?</p>
    <p class="refl-say">Say it out loud first — then tap up to ${REFL_MAX_WELL}.</p>
    <div class="refl-chips">${REFL_DOING_WELL.map(a =>
      reflChip(a.id, a.text, picked.includes(a.id), 'refl-well',
        (!picked.includes(a.id) && full) ? ' disabled' : '')).join('')}</div>
    ${picked.includes('other') ? reflNote(d.customNote, 'refl-well-note', 'What was it?') : ''}
    ${reflRenderEvidence(wk, kid, 'doingWell')}`;
}

function reflRenderNeedsWork(wk, kid, rec) {
  const n = rec.needsWork || {};
  return `<p class="refl-prompt">What problem did you notice?</p>
    <p class="refl-say">One thing you can do something about — not a list.</p>
    <div class="refl-chips">${REFL_NEEDS_WORK.map(a =>
      reflChip(a.id, a.text, n.answerId === a.id, 'refl-problem')).join('')}</div>
    ${n.answerId === 'other' ? reflNote(n.customNote, 'refl-problem-note', 'What was it?') : ''}
    ${n.answerId ? `<p class="refl-prompt refl-prompt--sub">What part was in your control?</p>
      ${reflNote(n.controllableText, 'refl-control', 'The part I can change is…')}
      <button type="button" class="refl-chip${n.needsHelpFindingControl ? ' on' : ''}"
        data-mm-action="refl-needhelp">I need help finding one</button>` : ''}
    ${reflRenderEvidence(wk, kid, 'needsWork')}`;
}

function reflRenderPlanNext(wk, kid, rec) {
  const p = rec.planNext || {};
  const n = rec.needsWork || {};
  const suggested = reflSuggestedActions(n.answerId);
  /* Suggested first, so the connection to the problem she named is visible.
     Never preselected: the app may say which action fits, and must not choose. */
  const ordered = [...REFL_PLAN_NEXT].sort((a, b) =>
    (suggested.indexOf(b.id) >= 0 ? 1 : 0) - (suggested.indexOf(a.id) >= 0 ? 1 : 0));
  const FIELDS = [
    ['whenText', 'When or where?', 'Friday at 4:00 pm'],
    ['helpText', 'If I am stuck?', 'Ask after trying for five minutes'],
    ['doneText', 'How will we know?', 'No blank page left without a note'],
  ];
  return `<p class="refl-prompt">What will you do next time?</p>
    <p class="refl-say">One thing somebody could watch you do.</p>
    <div class="refl-chips">${ordered.map(a =>
      reflChip(a.id, a.text, p.actionId === a.id, 'refl-action',
        suggested.includes(a.id) ? ' data-refl-suggested="1"' : '')).join('')}</div>
    ${p.actionId === 'other' ? reflNote(p.customNote, 'refl-action-note', 'What will you do?') : ''}
    ${p.actionId ? FIELDS.map(([f, label, eg]) =>
      `<label class="refl-field"><span>${escapeHtml(label)}</span>
         ${reflNote(p[f], 'refl-' + f.replace('Text', ''), eg)}</label>`).join('') : ''}`;
}

/* One short line, scribed by whoever is holding the iPad. Capped, escaped, and
   matched by data-mm-field so the meeting's own re-render restores the caret. */
function reflNote(value, field, placeholder) {
  return `<input type="text" class="refl-note" maxlength="${REFL_MAX_NOTE}"
      data-mm-field="${escapeAttr(field)}" data-refl-field="${escapeAttr(field)}"
      value="${escapeAttr(value || '')}" placeholder="${escapeAttr(placeholder)}">`;
}

function mmRenderReflect(wk) {
  const kid = mnyMeetingKid();
  const rec = reflWorking(wk, kid);
  const tab = REFL_TABS.find(t => t.id === reflTab) || REFL_TABS[0];
  const body = tab.id === 'doingWell' ? reflRenderDoingWell(wk, kid, rec)
             : tab.id === 'needsWork' ? reflRenderNeedsWork(wk, kid, rec)
             : reflRenderPlanNext(wk, kid, rec);
  const name = kid === 'jenn' ? 'Jenn' : 'Jess';
  const skipped = reflIsSkipped(rec);

  return `<div class="mm-h">Reflect &amp; celebrate</div>
    <div class="refl-kids">${['jenn', 'jess'].map(k => {
      const r = reflWorking(wk, k);
      return `<button type="button" class="refl-kid${k === kid ? ' on' : ''}"
          data-mm-action="refl-kid" data-kid="${escapeAttr(k)}"
          >${CT_PROFILE_ICON[k]} ${escapeHtml(k === 'jenn' ? 'Jenn' : 'Jess')}
          <span class="refl-kid-n">${reflDoneCount(r)}/${REFL_TABS.length}</span></button>`;
    }).join('')}</div>
    <div class="refl-tabs">${REFL_TABS.map(t =>
      `<button type="button" class="refl-tab${t.id === tab.id ? ' on' : ''}${reflTabComplete(rec, t.id) ? ' done' : ''}"
         data-mm-action="refl-tab" data-refl-tab="${escapeAttr(t.id)}"
         >${escapeHtml(t.label)}${reflTabComplete(rec, t.id) ? ' ✓' : ''}</button>`).join('')}</div>
    <div class="refl-body">${body}</div>
    ${reflIsComplete(rec) ? `<div class="refl-card">
        <div><b>Next week I will:</b> ${escapeHtml(reflActionText(rec))}</div>
        ${rec.planNext.whenText ? `<div><b>When:</b> ${escapeHtml(rec.planNext.whenText)}</div>` : ''}
        ${rec.planNext.helpText ? `<div><b>If I am stuck:</b> ${escapeHtml(rec.planNext.helpText)}</div>` : ''}
        ${rec.planNext.doneText ? `<div><b>We will check:</b> ${escapeHtml(rec.planNext.doneText)}</div>` : ''}
      </div>` : ''}
    <div class="refl-foot">
      <button type="button" class="btn-confirm refl-talked${rec.parentReviewedAt ? ' on' : ''}"
        data-mm-action="refl-talked" data-kid="${escapeAttr(kid)}"
        >${rec.parentReviewedAt ? `✓ We talked about ${escapeHtml(name)}'s reflection`
                                : `We talked about ${escapeHtml(name)}'s reflection`}</button>
      <button type="button" class="pill-btn" data-mm-action="refl-skip" data-kid="${escapeAttr(kid)}"
        >${skipped ? 'Skipped — pick it back up' : 'Skip for now'}</button>
    </div>
    ${skipped ? `<p class="mm-cap">Left unfinished on purpose. It does not hold up the money.</p>` : ''}
    <div class="mm-h mm-h-sub">Planned vs completed</div>
    <div class="mm-2b">${mm2b('jenn', mm2bScale(wk))}${mm2b('jess', mm2bScale(wk))}</div>
    <div class="mm-cap">Solid = planned hours completed · dashed = planned, on one scale for both girls. The app records which planned blocks were finished, not how long anything took.</div>
    <div class="mm-blocklink">${['jenn', 'jess'].map(k =>
      `<button type="button" class="pill-btn" data-mm-action="openweek" data-kid="${escapeAttr(k)}"
        >${CT_PROFILE_ICON[k]} Open ${escapeHtml(k === 'jenn' ? 'Jenn' : 'Jess')}'s week ›</button>`).join('')}
      <span class="mm-cap">Ticking and confirming blocks happens there, not here.</span></div>`;
}

/* The label the summary card shows. Frozen at display time from the fixed list
   or the parent's note, so a later rewording of an answer does not change what
   a past week says she decided. */
function reflActionText(rec) {
  const p = (rec && rec.planNext) || {};
  if (p.actionId === 'other') return p.customNote || '';
  const a = REFL_PLAN_NEXT.find(x => x.id === p.actionId);
  return a ? a.text : '';
}

/* ── The taps ─────────────────────────────────────────────────────
   Every one of these edits the DRAFT. Nothing here writes to the document; see
   reflCommitDraft for where that happens and why. */
function reflHandleAction(a, el, wk) {
  const kid = mnyMeetingKid();
  const id = el.getAttribute('data-refl-id') || '';
  if (a === 'refl-kid') {
    reflCommitDraft();
    mnySetMeetKid(el.getAttribute('data-kid'));
    return true;
  }
  if (a === 'refl-tab')      { reflSetTab(el.getAttribute('data-refl-tab')); return true; }
  if (a === 'refl-evidence') { reflToggleEvidence(); return true; }
  if (a === 'refl-well') {
    reflEdit(wk, kid, r => {
      const list = r.doingWell.answerIds;
      const at = list.indexOf(id);
      if (at >= 0) list.splice(at, 1);
      else if (list.length < REFL_MAX_WELL) list.push(id);
      if (!list.includes('other')) r.doingWell.customNote = '';
    });
    renderMeetingMode(); return true;
  }
  if (a === 'refl-problem') {
    reflEdit(wk, kid, r => {
      // Tapping the chosen problem again takes it back; the tab reopens.
      r.needsWork.answerId = (r.needsWork.answerId === id) ? '' : id;
      if (r.needsWork.answerId !== 'other') r.needsWork.customNote = '';
    });
    renderMeetingMode(); return true;
  }
  if (a === 'refl-needhelp') {
    reflEdit(wk, kid, r => {
      r.needsWork.needsHelpFindingControl = !r.needsWork.needsHelpFindingControl;
    });
    renderMeetingMode(); return true;
  }
  if (a === 'refl-action') {
    reflEdit(wk, kid, r => {
      r.planNext.actionId = (r.planNext.actionId === id) ? '' : id;
      if (r.planNext.actionId !== 'other') r.planNext.customNote = '';
      r.planNext.actionText = reflActionText(r);
    });
    renderMeetingMode(); return true;
  }
  if (a === 'refl-talked') {
    /* Records that the conversation happened. It asserts nothing about whether
       the parent agrees, and it changes no completion, grade, XP or money. */
    reflEdit(wk, kid, r => {
      r.parentReviewedAt = r.parentReviewedAt ? null : Date.now();
    });
    reflCommitDraft();
    renderMeetingMode(); return true;
  }
  if (a === 'refl-skip') {
    reflEdit(wk, kid, r => { r.skippedAt = r.skippedAt ? null : Date.now(); });
    reflCommitDraft();
    renderMeetingMode(); return true;
  }
  return false;
}

/* The scribed notes. Typed into the draft on input and written through with
   everything else — the meeting's own caret restore (data-mm-field) is what
   keeps the field usable across the re-render each tap causes. */
function reflHandleInput(e, wk) {
  const el = e.target.closest('[data-refl-field]');
  if (!el) return;
  const field = el.getAttribute('data-refl-field');
  const val = String(el.value || '').slice(0, REFL_MAX_NOTE);
  const kid = mnyMeetingKid();
  reflEdit(wk, kid, r => {
    if (field === 'refl-well-note')    r.doingWell.customNote = val;
    if (field === 'refl-problem-note') r.needsWork.customNote = val;
    if (field === 'refl-control')      r.needsWork.controllableText = val;
    if (field === 'refl-action-note') { r.planNext.customNote = val; r.planNext.actionText = reflActionText(r); }
    if (field === 'refl-when')         r.planNext.whenText = val;
    if (field === 'refl-help')         r.planNext.helpText = val;
    if (field === 'refl-done')         r.planNext.doneText = val;
  });
}

/* Node-side tests reach the pure helpers through this; the browser never sees
   it (js/04-merge.js, js/18-rules.js and js/21-money-data.js carry the same
   guard). */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { REFL_DOING_WELL, REFL_NEEDS_WORK, REFL_PLAN_NEXT, REFL_TABS,
                     reflBlank, reflTabComplete, reflDoneCount, reflIsComplete,
                     reflSuggestedActions, REFL_MAX_NOTE, REFL_MAX_WELL };
}
