"""Průchod appkou v prohlížeči: python tests/test_app.py  (Playwright, vlastní http.server)."""
import http.server, socketserver, threading, os, sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '_diag'); os.makedirs(OUT, exist_ok=True)
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
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 1280, 'height': 800}, service_workers='block')
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto(f'http://127.0.0.1:{port}/'); pg.wait_for_selector('#body-tab')
        ok(pg.locator('.prazdno').first.is_visible(), 'start: prázdný seznam bodů')
        # body: přidat 3 body dialogem
        for c, y, x, z in [('5001', '745000,000', '1045000,000', '300,00'), ('5002', '745200,000', '1045010,000', '302,50'), ('5003', '745080,000', '1045250,000', '298,10')]:
            pg.click('text=+ Bod'); pg.fill('#nb-c', c); pg.fill('#nb-y', y); pg.fill('#nb-x', x); pg.fill('#nb-z', z); pg.click('.dlg-pata >> text=Přidat')
        ok(pg.locator('#body-tab tbody tr').count() == 3, 'přidány 3 body')
        ok(pg.locator('#poc-body').inner_text() == '3', 'počet v záložce')
        # úprava v místě
        pg.fill('#body-tab tbody tr:nth-child(1) td:nth-child(5) input', 'PBPP'); pg.keyboard.press('Enter')
        ok(bool(pg.evaluate("localStorage.getItem('qk-posledni')")), 'localStorage id')
        # zápisník: stanovisko 5001, orientace 5002 a 5003 se směry a délkami, dvě záměry
        pg.click('[data-tab=zapisnik]'); pg.click('text=+ Stanovisko'); pg.fill('#dlg-inp', '5001'); pg.click('.dlg-pata >> text=OK')
        ok(pg.locator('#stred-zalozky button[aria-selected=true]').inner_text().startswith('Stanovisko 5001'), 'otevřen editor stanoviska')
        pg.fill('#st-vp', '1,550'); pg.press('#st-vp', 'Tab')
        import math
        def polar(y, x, oy, ox, o):
            d = math.hypot(oy - y, ox - x); sig = math.atan2(oy - y, ox - x) / math.pi * 200; hz = (sig - o) % 400
            return f'{hz:.4f}'.replace('.', ','), f'{d:.3f}'.replace('.', ',')
        S = (745000.0, 1045000.0); o = 123.4567
        rows = [('o', '5002', *polar(*S, 745200.0, 1045010.0, o)), ('o', '5003', *polar(*S, 745080.0, 1045250.0, o)), ('z', '101', *polar(*S, 745050.0, 1045040.0, o)), ('z', '102', *polar(*S, 744960.0, 1045090.0, o))]
        for i, (typ, c, hz, d) in enumerate(rows):
            pg.click('text=+ Řádek')
            tr = pg.locator('#stred-obsah section.aktivni tbody tr').nth(i)
            if typ == 'z' and tr.locator('button').first.inner_text() == 'OR': tr.locator('button').first.click()
            if typ == 'o' and tr.locator('button').first.inner_text() != 'OR': tr.locator('button').first.click()
            tr.locator('input[aria-label=cislo]').fill(c); tr.locator('input[aria-label=hz]').fill(hz); tr.locator('input[aria-label=z]').fill('100,0000'); tr.locator('input[aria-label=ds]').fill(d); tr.locator('input[aria-label=ds]').press('Tab')
        pg.wait_for_timeout(300)
        ok(pg.locator('#stred-obsah section.aktivni tbody tr').count() == 4, '4 řádky v zápisníku')
        pg.click('text=Spočítat polární metodou')
        pg.wait_for_selector('.karta-vysledek')
        pg.uncheck('#po-red'); pg.click('text=Spočítat stanovisko a body'); pg.wait_for_timeout(200)
        txt = pg.locator('.karta-vysledek').inner_text()
        ok('Orientační posun' in txt and '123,4567' in txt, 'orientační posun 123,4567 g: ' + ('ano' if '123,4567' in txt else txt[:200]))
        ok('745050,000' in txt and '1045040,000' in txt, 'bod 101 Y 745050: ' + txt[txt.find('101'):txt.find('101') + 60].replace('\n', ' '))
        ok('v mezích' in txt, 'semafor v mezích')
        pg.click('.karta-vysledek >> text=/Uložit .* do seznamu/'); pg.wait_for_timeout(300)
        pg.click('[data-tab=body]')
        ok(pg.locator('#body-tab tbody tr').count() == 5, 'po uložení 5 bodů v seznamu')
        # protokol
        pg.click('#panel-pravy [data-tab=protokol]')
        ok('Polární metoda 5001' in pg.locator('#prot-obsah').inner_text(), 'protokol obsahuje polární metodu')
        # rajón
        pg.click('[data-tab=vypocty]'); pg.click('.dlazdice >> text=Rajón'); pg.fill('#rj-st', '5001'); pg.fill('#rj-or', '5002'); pg.fill('#rj-u', '50'); pg.fill('#rj-d', '100'); pg.fill('#rj-c', '201'); pg.click('#stred-obsah section.aktivni >> text=Spočítat')
        pg.wait_for_selector('#stred-obsah section.aktivni .karta-vysledek')
        ok('Rajón 201' in pg.locator('#stred-obsah section.aktivni .karta-vysledek').inner_text(), 'rajón spočítán')
        # oměrné
        pg.click('.dlazdice >> text=Kontrolní oměrné'); s = pg.locator('#stred-obsah section.aktivni'); s.locator('input[aria-label=a]').first.fill('5001'); s.locator('input[aria-label=b]').first.fill('5002'); s.locator('input[aria-label=d]').first.fill('200,70'); s.locator('text=Posoudit').click()
        pg.wait_for_selector('#stred-obsah section.aktivni .karta-vysledek'); t = s.locator('.karta-vysledek').inner_text()
        ok('PŘEKROČENO' in t, 'oměrná 200,70 vs 200,25: Δ 0,45 → ' + ('překročeno' if 'PŘEKROČENO' in t else 'v mezích?') + f' (u_d pro 200 m = {2*0.198*212/220:.3f})')
        # polygon: 5001 -> 102 -> 5003, orientace 5002 a 101 (uhly z pravych souradnic)
        pts = {'5001': (745000.0, 1045000.0), '5002': (745200.0, 1045010.0), '5003': (745080.0, 1045250.0), '101': (745050.0, 1045040.0), '102': (744960.0, 1045090.0)}
        def sm(a, b): return (math.atan2(pts[b][0] - pts[a][0], pts[b][1] - pts[a][1]) / math.pi * 200) % 400
        def dl(a, b): return math.hypot(pts[b][0] - pts[a][0], pts[b][1] - pts[a][1])
        g = lambda v: f'{v % 400:.4f}'.replace('.', ','); m3 = lambda v: f'{v:.3f}'.replace('.', ',')
        pg.click('[data-tab=vypocty]'); pg.click('.dlazdice >> text=Polygonový pořad'); s = pg.locator('#stred-obsah section.aktivni')
        pg.fill('#pg-pa', '5002'); pg.fill('#pg-pb', '101')
        rows = [('5001', sm('5001', '102') - sm('5001', '5002'), dl('5001', '102')), ('102', sm('102', '5003') - sm('102', '5001'), dl('102', '5003')), ('5003', sm('5003', '101') - sm('5003', '102'), None)]
        for i, (c, o, d) in enumerate(rows):
            tr = s.locator('tbody tr').nth(i); tr.locator('[aria-label=c]').fill(c); tr.locator('[aria-label=o]').fill(g(o))
            if d is not None: tr.locator('[aria-label=d]').fill(m3(d))
        s.locator('text=Spočítat pořad').click(); pg.wait_for_selector('#stred-obsah section.aktivni .karta-vysledek'); t = s.locator('.karta-vysledek').inner_text()
        ok('Polygonový pořad 5001' in t and 'v mezích' in t and '744960,000' in t, 'polygon: uzávěry nulové, bod 102 sedí: ' + t[:120].replace(chr(10), ' '))
        # transformace: posun o +10/+20 a rotace 0
        pg.click('.dlazdice >> text=Transformace'); s = pg.locator('#stred-obsah section.aktivni')
        for i, c in enumerate(['5001', '5002', '5003']):
            tr = s.locator('tbody tr').nth(i); tr.locator('[aria-label=c]').fill(c); tr.locator('[aria-label=y]').fill(m3(pts[c][0] - 10)); tr.locator('[aria-label=x]').fill(m3(pts[c][1] - 20)); tr.locator('[aria-label=cil]').fill(c)
        pg.fill('#tr-dalsi', '901 744990.000 1044980.000'); s.locator('text=Spočítat transformaci').click(); pg.wait_for_selector('#stred-obsah section.aktivni .karta-vysledek'); t = s.locator('.karta-vysledek').inner_text()
        ok('901' in t and '745000,000' in t and '1045000,000' in t, 'transformace: 901 → 745000/1045000: ' + t[t.find('901'):t.find('901') + 50].replace(chr(10), ' '))
        # osa: 5001 -> 5002 (R 50) -> 5003, stanicen bodu 101, bod ze stanicen
        pg.click('.dlazdice >> text=Osa, staničení'); s = pg.locator('#stred-obsah section.aktivni')
        for i, (c, R) in enumerate([('5001', ''), ('5002', '50'), ('5003', '')]):
            tr = s.locator('tbody').first.locator('tr').nth(i); tr.locator('[aria-label=c]').fill(c)
            if R: tr.locator('[aria-label=r]').fill(R)
        s.locator('text=Sestavit osu a hlavní body').click(); pg.wait_for_selector('#stred-obsah section.aktivni .karta-vysledek'); t = s.locator('.karta-vysledek').inner_text()
        ok('TK1' in t and 'KT1' in t and 'KÚ' in t and 'PŘEKROČENO' not in t, 'osa: hlavní body ZÚ/TK/KT/KÚ: ' + ('ok' if 'TK1' in t else t[:150].replace(chr(10), ' ')))
        pg.fill('#os-body', '101'); s.locator('button:has-text("Staničení a kolmice")').click(); pg.wait_for_timeout(300); t = s.locator('.karta-vysledek').inner_text()
        ok('Staničení bodů' in t and ('vpravo' in t or 'vlevo' in t), 'osa: staničení bodu 101')
        # export TXT dialog otevřít a zavřít
        pg.click('[data-tab=body]'); pg.click('text=Export'); ok(pg.locator('#exp-format').is_visible(), 'export dialog'); pg.keyboard.press('Escape')
        # reload → data zůstala
        pg.reload(); pg.wait_for_selector('#body-tab tbody tr'); ok(pg.locator('#body-tab tbody tr').count() == 5, 'po reloadu 5 bodů (IndexedDB)')
        pg.screenshot(path=os.path.join(OUT, 'pc-svetly.png'))
        pg.evaluate("document.documentElement.dataset.theme='dark'"); pg.click('[data-tab=vypocty]'); pg.screenshot(path=os.path.join(OUT, 'pc-tmavy.png'))
        # mobil
        m = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block').new_page()
        m.on('pageerror', lambda e: errs.append('mobil: ' + str(e)))
        m.goto(f'http://127.0.0.1:{port}/'); m.wait_for_selector('#body-tab')
        ok(m.locator('.mobil-tabs').is_visible() and not m.locator('#panel-stred').is_visible(), 'mobil: spodní záložky, jen levý panel')
        m.screenshot(path=os.path.join(OUT, 'mobil-body.png'))
        m.click('.mobil-tabs >> text=Mapa'); m.wait_for_timeout(300); ok(m.locator('#panel-pravy').is_visible(), 'mobil: mapa'); m.screenshot(path=os.path.join(OUT, 'mobil-mapa.png'))
        m.click('.mobil-tabs >> text=Seznamy'); m.click('[data-tab=zapisnik]'); m.click('text=+ Stanovisko'); m.fill('#dlg-inp', '5001'); m.click('.dlg-pata >> text=OK'); m.wait_for_timeout(300)
        ok(m.locator('#panel-stred').is_visible(), 'mobil: klik na stanovisko přepne na Práci'); m.screenshot(path=os.path.join(OUT, 'mobil-zapisnik.png'))
        ok(not errs, 'bez chyb v konzoli' + ('' if not errs else ': ' + ' | '.join(errs)[:400]))
        b.close()
    srv.shutdown()
print(f'--- {len(chyby)} chyb'); sys.exit(1 if chyby else 0)
