// Stanovisko: orientace, polární metoda dávkově, volné stanovisko (Helmert i MNČ),
// protínání zpět. Směry ψ jsou čtení na vodorovném kruhu v gonech, délky vodorovné
// (už redukované do S-JTSK — viz redukce.js).
import { GON, gonNorm, gonDiff } from './uhly.js';
import { smernik, delka, rajon, protinaniZpetTienstra } from './zaklad.js';

/**
 * Orientace stanoviska S na známé body.
 * orientace = [{ cislo, bod:{y,x}, smer, delka? }]
 * Vrací { o: orientační posun (σ = ψ + o), radky:[{cislo, sigma, oi, v, dVyp, dMer, dd}], mOr, n }
 *   v  = odchylka jednotlivé orientace od střední (gon)
 *   dd = měřená − vypočtená délka (m), když je délka
 */
export function orientaceStanoviska(S, orientace) {
    if (!orientace.length) throw new Error('Chybí orientace');
    const radky = orientace.map((r) => {
        const sigma = smernik(S, r.bod), dVyp = delka(S, r.bod);
        const oi = gonNorm(sigma - r.smer);
        return { cislo: r.cislo, sigma, oi, dVyp, dMer: r.delka ?? null, dd: r.delka != null ? r.delka - dVyp : null };
    });
    // střední orientační posun po kružnici (vážený délkou by šel, Groma bere prostý průměr)
    let o = radky[0].oi;
    for (let it = 0; it < 3; it++) {
        const s = radky.reduce((a, r) => a + gonDiff(r.oi, o), 0) / radky.length;
        o = gonNorm(o + s);
    }
    radky.forEach((r) => { r.v = gonDiff(r.oi, o); });
    const n = radky.length;
    const mOr = n > 1 ? Math.sqrt(radky.reduce((a, r) => a + r.v * r.v, 0) / (n - 1)) : null;
    return { o, radky, mOr, n };
}

/**
 * Polární metoda: podrobné body ze stanoviska S s orientačním posunem o.
 * zamery = [{ cislo, smer, delka, kod? }] → [{ cislo, y, x, sigma, kod }]
 */
export function polarniBody(S, o, zamery) {
    return zamery.map((z) => {
        const sigma = gonNorm(z.smer + o);
        const p = rajon(S, sigma, z.delka);
        return { cislo: z.cislo, y: p.y, x: p.x, sigma, d: z.delka, kod: z.kod ?? '' };
    });
}

/**
 * Volné stanovisko Helmertovou (shodnostní/podobnostní) transformací.
 * mereni = [{ cislo, bod:{y,x}, smer, delka }] (≥ 2 body se směrem i délkou)
 * meritko: false = shodnostní (měřítko 1, standard v katastru), true = podobnostní.
 * Vrací { S:{y,x}, o (orientační posun), q (měřítko), radky:[{cislo, vy, vx, vp}], m0, mxy, n }
 */
export function volneStanoviskoHelmert(mereni, meritko = false) {
    const m = mereni.filter((r) => r.delka != null && r.smer != null);
    if (m.length < 2) throw new Error('Volné stanovisko potřebuje aspoň 2 body se směrem i délkou');
    // místní soustava: stanovisko v počátku, osa x ve směru čtení 0
    const loc = m.map((r) => ({ y: r.delka * Math.sin(r.smer * GON), x: r.delka * Math.cos(r.smer * GON) }));
    const n = m.length;
    const cg = { y: 0, x: 0 }, cl = { y: 0, x: 0 };
    m.forEach((r, i) => { cg.y += r.bod.y / n; cg.x += r.bod.x / n; cl.y += loc[i].y / n; cl.x += loc[i].x / n; });
    // rotace θ a měřítko q: X = cg + q·R(θ)·(l − cl)
    let sA = 0, sB = 0, sLL = 0;
    m.forEach((r, i) => {
        const ly = loc[i].y - cl.y, lx = loc[i].x - cl.x, gy = r.bod.y - cg.y, gx = r.bod.x - cg.x;
        sA += gy * ly + gx * lx;      // Σ g·l
        sB += gy * lx - gx * ly;      // Σ g×l
        sLL += ly * ly + lx * lx;
    });
    const th = Math.atan2(sB, sA);
    const q = meritko ? Math.hypot(sA, sB) / sLL : 1;
    const c = Math.cos(th), s = Math.sin(th);
    // otočení směrníku o θ: (sin ψ, cos ψ) → (sin(ψ+θ), cos(ψ+θ))
    const rot = (ly, lx) => ({ y: q * (c * ly + s * lx), x: q * (c * lx - s * ly) });
    const rcl = rot(cl.y, cl.x);
    const S = { y: cg.y - rcl.y, x: cg.x - rcl.x };
    let vv = 0;
    const radky = m.map((r, i) => {
        const p = rot(loc[i].y, loc[i].x);
        const vy = r.bod.y - (S.y + p.y), vx = r.bod.x - (S.x + p.x);
        vv += vy * vy + vx * vx;
        return { cislo: r.cislo, vy, vx, vp: Math.hypot(vy, vx) };
    });
    const nadb = 2 * n - (meritko ? 4 : 3);
    const m0 = nadb > 0 ? Math.sqrt(vv / nadb) : null;
    // orientační posun: σ = ψ + o ; místní osa x = čtení 0 → otočená o θ
    const o = gonNorm(th / GON);
    return { S, o, q, radky, m0, mxy: m0 != null ? m0 / Math.SQRT2 : null, n, meritko };
}

/**
 * Vyrovnání stanoviska MNČ (Gauss–Newton): neznámé Y, X, o.
 * S0 = přibližné stanovisko; mereni = [{ cislo, bod, smer?, delka? }]
 * presnost = { mSmer (gon), mDelka (m) } — váhy 1/m².
 * Vrací { S, o, radky:[{cislo, vSmer, vDelka}], m0, mY, mX, mxy, iterace }
 */
export function vyrovnaniStanoviska(S0, mereni, presnost = { mSmer: 0.001, mDelka: 0.005 }) {
    let Y = S0.y, X = S0.x, o = null;
    // počáteční o ze směrů
    const seSmerem = mereni.filter((r) => r.smer != null);
    if (seSmerem.length) {
        o = orientaceStanoviska({ y: Y, x: X }, seSmerem.map((r) => ({ cislo: r.cislo, bod: r.bod, smer: r.smer }))).o;
    }
    const pS = 1 / (presnost.mSmer * presnost.mSmer), pD = 1 / (presnost.mDelka * presnost.mDelka);
    let iter = 0, N, w, Ninv = null, vv = 0, nObs = 0;
    for (iter = 1; iter <= 20; iter++) {
        // rovnice oprav: A·dx = l ; neznámé [dY, dX, do] (do v gonech)
        N = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; w = [0, 0, 0]; vv = 0; nObs = 0;
        const S = { y: Y, x: X };
        for (const r of mereni) {
            const dy = r.bod.y - Y, dx = r.bod.x - X, d2 = dy * dy + dx * dx, d = Math.sqrt(d2);
            if (r.smer != null && o != null) {
                // σ(Y,X) = ψ + o  →  v = σ − ψ − o ; ∂σ/∂Y = −dx/d² , ∂σ/∂X = dy/d²  [rad] → /GON [gon]
                const a = [-dx / d2 / GON, dy / d2 / GON, -1];
                const l = -gonDiff(smernik(S, r.bod), gonNorm(r.smer + o)); // l = ψ+o−σ (chceme v = A·dx − l)
                akum(N, w, a, l, pS); nObs++;
            }
            if (r.delka != null) {
                const a = [-dy / d, -dx / d, 0];
                const l = r.delka - d;
                akum(N, w, a, l, pD); nObs++;
            }
        }
        const unk = o != null ? 3 : 2;
        Ninv = inv(N, unk);
        if (!Ninv) throw new Error('Singulární soustava — málo měření nebo špatná geometrie');
        const dxv = mul(Ninv, w, unk);
        Y += dxv[0]; X += dxv[1]; if (unk === 3) o = gonNorm(o + dxv[2]);
        if (Math.hypot(dxv[0], dxv[1]) < 1e-5 && (unk < 3 || Math.abs(dxv[2]) < 1e-6)) break;
    }
    const S = { y: Y, x: X };
    const radky = mereni.map((r) => {
        const d = delka(S, r.bod), sig = smernik(S, r.bod);
        const vSmer = r.smer != null && o != null ? gonDiff(sig, gonNorm(r.smer + o)) : null;
        const vDelka = r.delka != null ? d - r.delka : null;
        if (vSmer != null) vv += pS * vSmer * vSmer;
        if (vDelka != null) vv += pD * vDelka * vDelka;
        return { cislo: r.cislo, vSmer, vDelka, sigma: sig, d };
    });
    const unk = o != null ? 3 : 2, nadb = nObs - unk;
    const m0 = nadb > 0 ? Math.sqrt(vv / nadb) : null;
    const mY = m0 != null ? m0 * Math.sqrt(Ninv[0][0]) : null, mX = m0 != null ? m0 * Math.sqrt(Ninv[1][1]) : null;
    return { S, o, radky, m0, mY, mX, mxy: mY != null ? Math.sqrt((mY * mY + mX * mX) / 2) : null, iterace: iter, nadb };
}

/**
 * Protínání zpět: stanovisko měří jen směry na ≥ 3 známé body.
 * mereni = [{ cislo, bod, smer }] → jako vyrovnaniStanoviska + { nebezpecny }
 */
export function protinaniZpet(mereni, presnost) {
    if (mereni.length < 3) throw new Error('Protínání zpět potřebuje aspoň 3 body');
    const [a, b, c] = mereni;
    let S0 = protinaniZpetTienstra(a.bod, b.bod, c.bod, a.smer, b.smer, c.smer);
    if (!S0) {
        // těžiště jako nouzový start
        S0 = { y: mereni.reduce((s, r) => s + r.bod.y, 0) / mereni.length, x: mereni.reduce((s, r) => s + r.bod.x, 0) / mereni.length };
    }
    const vys = vyrovnaniStanoviska(S0, mereni.map((r) => ({ cislo: r.cislo, bod: r.bod, smer: r.smer })), presnost);
    // nebezpečná kružnice: stanovisko na kružnici opsané prvním třem bodům
    const kr = kruzniceOpsana(a.bod, b.bod, c.bod);
    const nebezpecny = kr ? Math.abs(delka(kr.stred, vys.S) - kr.r) / kr.r < 0.05 : false;
    return { ...vys, nebezpecny };
}

function kruzniceOpsana(A, B, C) {
    const d = 2 * (A.y * (B.x - C.x) + B.y * (C.x - A.x) + C.y * (A.x - B.x));
    if (Math.abs(d) < 1e-9) return null;
    const a2 = A.y * A.y + A.x * A.x, b2 = B.y * B.y + B.x * B.x, c2 = C.y * C.y + C.x * C.x;
    const S = { y: (a2 * (B.x - C.x) + b2 * (C.x - A.x) + c2 * (A.x - B.x)) / d, x: (a2 * (C.y - B.y) + b2 * (A.y - C.y) + c2 * (B.y - A.y)) / d };
    return { stred: S, r: delka(S, A) };
}

// ---- drobná lineární algebra (3×3) ----
function akum(N, w, a, l, p) {
    for (let i = 0; i < 3; i++) { w[i] += p * a[i] * l; for (let j = 0; j < 3; j++) N[i][j] += p * a[i] * a[j]; }
}
function inv(N, n) {
    const A = N.map((r) => r.slice(0, n)), I = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
    for (let c = 0; c < n; c++) {
        let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
        if (Math.abs(A[p][c]) < 1e-18) return null;
        [A[c], A[p]] = [A[p], A[c]]; [I[c], I[p]] = [I[p], I[c]];
        const piv = A[c][c];
        for (let j = 0; j < n; j++) { A[c][j] /= piv; I[c][j] /= piv; }
        for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c]; for (let j = 0; j < n; j++) { A[r][j] -= f * A[c][j]; I[r][j] -= f * I[c][j]; } }
    }
    return I;
}
function mul(M, v, n) { const r = []; for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < n; j++) s += M[i][j] * v[j]; r.push(s); } return r; }
