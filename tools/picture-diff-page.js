// Picture differences page: for every picture the CI `pictures` artifact lists as different, the old reference and the new picture side by side, numbered, in one self-contained HTML file.
//
// Run:  node tools/picture-diff-page.js <artifact folder> <out.html> [title]
//   <artifact folder>  the downloaded CI artifact `pictures`
//                      (gh run download <run-id> -n pictures -D <folder>);
//                      it holds pictures-new/ and pictures-diff/.
//   The OLD picture is read from tests/reference/ — run this BEFORE copying
//   the new pictures into tests/reference/.
// Pictures are embedded (base64), so the page still shows the old picture
// after the references are replaced.
'use strict';
const fs = require('fs');
const path = require('path');

const [dir, out, title = 'Picture differences'] = process.argv.slice(2);
if (!dir || !out) { console.error('usage: node tools/picture-diff-page.js <artifact folder> <out.html> [title]'); process.exit(2); }
const find = (name) => [path.join(dir, name), path.join(dir, 'tests', 'out', name)].find(p => fs.existsSync(p));
const diffDir = find('pictures-diff'), newDir = find('pictures-new');
if (!newDir) { console.error('no pictures-new/ in ' + dir); process.exit(1); }
const REF = path.join(__dirname, '..', 'tests', 'reference');
const names = diffDir ? fs.readdirSync(diffDir).filter(f => f.endsWith('.png')).sort() : [];
const img = (p) => p && fs.existsSync(p) ? `data:image/png;base64,${fs.readFileSync(p).toString('base64')}` : '';
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const rows = names.map((n, i) => {
  const before = img(path.join(REF, n)), after = img(path.join(newDir, n)), diff = img(path.join(diffDir, n));
  return `<section id="d${i + 1}">
  <h2>${i + 1}. ${esc(n.replace(/\.png$/, ''))}</h2>
  <div class="pair">
    <figure><figcaption>Before (tests/reference)</figcaption>${before ? `<img src="${before}" alt="before">` : '<p>no reference</p>'}</figure>
    <figure><figcaption>After (this branch, CI)</figcaption>${after ? `<img src="${after}" alt="after">` : '<p>no picture</p>'}</figure>
  </div>
  ${diff ? `<details><summary>Changed pixels</summary><img src="${diff}" alt="changed pixels"></details>` : ''}
</section>`;
}).join('\n');

fs.writeFileSync(out, `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { --bg: #fff; --ink: #1d1d1f; --sub: #666; --line: #ddd; }
  @media (prefers-color-scheme: dark) { :root { --bg: #161616; --ink: #eee; --sub: #aaa; --line: #333; } }
  body { margin: 0; padding: 16px; background: var(--bg); color: var(--ink); font: 15px/1.4 system-ui, sans-serif; }
  h1 { font-size: 22px; } h2 { font-size: 17px; margin: 28px 0 8px; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 700px) { .pair { grid-template-columns: 1fr; } }
  figure { margin: 0; } figcaption { color: var(--sub); margin-bottom: 4px; }
  img { width: 100%; height: auto; border: 1px solid var(--line); }
  ol a { color: inherit; }
</style></head><body>
<h1>${esc(title)}</h1>
<p>${names.length} picture${names.length === 1 ? '' : 's'} changed. Each pair: the old reference on the left, the new picture on the right.</p>
<ol>${names.map((n, i) => `<li><a href="#d${i + 1}">${esc(n.replace(/\.png$/, ''))}</a></li>`).join('')}</ol>
${rows}
</body></html>
`);
console.log(`${names.length} differing picture(s) → ${out}`);
