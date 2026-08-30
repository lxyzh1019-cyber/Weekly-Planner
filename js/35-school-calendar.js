// Weekly-Planner — importing a calendar (.ics), for the school year and for
// standing appointments.
//
// Why a hand-written parser. The suite boots the app over file:// and the CSP
// this app deploys under allows no third-party script, so a CDN library is not
// available even if one were wanted. iCalendar's grammar is small enough that
// the honest subset below is a few dozen lines, and the alternative — asking a
// parent to retype a term's worth of dates — is the thing this replaces.
//
// What it deliberately does NOT do:
//   - TZID conversion. Without a timezone database a named zone cannot be
//     resolved, so a TZID time is read as local wall-clock time. That is right
//     for the case this serves (a local school's local calendar) and wrong for
//     a calendar published in another zone; the preview shows the time it read,
//     which is where a parent would notice.
//   - Anything past FREQ=WEEKLY / FREQ=DAILY with UNTIL, COUNT and BYDAY.
//     Everything else in RRULE is skipped rather than half-applied, and the
//     preview says how many were skipped.
//
// NOTHING IS WRITTEN UNTIL IT IS CONFIRMED. Every date this file produces goes
// into a preview with a tick beside it. That is the same discipline pcwPlan
// (js/34-parent-copyweek.js) keeps for copying a week, and for the same reason:
// a calendar that silently marked twelve days as no-school is how a family comes
// to believe a term is set up when it is wrong.
//
// Declarations only; the delegated listener is bound in js/99-main.js.

/* A day off, by what the event calls itself. This decides which rows arrive
   TICKED, not which rows are shown — every all-day entry in the file is listed,
   because a keyword list cannot be complete and a day a parent cannot see is a
   day they cannot tick. "Christmas Day" is the case that proved it: it contains
   none of the words below, and while these matched the whole list it was
   silently absent from the import.

   Kept broad even so: a false positive is a row unticked in a second, a false
   negative is a day the app thinks is school when nobody is there. */
const SC_OFF_WORDS = [
  'no school', 'no classes', 'holiday', 'break', 'closure', 'closed',
  'pd day', 'p.d. day', 'professional development', 'non-instructional',
  'staff', 'in lieu', 'convention', 'vacation', 'stat ',
  // The statutory days a school calendar names outright, none of which say
  // "holiday" anywhere in them.
  'christmas', 'boxing day', 'new year', 'good friday', 'easter',
  'thanksgiving', 'remembrance day', 'victoria day', 'family day',
  'labour day', 'labor day', 'canada day', 'truth and reconciliation',
];
/* The two events a school calendar names its own term with, when it has them —
   better than guessing from the earliest and latest row in the file. */
const SC_TERM_START_WORDS = ['first day of school', 'first day of classes', 'school begins', 'first day'];
const SC_TERM_END_WORDS = ['last day of school', 'last day of classes', 'school ends', 'last day'];

const SC_MAX_EVENTS = 800;      // a year of a busy calendar; past this, stop reading
const SC_MAX_REPEATS = 200;     // per recurring event

let scDraft = null;             // the parsed proposal awaiting a decision
let scBusy = false;             // a fetch in flight
let scTab = 'school';           // 'school' | 'blocks'
let scBlockKid = 'jenn';
let scBlockActId = '';

/* ── The parser ── */

/* RFC 5545 §3.1: a line may be folded, and a continuation begins with a space
   or a tab. Unfold before anything else or every long SUMMARY is truncated at
   75 octets. \r\n and bare \n both appear in the wild. */
function icsUnfold(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
}

/* TEXT values escape comma, semicolon, backslash and newline. */
function icsUnescape(v) {
  return String(v || '')
    .replace(/\\n/gi, ' ')
    .replace(/\\([,;\\])/g, '$1')
    .trim();
}

/* `DTSTART;VALUE=DATE:20261225` → { name:'DTSTART', params:{VALUE:'DATE'}, value:'20261225' } */
function icsSplitLine(line) {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const bits = left.split(';');
  const params = {};
  bits.slice(1).forEach(p => {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  });
  return { name: bits[0].toUpperCase(), params, value };
}

/* A date-time value → { dayKey, minutes, allDay }. `minutes` is absolute
   minutes from midnight, which is what a block's startMin is. */
function icsDateValue(value, params) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(value || '').trim());
  if (!m) return null;
  const allDay = !m[4] || (params && params.VALUE === 'DATE');
  if (allDay) {
    return { dayKey: `${m[1]}-${m[2]}-${m[3]}`, minutes: null, allDay: true };
  }
  let y = +m[1], mo = +m[2], d = +m[3], hh = +m[4], mm = +m[5];
  if (m[7]) {
    // Zulu: shift into the device's zone, which is the family's zone.
    const local = new Date(Date.UTC(y, mo - 1, d, hh, mm));
    y = local.getFullYear(); mo = local.getMonth() + 1; d = local.getDate();
    hh = local.getHours(); mm = local.getMinutes();
  }
  return {
    dayKey: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    minutes: hh * 60 + mm,
    allDay: false,
  };
}

/* Walk the VEVENTs. Returns { events, skipped } — skipped counts the ones with
   a recurrence rule this does not understand, so the preview can say so rather
   than quietly dropping them. */
function icsParse(text) {
  const lines = icsUnfold(text).split('\n');
  const events = [];
  let cur = null;
  let skipped = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.toUpperCase() === 'BEGIN:VEVENT') { cur = { summary: '', rrule: null }; continue; }
    if (line.toUpperCase() === 'END:VEVENT') {
      if (cur && cur.start) {
        const expanded = icsExpand(cur);
        if (expanded === null) skipped++;
        else events.push(...expanded);
      }
      cur = null;
      if (events.length > SC_MAX_EVENTS) break;
      continue;
    }
    if (!cur) continue;
    const p = icsSplitLine(line);
    if (!p) continue;
    if (p.name === 'DTSTART') cur.start = icsDateValue(p.value, p.params);
    else if (p.name === 'DTEND') cur.end = icsDateValue(p.value, p.params);
    else if (p.name === 'SUMMARY') cur.summary = icsUnescape(p.value);
    else if (p.name === 'RRULE') cur.rrule = p.value;
  }
  return { events, skipped };
}

/* One VEVENT → the occurrences it actually covers. null means "this has a rule
   I do not understand", which is reported rather than guessed at. */
function icsExpand(ev) {
  const one = (start) => {
    const out = { dayKey: start.dayKey, allDay: start.allDay, summary: ev.summary };
    if (!start.allDay) {
      out.startMin = start.minutes;
      // DTEND on a timed event is exclusive of nothing — it is the end.
      out.durationMin = (ev.end && !ev.end.allDay && ev.end.dayKey === start.dayKey)
        ? Math.max(15, ev.end.minutes - start.minutes) : 60;
    }
    return out;
  };
  if (!ev.rrule) {
    /* An all-day event may span days, and its DTEND is EXCLUSIVE — a one-day
       holiday on the 25th ends on the 26th. Getting this wrong adds a day off
       that nobody has. */
    if (ev.start.allDay && ev.end && ev.end.allDay && ev.end.dayKey > ev.start.dayKey) {
      const out = [];
      const d = formatDayKey(ev.start.dayKey);
      const stop = formatDayKey(ev.end.dayKey);
      while (d < stop && out.length < SC_MAX_REPEATS) {
        out.push({ dayKey: dateToLocalKey(d), allDay: true, summary: ev.summary });
        d.setDate(d.getDate() + 1);
      }
      return out;
    }
    return [one(ev.start)];
  }

  const parts = {};
  ev.rrule.split(';').forEach(kv => {
    const eq = kv.indexOf('=');
    if (eq > 0) parts[kv.slice(0, eq).toUpperCase()] = kv.slice(eq + 1);
  });
  const freq = (parts.FREQ || '').toUpperCase();
  if (freq !== 'WEEKLY' && freq !== 'DAILY') return null;
  if (parts.BYMONTHDAY || parts.BYSETPOS || parts.BYMONTH) return null;
  const interval = Math.max(1, parseInt(parts.INTERVAL, 10) || 1);
  const count = parts.COUNT ? Math.max(1, parseInt(parts.COUNT, 10)) : null;
  const until = parts.UNTIL ? (icsDateValue(parts.UNTIL, {}) || {}).dayKey : null;
  if (!count && !until) return null;   // an endless rule is not something to materialise

  const DOW = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };
  const byDay = parts.BYDAY
    ? parts.BYDAY.split(',').map(x => DOW[x.trim().slice(-2).toUpperCase()]).filter(n => n != null)
    : null;

  const out = [];
  const d = formatDayKey(ev.start.dayKey);
  const stepDays = freq === 'DAILY' ? interval : 1;
  let weeksIn = 0;
  const weekStart = ctMondayOf(new Date(d));
  for (let guard = 0; guard < SC_MAX_REPEATS * 8 && out.length < SC_MAX_REPEATS; guard++) {
    const key = dateToLocalKey(d);
    if (until && key > until) break;
    let take = true;
    if (freq === 'WEEKLY') {
      weeksIn = Math.round((ctMondayOf(new Date(d)) - weekStart) / (7 * 24 * 3600 * 1000));
      take = (weeksIn % interval === 0) && (!byDay || byDay.includes(d.getDay()));
    }
    if (take) {
      out.push(Object.assign(one(ev.start), { dayKey: key }));
      if (count && out.length >= count) break;
    }
    d.setDate(d.getDate() + stepDays);
  }
  return out;
}

/* ── Turning events into a proposal ── */

function scLooksLikeDayOff(summary) {
  const t = String(summary || '').toLowerCase();
  return SC_OFF_WORDS.some(w => t.includes(w));
}
function scMatchesAny(summary, words) {
  const t = String(summary || '').toLowerCase();
  return words.some(w => t.includes(w));
}

/* Everything the file says, sorted into what a parent is being asked to accept.
   Days off are ticked by default because that is what the keywords matched;
   term dates are NOT, because a guess about which day a term starts changes
   which days count as school for a whole year. */
function scBuildDraft(text, source) {
  const { events, skipped } = icsParse(text);
  const offMap = new Map();
  const timed = [];
  events.forEach(e => {
    if (e.allDay) {
      // Every all-day entry, ticked or not — see SC_OFF_WORDS.
      if (!offMap.has(e.dayKey)) {
        offMap.set(e.dayKey, {
          date: e.dayKey,
          label: e.summary || 'no school',
          on: scLooksLikeDayOff(e.summary),
        });
      }
    } else if (timed.length < SC_MAX_EVENTS) {
      timed.push({ ...e, on: true });
    }
  });
  const allDayKeys = events.filter(e => e.allDay).map(e => e.dayKey).sort();
  const named = (words, fallback) => {
    const hit = events.find(e => e.allDay && scMatchesAny(e.summary, words));
    return hit ? hit.dayKey : fallback;
  };
  return {
    source,
    offDays: [...offMap.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
    timed,
    skipped,
    total: events.length,
    termStart: named(SC_TERM_START_WORDS, allDayKeys[0] || ''),
    termEnd: named(SC_TERM_END_WORDS, allDayKeys[allDayKeys.length - 1] || ''),
    takeTerm: false,
  };
}

/* ── Getting the text ── */

/* The same shape as bkImportPickFile (js/30-backup.js): one hidden input,
   created on demand and reused, value reset before and after so picking the
   same file twice still fires change. */
function scPickFile() {
  if (!isParent()) { showToast('Ask a grown-up — importing is parent-only'); return; }
  let input = document.getElementById('scImportInput');
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.id = 'scImportInput';
    input.accept = 'text/calendar,.ics';
    input.hidden = true;
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      input.value = '';
      if (!f) return;
      try {
        scDraft = scBuildDraft(await f.text(), `file · ${f.name}`);
      } catch (err) {
        showToast('That file could not be read');
        return;
      }
      scAfterParse();
    });
    document.body.appendChild(input);
  }
  input.value = '';
  input.click();
}

/* A subscription URL. webcal:// is https:// with a different scheme name, and
   nothing else about it is special.

   This can simply fail, and the UI says so before it is tried: a browser fetch
   is a cross-origin request, and most district calendar hosts send no CORS
   header, so the request is blocked before any of this runs. Downloading the
   file and picking it always works, which is why that is the primary path. */
async function scFetchUrl() {
  if (!isParent()) { showToast('Ask a grown-up — importing is parent-only'); return; }
  const raw = ((document.getElementById('scUrlInput') || {}).value || '').trim();
  if (!raw) { showToast('Paste a calendar link first'); return; }
  const url = raw.replace(/^webcal:\/\//i, 'https://');
  if (!/^https?:\/\//i.test(url)) { showToast('That does not look like a calendar link'); return; }
  scBusy = true; scRenderImport();
  try {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error(String(res.status));
    scDraft = scBuildDraft(await res.text(), `link · ${url.replace(/^https?:\/\//, '').slice(0, 40)}`);
    if (!state.shared.schoolCal) state.shared.schoolCal = {};
    state.shared.schoolCal.url = url;
    state.shared.schoolCal.lastFetched = syncNow();
    saveAll();
  } catch (err) {
    showToast('That link could not be fetched — download the .ics and add the file instead');
  } finally {
    scBusy = false;
    scAfterParse();
  }
}

function scAfterParse() {
  if (scDraft && !scDraft.total) showToast('No events in that calendar');
  scRenderImport();
}

/* ── Committing ── */

function scCommitSchool() {
  if (!scDraft) return;
  const take = scDraft.offDays.filter(d => d.on);
  if (!take.length && !(scDraft.takeTerm && scDraft.termStart && scDraft.termEnd)) {
    showToast('Nothing ticked to add');
    return;
  }
  if (!state.shared.schoolCal) state.shared.schoolCal = {};
  const cal = state.shared.schoolCal;
  const have = new Set((cal.offDays || []).map(x => (x && x.date) || x));
  const added = take.filter(d => !have.has(d.date));
  cal.offDays = [...(cal.offDays || []), ...added.map(d => ({ date: d.date, label: d.label.slice(0, 40) }))];
  if (scDraft.takeTerm && scDraft.termStart && scDraft.termEnd) {
    cal.termStart = scDraft.termStart;
    cal.termEnd = scDraft.termEnd;
  }
  cal.source = scDraft.source;
  saveAll();
  scDraft = null;
  paRenderSchool();
  refreshCurrentScreen && refreshCurrentScreen();
  showToast(`📅 Added ${added.length} day${added.length === 1 ? '' : 's'} off`);
}

/* Timed events as blocks. Every one goes through the same shape a placed block
   has, on one chosen activity, for one chosen child — parent-only, because it
   writes into a child's plan. */
function scCommitBlocks() {
  if (!scDraft || !isParent()) return;
  const act = findActivity(scBlockActId, scBlockKid);
  if (!act) { showToast('Pick which activity these are'); return; }
  const take = scDraft.timed.filter(e => e.on);
  if (!take.length) { showToast('Nothing ticked to add'); return; }
  let placed = 0;
  const byDay = {};
  take.forEach(e => { (byDay[e.dayKey] = byDay[e.dayKey] || []).push(e); });
  Object.keys(byDay).forEach(dayKey => {
    const arr = (getDayBlocksForProfile(dayKey, scBlockKid) || []).slice();
    byDay[dayKey].forEach(e => {
      // Never twice: a second import of the same calendar must not double it up.
      if (arr.some(b => b.actId === act.id && b.startMin === e.startMin)) return;
      arr.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        actId: act.id,
        startMin: e.startMin,
        durationMin: e.durationMin || act.durationMin || 60,
        objectives: [], note: (e.summary || '').slice(0, 60), checklistState: {},
        completed: false, confirmed: false,
        createdAt: syncNow(), updatedAt: syncNow(),
      });
      placed++;
    });
    setDayBlocks(dayKey, arr, scBlockKid);
  });
  saveAll();
  scDraft = null;
  paRenderSchool();
  refreshCurrentScreen && refreshCurrentScreen();
  showToast(placed ? `📅 Added ${placed} to ${kidLabel(scBlockKid).name}'s plan` : 'Those were already there');
}

/* ── The panel ── */

function scRenderImport() {
  const wrap = document.getElementById('scWrap');
  if (!wrap) return;
  if (!isParent()) { wrap.innerHTML = ''; return; }
  const cal = schoolCal();
  const d = scDraft;

  const intro = `<p class="pn-cap" style="margin-top:0.8rem">Import a calendar</p>
    <div class="pn-card pn-clear">Add the school's own <code>.ics</code> — days off, and the term
      dates if the file names them. Nothing is added until you have looked at it.
      ${cal.lastFetched ? `<br><span class="pn-note">Last read ${escapeHtml(String(cal.lastFetched).slice(0, 10))}${cal.source ? ' · ' + escapeHtml(cal.source) : ''}</span>` : ''}
    </div>
    <div class="pn-toggle" style="margin-top:0.5rem">
      <button type="button" class="pill-btn active" data-sc="pick">📂 Add a .ics file</button>
    </div>
    <div class="pa-time-row" style="margin-top:0.5rem">
      <input type="url" id="scUrlInput" placeholder="https://… or webcal://…"
        value="${escapeAttr(cal.url || '')}" aria-label="Calendar subscription link">
      <button type="button" class="pill-btn" data-sc="fetch"${scBusy ? ' disabled' : ''}>${scBusy ? 'Reading…' : 'Read link'}</button>
    </div>
    <p class="pn-note">A link only works if the school's server lets a browser read it, and many do
      not. If it fails, download the <code>.ics</code> and use the file button — that always works.
      Imported dates sync to the family's devices; they are never committed to the app's code.</p>`;

  if (!d) { wrap.innerHTML = intro; return; }

  const tabs = `<div class="pn-toggle" style="margin-top:0.8rem">
      <button type="button" class="pill-btn${scTab === 'school' ? ' active' : ''}" data-sc="tab" data-tab="school">🏫 Days off (${d.offDays.length})</button>
      <button type="button" class="pill-btn${scTab === 'blocks' ? ' active' : ''}" data-sc="tab" data-tab="blocks">📌 Appointments (${d.timed.length})</button>
    </div>`;

  let body;
  if (scTab === 'school') {
    const rows = d.offDays.map((o, i) => {
      const dt = formatDayKey(o.date);
      return `<label class="sc-row"><input type="checkbox" data-sc="off" data-i="${i}"${o.on ? ' checked' : ''}>
        <span class="sc-when">${DAY_SHORT[(dt.getDay() + 6) % 7]} ${dt.getDate()} ${MONTH_SHORT[dt.getMonth()]}</span>
        <span class="sc-what">${escapeHtml(o.label)}</span></label>`;
    }).join('') || `<p class="pn-note">No all-day entries in that file — only timed ones.</p>`;
    const term = (d.termStart && d.termEnd)
      ? `<label class="sc-row sc-row--term"><input type="checkbox" data-sc="term"${d.takeTerm ? ' checked' : ''}>
          <span class="sc-when">Term</span>
          <span class="sc-what">${escapeHtml(d.termStart)} → ${escapeHtml(d.termEnd)}</span></label>
         <p class="pn-note">Off by default: which day a term starts decides which days count as
           school for a whole year, so this is a guess worth checking before you take it.</p>`
      : '';
    const ticked = d.offDays.filter(o => o.on).length;
    body = `<p class="pn-note">Every all-day entry in the file. ${ticked} of ${d.offDays.length}
        ${ticked === 1 ? 'is' : 'are'} ticked because ${ticked === 1 ? 'it reads' : 'they read'} like
        a day off — check the rest yourself, since a picture day is not a day at home.</p>
      <div class="pn-card">${rows}</div>${term ? `<div class="pn-card" style="margin-top:0.4rem">${term}</div>` : ''}
      <div class="pn-toggle" style="margin-top:0.5rem">
        <button type="button" class="pill-btn active" data-sc="commit-school">Add the ticked days</button>
        <button type="button" class="pill-btn" data-sc="discard">Discard</button>
      </div>`;
  } else {
    const acts = getAllActivities(scBlockKid).filter(a => !a._locked && !a._rewardLocked);
    if (!scBlockActId && acts.length) scBlockActId = (acts.find(a => a.id === 'appointment') || acts[0]).id;
    const rows = d.timed.slice(0, 60).map((e, i) => {
      const dt = formatDayKey(e.dayKey);
      return `<label class="sc-row"><input type="checkbox" data-sc="ev" data-i="${i}"${e.on ? ' checked' : ''}>
        <span class="sc-when">${DAY_SHORT[(dt.getDay() + 6) % 7]} ${dt.getDate()} ${MONTH_SHORT[dt.getMonth()]} · ${escapeHtml(formatTimeFromMin(e.startMin))}</span>
        <span class="sc-what">${escapeHtml(e.summary || 'Appointment')}</span></label>`;
    }).join('') || `<p class="pn-note">No timed events in that file — only all-day entries.</p>`;
    body = `<div class="pn-card">
        <div class="pn-toggle">${['jenn', 'jess'].map(k =>
          `<button type="button" class="pill-btn${k === scBlockKid ? ' active' : ''}" data-sc="kid" data-kid="${k}">${escapeHtml(kidLabel(k).icon + ' ' + kidLabel(k).name)}</button>`).join('')}</div>
        <div class="pa-time-row" style="margin-top:0.5rem">
          <label for="scActSelect">As</label>
          <select id="scActSelect" data-sc="act">${acts.map(a =>
            `<option value="${escapeAttr(a.id)}"${a.id === scBlockActId ? ' selected' : ''}>${escapeHtml(a.icon + ' ' + a.name)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="pn-card" style="margin-top:0.4rem">${rows}</div>
      ${d.timed.length > 60 ? `<p class="pn-note">Showing the first 60 of ${d.timed.length}.</p>` : ''}
      <div class="pn-toggle" style="margin-top:0.5rem">
        <button type="button" class="pill-btn active" data-sc="commit-blocks">Add the ticked ones</button>
        <button type="button" class="pill-btn" data-sc="discard">Discard</button>
      </div>`;
  }

  const skipped = d.skipped
    ? `<p class="pn-note">⚠️ ${d.skipped} repeating event${d.skipped === 1 ? '' : 's'} skipped — this reads
        weekly and daily repeats with an end, and leaves anything more complicated alone rather than
        guessing at it.</p>`
    : '';

  wrap.innerHTML = intro
    + `<p class="pn-cap" style="margin-top:0.8rem">What is in it</p>
       <div class="pn-card pn-clear">${d.total} event${d.total === 1 ? '' : 's'} read${d.source ? ` · ${escapeHtml(d.source)}` : ''}.</div>`
    + skipped + tabs + body;
}

/* One delegated listener for the whole import section — reached from
   paHandleClick, since it renders inside #paSchoolWrap. */
function scHandleClick(e) {
  const btn = e.target.closest('[data-sc]');
  if (!btn) return;
  const act = btn.getAttribute('data-sc');
  if (act === 'pick') { scPickFile(); return; }
  if (act === 'fetch') { scFetchUrl(); return; }
  if (act === 'tab') { scTab = btn.getAttribute('data-tab'); scRenderImport(); return; }
  if (act === 'kid') { scBlockKid = btn.getAttribute('data-kid'); scBlockActId = ''; scRenderImport(); return; }
  if (act === 'discard') { scDraft = null; scRenderImport(); return; }
  if (act === 'commit-school') { scCommitSchool(); return; }
  if (act === 'commit-blocks') { scCommitBlocks(); return; }
  if (act === 'off' && scDraft) { scDraft.offDays[+btn.getAttribute('data-i')].on = btn.checked; return; }
  if (act === 'ev' && scDraft) { scDraft.timed[+btn.getAttribute('data-i')].on = btn.checked; return; }
  if (act === 'term' && scDraft) { scDraft.takeTerm = btn.checked; }
}

function scHandleChange(e) {
  const sel = e.target.closest('[data-sc="act"]');
  if (sel) { scBlockActId = sel.value; return; }
  const box = e.target.closest('[data-sc="off"], [data-sc="ev"], [data-sc="term"]');
  if (box) scHandleClick(e);
}
