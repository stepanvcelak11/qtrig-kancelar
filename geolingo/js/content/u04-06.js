// Kapitoly 4–6: Měření úhlů a délek, Výpočty v rovině, Nivelace.

export default [
  {
    id: 'u4', title: 'Měření úhlů a délek', color: '#8b5cf6',
    desc: 'Centrace a horizontace, vodorovné a zenitové úhly, elektronické měření délek, trigonometrické výšky.',
    lessons: [
      {
        id: 'u4l1', title: 'Postavení přístroje', icon: '🎯', gens: ['bubble'],
        items: [
          { t: 'o', q: 'Seřaďte postup postavení přístroje nad bodem', s: ['Rozevřít stativ zhruba nad bodem', 'Nasadit přístroj a hrubě zacentrovat nohou stativu', 'Urovnat krabicovou libelu délkou noh stativu', 'Zhorizontovat stavěcími šrouby', 'Dostředit posunem přístroje po hlavě stativu', 'Zkontrolovat horizontaci'], e: 'Centrace a horizontace se navzájem ovlivňují, proto se na konci kontroluje.' },
          { t: 'c', q: 'Při horizontaci dvěma stavěcími šrouby se bublina pohybuje ve směru…', a: 'levého palce', w: ['pravého palce', 'vždy od sebe', 'náhodně'], e: 'Pravidlo levého palce – šrouby se točí proti sobě.' },
          { t: 'c', q: 'Centrace znamená…', a: 'postavit svislou osu přístroje nad měřený bod', w: ['zaostřit dalekohled', 'urovnat libelu', 'nastavit Hz = 0'], e: 'Chyba centrace se promítá do měřených směrů i délek.' },
          { t: 'c', q: 'Horizontace znamená…', a: 'uvést svislou osu přístroje do svislé polohy', w: ['nastavit výšku stativu', 'zamířit na cíl', 'zapnout dálkoměr'], e: 'Kontroluje se libelou nebo elektronickou libelou.' },
          { t: 'tf', q: 'Hrubou horizontaci lze provést změnou délky noh stativu.', a: true, e: 'Stavěcí šrouby pak slouží k jemnému urovnání.' },
          { t: 'c', q: 'Výška přístroje se měří od bodu k…', a: 'klopné ose dalekohledu', w: ['hlavě stativu', 'okuláru', 'displeji'], e: 'Na přístroji bývá ryska výšky klopné osy.' },
        ],
      },
      {
        id: 'u4l2', title: 'Vodorovné úhly', icon: '↔️', gens: ['angleDiff', 'hzCircle', 'dirbook'],
        items: [
          { t: 'c', q: 'Vodorovný úhel je…', a: 'úhel mezi průměty záměr do vodorovné roviny', w: ['úhel mezi záměrou a svislicí', 'úhel mezi záměrou a vodorovnou rovinou', 'rozdíl výšek dvou cílů'], e: 'Nezávisí na sklonu záměr.' },
          { t: 'c', q: 'Měření ve skupinách znamená měřit osnovu směrů…', a: 'v obou polohách dalekohledu', w: ['jen v I. poloze', 'jen na jeden cíl', 'bez orientace'], e: 'Jedna skupina = I. a II. poloha.' },
          { t: 'c', q: 'Úhel mezi levým a pravým cílem vypočteme jako…', a: 'čtení na pravý − čtení na levý cíl', w: ['levý + pravý', 'levý − pravý', 'průměr obou čtení'], e: 'Je-li výsledek záporný, přičte se 400 gon.' },
          { t: 'c', q: 'Orientace osnovy směrů znamená…', a: 'určit směrník nulového směru limbu', w: ['urovnat libelu', 'změřit výšku přístroje', 'zacentrovat'], e: 'K tomu slouží orientační body se známými souřadnicemi.' },
          { t: 'tf', q: 'Čtení vodorovného kruhu v I. a II. poloze se liší přibližně o 200 gon.', a: true, e: 'Dalekohled se proloží a alhidáda otočí o půl kruhu.' },
          { t: 'c', q: 'Proč se orientuje na vzdálené body?', a: 'Chyba z cílení a centrace má menší vliv', w: ['Je to rychlejší', 'Šetří se baterie', 'Kvůli refrakci'], e: 'Na krátké záměře je chyba úhlu z centrace velká.' },
        ],
      },
      {
        id: 'u4l3', title: 'Zenitové úhly', icon: '↕️', gens: ['vCircle'],
        items: [
          { t: 'c', q: 'Zenitový úhel se měří od…', a: 'zenitu (svislice vzhůru)', w: ['vodorovné roviny', 'nadiru', 'osy X'], e: 'Zenit = 0 gon, horizont = 100 gon.' },
          { t: 'c', q: 'Vodorovná záměra má zenitový úhel…', a: '100 gon', w: ['0 gon', '200 gon', '400 gon'], e: 'Čtvrtina kruhu od zenitu.' },
          { t: 'c', q: 'Výškový úhel ε ze zenitového úhlu z: ε = …', a: '100 gon − z', w: ['z − 100 gon', '200 gon − z', 'z'], e: 'Kladný výškový úhel = záměra vzhůru.' },
          { t: 'c', q: 'Indexová chyba z měření ve dvou polohách: i = …', a: '(z_I + z_II − 400 gon) / 2', w: ['(z_I − z_II) / 2', 'z_I + z_II', '400 gon − z_I'], e: 'Bez chyby je součet přesně 400 gon.' },
          { t: 'tf', q: 'Zenitový úhel větší než 100 gon znamená záměru dolů.', a: true, e: 'Cíl je níž než klopná osa.' },
        ],
      },
      {
        id: 'u4l4', title: 'Měření délek', icon: '📡', gens: ['hdFromSd', 'ppmError'],
        items: [
          { t: 'c', q: 'Elektronický dálkoměr určuje délku z…', a: 'doby šíření nebo fázového posunu elmag. vlny', w: ['rychlosti zvuku', 'tíhového zrychlení', 'magnetického pole'], e: 'Pulzní nebo fázové dálkoměry.' },
          { t: 'c', q: 'Přesnost dálkoměru se udává ve tvaru…', a: 'a mm + b ppm', w: ['a gon', 'a %', 'a m/km²'], e: 'Konstantní část + část úměrná délce.' },
          { t: 'c', q: '1 ppm na délce 1 km odpovídá…', a: '1 mm', w: ['1 cm', '0,1 mm', '1 m'], e: 'ppm = miliontina: 1 000 000 mm × 10⁻⁶ = 1 mm.' },
          { t: 'c', q: 'Atmosférická (fyzikální) korekce délky závisí hlavně na…', a: 'teplotě a tlaku vzduchu', w: ['barvě hranolu', 'výšce přístroje', 'délce stativu'], e: 'Mění se rychlost šíření světla ve vzduchu.' },
          { t: 'c', q: 'Vodorovná délka ze šikmé délky s a zenitového úhlu z: d = …', a: 's · sin z', w: ['s · cos z', 's / sin z', 's · tg z'], e: 'Při z = 100 gon je d = s.' },
          { t: 'c', q: 'Součtová konstanta hranolu…', a: 'se nastaví v přístroji a opravuje měřenou délku', w: ['se zanedbává', 'mění měřený úhel', 'opravuje výšku'], e: 'U různých hranolů se liší (např. 0 nebo −30 mm).' },
          { t: 'c', q: 'Pro výpočty v S-JTSK se vodorovná délka dále redukuje…', a: 'z nadmořské výšky a o zkreslení zobrazení', w: ['o refrakci', 'o kolimační chybu', 'o teplotu hranolu'], e: 'Nejdřív na elipsoid, pak do roviny zobrazení.' },
        ],
      },
      {
        id: 'u4l5', title: 'Trigonometrické výšky', icon: '🏔️', gens: ['trigHeight'],
        items: [
          { t: 'c', q: 'Převýšení z trigonometrického měření: Δh = …', a: 's · cos z + v_p − v_c', w: ['s · sin z', 'd · cos z − v_p', 's / cos z'], e: 'v_p = výška přístroje, v_c = výška cíle.' },
          { t: 'c', q: 'Na dlouhých záměrách je nutné převýšení opravit o…', a: 'zakřivení Země a refrakci', w: ['kolimační chybu', 'součtovou konstantu', 'teplotu'], e: 'Oprava roste se čtvercem délky.' },
          { t: 'tf', q: 'Refrakce zakřivuje paprsek tak, že je obvykle vydutý k Zemi.', a: true, e: 'Částečně tak kompenzuje vliv zakřivení Země.' },
          { t: 'c', q: 'Vliv zakřivení Země na převýšení je na 1 km přibližně…', a: '8 cm', w: ['8 mm', '80 cm', '8 m'], e: 'd² / 2R ≈ 7,8 cm.' },
          { t: 'c', q: 'Výška cíle v_c je…', a: 'výška hranolu nad bodem', w: ['výška přístroje', 'nadmořská výška', 'délka latě'], e: 'Odečítá se na výtyčce.' },
        ],
      },
    ],
  },

  {
    id: 'u5', title: 'Výpočty v rovině', icon: '🧮', color: '#e5484d',
    desc: 'Směrník a délka, polární metoda, protínání, polygonový pořad a výpočet výměr.',
    lessons: [
      {
        id: 'u5l1', title: 'Směrník a délka', icon: '📐', gens: ['bearing', 'distance', 'azimuth'],
        items: [
          { t: 'c', q: 'Délka ze souřadnic: d = …', a: '√(ΔY² + ΔX²)', w: ['ΔY + ΔX', 'ΔY · ΔX', '√(ΔY + ΔX)'], e: 'Pythagorova věta.' },
          { t: 'c', q: 'tg σ = …', a: 'ΔY / ΔX', w: ['ΔX / ΔY', 'ΔY · ΔX', 'ΔX − ΔY'], e: 'Kvadrant se určí podle znamének ΔY a ΔX.' },
          { t: 'c', q: 'ΔY = 0 a ΔX < 0. Směrník je…', a: '200 gon', w: ['0 gon', '100 gon', '300 gon'], e: 'Směr proti kladné ose X.' },
          { t: 'tf', q: 'Výpočet směrníku a délky ze souřadnic je druhá (inverzní) základní úloha.', a: true, e: 'První úloha naopak počítá souřadnice ze směrníku a délky.' },
        ],
      },
      {
        id: 'u5l2', title: 'Polární metoda', icon: '📍', gens: ['polarY', 'polarX', 'stakeout'],
        items: [
          { t: 'c', q: 'Polární metoda určuje bod pomocí…', a: 'směru a délky ze stanoviska', w: ['dvou úhlů', 'dvou délek', 'jen souřadnice X'], e: 'Nejčastější metoda podrobného měření.' },
          { t: 'c', q: 'Y_P = Y_A + …', a: 'd · sin σ', w: ['d · cos σ', 'd · tg σ', 'd / sin σ'], e: 'ΔY = d · sin σ, ΔX = d · cos σ.' },
          { t: 'c', q: 'X_P = X_A + …', a: 'd · cos σ', w: ['d · sin σ', 'd · tg σ', 'd / cos σ'], e: 'Osa X ↔ kosinus.' },
          { t: 'c', q: 'Úloha „ze souřadnic bodu, směrníku a délky urči nový bod“ je…', a: 'první základní úloha', w: ['druhá základní úloha', 'protínání zpět', 'Hansenova úloha'], e: 'Tzv. přímá úloha.' },
          { t: 'o', q: 'Seřaďte výpočet polární metody', s: ['Vypočítat směrník na orientační bod', 'Určit orientační posun osnovy', 'Přičíst měřený směr → směrník na bod', 'Vypočítat ΔY = d·sin σ a ΔX = d·cos σ', 'Přičíst k souřadnicím stanoviska'], e: 'Orientační posun převádí čtení limbu na směrníky.' },
        ],
      },
      {
        id: 'u5l3', title: 'Protínání', icon: '✖️',
        items: [
          { t: 'c', q: 'Protínání vpřed z úhlů využívá…', a: 'úhly měřené na dvou známých bodech', w: ['délky ze dvou bodů', 'úhly na určovaném bodě', 'GNSS'], e: 'Určovaný bod se nemusí obsadit.' },
          { t: 'c', q: 'Protínání zpět určuje polohu…', a: 'stanoviska z úhlů měřených na známé body', w: ['vzdáleného bodu z délek', 'bodu z jedné délky', 'výšky bodu'], e: 'Tzv. Pothenotova (Snelliova) úloha.' },
          { t: 'c', q: 'Kolik známých bodů minimálně potřebuje protínání zpět?', a: '3', w: ['1', '2', '5'], e: 'Ze dvou úhlů mezi třemi body.' },
          { t: 'c', q: 'Protínání z délek určí bod z…', a: 'dvou délek změřených ze dvou známých bodů', w: ['dvou směrníků', 'jedné délky a výšky', 'tří úhlů'], e: 'Dvojznačnost řeší poloha bodu vlevo/vpravo.' },
          { t: 'tf', q: 'Protínání zpět selže, leží-li stanovisko na kružnici procházející danými body.', a: true, e: 'Tzv. nebezpečná kružnice.' },
          { t: 'c', q: 'Volné stanovisko se určuje z…', a: 'směrů a délek měřených na známé body', w: ['jen z GNSS', 'z výšky přístroje', 'ze stativu'], e: 'Nadbytečná měření se vyrovnají.' },
        ],
      },
      {
        id: 'u5l4', title: 'Polygonový pořad', icon: '〰️', gens: ['polygonAngleSum', 'traverse'],
        items: [
          { t: 'c', q: 'Oboustranně připojený a orientovaný pořad má na obou koncích…', a: 'známý bod i orientační směr', w: ['jen známý bod', 'jen orientaci', 'nic'], e: 'Umožňuje kontrolu úhlů i souřadnic.' },
          { t: 'c', q: 'Úhlový uzávěr pořadu se rozdělí…', a: 'rovnoměrně na měřené úhly', w: ['jen na první úhel', 'úměrně délkám', 'nerozděluje se'], e: 'Všechny úhly jsou měřeny stejně přesně.' },
          { t: 'c', q: 'Souřadnicové uzávěry se v jednoduchém vyrovnání rozdělí…', a: 'úměrně délkám stran', w: ['rovnoměrně na body', 'jen na poslední stranu', 'podle úhlů'], e: 'Delší strana dostane větší opravu.' },
          { t: 'c', q: 'Součet vnitřních úhlů uzavřeného n-úhelníku je…', a: '(n − 2) · 200 gon', w: ['n · 200 gon', '(n − 2) · 180 gon', '400 gon'], e: 'Ve stupních by to bylo (n − 2) · 180°.' },
          { t: 'c', q: 'Polygonový pořad slouží hlavně k…', a: 'zhuštění bodového pole', w: ['nivelaci', 'tvorbě korekcí GNSS', 'kalibraci přístroje'], e: 'Z polygonových bodů se měří podrobně.' },
          { t: 'tf', q: 'Vetknutý pořad je připojený na souřadnice na obou koncích, ale bez orientací.', a: true, e: 'Chybí úhlová kontrola.' },
        ],
      },
      {
        id: 'u5l5', title: 'Výpočet výměr', icon: '▱', gens: ['areaTriangle', 'areaQuad'],
        items: [
          { t: 'c', q: 'Výměra ze souřadnic se počítá…', a: 'L\'Huilierovými vzorci', w: ['Pythagorovou větou', 'jen odečtem z mapy', 'z obvodu'], e: '2P = Σ X_i (Y_i+1 − Y_i−1).' },
          { t: 'c', q: 'Ve vzorci 2P = Σ X_i (Y_i+1 − Y_i−1) je P…', a: 'plocha mnohoúhelníku', w: ['obvod', 'délka strany', 'směrník'], e: 'Body se číslují postupně po obvodu.' },
          { t: 'c', q: 'Výměra parcely se v katastru uvádí v…', a: 'celých m²', w: ['hektarech na desetiny', 'km²', 'dm²'], e: 'Zaokrouhluje se na celé metry čtvereční.' },
          { t: 'c', q: '1 hektar je…', a: '10 000 m²', w: ['1 000 m²', '100 m²', '100 000 m²'], e: '100 m × 100 m.' },
          { t: 'c', q: '1 ar je…', a: '100 m²', w: ['10 m²', '1 000 m²', '10 000 m²'], e: '10 m × 10 m.' },
        ],
      },
    ],
  },

  {
    id: 'u6', title: 'Nivelace', color: '#1f6f8b',
    desc: 'Geometrická nivelace ze středu, nivelační pořad, mezní odchylky, čtení latě a plošná nivelace.',
    lessons: [
      {
        id: 'u6l1', title: 'Nivelace ze středu', icon: '⚖️', gens: ['levelDiff', 'levelHeight', 'levelSetup'],
        items: [
          { t: 'c', q: 'Při nivelaci ze středu stojí přístroj…', a: 'uprostřed mezi latěmi', w: ['nad bodem', 'na konci pořadu', 'kdekoli stranou'], e: 'Záměry vzad a vpřed mají stejnou délku.' },
          { t: 'c', q: 'Převýšení: Δh = …', a: 'čtení vzad − čtení vpřed', w: ['vpřed − vzad', 'vzad + vpřed', 'průměr čtení'], e: 'Vzad = na bod se známou výškou.' },
          { t: 'c', q: 'Nivelace ze středu vylučuje hlavně vliv…', a: 'nevodorovnosti záměry a zakřivení Země', w: ['chyby dělení latě', 'chyb v zápisu', 'teploty přístroje'], e: 'Při stejných délkách se tyto vlivy odečtou.' },
          { t: 'tf', q: 'Je-li čtení vzad větší než čtení vpřed, bod vpředu leží výše.', a: true, e: 'Δh = vzad − vpřed > 0.' },
          { t: 'c', q: 'Záměry vzad a vpřed mají mít…', a: 'přibližně stejnou délku', w: ['vpřed dvojnásobnou', 'vzad co nejkratší', 'libovolné délky'], e: 'Jinak se neeliminují systematické vlivy.' },
        ],
      },
      {
        id: 'u6l2', title: 'Nivelační pořad', icon: '🪜', gens: ['levelClosure', 'fieldbook', 'blunder'],
        items: [
          { t: 'c', q: 'Přestavový bod je bod, na kterém…', a: 'se lať čte vpřed a po přestavení přístroje vzad', w: ['stojí přístroj', 'pořad začíná', 'je nivelační značka'], e: 'Spojuje dvě sestavy.' },
          { t: 'c', q: 'Výškový uzávěr pořadu: u = …', a: 'Σ Δh − (H_K − H_Z)', w: ['H_K + H_Z', 'Σ Δh', 'Σ vzad + Σ vpřed'], e: 'Rozdíl naměřeného a daného převýšení.' },
          { t: 'c', q: 'Oprava z uzávěru se rozděluje…', a: 'úměrně délkám (počtu sestav)', w: ['jen na první sestavu', 'na body bez ohledu na délku', 'nerozděluje se'], e: 'Delší úsek má větší vliv chyb.' },
          { t: 'tf', q: 'Měřením pořadu tam i zpět lze odhalit hrubé chyby.', a: true, e: 'Rozdíl převýšení tam a zpět se porovná s mezní odchylkou.' },
          { t: 'o', q: 'Seřaďte jednu nivelační sestavu', s: ['Postavit přístroj mezi latě', 'Urovnat krabicovou libelu', 'Zamířit na lať vzad a přečíst', 'Zamířit na lať vpřed a přečíst', 'Vypočítat převýšení vzad − vpřed'], e: 'Tak to jde sestavu po sestavě.' },
        ],
      },
      {
        id: 'u6l3', title: 'Mezní odchylky', icon: '✅', gens: ['levelLimit'],
        items: [
          { t: 'c', q: 'Mezní odchylka uzávěru pořadu technické nivelace je…', a: '40 mm · √R', w: ['4 mm · √R', '40 mm · R', '0,4 mm · √R'], e: 'R je délka pořadu v kilometrech.' },
          { t: 'c', q: 'R ve vzorci mezní odchylky je…', a: 'délka pořadu v km', w: ['počet sestav', 'poloměr Země', 'čtení latě'], e: 'Chyba roste s odmocninou z délky.' },
          { t: 'c', q: 'Přesná nivelace se od technické liší…', a: 'vyšší přesností, invarovými latěmi a přísnějším postupem', w: ['nižší přesností', 'měřením GNSS', 'měřením bez latí'], e: 'Používá se pro výškové bodové pole.' },
          { t: 'tf', q: 'Překročí-li uzávěr mezní odchylku, měření se musí opakovat.', a: true, e: 'Výsledek nevyhovuje.' },
        ],
      },
      {
        id: 'u6l4', title: 'Čtení latě', icon: '👁️', gens: ['rod', 'rod', 'rod', 'stadia'],
        items: [
          { t: 'c', q: 'Čtení na lati se udává na…', a: 'milimetry (odhadem)', w: ['centimetry', 'decimetry', 'metry'], e: 'Centimetry jsou dílky, milimetry se odhadnou.' },
          { t: 'c', q: 'Číslice „14“ na lati s E-dělením znamená…', a: '1,4 m', w: ['14 cm', '14 m', '0,14 m'], e: 'Čísla udávají decimetry.' },
          { t: 'c', q: 'Dálka z dálkoměrných rysek: D = …', a: '100 · (horní − dolní čtení)', w: ['horní + dolní', '100 · prostřední čtení', '(horní − dolní) / 100'], e: 'Platí pro vodorovnou záměru.' },
        ],
      },
      {
        id: 'u6l5', title: 'Plošná nivelace', icon: '🟩', gens: ['horizonHeight'],
        items: [
          { t: 'c', q: 'Plošná nivelace se používá pro…', a: 'výšky bodů ve čtvercové síti (terénní úpravy)', w: ['měření úhlů', 'katastrální hranice', 'kalibraci GNSS'], e: 'Z výšek se počítají kubatury.' },
          { t: 'c', q: 'Výška horizontu přístroje: H_i = …', a: 'H_A + čtení vzad', w: ['H_A − čtení vzad', 'H_A + čtení vpřed', 'čtení vzad − H_A'], e: 'Výška vodorovné záměrné roviny.' },
          { t: 'c', q: 'Výška bodu z horizontu přístroje: H_B = …', a: 'H_i − čtení na bodě', w: ['H_i + čtení', 'čtení − H_i', 'H_i · čtení'], e: 'Čím větší čtení, tím níž bod leží.' },
          { t: 'tf', q: 'Z jednoho postavení přístroje lze určit výšky mnoha bodů.', a: true, e: 'Stačí přečíst lať na každém bodě.' },
        ],
      },
    ],
  },
];
