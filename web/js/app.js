// GeoAR Pro – webová hra (PWA), orientace na šířku.
//
// Ovládání:
//   • chůze joystickem vlevo dole, rozhlížení tažením prstu (v AR otáčením telefonu – gyroskop),
//   • přístroj se ovládá tlačítky v pravém panelu (hrubé otáčení, dalekohled, stavěcí šrouby,
//     jemné ustanovky), případně přímo tažením po modelu nebo rukou (MediaPipe),
//   • 👁 Okulár = pohled dalekohledem s nitkovým křížem a dálkoměrnými ryskami.

import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { CATALOG, CATEGORIES, byId, displayName, specRows } from './catalog.js';
import { Kinematics, makeConfig } from './kinematics.js';
import { makeTotalStation, makeLevel, makeTripod, makeRover, makeRod, makePrism, drawLCD, drawTablet } from './models.js';
import { HandTracker } from './hands.js';
import { TAU, gon, deg, toDeg, toArcsec, wrapPi, clamp, azimuth, formatAngle, formatSmall, formatDist, gauss } from './geodesy.js';

const $ = (id) => document.getElementById(id);
const TRIPOD_H = 1.25;
const WALK_SPEED = 2.2; // m/s

// ---------------------------------------------------------------------------------------
// Stav

const S = {
  mode: '3d', unit: 'gon', selected: CATALOG[0], cat: 'ts',
  player: { x: 0, z: 0, yaw: 0, pitch: -0.12 },
  joy: { x: 0, y: 0 },
  orient: null, gyro: false,
  setup: null, rods: [], hand: false, handState: null,
  telescope: false, zoom: 30, readout: null, targetDist: null,
};

// ---------------------------------------------------------------------------------------
// Renderer, scéna, osvětlení

const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.02, 600);

scene.add(new THREE.HemisphereLight(0xdfefff, 0x5a4a38, 0.7));
const sun = new THREE.DirectionalLight(0xfff4e6, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 40 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

const world = new THREE.Group();
scene.add(world);

const grassTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#4f7a3a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) { g.fillStyle = `hsla(${90 + Math.random() * 30},45%,${25 + Math.random() * 20}%,0.6)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(300, 300); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
})();
const groundVisual = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
groundVisual.rotation.x = -Math.PI / 2; groundVisual.receiveShadow = true;
world.add(groundVisual);
const groundShadow = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.ShadowMaterial({ opacity: 0 }));
groundShadow.rotation.x = -Math.PI / 2; groundShadow.position.y = 0.001; groundShadow.receiveShadow = true;
world.add(groundShadow);

const sky = (() => {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#2d6fb8'); gr.addColorStop(0.5, '#9cc9ee'); gr.addColorStop(0.52, '#dfe9ef'); gr.addColorStop(1, '#6b7d63');
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
})();
const scenery = new THREE.Group();
world.add(scenery);

// ---------------------------------------------------------------------------------------
// Režimy AR / 3D

/** Musí se volat PŘÍMO z klepnutí: iOS jinak žádost o gyroskop tiše zamítne. */
function requestGyro() {
  const req = typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission;
  const p = req ? DeviceOrientationEvent.requestPermission().catch(() => 'denied') : Promise.resolve('granted');
  addEventListener('deviceorientation', onOrientation);
  return p;
}

async function startAR() {
  const gyroPermission = requestGyro();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    $('cam').srcObject = stream;
    await $('cam').play().catch(() => {});
  } catch {
    toast('Kamera není k dispozici – hraji ve 3D', 'warn');
    return setMode('3d');
  }
  setMode('ar');
  const perm = await gyroPermission;
  setTimeout(() => {
    if (!S.gyro) toast(perm === 'denied' ? 'Gyroskop zamítnut – rozhlížejte se tažením prstu' : 'Gyroskop nereaguje – rozhlížejte se tažením prstu', 'warn');
  }, 1500);
}

function onOrientation(e) {
  if (e.alpha == null || e.beta == null) return;
  S.orient = { alpha: deg(e.alpha), beta: deg(e.beta), gamma: deg(e.gamma) };
  S.gyro = true;
}

function setMode(mode) {
  S.mode = mode;
  const ar = mode === 'ar';
  $('cam').classList.toggle('hidden', !ar);
  scene.background = ar ? null : sky;
  groundVisual.visible = !ar;
  scenery.visible = !ar;
  groundShadow.material.opacity = ar ? 0.35 : 0;
  $('modeBtn').textContent = ar ? '📷 AR' : '🧊 3D';
  $('handBtn').classList.toggle('hidden', !ar);
  if (!ar && S.hand) toggleHand();
  updateFov();
  updateHint();
}

// Orientace zařízení → kvaternion kamery (algoritmus DeviceOrientationControls).
const _euler = new THREE.Euler(), _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const _zee = new THREE.Vector3(0, 0, 1);
function deviceQuaternion(o) {
  const screenAngle = deg(screen.orientation?.angle ?? window.orientation ?? 0);
  const q = new THREE.Quaternion();
  _euler.set(o.beta, o.alpha, -o.gamma, 'YXZ');
  q.setFromEuler(_euler);
  q.multiply(_q1);
  q.multiply(_q0.setFromAxisAngle(_zee, -screenAngle));
  return q;
}

/** Svislé zorné pole – v AR odpovídá videu (delší strana snímače ≈ 65°, object-fit: cover). */
function updateFov() {
  const v = $('cam');
  if (S.mode === 'ar' && v.videoWidth) {
    const s = Math.max(innerWidth / v.videoWidth, innerHeight / v.videoHeight);
    const tanPerPx = Math.tan(deg(65) / 2) / (Math.max(v.videoWidth, v.videoHeight) / 2);
    camera.fov = toDeg(2 * Math.atan(tanPerPx * (innerHeight / 2) / s));
  } else {
    camera.fov = innerWidth > innerHeight ? 45 : 60;
  }
  camera.updateProjectionMatrix();
}
$('cam').addEventListener('loadedmetadata', updateFov);

// ---------------------------------------------------------------------------------------
// Hráč: chůze a rozhlížení

const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function updatePlayer(dt) {
  const p = S.player;
  camera.position.set(p.x, S.mode === 'ar' ? 1.45 : 1.62, p.z);
  if (S.mode === 'ar' && S.gyro && S.orient) camera.quaternion.copy(deviceQuaternion(S.orient));
  else camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');

  if (S.joy.x || S.joy.y) {
    camera.getWorldDirection(_fwd); _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
    _fwd.normalize();
    _right.crossVectors(_fwd, UP);
    const step = WALK_SPEED * dt;
    p.x = clamp(p.x + (_fwd.x * -S.joy.y + _right.x * S.joy.x) * step, -250, 250);
    p.z = clamp(p.z + (_fwd.z * -S.joy.y + _right.z * S.joy.x) * step, -250, 250);
  }
  sun.position.set(p.x + 4, 9, p.z + 5);
  sun.target.position.set(p.x, 0, p.z);
}

/** Bod na zemi `dist` metrů před hráčem. */
function groundAhead(dist) {
  camera.getWorldDirection(_fwd); _fwd.y = 0;
  if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
  _fwd.normalize();
  return new THREE.Vector3(S.player.x + _fwd.x * dist, 0, S.player.z + _fwd.z * dist);
}

// Joystick
(() => {
  const joy = $('joy'), knob = $('joyKnob'), R = 44;
  let id = null, cx = 0, cy = 0;
  const set = (x, y) => {
    let dx = x - cx, dy = y - cy; const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    S.joy.x = dx / R; S.joy.y = dy / R;
  };
  joy.addEventListener('pointerdown', (e) => {
    id = e.pointerId; joy.setPointerCapture(id);
    const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    set(e.clientX, e.clientY);
  });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e.clientX, e.clientY); });
  const end = (e) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; S.joy.x = S.joy.y = 0; };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
})();

// ---------------------------------------------------------------------------------------
// Stavění vybavení

function place() {
  const m = S.selected;
  const dist = m.kind === 'rod' ? 5 : m.kind === 'gnss' ? 2 : 2.2;
  const p = groundAhead(dist);
  const yaw = Math.atan2(S.player.x - p.x, S.player.z - p.z); // záda přístroje (+Z) k hráči
  closeCatalog();

  if (m.kind === 'rod') {
    const rod = makeRod(m.spec.length);
    rod.root.position.copy(p); rod.root.rotation.y = yaw;
    world.add(rod.root); S.rods.push(rod);
    if (S.rods.length > 6) world.remove(S.rods.shift().root);
    toast('Lať postavena');
    return;
  }

  if (S.setup) world.remove(S.setup.anchor);
  const anchor = new THREE.Group();
  anchor.position.copy(p); anchor.rotation.y = yaw;
  world.add(anchor);
  const setup = { model: m, anchor, log: {} };

  if (m.kind === 'ts' || m.kind === 'level') {
    const tripod = makeTripod(TRIPOD_H);
    const rig = m.kind === 'ts' ? makeTotalStation(m) : makeLevel(m);
    const k = new Kinematics(makeConfig(m));
    k.s.setupTilt = Kinematics.randomSetupTilt();
    tripod.apply(k.s.setupTilt);
    rig.root.position.y = TRIPOD_H;
    anchor.add(tripod.root, rig.root);
    rig.apply(k);
    Object.assign(setup, { tripod, rig, k });
  } else if (m.kind === 'tripod') {
    const tripod = makeTripod(TRIPOD_H);
    tripod.apply(Kinematics.randomSetupTilt());
    anchor.add(tripod.root);
    setup.tripod = tripod;
  } else if (m.kind === 'gnss') {
    const rover = makeRover(m);
    anchor.add(rover.root);
    Object.assign(setup, { rover, pole: [0, 1, 0], sim: { t: 0, last: 0, sats: 26, fixDone: false }, tiltComp: true });
  }
  S.setup = setup;
  S.readout = null;
  buildTargets(anchor);
  aimAtNearestRod(setup);
  // Pohled na přístroj (mírně shora).
  if (S.mode === '3d') S.player.pitch = -0.28;
  buildPanel();
  updateHint();
  toast(setup.k ? 'Nejdřív zhorizontujte přístroj šrouby A, B, C' : setup.rover ? 'Hledám družice…' : 'Postaveno');
}

function aimAtNearestRod(st) {
  if (!st.k) return;
  let best = null;
  for (const r of S.rods) {
    const local = st.anchor.worldToLocal(r.root.getWorldPosition(new THREE.Vector3()));
    const d = Math.hypot(local.x, local.z);
    if (d > 6 && (!best || d < best.d)) best = { d, local };
  }
  if (!best) return;
  // Přední směr alhidády po otočení o α je (−sin α, −cos α).
  st.k.s.alpha = Math.atan2(-best.local.x, -best.local.z) + deg((Math.random() - 0.5) * 4);
  st.rig.apply(st.k);
}

/** Cíle kolem prvního stanoviska: latě, hranol a budovy. */
let targetsBuilt = false;
function buildTargets(anchor) {
  if (targetsBuilt) return;
  targetsBuilt = true;
  const at = (dx, dz) => new THREE.Vector3(dx, 0, dz).applyAxisAngle(UP, anchor.rotation.y).add(anchor.position);
  const face = (o) => o.lookAt(anchor.position.x, o.position.y, anchor.position.z);
  for (const [dx, dz] of [[0.4, -18], [-9, -34], [14, -26]]) {
    const r = makeRod(3); r.root.position.copy(at(dx, dz)); face(r.root);
    world.add(r.root); S.rods.push(r);
  }
  const prism = makePrism(); prism.root.position.copy(at(12, -45)); face(prism.root);
  world.add(prism.root);
  const bMat = [0xd8cfc0, 0xbfc7cf, 0xc9b59a, 0xe6e1d6].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
  const winMat = new THREE.MeshStandardMaterial({ color: 0x2a3848, roughness: 0.2, metalness: 0.5 });
  for (let i = 0; i < 9; i++) {
    const a = -1.2 + i * 0.3, r = 70 + (i % 3) * 25;
    const w = 10 + (i % 4) * 4, h = 8 + ((i * 7) % 5) * 5, d = 10;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bMat[i % 4]);
    b.position.copy(at(Math.sin(a) * r, -Math.cos(a) * r)).setY(h / 2);
    face(b);
    b.castShadow = b.receiveShadow = true;
    for (let f = 0; f < Math.floor(h / 3.2); f++) for (let wx = 0; wx < Math.floor(w / 3); wx++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.5), winMat);
      win.position.set(-w / 2 + 1.5 + wx * 3, -h / 2 + 1.8 + f * 3.2, d / 2 + 0.01);
      b.add(win);
    }
    b.traverse((o) => { o.userData.target = 'building'; });
    scenery.add(b);
  }
}

// ---------------------------------------------------------------------------------------
// Akce přístroje (sdílené panelem, přímým tažením i rukou)

function act(fn) {
  const st = S.setup;
  if (!st?.k) return;
  const fb = fn(st.k) || {};
  st.rig.apply(st.k);
  feedback(fb);
}

function feedback(fb) {
  if (fb.ticks) navigator.vibrate?.(4);
  if (fb.blocked) toast('Svěrka je utažená – použijte jemnou ustanovku', 'warn');
  if (fb.released) toast('Nejdřív utáhněte svěrku', 'warn');
  if (fb.limit) toast('Konec chodu šroubu', 'warn');
  if (fb.level === 'leveled') toast('Přístroj je zhorizontován ✓', 'ok');
  if (fb.level === 'compensated') toast('V rozsahu kompenzátoru – dolaďte bublinu do kroužku', 'info');
}

// ---------------------------------------------------------------------------------------
// Přímé ovládání tažením po modelu / rozhlížení tažením

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const PRIORITY = { hDrive: 4, vDrive: 4, focus: 4, screw0: 3, screw1: 3, screw2: 3, telescope: 2, alidade: 1, pole: 1, tripod: 0 };
const PART_NAMES = { alidade: 'alhidáda', telescope: 'dalekohled', hDrive: 'Hz ustanovka', vDrive: 'V ustanovka', focus: 'ostření',
  screw0: 'šroub A', screw1: 'šroub B', screw2: 'šroub C', pole: 'výtyčka', tripod: 'stativ' };
let grab = null;

function rayAt(x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray;
}

function pick(x, y) {
  if (!S.setup) return null;
  rayAt(x, y);
  const hits = raycaster.intersectObject(S.setup.anchor, true).filter((h) => h.object.userData.part);
  if (!hits.length) return null;
  const near = hits[0].distance;
  let best = null;
  for (const h of hits) {
    if (h.distance - near > 0.02) break;
    const p = PRIORITY[h.object.userData.part] ?? 0;
    if (!best || p > best.p) best = { kind: h.object.userData.part, p, dist: h.distance };
  }
  return best;
}

function pointerDown(x, y, roll = null) {
  const hit = pick(x, y);
  if (hit && hit.kind !== 'tripod') {
    grab = { kind: hit.kind, lastX: x, lastY: y, lastAngle: null, lastRoll: roll };
    grabMove(x, y, roll, true);
    return;
  }
  grab = { kind: 'look', lastX: x, lastY: y };
}

function pointerMove(x, y, roll = null) {
  if (!grab) return;
  if (grab.kind === 'look') {
    // Rozhlížení (ve 3D vždy, v AR jen bez gyroskopu).
    if (!(S.mode === 'ar' && S.gyro)) {
      S.player.yaw -= (x - grab.lastX) * 0.005;
      S.player.pitch = clamp(S.player.pitch - (y - grab.lastY) * 0.004, -1.2, 1.0);
    }
    grab.lastX = x; grab.lastY = y;
    return;
  }
  grabMove(x, y, roll, false);
}

function pointerUp() { grab = null; }

function angleAround(ray, axis, center, ref) {
  const denom = ray.direction.dot(axis);
  if (Math.abs(denom) < 0.18) return null;
  const t = center.clone().sub(ray.origin).dot(axis) / denom;
  if (t <= 0) return null;
  const d = ray.origin.clone().addScaledVector(ray.direction, t).sub(center);
  d.addScaledVector(axis, -d.dot(axis));
  if (d.length() < 0.015) return null;
  const r = ref.clone().addScaledVector(axis, -ref.dot(axis)).normalize();
  return Math.atan2(d.dot(new THREE.Vector3().crossVectors(axis, r)), d.dot(r));
}

function grabMove(x, y, roll, first) {
  const g = grab, st = S.setup;
  const dx = x - g.lastX, dy = y - g.lastY;
  g.lastX = x; g.lastY = y;
  if (!st) return;
  const ray = rayAt(x, y);
  if (st.rover) {
    if (g.kind === 'pole' && !first) tiltPole(dx * 0.004, dy * 0.004);
    return;
  }
  if (!st.k) return;
  const rig = st.rig;
  const knob = (perPx) => {
    let t = -dy / perPx;
    if (roll != null && g.lastRoll != null) t += wrapPi(roll - g.lastRoll) / TAU;
    g.lastRoll = roll;
    return first ? 0 : t;
  };
  act((k) => {
    switch (g.kind) {
      case 'alidade': {
        const q = rig.leveling.getWorldQuaternion(new THREE.Quaternion());
        const a = angleAround(ray, UP.clone().applyQuaternion(q), rig.alidade.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(0, 0, -1).applyQuaternion(q));
        if (a != null) { const d = g.lastAngle != null ? wrapPi(a - g.lastAngle) : 0; g.lastAngle = a; return k.rotateAlidade(d); }
        return first ? {} : k.rotateAlidade(dx * 0.006);
      }
      case 'telescope': {
        const q = rig.alidade.getWorldQuaternion(new THREE.Quaternion());
        const a = angleAround(ray, new THREE.Vector3(1, 0, 0).applyQuaternion(q), rig.telescope.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(0, 0, -1).applyQuaternion(q));
        if (a != null) { const d = g.lastAngle != null ? wrapPi(a - g.lastAngle) : 0; g.lastAngle = a; return k.pitch(d); }
        return first ? {} : k.pitch(-dy * 0.004);
      }
      case 'hDrive': return k.turnH(knob(40));
      case 'vDrive': return k.turnV(knob(40));
      case 'focus': k.turnFocus(knob(120)); return {};
      case 'screw0': case 'screw1': case 'screw2': return k.turnScrew(+g.kind.slice(-1), knob(40));
    }
    return {};
  });
}

// Dotyky na scéně
const touches = new Set();
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  touches.add(e.pointerId);
  if (touches.size === 1 && !(S.hand && S.handState)) pointerDown(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', (e) => { if (touches.size === 1 && touches.has(e.pointerId)) pointerMove(e.clientX, e.clientY); });
const up = (e) => { touches.delete(e.pointerId); if (!touches.size) pointerUp(); };
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);

// ---------------------------------------------------------------------------------------
// Ruka (MediaPipe)

const handLayer = $('handLayer'), hctx = handLayer.getContext('2d');
const tracker = new HandTracker($('cam'), (h) => {
  const prev = S.handState;
  S.handState = h;
  if (h && h.pinching && !(prev && prev.pinching)) pointerDown(h.x, h.y, h.roll);
  else if (h && h.pinching) pointerMove(h.x, h.y, h.roll);
  else if (prev && prev.pinching) pointerUp();
  drawHand();
});
async function toggleHand() {
  S.hand = !S.hand;
  $('handBtn').classList.toggle('on', S.hand);
  if (S.hand) {
    toast('Načítám model ruky…');
    try { await tracker.start(); toast('Sevřete palec a ukazováček nad dílem přístroje ✋', 'ok'); }
    catch { S.hand = false; $('handBtn').classList.remove('on'); toast('Sledování ruky se nepodařilo spustit', 'warn'); }
  } else tracker.stop();
}
function drawHand() {
  const dpr = devicePixelRatio;
  if (handLayer.width !== Math.round(innerWidth * dpr)) { handLayer.width = innerWidth * dpr; handLayer.height = innerHeight * dpr; }
  hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  hctx.clearRect(0, 0, innerWidth, innerHeight);
  const h = S.handState;
  if (!S.hand || !h) return;
  const hover = !h.pinching && pick(h.x, h.y);
  const col = h.pinching ? '#5ceb8c' : hover ? '#40dbff' : '#fff';
  hctx.strokeStyle = col; hctx.fillStyle = col; hctx.lineWidth = h.pinching ? 4 : 2;
  hctx.beginPath(); hctx.arc(h.x, h.y, 14, 0, TAU); hctx.stroke();
  hctx.beginPath(); hctx.arc(h.x, h.y, 4, 0, TAU); hctx.fill();
  hctx.setLineDash(h.pinching ? [] : [4, 4]);
  hctx.beginPath(); hctx.moveTo(h.thumb.x, h.thumb.y); hctx.lineTo(h.x, h.y); hctx.stroke(); hctx.setLineDash([]);
  const label = grab && grab.kind !== 'look' ? PART_NAMES[grab.kind] : hover ? PART_NAMES[hover.kind] : null;
  hctx.font = '600 12px -apple-system, sans-serif';
  if (label) hctx.fillText(label, h.x + 18, h.y - 14);
}

// ---------------------------------------------------------------------------------------
// Měření (dálkoměr, lať, GNSS)

function lineOfSight() {
  const st = S.setup;
  const q = st.anchor.getWorldQuaternion(new THREE.Quaternion());
  const dir = new THREE.Vector3(...st.k.losMeasurement()).applyQuaternion(q).normalize();
  const origin = st.rig.objective.getWorldPosition(new THREE.Vector3());
  const center = st.rig.telescope ? st.rig.telescope.getWorldPosition(new THREE.Vector3()) : origin.clone().addScaledVector(dir, 0.125);
  return { origin, dir, center };
}

const measureRay = new THREE.Raycaster();
function measure() {
  const st = S.setup;
  const k = st.k, m = st.model;
  const { origin, dir, center } = lineOfSight();
  measureRay.set(origin, dir);
  measureRay.far = m.kind === 'ts' ? 300 : 150;
  const objs = [...S.rods.map((r) => r.root), ...world.children.filter((o) => o.name === 'Hranol'), groundShadow, scenery];
  const hit = measureRay.intersectObjects(objs, true)[0];
  let distance = null, rod = null, source = null;
  S.targetDist = null;
  if (hit) {
    const slope = center.distanceTo(hit.point);
    S.targetDist = slope;
    const target = hit.object.userData.target;
    source = target === 'rod' ? 'lať' : target === 'prism' ? 'hranol' : target === 'building' ? 'budova' : 'terén';
    if (m.kind === 'ts' && !(k.s.comp && k.levelState() === 'out')) {
      distance = slope + gauss() * (m.spec.edmA + m.spec.edmB * slope / 1000) / 1000;
    }
    if (target === 'rod') {
      const reading = hit.object.userData.rodRoot.worldToLocal(hit.point.clone()).y;
      const hd = slope * Math.hypot(dir.x, dir.z);
      rod = { reading, upper: reading + hd / 200, lower: reading - hd / 200, stadia: hd };
      if (m.kind === 'level') distance = rod.stadia;
    }
  }
  const r = k.readings();
  S.readout = {
    r, distance, rod, source,
    hd: distance != null && r.v != null && m.kind === 'ts' ? distance * Math.sin(r.v) : null,
    dh: distance != null && r.v != null && m.kind === 'ts' ? distance * Math.cos(r.v) : null,
    az: azimuth([dir.x, dir.y, dir.z]),
  };
  if (st.rig.lcd) {
    const u = S.unit === 'gon' ? ' g' : '';
    drawLCD(st.rig.lcd, m.name, k.s.comp ? 'COMP ▮▮▮' : 'comp off', [
      ['Hz', formatAngle(r.hz, S.unit) + u], ['V', formatAngle(r.v, S.unit) + u], ['SD', formatDist(distance) + ' m'],
    ], k.s.comp && r.state === 'out' ? 'TILT!' : null);
  }
}

function tiltPole(dx, dz) {
  const st = S.setup;
  let [x, y, z] = st.pole;
  x += dx; z += dz;
  const h = Math.hypot(x, z), maxH = Math.sin(deg(35));
  if (h > maxH) { x *= maxH / h; z *= maxH / h; }
  y = Math.sqrt(Math.max(0, 1 - x * x - z * z));
  st.pole = [x, y, z];
  st.rover.apply(st.pole);
}

function updateGNSS(now) {
  const st = S.setup, s = st.model.spec, sim = st.sim;
  const fix = st.gnss?.fix ?? '';
  st.rover.leds.forEach((led, i) => {
    const on = i === 0 || (i === 1 && fix && Math.floor(now * 2) % 2 === 0)
      || (i === 2 && (fix === 'RTK Fixed' || (fix === 'RTK Float' && Math.floor(now * 4) % 2 === 0)))
      || (i === 3 && Math.floor(now * 1.5) % 3 !== 0);
    led.material.emissiveIntensity = on ? 3 : 0;
  });
  if (now - sim.last < 1) return;
  const dt = sim.last ? now - sim.last : 1; sim.last = now; sim.t += dt;
  const [f, hrms, vrms] = sim.t < 2 ? ['Autonomní', 1.2, 2.1] : sim.t < 6 ? ['RTK Float', 0.18, 0.32] : ['RTK Fixed', s.rtkH / 1000, s.rtkV / 1000];
  sim.sats = clamp(sim.sats + Math.round(Math.random() * 2 - 1), 18, 34);
  const tilt = Math.acos(clamp(st.pole[1], -1, 1));
  const tipW = st.anchor.getWorldPosition(new THREE.Vector3());
  const antW = st.anchor.localToWorld(new THREE.Vector3(...st.pole).multiplyScalar(st.rover.antennaH));
  const comp = st.tiltComp && toDeg(tilt) <= s.tiltMax;
  const P = comp ? tipW : antW.clone().setY(antW.y - s.pole);
  const h = hrms + (comp ? s.tiltErr * toDeg(tilt) / 1000 : 0);
  // Místní souřadnice: E = +X, N = −Z, H = +Y (+ nepravý počátek).
  st.gnss = {
    fix: f, sats: sim.sats, pdop: 1.1 + Math.random() * 0.5 + (34 - sim.sats) * 0.03, hrms: h, vrms, tilt, comp,
    N: 5000 - P.z + gauss() * h / Math.SQRT2, E: 1000 + P.x + gauss() * h / Math.SQRT2, H: 250 + P.y + gauss() * vrms,
  };
  if (f === 'RTK Fixed' && !sim.fixDone) { sim.fixDone = true; toast('RTK Fixed ✓', 'ok'); }
  drawTablet(st.rover.tablet, `${st.model.name} · Měření`, f, [
    ['N', st.gnss.N.toFixed(3) + ' m'], ['E', st.gnss.E.toFixed(3) + ' m'], ['H', st.gnss.H.toFixed(3) + ' m'],
    ['Družice / PDOP', `${sim.sats} / ${st.gnss.pdop.toFixed(1)}`],
  ]);
}

// ---------------------------------------------------------------------------------------
// Horní lišta

function cell(label, value, unit = '', cls = '') {
  return `<div class="cell ${cls}"><div class="l">${label}</div><div class="v">${value}${unit ? `<small> ${unit}</small>` : ''}</div></div>`;
}
const STATE_TEXT = { leveled: ['Zhorizontováno', 'var(--green)'], compensated: ['Kompenzováno', 'var(--amber)'], out: ['Nezhorizontováno', 'var(--red)'] };

function updateTopbar() {
  const st = S.setup, pill = $('pill'), ro = $('readout');
  $('title').textContent = st ? displayName(st.model) : 'GeoAR Pro';
  const au = S.unit === 'gon' ? 'g' : '';
  if (st?.k && S.readout) {
    const { r, distance, rod } = S.readout;
    const [t, c] = STATE_TEXT[r.state];
    pill.textContent = t; pill.style.color = c; pill.style.borderColor = c; pill.classList.remove('hidden');
    // Mimo rozsah kompenzátoru přístroj neměří – ukazujeme aspoň čtení kruhů (oranžově).
    const warn = r.hz == null ? 'warn' : '';
    const hz = formatAngle(r.hz ?? r.mechHz, S.unit), v = formatAngle(r.v ?? r.mechV, S.unit);
    if (st.model.kind === 'level') {
      const dh = st.log.bs != null && st.log.fs != null ? (st.log.bs - st.log.fs).toFixed(4) : '--';
      ro.innerHTML = cell('Hz', hz, au, warn) + cell('Čtení na lati', formatDist(rod?.reading), 'm') +
        cell('Dálka', formatDist(distance), 'm', 'opt2') + cell('Δh', dh, 'm', 'opt');
    } else {
      ro.innerHTML = cell('Hz', hz, au, warn) + cell(`V (${r.face})`, v, au, warn) + cell('SD', formatDist(distance), 'm') +
        cell('HD', formatDist(S.readout.hd), 'm', 'opt2') +
        cell('ΔH', S.readout.dh != null ? (S.readout.dh >= 0 ? '+' : '') + S.readout.dh.toFixed(3) : '--', 'm', 'opt');
    }
    drawBubble(st, r);
  } else if (st?.gnss) {
    const g = st.gnss, c = g.fix === 'RTK Fixed' ? 'var(--green)' : g.fix === 'RTK Float' ? 'var(--amber)' : 'var(--red)';
    pill.textContent = g.fix; pill.style.color = c; pill.style.borderColor = c; pill.classList.remove('hidden');
    ro.innerHTML = cell('N', g.N.toFixed(3), 'm') + cell('E', g.E.toFixed(3), 'm') + cell('H', g.H.toFixed(3), 'm', 'opt2') +
      cell('Přesnost', `${(g.hrms * 1000).toFixed(0)}/${(g.vrms * 1000).toFixed(0)}`, 'mm', 'opt');
    drawBubble(st, null);
  } else {
    pill.classList.add('hidden'); ro.innerHTML = '';
  }
}

function updateHint() {
  const st = S.setup, h = $('hint');
  let t = '';
  if (!st) t = 'Klepněte na „＋ Vybavení“ a postavte přístroj. Chodíte joystickem vlevo dole, rozhlížíte se tažením prstu.';
  else if (st.k && st.k.levelState() === 'out') t = 'Horizontace: točte šrouby A, B, C (tlačítka vpravo), dokud bublina nedojede do kroužku. Bublina jde ke šroubu, který zvedáte.';
  else if (st.k) t = 'Zamiřte na lať: hrubě tlačítky ⟲ ⟳ a ▲ ▼, jemně ustanovkami. Pak 👁 Okulár.';
  else if (st.rover) t = 'Výtyčku nakláníte šipkami vpravo nebo tažením. Sledujte kompenzaci náklonu.';
  h.textContent = t;
  h.classList.toggle('hidden', !t || S.telescope);
}

/** Krabicová libela – bublina v rámci pozorovatele (vpravo = vpravo, dolů = k vám). */
function drawBubble(st, r) {
  const c = $('bubble');
  if (!c) return;
  const g = c.getContext('2d'), W = c.width, R = W / 2 - 6;
  let off = [0, 0], tilt = 0;
  if (st.k) {
    const bw = st.rig.bubble.getWorldPosition(new THREE.Vector3());
    const rw = st.rig.bubble.parent.localToWorld(st.rig.rest.clone());
    off = viewerFrame(bw.sub(rw).divideScalar(st.k.c.vialRadius)); tilt = r.tilt;
  } else {
    const d = st.pole, h = Math.hypot(d[0], d[2]);
    tilt = Math.acos(clamp(d[1], -1, 1));
    const travel = Math.min(tilt / deg(1 / 3) * 2, 6) / 6;
    const v = h > 1e-9 ? new THREE.Vector3(-d[0] / h * travel, 0, -d[2] / h * travel).applyQuaternion(st.anchor.getWorldQuaternion(new THREE.Quaternion())) : new THREE.Vector3();
    off = viewerFrame(v);
  }
  g.clearRect(0, 0, W, W);
  const grad = g.createRadialGradient(W / 2, W / 2, 4, W / 2, W / 2, R);
  grad.addColorStop(0, '#c7eb73'); grad.addColorStop(1, '#6b9e33');
  g.fillStyle = grad; g.beginPath(); g.arc(W / 2, W / 2, R, 0, TAU); g.fill();
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.6)'; g.stroke();
  g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.75)'; g.beginPath(); g.arc(W / 2, W / 2, R * 0.34, 0, TAU); g.stroke();
  const travel = R - R * 0.27;
  const bx = W / 2 + clamp(off[0], -1, 1) * travel, by = W / 2 + clamp(off[1], -1, 1) * travel;
  const bg = g.createRadialGradient(bx - 6, by - 6, 2, bx, by, R * 0.26);
  bg.addColorStop(0, '#fff'); bg.addColorStop(1, 'rgba(235,235,235,.85)');
  g.fillStyle = bg; g.beginPath(); g.arc(bx, by, R * 0.26, 0, TAU); g.fill();
  const as = toArcsec(tilt);
  const tt = $('tiltText');
  if (tt) tt.innerHTML = `Sklon <b>${as >= 60 ? (as / 60).toFixed(1) + '′' : as.toFixed(0) + '″'}</b>` +
    (r ? `<br><span class="tiny">l ${formatSmall(r.l, S.unit)}<br>t ${formatSmall(r.t, S.unit)}</span>` : '');
}

function viewerFrame(v) {
  camera.getWorldDirection(_fwd); _fwd.y = 0;
  if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
  _fwd.normalize();
  _right.crossVectors(_fwd, UP);
  return [v.dot(_right), -v.dot(_fwd)];
}

// ---------------------------------------------------------------------------------------
// Pravý panel ovládání

/** Tlačítko, které při podržení opakuje akci a zrychluje. */
function hold(el, fn) {
  let timer = null, n = 0;
  const stop = () => { clearInterval(timer); timer = null; };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault(); el.setPointerCapture?.(e.pointerId);
    n = 0; fn(1); stop();
    timer = setInterval(() => { n++; fn(n < 8 ? 1 : n < 25 ? 2.5 : 6); }, 70);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => el.addEventListener(ev, stop));
}

function buildPanel() {
  const st = S.setup, p = $('panel');
  const has = !!(st && (st.k || st.rover));
  p.classList.toggle('hidden', !has);
  if (!has) { p.innerHTML = ''; return; }
  const b = (id, label, cls = '') => `<button data-a="${id}" class="${cls}">${label}</button>`;
  let html = `<div class="bubblebox"><canvas id="bubble" width="160" height="160"></canvas><div id="tiltText" class="small"></div></div>`;
  if (st.k) {
    const k = st.k, lvl = k.c.isLevel;
    html += `<div class="sec"><h4>1 · Horizontace (stavěcí šrouby)</h4><div class="screws">
      <span>A (vzadu)</span>${b('s0-', '↓')}${b('s0+', '↑')}
      <span>B (vlevo)</span>${b('s1-', '↓')}${b('s1+', '↑')}
      <span>C (vpravo)</span>${b('s2-', '↓')}${b('s2+', '↑')}</div></div>`;
    html += `<div class="sec"><h4>2 · Zamíření – hrubě</h4><div class="btnrow">${b('rotL', '⟲ doleva')}${b('rotR', 'doprava ⟳')}
      ${lvl ? '' : b('telU', '▲ nahoru') + b('telD', '▼ dolů')}</div></div>`;
    html += `<div class="sec"><h4>3 · Jemné ustanovky (táhněte)</h4>
      <div class="jog" data-jog="h"><span>◀ Hz ▶</span><canvas></canvas></div>
      ${lvl ? '' : '<div class="jog" data-jog="v"><span>◀ V ▶</span><canvas></canvas></div>'}</div>`;
    html += `<div class="btnrow">${b('eye', '👁 Okulár', 'primary')}${b('hz0', 'Hz = 0')}</div>`;
    html += `<div class="btnrow">${b('comp', '⚖︎ Kompenzátor', k.s.comp ? 'on' : '')}${lvl ? '' : b('hold', '⏸ Hz hold', k.s.hzHold ? 'on' : '')}</div>`;
    if (lvl) html += `<div class="btnrow">${b('bs', '↩︎ Vzad')}${b('fs', '↪︎ Vpřed')}</div>`;
    else {
      html += `<div class="btnrow">${b('classic', '⚙︎ Svěrky', k.c.classic ? 'on' : '')}${k.c.classic ? b('hclamp', k.s.hClamp ? '🔒 Hz' : '🔓 Hz', k.s.hClamp ? 'on' : '') : ''}</div>`;
      if (k.c.classic) html += `<div class="btnrow">${b('vclamp', k.s.vClamp ? '🔒 V' : '🔓 V', k.s.vClamp ? 'on' : '')}</div>`;
    }
  } else {
    html += `<div class="sec"><h4>Náklon výtyčky</h4><div class="btnrow three">
      <span></span>${b('pF', '▲')}<span></span>${b('pL', '◀')}${b('plumb', '⊥')}${b('pR', '▶')}<span></span>${b('pB', '▼')}<span></span></div></div>`;
    html += `<div class="btnrow">${b('tiltcomp', '🧭 Kompenzace', st.tiltComp ? 'on' : '')}</div>`;
  }
  html += `<div class="btnrow">${b('move', '📍 Přemístit sem')}${b('remove', '🗑 Odstranit')}</div>`;
  p.innerHTML = html;

  // Podržitelná tlačítka
  const K = (fn) => (m) => act((k) => fn(k, m));
  const holds = {
    'rotL': K((k, m) => k.rotateAlidade(gon(0.6) * m)), 'rotR': K((k, m) => k.rotateAlidade(-gon(0.6) * m)),
    'telU': K((k, m) => k.pitch(gon(0.3) * m)), 'telD': K((k, m) => k.pitch(-gon(0.3) * m)),
    'pF': (m) => tiltPole(0, -0.01 * m), 'pB': (m) => tiltPole(0, 0.01 * m), 'pL': (m) => tiltPole(-0.01 * m, 0), 'pR': (m) => tiltPole(0.01 * m, 0),
  };
  for (let i = 0; i < 3; i++) {
    holds[`s${i}+`] = K((k, m) => k.turnScrew(i, 0.1 * m));
    holds[`s${i}-`] = K((k, m) => k.turnScrew(i, -0.1 * m));
  }
  p.querySelectorAll('button[data-a]').forEach((el) => { const f = holds[el.dataset.a]; if (f) hold(el, f); });
  p.querySelectorAll('.jog').forEach(setupJog);
  requestAnimationFrame(() => p.querySelectorAll('.jog').forEach((j) => j._draw?.()));
}

$('panel').addEventListener('click', (e) => {
  const id = e.target.closest('button')?.dataset.a, st = S.setup;
  if (!id || !st) return;
  const k = st.k;
  switch (id) {
    case 'eye': openTelescope(); return;
    case 'hz0': act((kk) => kk.setHz(0)); toast('Hz nastaveno na 0'); return;
    case 'comp': k.s.comp = !k.s.comp; break;
    case 'hold': k.s.hzHold = !k.s.hzHold; break;
    case 'classic': k.c.classic = !k.c.classic; k.setHClamp(false); k.setVClamp(false); break;
    case 'hclamp': k.setHClamp(!k.s.hClamp); break;
    case 'vclamp': k.setVClamp(!k.s.vClamp); break;
    case 'bs': case 'fs': {
      const rd = S.readout?.rod?.reading;
      if (rd == null) { toast('Nejdřív zamiřte na lať', 'warn'); return; }
      st.log[id] = rd; if (id === 'bs') st.log.fs = null;
      toast(id === 'bs' ? `Záměra vzad ${rd.toFixed(4)} m` : `Záměra vpřed ${rd.toFixed(4)} m`, 'ok');
      return;
    }
    case 'tiltcomp': st.tiltComp = !st.tiltComp; break;
    case 'plumb': st.pole = [0, 1, 0]; st.rover.apply(st.pole); return;
    case 'move': S.selected = st.model; place(); return;
    case 'remove': world.remove(st.anchor); S.setup = null; S.readout = null; buildPanel(); updateHint(); return;
    default: return;
  }
  if (k) st.rig.apply(k);
  buildPanel();
});

/** Kolečko ustanovky: vodorovné tažení = otáčení knoflíku (60 px = 1 otáčka). */
function setupJog(el) {
  const cv = el.querySelector('canvas'), g = cv.getContext('2d');
  let phase = 0, last = null;
  el._draw = () => {
    cv.width = cv.clientWidth * 2; cv.height = cv.clientHeight * 2;
    g.clearRect(0, 0, cv.width, cv.height);
    for (let x = ((phase * 2) % 14 + 14) % 14; x < cv.width; x += 14) {
      const t = Math.abs(x - cv.width / 2) / (cv.width / 2);
      g.strokeStyle = `rgba(255,255,255,${0.6 * (1 - t * 0.8)})`; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, 8); g.lineTo(x, cv.height - 8); g.stroke();
    }
  };
  el.addEventListener('pointerdown', (e) => { last = e.clientX; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    if (last == null || !S.setup?.k) return;
    const d = e.clientX - last; last = e.clientX; phase += d; el._draw();
    const turns = d / 60, j = el.dataset.jog;
    act((k) => (j === 'h' ? k.turnH(turns) : j === 'v' ? k.turnV(-turns) : (k.turnFocus(turns), {})));
  });
  const end = () => { last = null; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
}

// ---------------------------------------------------------------------------------------
// Pohled dalekohledem

const telRenderer = new THREE.WebGLRenderer({ canvas: $('telScene'), antialias: true, alpha: true });
telRenderer.outputColorSpace = THREE.SRGBColorSpace;
telRenderer.toneMapping = THREE.ACESFilmicToneMapping;
const telCam = new THREE.PerspectiveCamera(1.5, 1, 0.5, 2000);
const telVideo = $('telVideo'), tvx = telVideo.getContext('2d');
const reticleCanvas = $('reticle'), rctx = reticleCanvas.getContext('2d');
document.querySelectorAll('#telescope .jog').forEach(setupJog);

function openTelescope() {
  if (!S.setup?.k) return;
  S.telescope = true;
  S.zoom = clamp(S.setup.model.spec.magnification, 10, 30);
  $('zoom').value = S.zoom; $('zoomText').textContent = `${S.zoom}×`;
  $('jogV').classList.toggle('hidden', S.setup.k.c.isLevel);
  $('telescope').classList.remove('hidden');
  updateHint();
  requestAnimationFrame(() => document.querySelectorAll('#telescope .jog').forEach((j) => j._draw()));
}
function closeTelescope() {
  S.telescope = false;
  $('telescope').classList.add('hidden');
  updateHint();
}

function fieldOfView() {
  const s = S.setup.model.spec;
  return deg(((s.fov ?? 72) / 60) * (s.magnification / S.zoom));
}

function renderTelescope() {
  const st = S.setup;
  if (!st?.k) { closeTelescope(); return; }
  const size = Math.round($('eyepiece').clientWidth * Math.min(devicePixelRatio, 2));
  if (!size) return;
  if (telRenderer.domElement.width !== size) {
    telRenderer.setSize(size, size, false);
    telVideo.width = telVideo.height = reticleCanvas.width = reticleCanvas.height = size;
  }
  const { origin, dir } = lineOfSight();
  const fov = fieldOfView();
  telCam.fov = toDeg(fov); telCam.updateProjectionMatrix();
  telCam.position.copy(origin);
  telCam.lookAt(origin.clone().add(dir));

  // AR: zvětšený výřez živé kamery, pokud záměra míří do jejího záběru; jinak virtuální krajina.
  let videoDrawn = false;
  const v = $('cam');
  if (S.mode === 'ar' && v.videoWidth) {
    const far = origin.clone().addScaledVector(dir, 100).project(camera);
    if (far.z < 1 && Math.abs(far.x) < 1 && Math.abs(far.y) < 1) {
      const sx = (far.x + 1) / 2 * innerWidth, sy = (1 - far.y) / 2 * innerHeight;
      const pxPerRad = innerHeight / 2 / Math.tan(deg(camera.fov) / 2);
      const s = Math.max(innerWidth / v.videoWidth, innerHeight / v.videoHeight);
      const vx = (sx + (v.videoWidth * s - innerWidth) / 2) / s, vy = (sy + (v.videoHeight * s - innerHeight) / 2) / s, vs = fov * pxPerRad / s;
      tvx.drawImage(v, vx - vs / 2, vy - vs / 2, vs, vs, 0, 0, size, size);
      videoDrawn = true;
    }
  }
  if (!videoDrawn) tvx.clearRect(0, 0, size, size);
  const prev = [scene.background, groundVisual.visible, scenery.visible];
  scene.background = videoDrawn ? null : sky;
  groundVisual.visible = !videoDrawn; scenery.visible = true;
  telRenderer.render(scene, telCam);
  [scene.background, groundVisual.visible, scenery.visible] = prev;

  // Rozostření obrazu (ne rysek) podle ostření.
  const blur = clamp(st.k.defocus(S.targetDist ?? 50) * 40, 0, 8);
  const f = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : '';
  telVideo.style.filter = f; $('telScene').style.filter = f;

  drawReticle(size, fov);
  const r = S.readout, lvl = st.model.kind === 'level';
  if (r) {
    const w = r.r.hz == null ? 'warn' : '';
    $('telReadout').innerHTML = cell('Hz', formatAngle(r.r.hz ?? r.r.mechHz, S.unit), '', w) +
      (lvl ? cell('Lať', formatDist(r.rod?.reading), 'm') : cell('V', formatAngle(r.r.v ?? r.r.mechV, S.unit), '', w)) +
      cell(lvl ? 'Dálka' : 'SD', formatDist(r.distance), 'm') +
      (r.rod ? cell('Horní / dolní', `${r.rod.upper.toFixed(3)}/${r.rod.lower.toFixed(3)}`) : cell('HD', formatDist(r.hd), 'm')) +
      cell('Cíl', r.source ?? '—') + cell('Ostření', st.k.s.focus.toFixed(1), 'm');
  }
  $('telSub').textContent = r?.r.state === 'out' && r.r.comp ? '⚠︎ Nezhorizontováno – přístroj neměří'
    : blur > 1 ? 'Obraz je rozostřený – použijte Ostření nebo AF' : `${S.zoom}× · ${videoDrawn ? 'živá kamera' : 'virtuální krajina'}`;
}

/** Nitkový kříž s dvojitými ryskami a dálkoměrnými ryskami ±1/200 rad (k = 100). */
function drawReticle(size, fov) {
  const g = rctx, c = size / 2, stadia = 0.005 * size / fov;
  const dpr = size / $('eyepiece').clientWidth;
  g.clearRect(0, 0, size, size);
  const line = (x1, y1, x2, y2, w = dpr) => {
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = w + 2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.9)'; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  };
  line(0, c, size, c); line(c, 0, c, size);
  const gap = 3.5 * dpr;
  line(c - gap, size * 0.08, c - gap, c - size * 0.18, dpr * 0.8); line(c + gap, size * 0.08, c + gap, c - size * 0.18, dpr * 0.8);
  line(c + size * 0.18, c - gap, size * 0.92, c - gap, dpr * 0.8); line(c + size * 0.18, c + gap, size * 0.92, c + gap, dpr * 0.8);
  if (stadia < size * 0.45) { line(c - size * 0.09, c - stadia, c + size * 0.09, c - stadia); line(c - size * 0.09, c + stadia, c + size * 0.09, c + stadia); }
}

$('telExit').addEventListener('click', closeTelescope);
$('zoom').addEventListener('input', (e) => { S.zoom = +e.target.value; $('zoomText').textContent = `${S.zoom}×`; });
$('afBtn').addEventListener('click', () => { act((k) => { k.setFocus(S.targetDist ?? 50); return {}; }); });

// ---------------------------------------------------------------------------------------
// Katalog (okno)

const ICON = { ts: '⌖', level: '═', gnss: '📡', tripod: '△', rod: '📏' };
function renderCatalog() {
  $('catSeg').innerHTML = CATEGORIES.map((c) => `<button data-cat="${c.id}" class="${c.id === S.cat ? 'on' : ''}">${c.icon} ${c.title}</button>`).join('');
  $('cards').innerHTML = CATALOG.filter((m) => m.cat === S.cat).map((m) => `
    <div class="card ${m.id === S.selected.id ? 'sel' : ''}" data-id="${m.id}">
      <div class="mk">${ICON[m.kind]} ${m.maker || 'Příslušenství'}${m.spec.magnification ? ` · ${m.spec.magnification}×` : ''}</div>
      <div class="nm">${m.name}</div><div class="tg">${m.tagline}</div>
    </div>`).join('');
  $('specs').innerHTML = `<b>${displayName(S.selected)}</b>` + specRows(S.selected).map(([a, b]) => `<div><span>${a}</span><span>${b}</span></div>`).join('');
  const k = S.selected.kind;
  $('placeBtn').textContent = k === 'rod' ? '📏 Postavit lať před sebe' : k === 'gnss' ? '📡 Postavit rover před sebe' : k === 'tripod' ? '△ Postavit stativ před sebe' : '⌖ Postavit přístroj před sebe';
}
function openCatalog() { renderCatalog(); $('catalog').classList.remove('hidden'); }
function closeCatalog() { $('catalog').classList.add('hidden'); }
$('catSeg').addEventListener('click', (e) => {
  const c = e.target.closest('button')?.dataset.cat; if (!c) return;
  S.cat = c; S.selected = CATALOG.find((m) => m.cat === c); renderCatalog();
});
$('cards').addEventListener('click', (e) => { const id = e.target.closest('.card')?.dataset.id; if (id) { S.selected = byId(id); renderCatalog(); } });
$('catalogBtn').addEventListener('click', openCatalog);
$('catalogClose').addEventListener('click', closeCatalog);
$('catalog').addEventListener('click', (e) => { if (e.target.id === 'catalog') closeCatalog(); });
$('placeBtn').addEventListener('click', place);
$('modeBtn').addEventListener('click', () => (S.mode === 'ar' ? setMode('3d') : startAR()));
$('handBtn').addEventListener('click', toggleHand);
$('unitBtn').addEventListener('click', () => {
  S.unit = S.unit === 'gon' ? 'dms' : S.unit === 'dms' ? 'deg' : 'gon';
  $('unitBtn').textContent = { gon: 'gon', dms: 'DMS', deg: '°' }[S.unit];
});

let toastTimer = null, lastToast = '';
function toast(text, kind = 'info') {
  if (text === lastToast && toastTimer) return;
  lastToast = text;
  const t = $('toast');
  t.textContent = text;
  t.style.color = kind === 'ok' ? 'var(--green)' : kind === 'warn' ? 'var(--amber)' : 'var(--text)';
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.add('hidden'); toastTimer = null; lastToast = ''; }, 2600);
}

// ---------------------------------------------------------------------------------------
// Start a smyčka

function begin(ar) {
  $('start').classList.add('hidden');
  ['topbar', 'joy'].forEach((id) => $(id).classList.remove('hidden'));
  if (ar) startAR(); else setMode('3d');
  openCatalog();
}
// AR: žádost o gyroskop musí proběhnout přímo v obsluze klepnutí (startAR ji volá jako první).
$('startAR').addEventListener('click', () => begin(true));
$('start3D').addEventListener('click', () => begin(false));

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  updateFov();
}
addEventListener('resize', resize);
resize();

let last = performance.now(), lastMeasure = 0, lastHud = 0, lastLevel = null;
renderer.setAnimationLoop((tMs) => {
  const now = tMs / 1000, dt = Math.min(0.1, (tMs - last) / 1000);
  last = tMs;
  updatePlayer(dt);
  const st = S.setup;
  if (st?.k && now - lastMeasure > 1 / 12) {
    lastMeasure = now; measure();
    const ls = st.k.levelState();
    if (ls !== lastLevel) { lastLevel = ls; updateHint(); }
  }
  if (st?.rover) updateGNSS(now);
  if (now - lastHud > 0.1) { lastHud = now; updateTopbar(); }
  if (S.telescope) renderTelescope();
  else renderer.render(scene, camera);
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').then((r) => r.update()).catch(() => {});
}

window.__geoar = { S, THREE, scene, camera, place, openTelescope, act };
