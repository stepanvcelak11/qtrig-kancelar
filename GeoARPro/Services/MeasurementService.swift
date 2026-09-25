//
//  MeasurementService.swift
//  GeoAR Pro: Surveying Simulator
//
//  Simulated EDM: casts the instrument's line of sight into the real world.
//  First choice is the LiDAR scene-reconstruction mesh (RealityKit collision
//  with `.sceneUnderstanding`) plus placed levelling rods; the fallback is an
//  ARKit estimated-plane raycast from an arbitrary origin.
//

import Foundation
import ARKit
import RealityKit
import simd

@MainActor
enum MeasurementService {
    struct Hit {
        var distance: Float
        var point: SIMD3<Float>
        var source: DistanceSource
        var entity: Entity?
    }

    static func castLineOfSight(from origin: SIMD3<Float>, direction: SIMD3<Float>,
                                in arView: ARView, maxRange: Float) -> Hit? {
        let mask = CollisionGroup.sceneUnderstanding.union(SceneCollisionGroups.surveyTargets)
        let hits = arView.scene.raycast(origin: origin, direction: direction, length: maxRange,
                                        query: .nearest, mask: mask, relativeTo: nil)
        if let hit = hits.first {
            let isRod = hit.entity.interactivePartKind() == .levelingRod
            return Hit(distance: hit.distance, point: hit.position,
                       source: isRod ? .levelingRod : .lidarMesh, entity: hit.entity)
        }

        let query = ARRaycastQuery(origin: origin, direction: direction, allowing: .estimatedPlane, alignment: .any)
        if let result = arView.session.raycast(query).first {
            let point = result.worldTransform.columns.3.xyz
            let distance = simd_distance(point, origin)
            if distance <= maxRange {
                return Hit(distance: distance, point: point, source: .estimatedPlane, entity: nil)
            }
        }
        return nil
    }

    /// Adds the instrument's stated EDM noise: σ = a [mm] + b [ppm]·D.
    static func edmNoise(distance: Double, constantMM: Double, ppm: Double) -> Double {
        let sigma = (constantMM + ppm * distance / 1000) / 1000
        return GNSSSimulator.gaussian() * sigma
    }

    /// Rod reading for a line of sight hitting a rod, with the stadia hairs
    /// placed at ±1/200 rad (stadia constant k = 100).
    static func rodReading(hitPoint: SIMD3<Float>, rod: RodRig, horizontalDistance: Double) -> RodReading {
        let middle = rod.reading(atWorld: hitPoint)
        let halfInterval = horizontalDistance / 200
        return RodReading(reading: middle, upperStadia: middle + halfInterval, lowerStadia: middle - halfInterval,
                          stadiaDistance: 100 * (2 * halfInterval))
    }
}
