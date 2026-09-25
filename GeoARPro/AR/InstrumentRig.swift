//
//  InstrumentRig.swift
//  GeoAR Pro: Surveying Simulator
//
//  Handles to the articulated entity hierarchies built by
//  `ProceduralModelGenerator`, and the code that mirrors kinematic state onto
//  them. Entity layout of a tripod-mounted instrument:
//
//      root  (tripod head top, gravity aligned, yaw = placement)
//       ├─ baseTiltNode        ← tripod-head tilt (setup gradient)
//       │    ├─ tribrach base plate
//       │    └─ footScrew[i]   ← height + knob rotation
//       └─ levelingNode        ← total tilt (head + foot screws), pivot at screw tips
//            ├─ upper plate, circular level (bubble)
//            └─ alidadePivot   ← R_y(α)
//                 ├─ standards, display, drives …
//                 └─ telescopePivot  ← R_x(ε)
//                      ├─ objective marker (−Z = line of sight)
//                      └─ eyepiece zone (collision sphere r = 4 cm)
//

import RealityKit
import simd
import UIKit

/// World-space geometry snapshot used by interactions and optics.
struct RigGeometry {
    /// Centre of the alidade on the vertical axis.
    var alidadeCenter: SIMD3<Float>
    /// Instrument vertical axis (tilted with the tribrach).
    var verticalAxis: SIMD3<Float>
    /// Non-rotating reference direction on the tribrach (its −Z).
    var baseForward: SIMD3<Float>
    /// Alidade front direction (−Z of the alidade).
    var alidadeForward: SIMD3<Float>
    var trunnionCenter: SIMD3<Float>
    var trunnionAxis: SIMD3<Float>
    var objectivePosition: SIMD3<Float>
    var eyepiecePosition: SIMD3<Float>
    /// Physical optical axis (from eyepiece towards objective).
    var opticalForward: SIMD3<Float>
}

@MainActor
final class InstrumentRig {
    let model: EquipmentModel
    let root = Entity()
    let baseTiltNode = Entity()
    let levelingNode = Entity()
    let alidadePivot = Entity()
    var telescopePivot: Entity?

    /// Knob entities that spin about their local X (drives) or Y (foot screws).
    var footScrews: [Entity] = []
    var footScrewRestHeight: Float = 0
    var horizontalDriveKnobs: [Entity] = []
    var verticalDriveKnob: Entity?
    var focusKnob: Entity?
    /// Rotation axis of the focus knob in its parent (Z for telescope rings, X for side knobs).
    var focusKnobAxis: SIMD3<Float> = SIMD3(0, 0, 1)

    var bubble: Entity?
    var bubbleRest: SIMD3<Float> = .zero
    /// Pivot height of the levelling node above the head (screw tips).
    var levelingPivotHeight: Float = 0

    var objective = Entity()
    var eyepiece = Entity()
    var display: DynamicDisplayTexture?

    /// Height of the tilting axis / line of sight above the tripod head (m).
    var opticalAxisHeight: Double = 0

    /// Named visual groups; USDZ overrides replace these.
    var visualGroups: [String: Entity] = [:]

    init(model: EquipmentModel) {
        self.model = model
        root.name = "Instrument.\(model.id)"
        baseTiltNode.name = "BaseTilt"
        levelingNode.name = "Leveling"
        alidadePivot.name = "AlidadePivot"
        root.addChild(baseTiltNode)
        root.addChild(levelingNode)
        levelingNode.addChild(alidadePivot)
    }

    /// Mirrors the solver state onto the entity transforms.
    func apply(_ k: SurveyingKinematics) {
        baseTiltNode.orientation = simd_quatf(k.setupRotation)

        // The upper plate rests on the three screw tips: it rises with their
        // mean height and tilts with the plane they define.
        levelingNode.position = SIMD3(0, levelingPivotHeight + Float(k.footScrewMeanHeight), 0)
        levelingNode.orientation = simd_quatf(k.levelingRotation)

        alidadePivot.orientation = simd_quatf(angle: Float(k.state.alidadeAngle), axis: SIMD3(0, 1, 0))
        telescopePivot?.orientation = simd_quatf(angle: Float(k.state.telescopeElevation), axis: SIMD3(1, 0, 0))

        for (i, screw) in footScrews.enumerated() where i < k.state.footScrewHeights.count {
            screw.position.y = footScrewRestHeight + Float(k.state.footScrewHeights[i])
            screw.orientation = simd_quatf(angle: -Float(k.state.footScrewTurns[i] * 2 * .pi), axis: SIMD3(0, 1, 0))
        }
        for knob in horizontalDriveKnobs {
            knob.orientation = simd_quatf(angle: Float(k.state.horizontalKnobTurns * 2 * .pi), axis: SIMD3(1, 0, 0))
        }
        verticalDriveKnob?.orientation = simd_quatf(angle: Float(k.state.verticalKnobTurns * 2 * .pi), axis: SIMD3(1, 0, 0))
        focusKnob?.orientation = simd_quatf(angle: Float(k.state.focusKnobTurns * 2 * .pi), axis: focusKnobAxis)

        if let bubble {
            let offset = k.circularBubbleOffset
            bubble.position = bubbleRest + SIMD3(Float(offset.x), 0, Float(offset.y))
        }
    }

    var geometry: RigGeometry {
        let opticalFrame = telescopePivot ?? alidadePivot
        let objectiveWorld = objective.position(relativeTo: nil)
        let eyepieceWorld = eyepiece.position(relativeTo: nil)
        return RigGeometry(
            alidadeCenter: alidadePivot.position(relativeTo: nil),
            verticalAxis: simd_normalize(alidadePivot.convert(direction: SIMD3(0, 1, 0), to: nil)),
            baseForward: simd_normalize(levelingNode.convert(direction: SIMD3(0, 0, -1), to: nil)),
            alidadeForward: simd_normalize(alidadePivot.convert(direction: SIMD3(0, 0, -1), to: nil)),
            trunnionCenter: opticalFrame.position(relativeTo: nil),
            trunnionAxis: simd_normalize(alidadePivot.convert(direction: SIMD3(1, 0, 0), to: nil)),
            objectivePosition: objectiveWorld,
            eyepiecePosition: eyepieceWorld,
            opticalForward: simd_normalize(objective.convert(direction: SIMD3(0, 0, -1), to: nil)))
    }
}

@MainActor
final class TripodRig {
    let root = Entity()
    let head = Entity()
    var headHeight: Float

    init(headHeight: Float) {
        self.headHeight = headHeight
        root.name = "Tripod"
        head.name = "TripodHead"
        head.position = SIMD3(0, headHeight, 0)
        root.addChild(head)
    }

    func apply(setupTilt: SIMD2<Double>) {
        head.orientation = simd_quatf(GeodeticMath.tiltRotation(forGradient: setupTilt))
    }
}

@MainActor
final class RoverRig {
    struct BipodLeg {
        let upper: Entity
        let lower: Entity
        /// Ground contact point in rover-root coordinates.
        let foot: SIMD3<Float>
    }

    let model: EquipmentModel
    let root = Entity()
    let poleNode = Entity()
    var antennaReferenceHeight: Float = 2.0
    var clampHeight: Float = 1.15
    var bipodLegs: [BipodLeg] = []
    var upperLegLength: Float = 0.8
    var lowerLegLength: Float = 0.75
    var leds: [(entity: ModelEntity, color: UIColorBox)] = []
    var bubble: Entity?
    var bubbleRest: SIMD3<Float> = .zero
    var tablet: DynamicDisplayTexture?

    init(model: EquipmentModel) {
        self.model = model
        root.name = "Rover.\(model.id)"
        poleNode.name = "Pole"
        root.addChild(poleNode)
    }

    func apply(_ pole: PoleKinematics) {
        let up = SIMD3<Float>(0, 1, 0)
        let dir = pole.direction.float
        poleNode.orientation = simd_distance(dir, up) < 1e-6 ? .identity : simd_quatf(from: up, to: dir)

        // Bipod: the upper tubes hang from the clamp on the pole, the lower
        // tubes stand on their fixed feet; the telescopic overlap absorbs the
        // changing distance as the pole leans.
        let clamp = dir * clampHeight
        for leg in bipodLegs {
            let toFoot = leg.foot - clamp
            let axis = simd_normalize(toFoot)
            let side = simd_normalize(simd_cross(axis, SIMD3(0, 1, 0)) + SIMD3(0, 0, 1e-4))
            // Upper tube: from the clamp downwards along the leg.
            leg.upper.position = clamp
            leg.upper.orientation = simd_quatf.basis(yAxis: -axis, xHint: side)
            // Lower tube: from the foot upwards.
            leg.lower.position = leg.foot
            leg.lower.orientation = simd_quatf.basis(yAxis: -axis, xHint: side)
        }

        if let bubble {
            let offset = pole.bubbleOffset
            bubble.position = bubbleRest + SIMD3(Float(offset.x), 0, Float(offset.y))
        }
    }

    func updateLEDs(time: TimeInterval, fix: GNSSFixType) {
        let library = MaterialLibrary.shared
        for (index, led) in leds.enumerated() {
            let on: Bool
            switch index {
            case 0: on = true                                            // power
            case 1: on = fix != .none && Int(time * 2) % 2 == 0          // satellite tracking blink
            case 2: on = fix == .rtkFixed || (fix == .rtkFloat && Int(time * 4) % 2 == 0) // RTK
            default: on = Int(time * 1.5) % 3 != 0                       // Bluetooth link
            }
            led.entity.model?.materials = [library.led(led.color.color, on: on)]
        }
    }

    var poleTipWorld: SIMD3<Float> { root.position(relativeTo: nil) }

    var antennaWorld: SIMD3<Float> {
        poleNode.convert(position: SIMD3(0, antennaReferenceHeight, 0), to: nil)
    }
}

@MainActor
final class RodRig {
    let root = Entity()
    let length: Float

    init(length: Float) {
        self.length = length
        root.name = "LevelingRod"
    }

    /// Reading (metres above the foot) of a world point on the rod face.
    func reading(atWorld point: SIMD3<Float>) -> Double {
        Double(root.convert(position: point, from: nil).y)
    }
}

/// Wrapper so UIKit colours can be stored in rig tuples without leaking UIKit
/// into call sites that only need RealityKit.
struct UIColorBox {
    let color: UIColor
}
