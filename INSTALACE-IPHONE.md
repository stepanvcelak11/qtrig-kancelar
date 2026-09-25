# Jak nahrát GeoAR Pro do iPhonu (Sideloadly)

Nativní aplikace GeoAR Pro (skutečné AR s LiDARem: přístroj pevně stojí na podlaze, obcházíte ho,
nakloníte se nad libelu, šrouby točíte rukou) není v App Storu. Do iPhonu se proto nahrává
z počítače programem **Sideloadly**. Ten aplikaci podepíše vaším Apple ID, takže ji iPhone
dovolí spustit.

Potřebujete:
- iPhone (ideálně Pro s LiDARem, např. 14 Pro) a kabel k počítači,
- počítač s **Windows** nebo **Mac**,
- **Apple ID** (stačí zdarma; kdo nechce použít hlavní, může si založit vedlejší).

## 1. Stáhněte aplikaci

Aktuální verze je vždy tady (soubor `GeoARPro-unsigned.ipa`):

https://github.com/stepanvcelak11/qtrig-kancelar/releases/download/build-claude-geoar-pro-surveying-app-afjx3m/GeoARPro-unsigned.ipa

## 2. Připravte počítač

**Windows:**
1. Nainstalujte **iTunes** a **iCloud** přímo z webu Applu (apple.com/itunes, apple.com/icloud),
   **ne** z Microsoft Store – Sideloadly s verzí ze Store nefunguje.
2. Stáhněte a nainstalujte **Sideloadly** z https://sideloadly.io

**Mac:**
1. Stáhněte a nainstalujte **Sideloadly** z https://sideloadly.io (iTunes není potřeba).

## 3. Nahrajte aplikaci do iPhonu

1. Připojte iPhone kabelem k počítači a odemkněte ho.
2. Na iPhonu potvrďte **„Důvěřovat tomuto počítači“** a zadejte kód.
3. Spusťte Sideloadly. Nahoře v poli *iDevice* by měl být vidět váš iPhone.
4. Přetáhněte stažený soubor `GeoARPro-unsigned.ipa` do velké ikony vlevo v Sideloadly.
5. Do pole *Apple account* napište své Apple ID (e-mail) a klikněte na **Start**.
6. Zadejte heslo k Apple ID (a případně ověřovací kód, který přijde na telefon).
7. Počkejte na hlášku **Done**.

## 4. Povolte aplikaci v iPhonu (jen poprvé)

1. **Nastavení → Obecné → Správa VPN a zařízení** → klepněte na profil se svým Apple ID
   → **Důvěřovat**.
2. **Nastavení → Soukromí a zabezpečení → Režim pro vývojáře** → zapnout → iPhone se restartuje
   → po restartu potvrďte **Zapnout**.
3. Spusťte **GeoAR Pro** z plochy a povolte přístup ke kameře.

## 5. Důležité

- S Apple ID zdarma aplikace **po 7 dnech přestane fungovat** – stačí znovu zopakovat krok 3
  (nahraje se přes starou verzi, nic se neztratí).
- Když vyjde nová verze, stáhněte znovu soubor z kroku 1 a zopakujte krok 3.
- Hraje se **na šířku**.

## Jak se hraje

- **Postavit přístroj:** namiřte telefon na podlahu, počkejte na modrý kruh a klepněte na **Postavit**.
  Přístroj pak pevně stojí v místnosti – můžete ho obcházet.
- **Stativ:** nohy stativu se prodlužují/zkracují tažením za jejich svěrku – tím hrubě urovnáte
  hlavu stativu (jako ve skutečnosti).
- **Horizontace:** nakloňte se nad trojnožku, sledujte bublinu na přístroji a točte stavěcími
  šrouby – rukou (sevřete palec s ukazováčkem nad šroubem a otočte zápěstím) nebo prstem na displeji.
- **Zamíření:** alhidádu a dalekohled otočíte dotykem, jemně ustanovkami (knoflíky na boku).
- **Okulár:** přiložte telefon k okuláru dalekohledu – zobrazí se pohled dalekohledem
  s nitkovým křížem. Oddálením se vrátíte zpět.
