"""Průchod na skutečných datech (zap_husovice.zap + SS_BP.txt v kořeni projektu): python tests/test_realdata.py"""
import http.server, socketserver, threading, os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZAP, SEZ = os.path.join(ROOT, 'zap_husovice.zap'), os.path.join(ROOT, 'SS_BP.txt')
if not (os.path.exists(ZAP) and os.path.exists(SEZ)): print('soubory nejsou, přeskočeno'); sys.exit(0)
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
        b = p.chromium.launch(); pg = b.new_context(viewport={'width': 1400, 'height': 900}, service_workers='block').new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{port}/'); pg.wait_for_selector('#body-tab')
        # seznam souřadnic
        with pg.expect_file_chooser() as fc: pg.click('#sekce-body >> text=Import')
        fc.value.set_files(SEZ); pg.wait_for_selector('#imp-poradi')
        ok(pg.input_value('#imp-poradi') == 'groma-yx', 'odhad pořadí: Groma číslo Y X [Z]')
        pg.click('.dlg-pata >> text=Importovat'); pg.wait_for_timeout(400)
        ok(pg.locator('#body-tab tbody tr').count() == 5, '5 bodů ze seznamu')
        # zápisník
        pg.click('[data-tab=zapisnik]')
        with pg.expect_file_chooser() as fc: pg.click('text=Import z totálky')
        fc.value.set_files(ZAP); pg.wait_for_selector('#iz-format')
        ok(pg.input_value('#iz-format') == 'mapa2', 'formát rozpoznán: MAPA2')
        ok(pg.input_value('#iz-predcisli') == '610844000XX', 'předčíslí z hlavičky: ' + pg.input_value('#iz-predcisli'))
        pg.fill('#iz-predcisli', '61084400014')
        info = pg.locator('.dlg-telo').inner_text()
        ok('zprůměrováno' in info, 'náhled hlásí průměrování poloh')
        pg.click('.dlg-pata >> text=Importovat'); pg.wait_for_timeout(500)
        ok(pg.locator('#stred-zalozky button[aria-selected=true]').inner_text().startswith('Stanovisko 610844000144001'), 'stanovisko s plným číslem: ' + pg.locator('#stred-zalozky button[aria-selected=true]').inner_text())
        rows = pg.locator('#stred-obsah section.aktivni tbody tr'); n = rows.count()
        prvni = rows.nth(0); ok(prvni.locator('button').first.inner_text() == 'OR' and prvni.locator('input[aria-label=cislo]').input_value() == '000000944212300', 'první řádek = orientace 000000944212300')
        ok(rows.nth(1).locator('input[aria-label=cislo]').input_value() == '610844000144002' and rows.nth(1).locator('button').first.inner_text() == 'OR', 'druhá orientace 4002 s předčíslím')
        ok(rows.nth(2).locator('input[aria-label=cislo]').input_value() == 'JM-071-519', 'JM-071-519 beze změny')
        ok(80 < n < 128, f'řádků po průměrování poloh: {n} (v souboru 128 měření)')
        # polární metoda
        pg.click('text=Spočítat polární metodou'); pg.wait_for_selector('.karta-vysledek'); t = pg.locator('.karta-vysledek').inner_text()
        import re
        m = re.search(r'Orientační posun\n([\d,]+) g z (\d+) orientací', t)
        ok(m is not None and m.group(2) == '3', 'orientace ze 3 bodů (944212300, 4002, JM-071-519 = záměra? ne, OR jen 2 + JM?): ' + (m.group(0) if m else t[:200]))
        ok('PŘEKROČENO' not in t, 'polární: nic nepřekročeno' if 'PŘEKROČENO' not in t else 'polární: PŘEKROČENO — ' + t[:400].replace('\n', ' | '))
        print(t[:900])
        pg.screenshot(path=os.path.join(ROOT, '_diag', 'real-polarni.png'))
        # polární metoda dávkou přes celý zápisník
        pg.click('[data-tab=vypocty]'); pg.click('.dlazdice >> text=Polární metoda dávkou'); pg.click('text=Výpočet celého zápisníku'); pg.wait_for_selector('#stred-obsah section.aktivni .karta-vysledek')
        t2 = pg.locator('#stred-obsah section.aktivni .karta-vysledek').inner_text()
        ok('Stanovisek vypočteno' in t2 and '2 z 2' in t2, 'dávka: 2 z 2 stanovisek (4001, 4002): ' + t2[:160].replace(chr(10), ' | '))
        ok(pg.locator('#body-tab tbody tr').count() >= 80, f'dávka uložila body do seznamu ({pg.locator("#body-tab tbody tr").count()})')
        # vytyčovací prvky ze 4001 na 4002 pro bod 610844000140001
        pg.click('.dlazdice >> text=Vytyčovací prvky'); pg.fill('#vt-s', '610844000144001'); pg.fill('#vt-o', '610844000144002'); pg.fill('#vt-body', '610844000140001'); pg.locator('#stred-obsah section.aktivni >> text=Spočítat').click(); pg.wait_for_timeout(300)
        ok('Vytyčovací prvky' in pg.locator('#stred-obsah section.aktivni .karta-vysledek').inner_text(), 'vytyčovací prvky spočítány')
        ok(not errs, 'bez chyb v konzoli' + ('' if not errs else ': ' + ' | '.join(errs)[:300]))
        b.close()
    srv.shutdown()
print(f'--- {len(chyby)} chyb'); sys.exit(1 if chyby else 0)
