# QTRIG Kancelář

Geodetické výpočty pro PC i mobil (PWA) — náhrada za Gromu: seznam souřadnic, zápisník z totální stanice, polární metoda, volné stanovisko, rajón, protínání, polygonový pořad, oměrné, výměry, transformace, výšky, mezní odchylky podle vyhlášky 357/2013 Sb. a výpočetní protokol.

- **Web:** https://stepanvcelak11.github.io/qtrig-kancelar/
- Jádro výpočtů: `geo/*.js` (čisté ES moduly, bez UI), testy `tests/testy.js`
- Testy lokálně bez Node: `python tests/run.py` (Playwright); průchod appkou `python tests/test_app.py`; v CI `node tests/node.mjs`
- Konvence: S-JTSK (Y, X kladné), směrník σ = atan2(ΔY, ΔX) v gonech od +X po směru hodinových ručiček, rajón Y = Y₀ + d·sin σ, X = X₀ + d·cos σ
