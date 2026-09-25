//
//  ProceduralModelGenerator.swift
//  GeoAR Pro: Surveying Simulator
//
//  Builds articulated, PBR-shaded equipment hierarchies entirely in code.
//  Dimensions follow the real instruments closely (metres): e.g. the TS16's
//  tilting axis sits 196 mm above the tribrach base, the GST20 head is a
//  ~200 mm rounded triangle, GNSS poles are 2.00 m with a 5/8" adapter.
//
//  If a USDZ asset named in the catalogue is bundled, its sub-entities named
//  "Tribrach", "TribrachUpper", "Alidade" and "Telescope" replace the
//  procedural visuals of the same group while all kinematic pivots, knobs and
//  colliders stay procedural (see `applyUSDZOverride`).
//

import Foundation
import RealityKit
import simd
import UIKit

@MainActor
final class ProceduralModelGenerator {
    private let lib = MaterialLibrary.shared

    // MARK: - Entity helpers

    @discardableResult
    private func add(_ mesh: MeshResource, _ material: any RealityKit.Material, _ name: String,
                     to parent: Entity, at position: SIMD3<Float> = .zero,
                     rotation: simd_quatf = .identity, scale: SIMD3<Float> = .one) -> ModelEntity {
        let entity = ModelEntity(mesh: mesh, materials: [material])
        entity.name = name
        entity.position = position
        entity.orientation = rotation
        entity.scale = scale
        parent.addChild(entity)
        return entity
    }

    private func node(_ name: String, in parent: Entity, at position: SIMD3<Float> = .zero,
                      rotation: simd_quatf = .identity) -> Entity {
        let entity = Entity()
        entity.name = name
        entity.position = position
        entity.orientation = rotation
        parent.addChild(entity)
        return entity
    }

    private func box(_ size: SIMD3<Float>, radius: Float = 0) -> MeshResource {
        MeshResource.generateBox(size: size, cornerRadius: radius)
    }

    /// Extruded text label; the text runs along local +X and faces +Z.
    @discardableResult
    private func label(_ text: String, size: Float, material: any RealityKit.Material,
                       in parent: Entity, at position: SIMD3<Float>, rotation: simd_quatf) -> ModelEntity {
        let mesh = MeshResource.generateText(text, extrusionDepth: size * 0.08,
                                             font: .systemFont(ofSize: CGFloat(size), weight: .heavy),
                                             containerFrame: .zero, alignment: .left, lineBreakMode: .byClipping)
        return add(mesh, material, "Label.\(text)", to: parent, at: position, rotation: rotation)
    }

    /// Azimuth (clockwise from −Z) → horizontal unit vector.
    private func horizontal(_ azimuth: Float) -> SIMD3<Float> {
        SIMD3(sin(azimuth), 0, -cos(azimuth))
    }

    // MARK: - Circular level

    /// Builds a circular level vial (housing, fluid, bubble, reference ring,
    /// glass). Returns the bubble entity and its rest position in `parent`.
    private func circularLevel(in parent: Entity, at position: SIMD3<Float>, radius: Float = 0.012) -> (Entity, SIMD3<Float>) {
        let vial = node("CircularLevel", in: parent, at: position)
        add(MeshFactory.tube(outerRadius: radius, innerRadius: radius * 0.8, height: 0.008),
            lib.anodizedAluminum(), "VialHousing", to: vial, at: SIMD3(0, 0.004, 0))
        add(MeshFactory.cylinder(radius: radius * 0.8, height: 0.002),
            lib.blackPlastic(), "VialFloor", to: vial, at: SIMD3(0, 0.001, 0))
        add(MeshFactory.cylinder(radius: radius * 0.8, height: 0.0045),
            lib.vialFluid(), "VialFluid", to: vial, at: SIMD3(0, 0.0045, 0))
        let rest = position + SIMD3(0, 0.0068, 0)
        let bubble = add(MeshResource.generateSphere(radius: 0.0022), lib.bubble(), "Bubble",
                         to: parent, at: rest, scale: SIMD3(1, 0.35, 1))
        add(MeshFactory.torus(majorRadius: 0.0029, minorRadius: 0.00022, segments: 32, sides: 8),
            lib.blackPlastic(), "VialReferenceRing", to: vial, at: SIMD3(0, 0.0076, 0))
        add(MeshFactory.lens(radius: radius * 0.82, sagitta: 0.0012, thickness: 0.0004),
            lib.vialGlass(), "VialGlass", to: vial, at: SIMD3(0, 0.0078, 0))
        return (bubble, rest)
    }

    // MARK: - Knob

    /// Knurled knob whose rotation axis is the parent's X axis. Returns the
    /// spinner entity (rotated about X by the rig).
    private func driveKnob(in parent: Entity, at position: SIMD3<Float>, radius: Float, width: Float,
                           kind: InstrumentPartKind, outward: Float) -> Entity {
        let spinner = node("Knob.\(kind.rawValue)", in: parent, at: position)
        // Lathe runs along +Y; rotate so its axis is X and it grows outward.
        let axis: simd_quatf = outward >= 0 ? .yToX : simd_quatf(angle: .pi / 2, axis: SIMD3(0, 0, 1))
        add(MeshFactory.cylinder(radius: radius, height: width, bevel: radius * 0.15),
            lib.rubberKnurl(), "Grip", to: spinner, rotation: axis)
        add(MeshFactory.cylinder(radius: radius * 0.6, height: 0.002, bevel: 0.0005),
            lib.anodizedAluminum(), "Cap", to: spinner, at: SIMD3(outward * (width / 2 + 0.001), 0, 0), rotation: axis)
        // Index mark so the rotation is visible.
        add(box(SIMD3(0.0008, radius * 0.5, 0.0015)), lib.unlit(.white), "IndexMark",
            to: spinner, at: SIMD3(outward * (width / 2 + 0.0022), radius * 0.3, 0))
        spinner.addPartCollider(kind, shapes: [.generateSphere(radius: max(radius * 1.7, 0.02))])
        return spinner
    }

    // MARK: - Tribrach

    private func buildTribrach(for rig: InstrumentRig, config: InstrumentKinematicsConfig,
                               palette: BrandPalette, plateRadius: Float, knobRadius: Float) {
        let dark = lib.anodizedAluminum()
        let lower = node("Tribrach", in: rig.baseTiltNode)
        rig.visualGroups["Tribrach"] = lower

        let outline = MeshFactory.roundedTriangleOutline(circumradius: plateRadius, cornerRadius: 0.02)
        add(MeshFactory.extrudedPolygon(outline, height: 0.009, name: "tribrachBase"), dark, "BasePlate",
            to: lower, at: SIMD3(0, 0.0045, 0))
        add(MeshFactory.cylinder(radius: 0.032, height: 0.004, bevel: 0.001), dark, "SpringPlate",
            to: lower, at: SIMD3(0, 0.011, 0))

        rig.footScrewRestHeight = 0.009
        for i in 0..<3 {
            let xz = config.footScrewPosition(i)
            let screw = node("FootScrew\(i)", in: rig.baseTiltNode,
                             at: SIMD3(Float(xz.x), rig.footScrewRestHeight, Float(xz.y)))
            add(MeshFactory.cylinder(radius: knobRadius, height: 0.012, bevel: 0.0016),
                lib.rubberKnurl(), "Knob", to: screw, at: SIMD3(0, 0.008, 0))
            add(MeshFactory.cylinder(radius: knobRadius * 0.55, height: 0.0025, bevel: 0.0005),
                dark, "KnobCap", to: screw, at: SIMD3(0, 0.0152, 0))
            add(box(SIMD3(0.001, 0.0005, knobRadius * 0.5)), lib.unlit(.white), "IndexMark",
                to: screw, at: SIMD3(0, 0.0166, -knobRadius * 0.3))
            add(MeshFactory.cylinder(radius: 0.0042, height: 0.03), lib.brushedSteel(), "Spindle",
                to: screw, at: SIMD3(0, 0.022, 0))
            screw.addPartCollider(.footScrew(i), shapes: [ShapeResource.generateSphere(radius: 0.021)
                .offsetBy(translation: SIMD3(0, 0.008, 0))])
            rig.footScrews.append(screw)
        }

        // Upper plate (carried by the screws) with locking lever and vial boss.
        rig.levelingPivotHeight = 0.032
        let upper = node("TribrachUpper", in: rig.levelingNode)
        rig.visualGroups["TribrachUpper"] = upper
        let upperOutline = MeshFactory.roundedTriangleOutline(circumradius: plateRadius * 0.93, cornerRadius: 0.022)
        add(MeshFactory.extrudedPolygon(upperOutline, height: 0.01, name: "tribrachUpper"),
            lib.coatedMetal(palette.trim, roughness: 0.5, metallic: 0.6), "UpperPlate", to: upper, at: SIMD3(0, 0.005, 0))

        let leverAzimuth: Float = 0
        add(box(SIMD3(0.012, 0.008, 0.03), radius: 0.003), lib.blackPlastic(), "LockingLever", to: upper,
            at: horizontal(leverAzimuth) * (plateRadius * 0.5) + SIMD3(0, 0.006, 0),
            rotation: simd_quatf(angle: -leverAzimuth, axis: SIMD3(0, 1, 0)))
    }

    /// Adds a vial boss to the tribrach upper plate and returns bubble + rest.
    private func tribrachVial(for rig: InstrumentRig, plateRadius: Float) {
        let azimuth: Float = .pi * 4 / 3   // left-back edge, between two screws
        let radial = horizontal(azimuth)
        guard let upper = rig.visualGroups["TribrachUpper"] else { return }
        add(box(SIMD3(0.026, 0.009, 0.05), radius: 0.004), lib.coatedMetal(rig.model.palette.trim, roughness: 0.5, metallic: 0.6),
            "VialBoss", to: upper, at: radial * (plateRadius * 0.62) + SIMD3(0, 0.0055, 0),
            rotation: simd_quatf(angle: -azimuth, axis: SIMD3(0, 1, 0)))
        let (bubble, rest) = circularLevel(in: rig.levelingNode, at: radial * (plateRadius * 0.86) + SIMD3(0, 0.01, 0))
        rig.bubble = bubble
        rig.bubbleRest = rest
    }

    // MARK: - Total station

    func makeTotalStation(_ model: EquipmentModel, spec: TotalStationSpec) -> InstrumentRig {
        let rig = InstrumentRig(model: model)
        let palette = model.palette
        let config = InstrumentKinematicsConfig.make(for: model)
        buildTribrach(for: rig, config: config, palette: palette, plateRadius: 0.088, knobRadius: 0.0145)
        tribrachVial(for: rig, plateRadius: 0.088)

        let bodyMaterial = lib.coatedMetal(palette.body)
        let trimMaterial = lib.coatedMetal(palette.trim, roughness: 0.55, metallic: 0.5)
        let accentMaterial = lib.coatedMetal(palette.accent, roughness: 0.4, metallic: 0.6)
        let dark = lib.anodizedAluminum()

        // Alidade pivot sits on the upper plate.
        rig.alidadePivot.position = SIMD3(0, 0.01, 0)
        let alidade = node("Alidade", in: rig.alidadePivot)
        rig.visualGroups["Alidade"] = alidade
        let pivotAboveHead: Float = rig.levelingPivotHeight + 0.01
        let trunnionY = Float(spec.trunnionHeight) - pivotAboveHead
        rig.opticalAxisHeight = spec.trunnionHeight

        // Horizontal-circle housing (lathe) and main body block.
        add(MeshFactory.lathe([SIMD2(0, 0), SIMD2(0.058, 0), SIMD2(0.061, 0.004), SIMD2(0.061, 0.022),
                               SIMD2(0.056, 0.028), SIMD2(0, 0.028)], name: "hzHousing"),
            dark, "HzCircleHousing", to: alidade)
        add(box(SIMD3(0.172, 0.05, 0.13), radius: 0.012), bodyMaterial, "BodyBlock", to: alidade, at: SIMD3(0, 0.053, 0))

        // Standards (uprights) carrying the tilting axis.
        for side: Float in [-1, 1] {
            add(box(SIMD3(0.03, 0.142, 0.106), radius: 0.011), bodyMaterial, "Standard\(side > 0 ? "R" : "L")",
                to: alidade, at: SIMD3(side * 0.075, 0.149, 0))
            add(MeshFactory.cylinder(radius: 0.02, height: 0.012, bevel: 0.002), dark, "TrunnionHub",
                to: alidade, at: SIMD3(side * 0.0555, trunnionY, 0), rotation: .yToX)
            add(box(SIMD3(0.002, 0.028, 0.092), radius: 0.001), accentMaterial, "BrandStripe",
                to: alidade, at: SIMD3(side * 0.0905, 0.205, 0))
            add(box(SIMD3(0.018, 0.03, 0.022), radius: 0.005), trimMaterial, "HandlePost",
                to: alidade, at: SIMD3(side * 0.07, 0.232, 0))
        }
        add(box(SIMD3(0.172, 0.016, 0.03), radius: 0.007), trimMaterial, "CarryHandle", to: alidade, at: SIMD3(0, 0.25, 0))

        // Battery compartment with latch on the left standard.
        add(box(SIMD3(0.01, 0.062, 0.074), radius: 0.003), trimMaterial, "BatteryDoor", to: alidade, at: SIMD3(-0.0955, 0.128, 0))
        add(box(SIMD3(0.004, 0.012, 0.022), radius: 0.001), accentMaterial, "BatteryLatch", to: alidade, at: SIMD3(-0.1015, 0.15, 0))

        // Brand lettering on the right standard.
        let labelMaterial = lib.coatedMetal(palette.label, roughness: 0.35, metallic: 0.1)
        label(model.manufacturer.shortName, size: 0.016, material: labelMaterial, in: alidade,
              at: SIMD3(0.0912, 0.162, 0.042), rotation: simd_quatf(angle: .pi / 2, axis: SIMD3(0, 1, 0)))
        label(model.name, size: 0.011, material: lib.coatedMetal(palette.trim, roughness: 0.4, metallic: 0.2), in: alidade,
              at: SIMD3(0.0912, 0.142, 0.042), rotation: simd_quatf(angle: .pi / 2, axis: SIMD3(0, 1, 0)))

        // Face-I keyboard / display unit on the operator side (+Z), tilted up.
        let displayUnit = node("DisplayUnit", in: alidade, at: SIMD3(0, 0.06, 0.077),
                               rotation: simd_quatf(angle: -0.35, axis: SIMD3(1, 0, 0)))
        add(box(SIMD3(0.15, 0.085, 0.028), radius: 0.008), lib.blackPlastic(), "Housing", to: displayUnit)
        let initialDisplay = DisplayContent(title: spec.displayName, status: "▮▮▮ ⌁", lines: [
            .init(label: "Hz", value: "---.----", unit: "g"),
            .init(label: "V", value: "---.----", unit: "g"),
            .init(label: "SD", value: "--.---", unit: "m"),
        ], style: .lcd)
        if let display = DynamicDisplayTexture(initial: initialDisplay) {
            rig.display = display
            add(MeshResource.generatePlane(width: 0.094, height: 0.047), lib.screen(display.texture), "LCD",
                to: displayUnit, at: SIMD3(0, 0.014, 0.0145))
        }
        let keyMaterial = lib.radomePlastic(RGBAColor(0.78, 0.79, 0.8))
        for row in 0..<2 {
            for col in 0..<6 {
                add(box(SIMD3(0.015, 0.008, 0.004), radius: 0.0015), keyMaterial, "Key", to: displayUnit,
                    at: SIMD3(-0.0525 + Float(col) * 0.021, -0.021 - Float(row) * 0.0125, 0.0145))
            }
        }

        // Endless drives on the right standard: Hz low, V at tilting-axis height.
        rig.horizontalDriveKnobs = [driveKnob(in: rig.alidadePivot, at: SIMD3(0.1, 0.098, 0.028), radius: 0.012,
                                              width: 0.016, kind: .horizontalTangent, outward: 1)]
        rig.verticalDriveKnob = driveKnob(in: rig.alidadePivot, at: SIMD3(0.1, trunnionY, 0.03), radius: 0.012,
                                          width: 0.016, kind: .verticalTangent, outward: 1)

        // Alidade colliders: lower body, both standards and the handle.
        rig.alidadePivot.addPartCollider(.alidade, shapes: [
            ShapeResource.generateBox(size: SIMD3(0.172, 0.08, 0.15)).offsetBy(translation: SIMD3(0, 0.045, 0.01)),
            ShapeResource.generateBox(size: SIMD3(0.034, 0.145, 0.11)).offsetBy(translation: SIMD3(-0.075, 0.15, 0)),
            ShapeResource.generateBox(size: SIMD3(0.034, 0.145, 0.11)).offsetBy(translation: SIMD3(0.075, 0.15, 0)),
            ShapeResource.generateBox(size: SIMD3(0.172, 0.03, 0.035)).offsetBy(translation: SIMD3(0, 0.245, 0)),
        ])

        buildTotalStationTelescope(rig: rig, trunnionY: trunnionY, palette: palette, bodyMaterial: bodyMaterial)
        applyUSDZOverride(to: rig)
        return rig
    }

    private func buildTotalStationTelescope(rig: InstrumentRig, trunnionY: Float, palette: BrandPalette,
                                            bodyMaterial: PhysicallyBasedMaterial) {
        let pivot = node("TelescopePivot", in: rig.alidadePivot, at: SIMD3(0, trunnionY, 0))
        rig.telescopePivot = pivot
        let telescope = node("Telescope", in: pivot)
        rig.visualGroups["Telescope"] = telescope
        let dark = lib.anodizedAluminum()

        // Central block between the standards (houses EDM / ATR electronics).
        add(box(SIMD3(0.104, 0.074, 0.09), radius: 0.014), bodyMaterial, "TelescopeBlock", to: telescope)

        // Optical tube: lathe profile along +Y, rotated so +Y → −Z (objective forward).
        let tube = node("OpticalTube", in: telescope, rotation: .yToMinusZ)
        add(MeshFactory.lathe([SIMD2(0, -0.062), SIMD2(0.021, -0.062), SIMD2(0.023, -0.058), SIMD2(0.024, -0.045),
                               SIMD2(0.029, -0.04), SIMD2(0.030, 0.045), SIMD2(0.033, 0.05), SIMD2(0.034, 0.084),
                               SIMD2(0.0355, 0.088), SIMD2(0.031, 0.088), SIMD2(0.031, 0.083)],
                              segments: 56, name: "telescopeBarrel"),
            dark, "Barrel", to: tube)
        // Objective: multi-coated doublet with the coaxial EDM transmitter in its centre.
        add(MeshFactory.lens(radius: 0.031, sagitta: 0.003, thickness: 0.002), lib.opticalGlass(), "ObjectiveLens",
            to: tube, at: SIMD3(0, 0.081, 0))
        add(MeshFactory.cylinder(radius: 0.0075, height: 0.003, bevel: 0.0005), lib.blackPlastic(), "EDMTransmitter",
            to: tube, at: SIMD3(0, 0.0855, 0))
        add(MeshFactory.torus(majorRadius: 0.0325, minorRadius: 0.0012), lib.coatedMetal(palette.accent, roughness: 0.3, metallic: 0.7),
            "ObjectiveRing", to: tube, at: SIMD3(0, 0.07, 0))
        // Reticle assembly (graticule cell) and eyepiece.
        add(MeshFactory.torus(majorRadius: 0.0105, minorRadius: 0.0015), dark, "ReticleAssembly", to: tube, at: SIMD3(0, -0.066, 0))
        add(MeshFactory.cylinder(radius: 0.012, height: 0.022, bevel: 0.001), dark, "EyepieceTube", to: tube, at: SIMD3(0, -0.073, 0))
        add(MeshFactory.tube(outerRadius: 0.0165, innerRadius: 0.0095, height: 0.014), lib.rubberKnurl(), "EyeCup",
            to: tube, at: SIMD3(0, -0.091, 0))
        add(MeshFactory.lens(radius: 0.0095, sagitta: 0.001, thickness: 0.001), lib.opticalGlass(opacity: 0.5), "EyepieceLens",
            to: tube, at: SIMD3(0, -0.092, 0), rotation: simd_quatf(angle: .pi, axis: SIMD3(1, 0, 0)))

        // Focus ring (spins about the optical axis).
        let focus = node("FocusRing", in: pivot, at: SIMD3(0, 0, 0.052))
        add(MeshFactory.cylinder(radius: 0.0268, height: 0.016, bevel: 0.002), lib.rubberKnurl(), "FocusGrip",
            to: focus, rotation: .yToZ)
        focus.addPartCollider(.focusKnob, shapes: [ShapeResource.generateSphere(radius: 0.026)])
        rig.focusKnob = focus
        rig.focusKnobAxis = SIMD3(0, 0, 1)

        // Collimator (peep sight) on top of the block.
        add(box(SIMD3(0.011, 0.012, 0.07), radius: 0.003), lib.blackPlastic(), "Collimator", to: telescope, at: SIMD3(0, 0.043, 0))
        add(MeshResource.generateSphere(radius: 0.0022), lib.unlit(.white), "CollimatorBead", to: telescope, at: SIMD3(0, 0.05, -0.034))

        // Line-of-sight marker at the objective and the eyepiece proximity zone.
        rig.objective = node("Objective", in: pivot, at: SIMD3(0, 0, -0.09))
        rig.eyepiece = makeEyepieceZone(in: pivot, at: SIMD3(0, 0, 0.1))

        pivot.addPartCollider(.telescope, shapes: [
            ShapeResource.generateCapsule(height: 0.2, radius: 0.037).offsetBy(rotation: .yToZ, translation: .zero),
            ShapeResource.generateBox(size: SIMD3(0.104, 0.074, 0.09)),
        ])
    }

    private func makeEyepieceZone(in parent: Entity, at position: SIMD3<Float>) -> Entity {
        let zone = node("EyepieceZone", in: parent, at: position)
        let component = EyepieceZoneComponent(radius: 0.04)
        zone.components.set(component)
        zone.components.set(CollisionComponent(
            shapes: [.generateSphere(radius: component.radius)], mode: .trigger,
            filter: CollisionFilter(group: SceneCollisionGroups.eyepieceZone, mask: .all)))
        return zone
    }

    // MARK: - Automatic level

    func makeOpticalLevel(_ model: EquipmentModel, spec: OpticalLevelSpec) -> InstrumentRig {
        let rig = InstrumentRig(model: model)
        let palette = model.palette
        let config = InstrumentKinematicsConfig.make(for: model)
        buildTribrach(for: rig, config: config, palette: palette, plateRadius: 0.075, knobRadius: 0.0125)

        let bodyMaterial = lib.coatedMetal(palette.body)
        let trimMaterial = lib.coatedMetal(palette.trim, roughness: 0.55, metallic: 0.5)
        let dark = lib.anodizedAluminum()

        rig.alidadePivot.position = SIMD3(0, 0.01, 0)
        let body = node("Alidade", in: rig.alidadePivot)
        rig.visualGroups["Alidade"] = body
        let pivotAboveHead = rig.levelingPivotHeight + 0.01
        let losY = Float(spec.lineOfSightHeight) - pivotAboveHead
        rig.opticalAxisHeight = spec.lineOfSightHeight

        // Graduated horizontal circle.
        add(MeshFactory.cylinder(radius: 0.058, height: 0.012, bevel: 0.0015), dark, "HzCircle", to: body, at: SIMD3(0, 0.006, 0))
        add(MeshFactory.tube(outerRadius: 0.0588, innerRadius: 0.05, height: 0.004), lib.radomePlastic(RGBAColor(0.85, 0.85, 0.83)),
            "CircleGraduation", to: body, at: SIMD3(0, 0.009, 0))

        // Main housing with rounded top cover.
        add(box(SIMD3(0.076, 0.062, 0.16), radius: 0.02), bodyMaterial, "Housing", to: body, at: SIMD3(0, 0.045, 0))
        add(box(SIMD3(0.066, 0.02, 0.14), radius: 0.009), bodyMaterial, "TopCover", to: body, at: SIMD3(0, 0.08, 0))
        add(box(SIMD3(0.078, 0.006, 0.12), radius: 0.002), trimMaterial, "Seam", to: body, at: SIMD3(0, 0.03, 0))

        // Telescope: objective barrel forward, eyepiece aft (profile runs toward −Z).
        let tube = node("OpticalTube", in: body, at: SIMD3(0, losY, 0), rotation: .yToMinusZ)
        add(MeshFactory.lathe([SIMD2(0, 0.07), SIMD2(0.026, 0.07), SIMD2(0.028, 0.1), SIMD2(0.029, 0.118),
                               SIMD2(0.0305, 0.122), SIMD2(0.026, 0.122), SIMD2(0.026, 0.117)], name: "levelObjective"),
            dark, "ObjectiveBarrel", to: tube)
        add(MeshFactory.lens(radius: 0.026, sagitta: 0.0025, thickness: 0.002), lib.opticalGlass(), "ObjectiveLens",
            to: tube, at: SIMD3(0, 0.116, 0))
        add(MeshFactory.cylinder(radius: 0.013, height: 0.03, bevel: 0.001), dark, "EyepieceTube", to: tube, at: SIMD3(0, -0.092, 0))
        add(MeshFactory.tube(outerRadius: 0.0165, innerRadius: 0.0095, height: 0.014), lib.rubberKnurl(), "EyeCup",
            to: tube, at: SIMD3(0, -0.112, 0))
        add(MeshFactory.lens(radius: 0.0095, sagitta: 0.001, thickness: 0.001), lib.opticalGlass(opacity: 0.5), "EyepieceLens",
            to: tube, at: SIMD3(0, -0.113, 0), rotation: simd_quatf(angle: .pi, axis: SIMD3(1, 0, 0)))

        // Focus knob on the right side (axis X), endless drives on both sides.
        let focus = driveKnob(in: rig.alidadePivot, at: SIMD3(0.047, losY - 0.005, -0.035), radius: 0.015,
                              width: 0.014, kind: .focusKnob, outward: 1)
        rig.focusKnob = focus
        rig.focusKnobAxis = SIMD3(1, 0, 0)
        rig.horizontalDriveKnobs = [
            driveKnob(in: rig.alidadePivot, at: SIMD3(0.046, 0.026, 0.05), radius: 0.011, width: 0.012,
                      kind: .horizontalTangent, outward: 1),
            driveKnob(in: rig.alidadePivot, at: SIMD3(-0.046, 0.026, 0.05), radius: 0.011, width: 0.012,
                      kind: .horizontalTangent, outward: -1),
        ]

        // Circular level on top (viewed via the mirror prism) + gun sight.
        let (bubble, rest) = circularLevel(in: rig.alidadePivot, at: SIMD3(0.0, 0.09, 0.045), radius: 0.013)
        rig.bubble = bubble
        rig.bubbleRest = rest
        add(box(SIMD3(0.02, 0.014, 0.012), radius: 0.002), lib.blackPlastic(), "MirrorPrism", to: body,
            at: SIMD3(0, 0.1, 0.062), rotation: simd_quatf(angle: -0.6, axis: SIMD3(1, 0, 0)))
        add(box(SIMD3(0.007, 0.01, 0.05), radius: 0.002), lib.blackPlastic(), "GunSight", to: body, at: SIMD3(0, 0.095, -0.03))

        let labelMaterial = lib.coatedMetal(palette.label, roughness: 0.35, metallic: 0.1)
        label(model.manufacturer.shortName, size: 0.013, material: labelMaterial, in: body,
              at: SIMD3(-0.0385, 0.05, -0.03), rotation: simd_quatf(angle: -.pi / 2, axis: SIMD3(0, 1, 0)))

        rig.objective = node("Objective", in: rig.alidadePivot, at: SIMD3(0, losY, -0.125))
        rig.eyepiece = makeEyepieceZone(in: rig.alidadePivot, at: SIMD3(0, losY, 0.13))

        rig.alidadePivot.addPartCollider(.alidade, shapes: [
            ShapeResource.generateBox(size: SIMD3(0.08, 0.095, 0.26)).offsetBy(translation: SIMD3(0, 0.05, 0)),
        ])

        applyUSDZOverride(to: rig)
        return rig
    }

    // MARK: - Tripod

    func makeTripod(headHeight: Float) -> TripodRig {
        let rig = TripodRig(headHeight: headHeight)
        let wood = lib.varnishedWood()
        let hardware = lib.yellowHardware()
        let steel = lib.brushedSteel()
        let dark = lib.anodizedAluminum()
        let legAzimuths: [Float] = [0, .pi * 2 / 3, .pi * 4 / 3]

        // Head: rounded aluminium triangle, 5/8" centring screw underneath.
        let outline = MeshFactory.roundedTriangleOutline(circumradius: 0.105, cornerRadius: 0.028, cornerAzimuths: legAzimuths)
        add(MeshFactory.extrudedPolygon(outline, height: 0.024, name: "tripodHead"), dark, "HeadPlate",
            to: rig.head, at: SIMD3(0, -0.012, 0))
        add(MeshFactory.torus(majorRadius: 0.04, minorRadius: 0.0015), steel, "HeadRing", to: rig.head, at: SIMD3(0, 0.0003, 0))
        add(MeshFactory.cylinder(radius: 0.0079, height: 0.035), steel, "CentringThread", to: rig.head, at: SIMD3(0, -0.03, 0))
        add(MeshFactory.cylinder(radius: 0.027, height: 0.018, bevel: 0.004), lib.rubberKnurl(), "CentringKnob",
            to: rig.head, at: SIMD3(0, -0.055, 0))
        add(MeshFactory.frustum(bottomRadius: 0.012, topRadius: 0.022, height: 0.012), lib.blackPlastic(), "CentringCone",
            to: rig.head, at: SIMD3(0, -0.048, 0))

        let footRadius: Float = 0.33 + 0.19 * headHeight
        for (i, azimuth) in legAzimuths.enumerated() {
            let radial = horizontal(azimuth)
            let tangent = SIMD3<Float>(cos(azimuth), 0, sin(azimuth))
            let hinge = radial * 0.093 + SIMD3(0, headHeight - 0.03, 0)
            let foot = radial * footRadius
            let length = simd_distance(hinge, foot)

            // Hinge on the head.
            add(MeshFactory.cylinder(radius: 0.011, height: 0.06, bevel: 0.002), hardware, "Hinge\(i)", to: rig.root,
                at: hinge + SIMD3(0, 0.006, 0), rotation: simd_quatf.basis(yAxis: tangent, xHint: SIMD3(0, 1, 0)))

            let leg = node("Leg\(i)", in: rig.root, at: hinge,
                           rotation: simd_quatf.basis(yAxis: simd_normalize(hinge - foot), xHint: tangent))
            let upperLength = length * 0.58
            add(box(SIMD3(0.05, 0.036, 0.032), radius: 0.004), hardware, "HingeBlock", to: leg, at: SIMD3(0, -0.012, 0))
            let upperWood = lib.varnishedWood(lengthRepeat: upperLength * 3)
            for side: Float in [-1, 1] {
                add(box(SIMD3(0.026, upperLength, 0.02), radius: 0.004), upperWood, "UpperBar", to: leg,
                    at: SIMD3(side * 0.021, -0.03 - upperLength / 2, 0))
            }
            let clampY = -0.03 - upperLength + 0.02
            add(box(SIMD3(0.072, 0.05, 0.033), radius: 0.005), hardware, "LegClamp", to: leg, at: SIMD3(0, clampY, 0))
            add(MeshFactory.cylinder(radius: 0.0055, height: 0.03), steel, "ClampScrew", to: leg,
                at: SIMD3(0, clampY, 0.03), rotation: .yToZ)
            add(box(SIMD3(0.034, 0.012, 0.005), radius: 0.002), lib.blackPlastic(), "WingNut", to: leg, at: SIMD3(0, clampY, 0.046))

            let lowerTop = -0.03 - upperLength + 0.16
            let lowerBottom = -(length - 0.1)
            let lowerLength = lowerTop - lowerBottom
            add(box(SIMD3(0.022, lowerLength, 0.017), radius: 0.003), wood, "LowerBar", to: leg,
                at: SIMD3(0, (lowerTop + lowerBottom) / 2, 0))

            add(box(SIMD3(0.028, 0.075, 0.022), radius: 0.003), steel, "Shoe", to: leg, at: SIMD3(0, -(length - 0.0725), 0))
            add(box(SIMD3(0.045, 0.005, 0.03), radius: 0.001), steel, "FootStep", to: leg, at: SIMD3(0.03, -(length - 0.06), 0))
            add(MeshFactory.frustum(bottomRadius: 0.011, topRadius: 0.0006, height: 0.035), steel, "Spike", to: leg,
                at: SIMD3(0, -(length - 0.035), 0), rotation: simd_quatf(angle: .pi, axis: SIMD3(1, 0, 0)))

            leg.addPartCollider(.tripod, shapes: [ShapeResource.generateCapsule(height: length, radius: 0.03)
                .offsetBy(translation: SIMD3(0, -length / 2, 0))])
        }
        return rig
    }

    // MARK: - GNSS rover

    func makeGNSSRover(_ model: EquipmentModel, spec: GNSSRoverSpec) -> RoverRig {
        let rig = RoverRig(model: model)
        let palette = model.palette
        let pole = rig.poleNode
        let length = Float(spec.poleLength)
        let steel = lib.brushedSteel()
        let dark = lib.anodizedAluminum()
        let silver = lib.anodizedAluminum(RGBAColor(0.62, 0.63, 0.65))

        // Pole: steel tip, carbon-fibre tube, snap-lock rings, 5/8" adapter.
        add(MeshFactory.lathe([SIMD2(0, 0), SIMD2(0.0035, 0.01), SIMD2(0.008, 0.035), SIMD2(0.0125, 0.06),
                               SIMD2(0.0125, 0.075), SIMD2(0, 0.075)], name: "poleTip"),
            steel, "Tip", to: pole)
        let tubeLength = length - 0.08
        add(MeshFactory.cylinder(radius: 0.0125, height: tubeLength, segments: 32), lib.carbonFiber(), "CarbonTube",
            to: pole, at: SIMD3(0, 0.075 + tubeLength / 2, 0))
        for y: Float in [0.72, 1.42] {
            add(MeshFactory.cylinder(radius: 0.0148, height: 0.032, bevel: 0.002), dark, "SnapLock", to: pole, at: SIMD3(0, y, 0))
            add(box(SIMD3(0.008, 0.026, 0.006), radius: 0.002), lib.coatedMetal(palette.accent), "SnapLever",
                to: pole, at: SIMD3(0.016, y, 0))
        }
        add(MeshFactory.cylinder(radius: 0.0095, height: 0.018), steel, "Adapter", to: pole, at: SIMD3(0, length + 0.004, 0))

        // Bipod clamp.
        add(box(SIMD3(0.048, 0.05, 0.042), radius: 0.008), dark, "BipodClamp", to: pole, at: SIMD3(0, rig.clampHeight, 0))
        add(MeshFactory.cylinder(radius: 0.009, height: 0.02, bevel: 0.002), lib.rubberKnurl(), "ClampKnob",
            to: pole, at: SIMD3(0, rig.clampHeight, 0.03), rotation: .yToZ)

        // Pole circular level on a small bracket.
        add(box(SIMD3(0.03, 0.01, 0.02), radius: 0.002), dark, "VialBracket", to: pole, at: SIMD3(0.022, 1.52, 0))
        let (bubble, rest) = circularLevel(in: pole, at: SIMD3(0.04, 1.525, 0), radius: 0.012)
        rig.bubble = bubble
        rig.bubbleRest = rest

        // Controller bracket holding the field tablet (screen faces the operator, +Z).
        add(box(SIMD3(0.014, 0.014, 0.09), radius: 0.003), dark, "BracketArm", to: pole, at: SIMD3(0, 1.3, 0.05))
        let tablet = node("FieldTablet", in: pole, at: SIMD3(0, 1.33, 0.1),
                          rotation: simd_quatf(angle: -0.55, axis: SIMD3(1, 0, 0)))
        add(box(SIMD3(0.2, 0.13, 0.016), radius: 0.01), lib.coatedMetal(RGBAColor(0.12, 0.12, 0.13), roughness: 0.6, metallic: 0.3),
            "TabletBody", to: tablet)
        add(box(SIMD3(0.212, 0.02, 0.024), radius: 0.008), lib.rubberKnurl(), "TabletBumper", to: tablet, at: SIMD3(0, -0.07, 0))
        let initialTablet = DisplayContent(title: "\(model.name) · Survey", status: "No position", lines: [
            .init(label: "N", value: "----.---", unit: "m"),
            .init(label: "E", value: "----.---", unit: "m"),
            .init(label: "H", value: "---.---", unit: "m"),
            .init(label: "Sats / PDOP", value: "--"),
        ], style: .tablet)
        if let display = DynamicDisplayTexture(pixelSize: CGSize(width: 400, height: 256), initial: initialTablet) {
            rig.tablet = display
            add(MeshResource.generatePlane(width: 0.18, height: 0.112), lib.screen(display.texture), "TabletScreen",
                to: tablet, at: SIMD3(0, 0, 0.0085))
        }

        // Antenna head.
        rig.antennaReferenceHeight = length + 0.013
        let antenna = node("Antenna", in: pole, at: SIMD3(0, rig.antennaReferenceHeight, 0))
        let r = Float(spec.antennaDiameter) / 2
        add(MeshFactory.lathe([SIMD2(0, 0), SIMD2(0.028, 0), SIMD2(r * 0.8, 0.008), SIMD2(r * 0.98, 0.02),
                               SIMD2(r, 0.036), SIMD2(0, 0.036)], segments: 64, name: "antennaHousing"),
            lib.coatedMetal(palette.body, roughness: 0.5, metallic: 0.5), "Housing", to: antenna)
        add(MeshFactory.tube(outerRadius: r + 0.0012, innerRadius: r * 0.94, height: 0.006, segments: 64),
            lib.coatedMetal(palette.accent, roughness: 0.4, metallic: 0.6), "BrandBand", to: antenna, at: SIMD3(0, 0.031, 0))
        add(MeshFactory.dome(radius: r * 0.985, height: Float(spec.antennaHeight) - 0.036, segments: 64),
            lib.radomePlastic(), "Radome", to: antenna, at: SIMD3(0, 0.036, 0))
        let ledColors: [UIColor] = [.systemGreen, .systemYellow, .systemGreen, .systemBlue]
        for (i, color) in ledColors.enumerated() {
            let phi = -0.24 + Float(i) * 0.16
            let led = add(MeshResource.generateSphere(radius: 0.0032), lib.led(color, on: i == 0), "LED\(i)", to: antenna,
                          at: SIMD3(r * 0.93 * sin(phi), 0.02, r * 0.93 * cos(phi)))
            rig.leds.append((led, UIColorBox(color: color)))
        }
        label(model.manufacturer.shortName, size: 0.012, material: lib.coatedMetal(palette.label, roughness: 0.3, metallic: 0.1),
              in: antenna, at: SIMD3(-0.025, 0.012, r * 0.97 + 0.001), rotation: .identity)

        // Bipod: feet fixed on the ground behind the pole (away from the operator).
        let upperMaterial = dark
        for side: Float in [-1, 1] {
            let foot = SIMD3<Float>(side * 0.38, 0, -0.66)
            let upper = node("BipodUpper", in: rig.root)
            add(MeshFactory.cylinder(radius: 0.0095, height: rig.upperLegLength, segments: 24), upperMaterial, "Tube",
                to: upper, at: SIMD3(0, -rig.upperLegLength / 2, 0))
            add(box(SIMD3(0.026, 0.03, 0.026), radius: 0.004), dark, "LegLock", to: upper, at: SIMD3(0, -rig.upperLegLength + 0.015, 0))
            let lower = node("BipodLower", in: rig.root)
            add(MeshFactory.cylinder(radius: 0.0072, height: rig.lowerLegLength, segments: 24), silver, "Tube",
                to: lower, at: SIMD3(0, rig.lowerLegLength / 2, 0))
            add(MeshFactory.frustum(bottomRadius: 0.004, topRadius: 0.012, height: 0.035), lib.rubberKnurl(), "Foot", to: lower)
            rig.bipodLegs.append(RoverRig.BipodLeg(upper: upper, lower: lower, foot: foot))
        }

        pole.addPartCollider(.pole, shapes: [
            ShapeResource.generateCapsule(height: length, radius: 0.03).offsetBy(translation: SIMD3(0, length / 2, 0)),
            ShapeResource.generateSphere(radius: 0.095).offsetBy(translation: SIMD3(0, length + 0.05, 0)),
        ])
        rig.apply(PoleKinematics(length: Double(length)))
        return rig
    }

    // MARK: - Levelling rod

    func makeLevelingRod(spec: LevelingRodSpec) -> RodRig {
        let length = Float(spec.length)
        let rig = RodRig(length: length)
        let aluminium = lib.anodizedAluminum(RGBAColor(0.78, 0.79, 0.8))
        let sectionLength = length / Float(spec.sections)
        for s in 0..<spec.sections {
            let inset = Float(s) * 0.0025
            add(box(SIMD3(0.05 - inset, sectionLength, 0.022 - inset), radius: 0.002), aluminium, "Section\(s)",
                to: rig.root, at: SIMD3(0, sectionLength * (Float(s) + 0.5), -Float(s) * 0.001))
            if s > 0 {
                add(box(SIMD3(0.056, 0.03, 0.028), radius: 0.003), lib.blackPlastic(), "Clip\(s)", to: rig.root,
                    at: SIMD3(0, sectionLength * Float(s), -0.001))
            }
        }
        add(MeshResource.generatePlane(width: 0.044, height: length), lib.rodFace(length: spec.length), "GraduatedFace",
            to: rig.root, at: SIMD3(0, length / 2, 0.0115))
        add(box(SIMD3(0.054, 0.006, 0.026), radius: 0.001), lib.brushedSteel(), "FootPlate", to: rig.root, at: SIMD3(0, 0.003, 0))
        add(box(SIMD3(0.012, 0.1, 0.03), radius: 0.004), lib.blackPlastic(), "Handle", to: rig.root, at: SIMD3(-0.031, 1.35, -0.01))
        _ = circularLevel(in: rig.root, at: SIMD3(0.036, 1.4, -0.01), radius: 0.01)

        rig.root.addPartCollider(.levelingRod, shapes: [
            ShapeResource.generateBox(size: SIMD3(0.05, length, 0.03)).offsetBy(translation: SIMD3(0, length / 2, 0)),
        ], group: SceneCollisionGroups.surveyTargets)
        return rig
    }

    // MARK: - Placement reticle

    func makePlacementReticle() -> Entity {
        let root = Entity()
        root.name = "PlacementReticle"
        let cyan = UIColor(red: 0.2, green: 0.85, blue: 1.0, alpha: 0.95)
        add(MeshFactory.torus(majorRadius: 0.13, minorRadius: 0.004, segments: 64, sides: 8), lib.unlit(cyan), "Ring", to: root)
        add(MeshFactory.cylinder(radius: 0.125, height: 0.001, segments: 64), lib.unlit(cyan.withAlphaComponent(0.15)), "Disc", to: root)
        add(box(SIMD3(0.24, 0.001, 0.004)), lib.unlit(cyan), "CrossX", to: root)
        add(box(SIMD3(0.004, 0.001, 0.24)), lib.unlit(cyan), "CrossZ", to: root)
        // Laser-plummet style guide up to the future tripod-head height.
        add(MeshFactory.cylinder(radius: 0.0015, height: 1.25, segments: 12),
            lib.unlit(UIColor(red: 1, green: 0.2, blue: 0.15, alpha: 0.6)), "Plummet", to: root, at: SIMD3(0, 0.625, 0))
        // Arrow showing the instrument's front (−Z).
        add(box(SIMD3(0.01, 0.001, 0.08)), lib.unlit(.white), "FrontArrow", to: root, at: SIMD3(0, 0.001, -0.17))
        return root
    }

    // MARK: - USDZ override

    /// Swaps procedural visual groups for authored meshes when a USDZ with
    /// matching sub-entity names is bundled. Authored parts must be modelled in
    /// the pivot-local frames documented in `InstrumentRig`.
    private func applyUSDZOverride(to rig: InstrumentRig) {
        guard let name = rig.model.usdzAssetName,
              Bundle.main.url(forResource: name, withExtension: "usdz") != nil,
              let asset = try? Entity.load(named: name) else { return }
        for (groupName, procedural) in rig.visualGroups {
            guard let authored = asset.findEntity(named: groupName), let parent = procedural.parent else { continue }
            authored.removeFromParent()
            authored.transform = procedural.transform
            parent.addChild(authored)
            procedural.isEnabled = false
        }
    }
}
