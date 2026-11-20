// Kiểm chứng end-to-end qua đúng lệnh headless của game.contract.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { headless, listCases, caseArgs, check, readJsonl, ROOT } from './lib/scenarios.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-'));
const out = (n) => path.join(tmp, n);
const writeJson = (n, obj) => { const f = out(n); fs.writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj)); return f; };

for (const name of listCases()) {
  test(`scenario ${name}`, () => {
    const o = out(`${name}.jsonl`);
    const { args } = caseArgs(name, o);
    const r = headless(args);
    assert.equal(r.code, 0, r.stderr);
    const lines = readJsonl(o);
    const { c } = caseArgs(name, o);
    const fails = check(lines, c.expect).filter((x) => !x.ok);
    assert.deepEqual(fails, []);
  });
}

test('định dạng output: snapshot tick 0 đầu tiên, end ở dòng cuối, snapshot mỗi --snapshot-every', () => {
  const o = out('fmt.jsonl');
  assert.equal(headless(['--seed', '3', '--night', '1', '--ticks', '95', '--out', o, '--snapshot-every', '20']).code, 0);
  const lines = readJsonl(o);
  assert.equal(lines[0].type, 'snapshot');
  assert.equal(lines[0].tick, 0);
  assert.deepEqual(lines.filter((l) => l.type === 'snapshot').map((l) => l.tick), [0, 20, 40, 60, 80]);
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 95, state: 'playing', score: 0 });
  assert.deepEqual(lines[1], { type: 'event', tick: 1, name: 'night_start', data: { night: 1 } });
  for (const s of lines.filter((l) => l.type === 'snapshot')) {
    assert.equal(s.sim_tick, s.tick);
    for (const k of ['state', 'time_left_s', 'score', 'player', 'lanterns', 'shades', 'motes_active']) assert.ok(k in s, k);
  }
});

test('tọa độ làm tròn 3 chữ số thập phân', () => {
  const o = out('round.jsonl');
  const inp = writeJson('round-in.json', { frames: [{ tick: 0, move: [0.3, 0.7], cam_yaw_deg: 33 }] });
  headless(['--seed', '1', '--night', '1', '--inputs', inp, '--ticks', '37', '--out', o]);
  const text = fs.readFileSync(o, 'utf8');
  const decimals = [...text.matchAll(/-?\d+\.(\d+)/g)].map((m) => m[1].length);
  assert.ok(decimals.length > 0 && decimals.every((n) => n <= 3));
});

for (const night of [1, 2, 3]) {
  test(`tính tất định Đêm ${night}: cùng seed + inputs => output giống hệt từng byte`, () => {
    const inp = path.join(ROOT, 'tests', 'fixtures', 'long-inputs.json');
    const run = (n) => {
      const o = out(n);
      assert.equal(headless(['--seed', '2024', '--night', String(night), '--inputs', inp, '--ticks', '6000', '--out', o]).code, 0);
      return fs.readFileSync(o);
    };
    const a = run(`det-${night}a.jsonl`), b = run(`det-${night}b.jsonl`);
    assert.ok(a.equals(b));
    assert.match(a.toString(), /shade_spawned/);
  });
}

test('hiệu năng: một Đêm đầy đủ 21.600 tick chạy xong <= 30 s (cả 3 Đêm)', () => {
  for (const night of [1, 2, 3]) {
    const t0 = Date.now();
    assert.equal(headless(['--seed', '5', '--night', String(night), '--ticks', '21600', '--out', out(`perf${night}.jsonl`)]).code, 0);
    assert.ok(Date.now() - t0 < 30000);
  }
});

test('snapshot v1.1 có đủ trường mới', () => {
  const o = out('v11.jsonl');
  headless(['--seed', '1', '--night', '2', '--ticks', '10', '--out', o]);
  const s = readJsonl(o)[0];
  for (const k of ['night', 'wind', 'motes', 'drifters', 'charms']) assert.ok(k in s, k);
  for (const k of ['vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s']) assert.ok(k in s.player, k);
  assert.deepEqual(Object.keys(s.wind), ['active', 'dir_deg']);
  assert.deepEqual(Object.keys(s.motes[0]), ['id', 'pos', 'kind', 'ttl_s']);
  assert.deepEqual(s.charms[0], { id: 'C1', available: true, respawn_s: 0 });
});

test('--night ngoài 1..3 => mã thoát khác 0; scenario Đêm 3 chấp nhận L7', () => {
  assert.notEqual(headless(['--seed', '1', '--night', '4', '--ticks', '5', '--out', out('x.jsonl')]).code, 0);
  const sc = writeJson('n3.json', { lanterns: [{ id: 'L7', lit: true }], shades: [{ pos: [0, 1, 0], state: 'recoil', state_ticks_left: 5 }] });
  assert.equal(headless(['--seed', '1', '--night', '3', '--scenario', sc, '--ticks', '5', '--out', out('x.jsonl')]).code, 0);
  const bad = writeJson('n3bad.json', { shades: [{ pos: [0, 1, 0], state: 'angry' }] });
  assert.equal(headless(['--seed', '1', '--night', '3', '--scenario', bad, '--ticks', '5', '--out', out('x.jsonl')]).code, 2);
});

test('inputs sai định dạng => mã thoát 2 và thông báo ra stderr', () => {
  const bad = [
    '{not json',
    { frames: 'x' },
    { frames: [{ tick: 5 }, { tick: 5 }] },
    { frames: [{ tick: 0, move: [2, 0] }] },
    { frames: [{ tick: 0, pulse: 'yes' }] },
  ];
  bad.forEach((b, i) => {
    const r = headless(['--seed', '1', '--night', '1', '--inputs', writeJson(`bad${i}.json`, b), '--ticks', '5', '--out', out('x.jsonl')]);
    assert.equal(r.code, 2, `case ${i}`);
    assert.ok(r.stderr.length > 0);
  });
});

test('scenario sai định dạng => mã thoát 2', () => {
  for (const [i, b] of [[0, { lanterns: [{ id: 'L9' }] }], [1, { motes: [[1, 2]] }], [2, []]]) {
    const r = headless(['--seed', '1', '--night', '1', '--scenario', writeJson(`bads${i}.json`, b), '--ticks', '5', '--out', out('x.jsonl')]);
    assert.equal(r.code, 2, `case ${i}`);
  }
});

test('thiếu tham số bắt buộc => mã thoát khác 0', () => {
  assert.notEqual(headless(['--seed', '1', '--night', '1', '--ticks', '5']).code, 0);
});

test('game.contract.json đủ trường bắt buộc', () => {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));
  assert.equal(c.contract_version, '1.1');
  for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd']) assert.equal(typeof c[k], 'string');
  const keys = ['player_speed', 'carry_capacity', 'lantern_cost', 'lantern_count_night1', 'pickup_radius', 'interact_radius',
    'pulse_cost', 'pulse_radius', 'night1_duration_s', 'flames', 'invuln_s', 'hit_drop_ratio', 'pulse_stun_s',
    'pulse_push_m', 'pulse_cooldown_s', 'safe_radius', 'shade_speed', 'shade_hit_radius', 'fall_enabled',
    'dash_speed', 'dash_duration_s', 'dash_cooldown_s', 'night2_duration_s', 'night3_duration_s'];
  for (const k of keys) assert.ok(k in c.tuning, k);
  assert.equal(c.tuning.lantern_count_night1, 5);
  for (const k of ['per_mote', 'per_lantern', 'per_stun', 'per_second_left', 'per_flame_left']) assert.equal(typeof c.tuning.score[k], 'number');
});
