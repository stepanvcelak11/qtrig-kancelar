//
//  EquipmentCatalog.swift
//  GeoAR Pro: Surveying Simulator
//
//  Catalogue of simulated equipment with nominal manufacturer specifications.
//  Values are representative of the published data sheets and are used to
//  drive the simulation (magnification, compensator range, EDM accuracy, …).
//  Framework-free so it can be unit tested on macOS.
//

import Foundation

// MARK: - Classification

enum EquipmentCategory: String, CaseIterable, Identifiable, Sendable {
    case totalStation
    case opticalLevel
    case gnssRover
    case accessory

    var id: String { rawValue }

    var title: String {
        switch self {
        case .totalStation: "Totální stanice"
        case .opticalLevel: "Nivelační přístroje"
        case .gnssRover: "GNSS RTK"
        case .accessory: "Příslušenství"
        }
    }

    var systemImage: String {
        switch self {
        case .totalStation: "scope"
        case .opticalLevel: "level"
        case .gnssRover: "antenna.radiowaves.left.and.right"
        case .accessory: "triangle"
        }
    }
}

enum Manufacturer: String, Sendable, Hashable {
    case leica = "Leica Geosystems"
    case trimble = "Trimble"
    case topcon = "Topcon"
    case generic = "Generic"

    var shortName: String {
        switch self {
        case .leica: "Leica"
        case .trimble: "Trimble"
        case .topcon: "Topcon"
        case .generic: "GeoAR"
        }
    }
}

// MARK: - Colours (framework-free; converted to UIColor in the AR layer)

struct RGBAColor: Sendable, Hashable {
    var r: Float
    var g: Float
    var b: Float
    var a: Float

    init(_ r: Float, _ g: Float, _ b: Float, _ a: Float = 1) {
        self.r = r; self.g = g; self.b = b; self.a = a
    }
}

/// Signature colour scheme of each brand, applied to coated-metal housings.
struct BrandPalette: Sendable, Hashable {
    /// Main painted housing colour.
    var body: RGBAColor
    /// Secondary brand accent (stripes, logos, handle).
    var accent: RGBAColor
    /// Dark anodised trim (bases, knobs, hoods).
    var trim: RGBAColor
    /// Label / lettering colour.
    var label: RGBAColor

    static func palette(for manufacturer: Manufacturer) -> BrandPalette {
        switch manufacturer {
        case .leica:
            // Leica signature warm white with deep green accents.
            BrandPalette(body: RGBAColor(0.93, 0.91, 0.86),
                         accent: RGBAColor(0.07, 0.36, 0.24),
                         trim: RGBAColor(0.11, 0.12, 0.13),
                         label: RGBAColor(0.80, 0.05, 0.08))
        case .trimble:
            // Trimble bright yellow with charcoal.
            BrandPalette(body: RGBAColor(0.98, 0.78, 0.04),
                         accent: RGBAColor(0.20, 0.21, 0.22),
                         trim: RGBAColor(0.10, 0.10, 0.11),
                         label: RGBAColor(0.05, 0.25, 0.55))
        case .topcon:
            // Topcon classic (slightly warmer) yellow with white.
            BrandPalette(body: RGBAColor(0.96, 0.70, 0.07),
                         accent: RGBAColor(0.94, 0.94, 0.92),
                         trim: RGBAColor(0.13, 0.13, 0.14),
                         label: RGBAColor(0.05, 0.30, 0.20))
        case .generic:
            // Accessories: yellow hardware, dark aluminium.
            BrandPalette(body: RGBAColor(0.95, 0.74, 0.10),
                         accent: RGBAColor(0.18, 0.19, 0.20),
                         trim: RGBAColor(0.12, 0.12, 0.13),
                         label: RGBAColor(0.85, 0.10, 0.10))
        }
    }
}

// MARK: - Specifications

enum DriveType: String, Sendable, Hashable {
    /// Classic mechanics: a clamp (Alidade lock) must be engaged before the
    /// tangent screw acts, and the tangent screw has limited travel.
    case clampAndTangent
    /// Modern endless friction/servo drives: coarse rotation by hand at any
    /// time, fine drive without travel limit.
    case endlessFriction

    var title: String {
        switch self {
        case .clampAndTangent: "Svěrka a ustanovka"
        case .endlessFriction: "Nekonečné pohony"
        }
    }
}

struct TotalStationSpec: Sendable, Hashable {
    var angularAccuracyArcsec: Double
    var magnification: Double
    var fieldOfViewArcmin: Double
    var minimumFocus: Double
    var edmRangePrism: Double
    var edmRangeReflectorless: Double
    var edmConstantMM: Double
    var edmPPM: Double
    var compensatorRangeArcmin: Double
    var circularLevelArcminPer2mm: Double
    /// Height of the tilting (trunnion) axis above the tribrach base, metres.
    var trunnionHeight: Double
    var driveType: DriveType
    /// Horizontal/vertical fine-drive transmission: gon per knob revolution.
    var fineDriveGonPerTurn: Double
    var weightKg: Double
    var displayName: String
}

struct OpticalLevelSpec: Sendable, Hashable {
    var magnification: Double
    var accuracyMMPerKm: Double
    var compensatorRangeArcmin: Double
    var compensatorSettingArcsec: Double
    var circularLevelArcminPer2mm: Double
    var minimumFocus: Double
    var stadiaMultiplier: Double
    /// Height of the line of sight above the tripod head, metres.
    var lineOfSightHeight: Double
    var fineDriveGonPerTurn: Double
    var weightKg: Double
    var hasHorizontalCircle: Bool
}

struct GNSSRoverSpec: Sendable, Hashable {
    var channels: Int
    var rtkHorizontalMM: Double
    var rtkVerticalMM: Double
    var rtkPPM: Double
    /// Name of the IMU tilt-compensation technology.
    var tiltCompensationName: String
    /// Maximum pole tilt for which the stated tilt accuracy holds, degrees.
    var tiltCompensationMaxDegrees: Double
    /// Additional horizontal error per degree of tilt, millimetres.
    var tiltErrorMMPerDegree: Double
    var poleLength: Double
    var antennaDiameter: Double
    var antennaHeight: Double
    var weightKg: Double
}

struct TripodSpec: Sendable, Hashable {
    var material: String
    var minimumHeight: Double
    var maximumHeight: Double
    var defaultHeadHeight: Double
    var weightKg: Double
}

struct LevelingRodSpec: Sendable, Hashable {
    var length: Double
    var sections: Int
    var graduation: String
    var weightKg: Double
}

enum EquipmentKind: Sendable, Hashable {
    case totalStation(TotalStationSpec)
    case opticalLevel(OpticalLevelSpec)
    case gnssRover(GNSSRoverSpec)
    case tripod(TripodSpec)
    case levelingRod(LevelingRodSpec)
}

struct SpecificationRow: Sendable, Hashable, Identifiable {
    var id: String { label }
    let label: String
    let value: String
}

// MARK: - Equipment model

struct EquipmentModel: Identifiable, Sendable, Hashable {
    let id: String
    let name: String
    let manufacturer: Manufacturer
    let category: EquipmentCategory
    let kind: EquipmentKind
    let tagline: String
    /// Optional bundled USDZ asset. When the file is present, its named
    /// sub-meshes replace the procedural visuals (see `ProceduralModelGenerator`).
    let usdzAssetName: String?

    var palette: BrandPalette { .palette(for: manufacturer) }

    var displayName: String {
        manufacturer == .generic ? name : "\(manufacturer.shortName) \(name)"
    }

    var systemImage: String {
        switch kind {
        case .totalStation: "scope"
        case .opticalLevel: "level"
        case .gnssRover: "antenna.radiowaves.left.and.right"
        case .tripod: "triangle"
        case .levelingRod: "ruler"
        }
    }

    /// Instruments that are mounted on a tripod when placed.
    var mountsOnTripod: Bool {
        switch kind {
        case .totalStation, .opticalLevel: true
        default: false
        }
    }

    /// Instruments with an eyepiece that supports the optical pass-through mode.
    var hasTelescope: Bool { mountsOnTripod }

    var magnification: Double? {
        switch kind {
        case .totalStation(let s): s.magnification
        case .opticalLevel(let s): s.magnification
        default: nil
        }
    }

    var specificationRows: [SpecificationRow] {
        switch kind {
        case .totalStation(let s):
            return [
                SpecificationRow(label: "Přesnost úhlů", value: String(format: "%.0f\" (%.1f mgon)", s.angularAccuracyArcsec, s.angularAccuracyArcsec / 3.24)),
                SpecificationRow(label: "Dalekohled", value: String(format: "%.0f× · FOV %.0f'", s.magnification, s.fieldOfViewArcmin)),
                SpecificationRow(label: "EDM prism", value: String(format: "%.0f m · %.0f mm + %.1f ppm", s.edmRangePrism, s.edmConstantMM, s.edmPPM)),
                SpecificationRow(label: "Bez hranolu", value: String(format: "%.0f m", s.edmRangeReflectorless)),
                SpecificationRow(label: "Kompenzátor", value: String(format: "dual-axis ±%.1f'", s.compensatorRangeArcmin)),
                SpecificationRow(label: "Krabicová libela", value: String(format: "%.0f'/2 mm", s.circularLevelArcminPer2mm)),
                SpecificationRow(label: "Pohony", value: s.driveType.title),
                SpecificationRow(label: "Hmotnost", value: String(format: "%.1f kg", s.weightKg)),
            ]
        case .opticalLevel(let s):
            return [
                SpecificationRow(label: "Přesnost", value: String(format: "%.1f mm/km double run", s.accuracyMMPerKm)),
                SpecificationRow(label: "Dalekohled", value: String(format: "%.0f× · min focus %.1f m", s.magnification, s.minimumFocus)),
                SpecificationRow(label: "Kompenzátor", value: String(format: "±%.0f' · setting %.1f\"", s.compensatorRangeArcmin, s.compensatorSettingArcsec)),
                SpecificationRow(label: "Krabicová libela", value: String(format: "%.0f'/2 mm", s.circularLevelArcminPer2mm)),
                SpecificationRow(label: "Dálkoměrné rysky", value: String(format: "1:%.0f", s.stadiaMultiplier)),
                SpecificationRow(label: "Hz kruh", value: s.hasHorizontalCircle ? "400 gon / 360°" : "—"),
                SpecificationRow(label: "Hmotnost", value: String(format: "%.1f kg", s.weightKg)),
            ]
        case .gnssRover(let s):
            return [
                SpecificationRow(label: "Kanály", value: "\(s.channels)"),
                SpecificationRow(label: "RTK Hz", value: String(format: "%.0f mm + %.1f ppm", s.rtkHorizontalMM, s.rtkPPM)),
                SpecificationRow(label: "RTK V", value: String(format: "%.0f mm + %.1f ppm", s.rtkVerticalMM, s.rtkPPM)),
                SpecificationRow(label: "Náklon", value: "\(s.tiltCompensationName) ≤ \(Int(s.tiltCompensationMaxDegrees))°"),
                SpecificationRow(label: "Výtyčka", value: String(format: "%.2f m carbon fibre + bipod", s.poleLength)),
                SpecificationRow(label: "Hmotnost", value: String(format: "%.2f kg", s.weightKg)),
            ]
        case .tripod(let s):
            return [
                SpecificationRow(label: "Materiál", value: s.material),
                SpecificationRow(label: "Výška", value: String(format: "%.2f – %.2f m", s.minimumHeight, s.maximumHeight)),
                SpecificationRow(label: "Hmotnost", value: String(format: "%.1f kg", s.weightKg)),
            ]
        case .levelingRod(let s):
            return [
                SpecificationRow(label: "Délka", value: String(format: "%.1f m · %d sections", s.length, s.sections)),
                SpecificationRow(label: "Dělení", value: s.graduation),
                SpecificationRow(label: "Hmotnost", value: String(format: "%.1f kg", s.weightKg)),
            ]
        }
    }
}

// MARK: - Catalogue

enum EquipmentCatalog {
    static let all: [EquipmentModel] = [
        // MARK: Total stations
        EquipmentModel(
            id: "leica-ts16", name: "TS16", manufacturer: .leica, category: .totalStation,
            kind: .totalStation(TotalStationSpec(
                angularAccuracyArcsec: 1, magnification: 30, fieldOfViewArcmin: 90, minimumFocus: 1.7,
                edmRangePrism: 3500, edmRangeReflectorless: 1000, edmConstantMM: 1, edmPPM: 1.5,
                compensatorRangeArcmin: 4, circularLevelArcminPer2mm: 6, trunnionHeight: 0.196,
                driveType: .endlessFriction, fineDriveGonPerTurn: 0.25, weightKg: 5.3, displayName: "TS16 R1000")),
            tagline: "Samoučící robotická totální stanice",
            usdzAssetName: "LeicaTS16"),
        EquipmentModel(
            id: "trimble-s7", name: "S7", manufacturer: .trimble, category: .totalStation,
            kind: .totalStation(TotalStationSpec(
                angularAccuracyArcsec: 1, magnification: 30, fieldOfViewArcmin: 80, minimumFocus: 1.5,
                edmRangePrism: 2500, edmRangeReflectorless: 1300, edmConstantMM: 1, edmPPM: 2,
                compensatorRangeArcmin: 5.4, circularLevelArcminPer2mm: 8, trunnionHeight: 0.196,
                driveType: .endlessFriction, fineDriveGonPerTurn: 0.25, weightKg: 5.5, displayName: "S7 1\" DR+")),
            tagline: "MagDrive servo technology with VISION",
            usdzAssetName: "TrimbleS7"),
        EquipmentModel(
            id: "topcon-gt1200", name: "GT-1200", manufacturer: .topcon, category: .totalStation,
            kind: .totalStation(TotalStationSpec(
                angularAccuracyArcsec: 1, magnification: 30, fieldOfViewArcmin: 90, minimumFocus: 1.3,
                edmRangePrism: 5000, edmRangeReflectorless: 1000, edmConstantMM: 1, edmPPM: 2,
                compensatorRangeArcmin: 6, circularLevelArcminPer2mm: 10, trunnionHeight: 0.192,
                driveType: .endlessFriction, fineDriveGonPerTurn: 0.25, weightKg: 5.8, displayName: "GT-1201")),
            tagline: "UltraSonic direct-drive robotic station",
            usdzAssetName: "TopconGT1200"),

        // MARK: Optical levels
        EquipmentModel(
            id: "leica-na730", name: "NA730 plus", manufacturer: .leica, category: .opticalLevel,
            kind: .opticalLevel(OpticalLevelSpec(
                magnification: 30, accuracyMMPerKm: 1.2, compensatorRangeArcmin: 15, compensatorSettingArcsec: 0.3,
                circularLevelArcminPer2mm: 10, minimumFocus: 0.5, stadiaMultiplier: 100, lineOfSightHeight: 0.105,
                fineDriveGonPerTurn: 0.5, weightKg: 1.7, hasHorizontalCircle: true)),
            tagline: "Automatický nivelační přístroj s magneticky tlumeným kompenzátorem",
            usdzAssetName: "LeicaNA730"),
        EquipmentModel(
            id: "topcon-atb4a", name: "AT-B4A", manufacturer: .topcon, category: .opticalLevel,
            kind: .opticalLevel(OpticalLevelSpec(
                magnification: 24, accuracyMMPerKm: 2.0, compensatorRangeArcmin: 15, compensatorSettingArcsec: 0.5,
                circularLevelArcminPer2mm: 10, minimumFocus: 0.2, stadiaMultiplier: 100, lineOfSightHeight: 0.098,
                fineDriveGonPerTurn: 0.5, weightKg: 1.7, hasHorizontalCircle: true)),
            tagline: "Odolný stavební nivelační přístroj",
            usdzAssetName: "TopconATB4A"),

        // MARK: GNSS rovers
        EquipmentModel(
            id: "leica-gs18t", name: "GS18 T", manufacturer: .leica, category: .gnssRover,
            kind: .gnssRover(GNSSRoverSpec(
                channels: 555, rtkHorizontalMM: 8, rtkVerticalMM: 15, rtkPPM: 0.5,
                tiltCompensationName: "IMU (calibration-free)", tiltCompensationMaxDegrees: 30, tiltErrorMMPerDegree: 0.4,
                poleLength: 2.0, antennaDiameter: 0.17, antennaHeight: 0.095, weightKg: 1.25)),
            tagline: "Nejrychlejší GNSS RTK rover s kompenzací náklonu",
            usdzAssetName: "LeicaGS18T"),
        EquipmentModel(
            id: "trimble-r12i", name: "R12i", manufacturer: .trimble, category: .gnssRover,
            kind: .gnssRover(GNSSRoverSpec(
                channels: 672, rtkHorizontalMM: 8, rtkVerticalMM: 15, rtkPPM: 1,
                tiltCompensationName: "Trimble TIP", tiltCompensationMaxDegrees: 30, tiltErrorMMPerDegree: 0.5,
                poleLength: 2.0, antennaDiameter: 0.165, antennaHeight: 0.10, weightKg: 1.12)),
            tagline: "ProPoint GNSS engine with TIP tilt compensation",
            usdzAssetName: "TrimbleR12i"),

        // MARK: Accessories
        EquipmentModel(
            id: "tripod-gst20", name: "Dřevěný stativ GST20", manufacturer: .generic, category: .accessory,
            kind: .tripod(TripodSpec(material: "Lakovaný buk, žluté kování", minimumHeight: 1.07, maximumHeight: 1.72,
                                     defaultHeadHeight: 1.25, weightKg: 6.4)),
            tagline: "Heavy-duty wooden tripod with 5/8\" centring screw",
            usdzAssetName: nil),
        EquipmentModel(
            id: "rod-aluminium", name: "Hliníková nivelační lať", manufacturer: .generic, category: .accessory,
            kind: .levelingRod(LevelingRodSpec(length: 3.0, sections: 3, graduation: "E-pattern, 1 cm", weightKg: 1.6)),
            tagline: "Teleskopická lať s krabicovou libelou",
            usdzAssetName: nil),
    ]

    static func models(in category: EquipmentCategory) -> [EquipmentModel] {
        all.filter { $0.category == category }
    }

    static func model(id: String) -> EquipmentModel? {
        all.first { $0.id == id }
    }

    static var defaultModel: EquipmentModel { all[0] }
}
