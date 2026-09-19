// Výpočetní protokol podle Gromy (kap. 13): lokální protokoly každého výpočtu → hlavní protokol,
// výpis seznamu souřadnic / měření do protokolu, editace bloků, přečíslování protokolu, parametry
// (vstupní body, bez Z, k. ú. pomlčkou), kódování při uložení (UTF-8 / Windows-1250), tisk/PDF.
import { Projekt } from './projekt.js';
import { el, $, datumCas, ulozSoubor, toast, potvrd, dialog, fmt, fmtG, otevriSoubor, ctiText } from './ui.js';

let kore;
export const PROTOKOL_VYCHOZI = { vytvaret: true, vstupniBody: true, bezZ: false, kuPomlckou: false, hlavicka: true, kodovani: 'utf8' };
export const nastaveniProtokolu = () => ({ ...PROTOKOL_VYCHOZI, ...(Projekt.get().protokolNastaveni || {}) });

export const Protokol = {
    init(root) {
        kore = root;
        root.append(el('div', { class: 'nastroje' }, el('button', { class: 'btn maly', onclick: kopiruj }, 'Kopírovat'), el('button', { class: 'btn maly', onclick: ulozTxt }, 'Uložit'), el('button', { class: 'btn maly', onclick: tisk }, 'Tisk / PDF'), el('button', { class: 'btn maly tichy', title: 'Další', onclick: dalsi }, '⋯')), el('div', { id: 'prot-obsah' }));
        Projekt.poslouchej((co) => { if (co === 'projekt' || co === 'protokol') vykresli(); });
        vykresli();
    },
    /** Přidá blok lokálního protokolu do hlavního protokolu: { nadpis, text } */
    pridej(nadpis, text) {
        const p = Projekt.get(); const n = nastaveniProtokolu(); if (n.vytvaret === false) return;
        if (!p.protokol) p.protokol = [];
        let t = text; if (n.bezZ) t = t.replace(/\s+Z\s+-?[\d ]+,\d+/g, '').replace(/ Z -?\d[\d ]*,\d+/g, ''); if (n.kuPomlckou) t = t.replace(/\b(\d{6})(\d{9})\b/g, '$1-$2');
        p.protokol.push({ kdy: new Date().toISOString(), nadpis, text: t });
        Projekt.zmena('protokol');
    },
    hlavicka, cely,
};
function hlavicka() {
    const p = Projekt.get(); const n = nastaveniProtokolu(); if (!n.hlavicka) return '';
    return [`QTRIG Kancelář — výpočetní protokol`, `Zakázka: ${p.zakazka || p.nazev || '—'}${p.lokalita ? ' · ' + p.lokalita : ''}`, `Vyhotovil: ${p.kdo || '—'}`, `Kód kvality: ${p.kodKvality} · souřadnicový systém S-JTSK, výšky Bpv`, ''].join('\n');
}
function cely() { const p = Projekt.get(); return hlavicka() + (p.protokol || []).map((b) => `=== ${b.nadpis}  (${datumCas(b.kdy)}) ===\n${b.text}\n`).join('\n'); }
function vykresli() {
    const p = Projekt.get(); if (!kore || !p) return;
    const c = $('#prot-obsah', kore); c.innerHTML = '';
    if (!(p.protokol || []).length) { c.append(el('div', { class: 'prazdno' }, el('b', {}, 'Protokol je prázdný'), 'Každý výpočet sem zapíše vstupy, výsledky a posouzení odchylek.')); return; }
    const pre = el('pre', { class: 'protokol' });
    if (hlavicka()) pre.append(el('div', { class: 'blok tlum' }, hlavicka()));
    p.protokol.forEach((b, i) => pre.append(el('div', { class: 'blok', ondblclick: () => editace(i) }, el('b', {}, `=== ${b.nadpis}  (${datumCas(b.kdy)}) ===`), el('button', { class: 'ikona', style: 'float:right;width:22px;height:22px', title: 'Upravit / smazat blok', onclick: () => editace(i) }, '⋯'), '\n' + b.text)));
    c.append(pre); c.scrollTop = c.scrollHeight;
}
async function editace(i) {
    const p = Projekt.get(); const b = p.protokol[i]; const ta = el('textarea', { rows: 14, id: 'pe-text', style: 'font:12.5px var(--mono)' }); ta.value = b.text; const nad = el('input', { type: 'text', value: b.nadpis, id: 'pe-nadpis' });
    const r = await dialog({ titulek: 'Blok protokolu', sirka: 760, obsah: el('div', { style: 'display:grid;gap:8px' }, el('label', { class: 'pole' }, el('span', {}, 'Nadpis'), nad), ta), tlacitka: [{ text: 'Smazat blok', hodnota: 'smazat', class: 'nebezpecny' }, { text: 'Zrušit', hodnota: null }, { text: 'Uložit', hodnota: true, class: 'hlavni' }] });
    if (r === 'smazat') { p.protokol.splice(i, 1); Projekt.zmena('protokol'); } else if (r) { b.text = ta.value; b.nadpis = nad.value.trim() || b.nadpis; Projekt.zmena('protokol'); }
}
async function kopiruj() { try { await navigator.clipboard.writeText(cely()); toast('Protokol zkopírován', 'ok'); } catch { toast('Kopírování se nepovedlo', 'bad'); } }
// Windows-1250 pro Gromu / staré programy
const CP1250 = { 'Ě': 0xCC, 'ě': 0xEC, 'Š': 0x8A, 'š': 0x9A, 'Č': 0xC8, 'č': 0xE8, 'Ř': 0xD8, 'ř': 0xF8, 'Ž': 0x8E, 'ž': 0x9E, 'Ý': 0xDD, 'ý': 0xFD, 'Á': 0xC1, 'á': 0xE1, 'Í': 0xCD, 'í': 0xED, 'É': 0xC9, 'é': 0xE9, 'Ú': 0xDA, 'ú': 0xFA, 'Ů': 0xD9, 'ů': 0xF9, 'Ď': 0xCF, 'ď': 0xEF, 'Ť': 0x8D, 'ť': 0x9D, 'Ň': 0xD2, 'ň': 0xF2, 'Ó': 0xD3, 'ó': 0xF3, 'Ä': 0xC4, 'ä': 0xE4, 'Ö': 0xD6, 'ö': 0xF6, 'Ü': 0xDC, 'ü': 0xFC, 'Ĺ': 0xC5, 'ĺ': 0xE5, 'Ľ': 0xBC, 'ľ': 0xBE, 'Ô': 0xD4, 'ô': 0xF4, 'Ŕ': 0xC0, 'ŕ': 0xE0, '°': 0xB0, '§': 0xA7, '–': 0x96, '—': 0x97, '„': 0x84, '“': 0x93, '”': 0x94, '…': 0x85, '·': 0xB7 };
export function doCP1250(s) { const out = new Uint8Array(s.length); let j = 0; for (const ch of s) { const c = ch.charCodeAt(0); out[j++] = c < 128 ? c : (CP1250[ch] ?? 0x3F); } return out.slice(0, j); }
async function ulozTxt() {
    const p = Projekt.get(); const n = nastaveniProtokolu(); const nazev = (p.nazev || 'protokol').replace(/[^\w\-]+/g, '_') + '-protokol.txt';
    const text = cely().replace(/\n/g, '\r\n');
    if (n.kodovani === 'cp1250') ulozSoubor(nazev, new Blob([doCP1250(text)], { type: 'text/plain' })); else ulozSoubor(nazev, text);
}
function tisk() {
    const w = window.open('', '_blank'); if (!w) { toast('Prohlížeč zablokoval okno tisku', 'bad'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Protokol</title><style>body{font:11.5px/1.45 "IBM Plex Mono",Consolas,monospace;margin:18mm;white-space:pre-wrap}h1{font:600 16px sans-serif}@page{margin:12mm}</style><h1>Výpočetní protokol</h1>${cely().replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}`);
    w.document.close(); setTimeout(() => w.print(), 300);
}
document.addEventListener('protokol-parametry', () => dalsi(true));
async function dalsi(jenParametry = false) {
    const p = Projekt.get(); const n = nastaveniProtokolu();
    if (jenParametry) return parametry();
    const B = (t, fn, cls = '') => el('button', { class: 'btn ' + cls, style: 'justify-content:flex-start', onclick: async () => { const ov = $('.dlg-overlay'); if (ov) ov.remove(); await fn(); } }, t);
    await dialog({ titulek: 'Protokol', sirka: 640, obsah: el('div', { style: 'display:grid;gap:6px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))' },
        B('Výpis seznamu souřadnic do protokolu', () => { Protokol.pridej('Seznam souřadnic', p.body.map((b) => `${b.cislo.padEnd(16)} Y ${fmt(b.y).padStart(12)} X ${fmt(b.x).padStart(13)}${b.z != null ? ' Z ' + fmt(b.z).padStart(9) : '           '}  ${b.kvalita || ' '}  ${b.kod || ''}`).join('\n') + `\n${p.body.length} bodů`); }),
        B('Výpis seznamu měření do protokolu', () => { Protokol.pridej('Seznam měření', p.zapisnik.map((s) => `stanovisko ${s.stanovisko}  vp ${fmt(s.vp)}  (${s.delky === 'vodorovne' ? 'vodorovné' : 'šikmé'} délky)\n` + s.radky.map((r) => `  ${r.typ === 'o' ? 'OR' : '  '} ${r.cislo.padEnd(16)} Hz ${fmtG(r.hz).padStart(9)}  Z ${fmtG(r.z).padStart(9)}  d ${fmt(r.ds).padStart(9)}  vc ${fmt(r.vc)}  ${r.kod || ''}`).join('\n')).join('\n\n')); }),
        B('Přečíslování protokolu podle seznamu (staré = nové)…', async () => { const f = await otevriSoubor(''); if (!f) return; const mapa = []; (await ctiText(f)).split(/\r?\n/).forEach((l) => { const m = l.trim().split(/[\s=;,]+/); if (m.length >= 2) mapa.push([m[0], m[1]]); }); mapa.sort((a, b) => b[0].length - a[0].length); let n2 = 0; (p.protokol || []).forEach((b) => { for (const [a, c] of mapa) { const re = new RegExp('(^|[^\\w])' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[^\\w]|$)', 'g'); b.text = b.text.replace(re, (m, pre) => { n2++; return pre + c; }); } }); Projekt.zmena('protokol'); toast(`Nahrazeno ${n2} výskytů`, 'ok'); }),
        B('Načíst protokol ze souboru (připojit)', async () => { const f = await otevriSoubor(''); if (!f) return; Protokol.pridej('Připojený protokol ' + f.name, await ctiText(f)); }),
        B('Parametry protokolu…', parametry),
        B('Vymazat celý protokol', async () => { if ((p.protokol || []).length && await potvrd('Vymazat celý protokol? Výpočty v projektu zůstanou.')) { p.protokol = []; Projekt.zmena('protokol'); } }, 'nebezpecny')) });
    async function parametry() {
        const F = { vytvaret: el('input', { type: 'checkbox', checked: n.vytvaret !== false, id: 'pp-vyt' }), vstupniBody: el('input', { type: 'checkbox', checked: n.vstupniBody !== false, id: 'pp-vst' }), bezZ: el('input', { type: 'checkbox', checked: !!n.bezZ, id: 'pp-bezz' }), kuPomlckou: el('input', { type: 'checkbox', checked: !!n.kuPomlckou, id: 'pp-ku' }), hlavicka: el('input', { type: 'checkbox', checked: n.hlavicka !== false, id: 'pp-hl' }) };
        const kod = el('select', { id: 'pp-kod' }, [['utf8', 'UTF-8 (Windows 10+, mobil)'], ['cp1250', 'Windows-1250 (Groma, starší programy)']].map(([v, t]) => el('option', { value: v, selected: v === n.kodovani }, t)));
        const L = (i, t) => el('label', { style: 'display:flex;gap:8px;align-items:center' }, i, t);
        const ok = await dialog({ titulek: 'Parametry protokolu', obsah: el('div', { style: 'display:grid;gap:8px' }, L(F.vytvaret, 'vytvářet protokol při výpočtech'), L(F.hlavicka, 'hlavička se zakázkou a vyhotovitelem'), L(F.vstupniBody, 'zapisovat souřadnice vstupních bodů'), L(F.bezZ, 'neprotokolovat souřadnici Z'), L(F.kuPomlckou, 'oddělit číslo k. ú. pomlčkou (610844-000144001)'), el('label', { class: 'pole' }, el('span', {}, 'Kódování při uložení do souboru'), kod)), tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Uložit', hodnota: true, class: 'hlavni' }] });
        if (!ok) return; p.protokolNastaveni = { vytvaret: F.vytvaret.checked, vstupniBody: F.vstupniBody.checked, bezZ: F.bezZ.checked, kuPomlckou: F.kuPomlckou.checked, hlavicka: F.hlavicka.checked, kodovani: kod.value }; Projekt.zmena('projekt'); toast('Parametry uloženy', 'ok');
    }
}
