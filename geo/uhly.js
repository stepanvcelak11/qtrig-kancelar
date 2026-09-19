// Úhly: gony jsou vnitřní jednotka celého jádra. Rovinné souřadnice jsou S-JTSK
// (Y, X kladné), směrník σ = atan2(ΔY, ΔX) měřený od +X po směru hodinových ručiček.
export const GON = Math.PI / 200;          // 1 gon v radiánech
export const DEG = Math.PI / 180;

export const gon2rad = (g) => g * GON;
export const rad2gon = (r) => r / GON;
export const deg2gon = (d) => d * 400 / 360;
export const gon2deg = (g) => g * 360 / 400;

/** Normalizace do <0, 400) */
export function gonNorm(a) { return ((a % 400) + 400) % 400; }
/** Rozdíl a − b normalizovaný do <−200, 200) */
export function gonDiff(a, b) { return gonNorm(a - b + 200) - 200; }

/** Formát gonů „45.2210“ (čtyři desetinná místa = 0,1 mgon) */
export function fmtGon(g, dec = 4) {
    if (g == null || !isFinite(g)) return '';
    const s = gonNorm(g).toFixed(dec);
    return s === (400).toFixed(dec) ? (0).toFixed(dec) : s;
}

/** Stupně → { d, m, s } */
export function degToDms(deg) {
    const sgn = deg < 0 ? -1 : 1; deg = Math.abs(deg);
    let d = Math.floor(deg), m = Math.floor((deg - d) * 60), s = ((deg - d) * 60 - m) * 60;
    if (Math.round(s * 100) >= 6000) { s = 0; m++; } if (m >= 60) { m = 0; d++; }
    return { d: sgn * d, m, s };
}
export function fmtDms(deg, secDec = 1) {
    const { d, m, s } = degToDms(deg);
    return `${d}°${String(m).padStart(2, '0')}'${s.toFixed(secDec).padStart(secDec ? 3 + secDec : 2, '0')}"`;
}

/**
 * Převod textu na gony. Přijímá „45.2210“, „45,2210“, „45.2210g“, „40°30'15"“,
 * „40 30 15“ (DMS mezerou), „0.5rad“. Vrací null, když nejde přečíst.
 */
export function parseUhel(str, vychozi = 'gon') {
    if (str == null) return null;
    let s = String(str).trim().replace(/,/g, '.');
    if (!s) return null;
    let m;
    if ((m = s.match(/^(-?\d+)\s*[°\s]\s*(\d+)\s*['′\s]\s*(\d+(?:\.\d+)?)?\s*["″]?$/))) {
        const d = +m[1], mi = +m[2], se = +(m[3] || 0), sgn = s.startsWith('-') ? -1 : 1;
        return deg2gon(sgn * (Math.abs(d) + mi / 60 + se / 3600));
    }
    if ((m = s.match(/^(-?\d+(?:\.\d+)?)\s*(g|gon|°|deg|rad)?$/i))) {
        const v = +m[1], u = (m[2] || vychozi).toLowerCase();
        if (u === '°' || u === 'deg') return deg2gon(v);
        if (u === 'rad') return rad2gon(v);
        return v;
    }
    return null;
}
