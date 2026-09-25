//
//  GNSSSimulator.swift
//  GeoAR Pro: Surveying Simulator
//
//  Lightweight RTK rover simulation: fix-state progression, satellite
//  geometry, precision estimates and position noise. The "true" position is
//  the AR world position of the pole tip, expressed in a local grid
//  (E = +X, N = −Z, H = +Y) with a false origin so numbers look like real
//  projected coordinates.
//

import Foundation
import simd

struct GNSSSimulator: Sendable {
    let spec: GNSSRoverSpec
    /// False origin of the local grid (easting, northing, height).
    var falseOrigin = SIMD3<Double>(1_000.000, 5_000.000, 250.000)
    private(set) var elapsed: TimeInterval = 0
    private var satellites = 24

    init(spec: GNSSRoverSpec) {
        self.spec = spec
    }

    mutating func reset() {
        elapsed = 0
    }

    /// Advances the simulation and returns the status for the current epoch.
    /// - Parameters:
    ///   - dt: time since the previous epoch (seconds).
    ///   - tipWorld: AR world position of the pole tip (the surveyed mark).
    ///   - antennaWorld: AR world position of the antenna reference point.
    ///   - tilt: pole tilt from the vertical (radians).
    ///   - tiltCompensationEnabled: IMU tilt compensation switched on.
    mutating func epoch(dt: TimeInterval, tipWorld: SIMD3<Double>, antennaWorld: SIMD3<Double>,
                        tilt: Double, tiltCompensationEnabled: Bool) -> GNSSStatus {
        elapsed += dt

        // Fix progression: autonomous → float → fixed (typical RTK init times).
        let fix: GNSSFixType
        let hrms: Double
        let vrms: Double
        switch elapsed {
        case ..<2: fix = .autonomous; hrms = 1.2; vrms = 2.1
        case ..<6: fix = .rtkFloat; hrms = 0.18; vrms = 0.32
        default: fix = .rtkFixed; hrms = spec.rtkHorizontalMM / 1000; vrms = spec.rtkVerticalMM / 1000
        }

        // Satellite count random-walks between 18 and 34 (multi-constellation).
        satellites = min(34, max(18, satellites + Int.random(in: -1...1)))
        let pdop = 1.1 + Double.random(in: 0...0.5) + (34 - Double(satellites)) * 0.03

        let tiltDegrees = GeodeticMath.toDegrees(tilt)
        let compensated = tiltCompensationEnabled && tiltDegrees <= spec.tiltCompensationMaxDegrees
        var extraHorizontal = 0.0
        let measured: SIMD3<Double>
        if compensated {
            // IMU tilt compensation reduces the antenna position to the tip.
            measured = tipWorld
            extraHorizontal = spec.tiltErrorMMPerDegree * tiltDegrees / 1000
        } else {
            // Without compensation the receiver assumes a plumb pole: the
            // reported mark is the antenna position minus the pole length.
            measured = antennaWorld - SIMD3(0, spec.poleLength, 0)
        }

        let h = hrms + extraHorizontal
        let noise = SIMD3(Self.gaussian() * h / sqrt(2), Self.gaussian() * vrms, Self.gaussian() * h / sqrt(2))
        let p = measured + noise

        return GNSSStatus(
            fix: fix,
            satellitesTracked: satellites + 6,
            satellitesUsed: satellites,
            pdop: pdop,
            hrms: h,
            vrms: vrms,
            northing: falseOrigin.y - p.z,
            easting: falseOrigin.x + p.x,
            height: falseOrigin.z + p.y,
            poleTilt: tilt,
            tiltCompensated: compensated,
            correctionAge: Double.random(in: 0.2...1.0))
    }

    /// Standard normal deviate (Box–Muller transform).
    static func gaussian() -> Double {
        let u1 = Double.random(in: Double.ulpOfOne..<1)
        let u2 = Double.random(in: 0..<1)
        return sqrt(-2 * log(u1)) * cos(2 * .pi * u2)
    }
}
