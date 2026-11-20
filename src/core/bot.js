// Bot tham lam có tìm đường (đồ thị điểm mốc + kiểm tra đoạn đi được bằng surface()).
// Dùng cho: bằng chứng "chơi trọn Đêm" (scripts/proof.js) và chế độ đo FPS của bản web (?bench).
// Tất định: chỉ đọc trạng thái game, không dùng số ngẫu nhiên.
const rad = (d) => (d * Math.PI) / 180;
const at = (r, deg, y = 0) => [r * Math.cos(rad(deg)), y, r * Math.sin(rad(deg))];
const dXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

const NODES = {
  1: [],
  2: [[25, 0, 0], [45, 0, 0], [12, 0, 0], [58, 0, 0]],
  3: [
    at(31.5, 30), at(22.5, 30, 3), at(31.5, 150), at(22.5, 150, 3), [0, 3, 13.6], at(18, 90, 3), at(18, 60, 3), at(18, 120, 3),
    ...[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => at(32, a)),
    ...[200, 240, 270, 300, 340].map((a) => at(14, a)),
  ],
};
// cạnh đặc biệt: bục nhảy (đi vào bục -> đáp ở điểm đích)
const LAUNCH = { 2: [[[20, 0, 18], [51, 0, 11]], [[50, 0, -18], [19, 0, -11]]], 3: [[[0, 3, 13], [0, 6, 6.5]]] };

function walkable(game, a, b) {
  const M = game.M;
  const n = Math.max(2, Math.ceil(dXZ(a, b) / 0.4));
  let h = M.surface(a[0], a[2]);
  if (h === null) return false;
  for (let i = 1; i <= n; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / n, z = a[2] + ((b[2] - a[2]) * i) / n;
    const g = M.surface(x, z);
    if (g === null || g > h + 0.3) return false;
    if (M.pads.some((p) => Math.hypot(x - p.pos[0], z - p.pos[2]) <= p.r + 0.6) && i < n) return false;
    h = g;
  }
  return true;
}

function plan(game, from, to) {
  const night = game.night;
  if (walkable(game, from, to)) return to;
  const nodes = [from, ...NODES[night], ...(LAUNCH[night] || []).flatMap((e) => e), to];
  const N = nodes.length, T = N - 1;
  const special = new Map();
  for (const [pad, land] of LAUNCH[night] || []) {
    special.set(nodes.findIndex((q) => q === pad), nodes.findIndex((q) => q === land));
  }
  const dist = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), done = new Array(N).fill(false);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === T) break;
    done[u] = true;
    const relax = (v, w) => { if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; } };
    if (special.has(u)) relax(special.get(u), 1);
    for (let v = 0; v < N; v++) {
      if (v === u || done[v]) continue;
      const padTarget = special.has(v);
      if (padTarget ? walkableToPad(game, nodes[u], nodes[v]) : walkable(game, nodes[u], nodes[v])) relax(v, dXZ(nodes[u], nodes[v]));
    }
  }
  if (prev[T] < 0) return null;
  let v = T;
  while (prev[v] !== 0) v = prev[v];
  return nodes[v];
}
function walkableToPad(game, a, pad) {
  const p = game.M.pads.find((q) => dXZ(q.pos, pad) < 0.01);
  const stop = [pad[0] + (a[0] - pad[0]) * 0.9 / Math.max(dXZ(a, pad), 1e-9), 0, pad[2] + (a[2] - pad[2]) * 0.9 / Math.max(dXZ(a, pad), 1e-9)];
  return p && walkable(game, a, stop);
}

/** Tạo bot. decide(game) trả về input cho tick tiếp theo. */
export function createBot() {
  let prev = { interact: false, pulse: false };
  let waypoint = null, replan = 0, stuck = 0, last = null, side = 0, flip = 1;
  return function decide(g) {
    const T = g.T, p = g.player;
    // Ticket-03: đèn "cần" = đèn tắt, hoặc đèn sáng còn dưới 60 dầu (châm trước khi nó yếu/tắt)
    const fuel = (l) => (l.fuel100 ?? 0) / 60;
    const unlit = g.lanterns.filter((l) => !l.lit || fuel(l) < 60);
    if (!unlit.length || p.respawn > 0 || g.state !== 'playing') return { move: [0, 0], cam_yaw_deg: 0 };
    const awake = g.shades.filter((s) => s.state === 'chase' || s.state === 'wander');
    const danger = (q) => awake.filter((s) => dXZ(s.pos, q) <= 9).length;
    const cost = (q) => dXZ(q, p.pos) + 25 * danger(q) + 6 * Math.abs(q[1] - p.pos[1]);
    const best = (arr) => arr.reduce((a, b) => (cost(b.pos) < cost(a.pos) ? b : a));
    const lantern = best(unlit);
    const cap = Math.min(T.capacity_max ?? T.carry_capacity, T.carry_capacity + 2 * (p.successfulLights ?? 0));
    const need = Math.min(cap, lantern.lit ? Math.ceil((100 - fuel(lantern)) / (T.fuel_per_mote ?? 10))
      : (lantern.everLit ? (T.relight_cost ?? 5) : T.lantern_cost) - lantern.deposited);
    const motes = g.motes;
    const goLantern = p.carried >= need || (!motes.length && p.carried > 0);
    const target = goLantern ? lantern : (motes.length ? best(motes) : lantern);

    if (replan-- <= 0 || !waypoint) { waypoint = plan(g, p.pos, target.pos) || target.pos; replan = 15; }
    let dx = waypoint[0] - p.pos[0], dz = waypoint[2] - p.pos[2];
    let len = Math.hypot(dx, dz);
    if (len < 0.4 && waypoint !== target.pos) { replan = 0; }
    // chống kẹt: đứng yên quá lâu thì đi ngang một lúc
    if (last && dXZ(last, p.pos) < 0.02 && p.grounded) stuck += 1; else stuck = Math.max(0, stuck - 1);
    last = [...p.pos];
    if (stuck > 15) { side = 45; stuck = 0; flip = -flip; waypoint = null; }
    if (side > 0) { side -= 1; [dx, dz] = [-dz * flip + dx * 0.3, dx * flip + dz * 0.3]; len = Math.hypot(dx, dz); }
    if (len > 1e-9) { dx /= len; dz /= len; }
    // né Bóng Mực đang đuổi ở gần
    const chasers = g.shades.filter((s) => s.state === 'chase' && dXZ(s.pos, p.pos) <= 4);
    for (const s of chasers) {
      const ax = p.pos[0] - s.pos[0], az = p.pos[2] - s.pos[2], al = Math.max(Math.hypot(ax, az), 0.3);
      dx += (1.5 * ax) / (al * al); dz += (1.5 * az) / (al * al);
    }
    const ml = Math.hypot(dx, dz);
    const move = ml > 0.05 ? [+(dx / ml).toFixed(3), +(dz / ml).toFixed(3)] : [0, 0];

    const nearLantern = dXZ(lantern.pos, p.pos) <= T.interact_radius - 0.2;
    const interact = !prev.interact && nearLantern && p.carried > 0;
    const threat = chasers.some((s) => dXZ(s.pos, p.pos) <= 3);
    const pulse = !prev.pulse && threat && p.pulseCd === 0 && p.carried >= T.pulse_cost;
    prev = { interact, pulse };
    return { move, cam_yaw_deg: 0, interact, pulse, jump: false, dash: false, pause: false };
  };
}
