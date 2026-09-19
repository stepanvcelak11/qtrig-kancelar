// Testy importu zápisníků, Křováka a exportů (syntetické vzorky podle dokumentace formátů).
import { rozpoznejFormat, ctiZapisnik } from '../js/import-totalka.js';
import { wgsToJtsk, jtskToWgs } from '../geo/krovak.js';
import { dxf, kml, geojson } from '../js/export.js';
import { ctiSeznam, zapisSeznam, odhadniPoradi } from '../js/soubory.js';

export const testy = [];
const t = (nazev, fn) => testy.push({ nazev, fn });
const blizko = (a, b, tol, co = '') => { if (!(Math.abs(a - b) <= tol)) throw new Error(`${co} ${a} ≠ ${b} (±${tol})`); };
const rovno = (a, b, co = '') => { if (a !== b) throw new Error(`${co} ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };

// GSI16: stanovisko 5001 (ih 1.550, Y 745000 X 1045000 H 300), orientace 5002 Hz 123.4567 g V 100.0000 SD 200.250, th 1.300
const GSI = [
    '*110001+0000000000005001 84..10+0000000745000000 85..10+0000001045000000 86..10+0000000000300000 88..10+0000000000001550',
    '*110002+0000000000005002 21.322+0000000012345670 22.322+0000000010000000 31..00+0000000000200250 87..10+0000000000001300',
    '*110003+0000000000000101 21.322+0000000005000000 22.322+0000000009950000 31..00+0000000000050000 71....+0000000000000PLOT',
].join('\n');
t('GSI16: stanovisko, orientace, záměra, kód, jednotky', () => {
    rovno(rozpoznejFormat(GSI, 'mereni.gsi'), 'gsi');
    const r = ctiZapisnik(GSI, 'gsi');
    rovno(r.stanoviska.length, 1); rovno(r.stanoviska[0].stanovisko, '5001'); blizko(r.stanoviska[0].vp, 1.55, 1e-9);
    rovno(r.body.length, 1); blizko(r.body[0].y, 745000, 1e-6); blizko(r.body[0].z, 300, 1e-6);
    const [o, z] = r.stanoviska[0].radky; rovno(o.cislo, '5002'); blizko(o.hz, 123.4567, 1e-9); blizko(o.z, 100, 1e-9); blizko(o.ds, 200.25, 1e-9); blizko(o.vc, 1.3, 1e-9);
    rovno(z.cislo, '101'); blizko(z.hz, 50, 1e-9); blizko(z.z, 99.5, 1e-9); rovno(z.kod, 'PLOT');
});
t('GSI8: záporné souřadnice → kladné, HD místo SD', () => {
    const g = '110001+00005001 84..10-45000000 85..10-65000000 88..10+00001500\n110002+00000101 21.322+05000000 32..00+00050000';
    const r = ctiZapisnik(g, 'gsi'); blizko(r.body[0].y, 45000, 1e-6); blizko(r.body[0].x, 65000, 1e-6); rovno(r.stanoviska[0].delky, 'vodorovne'); blizko(r.stanoviska[0].radky[0].ds, 50, 1e-9);
});
const SDR = [
    '00NMSDR33 V04-04.2                             111111 211112',
    '02TP5001            1045000.000     745000.000      300.000         1.550           ',
    '03NM1.300           ',
    '09F15001            5002            200.250         100.0000        123.4567        OR              ',
    '08KI101             1045040.000     745050.000      301.550         PLOT            ',
].join('\n');
t('SDR33: hlavička s gony, stanovisko, výška cíle, měření, souřadnice', () => {
    rovno(rozpoznejFormat(SDR), 'sdr33');
    const r = ctiZapisnik(SDR, 'sdr33');
    rovno(r.stanoviska[0].stanovisko, '5001'); blizko(r.stanoviska[0].vp, 1.55, 1e-9);
    const m = r.stanoviska[0].radky[0]; rovno(m.cislo, '5002'); blizko(m.ds, 200.25, 1e-9); blizko(m.z, 100, 1e-9); blizko(m.hz, 123.4567, 1e-9); blizko(m.vc, 1.3, 1e-9); rovno(m.kod, 'OR');
    rovno(r.body.length, 2); blizko(r.body[1].y, 745050, 1e-6); blizko(r.body[1].x, 1045040, 1e-6); rovno(r.body[1].kod, 'PLOT');
});
t('SDR33 ve stupních se převede', () => {
    const s = SDR.replace('111111 211112', '111111 111112'); const r = ctiZapisnik(s, 'sdr33'); blizko(r.stanoviska[0].radky[0].hz, 123.4567 * 400 / 360, 1e-9);
});
const GTS = ['GTS-7', 'JOB test', 'STN 5001,1.550,', 'XYZ 1045000.000,745000.000,300.000', 'BS 5002,1.300,', 'SD 111.0648,90.0000,200.250', 'SS 101,1.300,PLOT', 'SD 45.0000,89.3000,50.000'].join('\n');
t('GTS-7: ddd.mmss úhly, BS = orientace, SS = záměra', () => {
    rovno(rozpoznejFormat(GTS), 'gts7');
    const r = ctiZapisnik(GTS, 'gts7');
    const [o, z] = r.stanoviska[0].radky; rovno(o.typ, 'o'); blizko(o.hz, (111 + 6 / 60 + 48 / 3600) * 400 / 360, 1e-6); blizko(o.z, 100, 1e-9); blizko(o.ds, 200.25, 1e-9);
    rovno(z.typ, 'z'); blizko(z.hz, 50, 1e-9); blizko(z.z, (89.5) * 400 / 360, 1e-9); rovno(z.kod, 'PLOT'); blizko(r.body[0].y, 745000, 1e-6);
});
t('GTS-7 s gony (auto podle >360)', () => {
    const g = 'STN 5001,1.5,\nSS 101,1.3,\nSD 380.1234,99.5,50.0'; const r = ctiZapisnik(g, 'gts7'); blizko(r.stanoviska[0].radky[0].hz, 380.1234, 1e-9);
});
const NIK = ['CO,Nikon RAW', 'ST,5001,,5002,,1.550,0.0000,0.0000', 'SS,5002,1.300,200.250,123.4567,100.0000,10:00:00,OR', 'SS,101,1.300,50.000,50.0000,99.5000,10:01:00,PLOT', 'MP,5002,,1045010.000,745200.000,302.500,'].join('\n');
t('Nikon RAW s gony', () => {
    rovno(rozpoznejFormat(NIK, 'a.raw'), 'nikon');
    const r = ctiZapisnik(NIK, 'nikon', { uhly: 'gon' });
    rovno(r.stanoviska[0].stanovisko, '5001'); blizko(r.stanoviska[0].vp, 1.55, 1e-9);
    const [o, z] = r.stanoviska[0].radky; blizko(o.hz, 123.4567, 1e-9); blizko(o.ds, 200.25, 1e-9); blizko(z.z, 99.5, 1e-9); rovno(z.kod, 'PLOT');
    blizko(r.body[0].y, 745200, 1e-6); blizko(r.body[0].x, 1045010, 1e-6);
});
const M5 = [
    'For M5|Adr     1|PI1  5001                       |ih        1.550 m   |Y      745000.000 m   |X     1045000.000 m   |',
    'For M5|Adr     2|PI1  5002                       |th        1.300 m   |                    |                    |',
    'For M5|Adr     3|PI1  5002                       |Hz     123.4567 gon |V1     100.0000 gon |SD      200.250 m   |',
    'For M5|Adr     4|PI1  101       PLOT             |Hz      50.0000 gon |V1      99.5000 gon |SD       50.000 m   |',
].join('\n');
t('Trimble M5: ih = stanovisko, th, Hz/V1/SD, kód v PI', () => {
    rovno(rozpoznejFormat(M5, 'm.m5'), 'm5');
    const r = ctiZapisnik(M5, 'm5');
    rovno(r.stanoviska[0].stanovisko, '5001'); blizko(r.stanoviska[0].vp, 1.55, 1e-9); blizko(r.body[0].y, 745000, 1e-6);
    const [o, z] = r.stanoviska[0].radky; rovno(o.cislo, '5002'); blizko(o.hz, 123.4567, 1e-9); blizko(o.vc, 1.3, 1e-9); blizko(o.ds, 200.25, 1e-9);
    rovno(z.cislo, '101'); rovno(z.kod, 'PLOT'); blizko(z.z, 99.5, 1e-9);
});

t('Křovák: Praha a Brno ↔ WGS84 (shoda s proj4 ±5 cm), roundtrip', () => {
    const p = wgsToJtsk(50.0755, 14.4378); blizko(p.y, 741817.82, 0.05); blizko(p.x, 1044492.54, 0.05);
    const b = wgsToJtsk(49.1951, 16.6068); blizko(b.y, 598248.81, 0.05); blizko(b.x, 1160744.69, 0.05);
    const w = jtskToWgs(p.y, p.x); blizko(w.lat, 50.0755, 1e-7); blizko(w.lng, 14.4378, 1e-7);
    const w2 = jtskToWgs(-p.y, -p.x); blizko(w2.lat, 50.0755, 1e-7);
});
t('Export DXF/KML/GeoJSON', () => {
    const body = [{ cislo: '1', y: 745000, x: 1045000, z: 300, kod: 'PLOT' }, { cislo: '2', y: 745100, x: 1045000, z: null, kod: '' }];
    const d = dxf(body); if (!d.includes('\nPOINT\n') || !d.includes('-745000.000') || !d.includes('\nPLOT\n') || !d.endsWith('EOF\n')) throw new Error('DXF');
    const k = kml(body); if (!k.includes('<Placemark><name>1</name>') || !k.includes('14.3')) throw new Error('KML ' + k.slice(0, 300));
    const g = JSON.parse(geojson(body)); rovno(g.features.length, 2); rovno(g.features[0].properties.kod, 'PLOT'); blizko(g.features[0].geometry.coordinates[1], 50.08, 0.05);
});
t('Seznam souřadnic: odhad pořadí, čtení, zápis', () => {
    const txt = '5001  745000.000  1045000.000  300.00 PBPP\n5002 745200.000 1045010.000\n# komentar\nchyba';
    rovno(odhadniPoradi(txt.split('\n')), 'groma-yx');
    const g = ctiSeznam('5001 745000.00 1045000.00 300.15 3 roh plotu\n5002 745200.00 1045010.00 PBPP', 'groma-yx'); rovno(g.body[0].kvalita, '3'); rovno(g.body[0].kod, 'roh plotu'); blizko(g.body[0].z, 300.15, 1e-9); rovno(g.body[1].z, null); rovno(g.body[1].kod, 'PBPP');
    const r = ctiSeznam(txt, 'c y x z k'); rovno(r.body.length, 2); rovno(r.chyby.length, 1); rovno(r.body[0].kod, 'PBPP'); blizko(r.body[1].y, 745200, 1e-9); rovno(r.body[1].z, null);
    const csv = 'Cislo;Y;X;Z\n1;745000,5;1045000,25;300,1'; const c = ctiSeznam(csv, 'c y x z'); rovno(c.body.length, 1); blizko(c.body[0].y, 745000.5, 1e-9);
    const out = zapisSeznam(r.body, 'txt'); if (!out.startsWith('5001') || !out.includes('745000.000')) throw new Error(out);
    const out2 = zapisSeznam(r.body, 'csv'); if (!out2.startsWith('Cislo;Y;X;Z;Kod\n5001;745000,000')) throw new Error(out2);
});
