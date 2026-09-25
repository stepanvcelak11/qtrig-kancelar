//
//  EyepiecePassThroughService.swift
//  GeoAR Pro: Surveying Simulator
//
//  "Look through the telescope": when the phone is brought to the virtual
//  eyepiece and held along the optical axis, the UI switches to a telescope
//  view — a magnified crop of the live camera image centred on the point the
//  instrument's line of sight projects to, under a reticle with stadia hairs.
//
//  Alignment test (every frame):
//      v   = p_eyepiece − p_camera               (camera → eyepiece vector)
//      d   = |v|                                   (eye relief)
//      f_c = −Z column of the camera transform     (device viewing direction)
//      f_t = telescope optical forward (eyepiece → objective)
//      θ   = acos(f_c · f_t)                       (angular deviation)
//  Enter telescope mode when d < 8 cm and θ < 15°, and the eyepiece is not
//  behind the camera (v · f_t > −2 cm). Leave when d > 12 cm (hysteresis) or
//  θ > 30°.
//
//  Zoom: the aim point P = objective + f_t · D (D = EDM distance or 50 m) is
//  projected into the captured image with the camera intrinsics; a square of
//  side  s = (short image side) / zoom  around it is cropped, rotated to
//  portrait and upscaled (Lanczos). Because the phone sits at the eyepiece,
//  parallax between the phone camera and the virtual telescope is small.
//

import Foundation
import ARKit
import CoreImage
import Observation
import simd
import UIKit

struct EyepieceAlignment: Equatable, Sendable {
    /// Camera → eyepiece distance (metres).
    var distance: Float
    /// Angle between the device viewing direction and the optical axis (radians).
    var angularDeviation: Float
}

@MainActor
@Observable
final class EyepiecePassThroughService {
    enum Mode: Equatable, Sendable {
        case standard
        case telescope
    }

    private(set) var mode: Mode = .standard
    private(set) var alignment: EyepieceAlignment?
    /// Latest magnified frame (portrait, square).
    private(set) var image: UIImage?
    /// Angular size (radians) of the full field diameter shown on screen.
    /// SwiftUI converts this to points per radian for the stadia hairs.
    private(set) var fieldOfViewRadians: Double = 0.02
    /// Digital zoom (10×–30×) applied to the camera crop.
    var zoomFactor: Double = 30
    var isEnabled = true {
        didSet { if !isEnabled { reset() } }
    }

    let activationDistance: Float = 0.08
    let deactivationDistance: Float = 0.12
    let activationAngle: Float = 15 * .pi / 180
    let deactivationAngle: Float = 30 * .pi / 180
    let zoomRange: ClosedRange<Double> = 10...30

    @ObservationIgnored private let renderer = TelescopeFrameRenderer()
    @ObservationIgnored private var renderInFlight = false
    @ObservationIgnored private var lastRender: TimeInterval = 0
    /// Manual exit suppresses re-entry until the phone is pulled away once.
    @ObservationIgnored private var suppressedUntilPulledAway = false

    func reset() {
        mode = .standard
        alignment = nil
        image = nil
        suppressedUntilPulledAway = false
    }

    /// Leaves telescope mode on user request.
    func exitTelescope() {
        mode = .standard
        image = nil
        suppressedUntilPulledAway = true
    }

    /// Evaluates alignment and, in telescope mode, requests a new zoomed frame.
    /// Returns `true` when the mode changed.
    @discardableResult
    func update(frame: ARFrame, geometry: RigGeometry, aimDistance: Double?) -> Bool {
        guard isEnabled else { return false }
        let camera = frame.camera.transform
        let cameraPosition = camera.columns.3.xyz
        let viewDirection = -simd_normalize(camera.columns.2.xyz)

        let toEyepiece = geometry.eyepiecePosition - cameraPosition
        let distance = simd_length(toEyepiece)
        let cosine = max(-1, min(1, simd_dot(viewDirection, geometry.opticalForward)))
        let deviation = acos(cosine)
        let inFront = simd_dot(toEyepiece, geometry.opticalForward) > -0.02
        // Publish only meaningful changes (5 mm / ~0.5°) to avoid 60 Hz SwiftUI invalidation.
        if let current = alignment, abs(current.distance - distance) < 0.005,
           abs(current.angularDeviation - deviation) < 0.01 {
            // unchanged
        } else {
            alignment = EyepieceAlignment(distance: distance, angularDeviation: deviation)
        }

        let previous = mode
        switch mode {
        case .standard:
            if suppressedUntilPulledAway {
                if distance > deactivationDistance { suppressedUntilPulledAway = false }
            } else if distance < activationDistance && deviation < activationAngle && inFront {
                mode = .telescope
            }
        case .telescope:
            if distance > deactivationDistance || deviation > deactivationAngle {
                mode = .standard
                image = nil
            }
        }

        if mode == .telescope {
            let range = Float(aimDistance ?? 50)
            let aimPoint = geometry.objectivePosition + geometry.opticalForward * max(range, 1)
            requestFrame(frame, aimPoint: aimPoint)
        }
        return mode != previous
    }

    private func requestFrame(_ frame: ARFrame, aimPoint: SIMD3<Float>) {
        guard !renderInFlight, frame.timestamp - lastRender >= 1.0 / 30.0 else { return }
        renderInFlight = true
        lastRender = frame.timestamp

        let resolution = frame.camera.imageResolution
        // Project the aim point into the captured (landscape-right sensor) image.
        let center = frame.camera.projectPoint(aimPoint, orientation: .landscapeRight, viewportSize: resolution)
        let zoom = min(max(zoomFactor, zoomRange.lowerBound), zoomRange.upperBound)
        let side = min(resolution.width, resolution.height) / CGFloat(zoom)
        let fx = Double(frame.camera.intrinsics[0][0])
        fieldOfViewRadians = Double(side) / fx

        let input = TelescopeRenderInput(pixelBuffer: frame.capturedImage, center: center, cropSide: side, outputSide: 720)
        Task { [renderer] in
            let rendered = await renderer.render(input)
            self.renderInFlight = false
            guard self.mode == .telescope, let rendered else { return }
            self.image = UIImage(cgImage: rendered.image)
        }
    }
}

// MARK: - Renderer (background queue)

struct TelescopeRenderInput: @unchecked Sendable {
    let pixelBuffer: CVPixelBuffer
    /// Crop centre in captured-image pixels (top-left origin).
    let center: CGPoint
    let cropSide: CGFloat
    let outputSide: CGFloat
}

struct RenderedFrame: @unchecked Sendable {
    let image: CGImage
}

final class TelescopeFrameRenderer: @unchecked Sendable {
    private let queue = DispatchQueue(label: "com.geoarpro.telescope", qos: .userInteractive)
    private let context = CIContext(options: [.cacheIntermediates: false])

    func render(_ input: TelescopeRenderInput) async -> RenderedFrame? {
        await withCheckedContinuation { continuation in
            queue.async {
                continuation.resume(returning: self.renderSync(input))
            }
        }
    }

    private func renderSync(_ input: TelescopeRenderInput) -> RenderedFrame? {
        let source = CIImage(cvPixelBuffer: input.pixelBuffer)
        let extent = source.extent
        let side = min(input.cropSide, extent.width, extent.height)
        // Core Image uses a bottom-left origin: flip y, then keep the square inside the frame.
        var rect = CGRect(x: input.center.x - side / 2, y: (extent.height - input.center.y) - side / 2,
                          width: side, height: side)
        rect.origin.x = min(max(rect.origin.x, extent.minX), extent.maxX - side)
        rect.origin.y = min(max(rect.origin.y, extent.minY), extent.maxY - side)

        var image = source.cropped(to: rect)
            .transformed(by: CGAffineTransform(translationX: -rect.minX, y: -rect.minY))
            // Sensor is landscape-right; rotate to the portrait UI.
            .oriented(.right)
        let scale = input.outputSide / side
        image = image.applyingFilter("CILanczosScaleTransform", parameters: [
            kCIInputScaleKey: scale,
            kCIInputAspectRatioKey: 1.0,
        ])
        // Mild luminance sharpening mimics the crisp look of a good objective.
        image = image.applyingFilter("CISharpenLuminance", parameters: [kCIInputSharpnessKey: 0.45])
        let output = image.extent.integral
        guard let cgImage = context.createCGImage(image, from: output) else { return nil }
        return RenderedFrame(image: cgImage)
    }
}
