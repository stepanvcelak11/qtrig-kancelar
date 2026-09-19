// Testy osy: přímka–oblouk–přímka (přesná geometrie), přechodnice (spojitost, délky), staničení bodu.
import { sestavOsu, bodNaOse, stanicenBodu, vykresliOsu } from '../geo/osa.js';
import { delka, smernik } from '../geo/zaklad.js';
import { gonDiff } from '../geo/uhly.js';

export const testy = [];
const t = (nazev, fn) => testy.push({ nazev, fn });
const blizko = (a, b, tol, co = '') => { if (!(Math.abs(a - b) <= tol)) throw new Error(`${co} ${a} ≠ ${b} (±${tol})`); };
const rovno = (a, b, co = '') => { if (a !== b) throw new Error(`${co} ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };

const V = [{ y: 745000, x: 1045000 }, { y: 745300, x: 1045000, R: 100 }, { y: 745300, x: 1045300 }];
t('osa: přímka–oblouk R100 (pravý úhel)–přímka: délky, hlavní body, tečna', () => {
    const o = sestavOsu(V, 1000);
    rovno(o.chyby.length, 0, o.chyby.join('; '));
    rovno(o.prvky.map((p) => p.typ).join(','), 'primka,oblouk,primka');
    blizko(o.prvky[0].delka, 200, 1e-9, 'T = R·tan(50g) = 100'); blizko(o.prvky[1].delka, Math.PI / 2 * 100, 1e-9); blizko(o.prvky[2].delka, 200, 1e-9);
    blizko(o.delka, 400 + Math.PI * 50, 1e-9);
    const TK = o.hlavni.find((h) => h.nazev === 'TK1'), KT = o.hlavni.find((h) => h.nazev === 'KT1'), KU = o.hlavni.find((h) => h.nazev === 'KÚ');
    blizko(TK.y, 745200, 1e-9); blizko(TK.x, 1045000, 1e-9); blizko(KT.y, 745300, 1e-9); blizko(KT.x, 1045100, 1e-9); blizko(KU.y, 745300, 1e-9); blizko(KU.x, 1045300, 1e-9);
    // střed oblouku: bod v polovině oblouku je ve vzdálenosti R od středu (745200, 1045100)
    const m = bodNaOse(o, 1200 + Math.PI * 25); blizko(delka(m, { y: 745200, x: 1045100 }), 100, 1e-9);
    blizko(m.sigma, 50, 1e-9, 'směrník uprostřed oblouku');
});
t('osa: bod ze staničení + kolmice, staničení bodu zpět (roundtrip)', () => {
    const o = sestavOsu(V, 0);
    for (const [st, k] of [[50, 0], [150, 3.5], [200 + 40, -2], [330, 1], [390, 0]]) {
        const b = bodNaOse(o, st, k); const r = stanicenBodu(o, b, 1);
        blizko(r.st, st, 1e-4, 'st ' + st); blizko(r.k, k, 1e-4, 'k ' + st);
    }
    rovno(bodNaOse(o, -1), null);
});
t('osa: přechodnice L=40, R=100 — spojitost, délka, tečnost na koncích', () => {
    const o = sestavOsu([{ y: 745000, x: 1045000 }, { y: 745300, x: 1045000, R: 100, L: 40 }, { y: 745300, x: 1045300 }], 0);
    rovno(o.chyby.length, 0, o.chyby.join('; '));
    rovno(o.prvky.map((p) => p.typ).join(','), 'primka,prechodnice,oblouk,prechodnice,primka');
    const body = vykresliOsu(o, 0.5);
    // sousední vzorky ~0,5 m od sebe (spojitost, žádné skoky)
    for (let i = 1; i < body.length; i++) { const d = delka(body[i - 1], body[i]); if (d > 0.51 || d < 0.05) throw new Error('skok ' + i + ' ' + d); }
    const PT = o.hlavni.find((h) => h.nazev === 'PT1'), KU = o.hlavni.find((h) => h.nazev === 'KÚ');
    blizko(PT.y, 745300, 1e-6, 'PT leží na koncové tečně (Y)'); blizko(smernik(PT, KU), 0, 1e-6, 'směr na KÚ = tečna');
    const posl = o.prvky[o.prvky.length - 1]; blizko(posl.sigma, 0, 1e-6, 'koncová přímka ve směru osy');
    blizko(o.prvky[1].delka + o.prvky[2].delka + o.prvky[3].delka, 40 + 100 * (Math.PI / 2 - 2 * 0.2) + 40, 1e-9);
    // roundtrip i na přechodnici
    for (const st of [o.prvky[1].st + 10, o.prvky[3].st + 25]) { const b = bodNaOse(o, st, 2); const r = stanicenBodu(o, b); blizko(r.st, st, 1e-3, 'st'); blizko(r.k, 2, 1e-3, 'k'); }
});
t('osa: oblouk R50 (pravý: západ → sever) a lom bez oblouku', () => {
    const o = sestavOsu([{ y: 745000, x: 1045000 }, { y: 745300, x: 1045000, R: 50 }, { y: 745300, x: 1044700 }, { y: 745500, x: 1044700 }], 0);
    rovno(o.chyby.length, 0); rovno(o.prvky.map((p) => p.typ).join(','), 'primka,oblouk,primka,primka');
    rovno(o.prvky[1].smer, 1, 'pravý (σ 100 → 200 g)'); const vb = o.hlavni.find((h) => h.nazev === 'VB2'); blizko(vb.y, 745300, 1e-9); blizko(vb.x, 1044700, 1e-9);
    const b = bodNaOse(o, 250 + 20, -1.5); const r = stanicenBodu(o, b); blizko(r.k, -1.5, 1e-4);
});
t('osa: tečny se nevejdou → chyba v seznamu', () => {
    const o = sestavOsu([{ y: 745000, x: 1045000 }, { y: 745050, x: 1045000, R: 100 }, { y: 745050, x: 1045300 }], 0); rovno(o.chyby.length > 0, true);
});
