// Mezní odchylky. Zdroje:
//  - vyhláška č. 357/2013 Sb., příloha bod 13 (charakteristiky a kritéria přesnosti):
//    m_xy podle kódu kvality, u_xy = 2·m_xy, u_p = √2·u_xy, oměrné m_d = k·(d+12)/(d+20),
//    k = √2·m_xy, u_d = 2·m_d  (ověřeno: ČÚZK „Tolerance hraničních bodů“, ČVUT people.fsv.cvut.cz/~mapovani)
//  - polygonové pořady: tab. 7.1 skript KGM ZČU (Návod pro obnovu KO): úhlový uzávěr
//    25·√(n+2) mgon (PPBP) / 100·√(n+3) mgon (pomocné pořady), polohová odchylka
//    0,005·√Σs + 0,04 m / 0,005·√Σs + 0,10 m; vetknutý pořad Δp = 0,006·√Σd (ČVUT).
//  Všechny konstanty jsou zde na jednom místě, aby šly ověřit a upravit.

export const KODY_KVALITY = {
    3: { mxy: 0.14, popis: 'kód 3 — měřeno v S-JTSK (m_xy 0,14 m)' },
    4: { mxy: 0.26, popis: 'kód 4 — m_xy 0,26 m' },
    5: { mxy: 0.50, popis: 'kód 5 — m_xy 0,50 m' },
    6: { mxy: 0.21, popis: 'kód 6 — digitalizace 1:1000 (m_xy 0,21 m)' },
    7: { mxy: 0.50, popis: 'kód 7 — digitalizace 1:2000 (m_xy 0,50 m)' },
    8: { mxy: 1.00, popis: 'kód 8 — digitalizace 1:2880 (m_xy 1,00 m)' },
};

export const PORADY = {
    ppbp: { nazev: 'PPBP', uhlovy: (n) => 0.025 * Math.sqrt(n + 2), polohovy: (sumaD) => 0.005 * Math.sqrt(sumaD) + 0.04 },
    pomocny: { nazev: 'pomocný pořad', uhlovy: (n) => 0.100 * Math.sqrt(n + 3), polohovy: (sumaD) => 0.005 * Math.sqrt(sumaD) + 0.10 },
    vetknuty: { nazev: 'vetknutý pořad', uhlovy: () => null, polohovy: (sumaD) => 0.006 * Math.sqrt(sumaD) },
};

/** Kritéria pro kód kvality (výchozí 3) */
export function kriteria(kod = 3) {
    const k = KODY_KVALITY[kod] || KODY_KVALITY[3];
    const mxy = k.mxy, uxy = 2 * mxy, up = Math.SQRT2 * uxy, kd = Math.SQRT2 * mxy;
    return {
        kod, mxy, uxy, up, kd,
        /** základní střední chyba délky pro délku d */
        md: (d) => kd * (d + 12) / (d + 20),
        /** mezní rozdíl délky (oměrné) */
        ud: (d) => 2 * kd * (d + 12) / (d + 20),
    };
}

/**
 * Posouzení hodnoty proti mezní odchylce.
 * Vrací { stav: 'ok' | 'varovani' | 'prekroceno', pomer, hodnota, mezni }
 * varování = nad 80 % meze (Groma jen hlásí překročení; my upozorníme dřív).
 */
export function posud(hodnota, mezni) {
    if (mezni == null || hodnota == null) return { stav: 'neposouzeno', pomer: null, hodnota, mezni };
    const p = Math.abs(hodnota) / mezni;
    return { stav: p > 1 ? 'prekroceno' : p > 0.8 ? 'varovani' : 'ok', pomer: p, hodnota, mezni };
}

/** Oměrná: měřená vs. vypočtená délka */
export function posudOmernou(dMer, dVyp, kod = 3) {
    const kr = kriteria(kod), rozdil = dMer - dVyp;
    return { rozdil, ...posud(rozdil, kr.ud(dVyp)) };
}

/** Dvojí určení bodu: rozdíl souřadnic proti u_xy a polohový rozdíl proti u_p */
export function posudDvojiUrceni(P1, P2, kod = 3) {
    const kr = kriteria(kod), dy = P2.y - P1.y, dx = P2.x - P1.x, dp = Math.hypot(dy, dx);
    return { dy, dx, dp, y: posud(dy, kr.uxy), x: posud(dx, kr.uxy), poloha: posud(dp, kr.up) };
}

/**
 * Výběrová střední souřadnicová chyba z N dvojic (kontrolní body):
 * s_xy = sqrt( Σ(Δx²+Δy²) / (2·N·k) ), k = 2 když obě určení stejné přesnosti (jinak 1).
 * Posouzení: s_xy ≤ ω_2N · u_xy, koeficient ω_2N: 1,15 pro N<20? — vyhláška uvádí ω_2N
 * pro N ≤ 20: 1,15? (hodnota se ověřuje; do ověření necháme 1,15 pro N<20 a 1,0 pro N≥20).
 */
export function vyberovaChyba(dvojice, kod = 3, stejnaPresnost = true) {
    const N = dvojice.length; if (!N) return null;
    const k = stejnaPresnost ? 2 : 1;
    const s = Math.sqrt(dvojice.reduce((a, p) => a + p.dy * p.dy + p.dx * p.dx, 0) / (2 * N * k));
    const kr = kriteria(kod), omega = N < 20 ? 1.15 : 1.0;
    return { N, sxy: s, mezni: omega * kr.uxy, omega, ...posud(s, omega * kr.uxy) };
}

/** Polygonový pořad: uzávěry proti mezním */
export function posudPorad(vysledek, druh = 'pomocny') {
    const P = PORADY[druh] || PORADY.pomocny;
    const n = vysledek.n, sumaD = vysledek.sumaD;
    return {
        druh: P.nazev,
        uhlovy: vysledek.uhlovyUzaver == null ? null : posud(vysledek.uhlovyUzaver, P.uhlovy(n)),
        polohovy: vysledek.souradnicovyUzaver?.dp == null ? null : posud(vysledek.souradnicovyUzaver.dp, P.polohovy(sumaD)),
    };
}

/**
 * Mezní odchylka výměry (vyhl. 357/2013, příloha bod 14.9 — u_P v m² podle kódu kvality):
 * kód 3: u_P = 2·(0,14·√P + 0,05)? — VZOREC NEOVĚŘEN, do ověření se vrací null.
 */
export function mezniVymera(/* P, kod */) { return null; }
