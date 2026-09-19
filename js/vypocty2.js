// Výpočty 2. část: polygonový pořad, transformace, výšky, nivelace. Zapojuje se do FORMY ve vypocty.js.
import { Projekt } from './projekt.js';
import { el, $, fmt, fmtG, cislo, toast } from './ui.js';
import { parseUhel, gonNorm } from '../geo/uhly.js';
import { polygonovyPorad } from '../geo/polygon.js';
import { kriteria, posud, posudPorad, PORADY } from '../geo/presnost.js';
import { transformace, trigVyska, nivelace } from '../geo/ostatni.js';
import { delka, smernik } from '../geo/zaklad.js';

const P = (v, d = 3) => fmt(v, d).padStart(12);
const G = (v) => fmtG(v, 4).padStart(9);
const tdInp = (label, extra = {}) => el('td', {}, el('input', { type: 'text', 'aria-label': label, ...extra }));
const hodn = (tr, l) => tr.querySelector(`[aria-label=${l}]`).value.trim();

export function registruj(FORMY, pom) {
    const { hlavaFormu, bodPole, cisloPole, textPole, vyberPole, vysledek, chyba, sem } = pom;

    FORMY.polygon = (sek, ctx, u) => {
        const typ = vyberPole('Typ pořadu', 'pg-typ', [['oboustranne', 'oboustranně připojený a orientovaný'], ['jednostranne', 'připojený na obou koncích, orientovaný jen na začátku'], ['vetknuty', 'vetknutý (bez orientací)'], ['uzavreny', 'uzavřený (začátek = konec)'], ['volny', 'volný (bez kontroly)']], 'oboustranne');
        const uhly = vyberPole('Vrcholové úhly', 'pg-uhly', [['levy', 'levostranné'], ['pravy', 'pravostranné']], 'levy');
        const druh = vyberPole('Posoudit jako', 'pg-druh', [['pomocny', 'pomocný pořad'], ['ppbp', 'PPBP']], Projekt.get().druhPoradu || 'pomocny');
        const PA = bodPole('Orientace na začátku (PA)', 'pg-pa'), PB = bodPole('Orientace na konci (PB)', 'pg-pb');
        const radky = el('tbody');
        const tab = el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Bod'), el('th', { class: 'num' }, 'Vrcholový úhel ω [g]'), el('th', { class: 'num' }, 'Délka k dalšímu [m]'), el('th', {}, ''))), radky);
        const pridej = (c = '', o = '', d = '') => { const tr = el('tr'); tr.append(tdInp('c', { value: c, list: 'dl-body', placeholder: 'číslo' }), tdInp('o', { value: o, class: 'num', inputmode: 'decimal' }), tdInp('d', { value: d, class: 'num', inputmode: 'decimal' }), el('td', { class: 'akce' }, el('button', { class: 'ikona', onclick: () => tr.remove() }, '✕'))); radky.append(tr); };
        for (let i = 0; i < 5; i++) pridej();
        const aktTyp = () => { PB.style.display = typ.inp.value === 'oboustranne' ? '' : 'none'; PA.style.display = typ.inp.value === 'vetknuty' ? 'none' : ''; };
        typ.inp.onchange = aktTyp; aktTyp();
        hlavaFormu(sek, u, el('div', { class: 'radek' }, typ, uhly, druh), el('div', { class: 'radek' }, PA, PB),
            el('p', { class: 'tlum', style: 'margin:0;font-size:12.5px' }, 'První řádek = počáteční známý bod (jeho úhel je mezi orientací a prvním vrcholem), poslední řádek = koncový známý bod (úhel mezi posledním vrcholem a koncovou orientací; u pořadu bez koncové orientace se nevyplňuje). Délka je vždy k následujícímu bodu. Uzavřený pořad: poslední řádek je znovu počáteční bod.'),
            el('div', { class: 'tw' }, tab),
            el('div', { style: 'display:flex;gap:8px' }, el('button', { class: 'btn maly', onclick: () => pridej() }, '+ Vrchol'), el('button', { class: 'btn hlavni', onclick: spocitej }, 'Spočítat pořad')));
        function spocitej() {
            const V = []; for (const tr of radky.rows) { const c = hodn(tr, 'c'); if (!c) continue; V.push({ cislo: c, omega: parseUhel(hodn(tr, 'o')), d: cislo(hodn(tr, 'd')) }); }
            if (V.length < 3) return chyba(sek, 'Pořad potřebuje počáteční bod, aspoň jeden vrchol a koncový bod.');
            const T = typ.inp.value, A = Projekt.bod(V[0].cislo), B = T === 'uzavreny' ? A : Projekt.bod(V[V.length - 1].cislo);
            if (!A) return chyba(sek, `Počáteční bod ${V[0].cislo} není v seznamu.`);
            if (T !== 'volny' && !B) return chyba(sek, `Koncový bod ${V[V.length - 1].cislo} není v seznamu.`);
            const pa = PA.bod(), pb = PB.bod();
            if (T !== 'vetknuty' && !pa) return chyba(sek, 'Orientační bod na začátku není v seznamu.');
            if (T === 'oboustranne' && !pb) return chyba(sek, 'Orientační bod na konci není v seznamu.');
            for (let i = 0; i < V.length - 1; i++) if (!(V[i].d > 0)) return chyba(sek, `Chybí délka u bodu ${V[i].cislo}.`);
            const potrebaUhel = (i) => !(i === 0 && T === 'vetknuty') && !(i === V.length - 1 && (T === 'jednostranne' || T === 'vetknuty' || T === 'volny'));
            for (let i = 0; i < V.length; i++) if (potrebaUhel(i) && V[i].omega == null) return chyba(sek, `Chybí vrcholový úhel u bodu ${V[i].cislo}.`);
            V.forEach((v) => { if (v.omega == null) v.omega = 0; });
            let r; try { r = polygonovyPorad({ typ: T, A, B, PA: pa, PB: pb, vrcholy: V, levy: uhly.inp.value === 'levy' }); } catch (e) { return chyba(sek, e.message); }
            const pos = posudPorad(r, T === 'vetknuty' ? 'vetknuty' : druh.inp.value);
            let stav = 'neposouzeno'; [pos.uhlovy, pos.polohovy].forEach((x) => { if (!x) return; if (x.stav === 'prekroceno') stav = 'prekroceno'; else if (x.stav === 'varovani' && stav !== 'prekroceno') stav = 'varovani'; else if (stav === 'neposouzeno') stav = 'ok'; });
            const kv = [['Typ', typ.inp.selectedOptions[0].textContent], ['Počet vrcholů', r.n], ['Délka pořadu Σd', fmt(r.sumaD, 2) + ' m']];
            if (r.uhlovyUzaver != null) kv.push(['Úhlový uzávěr', `${(r.uhlovyUzaver * 10000).toFixed(1)} cc (mezní ${(pos.uhlovy.mezni * 10000).toFixed(0)} cc)`], ['Oprava na úhel', `${(r.opravaUhlu * 10000).toFixed(2)} cc`]);
            if (r.souradnicovyUzaver.dp != null) kv.push(['Souřadnicový uzávěr', `${r.souradnicovyUzaver.dy != null ? `ΔY ${fmt(r.souradnicovyUzaver.dy)}  ΔX ${fmt(r.souradnicovyUzaver.dx)}  ` : ''}Δp ${fmt(r.souradnicovyUzaver.dp)} m (mezní ${fmt(pos.polohovy.mezni)} m)`]);
            const nove = r.body.slice(1, T === 'uzavreny' ? -1 : -1).filter((b) => !Projekt.bod(b.cislo) || true).map((b) => ({ cislo: b.cislo, y: b.y, x: b.x }));
            const novePodrobne = T === 'volny' ? r.body.slice(1) : r.body.slice(1, -1);
            let prot = `typ: ${typ.inp.selectedOptions[0].textContent}, úhly ${uhly.inp.value === 'levy' ? 'levostranné' : 'pravostranné'}, posouzení: ${pos.druh}\n`;
            prot += `A ${A.cislo}: Y ${P(A.y)} X ${P(A.x)}${pa ? `   PA ${pa.cislo} σ ${G(smernik(A, pa))}` : ''}\n`;
            if (B && T !== 'uzavreny') prot += `B ${B.cislo}: Y ${P(B.y)} X ${P(B.x)}${pb ? `   PB ${pb.cislo} σ ${G(smernik(B, pb))}` : ''}\n`;
            V.forEach((v, i) => { prot += `${v.cislo.padEnd(10)} ω ${G(v.omega)}${i < V.length - 1 ? `  d ${P(v.d)}` : ''}\n`; });
            if (r.uhlovyUzaver != null) prot += `úhlový uzávěr ${(r.uhlovyUzaver * 10000).toFixed(1)} cc, mezní ${(pos.uhlovy.mezni * 10000).toFixed(0)} cc — ${pos.uhlovy.stav}; oprava na úhel ${(r.opravaUhlu * 10000).toFixed(2)} cc\n`;
            if (r.souradnicovyUzaver.dp != null) prot += `souřadnicový uzávěr Δp ${P(r.souradnicovyUzaver.dp)} m, mezní ${P(pos.polohovy.mezni)} m — ${pos.polohovy.stav}\n`;
            r.body.forEach((b) => { prot += `${b.cislo.padEnd(10)} Y ${P(b.y)} X ${P(b.x)}${b.sigma != null ? `   σ ${G(b.sigma)}  d ${P(b.d)}` : ''}\n`; });
            vysledek(sek, { nazev: `Polygonový pořad ${V[0].cislo} → ${V[V.length - 1].cislo}`, stav, kv, body: novePodrobne.map((b) => ({ cislo: b.cislo, y: b.y, x: b.x })), prot, vrstvy: [{ typ: 'cara', body: r.body }, ...(pa ? [{ typ: 'cara', body: [A, pa], carkovane: true }] : []), ...(pb && B ? [{ typ: 'cara', body: [B, pb], carkovane: true }] : []), { typ: 'body', body: novePodrobne, r: 4 }] });
        }
    };

    FORMY.transformace = (sek, ctx, u) => {
        const typ = vyberPole('Typ', 'tr-typ', [['shodnostni', 'shodnostní (posun + rotace, měřítko 1)'], ['helmert', 'podobnostní — Helmert (posun, rotace, měřítko)'], ['afinni', 'afinní (6 parametrů)']], 'helmert');
        const radky = el('tbody');
        const tab = el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Identický bod'), el('th', { class: 'num' }, 'Y zdroj'), el('th', { class: 'num' }, 'X zdroj'), el('th', {}, 'Cíl (bod ze seznamu)'), el('th', {}, ''))), radky);
        const pridej = () => { const tr = el('tr'); tr.append(tdInp('c', { placeholder: 'číslo' }), tdInp('y', { class: 'num', inputmode: 'decimal' }), tdInp('x', { class: 'num', inputmode: 'decimal' }), tdInp('cil', { list: 'dl-body', placeholder: 'číslo v seznamu' }), el('td', { class: 'akce' }, el('button', { class: 'ikona', onclick: () => tr.remove() }, '✕'))); radky.append(tr); };
        for (let i = 0; i < 4; i++) pridej();
        const dalsi = el('textarea', { id: 'tr-dalsi', rows: 4, placeholder: 'body k transformaci — jeden na řádek: číslo Y X [Z] [kód]\n(místní soustava; lze vložit i celý seznam)' });
        hlavaFormu(sek, u, el('div', { class: 'radek' }, typ), el('h3', {}, 'Identické body'), el('div', { class: 'tw' }, tab), el('div', {}, el('button', { class: 'btn maly', onclick: pridej }, '+ Bod')),
            el('h3', {}, 'Body k transformaci'), el('label', { class: 'pole' }, el('span', {}, 'Zdrojové souřadnice (místní)'), dalsi),
            el('div', {}, el('button', { class: 'btn hlavni', onclick: spocitej }, 'Spočítat transformaci')));
        function spocitej() {
            const id = []; for (const tr of radky.rows) { const c = hodn(tr, 'c'), y = cislo(hodn(tr, 'y')), x = cislo(hodn(tr, 'x')), cil = Projekt.bod(hodn(tr, 'cil')); if (y != null && x != null && cil) id.push({ cislo: c || cil.cislo, z: { y, x }, c: cil }); }
            let r; try { r = transformace(id, typ.inp.value); } catch (e) { return chyba(sek, e.message); }
            const kr = kriteria(Projekt.get().kodKvality); let stav = 'ok';
            const tabV = el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Bod'), el('th', { class: 'num' }, 'v_Y'), el('th', { class: 'num' }, 'v_X'), el('th', { class: 'num' }, 'v_p'), el('th', {}, ''))), el('tbody', {}, r.radky.map((x) => { const p = posud(x.vp, kr.uxy); if (p.stav === 'prekroceno') stav = 'prekroceno'; else if (p.stav === 'varovani' && stav === 'ok') stav = 'varovani'; return el('tr', {}, el('td', { class: 'cislo' }, x.cislo), el('td', { class: 'num' }, fmt(x.vy)), el('td', { class: 'num' }, fmt(x.vx)), el('td', { class: 'num' }, fmt(x.vp)), el('td', {}, sem(p, p.stav))); })));
            const kv = [['Typ', typ.inp.selectedOptions[0].textContent], ['Identických bodů', id.length], ['m0', r.m0 == null ? '— (bez nadbytečných)' : fmt(r.m0) + ' m']];
            if (r.param.rotaceGon != null) kv.push(['Rotace', fmtG(r.param.rotaceGon) + ' g'], ['Měřítko', r.param.meritko.toFixed(8)]);
            else kv.push(['Parametry', `a ${r.param.a.toFixed(8)} b ${r.param.b.toFixed(8)} c ${fmt(r.param.c)}  d ${r.param.d.toFixed(8)} e ${r.param.e.toFixed(8)} f ${fmt(r.param.f)}`]);
            const body = []; let chybne = 0;
            dalsi.value.split(/\r?\n/).forEach((l) => { const c = l.trim().split(/[\s;]+/); if (c.length < 3) { if (l.trim()) chybne++; return; } const y = cislo(c[1]), x = cislo(c[2]); if (y == null || x == null) { chybne++; return; } const t = r.transformuj({ y, x }); body.push({ cislo: c[0], y: t.y, x: t.x, z: c.length > 3 ? cislo(c[3]) : null, kod: c.slice(4).join(' ') }); });
            let prot = `transformace ${r.typ}: ${id.length} identických bodů, m0 ${r.m0 == null ? '—' : fmt(r.m0)} m\n` + (r.param.rotaceGon != null ? `rotace ${G(r.param.rotaceGon)} g, měřítko ${r.param.meritko.toFixed(8)}, těžiště zdroj Y ${P(r.param.tezisteZdroj.y)} X ${P(r.param.tezisteZdroj.x)}, cíl Y ${P(r.param.tezisteCil.y)} X ${P(r.param.tezisteCil.x)}\n` : `a ${r.param.a} b ${r.param.b} c ${r.param.c} d ${r.param.d} e ${r.param.e} f ${r.param.f}\n`);
            r.radky.forEach((x) => { prot += `  ${x.cislo.padEnd(10)} v_Y ${P(x.vy)} v_X ${P(x.vx)} v_p ${P(x.vp)}\n`; });
            body.forEach((b) => { prot += `${b.cislo.padEnd(10)} → Y ${P(b.y)} X ${P(b.x)}\n`; });
            if (chybne) toast(`${chybne} řádků k transformaci nešlo přečíst`, 'bad');
            vysledek(sek, { nazev: 'Transformace ' + r.typ, stav, kv, body, prot, extra: el('div', { class: 'tw' }, tabV), vrstvy: [{ typ: 'body', body, r: 4 }] });
        }
    };

    FORMY.vysky = (sek, ctx, u) => {
        const st = bodPole('Stanovisko (s výškou)', 'vy-st'), vp = cisloPole('Výška přístroje', 'vy-vp', '', 'm'), k = cisloPole('Refrakční koeficient', 'vy-k', '0,13');
        const radky = el('tbody');
        const tab = el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Cíl'), el('th', { class: 'num' }, 'Zenit [g]'), el('th', { class: 'num' }, 'Šikmá délka [m]'), el('th', { class: 'num' }, 'V. cíle [m]'), el('th', {}, ''))), radky);
        const pridej = () => { const tr = el('tr'); tr.append(tdInp('c', { list: 'dl-body' }), tdInp('z', { class: 'num', inputmode: 'decimal' }), tdInp('d', { class: 'num', inputmode: 'decimal' }), tdInp('vc', { class: 'num', inputmode: 'decimal' }), el('td', { class: 'akce' }, el('button', { class: 'ikona', onclick: () => tr.remove() }, '✕'))); radky.append(tr); };
        for (let i = 0; i < 4; i++) pridej();
        hlavaFormu(sek, u, el('h3', {}, 'Trigonometrické určení výšek'), el('div', { class: 'radek' }, st, vp, k), el('div', { class: 'tw' }, tab), el('div', { style: 'display:flex;gap:8px' }, el('button', { class: 'btn maly', onclick: pridej }, '+ Řádek'), el('button', { class: 'btn hlavni', onclick: () => {
            const S = st.bod(); if (!S || S.z == null) return chyba(sek, 'Stanovisko musí být v seznamu a mít výšku Z.');
            const body = []; let prot = `stanovisko ${S.cislo} H ${P(S.z)} m, výška přístroje ${fmt(vp.hodnota() || 0)} m, k = ${k.hodnota() ?? 0.13}\n`;
            for (const tr of radky.rows) { const c = hodn(tr, 'c'), z = parseUhel(hodn(tr, 'z')), d = cislo(hodn(tr, 'd')), vc = cislo(hodn(tr, 'vc')) || 0; if (!c || z == null || d == null) continue; const r = trigVyska({ Hst: S.z, z, d, sikma: true, vp: vp.hodnota() || 0, vc, k: k.hodnota() ?? 0.13 }); const ex = Projekt.bod(c); body.push({ cislo: c, y: ex ? ex.y : null, x: ex ? ex.x : null, z: r.H, kod: ex ? ex.kod : '' }); prot += `${c.padEnd(10)} z ${G(z)}  d ${P(d)}  vc ${fmt(vc)}  Δh ${P(r.prevyseni)}  opr. ${(r.oprava * 1000).toFixed(1)} mm  →  H ${P(r.H)}${ex && ex.z != null ? `  (v seznamu ${P(ex.z)}, rozdíl ${P(r.H - ex.z)})` : ''}\n`; }
            if (!body.length) return chyba(sek, 'Zadej aspoň jeden cíl se zenitem a délkou.');
            const extra = el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Bod'), el('th', { class: 'num' }, 'H [m]'), el('th', {}, ''))), el('tbody', {}, body.map((b) => { const ex = Projekt.bod(b.cislo); return el('tr', {}, el('td', { class: 'cislo' }, b.cislo), el('td', { class: 'num' }, fmt(b.z)), el('td', {}, ex && ex.z != null ? sem({ stav: Math.abs(ex.z - b.z) < 0.1 ? 'ok' : 'varovani' }, 'rozdíl ' + fmt(b.z - ex.z)) : el('span', { class: 'tlum' }, ex ? 'bod bez výšky' : 'bod není v seznamu — uloží se jen výška po doplnění polohy'))); })));
            vysledek(sek, { nazev: 'Trigonometrické výšky ze ' + S.cislo, stav: 'neposouzeno', kv: [['Cílů', body.length]], body: body.filter((b) => b.y != null), prot, extra: el('div', { class: 'tw' }, extra) });
        } }, 'Spočítat výšky')),
        el('h3', { style: 'margin-top:18px' }, 'Nivelační pořad'), el('p', { class: 'tlum', style: 'margin:0;font-size:12.5px' }, 'Čtení zpět a vpřed v metrech po sestavách; uzávěr se rozdělí rovnoměrně. Mezní odchylka technické nivelace 40·√R mm (R = délka pořadu v km).'), nivForm());
        function nivForm() {
            const hz = cisloPole('Výška počátečního bodu', 'ni-hz', '', 'm'), hk = cisloPole('Výška koncového bodu (nepovinné)', 'ni-hk', '', 'm'), km = cisloPole('Délka pořadu', 'ni-km', '', 'km');
            const radky = el('tbody'); const tab = el('table', { class: 'tab bez-nastroju' }, el('thead', {}, el('tr', {}, el('th', {}, 'Bod'), el('th', { class: 'num' }, 'Zpět [m]'), el('th', { class: 'num' }, 'Vpřed [m]'), el('th', {}, ''))), radky);
            const pridej = () => { const tr = el('tr'); tr.append(tdInp('c', { placeholder: 'přestavový / cíl' }), tdInp('zp', { class: 'num', inputmode: 'decimal' }), tdInp('vp', { class: 'num', inputmode: 'decimal' }), el('td', { class: 'akce' }, el('button', { class: 'ikona', onclick: () => tr.remove() }, '✕'))); radky.append(tr); };
            for (let i = 0; i < 4; i++) pridej();
            return el('div', { style: 'display:grid;gap:10px' }, el('div', { class: 'radek' }, hz, hk, km), el('div', { class: 'tw' }, tab), el('div', { style: 'display:flex;gap:8px' }, el('button', { class: 'btn maly', onclick: pridej }, '+ Sestava'), el('button', { class: 'btn hlavni', onclick: () => {
                const sest = [], jm = []; for (const tr of radky.rows) { const zp = cislo(hodn(tr, 'zp')), vp2 = cislo(hodn(tr, 'vp')); if (zp == null || vp2 == null) continue; sest.push({ zpet: zp, vpred: vp2 }); jm.push(hodn(tr, 'c')); }
                const Hz = hz.hodnota(); if (Hz == null || !sest.length) return chyba(sek, 'Zadej výšku počátku a aspoň jednu sestavu.');
                const r = nivelace({ sestavy: sest, Hzac: Hz, Hkon: hk.hodnota(), delkaKm: km.hodnota() });
                const kv = [['Součet převýšení', fmt(r.sumaPrevyseni) + ' m'], ['Uzávěr', r.uzaver == null ? '— (bez koncové výšky)' : `${(r.uzaver * 1000).toFixed(1)} mm (mezní ${r.mezni == null ? '?' : (r.mezni * 1000).toFixed(1) + ' mm'})`], ['Oprava na sestavu', r.uzaver == null ? '—' : (r.oprava * 1000).toFixed(2) + ' mm']];
                let prot = `nivelace: H počátek ${P(Hz)} m${hk.hodnota() != null ? `, H konec ${P(hk.hodnota())} m` : ''}${km.hodnota() != null ? `, R ${km.hodnota()} km` : ''}\n`;
                sest.forEach((s, i) => { prot += `${(jm[i] || String(i + 1)).padEnd(10)} zpět ${P(s.zpet)}  vpřed ${P(s.vpred)}  Δh ${P(r.prevyseni[i])}  →  H ${P(r.vysky[i + 1])}\n`; });
                if (r.uzaver != null) prot += `uzávěr ${(r.uzaver * 1000).toFixed(1)} mm, mezní ${r.mezni == null ? '?' : (r.mezni * 1000).toFixed(1) + ' mm'} — ${r.posouzeni ? r.posouzeni.stav : '?'}\n`;
                const body = jm.map((c, i) => ({ c, H: r.vysky[i + 1] })).filter((x) => x.c && Projekt.bod(x.c)).map((x) => { const b = Projekt.bod(x.c); return { cislo: x.c, y: b.y, x: b.x, z: x.H, kod: b.kod }; });
                vysledek(sek, { nazev: 'Nivelační pořad', stav: r.posouzeni ? r.posouzeni.stav : 'neposouzeno', kv, body, prot });
            } }, 'Spočítat nivelaci')));
        }
    };
}
