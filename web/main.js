// Bản web 3D: chỉ HIỂN THỊ và đọc bàn phím. Toàn bộ luật chơi nằm trong src/core/sim.js
// (cùng lõi với headless), bước cố định 60 tick/giây.
import * as THREE from 'three';
import { createGame, step, timeLeft, litCount, WORLD, DT } from '/src/core/sim.js';

const contract = await (await fetch('/game.contract.json')).json();
const T = contract.tuning;

// ---------- Cảnh ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const NIGHT = new THREE.Color('#0d0817'), WARM_SKY = new THREE.Color('#3b2a4a');
scene.background = NIGHT.clone();
scene.fog = new THREE.FogExp2(NIGHT.clone(), 0.028);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const hemi = new THREE.HemisphereLight('#8a7ab8', '#1a1024', 0.7);
scene.add(hemi);
const moon = new THREE.DirectionalLight('#9fb0ff', 0.25);
moon.position.set(-20, 40, 10);
scene.add(moon);

// Đảo tròn + biển mây
const islandMat = new THREE.MeshStandardMaterial({ color: '#3a3550', roughness: 0.95 });
const island = new THREE.Mesh(new THREE.CylinderGeometry(WORLD.islandRadius, WORLD.islandRadius - 4, 3, 64), islandMat);
island.position.y = -1.5;
scene.add(island);
const clouds = new THREE.Mesh(new THREE.CircleGeometry(160, 48), new THREE.MeshStandardMaterial({ color: '#2a2140', roughness: 1 }));
clouds.rotation.x = -Math.PI / 2; clouds.position.y = -5;
scene.add(clouds);

const mat = (color, emissive = '#000', ei = 0) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.8 });

// Mây: thân, đầu, nón lá, đèn lồng nhỏ treo ở vành nón
function makeMay() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.6, 4, 12), mat('#5b7fb8'));
  body.position.y = 0.65; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), mat('#f1d3b3'));
  head.position.y = 1.35; g.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.38, 24), mat('#d9b46a'));
  hat.position.y = 1.68; g.add(hat);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), mat('#ffb347', '#ff9a2e', 2));
  lamp.position.set(0.5, 1.3, 0.25); g.add(lamp);
  const lampLight = new THREE.PointLight('#ffb347', 1.5, 7, 1.6);
  lampLight.position.copy(lamp.position); g.add(lampLight);
  return { g, lamp, lampLight };
}
const may = makeMay();
scene.add(may.g);

// Hiệu ứng tỏa sáng
const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48),
  new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2; pulseRing.position.y = 0.1;
scene.add(pulseRing);

// ---------- Đồng bộ thực thể ----------
let game, lanternViews, moteViews, shadeViews;
const dyn = new THREE.Group();
scene.add(dyn);

function makeLantern(l) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3, 8), mat('#4a3a2a'));
  pole.position.y = 1.5; g.add(pole);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 8), mat('#3a3040'));
  head.position.y = 3.4; g.add(head);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 8), mat('#5a2a2a'));
  roof.position.y = 4.05; g.add(roof);
  const light = new THREE.PointLight('#ffa040', 0, 22, 1.4);
  light.position.y = 3.4; g.add(light);
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.08, T.safe_radius, 64),
    new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  g.position.set(l.pos[0], l.pos[1], l.pos[2]);
  dyn.add(g);
  return { g, head, light, ring };
}
const moteGeo = new THREE.SphereGeometry(0.14, 10, 8);
const moteMat = mat('#fff2a8', '#ffd84a', 3);
const shadeGeo = new THREE.SphereGeometry(0.8, 20, 14);

function newGame() {
  dyn.clear();
  game = createGame({ tuning: T, seed: (Date.now() & 0x7fffffff) });
  lanternViews = new Map(game.lanterns.map((l) => [l.id, makeLantern(l)]));
  moteViews = new Map(game.motes.map((m) => {
    const mesh = new THREE.Mesh(moteGeo, moteMat);
    mesh.position.set(m.pos[0], 0.8, m.pos[2]);
    dyn.add(mesh);
    return [m.id, mesh];
  }));
  shadeViews = new Map();
  camYaw = 0;
  pulseAnim = 0;
}

// ---------- Điều khiển ----------
const keys = new Set();
let camYaw = 0, pulseAnim = 0, phase = 'title';
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (phase !== 'playing' && (e.code === 'Enter' || (phase === 'over' && e.code === 'KeyR'))) startPlaying();
});
addEventListener('keyup', (e) => keys.delete(e.code));
let dragX = null;
addEventListener('pointerdown', (e) => { dragX = e.clientX; });
addEventListener('pointerup', () => { dragX = null; });
addEventListener('pointermove', (e) => {
  if (dragX === null) return;
  camYaw -= (e.clientX - dragX) * 0.35;
  dragX = e.clientX;
});

function readInput() {
  if (keys.has('ArrowLeft')) camYaw += 120 * DT;
  if (keys.has('ArrowRight')) camYaw -= 120 * DT;
  // Với θ = 0 camera nhìn theo +Z, nên "phải màn hình" là −X => phím D cho x = −1.
  const x = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
  const z = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  return {
    move: [x, z], cam_yaw_deg: camYaw,
    jump: keys.has('Space'), interact: keys.has('KeyF'), pulse: keys.has('KeyQ'),
  };
}

function startPlaying() {
  newGame();
  phase = 'playing';
  document.getElementById('start').classList.add('hidden');
  document.getElementById('end').classList.add('hidden');
}

// ---------- Vòng lặp ----------
let acc = 0, last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  acc = Math.min(acc + (now - last) / 1000, 0.25);
  last = now;
  if (phase === 'playing') {
    while (acc >= DT) {
      acc -= DT;
      const evs = step(game, readInput());
      for (const e of evs) if (e.name === 'pulse') pulseAnim = 1;
      if (game.state !== 'playing') { showEnd(); break; }
    }
  } else acc = 0;
  render(now / 1000);
}

function render(t) {
  if (!game) { renderer.render(scene, camera); return; }
  const p = game.player;
  may.g.position.set(p.pos[0], p.pos[1], p.pos[2]);
  may.g.rotation.y = p.facing;
  // Sáng tạo nhỏ: đèn trên nón sáng hơn khi Mây mang nhiều đom đóm; nhấp nháy khi bất tử sau khi bị chạm
  const glow = 0.6 + p.carried / T.carry_capacity;
  may.lampLight.intensity = 4 + 6 * (p.carried / T.carry_capacity);
  may.lamp.material.emissiveIntensity = 1 + 2 * glow;
  may.g.visible = !(p.invuln > 0 && Math.floor(t * 12) % 2 === 0);

  // Đèn lồng lớn: sáng khi thắp; vòng an toàn hiện quanh đèn đã thắp
  for (const l of game.lanterns) {
    const v = lanternViews.get(l.id);
    const k = l.lit ? 1 : l.deposited / T.lantern_cost * 0.25;
    v.head.material.color.set(l.lit ? '#ffcf7a' : '#3a3040');
    v.head.material.emissive.set('#ff8a1e');
    v.head.material.emissiveIntensity = k * 2.2;
    v.light.intensity = l.lit ? 40 + 6 * Math.sin(t * 3 + l.pos[0]) : 0;
    v.ring.material.opacity = l.lit ? 0.35 : 0;
  }
  // Đom đóm
  for (const m of game.motes) {
    const mesh = moteViews.get(m.id);
    mesh.visible = m.active;
    if (m.active) mesh.position.y = 0.8 + 0.25 * Math.sin(t * 2.5 + m.pos[0] * 3);
  }
  // Bóng Mực (tím đen = nguy hiểm)
  for (const sh of game.shades) {
    let mesh = shadeViews.get(sh.id);
    if (!mesh) {
      mesh = new THREE.Mesh(shadeGeo, new THREE.MeshStandardMaterial({ color: '#2a0f3d', emissive: '#6a1fa0', emissiveIntensity: 0.6, transparent: true, opacity: 0.92 }));
      shadeViews.set(sh.id, mesh); dyn.add(mesh);
    }
    mesh.position.set(sh.pos[0], sh.pos[1] + 0.12 * Math.sin(t * 4 + sh.pos[2]), sh.pos[2]);
    const stunned = sh.state === 'stunned';
    mesh.material.opacity = stunned ? 0.45 : 0.92;
    mesh.material.emissiveIntensity = stunned ? 0.15 : 0.6 + 0.3 * Math.sin(t * 6);
    mesh.scale.setScalar(stunned ? 0.8 : 1);
  }
  // Hiệu ứng tỏa sáng
  if (pulseAnim > 0) {
    pulseAnim = Math.max(0, pulseAnim - 1 / 24);
    const r = T.pulse_radius * (1 - pulseAnim);
    pulseRing.scale.setScalar(Math.max(r, 0.01));
    pulseRing.position.set(p.pos[0], 0.1, p.pos[2]);
  }
  pulseRing.material.opacity = pulseAnim * 0.8;

  // Đảo sáng dần lên theo số đèn đã thắp
  const lit = litCount(game) / game.lanterns.length;
  hemi.intensity = 0.7 + 0.8 * lit;
  scene.background.copy(NIGHT).lerp(WARM_SKY, lit);
  scene.fog.color.copy(scene.background);
  scene.fog.density = 0.028 - 0.016 * lit;
  islandMat.color.set('#3a3550').lerp(new THREE.Color('#7a6a45'), lit);

  // Camera góc nhìn thứ ba sau lưng Mây
  const th = camYaw * Math.PI / 180;
  const fx = Math.sin(th), fz = Math.cos(th);
  camera.position.set(p.pos[0] - fx * 9, p.pos[1] + 5.5, p.pos[2] - fz * 9);
  camera.lookAt(p.pos[0] + fx * 2, p.pos[1] + 1.2, p.pos[2] + fz * 2);
  renderer.render(scene, camera);
  updateHud();
}

function nearLantern() {
  const p = game.player.pos;
  return game.lanterns.find((l) => !l.lit && Math.hypot(l.pos[0] - p[0], l.pos[2] - p[2]) <= T.interact_radius);
}

function updateHud() {
  const p = game.player;
  const tl = Math.max(0, timeLeft(game));
  const mm = Math.floor(tl / 60), ss = String(Math.floor(tl % 60)).padStart(2, '0');
  const cd = p.pulseCd > 0 ? `hồi ${(p.pulseCd / 60).toFixed(1)}s` : (p.carried >= T.pulse_cost ? 'sẵn sàng' : 'cần đom đóm');
  document.getElementById('hud').innerHTML = `
    <div>Ngọn Lửa: <b>${'●'.repeat(Math.max(0, p.flames))}${'○'.repeat(Math.max(0, T.flames - p.flames))}</b></div>
    <div>Đom đóm: <b>${p.carried}/${T.carry_capacity}</b></div>
    <div>Đèn đã thắp: <b>${litCount(game)}/${game.lanterns.length}</b></div>
    <div>Đêm còn: <b>${mm}:${ss}</b></div>
    <div>Điểm: <b>${game.score}</b></div>
    <div>Tỏa sáng [Q]: <b>${cd}</b></div>`;
  const l = nearLantern();
  document.getElementById('hint').textContent = l
    ? (p.carried > 0 ? `Nhấn F để nạp đom đóm vào đèn ${l.id} (${l.deposited}/${T.lantern_cost})` : `Đèn ${l.id} cần ${T.lantern_cost - l.deposited} đom đóm nữa`)
    : '';
}

function showEnd() {
  phase = 'over';
  const won = game.state === 'won';
  const reason = { all_lit: 'Năm Đèn Lồng Lớn đã sáng, sương đen tan dần.', dawn: 'Bình minh đã tới trước khi các đèn được thắp.', no_flames: 'Ngọn lửa của Mây đã tắt.' }[game.reason];
  document.getElementById('end-title').textContent = won ? 'Đảo Bến đã sáng trở lại!' : 'Đêm chưa trọn…';
  document.getElementById('end-reason').textContent = reason;
  const st = game.stats, S = T.score;
  const rows = [
    ['Đom đóm đã nhặt', `${st.motes} × ${S.per_mote}`],
    ['Đèn đã thắp', `${st.lanterns} × ${S.per_lantern}`],
    ['Bóng Mực bị xua', `${st.stuns} × ${S.per_stun}`],
  ];
  if (won) rows.push(['Thưởng thời gian', `+${st.bonusTime}`], ['Thưởng Ngọn Lửa', `+${st.bonusFlames}`]);
  rows.push(['<b>Tổng điểm</b>', `<b>${game.score}</b>`]);
  document.getElementById('end-table').innerHTML = rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
  document.getElementById('end').classList.remove('hidden');
}

newGame();
requestAnimationFrame(frame);
// Cho script chụp ảnh bằng chứng: bắt đầu ngay khi URL có ?autostart
const qs = new URLSearchParams(location.search);
if (qs.has('autostart')) startPlaying();
// Chỉ để chụp ảnh bằng chứng hiển thị: ?lit=N thắp sẵn N đèn (không ảnh hưởng headless)
if (qs.has('lit')) for (const l of game.lanterns.slice(0, Number(qs.get('lit')))) { l.lit = true; l.deposited = T.lantern_cost; }
window.__game = () => game;
