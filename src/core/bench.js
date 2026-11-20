// Cảnh benchmark chuẩn của Phase 4 (mục 1 của Ticket-04). Dùng chung cho bản web (đo FPS thật)
// và `npm run bench` headless (kiểm cấu hình cảnh, đo CPU). Không DOM, không Math.random.
import { createGame, step } from './sim.js';
import { getMap } from './maps.js';

export const BENCH_SHADES = 200;   // bench được phép vượt trần của gameplay
export const BENCH_MOTES = 100;
export const BENCH_LIT = ['L1', 'L2', 'L3'];
export const WARMUP_S = 3;
export const ORBIT_RADIUS = 30, ORBIT_HEIGHT = 15, ORBIT_PERIOD_S = 15;

/** Bóng Mực rải đều trên đảo: 8 vòng đồng tâm, mỗi vòng chia đều góc (seed 42 cố định trong lệnh chấm). */
export function benchShadeSpots(map, n = BENCH_SHADES) {
  const spots = [];
  const rings = 8;
  for (let i = 0; i < n; i++) {
    const k = i % rings;
    const r = 5 + (k * 32) / Math.max(1, rings - 1);          // 5 m → 37 m, trong đảo 40 m
    const a = ((i / rings) * 2 * Math.PI) / Math.ceil(n / rings);
    const x = r * Math.cos(a), z = r * Math.sin(a);
    spots.push([x, (map.surface(x, z) ?? 0) + 1, z]);
  }
  return spots;
}

/** Scenario chuẩn: 200 Bóng Mực wander, 100 đom đóm, L1–L3 sáng fuel 100, không sinh thêm, không hút dầu. */
export function benchScenario(night = 1) {
  const map = getMap(night);
  const lanterns = map.lanterns.map((_, i) => {
    const id = `L${i + 1}`;
    return BENCH_LIT.includes(id) ? { id, lit: true, fuel: 100 } : { id };
  });
  return {
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    wind_enabled: false,
    motes: benchShadeSpots(map, BENCH_MOTES).map(([x, y, z]) => [Math.round(x * 1000) / 1000, 0, Math.round(z * 1000) / 1000]),
    shades: benchShadeSpots(map, BENCH_SHADES).map((pos, i) => ({ id: `B${i + 1}`, pos, state: 'wander' })),
    lanterns,
    player: { pos: [0, 0, 0], carried: 0 },
  };
}

/**
 * Tạo Đêm bench kèm các bộ đếm của chế độ bench: tắt sát thương (bất tử vĩnh viễn),
 * tắt nhặt đom đóm (sức chứa 0) và tắt điều kiện kết thúc Đêm. Đèn đứng yên ở fuel 100:
 * bước 2 không hao dầu, không Bóng Mực nào ở trạng thái `drain`.
 * Không đụng file inputs/scenario (giữ định dạng Test Contract); chỉ tắt trong bộ mô phỏng.
 */
export function createBenchGame({ tuning, seed = 42, night = 1 }) {
  const g = createGame({ tuning, seed, night, scenario: benchScenario(night) });
  g.bench = true;
  g.randomMotes = false;
  g.randomShades = false;
  g.randomDrifters = false;
  g.windEnabled = false;
  for (const l of g.lanterns) if (l.lit) l.fuel100 = tuning.fuel_max * 60;
  const p = g.player;
  // Không nhặt đom đóm: sức chứa 0 tạm thời (`successfulLights` = −5 ⇒ 10 + 2×(−5) = 0), không tăng điểm.
  p.successfulLights = -5;
  // Không sát thương: đổi riêng đối tượng player của cảnh bench, lõi không đổi (`invuln` luôn 90 phút demo).
  p.invuln = 999_999_999;
  p.carried = 0;
  return g;
}

/**
 * Một tick của cảnh bench: Mây đứng yên, không input, Bóng Mực vẫn wander theo luật.
 * Lõi giảm `invuln` ngay ở bước 2 rồi mới xét chạm ở bước 9, nên phải bật bất tử TRƯỚC `step()` của tick đó
 * (một tick luôn giảm 1 đơn vị); sau tick đặt lại để lần gọi lẻ `benchStep` kế tiếp cũng an toàn.
 */
export function benchStep(g, { immune = true } = {}) {
  const p = g.player;
  if (immune) p.invuln = Math.max(p.invuln, 1);
  p.carried = 0;
  const evs = step(g, { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false });
  if (immune) p.invuln = Math.max(p.invuln, 1);
  if (g.state === 'won' || g.state === 'lost') { g.state = 'playing'; g.reason = null; }
  return evs;
}

/** Camera quỹ đạo: góc 0° = (30,15,0), quay ngược chiều kim đồng hồ nhìn từ trên xuống, 15 s/vòng.
 *  Dùng đúng quy ước góc lab đã định nghĩa ở Ticket-02 ("góc từ +X, ngược chiều kim đồng hồ nhìn từ trên xuống"):
 *  điểm = (r·cosθ, y, r·sinθ) — kiểm bằng dữ liệu của lab: đèn L2 (23.8, 0, 7.7) ở 18°, tầng 1 Đêm 3 "z > 0" ở 20°–160°. */
export function orbitCamera(t) {
  const a = (2 * Math.PI * t) / ORBIT_PERIOD_S;
  const z = ORBIT_RADIUS * Math.sin(a);
  return {
    pos: [ORBIT_RADIUS * Math.cos(a), ORBIT_HEIGHT, z === 0 ? 0 : z],   // +0 thay vì −0 ở góc 0°/180°
    look: [0, 0, 0],
  };
}

/** Tương thích tên cũ: cùng việc với `benchStep` (đã bật bất tử). */
export const benchTick = (g) => benchStep(g);
