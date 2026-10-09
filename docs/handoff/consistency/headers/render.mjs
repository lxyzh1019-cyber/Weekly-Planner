// Renders the 16 header pictures and measures the rendered DOM, using headless Chrome over its debug port.
// Run: node render.mjs            (writes <variant>-<phone|ipad>-<pop|calm>.png and measurements.txt)
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
// page height = header + about 150px of page (standard stacks two panels with a 28px label strip each)
const heights = { standard: { phone: 2 * (56 + 150 + 28), ipad: 2 * (64 + 150 + 28) }, money: { phone: 72 + 150, ipad: 72 + 150 }, meeting: { phone: 106 + 150, ipad: 106 + 150 }, parent: { phone: 56 + 48 + 150, ipad: 64 + 48 + 150 } };
const widths = { phone: 390, ipad: 1024 };

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

const report = [];
for (const v of Object.keys(heights)) for (const size of ['phone', 'ipad']) for (const look of ['pop', 'calm']) {
  const w = widths[size], h = heights[v][size];
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: false });
  await send('Page.navigate', { url: pathToFileURL(join(here, v + '.html')).href + `?look=${look}` });
  for (let i = 0; i < 100; i++) { await sleep(150); if (await evaluate("document.body && document.body.getAttribute('data-done')") === '1') break; }
  await sleep(300);
  const m = await evaluate(`JSON.stringify([...document.querySelectorAll('.ph')].map(function(hd){
    var q=function(s){return [...hd.querySelectorAll(s)].map(function(e){var r=e.getBoundingClientRect();return Math.round(r.width*10)/10+'x'+Math.round(r.height*10)/10;});};
    var t=hd.querySelector('.ph-title'), cs=getComputedStyle(t);
    return {name:hd.getAttribute('data-name'), height:hd.getBoundingClientRect().height, rule:getComputedStyle(hd,'::after').height, position:getComputedStyle(hd).position, bg:getComputedStyle(hd).backgroundColor,
      rows:q('.ph-row'), buttons:q('.ph-btn'), avatar:q('.ph-badge--avatar'), badge:q('.ph-badge:not(.ph-badge--avatar)'), pills:q('.ph-pill'), titleFont:cs.fontFamily.split(',')[0], titleSize:cs.fontSize, fontLoaded:document.fonts.check('20px '+cs.fontFamily.split(',')[0]),
      overflowX: document.documentElement.scrollWidth>innerWidth, contextShown: (function(){var c=hd.querySelector('.ph-context');return !!c && getComputedStyle(c).display!=='none';})()};}))`);
  report.push(`## ${v} ${size} (${w}px) ${look}\n${JSON.stringify(JSON.parse(m), null, 1)}`);
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
  writeFileSync(join(here, `${v}-${size}-${look}.png`), Buffer.from(shot.result.data, 'base64'));
}
writeFileSync(join(here, 'measurements.txt'), report.join('\n\n'));
ws.close(); chrome.kill();
