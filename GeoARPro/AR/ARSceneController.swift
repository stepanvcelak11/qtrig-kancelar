//
//  ARSceneController.swift
//  GeoAR Pro: Surveying Simulator
//
//  Main-actor coordinator between ARKit/RealityKit, the services and SwiftUI.
//  It owns the placed equipment, runs the per-frame loop driven by
//  `ARSessionDelegate`, routes hand/touch input through the interaction
//  controller into the kinematics solver, and publishes observable UI state.
//

import ARKit
import Observation
import QuartzCore
import RealityKit
import simd
import UIKit

enum InteractionMode: String, CaseIterable, Identifiable, Sendable {
    case handTracking
    case touch

    var id: String { rawValue }
    var title: String { self == .handTracking ? "Hand" : "Touch" }
    var systemImage: String { self == .handTracking ? "hand.raised.fingers.spread" : "hand.tap" }
}

struct ClampPanelState: Equatable {
    var hasInstrument = false
    var isLevel = false
    var classicDrives = false
    var horizontalClamp = false
    var verticalClamp = false
    var hzHold = false
    var compensator = true
}

struct HandOverlayState: Equatable {
    var index: CGPoint
    var thumb: CGPoint
    var isPinching: Bool
    var hasDepth: Bool
    var pinchDistance: Float
}

struct ToastMessage: Identifiable, Equatable {
    enum Tint: Equatable { case info, success, warning }
    let id = UUID()
    var text: String
    var systemImage: String
    var tint: Tint
}

struct SessionCapabilities: Equatable {
    var sceneReconstruction = false
    var sceneDepth = false
    var personOcclusion = false
}

@MainActor
@Observable
final class ARSceneController {
    // MARK: Observable UI state

    private(set) var isPlacing = false
    private(set) var placementReady = false
    private(set) var placingModel: EquipmentModel?
    private(set) var activeModel: EquipmentModel?
    private(set) var rodCount = 0
    private(set) var readout = InstrumentReadout.empty
    private(set) var level = LevelIndicatorState.idle
    private(set) var gnss: GNSSStatus?
    private(set) var levelingLog = LevelingLog()
    private(set) var clamps = ClampPanelState()
    private(set) var hoveredPart: InstrumentPartKind?
    private(set) var engagedPart: InstrumentPartKind?
    private(set) var handOverlay: HandOverlayState?
    private(set) var trackingMessage: String? = "Move your iPhone to scan the ground"
    private(set) var toast: ToastMessage?
    private(set) var capabilities = SessionCapabilities()
    private(set) var focusDistance: Double = 20
    private(set) var defocus: Double = 0
    private(set) var showNoHandHint = false

    var interactionMode: InteractionMode = .handTracking {
        didSet { interactionModeChanged() }
    }
    var angleUnit: AngleUnit = .gon
    var tiltCompensationEnabled = true

    let optics = EyepiecePassThroughService()
    let handTracking = HandTrackingEngine()

    // MARK: Scene state (not observed)

    @ObservationIgnored private weak var arView: ARView?
    @ObservationIgnored private let sessionBridge = ARSessionBridge()
    @ObservationIgnored private let generator = ProceduralModelGenerator()
    @ObservationIgnored private let interaction = InteractionController()
    @ObservationIgnored private let haptics = HapticsEngine()

    @ObservationIgnored private var reticleAnchor: AnchorEntity?
    @ObservationIgnored private var reticle: Entity?
    @ObservationIgnored private var pendingPlacement: (position: SIMD3<Float>, yaw: Float)?
    @ObservationIgnored private var isRepositioning = false

    @ObservationIgnored private var setupAnchor: AnchorEntity?
    @ObservationIgnored private var tripodRig: TripodRig?
    @ObservationIgnored private var instrumentRig: InstrumentRig?
    @ObservationIgnored private var kinematics: SurveyingKinematics?
    @ObservationIgnored private var roverRig: RoverRig?
    @ObservationIgnored private var pole: PoleKinematics?
    @ObservationIgnored private var gnssSimulator: GNSSSimulator?
    @ObservationIgnored private var rods: [(anchor: AnchorEntity, rig: RodRig)] = []

    @ObservationIgnored private var lastMeasurement: TimeInterval = 0
    @ObservationIgnored private var lastDisplayUpdate: TimeInterval = 0
    @ObservationIgnored private var lastGNSSEpoch: TimeInterval?
    @ObservationIgnored private var lastHandSeen: TimeInterval = 0
    @ObservationIgnored private var contentInstalledAt: TimeInterval = 0
    @ObservationIgnored private var lastToastText: String?
    @ObservationIgnored private var lastToastTime: TimeInterval = 0
    @ObservationIgnored private var targetDistance: Double?
    @ObservationIgnored private var cameraTransform = matrix_identity_float4x4

    private var hasInteractiveContent: Bool { instrumentRig != nil || roverRig != nil }

    var hasTelescopeInstrument: Bool { instrumentRig != nil }
    var isLevelInstrument: Bool { kinematics?.config.isAutomaticLevel ?? false }

    // MARK: - Lifecycle

    /// Called once by `ARViewContainer` after the view is created.
    func attach(to arView: ARView, capabilities: SessionCapabilities) {
        self.arView = arView
        self.capabilities = capabilities
        haptics.prepare()

        sessionBridge.onFrame = { [weak self] frame in self?.handleFrame(frame) }
        sessionBridge.onTrackingState = { [weak self] camera in self?.updateTrackingMessage(camera) }
        sessionBridge.onError = { [weak self] message in self?.trackingMessage = message }
        arView.session.delegate = sessionBridge

        handTracking.onResult = { [weak self] result in self?.handleHand(result) }

        // Key light with soft shadows so equipment grounds itself on the LiDAR mesh.
        let lightAnchor = AnchorEntity(world: .zero)
        let sun = DirectionalLight()
        sun.light.intensity = 2200
        sun.light.color = UIColor(red: 1.0, green: 0.97, blue: 0.92, alpha: 1)
        sun.shadow = DirectionalLightComponent.Shadow(maximumDistance: 5, depthBias: 1.5)
        sun.look(at: .zero, from: SIMD3(1.2, 3.0, 1.6), relativeTo: nil)
        lightAnchor.addChild(sun)
        arView.scene.addAnchor(lightAnchor)

        let anchor = AnchorEntity(world: .zero)
        let reticle = generator.makePlacementReticle()
        reticle.isEnabled = false
        anchor.addChild(reticle)
        arView.scene.addAnchor(anchor)
        reticleAnchor = anchor
        self.reticle = reticle
    }

    // MARK: - Frame loop

    private func handleFrame(_ frame: ARFrame) {
        guard let arView else { return }
        let now = frame.timestamp
        cameraTransform = frame.camera.transform

        if isPlacing { updatePlacementPreview(in: arView) }

        if interactionMode == .handTracking, optics.mode == .standard, hasInteractiveContent, !isPlacing {
            handTracking.submit(frame, viewportSize: arView.bounds.size)
            // Suggest the touch fallback after 10 s without a detected hand.
            if contentInstalledAt == 0 { contentInstalledAt = now }
            let hint = now - max(lastHandSeen, contentInstalledAt) > 10
            if hint != showNoHandHint { showNoHandHint = hint }
        } else {
            if showNoHandHint { showNoHandHint = false }
            contentInstalledAt = 0
        }

        if let rig = instrumentRig, kinematics != nil {
            let geometry = rig.geometry
            if optics.update(frame: frame, geometry: geometry, aimDistance: targetDistance) {
                opticsModeChanged()
            }
            if now - lastMeasurement >= 1.0 / 15.0 {
                lastMeasurement = now
                updateInstrumentReadout(geometry: geometry, in: arView)
            }
        } else if optics.mode != .standard || optics.alignment != nil {
            optics.reset()
        }

        if roverRig != nil { updateRover(now: now) }
    }

    private func updateTrackingMessage(_ camera: ARCamera) {
        switch camera.trackingState {
        case .normal:
            trackingMessage = nil
        case .notAvailable:
            trackingMessage = "Tracking unavailable"
        case .limited(let reason):
            switch reason {
            case .initializing: trackingMessage = "Initialising — move slowly"
            case .excessiveMotion: trackingMessage = "Slow down"
            case .insufficientFeatures: trackingMessage = "Point at a textured surface"
            case .relocalizing: trackingMessage = "Relocalising…"
            @unknown default: trackingMessage = "Limited tracking"
            }
        }
    }

    // MARK: - Placement

    func beginPlacement(of model: EquipmentModel) {
        if optics.mode == .telescope { optics.exitTelescope() }
        placingModel = model
        isRepositioning = false
        isPlacing = true
        placementReady = false
        interaction.cancel()
        haptics.selection()
    }

    func beginReposition() {
        guard let activeModel, setupAnchor != nil else { return }
        placingModel = activeModel
        isRepositioning = true
        isPlacing = true
        placementReady = false
        interaction.cancel()
    }

    func cancelPlacement() {
        isPlacing = false
        placementReady = false
        placingModel = nil
        reticle?.isEnabled = false
    }

    func confirmPlacement() {
        guard isPlacing, let model = placingModel, let target = pendingPlacement else {
            showToast("Aim at the ground until the ring appears", systemImage: "viewfinder", tint: .warning)
            return
        }
        if isRepositioning, let anchor = setupAnchor {
            anchor.position = target.position
            anchor.orientation = simd_quatf(angle: target.yaw, axis: SIMD3(0, 1, 0))
            // A new setup means a new (unlevelled) tripod head.
            if var k = kinematics {
                k.state.setupTilt = SurveyingKinematics.randomSetupTilt()
                kinematics = k
                instrumentRig?.apply(k)
                tripodRig?.apply(setupTilt: k.state.setupTilt)
                showToast("Tripod repositioned — relevel the instrument", systemImage: "scope", tint: .info)
            }
            gnssSimulator?.reset()
        } else {
            install(model, at: target.position, yaw: target.yaw)
        }
        cancelPlacement()
        haptics.success()
    }

    private func updatePlacementPreview(in arView: ARView) {
        let center = CGPoint(x: arView.bounds.midX, y: arView.bounds.midY)
        guard let result = arView.raycast(from: center, allowing: .estimatedPlane, alignment: .horizontal).first else {
            placementReady = false
            reticle?.isEnabled = false
            pendingPlacement = nil
            return
        }
        let position = result.worldTransform.columns.3.xyz
        let yaw = facingYaw(at: position)
        reticle?.transform = Transform(scale: .one, rotation: simd_quatf(angle: yaw, axis: SIMD3(0, 1, 0)), translation: position)
        reticle?.isEnabled = true
        placementReady = true
        pendingPlacement = (position, yaw)
    }

    /// Yaw that turns the equipment's back (+Z, eyepiece / tablet side) towards the user.
    private func facingYaw(at position: SIMD3<Float>) -> Float {
        let d = cameraTransform.columns.3.xyz - position
        return atan2(d.x, d.z)
    }

    private func install(_ model: EquipmentModel, at position: SIMD3<Float>, yaw: Float) {
        guard let arView else { return }
        let anchor = AnchorEntity(world: position)
        anchor.orientation = simd_quatf(angle: yaw, axis: SIMD3(0, 1, 0))

        if case .levelingRod(let spec) = model.kind {
            let rod = generator.makeLevelingRod(spec: spec)
            anchor.addChild(rod.root)
            arView.scene.addAnchor(anchor)
            rods.append((anchor, rod))
            if rods.count > 3 {
                arView.scene.removeAnchor(rods.removeFirst().anchor)
            }
            rodCount = rods.count
            showToast("Levelling rod placed", systemImage: "ruler", tint: .success)
            return
        }

        removeSetup()
        let tripodSpec = Self.defaultTripodSpec
        let headHeight = Float(tripodSpec.defaultHeadHeight)

        switch model.kind {
        case .totalStation(let spec):
            let rig = generator.makeTotalStation(model, spec: spec)
            mountOnTripod(rig, model: model, anchor: anchor, headHeight: headHeight)
            showToast("Level the instrument with the foot screws", systemImage: "scope", tint: .info)
        case .opticalLevel(let spec):
            let rig = generator.makeOpticalLevel(model, spec: spec)
            mountOnTripod(rig, model: model, anchor: anchor, headHeight: headHeight)
            showToast("Centre the circular bubble with the foot screws", systemImage: "level", tint: .info)
        case .tripod:
            let tripod = generator.makeTripod(headHeight: headHeight)
            tripod.apply(setupTilt: SurveyingKinematics.randomSetupTilt())
            anchor.addChild(tripod.root)
            tripodRig = tripod
        case .gnssRover(let spec):
            let rover = generator.makeGNSSRover(model, spec: spec)
            anchor.addChild(rover.root)
            roverRig = rover
            pole = PoleKinematics(length: spec.poleLength)
            gnssSimulator = GNSSSimulator(spec: spec)
            lastGNSSEpoch = nil
            showToast("Acquiring satellites…", systemImage: "antenna.radiowaves.left.and.right", tint: .info)
        case .levelingRod:
            break
        }

        arView.scene.addAnchor(anchor)
        setupAnchor = anchor
        activeModel = model
        publishClampState()
    }

    private func mountOnTripod(_ rig: InstrumentRig, model: EquipmentModel, anchor: AnchorEntity, headHeight: Float) {
        let tripod = generator.makeTripod(headHeight: headHeight)
        var k = SurveyingKinematics(config: .make(for: model))
        k.state.setupTilt = SurveyingKinematics.randomSetupTilt()
        k.state.circleOrientation = 0
        k.setFocusDistance(20)
        tripod.apply(setupTilt: k.state.setupTilt)
        rig.root.position = SIMD3(0, headHeight, 0)
        rig.apply(k)
        anchor.addChild(tripod.root)
        anchor.addChild(rig.root)
        tripodRig = tripod
        instrumentRig = rig
        kinematics = k
        focusDistance = k.state.focusDistance
        levelingLog = LevelingLog()
    }

    private func removeSetup() {
        if let setupAnchor { arView?.scene.removeAnchor(setupAnchor) }
        setupAnchor = nil
        tripodRig = nil
        instrumentRig = nil
        kinematics = nil
        roverRig = nil
        pole = nil
        gnssSimulator = nil
        gnss = nil
        activeModel = nil
        readout = .empty
        level = .idle
        interaction.cancel()
        optics.reset()
        publishClampState()
    }

    func clearScene() {
        removeSetup()
        for rod in rods { arView?.scene.removeAnchor(rod.anchor) }
        rods.removeAll()
        rodCount = 0
    }

    static var defaultTripodSpec: TripodSpec {
        if case .tripod(let spec)? = EquipmentCatalog.model(id: "tripod-gst20")?.kind { return spec }
        return TripodSpec(material: "Wood", minimumHeight: 1.07, maximumHeight: 1.72, defaultHeadHeight: 1.25, weightKg: 6.4)
    }

    // MARK: - Measurements

    private func updateInstrumentReadout(geometry: RigGeometry, in arView: ARView) {
        guard let rig = instrumentRig, let k = kinematics else { return }
        let model = rig.model

        // Line of sight in world space; an automatic level's compensator keeps it horizontal.
        var los = geometry.opticalForward
        if k.config.isAutomaticLevel && k.state.compensatorEnabled && k.levelState != .outOfRange {
            let horizontal = SIMD3<Float>(los.x, 0, los.z)
            if simd_length(horizontal) > 1e-4 { los = simd_normalize(horizontal) }
        }

        var maxRange: Float = 150
        var edmConstant = 2.0, edmPPM = 2.0
        if case .totalStation(let spec) = model.kind {
            maxRange = Float(min(spec.edmRangeReflectorless, 300))
            edmConstant = spec.edmConstantMM
            edmPPM = spec.edmPPM
        }

        var distance: DistanceMeasurement?
        var rodReading: RodReading?
        targetDistance = nil
        if let hit = MeasurementService.castLineOfSight(from: geometry.objectivePosition, direction: los,
                                                         in: arView, maxRange: maxRange) {
            // Distances are referenced to the tilting axis (instrument centre).
            let slope = Double(simd_distance(geometry.trunnionCenter, hit.point))
            targetDistance = slope
            if !k.config.isAutomaticLevel, k.levelState != .outOfRange || !k.state.compensatorEnabled {
                distance = DistanceMeasurement(slope: slope + MeasurementService.edmNoise(distance: slope, constantMM: edmConstant, ppm: edmPPM),
                                               source: hit.source)
            }
            if hit.source == .levelingRod, let entity = hit.entity,
               let rod = rods.first(where: { entity.isDescendant(of: $0.rig.root) })?.rig {
                let horizontal = slope * Double(simd_length(SIMD2(los.x, los.z)))
                rodReading = MeasurementService.rodReading(hitPoint: hit.point, rod: rod, horizontalDistance: horizontal)
                if k.config.isAutomaticLevel, let reading = rodReading {
                    // Levels "measure" distance tacheometrically via the stadia hairs.
                    distance = DistanceMeasurement(slope: reading.stadiaDistance, source: .levelingRod)
                }
            }
        }

        let tripodHeight = Double(tripodRig?.headHeight ?? 0)
        readout = InstrumentReadout(
            instrumentName: model.displayName,
            angles: k.readings,
            distance: distance,
            rod: rodReading,
            instrumentHeight: tripodHeight + rig.opticalAxisHeight,
            gridAzimuth: GeodeticMath.azimuth(of: los.double),
            isAutomaticLevel: k.config.isAutomaticLevel)
        focusDistance = k.state.focusDistance
        defocus = k.defocus(forTargetDistance: targetDistance ?? 50)

        // HUD bubble: express the in-scene bubble offset in the viewer's frame
        // (x → screen right, y → towards the viewer / screen down).
        var bubble = SIMD2<Double>.zero
        if let bubbleEntity = rig.bubble, let parent = bubbleEntity.parent {
            let offsetWorld = bubbleEntity.position(relativeTo: nil) - parent.convert(position: rig.bubbleRest, to: nil)
            bubble = viewerFrame(offsetWorld) / k.config.vialRadius
        }
        let readings = k.readings
        level = LevelIndicatorState(bubbleOffset: bubble, tiltMagnitude: readings.tiltMagnitude,
                                    longitudinal: readings.tiltLongitudinal, transverse: readings.tiltTransverse,
                                    state: readings.levelState, isAvailable: true)

        updateInstrumentDisplay(k: k, rig: rig)
    }

    /// Projects a world vector onto the camera's horizontal right / toward-viewer axes.
    private func viewerFrame(_ v: SIMD3<Float>) -> SIMD2<Double> {
        let forward = -cameraTransform.columns.2.xyz
        var horizontal = SIMD3<Float>(forward.x, 0, forward.z)
        if simd_length(horizontal) < 1e-4 { horizontal = SIMD3(0, 0, -1) }
        horizontal = simd_normalize(horizontal)
        let right = simd_cross(horizontal, SIMD3(0, 1, 0))
        return SIMD2(Double(simd_dot(v, right)), Double(simd_dot(v, -horizontal)))
    }

    private func updateInstrumentDisplay(k: SurveyingKinematics, rig: InstrumentRig) {
        guard let display = rig.display, CACurrentMediaTime() - lastDisplayUpdate > 0.2 else { return }
        lastDisplayUpdate = CACurrentMediaTime()
        let r = readout.angles
        let unit = angleUnit == .gon ? "g" : ""
        let content = DisplayContent(
            title: rig.model.name,
            status: k.state.compensatorEnabled ? "COMP ▮▮▮" : "comp off",
            lines: [
                .init(label: "Hz", value: GeodeticMath.format(r?.hz, unit: angleUnit), unit: unit),
                .init(label: "V", value: GeodeticMath.format(r?.v, unit: angleUnit), unit: unit),
                .init(label: "SD", value: GeodeticMath.formatDistance(readout.distance?.slope), unit: "m"),
            ],
            style: .lcd,
            alert: k.levelState == .outOfRange && k.state.compensatorEnabled ? "TILT!" : nil)
        display.update(content)
    }

    // MARK: - GNSS rover

    private func updateRover(now: TimeInterval) {
        guard let rover = roverRig, let pole, var simulator = gnssSimulator else { return }
        rover.updateLEDs(time: now, fix: gnss?.fix ?? .none)

        level = LevelIndicatorState(bubbleOffset: viewerFrame(rover.root.convert(
                                        direction: SIMD3(Float(pole.bubbleOffset.x), 0, Float(pole.bubbleOffset.y)), to: nil))
                                        / pole.vialRadius,
                                    tiltMagnitude: pole.tilt, longitudinal: 0, transverse: 0,
                                    state: pole.tilt < GeodeticMath.degrees(0.5) ? .leveled : .compensated,
                                    isAvailable: true)

        let dt = lastGNSSEpoch.map { now - $0 } ?? 1
        guard dt >= 1 else { return }
        lastGNSSEpoch = now
        let status = simulator.epoch(dt: dt, tipWorld: rover.poleTipWorld.double, antennaWorld: rover.antennaWorld.double,
                                     tilt: pole.tilt, tiltCompensationEnabled: tiltCompensationEnabled)
        gnssSimulator = simulator
        if gnss?.fix != .rtkFixed && status.fix == .rtkFixed {
            haptics.success()
            showToast("RTK Fixed", systemImage: "checkmark.seal.fill", tint: .success)
        }
        gnss = status
        rover.tablet?.update(DisplayContent(
            title: "\(rover.model.name) · Survey",
            status: status.fix.rawValue,
            lines: [
                .init(label: "N", value: String(format: "%.3f", status.northing), unit: "m"),
                .init(label: "E", value: String(format: "%.3f", status.easting), unit: "m"),
                .init(label: "H", value: String(format: "%.3f", status.height), unit: "m"),
                .init(label: "Sats / PDOP", value: String(format: "%d / %.1f", status.satellitesUsed, status.pdop)),
            ],
            style: .tablet))
    }

    // MARK: - Input routing

    private func handleHand(_ result: HandTrackingResult?) {
        guard let result else {
            handOverlay = nil
            hoveredPart = nil
            if interaction.engagedPart != nil {
                interaction.cancel()
                engagedPart = nil
            }
            return
        }
        lastHandSeen = result.timestamp
        if showNoHandHint { showNoHandHint = false }
        handOverlay = HandOverlayState(index: result.indexTipScreen, thumb: result.thumbTipScreen,
                                       isPinching: result.isPinching, hasDepth: result.indexTipWorld != nil,
                                       pinchDistance: result.pinchDistance)
        guard hasInteractiveContent, !isPlacing, optics.mode == .standard else { return }
        route(PointerSample(screenPoint: result.indexTipScreen, rayOrigin: result.rayOrigin,
                            rayDirection: result.rayDirection, fingertipWorld: result.indexTipWorld,
                            isGrabbing: result.isPinching, roll: result.roll, source: .hand,
                            timestamp: result.timestamp))
    }

    /// Manual touch fallback: pan gestures drive the same interaction pipeline.
    func touchPan(phase: UIGestureRecognizer.State, at location: CGPoint) {
        guard interactionMode == .touch, !isPlacing, hasInteractiveContent,
              let arView, let ray = arView.ray(through: location) else { return }
        let grabbing = phase == .began || phase == .changed
        route(PointerSample(screenPoint: location, rayOrigin: ray.origin, rayDirection: ray.direction,
                            fingertipWorld: nil, isGrabbing: grabbing, roll: nil, source: .touch,
                            timestamp: CACurrentMediaTime()))
        if !grabbing {
            engagedPart = nil
            interaction.cancel()
        }
    }

    /// Two-finger twist on a knob (touch mode).
    func touchRotate(delta: Double, at location: CGPoint) {
        guard interactionMode == .touch, !isPlacing, let arView, let ray = arView.ray(through: location) else { return }
        let sample = PointerSample(screenPoint: location, rayOrigin: ray.origin, rayDirection: ray.direction,
                                   fingertipWorld: nil, isGrabbing: true, roll: nil, source: .touch,
                                   timestamp: CACurrentMediaTime())
        apply(interaction.processRotation(delta: delta, at: sample, scene: arView.scene))
    }

    func touchTap(at location: CGPoint) {
        if isPlacing {
            confirmPlacement()
            return
        }
        guard let arView, let ray = arView.ray(through: location) else { return }
        let hits = arView.scene.raycast(origin: ray.origin, direction: ray.direction, length: 8, query: .nearest,
                                        mask: SceneCollisionGroups.instrumentParts.union(SceneCollisionGroups.surveyTargets),
                                        relativeTo: nil)
        if let kind = hits.first?.entity.interactivePartKind() {
            hoveredPart = kind
            showToast(kind.displayName, systemImage: "hand.point.up.left", tint: .info)
        }
    }

    private func route(_ sample: PointerSample) {
        guard let arView else { return }
        let geometry = InteractionGeometry(instrument: instrumentRig?.geometry, poleTip: roverRig?.poleTipWorld)
        let outcome = interaction.process(sample, scene: arView.scene, geometry: geometry)
        if hoveredPart != outcome.hovered { hoveredPart = outcome.hovered }
        if engagedPart != outcome.engaged {
            engagedPart = outcome.engaged
            if outcome.engaged != nil { haptics.selection() }
        }
        apply(outcome.intents)
    }

    private func apply(_ intents: [KinematicIntent]) {
        guard !intents.isEmpty else { return }

        if var k = kinematics, let rig = instrumentRig {
            var feedback = KinematicsFeedback()
            for intent in intents {
                switch intent {
                case .rotateAlidade(let d): feedback.merge(k.rotateAlidade(by: d))
                case .pitchTelescope(let d): feedback.merge(k.pitchTelescope(by: d))
                case .turnHorizontalDrive(let t): feedback.merge(k.turnHorizontalTangent(turns: t))
                case .turnVerticalDrive(let t): feedback.merge(k.turnVerticalTangent(turns: t))
                case .turnFootScrew(let i, let t): feedback.merge(k.turnFootScrew(i, turns: t))
                case .turnFocus(let t): k.turnFocus(turns: t)
                case .aimPole: break
                }
            }
            kinematics = k
            rig.apply(k)
            focusDistance = k.state.focusDistance
            handle(feedback)
        }

        if var pole, let rover = roverRig {
            for case .aimPole(let world) in intents {
                pole.point(towards: rover.root.convert(position: world, from: nil).double)
            }
            self.pole = pole
            rover.apply(pole)
        }
    }

    private func handle(_ feedback: KinematicsFeedback) {
        haptics.detents(feedback.detentTicks)
        if feedback.blockedByClamp {
            haptics.blocked()
            showToast("Clamp engaged — use the fine drive", systemImage: "lock.fill", tint: .warning)
        }
        if feedback.clampReleased {
            showToast("Engage the clamp before using the tangent screw", systemImage: "lock.open", tint: .warning)
        }
        if feedback.hitTravelLimit {
            haptics.blocked()
            showToast("End of screw travel", systemImage: "arrow.left.and.right", tint: .warning)
        }
        switch feedback.levelStateChanged {
        case .leveled?:
            haptics.success()
            showToast("Instrument levelled", systemImage: "checkmark.circle.fill", tint: .success)
        case .outOfRange?:
            haptics.warning()
        default:
            break
        }
    }

    // MARK: - Instrument controls (HUD / telescope view)

    /// Fine-drive jog from the telescope view (knobs are out of sight there).
    func jog(_ kind: InstrumentPartKind, turns: Double) {
        switch kind {
        case .horizontalTangent: apply([.turnHorizontalDrive(turns)])
        case .verticalTangent: apply([.turnVerticalDrive(turns)])
        case .focusKnob: apply([.turnFocus(turns)])
        default: break
        }
    }

    func setFocus(distance: Double) {
        guard var k = kinematics else { return }
        k.setFocusDistance(distance)
        kinematics = k
        instrumentRig?.apply(k)
        focusDistance = k.state.focusDistance
    }

    func autoFocus() {
        setFocus(distance: targetDistance ?? 50)
        haptics.selection()
    }

    func toggleHorizontalClamp() {
        mutateKinematics { $0.setHorizontalClamp(!$0.state.horizontalClampEngaged) }
    }

    func toggleVerticalClamp() {
        mutateKinematics { $0.setVerticalClamp(!$0.state.verticalClampEngaged) }
    }

    func toggleHzHold() {
        mutateKinematics { $0.state.hzHold.toggle() }
    }

    func toggleCompensator() {
        mutateKinematics { $0.state.compensatorEnabled.toggle() }
    }

    func setHzZero() {
        mutateKinematics { $0.setHorizontalReading(0) }
        showToast("Hz set to 0", systemImage: "scope", tint: .success)
    }

    /// Switches between modern endless drives and a classic clamp/tangent-screw instrument.
    func setClassicDrives(_ classic: Bool) {
        guard let model = activeModel else { return }
        mutateKinematics { k in
            k.config.driveType = classic ? .clampAndTangent : InstrumentKinematicsConfig.make(for: model).driveType
            k.setHorizontalClamp(false)
            k.setVerticalClamp(false)
        }
    }

    func recordBacksight() {
        guard let reading = readout.rod?.reading else {
            showToast("Sight a levelling rod first", systemImage: "ruler", tint: .warning)
            return
        }
        levelingLog.backsight = reading
        levelingLog.foresight = nil
        haptics.success()
    }

    func recordForesight() {
        guard let reading = readout.rod?.reading else {
            showToast("Sight a levelling rod first", systemImage: "ruler", tint: .warning)
            return
        }
        levelingLog.foresight = reading
        haptics.success()
    }

    private func mutateKinematics(_ body: (inout SurveyingKinematics) -> Void) {
        guard var k = kinematics else { return }
        body(&k)
        kinematics = k
        instrumentRig?.apply(k)
        haptics.selection()
        publishClampState()
    }

    private func publishClampState() {
        guard let k = kinematics else {
            clamps = ClampPanelState()
            return
        }
        clamps = ClampPanelState(hasInstrument: true,
                                 isLevel: k.config.isAutomaticLevel,
                                 classicDrives: k.config.driveType == .clampAndTangent,
                                 horizontalClamp: k.state.horizontalClampEngaged,
                                 verticalClamp: k.state.verticalClampEngaged,
                                 hzHold: k.state.hzHold,
                                 compensator: k.state.compensatorEnabled)
    }

    // MARK: - Modes & toasts

    private func interactionModeChanged() {
        handTracking.isEnabled = interactionMode == .handTracking
        handOverlay = nil
        interaction.cancel()
        engagedPart = nil
        hoveredPart = nil
        showNoHandHint = false
        lastHandSeen = 0
    }

    private func opticsModeChanged() {
        interaction.cancel()
        engagedPart = nil
        handOverlay = nil
        haptics.selection()
        if optics.mode == .telescope, let magnification = instrumentRig?.model.magnification {
            optics.zoomFactor = min(max(magnification, optics.zoomRange.lowerBound), optics.zoomRange.upperBound)
        }
    }

    func exitTelescope() {
        optics.exitTelescope()
        opticsModeChanged()
    }

    func showToast(_ text: String, systemImage: String, tint: ToastMessage.Tint) {
        let now = CACurrentMediaTime()
        if text == lastToastText && now - lastToastTime < 2.5 { return }
        lastToastText = text
        lastToastTime = now
        let message = ToastMessage(text: text, systemImage: systemImage, tint: tint)
        toast = message
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(2.4))
            if self?.toast?.id == message.id { self?.toast = nil }
        }
    }
}

// MARK: - Entity hierarchy helper

@MainActor
private extension Entity {
    func isDescendant(of ancestor: Entity) -> Bool {
        var node: Entity? = self
        while let current = node {
            if current === ancestor { return true }
            node = current.parent
        }
        return false
    }
}
