// Soak test (Ticket-04 mục 2): nhiều Đêm liên tiếp trong cùng một tiến trình, input ngẫu nhiên theo seed.
// Thuần: không DOM, không Math.random — dùng mulberry32 của sim.
import { createGame, step, mulberry32, TICK_RATE } from './sim.js';

export const SOAK_INPUT = { jump: 0.05, dash: 0.03, pulse: 0.02, interact: 0.10 };
export const WATCH_WINDOW = 16;      // tick: ~0.25 s mỗi mẫu
export const WATCH_OVER_TICKS = 240; // 4 s liên tục quá ngưỡng mới coi là rò rỉ
export const WATCH_RATIO = 4;        // ngưỡng giám sát = max(2, 4 × mem_start): rò rỉ thật tăng tuyến tính
export const DIR_SWITCH_TICKS = 30;

const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
const MASK = (x) => ((x % 256) + 256) % 256;

/**
 * Input của tick k của Đêm thứ i. Hướng giữ 30 tick rồi chọn lại (một khối 30 tick dùng chung một khung).
 * Bốn lần rút jump/dash/pulse/interact băm theo từng tick nên độc lập với hướng. Nhờ băm theo (seed, i, k)
 * mà một tick luôn cho cùng input bất kể chạy luồng nào — soak không phụ thuộc thứ tự gọi.
 */
export function soakInput(seed, idx, k) {
  const base = (MASK(seed + idx) * 1_000_003) >>> 0;
  const block = Math.floor(k / DIR_SWITCH_TICKS);
  const dir = DIRS[Math.floor(mulberry32((base ^ (block * 0x9e3779b1)) >>> 0)() * DIRS.length)];
  const r = mulberry32((base + k * 0x85ebca6b + 17) >>> 0);
  return {
    move: [...dir],
    cam_yaw_deg: 0,
    jump: r() < SOAK_INPUT.jump,
    dash: r() < SOAK_INPUT.dash,
    pulse: r() < SOAK_INPUT.pulse,
    interact: r() < SOAK_INPUT.interact,
    pause: false,
  };
}

/**
 * Chạy `nights` Đêm (Đêm 1 → 2 → 3 xoay vòng). Đêm i dùng seed `seed + i`, tối đa `maxTicks` tick
 * hoặc tới khi kết thúc Đêm (thắng/thua), tuỳ cái nào tới trước.
 * `mem()` trả bộ nhớ hiện tại (MB); `onNight(i, info)` báo tiến độ từng Đêm.
 * `crashes` đếm lỗi văng ra khỏi một Đêm và số lần RSS vượt ngưỡng giám sát quá `WATCH_OVER_TICKS`.
 */
export function runSoak({ tuning, seed = 7, nights = 10, maxTicks = 21600, warmupNights = 0, mem = () => null, measure = mem, onNight }) {
  const results = [];
  let memStart = null, totalTicks = 0, crashes = 0, leak = false;
  const t0 = Date.now();
  let overTicks = 0;
  // Ticket-04: mem_start = RSS "sau khi tải xong Đêm đầu tiên" — mặc định KHÔNG có Đêm khởi động ẩn.
  // (warmupNights chỉ để thử nghiệm; soak_cmd không dùng.)
  const warm = Math.min(warmupNights, nights - 1);
  for (let i = 0; i < warm; i++) {
    try {
      const g = createGame({ tuning, seed: seed + i, night: (i % 3) + 1 });
      for (let k = 0; k < maxTicks && (g.state === 'playing' || g.state === 'paused'); k++) step(g, soakInput(seed, i, k));
    } catch { /* Đêm khởi động hỏng: bỏ qua, không tính vào kết quả */ }
  }
  const sample = () => {
    if (memStart === null) return;
    const limit = Math.max(2, WATCH_RATIO * memStart);
    overTicks = mem() > limit ? overTicks + WATCH_WINDOW : 0;
    if (overTicks >= WATCH_OVER_TICKS && !leak) { leak = true; crashes += 1; }
  };
  for (let i = 0; i < nights; i++) {
    const night = (i % 3) + 1;
    let g = null, ticks = 0;
    try {
      g = createGame({ tuning, seed: seed + i, night });
      if (i === 0) memStart = measure();
      let k = 0;
      while (k < maxTicks && (g.state === 'playing' || g.state === 'paused')) {
        step(g, soakInput(seed, i, k));
        k++;
        if (k % WATCH_WINDOW === 0) sample();
      }
      ticks = k;
    } catch {
      crashes += 1;   // một Đêm văng lỗi: ghi nhận, vẫn chạy các Đêm sau trong cùng tiến trình
    }
    results.push(g?.state === 'won' ? 'won' : 'lost');
    totalTicks += ticks;
    if (onNight) onNight(i, { night, result: results[i], ticks, state: g?.state ?? 'crashed', reason: g?.reason ?? null, leak });
  }
  const memEnd = measure();   // sau khi reset xong Đêm cuối (Đêm cuối đã ra khỏi phạm vi)
  return {
    nights, crashes, results,
    mem_start_mb: memStart,
    mem_end_mb: memEnd,
    duration_s: Math.round(((Date.now() - t0) / 1000) * 10) / 10,
    ticks: totalTicks,
    tick_rate: TICK_RATE,
    warmup_nights: warm,
  };
}
