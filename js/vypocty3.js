// Výpočty 3. část (podle Gromy 14): polární metoda dávkou přes celý zápisník (více průchodů, volná
// stanoviska, protínání ze směrů, dvojí určení, výšky), ortogonální dávkou, výška stanoviska, výpočet
// výšek, průsečíky, vyrovnávací přímka/kružnice, vytyčovací prvky, výškový pořad, transformace 5 st.
// volnosti a uživatelská, trasa, fasáda, kubatury, KM-D, sady tolerancí.
import { Projekt } from './projekt.js';
import { el, $, fmt, fmtG, cislo, toast, dialog, potvrd, ulozSoubor, otevriSoubor, ctiText } from './ui.js';
import { parseUhel, gonNorm, gonDiff } from '../geo/uhly.js';
import { smernik, delka, rajon, protinaniSmerniky, ortogonalni, patakolmice } from '../geo/zaklad.js';
import { orientaceStanoviska, polarniBody, volneStanoviskoHelmert, vyrovnaniStanoviska, protinaniZpet } from '../geo/stanovisko.js';
import { kriteria, posud } from '../geo/presnost.js';
import { trigVyska, redukceDelky, transformace } from '../geo/ostatni.js';
import { vyrovnavaciPrimka, vyrovnavaciKruznice, prusecikPrimekOdsazeni, prusecikPrimkaSmer, prusecikPrimkaKruznice, trasa, fasada, delaunay, orezObvod, kubatura, vyskovyPorad, kmdDosavadni, kmdNovy, transformace5, polarniVytycovaci, ortogonalniVytycovaci } from '../geo/vyrovnani.js';
import { ctiSeznam, odhadniPoradi } from './soubory.js';
import { vyhodnot } from './seznam-nastroje.js';
import { Protokol } from './protokol.js';

const P = (v, d = 3) => fmt(v, d).padStart(12);
const G = (v) => fmtG(v, 4).padStart(9);
const tdInp = (label, extra = {}) => el('td', {}, el('input', { type: 'text', 'aria-label': label, ...extra }));
const hodn = (tr, l) => tr.querySelector(`[aria-label=${l}]`).value.trim();

// ---------------- sady tolerancí (Groma: Nastavení → Tolerance; „Netestovat“) ----------------
export const TOLERANCE_VYCHOZI = { nazev: 'Katastr (kód 3)', minUhelProtnuti: 30, maxDelkaZamery: 1000, maxVzdalenostProtinani: 1500, orientaceSmer: 0.02, maxKolmice: 30, maxDelkaPrimky: 500, maxProdlouzeni: 0.5, poradMaxDelka: 1500, poradMaxStrana: 400, poradPomerStran: 3, poradMaxBodu: 15, testovat: true };
export const tolerance = () => ({ ...TOLERANCE_VYCHOZI, ...(Projekt.get().tolerance || {}) });
export async function sadyTolerance() {
    const p = Projekt.get(); const T = tolerance(); const F = {};
    const f = (k, t, j) => { F[k] = el('input', { type: 'text', id: 'tl-' + k, value: T[k] == null ? '' : String(T[k]).replace('.', ','), class: 'num' }); return el('label', { class: 'pole' }, el('span', {}, t + (j ? ' [' + j + ']' : '')), F[k]); };
    const test = el('input', { type: 'checkbox', id: 'tl-test', checked: T.testovat !== false });
    const ok = await dialog({ titulek: 'Sada tolerancí', sirka: 700, obsah: el('div', { style: 'display:grid;gap:10px' }, el('label', {}, test, ' testovat tolerance (vypnuto = sada „Netestovat“)'), el('p', { class: 'tlum', style: 'margin:0;font-size:12.5px' }, 'Prázdné pole = netestovat. Mezní odchylky katastru (u_xy, u_d, u_p) se berou z kódu kvality projektu a testují vždy.'),
        el('div', { class: 'radek' }, f('minUhelProtnuti', 'Minimální úhel protnutí', 'g'), f('maxVzdalenostProtinani', 'Max. vzdálenost od daného k určovanému', 'm'), f('maxDelkaZamery', 'Max. délka záměry (polární)', 'm'), f('orientaceSmer', 'Mezní odchylka orientace', 'g')),
        el('div', { class: 'radek' }, f('maxKolmice', 'Max. délka kolmice (orto)', 'm'), f('maxDelkaPrimky', 'Max. délka měřické přímky', 'm'), f('maxProdlouzeni', 'Max. prodloužení přímky (podíl)', ''), f('poradMaxDelka', 'Polygon: max. délka pořadu', 'm')),
        el('div', { class: 'radek' }, f('poradMaxStrana', 'Polygon: max. délka strany', 'm'), f('poradPomerStran', 'Polygon: max. poměr sousedních stran 1:n', ''), f('poradMaxBodu', 'Polygon: max. počet bodů', ''))),
        tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Uložit', hodnota: true, class: 'hlavni' }] });
    if (!ok) return;
    p.tolerance = { nazev: test.checked ? 'Uživatelská' : 'Netestovat', testovat: test.checked }; for (const k of Object.keys(F)) p.tolerance[k] = cislo(F[k].value);
    Projekt.zmena('projekt'); toast('Tolerance uloženy', 'ok');
}
/** Testy podle tolerancí: vrací pole hlášení „překročeno“ */
export function testTolerance(co, hodnota) { const T = tolerance(); if (T.testovat === false || T[co] == null || hodnota == null) return null; const prek = co === 'minUhelProtnuti' ? hodnota < T[co] : hodnota > T[co]; return prek ? { co, hodnota, mez: T[co] } : null; }

export function registruj3(FORMY, ULOHY, pom) {
    const { hlavaFormu, bodPole, cisloPole, textPole, vyberPole, vysledek, chyba, sem } = pom;
    ULOHY.push(
        { id: 'davka', skupina: 'Zápisník', nazev: 'Polární metoda dávkou', popis: 'Celý zápisník: orientace, volná stanoviska, protínání ze směrů, dvojí určení, výšky' },
        { id: 'vysky-davka', skupina: 'Zápisník', nazev: 'Výpočet výšek', popis: 'Jen výšky bodů se známou polohou ze zápisníku' },
        { id: 'vyska-stanoviska', skupina: 'Zápisník', nazev: 'Výška stanoviska', popis: 'Trigonometricky z orientací (zenit nebo převýšení)' },
        { id: 'orto-davka', skupina: 'Zápisník', nazev: 'Ortogonální metoda dávkou', popis: 'Stanoviska typu 0 z MAPA2 nebo ručně zadané přímky' },
        { id: 'prusecik', skupina: 'Souřadnicové', nazev: 'Průsečíky', popis: 'Přímka–přímka (s odsazením), přímka–směr, přímka–kružnice' },
        { id: 'vyr-primka', skupina: 'Souřadnicové', nazev: 'Vyrovnávací přímka', popis: 'MNČ přímka body, vzdálenosti, průměty' },
        { id: 'vyr-kruznice', skupina: 'Souřadnicové', nazev: 'Vyrovnávací kružnice', popis: 'MNČ kružnice (i s pevným poloměrem), průměty' },
        { id: 'vytyc', skupina: 'Vytyčování', nazev: 'Vytyčovací prvky', popis: 'Polární (směry, směrníky) a ortogonální, dávkově, do zápisníku' },
        { id: 'vysk-porad', skupina: 'Další', nazev: 'Výškový pořad', popis: 'Trigonometrický pořad s uzávěrem' },
        { id: 'transformace5', skupina: 'Další', nazev: 'Transformace 5 par. / uživatelská / klíč', popis: 'Afinní 5 st. volnosti, vlastní vztahy, hledání identických bodů ze souboru, uložení klíče' },
        { id: 'trasa', skupina: 'Silničář', nazev: 'Výpočet trasy', popis: 'Délky, směrníky, úhly, převýšení, odsazené body' },
        { id: 'fasada', skupina: 'Další', nazev: 'Fasáda', popis: 'Sklopení bodů svislé roviny do 2D' },
        { id: 'kubatury', skupina: 'Další', nazev: 'Kubatury', popis: 'Trojúhelníková síť (Delaunay), objem nad srovnávací rovinou' },
        { id: 'kmd', skupina: 'Katastr', nazev: 'Napojení změny do KM-D', popis: 'V dosavadním bodu / v novém bodu (KatV 16.27)' },
        { id: 'tolerance', skupina: 'Katastr', nazev: 'Sady tolerancí', popis: 'Úhel protnutí, délky záměr, orientace, polygon…' },
    );
    FORMY.tolerance = (sek) => { sadyTolerance(); sek.append(el('div', { class: 'prazdno' }, 'Tolerance se nastavují v dialogu; otevřít znovu: Výpočty → Sady tolerancí.')); };

    // ---------------- polární metoda dávkou ----------------
    FORMY.davka = (sek, ctx, u) => {
        const p = Projekt.get();
        const V = { vsechny: vyberPole('Orientace', 'dv-or', [['atribut', 'jen řádky označené jako orientace (OR)'], ['vsechny', 'všechny body se známými souřadnicemi']], 'atribut'), volne: el('input', { type: 'checkbox', id: 'dv-volne', checked: true }), prot: el('input', { type: 'checkbox', id: 'dv-prot', checked: true }), vysky: el('input', { type: 'checkbox', id: 'dv-vys', checked: true }), red: el('input', { type: 'checkbox', id: 'dv-red', checked: true }), dvoji: vyberPole('Dvojí určení bodu', 'dv-dvoji', [['prumer', 'průměr (Groma), rozdíl do protokolu'], ['prvni', 'ponechat první určení'], ['posledni', 'přepsat posledním']], 'prumer'), ulozit: el('input', { type: 'checkbox', id: 'dv-uloz', checked: true }) };
        const L = (i, t) => el('label', { style: 'display:flex;gap:8px;align-items:center' }, i, t);
        hlavaFormu(sek, u, el('div', { class: 'radek' }, V.vsechny, V.dvoji), L(V.volne, 'počítat volná stanoviska (Helmert) a protínání zpět'), L(V.prot, 'protínání ze směrů (bod jen směrově ze dvou stanovisek)'), L(V.vysky, 'počítat výšky (zenit, výška stroje a cíle)'), L(V.red, 'redukovat délky do S-JTSK (výška + zobrazení)'), L(V.ulozit, 'po výpočtu uložit body do seznamu'),
            el('div', {}, el('button', { class: 'btn hlavni', onclick: spocitej }, 'Výpočet celého zápisníku')));
        function spocitej() {
            const kod = p.kodKvality, kr = kriteria(kod), T = tolerance();
            const prot = [`polární metoda dávkou: ${p.zapisnik.length} stanovisek, kód kvality ${kod}, orientace: ${V.vsechny.inp.selectedOptions[0].textContent}`];
            const nove = new Map(); // cislo → { y, x, z, urceni: [] }
            const bod = (c) => { const b = Projekt.bod(c); if (b && b.y != null) return b; const n = nove.get(c); return n ? { cislo: c, y: n.y, x: n.x, z: n.z } : null; };
            const hotova = new Set(); let stanoviskaOk = 0, bodu = 0, nepouzito = 0, stav = 'ok';
            const zhorsi = (s) => { if (s === 'prekroceno') stav = 'prekroceno'; else if (s === 'varovani' && stav === 'ok') stav = 'varovani'; };
            const pridejUrceni = (c, y, x, z, jak) => { if (!nove.has(c)) nove.set(c, { y, x, z, urceni: [] }); const n = nove.get(c); n.urceni.push({ y, x, z, jak }); if (V.dvoji.inp.value === 'prumer') { n.y = n.urceni.reduce((s, u) => s + u.y, 0) / n.urceni.length; n.x = n.urceni.reduce((s, u) => s + u.x, 0) / n.urceni.length; const zs = n.urceni.filter((u) => u.z != null); n.z = zs.length ? zs.reduce((s, u) => s + u.z, 0) / zs.length : null; } else if (V.dvoji.inp.value === 'posledni') { n.y = y; n.x = x; n.z = z; } if (n.urceni.length > 1) { const a = n.urceni[n.urceni.length - 2], b = n.urceni[n.urceni.length - 1]; const dp = Math.hypot(a.y - b.y, a.x - b.x); const ps = posud(dp, kr.up); zhorsi(ps.stav); prot.push(`  dvojí určení ${c}: ${a.jak} / ${b.jak}  ΔY ${fmt(b.y - a.y)} ΔX ${fmt(b.x - a.x)} Δp ${fmt(dp)} (u_p ${fmt(kr.up)}) ${ps.stav}${a.z != null && b.z != null ? `  ΔZ ${fmt(b.z - a.z)}` : ''}`); } };
            const pruchody = [];
            for (let pr = 1; pr <= 5; pr++) {
                let spoc = 0;
                for (const s of p.zapisnik) {
                    if (hotova.has(s.id)) continue;
                    const rad = s.radky.map((r) => { const sik = (s.delky || 'sikme') === 'sikme'; let dv = r.ds, dh = null; if (r.ds != null && r.z != null) { dv = sik ? r.ds * Math.sin(r.z * Math.PI / 200) : r.ds; dh = sik ? r.ds * Math.cos(r.z * Math.PI / 200) : r.ds / Math.tan(r.z * Math.PI / 200); } return { ...r, dv, dh, bod: bod(r.cislo) }; });
                    const orient = rad.filter((r) => r.hz != null && r.bod && r.cislo !== s.stanovisko && (V.vsechny.inp.value === 'vsechny' || r.typ === 'o'));
                    let S = bod(s.stanovisko), o = null, jak = '';
                    const mRed = (Y, X) => V.red.checked ? redukceDelky(1, (S && S.z) || 0, Y, X).mCelkem : 1;
                    if (!S) {
                        if (!V.volne.checked) { continue; }
                        const sD = orient.filter((r) => r.dv != null);
                        try {
                            if (sD.length >= 2) { const c0 = { y: sD.reduce((a, r) => a + r.bod.y, 0) / sD.length, x: sD.reduce((a, r) => a + r.bod.x, 0) / sD.length }; const m = mRed(c0.y, c0.x); const h = volneStanoviskoHelmert(sD.map((r) => ({ cislo: r.cislo, bod: r.bod, smer: r.hz, delka: r.dv * m }))); S = { cislo: s.stanovisko, y: h.S.y, x: h.S.x, z: null }; o = h.o; jak = 'volné stanovisko'; prot.push(`\n== stanovisko ${s.stanovisko}: VOLNÉ STANOVISKO (Helmert) z ${sD.length} bodů: Y ${P(S.y)} X ${P(S.x)}  o ${G(o)} g  m_xy ${h.mxy == null ? '—' : fmt(h.mxy)}`); h.radky.forEach((x) => { const ps = posud(x.vp, kr.uxy); zhorsi(ps.stav); prot.push(`  ${x.cislo.padEnd(16)} v_Y ${P(x.vy)} v_X ${P(x.vx)} v_p ${P(x.vp)} ${ps.stav}`); }); }
                            else if (orient.length >= 3) { const r = protinaniZpet(orient.map((x) => ({ cislo: x.cislo, bod: x.bod, smer: x.hz }))); S = { cislo: s.stanovisko, y: r.S.y, x: r.S.x, z: null }; o = r.o; jak = 'protínání zpět'; prot.push(`\n== stanovisko ${s.stanovisko}: PROTÍNÁNÍ ZPĚT z ${orient.length} směrů: Y ${P(S.y)} X ${P(S.x)}  o ${G(o)} g${r.nebezpecny ? '  NEBEZPEČNÁ KRUŽNICE!' : ''}`); if (r.nebezpecny) zhorsi('prekroceno'); }
                            else continue; // v dalším průchodu
                        } catch (e) { prot.push(`\n== stanovisko ${s.stanovisko}: ${e.message}`); continue; }
                        // výška volného stanoviska z orientací
                        if (V.vysky.checked) { const hs = orient.filter((r) => r.dh != null && r.bod.z != null).map((r) => r.bod.z - r.dh - (s.vp || 0) + (r.vc || 0)); if (hs.length) { S.z = hs.reduce((a, b) => a + b, 0) / hs.length; prot.push(`  výška stanoviska z ${hs.length} orientací: ${P(S.z)}${hs.length > 1 ? ' (rozptyl ' + fmt(Math.max(...hs) - Math.min(...hs)) + ')' : ''}`); } }
                        pridejUrceni(s.stanovisko, S.y, S.x, S.z, jak);
                    } else {
                        if (!orient.length) { prot.push(`\n== stanovisko ${s.stanovisko}: žádná orientace se známými souřadnicemi — přeskočeno`); hotova.add(s.id); nepouzito += s.radky.length; continue; }
                        const m = mRed(S.y, S.x); const orr = orientaceStanoviska(S, orient.map((r) => ({ cislo: r.cislo, bod: r.bod, smer: r.hz, delka: r.dv != null ? r.dv * m : null }))); o = orr.o; jak = 'polární';
                        prot.push(`\n== stanovisko ${s.stanovisko}: Y ${P(S.y)} X ${P(S.x)}${S.z != null ? ' Z ' + P(S.z) : ''}  vp ${fmt(s.vp)}  orientační posun ${G(o)} g z ${orr.n} orientací${orr.mOr != null ? ', m_or ' + (orr.mOr * 10000).toFixed(1) + ' cc' : ''}`);
                        orr.radky.forEach((r) => { const pv = posud(r.v, T.testovat === false ? null : T.orientaceSmer); const pd = r.dd != null ? posud(r.dd, kr.ud(r.dVyp)) : null; zhorsi(pv.stav); if (pd) zhorsi(pd.stav); prot.push(`  or ${r.cislo.padEnd(16)} σ ${G(r.sigma)}  v ${(r.v * 10000).toFixed(1).padStart(7)} cc ${pv.stav}${r.dd != null ? `  d ${P(r.dMer)} / ${P(r.dVyp)} Δ ${P(r.dd)} (u_d ${fmt(kr.ud(r.dVyp))}) ${pd.stav}` : ''}`); });
                        if (V.vysky.checked && S.z == null) { const hs = orient.filter((r) => r.dh != null && r.bod.z != null).map((r) => r.bod.z - r.dh - (s.vp || 0) + (r.vc || 0)); if (hs.length) { S = { ...S, z: hs.reduce((a, b) => a + b, 0) / hs.length }; prot.push(`  výška stanoviska z orientací: ${P(S.z)}`); } }
                    }
                    // podrobné body
                    const m2 = mRed(S.y, S.x);
                    for (const r of rad) {
                        if (r.typ === 'o' || r.hz == null || !r.cislo || r.cislo === s.stanovisko) continue;
                        if (r.dv == null) { continue; } // jen směr → protínání ze směrů níže
                        const t = testTolerance('maxDelkaZamery', r.dv); if (t) { zhorsi('prekroceno'); prot.push(`  ${r.cislo}: délka záměry ${fmt(r.dv)} m > ${t.mez} m`); }
                        const b = polarniBody(S, o, [{ cislo: r.cislo, smer: r.hz, delka: r.dv * m2, kod: r.kod }])[0];
                        let z = null; if (V.vysky.checked && S.z != null && r.dh != null) z = S.z + (s.vp || 0) + r.dh - (r.vc || 0) + (1 - 0.13) * r.dv * r.dv / (2 * 6380703.6105);
                        pridejUrceni(r.cislo, b.y, b.x, z, 'polární z ' + s.stanovisko); bodu++;
                        prot.push(`  ${r.cislo.padEnd(16)} Hz ${G(r.hz)}  d ${P(r.dv * m2)}  →  Y ${P(b.y)} X ${P(b.x)}${z != null ? ' Z ' + P(z) : ''}  ${r.kod || ''}`);
                    }
                    s._o = o; s._S = S; s._rad = rad; hotova.add(s.id); spoc++; stanoviskaOk++;
                }
                pruchody.push(spoc); if (!spoc) break;
            }
            // protínání ze směrů: body jen směrově ze dvou stanovisek
            if (V.prot.checked) {
                const smerove = new Map();
                p.zapisnik.filter((s) => s._S).forEach((s) => s._rad.forEach((r) => { if (r.typ !== 'o' && r.hz != null && r.dv == null && r.cislo) { if (!smerove.has(r.cislo)) smerove.set(r.cislo, []); smerove.get(r.cislo).push({ s, r }); } }));
                for (const [c, arr] of smerove) {
                    if (arr.length < 2) { nepouzito++; prot.push(`  ${c}: jen směr z jednoho stanoviska — nelze určit`); continue; }
                    const [a, b] = arr; const r = protinaniSmerniky(a.s._S, gonNorm(a.r.hz + a.s._o), b.s._S, gonNorm(b.r.hz + b.s._o)); if (!r) continue;
                    const t = testTolerance('minUhelProtnuti', Math.min(r.gamma, 200 - r.gamma)); if (t) zhorsi('prekroceno');
                    const zs = [a, b].map((x) => V.vysky.checked && x.s._S.z != null && x.r.z != null ? x.s._S.z + (x.s.vp || 0) + Math.abs(x === a ? r.dA : r.dB) / Math.tan(x.r.z * Math.PI / 200) - (x.r.vc || 0) : null).filter((z) => z != null);
                    const z = zs.length ? zs.reduce((s, v) => s + v, 0) / zs.length : null;
                    pridejUrceni(c, r.bod.y, r.bod.x, z, `protínání ze směrů ${a.s.stanovisko}+${b.s.stanovisko}`); bodu++;
                    prot.push(`  ${c.padEnd(16)} protínání ze směrů ${a.s.stanovisko} + ${b.s.stanovisko}: úhel ${fmtG(Math.min(r.gamma, 200 - r.gamma), 2)} g${t ? ' < ' + t.mez + ' g!' : ''}  →  Y ${P(r.bod.y)} X ${P(r.bod.x)}${zs.length === 2 ? `  Z ${P(zs[0])} / ${P(zs[1])} ΔZ ${fmt(zs[0] - zs[1])} průměr ${P(z)}` : z != null ? ' Z ' + P(z) : ''}`);
                }
            }
            const nezpoc = p.zapisnik.filter((s) => !hotova.has(s.id)); nezpoc.forEach((s) => { prot.push(`\n== stanovisko ${s.stanovisko}: NEVYPOČTENO (bez souřadnic a bez dostatku orientací)`); nepouzito += s.radky.length; });
            p.zapisnik.forEach((s) => { delete s._o; delete s._S; delete s._rad; });
            prot.push(`\nprůchody: ${pruchody.join(' + ')} stanovisek; vypočteno ${stanoviskaOk} stanovisek, ${bodu} určení bodů, ${nove.size} bodů; nepoužito ${nepouzito} položek`);
            const body = [...nove.entries()].map(([c, n]) => { const ex = Projekt.bod(c); return { cislo: c, y: n.y, x: n.x, z: n.z, kod: (p.zapisnik.flatMap((s) => s.radky).find((r) => r.cislo === c) || {}).kod || (ex && ex.kod) || '' }; });
            vysledek(sek, { nazev: 'Polární metoda dávkou', stav, kv: [['Stanovisek vypočteno', `${stanoviskaOk} z ${p.zapisnik.length}`], ['Bodů', `${nove.size} (${bodu} určení)`], ['Nepoužito položek', nepouzito]], body, prot: prot.join('\n'), vrstvy: [{ typ: 'body', body, r: 3 }] });
            if (V.ulozit.checked && body.length) { let n = 0; body.forEach((b) => { const r = Projekt.ulozBod({ ...b, zdroj: 'vypocet', pozn: 'polární dávkou' }, V.dvoji.inp.value !== 'prvni'); if (r.pridano || r.prepsano) n++; }); Projekt.zmena('body'); toast(`Uloženo ${n} bodů`, 'ok'); }
        }
    };

    // ---------------- výpočet výšek (jen Z) a výška stanoviska ----------------
    FORMY['vysky-davka'] = (sek, ctx, u) => {
        const p = Projekt.get();
        hlavaFormu(sek, u, el('p', { class: 'tlum', style: 'margin:0' }, 'Pro každé stanovisko se známou výškou spočítá výšky bodů se známou polohou (trigonometricky ze zenitů, vp, vc, s refrakcí) a doplní je do seznamu.'), el('div', {}, el('button', { class: 'btn hlavni', onclick: () => {
            const prot = []; const body = []; let n = 0;
            for (const s of p.zapisnik) { const S = Projekt.bod(s.stanovisko); if (!S || S.z == null) { prot.push(`stanovisko ${s.stanovisko}: bez výšky — přeskočeno`); continue; } prot.push(`\n== ${s.stanovisko} Z ${P(S.z)} vp ${fmt(s.vp)}`);
                for (const r of s.radky) { const b = Projekt.bod(r.cislo); if (!b || r.ds == null || r.z == null || r.cislo === s.stanovisko) continue; const h = trigVyska({ Hst: S.z, z: r.z, d: r.ds, sikma: (s.delky || 'sikme') === 'sikme', vp: s.vp || 0, vc: r.vc || 0 }); body.push({ cislo: r.cislo, y: b.y, x: b.x, z: h.H, kod: b.kod }); n++; prot.push(`  ${r.cislo.padEnd(16)} z ${G(r.z)} d ${P(r.ds)} vc ${fmt(r.vc)}  →  H ${P(h.H)}${b.z != null ? `  (dosud ${P(b.z)}, rozdíl ${P(h.H - b.z)})` : ''}`); } }
            if (!n) return chyba(sek, 'Nic k výpočtu — stanoviska bez výšky nebo body bez polohy.');
            vysledek(sek, { nazev: 'Výpočet výšek ze zápisníku', stav: 'neposouzeno', kv: [['Bodů', n]], body, prot: prot.join('\n') });
        } }, 'Spočítat výšky')));
    };
    FORMY['vyska-stanoviska'] = (sek, ctx, u) => {
        const p = Projekt.get(); const sel = el('select', { id: 'vs-st' }, p.zapisnik.map((s) => el('option', { value: s.id }, s.stanovisko)));
        hlavaFormu(sek, u, el('label', { class: 'pole' }, el('span', {}, 'Stanovisko ze zápisníku'), sel), el('p', { class: 'tlum', style: 'margin:0;font-size:12.5px' }, 'Z každé orientace s výškou, zenitem (nebo převýšením Δh ze zpracování) a délkou se spočte výška stanoviska; výsledek je průměr, rozdíly do protokolu.'), el('div', {}, el('button', { class: 'btn hlavni', onclick: () => {
            const s = Projekt.stanovisko(sel.value); if (!s) return; const hs = [];
            for (const r of s.radky) { const b = Projekt.bod(r.cislo); if (!b || b.z == null || r.cislo === s.stanovisko) continue; let dh = r.dh; if (dh == null && r.ds != null && r.z != null) { const sik = (s.delky || 'sikme') === 'sikme'; const dv = sik ? r.ds * Math.sin(r.z * Math.PI / 200) : r.ds; dh = (sik ? r.ds * Math.cos(r.z * Math.PI / 200) : r.ds / Math.tan(r.z * Math.PI / 200)) + (1 - 0.13) * dv * dv / (2 * 6380703.6105) + (s.vp || 0) - (r.vc || 0); } if (dh == null) continue; hs.push({ cislo: r.cislo, H: b.z - dh }); }
            if (!hs.length) return chyba(sek, 'Žádná orientace s výškou a zenitem.'); const H = hs.reduce((a, h) => a + h.H, 0) / hs.length; const S = Projekt.bod(s.stanovisko);
            vysledek(sek, { nazev: 'Výška stanoviska ' + s.stanovisko, stav: hs.length > 1 && Math.max(...hs.map((h) => h.H)) - Math.min(...hs.map((h) => h.H)) > 0.1 ? 'varovani' : 'ok', kv: [['Výška (průměr)', fmt(H) + ' m z ' + hs.length], ...hs.map((h) => ['z ' + h.cislo, fmt(h.H) + ' m (' + fmt((h.H - H) * 1000, 0) + ' mm)'])], body: S ? [{ cislo: s.stanovisko, y: S.y, x: S.x, z: H, kod: S.kod }] : [], prot: `stanovisko ${s.stanovisko}, vp ${fmt(s.vp)}\n` + hs.map((h) => `  z ${h.cislo.padEnd(16)} H ${P(h.H)}  v ${P(h.H - H)}`).join('\n') + `\nprůměr H ${P(H)}` });
        } }, 'Spočítat')));
    };

    // ---------------- ortogonální dávkou ----------------
    FORMY['orto-davka'] = (sek, ctx, u) => {
        const p = Projekt.get(); const kand = p.zapisnik.filter((s) => s.ortogonalni);
        hlavaFormu(sek, u, el('p', { class: 'tlum', style: 'margin:0' }, `Ortogonální úlohy z MAPA2 (typ 0): ${kand.length}. Přímka = stanovisko (počátek) → orientace (koncový bod se staničením), body = staničení (sloupec délka) a kolmice (sloupec Hz).`), el('div', {}, el('button', { class: 'btn hlavni', onclick: () => {
            if (!kand.length) return chyba(sek, 'V zápisníku není žádná ortogonální úloha (typ 0 z MAPA2). Jednotlivou přímku spočítej v úloze Ortogonální metoda.');
            const prot = [], body = []; let stav = 'ok'; const kr = kriteria(p.kodKvality);
            for (const s of kand) { const A = Projekt.bod(s.stanovisko); const kon = s.radky.filter((r) => r.typ === 'o' && Projekt.bod(r.cislo)); if (!A || !kon.length) { prot.push(`přímka ${s.stanovisko}: chybí souřadnice počátku nebo koncového bodu`); continue; } const B = Projekt.bod(kon[0].cislo); const sMer = kon[0].ds; const dAB = delka(A, B); const rz = sMer != null ? sMer - dAB : null; const ps = rz != null ? posud(rz, kr.ud(dAB)) : { stav: 'neposouzeno' }; if (ps.stav === 'prekroceno') stav = 'prekroceno'; else if (ps.stav === 'varovani' && stav === 'ok') stav = 'varovani';
                prot.push(`\n== přímka ${s.stanovisko} → ${B.cislo}: ze souřadnic ${P(dAB)}${sMer != null ? `, měřeno ${P(sMer)}, rozdíl ${P(rz)} (u_d ${fmt(kr.ud(dAB))}) ${ps.stav}` : ''}`);
                for (const r of s.radky) { if (r.typ === 'o') continue; const st = r.ds, k = r.hz; if (st == null) continue; const t = testTolerance('maxKolmice', Math.abs(k || 0)); if (t) stav = 'prekroceno'; const o = ortogonalni(A, B, st, k || 0, sMer); body.push({ cislo: r.cislo, y: o.bod.y, x: o.bod.x, kod: r.kod }); prot.push(`  ${r.cislo.padEnd(16)} s ${P(st)}  k ${P(k || 0)}${t ? ' > ' + t.mez + ' m!' : ''}  →  Y ${P(o.bod.y)} X ${P(o.bod.x)}`); } }
            vysledek(sek, { nazev: 'Ortogonální metoda dávkou', stav, kv: [['Přímek', kand.length], ['Bodů', body.length]], body, prot: prot.join('\n'), vrstvy: [{ typ: 'body', body, r: 3 }] });
        } }, 'Výpočet')));
    };

    // ---------------- průsečíky ----------------
    FORMY.prusecik = (sek, ctx, u) => {
        const typ = vyberPole('Typ', 'pr-typ', [['pp', 'přímka – přímka (s odsazením)'], ['ps', 'přímka – směr ze stanoviska'], ['pk', 'přímka – kružnice (třemi body)']], 'pp');
        const A = bodPole('Přímka: bod A', 'pr-a'), B = bodPole('bod B', 'pr-b'), C = bodPole('Druhá přímka: bod C / stanovisko / kružnice 1', 'pr-c'), D = bodPole('bod D / kružnice 2', 'pr-d'), E = bodPole('kružnice 3', 'pr-e');
        const oAB = cisloPole('Odsazení AB (vpravo +)', 'pr-oab', '0', 'm'), oCD = cisloPole('Odsazení CD (vpravo +)', 'pr-ocd', '0', 'm'), smer = cisloPole('Směrník ze stanoviska (nebo Hz + orientace)', 'pr-sm', '', 'g'), orient = bodPole('Orientace (nepovinné, pak je směr = Hz)', 'pr-or'), hz0 = cisloPole('Hz na orientaci', 'pr-hz0', '0', 'g');
        const c = textPole('Číslo nového bodu', 'pr-c2', Projekt.volneCislo(1));
        hlavaFormu(sek, u, el('div', { class: 'radek' }, typ), el('div', { class: 'radek' }, A, B, oAB), el('div', { class: 'radek' }, C, D, E, oCD), el('div', { class: 'radek' }, smer, orient, hz0), el('div', { class: 'radek' }, c), el('div', {}, el('button', { class: 'btn hlavni', onclick: () => {
            const a = A.bod(), b = B.bod(); if (!a || !b) return chyba(sek, 'Body A a B musí být v seznamu.'); const cis = c.inp.value.trim(); let r, prot, vr = [{ typ: 'cara', body: [a, b], carkovane: true }], kv = [], stav = 'neposouzeno';
            if (typ.inp.value === 'pp') { const cc = C.bod(), d = D.bod(); if (!cc || !d) return chyba(sek, 'Body C a D musí být v seznamu.'); r = prusecikPrimekOdsazeni(a, b, cc, d, oAB.hodnota() || 0, oCD.hodnota() || 0); if (!r) return chyba(sek, 'Přímky jsou rovnoběžné.'); const t = testTolerance('minUhelProtnuti', r.uhel); stav = t ? 'prekroceno' : 'ok'; kv = [['Úhel protnutí', fmtG(r.uhel, 2) + ' g' + (t ? ' < ' + t.mez : '')], ['Leží na úsečce AB / CD', `${r.naAB ? 'ano' : 'ne'} / ${r.naCD ? 'ano' : 'ne'}`], ['Výška (z přímky AB)', r.bod.z == null ? '—' : fmt(r.bod.z)]]; vr.push({ typ: 'cara', body: [cc, d], carkovane: true }); prot = `A ${a.cislo} B ${b.cislo} odsazení ${fmt(oAB.hodnota() || 0)}; C ${cc.cislo} D ${d.cislo} odsazení ${fmt(oCD.hodnota() || 0)}\núhel protnutí ${fmtG(r.uhel, 2)} g; na AB: ${r.naAB}, na CD: ${r.naCD}\n${cis}: Y ${P(r.bod.y)} X ${P(r.bod.x)}${r.bod.z != null ? ' Z ' + P(r.bod.z) : ''}`; }
            else if (typ.inp.value === 'ps') { const S = C.bod(); if (!S) return chyba(sek, 'Stanovisko (C) musí být v seznamu.'); let sig = smer.uhel(); const O = orient.inp.value.trim() ? orient.bod() : null; if (O) sig = gonNorm(smernik(S, O) + (smer.uhel() || 0) - (hz0.uhel() || 0)); if (sig == null) return chyba(sek, 'Zadej směrník nebo Hz s orientací.'); r = prusecikPrimkaSmer(S, sig, a, b); if (!r) return chyba(sek, 'Směr je rovnoběžný s přímkou.'); const t = testTolerance('minUhelProtnuti', r.uhel); stav = t ? 'prekroceno' : 'ok'; kv = [['Směrník paprsku', fmtG(sig) + ' g'], ['Úhel protnutí', fmtG(r.uhel, 2) + ' g'], ['Vzdálenost od stanoviska', fmt(r.d) + ' m'], ['Na úsečce AB', r.naAB ? 'ano' : 'ne']]; vr.push({ typ: 'cara', body: [S, r.bod], carkovane: true }); prot = `stanovisko ${S.cislo}, směrník ${fmtG(sig)} g; přímka ${a.cislo}–${b.cislo}\n${cis}: Y ${P(r.bod.y)} X ${P(r.bod.x)}  úhel ${fmtG(r.uhel, 2)} g  d ${P(r.d)}`; }
            else { const k1 = C.bod(), k2 = D.bod(), k3 = E.bod(); if (!k1 || !k2 || !k3) return chyba(sek, 'Kružnici zadej třemi body ze seznamu.'); const kr = vyrovnavaciKruznice([k1, k2, k3]); const pr = prusecikPrimkaKruznice(a, b, kr.stred, kr.R); if (!pr.length) return chyba(sek, 'Přímka kružnici neprotíná.'); r = { bod: pr[0], druhy: pr[1] }; stav = 'ok'; kv = [['Střed kružnice', `Y ${fmt(kr.stred.y)} X ${fmt(kr.stred.x)}`], ['Poloměr', fmt(kr.R) + ' m'], ['Průsečíků', pr.length]]; vr.push({ typ: 'body', body: pr.map((q, i) => ({ ...q, cislo: i ? cis + 'b' : cis })), r: 5 }); prot = `kružnice ${k1.cislo} ${k2.cislo} ${k3.cislo}: střed Y ${P(kr.stred.y)} X ${P(kr.stred.x)} R ${P(kr.R)}\npřímka ${a.cislo}–${b.cislo}\n` + pr.map((q, i) => `${i ? cis + 'b' : cis}: Y ${P(q.y)} X ${P(q.x)}`).join('\n'); const body = pr.map((q, i) => ({ cislo: i ? cis + 'b' : cis, y: q.y, x: q.x })); vysledek(sek, { nazev: 'Průsečík přímka – kružnice', stav, kv, body, prot, vrstvy: vr }); return; }
            vysledek(sek, { nazev: 'Průsečík ' + cis, stav, kv, body: [{ cislo: cis, y: r.bod.y, x: r.bod.x, z: r.bod.z ?? null }], prot, vrstvy: [...vr, { typ: 'body', body: [{ ...r.bod, cislo: cis }] }] });
        } }, 'Spočítat')));
    };

    // ---------------- vyrovnávací přímka a kružnice ----------------
    const seznamBodu = (ta) => { const cis = ta.value.split(/[\s,;]+/).filter(Boolean); const body = cis.map((c) => Projekt.bod(c)); const chybi = cis.filter((c, i) => !body[i]); return { body: body.filter(Boolean), chybi }; };
    FORMY['vyr-primka'] = (sek, ctx, u) => {
        const def = el('textarea', { id: 'vp-def', rows: 2, placeholder: 'definiční body (čísla)' }), dal = el('textarea', { id: 'vp-dal', rows: 2, placeholder: 'další body jen k porovnání (nepovinné)' }), pre = textPole('Předčíslí/přípona průmětů', 'vp-pre', 'P');
        hlavaFormu(sek, u, el('label', { class: 'pole' }, el('span', {}, 'Definiční body'), def), el('label', { class: 'pole' }, el('span', {}, 'Další body (nepoužité pro určení přímky)'), dal), el('div', { class: 'radek' }, pre), el('div', {}, el('button', { class: 'btn hlavni', onclick: () => {
            const d = seznamBodu(def), o = seznamBodu(dal); if (d.chybi.length || o.chybi.length) return chyba(sek, 'Nejsou v seznamu: ' + [...d.chybi, ...o.chybi].join(', ')); if (d.body.length < 2) return chyba(sek, 'Aspoň 2 definiční body.');
            const r = vyrovnavaciPrimka(d.body, o.body); const kr = kriteria(Projekt.get().kodKvality); const stav = r.maxOdchylka > kr.uxy ? 'prekroceno' : r.maxOdchylka > 0.8 * kr.uxy ? 'varovani' : 'ok';
            const body = [{ cislo: 'ZP', ...r.zacatek }, { cislo: 'KP', ...r.konec }, ...r.definicni.map((x) => ({ cislo: x.cislo + pre.inp.value.trim(), ...x.pata })), ...r.dalsi.map((x) => ({ cislo: x.cislo + pre.inp.value.trim(), ...x.pata }))];
            const prot = `vyrovnávací přímka z ${d.body.length} bodů: směrník ${G(r.sigma)} g, délka ${P(r.delkaPrimky)}, m0 ${fmt(r.m0)}\nZP Y ${P(r.zacatek.y)} X ${P(r.zacatek.x)}\nKP Y ${P(r.konec.y)} X ${P(r.konec.x)}\n` + r.definicni.map((x) => `  ${x.cislo.padEnd(16)} vzdálenost ${P(x.k)}  průmět Y ${P(x.pata.y)} X ${P(x.pata.x)}`).join('\n') + (r.dalsi.length ? '\nnedefiniční:\n' + r.dalsi.map((x) => `  ${x.cislo.padEnd(16)} vzdálenost ${P(x.k)}  průmět Y ${P(x.pata.y)} X ${P(x.pata.x)}`).join('\n') : '');
            vysledek(sek, { nazev: 'Vyrovnávací přímka', stav, kv: [['Směrník', fmtG(r.sigma) + ' g'], ['Délka', fmt(r.delkaPrimky) + ' m'], ['m0 (kolmé vzdálenosti)', fmt(r.m0) + ' m'], ['Max. vzdálenost', fmt(r.maxOdchylka) + ' m (u_xy ' + fmt(kr.uxy) + ')']], body, prot, vrstvy: [{ typ: 'cara', body: [r.zacatek, r.konec] }, ...d.body.map((b, i) => ({ typ: 'cara', body: [b, r.definicni[i].pata], carkovane: true }))] });
        } }, 'Vyrovnat')));
    };
    FORMY['vyr-kruznice'] = (sek, ctx, u) => {
        const def = el('textarea', { id: 'vk-def', rows: 2, placeholder: 'definiční body (čísla)' }), dal = el('textarea', { id: 'vk-dal', rows: 2, placeholder: 'další body jen k porovnání' }), Rf = cisloPole('Pevný poloměr (nepovinné)', 'vk-r', '', 'm'), cs = textPole('Číslo středu', 'vk-s', 'S');
        hlavaFormu(sek, u, el('label', { class: 'pole' }, el('span', {}, 'Definiční body'), def), el('label', { class: 'pole' }, el('span', {}, 'Další body'), dal), el('div', { class: 'radek' }, Rf, cs), el('div', {}, el('button', { class: 'btn hlavni', onclick: () => {
            const d = seznamBodu(def), o = seznamBodu(dal); if (d.chybi.length || o.chybi.length) return chyba(sek, 'Nejsou v seznamu: ' + [...d.chybi, ...o.chybi].join(', '));
            let r; try { r = vyrovnavaciKruznice(d.body, o.body, Rf.hodnota()); } catch (e) { return chyba(sek, e.message); }
            const kr = kriteria(Projekt.get().kodKvality); const stav = r.maxOdchylka > kr.uxy ? 'prekroceno' : r.maxOdchylka > 0.8 * kr.uxy ? 'varovani' : 'ok';
            const body = [{ cislo: cs.inp.value.trim() || 'S', ...r.stred }, ...r.definicni.map((x) => ({ cislo: x.cislo + 'K', ...x.prumet })), ...r.dalsi.map((x) => ({ cislo: x.cislo + 'K', ...x.prumet }))];
            const prot = `vyrovnávací kružnice z ${d.body.length} bodů${Rf.hodnota() != null ? ' (pevný poloměr)' : ''}: střed Y ${P(r.stred.y)} X ${P(r.stred.x)}, R ${P(r.R)}, m0 ${fmt(r.m0)}\n` + r.definicni.map((x) => `  ${x.cislo.padEnd(16)} radiální vzdálenost ${P(x.d)}  průmět Y ${P(x.prumet.y)} X ${P(x.prumet.x)}`).join('\n') + (r.dalsi.length ? '\nnedefiniční:\n' + r.dalsi.map((x) => `  ${x.cislo.padEnd(16)} ${P(x.d)}`).join('\n') : '');
            const kruh = []; for (let g = 0; g <= 400; g += 4) kruh.push(rajon(r.stred, g, r.R));
            vysledek(sek, { nazev: 'Vyrovnávací kružnice', stav, kv: [['Střed', `Y ${fmt(r.stred.y)} X ${fmt(r.stred.x)}`], ['Poloměr', fmt(r.R) + ' m'], ['m0', fmt(r.m0) + ' m'], ['Max. vzdálenost', fmt(r.maxOdchylka) + ' m']], body, prot, vrstvy: [{ typ: 'cara', body: kruh }, { typ: 'body', body: [{ ...r.stred, cislo: 'S' }] }] });
        } }, 'Vyrovnat')));
    };

    // ---------------- vytyčovací prvky ----------------
    FORMY.vytyc = (sek, ctx, u) => {
        const p = Projekt.get();
        const typ = vyberPole('Typ', 'vt-typ', [['polar-smery', 'polární: orientace + směry'], ['polar-smerniky', 'polární: orientace + směrníky'], ['smerniky', 'jen směrníky a délky'], ['orto', 'ortogonální: staničení a kolmice od přímky']], 'polar-smery');
        const S = bodPole('Stanovisko / bod A přímky', 'vt-s'), O = bodPole('Orientace / bod B přímky', 'vt-o'), hz0 = cisloPole('Směr na orientaci', 'vt-hz0', '0', 'g'), mer = cisloPole('Měřítkový koeficient (délky v terénu = / m)', 'vt-m', '1', '');
        const ta = el('textarea', { id: 'vt-body', rows: 3, placeholder: 'čísla vytyčovaných bodů (mezerou); prázdné = všechny body v seznamu' }); const doZap = el('input', { type: 'checkbox', id: 'vt-zap' });
        hlavaFormu(sek, u, el('div', { class: 'radek' }, typ, mer), el('div', { class: 'radek' }, S, O, hz0), el('label', { class: 'pole' }, el('span', {}, 'Vytyčované body'), ta), el('label', {}, doZap, ' uložit vytyčovací prvky jako stanovisko do zápisníku (výpočet do zápisníku)'), el('div', {}, el('button', { class: 'btn hlavni', onclick: () => {
            const s = S.bod(); const o = O.inp.value.trim() ? O.bod() : null; if (typ.inp.value !== 'smerniky' && !s) return chyba(sek, 'Stanovisko / bod A musí být v seznamu.');
            const cis = ta.value.split(/[\s,;]+/).filter(Boolean); const body = cis.length ? cis.map((c) => Projekt.bod(c)).filter(Boolean) : p.body.filter((b) => b !== s && b !== o); if (!body.length) return chyba(sek, 'Žádné body.');
            const m = mer.hodnota() || 1; let prot = '', extra;
            if (typ.inp.value === 'orto') { if (!o) return chyba(sek, 'Bod B přímky musí být v seznamu.'); const r = ortogonalniVytycovaci(s, o, body, m); prot = `ortogonální vytyčovací prvky od přímky ${s.cislo} → ${o.cislo} (délka ${P(delka(s, o) / m)}), měřítko ${m}\n` + r.map((x) => `  ${x.cislo.padEnd(16)} staničení ${P(x.s)}  kolmice ${P(x.k)}  doměrek ${P(x.domerek)}`).join('\n'); extra = el('div', { class: 'tw' }, el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Bod'), el('th', { class: 'num' }, 'Staničení'), el('th', { class: 'num' }, 'Kolmice'), el('th', { class: 'num' }, 'Doměrek'))), el('tbody', {}, r.map((x) => el('tr', {}, el('td', { class: 'cislo' }, x.cislo), el('td', { class: 'num' }, fmt(x.s)), el('td', { class: 'num' }, fmt(x.k)), el('td', { class: 'num' }, fmt(x.domerek))))))); if (doZap.checked) { const st = Projekt.novyStanovisko(s.cislo); st.ortogonalni = true; st.pozn = 'vytyčovací prvky orto'; st.radky = [{ cislo: o.cislo, hz: 0, z: null, ds: delka(s, o) / m, vc: 0, kod: '', typ: 'o' }, ...r.map((x) => ({ cislo: x.cislo, hz: x.k, z: null, ds: x.s, vc: 0, kod: '', typ: 'z' }))]; Projekt.zmena('zapisnik'); } }
            else { if (typ.inp.value !== 'smerniky' && !o) return chyba(sek, 'Orientace musí být v seznamu.'); const r = polarniVytycovaci(s || body[0], typ.inp.value === 'smerniky' ? null : o, body, hz0.uhel() || 0, m); const smery = typ.inp.value === 'polar-smery'; prot = `polární vytyčovací prvky ze stanoviska ${s.cislo}${o ? ', orientace ' + o.cislo + ' (směrník ' + G(smernik(s, o)) + ' g, směr ' + G(hz0.uhel() || 0) + ')' : ''}, měřítko ${m}\n` + r.map((x) => `  ${x.cislo.padEnd(16)} ${smery ? 'směr ' + G(x.smer) : 'směrník ' + G(x.sigma)} g  délka ${P(x.d)}${x.dz != null ? '  Δh ' + P(x.dz) : ''}${x.zOrientace && typ.inp.value !== 'smerniky' ? `   z orientace: σ ${G(x.zOrientace.sigma)} d ${P(x.zOrientace.d)}` : ''}`).join('\n'); extra = el('div', { class: 'tw' }, el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Bod'), el('th', { class: 'num' }, smery ? 'Směr [g]' : 'Směrník [g]'), el('th', { class: 'num' }, 'Délka [m]'), el('th', { class: 'num' }, 'Δh'))), el('tbody', {}, r.map((x) => el('tr', {}, el('td', { class: 'cislo' }, x.cislo), el('td', { class: 'num' }, fmtG(smery ? x.smer : x.sigma)), el('td', { class: 'num' }, fmt(x.d)), el('td', { class: 'num' }, fmt(x.dz))))))); if (doZap.checked) { const st = Projekt.novyStanovisko(s.cislo); st.pozn = 'vytyčovací prvky'; st.delky = 'vodorovne'; st.radky = [...(o ? [{ cislo: o.cislo, hz: hz0.uhel() || 0, z: null, ds: delka(s, o) / m, vc: 0, kod: '', typ: 'o' }] : []), ...r.map((x) => ({ cislo: x.cislo, hz: smery ? x.smer : x.sigma, z: null, ds: x.d, vc: 0, kod: '', typ: 'z' }))]; Projekt.zmena('zapisnik'); } }
            vysledek(sek, { nazev: 'Vytyčovací prvky', stav: 'neposouzeno', kv: [['Bodů', body.length], ['Do zápisníku', doZap.checked ? 'uloženo jako stanovisko' : 'ne']], prot, extra, vrstvy: s ? body.map((b) => ({ typ: 'cara', body: [s, b], carkovane: true })) : [] });
        } }, 'Spočítat')));
    };

    // ---------------- výškový pořad ----------------
    FORMY['vysk-porad'] = (sek, ctx, u) => {
        const radky = el('tbody'); const tab = el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Z bodu'), el('th', {}, 'Na bod'), el('th', { class: 'num' }, 'Převýšení tam [m]'), el('th', { class: 'num' }, 'zpět [m] (nepov.)'), el('th', { class: 'num' }, 'Délka [m]'), el('th', {}, ''))), radky);
        const pridej = () => { const tr = el('tr'); tr.append(tdInp('a', { list: 'dl-body' }), tdInp('b', { list: 'dl-body' }), tdInp('dh', { class: 'num', inputmode: 'decimal' }), tdInp('dh2', { class: 'num', inputmode: 'decimal' }), tdInp('d', { class: 'num', inputmode: 'decimal' }), el('td', { class: 'akce' }, el('button', { class: 'ikona', onclick: () => tr.remove() }, '✕'))); radky.append(tr); };
        for (let i = 0; i < 4; i++) pridej();
        const hz = cisloPole('Výška počátečního bodu (prázdné = ze seznamu)', 'vpo-hz', '', 'm'), hk = cisloPole('Výška koncového bodu (prázdné = ze seznamu / bez uzávěru)', 'vpo-hk', '', 'm'), mez = cisloPole('Mezní odchylka uzávěru', 'vpo-mez', '', 'm');
        hlavaFormu(sek, u, el('div', { class: 'radek' }, hz, hk, mez), el('div', { class: 'tw' }, tab), el('div', { style: 'display:flex;gap:8px' }, el('button', { class: 'btn maly', onclick: pridej }, '+ Úsek'), el('button', { class: 'btn hlavni', onclick: () => {
            const useky = []; for (const tr of radky.rows) { const a = hodn(tr, 'a'), b = hodn(tr, 'b'), dh = cislo(hodn(tr, 'dh')), dh2 = cislo(hodn(tr, 'dh2')), d = cislo(hodn(tr, 'd')); if (!a || !b || dh == null) continue; useky.push({ od: a, do: b, dh: dh2 != null ? (dh - dh2) / 2 : dh, tam: dh, zpet: dh2, d: d || 1 }); }
            if (!useky.length) return chyba(sek, 'Zadej úseky.'); const A = Projekt.bod(useky[0].od), B = Projekt.bod(useky[useky.length - 1].do); const Hz = hz.hodnota() ?? (A && A.z); if (Hz == null) return chyba(sek, 'Výška počátečního bodu není známa.'); const Hk = hk.hodnota() ?? (B && B.z != null ? B.z : null);
            const r = vyskovyPorad(useky, Hz, Hk, mez.hodnota());
            const body = r.vysky.map((v) => { const b = Projekt.bod(v.cislo); return { cislo: v.cislo, y: b ? b.y : null, x: b ? b.x : null, z: v.H }; });
            const prot = `výškový pořad ${useky[0].od} → ${useky[useky.length - 1].do}: H začátek ${P(Hz)}${Hk != null ? ', H konec ' + P(Hk) : ''}\n` + useky.map((x) => `  ${x.od.padEnd(12)} → ${x.do.padEnd(12)} Δh ${P(x.tam)}${x.zpet != null ? ' / ' + P(x.zpet) + ' rozdíl ' + P(x.tam + x.zpet) : ''}  d ${P(x.d)}`).join('\n') + `\nsoučet ${P(r.suma)}${r.uzaver != null ? `, uzávěr ${P(r.uzaver)}${r.mezni != null ? ' (mezní ' + fmt(r.mezni) + ')' : ''} ${r.stav}` : ''}\n` + r.vysky.map((v) => `  ${v.cislo.padEnd(16)} H ${P(v.H)}`).join('\n');
            vysledek(sek, { nazev: 'Výškový pořad', stav: r.stav, kv: [['Součet převýšení', fmt(r.suma) + ' m'], ['Uzávěr', r.uzaver == null ? '—' : fmt(r.uzaver * 1000, 1) + ' mm' + (r.mezni != null ? ' (mezní ' + fmt(r.mezni * 1000, 0) + ' mm)' : '')]], body: body.filter((b) => b.y != null), prot, extra: body.some((b) => b.y == null) ? el('p', { class: 'tlum' }, 'Body bez polohy v seznamu (' + body.filter((b) => b.y == null).map((b) => b.cislo).join(', ') + ') se uloží jen s výškou po doplnění polohy.') : null });
        } }, 'Spočítat')));
    };

    // ---------------- transformace 5 par. / uživatelská / klíč ----------------
    FORMY.transformace5 = (sek, ctx, u) => {
        const p = Projekt.get();
        const typ = vyberPole('Typ', 't5-typ', [['afinni5', 'afinní 5 stupňů volnosti (rotace, 2 měřítka, 2 posuny)'], ['helmert', 'podobnostní (klíč k uložení)'], ['shodnostni', 'shodnostní'], ['afinni', 'afinní 6'], ['uziv', 'uživatelská (vlastní vztahy)']], 'afinni5');
        const vY = textPole('Y’ =', 't5-vy', 'Y + 0'), vX = textPole('X’ =', 't5-vx', 'X + 0'), vZ = textPole('Z’ =', 't5-vz', 'Z');
        const radky = el('tbody'); const tab = el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Bod'), el('th', { class: 'num' }, 'Y zdroj'), el('th', { class: 'num' }, 'X zdroj'), el('th', {}, 'Cíl (ze seznamu)'), el('th', {}, ''))), radky);
        const pridej = (c = '', y = '', x = '', cil = '') => { const tr = el('tr'); tr.append(tdInp('c', { value: c }), tdInp('y', { value: y, class: 'num' }), tdInp('x', { value: x, class: 'num' }), tdInp('cil', { value: cil, list: 'dl-body' }), el('td', { class: 'akce' }, el('button', { class: 'ikona', onclick: () => tr.remove() }, '✕'))); radky.append(tr); };
        for (let i = 0; i < 4; i++) pridej();
        const ignor = el('input', { type: 'checkbox', id: 't5-ign' }); const dalsi = el('textarea', { id: 't5-dalsi', rows: 4, placeholder: 'body k transformaci: číslo Y X [Z] [kód] — nebo prázdné = transformovat označené/všechny body seznamu' });
        let klic = null;
        hlavaFormu(sek, u, el('div', { class: 'radek' }, typ), el('div', { class: 'radek', id: 't5-uziv' }, vY, vX, vZ), el('h3', {}, 'Identické body'), el('div', { class: 'tw' }, tab),
            el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center' }, el('button', { class: 'btn maly', onclick: () => pridej() }, '+ Bod'), el('button', { class: 'btn maly', onclick: async () => { const f = await otevriSoubor(''); if (!f) return; const t = await ctiText(f); const s = ctiSeznam(t, odhadniPoradi(t.split(/\r?\n/))); let n = 0; s.body.forEach((b) => { const c = ignor.checked ? p.body.find((x) => x.cislo.replace(/^0+/, '').endsWith(b.cislo.replace(/^0+/, '')) || b.cislo.endsWith(x.cislo)) : Projekt.bod(b.cislo); if (c) { pridej(b.cislo, fmt(b.y), fmt(b.x), c.cislo); n++; } }); toast(`Nalezeno ${n} identických bodů`, 'ok'); } }, 'Vyhledat identické body ze souboru (zdrojové souřadnice)'), el('label', {}, ignor, ' ignorovat předčíslí'),
                el('button', { class: 'btn maly', onclick: () => { if (!klic) { toast('Nejdřív spočítej klíč'); return; } ulozSoubor('transformacni-klic.json', JSON.stringify(klic, null, 1)); } }, 'Uložit klíč'), el('button', { class: 'btn maly', onclick: async () => { const f = await otevriSoubor(''); if (!f) return; try { klic = JSON.parse(await ctiText(f)); typ.inp.value = klic.typ; toast('Klíč načten: ' + klic.typ, 'ok'); } catch { toast('Soubor není klíč', 'bad'); } } }, 'Načíst klíč')),
            el('label', { class: 'pole' }, el('span', {}, 'Body k transformaci'), dalsi), el('div', {}, el('button', { class: 'btn hlavni', onclick: spocitej }, 'Transformovat')));
        function spocitej() {
            const T = typ.inp.value; let tr, param = {}, radkyV = [], m0 = null;
            if (T === 'uziv') { tr = (b) => ({ y: +vyhodnot(vY.inp.value, { cislo: '', y: b.y, x: b.x, z: b.z }), x: +vyhodnot(vX.inp.value, { cislo: '', y: b.y, x: b.x, z: b.z }), z: b.z != null ? +vyhodnot(vZ.inp.value || 'Z', { cislo: '', y: b.y, x: b.x, z: b.z }) : null }); param = { Y: vY.inp.value, X: vX.inp.value, Z: vZ.inp.value }; }
            else if (klic && klic.typ === T && klic.tr) { tr = klicFn(klic); param = klic.param; }
            else { const id = []; for (const r of radky.rows) { const y = cislo(hodn(r, 'y')), x = cislo(hodn(r, 'x')), c = Projekt.bod(hodn(r, 'cil')); if (y != null && x != null && c) id.push({ cislo: hodn(r, 'c') || c.cislo, z: { y, x }, c }); }
                let res; try { res = T === 'afinni5' ? transformace5(id) : transformace(id, T); } catch (e) { return chyba(sek, e.message); } tr = res.transformuj; param = res.param; radkyV = res.radky; m0 = res.m0; klic = { typ: T, param, tr: T === 'afinni5' ? { cz: param.tezisteZdroj, cc: param.tezisteCil, th: param.rotaceGon * Math.PI / 200, my: param.meritkoY, mx: param.meritkoX, ty: param.ty, tx: param.tx } : T === 'afinni' ? param : { cz: param.tezisteZdroj, cc: param.tezisteCil, th: param.rotaceGon * Math.PI / 200, q: param.meritko } }; }
            const kr = kriteria(p.kodKvality); let stav = radkyV.length ? 'ok' : 'neposouzeno'; radkyV.forEach((x) => { const ps = posud(x.vp, kr.uxy); if (ps.stav === 'prekroceno') stav = 'prekroceno'; else if (ps.stav === 'varovani' && stav === 'ok') stav = 'varovani'; });
            const vstup = dalsi.value.trim() ? dalsi.value.split(/\r?\n/).map((l) => { const c = l.trim().split(/[\s;]+/); return c.length >= 3 ? { cislo: c[0], y: cislo(c[1]), x: cislo(c[2]), z: c[3] != null ? cislo(c[3]) : null, kod: c.slice(4).join(' ') } : null; }).filter((b) => b && b.y != null) : p.body.map((b) => ({ ...b }));
            const body = vstup.map((b) => { const t = tr(b); return { cislo: b.cislo, y: t.y, x: t.x, z: t.z !== undefined ? t.z : b.z, kod: b.kod }; });
            const prot = `transformace ${T}: ${JSON.stringify(param)}\n${radkyV.map((x) => `  ${x.cislo.padEnd(16)} v_Y ${P(x.vy)} v_X ${P(x.vx)} v_p ${P(x.vp)}`).join('\n')}${m0 != null ? `\nm0 ${fmt(m0)} m` : ''}\n` + body.map((b) => `${b.cislo.padEnd(16)} → Y ${P(b.y)} X ${P(b.x)}`).join('\n');
            vysledek(sek, { nazev: 'Transformace ' + T, stav, kv: [['Identických bodů', radkyV.length], ['m0', m0 == null ? '—' : fmt(m0) + ' m'], ['Parametry', T === 'afinni5' ? `rotace ${fmtG(param.rotaceGon)} g, mY ${param.meritkoY.toFixed(8)}, mX ${param.meritkoX.toFixed(8)}` : T === 'uziv' ? `${param.Y} · ${param.X}` : param.rotaceGon != null ? `rotace ${fmtG(param.rotaceGon)} g, měřítko ${(param.meritko || 1).toFixed(8)}` : JSON.stringify(param)]], body, prot });
        }
        function klicFn(k) { const t = k.tr; if (k.typ === 'afinni') return (b) => ({ y: t.a * b.y + t.b * b.x + t.c, x: t.d * b.y + t.e * b.x + t.f }); const c = Math.cos(t.th), s = Math.sin(t.th); if (k.typ === 'afinni5') return (b) => { const zy = b.y - t.cz.y, zx = b.x - t.cz.x; return { y: t.cc.y + t.ty + c * t.my * zy + s * t.mx * zx, x: t.cc.x + t.tx - s * t.my * zy + c * t.mx * zx }; }; return (b) => { const zy = b.y - t.cz.y, zx = b.x - t.cz.x; return { y: t.cc.y + t.q * (c * zy + s * zx), x: t.cc.x + t.q * (c * zx - s * zy) }; }; }
    };

    // ---------------- trasa, fasáda, kubatury ----------------
    FORMY.trasa = (sek, ctx, u) => {
        const ta = el('textarea', { id: 'tr-body', rows: 3, placeholder: 'body trasy v pořadí (čísla)' }), od = cisloPole('Odsazení vlevo/vpravo (0 = žádné)', 'tr-od', '0', 'm'), cisl = vyberPole('Číslování odsazených bodů', 'tr-cis', [['pripona', 'původní číslo + L / P'], ['prubezne', 'nová řada průběžně (vlevo, pak vpravo)'], ['stridave', 'nová řada střídavě']], 'pripona'), od0 = cisloPole('Nová řada od', 'tr-od0', '1', '');
        hlavaFormu(sek, u, el('label', { class: 'pole' }, el('span', {}, 'Body trasy'), ta), el('div', { class: 'radek' }, od, cisl, od0), el('div', {}, el('button', { class: 'btn hlavni', onclick: () => {
            const d = seznamBodu(ta); if (d.chybi.length) return chyba(sek, 'Nejsou v seznamu: ' + d.chybi.join(', ')); if (d.body.length < 2) return chyba(sek, 'Aspoň 2 body.');
            const r = trasa(d.body, od.hodnota() || 0); let n = od0.hodnota() || 1; let odsaz = [];
            if (r.vlevo.length) { if (cisl.inp.value === 'pripona') odsaz = [...r.vlevo, ...r.vpravo]; else if (cisl.inp.value === 'prubezne') odsaz = [...r.vlevo, ...r.vpravo].map((b) => ({ ...b, cislo: String(n++) })); else odsaz = r.vlevo.flatMap((l, i) => [{ ...l, cislo: String(n++) }, { ...r.vpravo[i], cislo: String(n++) }]); }
            const prot = `trasa ${d.body.map((b) => b.cislo).join(' – ')}: délka ${P(r.delka)}\n` + r.seg.map((s, i) => `  ${s.od.padEnd(12)} → ${s.do.padEnd(12)} d ${P(s.d)}  σ ${G(s.sigma)} g${s.dh != null ? `  Δh ${P(s.dh)}  sklon ${fmt(s.sklon, 2)} %` : ''}  st ${P(r.stanicen[i + 1])}`).join('\n') + (r.vrcholy.length ? '\nvrcholové úhly (levé):\n' + r.vrcholy.map((v) => `  ${v.cislo.padEnd(16)} ω ${G(v.levy)} g  lom ${G(v.lom)}`).join('\n') : '') + (odsaz.length ? '\nodsazené body:\n' + odsaz.map((b) => `  ${b.cislo.padEnd(16)} Y ${P(b.y)} X ${P(b.x)}`).join('\n') : '');
            vysledek(sek, { nazev: 'Výpočet trasy', stav: 'neposouzeno', kv: [['Délka trasy', fmt(r.delka) + ' m'], ['Úseků', r.seg.length]], body: odsaz, prot, vrstvy: [{ typ: 'cara', body: d.body, sirka: 2 }, ...(r.vlevo.length ? [{ typ: 'cara', body: r.vlevo, carkovane: true }, { typ: 'cara', body: r.vpravo, carkovane: true }] : [])] });
        } }, 'Spočítat')));
    };
    FORMY.fasada = (sek, ctx, u) => {
        const L = bodPole('Levý bod fasády', 'fa-l'), R = bodPole('Pravý bod fasády', 'fa-p'), ta = el('textarea', { id: 'fa-body', rows: 3, placeholder: 'body na fasádě (čísla) s výškou Z' }), pre = textPole('Předčíslí/přípona výstupu', 'fa-pre', 'F');
        hlavaFormu(sek, u, el('div', { class: 'radek' }, L, R, pre), el('label', { class: 'pole' }, el('span', {}, 'Body'), ta), el('p', { class: 'tlum', style: 'margin:0;font-size:12.5px' }, 'Výstup: Y = staničení po fasádě od levého bodu, X = výška bodu (Z), kolmá vzdálenost od roviny do protokolu. Načte se do 2D CADu jako pohled.'), el('div', {}, el('button', { class: 'btn hlavni', onclick: () => {
            const l = L.bod(), r = R.bod(); if (!l || !r) return chyba(sek, 'Levý a pravý bod musí být v seznamu.'); const d = seznamBodu(ta); if (d.chybi.length) return chyba(sek, 'Nejsou v seznamu: ' + d.chybi.join(', '));
            const out = fasada(l, r, d.body); const body = out.map((b) => ({ cislo: b.cislo + pre.inp.value.trim(), y: b.y, x: b.x, kod: b.kod }));
            vysledek(sek, { nazev: 'Fasáda ' + l.cislo + ' → ' + r.cislo, stav: 'neposouzeno', kv: [['Bodů', body.length], ['Délka fasády', fmt(delka(l, r)) + ' m']], body, prot: `fasáda ${l.cislo} → ${r.cislo} (${P(delka(l, r))} m)\n` + out.map((b) => `  ${b.cislo.padEnd(16)} stan ${P(b.y)}  výška ${P(b.x)}  odstup od roviny ${P(b.k)}`).join('\n') });
        } }, 'Sklopit')));
    };
    FORMY.kubatury = (sek, ctx, u) => {
        const ta = el('textarea', { id: 'ku-body', rows: 3, placeholder: 'body povrchu s výškou (čísla); prázdné = všechny body s výškou' }), H = cisloPole('Výška srovnávací roviny', 'ku-h', '', 'm'), orez = cisloPole('Odstranit obvodové trojúhelníky s poměrem strana/výška >', 'ku-orez', '20', ''), popis = textPole('Popis kubatury', 'ku-popis', 'Kubatura');
        hlavaFormu(sek, u, el('label', { class: 'pole' }, el('span', {}, 'Body'), ta), el('div', { class: 'radek' }, H, orez, popis), el('div', {}, el('button', { class: 'btn hlavni', onclick: () => {
            const p = Projekt.get(); const d = ta.value.trim() ? seznamBodu(ta) : { body: p.body.filter((b) => b.z != null && b.y != null), chybi: [] }; if (d.chybi.length) return chyba(sek, 'Nejsou v seznamu: ' + d.chybi.join(', ')); const body = d.body.filter((b) => b.z != null); if (body.length < 3) return chyba(sek, 'Aspoň 3 body s výškou.'); const Hs = H.hodnota(); if (Hs == null) return chyba(sek, 'Zadej výšku srovnávací roviny.');
            let tri = delaunay(body); const pred = tri.length; if (orez.hodnota() > 0) tri = orezObvod(body, tri, orez.hodnota()); const k = kubatura(body, tri, Hs);
            const hrany = []; tri.forEach(([a, b, c]) => hrany.push({ typ: 'cara', body: [body[a], body[b], body[c]], uzavrit: true, sirka: 1 }));
            vysledek(sek, { nazev: popis.inp.value.trim() || 'Kubatura', stav: 'neposouzeno', kv: [['Objem nad rovinou ' + fmt(Hs, 2), fmt(k.objem, 1) + ' m³'], ['Plocha (půdorys)', fmt(k.plocha, 1) + ' m²'], ['Povrch', fmt(k.povrch, 1) + ' m²'], ['Trojúhelníků', `${tri.length} (odstraněno ${pred - tri.length} obvodových)`]], prot: `${popis.inp.value}: ${body.length} bodů, ${tri.length} trojúhelníků, srovnávací rovina ${fmt(Hs, 2)} m\nobjem ${fmt(k.objem, 1)} m³  půdorys ${fmt(k.plocha, 1)} m²  povrch ${fmt(k.povrch, 1)} m²\n` + tri.map(([a, b, c]) => `  ${body[a].cislo} ${body[b].cislo} ${body[c].cislo}`).join('\n'), vrstvy: hrany });
        } }, 'Vytvořit síť a spočítat')));
    };

    // ---------------- KM-D ----------------
    FORMY.kmd = (sek, ctx, u) => {
        const typ = vyberPole('Způsob', 'kmd-typ', [['dosavadni', 'v dosavadním bodu (16.27 b) 1)'], ['novy', 'v novém bodu na dosavadní hranici (16.27 b) 2)']], 'dosavadni');
        const D = bodPole('Dosavadní bod (platné souřadnice) / hranice A', 'kmd-d'), N = bodPole('Nově zaměřený bod / hranice B', 'kmd-n'), B = bodPole('Druhý bod nové hranice / nový bod N', 'kmd-b'), C = bodPole('Druhý bod nové hranice C (jen nový bod)', 'kmd-c'), dm = cisloPole('Délka nové hranice měřená v terénu', 'kmd-dm', '', 'm'), cis = textPole('Číslo vyrovnaného bodu', 'kmd-cis', '');
        hlavaFormu(sek, u, el('div', { class: 'radek' }, typ), el('div', { class: 'radek' }, D, N), el('div', { class: 'radek' }, B, C), el('div', { class: 'radek' }, dm, cis), el('p', { class: 'tlum', style: 'margin:0;font-size:12.5px' }, 'Dosavadní bod: nová hranice se napojí do platného bodu, rozdíl proti novému zaměření se posoudí proti u_xy / u_p. Nový bod: podle úhlu protnutí (> 50 g průsečík, jinak kolmý průmět) se nový bod vyrovná na dosavadní hranici.'), el('div', {}, el('button', { class: 'btn hlavni', onclick: () => {
            const kr = kriteria(Projekt.get().kodKvality);
            if (typ.inp.value === 'dosavadni') { const d = D.bod(), n = N.bod(), b = B.bod(); if (!d || !n || !b) return chyba(sek, 'Zadej dosavadní bod, nové zaměření a druhý bod hranice.'); const r = kmdDosavadni(d, n, b, dm.hodnota()); const pp = posud(r.dp, kr.up), py = posud(r.dY, kr.uxy), px = posud(r.dX, kr.uxy), pd = r.rozdilDelky != null ? posud(r.rozdilDelky, kr.ud(r.dVyp)) : null; const stav = [pp, py, px, pd].filter(Boolean).some((x) => x.stav === 'prekroceno') ? 'prekroceno' : [pp, py, px, pd].filter(Boolean).some((x) => x.stav === 'varovani') ? 'varovani' : 'ok';
                vysledek(sek, { nazev: 'Napojení změny v dosavadním bodu ' + d.cislo, stav, kv: [['Rozdíl ΔY / ΔX', `${fmt(r.dY)} / ${fmt(r.dX)} m (u_xy ${fmt(kr.uxy)})`], ['Polohový rozdíl Δp', `${fmt(r.dp)} m (u_p ${fmt(kr.up)}) — ${pp.stav}`], ['Délka nové hranice ze souřadnic', fmt(r.dVyp) + ' m'], ['Měřená délka / rozdíl', r.dMer == null ? '—' : `${fmt(r.dMer)} / ${fmt(r.rozdilDelky)} m (u_d ${fmt(kr.ud(r.dVyp))}) — ${pd.stav}`]], body: [{ cislo: cis.inp.value.trim() || n.cislo, y: d.y, x: d.x, z: n.z, kod: n.kod, pozn: 'napojeno do dosavadního bodu ' + d.cislo }], prot: `napojení změny do KM-D v dosavadním bodu (KatV 16.27 b) 1), kód kvality ${kr.kod}\ndosavadní bod ${d.cislo}: Y ${P(d.y)} X ${P(d.x)}\nnové zaměření ${n.cislo}: Y ${P(n.y)} X ${P(n.x)}\nΔY ${P(r.dY)} ΔX ${P(r.dX)} Δp ${P(r.dp)} (u_p ${fmt(kr.up)}) ${pp.stav}\nnová hranice ${d.cislo} – ${b.cislo}: ze souřadnic ${P(r.dVyp)}${r.dMer != null ? `, měřeno ${P(r.dMer)}, rozdíl ${P(r.rozdilDelky)} (u_d ${fmt(kr.ud(r.dVyp))}) ${pd.stav}` : ''}\nvyrovnaný bod = dosavadní bod ${d.cislo}`, vrstvy: [{ typ: 'cara', body: [d, b] }, { typ: 'cara', body: [n, d], carkovane: true }] }); }
            else { const a = D.bod(), b = N.bod(), n = B.bod(), c = C.bod(); if (!a || !b || !n || !c) return chyba(sek, 'Zadej hranici A–B, nový bod N a druhý bod nové hranice C.'); const r = kmdNovy(a, b, n, c, dm.hodnota()); if (!r.bod) return chyba(sek, 'Hranice jsou rovnoběžné.'); const pd = r.rozdilDelky != null ? posud(r.rozdilDelky, kr.ud(r.dVyp)) : null; const posunPos = r.posun != null ? posud(r.posun, kr.uxy) : null; const stav = [pd, posunPos].filter(Boolean).some((x) => x.stav === 'prekroceno') ? 'prekroceno' : [pd, posunPos].filter(Boolean).some((x) => x.stav === 'varovani') ? 'varovani' : 'ok';
                vysledek(sek, { nazev: 'Napojení změny v novém bodu', stav, kv: [['Úhel protnutí hranic', fmtG(r.uhel, 2) + ' g → ' + r.zpusob], ['Posun bodu na hranici', r.posun == null ? '—' : fmt(r.posun) + ' m (u_xy ' + fmt(kr.uxy) + ')'], ['Leží na úsečce A–B', r.naUsecce ? 'ano' : 'NE — mimo dosavadní hranici'], ['Délka nové hranice ze souřadnic', fmt(r.dVyp) + ' m'], ['Měřená / rozdíl', r.dMer == null ? '—' : `${fmt(r.dMer)} / ${fmt(r.rozdilDelky)} m (u_d ${fmt(kr.ud(r.dVyp))}) — ${pd.stav}`]], body: [{ cislo: cis.inp.value.trim() || n.cislo, y: r.bod.y, x: r.bod.x, z: n.z, kod: n.kod, pozn: 'vyrovnáno na hranici ' + a.cislo + '–' + b.cislo }], prot: `napojení změny do KM-D v novém bodu (KatV 16.27 b) 2), kód kvality ${kr.kod}\ndosavadní hranice ${a.cislo} – ${b.cislo}; nová hranice ${n.cislo} – ${c.cislo}\núhel protnutí ${fmtG(r.uhel, 2)} g → ${r.zpusob}${r.posun != null ? `, posun ${P(r.posun)} m` : ''}\nvyrovnaný bod: Y ${P(r.bod.y)} X ${P(r.bod.x)}${r.naUsecce ? '' : '  (MIMO ÚSEČKU A–B!)'}\ndélka nové hranice ze souřadnic ${P(r.dVyp)}${r.dMer != null ? `, měřeno ${P(r.dMer)}, rozdíl ${P(r.rozdilDelky)} (u_d ${fmt(kr.ud(r.dVyp))}) ${pd.stav}` : ''}`, vrstvy: [{ typ: 'cara', body: [a, b] }, { typ: 'cara', body: [c, r.bod] }, { typ: 'cara', body: [n, r.bod], carkovane: true }, { typ: 'body', body: [{ ...r.bod, cislo: cis.inp.value.trim() || n.cislo }] }] }); }
        } }, 'Spočítat')));
    };
}
