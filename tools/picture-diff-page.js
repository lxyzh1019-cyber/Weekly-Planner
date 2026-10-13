// Picture differences page: old and new pictures side by side, numbered, in one self-contained HTML file — from a CI `pictures` artifact, or between two git refs.
//
// Run:  node tools/picture-diff-page.js <artifact folder> <out.html> [title]
//   <artifact folder>  the downloaded CI artifact `pictures`
//                      (gh run download <run-id> -n pictures -D <folder>);
//                      it holds pictures-new/ and pictures-diff/.
//   The OLD picture is read from tests/reference/ — run this BEFORE copying
//   the new pictures into tests/reference/.
// Pictures are embedded (base64), so the page still shows the old picture
// after the references are replaced.
//
// Run:  node tools/picture-diff-page.js --git <oldRef> <newRef> <out.html> [title] [--notes <notes.json>]
//   Every picture under tests/reference/ that differs between the two refs
//   (git diff --name-only), read with git show <ref>:<path>. Grouped by state;
//   in each group the iPad Pop pairs come first, in full; phone and Calm pairs
//   are cropped to the difference box (2 levels per channel, as the picture
//   test) plus 24px. Each picture is tagged with the notes sections whose
//   `commits` pattern matches a commit subject that changed it between the
//   refs. Needs a browser (the same search as tests/pictures.js): the pictures
//   are compared, cropped and stored as WebP in the page. Prints the page's
//   size; exits 1 above 8 MB (the target is 6 MB).
//   notes.json: { "intro": "…", "sections": [{ "title": "…", "line": "…",
//     "items": ["…"], "commits": "<regex on commit subjects>" }] }
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STYLE = `<style>
  :root { --bg: #fff; --ink: #1d1d1f; --sub: #666; --line: #ddd; }
  @media (prefers-color-scheme: dark) { :root { --bg: #161616; --ink: #eee; --sub: #aaa; --line: #333; } }
  body { margin: 0; padding: 16px; background: var(--bg); color: var(--ink); font: 15px/1.4 system-ui, sans-serif; }
  h1 { font-size: 22px; } h2 { font-size: 17px; margin: 28px 0 8px; } h3 { font-size: 15px; margin: 20px 0 6px; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 700px) { .pair { grid-template-columns: 1fr; } }
  figure { margin: 0; } figcaption { color: var(--sub); margin-bottom: 4px; }
  img { max-width: 100%; height: auto; border: 1px solid var(--line); }
  .full img { width: 100%; }
  .tag { color: var(--sub); font-weight: normal; }
  ol a, ul a { color: inherit; }
</style>`;
const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${STYLE}</head><body>
<h1>${esc(title)}</h1>
${body}
</body></html>
`;

function artifactMode([dir, out, title = 'Picture differences']) {
  if (!dir || !out) { console.error('usage: node tools/picture-diff-page.js <artifact folder> <out.html> [title]\n       node tools/picture-diff-page.js --git <oldRef> <newRef> <out.html> [title] [--notes <notes.json>]'); process.exit(2); }
  const find = (name) => [path.join(dir, name), path.join(dir, 'tests', 'out', name)].find(p => fs.existsSync(p));
  const diffDir = find('pictures-diff'), newDir = find('pictures-new');
  if (!newDir) { console.error('no pictures-new/ in ' + dir); process.exit(1); }
  const REF = path.join(__dirname, '..', 'tests', 'reference');
  const names = diffDir ? fs.readdirSync(diffDir).filter(f => f.endsWith('.png')).sort() : [];
  const img = (p) => p && fs.existsSync(p) ? `data:image/png;base64,${fs.readFileSync(p).toString('base64')}` : '';

  const rows = names.map((n, i) => {
    const before = img(path.join(REF, n)), after = img(path.join(newDir, n)), diff = img(path.join(diffDir, n));
    return `<section id="d${i + 1}">
  <h2>${i + 1}. ${esc(n.replace(/\.png$/, ''))}</h2>
  <div class="pair full">
    <figure><figcaption>Before (tests/reference)</figcaption>${before ? `<img src="${before}" alt="before">` : '<p>no reference</p>'}</figure>
    <figure><figcaption>After (this branch, CI)</figcaption>${after ? `<img src="${after}" alt="after">` : '<p>no picture</p>'}</figure>
  </div>
  ${diff ? `<details><summary>Changed pixels</summary><img src="${diff}" alt="changed pixels"></details>` : ''}
</section>`;
  }).join('\n');

  fs.writeFileSync(out, page(title, `<p>${names.length} picture${names.length === 1 ? '' : 's'} changed. Each pair: the old reference on the left, the new picture on the right.</p>
<ol>${names.map((n, i) => `<li><a href="#d${i + 1}">${esc(n.replace(/\.png$/, ''))}</a></li>`).join('')}</ol>
${rows}`));
  console.log(`${names.length} differing picture(s) → ${out}`);
}

/* ── Git mode ─────────────────────────────────────────────────────────── */

const TARGET_MB = 6, CAP_MB = 8, PAD = 24, TOL = 2;
// Stored size: the iPad Pop pictures in full and the crops, scaled and as WebP
// at this quality, so 400-odd pictures stay under the size target.
const FULL_SCALE = 0.5, CROP_SCALE = 0.55, QUALITY = 0.5;
const NAME = /^(.*)-(jenn|jess|parent|any)-(ipad|phone)-(pop|calm)\.png$/;

// The same browser search as tests/pictures.js, copied as it copies it.
function findChromium() {
  if (process.env.SMOKE_CHROMIUM) return process.env.SMOKE_CHROMIUM;
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    '/opt/pw-browsers',
    path.join(os.homedir(), '.cache', 'ms-playwright'),
    path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright')
  ];
  const binaries = [
    ['chrome-linux', 'chrome'],
    ['chrome-linux', 'headless_shell'],
    ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
    ['chrome-win', 'chrome.exe'],
    ['chrome-win64', 'chrome.exe']
  ];
  for (const root of roots) {
    if (!root || !fs.existsSync(root)) continue;
    for (const d of fs.readdirSync(root)) {
      if (!d.startsWith('chromium')) continue;
      for (const parts of binaries) {
        const p = path.join(root, d, ...parts);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]) {
    if (!base) continue;
    const p = path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe');
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

const git = (...a) => execFileSync('git', a, { cwd: path.join(__dirname, '..'), maxBuffer: 1 << 28 });
const show = (ref, p) => { try { return git('show', `${ref}:${p}`); } catch (e) { return null; } };

// In the browser: both PNGs decoded, compared (TOL per channel), and returned
// as WebP — whole, or cropped to the difference box plus `pad`.
function comparePair({ a, b, tol, pad, full, scale, quality }) {
  const load = (src) => src ? new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('not a PNG')); i.src = src; }) : Promise.resolve(null);
  return Promise.all([load(a), load(b)]).then(([ia, ib]) => {
    const w = Math.max(ia ? ia.width : 0, ib ? ib.width : 0), h = Math.max(ia ? ia.height : 0, ib ? ib.height : 0);
    const pix = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d', { willReadFrequently: true }); if (img) x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const pa = pix(ia), pb = pix(ib);
    const inA = (x, y) => !!ia && x < ia.width && y < ia.height, inB = (x, y) => !!ib && x < ib.width && y < ib.height;
    let count = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let same = inA(x, y) === inB(x, y);
      if (same && inA(x, y)) same = Math.abs(pa[i] - pb[i]) <= tol && Math.abs(pa[i + 1] - pb[i + 1]) <= tol &&
        Math.abs(pa[i + 2] - pb[i + 2]) <= tol && Math.abs(pa[i + 3] - pb[i + 3]) <= tol;
      if (!same) { count++; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    }
    const box = count ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null;
    const crop = full || !box ? { x: 0, y: 0, w, h }
      : { x: Math.max(0, x0 - pad), y: Math.max(0, y0 - pad), w: Math.min(w, x1 + 1 + pad) - Math.max(0, x0 - pad), h: Math.min(h, y1 + 1 + pad) - Math.max(0, y0 - pad) };
    const out = (img) => {
      if (!img) return null;
      const c = document.createElement('canvas');
      const sw = Math.min(crop.w, img.width - crop.x), sh = Math.min(crop.h, img.height - crop.y);
      if (sw <= 0 || sh <= 0) return null;
      c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
      x.drawImage(img, crop.x, crop.y, sw, sh, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', quality);
    };
    return { count, box, crop, before: out(ia), after: out(ib),
      sizes: [ia ? `${ia.width}×${ia.height}` : 'none', ib ? `${ib.width}×${ib.height}` : 'none'] };
  });
}

async function gitMode(a) {
  const ni = a.indexOf('--notes');
  const notes = ni >= 0 ? JSON.parse(fs.readFileSync(a[ni + 1], 'utf8')) : { sections: [] };
  if (ni >= 0) a.splice(ni, 2);
  const [oldRef, newRef, out, title = `Picture differences, ${a[0]} → ${a[1]}`] = a;
  if (!oldRef || !newRef || !out) { console.error('usage: node tools/picture-diff-page.js --git <oldRef> <newRef> <out.html> [title] [--notes <notes.json>]'); process.exit(2); }
  const oldSha = git('rev-parse', '--short', oldRef).toString().trim(), newSha = git('rev-parse', '--short', newRef).toString().trim();
  const files = git('diff', '--name-only', oldRef, newRef, '--', 'tests/reference/').toString().split('\n').filter(f => f.endsWith('.png'));

  // Which commits between the refs changed each picture.
  const subjects = {};
  let cur = null;
  git('log', '--format=@@%h %s', '--name-only', `${oldRef}..${newRef}`, '--', 'tests/reference/').toString().split('\n').forEach(l => {
    if (l.startsWith('@@')) cur = l.slice(2);
    else if (l.trim()) (subjects[l.trim()] = subjects[l.trim()] || []).push(cur);
  });
  const sections = (notes.sections || []).map((s, i) => Object.assign({ id: `s${i + 1}` }, s, { re: s.commits ? new RegExp(s.commits) : null }));

  const pics = files.map(f => {
    const base = path.basename(f), m = NAME.exec(base) || [base, base.replace(/\.png$/, ''), '', '', ''];
    const subs = subjects[f] || [];
    const tags = sections.filter(s => s.re && subs.some(c => s.re.test(c.replace(/^\S+ /, ''))));
    return { f, name: base.replace(/\.png$/, ''), state: m[1], user: m[2], size: m[3], look: m[4], subs, tags };
  });
  const order = (p) => (p.size === 'ipad' && p.look === 'pop' ? 0 : p.size === 'ipad' ? 1 : p.look === 'pop' ? 2 : 3);
  const states = [...new Set(pics.map(p => p.state))].map(state => {
    const list = pics.filter(p => p.state === state).sort((x, y) => order(x) - order(y) || x.name.localeCompare(y.name));
    const tags = sections.filter(s => list.some(p => p.tags.includes(s)));
    return { state, list, tags };
  });
  const firstTag = (st) => st.tags.length ? sections.indexOf(st.tags[0]) : sections.length;
  states.sort((x, y) => firstTag(x) - firstTag(y) || x.state.localeCompare(y.state));

  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({ executablePath: findChromium() });
  const tab = await (await browser.newContext()).newPage();
  await tab.goto('about:blank');
  const durl = (buf) => buf ? 'data:image/png;base64,' + buf.toString('base64') : null;
  let n = 0;
  for (const st of states) {
    for (const p of st.list) {
      p.n = ++n;
      p.full = p.size === 'ipad' && p.look === 'pop';
      p.res = await tab.evaluate(comparePair, { a: durl(show(oldRef, p.f)), b: durl(show(newRef, p.f)), tol: TOL, pad: PAD, full: p.full,
        scale: p.full ? FULL_SCALE : CROP_SCALE, quality: QUALITY });
    }
  }
  await browser.close();

  const box = (b) => b ? `x=${b.x} y=${b.y} w=${b.w} h=${b.h}` : 'none';
  const fig = (label, src) => `<figure><figcaption>${label}</figcaption>${src ? `<img src="${src}" alt="${esc(label)}">` : '<p>none</p>'}</figure>`;
  const sectionHtml = sections.map(s => {
    const own = states.filter(st => st.tags.includes(s));
    const count = pics.filter(p => p.tags.includes(s)).length;
    return `<section id="${s.id}"><h2>${esc(s.title)}</h2>
<p>${esc(s.line || '')}</p>
${(s.items || []).length ? `<ul>${s.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
${s.re ? `<p>${count} picture${count === 1 ? '' : 's'} in ${own.length} state${own.length === 1 ? '' : 's'}: ${own.map(st => `<a href="#${esc(st.state)}">${esc(st.state)}</a>`).join(', ') || 'none'}.</p>` : ''}
</section>`;
  }).join('\n');
  const stateHtml = states.map(st => `<section id="${esc(st.state)}">
<h2>${esc(st.state)} <span class="tag">— ${st.list.length} picture${st.list.length === 1 ? '' : 's'}${st.tags.length ? '; ' + st.tags.map(t => esc(t.title)).join(', ') : ''}</span></h2>
${st.list.map(p => `<h3 id="p${p.n}">${p.n}. ${esc(p.name)} <span class="tag">— ${p.res.count} pixels differ, box ${box(p.res.box)}${p.res.sizes[0] !== p.res.sizes[1] ? `; size ${p.res.sizes[0]} → ${p.res.sizes[1]}` : ''}${p.full ? '' : `; cropped to ${box(p.res.crop)}`}; ${esc(p.subs.join(' · '))}</span></h3>
<div class="pair${p.full ? ' full' : ''}">${fig(`Before (${esc(oldRef)} ${oldSha})`, p.res.before)}${fig(`After (${esc(newRef)} ${newSha})`, p.res.after)}</div>`).join('\n')}
</section>`).join('\n');

  const html = page(title, `<p>${esc(notes.intro || '')}</p>
<p>${pics.length} pictures differ in ${states.length} states between ${esc(oldRef)} (${oldSha}) and ${esc(newRef)} (${newSha}). Grouped by state; in each, the iPad Pop pairs come first and in full; phone and Calm pairs are cropped to the difference box plus ${PAD}px. To keep the page small, the iPad Pop pictures are stored at ${FULL_SCALE * 100}% and the crops at ${CROP_SCALE * 100}% of their size, as WebP (quality ${QUALITY * 100}); boxes are in full-size pixels; the exact pictures are in tests/reference/ at each commit.</p>
${sectionHtml}
<h2>The pictures</h2>
<ol>${states.map(st => `<li><a href="#${esc(st.state)}">${esc(st.state)}</a> (${st.list.length})</li>`).join('')}</ol>
${stateHtml}`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  const mb = Buffer.byteLength(html) / 1e6;
  console.log(`${pics.length} differing picture(s) in ${states.length} states → ${out} (${mb.toFixed(2)} MB; target ${TARGET_MB} MB, cap ${CAP_MB} MB)`);
  if (mb > CAP_MB) { console.error(`FAIL  the page is ${mb.toFixed(2)} MB, above the ${CAP_MB} MB cap`); process.exit(1); }
  if (mb > TARGET_MB) console.log(`note: above the ${TARGET_MB} MB target`);
}

const args = process.argv.slice(2);
if (args[0] === '--git') gitMode(args.slice(1)).catch(e => { console.error(e && e.stack || e); process.exit(1); });
else artifactMode(args);
