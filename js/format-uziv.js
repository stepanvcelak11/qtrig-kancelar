// Uživatelský textový formát podle Gromy (příloha 44): předpis řádku s datovými položkami
// <ID[,volby][:[příznaky]šířka[:desetinná]]>, ostatní znaky se opisují. Export = dosazení,
// import = pevný formát (podle šířek) nebo volný formát (podle oddělovačů).
import { rozlozCislo } from './seznam-nastroje.js';
import { jtskToWgs } from '../geo/krovak.js';
import { gon2deg, degToDms } from '../geo/uhly.js';

const RE = /<([A-Z0-9_]+)(?:,([A-Z]+))?(?::([LUZ0]*)(\d+)?(?:[:.](\d+))?)?>/gi;

/** Rozebere předpis na posloupnost { text } | { id, volby, priznaky, sirka, des } */
export function rozeberFormat(predpis) {
    const casti = []; let last = 0; RE.lastIndex = 0; let m;
    while ((m = RE.exec(predpis))) {
        if (m.index > last) casti.push({ text: predpis.slice(last, m.index) });
        casti.push({ id: m[1].toUpperCase(), volby: (m[2] || '').toUpperCase(), priznaky: (m[3] || '').toUpperCase(), sirka: m[4] ? +m[4] : null, des: m[5] != null ? +m[5] : null });
        last = m.index + m[0].length;
    }
    if (last < predpis.length) casti.push({ text: predpis.slice(last) });
    return casti;
}

/** Hodnoty položek pro bod seznamu souřadnic */
export function polozkyBodu(b, i = 0) {
    const r = rozlozCislo(b.cislo); const w = b.y != null && b.x != null ? jtskToWgs(b.y, b.x, b.z ?? 250) : null;
    return { P: r.predcisli, N: r.cislo, NUM: b.cislo, CODE: b.kod || '', NOTE: b.pozn || '', X: b.x, Y: b.y, Z: b.z, H: b.z, PREC: b.kvalita || '', PRECH: '', TYPE: b.typ || '', ORIGIN: b.puvod || '', X2: b.x2, Y2: b.y2, Z2: null, PREC2: '', INFO1: b.y2, INFO2: b.x2, INFO3: '', INFO4: '', LINE: i + 1, FSU: r.ku, ZPMZ: r.zpmz ? String(+r.zpmz) : '', B: w ? w.lat : null, L: w ? w.lng : null, _uhelStupne: ['B', 'L'] };
}
/** Hodnoty položek pro řádek měření (stanovisko s + řádek m) */
export function polozkyMereni(s, m, i = 0) {
    const r = rozlozCislo(m.cislo); const rs = rozlozCislo(s.stanovisko);
    return { P: r.predcisli, N: r.cislo, NUM: m.cislo, CODE: m.kod || '', NOTE: m.pozn || '', HZ: m.hz, V: m.z, D: m.ds, DH: m.dh ?? (m.ds != null && m.z != null ? m.ds * Math.cos(m.z * Math.PI / 200) : null), SIG: m.vc, LINE: i + 1, FSU: r.ku, ZPMZ: r.zpmz ? String(+r.zpmz) : '', STN: s.stanovisko, STNP: rs.predcisli, STNN: rs.cislo, IH: s.vp, OR: m.typ === 'o' ? 1 : 0, _uhelGon: ['HZ', 'V'] };
}

function formatujCislo(v, c, jeUhelGon, jeUhelStupne) {
    if (v == null || v === '') return '';
    if (typeof v !== 'number') return String(v);
    if (c.volby === 'DEG' && jeUhelGon) v = gon2deg(v);
    if (c.volby === 'DMS') { const deg = jeUhelGon ? gon2deg(v) : v; const d = degToDms(deg); const sec = d.s.toFixed(c.des ?? 4); return c.priznaky.includes('U') ? `${d.d}°${String(d.m).padStart(2, '0')}’${sec.padStart((c.des ?? 4) + 3, '0')}”` : `${d.d}.${String(d.m).padStart(2, '0')}${sec.replace('.', '').padStart(2, '0')}`; }
    if (c.volby === 'RAD') v = jeUhelGon ? v * Math.PI / 200 : v * Math.PI / 180;
    const des = c.des != null ? c.des : (jeUhelGon ? 4 : c.id === 'LINE' ? 0 : ['B', 'L'].includes(c.id) ? 8 : 3);
    return v.toFixed(des);
}
/** Vytvoří jeden řádek podle předpisu */
export function radekPodleFormatu(predpis, hodnoty) {
    const casti = typeof predpis === 'string' ? rozeberFormat(predpis) : predpis;
    return casti.map((c) => {
        if (c.text != null) return c.text;
        let s = formatujCislo(hodnoty[c.id], c, (hodnoty._uhelGon || []).includes(c.id), (hodnoty._uhelStupne || []).includes(c.id));
        if (c.sirka) { if (c.priznaky.includes('0') && /^-?\d/.test(s)) s = s.padStart(c.sirka, '0'); else if (c.priznaky.includes('L') || (['CODE', 'NOTE', 'TYPE', 'ORIGIN'].includes(c.id) && !c.priznaky.includes('R'))) s = s.padEnd(c.sirka); else s = s.padStart(c.sirka); }
        return s;
    }).join('');
}
export function exportPodleFormatu(predpis, seznamHodnot) { const casti = rozeberFormat(predpis); return seznamHodnot.map((h) => radekPodleFormatu(casti, h)).join('\n') + '\n'; }

/**
 * Import podle předpisu: pevny = true → podle šířek (pozice), jinak volný formát (oddělovače).
 * Vrací pole objektů { P, N, NUM, X, Y, Z, CODE, HZ, V, D, SIG, … } s čísly převedenými (úhly do gonů).
 */
export function importPodleFormatu(predpis, text, pevny = false) {
    const casti = rozeberFormat(predpis); const out = [];
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.replace(/\s+$/, ''); if (!line.trim()) continue;
        const o = {}; let pos = 0, ok = true;
        if (pevny) {
            for (const c of casti) { if (c.text != null) { pos += c.text.length; continue; } const w = c.sirka || 10; o[c.id] = { txt: line.slice(pos, pos + w).trim(), c }; pos += w; }
        } else {
            const tokeny = line.trim().split(/[\s;,]+/); let k = 0;
            for (const c of casti) { if (c.text != null) continue; if (c.id === 'CODE' || c.id === 'NOTE') { o[c.id] = { txt: tokeny.slice(k).join(' '), c }; k = tokeny.length; continue; } o[c.id] = { txt: tokeny[k++] ?? '', c }; }
        }
        const v = {};
        for (const [id, { txt, c }] of Object.entries(o)) {
            if (['P', 'N', 'NUM', 'CODE', 'NOTE', 'TYPE', 'ORIGIN', 'PREC', 'PRECH', 'FSU', 'ZPMZ', 'STN'].includes(id)) { v[id] = txt; continue; }
            if (txt === '') { v[id] = null; continue; }
            let num = parseFloat(txt.replace(',', '.')); if (!isFinite(num)) { ok = false; continue; }
            if (['HZ', 'V'].includes(id)) { if (c.volby === 'DEG') num = num * 400 / 360; else if (c.volby === 'DMS') { const d = Math.trunc(num), mm = Math.trunc((num - d) * 100 + 1e-9), ss = ((num - d) * 100 - mm) * 100; num = (d + mm / 60 + ss / 3600) * 400 / 360; } else if (c.volby === 'RAD') num = num * 200 / Math.PI; }
            v[id] = num;
        }
        if (v.P != null && v.N != null && v.NUM == null) v.NUM = (v.P || '') + (v.P ? String(v.N).padStart(15 - String(v.P).length, '0') : v.N);
        if (ok && (v.NUM != null || v.N != null)) out.push(v);
    }
    return out;
}
export const PREDPISY_SOURADNICE = [['<NUM> <Y> <X> <Z> <CODE>', 'číslo Y X Z kód (mezery)'], ['<NUM:15> <Y:12:3> <X:13:3> <Z:8:3> <CODE>', 'pevné šířky jako Groma'], ['<NUM>;<Y>;<X>;<Z>;<CODE>', 'CSV se středníkem'], ['<NUM> <X> <Y> <Z>', 'číslo X Y Z'], ['<NUM:15> <B,DMS:U14:4> <L,DMS:U14:4> <H:9:3>', 'WGS84 B L (DMS) H']];
export const PREDPISY_MERENI = [['<NUM> <HZ> <V> <D> <SIG> <CODE>', 'číslo Hz zenit délka výška cíle kód'], ['<STN> <NUM> <HZ:10:4> <V:10:4> <D:10:3> <SIG:6:3> <CODE>', 'se stanoviskem'], ['<NUM> <D> <SIG> <HZ> <V>', 'Topcon MAPA2 (číslo délka vc Hz Z)']];
