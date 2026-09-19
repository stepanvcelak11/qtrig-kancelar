// IndexedDB úložiště projektů: klíč = id projektu, hodnota = celý projekt (JSON).
const DB = 'qtrig-kancelar', STORE = 'projekty', VER = 1;
let _db = null;

function otevri() {
    if (_db) return Promise.resolve(_db);
    return new Promise((res, rej) => {
        const rq = indexedDB.open(DB, VER);
        rq.onupgradeneeded = () => { const d = rq.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' }); };
        rq.onsuccess = () => { _db = rq.result; res(_db); };
        rq.onerror = () => rej(rq.error);
    });
}
function tx(mode, fn) {
    return otevri().then((d) => new Promise((res, rej) => {
        const t = d.transaction(STORE, mode), s = t.objectStore(STORE);
        const r = fn(s);
        t.oncomplete = () => res(r && r.result !== undefined ? r.result : undefined);
        t.onerror = () => rej(t.error);
    }));
}
export const Uloziste = {
    uloz: (projekt) => tx('readwrite', (s) => s.put(projekt)),
    nacti: (id) => tx('readonly', (s) => s.get(id)),
    smaz: (id) => tx('readwrite', (s) => s.delete(id)),
    /** Seznam projektů (bez těžkých dat) seřazený podle poslední změny */
    seznam: async () => {
        const vse = await tx('readonly', (s) => s.getAll());
        return (vse || []).map((p) => ({ id: p.id, nazev: p.nazev, zakazka: p.zakazka, zmeneno: p.zmeneno, pocetBodu: (p.body || []).length, pocetVypoctu: (p.vypocty || []).length }))
            .sort((a, b) => (b.zmeneno || '').localeCompare(a.zmeneno || ''));
    },
};
