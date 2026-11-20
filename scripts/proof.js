// Sinh bằng chứng cho một phase: scenario + tất định (3 Đêm) + hiệu năng + bot chơi trọn Đêm,
// tất cả qua đúng lệnh headless của game.contract.json. Ghi ra docs/proof/phase-<N>/.
// Dùng: npm run proof [-- --phase 2]   (thoát mã 1 nếu có mục chưa đạt)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { headless, listCases, caseArgs, check, readJsonl, ROOT } from '../tests/lib/scenarios.js';
import { createGame, step } from '../src/core/sim.js';
import { createBot } from '../src/core/bot.js';

const phase = process.argv.includes('--phase') ? process.argv[process.argv.indexOf('--phase') + 1] : '2';
const OUT = path.join(ROOT, 'docs', 'proof', `phase-${phase}`);
const RUNS = path.join(OUT, 'runs');
fs.rmSync(RUNS, { recursive: true, force: true });
fs.mkdirSync(RUNS, { recursive: true });
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));
const tuning = contract.tuning;

let allOk = true;
const md = [];
let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch {}
md.push(`# Kết quả kiểm chứng Phase ${phase} (tự sinh bởi \`npm run proof\`)`, '');
md.push(`- Contract v${contract.contract_version} · Commit: \`${commit}\` · Node ${process.version} · ${os.platform()} ${os.arch()} · ${os.cpus()[0]?.model?.trim() ?? ''}`);
md.push('- Mọi lần chạy dùng đúng lệnh `headless_cmd` (tiến trình con thật). Output nằm trong `runs/` (bỏ qua các file lớn).', '');

// 1) Scenario
md.push('## 1. Scenario headless', '', '| Scenario | Đêm | Yêu cầu | Kỳ vọng | Kết quả |', '|---|---|---|---|---|');
for (const name of listCases()) {
  const o = path.join(RUNS, `${name}.jsonl`);
  const { c, args } = caseArgs(name, o);
  const r = headless(args);
  const res = r.code === 0 ? check(readJsonl(o), c.expect) : [{ ok: false, desc: 'exit code', actual: `${r.code} ${r.stderr}` }];
  const ok = res.every((x) => x.ok);
  allOk &&= ok;
  const detail = res.map((x) => `${x.ok ? '✅' : '❌'} ${x.desc}${x.ok ? '' : ` (thực tế: ${x.actual})`}`).join('<br>');
  const changed = c.changed_in_phase2 ? `<br>*Đổi ở Phase 2: ${c.changed_in_phase2}*` : '';
  md.push(`| \`${name}\` | ${c.night ?? 1} | ${c.requirement}${changed} | ${detail} | **${ok ? 'ĐẠT' : 'CHƯA ĐẠT'}** |`);
  if (fs.statSync(o).size > 300_000) fs.rmSync(o);
}

// 2) Tất định + 3) hiệu năng
md.push('', '## 2. Tính tất định và hiệu năng (một Đêm đầy đủ 21.600 tick)', '');
md.push('| Đêm | sha256 lần 1 | sha256 lần 2 | Giống hệt | Thời gian chạy | <= 30 s |', '|---|---|---|---|---|---|');
const inp = path.join(ROOT, 'tests', 'fixtures', 'long-inputs.json');
for (const night of [1, 2, 3]) {
  const hs = [], times = [];
  for (const n of [1, 2]) {
    const o = path.join(RUNS, `det-n${night}-${n}.jsonl`);
    const t0 = process.hrtime.bigint();
    headless(['--seed', '2024', '--night', String(night), '--inputs', inp, '--ticks', '21600', '--out', o]);
    times.push(Number(process.hrtime.bigint() - t0) / 1e9);
    hs.push(sha(o));
    fs.rmSync(o);
  }
  const same = hs[0] === hs[1], fast = Math.max(...times) <= 30;
  allOk &&= same && fast;
  md.push(`| ${night} | \`${hs[0]}\` | \`${hs[1]}\` | ${same ? '✅' : '❌'} | ${times.map((t) => t.toFixed(2) + ' s').join(' / ')} | ${fast ? '✅' : '❌'} |`);
}
md.push('', 'Lệnh: `node src/headless.js --seed 2024 --night N --inputs tests/fixtures/long-inputs.json --ticks 21600 --out <f>` (đo cả thời gian khởi động Node).');

// 4) Bot chơi trọn Đêm -> ghi inputs -> phát lại qua headless
md.push('', '## 3. Bot chơi trọn từng Đêm (tìm đường + né), phát lại inputs qua headless', '');
md.push('Bot (`src/core/bot.js`) là công cụ kiểm chứng "chơi được từ đầu tới cuối", **không phải** yêu cầu. Kết quả thua được ghi đúng như thực tế.', '');
md.push('| Đêm | Seed | Kết quả | Điểm | Tick | Đèn đã thắp | Phát lại headless khớp |', '|---|---|---|---|---|---|---|');
for (const night of [1, 2, 3]) {
  for (const seed of [1, 7, 42]) {
    const g = createGame({ tuning, seed, night });
    const bot = createBot();
    const frames = [];
    let prev = {};
    for (let k = 0; k < 21600 && g.state === 'playing'; k++) {
      const i = bot(g);
      const f = { tick: k };
      for (const key of ['move', 'interact', 'pulse']) if (JSON.stringify(i[key]) !== JSON.stringify(prev[key] ?? (key === 'move' ? [0, 0] : false))) f[key] = i[key];
      if (Object.keys(f).length > 1) frames.push(f);
      prev = i;
      step(g, i);
    }
    const fi = path.join(RUNS, `bot-n${night}-s${seed}.inputs.json`);
    const o = path.join(RUNS, `bot-n${night}-s${seed}.jsonl`);
    fs.writeFileSync(fi, JSON.stringify({ frames }));
    headless(['--seed', String(seed), '--night', String(night), '--inputs', fi, '--ticks', '21600', '--out', o, '--snapshot-every', '600']);
    const end = readJsonl(o).at(-1);
    const match = end.state === g.state && end.score === g.score && end.ticks === g.tick;
    allOk &&= match;
    const lit = g.lanterns.filter((l) => l.lit).map((l) => l.id).join(' ');
    md.push(`| ${night} | ${seed} | ${g.state === 'won' ? '**thắng**' : `thua (${g.reason})`} | ${g.score} | ${g.tick} | ${lit} (${g.lanterns.filter((l) => l.lit).length}/${g.lanterns.length}) | ${match ? '✅' : '❌'} |`);
  }
}

md.push('', `## Tổng kết: ${allOk ? '**TẤT CẢ ĐẠT**' : '**CÓ MỤC CHƯA ĐẠT**'}`, '');
fs.writeFileSync(path.join(OUT, 'results.md'), md.join('\n'));
console.log(md.join('\n'));
process.exit(allOk ? 0 : 1);
