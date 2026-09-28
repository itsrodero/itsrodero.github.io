// Generates 1200x630 JPEG cover images for every guide (used for social sharing,
// Google Discover and the guide cards). Requires Google Chrome and Node 22+.
//
//   node _tools/covers.mjs          # only creates missing covers
//   node _tools/covers.mjs --all    # regenerates every cover
//
// It reads _tools/covers.json, which build.py writes on every build.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const jobs = JSON.parse(readFileSync(join(here, 'covers.json'), 'utf8'));
const all = process.argv.includes('--all');
const todo = jobs.filter((j) => all || !existsSync(join(root, j.out)));
if (!todo.length) { console.log('All covers exist.'); process.exit(0); }

const chromePaths = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);
const chrome = chromePaths.find((p) => existsSync(p));
if (!chrome) { console.error('Chrome not found. Set CHROME_PATH.'); process.exit(1); }

const port = 9333;
const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`,
  '--window-size=1200,630', '--user-data-dir=' + join(root, '_tools', '.chrome-profile'), 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch { await sleep(200); }
}
if (!target) { console.error('Could not connect to Chrome.'); proc.kill(); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const waiters = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
  if (msg.method) waiters.filter((w) => w.m === msg.method).forEach((w) => { w.r(); waiters.splice(waiters.indexOf(w), 1); });
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const once = (m) => new Promise((r) => waiters.push({ m, r }));

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
const tpl = pathToFileURL(join(here, 'cover.html')).href;
for (const j of todo) {
  const hash = new URLSearchParams({ t: j.title, l: j.label, c: j.category }).toString();
  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url: `${tpl}?v=${Date.now()}#${hash}` });
  await loaded; await sleep(150);
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } });
  const out = join(root, j.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('wrote', j.out);
}
ws.close(); proc.kill();
