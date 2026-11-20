// Bản đồ chuẩn 3 Đêm (Ticket-02 Phần 2). Góc đo từ +X: điểm = (cx + r·cosθ, y, cz + r·sinθ).
// (Kiểm chứng quy ước: đèn Đêm 1 L2 (23.8, 0, 7.7) = r 25, θ 18°.)

export const r3 = (v) => {
  const x = Math.round(v * 1000) / 1000;
  return x === 0 ? 0 : x;
};
const rad = (d) => (d * Math.PI) / 180;
function ring(cx, cz, r, startDeg, stepDeg, n, y = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = rad(startDeg + i * stepDeg);
    return [r3(cx + r * Math.cos(a)), y, r3(cz + r * Math.sin(a))];
  });
}
const hyp = (x, z) => Math.hypot(x, z);

// ---------- Đêm 1 — Đảo Bến ----------
const N1 = {
  night: 1,
  name: 'Đảo Bến',
  start: [0, 0, 0],
  lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
  moteSpawns: [...ring(0, 0, 12, 0, 45, 8), ...ring(0, 0, 33, 0, 22.5, 16)],
  shadeSpawns: ring(0, 0, 37, 15, 30, 12),
  shadeInterval: 480, shadeMax: 6, shadeSpeed: 4.0,
  drifters: false, charms: [], pads: [], wind: false,
  surface(x, z) { return hyp(x, z) <= 40 ? 0 : null; },
};

// ---------- Đêm 2 — Đảo Cau ----------
const N2 = {
  night: 2,
  name: 'Đảo Cau',
  start: [0, 0, 0],
  lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
  moteSpawns: [
    ...ring(0, 0, 10, 0, 90, 4), ...ring(0, 0, 22, 0, 45, 8),
    ...ring(70, 0, 10, 0, 90, 4), ...ring(70, 0, 22, 0, 45, 8),
  ],
  shadeSpawns: [...ring(0, 0, 26, 22.5, 45, 8), ...ring(70, 0, 26, 22.5, 45, 8)],
  shadeInterval: 420, shadeMax: 8, shadeSpeed: 4.0,
  drifters: true, charms: [[35, 0, 0]], wind: false,
  pads: [
    { pos: [20, 0, 18], r: 1, vy: 14, h: 24, toward: [70, 0, 0] },
    { pos: [50, 0, -18], r: 1, vy: 14, h: 24, toward: [0, 0, 0] },
  ],
  surface(x, z) {
    if (hyp(x, z) <= 28 || hyp(x - 70, z) <= 28) return 0;
    if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0; // cầu tre
    return null;
  },
};

// ---------- Đêm 3 — Đảo Chuông ----------
const RAMP_ANGLES = [30, 150];
function rampHeight(x, z) {
  let best = null;
  for (const d of RAMP_ANGLES) {
    const ux = Math.cos(rad(d)), uz = Math.sin(rad(d));
    const s = x * ux + z * uz;         // theo bán kính
    const p = -x * uz + z * ux;        // vuông góc
    if (s >= 24 && s <= 30 && Math.abs(p) <= 1.5) {
      const h = (3 * (30 - s)) / 6;
      if (best === null || h > best) best = h;
    }
  }
  return best;
}
const N3 = {
  night: 3,
  name: 'Đảo Chuông',
  start: [0, 0, -30], // GIẢ ĐỊNH: (0,0,0) nằm trong tháp chuông nên xuất phát ở tầng 0 phía −Z
  lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
  moteSpawns: [...ring(0, 0, 34, 0, 20, 18, 0), ...ring(0, 0, 18, 20, 20, 8, 3), ...ring(0, 0, 5, 45, 90, 4, 6)],
  shadeSpawns: ring(0, 0, 43, 0, 22.5, 16),
  shadeInterval: 360, shadeMax: 10, shadeSpeed: 4.5,
  drifters: true, charms: [[30, 0, 25], [-30, 0, 25]], wind: true,
  pads: [{ pos: [0, 3, 13], r: 1, vy: 12, h: 8, dir: [0, -1] }],
  surface(x, z) {
    const r = hyp(x, z);
    if (r > 45) return null;
    if (r <= 2) return 14;                       // tháp chuông (6 + 8), vách đứng
    if (r <= 8) return 6;                        // tầng 2
    let h = 0;
    if (z > 0 && r >= 12 && r <= 24) h = 3;      // tầng 1
    const rh = rampHeight(x, z);
    if (rh !== null && rh > h) h = rh;
    return h;
  },
};

export const MAPS = { 1: N1, 2: N2, 3: N3 };
export function getMap(night) {
  const m = MAPS[night];
  if (!m) throw new Error(`night không hợp lệ: ${night}`);
  return m;
}
