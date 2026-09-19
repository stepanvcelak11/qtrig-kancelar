// Import zápisníků z totálních stanic. Každý čtecí modul vrací společnou strukturu:
//   { stanoviska:[{ stanovisko, vp, radky:[{ cislo, hz, z, ds, vc, kod, typ }] , delky:'sikme'|'vodorovne' }],
//     body:[{ cislo, y, x, z, kod }], varovani:[string], format }
// Úhly se převádějí do gonů, délky do metrů. Šikmá délka ds + zenit z; když je v souboru jen
// vodorovná délka, ukládá se do ds a stanovisko má delky = 'vodorovne'.
// Formáty jsou napsané podle dokumentace výrobců; ověřit na skutečných souborech!
import { deg2gon, gonNorm, gonDiff } from '../geo/uhly.js';
import { importGeodimeter } from './formaty.js';
function ctiGeodimeter(text) { return importGeodimeter(text); }

const dmsToGon = (v) => { // ddd.mmss (Topcon) nebo dddmmss.s → gon
    const d = Math.trunc(v), m = Math.trunc((v - d) * 100 + 1e-9), s = ((v - d) * 100 - m) * 100;
    return deg2gon(d + m / 60 + s / 3600);
};

/** Rozpozná formát podle obsahu */
export function rozpoznejFormat(text, nazev = '') {
    const t = text.slice(0, 4000), n = nazev.toLowerCase();
    if (/^\*?11\d{4}[+-]/m.test(t) || n.endsWith('.gsi')) return 'gsi';
    if (/^00NMSDR/m.test(t) || n.endsWith('.sdr')) return 'sdr33';
    if (/^GTS-7/m.test(t) || /^(STN|SS|BS|SD)\s/m.test(t)) return 'gts7';
    if (/^For M5\|/m.test(t) || n.endsWith('.m5') || n.endsWith('.dat') && /\|Hz\s/.test(t)) return 'm5';
    if (/^(ST|SS|MP|CO),/m.test(t) || n.endsWith('.raw')) return 'nikon';
    if (/^\d+=/m.test(t) && /^(5|2|7)=/m.test(t)) return 'geodimeter';
    if (n.endsWith('.zap') || /^\s*-2\s*$/m.test(t) && /^\s*\/\s*$/m.test(t) || /^\s*-1\s*$/m.test(t)) return 'mapa2';
    return null;
}
export const FORMATY = { geodimeter: 'Geodimeter (label=hodnota)', mapa2: 'MAPA2 / Groma zápisník (.zap, .asc)', gsi: 'Leica GSI8/GSI16', sdr33: 'Sokkia SDR33', gts7: 'Topcon GTS-7', nikon: 'Nikon RAW', m5: 'Trimble/Zeiss M5' };

export function ctiZapisnik(text, format, volby = {}) {
    const f = { gsi: ctiGSI, sdr33: ctiSDR, gts7: ctiGTS7, nikon: ctiNikon, m5: ctiM5, mapa2: ctiMapa2, geodimeter: ctiGeodimeter }[format];
    if (!f) throw new Error('Neznámý formát zápisníku');
    const r = f(text, volby); r.format = format;
    // typ řádku: orientace = cíl existuje v seznamu souřadnic (doplní UI), zde výchozí 'z'
    r.stanoviska.forEach((s) => s.radky.forEach((x) => { if (!x.typ) x.typ = 'z'; }));
    return r;
}

// pomocný sběrač
function sber() {
    const r = { stanoviska: [], body: [], varovani: [] }; let akt = null;
    r.stan = (cislo, vp = 0) => { akt = { stanovisko: String(cislo), vp: vp || 0, radky: [], delky: 'sikme' }; r.stanoviska.push(akt); return akt; };
    r.radek = (x) => { if (!akt) { akt = r.stan('?'); r.varovani.push('Měření před prvním stanoviskem — přiřazeno stanovisku „?“'); } akt.radky.push(x); };
    r.akt = () => akt;
    r.bod = (b) => { if (b.cislo && b.y != null && b.x != null) r.body.push(b); };
    return r;
}
const absNeg = (v) => v == null ? null : Math.abs(v); // S-JTSK v totálkách často se záporným znaménkem

// ---------------- Leica GSI ----------------
function ctiGSI(text) {
    const r = sber(); let th = null;
    for (const raw of text.split(/\r?\n/)) {
        let line = raw.trim(); if (!line) continue;
        const gsi16 = line.startsWith('*'); if (gsi16) line = line.slice(1);
        const L = gsi16 ? 24 : 16; const w = {};
        for (let i = 0; i + 7 <= line.length; i += L) {
            const word = line.slice(i, i + L); if (word.length < 8) break;
            const wi = word.slice(0, 2), info = word.slice(2, 6), sign = word[6], data = word.slice(7).trim();
            const num = parseFloat((sign === '-' ? '-' : '') + data.replace(/^0+(?=\d)/, ''));
            w[wi] = { info, data, num, unit: info[3], txt: data.replace(/^0+(?=.)/, '') }; // 6. znak slova = jednotky
        }
        if (!Object.keys(w).length) continue;
        const uhel = (x) => { if (!x) return null; const u = x.unit; const v = x.num; return u === '2' ? v / 1e5 : u === '3' ? deg2gon(v / 1e5) : u === '4' ? dmsToGon(v / 1e5) : v / 1e5; };
        const delka = (x) => { if (!x) return null; const u = x.unit; return u === '6' ? x.num / 1e4 : u === '8' ? x.num / 1e5 : u === '1' || u === '7' ? x.num / 1e3 * 0.3048 : x.num / 1e3; };
        const pn = w['11'] ? w['11'].txt : '';
        const kod = (w['71'] && w['71'].txt) || (w['41'] && w['41'].txt) || '';
        if (w['88'] || w['84'] || w['85']) { // stanovisko
            const s = r.stan(pn, delka(w['88']));
            if (w['84'] && w['85']) r.bod({ cislo: pn, y: absNeg(delka(w['84'])), x: absNeg(delka(w['85'])), z: delka(w['86']), kod });
            continue;
        }
        if (w['87']) th = delka(w['87']);
        if (w['21'] && (w['31'] || w['32'])) {
            const ds = delka(w['31']), hd = delka(w['32']);
            r.radek({ cislo: pn, hz: gonNorm(uhel(w['21'])), z: uhel(w['22']), ds: ds ?? hd, vc: th ?? 0, kod });
            if (ds == null && hd != null) r.akt().delky = 'vodorovne';
            if (w['81'] && w['82']) r.bod({ cislo: pn, y: absNeg(delka(w['81'])), x: absNeg(delka(w['82'])), z: delka(w['83']), kod });
        } else if (w['81'] && w['82']) r.bod({ cislo: pn, y: absNeg(delka(w['81'])), x: absNeg(delka(w['82'])), z: delka(w['83']), kod });
    }
    return r;
}

// ---------------- Sokkia SDR33 ----------------
function ctiSDR(text) {
    const r = sber(); let uhly = 'deg', th = 0, sirka = 16;
    const f = (line, i) => line.slice(4 + i * sirka, 4 + (i + 1) * sirka).trim();
    const num = (s) => { const v = parseFloat(s); return isFinite(v) ? v : null; };
    const uhel = (s) => { const v = num(s); if (v == null) return null; return uhly === 'gon' ? v : uhly === 'mil' ? v * 400 / 6400 : deg2gon(v); };
    for (const line of text.split(/\r?\n/)) {
        if (line.length < 4) continue;
        const typ = line.slice(0, 2);
        if (typ === '00') { const m = line.match(/(\d)(\d)(\d)(\d)(\d)(\d)?\s*$/); if (m) uhly = m[1] === '2' ? 'gon' : m[1] === '3' ? 'mil' : 'deg'; if (/SDR2/.test(line)) sirka = 10; continue; }
        if (typ === '02') { const st = f(line, 0), N = num(f(line, 1)), E = num(f(line, 2)), Z = num(f(line, 3)), ih = num(f(line, 4)); r.stan(st, ih || 0); if (N != null && E != null) r.bod({ cislo: st, y: absNeg(E), x: absNeg(N), z: Z }); continue; }
        if (typ === '03') { th = num(f(line, 0)) || 0; continue; }
        if (typ === '08') { const pn = f(line, 0), N = num(f(line, 1)), E = num(f(line, 2)), Z = num(f(line, 3)), kod = f(line, 4); r.bod({ cislo: pn, y: absNeg(E), x: absNeg(N), z: Z, kod }); continue; }
        if (typ === '09') { const pn = f(line, 1) || f(line, 0), sd = num(f(line, 2)), va = uhel(f(line, 3)), ha = uhel(f(line, 4)), kod = f(line, 5); if (ha != null) r.radek({ cislo: pn, hz: gonNorm(ha), z: va, ds: sd, vc: th, kod }); continue; }
    }
    if (uhly !== 'gon') r.varovani.push('Úhly v souboru jsou ve ' + (uhly === 'deg' ? 'stupních' : 'milech') + ' — převedeny na gony.');
    return r;
}

// ---------------- Topcon GTS-7 ----------------
function ctiGTS7(text, volby) {
    const r = sber(); let cekaji = null; // poslední SS/BS řádek čeká na SD/HD/HV
    const uhly = volby.uhly || 'auto'; let maxUhel = 0;
    const radky = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    radky.forEach((l) => { const m = l.match(/^(SD|HV)\s+([\d.]+),([\d.]+)/); if (m) maxUhel = Math.max(maxUhel, +m[2], +m[3]); });
    const rezim = uhly === 'auto' ? (maxUhel > 360 ? 'gon' : 'dms') : uhly;
    const uhel = (s) => { const v = parseFloat(s); if (!isFinite(v)) return null; return rezim === 'gon' ? v : rezim === 'deg' ? deg2gon(v) : dmsToGon(v); };
    for (const l of radky) {
        const [tag, ...rest] = l.split(/\s+/); const pole = rest.join(' ').split(',');
        if (tag === 'STN') { r.stan(pole[0], parseFloat(pole[1]) || 0); continue; }
        if (tag === 'XYZ') { const s = r.akt(); if (s) r.bod({ cislo: s.stanovisko, x: absNeg(parseFloat(pole[0])), y: absNeg(parseFloat(pole[1])), z: parseFloat(pole[2]) || null }); continue; }
        if (tag === 'SS' || tag === 'BS' || tag === 'FS') { cekaji = { cislo: pole[0], vc: parseFloat(pole[1]) || 0, kod: pole[2] || '', typ: tag === 'BS' ? 'o' : undefined }; continue; }
        if ((tag === 'SD' || tag === 'HD' || tag === 'HV') && cekaji) {
            const hz = uhel(pole[0]);
            if (tag === 'SD') r.radek({ ...cekaji, hz: gonNorm(hz), z: uhel(pole[1]), ds: parseFloat(pole[2]) });
            else if (tag === 'HD') { r.radek({ ...cekaji, hz: gonNorm(hz), z: null, ds: parseFloat(pole[1]) }); r.akt().delky = 'vodorovne'; }
            else r.radek({ ...cekaji, hz: gonNorm(hz), z: uhel(pole[1]), ds: null });
            cekaji = null; continue;
        }
    }
    r.varovani.push('Úhly čteny jako ' + (rezim === 'gon' ? 'gony' : rezim === 'deg' ? 'desetinné stupně' : 'ddd.mmss (stupně)') + '.');
    return r;
}

// ---------------- Nikon RAW ----------------
function ctiNikon(text, volby) {
    const r = sber(); const uhly = volby.uhly || 'auto'; let maxU = 0;
    const radky = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    radky.forEach((l) => { const p = l.split(','); if (p[0] === 'SS' || p[0] === 'SO') maxU = Math.max(maxU, parseFloat(p[4]) || 0, parseFloat(p[5]) || 0); });
    const rezim = uhly === 'auto' ? (maxU > 360 ? 'gon' : 'deg') : uhly;
    const uhel = (s) => { const v = parseFloat(s); if (!isFinite(v)) return null; return rezim === 'gon' ? v : rezim === 'dms' ? dmsToGon(v) : deg2gon(v); };
    for (const l of radky) {
        const p = l.split(',').map((x) => x.trim());
        if (p[0] === 'ST') { r.stan(p[1], parseFloat(p[5]) || 0); continue; }
        if (p[0] === 'MP' || p[0] === 'UP' || p[0] === 'CC') { r.bod({ cislo: p[1], x: absNeg(parseFloat(p[3])), y: absNeg(parseFloat(p[4])), z: parseFloat(p[5]) || null, kod: p[6] || '' }); continue; }
        if (p[0] === 'SS' || p[0] === 'SO' || p[0] === 'F1' || p[0] === 'F2') { const hz = uhel(p[4]); if (hz == null) continue; r.radek({ cislo: p[1], vc: parseFloat(p[2]) || 0, ds: parseFloat(p[3]) || null, hz: gonNorm(hz), z: uhel(p[5]), kod: p[7] || '', typ: p[0] === 'SO' ? 'o' : undefined }); continue; }
    }
    r.varovani.push('Úhly čteny jako ' + (rezim === 'gon' ? 'gony' : 'stupně') + '.');
    return r;
}

// ---------------- Trimble / Zeiss M5 ----------------
function ctiM5(text) {
    const r = sber(); let th = 0;
    for (const l of text.split(/\r?\n/)) {
        if (!l.startsWith('For M5|')) continue;
        const bl = l.split('|').map((x) => x.trim());
        // bl[0]=For M5, bl[1]=Adr, bl[2]=PI…, bl[3..5]=datové bloky, bl[6]=konec
        const pi = bl[2] || ''; const cislo = pi.replace(/^PI\d?\s*/, '').trim().split(/\s{2,}/)[0] || ''; const kod = pi.replace(/^PI\d?\s*/, '').trim().split(/\s{2,}/)[1] || '';
        const d = {};
        for (const b of bl.slice(3, 6)) { const m = b.match(/^([A-Za-z0-9]+)\s+(-?[\d.]+)\s*(\S*)/); if (m) d[m[1]] = { v: parseFloat(m[2]), u: m[3] }; }
        const uhel = (x) => x ? (x.u.startsWith('gon') ? x.v : x.u.startsWith('DMS') ? dmsToGon(x.v) : x.u.startsWith('deg') ? deg2gon(x.v) : x.v) : null;
        if (d.ih) { r.stan(cislo, d.ih.v); if (d.Y && d.X) r.bod({ cislo, y: absNeg(d.Y.v), x: absNeg(d.X.v), z: d.Z ? d.Z.v : null }); continue; }
        if (d.th) th = d.th.v;
        if (d.Hz && (d.SD || d.HD)) { r.radek({ cislo, hz: gonNorm(uhel(d.Hz)), z: uhel(d.V1 || d.V2), ds: d.SD ? d.SD.v : d.HD.v, vc: th, kod }); if (!d.SD) r.akt().delky = 'vodorovne'; continue; }
        if (d.Y && d.X) r.bod({ cislo, y: absNeg(d.Y.v), x: absNeg(d.X.v), z: d.Z ? d.Z.v : null, kod });
    }
    return r;
}

// ---------------- MAPA2 (Groma .zap / Topcon .asc) ----------------
// Podle příručky GROMA (Dávkový výpočet souboru MAPA2) a skutečného zápisníku z Topconu (19. 9. 2026):
//   hlavička: „;Zakazka:NAZEV“, 9999, 999999999, „610844000XX“ (k. ú. + ZPMZ, XX = doplní uživatel), 1, 3, 0, 2
//   „1 <stanovisko> [výška stroje] [*]“ = polární; orientace do „-1“, podrobné body do „/“, „-2“ = konec
//   řádek měření (Topcon): číslo · šikmá délka · výška cíle · Hz · zenit
//   řádek měření (dávka Groma): číslo · vodorovná délka · Hz [: dS dK]
//   řádek měření (jiné totálky): číslo · Hz · zenit · šikmá délka · výška cíle · kód
//   „0 <bod A> 0. 0.“ = ortogonální úloha: koncové body přímky, „-1“, body „číslo staničení kolmice“
// Měření v obou polohách (Hz o 200 g, zenit 400 − Z) se průměruje (volba dvePolohy, výchozí ano).
function ctiMapa2(text, volby = {}) {
    const r = sber(); let rezim = null, blok = 'orient';
    r.hlavicka = { zakazka: '', predcisli: '' };
    const radky = text.split(/\r?\n/).map((l) => l.replace(/\t/g, ' ').trim());
    const num = (x) => { const v = parseFloat(String(x ?? '').replace(',', '.')); return isFinite(v) ? v : null; };
    const zenit = (v) => v != null && (v > 60 && v < 140 || v > 260 && v < 340);
    // odhad varianty z řádků měření
    let topcon = 0, standard = 0, davka = 0;
    for (const l of radky) { const c = l.split(/\s+/); if (c.length < 3 || !/^[\w.-]+$/.test(c[0]) || /^[01]$/.test(c[0]) && c.length <= 4 || c.includes(':')) continue;
        const v = c.map(num); if (c.length >= 5 && zenit(v[4]) && v[2] != null && v[2] < 10) topcon++; else if (c.length >= 5 && zenit(v[2])) standard++; else if (c.length >= 3 && v[1] != null && v[2] != null) davka++; }
    const varianta = topcon >= standard && topcon >= davka && topcon ? 'topcon' : standard >= davka && standard ? 'standard' : 'davka';
    let poradi = 0;
    for (const l of radky) {
        if (!l) continue;
        if (l.startsWith(';')) { const m = l.match(/^;\s*Zakazka\s*:\s*(.*)$/i); if (m) r.hlavicka.zakazka = m[1].trim(); continue; }
        if (l === '-2') break;
        if (l === '/') { rezim = null; blok = 'orient'; continue; }
        if (l === '-1') { blok = 'body'; continue; }
        const c = l.split(/\s+/);
        if (rezim == null) {
            const m = l.match(/^([01])\s+(\S+)(?:\s+(-?[\d.,]+))?(?:\s+(-?[\d.,]+))?\s*\*?$/);
            if (m && c.length <= 5) {
                rezim = m[1]; blok = 'orient';
                if (rezim === '1') r.stan(m[2], num(m[3]) || 0);
                else { r.stan(m[2], 0); r.akt().ortogonalni = true; r.varovani.push('Ortogonální úloha (typ 0) načtena jako stanovisko ' + m[2] + ' — staničení a kolmice jsou ve sloupcích délka/Hz; spočítej Ortogonální metodou.'); }
                continue;
            }
            // hlavička souboru: 3. datový řádek s předčíslím (k. ú. + ZPMZ), např. 610844000XX
            poradi++; if (poradi === 3 && /^\d{6,}(XX|\d{1,2})$/i.test(l)) r.hlavicka.predcisli = l; // 3. řádek hlavičky = k. ú. + ZPMZ
            continue;
        }
        if (c.length < 3 || !/^[\w.-]+$/.test(c[0])) continue;
        const v = c.map(num);
        if (rezim === '0') { r.radek({ cislo: c[0], hz: v[2] ?? 0, z: null, ds: v[1], vc: 0, kod: c.slice(3).join(' '), typ: blok === 'orient' ? 'o' : 'z' }); continue; }
        let hz, z = null, ds, vc = 0, kod = '';
        if (varianta === 'topcon') { ds = v[1]; vc = v[2] ?? 0; hz = v[3]; z = v[4]; kod = c.slice(5).join(' '); }
        else if (varianta === 'standard') { hz = v[1]; z = v[2]; ds = v[3]; vc = v[4] ?? 0; kod = c.slice(5).join(' '); }
        else { ds = v[1]; hz = v[2]; const dvoj = c.indexOf(':'); if (c[3] != null && dvoj !== 3 && zenit(v[3])) z = v[3]; const zb = dvoj >= 0 ? c.slice(dvoj + 3) : c.slice(z != null ? 4 : 3); kod = zb.filter((x) => num(x) == null).join(' '); if (dvoj >= 0) kod = ('excentr ' + c[dvoj + 1] + ' ' + c[dvoj + 2] + ' ' + kod).trim(); }
        if (hz == null) continue;
        if (ds === 0) ds = null;
        r.radek({ cislo: c[0], hz: gonNorm(hz), z, ds, vc, kod, typ: blok === 'orient' ? 'o' : 'z' });
        if (z == null) r.akt().delky = 'vodorovne';
    }
    if (volby.dvePolohy !== false) r.stanoviska.forEach((s) => { const n = s.radky.length; s.radky = prumerujPolohy(s.radky); if (s.radky.length !== n) r.varovani.push(`Stanovisko ${s.stanovisko}: ${n - s.radky.length} dvojic měření v obou polohách zprůměrováno.`); });
    r.varovani.push({ topcon: 'Zápisník Topcon MAPA2 (číslo, šikmá délka, výška cíle, Hz, zenit).', standard: 'Zápisník MAPA2 (číslo, Hz, zenit, šikmá délka, výška cíle).', davka: 'Dávkový soubor MAPA2 (číslo, délka, Hz) — délky vodorovné.' }[varianta]);
    return r;
}
/** Sloučí dvojice po sobě jdoucích řádků stejného bodu měřené v I. a II. poloze (Hz ±200 g, Z → 400 − Z). */
export function prumerujPolohy(radky) {
    const out = [];
    for (let i = 0; i < radky.length; i++) {
        const a = radky[i], b = radky[i + 1];
        if (b && a.cislo === b.cislo && a.hz != null && b.hz != null && Math.abs(Math.abs(gonNorm(b.hz - a.hz)) - 200) < 1 && (a.z == null || b.z == null || Math.abs(a.z + b.z - 400) < 1)) {
            const hz = gonNorm(a.hz + gonDiff(gonNorm(b.hz - 200), a.hz) / 2);
            const z = a.z != null && b.z != null ? (a.z + 400 - b.z) / 2 : (a.z ?? b.z);
            const ds = a.ds != null && b.ds != null ? (a.ds + b.ds) / 2 : (a.ds ?? b.ds);
            out.push({ ...a, hz, z, ds, kod: a.kod || b.kod, pozn: 'I+II', dvePolohy: { hz1: a.hz, hz2: b.hz, z1: a.z, z2: b.z, dHz: gonDiff(gonNorm(b.hz - 200), a.hz), dZ: a.z != null && b.z != null ? a.z + b.z - 400 : null } });
            i++;
        } else out.push(a);
    }
    return out;
}
/** Plné číslo bodu podle předčíslí (k. ú. 6 + ZPMZ 5 + bod 4 = 15 míst): „4001“ + „61084400014“ → 610844000144001,
 *  dlouhá čísla (trig. body 944212300) se jen doplní nulami na 15 míst, nečíselná jména (JM-071-519) se nemění. */
export function plneCislo(cislo, predcisli) {
    const c = String(cislo).trim(); if (!/^\d+$/.test(c)) return c;
    if (c.length >= 9) return c.padStart(15, '0');
    if (!predcisli) return c;
    const pre = String(predcisli).replace(/[^\d]/g, '');
    return (pre + c.padStart(Math.max(4, 15 - pre.length), '0')).slice(-15);
}
