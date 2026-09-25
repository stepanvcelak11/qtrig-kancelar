//
//  GlassStyle.swift
//  GeoAR Pro: Surveying Simulator
//
//  Glassmorphism building blocks shared by all overlays.
//

import Foundation
import SwiftUI

extension Color {
    static let surveyAccent = Color(red: 0.25, green: 0.86, blue: 1.0)
    static let surveyGreen = Color(red: 0.36, green: 0.92, blue: 0.55)
    static let surveyAmber = Color(red: 1.0, green: 0.74, blue: 0.2)
    static let surveyRed = Color(red: 1.0, green: 0.36, blue: 0.33)
}

struct GlassBackground: ViewModifier {
    var cornerRadius: CGFloat = 22
    var tint: Color = .white

    func body(content: Content) -> some View {
        content
            .background {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay {
                        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                            .fill(LinearGradient(colors: [tint.opacity(0.10), .clear],
                                                 startPoint: .topLeading, endPoint: .bottomTrailing))
                    }
                    .overlay {
                        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                            .strokeBorder(LinearGradient(colors: [.white.opacity(0.45), .white.opacity(0.05)],
                                                         startPoint: .topLeading, endPoint: .bottomTrailing),
                                          lineWidth: 1)
                    }
                    .shadow(color: .black.opacity(0.35), radius: 18, y: 8)
            }
    }
}

extension View {
    func glass(cornerRadius: CGFloat = 22, tint: Color = .white) -> some View {
        modifier(GlassBackground(cornerRadius: cornerRadius, tint: tint))
    }
}

/// Capsule toggle used for clamps, hold and compensator switches.
struct GlassToggleChip: View {
    var title: String
    var systemImage: String
    var isOn: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.caption.weight(.semibold))
                .labelStyle(.titleAndIcon)
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .foregroundStyle(isOn ? Color.black : Color.white)
                .background(Capsule().fill(isOn ? AnyShapeStyle(Color.surveyAccent) : AnyShapeStyle(.ultraThinMaterial)))
                .overlay(Capsule().strokeBorder(.white.opacity(isOn ? 0 : 0.25), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: isOn)
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }
}

/// Prominent action button.
struct GlassActionButton: View {
    var title: String
    var systemImage: String
    var prominent = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity)
                .foregroundStyle(prominent ? Color.black : Color.white)
                .background {
                    Capsule().fill(prominent ? AnyShapeStyle(Color.surveyAccent.gradient) : AnyShapeStyle(.ultraThinMaterial))
                }
                .overlay(Capsule().strokeBorder(.white.opacity(prominent ? 0 : 0.25), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

/// Label + monospaced value cell for readouts.
struct ReadoutCell: View {
    var label: String
    var value: String
    var unit: String = ""
    var emphasized = false

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(value)
                    .font(.system(emphasized ? .title3 : .callout, design: .monospaced).weight(.semibold))
                    .contentTransition(.numericText())
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                if !unit.isEmpty {
                    Text(unit).font(.caption2).foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
