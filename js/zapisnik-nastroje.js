// Zpracování zápisníku podle Gromy (kap. Seznam měření, Definice teodolitu): obě polohy s tolerancemi
// teodolitu, redukce délek, redukce směrů na první orientaci, oprava indexové chyby a refrakce,
// převýšení, opakovaná měření, obousměrné délky, označení orientací, spojení stanovisek,
// export měření (uživatelský formát, MAPA2).
import { Projekt } from './projekt.js';
import { el, $, fmt, fmtG, cislo, toast, dialog, potvrd, ulozSoubor } from './ui.js';
import { gonNorm, gonDiff } from '../geo/uhly.js';
import { prumerujPolohy } from './import-totalka.js';
import { Protokol } from './protokol.js';
import { rozlozCislo } from './seznam-nastroje.js';
import { exportPodleFormatu, polozkyMereni, PREDPISY_MERENI } from './format-uziv.js';
import { R_ZEME } from '../geo/ostatni.js';

export const TEODOLIT_VYCHOZI = { nazev: 'Neznámý teodolit', kolimace: 0, index: 0, mSmer: 0.0010, mDelkaA: 0.003, mDelkaB: 2, // mm + ppm
    podezrelaHz: 0.0050, chybnaHz: 0.0200, podezrelaZ: 0.0050, chybnaZ: 0.0200, podezrelaD: 0.010, chybnaD: 0.050, podezrelaDH: 0.020, chybnaDH: 0.100 };
export const teodolit = () => ({ ...TEODOLIT_VYCHOZI, ...(Projekt.get().teodolit || {}) });

// ---------------- definice teodolitu ----------------
export async function definiceTeodolitu() {
    const p = Projekt.get(); const T = teodolit();
    const F = {}; const f = (k, t, jedn) => { F[k] = el('input', { type: 'text', id: 'te-' + k, value: typeof T[k] === 'number' ? fmt(T[k], k.endsWith('Hz') || k.endsWith('Z') || k === 'kolimace' || k === 'index' || k === 'mSmer' ? 4 : 3) : T[k], class: typeof T[k] === 'number' ? 'num' : '' }); return el('label', { class: 'pole' }, el('span', {}, t + (jedn ? ' [' + jedn + ']' : '')), F[k]); };
    const ok = await dialog({ titulek: 'Definice teodolitu', sirka: 680, obsah: el('div', { style: 'display:grid;gap:10px' },
        el('div', { class: 'radek' }, f('nazev', 'Název'), f('kolimace', 'Kolimační chyba', 'g'), f('index', 'Indexová chyba', 'g')),
        el('h3', {}, 'Střední chyby (váhy ve vyrovnání)'), el('div', { class: 'radek' }, f('mSmer', 'Směr', 'g'), f('mDelkaA', 'Délka konstanta', 'm'), f('mDelkaB', 'Délka', 'ppm')),
        el('h3', {}, 'Tolerance: podezřelé „?“ / chybné „×“ (chybné se neopraví)'), el('div', { class: 'radek' }, f('podezrelaHz', 'Rozdíl Hz I−II podezřelý', 'g'), f('chybnaHz', 'chybný', 'g'), f('podezrelaZ', 'Rozdíl Z I+II−400 podezřelý', 'g'), f('chybnaZ', 'chybný', 'g')),
        el('div', { class: 'radek' }, f('podezrelaD', 'Rozdíl délek podezřelý', 'm'), f('chybnaD', 'chybný', 'm'), f('podezrelaDH', 'Rozdíl převýšení podezřelý', 'm'), f('chybnaDH', 'chybný', 'm')),
        el('p', { class: 'tlum', style: 'margin:0;font-size:12.5px' }, 'Kolimační a indexová chyba se odečítají při zpracování měření v jedné poloze. Neznáš-li je, nech 0 a po prvním zpracování v obou polohách je odhad v protokolu.')),
        tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Uložit', hodnota: true, class: 'hlavni' }] });
    if (!ok) return;
    p.teodolit = { nazev: F.nazev.value.trim() || 'Teodolit' }; for (const k of Object.keys(TEODOLIT_VYCHOZI)) if (k !== 'nazev') p.teodolit[k] = cislo(F[k].value) ?? TEODOLIT_VYCHOZI[k];
    Projekt.zmena('projekt'); toast('Teodolit uložen', 'ok');
}

// ---------------- zpracování zápisníku ----------------
export async function zpracovaniZapisniku(stanoviskoId = null) {
    const p = Projekt.get(); const T = teodolit();
    const V = { redukce: el('input', { type: 'checkbox', id: 'zz-red', checked: true }), polohy: el('input', { type: 'checkbox', id: 'zz-pol', checked: true }), smery: el('input', { type: 'checkbox', id: 'zz-sm' }), index: el('input', { type: 'checkbox', id: 'zz-idx' }), prev: el('input', { type: 'checkbox', id: 'zz-dh', checked: true }), opak: el('input', { type: 'checkbox', id: 'zz-op', checked: true }), obou: el('input', { type: 'checkbox', id: 'zz-ob', checked: true }), jenProtokol: el('input', { type: 'checkbox', id: 'zz-jp' }) };
    const L = (i, t) => el('label', { style: 'display:flex;gap:8px;align-items:center' }, i, t);
    const ok = await dialog({ titulek: 'Zpracování zápisníku' + (stanoviskoId ? ' — jen toto stanovisko' : ' — všechna stanoviska'), sirka: 620, obsah: el('div', { style: 'display:grid;gap:8px' },
        el('div', { class: 'tlum', style: 'font-size:12.5px' }, `Teodolit: ${T.nazev} (podezřelé Hz ${fmtG(T.podezrelaHz)} g, chybné ${fmtG(T.chybnaHz)} g; délky ${fmt(T.podezrelaD)} / ${fmt(T.chybnaD)} m)`),
        L(V.polohy, 'Zpracování měření v obou polohách (průměr, kolimační a indexová chyba do protokolu)'),
        L(V.opak, 'Zpracování opakovaných měření (stejný bod vícekrát v jedné poloze → průměr)'),
        L(V.obou, 'Obousměrně měřené délky a převýšení mezi stanovisky → průměr'),
        L(V.redukce, 'Převod šikmých délek na vodorovné (zápisník pak má vodorovné délky)'),
        L(V.index, 'Oprava indexové chyby (' + fmtG(T.index) + ' g) a kolimační chyby (' + fmtG(T.kolimace) + ' g) u měření v jedné poloze'),
        L(V.prev, 'Výpočet převýšení ze zenitových úhlů (s refrakcí a zakřivením, k = 0,13)'),
        L(V.smery, 'Redukce směrů: směr na první orientaci = 0'),
        L(V.jenProtokol, 'Pouze do protokolu (zápisník nechat beze změny)')),
        tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Opravit', hodnota: true, class: 'hlavni' }] });
    if (!ok) return;
    const stan = stanoviskoId ? p.zapisnik.filter((s) => s.id === stanoviskoId) : p.zapisnik;
    const prot = [`teodolit ${T.nazev}; volby: ${Object.entries(V).filter(([, i]) => i.checked).map(([k]) => k).join(', ')}`];
    const kolim = [], indexy = [];
    const pracovni = V.jenProtokol.checked ? JSON.parse(JSON.stringify(stan)) : stan;
    for (const s of pracovni) {
        prot.push(`\n== stanovisko ${s.stanovisko} (vp ${fmt(s.vp)}) ==`);
        if (V.polohy.checked) {
            const puv = s.radky.length; const nove = [];
            for (let i = 0; i < s.radky.length; i++) {
                const a = s.radky[i], b = s.radky[i + 1];
                const par = b && a.cislo === b.cislo && a.hz != null && b.hz != null && Math.abs(Math.abs(gonDiff(b.hz, a.hz)) - 200) < 1;
                if (!par) { nove.push(a); continue; }
                const dHz = gonDiff(gonNorm(b.hz - 200), a.hz), dZ = a.z != null && b.z != null ? a.z + b.z - 400 : null, dD = a.ds != null && b.ds != null ? b.ds - a.ds : null;
                const znak = (v, pod, ch) => v == null ? '' : Math.abs(v) > ch ? '×' : Math.abs(v) > pod ? '?' : '';
                const zn = [znak(dHz, T.podezrelaHz, T.chybnaHz), znak(dZ, T.podezrelaZ, T.chybnaZ), znak(dD, T.podezrelaD, T.chybnaD)];
                prot.push(`  ${a.cislo.padEnd(16)} I ${fmtG(a.hz)} II ${fmtG(b.hz)}  2c ${(dHz * 10000).toFixed(1).padStart(7)} cc${zn[0]}${dZ != null ? `   Z ${fmtG(a.z)}/${fmtG(b.z)}  2i ${(dZ * 10000).toFixed(1).padStart(7)} cc${zn[1]}` : ''}${dD != null ? `   Δd ${fmt(dD)}${zn[2]}` : ''}`);
                if (zn.includes('×')) { nove.push(a, b); i++; continue; } // chybné: ponechat obě
                kolim.push(dHz / 2); if (dZ != null) indexy.push(dZ / 2);
                nove.push(prumerujPolohy([a, b])[0]); i++;
            }
            s.radky = nove; if (nove.length !== puv) prot.push(`  zprůměrováno ${puv - nove.length} dvojic`);
        }
        if (V.opak.checked) {
            const sk = new Map(); const nove = [];
            for (const r of s.radky) { const k = r.cislo + '|' + r.typ; if (!sk.has(k)) { sk.set(k, r); nove.push(r); continue; } const a = sk.get(k); if (r.hz == null || a.hz == null) { nove.push(r); continue; } const dHz = gonDiff(r.hz, a.hz), dD = r.ds != null && a.ds != null ? r.ds - a.ds : null; if (Math.abs(dHz) > T.chybnaHz || (dD != null && Math.abs(dD) > T.chybnaD)) { nove.push(r); prot.push(`  ${r.cislo} opakované měření × rozdíl Hz ${(dHz * 10000).toFixed(1)} cc${dD != null ? ' Δd ' + fmt(dD) : ''} — ponecháno obojí`); continue; } a.hz = gonNorm(a.hz + dHz / 2); if (a.z != null && r.z != null) a.z = (a.z + r.z) / 2; if (dD != null) a.ds = (a.ds + r.ds) / 2; a.pozn = ((a.pozn || '') + ' opak').trim(); prot.push(`  ${r.cislo} opakované měření zprůměrováno (ΔHz ${(dHz * 10000).toFixed(1)} cc${dD != null ? ', Δd ' + fmt(dD) : ''}${Math.abs(dHz) > T.podezrelaHz ? ' ?' : ''})`); }
            s.radky = nove;
        }
        if (V.index.checked && (T.index || T.kolimace)) s.radky.forEach((r) => { if (r.pozn && r.pozn.includes('I+II')) return; if (r.z != null) r.z = r.z - T.index; if (r.hz != null) r.hz = gonNorm(r.hz - T.kolimace); });
        if (V.prev.checked) s.radky.forEach((r) => { if (r.ds != null && r.z != null) { const sik = (s.delky || 'sikme') === 'sikme'; const dv = sik ? r.ds * Math.sin(r.z * Math.PI / 200) : r.ds; r.dh = (sik ? r.ds * Math.cos(r.z * Math.PI / 200) : r.ds / Math.tan(r.z * Math.PI / 200)) + (1 - 0.13) * dv * dv / (2 * R_ZEME) + (s.vp || 0) - (r.vc || 0); } });
        if (V.redukce.checked && (s.delky || 'sikme') === 'sikme') { let n = 0; s.radky.forEach((r) => { if (r.ds != null && r.z != null) { r.ds = r.ds * Math.sin(r.z * Math.PI / 200); n++; } }); if (n) { s.delky = 'vodorovne'; prot.push(`  ${n} délek převedeno na vodorovné`); } }
        if (V.smery.checked) { const o = s.radky.find((r) => r.typ === 'o' && r.hz != null); if (o) { const o0 = o.hz; s.radky.forEach((r) => { if (r.hz != null) r.hz = gonNorm(r.hz - o0); }); prot.push(`  směry redukovány na orientaci ${o.cislo} (odečteno ${fmtG(o0)} g)`); } }
    }
    if (V.obou.checked) {
        for (const s of pracovni) for (const r of s.radky) {
            const zpet = pracovni.find((t) => t.stanovisko === r.cislo); if (!zpet || !(s.stanovisko < r.cislo)) continue;
            const rr = zpet.radky.find((x) => x.cislo === s.stanovisko); if (!rr || r.ds == null || rr.ds == null) continue;
            const dv1 = r.z != null && (s.delky || 'sikme') === 'sikme' ? r.ds * Math.sin(r.z * Math.PI / 200) : r.ds, dv2 = rr.z != null && (zpet.delky || 'sikme') === 'sikme' ? rr.ds * Math.sin(rr.z * Math.PI / 200) : rr.ds;
            const dD = dv2 - dv1, dDH = r.dh != null && rr.dh != null ? r.dh + rr.dh : null;
            const zn = Math.abs(dD) > T.chybnaD ? '×' : Math.abs(dD) > T.podezrelaD ? '?' : '';
            prot.push(`obousměrně ${s.stanovisko} ↔ ${r.cislo}: d ${fmt(dv1)} / ${fmt(dv2)}  Δ ${fmt(dD)} m${zn}${dDH != null ? `   Δh ${fmt(r.dh)} / ${fmt(rr.dh)}  součet ${fmt(dDH)} m${Math.abs(dDH) > T.chybnaDH ? '×' : Math.abs(dDH) > T.podezrelaDH ? '?' : ''}` : ''}`);
            if (zn !== '×') { const prum = (dv1 + dv2) / 2; const kZpet = (v, st, row) => (row.z != null && (st.delky || 'sikme') === 'sikme') ? v / Math.sin(row.z * Math.PI / 200) : v; r.ds = kZpet(prum, s, r); rr.ds = kZpet(prum, zpet, rr); if (dDH != null && Math.abs(dDH) <= T.chybnaDH) { const h = (r.dh - rr.dh) / 2; r.dh = h; rr.dh = -h; } }
        }
    }
    if (kolim.length) { const c = kolim.reduce((a, b) => a + b, 0) / kolim.length, i = indexy.length ? indexy.reduce((a, b) => a + b, 0) / indexy.length : null; prot.push(`\nodhad přístrojových chyb: kolimační c = ${(c * 10000).toFixed(1)} cc (z ${kolim.length})${i != null ? `, indexová i = ${(i * 10000).toFixed(1)} cc (z ${indexy.length})` : ''}`); }
    Protokol.pridej('Zpracování zápisníku', prot.join('\n'));
    if (!V.jenProtokol.checked) Projekt.zmena('zapisnik');
    toast(V.jenProtokol.checked ? 'Zapsáno do protokolu (zápisník beze změny)' : 'Zápisník zpracován, viz protokol', 'ok');
}

// ---------------- označení orientací ----------------
export async function oznaceniOrientaci() {
    const p = Projekt.get();
    const V = { stan: el('input', { type: 'checkbox', id: 'oo-stan', checked: true }), sez: el('input', { type: 'checkbox', id: 'oo-sez', checked: true }), kod: el('input', { type: 'text', id: 'oo-kod', placeholder: 'např. OR' }), nad: el('input', { type: 'text', id: 'oo-nad', placeholder: 'např. 4000', class: 'num' }), pre: el('input', { type: 'text', id: 'oo-pre', placeholder: 'předčíslí (k. ú.+ZPMZ)' }), preNad: el('input', { type: 'text', id: 'oo-prenad', placeholder: 'předčíslí vyšší než', class: 'num' }), nove: el('input', { type: 'checkbox', id: 'oo-nove' }) };
    const L = (i, t) => el('label', { style: 'display:flex;gap:8px;align-items:center' }, i, t);
    const ok = await dialog({ titulek: 'Označení orientací', sirka: 600, obsah: el('div', { style: 'display:grid;gap:8px' }, L(V.stan, 'body použité jako stanoviska'), L(V.sez, 'body nalezené v seznamu souřadnic'), el('div', { class: 'radek' }, el('label', { class: 'pole' }, el('span', {}, 'body s kódem orientace'), V.kod), el('label', { class: 'pole' }, el('span', {}, 'body s číslem vyšším než'), V.nad)), el('div', { class: 'radek' }, el('label', { class: 'pole' }, el('span', {}, 'body s předčíslím'), V.pre), el('label', { class: 'pole' }, el('span', {}, 'body s předčíslím vyšším než'), V.preNad)), L(V.nove, 'nové označení (nejdřív zrušit všechny stávající orientace)')),
        tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Označit', hodnota: true, class: 'hlavni' }] });
    if (!ok) return;
    const stanoviska = new Set(p.zapisnik.map((s) => s.stanovisko)); const nad = cislo(V.nad.value), preNad = cislo(V.preNad.value), pre = V.pre.value.trim().replace(/[^\d]/g, ''), kod = V.kod.value.trim();
    let n = 0;
    p.zapisnik.forEach((s) => s.radky.forEach((r) => {
        if (V.nove.checked) r.typ = 'z';
        const rc = rozlozCislo(r.cislo); const cis = +rc.cislo;
        let je = false;
        if (V.stan.checked && stanoviska.has(r.cislo) && r.cislo !== s.stanovisko) je = true;
        if (V.sez.checked && Projekt.bod(r.cislo) && r.cislo !== s.stanovisko) je = true;
        if (kod && (r.kod || '').split(/\s+/).includes(kod)) je = true;
        if (nad != null && isFinite(cis) && cis > nad) je = true;
        if (pre && rc.predcisli === pre) je = true;
        if (preNad != null && rc.predcisli && +rc.predcisli > preNad) je = true;
        if (je && r.typ !== 'o') { r.typ = 'o'; n++; }
    }));
    Projekt.zmena('zapisnik'); toast(`Označeno ${n} orientací`, 'ok');
}

// ---------------- spojení opakovaných stanovisek ----------------
export async function spojeniStanovisek() {
    const p = Projekt.get(); const sk = new Map(); p.zapisnik.forEach((s) => { if (!sk.has(s.stanovisko)) sk.set(s.stanovisko, []); sk.get(s.stanovisko).push(s); });
    const opak = [...sk.values()].filter((a) => a.length > 1); if (!opak.length) { toast('Žádné opakované stanovisko'); return; }
    if (!await potvrd(`Spojit ${opak.length} opakovaných stanovisek (${opak.map((a) => a[0].stanovisko).join(', ')}) do jednoho?`)) return;
    for (const a of opak) { const prvni = a[0]; for (const dal of a.slice(1)) { prvni.radky.push(...dal.radky); p.zapisnik.splice(p.zapisnik.indexOf(dal), 1); } }
    Projekt.zmena('zapisnik'); toast('Stanoviska spojena', 'ok');
}

// ---------------- export měření ----------------
export async function exportMereni() {
    const p = Projekt.get(); if (!p.zapisnik.length) { toast('Zápisník je prázdný'); return; }
    const fmtSel = el('select', { id: 'em-fmt' }, [['mapa2', 'MAPA2 / Groma dávka (číslo délka Hz, orientace, -1, /, -2)'], ['topcon', 'MAPA2 Topcon (číslo šikmá vc Hz Z)'], ['uziv', 'Uživatelský formát (předpis níže)']].map(([v, t]) => el('option', { value: v }, t)));
    const predpis = el('input', { type: 'text', id: 'em-predpis', value: PREDPISY_MERENI[0][0], list: 'dl-predpisy-m' });
    const dl = el('datalist', { id: 'dl-predpisy-m' }, PREDPISY_MERENI.map(([v, t]) => el('option', { value: v }, t)));
    const hl = el('input', { type: 'checkbox', id: 'em-hl', checked: true });
    const ok = await dialog({ titulek: 'Export zápisníku', sirka: 640, obsah: el('div', { style: 'display:grid;gap:10px' }, el('label', { class: 'pole' }, el('span', {}, 'Formát'), fmtSel), el('label', { class: 'pole' }, el('span', {}, 'Předpis řádku (uživatelský formát)'), predpis), dl, el('label', {}, hl, ' u uživatelského formátu řádek stanoviska „1 číslo vp“ před měřením'), el('p', { class: 'tlum', style: 'margin:0;font-size:12.5px' }, 'Položky: <NUM> <P> <N> <HZ> <V> <D> <DH> <SIG> <CODE> <NOTE> <STN> <IH> <LINE>; volby ,DEG ,DMS; šířka a desetinná místa <HZ:10:4>.')),
        tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Uložit', hodnota: true, class: 'hlavni' }] });
    if (!ok) return;
    let out = '', nazev = (p.nazev || 'zapisnik').replace(/[^\w-]+/g, '_');
    const f = (v, d) => v == null ? '0.' : v.toFixed(d);
    if (fmtSel.value === 'mapa2' || fmtSel.value === 'topcon') {
        out += `;Zakazka:${p.zakazka || p.nazev || ''}\n9999\n999999999\n${p.predcisli || '000000000XX'}\n1\n3\n0\n2\n`;
        for (const s of p.zapisnik) {
            out += `1 ${s.stanovisko}        ${f(s.vp, 2)} *\n`;
            const o = s.radky.filter((r) => r.typ === 'o'), z = s.radky.filter((r) => r.typ !== 'o');
            const radek = (r) => fmtSel.value === 'topcon' ? `${r.cislo.padEnd(12)} ${f(r.ds, 3).padStart(8)}  ${f(r.vc, 3)} ${f(r.hz, 4).padStart(9)} ${f(r.z, 4).padStart(9)}\n` : `${r.cislo} ${f(r.ds != null && r.z != null && (s.delky || 'sikme') === 'sikme' ? r.ds * Math.sin(r.z * Math.PI / 200) : r.ds, 3)} ${f(r.hz, 4)}${r.kod ? ' ' + r.kod : ''}\n`;
            o.forEach((r) => { out += radek(r); }); out += '-1\n'; z.forEach((r) => { out += radek(r); }); out += '/\n';
        }
        out += '-2\n';
        ulozSoubor(nazev + '.zap', out);
    } else {
        for (const s of p.zapisnik) { if (hl.checked) out += `1 ${s.stanovisko} ${f(s.vp, 3)}\n`; out += exportPodleFormatu(predpis.value, s.radky.map((r, i) => polozkyMereni(s, r, i))); }
        ulozSoubor(nazev + '-mereni.txt', out);
    }
}
