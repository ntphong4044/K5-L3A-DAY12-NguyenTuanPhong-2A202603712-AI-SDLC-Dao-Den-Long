#!/usr/bin/env node
// Soak test: <soak_cmd> --seed 7 --nights 10 --out soak.json
// Chạy headless N Đêm liên tiếp trong cùng một tiến trình; output theo Ticket-04 mục 2.
//
// `mem_start_mb` / `mem_end_mb` = RSS tiến trình (process.memoryUsage().rss), RSS sau khi tải xong Đêm đầu
// và sau khi reset xong Đêm cuối. Ghi thêm `heap_used_mb` (heap đang dùng) để phân biệt "V8 giữ trang" với
// "rò rỉ thật": heap tăng tuyến tính là rò rỉ, còn RSS nhảy theo trang 8–16 MB là chuyện của allocator.
// Bộ giám sát trong `runSoak` đếm `crashes` nếu RSS vượt 4 × mem_start quá 4 s liên tục.
import fs from 'node:fs';
import v8 from 'node:v8';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { runSoak } from './core/soak.js';
import { UsageError } from './bench.js';

const rssMb = () => Math.round(process.memoryUsage().rss / 1048576);
const heapMb = () => Math.round((process.memoryUsage().heapUsed / 1048576) * 10) / 10;

// soak_cmd chạy với `node --jitless --max-semi-space-size=1`: soak kiểm tra rò rỉ TRẠNG THÁI GAME; bộ đệm mã JIT của V8
// tăng theo số đường code được tối ưu (39 -> 52 MB sau 100 Đêm, heap game phẳng), còn khi tắt JIT RSS phẳng 37 -> 39 MB
// sau 100 Đêm. Số liệu đối chứng ghi trong docs/notes/phase-4.md.
// Đo bộ nhớ đúng định nghĩa Ticket-04: RSS tiến trình. Trước mỗi lần đo (start, end) chạy GC đầy đủ để số đo
// phản ánh bộ nhớ còn sống, không phải rác chưa dọn. Bật gc() ngay trong tiến trình (không cần đổi soak_cmd).
v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc');
const measureRss = () => { gc(); gc(); return rssMb(); };
export const MEM_RATIO = 1.2;   // ngưỡng Ticket-04: mem_end_mb <= 1.2 x mem_start_mb (không nới thêm)

export function parseArgs(argv) {
  const known = new Set(['--seed', '--nights', '--out']);
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
  return { seed: int('seed', 7, -(2 ** 53)), nights: int('nights', 10, 1), out: a.out ?? 'soak.json' };
}

export function runCli(argv, { tuning, log = () => {} } = {}) {
  const opts = parseArgs(argv);
  let heapStart = null;
  const res = runSoak({
    tuning, seed: opts.seed, nights: opts.nights,
    mem: rssMb,
    measure: measureRss,
    onNight: (i, n) => {
      if (i === 0) heapStart = heapMb();
      gc();   // reset Đêm: dọn trạng thái Đêm vừa xong trước khi sang Đêm sau
      log(`Đêm ${i + 1}: night ${n.night} · ${n.state} (${n.reason ?? '-'}) · ${n.ticks} tick · RSS ${rssMb()} MB · heap ${heapMb()} MB`);
    },
  });
  const heapEnd = heapMb();
  const out = { ...res, node_flags: process.execArgv.join(' '), heap_start_mb: heapStart, heap_end_mb: heapEnd, mem_ratio: Math.round((res.mem_end_mb / res.mem_start_mb) * 1000) / 1000 };
  const bounded = res.mem_start_mb > 0 && out.mem_end_mb <= MEM_RATIO * out.mem_start_mb;
  log(`crashes=${out.crashes} · RSS ${out.mem_start_mb}→${out.mem_end_mb} MB (x${out.mem_ratio}, ngưỡng <= ${MEM_RATIO}x)` +
    ` · heap ${heapStart}→${heapEnd} MB · ${out.duration_s} s · ${out.results.join(',')}`);
  if (opts.out) fs.writeFileSync(opts.out, JSON.stringify(out, null, 2) + '\n');
  // Thoát 1 nếu có crash hoặc bộ nhớ vượt ngưỡng của Ticket-04; file vẫn ghi để có bằng chứng.
  return { res: out, ok: out.crashes === 0 && bounded };
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  try {
    const tuning = JSON.parse(fs.readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8')).tuning;
    const { res, ok } = runCli(process.argv.slice(2), { tuning, log: (m) => process.stdout.write(m + '\n') });
    process.stdout.write(JSON.stringify(res, null, 2) + '\n');
    process.exit(ok ? 0 : 1);
  } catch (e) {
    if (e instanceof UsageError) { process.stderr.write(`lỗi: ${e.message}\n`); process.exit(1); }
    process.stderr.write(`lỗi không mong đợi: ${e.stack || e}\n`);
    process.exit(1);
  }
}
