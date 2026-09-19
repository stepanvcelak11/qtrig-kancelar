// Zápisník měření: seznam stanovisek vlevo, editor stanoviska uprostřed.
import { Projekt } from './projekt.js';
import { el, $, fmt, fmtG, cislo, toast, potvrd, zeptej, dialog } from './ui.js';
import { Stred } from './stred.js';
import * as ZN from './zapisnik-nastroje.js';

let kore;
export const Zapisnik = {
    init(root) {
        kore = root;
        root.append(el('div', { class: 'nastroje' }, el('button', { class: 'btn maly hlavni', onclick: nove }, '+ Stanovisko'), el('button', { class: 'btn maly', id: 'zap-import', onclick: () => document.dispatchEvent(new CustomEvent('import-zapisnik')) }, 'Import z totálky'), el('button', { class: 'btn maly tichy', title: 'Další', onclick: dalsi }, '⋯')), el('div', { id: 'zap-seznam' }));
        Projekt.poslouchej((co) => { if (co === 'projekt' || co === 'zapisnik' || co === 'data') vykresli(); });
        vykresli();
    },
    otevri,
};

function vykresli() {
    const p = Projekt.get(); if (!kore || !p) return;
    const c = $('#zap-seznam', kore); c.innerHTML = '';
    $('#poc-zapisnik').textContent = p.zapisnik.length || '';
    if (!p.zapisnik.length) { c.append(el('div', { class: 'prazdno' }, el('b', {}, 'Prázdný zápisník'), 'Založ stanovisko a zapiš měření ručně, nebo importuj zápisník z totální stanice.')); return; }
    const ul = el('ul', { class: 'seznam' });
    p.zapisnik.forEach((s) => {
        const o = s.radky.filter((r) => r.typ === 'o').length, z = s.radky.length - o;
        ul.append(el('li', { class: Stred.aktivni() === 'st-' + s.id ? 'aktivni' : '', onclick: () => otevri(s.id) },
            el('span', { class: 'mono', style: 'font-weight:500' }, s.stanovisko || '—'), el('span', { class: 't tlum' }, s.pozn || ''), el('span', { class: 'd' }, `${o} or · ${z} zám`)));
    });
    c.append(ul);
}

async function dalsi() {
    const B = (text, fn) => el('button', { class: 'btn', style: 'justify-content:flex-start', onclick: async () => { const ov = $('.dlg-overlay'); if (ov) ov.remove(); await fn(); } }, text);
    await dialog({ titulek: 'Zápisník (seznam měření)', sirka: 640, obsah: el('div', { style: 'display:grid;gap:6px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))' },
        B('Zpracování zápisníku…', () => ZN.zpracovaniZapisniku()), B('Označení orientací…', () => ZN.oznaceniOrientaci()), B('Spojení opakovaných stanovisek', () => ZN.spojeniStanovisek()), B('Definice teodolitu…', () => ZN.definiceTeodolitu()), B('Export zápisníku (MAPA2, uživatelský)…', () => ZN.exportMereni())) });
}
async function nove() {
    const cis = await zeptej('Nové stanovisko', Projekt.volneCislo(5001), 'Číslo bodu stanoviska'); if (cis == null) return;
    const s = Projekt.novyStanovisko(cis.trim()); Projekt.zmena('zapisnik'); otevri(s.id);
}

function otevri(id) {
    const s = Projekt.stanovisko(id); if (!s) return;
    Stred.otevri({ id: 'st-' + id, titulek: 'Stanovisko ' + (s.stanovisko || '?'), render: (sek) => editor(sek, s), obnov: true });
    vykresli();
}

function editor(sek, s) {
    const p = Projekt.get();
    const bodSt = () => Projekt.bod(s.stanovisko);
    const hlava = el('div', { class: 'form' },
        el('div', { class: 'radek' },
            pole('Stanovisko (číslo bodu)', el('input', { type: 'text', value: s.stanovisko, id: 'st-cislo', onchange: (e) => { s.stanovisko = e.target.value.trim(); Projekt.zmena('zapisnik'); Stred.obnov('st-' + s.id); } })),
            pole('Výška přístroje [m]', el('input', { type: 'text', class: 'num', inputmode: 'decimal', value: fmt(s.vp), id: 'st-vp', onchange: (e) => { s.vp = cislo(e.target.value) ?? 0; Projekt.zmena('zapisnik'); } })),
            pole('Délky v zápisníku', el('select', { id: 'st-delky', onchange: (e) => { s.delky = e.target.value; Projekt.zmena('zapisnik'); } }, el('option', { value: 'sikme', selected: (s.delky || 'sikme') === 'sikme' }, 'šikmé (redukují se zenitem)'), el('option', { value: 'vodorovne', selected: s.delky === 'vodorovne' }, 'vodorovné'))),
            pole('Poznámka', el('input', { type: 'text', value: s.pozn || '', id: 'st-pozn', onchange: (e) => { s.pozn = e.target.value; Projekt.zmena('zapisnik'); } })),
        ),
        el('div', { class: 'tlum', id: 'st-info' }, bodSt() ? `Stanovisko má souřadnice Y ${fmt(bodSt().y)}  X ${fmt(bodSt().x)}${bodSt().z != null ? '  Z ' + fmt(bodSt().z) : ''}` : 'Bod stanoviska není v seznamu souřadnic — půjde spočítat jako volné stanovisko z orientací se směrem i délkou.'),
    );
    const tab = el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Typ'), el('th', {}, 'Cíl'), el('th', { class: 'num' }, 'Hz [g]'), el('th', { class: 'num' }, 'Zenit [g]'), el('th', { class: 'num' }, s.delky === 'vodorovne' ? 'Vodor. délka' : 'Šikmá délka'), el('th', { class: 'num' }, 'V. cíle'), el('th', { class: 'num', title: 'Převýšení (ze zpracování)' }, 'Δh'), el('th', {}, 'Kód'), el('th', {}, ''))));
    const tb = el('tbody'); tab.append(tb);
    const radek = (r, i) => {
        const tr = el('tr');
        const inp = (k, num, dec) => { const e = el('input', { type: 'text', class: num ? 'num' : '', inputmode: num ? 'decimal' : 'text', value: num ? (k === 'hz' || k === 'z' ? fmtG(r[k], 4) : fmt(r[k], dec)) : (r[k] || ''), 'aria-label': k }); e.onchange = () => { r[k] = num ? cislo(e.value) : e.value.trim(); if (num) e.value = k === 'hz' || k === 'z' ? fmtG(r[k], 4) : fmt(r[k], dec); Projekt.zmena('zapisnik'); }; e.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); const nxt = tr.nextElementSibling; if (nxt) nxt.querySelector('input[aria-label=' + k + ']')?.focus(); else pridej(k); } }; return e; };
        tr.append(
            el('td', {}, el('button', { class: 'btn maly ' + (r.typ === 'o' ? 'hlavni' : ''), title: 'Orientace / záměra', onclick: (e) => { r.typ = r.typ === 'o' ? 'z' : 'o'; e.target.className = 'btn maly ' + (r.typ === 'o' ? 'hlavni' : ''); e.target.textContent = r.typ === 'o' ? 'OR' : 'zám'; Projekt.zmena('zapisnik'); } }, r.typ === 'o' ? 'OR' : 'zám')),
            el('td', { class: 'cislo' }, inp('cislo', false)), el('td', { class: 'num' }, inp('hz', true, 4)), el('td', { class: 'num' }, inp('z', true, 4)), el('td', { class: 'num' }, inp('ds', true, 3)), el('td', { class: 'num' }, inp('vc', true, 3)), el('td', { class: 'num tlum mono' }, r.dh != null ? fmt(r.dh) : ''), el('td', {}, inp('kod', false)),
            el('td', { class: 'akce' }, el('button', { class: 'ikona', title: 'Smazat řádek', onclick: () => { s.radky.splice(i, 1); Projekt.zmena('zapisnik'); Stred.obnov('st-' + s.id); } }, '✕')),
        );
        return tr;
    };
    s.radky.forEach((r, i) => tb.append(radek(r, i)));
    const pridej = (fokus = 'cislo') => { const posl = s.radky[s.radky.length - 1]; s.radky.push({ cislo: '', hz: null, z: null, ds: null, vc: posl ? posl.vc : null, kod: '', typ: s.radky.length ? 'z' : 'o' }); Projekt.zmena('zapisnik'); Stred.obnov('st-' + s.id); const rows = $('#stred-obsah section.aktivni tbody')?.rows; if (rows && rows.length) rows[rows.length - 1].querySelector('input[aria-label=' + fokus + ']')?.focus(); };
    sek.append(hlava, el('div', { class: 'tw' }, tab),
        el('div', { class: 'nastroje', style: 'position:static;border-top:1px solid var(--line2);border-bottom:0' },
            el('button', { class: 'btn maly', onclick: () => pridej() }, '+ Řádek'),
            el('button', { class: 'btn maly', onclick: () => ZN.zpracovaniZapisniku(s.id) }, 'Zpracovat (polohy, redukce…)'),
            el('span', { style: 'flex:1' }),
            el('button', { class: 'btn maly nebezpecny tichy', onclick: async () => { if (await potvrd('Smazat stanovisko ' + s.stanovisko + ' i s měřením?')) { const i = p.zapisnik.indexOf(s); if (i >= 0) p.zapisnik.splice(i, 1); Projekt.zmena('zapisnik'); Stred.zavri('st-' + s.id); } } }, 'Smazat stanovisko'),
            el('button', { class: 'btn hlavni', onclick: () => document.dispatchEvent(new CustomEvent('vypocet', { detail: { typ: 'polarni', stanoviskoId: s.id } })) }, 'Spočítat polární metodou →'),
        ),
        el('p', { class: 'tlum', style: 'padding:6px 14px;font-size:12.5px;margin:0' }, 'OR = orientace na známý bod (může mít i délku), zám = podrobný bod. Hz a zenit v gonech, délky v metrech. Enter = další řádek.'));
}
function pole(popis, inp) { return el('label', { class: 'pole' }, el('span', {}, popis), inp); }
