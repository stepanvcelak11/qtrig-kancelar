// Kontrola osnovy a generátorů: node geolingo/tests/content.test.mjs
import assert from 'node:assert/strict';
import { UNITS, LESSONS, TIPS, buildLesson, buildCalcPractice, buildMix, buildMistakes, grade, parseNumber, correctText } from '../js/engine.js';
import { GEN, generate, fmt, bearingGon, polygonArea } from '../js/generators.js';
import { FIELD, checkField, turnScrew, blocked } from '../js/field.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };

// --- Osnova ---
ok(UNITS.length >= 10, 'aspoň 10 kapitol');
const ids = new Set();
for (const u of UNITS) {
  ok(u.id && u.title && /^#[0-9a-f]{6}$/i.test(u.color), `kapitola ${u.id}: id/název/barva`);
  ok(u.lessons.length === 5, `kapitola ${u.id}: 5 lekcí`);
}
for (const l of LESSONS) {
  ok(!ids.has(l.id), `duplicitní id lekce ${l.id}`); ids.add(l.id);
  ok(l.title && l.icon, `${l.id}: název a ikona`);
  ok(l.items.length >= (l.gens?.length ? 3 : 5), `${l.id}: málo otázek (${l.items.length})`);
  for (const g of l.gens ?? []) ok(typeof (GEN[g] ?? FIELD[g]) === 'function', `${l.id}: neznámý generátor ${g}`);
  l.items.forEach((it, i) => {
    const where = `${l.id}[${i}]`;
    switch (it.t) {
      case 'c':
        ok(typeof it.q === 'string' && typeof it.a === 'string', `${where}: otázka/odpověď`);
        ok(Array.isArray(it.w) && it.w.length >= 2, `${where}: aspoň 2 špatné možnosti`);
        ok(!it.w.includes(it.a), `${where}: správná odpověď je i mezi špatnými`);
        ok(new Set(it.w).size === it.w.length, `${where}: duplicitní možnosti`);
        break;
      case 'tf': ok(typeof it.q === 'string' && typeof it.a === 'boolean', `${where}: pravda/nepravda`); break;
      case 'm':
        ok(Array.isArray(it.p) && it.p.length >= 3 && it.p.length <= 5, `${where}: 3–5 dvojic`);
        ok(new Set(it.p.map((p) => p[0])).size === it.p.length && new Set(it.p.map((p) => p[1])).size === it.p.length, `${where}: dvojice musí být jednoznačné`);
        break;
      case 'o':
        ok(Array.isArray(it.s) && it.s.length >= 3 && new Set(it.s).size === it.s.length, `${where}: kroky řazení`);
        break;
      case 'n':
        ok(Number.isFinite(it.a) && it.tol >= 0, `${where}: číselná odpověď`);
        break;
      default: ok(false, `${where}: neznámý typ ${it.t}`);
    }
    ok(!it.e || typeof it.e === 'string', `${where}: vysvětlení`);
  });
}

// --- Sestavení lekcí ---
for (const l of LESSONS) {
  for (let k = 0; k < 5; k++) {
    const run = buildLesson(l);
    const nField = (l.gens ?? []).filter((g) => FIELD[g]).length, nCalc = (l.gens ?? []).length - nField;
    ok(run.length === (nCalc ? 8 : Math.min(8, l.items.length + nField)), `${l.id}: délka lekce ${run.length}`);
    ok(run.filter((e) => FIELD[e.t]).length === nField, `${l.id}: terénní úlohy právě jednou`);
    for (const ex of run) {
      if (ex.t === 'c') ok(ex.options.includes(ex.a) && ex.options.length === ex.w.length + 1, `${l.id}: možnosti`);
      if (ex.t === 'o') ok(ex.bank.some((s, i) => s !== ex.s[i]), `${l.id}: řazení nezačíná seřazené`);
      if (ex.t === 'm') ok(ex.left.length === ex.p.length, `${l.id}: dvojice`);
    }
  }
}
ok(buildCalcPractice(10).length === 10, 'procvičování výpočtů');
ok(buildMix(['u1l1', 'u2l3']).length === 10, 'mix');
ok(buildMistakes([{ lesson: 'u1l1', idx: 0 }]).length === 1, 'chyby');

// --- Hodnocení ---
ok(parseNumber('1 234,567') === 1234.567, 'parse s mezerou a čárkou');
ok(parseNumber('−12,5') === -12.5, 'parse s typografickým mínus');
ok(Number.isNaN(parseNumber('12a')), 'parse nesmysl');
ok(grade({ t: 'n', a: 1.2345, tol: 0.001 }, '1,234'), 'tolerance');
ok(!grade({ t: 'n', a: 1.2345, tol: 0.001 }, '1,232'), 'mimo toleranci');
ok(grade({ t: 'o', s: ['a', 'b'] }, ['a', 'b']) && !grade({ t: 'o', s: ['a', 'b'] }, ['b', 'a']), 'řazení');
ok(correctText({ t: 'n', a: -0.5, dec: 3, unit: 'm' }, fmt) === '−0,500 m', 'text odpovědi');

// --- Pomocné výpočty ---
ok(Math.abs(bearingGon(1, 0) - 100) < 1e-9 && Math.abs(bearingGon(0, -1) - 200) < 1e-9 && Math.abs(bearingGon(-1, 0) - 300) < 1e-9, 'kvadranty směrníku');
ok(Math.abs(polygonArea([{ y: 0, x: 0 }, { y: 10, x: 0 }, { y: 10, x: 10 }, { y: 0, x: 10 }]) - 100) < 1e-9, 'plocha čtverce');
ok(fmt(1234567.891, 2) === '1 234 567,89', 'formát čísla');

// --- Generátory: konečné výsledky a nezávislý přepočet z textu zadání ---
const nums = (q) => [...q.matchAll(/−?\d{1,3}(?: \d{3})*(?:,\d+)?|−?\d+(?:,\d+)?/g)].map((m) => parseNumber(m[0]));
const G = Math.PI / 200;
const recompute = {
  gonToDeg: (n) => n[0] * 0.9,
  degToGon: (n) => n[0] / 0.9,
  levelDiff: (n) => n[0] - n[1],
  levelHeight: (n) => n[0] + n[1] - n[2],
  horizonHeight: (n) => n[0] + n[1] - n[2],
  hdFromSd: (n) => n[0] * Math.sin(n[1] * G),
  trigHeight: (n) => n[0] * Math.cos(n[1] * G) + n[2] - n[3],
  stadia: (n) => 100 * (n[0] - n[1]),
  meanError: (n) => n[0] / Math.sqrt(n[1]),
  errorPropagation: (n) => Math.hypot(n[0], n[1]),
  bearing: (n) => bearingGon(n[2] - n[0], n[3] - n[1]),
  distance: (n) => Math.hypot(n[2] - n[0], n[3] - n[1]),
  polarY: (n) => n[0] + n[3] * Math.sin(n[2] * G),
  polarX: (n) => n[1] + n[3] * Math.cos(n[2] * G),
  slopePercent: (n) => n[0] / n[1] * 100,
  cutVolume: (n) => (n[0] + n[1]) / 2 * n[2],
  stereoDepth: (n) => n[0] * n[1] / n[2],
  popDensity: (n) => n[0] / n[1],
};
for (const name of Object.keys(GEN)) {
  for (let k = 0; k < 300; k++) {
    const ex = generate(name);
    ok(Number.isFinite(ex.a) && ex.tol > 0 && Number.isInteger(ex.dec), `${name}: konečná odpověď`);
    ok(ex.t === 'rod' || ex.t === 'circle' || (typeof ex.q === 'string' && ex.q.length > 10), `${name}: zadání`);
    ok(typeof ex.e === 'string', `${name}: vysvětlení`);
    // Odpověď zaokrouhlená na zobrazené desetiny musí projít hodnocením.
    ok(grade(ex, fmt(ex.a, ex.dec).replace('−', '-')), `${name}: zaokrouhlená odpověď neprojde (${ex.a})`);
    if (recompute[name]) {
      const n = nums(ex.q.replace(/[A-Za-z_]\w*|σ_AB|d_AB/g, ' ')).filter((x) => Number.isFinite(x));
      const v = recompute[name](n);
      ok(Math.abs(v - ex.a) <= ex.tol, `${name}: přepočet ${v} ≠ ${ex.a}\n${ex.q}`);
    }
  }
}

// --- Protínání vpřed: nezávislá kontrola přes průsečík dvou přímek ---
for (let k = 0; k < 200; k++) {
  const ey = generate('intersectionY'), n = nums(ey.q.replace(/[A-Za-z_]\w*/g, ' ')).filter(Number.isFinite);
  const [Ay, Ax, By, Bx, al, be] = n;
  const sAB = bearingGon(By - Ay, Bx - Ax), sBA = bearingGon(Ay - By, Ax - Bx);
  const s1 = (sAB - al) * Math.PI / 200, s2 = (sBA + be) * Math.PI / 200;
  // A + t·(sin s1, cos s1) = B + u·(sin s2, cos s2)
  const det = Math.sin(s1) * -Math.cos(s2) + Math.sin(s2) * Math.cos(s1);
  const t = ((By - Ay) * -Math.cos(s2) + Math.sin(s2) * (Bx - Ax)) / det;
  ok(Math.abs(Ay + t * Math.sin(s1) - ey.a) < ey.tol, `protínání: Y ${Ay + t * Math.sin(s1)} ≠ ${ey.a}`);
}

// --- VŠ kapitoly: kód předmětu a semestr ---
for (const u of UNITS.filter((x) => x.level && x.level !== 'SŠ')) {
  ok(['Bc.', 'Ing.'].includes(u.level), `${u.id}: úroveň ${u.level}`);
  ok(/^[A-Z]{3}\d{3}/.test(u.course ?? '') || u.course === '—', `${u.id}: kód předmětu`);
  ok(/^\d\. ročník · (ZS|LS)$/.test(u.sem ?? ''), `${u.id}: semestr ${u.sem}`);
}

// --- Taháky: patří k existující kapitole a mají správnou strukturu ---
for (const [id, t] of Object.entries(TIPS)) {
  ok(UNITS.some((u) => u.id === id), `tahák ${id}: neexistující kapitola`);
  ok(typeof t.intro === 'string' && t.intro.length > 10, `tahák ${id}: úvod`);
  ok(Array.isArray(t.points) && t.points.length >= 3 && t.points.every((x) => typeof x === 'string'), `tahák ${id}: body`);
  ok((t.formulas ?? []).every((f) => Array.isArray(f) && f.length === 2 && f.every((x) => typeof x === 'string')), `tahák ${id}: vzorce`);
  ok((t.terms ?? []).every((f) => Array.isArray(f) && f.length === 2 && f.every((x) => typeof x === 'string')), `tahák ${id}: pojmy`);
  ok(!/\*\*|```|<\/?[a-z]+>/.test(JSON.stringify(t)), `tahák ${id}: bez HTML/Markdownu`);
}
console.log(`Taháky: ${Object.keys(TIPS).length} / ${UNITS.length} kapitol`);

// --- Terénní praxe: každá vygenerovaná situace musí být řešitelná ---
const t0 = Date.now();
for (let k = 0; k < 150; k++) {
  for (const name of ['station', 'levelSetup']) {
    const ex = generate(name);
    ok(!blocked(ex.scene, ex.sol) && checkField(ex, ex.sol).ok, `${name}: uložené řešení nevyhovuje`);
    ok(!checkField(ex, { x: 0.2, y: 0.2 }).ok, `${name}: okraj mapy nesmí vyhovovat`);
  }
  const st = generate('stakeout');
  ok(checkField(st, st.P).ok && !checkField(st, st.S).ok, 'vytyčení: hodnocení');
  // Nezávislý přepočet: úhel od O k P na S musí být ω, délka d.
  const az = (a, b) => { let s = Math.atan2(b.x - a.x, -(b.y - a.y)) * 200 / Math.PI; return (s + 400) % 400; };
  ok(Math.abs(((az(st.S, st.P) - az(st.S, st.O) + 400) % 400) - st.omega) < 1e-6, 'vytyčení: úhel');
  ok(Math.abs(Math.hypot(st.P.x - st.S.x, st.P.y - st.S.y) - st.d) < 1e-9, 'vytyčení: délka');
  // Libela: hladový postup musí bublinu dostat do kroužku.
  const bu = generate('bubble');
  let b = bu.b0;
  for (let i = 0; i < 40 && !checkField(bu, b).ok; i++) {
    let best = null;
    for (let s = 0; s < 3; s++) for (const d of [1, -1]) { const n = turnScrew(b, s, d, bu.step); if (!best || Math.hypot(n.x, n.y) < Math.hypot(best.x, best.y)) best = n; }
    b = best;
  }
  ok(checkField(bu, b).ok, 'libela: nelze urovnat');
  ok(!checkField(bu, bu.b0).ok, 'libela: nesmí začínat urovnaná');
  const fb = generate('fieldbook');
  ok(checkField(fb, fb.a.map((v) => fmt(v, 3).replace('−', '-'))).ok, 'zápisník: správné hodnoty');
  ok(Math.abs(fb.rows.reduce((s, r) => s + r.z - r.p, fb.HZ) - fb.a.at(-1)) < 0.0006, 'zápisník: H_K');
  ok(!checkField(fb, fb.a.map(() => '')).ok, 'zápisník: prázdné');
}
for (let k = 0; k < 300; k++) {
  const az = generate('azimuth');
  const quad = { I: [0, 100], II: [100, 200], III: [200, 300], IV: [300, 400] }[az.quadrant];
  ok(az.a >= quad[0] && az.a < quad[1], `směrník: kvadrant ${az.quadrant} ≠ ${az.a}`);
  ok(checkField(az, az.a + 4).ok && !checkField(az, az.a + 10).ok && checkField(az, (az.a + 398) % 400).ok, 'směrník: tolerance a přechod přes 0');
}
console.log(`Terénní úlohy: 150× vše řešitelné (${Date.now() - t0} ms)`);

console.log(`Geolingo: ${checks} kontrol OK (${LESSONS.length} lekcí, ${LESSONS.reduce((s, l) => s + l.items.length, 0)} otázek, ${Object.keys(GEN).length} generátorů)`);
