# QTRIG Kancelář

Geodetické výpočty pro PC i mobil (PWA) stavěné podle uživatelské příručky GROMA 14 — seznam souřadnic, zápisník z totální stanice, polární metoda (i dávkou přes celý zápisník), volné stanovisko, protínání, polygonový pořad, oměrné, výměry, transformace, výšky, kubatury, osy komunikací, mezní odchylky podle vyhlášky 357/2013 Sb., výpočetní protokol, kresba s kódováním a DXF, most do AR Geodetu a MicroStationu.

- **Web:** https://stepanvcelak11.github.io/qtrig-kancelar/
- Jádro výpočtů: `geo/*.js` (čisté ES moduly), testy `tests/testy*.js` — lokálně bez Node `python tests/run.py` (Playwright), v CI `node tests/node.mjs`
- Průchody appkou: `python tests/test_app.py`, na skutečných datech `python tests/test_realdata.py` (soubory `zap_husovice.zap`, `SS_BP.txt` v kořeni, nejsou v gitu), kresba `python tests/test_kresba.py`
- MicroStation: makro `most/QTRIGMost.bas` (VBA) — živý most přes cloudovou zakázku účtu QTRIG
- Konvence: S-JTSK (Y, X kladné), směrník σ = atan2(ΔY, ΔX) v gonech od +X po směru hodinových ručiček, rajón Y = Y₀ + d·sin σ, X = X₀ + d·cos σ; úplné číslo bodu = k. ú. (6) + ZPMZ (5) + bod (4)
