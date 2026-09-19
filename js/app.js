// Spuštění: projekt, panely, motiv, děliče, mobilní záložky, nabídka projektu.
import { Projekt, startProjekt, otevriProjekt, zalozProjekt, importProjekt } from './projekt.js';
import { Uloziste } from './uloziste.js';
import { el, $, $$, toast, dialog, potvrd, zeptej, ulozSoubor, otevriSoubor, ctiText, pamet, datumCas } from './ui.js';
import { Body } from './body.js';
import { Zapisnik } from './zapisnik.js';
import { Vypocty } from './vypocty.js';
import { Mapa } from './mapa.js';
import { Protokol } from './protokol.js';
import { Stred, mobilPrepni, prepniZalozku } from './stred.js';
import { KODY_KVALITY } from '../geo/presnost.js';
import { importZapisniku } from './import-ui.js';
import { Ucet } from './ucet.js';

export const VERZE = '0.8';

async function start() {
    await startProjekt();
    Body.init($('#sekce-body')); Zapisnik.init($('#sekce-zapisnik')); Vypocty.init($('#sekce-vypocty'));
    Mapa.init(); Protokol.init($('#sekce-protokol')); Stred.uvitani();
    // záložky v levém a pravém panelu
    $$('.panel .zalozky [role=tab][data-tab]').forEach((b) => b.addEventListener('click', () => prepniZalozku(b.closest('.panel').id, b.dataset.tab)));
    // mobil
    $$('.mobil-tabs button').forEach((b) => b.addEventListener('click', () => mobilPrepni(b.dataset.mobil, b.dataset.tab)));
    $('#panel-levy').classList.add('mobil-aktivni');
    // motiv
    $('#btn-tema').onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; pamet.set('tema', t); Mapa.ukazVse(); };
    $('#btn-napoveda').onclick = napoveda;
    $('#btn-projekt').onclick = nabidkaProjektu;
    $('#btn-ucet').onclick = () => Ucet.dialog();
    $('#btn-zpet').onclick = () => { if (!Projekt.zpet()) toast('Není co vrátit'); };
    $('#btn-vpred').onclick = () => { if (!Projekt.vpred()) toast('Není co opakovat'); };
    document.addEventListener('keydown', (e) => { if (!(e.ctrlKey || e.metaKey) || e.target.matches('input,textarea')) return; if (e.key === 'z') { e.preventDefault(); Projekt.zpet(); } if (e.key === 'y') { e.preventDefault(); Projekt.vpred(); } });
    const ucetLista = () => { $('#btn-ucet').textContent = Ucet.jePrihlasen() ? '● ' + Ucet.jmeno() : 'Účet'; }; ucetLista(); document.addEventListener('ucet-zmena', ucetLista);
    delice();
    Projekt.poslouchej(stavListy); stavListy('projekt');
    // klik na bod v mapě → vybrat v seznamu
    document.addEventListener('mapa-bod', (e) => Body.vyber(e.detail.cislo));
    document.addEventListener('import-zapisnik', () => importZapisniku());
    window.addEventListener('beforeunload', () => Projekt.ulozHned());
    document.addEventListener('visibilitychange', () => { if (document.hidden) Projekt.ulozHned(); });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
}

function stavListy(co) {
    const p = Projekt.get(); if (!p) return;
    $('#btn-projekt').textContent = (p.nazev || 'Projekt') + ' ▾';
    $('#stav-ulozeni').textContent = `${p.body.length} bodů · ${p.zapisnik.length} stan. · uloženo ${datumCas(p.zmeneno).slice(-5)}`;
    if (co === 'projekt') document.title = (p.nazev ? p.nazev + ' · ' : '') + 'QTRIG Kancelář';
}

async function nabidkaProjektu() {
    const p = Projekt.get();
    const seznam = await Uloziste.seznam().catch(() => []);
    const ul = el('ul', { class: 'seznam', style: 'border:1px solid var(--line);border-radius:6px;max-height:220px;overflow:auto' });
    seznam.forEach((s) => ul.append(el('li', { class: s.id === p.id ? 'aktivni' : '', onclick: async () => { zavri(); await otevriProjekt(s.id); toast('Otevřen ' + s.nazev); } }, el('span', { class: 't' }, s.nazev), el('span', { class: 'd' }, `${s.pocetBodu} b · ${datumCas(s.zmeneno).slice(0, 10)}`))));
    let zavri = () => { };
    const obsah = el('div', { style: 'display:grid;gap:12px' },
        el('div', { class: 'radek' },
            el('label', { class: 'pole' }, el('span', {}, 'Název projektu'), el('input', { type: 'text', value: p.nazev, id: 'pr-nazev', onchange: (e) => { p.nazev = e.target.value.trim() || 'Projekt'; Projekt.zmena('projekt'); } })),
            el('label', { class: 'pole' }, el('span', {}, 'Zakázka'), el('input', { type: 'text', value: p.zakazka || '', id: 'pr-zak', onchange: (e) => { p.zakazka = e.target.value.trim(); Projekt.zmena('projekt'); } })),
            el('label', { class: 'pole' }, el('span', {}, 'Lokalita / k. ú.'), el('input', { type: 'text', value: p.lokalita || '', id: 'pr-lok', onchange: (e) => { p.lokalita = e.target.value.trim(); Projekt.zmena('projekt'); } })),
            el('label', { class: 'pole' }, el('span', {}, 'Vyhotovil'), el('input', { type: 'text', value: p.kdo || '', id: 'pr-kdo', onchange: (e) => { p.kdo = e.target.value.trim(); Projekt.zmena('projekt'); } })),
            el('label', { class: 'pole' }, el('span', {}, 'Kód kvality (mezní odchylky)'), el('select', { id: 'pr-kod', onchange: (e) => { p.kodKvality = +e.target.value; Projekt.zmena('projekt'); } }, Object.entries(KODY_KVALITY).map(([k, v]) => el('option', { value: k, selected: +k === p.kodKvality }, v.popis)))),
            el('label', { class: 'pole' }, el('span', {}, 'Polygonové pořady posuzovat jako'), el('select', { id: 'pr-porad', onchange: (e) => { p.druhPoradu = e.target.value; Projekt.zmena('projekt'); } }, el('option', { value: 'pomocny', selected: p.druhPoradu === 'pomocny' }, 'pomocný pořad (100·√(n+3) mgon)'), el('option', { value: 'ppbp', selected: p.druhPoradu === 'ppbp' }, 'PPBP (25·√(n+2) mgon)'))),
        ),
        el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
            el('button', { class: 'btn', onclick: async () => { const n = await zeptej('Nový projekt', 'Projekt ' + new Date().toLocaleDateString('cs-CZ'), 'Název'); if (n) { zavri(); await zalozProjekt(n.trim() || 'Projekt'); toast('Založen ' + n); } } }, '+ Nový projekt'),
            el('button', { class: 'btn', onclick: async () => { await Projekt.ulozHned(); ulozSoubor((p.nazev || 'projekt').replace(/[^\w\-]+/g, '_') + '.qtrig.json', JSON.stringify(p, null, 1), 'application/json'); } }, 'Uložit do souboru'),
            el('button', { class: 'btn', onclick: async () => { const f = await otevriSoubor(''); if (!f) return; try { const o = JSON.parse(await ctiText(f)); zavri(); await importProjekt(o); toast('Projekt otevřen ze souboru', 'ok'); } catch (e) { toast('Soubor nejde otevřít: ' + e.message, 'bad'); } } }, 'Otevřít ze souboru'),
            el('button', { class: 'btn nebezpecny', onclick: async () => { if (seznam.length < 2) { toast('Poslední projekt nejde smazat'); return; } if (await potvrd(`Smazat projekt „${p.nazev}“ včetně bodů a zápisníku?`)) { zavri(); await Uloziste.smaz(p.id); const s = seznam.find((x) => x.id !== p.id); await otevriProjekt(s.id); toast('Projekt smazán'); } } }, 'Smazat projekt'),
        ),
        el('div', { class: 'skupina', style: 'padding-left:0' }, 'Projekty v tomto prohlížeči'), ul,
    );
    const pr = dialog({ titulek: 'Projekt', obsah, sirka: 640 });
    zavri = () => { const ov = $('.dlg-overlay'); if (ov) ov.remove(); };
    await pr;
}

function delice() {
    const plocha = $('#plocha');
    const w = pamet.get('sirky', {}); if (w.w1) plocha.style.setProperty('--w1', w.w1 + 'px'); if (w.w3) plocha.style.setProperty('--w3', w.w3 + 'px');
    $$('.delic').forEach((d) => {
        d.addEventListener('pointerdown', (e) => {
            e.preventDefault(); d.setPointerCapture(e.pointerId); d.classList.add('tahne');
            const n = d.dataset.delic, r = plocha.getBoundingClientRect();
            const move = (ev) => { if (n === '1') { const v = Math.max(200, Math.min(ev.clientX - r.left, r.width * .5)); plocha.style.setProperty('--w1', v + 'px'); w.w1 = v; } else { const v = Math.max(220, Math.min(r.right - ev.clientX, r.width * .6)); plocha.style.setProperty('--w3', v + 'px'); w.w3 = v; } };
            const up = () => { d.classList.remove('tahne'); d.removeEventListener('pointermove', move); d.removeEventListener('pointerup', up); pamet.set('sirky', w); };
            d.addEventListener('pointermove', move); d.addEventListener('pointerup', up);
        });
    });
}

function napoveda() {
    dialog({ titulek: 'QTRIG Kancelář ' + VERZE, sirka: 620, obsah: el('div', { style: 'display:grid;gap:8px;font-size:13.5px' },
        el('p', { style: 'margin:0' }, 'Geodetické výpočty v S-JTSK (Y, X kladné, směrníky v gonech od +X po směru hodinových ručiček). Všechno se ukládá samo do tohoto prohlížeče; projekt jde uložit do souboru a otevřít jinde.'),
        el('ul', { style: 'margin:0;padding-left:18px' },
            el('li', {}, el('b', {}, 'Body'), ' — seznam souřadnic. Klik do buňky = úprava, Enter = potvrdit. Import/Export TXT a CSV s volbou pořadí sloupců.'),
            el('li', {}, el('b', {}, 'Zápisník'), ' — stanoviska s orientacemi (OR) a záměrami. Hz a zenit v gonech, délky šikmé nebo vodorovné. „Spočítat polární metodou“ udělá orientaci (nebo volné stanovisko), redukci délek, body i výšky.'),
            el('li', {}, el('b', {}, 'Výpočty'), ' — každá úloha má formulář; výsledek ukáže semafor podle mezních odchylek vyhlášky 357/2013 Sb. pro kód kvality z nastavení projektu, body jdou jedním klikem uložit a do protokolu vpravo se zapíše celý postup.'),
            el('li', {}, el('b', {}, 'Mapa'), ' — kolečko / dva prsty = přiblížení, tažení = posun, klik na bod = výběr v seznamu.'),
            el('li', {}, el('b', {}, 'Na telefonu'), ' jsou tři panely jako záložky dole.')),
        el('p', { class: 'tlum', style: 'margin:0' }, 'Mezní odchylky: m_xy 0,14 m (kód 3), u_xy 0,28 m, u_p 0,40 m, oměrné u_d = 2·√2·m_xy·(d+12)/(d+20). Žlutá = nad 80 % meze, červená = překročeno.')) });
}

start().catch((e) => { console.error(e); toast('Aplikace se nespustila: ' + e.message, 'bad'); });
