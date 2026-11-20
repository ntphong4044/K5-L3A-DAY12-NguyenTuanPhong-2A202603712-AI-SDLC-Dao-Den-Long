#!/usr/bin/env node
// Benchmark headless: <bench_cmd> --seed 42 --duration 30 --out bench.json
//
// Ở chế độ headless (Node) không có GPU/cửa sổ như trình duyệt, nên FPS/renderer *không đo bằng màn hình*.
// Lệnh này đo đường ống CPU của cảnh chuẩn (luật `step()` + camera quỹ đạo) để kiểm cấu hình cảnh:
// báo cáo `avg_fps` là FPS an toàn theo ngân sách khung (frame budget) chứ không phải ảnh chụp khung hình thật.
// Để đo trên renderer thật, dùng bản web: `npm run bench` mở cảnh chuẩn 1280×720 và ghi bench.json.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createBenchGame, benchStep, orbitCamera } from './core/bench.js';
import { frameStats, round1, RENDERER_LABEL } from './core/benchstats.js';

export class UsageError extends Error {}

export function parseArgs(argv) {
  const known = new Set(['--seed', '--duration', '--out']);
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!known.has(k)) throw new UsageError(`tham số không hợp lệ: ${k}`);
    if (i + 1 >= argv.length) throw new UsageError(`thiếu giá trị cho ${k}`);
    a[k.slice(2)] = argv[++i];
  }
  const int = (name, def, min) => {
    const v = a[name] ?? String(def);
    if (!/^-?\d+$/.test(v)) throw new UsageError(`--${name} phải là số nguyên`);
    const n = Number(v);
    if (n < min) throw new UsageError(`--${name} phải >= ${min}`);
    return n;
  };
  return { seed: int('seed', 42, -(2 ** 53)), duration: int('duration', 30, 1), out: a.out ?? 'bench.json' };
}

export function cpuFrameMs(g, t) {
  const t0 = process.hrtime.bigint();
  benchStep(g);
  orbitCamera(t);
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

/**
 * Chạy bench headless: bỏ qua warmup 3 s, giả lập 60 khung/giây trong `duration` giây, mỗi khung một tick
 * bộ mô phỏng và một phép tính camera. `avg_fps` = 1000 / thời gian CPU trung bình mỗi khung (trần lý thuyết
 * 60 vì cảnh bench vẫn chạy đúng 60 tick/s); `frame_ms_p95`, `p1_low_fps` lấy từ phân bố thời gian CPU.
 */
export function run({ seed = 42, duration = 30, tuning, out }) {
  const g = createBenchGame({ tuning, seed, night: 1 });
  for (let k = 0; k < 3 * 60; k++) benchStep(g);
  const dts = [];
  for (let k = 0; k < duration * 60; k++) dts.push(cpuFrameMs(g, (3 * 60 + k) / 60));
  const st = frameStats(dts.map((ms) => Math.max(ms, 1000 / 60)));
  const doc = {
    contract_version: '1.3',
    mode: 'headless-cpu',
    avg_fps: st.avg_fps,
    p1_low_fps: st.p1_low_fps,
    frame_ms_p95: st.frame_ms_p95,
    frames: st.frames,
    load_ms: round1(process.uptime() * 1000),
    peak_mem_mb: Math.round(process.memoryUsage().rss / 1048576),
    vsync_off: false,
    renderer: `${RENDERER_LABEL} — đo CPU headless, không phải renderer thật`,
    os: `${process.platform} ${process.arch} ${process.release?.name ?? ''} ${process.version}`.trim(),
    note: 'Chỉ để kiểm cấu hình cảnh khi không có trình duyệt; số chính chấm trên máy giảng viên dùng `npm run bench` (bản web thật).',
  };
  if (out) fs.writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
  return doc;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const tuning = JSON.parse(fs.readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8')).tuning;
    const doc = run({ ...opts, tuning });
    process.stdout.write(JSON.stringify(doc, null, 2) + '\n');
    process.exit(0);
  } catch (e) {
    if (e instanceof UsageError) { process.stderr.write(`lỗi: ${e.message}\n`); process.exit(1); }
    process.stderr.write(`lỗi không mong đợi: ${e.stack || e}\n`);
    process.exit(1);
  }
}
