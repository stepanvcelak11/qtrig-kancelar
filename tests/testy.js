// Testy jádra. Běží v prohlížeči (tests/index.html přes Playwright) i v Node (tests/node.mjs).
import { gonNorm, gonDiff, parseUhel, fmtGon, deg2gon, fmtDms } from '../geo/uhly.js';
import { smernik, delka, rajon, ortogonalni, protinaniSmerniky, protinaniUhly, protinaniDelky, protinaniZpetTienstra, plochaObvod, patakolmice, prusecikPrimek, kruzniceTremiBody } from '../geo/zaklad.js';
import { orientaceStanoviska, polarniBody, volneStanoviskoHelmert, vyrovnaniStanoviska, protinaniZpet } from '../geo/stanovisko.js';
import { polygonovyPorad } from '../geo/polygon.js';
import { kriteria, posud, posudOmernou, posudDvojiUrceni, posudPorad } from '../geo/presnost.js';
import { kontrolniOmerne, vymeraZeSouradnic, vymeryDily, transformace, trigVyska, nivelace, meritkoKrovak, redukceDelky } from '../geo/ostatni.js';

export const testy = [];
const t = (nazev, fn) => testy.push({ nazev, fn });
const blizko = (a, b, tol, co = '') => { if (!(Math.abs(a - b) <= tol)) throw new Error(`${co} ${a} ≠ ${b} (±${tol})`); };
const rovno = (a, b, co = '') => { if (a !== b) throw new Error(`${co} ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };
const pravda = (v, co = '') => { if (!v) throw new Error(co || 'očekáváno true'); };

// ---------- úhly ----------
t('gonNorm/gonDiff', () => { rovno(gonNorm(-10), 390); rovno(gonNorm(410), 10); blizko(gonDiff(10, 390), 20, 1e-12); blizko(gonDiff(390, 10), -20, 1e-12); });
t('parseUhel: gony, čárka, stupně, DMS', () => {
    blizko(parseUhel('45.2210'), 45.221, 1e-12); blizko(parseUhel('45,2210'), 45.221, 1e-12);
    blizko(parseUhel('90°'), 100, 1e-12); blizko(parseUhel('40°30\'00"'), 45, 1e-9); blizko(parseUhel('40 30 0'), 45, 1e-9);
    blizko(parseUhel('-10°'), deg2gon(-10), 1e-12); rovno(parseUhel('abc'), null);
});
t('fmtGon/fmtDms', () => { rovno(fmtGon(-0.00004), '0.0000'); rovno(fmtGon(-0.00006), '399.9999'); rovno(fmtGon(400.00004), '0.0000'); rovno(fmtDms(45.5), '45°30\'00.0"'); });

// ---------- základ ----------
const A = { y: 745000, x: 1045000 }, B = { y: 745100, x: 1045000 }, C = { y: 745000, x: 1045100 };
t('směrník: +Y = 100 g, +X = 0 g, kvadranty', () => {
    blizko(smernik(A, B), 100, 1e-9); blizko(smernik(A, C), 0, 1e-9); blizko(smernik(B, A), 300, 1e-9); blizko(smernik(C, A), 200, 1e-9);
    blizko(smernik(A, { y: 745100, x: 1045100 }), 50, 1e-9); blizko(smernik(A, { y: 744900, x: 1045100 }), 350, 1e-9);
});
t('rajón ↔ směrník+délka (roundtrip)', () => {
    for (const sig of [0, 33.3333, 100, 187.5, 250, 399.9]) { const P = rajon(A, sig, 123.456); blizko(smernik(A, P), sig, 1e-9); blizko(delka(A, P), 123.456, 1e-9); }
});
t('ortogonální: kolmice vpravo kladná', () => {
    const r = ortogonalni(A, B, 40, 10);         // A→B je +Y (100 g); vpravo = +X (200 g)
    blizko(r.bod.y, 745040, 1e-9); blizko(r.bod.x, 1044990, 1e-9); // A→B míří na západ (+Y), vpravo = sever = −X
    const r2 = ortogonalni(A, B, 40, 10, 100.02); // měřená AB 100,02 → měřítko 100/100,02
    blizko(r2.rozdil, 0.02, 1e-9); blizko(r2.bod.y, 745000 + 40 * 100 / 100.02, 1e-9);
});
t('protínání ze směrníků a z úhlů', () => {
    const P = { y: 745060, x: 1045080 };
    const r = protinaniSmerniky(A, smernik(A, P), B, smernik(B, P)); blizko(r.bod.y, P.y, 1e-6); blizko(r.bod.x, P.x, 1e-6);
    const oA = gonDiff(smernik(A, P), smernik(A, B)), oB = gonDiff(smernik(B, P), smernik(B, A));
    const r2 = protinaniUhly(A, B, oA, oB); blizko(r2.bod.y, P.y, 1e-6); blizko(r2.bod.x, P.x, 1e-6);
    rovno(protinaniSmerniky(A, 50, B, 50), null, 'rovnoběžné');
});
t('protínání z délek: obě strany', () => {
    const P = { y: 745060, x: 1045080 }, Q = { y: 745060, x: 1044920 };
    const r = protinaniDelky(A, B, delka(A, P), delka(B, P), 'vlevo');   // P má větší X = jih = vlevo od směru na západ blizko(r.bod.y, P.y, 1e-6); blizko(r.bod.x, P.x, 1e-6);
    const l = protinaniDelky(A, B, delka(A, Q), delka(B, Q), 'vpravo'); blizko(l.bod.y, Q.y, 1e-6); blizko(l.bod.x, Q.x, 1e-6);
    rovno(protinaniDelky(A, B, 10, 10), null, 'bez průsečíku');
});
t('plocha a obvod čtverce 100 m', () => { const r = plochaObvod([A, B, { y: 745100, x: 1045100 }, C]); blizko(r.plocha, 10000, 1e-6); blizko(r.obvod, 400, 1e-9); });
t('pata kolmice, průsečík přímek, kružnice třemi body', () => {
    const p = patakolmice(A, B, { y: 745030, x: 1045020 }); blizko(p.s, 30, 1e-9); blizko(p.k, -20, 1e-9);
    const X = prusecikPrimek(A, { y: 745100, x: 1045100 }, B, C); blizko(X.y, 745050, 1e-9); blizko(X.x, 1045050, 1e-9);
    const k = kruzniceTremiBody({ y: 10, x: 0 }, { y: 0, x: 10 }, { y: -10, x: 0 }); blizko(k.stred.y, 0, 1e-9); blizko(k.stred.x, 0, 1e-9); blizko(k.r, 10, 1e-9);
});

// ---------- stanovisko ----------
const S = { y: 745050, x: 1045040 };
const zname = [{ cislo: '5001', bod: { y: 745000, x: 1045000 } }, { cislo: '5002', bod: { y: 745200, x: 1045010 } }, { cislo: '5003', bod: { y: 745080, x: 1045250 } }, { cislo: '5004', bod: { y: 744900, x: 1045150 } }];
const O = 123.4567; // skutečný orientační posun
const mereniZ = (sum = 0) => zname.map((z, i) => ({ cislo: z.cislo, bod: z.bod, smer: gonNorm(smernik(S, z.bod) - O + (i % 2 ? sum : -sum)), delka: delka(S, z.bod) }));
t('orientace stanoviska: posun a odchylky', () => {
    const r = orientaceStanoviska(S, mereniZ(0.002)); blizko(r.o, O, 1e-9); rovno(r.n, 4); blizko(Math.abs(r.radky[0].v), 0.002, 1e-9); blizko(r.mOr, 0.002 * Math.sqrt(4 / 3), 1e-6);
});
t('orientace přes 0/400 g', () => {
    const m = [{ cislo: 'a', bod: { y: 745000, x: 1045100 }, smer: 399.9 }, { cislo: 'b', bod: { y: 745100, x: 1045000 }, smer: 99.9 }];
    const r = orientaceStanoviska({ y: 745000, x: 1045000 }, m); blizko(r.o, 0.1, 1e-9);
});
t('polární metoda: body zpět na známé', () => {
    const m = mereniZ(0), o = orientaceStanoviska(S, m).o, b = polarniBody(S, o, m);
    b.forEach((p, i) => { blizko(p.y, zname[i].bod.y, 1e-6); blizko(p.x, zname[i].bod.x, 1e-6); });
});
t('volné stanovisko Helmert: přesně a s šumem', () => {
    const r = volneStanoviskoHelmert(mereniZ(0)); blizko(r.S.y, S.y, 1e-6); blizko(r.S.x, S.x, 1e-6); blizko(r.o, O, 1e-6); rovno(r.q, 1);
    const m = mereniZ(0); m[0].delka += 0.02; const r2 = volneStanoviskoHelmert(m);
    blizko(r2.S.y, S.y, 0.02); blizko(r2.S.x, S.x, 0.02); pravda(r2.m0 > 0 && r2.m0 < 0.03, 'm0 ' + r2.m0);
    const r3 = volneStanoviskoHelmert(mereniZ(0), true); blizko(r3.q, 1, 1e-9);
});
t('vyrovnání stanoviska MNČ: směry + délky', () => {
    const r = vyrovnaniStanoviska({ y: S.y + 3, x: S.x - 2 }, mereniZ(0)); blizko(r.S.y, S.y, 1e-5); blizko(r.S.x, S.x, 1e-5); blizko(r.o, O, 1e-6); pravda(r.iterace <= 6, 'iterace ' + r.iterace);
    const jenDelky = mereniZ(0).map((m) => ({ cislo: m.cislo, bod: m.bod, delka: m.delka }));
    const r2 = vyrovnaniStanoviska({ y: S.y + 5, x: S.x + 5 }, jenDelky); blizko(r2.S.y, S.y, 1e-5); blizko(r2.S.x, S.x, 1e-5); rovno(r2.o, null);
});
t('protínání zpět (Tienstra + MNČ) ze 3 a 4 směrů', () => {
    const m = mereniZ(0).map((x) => ({ cislo: x.cislo, bod: x.bod, smer: x.smer }));
    const t3 = protinaniZpetTienstra(m[0].bod, m[1].bod, m[2].bod, m[0].smer, m[1].smer, m[2].smer);
    blizko(t3.y, S.y, 1e-4, 'Tienstra y'); blizko(t3.x, S.x, 1e-4, 'Tienstra x');
    const r = protinaniZpet(m.slice(0, 3)); blizko(r.S.y, S.y, 1e-5); blizko(r.S.x, S.x, 1e-5); blizko(r.o, O, 1e-6); rovno(r.nebezpecny, false);
    const r4 = protinaniZpet(m); blizko(r4.S.y, S.y, 1e-5); blizko(r4.S.x, S.x, 1e-5); pravda(r4.m0 < 1e-6, 'm0');
    // jiná stanoviska (různé kvadranty)
    for (const S2 of [{ y: 745150, x: 1045150 }, { y: 744950, x: 1045200 }, { y: 745120, x: 1045020 }]) {
        const mm = zname.slice(0, 3).map((z) => ({ cislo: z.cislo, bod: z.bod, smer: gonNorm(smernik(S2, z.bod) - 77) }));
        const rr = protinaniZpet(mm); blizko(rr.S.y, S2.y, 1e-4, 'S2 y'); blizko(rr.S.x, S2.x, 1e-4, 'S2 x');
    }
});

// ---------- polygon ----------
// syntetický pořad: skutečné body, z nich levé úhly a délky, pak + šum
const PA = { y: 744800, x: 1044900 }, PB = { y: 745500, x: 1045400 };
const skut = [{ cislo: '4001', y: 745000, x: 1045000 }, { cislo: '1', y: 745120, x: 1045040 }, { cislo: '2', y: 745210, x: 1045150 }, { cislo: '3', y: 745300, x: 1045170 }, { cislo: '4002', y: 745400, x: 1045300 }];
function levyUhel(pred, v, nasl) { return gonNorm(smernik(v, nasl) - smernik(v, pred)); }
function vrcholyZ(body, pa, pb) {
    const V = [];
    for (let i = 0; i < body.length; i++) {
        const pred = i === 0 ? pa : body[i - 1], nasl = i === body.length - 1 ? pb : body[i + 1];
        V.push({ cislo: body[i].cislo, omega: levyUhel(pred, body[i], nasl), d: i < body.length - 1 ? delka(body[i], body[i + 1]) : null });
    }
    return V;
}
t('polygon oboustranně připojený a orientovaný: přesný → nulové uzávěry', () => {
    const r = polygonovyPorad({ typ: 'oboustranne', A: skut[0], B: skut[4], PA, PB, vrcholy: vrcholyZ(skut, PA, PB) });
    blizko(r.uhlovyUzaver, 0, 1e-9); blizko(r.souradnicovyUzaver.dp, 0, 1e-6);
    r.body.forEach((b, i) => { blizko(b.y, skut[i].y, 1e-6); blizko(b.x, skut[i].x, 1e-6); });
});
t('polygon: úhlový uzávěr 0,010 g se rozdělí, souřadnicový po délkách', () => {
    const V = vrcholyZ(skut, PA, PB); V[2].omega += 0.010; V[1].d += 0.05;
    const r = polygonovyPorad({ typ: 'oboustranne', A: skut[0], B: skut[4], PA, PB, vrcholy: V });
    blizko(r.uhlovyUzaver, 0.010, 1e-9); blizko(r.opravaUhlu, -0.002, 1e-9); blizko(r.souradnicovyUzaver.dp, 0.05, 0.01);
    blizko(r.body[4].y, skut[4].y, 1e-9); blizko(r.body[4].x, skut[4].x, 1e-9);
    r.body.forEach((b, i) => { blizko(b.y, skut[i].y, 0.05); blizko(b.x, skut[i].x, 0.05); });
    const p = posudPorad(r, 'pomocny'); rovno(p.uhlovy.stav, 'ok'); rovno(p.polohovy.stav, 'ok');
    const p2 = posudPorad(r, 'ppbp'); rovno(p2.uhlovy.stav, 'ok'); blizko(p2.uhlovy.mezni, 0.025 * Math.sqrt(7), 1e-9);
});
t('polygon pravostranné úhly = stejný výsledek', () => {
    const V = vrcholyZ(skut, PA, PB).map((v) => ({ ...v, omega: gonNorm(400 - v.omega) }));
    const r = polygonovyPorad({ typ: 'oboustranne', A: skut[0], B: skut[4], PA, PB, vrcholy: V, levy: false });
    blizko(r.uhlovyUzaver, 0, 1e-9); r.body.forEach((b, i) => { blizko(b.y, skut[i].y, 1e-6); blizko(b.x, skut[i].x, 1e-6); });
});
t('polygon jednostranně orientovaný a vetknutý', () => {
    const V = vrcholyZ(skut, PA, PB);
    const r = polygonovyPorad({ typ: 'jednostranne', A: skut[0], B: skut[4], PA, vrcholy: V });
    rovno(r.uhlovyUzaver, null); blizko(r.souradnicovyUzaver.dp, 0, 1e-6); r.body.forEach((b, i) => { blizko(b.y, skut[i].y, 1e-6); blizko(b.x, skut[i].x, 1e-6); });
    const v = polygonovyPorad({ typ: 'vetknuty', A: skut[0], B: skut[4], vrcholy: V });
    blizko(v.souradnicovyUzaver.dp, 0, 1e-6); v.body.forEach((b, i) => { blizko(b.y, skut[i].y, 1e-6, 'vetknutý y ' + i); blizko(b.x, skut[i].x, 1e-6, 'vetknutý x ' + i); });
    const V2 = V.map((x) => ({ ...x })); V2[1].d += 0.10;
    const v2 = polygonovyPorad({ typ: 'vetknuty', A: skut[0], B: skut[4], vrcholy: V2 }); blizko(v2.souradnicovyUzaver.dp, 0.10, 0.02);
    blizko(v2.body[4].y, skut[4].y, 1e-9); blizko(v2.body[4].x, skut[4].x, 1e-9);
});
t('polygon uzavřený', () => {
    const okruh = [skut[0], skut[1], skut[2], { cislo: '3b', y: 745150, x: 1045200 }, { cislo: '4001', y: 745000, x: 1045000 }];
    const V = vrcholyZ(okruh, PA, PA);
    const r = polygonovyPorad({ typ: 'uzavreny', A: skut[0], PA, vrcholy: V });
    blizko(r.uhlovyUzaver, 0, 1e-9); blizko(r.souradnicovyUzaver.dp, 0, 1e-6); r.body.forEach((b, i) => { blizko(b.y, okruh[i].y, 1e-6); blizko(b.x, okruh[i].x, 1e-6); });
});

// ---------- přesnost ----------
t('kritéria kód 3: m_xy 0,14, u_xy 0,28, u_p 0,40, u_d(15,29) = 0,306 (příklad ČÚZK)', () => {
    const k = kriteria(3); blizko(k.mxy, 0.14, 1e-12); blizko(k.uxy, 0.28, 1e-12); blizko(k.up, 0.396, 1e-3); blizko(k.kd, 0.198, 1e-3);
    blizko(k.md(15.29), 0.153, 5e-4); blizko(k.ud(15.29), 0.306, 1e-3);
});
t('posouzení ok/varování/překročeno', () => {
    rovno(posud(0.1, 0.28).stav, 'ok'); rovno(posud(0.25, 0.28).stav, 'varovani'); rovno(posud(-0.3, 0.28).stav, 'prekroceno');
    rovno(posudOmernou(12.43, 12.41).stav, 'ok'); rovno(posudOmernou(8.90, 9.25).stav, 'prekroceno');
    const d = posudDvojiUrceni({ y: 1, x: 1 }, { y: 1.2, x: 1.3 }); rovno(d.y.stav, 'ok'); rovno(d.x.stav, 'prekroceno'); rovno(d.poloha.stav, 'varovani');
});

// ---------- ostatní ----------
t('kontrolní oměrné', () => {
    const r = kontrolniOmerne([{ a: { cislo: '1', ...A }, b: { cislo: '2', ...B }, dMer: 100.05 }]); blizko(r[0].dVyp, 100, 1e-9); blizko(r[0].rozdil, 0.05, 1e-9); rovno(r[0].stav, 'ok');
});
t('výměry: čtverec a díly', () => {
    const ctverec = [A, B, { y: 745100, x: 1045100 }, C]; blizko(vymeraZeSouradnic(ctverec).plocha, 10000, 1e-6);
    const d = vymeryDily(ctverec, [{ cislo: 'a', body: [A, B, { y: 745100, x: 1045050 }, { y: 745000, x: 1045050 }] }, { cislo: 'b', body: [{ y: 745000, x: 1045050 }, { y: 745100, x: 1045050 }, { y: 745100, x: 1045100 }, C] }]);
    blizko(d.soucet, 10000, 1e-6); blizko(d.rozdil, 0, 1e-6);
});
t('transformace: shodnostní, Helmert, afinní (roundtrip)', () => {
    const th = 37.5 * Math.PI / 200, q = 1.0004, c = Math.cos(th), s = Math.sin(th);
    const zdroj = [{ y: 100, x: 200 }, { y: 350, x: 220 }, { y: 300, x: 500 }, { y: 80, x: 450 }];
    const cil = zdroj.map((p) => ({ y: 745000 + q * (c * p.y + s * p.x), x: 1045000 + q * (c * p.x - s * p.y) })); // směrníky +37,5 g
    const id = zdroj.map((z, i) => ({ cislo: String(i), z, c: cil[i] }));
    const h = transformace(id, 'helmert'); blizko(h.param.meritko, q, 1e-9); blizko(h.param.rotaceGon, 37.5, 1e-9); blizko(h.m0, 0, 1e-6);
    const tp = h.transformuj({ y: 200, x: 300 }); blizko(tp.y, 745000 + q * (c * 200 + s * 300), 1e-6);
    const sh = transformace(id, 'shodnostni'); rovno(sh.param.meritko, 1); pravda(sh.m0 > 0.05, 'shodnostní má rezidua kvůli měřítku');
    const af = transformace(id, 'afinni'); blizko(af.m0, 0, 1e-6); const ta = af.transformuj({ y: 200, x: 300 }); blizko(ta.y, tp.y, 1e-6); blizko(ta.x, tp.x, 1e-6);
});
t('trigonometrická výška a nivelace', () => {
    const r = trigVyska({ Hst: 300, z: 100, d: 100, vp: 1.5, vc: 2.0 }); blizko(r.H, 299.5 + (1 - 0.13) * 1e4 / (2 * 6380703.6105), 1e-6);
    const r2 = trigVyska({ Hst: 300, z: 90, d: 100, sikma: true, oprava: false }); blizko(r2.prevyseni, 100 * Math.cos(90 * Math.PI / 200), 1e-9);
    const n = nivelace({ sestavy: [{ zpet: 1.5, vpred: 1.2 }, { zpet: 1.4, vpred: 1.6 }], Hzac: 200, Hkon: 200.104, delkaKm: 0.5 });
    blizko(n.sumaPrevyseni, 0.1, 1e-9); blizko(n.uzaver, 0.004, 1e-9); blizko(n.vysky[2], 200.104, 1e-9); blizko(n.mezni, 0.0283, 1e-3); rovno(n.posouzeni.stav, 'ok');
});
t('redukce délek: měřítko Křováka 0,9999…1,0001, výška', () => {
    const m = meritkoKrovak(745000, 1045000); pravda(m > 0.9998 && m < 1.0002, 'měřítko ' + m);
    const r = redukceDelky(100, 300, 745000, 1045000); blizko(r.mVyska, 6380703.6105 / 6381003.6105, 1e-12); pravda(Math.abs(r.dSjtsk - 100) < 0.03, 'd ' + r.dSjtsk);
    // ověření: Tábor (Y≈735000, X≈1128000) leží blízko základní rovnoběžky → m ≈ 0,9999
    blizko(meritkoKrovak(735000, 1128000), 0.9999, 5e-5);
});

export async function spust(log = console.log) {
    let ok = 0, chyb = 0; const chyby = [];
    const { testy: dalsi } = await import('./testy-import.js');
    const { testy: osa } = await import('./testy-osa.js');
    const { testy: mapa2 } = await import('./testy-mapa2.js');
    const { testy: seznam } = await import('./testy-seznam.js');
    const { testy: format } = await import('./testy-format.js');
    const { testy: vyr } = await import('./testy-vyrovnani.js');
    for (const tt of [...testy, ...dalsi, ...osa, ...mapa2, ...seznam, ...format, ...vyr]) {
        try { await tt.fn(); ok++; log('✓ ' + tt.nazev); }
        catch (e) { chyb++; chyby.push({ nazev: tt.nazev, chyba: e.message }); log('✕ ' + tt.nazev + ' — ' + e.message); }
    }
    log(`--- ${ok} OK, ${chyb} chyb, ${ok + chyb} celkem`);
    return { ok, chyb, chyby, celkem: ok + chyb };
}
