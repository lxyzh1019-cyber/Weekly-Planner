// Smoke group: Today (Consistency PR 7) — withMumReadsInBothLooks, which since Stage 55 also measures Today's kit rows (.ui-row) and "Coming up" card corners in both looks, and since the owner's correction C6 (2026-10-12) the pale open catch-up day. tests/smoke.js calls it after the looks walks, on its one shared page; the check seeds the "with Mum" row it measures and puts back what it seeded.
module.exports = async ({ page, want, checks, shot, setLook, clearLooks }) => {
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
    /* Whether the week's earnings entry existed before this check: if
       mrEnsureEarnings makes it here, the restore deletes it again rather than
       leaving an empty week behind. */
    const p0 = getProfData(kid);
    const hadWeek = !!(p0 && p0.earnings && Object.prototype.hasOwnProperty.call(p0.earnings, wk));
    const e = mrEnsureEarnings(kid, wk);
    window.__withMumHad = { wk, day, hadWeek, e: JSON.stringify(e), today: JSON.stringify(getDayBlocks(day, kid) || []),
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
        const go = document.querySelector('#tdWrap .ui-row[data-td-action="waiting"] .ui-row-end');
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
        const row = go.closest('.ui-row');
        return { ratio: (hi + 0.05) / (lo + 0.05), text: go.textContent.trim(), fg: hex(fg), bg: hex(bg),
          colour: getComputedStyle(go).color, opacity: getComputedStyle(row).opacity };
      });
      if (r.missing) { bad.push(`${look}: no "with Mum" row on Today after the claim`); continue; }
      const jobs = await page.$('#tdWrap .td-jobs');
      if (jobs) await jobs.screenshot({ path: shot(`today-with-mum-${look}`) });
      console.log(`withMumReadsInBothLooks: ${look} "${r.text}" ${r.ratio.toFixed(2)}:1 (text ${r.fg} on ${r.bg}; colour ${r.colour}, row opacity ${r.opacity})`);
      if (r.text !== 'with Mum') bad.push(`${look}: the waiting row reads "${r.text}", want "with Mum"`);
      if (!(r.ratio >= 4.5)) bad.push(`${look}: "with Mum" is ${r.ratio.toFixed(2)}:1 on its row (text ${r.fg} on ${r.bg}), want at least 4.5:1`);
      /* Stage 55 (owner answers G8, G9): Today's rows are the kit's list row —
         at least 52px, a 2px border and an 11px corner on every side, the icon
         before the name; the waiting row in the done look (the green wash, the
         name struck through); an add row dashed. "Coming up" cards have 11px
         corners. A planted row with an 18px corner must be caught. */
      const kit = await page.evaluate(() => {
        const out = [];
        const faults = (el) => {
          const cs = getComputedStyle(el), p = [];
          const floor = el.classList.contains('ui-row--parent') ? 44 : 52;
          const h = el.getBoundingClientRect().height;
          if (h < floor - 0.5) p.push(`is ${h.toFixed(1)}px high, under ${floor}`);
          ['Top', 'Right', 'Bottom', 'Left'].forEach(s => { if (cs[`border${s}Width`] !== '2px') p.push(`its ${s.toLowerCase()} border is ${cs[`border${s}Width`]}, want 2px`); });
          ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].forEach(c => { if (cs[`border${c}Radius`] !== '11px') p.push(`its ${c} corner is ${cs[`border${c}Radius`]}, want 11px`); });
          const icon = el.querySelector(':scope > .ui-row-icon'), name = el.querySelector(':scope > .ui-row-name');
          if (!name) p.push('has no name slot (.ui-row-name)');
          else if (icon && icon.getBoundingClientRect().right > name.getBoundingClientRect().left + 0.5) p.push('has its icon after its name');
          return p;
        };
        const label = el => `"${el.textContent.replace(/\s+/g, ' ').trim().slice(0, 30)}"`;
        const rows = [...document.querySelectorAll('#tdWrap .ui-row')].filter(el => el.getClientRects().length);
        if (!rows.length) out.push('no kit row (.ui-row) on Today');
        rows.forEach(el => faults(el).forEach(f => out.push(`the row ${label(el)} ${f}`)));
        const waiting = document.querySelector('#tdWrap .ui-row[data-td-action="waiting"]');
        if (waiting) {
          const wash = getComputedStyle(document.documentElement).getPropertyValue('--status-done-wash').trim();
          const probe = document.createElement('div'); probe.style.background = wash; document.body.appendChild(probe);
          const want = getComputedStyle(probe).backgroundColor; probe.remove();
          if (!waiting.classList.contains('ui-row--done')) out.push('the "with Mum" row is not in the done look (.ui-row--done)');
          if (getComputedStyle(waiting).backgroundColor !== want) out.push(`the "with Mum" row's fill is ${getComputedStyle(waiting).backgroundColor}, want the done wash ${want}`);
          const nm = waiting.querySelector('.ui-row-name');
          if (!nm) out.push('the "with Mum" row has no name');
          else if (/line-through/.test(getComputedStyle(nm).textDecorationLine)) out.push('the "with Mum" row\'s name is struck through; only an answered row is');
        }
        document.querySelectorAll('#tdWrap .ui-row[data-td-action="fresh"] .ui-row-name').forEach(nm => {
          if (!/line-through/.test(getComputedStyle(nm).textDecorationLine)) out.push('an answered row\'s name is not struck through');
        });
        document.querySelectorAll('#tdWrap .ui-row--add').forEach(el => {
          if (getComputedStyle(el).borderTopStyle !== 'dashed') out.push(`the add row ${label(el)} is not dashed`);
        });
        const cards = [...document.querySelectorAll('#tdWrap .quest-card')].filter(el => el.getClientRects().length);
        if (cards.length === 0) out.push('no Coming up card is drawn, so no corner was measured');
        cards.forEach(el => {
          const cs = getComputedStyle(el);
          ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].forEach(c => { if (cs[`border${c}Radius`] !== '11px') out.push(`the Coming up card ${label(el)} has a ${cs[`border${c}Radius`]} ${c} corner, want 11px`); });
        });
        const planted = document.createElement('button');
        planted.type = 'button'; planted.className = 'ui-row'; planted.style.borderRadius = '18px';
        planted.innerHTML = '<span class="ui-row-icon">✳</span><span class="ui-row-name">Planted</span>';
        document.getElementById('tdWrap').appendChild(planted);
        if (!faults(planted).some(f => /corner is 18px/.test(f))) out.push('the row check missed a planted row with an 18px corner');
        planted.remove();
        /* C6 (owner 2026-10-12): an open catch-up day turns pale (--bg2), a
           closed one stays paper. Measured on a Catch up card as Today draws it
           (the real one when Today shows one, and a copy of its markup always);
           a plant (an open day forced to paper) must be caught. */
        const ink = (v) => { const p = document.createElement('i'); p.style.background = v; document.body.appendChild(p); const c = getComputedStyle(p).backgroundColor; p.remove(); return c; };
        const pale = ink('var(--bg2)'), paper = ink('var(--paper)');
        const paleFaults = (row) => {
          const open = row.getAttribute('aria-expanded') === 'true', bg = getComputedStyle(row).backgroundColor;
          return bg === (open ? pale : paper) ? [] : [`an ${open ? 'open' : 'closed'} catch-up day is ${bg}, want ${open ? 'the pale ' + pale : 'the paper ' + paper}`];
        };
        const fx = document.createElement('div');
        fx.className = 'ui-card td-catchup';
        fx.innerHTML = ['true', 'false'].map(o => `<button type="button" class="ui-row" data-td-action="catchup-day" aria-expanded="${o}"><span class="ui-row-name">Mon</span></button>`).join('');
        document.getElementById('tdWrap').appendChild(fx);
        [...fx.children].forEach(r => paleFaults(r).forEach(f => out.push(f)));
        fx.firstElementChild.style.background = 'var(--paper)';
        if (!paleFaults(fx.firstElementChild).length) out.push('the catch-up check missed its plant (an open day drawn paper)');
        fx.remove();
        const real = document.querySelector('#tdWrap .td-catchup [data-td-action="catchup-day"]');
        let realSeen = false;
        if (real && typeof tdCatchUpOpen !== 'undefined') {
          tdCatchUpOpen = real.getAttribute('data-td-day'); tdRenderToday();
          const openRow = document.querySelector('#tdWrap .td-catchup [data-td-action="catchup-day"][aria-expanded="true"]');
          if (!openRow) out.push('Today drew no open catch-up day after opening one');
          else { realSeen = true; paleFaults(openRow).forEach(f => out.push(`Today: ${f}`)); }
          tdCatchUpOpen = null; tdRenderToday();
        }
        return { out, rows: rows.length, cards: cards.length, realSeen };
      });
      console.log(`withMumReadsInBothLooks: ${look} ${kit.rows} kit rows, ${kit.cards} Coming up cards measured; the open catch-up day measured on ${kit.realSeen ? 'Today\'s own card and ' : ''}a copy of its markup`);
      kit.out.forEach(f => bad.push(`${look}: ${f}`));
    }
  } finally {
    try { await clearLooks(); } catch (e) { bad.push('could not put Pop back: ' + e.message); }
    await page.evaluate(() => {
      const h = window.__withMumHad;
      if (!h) return;
      const kid = 'jenn', p = getProfData(kid);
      if (h.hadWeek) p.earnings[h.wk] = JSON.parse(h.e);
      else if (p.earnings) delete p.earnings[h.wk];
      setDayBlocks(h.day, JSON.parse(h.today), kid);
      [profile, parentViewing, parentUnlockedThisSession] = h.who;
      window.__withMumHad = null;
      goToday();
    });
  }
  checks.withMumReadsInBothLooks = bad.length ? bad : true;
};
