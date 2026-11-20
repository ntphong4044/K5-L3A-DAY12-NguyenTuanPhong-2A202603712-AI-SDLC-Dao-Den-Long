#!/usr/bin/env node
// Xuất bảng xếp hạng cục bộ: <run_cmd> --export-leaderboard out.json
// Đọc tệp do bản web ghi (hồ sơ trình duyệt do `npm run bench` dùng, + tệp chung của CLI), in {"entries": [...]}.
// Tuỳ chọn: --profile <thư-mục-profile-Chromium> (tự dò hồ sơ bench gần nhất nếu bỏ trống).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { loadEntries, appendEntry } from './leaderboard-store.js';
import { clampAchievedAt } from './core/leaderboard.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Hồ sơ bench gần nhất: thư mục tạm ddl-bench-* (Windows/Linux) hoặc trong ~/Library/Caches/TemporaryItems (macOS). */
export function findBenchProfile(tmpdir = os.tmpdir()) {
  const dirs = [tmpdir];
  if (process.platform === 'darwin') dirs.push(path.join(os.homedir(), 'Library', 'Caches', 'TemporaryItems'));
  let best = null, bestTime = 0;
  for (const d of dirs) {
    let names = [];
    try { names = fs.readdirSync(d); } catch { continue; }
    for (const n of names) {
      if (!n.startsWith('ddl-bench-')) continue;
      const f = path.join(d, n, 'ddl-leaderboard.json');
      try {
        const st = fs.statSync(f);
        if (st.mtimeMs > bestTime) { best = path.dirname(f); bestTime = st.mtimeMs; }
      } catch { /* chưa có tệp bảng xếp hạng */ }
    }
  }
  return best;
}

export function exportLeaderboard(argv, { root = ROOT, log = () => {} } = {}) {
  let out = 'leaderboard-export.json', profile;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile') { profile = argv[++i]; if (profile === undefined) throw new Error('--profile cần đường dẫn hồ sơ'); continue; }
    if (argv[i].startsWith('--')) continue;   // cờ khác (ví dụ --export-leaderboard) do nơi gọi xử lý
    out = argv[i];
  }
  const now = new Date();
  const res = loadEntries(root, { profileDir: profile, remap: (e) => clampAchievedAt(e, now) });
  const doc = { entries: res.entries };
  fs.writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
  log(`Đã xuất ${res.entries.length} mục (nguồn: ${res.file ?? 'không có tệp, bảng rỗng'}) -> ${out}`);
  return { doc, file: res.file, path: out };
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain && process.argv.includes('--export-leaderboard')) {
  const i = process.argv.indexOf('--export-leaderboard');
  const { doc } = exportLeaderboard(process.argv.slice(i + 1), { log: (m) => process.stderr.write(m + '\n') });
  process.stdout.write(JSON.stringify(doc, null, 2) + '\n');
  process.exit(0);
}

export { appendEntry };
