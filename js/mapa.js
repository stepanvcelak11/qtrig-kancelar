// Náhled bodů na plátně v S-JTSK (sever nahoře: +X dolů, +Y doleva). Podklad katastru
// a ortofota přijde v další dávce; tohle je rychlý náhled, který funguje offline.
import { Projekt } from './projekt.js';
import { fmt, $ } from './ui.js';

let cv, ctx, info, pohled = { y0: 0, x0: 0, k: 1 }, zvyr = null, vrstvy = [], hover = null, dpr = 1;
let onKlik = null;

export const Mapa = {
    init() {
        cv = $('#mapa-canvas'); ctx = cv.getContext('2d'); info = $('#mapa-info');
        new ResizeObserver(() => { velikost(); kresli(); }).observe(cv.parentElement);
        velikost();
        Projekt.poslouchej((co) => { if (co === 'projekt') { ukazVse(); } else kresli(); });
        $('#mapa-vse').onclick = ukazVse;
        new MutationObserver(kresli).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        ovladani();
        ukazVse();
    },
    zvyrazni(cislo, prijed = false) { zvyr = cislo; const b = Projekt.bod(cislo); if (prijed && b) { const r = cv.getBoundingClientRect(); pohled.y0 = b.y + r.width / 2 / pohled.k; pohled.x0 = b.x - r.height / 2 / pohled.k; } kresli(); },
    /** Dočasné vrstvy: [{ typ:'cara'|'body'|'text', body:[{y,x}], barva, sirka, popis }] */
    vrstvy(v) { vrstvy = v || []; kresli(); },
    ukazVse,
    /** Klik na bod na mapě (vrací bod) — pro výběr do formulářů */
    naKlik(fn) { onKlik = fn; },
};

function velikost() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = cv.parentElement.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
}
function ukazVse() {
    const p = Projekt.get(); const r = cv.getBoundingClientRect();
    const body = p ? p.body.filter((b) => b.y != null && b.x != null) : [];
    if (!body.length) { pohled = { y0: 745000 + r.width / 2, x0: 1045000 - r.height / 2, k: 1 }; kresli(); return; }
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    body.forEach((b) => { minY = Math.min(minY, b.y); maxY = Math.max(maxY, b.y); minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x); });
    const dy = Math.max(maxY - minY, 5), dx = Math.max(maxX - minX, 5);
    const k = Math.min((r.width - 60) / dy, (r.height - 60) / dx);
    pohled.k = Math.max(1e-4, Math.min(k, 50));
    pohled.y0 = (minY + maxY) / 2 + r.width / 2 / pohled.k; pohled.x0 = (minX + maxX) / 2 - r.height / 2 / pohled.k;
    kresli();
}
const naObr = (y, x) => ({ sx: (pohled.y0 - y) * pohled.k, sy: (x - pohled.x0) * pohled.k });
const naSvet = (sx, sy) => ({ y: pohled.y0 - sx / pohled.k, x: pohled.x0 + sy / pohled.k });

function kresli() {
    if (!ctx) return;
    const p = Projekt.get(); const W = cv.width / dpr, H = cv.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    const c = (n) => css.getPropertyValue(n).trim();
    ctx.fillStyle = c('--paper2'); ctx.fillRect(0, 0, W, H);
    // mřížka
    const krok = krokMrizky(pohled.k);
    ctx.strokeStyle = c('--line2'); ctx.lineWidth = 1; ctx.font = '10px ' + c('--mono'); ctx.fillStyle = c('--ink3');
    const lt = naSvet(0, 0), rb = naSvet(W, H);
    for (let y = Math.floor(rb.y / krok) * krok; y <= lt.y; y += krok) { const { sx } = naObr(y, 0); ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke(); ctx.fillText(fmt(y, 0), sx + 3, 11); }
    for (let x = Math.floor(lt.x / krok) * krok; x <= rb.x; x += krok) { const { sy } = naObr(0, x); ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke(); ctx.fillText(fmt(x, 0), 3, sy - 3); }
    // vrstvy (čáry výpočtů)
    for (const v of vrstvy) {
        if (v.typ === 'cara' && v.body.length > 1) {
            ctx.strokeStyle = v.barva || c('--acc'); ctx.lineWidth = v.sirka || 1.5; if (v.carkovane) ctx.setLineDash([5, 4]);
            ctx.beginPath(); v.body.forEach((b, i) => { const { sx, sy } = naObr(b.y, b.x); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); if (v.uzavrit) ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
        }
        if (v.typ === 'body') v.body.forEach((b) => { const { sx, sy } = naObr(b.y, b.x); ctx.fillStyle = v.barva || c('--acc'); ctx.beginPath(); ctx.arc(sx, sy, v.r || 5, 0, Math.PI * 2); ctx.fill(); if (b.cislo) { ctx.fillStyle = c('--ink'); ctx.font = '11px ' + c('--mono'); ctx.fillText(b.cislo, sx + 6, sy - 5); } });
    }
    // body projektu
    if (p) {
        ctx.font = '11px ' + c('--mono');
        const ukazPopisky = pohled.k > 0.15 || p.body.length < 60;
        for (const b of p.body) {
            if (b.y == null || b.x == null) continue;
            const { sx, sy } = naObr(b.y, b.x); if (sx < -20 || sy < -20 || sx > W + 20 || sy > H + 20) continue;
            const vyb = b.cislo === zvyr;
            ctx.strokeStyle = vyb ? c('--acc') : c('--ink2'); ctx.lineWidth = vyb ? 2 : 1.2;
            ctx.beginPath(); ctx.arc(sx, sy, vyb ? 5 : 3.5, 0, Math.PI * 2); ctx.stroke();
            if (vyb) { ctx.fillStyle = c('--acc-soft'); ctx.fill(); }
            if (ukazPopisky || vyb) { ctx.fillStyle = vyb ? c('--acc') : c('--ink2'); ctx.fillText(b.cislo, sx + 6, sy - 5); }
        }
    }
    // měřítko
    const m = krok * pohled.k; ctx.strokeStyle = c('--ink2'); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W - 14 - m, H - 12); ctx.lineTo(W - 14, H - 12); ctx.stroke();
    ctx.fillStyle = c('--ink2'); ctx.textAlign = 'right'; ctx.fillText(krok >= 1000 ? (krok / 1000) + ' km' : krok + ' m', W - 14, H - 16); ctx.textAlign = 'left';
    if (info) info.textContent = hover ? `${hover.cislo}  Y ${fmt(hover.y)}  X ${fmt(hover.x)}` : (p ? `${p.body.length} bodů · 1 : ${Math.round(3780 / pohled.k / 10) * 10 || 1}` : '');
}
function krokMrizky(k) { const cil = 90 / k; const p = Math.pow(10, Math.floor(Math.log10(cil))); const m = cil / p; return (m < 2 ? 1 : m < 5 ? 2 : 5) * p; }

function ovladani() {
    const ptrs = new Map(); let last = null, pinch = null, tahl = false;
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); last = { x: e.clientX, y: e.clientY }; tahl = false; if (ptrs.size === 2) { const a = [...ptrs.values()]; pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), k: pohled.k }; } });
    cv.addEventListener('pointermove', (e) => {
        if (ptrs.has(e.pointerId)) {
            ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (ptrs.size === 2 && pinch) { const a = [...ptrs.values()]; const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); const r = cv.getBoundingClientRect(); zoomNa((a[0].x + a[1].x) / 2 - r.left, (a[0].y + a[1].y) / 2 - r.top, pinch.k * d / pinch.d); }
            else if (ptrs.size === 1 && last) { const dx = e.clientX - last.x, dy = e.clientY - last.y; if (Math.abs(dx) + Math.abs(dy) > 2) tahl = true; pohled.y0 += dx / pohled.k; pohled.x0 -= dy / pohled.k; last = { x: e.clientX, y: e.clientY }; kresli(); }
        } else { const r = cv.getBoundingClientRect(); hover = najdi(e.clientX - r.left, e.clientY - r.top); cv.style.cursor = hover ? 'pointer' : 'grab'; kresli(); }
    });
    const up = (e) => { if (ptrs.size === 1 && !tahl) { const r = cv.getBoundingClientRect(); const b = najdi(e.clientX - r.left, e.clientY - r.top); if (b) { zvyr = b.cislo; kresli(); if (onKlik) onKlik(b); else document.dispatchEvent(new CustomEvent('mapa-bod', { detail: b })); } } ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) last = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomNa(e.clientX - r.left, e.clientY - r.top, pohled.k * (e.deltaY < 0 ? 1.2 : 1 / 1.2)); }, { passive: false });
    cv.addEventListener('dblclick', (e) => { const r = cv.getBoundingClientRect(); zoomNa(e.clientX - r.left, e.clientY - r.top, pohled.k * 2); });
}
function zoomNa(sx, sy, k) { const w = naSvet(sx, sy); pohled.k = Math.max(1e-4, Math.min(k, 100)); pohled.y0 = w.y + sx / pohled.k; pohled.x0 = w.x - sy / pohled.k; kresli(); }
function najdi(sx, sy) {
    const p = Projekt.get(); if (!p) return null; let best = null, bd = 12;
    for (const b of p.body) { if (b.y == null) continue; const o = naObr(b.y, b.x); const d = Math.hypot(o.sx - sx, o.sy - sy); if (d < bd) { bd = d; best = b; } }
    return best;
}
