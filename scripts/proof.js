// Sinh bằng chứng Phase 1: chạy mọi scenario + kiểm tra tất định + ván chơi trọn vẹn bằng bot,
// tất cả qua đúng lệnh headless của game.contract.json. Ghi ra docs/proof/phase-1/.
// Dùng: npm run proof        (thoát mã 1 nếu có mục không đạt)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { headless, listCases, caseArgs, check, readJsonl, ROOT } from '../tests/lib/scenarios.js';
import { playBot } from './bot.js';

const OUT = path.join(ROOT, 'docs', 'proof', 'phase-1');
const RUNS = path.join(OUT, 'runs');
fs.mkdirSync(RUNS, { recursive: true });
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
const tuning = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8')).tuning;

let allOk = true;
const md = [];
let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch {}
md.push('# Kết quả kiểm chứng Phase 1 (tự sinh bởi `npm run proof`)', '');
md.push(`- Commit: \`${commit}\` · Node ${process.version} · ${os.platform()} ${os.arch()} · ${os.cpus()[0]?.model ?? ''}`);
md.push('- Mọi lần chạy dùng đúng lệnh `headless_cmd` trong `game.contract.json` (tiến trình con thật). File output nằm trong `runs/`.', '');

// 1) Scenario
md.push('## 1. Scenario headless', '', '| Scenario | Yêu cầu | Kỳ vọng | Kết quả |', '|---|---|---|---|');
for (const name of listCases()) {
  const o = path.join(RUNS, `${name}.jsonl`);
  const { c, args } = caseArgs(name, o);
  const r = headless(args);
  const res = r.code === 0 ? check(readJsonl(o), c.expect) : [{ ok: false, desc: 'exit code', actual: `${r.code} ${r.stderr}` }];
  const ok = res.every((x) => x.ok);
  allOk &&= ok;
  const detail = res.map((x) => `${x.ok ? '✅' : '❌'} ${x.desc}${x.ok ? '' : ` (thực tế: ${x.actual})`}`).join('<br>');
  md.push(`| \`${name}\` | ${c.requirement} | ${detail} | **${ok ? 'ĐẠT' : 'CHƯA ĐẠT'}** |`);
}

// 2) Tính tất định
md.push('', '## 2. Tính tất định (chạy 2 lần, so từng byte)', '');
const inp = path.join(ROOT, 'tests', 'fixtures', 'long-inputs.json');
const hashes = ['det-run1', 'det-run2'].map((n) => {
  const o = path.join(RUNS, `${n}.jsonl`);
  headless(['--seed', '2024', '--night', '1', '--inputs', inp, '--ticks', '6000', '--out', o]);
  return sha(o);
});
const detOk = hashes[0] === hashes[1];
allOk &&= detOk;
md.push(`Lệnh: \`node src/headless.js --seed 2024 --night 1 --inputs tests/fixtures/long-inputs.json --ticks 6000 --out <f>\``, '');
md.push(`- run1 sha256: \`${hashes[0]}\``, `- run2 sha256: \`${hashes[1]}\``, `- **${detOk ? 'ĐẠT: giống hệt' : 'CHƯA ĐẠT: khác nhau'}**`);

// 3) Ván chơi trọn vẹn (bot) -> phát lại qua headless
md.push('', '## 3. Chơi trọn Đêm 1 mặc định (bot tham lam, phát lại qua headless)', '');
md.push('| Seed | Kết quả bot (lõi) | Phát lại qua headless | Khớp |', '|---|---|---|---|');
for (const seed of [1, 7, 42]) {
  const { game, inputs } = playBot({ tuning, seed });
  const fi = path.join(RUNS, `bot-seed${seed}.inputs.json`);
  const o = path.join(RUNS, `bot-seed${seed}.jsonl`);
  fs.writeFileSync(fi, JSON.stringify(inputs));
  headless(['--seed', String(seed), '--night', '1', '--inputs', fi, '--ticks', '18000', '--out', o, '--snapshot-every', '600']);
  const end = readJsonl(o).at(-1);
  const evs = readJsonl(o).filter((l) => l.type === 'event');
  const n = (k) => evs.filter((e) => e.name === k).length;
  const match = end.state === game.state && end.score === game.score && end.ticks === game.steps;
  allOk &&= match;
  md.push(`| ${seed} | ${game.state} (${game.reason}), điểm ${game.score}, ${game.steps} tick | ${end.state}, điểm ${end.score}, ${end.ticks} tick · ${n('lantern_lit')} đèn, ${n('mote_picked')} đom đóm, ${n('pulse')} pulse, ${n('player_hit')} lần bị chạm | ${match ? '✅' : '❌'} |`);
}

md.push('', `## Tổng kết: ${allOk ? '**TẤT CẢ ĐẠT**' : '**CÓ MỤC CHƯA ĐẠT**'}`, '');
fs.writeFileSync(path.join(OUT, 'results.md'), md.join('\n'));
console.log(md.join('\n'));
process.exit(allOk ? 0 : 1);
