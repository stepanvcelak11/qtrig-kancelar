// Geodetická matematika: jednotky, normalizace úhlů, směrník / zenitový úhel, sklon desky.
// Konvence (stejná jako v Three.js): +Y nahoru, přístroj míří po −Z,
// vodorovné směry (Hz, azimut) rostou VE SMĚRU HODINOVÝCH RUČIČEK při pohledu shora,
// zenitový úhel V se měří od +Y (0 = zenit, 100 gon = horizont).

export const TAU = Math.PI * 2;
export const gon = (v) => (v * Math.PI) / 200;
export const deg = (v) => (v * Math.PI) / 180;
export const arcmin = (v) => (v / 60) * (Math.PI / 180);
export const arcsec = (v) => (v / 3600) * (Math.PI / 180);
export const toGon = (r) => (r * 200) / Math.PI;
export const toDeg = (r) => (r * 180) / Math.PI;
export const toArcsec = (r) => (r * 648000) / Math.PI;

export function norm(a) {
  if (!Number.isFinite(a)) return 0;
  let r = a % TAU;
  if (r < 0) r += TAU;
  return r >= TAU ? 0 : r;
}

export function wrapPi(a) {
  const n = norm(a);
  return n > Math.PI ? n - TAU : n;
}

export const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/** Směrník vektoru [x,y,z] – po směru hodin od −Z. */
export const azimuth = (v) => norm(Math.atan2(v[0], -v[2]));

/** Zenitový úhel vektoru. */
export function zenith(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l < 1e-12 ? Math.PI / 2 : Math.acos(clamp(v[1] / l, -1, 1));
}

// Sklon desky je reprezentován GRADIENTEM výšky g = (∂h/∂x, ∂h/∂z):
// ukazuje k VYŠŠÍ straně (tam, kam uteče bublina) a |g| = tg(sklonu). Gradienty se sčítají.

/** Gradient roviny proložené třemi body [x,y,z]. */
export function planeGradient(p0, p1, p2) {
  const a = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const b = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  let n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  if (n[1] < 0) n = n.map((c) => -c);
  if (Math.abs(n[1]) < 1e-12) return [0, 0];
  return [-n[0] / n[1], -n[2] / n[1]];
}

/** Normála (svislá osa) desky s daným gradientem. */
export function upForGradient(g) {
  const v = [-g[0], 1, -g[1]];
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
}

export function formatAngle(a, unit = 'gon') {
  if (a == null || !Number.isFinite(a)) return unit === 'gon' ? '---.----' : '---°--\'--"';
  const n = norm(a);
  if (unit === 'gon') return toGon(n).toFixed(4);
  if (unit === 'deg') return toDeg(n).toFixed(4) + '°';
  const total = Math.round(toArcsec(n)) % 1296000;
  const d = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
}

export function formatSmall(a, unit = 'gon') {
  return unit === 'gon' ? `${(toGon(a) * 1000).toFixed(1)} mgon` : `${toArcsec(a).toFixed(0)}"`;
}

export const formatDist = (m) => (m == null || !Number.isFinite(m) ? '--.---' : m.toFixed(3));

/** Normální rozdělení (Box–Muller). */
export function gauss() {
  const u = Math.max(Math.random(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * Math.random());
}
