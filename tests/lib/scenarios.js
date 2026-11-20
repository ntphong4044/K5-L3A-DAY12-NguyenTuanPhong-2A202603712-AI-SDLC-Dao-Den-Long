// Chạy các scenario trong tests/scenarios/* qua đúng lệnh headless của contract (tiến trình con thật),
// rồi đối chiếu với "expect" trong case.json. Dùng chung cho `npm test` và `npm run proof`.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SCEN_DIR = path.join(ROOT, 'tests', 'scenarios');

export function headless(args) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'src', 'headless.js'), ...args], { encoding: 'utf8' });
  return { code: r.status, stderr: r.stderr };
}

export function listCases() {
  return fs.readdirSync(SCEN_DIR).filter((d) => fs.existsSync(path.join(SCEN_DIR, d, 'case.json'))).sort();
}

export function caseArgs(name, outFile) {
  const dir = path.join(SCEN_DIR, name);
  const c = JSON.parse(fs.readFileSync(path.join(dir, 'case.json'), 'utf8'));
  const args = ['--seed', String(c.seed), '--night', '1'];
  if (fs.existsSync(path.join(dir, 'scenario.json'))) args.push('--scenario', path.join(dir, 'scenario.json'));
  if (fs.existsSync(path.join(dir, 'inputs.json'))) args.push('--inputs', path.join(dir, 'inputs.json'));
  args.push('--ticks', String(c.ticks), '--out', outFile, '--snapshot-every', String(c.snapshot_every ?? 10));
  return { c, args };
}

const get = (obj, p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const subset = (a, b) => Object.entries(b).every(([k, v]) => JSON.stringify(a?.[k]) === JSON.stringify(v));

/** Trả về danh sách {ok, desc, actual} cho từng kỳ vọng. */
export function check(lines, expect) {
  const evs = lines.filter((l) => l.type === 'event');
  const snaps = lines.filter((l) => l.type === 'snapshot');
  const end = lines.at(-1);
  return expect.map((e) => {
    if (e.event) {
      const hit = evs.find((x) => x.name === e.event && (e.tick == null || x.tick === e.tick) && subset(x.data, e.data || {}));
      const near = evs.filter((x) => x.name === e.event).map((x) => `${x.tick}:${JSON.stringify(x.data)}`).join(' ');
      return { ok: !!hit, desc: `event ${e.event}${e.tick != null ? ' @' + e.tick : ''} ${JSON.stringify(e.data || {})}`, actual: near || '(không có)' };
    }
    if (e.no_event) {
      const n = evs.filter((x) => x.name === e.no_event).length;
      return { ok: n === 0, desc: `không có event ${e.no_event}`, actual: `${n} lần` };
    }
    if (e.snapshot != null) {
      const s = snaps.find((x) => x.tick === e.snapshot);
      const v = s ? get(s, e.path) : '(không có snapshot)';
      return { ok: JSON.stringify(v) === JSON.stringify(e.equals), desc: `snapshot@${e.snapshot} ${e.path} == ${JSON.stringify(e.equals)}`, actual: JSON.stringify(v) };
    }
    if (e.end) {
      return { ok: end?.type === 'end' && subset(end, e.end), desc: `end ${JSON.stringify(e.end)}`, actual: JSON.stringify(end) };
    }
    return { ok: false, desc: `kỳ vọng không hợp lệ ${JSON.stringify(e)}`, actual: '' };
  });
}

export function readJsonl(file) {
  return fs.readFileSync(file, 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l));
}
