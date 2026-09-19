// Drobné UI pomůcky: tvorba prvků, formáty čísel, toast, dialogy, soubory.

export function el(tag, attrs = {}, ...deti) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(e.dataset, v);
        else if (k in e && k !== 'style') { try { e[k] = v; } catch { e.setAttribute(k, v); } }
        else e.setAttribute(k, v === true ? '' : v);
    }
    for (const d of deti.flat(Infinity)) if (d != null && d !== false) e.append(d.nodeType ? d : document.createTextNode(String(d)));
    return e;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ---- čísla: zobrazení s čárkou, čtení s čárkou i tečkou ----
export function fmt(v, dec = 3) {
    if (v == null || v === '' || !isFinite(v)) return '';
    const s = Number(v).toFixed(dec);
    return s.replace('.', ',').replace(/^-0(,0+)?$/, (m) => m.slice(1));
}
export function fmtG(v, dec = 4) { return v == null || !isFinite(v) ? '' : (((v % 400) + 400) % 400).toFixed(dec).replace('.', ',').replace(/^400,0+$/, (m) => '0' + m.slice(3)); }
export function cislo(s) {
    if (typeof s === 'number') return isFinite(s) ? s : null;
    if (s == null) return null;
    const t = String(s).trim().replace(/\s/g, '').replace(',', '.');
    if (!t || t === '-' ) return null;
    const v = Number(t); return isFinite(v) ? v : null;
}
export const datumCas = (iso) => { const d = new Date(iso || Date.now()); return d.toLocaleDateString('cs-CZ') + ' ' + d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }); };

// ---- toast ----
let toastTimer = null;
export function toast(text, druh = '') {
    let t = $('#toast'); if (!t) { t = el('div', { id: 'toast', role: 'status' }); document.body.append(t); }
    t.textContent = text; t.className = 'ukaz ' + druh;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; }, 3200);
}

// ---- dialog ----
export function dialog({ titulek, obsah, tlacitka = [{ text: 'Zavřít', hodnota: null }], sirka = 520 }) {
    return new Promise((res) => {
        const ov = el('div', { class: 'dlg-overlay' });
        const box = el('div', { class: 'dlg', role: 'dialog', 'aria-modal': 'true', style: `max-width:${sirka}px` });
        const zavri = (v) => { ov.remove(); document.removeEventListener('keydown', esc); res(v); };
        const esc = (e) => { if (e.key === 'Escape') zavri(null); };
        box.append(el('div', { class: 'dlg-hlava' }, el('h2', {}, titulek), el('button', { class: 'ikona', 'aria-label': 'Zavřít', onclick: () => zavri(null) }, '✕')));
        const telo = el('div', { class: 'dlg-telo' }); if (typeof obsah === 'string') telo.innerHTML = obsah; else if (obsah) telo.append(obsah); box.append(telo);
        const pata = el('div', { class: 'dlg-pata' });
        tlacitka.forEach((t) => pata.append(el('button', { class: 'btn ' + (t.class || ''), onclick: async () => { if (t.pred && (await t.pred()) === false) return; zavri(t.hodnota); } }, t.text)));
        box.append(pata); ov.append(box); document.body.append(ov);
        document.addEventListener('keydown', esc);
        ov.addEventListener('click', (e) => { if (e.target === ov) zavri(null); });
        const f = box.querySelector('input,select,textarea,button.hlavni'); if (f) f.focus();
    });
}
export function potvrd(text, ano = 'Ano', ne = 'Ne') { return dialog({ titulek: 'Potvrzení', obsah: el('p', {}, text), tlacitka: [{ text: ne, hodnota: false }, { text: ano, hodnota: true, class: 'hlavni' }] }); }
export async function zeptej(titulek, vychozi = '', popisek = '') {
    const inp = el('input', { type: 'text', value: vychozi, id: 'dlg-inp' });
    const r = await dialog({ titulek, obsah: el('label', { class: 'pole' }, popisek, inp), tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'OK', hodnota: true, class: 'hlavni' }] });
    return r ? inp.value : null;
}

// ---- soubory ----
export async function ulozSoubor(nazev, obsah, typ = 'text/plain') {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ + ';charset=utf-8' });
    if (window.showSaveFilePicker) {
        try {
            const h = await window.showSaveFilePicker({ suggestedName: nazev });
            const w = await h.createWritable(); await w.write(blob); await w.close(); return true;
        } catch (e) { if (e.name === 'AbortError') return false; }
    }
    const a = el('a', { href: URL.createObjectURL(blob), download: nazev }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000); return true;
}
export function otevriSoubor(accept = '', vice = false) {
    return new Promise((res) => {
        const i = el('input', { type: 'file', accept: accept || undefined, multiple: vice, style: 'display:none' });
        i.onchange = () => res(vice ? Array.from(i.files) : i.files[0] || null); document.body.append(i); i.click(); setTimeout(() => i.remove(), 60000);
    });
}
/** Přečte textový soubor; Windows-1250 zkusí, když UTF-8 nesedí (zápisníky z totálek) */
export async function ctiText(file) {
    const buf = await file.arrayBuffer();
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch { return new TextDecoder('windows-1250').decode(buf); }
}

/** Uložení stavu UI pro jednoho uživatele (záložky, šířky) */
export const pamet = {
    get(k, def) { try { const v = localStorage.getItem('qk-' + k); return v == null ? def : JSON.parse(v); } catch { return def; } },
    set(k, v) { try { localStorage.setItem('qk-' + k, JSON.stringify(v)); } catch { } },
};
