// Generátory výpočtových příkladů – pokaždé nová čísla.
// Každý vrací { t: 'n', q, a, tol, dec, unit, e } (číselná odpověď s tolerancí)
// nebo { t: 'rod', a, tol, dec, e } pro odečet na lati (kreslí ho UI).

import { FIELD } from './field.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const GON = Math.PI / 200;

/** Číslo s desetinnou čárkou a mezerami mezi tisíci. */
export function fmt(x, d = 3) {
  const [i, f] = Math.abs(x).toFixed(d).split('.');
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (x < 0 ? '−' : '') + grouped + (f ? ',' + f : '');
}

/** Směrník v gonech 0–400 ze souřadnicových rozdílů (od +X po směru hodin). */
export function bearingGon(dy, dx) {
  let s = Math.atan2(dy, dx) / GON;
  if (s < 0) s += 400;
  return s >= 400 ? 0 : s;
}

function point() {
  return { y: round(rnd(700000, 800000), 2), x: round(rnd(1000000, 1150000), 2) };
}
function offsetPoint(p, min = 25, max = 400) {
  const d = rnd(min, max), s = rnd(0, 400);
  return { y: round(p.y + d * Math.sin(s * GON), 2), x: round(p.x + d * Math.cos(s * GON), 2) };
}
const pt = (name, p) => `${name} [Y = ${fmt(p.y, 2)}; X = ${fmt(p.x, 2)}]`;

export const GEN = {
  gonToDeg() {
    const g = round(rnd(1, 399), 2);
    return { q: `Převeďte ${fmt(g, 2)} gon na stupně (desetinně).`, a: g * 0.9, tol: 0.0006, dec: 4, unit: '°',
      e: `1 gon = 0,9°, tedy ${fmt(g, 2)} · 0,9 = ${fmt(g * 0.9, 4)}°.` };
  },
  degToGon() {
    const d = round(rnd(1, 359), 2);
    return { q: `Převeďte ${fmt(d, 2)}° na gony.`, a: d / 0.9, tol: 0.0006, dec: 4, unit: 'gon',
      e: `gon = ° / 0,9 = ${fmt(d, 2)} / 0,9 = ${fmt(d / 0.9, 4)} gon.` };
  },
  dmsToDeg() {
    const d = rint(0, 359), m = rint(0, 59), s = rint(0, 59);
    const v = d + m / 60 + s / 3600;
    return { q: `Převeďte ${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″ na desetinné stupně.`, a: v, tol: 0.00006, dec: 5, unit: '°',
      e: `${d} + ${m}/60 + ${s}/3600 = ${fmt(v, 5)}°.` };
  },
  gonToRad() {
    const g = round(rnd(1, 399), 2);
    return { q: `Převeďte ${fmt(g, 2)} gon na radiány.`, a: g * GON, tol: 0.00006, dec: 5, unit: 'rad',
      e: `rad = gon · π / 200 = ${fmt(g * GON, 5)} rad.` };
  },
  scaleToReal() {
    const M = pick([500, 1000, 2000, 5000, 10000]), mm = round(rnd(5, 150), 1);
    const a = mm * M / 1000;
    return { q: `Na mapě 1 : ${fmt(M, 0)} jste odměřili ${fmt(mm, 1)} mm. Jaká je skutečná délka?`, a, tol: 0.011, dec: 2, unit: 'm',
      e: `${fmt(mm, 1)} mm · ${fmt(M, 0)} = ${fmt(mm * M, 0)} mm = ${fmt(a, 2)} m.` };
  },
  realToMap() {
    const M = pick([500, 1000, 2000, 5000, 10000]), d = round(rnd(10, 900), 1);
    const a = d * 1000 / M;
    return { q: `Skutečná délka ${fmt(d, 1)} m. Kolik milimetrů to je na mapě 1 : ${fmt(M, 0)}?`, a, tol: 0.06, dec: 1, unit: 'mm',
      e: `${fmt(d, 1)} m = ${fmt(d * 1000, 0)} mm; / ${fmt(M, 0)} = ${fmt(a, 1)} mm.` };
  },
  bearing() {
    const A = point(), B = offsetPoint(A);
    const dy = B.y - A.y, dx = B.x - A.x, s = bearingGon(dy, dx);
    return { q: `Vypočtěte směrník σ_AB.\n${pt('A', A)}\n${pt('B', B)}`, a: s, tol: 0.0015, dec: 4, unit: 'gon',
      e: `ΔY = ${fmt(dy, 2)}, ΔX = ${fmt(dx, 2)}; σ = arctg(ΔY/ΔX) s ohledem na kvadrant = ${fmt(s, 4)} gon.` };
  },
  distance() {
    const A = point(), B = offsetPoint(A);
    const dy = B.y - A.y, dx = B.x - A.x, d = Math.hypot(dy, dx);
    return { q: `Vypočtěte délku d_AB.\n${pt('A', A)}\n${pt('B', B)}`, a: d, tol: 0.006, dec: 2, unit: 'm',
      e: `d = √(ΔY² + ΔX²) = √(${fmt(dy, 2)}² + ${fmt(dx, 2)}²) = ${fmt(d, 2)} m.` };
  },
  polarY() { return polar('Y'); },
  polarX() { return polar('X'); },
  angleDiff() {
    const l = round(rnd(0, 399.9999), 4), r = round(rnd(0, 399.9999), 4);
    let a = r - l; if (a < 0) a += 400;
    return { q: `Čtení na levý cíl ${fmt(l, 4)} gon, na pravý cíl ${fmt(r, 4)} gon. Jaký je vodorovný úhel?`, a, tol: 0.00015, dec: 4, unit: 'gon',
      e: `ω = pravý − levý${r - l < 0 ? ' + 400' : ''} = ${fmt(a, 4)} gon.` };
  },
  hdFromSd() {
    const s = round(rnd(10, 400), 3), z = round(rnd(85, 115), 4);
    const d = s * Math.sin(z * GON);
    return { q: `Šikmá délka s = ${fmt(s, 3)} m, zenitový úhel z = ${fmt(z, 4)} gon. Vypočtěte vodorovnou délku.`, a: d, tol: 0.0025, dec: 3, unit: 'm',
      e: `d = s · sin z = ${fmt(d, 3)} m.` };
  },
  ppmError() {
    const a = pick([1, 1.5, 2, 3]), b = pick([1, 1.5, 2, 3]), d = rint(100, 3000);
    const v = a + b * d / 1000;
    return { q: `Dálkoměr má přesnost ${fmt(a, 1)} mm + ${fmt(b, 1)} ppm. Jaká je střední chyba délky ${fmt(d, 0)} m?`, a: v, tol: 0.011, dec: 2, unit: 'mm',
      e: `${fmt(a, 1)} + ${fmt(b, 1)} · ${fmt(d / 1000, 3)} km = ${fmt(v, 2)} mm.` };
  },
  trigHeight() {
    const s = round(rnd(20, 300), 3), z = round(rnd(92, 108), 4), vp = round(rnd(1.4, 1.7), 3), vc = round(rnd(1.3, 2.1), 3);
    const dh = s * Math.cos(z * GON) + vp - vc;
    return { q: `s = ${fmt(s, 3)} m, z = ${fmt(z, 4)} gon, výška přístroje ${fmt(vp, 3)} m, výška cíle ${fmt(vc, 3)} m. Vypočtěte převýšení Δh.`,
      a: dh, tol: 0.003, dec: 3, unit: 'm', e: `Δh = s · cos z + v_p − v_c = ${fmt(dh, 3)} m.` };
  },
  levelDiff() {
    const z = round(rnd(0.5, 2.9), 3), p = round(rnd(0.5, 2.9), 3);
    return { q: `Čtení vzad ${fmt(z, 3)} m, čtení vpřed ${fmt(p, 3)} m. Jaké je převýšení Δh?`, a: z - p, tol: 0.0005, dec: 3, unit: 'm',
      e: `Δh = vzad − vpřed = ${fmt(z, 3)} − ${fmt(p, 3)} = ${fmt(z - p, 3)} m.` };
  },
  levelHeight() {
    const H = round(rnd(200, 600), 3), z = round(rnd(0.5, 2.9), 3), p = round(rnd(0.5, 2.9), 3);
    const HB = H + z - p;
    return { q: `Bod A má výšku ${fmt(H, 3)} m. Vzad na A: ${fmt(z, 3)} m, vpřed na B: ${fmt(p, 3)} m. Jaká je výška bodu B?`, a: HB, tol: 0.0005, dec: 3, unit: 'm',
      e: `H_B = H_A + vzad − vpřed = ${fmt(HB, 3)} m.` };
  },
  levelClosure() {
    const n = rint(3, 4);
    const HZ = round(rnd(250, 450), 3);
    const trueDh = Array.from({ length: n }, () => round(rnd(-1.5, 1.5), 3));
    const HK = round(HZ + trueDh.reduce((s, x) => s + x, 0), 3);
    const meas = trueDh.map((x) => round(x + rint(-4, 4) / 1000, 3));
    const u = (meas.reduce((s, x) => s + x, 0) - (HK - HZ)) * 1000;
    return { q: `Pořad z bodu Z (H = ${fmt(HZ, 3)} m) na K (H = ${fmt(HK, 3)} m). Naměřená převýšení: ${meas.map((x) => fmt(x, 3)).join('; ')} m. Jaký je uzávěr v mm?`,
      a: u, tol: 0.6, dec: 0, unit: 'mm', e: `u = ΣΔh − (H_K − H_Z) = ${fmt(u, 0)} mm.` };
  },
  levelLimit() {
    const R = round(rnd(0.3, 4), 1), a = 40 * Math.sqrt(R);
    return { q: `Jaká je mezní odchylka technické nivelace pro pořad délky ${fmt(R, 1)} km?`, a, tol: 0.2, dec: 1, unit: 'mm',
      e: `40 mm · √${fmt(R, 1)} = ${fmt(a, 1)} mm.` };
  },
  stadia() {
    const lower = round(rnd(0.4, 1.8), 3), D = round(rnd(10, 90), 1), upper = round(lower + D / 100, 3);
    const a = 100 * (upper - lower);
    return { q: `Horní ryska ${fmt(upper, 3)} m, dolní ryska ${fmt(lower, 3)} m. Jaká je vodorovná vzdálenost k lati?`, a, tol: 0.06, dec: 1, unit: 'm',
      e: `D = 100 · (${fmt(upper, 3)} − ${fmt(lower, 3)}) = ${fmt(a, 1)} m.` };
  },
  horizonHeight() {
    const H = round(rnd(200, 500), 3), z = round(rnd(0.8, 2.5), 3), c = round(rnd(0.5, 3.0), 3);
    const HB = H + z - c;
    return { q: `Výška bodu A je ${fmt(H, 3)} m, čtení vzad na A ${fmt(z, 3)} m. Na bodě B čtete ${fmt(c, 3)} m. Jaká je výška B?`, a: HB, tol: 0.0005, dec: 3, unit: 'm',
      e: `H_i = ${fmt(H + z, 3)} m; H_B = H_i − ${fmt(c, 3)} = ${fmt(HB, 3)} m.` };
  },
  slopePercent() {
    const d = round(rnd(20, 200), 1), dh = round(rnd(0.5, 20), 2), a = dh / d * 100;
    return { q: `Převýšení ${fmt(dh, 2)} m na vodorovné vzdálenosti ${fmt(d, 1)} m. Jaký je sklon v procentech?`, a, tol: 0.011, dec: 2, unit: '%',
      e: `sklon = Δh / d · 100 = ${fmt(a, 2)} %.` };
  },
  areaTriangle() { return area(3); },
  areaQuad() { return area(4); },
  meanValue() {
    const base = round(rnd(20, 200), 3);
    const vals = Array.from({ length: rint(4, 5) }, () => round(base + rint(-8, 8) / 1000, 3));
    const a = vals.reduce((s, x) => s + x, 0) / vals.length;
    return { q: `Délka byla změřena ${vals.length}×: ${vals.map((x) => fmt(x, 3)).join('; ')} m. Jaký je aritmetický průměr?`, a, tol: 0.0006, dec: 3, unit: 'm',
      e: `x̄ = Σx / n = ${fmt(a, 4)} m.` };
  },
  meanError() {
    const m = pick([2, 3, 4, 5, 6, 8, 10]), n = pick([2, 3, 4, 5, 6, 8, 9, 16]);
    const a = m / Math.sqrt(n);
    return { q: `Střední chyba jednoho měření je ${m} mm. Jaká je střední chyba průměru z ${n} měření?`, a, tol: 0.011, dec: 2, unit: 'mm',
      e: `m_x̄ = m / √n = ${m} / √${n} = ${fmt(a, 2)} mm.` };
  },
  errorPropagation() {
    const m1 = pick([2, 3, 4, 5, 6]), m2 = pick([2, 3, 4, 5, 8]);
    const a = Math.hypot(m1, m2);
    return { q: `Délka je součtem dvou úseků se středními chybami ${m1} mm a ${m2} mm. Jaká je střední chyba celkové délky?`, a, tol: 0.011, dec: 2, unit: 'mm',
      e: `m = √(${m1}² + ${m2}²) = ${fmt(a, 2)} mm.` };
  },
  polygonAngleSum() {
    const n = rint(4, 10);
    return { q: `Jaký je součet vnitřních úhlů uzavřeného polygonu s ${n} vrcholy?`, a: (n - 2) * 200, tol: 0.001, dec: 0, unit: 'gon',
      e: `(n − 2) · 200 = (${n} − 2) · 200 = ${(n - 2) * 200} gon.` };
  },
  arcLength() {
    const R = rint(50, 800), al = round(rnd(5, 80), 4), a = R * al * GON;
    return { q: `Kružnicový oblouk: R = ${R} m, středový úhel ${fmt(al, 4)} gon. Jaká je délka oblouku?`, a, tol: 0.011, dec: 2, unit: 'm',
      e: `o = R · α(rad) = ${R} · ${fmt(al * GON, 6)} = ${fmt(a, 2)} m.` };
  },
  // --- Vysokoškolské výpočty ---
  weightedMean() {
    const base = round(rnd(50, 400), 3), n = rint(3, 4);
    const vals = Array.from({ length: n }, () => round(base + rint(-9, 9) / 1000, 3));
    const w = Array.from({ length: n }, () => rint(1, 4));
    const a = vals.reduce((s, x, i) => s + x * w[i], 0) / w.reduce((s, x) => s + x, 0);
    return { q: `Délka změřena s různou přesností:\n${vals.map((x, i) => `${fmt(x, 3)} m (váha p = ${w[i]})`).join('\n')}\nVypočtěte vážený průměr.`, a, tol: 0.0006, dec: 3, unit: 'm',
      e: `x̄ = Σ(p·x) / Σp = ${fmt(a, 4)} m.` };
  },
  unitWeightError() {
    const vv = round(rnd(4, 120), 1), n = rint(8, 30), k = rint(2, Math.min(6, n - 2));
    const a = Math.sqrt(vv / (n - k));
    return { q: `Po vyrovnání MNČ je [vv] = ${fmt(vv, 1)} mm², počet měření n = ${n}, počet neznámých k = ${k}. Jaká je aposteriorní jednotková střední chyba m₀?`, a, tol: 0.011, dec: 2, unit: 'mm',
      e: `m₀ = √([vv] / (n − k)) = √(${fmt(vv, 1)} / ${n - k}) = ${fmt(a, 2)} mm.` };
  },
  curvRefraction() {
    const d = rint(200, 3000), k = 0.13, R = 6381000;
    const a = (1 - k) * d * d / (2 * R) * 1000;
    return { q: `Jaká je oprava ze zakřivení Země a refrakce pro vodorovnou délku ${fmt(d, 0)} m? (k = 0,13; R = 6 381 km)`, a, tol: 0.6, dec: 0, unit: 'mm',
      e: `Δ = (1 − k) · d² / (2R) = 0,87 · ${fmt(d, 0)}² / 12 762 000 m = ${fmt(a, 0)} mm.` };
  },
  ellipsoidalHeight() {
    const H = round(rnd(150, 900), 3), N = round(rnd(43, 47), 3), h = H + N;
    return { q: `Normální výška bodu H = ${fmt(H, 3)} m, výšková anomálie (kvazigeoid nad elipsoidem) ζ = ${fmt(N, 3)} m. Jaká je elipsoidická výška h?`, a: h, tol: 0.0006, dec: 3, unit: 'm',
      e: `h = H + ζ = ${fmt(H, 3)} + ${fmt(N, 3)} = ${fmt(h, 3)} m.` };
  },
  normalHeight() {
    const h = round(rnd(200, 950), 3), N = round(rnd(43, 47), 3), H = h - N;
    return { q: `GNSS určilo elipsoidickou výšku h = ${fmt(h, 3)} m. Výšková anomálie ζ = ${fmt(N, 3)} m. Jaká je normální výška H (Bpv)?`, a: H, tol: 0.0006, dec: 3, unit: 'm',
      e: `H = h − ζ = ${fmt(h, 3)} − ${fmt(N, 3)} = ${fmt(H, 3)} m.` };
  },
  photoScale() {
    const c = pick([35, 50, 100, 120, 150]), h = rint(80, 3000);
    const a = h / (c / 1000);
    return { q: `Kamera s konstantou c = ${c} mm snímkuje z výšky ${fmt(h, 0)} m nad terénem. Jaké je měřítkové číslo snímku m_s?`, a, tol: 1.1, dec: 0, unit: '',
      e: `m_s = h / c = ${fmt(h, 0)} m / ${fmt(c / 1000, 3)} m = ${fmt(a, 0)}.` };
  },
  gsd() {
    const px = pick([2.4, 3.3, 3.9, 4.4, 6]), c = pick([8.8, 10.3, 12.3, 24, 35]), h = rint(40, 200);
    const a = px / 1000 * h / c * 100;
    return { q: `Dron: velikost pixelu ${fmt(px, 1)} µm, ohnisková vzdálenost ${fmt(c, 1)} mm, výška letu ${h} m. Jaké je GSD (velikost pixelu na zemi)?`, a, tol: 0.011, dec: 2, unit: 'cm',
      e: `GSD = pixel · h / c = ${fmt(px, 1)} µm · ${h} m / ${fmt(c, 1)} mm = ${fmt(a, 2)} cm.` };
  },
  photoBase() {
    const side = pick([23, 18, 12]), m = pick([5000, 8000, 10000, 15000]), p = pick([60, 65, 70, 80]);
    const a = side / 100 * m * (1 - p / 100);
    return { q: `Formát snímku ${side} cm, měřítko 1 : ${fmt(m, 0)}, podélný překryt ${p} %. Jaká je základna B mezi středy snímků?`, a, tol: 0.6, dec: 0, unit: 'm',
      e: `B = s · m · (1 − p) = ${fmt(side / 100, 2)} m · ${fmt(m, 0)} · ${fmt(1 - p / 100, 2)} = ${fmt(a, 0)} m.` };
  },
  sphericalExcess() {
    const P = rint(50, 2500), R = 6380;
    const a = P / (R * R) * 206264.806;
    return { q: `Sférický trojúhelník má plochu ${fmt(P, 0)} km². Jaký je sférický exces ε? (R = 6 380 km)`, a, tol: 0.011, dec: 2, unit: '″',
      e: `ε = P / R² · ρ″ = ${fmt(P, 0)} / 6 380² · 206 265″ = ${fmt(a, 2)}″.` };
  },
  radiusM() {
    const phi = round(rnd(35, 65), 2), A = 6378137, e2 = 0.00669438;
    const sn = Math.sin(phi * Math.PI / 180), a = A * (1 - e2) / Math.pow(1 - e2 * sn * sn, 1.5) / 1000;
    return { q: `Elipsoid GRS80 (a = 6 378 137 m, e² = 0,006 694 38). Vypočtěte meridiánový poloměr křivosti M pro φ = ${fmt(phi, 2)}°.`, a, tol: 0.011, dec: 2, unit: 'km',
      e: `M = a(1 − e²) / (1 − e² sin²φ)^(3/2) = ${fmt(a, 2)} km.` };
  },
  radiusN() {
    const phi = round(rnd(35, 65), 2), A = 6378137, e2 = 0.00669438;
    const sn = Math.sin(phi * Math.PI / 180), a = A / Math.sqrt(1 - e2 * sn * sn) / 1000;
    return { q: `Elipsoid GRS80 (a = 6 378 137 m, e² = 0,006 694 38). Vypočtěte příčný poloměr křivosti N pro φ = ${fmt(phi, 2)}°.`, a, tol: 0.011, dec: 2, unit: 'km',
      e: `N = a / √(1 − e² sin²φ) = ${fmt(a, 2)} km.` };
  },
  baseline3d() {
    const d = [rnd(-9000, 9000), rnd(-9000, 9000), rnd(-9000, 9000)].map((x) => round(x, 3));
    const a = Math.hypot(...d);
    return { q: `GNSS vektor v ECEF: ΔX = ${fmt(d[0], 3)} m, ΔY = ${fmt(d[1], 3)} m, ΔZ = ${fmt(d[2], 3)} m. Jaká je délka základny?`, a, tol: 0.0011, dec: 3, unit: 'm',
      e: `s = √(ΔX² + ΔY² + ΔZ²) = ${fmt(a, 3)} m.` };
  },
  rod() {
    const a = round(rnd(0.35, 2.85), 3);
    return { t: 'rod', a, tol: 0.003, dec: 3, unit: 'm',
      e: `Správné čtení je ${fmt(a, 3)} m. Číslo na lati udává decimetry, dílky jsou centimetry a milimetry se odhadují.` };
  },
};

function polar(axis) {
  const A = point(), s = round(rnd(0, 399.9999), 4), d = round(rnd(15, 350), 3);
  const Y = A.y + d * Math.sin(s * GON), X = A.x + d * Math.cos(s * GON);
  return axis === 'Y'
    ? { q: `Polární metoda: ${pt('A', A)}, směrník σ = ${fmt(s, 4)} gon, délka d = ${fmt(d, 3)} m. Vypočtěte souřadnici Y bodu P.`, a: Y, tol: 0.011, dec: 2, unit: 'm',
      e: `Y_P = Y_A + d · sin σ = ${fmt(Y, 2)} m.` }
    : { q: `Polární metoda: ${pt('A', A)}, směrník σ = ${fmt(s, 4)} gon, délka d = ${fmt(d, 3)} m. Vypočtěte souřadnici X bodu P.`, a: X, tol: 0.011, dec: 2, unit: 'm',
      e: `X_P = X_A + d · cos σ = ${fmt(X, 2)} m.` };
}

/** Plocha n-úhelníku (konvexního) L'Huilierovým vzorcem. */
export function polygonArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i - 1 + pts.length) % pts.length], next = pts[(i + 1) % pts.length];
    s += pts[i].x * (next.y - prev.y);
  }
  return Math.abs(s) / 2;
}

function area(n) {
  // Body na kružnici se vzestupnými úhly → konvexní mnohoúhelník.
  const c = { y: rint(100, 900), x: rint(100, 900) };
  const angles = Array.from({ length: n }, (_, i) => (i / n) * 400 + rnd(-15, 15)).sort((a, b) => a - b);
  const pts = angles.map((g) => ({ y: round(c.y + rnd(20, 60) * Math.sin(g * GON), 2), x: round(c.x + rnd(20, 60) * Math.cos(g * GON), 2) }));
  const a = polygonArea(pts);
  const names = ['1', '2', '3', '4'];
  return { q: `Vypočtěte výměru ${n === 3 ? 'trojúhelníku' : 'čtyřúhelníku'} ze souřadnic (m):\n${pts.map((p, i) => `${names[i]} [Y = ${fmt(p.y, 2)}; X = ${fmt(p.x, 2)}]`).join('\n')}`,
    a, tol: 0.06, dec: 1, unit: 'm²', e: `2P = Σ X_i (Y_i+1 − Y_i−1) → P = ${fmt(a, 2)} m².` };
}

/** Vytvoří cvičení z generátoru. */
export function generate(name) {
  const g = GEN[name] ?? FIELD[name];
  if (!g) throw new Error(`Neznámý generátor ${name}`);
  const ex = g();
  return { t: 'n', ...ex, gen: name };
}
