// Đảo Đèn Lồng — lõi mô phỏng tất định, Test Contract v1.1 (Ticket-02).
// Dùng chung cho headless (src/headless.js) và web (web/main.js). Không DOM, không Math.random.
// step() đi đúng 12 bước của "Thứ tự xử lý trong một tick" (xem docs/lab/ticket-02.md).
import { getMap, r3 } from './maps.js';

export { r3 };
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
const EPS = 1e-6;

// Hằng số chuẩn của Ticket-02 không có khóa riêng trong tuning
export const STD = {
  gravity: 20, jumpSpeed: 7,
  charmSpeed: 7.2, charmTicks: 600, charmRespawnTicks: 2700,
  pickupDy: 1.5, hitDy: 1.5,
  moteStart: 20, moteCap: 30, moteSpawnEvery: 240, dropTtl: 480, dropRingMin: 1.5, dropRingMax: 2.5,
  pulseCenterY: 0.8, stunTicks: 120, pushTicks: 15,
  shadeFirstSpawn: 300, shadeFirstCount: 2, shadeDetect: 12, shadeLose: 18, shadeMinSpawnDist: 15,
  shadeSpawningTicks: 60,     // GIẢ ĐỊNH: thời gian trạng thái "spawning"
  shadeY: 1,                  // tâm Bóng Mực cao 1 m trên mặt đất
  shadeWanderSpeed: 1,        // GIẢ ĐỊNH: "wander" trôi chậm 1 m/s về phía Mây
  recoilTicks: 60, recoilDist: 2,
  evictTicks: 30, safeMargin: 0.001,
  invulnTicks: 90, respawnWait: 60, fallY: -10,
  drifterSpeed: 7, drifterIdleSpeed: 2, drifterIdleRadius: 3, drifterMax: 2, drifterEvery: 1200,
  drifterDetect: 15, drifterMinCarry: 5, drifterTouch: 1.2, drifterSteal: 3, drifterFlee: 240, drifterDropFlee: 120,
  drifterY: 1.5,
  windEvery: 1800, windTicks: 300, windSpeed: 2,
  stepUp: 0.35,               // bậc cao nhất có thể bước lên (dốc); vách 3 m thì bị chặn
};
export const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned'];
export const DRIFTER_STATES = ['idle', 'chase', 'flee', 'removed'];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sec = (s) => Math.round(s * TICK_RATE);
const dXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const idNum = (id) => { const m = /(\d+)$/.exec(id); return m ? Number(m[1]) : Infinity; };
const byId = (a, b) => idNum(a.id) - idNum(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

export function nightDuration(T, night) {
  return T[`night${night}_duration_s`] ?? T.night1_duration_s;
}

/** Tạo một Đêm. scenario đã được validate (Test Contract mục D + v1.1). */
export function createGame({ tuning, seed, night = 1, scenario = null }) {
  const T = tuning;
  const M = getMap(night);
  const sc = scenario || {};
  const s = {
    T, M, night, seed,
    rngMotes: mulberry32(seed),
    rngShades: mulberry32((seed ^ 0x9e3779b9) >>> 0),
    rngMisc: mulberry32((seed ^ 0x85ebca6b) >>> 0),
    state: 'playing', reason: null, paused: false,
    tick: 0, steps: 0, score: 0,
    timeLeft0: sc.time_left_s ?? nightDuration(T, night),
    player: {
      pos: [...M.start], vel: [0, 0, 0], grounded: true, facing: [0, 1],
      flames: T.flames, carried: 0,
      invuln: 0, dashCd: 0, pulseCd: 0, charm: 0,
      dashTicks: 0, dashDir: [0, 1], launch: null, respawn: 0,
    },
    lanterns: M.lanterns.map((p, i) => ({ id: `L${i + 1}`, pos: [...p], lit: false, deposited: 0 })),
    motes: [], moteCounter: 0,
    shades: [], shadeCounter: 0,
    drifters: [], drifterCounter: 0,
    charms: M.charms.map((p, i) => ({ id: `C${i + 1}`, pos: [...p], available: true, respawn: 0 })),
    randomMotes: sc.random_motes !== false,
    randomShades: sc.random_shades !== false,
    randomDrifters: sc.random_drifters !== false && M.drifters,
    windEnabled: sc.wind_enabled ?? M.wind,
    wind: { active: false, dirDeg: 0, ticks: 0 },
    prev: { jump: false, interact: false, pulse: false, dash: false, pause: false },
    stats: { deposited: 0, lanterns: 0, stuns: 0, bonusTime: 0, bonusFlames: 0 },
    fx: [],          // hiệu ứng cho web (không ảnh hưởng output)
    started: false,
  };
  const p = s.player;

  if (sc.player) {
    const sp = sc.player;
    if (sp.pos) { p.pos = [...sp.pos]; p.grounded = groundedAt(s, p.pos); }
    if (sp.carried != null) p.carried = sp.carried;
    if (sp.flames != null) p.flames = sp.flames;
    if (sp.invuln_ticks != null) p.invuln = sp.invuln_ticks;
    if (sp.dash_cd_ticks != null) p.dashCd = sp.dash_cd_ticks;
    if (sp.pulse_cd_ticks != null) p.pulseCd = sp.pulse_cd_ticks;
    if (sp.charm_ticks != null) p.charm = sp.charm_ticks;
  }
  for (const l of sc.lanterns || []) {
    const L = s.lanterns.find((x) => x.id === l.id);
    if (l.pos) L.pos = [...l.pos];
    if (l.deposited != null) L.deposited = l.deposited;
    if (l.lit != null) L.lit = l.lit;
    if (L.deposited >= T.lantern_cost) L.lit = true;
  }

  // Đom đóm: 20 điểm khác nhau trong các điểm sinh (rút ngẫu nhiên theo seed)
  if (sc.motes) {
    for (const m of sc.motes) {
      const isArr = Array.isArray(m);
      addMote(s, isArr ? m : m.pos, isArr ? 'random' : (m.kind || 'random'), isArr ? 0 : sec(m.ttl_s ?? 0) || (m.kind === 'dropped' ? STD.dropTtl : 0), -1);
    }
  } else if (s.randomMotes) {
    const idx = M.moteSpawns.map((_, i) => i);
    for (let k = 0; k < Math.min(STD.moteStart, idx.length); k++) {
      const j = k + Math.floor(s.rngMotes() * (idx.length - k));
      [idx[k], idx[j]] = [idx[j], idx[k]];
      addMote(s, M.moteSpawns[idx[k]], 'random', 0, -1, idx[k]);
    }
  }

  const used = new Set();
  for (const sh of sc.shades || []) if (sh.id) used.add(sh.id);
  for (const sh of sc.shades || []) {
    const id = sh.id || nextId(s, 'shadeCounter', 'S', used);
    used.add(id);
    const o = makeShade(s, id, sh.pos);
    o.state = sh.state || 'wander';
    o.stateTicks = sh.state_ticks_left ?? (o.state === 'stunned' ? STD.stunTicks : o.state === 'recoil' ? STD.recoilTicks : o.state === 'spawning' ? STD.shadeSpawningTicks : 0);
    s.shades.push(o);
  }
  s.usedShadeIds = used;

  const usedD = new Set();
  for (const d of sc.drifters || []) if (d.id) usedD.add(d.id);
  for (const d of sc.drifters || []) {
    const id = d.id || nextId(s, 'drifterCounter', 'D', usedD);
    usedD.add(id);
    const o = makeDrifter(id, d.pos);
    if (d.state) o.state = d.state;
    if (d.stolen != null) o.stolen = d.stolen;
    if (o.state === 'flee') o.flee = d.state_ticks_left ?? STD.drifterFlee;
    s.drifters.push(o);
  }
  s.usedDrifterIds = usedD;

  if (sc.charms) {
    s.charms = sc.charms.map((c, i) => ({
      id: c.id || `C${i + 1}`, pos: [...c.pos], available: c.available !== false,
      respawn: c.available === false ? (c.respawn_ticks ?? STD.charmRespawnTicks) : 0,
    }));
  }
  return s;
}

function nextId(s, counter, prefix, used) {
  let id;
  do { s[counter] += 1; id = `${prefix}${s[counter]}`; } while (used.has(id));
  return id;
}
function addMote(s, pos, kind, ttl, bornTick, spawnIdx = -1) {
  s.moteCounter += 1;
  const m = { id: `M${s.moteCounter}`, pos: [...pos], kind, ttl, born: bornTick, spawnIdx };
  s.motes.push(m);
  return m;
}
function makeShade(s, id, pos) {
  return { id, pos: [...pos], state: 'spawning', stateTicks: STD.shadeSpawningTicks, push: 0, pushDir: [1, 0], evict: 0, evictStep: [0, 0], recoilDir: [1, 0] };
}
function makeDrifter(id, pos) {
  return { id, pos: [...pos], state: 'idle', stolen: 0, flee: 0, anchor: [pos[0] - STD.drifterIdleRadius, pos[2]], ang: 0 };
}

export function surface(s, x, z) { return s.M.surface(x, z); }
function groundedAt(s, pos) {
  const g = surface(s, pos[0], pos[2]);
  return g !== null && Math.abs(pos[1] - g) < 1e-6;
}
// Mặt "bay" cho Bóng Mực / Gió Lạc: bỏ qua tháp chuông, ngoài đảo coi như 0
function flyBase(s, x, z) {
  const g = surface(s, x, z);
  if (g === null) return 0;
  return g > 6 ? 6 : g;
}

export const timeLeft = (s) => s.timeLeft0 - s.steps / TICK_RATE;
export const litCount = (s) => s.lanterns.filter((l) => l.lit).length;

/**
 * Một tick. input: { move:[x,z], cam_yaw_deg, jump, interact, pulse, dash, pause } (giá trị đang giữ).
 * Trả về danh sách sự kiện { type:'event', tick, name, data }.
 */
export function step(s, input) {
  const events = [];
  if (s.state === 'won' || s.state === 'lost') return events;
  const T = s.T, M = s.M, p = s.player;
  s.tick += 1;
  const tick = s.tick;
  const ev = (name, data) => events.push({ type: 'event', tick, name, data });
  s.fx = [];

  // ---- 1. Đọc input (pause trước)
  const edge = (k) => !!input[k] && !s.prev[k];
  const E = { jump: edge('jump'), interact: edge('interact'), pulse: edge('pulse'), dash: edge('dash'), pause: edge('pause') };
  for (const k of Object.keys(s.prev)) s.prev[k] = !!input[k];
  if (E.pause) {
    s.paused = !s.paused;
    if (s.paused) { s.state = 'paused'; ev('paused', {}); return events; }
    s.state = 'playing';
    ev('resumed', {});
  } else if (s.paused) {
    return events;
  }
  if (!s.started) { s.started = true; ev('night_start', { night: s.night }); }

  // ---- 2. Giảm bộ đếm
  s.steps += 1;
  const st = s.steps;
  if (p.dashCd > 0) p.dashCd -= 1;
  if (p.pulseCd > 0) p.pulseCd -= 1;
  if (p.invuln > 0) p.invuln -= 1;
  if (p.charm > 0) p.charm -= 1;
  for (const sh of s.shades) {
    if (sh.state === 'stunned' || sh.state === 'spawning') {
      if (sh.stateTicks > 0) sh.stateTicks -= 1;
      if (sh.stateTicks === 0) sh.state = 'wander';
    } else if (sh.state === 'recoil' && sh.stateTicks === 0) {
      sh.state = 'wander'; // recoil đếm ở bước 8 để lùi đủ 60 lần × 2/60 m
    }
  }
  for (const d of s.drifters) {
    if (d.state === 'flee') { d.flee -= 1; if (d.flee <= 0) d.state = 'removed'; }
  }
  s.motes = s.motes.filter((m) => {
    if (m.kind !== 'dropped' || m.ttl <= 0) return true;
    m.ttl -= 1;
    return m.ttl > 0;
  });
  for (const c of s.charms) if (!c.available && c.respawn > 0) { c.respawn -= 1; if (c.respawn === 0) c.available = true; }
  if (s.windEnabled) {
    if (s.wind.active) { s.wind.ticks -= 1; if (s.wind.ticks <= 0) s.wind.active = false; }
    if (st % STD.windEvery === 0) {
      s.wind = { active: true, dirDeg: Math.floor(s.rngMisc() * 360), ticks: STD.windTicks };
    }
  }

  // ---- 3. Di chuyển Mây rồi kiểm tra rơi
  movePlayer(s, input, E, ev);

  const alive = p.respawn === 0;

  // ---- 4. Nhặt đom đóm và bùa
  if (alive) {
    s.motes = s.motes.filter((m) => {
      if (p.carried >= T.carry_capacity || m.born >= tick) return true;
      if (dXZ(p.pos, m.pos) <= T.pickup_radius + EPS && Math.abs(p.pos[1] - m.pos[1]) <= STD.pickupDy + EPS) {
        p.carried += 1;
        ev('mote_picked', { carried: p.carried });
        return false;
      }
      return true;
    });
    for (const c of s.charms) {
      if (!c.available) continue;
      if (dXZ(p.pos, c.pos) <= T.pickup_radius + EPS && Math.abs(p.pos[1] - c.pos[1]) <= STD.pickupDy + EPS) {
        c.available = false;
        c.respawn = STD.charmRespawnTicks;
        p.charm = STD.charmTicks;
        ev('charm_picked', { charm_id: c.id, charm_ticks: STD.charmTicks });
      }
    }
  }

  // ---- 5. Tương tác với đèn
  const newlyLit = [];
  if (alive && E.interact && p.carried > 0) {
    let best = null, bd = Infinity;
    for (const l of s.lanterns) {
      if (l.lit) continue;
      const d = dXZ(p.pos, l.pos);
      if (d <= T.interact_radius + EPS && (d < bd - EPS || (Math.abs(d - bd) <= EPS && idNum(l.id) < idNum(best.id)))) { best = l; bd = d; }
    }
    if (best) {
      const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
      if (amount > 0) {
        p.carried -= amount;
        best.deposited += amount;
        s.score += amount * T.score.per_mote;
        s.stats.deposited += amount;
        ev('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
        if (best.deposited >= T.lantern_cost) {
          best.lit = true;
          s.score += T.score.per_lantern;
          s.stats.lanterns += 1;
          newlyLit.push(best);
          ev('lantern_lit', { lantern_id: best.id });
        }
      }
    }
  }

  // ---- 6. Cập nhật vùng an toàn: Bóng Mực đang ở trong đèn vừa thắp bị đẩy ra trong tối đa 30 tick
  const R = T.safe_radius;
  for (const l of newlyLit) {
    for (const sh of s.shades) {
      let dx = sh.pos[0] - l.pos[0], dz = sh.pos[2] - l.pos[2];
      const d = Math.hypot(dx, dz);
      if (d <= R) {
        if (d < 1e-9) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
        const per = (R + STD.safeMargin - d) / STD.evictTicks;
        sh.evict = STD.evictTicks;
        sh.evictStep = [dx * per, dz * per];
      }
    }
  }

  // ---- 7. Tỏa Sáng
  if (alive && E.pulse && p.pulseCd === 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCd = sec(T.pulse_cooldown_s);
    const c = [p.pos[0], p.pos[1] + STD.pulseCenterY, p.pos[2]];
    const ids = [];
    for (const sh of [...s.shades].sort(byId)) {
      if (d3(c, sh.pos) <= T.pulse_radius + EPS) {
        let dx = sh.pos[0] - p.pos[0], dz = sh.pos[2] - p.pos[2];
        const d = Math.hypot(dx, dz);
        if (d < 1e-9) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
        sh.state = 'stunned';
        sh.stateTicks = sec(T.pulse_stun_s);
        sh.push = STD.pushTicks;
        sh.pushDir = [dx, dz];
        ids.push(sh.id);
        s.score += T.score.per_stun;
        s.stats.stuns += 1;
      }
    }
    for (const d of s.drifters) {
      if (d3(c, d.pos) > T.pulse_radius + EPS) continue;
      if (d.state === 'chase') { d.state = 'flee'; d.flee = STD.drifterFlee; }
      else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        for (let i = 0; i < amount; i++) addMote(s, [d.pos[0], flyBase(s, d.pos[0], d.pos[2]), d.pos[2]], 'dropped', STD.dropTtl, tick);
        d.stolen = 0;
        d.flee = STD.drifterDropFlee;
        ev('drifter_drop', { drifter_id: d.id, amount });
      }
    }
    s.fx.push('pulse');
    ev('pulse', { stunned_ids: ids });
  }

  // ---- 8. Di chuyển Bóng Mực và Gió Lạc
  const speed = M.shadeSpeed;
  for (const sh of s.shades) {
    const dist = dXZ(sh.pos, p.pos);
    if (sh.evict > 0) {
      sh.pos[0] += sh.evictStep[0]; sh.pos[2] += sh.evictStep[1];
      sh.evict -= 1;
    } else if (sh.state === 'stunned') {
      if (sh.push > 0) {
        const k = T.pulse_push_m / STD.pushTicks;
        const nx = sh.pos[0] + sh.pushDir[0] * k, nz = sh.pos[2] + sh.pushDir[1] * k;
        if (insideSafe(s, nx, nz)) sh.push = 0; // gặp vật cản (vùng an toàn) thì dừng
        else { sh.pos[0] = nx; sh.pos[2] = nz; sh.push -= 1; }
      }
    } else if (sh.state === 'recoil') {
      const k = STD.recoilDist / STD.recoilTicks;
      sh.pos[0] += sh.recoilDir[0] * k; sh.pos[2] += sh.recoilDir[1] * k;
      sh.stateTicks -= 1;
      keepOutOfSafe(s, sh);
    } else if (sh.state === 'wander' || sh.state === 'chase') {
      if (sh.state === 'wander' && alive && dist <= STD.shadeDetect + EPS) sh.state = 'chase';
      else if (sh.state === 'chase' && (!alive || dist > STD.shadeLose + EPS)) sh.state = 'wander';
      const v = sh.state === 'chase' ? speed : (alive ? STD.shadeWanderSpeed : 0);
      if (v > 0 && dist > 1e-9) {
        const k = Math.min(v * DT, dist) / dist;
        sh.pos[0] += (p.pos[0] - sh.pos[0]) * k;
        sh.pos[2] += (p.pos[2] - sh.pos[2]) * k;
      }
      keepOutOfSafe(s, sh);
    }
    sh.pos[1] = flyBase(s, sh.pos[0], sh.pos[2]) + STD.shadeY;
  }
  for (const d of s.drifters) {
    if (d.state === 'removed') continue;
    const dist = dXZ(d.pos, p.pos);
    if (d.state === 'idle' || d.state === 'chase') {
      const want = alive && p.carried >= STD.drifterMinCarry && dist <= STD.drifterDetect + EPS && d.stolen === 0;
      if (d.state === 'idle' && want) d.state = 'chase';
      else if (d.state === 'chase' && !want) {
        d.state = 'idle'; d.anchor = [d.pos[0] - STD.drifterIdleRadius, d.pos[2]]; d.ang = 0;
      }
    }
    if (d.state === 'idle') {
      d.ang += (STD.drifterIdleSpeed / STD.drifterIdleRadius) * DT;
      d.pos[0] = d.anchor[0] + STD.drifterIdleRadius * Math.cos(d.ang);
      d.pos[2] = d.anchor[1] + STD.drifterIdleRadius * Math.sin(d.ang);
    } else if (d.state === 'chase' && dist > 1e-9) {
      const k = Math.min(STD.drifterSpeed * DT, dist) / dist;
      d.pos[0] += (p.pos[0] - d.pos[0]) * k;
      d.pos[2] += (p.pos[2] - d.pos[2]) * k;
    } else if (d.state === 'flee') {
      let dx = d.pos[0] - p.pos[0], dz = d.pos[2] - p.pos[2];
      const l = Math.hypot(dx, dz);
      if (l < 1e-9) { dx = 1; dz = 0; } else { dx /= l; dz /= l; }
      d.pos[0] += dx * STD.drifterSpeed * DT; d.pos[2] += dz * STD.drifterSpeed * DT;
    }
    d.pos[1] = flyBase(s, d.pos[0], d.pos[2]) + STD.drifterY;
  }

  // ---- 9. Chạm: Gió Lạc cướp trước, rồi Bóng Mực gây hit (id tăng dần)
  if (alive) {
    for (const d of [...s.drifters].sort(byId)) {
      if (d.state !== 'chase' || p.carried <= 0) continue;
      if (dXZ(d.pos, p.pos) <= STD.drifterTouch + EPS) {
        const amount = Math.min(STD.drifterSteal, p.carried);
        p.carried -= amount;
        d.stolen = amount;
        d.state = 'flee';
        d.flee = STD.drifterFlee;
        ev('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
      }
    }
    if (p.invuln === 0) {
      for (const sh of [...s.shades].sort(byId)) {
        if ((sh.state !== 'chase' && sh.state !== 'wander') || sh.evict > 0) continue;
        if (dXZ(sh.pos, p.pos) <= T.shade_hit_radius + EPS && Math.abs(sh.pos[1] - p.pos[1]) <= STD.hitDy + EPS) {
          const dropped = Math.floor(p.carried * T.hit_drop_ratio + EPS);
          p.carried -= dropped;
          for (let i = 0; i < dropped; i++) {
            const a = s.rngMisc() * 2 * Math.PI;
            const r = STD.dropRingMin + s.rngMisc() * (STD.dropRingMax - STD.dropRingMin);
            let x = p.pos[0] + r * Math.cos(a), z = p.pos[2] + r * Math.sin(a);
            let g = surface(s, x, z);
            if (g === null) { x = p.pos[0]; z = p.pos[2]; g = surface(s, x, z) ?? p.pos[1]; }
            addMote(s, [r3(x), g, r3(z)], 'dropped', STD.dropTtl, tick);
          }
          p.flames -= 1;
          p.invuln = sec(T.invuln_s);
          let rx = sh.pos[0] - p.pos[0], rz = sh.pos[2] - p.pos[2];
          const rl = Math.hypot(rx, rz);
          if (rl < 1e-9) { rx = 1; rz = 0; } else { rx /= rl; rz /= rl; }
          sh.state = 'recoil'; sh.stateTicks = STD.recoilTicks; sh.recoilDir = [rx, rz];
          s.fx.push('hit');
          ev('player_hit', { by: 'shade', flames: p.flames, dropped });
          break;
        }
      }
    }
  }

  // ---- 10. Sinh theo lịch (thực thể mới tương tác từ tick sau)
  if (s.randomMotes && st % STD.moteSpawnEvery === 0 && s.motes.length < STD.moteCap) {
    const taken = new Set(s.motes.filter((m) => m.spawnIdx >= 0).map((m) => m.spawnIdx));
    const free = M.moteSpawns.map((_, i) => i).filter((i) => !taken.has(i));
    if (free.length) { const i = pick(s.rngMotes, free); addMote(s, M.moteSpawns[i], 'random', 0, tick, i); }
  }
  if (s.randomShades && st >= STD.shadeFirstSpawn && (st - STD.shadeFirstSpawn) % M.shadeInterval === 0) {
    const n = st === STD.shadeFirstSpawn ? STD.shadeFirstCount : 1;
    for (let k = 0; k < n; k++) {
      if (s.shades.length >= M.shadeMax) break;
      const valid = M.shadeSpawns.filter((q) => dXZ(q, p.pos) >= STD.shadeMinSpawnDist - EPS &&
        !s.shades.some((sh) => sh.state === 'spawning' && dXZ(sh.pos, q) < 0.5));
      if (!valid.length) break;
      const q = pick(s.rngShades, valid);
      const id = nextId(s, 'shadeCounter', 'S', s.usedShadeIds);
      s.usedShadeIds.add(id);
      s.shades.push(makeShade(s, id, [q[0], flyBase(s, q[0], q[2]) + STD.shadeY, q[2]]));
      s.fx.push('shade');
      ev('shade_spawned', { id });
    }
  }
  if (s.randomDrifters && st % STD.drifterEvery === 0 && s.drifters.filter((d) => d.state !== 'removed').length < STD.drifterMax) {
    const q = pick(s.rngMisc, M.shadeSpawns);
    const id = nextId(s, 'drifterCounter', 'D', s.usedDrifterIds);
    s.usedDrifterIds.add(id);
    const d = makeDrifter(id, [q[0], flyBase(s, q[0], q[2]) + STD.drifterY, q[2]]);
    s.drifters.push(d);
  }

  // ---- 11. Thắng / thua
  if (p.flames <= 0) end(s, 'lost', 'no_flames', ev);
  else if (litCount(s) === s.lanterns.length) end(s, 'won', 'all_lit', ev);
  else if (timeLeft(s) <= EPS) end(s, 'lost', 'dawn', ev);
  return events;
}

function end(s, result, reason, ev) {
  s.state = result;
  s.reason = reason;
  if (result === 'won') {
    const bt = Math.floor(Math.max(0, timeLeft(s)) + EPS) * s.T.score.per_second_left;
    const bf = s.player.flames * s.T.score.per_flame_left;
    s.stats.bonusTime = bt; s.stats.bonusFlames = bf;
    s.score += bt + bf;
  }
  ev('game_over', { result, reason });
}

function movePlayer(s, input, E, ev) {
  const T = s.T, p = s.player;
  if (p.respawn > 0) {
    p.respawn -= 1;
    if (p.respawn === 0) {
      p.pos = [...s.M.start]; p.vel = [0, 0, 0]; p.grounded = true;
      p.invuln = STD.invulnTicks; p.launch = null; p.dashTicks = 0;
    }
    return;
  }
  // hướng di chuyển theo camera (công thức contract)
  let [mx, mz] = input.move || [0, 0];
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  const wl = Math.hypot(wx, wz);
  if (wl > 1e-9) p.facing = [wx / wl, wz / wl];

  // Lướt
  if (E.dash && p.dashTicks === 0 && (p.charm > 0 || p.dashCd === 0)) {
    p.dashTicks = sec(T.dash_duration_s);
    p.dashDir = wl > 1e-9 ? [wx / wl, wz / wl] : [...p.facing];
    if (p.charm === 0) p.dashCd = sec(T.dash_cooldown_s);
    p.vel[1] = 0;
    s.fx.push('dash');
    ev('dash', {});
  }
  const dashing = p.dashTicks > 0;
  // Nhảy (chỉ khi chạm đất)
  if (E.jump && p.grounded && !dashing) { p.vel[1] = STD.jumpSpeed; p.grounded = false; s.fx.push('jump'); }

  const run = p.charm > 0 ? STD.charmSpeed : T.player_speed;
  let hx, hz;
  if (dashing) { hx = p.dashDir[0] * T.dash_speed; hz = p.dashDir[1] * T.dash_speed; }
  else if (p.launch) { [hx, hz] = p.launch; }
  else { hx = wx * run; hz = wz * run; }
  if (s.wind.active) {
    const a = (s.wind.dirDeg * Math.PI) / 180;
    hx += Math.cos(a) * STD.windSpeed; hz += Math.sin(a) * STD.windSpeed;
  }

  // Di chuyển ngang, chặn bởi vách
  const tryMove = (nx, nz) => {
    const g = surface(s, nx, nz);
    if (g === null) return true;
    const limit = p.grounded ? p.pos[1] + STD.stepUp : p.pos[1] + 1e-6;
    return g <= limit;
  };
  const nx = p.pos[0] + hx * DT, nz = p.pos[2] + hz * DT;
  if (tryMove(nx, nz)) { p.pos[0] = nx; p.pos[2] = nz; }
  else if (tryMove(nx, p.pos[2])) { p.pos[0] = nx; hz = 0; }
  else if (tryMove(p.pos[0], nz)) { p.pos[2] = nz; hx = 0; }
  else { hx = 0; hz = 0; }

  // Dọc
  if (dashing) {
    p.vel[1] = 0;
    const g = surface(s, p.pos[0], p.pos[2]);
    if (p.grounded) {
      if (g === null || g < p.pos[1] - STD.stepUp) p.grounded = false;
      else p.pos[1] = g;
    }
    p.dashTicks -= 1;
  } else {
    if (p.grounded) {
      const g = surface(s, p.pos[0], p.pos[2]);
      if (g === null || g < p.pos[1] - STD.stepUp) p.grounded = false;
      else { p.pos[1] = g; p.vel[1] = 0; }
    }
    if (!p.grounded) {
      const prevY = p.pos[1];
      p.vel[1] -= STD.gravity * DT;
      p.pos[1] += p.vel[1] * DT;
      const g = surface(s, p.pos[0], p.pos[2]);
      // chỉ đáp khi đi qua mặt đất từ phía trên (không "kéo" người đang ở dưới đảo lên)
      if (g !== null && p.vel[1] <= 0 && p.pos[1] <= g && prevY >= g - 1e-6) {
        p.pos[1] = g; p.vel[1] = 0; p.grounded = true; p.launch = null;
      }
    }
  }
  p.vel[0] = hx; p.vel[2] = hz;

  // Bục nhảy
  if (p.grounded) {
    for (const pad of s.M.pads) {
      if (dXZ(p.pos, pad.pos) <= pad.r + EPS && Math.abs(p.pos[1] - pad.pos[1]) < 0.05) {
        let dx, dz;
        if (pad.dir) [dx, dz] = pad.dir;
        else { dx = pad.toward[0] - p.pos[0]; dz = pad.toward[2] - p.pos[2]; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
        p.launch = [dx * pad.h, dz * pad.h];
        p.vel = [p.launch[0], pad.vy, p.launch[1]];
        p.grounded = false;
        s.fx.push('pad');
        break;
      }
    }
  }

  // Rơi khỏi đảo
  if (T.fall_enabled !== false && p.pos[1] < STD.fallY) {
    const lost = p.carried;
    p.carried = 0;
    p.flames -= 1;
    p.respawn = STD.respawnWait;
    p.vel = [0, 0, 0]; p.launch = null; p.dashTicks = 0;
    s.fx.push('hit');
    ev('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
  }
}

function insideSafe(s, x, z) {
  return s.lanterns.some((l) => l.lit && Math.hypot(x - l.pos[0], z - l.pos[2]) < s.T.safe_radius);
}
function keepOutOfSafe(s, sh) {
  const R = s.T.safe_radius;
  for (const l of s.lanterns) {
    if (!l.lit) continue;
    let dx = sh.pos[0] - l.pos[0], dz = sh.pos[2] - l.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < R) {
      if (d < 1e-9) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
      sh.pos[0] = l.pos[0] + dx * (R + STD.safeMargin);
      sh.pos[2] = l.pos[2] + dz * (R + STD.safeMargin);
    }
  }
}

const P3 = (v) => [r3(v[0]), r3(v[1]), r3(v[2])];
export function snapshot(s) {
  const p = s.player;
  return {
    type: 'snapshot',
    tick: s.tick,
    sim_tick: s.steps,
    night: s.night,
    state: s.state,
    time_left_s: r3(Math.max(0, timeLeft(s))),
    score: s.score,
    wind: { active: s.wind.active, dir_deg: s.wind.dirDeg },
    player: {
      pos: P3(p.pos), flames: p.flames, carried: p.carried,
      vel: P3(p.vel), grounded: p.grounded, invuln: p.invuln > 0,
      dash_cd_s: r3(p.dashCd / TICK_RATE), pulse_cd_s: r3(p.pulseCd / TICK_RATE), charm_s: r3(p.charm / TICK_RATE),
    },
    lanterns: s.lanterns.map((l) => ({ id: l.id, pos: P3(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: s.shades.map((sh) => ({ id: sh.id, pos: P3(sh.pos), state: sh.state })),
    motes_active: s.motes.length,
    motes: s.motes.map((m) => ({ id: m.id, pos: P3(m.pos), kind: m.kind, ttl_s: m.kind === 'dropped' ? r3(m.ttl / TICK_RATE) : null })),
    drifters: s.drifters.map((d) => ({ id: d.id, pos: P3(d.pos), state: d.state, stolen: d.stolen })),
    charms: s.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: r3(c.respawn / TICK_RATE) })),
  };
}
