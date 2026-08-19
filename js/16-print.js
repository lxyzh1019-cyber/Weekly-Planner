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

// Fill the start/end controls and reflect the current state.
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

/* onPrintAgeChange was here. It read document.getElementById('printAge').value
   with no null guard, and there has been no #printAge element in index.html for
   a long time — so the one thing it could have done was throw. Age is not asked
   for anywhere now; currentAge() answers it. */

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

// How many detail lines (checks/objective/etc.) fit under the title in a block
// of this height, given the title's own font size — continuous, so a big
// competition block naturally gets room for its whole list instead of a fixed
// 1/2/3-row cap regardless of how tall the block actually is.
//
// Deliberately NOT blockContentTier (js/05-helpers.js), which the day and week
// views share: this measures against real font metrics at the block's own point
// size, and print px are not screen px — the sheet has its own --print-slot
// scale, so those five pixel thresholds would mean nothing here.
function printDetailCapacity(heightPx, titleFpt) {
  const pxPerPt = 1.333;
  const titleLinePx = titleFpt * pxPerPt * 1.15 + 2;
  const rowFpt = titleFpt * 0.78;
  const rowLinePx = rowFpt * pxPerPt * 1.15 + 1;
  return Math.max(0, Math.floor((heightPx - titleLinePx - 2) / rowLinePx));
}

// Tick-box side length scaled to the block/strip's own height, so a 15-min
// sliver gets a small box and an hours-long block gets a comfortably tappable
// one, instead of one fixed size for every time slot.
function printCheckboxPx(heightPx, { min = 6, max = 12, base = 5, divisor = 20 } = {}) {
  return Math.max(min, Math.min(max, Math.round(base + heightPx / divisor)));
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
  const acts = getAllActivities(activeProfile(), { includeArchived: true });
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
        bandHtml = `<span class="print-band-label" style="height:${visSlots * slotPx - 1}px">${escapeHtml(band.label)}</span>`;
      }
    }
    html += `<div class="print-band-cell${band ? ' ' + band.cls : ''}">${bandHtml}</div>`;
    html += `<div class="print-time-cell${isHourStart?' print-hour-start':''}">${isHourStart ? (hour>12?hour-12:hour)+(hour>=12?'pm':'am') : ''}</div>`;
    keys.forEach(k=>{
      const bks = getDayBlocks(k);
      let blockHtml = '';
      bks.forEach(b=>{
        const act = acts.find(a=>a.id===b.actId);
        if (!act) return;
        const topic = act.isTraining ? getTrainingTopic(b.tag) : null;
        // Computed once so the buffer strips can be tinted to match, the same
        // way the week view's strips hug their own activity's colour.
        const bg = topic ? trainingBlockColour(b) : (b.colour || CAT_HEX[act.cat] || '#888');

        // Travel / get-ready buffer strips around the block, so the printed
        // sheet shows "leave at 5:00" for a 5:30 training just like the app —
        // each with its own tick box and a real deadline, not just "🚗15m".
        wfBufferSegments(b).forEach(seg=>{
          const absStart = seg.startRel + START_MIN;
          const segStart = Math.max(absStart, winStartMin);
          const segEnd   = Math.min(absStart + seg.dur, winEndMin);
          if (segEnd <= segStart) return;
          if (Math.round((segStart - winStartMin)/15) !== s) return;
          const slotSpan = Math.max(1, Math.round((segEnd - segStart)/15));
          const bh = slotSpan*slotPx - 1;
          const tier = bh >= 12 ? 'long' : bh >= 9 ? 'short' : 'tiny';
          const label = bh >= 6 ? bufferSegLabels(seg, tier) : '';
          const kindLabel = seg.kind==='travel' ? 'Travel' : seg.kind==='warmup' ? 'Warm-up' : 'Get ready';
          const kindCls = seg.kind === 'ready' ? ' print-buffer--ready' : seg.kind === 'warmup' ? ' print-buffer--warmup' : ' print-buffer--travel';
          const bufCheckPx = printCheckboxPx(bh, { min: 5, max: 9, base: 4, divisor: 8 });
          const checkbox = bh >= 9 ? `<span class="print-check" style="border-color:${printTextColor(bg)};width:${bufCheckPx}px;height:${bufCheckPx}px"></span>` : '';
          blockHtml += `<div class="print-buffer${kindCls}" style="height:${bh}px;--print-buf-colour:${bg}" title="${escapeAttr(kindLabel)} — ${seg.min} min">${checkbox}${label}</div>`;
        });
        // Clip each block to the window so blocks that start earlier/run later
        // still render (trimmed) instead of vanishing.
        const dur = b.durationMin || 0;
        const segStart = Math.max(b.startMin, winStartMin);
        const segEnd   = Math.min(b.startMin + dur, winEndMin);
        if (segEnd <= segStart) return;
        const startSlot = Math.round((segStart - winStartMin)/15);
        if (startSlot!==s) return;
        const slotSpan = Math.max(1, Math.round((segEnd - segStart)/15));
        const bh = slotSpan*slotPx - 1;
        const pIcon = topic ? topic.icon : act.icon;
        const pName = topic
          ? (act.isCompetition ? (topic.id === 'general' ? 'Competition 🏆' : topic.name + ' 🏆') : topic.name)
          : act.name;
        const hasConflict = printConflicts[k] && printConflicts[k].has(b.id);
        const titleFpt = printBlockFontPt(bh);
        // Empty tick box so it can be checked off on the printed page — sized
        // to the block's own height so a 15-min sliver and an hours-long
        // session don't share one fixed box size.
        const checkPx = printCheckboxPx(bh);
        const checkbox = bh >= 15 ? `<span class="print-check" style="border-color:${printTextColor(bg)};width:${checkPx}px;height:${checkPx}px"></span>` : '';
        // List as much of "what this block is about" as the block's own height
        // can hold, degrading to a one-line count and then to icon+name only on
        // slivers too short for more. A training block leads with its four
        // checks (TRAINING_CHECKS), which print as ⬜ boxes — on paper they are
        // the point, since a printed sheet is something you tick with a pen.
        const detailLines = blockDetailLines(b, act);
        let sumHtml = '';
        if (detailLines.length) {
          const maxRows = printDetailCapacity(bh, titleFpt);
          if (maxRows > 0) {
            sumHtml = sliceDetailLines(detailLines, maxRows)
              .map(r => `<div class="print-block-sum">${r.icon} ${escapeHtml(r.text)}</div>`)
              .join('');
          } else if (bh >= 26) {
            sumHtml = `<div class="print-block-sum">${blockCountsSummary(detailLines)}</div>`;
          }
        }
        const titleCls = sumHtml ? '' : ' print-block--titleonly';
        blockHtml += `<div class="print-block${titleCls}${hasConflict ? ' print-block--conflict' : ''}" style="background:${bg};color:${printTextColor(bg)};font-size:${titleFpt}pt;height:${bh}px">${checkbox}<div class="print-block-title">${hasConflict ? '⚠️ ' : ''}${pIcon} ${escapeHtml(pName)}</div>${sumHtml}</div>`;
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
  // Named *Html because it is already escaped — the suffix is what stops it
  // being escaped a second time, and stops the lint asking.
  const sigNameHtml = sig ? escapeHtml(sig.name || kidName) : '';
  html += `<div class="print-signature">
      <div class="print-sig-block"><span class="print-sig-caption">${escapeHtml(kidName)} signs</span><span class="print-sig-line">${sigNameHtml ? `<span class="print-sig-name">${sigNameHtml}</span>` : ''}</span></div>
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

  // Sleep recommendation from age. currentAge always answers, so the "set the
  // age to see this" fallback has nothing left to explain.
  const age = currentAge();
  const sleep = recommendedSleep(age);
  let sleepHtml = '';
  if (sleep) {
    const perWeek = sleep.min * 7;
    sleepHtml = `<div class="print-sleep">💤 <b>Recommended sleep (age ${age}, ${sleep.group}):</b> ${sleep.min}–${sleep.max}h per night · aim for ~${perWeek}h across the week</div>`;
  }

  return `
    <div class="print-summary">
      <div class="print-summary-title">This week at a glance <span class="print-summary-window">(${fmtHrsMin(winEndMin-winStartMin)}/day window)</span></div>
      <div class="print-cat-chips">${chips}</div>
      ${sleepHtml}
    </div>
  `;
}

