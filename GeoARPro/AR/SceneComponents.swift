//
//  SceneComponents.swift
//  GeoAR Pro: Surveying Simulator
//
//  Custom RealityKit components, collision groups and entity helpers shared by
//  the model generator, hand tracking and optics services.
//

import Foundation
import RealityKit
import simd

/// Semantic identity of an interactive instrument part. Colliders carry an
/// `InteractivePartComponent` so raycasts can be mapped back to mechanics.
enum InstrumentPartKind: String, Sendable, CaseIterable {
    case alidade
    case telescope
    case horizontalTangent
    case verticalTangent
    case focusKnob
    case footScrew0
    case footScrew1
    case footScrew2
    case tripod
    case tripodLeg0
    case tripodLeg1
    case tripodLeg2
    case pole
    case levelingRod

    var displayName: String {
        switch self {
        case .alidade: "Alhidáda"
        case .telescope: "Dalekohled"
        case .horizontalTangent: "Hz ustanovka"
        case .verticalTangent: "V fine drive"
        case .focusKnob: "Ostření"
        case .footScrew0: "Stavěcí šroub A"
        case .footScrew1: "Stavěcí šroub B"
        case .footScrew2: "Stavěcí šroub C"
        case .tripod: "Stativ"
        case .tripodLeg0: "Noha stativu A"
        case .tripodLeg1: "Noha stativu B"
        case .tripodLeg2: "Noha stativu C"
        case .pole: "Výtyčka"
        case .levelingRod: "Nivelační lať"
        }
    }

    var footScrewIndex: Int? {
        switch self {
        case .footScrew0: 0
        case .footScrew1: 1
        case .footScrew2: 2
        default: nil
        }
    }

    var tripodLegIndex: Int? {
        switch self {
        case .tripodLeg0: 0
        case .tripodLeg1: 1
        case .tripodLeg2: 2
        default: nil
        }
    }

    static func tripodLeg(_ index: Int) -> InstrumentPartKind {
        [.tripodLeg0, .tripodLeg1, .tripodLeg2][index]
    }

    static func footScrew(_ index: Int) -> InstrumentPartKind {
        [.footScrew0, .footScrew1, .footScrew2][index]
    }

    /// Precision knobs are operated with a pinch; bodies with a direct touch.
    var requiresPinch: Bool {
        switch self {
        case .horizontalTangent, .verticalTangent, .focusKnob, .footScrew0, .footScrew1, .footScrew2,
             .tripodLeg0, .tripodLeg1, .tripodLeg2: true
        default: false
        }
    }

    /// Resolves overlapping colliders: small knobs win over large bodies.
    var pickPriority: Int {
        switch self {
        case .horizontalTangent, .verticalTangent, .focusKnob: 4
        case .footScrew0, .footScrew1, .footScrew2, .tripodLeg0, .tripodLeg1, .tripodLeg2: 3
        case .telescope: 2
        case .alidade, .pole: 1
        case .tripod, .levelingRod: 0
        }
    }

    var isKnob: Bool { requiresPinch }
}

struct InteractivePartComponent: Component {
    var kind: InstrumentPartKind
}

/// Marks the invisible collision sphere behind the eyepiece. The optics
/// service measures the device camera against this zone.
struct EyepieceZoneComponent: Component {
    var radius: Float = 0.04
}

/// Collision groups. Computed (not stored) statics keep Swift 6 strict
/// concurrency happy regardless of the SDK's Sendable annotations.
enum SceneCollisionGroups {
    /// Grabbable instrument parts (hand / touch raycasts).
    static var instrumentParts: CollisionGroup { CollisionGroup(rawValue: 1 << 20) }
    /// The eyepiece proximity zone.
    static var eyepieceZone: CollisionGroup { CollisionGroup(rawValue: 1 << 21) }
    /// Targets the EDM / telescope can measure to (levelling rods).
    static var surveyTargets: CollisionGroup { CollisionGroup(rawValue: 1 << 22) }
}

enum SceneComponentRegistry {
    @MainActor
    static func registerAll() {
        InteractivePartComponent.registerComponent()
        EyepieceZoneComponent.registerComponent()
    }
}

@MainActor
extension Entity {
    /// Walks up the hierarchy to find the interactive part this entity belongs to.
    func interactivePartKind() -> InstrumentPartKind? {
        var node: Entity? = self
        while let current = node {
            if let part = current.components[InteractivePartComponent.self] {
                return part.kind
            }
            node = current.parent
        }
        return nil
    }

    /// Adds an invisible collider child tagged with a part kind.
    @discardableResult
    func addPartCollider(_ kind: InstrumentPartKind, shapes: [ShapeResource],
                         group: CollisionGroup = SceneCollisionGroups.instrumentParts,
                         name: String? = nil) -> Entity {
        let collider = Entity()
        collider.name = name ?? "Collider.\(kind.rawValue)"
        collider.components.set(CollisionComponent(shapes: shapes, mode: .trigger,
                                                   filter: CollisionFilter(group: group, mask: .all)))
        collider.components.set(InteractivePartComponent(kind: kind))
        addChild(collider)
        return collider
    }
}

extension simd_quatf {
    static var identity: simd_quatf { simd_quatf(ix: 0, iy: 0, iz: 0, r: 1) }

    /// Rotates local +Y onto +Z (for lathe meshes that should run along Z).
    static var yToZ: simd_quatf { simd_quatf(angle: .pi / 2, axis: SIMD3(1, 0, 0)) }
    /// Rotates local +Y onto −Z (telescope bodies: profile runs towards the objective).
    static var yToMinusZ: simd_quatf { simd_quatf(angle: -.pi / 2, axis: SIMD3(1, 0, 0)) }
    /// Rotates local +Y onto +X (knobs whose axis is the instrument's X axis).
    static var yToX: simd_quatf { simd_quatf(angle: -.pi / 2, axis: SIMD3(0, 0, 1)) }

    init(_ q: simd_quatd) {
        self.init(vector: SIMD4<Float>(q.vector))
    }

    /// Orthonormal basis rotation whose local +Y is `yAxis` and local +X is as
    /// close as possible to `xHint`.
    static func basis(yAxis: SIMD3<Float>, xHint: SIMD3<Float>) -> simd_quatf {
        let y = simd_normalize(yAxis)
        var x = xHint - y * simd_dot(xHint, y)
        if simd_length_squared(x) < 1e-8 {
            x = abs(y.x) < 0.9 ? SIMD3(1, 0, 0) : SIMD3(0, 0, 1)
            x = x - y * simd_dot(x, y)
        }
        x = simd_normalize(x)
        let z = simd_cross(x, y)
        return simd_quatf(simd_float3x3(columns: (x, y, z)))
    }
}

extension SIMD4 where Scalar == Float {
    var xyz: SIMD3<Float> { SIMD3(x, y, z) }
}

extension SIMD3 where Scalar == Float {
    var double: SIMD3<Double> { SIMD3<Double>(Double(x), Double(y), Double(z)) }
}

extension SIMD3 where Scalar == Double {
    var float: SIMD3<Float> { SIMD3<Float>(Float(x), Float(y), Float(z)) }
}
