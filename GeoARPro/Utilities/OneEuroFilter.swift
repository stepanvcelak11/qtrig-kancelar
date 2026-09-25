//
//  OneEuroFilter.swift
//  GeoAR Pro: Surveying Simulator
//
//  1€ filter (Casiez, Roussel & Vogel, CHI 2012) — an adaptive low-pass filter
//  that removes jitter from slow hand movements while keeping fast movements
//  responsive. Used to stabilise Vision hand joints and LiDAR depth samples.
//

import Foundation
import simd

struct OneEuroFilter: Sendable {
    /// Minimum cutoff frequency (Hz). Lower = smoother at rest.
    var minCutoff: Double
    /// Speed coefficient. Higher = less lag during fast motion.
    var beta: Double
    /// Cutoff used for the derivative estimate (Hz).
    var derivativeCutoff: Double

    private var previousValue: Double?
    private var previousDerivative: Double = 0
    private var previousTimestamp: Double?

    init(minCutoff: Double = 1.2, beta: Double = 0.02, derivativeCutoff: Double = 1.0) {
        self.minCutoff = minCutoff
        self.beta = beta
        self.derivativeCutoff = derivativeCutoff
    }

    mutating func reset() {
        previousValue = nil
        previousDerivative = 0
        previousTimestamp = nil
    }

    mutating func filter(_ value: Double, timestamp: Double) -> Double {
        guard let prev = previousValue, let prevT = previousTimestamp, timestamp > prevT else {
            previousValue = value
            previousTimestamp = timestamp
            return value
        }
        let dt = timestamp - prevT
        // Estimate and smooth the signal's speed.
        let derivative = (value - prev) / dt
        let aD = Self.alpha(cutoff: derivativeCutoff, dt: dt)
        let smoothedDerivative = aD * derivative + (1 - aD) * previousDerivative
        // Adapt the cutoff to the speed: fast motion → higher cutoff → less lag.
        let cutoff = minCutoff + beta * abs(smoothedDerivative)
        let a = Self.alpha(cutoff: cutoff, dt: dt)
        let result = a * value + (1 - a) * prev

        previousValue = result
        previousDerivative = smoothedDerivative
        previousTimestamp = timestamp
        return result
    }

    /// Smoothing factor of a first-order low-pass with the given cutoff.
    private static func alpha(cutoff: Double, dt: Double) -> Double {
        let tau = 1.0 / (2.0 * Double.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)
    }
}

struct OneEuroFilter2D: Sendable {
    private var x: OneEuroFilter
    private var y: OneEuroFilter

    init(minCutoff: Double = 1.2, beta: Double = 0.02) {
        x = OneEuroFilter(minCutoff: minCutoff, beta: beta)
        y = OneEuroFilter(minCutoff: minCutoff, beta: beta)
    }

    mutating func reset() {
        x.reset()
        y.reset()
    }

    mutating func filter(_ p: SIMD2<Double>, timestamp: Double) -> SIMD2<Double> {
        SIMD2(x.filter(p.x, timestamp: timestamp), y.filter(p.y, timestamp: timestamp))
    }
}
