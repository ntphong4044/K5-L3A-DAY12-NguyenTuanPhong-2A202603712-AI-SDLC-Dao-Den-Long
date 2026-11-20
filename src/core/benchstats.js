// Thống kê khung hình của bench.json (Ticket-04 mục 1). Thuần: nhận mảng dt (ms) đã đo.
export function frameStats(dts) {
  const sys = typeof globalThis !== 'undefined' && globalThis.process?.versions?.node;
  void sys;
  const N = dts.length;
  if (!N) return { frames: 0, avg_fps: null, p1_low_fps: null, frame_ms_p95: null };
  const sum = dts.reduce((a, b) => a + b, 0);
  const avg = (1000 * N) / sum;
  const k = Math.max(1, Math.ceil(0.01 * N));
  const worst = [...dts].sort((a, b) => b - a).slice(0, k);
  const p1 = 1000 / (worst.reduce((a, b) => a + b, 0) / worst.length);
  const sorted = [...dts].sort((a, b) => a - b);
  // Phân vị 95 theo nội suy tuyến tính giữa hai hạng (cùng quy ước với NumPy mặc định).
  const h = (N - 1) * 0.95;
  const lo = Math.floor(h), hi = Math.ceil(h);
  const p95 = sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
  return { frames: N, avg_fps: round1(avg), p1_low_fps: round1(p1), frame_ms_p95: round1(p95) };
}

export const round1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);
export const round2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);

/** Nhãn mô tả engine/renderer cho bench.json. */
export const RENDERER_LABEL = 'three.js 0.170.0 (WebGL2), bản web tĩnh';
