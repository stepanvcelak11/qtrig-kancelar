// Základní souřadnicové výpočty v rovině S-JTSK. Body jsou { y, x } (kladné hodnoty).
import { GON, gonNorm, gonDiff } from './uhly.js';

/** Směrník σ_AB v gonech <0, 400) */
export function smernik(A, B) { return gonNorm(Math.atan2(B.y - A.y, B.x - A.x) / GON); }
/** Vodorovná délka */
export function delka(A, B) { return Math.hypot(B.y - A.y, B.x - A.x); }
/** Rajón: bod ve směrníku σ a délce d od A */
export function rajon(A, sigma, d) {
    return { y: A.y + d * Math.sin(sigma * GON), x: A.x + d * Math.cos(sigma * GON) };
}
/** Směrník a délka najednou */
export function smernikDelka(A, B) { return { sigma: smernik(A, B), d: delka(A, B) }; }

/**
 * Ortogonální metoda: A = počátek měřické přímky, B = koncový bod (nebo bod na ní),
 * s = staničení po přímce, k = kolmice (kladná VPRAVO ve směru A→B).
 * Volitelně měřená délka AB → měřítková oprava (rozdíl proti vypočtené délce).
 */
export function ortogonalni(A, B, s, k, dABmereno = null) {
    const sig = smernik(A, B);
    let q = 1, dAB = delka(A, B), rozdil = null;
    if (dABmereno != null && dABmereno > 0) { q = dAB / dABmereno; rozdil = dABmereno - dAB; }
    const P = rajon(rajon(A, sig, s * q), sig + 100, k * q);
    return { bod: P, sigma: sig, dAB, dABmereno, rozdil, q };
}

/**
 * Protínání vpřed ze směrníků: paprsek z A ve směrníku sA, z B ve směrníku sB.
 * Vrací null, když jsou paprsky rovnoběžné.
 */
export function protinaniSmerniky(A, sA, B, sB) {
    const a = sA * GON, b = sB * GON;
    const det = Math.sin(a) * Math.cos(b) - Math.cos(a) * Math.sin(b);
    if (Math.abs(det) < 1e-12) return null;
    const dy = B.y - A.y, dx = B.x - A.x;
    const t = (dy * Math.cos(b) - dx * Math.sin(b)) / det;
    const P = rajon(A, sA, t);
    const u = (dy * Math.cos(a) - dx * Math.sin(a)) / det;
    // úhel protnutí (kvalita): blízko 0 nebo 200 g = špatné
    const gamma = Math.abs(gonDiff(sB, sA));
    return { bod: P, dA: t, dB: u, gamma };
}

/**
 * Protínání vpřed z úhlů: ωA = úhel v A od směru na B k P, ωB = úhel v B od směru na A k P.
 * Úhly ORIENTOVANÉ po směru hodinových ručiček (kladné = P vpravo od A→B při ωA > 0).
 * Pro klasickou úlohu „P vlevo od AB“ se zadávají úhly levé: ωA se odečte (ωA < 0)
 * — stejně jako v učebnicích: σ_AP = σ_AB − ωA (vlevo), σ_BP = σ_BA + ωB.
 * Zde volíme jednoznačnou konvenci: σ_AP = σ_AB + ωA, σ_BP = σ_BA + ωB (oba měřené od
 * spojnice po směru hodinových ručiček).
 */
export function protinaniUhly(A, B, omegaA, omegaB) {
    const sAB = smernik(A, B), sBA = smernik(B, A);
    return protinaniSmerniky(A, sAB + omegaA, B, sBA + omegaB);
}

/**
 * Protínání z délek: |AP| = dA, |BP| = dB. Dvě řešení; strana = 'vpravo' | 'vlevo'
 * (vzhledem ke směru A→B). Vrací null, když kružnice nemají průsečík.
 */
export function protinaniDelky(A, B, dA, dB, strana = 'vpravo') {
    const c = delka(A, B);
    if (c <= 0 || dA + dB < c || Math.abs(dA - dB) > c) return null;
    const cosA = (dA * dA + c * c - dB * dB) / (2 * dA * c);
    const alfa = Math.acos(Math.max(-1, Math.min(1, cosA))) / GON;
    const sAB = smernik(A, B);
    const sig = strana === 'vlevo' ? sAB - alfa : sAB + alfa;
    const P = rajon(A, sig, dA);
    // úhel protnutí v P
    const cosP = (dA * dA + dB * dB - c * c) / (2 * dA * dB);
    const gamma = Math.acos(Math.max(-1, Math.min(1, cosP))) / GON;
    return { bod: P, alfa, gamma };
}

/**
 * Protínání zpět (resekce): stanovisko P měří směry ψ na tři známé body.
 * body = [{ bod:{y,x}, smer }, …] (aspoň 3). Tienstra s orientovanými úhly
 * + dotažení Gauss–Newtonem přes vyrovnání stanoviska (viz stanovisko.js).
 * Vrací { bod, orientace, nebezpecny } nebo null (nebezpečná kružnice).
 */
export function protinaniZpetTienstra(A, B, C, psiA, psiB, psiC) {
    const cot = (g) => 1 / Math.tan(g * GON);
    // úhly v P (orientované): α = B→C, β = C→A, γ = A→B
    const alfa = gonNorm(psiC - psiB), beta = gonNorm(psiA - psiC), gama = gonNorm(psiB - psiA);
    // úhly trojúhelníku stejně orientované
    const uA = gonNorm(smernik(A, C) - smernik(A, B));
    const uB = gonNorm(smernik(B, A) - smernik(B, C));
    const uC = gonNorm(smernik(C, B) - smernik(C, A));
    const K1 = 1 / (cot(uA) - cot(alfa)), K2 = 1 / (cot(uB) - cot(beta)), K3 = 1 / (cot(uC) - cot(gama));
    const S = K1 + K2 + K3;
    if (!isFinite(S) || Math.abs(S) < 1e-12) return null;
    return { y: (K1 * A.y + K2 * B.y + K3 * C.y) / S, x: (K1 * A.x + K2 * B.x + K3 * C.x) / S };
}

/** Plocha a obvod uzavřeného polygonu (pořadí vrcholů; plocha vždy kladná) */
export function plochaObvod(body) {
    let s2 = 0, o = 0, n = body.length;
    for (let i = 0; i < n; i++) {
        const a = body[i], b = body[(i + 1) % n];
        s2 += (a.y * b.x - b.y * a.x);
        o += delka(a, b);
    }
    return { plocha: Math.abs(s2) / 2, obvod: o, orientace: s2 >= 0 ? 1 : -1 };
}

/** Bod na přímce AB: pata kolmice z P, staničení s (od A) a kolmice k (kladná vpravo) */
export function patakolmice(A, B, P) {
    const sig = smernik(A, B), d = delka(A, B);
    const dy = P.y - A.y, dx = P.x - A.x;
    const s = dy * Math.sin(sig * GON) + dx * Math.cos(sig * GON);
    const k = dy * Math.sin((sig + 100) * GON) + dx * Math.cos((sig + 100) * GON);
    return { s, k, dAB: d, pata: rajon(A, sig, s) };
}

/** Průsečík přímek AB a CD (ne úseček); null pro rovnoběžky */
export function prusecikPrimek(A, B, C, D) {
    const r = protinaniSmerniky(A, smernik(A, B), C, smernik(C, D));
    return r ? r.bod : null;
}

/** Střed a poloměr kružnice třemi body; null pro kolineární */
export function kruzniceTremiBody(A, B, C) {
    const d = 2 * (A.y * (B.x - C.x) + B.y * (C.x - A.x) + C.y * (A.x - B.x));
    if (Math.abs(d) < 1e-12) return null;
    const a2 = A.y * A.y + A.x * A.x, b2 = B.y * B.y + B.x * B.x, c2 = C.y * C.y + C.x * C.x;
    const y = (a2 * (B.x - C.x) + b2 * (C.x - A.x) + c2 * (A.x - B.x)) / d;
    const x = (a2 * (C.y - B.y) + b2 * (A.y - C.y) + c2 * (B.y - A.y)) / d;
    const S = { y, x };
    return { stred: S, r: delka(S, A) };
}
