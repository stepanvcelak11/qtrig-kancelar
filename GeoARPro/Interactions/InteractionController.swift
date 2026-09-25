//
//  InteractionController.swift
//  GeoAR Pro: Surveying Simulator
//
//  Turns pointer samples (a tracked fingertip or a screen touch) into
//  kinematic intents:
//
//   • Direct touch on the telescope  → pitch about the tilting axis
//   • Direct touch / drag on the body → rotation about the vertical axis
//   • Pinch-and-twist on a fine drive → sub-degree tangent-screw turns
//   • Pinch-and-twist on a foot screw → tribrach levelling
//   • Grab on a range pole           → lean the pole about its tip
//
//  Angles are measured in world space whenever a 3-D point is available
//  (LiDAR fingertip or ray/plane intersection), so the part follows the
//  finger exactly; otherwise a screen-space gain is used.
//

import Foundation
import CoreGraphics
import RealityKit
import simd

struct PointerSample {
    enum Source { case hand, touch }

    var screenPoint: CGPoint
    var rayOrigin: SIMD3<Float>
    var rayDirection: SIMD3<Float>
    /// Fingertip world position (hand tracking with LiDAR depth).
    var fingertipWorld: SIMD3<Float>?
    /// Hand: pinch detected. Touch: finger down.
    var isGrabbing: Bool
    /// Screen-space roll of the pinch (hand only), unwrapped radians.
    var roll: Double?
    var source: Source
    var timestamp: TimeInterval
}

enum KinematicIntent {
    case rotateAlidade(Double)
    case pitchTelescope(Double)
    case turnHorizontalDrive(Double)
    case turnVerticalDrive(Double)
    case turnFootScrew(Int, Double)
    case turnFocus(Double)
    /// Lengthen (+) / shorten (−) a tripod leg by metres.
    case adjustLeg(Int, Double)
    /// Lean the range pole so it points at this world position.
    case aimPole(SIMD3<Float>)
}

/// Geometry of whatever is currently placed, in world space.
struct InteractionGeometry {
    var instrument: RigGeometry?
    /// Rover: pole tip (pivot) position.
    var poleTip: SIMD3<Float>?
}

struct InteractionOutcome {
    var hovered: InstrumentPartKind?
    var engaged: InstrumentPartKind?
    var intents: [KinematicIntent] = []
}

@MainActor
final class InteractionController {
    private struct Engagement {
        var kind: InstrumentPartKind
        var lastAngle: Double?
        var lastRoll: Double?
        var lastScreen: CGPoint
        var lastGrab: TimeInterval
        /// Distance along the ray at which the part was grabbed (touch/pole).
        var grabDistance: Float
    }

    private var engagement: Engagement?

    /// Fingertip must be within this distance of the virtual surface to "touch" it.
    let touchTolerance: Float = 0.05
    /// Short hand-tracking dropouts do not release a grab.
    let releaseGrace: TimeInterval = 0.25

    /// Screen gains for fallbacks (radians / revolutions per point).
    private let screenYawGain = 0.006
    private let screenPitchGain = 0.004
    private let touchTurnsPerPoint = 1.0 / 140.0
    private let pinchDragTurnsPerPoint = 1.0 / 320.0

    var engagedPart: InstrumentPartKind? { engagement?.kind }

    func cancel() {
        engagement = nil
    }

    // MARK: - Main entry point

    func process(_ p: PointerSample, scene: RealityKit.Scene, geometry: InteractionGeometry) -> InteractionOutcome {
        let hit = pick(p, scene: scene)
        var outcome = InteractionOutcome(hovered: hit?.kind, engaged: engagement?.kind)

        if var current = engagement {
            let stillGrabbing = isGrabbing(p, kind: current.kind, hit: hit, engaged: true)
            if stillGrabbing {
                // Resuming after a dropout: re-anchor instead of jumping.
                if p.timestamp - current.lastGrab > 0.12 {
                    current.lastAngle = nil
                    current.lastRoll = nil
                    current.lastScreen = p.screenPoint
                }
                current.lastGrab = p.timestamp
                outcome.intents = continueEngagement(&current, pointer: p, geometry: geometry)
                engagement = current
            } else if p.timestamp - current.lastGrab > releaseGrace || p.source == .touch {
                engagement = nil
            }
        } else if let hit, isGrabbing(p, kind: hit.kind, hit: hit, engaged: false) {
            var new = Engagement(kind: hit.kind, lastAngle: nil, lastRoll: p.roll, lastScreen: p.screenPoint,
                                 lastGrab: p.timestamp, grabDistance: hit.distance)
            // Prime the angle reference so the first move is relative.
            _ = continueEngagement(&new, pointer: p, geometry: geometry)
            engagement = new
        }

        outcome.engaged = engagement?.kind
        return outcome
    }

    /// Two-finger rotation gesture (touch mode) — turns knobs directly.
    func processRotation(delta: Double, at p: PointerSample, scene: RealityKit.Scene) -> [KinematicIntent] {
        let kind = engagement?.kind ?? pick(p, scene: scene)?.kind
        guard let kind else { return [] }
        return knobIntents(kind: kind, turns: delta / (2 * .pi))
    }

    // MARK: - Picking

    private struct Hit {
        var kind: InstrumentPartKind
        var distance: Float
        var position: SIMD3<Float>
    }

    /// Raycast against instrument colliders. When several colliders overlap
    /// (a knob sitting on a standard), the higher-priority part wins if it is
    /// within 4 cm of the nearest surface.
    private func pick(_ p: PointerSample, scene: RealityKit.Scene) -> Hit? {
        let hits = scene.raycast(origin: p.rayOrigin, direction: p.rayDirection, length: 8,
                                 query: .all, mask: SceneCollisionGroups.instrumentParts, relativeTo: nil)
        guard let nearest = hits.min(by: { $0.distance < $1.distance }) else { return nil }
        let candidates = hits
            .filter { $0.distance - nearest.distance < 0.04 }
            .compactMap { hit -> Hit? in
                hit.entity.interactivePartKind().map { Hit(kind: $0, distance: hit.distance, position: hit.position) }
            }
        return candidates.max { a, b in
            a.kind.pickPriority == b.kind.pickPriority ? a.distance > b.distance : a.kind.pickPriority < b.kind.pickPriority
        }
    }

    private func isGrabbing(_ p: PointerSample, kind: InstrumentPartKind, hit: Hit?, engaged: Bool) -> Bool {
        switch p.source {
        case .touch:
            return p.isGrabbing
        case .hand:
            if p.isGrabbing { return true }          // pinch always grabs
            if kind.requiresPinch { return false }   // knobs need a pinch
            // Direct touch: the LiDAR fingertip lies on (or slightly inside) the virtual surface.
            guard let tip = p.fingertipWorld else { return false }
            let tipDistance = simd_dot(tip - p.rayOrigin, p.rayDirection)
            if let hit, hit.kind == kind {
                return tipDistance > hit.distance - touchTolerance && tipDistance < hit.distance + 0.12
            }
            // While dragging, the finger may slide off the collider edge.
            return engaged && engagement.map { abs(tipDistance - $0.grabDistance) < 0.15 } == true
        }
    }

    // MARK: - Engagement

    private func continueEngagement(_ e: inout Engagement, pointer p: PointerSample,
                                    geometry: InteractionGeometry) -> [KinematicIntent] {
        defer { e.lastScreen = p.screenPoint }
        let dx = Double(p.screenPoint.x - e.lastScreen.x)
        let dy = Double(p.screenPoint.y - e.lastScreen.y)

        switch e.kind {
        case .alidade:
            guard let g = geometry.instrument else { return [] }
            // Rotation about the vertical axis measured against the NON-rotating
            // tribrach reference, so the body follows the finger around.
            if let angle = angle(of: p, around: g.verticalAxis, center: g.alidadeCenter, reference: g.baseForward) {
                defer { e.lastAngle = angle }
                guard let last = e.lastAngle else { return [] }
                return [.rotateAlidade(GeodeticMath.wrappedToPi(angle - last))]
            }
            return dx == 0 ? [] : [.rotateAlidade(-dx * screenYawGain)]

        case .telescope:
            guard let g = geometry.instrument else { return [] }
            // Pitch about the tilting axis, referenced to the alidade front
            // (which does not change while the telescope moves).
            if let angle = angle(of: p, around: g.trunnionAxis, center: g.trunnionCenter, reference: g.alidadeForward) {
                defer { e.lastAngle = angle }
                guard let last = e.lastAngle else { return [] }
                return [.pitchTelescope(GeodeticMath.wrappedToPi(angle - last))]
            }
            return dy == 0 ? [] : [.pitchTelescope(-dy * screenPitchGain)]

        case .horizontalTangent, .verticalTangent, .focusKnob, .footScrew0, .footScrew1, .footScrew2:
            var turns = 0.0
            switch p.source {
            case .hand:
                // Twisting the pinch = turning the knob; a small linear roll
                // component lets users "roll" the knob with the fingertip.
                if let roll = p.roll {
                    if let last = e.lastRoll { turns += (roll - last) / (2 * .pi) }
                    e.lastRoll = roll
                }
                turns += -dy * pinchDragTurnsPerPoint
            case .touch:
                turns = -dy * touchTurnsPerPoint
            }
            return turns == 0 ? [] : knobIntents(kind: e.kind, turns: turns)

        case .pole:
            guard let tip = geometry.poleTip else { return [] }
            if let point = p.fingertipWorld {
                return [.aimPole(point)]
            }
            // Keep the grabbed point at its grab distance along the new ray,
            // projected onto a sphere around the tip.
            let point = p.rayOrigin + p.rayDirection * e.grabDistance
            return simd_distance(point, tip) > 0.2 ? [.aimPole(point)] : []

        case .tripodLeg0, .tripodLeg1, .tripodLeg2:
            // Lift the leg clamp = longer leg (that side of the head rises), push down = shorter.
            let index = e.kind.tripodLegIndex ?? 0
            if let tip = p.fingertipWorld {
                defer { e.lastAngle = Double(tip.y) }
                guard let last = e.lastAngle else { return [] }
                return [.adjustLeg(index, Double(tip.y) - last)]
            }
            let metresPerPoint = p.source == .touch ? 0.0006 : 0.0008
            return dy == 0 ? [] : [.adjustLeg(index, -dy * metresPerPoint)]

        case .tripod, .levelingRod:
            return []
        }
    }

    private func knobIntents(kind: InstrumentPartKind, turns: Double) -> [KinematicIntent] {
        switch kind {
        case .horizontalTangent: [.turnHorizontalDrive(turns)]
        case .verticalTangent: [.turnVerticalDrive(turns)]
        case .focusKnob: [.turnFocus(turns)]
        case .footScrew0, .footScrew1, .footScrew2: [.turnFootScrew(kind.footScrewIndex ?? 0, turns)]
        default: []
        }
    }

    // MARK: - Geometry

    /// Signed angle of the pointer about `axis` through `center`.
    ///
    /// The pointer position P is the LiDAR fingertip when available, else the
    /// intersection of the pointer ray with the plane ⟂ axis through the
    /// centre (skipped when the ray grazes that plane). With d = P − C
    /// projected onto the plane:  angle = atan2(d · (a × r), d · r),
    /// which increases with a right-handed rotation about `a`.
    private func angle(of p: PointerSample, around axis: SIMD3<Float>, center: SIMD3<Float>,
                       reference: SIMD3<Float>) -> Double? {
        let a = simd_normalize(axis)
        var point: SIMD3<Float>?
        if let tip = p.fingertipWorld {
            point = tip
        } else {
            let denominator = simd_dot(p.rayDirection, a)
            if abs(denominator) > 0.18 {
                let t = simd_dot(center - p.rayOrigin, a) / denominator
                if t > 0 { point = p.rayOrigin + p.rayDirection * t }
            }
        }
        guard let point else { return nil }
        var d = point - center
        d -= a * simd_dot(d, a)
        guard simd_length(d) > 0.015 else { return nil } // too close to the axis → unstable
        let r = simd_normalize(reference - a * simd_dot(reference, a))
        let s = simd_cross(a, r)
        return Double(atan2(simd_dot(d, s), simd_dot(d, r)))
    }
}
