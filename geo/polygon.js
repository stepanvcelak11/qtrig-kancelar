// Polygonový pořad — všechny běžné typy, s úhlovým a souřadnicovým vyrovnáním.
import { gonNorm, gonDiff } from './uhly.js';
import { smernik, delka, rajon } from './zaklad.js';

/**
 * Vstup:
 *   typ: 'oboustranne' (připojený + oboustranně orientovaný), 'jednostranne' (připojený na
 *        obou koncích, orientovaný jen na začátku), 'vetknuty' (připojený na obou koncích,
 *        bez orientací), 'uzavreny' (začíná i končí na A, orientace na začátku),
 *        'volny' (jen počáteční bod a orientace — bez kontroly)
 *   A, B: známé krajní body {y,x}; PA, PB: orientační body (podle typu)
 *   vrcholy: [{ cislo, omega, d }] — ω = LEVOSTRANNÝ vrcholový úhel v gonech (měřený proti
 *        směru hodinových ručiček od předchozího k následujícímu bodu — konvence Groma
 *        „levý úhel“), d = délka k NÁSLEDUJÍCÍMU bodu. První prvek je bod A (jeho ω je úhel
 *        v A mezi PA a prvním vrcholem), poslední prvek je bod B (ω v B mezi posledním
 *        vrcholem a PB; pro typ bez koncové orientace se ω v B ignoruje, d v B se ignoruje).
 *   levy: true = levostranné úhly (výchozí), false = pravostranné.
 * Výstup: { body:[{cislo,y,x,sigma,d}], uhlovyUzaver, opravaUhlu, souradnicovyUzaver:{dy,dx,dp},
 *          sumaD, n, smerniky, mezni? } — mezní se doplňují v presnost.js
 */
export function polygonovyPorad({ typ, A, B, PA, PB, vrcholy, levy = true }) {
    if (!vrcholy || vrcholy.length < 2) throw new Error('Pořad potřebuje aspoň počáteční a koncový bod');
    const V = vrcholy.map((v) => ({ ...v, omega: levy ? v.omega : (v.omega == null ? null : gonNorm(-v.omega)) }));
    const n = V.length;                       // počet vrcholů včetně krajních
    const strany = V.slice(0, n - 1).map((v) => v.d);
    if (strany.some((d) => !(d > 0))) throw new Error('Chybí délka strany');
    const sumaD = strany.reduce((a, b) => a + b, 0);

    // --- vetknutý pořad: bez orientací → spočítat v místní soustavě, natočit na B ---
    if (typ === 'vetknuty') {
        let sig = 0; const loc = [{ y: 0, x: 0 }];
        for (let i = 1; i < n; i++) {
            if (i > 1) sig = gonNorm(sig + V[i - 1].omega - 200);
            loc.push(rajon(loc[i - 1], sig, strany[i - 1]));
        }
        const L = loc[n - 1];
        const sigLoc = smernik(loc[0], L), sigSk = smernik(A, B);
        const rot = gonNorm(sigSk - sigLoc);
        const dLoc = delka(loc[0], L), dSk = delka(A, B);
        const body = loc.map((p, i) => {
            const s = smernik(loc[0], p), d = delka(loc[0], p);
            const q = i === 0 ? A : rajon(A, s + rot, d);
            return { cislo: V[i].cislo, y: q.y, x: q.x };
        });
        // uzávěr = rozdíl délky (po natočení sedí směr přesně, zbývá délka)
        const dp = dSk - dLoc;
        // rozdělení délkové odchylky úměrně délce
        let s = 0;
        for (let i = 1; i < n; i++) {
            s += strany[i - 1];
            const sB = smernik(A, B), t = s / sumaD;
            body[i] = { ...body[i], ...rajon(body[i], sB, dp * t) };
        }
        body[n - 1].y = B.y; body[n - 1].x = B.x;
        doplnSmerniky(body);
        return { typ, body, uhlovyUzaver: null, opravaUhlu: null, souradnicovyUzaver: { dy: null, dx: null, dp: Math.abs(dp) }, sumaD, n, rotace: rot };
    }

    // --- pořady s počáteční orientací ---
    if (!PA) throw new Error('Chybí orientační bod na začátku');
    let sig = smernik(PA, A);            // jako by pořad přicházel z PA
    const smerniky = [];
    // úhlový uzávěr (jen když je koncová orientace nebo uzavřený)
    let uhlovyUzaver = null, opravaUhlu = 0, pocetUhlu = 0;
    if (typ === 'oboustranne' || typ === 'uzavreny') {
        const konec = typ === 'oboustranne' ? PB : PA;
        if (!konec) throw new Error('Chybí orientační bod na konci');
        const sigKonec = smernik(typ === 'uzavreny' ? A : B, konec);
        let s = sig;
        for (let i = 0; i < n; i++) s = gonNorm(s + V[i].omega - 200);
        uhlovyUzaver = gonDiff(s, sigKonec);
        pocetUhlu = n;
        opravaUhlu = -uhlovyUzaver / pocetUhlu;
    }
    // směrníky stran
    const sigmy = [];
    let s = sig;
    for (let i = 0; i < n - 1; i++) {
        s = gonNorm(s + V[i].omega + opravaUhlu - 200);
        sigmy.push(s);
    }
    // souřadnicové rozdíly
    const dY = [], dX = [];
    for (let i = 0; i < n - 1; i++) { dY.push(strany[i] * Math.sin(sigmy[i] * Math.PI / 200)); dX.push(strany[i] * Math.cos(sigmy[i] * Math.PI / 200)); }
    const sumY = dY.reduce((a, b) => a + b, 0), sumX = dX.reduce((a, b) => a + b, 0);
    const konecBod = typ === 'uzavreny' ? A : B;
    let oy = null, ox = null;
    if (typ !== 'volny') {
        if (!konecBod) throw new Error('Chybí koncový bod');
        oy = konecBod.y - (A.y + sumY); ox = konecBod.x - (A.x + sumX);
    }
    const body = [{ cislo: V[0].cislo, y: A.y, x: A.x }];
    let cy = A.y, cx = A.x;
    for (let i = 0; i < n - 1; i++) {
        const t = oy == null ? 0 : strany[i] / sumaD;
        cy += dY[i] + (oy ?? 0) * t; cx += dX[i] + (ox ?? 0) * t;
        body.push({ cislo: V[i + 1].cislo, y: cy, x: cx });
    }
    if (oy != null) { body[n - 1].y = konecBod.y; body[n - 1].x = konecBod.x; }
    doplnSmerniky(body);
    return {
        typ, body, uhlovyUzaver, opravaUhlu: uhlovyUzaver == null ? null : opravaUhlu, pocetUhlu,
        souradnicovyUzaver: { dy: oy, dx: ox, dp: oy == null ? null : Math.hypot(oy, ox) }, sumaD, n, smerniky: sigmy,
    };
}

function doplnSmerniky(body) {
    for (let i = 0; i < body.length - 1; i++) { body[i].sigma = smernik(body[i], body[i + 1]); body[i].d = delka(body[i], body[i + 1]); }
}
