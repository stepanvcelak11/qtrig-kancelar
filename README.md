# GeoAR Pro: Surveying Simulator

> **Webová verze (PWA):** složka [`web/`](web/) – otevřete ji v Safari/Chrome na telefonu a přidejte na plochu
> (Sdílet → Přidat na plochu). Nasazuje se automaticky na GitHub Pages (`.github/workflows/pages.yml`).
> Obsahuje totální stanice, nivelační přístroje, GNSS rovery, stativ a lať; AR nad kamerou s gyroskopem nebo 3D režim,
> ovládání dotykem i rukou (MediaPipe), horizontaci stavěcími šrouby, kompenzátor, ustanovky a pohled dalekohledem
> s dálkoměrnými ryskami. Vše (Three.js, MediaPipe a model ruky) je přibaleno, takže po prvním načtení běží offline.
> Lokálně: `cd web && python3 -m http.server` a testy mechaniky `node web/tests/kinematics.test.mjs`.
>
> Níže je popsána nativní iOS verze (Swift 6), která je v repozitáři také.

An augmented-reality simulator of surveying equipment for iPhone (iOS 17+, optimised for LiDAR iPhone Pro models).
You can place virtual **total stations**, **automatic levels**, **GNSS RTK rovers**, **tripods** and **levelling rods**
in the real world, operate them with your **tracked hand** (or with touch), level them with the foot screws, and
**look through the eyepiece**: a magnified camera view with a stadia reticle and live Hz / V / distance readings.

Built with Swift 6 (strict concurrency), SwiftUI, RealityKit, ARKit and Vision. It needs no bundled 3-D assets,
because every instrument is generated procedurally with PBR materials.

## Equipment

| Category | Models |
|---|---|
| Total stations | Leica TS16, Trimble S7, Topcon GT-1200 |
| Automatic levels | Leica NA730 plus, Topcon AT-B4A |
| GNSS rovers | Leica GS18 T, Trimble R12i (carbon-fibre pole, bipod, field tablet) |
| Accessories | Wooden tripod (GST20 style), aluminium E-pattern levelling rod |

Specifications such as magnification, compensator range, EDM accuracy, circular-level sensitivity and tilt
compensation come from the data sheets. The simulation uses them.

## Architecture

```
GeoARPro/
├─ App/            GeoARApp (entry), AppDelegate (lifecycle, capabilities, camera permission), AppModel
├─ Models/         EquipmentCatalog (specs, brand palettes), MeasurementModels (readings, GNSS status)
├─ AR/             ARViewContainer (ARView, LiDAR config, gestures, session delegate bridge)
│                  ARSceneController (main-actor coordinator & frame loop)
│                  ProceduralModelGenerator, MeshFactory (lathe/extrusion meshes), MaterialLibrary (PBR +
│                  procedural normal maps), InstrumentRig (articulated hierarchies), DynamicDisplayTexture (LCD)
├─ Services/       HandTrackingEngine (Vision hand pose → 3-D rays/points), MeasurementService (EDM raycasts),
│                  GNSSSimulator (RTK fix/precision/noise)
├─ Interactions/   SurveyingKinematics (constraint solver), InteractionController (pointer → intents), HapticsEngine
├─ Optics/         EyepiecePassThroughService (eye alignment + zoom crop), TelescopeOptics.metal (SwiftUI shader)
├─ Views/          CatalogOverlayView (HUD, drawer, controls), LevelBubbleView, HandOverlayView, TelescopeView
└─ Utilities/      GeodeticMath (gon/DMS, azimuth/zenith, tilt geometry), OneEuroFilter
Tests/SurveyingCoreTests   XCTest for the framework-free core (runs on macOS)
```

### Kinematic model

```
setup frame (gravity aligned)
 └─ R_tilt      tribrach upper plate = tripod-head tilt + plane through the 3 foot-screw tips
     └─ R_y(α)  alidade (vertical axis)
         └─ R_x(ε)  telescope (tilting axis) → line of sight (0, 0, −1)
```

* Hz = normalise(−α + c), clockwise, with c the circle orientation. **Hz hold** (limbus coupled) keeps the reading
  constant while the alidade turns.
* V = zenith angle. Face II is detected automatically.
* A dual-axis compensator reports the **true** line of sight. This equals the classical ΔV = −l and
  ΔHz = t·cot Z corrections, but is exact for any tilt. Outside the compensator range, measurements are blocked
  and the display shows *TILT*.
* Fine drives turn 0.25 gon per revolution, with a haptic detent every 0.01 gon and 1″ resolution. An optional
  **classic** mode simulates clamps and tangent screws with limited travel.
* Foot screws have a 0.5 mm lead. The circular bubble moves to the high side, following the vial sensitivity
  (for example 6′/2 mm).
* Automatic levels: the pendulum compensator keeps the line of sight horizontal while the instrument is within
  ±15′. Rod readings use stadia hairs at ±1/200 rad, so D = 100·(upper − lower).

### Hand tracking

1. `ARSessionDelegate` passes frames to the `VNDetectHumanHandPoseRequest`. It runs on a background serial queue,
   one frame in flight, at about 30 Hz.
2. The index tip, thumb tip and wrist are smoothed with a 1€ filter. They are un-projected with that frame's camera
   intrinsics and pose into world rays. LiDAR depth, taken as the lower quartile of a 5×5 window, turns them into
   3-D points.
3. A **pinch** is registered when the thumb and index are closer than 3 cm (released above 4.5 cm). Without LiDAR,
   the distance is estimated from the hand's own scale.
4. The ray is tested against RealityKit colliders (`InteractivePartComponent`, custom collision groups):
   * touch the telescope body to pitch it, or the alidade to rotate it
   * pinch and twist the fine drives, focus ring or foot screws to turn them, with haptic ticks

When no hand is detected, the **Touch** mode is available as a fallback: drag the parts and drag or twist the knobs.

### Eyepiece pass-through

When the phone is within 8 cm of the eyepiece and within 15° of the optical axis, the UI switches to telescope
mode. The camera image is cropped around the projection of the line of sight (10–30× digital zoom). It is then
passed through a Metal layer shader (field stop, cos⁴ vignetting, chromatic aberration, defocus from the focus
knob) and shown under a reticle with 1:100 stadia hairs. Pulling the phone more than 12 cm away returns to AR.

## Building

Requirements: Xcode 16 or later, [XcodeGen](https://github.com/yonaskolb/XcodeGen), and an ARKit device (LiDAR
recommended). The simulator is not supported because ARKit world tracking is required.

```bash
brew install xcodegen
xcodegen generate
open GeoARPro.xcodeproj      # set your signing team, run on an iPhone
```

Core unit tests (macOS, no device needed):

```bash
xcodebuild test -project GeoARPro.xcodeproj -scheme SurveyingCoreTests -destination 'platform=macOS'
```

CI (`.github/workflows/ios.yml`) generates the project, builds the app for `generic/platform=iOS` without code
signing, and runs the core tests.

### Optional USDZ models

If `LeicaTS16.usdz` (or another `usdzAssetName` from the catalogue) is added to the app bundle, its sub-entities
named `Tribrach`, `TribrachUpper`, `Alidade` and `Telescope` replace the procedural visuals. The kinematic pivots,
colliders and knobs stay procedural.
