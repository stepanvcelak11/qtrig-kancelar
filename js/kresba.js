// Kresba (M3): geodetický CAD nad seznamem bodů podle principu Gromy (prvky se vážou na čísla bodů,
// změna souřadnic se promítne do kresby) + volné vrcholy. Hladiny, linie, oblouk 3 body, kružnice,
// text, kóta, značka; chytání na body; kresba z kódů (kódovací tabulka, grafické kódy KÓD|n);
// referenční DXF; import/export DXF. Kreslí se do plátna mapy (mapa.js volá Kresba.kresli).
import { Projekt } from './projekt.js';
import { el, $, fmt, toast, dialog, potvrd, ulozSoubor, otevriSoubor, ctiText, zeptej } from './ui.js';
import { delka, smernik, rajon, kruzniceTremiBody } from '../geo/zaklad.js';
import { gonNorm, gonDiff } from '../geo/uhly.js';

const VYCHOZI_HLADINY = [{ nazev: '0', barva: '#4A5563', viditelna: true }, { nazev: 'BODY', barva: '#17202A', viditelna: true }, { nazev: 'KRESBA', barva: '#D9480F', viditelna: true }, { nazev: 'TEXT', barva: '#1E7F4F', viditelna: true }, { nazev: 'KOTY', barva: '#B7791F', viditelna: true }];
let nastroj = 'vyber', rozdelane = [], vybrany = null, hladinaAkt = 'KRESBA', kreslici = null;

export function kresba() { const p = Projekt.get(); if (!p.kresba) p.kresba = { hladiny: JSON.parse(JSON.stringify(VYCHOZI_HLADINY)), prvky: [] }; if (!p.kresba.hladiny.length) p.kresba.hladiny = JSON.parse(JSON.stringify(VYCHOZI_HLADINY)); return p.kresba; }
export const Kresba = {
    nastroj: () => nastroj,
    /** souřadnice vrcholu: číslo bodu → z projektu, jinak {y,x} */
    vrchol(v) { if (typeof v === 'string') { const b = Projekt.bod(v); return b && b.y != null ? { y: b.y, x: b.x, cislo: v } : null; } return v; },
    body(prvek) { return (prvek.body || []).map((v) => Kresba.vrchol(v)).filter(Boolean); },
    hladina(n) { return kresba().hladiny.find((h) => h.nazev === n) || kresba().hladiny[0]; },
    /** panel nástrojů do mapy */
    panel() {
        const b = (id, t, title) => el('button', { class: 'btn maly' + (nastroj === id ? ' hlavni' : ''), title, dataset: { n: id }, onclick: () => { nastroj = id; rozdelane = []; Kresba.obnovPanel(); toast({ vyber: 'Klik na prvek = výběr, Delete = smazat', linie: 'Klikej body (chytá se na body seznamu), dvojklik / Esc = konec', oblouk: 'Tři body oblouku: začátek, střed, konec', kruznice: 'Střed a bod na kružnici', text: 'Klik = umístit text', kota: 'Dva body = kóta délky', znacka: 'Klik na bod = značka' }[id] || ''); } }, t);
        kreslici = el('div', { class: 'kresba-panel' }, b('vyber', '↖', 'Výběr'), b('linie', '╱', 'Linie'), b('oblouk', '◠', 'Oblouk 3 body'), b('kruznice', '○', 'Kružnice'), b('text', 'A', 'Text'), b('kota', '↔', 'Kóta'), b('znacka', '✚', 'Značka'), el('button', { class: 'btn maly tichy', title: 'Hladiny, kódy, DXF…', onclick: nabidka }, '⋯'));
        return kreslici;
    },
    obnovPanel() { if (!kreslici) return; kreslici.querySelectorAll('[data-n]').forEach((x) => x.classList.toggle('hlavni', x.dataset.n === nastroj)); },
    /** klik do mapy: p = {y,x}, bod = nejbližší bod seznamu (nebo null), ctx = { prekresli } */
    klik(p, bod, ctx) {
        const k = kresba(); const v = bod ? bod.cislo : { y: p.y, x: p.x };
        const hotovo = (prvek) => { k.prvky.push({ id: 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), hladina: hladinaAkt, ...prvek }); rozdelane = []; Projekt.zmena('kresba'); };
        if (nastroj === 'vyber') { vybrany = najdiPrvek(p, ctx.k); ctx.prekresli(); return; }
        if (nastroj === 'linie') { rozdelane.push(v); ctx.prekresli(); return; }
        if (nastroj === 'oblouk') { rozdelane.push(v); if (rozdelane.length === 3) hotovo({ typ: 'oblouk', body: rozdelane.slice() }); ctx.prekresli(); return; }
        if (nastroj === 'kruznice') { rozdelane.push(v); if (rozdelane.length === 2) { const S = Kresba.vrchol(rozdelane[0]), B = Kresba.vrchol(rozdelane[1]); hotovo({ typ: 'kruznice', body: [rozdelane[0]], r: delka(S, B) }); } ctx.prekresli(); return; }
        if (nastroj === 'kota') { rozdelane.push(v); if (rozdelane.length === 2) hotovo({ typ: 'kota', body: rozdelane.slice() }); ctx.prekresli(); return; }
        if (nastroj === 'znacka') { hotovo({ typ: 'znacka', body: [v], znacka: 'x' }); ctx.prekresli(); return; }
        if (nastroj === 'text') { zeptej('Text', bod ? bod.cislo : '', 'Text do kresby').then((t) => { if (t) { hotovo({ typ: 'text', body: [v], text: t, vyska: 1.5 }); ctx.prekresli(); } }); return; }
    },
    /** dvojklik / Esc: uzavřít linii */
    ukonci(ctx) { if (nastroj === 'linie' && rozdelane.length >= 2) { const k = kresba(); k.prvky.push({ id: 'k' + Date.now().toString(36), hladina: hladinaAkt, typ: 'linie', body: rozdelane.slice() }); Projekt.zmena('kresba'); } rozdelane = []; if (ctx) ctx.prekresli(); },
    smazVybrany() { if (!vybrany) return; const k = kresba(); const i = k.prvky.indexOf(vybrany); if (i >= 0) k.prvky.splice(i, 1); vybrany = null; Projekt.zmena('kresba'); },
    /** vykreslení do canvasu (volá mapa.js) */
    kresli(ctx, naObr, k, css) {
        const kr = Projekt.get().kresba; if (!kr) return;
        for (const pr of kr.prvky) {
            const h = kr.hladiny.find((x) => x.nazev === pr.hladina) || kr.hladiny[0]; if (h && h.viditelna === false) continue;
            const barva = pr.barva || (h && h.barva) || css('--ink2'); const B = Kresba.body(pr); if (!B.length) continue;
            ctx.strokeStyle = barva; ctx.fillStyle = barva; ctx.lineWidth = pr === vybrany ? 3 : (pr.ref ? 0.8 : 1.5); ctx.setLineDash(pr.ref ? [2, 3] : []);
            if (pr.typ === 'linie') { ctx.beginPath(); B.forEach((b, i) => { const { sx, sy } = naObr(b.y, b.x); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); if (pr.uzavrit) ctx.closePath(); ctx.stroke(); }
            else if (pr.typ === 'oblouk' && B.length === 3) { const c = kruzniceTremiBody(B[0], B[1], B[2]); if (!c) continue; const s = naObr(c.stred.y, c.stred.x); const a0 = uhelObr(c.stred, B[0]), a1 = uhelObr(c.stred, B[1]), a2 = uhelObr(c.stred, B[2]); const ccw = ((a1 - a0 + 2 * Math.PI) % (2 * Math.PI)) > ((a2 - a0 + 2 * Math.PI) % (2 * Math.PI)); ctx.beginPath(); ctx.arc(s.sx, s.sy, c.r * k, a0, a2, ccw); ctx.stroke(); }
            else if (pr.typ === 'kruznice') { const s = naObr(B[0].y, B[0].x); ctx.beginPath(); ctx.arc(s.sx, s.sy, (pr.r || 1) * k, 0, Math.PI * 2); ctx.stroke(); }
            else if (pr.typ === 'text') { const s = naObr(B[0].y, B[0].x); ctx.font = `${Math.max(9, Math.min(28, (pr.vyska || 1.5) * k))}px ${css('--sans')}`; ctx.fillText(pr.text || '', s.sx + 3, s.sy - 3); }
            else if (pr.typ === 'kota' && B.length === 2) { const a = naObr(B[0].y, B[0].x), b = naObr(B[1].y, B[1].x); ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke(); ctx.font = `11px ${css('--mono')}`; ctx.save(); ctx.translate((a.sx + b.sx) / 2, (a.sy + b.sy) / 2); let ang = Math.atan2(b.sy - a.sy, b.sx - a.sx); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI; ctx.rotate(ang); ctx.textAlign = 'center'; ctx.fillText(fmt(delka(B[0], B[1]), 2), 0, -4); ctx.restore(); ctx.textAlign = 'left'; }
            else if (pr.typ === 'znacka') { const s = naObr(B[0].y, B[0].x); ctx.beginPath(); ctx.moveTo(s.sx - 5, s.sy - 5); ctx.lineTo(s.sx + 5, s.sy + 5); ctx.moveTo(s.sx - 5, s.sy + 5); ctx.lineTo(s.sx + 5, s.sy - 5); ctx.stroke(); }
            ctx.setLineDash([]);
        }
        // rozdělaná linie
        if (rozdelane.length) { ctx.strokeStyle = css('--acc'); ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath(); rozdelane.map(Kresba.vrchol).filter(Boolean).forEach((b, i) => { const { sx, sy } = naObr(b.y, b.x); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.stroke(); ctx.setLineDash([]); }
    },
    zKodu, importDXF, exportDXF, hladiny: dialogHladiny,
};
const uhelObr = (S, B) => Math.atan2(B.x - S.x, S.y - B.y); // obrazovkový úhel (sx = −Y, sy = +X)
function najdiPrvek(p, k) {
    const kr = kresba(); let best = null, bd = 10 / k;
    for (const pr of kr.prvky) { const B = Kresba.body(pr); if (!B.length) continue; let d = Infinity; if (pr.typ === 'linie' || pr.typ === 'kota') { for (let i = 0; i < B.length - 1; i++) d = Math.min(d, vzdalUsecka(p, B[i], B[i + 1])); if (pr.uzavrit && B.length > 2) d = Math.min(d, vzdalUsecka(p, B[B.length - 1], B[0])); } else if (pr.typ === 'kruznice') d = Math.abs(delka(p, B[0]) - pr.r); else d = delka(p, B[0]); if (d < bd) { bd = d; best = pr; } }
    return best;
}
function vzdalUsecka(P, A, B) { const dy = B.y - A.y, dx = B.x - A.x, l2 = dy * dy + dx * dx; if (l2 < 1e-12) return delka(P, A); let t = ((P.y - A.y) * dy + (P.x - A.x) * dx) / l2; t = Math.max(0, Math.min(1, t)); return delka(P, { y: A.y + t * dy, x: A.x + t * dx }); }

// ---------------- kresba z kódů ----------------
/** Podle kódovací tabulky: kód typu linie/plocha → spojnice bodů se stejným kódem v pořadí čísel; grafický kód KÓD|n = n-tá linie */
export function zKodu(vymazStare = true) {
    const p = Projekt.get(); const k = kresba(); const tab = p.kody || [];
    if (vymazStare) k.prvky = k.prvky.filter((pr) => !pr.zKodu);
    const skupiny = new Map();
    for (const b of p.body) { for (const kod of (b.kod || '').split(/\s+/).filter(Boolean)) { const [zakl, n] = kod.split('|'); const def = tab.find((t) => t.kod === zakl); if (!def || !['linie', 'plocha', 'znacka'].includes(def.typ)) continue; const key = zakl + '|' + (n || ''); if (!skupiny.has(key)) skupiny.set(key, { def, body: [] }); skupiny.get(key).body.push(b); } }
    let n = 0;
    for (const [key, { def, body }] of skupiny) {
        const num = (s) => { const m = String(s).match(/(\d+)$/); return m ? +m[1] : 0; }; body.sort((a, b) => num(a.cislo) - num(b.cislo) || a.cislo.localeCompare(b.cislo));
        if (!k.hladiny.some((h) => h.nazev === def.hladina)) k.hladiny.push({ nazev: def.hladina, barva: def.barva || '#4A5563', viditelna: true });
        if (def.typ === 'znacka') body.forEach((b) => { k.prvky.push({ id: 'z' + key + b.cislo, hladina: def.hladina, typ: 'znacka', body: [b.cislo], zKodu: true }); n++; });
        else if (body.length >= 2) { k.prvky.push({ id: 'l' + key, hladina: def.hladina, typ: 'linie', body: body.map((b) => b.cislo), uzavrit: def.typ === 'plocha', zKodu: true }); n++; }
    }
    Projekt.zmena('kresba'); return n;
}

// ---------------- DXF import / export prvků ----------------
export function importDXF(text, jakoRef = false, nazev = 'REF') {
    const k = kresba(); const lines = text.split(/\r\n|\r|\n/); const pairs = []; for (let i = 0; i + 1 < lines.length; i += 2) pairs.push({ c: parseInt(lines[i].trim(), 10), v: lines[i + 1] });
    let i = 0; while (i < pairs.length && !(pairs[i].c === 2 && /ENTITIES/i.test(pairs[i].v))) i++;
    const conv = (x, y) => ({ y: Math.abs(x), x: Math.abs(y) }); // DXF (−Y, −X) nebo (Y, X) → kladné S-JTSK
    const snap = (pt) => { const b = Projekt.get().body.find((q) => q.y != null && Math.abs(q.y - pt.y) < 0.002 && Math.abs(q.x - pt.x) < 0.002); return b ? b.cislo : pt; };
    let n = 0; const hl = (name) => { const nm = (jakoRef ? nazev + ':' : '') + (name || '0'); if (!k.hladiny.some((h) => h.nazev === nm)) k.hladiny.push({ nazev: nm, barva: jakoRef ? '#7A8593' : '#4A5563', viditelna: true }); return nm; };
    while (i < pairs.length) {
        if (pairs[i].c !== 0) { i++; continue; } const typ = pairs[i].v.trim().toUpperCase(); let j = i + 1; const e = { xs: [], ys: [], layer: '0' }; let vertexy = [], polyClosed = false;
        while (j < pairs.length && pairs[j].c !== 0) { const { c, v } = pairs[j]; if (c === 8) e.layer = v.trim(); if (c === 10) e.xs.push(+v); if (c === 20) e.ys.push(+v); if (c === 11) e.x1 = +v; if (c === 21) e.y1 = +v; if (c === 40) e.r = +v; if (c === 50) e.a0 = +v; if (c === 51) e.a1 = +v; if (c === 1) e.text = v; if (c === 70) e.flags = +v; j++; }
        if (typ === 'POLYLINE') { polyClosed = !!(e.flags & 1); while (j < pairs.length) { if (pairs[j].c === 0 && pairs[j].v.trim().toUpperCase() === 'VERTEX') { let m = j + 1; const vt = {}; while (m < pairs.length && pairs[m].c !== 0) { if (pairs[m].c === 10) vt.x = +pairs[m].v; if (pairs[m].c === 20) vt.y = +pairs[m].v; m++; } if (vt.x != null) vertexy.push(conv(vt.x, vt.y)); j = m; } else if (pairs[j].c === 0 && pairs[j].v.trim().toUpperCase() === 'SEQEND') { let m = j + 1; while (m < pairs.length && pairs[m].c !== 0) m++; j = m; break; } else break; } }
        const push = (pr) => { k.prvky.push({ id: 'd' + Date.now().toString(36) + n, hladina: hl(e.layer), ref: jakoRef, ...pr }); n++; };
        if (typ === 'LINE' && e.xs.length && e.x1 != null) push({ typ: 'linie', body: [snap(conv(e.xs[0], e.ys[0])), snap(conv(e.x1, e.y1))] });
        else if (typ === 'LWPOLYLINE' && e.xs.length > 1) push({ typ: 'linie', body: e.xs.map((x, q) => snap(conv(x, e.ys[q]))), uzavrit: !!(e.flags & 1) });
        else if (typ === 'POLYLINE' && vertexy.length > 1) push({ typ: 'linie', body: vertexy.map(snap), uzavrit: polyClosed });
        else if (typ === 'CIRCLE' && e.xs.length) push({ typ: 'kruznice', body: [snap(conv(e.xs[0], e.ys[0]))], r: e.r });
        else if (typ === 'ARC' && e.xs.length) { const S = conv(e.xs[0], e.ys[0]); const bod = (deg) => { const a = deg * Math.PI / 180; return { y: S.y - e.r * Math.cos(a), x: S.x - e.r * Math.sin(a) }; }; let a0 = e.a0, a1 = e.a1; if (a1 < a0) a1 += 360; push({ typ: 'oblouk', body: [snap(bod(a0)), bod((a0 + a1) / 2), snap(bod(a1))] }); }
        else if ((typ === 'TEXT' || typ === 'MTEXT') && e.xs.length && !(e.layer === 'CISLA' && !jakoRef)) push({ typ: 'text', body: [conv(e.xs[0], e.ys[0])], text: e.text || '', vyska: e.r || 1.5 });
        else if (typ === 'POINT' && e.xs.length && !jakoRef) { const pt = conv(e.xs[0], e.ys[0]); if (typeof snap(pt) !== 'string') push({ typ: 'znacka', body: [pt] }); }
        i = j;
    }
    Projekt.zmena('kresba'); return n;
}
export function exportDXF(vcetneBodu = true) {
    const p = Projekt.get(); const k = kresba(); const X = (b) => (-b.y).toFixed(3), Y = (b) => (-b.x).toFixed(3);
    const hl = new Set(k.hladiny.map((h) => h.nazev)); k.prvky.forEach((pr) => hl.add(pr.hladina)); hl.add('BODY'); hl.add('CISLA');
    let s = '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n' + hl.size + '\n';
    for (const h of hl) s += `0\nLAYER\n2\n${h.replace(/[^\w:-]/g, '_')}\n70\n0\n62\n7\n6\nCONTINUOUS\n`;
    s += '0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
    if (vcetneBodu) for (const b of p.body) { if (b.y == null) continue; s += `0\nPOINT\n8\nBODY\n10\n${X(b)}\n20\n${Y(b)}\n30\n${(b.z ?? 0).toFixed(3)}\n0\nTEXT\n8\nCISLA\n10\n${(-b.y + 0.3).toFixed(3)}\n20\n${(-b.x + 0.3).toFixed(3)}\n30\n0\n40\n0.5\n1\n${b.cislo}\n`; }
    for (const pr of k.prvky) { if (pr.ref) continue; const B = Kresba.body(pr); const L = pr.hladina.replace(/[^\w:-]/g, '_'); if (!B.length) continue;
        if (pr.typ === 'linie' || pr.typ === 'kota') { s += `0\nPOLYLINE\n8\n${L}\n66\n1\n70\n${pr.uzavrit ? 1 : 0}\n`; B.forEach((b) => { s += `0\nVERTEX\n8\n${L}\n10\n${X(b)}\n20\n${Y(b)}\n30\n0\n`; }); s += '0\nSEQEND\n'; if (pr.typ === 'kota') s += `0\nTEXT\n8\n${L}\n10\n${(-(B[0].y + B[1].y) / 2).toFixed(3)}\n20\n${(-(B[0].x + B[1].x) / 2).toFixed(3)}\n30\n0\n40\n0.5\n1\n${fmt(delka(B[0], B[1]), 2)}\n`; }
        else if (pr.typ === 'kruznice') s += `0\nCIRCLE\n8\n${L}\n10\n${X(B[0])}\n20\n${Y(B[0])}\n30\n0\n40\n${(pr.r || 0).toFixed(3)}\n`;
        else if (pr.typ === 'oblouk' && B.length === 3) { const c = kruzniceTremiBody(B[0], B[1], B[2]); if (!c) continue; const ang = (b) => { let a = Math.atan2(-(b.x - c.stred.x), -(b.y - c.stred.y)) * 180 / Math.PI; return (a + 360) % 360; }; const a0 = ang(B[0]), a1 = ang(B[1]), a2 = ang(B[2]); const ccw = ((a1 - a0 + 360) % 360) < ((a2 - a0 + 360) % 360); s += `0\nARC\n8\n${L}\n10\n${X(c.stred)}\n20\n${Y(c.stred)}\n30\n0\n40\n${c.r.toFixed(3)}\n50\n${(ccw ? a0 : a2).toFixed(4)}\n51\n${(ccw ? a2 : a0).toFixed(4)}\n`; }
        else if (pr.typ === 'text') s += `0\nTEXT\n8\n${L}\n10\n${X(B[0])}\n20\n${Y(B[0])}\n30\n0\n40\n${(pr.vyska || 1.5).toFixed(2)}\n1\n${(pr.text || '').replace(/\n/g, ' ')}\n`;
        else if (pr.typ === 'znacka') s += `0\nPOINT\n8\n${L}\n10\n${X(B[0])}\n20\n${Y(B[0])}\n30\n0\n`; }
    return s + '0\nENDSEC\n0\nEOF\n';
}

// ---------------- dialogy ----------------
async function dialogHladiny() {
    const k = kresba(); const tb = el('tbody');
    const radek = (h) => { const tr = el('tr'); tr.append(el('td', {}, el('input', { type: 'radio', name: 'hl-akt', checked: h.nazev === hladinaAkt, 'aria-label': 'akt' })), el('td', {}, el('input', { type: 'text', value: h.nazev, 'aria-label': 'nazev' })), el('td', {}, el('input', { type: 'color', value: h.barva || '#4A5563', 'aria-label': 'barva', style: 'width:38px;height:28px;padding:0;border:0;background:none' })), el('td', {}, el('input', { type: 'checkbox', checked: h.viditelna !== false, 'aria-label': 'vid' })), el('td', { class: 'tlum mono' }, String(k.prvky.filter((p) => p.hladina === h.nazev).length)), el('td', { class: 'akce' }, el('button', { class: 'ikona', onclick: () => tr.remove() }, '✕'))); tb.append(tr); };
    k.hladiny.forEach(radek);
    const ok = await dialog({ titulek: 'Hladiny kresby', sirka: 560, obsah: el('div', { style: 'display:grid;gap:8px' }, el('div', { class: 'tw' }, el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Aktivní'), el('th', {}, 'Název'), el('th', {}, 'Barva'), el('th', {}, 'Vidět'), el('th', {}, 'Prvků'), el('th', {}, ''))), tb)), el('button', { class: 'btn maly', onclick: () => radek({ nazev: 'NOVA', barva: '#4A5563', viditelna: true }) }, '+ Hladina')), tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Uložit', hodnota: true, class: 'hlavni' }] });
    if (!ok) return;
    const nove = [...tb.rows].map((tr) => { const g = (l) => tr.querySelector(`[aria-label=${l}]`); return { nazev: g('nazev').value.trim() || '0', barva: g('barva').value, viditelna: g('vid').checked, akt: g('akt').checked }; });
    k.hladiny = nove.map(({ akt, ...h }) => h); const a = nove.find((h) => h.akt); if (a) hladinaAkt = a.nazev; Projekt.zmena('kresba');
}
async function nabidka() {
    const k = kresba(); const p = Projekt.get();
    const B = (t, fn, cls = '') => el('button', { class: 'btn ' + cls, style: 'justify-content:flex-start', onclick: async () => { const ov = $('.dlg-overlay'); if (ov) ov.remove(); await fn(); } }, t);
    await dialog({ titulek: `Kresba (${k.prvky.length} prvků, aktivní hladina ${hladinaAkt})`, sirka: 640, obsah: el('div', { style: 'display:grid;gap:6px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))' },
        B('Hladiny…', dialogHladiny),
        B('Kresba z kódů bodů (kódovací tabulka)', () => { const n = zKodu(true); toast(`Z kódů vzniklo ${n} prvků` + (n ? '' : ' — nastav v kódovací tabulce typ linie/plocha/značka'), n ? 'ok' : 'bad'); }),
        B('Referenční výkres DXF (podklad)…', async () => { const f = await otevriSoubor(''); if (!f) return; const n = importDXF(await ctiText(f), true, f.name.replace(/\.dxf$/i, '')); toast(`Referenční výkres: ${n} prvků`, 'ok'); }),
        B('Import DXF do kresby (chytá na body do 2 mm)…', async () => { const f = await otevriSoubor(''); if (!f) return; const n = importDXF(await ctiText(f), false); toast(`Načteno ${n} prvků`, 'ok'); }),
        B('Export DXF (body + kresba) — pro MicroStation / AutoCAD', () => ulozSoubor((p.nazev || 'kresba').replace(/[^\w-]+/g, '_') + '.dxf', exportDXF(true), 'application/dxf')),
        B('Uzavřít / otevřít vybranou linii', () => { if (vybrany && vybrany.typ === 'linie') { vybrany.uzavrit = !vybrany.uzavrit; Projekt.zmena('kresba'); } else toast('Nejdřív vyber linii'); }),
        B('Smazat vybraný prvek (Delete)', () => Kresba.smazVybrany()),
        B('Smazat referenční výkresy', () => { k.prvky = k.prvky.filter((x) => !x.ref); k.hladiny = k.hladiny.filter((h) => !h.nazev.includes(':')); Projekt.zmena('kresba'); }),
        B('Smazat celou kresbu', async () => { if (await potvrd('Smazat všechny prvky kresby?')) { k.prvky = []; Projekt.zmena('kresba'); } }, 'nebezpecny'),
        B('MicroStation — živý most…', () => document.dispatchEvent(new CustomEvent('microstation'))),
    ) });
}
