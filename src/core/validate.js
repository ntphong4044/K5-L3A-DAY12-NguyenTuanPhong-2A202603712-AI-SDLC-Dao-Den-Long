// Kiểm tra định dạng file inputs / scenario theo Test Contract v1.0 (mục C, D).
// Sai định dạng -> ném FormatError (headless thoát mã 2).
import { LANTERN_IDS } from './sim.js';

export class FormatError extends Error {}

const fail = (msg) => { throw new FormatError(msg); };
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);

export function validateInputs(doc) {
  if (!isObj(doc)) fail('inputs: gốc phải là object');
  if (!Array.isArray(doc.frames)) fail('inputs: thiếu mảng "frames"');
  let prev = -1;
  doc.frames.forEach((f, i) => {
    const at = `inputs.frames[${i}]`;
    if (!isObj(f)) fail(`${at}: phải là object`);
    if (!isInt(f.tick) || f.tick < 0) fail(`${at}.tick: phải là số nguyên >= 0`);
    if (f.tick <= prev) fail(`${at}.tick: phải tăng nghiêm ngặt`);
    prev = f.tick;
    if ('move' in f) {
      const m = f.move;
      if (!Array.isArray(m) || m.length !== 2 || !m.every(isNum) || m.some((x) => x < -1 || x > 1)) {
        fail(`${at}.move: phải là [x, z] với mỗi thành phần trong [-1, 1]`);
      }
    }
    if ('cam_yaw_deg' in f && !isNum(f.cam_yaw_deg)) fail(`${at}.cam_yaw_deg: phải là số`);
    for (const k of ['jump', 'interact', 'pulse', 'dash']) {
      if (k in f && typeof f[k] !== 'boolean') fail(`${at}.${k}: phải là boolean`);
    }
  });
  return doc;
}

export function validateScenario(doc, lanternCount = 5) {
  if (!isObj(doc)) fail('scenario: gốc phải là object');
  if ('player' in doc) {
    const p = doc.player;
    if (!isObj(p)) fail('scenario.player: phải là object');
    if ('pos' in p && !isVec3(p.pos)) fail('scenario.player.pos: phải là [x, y, z]');
    if ('carried' in p && (!isInt(p.carried) || p.carried < 0)) fail('scenario.player.carried: số nguyên >= 0');
    if ('flames' in p && (!isInt(p.flames) || p.flames < 0)) fail('scenario.player.flames: số nguyên >= 0');
  }
  for (const k of ['random_motes', 'random_shades']) {
    if (k in doc && typeof doc[k] !== 'boolean') fail(`scenario.${k}: phải là boolean`);
  }
  if ('motes' in doc) {
    if (!Array.isArray(doc.motes) || !doc.motes.every(isVec3)) fail('scenario.motes: phải là mảng [x, y, z]');
  }
  if ('shades' in doc) {
    if (!Array.isArray(doc.shades)) fail('scenario.shades: phải là mảng');
    const ids = new Set();
    doc.shades.forEach((sh, i) => {
      if (!isObj(sh) || !isVec3(sh.pos)) fail(`scenario.shades[${i}].pos: phải là [x, y, z]`);
      if ('id' in sh) {
        if (typeof sh.id !== 'string' || !sh.id) fail(`scenario.shades[${i}].id: phải là chuỗi khác rỗng`);
        if (ids.has(sh.id)) fail(`scenario.shades[${i}].id: trùng id "${sh.id}"`);
        ids.add(sh.id);
      }
    });
  }
  if ('lanterns' in doc) {
    if (!Array.isArray(doc.lanterns)) fail('scenario.lanterns: phải là mảng');
    const valid = LANTERN_IDS.slice(0, lanternCount);
    doc.lanterns.forEach((l, i) => {
      if (!isObj(l) || !valid.includes(l.id)) fail(`scenario.lanterns[${i}].id: phải là một trong ${valid.join(', ')}`);
      if ('pos' in l && !isVec3(l.pos)) fail(`scenario.lanterns[${i}].pos: phải là [x, y, z]`);
      if ('lit' in l && typeof l.lit !== 'boolean') fail(`scenario.lanterns[${i}].lit: phải là boolean`);
      if ('deposited' in l && (!isInt(l.deposited) || l.deposited < 0)) fail(`scenario.lanterns[${i}].deposited: số nguyên >= 0`);
    });
  }
  if ('time_left_s' in doc && (!isNum(doc.time_left_s) || doc.time_left_s < 0)) {
    fail('scenario.time_left_s: phải là số >= 0');
  }
  return doc;
}
