// Terénní praxe: generování situací a hodnocení praktických úloh (bez DOM – testovatelné v Node).
//
// Scéna je výřez terénu W × H metrů. Souřadnice obrazovky: x doprava (východ), y dolů (jih),
// směrník σ se měří od severu (nahoru) po směru hodinových ručiček, stejně jako v geodézii.

export const W = 100, H = 64;

const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const GON = Math.PI / 200;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// --- Geometrie překážek -------------------------------------------------------------------

/** Protíná úsečka p→q obdélník r (Liang–Barsky)? */
function segHitsRect(p, q, r) {
  let t0 = 0, t1 = 1;
  const dx = q.x - p.x, dy = q.y - p.y;
  const checks = [[-dx, p.x - r.x], [dx, r.x + r.w - p.x], [-dy, p.y - r.y], [dy, r.y + r.h - p.y]];
  for (const [pp, qq] of checks) {
    if (pp === 0) { if (qq < 0) return false; continue; }
    const t = qq / pp;
    if (pp < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return t0 < t1;
}

/** Vzdálenost bodu c od úsečky p→q. */
function segDist(p, q, c) {
  const dx = q.x - p.x, dy = q.y - p.y, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((c.x - p.x) * dx + (c.y - p.y) * dy) / l2)) : 0;
  return Math.hypot(p.x + t * dx - c.x, p.y + t * dy - c.y);
}

export function sightClear(scene, p, q) {
  for (const b of scene.buildings) if (segHitsRect(p, q, b)) return false;
  for (const t of scene.trees) if (segDist(p, q, t) < t.r) return false;
  return true;
}

export function blocked(scene, p) {
  if (p.x < 1 || p.y < 1 || p.x > W - 1 || p.y > H - 1) return true;
  for (const b of scene.buildings) if (p.x > b.x - 1 && p.x < b.x + b.w + 1 && p.y > b.y - 1 && p.y < b.y + b.h + 1) return true;
  for (const t of scene.trees) if (dist(p, t) < t.r + 0.8) return true;
  return false;
}

function makeScene({ buildings = [2, 3], trees = [2, 4] } = {}) {
  const scene = { buildings: [], trees: [] };
  const nb = rint(...buildings);
  for (let k = 0; k < 60 && scene.buildings.length < nb; k++) {
    const w = rint(12, 24), h = rint(8, 15);
    const b = { x: rint(6, W - 6 - w), y: rint(5, H - 5 - h), w, h };
    if (scene.buildings.some((o) => b.x < o.x + o.w + 8 && b.x + b.w + 8 > o.x && b.y < o.y + o.h + 8 && b.y + b.h + 8 > o.y)) continue;
    scene.buildings.push(b);
  }
  const nt = rint(...trees);
  for (let k = 0; k < 80 && scene.trees.length < nt; k++) {
    const t = { x: round(rnd(4, W - 4), 1), y: round(rnd(4, H - 4), 1), r: round(rnd(1.8, 3.2), 1) };
    if (blocked(scene, t) || scene.trees.some((o) => dist(o, t) < 8)) continue;
    scene.trees.push(t);
  }
  return scene;
}

/** Mřížka splnitelných míst (pro vykreslení po kontrole a pro ověření řešitelnosti). */
function feasibleGrid(test, step = 2) {
  const cells = [];
  let total = 0;
  for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) { total++; if (test({ x, y })) cells.push({ x, y }); }
  return { cells, frac: cells.length / total };
}

// --- 1) Výběr stanoviska: zaměřit všechny body z jednoho místa ----------------------------

const TARGET_NAMES = ['roh domu', 'roh domu', 'šachta', 'hydrant', 'sloup VO', 'hraniční znak'];

export function checkStation(ex, p) {
  const s = ex.scene;
  if (blocked(s, p)) return { ok: false, reason: 'Na tomhle místě stativ nepostavíš – je tam překážka.', rays: [] };
  const rays = ex.targets.map((t) => {
    const d = dist(p, t);
    const clear = sightClear(s, p, t);
    return { to: t, ok: clear && d <= ex.range && d >= 3, clear, d };
  });
  const bad = rays.filter((r) => !r.ok);
  let reason = '';
  if (bad.some((r) => !r.clear)) reason = `Na ${bad.filter((r) => !r.clear).map((r) => r.to.n).join(', ')} není vidět – záměru blokuje překážka.`;
  else if (bad.length) reason = `Bod ${bad.map((r) => r.to.n).join(', ')} je mimo dosah ${ex.range} m (nebo příliš blízko).`;
  return { ok: bad.length === 0, reason, rays };
}

function station() {
  for (let tries = 0; tries < 300; tries++) {
    const scene = makeScene();
    const targets = [];
    // Rohy budov (mírně odsazené ven) + volné body (šachta, hydrant…).
    for (const b of scene.buildings.slice(0, 2)) {
      const cx = pick([0, 1]), cy = pick([0, 1]);
      targets.push({ x: round(b.x + cx * b.w + (cx ? 0.6 : -0.6), 1), y: round(b.y + cy * b.h + (cy ? 0.6 : -0.6), 1), kind: 'roh domu' });
    }
    while (targets.length < 4) {
      const t = { x: round(rnd(5, W - 5), 1), y: round(rnd(5, H - 5), 1), kind: pick(TARGET_NAMES.slice(2)) };
      if (blocked(scene, t) || targets.some((o) => dist(o, t) < 15)) continue;
      targets.push(t);
    }
    targets.forEach((t, i) => { t.n = String(i + 1); });
    const ex = { t: 'station', scene, targets, range: pick([50, 60, 70]) };
    const grid = feasibleGrid((p) => checkStation(ex, p).ok);
    if (grid.frac < 0.02 || grid.frac > 0.3) continue;
    ex.sol = pick(grid.cells);
    ex.e = 'Stanovisko volíme tak, aby z něj byly vidět všechny měřené body (žádná budova ani strom v záměře), byly v dosahu dálkoměru a stativ stál na pevném místě. Zeleně jsou všechna vyhovující místa.';
    return ex;
  }
  throw new Error('Nepodařilo se vygenerovat stanovisko');
}

// --- 2) Nivelace ze středu: postavit přístroj mezi dvě latě -------------------------------

export function checkLevelSetup(ex, p) {
  const s = ex.scene;
  if (blocked(s, p)) return { ok: false, reason: 'Tady přístroj nepostavíš – je tam překážka.', rays: [] };
  const rays = [ex.A, ex.B].map((t) => ({ to: t, d: dist(p, t), clear: sightClear(s, p, t) }));
  rays.forEach((r) => { r.ok = r.clear && r.d <= ex.maxSight && r.d >= 3; });
  const diff = Math.abs(rays[0].d - rays[1].d);
  let reason = '';
  if (rays.some((r) => !r.clear)) reason = 'Na jednu z latí není vidět.';
  else if (rays.some((r) => r.d > ex.maxSight)) reason = `Záměra je delší než ${ex.maxSight} m.`;
  else if (diff > ex.maxDiff) reason = `Záměry vzad a vpřed se liší o ${diff.toFixed(1).replace('.', ',')} m – přístroj má stát uprostřed (max. rozdíl ${ex.maxDiff} m).`;
  return { ok: !reason, reason, rays, diff };
}

function levelSetup() {
  for (let tries = 0; tries < 300; tries++) {
    const scene = makeScene({ buildings: [0, 2], trees: [2, 5] });
    const A = { x: round(rnd(6, 30), 1), y: round(rnd(8, H - 8), 1), n: 'A' };
    const len = rnd(40, 80), ang = rnd(-0.5, 0.5);
    const B = { x: round(A.x + len * Math.cos(ang), 1), y: round(A.y + len * Math.sin(ang), 1), n: 'B' };
    if (B.x > W - 5 || B.y < 5 || B.y > H - 5 || blocked(scene, A) || blocked(scene, B)) continue;
    // Občas strom přímo uprostřed – přístroj nemusí stát na spojnici!
    if (Math.random() < 0.5) scene.trees.push({ x: round((A.x + B.x) / 2, 1), y: round((A.y + B.y) / 2, 1), r: 2.6 });
    const ex = { t: 'levelSetup', scene, A, B, maxSight: 50, maxDiff: 2 };
    const grid = feasibleGrid((p) => checkLevelSetup(ex, p).ok, 1);
    if (grid.frac < 0.004) continue;
    ex.sol = pick(grid.cells);
    ex.e = 'Nivelace ze středu: přístroj stojí stejně daleko od obou latí, takže se vyloučí chyba ze sklonu záměrné přímky, zakřivení Země i část refrakce. Nemusí stát na spojnici latí – stačí stejné délky záměr.';
    return ex;
  }
  throw new Error('Nepodařilo se vygenerovat nivelaci');
}

// --- 3) Vytyčení polární metodou: klepnout, kam figurant postaví hranol ------------------

export function checkStakeout(ex, p) {
  const d = dist(p, ex.P);
  return { ok: d <= ex.tolM, d, reason: d <= ex.tolM ? '' : `Tvůj bod je od správného ${d.toFixed(1).replace('.', ',')} m.` };
}

function stakeout() {
  for (;;) {
    const S = { x: round(rnd(30, 70), 1), y: round(rnd(22, 42), 1), n: 'S' };
    const sO = rnd(0, 400), dO = rnd(22, 30);
    const O = { x: round(S.x + dO * Math.sin(sO * GON), 1), y: round(S.y - dO * Math.cos(sO * GON), 1), n: 'O' };
    const omega = round(rnd(15, 385), 2), d = round(rnd(14, 30), 2);
    const sP = (Math.atan2(O.x - S.x, -(O.y - S.y)) / GON) + omega;
    const P = { x: S.x + d * Math.sin(sP * GON), y: S.y - d * Math.cos(sP * GON) };
    if ([O, P].some((q) => q.x < 4 || q.x > W - 4 || q.y < 4 || q.y > H - 4)) continue;
    if (dist(O, P) < 8) continue;
    return { t: 'stakeout', S, O, P, omega, d, tolM: 2.5,
      e: `Na stanovisku S zacílíš na orientační bod O a nastavíš 0. Pak otočíš alhidádu o ω = ${omega.toFixed(2).replace('.', ',')} gon po směru hodinových ručiček a figurant hledá hranolem místo ve vzdálenosti d.` };
  }
}

// --- 4) Urovnání krabicové libely stavěcími šrouby ----------------------------------------

// Šrouby: nahoře, vpravo dole, vlevo dole (úhel na obrazovce, 0 = doprava, kladně dolů).
export const SCREWS = [-90, 30, 150].map((deg) => ({ ux: Math.cos(deg * Math.PI / 180), uy: Math.sin(deg * Math.PI / 180) }));

/** Zvednutí šroubu i o jeden krok (dir = +1 nahoru, −1 dolů): bublina putuje k nejvyššímu místu. */
export function turnScrew(b, i, dir, step) {
  return { x: b.x + dir * step * SCREWS[i].ux, y: b.y + dir * step * SCREWS[i].uy };
}

export function checkBubble(ex, b) {
  const r = Math.hypot(b.x, b.y);
  return { ok: r <= ex.okR, r, reason: r <= ex.okR ? '' : 'Bublina ještě není v kroužku.' };
}

function bubble() {
  const m = rnd(0.55, 0.85), a = rnd(0, Math.PI * 2);
  return { t: 'bubble', b0: { x: m * Math.cos(a), y: m * Math.sin(a) }, step: 0.14, okR: 0.1,
    e: 'Bublina libely putuje vždy k nejvyššímu místu. Zvedni šroub na straně, kam má bublina jít, nebo sniž šroub na straně, odkud má odejít. U alhidádové libely pak platí pravidlo levého palce.' };
}

// --- 5) Nivelační zápisník ----------------------------------------------------------------

export function checkFieldbook(ex, values) {
  const parse = (t) => Number(String(t ?? '').trim().replace(/\s/g, '').replace(/[−–]/g, '-').replace(',', '.'));
  const cells = ex.a.map((v, i) => { const x = parse(values?.[i]); return Number.isFinite(x) && String(values?.[i] ?? '').trim() !== '' && Math.abs(x - v) <= 0.0005; });
  return { ok: cells.every(Boolean), cells, reason: cells.every(Boolean) ? '' : 'Některá pole nesedí – správné hodnoty jsou doplněny.' };
}

function fieldbook() {
  const n = rint(3, 4), HZ = round(rnd(220, 480), 3);
  const rows = Array.from({ length: n }, () => ({ z: round(rnd(0.6, 2.8), 3), p: round(rnd(0.6, 2.8), 3) }));
  const dh = rows.map((r) => round(r.z - r.p, 3));
  const HK = round(HZ + dh.reduce((s, x) => s + x, 0), 3);
  return { t: 'fieldbook', HZ, rows, a: [...dh, HK], dec: 3,
    e: 'Na každém stanovisku Δh = čtení vzad − čtení vpřed. Výška koncového bodu H_K = H_Z + ΣΔh. Kontrola: ΣΔh = Σvzad − Σvpřed.' };
}

// --- 6) Směrník na kružítku: nastav směr ručičkou podle ΔY a ΔX (kvadranty) --------------

export function checkAzimuth(ex, g) {
  let d = Math.abs(((g - ex.a) % 400 + 400) % 400);
  d = Math.min(d, 400 - d);
  return { ok: d <= ex.tolG, d, reason: d <= ex.tolG ? '' : `Tvůj směr se liší o ${d.toFixed(1).replace('.', ',')} gon.` };
}

function azimuth() {
  let dy, dx;
  do { dy = round(rnd(-300, 300), 2); dx = round(rnd(-300, 300), 2); } while (Math.hypot(dy, dx) < 40 || Math.min(Math.abs(dy), Math.abs(dx)) < 8);
  let a = Math.atan2(dy, dx) / GON; if (a < 0) a += 400;
  const q = dy >= 0 ? (dx >= 0 ? 'I' : 'II') : (dx >= 0 ? 'IV' : 'III');
  return { t: 'azimuth', dy, dx, a, tolG: 5, quadrant: q,
    e: `ΔY ${dy >= 0 ? '> 0' : '< 0'} a ΔX ${dx >= 0 ? '> 0' : '< 0'} → ${q}. kvadrant. Pomocný úhel φ = arctg|ΔY/ΔX| = ${(Math.atan(Math.abs(dy / dx)) / GON).toFixed(2).replace('.', ',')} gon, směrník σ = ${a.toFixed(2).replace('.', ',')} gon (od +X po směru hodinových ručiček).` };
}

// --- 7) Interpolace vrstevnic v trojúhelníku TIN ------------------------------------------

export function checkContour(ex, p) {
  const d = dist(p, ex.Q);
  return { ok: d <= ex.tolM, d, reason: d <= ex.tolM ? '' : `Vrstevnice protíná hranu jinde – jsi ${d.toFixed(1).replace('.', ',')} m vedle.` };
}

function contour() {
  for (;;) {
    const P = [{ x: rnd(10, 40), y: rnd(10, 54) }, { x: rnd(60, 90), y: rnd(8, 30) }, { x: rnd(55, 90), y: rnd(38, 56) }]
      .map((q, i) => ({ x: round(q.x, 1), y: round(q.y, 1), n: 'ABC'[i], h: round(rnd(300, 340), 1) }));
    const [A, B] = P;
    if (dist(A, B) < 40 || Math.abs(A.h - B.h) < 6) continue;
    const lo = Math.min(A.h, B.h), hi = Math.max(A.h, B.h);
    const L = Math.ceil(lo + 1) + Math.floor(Math.random() * Math.max(1, Math.floor(hi - 1) - Math.ceil(lo + 1) + 1));
    if (L <= lo + 0.5 || L >= hi - 0.5) continue;
    const t = (L - A.h) / (B.h - A.h);
    const Q = { x: A.x + t * (B.x - A.x), y: A.y + t * (B.y - A.y) };
    if (dist(Q, A) < 6 || dist(Q, B) < 6) continue;
    // Druhý průsečík vrstevnice s trojúhelníkem (pro vykreslení po kontrole).
    const C = P[2];
    const other = [[A, C], [B, C]].map(([u, v]) => {
      if ((u.h - L) * (v.h - L) >= 0) return null;
      const k = (L - u.h) / (v.h - u.h);
      return { x: u.x + k * (v.x - u.x), y: u.y + k * (v.y - u.y) };
    }).find(Boolean) ?? null;
    return { t: 'contour', pts: P, L, Q, other, tolM: 2.5,
      e: `Lineární interpolace na hraně ${A.n}${B.n}: t = (${L} − ${fmt1(A.h)}) / (${fmt1(B.h)} − ${fmt1(A.h)}) = ${t.toFixed(3).replace('.', ',')}, tedy ${(t * 100).toFixed(0)} % délky hrany od bodu ${A.n}.` };
  }
}
const fmt1 = (x) => x.toFixed(1).replace('.', ',');

// --- 8) GNSS: výběr 4 družic s nejlepší geometrií (PDOP) ------------------------------------

function inv4(M) {
  const n = 4, a = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r;
    if (Math.abs(a[piv][c]) < 1e-12) return null;
    [a[c], a[piv]] = [a[piv], a[c]];
    const d = a[c][c];
    for (let j = 0; j < 2 * n; j++) a[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = a[r][c]; for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j]; }
  }
  return a.map((r) => r.slice(n));
}

/** PDOP pro vybrané družice (azimut a elevace ve stupních). */
export function pdop(sats) {
  const G = sats.map((s) => {
    const az = s.az * Math.PI / 180, el = s.el * Math.PI / 180;
    return [-Math.cos(el) * Math.sin(az), -Math.cos(el) * Math.cos(az), -Math.sin(el), 1];
  });
  const N = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => G.reduce((sum, g) => sum + g[i] * g[j], 0)));
  const Q = inv4(N);
  return Q ? Math.sqrt(Q[0][0] + Q[1][1] + Q[2][2]) : Infinity;
}

const combos4 = (n) => { const out = []; for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) out.push([a, b, c, d]); return out; };

export function checkSky(ex, sel) {
  if (!Array.isArray(sel) || sel.length !== 4) return { ok: false, reason: 'Vyber přesně 4 družice.' };
  const v = pdop(sel.map((i) => ex.sats[i]));
  const ok = v <= ex.best * 1.25;
  return { ok, pdop: v, reason: ok ? '' : `Tvůj výběr má PDOP ${v.toFixed(1).replace('.', ',')}, nejlepší možný je ${ex.best.toFixed(1).replace('.', ',')}.` };
}

function sky() {
  for (;;) {
    const n = 7;
    const sats = Array.from({ length: n }, () => ({ az: round(rnd(0, 360), 0), el: round(rnd(12, 82), 0), prn: `G${String(rint(1, 32)).padStart(2, '0')}` }));
    if (new Set(sats.map((s) => s.prn)).size < n) continue;
    // Na sky plotu se kolečka nesmí překrývat (průměr 22 jednotek při poloměru 92).
    const xy = sats.map((q) => { const r = 92 * (1 - q.el / 90), a = q.az * Math.PI / 180; return [r * Math.sin(a), -r * Math.cos(a)]; });
    if (xy.some((a, i) => xy.some((b, j) => j > i && Math.hypot(a[0] - b[0], a[1] - b[1]) < 26))) continue;
    const all = combos4(n).map((c) => ({ c, v: pdop(c.map((i) => sats[i])) })).sort((a, b) => a.v - b.v);
    // Úloha má smysl, jen když se dobré a špatné výběry výrazně liší.
    if (!(all[0].v < 4 && all[all.length - 1].v > all[0].v * 3 && all[3].v > all[0].v * 1.25)) continue;
    return { t: 'sky', sats, best: all[0].v, bestSet: all[0].c,
      e: 'Nejlepší geometrie (nejnižší PDOP) vzniká, když jsou družice rozprostřené po celém obzoru a jedna je vysoko nad hlavou. Družice nahloučené v jednom směru dávají vysoké PDOP a horší přesnost.' };
  }
}

// --- 9) Směrová osnova ve dvou polohách dalekohledu ---------------------------------------

function dirbook() {
  const n = 3;
  // Čtení v cc (celá čísla), aby průměry vycházely přesně na 0,0001 gon.
  const start = rint(0, 399) * 10000 + rint(0, 9999);
  const c2 = rint(-40, 40) * 2;                                   // dvojnásobek kolimační chyby v cc
  const rows = [];
  let dir = start;
  for (let i = 0; i < n; i++) {
    if (i) dir = (dir + rint(400000, 1400000)) % 4000000;
    const I = dir + rint(-6, 6) * 2, II = (I + 2000000 + c2 + rint(-3, 3) * 2) % 4000000;
    rows.push({ n: String(i + 1), I: I / 10000, II: II / 10000 });
  }
  const mean = rows.map((r) => { let d = r.II - 200; if (d < 0) d += 400; let m = (r.I + d) / 2; if (Math.abs(r.I - d) > 200) m = (m + 200) % 400; return m; });
  let angle = mean[2] - mean[0]; if (angle < 0) angle += 400;
  return { t: 'dirbook', rows, a: [...mean, angle],
    e: 'Průměr ze dvou poloh: (I + (II ∓ 200)) / 2 – tím se vyloučí kolimační a úklonná chyba. Úhel mezi cíli = rozdíl průměrných směrů (pravý − levý, případně + 400 gon).' };
}

export function checkDirbook(ex, values) {
  const parse = (t) => Number(String(t ?? '').trim().replace(/\s/g, '').replace(/[−–]/g, '-').replace(',', '.'));
  const cells = ex.a.map((v, i) => { const x = parse(values?.[i]); const d = Math.abs(((x - v) % 400 + 600) % 400 - 200); return String(values?.[i] ?? '').trim() !== '' && Number.isFinite(x) && d <= 0.00006; });
  return { ok: cells.every(Boolean), cells, reason: cells.every(Boolean) ? '' : 'Některé hodnoty nesedí – správné jsou doplněny.' };
}

export const FIELD = { station, levelSetup, stakeout, bubble, fieldbook, azimuth, contour, sky, dirbook };

/** Jednotné hodnocení praktických úloh. */
export function checkField(ex, answer) {
  switch (ex.t) {
    case 'station': return checkStation(ex, answer);
    case 'levelSetup': return checkLevelSetup(ex, answer);
    case 'stakeout': return checkStakeout(ex, answer);
    case 'bubble': return checkBubble(ex, answer);
    case 'fieldbook': return checkFieldbook(ex, answer);
    case 'azimuth': return checkAzimuth(ex, answer);
    case 'contour': return checkContour(ex, answer);
    case 'sky': return checkSky(ex, answer);
    case 'dirbook': return checkDirbook(ex, answer);
    default: return { ok: false };
  }
}

export const FIELD_TYPES = Object.keys(FIELD);

/** Všechna vyhovující místa (pro zelené vyznačení po kontrole). */
export function solutionCells(ex) {
  const step = ex.t === 'levelSetup' ? 1 : 2;
  return feasibleGrid((p) => checkField(ex, p).ok, step).cells.map((c) => ({ ...c, s: step }));
}
