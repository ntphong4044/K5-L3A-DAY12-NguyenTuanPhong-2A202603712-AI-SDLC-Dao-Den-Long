// Bot tham lam chơi Đêm 1 mặc định qua lõi mô phỏng và GHI LẠI file inputs theo contract.
// Mục đích: chứng minh màn chơi thắng được từ đầu tới cuối; file inputs sinh ra được phát lại
// qua đúng lệnh headless để đối chiếu (không có gì sửa tay).
import { createGame, step, TICK_RATE } from '../src/core/sim.js';

export function playBot({ tuning: T, seed, maxTicks = 300 * TICK_RATE }) {
  const g = createGame({ tuning: T, seed });
  const frames = [];
  let prev = { move: [0, 0], interact: false, pulse: false };
  const d = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

  for (let k = 0; k < maxTicks && g.state === 'playing'; k++) {
    const p = g.player;
    const unlit = g.lanterns.filter((l) => !l.lit);
    const need = Math.min(T.lantern_cost - (unlit[0]?.deposited ?? 0), T.carry_capacity) + 1; // +1 dự phòng cho pulse
    const motes = g.motes.filter((m) => m.active);
    let target;
    if (p.carried >= need || (motes.length === 0 && p.carried > 0)) {
      target = unlit.reduce((a, b) => (d(b.pos, p.pos) < d(a.pos, p.pos) ? b : a));
    } else if (motes.length) {
      target = motes.reduce((a, b) => (d(b.pos, p.pos) < d(a.pos, p.pos) ? b : a));
    } else {
      target = unlit[0];
    }
    const dx = target.pos[0] - p.pos[0], dz = target.pos[2] - p.pos[2];
    const len = Math.hypot(dx, dz);
    const move = len > 0.05 ? [+(dx / len).toFixed(3), +(dz / len).toFixed(3)] : [0, 0];

    const nearLantern = unlit.some((l) => d(l.pos, p.pos) <= T.interact_radius - 0.2);
    const interact = !prev.interact && nearLantern && p.carried > 0;
    const threat = g.shades.some((s) => s.state !== 'stunned' && d(s.pos, p.pos) <= Math.min(3, T.pulse_radius));
    const pulse = !prev.pulse && threat && p.pulseCd === 0 && p.carried >= T.pulse_cost;

    const cur = { move, interact, pulse };
    const f = { tick: k };
    if (cur.move[0] !== prev.move[0] || cur.move[1] !== prev.move[1]) f.move = cur.move;
    if (cur.interact !== prev.interact) f.interact = cur.interact;
    if (cur.pulse !== prev.pulse) f.pulse = cur.pulse;
    if (Object.keys(f).length > 1) frames.push(f);
    prev = cur;
    step(g, { move, cam_yaw_deg: 0, interact, pulse, jump: false });
  }
  return { game: g, inputs: { frames } };
}
