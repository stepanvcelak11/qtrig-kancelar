// Další úlohy podle Gromy: vyrovnávací přímka a kružnice, průsečíky, trasa, fasáda, kubatury
// (Delaunay), výškový pořad, KM-D napojení, transformace 5 parametrů, vytyčovací prvky.
import { GON, gonNorm, gonDiff } from './uhly.js';
import { smernik, delka, rajon, protinaniSmerniky, patakolmice, kruzniceTremiBody, plochaObvod } from './zaklad.js';

// ---------------- vyrovnávací přímka (ortogonální regrese, MNČ na kolmé vzdálenosti) ----------------
export function vyrovnavaciPrimka(body, dalsi = []) {
    const n = body.length; if (n < 2) throw new Error('Přímka potřebuje aspoň 2 definiční body');
    const cy = body.reduce((s, b) => s + b.y, 0) / n, cx = body.reduce((s, b) => s + b.x, 0) / n;
    let syy = 0, sxx = 0, syx = 0; body.forEach((b) => { const dy = b.y - cy, dx = b.x - cx; syy += dy * dy; sxx += dx * dx; syx += dy * dx; });
    const th = 0.5 * Math.atan2(2 * syx, syy - sxx); // směr hlavní osy v rovině (y, x)
    const sig = gonNorm(Math.atan2(Math.cos(th), Math.sin(th)) / GON); // směrník přímky: směrový vektor (dy, dx) = (cos φ, sin φ)
    const T = { y: cy, x: cx };
    const projekce = (b) => { const p = patakolmice(T, rajon(T, sig, 100), b); return { cislo: b.cislo, s: p.s, k: p.k, pata: p.pata, d: Math.abs(p.k) }; };
    const def = body.map(projekce), ost = dalsi.map(projekce);
    const smin = Math.min(...def.map((d) => d.s)), smax = Math.max(...def.map((d) => d.s));
    const vv = def.reduce((s, d) => s + d.k * d.k, 0);
    return { teziste: T, sigma: sig, zacatek: rajon(T, sig, smin), konec: rajon(T, sig, smax), delkaPrimky: smax - smin, definicni: def, dalsi: ost, m0: n > 2 ? Math.sqrt(vv / (n - 2)) : 0, maxOdchylka: Math.max(...def.map((d) => d.d)) };
}

// ---------------- vyrovnávací kružnice (Kåsa + Gauss-Newton na geometrické vzdálenosti) ----------------
export function vyrovnavaciKruznice(body, dalsi = [], Rfix = null) {
    const n = body.length; if (n < 3 && Rfix == null) throw new Error('Kružnice potřebuje aspoň 3 definiční body');
    // počáteční odhad (algebraický, Kåsa)
    let cy, cx, R;
    if (n >= 3) { const c = kruzniceTremiBody(body[0], body[Math.floor(n / 2)], body[n - 1]) || kruzniceTremiBody(body[0], body[1], body[2]); if (!c) throw new Error('Body leží na přímce'); cy = c.stred.y; cx = c.stred.x; R = c.r; }
    else { cy = (body[0].y + body[1].y) / 2; cx = (body[0].x + body[1].x) / 2; R = Rfix; }
    if (Rfix != null) R = Rfix;
    // Gauss-Newton: min Σ (d_i − R)²
    for (let it = 0; it < 50; it++) {
        let N = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], w = [0, 0, 0];
        body.forEach((b) => { const dy = b.y - cy, dx = b.x - cx, d = Math.hypot(dy, dx) || 1e-9; const a = [-dy / d, -dx / d, Rfix == null ? -1 : 0], l = R - d; for (let i = 0; i < 3; i++) { w[i] += a[i] * l; for (let j = 0; j < 3; j++) N[i][j] += a[i] * a[j]; } });
        const k = Rfix == null ? 3 : 2; const sol = resi(N, w, k); if (!sol) break;
        cy += sol[0]; cx += sol[1]; if (Rfix == null) R += sol[2];
        if (Math.hypot(sol[0], sol[1]) < 1e-7 && (Rfix != null || Math.abs(sol[2]) < 1e-7)) break;
        if (!isFinite(cy) || !isFinite(R)) throw new Error('Vyrovnání nekonverguje');
    }
    const S = { y: cy, x: cx };
    const projekce = (b) => { const d = delka(S, b), sig = smernik(S, b); return { cislo: b.cislo, d: d - R, prumet: rajon(S, sig, R), sigma: sig }; };
    const def = body.map(projekce), ost = dalsi.map(projekce);
    const vv = def.reduce((s, d) => s + d.d * d.d, 0), nadb = n - (Rfix == null ? 3 : 2);
    return { stred: S, R, definicni: def, dalsi: ost, m0: nadb > 0 ? Math.sqrt(vv / nadb) : 0, maxOdchylka: Math.max(...def.map((d) => Math.abs(d.d))) };
}
function resi(N, w, n) {
    const A = N.map((r) => r.slice(0, n)), b = w.slice(0, n);
    for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; if (Math.abs(A[p][c]) < 1e-14) return null; [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]]; for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let j = 0; j < n; j++) A[r][j] -= f * A[c][j]; b[r] -= f * b[c]; } }
    return b.map((v, i) => v / A[i][i]);
}

// ---------------- průsečíky ----------------
/** Průsečík přímek AB a CD s odsazením (kladné vpravo od směru A→B / C→D); výška z první přímky. */
export function prusecikPrimekOdsazeni(A, B, C, D, oAB = 0, oCD = 0) {
    const sAB = smernik(A, B), sCD = smernik(C, D);
    const A2 = rajon(A, sAB + 100, oAB), C2 = rajon(C, sCD + 100, oCD);
    const r = protinaniSmerniky(A2, sAB, C2, sCD); if (!r) return null;
    const dAB = delka(A, B), t = r.dA / dAB;
    const z = A.z != null && B.z != null ? A.z + (B.z - A.z) * t : null;
    return { bod: { ...r.bod, z }, uhel: Math.min(r.gamma, 200 - r.gamma), naAB: r.dA >= -1e-9 && r.dA <= dAB + 1e-9, naCD: r.dB >= -1e-9 && r.dB <= delka(C, D) + 1e-9 };
}
/** Průsečík orientovaného směru ze stanoviska S (směrník σ) s přímkou AB */
export function prusecikPrimkaSmer(S, sigma, A, B) {
    const r = protinaniSmerniky(S, sigma, A, smernik(A, B)); if (!r) return null;
    return { bod: r.bod, uhel: Math.min(r.gamma, 200 - r.gamma), d: r.dA, naAB: r.dB >= -1e-9 && r.dB <= delka(A, B) + 1e-9 };
}
/** Průsečíky přímky AB s kružnicí (střed S, poloměr R) — 0, 1 nebo 2 body */
export function prusecikPrimkaKruznice(A, B, S, R) {
    const p = patakolmice(A, B, S); const h = Math.abs(p.k); if (h > R + 1e-9) return [];
    const t = Math.sqrt(Math.max(0, R * R - h * h)); const sig = smernik(A, B);
    if (t < 1e-9) return [rajon(p.pata, sig, 0)];
    return [rajon(p.pata, sig, -t), rajon(p.pata, sig, t)];
}

// ---------------- trasa ----------------
/** Prvky trasy: délky, směrníky, vrcholové úhly, převýšení; odsazené body vlevo/vpravo */
export function trasa(body, odsazeni = 0) {
    const seg = [], vrcholy = [];
    for (let i = 0; i < body.length - 1; i++) { const a = body[i], b = body[i + 1]; seg.push({ od: a.cislo, do: b.cislo, d: delka(a, b), sigma: smernik(a, b), dh: a.z != null && b.z != null ? b.z - a.z : null, sklon: a.z != null && b.z != null ? (b.z - a.z) / delka(a, b) * 100 : null }); }
    for (let i = 1; i < body.length - 1; i++) vrcholy.push({ cislo: body[i].cislo, levy: gonNorm(seg[i].sigma - seg[i - 1].sigma + 200), lom: gonDiff(seg[i].sigma, seg[i - 1].sigma) });
    let st = 0; const stanicen = body.map((b, i) => { if (i) st += seg[i - 1].d; return st; });
    const vlevo = [], vpravo = [];
    if (odsazeni) for (let i = 0; i < body.length; i++) {
        const sIn = i > 0 ? seg[i - 1].sigma : seg[0].sigma, sOut = i < seg.length ? seg[i].sigma : seg[seg.length - 1].sigma;
        const half = gonDiff(sOut, sIn) / 2, sigB = gonNorm(sIn + half), k = odsazeni / Math.cos(half * GON); // osa úhlu, odsazení po půlícím směru
        vpravo.push({ cislo: body[i].cislo + 'P', ...rajon(body[i], sigB + 100, k), z: body[i].z }); vlevo.push({ cislo: body[i].cislo + 'L', ...rajon(body[i], sigB - 100, k), z: body[i].z });
    }
    return { seg, vrcholy, stanicen, delka: st, vlevo, vpravo };
}

// ---------------- fasáda ----------------
/** Sklopení bodů na svislé rovině dané L a P do 2D: y = staničení po fasádě, x = výška (Z) */
export function fasada(L, P, body) {
    const sig = smernik(L, P);
    return body.map((b) => { const p = patakolmice(L, P, b); return { cislo: b.cislo, y: p.s, x: b.z ?? 0, k: p.k, kod: b.kod }; });
}

// ---------------- kubatury: Delaunay + objem nad srovnávací rovinou ----------------
export function delaunay(body) {
    const pts = body.map((b, i) => ({ y: b.y, x: b.x, i })); const n = pts.length; if (n < 3) return [];
    let minY = Infinity, minX = Infinity, maxY = -Infinity, maxX = -Infinity; pts.forEach((p) => { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); });
    const dmax = Math.max(maxY - minY, maxX - minX) * 20, my = (minY + maxY) / 2, mx = (minX + maxX) / 2;
    const S = [{ y: my - dmax, x: mx - dmax, i: -1 }, { y: my, x: mx + dmax, i: -2 }, { y: my + dmax, x: mx - dmax, i: -3 }];
    const kruz = (a, b, c) => { const d = 2 * (a.y * (b.x - c.x) + b.y * (c.x - a.x) + c.y * (a.x - b.x)); if (Math.abs(d) < 1e-12) return null; const a2 = a.y * a.y + a.x * a.x, b2 = b.y * b.y + b.x * b.x, c2 = c.y * c.y + c.x * c.x; const y = (a2 * (b.x - c.x) + b2 * (c.x - a.x) + c2 * (a.x - b.x)) / d, x = (a2 * (c.y - b.y) + b2 * (a.y - c.y) + c2 * (b.y - a.y)) / d; return { y, x, r2: (a.y - y) ** 2 + (a.x - x) ** 2 }; };
    let tri = [{ a: S[0], b: S[1], c: S[2] }];
    for (const p of pts) {
        const spatne = tri.filter((t) => { const k = kruz(t.a, t.b, t.c); return k && (p.y - k.y) ** 2 + (p.x - k.x) ** 2 <= k.r2 + 1e-9; });
        const hrany = [];
        for (const t of spatne) for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) { const j = hrany.findIndex((h) => (h[0] === v && h[1] === u) || (h[0] === u && h[1] === v)); if (j >= 0) hrany.splice(j, 1); else hrany.push([u, v]); }
        tri = tri.filter((t) => !spatne.includes(t)); hrany.forEach(([u, v]) => tri.push({ a: u, b: v, c: p }));
    }
    return tri.filter((t) => t.a.i >= 0 && t.b.i >= 0 && t.c.i >= 0).map((t) => [t.a.i, t.b.i, t.c.i]);
}
/** Odstranění štíhlých obvodových trojúhelníků (poměr strana/výška > mez) — opakovaně */
export function orezObvod(body, tri, mez = 20) {
    let t = tri.slice(); let zmena = true;
    while (zmena) {
        zmena = false; const hrany = new Map(); t.forEach((tr) => [[0, 1], [1, 2], [2, 0]].forEach(([i, j]) => { const k = [tr[i], tr[j]].sort((a, b) => a - b).join('-'); hrany.set(k, (hrany.get(k) || 0) + 1); }));
        t = t.filter((tr) => { const obvod = [[0, 1], [1, 2], [2, 0]].some(([i, j]) => hrany.get([tr[i], tr[j]].sort((a, b) => a - b).join('-')) === 1); if (!obvod) return true; const P = tr.map((i) => body[i]); const A = plochaObvod(P).plocha; const strany = [delka(P[0], P[1]), delka(P[1], P[2]), delka(P[2], P[0])]; const pomer = Math.max(...strany.map((s) => s / (2 * A / s))); if (pomer > mez) { zmena = true; return false; } return true; });
    }
    return t;
}
export function kubatura(body, tri, Hsrov) {
    let objem = 0, plocha = 0, povrch = 0;
    for (const [i, j, k] of tri) {
        const P = [body[i], body[j], body[k]]; const A = plochaObvod(P).plocha; plocha += A;
        const hs = P.map((p) => (p.z ?? Hsrov) - Hsrov); objem += A * (hs[0] + hs[1] + hs[2]) / 3;
        const u = { y: P[1].y - P[0].y, x: P[1].x - P[0].x, z: (P[1].z ?? 0) - (P[0].z ?? 0) }, v = { y: P[2].y - P[0].y, x: P[2].x - P[0].x, z: (P[2].z ?? 0) - (P[0].z ?? 0) };
        povrch += 0.5 * Math.hypot(u.x * v.z - u.z * v.x, u.z * v.y - u.y * v.z, u.y * v.x - u.x * v.y);
    }
    return { objem, plocha, povrch, trojuhelniku: tri.length };
}

// ---------------- výškový pořad (trigonometrický) ----------------
/** useky = [{ od, do, dh }] (převýšení každého úseku, případně průměr obousměrného), Hzac, Hkon? */
export function vyskovyPorad(useky, Hzac, Hkon = null, mezni = null) {
    const suma = useky.reduce((s, u) => s + u.dh, 0); const uzaver = Hkon == null ? null : Hkon - (Hzac + suma);
    const sumaD = useky.reduce((s, u) => s + (u.d || 1), 0);
    let H = Hzac; const vysky = [{ cislo: useky[0].od, H }];
    useky.forEach((u) => { H += u.dh + (uzaver == null ? 0 : uzaver * (u.d || 1) / sumaD); vysky.push({ cislo: u.do, H }); });
    if (Hkon != null) vysky[vysky.length - 1].H = Hkon;
    return { suma, uzaver, vysky, mezni, stav: uzaver == null || mezni == null ? 'neposouzeno' : Math.abs(uzaver) > mezni ? 'prekroceno' : Math.abs(uzaver) > 0.8 * mezni ? 'varovani' : 'ok' };
}

// ---------------- KM-D napojení změny (KatV příloha 16.27) ----------------
/** b) 1: napojení v dosavadním bodu: dosavadní bod D (platné souřadnice), nově zaměřený N, druhý bod nové hranice B. Výsledek: nová hranice D–B, odchylky. */
export function kmdDosavadni(D, N, B, dMer = null) {
    const dp = Math.hypot(N.y - D.y, N.x - D.x); const dVyp = delka(D, B), dNov = delka(N, B);
    return { bod: { ...D }, dY: N.y - D.y, dX: N.x - D.x, dp, dVyp, dNov, dMer, rozdilDelky: dMer != null ? dMer - dVyp : null };
}
/** b) 2: napojení v novém bodu: dosavadní hranice A–B, nová hranice N (koncový bod) – C (druhý bod). Úhel > 50 g → průsečík, jinak kolmý průmět N na AB. */
export function kmdNovy(A, B, N, C, dMer = null) {
    const uhel = Math.abs(gonDiff(smernik(N, C), smernik(A, B))); const mensi = Math.min(uhel, 200 - uhel);
    let bod, zpusob, posun = null;
    if (mensi > 50) { const r = protinaniSmerniky(A, smernik(A, B), C, smernik(C, N)); bod = r ? r.bod : null; zpusob = 'průsečík'; }
    else { const p = patakolmice(A, B, N); bod = p.pata; posun = Math.abs(p.k); zpusob = 'kolmý průmět'; }
    const dVyp = bod ? delka(bod, C) : null;
    return { bod, uhel: mensi, zpusob, posun, dVyp, dMer, rozdilDelky: dMer != null && dVyp != null ? dMer - dVyp : null, naUsecce: bod ? patakolmice(A, B, bod).s >= -1e-9 && patakolmice(A, B, bod).s <= delka(A, B) + 1e-9 : false };
}

// ---------------- transformace 5 parametrů (rotace + dvě měřítka) ----------------
export function transformace5(identicke) {
    const n = identicke.length; if (n < 3) throw new Error('Afinní 5 st. volnosti potřebuje aspoň 3 identické body');
    // start z podobnostní
    const cz = { y: 0, x: 0 }, cc = { y: 0, x: 0 }; identicke.forEach((p) => { cz.y += p.z.y / n; cz.x += p.z.x / n; cc.y += p.c.y / n; cc.x += p.c.x / n; });
    let sA = 0, sB = 0, sZZ = 0; identicke.forEach((p) => { const zy = p.z.y - cz.y, zx = p.z.x - cz.x, cy = p.c.y - cc.y, cx = p.c.x - cc.x; sA += cy * zy + cx * zx; sB += cy * zx - cx * zy; sZZ += zy * zy + zx * zx; });
    let th = Math.atan2(sB, sA), my = Math.hypot(sA, sB) / sZZ, mx = my, ty = 0, tx = 0;
    const tr = (b, P = { th, my, mx, ty, tx }) => { const zy = b.y - cz.y, zx = b.x - cz.x; const c = Math.cos(P.th), s = Math.sin(P.th); return { y: cc.y + P.ty + c * P.my * zy + s * P.mx * zx, x: cc.x + P.tx - s * P.my * zy + c * P.mx * zx }; };
    for (let it = 0; it < 30; it++) {
        const N = Array.from({ length: 5 }, () => Array(5).fill(0)), w = Array(5).fill(0);
        identicke.forEach((p) => { const zy = p.z.y - cz.y, zx = p.z.x - cz.x, c = Math.cos(th), s = Math.sin(th); const t = tr(p.z); const ly = p.c.y - t.y, lx = p.c.x - t.x;
            const ay = [-s * my * zy + c * mx * zx, c * zy, s * zx, 1, 0], ax = [-c * my * zy - s * mx * zx, -s * zy, c * zx, 0, 1];
            for (let i = 0; i < 5; i++) { w[i] += ay[i] * ly + ax[i] * lx; for (let j = 0; j < 5; j++) N[i][j] += ay[i] * ay[j] + ax[i] * ax[j]; } });
        const d = resi(N, w, 5); if (!d) break; th += d[0]; my += d[1]; mx += d[2]; ty += d[3]; tx += d[4]; if (Math.max(...d.map(Math.abs)) < 1e-10) break;
    }
    let vv = 0; const radky = identicke.map((p) => { const t = tr(p.z); const vy = p.c.y - t.y, vx = p.c.x - t.x; vv += vy * vy + vx * vx; return { cislo: p.cislo, vy, vx, vp: Math.hypot(vy, vx) }; });
    const nadb = 2 * n - 5;
    return { typ: 'afinni5', param: { rotaceGon: gonNorm(th / GON), meritkoY: my, meritkoX: mx, tezisteZdroj: cz, tezisteCil: cc, ty, tx }, radky, m0: nadb > 0 ? Math.sqrt(vv / nadb) : null, transformuj: (b) => tr(b) };
}

// ---------------- vytyčovací prvky ----------------
/** Polární: ze stanoviska S s orientací O (směr na orientaci ψ0, default 0) pro body */
export function polarniVytycovaci(S, O, body, psi0 = 0, meritko = 1) {
    const sO = O ? smernik(S, O) : 0;
    return body.map((b) => { const sig = smernik(S, b), d = delka(S, b) / meritko; return { cislo: b.cislo, sigma: sig, smer: O ? gonNorm(psi0 + sig - sO) : sig, d, dz: S.z != null && b.z != null ? b.z - S.z : null, zOrientace: O ? { sigma: smernik(O, b), d: delka(O, b) / meritko } : null }; });
}
/** Ortogonální: od přímky A–B: staničení, kolmice (vpravo +), doměrek od B */
export function ortogonalniVytycovaci(A, B, body, meritko = 1) {
    const dAB = delka(A, B);
    return body.map((b) => { const p = patakolmice(A, B, b); return { cislo: b.cislo, s: p.s / meritko, k: p.k / meritko, domerek: (dAB - p.s) / meritko }; });
}
