// Nástroje seznamu souřadnic podle Gromy (kap. Seznam souřadnic, Přečíslování, Hromadné změny,
// Kódování bodů): karta bodu, hromadná změna s výrazy, přečíslování (předčíslí, maska, podle seznamu),
// kontroly (porovnání seznamů, číslování, identické body, průměrování, koš), dvojí souřadnice,
// zeměpisné souřadnice, mapové listy SM5, kódovací tabulka.
import { Projekt } from './projekt.js';
import { el, $, fmt, cislo, toast, dialog, potvrd, ulozSoubor, otevriSoubor, ctiText, datumCas } from './ui.js';
import { ctiSeznam, zapisSeznam, odhadniPoradi, PORADI } from './soubory.js';
import { jtskToWgs } from '../geo/krovak.js';
import { kriteria, posudDvojiUrceni, vyberovaChyba } from '../geo/presnost.js';
import { Protokol } from './protokol.js';

const KVALITY = ['', '3', '4', '5', '6', '7', '8'];
const TYPY = ['', 'podrobný', 'PPBP', 'ZhB', 'trigonometrický', 'nivelační', 'pomocný', 'vytyčovací'];
const PUVODY = ['', 'měřeno', 'vypočteno', 'digitalizace', 'ISKN', 'GNSS', 'převzato'];

/** Rozklad úplného čísla bodu na předčíslí (k. ú. 6 + ZPMZ 5) a vlastní číslo (4) */
export function rozlozCislo(c) {
    const s = String(c);
    if (/^\d{15}$/.test(s)) return { ku: s.slice(0, 6), zpmz: s.slice(6, 11), n: s.slice(11), predcisli: s.slice(0, 11), cislo: String(+s.slice(11)) };
    if (/^\d{9,14}$/.test(s)) return { ku: '', zpmz: '', n: s, predcisli: '', cislo: s };
    return { ku: '', zpmz: '', n: s, predcisli: '', cislo: s };
}
export function slozCislo(predcisli, n) {
    const pre = String(predcisli || '').replace(/[^\d]/g, ''); const c = String(n).trim();
    if (!pre || !/^\d+$/.test(c)) return c;
    if (c.length >= 9) return c.padStart(15, '0');
    return (pre + c.padStart(15 - pre.length, '0')).slice(-15);
}

// ---------------- karta bodu ----------------
export async function kartaBodu(bod) {
    const p = Projekt.get();
    const f = (k, v, num = false, extra = {}) => el('input', { type: 'text', value: v ?? '', class: num ? 'num' : '', inputmode: num ? 'decimal' : 'text', id: 'kb-' + k, ...extra });
    const sel = (k, v, list) => el('select', { id: 'kb-' + k }, list.map((x) => el('option', { value: x, selected: x === String(v ?? '') }, x || '—')));
    const I = { cislo: f('cislo', bod.cislo), y: f('y', fmt(bod.y), true), x: f('x', fmt(bod.x), true), z: f('z', fmt(bod.z), true), kod: f('kod', bod.kod), pozn: f('pozn', bod.pozn),
        kvalita: sel('kvalita', bod.kvalita, KVALITY), typ: sel('typ', bod.typ, TYPY), puvod: sel('puvod', bod.puvod, PUVODY), zamek: el('input', { type: 'checkbox', id: 'kb-zamek', checked: !!bod.zamek }),
        y2: f('y2', fmt(bod.y2), true), x2: f('x2', fmt(bod.x2), true) };
    const w = bod.y != null && bod.x != null ? jtskToWgs(bod.y, bod.x, bod.z ?? 250) : null;
    const r = rozlozCislo(bod.cislo);
    const obsah = el('div', { style: 'display:grid;gap:10px' },
        el('div', { class: 'radek' }, pole('Číslo bodu', I.cislo), pole('Kód', I.kod), pole('Kód kvality', I.kvalita)),
        r.predcisli ? el('div', { class: 'tlum mono', style: 'font-size:12.5px' }, `k. ú. ${r.ku} · ZPMZ ${+r.zpmz} · bod ${r.cislo}`) : null,
        el('div', { class: 'radek' }, pole('Y [m]', I.y), pole('X [m]', I.x), pole('Z [m]', I.z)),
        el('div', { class: 'radek' }, pole('Vedlejší Y2', I.y2), pole('Vedlejší X2', I.x2), pole('Typ bodu', I.typ), pole('Původ', I.puvod)),
        el('div', { class: 'radek' }, pole('Poznámka', I.pozn), el('label', { style: 'display:flex;gap:8px;align-items:center;padding-top:18px' }, I.zamek, ' zamknout proti přepsání a smazání')),
        el('div', { class: 'tlum', style: 'font-size:12.5px' }, `Původ: ${bod.zdroj || '—'} · vytvořeno ${bod.vytvoreno ? datumCas(bod.vytvoreno) : '—'} · změněno ${bod.zmeneno ? datumCas(bod.zmeneno) : '—'}${w ? ` · WGS84 ${w.lat.toFixed(7)}° N, ${w.lng.toFixed(7)}° E` : ''}`),
    );
    const ok = await dialog({ titulek: 'Bod ' + bod.cislo, obsah, sirka: 640, tlacitka: [{ text: 'Smazat', hodnota: 'smazat', class: 'nebezpecny' }, { text: 'Zrušit', hodnota: null }, { text: 'Uložit', hodnota: true, class: 'hlavni' }] });
    if (ok === 'smazat') { if (bod.zamek) { toast('Bod je zamčený', 'bad'); return; } if (await potvrd('Smazat bod ' + bod.cislo + '? (jde obnovit z koše)')) { Projekt.smazBod(bod.cislo); Projekt.zmena('body'); } return; }
    if (!ok) return;
    const nc = I.cislo.value.trim(); if (nc !== bod.cislo && Projekt.bod(nc)) { toast('Bod ' + nc + ' už existuje', 'bad'); return; }
    Object.assign(bod, { cislo: nc, y: cislo(I.y.value), x: cislo(I.x.value), z: cislo(I.z.value), kod: I.kod.value.trim(), pozn: I.pozn.value.trim(), kvalita: I.kvalita.value || null, typ: I.typ.value, puvod: I.puvod.value, zamek: I.zamek.checked, y2: cislo(I.y2.value), x2: cislo(I.x2.value), zmeneno: new Date().toISOString() });
    Projekt.zmena('body');
}
const pole = (t, i) => el('label', { class: 'pole' }, el('span', {}, t), i);

// ---------------- výrazy pro hromadné změny ----------------
/** Vyhodnotí výraz Groma (proměnné P, N, NUMBER, CODE, X, Y, Z, PREC, TYPE, PI, RO, funkce sin cos tan sqrt abs round int) */
export function vyhodnot(vyraz, bod, extra = {}) {
    const r = rozlozCislo(bod.cislo);
    const prom = { P: r.predcisli ? +r.predcisli : 0, N: +r.cislo || 0, NUMBER: /^\d+$/.test(bod.cislo) ? +bod.cislo : bod.cislo, CODE: bod.kod || '', NOTE: bod.pozn || '', FSU: +r.ku || 0, ZPMZ: +r.zpmz || 0,
        X: bod.x ?? 0, Y: bod.y ?? 0, Z: bod.z ?? 0, X2: bod.x2 ?? 0, Y2: bod.y2 ?? 0, PREC: +bod.kvalita || 0, TYPE: bod.typ || '', ORIGIN: bod.puvod || '', PI: Math.PI, RO: 200 / Math.PI, ...extra };
    const fn = { sin: Math.sin, cos: Math.cos, tan: Math.tan, sqrt: Math.sqrt, abs: Math.abs, round: Math.round, int: Math.trunc, floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max, len: (s) => String(s).length, str: (v) => String(v), num: (v) => +v || 0 };
    const src = String(vyraz).trim(); if (!src) return null;
    if (!/^[\w\s+\-*/%().,'"<>=!&|?:]*$/.test(src)) throw new Error('Nepovolené znaky ve výrazu');
    const names = [...Object.keys(prom), ...Object.keys(fn)];
    const bezRetezcu = src.replace(/'[^']*'|"[^"]*"/g, '');
    for (const id of bezRetezcu.match(/[A-Za-z_]\w*/g) || []) if (!names.includes(id)) throw new Error('Neznámá proměnná nebo funkce: ' + id);
    const f = new Function(...names, '"use strict"; return (' + src + ');');
    return f(...Object.keys(prom).map((k) => prom[k]), ...Object.keys(fn).map((k) => fn[k]));
}

// ---------------- hromadná změna ----------------
export async function hromadnaZmena(vyber) {
    const p = Projekt.get(); const body = vyber && vyber.length ? vyber : p.body;
    const polozky = [['cislo', 'Číslo bodu', ['nastavit']], ['y', 'Y', ['nastavit', 'pricist', 'vynasobit', 'odstranit']], ['x', 'X', ['nastavit', 'pricist', 'vynasobit', 'odstranit']], ['z', 'Z', ['nastavit', 'pricist', 'vynasobit', 'odstranit']], ['kod', 'Kód', ['nastavit', 'odstranit']], ['pozn', 'Poznámka', ['nastavit', 'odstranit']], ['kvalita', 'Kód kvality', ['nastavit', 'odstranit']], ['typ', 'Typ bodu', ['nastavit']], ['puvod', 'Původ', ['nastavit']], ['zamek', 'Zámek (1/0)', ['nastavit']]];
    const radky = polozky.map(([k, t, ops]) => { const z = el('input', { type: 'checkbox', id: 'hz-z-' + k }); const v = el('input', { type: 'text', id: 'hz-v-' + k, placeholder: 'hodnota nebo výraz (Y+10, N+1000, CODE…)' }); const o = el('select', { id: 'hz-o-' + k }, ops.map((x) => el('option', { value: x }, { nastavit: 'nastavit', pricist: 'přičíst', vynasobit: 'vynásobit', odstranit: 'odstranit' }[x]))); return { k, z, v, o, tr: el('tr', {}, el('td', {}, z), el('td', {}, t), el('td', {}, v), el('td', {}, o)) }; });
    const ok = await dialog({ titulek: `Hromadná změna (${body.length} bodů)`, sirka: 720, obsah: el('div', { style: 'display:grid;gap:8px' }, el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Změnit'), el('th', {}, 'Údaj'), el('th', {}, 'Hodnota / výraz'), el('th', {}, 'Typ změny'))), el('tbody', {}, radky.map((r) => r.tr))),
        el('p', { class: 'tlum', style: 'margin:0;font-size:12.5px' }, 'Proměnné jako v Gromě: P (předčíslí), N (číslo bodu), NUMBER, CODE, NOTE, FSU, ZPMZ, X, Y, Z, X2, Y2, PREC, TYPE, ORIGIN, PI, RO. Funkce sin, cos, tan, sqrt, abs, round, int. Příklad: Y → přičíst 0.05; kód → nastavit "PLOT"; číslo → nastavit N+1000.')),
        tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Provést', hodnota: true, class: 'hlavni' }] });
    if (!ok) return;
    let n = 0, chyb = 0; const obs = new Set(p.body.map((b) => b.cislo));
    for (const b of body) {
        if (b.zamek) continue; let zm = false;
        for (const r of radky) {
            if (!r.z.checked) continue; const op = r.o.value;
            try {
                if (op === 'odstranit') { b[r.k] = r.k === 'kod' || r.k === 'pozn' ? '' : null; zm = true; continue; }
                let v = vyhodnot(r.v.value, b);
                if (r.k === 'cislo') { const nc = String(v); if (nc !== b.cislo && obs.has(nc)) { chyb++; continue; } obs.delete(b.cislo); obs.add(nc); b.cislo = nc; zm = true; continue; }
                if (r.k === 'zamek') { b.zamek = !!(+v); zm = true; continue; }
                if (['y', 'x', 'z'].includes(r.k)) { v = +v; if (!isFinite(v)) { chyb++; continue; } b[r.k] = op === 'pricist' ? (b[r.k] ?? 0) + v : op === 'vynasobit' ? (b[r.k] ?? 0) * v : v; }
                else b[r.k] = v == null ? '' : String(v);
                zm = true;
            } catch (e) { chyb++; }
        }
        if (zm) { n++; b.zmeneno = new Date().toISOString(); }
    }
    Projekt.zmena('body'); toast(`Změněno ${n} bodů` + (chyb ? `, ${chyb} chyb (výraz / kolize čísel)` : ''), chyb ? 'bad' : 'ok');
}

// ---------------- přečíslování ----------------
export async function precislovani(vyber) {
    const p = Projekt.get(); const body = vyber && vyber.length ? vyber : p.body;
    const pre = el('input', { type: 'text', id: 'pc-pre', value: p.predcisli || '', placeholder: 'k. ú. + ZPMZ, např. 61084400014' });
    const maska = el('input', { type: 'text', id: 'pc-maska', placeholder: '?????? = ponechat, číslice = nahradit (např. ??????00014)' });
    const od = el('input', { type: 'text', id: 'pc-od', placeholder: 'např. 1' }), krok = el('input', { type: 'text', id: 'pc-krok', value: '1' });
    const ulozSeznam = el('input', { type: 'checkbox', id: 'pc-ulozit', checked: true });
    const rezim = el('select', { id: 'pc-rezim' }, [['doplnit', 'Doplnit úplná čísla bodů (předčíslí zleva)'], ['oriznout', 'Oříznout předčíslí (nechat jen číslo bodu)'], ['zmenit', 'Změnit předčíslí na konstantní'], ['maska', 'Změnit předčíslí maskou'], ['rada', 'Nová číselná řada (od, krok; v pořadí seznamu)'], ['podle', 'Podle seznamu přiřazení (soubor staré=nové)']].map(([v, t]) => el('option', { value: v }, t)));
    const ok = await dialog({ titulek: `Přečíslování (${body.length} bodů)`, sirka: 640, obsah: el('div', { style: 'display:grid;gap:10px' }, pole('Způsob', rezim), el('div', { class: 'radek' }, pole('Předčíslí', pre), pole('Maska', maska)), el('div', { class: 'radek' }, pole('Nová řada od', od), pole('Krok', krok)), el('label', {}, ulozSeznam, ' po přečíslování nabídnout seznam přiřazení (staré = nové) k uložení'),
        el('p', { class: 'tlum', style: 'margin:0;font-size:12.5px' }, 'Úplné číslo = k. ú. (6) + ZPMZ (5) + číslo bodu (4). Body se stejným novým číslem se nepřečíslují (kolize).')),
        tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Přečíslovat', hodnota: true, class: 'hlavni' }] });
    if (!ok) return;
    let mapa = null;
    if (rezim.value === 'podle') { const f = await otevriSoubor(''); if (!f) return; mapa = new Map(); (await ctiText(f)).split(/\r?\n/).forEach((l) => { const m = l.trim().split(/[\s=;,]+/); if (m.length >= 2) mapa.set(m[0], m[1]); }); }
    if (pre.value.trim()) { p.predcisli = pre.value.trim(); }
    const prir = []; const obs = new Set(p.body.map((b) => b.cislo)); let i = 0, kolize = 0;
    const start = +od.value || 1, kr = +krok.value || 1;
    for (const b of body) {
        if (b.zamek) continue;
        const r = rozlozCislo(b.cislo); let nove = b.cislo;
        if (rezim.value === 'doplnit') nove = slozCislo(pre.value, /^\d{15}$/.test(b.cislo) ? r.cislo : b.cislo);
        else if (rezim.value === 'oriznout') nove = r.predcisli && (!pre.value.trim() || r.predcisli === pre.value.trim().replace(/[^\d]/g, '')) ? r.cislo : b.cislo;
        else if (rezim.value === 'zmenit') nove = /^\d+$/.test(b.cislo) ? slozCislo(pre.value, r.cislo) : b.cislo;
        else if (rezim.value === 'maska') { const m = maska.value.trim().replace(/#/g, '?'); if (/^\d{15}$/.test(b.cislo) && m.length === 11) nove = [...m].map((ch, k) => ch === '?' ? b.cislo[k] : ch).join('') + b.cislo.slice(11); }
        else if (rezim.value === 'rada') { nove = r.predcisli ? slozCislo(r.predcisli, String(start + i * kr)) : String(start + i * kr); i++; }
        else if (rezim.value === 'podle') { if (mapa.has(b.cislo)) nove = mapa.get(b.cislo); else if (mapa.has(r.cislo)) nove = r.predcisli ? slozCislo(r.predcisli, mapa.get(r.cislo)) : mapa.get(r.cislo); }
        if (nove === b.cislo) continue;
        if (obs.has(nove)) { kolize++; continue; }
        obs.delete(b.cislo); obs.add(nove); prir.push([b.cislo, nove]); b.cislo = nove; b.zmeneno = new Date().toISOString();
    }
    // přečíslovat i zápisník
    const m2 = new Map(prir); p.zapisnik.forEach((s) => { if (m2.has(s.stanovisko)) s.stanovisko = m2.get(s.stanovisko); s.radky.forEach((r) => { if (m2.has(r.cislo)) r.cislo = m2.get(r.cislo); }); });
    Projekt.zmena('body'); Projekt.zmena('zapisnik');
    Protokol.pridej('Přečíslování', `${rezim.selectedOptions[0].textContent}\n` + prir.map(([a, b]) => `${a.padEnd(16)} → ${b}`).join('\n') + (kolize ? `\n${kolize} bodů nepřečíslováno (kolize čísel)` : ''));
    toast(`Přečíslováno ${prir.length} bodů` + (kolize ? `, ${kolize} kolizí` : ''), kolize ? 'bad' : 'ok');
    if (ulozSeznam.checked && prir.length && await potvrd('Uložit seznam přiřazení čísel (staré = nové) do souboru?')) ulozSoubor('precislovani.txt', prir.map(([a, b]) => a + ' = ' + b).join('\n') + '\n');
}

// ---------------- kontroly ----------------
export async function porovnaniSeznamu() {
    const p = Projekt.get(); const f = await otevriSoubor(''); if (!f) return;
    const text = await ctiText(f); const r = ctiSeznam(text, odhadniPoradi(text.split(/\r?\n/)));
    const kod = p.kodKvality, kr = kriteria(kod); const dvoj = [];
    r.body.forEach((b) => { const a = Projekt.bod(b.cislo); if (a && a.y != null) dvoj.push({ cislo: b.cislo, a, b, ...posudDvojiUrceni(a, b, kod) }); });
    if (!dvoj.length) { toast('Žádná společná čísla bodů', 'bad'); return; }
    const vyb = vyberovaChyba(dvoj, kod);
    const prekr = dvoj.filter((d) => d.poloha.stav === 'prekroceno');
    const prot = `porovnání s ${f.name}: ${dvoj.length} společných bodů, kód kvality ${kod}\n` + dvoj.map((d) => `${d.cislo.padEnd(16)} ΔY ${fmt(d.dy).padStart(8)} ΔX ${fmt(d.dx).padStart(8)} Δp ${fmt(d.dp).padStart(7)}  ${d.poloha.stav}`).join('\n') + `\nvýběrová střední souřadnicová chyba s_xy = ${fmt(vyb.sxy)} m (mezní ${fmt(vyb.mezni)} m, ω = ${vyb.omega}) — ${vyb.stav}\nmezní polohová odchylka u_p = ${fmt(kr.up)} m překročena u ${prekr.length} bodů`;
    Protokol.pridej('Porovnání seznamů souřadnic', prot);
    await dialog({ titulek: 'Porovnání souřadnic — ' + f.name, sirka: 720, obsah: el('div', { style: 'display:grid;gap:8px' }, el('div', {}, el('span', { class: 'sem ' + vyb.stav }, `s_xy ${fmt(vyb.sxy)} m ≤ ${fmt(vyb.mezni)} m`), ' ', el('span', { class: 'sem ' + (prekr.length ? 'prekroceno' : 'ok') }, `${prekr.length} bodů nad u_p ${fmt(kr.up)} m`)),
        el('div', { class: 'tw' }, el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Bod'), el('th', { class: 'num' }, 'ΔY'), el('th', { class: 'num' }, 'ΔX'), el('th', { class: 'num' }, 'Δp'), el('th', {}, ''))), el('tbody', {}, dvoj.map((d) => el('tr', {}, el('td', { class: 'cislo' }, d.cislo), el('td', { class: 'num' }, fmt(d.dy)), el('td', { class: 'num' }, fmt(d.dx)), el('td', { class: 'num' }, fmt(d.dp)), el('td', {}, el('span', { class: 'sem ' + d.poloha.stav }, d.poloha.stav))))))), el('p', { class: 'tlum', style: 'margin:0' }, 'Zapsáno do protokolu.')) });
}
export async function kontrolaCislovani() {
    const p = Projekt.get(); const sk = new Map();
    p.body.forEach((b) => { const r = rozlozCislo(b.cislo); if (!/^\d+$/.test(r.cislo)) return; const k = r.predcisli || '—'; if (!sk.has(k)) sk.set(k, []); sk.get(k).push(+r.cislo); });
    let prot = ''; sk.forEach((arr, k) => { arr.sort((a, b) => a - b); const mezery = []; for (let i = 1; i < arr.length; i++) if (arr[i] - arr[i - 1] > 1) mezery.push(arr[i - 1] + 1 === arr[i] - 1 ? String(arr[i - 1] + 1) : `${arr[i - 1] + 1}–${arr[i] - 1}`); prot += `předčíslí ${k}: ${arr.length} bodů, ${arr[0]}–${arr[arr.length - 1]}, mezery: ${mezery.length ? mezery.join(', ') : 'žádné'}\n`; });
    const dup = p.body.map((b) => b.cislo).filter((c, i, a) => a.indexOf(c) !== i); if (dup.length) prot += 'DUPLICITNÍ ČÍSLA: ' + [...new Set(dup)].join(', ') + '\n';
    Protokol.pridej('Kontrola číslování bodů', prot || 'seznam je prázdný');
    await dialog({ titulek: 'Kontrola číslování', obsah: el('pre', { class: 'protokol', style: 'padding:0' }, prot || 'Seznam je prázdný.') });
}
export async function identickeBody() {
    const p = Projekt.get(); const tol = cislo(await new Promise((res) => { const i = el('input', { type: 'text', value: '0,05', id: 'ib-tol', class: 'num' }); dialog({ titulek: 'Odstranění identických bodů', obsah: pole('Tolerance polohy [m]', i), tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Hledat', hodnota: true, class: 'hlavni' }] }).then((r) => res(r ? i.value : null)); }));
    if (tol == null) return;
    const b = p.body, dvojice = [];
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) if (b[i].y != null && b[j].y != null && Math.hypot(b[i].y - b[j].y, b[i].x - b[j].x) <= tol) dvojice.push([b[i], b[j], Math.hypot(b[i].y - b[j].y, b[i].x - b[j].x)]);
    if (!dvojice.length) { toast('Žádné identické body do ' + fmt(tol) + ' m'); return; }
    const tab = el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Ponechat'), el('th', {}, 'Smazat'), el('th', { class: 'num' }, 'Rozdíl [m]'), el('th', {}, ''))), el('tbody', {}, dvojice.map((d) => el('tr', {}, el('td', { class: 'cislo' }, d[0].cislo), el('td', { class: 'cislo' }, d[1].cislo), el('td', { class: 'num' }, fmt(d[2])), el('td', {}, el('input', { type: 'checkbox', checked: true, dataset: { c: d[1].cislo } }))))));
    const ok = await dialog({ titulek: `Identické body (${dvojice.length} dvojic)`, sirka: 600, obsah: el('div', { class: 'tw' }, tab), tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Smazat zaškrtnuté', hodnota: true, class: 'hlavni' }] });
    if (!ok) return;
    let n = 0; tab.querySelectorAll('input:checked').forEach((i) => { if (Projekt.smazBod(i.dataset.c)) n++; });
    Projekt.zmena('body'); Protokol.pridej('Odstranění identických bodů', dvojice.map((d) => `${d[0].cislo} ~ ${d[1].cislo}  Δ ${fmt(d[2])} m`).join('\n') + `\nsmazáno ${n}`); toast(`Smazáno ${n} bodů (jsou v koši)`, 'ok');
}
export async function prumerovani() {
    // body stejného čísla existují jen dočasně (import s příponou) — průměrujeme body, jejichž číslo se liší jen příponou _1, _2 nebo body se stejnou polohou z importu
    const p = Projekt.get(); const sk = new Map();
    p.body.forEach((b) => { const k = b.cislo.replace(/[_\-.]\d+$/, ''); if (!sk.has(k)) sk.set(k, []); sk.get(k).push(b); });
    const skupiny = [...sk.entries()].filter(([, a]) => a.length > 1);
    if (!skupiny.length) { toast('Žádné body k průměrování (stejné číslo s příponou _1, _2 …)'); return; }
    const kr = kriteria(p.kodKvality); let prot = '', n = 0;
    for (const [k, arr] of skupiny) {
        const y = arr.reduce((s, b) => s + b.y, 0) / arr.length, x = arr.reduce((s, b) => s + b.x, 0) / arr.length, zs = arr.filter((b) => b.z != null), z = zs.length ? zs.reduce((s, b) => s + b.z, 0) / zs.length : null;
        const maxd = Math.max(...arr.map((b) => Math.hypot(b.y - y, b.x - x)));
        prot += `${k}: ${arr.length} určení, průměr Y ${fmt(y)} X ${fmt(x)}${z != null ? ' Z ' + fmt(z) : ''}, max odchylka ${fmt(maxd)} m (u_p ${fmt(kr.up)}) ${maxd > kr.up ? 'PŘEKROČENO' : 'ok'}\n`;
        arr.forEach((b) => Projekt.smazBod(b.cislo));
        Projekt.ulozBod({ cislo: k, y, x, z, kod: arr[0].kod, zdroj: 'vypocet', pozn: 'průměr z ' + arr.length }); n++;
    }
    Projekt.zmena('body'); Protokol.pridej('Dávkové průměrování souřadnic', prot); toast(`Zprůměrováno ${n} bodů`, 'ok');
}
export async function kos() {
    const p = Projekt.get(); const k = p.kos || [];
    if (!k.length) { toast('Koš je prázdný'); return; }
    const tab = el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, ''), el('th', {}, 'Bod'), el('th', { class: 'num' }, 'Y'), el('th', { class: 'num' }, 'X'), el('th', {}, 'Smazáno'))), el('tbody', {}, k.slice().reverse().map((b) => el('tr', {}, el('td', {}, el('input', { type: 'checkbox', dataset: { c: b.cislo, t: b.smazano } })), el('td', { class: 'cislo' }, b.cislo), el('td', { class: 'num' }, fmt(b.y)), el('td', { class: 'num' }, fmt(b.x)), el('td', { class: 'tlum' }, datumCas(b.smazano))))));
    const ok = await dialog({ titulek: `Koš (${k.length})`, sirka: 640, obsah: el('div', { class: 'tw' }, tab), tlacitka: [{ text: 'Vysypat koš', hodnota: 'vysypat', class: 'nebezpecny' }, { text: 'Zavřít', hodnota: null }, { text: 'Obnovit zaškrtnuté', hodnota: true, class: 'hlavni' }] });
    if (ok === 'vysypat') { if (await potvrd('Vysypat koš?')) { p.kos = []; Projekt.zmena('body'); } return; }
    if (!ok) return; let n = 0;
    tab.querySelectorAll('input:checked').forEach((i) => { const idx = p.kos.findIndex((b) => b.cislo === i.dataset.c && b.smazano === i.dataset.t); if (idx < 0) return; const b = p.kos[idx]; const { smazano, ...bod } = b; if (Projekt.ulozBod(bod, false).pridano) { p.kos.splice(idx, 1); n++; } });
    Projekt.zmena('body'); toast(`Obnoveno ${n} bodů` + (n < tab.querySelectorAll('input:checked').length ? ' (ostatní kolidují s čísly v seznamu)' : ''), 'ok');
}

// ---------------- dvojí souřadnice ----------------
export async function dvojiSouradnice() {
    const p = Projekt.get();
    const r = await dialog({ titulek: 'Dvojí souřadnice (hlavní Y X · vedlejší Y2 X2)', sirka: 560, obsah: el('div', { class: 'tlum' }, `${p.body.filter((b) => b.y2 != null).length} bodů má vedlejší souřadnice. Vedlejší soustava slouží např. pro souřadnice polohy vs. obrazu (KN) nebo místní soustavu.`),
        tlacitka: [{ text: 'Doplnit vedlejší ze souboru', hodnota: 'doplnit' }, { text: 'Zaměnit hlavní ↔ vedlejší', hodnota: 'zamenit' }, { text: 'Kopírovat hlavní → vedlejší', hodnota: 'kopie' }, { text: 'Export vedlejších', hodnota: 'export' }, { text: 'Smazat vedlejší', hodnota: 'smazat', class: 'nebezpecny' }, { text: 'Zavřít', hodnota: null }] });
    if (!r) return;
    if (r === 'doplnit') { const f = await otevriSoubor(''); if (!f) return; const t = await ctiText(f); const s = ctiSeznam(t, odhadniPoradi(t.split(/\r?\n/))); let n = 0; s.body.forEach((b) => { const a = Projekt.bod(b.cislo); if (a) { a.y2 = b.y; a.x2 = b.x; n++; } }); Projekt.zmena('body'); toast(`Doplněno ${n} vedlejších souřadnic`, 'ok'); }
    if (r === 'zamenit') { p.body.forEach((b) => { if (b.y2 != null) { [b.y, b.y2] = [b.y2, b.y]; [b.x, b.x2] = [b.x2, b.x]; } }); Projekt.zmena('body'); toast('Zaměněno', 'ok'); }
    if (r === 'kopie') { p.body.forEach((b) => { b.y2 = b.y; b.x2 = b.x; }); Projekt.zmena('body'); toast('Zkopírováno', 'ok'); }
    if (r === 'export') { ulozSoubor('vedlejsi.txt', zapisSeznam(p.body.filter((b) => b.y2 != null).map((b) => ({ ...b, y: b.y2, x: b.x2 })), 'txt', 'c y x z k')); }
    if (r === 'smazat') { if (await potvrd('Smazat vedlejší souřadnice u všech bodů?')) { p.body.forEach((b) => { b.y2 = null; b.x2 = null; }); Projekt.zmena('body'); } }
}

// ---------------- zeměpisné souřadnice ----------------
export async function zemepisne() {
    const p = Projekt.get();
    const radky = p.body.filter((b) => b.y != null).map((b) => { const w = jtskToWgs(b.y, b.x, b.z ?? 250); return { b, w }; });
    const txt = radky.map(({ b, w }) => `${b.cislo}\t${w.lat.toFixed(8)}\t${w.lng.toFixed(8)}${b.z != null ? '\t' + fmt(b.z) : ''}`).join('\n');
    await dialog({ titulek: 'Zeměpisné souřadnice WGS84 (ETRS89)', sirka: 640, obsah: el('div', { style: 'display:grid;gap:8px' }, el('p', { class: 'tlum', style: 'margin:0;font-size:12.5px' }, 'Převod Křovák + 7prvková transformace (shodná s AR Geodetem, ~1 m proti zpřesněné transformaci ČÚZK). Pro přesné práce používej S-JTSK.'), el('div', { class: 'tw' }, el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Bod'), el('th', { class: 'num' }, 'B (šířka)'), el('th', { class: 'num' }, 'L (délka)'))), el('tbody', {}, radky.slice(0, 500).map(({ b, w }) => el('tr', {}, el('td', { class: 'cislo' }, b.cislo), el('td', { class: 'num' }, w.lat.toFixed(8) + '°'), el('td', { class: 'num' }, w.lng.toFixed(8) + '°'))))))),
        tlacitka: [{ text: 'Uložit TXT', hodnota: 'txt' }, { text: 'Zavřít', hodnota: null }] }).then((r) => { if (r === 'txt') ulozSoubor('wgs84.txt', txt + '\n'); });
}

// ---------------- mapové listy SM5 ----------------
/** Označení listu Státní mapy 1:5000 v S-JTSK: list 1:50 000 má 25 km (Y) × 20 km (X) od počátku, SM5 = 2,5 × 2 km, sloupec 1–10 (od západu = od větších Y), řádek 1–10 (od severu = od menších X). */
export function mapovyListSM5(y, x) {
    const sl50 = Math.floor(y / 25000), ra50 = Math.floor(x / 20000);
    const sl = 10 - Math.floor((y - sl50 * 25000) / 2500), ra = Math.floor((x - ra50 * 20000) / 2000) + 1;
    return { list50: `${sl50}-${ra50}`, sm5: `${sl}-${ra}`, nazev: `SM5 [${sl50}/${ra50}] ${sl}-${ra}` };
}
export async function mapoveListy() {
    const p = Projekt.get(); const sk = new Map();
    p.body.forEach((b) => { if (b.y == null) return; const m = mapovyListSM5(b.y, b.x); if (!sk.has(m.nazev)) sk.set(m.nazev, []); sk.get(m.nazev).push(b); });
    const prot = [...sk.entries()].map(([k, a]) => `${k}: ${a.length} bodů (${a.slice(0, 8).map((b) => b.cislo).join(', ')}${a.length > 8 ? '…' : ''})`).join('\n');
    const r = await dialog({ titulek: 'Roztřídění podle mapových listů SM5', sirka: 620, obsah: el('div', { style: 'display:grid;gap:8px' }, el('pre', { class: 'protokol', style: 'padding:0' }, prot || 'žádné body'), el('p', { class: 'tlum', style: 'margin:0;font-size:12.5px' }, 'Označení je číselné (index listu 1:50 000 v S-JTSK a číslo SM5 sloupec-řádek); jména listů 1:50 000 (Praha 4-2 …) vyžadují tabulku názvů — když ji pošleš, doplním.')), tlacitka: [{ text: 'Uložit soubory po listech (TXT)', hodnota: 'ulozit' }, { text: 'Zavřít', hodnota: null }] });
    if (r === 'ulozit') for (const [k, a] of sk) await ulozSoubor(k.replace(/[^\w-]+/g, '_') + '.txt', zapisSeznam(a, 'txt'));
}

// ---------------- kódovací tabulka ----------------
export async function kodovaciTabulka() {
    const p = Projekt.get(); if (!p.kody) p.kody = [];
    const tb = el('tbody');
    const radek = (k = { kod: '', popis: '', hladina: '', typ: 'bod', barva: '' }) => { const tr = el('tr'); tr.append(...['kod', 'popis', 'hladina'].map((f) => el('td', {}, el('input', { type: 'text', value: k[f] || '', 'aria-label': f }))), el('td', {}, el('select', { 'aria-label': 'typ' }, [['bod', 'bod'], ['linie', 'linie (spojovat)'], ['plocha', 'plocha (uzavřít)'], ['znacka', 'značka']].map(([v, t]) => el('option', { value: v, selected: v === (k.typ || 'bod') }, t)))), el('td', {}, el('input', { type: 'color', value: k.barva || '#17202A', 'aria-label': 'barva', style: 'width:38px;height:28px;padding:0;border:0;background:none' })), el('td', { class: 'akce' }, el('button', { class: 'ikona', onclick: () => tr.remove() }, '✕'))); tb.append(tr); };
    p.kody.forEach(radek); if (!p.kody.length) ['PLOT', 'BUDOVA', 'CESTA', 'STROM'].forEach((k, i) => radek({ kod: k, popis: ['plot', 'budova', 'osa cesty', 'strom'][i], hladina: k, typ: i === 3 ? 'znacka' : i === 1 ? 'plocha' : 'linie', barva: ['#B7791F', '#B42318', '#4A5563', '#1E7F4F'][i] }));
    const r = await dialog({ titulek: 'Kódovací tabulka', sirka: 720, obsah: el('div', { style: 'display:grid;gap:8px' }, el('p', { class: 'tlum', style: 'margin:0;font-size:12.5px' }, 'Kód bodu → popis, hladina kresby a typ (bod, linie = body se stejným kódem se spojují v pořadí čísel, plocha = uzavřená, značka). Vícenásobné kódy oddělené mezerou (PLOT ROH). Použije se v kresbě a v exportu DXF.'), el('div', { class: 'tw' }, el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Kód'), el('th', {}, 'Popis'), el('th', {}, 'Hladina'), el('th', {}, 'Typ'), el('th', {}, 'Barva'), el('th', {}, ''))), tb)), el('div', { style: 'display:flex;gap:8px' }, el('button', { class: 'btn maly', onclick: () => radek() }, '+ Kód'), el('button', { class: 'btn maly', onclick: async () => { const f = await otevriSoubor(''); if (!f) return; (await ctiText(f)).split(/\r?\n/).forEach((l) => { const c = l.split(/[;\t]/).map((x) => x.trim()); if (c[0]) radek({ kod: c[0], popis: c[1] || '', hladina: c[2] || c[0], typ: c[3] || 'bod', barva: c[4] || '' }); }); } }, 'Načíst ze souboru (kód;popis;hladina;typ;barva)'), el('button', { class: 'btn maly', onclick: () => ulozSoubor('kody.txt', [...tb.rows].map((tr) => [...tr.querySelectorAll('input,select')].slice(0, 5).map((i) => i.value).join(';')).join('\n') + '\n') }, 'Uložit do souboru'))),
        tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Uložit tabulku', hodnota: true, class: 'hlavni' }] });
    if (!r) return;
    p.kody = [...tb.rows].map((tr) => { const g = (l) => tr.querySelector(`[aria-label=${l}]`).value.trim(); return { kod: g('kod'), popis: g('popis'), hladina: g('hladina') || g('kod'), typ: g('typ'), barva: g('barva') }; }).filter((k) => k.kod);
    Projekt.zmena('kody'); toast(`Kódovací tabulka: ${p.kody.length} kódů`, 'ok');
}
/** Překódování bodů podle tabulky starý;nový (při importu nebo dodatečně) */
export async function prekodovani(body) {
    const p = Projekt.get(); const f = await otevriSoubor(''); if (!f) return;
    const mapa = new Map(); (await ctiText(f)).split(/\r?\n/).forEach((l) => { const c = l.split(/[;\t=]/).map((x) => x.trim()); if (c[0]) mapa.set(c[0], c[1] || ''); });
    let n = 0; (body || p.body).forEach((b) => { const nk = (b.kod || '').split(/\s+/).map((k) => mapa.has(k) ? mapa.get(k) : k).filter(Boolean).join(' '); if (nk !== (b.kod || '')) { b.kod = nk; n++; } });
    Projekt.zmena('body'); toast(`Překódováno ${n} bodů`, 'ok');
}
