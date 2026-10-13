// Emoji-only check: for every picture a CI `pictures` artifact lists as different, are all its differing pixels inside the emoji boxes the picture test hid?
//
// Run:  node tools/emoji-diff-check.js <artifact folder> [pad px]
//   <artifact folder>  the downloaded CI artifact `pictures`
//                      (gh run download <run-id> -n pictures -D <folder>);
//                      it holds pictures-diff/<name>.png (differing pixels pure
//                      red) and pictures-diff/<name>.emoji.json (the emoji
//                      boxes tests/pictures.js hid on that picture).
//   [pad px]           how far outside a box a differing pixel may lie (the
//                      glyph's anti-aliased edge), default 1.
// Prints one line per picture group (state-user) and exits 1 when any picture
// has a differing pixel outside every emoji box, with that pixel area's box.
// Use it before refreshing references after a change to the emoji hiding.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// An 8-bit RGB or RGBA, non-interlaced PNG (what a canvas writes) to RGBA rows.
function decodePng(buf) {
  let p = 8, w = 0, h = 0, type = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), kind = buf.toString('latin1', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4); type = data[9];
      if (data[8] !== 8 || (type !== 6 && type !== 2) || data[12] !== 0) throw new Error('unsupported PNG (want 8-bit RGB/RGBA, not interlaced)');
    } else if (kind === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * 4), prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      out[o] = cur[x * bpp]; out[o + 1] = cur[x * bpp + 1]; out[o + 2] = cur[x * bpp + 2]; out[o + 3] = bpp === 4 ? cur[x * bpp + 3] : 255;
    }
    cur.copy(prev);
  }
  return { w, h, px: out };
}

const [dir, padArg] = process.argv.slice(2);
if (!dir) { console.error('usage: node tools/emoji-diff-check.js <artifact folder> [pad px]'); process.exit(2); }
const pad = padArg === undefined ? 1 : Number(padArg);
const diffDir = [path.join(dir, 'pictures-diff'), path.join(dir, 'tests', 'out', 'pictures-diff')].find(p => fs.existsSync(p));
if (!diffDir) { console.error('no pictures-diff/ in ' + dir); process.exit(1); }
const names = fs.readdirSync(diffDir).filter(f => f.endsWith('.png')).map(f => f.replace(/\.png$/, '')).sort();
const groups = new Map();
let bad = 0;
for (const name of names) {
  const jsonPath = path.join(diffDir, name + '.emoji.json');
  const boxes = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : null;
  const { w, h, px } = decodePng(fs.readFileSync(path.join(diffDir, name + '.png')));
  const inBox = new Uint8Array(w * h);
  (boxes || []).forEach(([x, y, bw, bh]) => {
    for (let yy = Math.max(0, y - pad); yy < Math.min(h, y + bh + pad); yy++) {
      for (let xx = Math.max(0, x - pad); xx < Math.min(w, x + bw + pad); xx++) inBox[yy * w + xx] = 1;
    }
  });
  let red = 0, out = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < w * h; i++) {
    if (px[i * 4] !== 255 || px[i * 4 + 1] !== 0 || px[i * 4 + 2] !== 0) continue;
    red++;
    if (inBox[i]) continue;
    out++;
    const x = i % w, y = (i - x) / w;
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  const group = name.replace(/-(ipad|phone)-(pop|calm)$/, '');
  const g = groups.get(group) || { pictures: 0, red: 0, outside: [] };
  g.pictures++; g.red += red;
  if (!boxes) g.outside.push(`${name}: no ${name}.emoji.json`);
  else if (out) g.outside.push(`${name}: ${out} of ${red} differing pixels outside the ${boxes.length} emoji boxes, box x=${x0} y=${y0} w=${x1 - x0 + 1} h=${y1 - y0 + 1}`);
  groups.set(group, g);
}
for (const [group, g] of groups) {
  if (g.outside.length) { bad++; console.log(`OUTSIDE  ${group}: ${g.pictures} picture(s)\n  ${g.outside.join('\n  ')}`); }
  else console.log(`emoji only  ${group}: ${g.pictures} picture(s), ${g.red} differing pixels, all inside emoji boxes (+${pad}px)`);
}
console.log(`${names.length} differing pictures in ${groups.size} groups; ${bad} group(s) with a difference outside the emoji`);
process.exit(bad ? 1 : 0);
