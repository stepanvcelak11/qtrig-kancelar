// Prostřední panel: záložky s otevřenými kartami (zápisník stanoviska, výpočet, …).
import { el, $ } from './ui.js';

const karty = new Map(); let aktivni = null;

export const Stred = {
    /** otevri({ id, titulek, render(container), zavritelna=true }) — když id existuje, jen přepne */
    otevri(k) {
        if (!karty.has(k.id)) {
            const sekce = el('section', { dataset: { id: k.id } });
            karty.set(k.id, { ...k, sekce });
            $('#stred-obsah').append(sekce);
            k.render(sekce);
        } else if (k.obnov) { const kk = karty.get(k.id); kk.sekce.innerHTML = ''; kk.render(kk.sekce); }
        Stred.prepni(k.id);
        if (k.mobil !== false) mobilPrepni('panel-stred');
    },
    prepni(id) { aktivni = id; karty.forEach((k, kid) => k.sekce.classList.toggle('aktivni', kid === id)); zalozky(); },
    zavri(id) { const k = karty.get(id); if (!k) return; k.sekce.remove(); karty.delete(id); if (aktivni === id) aktivni = [...karty.keys()].pop() || null; Stred.prepni(aktivni); if (!karty.size) uvitani(); },
    obnov(id) { const k = karty.get(id); if (k) { k.sekce.innerHTML = ''; k.render(k.sekce); } },
    aktivni: () => aktivni,
    ma: (id) => karty.has(id),
    uvitani,
};

function zalozky() {
    const z = $('#stred-zalozky'); z.innerHTML = '';
    karty.forEach((k, id) => {
        const b = el('button', { role: 'tab', 'aria-selected': String(id === aktivni), onclick: () => Stred.prepni(id) }, k.titulek);
        if (k.zavritelna !== false) b.append(el('span', { class: 'poc', title: 'Zavřít', onclick: (e) => { e.stopPropagation(); Stred.zavri(id); } }, '✕'));
        z.append(b);
    });
}
function uvitani() {
    Stred.otevri({ id: 'uvitani', titulek: 'Začátek', zavritelna: true, mobil: false, render: (s) => s.append(el('div', { class: 'prazdno', style: 'padding-top:60px' }, el('b', {}, 'Vyber vlevo, co budeš dělat'),
        'Body: seznam souřadnic. Zápisník: měření z totální stanice po stanoviscích. Výpočty: rajón, polygon, protínání, volné stanovisko a další — každý výsledek se ukáže tady, s posouzením podle mezních odchylek, a zapíše do protokolu vpravo.')) });
}
export function mobilPrepni(panelId, tab) {
    if (!matchMedia('(max-width:900px)').matches) { if (tab) prepniZalozku(panelId, tab); return; }
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('mobil-aktivni', p.id === panelId));
    document.querySelectorAll('.mobil-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mobil === panelId && (!tab || b.dataset.tab === tab))));
    if (tab) prepniZalozku(panelId, tab);
}
export function prepniZalozku(panelId, tab) {
    const p = document.getElementById(panelId);
    p.querySelectorAll('.zalozky [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    p.querySelectorAll('.obsah>section').forEach((s) => s.classList.toggle('aktivni', s.id === 'sekce-' + tab));
}
