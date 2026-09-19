// MAPA2 (.zap) — vzorový soubor z příručky GROMA + skutečný zápisník Topcon (Husovice, 19. 9. 2026, výřez).
import { rozpoznejFormat, ctiZapisnik, prumerujPolohy, plneCislo } from '../js/import-totalka.js';

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
const TOPCON = [';Zakazka:HUSOVICE', '9999', '999999999', '610844000XX', '1', '3', '0', '2', '1 4001        1.57 *',
    '944212300   63.623   1.250   0.0000   99.9420', '944212300   63.632   1.250 200.0035  300.0515',
    '4002        21.476   1.250 128.6430  109.0400', '4002        21.475   1.250 328.6498  290.9658', '-1',
    'JM-071-519   117.739  1.250  171.8531  101.4702', '1           27.112  1.250  159.1520  101.5320', '16          14.595  2.000  138.0070  100.1690', '/', '-2'].join('\n');
t('Topcon MAPA2 (skutečný .zap): hlavička, stanovisko s výškou, sloupce d·vc·Hz·Z, obě polohy průměrované', () => {
    rovno(rozpoznejFormat(TOPCON, 'zap_husovice.zap'), 'mapa2');
    const r = ctiZapisnik(TOPCON, 'mapa2');
    rovno(r.hlavicka.zakazka, 'HUSOVICE'); rovno(r.hlavicka.predcisli, '610844000XX');
    const s = r.stanoviska[0]; rovno(s.stanovisko, '4001'); blizko(s.vp, 1.57, 1e-9); rovno(s.delky, 'sikme');
    const o = s.radky.filter((x) => x.typ === 'o'); rovno(o.length, 2, 'dvě orientace po zprůměrování poloh');
    blizko(o[0].hz, 0.00175, 1e-6, 'Hz průměr I+II'); blizko(o[0].z, (99.9420 + 400 - 300.0515) / 2, 1e-9, 'Z průměr'); blizko(o[0].ds, 63.6275, 1e-9); blizko(o[0].vc, 1.25, 1e-9);
    blizko(o[1].hz, (128.6430 + 128.6498) / 2, 1e-9); rovno(o[0].pozn, 'I+II'); blizko(o[0].dvePolohy.dHz, 0.0035, 1e-9);
    const z = s.radky.filter((x) => x.typ === 'z'); rovno(z.length, 3); rovno(z[0].cislo, 'JM-071-519'); blizko(z[0].ds, 117.739, 1e-9); blizko(z[0].hz, 171.8531, 1e-9); blizko(z[0].z, 101.4702, 1e-9); blizko(z[2].vc, 2.0, 1e-9);
    const r2 = ctiZapisnik(TOPCON, 'mapa2', { dvePolohy: false }); rovno(r2.stanoviska[0].radky.filter((x) => x.typ === 'o').length, 4);
});
t('plné číslo bodu z předčíslí (k. ú. 6 + ZPMZ 5 + bod 4)', () => {
    rovno(plneCislo('4001', '61084400014'), '610844000144001'); rovno(plneCislo('1', '61084400014'), '610844000140001');
    rovno(plneCislo('944212300', '61084400014'), '000000944212300'); rovno(plneCislo('JM-071-519', '61084400014'), 'JM-071-519'); rovno(plneCislo('4001', ''), '4001');
});
t('průměrování poloh přes 0/400 g', () => {
    const r = prumerujPolohy([{ cislo: 'a', hz: 399.9990, z: 100.001, ds: 10 }, { cislo: 'a', hz: 200.0010, z: 299.997, ds: 10.002 }]);
    rovno(r.length, 1); blizko(r[0].hz, 0, 1e-9); blizko(r[0].z, 100.002, 1e-9); blizko(r[0].ds, 10.001, 1e-9);
});
t('MAPA2 ortogonální úloha (typ 0) se načte s varováním', () => {
    const z = ['512', 'z', 'k', '1', '3', '0', '0', '0 4300000517 0. 0.', '4300005001 63.72 0.', '-1', '1 0.52 3.10', '2 10.73 2.03', '/', '-2'].join('\n');
    const r = ctiZapisnik(z, 'mapa2'); rovno(r.stanoviska[0].stanovisko, '4300000517'); rovno(r.stanoviska[0].radky.length, 3); rovno(r.varovani.some((v) => v.includes('Ortogonální')), true);
});
