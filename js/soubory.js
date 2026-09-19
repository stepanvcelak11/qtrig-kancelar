// Textové seznamy souřadnic: čtení s odhadem sloupců a zápis.
import { cislo } from './ui.js';

export const PORADI = {
    'c y x z k': 'číslo Y X Z kód', 'c x y z k': 'číslo X Y Z kód', 'c y x k z': 'číslo Y X kód Z',
    'c y x k': 'číslo Y X kód', 'c y x': 'číslo Y X', 'y x c': 'Y X číslo', 'c z': 'číslo Z (jen výšky)',
};

/** Rozdělí řádek na sloupce: středník, tabulátor, čárka (když není desetinná) nebo mezery */
export function rozdelRadek(r) {
    if (r.includes(';')) return r.split(';').map((s) => s.trim());
    if (r.includes('\t')) return r.split('\t').map((s) => s.trim());
    if ((r.match(/,/g) || []).length >= 2 && !/\d,\d{1,3}(\s|$)/.test(r)) return r.split(',').map((s) => s.trim());
    return r.trim().split(/\s+/);
}

/** Odhad pořadí sloupců z prvních řádků (S-JTSK: Y 400–900 tis., X 900–1 300 tis.) */
export function odhadniPoradi(radky) {
    for (const r of radky.slice(0, 20)) {
        const c = rozdelRadek(r); if (c.length < 3) continue;
        const v = c.map(cislo);
        const jeY = (n) => n != null && n > 400000 && n < 950000, jeX = (n) => n != null && n > 900000 && n < 1300000;
        if (jeY(v[1]) && jeX(v[2])) return c.length >= 4 && v[3] != null ? 'c y x z k' : 'c y x k';
        if (jeX(v[1]) && jeY(v[2])) return 'c x y z k';
        if (jeY(v[0]) && jeX(v[1])) return 'y x c';
    }
    return 'c y x z k';
}

/**
 * Přečte seznam souřadnic. Vrací { body:[{cislo,y,x,z,kod}], chyby:[{radek,text}] }
 */
export function ctiSeznam(text, poradi = 'c y x z k') {
    const sl = poradi.split(' ');
    const body = [], chyby = [];
    text.split(/\r?\n/).forEach((r, i) => {
        const t = r.trim(); if (!t || t.startsWith('#') || t.startsWith('//')) return;
        const c = rozdelRadek(t);
        const b = { cislo: '', y: null, x: null, z: null, kod: '' };
        sl.forEach((k, j) => {
            const v = c[j]; if (v == null) return;
            if (k === 'c') b.cislo = v;
            else if (k === 'y') b.y = cislo(v);
            else if (k === 'x') b.x = cislo(v);
            else if (k === 'z') b.z = cislo(v);
            else if (k === 'k') b.kod = c.slice(j).join(' ');
        });
        if (sl.includes('z') && sl.includes('k') && sl.indexOf('z') < sl.indexOf('k') && b.kod && b.z == null) { b.z = null; }
        if (!b.cislo || (sl.includes('y') && (b.y == null || b.x == null))) { chyby.push({ radek: i + 1, text: t }); return; }
        body.push(b);
    });
    return { body, chyby };
}

/** Zapíše seznam. format: 'txt' (mezery, tečka) | 'csv' (středník, čárka) */
export function zapisSeznam(body, format = 'txt', poradi = 'c y x z k', dec = 3) {
    const sl = poradi.split(' ');
    const f = (v, d = dec) => v == null ? '' : (format === 'csv' ? v.toFixed(d).replace('.', ',') : v.toFixed(d));
    const hl = format === 'csv' ? sl.map((k) => ({ c: 'Cislo', y: 'Y', x: 'X', z: 'Z', k: 'Kod' }[k])).join(';') + '\n' : '';
    return hl + body.map((b) => {
        const cells = sl.map((k) => k === 'c' ? b.cislo : k === 'y' ? f(b.y) : k === 'x' ? f(b.x) : k === 'z' ? f(b.z) : (b.kod || ''));
        if (format === 'csv') return cells.join(';');
        // txt: pevné šířky jako v Gromě
        return cells.map((v, i) => sl[i] === 'c' ? String(v).padEnd(12) : sl[i] === 'k' ? v : String(v).padStart(13)).join(' ').trimEnd();
    }).join('\n') + '\n';
}
