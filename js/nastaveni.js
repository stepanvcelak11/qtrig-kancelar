// Nastavení projektu podle Gromy (Soubor → Nastavení): prostředí (pořadí souřadnic, desetinná místa),
// výpočty (měřítko, redukce, orientace), tolerance, teodolit, protokol, kódování, formáty.
import { Projekt } from './projekt.js';
import { el, $, dialog, toast, cislo, fmt, pamet } from './ui.js';
import { definiceTeodolitu, teodolit } from './zapisnik-nastroje.js';
import { sadyTolerance, tolerance } from './vypocty3.js';
import { KODY_KVALITY } from '../geo/presnost.js';

export const NASTAVENI_VYCHOZI = { poradi: 'yx', desetinna: 3, desetinnaUhly: 4, meritko: 1, redukceVyska: true, redukceZobrazeni: true, orientaceVsechny: false, vahyOrientaci: '1', jazykCisel: 'carka' };
export const nastaveni = () => ({ ...NASTAVENI_VYCHOZI, ...(Projekt.get().nastaveni || {}) });

export async function dialogNastaveni() {
    const p = Projekt.get(); const n = nastaveni(); const T = teodolit(), tol = tolerance();
    const F = {
        poradi: el('select', { id: 'na-poradi' }, [['yx', 'Y X (S-JTSK, Groma výchozí)'], ['xy', 'X Y']].map(([v, t]) => el('option', { value: v, selected: v === n.poradi }, t))),
        desetinna: el('select', { id: 'na-des' }, [2, 3, 4].map((v) => el('option', { value: v, selected: v === n.desetinna }, v + ' místa'))),
        desetinnaUhly: el('select', { id: 'na-desu' }, [3, 4, 5].map((v) => el('option', { value: v, selected: v === n.desetinnaUhly }, v + ' místa'))),
        meritko: el('input', { type: 'text', id: 'na-mer', value: String(n.meritko), class: 'num' }),
        redukceVyska: el('input', { type: 'checkbox', id: 'na-rv', checked: n.redukceVyska }), redukceZobrazeni: el('input', { type: 'checkbox', id: 'na-rz', checked: n.redukceZobrazeni }),
        orientaceVsechny: el('input', { type: 'checkbox', id: 'na-ov', checked: n.orientaceVsechny }),
        vahyOrientaci: el('select', { id: 'na-vahy' }, [['1', 'všechny směry stejně (p = 1)'], ['s/1000', 'p = s / 1000 (podle délky)']].map(([v, t]) => el('option', { value: v, selected: v === n.vahyOrientaci }, t))),
        kod: el('select', { id: 'na-kod' }, Object.entries(KODY_KVALITY).map(([k, v]) => el('option', { value: k, selected: +k === p.kodKvality }, v.popis))),
        predcisli: el('input', { type: 'text', id: 'na-pre', value: p.predcisli || '', placeholder: 'k. ú. + ZPMZ (11 číslic)' }),
    };
    const L = (i, t) => el('label', { style: 'display:flex;gap:8px;align-items:center' }, i, t);
    const pole = (t, i) => el('label', { class: 'pole' }, el('span', {}, t), i);
    const ok = await dialog({ titulek: 'Nastavení', sirka: 720, obsah: el('div', { style: 'display:grid;gap:12px' },
        el('h3', {}, 'Prostředí'), el('div', { class: 'radek' }, pole('Pořadí souřadnic v tabulkách a výstupech', F.poradi), pole('Desetinná místa souřadnic', F.desetinna), pole('Desetinná místa úhlů', F.desetinnaUhly)),
        el('h3', {}, 'Výpočty'), el('div', { class: 'radek' }, pole('Kód kvality (mezní odchylky)', F.kod), pole('Předčíslí k. ú. + ZPMZ', F.predcisli), pole('Měřítkový koeficient (vytyčovací prvky)', F.meritko), pole('Váhy orientací', F.vahyOrientaci)),
        L(F.redukceVyska, 'redukovat délky z nadmořské výšky'), L(F.redukceZobrazeni, 'redukovat délky do Křovákova zobrazení'), L(F.orientaceVsechny, 'v dávkových výpočtech brát jako orientace všechny body se známými souřadnicemi (jinak jen OR)'),
        el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, el('button', { class: 'btn', onclick: () => { zavri(); sadyTolerance(); } }, `Tolerance… (${tol.nazev})`), el('button', { class: 'btn', onclick: () => { zavri(); definiceTeodolitu(); } }, `Teodolit… (${T.nazev})`), el('button', { class: 'btn', onclick: () => { zavri(); document.dispatchEvent(new CustomEvent('protokol-parametry')); } }, 'Protokol…'))),
        tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Uložit', hodnota: true, class: 'hlavni' }] });
    function zavri() { const ov = $('.dlg-overlay'); if (ov) ov.remove(); }
    if (!ok) return;
    p.nastaveni = { poradi: F.poradi.value, desetinna: +F.desetinna.value, desetinnaUhly: +F.desetinnaUhly.value, meritko: cislo(F.meritko.value) || 1, redukceVyska: F.redukceVyska.checked, redukceZobrazeni: F.redukceZobrazeni.checked, orientaceVsechny: F.orientaceVsechny.checked, vahyOrientaci: F.vahyOrientaci.value };
    p.kodKvality = +F.kod.value; p.predcisli = F.predcisli.value.trim();
    Projekt.zmena('projekt'); toast('Nastavení uloženo', 'ok');
}
