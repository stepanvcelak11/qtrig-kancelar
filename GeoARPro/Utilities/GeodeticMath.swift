//
//  GeodeticMath.swift
//  GeoAR Pro: Surveying Simulator
//
//  Pure, framework-free geodetic helpers (angle units, normalisation, tilt
//  geometry and reduction formulas). Deliberately free of UIKit/RealityKit so
//  it is covered by the macOS `SurveyingCoreTests` bundle.
//
//  Frame conventions used across the whole app (RealityKit/ARKit world frame):
//    • +Y is up (opposite to gravity), the X/Z plane is horizontal.
//    • An entity "looks" down its local −Z axis.
//    • Horizontal directions (Hz, azimuth) are measured CLOCKWISE when seen
//      from above, starting at −Z — the surveying convention. A right-handed
//      rotation about +Y (counter-clockwise from above) therefore DECREASES Hz.
//    • Zenith angles (V) are measured from +Y: 0 = straight up, π/2 = horizon.
//

import Foundation
import simd

/// Angular units offered by the instrument displays.
enum AngleUnit: String, CaseIterable, Identifiable, Sendable {
    /// Centesimal degrees (400 gon per revolution) — the European standard.
    case gon
    /// Sexagesimal degrees, minutes and seconds.
    case dms
    /// Decimal degrees.
    case decimalDegrees

    var id: String { rawValue }

    var label: String {
        switch self {
        case .gon: "gon"
        case .dms: "DMS"
        case .decimalDegrees: "deg"
        }
    }
}

enum GeodeticMath {
    static let fullCircle = 2.0 * Double.pi
    static let gonPerRadian = 200.0 / Double.pi
    static let degreesPerRadian = 180.0 / Double.pi
    static let arcsecondsPerRadian = 648_000.0 / Double.pi

    // MARK: - Unit conversion (value in the named unit → radians)

    static func gon(_ value: Double) -> Double { value / gonPerRadian }
    static func degrees(_ value: Double) -> Double { value / degreesPerRadian }
    static func arcminutes(_ value: Double) -> Double { value * 60.0 / arcsecondsPerRadian }
    static func arcseconds(_ value: Double) -> Double { value / arcsecondsPerRadian }

    // MARK: - Unit conversion (radians → named unit)

    static func toGon(_ radians: Double) -> Double { radians * gonPerRadian }
    static func toDegrees(_ radians: Double) -> Double { radians * degreesPerRadian }
    static func toArcseconds(_ radians: Double) -> Double { radians * arcsecondsPerRadian }
    static func toArcminutes(_ radians: Double) -> Double { radians * arcsecondsPerRadian / 60.0 }

    // MARK: - Normalisation

    /// Maps any angle into `[0, 2π)`.
    static func normalized(_ angle: Double) -> Double {
        guard angle.isFinite else { return 0 }
        var r = angle.truncatingRemainder(dividingBy: fullCircle)
        if r < 0 { r += fullCircle }
        // `-1e-18 + 2π` rounds to exactly 2π in floating point; fold it back.
        return r >= fullCircle ? 0 : r
    }

    /// Maps any angle into `(-π, π]`. Used for incremental (delta) angles.
    static func wrappedToPi(_ angle: Double) -> Double {
        let n = normalized(angle)
        return n > .pi ? n - fullCircle : n
    }

    /// Snaps `value` to the nearest multiple of `step`.
    static func quantized(_ value: Double, step: Double) -> Double {
        guard step > 0 else { return value }
        return (value / step).rounded() * step
    }

    // MARK: - Directions

    /// Horizontal direction of `v`, clockwise from −Z seen from above, in `[0, 2π)`.
    ///
    ///     v = (0, 0, −1) → 0      (north / instrument front)
    ///     v = (1, 0,  0) → π/2    (east / to the right)
    static func azimuth(of v: SIMD3<Double>) -> Double {
        normalized(atan2(v.x, -v.z))
    }

    /// Zenith angle of `v` measured from +Y, in `[0, π]`.
    static func zenithAngle(of v: SIMD3<Double>) -> Double {
        let len = simd_length(v)
        guard len > 1e-12 else { return .pi / 2 }
        return acos(max(-1, min(1, v.y / len)))
    }

    // MARK: - Distance reductions

    /// Horizontal distance from a slope distance and zenith angle: `HD = SD · sin Z`.
    static func horizontalDistance(slope: Double, zenith: Double) -> Double {
        slope * sin(zenith)
    }

    /// Trigonometric height difference between the instrument's tilting axis
    /// and the target, reduced to ground marks: `ΔH = SD · cos Z + hi − ht`.
    static func heightDifference(slope: Double, zenith: Double,
                                 instrumentHeight: Double = 0, targetHeight: Double = 0) -> Double {
        slope * cos(zenith) + instrumentHeight - targetHeight
    }

    // MARK: - Tilt geometry
    //
    // A small tilt of a plate is represented by its height GRADIENT
    // g = (∂h/∂x, ∂h/∂z): the plate surface is h(x, z) = gₓ·x + g_z·z.
    // The gradient points towards the HIGH side of the plate — exactly where a
    // circular level's bubble migrates to — and |g| = tan(tilt angle).
    // Gradients add linearly, which makes combining the tripod-head tilt with
    // the foot-screw correction trivial.

    /// Height gradient of the plane through three points (e.g. foot-screw tips).
    static func tiltGradient(fromPlaneThrough p0: SIMD3<Double>, _ p1: SIMD3<Double>, _ p2: SIMD3<Double>) -> SIMD2<Double> {
        var n = simd_cross(p1 - p0, p2 - p0)
        if n.y < 0 { n = -n }
        guard abs(n.y) > 1e-12 else { return .zero }
        // Plane normal n ∝ (−gₓ, 1, −g_z)  ⇒  g = (−nₓ/n_y, −n_z/n_y)
        return SIMD2(-n.x / n.y, -n.z / n.y)
    }

    /// Tilt angle (radians) represented by a height gradient.
    static func tiltAngle(of gradient: SIMD2<Double>) -> Double {
        atan(simd_length(gradient))
    }

    /// Unit normal ("vertical axis") of a plate with the given height gradient.
    static func upVector(forGradient g: SIMD2<Double>) -> SIMD3<Double> {
        simd_normalize(SIMD3(-g.x, 1, -g.y))
    }

    /// Shortest-arc rotation that tilts +Y onto the plate normal.
    static func tiltRotation(forGradient g: SIMD2<Double>) -> simd_quatd {
        let up = upVector(forGradient: g)
        if simd_distance(up, SIMD3(0, 1, 0)) < 1e-12 {
            return simd_quatd(ix: 0, iy: 0, iz: 0, r: 1)
        }
        return simd_quatd(from: SIMD3(0, 1, 0), to: up)
    }

    /// Expresses a horizontal base-frame vector (x, z) in a frame rotated by
    /// `angle` about +Y (right-handed). Used to carry the level-bubble offset
    /// into the alidade frame of instruments whose vial rotates with the body.
    static func rotateIntoFrame(_ v: SIMD2<Double>, rotatedBy angle: Double) -> SIMD2<Double> {
        // Frame axes expressed in the base frame:
        //   X' = ( cos a, 0, −sin a),  Z' = (sin a, 0, cos a)
        let c = cos(angle), s = sin(angle)
        return SIMD2(v.x * c - v.y * s, v.x * s + v.y * c)
    }

    // MARK: - Formatting

    /// Formats an angle for instrument displays.
    static func format(_ angle: Double?, unit: AngleUnit, decimals: Int = 4) -> String {
        guard let angle, angle.isFinite else { return "----.----" }
        let a = normalized(angle)
        switch unit {
        case .gon:
            return String(format: "%.\(decimals)f", toGon(a))
        case .decimalDegrees:
            return String(format: "%.\(decimals)f°", toDegrees(a))
        case .dms:
            return formatDMS(a)
        }
    }

    /// `ddd°mm'ss"` with integer seconds and correct carry (59.6" → next minute).
    static func formatDMS(_ radians: Double) -> String {
        let totalSeconds = Int((toArcseconds(normalized(radians))).rounded()) % 1_296_000
        let d = totalSeconds / 3600
        let m = (totalSeconds % 3600) / 60
        let s = totalSeconds % 60
        return String(format: "%d°%02d'%02d\"", d, m, s)
    }

    /// Signed small angle (tilts, corrections) in arc seconds or mgon.
    static func formatSmallAngle(_ radians: Double, unit: AngleUnit) -> String {
        switch unit {
        case .gon: String(format: "%+.1f mgon", toGon(radians) * 1000)
        case .dms, .decimalDegrees: String(format: "%+.0f\"", toArcseconds(radians))
        }
    }

    static func formatDistance(_ metres: Double?) -> String {
        guard let metres, metres.isFinite else { return "--.---" }
        return String(format: "%.3f", metres)
    }
}
