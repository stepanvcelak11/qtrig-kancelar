// Výpočty: dlaždice vlevo, formulář + výsledek uprostřed, zápis do protokolu a do seznamu bodů.
import { Projekt } from './projekt.js';
import { el, $, fmt, fmtG, cislo, toast, dialog, potvrd, datumCas } from './ui.js';
import { Stred } from './stred.js';
import { Mapa } from './mapa.js';
import { Protokol } from './protokol.js';
import { parseUhel, gonNorm, gonDiff } from '../geo/uhly.js';
import { smernik, delka, rajon, ortogonalni, protinaniSmerniky, protinaniUhly, protinaniDelky } from '../geo/zaklad.js';
import { orientaceStanoviska, polarniBody, volneStanoviskoHelmert, vyrovnaniStanoviska, protinaniZpet } from '../geo/stanovisko.js';
import { kriteria, posud, posudOmernou, ORIENTACE_MEZ } from '../geo/presnost.js';
import { kontrolniOmerne, vymeraZeSouradnic, trigVyska, redukceDelky } from '../geo/ostatni.js';
import { registruj } from './vypocty2.js';
import { registruj3 } from './vypocty3.js';

export const ULOHY = [
    { id: 'polarni', skupina: 'Zápisník', nazev: 'Polární metoda', popis: 'Celé stanovisko: orientace, podrobné body, výšky' },
    { id: 'volne', skupina: 'Zápisník', nazev: 'Volné stanovisko', popis: 'Stanovisko bez souřadnic z orientací (Helmert / MNČ)' },
    { id: 'rajon', skupina: 'Souřadnicové', nazev: 'Rajón', popis: 'Bod ze směrníku (nebo úhlu od orientace) a délky' },
    { id: 'orto', skupina: 'Souřadnicové', nazev: 'Ortogonální metoda', popis: 'Staničení a kolmice od měřické přímky' },
    { id: 'prot-uhly', skupina: 'Souřadnicové', nazev: 'Protínání vpřed z úhlů', popis: 'Ze dvou stanovisek úhly od spojnice' },
    { id: 'prot-smer', skupina: 'Souřadnicové', nazev: 'Protínání ze směrníků', popis: 'Ze dvou bodů známé směrníky' },
    { id: 'prot-delky', skupina: 'Souřadnicové', nazev: 'Protínání z délek', popis: 'Dvě délky od známých bodů, volba strany' },
    { id: 'prot-zpet', skupina: 'Souřadnicové', nazev: 'Protínání zpět', popis: 'Směry na 3 a více známých bodů' },
    { id: 'smer', skupina: 'Souřadnicové', nazev: 'Směrník a délka', popis: 'Mezi dvěma body ze seznamu' },
    { id: 'omerne', skupina: 'Kontroly', nazev: 'Kontrolní oměrné', popis: 'Měřené × vypočtené, mezní u_d' },
    { id: 'vymera', skupina: 'Kontroly', nazev: 'Výměra', popis: 'Plocha a obvod ze souřadnic' },
    { id: 'polygon', skupina: 'Další', nazev: 'Polygonový pořad', popis: 'Všechny typy, uzávěry proti mezním' },
    { id: 'transformace', skupina: 'Další', nazev: 'Transformace', popis: 'Shodnostní, Helmert, afinní; místní → S-JTSK' },
    { id: 'vysky', skupina: 'Další', nazev: 'Výšky', popis: 'Trigonometricky, nivelační pořad' },
    { id: 'redukce', skupina: 'Další', nazev: 'Redukce délek', popis: 'Z výšky a Křovákovo zkreslení' },
    { id: 'osa', skupina: 'Silničář', nazev: 'Osa, staničení, oblouky', popis: 'Tečnový polygon s oblouky a přechodnicemi; staničení a kolmice bodů, body ze staničení' },
];

let kore;
export const Vypocty = {
    init(root) {
        kore = root;
        Projekt.poslouchej((co) => { if (co === 'projekt' || co === 'vypocty') vykresli(); });
        document.addEventListener('vypocet', (e) => otevri(e.detail.typ, e.detail));
        vykresli();
    },
    otevri,
};

function vykresli() {
    const p = Projekt.get(); if (!kore || !p) return;
    kore.innerHTML = '';
    $('#poc-vypocty').textContent = p.vypocty.length || '';
    const skupiny = [...new Set(ULOHY.map((u) => u.skupina))];
    skupiny.forEach((sk) => {
        kore.append(el('div', { class: 'skupina' }, sk));
        kore.append(el('div', { class: 'mrizka' }, ULOHY.filter((u) => u.skupina === sk).map((u) => el('button', { class: 'dlazdice' + (u.brzy ? ' brzy' : ''), onclick: () => otevri(u.id) }, el('b', {}, u.nazev), el('small', {}, u.brzy ? 'připravuje se · ' + u.popis : u.popis)))));
    });
    if (p.vypocty.length) {
        kore.append(el('div', { class: 'skupina' }, 'Historie'));
        const ul = el('ul', { class: 'seznam' });
        p.vypocty.slice().reverse().slice(0, 50).forEach((v) => ul.append(el('li', { onclick: () => historie(v) }, el('span', { class: 'sem ' + (v.stav || 'neposouzeno'), title: v.stav }), el('span', { class: 't' }, v.nazev), el('span', { class: 'd' }, datumCas(v.kdy).slice(0, 16)))));
        kore.append(ul);
    }
}
function historie(v) { dialog({ titulek: v.nazev + ' · ' + datumCas(v.kdy), obsah: el('pre', { class: 'protokol', style: 'padding:0' }, v.protokol || ''), sirka: 680 }); }

function otevri(typ, ctx = {}) {
    const u = ULOHY.find((x) => x.id === typ); if (!u) return;
    if (u.brzy) { toast(u.nazev + ' přijde v další dávce'); return; }
    const id = 'vyp-' + typ + (ctx.stanoviskoId ? '-' + ctx.stanoviskoId : '');
    Stred.otevri({ id, titulek: u.nazev, obnov: !!ctx.stanoviskoId, render: (sek) => FORMY[typ](sek, ctx, u) });
}

// ---------- společné prvky ----------
function bodPole(popis, idd, vychozi = '') {
    const inp = el('input', { type: 'text', id: idd, value: vychozi, list: 'dl-body', autocomplete: 'off', placeholder: 'číslo bodu' });
    const hint = el('small', { class: 'tlum mono' });
    const aktualizuj = () => { const b = Projekt.bod(inp.value.trim()); hint.textContent = b ? `Y ${fmt(b.y)}  X ${fmt(b.x)}${b.z != null ? '  Z ' + fmt(b.z) : ''}` : (inp.value ? 'bod není v seznamu' : ''); hint.style.color = b || !inp.value ? '' : 'var(--bad)'; };
    inp.addEventListener('input', aktualizuj); aktualizuj();
    const w = el('label', { class: 'pole' }, el('span', {}, popis), inp, hint);
    w.bod = () => Projekt.bod(inp.value.trim()); w.inp = inp; w.aktualizuj = aktualizuj;
    return w;
}
function cisloPole(popis, idd, vychozi = '', jednotka = '') { const inp = el('input', { type: 'text', id: idd, value: vychozi, class: 'num', inputmode: 'decimal' }); const w = el('label', { class: 'pole' }, el('span', {}, popis + (jednotka ? ' [' + jednotka + ']' : '')), inp); w.hodnota = () => cislo(inp.value); w.uhel = () => parseUhel(inp.value); w.inp = inp; return w; }
function textPole(popis, idd, vychozi = '') { const inp = el('input', { type: 'text', id: idd, value: vychozi }); const w = el('label', { class: 'pole' }, el('span', {}, popis), inp); w.inp = inp; return w; }
function vyberPole(popis, idd, moznosti, vychozi) { const s = el('select', { id: idd }, moznosti.map(([v, t]) => el('option', { value: v, selected: v === vychozi }, t))); const w = el('label', { class: 'pole' }, el('span', {}, popis), s); w.inp = s; return w; }
function datalist() { let d = $('#dl-body'); if (!d) { d = el('datalist', { id: 'dl-body' }); document.body.append(d); } d.innerHTML = ''; Projekt.get().body.forEach((b) => d.append(el('option', { value: b.cislo }, b.kod || ''))); }
function sem(p, text) { return el('span', { class: 'sem ' + p.stav }, text); }
function chyba(sek, msg) { const v = $('.karta-vysledek', sek); if (v) v.remove(); sek.append(el('div', { class: 'karta-vysledek' }, el('div', { class: 'hl' }, el('b', {}, 'Nejde spočítat'), sem({ stav: 'prekroceno' }, 'chyba')), el('div', { class: 'telo' }, msg))); }

/** Zobrazí kartu výsledku; body = [{cislo,y,x,z,kod}] k uložení; prot = text protokolu; stav = celkový semafor */
function vysledek(sek, { nazev, kv = [], body = [], prot = '', stav = 'ok', vrstvy = [], extra = null }) {
    const stary = $('.karta-vysledek', sek); if (stary) stary.remove();
    const karta = el('div', { class: 'karta-vysledek' });
    karta.append(el('div', { class: 'hl' }, el('b', {}, nazev), sem({ stav }, { ok: 'v mezích', varovani: 'blízko meze', prekroceno: 'PŘEKROČENO', neposouzeno: 'bez posouzení' }[stav])));
    const telo = el('div', { class: 'telo' });
    if (kv.length) telo.append(el('dl', { class: 'kv' }, kv.map(([k, v]) => [el('dt', {}, k), el('dd', {}, v)])));
    if (extra) telo.append(extra);
    if (body.length) {
        const tab = el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Bod'), el('th', { class: 'num' }, 'Y'), el('th', { class: 'num' }, 'X'), el('th', { class: 'num' }, 'Z'), el('th', {}, 'Kód'), el('th', {}, ''))),
            el('tbody', {}, body.map((b) => { const ex = Projekt.bod(b.cislo); return el('tr', {}, el('td', { class: 'cislo' }, b.cislo), el('td', { class: 'num' }, fmt(b.y)), el('td', { class: 'num' }, fmt(b.x)), el('td', { class: 'num' }, fmt(b.z)), el('td', {}, b.kod || ''), el('td', {}, ex ? el('span', { class: 'sem ' + (Math.hypot(ex.y - b.y, ex.x - b.x) < 0.005 ? 'ok' : 'varovani'), title: 'Bod už existuje: rozdíl polohy' }, 'existuje · Δ ' + fmt(Math.hypot(ex.y - b.y, ex.x - b.x), 3)) : el('span', { class: 'tlum' }, 'nový'))); })));
        telo.append(el('div', { class: 'tw' }, tab));
        telo.append(el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, el('button', { class: 'btn hlavni', onclick: () => ulozBody(body, nazev) }, `Uložit ${body.length === 1 ? 'bod' : body.length + ' bodů'} do seznamu`)));
    }
    if (prot) telo.append(el('details', {}, el('summary', { class: 'tlum', style: 'cursor:pointer' }, 'Zápis do protokolu'), el('pre', { class: 'protokol', style: 'padding:6px 0' }, prot)));
    karta.append(telo); sek.append(karta); karta.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (prot) { Protokol.pridej(nazev, prot); Projekt.ulozVypocet({ typ: nazev, nazev, protokol: prot, stav }); Projekt.zmena('vypocty'); }
    Mapa.vrstvy(vrstvy);
    return karta;
}
async function ulozBody(body, zdroj) {
    const kolize = body.filter((b) => Projekt.bod(b.cislo));
    let rezim = 'prepsat';
    if (kolize.length) {
        rezim = await dialog({ titulek: 'Body už existují', obsah: el('p', {}, `${kolize.length} z ${body.length} bodů už v seznamu je (${kolize.slice(0, 6).map((b) => b.cislo).join(', ')}${kolize.length > 6 ? '…' : ''}). Co s nimi?`), tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Přeskočit existující', hodnota: 'preskocit' }, { text: 'Přepsat', hodnota: 'prepsat', class: 'hlavni' }] });
        if (!rezim) return;
    }
    let n = 0; body.forEach((b) => { const r = Projekt.ulozBod({ cislo: b.cislo, y: b.y, x: b.x, z: b.z ?? null, kod: b.kod || '', zdroj: 'vypocet', pozn: zdroj }, rezim === 'prepsat'); if (r.pridano || r.prepsano) n++; });
    Projekt.zmena('body'); toast(`Uloženo ${n} bodů`, 'ok');
}
function hlavaFormu(sek, u, ...pole) { datalist(); const f = el('div', { class: 'form' }, el('h2', {}, u.nazev), el('p', { class: 'tlum', style: 'margin:0' }, u.popis), ...pole); sek.append(f); return f; }
const P = (v, d = 3) => fmt(v, d).padStart(12);
const G = (v) => fmtG(v, 4).padStart(9);

// ---------- formuláře ----------
const FORMY = {
    smer(sek, ctx, u) {
        const a = bodPole('Z bodu', 'sm-a'), b = bodPole('Na bod', 'sm-b');
        const f = hlavaFormu(sek, u, el('div', { class: 'radek' }, a, b), el('div', {}, el('button', { class: 'btn hlavni', onclick: () => {
            const A = a.bod(), B = b.bod(); if (!A || !B) return chyba(sek, 'Oba body musí být v seznamu.');
            const s = smernik(A, B), d = delka(A, B), dz = A.z != null && B.z != null ? B.z - A.z : null;
            vysledek(sek, { nazev: `Směrník a délka ${A.cislo} → ${B.cislo}`, stav: 'neposouzeno', kv: [['Směrník', fmtG(s) + ' g'], ['Vodorovná délka', fmt(d) + ' m'], ['Převýšení', dz == null ? '—' : fmt(dz) + ' m'], ['Šikmá délka', dz == null ? '—' : fmt(Math.hypot(d, dz)) + ' m']],
                prot: `${A.cislo}: Y ${P(A.y)} X ${P(A.x)}\n${B.cislo}: Y ${P(B.y)} X ${P(B.x)}\nsměrník ${G(s)} g   délka ${P(d)} m${dz != null ? '   Δh ' + P(dz) + ' m' : ''}`, vrstvy: [{ typ: 'cara', body: [A, B] }] });
        } }, 'Spočítat')));
    },

    rajon(sek, ctx, u) {
        const st = bodPole('Stanovisko', 'rj-st'), or = bodPole('Orientace (nepovinné)', 'rj-or'), uh = cisloPole('Úhel od orientace / směrník', 'rj-u', '', 'g'), dl = cisloPole('Vodorovná délka', 'rj-d', '', 'm'), c = textPole('Číslo nového bodu', 'rj-c', Projekt.volneCislo(1)), kod = textPole('Kód', 'rj-k');
        hlavaFormu(sek, u, el('div', { class: 'radek' }, st, or), el('div', { class: 'radek' }, uh, dl), el('div', { class: 'radek' }, c, kod), el('p', { class: 'tlum', style: 'margin:0;font-size:12.5px' }, 'S orientací je úhel měřen od směru na orientaci po směru hodinových ručiček (vpravo); bez orientace je to přímo směrník.'),
            el('div', {}, el('button', { class: 'btn hlavni', onclick: () => {
                const S = st.bod(); if (!S) return chyba(sek, 'Stanovisko musí být v seznamu.');
                const O = or.inp.value.trim() ? or.bod() : null; if (or.inp.value.trim() && !O) return chyba(sek, 'Orientační bod není v seznamu.');
                const w = uh.uhel(), d = dl.hodnota(); if (w == null || d == null) return chyba(sek, 'Zadej úhel a délku.');
                const sig = O ? gonNorm(smernik(S, O) + w) : gonNorm(w); const Pb = rajon(S, sig, d); const cis = c.inp.value.trim() || Projekt.volneCislo(1);
                vysledek(sek, { nazev: `Rajón ${cis} z ${S.cislo}`, stav: 'neposouzeno', kv: [['Směrník', fmtG(sig) + ' g'], ['Délka', fmt(d) + ' m']], body: [{ cislo: cis, y: Pb.y, x: Pb.x, kod: kod.inp.value.trim() }],
                    prot: `stanovisko ${S.cislo}: Y ${P(S.y)} X ${P(S.x)}\n${O ? `orientace ${O.cislo}: směrník ${G(smernik(S, O))} g, úhel ${G(w)} g\n` : ''}směrník ${G(sig)} g   délka ${P(d)} m\n${cis}: Y ${P(Pb.y)} X ${P(Pb.x)}`, vrstvy: [{ typ: 'cara', body: [S, Pb] }, { typ: 'body', body: [{ ...Pb, cislo: cis }] }] });
                c.inp.value = Projekt.volneCislo(+cis + 1 || 1);
            } }, 'Spočítat')));
    },

    orto(sek, ctx, u) {
        const a = bodPole('Počátek přímky A', 'or-a'), b = bodPole('Koncový bod B', 'or-b'), dm = cisloPole('Měřená délka AB (nepovinné)', 'or-dab', '', 'm');
        const radky = el('tbody'); const tab = el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Číslo'), el('th', { class: 'num' }, 'Staničení'), el('th', { class: 'num' }, 'Kolmice (vpravo +)'), el('th', {}, 'Kód'))), radky);
        const pridej = () => radky.append(el('tr', {}, el('td', {}, el('input', { type: 'text', value: Projekt.volneCislo(radky.rows.length + 1), 'aria-label': 'c' })), el('td', {}, el('input', { type: 'text', class: 'num', inputmode: 'decimal', 'aria-label': 's' })), el('td', {}, el('input', { type: 'text', class: 'num', inputmode: 'decimal', 'aria-label': 'k' })), el('td', {}, el('input', { type: 'text', 'aria-label': 'kod' }))));
        pridej(); pridej(); pridej();
        hlavaFormu(sek, u, el('div', { class: 'radek' }, a, b, dm), el('div', { class: 'tw' }, tab), el('div', { style: 'display:flex;gap:8px' }, el('button', { class: 'btn maly', onclick: pridej }, '+ Řádek'), el('button', { class: 'btn hlavni', onclick: () => {
            const A = a.bod(), B = b.bod(); if (!A || !B) return chyba(sek, 'Body A a B musí být v seznamu.');
            const dAB = dm.hodnota(); const body = [], vr = [{ typ: 'cara', body: [A, B], carkovane: true }]; let prot = `A ${A.cislo}: Y ${P(A.y)} X ${P(A.x)}\nB ${B.cislo}: Y ${P(B.y)} X ${P(B.x)}\n`;
            let stav = 'neposouzeno', r0 = null;
            for (const tr of radky.rows) { const g = (n) => tr.querySelector(`[aria-label=${n}]`).value.trim(); const s = cislo(g('s')), k = cislo(g('k')); if (s == null || k == null) continue; const r = ortogonalni(A, B, s, k, dAB); r0 = r; body.push({ cislo: g('c'), y: r.bod.y, x: r.bod.x, kod: g('kod') }); prot += `${g('c').padEnd(10)} s ${P(s)}  k ${P(k)}  →  Y ${P(r.bod.y)} X ${P(r.bod.x)}\n`; }
            if (!body.length) return chyba(sek, 'Zadej aspoň jeden řádek se staničením a kolmicí.');
            const kv = [['Směrník AB', fmtG(smernik(A, B)) + ' g'], ['Délka AB ze souřadnic', fmt(delka(A, B)) + ' m']];
            if (dAB != null && r0) { const pos = posudOmernou(dAB, delka(A, B), Projekt.get().kodKvality); stav = pos.stav; kv.push(['Měřená AB', fmt(dAB) + ' m'], ['Rozdíl (mezní u_d)', `${fmt(pos.rozdil)} m (${fmt(pos.mezni)})`], ['Měřítko', r0.q.toFixed(6)]); prot = `měřená AB ${P(dAB)} m, ze souřadnic ${P(delka(A, B))} m, rozdíl ${P(pos.rozdil)} m, u_d ${P(pos.mezni)} m — ${pos.stav}\n` + prot; }
            vr.push({ typ: 'body', body: body });
            vysledek(sek, { nazev: `Ortogonální metoda z ${A.cislo}–${B.cislo}`, stav, kv, body, prot, vrstvy: vr });
        } }, 'Spočítat')));
    },

    'prot-uhly'(sek, ctx, u) { protinaniForm(sek, u, 'uhly'); },
    'prot-smer'(sek, ctx, u) { protinaniForm(sek, u, 'smer'); },
    'prot-delky'(sek, ctx, u) { protinaniForm(sek, u, 'delky'); },

    'prot-zpet'(sek, ctx, u) {
        const radky = el('tbody'); const tab = el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Známý bod'), el('th', { class: 'num' }, 'Směr [g]'))), radky);
        const pridej = () => radky.append(el('tr', {}, el('td', {}, el('input', { type: 'text', list: 'dl-body', 'aria-label': 'b' })), el('td', {}, el('input', { type: 'text', class: 'num', inputmode: 'decimal', 'aria-label': 's' }))));
        pridej(); pridej(); pridej(); pridej();
        const c = textPole('Číslo stanoviska', 'pz-c', Projekt.volneCislo(5001));
        hlavaFormu(sek, u, el('div', { class: 'radek' }, c), el('div', { class: 'tw' }, tab), el('div', { style: 'display:flex;gap:8px' }, el('button', { class: 'btn maly', onclick: pridej }, '+ Řádek'), el('button', { class: 'btn hlavni', onclick: () => {
            const m = []; for (const tr of radky.rows) { const b = Projekt.bod(tr.querySelector('[aria-label=b]').value.trim()), s = parseUhel(tr.querySelector('[aria-label=s]').value); if (b && s != null) m.push({ cislo: b.cislo, bod: b, smer: s }); }
            if (m.length < 3) return chyba(sek, 'Potřebuji aspoň 3 známé body se směrem.');
            let r; try { r = protinaniZpet(m); } catch (e) { return chyba(sek, e.message); }
            const kr = kriteria(Projekt.get().kodKvality); const pos = r.mxy != null ? posud(r.mxy, kr.mxy) : { stav: 'neposouzeno' };
            const cis = c.inp.value.trim();
            let prot = m.map((x) => `${x.cislo.padEnd(10)} Y ${P(x.bod.y)} X ${P(x.bod.x)}  směr ${G(x.smer)} g`).join('\n') + `\n${cis}: Y ${P(r.S.y)} X ${P(r.S.x)}   orientační posun ${G(r.o)} g\n` + r.radky.map((x) => `oprava směru ${x.cislo.padEnd(10)} ${(x.vSmer * 10000).toFixed(1).padStart(8)} cc`).join('\n') + `\nm0 ${r.m0 == null ? '—' : (r.m0).toFixed(4) + ' (bezrozm.)'}   m_xy ${r.mxy == null ? '—' : fmt(r.mxy) + ' m'}${r.nebezpecny ? '\nVAROVÁNÍ: stanovisko leží blízko nebezpečné kružnice!' : ''}`;
            vysledek(sek, { nazev: `Protínání zpět ${cis}`, stav: r.nebezpecny ? 'prekroceno' : pos.stav, kv: [['Orientační posun', fmtG(r.o) + ' g'], ['m_xy', r.mxy == null ? '— (bez nadbytečných měření)' : fmt(r.mxy) + ' m (mezní m_xy ' + fmt(kr.mxy) + ')'], ['Nebezpečná kružnice', r.nebezpecny ? 'ANO — výsledek nespolehlivý' : 'ne']], body: [{ cislo: cis, y: r.S.y, x: r.S.x }], prot, vrstvy: [...m.map((x) => ({ typ: 'cara', body: [r.S, x.bod], carkovane: true })), { typ: 'body', body: [{ ...r.S, cislo: cis }] }] });
        } }, 'Spočítat')));
    },

    omerne(sek, ctx, u) {
        const radky = el('tbody'); const tab = el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Bod'), el('th', {}, 'Bod'), el('th', { class: 'num' }, 'Měřeno [m]'))), radky);
        const pridej = (a = '', b = '') => radky.append(el('tr', {}, el('td', {}, el('input', { type: 'text', list: 'dl-body', value: a, 'aria-label': 'a' })), el('td', {}, el('input', { type: 'text', list: 'dl-body', value: b, 'aria-label': 'b' })), el('td', {}, el('input', { type: 'text', class: 'num', inputmode: 'decimal', 'aria-label': 'd' }))));
        for (let i = 0; i < 4; i++) pridej();
        hlavaFormu(sek, u, el('div', { class: 'tw' }, tab), el('div', { style: 'display:flex;gap:8px' }, el('button', { class: 'btn maly', onclick: () => pridej() }, '+ Řádek'), el('button', { class: 'btn hlavni', onclick: () => {
            const dv = []; for (const tr of radky.rows) { const a = Projekt.bod(tr.querySelector('[aria-label=a]').value.trim()), b = Projekt.bod(tr.querySelector('[aria-label=b]').value.trim()), d = cislo(tr.querySelector('[aria-label=d]').value); if (a && b && d != null) dv.push({ a, b, dMer: d }); }
            if (!dv.length) return chyba(sek, 'Zadej dvojice bodů ze seznamu a měřenou délku.');
            const kod = Projekt.get().kodKvality, r = kontrolniOmerne(dv, kod);
            const stav = r.some((x) => x.stav === 'prekroceno') ? 'prekroceno' : r.some((x) => x.stav === 'varovani') ? 'varovani' : 'ok';
            const tabV = el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Body'), el('th', { class: 'num' }, 'Měřeno'), el('th', { class: 'num' }, 'Ze souřadnic'), el('th', { class: 'num' }, 'Rozdíl'), el('th', { class: 'num' }, 'u_d'), el('th', {}, ''))), el('tbody', {}, r.map((x) => el('tr', {}, el('td', { class: 'cislo' }, x.a + ' – ' + x.b), el('td', { class: 'num' }, fmt(x.dMer)), el('td', { class: 'num' }, fmt(x.dVyp)), el('td', { class: 'num' }, fmt(x.rozdil)), el('td', { class: 'num' }, fmt(x.ud)), el('td', {}, sem(x, x.stav === 'ok' ? 'ok' : x.stav === 'varovani' ? (x.pomer * 100).toFixed(0) + ' % meze' : 'překročeno'))))));
            const prot = `kód kvality ${kod}: u_d = 2·√2·${kriteria(kod).mxy}·(d+12)/(d+20)\n` + r.map((x) => `${(x.a + '-' + x.b).padEnd(16)} měř ${P(x.dMer)}  vyp ${P(x.dVyp)}  Δ ${P(x.rozdil)}  u_d ${P(x.ud)}  ${x.stav}`).join('\n');
            vysledek(sek, { nazev: 'Kontrolní oměrné', stav, extra: el('div', { class: 'tw' }, tabV), prot, vrstvy: dv.map((x) => ({ typ: 'cara', body: [x.a, x.b], barva: r.find((y) => y.a === x.a.cislo && y.b === x.b.cislo)?.stav === 'prekroceno' ? '#B42318' : undefined })) });
        } }, 'Posoudit')));
    },

    vymera(sek, ctx, u) {
        const ta = el('textarea', { id: 'vy-body', placeholder: 'čísla bodů po obvodu, oddělená mezerou nebo čárkou\nnapř. 101 102 103 104', rows: 3 });
        hlavaFormu(sek, u, el('label', { class: 'pole' }, el('span', {}, 'Body po obvodu'), ta), el('div', {}, el('button', { class: 'btn hlavni', onclick: () => {
            const cis = ta.value.split(/[\s,;]+/).filter(Boolean); const body = cis.map((c) => Projekt.bod(c)); const chybi = cis.filter((c, i) => !body[i]);
            if (chybi.length) return chyba(sek, 'Nejsou v seznamu: ' + chybi.join(', ')); if (body.length < 3) return chyba(sek, 'Aspoň 3 body.');
            const r = vymeraZeSouradnic(body);
            vysledek(sek, { nazev: 'Výměra ' + cis[0] + '…' + cis[cis.length - 1], stav: 'neposouzeno', kv: [['Výměra', fmt(r.plocha, 0) + ' m² (' + fmt(r.plocha, 2) + ' m²)'], ['', fmt(r.ha, 4) + ' ha'], ['Obvod', fmt(r.obvod, 2) + ' m'], ['Počet vrcholů', body.length]], prot: body.map((b) => `${b.cislo.padEnd(10)} Y ${P(b.y)} X ${P(b.x)}`).join('\n') + `\nvýměra ${fmt(r.plocha, 2)} m²   obvod ${fmt(r.obvod, 2)} m`, vrstvy: [{ typ: 'cara', body, uzavrit: true }] });
        } }, 'Spočítat')));
    },

    redukce(sek, ctx, u) {
        const d = cisloPole('Měřená vodorovná délka', 'rd-d', '', 'm'), h = cisloPole('Nadmořská výška', 'rd-h', '', 'm'), y = cisloPole('Y přibližně', 'rd-y', '745000', 'm'), x = cisloPole('X přibližně', 'rd-x', '1045000', 'm');
        hlavaFormu(sek, u, el('div', { class: 'radek' }, d, h), el('div', { class: 'radek' }, y, x), el('div', {}, el('button', { class: 'btn hlavni', onclick: () => {
            const dd = d.hodnota(); if (dd == null) return chyba(sek, 'Zadej délku.');
            const r = redukceDelky(dd, h.hodnota() || 0, y.hodnota(), x.hodnota());
            vysledek(sek, { nazev: 'Redukce délky', stav: 'neposouzeno', kv: [['Měřeno', fmt(dd, 4) + ' m'], ['Z výšky (R/(R+H))', r.mVyska.toFixed(8)], ['Zobrazení (Křovák)', r.mZobrazeni.toFixed(8)], ['Celkem', r.mCelkem.toFixed(8)], ['Délka v S-JTSK', fmt(r.dSjtsk, 4) + ' m'], ['Oprava', fmt((r.dSjtsk - dd) * 1000, 1) + ' mm']], prot: `d ${fmt(dd, 4)} m, H ${fmt(h.hodnota() || 0, 0)} m, m_H ${r.mVyska.toFixed(8)}, m_zobr ${r.mZobrazeni.toFixed(8)} → d_JTSK ${fmt(r.dSjtsk, 4)} m` });
        } }, 'Spočítat')));
    },

    volne(sek, ctx, u) { polarniForm(sek, ctx, u, true); },
    polarni(sek, ctx, u) { polarniForm(sek, ctx, u, false); },
};

function protinaniForm(sek, u, druh) {
    const a = bodPole('Bod A', 'pr-a'), b = bodPole('Bod B', 'pr-b');
    const ua = cisloPole(druh === 'uhly' ? 'Úhel v A (od AB, vpravo +)' : druh === 'smer' ? 'Směrník z A' : 'Délka od A', 'pr-ua', '', druh === 'delky' ? 'm' : 'g');
    const ub = cisloPole(druh === 'uhly' ? 'Úhel v B (od BA, vpravo +)' : druh === 'smer' ? 'Směrník z B' : 'Délka od B', 'pr-ub', '', druh === 'delky' ? 'm' : 'g');
    const strana = druh === 'delky' ? vyberPole('Strana od A→B', 'pr-st', [['vpravo', 'vpravo'], ['vlevo', 'vlevo']], 'vpravo') : null;
    const c = textPole('Číslo nového bodu', 'pr-c', Projekt.volneCislo(1)), kod = textPole('Kód', 'pr-k');
    hlavaFormu(sek, u, el('div', { class: 'radek' }, a, b), el('div', { class: 'radek' }, ua, ub, strana), el('div', { class: 'radek' }, c, kod), el('div', {}, el('button', { class: 'btn hlavni', onclick: () => {
        const A = a.bod(), B = b.bod(); if (!A || !B) return chyba(sek, 'Body A a B musí být v seznamu.');
        const va = druh === 'delky' ? ua.hodnota() : ua.uhel(), vb = druh === 'delky' ? ub.hodnota() : ub.uhel(); if (va == null || vb == null) return chyba(sek, 'Zadej obě hodnoty.');
        const r = druh === 'uhly' ? protinaniUhly(A, B, va, vb) : druh === 'smer' ? protinaniSmerniky(A, va, B, vb) : protinaniDelky(A, B, va, vb, strana.inp.value);
        if (!r) return chyba(sek, druh === 'delky' ? 'Kružnice se neprotínají — délky nesedí ke vzdálenosti AB.' : 'Směry jsou rovnoběžné.');
        const g = r.gamma, kvalita = g < 30 || g > 170 ? 'varovani' : 'ok';
        const cis = c.inp.value.trim();
        vysledek(sek, { nazev: `Protínání ${cis} z ${A.cislo}, ${B.cislo}`, stav: kvalita, kv: [['Úhel protnutí', fmtG(g, 2) + ' g' + (kvalita === 'varovani' ? ' — ostrý, nepřesné' : '')], ['Délka AB', fmt(delka(A, B)) + ' m']], body: [{ cislo: cis, y: r.bod.y, x: r.bod.x, kod: kod.inp.value.trim() }],
            prot: `A ${A.cislo}: Y ${P(A.y)} X ${P(A.x)}\nB ${B.cislo}: Y ${P(B.y)} X ${P(B.x)}\n${druh === 'delky' ? `d_A ${P(va)} m  d_B ${P(vb)} m  strana ${strana.inp.value}` : `${druh === 'uhly' ? 'ω_A' : 'σ_A'} ${G(va)} g  ${druh === 'uhly' ? 'ω_B' : 'σ_B'} ${G(vb)} g`}\núhel protnutí ${fmtG(g, 2)} g\n${cis}: Y ${P(r.bod.y)} X ${P(r.bod.x)}`, vrstvy: [{ typ: 'cara', body: [A, r.bod, B], carkovane: true }, { typ: 'body', body: [{ ...r.bod, cislo: cis }] }] });
    } }, 'Spočítat')));
}

// ---------- polární metoda / volné stanovisko ze zápisníku ----------
function polarniForm(sek, ctx, u, jenVolne) {
    const p = Projekt.get(); datalist();
    if (!p.zapisnik.length) { sek.append(el('div', { class: 'prazdno' }, el('b', {}, 'Zápisník je prázdný'), 'Založ stanovisko v záložce Zápisník a zapiš orientace a záměry.')); return; }
    const sel = el('select', { id: 'po-st' }, p.zapisnik.map((s) => el('option', { value: s.id, selected: s.id === ctx.stanoviskoId }, `${s.stanovisko || '?'}  (${s.radky.length} řádků)`)));
    const metoda = vyberPole('Stanovisko bez souřadnic', 'po-met', [['helmert', 'volné stanovisko — Helmert (shodnostní)'], ['mnc', 'volné stanovisko — vyrovnání MNČ (směry + délky)']], 'helmert');
    const red = el('input', { type: 'checkbox', id: 'po-red', checked: true }), vysky = el('input', { type: 'checkbox', id: 'po-vys', checked: true });
    const f = hlavaFormu(sek, u, el('div', { class: 'radek' }, el('label', { class: 'pole' }, el('span', {}, 'Stanovisko ze zápisníku'), sel), metoda),
        el('div', { style: 'display:flex;gap:16px;flex-wrap:wrap;font-size:13px' }, el('label', {}, red, ' redukovat délky do S-JTSK (výška + zobrazení)'), el('label', {}, vysky, ' počítat výšky ze zenitů')),
        el('div', {}, el('button', { class: 'btn hlavni', onclick: () => spocitej() }, jenVolne ? 'Spočítat stanovisko' : 'Spočítat stanovisko a body')));
    if (ctx.stanoviskoId) spocitej();

    function spocitej() {
        const s = Projekt.stanovisko(sel.value); if (!s) return;
        const kod = p.kodKvality, kr = kriteria(kod);
        const St0 = Projekt.bod(s.stanovisko);
        // vodorovné délky + převýšení z řádků
        const rad = s.radky.map((r) => {
            const sik = (s.delky || 'sikme') === 'sikme';
            let dv = r.ds, dh = null;
            if (r.ds != null && r.z != null && sik) { dv = r.ds * Math.sin(r.z * Math.PI / 200); dh = r.ds * Math.cos(r.z * Math.PI / 200); }
            else if (r.ds != null && r.z != null && !sik) { dh = r.ds / Math.tan(r.z * Math.PI / 200); }
            return { ...r, dv, dh, bod: Projekt.bod(r.cislo) };
        });
        const orient = rad.filter((r) => r.typ === 'o' && r.bod && r.hz != null);
        if (!orient.length) return chyba(sek, 'Stanovisko nemá žádnou orientaci na bod ze seznamu (typ OR s číslem existujícího bodu).');
        // redukce délek: podle výšky stanoviska a jeho polohy
        const Hst = St0?.z ?? null;
        const mRed = (Y, X) => red.checked ? redukceDelky(1, Hst || 0, Y, X).mCelkem : 1;
        let S, o, prot = `stanovisko ${s.stanovisko}, výška přístroje ${fmt(s.vp)} m, délky ${s.delky === 'vodorovne' ? 'vodorovné' : 'šikmé'}${red.checked ? `, redukce do S-JTSK (H ${Hst == null ? '0 — VÝŠKA STANOVISKA NEZNÁMÁ' : fmt(Hst, 0)} m)` : ''}\n`;
        let kv = [], stav = 'ok', vr = [], extra = null;
        const zhorsi = (st) => { if (st === 'prekroceno') stav = 'prekroceno'; else if (st === 'varovani' && stav === 'ok') stav = 'varovani'; };
        if (St0 && !jenVolne) {
            S = St0; const m = mRed(S.y, S.x);
            const orr = orientaceStanoviska(S, orient.map((r) => ({ cislo: r.cislo, bod: r.bod, smer: r.hz, delka: r.dv != null ? r.dv * m : null })));
            o = orr.o;
            kv.push(['Stanovisko', `${S.cislo}: Y ${fmt(S.y)}  X ${fmt(S.x)}`], ['Orientační posun', fmtG(o) + ' g z ' + orr.n + ' orientací'], ['Střední chyba orientace', orr.mOr == null ? '—' : (orr.mOr * 10000).toFixed(1) + ' cc']);
            prot += `orientační posun ${G(o)} g\n`;
            const tabO = el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Orientace'), el('th', { class: 'num' }, 'Směrník'), el('th', { class: 'num' }, 'Odchylka [cc]'), el('th', { class: 'num' }, 'd měř'), el('th', { class: 'num' }, 'd vyp'), el('th', { class: 'num' }, 'Δd'), el('th', {}, ''))), el('tbody', {}, orr.radky.map((r) => {
                const pv = posud(r.v, ORIENTACE_MEZ), pd = r.dd != null ? posud(r.dd, kr.ud(r.dVyp)) : null; zhorsi(pv.stav); if (pd) zhorsi(pd.stav);
                prot += `  ${r.cislo.padEnd(10)} σ ${G(r.sigma)} g  v ${(r.v * 10000).toFixed(1).padStart(7)} cc${r.dd != null ? `  d ${P(r.dMer)} / ${P(r.dVyp)}  Δ ${P(r.dd)} (u_d ${fmt(kr.ud(r.dVyp))})  ${pd.stav}` : ''}\n`;
                return el('tr', {}, el('td', { class: 'cislo' }, r.cislo), el('td', { class: 'num' }, fmtG(r.sigma)), el('td', { class: 'num' }, (r.v * 10000).toFixed(1)), el('td', { class: 'num' }, fmt(r.dMer)), el('td', { class: 'num' }, fmt(r.dVyp)), el('td', { class: 'num' }, fmt(r.dd)), el('td', {}, sem(pd || pv, (pd || pv).stav)));
            })));
            extra = el('div', { class: 'tw' }, tabO);
        } else {
            // volné stanovisko
            const sD = orient.filter((r) => r.dv != null);
            if (sD.length < 2) return chyba(sek, 'Volné stanovisko potřebuje aspoň 2 orientace se směrem i délkou.');
            const c0 = { y: sD.reduce((a, r) => a + r.bod.y, 0) / sD.length, x: sD.reduce((a, r) => a + r.bod.x, 0) / sD.length }; const m = mRed(c0.y, c0.x);
            let r;
            try {
                if (metoda.inp.value === 'mnc') { const h = volneStanoviskoHelmert(sD.map((x) => ({ cislo: x.cislo, bod: x.bod, smer: x.hz, delka: x.dv * m }))); r = vyrovnaniStanoviska(h.S, orient.map((x) => ({ cislo: x.cislo, bod: x.bod, smer: x.hz, delka: x.dv != null ? x.dv * m : null }))); r.radkyH = r.radky.map((x) => ({ cislo: x.cislo, vy: x.vDelka ?? 0, vx: x.vSmer != null ? x.vSmer * x.d * Math.PI / 200 : 0, vp: Math.hypot(x.vDelka ?? 0, x.vSmer != null ? x.vSmer * x.d * Math.PI / 200 : 0) })); r.mxyV = r.mxy; }
                else { r = volneStanoviskoHelmert(sD.map((x) => ({ cislo: x.cislo, bod: x.bod, smer: x.hz, delka: x.dv * m }))); r.radkyH = r.radky; r.mxyV = r.mxy; }
            } catch (e) { return chyba(sek, e.message); }
            S = { cislo: s.stanovisko, y: r.S.y, x: r.S.x, z: Hst }; o = r.o;
            const pm = r.mxyV != null ? posud(r.mxyV, kr.mxy) : { stav: 'neposouzeno' }; zhorsi(pm.stav);
            kv.push(['Volné stanovisko', `${s.stanovisko}: Y ${fmt(S.y)}  X ${fmt(S.x)}`], ['Metoda', metoda.inp.value === 'mnc' ? 'vyrovnání MNČ' : 'Helmert shodnostní'], ['Orientační posun', fmtG(o) + ' g'], ['m_xy stanoviska', r.mxyV == null ? '— (2 body, bez nadbytku)' : fmt(r.mxyV) + ' m (mezní m_xy ' + fmt(kr.mxy) + ')']);
            prot += `volné stanovisko (${metoda.inp.value}): Y ${P(S.y)} X ${P(S.x)}   o ${G(o)} g   m_xy ${r.mxyV == null ? '—' : fmt(r.mxyV)}\n`;
            const tabO = el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Orientace'), el('th', { class: 'num' }, 'v_Y'), el('th', { class: 'num' }, 'v_X'), el('th', { class: 'num' }, 'v_p'), el('th', {}, ''))), el('tbody', {}, r.radkyH.map((x) => { const px = posud(x.vp, kr.uxy); zhorsi(px.stav); prot += `  ${x.cislo.padEnd(10)} v_Y ${P(x.vy)} v_X ${P(x.vx)} v_p ${P(x.vp)}  ${px.stav}\n`; return el('tr', {}, el('td', { class: 'cislo' }, x.cislo), el('td', { class: 'num' }, fmt(x.vy)), el('td', { class: 'num' }, fmt(x.vx)), el('td', { class: 'num' }, fmt(x.vp)), el('td', {}, sem(px, px.stav))); })));
            extra = el('div', { class: 'tw' }, tabO);
            vr.push({ typ: 'body', body: [{ ...S, cislo: s.stanovisko }] });
        }
        vr.push(...orient.map((r) => ({ typ: 'cara', body: [S, r.bod], carkovane: true })));
        const body = [];
        if (!jenVolne) {
            const m = mRed(S.y, S.x);
            const zam = rad.filter((r) => r.typ === 'z' && r.hz != null && r.dv != null && r.cislo);
            const vys = polarniBody(S, o, zam.map((r) => ({ cislo: r.cislo, smer: r.hz, delka: r.dv * m, kod: r.kod })));
            vys.forEach((b, i) => { const r = zam[i]; let z = null; if (vysky.checked && Hst != null && r.dh != null) z = trigVyska({ Hst, z: r.z, d: r.ds, sikma: (s.delky || 'sikme') === 'sikme', vp: s.vp || 0, vc: r.vc || 0 }).H; body.push({ cislo: b.cislo, y: b.y, x: b.x, z, kod: b.kod }); prot += `${b.cislo.padEnd(10)} Hz ${G(r.hz)}  d ${P(r.dv * m)}  →  Y ${P(b.y)} X ${P(b.x)}${z != null ? ' Z ' + P(z) : ''}  ${b.kod || ''}\n`; });
            vr.push({ typ: 'body', body: vys, r: 4 });
            if (!body.length) kv.push(['Podrobné body', 'žádné záměry (typ zám) s Hz a délkou']);
        } else if (S) body.push({ cislo: s.stanovisko, y: S.y, x: S.x, z: Hst });
        if (jenVolne && St0) kv.push(['Bod stanoviska už má souřadnice', `Y ${fmt(St0.y)} X ${fmt(St0.x)} — rozdíl ${fmt(Math.hypot(St0.y - S.y, St0.x - S.x))} m`]);
        vysledek(sek, { nazev: (jenVolne ? 'Volné stanovisko ' : 'Polární metoda ') + s.stanovisko, stav, kv, body, prot, vrstvy: vr, extra });
    }
}

registruj(FORMY, { hlavaFormu, bodPole, cisloPole, textPole, vyberPole, vysledek, chyba, sem });
registruj3(FORMY, ULOHY, { hlavaFormu, bodPole, cisloPole, textPole, vyberPole, vysledek, chyba, sem });
