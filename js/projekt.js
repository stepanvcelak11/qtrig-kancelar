// Datový model projektu + posluchači změn + automatické ukládání.
import { Uloziste } from './uloziste.js';

export const VERZE_FORMATU = 1;
const posluchaci = new Set();
let _p = null, _ulozTimer = null;
// krok zpět / vpřed: snímky stavu (body, zápisník, osy, kódy) PŘED každou změnou
const HIST_MAX = 40; let _hist = [], _redo = [], _posledni = null;
const snimek = () => JSON.stringify({ body: _p.body, zapisnik: _p.zapisnik, osy: _p.osy || [], kody: _p.kody || [], kos: _p.kos || [] });
function obnovSnimek(s) { const o = JSON.parse(s); _p.body = o.body; _p.zapisnik = o.zapisnik; _p.osy = o.osy; _p.kody = o.kody; _p.kos = o.kos; }

export function novyProjekt(nazev = 'Nový projekt') {
    const ted = new Date().toISOString();
    return {
        format: VERZE_FORMATU, id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        nazev, zakazka: '', lokalita: '', kdo: '', kodKvality: 3, druhPoradu: 'pomocny',
        vytvoreno: ted, zmeneno: ted,
        body: [],        // { cislo, y, x, z, kod, pozn, zdroj, kvalita, typ, puvod, zamek, y2, x2, vytvoreno, zmeneno }
        kos: [],         // smazané body (obnova)
        kody: [],        // kódovací tabulka { kod, popis, hladina, typ, barva }
        predcisli: '',   // k. ú. + ZPMZ pro doplňování čísel
        zapisnik: [],    // { id, stanovisko, vp, pozn, radky:[{ cislo, hz, z, ds, dv, vc, kod, typ, pozn }] }
        vypocty: [],     // { id, typ, nazev, vstup, vysledek, kdy, protokol, stav }
    };
}

export const Projekt = {
    get() { return _p; },
    nastav(p) { _p = p; _hist = []; _redo = []; _posledni = snimek(); oznam('projekt'); },
    /** Krok zpět / vpřed (Ctrl+Z / Ctrl+Y) */
    zpet() { if (!_hist.length) return false; _redo.push(snimek()); obnovSnimek(_hist.pop()); _posledni = snimek(); zmenaBezHistorie(); return true; },
    vpred() { if (!_redo.length) return false; _hist.push(snimek()); obnovSnimek(_redo.pop()); _posledni = snimek(); zmenaBezHistorie(); return true; },
    lzeZpet: () => _hist.length, lzeVpred: () => _redo.length,
    /** Zavolej po každé změně; uloží se s odkladem 400 ms */
    zmena(co = 'data') {
        if (!_p) return;
        const ted = snimek();
        if (_posledni != null && ted !== _posledni) { _hist.push(_posledni); if (_hist.length > HIST_MAX) _hist.shift(); _redo = []; }
        _posledni = ted;
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
        if (i >= 0) {
            if (!prepsat || _p.body[i].zamek) return { pridano: false, prepsano: false, existuje: true, zamek: !!_p.body[i].zamek };
            _p.body[i] = { ..._p.body[i], ...b, zmeneno: new Date().toISOString() }; return { pridano: false, prepsano: true };
        }
        const ted = new Date().toISOString();
        _p.body.push({ z: null, kod: '', pozn: '', zdroj: 'rucne', kvalita: null, typ: '', puvod: '', zamek: false, y2: null, x2: null, vytvoreno: ted, zmeneno: ted, ...b });
        return { pridano: true, prepsano: false };
    },
    /** Smazání do koše (zamčený bod se nesmaže) */
    smazBod(cislo) { const i = _p.body.findIndex((x) => x.cislo === cislo); if (i < 0 || _p.body[i].zamek) return false; if (!_p.kos) _p.kos = []; _p.kos.push({ ..._p.body[i], smazano: new Date().toISOString() }); if (_p.kos.length > 500) _p.kos.shift(); _p.body.splice(i, 1); return true; },
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

function zmenaBezHistorie() { _p.zmeneno = new Date().toISOString(); oznam('data'); clearTimeout(_ulozTimer); _ulozTimer = setTimeout(() => Uloziste.uloz(_p).catch(() => { }), 400); }
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
