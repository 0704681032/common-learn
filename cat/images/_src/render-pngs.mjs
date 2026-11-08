import { spawn } from 'node:child_process';
import { writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const IMAGES = join(HERE, '..');
const PAGE = 'file:///' + join(IMAGES, 'charts.html').replaceAll('\\', '/');
const PORT = 9333;
const SCALE = 2;

const chromeCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const chrome = chromeCandidates.find(existsSync);
if (!chrome) throw new Error('Chrome/Edge not found');

const profile = join(HERE, '.cdp-profile');
rmSync(profile, { recursive: true, force: true });
const child = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitForEndpoint() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome DevTools endpoint never came up');
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        (this.listeners.get(msg.method) || []).forEach(fn => fn(msg.params));
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  once(method) {
    return new Promise(resolve => {
      const fn = params => {
        this.listeners.set(method, (this.listeners.get(method) || []).filter(f => f !== fn));
        resolve(params);
      };
      this.listeners.set(method, [...(this.listeners.get(method) || []), fn]);
    });
  }
}

try {
  await waitForEndpoint();
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 900, deviceScaleFactor: 1, mobile: false });
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url: PAGE });
  await loaded;
  await sleep(300);

  const { result } = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `Array.from(document.querySelectorAll('section.fig')).map(s => {
      const r = s.getBoundingClientRect();
      return { id: s.id, x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
    })`,
  });
  const rects = result.value;
  if (!rects?.length) throw new Error('no figures found in charts.html');

  for (const r of rects) {
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: r.x, y: r.y, width: r.width, height: r.height, scale: SCALE },
    });
    writeFileSync(join(IMAGES, r.id + '.png'), Buffer.from(shot.data, 'base64'));
    console.log(`${r.id}.png ${Math.round(r.width * SCALE)}x${Math.round(r.height * SCALE)}`);
  }
  ws.close();
} finally {
  child.kill();
  await new Promise(resolve => {
    child.once('exit', resolve);
    setTimeout(resolve, 3000);
  });
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch {
    console.warn('warn: left .cdp-profile behind, remove manually');
  }
}