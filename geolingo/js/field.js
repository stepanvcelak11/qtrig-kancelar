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

export const FIELD = { station, levelSetup, stakeout, bubble, fieldbook };

/** Jednotné hodnocení praktických úloh. */
export function checkField(ex, answer) {
  switch (ex.t) {
    case 'station': return checkStation(ex, answer);
    case 'levelSetup': return checkLevelSetup(ex, answer);
    case 'stakeout': return checkStakeout(ex, answer);
    case 'bubble': return checkBubble(ex, answer);
    case 'fieldbook': return checkFieldbook(ex, answer);
    default: return { ok: false };
  }
}

export const FIELD_TYPES = Object.keys(FIELD);

/** Všechna vyhovující místa (pro zelené vyznačení po kontrole). */
export function solutionCells(ex) {
  const step = ex.t === 'levelSetup' ? 1 : 2;
  return feasibleGrid((p) => checkField(ex, p).ok, step).cells.map((c) => ({ ...c, s: step }));
}
