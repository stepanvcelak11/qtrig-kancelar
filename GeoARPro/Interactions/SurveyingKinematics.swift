//
//  SurveyingKinematics.swift
//  GeoAR Pro: Surveying Simulator
//
//  Mechanical constraint solver for tripod-mounted instruments and the GNSS
//  range pole. Pure value types (Foundation + simd only): the AR layer feeds
//  user intents in, reads the resulting state out and mirrors it onto the
//  RealityKit entity hierarchy.
//
//  Kinematic chain of a theodolite / total station (all frames right-handed,
//  +Y up, instrument front = −Z):
//
//      setup frame (gravity aligned, yaw = placement)
//        └─ R_tilt   tribrach upper plate, tilted by tripod head + foot screws
//            └─ R_y(α)   alidade rotation about the vertical axis (V-V)
//                └─ R_x(ε)   telescope rotation about the tilting axis (K-K)
//                    └─ line of sight  = (0, 0, −1)
//
//  Readings:
//    Hz_mech = normalise(−α + c)          (clockwise circle; c = circle orientation)
//    V_mech  = normalise(π/2 − ε)         (zenith angle; face II when > π)
//  With the dual-axis compensator active, the displayed values are those of
//  the TRUE (gravity-referenced) line of sight — equivalent to applying the
//  classic corrections  ΔV = −l  and  ΔHz = t · cot Z  for the longitudinal (l)
//  and transverse (t) tilt components, but exact for any tilt.
//

import Foundation
import simd

// MARK: - Configuration

struct InstrumentKinematicsConfig: Sendable, Equatable {
    var driveType: DriveType
    /// `false` for automatic levels: the telescope is fixed to the body.
    var allowsTelescopeTilt: Bool
    /// Elevation limits (radians). `nil` = telescope transits freely (total station).
    var elevationLimits: ClosedRange<Double>?
    /// Fine-drive transmission (radians of rotation per knob revolution).
    var horizontalFineDrivePerTurn: Double
    var verticalFineDrivePerTurn: Double
    /// Haptic detent pitch of the fine drives (0.01 gon).
    var detentStep: Double
    /// Angular encoder resolution used for displayed values (≈ 1″).
    var angularResolution: Double
    /// ± travel of a classic tangent screw (clampAndTangent only).
    var tangentTravel: Double
    /// Foot screw thread lead: vertical travel per revolution (metres).
    var footScrewLead: Double
    /// ± vertical travel of each foot screw (metres).
    var footScrewTravel: Double
    /// Radius of the foot-screw circle (metres).
    var footScrewRadius: Double
    /// Horizontal positions of the three foot screws, clockwise from the front (radians).
    var footScrewAzimuths: [Double]
    /// Working range of the compensator (radians).
    var compensatorRange: Double
    /// Circular level sensitivity (radians of tilt per metre of bubble travel).
    var circularLevelSensitivity: Double
    /// Maximum bubble travel inside the vial (metres).
    var vialRadius: Double
    /// Focus range (metres) and knob revolutions to sweep it.
    var focusRange: ClosedRange<Double>
    var focusTurnsForFullRange: Double
    /// `true` when the circular level sits on the rotating body (automatic levels).
    var bubbleRotatesWithAlidade: Bool
    /// Automatic level: compensator keeps the line of sight horizontal.
    var isAutomaticLevel: Bool

    static func make(for model: EquipmentModel) -> InstrumentKinematicsConfig {
        switch model.kind {
        case .totalStation(let s):
            return InstrumentKinematicsConfig(
                driveType: s.driveType,
                allowsTelescopeTilt: true,
                elevationLimits: nil,
                horizontalFineDrivePerTurn: GeodeticMath.gon(s.fineDriveGonPerTurn),
                verticalFineDrivePerTurn: GeodeticMath.gon(s.fineDriveGonPerTurn),
                detentStep: GeodeticMath.gon(0.01),
                angularResolution: GeodeticMath.arcseconds(1),
                tangentTravel: GeodeticMath.gon(3),
                footScrewLead: 0.0005,
                footScrewTravel: 0.005,
                footScrewRadius: 0.065,
                footScrewAzimuths: Self.tribrachScrewAzimuths,
                compensatorRange: GeodeticMath.arcminutes(s.compensatorRangeArcmin),
                circularLevelSensitivity: GeodeticMath.arcminutes(s.circularLevelArcminPer2mm) / 0.002,
                vialRadius: 0.0055,
                focusRange: s.minimumFocus...2000,
                focusTurnsForFullRange: 1.5,
                bubbleRotatesWithAlidade: false,
                isAutomaticLevel: false)
        case .opticalLevel(let s):
            return InstrumentKinematicsConfig(
                driveType: .endlessFriction,
                allowsTelescopeTilt: false,
                elevationLimits: 0...0,
                horizontalFineDrivePerTurn: GeodeticMath.gon(s.fineDriveGonPerTurn),
                verticalFineDrivePerTurn: 0,
                detentStep: GeodeticMath.gon(0.01),
                angularResolution: GeodeticMath.arcseconds(1),
                tangentTravel: 0,
                footScrewLead: 0.0005,
                footScrewTravel: 0.005,
                footScrewRadius: 0.055,
                footScrewAzimuths: Self.tribrachScrewAzimuths,
                compensatorRange: GeodeticMath.arcminutes(s.compensatorRangeArcmin),
                circularLevelSensitivity: GeodeticMath.arcminutes(s.circularLevelArcminPer2mm) / 0.002,
                vialRadius: 0.0055,
                focusRange: s.minimumFocus...500,
                focusTurnsForFullRange: 2,
                bubbleRotatesWithAlidade: true,
                isAutomaticLevel: true)
        default:
            preconditionFailure("Kinematics are only defined for telescope instruments")
        }
    }

    /// Screw 0 at the back (+Z), screws 1 and 2 front-left and front-right.
    static let tribrachScrewAzimuths: [Double] = [Double.pi, Double.pi * 5 / 3, Double.pi / 3]

    /// Position of foot screw `i` in the base frame (x, z).
    func footScrewPosition(_ i: Int) -> SIMD2<Double> {
        let a = footScrewAzimuths[i]
        // Azimuth measured clockwise from −Z:  x = R sin a,  z = −R cos a
        return SIMD2(footScrewRadius * sin(a), -footScrewRadius * cos(a))
    }
}

// MARK: - State

struct InstrumentKinematicState: Sendable, Equatable {
    /// Alidade rotation α about the vertical axis (radians, right-handed → CCW from above).
    var alidadeAngle: Double = 0
    /// Telescope elevation ε about the tilting axis (radians, + = objective up).
    var telescopeElevation: Double = 0
    /// Horizontal circle orientation c (radians): Hz = −α + c.
    var circleOrientation: Double = 0

    /// Alidade clamp (horizontal lock). Only meaningful for `.clampAndTangent`.
    var horizontalClampEngaged = false
    /// Telescope clamp (vertical lock).
    var verticalClampEngaged = false
    /// Limbus (circle) coupled to the alidade — "Hz HOLD": the reading does not
    /// change while the alidade turns. Used to transfer an orientation.
    var hzHold = false
    var compensatorEnabled = true

    /// Position of the classic tangent screws inside their travel (radians).
    var horizontalTangentPosition = 0.0
    var verticalTangentPosition = 0.0

    /// Continuous accumulators used to count detent crossings for haptics.
    var horizontalDetentAccumulator = 0.0
    var verticalDetentAccumulator = 0.0
    var footScrewDetentAccumulators: [Double] = [0, 0, 0]

    /// Foot screw heights relative to mid travel (metres) and knob revolutions.
    var footScrewHeights: [Double] = [0, 0, 0]
    var footScrewTurns: [Double] = [0, 0, 0]
    /// Visual knob revolutions of the fine drives / focus.
    var horizontalKnobTurns = 0.0
    var verticalKnobTurns = 0.0
    var focusKnobTurns = 0.0

    /// Height gradient of the tripod head (the "unlevelled setup").
    var setupTilt: SIMD2<Double> = .zero
    /// Current focus distance of the telescope (metres).
    var focusDistance = 20.0
}

/// Side effects of a kinematic operation, turned into haptics / toasts by the AR layer.
struct KinematicsFeedback: Sendable, Equatable {
    var detentTicks = 0
    var blockedByClamp = false
    var clampReleased = false
    var hitTravelLimit = false
    var levelStateChanged: LevelState?

    mutating func merge(_ other: KinematicsFeedback) {
        detentTicks += other.detentTicks
        blockedByClamp = blockedByClamp || other.blockedByClamp
        clampReleased = clampReleased || other.clampReleased
        hitTravelLimit = hitTravelLimit || other.hitTravelLimit
        if let s = other.levelStateChanged { levelStateChanged = s }
    }
}

// MARK: - Solver

struct SurveyingKinematics: Sendable, Equatable {
    var config: InstrumentKinematicsConfig
    var state: InstrumentKinematicState

    init(config: InstrumentKinematicsConfig, state: InstrumentKinematicState = InstrumentKinematicState()) {
        self.config = config
        self.state = state
    }

    // MARK: Horizontal rotation (alidade)

    /// Coarse rotation by hand (dragging the body).
    mutating func rotateAlidade(by delta: Double) -> KinematicsFeedback {
        var feedback = KinematicsFeedback()
        if config.driveType == .clampAndTangent && state.horizontalClampEngaged {
            // A clamped alidade cannot be turned by hand — the user must use the
            // tangent screw (or release the clamp).
            feedback.blockedByClamp = true
            return feedback
        }
        applyAlidadeRotation(delta)
        return feedback
    }

    /// Horizontal fine drive (tangent screw). Positive turns → clockwise → Hz increases.
    mutating func turnHorizontalTangent(turns: Double) -> KinematicsFeedback {
        var feedback = KinematicsFeedback()
        state.horizontalKnobTurns += turns
        var delta = -turns * config.horizontalFineDrivePerTurn

        if config.driveType == .clampAndTangent {
            guard state.horizontalClampEngaged else {
                // Without the clamp the tangent screw spins without effect.
                feedback.clampReleased = true
                return feedback
            }
            let target = state.horizontalTangentPosition + delta
            let limited = min(max(target, -config.tangentTravel), config.tangentTravel)
            if limited != target { feedback.hitTravelLimit = true }
            delta = limited - state.horizontalTangentPosition
            state.horizontalTangentPosition = limited
        }

        applyAlidadeRotation(delta)
        feedback.detentTicks = Self.detentCrossings(&state.horizontalDetentAccumulator, delta: delta, step: config.detentStep)
        return feedback
    }

    private mutating func applyAlidadeRotation(_ delta: Double) {
        state.alidadeAngle = GeodeticMath.wrappedToPi(state.alidadeAngle + delta)
        // Hz = −α + c. With the limbus coupled to the alidade (Hz hold) the
        // circle turns with it: c must follow so the reading stays constant.
        if state.hzHold {
            state.circleOrientation = GeodeticMath.normalized(state.circleOrientation + delta)
        }
    }

    // MARK: Vertical rotation (telescope)

    mutating func pitchTelescope(by delta: Double) -> KinematicsFeedback {
        var feedback = KinematicsFeedback()
        guard config.allowsTelescopeTilt else { return feedback }
        if config.driveType == .clampAndTangent && state.verticalClampEngaged {
            feedback.blockedByClamp = true
            return feedback
        }
        feedback.hitTravelLimit = !setElevation(state.telescopeElevation + delta)
        return feedback
    }

    /// Vertical fine drive. Positive turns → objective up (zenith angle decreases).
    mutating func turnVerticalTangent(turns: Double) -> KinematicsFeedback {
        var feedback = KinematicsFeedback()
        guard config.allowsTelescopeTilt else { return feedback }
        state.verticalKnobTurns += turns
        var delta = turns * config.verticalFineDrivePerTurn

        if config.driveType == .clampAndTangent {
            guard state.verticalClampEngaged else {
                feedback.clampReleased = true
                return feedback
            }
            let target = state.verticalTangentPosition + delta
            let limited = min(max(target, -config.tangentTravel), config.tangentTravel)
            if limited != target { feedback.hitTravelLimit = true }
            delta = limited - state.verticalTangentPosition
            state.verticalTangentPosition = limited
        }

        if !setElevation(state.telescopeElevation + delta) { feedback.hitTravelLimit = true }
        feedback.detentTicks = Self.detentCrossings(&state.verticalDetentAccumulator, delta: delta, step: config.detentStep)
        return feedback
    }

    /// Returns `false` when the requested elevation had to be limited.
    @discardableResult
    private mutating func setElevation(_ value: Double) -> Bool {
        guard let limits = config.elevationLimits else {
            // Total stations transit freely through the zenith (face change).
            state.telescopeElevation = GeodeticMath.wrappedToPi(value)
            return true
        }
        let limited = min(max(value, limits.lowerBound), limits.upperBound)
        state.telescopeElevation = limited
        return limited == value
    }

    // MARK: Clamps & circle

    mutating func setHorizontalClamp(_ engaged: Bool) {
        state.horizontalClampEngaged = engaged
        // Re-clamping re-centres the tangent screw in its travel.
        if engaged { state.horizontalTangentPosition = 0 }
    }

    mutating func setVerticalClamp(_ engaged: Bool) {
        state.verticalClampEngaged = engaged
        if engaged { state.verticalTangentPosition = 0 }
    }

    /// Orients the horizontal circle so that the current direction reads `value`.
    mutating func setHorizontalReading(_ value: Double) {
        let current = readings.hz ?? readings.mechanicalHz
        state.circleOrientation = GeodeticMath.normalized(state.circleOrientation + value - current)
    }

    // MARK: Tribrach foot screws

    /// Turns foot screw `index`. Positive turns raise the screw (that corner goes up,
    /// the bubble moves towards it — "the bubble follows the left thumb").
    mutating func turnFootScrew(_ index: Int, turns: Double) -> KinematicsFeedback {
        var feedback = KinematicsFeedback()
        guard state.footScrewHeights.indices.contains(index) else { return feedback }
        let before = levelState

        let current = state.footScrewHeights[index]
        let target = current + turns * config.footScrewLead
        let limited = min(max(target, -config.footScrewTravel), config.footScrewTravel)
        if limited != target { feedback.hitTravelLimit = true }
        let effectiveTurns = (limited - current) / config.footScrewLead
        state.footScrewHeights[index] = limited
        state.footScrewTurns[index] += effectiveTurns

        // One haptic detent every 1/16 revolution of the knurled knob.
        feedback.detentTicks = Self.detentCrossings(&state.footScrewDetentAccumulators[index],
                                                    delta: effectiveTurns, step: 1.0 / 16.0)
        let after = levelState
        if after != before { feedback.levelStateChanged = after }
        return feedback
    }

    // MARK: Focus

    /// Focus drive: logarithmic distance scale, like a real internal-focusing lens.
    mutating func turnFocus(turns: Double) {
        state.focusKnobTurns += turns
        let lo = log(config.focusRange.lowerBound), hi = log(config.focusRange.upperBound)
        let step = (hi - lo) / config.focusTurnsForFullRange
        let value = min(max(log(state.focusDistance) + turns * step, lo), hi)
        state.focusDistance = exp(value)
    }

    mutating func setFocusDistance(_ distance: Double) {
        state.focusDistance = min(max(distance, config.focusRange.lowerBound), config.focusRange.upperBound)
    }

    /// Defocus expressed as dioptre mismatch |1/d − 1/f| — proportional to the
    /// blur circle of a thin lens.
    func defocus(forTargetDistance distance: Double) -> Double {
        let d = max(distance, config.focusRange.lowerBound)
        return abs(1.0 / d - 1.0 / state.focusDistance)
    }

    // MARK: - Tilt

    /// Height gradient produced by the three foot screws alone.
    var footScrewGradient: SIMD2<Double> {
        let p = (0..<3).map { i -> SIMD3<Double> in
            let xz = config.footScrewPosition(i)
            return SIMD3(xz.x, state.footScrewHeights[i], xz.y)
        }
        return GeodeticMath.tiltGradient(fromPlaneThrough: p[0], p[1], p[2])
    }

    /// Mean screw height — the upper plate rises/falls by this amount.
    var footScrewMeanHeight: Double {
        state.footScrewHeights.reduce(0, +) / Double(max(state.footScrewHeights.count, 1))
    }

    /// Total gradient of the tribrach upper plate (tripod head + screws).
    var totalTilt: SIMD2<Double> { state.setupTilt + footScrewGradient }

    var tiltMagnitude: Double { GeodeticMath.tiltAngle(of: totalTilt) }

    var levelState: LevelState {
        let t = tiltMagnitude
        if t <= config.compensatorRange * 0.25 { return .leveled }
        if t <= config.compensatorRange { return .compensated }
        return .outOfRange
    }

    /// Offset of the circular-level bubble from the vial centre (metres, x/z of
    /// the frame carrying the vial). The bubble migrates to the HIGH side.
    var circularBubbleOffset: SIMD2<Double> {
        let g = totalTilt
        let len = simd_length(g)
        guard len > 1e-12 else { return .zero }
        var direction = g / len
        if config.bubbleRotatesWithAlidade {
            direction = GeodeticMath.rotateIntoFrame(direction, rotatedBy: state.alidadeAngle)
        }
        // Travel = tilt / sensitivity, stopped by the vial wall.
        let travel = min(atan(len) / config.circularLevelSensitivity, config.vialRadius)
        return direction * travel
    }

    // MARK: - Rotations & line of sight

    var levelingRotation: simd_quatd { GeodeticMath.tiltRotation(forGradient: totalTilt) }
    var setupRotation: simd_quatd { GeodeticMath.tiltRotation(forGradient: state.setupTilt) }
    var alidadeRotation: simd_quatd { simd_quatd(angle: state.alidadeAngle, axis: SIMD3(0, 1, 0)) }
    var telescopeRotation: simd_quatd { simd_quatd(angle: state.telescopeElevation, axis: SIMD3(1, 0, 0)) }

    /// Physical line of sight in the (gravity-aligned) setup frame.
    var physicalLineOfSight: SIMD3<Double> {
        (levelingRotation * alidadeRotation * telescopeRotation).act(SIMD3(0, 0, -1))
    }

    /// Line of sight used for measurements. An automatic level's pendulum
    /// compensator bends the optical path back to horizontal while in range.
    var measurementLineOfSight: SIMD3<Double> {
        let los = physicalLineOfSight
        guard config.isAutomaticLevel, state.compensatorEnabled, levelState != .outOfRange else { return los }
        let horizontal = SIMD3(los.x, 0, los.z)
        let len = simd_length(horizontal)
        return len > 1e-9 ? horizontal / len : los
    }

    // MARK: - Readings

    var readings: AngleReadings {
        let alpha = state.alidadeAngle
        let mechanicalV = GeodeticMath.normalized(.pi / 2 - state.telescopeElevation)
        let mechanicalHz = GeodeticMath.normalized(-alpha + state.circleOrientation)
        let face: TelescopeFace = mechanicalV > .pi ? .two : .one

        // Decompose the tilt into components along / across the line of sight
        // (electronic level display). The alidade front direction in the base
        // frame is R_y(α)·(0,0,−1) = (−sin α, −cos α); its right-hand side is
        // R_y(α)·(1,0,0) = (cos α, −sin α).
        let g = totalTilt
        let forward = SIMD2(-sin(alpha), -cos(alpha))
        let right = SIMD2(cos(alpha), -sin(alpha))
        let longitudinal = atan(simd_dot(g, forward))
        let transverse = atan(simd_dot(g, right))
        let level = levelState

        var hz: Double? = mechanicalHz
        var v: Double? = mechanicalV

        if state.compensatorEnabled {
            if level == .outOfRange {
                // Real instruments block measurements outside the compensator range.
                hz = nil
                v = nil
            } else if config.isAutomaticLevel {
                v = .pi / 2
                hz = GeodeticMath.normalized(GeodeticMath.azimuth(of: physicalLineOfSight) + state.circleOrientation)
            } else {
                // Exact compensation: read the true, gravity-referenced line of sight.
                let los = physicalLineOfSight
                let zenith = GeodeticMath.zenithAngle(of: los)
                v = face == .one ? zenith : GeodeticMath.fullCircle - zenith
                // In face II the line of sight points opposite to the alidade front.
                let azimuth = GeodeticMath.azimuth(of: los) - (face == .two ? .pi : 0)
                hz = GeodeticMath.normalized(azimuth + state.circleOrientation)
            }
        }

        return AngleReadings(
            hz: hz.map { GeodeticMath.quantized($0, step: config.angularResolution) },
            v: v.map { GeodeticMath.quantized($0, step: config.angularResolution) },
            mechanicalHz: mechanicalHz,
            mechanicalV: mechanicalV,
            face: face,
            tiltLongitudinal: longitudinal,
            tiltTransverse: transverse,
            tiltMagnitude: tiltMagnitude,
            levelState: level,
            compensatorEnabled: state.compensatorEnabled)
    }

    // MARK: - Helpers

    /// Number of detent boundaries crossed when `accumulator` moves by `delta`.
    static func detentCrossings(_ accumulator: inout Double, delta: Double, step: Double) -> Int {
        guard step > 0 else { return 0 }
        let before = (accumulator / step).rounded(.down)
        accumulator += delta
        let after = (accumulator / step).rounded(.down)
        return Int(abs(after - before))
    }

    /// Random, realistic "tripod roughly set up" head tilt (0.3°–1.2°).
    static func randomSetupTilt() -> SIMD2<Double> {
        let magnitude = tan(GeodeticMath.degrees(Double.random(in: 0.3...1.2)))
        let direction = Double.random(in: 0..<(2 * .pi))
        return SIMD2(cos(direction), sin(direction)) * magnitude
    }
}

// MARK: - GNSS range pole

/// Pole kinematics: the pole pivots about its tip on the ground mark.
struct PoleKinematics: Sendable, Equatable {
    var length: Double
    /// Unit vector from the tip towards the antenna (rover-local frame).
    var direction: SIMD3<Double> = SIMD3(0, 1, 0)
    var maximumTilt: Double = GeodeticMath.degrees(35)
    /// Pole circular level sensitivity: 20′/2 mm.
    var levelSensitivity: Double = GeodeticMath.arcminutes(20) / 0.002
    var vialRadius: Double = 0.006

    init(length: Double) {
        self.length = length
    }

    var tilt: Double { acos(max(-1, min(1, direction.y))) }

    /// Horizontal direction the pole top leans towards (clockwise from −Z).
    var tiltAzimuth: Double { GeodeticMath.azimuth(of: direction) }

    /// Antenna reference point relative to the tip (rover-local frame).
    var antennaReferencePoint: SIMD3<Double> { direction * length }

    /// Leans the pole so that it points at `target` (rover-local), limited to the maximum tilt.
    mutating func point(towards target: SIMD3<Double>) {
        var d = target
        if d.y < 0.05 { d.y = 0.05 }
        d = simd_normalize(d)
        let t = acos(max(-1, min(1, d.y)))
        if t > maximumTilt {
            let horizontal = simd_normalize(SIMD3(d.x, 0, d.z))
            d = horizontal * sin(maximumTilt) + SIMD3(0, cos(maximumTilt), 0)
        }
        direction = d
    }

    /// Bubble offset of the pole vial, in the pole's horizontal frame (x, z).
    var bubbleOffset: SIMD2<Double> {
        let h = SIMD2(direction.x, direction.z)
        let len = simd_length(h)
        guard len > 1e-9 else { return .zero }
        // The pole top leans towards h: the vial (fixed to the pole) is tilted so
        // its high side is opposite to the lean — the bubble moves away from it.
        let travel = min(tilt / levelSensitivity, vialRadius)
        return -h / len * travel
    }
}
