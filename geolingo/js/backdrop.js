// Geodetické pozadí: vrstevnice (marching squares nad „kopci“), trigonometrická síť a křížky
// souřadnicové sítě S-JTSK. Generuje se jednou (s pevným semínkem) jako SVG za obsahem.

function rng(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

const VW = 1000, VH = 1700;

export function backdrop() {
  const r = rng(20260928);
  // Terén: součet gaussovských kopců a údolí + mírný sklon.
  const hills = Array.from({ length: 9 }, () => ({ x: r() * VW, y: r() * VH, h: (r() < 0.75 ? 1 : -0.6) * (60 + r() * 90), s: 140 + r() * 220 }));
  const height = (x, y) => 300 + y * 0.03 + hills.reduce((a, k) => a + k.h * Math.exp(-((x - k.x) ** 2 + (y - k.y) ** 2) / (2 * k.s * k.s)), 0);

  const step = 12, nx = Math.ceil(VW / step) + 1, ny = Math.ceil(VH / step) + 1;
  const H = Array.from({ length: ny }, (_, j) => Array.from({ length: nx }, (_, i) => height(i * step, j * step)));
  let min = Infinity, max = -Infinity;
  for (const row of H) for (const v of row) { min = Math.min(min, v); max = Math.max(max, v); }

  const interval = 5;                               // interval vrstevnic (m)
  const thin = [], thick = [], labels = [];
  for (let lvl = Math.ceil(min / interval) * interval; lvl < max; lvl += interval) {
    const segs = [];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const v = [H[j][i], H[j][i + 1], H[j + 1][i + 1], H[j + 1][i]];
      const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      const pts = [];
      for (let e = 0; e < 4; e++) {
        const a = v[e], b = v[(e + 1) % 4];
        if ((a < lvl) !== (b < lvl)) {
          const t = (lvl - a) / (b - a), p = c[e], q = c[(e + 1) % 4];
          pts.push([(p[0] + t * (q[0] - p[0])) * step, (p[1] + t * (q[1] - p[1])) * step]);
        }
      }
      if (pts.length === 2) segs.push(`M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}L${pts[1][0].toFixed(1)} ${pts[1][1].toFixed(1)}`);
      if (pts.length === 4) segs.push(`M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}L${pts[1][0].toFixed(1)} ${pts[1][1].toFixed(1)}M${pts[2][0].toFixed(1)} ${pts[2][1].toFixed(1)}L${pts[3][0].toFixed(1)} ${pts[3][1].toFixed(1)}`);
    }
    const isIndex = lvl % (interval * 5) === 0;     // zdůrazněná vrstevnice po 25 m
    (isIndex ? thick : thin).push(segs.join(''));
    if (isIndex && segs.length > 30) {
      const s = segs[Math.floor(r() * segs.length)].match(/M([\d.]+) ([\d.]+)/);
      labels.push(`<text x="${s[1]}" y="${s[2]}" class="bg-lbl">${lvl}</text>`);
    }
  }

  // Trigonometrické body na vrcholech a jejich síť.
  const trig = hills.filter((k) => k.h > 0 && k.x > 40 && k.x < VW - 40 && k.y > 40 && k.y < VH - 40)
    .map((k, i) => ({ x: k.x, y: k.y, n: `${101 + i * 7}`, z: height(k.x, k.y) }));
  const net = [];
  trig.forEach((a, i) => {
    trig.map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) })).filter((o) => o.j > i).sort((p, q) => p.d - q.d).slice(0, 2)
      .forEach((o) => net.push(`M${a.x.toFixed(0)} ${a.y.toFixed(0)}L${trig[o.j].x.toFixed(0)} ${trig[o.j].y.toFixed(0)}`));
  });
  const trigSym = trig.map((t) => `<g class="bg-trig"><path d="M${t.x.toFixed(0)} ${(t.y - 9).toFixed(0)}l8 14h-16Z"/><circle cx="${t.x.toFixed(0)}" cy="${(t.y + 0.5).toFixed(0)}" r="1.8"/>
    <text x="${(t.x + 12).toFixed(0)}" y="${(t.y - 2).toFixed(0)}" class="bg-lbl">${t.n}</text><text x="${(t.x + 12).toFixed(0)}" y="${(t.y + 10).toFixed(0)}" class="bg-lbl sm">${t.z.toFixed(1).replace('.', ',')}</text></g>`).join('');

  // Křížky souřadnicové sítě po 200 jednotkách s popisem jako na mapě.
  const crosses = [];
  for (let y = 100; y < VH; y += 200) for (let x = 100; x < VW; x += 200) {
    crosses.push(`<path class="bg-cross" d="M${x - 8} ${y}h16M${x} ${y - 8}v16"/>`);
    if (x === 100) crosses.push(`<text x="${x + 6}" y="${y - 6}" class="bg-lbl sm">X ${(1160000 - y).toLocaleString('cs-CZ')}</text>`);
    if (y === 100) crosses.push(`<text x="${x + 6}" y="${y + 18}" class="bg-lbl sm">Y ${(598000 + x).toLocaleString('cs-CZ')}</text>`);
  }

  const el = document.createElement('div');
  el.id = 'backdrop';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<svg viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid slice">
    <path class="bg-c" d="${thin.join('')}"/><path class="bg-c idx" d="${thick.join('')}"/>
    <path class="bg-net" d="${net.join('')}"/>${crosses.join('')}${labels.join('')}${trigSym}
  </svg>`;
  document.body.prepend(el);
}
