// Katalog vybavení s parametry podle katalogových listů výrobců.

export const PALETTES = {
  leica: { body: 0xede8dc, accent: 0x125c3d, trim: 0x1c1e21, label: 0xcc0d14 },
  trimble: { body: 0xfac70a, accent: 0x333538, trim: 0x19191c, label: 0x0d408c },
  topcon: { body: 0xf5b312, accent: 0xf0f0eb, trim: 0x212124, label: 0x0d4d33 },
  generic: { body: 0xf2bd1a, accent: 0x2e3033, trim: 0x1f1f21, label: 0xd91a1a },
};

export const CATEGORIES = [
  { id: 'ts', title: 'Totální stanice', icon: '⌖' },
  { id: 'level', title: 'Nivelační přístroje', icon: '═' },
  { id: 'gnss', title: 'GNSS RTK', icon: '📡' },
  { id: 'acc', title: 'Příslušenství', icon: '△' },
];

export const CATALOG = [
  {
    id: 'leica-ts16', name: 'TS16', brand: 'leica', maker: 'Leica', cat: 'ts', kind: 'ts',
    tagline: 'Samoučící robotická totální stanice',
    spec: { accuracy: 1, magnification: 30, fov: 90, minFocus: 1.7, edmPrism: 3500, edmRL: 1000, edmA: 1, edmB: 1.5,
      compensator: 4, circular: 6, trunnion: 0.196, fineGonPerTurn: 0.25, weight: 5.3, display: 'TS16 R1000' },
  },
  {
    id: 'trimble-s7', name: 'S7', brand: 'trimble', maker: 'Trimble', cat: 'ts', kind: 'ts',
    tagline: 'Servopohony MagDrive, technologie VISION',
    spec: { accuracy: 1, magnification: 30, fov: 80, minFocus: 1.5, edmPrism: 2500, edmRL: 1300, edmA: 1, edmB: 2,
      compensator: 5.4, circular: 8, trunnion: 0.196, fineGonPerTurn: 0.25, weight: 5.5, display: 'S7 1" DR+' },
  },
  {
    id: 'topcon-gt1200', name: 'GT-1200', brand: 'topcon', maker: 'Topcon', cat: 'ts', kind: 'ts',
    tagline: 'Robotická stanice s pohony UltraSonic',
    spec: { accuracy: 1, magnification: 30, fov: 90, minFocus: 1.3, edmPrism: 5000, edmRL: 1000, edmA: 1, edmB: 2,
      compensator: 6, circular: 10, trunnion: 0.192, fineGonPerTurn: 0.25, weight: 5.8, display: 'GT-1201' },
  },
  {
    id: 'leica-na730', name: 'NA730 plus', brand: 'leica', maker: 'Leica', cat: 'level', kind: 'level',
    tagline: 'Automatický nivelační přístroj s magneticky tlumeným kompenzátorem',
    spec: { magnification: 30, accuracyKm: 1.2, compensator: 15, circular: 10, minFocus: 0.5, los: 0.105, fineGonPerTurn: 0.5, weight: 1.7 },
  },
  {
    id: 'topcon-atb4a', name: 'AT-B4A', brand: 'topcon', maker: 'Topcon', cat: 'level', kind: 'level',
    tagline: 'Odolný stavební nivelační přístroj',
    spec: { magnification: 24, accuracyKm: 2.0, compensator: 15, circular: 10, minFocus: 0.2, los: 0.098, fineGonPerTurn: 0.5, weight: 1.7 },
  },
  {
    id: 'leica-gs18t', name: 'GS18 T', brand: 'leica', maker: 'Leica', cat: 'gnss', kind: 'gnss',
    tagline: 'GNSS RTK rover s kompenzací náklonu',
    spec: { channels: 555, rtkH: 8, rtkV: 15, ppm: 0.5, tiltName: 'IMU bez kalibrace', tiltMax: 30, tiltErr: 0.4, pole: 2.0, antennaD: 0.17, antennaH: 0.095, weight: 1.25 },
  },
  {
    id: 'trimble-r12i', name: 'R12i', brand: 'trimble', maker: 'Trimble', cat: 'gnss', kind: 'gnss',
    tagline: 'ProPoint GNSS s kompenzací náklonu TIP',
    spec: { channels: 672, rtkH: 8, rtkV: 15, ppm: 1, tiltName: 'Trimble TIP', tiltMax: 30, tiltErr: 0.5, pole: 2.0, antennaD: 0.165, antennaH: 0.1, weight: 1.12 },
  },
  {
    id: 'tripod', name: 'Dřevěný stativ GST20', brand: 'generic', maker: '', cat: 'acc', kind: 'tripod',
    tagline: 'Těžký dřevěný stativ se středicím šroubem 5/8"',
    spec: { height: 1.25, range: '1,07 – 1,72 m', weight: 6.4 },
  },
  {
    id: 'rod', name: 'Nivelační lať', brand: 'generic', maker: '', cat: 'acc', kind: 'rod',
    tagline: 'Hliníková teleskopická lať, E-dělení',
    spec: { length: 3.0, sections: 3, weight: 1.6 },
  },
];

export const byId = (id) => CATALOG.find((m) => m.id === id);
export const displayName = (m) => (m.maker ? `${m.maker} ${m.name}` : m.name);

export function specRows(m) {
  const s = m.spec;
  switch (m.kind) {
    case 'ts': return [
      ['Přesnost úhlů', `${s.accuracy}" (${(s.accuracy / 3.24).toFixed(1)} mgon)`],
      ['Dalekohled', `${s.magnification}× · zorné pole ${s.fov}'`],
      ['Dálkoměr hranol', `${s.edmPrism} m · ${s.edmA} mm + ${s.edmB} ppm`],
      ['Bez hranolu', `${s.edmRL} m`],
      ['Kompenzátor', `dvouosý ±${s.compensator}'`],
      ['Krabicová libela', `${s.circular}'/2 mm`],
      ['Hmotnost', `${s.weight} kg`],
    ];
    case 'level': return [
      ['Přesnost', `${s.accuracyKm} mm/km`],
      ['Dalekohled', `${s.magnification}× · min. zaostření ${s.minFocus} m`],
      ['Kompenzátor', `±${s.compensator}'`],
      ['Krabicová libela', `${s.circular}'/2 mm`],
      ['Dálkoměrné rysky', '1:100'],
      ['Hmotnost', `${s.weight} kg`],
    ];
    case 'gnss': return [
      ['Kanály', `${s.channels}`],
      ['RTK poloha', `${s.rtkH} mm + ${s.ppm} ppm`],
      ['RTK výška', `${s.rtkV} mm + ${s.ppm} ppm`],
      ['Náklon', `${s.tiltName} ≤ ${s.tiltMax}°`],
      ['Výtyčka', `${s.pole.toFixed(2)} m karbon + dvojnožka`],
      ['Hmotnost', `${s.weight} kg`],
    ];
    case 'tripod': return [['Výška', s.range], ['Materiál', 'lakovaný buk'], ['Hmotnost', `${s.weight} kg`]];
    default: return [['Délka', `${s.length} m · ${s.sections} díly`], ['Dělení', 'E, 1 cm'], ['Hmotnost', `${s.weight} kg`]];
  }
}
