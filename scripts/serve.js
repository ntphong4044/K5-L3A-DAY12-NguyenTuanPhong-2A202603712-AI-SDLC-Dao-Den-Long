// Máy chủ tĩnh tối giản (không phụ thuộc) để chơi bản web: npm start -> http://localhost:5173
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 5173;
const ALLOW = ['/web/', '/src/core/', '/node_modules/three/build/', '/game.contract.json'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
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
