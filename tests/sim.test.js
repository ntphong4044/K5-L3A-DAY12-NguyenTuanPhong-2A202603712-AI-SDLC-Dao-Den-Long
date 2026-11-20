// Test đơn vị cho lõi mô phỏng. Mỗi test ghi rõ yêu cầu/giả định nó kiểm chứng (xem docs/notes/phase-1.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGame, step, snapshot, WORLD } from '../src/core/sim.js';

const T = JSON.parse(fs.readFileSync(new URL('../game.contract.json', import.meta.url))).tuning;
const IDLE = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false };
const EMPTY = { random_motes: false, random_shades: false };

function game(scenario = {}, seed = 1) {
  return createGame({ tuning: T, seed, scenario: { ...EMPTY, ...scenario } });
}
function run(g, n, input = IDLE) {
  const ev = [];
  for (let i = 0; i < n; i++) ev.push(...step(g, input));
  return ev;
}
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('AC-01 di chuyển: 60 tick move [0,1] => +Z đúng player_speed m', () => {
  const g = game();
  run(g, 60, { ...IDLE, move: [0, 1] });
  close(g.player.pos[2], T.player_speed);
  close(g.player.pos[0], 0);
});

test('AC-02 cam_yaw_deg = 90: move [0,1] => +X (theo công thức contract)', () => {
  const g = game();
  run(g, 60, { ...IDLE, move: [0, 1], cam_yaw_deg: 90 });
  close(g.player.pos[0], T.player_speed);
  close(g.player.pos[2], 0);
});

test('AC-03 vector move dài hơn 1 được chuẩn hóa', () => {
  const g = game();
  run(g, 60, { ...IDLE, move: [1, 1] });
  close(Math.hypot(g.player.pos[0], g.player.pos[2]), T.player_speed);
});

test('AC-04 nhảy: kích hoạt theo cạnh lên, rời mặt đất rồi tiếp đất', () => {
  const g = game();
  run(g, 1, { ...IDLE, jump: true });
  assert.ok(g.player.pos[1] > 0);
  run(g, 120, { ...IDLE, jump: true }); // giữ nút: không nhảy lại
  assert.equal(g.player.pos[1], 0);
});

test('AC-05 fall_enabled=false: người chơi bị giữ trong đảo', () => {
  const g = game({ player: { pos: [29, 0, 0] } });
  run(g, 120, { ...IDLE, move: [1, 0] });
  close(Math.hypot(g.player.pos[0], g.player.pos[2]), WORLD.islandRadius);
});

test('AC-06 nhặt đom đóm trong pickup_radius (<= r), cộng per_mote', () => {
  const g = game({ motes: [[0, 0, T.pickup_radius]], player: { pos: [0, 0, 0] } });
  const ev = run(g, 1);
  assert.deepEqual(ev.map((e) => [e.tick, e.name, e.data]), [[1, 'mote_picked', { carried: 1 }]]);
  assert.equal(g.score, T.score.per_mote);
});

test('AC-07 không nhặt khi ngoài bán kính hoặc đã đầy carry_capacity', () => {
  const g = game({ motes: [[0, 0, T.pickup_radius + 0.01]] });
  assert.equal(run(g, 1).length, 0);
  const g2 = game({ motes: [[0, 0, 0]], player: { carried: T.carry_capacity } });
  assert.equal(run(g2, 1).length, 0);
  assert.equal(snapshot(g2).motes_active, 1);
});

test('AC-08 nạp đèn: interact trong interact_radius, đủ lantern_cost thì thắp', () => {
  const g = game({ player: { carried: T.lantern_cost }, lanterns: [{ id: 'L1', pos: [0, 0, T.interact_radius] }] });
  const ev = run(g, 1, { ...IDLE, interact: true });
  assert.deepEqual(ev.map((e) => e.name), ['deposit', 'lantern_lit']);
  assert.deepEqual(ev[0].data, { lantern_id: 'L1', amount: T.lantern_cost, deposited: T.lantern_cost });
  assert.equal(g.player.carried, 0);
  assert.equal(g.score, T.score.per_lantern);
});

test('AC-09 nạp một phần: chỉ lấy đủ phần còn thiếu; giữ nút không nạp lại', () => {
  const g = game({ player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], deposited: 1 }] });
  const ev = run(g, 3, { ...IDLE, interact: true });
  assert.equal(ev.filter((e) => e.name === 'deposit').length, 1);
  assert.equal(ev[0].data.amount, T.lantern_cost - 1);
  assert.equal(g.player.carried, 5 - (T.lantern_cost - 1));
});

test('AC-10 thắng khi thắp đủ 5 đèn; điểm thưởng thời gian + ngọn lửa', () => {
  const lanterns = ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true }));
  lanterns.push({ id: 'L5', pos: [0, 0, 1] });
  const g = game({ player: { carried: T.lantern_cost }, lanterns, time_left_s: 100 });
  const ev = run(g, 1, { ...IDLE, interact: true });
  assert.equal(ev.at(-1).name, 'game_over');
  assert.deepEqual(ev.at(-1).data, { result: 'won', reason: 'all_lit' });
  const bonus = Math.floor(100 - 1 / 60) * T.score.per_second_left + T.flames * T.score.per_flame_left;
  assert.equal(g.score, T.score.per_lantern + bonus);
});

test('AC-11 Bóng Mực đuổi theo người chơi với shade_speed', () => {
  const g = game({ shades: [{ pos: [20, 1, 0] }] });
  run(g, 60);
  close(g.shades[0].pos[0], 20 - T.shade_speed);
  assert.equal(g.shades[0].state, 'chase');
});

test('AC-12 bị chạm: mất 1 flame, rơi floor(carried*hit_drop_ratio), bất tử invuln_s', () => {
  const g = game({ player: { carried: 3 }, shades: [{ id: 'X', pos: [T.shade_hit_radius, 1, 0] }] });
  const ev = run(g, 1);
  assert.deepEqual(ev[0].data, { by: 'shade', flames: T.flames - 1, dropped: Math.floor(3 * T.hit_drop_ratio) });
  const inv = Math.round(T.invuln_s * 60);
  const ev2 = run(g, inv - 1).filter((e) => e.name === 'player_hit');
  assert.equal(ev2.length, 0, 'không bị chạm lại trong thời gian bất tử');
  const ev3 = run(g, 1).filter((e) => e.name === 'player_hit');
  assert.equal(ev3.length, 1);
  assert.equal(ev3[0].tick, 1 + inv);
});

test('AC-13 thua khi hết flames (no_flames)', () => {
  const g = game({ player: { flames: 1 }, shades: [{ pos: [0, 1, 0] }] });
  const ev = run(g, 5);
  assert.deepEqual(ev.map((e) => e.name), ['player_hit', 'game_over']);
  assert.deepEqual(ev[1].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(g.state, 'lost');
});

test('AC-14 pulse: tốn pulse_cost, làm choáng trong pulse_radius, đẩy lùi pulse_push_m, cộng per_stun', () => {
  const g = game({
    player: { carried: 2 },
    shades: [{ id: 'A', pos: [T.pulse_radius, 1, 0] }, { id: 'B', pos: [T.pulse_radius + 0.5, 1, 0] }],
  });
  const ev = run(g, 1, { ...IDLE, pulse: true });
  assert.deepEqual(ev[0], { type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: ['A'] } });
  assert.equal(g.player.carried, 2 - T.pulse_cost);
  assert.equal(g.score, T.score.per_stun);
  close(g.shades[0].pos[0], T.pulse_radius + T.pulse_push_m);
  assert.equal(g.shades[0].state, 'stunned');
});

test('AC-15 shade bị choáng đứng yên đúng pulse_stun_s rồi đuổi tiếp; không gây sát thương khi choáng', () => {
  const g = game({ player: { carried: 1 }, shades: [{ id: 'A', pos: [1, 1, 0] }] });
  // pulse ở bước 0, shade bị đẩy ra 5 m
  run(g, 1, { ...IDLE, pulse: true });
  const stunTicks = Math.round(T.pulse_stun_s * 60);
  const x = g.shades[0].pos[0];
  run(g, stunTicks - 1);
  assert.equal(g.shades[0].state, 'stunned');
  close(g.shades[0].pos[0], x);
  run(g, 1);
  assert.equal(g.shades[0].state, 'chase');
});

test('AC-16 pulse cooldown và không đủ ánh sáng thì không tỏa sáng', () => {
  const g = game({ player: { carried: 5 } });
  const press = (n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(...step(g, { ...IDLE, pulse: true }));
      out.push(...step(g, IDLE));
    }
    return out;
  };
  const cd = Math.round(T.pulse_cooldown_s * 60);
  const ev = press(cd / 2); // nhấn liên tục trong cooldown
  assert.equal(ev.filter((e) => e.name === 'pulse').length, 1);
  const g0 = game({ player: { carried: 0 } });
  assert.equal(run(g0, 1, { ...IDLE, pulse: true }).length, 0);
});

test('AC-17 Bóng Mực không vào được safe_radius quanh đèn ĐÃ thắp', () => {
  const g = game({
    player: { pos: [0, 0, 0] },
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
    shades: [{ pos: [12, 1, 0] }],
  });
  run(g, 600);
  const d = Math.hypot(g.shades[0].pos[0], g.shades[0].pos[2]);
  assert.ok(d > T.safe_radius, `shade ở ${d} m`);
  assert.equal(g.player.flames, T.flames);
});

test('AC-18 bình minh: hết thời gian thì thua (dawn); time_left_s giảm 1/60 mỗi bước', () => {
  const g = game({ time_left_s: 1 });
  run(g, 30);
  assert.equal(snapshot(g).time_left_s, 0.5);
  const ev = run(g, 100);
  assert.equal(ev.at(-1).tick, 60);
  assert.deepEqual(ev.at(-1).data, { result: 'lost', reason: 'dawn' });
});

test('AC-19 dựng scenario không phát sự kiện, không cộng điểm', () => {
  const g = game({ lanterns: [{ id: 'L1', lit: true }], shades: [{ pos: [9, 1, 9] }] });
  assert.equal(g.score, 0);
  assert.equal(snapshot(g).lanterns[0].lit, true);
});

test('AC-20 shade_spawned theo lịch và id tự sinh không trùng id scenario', () => {
  const g = createGame({ tuning: T, seed: 7, scenario: { shades: [{ id: 'S1', pos: [30, 1, 0] }] } });
  const ev = run(g, WORLD.shadeFirstSpawnTick).filter((e) => e.name === 'shade_spawned');
  assert.deepEqual(ev.map((e) => [e.tick, e.data.id]), [[WORLD.shadeFirstSpawnTick, 'S2']]);
});

test('AC-21 seed mặc định sinh 30 đom đóm trong đảo, tất định theo seed', () => {
  const a = snapshot(createGame({ tuning: T, seed: 5 }));
  const b = snapshot(createGame({ tuning: T, seed: 5 }));
  const c = snapshot(createGame({ tuning: T, seed: 6 }));
  assert.equal(a.motes_active, WORLD.moteCount);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.motes, c.motes);
  for (const m of a.motes) assert.ok(Math.hypot(m.pos[0], m.pos[2]) <= WORLD.islandRadius);
});
