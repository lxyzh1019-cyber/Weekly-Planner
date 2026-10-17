// Weekly-Planner — App › Follow a calendar.
//
// A club publishes its practices in a calendar. This places them in ONE girl's
// plan as blocks of one activity (Training, with its sport, by default) and
// keeps them in step: every FCAL_CHECK_DAYS days, when a parent opens the parent
// portal, it reads the calendar again and shows what changed — new, moved and
// removed practices — before anything moves.
//
// The rules that keep a plan safe:
//   - NOTHING CHANGES UNTIL A PARENT CONFIRMS. Every change is a ticked row in a
//     preview, the same discipline as the school import (js/35-school-calendar.js)
//     and Copy a plan (js/34-parent-copyweek.js).
//   - A FINISHED PRACTICE NEVER CHANGES. Only blocks from today on that are not
//     completed are offered for a move or a removal.
//   - A PRACTICE CHANGED BY HAND IS ASKED ABOUT. Each block remembers the day and
//     time the club gave it (calDay / calStart / calLen). When the block no
//     longer matches, a grown-up moved it, and a club change to it is a choice:
//     keep yours, or take the club's.
//   - NO PRACTICE ON A DAY THE CLUB MARKS. An all-day club event (a meet, a
//     break, a long weekend) clears practices that day, and so does an Alberta
//     statutory holiday — the club's own calendar left a Victoria Day Monday and
//     a Good Friday in. Those rows arrive unticked, so a club that does train
//     that day is one tick away.
//
// How the calendar is read. A Google calendar is read through Google's calendar
// service (the Calendar API) with a key the family makes once: browsers are not
// allowed to read Google's calendar FILE from another site, and the service
// also lists moved and cancelled practices one by one. Any other link is read
// as an .ics file, which works only where that server lets a browser read it.
// A downloaded .ics can also be read once, with no sync.
//
// Each practice carries one key: the event's id and the day it was first set
// for (`series|YYYY-MM-DD`). The file and the service name an event the same
// way (js/35-school-calendar.js, icsSeriesId), so a check recognises what an
// earlier read placed.
//
// Storage: state.shared.calFeeds, merged by id with tombstones 'feed:'
// (js/04-merge.js). Street addresses are not kept — only the place's name,
// because saved data syncs to the family's devices.
//
// Declarations only; the delegated listener is bound in js/99-main.js.

const FCAL_CHECK_DAYS = 14;        // a calendar is read again after this many days
const FCAL_HORIZON_DAYS = 84;      // practices are placed up to 12 weeks ahead
const FCAL_GOOGLE_API = 'https://www.googleapis.com/calendar/v3/calendars/';

let fcalDraft = null;              // the proposal on screen: { feedId, rows, … }
let fcalBusy = '';                 // the id of the calendar being read
const fcalAutoTried = new Set();   // calendars the automatic check read this app load
let fcalForm = { kid: 'jess', actId: 'training', tag: 'swimming' };

/* ── Alberta's nine general (statutory) holidays ──
   Alberta Employment Standards: New Year's Day, Alberta Family Day, Good Friday,
   Victoria Day, Canada Day, Labour Day, Thanksgiving Day, Remembrance Day and
   Christmas Day. The optional ones (Easter Monday, Heritage Day, Boxing Day,
   Truth and Reconciliation) are not here. Computed, not listed, so a season
   that crosses into a new year needs no update. */
function fcalEaster(year) {
  // Anonymous Gregorian algorithm.
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function fcalNthMonday(year, month, n) {
  const d = new Date(year, month, 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + 7 * (n - 1));
  return d;
}
function fcalStatHolidays(year) {
  const out = {};
  const put = (d, name) => { out[dateToLocalKey(d)] = name; };
  put(new Date(year, 0, 1), "New Year's Day");
  put(fcalNthMonday(year, 1, 3), 'Family Day');
  const gf = fcalEaster(year); gf.setDate(gf.getDate() - 2);
  put(gf, 'Good Friday');
  const vd = new Date(year, 4, 24);                     // the Monday before 25 May
  while (vd.getDay() !== 1) vd.setDate(vd.getDate() - 1);
  put(vd, 'Victoria Day');
  put(new Date(year, 6, 1), 'Canada Day');
  put(fcalNthMonday(year, 8, 1), 'Labour Day');
  put(fcalNthMonday(year, 9, 2), 'Thanksgiving');
  put(new Date(year, 10, 11), 'Remembrance Day');
  put(new Date(year, 11, 25), 'Christmas Day');
  return out;
}
function fcalStatHolidayName(dayKey) {
  const y = Number(String(dayKey).slice(0, 4));
  return y ? (fcalStatHolidays(y)[dayKey] || '') : '';
}

/* ── The calendar list ── */

function fcalFeeds() {
  if (!state.shared.calFeeds) state.shared.calFeeds = [];
  return state.shared.calFeeds;
}
function fcalFeed(id) { return fcalFeeds().find(f => f && f.id === id) || null; }
function fcalTouch(feed) { feed.updatedAt = syncNow(); }
/* The Google key a family made once, from any calendar that has one. */
function fcalKnownKey() {
  const f = fcalFeeds().find(x => x && x.key);
  return f ? f.key : '';
}

/* What a pasted link points at. Google shows a calendar as a web page
   (…/embed?src=ID), as a file (…/ical/ID/public/basic.ics) or as an add link
   (…?cid=BASE64); all three are one calendar id. Any other https link is read
   as an .ics file. null means it is not a link this can read. */
function fcalReadLink(raw) {
  let link = String(raw || '').trim().replace(/^webcal:\/\//i, 'https://');
  if (!link) return null;
  if (!/^https?:\/\//i.test(link) && /^[^\s/]+@[^\s/]+$/.test(link)) {
    return fcalGoogleTarget(link);
  }
  if (!/^https?:\/\//i.test(link)) return null;
  let url;
  try { url = new URL(link); } catch (e) { return null; }
  if (/(^|\.)calendar\.google\.com$/i.test(url.hostname)) {
    const src = url.searchParams.get('src');
    if (src) return fcalGoogleTarget(src);
    const ical = /\/calendar\/ical\/([^/]+)\//.exec(url.pathname);
    if (ical) return fcalGoogleTarget(decodeURIComponent(ical[1]));
    const cid = url.searchParams.get('cid');
    if (cid) {
      let id = cid;
      try { if (!cid.includes('@')) id = atob(cid.replace(/-/g, '+').replace(/_/g, '/')); } catch (e) { id = cid; }
      return fcalGoogleTarget(id);
    }
    return null;
  }
  return { calId: '', icsUrl: url.href };
}
function fcalGoogleTarget(calId) {
  const id = String(calId || '').trim();
  if (!id) return null;
  return { calId: id, icsUrl: `https://calendar.google.com/calendar/ical/${encodeURIComponent(id)}/public/basic.ics` };
}

/* ── Reading a calendar into practices ── */

/* The place's name only: "Michener Aquatic Centre, 51a St, Red Deer…" keeps
   "Michener Aquatic Centre". */
function fcalPlaceName(location) {
  return String(location || '').split(',')[0].trim().slice(0, 40);
}

/* .ics text → occurrences. Timed ones become practices; all-day ones clear a day. */
function fcalOccurrencesFromIcs(text, today) {
  const days = fcalDayList(today || todayKey(), FCAL_HORIZON_DAYS);
  const { events } = icsParse(text, { from: days[0], to: days[days.length - 1] });
  return events.map(e => ({
    key: (e.series || 'nouid') + '|' + (e.origDay || e.dayKey) + (e.series ? '' : '|' + (e.startMin == null ? 'day' : e.startMin)),
    dayKey: e.dayKey,
    allDay: !!e.allDay,
    startMin: e.allDay ? null : e.startMin,
    durationMin: e.allDay ? null : e.durationMin,
    summary: e.summary || '',
    place: fcalPlaceName(e.place),
  }));
}

/* Google's calendar service → the same occurrences. singleEvents=true gives
   every practice on its own, with moved ones at their new time and cancelled
   ones left out; timeZone gives times in the family's zone, so the day and the
   minutes are read straight off the string. */
function fcalOccurrencesFromGoogle(items) {
  const out = [];
  (items || []).forEach(it => {
    if (!it || it.status === 'cancelled' || !it.start) return;
    const series = it.recurringEventId || it.id || 'nouid';
    const orig = it.originalStartTime
      ? String(it.originalStartTime.dateTime || it.originalStartTime.date || '').slice(0, 10)
      : String(it.start.dateTime || it.start.date || '').slice(0, 10);
    const summary = it.summary || '';
    const place = fcalPlaceName(it.location);
    if (it.start.date) {
      const d = formatDayKey(it.start.date);
      const stop = it.end && it.end.date ? it.end.date : it.start.date;
      let guard = 0;
      do {
        const k = dateToLocalKey(d);
        out.push({ key: series + '|' + k, dayKey: k, allDay: true, startMin: null, durationMin: null, summary, place });
        d.setDate(d.getDate() + 1);
      } while (dateToLocalKey(d) < stop && ++guard < 60);
      return;
    }
    const s = String(it.start.dateTime || '');
    const e = String((it.end && it.end.dateTime) || '');
    const toMin = (t) => Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16));
    const startMin = toMin(s);
    const dayKey = s.slice(0, 10);
    const durationMin = (e && e.slice(0, 10) === dayKey) ? Math.max(15, toMin(e) - startMin) : 60;
    out.push({ key: series + '|' + orig, dayKey, allDay: false, startMin, durationMin, summary, place });
  });
  return out;
}

function fcalZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Edmonton'; }
  catch (e) { return 'America/Edmonton'; }
}

/* Reads one feed. Resolves to { occs } or rejects with a reason a parent can read. */
async function fcalRead(feed) {
  const from = formatDayKey(todayKey());
  const to = formatDayKey(todayKey());
  to.setDate(to.getDate() + FCAL_HORIZON_DAYS + 1);
  if (feed.calId && feed.key) {
    const items = [];
    let page = '';
    for (let n = 0; n < 10; n++) {
      const q = `key=${encodeURIComponent(feed.key)}&singleEvents=true&orderBy=startTime&maxResults=2500`
        + `&timeMin=${encodeURIComponent(from.toISOString())}&timeMax=${encodeURIComponent(to.toISOString())}`
        + `&timeZone=${encodeURIComponent(fcalZone())}` + (page ? `&pageToken=${encodeURIComponent(page)}` : '');
      let res;
      try { res = await fetch(`${FCAL_GOOGLE_API}${encodeURIComponent(feed.calId)}/events?${q}`, { credentials: 'omit' }); }
      catch (e) { throw new Error('no connection to Google'); }
      if (res.status === 400 || res.status === 403) throw new Error('Google refused the key — check the key and that the Calendar API is turned on');
      if (res.status === 404) throw new Error('Google cannot find this calendar — it may be private now');
      if (!res.ok) throw new Error(`Google answered ${res.status}`);
      const body = await res.json();
      items.push(...(body.items || []));
      page = body.nextPageToken || '';
      if (!page) break;
    }
    return { occs: fcalOccurrencesFromGoogle(items) };
  }
  if (feed.icsUrl) {
    let res;
    try { res = await fetch(feed.icsUrl, { credentials: 'omit' }); }
    catch (e) {
      throw new Error(feed.calId ? 'a Google calendar needs a Google key' : 'this server does not let a browser read its calendar');
    }
    if (!res.ok) throw new Error(`the calendar server answered ${res.status}`);
    return { occs: fcalOccurrencesFromIcs(await res.text()) };
  }
  throw new Error('this calendar has no link');
}

/* ── Comparing the calendar with the plan ── */

function fcalDayList(fromKey, days) {
  const out = [];
  const d = formatDayKey(fromKey);
  for (let i = 0; i <= days; i++) { out.push(dateToLocalKey(d)); d.setDate(d.getDate() + 1); }
  return out;
}

/* Everything that differs between the calendar and the plan, as rows a parent
   ticks. `feed` is a saved calendar, or a one-time file read ({ id:'file', … }). */
function fcalBuildRows(feed, occs, today) {
  const t = today || todayKey();
  const days = fcalDayList(t, FCAL_HORIZON_DAYS);
  const last = days[days.length - 1];
  const inRange = (k) => k >= t && k <= last;

  // Days the club marks with an all-day event, and statutory holidays.
  const marked = {};
  occs.filter(o => o.allDay && inRange(o.dayKey)).forEach(o => {
    if (!marked[o.dayKey]) marked[o.dayKey] = o.summary || 'club event';
  });
  const clearedBy = (k) => marked[k] || (fcalStatHolidayName(k) ? `${fcalStatHolidayName(k)} (statutory holiday)` : '');

  const want = new Map();
  occs.filter(o => !o.allDay && inRange(o.dayKey)).forEach(o => { if (!want.has(o.key)) want.set(o.key, o); });

  // What this calendar placed earlier, from today on.
  // A finished one is held apart: never changed, and never placed a second time.
  const have = new Map();
  const finished = new Set();
  const extra = [];   // a second copy of one practice (two devices applied at once)
  if (feed.id !== 'file') {
    days.concat(fcalDayList(last, 14).slice(1)).forEach(k => {
      (getDayBlocksForProfile(k, feed.kid) || []).forEach(b => {
        if (!b || b.calFeed !== feed.id || !b.calKey) return;
        if (b.completed) finished.add(b.calKey);
        else if (have.has(b.calKey)) extra.push({ b, dayKey: k });
        else have.set(b.calKey, { b, dayKey: k });
      });
    });
  }
  const skipped = new Set(feed.skipKeys || []);
  const rows = [];
  let leftOut = 0;

  want.forEach((o, key) => {
    if (finished.has(key)) return;
    const why = clearedBy(o.dayKey);
    const cur = have.get(key);
    if (!cur) {
      if (skipped.has(key)) { leftOut++; return; }
      // A one-time file read places beside what is there, never twice.
      if (feed.id === 'file' && (getDayBlocksForProfile(o.dayKey, feed.kid) || [])
        .some(b => b && b.actId === feed.actId && b.startMin === o.startMin)) return;
      rows.push({ type: why ? 'skip' : 'add', on: !why, key, why, occ: o, dayKey: o.dayKey });
      return;
    }
    const b = cur.b;
    const club = { day: o.dayKey, start: o.startMin, len: o.durationMin };
    const said = { day: b.calDay, start: b.calStart, len: b.calLen };
    const plan = { day: cur.dayKey, start: b.startMin, len: b.durationMin };
    const same = (x, y) => x.day === y.day && x.start === y.start && x.len === y.len;
    // calHeld: a parent placed it on that day anyway, or kept it when asked
    // to remove it — asked once, not again at every check.
    if (why && !b.calHeld) {
      rows.push({ type: 'remove', on: true, key, why, block: b, blockDay: cur.dayKey, dayKey: cur.dayKey, occ: o });
    } else if (!same(club, said)) {
      if (same(plan, said)) rows.push({ type: 'move', on: true, key, occ: o, block: b, blockDay: cur.dayKey, dayKey: o.dayKey });
      else rows.push({ type: 'conflict', on: true, choice: 'mine', key, occ: o, block: b, blockDay: cur.dayKey, dayKey: o.dayKey });
    }
  });
  const gone = [];
  have.forEach((cur, key) => {
    if (want.has(key) || cur.b.calHeld) return;
    const edited = !(cur.dayKey === cur.b.calDay && cur.b.startMin === cur.b.calStart && cur.b.durationMin === cur.b.calLen);
    gone.push({ type: 'remove', on: true, key, why: 'no longer in the calendar', edited, block: cur.b, blockDay: cur.dayKey, dayKey: cur.dayKey });
  });
  // Many removals at once is more often a calendar read gone wrong than a
  // season changing: they are shown unticked, for a parent to tick on purpose.
  if (gone.length > 5) gone.forEach(r => { r.on = false; });
  rows.push(...gone);
  extra.forEach(cur => {
    if (finished.has(cur.b.calKey) || cur.b.calHeld) return;
    rows.push({ type: 'remove', on: true, key: cur.b.calKey, why: 'a second copy of the same practice', block: cur.b, blockDay: cur.dayKey, dayKey: cur.dayKey });
  });
  rows.sort((a, b) => (a.dayKey < b.dayKey ? -1 : a.dayKey > b.dayKey ? 1
    : ((a.occ ? a.occ.startMin : a.block.startMin) - (b.occ ? b.occ.startMin : b.block.startMin))));
  return { rows, leftOut, wanted: want.size, placed: have.size };
}

/* ── Checking ── */

function fcalIsDue(feed, now) {
  const at = Number(feed.lastChecked) || 0;
  return !at || ((now || syncNow()) - at) >= FCAL_CHECK_DAYS * 24 * 3600 * 1000;
}

/* Reads one calendar and opens its changes. `auto` is the every-14-days check:
   it says nothing when nothing changed. */
async function fcalCheck(feedId, auto) {
  if (!isParent()) return;
  const feed = fcalFeed(feedId);
  if (!feed || fcalBusy) return;
  fcalBusy = feedId;
  fcalRender();
  let result = null;
  let failure = '';
  try {
    result = await fcalRead(feed);
  } catch (err) {
    failure = String((err && err.message) || err);
  }
  fcalBusy = '';
  // A sync during the read may have replaced the list: write to the record
  // that is there now, or the check is lost and runs again at every load.
  const live = fcalFeed(feedId);
  if (!live) { fcalRender(); return; }
  let built = null;
  if (!failure) {
    built = fcalBuildRows(live, result.occs);
    // An empty answer (a server sending an empty or HTML page) would make
    // every placed practice a removal; it is a failed read, not a change.
    if (!built.wanted && built.placed) failure = 'the calendar came back empty';
  }
  if (failure) {
    live.lastError = failure.slice(0, 120);
    live.lastTried = syncNow();
    fcalTouch(live);
    saveAll();
    fcalRender();
    showToast(`🔄 Could not check ${live.name} — ${live.lastError}`);
    return;
  }
  live.lastError = '';
  const { rows, leftOut } = built;
  const changes = rows.filter(r => r.type !== 'skip');
  if (!changes.length) {
    live.lastChecked = syncNow();
    fcalTouch(live);
    saveAll();
    if (fcalDraft && fcalDraft.feedId === feedId) fcalDraft = null;
    fcalRender();
    if (!auto) showToast(`🔄 ${live.name}: no changes`);
    return;
  }
  fcalDraft = { feedId, rows, leftOut };
  fcalTouch(live);
  saveAll();
  fcalRender();
  showToast(`🔄 ${live.name}: ${changes.length} change${changes.length === 1 ? '' : 's'} to review — App › Follow a calendar`);
}

/* The every-14-days check, from renderParentHome. Once per app load, one
   calendar at a time, and never over a review a parent has open. */
async function fcalAutoCheck() {
  if (!isParent() || fcalBusy) return;
  /* Per calendar, not one flag: the portal can draw before the family's synced
     document arrives, when the list is still empty, and a calendar that
     arrives a moment later must still get its check. */
  for (const feed of fcalFeeds().slice()) {
    if (fcalDraft) return;
    if (!feed || fcalAutoTried.has(feed.id) || !fcalIsDue(feed)) continue;
    fcalAutoTried.add(feed.id);
    await fcalCheck(feed.id, true);
  }
}

/* ── Applying ── */

function fcalNewBlock(feed, o) {
  const act = findActivity(feed.actId, feed.kid) || {};
  const sport = act.isTraining ? getTrainingTopic(feed.tag) : null;
  const note = [o.summary, o.place].filter(Boolean).join(' · ').slice(0, 60);
  const block = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    actId: feed.actId,
    startMin: o.startMin,
    durationMin: Math.max(5, Math.min(o.durationMin || act.durationMin || 60, END_MIN - o.startMin)),
    // The category's own hex: a training block then takes its sport's colour
    // (trainingBlockColour), as one placed from the Training sheet does.
    colour: CAT_HEX[act.cat] || CAT_HEX.training,
    objectives: [], note, checklistState: {},
    tag: sport ? sport.id : null,
    parentPinned: true,
    travelBuffer: !!act.travels,
    getReadyBuffer: !!act.travels,
    warmupBuffer: false,
    gearState: {},
    completed: false, confirmed: false,
    createdAt: syncNow(), updatedAt: syncNow(),
  };
  if (block.travelBuffer) block.travelBufMin = DEFAULT_BUFFER_MIN;
  if (block.getReadyBuffer) block.getReadyBufMin = DEFAULT_BUFFER_MIN;
  if (feed.id !== 'file') Object.assign(block, fcalStamp(feed, o));
  return block;
}
function fcalStamp(feed, o) {
  return { calFeed: feed.id, calKey: o.key, calDay: o.dayKey, calStart: o.startMin, calLen: o.durationMin };
}

function fcalApply() {
  if (!fcalDraft || !isParent()) return;
  const feed = fcalDraft.feedId === 'file' ? fcalDraft.fileFeed : fcalFeed(fcalDraft.feedId);
  if (!feed) { fcalDraft = null; fcalRender(); return; }
  const kid = feed.kid;
  const touched = {};
  const day = (k) => (touched[k] = touched[k] || (getDayBlocksForProfile(k, kid) || []).slice());
  const drop = (k, id) => { touched[k] = day(k).filter(b => b.id !== id); tombstoneBlockIds([id]); };
  let added = 0, moved = 0, removed = 0, kept = 0;
  const skips = new Set(feed.skipKeys || []);

  fcalDraft.rows.forEach(r => {
    if (r.type === 'add' || r.type === 'skip') {
      if (r.on) {
        const nb = fcalNewBlock(feed, r.occ);
        // Placed on a held-back day on purpose: not offered for removal later.
        if (r.type === 'skip' && feed.id !== 'file') nb.calHeld = true;
        day(r.dayKey).push(nb);
        added++;
      } else if (r.type === 'add') skips.add(r.key);
      return;
    }
    if (r.type === 'remove') {
      if (r.on) { drop(r.blockDay, r.block.id); removed++; }
      else {
        // Kept on purpose: the same removal is not asked again.
        const b = day(r.blockDay).find(x => x.id === r.block.id);
        if (b && !b.calHeld) { b.calHeld = true; b.updatedAt = syncNow(); }
      }
      return;
    }
    // A move, or a club change to a practice changed by hand.
    const take = r.type === 'move' ? r.on : (r.on && r.choice === 'club');
    if (!take) {
      // Keep the plan as it is, but remember what the club now says, so the
      // same change is not asked again.
      const b = day(r.blockDay).find(x => x.id === r.block.id);
      if (b) { Object.assign(b, fcalStamp(feed, r.occ)); b.updatedAt = syncNow(); kept++; }
      return;
    }
    if (r.blockDay === r.dayKey) {
      const b = day(r.blockDay).find(x => x.id === r.block.id);
      if (b) {
        b.startMin = r.occ.startMin;
        b.durationMin = r.occ.durationMin;
        Object.assign(b, fcalStamp(feed, r.occ));
        b.updatedAt = syncNow();
      }
    } else {
      // Another day: the old copy is deleted (with its tombstone, so another
      // device cannot bring it back) and a new one is placed.
      // Gone already (deleted on another device during the review): left gone.
      const old = day(r.blockDay).find(x => x.id === r.block.id);
      if (!old) return;
      drop(r.blockDay, r.block.id);
      const nb = fcalNewBlock(feed, r.occ);
      ['objectives', 'note', 'gearState', 'travelBuffer', 'travelBufMin', 'getReadyBuffer', 'getReadyBufMin',
        'warmupBuffer', 'warmupBufMin', 'travelTo', 'travelHome', 'readyBefore', 'readyAfter', 'colour', 'tag']
        .forEach(f => { if (old[f] !== undefined) nb[f] = old[f]; });
      day(r.dayKey).push(nb);
    }
    moved++;
  });

  Object.keys(touched).forEach(k => setDayBlocks(k, touched[k], kid));
  if (feed.id !== 'file') {
    feed.skipKeys = [...skips].slice(-400);
    feed.lastChecked = syncNow();
    feed.lastError = '';
    fcalTouch(feed);
  }
  saveAll();
  fcalDraft = null;
  fcalRender();
  if (typeof refreshCurrentScreen === 'function') refreshCurrentScreen();
  const bits = [];
  if (added) bits.push(`${added} added`);
  if (moved) bits.push(`${moved} moved`);
  if (removed) bits.push(`${removed} removed`);
  if (kept) bits.push(`${kept} kept as you had ${kept === 1 ? 'it' : 'them'}`);
  showToast(`🔄 ${bits.join(' · ') || 'Nothing ticked'} — ${kidLabel(kid).name}'s plan`);
}

function fcalDiscard() {
  if (!fcalDraft) return;
  const feed = fcalFeed(fcalDraft.feedId);
  // A parent who looked and said no has been asked; the next check is in 14 days.
  if (feed) { feed.lastChecked = syncNow(); fcalTouch(feed); saveAll(); }
  fcalDraft = null;
  fcalRender();
}

/* A practice a grown-up removes by hand is not offered again (js/08-day-view.js
   removeBlock). */
function fcalForget(block) {
  if (!block || !block.calFeed || !block.calKey) return;
  const feed = fcalFeed(block.calFeed);
  if (!feed) return;
  const skips = new Set(feed.skipKeys || []);
  skips.add(block.calKey);
  feed.skipKeys = [...skips].slice(-400);
  fcalTouch(feed);
}

/* ── Adding and removing a calendar ── */

function fcalFormValues() {
  const val = (id) => ((document.getElementById(id) || {}).value || '').trim();
  return { name: val('fcalName'), link: val('fcalLink'), key: val('fcalKey') };
}

async function fcalAdd() {
  if (!isParent()) { showToast('Ask a grown-up — calendars are parent-only'); return; }
  const v = fcalFormValues();
  const target = fcalReadLink(v.link);
  if (!target) { showToast('Paste the calendar link first'); return; }
  const act = findActivity(fcalForm.actId, fcalForm.kid);
  if (!act) { showToast('Pick what these are'); return; }
  const feed = {
    id: 'cal' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    name: (v.name || 'Club calendar').slice(0, 30),
    link: v.link.slice(0, 300),
    calId: target.calId, icsUrl: target.icsUrl,
    key: (v.key || fcalKnownKey()).slice(0, 80),
    kid: fcalForm.kid, actId: act.id, tag: act.isTraining ? fcalForm.tag : null,
    lastChecked: 0, lastError: '', skipKeys: [],
    createdAt: syncNow(), updatedAt: syncNow(),
  };
  fcalFeeds().push(feed);
  saveAll();
  await fcalCheck(feed.id, false);
}

async function fcalRemoveFeed(id) {
  const feed = fcalFeed(id);
  if (!feed) return;
  const ok = await showConfirm(`Stop following ${feed.name}?\n\nThe practices already in ${kidLabel(feed.kid).name}'s plan stay.`,
    { okLabel: 'Stop following', cancelLabel: 'Keep' });
  if (!ok) return;
  state.shared.calFeeds = fcalFeeds().filter(f => f.id !== id);
  tombstoneIds('feed:', [id]);
  if (fcalDraft && fcalDraft.feedId === id) fcalDraft = null;
  saveAll();
  fcalRender();
}

/* A Google calendar followed before its key was made: the key is added on
   its card, and the calendar is read straight away. */
function fcalSaveKey(id) {
  const feed = fcalFeed(id);
  const input = [...document.querySelectorAll('[data-fcal-key]')].find(x => x.getAttribute('data-fcal-key') === id);
  const key = ((input && input.value) || '').trim();
  if (!feed || !key) { showToast('Paste the Google key first'); return; }
  feed.key = key.slice(0, 80);
  feed.lastError = '';
  fcalTouch(feed);
  saveAll();
  fcalCheck(id, false);
}

/* A downloaded .ics, read once into the plan with the same preview and the
   same holiday rules. It is not followed: nothing checks it again. */
function fcalPickFile() {
  if (!isParent()) { showToast('Ask a grown-up — importing is parent-only'); return; }
  let input = document.getElementById('fcalFileInput');
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.id = 'fcalFileInput';
    input.accept = 'text/calendar,.ics';
    input.hidden = true;
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      input.value = '';
      if (!f) return;
      let text;
      try { text = await f.text(); } catch (err) { showToast('That file could not be read'); return; }
      fcalOpenFile(text, f.name);
    });
    document.body.appendChild(input);
  }
  input.value = '';
  input.click();
}
function fcalOpenFile(text, name) {
  const act = findActivity(fcalForm.actId, fcalForm.kid);
  if (!act) { showToast('Pick what these are'); return; }
  const fileFeed = { id: 'file', name: name || 'file', kid: fcalForm.kid, actId: act.id,
    tag: act.isTraining ? fcalForm.tag : null, skipKeys: [] };
  const { rows } = fcalBuildRows(fileFeed, fcalOccurrencesFromIcs(text));
  if (!rows.length) { showToast('Nothing new to add from that file'); return; }
  fcalDraft = { feedId: 'file', fileFeed, rows, leftOut: 0 };
  fcalRender();
}

/* ── The screen ── */

function fcalWhen(dayKey, startMin) {
  return fmtDay(dayKey, 'long') + (startMin == null ? '' : ` · ${formatTimeFromMin(startMin)}`);
}
/* A stamp (ms) as the day it fell on. */
function fcalStampDay(stamp) {
  return stamp ? fmtDay(dateToLocalKey(new Date(Number(stamp)))) : '';
}

function fcalRowHtml(r, i) {
  const o = r.occ;
  // A row names the place, not the event: every practice is called the same.
  const where = escapeHtml((o && (o.place || o.summary)) || 'Practice');
  const box = `<input type="checkbox" data-fcal-action="tick" data-i="${i}"${r.on ? ' checked' : ''}>`;
  const row = (when, what) => `<label class="sc-row">${box}<span class="sc-when">${when}</span><span class="sc-what">${what}</span></label>`;
  if (r.type === 'add') return row(escapeHtml(fcalWhen(o.dayKey, o.startMin)), `➕ ${where}`);
  if (r.type === 'skip') return row(escapeHtml(fcalWhen(o.dayKey, o.startMin)), `⏸ ${escapeHtml(r.why)} — tick to add`);
  if (r.type === 'remove') {
    return row(escapeHtml(fcalWhen(r.blockDay, r.block.startMin)),
      `➖ ${escapeHtml(r.why)}${r.edited ? ' (you had changed it)' : ''}`);
  }
  const from = escapeHtml(fcalWhen(r.blockDay, r.block.startMin));
  const to = escapeHtml(fcalWhen(o.dayKey, o.startMin));
  if (r.type === 'move') return row(to, `↔️ was ${from}`);
  return `<div class="sc-row"><span class="sc-when">${to}</span>
      <span class="sc-what">✋ The club moved it; you had it at ${from}</span></div>
    <div class="pn-toggle">
      <button type="button" class="ui-chip" aria-pressed="${r.choice === 'mine'}" data-fcal-action="choose" data-i="${i}" data-choice="mine">Keep yours</button>
      <button type="button" class="ui-chip" aria-pressed="${r.choice === 'club'}" data-fcal-action="choose" data-i="${i}" data-choice="club">Take the club's</button>
    </div>`;
}

function fcalDraftHtml() {
  const d = fcalDraft;
  if (!d) return '';
  const feed = d.feedId === 'file' ? d.fileFeed : fcalFeed(d.feedId);
  if (!feed) return '';
  const count = (t) => d.rows.filter(r => r.type === t).length;
  const parts = [['add', 'new'], ['move', 'moved'], ['conflict', 'changed by you'], ['remove', 'removed'], ['skip', 'not added (club day off or holiday)']]
    .map(([t, w]) => count(t) ? `${count(t)} ${w}` : '').filter(Boolean).join(' · ');
  let month = '';
  const body = d.rows.map((r, i) => {
    const m = fmtDay(r.dayKey, 'month');
    const head = m !== month ? `${month ? '</div>' : ''}<p class="pn-cap" style="margin-top:0.6rem">${escapeHtml(m)}</p><div class="ui-card">` : '';
    month = m;
    return head + fcalRowHtml(r, i);
  }).join('') + (d.rows.length ? '</div>' : '');
  return `<p class="pn-cap" style="margin-top:0.8rem">${d.feedId === 'file' ? 'From the file' : 'Changes'} — ${escapeHtml(feed.name)}
      → ${escapeHtml(kidLabel(feed.kid).name)}</p>
    <div class="ui-card pn-clear">${parts || 'Nothing to change'}.${d.leftOut ? ` ${d.leftOut} practice${d.leftOut === 1 ? '' : 's'} you said no to earlier ${d.leftOut === 1 ? 'is' : 'are'} left out.` : ''}
      Finished practices are never changed.</div>
    ${body}
    <div class="pn-toggle" style="margin-top:0.5rem">
      <button type="button" class="ui-btn ui-btn--primary" data-fcal-action="apply">Apply the ticked changes</button>
      <button type="button" class="ui-btn ui-btn--secondary" data-fcal-action="discard">Discard</button>
    </div>`;
}

function fcalFeedHtml(f) {
  const act = findActivity(f.actId, f.kid);
  const sport = f.tag ? getTrainingTopic(f.tag) : null;
  const what = sport ? sport.label : (act ? `${act.icon} ${act.name}` : 'Activity');
  const next = f.lastChecked ? fcalStampDay(Number(f.lastChecked) + FCAL_CHECK_DAYS * 24 * 3600 * 1000) : '';
  const status = f.lastChecked
    ? `Last checked ${escapeHtml(fcalStampDay(f.lastChecked))} · next check ${escapeHtml(next)}`
    : 'Not checked yet';
  const err = f.lastError
    ? `<br><span class="pn-note">⚠️ Could not check: ${escapeHtml(f.lastError)}.${f.lastChecked ? ` Last check ${escapeHtml(fcalStampDay(f.lastChecked))}.` : ''} The practices in the plan stay as they are.</span>`
    : '';
  const busy = fcalBusy === f.id;
  return `<div class="ui-card" style="margin-top:0.4rem">
      <b>${escapeHtml(f.name)}</b> → ${escapeHtml(kidLabel(f.kid).icon + ' ' + kidLabel(f.kid).name)} · ${escapeHtml(what)}
      <br><span class="pn-note">${status}${f.calId && !f.key && !f.lastError ? ' · needs a Google key' : ''}</span>${err}
      ${f.calId && !f.key ? `<div class="pa-time-row" style="margin-top:0.4rem">
        <input type="text" data-fcal-key="${escapeAttr(f.id)}" maxlength="80" placeholder="Paste the Google key" aria-label="Google key for ${escapeAttr(f.name)}" autocomplete="off">
        <button type="button" class="ui-btn ui-btn--secondary" data-fcal-action="save-key" data-feed="${escapeAttr(f.id)}">Save key</button>
      </div>` : ''}
      <div class="pn-toggle" style="margin-top:0.4rem">
        <button type="button" class="ui-btn ui-btn--primary" data-fcal-action="check" data-feed="${escapeAttr(f.id)}"${fcalBusy ? ' disabled' : ''}>${busy ? 'Checking…' : 'Check for changes'}</button>
        <button type="button" class="ui-btn ui-btn--secondary" data-fcal-action="remove-feed" data-feed="${escapeAttr(f.id)}">Stop following</button>
      </div>
    </div>`;
}

function fcalFormHtml() {
  const kid = fcalForm.kid;
  const acts = getAllActivities(kid).filter(a => !a._locked);
  if (!acts.some(a => a.id === fcalForm.actId) && acts.length) fcalForm.actId = (acts.find(a => a.id === 'training') || acts[0]).id;
  const act = findActivity(fcalForm.actId, kid);
  const sports = act && act.isTraining ? getTrainingTags() : [];
  if (sports.length && !sports.some(t => t.id === fcalForm.tag)) fcalForm.tag = sports[0].id;
  const known = fcalKnownKey();
  return `<p class="pn-cap" style="margin-top:0.8rem">Follow a new calendar</p>
    <div class="ui-card">
      <div class="pa-time-row"><label for="fcalName">Name</label>
        <input type="text" id="fcalName" maxlength="30" placeholder="e.g. Swim club"></div>
      <div class="pa-time-row"><label for="fcalLink">Link</label>
        <input type="url" id="fcalLink" placeholder="The club's calendar or Subscribe link"></div>
      <div class="pn-toggle" style="margin-top:0.5rem">${['jenn', 'jess'].map(k =>
        `<button type="button" class="ui-chip" aria-pressed="${k === kid}" data-fcal-action="kid" data-kid="${k}">${escapeHtml(kidLabel(k).icon + ' ' + kidLabel(k).name)}</button>`).join('')}</div>
      <div class="pa-time-row" style="margin-top:0.5rem">
        <label for="fcalActSelect">As</label>
        <select id="fcalActSelect" data-fcal-action="act">${acts.map(a =>
          `<option value="${escapeAttr(a.id)}"${a.id === fcalForm.actId ? ' selected' : ''}>${escapeHtml(a.icon + ' ' + a.name)}</option>`).join('')}</select>
      </div>
      ${sports.length ? `<div class="pn-toggle" style="margin-top:0.5rem">${sports.map(t =>
        `<button type="button" class="ui-chip" aria-pressed="${t.id === fcalForm.tag}" data-fcal-action="sport" data-sport="${escapeAttr(t.id)}">${escapeHtml(t.label)}</button>`).join('')}</div>` : ''}
      <div class="pa-time-row" style="margin-top:0.5rem"><label for="fcalKey">Google key</label>
        <input type="text" id="fcalKey" maxlength="80" value="${escapeAttr(known)}" placeholder="Needed for a Google calendar" autocomplete="off"></div>
      <div class="pn-toggle" style="margin-top:0.5rem">
        <button type="button" class="ui-btn ui-btn--primary" data-fcal-action="add"${fcalBusy ? ' disabled' : ''}>${fcalBusy ? 'Reading…' : 'Follow and read'}</button>
        <button type="button" class="ui-btn ui-btn--secondary" data-fcal-action="file">📂 Read a .ics file once</button>
      </div>
      <p class="pn-note">A Google calendar is read with a Google key: browsers are not allowed to
        read Google's calendar file from another site. A file is read once and not followed.</p>
    </div>`;
}

function fcalRender() {
  const wrap = document.getElementById('paCalWrap');
  if (!wrap) return;
  if (!isParent()) { wrap.innerHTML = ''; return; }
  const feeds = fcalFeeds();
  wrap.innerHTML = `<p class="pn-cap">Follow a calendar</p>
    <div class="ui-card pn-clear">A club's calendar, placed in one girl's plan and kept in step. Every
      ${FCAL_CHECK_DAYS} days, when you open the parent portal, the app reads it again and shows what
      changed. Nothing changes until you apply.</div>`
    + fcalDraftHtml()
    + (feeds.length ? `<p class="pn-cap" style="margin-top:0.8rem">Calendars you follow</p>${feeds.map(fcalFeedHtml).join('')}` : '')
    + fcalFormHtml();
}

/* One delegated listener for the screen, bound in js/99-main.js. */
function fcalHandleClick(e) {
  const el = e.target.closest('[data-fcal-action]');
  if (!el) return;
  const a = el.getAttribute('data-fcal-action');
  if (a === 'act') return;                       // a select: handled on change
  if (a === 'tick') {
    const r = fcalDraft && fcalDraft.rows[+el.getAttribute('data-i')];
    if (r) r.on = el.checked;
    return;
  }
  if (a === 'choose') {
    const r = fcalDraft && fcalDraft.rows[+el.getAttribute('data-i')];
    if (r) { r.choice = el.getAttribute('data-choice'); r.on = true; fcalRender(); }
    return;
  }
  if (a === 'apply') { fcalApply(); return; }
  if (a === 'discard') { fcalDiscard(); return; }
  if (a === 'check') { fcalCheck(el.getAttribute('data-feed'), false); return; }
  if (a === 'remove-feed') { fcalRemoveFeed(el.getAttribute('data-feed')); return; }
  if (a === 'save-key') { fcalSaveKey(el.getAttribute('data-feed')); return; }
  if (a === 'file') { fcalPickFile(); return; }
  if (a === 'add') { fcalAdd(); return; }
  // The form's choices redraw the form; keep what was typed.
  const typed = fcalFormValues();
  if (a === 'kid') fcalForm.kid = el.getAttribute('data-kid');
  else if (a === 'sport') fcalForm.tag = el.getAttribute('data-sport');
  else return;
  fcalRender();
  fcalRestoreTyped(typed);
}
function fcalHandleChange(e) {
  const sel = e.target.closest('[data-fcal-action="act"]');
  if (sel) {
    const typed = fcalFormValues();
    fcalForm.actId = sel.value;
    fcalRender();
    fcalRestoreTyped(typed);
    return;
  }
  if (e.target.closest('[data-fcal-action="tick"]')) fcalHandleClick(e);
}
function fcalRestoreTyped(v) {
  [['fcalName', v.name], ['fcalLink', v.link], ['fcalKey', v.key]].forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  });
}
