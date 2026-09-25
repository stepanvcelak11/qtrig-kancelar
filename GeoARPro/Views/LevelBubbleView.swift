//
//  LevelBubbleView.swift
//  GeoAR Pro: Surveying Simulator
//
//  HUD twin of the in-scene circular level plus the electronic level
//  read-out (longitudinal / transverse tilt). The bubble is drawn in the
//  viewer's frame: right = screen right, down = towards the viewer, so it
//  moves the same way as the bubble seen on the virtual tribrach.
//

import SwiftUI

struct LevelBubbleView: View {
    let state: LevelIndicatorState
    let unit: AngleUnit

    private let diameter: CGFloat = 96

    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                // Vial with fluid gradient.
                Circle()
                    .fill(RadialGradient(colors: [Color(red: 0.78, green: 0.92, blue: 0.45), Color(red: 0.42, green: 0.62, blue: 0.2)],
                                         center: .center, startRadius: 2, endRadius: diameter / 2))
                    .overlay(Circle().strokeBorder(.black.opacity(0.6), lineWidth: 3))
                // Reference circles: compensator range (outer) and "levelled" target (inner).
                Circle().stroke(.black.opacity(0.75), lineWidth: 1.5).frame(width: diameter * 0.34)
                Circle().stroke(.black.opacity(0.35), style: StrokeStyle(lineWidth: 1, dash: [3, 3])).frame(width: diameter * 0.62)
                Path { p in
                    p.move(to: CGPoint(x: diameter / 2, y: 6)); p.addLine(to: CGPoint(x: diameter / 2, y: diameter - 6))
                    p.move(to: CGPoint(x: 6, y: diameter / 2)); p.addLine(to: CGPoint(x: diameter - 6, y: diameter / 2))
                }
                .stroke(.black.opacity(0.18), lineWidth: 1)

                // Bubble.
                Circle()
                    .fill(RadialGradient(colors: [.white, Color(white: 0.92).opacity(0.85)],
                                         center: UnitPoint(x: 0.35, y: 0.3), startRadius: 1, endRadius: 14))
                    .overlay(Circle().stroke(.black.opacity(0.25), lineWidth: 0.5))
                    .frame(width: diameter * 0.26, height: diameter * 0.26)
                    .shadow(color: .white.opacity(0.6), radius: 3)
                    .offset(bubbleOffset)
                    .animation(.interpolatingSpring(stiffness: 120, damping: 14), value: state.bubbleOffset)
            }
            .frame(width: diameter, height: diameter)
            .clipShape(Circle())

            VStack(spacing: 2) {
                Text(tiltText)
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(stateColor)
                if state.longitudinal != 0 || state.transverse != 0 {
                    Text("l \(GeodeticMath.formatSmallAngle(state.longitudinal, unit: unit))")
                    Text("t \(GeodeticMath.formatSmallAngle(state.transverse, unit: unit))")
                }
            }
            .font(.caption2.monospacedDigit())
            .foregroundStyle(.secondary)
        }
        .padding(10)
        .glass(cornerRadius: 20)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Circular level: \(state.state.title), tilt \(tiltText)")
    }

    private var bubbleOffset: CGSize {
        let travel = diameter / 2 - diameter * 0.13
        let x = max(-1, min(1, state.bubbleOffset.x))
        let y = max(-1, min(1, state.bubbleOffset.y))
        return CGSize(width: x * travel, height: y * travel)
    }

    private var tiltText: String {
        let arcsec = GeodeticMath.toArcseconds(state.tiltMagnitude)
        if arcsec >= 60 {
            return String(format: "%.1f′", arcsec / 60)
        }
        return String(format: "%.0f″", arcsec)
    }

    private var stateColor: Color {
        switch state.state {
        case .leveled: .surveyGreen
        case .compensated: .surveyAmber
        case .outOfRange: .surveyRed
        }
    }
}
