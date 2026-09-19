// Datový model projektu + posluchači změn + automatické ukládání.
import { Uloziste } from './uloziste.js';

export const VERZE_FORMATU = 1;
const posluchaci = new Set();
let _p = null, _ulozTimer = null;

export function novyProjekt(nazev = 'Nový projekt') {
    const ted = new Date().toISOString();
    return {
        format: VERZE_FORMATU, id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        nazev, zakazka: '', lokalita: '', kdo: '', kodKvality: 3, druhPoradu: 'pomocny',
        vytvoreno: ted, zmeneno: ted,
        body: [],        // { cislo, y, x, z, kod, pozn, zdroj, vypocet }
        zapisnik: [],    // { id, stanovisko, vp, pozn, radky:[{ cislo, hz, z, ds, dv, vc, kod, typ, pozn }] }
        vypocty: [],     // { id, typ, nazev, vstup, vysledek, kdy, protokol, stav }
    };
}

export const Projekt = {
    get() { return _p; },
    nastav(p) { _p = p; oznam('projekt'); },
    /** Zavolej po každé změně; uloží se s odkladem 400 ms */
    zmena(co = 'data') {
        if (!_p) return;
        _p.zmeneno = new Date().toISOString();
        oznam(co);
        clearTimeout(_ulozTimer);
        _ulozTimer = setTimeout(() => Uloziste.uloz(_p).catch((e) => console.warn('uložení selhalo', e)), 400);
    },
    ulozHned() { clearTimeout(_ulozTimer); return _p ? Uloziste.uloz(_p) : Promise.resolve(); },
    poslouchej(fn) { posluchaci.add(fn); return () => posluchaci.delete(fn); },

    // ---- body ----
    bod(cislo) { return _p.body.find((b) => b.cislo === cislo) || null; },
    /** Přidá nebo přepíše bod; vrací { pridano, prepsano } */
    ulozBod(b, prepsat = true) {
        const i = _p.body.findIndex((x) => x.cislo === b.cislo);
        if (i >= 0) { if (!prepsat) return { pridano: false, prepsano: false, existuje: true }; _p.body[i] = { ..._p.body[i], ...b }; return { pridano: false, prepsano: true }; }
        _p.body.push({ z: null, kod: '', pozn: '', zdroj: 'rucne', ...b });
        return { pridano: true, prepsano: false };
    },
    smazBod(cislo) { const i = _p.body.findIndex((x) => x.cislo === cislo); if (i >= 0) _p.body.splice(i, 1); },
    /** Volné číslo bodu od zadaného základu */
    volneCislo(od = 1) { let n = od; const s = new Set(_p.body.map((b) => b.cislo)); while (s.has(String(n))) n++; return String(n); },

    // ---- zápisník ----
    stanovisko(id) { return _p.zapisnik.find((s) => s.id === id) || null; },
    novyStanovisko(cislo = '') {
        const s = { id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), stanovisko: cislo, vp: 0, pozn: '', radky: [] };
        _p.zapisnik.push(s); return s;
    },

    // ---- výpočty ----
    ulozVypocet(v) { v.id = v.id || 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); v.kdy = v.kdy || new Date().toISOString(); _p.vypocty.push(v); return v; },
};

function oznam(co) { posluchaci.forEach((fn) => { try { fn(co); } catch (e) { console.error(e); } }); }

/** Otevře poslední projekt, nebo založí nový */
export async function startProjekt() {
    let id = null; try { id = localStorage.getItem('qk-posledni'); } catch (e) { }
    let p = id ? await Uloziste.nacti(id).catch(() => null) : null;
    if (!p) { const s = await Uloziste.seznam().catch(() => []); if (s.length) p = await Uloziste.nacti(s[0].id); }
    if (!p) { p = novyProjekt(); await Uloziste.uloz(p); }
    Projekt.nastav(p);
    try { localStorage.setItem('qk-posledni', p.id); } catch (e) { }
    return p;
}
export async function otevriProjekt(id) {
    await Projekt.ulozHned();
    const p = await Uloziste.nacti(id); if (!p) throw new Error('Projekt nenalezen');
    Projekt.nastav(p); try { localStorage.setItem('qk-posledni', p.id); } catch (e) { }
    return p;
}
export async function zalozProjekt(nazev) {
    await Projekt.ulozHned();
    const p = novyProjekt(nazev); await Uloziste.uloz(p); Projekt.nastav(p);
    try { localStorage.setItem('qk-posledni', p.id); } catch (e) { }
    return p;
}
/** Import projektu ze souboru (.json) — dostane nové id, aby nepřepsal existující */
export async function importProjekt(obj) {
    if (!obj || !Array.isArray(obj.body)) throw new Error('Soubor není projekt QTRIG Kancelář');
    const p = { ...novyProjekt(obj.nazev || 'Importovaný projekt'), ...obj };
    p.id = novyProjekt().id; p.zmeneno = new Date().toISOString();
    await Projekt.ulozHned(); await Uloziste.uloz(p); Projekt.nastav(p);
    try { localStorage.setItem('qk-posledni', p.id); } catch (e) { }
    return p;
}
