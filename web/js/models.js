// Procedurální modely vybavení s PBR materiály (Three.js MeshPhysicalMaterial).
// Rozměry v metrech podle skutečných přístrojů (klopná osa TS16 196 mm nad trojnožkou,
// hlava stativu GST20 ~200 mm, výtyčka 2,00 m …).

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { PALETTES } from './catalog.js';
import { SCREW_AZ, tiltRotate } from './kinematics.js';
import { upForGradient } from './geodesy.js';

const V2 = (x, y) => new THREE.Vector2(x, y);
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------------------
// Procedurální textury (canvas)

function canvasTexture(w, h, draw, { repeat = [1, 1], color = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const knurlBump = () => canvasTexture(128, 128, (g, w, h) => {
  g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#202020'; g.lineWidth = 3;
  for (let i = -w; i < w * 2; i += 16) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke();
    g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke();
  }
}, { repeat: [6, 2], color: false });

const orangePeel = () => canvasTexture(128, 128, (g, w, h) => {
  const img = g.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 118 + Math.random() * 20;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}, { repeat: [3, 3], color: false });

const carbonTex = () => canvasTexture(128, 128, (g, w, h) => {
  const cell = 16;
  for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
    const horizontal = ((x / cell + y / cell) % 4) < 2;
    const grad = horizontal ? g.createLinearGradient(0, y, 0, y + cell) : g.createLinearGradient(x, 0, x + cell, 0);
    grad.addColorStop(0, '#0b0b0d'); grad.addColorStop(0.5, horizontal ? '#2a2b30' : '#222327'); grad.addColorStop(1, '#0b0b0d');
    g.fillStyle = grad; g.fillRect(x, y, cell, cell);
  }
}, { repeat: [3, 80] });

const woodTex = () => canvasTexture(128, 512, (g, w, h) => {
  g.fillStyle = '#b07a45'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * w;
    g.strokeStyle = `rgba(${90 + Math.random() * 30},${50 + Math.random() * 20},20,${0.25 + Math.random() * 0.35})`;
    g.lineWidth = 0.6 + Math.random() * 2.2;
    g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y <= h; y += 32) g.lineTo(x + Math.sin(y * 0.02 + i) * 4, y);
    g.stroke();
  }
}, { repeat: [1, 2] });

const rodTex = (length) => canvasTexture(128, 4096, (g, w, h) => {
  const pxm = h / length;
  g.fillStyle = '#f6f6f2'; g.fillRect(0, 0, w, h);
  for (let cm = 0; cm < length * 100; cm++) {
    const y = h - (cm + 1) * pxm / 100, ch = pxm / 100;
    g.fillStyle = Math.floor(cm / 100) % 2 === 0 ? '#111' : '#c20d0d';
    const left = Math.floor(cm / 5) % 2 === 0;
    const x0 = left ? 8 : w / 2, fw = w / 2 - 8;
    g.fillRect(left ? x0 : x0 + fw - 10, y, 10, ch);
    if ((cm % 5) % 2 === 0) g.fillRect(x0, y, fw, ch);
  }
  g.font = 'bold 34px Helvetica, Arial';
  for (let dm = 1; dm < length * 10; dm++) {
    const m = Math.floor(dm / 10);
    g.fillStyle = m % 2 === 0 ? '#111' : '#c20d0d';
    const y = h - dm * pxm / 10;
    const txt = `${m}${dm % 10}`;
    const x = Math.floor(dm / 5) % 2 === 0 ? w - g.measureText(txt).width - 6 : 6;
    g.fillText(txt, x, y + 30);
    if (dm % 10 === 0) { g.fillStyle = '#c20d0d'; g.beginPath(); g.arc(w / 2, y + 12, 7, 0, 7); g.fill(); }
  }
}, { repeat: [1, 1] });

// ---------------------------------------------------------------------------------------
// Materiály

const cache = new Map();
const once = (k, f) => (cache.has(k) ? cache.get(k) : (cache.set(k, f()), cache.get(k)));

export const MAT = {
  /** Lakovaný kovový odlitek – drsnost 0,45, kovovost 0,8, čirý lak, „pomerančová kůra“. */
  coated: (color, roughness = 0.45, metalness = 0.8) => once(`c${color}${roughness}${metalness}`, () => new THREE.MeshPhysicalMaterial({
    color, roughness, metalness: metalness * 0.55, clearcoat: 0.8, clearcoatRoughness: 0.12,
    bumpMap: once('peel', orangePeel), bumpScale: 0.3,
  })),
  /** Optické sklo s vícevrstvou antireflexní vrstvou (transmise + clearcoat). */
  glass: (tint = 0x6b57a0) => once(`g${tint}`, () => new THREE.MeshPhysicalMaterial({
    color: tint, metalness: 0, roughness: 0.05, transmission: 0.9, thickness: 0.01, ior: 1.52,
    clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, transparent: true, opacity: 0.55,
  })),
  rubber: () => once('rubber', () => new THREE.MeshStandardMaterial({ color: 0x0e0e0f, roughness: 0.85, metalness: 0, bumpMap: knurlBump(), bumpScale: 2.5 })),
  anodized: (color = 0x222427) => once(`a${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.9 })),
  steel: () => once('steel', () => new THREE.MeshStandardMaterial({ color: 0xb8bac0, roughness: 0.3, metalness: 1 })),
  plastic: (color = 0x121214) => once(`p${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0 })),
  carbon: () => once('carbon', () => new THREE.MeshPhysicalMaterial({ map: carbonTex(), roughness: 0.35, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05 })),
  wood: () => once('wood', () => new THREE.MeshPhysicalMaterial({ map: woodTex(), roughness: 0.5, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.2 })),
  yellow: () => once('yellow', () => new THREE.MeshPhysicalMaterial({ color: 0xf7c214, roughness: 0.4, metalness: 0.4, clearcoat: 0.8 })),
  radome: () => once('radome', () => new THREE.MeshPhysicalMaterial({ color: 0xe6e6e0, roughness: 0.42, metalness: 0, clearcoat: 0.4 })),
  fluid: () => once('fluid', () => new THREE.MeshPhysicalMaterial({ color: 0xb8db5a, roughness: 0.1, emissive: 0x4d6619, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 })),
  bubble: () => once('bubble', () => new THREE.MeshPhysicalMaterial({ color: 0xfafafa, roughness: 0.05, emissive: 0xf2ffd9, emissiveIntensity: 0.9 })),
  unlit: (color, opacity = 1) => once(`u${color}${opacity}`, () => new THREE.MeshBasicMaterial(opacity === 0
    ? { colorWrite: false, depthWrite: false } // neviditelná zásahová plocha pro raycasting
    : { color, transparent: opacity < 1, opacity })),
};

// ---------------------------------------------------------------------------------------
// Pomocné funkce geometrie

function mesh(geo, mat, parent, pos = [0, 0, 0], rot = null, name = '') {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const node = (parent, pos = [0, 0, 0], name = '') => { const o = new THREE.Group(); o.position.set(...pos); o.name = name; parent.add(o); return o; };
const rbox = (w, h, d, r = 0.004) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
const cyl = (r, h, seg = 32) => new THREE.CylinderGeometry(r, r, h, seg);
const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([x, y]) => V2(x, y)), seg);

/** Zaoblený trojúhelník (trojnožka / hlava stativu), rohy ve směrnících az (po směru hodin od −Z). */
function roundedTriangle(R, rc, h, az = SCREW_AZ) {
  const shape = new THREE.Shape();
  const inset = R - 2 * rc;
  const angles = az.map((a) => Math.atan2(-Math.cos(a), Math.sin(a))).sort((a, b) => a - b);
  let first = true;
  for (const a of angles) {
    const cx = Math.cos(a) * inset, cz = Math.sin(a) * inset;
    for (let s = 0; s <= 8; s++) {
      const t = a - Math.PI / 3 + (2 * Math.PI / 3) * (s / 8);
      const x = cx + Math.cos(t) * rc, z = cz + Math.sin(t) * rc;
      // Shape leží v rovině XY; po otočení −90° kolem X se y tvaru stane −z.
      if (first) { shape.moveTo(x, -z); first = false; } else shape.lineTo(x, -z);
    }
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 2 });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** Tlačítko se zobrazitelným textem na plátně (displej, tablet). */
export function makeScreen(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx: canvas.getContext('2d'), texture, last: '' };
}

export function drawLCD(screen, title, status, lines, alert) {
  const sig = JSON.stringify([title, status, lines, alert]);
  if (sig === screen.last) return;
  screen.last = sig;
  const { ctx: g, canvas } = screen, w = canvas.width, h = canvas.height;
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#b3c2ad'); bg.addColorStop(1, '#94a691');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const bar = h * 0.2;
  g.fillStyle = '#121714'; g.fillRect(0, 0, w, bar);
  g.fillStyle = '#b3c2ad'; g.font = `bold ${bar * 0.6}px ui-monospace, Menlo, monospace`;
  g.fillText(title, 10, bar * 0.75);
  g.textAlign = 'right'; g.fillText(status, w - 10, bar * 0.75); g.textAlign = 'left';
  const rh = (h - bar) / 3;
  lines.forEach(([label, value], i) => {
    const y = bar + rh * (i + 0.72);
    g.fillStyle = '#121714';
    g.font = `600 ${rh * 0.45}px ui-monospace, Menlo, monospace`; g.fillText(label, 10, y);
    g.font = `bold ${rh * 0.66}px ui-monospace, Menlo, monospace`;
    g.textAlign = 'right'; g.fillText(value, w - 12, y); g.textAlign = 'left';
  });
  if (alert) {
    g.fillStyle = '#121714'; g.fillRect(w * 0.12, h * 0.36, w * 0.76, h * 0.42);
    g.fillStyle = '#b3c2ad'; g.font = `900 ${h * 0.13}px Helvetica, Arial`; g.textAlign = 'center';
    g.fillText(alert, w / 2, h * 0.62); g.textAlign = 'left';
  }
  screen.texture.needsUpdate = true;
}

export function drawTablet(screen, title, status, lines) {
  const sig = JSON.stringify([title, status, lines]);
  if (sig === screen.last) return;
  screen.last = sig;
  const { ctx: g, canvas } = screen, w = canvas.width, h = canvas.height;
  g.fillStyle = '#0f141c'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#1f2a36'; g.lineWidth = 1;
  for (let x = 0; x < w; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y < h; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  const hh = h * 0.18;
  g.fillStyle = '#006bbf'; g.fillRect(0, 0, w, hh);
  g.font = `bold ${hh * 0.5}px Helvetica, Arial`; g.fillStyle = '#fff'; g.fillText(title, 10, hh * 0.68);
  g.textAlign = 'right';
  g.fillStyle = status.includes('Fixed') ? '#34c759' : status.includes('Float') ? '#ff9f0a' : '#ff453a';
  g.fillText(status, w - 10, hh * 0.68); g.textAlign = 'left';
  const rh = (h - hh) / lines.length;
  lines.forEach(([l, v], i) => {
    const y = hh + rh * (i + 0.7);
    g.fillStyle = '#aaa'; g.font = `${rh * 0.45}px Helvetica, Arial`; g.fillText(l, 10, y);
    g.fillStyle = '#fff'; g.font = `600 ${rh * 0.58}px ui-monospace, Menlo, monospace`;
    g.textAlign = 'right'; g.fillText(v, w - 10, y); g.textAlign = 'left';
  });
  screen.texture.needsUpdate = true;
}

/** Označí objekt jako ovladatelnou část (pro raycasting). */
function part(obj, kind) { obj.traverse((o) => { o.userData.part = kind; }); return obj; }

/** Krabicová libela; vrací bublinu a její klidovou polohu v rodiči. */
function circularLevel(parent, pos, r = 0.012) {
  const vial = node(parent, pos, 'Libela');
  mesh(new THREE.CylinderGeometry(r, r, 0.008, 32, 1, true), MAT.anodized(), vial, [0, 0.004, 0]);
  mesh(cyl(r * 0.8, 0.0045), MAT.fluid(), vial, [0, 0.0045, 0]);
  mesh(new THREE.TorusGeometry(0.0029, 0.00022, 6, 32), MAT.plastic(), vial, [0, 0.0076, 0], [Math.PI / 2, 0, 0]);
  const rest = new THREE.Vector3(pos[0], pos[1] + 0.0068, pos[2]);
  const bubble = mesh(new THREE.SphereGeometry(0.0022, 16, 12), MAT.bubble(), parent, rest.toArray());
  bubble.scale.set(1, 0.35, 1);
  return { bubble, rest };
}

/** Rýhovaný knoflík s osou X; vrací rotor (otáčí se kolem X). */
function driveKnob(parent, pos, r, w, kind, outward = 1) {
  const spinner = node(parent, pos, kind);
  mesh(cyl(r, w), MAT.rubber(), spinner, [0, 0, 0], [0, 0, Math.PI / 2]);
  mesh(cyl(r * 0.6, 0.002), MAT.anodized(), spinner, [outward * (w / 2 + 0.001), 0, 0], [0, 0, Math.PI / 2]);
  mesh(new THREE.BoxGeometry(0.0015, r * 0.5, 0.0015), MAT.unlit(0xffffff), spinner, [outward * (w / 2 + 0.0022), r * 0.3, 0]);
  const hit = mesh(new THREE.SphereGeometry(Math.max(r * 1.8, 0.022), 12, 8), MAT.unlit(0xffffff, 0), spinner);
  hit.userData.hitProxy = true; hit.castShadow = false;
  return part(spinner, kind);
}

// ---------------------------------------------------------------------------------------
// Trojnožka (společná pro TS i nivelační přístroj)

function tribrach(rig, pal, plateR, knobR, screwR) {
  const base = rig.baseTilt;
  mesh(roundedTriangle(plateR, 0.02, 0.009), MAT.anodized(), base, [0, 0, 0], null, 'Trojnožka');
  mesh(cyl(0.032, 0.004), MAT.anodized(), base, [0, 0.011, 0]);
  rig.screwRest = 0.009;
  rig.screws = SCREW_AZ.map((a, i) => {
    const s = node(base, [screwR * Math.sin(a), rig.screwRest, -screwR * Math.cos(a)], `šroub${i}`);
    mesh(cyl(knobR, 0.012, 40), MAT.rubber(), s, [0, 0.008, 0]);
    mesh(cyl(knobR * 0.55, 0.0025), MAT.anodized(), s, [0, 0.0152, 0]);
    mesh(new THREE.BoxGeometry(0.0012, 0.0006, knobR * 0.5), MAT.unlit(0xffffff), s, [0, 0.0166, -knobR * 0.3]);
    mesh(cyl(0.0042, 0.03), MAT.steel(), s, [0, 0.022, 0]);
    const hit = mesh(new THREE.SphereGeometry(0.022, 12, 8), MAT.unlit(0xffffff, 0), s, [0, 0.008, 0]);
    hit.userData.hitProxy = true;
    return part(s, `screw${i}`);
  });
  rig.levelPivot = 0.032;
  mesh(roundedTriangle(plateR * 0.93, 0.022, 0.01), MAT.coated(pal.trim, 0.5, 0.6), rig.leveling, [0, 0, 0], null, 'Horní deska');
}

// ---------------------------------------------------------------------------------------
// Totální stanice

export function makeTotalStation(model) {
  const pal = PALETTES[model.brand], s = model.spec;
  const rig = newInstrumentRig(model);
  tribrach(rig, pal, 0.088, 0.0145, 0.065);

  // Libela na výstupku horní desky (vlevo vzadu).
  const az = (Math.PI * 4) / 3, dir = [Math.sin(az), 0, -Math.cos(az)];
  mesh(rbox(0.026, 0.009, 0.05, 0.003), MAT.coated(pal.trim, 0.5, 0.6), rig.leveling, [dir[0] * 0.055, 0.0055, dir[2] * 0.055], [0, -az, 0]);
  Object.assign(rig, circularLevel(rig.leveling, [dir[0] * 0.076, 0.01, dir[2] * 0.076]));

  const body = MAT.coated(pal.body), trim = MAT.coated(pal.trim, 0.55, 0.5), accent = MAT.coated(pal.accent, 0.4, 0.6), dark = MAT.anodized();
  rig.alidade.position.y = 0.01;
  const pivotAbove = rig.levelPivot + 0.01;
  const ty = s.trunnion - pivotAbove;
  rig.opticalHeight = s.trunnion;
  const A = rig.alidade;

  mesh(lathe([[0, 0], [0.058, 0], [0.061, 0.004], [0.061, 0.022], [0.056, 0.028], [0, 0.028]]), dark, A);
  part(mesh(rbox(0.172, 0.05, 0.13, 0.012), body, A, [0, 0.053, 0], null, 'Tělo'), 'alidade');
  for (const sd of [-1, 1]) {
    part(mesh(rbox(0.03, 0.142, 0.106, 0.011), body, A, [sd * 0.075, 0.149, 0]), 'alidade');
    mesh(cyl(0.02, 0.012), dark, A, [sd * 0.0555, ty, 0], [0, 0, Math.PI / 2]);
    mesh(rbox(0.002, 0.028, 0.092, 0.0008), accent, A, [sd * 0.0905, 0.205, 0]);
    part(mesh(rbox(0.018, 0.03, 0.022, 0.005), trim, A, [sd * 0.07, 0.232, 0]), 'alidade');
  }
  part(mesh(rbox(0.172, 0.016, 0.03, 0.007), trim, A, [0, 0.25, 0], null, 'Rukojeť'), 'alidade');
  mesh(rbox(0.01, 0.062, 0.074, 0.003), trim, A, [-0.0955, 0.128, 0], null, 'Baterie');
  mesh(rbox(0.004, 0.012, 0.022, 0.001), accent, A, [-0.1015, 0.15, 0]);

  // Popisek značky (plátno).
  const label = makeScreen(256, 64);
  label.ctx.fillStyle = '#' + pal.body.toString(16).padStart(6, '0'); label.ctx.fillRect(0, 0, 256, 64);
  label.ctx.fillStyle = '#' + pal.label.toString(16).padStart(6, '0'); label.ctx.font = '900 40px Helvetica, Arial';
  label.ctx.fillText(model.maker, 8, 44);
  label.ctx.fillStyle = '#333'; label.ctx.font = '700 26px Helvetica, Arial'; label.ctx.fillText(model.name, 150, 44);
  label.texture.needsUpdate = true;
  mesh(new THREE.PlaneGeometry(0.09, 0.0225), new THREE.MeshBasicMaterial({ map: label.texture }), A, [0.0903, 0.165, 0], [0, Math.PI / 2, 0]);

  // Displej s klávesnicí na straně obsluhy (+Z), sklopený nahoru.
  const du = node(A, [0, 0.06, 0.077], 'Displej'); du.rotation.x = -0.35;
  mesh(rbox(0.15, 0.085, 0.028, 0.008), MAT.plastic(), du);
  rig.lcd = makeScreen(384, 192);
  mesh(new THREE.PlaneGeometry(0.094, 0.047), new THREE.MeshBasicMaterial({ map: rig.lcd.texture, toneMapped: false }), du, [0, 0.014, 0.0145]);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
    mesh(rbox(0.015, 0.008, 0.004, 0.0015), MAT.plastic(0xc4c6c9), du, [-0.0525 + c * 0.021, -0.021 - r * 0.0125, 0.0145]);
  }

  rig.hKnobs = [driveKnob(rig.alidade, [0.1, 0.098, 0.028], 0.012, 0.016, 'hDrive')];
  rig.vKnob = driveKnob(rig.alidade, [0.1, ty, 0.03], 0.012, 0.016, 'vDrive');

  // Dalekohled.
  const T = node(rig.alidade, [0, ty, 0], 'Dalekohled');
  rig.telescope = T;
  part(mesh(rbox(0.104, 0.074, 0.09, 0.014), body, T), 'telescope');
  const tube = node(T); tube.rotation.x = -Math.PI / 2; // lathe +Y → −Z (k objektivu)
  part(mesh(lathe([[0.021, -0.062], [0.023, -0.058], [0.024, -0.045], [0.029, -0.04], [0.03, 0.045], [0.033, 0.05], [0.034, 0.084], [0.0355, 0.088], [0.031, 0.088]], 56), dark, tube), 'telescope');
  mesh(new THREE.SphereGeometry(0.07, 32, 12, 0, Math.PI * 2, 0, 0.45), MAT.glass(), tube, [0, 0.016, 0]);
  mesh(cyl(0.0075, 0.003), MAT.plastic(), tube, [0, 0.0855, 0]);
  mesh(new THREE.TorusGeometry(0.0325, 0.0012, 8, 48), accent, tube, [0, 0.07, 0], [Math.PI / 2, 0, 0]);
  mesh(cyl(0.012, 0.022), dark, tube, [0, -0.073, 0]);
  mesh(new THREE.CylinderGeometry(0.0165, 0.0155, 0.014, 32, 1, true), MAT.rubber(), tube, [0, -0.091, 0]);
  mesh(new THREE.CircleGeometry(0.0095, 24), MAT.glass(0x3a3060), tube, [0, -0.0975, 0], [Math.PI / 2, 0, 0]);
  const focus = node(T, [0, 0, 0.052], 'focus');
  mesh(cyl(0.0268, 0.016, 48), MAT.rubber(), focus, [0, 0, 0], [Math.PI / 2, 0, 0]);
  rig.focusKnob = part(focus, 'focus'); rig.focusAxis = 'z';
  mesh(rbox(0.011, 0.012, 0.07, 0.003), MAT.plastic(), T, [0, 0.043, 0], null, 'Kolimátor');
  mesh(new THREE.SphereGeometry(0.0022, 8, 6), MAT.unlit(0xffffff), T, [0, 0.05, -0.034]);

  rig.objective = node(T, [0, 0, -0.09], 'objektiv');
  rig.eyepiece = node(T, [0, 0, 0.1], 'okulár');
  finishRig(rig);
  return rig;
}

// ---------------------------------------------------------------------------------------
// Automatický nivelační přístroj

export function makeLevel(model) {
  const pal = PALETTES[model.brand], s = model.spec;
  const rig = newInstrumentRig(model);
  rig.bubbleOnAlidade = true;
  tribrach(rig, pal, 0.075, 0.0125, 0.055);
  const body = MAT.coated(pal.body), dark = MAT.anodized();
  rig.alidade.position.y = 0.01;
  const losY = s.los - (rig.levelPivot + 0.01);
  rig.opticalHeight = s.los;
  const A = rig.alidade;
  mesh(cyl(0.058, 0.012, 48), dark, A, [0, 0.006, 0]);
  mesh(new THREE.CylinderGeometry(0.0588, 0.0588, 0.004, 48, 1, true), MAT.plastic(0xd9d9d4), A, [0, 0.009, 0]);
  part(mesh(rbox(0.076, 0.062, 0.16, 0.02), body, A, [0, 0.045, 0], null, 'Tělo'), 'alidade');
  part(mesh(rbox(0.066, 0.02, 0.14, 0.009), body, A, [0, 0.08, 0]), 'alidade');
  const tube = node(A, [0, losY, 0]); tube.rotation.x = -Math.PI / 2;
  part(mesh(lathe([[0.026, 0.07], [0.028, 0.1], [0.029, 0.118], [0.0305, 0.122], [0.026, 0.122]]), dark, tube), 'alidade');
  mesh(new THREE.SphereGeometry(0.058, 32, 12, 0, Math.PI * 2, 0, 0.45), MAT.glass(), tube, [0, 0.062, 0]);
  mesh(cyl(0.013, 0.03), dark, tube, [0, -0.092, 0]);
  mesh(new THREE.CylinderGeometry(0.0165, 0.0155, 0.014, 32, 1, true), MAT.rubber(), tube, [0, -0.112, 0]);
  rig.focusKnob = driveKnob(A, [0.047, losY - 0.005, -0.035], 0.015, 0.014, 'focus'); rig.focusAxis = 'x';
  rig.hKnobs = [driveKnob(A, [0.046, 0.026, 0.05], 0.011, 0.012, 'hDrive'), driveKnob(A, [-0.046, 0.026, 0.05], 0.011, 0.012, 'hDrive', -1)];
  Object.assign(rig, circularLevel(A, [0, 0.09, 0.045], 0.013));
  mesh(rbox(0.02, 0.014, 0.012, 0.002), MAT.plastic(), A, [0, 0.1, 0.062], [-0.6, 0, 0], 'Zrcátko');
  mesh(rbox(0.007, 0.01, 0.05, 0.002), MAT.plastic(), A, [0, 0.095, -0.03], null, 'Muška');
  rig.objective = node(A, [0, losY, -0.125], 'objektiv');
  rig.eyepiece = node(A, [0, losY, 0.13], 'okulár');
  finishRig(rig);
  return rig;
}

function newInstrumentRig(model) {
  const rig = { model, root: new THREE.Group(), baseTilt: new THREE.Group(), leveling: new THREE.Group(), alidade: new THREE.Group() };
  rig.root.add(rig.baseTilt, rig.leveling);
  rig.leveling.add(rig.alidade);
  return rig;
}

function finishRig(rig) {
  rig.apply = (k) => applyInstrument(rig, k);
}

const _q = new THREE.Quaternion();
function tiltQuat(g) {
  const n = upForGradient(g);
  return _q.clone().setFromUnitVectors(UP, new THREE.Vector3(...n));
}

function applyInstrument(rig, k) {
  rig.baseTilt.quaternion.copy(tiltQuat(k.s.setupTilt));
  rig.leveling.position.y = rig.levelPivot + k.screwMean();
  rig.leveling.quaternion.copy(tiltQuat(k.totalTilt()));
  rig.alidade.rotation.y = k.s.alpha;
  if (rig.telescope) rig.telescope.rotation.x = k.s.eps;
  rig.screws.forEach((s, i) => { s.position.y = rig.screwRest + k.s.screwH[i]; s.rotation.y = -k.s.screwTurns[i] * Math.PI * 2; });
  rig.hKnobs.forEach((kn) => { kn.rotation.x = k.s.hKnob * Math.PI * 2; });
  if (rig.vKnob) rig.vKnob.rotation.x = k.s.vKnob * Math.PI * 2;
  if (rig.focusKnob) rig.focusKnob.rotation[rig.focusAxis] = k.s.focusKnob * Math.PI * 2;
  const o = k.bubbleOffset(!!rig.bubbleOnAlidade);
  rig.bubble.position.set(rig.rest.x + o[0], rig.rest.y, rig.rest.z + o[1]);
}

// ---------------------------------------------------------------------------------------
// Stativ

export function makeTripod(H = 1.25) {
  const root = new THREE.Group(); root.name = 'Stativ';
  const head = node(root, [0, H, 0], 'Hlava');
  const legAz = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
  mesh(roundedTriangle(0.105, 0.028, 0.024, legAz), MAT.anodized(), head, [0, -0.024, 0]);
  mesh(new THREE.TorusGeometry(0.04, 0.0015, 8, 48), MAT.steel(), head, [0, 0.0003, 0], [Math.PI / 2, 0, 0]);
  mesh(cyl(0.0079, 0.035), MAT.steel(), head, [0, -0.03, 0]);
  mesh(cyl(0.027, 0.018, 40), MAT.rubber(), head, [0, -0.055, 0]);
  const footR = 0.33 + 0.19 * H;
  for (const az of legAz) {
    const radial = new THREE.Vector3(Math.sin(az), 0, -Math.cos(az));
    const tangent = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const hinge = radial.clone().multiplyScalar(0.093).setY(H - 0.03);
    const foot = radial.clone().multiplyScalar(footR);
    const L = hinge.distanceTo(foot);
    const hg = mesh(cyl(0.011, 0.06), MAT.yellow(), root, hinge.clone().setY(H - 0.024).toArray());
    hg.quaternion.setFromUnitVectors(UP, tangent);
    const leg = node(root, hinge.toArray());
    const y = hinge.clone().sub(foot).normalize();
    const x = tangent.clone().sub(y.clone().multiplyScalar(tangent.dot(y))).normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    leg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    const Lu = L * 0.58;
    mesh(rbox(0.05, 0.036, 0.032, 0.004), MAT.yellow(), leg, [0, -0.012, 0]);
    for (const sd of [-1, 1]) mesh(rbox(0.026, Lu, 0.02, 0.004), MAT.wood(), leg, [sd * 0.021, -0.03 - Lu / 2, 0]);
    const cy = -0.03 - Lu + 0.02;
    mesh(rbox(0.072, 0.05, 0.033, 0.005), MAT.yellow(), leg, [0, cy, 0]);
    mesh(cyl(0.0055, 0.03), MAT.steel(), leg, [0, cy, 0.03], [Math.PI / 2, 0, 0]);
    mesh(rbox(0.034, 0.012, 0.005, 0.002), MAT.plastic(), leg, [0, cy, 0.046]);
    const top = -0.03 - Lu + 0.16, bot = -(L - 0.1);
    mesh(rbox(0.022, top - bot, 0.017, 0.003), MAT.wood(), leg, [0, (top + bot) / 2, 0]);
    mesh(rbox(0.028, 0.075, 0.022, 0.003), MAT.steel(), leg, [0, -(L - 0.0725), 0]);
    mesh(rbox(0.045, 0.005, 0.03, 0.001), MAT.steel(), leg, [0.03, -(L - 0.06), 0]);
    mesh(new THREE.ConeGeometry(0.011, 0.035, 16), MAT.steel(), leg, [0, -(L - 0.0175), 0], [Math.PI, 0, 0]);
  }
  part(root, 'tripod');
  return { root, head, height: H, apply: (g) => head.quaternion.copy(tiltQuat(g)) };
}

// ---------------------------------------------------------------------------------------
// GNSS rover

export function makeRover(model) {
  const pal = PALETTES[model.brand], s = model.spec;
  const root = new THREE.Group(); root.name = 'Rover';
  const pole = node(root, [0, 0, 0], 'Výtyčka');
  const L = s.pole;
  mesh(lathe([[0, 0], [0.0035, 0.01], [0.008, 0.035], [0.0125, 0.06], [0.0125, 0.075], [0, 0.075]]), MAT.steel(), pole);
  mesh(cyl(0.0125, L - 0.08, 24), MAT.carbon(), pole, [0, 0.075 + (L - 0.08) / 2, 0]);
  for (const y of [0.72, 1.42]) {
    mesh(cyl(0.0148, 0.032), MAT.anodized(), pole, [0, y, 0]);
    mesh(rbox(0.008, 0.026, 0.006, 0.002), MAT.coated(pal.accent), pole, [0.016, y, 0]);
  }
  mesh(cyl(0.0095, 0.018), MAT.steel(), pole, [0, L + 0.004, 0]);
  const clampH = 1.15;
  mesh(rbox(0.048, 0.05, 0.042, 0.008), MAT.anodized(), pole, [0, clampH, 0]);
  mesh(rbox(0.03, 0.01, 0.02, 0.002), MAT.anodized(), pole, [0.022, 1.52, 0]);
  const lvl = circularLevel(pole, [0.04, 1.525, 0], 0.012);
  mesh(rbox(0.014, 0.014, 0.09, 0.003), MAT.anodized(), pole, [0, 1.3, 0.05]);
  const tab = node(pole, [0, 1.33, 0.1], 'Tablet'); tab.rotation.x = -0.55;
  mesh(rbox(0.2, 0.13, 0.016, 0.01), MAT.coated(0x1f1f21, 0.6, 0.3), tab);
  const tablet = makeScreen(400, 256);
  mesh(new THREE.PlaneGeometry(0.18, 0.112), new THREE.MeshBasicMaterial({ map: tablet.texture, toneMapped: false }), tab, [0, 0, 0.0085]);

  const ant = node(pole, [0, L + 0.013, 0], 'Anténa');
  const r = s.antennaD / 2;
  mesh(lathe([[0, 0], [0.028, 0], [r * 0.8, 0.008], [r * 0.98, 0.02], [r, 0.036], [0, 0.036]], 64), MAT.coated(pal.body, 0.5, 0.5), ant);
  mesh(new THREE.CylinderGeometry(r + 0.0012, r + 0.0012, 0.006, 64, 1, true), MAT.coated(pal.accent, 0.4, 0.6), ant, [0, 0.031, 0]);
  const dome = new THREE.SphereGeometry(r * 0.985, 64, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, (s.antennaH - 0.036) / (r * 0.985), 1);
  mesh(dome, MAT.radome(), ant, [0, 0.036, 0]);
  const ledColors = [0x34c759, 0xffcc00, 0x34c759, 0x0a84ff];
  const leds = ledColors.map((c, i) => {
    const phi = -0.24 + i * 0.16;
    const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0 });
    return mesh(new THREE.SphereGeometry(0.0032, 10, 8), m, ant, [r * 0.93 * Math.sin(phi), 0.02, r * 0.93 * Math.cos(phi)]);
  });

  // Dvojnožka: patky pevně na zemi za výtyčkou, trubky se teleskopicky vysouvají.
  const upperLen = 0.85, lowerLen = 0.85;
  const legs = [-1, 1].map((sd) => {
    const foot = new THREE.Vector3(sd * 0.38, 0, -0.66);
    const upper = node(root); mesh(cyl(0.0095, upperLen, 16), MAT.anodized(), upper, [0, -upperLen / 2, 0]);
    mesh(rbox(0.026, 0.03, 0.026, 0.004), MAT.anodized(), upper, [0, -upperLen + 0.015, 0]);
    const lower = node(root); mesh(cyl(0.0072, lowerLen, 16), MAT.anodized(0x9ea1a6), lower, [0, lowerLen / 2, 0]);
    mesh(new THREE.ConeGeometry(0.012, 0.035, 12), MAT.rubber(), lower, [0, 0.0175, 0], [Math.PI, 0, 0]);
    return { upper, lower, foot };
  });
  part(pole, 'pole');
  const hit = mesh(new THREE.CylinderGeometry(0.04, 0.04, L, 8), MAT.unlit(0xffffff, 0), pole, [0, L / 2, 0]);
  hit.userData.hitProxy = true; hit.userData.part = 'pole';

  const rig = { model, root, pole, leds, tablet, bubble: lvl.bubble, rest: lvl.rest, antennaH: L + 0.013 };
  rig.apply = (dir) => {
    const d = new THREE.Vector3(...dir);
    pole.quaternion.setFromUnitVectors(UP, d);
    const clamp = d.clone().multiplyScalar(clampH);
    for (const leg of legs) {
      const axis = leg.foot.clone().sub(clamp).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(UP, axis.clone().negate());
      leg.upper.position.copy(clamp); leg.upper.quaternion.copy(q);
      leg.lower.position.copy(leg.foot); leg.lower.quaternion.copy(q);
    }
    // Bublina: horní konec výtyčky se naklání k h → bublina uteče na opačnou stranu.
    const h = Math.hypot(dir[0], dir[2]);
    const tilt = Math.acos(Math.min(1, dir[1]));
    const travel = Math.min(tilt / ((20 / 60) * (Math.PI / 180) / 0.002), 0.006);
    const off = h > 1e-9 ? [-dir[0] / h * travel, -dir[2] / h * travel] : [0, 0];
    lvl.bubble.position.set(lvl.rest.x + off[0], lvl.rest.y, lvl.rest.z + off[1]);
  };
  rig.apply([0, 1, 0]);
  return rig;
}

// ---------------------------------------------------------------------------------------
// Nivelační lať

export function makeRod(length = 3) {
  const root = new THREE.Group(); root.name = 'Lať';
  const sec = length / 3;
  for (let i = 0; i < 3; i++) {
    mesh(rbox(0.05 - i * 0.0025, sec, 0.022 - i * 0.0025, 0.002), MAT.anodized(0xc7c9cc), root, [0, sec * (i + 0.5), -i * 0.001]);
    if (i > 0) mesh(rbox(0.056, 0.03, 0.028, 0.003), MAT.plastic(), root, [0, sec * i, -0.001]);
  }
  const face = mesh(new THREE.PlaneGeometry(0.044, length), new THREE.MeshStandardMaterial({ map: rodTex(length), roughness: 0.55 }), root, [0, length / 2, 0.0115]);
  face.userData.rodFace = true;
  mesh(rbox(0.054, 0.006, 0.026, 0.001), MAT.steel(), root, [0, 0.003, 0]);
  mesh(rbox(0.012, 0.1, 0.03, 0.004), MAT.plastic(), root, [-0.031, 1.35, -0.01]);
  circularLevel(root, [0.036, 1.4, -0.01], 0.01);
  root.traverse((o) => { o.userData.target = 'rod'; o.userData.rodRoot = root; });
  return { root, length };
}

/** Odrazný hranol na výtyčce (cíl pro dálkoměr). */
export function makePrism() {
  const root = new THREE.Group(); root.name = 'Hranol';
  mesh(cyl(0.0125, 1.5, 16), MAT.carbon(), root, [0, 0.75, 0]);
  const holder = node(root, [0, 1.56, 0]);
  mesh(rbox(0.09, 0.09, 0.04, 0.01), MAT.coated(0xd91a1a, 0.4, 0.3), holder);
  mesh(cyl(0.032, 0.012, 32), MAT.glass(0xffe6a0), holder, [0, 0, 0.02], [Math.PI / 2, 0, 0]);
  mesh(new THREE.TorusGeometry(0.033, 0.003, 8, 32), MAT.plastic(0xffcc00), holder, [0, 0, 0.026]);
  root.traverse((o) => { o.userData.target = 'prism'; });
  return { root };
}

/** Kurzor pro umístění (kruh + olovnice). */
export function makeReticle() {
  const g = new THREE.Group();
  mesh(new THREE.TorusGeometry(0.13, 0.004, 6, 64), MAT.unlit(0x40d9ff, 0.95), g, [0, 0.002, 0], [Math.PI / 2, 0, 0]).castShadow = false;
  mesh(new THREE.CircleGeometry(0.125, 48), MAT.unlit(0x40d9ff, 0.15), g, [0, 0.001, 0], [-Math.PI / 2, 0, 0]).castShadow = false;
  mesh(cyl(0.0015, 1.25, 8), MAT.unlit(0xff3322, 0.6), g, [0, 0.625, 0]).castShadow = false;
  return g;
}

export { tiltRotate };
