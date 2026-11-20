// Đảo Đèn Lồng — lõi mô phỏng tất định (không phụ thuộc DOM/GPU).
// Dùng chung cho chế độ headless (src/headless.js) và bản web (web/main.js).
// Mọi số "tuning" lấy từ game.contract.json; các hằng số thế giới khác nằm trong WORLD.

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
const EPS = 1e-6; // dung sai so sánh khoảng cách ("trong bán kính r" = dist <= r)

export const WORLD = {
  islandRadius: 30,        // người chơi bị giữ trong đảo (fall_enabled = false)
  lanternRingRadius: 20,   // 5 đèn đặt đều trên vòng tròn bán kính 20 m
  moteCount: 30,           // số đom đóm sinh ngẫu nhiên (cần 15 để thắp 5 đèn)
  moteMinR: 3,
  moteMaxR: 28,
  shadeSpawnRadius: 40,    // Bóng Mực xuất hiện từ sương ngoài mép đảo
  shadeFirstSpawnTick: 300,  // 5 s
  shadeSpawnEveryTicks: 1200, // 20 s
  shadeMax: 4,             // tối đa 4 con sinh ngẫu nhiên mỗi đêm
  shadeY: 1.0,             // tâm Bóng Mực cao 1 m
  jumpSpeed: 7,
  gravity: 20,
  safeMargin: 0.01,        // Bóng Mực bị đẩy ra tới safe_radius + 0.01 (luôn ở NGOÀI bán kính)
};

export const LANTERN_IDS = ['L1', 'L2', 'L3', 'L4', 'L5'];

// PRNG tất định (mulberry32)
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

export const r3 = (v) => {
  const x = Math.round(v * 1000) / 1000;
  return x === 0 ? 0 : x; // tránh -0
};
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const secToTicks = (s) => Math.round(s * TICK_RATE);

export function defaultLanternPos(i) {
  const a = (i * 2 * Math.PI) / 5;
  return [r3(WORLD.lanternRingRadius * Math.sin(a)), 0, r3(WORLD.lanternRingRadius * Math.cos(a))];
}

/**
 * Tạo trạng thái game.
 * @param {object} opts
 * @param {object} opts.tuning   — object "tuning" của game.contract.json
 * @param {number} opts.seed
 * @param {object} [opts.scenario] — scenario theo Test Contract mục D (đã được kiểm tra hợp lệ)
 */
export function createGame({ tuning, seed, scenario = null }) {
  const T = tuning;
  const sc = scenario || {};
  const rngMotes = mulberry32(seed);
  const rngShades = mulberry32((seed ^ 0x9e3779b9) >>> 0);

  const s = {
    T, seed, rngShades,
    state: 'playing',
    reason: null,
    steps: 0,
    score: 0,
    timeLeft0: sc.time_left_s ?? T.night1_duration_s,
    player: {
      pos: [0, 0, 0], vy: 0, flames: T.flames, carried: 0,
      invuln: 0, pulseCd: 0, facing: 0,
    },
    lanterns: [],
    motes: [],
    shades: [],
    shadeCounter: 0,
    randomShades: sc.random_shades !== false,
    randomSpawns: 0,
    prevButtons: { jump: false, interact: false, pulse: false, dash: false },
    stats: { motes: 0, lanterns: 0, stuns: 0, bonusTime: 0, bonusFlames: 0 },
    lastPulseTick: -1,
  };

  // Người chơi
  if (sc.player) {
    if (sc.player.pos) s.player.pos = [...sc.player.pos];
    if (sc.player.carried != null) s.player.carried = sc.player.carried;
    if (sc.player.flames != null) s.player.flames = sc.player.flames;
  }

  // Đèn
  for (let i = 0; i < T.lantern_count_night1; i++) {
    s.lanterns.push({ id: LANTERN_IDS[i], pos: defaultLanternPos(i), lit: false, deposited: 0 });
  }
  for (const l of sc.lanterns || []) {
    const L = s.lanterns.find((x) => x.id === l.id);
    if (l.pos) L.pos = [...l.pos];
    if (l.deposited != null) L.deposited = l.deposited;
    if (l.lit != null) L.lit = l.lit;
    if (L.deposited >= T.lantern_cost) L.lit = true;
  }

  // Đom đóm: luôn rút số ngẫu nhiên theo cùng thứ tự để tất định
  const randomMotes = [];
  for (let i = 0; i < WORLD.moteCount; i++) {
    const a = rngMotes() * 2 * Math.PI;
    const r = WORLD.moteMinR + Math.sqrt(rngMotes()) * (WORLD.moteMaxR - WORLD.moteMinR);
    randomMotes.push([r3(r * Math.sin(a)), 0, r3(r * Math.cos(a))]);
  }
  let motePos;
  if (sc.motes) motePos = sc.motes;
  else if (sc.random_motes === false) motePos = [];
  else motePos = randomMotes;
  s.motes = motePos.map((p, i) => ({ id: `M${i + 1}`, pos: [...p], active: true }));

  // Bóng Mực trong scenario (không phát sự kiện)
  const used = new Set((sc.shades || []).filter((x) => x.id).map((x) => x.id));
  for (const sh of sc.shades || []) {
    const id = sh.id || nextShadeId(s, used);
    used.add(id);
    s.shades.push(makeShade(id, sh.pos));
  }
  s.usedShadeIds = used;
  return s;
}

function nextShadeId(s, used) {
  let id;
  do { s.shadeCounter += 1; id = `S${s.shadeCounter}`; } while (used.has(id));
  return id;
}
function makeShade(id, pos) {
  return { id, pos: [...pos], state: 'chase', stun: 0 };
}

export function timeLeft(s) {
  return s.timeLeft0 - s.steps / TICK_RATE;
}
export function litCount(s) {
  return s.lanterns.filter((l) => l.lit).length;
}

function endGame(s, result, reason, ev) {
  s.state = result;
  s.reason = reason;
  if (result === 'won') {
    const bt = Math.floor(Math.max(0, timeLeft(s)) + EPS) * s.T.score.per_second_left;
    const bf = s.player.flames * s.T.score.per_flame_left;
    s.stats.bonusTime = bt;
    s.stats.bonusFlames = bf;
    s.score += bt + bf;
  }
  ev('game_over', { result, reason });
}

/**
 * Chạy MỘT bước mô phỏng (1/60 s).
 * @param {object} s — trạng thái
 * @param {object} input — { move:[x,z], cam_yaw_deg, jump, interact, pulse, dash } (giá trị đang giữ)
 * @returns {Array} danh sách sự kiện {type:'event', tick, name, data}
 */
export function step(s, input) {
  const events = [];
  if (s.state !== 'playing') return events;
  const T = s.T;
  s.steps += 1;
  const tick = s.steps;
  const ev = (name, data) => events.push({ type: 'event', tick, name, data });
  const p = s.player;

  // Nút kích hoạt theo cạnh lên (false -> true)
  const edge = (k) => !!input[k] && !s.prevButtons[k];
  const jumpE = edge('jump'), interactE = edge('interact'), pulseE = edge('pulse');
  for (const k of Object.keys(s.prevButtons)) s.prevButtons[k] = !!input[k];

  // Bộ đếm thời gian
  if (p.invuln > 0) p.invuln -= 1;
  if (p.pulseCd > 0) p.pulseCd -= 1;
  for (const sh of s.shades) {
    if (sh.stun > 0) {
      sh.stun -= 1;
      if (sh.stun === 0) sh.state = 'chase';
    }
  }

  // 1) Di chuyển người chơi
  let [mx, mz] = input.move || [0, 0];
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  p.pos[0] += wx * T.player_speed * DT;
  p.pos[2] += wz * T.player_speed * DT;
  if (wx !== 0 || wz !== 0) p.facing = Math.atan2(wx, wz);
  const rr = Math.hypot(p.pos[0], p.pos[2]);
  if (rr > WORLD.islandRadius) {
    p.pos[0] *= WORLD.islandRadius / rr;
    p.pos[2] *= WORLD.islandRadius / rr;
  }
  // Nhảy
  if (jumpE && p.pos[1] <= 0 && p.vy === 0) p.vy = WORLD.jumpSpeed;
  if (p.pos[1] > 0 || p.vy !== 0) {
    p.vy -= WORLD.gravity * DT;
    p.pos[1] += p.vy * DT;
    if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; }
  }

  // 2) Nhặt đom đóm (tự động khi trong pickup_radius và còn chỗ)
  for (const m of s.motes) {
    if (!m.active || p.carried >= T.carry_capacity) continue;
    if (distXZ(p.pos, m.pos) <= T.pickup_radius + EPS) {
      m.active = false;
      p.carried += 1;
      s.score += T.score.per_mote;
      s.stats.motes += 1;
      ev('mote_picked', { carried: p.carried });
    }
  }

  // 3) Nạp đèn (interact) — đèn chưa thắp gần nhất trong interact_radius
  if (interactE && p.carried > 0) {
    let best = null, bestD = Infinity;
    for (const l of s.lanterns) {
      if (l.lit) continue;
      const d = distXZ(p.pos, l.pos);
      if (d <= T.interact_radius + EPS && d < bestD) { best = l; bestD = d; }
    }
    if (best) {
      const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
      if (amount > 0) {
        p.carried -= amount;
        best.deposited += amount;
        ev('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
        if (best.deposited >= T.lantern_cost) {
          best.lit = true;
          s.score += T.score.per_lantern;
          s.stats.lanterns += 1;
          ev('lantern_lit', { lantern_id: best.id });
          if (litCount(s) === s.lanterns.length) {
            endGame(s, 'won', 'all_lit', ev);
            return events;
          }
        }
      }
    }
  }

  // 4) Tỏa sáng (pulse)
  if (pulseE && p.pulseCd === 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCd = secToTicks(T.pulse_cooldown_s);
    s.lastPulseTick = tick;
    const ids = [];
    for (const sh of s.shades) {
      const d = distXZ(p.pos, sh.pos);
      if (d <= T.pulse_radius + EPS) {
        sh.state = 'stunned';
        sh.stun = secToTicks(T.pulse_stun_s);
        let dx = sh.pos[0] - p.pos[0], dz = sh.pos[2] - p.pos[2];
        const dl = Math.hypot(dx, dz);
        if (dl < 1e-9) { dx = 1; dz = 0; } else { dx /= dl; dz /= dl; }
        sh.pos[0] += dx * T.pulse_push_m;
        sh.pos[2] += dz * T.pulse_push_m;
        keepOutOfSafeZones(s, sh);
        ids.push(sh.id);
        s.score += T.score.per_stun;
        s.stats.stuns += 1;
      }
    }
    ev('pulse', { stunned_ids: ids });
  }

  // 5) Sinh Bóng Mực ngẫu nhiên
  if (s.randomShades && s.randomSpawns < WORLD.shadeMax &&
      tick >= WORLD.shadeFirstSpawnTick &&
      (tick - WORLD.shadeFirstSpawnTick) % WORLD.shadeSpawnEveryTicks === 0) {
    const a = s.rngShades() * 2 * Math.PI;
    const id = nextShadeId(s, s.usedShadeIds);
    s.usedShadeIds.add(id);
    s.shades.push(makeShade(id, [
      r3(WORLD.shadeSpawnRadius * Math.sin(a)), WORLD.shadeY, r3(WORLD.shadeSpawnRadius * Math.cos(a)),
    ]));
    s.randomSpawns += 1;
    ev('shade_spawned', { id });
  }

  // 6) Bóng Mực đuổi theo người chơi, không vào được vùng an toàn của đèn đã thắp
  const stepLen = T.shade_speed * DT;
  for (const sh of s.shades) {
    if (sh.state === 'stunned') continue;
    const dx = p.pos[0] - sh.pos[0], dz = p.pos[2] - sh.pos[2];
    const d = Math.hypot(dx, dz);
    if (d > 1e-9) {
      const k = Math.min(stepLen, d) / d;
      sh.pos[0] += dx * k;
      sh.pos[2] += dz * k;
    }
    keepOutOfSafeZones(s, sh);
  }

  // 7) Va chạm Bóng Mực -> mất 1 Ngọn Lửa, rơi một phần đom đóm
  if (p.invuln === 0) {
    for (const sh of s.shades) {
      if (sh.state === 'stunned') continue;
      if (distXZ(p.pos, sh.pos) <= T.shade_hit_radius + EPS) {
        const dropped = Math.floor(p.carried * T.hit_drop_ratio + EPS);
        p.carried -= dropped;
        p.flames -= 1;
        p.invuln = secToTicks(T.invuln_s);
        ev('player_hit', { by: 'shade', flames: p.flames, dropped });
        if (p.flames <= 0) {
          endGame(s, 'lost', 'no_flames', ev);
          return events;
        }
        break; // tối đa một lần bị chạm mỗi bước
      }
    }
  }

  // 8) Hết đêm -> bình minh -> thua
  if (timeLeft(s) <= EPS) {
    endGame(s, 'lost', 'dawn', ev);
    return events;
  }
  // Trường hợp scenario dựng sẵn mọi đèn đã thắp
  if (litCount(s) === s.lanterns.length) endGame(s, 'won', 'all_lit', ev);
  return events;
}

const P3 = (p) => [r3(p[0]), r3(p[1]), r3(p[2])];

export function snapshot(s) {
  return {
    type: 'snapshot',
    tick: s.steps,
    sim_tick: s.steps,
    state: s.state,
    time_left_s: r3(Math.max(0, timeLeft(s))),
    score: s.score,
    player: { pos: P3(s.player.pos), flames: s.player.flames, carried: s.player.carried },
    lanterns: s.lanterns.map((l) => ({ id: l.id, pos: P3(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: s.shades.map((sh) => ({ id: sh.id, pos: P3(sh.pos), state: sh.state })),
    motes_active: s.motes.filter((m) => m.active).length,
    motes: s.motes.filter((m) => m.active).map((m) => ({ id: m.id, pos: P3(m.pos) })),
  };
}

function keepOutOfSafeZones(s, sh) {
  const R = s.T.safe_radius;
  if (R == null) return;
  for (const l of s.lanterns) {
    if (!l.lit) continue;
    let dx = sh.pos[0] - l.pos[0], dz = sh.pos[2] - l.pos[2];
    const d = Math.hypot(dx, dz);
    if (d <= R) {
      if (d < 1e-9) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
      sh.pos[0] = l.pos[0] + dx * (R + WORLD.safeMargin);
      sh.pos[2] = l.pos[2] + dz * (R + WORLD.safeMargin);
    }
  }
}
