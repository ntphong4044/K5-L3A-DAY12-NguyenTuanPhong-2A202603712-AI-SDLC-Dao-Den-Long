// Chụp ảnh bằng chứng của bản web thật (Chrome + GPU qua DevTools, 1280×720) và chạy các bước UI của Phase 4:
// menu, cài đặt (gán phím trùng -> báo lỗi, chữ lớn ×1.25, giảm chuyển động), phụ đề/chỉ báo hình ảnh,
// nhập tên (báo lỗi), bảng xếp hạng (màn hình + trang riêng). Ghi img/ui-report.json.
// Dùng: node scripts/shots.js --out docs/proof/phase-4/img
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const outDir = path.resolve(ROOT, arg('out', 'docs/proof/phase-4/img'));
fs.mkdirSync(outDir, { recursive: true });

const CANDIDATES = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browser = CANDIDATES.find((p) => fs.existsSync(p));
if (!browser) { console.error('Không tìm thấy Chrome'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
async function cdp(url) {
  const ws = new WebSocket(url);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  let id = 0; const pending = new Map();
  const logs = [];
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); }
    if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.args.map((a) => a.value ?? a.description).join(' '));
  });

  const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  const js = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails));
    return r.result?.value;
  };
  return { send, js, logs, close: () => ws.close() };
}

const port = await freePort(), debugPort = await freePort();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-shots-'));
const procs = [];
const cleanup = () => {
  for (const p of procs) { try { p.kill(); } catch { /* đã thoát */ } }
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch { /* Windows giữ hồ sơ thêm vài trăm ms */ }
};
process.on('exit', cleanup);

procs.push(spawn(process.execPath, [path.join(ROOT, 'scripts/serve.js')], { cwd: ROOT, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' }));
for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${port}/web/index.html`); break; } catch { await sleep(100); } }
procs.push(spawn(browser, [`--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--no-first-run', '--window-size=1280,720',
  '--force-device-scale-factor=1', '--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--disable-features=CalculateNativeWinOcclusion', 'about:blank'], { stdio: 'ignore' }));

let targets;
for (let i = 0; i < 80 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json(); } catch { await sleep(250); } }
const c = await cdp((targets.find((t) => t.type === 'page') ?? targets[0]).webSocketDebuggerUrl);
await c.send('Runtime.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

let n = 0;
const shot = async (name) => {
  const r = await c.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, name), Buffer.from(r.data, 'base64'));
  console.log(`ảnh ${++n}: ${name}`);
};
const open = async (url, ms = 2500) => { await c.send('Page.navigate', { url }); await sleep(ms); };
const base = `http://127.0.0.1:${port}`;
const report = {};

// 1) Menu chính: có Bảng xếp hạng + Cài đặt, chữ 18 px.
await open(`${base}/`, 2000);
await shot('menu.png');
report.menuFontSize = await c.js("getComputedStyle(document.body).fontSize");

// 2) Cài đặt: gán phím trùng -> báo lỗi (vẫn chờ phím); sau đó chữ lớn + giảm chuyển động -> lưu.
await c.js("document.getElementById('b-set').click()");
await sleep(300);
await c.js("document.querySelector('button[data-act=\"jump\"]').click()");
await c.js("dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true }))");
await sleep(200);
report.conflict = await c.js("document.getElementById('s-err').textContent");
report.stillListening = await c.js("document.querySelector('button[data-act=\"jump\"]').textContent");
await shot('settings-conflict.png');
await c.js("document.getElementById('s-font').click(); document.getElementById('s-motion').click()");
await sleep(200);
report.largeFontCss = await c.js("getComputedStyle(document.body).getPropertyValue('--fs').trim()");
report.saved = await c.js("JSON.parse(localStorage.getItem('ddl-settings'))");
await shot('settings-large.png');

// 3) Vào Đêm 1 bằng bot, thắp sẵn 3 đèn dầu 20: phụ đề (Bóng Mực, đèn yếu), sự kiện spawn -> mũi tên mép.
await open(`${base}/?demo=1&seed=7&lit=3&fuel=20`, 6000);
await shot('night1-subs.png');
report.subs = await c.js("[...document.querySelectorAll('#subs div')].map((d) => d.textContent)");
report.edgeArrows = await c.js("[...document.querySelectorAll('.edgearrow')].filter((e) => !e.classList.contains('hidden')).length");
report.timerFont = await c.js("getComputedStyle(document.getElementById('timer')).fontSize");

// 4) Màn kết quả -> Lưu điểm -> nhập tên sai -> nhập tên đúng -> bảng xếp hạng trên màn hình.
await c.js("localStorage.setItem('ddl-leaderboard', JSON.stringify({ entries: [] })); window.__ddl.demoResult([1500, 0, 0], true)");
await sleep(300);
await c.js("document.getElementById('r-save').click()");
await sleep(300);
await shot('name-prompt.png');
await c.js("document.getElementById('n-name').value = 'ab'; document.getElementById('n-save').click()");
await sleep(200);
report.nameErr = await c.js("document.getElementById('n-err').textContent");
await shot('name-invalid.png');
await c.js("document.getElementById('n-name').value = 'Mây_K5'; document.getElementById('n-save').click()");
await sleep(400);
report.board = await c.js("JSON.stringify(window.__game && window.__ddl.phase() ? (() => { try { return JSON.parse(localStorage.getItem('ddl-leaderboard')).entries; } catch { return null; } })() : null)");
await shot('leaderboard.png');

// 5) Trang bảng xếp hạng riêng (đọc cùng localStorage).
await open(`${base}/web/leaderboard.html`, 1500);
report.leaderboardPage = await c.js("JSON.stringify(window.__entries())");
await shot('leaderboard-page.png');

fs.writeFileSync(path.join(outDir, 'ui-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
c.close();
process.exit(0);
