// Bảng xếp hạng: nguồn chính là tệp trên đĩa .ddl/leaderboard.json do máy chủ (scripts/serve.js) ghi qua /api/leaderboard,
// nên `<run_cmd> --export-leaderboard out.json` xuất đúng dữ liệu người chơi đã lưu. localStorage là bản sao để
// hiển thị đồng bộ (và dự phòng khi mở bản web tĩnh không có máy chủ).
import { parseLeaderboard, addEntry, topEntries, isoLocal, normalizeName, isFutureStamp, clampAchievedAt } from '/src/core/leaderboard.js';

const LB_KEY = 'ddl-leaderboard';
const STORE_MAX = 20;   // giữ thêm để 3 mục "Tốt nghiệp" của một ván không đẩy mất mục cũ

const read = () => { try { return localStorage.getItem(LB_KEY); } catch { return null; } };
const saveAll = (all) => {
  try { localStorage.setItem(LB_KEY, JSON.stringify({ entries: all.slice(0, STORE_MAX) })); return true; } catch { return false; }
};

// Đồng bộ một lần lúc tải trang: tệp trên đĩa là nguồn đúng.
try {
  const r = await fetch('/api/leaderboard', { cache: 'no-store' });
  if (r.ok) saveAll(parseLeaderboard(await r.text()));
} catch { /* bản web tĩnh không có máy chủ: dùng localStorage */ }

export function loadLeaderboard() {
  const entries = parseLeaderboard(read());
  if (entries.some((e) => isFutureStamp(e))) saveAll(entries.map((e) => clampAchievedAt(e) ?? e));
  return topEntries(entries);
}

export function resetLeaderboard() {
  fetch('/api/leaderboard/reset', { method: 'POST' }).catch(() => {});
  try { localStorage.removeItem(LB_KEY); return true; } catch { return false; }
}

/** Mục mới cho ván `totals`: MỘT mục cho cả ván (Ticket-04: score = tổng điểm các Đêm đã thắng, nights_won 0–3). */
export function newRunEntries({ totals, seed, now = new Date() }) {
  const t = [...totals];
  const won = t.filter((s) => Number(s) > 0).length;
  const score = t.slice(0, won).reduce((a, b) => a + Number(b || 0), 0);
  const all = parseLeaderboard(read());
  const saved = all.some((e) => e.seed === seed && e.nights_won === won && e.score === score);
  const fresh = saved ? [] : [{ score, nights_won: won, achieved_at: isoLocal(now), seed }];
  return { fresh, won, score };
}

/**
 * Lưu các mục `fresh` cùng một tên. Trả {ok, entries}. Tên sai thì không ghi gì (người chơi sửa lại).
 */
export function commitRun(fresh, rawName, { now = new Date() } = {}) {
  const r = normalizeName(rawName);
  if (!r.ok) return r;
  let all = parseLeaderboard(read());
  // Giữ thời điểm gần đúng của từng Đêm đã thắng (fresh đã tính), để thứ tự "bằng điểm, ai đạt trước" đúng.
  for (const e of fresh) all = addEntry(all, { ...e, name: r.name });
  for (const e of fresh) fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...e, name: r.name }) }).catch(() => {});
  return { ok: true, name: r.name, saved: saveAll(all), entries: topEntries(all) };
}

export const hasFresh = (fresh) => fresh.length > 0;
