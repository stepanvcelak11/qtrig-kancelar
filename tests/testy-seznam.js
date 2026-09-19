// Nástroje seznamu podle Gromy: výrazy hromadné změny, skládání čísel bodů, mapové listy.
import { vyhodnot, rozlozCislo, slozCislo, mapovyListSM5 } from '../js/seznam-nastroje.js';
export const testy = [];
const t = (nazev, fn) => testy.push({ nazev, fn });
const rovno = (a, b, co = '') => { if (a !== b) throw new Error(`${co} ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };
const blizko = (a, b, tol, co = '') => { if (!(Math.abs(a - b) <= tol)) throw new Error(`${co} ${a} ≠ ${b}`); };
t('rozklad a složení čísla bodu (k. ú. 6 + ZPMZ 5 + bod 4)', () => {
    const r = rozlozCislo('610844000144001'); rovno(r.ku, '610844'); rovno(r.zpmz, '00014'); rovno(r.cislo, '4001'); rovno(r.predcisli, '61084400014');
    rovno(slozCislo('61084400014', '1'), '610844000140001'); rovno(slozCislo('61084400014', '944212300'), '000000944212300'); rovno(slozCislo('', '5'), '5'); rovno(rozlozCislo('JM-071-519').predcisli, '');
});
t('výrazy hromadné změny: proměnné a funkce jako v Gromě', () => {
    const b = { cislo: '610844000144001', y: 745000, x: 1045000, z: 300, kod: 'PLOT', kvalita: '3' };
    blizko(vyhodnot('Y+10', b), 745010, 1e-9); rovno(vyhodnot('N+1000', b), 5001); rovno(vyhodnot('ZPMZ', b), 14); rovno(vyhodnot('FSU', b), 610844); rovno(vyhodnot('CODE', b), 'PLOT'); rovno(vyhodnot('PREC*2', b), 6);
    blizko(vyhodnot('sqrt(X*X)', b), 1045000, 1e-6); blizko(vyhodnot('RO', b), 200 / Math.PI, 1e-9); rovno(vyhodnot('round(Z*10)/10', b), 300);
    let err = null; try { vyhodnot('alert(1)', b); } catch (e) { err = e; } rovno(!!err, true, 'neznámý identifikátor musí selhat');
});
t('mapový list SM5 z S-JTSK', () => { const m = mapovyListSM5(745123, 1045678); rovno(m.list50, '29-52'); rovno(m.sm5, `${10 - Math.floor((745123 - 725000) / 2500)}-${Math.floor((1045678 - 1040000) / 2000) + 1}`); });
