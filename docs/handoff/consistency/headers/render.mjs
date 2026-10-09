// Renders the 16 header pictures from the owner's Claude Design page (source/header-system.dc.html) with headless Chrome
// over its debug port, and measures each header in the rendered page.
// Run: node render.mjs   (needs internet for the page's Google Fonts; writes <variant>-<phone|ipad>-<pop|calm>.png and measurements.txt)
// How the page is built: it shows everything on one canvas. Look = the section: id "2a" is Pop, "2b" is Calm (turn 2, the newest set;
// "1a"/"1b" below them are the older turn 1). Inside a look, section children 1..4 are standard, money, meeting, parent; in each, the
// first column (1198 wide) is the iPad Pro 11in landscape set and the second column (394 wide) is the phone set (390 wide).
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const looks = { pop: '2a', calm: '2b' };
const variants = ['standard', 'money', 'meeting', 'parent']; // section children 1..4
const sizes = ['ipad', 'phone']; // columns 0 and 1

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'hdr-'))}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (targets.length) break; } catch (e) { /* not up yet */ } await sleep(200); }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const waiting = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const n = ++id; waiting.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.result.value;

await send('Emulation.setDeviceMetricsOverride', { width: 2600, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: pathToFileURL(join(here, 'source', 'header-system.dc.html')).href });
await sleep(6000);

// One panel = a bordered, rounded box (overflow hidden). Its header = the rows with a solid background (white or purple); the
// transparent last row is the cream filler page under it. Each row is reported as content height + bottom rule.
const measure = `(function(look,vi,ci){
  var col=document.getElementById(look).children[vi].children[1].children[ci], out=[];
  var boxes=[];
  [].forEach.call(col.children,function(p){ if(p.children.length&&getComputedStyle(p).overflow==='hidden')boxes.push([p,'(no label)']); else [].forEach.call(p.children,function(b){ if(getComputedStyle(b).overflow==='hidden'&&b.children.length)boxes.push([b,p.children[0]!==b?p.children[0].textContent.trim():'(no label)']); }); });
  boxes.forEach(function(x){
    var box=x[0], rows=[], total=0;
    [].forEach.call(box.children,function(r){var c=getComputedStyle(r); if(c.backgroundColor==='rgba(0, 0, 0, 0)')return; var h=Math.round(r.getBoundingClientRect().height*10)/10, rule=parseFloat(c.borderBottomWidth); total+=h; rows.push((h-(h>rule?rule:0))+'+'+rule);});
    out.push({label:x[1],panelWidth:Math.round(box.getBoundingClientRect().width),rows:rows,headerHeight:Math.round(total*10)/10});
  });
  var r=col.getBoundingClientRect();
  return JSON.stringify({rect:{x:r.x,y:r.y+scrollY,w:r.width,h:r.height},panels:out});
})`;

const report = [];
for (const [look, lid] of Object.entries(looks)) for (let vi = 0; vi < variants.length; vi++) for (let ci = 0; ci < sizes.length; ci++) {
  const name = `${variants[vi]}-${sizes[ci]}-${look}`;
  const m = JSON.parse(await evaluate(`${measure}('${lid}',${vi + 1},${ci})`));
  const pad = 6;
  const clip = { x: Math.floor(m.rect.x - pad), y: Math.floor(m.rect.y - pad), width: Math.ceil(m.rect.w + 2 * pad), height: Math.ceil(m.rect.h + 2 * pad), scale: 2 };
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
  writeFileSync(join(here, `${name}.png`), Buffer.from(shot.result.data, 'base64'));
  report.push(`## ${name}  (picture ${clip.width}x${clip.height} css px, saved at 2x)\n` + m.panels.map((p) => `- ${p.label.slice(0, 90)}\n    panel width ${p.panelWidth}px; header height ${p.headerHeight}px; rows (content+rule) ${p.rows.join(' , ')}`).join('\n'));
}
writeFileSync(join(here, 'measurements.txt'), `Header heights measured in headless Chrome from the owner's design (source/header-system.dc.html), css px.\nHeader height = all bar rows (content + bottom rule, as drawn at 1x); the cream area under the bar is filler page, not counted.\n\n` + report.join('\n\n') + '\n');
ws.close(); chrome.kill();
