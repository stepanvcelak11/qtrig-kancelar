// Kapitoly podle osnov VUT FAST – Bc., 2.–3. ročník:
// Mapování 1 (BEA011), Mapování 2 (BEA017), Katastr nemovitostí 1 (BEA016),
// Katastr nemovitostí 2 (BEA022), Pozemkové úpravy (kód předmětu neznámý).
// Formát otázek viz u01-03.js; { t: 'n', q, a, tol, dec, unit, e } = číselná odpověď.

export default [
  {
    id: 'bea011', title: 'Mapování 1', color: '#2563eb', level: 'Bc.', course: 'BEA011', sem: '2. ročník · ZS',
    desc: 'Státní mapová díla, výškopis a vrstevnice, měřický náčrt, podrobné měření, korekce, třídy přesnosti a digitální technická mapa.',
    lessons: [
      {
        id: 'bea011l1', title: 'Mapová díla a bodová pole', icon: '🗺️', gens: ['mapSymbol'],
        items: [
          { t: 'c', q: 'Který předpis stanoví závazné geodetické referenční systémy a státní mapová díla?', a: 'Nařízení vlády č. 430/2006 Sb.', w: ['Vyhláška č. 357/2013 Sb.', 'Zákon č. 139/2002 Sb.', 'Zákon č. 183/2006 Sb.'], e: 'Nařízení vlády 430/2006 Sb. určuje mj. S-JTSK, ETRS89, Bpv a výčet státních mapových děl.' },
          { t: 'c', q: 'Které dílo patří mezi státní mapová díla?', a: 'Státní mapa 1 : 5 000', w: ['Turistická mapa KČT', 'Silniční autoatlas ČR', 'Plán města od vydavatele'], e: 'Státní mapová díla vydává stát (ČÚZK, ZÚ) – např. katastrální mapa, SM5, Základní mapa ČR.' },
          { t: 'c', q: 'ZABAGED je…', a: 'digitální topografický model území ČR', w: ['databáze vlastníků pozemků', 'síť permanentních stanic GNSS', 'formát pro výměnu dat katastru'], e: 'Základní báze geografických dat spravuje Zeměměřický úřad; je podkladem pro Základní mapu ČR.' },
          { t: 'c', q: 'Mapa velkého měřítka je mapa v měřítku…', a: '1 : 5 000 a větším', w: ['1 : 50 000 a menším', 'jen 1 : 100 000', '1 : 200 000 a větším'], e: 'Mapy velkých měřítek (1 : 5 000 a větší) zachycují polohopis podrobně – katastrální, technické a účelové mapy.' },
          { t: 'c', q: 'Bod základního nebo zhušťovacího polohového bodového pole je jednoznačně označen…', a: 'číslem triangulačního listu a pořadovým číslem bodu', w: ['jen pořadovým číslem v obci', 'číslem ZPMZ a rokem měření', 'souřadnicemi zaokrouhlenými na metry'], e: 'Číslo listu určuje oblast, pořadové číslo bod v ní – číslo je tak v rámci ČR jedinečné.' },
          { t: 'c', q: 'Pomocné měřické body pro podrobné mapování…', a: 'slouží k připojení měření a nejsou součástí PPBP', w: ['tvoří základní polohové bodové pole', 'musí být stabilizovány kamenným hranolem', 'se zapisují na list vlastnictví'], e: 'Pomocné body (např. stanoviska) se volí podle potřeby měření; trvalé body PPBP se zřizují zvlášť.' },
          { t: 'tf', q: 'Výšky v mapách velkých měřítek se v ČR udávají ve výškovém systému baltském – po vyrovnání (Bpv).', a: true, e: 'Bpv je závazný výškový systém; polohu udává S-JTSK.' },
          { t: 'm', q: 'Spojte referenční systém s účelem', p: [['S-JTSK', 'Civilní polohový systém'], ['Bpv', 'Nadmořské výšky'], ['ETRS89', 'Evropský systém pro GNSS'], ['S-Gr95', 'Tíhový systém']] },
        ],
      },
      {
        id: 'bea011l2', title: 'Terénní tvary a vrstevnice', icon: '⛰️', gens: ['slopePercent', 'contour'],
        items: [
          { t: 'c', q: 'Spádnice je čára, která…', a: 'protíná vrstevnice kolmo ve směru největšího spádu', w: ['spojuje body stejné výšky', 'vede vždy po hřbetu kopce', 'je rovnoběžná s vrstevnicemi'], e: 'Voda teče po spádnici; ta je v každém bodě kolmá k vrstevnici.' },
          { t: 'c', q: 'Terénní tvar mezi dvěma vrcholy na hřbetu, kde se hřbetnice snižuje, se nazývá…', a: 'sedlo', w: ['kotlina', 'úžlabí', 'kupa'], e: 'V sedle se stýkají dvě hřbetnice a dvě údolnice.' },
          { t: 'c', q: 'Údolnice je…', a: 'čára spojující nejnižší body údolí', w: ['čára na vrcholu hřbetu', 'hranice lesa', 'vrstevnice s nulovou výškou'], e: 'Údolnice (spojnice nejnižších míst) a hřbetnice (rozvodnice) jsou kostrou terénu.' },
          { t: 'c', q: 'Vrstevnice se mezi dvěma zaměřenými body interpolují…', a: 'lineárně po terénní spojnici se stálým sklonem', w: ['po libovolné spojnici bodů', 'kolmo k hřbetnici vždy', 'podle barvy povrchu'], e: 'Lineární interpolace předpokládá stálý sklon – proto se interpoluje jen mezi body na terénní hraně, spádnici či hřbetnici.' },
          { t: 'n', q: 'Bod A má výšku 312,40 m, bod B 318,90 m, na mapě jsou vzdáleny 26 mm. V jaké vzdálenosti od A (v mm) prochází vrstevnice 315 m?', a: 10.4, tol: 0.1, dec: 1, unit: 'mm', e: 'd = (315 − 312,40) / (318,90 − 312,40) · 26 = 2,6 / 6,5 · 26 = 10,4 mm.' },
          { t: 'c', q: 'Kam se při tachymetrii musí umístit podrobné výškové body?', a: 'na terénních hranách a lomech sklonu', w: ['jen v pravidelné síti 10 × 10 m', 'pouze na hranicích parcel', 'jen u vrstevnic celých metrů'], e: 'Podrobné body se volí tak, aby mezi nimi byl terén rovinný – na hranách, hřbetnicích, údolnicích.' },
          { t: 'tf', q: 'Šrafy a stínování jsou metody znázornění výškopisu, které samy nedávají přesné výšky.', a: true, e: 'Přesnou výšku nesou kóty a vrstevnice; šrafy a stínování jen zlepšují plastičnost.' },
          { t: 'm', q: 'Spojte terénní tvar s vrstevnicovým obrazem', p: [['Kupa', 'Uzavřené vrstevnice, výška roste dovnitř'], ['Kotlina', 'Uzavřené vrstevnice, výška klesá dovnitř'], ['Hřbet', 'Vrstevnice vybíhají ve směru klesání'], ['Údolí', 'Vrstevnice se vtahují proti klesání']] },
        ],
      },
      {
        id: 'bea011l3', title: 'Náčrt a podrobné měření', icon: '✏️', gens: ['station'],
        items: [
          { t: 'c', q: 'Měřický náčrt se vyhotovuje…', a: 'v terénu současně s měřením', w: ['doma podle hotové mapy', 'až po výpočtu souřadnic', 'jen u měření GNSS'], e: 'Náčrt zachycuje skutečnost v terénu, čísla bodů a oměrné míry – proto vzniká přímo při měření.' },
          { t: 'c', q: 'Co měřický náčrt NEobsahuje?', a: 'vypočtené souřadnice podrobných bodů', w: ['čísla podrobných bodů', 'oměrné a kontrolní míry', 'orientaci k severu'], e: 'Souřadnice jsou v seznamu souřadnic; náčrt obsahuje kresbu, čísla bodů, míry a značky.' },
          { t: 'c', q: 'Oměrná míra je…', a: 'měřená vzdálenost sousedních podrobných bodů pro kontrolu', w: ['délka od stanoviska k bodu', 'výška cíle nad bodem', 'měřítko náčrtu'], e: 'Oměrné míry porovnané s mírami ze souřadnic odhalí hrubé chyby a zvyšují spolehlivost.' },
          { t: 'c', q: 'Ortogonální metoda podrobného měření určuje bod…', a: 'staničením a kolmicí k měřické přímce', w: ['směrem a délkou ze stanoviska', 'průsečíkem dvou vrstevnic', 'jen výškou a sklonem'], e: 'Pravoúhlé souřadnice (staničení, kolmice) vůči měřické přímce – historicky pásmo a pentagon.' },
          { t: 'c', q: 'Nejčastější metoda podrobného měření totální stanicí je…', a: 'polární metoda', w: ['metoda protínání zpět', 'ortogonální metoda', 'trigonometrická nivelace ze středu'], e: 'Ze stanoviska se měří vodorovný směr, šikmá délka a zenitový úhel na každý podrobný bod.' },
          { t: 'tf', q: 'Pokud se číslo bodu v náčrtu a v zápisníku liší, lze chybu snadno odhalit jen z vypočtených souřadnic.', a: false, e: 'Záměna čísel často projde výpočtem bez chyby – odhalí ji až kontrola náčrtu, oměrné míry nebo kresba.' },
          { t: 'o', q: 'Seřaďte postup podrobného měření', s: ['Rekognoskace území', 'Volba a zaměření pomocných měřických bodů', 'Měření podrobných bodů s vedením náčrtu', 'Výpočet souřadnic a výšek', 'Kontrola oměrnými mírami', 'Tvorba mapy'], e: 'Nejdřív síť stanovisek, pak podrobné body, výpočet, kontrola a nakonec kresba.' },
        ],
      },
      {
        id: 'bea011l4', title: 'Korekce a přesnost', icon: '🎯', gens: ['hdFromSd'],
        items: [
          { t: 'c', q: 'Atmosférická korekce délky je korekce…', a: 'fyzikální (teplota, tlak, vlhkost)', w: ['matematická z kartografického zobrazení', 'z nadmořské výšky', 'z excentricity cíle'], e: 'Rychlost světla v atmosféře závisí na indexu lomu; změna teploty o 1 °C mění délku zhruba o 1 ppm.' },
          { t: 'o', q: 'Seřaďte opravy měřené délky pro výpočet v S-JTSK', s: ['Fyzikální (atmosférická) korekce', 'Redukce na vodorovnou délku', 'Redukce do nulového horizontu', 'Redukce do zobrazení S-JTSK'], e: 'Nejprve oprava měřené šikmé délky, pak geometrie: vodorovná → hladina moře → rovina zobrazení.' },
          { t: 'n', q: 'Jaká je oprava vodorovné délky 1 000 m z redukce do nulového horizontu, je-li průměrná nadmořská výška 500 m (R = 6 380 km)? Výsledek v mm.', a: -78.4, tol: 0.5, dec: 1, unit: 'mm', e: 'Δd = −d · H / R = −1 000 · 500 / 6 380 000 m = −0,0784 m = −78,4 mm.' },
          { t: 'c', q: 'Délkové zkreslení S-JTSK se na území ČR pohybuje zhruba v rozmezí…', a: '−10 až +14 cm/km', w: ['−1 až +1 mm/km', '−1 až +2 m/km', '0 až +40 cm/km'], e: 'Kartografické zkreslení Křovákova zobrazení je malé, ale u delších stran se musí zavést.' },
          { t: 'c', q: 'Kolik tříd přesnosti rozlišuje ČSN 01 3410 pro mapy velkých měřítek?', a: '5', w: ['3', '8', '10'], e: 'Třídy 1–5; nejčastěji se používá 3. třída (m_xy = 0,14 m).' },
          { t: 'm', q: 'Spojte třídu přesnosti s mezní hodnotou střední souřadnicové chyby m_xy', p: [['1. třída', '0,04 m'], ['2. třída', '0,08 m'], ['3. třída', '0,14 m'], ['4. třída', '0,26 m'], ['5. třída', '0,50 m']] },
          { t: 'tf', q: 'Kódy kvality 6 až 8 se v katastru přidělují bodům určeným digitalizací z grafické mapy.', a: true, e: 'Kódy 3–5 mají body určené měřením, kódy 6–8 body odvozené z analogové mapy.' },
          { t: 'tf', q: 'Nesprávně nastavená součtová konstanta hranolu vnáší do každé délky systematickou chybu.', a: true, e: 'Konstanta se přičítá ke všem délkám stejně, průměrování ji neodstraní.' },
        ],
      },
      {
        id: 'bea011l5', title: 'DTM a nové technologie', icon: '🚁',
        items: [
          { t: 'c', q: 'Digitální technickou mapu (DTM kraje) vede…', a: 'kraj', w: ['katastrální úřad', 'obec s rozšířenou působností', 'Státní pozemkový úřad'], e: 'DTM kraje vedou kraje; ČÚZK provozuje informační systém digitální mapy veřejné správy (IS DMVS).' },
          { t: 'c', q: 'DTM zavedl novelou zákona o zeměměřictví…', a: 'zákon č. 47/2020 Sb.', w: ['zákon č. 344/1992 Sb.', 'zákon č. 139/2002 Sb.', 'zákon č. 22/1964 Sb.'], e: 'Zákon 47/2020 Sb. doplnil do zákona 200/1994 Sb. digitální technickou mapu.' },
          { t: 'c', q: 'Data do DTM se předávají ve formátu…', a: 'JVF DTM', w: ['VFK', 'DXF R12', 'RINEX'], e: 'Jednotný výměnný formát DTM je založený na XML; VFK slouží katastru, RINEX pro GNSS.' },
          { t: 'c', q: 'Obsahem DTM je základní prostorová situace a…', a: 'dopravní a technická infrastruktura', w: ['vlastnická práva k pozemkům', 'bonitované půdně ekologické jednotky', 'ceny nemovitostí'], e: 'DTM popisuje stavby, povrchy a sítě; vlastnictví eviduje katastr.' },
          { t: 'c', q: 'Mobilní mapovací systém (MMS) kombinuje…', a: 'GNSS, inerciální jednotku, skenery a kamery', w: ['jen totální stanici a hranol', 'nivelační přístroj a latě', 'pouze družicové snímky'], e: 'Trajektorii vozidla určí GNSS + IMU, skenery a kamery zaznamenají okolí.' },
          { t: 'm', q: 'Spojte model s obsahem', p: [['DMR', 'Holý terén bez vegetace a staveb'], ['DMP', 'Povrch včetně budov a vegetace'], ['DMT', 'Obecný model terénu s výškopisem'], ['Mračno bodů', 'Surový výstup skenování']] },
          { t: 'c', q: 'DMR 5G vznikl z leteckého laserového skenování a má v odkrytém terénu úplnou střední chybu výšky přibližně…', a: '0,18 m', w: ['0,02 m', '1,5 m', '5 m'], e: 'DMR 5G je nepravidelná síť (TIN); v zalesněném terénu je chyba zhruba 0,3 m.' },
          { t: 'tf', q: 'Polohová přesnost mapování z UAV závisí mimo jiné na velikosti pixelu na zemi (GSD) a na vlícovacích bodech.', a: true, e: 'Menší GSD a dobře rozmístěné vlícovací body zlepšují přesnost výsledku.' },
        ],
      },
    ],
  },

  {
    id: 'bea017', title: 'Mapování 2', color: '#a16207', level: 'Bc.', course: 'BEA017', sem: '2. ročník · LS',
    desc: 'Obnova katastrálního operátu, DKM a KMD, ZPMZ a PPBP, historie mapování a katastru od stabilního katastru po KN.',
    lessons: [
      {
        id: 'bea017l1', title: 'Obnova katastrálního operátu', icon: '♻️',
        items: [
          { t: 'c', q: 'Obnova katastrálního operátu se podle katastrálního zákona provádí novým mapováním, přepracováním SGI nebo…', a: 'na podkladě výsledků pozemkových úprav', w: ['na žádost jednoho vlastníka', 'vektorizací ortofota', 'geometrickým plánem'], e: 'Tři způsoby obnovy KO: nové mapování, na podkladě pozemkových úprav, přepracování souboru geodetických informací.' },
          { t: 'c', q: 'Výsledkem obnovy KO přepracováním analogové mapy je obvykle…', a: 'katastrální mapa digitalizovaná (KMD)', w: ['digitální katastrální mapa (DKM)', 'Základní mapa ČR 1 : 10 000', 'Státní mapa 1 : 5 000'], e: 'KMD vzniká převodem (vektorizací a transformací) analogové, často sáhové mapy.' },
          { t: 'c', q: 'Proč má KMD z map 1 : 2 880 nižší přesnost než DKM?', a: 'přebírá přesnost původní grafické mapy', w: ['je vedena v jiném systému než S-JTSK', 'neobsahuje parcelní čísla', 'je jen rastrová'], e: 'Digitalizace nezpřesní polohu hranic – body mají kódy kvality 6–8.' },
          { t: 'c', q: 'Obnovený katastrální operát před vyhlášením platnosti…', a: 'se vyloží k veřejnému nahlédnutí', w: ['se pošle notářům ke schválení', 'se vytiskne a zašle obcím', 'nemusí se nikomu zpřístupnit'], e: 'Vlastníci mohou při vyložení podat námitky proti obsahu obnoveného operátu.' },
          { t: 'tf', q: 'Dnem vyhlášení platnosti obnoveného katastrálního operátu pozbývá dosavadní operát platnosti.', a: true, e: 'Od té chvíle se katastr vede jen podle obnoveného operátu.' },
          { t: 'o', q: 'Seřaďte etapy obnovy KO novým mapováním', s: ['Oznámení obnovy obci', 'Revize a doplnění PPBP', 'Zjišťování průběhu hranic', 'Podrobné měření', 'Vyhotovení DKM a SPI', 'Vyložení a vyhlášení platnosti'], e: 'Bez bodového pole se nedá měřit, bez zjištěných hranic se nemá co měřit.' },
          { t: 'c', q: 'Zjišťování průběhu hranic při obnově KO provádí…', a: 'komise za účasti vlastníků', w: ['sám vlastník bez úřadu', 'jen soudní znalec', 'obecní policie'], e: 'Vlastníci ukazují hranice, komise zjištěný stav zaznamená do soupisu nemovitostí a náčrtů.' },
        ],
      },
      {
        id: 'bea017l2', title: 'Nové mapování a PPBP', icon: '📍', gens: ['polarY', 'polarX'],
        items: [
          { t: 'c', q: 'PPBP znamená…', a: 'podrobné polohové bodové pole', w: ['pomocné polní bodové pole', 'polohový plán bodů pozemku', 'primární polohová bodová síť'], e: 'PPBP zhušťuje základní a zhušťovací body pro podrobné měření.' },
          { t: 'c', q: 'Body PPBP se určují se střední souřadnicovou chybou nejvýše…', a: '0,06 m', w: ['0,14 m', '0,26 m', '0,015 m'], e: 'Podle zeměměřické vyhlášky m_xy ≤ 0,06 m – body PPBP jsou přesnější než podrobné body (0,14 m).' },
          { t: 'c', q: 'Revize PPBP před měřením zjišťuje hlavně…', a: 'zachovalost a použitelnost bodů v terénu', w: ['vlastníky okolních pozemků', 'výměry parcel', 'ceny pozemků podle BPEJ'], e: 'Zničené body se vyřadí nebo nahradí, poškozené obnoví – teprve pak se na ně lze připojit.' },
          { t: 'c', q: 'Body PPBP se dnes nejčastěji určují…', a: 'technologií GNSS nebo polygonovými pořady', w: ['grafickým protínáním na měřickém stole', 'odměřením z katastrální mapy', 'jen nivelací'], e: 'GNSS (RTK, statika) a polygonové pořady s připojením na ZhB či body ZPBP.' },
          { t: 'c', q: 'Vnější obvod budovy v katastrální mapě se určuje…', a: 'průnikem obvodových konstrukcí s terénem', w: ['půdorysem střechy', 'obrysem balkonů a říms', 'podle projektu bez měření'], e: 'Převisy střech a balkony se do obvodu budovy nezahrnují.' },
          { t: 'tf', q: 'Podrobné body při novém mapování pro obnovu KO se zpravidla určují s kódem kvality 3.', a: true, e: 'Kód 3 odpovídá m_xy = 0,14 m – přesné geodetické měření.' },
          { t: 'm', q: 'Spojte druh bodu s typickou stabilizací', p: [['Bod PPBP ve zpevněné ploše', 'Hřeb nebo kovová značka'], ['Bod PPBP v nezpevněném terénu', 'Kamenný hranol nebo trubka'], ['Pomocný bod na jedno měření', 'Dřevěný kolík'], ['Lomový bod hranice', 'Mezník nebo plastový znak']] },
        ],
      },
      {
        id: 'bea017l3', title: 'DKM, VFK a ZPMZ', icon: '💾',
        items: [
          { t: 'c', q: 'DKM vzniká…', a: 'novým mapováním nebo z výsledků pozemkových úprav', w: ['skenováním sáhových map', 'z leteckého ortofota bez měření', 'přepisem pozemkové knihy'], e: 'DKM má body určené měřením v S-JTSK; digitalizované mapy se označují KMD.' },
          { t: 'c', q: 'Výměnný formát katastru (VFK) je…', a: 'textový formát s daty SGI i SPI', w: ['rastrový obrázek katastrální mapy', 'binární formát GNSS observací', 'formát pro tisk listu vlastnictví'], e: 'VFK předává geometrii i popisné údaje; zeměměřič ho získá pro vyhotovení GP.' },
          { t: 'c', q: 'ZPMZ znamená…', a: 'záznam podrobného měření změn', w: ['zápis polohy měřených značek', 'zpráva o provedení mapových změn', 'základní plán mapové zóny'], e: 'Dokumentuje každé měření změny v katastru.' },
          { t: 'c', q: 'Záznamy podrobného měření změn se číslují…', a: 'průběžně v rámci katastrálního území', w: ['podle rodného čísla vlastníka', 'podle triangulačních listů', 'náhodně vyhotovitelem'], e: 'Číslo ZPMZ je součástí čísel bodů i čísla geometrického plánu.' },
          { t: 'c', q: 'Číslo podrobného bodu v katastru se skládá z…', a: 'čísla ZPMZ a pořadového čísla bodu', w: ['parcelního čísla a čísla LV', 'čísla k. ú. a výšky bodu', 'data měření a iniciál'], e: 'Např. bod 245-12 = 12. bod v ZPMZ č. 245; úplné číslo doplňuje číslo k. ú.' },
          { t: 'tf', q: 'Soubor ZPMZ je součástí dokumentace výsledků šetření a měření, kterou vede katastrální úřad.', a: true, e: 'Z nich lze kdykoli ověřit, jak byla hranice zaměřena.' },
          { t: 'm', q: 'Spojte obsah ZPMZ', p: [['Měřický náčrt', 'Kresba, čísla bodů, oměrné míry'], ['Zápisník', 'Měřené směry a délky'], ['Protokol o výpočtech', 'Výpočty a kontroly'], ['Seznam souřadnic', 'Souřadnice a kódy kvality']] },
        ],
      },
      {
        id: 'bea017l4', title: 'Stabilní katastr a vojenská mapování', icon: '📜',
        items: [
          { t: 'c', q: 'Patent o stabilním katastru vydal císař František I. v roce…', a: '1817', w: ['1785', '1869', '1927'], e: 'Patent z 23. 12. 1817 – daňový katastr založený na systematickém měření celé monarchie.' },
          { t: 'c', q: 'Mapy stabilního katastru mají měřítko…', a: '1 : 2 880', w: ['1 : 2 000', '1 : 25 000', '1 : 5 760'], e: '1 palec na mapě = 40 sáhů ve skutečnosti; 40 · 72 palců = 2 880 palců.' },
          { t: 'c', q: 'Stabilní katastr byl mapován hlavně…', a: 'grafickou metodou na měřickém stole', w: ['totálními stanicemi', 'leteckou fotogrammetrií', 'ortogonální metodou s pásmem'], e: 'Měřický stůl s dioptrovým pravítkem – kresba vznikala přímo v terénu.' },
          { t: 'c', q: 'Souřadnicové soustavy stabilního katastru pro Čechy a Moravu měly počátky…', a: 'Gusterberg a Svatý Štěpán', w: ['Ondřejov a Pecný', 'Lišov a Kronštadt', 'Greenwich a Ferro'], e: 'Cassiniho–Soldnerovo zobrazení; Gusterberg pro Čechy, věž sv. Štěpána ve Vídni pro Moravu a Slezsko.' },
          { t: 'c', q: 'Hlavním účelem stabilního katastru bylo…', a: 'spravedlivé vyměření pozemkové daně', w: ['evidence vlastnických práv', 'vojenská navigace', 'plánování železnic'], e: 'Daň se stanovila podle čistého výnosu pozemků – proto „stabilní“ (trvalý) katastr.' },
          { t: 'tf', q: 'Josefský katastr (1785–1789) byl prvním katastrem v našich zemích založeným na měření pozemků.', a: true, e: 'Předchozí tereziánský katastr vycházel z přiznání vrchností, bez měření.' },
          { t: 'o', q: 'Seřaďte vojenská mapování chronologicky', s: ['1. (josefské) – bez geodetického základu', '2. (františkovo) – na podkladě katastrální triangulace', '3. (františko-josefské) – 1 : 25 000, výškopis vrstevnicemi'], e: '1. a 2. mapování v 1 : 28 800, třetí (1869–1887, v českých zemích 1876–1880) v 1 : 25 000.' },
          { t: 'c', q: 'Stavební parcely se ve stabilním katastru…', a: 'číslovaly samostatnou číselnou řadou', w: ['nečíslovaly vůbec', 'označovaly písmeny abecedy', 'číslovaly podle vlastníků'], e: 'Dvojí číselná řada (stavební a pozemkové parcely) přetrvává v katastru dodnes.' },
        ],
      },
      {
        id: 'bea017l5', title: 'Od reambulance ke KN', icon: '🕰️',
        items: [
          { t: 'c', q: 'Reambulance stabilního katastru (1869–1881) byla…', a: 'revize a doplnění map podle skutečnosti', w: ['nové mapování v S-JTSK', 'zrušení pozemkových knih', 'zavedení JEP'], e: 'Mapy se aktualizovaly podle změn od doby mapování, bez nového měření celé plochy.' },
          { t: 'c', q: 'Pozemkový katastr byl zřízen zákonem…', a: 'č. 177/1927 Sb.', w: ['č. 22/1964 Sb.', 'č. 344/1992 Sb.', 'č. 256/2013 Sb.'], e: 'Zákon o pozemkovém katastru a jeho vedení – katastr měl sloužit i právním účelům.' },
          { t: 'c', q: 'Jednotná evidence půdy (JEP, od 1956) evidovala hlavně…', a: 'užívání půdy, ne vlastnictví', w: ['vlastnická práva ve vkladech', 'jen lesní pozemky', 'stavby a byty'], e: 'Kolektivizace vedla k evidenci uživatelských vztahů; vlastnické hranice se v mapách neudržovaly.' },
          { t: 'c', q: 'Evidenci nemovitostí (EN) zavedl zákon…', a: 'č. 22/1964 Sb.', w: ['č. 177/1927 Sb.', 'č. 200/1994 Sb.', 'č. 139/2002 Sb.'], e: 'EN se vedla od roku 1964 do konce roku 1992.' },
          { t: 'c', q: 'Katastr nemovitostí ČR se vede od…', a: '1. 1. 1993', w: ['1. 1. 1964', '1. 1. 2014', '1. 1. 1951'], e: 'Zákon 344/1992 Sb. sloučil evidenci nemovitostí a evidenci právních vztahů; od 2014 platí zákon 256/2013 Sb.' },
          { t: 'o', q: 'Seřaďte pozemkové evidence chronologicky', s: ['Stabilní katastr', 'Evidenční katastr (po reambulanci)', 'Pozemkový katastr', 'Jednotná evidence půdy', 'Evidence nemovitostí', 'Katastr nemovitostí'], e: '1817 → 1883 → 1927 → 1956 → 1964 → 1993.' },
          { t: 'tf', q: 'Technickohospodářská mapa (THM) byla mapou velkého měřítka užívanou v období evidence nemovitostí.', a: true, e: 'THM v měřítcích 1 : 1 000 a 1 : 2 000; později ZMVM a pak DKM.' },
        ],
      },
    ],
  },

  {
    id: 'bea016', title: 'Katastr nemovitostí 1', color: '#9333ea', level: 'Bc.', course: 'BEA016', sem: '2. ročník · LS',
    desc: 'Pojmy katastru, historické míry a pozemkové knihy, organizace resortu, SGI a SPI, poskytování údajů a základy geometrického plánu.',
    lessons: [
      {
        id: 'bea016l1', title: 'Pojmy katastru', icon: '🏡',
        items: [
          { t: 'c', q: 'Stavební parcela je pozemek evidovaný v druhu…', a: 'zastavěná plocha a nádvoří', w: ['ostatní plocha', 'zahrada', 'trvalý travní porost'], e: 'Ostatní pozemky jsou pozemkové parcely.' },
          { t: 'c', q: 'Kolik druhů pozemků rozlišuje katastr nemovitostí?', a: '10', w: ['5', '7', '14'], e: 'Orná půda, chmelnice, vinice, zahrada, ovocný sad, trvalý travní porost, lesní pozemek, vodní plocha, zastavěná plocha a nádvoří, ostatní plocha.' },
          { t: 'c', q: 'Která nemovitost se v katastru neeviduje jako samostatná?', a: 'stavba, která je součástí pozemku', w: ['jednotka vymezená podle OZ', 'právo stavby', 'pozemek v podobě parcely'], e: 'Od 2014 platí zásada superficies solo cedit – stavba bývá součástí pozemku a nemá samostatné vlastnictví.' },
          { t: 'c', q: 'Katastrální území je…', a: 'místopisně uzavřený soubor nemovitostí', w: ['území jednoho vlastníka půdy', 'obvod katastrálního pracoviště', 'část obce s jedním společným LV'], e: 'Obec může mít více katastrálních území; v ČR je jich zhruba 13 tisíc.' },
          { t: 'c', q: 'Způsob využití pozemku v katastru…', a: 'upřesňuje druh pozemku (např. silnice, hřiště)', w: ['nahrazuje druh pozemku', 'udává cenu pozemku', 'určuje vlastníka'], e: 'Např. druh „ostatní plocha“, způsob využití „silnice“.' },
          { t: 'tf', q: 'Katastr slouží mimo jiné pro daňové a poplatkové účely a pro oceňování nemovitostí.', a: true, e: 'Katastr slouží ochraně práv, daňovým a poplatkovým účelům, ochraně ŽP, oceňování aj.' },
          { t: 'm', q: 'Spojte zkratku s významem', p: [['KO', 'Katastrální operát'], ['k. ú.', 'Katastrální území'], ['ÚOZI', 'Úředně oprávněný zeměměřický inženýr'], ['BPEJ', 'Bonitovaná půdně ekologická jednotka'], ['ZE', 'Zjednodušená evidence']] },
          { t: 'tf', q: 'Parcelní číslo stavební parcely se na listu vlastnictví odlišuje zkratkou „st.“.', a: true, e: 'Stavební a pozemkové parcely mají v k. ú. samostatné číselné řady.' },
        ],
      },
      {
        id: 'bea016l2', title: 'Staré míry a pozemkové knihy', icon: '📏',
        items: [
          { t: 'c', q: 'Vídeňský sáh měří přibližně…', a: '1,896 m', w: ['1,000 m', '2,540 m', '0,316 m'], e: '1 sáh = 6 stop = 72 palců ≈ 1,896 484 m.' },
          { t: 'c', q: 'Jedno katastrální jitro má…', a: '1 600 čtverečních sáhů', w: ['1 000 čtverečních sáhů', '3 600 čtverečních sáhů', '400 čtverečních sáhů'], e: '1 jitro = 1 600 čtv. sáhů ≈ 5 754,6 m² ≈ 0,58 ha.' },
          { t: 'n', q: 'Parcela má ve starém operátu výměru 250 čtverečních sáhů. Kolik je to m²? (1 čtv. sáh ≈ 3,5966 m²)', a: 899.15, tol: 0.1, dec: 2, unit: 'm²', e: '250 · 3,5966 = 899,15 m².' },
          { t: 'n', q: 'Převeďte 2 jitra 400 čtverečních sáhů na m². (1 jitro = 1 600 čtv. sáhů, 1 čtv. sáh ≈ 3,5966 m²)', a: 12947.8, tol: 1, dec: 1, unit: 'm²', e: '2 · 1 600 + 400 = 3 600 čtv. sáhů · 3,5966 ≈ 12 947,8 m².' },
          { t: 'c', q: 'Pozemkové knihy vedly…', a: 'soudy', w: ['katastrální úřady', 'obecní úřady', 'finanční úřady'], e: 'Knihovní soudy zapisovaly právní vztahy; katastr (daňový) vedly finanční orgány.' },
          { t: 'm', q: 'Spojte část pozemkové knihy s obsahem', p: [['List A (podstatný)', 'Soupis nemovitostí knihovního tělesa'], ['List B (vlastnický)', 'Vlastníci'], ['List C (listy břemen)', 'Zástavní práva a břemena'], ['Sbírka listin', 'Smlouvy a rozhodnutí']] },
          { t: 'c', q: 'Nemovitosti šlechty a církve (deskové statky) se zapisovaly do…', a: 'zemských desek', w: ['pozemkových knih okresních soudů', 'josefského katastru', 'evidence nemovitostí'], e: 'Zemské desky byly zvláštní veřejnou knihou pro deskové statky.' },
          { t: 'tf', q: 'Intabulační princip (vznik vlastnictví zápisem do knihy) byl od roku 1951 na dlouhou dobu zrušen.', a: true, e: 'Občanský zákoník z 1950 umožnil převod smlouvou bez zápisu; vkladový princip se vrátil s KN v roce 1993.' },
        ],
      },
      {
        id: 'bea016l3', title: 'Organizace zeměměřické služby', icon: '🏛️',
        items: [
          { t: 'c', q: 'Zeměměřické a katastrální orgány zřizuje zákon…', a: 'č. 359/1992 Sb.', w: ['č. 200/1994 Sb.', 'č. 256/2013 Sb.', 'č. 500/2004 Sb.'], e: 'Zákon o zeměměřických a katastrálních orgánech – ČÚZK, katastrální úřady, ZKI.' },
          { t: 'c', q: 'Kolik katastrálních úřadů je v ČR?', a: '14', w: ['7', '76', '206'], e: 'Jeden v každém kraji (včetně KÚ pro hl. m. Prahu); dělí se na katastrální pracoviště.' },
          { t: 'c', q: 'Zeměměřický a katastrální inspektorát (ZKI) vykonává hlavně…', a: 'dozor nad katastrem a ověřováním výsledků', w: ['zápisy vkladů do KN', 'tvorbu Základní mapy ČR', 'provoz sítě CZEPOS'], e: 'Sedm ZKI kontroluje katastrální úřady a ÚOZI, řeší přestupky a odvolání.' },
          { t: 'c', q: 'Zeměměřický úřad (ZÚ) spravuje mimo jiné…', a: 'ZABAGED, bodová pole a Základní mapu ČR', w: ['listy vlastnictví', 'sbírku listin', 'pozemkové úpravy'], e: 'ZÚ je zeměměřická organizace ČÚZK; provozuje i CZEPOS a Geoportál.' },
          { t: 'c', q: 'Rezortním výzkumným ústavem zeměměřictví je…', a: 'VÚGTK', w: ['ČHMÚ', 'VÚMOP', 'ČGS'], e: 'Výzkumný ústav geodetický, topografický a kartografický, v.v.i., sídlí ve Zdibech.' },
          { t: 'tf', q: 'O odvolání proti rozhodnutí katastrálního úřadu rozhoduje zeměměřický a katastrální inspektorát.', a: true, e: 'ZKI je odvolacím orgánem vůči katastrálním úřadům.' },
          { t: 'm', q: 'Spojte instituci s činností', p: [['ČÚZK', 'Ústřední orgán státní správy'], ['Katastrální úřad', 'Vedení katastru v kraji'], ['ZKI', 'Dozor a odvolání'], ['ZÚ', 'Státní mapy a bodová pole']] },
        ],
      },
      {
        id: 'bea016l4', title: 'SGI, SPI a údaje z KN', icon: '📑',
        items: [
          { t: 'c', q: 'Katastrální operát tvoří SGI, SPI, dokumentace výsledků šetření a měření, souhrnné přehledy o půdním fondu a…', a: 'sbírka listin', w: ['pozemková kniha', 'územní plán', 'daňové přiznání'], e: 'Sbírka listin obsahuje listiny, na jejichž základě byl proveden zápis.' },
          { t: 'c', q: 'Soubor geodetických informací (SGI) obsahuje…', a: 'katastrální mapu a souřadnice bodů', w: ['údaje o vlastnících', 'výpisy z LV', 'ceny nemovitostí'], e: 'SGI = geometrické a polohové určení nemovitostí; popisné údaje jsou v SPI.' },
          { t: 'c', q: 'Údaje z katastru se poskytují podle vyhlášky…', a: 'č. 358/2013 Sb.', w: ['č. 357/2013 Sb.', 'č. 31/1995 Sb.', 'č. 430/2006 Sb.'], e: 'Vyhláška o poskytování údajů z katastru nemovitostí.' },
          { t: 'c', q: 'Bezplatná webová aplikace ČÚZK s údaji o parcelách a LV je…', a: 'Nahlížení do katastru nemovitostí', w: ['Dálkový přístup (placený)', 'CZEPOS', 'Geoportál INSPIRE Download'], e: 'Nahlížení nenahrazuje ověřený výpis – je jen informativní.' },
          { t: 'c', q: 'Ověřený výpis z listu vlastnictví lze získat např.…', a: 'na pracovišti CzechPOINT', w: ['jen u soudu', 'jen u notáře v místě nemovitosti', 'na finančním úřadě'], e: 'Výpis lze získat i na katastrálním pracovišti či přes dálkový přístup.' },
          { t: 'tf', q: 'Výpis z listu vlastnictví může získat kdokoli bez prokazování právního zájmu.', a: true, e: 'Katastr je veřejný – nahlížet do něj a pořizovat výpisy může každý.' },
          { t: 'c', q: 'Informační systém katastru nemovitostí se zkratkou označuje…', a: 'ISKN', w: ['ISÚI', 'RÚIAN', 'DMVS'], e: 'ISKN vede SPI i SGI; RÚIAN je registr adres a územních prvků, který z katastru přebírá část údajů.' },
        ],
      },
      {
        id: 'bea016l5', title: 'Základy geometrického plánu', icon: '📄',
        items: [
          { t: 'c', q: 'Geometrický plán je…', a: 'technický podklad pro listinu, na jejímž základě se zapíše změna', w: ['listina, která sama mění vlastníka', 'rozhodnutí katastrálního úřadu', 'výpis z katastrální mapy'], e: 'GP sám právní vztahy nemění – je přílohou smlouvy či rozhodnutí.' },
          { t: 'c', q: 'Podklady pro vyhotovení GP (výřez mapy, VFK, souřadnice) zeměměřič získá např. přes…', a: 'dálkový přístup do KN (aplikace Podpora GP)', w: ['aplikaci CZEPOS', 'Nahlížení do KN bez přihlášení', 'datovou schránku obce'], e: 'V dálkovém přístupu (i přes webové služby WSDP) lze podklady objednat a GP předložit k potvrzení elektronicky.' },
          { t: 'c', q: 'Která část NENÍ součástí geometrického plánu?', a: 'kupní cena pozemku', w: ['popisové pole', 'grafické znázornění', 'výkaz dosavadního a nového stavu'], e: 'GP obsahuje popisové pole, grafickou část, výkazy, seznam souřadnic a ověření ÚOZI.' },
          { t: 'o', q: 'Seřaďte postup vyhotovení geometrického plánu', s: ['Získání podkladů z katastru', 'Zjišťování průběhu hranic a měření v terénu', 'Výpočty a vyhotovení GP', 'Ověření ÚOZI', 'Potvrzení katastrálním úřadem', 'Zápis změny do KN na základě listiny'], e: 'Potvrzený GP se připojí ke smlouvě nebo rozhodnutí, až pak může dojít k zápisu.' },
          { t: 'tf', q: 'Potvrzením geometrického plánu katastrální úřad potvrzuje, že plán lze použít pro zápis do katastru.', a: true, e: 'Potvrzení ale neznamená souhlas vlastníků ani právní posouzení listiny.' },
          { t: 'c', q: 'Parcely vzniklé rozdělením se v GP označují…', a: 'novými parcelními čísly, obvykle s lomením', w: ['písmeny řecké abecedy', 'čísly bodů ZPMZ', 'jen barvou'], e: 'Např. 125/1, 125/2; díly parcel (části přecházející do jiné parcely) se v GP označují malými písmeny.' },
          { t: 'c', q: 'SPI se aktualizuje hlavně na základě…', a: 'listin (smluv, rozhodnutí) a ohlášených změn', w: ['každoročního nového mapování', 'leteckého snímkování', 'výpisů z obchodního rejstříku'], e: 'Zapisuje se vkladem, záznamem nebo poznámkou podle druhu listiny.' },
        ],
      },
    ],
  },

  {
    id: 'bea022', title: 'Katastr nemovitostí 2', color: '#b91c1c', level: 'Bc.', course: 'BEA022', sem: '3. ročník · ZS',
    desc: 'Druhy geometrických plánů, zjednodušená evidence, zápisy do ISKN, opravy chyb, vytyčení hranic, znalectví a právní předpisy.',
    lessons: [
      {
        id: 'bea022l1', title: 'Druhy geometrických plánů', icon: '📐', gens: ['areaTriangle', 'areaQuad'],
        items: [
          { t: 'c', q: 'Pro zápis nové budovy do katastru se vyhotovuje GP pro…', a: 'vyznačení budovy', w: ['vymezení rozsahu věcného břemene', 'rozdělení pozemku', 'opravu geometrického určení'], e: 'GP pro vyznačení budovy (nebo změny jejího vnějšího obvodu).' },
          { t: 'c', q: 'Kabel má vést jen přes část cizího pozemku. Pro zápis služebnosti se vyhotoví GP pro…', a: 'vymezení rozsahu věcného břemene k části pozemku', w: ['rozdělení pozemku', 'změnu hranice pozemku', 'doplnění parcely ZE'], e: 'Pozemek se nedělí, jen se vymezí plocha, které se břemeno týká.' },
          { t: 'c', q: 'GP pro rozdělení pozemku se použije, když…', a: 'z jedné parcely vznikne více parcel', w: ['se mění vlastník celé parcely', 'se mění jen druh pozemku', 'se opravuje chyba ve jménu'], e: 'Každá nová parcela dostane parcelní číslo; výměry se vypočtou ze souřadnic.' },
          { t: 'c', q: 'Výměra nové parcely v GP se určuje…', a: 'výpočtem ze souřadnic lomových bodů', w: ['odhadem z ortofota', 'podle kupní smlouvy', 'odměřením z tištěné mapy'], e: 'Ze souřadnic S-JTSK se výměra počítá např. Gaussovým vzorcem a zaokrouhlí na celé m².' },
          { t: 'tf', q: 'Geometrický plán lze vyhotovit i pro zobrazení průběhu vytyčené nebo upřesněné hranice pozemků.', a: true, e: 'Takový GP zpřesní geometrické určení hranice v katastrální mapě.' },
          { t: 'm', q: 'Spojte záměr vlastníka s druhem GP', p: [['Prodej části zahrady', 'Rozdělení pozemku'], ['Kolaudovaný rodinný dům', 'Vyznačení budovy'], ['Přípojka plynu přes cizí pozemek', 'Vymezení rozsahu věcného břemene'], ['Parcela jen v mapě PK', 'Doplnění parcely ZE do KM']] },
          { t: 'c', q: 'Výměra parcely se v katastru eviduje s přesností na…', a: 'celé čtvereční metry', w: ['desetiny čtverečního metru', 'celé ary', 'celé hektary'], e: 'Výměra vypočtená ze souřadnic se zaokrouhluje na celé m².' },
        ],
      },
      {
        id: 'bea022l2', title: 'Zjednodušená evidence a identifikace', icon: '🔎',
        items: [
          { t: 'c', q: 'Pozemky vedené zjednodušeným způsobem (ZE) jsou pozemky…', a: 'nezobrazené v katastrální mapě, vedené podle dřívějších evidencí', w: ['s nejpřesnějšími souřadnicemi', 'bez vlastníka', 'určené jen k zastavění'], e: 'Parcely ZE vycházejí hlavně z map bývalého pozemkového katastru (PK) nebo evidence nemovitostí (EN).' },
          { t: 'c', q: 'Parcely ZE se na listu vlastnictví označují např. zdrojem…', a: 'PK nebo EN', w: ['DKM nebo KMD', 'ZPMZ nebo PPBP', 'BPEJ nebo ÚSES'], e: 'Zdroj říká, z jakého operátu se parcela odvozuje (pozemkový katastr, evidence nemovitostí, přídělový plán…).' },
          { t: 'c', q: 'Proč vznikla zjednodušená evidence?', a: 'hranice pozemků sloučených v JEP se v mapě nevedly', w: ['kvůli zrušení systému S-JTSK', 'kvůli ztrátě všech pozemkových knih', 'pro oddělenou evidenci státních lesů'], e: 'Scelené půdní bloky překryly původní vlastnické hranice; ty se udržují jen v ZE.' },
          { t: 'c', q: '„Identifikace parcel“ je výstup z katastru, který…', a: 'porovná parcely KN s parcelami dřívějších evidencí', w: ['určí vlastníka podle rodného čísla', 'vytyčí hranici v terénu', 'nahradí geometrický plán'], e: 'Používá se k listinám, v nichž jsou parcely označeny podle starého operátu.' },
          { t: 'tf', q: 'Parcelu zjednodušené evidence lze do katastrální mapy doplnit geometrickým plánem.', a: true, e: 'GP pro doplnění pozemku evidovaného zjednodušeným způsobem.' },
          { t: 'c', q: 'Při vyhotovení GP s parcelami ZE je nutné…', a: 'zobrazit a porovnat stav podle mapy dřívější evidence', w: ['ignorovat původní hranice', 'nejprve provést pozemkovou úpravu', 'vždy provést nové mapování'], e: 'Vyhotovitel vyhodnotí polohu parcel ZE podle převzaté mapy PK či EN.' },
          { t: 'c', q: 'Nejrozsáhlejší „odstranění“ parcel ZE v k. ú. přináší…', a: 'komplexní pozemková úprava', w: ['oprava chyby v KN', 'vklad kupní smlouvy', 'aktualizace ortofota'], e: 'KoPÚ vyřeší nové uspořádání pozemků a vznikne DKM bez ZE.' },
        ],
      },
      {
        id: 'bea022l3', title: 'Zápisy do ISKN', icon: '✍️',
        items: [
          { t: 'c', q: 'Vkladem se do katastru zapisuje…', a: 'vznik věcného práva ze smlouvy', w: ['dědictví podle usnesení soudu', 'zahájení exekuce', 'změna jména vlastníka'], e: 'Vklad je konstitutivní – u převodu smlouvou vzniká právo až zápisem.' },
          { t: 'c', q: 'Vklad práva působí…', a: 'zpětně k okamžiku podání návrhu', w: ['ke dni podpisu smlouvy', 'ke dni vyhlášení ve Sbírce', 'k 1. lednu následujícího roku'], e: 'Rozhodující je okamžik, kdy byl návrh na vklad doručen katastrálnímu úřadu.' },
          { t: 'c', q: 'Katastrální úřad smí vklad povolit nejdříve po uplynutí…', a: '20 dnů od odeslání vyrozumění vlastníkovi', w: ['3 dnů od podání návrhu', '60 dnů od podpisu smlouvy', '1 roku od zahájení řízení'], e: 'Ochranná lhůta chrání vlastníka před podvodným převodem.' },
          { t: 'c', q: 'Záznamem se zapisují práva…', a: 'vzniklá ze zákona nebo rozhodnutím úřadu či soudu', w: ['jen ze smluv mezi fyzickými osobami', 'jen k budovám', 'jen k lesním pozemkům'], e: 'Záznam je deklaratorní – právo již vzniklo, katastr ho jen eviduje (např. dědictví).' },
          { t: 'c', q: 'Poznámkou se zapisuje např.…', a: 'zahájení exekuce nebo spornost zápisu', w: ['převod vlastnictví', 'zřízení věcného břemene smlouvou', 'nová budova'], e: 'Poznámka má informativní význam – upozorňuje na skutečnost týkající se nemovitosti.' },
          { t: 'tf', q: '„Plomba“ na listu vlastnictví upozorňuje, že právní vztahy jsou dotčeny probíhající změnou.', a: true, e: 'Vyznačí se po zahájení řízení a zmizí po provedení zápisu.' },
          { t: 'm', q: 'Spojte událost se způsobem zápisu', p: [['Kupní smlouva', 'Vklad vlastnického práva'], ['Dědictví', 'Záznam podle usnesení soudu'], ['Zahájení exekuce', 'Poznámka'], ['Zástavní smlouva', 'Vklad zástavního práva'], ['Vyvlastnění', 'Záznam podle rozhodnutí úřadu']] },
        ],
      },
      {
        id: 'bea022l4', title: 'Opravy chyb, vytyčení, přístup', icon: '🚩', gens: ['stakeout'],
        items: [
          { t: 'c', q: 'Oprava chyby v katastru slouží k…', a: 'nápravě údajů vzniklých zřejmým omylem', w: ['změně vlastníka bez kupní smlouvy', 'zrušení zapsaného věcného břemene', 'změně druhu pozemku na žádost'], e: 'Opravuje se např. nepřesné zobrazení v mapě; opravou nelze měnit právní vztahy.' },
          { t: 'c', q: 'Řízení o opravě chyby se zahajuje…', a: 'na návrh nebo z moci úřední', w: ['jen na návrh soudu', 'jen na žádost obce', 'jen po pozemkové úpravě'], e: 'Upozornit na chybu může vlastník, úřad ji může opravit i sám.' },
          { t: 'c', q: 'Výsledkem vytyčení hranice pozemku je…', a: 'protokol o vytyčení hranice s vytyčovacím náčrtem', w: ['geometrický plán pro rozdělení', 'výpis z listu vlastnictví', 'rozhodnutí katastrálního úřadu'], e: 'Protokol ověřuje ÚOZI; vlastníci podpisem stvrzují, že byli s průběhem hranice seznámeni.' },
          { t: 'tf', q: 'Vytyčení hranice samo o sobě mění vlastnické právo k pozemku.', a: false, e: 'Vytyčení jen vyznačí v terénu hranici podle katastru; spor o vlastnictví rozhodne soud.' },
          { t: 'c', q: 'Zeměměřič smí při výkonu činnosti vstupovat na cizí pozemky podle…', a: 'zákona o zeměměřictví č. 200/1994 Sb.', w: ['katastrální vyhlášky č. 357/2013 Sb.', 'zákona o pozemkových úpravách', 'stavebního zákona o kolaudaci'], e: 'Musí přitom šetřit práva vlastníků a prokázat se; za způsobenou škodu odpovídá.' },
          { t: 'c', q: 'Vlastník pozemku bez přístupu k veřejné cestě se může domáhat…', a: 'povolení nezbytné cesty podle občanského zákoníku', w: ['opravy chyby v katastru', 'zrušení sousední parcely', 'zápisu poznámky spornosti'], e: 'Nezbytnou cestu (§ 1029 a násl. OZ) povoluje soud za úplatu.' },
          { t: 'c', q: 'Vytyčovací prvky pro polární vytyčení lomového bodu jsou…', a: 'vytyčovací úhel a vodorovná délka', w: ['výška a sklon terénu', 'parcelní číslo a výměra', 'kód kvality a číslo ZPMZ'], e: 'Počítají se ze souřadnic stanoviska, orientace a vytyčovaného bodu.' },
        ],
      },
      {
        id: 'bea022l5', title: 'Předpisy a znalectví', icon: '⚖️',
        items: [
          { t: 'm', q: 'Spojte předpis s obsahem', p: [['Zákon 256/2013 Sb.', 'Katastrální zákon'], ['Vyhláška 357/2013 Sb.', 'Katastrální vyhláška'], ['Zákon 200/1994 Sb.', 'Zákon o zeměměřictví'], ['Vyhláška 31/1995 Sb.', 'Prováděcí vyhláška k zeměměřictví'], ['Zákon 89/2012 Sb.', 'Občanský zákoník']] },
          { t: 'c', q: 'Činnost soudních znalců upravuje zákon…', a: 'č. 254/2019 Sb.', w: ['č. 200/1994 Sb.', 'č. 256/2013 Sb.', 'č. 139/2002 Sb.'], e: 'Zákon o znalcích, znaleckých kancelářích a znaleckých ústavech (účinný od 2021).' },
          { t: 'c', q: 'O zápisu znalce do seznamu znalců podle současné úpravy rozhoduje…', a: 'Ministerstvo spravedlnosti', w: ['ČÚZK', 'katastrální úřad', 'Komora geodetů'], e: 'Znalci jsou zapsáni v seznamu znalců vedeném ministerstvem.' },
          { t: 'c', q: 'Typickým úkolem znalce v oboru geodézie je…', a: 'posudek o průběhu hranice ve sporu', w: ['zápis vkladu do katastru', 'potvrzení geometrického plánu', 'vydání úředního oprávnění'], e: 'Soud využije znalecký posudek např. při sporu o hranici nebo o vydržení.' },
          { t: 'c', q: 'Kdo potvrzuje geometrický plán?', a: 'katastrální úřad', w: ['ÚOZI', 'soudní znalec', 'Státní pozemkový úřad'], e: 'ÚOZI plán ověřuje, katastrální úřad ho potvrzuje.' },
          { t: 'tf', q: 'Úřední oprávnění pro ověřování výsledků zeměměřických činností uděluje ČÚZK.', a: true, e: 'Podmínkou je VŠ vzdělání v oboru, praxe a úspěšná zkouška odborné způsobilosti.' },
          { t: 'c', q: 'Odpovědnost za správnost geometrického plánu nese…', a: 'vyhotovitel a ověřující ÚOZI', w: ['katastrální úřad potvrzením', 'kupující pozemku', 'obec podle územního plánu'], e: 'Potvrzení úřadem je kontrola náležitostí, odbornou správnost ručí ÚOZI.' },
        ],
      },
    ],
  },

  {
    id: 'bpu', title: 'Pozemkové úpravy', color: '#15803d', level: 'Bc.', course: '—', sem: '3. ročník · LS',
    desc: 'Účel a formy pozemkových úprav podle zákona č. 139/2002 Sb., nároky a BPEJ, plán společných zařízení, ÚSES, rozhodnutí a zápis do KN.',
    lessons: [
      {
        id: 'bpul1', title: 'Účel a formy PÚ', icon: '🌾',
        items: [
          { t: 'c', q: 'Pozemkové úpravy upravuje zákon…', a: 'č. 139/2002 Sb.', w: ['č. 256/2013 Sb.', 'č. 200/1994 Sb.', 'č. 334/1992 Sb.'], e: 'Zákon o pozemkových úpravách a pozemkových úřadech.' },
          { t: 'c', q: 'Hlavním účelem pozemkových úprav je…', a: 'prostorově a funkčně uspořádat pozemky, zpřístupnit je a scelit', w: ['vyměřit daň z nemovitostí', 'zapsat vklady do katastru', 'vytvořit Základní mapu ČR'], e: 'Zároveň zajišťují podmínky pro ochranu půdy, vodní hospodářství a ekologickou stabilitu.' },
          { t: 'c', q: 'Pozemkové úpravy řídí…', a: 'Státní pozemkový úřad (krajské pozemkové úřady)', w: ['katastrální úřady', 'obecní úřady', 'Ministerstvo pro místní rozvoj'], e: 'SPÚ vznikl 1. 1. 2013 (zákon 503/2012 Sb.); řízení vede příslušný krajský pozemkový úřad.' },
          { t: 'c', q: 'Jednoduchá pozemková úprava (JPÚ) se provádí, když…', a: 'se řeší jen některé problémy nebo část území', w: ['se řeší celé k. ú. se všemi zařízeními', 'jde o obnovu KO novým mapováním', 'vlastník chce prodat pozemek'], e: 'JPÚ řeší např. jen některé hospodářské potřeby, protierozní opatření nebo nedokončené přídělové řízení.' },
          { t: 'tf', q: 'Výsledky pozemkových úprav slouží k obnově katastrálního operátu a jako podklad pro územní plánování.', a: true, e: 'Obnova KO na podkladě výsledků PÚ vede k DKM.' },
          { t: 'c', q: 'Scelování pozemků znamená…', a: 'spojení roztříštěných pozemků vlastníka do větších celků', w: ['rozdělení pozemku na menší', 'převod pozemků na stát', 'změnu druhu pozemku na les'], e: 'Scelovací řízení se v našich zemích prováděla už od konce 19. století.' },
          { t: 'm', q: 'Spojte pojem s významem', p: [['KoPÚ', 'Komplexní pozemková úprava'], ['JPÚ', 'Jednoduchá pozemková úprava'], ['SPÚ', 'Státní pozemkový úřad'], ['PSZ', 'Plán společných zařízení']] },
        ],
      },
      {
        id: 'bpul2', title: 'Průběh KoPÚ', icon: '🧭',
        items: [
          { t: 'o', q: 'Seřaďte hlavní etapy komplexní pozemkové úpravy', s: ['Zahájení řízení', 'Úvodní jednání a volba sboru zástupců', 'Zjišťování hranic obvodu a soupis nároků', 'Plán společných zařízení', 'Návrh nového uspořádání pozemků', 'Rozhodnutí a zápis do KN'], e: 'Nejdřív nároky a společná zařízení, až pak se rozvrhují nové pozemky.' },
          { t: 'c', q: 'Sbor zástupců v KoPÚ…', a: 'zastupuje vlastníky a spolupracuje na návrhu', w: ['rozhoduje o odvolání', 'zapisuje výsledky do KN', 'vytyčuje nové pozemky'], e: 'Volí se na úvodním jednání; schvaluje např. plán společných zařízení.' },
          { t: 'c', q: 'V přípravných pracích se mimo jiné…', a: 'zaměřuje polohopis a zjišťují hranice obvodu PÚ', w: ['vydává rozhodnutí o výměně práv', 'zapisují vklady do KN', 'staví polní cesty'], e: 'Zaměření aktuálního stavu je podkladem pro návrh; hranice obvodu se šetří s vlastníky.' },
          { t: 'c', q: 'Pozemkový úřad schválí návrh, souhlasí-li vlastníci alespoň…', a: '60 % výměry pozemků řešených v PÚ', w: ['25 % výměry', '100 % výměry', '50 % počtu obcí'], e: 'Vlastníci, kteří nesouhlasí, mají nárok na dodržení kritérií přiměřenosti.' },
          { t: 'c', q: 'Obvod komplexní pozemkové úpravy tvoří zpravidla…', a: 'celé katastrální území', w: ['jedna parcela', 'území celého kraje', 'jen zastavěné území obce'], e: 'Obvod může zahrnout i části sousedních k. ú.; zastavěné území se řeší jen výjimečně.' },
          { t: 'tf', q: 'Geodetické práce pro pozemkové úpravy musí ověřit úředně oprávněný zeměměřický inženýr.', a: true, e: 'Výsledky přebírá katastr, proto musí mít stejné náležitosti jako jiné podklady pro KN.' },
          { t: 'c', q: 'Pozemky pro společná zařízení se přednostně vyčlení z…', a: 'půdy ve vlastnictví státu a obce', w: ['pozemků největšího vlastníka', 'lesních pozemků soukromníků', 'zastavěných pozemků'], e: 'Nestačí-li, přispějí ostatní vlastníci poměrným dílem.' },
        ],
      },
      {
        id: 'bpul3', title: 'Nároky a BPEJ', icon: '💰',
        items: [
          { t: 'c', q: 'BPEJ znamená…', a: 'bonitovaná půdně ekologická jednotka', w: ['bilance půdy a ekologických jevů', 'bodové pole ekologické jednotky', 'bonus pro evidenci jednotek'], e: 'BPEJ vyjadřuje produkční schopnost zemědělské půdy a slouží k jejímu ocenění.' },
          { t: 'c', q: 'Kód BPEJ má…', a: '5 číslic', w: ['3 číslice', '8 číslic', '2 písmena a číslo'], e: '1. klimatický region, 2.–3. hlavní půdní jednotka, 4. sklonitost a expozice, 5. skeletovitost a hloubka.' },
          { t: 'm', q: 'Spojte část kódu BPEJ s významem', p: [['1. číslice', 'Klimatický region'], ['2. a 3. číslice', 'Hlavní půdní jednotka'], ['4. číslice', 'Sklonitost a expozice'], ['5. číslice', 'Skeletovitost a hloubka půdy']] },
          { t: 'c', q: 'Nárokový list vlastníka obsahuje…', a: 'jeho původní pozemky s výměrou, cenou a vzdáleností', w: ['návrh nových cest', 'výpis ze sbírky listin', 'daňové přiznání'], e: 'Soupis nároků je výchozím stavem, ke kterému se porovnává nový návrh.' },
          { t: 'c', q: 'Kritéria přiměřenosti nových pozemků podle zákona 139/2002 Sb. jsou cena, výměra, vzdálenost a…', a: 'druh pozemku', w: ['barva půdy', 'počet sousedů', 'datum koupě'], e: 'Vlastník má dostat pozemky přiměřené původním.' },
          { t: 'n', q: 'Vlastník má nárok o výměře 5,00 ha. Jaká je nejmenší výměra nových pozemků, která ještě splní kritérium přiměřenosti výměry (±10 %)?', a: 4.5, tol: 0.001, dec: 2, unit: 'ha', e: '5,00 · (1 − 0,10) = 4,50 ha; s menší výměrou musí vlastník souhlasit.' },
          { t: 'c', q: 'Přípustná odchylka ceny nových pozemků od nároku je bez souhlasu vlastníka…', a: '±4 %', w: ['±10 %', '±20 %', '±50 %'], e: 'Výměra ±10 %, vzdálenost ±20 %, cena ±4 %; větší odchylky jen se souhlasem vlastníka.' },
          { t: 'tf', q: 'Oceňování zemědělských pozemků v PÚ vychází z úředních cen přiřazených jednotlivým BPEJ.', a: true, e: 'Cena pozemku je dána výměrou jednotlivých BPEJ na něm a jejich cenou za m².' },
        ],
      },
      {
        id: 'bpul4', title: 'Společná zařízení a ÚSES', icon: '🌳',
        items: [
          { t: 'c', q: 'Mezi opatření ke zpřístupnění pozemků patří…', a: 'polní cesty, mostky a propustky', w: ['meze a průlehy', 'biocentra a biokoridory', 'retenční nádrže'], e: 'Každý nový pozemek musí mít přístup – proto je cestní síť základem plánu.' },
          { t: 'c', q: 'Polní cesty se navrhují podle normy…', a: 'ČSN 73 6109', w: ['ČSN 01 3410', 'ČSN 73 0415', 'ČSN EN ISO 17123'], e: 'Projektování polních cest; rozlišuje hlavní, vedlejší a doplňkové cesty.' },
          { t: 'c', q: 'Protierozním opatřením je např.…', a: 'průleh nebo zatravněný pás', w: ['polní cesta se zpevněním', 'vodovodní přípojka', 'nový mezník'], e: 'Průlehy, meze, zasakovací pásy a větrolamy snižují vodní a větrnou erozi.' },
          { t: 'c', q: 'Vodohospodářským opatřením v plánu společných zařízení je např.…', a: 'suchá nádrž (poldr)', w: ['biokoridor', 'polní cesta', 'větrolam'], e: 'Poldry, nádrže a revitalizace toků chrání před povodněmi a zadržují vodu v krajině.' },
          { t: 'm', q: 'Spojte prvek ÚSES s popisem', p: [['Biocentrum', 'Plocha umožňující trvalou existenci společenstev'], ['Biokoridor', 'Propojení biocenter pro migraci'], ['Interakční prvek', 'Drobný prvek zprostředkující vliv na okolní krajinu']] },
          { t: 'c', q: 'ÚSES se vymezuje na úrovních…', a: 'lokální, regionální a nadregionální', w: ['obecní, krajské a státní', 'první, druhé a třetí třídy', 'polní, lesní a vodní'], e: 'Lokální ÚSES se v PÚ upřesňuje a realizuje.' },
          { t: 'tf', q: 'Plán společných zařízení se zpracovává až po schválení nového uspořádání pozemků.', a: false, e: 'PSZ se navrhuje dřív – teprve kolem cest a opatření se rozvrhují nové pozemky.' },
          { t: 'c', q: 'Plán společných zařízení schvaluje…', a: 'sbor zástupců a zastupitelstvo obce', w: ['jen katastrální úřad', 'soud', 'Zeměměřický úřad'], e: 'Zastupitelstvo obce PSZ schvaluje, protože společná zařízení zpravidla přejdou do vlastnictví obce.' },
        ],
      },
      {
        id: 'bpul5', title: 'Rozhodnutí, vytyčení, zápis', icon: '🏁',
        items: [
          { t: 'c', q: 'Pozemkový úřad v KoPÚ vydává nejprve rozhodnutí o schválení návrhu a poté rozhodnutí o…', a: 'výměně nebo přechodu vlastnických práv', w: ['povolení vkladu', 'potvrzení geometrického plánu', 'zrušení katastrálního území'], e: 'Druhé rozhodnutí je listinou pro zápis vlastnictví k novým pozemkům.' },
          { t: 'c', q: 'Po skončení KoPÚ se v katastru vede mapa…', a: 'DKM vzniklá obnovou KO na podkladě PÚ', w: ['KMD převzatá ze sáhové mapy', 'mapa zjednodušené evidence', 'jen ortofoto'], e: 'Nové pozemky mají souřadnice v S-JTSK s kódem kvality 3.' },
          { t: 'c', q: 'Vytyčení nových pozemků po KoPÚ se provádí…', a: 'podle souřadnic schváleného návrhu', w: ['podle původní mapy PK', 'odhadem na místě', 'podle ortofota'], e: 'Lomové body se v terénu vyznačí a vlastníci se s hranicemi seznámí.' },
          { t: 'o', q: 'Seřaďte závěrečné kroky KoPÚ', s: ['Souhlas vlastníků s návrhem', 'Rozhodnutí o schválení návrhu', 'Rozhodnutí o výměně vlastnických práv', 'Zápis do KN a obnova KO', 'Vytyčení a realizace společných zařízení'], e: 'Realizace (stavba cest, výsadba) navazuje na zápis nových pozemků.' },
          { t: 'tf', q: 'Nový stav vlastnických vztahů se do katastru zapisuje na základě pravomocného rozhodnutí pozemkového úřadu.', a: true, e: 'Jde o zápis záznamem – práva vznikla rozhodnutím úřadu.' },
          { t: 'c', q: 'Bilancování v PÚ znamená…', a: 'porovnání nároků se stavem po návrhu', w: ['výpočet daně z pozemků', 'vyrovnání nivelační sítě', 'sčítání vlastníků v obci'], e: 'Kontroluje se výměra, cena a vzdálenost každého vlastníka před a po úpravě.' },
          { t: 'c', q: 'Nesouhlasí-li vlastník s rozhodnutím pozemkového úřadu, může…', a: 'podat odvolání k ústředí SPÚ', w: ['požádat o opravu chyby v KN', 'zapsat poznámku spornosti sám', 'zrušit rozhodnutí vytyčením'], e: 'O odvolání rozhoduje ústředí Státního pozemkového úřadu.' },
        ],
      },
    ],
  },
];
