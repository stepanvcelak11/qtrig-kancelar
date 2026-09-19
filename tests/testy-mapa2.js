// MAPA2 (.zap) — vzorový soubor z příručky GROMA 11 (kap. 11) + varianta zápisníku totálky.
import { rozpoznejFormat, ctiZapisnik } from '../js/import-totalka.js';

export const testy = [];
const t = (nazev, fn) => testy.push({ nazev, fn });
const blizko = (a, b, tol, co = '') => { if (!(Math.abs(a - b) <= tol)) throw new Error(`${co} ${a} ≠ ${b} (±${tol})`); };
const rovno = (a, b, co = '') => { if (a !== b) throw new Error(`${co} ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };

const DAVKA = ['512', '360607101', '660205', '1', '3', '0', '0', '',
    '1  6600004059', '6600004055 68.32 0.', '6600000548 93.39 201.433', '0924222160 0. 105.01', '-1',
    '1 13.74 275.01', '6 24.29 290.17 : 0. -0.15', '16 37.01 318.25', '/',
    '1 6600004066', '6600004059 18.26 0.', '-1', '19 10.93 215.35', '/', '-2'].join('\n');
t('MAPA2 dávka z příručky Groma: 2 stanoviska, orientace, body, excentricita', () => {
    rovno(rozpoznejFormat(DAVKA, 'mereni.zap'), 'mapa2');
    const r = ctiZapisnik(DAVKA, 'mapa2');
    rovno(r.stanoviska.length, 2); rovno(r.stanoviska[0].stanovisko, '6600004059'); rovno(r.stanoviska[1].stanovisko, '6600004066');
    const s = r.stanoviska[0]; rovno(s.delky, 'vodorovne');
    const o = s.radky.filter((x) => x.typ === 'o'); rovno(o.length, 3); blizko(o[0].ds, 68.32, 1e-9); blizko(o[0].hz, 0, 1e-9); blizko(o[1].hz, 201.433, 1e-9); rovno(o[2].ds, null, 'délka 0 = neměřena');
    const z = s.radky.filter((x) => x.typ === 'z'); rovno(z.length, 3); rovno(z[0].cislo, '1'); blizko(z[0].ds, 13.74, 1e-9); blizko(z[0].hz, 275.01, 1e-9);
    rovno(z[1].kod.startsWith('excentr 0. -0.15'), true, z[1].kod);
    rovno(r.stanoviska[1].radky.length, 2); blizko(r.stanoviska[1].radky[1].hz, 215.35, 1e-9);
});
t('MAPA2 zápisník totálky (Hz, zenit, šikmá, vc, kód)', () => {
    const z = ['512', 'zak', 'ku', '1', '3', '0', '0', '1 5001 1.550', '5002 123.4567 100.0000 200.250 1.300 OR', '-1', '101 50.0000 99.5000 50.000 1.300 PLOT', '102 60.0000 100.2000 40.000 1.300', '/', '-2'].join('\n');
    const r = ctiZapisnik(z, 'mapa2'); const s = r.stanoviska[0]; rovno(s.stanovisko, '5001'); blizko(s.vp, 1.55, 1e-9); rovno(s.delky, 'sikme');
    rovno(s.radky[0].typ, 'o'); blizko(s.radky[0].hz, 123.4567, 1e-9); blizko(s.radky[0].z, 100, 1e-9); blizko(s.radky[0].ds, 200.25, 1e-9); blizko(s.radky[0].vc, 1.3, 1e-9); rovno(s.radky[0].kod, 'OR');
    rovno(s.radky[1].typ, 'z'); rovno(s.radky[1].kod, 'PLOT'); blizko(s.radky[2].z, 100.2, 1e-9);
});
t('MAPA2 ortogonální úloha (typ 0) se načte s varováním', () => {
    const z = ['512', 'z', 'k', '1', '3', '0', '0', '0 4300000517 0. 0.', '4300005001 63.72 0.', '-1', '1 0.52 3.10', '2 10.73 2.03', '/', '-2'].join('\n');
    const r = ctiZapisnik(z, 'mapa2'); rovno(r.stanoviska[0].stanovisko, '4300000517'); rovno(r.stanoviska[0].radky.length, 3); rovno(r.varovani.some((v) => v.includes('Ortogonální')), true);
});
