"""Kresba: linie klikáním (chytání na body), kresba z kódů, DXF tam a zpět. python tests/test_kresba.py"""
import http.server, socketserver, threading, os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass
chyby = []
def ok(pod, co):
    print(('✓ ' if pod else '✕ ') + co)
    if not pod: chyby.append(co)
with socketserver.TCPServer(('127.0.0.1', 0), H) as srv:
    port = srv.server_address[1]; threading.Thread(target=srv.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_context(viewport={'width': 1400, 'height': 900}, service_workers='block').new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{port}/'); pg.wait_for_selector('#body-tab')
        for c, y, x, k in [('1', '745000', '1045000', 'PLOT'), ('2', '745050', '1045000', 'PLOT'), ('3', '745050', '1045050', 'PLOT'), ('4', '745000', '1045050', 'BUDOVA'), ('5', '745020', '1045020', 'BUDOVA'), ('6', '745030', '1045030', 'BUDOVA')]:
            pg.click('text=+ Bod'); pg.fill('#nb-c', c); pg.fill('#nb-y', y); pg.fill('#nb-x', x); pg.fill('#nb-k', k); pg.click('.dlg-pata >> text=Přidat')
        pg.wait_for_timeout(300); pg.click('#mapa-vse'); pg.wait_for_timeout(300)
        # kresba z kódů: kódovací tabulka má výchozí PLOT=linie, BUDOVA=plocha
        pg.click('#sekce-body >> text=⋯'); pg.click('text=Kódovací tabulka'); pg.click('.dlg-pata >> text=Uložit tabulku'); pg.wait_for_timeout(200)
        pg.click('.kresba-panel >> text=⋯'); pg.click('text=Kresba z kódů'); pg.wait_for_timeout(300)
        prvky = pg.evaluate("(async () => { const m = await import('/js/projekt.js'); return m.Projekt.get().kresba.prvky.map(p => [p.typ, p.hladina, p.body.length, !!p.uzavrit]); })()")
        ok(len(prvky) == 2 and ['linie', 'PLOT', 3, False] in prvky and ['linie', 'BUDOVA', 3, True] in prvky, 'kresba z kódů: PLOT linie 3 body, BUDOVA uzavřená plocha: ' + str(prvky))
        # linie klikáním: nástroj linie, klik na body 1 a 4 (na mapě), dvojklik
        pg.click('.kresba-panel [data-n=linie]')
        pos = pg.evaluate("(async () => { const m = await import('/js/projekt.js'); const p = m.Projekt.get(); return p.body.map(b => [b.cislo, b.y, b.x]); })()")
        # souřadnice bodu na plátně: použijeme info z canvasu přes hover — jednodušeji: klikneme na střed mapy a použijeme chytání ... místo toho zjistíme naObr přes vykreslené popisky? Použijeme přímo API Kresba
        pg.evaluate("(async () => { const k = await import('/js/kresba.js'); k.Kresba.klik({y:745000,x:1045000}, {cislo:'1',y:745000,x:1045000}, {prekresli(){}, k:1}); k.Kresba.klik({y:745000,x:1045050}, {cislo:'4',y:745000,x:1045050}, {prekresli(){}, k:1}); k.Kresba.ukonci({prekresli(){}}); })()")
        prvky = pg.evaluate("(async () => { const m = await import('/js/projekt.js'); return m.Projekt.get().kresba.prvky.length; })()")
        ok(prvky == 3, f'linie 1–4 přidána ({prvky} prvků)')
        # DXF export → import zpět (do nové kresby)
        dxf = pg.evaluate("(async () => { const k = await import('/js/kresba.js'); return k.exportDXF(true); })()")
        ok('POLYLINE' in dxf and 'PLOT' in dxf and dxf.count('VERTEX') >= 8, 'DXF export obsahuje polylinie s vrcholy')
        n2 = pg.evaluate("(async (d) => { const k = await import('/js/kresba.js'); const m = await import('/js/projekt.js'); m.Projekt.get().kresba.prvky = []; return k.importDXF(d, false); })", dxf)
        prvky = pg.evaluate("(async () => { const m = await import('/js/projekt.js'); return m.Projekt.get().kresba.prvky.map(p => [p.typ, typeof p.body[0]]); })()")
        ok(n2 >= 3 and all(t == 'string' for _, t in prvky if _ == 'linie'), f'DXF import: {n2} prvků, linie chyceny na body: {prvky}')
        pg.click('#mapa-vse'); pg.wait_for_timeout(400); pg.screenshot(path=os.path.join(ROOT, '_diag', 'kresba.png'), clip={'x': 1000, 'y': 44, 'width': 400, 'height': 500})
        ok(not errs, 'bez chyb' + ('' if not errs else ': ' + ' | '.join(errs)[:300]))
        b.close()
    srv.shutdown()
print(f'--- {len(chyby)} chyb'); sys.exit(1 if chyby else 0)
