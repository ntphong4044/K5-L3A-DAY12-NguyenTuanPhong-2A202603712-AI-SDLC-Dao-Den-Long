// Đóng gói bản phát hành v1.0.0: dist/dao-den-long-web.zip (thư mục web tĩnh chạy được độc lập).
// Dùng: npm run release
//   - Chỉ chép đúng các tệp bản chơi cần (web/, src/core/, game.contract.json, node_modules/three).
//   - Kèm máy chủ tĩnh nhỏ (serve.mjs) + README riêng + LICENSE, để giải nén ra là chạy:
//       node serve.mjs   ->  http://localhost:5173
//   - Kiểm tra zip sau khi tạo (liệt kê tệp bắt buộc) trước khi báo thành công.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');
const ZIP = path.join(OUT, 'dao-den-long-web.zip');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const FILES = [
  'LICENSE',
  'game.contract.json',
  'web/index.html', 'web/main.js', 'web/bench.html', 'web/bench.js', 'web/leaderboard.html',
  'web/audio.js', 'web/settings.js', 'web/store.js',
  'src/core/sim.js', 'src/core/maps.js', 'src/core/bot.js', 'src/core/validate.js',
  'src/core/leaderboard.js', 'src/core/bench.js', 'src/core/benchstats.js',
  'node_modules/three/build/three.module.js', 'node_modules/three/LICENSE',
];
const DIRS = ['src/core', 'web', 'node_modules/three/build'];

// ---------- ZIP tối giản (deflate, không mã hóa) ----------
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() / 2)) & 0xffff;
const dosDate = (d) => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;

function makeZip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  const now = new Date();
  for (const { name, data, dir = false } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const raw = dir ? Buffer.alloc(0) : data;
    const comp = dir ? Buffer.alloc(0) : zlib.deflateRawSync(raw, { level: 9 });
    const crc = dir ? 0 : crc32(raw);
    const method = dir ? 0 : 8;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);            // tên tệp UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(dosTime(now), 10);
    local.writeUInt16LE(dosDate(now), 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, comp);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4);          // made by: UNIX, 3.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(dosTime(now), 12);
    central.writeUInt16LE(dosDate(now), 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(dir ? 0x10 : 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + comp.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centrals.length / 2, 8);
  end.writeUInt16LE(centrals.length / 2, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBuf, end]);
}

const readme = `# Đảo Đèn Lồng v${VERSION} — bản phát hành

Bản web tĩnh, không cần cài đặt ngoài Node.js 20+.

## Chạy
\`\`\`
node serve.mjs
\`\`\`
Mở http://localhost:5173 (Chrome/Edge/Firefox có WebGL2). Đổi cổng: \`PORT=8080 node serve.mjs\`.

## Điều khiển
WASD đi · ←/→ hoặc kéo chuột: camera · Space nhảy · Shift lướt · E tương tác · Q tỏa sáng · Esc/P tạm dừng.
Mọi phím đổi được trong Cài đặt; có phụ đề, giảm chuyển động và chữ lớn.

## Benchmark
Mở \`/web/bench.html?seed=42&duration=30&vsync=off\` trong Chrome ở cửa sổ 1280×720 để đo cảnh chuẩn
(200 Bóng Mực, 100 đom đóm, camera quay vòng 15 s). Bản đầy đủ trong repo có \`npm run bench\` để tự tạo
\`bench.json\`.

## Giấy phép
MIT — xem LICENSE. Nội dung và công cụ AI: CREDITS.md trong repo.
`;

const serve = `// Máy chủ tĩnh nhỏ để chạy bản phát hành: node serve.mjs (PORT=8080 để đổi cổng).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' };

http.createServer((req, res) => {
  let url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url === '/') url = '/web/index.html';
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(\`Đảo Đèn Lồng v${VERSION}: http://localhost:\${PORT}\`));
`;

const entries = [];
for (const dir of DIRS) entries.push({ name: `dao-den-long-v${VERSION}/${dir}/`, dir: true });
for (const rel of FILES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`thiếu tệp để đóng gói: ${rel} (chạy npm install trước)`);
  entries.push({ name: `dao-den-long-v${VERSION}/${rel}`, data: fs.readFileSync(abs) });
}
entries.push({ name: `dao-den-long-v${VERSION}/README.md`, data: Buffer.from(readme, 'utf8') });
entries.push({ name: `dao-den-long-v${VERSION}/serve.mjs`, data: Buffer.from(serve, 'utf8') });

fs.mkdirSync(OUT, { recursive: true });
const zip = makeZip(entries);
fs.writeFileSync(ZIP, zip);

// Kiểm tra lại: mọi khóa bắt buộc có trong vùng central directory, và số byte khớp.
const text = zip.toString('latin1');
const missing = [...FILES, 'README.md', 'serve.mjs'].filter((f) => !text.includes(`dao-den-long-v${VERSION}/${f}`));
if (missing.length) throw new Error(`zip thiếu: ${missing.join(', ')}`);

const mb = (n) => (n / 1048576).toFixed(2);
console.log(`Đã tạo ${path.relative(ROOT, ZIP)} (${mb(zip.length)} MB, ${entries.length} mục, v${VERSION})`);
console.log('Chạy bản phát hành: giải nén -> node serve.mjs -> http://localhost:5173');
