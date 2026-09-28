// Kapitoly 7–10: GNSS a moderní metody, Chyby a vyrovnání, Katastr, Mapování a inženýrská geodézie.

export default [
  {
    id: 'u7', title: 'GNSS a moderní metody', color: '#0891b2',
    desc: 'Princip GNSS, zdroje chyb a DOP, RTK a sítě, laserové skenování, drony a GIS.',
    lessons: [
      {
        id: 'u7l1', title: 'Princip GNSS', icon: '🛰️',
        items: [
          { t: 'c', q: 'Přijímač GNSS určuje polohu z…', a: 'měřených vzdáleností k družicím', w: ['úhlů k družicím', 'rádiového azimutu', 'výšky družic'], e: 'Tzv. pseudovzdálenosti.' },
          { t: 'c', q: 'Proč je potřeba čtvrtá družice?', a: 'kvůli neznámé chybě hodin přijímače', w: ['kvůli výšce', 'kvůli počasí', 'kvůli ionosféře'], e: 'Hodiny přijímače nejsou tak přesné jako atomové hodiny družic.' },
          { t: 'c', q: 'Kódová měření dosahují přesnosti řádově…', a: 'metrů', w: ['milimetrů', 'kilometrů', 'mikrometrů'], e: 'Běžná navigace v telefonu.' },
          { t: 'c', q: 'Fázová měření umožňují přesnost…', a: 'centimetrovou až milimetrovou', w: ['metrovou', 'kilometrovou', 'žádnou'], e: 'Nutné je vyřešit ambiguity (počet celých vln).' },
          { t: 'tf', q: 'GNSS dává přímo elipsoidickou výšku, ne nadmořskou.', a: true, e: 'Nadmořskou výšku dostaneme až pomocí modelu kvazigeoidu.' },
        ],
      },
      {
        id: 'u7l2', title: 'Chyby a DOP', icon: '📶',
        items: [
          { t: 'c', q: 'PDOP vyjadřuje…', a: 'vliv geometrie družic na přesnost polohy', w: ['počet družic', 'stáří korekcí', 'sílu signálu'], e: 'Position Dilution Of Precision.' },
          { t: 'c', q: 'Menší hodnota PDOP znamená…', a: 'lepší geometrii a přesnost', w: ['horší přesnost', 'méně družic', 'slabší signál'], e: 'Družice jsou rozprostřené po obloze.' },
          { t: 'c', q: 'Multipath je chyba způsobená…', a: 'odrazy signálu od okolních ploch', w: ['ionosférou', 'hodinami družice', 'chybou antény'], e: 'Typicky u budov, aut a vodních ploch.' },
          { t: 'c', q: 'Ionosférické zpoždění se omezuje…', a: 'měřením na více frekvencích', w: ['vyšším stativem', 'kratší výtyčkou', 'zapnutím kompasu'], e: 'Zpoždění závisí na frekvenci, proto ho lze vypočítat.' },
          { t: 'c', q: 'Elevační maska (např. 10–15°) vyloučí…', a: 'družice nízko nad obzorem', w: ['družice v zenitu', 'všechny družice GLONASS', 'korekce'], e: 'Nízké signály procházejí dlouhou cestou atmosférou.' },
          { t: 'tf', q: 'Měření pod stromy a u budov zhoršuje přesnost GNSS.', a: true, e: 'Zákryt a odrazy signálu.' },
        ],
      },
      {
        id: 'u7l3', title: 'RTK a sítě', icon: '📲',
        items: [
          { t: 'c', q: 'RTK znamená…', a: 'měření v reálném čase s korekcemi z referenční stanice', w: ['měření z jedné družice', 'zpracování po týdnu', 'měření úhlů'], e: 'Real Time Kinematic.' },
          { t: 'c', q: 'Stav „Fixed“ znamená…', a: 'vyřešené ambiguity – centimetrová přesnost', w: ['žádný signál', 'jen kódové řešení', 'vadná anténa'], e: 'Teprve s Fixed se měří geodeticky.' },
          { t: 'c', q: 'Stav „Float“ znamená…', a: 'nevyřešené ambiguity – decimetrová přesnost', w: ['nejvyšší přesnost', 'vypnutý přijímač', 'měření bez družic'], e: 'Je potřeba vyčkat na Fixed.' },
          { t: 'c', q: 'Korekce se do roveru nejčastěji přenášejí…', a: 'přes internet protokolem NTRIP', w: ['Bluetooth z družice', 'kabelem ze stanice', 'SMS'], e: 'Mobilní data v kontroléru nebo přijímači.' },
          { t: 'c', q: 'Virtuální referenční stanice (VRS) …', a: 'vytvoří korekce, jako by stanice stála u roveru', w: ['nahradí družice', 'měří úhly', 'odstraní multipath'], e: 'Síť interpoluje korekce z okolních stanic.' },
          { t: 'tf', q: 'Statická metoda s dlouhou observací je přesnější než rychlé RTK.', a: true, e: 'Používá se pro přesné body a sítě.' },
        ],
      },
      {
        id: 'u7l4', title: 'Skenování a drony', icon: '🚁',
        items: [
          { t: 'c', q: 'Laserový skener vytváří…', a: 'mračno bodů', w: ['vrstevnice přímo', 'katastrální mapu', 'nivelační pořad'], e: 'Miliony bodů se souřadnicemi, často i s barvou.' },
          { t: 'c', q: 'Letecké laserové skenování se označuje…', a: 'ALS (LiDAR)', w: ['GNSS', 'EDM', 'DOP'], e: 'Airborne Laser Scanning.' },
          { t: 'c', q: 'Fotogrammetrie z dronu typicky vytváří…', a: 'ortofoto a 3D model terénu', w: ['nivelační zápisník', 'geometrický plán', 'polygonový pořad'], e: 'Ze snímků s velkým překrytem.' },
          { t: 'c', q: 'Vlícovací body (GCP) slouží k…', a: 'georeferencování snímků', w: ['nabíjení dronu', 'měření tíhy', 'zaostření kamery'], e: 'Mají souřadnice změřené geodeticky.' },
          { t: 'tf', q: 'Digitální model reliéfu DMR 5G vznikl z leteckého laserového skenování.', a: true, e: 'Pokrývá celé území ČR.' },
        ],
      },
      {
        id: 'u7l5', title: 'GIS a data', icon: '💾',
        items: [
          { t: 'c', q: 'GIS znamená…', a: 'geografický informační systém', w: ['globální informační síť', 'geodetický inženýrský standard', 'GNSS integrační služba'], e: 'Spojuje prostorová data s atributy.' },
          { t: 'c', q: 'Vektorová data reprezentují objekty jako…', a: 'body, linie a polygony', w: ['pixely', 'pouze text', 'zvuk'], e: 'Každý objekt může mít atributy.' },
          { t: 'c', q: 'Rastrová data tvoří…', a: 'mřížka buněk (pixelů)', w: ['uzly a hrany', 'body s atributy', 'vrstevnice'], e: 'Např. ortofoto nebo DMR v mřížce.' },
          { t: 'c', q: 'Výměnný formát katastru (VFK) slouží k…', a: 'předávání dat katastru', w: ['měření GNSS', 'ručnímu kreslení map', 'nivelaci'], e: 'Obsahuje grafická i popisná data.' },
          { t: 'm', q: 'Spojte formát s obsahem', p: [['DXF', 'CAD výkresy'], ['SHP', 'Vrstvy GIS'], ['VFK', 'Data katastru'], ['LAS', 'Mračna bodů']] },
        ],
      },
    ],
  },

  {
    id: 'u8', title: 'Chyby měření a vyrovnání', color: '#d6457a',
    desc: 'Druhy chyb, střední chyba a průměr, zákon hromadění, metoda nejmenších čtverců, kódy kvality.',
    lessons: [
      {
        id: 'u8l1', title: 'Druhy chyb', icon: '⚠️',
        items: [
          { t: 'm', q: 'Spojte druh chyby s popisem', p: [['Hrubá chyba', 'Omyl, přehlédnutí'], ['Systematická chyba', 'Stálé znaménko, lze opravit'], ['Nahodilá chyba', 'Náhodná, nelze vyloučit'], ['Oprava', 'Opačné znaménko než chyba']] },
          { t: 'c', q: 'Chyba z nesprávné délky pásma je chyba…', a: 'systematická', w: ['hrubá', 'nahodilá', 'žádná'], e: 'Působí pořád stejně – lze ji opravit kalibrací.' },
          { t: 'c', q: 'Zápis 1,583 místo 1,853 je chyba…', a: 'hrubá', w: ['nahodilá', 'systematická', 'přístrojová'], e: 'Odhalí se kontrolním měřením.' },
          { t: 'c', q: 'Nahodilé chyby mají rozdělení blízké…', a: 'normálnímu (Gaussovu)', w: ['rovnoměrnému', 'exponenciálnímu', 'žádnému'], e: 'Malé chyby jsou častější než velké.' },
          { t: 'tf', q: 'Nahodilé chyby lze pečlivou prací úplně vyloučit.', a: false, e: 'Lze je jen zmenšit, např. opakováním měření.' },
        ],
      },
      {
        id: 'u8l2', title: 'Střední chyba a průměr', icon: '📊', gens: ['meanValue', 'meanError'],
        items: [
          { t: 'c', q: 'Nejpravděpodobnější hodnota z opakovaných měření je…', a: 'aritmetický průměr', w: ['největší hodnota', 'první měření', 'poslední měření'], e: 'Za předpokladu stejné přesnosti měření.' },
          { t: 'c', q: 'Střední chyba průměru z n měření: m_x̄ = …', a: 'm / √n', w: ['m · n', 'm / n', 'm · √n'], e: 'Přesnost roste s odmocninou z počtu měření.' },
          { t: 'c', q: 'Kolikrát je potřeba měřit, aby se střední chyba průměru zmenšila na polovinu?', a: '4×', w: ['2×', '8×', '16×'], e: '√4 = 2.' },
          { t: 'c', q: 'Mezní chyba se obvykle bere jako…', a: '2 až 3násobek střední chyby', w: ['polovina střední chyby', 'stejná jako střední chyba', '10násobek'], e: 'Překročení je velmi nepravděpodobné.' },
          { t: 'tf', q: 'Součet oprav od aritmetického průměru je roven nule.', a: true, e: 'Kontrola výpočtu průměru.' },
        ],
      },
      {
        id: 'u8l3', title: 'Zákon hromadění', icon: '➕', gens: ['errorPropagation'],
        items: [
          { t: 'c', q: 'Pro součet dvou délek: m_s = …', a: '√(m₁² + m₂²)', w: ['m₁ + m₂', 'm₁ · m₂', '(m₁ + m₂) / 2'], e: 'Nezávislé chyby se sčítají kvadraticky.' },
          { t: 'c', q: 'Pro násobek k · x: m = …', a: 'k · m_x', w: ['m_x / k', 'k² · m_x', '√k · m_x'], e: 'Konstanta se přenese lineárně.' },
          { t: 'c', q: 'Střední chyba součtu n stejně přesných veličin je…', a: 'm · √n', w: ['m · n', 'm / √n', 'm'], e: 'Např. délka složená z n kladení pásma.' },
          { t: 'tf', q: 'Zákon hromadění středních chyb předpokládá nezávislá měření.', a: true, e: 'Jinak je nutné uvažovat kovariance.' },
        ],
      },
      {
        id: 'u8l4', title: 'Vyrovnání MNČ', icon: '🧩',
        items: [
          { t: 'c', q: 'Metoda nejmenších čtverců minimalizuje…', a: 'součet čtverců (vážených) oprav', w: ['součet oprav', 'největší opravu', 'počet měření'], e: '[pvv] = minimum.' },
          { t: 'c', q: 'Nadbytečná měření jsou…', a: 'měření navíc nad nutný počet', w: ['chybná měření', 'měření ve II. poloze', 'zbytečné zápisy'], e: 'Umožňují kontrolu a vyrovnání.' },
          { t: 'c', q: 'Váha měření je nepřímo úměrná…', a: 'čtverci jeho střední chyby', w: ['délce stativu', 'počtu měření', 'času měření'], e: 'p = c / m².' },
          { t: 'c', q: 'Počet nadbytečných měření: r = …', a: 'n − k (měření − neznámé)', w: ['n + k', 'k − n', 'n · k'], e: 'Také stupně volnosti.' },
          { t: 'tf', q: 'Bez nadbytečných měření nelze odhalit hrubou chybu.', a: true, e: 'Chybí kontrola.' },
        ],
      },
      {
        id: 'u8l5', title: 'Kódy kvality', icon: '🏷️',
        items: [
          { t: 'c', q: 'Základní střední souřadnicová chyba pro kód kvality 3 je…', a: '0,14 m', w: ['0,02 m', '0,50 m', '1,00 m'], e: 'Kód 3 = body určené přesným geodetickým měřením.' },
          { t: 'c', q: 'Kód kvality bodu v katastru vyjadřuje…', a: 'přesnost jeho souřadnic', w: ['vlastníka', 'výměru parcely', 'druh pozemku'], e: 'Uvádí se u každého bodu.' },
          { t: 'c', q: 'Souřadnicová střední chyba: m_xy = …', a: '√((m_x² + m_y²) / 2)', w: ['m_x + m_y', 'm_x · m_y', '√(m_x² + m_y²)'], e: 'Průměr kvadrátů v obou osách.' },
          { t: 'tf', q: 'Mezní odchylka je hranice, jejíž překročení znamená, že měření nevyhovuje.', a: true, e: 'Předepisují ji normy a vyhlášky.' },
          { t: 'tf', q: 'Bod s kódem kvality 3 je přesnější než bod s kódem kvality 8.', a: true, e: 'Kód 3 = přesné měření (0,14 m), kód 8 = digitalizace mapy 1 : 2 880 (2,83 m).' },
          { t: 'c', q: 'Mezní odchylka se obvykle stanoví jako…', a: 'dvojnásobek střední chyby', w: ['polovina střední chyby', 'střední chyba na druhou', 'desetinásobek střední chyby'], e: 'Mezní chyba ≈ 2 m (u přísnějších případů až 3 m).' },
        ],
      },
    ],
  },

  {
    id: 'u9', title: 'Katastr nemovitostí', color: '#c99a06',
    desc: 'Co je katastr, jeho obsah, geometrický plán, vytyčení hranic a právní předpisy.',
    lessons: [
      {
        id: 'u9l1', title: 'Co je katastr', icon: '🏠',
        items: [
          { t: 'c', q: 'Katastr nemovitostí je…', a: 'soubor údajů o nemovitostech (soupis, popis, geometrické určení)', w: ['mapa silnic', 'daňové přiznání', 'seznam geodetů'], e: 'Zahrnuje i práva k nemovitostem.' },
          { t: 'c', q: 'Katastr v ČR spravují…', a: 'katastrální úřady (řízené ČÚZK)', w: ['obce', 'finanční úřady', 'soudy'], e: 'Každý kraj má svůj katastrální úřad s pracovišti.' },
          { t: 'c', q: 'Základní územní jednotkou katastru je…', a: 'katastrální území', w: ['kraj', 'okres', 'ulice'], e: 'Obec má jedno nebo více katastrálních území.' },
          { t: 'c', q: 'Katastrální zákon je…', a: 'č. 256/2013 Sb.', w: ['č. 200/1994 Sb.', 'č. 183/2006 Sb.', 'č. 89/2012 Sb.'], e: '200/1994 je zákon o zeměměřictví, 89/2012 občanský zákoník.' },
          { t: 'tf', q: 'Katastr slouží mimo jiné k ochraně práv k nemovitostem.', a: true, e: 'Zapisují se vlastnická a jiná věcná práva.' },
        ],
      },
      {
        id: 'u9l2', title: 'Obsah katastru', icon: '📚',
        items: [
          { t: 'c', q: 'SGI znamená…', a: 'soubor geodetických informací', w: ['soubor grafických ikon', 'systém GNSS', 'správa geodetických institucí'], e: 'Obsahuje katastrální mapu.' },
          { t: 'c', q: 'SPI znamená…', a: 'soubor popisných informací', w: ['systém polohových informací', 'správní poplatkový index', 'soubor plánů sítí'], e: 'Údaje o parcelách, stavbách, vlastnících.' },
          { t: 'c', q: 'List vlastnictví (LV) obsahuje…', a: 'vlastníky a jejich nemovitosti', w: ['souřadnice všech bodů', 'mapu obce', 'výsledky nivelace'], e: 'Veřejně dostupný výpis z katastru.' },
          { t: 'c', q: 'Katastrální mapa digitalizovaná (KMD) vznikla…', a: 'převodem analogové mapy do digitální podoby', w: ['novým GNSS měřením všech bodů', 'z laserového skenování', 'ze satelitních snímků'], e: 'Proto mají její body často horší kód kvality.' },
          { t: 'tf', q: 'Parcela je pozemek geometricky a polohově určený a zobrazený v katastrální mapě.', a: true, e: 'Má parcelní číslo.' },
          { t: 'm', q: 'Spojte zkratku s významem', p: [['LV', 'Vlastníci a nemovitosti'], ['SGI', 'Katastrální mapa'], ['SPI', 'Popisné údaje'], ['KMD', 'Digitalizovaná mapa']] },
        ],
      },
      {
        id: 'u9l3', title: 'Geometrický plán', icon: '📄',
        items: [
          { t: 'c', q: 'Geometrický plán se vyhotovuje např. pro…', a: 'rozdělení pozemku', w: ['výpočet daně', 'stavbu plotu po hranici', 'kalibraci přístroje'], e: 'Také pro vyznačení budovy, věcného břemene aj.' },
          { t: 'c', q: 'Geometrický plán ověřuje…', a: 'úředně oprávněný zeměměřický inženýr', w: ['stavební úřad', 'notář', 'kterýkoli geodet'], e: 'Ověřením potvrzuje správnost a přesnost.' },
          { t: 'c', q: 'Geometrický plán potvrzuje…', a: 'katastrální úřad', w: ['obec', 'soud', 'notář'], e: 'Potvrzení znamená, že plán lze použít k zápisu.' },
          { t: 'c', q: 'Záznam podrobného měření změn (ZPMZ) obsahuje…', a: 'měřické náčrty, zápisníky a výpočty', w: ['jen výslednou mapu', 'vlastnické údaje', 'fotografie stavby'], e: 'Dokumentuje, jak se změna měřila.' },
          { t: 'tf', q: 'Geometrický plán obsahuje grafické znázornění a výkaz výměr.', a: true, e: 'Porovnává dosavadní a nový stav.' },
        ],
      },
      {
        id: 'u9l4', title: 'Vytyčení hranic', icon: '🚩', gens: ['stakeout'],
        items: [
          { t: 'c', q: 'Vytyčení hranice pozemku znamená…', a: 'vyznačení lomových bodů hranice v terénu', w: ['nakreslení nové mapy', 'změnu vlastníka', 'výpočet výměry'], e: 'Podle údajů katastru.' },
          { t: 'c', q: 'Lomové body hranic se označují např.…', a: 'kovovým znakem nebo mezníkem', w: ['barvou na trávě', 'papírovým kolíkem', 'jen v mapě'], e: 'Trvalé označení v terénu.' },
          { t: 'c', q: 'O vytyčení hranice se vyhotovuje…', a: 'protokol o vytyčení hranice', w: ['geometrický plán', 'kupní smlouva', 'list vlastnictví'], e: 'Podepisují ho i účastníci.' },
          { t: 'tf', q: 'K vytyčení se zvou vlastníci sousedních pozemků.', a: true, e: 'Mohou se vyjádřit k průběhu hranice.' },
          { t: 'c', q: 'Vytyčovací prvky se počítají ze…', a: 'souřadnic lomových bodů v S-JTSK', w: ['odhadu', 'fotografie', 'polohy z telefonu'], e: 'Z nich se vypočte směr a délka pro polární vytyčení.' },
        ],
      },
      {
        id: 'u9l5', title: 'Předpisy a ÚOZI', icon: '⚖️',
        items: [
          { t: 'c', q: 'Zákon o zeměměřictví je…', a: 'č. 200/1994 Sb.', w: ['č. 256/2013 Sb.', 'č. 344/1992 Sb.', 'č. 183/2006 Sb.'], e: '344/1992 byl dřívější katastrální zákon.' },
          { t: 'c', q: 'Katastrální vyhláška je…', a: 'č. 357/2013 Sb.', w: ['č. 31/1995 Sb.', 'č. 200/1994 Sb.', 'č. 26/2007 Sb.'], e: '31/1995 je vyhláška k zákonu o zeměměřictví.' },
          { t: 'c', q: 'Úřední oprávnění (ÚOZI) uděluje…', a: 'Český úřad zeměměřický a katastrální', w: ['Komora architektů', 'Ministerstvo vnitra', 'vysoká škola'], e: 'Po splnění podmínek a zkoušce.' },
          { t: 'c', q: 'Podmínkou pro udělení oprávnění je mimo jiné…', a: 'VŠ vzdělání v oboru, praxe a zkouška', w: ['jen maturita', 'vlastní totální stanice', 'členství ve spolku'], e: 'Odborná zkouška se skládá před komisí.' },
          { t: 'tf', q: 'Výsledky zeměměřických činností pro katastr musí ověřit ÚOZI.', a: true, e: 'Bez ověření je katastr nepřevezme.' },
        ],
      },
    ],
  },

  {
    id: 'u10', title: 'Mapování a inženýrská geodézie', color: '#6d5bd0',
    desc: 'Tachymetrie, vrstevnice, vytyčování staveb, měření posunů a trasy s oblouky.',
    lessons: [
      {
        id: 'u10l1', title: 'Tachymetrie', icon: '🗺️', gens: ['hdFromSd', 'station'],
        items: [
          { t: 'c', q: 'Tachymetrie určuje současně…', a: 'polohu i výšku bodů', w: ['jen výšky', 'jen vlastníky', 'jen úhly'], e: 'Z jednoho postavení se změří směr, délka a zenitový úhel.' },
          { t: 'c', q: 'Polohopis mapy zobrazuje…', a: 'předměty měření v půdorysu', w: ['tvar terénu', 'vlastníky', 'počasí'], e: 'Budovy, komunikace, hranice…' },
          { t: 'c', q: 'Výškopis mapy zobrazuje…', a: 'tvar terénu (vrstevnice, kóty)', w: ['hranice parcel', 'názvy ulic', 'budovy'], e: 'Reliéf terénu.' },
          { t: 'c', q: 'Měřický náčrt slouží k…', a: 'zakreslení měřených bodů a jejich čísel', w: ['výpočtu výměr', 'nahrazení mapy', 'tisku LV'], e: 'Kreslí se v terénu při měření.' },
          { t: 'tf', q: 'Při tachymetrii se měří směr, délka a zenitový úhel.', a: true, e: 'Z nich se vypočtou souřadnice i výška.' },
        ],
      },
      {
        id: 'u10l2', title: 'Vrstevnice', icon: '〽️', gens: ['slopePercent'],
        items: [
          { t: 'c', q: 'Vrstevnice spojuje body…', a: 'se stejnou nadmořskou výškou', w: ['se stejnou vzdáleností', 'stejného vlastníka', 'se stejným sklonem'], e: 'Čára stejné výšky.' },
          { t: 'c', q: 'Vrstevnice hustě u sebe znamenají…', a: 'strmý terén', w: ['rovinu', 'vždy údolí', 'vodní plochu'], e: 'Na krátké vzdálenosti velký výškový rozdíl.' },
          { t: 'c', q: 'Základní interval vrstevnic je…', a: 'výškový rozdíl sousedních vrstevnic', w: ['vzdálenost vrstevnic na mapě', 'měřítko mapy', 'sklon v %'], e: 'Např. 1 m, 2 m nebo 5 m.' },
          { t: 'c', q: 'Zdůrazněná vrstevnice bývá…', a: 'každá pátá, silněji vytažená', w: ['každá druhá', 'čárkovaná', 'modrá'], e: 'Usnadňuje čtení mapy.' },
          { t: 'tf', q: 'Vrstevnice se nekříží (kromě převisů).', a: true, e: 'Bod nemůže mít dvě výšky.' },
        ],
      },
      {
        id: 'u10l3', title: 'Vytyčování staveb', icon: '🏗️', gens: ['distance', 'stakeout'],
        items: [
          { t: 'c', q: 'Vytyčovací síť slouží k…', a: 'přesnému vytyčení staveb', w: ['katastrálnímu řízení', 'tvorbě ortofota', 'nivelaci pořadů'], e: 'Hlavně u velkých staveb.' },
          { t: 'c', q: 'Vytyčení polární metodou vyžaduje vypočítat…', a: 'vytyčovací úhel (směr) a délku', w: ['jen výšku', 'jen souřadnici X', 'výměru'], e: 'Ze souřadnic stanoviska a vytyčovaného bodu.' },
          { t: 'c', q: 'Lavičky na stavbě slouží k…', a: 'zajištění os stavby mimo výkop', w: ['sezení dělníků', 'uložení přístroje', 'měření GNSS'], e: 'Osy se přenášejí provázky.' },
          { t: 'c', q: 'Kontrola vytyčení se provádí…', a: 'nezávislým měřením (např. oměrnými mírami)', w: ['stejným výpočtem', 'odhadem', 'nekontroluje se'], e: 'Jinak by se neodhalila hrubá chyba.' },
          { t: 'tf', q: 'Výšky se na stavbě vytyčují např. nivelací od výškového bodu.', a: true, e: 'Tzv. výškové vytyčení.' },
        ],
      },
      {
        id: 'u10l4', title: 'Posuny a přetvoření', icon: '📉',
        items: [
          { t: 'c', q: 'Měření posunů sleduje…', a: 'změny polohy nebo výšky objektů v čase', w: ['vlastníky', 'počasí', 'staré mapy'], e: 'Např. mosty, přehrady, budovy u výkopů.' },
          { t: 'c', q: 'Pozorovací body se osazují…', a: 'na sledovaný objekt', w: ['jen do mapy', 'na přístroj', 'na stativ'], e: 'Jejich pohyb se měří.' },
          { t: 'c', q: 'Vztažné body musí být…', a: 'stabilní, mimo oblast deformací', w: ['na sledované budově', 'co nejblíže výkopu', 'dočasné'], e: 'Tvoří nehybný rámec.' },
          { t: 'c', q: 'Posun se určí jako…', a: 'rozdíl souřadnic nebo výšek mezi etapami', w: ['součet etap', 'průměr výšek', 'výměra'], e: 'Porovnává se s přesností měření.' },
          { t: 'tf', q: 'Etapová měření se opakují ve stejných podmínkách a stejnou metodou.', a: true, e: 'Aby byly výsledky srovnatelné.' },
        ],
      },
      {
        id: 'u10l5', title: 'Trasy a oblouky', icon: '🛣️', gens: ['arcLength'],
        items: [
          { t: 'c', q: 'Kružnicový oblouk je dán hlavně…', a: 'poloměrem a středovým úhlem', w: ['jen délkou', 'barvou', 'výškou'], e: 'Z nich se odvodí tečny a délka oblouku.' },
          { t: 'c', q: 'Přechodnice slouží k…', a: 'plynulé změně křivosti mezi přímou a obloukem', w: ['změně sklonu terénu', 'výpočtu výměr', 'nivelaci'], e: 'Nejčastěji klotoida.' },
          { t: 'c', q: 'Délka kružnicového oblouku: o = …', a: 'R · α (α v radiánech)', w: ['R · α (α v gonech)', '2πR', 'R / α'], e: 'Úhel je nutné převést na radiány.' },
          { t: 'c', q: 'Staničení trasy vyjadřuje…', a: 'vzdálenost podél osy od počátku', w: ['nadmořskou výšku', 'šířku silnice', 'počet oblouků'], e: 'Např. km 1,250 00.' },
          { t: 'tf', q: 'Tečna oblouku je v bodě dotyku kolmá k poloměru.', a: true, e: 'Základ výpočtu vytyčení oblouku.' },
        ],
      },
    ],
  },
];
