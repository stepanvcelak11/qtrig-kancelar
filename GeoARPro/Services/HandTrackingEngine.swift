//
//  HandTrackingEngine.swift
//  GeoAR Pro: Surveying Simulator
//
//  Real-time hand tracking on the back-camera stream:
//
//   1. `ARSessionDelegate` delivers every `ARFrame` on the main thread.
//   2. At most one frame at a time is handed to `HandPoseDetector`, which runs
//      `VNDetectHumanHandPoseRequest` on a private serial queue.
//   3. Index-tip / thumb-tip / wrist joints come back in captured-image pixel
//      coordinates, together with LiDAR depth sampled at the fingertips.
//   4. Pixels are un-projected with the camera intrinsics into world rays
//      (and, with depth, world points) using the camera pose OF THAT FRAME,
//      so latency does not skew the 3-D result.
//   5. A pinch is detected when the 3-D thumb–index distance drops below
//      3 cm (with hysteresis); without LiDAR the distance is estimated from
//      the hand's own scale (wrist → middle MCP ≈ 9.5 cm).
//

import ARKit
import CoreGraphics
import CoreVideo
import Foundation
import Observation
import simd
import Vision

// MARK: - Sendable transport types

/// Pixel buffers are immutable once ARKit hands them out; wrapping them lets
/// them cross into the detection queue under Swift 6 strict concurrency.
struct FrameBuffers: @unchecked Sendable {
    let image: CVPixelBuffer
    let depth: CVPixelBuffer?
}

/// Camera geometry captured together with the frame (all value types).
struct FrameGeometry: Sendable {
    var cameraTransform: simd_float4x4
    var intrinsics: simd_float3x3
    var imageResolution: CGSize
    var displayTransform: CGAffineTransform
    var viewportSize: CGSize
    var timestamp: TimeInterval

    /// World ray through an image pixel (top-left origin, sensor orientation).
    ///
    /// Pinhole model: x_c = (u − cₓ)/fₓ,  y_c = −(v − c_y)/f_y,  z_c = −1
    /// (ARKit camera space: +X right along the sensor, +Y up, −Z forward).
    func ray(throughPixel p: CGPoint) -> (origin: SIMD3<Float>, direction: SIMD3<Float>) {
        let fx = intrinsics[0][0], fy = intrinsics[1][1]
        let cx = intrinsics[2][0], cy = intrinsics[2][1]
        let dirCamera = SIMD3<Float>((Float(p.x) - cx) / fx, -(Float(p.y) - cy) / fy, -1)
        let dirWorld = (cameraTransform * SIMD4(dirCamera, 0)).xyz
        return (cameraTransform.columns.3.xyz, simd_normalize(dirWorld))
    }

    /// World point at a LiDAR z-depth (depth is measured along the camera −Z
    /// axis, not along the ray, hence the scaling by the un-normalised ray).
    func worldPoint(atPixel p: CGPoint, depth: Float) -> SIMD3<Float> {
        let fx = intrinsics[0][0], fy = intrinsics[1][1]
        let cx = intrinsics[2][0], cy = intrinsics[2][1]
        let pCamera = SIMD3<Float>((Float(p.x) - cx) / fx * depth, -(Float(p.y) - cy) / fy * depth, -depth)
        return (cameraTransform * SIMD4(pCamera, 1)).xyz
    }

    /// Captured-image pixel → view point (UIKit coordinates).
    func viewPoint(forPixel p: CGPoint) -> CGPoint {
        let normalized = CGPoint(x: p.x / imageResolution.width, y: p.y / imageResolution.height)
        let n = normalized.applying(displayTransform)
        return CGPoint(x: n.x * viewportSize.width, y: n.y * viewportSize.height)
    }
}

/// Raw detector output in captured-image pixels (top-left origin).
struct HandPoseSample: Sendable {
    var indexTip: CGPoint
    var thumbTip: CGPoint
    var wrist: CGPoint?
    var middleMCP: CGPoint?
    var indexDepth: Float?
    var thumbDepth: Float?
    var confidence: Float
}

/// Fully resolved hand state delivered to the interaction layer.
struct HandTrackingResult: Sendable, Equatable {
    var timestamp: TimeInterval
    var indexTipScreen: CGPoint
    var thumbTipScreen: CGPoint
    var rayOrigin: SIMD3<Float>
    var rayDirection: SIMD3<Float>
    var indexTipWorld: SIMD3<Float>?
    var thumbTipWorld: SIMD3<Float>?
    /// Thumb–index distance (metres), measured (LiDAR) or estimated.
    var pinchDistance: Float
    var pinchDistanceMeasured: Bool
    var isPinching: Bool
    /// Screen-space angle of the thumb→index vector (radians, clockwise positive).
    var roll: Double
    var confidence: Float
}

// MARK: - Detector (background queue)

final class HandPoseDetector: @unchecked Sendable {
    // Both are only touched on `queue`.
    private let queue = DispatchQueue(label: "com.geoarpro.handpose", qos: .userInteractive)
    private let request: VNDetectHumanHandPoseRequest

    init() {
        request = VNDetectHumanHandPoseRequest()
        request.maximumHandCount = 1
    }

    func detect(_ buffers: FrameBuffers) async -> HandPoseSample? {
        await withCheckedContinuation { continuation in
            queue.async {
                continuation.resume(returning: self.performDetection(buffers))
            }
        }
    }

    private func performDetection(_ buffers: FrameBuffers) -> HandPoseSample? {
        // `.up`: keep Vision in the sensor's native (landscape) orientation so
        // the returned coordinates match the camera intrinsics directly.
        let handler = VNImageRequestHandler(cvPixelBuffer: buffers.image, orientation: .up, options: [:])
        do {
            try handler.perform([request])
        } catch {
            return nil
        }
        guard let observation = request.results?.first,
              let points = try? observation.recognizedPoints(.all) else { return nil }

        let width = CGFloat(CVPixelBufferGetWidth(buffers.image))
        let height = CGFloat(CVPixelBufferGetHeight(buffers.image))

        // Vision: normalised, origin bottom-left → pixels, origin top-left.
        func pixel(_ name: VNHumanHandPoseObservation.JointName, minConfidence: Float = 0.3) -> CGPoint? {
            guard let p = points[name], p.confidence >= minConfidence else { return nil }
            return CGPoint(x: p.location.x * width, y: (1 - p.location.y) * height)
        }

        guard let index = pixel(.indexTip), let thumb = pixel(.thumbTip) else { return nil }
        let confidence = min(points[.indexTip]?.confidence ?? 0, points[.thumbTip]?.confidence ?? 0)

        var sample = HandPoseSample(indexTip: index, thumbTip: thumb,
                                    wrist: pixel(.wrist, minConfidence: 0.2),
                                    middleMCP: pixel(.middleMCP, minConfidence: 0.2),
                                    indexDepth: nil, thumbDepth: nil, confidence: confidence)
        if let depth = buffers.depth {
            sample.indexDepth = Self.sampleDepth(depth, atNormalized: CGPoint(x: index.x / width, y: index.y / height))
            sample.thumbDepth = Self.sampleDepth(depth, atNormalized: CGPoint(x: thumb.x / width, y: thumb.y / height))
        }
        return sample
    }

    /// Samples the LiDAR depth map (Float32 metres, same field of view as the
    /// colour image) in a 5×5 window. The fingertip is the NEAREST surface
    /// around the joint, so the lower quartile is used rather than the median,
    /// which would often land on the background behind the finger.
    static func sampleDepth(_ map: CVPixelBuffer, atNormalized p: CGPoint) -> Float? {
        CVPixelBufferLockBaseAddress(map, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(map, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddress(map) else { return nil }
        let width = CVPixelBufferGetWidth(map)
        let height = CVPixelBufferGetHeight(map)
        let rowBytes = CVPixelBufferGetBytesPerRow(map)
        let cx = Int(p.x * CGFloat(width)), cy = Int(p.y * CGFloat(height))
        var samples: [Float] = []
        samples.reserveCapacity(25)
        for dy in -2...2 {
            let y = min(max(cy + dy, 0), height - 1)
            let row = base.advanced(by: y * rowBytes).assumingMemoryBound(to: Float32.self)
            for dx in -2...2 {
                let x = min(max(cx + dx, 0), width - 1)
                let v = row[x]
                if v.isFinite && v > 0.05 && v < 5 { samples.append(v) }
            }
        }
        guard samples.count >= 4 else { return nil }
        samples.sort()
        return samples[samples.count / 4]
    }
}

// MARK: - Engine (main actor)

@MainActor
@Observable
final class HandTrackingEngine {
    /// Latest resolved hand state (nil = no hand).
    private(set) var latest: HandTrackingResult?
    private(set) var framesPerSecond: Double = 0
    var isEnabled = true {
        didSet { if !isEnabled { reset() } }
    }

    /// Called on the main actor for every processed frame.
    @ObservationIgnored var onResult: (@MainActor (HandTrackingResult?) -> Void)?

    @ObservationIgnored private let detector = HandPoseDetector()
    @ObservationIgnored private var inFlight = false
    @ObservationIgnored private var lastSubmit: TimeInterval = 0
    @ObservationIgnored private var indexFilter = OneEuroFilter2D(minCutoff: 1.5, beta: 0.015)
    @ObservationIgnored private var thumbFilter = OneEuroFilter2D(minCutoff: 1.5, beta: 0.015)
    @ObservationIgnored private var depthFilter = OneEuroFilter(minCutoff: 2.0, beta: 0.5)
    @ObservationIgnored private var rollFilter = OneEuroFilter(minCutoff: 2.0, beta: 0.05)
    @ObservationIgnored private var unwrappedRoll: Double?
    @ObservationIgnored private var pinching = false
    @ObservationIgnored private var missedFrames = 0
    @ObservationIgnored private var fpsWindow: [TimeInterval] = []

    /// Pinch hysteresis: engage below 3 cm, release above 4.5 cm.
    let pinchEngageDistance: Float = 0.03
    let pinchReleaseDistance: Float = 0.045
    /// Target processing rate (Vision is the bottleneck on older devices).
    let maximumRate: Double = 30

    func reset() {
        latest = nil
        pinching = false
        unwrappedRoll = nil
        indexFilter.reset()
        thumbFilter.reset()
        depthFilter.reset()
        rollFilter.reset()
    }

    /// Submits an AR frame. Frames are dropped while a detection is in flight.
    func submit(_ frame: ARFrame, viewportSize: CGSize) {
        guard isEnabled, !inFlight, viewportSize.width > 0,
              frame.timestamp - lastSubmit >= 1.0 / maximumRate else { return }
        inFlight = true
        lastSubmit = frame.timestamp

        let depth = (frame.smoothedSceneDepth ?? frame.sceneDepth)?.depthMap
        let buffers = FrameBuffers(image: frame.capturedImage, depth: depth)
        let geometry = FrameGeometry(
            cameraTransform: frame.camera.transform,
            intrinsics: frame.camera.intrinsics,
            imageResolution: frame.camera.imageResolution,
            displayTransform: frame.displayTransform(for: .portrait, viewportSize: viewportSize),
            viewportSize: viewportSize,
            timestamp: frame.timestamp)

        Task { [detector] in
            let sample = await detector.detect(buffers)
            self.inFlight = false
            self.handle(sample, geometry: geometry)
        }
    }

    private func handle(_ sample: HandPoseSample?, geometry: FrameGeometry) {
        guard isEnabled else { return }
        updateRate(geometry.timestamp)

        guard let sample else {
            // Tolerate a few dropped detections before declaring the hand lost.
            missedFrames += 1
            if missedFrames > 4, latest != nil {
                reset()
                onResult?(nil)
            }
            return
        }
        missedFrames = 0
        let t = geometry.timestamp

        let index = indexFilter.filter(SIMD2(Double(sample.indexTip.x), Double(sample.indexTip.y)), timestamp: t)
        let thumb = thumbFilter.filter(SIMD2(Double(sample.thumbTip.x), Double(sample.thumbTip.y)), timestamp: t)
        let indexPixel = CGPoint(x: index.x, y: index.y)
        let thumbPixel = CGPoint(x: thumb.x, y: thumb.y)

        let ray = geometry.ray(throughPixel: indexPixel)
        var indexWorld: SIMD3<Float>?
        var thumbWorld: SIMD3<Float>?
        if let d = sample.indexDepth {
            let smoothed = Float(depthFilter.filter(Double(d), timestamp: t))
            indexWorld = geometry.worldPoint(atPixel: indexPixel, depth: smoothed)
            if let td = sample.thumbDepth {
                thumbWorld = geometry.worldPoint(atPixel: thumbPixel, depth: td)
            }
        }

        // Pinch distance: metric from LiDAR when both tips have depth,
        // otherwise scaled by the hand's apparent size.
        let pinchDistance: Float
        let measured: Bool
        if let a = indexWorld, let b = thumbWorld, abs(simd_distance(a, ray.origin) - simd_distance(b, ray.origin)) < 0.08 {
            pinchDistance = simd_distance(a, b)
            measured = true
        } else {
            let tipsPx = hypot(index.x - thumb.x, index.y - thumb.y)
            let palmPx: Double
            if let w = sample.wrist, let m = sample.middleMCP {
                palmPx = Double(hypot(w.x - m.x, w.y - m.y))
            } else {
                palmPx = 0
            }
            pinchDistance = palmPx > 8 ? Float(tipsPx / palmPx * 0.095) : Float(tipsPx) * 0.0005
            measured = false
        }

        if pinching {
            if pinchDistance > pinchReleaseDistance { pinching = false }
        } else if pinchDistance < pinchEngageDistance {
            pinching = true
        }

        // Roll of the pinch (thumb → index) in SCREEN space; unwrapped so a
        // continuous twist yields a continuous angle for the screw drives.
        let indexScreen = geometry.viewPoint(forPixel: indexPixel)
        let thumbScreen = geometry.viewPoint(forPixel: thumbPixel)
        let rawRoll = atan2(Double(indexScreen.y - thumbScreen.y), Double(indexScreen.x - thumbScreen.x))
        let continuous: Double
        if let previous = unwrappedRoll {
            continuous = previous + GeodeticMath.wrappedToPi(rawRoll - previous)
        } else {
            continuous = rawRoll
        }
        unwrappedRoll = continuous
        let roll = rollFilter.filter(continuous, timestamp: t)

        let result = HandTrackingResult(
            timestamp: t,
            indexTipScreen: indexScreen,
            thumbTipScreen: thumbScreen,
            rayOrigin: ray.origin,
            rayDirection: ray.direction,
            indexTipWorld: indexWorld,
            thumbTipWorld: thumbWorld,
            pinchDistance: pinchDistance,
            pinchDistanceMeasured: measured,
            isPinching: pinching,
            roll: roll,
            confidence: sample.confidence)
        latest = result
        onResult?(result)
    }

    private func updateRate(_ timestamp: TimeInterval) {
        fpsWindow.append(timestamp)
        fpsWindow.removeAll { timestamp - $0 > 1 }
        framesPerSecond = Double(fpsWindow.count)
    }
}
