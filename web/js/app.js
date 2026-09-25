// GeoAR Pro – webová verze (PWA).
// Scéna Three.js nad videem zadní kamery, orientace z gyroskopu (3DoF), ovládání
// dotykem nebo rukou (MediaPipe), mechanika přístroje, dálkoměr a pohled dalekohledem.

import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { CATALOG, CATEGORIES, byId, displayName, specRows } from './catalog.js';
import { Kinematics, makeConfig } from './kinematics.js';
import { makeTotalStation, makeLevel, makeTripod, makeRover, makeRod, makePrism, makeReticle, drawLCD, drawTablet } from './models.js';
import { HandTracker } from './hands.js';
import { TAU, gon, deg, toDeg, toArcsec, norm, wrapPi, clamp, azimuth, zenith, formatAngle, formatSmall, formatDist, gauss } from './geodesy.js';

const $ = (id) => document.getElementById(id);
const EYE = 1.45;          // výška kamery (telefonu) nad zemí v AR režimu
const TRIPOD_H = 1.25;

// ---------------------------------------------------------------------------------------
// Stav

const S = {
  mode: '3d', unit: 'gon', selected: CATALOG[0], cat: 'ts',
  placing: false, drawerOpen: false, drawerMini: false,
  setup: null,           // { model, anchor, rig, tripod, k } | { model, anchor, rover, pole, sim }
  rods: [], hand: false, handState: null,
  telescope: false, zoom: 30,
  readout: null, targetDist: null,
  orbit: { yaw: 0.6, pitch: 0.25, dist: 3.2, target: new THREE.Vector3(0, 1.2, 0) },
  orient: null, orientOffset: 0,
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
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.02, 500);
camera.position.set(0, EYE, 0);

scene.add(new THREE.HemisphereLight(0xdfefff, 0x5a4a38, 0.7));
const sun = new THREE.DirectionalLight(0xfff4e6, 2.2);
sun.position.set(4, 9, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 30 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

// Svět (obsah, který lze v AR „obejít“ – otáčí se kolem stanoviska).
const world = new THREE.Group();
scene.add(world);

// Země: stín pro AR, travnatá plocha a obloha pro 3D režim.
const grassTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#4f7a3a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) { g.fillStyle = `hsla(${90 + Math.random() * 30},45%,${25 + Math.random() * 20}%,0.6)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(200, 200); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
})();
const groundVisual = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
groundVisual.rotation.x = -Math.PI / 2; groundVisual.receiveShadow = true;
world.add(groundVisual);
const groundShadow = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.35 }));
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

// Budovy v dálce jako cíle pro 3D režim.
const scenery = new THREE.Group();
world.add(scenery);

const reticle = makeReticle();
reticle.visible = false;
world.add(reticle);

// ---------------------------------------------------------------------------------------
// Režimy AR / 3D

async function startAR() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    $('cam').srcObject = stream;
    await $('cam').play().catch(() => {});
  } catch (e) {
    toast('Kamera není k dispozici – přepínám do 3D', 'warn');
    return setMode('3d');
  }
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try { await DeviceOrientationEvent.requestPermission(); } catch { /* bez gyroskopu */ }
  }
  addEventListener('deviceorientation', onOrientation);
  setMode('ar');
}

function onOrientation(e) {
  if (e.alpha == null) return;
  S.orient = { alpha: deg(e.alpha), beta: deg(e.beta), gamma: deg(e.gamma) };
}

function setMode(mode) {
  S.mode = mode;
  const ar = mode === 'ar';
  $('cam').classList.toggle('hidden', !ar);
  scene.background = ar ? null : sky;
  groundVisual.visible = !ar;
  scenery.visible = !ar;
  groundShadow.material.opacity = ar ? 0.35 : 0.0;
  $('walk').classList.toggle('hidden', !ar || !S.setup);
  document.querySelectorAll('#modeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  $('handBtn').classList.toggle('hidden', !ar);
  if (!ar && S.hand) toggleHand();
  updateFov();
}

// Orientace zařízení → kvaternion kamery (algoritmus DeviceOrientationControls).
const _euler = new THREE.Euler(), _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const _zee = new THREE.Vector3(0, 0, 1);
function deviceQuaternion(o) {
  const screenAngle = deg(screen.orientation?.angle ?? window.orientation ?? 0);
  const q = new THREE.Quaternion();
  _euler.set(o.beta, o.alpha, -o.gamma, 'YXZ');
  q.setFromEuler(_euler);
  q.multiply(_q1);                                   // kamera se dívá ze zadní strany telefonu
  q.multiply(_q0.setFromAxisAngle(_zee, -screenAngle));
  return q;
}

function updateCamera() {
  if (S.mode === 'ar') {
    camera.position.set(0, EYE, 0);
    if (S.orient) camera.quaternion.copy(deviceQuaternion(S.orient));
  } else {
    const o = S.orbit;
    const cp = Math.cos(o.pitch);
    camera.position.set(o.target.x + o.dist * cp * Math.sin(o.yaw), o.target.y + o.dist * Math.sin(o.pitch), o.target.z + o.dist * cp * Math.cos(o.yaw));
    camera.lookAt(o.target);
  }
}

// ---------------------------------------------------------------------------------------
// Umísťování

function forwardGroundPoint(distance) {
  const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0;
  if (f.lengthSq() < 1e-6) f.set(0, 0, -1);
  f.normalize();
  const p = camera.position.clone().addScaledVector(f, distance); p.y = 0;
  return world.worldToLocal(p);
}

function beginPlacement() {
  if (S.mode === '3d') { place(); return; }
  S.placing = true;
  reticle.visible = true;
  show('placeBar', true); show('drawer', false);
}

function updatePlacementPreview() {
  if (!S.placing) return;
  // Průsečík osy pohledu se zemí (omezeno na 1–8 m).
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  let dist = 2.2;
  if (dir.y < -0.05) dist = clamp(EYE / -dir.y * Math.hypot(dir.x, dir.z), 1, 8);
  reticle.position.copy(forwardGroundPoint(dist));
  $('placeText').textContent = `Postavit ${dist.toFixed(1)} m před vás – namiřte na zem`;
}

function place() {
  const m = S.selected;
  const dist = S.placing ? null : (m.kind === 'rod' ? 4 : m.kind === 'gnss' ? 1.8 : 2.4);
  const p = dist ? forwardGroundPoint(dist) : reticle.position.clone();
  S.placing = false; reticle.visible = false; show('placeBar', false); show('drawer', true);
  const camLocal = world.worldToLocal(camera.position.clone());
  const yaw = Math.atan2(camLocal.x - p.x, camLocal.z - p.z); // záda přístroje (+Z) k uživateli

  if (m.kind === 'rod') {
    const rod = makeRod(m.spec.length);
    rod.root.position.copy(p); rod.root.rotation.y = yaw;
    world.add(rod.root); S.rods.push(rod);
    if (S.rods.length > 4) world.remove(S.rods.shift().root);
    toast('Lať postavena');
    return;
  }

  removeSetup();
  const anchor = new THREE.Group();
  anchor.position.copy(p); anchor.rotation.y = yaw;
  world.add(anchor);
  const setup = { model: m, anchor };

  if (m.kind === 'ts' || m.kind === 'level') {
    const tripod = makeTripod(TRIPOD_H);
    const rig = m.kind === 'ts' ? makeTotalStation(m) : makeLevel(m);
    const k = new Kinematics(makeConfig(m));
    k.s.setupTilt = Kinematics.randomSetupTilt();
    tripod.apply(k.s.setupTilt);
    rig.root.position.y = TRIPOD_H;
    anchor.add(tripod.root, rig.root);
    rig.apply(k);
    Object.assign(setup, { tripod, rig, k, log: {} });
    toast(m.kind === 'ts' ? 'Zhorizontujte přístroj stavěcími šrouby' : 'Urovnejte krabicovou libelu stavěcími šrouby');
  } else if (m.kind === 'tripod') {
    const tripod = makeTripod(TRIPOD_H);
    tripod.apply(Kinematics.randomSetupTilt());
    anchor.add(tripod.root);
    setup.tripod = tripod;
  } else if (m.kind === 'gnss') {
    const rover = makeRover(m);
    anchor.add(rover.root);
    Object.assign(setup, { rover, pole: [0, 1, 0], sim: { t: 0, last: 0, sats: 26, fixToastDone: false }, tiltComp: true });
    toast('Hledám družice…');
  }
  S.setup = setup;
  buildTargets(anchor);
  aimAtNearestRod(setup);
  S.drawerMini = true; S.drawerOpen = false; renderCatalog();
  if (S.mode === '3d') { S.orbit.target.copy(anchor.position).setY(m.kind === 'gnss' ? 1.1 : 1.3); S.orbit.dist = m.kind === 'gnss' ? 3.2 : 1.6; }
  $('walk').classList.toggle('hidden', S.mode !== 'ar');
  refreshControls();
}

/** Natočí alhidádu přibližně (±2°) na nejbližší vzdálenou lať – ať je hned co měřit. */
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

function removeSetup() {
  if (S.setup) world.remove(S.setup.anchor);
  S.setup = null;
  S.readout = null;
  refreshControls();
}

/** Pole cílů kolem stanoviska: latě, hranol a budovy (pro 3D). */
let targetsBuilt = false;
function buildTargets(anchor) {
  if (targetsBuilt) return;
  targetsBuilt = true;
  const at = (dx, dz) => new THREE.Vector3(dx, 0, dz).applyAxisAngle(new THREE.Vector3(0, 1, 0), anchor.rotation.y).add(anchor.position);
  const addRod = (dx, dz) => {
    const r = makeRod(3); const p = at(dx, dz);
    r.root.position.copy(p); r.root.lookAt(anchor.position.x, 0, anchor.position.z);
    world.add(r.root); S.rods.push(r);
  };
  addRod(0.4, -18); addRod(-9, -34);
  const prism = makePrism(); prism.root.position.copy(at(12, -45)); prism.root.lookAt(anchor.position.x, 0, anchor.position.z);
  world.add(prism.root);
  const bMat = [0xd8cfc0, 0xbfc7cf, 0xc9b59a, 0xe6e1d6].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
  const winMat = new THREE.MeshStandardMaterial({ color: 0x2a3848, roughness: 0.2, metalness: 0.5 });
  for (let i = 0; i < 9; i++) {
    const a = -1.2 + i * 0.3, r = 70 + (i % 3) * 25;
    const w = 10 + (i % 4) * 4, h = 8 + ((i * 7) % 5) * 5, d = 10;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bMat[i % 4]);
    b.position.copy(at(Math.sin(a) * r, -Math.cos(a) * r)).setY(h / 2);
    b.lookAt(anchor.position.x, h / 2, anchor.position.z);
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
// Interakce (dotyk i ruka sdílejí stejné zpracování ukazatele)

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const PRIORITY = { hDrive: 4, vDrive: 4, focus: 4, screw0: 3, screw1: 3, screw2: 3, telescope: 2, alidade: 1, pole: 1, tripod: 0 };
let grab = null; // { kind, lastX, lastY, lastAngle, lastRoll, grabDist }

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
    if (!best || p > best.p) best = { kind: h.object.userData.part, p, dist: h.distance, point: h.point };
  }
  return best;
}

function pointerDown(x, y, roll = null) {
  const hit = pick(x, y);
  if (hit && hit.kind !== 'tripod') {
    grab = { kind: hit.kind, lastX: x, lastY: y, lastAngle: null, lastRoll: roll, grabDist: hit.dist };
    grabMove(x, y, roll, true);
    setSub(`Ovládáte: ${PART_NAMES[hit.kind]}`);
    return true;
  }
  grab = { kind: 'orbit', lastX: x, lastY: y };
  return false;
}

function pointerMove(x, y, roll = null) {
  if (!grab) return;
  if (grab.kind === 'orbit') {
    if (S.mode === '3d') {
      S.orbit.yaw -= (x - grab.lastX) * 0.006;
      S.orbit.pitch = clamp(S.orbit.pitch + (y - grab.lastY) * 0.004, -0.2, 1.3);
    }
    grab.lastX = x; grab.lastY = y;
    return;
  }
  grabMove(x, y, roll, false);
}

function pointerUp() {
  if (grab && grab.kind !== 'orbit') setSub(null);
  grab = null;
}

const PART_NAMES = { alidade: 'alhidáda', telescope: 'dalekohled', hDrive: 'Hz ustanovka', vDrive: 'V ustanovka', focus: 'ostření',
  screw0: 'stavěcí šroub A', screw1: 'stavěcí šroub B', screw2: 'stavěcí šroub C', pole: 'výtyčka', tripod: 'stativ' };

/** Úhel průsečíku paprsku s rovinou ⟂ osa kolem středu, měřený od referenčního směru (pravotočivě). */
function angleAround(ray, axis, center, ref) {
  const denom = ray.direction.dot(axis);
  if (Math.abs(denom) < 0.18) return null;
  const t = center.clone().sub(ray.origin).dot(axis) / denom;
  if (t <= 0) return null;
  const d = ray.origin.clone().addScaledVector(ray.direction, t).sub(center);
  d.addScaledVector(axis, -d.dot(axis));
  if (d.length() < 0.015) return null;
  const r = ref.clone().addScaledVector(axis, -ref.dot(axis)).normalize();
  const s = new THREE.Vector3().crossVectors(axis, r);
  return Math.atan2(d.dot(s), d.dot(r));
}

function grabMove(x, y, roll, first) {
  const g = grab, st = S.setup;
  const dx = x - g.lastX, dy = y - g.lastY;
  g.lastX = x; g.lastY = y;
  if (!st) return;
  const ray = rayAt(x, y);

  if (st.rover) {
    if (g.kind !== 'pole') return;
    // Svislá rovina přes patu výtyčky kolmá k pohledu.
    const tip = st.anchor.localToWorld(new THREE.Vector3());
    const n = new THREE.Vector3(); camera.getWorldDirection(n); n.y = 0; n.normalize();
    const denom = ray.direction.dot(n);
    if (Math.abs(denom) < 1e-3) return;
    const t = tip.clone().sub(ray.origin).dot(n) / denom;
    const P = ray.origin.clone().addScaledVector(ray.direction, t);
    const local = st.anchor.worldToLocal(P);
    let d = local.clone(); if (d.y < 0.05) d.y = 0.05; d.normalize();
    const maxT = deg(35), tilt = Math.acos(clamp(d.y, -1, 1));
    if (tilt > maxT) { const h = new THREE.Vector3(d.x, 0, d.z).normalize(); d = h.multiplyScalar(Math.sin(maxT)).setY(Math.cos(maxT)); }
    if (!first) { st.pole = d.toArray(); st.rover.apply(st.pole); }
    return;
  }
  if (!st.k) return;
  const k = st.k, rig = st.rig;
  let fb = {};
  const knobTurns = () => {
    // Stavěcí šrouby: 1 otáčka na 50 px, ustanovky a ostření: 1 otáčka na 140 px.
    let t = -dy / (g.kind.startsWith('screw') ? 50 : 140);
    if (roll != null && g.lastRoll != null) t += wrapPi(roll - g.lastRoll) / TAU;
    g.lastRoll = roll;
    return first ? 0 : t;
  };
  switch (g.kind) {
    case 'alidade': {
      const c = rig.alidade.getWorldPosition(new THREE.Vector3());
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(rig.leveling.getWorldQuaternion(new THREE.Quaternion()));
      const ref = new THREE.Vector3(0, 0, -1).applyQuaternion(rig.leveling.getWorldQuaternion(new THREE.Quaternion()));
      const a = angleAround(ray, axis, c, ref);
      if (a != null) { if (g.lastAngle != null) fb = k.rotateAlidade(wrapPi(a - g.lastAngle)); g.lastAngle = a; }
      else if (!first) fb = k.rotateAlidade(dx * 0.006);
      break;
    }
    case 'telescope': {
      const T = rig.telescope;
      const c = T.getWorldPosition(new THREE.Vector3());
      const q = rig.alidade.getWorldQuaternion(new THREE.Quaternion());
      const a = angleAround(ray, new THREE.Vector3(1, 0, 0).applyQuaternion(q), c, new THREE.Vector3(0, 0, -1).applyQuaternion(q));
      if (a != null) { if (g.lastAngle != null) fb = k.pitch(wrapPi(a - g.lastAngle)); g.lastAngle = a; }
      else if (!first) fb = k.pitch(-dy * 0.004);
      break;
    }
    case 'hDrive': fb = k.turnH(knobTurns()); break;
    case 'vDrive': fb = k.turnV(knobTurns()); break;
    case 'focus': k.turnFocus(knobTurns()); break;
    case 'screw0': case 'screw1': case 'screw2': fb = k.turnScrew(+g.kind.slice(-1), knobTurns()); break;
  }
  rig.apply(k);
  feedback(fb);
}

function feedback(fb) {
  if (!fb) return;
  if (fb.ticks) navigator.vibrate?.(4);
  if (fb.blocked) toast('Svěrka je utažená – použijte ustanovku', 'warn');
  if (fb.released) toast('Nejdřív utáhněte svěrku', 'warn');
  if (fb.limit) toast('Konec chodu šroubu', 'warn');
  if (fb.level === 'leveled') toast('Přístroj je zhorizontován ✓', 'ok');
}

// Dotykové události (jeden prst ovládá, dva prsty v 3D přibližují).
const touches = new Map();
let pinchStart = null;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (S.placing) { place(); return; }
  if (touches.size === 1 && !(S.hand && S.handState)) pointerDown(e.clientX, e.clientY);
  if (touches.size === 2) {
    pointerUp();
    const [a, b] = [...touches.values()];
    pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: S.orbit.dist };
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!touches.has(e.pointerId)) return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2 && pinchStart) {
    const [a, b] = [...touches.values()];
    S.orbit.dist = clamp(pinchStart.dist * pinchStart.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 0.6, 60);
  } else if (touches.size === 1) pointerMove(e.clientX, e.clientY);
});
const up = (e) => { touches.delete(e.pointerId); if (touches.size < 2) pinchStart = null; if (touches.size === 0) pointerUp(); };
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => { S.orbit.dist = clamp(S.orbit.dist * Math.exp(e.deltaY * 0.001), 0.6, 60); }, { passive: true });

// Ruka
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
    try { await tracker.start(); toast('Sevřete palec a ukazováček nad ovladačem ✋', 'ok'); }
    catch (e) { S.hand = false; $('handBtn').classList.remove('on'); toast('Sledování ruky se nepodařilo spustit', 'warn'); }
  } else tracker.stop();
}
function drawHand() {
  const dpr = devicePixelRatio;
  if (handLayer.width !== innerWidth * dpr) { handLayer.width = innerWidth * dpr; handLayer.height = innerHeight * dpr; }
  hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  hctx.clearRect(0, 0, innerWidth, innerHeight);
  const h = S.handState;
  if (!S.hand || !h) return;
  const hover = !h.pinching && pick(h.x, h.y);
  const col = h.pinching ? '#5ceb8c' : hover ? '#40dbff' : '#fff';
  hctx.strokeStyle = col; hctx.fillStyle = col; hctx.lineWidth = h.pinching ? 4 : 2;
  hctx.beginPath(); hctx.arc(h.x, h.y, 14, 0, TAU); hctx.stroke();
  hctx.beginPath(); hctx.arc(h.x, h.y, 4, 0, TAU); hctx.fill();
  hctx.setLineDash(h.pinching ? [] : [4, 4]); hctx.lineWidth = 2;
  hctx.beginPath(); hctx.moveTo(h.thumb.x, h.thumb.y); hctx.lineTo(h.x, h.y); hctx.stroke(); hctx.setLineDash([]);
  const label = grab && grab.kind !== 'orbit' ? PART_NAMES[grab.kind] : hover ? PART_NAMES[hover.kind] : null;
  hctx.font = '600 12px -apple-system, sans-serif';
  if (label) { hctx.fillText(label, h.x + 18, h.y - 14); }
  hctx.fillStyle = 'rgba(255,255,255,.7)'; hctx.fillText(`sevření ${(h.pinch * 100).toFixed(1)} cm`, h.x + 18, h.y + 22);
}

// Obejití stanoviska v AR (otočení / posun světa kolem stanoviska).
function walk(dir) {
  if (!S.setup) return;
  const P = S.setup.anchor.getWorldPosition(new THREE.Vector3());
  const m = new THREE.Matrix4();
  if (dir === 'left' || dir === 'right') {
    const a = dir === 'left' ? -Math.PI / 6 : Math.PI / 6;
    m.makeTranslation(P.x, 0, P.z).multiply(new THREE.Matrix4().makeRotationY(a)).multiply(new THREE.Matrix4().makeTranslation(-P.x, 0, -P.z));
  } else {
    const f = P.clone().setY(0).normalize().multiplyScalar(dir === 'near' ? -0.4 : 0.4);
    m.makeTranslation(f.x, 0, f.z);
  }
  world.applyMatrix4(m);
}

// ---------------------------------------------------------------------------------------
// Měření (dálkoměr, lať, GNSS)

function lineOfSight() {
  const st = S.setup;
  const los = st.k.losMeasurement();
  const q = st.anchor.getWorldQuaternion(new THREE.Quaternion());
  const dir = new THREE.Vector3(...los).applyQuaternion(q).normalize();
  const origin = st.rig.objective.getWorldPosition(new THREE.Vector3());
  const center = (st.rig.telescope ?? st.rig.alidade).getWorldPosition(new THREE.Vector3());
  if (!st.rig.telescope) center.copy(st.rig.objective.getWorldPosition(new THREE.Vector3())).addScaledVector(dir, 0.125);
  return { origin, dir, center };
}

const measureRay = new THREE.Raycaster();
function measure() {
  const st = S.setup;
  if (!st?.k) return;
  const k = st.k, m = st.model;
  const { origin, dir, center } = lineOfSight();
  measureRay.set(origin, dir);
  measureRay.far = m.kind === 'ts' ? 300 : 150;
  const objs = [...S.rods.map((r) => r.root), ...world.children.filter((o) => o.name === 'Hranol'), groundShadow];
  if (S.mode === '3d' || S.telescope) objs.push(scenery);
  const hits = measureRay.intersectObjects(objs, true).filter((h) => h.object.visible !== false || h.object === groundShadow);
  const hit = hits[0];
  let distance = null, rod = null, source = null;
  S.targetDist = null;
  if (hit) {
    const slope = center.distanceTo(hit.point);
    S.targetDist = slope;
    const target = hit.object.userData.target;
    source = target === 'rod' ? 'lať' : target === 'prism' ? 'hranol' : target === 'building' ? 'budova' : 'terén';
    const outBlocked = k.s.comp && k.levelState() === 'out';
    if (m.kind === 'ts' && !outBlocked) {
      const sigma = (m.spec.edmA + m.spec.edmB * slope / 1000) / 1000;
      distance = slope + gauss() * sigma;
    }
    if (target === 'rod') {
      const root = hit.object.userData.rodRoot;
      const reading = root.worldToLocal(hit.point.clone()).y;
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
    hi: TRIPOD_H + st.rig.opticalHeight,
  };
  if (st.rig.lcd) {
    const u = S.unit === 'gon' ? ' g' : '';
    drawLCD(st.rig.lcd, m.name, k.s.comp ? 'COMP ▮▮▮' : 'comp off', [
      ['Hz', formatAngle(r.hz, S.unit) + u], ['V', formatAngle(r.v, S.unit) + u], ['SD', formatDist(distance) + ' m'],
    ], k.s.comp && r.state === 'out' ? 'TILT!' : null);
  }
}

function updateGNSS(now) {
  const st = S.setup;
  if (!st?.rover) return;
  const s = st.model.spec, sim = st.sim;
  st.rover.leds.forEach((led, i) => {
    const fix = st.gnss?.fix ?? 'none';
    const on = i === 0 ? true : i === 1 ? fix !== 'none' && Math.floor(now * 2) % 2 === 0
      : i === 2 ? fix === 'RTK Fixed' || (fix === 'RTK Float' && Math.floor(now * 4) % 2 === 0) : Math.floor(now * 1.5) % 3 !== 0;
    led.material.emissiveIntensity = on ? 3 : 0;
  });
  if (now - sim.last < 1) return;
  const dt = sim.last ? now - sim.last : 1; sim.last = now; sim.t += dt;
  const [fix, hrms, vrms] = sim.t < 2 ? ['Autonomní', 1.2, 2.1] : sim.t < 6 ? ['RTK Float', 0.18, 0.32] : ['RTK Fixed', s.rtkH / 1000, s.rtkV / 1000];
  sim.sats = clamp(sim.sats + Math.round(Math.random() * 2 - 1), 18, 34);
  const tilt = Math.acos(clamp(st.pole[1], -1, 1));
  const tipW = st.anchor.getWorldPosition(new THREE.Vector3());
  const antW = st.anchor.localToWorld(new THREE.Vector3(...st.pole).multiplyScalar(st.rover.antennaH));
  const comp = st.tiltComp && toDeg(tilt) <= s.tiltMax;
  const P = comp ? tipW : antW.clone().setY(antW.y - s.pole);
  const h = hrms + (comp ? s.tiltErr * toDeg(tilt) / 1000 : 0);
  // Místní souřadnice: E = +X, N = −Z, H = +Y (+ nepravý počátek).
  st.gnss = {
    fix, sats: sim.sats, pdop: 1.1 + Math.random() * 0.5 + (34 - sim.sats) * 0.03, hrms: h, vrms, tilt, comp,
    N: 5000 - P.z + gauss() * h / Math.SQRT2, E: 1000 + P.x + gauss() * h / Math.SQRT2, H: 250 + P.y + gauss() * vrms,
  };
  if (fix === 'RTK Fixed' && !sim.fixToastDone) { sim.fixToastDone = true; toast('RTK Fixed ✓', 'ok'); }
  drawTablet(st.rover.tablet, `${st.model.name} · Měření`, fix, [
    ['N', st.gnss.N.toFixed(3) + ' m'], ['E', st.gnss.E.toFixed(3) + ' m'], ['H', st.gnss.H.toFixed(3) + ' m'],
    ['Družice / PDOP', `${sim.sats} / ${st.gnss.pdop.toFixed(1)}`],
  ]);
}

// ---------------------------------------------------------------------------------------
// HUD

function cell(label, value, unit = '', big = false) {
  return `<div class="cell${big ? ' big' : ''}"><div class="l">${label}</div><div class="v">${value}<small class="tiny"> ${unit}</small></div></div>`;
}

const STATE_TEXT = { leveled: ['Zhorizontováno', 'var(--green)'], compensated: ['Kompenzováno', 'var(--amber)'], out: ['Mimo rozsah', 'var(--red)'] };

function updateHUD() {
  const st = S.setup;
  $('hudTitle').textContent = st ? displayName(st.model) : 'GeoAR Pro';
  const pill = $('statusPill'), ro = $('readout');
  const au = S.unit === 'gon' ? 'gon' : '';
  if (st?.k && S.readout) {
    const { r, distance, rod } = S.readout;
    const [t, c] = STATE_TEXT[r.state];
    pill.textContent = t; pill.style.color = c; pill.style.borderColor = c; pill.classList.remove('hidden');
    const lvl = st.model.kind === 'level';
    ro.innerHTML =
      cell('Hz', formatAngle(r.hz, S.unit), au, true) +
      (lvl ? cell('Čtení na lati', formatDist(rod?.reading), 'm', true) : cell(`V (${r.face})`, formatAngle(r.v, S.unit), au, true)) +
      (lvl ? cell('Δh (Z − P)', st.log.bs != null && st.log.fs != null ? (st.log.bs - st.log.fs).toFixed(4) : '--', 'm') : cell('SD', formatDist(distance), 'm')) +
      (lvl ? cell('Dálka (rysky)', formatDist(distance), 'm') : cell('HD', formatDist(S.readout.hd), 'm')) +
      (lvl ? cell('Vzad', formatDist(st.log.bs), 'm') : cell('ΔH', S.readout.dh != null ? (S.readout.dh >= 0 ? '+' : '') + S.readout.dh.toFixed(3) : '--', 'm')) +
      (lvl ? cell('Vpřed', formatDist(st.log.fs), 'm') : cell('Cíl', S.readout.source ?? '—'));
    ro.classList.remove('hidden');
    drawBubble(st, r);
  } else if (st?.gnss) {
    const g = st.gnss;
    const c = g.fix === 'RTK Fixed' ? 'var(--green)' : g.fix === 'RTK Float' ? 'var(--amber)' : 'var(--red)';
    pill.textContent = g.fix; pill.style.color = c; pill.style.borderColor = c; pill.classList.remove('hidden');
    ro.innerHTML = cell('N', g.N.toFixed(3), 'm', true) + cell('E', g.E.toFixed(3), 'm', true) + cell('H', g.H.toFixed(3), 'm', true) +
      cell('HRMS/VRMS', `${(g.hrms * 1000).toFixed(0)}/${(g.vrms * 1000).toFixed(0)}`, 'mm') + cell('Družice', `${g.sats}`) +
      cell('Náklon', `${toDeg(g.tilt).toFixed(1)}°`, g.comp ? 'komp.' : '!');
    ro.classList.remove('hidden');
    drawBubble(st, null);
  } else {
    pill.classList.add('hidden'); ro.classList.add('hidden');
  }
  $('levelBox').classList.toggle('hidden', !(st?.k || st?.rover));
  const top = $('hud').getBoundingClientRect().bottom + 10;
  if (!landscape.matches) { $('controls').style.top = `${top}px`; $('levelBox').style.top = `${top}px`; }
  else { $('controls').style.top = ''; $('levelBox').style.top = ''; }
  if (!subOverride) $('hudSub').textContent = subtitle();
}

let subOverride = null;
function setSub(t) { subOverride = t; $('hudSub').textContent = t ?? subtitle(); }
function subtitle() {
  const st = S.setup;
  if (!st) return S.mode === 'ar' ? 'Vyberte vybavení dole a umístěte ho před sebe' : 'Vyberte vybavení a umístěte ho';
  if (st.rover) return 'Táhněte výtyčku pro naklonění · sledujte kompenzaci náklonu';
  if (st.k?.levelState() === 'out') return 'Otáčejte stavěcími šrouby (táhněte po nich nahoru/dolů), dokud se bublina nevycentruje';
  return S.hand ? 'Sevřete prsty nad dílem a pohybujte rukou' : 'Táhněte tělo / dalekohled · táhněte po šroubech a ustanovkách';
}

/** Krabicová libela v HUD – bublina v rámci pozorovatele (vpravo = vpravo, dolů = k vám). */
function drawBubble(st, r) {
  const c = $('bubble'), g = c.getContext('2d'), W = c.width, R = W / 2 - 6;
  let off = [0, 0], tilt = 0;
  if (st.k) {
    const bw = st.rig.bubble.getWorldPosition(new THREE.Vector3());
    const rw = st.rig.bubble.parent.localToWorld(st.rig.rest.clone());
    const v = bw.sub(rw).divideScalar(st.k.c.vialRadius);
    off = viewerFrame(v); tilt = r.tilt;
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
  g.setLineDash([6, 6]); g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(W / 2, W / 2, R * 0.62, 0, TAU); g.stroke(); g.setLineDash([]);
  const travel = R - R * 0.27;
  const bx = W / 2 + clamp(off[0], -1, 1) * travel, by = W / 2 + clamp(off[1], -1, 1) * travel;
  const bg = g.createRadialGradient(bx - 6, by - 6, 2, bx, by, R * 0.26);
  bg.addColorStop(0, '#fff'); bg.addColorStop(1, 'rgba(235,235,235,.85)');
  g.fillStyle = bg; g.beginPath(); g.arc(bx, by, R * 0.26, 0, TAU); g.fill();
  const as = toArcsec(tilt);
  $('tiltText').textContent = as >= 60 ? `${(as / 60).toFixed(1)}′` : `${as.toFixed(0)}″`;
  $('ltText').innerHTML = r ? `l ${formatSmall(r.l, S.unit)}<br>t ${formatSmall(r.t, S.unit)}` : '';
}

function viewerFrame(v) {
  const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0;
  if (f.lengthSq() < 1e-6) f.set(0, 0, -1);
  f.normalize();
  const right = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0));
  return [v.dot(right), -v.dot(f)];
}

/** Boční panel ovládání přístroje. */
function refreshControls() {
  const st = S.setup, p = $('clampPanel');
  $('controls').classList.toggle('hidden', !st || !(st.k || st.rover));
  if (!st) { p.innerHTML = ''; return; }
  const b = (id, label, on) => `<button data-ctl="${id}" class="${on ? 'on' : ''}">${label}</button>`;
  let html = '';
  if (st.k) {
    const k = st.k;
    if (!k.c.isLevel) {
      html += b('classic', '⚙︎ Klasické svěrky', k.c.classic);
      if (k.c.classic) html += b('hclamp', (k.s.hClamp ? '🔒' : '🔓') + ' Hz svěrka', k.s.hClamp) + b('vclamp', (k.s.vClamp ? '🔒' : '🔓') + ' V svěrka', k.s.vClamp);
      html += b('hold', '⏸ Hz hold', k.s.hzHold);
    }
    html += b('comp', '⚖︎ Kompenzátor', k.s.comp) + b('hz0', '0 Hz = 0', false) + b('eye', '👁 Okulár', false);
    if (k.c.isLevel) html += b('bs', '↩︎ Záměra vzad', false) + b('fs', '↪︎ Záměra vpřed', false);
  } else if (st.rover) {
    html += b('tiltcomp', '🧭 Kompenzace náklonu', st.tiltComp) + b('plumb', '⊥ Svisle', false);
  }
  p.innerHTML = html;
}

$('clampPanel').addEventListener('click', (e) => {
  const id = e.target.closest('button')?.dataset.ctl, st = S.setup;
  if (!id || !st) return;
  const k = st.k;
  switch (id) {
    case 'classic': k.c.classic = !k.c.classic; k.setHClamp(false); k.setVClamp(false); break;
    case 'hclamp': k.setHClamp(!k.s.hClamp); break;
    case 'vclamp': k.setVClamp(!k.s.vClamp); break;
    case 'hold': k.s.hzHold = !k.s.hzHold; break;
    case 'comp': k.s.comp = !k.s.comp; break;
    case 'hz0': k.setHz(0); toast('Hz nastaveno na 0'); break;
    case 'eye': openTelescope(); break;
    case 'bs': case 'fs': {
      const rd = S.readout?.rod?.reading;
      if (rd == null) { toast('Nejdřív zacilte na lať', 'warn'); break; }
      st.log[id] = rd; if (id === 'bs') st.log.fs = null;
      toast(id === 'bs' ? `Vzad ${rd.toFixed(4)} m` : `Vpřed ${rd.toFixed(4)} m`, 'ok');
      break;
    }
    case 'tiltcomp': st.tiltComp = !st.tiltComp; break;
    case 'plumb': st.pole = [0, 1, 0]; st.rover.apply(st.pole); break;
  }
  if (k) st.rig.apply(k);
  refreshControls();
});

// ---------------------------------------------------------------------------------------
// Pohled dalekohledem

const telRenderer = new THREE.WebGLRenderer({ canvas: $('telScene'), antialias: true, alpha: true });
telRenderer.outputColorSpace = THREE.SRGBColorSpace;
telRenderer.toneMapping = THREE.ACESFilmicToneMapping;
const telCam = new THREE.PerspectiveCamera(1.5, 1, 0.5, 2000);
const telVideo = $('telVideo'), tvx = telVideo.getContext('2d');
const reticleCanvas = $('reticle'), rctx = reticleCanvas.getContext('2d');

function openTelescope() {
  if (!S.setup?.k) return;
  S.telescope = true;
  const mag = S.setup.model.spec.magnification;
  S.zoom = clamp(mag, 10, 30);
  $('zoom').value = S.zoom; $('zoomText').textContent = `${S.zoom}×`;
  $('jogV').classList.toggle('hidden', S.setup.k.c.isLevel);
  show('telescope', true);
  requestAnimationFrame(() => jogRedraws.forEach((d) => d()));
  if (S.hand) tracker.running && tracker.stop();
}
function closeTelescope() {
  S.telescope = false;
  show('telescope', false);
  if (S.hand) tracker.start();
}

function fieldOfView() {
  const s = S.setup.model.spec;
  const base = (s.fov ?? 72) / 60;                   // zorné pole při nominálním zvětšení [°]
  return deg(base * (s.magnification / S.zoom));
}

function renderTelescope() {
  const st = S.setup;
  const size = Math.round($('eyepiece').clientWidth * Math.min(devicePixelRatio, 2));
  if (telRenderer.domElement.width !== size) {
    telRenderer.setSize(size, size, false);
    telVideo.width = telVideo.height = reticleCanvas.width = reticleCanvas.height = size;
  }
  const { origin, dir } = lineOfSight();
  const fov = fieldOfView();
  telCam.fov = toDeg(fov); telCam.aspect = 1; telCam.updateProjectionMatrix();
  telCam.position.copy(origin);
  telCam.up.set(0, 1, 0);
  telCam.lookAt(origin.clone().add(dir));

  // Pozadí: zvětšený výřez živé kamery (AR), jinak virtuální krajina.
  const ar = S.mode === 'ar';
  let videoDrawn = false;
  const v = $('cam');
  if (ar && v.videoWidth) {
    const far = origin.clone().addScaledVector(dir, 100).project(camera);
    if (far.z < 1 && Math.abs(far.x) < 1 && Math.abs(far.y) < 1) {
      const sx = (far.x + 1) / 2 * innerWidth, sy = (1 - far.y) / 2 * innerHeight;
      const pxPerRad = innerHeight / 2 / Math.tan(deg(camera.fov) / 2);
      const cropScreen = fov * pxPerRad;
      const s = Math.max(innerWidth / v.videoWidth, innerHeight / v.videoHeight);
      const vx = (sx + (v.videoWidth * s - innerWidth) / 2) / s, vy = (sy + (v.videoHeight * s - innerHeight) / 2) / s, vs = cropScreen / s;
      tvx.imageSmoothingQuality = 'high';
      tvx.drawImage(v, vx - vs / 2, vy - vs / 2, vs, vs, 0, 0, size, size);
      videoDrawn = true;
    }
  }
  if (!videoDrawn) tvx.clearRect(0, 0, size, size);
  const showVirtualWorld = !videoDrawn;
  const prev = [scene.background, groundVisual.visible, scenery.visible];
  scene.background = showVirtualWorld ? sky : null;
  groundVisual.visible = showVirtualWorld; scenery.visible = true;
  telRenderer.render(scene, telCam);
  [scene.background, groundVisual.visible, scenery.visible] = prev;

  // Rozostření podle ostření (rozdíl dioptrií).
  const blur = clamp(st.k.defocus(S.targetDist ?? 50) * 40, 0, 8);
  // Nitkový kříž leží v ohniskové rovině okuláru – rozostřuje se jen obraz, ne rysky.
  const f = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : '';
  telVideo.style.filter = f; $('telScene').style.filter = f;

  drawReticle(size, fov);
  const r = S.readout;
  const lvl = st.model.kind === 'level';
  $('telReadout').innerHTML = r ? cell('Hz', formatAngle(r.r.hz, S.unit)) +
    (lvl ? cell('Lať', formatDist(r.rod?.reading), 'm') : cell('V', formatAngle(r.r.v, S.unit))) +
    cell('Azimut (síť)', formatAngle(r.az, S.unit)) +
    cell(lvl ? 'Dálka' : 'SD', formatDist(r.distance), 'm') +
    (r.rod ? cell('Horní / dolní', `${r.rod.upper.toFixed(3)}/${r.rod.lower.toFixed(3)}`) : cell('HD', formatDist(r.hd), 'm')) +
    cell('Ostření', st.k.s.focus.toFixed(1), 'm') : '';
  $('telSub').textContent = r?.r.state === 'out' && r.r.comp ? '⚠︎ Sklon mimo rozsah kompenzátoru' : `${S.zoom}× · ${videoDrawn ? 'živá kamera' : 'virtuální krajina'}`;
}

/** Nitkový kříž s dvojitými ryskami a dálkoměrnými ryskami ±1/200 rad (k = 100). */
function drawReticle(size, fov) {
  const g = rctx, c = size / 2;
  g.clearRect(0, 0, size, size);
  const ppr = size / fov, stadia = 0.005 * ppr;
  const line = (x1, y1, x2, y2, w = 1.4) => {
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = w + 2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.9)'; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  };
  const dpr = size / $('eyepiece').clientWidth;
  line(0, c, size, c, dpr); line(c, 0, c, size, dpr);
  const gap = 3.5 * dpr;
  line(c - gap, size * 0.08, c - gap, c - size * 0.18, dpr * 0.8); line(c + gap, size * 0.08, c + gap, c - size * 0.18, dpr * 0.8);
  line(c + size * 0.18, c - gap, size * 0.92, c - gap, dpr * 0.8); line(c + size * 0.18, c + gap, size * 0.92, c + gap, dpr * 0.8);
  if (stadia < size * 0.45) { line(c - size * 0.09, c - stadia, c + size * 0.09, c - stadia, dpr); line(c - size * 0.09, c + stadia, c + size * 0.09, c + stadia, dpr); }
}

const jogRedraws = [];
// Jog kolečka (tažení = otáčení knoflíku; 120 px = 1 otáčka).
document.querySelectorAll('.jog').forEach((el) => {
  const cv = el.querySelector('canvas'), g = cv.getContext('2d');
  let phase = 0, last = null;
  const draw = () => {
    cv.width = cv.clientWidth * 2; cv.height = cv.clientHeight * 2;
    g.clearRect(0, 0, cv.width, cv.height);
    for (let x = ((phase * 2) % 14 + 14) % 14; x < cv.width; x += 14) {
      const t = Math.abs(x - cv.width / 2) / (cv.width / 2);
      g.strokeStyle = `rgba(255,255,255,${0.6 * (1 - t * 0.8)})`; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, 8); g.lineTo(x, cv.height - 8); g.stroke();
    }
  };
  jogRedraws.push(draw);
  el.addEventListener('pointerdown', (e) => { last = e.clientX; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    if (last == null || !S.setup?.k) return;
    const d = e.clientX - last; last = e.clientX; phase += d; draw();
    const k = S.setup.k, turns = d / 120;
    const fb = el.dataset.jog === 'h' ? k.turnH(turns) : el.dataset.jog === 'v' ? k.turnV(turns) : (k.turnFocus(turns), {});
    S.setup.rig.apply(k); feedback(fb);
  });
  const end = () => { last = null; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
});

// ---------------------------------------------------------------------------------------
// Katalog

function renderCatalog() {
  $('catSeg').innerHTML = CATEGORIES.map((c) => `<button data-cat="${c.id}" class="${c.id === S.cat ? 'on' : ''}" title="${c.title}">${c.icon}</button>`).join('');
  const color = { leica: '#d91a1f', trimble: '#fac70a', topcon: '#f5b312', generic: '#f2bd1a' };
  const icon = { ts: '⌖', level: '═', gnss: '📡', tripod: '△', rod: '📏' };
  $('cards').innerHTML = CATALOG.filter((m) => m.cat === S.cat).map((m) => `
    <div class="card ${m.id === S.selected.id ? 'sel' : ''}" data-id="${m.id}">
      <div class="row"><div class="ic" style="background:${color[m.brand]}33;color:${color[m.brand]}">${icon[m.kind]}</div>
      <div class="grow"></div>${m.spec.magnification ? `<span class="tiny">${m.spec.magnification}×</span>` : ''}</div>
      <div class="mk">${m.maker || 'Příslušenství'}</div><div class="nm">${m.name}</div><div class="tg">${m.tagline}</div>
    </div>`).join('');
  $('specs').innerHTML = `<b>${displayName(S.selected)}</b>` + specRows(S.selected).map(([a, b]) => `<div><span>${a}</span><span>${b}</span></div>`).join('');
  $('specs').classList.toggle('hidden', !S.drawerOpen || S.drawerMini);
  ['catSeg', 'cards'].forEach((id) => show(id, !S.drawerMini));
  const k = S.selected.kind;
  if (S.drawerMini) { $('placeBtn').textContent = '▲ Katalog vybavení'; return; }
  $('placeBtn').textContent = k === 'rod' ? '📏 Postavit lať' : k === 'tripod' ? '△ Postavit stativ' : k === 'gnss' ? '📡 Postavit rover' : '⌖ Postavit přístroj';
}
$('catSeg').addEventListener('click', (e) => {
  const c = e.target.closest('button')?.dataset.cat; if (!c) return;
  S.cat = c; S.selected = CATALOG.find((m) => m.cat === c); renderCatalog();
});
$('cards').addEventListener('click', (e) => {
  const id = e.target.closest('.card')?.dataset.id; if (!id) return;
  if (S.selected.id === id) S.drawerOpen = !S.drawerOpen;
  S.selected = byId(id); renderCatalog();
});
$('drawerHandle').addEventListener('click', () => {
  if (S.drawerMini) S.drawerMini = false; else if (S.setup) S.drawerMini = true; else S.drawerOpen = !S.drawerOpen;
  renderCatalog();
});
$('placeBtn').addEventListener('click', () => {
  if (S.drawerMini) { S.drawerMini = false; renderCatalog(); return; }
  beginPlacement();
});
$('placeOk').addEventListener('click', place);
$('placeCancel').addEventListener('click', () => { S.placing = false; reticle.visible = false; show('placeBar', false); show('drawer', true); });
$('modeSeg').addEventListener('click', (e) => {
  const m = e.target.closest('button')?.dataset.mode; if (!m || m === S.mode) return;
  if (m === 'ar') startAR(); else setMode('3d');
});
$('handBtn').addEventListener('click', toggleHand);
$('unitBtn').addEventListener('click', () => {
  S.unit = S.unit === 'gon' ? 'dms' : S.unit === 'dms' ? 'deg' : 'gon';
  $('unitBtn').textContent = { gon: 'gon', dms: 'DMS', deg: '°' }[S.unit];
});
$('walk').addEventListener('click', (e) => { const d = e.target.closest('button')?.dataset.walk; if (d) walk(d); });
$('telExit').addEventListener('click', closeTelescope);
$('zoom').addEventListener('input', (e) => { S.zoom = +e.target.value; $('zoomText').textContent = `${S.zoom}×`; });
$('afBtn').addEventListener('click', () => { if (S.setup?.k) { S.setup.k.setFocus(S.targetDist ?? 50); S.setup.rig.apply(S.setup.k); } });

function show(id, on) { $(id).classList.toggle('hidden', !on); }

let toastTimer = null, lastToast = '';
function toast(text, kind = 'info') {
  if (text === lastToast && toastTimer) return;
  lastToast = text;
  const t = $('toast');
  t.textContent = text;
  t.style.color = kind === 'ok' ? 'var(--green)' : kind === 'warn' ? 'var(--amber)' : 'var(--text)';
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.add('hidden'); toastTimer = null; lastToast = ''; }, 2400);
}

// ---------------------------------------------------------------------------------------
// Start a smyčka

function begin(ar) {
  show('start', false);
  ['hud', 'drawer'].forEach((id) => show(id, true));
  renderCatalog();
  if (ar) startAR(); else setMode('3d');
}
$('startAR').addEventListener('click', () => begin(true));
$('start3D').addEventListener('click', () => begin(false));

const landscape = matchMedia('(orientation: landscape)');

/**
 * Svislé zorné pole virtuální kamery tak, aby odpovídalo videu zobrazenému s object-fit: cover.
 * Delší strana snímače má u hlavní kamery iPhonu zorné pole ≈ 65°; na výšku obrazovky se
 * zobrazí jen její část (ořez), proto se pole přepočítá přes měřítko zobrazení.
 */
function updateFov() {
  const v = $('cam');
  if (S.mode === 'ar' && v.videoWidth) {
    const s = Math.max(innerWidth / v.videoWidth, innerHeight / v.videoHeight);
    const tanPerPx = Math.tan(deg(65) / 2) / (Math.max(v.videoWidth, v.videoHeight) / 2);
    camera.fov = toDeg(2 * Math.atan(tanPerPx * (innerHeight / 2) / s));
  } else {
    camera.fov = landscape.matches ? 42 : 55;
  }
  // Ve 3D na šířku posuneme obraz doprava dolů, aby přístroj nezakrýval horní panel.
  // (V AR se obraz posouvat nesmí – musí sedět na video.)
  if (S.mode !== 'ar' && landscape.matches) camera.setViewOffset(innerWidth, innerHeight, -0.16 * innerWidth, -0.1 * innerHeight, innerWidth, innerHeight);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
$('cam').addEventListener('loadedmetadata', updateFov);
$('cam').addEventListener('resize', updateFov);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  updateFov();
}
addEventListener('resize', resize);
resize();

let lastMeasure = 0, lastHud = 0;
renderer.setAnimationLoop((tMs) => {
  const now = tMs / 1000;
  updateCamera();
  updatePlacementPreview();
  if (S.setup?.k && now - lastMeasure > 1 / 12) { lastMeasure = now; measure(); }
  if (S.setup?.rover) updateGNSS(now);
  if (now - lastHud > 0.1) { lastHud = now; updateHUD(); }
  if (S.telescope) renderTelescope();
  else renderer.render(scene, camera);
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Pro testování z konzole.
window.__geoar = { S, THREE, scene, camera, place, walk, openTelescope };
