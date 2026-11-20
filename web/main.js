// Bản web 3D: hiển thị + điều khiển + menu. Toàn bộ luật chơi nằm trong src/core/sim.js
// (cùng lõi với headless), bước cố định 60 tick/giây.
import * as THREE from 'three';
import { createGame, step, timeLeft, litCount, playerCapacity, winThreshold, fuelOf, isLowFuel, reachesLantern, DT, STD } from '/src/core/sim.js';
import { getMap } from '/src/core/maps.js';
import { createBot } from '/src/core/bot.js';
import { normalizeName } from '/src/core/leaderboard.js';
import { loadSettings, saveSettings as saveSettingsToDisk, ACTIONS, keyLabel, assignKey, restoreDefaultKeys, keyCodeFromEvent } from '/web/settings.js';
import { loadLeaderboard, newRunEntries, commitRun, resetLeaderboard } from '/web/store.js';
import { Sound } from '/web/audio.js';

const contract = await (await fetch('/game.contract.json')).json();
const T = contract.tuning;
const qs = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

// ---------- Bảng màu chuẩn (Ticket-02 + Added choáng Ticket-03) ----------
const C = {
  night: '#0E1430', fog: '#1B2350', grass: '#2F5D50', sand: '#C9B48A', wood: '#6B4A2F', sea: '#12384A',
  lit: '#FFB347', core: '#FFE9B0', off: '#5B5F6E', moteCore: '#FFF6C2', moteHalo: '#FFE58A',
  shade: '#120A1A', shadeRim: '#7A3CFF', stunned: '#3A3450', shirt: '#E8E2D0', red: '#C8102E', gold: '#F2C14E', drifter: '#8FA3B8',
  // Ticket-03 mục 6: bảng màu dễ phân biệt (khi bật cài đặt, đổi 2 màu dưới).
  shadeRimCb: '#00B3FF', dangerCb: '#FFFFFF',
};
const palette = { rim: C.shadeRim, danger: '#FF5A5F' };
function applyPalette() {
  palette.rim = settings.cb ? C.shadeRimCb : C.shadeRim;
  palette.danger = settings.cb ? C.dangerCb : '#FF5A5F';
  document.documentElement.style.setProperty('--danger', palette.danger);
}

// ---------- Cài đặt (lưu giữa các lần mở; Ticket-04 mục 4: giảm chuyển động, chữ lớn, gán phím) ----------
const settings = loadSettings(globalThis.localStorage ? (() => { try { return localStorage.getItem('ddl-settings'); } catch { return null; } })() : null);
if (new URLSearchParams(location.search).has('cb')) settings.cb = true; // chỉ để chụp ảnh chế độ mù màu
const saveSettings = () => saveSettingsToDisk(settings);
const sound = new Sound();
sound.setVolume(settings.volume);
applyPalette();
document.body.classList.toggle('cb', !!settings.cb);
applyDisplay();

/** Áp dụng phần hiển thị của cài đặt: chữ lớn (×1.25) và giảm chuyển động. */
function applyDisplay() {
  document.body.classList.toggle('large', settings.fontScale === 1.25);
  document.body.classList.toggle('reduce-motion', !!settings.reducedMotion);
}

// Vào thẳng một Đêm bằng bot (`?demo=N`, `?bench=N`) thì bỏ qua các màn hình chờ.
const autoNight = qs.has('bench') || qs.has('autostart') || qs.has('demo');

/** Một phím đang giữ có khớp hành động không (phím chính đã gán + phím phụ luôn bật). */
function held(action) {
  const k = settings.keys[action];
  if (k && keys.has(k)) return true;
  return !!ACTIONS.find((a) => a.id === action)?.alt.some((c) => keys.has(c));
}

// Bảng xếp hạng (Ticket-04 mục 3); tên gần nhất để điền sẵn cho ván sau trong cùng phiên.
let lastName = '', seed = 0, runSaved = false, nameReturn = () => showMenu();
let UI_RESULT_TOTALS = [];   // chỉ dùng khi kiểm chứng UI (window.__ddl.demoResult)

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
  // Ticket-03 mục 6: giấy có vết rách để phân biệt đèn tắt không cần màu
  const tear = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.05), new THREE.MeshBasicMaterial({ color: '#000' }));
  tear.position.set(-0.55, 3.35, 0); g.add(tear);
  // Ticket-04 mục 4: chỉ báo "đèn sắp cạn dầu" bằng hình (biểu tượng ⚠ nổi trên đèn) khi fuel < 30.
  const chop = new THREE.Sprite(new THREE.SpriteMaterial({ map: warnTexture('⚠'), depthTest: false, transparent: true }));
  chop.scale.set(1.4, 0.9, 1); chop.position.set(0, 5.2, 0); chop.visible = false; g.add(chop);
  const light = new THREE.PointLight(C.lit, 0, 26, 1.3); light.position.y = 3.4; g.add(light);
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.1, T.safe_radius, 64), new THREE.MeshBasicMaterial({ color: C.lit, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
  // Thanh dầu trên đèn đang sáng (Ticket-03 mục 1)
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.16), new THREE.MeshBasicMaterial({ color: '#0009', transparent: true }));
  const barFg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.12), new THREE.MeshBasicMaterial({ color: C.lit }));
  barBg.position.set(0, 4.7, 0); barFg.position.set(0, 4.7, 0.01);
  g.add(barBg, barFg);
  g.position.set(...l.pos);
  dyn.add(g);
  return { g, head, roof, tear, chop, light, ring, barBg, barFg, headScale: 1 };
}

/** Kết cấu biểu tượng cảnh báo (⚠) vẽ bằng canvas: không cần file ảnh, rõ ở mọi DPI. */
function warnTexture(char) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 80;
  const x = c.getContext('2d');
  x.fillStyle = '#000a'; x.beginPath(); x.roundRect(4, 4, 120, 72, 12); x.fill();
  x.fillStyle = '#FFE9B0'; x.font = 'bold 64px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(char, 64, 44);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function makeShade() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(shadeGeo, M(C.shade, C.shade, 0, { transparent: true, opacity: 0.95 }));
  const rim = new THREE.Mesh(rimGeo, new THREE.MeshBasicMaterial({ color: palette.rim, transparent: true, opacity: 0.25, side: THREE.BackSide }));
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
function bind(id, fn) {
  const el = $(id);
  if (!el) return;
  el.onclick = () => {
    const r = () => fn();
    // Âm thanh không được chặn chức năng: lỗi AudioContext (trình duyệt chặn, máy không có loa) bị nuốt.
    try { sound.ensure(); } catch { /* bỏ qua */ }
    return r();
  };
}

function showMenu() {
  phase = 'menu'; $('hudroot').classList.add('hidden');
  const k = (a) => `<kbd>${keyLabel(settings.keys[a])}</kbd>`;
  card(`<h1>Đảo Đèn Lồng</h1><p>Ba đêm, ba hòn đảo. Giúp Mây thắp lại Đèn Lồng Lớn trước bình minh.</p>
    <p>${k('up')}${k('left')}${k('down')}${k('right')} đi · <kbd>←</kbd><kbd>→</kbd>/kéo chuột: camera · ${k('jump')} nhảy · ${k('dash')} lướt · ${k('interact')} nạp ánh sáng · ${k('pulse')} tỏa sáng · ${k('pause')} tạm dừng</p>
    <div class="btns"><button id="b-start">Bắt đầu</button><button class="ghost" id="b-board">Bảng xếp hạng</button><button class="ghost" id="b-set">Cài đặt</button></div>
    <p style="margin-bottom:4px;opacity:0.85">Chọn Đêm:</p>
    <div class="btns">${[1, 2, 3].map((n) => `<button class="ghost" id="b-night${n}">${INTRO[n][0]}</button>`).join('')}</div>`);
  // Chọn Đêm chỉ phía web (không đổi luật/headless): vào thẳng Đêm n, chuỗi Đêm tiếp tục như bình thường từ đó.
  const newRun = (n) => { totals = []; runSaved = false; seed = qs.has('seed') ? Number(qs.get('seed')) : (Date.now() & 0x7fffffff); showIntro(n); };
  bind('b-start', () => newRun(1));
  for (const n of [1, 2, 3]) bind(`b-night${n}`, () => newRun(n));
  bind('b-board', () => showLeaderboard('menu'));
  bind('b-set', () => showSettings('menu'));
}

// ---------- Bảng xếp hạng (Ticket-04 mục 3) ----------
function boardTable(entries, highlightName) {
  if (!entries.length) return '<p style="opacity:0.8">Chưa có ai trong bảng. Hãy là người giữ đèn đầu tiên.</p>';
  const rows = entries.map((e, i) => `<tr${e.name === highlightName ? ' style="font-weight:700"' : ''}><td>${i + 1}</td><td>${escapeHtml(e.name)}</td><td class="num">${e.score}</td><td>${e.nights_won}/3</td><td style="opacity:0.75">${e.achieved_at.replace('T', ' ').slice(0, 19)}</td></tr>`).join('');
  return `<table class="board"><tr><th>#</th><th>Tên</th><th class="num">Điểm</th><th>Đêm</th><th>Lúc</th></tr>${rows}</table>`;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function showLeaderboard(from = 'menu', highlightName = '') {
  returnTo = from; phase = 'board';
  card(`<h2>Bảng xếp hạng</h2><p style="font-size:var(--fs);opacity:0.8">Điểm = tổng điểm các Đêm đã thắng. Bằng điểm thì ai đạt trước đứng trên. Giữ top 10.</p>
    ${boardTable(loadLeaderboard(), highlightName)}
    <div class="btns"><button id="l-back">Quay lại</button></div>`);
  bind('l-back', () => (from === 'dawn' ? showDawn() : from === 'result' ? showResultCard() : showMenu()));
}
function showNameInput({ score, nightsWon, onDone }) {
  const from = phase;            // quay lại đúng màn trước đó (kết quả Đêm hoặc Bình Minh)
  phase = 'name';
  nameReturn = () => (from === 'dawn' ? showDawn() : showResultCard());
  card(`<h2>Ghi tên vào bảng</h2>
    <p>Điểm của ván: <b>${score}</b> · ${nightsWon}/3 Đêm.</p>
    <label>Tên (3–12 ký tự A–Z a–z 0–9 _, được dùng chữ Việt có dấu) <input type="text" id="n-name" maxlength="12" value="${escapeHtml(lastName)}" autocomplete="off" spellcheck="false"><span></span></label>
    <div class="err" id="n-err"></div>
    <div class="btns"><button id="n-save">Lưu điểm</button><button class="ghost" id="n-skip">Bỏ qua</button></div>`);
  const input = $('n-name');
  input.focus(); input.select();
  const submit = () => {
    const r = normalizeName(input.value);
    if (!r.ok) { $('n-err').textContent = r.error; input.focus(); return; }
    const saved = onDone(r.name);
    lastName = r.name;
    if (saved && saved.saved === false) { $('n-err').textContent = 'Trình duyệt chặn lưu trữ cục bộ; điểm chỉ được giữ trong phiên này.'; return; }
    showLeaderboard('result', r.name);
  };
  $('n-save').onclick = () => { sound.ensure(); submit(); };
  input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
  bind('n-skip', () => nameReturn());
}
function showIntro(n) {
  night = n; phase = 'intro';
  const [title, quote] = INTRO[n];
  card(`<h2>${title}</h2><p class="quote">${quote}</p><div class="btns"><button id="b-go">Bắt đầu đêm</button></div>`);
  bind('b-go', () => startNight(n));
}
function showSettings(from, message = '') {
  returnTo = from; phase = 'settings'; listening = null;
  card(`<h2>Cài đặt</h2>
    <label>Âm lượng <input type="range" id="s-vol" min="0" max="100" value="${Math.round(settings.volume * 100)}"><span id="s-vol-v">${Math.round(settings.volume * 100)}</span></label>
    <label>Độ nhạy chuột <input type="range" id="s-sens" min="20" max="300" value="${Math.round(settings.sensitivity * 100)}"><span id="s-sens-v">${settings.sensitivity.toFixed(1)}</span></label>
    <label class="check">Bảng màu dễ phân biệt <input type="checkbox" id="s-cb" ${settings.cb ? 'checked' : ''}></label>
    <label class="check">Giảm chuyển động (tắt rung camera, chớp màn hình) <input type="checkbox" id="s-motion" ${settings.reducedMotion ? 'checked' : ''}></label>
    <label class="check">Chữ lớn (×1.25) <input type="checkbox" id="s-font" ${settings.fontScale === 1.25 ? 'checked' : ''}></label>
    <p style="font-size:var(--fs);opacity:0.75;margin:4px 0 8px">Bảng màu dễ phân biệt: viền Bóng Mực #00B3FF, cảnh báo trắng kèm ⚠; đèn tắt xẹp 20% và có vết rách.</p>
    <h2 style="margin-top:14px">Phím</h2>
    <p style="font-size:var(--fs);opacity:0.75;margin:0 0 6px">Bấm nút rồi nhấn phím mới. Phím trùng sẽ bị từ chối và báo ngay. Camera luôn xoay bằng ←/→ hoặc kéo chuột.</p>
    <table class="keys" id="keytable">${ACTIONS.map((a) => `<tr><td>${a.label}</td><td style="text-align:right"><button class="ghost" data-act="${a.id}">${keyLabel(settings.keys[a.id])}</button></td></tr>`).join('')}</table>
    <div class="err" id="s-err">${escapeHtml(message)}</div>
    <div class="btns"><button id="s-defaults">Khôi phục mặc định</button><button id="b-back">Quay lại</button></div>`);
  $('s-vol').oninput = (e) => { settings.volume = e.target.value / 100; sound.setVolume(settings.volume); $('s-vol-v').textContent = e.target.value; saveSettings(); };
  $('s-sens').oninput = (e) => { settings.sensitivity = e.target.value / 100; $('s-sens-v').textContent = settings.sensitivity.toFixed(1); saveSettings(); };
  $('s-cb').onchange = (e) => {
    settings.cb = e.target.checked; saveSettings();
    applyPalette();
    for (const v of views.shades.values()) v.rim.material.color.set(palette.rim);
    document.body.classList.toggle('cb', settings.cb);
  };
  $('s-motion').onchange = (e) => { settings.reducedMotion = e.target.checked; saveSettings(); applyDisplay(); };
  $('s-font').onchange = (e) => { settings.fontScale = e.target.checked ? 1.25 : 1; saveSettings(); applyDisplay(); };
  for (const btn of $('keytable').querySelectorAll('button[data-act]')) {
    btn.onclick = () => {
      listening = btn.dataset.act;
      for (const b of $('keytable').querySelectorAll('button[data-act]')) b.classList.toggle('conflict', b === btn);
      btn.textContent = 'Nhấn phím…';
      $('s-err').textContent = '';
    };
  }
  bind('s-defaults', () => {
    listening = null; Object.assign(settings, restoreDefaultKeys(settings)); saveSettings();
    showSettings(returnTo, 'Đã khôi phục phím mặc định.');
  });
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
  if (n === 1) { totals = []; runSaved = false; }
  game = createGame({ tuning: T, seed: seed || (Date.now() & 0x7fffffff), night: n });
  // `?lit=k` chỉ phía web: thắp sẵn k đèn và đặt fuel = 100 (Ticket-03: fuel chứ không phải deposited).
  // chỉ để chụp ảnh bằng chứng: ?lit=k thắp sẵn k đèn, ?fuel=N đặt dầu cho chúng (không ảnh hưởng headless)
  if (qs.has('lit')) for (const l of game.lanterns.slice(0, Number(qs.get('lit')))) { l.lit = true; l.everLit = true; l.fuel100 = Math.round((qs.has('fuel') ? Number(qs.get('fuel')) : T.fuel_max) * 60); }
  buildWorld(map);
  dyn.clear();
  views = { lanterns: new Map(game.lanterns.map((l) => [l.id, makeLantern(l)])), motes: new Map(), shades: new Map(), drifters: new Map(), charms: new Map(game.charms.map((c) => [c.id, makeCharm(c)])) };
  camYaw = 0; pulseAnim = 0; lastCountdown = -1; windWarned = false;
  bot = autoNight ? createBot() : null;
  phase = 'playing'; hideCard(); $('hudroot').classList.remove('hidden');
  $('nightname').textContent = INTRO[n][0];
  sound.ensure(); sound.startMusic();
}
function showResult() {
  const won = game.state === 'won';
  sound.sfx(won ? 'win' : 'lose');
  if (won) totals[night - 1] = game.score;
  resultState = { won };
  showResultCard();
}
let resultState = { won: false };
function showResultCard() {
  const won = resultState.won;
  phase = 'result';
  const st = game.stats, S = T.score;
  const total = totals.reduce((a, b) => a + (b || 0), 0);
  const rows = [
    ['Đom đóm châm dầu', `${st.deposited} × ${S.per_mote}`],
    ['Đèn thắp lần đầu', `${st.lanterns} × ${S.per_lantern}`],
    ['Đèn thắp lại', `${st.relights} × ${S.per_relight}`],
    ['Bóng Mực trúng Tỏa Sáng', `${st.stuns} × ${S.per_stun}${st.stunDrain ? ` (+${st.stunDrain}×${S.per_stun_bonus} lúc đang hút)` : ''}`],
  ];
  if (won) rows.push(['Thưởng bình minh (đèn + dầu)', `+${st.bonusLanterns}`], ['Thưởng Ngọn Lửa', `+${st.bonusFlames}`]);
  rows.push(['<b>Điểm Đêm này</b>', `<b>${game.score}</b>`]);
  card(`<h2>${won ? INTRO[night][0] + ' đã sáng!' : 'Đêm chưa trọn…'}</h2><p>${resultReason()}</p>
    <table>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}<tr><td>Tổng điểm các Đêm đã thắng</td><td>${total}</td></tr></table>
    <div class="btns">${won ? (night < 3 ? '<button id="r-next">Đêm kế tiếp</button>' : '<button id="r-dawn">Đón bình minh</button>') : '<button id="r-retry">Chơi lại Đêm</button>'}
    <button id="r-save">${runSaved ? 'Xem bảng xếp hạng' : 'Lưu điểm'}</button>
    <button class="ghost" id="r-menu">Về menu</button></div>`);
  bind('r-next', () => showIntro(night + 1));
  bind('r-dawn', showDawn);
  bind('r-retry', () => startNight(night));
  bind('r-save', () => {
    if (runSaved) return showLeaderboard('result', lastName);
    return saveRunAndShow();
  });
  bind('r-menu', () => { sound.stopMusic(); showMenu(); });
}
function resultReason() {
  const need = Math.ceil((T.win_ratio ?? 0.6) * game.lanterns.length);
  return {
    dawn_survived: `Bình minh đã về với ${litCount(game)}/${game.lanterns.length} đèn còn sáng (cần ${need}).`,
    dawn: `Chỉ còn ${litCount(game)}/${game.lanterns.length} đèn sáng khi bình minh tới (cần ${need}).`,
    no_flames: 'Ngọn lửa của Mây đã tắt.',
  }[game.reason] ?? '';
}
/** Lưu ván hiện tại (thắng hoặc thua) và mở bảng xếp hạng sau khi nhập tên. */
function saveRunAndShow() {
  // Bản chơi thật không có `totals` rỗng khi kết thúc Đêm 1 (thắng thì ít nhất một Đêm có điểm); emptyTotals
  // chỉ dùng khi kiểm chứng UI có tổng cho trước, nên dùng luôn tổng đó.
  const t = totals.length && totals.some((x) => x > 0) ? totals : UI_RESULT_TOTALS;
  const { fresh, won, score } = newRunEntries({ totals: t, seed });
  if (t !== totals) totals = [...t];
  // Đã lưu ván này rồi (ví dụ bấm "Lưu điểm" lần hai): mở bảng luôn, không hỏi tên lại.
  if (!fresh.length) return showLeaderboard(phase === 'dawn' ? 'dawn' : 'result', lastName);
  showNameInput({
    score, nightsWon: won,
    onDone: (name) => {
      const r = commitRun(fresh, name);
      if (r.ok) runSaved = true;
      return r;
    },
  });
}
function showDawn() {
  phase = 'dawn'; sound.stopMusic(); $('hudroot').classList.add('hidden');
  scene.background.set('#f6b37b'); scene.fog.color.set('#f6c99b');
  const total = totals.reduce((a, b) => a + (b || 0), 0);
  card(`<h1>Bình Minh</h1><p class="quote">Ông Đăng: "Ba hòn đảo đã sáng. Cảm ơn con, người giữ đèn nhỏ."</p>
    <table>${totals.map((s, i) => `<tr><td>${INTRO[i + 1][0]}</td><td>${s}</td></tr>`).join('')}<tr><td><b>Tổng điểm</b></td><td><b>${total}</b></td></tr></table>
    <div class="btns"><button id="d-board">Lưu điểm & bảng xếp hạng</button><button class="ghost" id="d-menu">Về menu</button></div>`);
  bind('d-board', () => (runSaved ? showLeaderboard('dawn', lastName) : saveRunAndShow()));
  bind('d-menu', () => { scene.background.set(C.night); scene.fog.color.set(C.fog); showMenu(); });
}

// ---------- Điều khiển ----------
const keys = new Set();
let camYaw = 0, dragX = null;
let listening = null;   // hành động đang chờ gán phím trong Cài đặt
addEventListener('keydown', (e) => {
  // Gán phím (Ticket-04 mục 4): phím vừa nhấn trở thành phím của hành động đang chọn.
  if (listening) {
    e.preventDefault();
    const action = listening;
    const r = assignKey(settings, action, keyCodeFromEvent(e));
    if (r.error) { $('s-err').textContent = r.error; return; }
    listening = null;
    Object.assign(settings, r.settings);
    saveSettings();
    showSettings(returnTo, `Đã gán ${keyLabel(e.code)} cho "${ACTIONS.find((a) => a.id === action).label}".`);
    return;
  }
  keys.add(e.code);
  if ((phase === 'playing' || phase === 'paused') && held('pause') && !wasPause) {
    if (phase === 'playing') showPause(); else resume();
    wasPause = true;
  }
  if (held('jump') || e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
let wasPause = false;
addEventListener('keyup', (e) => { keys.delete(e.code); if (!held('pause')) wasPause = false; });
addEventListener('pointerdown', (e) => { if (phase === 'playing') dragX = e.clientX; });
addEventListener('pointerup', () => { dragX = null; });
addEventListener('pointermove', (e) => { if (dragX === null) return; camYaw -= (e.clientX - dragX) * 0.3 * settings.sensitivity; dragX = e.clientX; });
function readInput() {
  if (keys.has('ArrowLeft')) camYaw += 110 * DT * settings.sensitivity;
  if (keys.has('ArrowRight')) camYaw -= 110 * DT * settings.sensitivity;
  const x = (held('left') ? 1 : 0) - (held('right') ? 1 : 0); // θ=0 nhìn +Z thì "phải màn hình" là −X
  const z = (held('up') ? 1 : 0) - (held('down') ? 1 : 0);
  return { move: [x, z], cam_yaw_deg: camYaw, jump: held('jump'), interact: held('interact'), pulse: held('pulse'), dash: held('dash'), pause: false };
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
  if (e.name === 'player_hit') cameraShake = 1;   // rung camera; bỏ qua khi bật "giảm chuyển động"
}

const tmpV = new THREE.Vector3();
function render(t) {
  if (!game) { renderer.render(scene, camera); return; }
  const p = game.player;
  may.g.position.set(...p.pos);
  may.g.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  may.g.visible = p.respawn === 0 && !(p.invuln > 0 && Math.floor(t * 12) % 2 === 0);
  const cap = playerCapacity(game);
  const fill = Math.min(1, p.carried / Math.max(1, cap));
  may.light.intensity = 3 + 7 * fill;           // sáng tạo: đèn trên nón sáng theo số đom đóm
  may.lamp.material.emissiveIntensity = 1 + 3 * fill;

  // Ticket-03: đèn — fuel, vùng an toàn theo ngưỡng 30, thanh dầu, nhấp nháy khi fuel < 30
  const lowThr = T.low_fuel_threshold;
  const fuelMaxUnits = T.fuel_max * 60;
  const blink = Math.floor(t * 2) % 2 === 0;    // 1 Hz (2 nhịp/giây) → xấp xỉ sáng/tối mỗi 0.5 s
  for (const l of game.lanterns) {
    const v = views.lanterns.get(l.id);
    const fuel = l.fuel100 / 60;
    const low = l.lit && fuel < lowThr;
    const safe = l.lit && fuel >= lowThr;
    v.head.material.color.set(l.lit ? C.core : C.off);
    v.head.material.emissive.set(C.lit);
    v.head.material.emissiveIntensity = l.lit ? (low && blink ? 0.8 : 2.2) : 0;
    v.light.intensity = l.lit ? (low && blink ? 10 : 45 + 6 * Math.sin(t * 3 + l.pos[0])) : 0;
    v.chop.visible = low;
    v.ring.material.opacity = safe ? 0.35 : 0;
    // Ticket-03 mục 6: đèn tắt xẹp 20% + giấy rách (vết rách luôn hiện, nhưng to hơn khi tắt)
    const scale = l.lit ? 1 : 0.8;
    v.roof.scale.setScalar(scale); v.head.scale.setScalar(scale);
    v.tear.visible = true; v.tear.scale.setScalar(l.lit ? 0.5 : 1);
    // Thanh dầu: chỉ hiện khi đèn đang sáng
    v.barBg.visible = l.lit; v.barFg.visible = l.lit;
    if (l.lit) {
      const frac = Math.max(0, Math.min(1, l.fuel100 / fuelMaxUnits));
      v.barFg.scale.x = frac || 0.001;
      v.barFg.position.x = -(1 - frac) * 0.6;
      v.barFg.material.color.set(low ? (settings.cb ? palette.danger : '#FF5A5F') : C.lit);
    }
  }
  // Bóng Mực: viền theo bảng màu (Ticket-03 mục 6), drain có quầng nâu
  for (const v of views.shades.values()) v.rim.material.color.set(palette.rim);
  sync(views.motes, game.motes, () => { const g = new THREE.Group(); g.add(new THREE.Mesh(moteGeo, moteMat), new THREE.Mesh(haloGeo, haloMat)); dyn.add(g); return g; },
    (g, m) => { g.position.set(m.pos[0], m.pos[1] + 0.8 + 0.2 * Math.sin(t * 2.5 + m.pos[0] * 3), m.pos[2]); g.scale.setScalar(m.kind === 'dropped' && m.ttl < 120 && Math.floor(t * 8) % 2 ? 0.6 : 1); });
  sync(views.shades, game.shades, makeShade, (v, sh) => {
    v.g.position.set(sh.pos[0], sh.pos[1] + 0.12 * Math.sin(t * 4 + sh.pos[2]), sh.pos[2]);
    const stunned = sh.state === 'stunned';
    const draining = sh.state === 'drain';
    v.body.material.color.set(stunned ? C.stunned : C.shade);
    v.rim.material.opacity = sh.state === 'spawning' ? 0.1 : stunned ? 0.05 : draining ? 0.55 + 0.3 * Math.sin(t * 10) : 0.3 + 0.15 * Math.sin(t * 6);
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

  if (cameraShake > 0) cameraShake = Math.max(0, cameraShake - 1 / 24);
  const th = (camYaw * Math.PI) / 180;
  const fx = Math.sin(th), fz = Math.cos(th);
  const sh = shakeOffset();
  camera.position.set(p.pos[0] - fx * 9 + sh, p.pos[1] + 5.5 + sh * 0.5, p.pos[2] - fz * 9);
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

// ---------- Phụ đề / chỉ báo hình ảnh (Ticket-04 mục 4) ----------
// Bóng Mực xuất hiện (kèm mũi tên ở mép), gió sắp thổi, 10 giây cuối, đèn có fuel < 30.
const MAX_EDGE_ARROWS = 4;
const edgeArrows = Array.from({ length: MAX_EDGE_ARROWS }, () => {
  const a = document.createElement('div');
  a.className = 'edgearrow hud';
  a.style.position = 'fixed';
  $('hudroot').append(a);
  return a;
});
function updateSubs() {
  const p = game.player;
  const subs = [];
  const spawning = game.shades.filter((s) => s.state === 'spawning').length;
  const chasing = game.shades.filter((s) => s.state === 'chase').length;
  const draining = game.shades.filter((s) => s.state === 'drain').length;
  const parts = [];
  if (spawning) parts.push(`${spawning} sắp hiện`);
  if (chasing) parts.push(`${chasing}:${'\u2009'}đuổi theo`);
  if (draining) parts.push(`${draining} hút dầu đèn`);
  if (parts.length) subs.push(['shade', `Bóng Mực: ${parts.join(' · ')} · tổng ${game.shades.length}`]);
  const st = game.steps;
  const warn = game.windEnabled && !game.wind.active && st % STD.windEvery >= STD.windEvery - 120;
  if (game.wind.active) subs.push(['', 'Gió đang thổi mạnh']);
  else if (warn) subs.push(['', 'Gió sắp nổi (2 giây)']);
  const tl = Math.max(0, timeLeft(game));
  if (tl <= 10 && phase === 'playing') subs.push(['dawn', `Bình minh sau ${Math.ceil(tl)} giây`]);
  const low = game.lanterns.filter((l) => isLowFuel(game, l));
  if (low.length) subs.push(['fuel', `Đèn yếu (dầu < ${T.low_fuel_threshold}): ${low.map((l) => `${l.id} ${Math.floor(fuelOf(l))}`).join(', ')}`]);
  $('subs').innerHTML = subs.map(([cls, text]) => `<div class="${cls}">${escapeHtml(text)}</div>`).join('');

  // Mũi tên ở mép màn hình chỉ những Bóng Mực gần nhất đang ngoài khung hình.
  const outside = game.shades
    .map((sh) => ({ sh, d: Math.hypot(sh.pos[0] - p.pos[0], sh.pos[2] - p.pos[2]) }))
    .map((x) => { tmpV.set(x.sh.pos[0], x.sh.pos[1], x.sh.pos[2]).project(camera); return { ...x, v: { x: tmpV.x, y: tmpV.y, z: tmpV.z } }; })
    .filter((x) => x.v.z > 1 || Math.abs(x.v.x) > 1 || Math.abs(x.v.y) > 1)
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_EDGE_ARROWS);
  edgeArrows.forEach((el, i) => {
    const x = outside[i];
    if (!x) { el.classList.add('hidden'); return; }
    let { x: vx, y: vy } = x.v;
    if (x.v.z > 1) { vx = -vx; vy = -vy; }
    const ang = Math.atan2(vy, vx);
    const k = 0.9 / Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)));
    const sx = (Math.cos(ang) * k * 0.5 + 0.5) * innerWidth, sy = (-Math.sin(ang) * k * 0.5 + 0.5) * innerHeight;
    el.style.left = `${sx - 13}px`; el.style.top = `${sy - 13}px`;
    el.style.transform = `rotate(${Math.PI / 2 - ang}rad)`;
    el.classList.remove('hidden');
  });
}

// Rung camera (Ticket-04 mục 4: "giảm chuyển động" tắt rung). cameraShake > 0 trong 0.35 s sau mỗi cú chạm.
let cameraShake = 0;
const shakeOffset = () => (settings.reducedMotion || cameraShake <= 0 ? 0 : Math.sin(performance.now() / 18) * 0.18 * cameraShake);

function updateHud() {
  const p = game.player;
  $('flames').textContent = '🔥'.repeat(Math.max(0, p.flames)) + '·'.repeat(Math.max(0, T.flames - p.flames));
  const tl = Math.max(0, timeLeft(game));
  $('timer').textContent = `${String(Math.floor(tl / 60)).padStart(2, '0')}:${String(Math.floor(tl % 60)).padStart(2, '0')}`;
  $('timer').classList.toggle('low', tl <= 30);
  const sec = Math.ceil(tl);
  if (phase === 'playing' && tl <= 10 && sec !== lastCountdown) { lastCountdown = sec; sound.sfx('tick'); }
  const need = winThreshold(T, game.lanterns.length);
  $('topright').innerHTML = `Đèn <b>${litCount(game)}/${game.lanterns.length}</b> <span style="opacity:0.8">(cần ${need})</span><br>Điểm <b>${game.score}</b>`;
  const cap = playerCapacity(game);
  const bar = $('bar');
  if (bar.children.length !== cap) bar.innerHTML = '<i></i>'.repeat(cap);
  [...bar.children].forEach((c, i) => c.classList.toggle('on', i < p.carried));
  $('carry').textContent = `${p.carried} / ${cap}`;
  // Bảng đèn (chỉ hiển thị): từng đèn sáng/tắt, dầu hiện tại, ⚠ khi dầu < ngưỡng; kèm số đom đóm trên đảo.
  $('lanterns').innerHTML = game.lanterns.map((l) => {
    const f = fuelOf(l), low = isLowFuel(game, l);
    const pct = Math.max(0, Math.min(100, (100 * f) / T.fuel_max));
    const cls = !l.lit ? 'off' : low ? 'low' : 'on';
    const val = l.lit ? `${Math.floor(f)}` : (l.everLit ? 'tắt' : '—');
    return `<div class="${cls}"><span class="lid">${l.id}</span><span class="lfuel"><i style="width:${l.lit ? pct : 0}%"></i></span><span class="lval">${low ? '⚠ ' : ''}${val}</span></div>`;
  }).join('') + `<div class="motes">Đom đóm trên đảo: <b>${game.motes.length}</b></div>`;
  const cd = (el, left, total, ok) => { el.style.setProperty('--p', `${(100 * left) / total}%`); el.classList.toggle('ready', left === 0 && ok); };
  cd($('cd-dash'), p.charm > 0 ? 0 : p.dashCd, Math.round(T.dash_cooldown_s * 60), true);
  cd($('cd-pulse'), p.pulseCd, Math.round(T.pulse_cooldown_s * 60), p.carried >= T.pulse_cost);
  $('charm').classList.toggle('hidden', p.charm === 0);
  $('charm').textContent = `Bùa Gió ${(p.charm / 60).toFixed(1)}s`;
  // Ticket-03 mục 1: nhắc "E — Thắp đèn" / "E — Châm dầu (fuel/100)" cho đèn NHẬN ĐƯỢC trong 2 m.
  const nearAll = game.lanterns
    .map((l) => ({ l, d: Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) }))
    .filter((x) => x.d <= T.interact_radius + 1e-6)
    .sort((a, b) => a.d - b.d || a.l.id.localeCompare(b.l.id));
  const near = nearAll.filter((x) => reachesLantern(x.l, T.fuel_max))[0];
  $('prompt').classList.toggle('hidden', !near);
  if (near) {
    const l = near.l;
    const n = Math.ceil((T.fuel_max - fuelOf(l)) / T.fuel_per_mote - 1e-9);
    const keyE = keyLabel(settings.keys.interact);
    const label = !l.lit
      ? (l.everLit ? `${keyE} — Thắp lại (cần ${T.relight_cost})` : `${keyE} — Thắp đèn (cần ${T.lantern_cost})`)
      : `${keyE} — Châm dầu (${Math.floor(fuelOf(l))}/${T.fuel_max}` + (n > 0 ? `, cần ${n}` : '') + ')';
    $('prompt').textContent = `${label}${p.carried >= (l.lit ? n : (l.everLit ? T.relight_cost : T.lantern_cost)) ? '' : ' — chưa đủ đom đóm'}`;
  }
  updateSubs();
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
// Seed phải có TRƯỚC startNight: game tạo với seed 0 nếu không, còn bảng xếp hạng mới ghi seed từ URL.
if (qs.has('seed')) seed = Number(qs.get('seed')) || 0;
requestAnimationFrame(frame);
if (autoNight) startNight(Number(qs.get('bench') || qs.get('autostart') || qs.get('demo')) || 1);
else showMenu();
// Hook cho kiểm chứng tự động bằng CDP (không ảnh hưởng luật chơi).
window.__game = () => game;
window.__ddl = {
  phase: () => phase,
  // Vào màn kết quả với tổng điểm cho trước (chỉ dùng cho ảnh/kiểm chứng UI, không đổi luật hay điểm thật).
  demoResult: (totalsIn, won = true) => {
    if (!game) startNight(1);
    if (qs.has('seed')) seed = Number(qs.get('seed')) || 0;
    totals = [...totalsIn]; UI_RESULT_TOTALS = [...totalsIn]; runSaved = false;
    game.stats.bonusLanterns = 0; game.stats.bonusFlames = 0;
    game.state = won ? 'won' : 'lost';
    game.reason = won ? 'dawn_survived' : 'no_flames';
    phase = 'playing';
    showResult();
    return phase;
  },
  saveRun: () => { saveRunAndShow(); return phase; },
  resetBoard: () => resetLeaderboard(),
  showLeaderboard: () => showLeaderboard('menu'),
};
