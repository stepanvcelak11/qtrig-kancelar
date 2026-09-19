// Most do MicroStationu (M2): návod, makro ke stažení, export TXT pro makro, živé body přes účet.
import { Projekt } from './projekt.js';
import { el, dialog, ulozSoubor, toast } from './ui.js';
import { Ucet } from './ucet.js';

document.addEventListener('microstation', () => dialogMicroStation());
export async function dialogMicroStation() {
    const p = Projekt.get();
    await dialog({ titulek: 'MicroStation — živý most', sirka: 720, obsah: el('div', { style: 'display:grid;gap:10px;font-size:13.5px' },
        el('p', { style: 'margin:0' }, el('b', {}, 'Jak to funguje: '), 'v MicroStationu běží makro QTRIGMost (VBA). Přihlásí se stejným účtem jako Kancelář, každých 5 s se zeptá cloudové zakázky na nové body a vloží je do otevřeného výkresu (kříž + číslo, hladina podle kódu). Ty tady počítáš a ukládáš body (Účet → Poslat body do zakázky) — v MicroStationu přibývají. Vybrané prvky jdou poslat zpět (QTRIG_PoslatVybrane → tady Účet → Stáhnout).'),
        el('ol', { style: 'margin:0;padding-left:18px' }, el('li', {}, 'Stáhni makro a v MicroStationu: Utilities → Macro → VBA editor (Alt+F11) → File → Import File → QTRIGMost.bas.'), el('li', {}, 'V makru nahoře vyplň KOD_UCTU, HESLO a ZAKAZKA (název projektu v Kanceláři malými písmeny: „' + (p.nazev || '').toLowerCase() + '“).'), el('li', {}, 'Utilities → Macro → Macros… → QTRIG_ZivyMost. Zastavení: QTRIG_Zastavit.'), el('li', {}, 'Bez cloudu: QTRIG_NacistSoubor načte TXT (číslo Y X Z kód) — tlačítko níže ho uloží.')),
        el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
            el('button', { class: 'btn hlavni', onclick: async () => { try { const r = await fetch('most/QTRIGMost.bas'); ulozSoubor('QTRIGMost.bas', await r.text()); } catch { toast('Makro nejde stáhnout (offline?)', 'bad'); } } }, 'Stáhnout makro QTRIGMost.bas'),
            el('button', { class: 'btn', onclick: () => ulozSoubor('body.txt', p.body.filter((b) => b.y != null).map((b) => `${b.cislo} ${b.y.toFixed(3)} ${b.x.toFixed(3)} ${(b.z ?? 0).toFixed(3)}${b.kod ? ' ' + b.kod.replace(/\s+/g, '_') : ''}`).join('\r\n') + '\r\n') }, 'Uložit TXT pro makro (bez cloudu)'),
            el('button', { class: 'btn', onclick: () => Ucet.dialog() }, Ucet.jePrihlasen() ? 'Účet: poslat body do zakázky' : 'Přihlásit účet (živý most)')),
        el('p', { class: 'tlum', style: 'margin:0;font-size:12.5px' }, 'Souřadnice: makro vkládá matematicky (X = −Y, Y = −X, přepínač ZAPORNE). Jednotky výkresu metry. Na rovinu: MicroStation tu není, makro je podle dokumentace VBA MicroStationu — první spuštění doladíme u tebe (hlášky z makra mi pošli).')) });
}
