// Kapitoly 1–3: Základy geodézie, Souřadnicové a výškové systémy, Přístroje.
//
// Formát otázek:
//   { t: 'c',  q, a, w: [...], e }        výběr jedné odpovědi (a = správně, w = špatně)
//   { t: 'tf', q, a: true|false, e }      pravda / nepravda
//   { t: 'm',  q, p: [[levá, pravá], …] } spojování dvojic
//   { t: 'o',  q, s: [...], e }           seřazení kroků (s = správné pořadí)
// Lekce může mít `gens` – generátory výpočtových příkladů (js/generators.js).

export default [
  {
    id: 'u1', title: 'Základy geodézie', color: '#16a37f',
    desc: 'Co je geodézie, úhlové jednotky, měřítko map, tvar Země a bodová pole.',
    lessons: [
      {
        id: 'u1l1', title: 'Co je geodézie', icon: '🌍',
        items: [
          { t: 'c', q: 'Čím se zabývá geodézie?', a: 'Měřením a zobrazováním Země a jejích částí', w: ['Studiem hornin a nerostů', 'Předpovědí počasí', 'Projektováním silnic'], e: 'Geodézie (zeměměřictví) určuje tvar a rozměry Země a polohu bodů na jejím povrchu.' },
          { t: 'c', q: 'Který obor se zabývá tvarem a tíhovým polem celé Země?', a: 'Vyšší geodézie', w: ['Katastr nemovitostí', 'Inženýrská geodézie', 'Kartografie'], e: 'Vyšší geodézie řeší Zemi jako celek – její tvar, rozměry a tíhové pole.' },
          { t: 'c', q: 'Nauka o mapách, jejich tvorbě a využití se nazývá…', a: 'Kartografie', w: ['Fotogrammetrie', 'Metrologie', 'Geologie'], e: 'Kartografie je nauka o mapách a jejich tvorbě.' },
          { t: 'c', q: 'Fotogrammetrie určuje tvar a polohu objektů z…', a: 'měřických snímků', w: ['tíhových měření', 'nivelačních pořadů', 'katastrálních map'], e: 'Foto-gram-metrie = měření z fotografií (pozemních, leteckých, z dronů).' },
          { t: 'c', q: 'Inženýrská geodézie se zabývá hlavně…', a: 'měřením pro stavby a průmysl', w: ['tvarem Země', 'správou katastru', 'tvorbou atlasů'], e: 'Vytyčování staveb, sledování posunů a přetvoření, měření pro strojírenství.' },
          { t: 'tf', q: 'Zeměměřictví je české označení pro geodézii.', a: true, e: 'Oba pojmy se používají souběžně, např. „zákon o zeměměřictví“.' },
          { t: 'm', q: 'Spojte obor s jeho činností', p: [['Katastr', 'Evidence nemovitostí'], ['Kartografie', 'Tvorba map'], ['Fotogrammetrie', 'Měření ze snímků'], ['Inženýrská geodézie', 'Vytyčování staveb']], e: 'Všechny obory spojuje určování polohy – liší se tím, k čemu výsledek slouží: evidence práv, mapy, zpracování snímků nebo stavby.' },
          { t: 'c', q: 'Který úřad v ČR řídí zeměměřictví a katastr?', a: 'ČÚZK', w: ['ČHMÚ', 'Český statistický úřad', 'Ministerstvo dopravy'], e: 'Český úřad zeměměřický a katastrální.' },
          { t: 'c', q: 'Kdo ověřuje výsledky zeměměřických činností pro katastr (např. geometrický plán)?', a: 'Úředně oprávněný zeměměřický inženýr (ÚOZI)', w: ['Kterýkoli geodet', 'Starosta obce', 'Notář'], e: 'Ověření provádí ÚOZI s úředním oprávněním od ČÚZK.' },
        ],
      },
      {
        id: 'u1l2', title: 'Úhlové jednotky', icon: '📐', gens: ['gonToDeg', 'degToGon', 'dmsToDeg', 'gonToRad'],
        items: [
          { t: 'c', q: 'Kolik gonů má plný úhel?', a: '400 gon', w: ['360 gon', '200 gon', '100 gon'], e: 'Setinné dělení: plný úhel = 400 gon, pravý úhel = 100 gon.' },
          { t: 'c', q: 'Pravý úhel v gonech je…', a: '100 gon', w: ['90 gon', '50 gon', '200 gon'], e: 'Proto se gonům říká „setinné“ – pravý úhel má 100 dílů.' },
          { t: 'c', q: '1 gon je kolik miligonů?', a: '1000 mgon', w: ['100 mgon', '60 mgon', '3600 mgon'], e: 'Mili = tisícina.' },
          { t: 'c', q: 'Kolik úhlových vteřin má 1°?', a: '3600″', w: ['60″', '100″', '360″'], e: '1° = 60′ = 3600″.' },
          { t: 'tf', q: '1 gon je větší než 1°.', a: false, e: '1 gon = 0,9°, je tedy menší.' },
          { t: 'c', q: 'Plný úhel v radiánech je…', a: '2π', w: ['π', '360', '400'], e: 'Obvod jednotkové kružnice je 2π.' },
          { t: 'c', q: '1 mgon je přibližně…', a: '3,24″', w: ['1″', '0,324″', '32,4″'], e: '1 mgon = 0,0009° = 3,24″.' },
          { t: 'm', q: 'Spojte stejné úhly', p: [['100 gon', '90°'], ['200 gon', '180°'], ['50 gon', '45°'], ['300 gon', '270°']], e: 'Plný úhel má 400 gon = 360°, takže 1 gon = 0,9° a pravý úhel je 100 gon.' },
        ],
      },
      {
        id: 'u1l3', title: 'Měřítko map', icon: '🗺️', gens: ['scaleToReal', 'realToMap'],
        items: [
          { t: 'c', q: 'Měřítko 1 : 1 000 znamená, že 1 mm na mapě je ve skutečnosti…', a: '1 m', w: ['10 m', '1 km', '1 cm'], e: '1 mm × 1000 = 1000 mm = 1 m.' },
          { t: 'c', q: 'Které měřítko je největší (nejpodrobnější)?', a: '1 : 500', w: ['1 : 5 000', '1 : 50 000', '1 : 1 000 000'], e: 'Větší měřítko = menší číslo ve jmenovateli.' },
          { t: 'tf', q: 'Mapa 1 : 50 000 je podrobnější než mapa 1 : 2 000.', a: false, e: '1 : 2 000 je větší měřítko, tedy podrobnější.' },
          { t: 'c', q: 'Základní mapa ČR ZM 10 má měřítko…', a: '1 : 10 000', w: ['1 : 1 000', '1 : 100 000', '1 : 500'], e: 'Číslo v názvu udává tisíce ve jmenovateli.' },
          { t: 'c', q: 'Plocha 1 cm² na mapě 1 : 1 000 odpovídá ve skutečnosti…', a: '100 m²', w: ['10 m²', '1 000 m²', '1 m²'], e: '1 cm = 10 m, takže 1 cm² = 10 m × 10 m = 100 m².' },
          { t: 'c', q: 'Grafické měřítko je…', a: 'úsečka s dělením nakreslená na mapě', w: ['poměr dvou čísel', 'měřítko výšek', 'zkreslení zobrazení'], e: 'Grafické měřítko platí i po zvětšení či zmenšení kopie mapy.' },
        ],
      },
      {
        id: 'u1l4', title: 'Tvar Země', icon: '🌐',
        items: [
          { t: 'c', q: 'Plocha, která nejlépe odpovídá klidné střední hladině moří, se nazývá…', a: 'geoid', w: ['elipsoid', 'koule', 'tečná rovina'], e: 'Geoid je hladinová plocha tíhového pole – nepravidelná, fyzikálně definovaná.' },
          { t: 'c', q: 'Matematicky jednoduchá plocha pro výpočty poloh je…', a: 'rotační elipsoid', w: ['geoid', 'hyperboloid', 'kvádr'], e: 'Elipsoid je dán dvěma parametry, např. hlavní poloosou a zploštěním.' },
          { t: 'c', q: 'Na jakém elipsoidu je založen S-JTSK?', a: 'Besselově', w: ['GRS80', 'WGS84', 'Krasovského'], e: 'S-JTSK používá Besselův elipsoid z roku 1841.' },
          { t: 'c', q: 'Systém ETRS89 používá elipsoid…', a: 'GRS80', w: ['Besselův', 'Hayfordův', 'Clarkův'], e: 'GRS80 je prakticky shodný s WGS84.' },
          { t: 'c', q: 'Střední poloměr Země je přibližně…', a: '6 371 km', w: ['3 185 km', '12 742 km', '40 000 km'], e: '12 742 km je průměr, 40 000 km je obvod.' },
          { t: 'tf', q: 'Tížnice (směr tíže) je kolmá ke geoidu, ne k elipsoidu.', a: true, e: 'Úhel mezi tížnicí a normálou elipsoidu je tížnicová odchylka.' },
          { t: 'c', q: 'Úhel mezi tížnicí a normálou k elipsoidu se nazývá…', a: 'tížnicová odchylka', w: ['meridiánová konvergence', 'refrakce', 'kolimační chyba'], e: 'Bývá řádově v úhlových vteřinách.' },
          { t: 'tf', q: 'U výšek se zakřivení Země projeví už na krátké vzdálenosti – asi 8 cm na 1 km.', a: true, e: 'Oprava ze zakřivení ≈ d² / (2R) = 1² / 12,74 km ≈ 7,8 cm.' },
        ],
      },
      {
        id: 'u1l5', title: 'Bodová pole', icon: '📍',
        items: [
          { t: 'c', q: 'Body základního polohového bodového pole jsou hlavně…', a: 'trigonometrické body', w: ['nivelační body', 'tíhové body', 'lomové body hranic'], e: 'Jeho převážnou část tvoří trigonometrické a zhušťovací body České státní trigonometrické sítě.' },
          { t: 'c', q: 'Výšky jsou v terénu dány body…', a: 'výškového (nivelačního) bodového pole', w: ['trigonometrickými body', 'katastrálními body', 'GNSS anténami'], e: 'Nivelační body mají výšky v systému Bpv.' },
          { t: 'c', q: 'Síť permanentních stanic GNSS provozovaná ČÚZK se jmenuje…', a: 'CZEPOS', w: ['VRS Now', 'TopNET', 'Galileo'], e: 'VRS Now a TopNET jsou komerční sítě, Galileo je družicový systém.' },
          { t: 'c', q: 'Podrobné polohové bodové pole slouží hlavně…', a: 'jako podklad pro podrobné měření', w: ['k určení tvaru Země', 'k měření tíhy', 'k letecké navigaci'], e: 'Z bodů PBPP se měří např. změny v katastru.' },
          { t: 'tf', q: 'Údaje o bodech bodových polí lze zjistit v databázi ČÚZK.', a: true, e: 'Geodetické údaje (místopisy) jsou dostupné na geoportálu ČÚZK.' },
          { t: 'm', q: 'Spojte bod s tím, co určuje', p: [['Trigonometrický bod', 'Polohu'], ['Nivelační bod', 'Výšku'], ['Tíhový bod', 'Tíhové zrychlení'], ['Stanice CZEPOS', 'Korekce GNSS']], e: 'Bodová pole se dělí podle toho, co určují: polohové (trigonometrické body), výškové (nivelační), tíhové; permanentní stanice CZEPOS poskytují korekce pro přesné GNSS.' },
        ],
      },
    ],
  },

  {
    id: 'u2', title: 'Souřadnicové a výškové systémy', color: '#2b8fd6',
    desc: 'S-JTSK a Křovákovo zobrazení, WGS84, ETRS89, výšky Bpv, transformace a směrníky.',
    lessons: [
      {
        id: 'u2l1', title: 'S-JTSK a Křovák', icon: '🇨🇿',
        items: [
          { t: 'c', q: 'Jaké zobrazení používá S-JTSK?', a: 'Křovákovo (dvojité konformní kuželové)', w: ['UTM', 'Gaussovo-Krügerovo', 'Mercatorovo'], e: 'Navrhl ho Josef Křovák ve 20. letech 20. století.' },
          { t: 'c', q: 'Kladná osa X v S-JTSK směřuje k…', a: 'jihu', w: ['severu', 'východu', 'západu'], e: 'Osa X míří k jihu, osa Y k západu – souřadnice v ČR jsou proto kladné.' },
          { t: 'c', q: 'Kladná osa Y v S-JTSK směřuje k…', a: 'západu', w: ['východu', 'severu', 'jihu'], e: 'Osa Y je kolmá k X a směřuje na západ.' },
          { t: 'tf', q: 'Na území ČR jsou obě souřadnice kladné a platí Y < X.', a: true, e: 'Y ≈ 430 000–905 000 m, X ≈ 935 000–1 230 000 m.' },
          { t: 'c', q: 'Souřadnice v S-JTSK se tradičně zapisují v pořadí…', a: 'Y, X', w: ['X, Y', 'E, N', 'φ, λ'], e: 'Nejdřív Y (menší číslo), potom X.' },
          { t: 'c', q: 'Konformní zobrazení zachovává…', a: 'úhly', w: ['plochy', 'délky', 'vzdálenosti od středu'], e: 'Konformní = úhlojevné.' },
          { t: 'c', q: 'Délkové zkreslení Křovákova zobrazení je na území ČR asi…', a: '−10 až +14 cm/km', w: ['0 cm/km', '±1 m/km', '−50 až +50 cm/km'], e: 'Na základní rovnoběžce je −10 cm/km, na okrajích republiky až +14 cm/km.' },
          { t: 'c', q: 'Co je S-JTSK/05?', a: 'Zpřesněná realizace S-JTSK navázaná na ETRS89', w: ['Nový elipsoid', 'Výškový systém', 'Systém pro Slovensko'], e: 'Odstraňuje nehomogenity původní trigonometrické sítě.' },
        ],
      },
      {
        id: 'u2l2', title: 'Globální systémy', icon: '🛰️',
        items: [
          { t: 'c', q: 'Souřadnicový systém, ve kterém pracuje GPS, je…', a: 'WGS84', w: ['S-JTSK', 'S-42', 'Bpv'], e: 'World Geodetic System 1984.' },
          { t: 'c', q: 'Evropský závazný geodetický referenční systém je…', a: 'ETRS89', w: ['WGS72', 'S-JTSK', 'ED50'], e: 'ETRS89 je spojen s euroasijskou deskou.' },
          { t: 'c', q: 'Zeměpisná šířka se značí…', a: 'φ (fí)', w: ['λ (lambda)', 'h', 'σ'], e: 'λ je zeměpisná délka, h výška.' },
          { t: 'c', q: 'Zeměpisná délka se měří od…', a: 'nultého (greenwichského) poledníku', w: ['rovníku', 'severního pólu', 'poledníku Ferro'], e: 'Ferro se používal historicky (např. v S-JTSK).' },
          { t: 'tf', q: 'Elipsoidická výška z GNSS je stejná jako nadmořská výška v Bpv.', a: false, e: 'Liší se o výšku kvazigeoidu – v ČR zhruba o 40 až 47 m.' },
          { t: 'c', q: 'UTM dělí Zemi na poledníkové pásy široké…', a: '6°', w: ['3°', '10°', '15°'], e: 'Celkem 60 pásů po 6°.' },
          { t: 'c', q: 'Česko leží v pásech UTM…', a: '33 a 34', w: ['31 a 32', '35 a 36', '29 a 30'], e: 'Pás 33 pokrývá 12°–18° v. d., pás 34 pak 18°–24°.' },
          { t: 'c', q: 'Geocentrické souřadnice X, Y, Z mají počátek…', a: 've středu Země', w: ['v Greenwichi', 'v Praze', 'na severním pólu'], e: 'Proto se jim říká geocentrické.' },
        ],
      },
      {
        id: 'u2l3', title: 'Výškové systémy', icon: '⛰️',
        items: [
          { t: 'c', q: 'Závazný výškový systém v ČR je…', a: 'Bpv – baltský po vyrovnání', w: ['Jadranský', 'Amsterdamský', 'WGS84'], e: 'Výšky jsou vztaženy k nule vodočtu v Kronštadtu.' },
          { t: 'c', q: 'Výchozí bod systému Bpv je nula vodočtu v…', a: 'Kronštadtu', w: ['Terstu', 'Amsterdamu', 'Hamburku'], e: 'Kronštadt leží ve Finském zálivu u Petrohradu.' },
          { t: 'c', q: 'Výšky ve starém Jadranském systému jsou oproti Bpv vyšší zhruba o…', a: '0,4 m', w: ['4 m', '0,04 m', '40 m'], e: 'Rozdíl se mírně mění, orientačně je to 0,4 m.' },
          { t: 'c', q: 'Výšky v Bpv jsou výšky…', a: 'normální (Moloděnského)', w: ['elipsoidické', 'dynamické', 'geocentrické'], e: 'Vztahují se ke kvazigeoidu.' },
          { t: 'tf', q: 'Nadmořská výška je svislá vzdálenost bodu od nulové výškové plochy.', a: true, e: 'Nulová plocha je dána výchozím vodočtem.' },
          { t: 'c', q: 'Nivelační bod se nejčastěji stabilizuje…', a: 'čepovou nebo hřebovou značkou', w: ['dřevěným kolíkem', 'barvou na asfaltu', 'jen v mapě'], e: 'Značky se osazují do budov, skal nebo nivelačních kamenů.' },
        ],
      },
      {
        id: 'u2l4', title: 'Transformace', icon: '🔄',
        items: [
          { t: 'c', q: 'Převod souřadnic z jednoho systému do druhého se nazývá…', a: 'transformace', w: ['redukce', 'interpolace', 'nivelace'], e: 'Transformace využívá identické body známé v obou systémech.' },
          { t: 'c', q: 'Podobnostní (Helmertova) transformace v rovině má parametry…', a: '2 posuny, 1 rotaci, 1 měřítko', w: ['jen 2 posuny', '6 parametrů', '2 posuny a 2 měřítka'], e: 'Celkem 4 parametry – zachovává tvar.' },
          { t: 'c', q: 'Kolik identických bodů minimálně potřebuje rovinná Helmertova transformace?', a: '2', w: ['1', '3', '4'], e: 'Každý bod dá 2 rovnice, neznámé jsou 4. Pro kontrolu se používá víc bodů.' },
          { t: 'c', q: 'Afinní transformace v rovině má…', a: '6 parametrů', w: ['4 parametry', '3 parametry', '7 parametrů'], e: 'Připouští různé měřítko v osách a zkosení.' },
          { t: 'c', q: 'Prostorová Helmertova transformace má…', a: '7 parametrů (3 posuny, 3 rotace, 1 měřítko)', w: ['3 parametry', '4 parametry', '9 parametrů'], e: 'Používá se např. mezi ETRS89 a S-JTSK.' },
          { t: 'tf', q: 'Identický bod má známé souřadnice v obou systémech.', a: true, e: 'Z identických bodů se určují parametry transformace.' },
        ],
      },
      {
        id: 'u2l5', title: 'Směrníky a kvadranty', icon: '🧭', gens: ['bearing', 'azimuth'],
        items: [
          { t: 'c', q: 'Směrník je úhel měřený od…', a: 'kladné osy X po směru hodinových ručiček', w: ['osy Y proti směru hodin', 'severu proti směru hodin', 'vodorovné roviny nahoru'], e: 'Směrník σ = úhel od rovnoběžky s +X ke spojnici, ve směru hodin.' },
          { t: 'c', q: 'ΔY > 0 a ΔX > 0 → směrník leží v rozsahu…', a: '0–100 gon', w: ['100–200 gon', '200–300 gon', '300–400 gon'], e: 'I. kvadrant.' },
          { t: 'c', q: 'ΔY > 0 a ΔX < 0 → směrník leží v rozsahu…', a: '100–200 gon', w: ['0–100 gon', '200–300 gon', '300–400 gon'], e: 'II. kvadrant: sin σ > 0, cos σ < 0.' },
          { t: 'c', q: 'ΔY < 0 a ΔX < 0 → směrník leží v rozsahu…', a: '200–300 gon', w: ['0–100 gon', '100–200 gon', '300–400 gon'], e: 'III. kvadrant: obě funkce záporné.' },
          { t: 'c', q: 'Opačný směrník σ_BA se od σ_AB liší o…', a: '200 gon', w: ['100 gon', '400 gon', '0 gon'], e: 'Opačný směr = otočení o půl kruhu.' },
          { t: 'tf', q: 'Směrník nabývá hodnot 0 až 400 gon.', a: true, e: 'Je to celý kruh.' },
        ],
      },
    ],
  },

  {
    id: 'u3', title: 'Přístroje', color: '#e08a1e',
    desc: 'Totální stanice, osové podmínky, nivelační přístroj, GNSS přijímač a měřické pomůcky.',
    lessons: [
      {
        id: 'u3l1', title: 'Totální stanice', icon: '🔭', gens: ['hzCircle', 'instrumentPart'],
        items: [
          { t: 'm', q: 'Spojte označení osy s jejím názvem', p: [['V', 'Svislá (točná) osa'], ['H', 'Klopná osa'], ['Z', 'Záměrná přímka'], ['L', 'Osa alhidádové libely']], e: 'Osové podmínky: L ⊥ V (jinak zůstane svislá osa skloněná), Z ⊥ H (jinak kolimační chyba) a H ⊥ V (jinak úklonná chyba).' },
          { t: 'c', q: 'Otočná horní část přístroje, která nese dalekohled, se nazývá…', a: 'alhidáda', w: ['limbus', 'trojnožka', 'podložka'], e: 'Alhidáda se otáčí kolem svislé osy.' },
          { t: 'c', q: 'Vodorovný dělený kruh se nazývá…', a: 'limbus', w: ['alhidáda', 'kolimátor', 'okulár'], e: 'Z limbu se čte vodorovný směr.' },
          { t: 'c', q: 'Která část slouží k hrubému zamíření na cíl?', a: 'kolimátor (hledáček)', w: ['ustanovka', 'stavěcí šroub', 'kompenzátor'], e: 'Kolimátor je umístěn nahoře na dalekohledu.' },
          { t: 'c', q: 'Jemné natočení přístroje na cíl zajišťují…', a: 'ustanovky', w: ['stavěcí šrouby', 'svěrky stativu', 'kolimátor'], e: 'Vodorovná ustanovka otáčí alhidádou, svislá dalekohledem.' },
          { t: 'c', q: 'Totální stanice kombinuje…', a: 'elektronický teodolit a dálkoměr', w: ['nivelační přístroj a lať', 'GNSS a kompas', 'fotoaparát a laser'], e: 'Měří současně úhly i délky.' },
          { t: 'c', q: 'Tři šrouby trojnožky, kterými se přístroj horizontuje, jsou…', a: 'stavěcí šrouby', w: ['ustanovky', 'ostřicí šrouby', 'svěrky'], e: 'Pomocí nich se urovná libela.' },
        ],
      },
      {
        id: 'u3l2', title: 'Osové podmínky a chyby', icon: '⚙️',
        items: [
          { t: 'c', q: 'Záměrná přímka má být kolmá ke…', a: 'klopné ose (Z ⟂ H)', w: ['svislé ose', 'ose libely', 'limbu'], e: 'Porušení této podmínky je kolimační chyba.' },
          { t: 'c', q: 'Porušení podmínky Z ⟂ H se nazývá…', a: 'kolimační chyba', w: ['indexová chyba', 'excentricita', 'refrakce'], e: 'Vyloučí se měřením ve dvou polohách dalekohledu.' },
          { t: 'c', q: 'Když vodorovná záměra nemá zenitový úhel přesně 100 gon, jde o…', a: 'indexovou chybu', w: ['kolimační chybu', 'chybu ze sklonu svislé osy', 'chybu dělení kruhu'], e: 'Indexová chyba se týká svislého kruhu.' },
          { t: 'c', q: 'Kterou chybu NEODSTRANÍ měření ve dvou polohách dalekohledu?', a: 'sklon svislé osy (nezhorizontování)', w: ['kolimační chybu', 'indexovou chybu', 'nekolmost klopné a svislé osy'], e: 'Proto je nutná pečlivá horizontace (a kompenzátor).' },
          { t: 'tf', q: 'Průměr z měření v obou polohách dalekohledu vylučuje kolimační chybu.', a: true, e: 'V každé poloze působí chyba s opačným znaménkem.' },
          { t: 'c', q: 'Součet zenitových úhlů z I. a II. polohy je bez indexové chyby roven…', a: '400 gon', w: ['200 gon', '100 gon', '0 gon'], e: 'Odchylka od 400 gon je dvojnásobek indexové chyby.' },
          { t: 'c', q: 'Kompenzátor totální stanice automaticky opravuje…', a: 'malý zbytkový sklon přístroje', w: ['kolimační chybu', 'chybu v délce', 'chybu centrace'], e: 'Pracuje jen v malém rozsahu (řádově minuty).' },
        ],
      },
      {
        id: 'u3l3', title: 'Nivelační přístroj a lať', icon: '📏', gens: ['bubble'],
        items: [
          { t: 'c', q: 'Hlavní podmínka nivelačního přístroje: záměrná přímka musí být…', a: 'vodorovná', w: ['svislá', 'kolmá k terénu', 'rovnoběžná se stativem'], e: 'Nivelace čte na lati při vodorovné záměře.' },
          { t: 'c', q: 'Automatický nivelační přístroj udržuje vodorovnou záměru pomocí…', a: 'kompenzátoru', w: ['trubicové libely se šroubem', 'GNSS', 'laseru'], e: 'Kompenzátor je kyvadlo s optikou.' },
          { t: 'c', q: 'Konstanta dálkoměrných rysek bývá…', a: '100', w: ['10', '50', '1000'], e: 'D = 100 · (horní − dolní čtení).' },
          { t: 'c', q: 'Digitální nivelační přístroj čte lať pomocí…', a: 'čárového kódu', w: ['E-dělení', 'čísel na lati', 'laserového paprsku'], e: 'Obraz kódu vyhodnotí elektronika.' },
          { t: 'c', q: 'Nivelační lať musí být při čtení…', a: 'svislá (urovnaná krabicovou libelou)', w: ['nakloněná k přístroji', 'vodorovná', 'libovolně postavená'], e: 'Nakloněná lať dává vždy větší čtení.' },
          { t: 'c', q: 'Nejmenší dílek na lati s E-dělením je…', a: '1 cm', w: ['1 mm', '5 cm', '1 dm'], e: 'Milimetry se odhadují.' },
          { t: 'tf', q: 'Vodorovnost záměrné přímky se zkouší nivelací ze středu a z konce.', a: true, e: 'Rozdíl obou převýšení odhalí sklon záměry.' },
        ],
      },
      {
        id: 'u3l4', title: 'GNSS přijímač', icon: '📡',
        items: [
          { t: 'c', q: 'GNSS je souhrnný název pro…', a: 'družicové navigační systémy', w: ['jen americký GPS', 'pozemní radiomajáky', 'mobilní sítě'], e: 'GPS, GLONASS, Galileo, BeiDou a další.' },
          { t: 'c', q: 'Evropský družicový systém se jmenuje…', a: 'Galileo', w: ['GLONASS', 'BeiDou', 'NAVSTAR'], e: 'NAVSTAR je oficiální název GPS.' },
          { t: 'c', q: 'Ruský družicový systém je…', a: 'GLONASS', w: ['Galileo', 'QZSS', 'BeiDou'], e: 'BeiDou je čínský, QZSS japonský.' },
          { t: 'c', q: 'Kolik družic je minimálně potřeba pro 3D polohu?', a: '4', w: ['2', '3', '6'], e: 'Neznámé jsou X, Y, Z a chyba hodin přijímače.' },
          { t: 'c', q: 'Výška antény se měří k…', a: 'referenčnímu bodu antény (ARP)', w: ['středu Země', 'displeji kontroléru', 'patce stativu'], e: 'K ARP se přičítá ofset fázového centra.' },
          { t: 'c', q: 'Kompenzace náklonu (IMU) v roveru umožňuje…', a: 'měřit s nakloněnou výtyčkou', w: ['měřit bez družic', 'měřit v budově', 'měřit bez korekcí'], e: 'Přijímač dopočítá polohu hrotu výtyčky.' },
          { t: 'tf', q: 'Rover v režimu RTK potřebuje korekce z referenční stanice nebo sítě.', a: true, e: 'Např. ze sítě CZEPOS přes internet (NTRIP).' },
        ],
      },
      {
        id: 'u3l5', title: 'Měřické pomůcky', icon: '🧰',
        items: [
          { t: 'c', q: 'Optický nebo laserový centrovač slouží k…', a: 'postavení přístroje přesně nad bod', w: ['horizontaci', 'zaostření', 'měření délky'], e: 'Centrace = svislá osa prochází bodem.' },
          { t: 'c', q: 'Odrazný hranol se používá pro…', a: 'měření délek dálkoměrem', w: ['horizontaci', 'osvětlení cíle', 'měření tíhy'], e: 'Vrací paprsek zpět do přístroje.' },
          { t: 'c', q: 'Výtyčka slouží k…', a: 'signalizaci bodu, na který se cílí', w: ['měření výšek', 'centraci přístroje', 'čtení latě'], e: 'Nese hranol nebo anténu GNSS.' },
          { t: 'c', q: 'Nivelační podložka („žabka“) slouží jako…', a: 'stabilní přestavový bod pod lať', w: ['upevnění přístroje', 'zvedák stativu', 'sklonoměr'], e: 'Zabraňuje zabořování latě.' },
          { t: 'c', q: 'Ocelové pásmo se používá k…', a: 'přímému měření délek', w: ['měření úhlů', 'určování výšek GNSS', 'horizontaci'], e: 'Dnes hlavně na krátké oměrné míry.' },
          { t: 'm', q: 'Spojte pomůcku s účelem', p: [['Stativ', 'Nese přístroj'], ['Hranol', 'Odráží paprsek'], ['Lať', 'Čtení výšek'], ['Žabka', 'Podložka pod lať']], e: 'Nivelační podložka (žabka) zajistí, že se lať na přestavě nezaboří a při otáčení nemění výšku.' },
        ],
      },
    ],
  },
];
