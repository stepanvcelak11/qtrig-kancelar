// Tiskové sestavy seznamů (Groma kap. 17): výběr sloupců, hlavičky, jen označené, náhled → tisk / PDF.
import { Projekt } from './projekt.js';
import { el, fmt, fmtG, dialog, toast, datumCas } from './ui.js';

export async function tiskSeznamu(co = 'body', vybrane = null) {
    const p = Projekt.get();
    const sloupce = co === 'body' ? [['cislo', 'Číslo', 1], ['y', 'Y', 1], ['x', 'X', 1], ['z', 'Z', 1], ['kvalita', 'Kód kvality', 0], ['kod', 'Kód', 1], ['typ', 'Typ', 0], ['pozn', 'Poznámka', 0]] : [['stanovisko', 'Stanovisko', 1], ['cislo', 'Cíl', 1], ['typ', 'OR', 1], ['hz', 'Hz [g]', 1], ['z', 'Zenit [g]', 1], ['ds', 'Délka', 1], ['vc', 'V. cíle', 1], ['dh', 'Δh', 0], ['kod', 'Kód', 1]];
    const chk = Object.fromEntries(sloupce.map(([k, t, on]) => [k, el('input', { type: 'checkbox', checked: !!on, id: 'ti-' + k })]));
    const hl = { nazev: el('input', { type: 'checkbox', checked: true, id: 'ti-hl-nazev' }), zakazka: el('input', { type: 'checkbox', checked: true, id: 'ti-hl-zak' }), kdo: el('input', { type: 'checkbox', checked: true, id: 'ti-hl-kdo' }), datum: el('input', { type: 'checkbox', checked: true, id: 'ti-hl-datum' }) };
    const jen = el('input', { type: 'checkbox', id: 'ti-jen', checked: !!(vybrane && vybrane.length) });
    const font = el('select', { id: 'ti-font' }, [['11px', 'malé (11 px)'], ['12.5px', 'střední'], ['14px', 'velké']].map(([v, t]) => el('option', { value: v, selected: v === '12.5px' }, t)));
    const ok = await dialog({ titulek: 'Tisk ' + (co === 'body' ? 'seznamu souřadnic' : 'seznamu měření'), sirka: 600, obsah: el('div', { style: 'display:grid;gap:10px' },
        el('div', {}, el('b', {}, 'Sloupce: '), sloupce.map(([k, t]) => el('label', { style: 'margin-right:12px' }, chk[k], ' ' + t))),
        el('div', {}, el('b', {}, 'Hlavička: '), el('label', { style: 'margin-right:12px' }, hl.nazev, ' název projektu'), el('label', { style: 'margin-right:12px' }, hl.zakazka, ' zakázka / lokalita'), el('label', { style: 'margin-right:12px' }, hl.kdo, ' vyhotovil'), el('label', {}, hl.datum, ' datum')),
        el('div', { class: 'radek' }, el('label', { class: 'pole' }, el('span', {}, 'Písmo'), font), vybrane && vybrane.length ? el('label', { style: 'padding-top:20px' }, jen, ` jen označené (${vybrane.length})`) : null)),
        tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Náhled a tisk', hodnota: true, class: 'hlavni' }] });
    if (!ok) return;
    const w = window.open('', '_blank'); if (!w) { toast('Prohlížeč zablokoval okno tisku', 'bad'); return; }
    const e = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
    const sl = sloupce.filter(([k]) => chk[k].checked);
    let radky;
    if (co === 'body') radky = (jen.checked && vybrane ? vybrane : p.body).map((b) => sl.map(([k]) => ['y', 'x', 'z'].includes(k) ? fmt(b[k]) : b[k] ?? ''));
    else radky = p.zapisnik.flatMap((s) => s.radky.map((r) => sl.map(([k]) => k === 'stanovisko' ? s.stanovisko : k === 'typ' ? (r.typ === 'o' ? 'OR' : '') : ['hz', 'z'].includes(k) ? fmtG(r[k]) : ['ds', 'vc', 'dh'].includes(k) ? fmt(r[k]) : r[k] ?? '')));
    const hlavicka = [hl.nazev.checked ? p.nazev : null, hl.zakazka.checked ? [p.zakazka, p.lokalita].filter(Boolean).join(' · ') : null, hl.kdo.checked ? (p.kdo ? 'Vyhotovil: ' + p.kdo : null) : null, hl.datum.checked ? datumCas() : null].filter(Boolean);
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${e(co === 'body' ? 'Seznam souřadnic' : 'Seznam měření')}</title><style>body{font:${font.value}/1.4 "IBM Plex Mono",Consolas,monospace;margin:16mm}h1{font:600 16px sans-serif;margin:0 0 4px}.hl{color:#555;font:12px sans-serif;margin-bottom:12px}table{border-collapse:collapse;width:100%}th{text-align:left;border-bottom:1px solid #000;padding:3px 6px;font-weight:600}td{padding:2px 6px;border-bottom:1px solid #ddd;white-space:nowrap}td.n,th.n{text-align:right}tfoot td{border:0;color:#777;font-size:11px;padding-top:8px}@page{margin:12mm}@media print{thead{display:table-header-group}}</style>
<h1>${e(co === 'body' ? 'Seznam souřadnic (S-JTSK, Bpv)' : 'Seznam měření')}</h1><div class="hl">${hlavicka.map(e).join(' · ')}</div>
<table><thead><tr>${sl.map(([k, t]) => `<th class="${['y', 'x', 'z', 'hz', 'ds', 'vc', 'dh'].includes(k) ? 'n' : ''}">${e(t)}</th>`).join('')}</tr></thead><tbody>${radky.map((r) => `<tr>${r.map((v, i) => `<td class="${['y', 'x', 'z', 'hz', 'ds', 'vc', 'dh'].includes(sl[i][0]) ? 'n' : ''}">${e(v)}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr><td colspan="${sl.length}">${radky.length} položek · QTRIG Kancelář</td></tr></tfoot></table>`);
    w.document.close(); setTimeout(() => w.print(), 400);
}
