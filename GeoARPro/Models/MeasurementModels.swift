//
//  MeasurementModels.swift
//  GeoAR Pro: Surveying Simulator
//
//  Value types describing what the instruments "measure". They are produced
//  by the kinematics / measurement services and consumed by SwiftUI.
//

import Foundation
import simd

/// Levelling state of an instrument relative to its compensator.
enum LevelState: String, Sendable, Equatable {
    /// Bubble centred — tilt well inside the compensator range.
    case leveled
    /// Tilt within the compensator's working range; readings are corrected.
    case compensated
    /// Tilt exceeds the compensator range; instrument refuses to measure.
    case outOfRange

    var title: String {
        switch self {
        case .leveled: "Levelled"
        case .compensated: "Compensated"
        case .outOfRange: "Tilt out of range"
        }
    }
}

enum TelescopeFace: String, Sendable, Equatable {
    case one = "I"
    case two = "II"
}

/// Horizontal / vertical circle readings as the instrument displays them.
struct AngleReadings: Sendable, Equatable {
    /// Displayed horizontal direction (radians). `nil` when the compensator
    /// blocks the measurement (tilt out of range).
    var hz: Double?
    /// Displayed zenith angle (radians).
    var v: Double?
    /// Raw encoder values without tilt corrections.
    var mechanicalHz: Double
    var mechanicalV: Double
    var face: TelescopeFace
    /// Tilt component along the line of sight (radians, + = objective high).
    var tiltLongitudinal: Double
    /// Tilt component across the line of sight (radians, + = right side high).
    var tiltTransverse: Double
    var tiltMagnitude: Double
    var levelState: LevelState
    var compensatorEnabled: Bool
}

enum DistanceSource: String, Sendable, Equatable {
    case lidarMesh = "LiDAR mesh"
    case estimatedPlane = "Estimated plane"
    case levelingRod = "Levelling rod"
}

struct DistanceMeasurement: Sendable, Equatable {
    /// Slope distance from the tilting axis (metres).
    var slope: Double
    var source: DistanceSource
}

/// Reading on a levelling rod through the telescope (optical levels).
struct RodReading: Sendable, Equatable {
    /// Middle-hair reading (metres above the rod foot).
    var reading: Double
    var upperStadia: Double
    var lowerStadia: Double
    /// Tacheometric distance: `D = k · (upper − lower)`, k = 100.
    var stadiaDistance: Double
}

/// Everything the HUD and the in-scene LCD show for a telescope instrument.
struct InstrumentReadout: Sendable, Equatable {
    var instrumentName: String
    var angles: AngleReadings?
    var distance: DistanceMeasurement?
    var rod: RodReading?
    /// Height of the tilting axis (or line of sight) above the ground (m).
    var instrumentHeight: Double
    /// Session-grid azimuth of the line of sight (world −Z = 0).
    var gridAzimuth: Double?
    var isAutomaticLevel: Bool

    static let empty = InstrumentReadout(instrumentName: "", angles: nil, distance: nil, rod: nil,
                                         instrumentHeight: 0, gridAzimuth: nil, isAutomaticLevel: false)

    var horizontalDistance: Double? {
        guard let d = distance, let v = angles?.v else { return nil }
        return GeodeticMath.horizontalDistance(slope: d.slope, zenith: v)
    }

    /// Height difference tilting axis → target point.
    var heightDifference: Double? {
        guard let d = distance, let v = angles?.v else { return nil }
        return GeodeticMath.heightDifference(slope: d.slope, zenith: v)
    }
}

/// Drives the circular bubble / electronic level indicator in the HUD.
struct LevelIndicatorState: Sendable, Equatable {
    /// Bubble offset normalised to the vial radius (−1…1, x → right, y → toward viewer).
    var bubbleOffset: SIMD2<Double>
    var tiltMagnitude: Double
    var longitudinal: Double
    var transverse: Double
    var state: LevelState
    var isAvailable: Bool

    static let idle = LevelIndicatorState(bubbleOffset: .zero, tiltMagnitude: 0, longitudinal: 0,
                                          transverse: 0, state: .leveled, isAvailable: false)
}

/// Simple differential-levelling booking (backsight / foresight).
struct LevelingLog: Sendable, Equatable {
    var backsight: Double?
    var foresight: Double?

    /// Height difference from backsight point to foresight point.
    var deltaH: Double? {
        guard let b = backsight, let f = foresight else { return nil }
        return b - f
    }
}

// MARK: - GNSS

enum GNSSFixType: String, Sendable, Equatable {
    case none = "No position"
    case autonomous = "Autonomous"
    case rtkFloat = "RTK Float"
    case rtkFixed = "RTK Fixed"
}

struct GNSSStatus: Sendable, Equatable {
    var fix: GNSSFixType
    var satellitesTracked: Int
    var satellitesUsed: Int
    var pdop: Double
    /// 1-σ horizontal / vertical precision (metres).
    var hrms: Double
    var vrms: Double
    var northing: Double
    var easting: Double
    var height: Double
    var poleTilt: Double
    var tiltCompensated: Bool
    var correctionAge: Double
}
