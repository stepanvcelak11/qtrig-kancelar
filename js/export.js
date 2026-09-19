// Export bodů: DXF (body + čísla + kódy po hladinách, S-JTSK), KML a GeoJSON (WGS84).
import { jtskToWgs } from '../geo/krovak.js';

const esc = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

/**
 * DXF R12 (nejlépe čitelný všude): POINT + TEXT čísla (+ kód), hladina = kód bodu.
 * Souřadnice: DXF X = −Y_JTSK, DXF Y = −X_JTSK (matematická orientace, sever nahoře) —
 * volba 'zaporne' (výchozí, Groma/MicroStation) nebo 'kladne' (X=Y, Y=X bez znaménka).
 */
export function dxf(body, { osy = 'zaporne', vyskaTextu = 0.5, cary = [] } = {}) {
    const X = (b) => osy === 'zaporne' ? -b.y : b.y, Y = (b) => osy === 'zaporne' ? -b.x : b.x;
    const f = (v) => (v == null ? 0 : v).toFixed(3);
    const hladiny = [...new Set(body.map((b) => vrstva(b.kod)))];
    let s = '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n6\n0\nENDSEC\n';
    s += '0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n' + (hladiny.length + 2) + '\n';
    for (const h of [...hladiny, 'CISLA', 'CARY']) s += `0\nLAYER\n2\n${h}\n70\n0\n62\n7\n6\nCONTINUOUS\n`;
    s += '0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
    for (const b of body) {
        if (b.y == null || b.x == null) continue;
        s += `0\nPOINT\n8\n${vrstva(b.kod)}\n10\n${f(X(b))}\n20\n${f(Y(b))}\n30\n${f(b.z)}\n`;
        s += `0\nTEXT\n8\nCISLA\n10\n${f(X(b) + vyskaTextu * 0.6)}\n20\n${f(Y(b) + vyskaTextu * 0.6)}\n30\n0\n40\n${vyskaTextu}\n1\n${b.cislo}${b.kod ? ' ' + b.kod : ''}\n`;
    }
    for (const c of cary) {
        if (!c.body || c.body.length < 2) continue;
        s += `0\nPOLYLINE\n8\n${c.hladina || 'CARY'}\n66\n1\n70\n${c.uzavrit ? 1 : 0}\n`;
        for (const b of c.body) s += `0\nVERTEX\n8\n${c.hladina || 'CARY'}\n10\n${f(X(b))}\n20\n${f(Y(b))}\n30\n${f(b.z)}\n`;
        s += '0\nSEQEND\n';
    }
    s += '0\nENDSEC\n0\nEOF\n';
    return s;
}
const vrstva = (kod) => (kod || 'BODY').replace(/[^A-Za-z0-9_\-]/g, '_').slice(0, 31).toUpperCase() || 'BODY';

export function kml(body, nazev = 'QTRIG Kancelář') {
    let s = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(nazev)}</name>\n<Style id="b"><IconStyle><scale>0.7</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><scale>0.8</scale></LabelStyle></Style>\n`;
    for (const b of body) {
        if (b.y == null || b.x == null) continue;
        const w = jtskToWgs(b.y, b.x, b.z ?? 200);
        s += `<Placemark><name>${esc(b.cislo)}</name><description>${esc((b.kod ? b.kod + ' · ' : '') + `Y ${b.y.toFixed(2)} X ${b.x.toFixed(2)}` + (b.z != null ? ` Z ${b.z.toFixed(2)}` : ''))}</description><styleUrl>#b</styleUrl><Point><coordinates>${w.lng.toFixed(8)},${w.lat.toFixed(8)},${(b.z ?? 0).toFixed(2)}</coordinates></Point></Placemark>\n`;
    }
    return s + '</Document></kml>\n';
}

export function geojson(body) {
    const fc = { type: 'FeatureCollection', features: [] };
    for (const b of body) {
        if (b.y == null || b.x == null) continue;
        const w = jtskToWgs(b.y, b.x, b.z ?? 200);
        fc.features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: b.z != null ? [+w.lng.toFixed(8), +w.lat.toFixed(8), +b.z.toFixed(3)] : [+w.lng.toFixed(8), +w.lat.toFixed(8)] }, properties: { cislo: b.cislo, kod: b.kod || '', y: +b.y.toFixed(3), x: +b.x.toFixed(3), z: b.z == null ? null : +b.z.toFixed(3) } });
    }
    return JSON.stringify(fc, null, 1);
}
