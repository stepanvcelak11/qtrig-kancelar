// Výpočetní protokol: bloky textu vznikají při každém výpočtu, zobrazují se vpravo,
// jdou uložit jako TXT nebo vytisknout / uložit do PDF.
import { Projekt } from './projekt.js';
import { el, $, datumCas, ulozSoubor, toast, potvrd } from './ui.js';

let kore;
export const Protokol = {
    init(root) {
        kore = root;
        root.append(el('div', { class: 'nastroje' }, el('button', { class: 'btn maly', onclick: kopiruj }, 'Kopírovat'), el('button', { class: 'btn maly', onclick: ulozTxt }, 'Uložit TXT'), el('button', { class: 'btn maly', onclick: tisk }, 'Tisk / PDF'), el('span', { style: 'flex:1' }), el('button', { class: 'btn maly tichy nebezpecny', onclick: vymaz }, 'Vymazat')), el('div', { id: 'prot-obsah' }));
        Projekt.poslouchej((co) => { if (co === 'projekt' || co === 'protokol') vykresli(); });
        vykresli();
    },
    /** Přidá blok: { nadpis, text } */
    pridej(nadpis, text) {
        const p = Projekt.get(); if (!p.protokol) p.protokol = [];
        p.protokol.push({ kdy: new Date().toISOString(), nadpis, text });
        Projekt.zmena('protokol');
    },
    hlavicka,
};
function hlavicka() {
    const p = Projekt.get();
    return [`QTRIG Kancelář — výpočetní protokol`, `Zakázka: ${p.zakazka || p.nazev || '—'}${p.lokalita ? ' · ' + p.lokalita : ''}`, `Vyhotovil: ${p.kdo || '—'}`, `Kód kvality: ${p.kodKvality} · souřadnicový systém S-JTSK, výšky Bpv`, ''].join('\n');
}
function cely() { const p = Projekt.get(); return hlavicka() + (p.protokol || []).map((b) => `=== ${b.nadpis}  (${datumCas(b.kdy)}) ===\n${b.text}\n`).join('\n'); }
function vykresli() {
    const p = Projekt.get(); if (!kore || !p) return;
    const c = $('#prot-obsah', kore); c.innerHTML = '';
    if (!(p.protokol || []).length) { c.append(el('div', { class: 'prazdno' }, el('b', {}, 'Protokol je prázdný'), 'Každý výpočet sem zapíše vstupy, výsledky a posouzení odchylek.')); return; }
    const pre = el('pre', { class: 'protokol' });
    pre.append(el('div', { class: 'blok tlum' }, hlavicka()));
    p.protokol.forEach((b) => pre.append(el('div', { class: 'blok' }, el('b', {}, `=== ${b.nadpis}  (${datumCas(b.kdy)}) ===\n`), b.text)));
    c.append(pre); c.scrollTop = c.scrollHeight;
}
async function kopiruj() { try { await navigator.clipboard.writeText(cely()); toast('Protokol zkopírován', 'ok'); } catch { toast('Kopírování se nepovedlo', 'bad'); } }
function ulozTxt() { const p = Projekt.get(); ulozSoubor((p.nazev || 'protokol').replace(/[^\w\-]+/g, '_') + '-protokol.txt', cely()); }
function tisk() {
    const w = window.open('', '_blank'); if (!w) { toast('Prohlížeč zablokoval okno tisku', 'bad'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Protokol</title><style>body{font:11.5px/1.45 "IBM Plex Mono",Consolas,monospace;margin:18mm;white-space:pre-wrap}h1{font:600 16px sans-serif}@page{margin:12mm}</style><h1>Výpočetní protokol</h1>${cely().replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}`);
    w.document.close(); setTimeout(() => w.print(), 300);
}
async function vymaz() { const p = Projekt.get(); if (!(p.protokol || []).length) return; if (await potvrd('Vymazat celý protokol? Výpočty v projektu zůstanou.')) { p.protokol = []; Projekt.zmena('protokol'); } }
