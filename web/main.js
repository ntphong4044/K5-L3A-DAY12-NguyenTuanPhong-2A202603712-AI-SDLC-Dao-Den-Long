// Bản web 3D: hiển thị + điều khiển + menu. Toàn bộ luật chơi nằm trong src/core/sim.js
// (cùng lõi với headless), bước cố định 60 tick/giây.
import * as THREE from 'three';
import { createGame, step, timeLeft, litCount, DT, STD } from '/src/core/sim.js';
import { getMap } from '/src/core/maps.js';
import { createBot } from '/src/core/bot.js';
import { Sound } from '/web/audio.js';

const contract = await (await fetch('/game.contract.json')).json();
const T = contract.tuning;
const qs = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

// ---------- Bảng màu chuẩn (Ticket-02) ----------
const C = {
  night: '#0E1430', fog: '#1B2350', grass: '#2F5D50', sand: '#C9B48A', wood: '#6B4A2F', sea: '#12384A',
  lit: '#FFB347', core: '#FFE9B0', off: '#5B5F6E', moteCore: '#FFF6C2', moteHalo: '#FFE58A',
  shade: '#120A1A', shadeRim: '#7A3CFF', stunned: '#3A3450', shirt: '#E8E2D0', red: '#C8102E', gold: '#F2C14E', drifter: '#8FA3B8',
};

// ---------- Cài đặt (lưu giữa các lần mở) ----------
const settings = { volume: 0.6, sensitivity: 1 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') || '{}')); } catch {}
const saveSettings = () => { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch {} };
const sound = new Sound();
sound.setVolume(settings.volume);

// ---------- Renderer / cảnh ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: qs.has('shot') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.night);
scene.fog = new THREE.Fog(C.fog, 30, 140);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
const ambient = new THREE.AmbientLight('#b8c4ff', 0.15);
scene.add(ambient);
const moon = new THREE.DirectionalLight('#9fb0ff', 0.45);
moon.position.set(-30, 60, 20);
scene.add(moon);
const sea = new THREE.Mesh(new THREE.CircleGeometry(300, 48), new THREE.MeshStandardMaterial({ color: C.sea, roughness: 1 }));
sea.rotation.x = -Math.PI / 2; sea.position.y = -12;
scene.add(sea);

const M = (color, emissive = '#000', ei = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.85, ...extra });

// ---------- Địa hình theo bản đồ chuẩn ----------
let world = new THREE.Group();
scene.add(world);
function disk(r, h, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 64), M(color));
  m.position.set(x, y - h / 2, z);
  return m;
}
function buildWorld(map) {
  scene.remove(world);
  world = new THREE.Group();
  const add = (o) => (world.add(o), o);
  if (map.night === 1) {
    add(disk(40, 4, C.sand)); add(disk(38.5, 0.2, C.grass, 0, 0.1));
  } else if (map.night === 2) {
    for (const x of [0, 70]) { add(disk(28, 4, C.sand, x)); add(disk(26.5, 0.2, C.grass, x, 0.1)); }
    const bridge = add(new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), M(C.wood)));
    bridge.position.set(35, -0.15, 0);
    for (let x = 26.5; x <= 43.5; x += 1) { const plank = add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.32, 4), M('#4a3220'))); plank.position.set(x, -0.1, 0); }
  } else {
    add(disk(45, 4, C.sand)); add(disk(43.5, 0.2, C.grass, 0, 0.1));
    // tầng 1: nửa vành khăn z > 0 (shape (x,y) -> world (x, -y) sau khi xoay)
    const sh = new THREE.Shape();
    const N = 48;
    for (let i = 0; i <= N; i++) { const a = Math.PI * i / N; sh.lineTo(24 * Math.cos(a), -24 * Math.sin(a)); }
    for (let i = N; i >= 0; i--) { const a = Math.PI * i / N; sh.lineTo(12 * Math.cos(a), -12 * Math.sin(a)); }
    const t1 = add(new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false, curveSegments: 48 }), M('#3f6f5f')));
    t1.rotation.x = -Math.PI / 2;
    add(disk(8, 6, '#4a7a6a', 0, 6));
    const tower = add(new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 8, 24), M(C.wood)));
    tower.position.set(0, 10, 0);
    const bell = add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(C.gold, C.gold, 0.3)));
    bell.position.set(0, 13.6, 0);
    for (const deg of [30, 150]) {
      const a = (deg * Math.PI) / 180;
      const len = Math.hypot(6, 3);
      const ramp = add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 3), M(C.wood)));
      ramp.position.set(27 * Math.cos(a), 1.5, 27 * Math.sin(a));
      ramp.rotation.order = 'YZX';
      ramp.rotation.y = -a;
      ramp.rotation.z = -Math.atan2(3, 6); // đầu cao ở phía trong (r = 24)
    }
  }
  for (const pad of map.pads) {
    const m = add(new THREE.Mesh(new THREE.CylinderGeometry(pad.r, pad.r, 0.15, 24), M(C.gold, C.lit, 0.8)));
    m.position.set(pad.pos[0], pad.pos[1] + 0.08, pad.pos[2]);
  }
  scene.add(world);
}

// ---------- Nhân vật Mây ----------
function makeMay() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.6, 4, 12), M(C.shirt));
  body.position.y = 0.65; g.add(body);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 16), M(C.red));
  scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.08; g.add(scarf);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), M('#f1d3b3'));
  head.position.y = 1.35; g.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.38, 24), M(C.sand));
  hat.position.y = 1.68; g.add(hat);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), M(C.lit, C.lit, 2));
  lamp.position.set(0.5, 1.3, 0.25); g.add(lamp);
  const light = new THREE.PointLight(C.lit, 4, 9, 1.5);
  light.position.copy(lamp.position); g.add(light);
  return { g, lamp, light };
}
const may = makeMay();
scene.add(may.g);
const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: C.core, transparent: true, opacity: 0, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2;
scene.add(pulseRing);
// lá bay báo gió
const leaves = new THREE.Group();
for (let i = 0; i < 40; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.12), new THREE.MeshBasicMaterial({ color: '#7fb069', side: THREE.DoubleSide })); leaves.add(l); }
leaves.visible = false;
scene.add(leaves);

// ---------- Thực thể động ----------
const dyn = new THREE.Group();
scene.add(dyn);
let views = {};
const moteGeo = new THREE.SphereGeometry(0.13, 10, 8), haloGeo = new THREE.SphereGeometry(0.28, 10, 8);
const moteMat = M(C.moteCore, C.moteCore, 3), haloMat = new THREE.MeshBasicMaterial({ color: C.moteHalo, transparent: true, opacity: 0.35 });
const shadeGeo = new THREE.SphereGeometry(0.8, 18, 12), rimGeo = new THREE.SphereGeometry(0.88, 18, 12);
function makeLantern(l) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3, 8), M(C.wood)); pole.position.y = 1.5; g.add(pole);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 8), M(C.off)); head.position.y = 3.4; g.add(head);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 8), M(C.red)); roof.position.y = 4.05; g.add(roof);
  const light = new THREE.PointLight(C.lit, 0, 26, 1.3); light.position.y = 3.4; g.add(light);
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.1, T.safe_radius, 64), new THREE.MeshBasicMaterial({ color: C.lit, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
  g.position.set(...l.pos);
  dyn.add(g);
  return { g, head, light, ring };
}
function makeShade() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(shadeGeo, M(C.shade, C.shade, 0, { transparent: true, opacity: 0.95 }));
  const rim = new THREE.Mesh(rimGeo, new THREE.MeshBasicMaterial({ color: C.shadeRim, transparent: true, opacity: 0.25, side: THREE.BackSide }));
  g.add(body, rim);
  dyn.add(g);
  return { g, body, rim };
}
function makeDrifter() {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(2.2, 0.35, 12, 1);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: C.drifter, emissive: C.drifter, emissiveIntensity: 0.3, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  g.add(m); dyn.add(g);
  return { g, m, base: geo.attributes.position.array.slice() };
}
function makeCharm(c) {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.05), M(C.red, C.red, 0.4));
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.03), M(C.gold, C.gold, 0.5));
  g.add(rim, paper); g.position.set(c.pos[0], c.pos[1] + 1, c.pos[2]);
  dyn.add(g);
  return g;
}

// ---------- Trạng thái màn hình ----------
let game = null, map = null, night = 1, totals = [], phase = 'menu', returnTo = 'menu', bot = null, pulseAnim = 0, lastCountdown = -1, windWarned = false;
const INTRO = {
  1: ['Đêm 1 – Đảo Bến', 'Ông Đăng: "Sương đen đã tràn vào bến. Năm ngọn Đèn Lồng Lớn đang chờ con, Mây ạ. Gom đom đóm, thắp từng ngọn một."'],
  2: ['Đêm 2 – Đảo Cau', 'Ông Đăng: "Hai hòn đảo, một cây cầu tre. Cẩn thận Gió Lạc, chúng thích những ai mang nhiều ánh sáng. Bục vàng sẽ đưa con bay qua biển mây."'],
  3: ['Đêm 3 – Đảo Chuông', 'Ông Đăng: "Đêm cuối rồi. Tháp chuông ở tầng cao nhất, gió đổi chiều liên tục. Thắp đủ bảy ngọn, bình minh sẽ về."'],
};

function card(html) { $('card').innerHTML = html; $('screen').classList.remove('hidden'); const b = $('card').querySelector('button'); if (b) b.focus(); }
function hideCard() { $('screen').classList.add('hidden'); }
function bind(id, fn) { const el = $(id); if (el) el.onclick = () => { sound.ensure(); fn(); }; }

function showMenu() {
  phase = 'menu'; $('hudroot').classList.add('hidden');
  card(`<h1>Đảo Đèn Lồng</h1><p>Ba đêm, ba hòn đảo. Giúp Mây thắp lại Đèn Lồng Lớn trước bình minh.</p>
    <p><kbd>WASD</kbd> đi · <kbd>←</kbd><kbd>→</kbd>/kéo chuột: camera · <kbd>Space</kbd> nhảy · <kbd>Shift</kbd> lướt · <kbd>E</kbd> nạp ánh sáng · <kbd>Q</kbd> tỏa sáng · <kbd>Esc</kbd>/<kbd>P</kbd> tạm dừng</p>
    <div class="btns"><button id="b-start">Bắt đầu</button><button class="ghost" id="b-set">Cài đặt</button></div>`);
  bind('b-start', () => { totals = []; showIntro(1); });
  bind('b-set', () => showSettings('menu'));
}
function showIntro(n) {
  night = n; phase = 'intro';
  const [title, quote] = INTRO[n];
  card(`<h2>${title}</h2><p class="quote">${quote}</p><div class="btns"><button id="b-go">Bắt đầu đêm</button></div>`);
  bind('b-go', () => startNight(n));
}
function showSettings(from) {
  returnTo = from; phase = 'settings';
  card(`<h2>Cài đặt</h2>
    <label>Âm lượng <input type="range" id="s-vol" min="0" max="100" value="${Math.round(settings.volume * 100)}"><span id="s-vol-v">${Math.round(settings.volume * 100)}</span></label>
    <label>Độ nhạy chuột <input type="range" id="s-sens" min="20" max="300" value="${Math.round(settings.sensitivity * 100)}"><span id="s-sens-v">${settings.sensitivity.toFixed(1)}</span></label>
    <div class="btns"><button id="b-back">Quay lại</button></div>`);
  $('s-vol').oninput = (e) => { settings.volume = e.target.value / 100; sound.setVolume(settings.volume); $('s-vol-v').textContent = e.target.value; saveSettings(); };
  $('s-sens').oninput = (e) => { settings.sensitivity = e.target.value / 100; $('s-sens-v').textContent = settings.sensitivity.toFixed(1); saveSettings(); };
  bind('b-back', () => (returnTo === 'paused' ? showPause() : showMenu()));
}
function showPause() {
  phase = 'paused';
  card(`<h2>Tạm dừng</h2><div class="btns"><button id="p-resume">Tiếp tục</button><button class="ghost" id="p-restart">Chơi lại Đêm</button>
    <button class="ghost" id="p-set">Cài đặt</button><button class="ghost" id="p-menu">Về menu</button></div>`);
  bind('p-resume', resume);
  bind('p-restart', () => startNight(night));
  bind('p-set', () => showSettings('paused'));
  bind('p-menu', () => { sound.stopMusic(); showMenu(); });
}
function resume() { phase = 'playing'; hideCard(); }

function startNight(n) {
  night = n; map = getMap(n);
  game = createGame({ tuning: T, seed: Number(qs.get('seed')) || (Date.now() & 0x7fffffff), night: n });
  if (qs.has('lit')) for (const l of game.lanterns.slice(0, Number(qs.get('lit')))) { l.lit = true; l.deposited = T.lantern_cost; }
  buildWorld(map);
  dyn.clear();
  views = { lanterns: new Map(game.lanterns.map((l) => [l.id, makeLantern(l)])), motes: new Map(), shades: new Map(), drifters: new Map(), charms: new Map(game.charms.map((c) => [c.id, makeCharm(c)])) };
  camYaw = 0; pulseAnim = 0; lastCountdown = -1; windWarned = false;
  bot = qs.has('bench') || qs.has('demo') ? createBot() : null;
  phase = 'playing'; hideCard(); $('hudroot').classList.remove('hidden');
  $('nightname').textContent = INTRO[n][0];
  sound.ensure(); sound.startMusic();
}
function showResult() {
  const won = game.state === 'won';
  phase = 'result';
  sound.sfx(won ? 'win' : 'lose');
  const st = game.stats, S = T.score;
  const reason = { all_lit: 'Mọi Đèn Lồng Lớn đã sáng.', dawn: 'Bình minh tới trước khi các đèn được thắp.', no_flames: 'Ngọn lửa của Mây đã tắt.' }[game.reason];
  const rows = [['Đom đóm đã nạp', `${st.deposited} × ${S.per_mote}`], ['Đèn đã thắp', `${st.lanterns} × ${S.per_lantern}`], ['Bóng Mực trúng Tỏa Sáng', `${st.stuns} × ${S.per_stun}`]];
  if (won) rows.push(['Thưởng thời gian', `+${st.bonusTime}`], ['Thưởng Ngọn Lửa', `+${st.bonusFlames}`]);
  rows.push(['<b>Điểm Đêm này</b>', `<b>${game.score}</b>`]);
  if (won) totals[night - 1] = game.score;
  const total = totals.reduce((a, b) => a + (b || 0), 0);
  card(`<h2>${won ? INTRO[night][0] + ' đã sáng!' : 'Đêm chưa trọn…'}</h2><p>${reason}</p>
    <table>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}<tr><td>Tổng điểm các Đêm đã thắng</td><td>${total}</td></tr></table>
    <div class="btns">${won ? (night < 3 ? '<button id="r-next">Đêm kế tiếp</button>' : '<button id="r-dawn">Đón bình minh</button>') : '<button id="r-retry">Chơi lại Đêm</button>'}
    <button class="ghost" id="r-menu">Về menu</button></div>`);
  bind('r-next', () => showIntro(night + 1));
  bind('r-dawn', showDawn);
  bind('r-retry', () => startNight(night));
  bind('r-menu', () => { sound.stopMusic(); showMenu(); });
}
function showDawn() {
  phase = 'dawn'; sound.stopMusic(); $('hudroot').classList.add('hidden');
  scene.background.set('#f6b37b'); scene.fog.color.set('#f6c99b');
  const total = totals.reduce((a, b) => a + (b || 0), 0);
  card(`<h1>Bình Minh</h1><p class="quote">Ông Đăng: "Ba hòn đảo đã sáng. Cảm ơn con, người giữ đèn nhỏ."</p>
    <table>${totals.map((s, i) => `<tr><td>${INTRO[i + 1][0]}</td><td>${s}</td></tr>`).join('')}<tr><td><b>Tổng điểm</b></td><td><b>${total}</b></td></tr></table>
    <div class="btns"><button id="d-menu">Về menu</button></div>`);
  bind('d-menu', () => { scene.background.set(C.night); scene.fog.color.set(C.fog); showMenu(); });
}

// ---------- Điều khiển ----------
const keys = new Set();
let camYaw = 0, dragX = null;
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if ((e.code === 'Escape' || e.code === 'KeyP') && (phase === 'playing' || phase === 'paused')) {
    if (phase === 'playing') showPause(); else resume();
  }
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('pointerdown', (e) => { if (phase === 'playing') dragX = e.clientX; });
addEventListener('pointerup', () => { dragX = null; });
addEventListener('pointermove', (e) => { if (dragX === null) return; camYaw -= (e.clientX - dragX) * 0.3 * settings.sensitivity; dragX = e.clientX; });
function readInput() {
  if (keys.has('ArrowLeft')) camYaw += 110 * DT * settings.sensitivity;
  if (keys.has('ArrowRight')) camYaw -= 110 * DT * settings.sensitivity;
  const x = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0); // θ=0 nhìn +Z thì "phải màn hình" là −X
  const z = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  return { move: [x, z], cam_yaw_deg: camYaw, jump: keys.has('Space'), interact: keys.has('KeyE'), pulse: keys.has('KeyQ'), dash: keys.has('ShiftLeft') || keys.has('ShiftRight'), pause: false };
}

// ---------- Vòng lặp ----------
let acc = 0, last = performance.now();
const fpsState = { frames: 0, t0: performance.now(), samples: [], shown: qs.has('fps') || qs.has('bench') };
if (fpsState.shown) $('fps').classList.remove('hidden');
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  if (phase === 'playing') {
    acc += dt;
    while (acc >= DT) {
      acc -= DT;
      const evs = step(game, bot ? bot(game) : readInput());
      for (const e of evs) onEvent(e);
      for (const f of game.fx) if (f === 'jump' || f === 'dash') sound.sfx(f);
      if (game.state === 'won' || game.state === 'lost') { showResult(); break; }
    }
  } else acc = 0;
  render(now / 1000);
  fpsState.frames += 1;
  if (now - fpsState.t0 >= 1000) {
    const fps = (fpsState.frames * 1000) / (now - fpsState.t0);
    fpsState.frames = 0; fpsState.t0 = now;
    if (phase === 'playing') fpsState.samples.push(fps);
    const avg = fpsState.samples.reduce((a, b) => a + b, 0) / Math.max(1, fpsState.samples.length);
    if (fpsState.shown) $('fps').textContent = `${fps.toFixed(0)} FPS · TB ${avg.toFixed(1)} (${fpsState.samples.length}s) · ${innerWidth}×${innerHeight}`;
    window.__fps = { avg, n: fpsState.samples.length };
  }
}
function onEvent(e) {
  const names = { mote_picked: 'pick', deposit: 'deposit', lantern_lit: 'lit', pulse: 'pulse', player_hit: 'hit', shade_spawned: 'shade', drifter_steal: 'steal', charm_picked: 'charm' };
  if (names[e.name]) sound.sfx(names[e.name]);
  if (e.name === 'pulse') pulseAnim = 1;
}

const tmpV = new THREE.Vector3();
function render(t) {
  if (!game) { renderer.render(scene, camera); return; }
  const p = game.player;
  may.g.position.set(...p.pos);
  may.g.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  may.g.visible = p.respawn === 0 && !(p.invuln > 0 && Math.floor(t * 12) % 2 === 0);
  const fill = p.carried / T.carry_capacity;
  may.light.intensity = 3 + 7 * fill;           // sáng tạo: đèn trên nón sáng theo số đom đóm
  may.lamp.material.emissiveIntensity = 1 + 3 * fill;

  for (const l of game.lanterns) {
    const v = views.lanterns.get(l.id);
    v.head.material.color.set(l.lit ? C.core : C.off);
    v.head.material.emissive.set(C.lit);
    v.head.material.emissiveIntensity = l.lit ? 2.2 : (l.deposited / T.lantern_cost) * 0.6;
    v.light.intensity = l.lit ? 45 + 6 * Math.sin(t * 3 + l.pos[0]) : 0;
    v.ring.material.opacity = l.lit ? 0.35 : 0;
  }
  sync(views.motes, game.motes, () => { const g = new THREE.Group(); g.add(new THREE.Mesh(moteGeo, moteMat), new THREE.Mesh(haloGeo, haloMat)); dyn.add(g); return g; },
    (g, m) => { g.position.set(m.pos[0], m.pos[1] + 0.8 + 0.2 * Math.sin(t * 2.5 + m.pos[0] * 3), m.pos[2]); g.scale.setScalar(m.kind === 'dropped' && m.ttl < 120 && Math.floor(t * 8) % 2 ? 0.6 : 1); });
  sync(views.shades, game.shades, makeShade, (v, sh) => {
    v.g.position.set(sh.pos[0], sh.pos[1] + 0.12 * Math.sin(t * 4 + sh.pos[2]), sh.pos[2]);
    const stunned = sh.state === 'stunned';
    v.body.material.color.set(stunned ? C.stunned : C.shade);
    v.rim.material.opacity = sh.state === 'spawning' ? 0.1 : stunned ? 0.05 : 0.3 + 0.15 * Math.sin(t * 6);
    v.g.scale.setScalar(sh.state === 'spawning' ? 0.5 + 0.5 * (1 - sh.stateTicks / STD.shadeSpawningTicks) : stunned ? 0.8 : 1);
  });
  sync(views.drifters, game.drifters.filter((d) => d.state !== 'removed'), makeDrifter, (v, d) => {
    v.g.position.set(...d.pos);
    const a = v.m.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) a.array[i * 3 + 1] = v.base[i * 3 + 1] + 0.25 * Math.sin(t * 8 + v.base[i * 3] * 2);
    a.needsUpdate = true;
    v.g.rotation.y = t * (d.state === 'chase' ? 3 : 1);
    v.m.material.opacity = d.state === 'flee' ? 0.5 : 0.85;
  });
  for (const c of game.charms) { const g = views.charms.get(c.id); g.visible = c.available; g.rotation.y = t * 1.5; }

  if (pulseAnim > 0) {
    pulseAnim = Math.max(0, pulseAnim - 1 / 24);
    pulseRing.scale.setScalar(Math.max(0.01, T.pulse_radius * (1 - pulseAnim)));
    pulseRing.position.set(p.pos[0], p.pos[1] + 0.8, p.pos[2]);
  }
  pulseRing.material.opacity = pulseAnim * 0.8;

  // Ánh sáng môi trường theo tiến độ: 0.15 + 0.55 × (đèn sáng / tổng đèn)
  const ratio = litCount(game) / game.lanterns.length;
  ambient.intensity = 0.15 + 0.55 * ratio;

  // Gió: báo trước 2 s bằng lá bay + âm thanh
  const st = game.steps;
  const warn = game.windEnabled && !game.wind.active && st % STD.windEvery >= STD.windEvery - 120;
  $('windwarn').classList.toggle('hidden', !warn);
  if (warn && !windWarned) { sound.sfx('wind'); windWarned = true; }
  if (!warn) windWarned = false;
  leaves.visible = warn || game.wind.active;
  if (leaves.visible) {
    const a = (game.wind.dirDeg * Math.PI) / 180;
    leaves.children.forEach((l, i) => {
      const k = (t * 0.6 + i / 40) % 1;
      l.position.set(p.pos[0] + Math.cos(a) * (k * 24 - 12) + Math.sin(i * 7) * 6, p.pos[1] + 1 + ((i * 13) % 5), p.pos[2] + Math.sin(a) * (k * 24 - 12) + Math.cos(i * 5) * 6);
      l.rotation.set(t * 3 + i, t * 2 + i, 0);
    });
  }

  const th = (camYaw * Math.PI) / 180;
  const fx = Math.sin(th), fz = Math.cos(th);
  camera.position.set(p.pos[0] - fx * 9, p.pos[1] + 5.5, p.pos[2] - fz * 9);
  camera.lookAt(p.pos[0] + fx * 2, p.pos[1] + 1.2, p.pos[2] + fz * 2);
  renderer.render(scene, camera);
  updateHud();
}
function sync(mapViews, items, make, update) {
  const alive = new Set();
  for (const it of items) {
    alive.add(it.id);
    let v = mapViews.get(it.id);
    if (!v) { v = make(it); mapViews.set(it.id, v); }
    update(v, it);
  }
  for (const [id, v] of mapViews) if (!alive.has(id)) { dyn.remove(v.g || v); mapViews.delete(id); }
}

function updateHud() {
  const p = game.player;
  $('flames').textContent = '🔥'.repeat(Math.max(0, p.flames)) + '·'.repeat(Math.max(0, T.flames - p.flames));
  const tl = Math.max(0, timeLeft(game));
  $('timer').textContent = `${String(Math.floor(tl / 60)).padStart(2, '0')}:${String(Math.floor(tl % 60)).padStart(2, '0')}`;
  $('timer').classList.toggle('low', tl <= 30);
  const sec = Math.ceil(tl);
  if (phase === 'playing' && tl <= 10 && sec !== lastCountdown) { lastCountdown = sec; sound.sfx('tick'); }
  $('topright').innerHTML = `Đèn <b>${litCount(game)}/${game.lanterns.length}</b><br>Điểm <b>${game.score}</b>`;
  const bar = $('bar');
  if (bar.children.length !== T.carry_capacity) bar.innerHTML = '<i></i>'.repeat(T.carry_capacity);
  [...bar.children].forEach((c, i) => c.classList.toggle('on', i < p.carried));
  const cd = (el, left, total, ok) => { el.style.setProperty('--p', `${(100 * left) / total}%`); el.classList.toggle('ready', left === 0 && ok); };
  cd($('cd-dash'), p.charm > 0 ? 0 : p.dashCd, Math.round(T.dash_cooldown_s * 60), true);
  cd($('cd-pulse'), p.pulseCd, Math.round(T.pulse_cooldown_s * 60), p.carried >= T.pulse_cost);
  $('charm').classList.toggle('hidden', p.charm === 0);
  $('charm').textContent = `Bùa Gió ${(p.charm / 60).toFixed(1)}s`;
  const near = game.lanterns.filter((l) => !l.lit && Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= T.interact_radius);
  $('prompt').classList.toggle('hidden', !near.length);
  if (near.length) $('prompt').textContent = `E — Nạp ánh sáng (${near[0].deposited}/${T.lantern_cost})`;
  // mũi tên chỉ đèn chưa sáng gần nhất khi ở ngoài màn hình
  const unlit = game.lanterns.filter((l) => !l.lit);
  const arrow = $('arrow');
  if (!unlit.length) { arrow.classList.add('hidden'); return; }
  const dist = (l) => Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]);
  const tgt = unlit.reduce((a, b) => (dist(b) < dist(a) ? b : a));
  tmpV.set(tgt.pos[0], tgt.pos[1] + 3.4, tgt.pos[2]).project(camera);
  const behind = tmpV.z > 1;
  let { x, y } = tmpV;
  if (behind) { x = -x; y = -y; }
  const off = behind || Math.abs(x) > 1 || Math.abs(y) > 1;
  arrow.classList.toggle('hidden', !off);
  if (off) {
    const ang = Math.atan2(y, x);
    const k = 0.85 / Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)));
    const sx = (Math.cos(ang) * k * 0.5 + 0.5) * innerWidth, sy = (-Math.sin(ang) * k * 0.5 + 0.5) * innerHeight;
    arrow.style.left = `${sx - 14}px`; arrow.style.top = `${sy - 15}px`;
    arrow.style.transform = `rotate(${Math.PI / 2 - ang}rad)`;
  }
}

// ---------- Khởi động ----------
requestAnimationFrame(frame);
if (qs.has('bench') || qs.has('autostart') || qs.has('demo')) startNight(Number(qs.get('bench') || qs.get('autostart') || qs.get('demo')) || 1);
else showMenu();
window.__game = () => game;
