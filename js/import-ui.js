// Dialog importu zápisníku z totální stanice.
import { Projekt } from './projekt.js';
import { el, toast, dialog, otevriSoubor, ctiText, fmt } from './ui.js';
import { rozpoznejFormat, ctiZapisnik, FORMATY, plneCislo } from './import-totalka.js';
import { Zapisnik } from './zapisnik.js';

export async function importZapisniku() {
    const file = await otevriSoubor(''); if (!file) return; // bez filtru přípon (.zap, .asc, .gsi, .sdr, .raw, .m5, …)
    const text = await ctiText(file);
    const sel = el('select', { id: 'iz-format' }, Object.entries(FORMATY).map(([k, v]) => el('option', { value: k }, v)));
    const odhad = rozpoznejFormat(text, file.name); if (odhad) sel.value = odhad;
    const uhly = el('select', { id: 'iz-uhly' }, el('option', { value: 'auto' }, 'poznat automaticky'), el('option', { value: 'gon' }, 'gony'), el('option', { value: 'deg' }, 'stupně desetinné'), el('option', { value: 'dms' }, 'ddd.mmss'));
    const pridatBody = el('input', { type: 'checkbox', id: 'iz-body', checked: true });
    const dvePolohy = el('input', { type: 'checkbox', id: 'iz-polohy', checked: true });
    const predcisli = el('input', { type: 'text', id: 'iz-predcisli', placeholder: 'k. ú. + ZPMZ, např. 61084400014', autocomplete: 'off' });
    const doplnit = el('input', { type: 'checkbox', id: 'iz-doplnit' });
    const nahled = el('pre', { class: 'protokol', style: 'max-height:120px;overflow:auto;background:var(--paper2);border-radius:6px' }, text.split(/\r?\n/).slice(0, 6).join('\n'));
    const info = el('div', { style: 'font-size:13px' });
    let vysl = null;
    const aktualizuj = () => {
        try {
            vysl = ctiZapisnik(text, sel.value, { uhly: uhly.value, dvePolohy: dvePolohy.checked });
            if (vysl.hlavicka && vysl.hlavicka.predcisli && !predcisli.value) { predcisli.value = vysl.hlavicka.predcisli; doplnit.checked = true; }
            const radku = vysl.stanoviska.reduce((a, s) => a + s.radky.length, 0);
            info.innerHTML = '';
            info.append(el('div', {}, `${vysl.stanoviska.length} stanovisek, ${radku} měření, ${vysl.body.length} bodů se souřadnicemi`));
            vysl.stanoviska.slice(0, 8).forEach((s) => info.append(el('div', { class: 'tlum mono', style: 'font-size:12px' }, `  ${s.stanovisko}: ${s.radky.length} řádků, vp ${fmt(s.vp)}${s.radky[0] ? `, první ${s.radky[0].cislo} Hz ${fmt(s.radky[0].hz, 4)} d ${fmt(s.radky[0].ds)}` : ''}`)));
            vysl.varovani.forEach((v) => info.append(el('div', { style: 'color:var(--warn)' }, '⚠ ' + v)));
            if (!radku) info.append(el('div', { style: 'color:var(--bad)' }, 'Nic nepřečteno — zkus jiný formát. Pošli soubor autorovi, formát doladíme.'));
        } catch (e) { vysl = null; info.textContent = 'Chyba: ' + e.message; }
    };
    sel.onchange = aktualizuj; uhly.onchange = aktualizuj; dvePolohy.onchange = aktualizuj; aktualizuj();
    const ok = await dialog({ titulek: 'Import zápisníku — ' + file.name, sirka: 640, obsah: el('div', { style: 'display:grid;gap:10px' },
        el('div', { class: 'radek' }, el('label', { class: 'pole' }, el('span', {}, 'Formát'), sel), el('label', { class: 'pole' }, el('span', {}, 'Úhly v souboru'), uhly)),
        nahled, info,
        el('label', {}, pridatBody, ' body se souřadnicemi ze souboru přidat do seznamu (existující se nepřepisují)'),
        el('label', {}, dvePolohy, ' měření v obou polohách průměrovat (Hz ±200 g, zenit 400 − Z)'),
        el('div', { class: 'radek', style: 'align-items:end;margin:0' }, el('label', { class: 'pole' }, el('span', {}, 'Předčíslí bodů (k. ú. + ZPMZ)'), predcisli), el('label', { style: 'font-size:13px;padding-bottom:8px' }, doplnit, ' doplnit na 15místná čísla (XX v hlavičce nahraď číslem ZPMZ)')),
        el('p', { class: 'tlum', style: 'margin:0;font-size:12.5px' }, 'Řádky, jejichž cíl je v seznamu souřadnic, se označí jako orientace (OR); ostatní jako záměry. V zápisníku to jde přepnout.')),
        tlacitka: [{ text: 'Zrušit', hodnota: null }, { text: 'Importovat', hodnota: true, class: 'hlavni' }] });
    if (!ok || !vysl) return;
    const p = Projekt.get(); let nb = 0;
    const pre = doplnit.checked ? predcisli.value.trim() : '';
    if (pre && /XX/i.test(pre)) { toast('V předčíslí zůstalo XX — doplň číslo ZPMZ', 'bad'); return; }
    const cis = (c) => pre ? plneCislo(c, pre) : c;
    if (vysl.hlavicka && vysl.hlavicka.zakazka && !p.zakazka) { p.zakazka = vysl.hlavicka.zakazka; }
    if (pridatBody.checked) vysl.body.forEach((b) => { if (Projekt.ulozBod({ ...b, cislo: cis(b.cislo), zdroj: 'import' }, false).pridano) nb++; });
    let prvni = null;
    vysl.stanoviska.forEach((s) => {
        const st = Projekt.novyStanovisko(cis(s.stanovisko)); st.vp = s.vp; st.delky = s.delky; st.pozn = 'import ' + file.name;
        st.radky = s.radky.map((r) => { const c = cis(r.cislo); return { cislo: c, hz: r.hz, z: r.z ?? null, ds: r.ds ?? null, vc: r.vc ?? 0, kod: r.kod || '', typ: r.typ === 'o' || (Projekt.bod(c) && c !== st.stanovisko) ? 'o' : 'z', pozn: r.pozn || '' }; });
        prvni = prvni || st;
    });
    Projekt.zmena('zapisnik'); Projekt.zmena('body');
    toast(`Import: ${vysl.stanoviska.length} stanovisek, ${nb} nových bodů`, 'ok');
    if (prvni) Zapisnik.otevri(prvni.id);
}
