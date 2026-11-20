// Unit test lõi mô phỏng — Contract v1.2 (Ticket-03 "Đèn cạn dầu"). Mã AC khớp docs/notes/phase-3.md.
// Test Phase 1-2 bị luật mới thay thế đã được sửa (ghi "[P3 đổi]" kèm lý do) thay vì xóa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGame, step, snapshot, STD, fuelOf, playerCapacity, winThreshold, carryCapacity, reachesLantern } from '../src/core/sim.js';
import { getMap } from '../src/core/maps.js';

const T = JSON.parse(fs.readFileSync(new URL('../game.contract.json', import.meta.url))).tuning;
const IDLE = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
const NO = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false };
const game = (scenario = {}, night = 1, seed = 1) => createGame({ tuning: T, seed, night, scenario: { ...NO, ...scenario } });
const run = (g, n, input = IDLE) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...step(g, input)); return ev; };
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const LIT = (fuel = 100, id = 'L1') => ({ id, lit: true, fuel });
const ALL_LIT = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => LIT(100, id)); // không còn đèn tắt/yếu để Bóng Mực nhắm

test('[P4 đổi] Số chuẩn Ticket-02 + Ticket-03 khớp game.contract.json v1.3 (không số nào đổi ở Ticket-04)', () => {
  const contract = JSON.parse(fs.readFileSync(new URL('../game.contract.json', import.meta.url)));
  // Ticket-04 mục 6: contract_version "1.3"; tuning giữ nguyên số của v1.2.
  assert.equal(contract.contract_version, '1.3');
  const want = { player_speed: 6, carry_capacity: 10, lantern_cost: 10, interact_radius: 2, pulse_cost: 3, pulse_radius: 5,
    pulse_cooldown_s: 3, pulse_stun_s: 2, pulse_push_m: 4, safe_radius: 6, shade_speed: 4, shade_hit_radius: 1, invuln_s: 1.5,
    hit_drop_ratio: 0.5, flames: 3, fall_enabled: true, dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5,
    // Ticket-03 mục 3: 240/270/300 (thay 300/330/360)
    night1_duration_s: 240, night2_duration_s: 270, night3_duration_s: 300,
    // Ticket-03 mục 7
    fuel_max: 100, fuel_decay_per_s: 1.0, fuel_per_mote: 10, relight_cost: 5, win_ratio: 0.6,
    drain_per_s: 5, low_fuel_threshold: 30, capacity_max: 20 };
  for (const [k, v] of Object.entries(want)) assert.equal(T[k], v, k);
  // Ticket-03 mục 5: công thức điểm mới (không còn thưởng thời gian)
  assert.deepEqual(T.score, { per_mote: 5, per_lantern: 100, per_relight: 40, per_stun: 5, per_stun_bonus: 10,
    per_lantern_left: 50, per_fuel_left: 1, per_flame_left: 50 });
  assert.equal(T.score.per_second_left, undefined);
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

test('[P3 đổi] AC-L1 tương tác: đèn chưa sáng gần nhất, bằng nhau thì id nhỏ hơn; nạp nhiều lần, đèn nhớ tiến độ; đủ 10 thì thắp', () => {
  const g = game({ player: { carried: 4 }, lanterns: [{ id: 'L2', pos: [1.5, 0, 0] }, { id: 'L1', pos: [-1.5, 0, 0] }] });
  const e1 = run(g, 1, { ...IDLE, interact: true });
  assert.deepEqual(e1.find((e) => e.name === 'deposit').data, { lantern_id: 'L1', amount: 4, deposited: 4 });
  assert.ok(!e1.some((e) => e.name === 'lantern_lit'), 'chưa đủ 10 thì chưa thắp');
  g.player.carried = 10;
  run(g, 1);
  const e2 = run(g, 1, { ...IDLE, interact: true });
  assert.deepEqual(e2.find((e) => e.name === 'deposit').data, { lantern_id: 'L1', amount: 6, deposited: 10 });
  assert.deepEqual(e2.find((e) => e.name === 'lantern_lit').data, { lantern_id: 'L1', relight: false });
  assert.equal(g.player.carried, 4);
  assert.equal(snapshot(g).lanterns[0].fuel, 100);
});

test('[P3 đổi] AC-L2 điểm +5 mỗi đom đóm NẠP; thắp lần đầu +100', () => {
  const g = game({ motes: [[0, 0, 0]], player: { carried: 11 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }] });
  run(g, 1);
  assert.equal(g.score, 0, 'nhặt không có điểm');
  run(g, 1, { ...IDLE, interact: true });
  assert.equal(g.score, 150, '10 × 5 + 100');
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

test('[P3 đổi] AC-S3 phát hiện 12 m, bỏ đuổi > 18 m; wander (không có đèn) lượn vòng 2 m', () => {
  // wander không có đèn để nhắm → lượn vòng 2 m quanh anchor
  const g = game({ player: { pos: [0, 0, -35] }, lanterns: ALL_LIT, shades: [{ pos: [12.5, 1, 0] }] });
  run(g, 60);
  assert.equal(g.shades[0].state, 'wander');
  assert.ok(Math.hypot(g.shades[0].pos[0] - 10.5, g.shades[0].pos[2]) <= 2 + 1e-6);
  // Mây xuất hiện trong 12 m → chase ngay tick kế
  const g2 = game({ player: { pos: [12.5, 0, -5] }, lanterns: ALL_LIT, shades: [{ pos: [12.5, 1, 0] }] });
  step(g2, IDLE);
  assert.equal(g2.shades[0].state, 'chase');
  // Đưa Mây ra xa > 18 m → về wander
  g2.player.pos = [-20, 0, 0];
  step(g2, IDLE);
  assert.equal(g2.shades[0].state, 'wander');
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
  const lanterns = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => LIT(100, id));
  const g = game({ player: { flames: 0 }, lanterns });
  assert.deepEqual(run(g, 1).at(-1).data, { result: 'lost', reason: 'no_flames' });
});

test('[P3 đổi] AC-W3 thắp đủ đèn KHÔNG kết thúc Đêm (không còn thắng sớm all_lit)', () => {
  const lanterns = ['L1', 'L2', 'L3', 'L4'].map((id) => LIT(100, id));
  const g = game({ time_left_s: 100, player: { carried: 10 }, lanterns: [...lanterns, { id: 'L5', pos: [0, 0, 2] }] });
  const ev = run(g, 1, { ...IDLE, interact: true });
  assert.ok(ev.some((e) => e.name === 'lantern_lit'));
  assert.ok(!ev.some((e) => e.name === 'game_over'));
  assert.equal(g.state, 'playing');
});

test('[P3 mới] AC-W4 bình minh: thắng dawn_survived khi số đèn sáng ≥ ceil(0.6 × tổng đèn)', () => {
  // Đêm 1 = 5 đèn; scenario.lanterns thay thế danh sách mặc định nên phải khai báo đủ 5 (đèn tắt khai báo không lit).
  const n1 = (lit) => ['L1', 'L2', 'L3', 'L4', 'L5'].map((id, i) => (i < lit ? LIT(100, id) : { id }));
  const g = game({ time_left_s: 1 / 60, lanterns: n1(3) });
  const ev = run(g, 2);
  assert.deepEqual(ev.filter((e) => e.name === 'game_over').at(-1).data, { result: 'won', reason: 'dawn_survived' });
  // 2/5 đèn (< 3) thì thua dawn
  const g2 = game({ time_left_s: 1 / 60, lanterns: n1(2) });
  const ev2 = run(g2, 2);
  assert.deepEqual(ev2.filter((e) => e.name === 'game_over').at(-1).data, { result: 'lost', reason: 'dawn' });
});

test('[P3 mới] AC-W5 ngưỡng thắng theo Đêm: 3/5, 4/6, 5/7', () => {
  assert.equal(winThreshold(T, 5), 3);
  assert.equal(winThreshold(T, 6), 4);
  assert.equal(winThreshold(T, 7), 5);
  for (const [night, n] of [[1, 5], [2, 6], [3, 7]]) {
    const ids = Array.from({ length: n }, (_, i) => `L${i + 1}`);
    const need = Math.ceil(0.6 * n);
    const g = game({ time_left_s: 1 / 60, lanterns: ids.map((id, i) => (i < need ? LIT(100, id) : { id })) }, night);
    assert.equal(run(g, 2).filter((e) => e.name === 'game_over').at(-1).data.reason, 'dawn_survived', `Đêm ${night}`);
  }
});

test('[P3 mới] AC-W6 thua no_flames ngay cả ở tick bình minh (no_flames trước mọi thứ)', () => {
  const lanterns = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => LIT(100, id));
  const g = game({ player: { flames: 0 }, time_left_s: 1 / 60, lanterns });
  assert.deepEqual(run(g, 2).filter((e) => e.name === 'game_over').at(-1).data, { result: 'lost', reason: 'no_flames' });
});

test('[P3 mới] AC-K1 sức chứa = 10 + 2 × successful_lights, tối đa 20; đèn đặt sẵn không tính', () => {
  assert.equal(carryCapacity(T, 0), 10);
  assert.equal(carryCapacity(T, 1), 12);
  assert.equal(carryCapacity(T, 5), 20);
  assert.equal(carryCapacity(T, 99), 20);
  const preset = game({ lanterns: ['L1', 'L2', 'L3'].map((id) => LIT(100, id)) });
  assert.equal(preset.lanterns.length, 5, 'scenario.lanterns cập nhật theo id, không thay danh sách (contract mục D)');
  assert.equal(playerCapacity(preset), 10, 'đèn scenario không cộng sức chứa');
  // nhặt được tới 12 sau khi thắp 1 đèn
  const g = game({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }], motes: [[0, 0, 0.2], [0, 0, 0.3]] });
  run(g, 1, { ...IDLE, interact: true });
  assert.equal(g.player.successfulLights, 1);
  assert.equal(snapshot(g).player.capacity, 12);
  run(g, 1);
  assert.equal(g.player.carried, 2, 'nhặt 2 đom đóm nhờ sức chứa 12');
});

test('[P3 mới] AC-F1 dầu: đèn sáng hao đúng 1/60 mỗi tick, khi cạn thì tắt + lantern_out + đồng hồ dầu về 0', () => {
  const g = game({ lanterns: [LIT(1)] });      // 1.0 dầu = 60 đơn vị
  // Ticket-03: bước 2 trừ dầu ở mọi tick: tick 1..59 hao 59 → còn 1; tick 60 cạn.
  run(g, 59);
  assert.ok(g.lanterns[0].lit);
  assert.equal(g.lanterns[0].fuel100, 1);
  const ev = run(g, 1);
  assert.equal(g.lanterns[0].lit, false);
  assert.equal(g.lanterns[0].everLit, true);
  assert.equal(g.lanterns[0].deposited, 0);
  assert.equal(fuelOf(g.lanterns[0]), 0);
  assert.deepEqual(ev.map((e) => e.name + ':' + JSON.stringify(e.data)), ['lantern_out:{"lantern_id":"L1"}']);
});

test('[P3 mới] AC-F2 châm dầu: used = min(đang mang, ceil((100 − fuel)/10)), fuel = min(100, fuel + 10 used)', () => {
  const g = game({ player: { pos: [0, 0, 1.5], carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }] });
  const ev = run(g, 1, { ...IDLE, interact: true });
  const ref = ev.find((e) => e.name === 'refuel');
  assert.equal(ref.data.lantern_id, 'L1');
  // bước 2 hao 1/60 trước bước 5 (châm): ceil((100 − 19.983)/10) = 9
  assert.equal(ref.data.amount, 9);
  assert.equal(ref.data.fuel, 100);
  assert.equal(g.player.carried, 1);
  assert.equal(g.score, 9 * 5);
  // đang mang ít hơn nhu cầu
  const g2 = game({ player: { pos: [0, 0, 1.5], carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 50 }] });
  const r2 = run(g2, 1, { ...IDLE, interact: true }).find((e) => e.name === 'refuel');
  assert.equal(r2.data.amount, 3);
  assert.equal(r2.data.fuel, 80);          // 49.983 + 30 = 79.983 -> xuất 1 chữ số: 80
  assert.equal(g2.lanterns[0].fuel100, 4799); // giá trị nội bộ giữ nguyên đơn vị 1/60
});

test('[P3 mới] AC-F3 đèn đầy dầu (used = 0) không được chọn, không phát sự kiện, không cộng điểm', () => {
  // Bước 2 luôn hao trước bước 5, nên đèn chỉ "đầy" ngay trong tick nó vừa được thắp. Kiểm bằng chọn đèn:
  // đèn đầy không được chọn, đèn tắt ở xa hơn vẫn được chọn (ticket: "chỉ xét đèn nhận được").
  const full = { lit: true, fuel100: 100 * 60 };
  assert.equal(reachesLantern(full, 100), false);
  assert.equal(reachesLantern({ lit: true, fuel100: 100 * 60 - 1 }, 100), true);
  const g = game({ player: { pos: [0, 0, 0], carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 0.5], lit: true, fuel: 100 }, { id: 'L2', pos: [0, 0, 1.5] }] });
  g.lanterns[0].fuel100 = 100 * 60 + 1; // bù đúng 1 đơn vị hao của bước 2 -> tới bước 5 vẫn đầy 100
  const ev = run(g, 1, { ...IDLE, interact: true });
  assert.ok(!ev.some((e) => e.name === 'refuel'), 'đèn đầy không phát refuel');
  assert.equal(ev.find((e) => e.name === 'deposit').data.lantern_id, 'L2', 'chọn đèn nhận được dù xa hơn');
});

test('[P3 mới] AC-F4 thắp lại: đèn đã từng sáng (ever_lit) chỉ cần 5 đom đóm, +40 điểm, relight: true, relit_count tăng', () => {
  const g = game({ player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], ever_lit: true }] });
  const ev = run(g, 1, { ...IDLE, interact: true });
  const lit = ev.find((e) => e.name === 'lantern_lit');
  assert.deepEqual(lit.data, { lantern_id: 'L1', relight: true });
  assert.equal(g.player.carried, 0);
  assert.equal(g.score, 40 + 5 * 5, '40 + 5 đom đóm × 5');
  assert.equal(g.lanterns[0].relitCount, 1);
  assert.equal(fuelOf(g.lanterns[0]), 100);
  // đèn chưa từng sáng thì vẫn cần 10
  const g2 = game({ player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }] });
  assert.ok(!run(g2, 1, { ...IDLE, interact: true }).some((e) => e.name === 'lantern_lit'));
});

test('[P3 mới] AC-DR1 Bóng Mực wander nhắm đèn yếu gần nhất rồi chuyển drain, hút 5 fuel/giây', () => {
  // Đèn yếu L1 fuel 50 ở (10,0,0); Mây ở xa (>12 m) để không bị chase. Bóng Mực khởi đầu gần đèn.
  const g = game({ player: { pos: [0, 0, -100] }, lanterns: [{ id: 'L1', pos: [10, 0, 0], lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [11, 1, 0] }] });
  run(g, 1);
  assert.equal(g.shades[0].state, 'drain');
  assert.equal(g.shades[0].target, 'L1');
  const f0 = g.lanterns[0].fuel100;
  run(g, 1);
  // tick đó: hao 1 + hút 5 = 6 đơn vị 1/60
  assert.equal(g.lanterns[0].fuel100, f0 - 6, 'hao 1 + hút 5 = 6 đơn vị 1/60 mỗi tick');
});
test('[P3 mới] AC-DR2 nhiều Bóng Mực drain cộng dồn; fuel_drain ghi mỗi 60 tick', () => {
  const g = game({ player: { pos: [0, 0, -100] }, lanterns: [{ id: 'L1', pos: [10, 0, 0], lit: true, fuel: 20 }],
    shades: [{ id: 'S1', pos: [10.5, 1, 0] }, { id: 'S2', pos: [9.5, 1, 0] }] });
  step(g, IDLE);
  assert.deepEqual(g.shades.map((s) => s.state), ['drain', 'drain']);
  const f0 = g.lanterns[0].fuel100;
  step(g, IDLE);
  // hao 1 + hút 5 + hút 5 = 11 đơn vị 1/60 (2 con cùng drain cộng dồn)
  assert.equal(g.lanterns[0].fuel100, f0 - 11);
});
test('[P3 mới] AC-DR3 đèn có fuel < 30 mất vùng an toàn; đúng 30 thì vẫn còn', () => {
  // Đặt Bóng Mực sát đèn (5.5,1,0). Đèn fuel 30 → còn safe zone. Tick 1: chase bị chặn ở 6.001.
  // fuel 30 + 1/60: sau bước 2 của tick 1 còn ĐÚNG 30.0 khi Bóng Mực di chuyển ở bước 8
  const g30 = game({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 30 + 1 / 60 }], shades: [{ id: 'S1', pos: [5.5, 1, 0] }] });
  step(g30, IDLE);
  assert.ok(Math.abs(g30.shades[0].pos[0] - 6.001) < 0.05, 'đèn fuel = 30: chặn ở 6.001; thực tế ' + g30.shades[0].pos[0]);
  // Đèn fuel 29: mất vùng an toàn → Bóng Mực đi vào 5.5 m quanh đèn → vào drain
  const g29 = game({ player: { pos: [0, 0, -100] }, lanterns: [{ id: 'L1', pos: [10, 0, 0], lit: true, fuel: 29 }], shades: [{ id: 'S1', pos: [10.5, 1, 0] }] });
  step(g29, IDLE);
  assert.equal(g29.shades[0].state, 'drain');
});
test('[P3 mới] AC-DR4 drain → chase khi Mây vào 6 m; drain → stunned khi Tỏa Sáng (+5 +15)', () => {
  // Mây ở (10,0,5) → cách shade 4 m; vẫn đứng trong 6 m quanh đèn (10,0,0)
  const g = game({ player: { pos: [10, 0, 5] }, lanterns: [{ id: 'L1', pos: [10, 0, 0], lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [10, 1, 1], state: 'drain', target_lantern_id: 'L1' }] });
  step(g, IDLE);
  assert.equal(g.shades[0].state, 'chase');
  // drain → stunned khi Tỏa Sáng: Mây mang 10 đom đóm, shade trong 4 m
  const g2 = game({ player: { pos: [10, 0, 4], carried: 10 }, lanterns: [{ id: 'L1', pos: [10, 0, 0], lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [10, 1, 2], state: 'drain', target_lantern_id: 'L1' }] });
  const ev = step(g2, { ...IDLE, pulse: true });
  assert.equal(g2.shades[0].state, 'stunned');
  // Hai đèn có thể cùng sáng — nếu cấu hình chỉ có 1 đèn thì +25 từ Tỏa Sáng. Tổng thực tế bám theo cấu hình test.
  assert.equal(g2.score, 15, 'Ticket-03: tổng +15 khi trúng Bóng Mực đang drain');
  assert.ok(ev.some((e) => e.name === 'pulse'));
});
test('[P3 mới] AC-DR5 châm dầu lên ≥ 30 khi có Bóng Mực trong 6 m: bị đẩy ra mép và không sát thương', () => {
  // Player at (2, 0, 0) < 6 m from đèn ở (0,0,0); carry 10; Bóng Mực đang drain ở (1, 1, 0).
  const g = game({ player: { pos: [2, 0, 0], carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }],
    shades: [{ id: 'S1', pos: [1, 1, 0], state: 'drain', target_lantern_id: 'L1' }] });
  const ev = step(g, { ...IDLE, interact: true });
  assert.ok(ev.some((e) => e.name === 'refuel'));
  assert.ok(g.lanterns[0].fuel100 / 60 >= 30, 'fuel ≥ 30 sau châm');
  for (let i = 0; i < 40; i++) step(g, IDLE);
  assert.ok(!ev.some((e) => e.name === 'player_hit'));
  assert.ok(Math.hypot(g.shades[0].pos[0], g.shades[0].pos[2]) >= 6 - 0.05, 'bị đẩy ra ngoài 6 m, thực tế ' + Math.hypot(g.shades[0].pos[0], g.shades[0].pos[2]));
});
test('[P3 mới] AC-SC1 điểm bình minh: mỗi đèn sáng +50 + floor(fuel), mỗi Ngọn Lửa +50, không thưởng thời gian', () => {
  // 3 đèn sáng với fuel 41.5 / 100 / 20 và 2 Ngọn Lửa còn lại; thời gian còn 0.5 s
  const lanterns = [
    { id: 'L1', lit: true, fuel: 41.5 }, { id: 'L2', lit: true, fuel: 100 }, { id: 'L3', lit: true, fuel: 20 },
  ];
  // Bình minh phải tới sau nhiều hơn 1 tick để mọi cập nhật của tick đó đi xong (theo mục 3 ticket).
  const g = game({ time_left_s: 2 / 60, player: { flames: 2 }, lanterns });
  const ev = run(g, 3);
  const over = ev.filter((e) => e.name === 'game_over').at(-1);
  assert.equal(over.data.reason, 'dawn_survived');
  // tick 1 không hao; tick 2 hao 1 → L1 = 41.483 → 41; L2 = 99.983 → 99; L3 = 19.983 → 19
  // = 3×50 (đèn) + (41+99+19) + 2×50 (Ngọn Lửa) = 409, không có thưởng thời gian.
  assert.equal(g.score, 409);
});

test('[P3 mới] AC-SC2 Tỏa Sáng trúng Bóng Mực thường vẫn +5 (không cộng thưởng drain)', () => {
  const g = game({ player: { carried: 6 }, shades: [{ pos: [2, 1, 0] }] });
  run(g, 1, { ...IDLE, pulse: true });
  assert.equal(g.score, 5);
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

test('[P3 đổi] AC-N2 Ngọn Lửa hồi đầy đầu mỗi Đêm; thời lượng 240/270/300', () => {
  for (const [n, t] of [[1, 240], [2, 270], [3, 300]]) {
    const s = snapshot(createGame({ tuning: T, seed: 1, night: n }));
    assert.equal(s.player.flames, 3); assert.equal(s.time_left_s, t); assert.equal(s.night, n);
    assert.equal(s.player.capacity, 10);
    for (const l of s.lanterns) assert.deepEqual(Object.keys(l), ['id', 'pos', 'lit', 'deposited', 'fuel', 'ever_lit', 'relit_count']);
  }
});
