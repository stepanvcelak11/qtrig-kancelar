// Uživatelský formát Groma (příloha 44): předpis, export, import pevný i volný.
import { rozeberFormat, radekPodleFormatu, exportPodleFormatu, importPodleFormatu, polozkyBodu, polozkyMereni } from '../js/format-uziv.js';
export const testy = [];
const t = (nazev, fn) => testy.push({ nazev, fn });
const rovno = (a, b, co = '') => { if (a !== b) throw new Error(`${co} ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };
const blizko = (a, b, tol, co = '') => { if (!(Math.abs(a - b) <= tol)) throw new Error(`${co} ${a} ≠ ${b}`); };
const B = { cislo: '610844000140001', y: 750010.9, x: 1044109.82, z: 150.445, kod: 'PBPP', kvalita: '3' };
t('rozbor předpisu <ID,volby:příznakyšířka:des>', () => {
    const c = rozeberFormat('<P:6><N:04>, X=<X>, Y=<Y:14:4> <B,DMS:U10:8>');
    rovno(c.length, 8); rovno(c[0].id, 'P'); rovno(c[0].sirka, 6); rovno(c[1].priznaky, '0'); rovno(c[1].sirka, 4); rovno(c[2].text, ', X='); rovno(c[5].des, 4); rovno(c[7].volby, 'DMS'); rovno(c[7].priznaky, 'U');
});
t('příklady z příručky (tab. 44.5)', () => {
    const h = polozkyBodu({ ...B, cislo: '1' });
    rovno(radekPodleFormatu('<N> <X> <Y>', h), '1 1044109.820 750010.900');
    rovno(radekPodleFormatu('<N:4> <X:14:4> <Y:14:4>', h), '   1   1044109.8200    750010.9000'); // šířka 14 = 2 mezery + 12 znaků
    rovno(radekPodleFormatu('<N:04>, <X>, <Y>', h), '0001, 1044109.820, 750010.900');
    const hb = polozkyBodu(B); rovno(radekPodleFormatu('<P:6><N:04>, X=<X>, Y=<Y>', { ...hb, P: '100001', N: '1' }), '1000010001, X=1044109.820, Y=750010.900');
    const r = radekPodleFormatu('<NUM:15> <B,DEG:10:8> <L,DEG:10:8> <H:9:3>', h); rovno(r.slice(0, 15), '              1'); if (!/ 50\.\d{8} 14\.\d{8}   150\.445$/.test(r)) throw new Error(r);
    const dms = radekPodleFormatu('<B,DMS:U12:4>', h); if (!/^\s*50°\d\d’\d\d\.\d{4}”$/.test(dms)) throw new Error(dms);
});
t('měření: <N> <HZ> <D> <DH> <SIG> <CODE>', () => {
    const s = { stanovisko: '5001', vp: 1.55 }, m = { cislo: '1', hz: 28.7894, z: 97.4, ds: 14.37, vc: 1.3, kod: 'PBPP', typ: 'z' };
    const r = radekPodleFormatu('<N> <HZ> <D> <DH> <SIG> <CODE>', polozkyMereni(s, m)); if (!/^1 28\.7894 14\.370 0\.\d{3} 1\.300 PBPP$/.test(r)) throw new Error(r);
    const deg = radekPodleFormatu('<HZ,DEG:10:4>', polozkyMereni(s, m)); blizko(parseFloat(deg), 28.7894 * 0.9, 1e-4);
});
t('import volný formát (tab. 44 příklad) a pevný formát', () => {
    const v = importPodleFormatu('<N> <X> <Y>', '8 1045656.12 740143.45\n9 1045778.3 740227.66\n10 1045771.13 740439.01'); rovno(v.length, 3); rovno(v[2].N, '10'); blizko(v[1].X, 1045778.3, 1e-9); blizko(v[0].Y, 740143.45, 1e-9);
    const pev = importPodleFormatu('<P:6><N:04>, X=<X:10>, Y=<Y:10>', '1000010001, X=1044109.8, Y= 750010.9', true); rovno(pev.length, 1); rovno(pev[0].P, '100001'); rovno(pev[0].N, '0001'); blizko(pev[0].X, 1044109.8, 1e-9); rovno(pev[0].NUM, '100001000000001'.slice(0, 15));
    const m = importPodleFormatu('<NUM> <HZ,DEG> <V> <D> <SIG> <CODE>', '101 90.0 100.0 12.5 1.3 roh plotu'); blizko(m[0].HZ, 100, 1e-9); rovno(m[0].CODE, 'roh plotu');
    const ex = exportPodleFormatu('<NUM>;<Y>;<X>', [polozkyBodu(B)]); rovno(ex, '610844000140001;750010.900;1044109.820\n');
});
