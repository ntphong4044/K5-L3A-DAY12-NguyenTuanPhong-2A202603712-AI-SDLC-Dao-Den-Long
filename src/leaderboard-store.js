// Kho bảng xếp hạng trên đĩa cho CLI (`npm start -- --export-leaderboard [file]`).
//   - Tệp chung: $DDL_LEADERBOARD (nếu đặt) hoặc ./.ddl/leaderboard.json trong thư mục dự án này.
//   - Hồ sơ trình duyệt: cùng tệp nhưng trong profile Chromium của `npm run bench` (bản web lưu localStorage).
// Không ném lỗi khi tệp hỏng/thiếu: coi như bảng rỗng.
import fs from 'node:fs';
import path from 'node:path';
import { parseLeaderboard, addEntry, topEntries } from './core/leaderboard.js';

export const DEFAULT_FILE = '.ddl/leaderboard.json';

/** Tệp ứng viên theo thứ tự ưu tiên (tệp sau chỉ dùng khi tệp trước không có mục). */
export function candidateFiles(root, { profileDir, extra } = {}) {
  // DDL_LEADERBOARD chỉ định đúng một tệp (dùng cho kiểm chứng): không trộn với tệp mặc định của dự án.
  if (process.env.DDL_LEADERBOARD) return [path.resolve(process.env.DDL_LEADERBOARD)];
  const files = [path.join(root, DEFAULT_FILE)];
  if (extra) files.push(path.resolve(extra));
  if (profileDir) files.push(path.join(profileDir, 'ddl-leaderboard.json'));
  return [...new Set(files)];
}

export function readFileEntries(file) {
  try { return parseLeaderboard(fs.readFileSync(file, 'utf8')); } catch { return []; }
}

/** Giữ tối đa `LEADERBOARD_MAX + SPEED_BUFFER` mục: nạp lại qua addEntry để sắp đúng thứ tự và cắt bớt. */
function normalize(entries) {
  return entries.length ? addEntry(entries.slice(1), entries[0]) : [];
}

/**
 * Trả về { entries: tối đa 10, all: danh sách đã chuẩn hóa, file: tệp đã dùng }.
 * `remap`: hàm đổi vị trí `achieved_at` (dùng cho mục lưu từ trình duyệt có đồng hồ đơn điệu).
 */
export function loadEntries(root, { profileDir, extra, remap } = {}) {
  for (const file of candidateFiles(root, { profileDir, extra })) {
    let entries = readFileEntries(file);
    if (!entries.length) continue;
    if (remap) entries = entries.map((e) => (remap(e) ?? e));
    const all = normalize(entries);
    return { entries: topEntries(all), all, file };
  }
  return { entries: [], all: [], file: null };
}

/** Thêm một mục vào tệp mặc định; trả về tệp đã ghi và danh sách 10 mục hiện tại. */
export function appendEntry(root, entry) {
  const file = path.join(root, DEFAULT_FILE);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const all = addEntry(readFileEntries(file), entry);
  fs.writeFileSync(file, JSON.stringify({ entries: all }, null, 2) + '\n');
  return { file, entries: topEntries(all) };
}
