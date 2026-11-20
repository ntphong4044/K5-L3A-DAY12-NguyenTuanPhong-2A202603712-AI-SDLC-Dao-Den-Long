// Cảnh benchmark của Phase 4 (Ticket-04 mục 1), chạy trên renderer thật của trình duyệt.
// Cửa sổ do script điều khiển ép 1280×720; không toàn màn hình; tắt vsync (xvfb ẩn + cờ Chromium).
// Luật Bóng Mực dùng đúng `step()` của lõi; cảnh bench mở khóa trong lõi: 200 Bóng Mực wander,
// 100 đom đóm, L1–L3 sáng fuel 100, không sát thương/nhặt đom đóm/hao dầu/kết thúc Đêm.
import * as THREE from 'three';
import { getMap } from '/src/core/maps.js';
import { createBenchGame, benchTick, orbitCamera, WARMUP_S } from '/src/core/bench.js';
import { frameStats, round1, RENDERER_LABEL } from '/src/core/benchstats.js';

const contract = await (await fetch('/game.contract.json')).json();
const T = contract.tuning;
const qs = new URLSearchParams(location.search);
const seed = Number(qs.get('seed') ?? 42);
const duration = Number(qs.get('duration') ?? 30);
const $ = (id) => document.getElementById(id);

const C = { night: '#0E1430', fog: '#1B2350', grass: '#2F5D50', sand: '#C9B48A', wood: '#6B4A2F', sea: '#12384A',
  lit: '#FFB347', core: '#FFE9B0', off: '#5B5F6E', moteCore: '#FFF6C2', moteHalo: '#FFE58A', shade: '#120A1A' };

const t0 = performance.now();
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(1280, 720);
document.body.prepend(renderer.domElement);
const gl = renderer.getContext();
const dbg = gl.getExtension('WEBGL_debug_renderer_info');
const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'GPU không báo tên';

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.night);
scene.fog = new THREE.Fog(C.fog, 30, 140);
const camera = new THREE.PerspectiveCamera(60, 1280 / 720, 0.1, 400);
scene.add(new THREE.AmbientLight('#b8c4ff', 0.15));
const moon = new THREE.DirectionalLight('#9fb0ff', 0.45);
moon.position.set(-30, 60, 20);
scene.add(moon);
const sea = new THREE.Mesh(new THREE.CircleGeometry(300, 48), new THREE.MeshStandardMaterial({ color: C.sea, roughness: 1 }));
sea.rotation.x = -Math.PI / 2; sea.position.y = -12;
scene.add(sea);

const M = (color, emissive = '#000', ei = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.85, ...extra });
const map = getMap(1);
const world = new THREE.Group();
const disk = (r, h, color, y = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 64), M(color)); m.position.set(0, y - h / 2, 0); return m; };
world.add(disk(40, 4, C.sand), disk(38.5, 0.2, C.grass, 0.1));
scene.add(world);

const game = createBenchGame({ tuning: T, seed, night: 1 });
// Đèn: đầy đủ ánh sáng như lúc chơi thật.
const lanternViews = [];
for (const l of game.lanterns) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3, 8), M(C.wood)); pole.position.y = 1.5; g.add(pole);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.9, 8), M(l.lit ? C.core : C.off, C.lit, l.lit ? 2.2 : 0));
  head.position.y = 3.4; g.add(head);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 8), M('#C8102E')); roof.position.y = 4.05; g.add(roof);
  const light = new THREE.PointLight(C.lit, l.lit ? 45 : 0, 26, 1.3); light.position.y = 3.4; g.add(light);
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.1, T.safe_radius, 64), new THREE.MeshBasicMaterial({ color: C.lit, transparent: true, opacity: l.lit ? 0.35 : 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
  g.position.set(...l.pos);
  scene.add(g);
  lanternViews.push({ g, light });
}

// Đom đóm (100) + Bóng Mực (200) nhân bản bằng InstancedMesh: cùng một lệnh vẽ cho cả đàn.
const moteGeo = new THREE.SphereGeometry(0.13, 10, 8), haloGeo = new THREE.SphereGeometry(0.28, 10, 8);
const moteMat = M(C.moteCore, C.moteCore, 3), haloMat = new THREE.MeshBasicMaterial({ color: C.moteHalo, transparent: true, opacity: 0.35 });
const moteBody = new THREE.InstancedMesh(moteGeo, moteMat, game.motes.length);
const moteHalo = new THREE.InstancedMesh(haloGeo, haloMat, game.motes.length);
const shadeBody = new THREE.InstancedMesh(new THREE.SphereGeometry(0.8, 18, 12), M(C.shade, C.shade, 0, { transparent: true, opacity: 0.95 }), game.shades.length);
const shadeRim = new THREE.InstancedMesh(new THREE.SphereGeometry(0.88, 18, 12), new THREE.MeshBasicMaterial({ color: '#7A3CFF', transparent: true, opacity: 0.3, side: THREE.BackSide }), game.shades.length);
scene.add(moteBody, moteHalo, shadeBody, shadeRim);

// Mây đứng yên tại (0,0,0).
const may = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.6, 4, 12), M('#E8E2D0')); body.position.y = 0.65; may.add(body);
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.38, 24), M(C.sand)); hat.position.y = 1.68; may.add(hat);
scene.add(may);

// ---------- Vòng đo ----------
const dummy = new THREE.Object3D();
function simulate(k) {
  // 60 tick/s theo đồng hồ thực; máy nhanh/chậm không đổi luật, chỉ đổi số khung vẽ.
  const want = Math.floor(((performance.now() - t0) / 1000) * 60);
  let guard = 0;
  while (k < want && guard++ < 10) { benchTick(game); k++; }
  return k;
}
function draw(t) {
  game.motes.forEach((m, i) => {
    dummy.position.set(m.pos[0], m.pos[1] + 0.8 + 0.2 * Math.sin(t * 2.5 + m.pos[0] * 3), m.pos[2]);
    dummy.updateMatrix();
    moteBody.setMatrixAt(i, dummy.matrix);
    moteHalo.setMatrixAt(i, dummy.matrix);
  });
  moteBody.instanceMatrix.needsUpdate = true; moteHalo.instanceMatrix.needsUpdate = true;
  game.shades.forEach((sh, i) => {
    dummy.position.set(sh.pos[0], sh.pos[1] + 0.12 * Math.sin(t * 4 + sh.pos[2]), sh.pos[2]);
    dummy.updateMatrix();
    shadeBody.setMatrixAt(i, dummy.matrix);
    shadeRim.setMatrixAt(i, dummy.matrix);
  });
  shadeBody.instanceMatrix.needsUpdate = true; shadeRim.instanceMatrix.needsUpdate = true;
  for (const v of lanternViews) v.light.intensity = v.light.intensity > 0 ? 45 + 6 * Math.sin(t * 3 + v.g.position.x) : 0;
  const cam = orbitCamera(t);
  camera.position.set(...cam.pos);
  camera.lookAt(...cam.look);
  renderer.render(scene, camera);
}

function finish(dts, loadMs) {
  const st = frameStats(dts);
  const doc = {
    contract_version: '1.3',
    avg_fps: st.avg_fps,
    p1_low_fps: st.p1_low_fps,
    frame_ms_p95: st.frame_ms_p95,
    frames: st.frames,
    load_ms: round1(loadMs),
    // Ticket-04: peak_mem_mb = RSS tiến trình; bản web không đo được RSS -> null (JS heap ghi riêng để tham khảo)
    peak_mem_mb: null,
    js_heap_peak_mb: performance.memory ? round1(performance.memory.usedJSHeapSize / 1048576) : null,
    first_frame_epoch_ms: firstFrameEpoch,
    vsync_off: qs.get('vsync') === 'off',
    renderer: `${RENDERER_LABEL} · GPU: ${gpu}`,
    os: navigator.userAgent,
    size: [innerWidth, innerHeight],
    shades: game.shades.length,
    motes: game.motes.length,
    seed,
    duration,
  };
  clearTimeout(hardStop);
  window.__bench = { ...doc, done: true };
  $('state').textContent = 'Xong.';
  $('out').textContent = JSON.stringify(window.__bench, null, 2);
  $('done').classList.remove('hidden');
  return doc;
}

let k = 0, measuring = false, dts = null, prev = 0, loadMs = null, firstFrameEpoch = null;

// Cửa sổ bị che / tab bị hạ ưu tiên có thể làm Chrome bỏ hẳn requestAnimationFrame. Đo vẫn phải kết thúc:
// một hẹn giờ độc lập chỉnh ui "Xong" khi đã đủ warmup + duration, dùng các khung đã đo được (nếu có).
const hardStop = setTimeout(() => { if (loadMs !== null && !window.__bench?.done) finish(dts ?? [], loadMs); }, (WARMUP_S + duration + 5) * 1000);
function loop(now) {
  if (loadMs === null) {
    k = simulate(0);
    draw(now / 1000);
    loadMs = performance.now() - t0;
    firstFrameEpoch = performance.timeOrigin + performance.now();   // để script tính load_ms từ lúc TIẾN TRÌNH bắt đầu
    window.__bench = { load_ms: round1(loadMs), first_frame_epoch_ms: firstFrameEpoch, done: false };
    requestAnimationFrame(loop);
    return;
  }
  k = simulate(k);
  draw(now / 1000);
  const elapsed = (now - t0) / 1000;
  if (elapsed >= WARMUP_S && !measuring) { measuring = true; dts = []; prev = now; }
  if (measuring) {
    if (now > prev) dts.push(now - prev);
    prev = now;
    $('state').textContent = `Đo: ${Math.min(duration, Math.max(0, elapsed - WARMUP_S)).toFixed(1)} / ${duration} s`;
    if (elapsed - WARMUP_S >= duration) { finish(dts, loadMs); return; }
  } else {
    $('state').textContent = `Khởi động ${elapsed.toFixed(1)} / ${WARMUP_S} s`;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
