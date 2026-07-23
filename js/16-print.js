// Weekly-Planner — print view: controls, sheet render, summary.
// Extracted verbatim from index.html (classic script, global scope).
/* ════════════════════════════════════════════════════════════════
   PRINT VIEW
════════════════════════════════════════════════════════════════ */
// Print display window — the start/end the parent chooses for what the
// printout shows and totals over. Defaults to the app's 6am–9pm.
let printWindow = { startHour: START_HOUR, endHour: END_HOUR };

// AAP/NSF sleep guidance by age → the printout shows this as a required
// nightly amount so a week can be planned around it.
function recommendedSleep(age) {
  if (age == null || isNaN(age)) return null;
  if (age <= 2)  return { min: 11, max: 14, group: 'toddler' };
  if (age <= 5)  return { min: 10, max: 13, group: 'preschool' };
  if (age <= 12) return { min: 9,  max: 12, group: 'school-age' };
  if (age <= 18) return { min: 8,  max: 10, group: 'teen' };
  return { min: 7, max: 9, group: 'adult' };
}

function fmtHrsMin(totalMin) {
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// Fill the start/end/age controls and reflect the current state.
function renderPrintControls() {
  const startSel = document.getElementById('printStartHour');
  const endSel = document.getElementById('printEndHour');
  if (!startSel || !endSel) return;
  const hourLabel = (h) => {
    const hr12 = ((h + 11) % 12) + 1;
    return `${hr12}${h < 12 ? 'am' : (h === 24 ? 'am' : 'pm')}`;
  };
  const opts = (lo, hi, sel) => {
    let s = '';
    for (let h = lo; h <= hi; h++) s += `<option value="${h}"${h===sel?' selected':''}>${hourLabel(h)}</option>`;
    return s;
  };
  startSel.innerHTML = opts(4, 12, printWindow.startHour);
  endSel.innerHTML = opts(15, 23, printWindow.endHour);
}

function onPrintWindowChange() {
  const start = parseInt(document.getElementById('printStartHour').value, 10);
  const end = parseInt(document.getElementById('printEndHour').value, 10);
  if (!isNaN(start)) printWindow.startHour = start;
  if (!isNaN(end)) printWindow.endHour = end;
  if (printWindow.endHour <= printWindow.startHour) printWindow.endHour = printWindow.startHour + 1;
  renderPrintControls();
  renderPrintSheet();
}

function onPrintAgeChange() {
  const v = document.getElementById('printAge').value.trim();
  const age = v === '' ? null : Math.max(1, Math.min(18, parseInt(v, 10) || 0));
  const pd = getProfData();
  if (pd) { pd.age = age; saveAll(); }
  renderPrintSheet();
}

function openPrint() {
  showScreen('print');
  renderPrintControls();
  renderPrintSheet();
}

// Auto-contrast: choose ink vs white by the fill's luminance so titles stay
// readable on every colour — and on a black & white printer, where each
// colour prints as its matching shade of grey, the same choice still holds.
function printTextColor(hex) {
  if (!hex || hex[0] !== '#') return '#1a1a1a';
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map(c=>c+c).join('');
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  const L = (0.299*r + 0.587*g + 0.114*b) / 255;
  return L > 0.6 ? '#1a1a1a' : '#fff';
}

// Proportional title size: taller blocks (which have the room) get larger
// text; short blocks stay small so the label still fits.
function printBlockFontPt(heightPx) {
  if (heightPx >= 240) return 12;    // ~5h+ (e.g. a full school day)
  if (heightPx >= 120) return 10.5;  // ~3h+
  if (heightPx >= 60)  return 9.5;   // ~1h30+
  if (heightPx >= 36)  return 8.5;   // ~1h
  if (heightPx >= 18)  return 7.5;   // ~30m
  return 6.5;                        // ~15m sliver
}

function renderPrintSheet() {
  const keys = getDayKeys(weekOffset);
  const mon = formatDayKey(keys[0]);
  const sun = formatDayKey(keys[6]);
  const p = activeProfile();
  const nameStr = p==='jenn'?'🐥 Jenn':'🦊 Jess';

  // Chosen display window (defaults to 6am–9pm).
  const winStartMin = printWindow.startHour * 60;
  const winEndMin   = printWindow.endHour * 60;
  const winSlots    = Math.round((winEndMin - winStartMin) / 15);
  const winStartHr  = printWindow.startHour;

  const fmtHr = (h) => `${((h+11)%12)+1}${h>=12 && h<24 ? 'pm' : 'am'}`;
  let html = `
    <div class="print-header">
      <h1>${nameStr}'s Week — ${MONTH_SHORT[mon.getMonth()]} ${mon.getDate()} to ${MONTH_SHORT[sun.getMonth()]} ${sun.getDate()} &nbsp;·&nbsp; ${fmtHr(winStartHr)}–${fmtHr(printWindow.endHour)}</h1>
    </div>
  `;

  // Row height scales so the chosen window still fits one landscape page.
  const slotPx = Math.max(7, Math.min(11, Math.floor(660 / winSlots)));
  document.documentElement.style.setProperty('--print-slot', slotPx + 'px');

  html += `<div class="print-week-grid">`;
  // header row (band-axis corner + time corner + 7 days)
  html += `<div class="print-header-cell"></div><div class="print-header-cell"></div>`;
  keys.forEach((k,i)=>{
    const d = formatDayKey(k);
    html += `<div class="print-header-cell">${DAY_SHORT[i]} ${d.getDate()}</div>`;
  });
  // Time-of-day sideband segments (absolute minutes), matching the day view's
  // axis: 6–9am / 9am–3pm / 3–6pm / 6pm onward.
  const PRINT_BANDS = [
    { start: 360,  end: 540,  cls: 'print-band-before',  label: '🌅 Before' },
    { start: 540,  end: 900,  cls: 'print-band-school',  label: '🏫 School' },
    { start: 900,  end: 1080, cls: 'print-band-after',   label: '🎒 After'  },
    { start: 1080, end: 1440, cls: 'print-band-evening', label: '🌙 Evening' },
  ];
  const bandForSlot = (absMin) => PRINT_BANDS.find(b => absMin >= b.start && absMin < b.end);
  // rows
  const acts = getAllActivities();
  // Time clashes flagged the same way as the Full/Day-Blocks views so the three
  // views agree on the printed sheet.
  const printConflicts = {};
  keys.forEach(k => { printConflicts[k] = computeBufferConflicts(getDayBlocks(k) || []).affected; });
  for (let s=0;s<winSlots;s++) {
    const totalMin=s*15;
    const hour = winStartHr + Math.floor(totalMin/60);
    const min  = totalMin%60;
    const isHourStart = min===0;
    // Sideband cell: tinted per band; the band's first visible slot carries a
    // vertical label spanning the band's full (clipped) height.
    const absMin = winStartMin + totalMin;
    const band = bandForSlot(absMin);
    let bandHtml = '';
    if (band) {
      const bandVisStart = Math.max(band.start, winStartMin);
      if (absMin === bandVisStart) {
        const visSlots = Math.round((Math.min(band.end, winEndMin) - bandVisStart) / 15);
        bandHtml = `<span class="print-band-label" style="height:${visSlots * slotPx - 1}px">${band.label}</span>`;
      }
    }
    html += `<div class="print-band-cell${band ? ' ' + band.cls : ''}">${bandHtml}</div>`;
    html += `<div class="print-time-cell${isHourStart?' print-hour-start':''}">${isHourStart ? (hour>12?hour-12:hour)+(hour>=12?'pm':'am') : ''}</div>`;
    keys.forEach(k=>{
      const bks = getDayBlocks(k);
      let blockHtml = '';
      bks.forEach(b=>{
        // Travel / get-ready buffer strips around the block, so the printed
        // sheet shows "leave at 5:00" for a 5:30 training just like the app.
        wfBufferSegments(b).forEach(seg=>{
          const absStart = seg.startRel + START_MIN;
          const segStart = Math.max(absStart, winStartMin);
          const segEnd   = Math.min(absStart + seg.dur, winEndMin);
          if (segEnd <= segStart) return;
          if (Math.round((segStart - winStartMin)/15) !== s) return;
          const slotSpan = Math.max(1, Math.round((segEnd - segStart)/15));
          const bh = slotSpan*slotPx - 1;
          const label = bh >= 9 ? `${seg.icon} ${seg.min}m` : '';
          const kindLabel = seg.kind==='travel' ? 'Travel' : seg.kind==='warmup' ? 'Warm-up' : 'Get ready';
          blockHtml += `<div class="print-buffer" style="height:${bh}px" title="${kindLabel} — ${seg.min} min">${label}</div>`;
        });
        // Clip each block to the window so blocks that start earlier/run later
        // still render (trimmed) instead of vanishing.
        const dur = b.durationMin || 0;
        const segStart = Math.max(b.startMin, winStartMin);
        const segEnd   = Math.min(b.startMin + dur, winEndMin);
        if (segEnd <= segStart) return;
        const startSlot = Math.round((segStart - winStartMin)/15);
        if (startSlot!==s) return;
        const act = acts.find(a=>a.id===b.actId);
        if (!act) return;
        const slotSpan = Math.max(1, Math.round((segEnd - segStart)/15));
        const bh = slotSpan*slotPx - 1;
        const topic = act.isTraining ? getTrainingTopic(b.tag) : null;
        const bg = topic ? trainingBlockColour(b) : (b.colour || CAT_HEX[act.cat] || '#888');
        const pIcon = topic ? topic.icon : act.icon;
        const pName = topic
          ? (act.isCompetition ? (topic.id === 'general' ? 'Competition 🏆' : topic.name + ' 🏆') : topic.name)
          : act.name;
        const hasConflict = printConflicts[k] && printConflicts[k].has(b.id);
        // Empty tick box so it can be checked off on the printed page.
        const checkbox = bh >= 15 ? `<span class="print-check" style="border-color:${printTextColor(bg)}"></span>` : '';
        blockHtml += `<div class="print-block${hasConflict ? ' print-block--conflict' : ''}" style="background:${bg};color:${printTextColor(bg)};font-size:${printBlockFontPt(bh)}pt;height:${bh}px">${checkbox}${hasConflict ? '⚠️ ' : ''}${pIcon} ${pName}</div>`;
      });
      html += `<div class="print-cell${isHourStart?' print-hour-start':''}">${blockHtml}</div>`;
    });
  }
  html += `</div>`;

  // The print is the planning grid only — A4 landscape, one page. Summaries,
  // free-time totals, sleep recommendations and notes are intentionally left
  // off so the printed sheet stays a single-page plan (per request).

  // Signature footer: the kid commits to the plan (carried over from the weekly
  // view if already signed), with blank lines for a parent co-sign and the date.
  const kidName = p==='jenn' ? 'Jenn' : 'Jess';
  const sig = getWeekSignature(keys, p);
  const sigName = sig ? escapeHtml(sig.name || kidName) : '';
  html += `<div class="print-signature">
      <div class="print-sig-block"><span class="print-sig-caption">${kidName} signs</span><span class="print-sig-line">${sigName ? `<span class="print-sig-name">${sigName}</span>` : ''}</span></div>
      <div class="print-sig-block"><span class="print-sig-caption">Parent</span><span class="print-sig-line"></span></div>
      <div class="print-sig-block print-sig-block--date"><span class="print-sig-caption">Date</span><span class="print-sig-line"></span></div>
    </div>`;

  document.getElementById('printSheet').innerHTML = html;
}

// Weekly time-per-category totals over the chosen window, plus unscheduled
// (free) time and an age-based sleep recommendation.
function buildPrintSummary(keys, acts, winStartMin, winEndMin) {
  const CAT_LABELS = {
    sleep:'😴 Rest', school:'📚 Learning', active:'🏃 Active',
    free:'🎮 Free', daily:'🍽 Daily', training:'🏋️ Competitive Sports',
    competition:'🏆 Competition', routine:'📋 Routine', custom:'✨ Custom'
  };
  const catMin = {};
  let planned = 0;
  keys.forEach(k=>{
    (getDayBlocks(k) || []).forEach(b=>{
      const segStart = Math.max(b.startMin, winStartMin);
      const segEnd   = Math.min(b.startMin + (b.durationMin||0), winEndMin);
      const mins = segEnd - segStart;
      if (mins <= 0) return;
      const act = acts.find(a=>a.id===b.actId);
      const cat = act ? act.cat : 'custom';
      catMin[cat] = (catMin[cat]||0) + mins;
      planned += mins;
    });
  });
  const windowWeekMin = (winEndMin - winStartMin) * 7;
  const free = Math.max(0, windowWeekMin - planned);

  // Ordered chips: each scheduled category with time, then unscheduled time.
  const order = ['school','active','training','routine','daily','free','sleep','custom'];
  let chips = '';
  order.forEach(cat=>{
    if (!catMin[cat]) return;
    chips += `<span class="print-cat-chip"><span class="print-cat-dot" style="background:${CAT_HEX[cat]||'#999'}"></span>${CAT_LABELS[cat]||cat}: <b>${fmtHrsMin(catMin[cat])}</b></span>`;
  });
  chips += `<span class="print-cat-chip"><span class="print-cat-dot" style="background:#fff;border:1px solid #999"></span>🌤 Unscheduled: <b>${fmtHrsMin(free)}</b></span>`;

  // Sleep recommendation from age.
  const age = getProfData()?.age;
  const sleep = recommendedSleep(age);
  let sleepHtml = '';
  if (sleep) {
    const perWeek = sleep.min * 7;
    sleepHtml = `<div class="print-sleep">💤 <b>Recommended sleep (age ${age}, ${sleep.group}):</b> ${sleep.min}–${sleep.max}h per night · aim for ~${perWeek}h across the week</div>`;
  } else {
    sleepHtml = `<div class="print-sleep print-sleep--muted">💤 Set the child's age to see the recommended sleep for their age group.</div>`;
  }

  return `
    <div class="print-summary">
      <div class="print-summary-title">This week at a glance <span class="print-summary-window">(${fmtHrsMin(winEndMin-winStartMin)}/day window)</span></div>
      <div class="print-cat-chips">${chips}</div>
      ${sleepHtml}
    </div>
  `;
}

