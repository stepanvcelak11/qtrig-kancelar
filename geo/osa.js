// Osa komunikace z tečnového polygonu: vrcholy { y, x, R, L } (R = poloměr oblouku ve vrcholu,
// 0 = lom bez oblouku; L = délka symetrických přechodnic – klotoid, 0 = bez přechodnic).
// Poskytuje: prvky osy s hlavními body, bod na staničení (+ kolmý posun, vpravo +),
// staničení a kolmou vzdálenost libovolného bodu.
import { GON, gonNorm, gonDiff } from './uhly.js';
import { smernik, delka, rajon } from './zaklad.js';

// klotoida: místní souřadnice (x po tečně, y kolmo) pro délku l při parametru A² = R·L
function klotoida(l, A2) {
    const a = l * l / (2 * A2); // = τ
    // řady: x = l(1 − τ²/10 + τ⁴/216 − τ⁶/9360), y = l(τ/3 − τ³/42 + τ⁵/1320 − τ⁷/75600)
    const t2 = a * a;
    const x = l * (1 - t2 / 10 + t2 * t2 / 216 - t2 * t2 * t2 / 9360);
    const y = l * (a / 3 - a * t2 / 42 + a * t2 * t2 / 1320 - a * t2 * t2 * t2 / 75600);
    return { x, y, tau: a };
}

/**
 * Sestaví osu. vrcholy = [{ y, x, R?, L? }], st0 = staničení počátku [m].
 * Vrací { prvky:[{ typ:'primka'|'prechodnice'|'oblouk', st, delka, zac:{y,x}, sigma, R, smer:±1, A2, ... }],
 *         delka, hlavni:[{ nazev, st, y, x }], chyby:[] }
 */
export function sestavOsu(vrcholy, st0 = 0) {
    const V = vrcholy; if (V.length < 2) throw new Error('Osa potřebuje aspoň 2 vrcholy');
    const prvky = [], hlavni = [], chyby = [];
    let st = st0, poz = { y: V[0].y, x: V[0].x }, sig = smernik(V[0], V[1]);
    hlavni.push({ nazev: 'ZÚ', st, ...poz });
    // tečné délky T pro každý vnitřní vrchol
    const geom = V.map((v, i) => {
        if (i === 0 || i === V.length - 1 || !(v.R > 0)) return null;
        const sIn = smernik(V[i - 1], v), sOut = smernik(v, V[i + 1]);
        const alfa = gonDiff(sOut, sIn);             // vrcholový úhel (+ vpravo, − vlevo)
        const a = Math.abs(alfa) * GON, smer = alfa >= 0 ? 1 : -1, R = v.R, L = v.L > 0 ? v.L : 0;
        if (a < 1e-9) return null;
        let tau = 0, Xk = 0, Yk = 0, dR = 0, Xm = 0, A2 = 0;
        if (L > 0) { A2 = R * L; const k = klotoida(L, A2); tau = k.tau; Xk = k.x; Yk = k.y; dR = Yk - R * (1 - Math.cos(tau)); Xm = Xk - R * Math.sin(tau); }
        const uhelObl = a - 2 * tau;
        if (uhelObl < 0) chyby.push(`Vrchol ${i}: přechodnice ${L} m jsou na úhel ${(a / GON).toFixed(4)} g moc dlouhé`);
        const T = Xm + (R + dR) * Math.tan(a / 2);
        return { alfa, a, smer, R, L, tau, Xk, Yk, dR, Xm, A2, uhelObl: Math.max(0, uhelObl), T };
    });
    for (let i = 1; i < V.length; i++) {
        const gPrev = geom[i - 1], g = geom[i];
        const dVV = delka(V[i - 1], V[i]);
        const zacatek = gPrev ? gPrev.T : 0, konec = g ? g.T : 0;
        if (zacatek + konec > dVV + 1e-6) chyby.push(`Mezi vrcholy ${i - 1} a ${i} se tečny nevejdou (T ${zacatek.toFixed(2)} + ${konec.toFixed(2)} > ${dVV.toFixed(2)} m)`);
        // přímka od aktuální pozice k tečnému bodu před vrcholem i
        const dl = dVV - zacatek - konec;
        if (dl > 1e-6) { prvky.push({ typ: 'primka', st, delka: dl, zac: poz, sigma: sig }); poz = rajon(poz, sig, dl); st += dl; }
        if (!g) { if (i < V.length - 1) { sig = smernik(V[i], V[i + 1]); hlavni.push({ nazev: 'VB' + i, st, ...poz }); } continue; }
        // přechodnice 1
        if (g.L > 0) { prvky.push({ typ: 'prechodnice', st, delka: g.L, zac: poz, sigma: sig, R: g.R, smer: g.smer, A2: g.A2, klesa: false }); hlavni.push({ nazev: 'TP' + i, st, ...poz }); const k = klotoida(g.L, g.A2); poz = mistni(poz, sig, k.x, k.y * g.smer); sig = gonNorm(sig + g.smer * g.tau / GON); st += g.L; hlavni.push({ nazev: 'PK' + i, st, ...poz }); }
        else hlavni.push({ nazev: 'TK' + i, st, ...poz });
        // oblouk
        const lo = g.R * g.uhelObl;
        if (lo > 1e-9) { prvky.push({ typ: 'oblouk', st, delka: lo, zac: poz, sigma: sig, R: g.R, smer: g.smer }); const c = g.uhelObl; poz = mistni(poz, sig, g.R * Math.sin(c), g.smer * g.R * (1 - Math.cos(c))); sig = gonNorm(sig + g.smer * c / GON); st += lo; }
        hlavni.push({ nazev: (g.L > 0 ? 'KP' : 'KT') + i, st, ...poz });
        // přechodnice 2 (zrcadlově: klesající křivost)
        if (g.L > 0) { prvky.push({ typ: 'prechodnice', st, delka: g.L, zac: poz, sigma: sig, R: g.R, smer: g.smer, A2: g.A2, klesa: true }); const k = klotoida(g.L, g.A2); // koncový bod: zrcadlení přes tečnu v koncovém bodě
            const endSig = gonNorm(sig + g.smer * g.tau / GON); const kx = k.x * Math.cos(g.tau) + k.y * Math.sin(g.tau), ky = -k.x * Math.sin(g.tau) + k.y * Math.cos(g.tau);
            poz = mistni(poz, sig, kx, -ky * g.smer); sig = endSig; st += g.L; hlavni.push({ nazev: 'PT' + i, st, ...poz }); }
        sig = smernik(V[i], V[i + 1]);
    }
    hlavni.push({ nazev: 'KÚ', st, ...poz });
    return { prvky, delka: st - st0, st0, hlavni, chyby };
}
function mistni(zac, sigma, dx, dy) { const p1 = rajon(zac, sigma, dx); return rajon(p1, sigma + 100, dy); }

/** Bod na prvku ve vzdálenosti l od jeho začátku → { y, x, sigma } */
function bodPrvku(pr, l) {
    if (pr.typ === 'primka') return { ...rajon(pr.zac, pr.sigma, l), sigma: pr.sigma };
    if (pr.typ === 'oblouk') { const c = l / pr.R; return { ...mistni(pr.zac, pr.sigma, pr.R * Math.sin(c), pr.smer * pr.R * (1 - Math.cos(c))), sigma: gonNorm(pr.sigma + pr.smer * c / GON) }; }
    // přechodnice
    if (!pr.klesa) { const k = klotoida(l, pr.A2); return { ...mistni(pr.zac, pr.sigma, k.x, pr.smer * k.y), sigma: gonNorm(pr.sigma + pr.smer * k.tau / GON) }; }
    // klesající: počítáme od konce zpět
    const L = pr.delka, tauL = L * L / (2 * pr.A2), endSig = gonNorm(pr.sigma + pr.smer * tauL / GON);
    const kL = klotoida(L, pr.A2); const kxL = kL.x * Math.cos(tauL) + kL.y * Math.sin(tauL), kyL = -kL.x * Math.sin(tauL) + kL.y * Math.cos(tauL);
    const konec = mistni(pr.zac, pr.sigma, kxL, -kyL * pr.smer);
    const k = klotoida(L - l, pr.A2); // od konce zpět proti směru
    const p = mistni(konec, endSig + 200, k.x, -pr.smer * k.y); // pozpátku se pravý oblouk jeví jako levý
    return { ...p, sigma: gonNorm(endSig - pr.smer * k.tau / GON) };
}

/** Bod na ose ve staničení st s kolmým posunem k (vpravo +) */
export function bodNaOse(osa, st, k = 0) {
    if (st < osa.st0 - 1e-9 || st > osa.st0 + osa.delka + 1e-9) return null;
    let pr = osa.prvky[osa.prvky.length - 1];
    for (const p of osa.prvky) if (st <= p.st + p.delka + 1e-9) { pr = p; break; }
    const b = bodPrvku(pr, Math.min(Math.max(st - pr.st, 0), pr.delka));
    return k ? { ...rajon(b, b.sigma + 100, k), sigma: b.sigma } : b;
}

/** Staničení a kolmá vzdálenost bodu P (vpravo +) → { st, k, pata:{y,x}, sigma } */
export function stanicenBodu(osa, P, krok = 1) {
    let best = null;
    for (const pr of osa.prvky) {
        const n = Math.max(1, Math.ceil(pr.delka / krok));
        for (let i = 0; i <= n; i++) { const l = Math.min(pr.delka, i * krok); const b = bodPrvku(pr, l); const d = delka(b, P); if (!best || d < best.d) best = { d, pr, l }; }
    }
    if (!best) return null;
    // zpřesnění: ternární hledání kolem nejbližšího vzorku
    let lo = Math.max(0, best.l - krok), hi = Math.min(best.pr.delka, best.l + krok);
    for (let it = 0; it < 60; it++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (delka(bodPrvku(best.pr, m1), P) < delka(bodPrvku(best.pr, m2), P)) hi = m2; else lo = m1; }
    const l = (lo + hi) / 2, b = bodPrvku(best.pr, l);
    const kolmy = gonDiff(smernik(b, P), b.sigma); // + vpravo (po směru hod. ručiček od tečny)
    const dist = delka(b, P);
    return { st: best.pr.st + l, k: (kolmy >= 0 ? 1 : -1) * dist, pata: { y: b.y, x: b.x }, sigma: b.sigma, prvek: best.pr.typ };
}

/** Body osy pro vykreslení (každých `krok` m) */
export function vykresliOsu(osa, krok = 2) {
    const out = [];
    for (const pr of osa.prvky) { const n = Math.max(1, Math.ceil(pr.delka / krok)); for (let i = 0; i < n; i++) out.push(bodPrvku(pr, i * krok)); }
    const last = osa.prvky[osa.prvky.length - 1]; if (last) out.push(bodPrvku(last, last.delka));
    return out;
}
