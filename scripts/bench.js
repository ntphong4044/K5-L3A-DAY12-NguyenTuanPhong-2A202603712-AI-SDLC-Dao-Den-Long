// Đo hiệu năng cảnh chuẩn trên renderer thật của Chromium, rồi ghi bench.json theo Ticket-04 mục 1.
// Đây là bench_cmd: node scripts/bench.js --seed 42 --duration 30 --out bench.json  (--seconds = tên cũ của --duration)
// load_ms tính từ lúc TIẾN TRÌNH này bắt đầu tới khung hình đầu tiên của cảnh bench (Ticket-04 mục 1).
//   - Tự khởi động máy chủ tĩnh (scripts/serve.js) ở cổng trống, rồi mở /web/bench.html.
//   - Cửa sổ ép 1280×720 bằng `Emulation.setDeviceMetricsOverride` + `--window-size`.
//   - Tắt vsync: cờ `--disable-gpu-vsync --disable-frame-rate-limit`; ghi `vsync_off` thực tế vào kết quả.
//   - Không dùng chế độ headless của Chrome để tránh giả lập khung hình; máy không có màn hình (Linux CI)
//     chạy dưới `xvfb-run`. Tự dò Chrome/Chromium/Edge.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const PROCESS_START_EPOCH_MS = Date.now() - process.uptime() * 1000;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const seconds = Number(arg('duration', arg('seconds', 30)));
const seed = Number(arg('seed', 42));
const out = arg('out', path.join(ROOT, 'bench.json'));

const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
const browser = CANDIDATES.find((p) => fs.existsSync(p));
if (!browser) { console.error('Không tìm thấy Chrome/Chromium. Đặt biến CHROME=<đường dẫn>. '); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}
async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  let id = 0; const pending = new Map(); const errors = [];
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  return {
    send: (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); }),
    close: () => ws.close(),
    errors,
  };
}

const port = await freePort();
const debugPort = await freePort();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));
const children = [];
let profileSaved = false;
const cleanup = () => {
  for (const c of children) { try { c.kill(); } catch { /* đã thoát */ } }
  if (profileSaved) return;   // `--keep-profile`: giữ hồ sơ để chơi/gán bảng xếp hạng như người chơi thật
  // Windows: Chrome nhả thư mục hồ sơ trễ vài trăm ms sau khi bị kill; xoá hỏng thì bỏ qua.
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch { /* để hệ điều hành dọn */ }
};

children.push(spawn(process.execPath, [path.join(ROOT, 'scripts', 'serve.js')], { cwd: ROOT, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' }));
const serverUp = async () => {
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${port}/web/bench.html`); return true; } catch { await sleep(100); } }
  return false;
};
if (!(await serverUp())) { console.error('Máy chủ tĩnh không lên được'); process.exit(2); }

const flags = [
  `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--window-size=1280,720', '--window-position=0,0', '--force-device-scale-factor=1',
  '--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-background-timer-throttling',
  '--ignore-gpu-blocklist', '--enable-gpu-rasterization', 'about:blank',
  // Cửa sổ bị che/mất focus vẫn phải vẽ đủ khung: tránh hạ ưu tiên renderer và occlusion của Windows.
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--disable-features=CalculateNativeWinOcclusion',
];
const chrome = spawn(browser, flags, { stdio: 'ignore' });
children.push(chrome);

let targets = null;
for (let i = 0; i < 80 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json(); } catch { await sleep(250); } }
if (!targets) { console.error('Không kết nối được DevTools'); process.exit(2); }
const page = targets.find((t) => t.type === 'page') ?? targets[0];
const c = await cdp(page.webSocketDebuggerUrl);
await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await c.send('Runtime.enable');
const url = `http://127.0.0.1:${port}/web/bench.html?seed=${seed}&duration=${seconds}&vsync=off`;
await c.send('Page.navigate', { url });

// Hỏi trạng thái qua CDP. Lệnh evaluate có thể bị treo khi renderer đang bận (GPU/GC): mỗi lần chờ tối đa
// EVAL_TIMEOUT_MS rồi bỏ qua, lần sau hỏi lại; tổng thời gian chờ tối đa = warmup + duration + 60 s.
const EVAL_TIMEOUT_MS = 3000;
const withTimeout = (p, ms) => Promise.race([p, sleep(ms).then(() => null)]);
let result = null;
const deadline = Date.now() + (3 + seconds + 60) * 1000;
for (let i = 0; Date.now() < deadline && !result; i++) {
  await sleep(250);
  const r = await withTimeout(c.send('Runtime.evaluate', { expression: 'JSON.stringify(window.__bench || null)', returnByValue: true }), EVAL_TIMEOUT_MS);
  const v = r?.result?.result?.value;
  if (!v) continue;
  const doc = JSON.parse(v);
  if (doc.done) { result = doc; break; }
  if (i % 8 === 0 && doc.load_ms) process.stdout.write(`  cảnh đã tải (load ${doc.load_ms} ms), đang đo…\n`);
}
if (!result) {
  c.close();
  console.error('Hết thời gian chờ kết quả đo');
  if (c.errors.length) console.error('lỗi trong trang bench:\n' + c.errors.join('\n'));
  process.exit(1);
}

c.close();

const doc = {
  contract_version: '1.3',
  avg_fps: result.avg_fps,
  p1_low_fps: result.p1_low_fps,
  frame_ms_p95: result.frame_ms_p95,
  frames: result.frames,
  load_ms: result.first_frame_epoch_ms ? Math.round((result.first_frame_epoch_ms - PROCESS_START_EPOCH_MS) * 10) / 10 : result.load_ms,
  peak_mem_mb: null,
  peak_mem_note: 'Bản web chạy trong Chrome: không đo được RSS của tiến trình game từ trang; js_heap_peak_mb là JS heap của trang (tham khảo).',
  js_heap_peak_mb: result.js_heap_peak_mb ?? null,
  vsync_off: result.vsync_off,
  renderer: result.renderer,
  os: `${os.platform()} ${os.release()} ${os.arch()} · ${os.cpus()[0]?.model?.trim() ?? ''} · ${Math.round(os.totalmem() / 1073741824)} GB RAM`,
  cpu: os.cpus()[0]?.model?.trim() ?? '',
  seed, duration_s: seconds, window: result.size, shades: result.shades, motes: result.motes,
};
fs.writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
console.log(`avg ${doc.avg_fps} FPS · p1 ${doc.p1_low_fps} · p95 ${doc.frame_ms_p95} ms · ${doc.frames} khung · load ${doc.load_ms} ms`);
console.log(`-> ${out}`);
if (argv.includes('--keep-profile')) {
  // Dùng cho kiểm chứng bảng xếp hạng: mở lại đúng hồ sơ này để chơi tiếp như người chơi thật.
  profileSaved = true;
  fs.writeFileSync(path.join(os.tmpdir(), 'ddl-last-profile.txt'), profile);
  console.log(`hồ sơ giữ lại: ${profile}`);
}
const pass = doc.avg_fps >= 60 && doc.p1_low_fps >= 30 && doc.load_ms <= 10000;
console.log(pass ? 'ĐẠT ngưỡng tham khảo (60 / 30 / 10000 ms)' : 'CHƯA ĐẠT ngưỡng tham khảo trên máy này');
// Ticket-04: đo xong thì tự thoát mã 0 (kết quả đạt/không do người chấm đọc từ bench.json)
process.exit(0);
