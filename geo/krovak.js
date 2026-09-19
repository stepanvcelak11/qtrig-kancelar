// Křovákovo zobrazení (S-JTSK, kladné Y/X) ↔ WGS84 pro mapu a KML.
// Besselův elipsoid → Gaussova koule → kuželové zobrazení; mezi elipsoidy 7prvková
// Helmertova transformace (ČÚZK, „position vector“ jako v proj4 +towgs84), přesnost ~1 m.
// Pro přesné práce se souřadnice NEPŘEVÁDĚJÍ — jádro počítá přímo v S-JTSK.
const D2R = Math.PI / 180;
const A_B = 6377397.15508, E2_B = 0.006674372230614, E_B = Math.sqrt(E2_B);
const A_W = 6378137.0, E2_W = 0.00669437999014;
const ALFA = 1.000597498371542, K_U = 1.003419163966575, R = 6380703.6105, K0 = 0.9999;
const S0 = 78.5 * D2R, N_K = Math.sin(S0), RHO0 = K0 * R / Math.tan(S0);
const UQ = (59 + 42 / 60 + 42.6969 / 3600) * D2R;
const LAM0_F = (42 + 30 / 60) * D2R, FERRO = (17 + 40 / 60) * D2R; // λ0 od Ferra; Ferro = Greenwich − 17°40'
// Helmert Bessel(S-JTSK) → WGS84: dx dy dz [m], rx ry rz ["], m [ppm] — STEJNÉ hodnoty jako
// proj4 +towgs84 v AR Geodetu (EPSG:5514), aby body poslané tam a zpět seděly na mm.
const H = { dx: 570.8, dy: 85.7, dz: 462.8, rx: 4.998, ry: 1.587, rz: 5.261, m: 3.56 };

/** φ, λ (stupně, Bessel) → { y, x } */
export function besselToJtsk(latDeg, lngDeg) {
    const fi = latDeg * D2R, la = lngDeg * D2R + FERRO;
    const es = E_B * Math.sin(fi);
    const U = 2 * Math.atan(K_U * Math.pow(Math.tan(fi / 2 + Math.PI / 4), ALFA) * Math.pow((1 - es) / (1 + es), ALFA * E_B / 2)) - Math.PI / 2;
    const dV = ALFA * (LAM0_F - la);
    const S = Math.asin(Math.sin(UQ) * Math.sin(U) + Math.cos(UQ) * Math.cos(U) * Math.cos(dV));
    const D = Math.asin(Math.cos(U) * Math.sin(dV) / Math.cos(S));
    const rho = RHO0 * Math.pow(Math.tan(S0 / 2 + Math.PI / 4) / Math.tan(S / 2 + Math.PI / 4), N_K);
    const eps = N_K * D;
    return { y: rho * Math.sin(eps), x: rho * Math.cos(eps) };
}
/** { y, x } → φ, λ (stupně, Bessel) */
export function jtskToBessel(y, x) {
    const rho = Math.hypot(y, x), eps = Math.atan2(y, x), D = eps / N_K;
    const S = 2 * Math.atan(Math.pow(RHO0 / rho, 1 / N_K) * Math.tan(S0 / 2 + Math.PI / 4)) - Math.PI / 2;
    const U = Math.asin(Math.sin(UQ) * Math.sin(S) - Math.cos(UQ) * Math.cos(S) * Math.cos(D));
    const dV = Math.asin(Math.cos(S) * Math.sin(D) / Math.cos(U));
    const la = LAM0_F - dV / ALFA - FERRO;
    let fi = U;
    for (let i = 0; i < 8; i++) {
        const es = E_B * Math.sin(fi);
        fi = 2 * Math.atan(Math.pow(1 / K_U, 1 / ALFA) * Math.pow(Math.tan(U / 2 + Math.PI / 4), 1 / ALFA) * Math.pow((1 + es) / (1 - es), E_B / 2)) - Math.PI / 2;
    }
    return { lat: fi / D2R, lng: la / D2R };
}
function geoToXyz(latDeg, lngDeg, h, a, e2) {
    const fi = latDeg * D2R, la = lngDeg * D2R, N = a / Math.sqrt(1 - e2 * Math.sin(fi) ** 2);
    return [(N + h) * Math.cos(fi) * Math.cos(la), (N + h) * Math.cos(fi) * Math.sin(la), (N * (1 - e2) + h) * Math.sin(fi)];
}
function xyzToGeo([X, Y, Z], a, e2) {
    const la = Math.atan2(Y, X), p = Math.hypot(X, Y); let fi = Math.atan2(Z, p * (1 - e2)), h = 0;
    for (let i = 0; i < 6; i++) { const N = a / Math.sqrt(1 - e2 * Math.sin(fi) ** 2); h = p / Math.cos(fi) - N; fi = Math.atan2(Z, p * (1 - e2 * N / (N + h))); }
    return { lat: fi / D2R, lng: la / D2R, h };
}
const S2R = Math.PI / 180 / 3600;
function helmert([X, Y, Z], inverzni = false) {
    const rx = H.rx * S2R, ry = H.ry * S2R, rz = H.rz * S2R, m = 1 + H.m * 1e-6;
    if (!inverzni) return [H.dx + m * (X - rz * Y + ry * Z), H.dy + m * (rz * X + Y - rx * Z), H.dz + m * (-ry * X + rx * Y + Z)];
    const x = (X - H.dx) / m, y = (Y - H.dy) / m, z = (Z - H.dz) / m;
    return [x + rz * y - ry * z, -rz * x + y + rx * z, ry * x - rx * y + z];
}
/** WGS84 φ, λ → S-JTSK { y, x } (kladné) */
export function wgsToJtsk(lat, lng, h = 200) {
    const b = xyzToGeo(helmert(geoToXyz(lat, lng, h, A_W, E2_W), true), A_B, E2_B);
    return besselToJtsk(b.lat, b.lng);
}
/** S-JTSK { y, x } → WGS84 { lat, lng } */
export function jtskToWgs(y, x, h = 200) {
    const b = jtskToBessel(Math.abs(y), Math.abs(x));
    const w = xyzToGeo(helmert(geoToXyz(b.lat, b.lng, h, A_B, E2_B)), A_W, E2_W);
    return { lat: w.lat, lng: w.lng };
}
