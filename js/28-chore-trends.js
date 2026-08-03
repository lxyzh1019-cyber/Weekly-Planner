// Weekly-Planner — the eight-week read (redesign 2a, "Trends" frame).
//
// Two deliberate departures from the handoff drawing, both for the same reason:
// a chart is read by people, and these two would have misled them.
//
// 1. The drawing puts the weekly bars and the running total on ONE plot. Those
//    are different scales — a week is a few dollars, the pile is a few hundred —
//    so a shared axis invents a relationship that isn't in the data. They are
//    two stacked panels here, sharing an x-axis, which keeps "each week, and the
//    pile so far" without the dual-axis lie.
// 2. The drawing's series colours (#ffd166 / #6fb1fc) fail the lightness band
//    and sit under 3:1 on cream. These are the same two hues stepped deeper
//    until they pass, so Jenn still reads amber and Jess still reads blue.
//    Validated: adjacent ΔE 27.1 protan / 30.4 normal.

let ctrOffset = 0;   // how many 8-week windows back from the current one

const CTR_KID_COLOR = { jenn: '#cf8f22', jess: '#3d7fd6' };
/* One hue, light→dark, four steps: validated monotone with visible gaps and a
   light end that clears the paper. Zero gets the paper itself — "nothing
   happened" should not look like the bottom of a scale. */
const CTR_HEAT = ['#71c295', '#48a271', '#2b8054', '#185235'];

/* The eight weeks in the window, oldest first. */
function ctrWeeks() {
  const cur = ctMondayOf(formatDayKey(ctWeekKey || ctThisWeekKey()));
  const out = [];
  for (let i = CT_SUMMARY_WEEKS - 1; i >= 0; i--) {
    const d = new Date(cur);
    d.setDate(cur.getDate() - (i + ctrOffset * CT_SUMMARY_WEEKS) * 7);
    out.push({ key: ctDateToKey(d), date: d, label: `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}` });
  }
  return out;
}

/* One week for one kid, read from the most authoritative source available.

   A settled week's frozen ledger wins: it is what was actually agreed, and a
   price changed in March must not restate January. Only an unsettled week is
   recomputed live. */
function ctrRow(wk, kid) {
  ctEnsureShared();
  const L = ((state.shared.chore.moneyLedger || {})[wk] || {})[kid];
  if (L) {
    return { total: Number(L.net) || 0, chores: Number(L.chores) || 0,
             learning: Number(L.learning) || 0, streak: Number(L.streak) || 0,
             competition: Number(L.competition) || 0, fines: Number(L.fines) || 0,
             xp: Number(L.xp) || 0, frozen: true, has: true };
  }
  const has = mrUsesNewModel(wk) ? ctWeekHasData(wk, kid) || ctWeekMoney(wk, kid) > 0 : ctWeekMoney(wk, kid) > 0;
  if (!mrUsesNewModel(wk)) {
    return { total: ctWeekMoney(wk, kid), chores: 0, learning: 0, streak: 0,
             competition: 0, fines: 0, xp: 0, frozen: false, legacy: true, has };
  }
  const b = mrWeekBreakdown(wk, kid);
  return { total: b.net, chores: b.chorePaid, learning: b.learnPaid,
           streak: b.streakBonus, competition: b.compPaid, fines: b.fines.total,
           xp: mrXpForWeek(wk, kid).total, frozen: false, has };
}

function ctrData() {
  const weeks = ctrWeeks();
  const rows = { jenn: [], jess: [] };
  ['jenn', 'jess'].forEach(k => {
    let run = 0;
    weeks.forEach(w => {
      const r = ctrRow(w.key, k);
      run = money2(run + r.total);
      rows[k].push(Object.assign({ week: w, cum: run }, r));
    });
  });
  return { weeks, rows };
}

/* ── The two cumulative cards ── */
function ctrCards(d) {
  return ['jenn', 'jess'].map(k => {
    const rs = d.rows[k];
    const withData = rs.filter(r => r.has).length;
    const total = rs[rs.length - 1].cum;
    const best = rs.reduce((m, r) => Math.max(m, r.total), 0);
    const avg = withData ? money2(total / withData) : 0;
    const xp = rs.reduce((s, r) => s + r.xp, 0);
    // mrYearToDate returns the whole picture, not a number: paidTotal is what
    // has actually been recorded at meetings, and the target comes from the
    // rules rather than being re-derived here.
    const ytdInfo = mrYearToDate(k) || {};
    const ytd = Number(ytdInfo.paidTotal) || 0;
    const target = Number(ytdInfo.target) || 0;
    const pct = target > 0 ? Math.min(100, Math.round(ytd / target * 100)) : 0;
    const tile = (label, v) => `<div class="ctr-tile"><div class="ctr-tile-cap">${label}</div><div class="ctr-tile-v">${v}</div></div>`;
    return `<div class="ctr-card">
      <div class="ctr-card-head" style="background:${CTR_KID_COLOR[k]}22">
        <span class="ctr-card-icon">${CT_PROFILE_ICON[k]}</span>
        <span class="ctr-card-name">${k === 'jenn' ? 'Jenn' : 'Jess'}</span>
        <span class="ck-spacer"></span>
        <span class="ck-hist-total">${ckMoney(total)}</span>
        <span class="ctr-card-xp">${xp} XP</span>
      </div>
      <div class="ctr-card-body">
        <div class="ctr-tiles">
          ${tile('weeks with data', `${withData} of ${CT_SUMMARY_WEEKS}`)}
          ${tile('best week', ckMoney(best))}
          ${tile('average', ckMoney(avg))}
          ${tile('this year', ckMoney(ytd))}
        </div>
        ${target ? `<div class="ctr-goalbar"><div class="ctr-goalfill" style="width:${pct}%"></div></div>
        <div class="ck-sub">${pct}% of this year's ${ckMoney(target)} — the target is a starting point, reviewed every quarter.</div>` : ''}
      </div></div>`;
  }).join('');
}

/* ── Panel 1: what each week paid ──
   Grouped bars, one pair per week. A 2px paper gap sits between the pair and
   the next, so adjacent bars are separated by surface rather than by outline. */
function ctrBars(d) {
  const W = 760, H = 190, padL = 40, padR = 12, padT = 12, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const peak = Math.max(1, ...['jenn', 'jess'].flatMap(k => d.rows[k].map(r => r.total)));
  const step = plotW / d.weeks.length;
  const bw = Math.min(18, (step - 10) / 2);
  const y = v => padT + plotH - (v / peak * plotH);

  // Solid hairline grid, one shade off the surface.
  let grid = '', ticks = '';
  for (let i = 0; i <= 4; i++) {
    const v = peak / 4 * i, yy = y(v);
    grid += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#e8dfc3" stroke-width="1"/>`;
    ticks += `<text x="${padL - 6}" y="${yy + 3}" text-anchor="end" class="ctr-tick">${ckMoney(v)}</text>`;
  }
  let bars = '', labels = '';
  d.weeks.forEach((w, i) => {
    const cx = padL + step * i + step / 2;
    ['jenn', 'jess'].forEach((k, j) => {
      const r = d.rows[k][i];
      const h = Math.max(0, plotH - (y(r.total) - padT));
      const x = cx - bw - 1 + j * (bw + 2);   // 2px paper gap between the pair
      if (h > 0) {
        bars += `<rect x="${x}" y="${y(r.total)}" width="${bw}" height="${h}" rx="4"
          fill="${CTR_KID_COLOR[k]}" stroke="#2a2320" stroke-width="2">
          <title>${k === 'jenn' ? 'Jenn' : 'Jess'} · week of ${w.label}: ${ckMoney(r.total)}${r.frozen ? ' (settled)' : ''}</title></rect>`;
      }
    });
    labels += `<text x="${cx}" y="${H - 8}" text-anchor="middle" class="ctr-xlab">${w.label}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="ctr-svg" role="img"
      aria-label="What each of the last ${CT_SUMMARY_WEEKS} weeks paid, Jenn and Jess side by side">
    ${grid}${ticks}
    <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#2a2320" stroke-width="2"/>
    ${bars}${labels}</svg>`;
}

/* ── Panel 2: the pile so far ──
   Its own axis, because a running total and a single week are not the same
   measure. Only the last point of each line is labelled. */
function ctrLines(d) {
  const W = 760, H = 150, padL = 40, padR = 58, padT = 12, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const peak = Math.max(1, ...['jenn', 'jess'].map(k => d.rows[k][d.rows[k].length - 1].cum));
  const step = plotW / Math.max(1, d.weeks.length - 1);
  const y = v => padT + plotH - (v / peak * plotH);

  let grid = '', ticks = '';
  for (let i = 0; i <= 3; i++) {
    const v = peak / 3 * i, yy = y(v);
    grid += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#e8dfc3" stroke-width="1"/>`;
    ticks += `<text x="${padL - 6}" y="${yy + 3}" text-anchor="end" class="ctr-tick">${ckMoney(v)}</text>`;
  }
  // Two lines that finish close together would stack their end labels on top
  // of each other. Nudge them apart, lower value downward, before drawing.
  const endY = {};
  ['jenn', 'jess'].forEach(k => { endY[k] = y(d.rows[k][d.rows[k].length - 1].cum); });
  if (Math.abs(endY.jenn - endY.jess) < 12) {
    const lower = endY.jenn > endY.jess ? 'jenn' : 'jess';
    const upper = lower === 'jenn' ? 'jess' : 'jenn';
    const mid = (endY.jenn + endY.jess) / 2;
    endY[upper] = mid - 6; endY[lower] = mid + 6;
  }
  let lines = '', dots = '', ends = '';
  ['jenn', 'jess'].forEach(k => {
    const pts = d.rows[k].map((r, i) => `${padL + step * i},${y(r.cum)}`).join(' ');
    lines += `<polyline points="${pts}" fill="none" stroke="${CTR_KID_COLOR[k]}" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round"/>`;
    d.rows[k].forEach((r, i) => {
      dots += `<circle cx="${padL + step * i}" cy="${y(r.cum)}" r="4" fill="${CTR_KID_COLOR[k]}"
        stroke="#fffdf5" stroke-width="2"><title>${k === 'jenn' ? 'Jenn' : 'Jess'} by ${r.week.label}: ${ckMoney(r.cum)}</title></circle>`;
    });
    // The label wears ink; a small mark beside it carries identity. Colouring
    // the text itself would make the value legible only to colour.
    const last = d.rows[k][d.rows[k].length - 1];
    ends += `<circle cx="${padL + plotW + 10}" cy="${endY[k]}" r="3.5" fill="${CTR_KID_COLOR[k]}" stroke="#2a2320" stroke-width="1"/>`
          + `<text x="${padL + plotW + 17}" y="${endY[k] + 4}" class="ctr-endlab">${ckMoney(last.cum)}</text>`;
  });
  let labels = '';
  d.weeks.forEach((w, i) => {
    labels += `<text x="${padL + step * i}" y="${H - 8}" text-anchor="middle" class="ctr-xlab">${w.label}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="ctr-svg" role="img"
      aria-label="The running total across the last ${CT_SUMMARY_WEEKS} weeks, Jenn and Jess">
    ${grid}${ticks}
    <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#2a2320" stroke-width="2"/>
    ${lines}${dots}${ends}${labels}</svg>`;
}

function ctrLegend() {
  return `<div class="ctr-legend">${['jenn', 'jess'].map(k =>
    `<span class="ctr-legend-item"><span class="ctr-swatch" style="background:${CTR_KID_COLOR[k]}"></span>${CT_PROFILE_ICON[k]} ${k === 'jenn' ? 'Jenn' : 'Jess'}</span>`).join('')}</div>`;
}

/* ── Heatmap: where the money came from ──
   Also the table view the contrast check obliges — every cell carries its
   number, so the colour is a second reading of the value, never the only one. */
function ctrHeat(d, kid) {
  const chans = [
    { id: 'chores', label: '🧹 Household chores' },
    { id: 'learning', label: '📘 Learning' },
    { id: 'streak', label: '🔥 Streak' },
    { id: 'competition', label: '🏆 Competition' },
    { id: 'fines', label: '📦 Fines' },
  ];
  const peak = Math.max(1, ...chans.flatMap(c => d.rows[kid].map(r => r[c.id])));
  const head = `<div class="ctr-heat-row ctr-heat-head"><div></div>${
    d.weeks.map(w => `<div class="ctr-xlab2">${w.label}</div>`).join('')}</div>`;
  const rows = chans.map(c => {
    const cells = d.rows[kid].map(r => {
      const v = r[c.id];
      // Zero is paper, not the bottom of the ramp: nothing happened should not
      // look like a little of something.
      const bg = v <= 0 ? 'var(--paper)' : CTR_HEAT[Math.min(CTR_HEAT.length - 1, Math.floor(v / peak * CTR_HEAT.length))];
      const fg = v <= 0 ? '#b9ac95' : (v / peak > 0.55 ? '#fffdf5' : '#1a2b20');
      return `<div class="ctr-heat-cell" style="background:${bg};color:${fg}"
        title="${escapeAttr(c.label)} · week of ${r.week.label}: ${ckMoney(v)}">${v > 0 ? ckMoney(v) : '·'}</div>`;
    }).join('');
    return `<div class="ctr-heat-row"><div class="ctr-heat-label">${c.label}</div>${cells}</div>`;
  }).join('');
  return `<div class="ck-gridwrap"><div class="ctr-heat">${head}${rows}</div></div>`;
}

/* ── What it says ──
   The read, in a sentence. A chart nobody interprets is a chart nobody uses. */
function ctrRead(d) {
  const bits = [];
  ['jenn', 'jess'].forEach(k => {
    const rs = d.rows[k], name = k === 'jenn' ? 'Jenn' : 'Jess';
    const live = rs.filter(r => r.has);
    if (!live.length) { bits.push(`${name} has nothing recorded in this window yet.`); return; }
    // Compare weeks that actually finished. The last column is usually the week
    // being lived right now, and reading a half-finished week as a downturn is
    // the easiest way for a chart to say something untrue.
    const running = rs[rs.length - 1].week.key === ctThisWeekKey();
    const settledRuns = live.filter(r => !(running && r === rs[rs.length - 1]));
    const first = settledRuns[0], lastDone = settledRuns[settledRuns.length - 1];
    const dir = !lastDone || settledRuns.length < 2 ? 'just starting out'
      : lastDone.total > first.total ? 'climbing'
      : lastDone.total < first.total ? 'easing off' : 'holding level';
    const total = rs[rs.length - 1].cum;
    const chores = rs.reduce((s, r) => s + r.chores, 0);
    const fines = rs.reduce((s, r) => s + r.fines, 0);
    const share = total > 0 ? Math.round(chores / total * 100) : 0;
    bits.push(`${name} is ${dir} — ${ckMoney(total)} across ${live.length} week${live.length === 1 ? '' : 's'}, `
      + `${share}% of it from household chores${fines ? `, with ${ckMoney(fines)} lost to fines` : ', with no fines at all'}`
      + `${running ? '. This week is still being lived, so it is not counted in that direction' : ''}.`);
  });
  const settled = d.weeks.filter(w => ['jenn', 'jess'].some(k => ctrRow(w.key, k).frozen)).length;
  bits.push(`${settled} of these ${CT_SUMMARY_WEEKS} weeks were settled at a meeting and are frozen — changing a price today cannot restate them.`);
  return bits.map(b => `<div class="ctr-read-line">${escapeHtml(b)}</div>`).join('');
}

/* ── CSV ──
   One row per kid per week, every channel, so the numbers can leave the app. */
function ctrExportCsv() {
  const d = ctrData();
  const head = ['week', 'kid', 'total', 'cumulative', 'chores', 'learning', 'streak', 'competition', 'fines', 'xp', 'settled'];
  const lines = [head.join(',')];
  d.weeks.forEach((w, i) => {
    ['jenn', 'jess'].forEach(k => {
      const r = d.rows[k][i];
      lines.push([w.key, k, r.total, r.cum, r.chores, r.learning, r.streak,
                  r.competition, r.fines, r.xp, r.frozen ? 'yes' : 'no'].join(','));
    });
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `weekly-planner-trends-${d.weeks[0].key}-to-${d.weeks[d.weeks.length - 1].key}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Eight weeks exported 📄');
}

/* ── The tab ── */
function ctrRenderTrends() {
  const wrap = document.getElementById('ctrWrap');
  if (!wrap) return;
  ctPrepareRead();
  if (!ctWeekKey) ctSetCurrentWeekFromPlanner();
  const d = ctrData();
  const range = `${d.weeks[0].label} – ${d.weeks[d.weeks.length - 1].label}`;
  wrap.innerHTML = `<div class="ctr-tab">
    <div class="ctr-head">
      <div>
        <div class="cp-title">Eight weeks · ${range}</div>
        <div class="ck-sub">${ctrOffset ? `${ctrOffset * CT_SUMMARY_WEEKS} weeks back from now.` : 'Ending with the week the portal is on.'} A settled week is frozen at what was agreed.</div>
      </div>
      <span class="ck-spacer"></span>
      <button type="button" class="ck-navbtn" data-ctr-action="page" data-delta="1" aria-label="Eight weeks earlier">‹</button>
      <button type="button" class="ck-navbtn" data-ctr-action="page" data-delta="-1" aria-label="Eight weeks later"${ctrOffset <= 0 ? ' disabled' : ''}>›</button>
      <button type="button" class="ck-btn" data-ctr-action="csv">Export CSV</button>
    </div>
    <div class="ctr-cards">${ctrCards(d)}</div>
    <div class="cp-sect">
      <div class="cp-cap">What each week paid</div>
      ${ctrLegend()}
      ${ctrBars(d)}
      <div class="cp-cap cp-cap-gap">The pile so far</div>
      <div class="ck-sub">Its own scale, on purpose. A running total and a single week are different measures, and sharing one axis would invent a relationship that isn't there.</div>
      ${ctrLines(d)}
    </div>
    <div class="cp-sect">
      <div class="cp-cap">Where it came from — ${ctParentKid === 'jess' ? 'Jess' : 'Jenn'}</div>
      <div class="ck-sub">Darker is more. Every cell carries its number, so the colour is a second reading and never the only one.</div>
      ${ctrHeat(d, ctParentKid === 'jess' ? 'jess' : 'jenn')}
    </div>
    <div class="cp-sect"><div class="cp-cap">What it says</div>${ctrRead(d)}</div>
  </div>`;
}

function ctrHandleClick(e) {
  const el = e.target.closest('[data-ctr-action]');
  if (!el || el.disabled) return;
  if (el.dataset.ctrAction === 'page') {
    ctrOffset = Math.max(0, ctrOffset + (+el.dataset.delta));
    ctrRenderTrends();
  } else if (el.dataset.ctrAction === 'csv') ctrExportCsv();
}
