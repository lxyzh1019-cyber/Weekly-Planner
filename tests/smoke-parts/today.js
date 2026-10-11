// Smoke group: Today (Consistency PR 7) — withMumReadsInBothLooks. tests/smoke.js calls it after the looks walks, on its one shared page; the check seeds the "with Mum" row it measures and puts back what it seeded.
module.exports = async ({ page, want, checks, setLook, clearLooks }) => {
  /* D18 — a chore she has claimed and Mum has not answered reads "with Mum"
     on Today's Jobs I can do card. In Calm the words were the look's
     --accent-strong on a row faded to 0.75, too pale to read. Measured on the
     composited pixels: every background from the page down, each opacity
     group applied as the browser applies it (the layer composed, then faded
     over what is behind it), the text likewise. Pop and Calm, at least 4.5:1.
     Seed (the shape tests/smoke-parts/looks.js describes): a dishes block on
     today for Jenn and her claim on it, ungraded. */
  if (!want('withMumReadsInBothLooks')) return;
  const bad = [];
  const seeded = await page.evaluate(() => {
    const kid = 'jenn', wk = ctThisWeekKey(), d = tdTodayIndex(), day = todayKey();
    if (d == null) return 'precondition: today is not in the planner week';
    const e = mrEnsureEarnings(kid, wk);
    window.__withMumHad = { wk, day, e: JSON.stringify(e), today: JSON.stringify(getDayBlocks(day, kid) || []),
      who: [profile, parentViewing, parentUnlockedThisSession] };
    profile = 'jenn'; parentViewing = 'jenn'; parentUnlockedThisSession = false;
    setDayBlocks(day, [...(getDayBlocks(day, kid) || []),
      { id: 'withmum', actId: 'chores', startMin: 17 * 60, durationMin: 30,
        choreTags: ['Dishes & dishwasher'], checklistState: {} }], kid);
    const rows = tdJobsToday(kid).rows;
    if (!rows.length) return 'precondition: no job on Today after planning dishes';
    const id = rows[0].row.id, k = String(d);
    if (!e.claims[k]) e.claims[k] = {};
    e.claims[k][id] = 3;
    if (e.chores && e.chores[k]) delete e.chores[k][id];
    if (e.gradedAt && e.gradedAt[k]) delete e.gradedAt[k][id];
    return '';
  });
  if (seeded) bad.push(seeded);
  try {
    for (const look of seeded ? [] : ['pop', 'calm']) {
      await setLook(look);
      const r = await page.evaluate(() => {
        goToday();
        const go = document.querySelector('#tdWrap .td-row--waiting .td-row-go');
        if (!go) return { missing: true };
        const parse = (s) => {
          let m = /rgba?\(([^)]*)\)/.exec(s);
          if (m) {
            const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
            return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
          }
          m = /color\(srgb ([^)]*)\)/.exec(s);
          if (m) {
            const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number);
            return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1];
          }
          return [0, 0, 0, 0];
        };
        const over = (s, u) => {
          const a = s[3] + u[3] * (1 - s[3]);
          if (!a) return [0, 0, 0, 0];
          return [0, 1, 2].map(i => (s[i] * s[3] + u[i] * u[3] * (1 - s[3])) / a).concat(a);
        };
        const chain = [];
        for (let el = go; el; el = el.parentElement) chain.unshift(el);
        // The pixel under the text (withText false) or of the text itself.
        const paint = (i, under, withText) => {
          const cs = getComputedStyle(chain[i]);
          const op = Number(cs.opacity);
          let layer = over(parse(cs.backgroundColor), op < 1 ? [0, 0, 0, 0] : under);
          layer = i === chain.length - 1 ? (withText ? over(parse(cs.color), layer) : layer)
            : paint(i + 1, layer, withText);
          return op < 1 ? over([layer[0], layer[1], layer[2], layer[3] * op], under) : layer;
        };
        const white = [255, 255, 255, 1];
        const fg = paint(0, white, true), bg = paint(0, white, false);
        const lum = (c) => {
          const [r, g, b] = c.slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
        const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
        const row = go.closest('.td-row');
        return { ratio: (hi + 0.05) / (lo + 0.05), text: go.textContent.trim(), fg: hex(fg), bg: hex(bg),
          colour: getComputedStyle(go).color, opacity: getComputedStyle(row).opacity };
      });
      if (r.missing) { bad.push(`${look}: no "with Mum" row on Today after the claim`); continue; }
      console.log(`withMumReadsInBothLooks: ${look} "${r.text}" ${r.ratio.toFixed(2)}:1 (text ${r.fg} on ${r.bg}; colour ${r.colour}, row opacity ${r.opacity})`);
      if (r.text !== 'with Mum') bad.push(`${look}: the waiting row reads "${r.text}", want "with Mum"`);
      if (!(r.ratio >= 4.5)) bad.push(`${look}: "with Mum" is ${r.ratio.toFixed(2)}:1 on its row (text ${r.fg} on ${r.bg}), want at least 4.5:1`);
    }
  } finally {
    try { await clearLooks(); } catch (e) { bad.push('could not put Pop back: ' + e.message); }
    await page.evaluate(() => {
      const h = window.__withMumHad;
      if (!h) return;
      const kid = 'jenn', p = getProfData(kid);
      p.earnings[h.wk] = JSON.parse(h.e);
      setDayBlocks(h.day, JSON.parse(h.today), kid);
      [profile, parentViewing, parentUnlockedThisSession] = h.who;
      window.__withMumHad = null;
      goToday();
    });
  }
  checks.withMumReadsInBothLooks = bad.length ? bad : true;
};
