//
//  ARViewContainer.swift
//  GeoAR Pro: Surveying Simulator
//
//  SwiftUI host for RealityKit's `ARView`:
//   • world tracking with LiDAR scene reconstruction (mesh + classification),
//     scene depth for fingertip distances and person occlusion for hands,
//   • scene-understanding options so the mesh occludes, collides (EDM
//     raycasts) and receives shadows,
//   • UIKit gestures for the manual touch fallback mode,
//   • the ARSessionDelegate bridge feeding `ARSceneController`.
//

import Foundation
import ARKit
import RealityKit
import SwiftUI
import UIKit

struct ARViewContainer: UIViewRepresentable {
    let controller: ARSceneController

    func makeCoordinator() -> Coordinator {
        Coordinator(controller: controller)
    }

    func makeUIView(context: Context) -> ARView {
        let arView = ARView(frame: .zero, cameraMode: .ar, automaticallyConfigureSession: false)
        arView.renderOptions.insert(.disableMotionBlur)
        arView.environment.lighting.intensityExponent = 0.2

        let capabilities = ARSessionConfigurator.run(on: arView)
        controller.attach(to: arView, capabilities: capabilities)
        context.coordinator.installGestures(on: arView)
        context.coordinator.installCoachingOverlay(on: arView)
        return arView
    }

    func updateUIView(_ uiView: ARView, context: Context) {}

    static func dismantleUIView(_ uiView: ARView, coordinator: Coordinator) {
        uiView.session.pause()
    }

    // MARK: - Gestures (manual touch fallback)

    @MainActor
    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        private let controller: ARSceneController
        private var lastRotation: CGFloat = 0

        init(controller: ARSceneController) {
            self.controller = controller
        }

        func installGestures(on view: ARView) {
            let pan = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
            pan.maximumNumberOfTouches = 1
            pan.delegate = self
            view.addGestureRecognizer(pan)

            let rotation = UIRotationGestureRecognizer(target: self, action: #selector(handleRotation(_:)))
            rotation.delegate = self
            view.addGestureRecognizer(rotation)

            let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
            view.addGestureRecognizer(tap)
        }

        func installCoachingOverlay(on view: ARView) {
            let overlay = ARCoachingOverlayView()
            overlay.session = view.session
            overlay.goal = .horizontalPlane
            overlay.activatesAutomatically = true
            overlay.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(overlay)
            NSLayoutConstraint.activate([
                overlay.topAnchor.constraint(equalTo: view.topAnchor),
                overlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),
                overlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
                overlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            ])
        }

        @objc private func handlePan(_ recognizer: UIPanGestureRecognizer) {
            controller.touchPan(phase: recognizer.state, at: recognizer.location(in: recognizer.view))
        }

        @objc private func handleRotation(_ recognizer: UIRotationGestureRecognizer) {
            switch recognizer.state {
            case .began:
                lastRotation = 0
            case .changed:
                let delta = recognizer.rotation - lastRotation
                lastRotation = recognizer.rotation
                controller.touchRotate(delta: Double(delta), at: recognizer.location(in: recognizer.view))
            default:
                lastRotation = 0
            }
        }

        @objc private func handleTap(_ recognizer: UITapGestureRecognizer) {
            controller.touchTap(at: recognizer.location(in: recognizer.view))
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                               shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
            // Pan (drag a knob) and rotate (twist a knob) may run together.
            true
        }
    }
}

// MARK: - Session configuration

@MainActor
enum ARSessionConfigurator {
    /// Configures and runs world tracking with every LiDAR feature the device offers.
    static func run(on arView: ARView) -> SessionCapabilities {
        var capabilities = SessionCapabilities()
        let configuration = ARWorldTrackingConfiguration()
        configuration.planeDetection = [.horizontal, .vertical]
        configuration.environmentTexturing = .automatic   // reflection probes for PBR metal/glass
        configuration.isAutoFocusEnabled = true

        // LiDAR scene reconstruction: the mesh is used for occlusion, shadows and EDM raycasts.
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.meshWithClassification) {
            configuration.sceneReconstruction = .meshWithClassification
            capabilities.sceneReconstruction = true
        } else if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            configuration.sceneReconstruction = .mesh
            capabilities.sceneReconstruction = true
        }

        // Per-pixel LiDAR depth for 3-D fingertip positions.
        var semantics: ARConfiguration.FrameSemantics = []
        if ARWorldTrackingConfiguration.supportsFrameSemantics(.smoothedSceneDepth) {
            semantics.insert(.smoothedSceneDepth)
            capabilities.sceneDepth = true
        } else if ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) {
            semantics.insert(.sceneDepth)
            capabilities.sceneDepth = true
        }
        // Real hands in front of the virtual instrument must occlude it.
        let withPeople = semantics.union(.personSegmentationWithDepth)
        if ARWorldTrackingConfiguration.supportsFrameSemantics(withPeople) {
            semantics = withPeople
            capabilities.personOcclusion = true
        }
        configuration.frameSemantics = semantics

        if capabilities.sceneReconstruction {
            arView.environment.sceneUnderstanding.options = [.occlusion, .collision, .receivesLighting]
        }

        arView.session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
        return capabilities
    }
}

// MARK: - Session delegate bridge

/// Forwards ARKit callbacks (delivered on the main queue) to the controller.
/// `@preconcurrency` lets the main-actor methods satisfy the nonisolated
/// Objective-C protocol; ARKit calls them on the main thread because no
/// custom `delegateQueue` is set.
@MainActor
final class ARSessionBridge: NSObject, @preconcurrency ARSessionDelegate {
    var onFrame: (@MainActor (ARFrame) -> Void)?
    var onTrackingState: (@MainActor (ARCamera) -> Void)?
    var onError: (@MainActor (String) -> Void)?

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        onFrame?(frame)
    }

    func session(_ session: ARSession, cameraDidChangeTrackingState camera: ARCamera) {
        onTrackingState?(camera)
    }

    func session(_ session: ARSession, didFailWithError error: Error) {
        onError?("AR session failed: \(error.localizedDescription)")
    }

    func sessionWasInterrupted(_ session: ARSession) {
        onError?("AR session interrupted")
    }

    func sessionInterruptionEnded(_ session: ARSession) {
        onError?("Resuming tracking…")
    }
}
