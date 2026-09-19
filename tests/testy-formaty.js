// Formáty podle Gromy: katastr, XYZ/CSV, bez čísel, dvojí, KOKEŠ, dBASE, XLSX (zip), XML, GSI/SDR/Topcon/Geodimeter, CP1250.
import { exportKatastr, exportXYZ, importBezCisel, importDvoji, exportKokes, exportDBF, importDBF, exportXLSX, importXLSX, exportXML, importXML, exportGSI, exportSDR, exportTopcon, exportGeodimeter, importGeodimeter } from '../js/formaty.js';
import { ctiZapisnik } from '../js/import-totalka.js';
import { doCP1250 } from '../js/protokol.js';
export const testy = [];
const t = (nazev, fn) => testy.push({ nazev, fn });
const rovno = (a, b, co = '') => { if (a !== b) throw new Error(`${co} ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };
const blizko = (a, b, tol, co = '') => { if (!(Math.abs(a - b) <= tol)) throw new Error(`${co} ${a} ≠ ${b}`); };
const B = [{ cislo: '625141042130400', y: 747791.354, x: 965566.351, z: null, kvalita: '3', kod: 'roh' }, { cislo: '625141042130401', y: 747756.98, x: 965566.4, z: 300.123, kvalita: null, kod: '' }];
t('souřadnice pro katastr — ukázka z příručky', () => { const r = exportKatastr(B).split('\n'); rovno(r[0], '625141042130400     747791.35     965566.35       0.00    3'); rovno(r[1].trim().split(/\s+/)[4], '3'); });
t('XYZ / YXZ / CSV a import bez čísel, dvojí souřadnice', () => {
    rovno(exportXYZ(B, 'yxz').split('\n')[0], '625141042130400 747791.354 965566.351 3 roh'); rovno(exportXYZ(B, 'xyz', true).split('\n')[1], '625141042130401,965566.400,747756.980,300.123');
    const b = importBezCisel('-747791.35 -965566.35 300\n-747756.98 -965566.40', 5); rovno(b.length, 2); rovno(b[0].cislo, '5'); blizko(b[0].y, 747791.35, 1e-9); blizko(b[0].z, 300, 1e-9);
    const d = importDvoji('101 747791.35 965566.35 300 747791.40 965566.30 0 3 plot roh'); rovno(d.length, 1); blizko(d[0].y2, 747791.4, 1e-9); rovno(d[0].kvalita, '3'); rovno(d[0].kod, 'plot roh');
});
t('KOKEŠ .stx a XML tam a zpět', () => {
    const k = exportKokes(B); if (!k.startsWith(';KOKES') || !k.includes('625141042130400 747791.354 965566.351 roh')) throw new Error(k);
    const x = importXML(exportXML(B, 'test')); rovno(x.length, 2); rovno(x[0].cislo, '625141042130400'); blizko(x[1].z, 300.123, 1e-9); rovno(x[0].kod, 'roh'); rovno(x[0].kvalita, '3');
});
t('dBASE III podle tab. 12-1 tam a zpět', () => {
    const buf = exportDBF([{ ...B[0], cislo: '625141042130400' }, B[1]]); rovno(buf[0], 3); const r = importDBF(buf); rovno(r.length, 2); blizko(r[0].y, 747791.35, 1e-9); blizko(r[0].x, 965566.35, 1e-9); rovno(r[0].kvalita, '3'); blizko(r[1].z, 300.12, 1e-9);
});
t('XLSX zapsat a přečíst (zip store, inline strings)', async () => {
    const z = exportXLSX([{ list: 'Souřadnice', hlavicka: ['Číslo', 'Y', 'X', 'Z', 'Kód'], radky: [['1', 745000.123, 1045000.5, 300, 'roh plotu'], ['610844000140002', 745010, 1045020, null, '']] }]);
    rovno(z[0], 0x50); rovno(z[1], 0x4b); const r = await importXLSX(z.buffer); rovno(r.length, 3); rovno(r[0][0], 'Číslo'); blizko(r[1][1], 745000.123, 1e-9); rovno(r[1][4], 'roh plotu'); rovno(r[2][0], '610844000140002');
});
t('výstupy do záznamníků: GSI16, SDR33, Topcon, Geodimeter (+ zpětné čtení GSI)', () => {
    const g = exportGSI(B, true); const r = ctiZapisnik(g, 'gsi'); rovno(r.body.length, 2); blizko(r.body[0].y, 747791.354, 1e-9); blizko(r.body[1].z, 300.123, 1e-9); rovno(r.body[0].cislo, '625141042130400');
    const s = exportSDR(B); const rs = ctiZapisnik(s, 'sdr33'); rovno(rs.body.length, 2); blizko(rs.body[0].x, 965566.351, 1e-9);
    rovno(exportTopcon(B).split('\n')[0], '625141042130400,965566.351,747791.354,,roh');
    const ge = exportGeodimeter(B); const rg = importGeodimeter(ge); rovno(rg.body.length, 2); blizko(rg.body[0].y, 747791.354, 1e-9);
    const m = importGeodimeter('5=5001\n3=1.55\n2=5002\n6=1.3\n7=123.4567\n8=100.0\n9=200.25\n2=101\n7=50.0\n8=99.5\n9=50.0\n4=PLOT'); rovno(m.stanoviska[0].stanovisko, '5001'); blizko(m.stanoviska[0].vp, 1.55, 1e-9); rovno(m.stanoviska[0].radky.length, 2); blizko(m.stanoviska[0].radky[0].hz, 123.4567, 1e-9); rovno(m.stanoviska[0].radky[1].kod, 'PLOT');
});
t('CP1250: české znaky', () => { const b = doCP1250('Příliš žluťoučký kůň'); rovno(b[1], 0xF8); rovno(b[7], 0x9E); rovno(b.length, 20); rovno(b[0], 80); });
