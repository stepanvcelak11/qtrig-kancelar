// Další formáty seznamů souřadnic a měření podle Gromy (kap. Export/Import): souřadnice pro katastr,
// XYZ/YXZ, CSV, bez čísel (−Y −X), dvojí souřadnice, KOKEŠ .stx, dBASE III .dbf (struktura tab. 12-1),
// Excel .xlsx (bez knihoven), XML, výstupy do záznamníků (Leica GSI, Sokkia SDR33, Topcon, Geodimeter Area),
// import měření Geodimeter (label=hodnota).
import { rozlozCislo } from './seznam-nastroje.js';
import { cislo } from './ui.js';

const f = (v, d = 3) => v == null ? '' : v.toFixed(d);

// ---------------- textové seznamy ----------------
/** Souřadnice pro katastr: úplné číslo, Y, X, Z (cm), kód kvality — přesně podle ukázky Groma */
export function exportKatastr(body) {
    return body.map((b) => `${String(b.cislo).padStart(15)} ${f(b.y, 2).padStart(13)} ${f(b.x, 2).padStart(13)} ${f(b.z ?? 0, 2).padStart(10)} ${String(b.kvalita || 3).padStart(4)}`).join('\n') + '\n';
}
export function exportXYZ(body, poradi = 'yxz', csv = false) {
    const sep = csv ? ',' : ' ';
    return body.map((b) => { const c = poradi === 'xyz' ? [b.x, b.y] : [b.y, b.x]; return [b.cislo, f(c[0]), f(c[1]), b.z != null ? f(b.z) : (csv ? '' : null), b.kvalita || null, b.kod || null].filter((v) => v != null && v !== '').join(sep); }).join('\n') + '\n';
}
/** Import bez čísel bodů: −Y −X Z v matematické soustavě → očíslovat od 1 a otočit znaménka */
export function importBezCisel(text, od = 1) {
    const out = []; let n = od;
    for (const l of text.split(/\r?\n/)) { const c = l.trim().split(/[\s;,]+/).map(cislo); if (c.length < 2 || c[0] == null || c[1] == null) continue; out.push({ cislo: String(n++), y: Math.abs(c[0]), x: Math.abs(c[1]), z: c[2] ?? null, kod: '' }); }
    return out;
}
/** Import dvojích souřadnic: číslo Y X Z Y2 X2 Z2 [kvalita] [kód] */
export function importDvoji(text) {
    const out = [];
    for (const l of text.split(/\r?\n/)) { const c = l.trim().split(/[\s;]+/); if (c.length < 5) continue; const v = c.slice(1, 7).map(cislo); if (v[0] == null || v[1] == null) continue; const zb = c.slice(7); out.push({ cislo: c[0], y: v[0], x: v[1], z: v[2], y2: v[3], x2: v[4], kvalita: zb[0] && zb[0].length === 1 ? zb[0] : null, kod: (zb[0] && zb[0].length === 1 ? zb.slice(1) : zb).join(' ') }); }
    return out;
}
/** KOKEŠ .stx: hlavička s pořadím a přesností, pak „číslo Y X Z“ */
export function exportKokes(body, desetinna = 3) {
    const hl = `;KOKES seznam souradnic\n;PORADI Y X Z\n;PRESNOST ${desetinna >= 3 ? 'mm' : 'cm'}\n`;
    return hl + body.map((b) => `${b.cislo} ${f(b.y, desetinna)} ${f(b.x, desetinna)}${b.z != null ? ' ' + f(b.z, desetinna) : ''}${b.kod ? ' ' + b.kod : ''}`).join('\n') + '\n';
}
/** Jednoduché XML (vlastní schéma Kanceláře; Groma XML má vlastní DTD, obě strany čtou atributy) */
export function exportXML(body, nazev = '') {
    const e = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
    return `<?xml version="1.0" encoding="UTF-8"?>\n<seznam nazev="${e(nazev)}" system="S-JTSK" vyska="Bpv">\n` + body.map((b) => `  <bod cislo="${e(b.cislo)}" y="${f(b.y)}" x="${f(b.x)}"${b.z != null ? ` z="${f(b.z)}"` : ''}${b.kvalita ? ` kvalita="${e(b.kvalita)}"` : ''}${b.kod ? ` kod="${e(b.kod)}"` : ''}${b.typ ? ` typ="${e(b.typ)}"` : ''}/>`).join('\n') + '\n</seznam>\n';
}
export function importXML(text) {
    const out = [];
    if (typeof DOMParser === 'undefined') { // Node / testy: atributy regexem
        for (const m of text.matchAll(/<(?:bod|point)([^>]*)\/?>/gi)) { const a = {}; for (const q of m[1].matchAll(/([\w-]+)="([^"]*)"/g)) a[q[1].toLowerCase()] = q[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'); const y = cislo(a.y), x = cislo(a.x); if (y == null || x == null) continue; out.push({ cislo: a.cislo || a.num || a.number || '', y, x, z: cislo(a.z), kod: a.kod || a.code || '', kvalita: a.kvalita || a.prec || null }); }
        return out;
    }
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    doc.querySelectorAll('bod, point, Bod, Point').forEach((n) => { const g = (a) => n.getAttribute(a) ?? n.getAttribute(a.toUpperCase()) ?? (n.querySelector(a) && n.querySelector(a).textContent); const y = cislo(g('y')), x = cislo(g('x')); if (y == null || x == null) return; out.push({ cislo: g('cislo') || g('num') || g('number') || '', y, x, z: cislo(g('z')), kod: g('kod') || g('code') || '', kvalita: g('kvalita') || g('prec') || null }); });
    return out;
}

// ---------------- dBASE III (struktura Groma tab. 12-1) ----------------
const DBF_POLE = [['PORCIS', 'N', 3, 0], ['ZBP', 'N', 1, 0], ['ZPMZ', 'N', 4, 0], ['CISLO', 'N', 4, 0], ['Y', 'N', 9, 2], ['X', 'N', 10, 2], ['Z', 'N', 6, 2], ['TRIDA', 'N', 1, 0], ['CHKRESBA', 'C', 4, 0], ['STAV', 'N', 1, 0], ['DATUM', 'D', 8, 0], ['YMER', 'N', 9, 2], ['XMER', 'N', 10, 2]];
export function exportDBF(body) {
    const delkaZaz = 1 + DBF_POLE.reduce((s, p) => s + p[2], 0), hl = 32 + 32 * DBF_POLE.length + 1;
    const buf = new Uint8Array(hl + delkaZaz * body.length + 1); const dv = new DataView(buf.buffer); const d = new Date();
    buf[0] = 0x03; buf[1] = d.getFullYear() - 1900; buf[2] = d.getMonth() + 1; buf[3] = d.getDate(); dv.setUint32(4, body.length, true); dv.setUint16(8, hl, true); dv.setUint16(10, delkaZaz, true);
    let o = 32; DBF_POLE.forEach(([n, t, w, dec]) => { for (let i = 0; i < n.length; i++) buf[o + i] = n.charCodeAt(i); buf[o + 11] = t.charCodeAt(0); buf[o + 16] = w; buf[o + 17] = dec; o += 32; }); buf[o] = 0x0D; o++;
    const put = (s, w) => { s = String(s).slice(0, w).padStart(w); for (let i = 0; i < w; i++) buf[o + i] = s.charCodeAt(i) & 0xff; o += w; };
    body.forEach((b, i) => { buf[o++] = 0x20; const r = rozlozCislo(b.cislo); put(i + 1, 3); put(r.zpmz ? 0 : 0, 1); put(r.zpmz ? +r.zpmz : 0, 4); put(r.cislo, 4); put(f(b.y, 2), 9); put(f(b.x, 2), 10); put(b.z == null ? '' : f(b.z, 2), 6); put(b.kvalita || '', 1); put('', 4); put('', 1); put(d.toISOString().slice(0, 10).replace(/-/g, ''), 8); put(b.y2 == null ? '' : f(b.y2, 2), 9); put(b.x2 == null ? '' : f(b.x2, 2), 10); });
    buf[o] = 0x1A; return buf;
}
export function importDBF(buf) {
    const u = new Uint8Array(buf), dv = new DataView(u.buffer, u.byteOffset); const n = dv.getUint32(4, true), hl = dv.getUint16(8, true), rl = dv.getUint16(10, true);
    const pole = []; for (let o = 32; o < hl - 1 && u[o] !== 0x0D; o += 32) { let nm = ''; for (let i = 0; i < 11 && u[o + i]; i++) nm += String.fromCharCode(u[o + i]); pole.push({ nm, t: String.fromCharCode(u[o + 11]), w: u[o + 16] }); }
    const out = []; const dec = new TextDecoder('windows-1250');
    for (let r = 0; r < n; r++) { let o = hl + r * rl; if (u[o] === 0x2A) continue; o++; const rec = {}; for (const p of pole) { rec[p.nm] = dec.decode(u.slice(o, o + p.w)).trim(); o += p.w; } const y = cislo(rec.Y), x = cislo(rec.X); if (y == null || x == null) continue; const cis = rec.CISLO || rec.NUM || rec.NUMBER || String(r + 1); const pre = rec.KU || ''; out.push({ cislo: rec.ZPMZ && rec.CISLO && pre ? pre + String(rec.ZPMZ).padStart(5, '0') + String(rec.CISLO).padStart(4, '0') : cis, y, x, z: cislo(rec.Z), kvalita: rec.TRIDA || null, kod: rec.KOD || rec.CODE || '', y2: cislo(rec.YMER), x2: cislo(rec.XMER) }); }
    return out;
}

// ---------------- Excel .xlsx bez knihoven (zip „store“, CRC32) ----------------
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }; })();
function zipStore(soubory) { // [{ nazev, data:Uint8Array }]
    const enc = new TextEncoder(); const casti = [], cd = []; let off = 0;
    for (const s of soubory) { const nm = enc.encode(s.nazev), d = s.data, crc = CRC(d); const lh = new Uint8Array(30 + nm.length); const v = new DataView(lh.buffer); v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(8, 0, true); v.setUint32(14, crc, true); v.setUint32(18, d.length, true); v.setUint32(22, d.length, true); v.setUint16(26, nm.length, true); lh.set(nm, 30); const ch = new Uint8Array(46 + nm.length); const c = new DataView(ch.buffer); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true); ch.set(nm, 46); casti.push(lh, d); cd.push(ch); off += lh.length + d.length; }
    const cdLen = cd.reduce((s, c) => s + c.length, 0); const end = new Uint8Array(22); const e = new DataView(end.buffer); e.setUint32(0, 0x06054b50, true); e.setUint16(8, soubory.length, true); e.setUint16(10, soubory.length, true); e.setUint32(12, cdLen, true); e.setUint32(16, off, true);
    const out = new Uint8Array(off + cdLen + 22); let p = 0; for (const c of [...casti, ...cd, end]) { out.set(c, p); p += c.length; } return out;
}
const xe = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
/** tabulka = { list: 'Souřadnice', hlavicka: [...], radky: [[...], ...] } — čísla zůstanou čísla */
export function exportXLSX(tabulky) {
    const enc = new TextEncoder(); const col = (i) => { let s = ''; i++; while (i) { s = String.fromCharCode(64 + ((i - 1) % 26) + 1) + s; i = Math.floor((i - 1) / 26); } return s; };
    const sheets = tabulky.map((t) => { const rows = [t.hlavicka, ...t.radky]; return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>` + rows.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, ci) => v == null || v === '' ? '' : typeof v === 'number' ? `<c r="${col(ci)}${ri + 1}"><v>${v}</v></c>` : `<c r="${col(ci)}${ri + 1}" t="inlineStr"><is><t>${xe(v)}</t></is></c>`).join('') + '</row>').join('') + '</sheetData></worksheet>'; });
    const soubory = [
        { nazev: '[Content_Types].xml', data: enc.encode(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${tabulky.map((t, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`) },
        { nazev: '_rels/.rels', data: enc.encode(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
        { nazev: 'xl/workbook.xml', data: enc.encode(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tabulky.map((t, i) => `<sheet name="${xe(t.list || 'List' + (i + 1))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`) },
        { nazev: 'xl/_rels/workbook.xml.rels', data: enc.encode(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tabulky.map((t, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`) },
        ...sheets.map((s, i) => ({ nazev: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(s) })),
    ];
    return zipStore(soubory);
}
/** Čtení .xlsx: první list → pole řádků (hodnoty jako text/čísla). Potřebuje DecompressionStream (moderní prohlížeče). */
export async function importXLSX(buf) {
    const u = new Uint8Array(buf), dv = new DataView(u.buffer, u.byteOffset); const dec = new TextDecoder();
    let eocd = u.length - 22; while (eocd > 0 && dv.getUint32(eocd, true) !== 0x06054b50) eocd--; const n = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true); const soubory = {};
    for (let i = 0; i < n; i++) { const komp = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true); const nm = dec.decode(u.slice(p + 46, p + 46 + nl)); const lnl = dv.getUint16(lo + 26, true), lel = dv.getUint16(lo + 28, true); const data = u.slice(lo + 30 + lnl + lel, lo + 30 + lnl + lel + cs); soubory[nm] = { komp, data }; p += 46 + nl + el + cl; }
    const text = async (nm) => { const s = soubory[nm]; if (!s) return ''; if (s.komp === 0) return dec.decode(s.data); const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(s.data); w.close(); return dec.decode(await new Response(ds.readable).arrayBuffer()); };
    const shared = []; const ss = await text('xl/sharedStrings.xml'); if (ss) { const d = new DOMParser().parseFromString(ss, 'application/xml'); d.querySelectorAll('si').forEach((si) => shared.push([...si.querySelectorAll('t')].map((t) => t.textContent).join(''))); }
    const sx = await text('xl/worksheets/sheet1.xml'); const d = new DOMParser().parseFromString(sx, 'application/xml'); const radky = [];
    d.querySelectorAll('row').forEach((row) => { const r = []; row.querySelectorAll('c').forEach((c) => { const ref = c.getAttribute('r') || ''; const ci = [...ref.replace(/\d+/g, '')].reduce((s, ch) => s * 26 + (ch.charCodeAt(0) - 64), 0) - 1; const t = c.getAttribute('t'); const v = c.querySelector('v'); let val = ''; if (t === 's') val = shared[+v.textContent] ?? ''; else if (t === 'inlineStr') val = c.querySelector('t')?.textContent ?? ''; else if (v) val = isFinite(+v.textContent) ? +v.textContent : v.textContent; r[ci >= 0 ? ci : r.length] = val; }); radky.push(r); });
    return radky;
}

// ---------------- výstupy do záznamníků ----------------
export function exportGSI(body, gsi16 = true) {
    const w = (wi, info, v, txt = false) => { const L = gsi16 ? 16 : 8; let s; if (txt) s = String(v).slice(-L).padStart(L, '0'); else { const n = Math.round(Math.abs(v) * 1000); s = String(n).slice(-L).padStart(L, '0'); } return `${wi}${info}${txt ? '+' : (v < 0 ? '-' : '+')}${s}`; };
    return body.map((b, i) => `${gsi16 ? '*' : ''}${w('11', String(i + 1).padStart(4, '0'), b.cislo, true)} ${w('81', '..10', b.y)} ${w('82', '..10', b.x)} ${w('83', '..10', b.z ?? 0)}${b.kod ? ' ' + w('71', '....', b.kod, true) : ''}`).join('\n') + '\n';
}
export function exportSDR(body) { const c = (s, w = 16) => String(s).slice(0, w).padEnd(w); return '00NMSDR33 V04-04.2 QTRIG                       111111 211112\n' + body.map((b) => `08KI${c(b.cislo)}${c(f(b.x))}${c(f(b.y))}${c(b.z == null ? '' : f(b.z))}${c(b.kod || '')}`).join('\n') + '\n'; }
export function exportTopcon(body) { return body.map((b) => `${b.cislo},${f(b.x)},${f(b.y)},${b.z == null ? '' : f(b.z)},${b.kod || ''}`).join('\n') + '\n'; }
/** Geodimeter Area (label=hodnota): 2=číslo, 37=N(X), 38=E(Y), 39=Z, 4=kód */
export function exportGeodimeter(body) { return '50=QTRIG\n' + body.map((b) => `2=${b.cislo}\n37=${f(b.x)}\n38=${f(b.y)}${b.z != null ? `\n39=${f(b.z)}` : ''}${b.kod ? `\n4=${b.kod}` : ''}`).join('\n') + '\n'; }
/** Geodimeter měření: 5=stanovisko 3=vp 2=bod 6=vc 7=Hz 8=V 9=SD 10=HD 4=kód; 37/38/39 souřadnice */
export function importGeodimeter(text) {
    const r = { stanoviska: [], body: [], varovani: [] }; let akt = null, cur = {};
    const flush = () => { if (cur[2] != null && (cur[7] != null)) { if (!akt) { akt = { stanovisko: '?', vp: 0, radky: [], delky: 'sikme' }; r.stanoviska.push(akt); } akt.radky.push({ cislo: String(cur[2]), hz: cur[7] != null ? +cur[7] * (cur.uhly === 'deg' ? 400 / 360 : 1) : null, z: cur[8] != null ? +cur[8] * (cur.uhly === 'deg' ? 400 / 360 : 1) : null, ds: cur[9] != null ? +cur[9] : (cur[10] != null ? +cur[10] : null), vc: cur[6] != null ? +cur[6] : (akt.vc || 0), kod: cur[4] || '', typ: 'z' }); if (cur[9] == null && cur[10] != null) akt.delky = 'vodorovne'; } if (cur[2] != null && cur[37] != null && cur[38] != null) r.body.push({ cislo: String(cur[2]), y: Math.abs(+cur[38]), x: Math.abs(+cur[37]), z: cur[39] != null ? +cur[39] : null, kod: cur[4] || '' }); cur = {}; };
    for (const l of text.split(/\r?\n/)) { const m = l.trim().match(/^(\d+)=(.*)$/); if (!m) continue; const k = +m[1], v = m[2].trim(); if (k === 5) { flush(); akt = { stanovisko: v, vp: 0, radky: [], delky: 'sikme' }; r.stanoviska.push(akt); continue; } if (k === 3 && akt) { akt.vp = +v || 0; continue; } if (k === 2 && cur[2] != null) flush(); if (k === 6 && akt) akt.vc = +v; cur[k] = v; }
    flush(); r.varovani.push('Geodimeter: úhly čteny jako gony (nastavení přístroje).'); return r;
}
