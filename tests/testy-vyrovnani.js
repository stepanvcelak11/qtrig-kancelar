// Vyrovnávací přímka/kružnice, průsečíky, trasa, fasáda, Delaunay + kubatura, výškový pořad, KM-D, afinní 5, vytyčovací prvky.
import { vyrovnavaciPrimka, vyrovnavaciKruznice, prusecikPrimekOdsazeni, prusecikPrimkaSmer, prusecikPrimkaKruznice, trasa, fasada, delaunay, orezObvod, kubatura, vyskovyPorad, kmdDosavadni, kmdNovy, transformace5, polarniVytycovaci, ortogonalniVytycovaci } from '../geo/vyrovnani.js';
import { rajon, delka, smernik } from '../geo/zaklad.js';
export const testy = [];
const t = (nazev, fn) => testy.push({ nazev, fn });
const blizko = (a, b, tol, co = '') => { if (!(Math.abs(a - b) <= tol)) throw new Error(`${co} ${a} ≠ ${b} (±${tol})`); };
const rovno = (a, b, co = '') => { if (a !== b) throw new Error(`${co} ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };
const A = { y: 745000, x: 1045000 };
t('vyrovnávací přímka: body na přímce σ=37 g s šumem ±1 cm', () => {
    const body = [0, 10, 25, 40, 60].map((s, i) => ({ cislo: String(i), ...rajon(rajon(A, 37, s), 137, (i % 2 ? 0.01 : -0.01)) }));
    const r = vyrovnavaciPrimka(body); blizko(r.sigma % 200, 37, 0.01); blizko(r.delkaPrimky, 60, 0.02); blizko(r.maxOdchylka, 0.01, 0.003); rovno(r.definicni.length, 5);
    const r2 = vyrovnavaciPrimka(body, [{ cislo: 'x', ...rajon(rajon(A, 37, 30), 137, 0.5) }]); blizko(r2.dalsi[0].d, 0.5, 0.01);
});
t('vyrovnávací kružnice: R 25 m, 6 bodů, i s pevným poloměrem', () => {
    const S = { y: 745100, x: 1045100 }; const body = [10, 60, 130, 210, 280, 350].map((g, i) => ({ cislo: String(i), ...rajon(S, g, 25 + (i % 2 ? 0.005 : -0.005)) }));
    const r = vyrovnavaciKruznice(body); blizko(r.stred.y, S.y, 0.01); blizko(r.stred.x, S.x, 0.01); blizko(r.R, 25, 0.01); blizko(r.maxOdchylka, 0.005, 0.003);
    const f = vyrovnavaciKruznice(body, [], 25); blizko(f.R, 25, 1e-12); blizko(f.stred.y, S.y, 0.01);
});
t('průsečíky: přímky s odsazením, přímka–směr, přímka–kružnice', () => {
    const B = { y: 745100, x: 1045000, z: 310 }, C = { y: 745050, x: 1044950 }, D = { y: 745050, x: 1045050 }; A.z = 300;
    const r = prusecikPrimekOdsazeni(A, B, C, D); blizko(r.bod.y, 745050, 1e-9); blizko(r.bod.x, 1045000, 1e-9); blizko(r.bod.z, 305, 1e-9); rovno(r.naAB, true); blizko(r.uhel, 100, 1e-9);
    const o = prusecikPrimekOdsazeni(A, B, C, D, 2, 0); blizko(o.bod.x, 1044998, 1e-9, 'odsazení AB vpravo (sever = −X)');
    const s = prusecikPrimkaSmer(C, 0, A, B); blizko(s.bod.y, 745050, 1e-9); blizko(s.bod.x, 1045000, 1e-9);
    const k = prusecikPrimkaKruznice(A, B, { y: 745050, x: 1045000 }, 10); rovno(k.length, 2); blizko(k[0].y, 745040, 1e-9); blizko(k[1].y, 745060, 1e-9);
    rovno(prusecikPrimkaKruznice(A, B, { y: 745050, x: 1045020 }, 10).length, 0); delete A.z;
});
t('trasa: délky, směrníky, lomy, odsazení', () => {
    const body = [{ cislo: '1', ...A, z: 300 }, { cislo: '2', y: 745100, x: 1045000, z: 302 }, { cislo: '3', y: 745100, x: 1045100, z: 301 }];
    const r = trasa(body, 5); rovno(r.seg.length, 2); blizko(r.seg[0].d, 100, 1e-9); blizko(r.seg[0].sigma, 100, 1e-9); blizko(r.seg[0].sklon, 2, 1e-9); blizko(r.vrcholy[0].lom, -100, 1e-9); blizko(r.delka, 200, 1e-9);
    blizko(r.vpravo[0].x, 1044995, 1e-9, 'první bod odsazení kolmo'); blizko(delka(r.vpravo[1], body[1]), 5 * Math.SQRT2, 1e-9, 'vrchol po ose úhlu'); blizko(r.vlevo[2].y, 745095, 1e-9, 'vlevo od směru na jih = východ = −Y');
});
t('fasáda: sklopení do roviny', () => { const r = fasada(A, { y: 745100, x: 1045000 }, [{ cislo: 'a', y: 745030, x: 1045000.4, z: 312.5 }]); blizko(r[0].y, 30, 1e-9); blizko(r[0].x, 312.5, 1e-9); blizko(r[0].k, -0.4, 1e-9, 'jih = vlevo'); });
t('Delaunay + kubatura: čtverec 100×100 s výškou 2 m nad rovinou = 20 000 m³', () => {
    const body = [{ y: 0, x: 0, z: 102 }, { y: 100, x: 0, z: 102 }, { y: 100, x: 100, z: 102 }, { y: 0, x: 100, z: 102 }, { y: 50, x: 50, z: 102 }];
    const tri = delaunay(body); rovno(tri.length, 4); const k = kubatura(body, tri, 100); blizko(k.objem, 20000, 1e-6); blizko(k.plocha, 10000, 1e-6); blizko(k.povrch, 10000, 1e-6);
    const sikme = [...body]; sikme[4] = { y: 50, x: 50, z: 104 }; const k2 = kubatura(sikme, delaunay(sikme), 100); blizko(k2.objem, 20000 + 10000 * 2 / 3, 1e-6);
    // štíhlý obvodový trojúhelník se ořízne
    const s = [{ y: 0, x: 0, z: 1 }, { y: 10, x: 0, z: 1 }, { y: 5, x: 8, z: 1 }, { y: 200, x: 0.5, z: 1 }]; const tr = delaunay(s); const o = orezObvod(s, tr, 20); rovno(o.length < tr.length, true);
});
t('výškový pořad s uzávěrem rozděleným po délkách', () => {
    const r = vyskovyPorad([{ od: 'A', do: '1', dh: 1.5, d: 100 }, { od: '1', do: '2', dh: -0.5, d: 100 }, { od: '2', do: 'B', dh: 2.0, d: 200 }], 200, 203.04, 0.045);
    blizko(r.uzaver, 0.04, 1e-9); blizko(r.vysky[1].H, 201.51, 1e-9); blizko(r.vysky[3].H, 203.04, 1e-9); rovno(r.stav, 'varovani');
});
t('KM-D: dosavadní bod a nový bod (průsečík / kolmý průmět podle 50 g)', () => {
    const D = { y: 745000, x: 1045000 }, N = { y: 745000.12, x: 1045000.05 }, B = { y: 745050, x: 1045020 };
    const r = kmdDosavadni(D, N, B, 53.9); blizko(r.dp, Math.hypot(0.12, 0.05), 1e-9); blizko(r.rozdilDelky, 53.9 - delka(D, B), 1e-9);
    const A2 = { y: 745000, x: 1045000 }, B2 = { y: 745100, x: 1045000 };
    const kolmo = kmdNovy(A2, B2, { y: 745050, x: 1045000.3 }, { y: 745050, x: 1045040 }); rovno(kolmo.zpusob, 'průsečík'); blizko(kolmo.bod.y, 745050, 1e-9); blizko(kolmo.bod.x, 1045000, 1e-9);
    const sikmo = kmdNovy(A2, B2, { y: 745050, x: 1045000.3 }, { y: 745090, x: 1045010 }); rovno(sikmo.zpusob, 'kolmý průmět'); blizko(sikmo.posun, 0.3, 1e-9); blizko(sikmo.bod.x, 1045000, 1e-9);
});
t('afinní 5 parametrů: rotace 20 g, měřítka 1,001 / 0,999 (roundtrip)', () => {
    const th = 20 * Math.PI / 200, c = Math.cos(th), s = Math.sin(th), my = 1.001, mx = 0.999;
    const zdroj = [{ y: 100, x: 200 }, { y: 350, x: 220 }, { y: 300, x: 500 }, { y: 80, x: 450 }, { y: 200, x: 300 }];
    const cil = zdroj.map((p) => ({ y: 745000 + c * my * p.y + s * mx * p.x, x: 1045000 - s * my * p.y + c * mx * p.x }));
    const r = transformace5(zdroj.map((z, i) => ({ cislo: String(i), z, c: cil[i] }))); blizko(r.m0, 0, 1e-6); blizko(r.param.meritkoY, my, 1e-9); blizko(r.param.meritkoX, mx, 1e-9); blizko(r.param.rotaceGon, 20, 1e-6);
    const tp = r.transformuj({ y: 150, x: 250 }); blizko(tp.y, 745000 + c * my * 150 + s * mx * 250, 1e-6);
});
t('vytyčovací prvky polární a ortogonální', () => {
    const S = { cislo: 'S', y: 745000, x: 1045000, z: 300 }, O = { cislo: 'O', y: 745100, x: 1045000 }, P = { cislo: 'P', y: 745050, x: 1045050, z: 302 };
    const v = polarniVytycovaci(S, O, [P], 0); blizko(v[0].smer, 350, 1e-9, 'od orientace (σO 100 g) k σP 50 g = 350 g'); blizko(v[0].d, 50 * Math.SQRT2, 1e-9); blizko(v[0].dz, 2, 1e-9);
    const o = ortogonalniVytycovaci(S, O, [P]); blizko(o[0].s, 50, 1e-9); blizko(o[0].k, -50, 1e-9, 'jih = vlevo od směru na západ'); blizko(o[0].domerek, 50, 1e-9);
});
