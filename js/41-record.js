/* ════════════════════════════════════════════════════════════════
   THE RECORD SHEET — one door, five records
   ════════════════════════════════════════════════════════════════

   Stage 3 of the money redesign. Every fact the money system rests on had its
   own entry road and none of them met:

   - a MEET could only be recorded inside the Sunday meeting, or through
     `ctPromptCompetition`'s chain of ELEVEN sequential prompts — a dialog per
     question, no way back, and nothing on screen once you were three deep;
   - a GIFT went through `mnyPromptGift`'s four;
   - a FINE was a numbered list typed into a prompt box ("Which one? 1. …");
   - a CHORE GRADE was reachable only from the chore tab, on the week and day
     that tab happened to be showing;
   - a MOVE had no door at all until this stage built one.

   A prompt chain is the worst shape for a form: you cannot see what you have
   already answered, you cannot change an earlier answer, and abandoning it
   halfway leaves nothing. Every one of these is four to six fields on one
   screen, which is what this sheet is.

   ── It owns no rules ──

   Every row calls the function that already owned that write, the same
   contract Today keeps: CALL AN OWNER, NEVER CONTAIN ONE. A second place that
   decides what a grade is worth, or which week a gift belongs to, is a second
   place that can disagree with the first — and a child has no way to tell
   which one is lying.

   | Record        | Writes through                                    |
   |---------------|---------------------------------------------------|
   | 🧹 chore grade | `mrSetChoreGrade`                                 |
   | 🏆 meet result | `mrAddCompetition` / `mrUpdateCompetition`        |
   | 🎁 gift        | `mnyAddDeposit` / `mnyEditDeposit`                |
   | 📦 fine        | `mrAddFine`                                       |
   | 🔀 move        | `mnyMoveMoney` / `mnyRequestMove`                 |

   ── The draft is module-level, and that is load-bearing ──

   `rcRender` writes `innerHTML`, so every keystroke that re-renders would
   otherwise throw away the caret and every other field. Answers live in
   `rcDraft` and the DOM is drawn FROM it, the same shape the meeting uses for
   `mmCaptureUiState`. Only a change that alters what the form ASKS re-renders;
   typing does not.

   ── What a child may do ──

   Two of the five, and both as proposals: a gift she was given, and a move
   between her own pots. `mnyAddDeposit` and `mnyRequestMove` already carry the
   propose/approve gate, so this sheet adds no rule of its own — it just does
   not offer her the three that are a grown-up's judgement.
   ════════════════════════════════════════════════════════════════ */

const RC_KINDS = [
  { id: 'chore', icon: '🧹', label: 'A chore graded',   kid: false },
  { id: 'meet',  icon: '🏆', label: 'A meet result',    kid: false },
  { id: 'gift',  icon: '🎁', label: 'Money she was given', kid: true },
  { id: 'fine',  icon: '📦', label: 'Something owed',   kid: false },
  { id: 'move',  icon: '🔀', label: 'Move money',       kid: true },
];

/* The four sports the scoring rules know. `mrTagForSport` (js/18-rules.js)
   resolves a custom sport's activity tag and returns null rather than guessing,
   which is why this list is short and the form asks. */
const RC_SPORTS = [
  { id: 'swim',  label: '🏊 Swimming' },
  { id: 'skate', label: '⛸️ Skating' },
  { id: 'dance', label: '💃 Dance' },
];

const RC_HOMES = ['cash', 'ready', 'locked', 'invest'];

/* The whole form, in one object. Never read from the DOM: an input that has not
   been typed into yet has no value there, and a re-render would lose the rest. */
let rcDraft = null;

/* ── Opening ──────────────────────────────────────────────────────
   `kind` may be omitted, and then the sheet asks which record this is. Every
   other field pre-fills whatever the caller already knows — a tap on a
   competition block knows its day, its child and its name, and asking again is
   how a form makes somebody prove they meant it. */
function openRecordSheet(opts) {
  const o = opts || {};
  const kid = (o.kid === 'jenn' || o.kid === 'jess') ? o.kid
    : (isParent() ? (parentViewing === 'jess' ? 'jess' : 'jenn') : activeProfile());
  rcDraft = {
    kind: o.kind || null,
    kid,
    dayKey: o.dayKey || todayKey(),
    /* Editing rather than adding. A meet keeps its id so its block link
       survives; a gift keeps its id so the wallet moves by the difference. */
    id: o.id || null,
    name: o.name || '',
    sport: o.sport || '',
    points: 0, groupPlace: 0, overallPlace: 0,
    silver: 0, gold: 0, allGold: false,
    qualified: false, provincial: false, personalBest: false,
    amount: o.amount != null ? money2(o.amount) : 0,
    from: MNY_FROM[0], giver: '',
    choreId: o.choreId || '', grade: 3,
    fineId: '',
    moveFrom: 'cash', moveTo: 'ready', why: '',
  };
  rcDraft.moveTo = rcDefaultMoveTo(kid, rcDraft.moveFrom);
  if (o.id && o.kind === 'meet') rcLoadMeet();
  if (o.id && o.kind === 'gift') rcLoadGift();
  openSheet('recordOverlay');
  rcRender();
}

function rcLoadMeet() {
  const e = mrCompetitions(rcDraft.kid).find(c => c && c.id === rcDraft.id);
  if (!e) { rcDraft.id = null; return; }
  const p = e.placement || {}, d = e.danceItems || {};
  Object.assign(rcDraft, {
    dayKey: e.dayKey, name: e.name || '', sport: e.sport || '',
    points: Number(e.points) || 0,
    groupPlace: Number(p.group) || 0, overallPlace: Number(p.overall) || 0,
    silver: Number(d.silver) || 0, gold: Number(d.gold) || 0, allGold: !!d.allGold,
    qualified: !!e.qualified, provincial: !!e.provincial, personalBest: !!e.personalBest,
  });
}
function rcLoadGift() {
  const d = mnyEnsureDeposits(rcDraft.kid).find(x => x && x.id === rcDraft.id);
  if (!d) { rcDraft.id = null; return; }
  Object.assign(rcDraft, {
    amount: money2(d.amount), from: d.from || MNY_FROM[0],
    giver: d.giver || '', dayKey: d.dayKey || todayKey(),
  });
}

/* Where a move goes unless she says otherwise: the first pot OTHER than the
   source that is open to her. It was always 'ready', so for a child whose
   ladder has not opened kept-ready the form opened on a refusal, and moving
   out of kept-ready opened on "that is already where it is". Cash is always
   open; 'ready' stays the fallback so a form with nothing open still says why. */
function rcDefaultMoveTo(kid, from) {
  const open = RC_HOMES.find(h => h !== from && (h === 'cash' || evHomeOpen(kid, h)));
  return open || 'ready';
}

/* Which records this person may make. A child gets the two that are hers to
   report; the other three are a grown-up's judgement about her week. */
function rcKindsFor() {
  return isParent() ? RC_KINDS : RC_KINDS.filter(k => k.kid);
}

function closeRecordSheet() { rcDraft = null; closeSheet('recordOverlay'); }

/* ── Drawing ──────────────────────────────────────────────────── */
function rcRender() {
  const host = document.getElementById('recordBody');
  if (!host || !rcDraft) return;
  const kinds = rcKindsFor();
  const chips = kinds.map(k =>
    `<button type="button" class="rc-chip${rcDraft.kind === k.id ? ' on' : ''}"
       data-rc-action="kind" data-rc-id="${k.id}">${k.icon} ${escapeHtml(k.label)}</button>`).join('');

  const who = (isParent() && !rcDraft.id) ? `
    <div class="rc-row"><span class="rc-lab">Who</span>
      <span class="rc-chiprow">${['jenn', 'jess'].map(k => {
        const l = kidLabel(k);
        return `<button type="button" class="rc-chip${rcDraft.kid === k ? ' on' : ''}"
          data-rc-action="kid" data-rc-id="${k}">${l.icon} ${escapeHtml(l.name)}</button>`;
      }).join('')}</span></div>` : '';

  let body = '', foot = '';
  if (!rcDraft.kind) {
    body = `<p class="rc-note">What happened? Everything here is recorded once and
      can be corrected afterwards — nothing is final until the week is settled.</p>`;
  } else {
    const parts = {
      chore: rcChoreForm, meet: rcMeetForm, gift: rcGiftForm,
      fine: rcFineForm, move: rcMoveForm,
    }[rcDraft.kind];
    body = parts ? parts() : '';
    const sv = rcSaveState();
    foot = `<div class="rc-foot">
        <button type="button" class="rc-btn ${sv.cls}" data-rc-action="save"${sv.disabled ? ' disabled' : ''}>${escapeHtml(sv.text)}</button>
        <button type="button" class="rc-btn" data-rc-action="close">Not now</button>
      </div>`;
  }
  host.innerHTML = `<div class="rc-chiprow rc-kinds">${chips}</div>${who}${body}${foot}`;
  if (typeof enhanceNonButtonClickables === 'function') enhanceNonButtonClickables(host);
}

/* The save button's text, class and whether it can be pressed — ONE answer,
   read by `rcRender` when it draws the button and by `rcSyncSave` when typing
   updates it in place, so the two can never disagree.

   A refused move says WHY on the button itself, before the tap — the same
   sentence the owner would refuse with, from mnyMoveRefusal. The owner still
   refuses on its own; `disabled` is the hint, not the rule. */
function rcSaveState() {
  const refused = rcDraft.kind === 'move'
    ? mnyMoveRefusal(rcDraft.kid, rcDraft.moveFrom, rcDraft.moveTo, rcDraft.amount) : null;
  return refused
    ? { text: refused, cls: 'rc-no', disabled: true }
    : { text: rcSaveLabel(), cls: 'primary', disabled: false };
}

/* Typing never re-renders (see the draft note at the top): `innerHTML` would
   replace the input she is typing in and drop the focus — on an iPad the
   keyboard closes after every digit. So a keystroke that changes what the
   button says updates the button, and only the button. */
function rcSyncSave() {
  const b = document.querySelector('#recordBody [data-rc-action="save"]');
  if (!b || !rcDraft) return;
  const sv = rcSaveState();
  if (b.textContent !== sv.text) b.textContent = sv.text;
  b.classList.toggle('rc-no', sv.cls === 'rc-no');
  b.classList.toggle('primary', sv.cls === 'primary');
  b.disabled = sv.disabled;
}

/* The button says what pressing it DOES. "Save" on a screen that is about to
   move a child's money, or ask a grown-up on her behalf, is the button telling
   her less than it knows. */
function rcSaveLabel() {
  if (rcDraft.kind === 'move') return isParent() ? 'Move it' : 'Ask a grown-up';
  if (rcDraft.kind === 'gift' && !isParent()) return 'Ask a grown-up';
  return rcDraft.id ? 'Save the correction' : 'Record it';
}

function rcField(label, action, value, type, extra) {
  return `<label class="rc-row"><span class="rc-lab">${escapeHtml(label)}</span>
    <input class="rc-input" type="${type || 'text'}" value="${escapeAttr(String(value == null ? '' : value))}"
      data-rc-action="${action}"${extra || ''}></label>`;
}
function rcToggle(label, action, on) {
  return `<button type="button" class="rc-toggle${on ? ' on' : ''}" data-rc-action="${action}"
    role="switch" aria-checked="${on ? 'true' : 'false'}">${escapeHtml(label)}</button>`;
}

/* ── 🧹 A chore graded ──
   The pool row for the day, and the four grades the parent grader already
   uses. `CP_GRADES` is read rather than restated: two tables of grades is how
   the wording on two screens comes apart. */
function rcChoreForm() {
  const wk = mnyWeekOfDay(rcDraft.dayKey);
  const dayIdx = mrWeekDayKeys(wk).indexOf(rcDraft.dayKey);
  const found = dayIdx >= 0 ? mrChoresForDay(rcDraft.kid, wk, dayIdx) : { rows: [] };
  if (!found.rows.length) {
    return `${rcField('Which day', 'day', rcDraft.dayKey, 'date')}
      <p class="rc-note">No chores are in the pool for this day. The pool is where a
      chore is described — Money rules › Chores — and this sheet grades what is in it.</p>`;
  }
  const rows = found.rows.map(r =>
    `<button type="button" class="rc-chip${rcDraft.choreId === r.row.id ? ' on' : ''}"
       data-rc-action="chore" data-rc-id="${escapeAttr(r.row.id)}">${escapeHtml(r.row.label)}</button>`).join('');
  const grades = CP_GRADES.map(g =>
    `<button type="button" class="rc-chip${rcDraft.grade === g.g ? ' on' : ''}"
       data-rc-action="grade" data-rc-id="${g.g}">${escapeHtml(g.label)}</button>`).join('');
  return `${rcField('Which day', 'day', rcDraft.dayKey, 'date')}
    <div class="rc-row"><span class="rc-lab">Which chore</span><span class="rc-chiprow">${rows}</span></div>
    <div class="rc-row"><span class="rc-lab">How it went</span><span class="rc-chiprow">${grades}</span></div>
    <p class="rc-note">Not done is a real answer and pays nothing. It is not the same as
    leaving a chore ungraded, which is a question nobody has answered yet.</p>`;
}

/* ── 🏆 A meet result ──
   Eleven prompts, on one screen. The award is frozen at entry against the
   rules live on the DATE, so the date is asked before anything else. */
function rcMeetForm() {
  const sports = RC_SPORTS.map(s =>
    `<button type="button" class="rc-chip${rcDraft.sport === s.id ? ' on' : ''}"
       data-rc-action="sport" data-rc-id="${s.id}">${escapeHtml(s.label)}</button>`).join('');
  let scoring = '';
  if (rcDraft.sport === 'dance') {
    scoring = `${rcField('Silver items', 'silver', rcDraft.silver, 'number', ' min="0"')}
      ${rcField('Gold items', 'gold', rcDraft.gold, 'number', ' min="0"')}
      <div class="rc-chiprow">${rcToggle('All Gold', 'allgold', rcDraft.allGold)}</div>`;
  } else if (rcDraft.sport === 'swim') {
    scoring = `${rcField('Points scored', 'points', rcDraft.points, 'number', ' min="0"')}
      <div class="rc-chiprow">
        ${rcToggle('Qualified for Provincials', 'qualified', rcDraft.qualified)}
        ${rcToggle('This WAS Provincials', 'provincial', rcDraft.provincial)}
      </div>`;
  } else if (rcDraft.sport === 'skate') {
    scoring = `${rcField('Points scored', 'points', rcDraft.points, 'number', ' min="0"')}
      ${rcField('Placed in her group (0 for none)', 'groupplace', rcDraft.groupPlace, 'number', ' min="0" max="3"')}
      ${rcField('Placed overall (0 for none)', 'overallplace', rcDraft.overallPlace, 'number', ' min="0" max="3"')}`;
  }
  const linked = rcDraft.id
    ? `<p class="rc-note">Moving the date moves the 🏆 block on the calendar with it —
       a meet left behind on the old day is a second meet nobody held.</p>`
    : `<p class="rc-note">Recording this puts a 🏆 block on that day if there is not one
       already: 8am to 3pm, with travel and warm-up around it.</p>`;
  return `${rcField('What was it called', 'name', rcDraft.name, 'text', ' placeholder="Winter Invitational"')}
    ${rcField('What date', 'day', rcDraft.dayKey, 'date')}
    <div class="rc-row"><span class="rc-lab">Which sport</span><span class="rc-chiprow">${sports}</span></div>
    ${scoring}
    ${rcDraft.sport ? `<div class="rc-chiprow">${rcToggle('A personal best', 'pb', rcDraft.personalBest)}</div>` : ''}
    ${linked}`;
}

/* ── 🎁 Money she was given ── */
function rcGiftForm() {
  const kinds = MNY_FROM.map(f =>
    `<button type="button" class="rc-chip${rcDraft.from === f ? ' on' : ''}"
       data-rc-action="from" data-rc-id="${escapeAttr(f)}">${escapeHtml(f)}</button>`).join('');
  /* Which Sunday decides where it goes is a SECOND question from when it came,
     and the answer changes with the date, so it is said on the form rather than
     discovered afterwards. */
  const elsewhere = mnyGiftDecidedElsewhere(rcDraft.kid, rcDraft.dayKey);
  return `${rcField('How much', 'amount', rcDraft.amount, 'number', ' min="0" step="0.01"')}
    ${rcField('Which day it came', 'day', rcDraft.dayKey, 'date')}
    <div class="rc-row"><span class="rc-lab">What kind</span><span class="rc-chiprow">${kinds}</span></div>
    ${rcField('Who from', 'giver', rcDraft.giver, 'text', ' placeholder="Grandma"')}
    ${elsewhere
      ? `<p class="rc-note">That week is already settled, so it arrives on its own date and
         you will decide where it goes at the next meeting.</p>`
      : ''}
    ${isParent() ? '' : `<p class="rc-note">A grown-up says yes before it reaches your money.</p>`}`;
}

/* ── 📦 Something owed ──
   The catalog is the week's own rule version, so a fine entered against an old
   day is the amount that was live then. */
function rcFineForm() {
  const items = ((mrRulesForWeek(mnyWeekOfDay(rcDraft.dayKey)).fines) || {}).items || [];
  if (!items.length) return `<p class="rc-note">Nothing is on the list to owe for. Money rules › Fines.</p>`;
  const rows = items.map(f =>
    `<button type="button" class="rc-chip${rcDraft.fineId === f.id ? ' on' : ''}"
       data-rc-action="fine" data-rc-id="${escapeAttr(f.id)}">${escapeHtml(f.label)} · ${mnyMoney(f.amount)}</button>`).join('');
  return `${rcField('Which day', 'day', rcDraft.dayKey, 'date')}
    <div class="rc-row"><span class="rc-lab">What for</span><span class="rc-chiprow">${rows}</span></div>
    <p class="rc-note">A fine can never take more than that day earned, so it can never
    put her in debt.</p>`;
}

/* ── 🔀 Move money ──
   The refusal is shown BEFORE the button is pressed: a row that is greyed with
   no reason beside it is a row somebody works around. */
function rcMoveForm() {
  const pot = (action, current) => RC_HOMES.map(h => {
    const shut = (h !== 'cash') && !evHomeOpen(rcDraft.kid, h);
    return `<button type="button" class="rc-chip${current === h ? ' on' : ''}${shut ? ' shut' : ''}"
      data-rc-action="${action}" data-rc-id="${h}">${escapeHtml(mnyHomeLabel(h))}
      <small>${mnyMoney(evHomeBalance(rcDraft.kid, h))}</small></button>`;
  }).join('');
  // Why a move is refused is said on the save button (rcRender), in the
  // owner's own sentence, rather than in a second paragraph beside it.
  return `<div class="rc-row"><span class="rc-lab">Out of</span><span class="rc-chiprow">${pot('mfrom', rcDraft.moveFrom)}</span></div>
    <div class="rc-row"><span class="rc-lab">Into</span><span class="rc-chiprow">${pot('mto', rcDraft.moveTo)}</span></div>
    ${rcField('How much', 'amount', rcDraft.amount, 'number', ' min="0" step="0.01"')}
    ${rcField('What for', 'why', rcDraft.why, 'text', ' placeholder="Saving for my bike"')}
    ${isParent() ? '' : `<p class="rc-note">Nothing moves until a grown-up says yes.</p>`}`;
}

/* ── Input ────────────────────────────────────────────────────────
   Typing NEVER re-renders: the caret would be thrown away by `innerHTML` on
   every keystroke. Only the three fields that change what the form ASKS redraw
   it — the day (which week's rules apply, and which chores exist), and the two
   pots (whether the move is refused). The amount, which also decides whether a
   move is refused, updates the save button in place (`rcSyncSave`). */
function rcHandleInput(e) {
  const el = e.target.closest('[data-rc-action]');
  if (!el || !rcDraft || el.tagName !== 'INPUT') return;
  const a = el.getAttribute('data-rc-action');
  const num = () => Number(el.value) || 0;
  if (a === 'day')          { rcDraft.dayKey = el.value; rcRender(); return; }
  if (a === 'name')         { rcDraft.name = el.value; return; }
  if (a === 'giver')        { rcDraft.giver = el.value; return; }
  if (a === 'why')          { rcDraft.why = el.value; return; }
  if (a === 'points')       { rcDraft.points = num(); return; }
  if (a === 'groupplace')   { rcDraft.groupPlace = num(); return; }
  if (a === 'overallplace') { rcDraft.overallPlace = num(); return; }
  if (a === 'silver')       { rcDraft.silver = num(); return; }
  if (a === 'gold')         { rcDraft.gold = num(); return; }
  if (a === 'amount') {
    rcDraft.amount = money2(num());
    // The move's refusal depends on the amount, and it is said on the save
    // button — so the button follows the typing, in place. The form does not.
    rcSyncSave();
  }
}

function rcHandleClick(e) {
  const el = e.target.closest('[data-rc-action]');
  if (!el || !rcDraft || el.tagName === 'INPUT') return;
  const a = el.getAttribute('data-rc-action');
  const id = el.getAttribute('data-rc-id');
  if (a === 'close') { closeRecordSheet(); return; }
  if (a === 'save')  { rcSave(); return; }
  if (a === 'kind')  { rcDraft.kind = id; rcDraft.id = null; rcRender(); return; }
  if (a === 'kid') {
    rcDraft.kid = id;
    // Her sister's ladder may not have opened the pot this one had picked.
    if (rcDraft.moveTo !== 'cash' && !evHomeOpen(id, rcDraft.moveTo)) rcDraft.moveTo = rcDefaultMoveTo(id, rcDraft.moveFrom);
    rcRender();
    return;
  }
  if (a === 'sport') { rcDraft.sport = id; rcRender(); return; }
  if (a === 'chore') { rcDraft.choreId = id; rcRender(); return; }
  if (a === 'grade') { rcDraft.grade = Number(id); rcRender(); return; }
  if (a === 'fine')  { rcDraft.fineId = id; rcRender(); return; }
  if (a === 'from')  { rcDraft.from = id; rcRender(); return; }
  if (a === 'mfrom') {
    rcDraft.moveFrom = id;
    if (rcDraft.moveTo === id) rcDraft.moveTo = rcDefaultMoveTo(rcDraft.kid, id);
    rcRender();
    return;
  }
  if (a === 'mto')   { rcDraft.moveTo = id; rcRender(); return; }
  if (a === 'allgold')   { rcDraft.allGold = !rcDraft.allGold; rcRender(); return; }
  if (a === 'qualified') { rcDraft.qualified = !rcDraft.qualified; rcRender(); return; }
  if (a === 'provincial') { rcDraft.provincial = !rcDraft.provincial; rcRender(); return; }
  if (a === 'pb')    { rcDraft.personalBest = !rcDraft.personalBest; rcRender(); return; }
}

/* ── Saving ───────────────────────────────────────────────────────
   Each branch validates what the OWNER cannot: an owner refuses a bad write
   and says so, but it cannot know that a name was left empty on a form it
   never saw. Everything beyond that is the owner's, including every gate. */
function rcSave() {
  if (!rcDraft) return;
  const d = rcDraft, kid = d.kid;
  if (d.kind === 'chore') {
    if (!d.choreId) { showToast('Which chore?'); return; }
    const wk = mnyWeekOfDay(d.dayKey);
    const dayIdx = mrWeekDayKeys(wk).indexOf(d.dayKey);
    if (dayIdx < 0) { showToast('Pick a day'); return; }
    if (!mrSetChoreGrade(kid, wk, dayIdx, d.choreId, d.grade)) return;
    showToast('Graded 🧹');
  } else if (d.kind === 'meet') {
    if (!d.name.trim()) { showToast('Give it a name so it can be checked later'); return; }
    if (!d.sport) { showToast('Which sport?'); return; }
    const entry = {
      name: d.name.trim(), dayKey: d.dayKey, sport: d.sport,
      points: d.points, personalBest: d.personalBest,
      placement: { group: d.groupPlace, overall: d.overallPlace },
      danceItems: { silver: d.silver, gold: d.gold, allGold: d.allGold },
      qualified: d.qualified, provincial: d.provincial,
    };
    const saved = d.id ? mrUpdateCompetition(kid, d.id, entry) : mrAddCompetition(kid, entry);
    if (!saved) return;
    showToast(`🏆 ${d.name.trim()} · ${mnyMoney(saved.awarded)}`);
  } else if (d.kind === 'gift') {
    if (!(d.amount > 0)) { showToast('How much?'); return; }
    if (d.id) {
      if (!mnyEditDeposit(kid, d.id, { amount: d.amount, from: d.from, giver: d.giver, dayKey: d.dayKey })) return;
      showToast('Corrected 🎁');
    } else {
      const g = mnyAddDeposit(kid, mnyWeekOfDay(d.dayKey),
        { amount: d.amount, from: d.from, giver: d.giver, dayKey: d.dayKey });
      if (!g) return;
      showToast(isParent() ? `🎁 ${mnyMoney(d.amount)} recorded` : 'Asked a grown-up 🎁');
    }
  } else if (d.kind === 'fine') {
    if (!d.fineId) { showToast('What for?'); return; }
    if (!mrAddFine(kid, d.fineId, d.dayKey)) return;
    showToast('Recorded 📦');
  } else if (d.kind === 'move') {
    if (isParent()) {
      if (!mnyMoveMoney(kid, d.moveFrom, d.moveTo, d.amount, { note: d.why || 'Moved by a grown-up' })) return;
      showToast('Moved 🔀');
    } else {
      if (!mnyRequestMove(kid, d.moveFrom, d.moveTo, d.amount, d.why)) return;
      showToast('Asked a grown-up 🔀');
    }
  } else {
    return;
  }
  closeRecordSheet();
  rcRefreshSurfaces();
}

/* Whatever is on screen behind the sheet. Deliberately not a `saveAll` — the
   owners have already saved; this is only the repaint. */
function rcRefreshSurfaces() {
  if (typeof refreshCurrentScreen === 'function') refreshCurrentScreen();
  const sp = document.getElementById('screen-parent');
  if (sp && sp.classList.contains('active') && typeof renderParentHome === 'function') renderParentHome();
}
