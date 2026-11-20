#!/usr/bin/env node
// Chế độ headless theo Test Contract v1.0.
// node src/headless.js --seed <int> --night 1 [--scenario f.json] [--inputs f.json]
//                      --ticks <int> --out f.jsonl [--snapshot-every <int>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame, step, snapshot } from './core/sim.js';
import { validateInputs, validateScenario, FormatError } from './core/validate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

class UsageError extends Error {}

function parseArgs(argv) {
  const known = new Set(['--seed', '--night', '--scenario', '--inputs', '--ticks', '--out', '--snapshot-every']);
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!known.has(k)) throw new UsageError(`tham số không hợp lệ: ${k}`);
    if (i + 1 >= argv.length) throw new UsageError(`thiếu giá trị cho ${k}`);
    a[k.slice(2)] = argv[++i];
  }
  const int = (name, min) => {
    const v = a[name];
    if (v === undefined) return undefined;
    if (!/^-?\d+$/.test(v)) throw new UsageError(`--${name} phải là số nguyên`);
    const n = Number(v);
    if (n < min) throw new UsageError(`--${name} phải >= ${min}`);
    return n;
  };
  const opts = {
    seed: int('seed', -(2 ** 53)),
    night: int('night', 1),
    ticks: int('ticks', 0),
    every: int('snapshot-every', 1) ?? 10,
    scenario: a.scenario,
    inputs: a.inputs,
    out: a.out,
  };
  for (const req of ['seed', 'night', 'ticks', 'out']) {
    if (opts[req] === undefined) throw new UsageError(`thiếu --${req}`);
  }
  if (opts.night !== 1) throw new UsageError('chỉ hỗ trợ --night 1 (Phase 1)');
  return opts;
}

function readJson(file, label) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); }
  catch (e) { throw new UsageError(`không đọc được ${label} "${file}": ${e.code || e.message}`); }
  try { return JSON.parse(text); }
  catch (e) { throw new FormatError(`${label} không phải JSON hợp lệ: ${e.message}`); }
}

export function run(opts) {
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));
  const tuning = contract.tuning;
  const scenario = opts.scenario ? validateScenario(readJson(opts.scenario, 'scenario'), tuning.lantern_count_night1) : null;
  const inputs = opts.inputs ? validateInputs(readJson(opts.inputs, 'inputs')) : { frames: [] };

  const game = createGame({ tuning, seed: opts.seed, scenario });
  const held = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };
  const frames = inputs.frames;
  let fi = 0;
  const lines = [JSON.stringify(snapshot(game))];

  for (let k = 0; k < opts.ticks && game.state === 'playing'; k++) {
    while (fi < frames.length && frames[fi].tick <= k) {
      const f = frames[fi++];
      for (const key of Object.keys(held)) if (key in f) held[key] = f[key];
    }
    for (const e of step(game, held)) lines.push(JSON.stringify(e));
    if (game.steps % opts.every === 0) lines.push(JSON.stringify(snapshot(game)));
  }
  lines.push(JSON.stringify({ type: 'end', ticks: game.steps, state: game.state, score: game.score }));
  fs.writeFileSync(opts.out, lines.join('\n') + '\n');
  return game;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    run(parseArgs(process.argv.slice(2)));
    process.exit(0);
  } catch (e) {
    if (e instanceof FormatError) { process.stderr.write(`lỗi định dạng: ${e.message}\n`); process.exit(2); }
    if (e instanceof UsageError) { process.stderr.write(`lỗi: ${e.message}\n`); process.exit(1); }
    process.stderr.write(`lỗi không mong đợi: ${e.stack || e}\n`);
    process.exit(1);
  }
}
