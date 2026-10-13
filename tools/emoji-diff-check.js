// Emoji-only check: does a CI `pictures` artifact differ from tests/reference/ only inside the emoji boxes the picture test hid?
//
// Run:  node tools/emoji-diff-check.js <artifact folder> [pad px]
//   <artifact folder>  the downloaded CI artifact `pictures`
//                      (gh run download <run-id> -n pictures -D <folder>);
//                      it holds pictures-new/<name>.png and
//                      pictures-new/<name>.emoji.json (the boxes of the emoji
//                      tests/pictures.js hid on that picture).
//   [pad px]           how far outside a box a differing pixel may lie (the
//                      glyph's anti-aliased edge), default 1.
// Every new picture is compared with tests/reference/<name>.png the way the
// test compares (a channel may differ by 2), so it does not depend on the
// run's retries or on the run finishing its compare. Run it BEFORE copying the
// new set into tests/reference/. Prints one line per picture group
// (state-user) and exits 1 when any picture differs outside every emoji box,
// with the box of those pixels.
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
const TOL = 2;  // CHANNEL_TOLERANCE in tests/pictures.js
const newDir = [path.join(dir, 'pictures-new'), path.join(dir, 'tests', 'out', 'pictures-new')].find(p => fs.existsSync(p));
if (!newDir) { console.error('no pictures-new/ in ' + dir); process.exit(1); }
const REF = path.join(__dirname, '..', 'tests', 'reference');
const names = fs.readdirSync(newDir).filter(f => f.endsWith('.png')).map(f => f.replace(/\.png$/, '')).sort();
const groups = new Map();
let bad = 0, differ = 0;
for (const name of names) {
  const group = name.replace(/-(ipad|phone)-(pop|calm)$/, '');
  const g = groups.get(group) || { pictures: 0, differ: 0, px: 0, outside: [] };
  g.pictures++;
  groups.set(group, g);
  const refPath = path.join(REF, name + '.png'), jsonPath = path.join(newDir, name + '.emoji.json');
  if (!fs.existsSync(refPath)) { g.outside.push(`${name}: no reference`); continue; }
  const a = decodePng(fs.readFileSync(refPath)), b = decodePng(fs.readFileSync(path.join(newDir, name + '.png')));
  const boxes = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : [];
  const w = Math.max(a.w, b.w), h = Math.max(a.h, b.h);
  const inBox = new Uint8Array(w * h);
  boxes.forEach(([x, y, bw, bh]) => {
    for (let yy = Math.max(0, y - pad); yy < Math.min(h, y + bh + pad); yy++) {
      for (let xx = Math.max(0, x - pad); xx < Math.min(w, x + bw + pad); xx++) inBox[yy * w + xx] = 1;
    }
  });
  let n = 0, out = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inA = x < a.w && y < a.h, inB = x < b.w && y < b.h;
      let same = inA === inB;
      if (same && inA) {
        const i = (y * a.w + x) * 4, j = (y * b.w + x) * 4;
        for (let k = 0; k < 4 && same; k++) same = Math.abs(a.px[i + k] - b.px[j + k]) <= TOL;
      }
      if (same) continue;
      n++;
      if (inBox[y * w + x]) continue;
      out++;
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
  }
  if (n) { g.differ++; differ++; g.px += n; }
  if (out) g.outside.push(`${name}: ${out} of ${n} differing pixels outside the ${boxes.length} emoji boxes, box x=${x0} y=${y0} w=${x1 - x0 + 1} h=${y1 - y0 + 1}${a.w !== b.w || a.h !== b.h ? ` (size ${a.w}×${a.h} → ${b.w}×${b.h})` : ''}`);
}
for (const [group, g] of groups) {
  if (g.outside.length) { bad++; console.log(`OUTSIDE  ${group}: ${g.differ} of ${g.pictures} picture(s) differ\n  ${g.outside.join('\n  ')}`); }
  else console.log(`${g.differ ? 'emoji only' : 'same      '}  ${group}: ${g.differ} of ${g.pictures} picture(s) differ, ${g.px} pixels, all inside emoji boxes (+${pad}px)`);
}
console.log(`${names.length} pictures, ${differ} differ, in ${groups.size} groups; ${bad} group(s) with a difference outside the emoji`);
process.exit(bad ? 1 : 0);
