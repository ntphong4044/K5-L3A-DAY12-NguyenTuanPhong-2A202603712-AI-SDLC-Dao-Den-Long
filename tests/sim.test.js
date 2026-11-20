// Unit test lõi mô phỏng — Contract v1.1 (Ticket-02). Mã AC khớp docs/notes/phase-2.md.
// Test Phase 1 bị luật mới thay thế đã được sửa (ghi "[P2 đổi]" kèm lý do) thay vì xóa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGame, step, snapshot, STD } from '../src/core/sim.js';
import { getMap } from '../src/core/maps.js';

const T = JSON.parse(fs.readFileSync(new URL('../game.contract.json', import.meta.url))).tuning;
const IDLE = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
const NO = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false };
const game = (scenario = {}, night = 1, seed = 1) => createGame({ tuning: T, seed, night, scenario: { ...NO, ...scenario } });
const run = (g, n, input = IDLE) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...step(g, input)); return ev; };
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('Số chuẩn Ticket-02 khớp game.contract.json', () => {
  const want = { player_speed: 6, carry_capacity: 10, lantern_cost: 10, interact_radius: 2, pulse_cost: 3, pulse_radius: 5,
    pulse_cooldown_s: 3, pulse_stun_s: 2, pulse_push_m: 4, safe_radius: 6, shade_speed: 4, shade_hit_radius: 1, invuln_s: 1.5,
    hit_drop_ratio: 0.5, flames: 3, fall_enabled: true, dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5,
    night1_duration_s: 300, night2_duration_s: 330, night3_duration_s: 360 };
  for (const [k, v] of Object.entries(want)) assert.equal(T[k], v, k);
  assert.deepEqual(T.score, { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 });
});

test('AC-M1 di chuyển 6 m/s, đạt tốc độ ngay (<= 0.1 s), dừng ngay', () => {
  const g = game();
  run(g, 60, { ...IDLE, move: [0, 1] });
  close(g.player.pos[2], 6);
  run(g, 1);
  assert.deepEqual(g.player.vel, [0, 0, 0]);
});

test('AC-M2 cam_yaw_deg = 90: move [0,1] => +X; vector dài hơn 1 được chuẩn hóa', () => {
  const g = game();
  run(g, 60, { ...IDLE, move: [0, 1], cam_yaw_deg: 90 });
  close(g.player.pos[0], 6); close(g.player.pos[2], 0);
  const g2 = game();
  run(g2, 60, { ...IDLE, move: [1, 1] });
  close(Math.hypot(g2.player.pos[0], g2.player.pos[2]), 6);
});

test('AC-M3 nhảy 7 m/s, trọng lực 20, chỉ nhảy khi chạm đất; điều khiển trên không đầy đủ', () => {
  const g = game();
  run(g, 1, { ...IDLE, jump: true });
  close(g.player.vel[1], 7 - 20 / 60);
  assert.equal(g.player.grounded, false);
  run(g, 10, { ...IDLE, jump: false });
  run(g, 1, { ...IDLE, jump: true }); // đang trên không: không nhảy lại
  assert.ok(g.player.vel[1] < 7 - 20 / 60 * 11);
  run(g, 10, { ...IDLE, move: [1, 0] });
  close(g.player.vel[0], 6);
  run(g, 60);
  assert.equal(g.player.grounded, true);
  assert.equal(g.player.pos[1], 0);
});

test('AC-M4 lướt trên không giữ nguyên độ cao', () => {
  const g = game();
  run(g, 10, { ...IDLE, jump: true });
  const y = g.player.pos[1];
  step(g, { ...IDLE, dash: true });
  for (let i = 0; i < 11; i++) step(g, IDLE);
  close(g.player.pos[1], y);
});

test('AC-L1 tương tác: đèn chưa sáng gần nhất, bằng nhau thì id nhỏ hơn; nạp nhiều lần, đèn nhớ tiến độ', () => {
  const g = game({ player: { carried: 4 }, lanterns: [{ id: 'L2', pos: [1.5, 0, 0] }, { id: 'L1', pos: [-1.5, 0, 0] }] });
  const e1 = run(g, 1, { ...IDLE, interact: true });
  assert.equal(e1.find((e) => e.name === 'deposit').data.lantern_id, 'L1');
  assert.equal(g.lanterns[0].deposited, 4);
  g.player.carried = 10;
  run(g, 1);
  const e2 = run(g, 1, { ...IDLE, interact: true });
  assert.deepEqual(e2.find((e) => e.name === 'deposit').data, { lantern_id: 'L1', amount: 6, deposited: 10 });
  assert.equal(g.player.carried, 4);
});

test('AC-L2 [P2 đổi] điểm +10 mỗi đom đóm NẠP (P1: khi nhặt)', () => {
  const g = game({ motes: [[0, 0, 0]], player: { carried: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }] });
  run(g, 1);
  assert.equal(g.score, 0, 'nhặt không có điểm');
  run(g, 1, { ...IDLE, interact: true });
  assert.equal(g.score, 30);
});

test('AC-P1 nhặt cần chênh cao <= 1.5 m', () => {
  const g = game({ motes: [[0, 2, 0]] });
  assert.equal(run(g, 1).length, 1); // chỉ night_start
  const g2 = game({ motes: [[0, 1.5, 0]] });
  assert.ok(run(g2, 1).some((e) => e.name === 'mote_picked'));
});

test('AC-P2 đom đóm rơi ra vành 1.5–2.5 m, nhặt lại được từ tick sau, tồn tại 480 tick', () => {
  const g = game({ player: { carried: 4 }, shades: [{ pos: [0.5, 1, 0] }] });
  run(g, 1);
  g.shades = []; // chỉ xét đom đóm rơi
  const dropped = g.motes.filter((m) => m.kind === 'dropped');
  assert.equal(dropped.length, 2);
  for (const m of dropped) { const d = Math.hypot(m.pos[0], m.pos[2]); assert.ok(d >= 1.5 - 1e-3 && d <= 2.5 + 1e-3, String(d)); }
  run(g, STD.dropTtl - 1); // tick 2..480: vẫn còn
  assert.equal(g.motes.length, 2);
  run(g, 1);               // tick 481: hết TTL
  assert.equal(g.motes.length, 0);
  const g2 = game({ player: { carried: 4 }, shades: [{ pos: [0.5, 1, 0] }] });
  run(g2, 1);
  g2.shades = [];
  g2.player.pos = [...g2.motes[0].pos];
  assert.ok(run(g2, 1).some((e) => e.name === 'mote_picked'));
});

test('AC-S1 Bóng Mực không chạm khi chênh cao > 1.5 m (Mây đang bay qua)', () => {
  const g = game({ player: { pos: [0, 5, 0] }, shades: [{ pos: [0.5, 1, 0] }] });
  assert.ok(!run(g, 1).some((e) => e.name === 'player_hit'));
  assert.equal(g.player.flames, 3);
});

test('AC-S2 tối đa 1 lần mất lửa mỗi tick; xét theo id tăng dần (S2 trước S10)', () => {
  const g = game({ shades: [{ id: 'S10', pos: [0.3, 1, 0] }, { id: 'S2', pos: [-0.3, 1, 0] }] });
  const ev = run(g, 1).filter((e) => e.name === 'player_hit');
  assert.equal(ev.length, 1);
  assert.equal(g.shades.find((s) => s.id === 'S2').state, 'recoil');
  assert.equal(g.shades.find((s) => s.id === 'S10').state, 'chase');
});

test('AC-S3 phát hiện 12 m, bỏ đuổi > 18 m; wander lượn vòng 2 m quanh chỗ đứng', () => {
  const g = game({ shades: [{ pos: [12.5, 1, 0] }] });
  run(g, 60);
  assert.equal(g.shades[0].state, 'wander');
  assert.ok(Math.hypot(g.shades[0].pos[0] - 10.5, g.shades[0].pos[2]) <= 2 + 1e-6);
  g.player.pos = [1, 0, 0];
  run(g, 1);
  assert.equal(g.shades[0].state, 'chase');
  g.player.pos = [-20, 0, 0];
  run(g, 1);
  assert.equal(g.shades[0].state, 'wander');
});

test('AC-T1 [P2 đổi] Tỏa Sáng tính 3D: Bóng Mực ở tầng khác ngoài 5 m không bị trúng', () => {
  const g = game({ player: { carried: 3, pos: [0, 0, 0] }, shades: [{ pos: [3, 5, 0] }] });
  const ev = run(g, 1, { ...IDLE, pulse: true });
  assert.deepEqual(ev.find((e) => e.name === 'pulse').data.stunned_ids, []);
});

test('AC-T2 không đủ 3 đom đóm thì không kích hoạt; pulse lại làm mới choáng và vẫn +5', () => {
  const g0 = game({ player: { carried: 2 } });
  assert.ok(!run(g0, 1, { ...IDLE, pulse: true }).some((e) => e.name === 'pulse'));
  const g = game({ player: { carried: 6 }, shades: [{ pos: [2, 1, 0], state: 'stunned', state_ticks_left: 10 }] });
  run(g, 1, { ...IDLE, pulse: true });
  assert.equal(g.shades[0].stateTicks, 120);
  assert.equal(g.score, 5);
});

test('AC-W1 thứ tự xét: hết lửa luôn thua kể cả khi mọi đèn đã sáng', () => {
  const lanterns = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const g = game({ player: { flames: 0 }, lanterns });
  assert.deepEqual(run(g, 1).at(-1).data, { result: 'lost', reason: 'no_flames' });
});

test('AC-W2 rơi từ dưới mặt đảo không bị kéo lên mặt đất', () => {
  const g = game({ player: { pos: [0, -5, 0] } });
  run(g, 1);
  assert.ok(g.player.pos[1] < -5);
});

test('AC-D1 Gió Lạc: vùng an toàn không chặn, bất tử không ngăn bị cướp, không mất lửa', () => {
  const g = game({ player: { carried: 6, invuln_ticks: 600 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], drifters: [{ pos: [3, 1.5, 0] }] }, 2);
  const ev = run(g, 30);
  assert.ok(ev.some((e) => e.name === 'drifter_steal'));
  assert.equal(g.player.flames, 3);
});

test('AC-D2 Gió Lạc sinh ở tick 1200, 2400…, tối đa 2 con, id D1, D2', () => {
  const g = createGame({ tuning: T, seed: 3, night: 2, scenario: { random_shades: false, random_motes: false, player: { invuln_ticks: 99999 } } });
  run(g, 1199);
  assert.equal(g.drifters.length, 0);
  run(g, 1);
  assert.deepEqual(g.drifters.map((d) => d.id), ['D1']);
  run(g, 1200 * 3);
  assert.ok(g.drifters.filter((d) => d.state !== 'removed').length <= 2);
  assert.equal(g.drifters.length, 2);
});

test('AC-C1 nhặt lại Bùa làm mới 600 tick; Đêm 1 không có Bùa, Đêm 3 có C1, C2', () => {
  assert.equal(game({}, 1).charms.length, 0);
  assert.deepEqual(createGame({ tuning: T, seed: 1, night: 3 }).charms.map((c) => c.id), ['C1', 'C2']);
  const g = game({ player: { charm_ticks: 100 }, charms: [{ id: 'C1', pos: [0, 0, 0] }] }, 2);
  run(g, 1);
  assert.equal(g.player.charm, 600);
});

test('AC-C2 khi có Bùa: nhấn lướt lúc đang lướt bị bỏ qua', () => {
  const g = game({ player: { charm_ticks: 600 } }, 2);
  step(g, { ...IDLE, dash: true });
  step(g, IDLE);
  const ev = run(g, 1, { ...IDLE, dash: true });
  assert.ok(!ev.some((e) => e.name === 'dash'));
});

test('AC-N1 bản đồ: số đèn và điểm sinh đúng chuẩn', () => {
  assert.equal(getMap(1).lanterns.length, 5); assert.equal(getMap(2).lanterns.length, 6); assert.equal(getMap(3).lanterns.length, 7);
  assert.equal(getMap(1).moteSpawns.length, 24); assert.equal(getMap(2).moteSpawns.length, 24); assert.equal(getMap(3).moteSpawns.length, 30);
  assert.equal(getMap(1).shadeSpawns.length, 12); assert.equal(getMap(2).shadeSpawns.length, 16); assert.equal(getMap(3).shadeSpawns.length, 16);
  assert.deepEqual(getMap(1).shadeSpawns[0], [35.739, 0, 9.576]); // 37 m ở 15°
  for (const n of [1, 2, 3]) for (const p of getMap(n).moteSpawns) assert.equal(getMap(n).surface(p[0], p[2]), p[1], `Đêm ${n} ${p}`);
  for (const n of [1, 2, 3]) for (const p of getMap(n).lanterns) assert.equal(getMap(n).surface(p[0], p[2]), p[1], `đèn Đêm ${n} ${p}`);
});

test('AC-N2 Ngọn Lửa hồi đầy đầu mỗi Đêm; thời lượng 300/330/360', () => {
  for (const [n, t] of [[1, 300], [2, 330], [3, 360]]) {
    const s = snapshot(createGame({ tuning: T, seed: 1, night: n }));
    assert.equal(s.player.flames, 3); assert.equal(s.time_left_s, t); assert.equal(s.night, n);
  }
});
