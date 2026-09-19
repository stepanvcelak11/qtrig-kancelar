// Oměrné, výměry, transformace, výšky, redukce délek.
import { GON, gonNorm } from './uhly.js';
import { smernik, delka, rajon, plochaObvod } from './zaklad.js';
import { kriteria, posud } from './presnost.js';

// ---------------- Kontrolní a konstrukční oměrné ----------------
/**
 * Kontrolní oměrné: dvojice = [{ a:{cislo,y,x}, b:{cislo,y,x}, dMer }]
 * → řádky s vypočtenou délkou, rozdílem a posouzením proti u_d (kód kvality).
 */
export function kontrolniOmerne(dvojice, kod = 3) {
    const kr = kriteria(kod);
    return dvojice.map((p) => {
        const dVyp = delka(p.a, p.b), rozdil = p.dMer - dVyp, ud = kr.ud(dVyp);
        return { a: p.a.cislo, b: p.b.cislo, dMer: p.dMer, dVyp, rozdil, ud, ...posud(rozdil, ud) };
    });
}

/**
 * Konstrukční oměrné: bod P na spojnici/kolmici od dvou bodů A, B — zadán vzdáleností
 * dA od A a dB od B (protínání z délek) NEBO staničením po AB a kolmicí. Tady verze
 * „od rohů“: dA, dB, strana. Vrací bod + délku AB pro kontrolu.
 */
export { protinaniDelky as konstrukcniOmerne } from './zaklad.js';

// ---------------- Výměry ----------------
/** Výměra ze souřadnic: body v pořadí obvodu. Vrací m² a ha, obvod. */
export function vymeraZeSouradnic(body) {
    const r = plochaObvod(body);
    return { plocha: r.plocha, obvod: r.obvod, ha: r.plocha / 1e4, orientace: r.orientace };
}
/**
 * Výměra s dílčími parcelami: parcely = [{ cislo, body }]. Vrací i součet a rozdíl
 * proti celku (kontrola: díly = celek).
 */
export function vymeryDily(celek, parcely) {
    const cel = vymeraZeSouradnic(celek).plocha;
    const dily = parcely.map((p) => ({ cislo: p.cislo, plocha: vymeraZeSouradnic(p.body).plocha }));
    const soucet = dily.reduce((a, d) => a + d.plocha, 0);
    return { celek: cel, dily, soucet, rozdil: soucet - cel };
}

// ---------------- Transformace ----------------
/**
 * Podobnostní (Helmert, 4 parametry) / shodnostní (3 parametry, q = 1) / afinní (6 param.)
 * identicke = [{ cislo, z:{y,x} (zdroj), c:{y,x} (cíl) }]
 * Vrací { typ, param, radky:[{cislo, vy, vx, vp}], m0, transformuj(bod) }
 */
export function transformace(identicke, typ = 'helmert') {
    const n = identicke.length;
    if (typ === 'afinni') {
        if (n < 3) throw new Error('Afinní transformace potřebuje aspoň 3 identické body');
        // y' = a·y + b·x + c ; x' = d·y + e·x + f — dvě nezávislé MNČ
        const A = identicke.map((p) => [p.z.y, p.z.x, 1]);
        const sol = (rhs) => resiMNC(A, rhs);
        const py = sol(identicke.map((p) => p.c.y)), px = sol(identicke.map((p) => p.c.x));
        const tr = (b) => ({ y: py[0] * b.y + py[1] * b.x + py[2], x: px[0] * b.y + px[1] * b.x + px[2] });
        return hotovo('afinni', { a: py[0], b: py[1], c: py[2], d: px[0], e: px[1], f: px[2] }, tr, identicke, 6);
    }
    if (n < 2) throw new Error('Transformace potřebuje aspoň 2 identické body');
    const cz = { y: 0, x: 0 }, cc = { y: 0, x: 0 };
    identicke.forEach((p) => { cz.y += p.z.y / n; cz.x += p.z.x / n; cc.y += p.c.y / n; cc.x += p.c.x / n; });
    let sA = 0, sB = 0, sZZ = 0;
    identicke.forEach((p) => {
        const zy = p.z.y - cz.y, zx = p.z.x - cz.x, cy = p.c.y - cc.y, cx = p.c.x - cc.x;
        sA += cy * zy + cx * zx; sB += cy * zx - cx * zy; sZZ += zy * zy + zx * zx;
    });
    const th = Math.atan2(sB, sA);
    const q = typ === 'shodnostni' ? 1 : Math.hypot(sA, sB) / sZZ;
    const c = Math.cos(th), s = Math.sin(th);
    const tr = (b) => {
        const zy = b.y - cz.y, zx = b.x - cz.x;
        return { y: cc.y + q * (c * zy + s * zx), x: cc.x + q * (c * zx - s * zy) }; // směrníky se otočí o +θ
    };
    const param = { rotaceGon: gonNorm(th / GON), meritko: q, tezisteZdroj: cz, tezisteCil: cc };
    return hotovo(typ === 'shodnostni' ? 'shodnostni' : 'helmert', param, tr, identicke, typ === 'shodnostni' ? 3 : 4);
}
function hotovo(typ, param, tr, identicke, unk) {
    let vv = 0;
    const radky = identicke.map((p) => {
        const t = tr(p.z), vy = p.c.y - t.y, vx = p.c.x - t.x; vv += vy * vy + vx * vx;
        return { cislo: p.cislo, vy, vx, vp: Math.hypot(vy, vx) };
    });
    const nadb = 2 * identicke.length - unk;
    return { typ, param, radky, m0: nadb > 0 ? Math.sqrt(vv / nadb) : null, transformuj: tr };
}
function resiMNC(A, l) {
    const n = A[0].length, N = Array.from({ length: n }, () => Array(n).fill(0)), w = Array(n).fill(0);
    A.forEach((r, k) => { for (let i = 0; i < n; i++) { w[i] += r[i] * l[k]; for (let j = 0; j < n; j++) N[i][j] += r[i] * r[j]; } });
    // Gauss
    for (let c = 0; c < n; c++) {
        let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(N[r][c]) > Math.abs(N[p][c])) p = r;
        [N[c], N[p]] = [N[p], N[c]]; [w[c], w[p]] = [w[p], w[c]];
        for (let r = 0; r < n; r++) if (r !== c) { const f = N[r][c] / N[c][c]; for (let j = 0; j < n; j++) N[r][j] -= f * N[c][j]; w[r] -= f * w[c]; }
    }
    return w.map((v, i) => v / N[i][i]);
}

// ---------------- Výšky ----------------
export const R_ZEME = 6380703.6105; // poloměr Gaussovy koule pro S-JTSK (Křovák)
/**
 * Trigonometrické určení výšky: Hcil = Hst + vp + dv·cotg(z) − vc + oprava(zakřivení+refrakce)
 * z = zenitový úhel [gon], d = šikmá (sikma=true) nebo vodorovná délka, vp = výška přístroje,
 * vc = výška cíle, k = refrakční koeficient (0,13 v ČR).
 */
export function trigVyska({ Hst, z, d, sikma = true, vp = 0, vc = 0, k = 0.13, oprava = true }) {
    const zr = z * GON;
    const dv = sikma ? d * Math.sin(zr) : d;
    const prev = sikma ? d * Math.cos(zr) : d / Math.tan(zr);
    const kor = oprava ? (1 - k) * dv * dv / (2 * R_ZEME) : 0;
    return { H: Hst + vp + prev - vc + kor, prevyseni: prev, dVodorovna: dv, oprava: kor };
}
/**
 * Nivelační pořad: sestavy = [{ zpet, vpred }] (čtení na lati v m), Hzac, volitelně Hkon.
 * Vrací převýšení, uzávěr, opravy rovnoměrně po sestavách, výšky přestavových bodů.
 */
export function nivelace({ sestavy, Hzac, Hkon = null, delkaKm = null }) {
    const prev = sestavy.map((s) => s.zpet - s.vpred);
    const suma = prev.reduce((a, b) => a + b, 0);
    const uzaver = Hkon == null ? null : Hkon - (Hzac + suma);
    const opr = uzaver == null ? 0 : uzaver / sestavy.length;
    let H = Hzac; const vysky = [H];
    prev.forEach((p) => { H += p + opr; vysky.push(H); });
    // mezní odchylka technické nivelace: 40·√R [mm], R v km (ČSN 73 0415 – technická nivelace)
    const mezni = delkaKm != null ? 0.040 * Math.sqrt(delkaKm) : null;
    return { prevyseni: prev, sumaPrevyseni: suma, uzaver, oprava: opr, vysky, mezni, posouzeni: uzaver == null ? null : posud(uzaver, mezni) };
}

// ---------------- Redukce délek do S-JTSK ----------------
const S0 = (78 + 30 / 60) * Math.PI / 180, N_KUZEL = Math.sin(S0), K0 = 0.9999;
const RHO0 = K0 * R_ZEME / Math.tan(S0);
/** Délkové zkreslení Křovákova zobrazení v bodě (Y, X) — poměr délka v S-JTSK / délka na kouli */
export function meritkoKrovak(Y, X) {
    const rho = Math.hypot(Y, X);
    const S = 2 * Math.atan(Math.pow(RHO0 / rho, 1 / N_KUZEL) * Math.tan(S0 / 2 + Math.PI / 4)) - Math.PI / 2;
    return N_KUZEL * rho / (R_ZEME * Math.cos(S));
}
/**
 * Redukce měřené vodorovné délky: z nadmořské výšky H na kouli (R/(R+H)) a do zobrazení.
 * Vrací { dKoule, dSjtsk, mVyska, mZobrazeni, mCelkem }
 */
export function redukceDelky(d, H, Y, X) {
    const mV = R_ZEME / (R_ZEME + (H || 0));
    const mZ = (Y != null && X != null) ? meritkoKrovak(Y, X) : 1;
    return { dKoule: d * mV, dSjtsk: d * mV * mZ, mVyska: mV, mZobrazeni: mZ, mCelkem: mV * mZ };
}
