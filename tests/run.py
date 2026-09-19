"""Lokální běh testů bez Node: python tests/run.py (Playwright + http.server na volném portu)."""
import http.server, socketserver, threading, os, sys, json
import io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(self, *a): pass
with socketserver.TCPServer(('127.0.0.1', 0), H) as srv:
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{port}/tests/index.html')
        pg.wait_for_function('window.__vysledek', timeout=30000)
        print(pg.inner_text('#out'))
        r = pg.evaluate('window.__vysledek'); b.close()
    srv.shutdown()
if errs: print('CHYBY STRÁNKY:', errs)
sys.exit(1 if (r['chyb'] or errs) else 0)
