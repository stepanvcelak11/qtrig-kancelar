//
//  AppDelegate.swift
//  GeoAR Pro: Surveying Simulator
//
//  UIKit lifecycle hooks: component registration, capability checks,
//  portrait lock and keeping the screen awake while surveying.
//

import ARKit
import AVFoundation
import os
import UIKit

@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate {
    private let logger = Logger(subsystem: "com.geoarpro.surveying-simulator", category: "Lifecycle")

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        // Custom RealityKit components must be registered before any entity uses them.
        SceneComponentRegistry.registerAll()
        // A survey session should never dim the screen.
        application.isIdleTimerDisabled = true

        let capabilities = DeviceCapabilities.current()
        logger.info("World tracking: \(capabilities.supportsWorldTracking), LiDAR mesh: \(capabilities.supportsSceneReconstruction), depth: \(capabilities.supportsSceneDepth)")
        return true
    }

    func application(_ application: UIApplication,
                     supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        // Hand-tracking maths and the eyepiece crop assume a portrait interface.
        .portrait
    }

    func applicationDidReceiveMemoryWarning(_ application: UIApplication) {
        logger.warning("Memory warning received")
    }
}

// MARK: - Capabilities & permissions

struct DeviceCapabilities: Equatable, Sendable {
    var supportsWorldTracking: Bool
    var supportsSceneReconstruction: Bool
    var supportsSceneDepth: Bool

    static func current() -> DeviceCapabilities {
        DeviceCapabilities(
            supportsWorldTracking: ARWorldTrackingConfiguration.isSupported,
            supportsSceneReconstruction: ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh),
            supportsSceneDepth: ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth))
    }
}

enum CameraAuthorization: Equatable, Sendable {
    case notDetermined
    case authorized
    case denied

    static var current: CameraAuthorization {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: .authorized
        case .notDetermined: .notDetermined
        default: .denied
        }
    }

    /// Requests camera access (`NSCameraUsageDescription` in Info.plist).
    static func request() async -> CameraAuthorization {
        let granted = await AVCaptureDevice.requestAccess(for: .video)
        return granted ? .authorized : .denied
    }
}
