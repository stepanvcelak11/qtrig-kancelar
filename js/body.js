// Levý panel: seznam souřadnic (tabulka s úpravou v místě, hledání, import/export, duplicity).
import { Projekt } from './projekt.js';
import { el, $, fmt, cislo, toast, dialog, potvrd, ulozSoubor, otevriSoubor, ctiText, pamet } from './ui.js';
import { ctiSeznam, zapisSeznam, odhadniPoradi, PORADI } from './soubory.js';
import { Mapa } from './mapa.js';
import { dxf, kml, geojson } from './export.js';
import * as SN from './seznam-nastroje.js';
import { importPodleFormatu, exportPodleFormatu, polozkyBodu, PREDPISY_SOURADNICE } from './format-uziv.js';
import * as F_ from './formaty.js';
import { tiskSeznamu } from './tisk.js';

let kore, hledat = '', vybrany = null, razeni = pamet.get('body-razeni', 'cislo');
const oznacene = new Set(); // označené body (Groma: operace jen na označených, jinak na všech)

export const Body = {
    init(root) {
        kore = root;
        root.append(
            el('div', { class: 'nastroje' },
                el('input', { type: 'search', placeholder: 'Hledat číslo nebo kód…', id: 'body-hledat', oninput: (e) => { hledat = e.target.value.trim().toLowerCase(); vykresli(); } }),
                el('button', { class: 'btn maly hlavni', onclick: pridatBod }, '+ Bod'),
                el('button', { class: 'btn maly', onclick: importovat }, 'Import'),
                el('button', { class: 'btn maly', onclick: exportovat }, 'Export'),
                el('button', { class: 'btn maly tichy', title: 'Další', onclick: dalsi }, '⋯'),
            ),
            el('div', { id: 'body-tab' }),
        );
        Projekt.poslouchej((co) => { if (co === 'projekt' || co === 'body' || co === 'data') vykresli(); });
        vykresli();
    },
    vyber(cislo) { vybrany = cislo; vykresli(); const r = $('#body-tab tr.vybrany'); if (r) r.scrollIntoView({ block: 'nearest' }); },
};

function serazene() {
    const p = Projekt.get(); if (!p) return [];
    let b = p.body.slice();
    if (hledat) b = b.filter((x) => x.cislo.toLowerCase().includes(hledat) || (x.kod || '').toLowerCase().includes(hledat));
    const num = (s) => { const m = String(s).match(/\d+/); return m ? +m[0] : Infinity; };
    if (razeni === 'cislo') b.sort((a, c) => num(a.cislo) - num(c.cislo) || a.cislo.localeCompare(c.cislo, 'cs', { numeric: true }));
    else if (razeni === 'kod') b.sort((a, c) => (a.kod || '').localeCompare(c.kod || '', 'cs') || a.cislo.localeCompare(c.cislo, 'cs', { numeric: true }));
    return b;
}

function vykresli() {
    const p = Projekt.get(); if (!kore || !p) return;
    const cont = $('#body-tab', kore); cont.innerHTML = '';
    $('#poc-body').textContent = p.body.length ? p.body.length : '';
    const b = serazene();
    if (!p.body.length) { cont.append(el('div', { class: 'prazdno' }, el('b', {}, 'Žádné body'), 'Přidej bod ručně, importuj seznam souřadnic (TXT/CSV) nebo spočítej body ze zápisníku.')); return; }
    if (!b.length) { cont.append(el('div', { class: 'prazdno' }, 'Nic nenalezeno.')); return; }
    const tab = el('table', { class: 'tab' },
        el('thead', {}, el('tr', {}, el('th', { title: 'Označit vše / nic', onclick: () => { if (oznacene.size) oznacene.clear(); else b.forEach((x) => oznacene.add(x.cislo)); vykresli(); } }, oznacene.size ? '☑' : '☐'), el('th', { onclick: () => setRazeni('cislo') }, 'Číslo'), el('th', { class: 'num' }, 'Y'), el('th', { class: 'num' }, 'X'), el('th', { class: 'num' }, 'Z'), el('th', { onclick: () => setRazeni('kod') }, 'Kód'), el('th', { title: 'Kód kvality' }, 'Kv.'), el('th', {}, ''))));
    const tb = el('tbody');
    b.forEach((bod) => {
        const tr = el('tr', { class: bod.cislo === vybrany ? 'vybrany' : '', onclick: () => { vybrany = bod.cislo; tb.querySelectorAll('tr').forEach((r) => r.classList.toggle('vybrany', r === tr)); Mapa.zvyrazni(bod.cislo); } });
        tr.append(
            el('td', { class: 'akce' }, el('input', { type: 'checkbox', checked: oznacene.has(bod.cislo), 'aria-label': 'označit', onclick: (e) => { e.stopPropagation(); if (e.target.checked) oznacene.add(bod.cislo); else oznacene.delete(bod.cislo); } })),
            el('td', { class: 'cislo' }, bod.zamek ? el('span', { title: 'Zamčený bod', style: 'margin-right:4px' }, '🔒') : null, bunka(bod, 'cislo', bod.cislo, false)),
            el('td', { class: 'num' }, bunka(bod, 'y', fmt(bod.y), true)),
            el('td', { class: 'num' }, bunka(bod, 'x', fmt(bod.x), true)),
            el('td', { class: 'num' }, bunka(bod, 'z', fmt(bod.z), true)),
            el('td', {}, bunka(bod, 'kod', bod.kod || '', false)),
            el('td', { class: 'mono tlum' }, bod.kvalita || ''),
            el('td', { class: 'akce' }, el('button', { class: 'ikona', title: 'Karta bodu (' + (bod.zdroj === 'vypocet' ? 'z výpočtu' : bod.zdroj === 'import' ? 'z importu' : 'ručně') + ')', onclick: (e) => { e.stopPropagation(); SN.kartaBodu(bod); } }, '⋯')),
        );
        tb.append(tr);
    });
    tab.append(tb); cont.append(tab);
}
function setRazeni(r) { razeni = r; pamet.set('body-razeni', r); vykresli(); }

function bunka(bod, klic, hodnota, numericky) {
    const inp = el('input', { type: 'text', value: hodnota, class: numericky ? 'num' : '', inputmode: numericky ? 'decimal' : 'text', 'aria-label': klic }); inp.setAttribute('value', hodnota);
    inp.addEventListener('click', (e) => e.stopPropagation());
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { inp.blur(); } if (e.key === 'Escape') { inp.value = hodnota; inp.blur(); } });
    if (bod.zamek) inp.readOnly = true;
    inp.addEventListener('change', () => {
        const v = inp.value.trim();
        if (klic === 'cislo') {
            if (!v) { inp.value = hodnota; return; }
            if (v !== bod.cislo && Projekt.bod(v)) { toast('Bod ' + v + ' už existuje', 'bad'); inp.value = hodnota; return; }
            bod.cislo = v;
        } else if (numericky) {
            const n = cislo(v); if (v && n == null) { toast('Neplatné číslo', 'bad'); inp.value = hodnota; return; }
            bod[klic] = n;
        } else bod[klic] = v;
        bod.zdroj = bod.zdroj === 'vypocet' ? 'upraveno' : bod.zdroj;
        Projekt.zmena('body');
    });
    return inp;
}

async function pridatBod() {
    const p = Projekt.get();
    const f = {
        cislo: el('input', { type: 'text', value: Projekt.volneCislo(1), id: 'nb-c' }),
        y: el('input', { type: 'text', inputmode: 'decimal', class: 'num', id: 'nb-y' }), x: el('input', { type: 'text', inputmode: 'decimal', class: 'num', id: 'nb-x' }),
        z: el('input', { type: 'text', inputmode: 'decimal', class: 'num', id: 'nb-z' }), kod: el('input', { type: 'text', id: 'nb-k' }),
    };
    const obsah = el('div', { class: 'radek' }, el('label', { class: 'pole' }, el('span', {}, 'Číslo'), f.cislo), el('label', { class: 'pole' }, el('span', {}, 'Y [m]'), f.y), el('label', { class: 'pole' }, el('span', {}, 'X [m]'), f.x), el('label', { class: 'pole' }, el('span', {}, 'Z [m]'), f.z), el('label', { class: 'pole' }, el('span', {}, 'Kód'), f.kod));
    const r = await dialog({ titulek: 'Nový bod', obsah, tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Přidat', hodnota: true, class: 'hlavni', pred: () => { if (!f.cislo.value.trim() || cislo(f.y.value) == null || cislo(f.x.value) == null) { toast('Vyplň číslo, Y a X', 'bad'); return false; } if (Projekt.bod(f.cislo.value.trim())) { toast('Bod už existuje', 'bad'); return false; } } }] });
    if (!r) return;
    Projekt.ulozBod({ cislo: f.cislo.value.trim(), y: cislo(f.y.value), x: cislo(f.x.value), z: cislo(f.z.value), kod: f.kod.value.trim(), zdroj: 'rucne' });
    Projekt.zmena('body'); toast('Bod ' + f.cislo.value.trim() + ' přidán', 'ok');
}

async function importovat() {
    const file = await otevriSoubor(''); if (!file) return; // bez filtru přípon (.crd, .txt, .xyz, .dat, cokoli)
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'dbf' || ext === 'xlsx' || ext === 'xml') { // binární a strukturované formáty
        let body = [];
        try { if (ext === 'dbf') body = F_.importDBF(await file.arrayBuffer()); else if (ext === 'xml') body = F_.importXML(await ctiText(file)); else { const radky = await F_.importXLSX(await file.arrayBuffer()); const hl = radky[0] || []; const idx = (n) => hl.findIndex((h) => String(h).toLowerCase().replace(/[^a-z]/g, '') === n); let iC = idx('cislo'), iY = idx('y'), iX = idx('x'), iZ = idx('z'), iK = idx('kod'); const start = iC >= 0 ? 1 : 0; if (iC < 0) { iC = 0; iY = 1; iX = 2; iZ = 3; iK = 5; } radky.slice(start).forEach((r) => { const y = cislo(r[iY]), x = cislo(r[iX]); if (y != null && x != null && r[iC] != null && r[iC] !== '') body.push({ cislo: String(r[iC]), y, x, z: iZ >= 0 ? cislo(r[iZ]) : null, kod: iK >= 0 ? String(r[iK] ?? '') : '' }); }); } }
        catch (e) { toast('Soubor nejde přečíst: ' + e.message, 'bad'); return; }
        let n = 0; body.forEach((b) => { if (Projekt.ulozBod({ ...b, zdroj: 'import' }, false).pridano) n++; }); Projekt.zmena('body'); toast(`Import ${file.name}: ${n} nových bodů`, 'ok'); return;
    }
    const text = await ctiText(file);
    const radky = text.split(/\r?\n/).filter((r) => r.trim());
    const sel = el('select', { id: 'imp-poradi' }); Object.entries(PORADI).forEach(([k, v]) => sel.append(el('option', { value: k }, v))); sel.append(el('option', { value: 'uziv' }, 'Uživatelský formát (předpis řádku)')); sel.append(el('option', { value: 'bezcisel' }, 'Bez čísel bodů: −Y −X Z (očíslovat od 1)')); sel.append(el('option', { value: 'dvoji' }, 'Dvojí souřadnice: číslo Y X Z Y2 X2 Z2 [kvalita] [kód]'));
    sel.value = odhadniPoradi(radky);
    const predpis = el('input', { type: 'text', id: 'imp-predpis', value: PREDPISY_SOURADNICE[0][0], list: 'dl-predpisy-s' }); const dlp = el('datalist', { id: 'dl-predpisy-s' }, PREDPISY_SOURADNICE.map(([v, t]) => el('option', { value: v }, t))); const pevny = el('input', { type: 'checkbox', id: 'imp-pevny' });
    const ctiVse = () => sel.value === 'bezcisel' ? { body: F_.importBezCisel(text, +Projekt.volneCislo(1)), chyby: [] } : sel.value === 'dvoji' ? { body: F_.importDvoji(text), chyby: [] } : sel.value === 'uziv' ? { body: importPodleFormatu(predpis.value, text, pevny.checked).map((v) => ({ cislo: String(v.NUM ?? v.N), y: v.Y, x: v.X, z: v.Z ?? null, kod: v.CODE || '', kvalita: v.PREC || null })).filter((b) => b.y != null && b.x != null), chyby: [] } : ctiSeznam(text, sel.value);
    const prep = el('select', { id: 'imp-prepsat' }, el('option', { value: 'preskocit' }, 'existující body přeskočit'), el('option', { value: 'prepsat' }, 'existující body přepsat'));
    const nahled = el('pre', { class: 'protokol', style: 'max-height:160px;overflow:auto;background:var(--paper2);border-radius:6px' }, radky.slice(0, 8).join('\n'));
    const info = el('div', { class: 'tlum' });
    const aktualizuj = () => { const r = ctiVse(); info.textContent = `${r.body.length} bodů, ${r.chyby.length} řádků nejde přečíst`; };
    sel.onchange = aktualizuj; predpis.onchange = aktualizuj; pevny.onchange = aktualizuj; aktualizuj();
    const ok = await dialog({ titulek: 'Import seznamu souřadnic — ' + file.name, obsah: el('div', { style: 'display:grid;gap:10px' }, el('label', { class: 'pole' }, el('span', {}, 'Pořadí sloupců'), sel), el('div', { class: 'radek', style: 'margin:0;align-items:end' }, el('label', { class: 'pole' }, el('span', {}, 'Předpis řádku (uživatelský formát)'), predpis), el('label', { style: 'font-size:13px;padding-bottom:8px' }, pevny, ' pevný formát')), dlp, el('label', { class: 'pole' }, el('span', {}, 'Když bod už existuje'), prep), nahled, info), tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Importovat', hodnota: true, class: 'hlavni' }] });
    if (!ok) return;
    const r = ctiVse();
    let pridano = 0, prepsano = 0, preskoceno = 0;
    r.body.forEach((b) => { const v = Projekt.ulozBod({ ...b, zdroj: 'import' }, prep.value === 'prepsat'); if (v.pridano) pridano++; else if (v.prepsano) prepsano++; else preskoceno++; });
    Projekt.zmena('body');
    toast(`Import: ${pridano} nových, ${prepsano} přepsáno, ${preskoceno} přeskočeno` + (r.chyby.length ? `, ${r.chyby.length} chybných řádků` : ''), r.chyby.length ? 'bad' : 'ok');
}

async function exportovat() {
    const p = Projekt.get(); if (!p.body.length) { toast('Není co exportovat'); return; }
    const fmtSel = el('select', { id: 'exp-format' }, el('option', { value: 'txt' }, 'TXT — mezery, desetinná tečka (Groma, totálky)'), el('option', { value: 'csv' }, 'CSV — středník, desetinná čárka (Excel)'), el('option', { value: 'dxf' }, 'DXF — body, čísla a kódy po hladinách (CAD)'), el('option', { value: 'kml' }, 'KML — Google Earth / Mapy (WGS84)'), el('option', { value: 'geojson' }, 'GeoJSON — GIS (WGS84)'), el('option', { value: 'uziv' }, 'Uživatelský formát (předpis řádku)'),
        el('option', { value: 'katastr' }, 'Souřadnice pro katastr (úplné číslo, Y X Z na cm, kód kvality)'), el('option', { value: 'yxz' }, 'Souřadnice YXZ (text)'), el('option', { value: 'xyz' }, 'Souřadnice XYZ (text)'), el('option', { value: 'csv-yxz' }, 'CSV YXZ (čárka)'),
        el('option', { value: 'xlsx' }, 'Excel .xlsx'), el('option', { value: 'xml' }, 'XML'), el('option', { value: 'kokes' }, 'KOKEŠ .stx'), el('option', { value: 'dbf' }, 'dBASE III .dbf (struktura Groma)'),
        el('option', { value: 'gsi16' }, 'Leica GSI16 (do přístroje)'), el('option', { value: 'gsi8' }, 'Leica GSI8'), el('option', { value: 'sdr' }, 'Sokkia SDR33'), el('option', { value: 'topcon' }, 'Topcon (číslo,N,E,Z,kód)'), el('option', { value: 'geodimeter' }, 'Geodimeter Area'));
    const predpisE = el('input', { type: 'text', id: 'exp-predpis', value: PREDPISY_SOURADNICE[1][0], list: 'dl-predpisy-e' }); const dle = el('datalist', { id: 'dl-predpisy-e' }, PREDPISY_SOURADNICE.map(([v, t]) => el('option', { value: v }, t)));
    const sel = el('select', { id: 'exp-poradi' }); Object.entries(PORADI).forEach(([k, v]) => sel.append(el('option', { value: k }, v)));
    const jen = el('input', { type: 'checkbox', id: 'exp-jen' });
    const ok = await dialog({ titulek: 'Export seznamu souřadnic', obsah: el('div', { style: 'display:grid;gap:10px' }, el('label', { class: 'pole' }, el('span', {}, 'Formát'), fmtSel), el('label', { class: 'pole' }, el('span', {}, 'Pořadí sloupců'), sel), el('label', { class: 'pole' }, el('span', {}, 'Předpis řádku (uživatelský formát)'), predpisE), dle, hledat ? el('label', {}, jen, ' jen vyfiltrované (' + serazene().length + ')') : null), tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Uložit', hodnota: true, class: 'hlavni' }] });
    if (!ok) return;
    const body = jen.checked ? serazene() : p.body;
    const nazev = (p.nazev || 'body').replace(/[^\w\-]+/g, '_');
    const F = fmtSel.value;
    if (F === 'dxf') return ulozSoubor(nazev + '.dxf', dxf(body), 'application/dxf');
    if (F === 'kml') return ulozSoubor(nazev + '.kml', kml(body, p.nazev), 'application/vnd.google-earth.kml+xml');
    if (F === 'geojson') return ulozSoubor(nazev + '.geojson', geojson(body), 'application/geo+json');
    if (F === 'uziv') return ulozSoubor(nazev + '.txt', exportPodleFormatu(predpisE.value, body.map((b, i) => polozkyBodu(b, i))));
    const M = { katastr: () => [nazev + '-katastr.txt', F_.exportKatastr(body)], yxz: () => [nazev + '-yxz.txt', F_.exportXYZ(body, 'yxz')], xyz: () => [nazev + '-xyz.txt', F_.exportXYZ(body, 'xyz')], 'csv-yxz': () => [nazev + '.csv', F_.exportXYZ(body, 'yxz', true), 'text/csv'],
        xml: () => [nazev + '.xml', F_.exportXML(body, p.nazev), 'application/xml'], kokes: () => [nazev + '.stx', F_.exportKokes(body)], gsi16: () => [nazev + '.gsi', F_.exportGSI(body, true)], gsi8: () => [nazev + '-8.gsi', F_.exportGSI(body, false)], sdr: () => [nazev + '.sdr', F_.exportSDR(body)], topcon: () => [nazev + '-topcon.txt', F_.exportTopcon(body)], geodimeter: () => [nazev + '.are', F_.exportGeodimeter(body)],
        dbf: () => [nazev + '.dbf', new Blob([F_.exportDBF(body)], { type: 'application/octet-stream' })], xlsx: () => [nazev + '.xlsx', new Blob([F_.exportXLSX([{ list: 'Souřadnice', hlavicka: ['Číslo', 'Y', 'X', 'Z', 'Kód kvality', 'Kód', 'Typ', 'Poznámka'], radky: body.map((b) => [b.cislo, b.y, b.x, b.z, b.kvalita || '', b.kod || '', b.typ || '', b.pozn || '']) }])], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })] };
    if (M[F]) { const [nm, obsah, typ] = M[F](); return ulozSoubor(nm, obsah, typ || 'text/plain'); }
    await ulozSoubor(nazev + '.' + F, zapisSeznam(body, F, sel.value), F === 'csv' ? 'text/csv' : 'text/plain');
}

async function dalsi() {
    const p = Projekt.get(); const vyb = p.body.filter((b) => oznacene.has(b.cislo));
    const B = (text, fn, cls = '') => el('button', { class: 'btn ' + cls, style: 'justify-content:flex-start', onclick: async () => { zavri(); await fn(); } }, text);
    let zavri = () => { const ov = $('.dlg-overlay'); if (ov) ov.remove(); };
    const obsah = el('div', { style: 'display:grid;gap:14px' },
        el('div', { class: 'tlum', style: 'font-size:13px' }, `${p.body.length} bodů v seznamu${vyb.length ? `, ${vyb.length} označených — hromadné úpravy se použijí jen na ně` : ' — hromadné úpravy na všechny (označit lze zaškrtnutím v tabulce)'}`),
        el('div', { class: 'skupina', style: 'padding:0' }, 'Úpravy'), el('div', { style: 'display:grid;gap:6px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))' },
            B('Hromadná změna…', () => SN.hromadnaZmena(vyb)), B('Přečíslování…', () => SN.precislovani(vyb)), B('Překódování podle tabulky…', () => SN.prekodovani(vyb.length ? vyb : null)), B('Kódovací tabulka…', () => SN.kodovaciTabulka())),
        el('div', { class: 'skupina', style: 'padding:0' }, 'Kontroly'), el('div', { style: 'display:grid;gap:6px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))' },
            B('Porovnání s jiným seznamem…', () => SN.porovnaniSeznamu()), B('Kontrola číslování', () => SN.kontrolaCislovani()), B('Duplicity polohy (do 5 cm)', () => duplicity()), B('Odstranění identických bodů…', () => SN.identickeBody()), B('Dávkové průměrování (_1, _2…)', () => SN.prumerovani()), B('Koš — obnova smazaných', () => SN.kos())),
        el('div', { class: 'skupina', style: 'padding:0' }, 'Souřadnice'), el('div', { style: 'display:grid;gap:6px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))' },
            B('Dvojí souřadnice…', () => SN.dvojiSouradnice()), B('Zeměpisné souřadnice (WGS84)', () => SN.zemepisne()), B('Mapové listy SM5', () => SN.mapoveListy()), B('Zaokrouhlit na mm / cm…', () => zaokrouhlit()), B('Tisk sestavy…', () => tiskSeznamu('body', vyb)), B('Poslat do AR Geodetu (DXF)', () => doAR()), B('Smazat vše', () => smazatVse(), 'nebezpecny')),
    );
    await dialog({ titulek: 'Seznam souřadnic', obsah, sirka: 760 });
    async function duplicity() {
        const dup = []; const b = p.body;
        for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) if (b[i].y != null && b[j].y != null && Math.hypot(b[i].y - b[j].y, b[i].x - b[j].x) < 0.05) dup.push([b[i].cislo, b[j].cislo, Math.hypot(b[i].y - b[j].y, b[i].x - b[j].x)]);
        await dialog({ titulek: 'Duplicity (do 5 cm)', obsah: dup.length ? el('table', { class: 'tab bez-nastroju' }, el('tbody', {}, dup.map((d) => el('tr', {}, el('td', { class: 'cislo' }, d[0]), el('td', { class: 'cislo' }, d[1]), el('td', { class: 'num' }, fmt(d[2]) + ' m'))))) : el('p', {}, 'Žádné dva body nejsou blíž než 5 cm.') });
    }
    async function zaokrouhlit() {
        const r = await dialog({ titulek: 'Zaokrouhlení souřadnic', obsah: el('p', {}, 'Zaokrouhlit Y, X, Z ' + (vyb.length ? 'označených bodů' : 'všech bodů') + ' na:'), tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'mm (3 místa)', hodnota: 3 }, { text: 'cm (2 místa)', hodnota: 2 }, { text: 'dm (1 místo)', hodnota: 1 }] });
        if (!r) return; const k = Math.pow(10, r); (vyb.length ? vyb : p.body).forEach((b) => { if (b.zamek) return; ['y', 'x', 'z'].forEach((f) => { if (b[f] != null) b[f] = Math.round(b[f] * k) / k; }); }); Projekt.zmena('body'); toast('Zaokrouhleno', 'ok');
    }
    async function doAR() {
        const body = vyb.length ? vyb : (hledat ? serazene() : p.body);
        await ulozSoubor((p.nazev || 'body').replace(/[^\w\-]+/g, '_') + '-vytyceni.dxf', dxf(body), 'application/dxf');
        await dialog({ titulek: 'Poslat do AR Geodetu', obsah: el('div', { style: 'display:grid;gap:8px;font-size:13.5px' }, el('p', { style: 'margin:0' }, `Uložen DXF s ${body.length} body v S-JTSK. V AR Geodetu (QTRIG) na telefonu: Nástroje → Import projektu → vyber tento DXF. Živě přes účet: tlačítko Účet nahoře.`)) });
    }
    async function smazatVse() { if (await potvrd(`Smazat všech ${p.body.length} bodů? (zamčené zůstanou, ostatní jdou obnovit z koše)`)) { p.body.slice().forEach((b) => Projekt.smazBod(b.cislo)); Projekt.zmena('body'); } }
}
