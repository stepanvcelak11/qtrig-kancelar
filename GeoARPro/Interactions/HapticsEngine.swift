//
//  HapticsEngine.swift
//  GeoAR Pro: Surveying Simulator
//
//  Detent "ticks" for fine drives and foot screws, plus warnings. Ticks are
//  rate limited so fast knob spins feel like a ratchet instead of a buzz.
//

import Foundation
import QuartzCore
import UIKit

@MainActor
final class HapticsEngine {
    private let light = UIImpactFeedbackGenerator(style: .light)
    private let rigid = UIImpactFeedbackGenerator(style: .rigid)
    private let notification = UINotificationFeedbackGenerator()
    private var lastTick: CFTimeInterval = 0
    private var lastWarning: CFTimeInterval = 0

    /// Minimum spacing of detent ticks (the Taptic Engine blurs faster pulses).
    private let tickInterval: CFTimeInterval = 0.014

    func prepare() {
        light.prepare()
        rigid.prepare()
        notification.prepare()
    }

    /// One light tick per detent crossing (0.01 gon on the fine drives).
    func detents(_ count: Int) {
        guard count > 0 else { return }
        let now = CACurrentMediaTime()
        guard now - lastTick >= tickInterval else { return }
        lastTick = now
        light.impactOccurred(intensity: min(1, 0.55 + 0.08 * CGFloat(count)))
        light.prepare()
    }

    /// Hard stop: clamp engaged or end of screw travel.
    func blocked() {
        let now = CACurrentMediaTime()
        guard now - lastWarning > 0.35 else { return }
        lastWarning = now
        rigid.impactOccurred(intensity: 1)
    }

    func success() {
        notification.notificationOccurred(.success)
    }

    func warning() {
        notification.notificationOccurred(.warning)
    }

    func selection() {
        rigid.impactOccurred(intensity: 0.5)
    }
}
