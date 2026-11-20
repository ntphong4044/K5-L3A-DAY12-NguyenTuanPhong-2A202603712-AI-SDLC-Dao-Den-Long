// Máy chủ tĩnh tối giản (không phụ thuộc) để chơi bản web: npm start -> http://localhost:5173
//   npm start -- --export-leaderboard [out.json]   xuất bảng xếp hạng cục bộ (Ticket-04 mục 3) rồi thoát
//   npm start -- --export-leaderboard out.json --profile <hồ sơ Chromium>   đọc từ một hồ sơ cụ thể
// Mọi tham số khác được chuyển cho src/leaderboard.js; không có tham số thì chạy máy chủ như cũ.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARGS = process.argv.slice(2);

if (ARGS.includes('--export-leaderboard')) {
  const { exportLeaderboard } = await import('../src/leaderboard.js');
  const i = ARGS.indexOf('--export-leaderboard');
  const { doc, file, path: out } = exportLeaderboard(ARGS.slice(i + 1), { root: ROOT, log: (m) => process.stderr.write(m + '\n') });
  process.stdout.write(JSON.stringify(doc, null, 2) + '\n');
  if (file) process.stderr.write(`nguồn: ${file}\n`);
  process.stderr.write(`đã ghi: ${path.resolve(out)}\n`);
  process.exit(0);
}

const PORT = Number(process.env.PORT) || 5173;
const ALLOW = ['/web/', '/src/core/', '/node_modules/three/build/', '/game.contract.json'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css' };

// Bảng xếp hạng lưu trên ĐĨA (.ddl/leaderboard.json): bản web gửi mục mới qua API này, nên
// `<run_cmd> --export-leaderboard out.json` đọc đúng dữ liệu người chơi đã lưu (Ticket-04 mục 3).
const { loadEntries, appendEntry, DEFAULT_FILE } = await import('../src/leaderboard-store.js');
const { normalizeName } = await import('../src/core/leaderboard.js');
function api(req, res, url) {
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
  if (url === '/api/leaderboard' && req.method === 'GET') return send(200, { entries: loadEntries(ROOT).all });
  if (url === '/api/leaderboard/reset' && req.method === 'POST') {
    try { fs.rmSync(path.join(ROOT, DEFAULT_FILE), { force: true }); } catch {}
    return send(200, { entries: [] });
  }
  if (url === '/api/leaderboard' && req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try {
        const e = JSON.parse(body);
        const n = normalizeName(e.name);
        if (!n.ok) return send(400, { error: 'tên không hợp lệ' });
        const r = appendEntry(ROOT, { name: n.name, score: e.score, nights_won: e.nights_won, achieved_at: e.achieved_at, seed: e.seed });
        return send(200, { entries: r.entries });
      } catch (err) { return send(400, { error: String(err.message || err) }); }
    });
    return true;
  }
  return false;
}

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url.startsWith('/api/')) { if (api(req, res, url) === false) res.writeHead(404).end('not found'); return; }
  if (url === '/') url = '/web/index.html';
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT) || !ALLOW.some((p) => url.startsWith(p))) { res.writeHead(404).end('not found'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Đảo Đèn Lồng đang chạy: http://localhost:${PORT}  (Ctrl+C để dừng)`);
});

export { server };
