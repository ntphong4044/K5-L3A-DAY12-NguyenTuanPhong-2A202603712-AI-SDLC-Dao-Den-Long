// Bảng xếp hạng cục bộ (Ticket-04 mục 3). Lõi thuần, không DOM: web lưu localStorage,
// CLI lưu file JSON trên đĩa. Tên 3–12 ký tự; chấp nhận A–Z a–z 0–9 _ và chữ Việt có dấu.

export const LEADERBOARD_MAX = 10;
const SPEED_BUFFER = 500;   // giữ thêm để một lần "Tốt nghiệp" của 3 Đêm không đẩy mất mục cũ

export const NAME_RE = /^[\p{L}\p{N}_]{3,12}$/u;
export const PENDING_NAME = '__pending__';

/** Chuẩn hóa tên: NFC, bỏ khoảng trắng thừa. Trả về {ok, name} hoặc {ok:false, error}. */
export function normalizeName(raw) {
  const name = String(raw ?? '').normalize('NFC').trim();
  if (name.length < 3) return { ok: false, error: 'Tên cần ít nhất 3 ký tự.' };
  if (name.length > 12) return { ok: false, error: 'Tên tối đa 12 ký tự.' };
  if (!NAME_RE.test(name)) return { ok: false, error: 'Chỉ dùng chữ, số và dấu gạch dưới (A–Z a–z 0–9 _; chữ Việt có dấu được).' };
  return { ok: true, name };
}

/** ISO 8601 có múi giờ địa phương, ví dụ 2026-11-20T15:04:05+07:00. */
export function isoLocal(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const oh = p(Math.floor(Math.abs(off) / 60)), om = p(Math.abs(off) % 60);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${sign}${oh}:${om}`;
}

/**
 * score = tổng điểm các Đêm đã thắng. `totals` là mảng điểm theo Đêm (0..2); nights_won = số phần tử > 0.
 * Đêm đã thắng luôn có điểm > 0 (mỗi đèn sáng ≥ 50 + floor(fuel) khi bình minh), nên dùng > 0 là đủ.
 */
export function finalScore(totals) {
  const arr = Array.isArray(totals) ? totals.slice(0, 3) : [];
  while (arr.length < 3) arr.push(0);
  const score = arr.reduce((a, b) => a + (Number(b) || 0), 0);
  const nights_won = arr.filter((s) => Number(s) > 0).length;
  return { score, nights_won };
}

// `name` chỉ cần là chuỗi khác rỗng: tên người chơi được kiểm bằng NAME_RE khi nhập (normalizeName);
// mục đã nằm trong tệp vẫn đọc được kể cả khi tên dài/ngắn hơn quy định (không tự làm mất dữ liệu cũ).
const validEntry = (e) =>
  e && typeof e === 'object' &&
  typeof e.name === 'string' && e.name.length > 0 &&
  Number.isFinite(e.score) && e.score >= 0 &&
  Number.isInteger(e.nights_won) && e.nights_won >= 0 && e.nights_won <= 3 &&
  isIsoWithOffset(e.achieved_at) && !Number.isNaN(Date.parse(e.achieved_at)) &&
  Number.isInteger(e.seed);

/** Đọc an toàn (hỏng/thiếu → rỗng). Không ném lỗi. */
export function parseLeaderboard(text) {
  try {
    const doc = typeof text === 'string' ? JSON.parse(text) : text;
    if (!doc || typeof doc !== 'object') return [];
    const list = Array.isArray(doc) ? doc : doc?.entries;
    if (!Array.isArray(list)) return [];
    return list.filter(validEntry).map((e) => ({
      name: e.name, score: e.score, nights_won: e.nights_won, achieved_at: e.achieved_at, seed: e.seed,
    }));
  } catch {
    return [];
  }
}

/** Thứ tự hiển thị: score giảm dần; bằng điểm thì achieved_at sớm hơn đứng trên; cuối cùng theo tên. */
export function sortEntries(entries) {
  return [...entries].sort((a, b) =>
    b.score - a.score ||
    Date.parse(a.achieved_at) - Date.parse(b.achieved_at) ||
    (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * Thêm một mục. Trả về danh sách mới đã sắp (tối đa LEADERBOARD_MAX + SPEED_BUFFER).
 * Lưu tới LEADERBOARD_MAX + SPEED_BUFFER mục để sau "Tốt nghiệp" các mục cũ hiện ra đúng thứ tự.
 */
export function addEntry(entries, entry) {
  if (!validEntry(entry)) throw new Error('mục bảng xếp hạng không hợp lệ');
  // Tên của mục mới phải đúng quy định, trừ tên tạm `__pending__` của bản web trong lúc chờ người chơi nhập.
  if (entry.name !== PENDING_NAME && !NAME_RE.test(entry.name)) throw new Error('tên 3–12 ký tự (A–Z a–z 0–9 _, chữ Việt có dấu)');
  const keep = { name: entry.name, score: entry.score, nights_won: entry.nights_won, achieved_at: entry.achieved_at, seed: entry.seed };
  const all = sortEntries([...entries.filter(validEntry), keep]);
  return all.slice(0, LEADERBOARD_MAX + SPEED_BUFFER);
}

/** Hiển thị tối đa 10 mục theo đúng thứ tự. */
export function topEntries(entries) {
  return sortEntries(entries.filter(validEntry)).slice(0, LEADERBOARD_MAX);
}

/** Toàn bộ mục hợp lệ đã sắp (tối đa 10 + đệm tốc độ); hiển thị chỉ lấy `topEntries`. */
export function allEntries(entries) {
  return sortEntries(entries.filter(validEntry)).slice(0, LEADERBOARD_MAX + SPEED_BUFFER);
}

/** false = đồng hồ của máy lưu *sau* thời điểm hiện tại: cuộn về 10 s trước `now` cho trung thực. */
export const isFutureStamp = (entry, now = new Date()) => Date.parse(entry.achieved_at) > now.getTime() + 10_000;

export function clampAchievedAt(entry, now = new Date()) {
  if (!isFutureStamp(entry, now)) return null;
  return { ...entry, achieved_at: isoLocal(new Date(now.getTime() - 10_000)) };
}

const isIsoWithOffset = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/.test(s);
