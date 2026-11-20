// Test Phase 4 (Ticket-04): cảnh benchmark, thống kê khung hình, soak, bảng xếp hạng, gán phím.
// Mã AC khớp docs/notes/phase-4.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createBenchGame, benchStep, benchTick, orbitCamera, BENCH_SHADES, BENCH_MOTES, WARMUP_S, ORBIT_PERIOD_S } from '../src/core/bench.js';
import { frameStats } from '../src/core/benchstats.js';
import { runSoak, soakInput, SOAK_INPUT, DIR_SWITCH_TICKS } from '../src/core/soak.js';
import { normalizeName, finalScore, sortEntries, addEntry, topEntries, parseLeaderboard, isoLocal, LEADERBOARD_MAX } from '../src/core/leaderboard.js';
import { createGame, step, playerCapacity } from '../src/core/sim.js';
import { DEFAULT_KEYS, ACTIONS, loadSettings, assignKey, findConflicts, restoreDefaultKeys, keyLabel } from '../web/settings.js';
import { ROOT } from './lib/scenarios.js';

const T = JSON.parse(fs.readFileSync(new URL('../game.contract.json', import.meta.url))).tuning;
const IDLE = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
const runCli = (file, args) => spawnSync(process.execPath, [path.join(ROOT, file), ...args], { encoding: 'utf8', cwd: ROOT });
// Chạy ĐÚNG lệnh trong contract (vd. soak_cmd = "node --jitless --max-semi-space-size=1 src/soak.js"): giữ cờ node,
// vì ngưỡng RSS ×1.2 của Ticket-04 đo với các cờ này. Gọi `node src/soak.js` trần làm RSS ×1.25 -> exit 1 (CI đỏ).
const CONTRACT = JSON.parse(fs.readFileSync(new URL('../game.contract.json', import.meta.url)));
const runContractCmd = (key, args) => {
  const [bin, ...rest] = CONTRACT[key].split(/\s+/);
  assert.equal(bin, 'node', `${key} phải bắt đầu bằng node`);
  const script = rest.pop();
  return spawnSync(process.execPath, [...rest, path.join(ROOT, script), ...args], { encoding: 'utf8', cwd: ROOT });
};

test('AC-BENCH1 cảnh chuẩn: 200 Bóng Mực wander, 100 đom đóm, L1–L3 sáng fuel 100, không diễn ra kết thúc Đêm', () => {
  const g = createBenchGame({ tuning: T, seed: 42 });
  assert.equal(g.shades.length, BENCH_SHADES);
  assert.equal(g.motes.length, BENCH_MOTES);
  assert.deepEqual(g.lanterns.map((l) => l.lit), [true, true, true, false, false]);
  for (const l of g.lanterns.slice(0, 3)) assert.equal(l.fuel100, T.fuel_max * 60);
  assert.ok(g.shades.every((s) => s.state === 'wander'));
  const before = g.shades.map((s) => [...s.pos]);
  for (let k = 0; k < 600; k++) benchStep(g);
  assert.ok(g.shades.some((s, i) => Math.hypot(s.pos[0] - before[i][0], s.pos[2] - before[i][2]) > 0.5), 'Bóng Mực vẫn wander');
});

test('AC-BENCH2 cảnh chuẩn: không sinh thêm, không nhặt đom đóm, không mất lửa, không hao dầu, không kết thúc', () => {
  const g = createBenchGame({ tuning: T, seed: 42 });
  for (let k = 0; k < 60 * 20; k++) benchStep(g);   // 20 s
  assert.equal(g.steps, 1200);
  assert.equal(g.state, 'playing');
  assert.equal(g.motes.length, BENCH_MOTES);
  assert.equal(g.shades.length, BENCH_SHADES);
  assert.equal(g.player.carried, 0);
  assert.equal(g.score, 0);
  assert.deepEqual(g.lanterns.slice(0, 3).map((l) => l.fuel100), [6000, 6000, 6000]);
  assert.equal(g.lanterns.filter((l) => l.lit).length, 3);
});

test('AC-BENCH3 thực thể không sát thương: đứng giữa 200 Bóng Mực vẫn không mất Ngọn Lửa, kể cả chạy lâu', () => {
  const g = createBenchGame({ tuning: T, seed: 42 });
  const flames = g.player.flames;
  for (let k = 0; k < 60 * 30; k++) benchTick(g);
  assert.equal(g.player.flames, flames);
  // 200 Bóng Mực ở vòng 5 m quanh tâm luôn có con trong tầm 12 m: nếu có sát thương thì đã mất lửa.
  assert.ok(g.shades.some((s) => Math.hypot(s.pos[0] - g.player.pos[0], s.pos[2] - g.player.pos[2]) < 12));
  // Lõi giảm `invuln` mỗi tick: nếu chỉ đặt một lần thì hết sau vài triệu tick; benchTick giữ bất tử vô hạn
  // (giá trị luôn > 0 sau mỗi tick, kể cả chạy thêm 50 phút).
  for (let k = 0; k < 3000; k++) { benchTick(g); assert.ok(g.player.invuln > 0); }
  assert.equal(g.player.flames, flames);
});

test('AC-BENCH8 bất biến cảnh bench: vị trí Mây đứng yên ở (0,0,0) và không nhặt đom đóm trong nhiều phút', () => {
  const g = createBenchGame({ tuning: T, seed: 42 });
  for (let k = 0; k < 60 * 120; k++) benchTick(g);   // 2 phút
  assert.deepEqual(g.player.pos, [0, 0, 0]);
  assert.equal(g.player.carried, 0);
  assert.equal(g.motes.length, BENCH_MOTES);
  assert.equal(g.state, 'playing');
  assert.equal(playerCapacity(g), 0);
});

test('AC-BENCH4 cảnh bench không đụng luật gameplay thường (output headless giữ nguyên)', () => {
  const g = createGame({ tuning: T, seed: 42, night: 1 });
  assert.equal(g.bench, undefined);
  // Game thường vẫn dùng trần gameplay: 20 đom đóm lúc đầu, 2 Bóng Mực ở tick 300.
  assert.equal(g.motes.length, 20);
  for (let k = 0; k < 300; k++) step(g, IDLE);
  assert.equal(g.shades.length, 2);
  assert.equal(g.state, 'playing');
});

test('AC-BENCH5 camera quỹ đạo: (30,15,0) ở 0°, ngược chiều kim đồng hồ nhìn từ trên xuống, 15 s/vòng, luôn nhìn (0,0,0)', () => {
  assert.deepEqual(orbitCamera(0).pos, [30, 15, 0]);
  assert.deepEqual(orbitCamera(0).look, [0, 0, 0]);
  const q = orbitCamera(ORBIT_PERIOD_S / 4).pos;
  // Quy ước góc của lab (Ticket-02): 90° = +Z (đèn L2 (23.8,0,7.7) ở 18°; tầng 1 Đêm 3 "z > 0" ở 20°–160°).
  assert.ok(Math.abs(q[0]) < 1e-9 && Math.abs(q[2] - 30) < 1e-9 && Math.abs(q[1] - 15) < 1e-9, JSON.stringify(q));
  const p2 = orbitCamera(ORBIT_PERIOD_S).pos;
  assert.ok(Math.abs(p2[0] - 30) < 1e-9 && Math.abs(p2[2]) < 1e-9);
  assert.equal(WARMUP_S, 3);
});

test('AC-BENCH6 frameStats theo công thức Ticket-04 (avg, p1, p95) và ổn định', () => {
  const dts = Array.from({ length: 100 }, (_, i) => 10 + (i % 5));
  const s = frameStats(dts);
  assert.equal(s.frames, 100);
  const sum = dts.reduce((a, b) => a + b, 0);
  assert.equal(s.avg_fps, Math.round(((1000 * 100) / sum) * 10) / 10);
  const worst = Math.max(...dts);
  assert.equal(s.p1_low_fps, Math.round((1000 / worst) * 10) / 10);   // k = ceil(1) = 1
  assert.equal(s.frame_ms_p95, 14);
  // k = max(1, ceil(0.01 N)): N = 250 -> k = 3
  const d = [...Array(250).keys()].map((i) => i + 1);
  const st = frameStats(d);
  assert.equal(st.p1_low_fps, Math.round((1000 / ((250 + 249 + 248) / 3)) * 10) / 10);
  assert.equal(frameStats([]).frames, 0);
});

test('AC-SOAK1 soak: Đêm i xoay vòng 1→2→3 và dùng seed + i', () => {
  const seen = [];
  const res = runSoak({ tuning: T, seed: 7, nights: 2, warmupNights: 0, mem: () => 10, onNight: (i, n) => seen.push(n.night) });
  assert.deepEqual(seen, [1, 2]);
  assert.equal(res.nights, 2);
  assert.equal(res.crashes, 0);
  assert.equal(res.results.length, 2);
  assert.ok(res.results.every((r) => r === 'won' || r === 'lost'));
  assert.equal(res.mem_start_mb, 10);
});

test('AC-SOAK2 input ngẫu nhiên theo seed: tất định, hướng đổi mỗi 30 tick, xác suất đúng', () => {
  assert.deepEqual(soakInput(7, 0, 5), soakInput(7, 0, 5));
  for (let k = 0; k < 30; k++) assert.deepEqual(soakInput(7, 0, k).move, soakInput(7, 0, 0).move);
  const moves = new Set();
  for (let k = 0; k < 30 * 40; k += 30) moves.add(soakInput(7, 0, k).move.join(','));
  assert.ok(moves.size > 2, 'hướng thay đổi giữa các khối 30 tick');
  let jump = 0, dash = 0, pulse = 0, interact = 0;
  const N = 20000;
  for (let k = 0; k < N; k++) {
    const i = soakInput(7, 0, k);
    jump += i.jump; dash += i.dash; pulse += i.pulse; interact += i.interact;
  }
  assert.ok(Math.abs(jump / N - SOAK_INPUT.jump) < 0.01, `jump ${jump / N}`);
  assert.ok(Math.abs(dash / N - SOAK_INPUT.dash) < 0.01, `dash ${dash / N}`);
  assert.ok(Math.abs(pulse / N - SOAK_INPUT.pulse) < 0.006, `pulse ${pulse / N}`);
  assert.ok(Math.abs(interact / N - SOAK_INPUT.interact) < 0.01, `interact ${interact / N}`);
  assert.equal(DIR_SWITCH_TICKS, 30);
});

test('AC-SOAK3 soak: thiếu cấu hình Đêm 2 -> Đêm đó "crashes", vẫn chạy tiếp Đêm 3 trong cùng tiến trình', () => {
  // Tuning là Proxy: đọc `carry_capacity` ném lỗi ngay bước 4 của tick đầu — mô phỏng "môi trường" hỏng chứ
  // không phải luật sai. Mỗi Đêm văng lỗi đếm là crash; soak vẫn chạy đủ 3 Đêm trong cùng tiến trình.
  const bad = new Proxy({ ...T }, { get: (o, k) => { if (k === 'carry_capacity') throw new Error('môi trường hỏng'); return o[k]; } });
  const res = runSoak({ tuning: bad, seed: 1, nights: 3, maxTicks: 5, warmupNights: 0, mem: () => 5 });
  assert.equal(res.crashes, 3);
  assert.equal(res.results.length, 3);
  assert.ok(res.results.every((r) => r === 'lost'));
});

test('AC-SOAK4 lệnh soak: ghi đúng trường, tất định với cùng seed, mã thoát 0', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-soak-'));
  const a = path.join(dir, 'a.json');
  const b = path.join(dir, 'b.json');
  const r1 = runContractCmd('soak_cmd', ['--seed', '7', '--nights', '6', '--out', a]);
  const r2 = runContractCmd('soak_cmd', ['--seed', '7', '--nights', '6', '--out', b]);
  assert.equal(r1.status, 0, r1.stderr + r1.stdout.split('\n').find((x) => x.startsWith('crashes=')));
  assert.equal(r2.status, 0, r2.stderr + r2.stdout.split('\n').find((x) => x.startsWith('crashes=')));
  const ja = JSON.parse(fs.readFileSync(a, 'utf8'));
  const jb = JSON.parse(fs.readFileSync(b, 'utf8'));
  for (const k of ['nights', 'crashes', 'results', 'mem_start_mb', 'mem_end_mb', 'heap_start_mb', 'heap_end_mb', 'duration_s']) assert.ok(k in ja, k);
  assert.equal(ja.nights, 6);
  assert.deepEqual(ja.results, jb.results);
  assert.equal(ja.ticks, jb.ticks, 'cùng seed + cùng input => cùng số tick');
  assert.equal(ja.crashes, 0);
  // soak.json trong repo là lệnh chuẩn --nights 10; số Đêm/kết quả/ticks phải khớp (mem và duration_s đổi theo máy).
  const repo = JSON.parse(fs.readFileSync(path.join(ROOT, 'soak.json'), 'utf8'));
  assert.equal(repo.nights, 10);
  assert.equal(repo.crashes, 0);
  assert.equal(repo.results.length, 10);
  assert.ok(repo.results.every((r) => r === 'won' || r === 'lost'));
  assert.ok(repo.ticks > 0);
  assert.ok(repo.mem_end_mb <= 1.2 * repo.mem_start_mb, 'soak.json đạt đúng ngưỡng Ticket-04: mem_end <= 1.2 x mem_start (không nới)');
  assert.equal(repo.warmup_nights, 0, 'không có Đêm khởi động ẩn trước khi đo mem_start');
});

test('AC-BENCH7 lệnh bench: ghi bench.json theo hợp đồng, tất định, mã thoát 0', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));
  const f = path.join(dir, 'bench.json');
  const r = runCli('src/bench.js', ['--seed', '42', '--duration', '2', '--out', f]);
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const k of ['contract_version', 'avg_fps', 'p1_low_fps', 'frame_ms_p95', 'frames', 'load_ms', 'peak_mem_mb', 'vsync_off', 'renderer', 'os']) assert.ok(k in j, k);
  assert.equal(j.contract_version, '1.3');
  assert.equal(j.frames, 120);
  assert.ok(j.avg_fps >= 60);
  assert.ok(j.load_ms <= 10000);
  const repo = JSON.parse(fs.readFileSync(path.join(ROOT, 'bench.json'), 'utf8'));
  assert.equal(repo.contract_version, '1.3');
  assert.ok(repo.avg_fps >= 60 && repo.p1_low_fps >= 30 && repo.load_ms <= 10000, 'bench.json trong repo phải đạt ngưỡng');
});

test('AC-LB1 tên: 3–12 ký tự, A–Z a–z 0–9 _, chữ Việt có dấu được', () => {
  for (const ok of ['abc', 'A_1', 'Mây_K5', 'NguyễnVănA', 'a'.repeat(12)]) assert.equal(normalizeName(ok).ok, true, ok);
  for (const bad of ['ab', 'a'.repeat(13), 'a b', 'a-b', '', '   ', '🙂🙂🙂']) assert.equal(normalizeName(bad).ok, false, JSON.stringify(bad));
  assert.equal(normalizeName('  Mây  ').name, 'Mây');
});

test('AC-LB2 mục: name, score, nights_won 0–3, achieved_at ISO 8601 có múi giờ, seed', () => {
  const now = new Date('2026-11-20T15:04:05Z');
  assert.match(isoLocal(now), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  assert.equal(finalScore([1200, 900, 1100]).score, 3200);
  assert.equal(finalScore([1200, 900, 1100]).nights_won, 3);
  assert.equal(finalScore([1200, 0, 0]).nights_won, 1);
  assert.equal(finalScore([0, 0, 0]).nights_won, 0);
});

test('AC-LB3 sắp xếp: score giảm dần; bằng điểm ai đạt trước đứng trên; giữ top 10; trùng thì sau', () => {
  const e = (name, score, at) => ({ name, score, nights_won: 1, achieved_at: at, seed: 1 });
  const list = [e('Binh', 500, '2026-11-20T10:00:00+07:00'), e('An', 500, '2026-11-20T09:00:00+07:00'), e('Cuong', 900, '2026-11-20T11:00:00+07:00')];
  assert.deepEqual(topEntries(list).map((x) => x.name), ['Cuong', 'An', 'Binh']);
  let all = [];
  for (let i = 0; i < 15; i++) all = addEntry(all, e(`P${String(i).padStart(2, '0')}`, 100 + i, `2026-11-20T10:00:${String(i).padStart(2, '0')}+07:00`));
  assert.equal(topEntries(all).length, LEADERBOARD_MAX);
  assert.equal(topEntries(all)[0].score, 114);
  assert.equal(topEntries(all).at(-1).score, 105);
  assert.deepEqual(sortEntries(list), sortEntries([...list].reverse()));
});

test('AC-LB4 đọc tệp hỏng/thiếu: coi như rỗng; lọc mục sai định dạng; giữ nhiều hơn 10 trong tệp', () => {
  assert.deepEqual(parseLeaderboard('not json'), []);
  assert.deepEqual(parseLeaderboard(null), []);
  assert.deepEqual(parseLeaderboard({ entries: [{ name: 'ok', score: 1, nights_won: 1, achieved_at: '2026-11-20T10:00:00+07:00', seed: 1 }, { name: 'x', score: -1, nights_won: 1, achieved_at: 'bad', seed: 1 }] }).length, 1);
  let all = [];
  for (let i = 0; i < 40; i++) all = addEntry(all, { name: `N${String(i).padStart(2, '0')}`, score: i, nights_won: 1, achieved_at: `2026-11-20T10:00:${String(i % 60).padStart(2, '0')}+07:00`, seed: 1 });
  assert.ok(all.length > LEADERBOARD_MAX, 'tệp giữ thêm để 3 mục của một ván không đẩy mất mục cũ');
  // `addEntry` trả danh sách đã SẮP (điểm cao trước), không chỉ 10 mục: mục cũ vẫn còn trong tệp.
  const back = parseLeaderboard(JSON.stringify({ entries: all }));
  assert.equal(back.length, 40);
  assert.deepEqual(back.map((e) => e.score), [...Array(40).keys()].reverse());
  assert.equal(topEntries(all).length, LEADERBOARD_MAX);
});

test('AC-LB5 lệnh xuất bảng: {"entries": [...]} đúng thứ tự, đọc tệp chung DDL_LEADERBOARD', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-lb-'));
  const src = path.join(dir, 'leaderboard.json');
  const out = path.join(dir, 'out.json');
  const entries = [
    { name: 'Lan', score: 900, nights_won: 2, achieved_at: '2026-11-20T11:00:00+07:00', seed: 3 },
    { name: 'Mây', score: 1200, nights_won: 1, achieved_at: '2026-11-20T10:00:00+07:00', seed: 4 },
  ];
  fs.writeFileSync(src, JSON.stringify({ entries }));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'src', 'leaderboard.js'), '--export-leaderboard', out], { encoding: 'utf8', cwd: ROOT, env: { ...process.env, DDL_LEADERBOARD: src } });
  assert.equal(r.status, 0, r.stderr);
  const doc = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.deepEqual(Object.keys(doc), ['entries']);
  assert.deepEqual(doc.entries.map((e) => e.name), ['Mây', 'Lan']);
  // thiếu tệp -> bảng rỗng, vẫn mã thoát 0
  const r2 = spawnSync(process.execPath, [path.join(ROOT, 'src', 'leaderboard.js'), '--export-leaderboard', path.join(dir, 'e.json')], { encoding: 'utf8', cwd: ROOT, env: { ...process.env, DDL_LEADERBOARD: path.join(dir, 'none.json') } });
  assert.equal(r2.status, 0, r2.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'e.json'), 'utf8')), { entries: [] });
});

test('AC-KEY1 gán phím: đủ 9 hành động, phát hiện trùng và từ chối, khôi phục mặc định, lưu/đọc', () => {
  assert.deepEqual(ACTIONS.map((a) => a.id), ['up', 'down', 'left', 'right', 'jump', 'dash', 'interact', 'pulse', 'pause']);
  const s = loadSettings('{}');
  assert.deepEqual(s.keys, DEFAULT_KEYS);
  const bad = assignKey(s, 'jump', 'KeyE');
  assert.match(bad.error, /Tương tác/);
  const ok = assignKey(s, 'jump', 'KeyJ');
  assert.equal(ok.settings.keys.jump, 'KeyJ');
  assert.equal(findConflicts(ok.settings.keys).length, 0);
  const restore = restoreDefaultKeys(ok.settings);
  assert.deepEqual(restore.keys, DEFAULT_KEYS);
  // đọc lại từ JSON đã lưu (module thuần: main.js truyền giá trị localStorage)
  assert.deepEqual(loadSettings(JSON.stringify(ok.settings)).keys, ok.settings.keys);
  assert.equal(keyLabel('KeyW'), 'W');
  assert.equal(keyLabel('Space'), 'Space');
  assert.equal(keyLabel('ArrowUp'), '↑');
});

test('AC-UI1 chữ UI tối thiểu 18 px ở 1280×720, có tùy chọn chữ lớn ×1.25 và giảm chuyển động', () => {
  const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
  assert.match(html, /--fs: 18px/);
  assert.match(html, /body\.large \{ --fs: 22\.5px/);
  assert.match(html, /body\.reduce-motion \*/);
  const s = loadSettings('{"reducedMotion":true,"fontScale":1.25}');
  assert.equal(s.reducedMotion, true);
  assert.equal(s.fontScale, 1.25);
  assert.equal(loadSettings('{"fontScale":3}').fontScale, 1, 'chỉ nhận 1 hoặc 1.25');
});

test('AC-UI2 phụ đề/chỉ báo: mã có Bóng Mực + mũi tên mép, gió sắp thổi, 10 s cuối, đèn fuel < 30', () => {
  const js = fs.readFileSync(path.join(ROOT, 'web', 'main.js'), 'utf8');
  for (const s of ['Bóng Mực:', 'Gió sắp nổi', 'Bình minh sau', 'Đèn yếu (dầu <', 'edgeArrows', 'cameraShake']) assert.ok(js.includes(s), s);
  assert.ok(js.includes("if (autoNight) startNight("), 'vào thẳng Đêm khi ?demo/?bench/?autostart');
});

test('AC-PKG1 README/CHANGELOG/CREDITS/LICENSE và lệnh bench/soak trong contract', () => {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));
  // bench_cmd phải là bench render thật (Chrome + WebGL, cửa sổ 1280×720), không phải bench chỉ chạy CPU
  assert.equal(c.bench_cmd, 'node scripts/bench.js');
  // soak đo rò rỉ trạng thái game: tắt JIT để bộ đệm mã V8 không lẫn vào RSS (số liệu đối chứng: docs/notes/phase-4.md)
  assert.equal(c.soak_cmd, 'node --jitless --max-semi-space-size=1 src/soak.js');
  for (const f of ['README.md', 'CHANGELOG.md', 'CREDITS.md', 'LICENSE']) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  for (const p of ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4']) assert.ok(cl.includes(p), p);
});

test('AC-PKG2 máy chủ tĩnh phục vụ trang bench/bảng xếp hạng và có lệnh xuất bảng', () => {
  const serve = fs.readFileSync(path.join(ROOT, 'scripts', 'serve.js'), 'utf8');
  assert.ok(serve.includes("'/web/'"), 'ALLOW có /web/ (bench.html, leaderboard.html)');
  assert.ok(serve.includes('--export-leaderboard'));
  for (const f of ['web/bench.html', 'web/bench.js', 'web/leaderboard.html']) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
});
