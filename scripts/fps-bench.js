// Đo FPS bản web ở 1280x720 bằng Chrome thật (GPU) qua DevTools Protocol, bot tự chơi (?bench=N).
// Dùng: npm start (cửa sổ khác) rồi: node scripts/fps-bench.js [đường-dẫn-chrome] [giây=25]
// Ghi kết quả vào docs/proof/phase-2/fps.md. Cần Node >= 22 (WebSocket có sẵn).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const chrome = process.argv[2] || process.env.CHROME || (process.platform === 'win32'
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const seconds = Number(process.argv[3] || 25);
const port = 9333;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new',
  '--window-size=1280,720', '--ignore-gpu-blocklist', '--enable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } });
  return { send: (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); }), close: () => ws.close() };
}

const rows = [];
try {
  let targets;
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(250); } }
  const page = targets.find((t) => t.type === 'page');
  const c = await cdp(page.webSocketDebuggerUrl);
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  for (const night of [1, 2, 3]) {
    await c.send('Page.navigate', { url: `http://localhost:5173/?bench=${night}&seed=7` });
    await sleep(seconds * 1000 + 3000);
    const r = await c.send('Runtime.evaluate', { expression: 'JSON.stringify({fps: window.__fps, gl: (()=>{const g=document.querySelector("canvas").getContext("webgl2");const e=g.getExtension("WEBGL_debug_renderer_info");return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):"?"})(), size: [innerWidth, innerHeight]})', returnByValue: true });
    const v = JSON.parse(r.result.value);
    rows.push({ night, ...v });
    console.log(`Đêm ${night}: TB ${v.fps.avg.toFixed(1)} FPS trên ${v.fps.n} giây · ${v.size.join('x')} · ${v.gl}`);
  }
  c.close();
} finally { proc.kill(); }

const md = ['# Đo FPS bản web (tự sinh bởi `node scripts/fps-bench.js`)', '',
  `- Máy: ${os.cpus()[0]?.model?.trim()} · ${os.platform()} ${os.release()} · Chrome headless, cửa sổ 1280×720, bot tự chơi (\`?bench=N&seed=7\`)`,
  `- Ngưỡng Ticket-02: trung bình >= 30 FPS`, '', '| Đêm | FPS trung bình | Số giây đo | Kích thước | GPU (WebGL renderer) | Đạt |', '|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.night} | ${r.fps.avg.toFixed(1)} | ${r.fps.n} | ${r.size.join('×')} | ${r.gl} | ${r.fps.avg >= 30 ? '✅' : '❌'} |`), ''];
fs.mkdirSync('docs/proof/phase-2', { recursive: true });
fs.writeFileSync('docs/proof/phase-2/fps.md', md.join('\n'));
