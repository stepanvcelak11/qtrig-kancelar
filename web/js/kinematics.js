// Mechanický model přístroje (řešič vazeb).
//
//   stanovisko (svislé podle tíže)
//     └─ R_sklon   horní deska trojnožky = sklon hlavy stativu + rovina tří stavěcích šroubů
//         └─ R_y(α)   alhidáda (svislá osa)
//             └─ R_x(ε)   dalekohled (klopná osa) → záměra (0, 0, −1)
//
// Čtení:  Hz = norm(−α + c) (po směru hodin, c = orientace limbu),  V = norm(π/2 − ε).
// Dvouosý kompenzátor zobrazuje úhly SKUTEČNÉ (tíhově orientované) záměry – odpovídá
// opravám ΔV = −l a ΔHz = t·cotg Z, ale přesně pro libovolný sklon.

import { TAU, gon, arcmin, arcsec, norm, wrapPi, clamp, azimuth, zenith, planeGradient, upForGradient, deg } from './geodesy.js';

// --- malá vektorová algebra -----------------------------------------------------------
const rotY = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
const rotX = (v, a) => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Rotace, která překlopí +Y do n (Rodriguesova formule). */
export function tiltRotate(v, n) {
  const up = [0, 1, 0];
  const axis = cross(up, n);
  const s = Math.hypot(...axis);
  if (s < 1e-12) return v.slice();
  const k = axis.map((c) => c / s);
  const c = dot(up, n);
  const kv = cross(k, v);
  const kd = dot(k, v);
  return [0, 1, 2].map((i) => v[i] * c + kv[i] * s + k[i] * kd * (1 - c));
}

export const SCREW_AZ = [Math.PI, (Math.PI * 5) / 3, Math.PI / 3]; // vzadu, vpředu vlevo, vpředu vpravo

export function makeConfig(model) {
  const s = model.spec;
  const isLevel = model.kind === 'level';
  return {
    isLevel,
    classic: false,                               // svěrky + ustanovky s omezeným chodem
    allowsTilt: !isLevel,
    fineH: gon(s.fineGonPerTurn),                  // rad / otáčku
    fineV: isLevel ? 0 : gon(s.fineGonPerTurn),
    detent: gon(0.01),                             // cvaknutí po 0,01 gon
    resolution: arcsec(1),
    tangentTravel: gon(3),
    screwLead: 0.0005,                             // stoupání stavěcího šroubu 0,5 mm
    screwTravel: 0.005,
    screwRadius: isLevel ? 0.055 : 0.065,
    compensator: arcmin(s.compensator),
    circular: arcmin(s.circular) / 0.002,          // rad sklonu na metr pohybu bubliny
    vialRadius: 0.0055,
    focusMin: s.minFocus, focusMax: isLevel ? 500 : 2000, focusTurns: isLevel ? 2 : 1.5,
  };
}

export class Kinematics {
  constructor(config) {
    this.c = config;
    this.s = {
      alpha: 0, eps: 0, circle: 0,
      hClamp: false, vClamp: false, hzHold: false, comp: true,
      hTangent: 0, vTangent: 0, hAcc: 0, vAcc: 0, screwAcc: [0, 0, 0],
      screwH: [0, 0, 0], screwTurns: [0, 0, 0], hKnob: 0, vKnob: 0, focusKnob: 0,
      setupTilt: [0, 0], focus: 20,
    };
  }

  static randomSetupTilt() {
    const m = Math.tan(deg(0.3 + Math.random() * 0.9));
    const d = Math.random() * TAU;
    return [Math.cos(d) * m, Math.sin(d) * m];
  }

  screwPos(i) {
    const a = SCREW_AZ[i], R = this.c.screwRadius;
    return [R * Math.sin(a), -R * Math.cos(a)];
  }

  // --- alhidáda ---
  rotateAlidade(d) {
    if (this.c.classic && this.s.hClamp) return { blocked: true };
    this.#applyAlpha(d);
    return {};
  }
  turnH(turns) {
    const fb = {};
    this.s.hKnob += turns;
    let d = -turns * this.c.fineH;
    if (this.c.classic) {
      if (!this.s.hClamp) return { released: true };
      const t = clamp(this.s.hTangent + d, -this.c.tangentTravel, this.c.tangentTravel);
      if (t !== this.s.hTangent + d) fb.limit = true;
      d = t - this.s.hTangent;
      this.s.hTangent = t;
    }
    this.#applyAlpha(d);
    fb.ticks = this.#detents('hAcc', d, this.c.detent);
    return fb;
  }
  #applyAlpha(d) {
    this.s.alpha = wrapPi(this.s.alpha + d);
    // Limbus spojený s alhidádou (Hz hold): čtení se nesmí změnit → c se otáčí s ní.
    if (this.s.hzHold) this.s.circle = norm(this.s.circle + d);
  }

  // --- dalekohled ---
  pitch(d) {
    if (!this.c.allowsTilt) return {};
    if (this.c.classic && this.s.vClamp) return { blocked: true };
    this.s.eps = wrapPi(this.s.eps + d);
    return {};
  }
  turnV(turns) {
    if (!this.c.allowsTilt) return {};
    const fb = {};
    this.s.vKnob += turns;
    let d = turns * this.c.fineV;
    if (this.c.classic) {
      if (!this.s.vClamp) return { released: true };
      const t = clamp(this.s.vTangent + d, -this.c.tangentTravel, this.c.tangentTravel);
      if (t !== this.s.vTangent + d) fb.limit = true;
      d = t - this.s.vTangent;
      this.s.vTangent = t;
    }
    this.s.eps = wrapPi(this.s.eps + d);
    fb.ticks = this.#detents('vAcc', d, this.c.detent);
    return fb;
  }

  setHClamp(on) { this.s.hClamp = on; if (on) this.s.hTangent = 0; }
  setVClamp(on) { this.s.vClamp = on; if (on) this.s.vTangent = 0; }
  setHz(value) {
    const r = this.readings();
    const cur = r.hz ?? r.mechHz;
    this.s.circle = norm(this.s.circle + value - cur);
  }

  // --- stavěcí šrouby ---
  turnScrew(i, turns) {
    const fb = {};
    const before = this.levelState();
    const h = this.s.screwH[i];
    const t = clamp(h + turns * this.c.screwLead, -this.c.screwTravel, this.c.screwTravel);
    if (t !== h + turns * this.c.screwLead) fb.limit = true;
    const eff = (t - h) / this.c.screwLead;
    this.s.screwH[i] = t;
    this.s.screwTurns[i] += eff;
    const acc = this.s.screwAcc;
    const b = Math.floor(acc[i] * 16); acc[i] += eff; fb.ticks = Math.abs(Math.floor(acc[i] * 16) - b);
    const after = this.levelState();
    if (after !== before) fb.level = after;
    return fb;
  }

  // --- ostření (logaritmická stupnice) ---
  turnFocus(turns) {
    this.s.focusKnob += turns;
    const lo = Math.log(this.c.focusMin), hi = Math.log(this.c.focusMax);
    this.s.focus = Math.exp(clamp(Math.log(this.s.focus) + turns * (hi - lo) / this.c.focusTurns, lo, hi));
  }
  setFocus(d) { this.s.focus = clamp(d, this.c.focusMin, this.c.focusMax); }
  /** Rozostření jako rozdíl dioptrií |1/d − 1/f|. */
  defocus(d) { return Math.abs(1 / Math.max(d, this.c.focusMin) - 1 / this.s.focus); }

  #detents(key, d, step) {
    const b = Math.floor(this.s[key] / step);
    this.s[key] += d;
    return Math.abs(Math.floor(this.s[key] / step) - b);
  }

  // --- sklon ---
  screwGradient() {
    const p = [0, 1, 2].map((i) => { const [x, z] = this.screwPos(i); return [x, this.s.screwH[i], z]; });
    return planeGradient(p[0], p[1], p[2]);
  }
  screwMean() { return (this.s.screwH[0] + this.s.screwH[1] + this.s.screwH[2]) / 3; }
  totalTilt() { const g = this.screwGradient(); return [g[0] + this.s.setupTilt[0], g[1] + this.s.setupTilt[1]]; }
  tiltMagnitude() { return Math.atan(Math.hypot(...this.totalTilt())); }
  levelState() {
    const t = this.tiltMagnitude();
    if (t <= this.c.compensator * 0.25) return 'leveled';
    if (t <= this.c.compensator) return 'compensated';
    return 'out';
  }

  /** Posun bubliny krabicové libely [x, z] v metrech (bublina uteče k vyšší straně). */
  bubbleOffset(rotatesWithAlidade = false) {
    const g = this.totalTilt();
    const l = Math.hypot(...g);
    if (l < 1e-12) return [0, 0];
    let d = [g[0] / l, g[1] / l];
    if (rotatesWithAlidade) {
      const a = this.s.alpha, c = Math.cos(a), s = Math.sin(a);
      d = [d[0] * c - d[1] * s, d[0] * s + d[1] * c];
    }
    const travel = Math.min(Math.atan(l) / this.c.circular, this.c.vialRadius);
    return [d[0] * travel, d[1] * travel];
  }

  // --- záměra ---
  losPhysical() {
    const n = upForGradient(this.totalTilt());
    return tiltRotate(rotY(rotX([0, 0, -1], this.s.eps), this.s.alpha), n);
  }
  losMeasurement() {
    const los = this.losPhysical();
    if (!this.c.isLevel || !this.s.comp || this.levelState() === 'out') return los;
    const l = Math.hypot(los[0], los[2]);
    return [los[0] / l, 0, los[2] / l];
  }

  readings() {
    const a = this.s.alpha;
    const mechV = norm(Math.PI / 2 - this.s.eps);
    const mechHz = norm(-a + this.s.circle);
    const face = mechV > Math.PI ? 'II' : 'I';
    const g = this.totalTilt();
    const l = Math.atan(g[0] * -Math.sin(a) + g[1] * -Math.cos(a));
    const t = Math.atan(g[0] * Math.cos(a) + g[1] * -Math.sin(a));
    const state = this.levelState();
    let hz = mechHz, v = mechV;
    if (this.s.comp) {
      if (state === 'out') { hz = null; v = null; }
      else if (this.c.isLevel) {
        v = Math.PI / 2;
        hz = norm(azimuth(this.losPhysical()) + this.s.circle);
      } else {
        const los = this.losPhysical();
        const z = zenith(los);
        v = face === 'I' ? z : TAU - z;
        hz = norm(azimuth(los) - (face === 'II' ? Math.PI : 0) + this.s.circle);
      }
    }
    const q = (x) => (x == null ? null : Math.round(x / this.c.resolution) * this.c.resolution);
    return { hz: q(hz), v: q(v), mechHz, mechV, face, l, t, tilt: this.tiltMagnitude(), state, comp: this.s.comp };
  }
}
