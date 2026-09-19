// Účet QTRIG: stejné přihlášení jako AR Geodet (Cloudflare worker), zakázky v cloudu a
// živý most bodů: poslat body ze seznamu do zakázky (telefon je hned vidí, jde vytyčit)
// a stáhnout body změřené v terénu do seznamu souřadnic.
// Projekty samotné zůstávají v prohlížeči a v souborech — worker pro ně úložiště nemá.
import { Projekt } from './projekt.js';
import { el, $, toast, dialog, fmt, pamet, datumCas } from './ui.js';
import { jtskToWgs, wgsToJtsk } from '../geo/krovak.js';

const API = 'https://ar-geodet-api.ar-geodet.workers.dev';
let ucet = pamet.get('ucet', null); // { token, jmeno, kod, prostory }

async function api(cesta, body, metoda = body ? 'POST' : 'GET') {
    const h = { 'Content-Type': 'application/json' }; if (ucet && ucet.token) h.Authorization = 'Bearer ' + ucet.token;
    let r; try { r = await fetch(API + cesta, { method: metoda, headers: h, body: body ? JSON.stringify(body) : undefined }); } catch { return { ok: false, status: 0, data: null }; }
    let data = null; try { data = await r.json(); } catch { }
    if (r.status === 401 && ucet) { ucet = null; pamet.set('ucet', null); }
    return { ok: r.ok, status: r.status, data };
}

export const Ucet = {
    jePrihlasen: () => !!(ucet && ucet.token),
    jmeno: () => ucet ? (ucet.jmeno || ucet.kod) : null,
    async dialog() { return ucet ? hlavni() : prihlaseni(); },
};

async function prihlaseni() {
    const kod = el('input', { type: 'text', id: 'uc-kod', placeholder: 'kód účtu (nebo kód firmy)', autocomplete: 'username' });
    const jm = el('input', { type: 'text', id: 'uc-jmeno', placeholder: 'jen u firemního účtu', autocomplete: 'off' });
    const he = el('input', { type: 'password', id: 'uc-heslo', autocomplete: 'current-password' });
    const st = el('div', { class: 'tlum' });
    const r = await dialog({ titulek: 'Přihlášení k účtu QTRIG', obsah: el('div', { style: 'display:grid;gap:10px' },
        el('p', { style: 'margin:0;font-size:13.5px' }, 'Stejný účet jako v AR Geodetu. Po přihlášení jdou body posílat rovnou do zakázky v telefonu a stahovat, co se změřilo v terénu.'),
        el('label', { class: 'pole' }, el('span', {}, 'Kód účtu'), kod), el('label', { class: 'pole' }, el('span', {}, 'Jméno uživatele'), jm), el('label', { class: 'pole' }, el('span', {}, 'Heslo'), he), st),
        tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Přihlásit', hodnota: true, class: 'hlavni', pred: async () => {
            st.textContent = 'Přihlašuji…';
            const telo = { code: kod.value.trim(), password: he.value }; if (jm.value.trim()) telo.name = jm.value.trim();
            const r = await api('/login', telo);
            if (!r.ok || !r.data || !r.data.token) { st.textContent = r.status === 0 ? 'Server neodpovídá (signál?)' : (r.data && (r.data.error || r.data.message)) || 'Přihlášení se nepovedlo'; st.style.color = 'var(--bad)'; return false; }
            ucet = { token: r.data.token, kod: kod.value.trim(), jmeno: (r.data.user && r.data.user.name) || (r.data.ucet && r.data.ucet.name) || '', prostory: r.data.prostory || [], kdy: Date.now() };
            pamet.set('ucet', ucet);
        } }] });
    if (r) { toast('Přihlášen ' + (ucet.jmeno || ucet.kod), 'ok'); document.dispatchEvent(new CustomEvent('ucet-zmena')); return hlavni(); }
}

async function hlavni() {
    const p = Projekt.get();
    const seznam = el('div', { class: 'tlum' }, 'Načítám zakázky…');
    const sel = el('select', { id: 'uc-zakazka' });
    const nova = el('input', { type: 'text', id: 'uc-nova', placeholder: 'nebo název nové zakázky (= název projektu v AR Geodetu)', value: p.nazev || '' });
    const st = el('div', { class: 'tlum', style: 'font-size:13px' });
    let zavri = () => { };
    api('/jobs').then((r) => {
        seznam.textContent = '';
        if (!r.ok) { seznam.textContent = r.status === 0 ? 'Bez signálu — zakázky nejdou načíst.' : 'Zakázky nejdou načíst (' + r.status + ').'; return; }
        const jobs = (r.data && r.data.jobs) || [];
        sel.innerHTML = ''; jobs.filter((j) => !j.deleted).forEach((j) => sel.append(el('option', { value: j.key }, (j.name || j.key) + (j.uname ? ' · ' + j.uname : ''))));
        if (!jobs.length) sel.append(el('option', { value: '' }, '— žádné zakázky, zadej název níže —'));
        seznam.append(el('label', { class: 'pole' }, el('span', {}, 'Zakázka v cloudu'), sel));
    });
    const klic = () => (nova.value.trim() || sel.value || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 60);
    const obsah = el('div', { style: 'display:grid;gap:12px' },
        el('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px' }, el('div', {}, el('b', {}, ucet.jmeno || ucet.kod), el('div', { class: 'tlum', style: 'font-size:12.5px' }, 'přihlášen ' + datumCas(ucet.kdy))), el('button', { class: 'btn maly', onclick: () => { ucet = null; pamet.set('ucet', null); zavri(); toast('Odhlášen'); document.dispatchEvent(new CustomEvent('ucet-zmena')); } }, 'Odhlásit')),
        seznam, nova,
        el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
            el('button', { class: 'btn hlavni', onclick: () => poslat(klic(), st) }, `Poslat ${p.body.length} bodů do zakázky`),
            el('button', { class: 'btn', onclick: () => stahnout(klic(), st) }, 'Stáhnout body ze zakázky')),
        st,
        el('p', { class: 'tlum', style: 'margin:0;font-size:12.5px' }, 'Body se posílají jako WGS84 (stejný převod jako v AR Geodetu, shoda na mm). V telefonu se objeví po další synchronizaci zakázky (Nástroje → Sdílení v týmu). Projekt kanceláře (zápisník, výpočty, protokol) zůstává tady a v souboru.'));
    const pr = dialog({ titulek: 'Účet QTRIG a most do AR Geodetu', obsah, sirka: 600 });
    zavri = () => { const ov = $('.dlg-overlay'); if (ov) ov.remove(); };
    await pr;
}

async function poslat(job, st) {
    const p = Projekt.get(); if (!job) { st.textContent = 'Vyber nebo napiš zakázku.'; return; }
    const body = p.body.filter((b) => b.y != null && b.x != null); if (!body.length) { st.textContent = 'Seznam je prázdný.'; return; }
    const now = Date.now(); let posl = 0, prijato = 0;
    for (let i = 0; i < body.length; i += 250) {
        const changes = body.slice(i, i + 250).map((b) => { const w = jtskToWgs(b.y, b.x, b.z ?? 200); const id = 'qk_' + b.cislo.replace(/[^\w.-]/g, '_'); const d = { id, name: b.cislo, lat: +w.lat.toFixed(9), lng: +w.lng.toFixed(9), cat: 'CUSTOM', type: 'custom', mts: now, prov: { src: 'kancelar', y: +b.y.toFixed(3), x: +b.x.toFixed(3) } }; if (b.z != null) d.vyska = +b.z.toFixed(3); if (b.kod) d.kod = b.kod.slice(0, 60); return { id, data: JSON.stringify(d), ts: now, deleted: 0 }; });
        st.textContent = `Posílám ${i + changes.length} / ${body.length}…`;
        const r = await api('/sync/points', { job, changes });
        if (!r.ok) { st.textContent = r.status === 403 ? 'K této zakázce nemáš přístup.' : r.status === 0 ? 'Bez signálu.' : 'Chyba ' + r.status + (r.data && r.data.error ? ': ' + r.data.error : ''); st.style.color = 'var(--bad)'; return; }
        posl += changes.length; prijato += r.data && Array.isArray(r.data.prijato) ? r.data.prijato.length : (r.data && r.data.saved) || changes.length;
    }
    st.style.color = 'var(--ok)'; st.textContent = `Odesláno ${posl} bodů do zakázky „${job}“ (server přijal ${prijato}). V telefonu: synchronizovat zakázku.`;
}

async function stahnout(job, st) {
    if (!job) { st.textContent = 'Vyber nebo napiš zakázku.'; return; }
    let since = 0, vse = [], kolo = 0;
    do {
        st.textContent = `Stahuji… (${vse.length})`;
        const r = await api('/sync/points?job=' + encodeURIComponent(job) + '&since=' + since);
        if (!r.ok) { st.textContent = r.status === 403 ? 'K této zakázce nemáš přístup.' : r.status === 0 ? 'Bez signálu.' : 'Chyba ' + r.status; st.style.color = 'var(--bad)'; return; }
        const pts = (r.data && r.data.points) || []; vse.push(...pts); pts.forEach((x) => { since = Math.max(since, +x.srv || 0); });
        if (!(r.data && r.data.more) || !pts.length) break;
    } while (++kolo < 40);
    // poslední verze každého bodu, bez smazaných
    const posledni = new Map(); vse.forEach((x) => posledni.set(x.id, x));
    let n = 0, prepsano = 0;
    for (const x of posledni.values()) {
        if (x.deleted) continue; let d; try { d = typeof x.data === 'string' ? JSON.parse(x.data) : x.data; } catch { continue; }
        if (!d || !isFinite(+d.lat) || !isFinite(+d.lng)) continue;
        const j = d.prov && d.prov.src === 'kancelar' && d.prov.y != null ? { y: +d.prov.y, x: +d.prov.x } : wgsToJtsk(+d.lat, +d.lng, d.vyska != null ? +d.vyska : 200);
        const cislo = String(d.name || d.id || '').trim() || 'B' + (++n);
        const r = Projekt.ulozBod({ cislo, y: +j.y.toFixed(3), x: +j.x.toFixed(3), z: d.vyska != null ? +(+d.vyska).toFixed(3) : null, kod: d.kod || '', zdroj: 'import', pozn: 'AR Geodet · ' + job + (d.acc != null ? ' · ±' + fmt(d.acc, 1) + ' m' : '') }, true);
        if (r.pridano) n++; else if (r.prepsano) prepsano++;
    }
    Projekt.zmena('body');
    st.style.color = 'var(--ok)'; st.textContent = `Staženo: ${n} nových, ${prepsano} přepsaných bodů ze zakázky „${job}“. Body z telefonu mají přesnost GPS (±3–5 m), pokud nebyly korigované.`;
}
