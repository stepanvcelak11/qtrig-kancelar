//
//  TelescopeView.swift
//  GeoAR Pro: Surveying Simulator
//
//  Full-screen eyepiece view: magnified camera crop through the optics
//  shader, reticle with 1:100 stadia hairs, live measurements and on-screen
//  fine drives (the real knobs are out of reach while looking through).
//

import Foundation
import SwiftUI

struct TelescopeView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let scene = model.scene
        let optics = scene.optics
        GeometryReader { geometry in
            // Landscape: eyepiece on the left, readings and drives on the right.
            let diameter = min(geometry.size.height - 16, geometry.size.width * 0.55)
            ZStack {
                Color.black.ignoresSafeArea()
                HStack(spacing: 16) {
                    ZStack {
                        eyepieceImage(optics: optics, diameter: diameter, defocus: scene.defocus)
                        ReticleView(fieldOfView: optics.fieldOfViewRadians)
                            .frame(width: diameter, height: diameter)
                            .clipShape(Circle())
                            .allowsHitTesting(false)
                    }
                    .frame(width: diameter, height: diameter)
                    .overlay(Circle().strokeBorder(.black, lineWidth: 6))
                    .shadow(color: .surveyAccent.opacity(0.15), radius: 30)

                    ScrollView(showsIndicators: false) {
                        VStack(spacing: 12) {
                            header
                            TelescopeMeasurementPanel()
                            TelescopeDriveControls()
                        }
                    }
                    .frame(maxWidth: 400)
                }
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Dalekohled")
                    .font(.headline)
                Text("Oddalte telefon pro návrat do AR")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button {
                model.scene.exitTelescope()
            } label: {
                Image(systemName: "xmark")
                    .font(.headline)
                    .padding(10)
                    .background(Circle().fill(.ultraThinMaterial))
            }
            .accessibilityLabel("Opustit dalekohled")
        }
        .padding(.top, 8)
    }

    @ViewBuilder
    private func eyepieceImage(optics: EyepiecePassThroughService, diameter: CGFloat, defocus: Double) -> some View {
        Group {
            if let image = optics.image {
                Image(uiImage: image)
                    .resizable()
                    .interpolation(.high)
                    .aspectRatio(contentMode: .fill)
            } else {
                Color(white: 0.08)
                    .overlay(ProgressView().tint(.white))
            }
        }
        .frame(width: diameter, height: diameter)
        .clipped()
        .layerEffect(ShaderLibrary.eyepieceOptics(.float2(CGSize(width: diameter, height: diameter)),
                                                  .float(2.2),
                                                  // Dioptre mismatch → blur radius in points.
                                                  .float(Float(min(defocus * 60, 14)))),
                     maxSampleOffset: CGSize(width: 16, height: 16))
    }
}

/// Crosshair, double bisecting lines and stadia hairs. Stadia hairs subtend
/// ±1/200 rad so that D = 100 · (upper − lower rod reading).
struct ReticleView: View {
    /// Angular diameter of the visible field (radians).
    let fieldOfView: Double

    var body: some View {
        Canvas { context, size in
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            let pointsPerRadian = size.width / CGFloat(max(fieldOfView, 1e-5))
            let stadia = pointsPerRadian * 0.005
            let ink = GraphicsContext.Shading.color(.black.opacity(0.9))
            let halo = GraphicsContext.Shading.color(.white.opacity(0.25))

            var cross = Path()
            cross.move(to: CGPoint(x: 0, y: c.y)); cross.addLine(to: CGPoint(x: size.width, y: c.y))
            cross.move(to: CGPoint(x: c.x, y: 0)); cross.addLine(to: CGPoint(x: c.x, y: size.height))
            context.stroke(cross, with: halo, lineWidth: 2.2)
            context.stroke(cross, with: ink, lineWidth: 0.9)

            // Double lines (bisecting wedge) on the upper vertical and the right horizontal hair.
            var doubles = Path()
            let gap: CGFloat = 3.5
            doubles.move(to: CGPoint(x: c.x - gap, y: size.height * 0.08)); doubles.addLine(to: CGPoint(x: c.x - gap, y: c.y - size.height * 0.18))
            doubles.move(to: CGPoint(x: c.x + gap, y: size.height * 0.08)); doubles.addLine(to: CGPoint(x: c.x + gap, y: c.y - size.height * 0.18))
            doubles.move(to: CGPoint(x: c.x + size.width * 0.18, y: c.y - gap)); doubles.addLine(to: CGPoint(x: size.width * 0.92, y: c.y - gap))
            doubles.move(to: CGPoint(x: c.x + size.width * 0.18, y: c.y + gap)); doubles.addLine(to: CGPoint(x: size.width * 0.92, y: c.y + gap))
            context.stroke(doubles, with: ink, lineWidth: 0.8)

            // Stadia hairs (only drawn while they fit inside the field).
            if stadia < size.height * 0.45 {
                var hairs = Path()
                let half = size.width * 0.09
                hairs.move(to: CGPoint(x: c.x - half, y: c.y - stadia)); hairs.addLine(to: CGPoint(x: c.x + half, y: c.y - stadia))
                hairs.move(to: CGPoint(x: c.x - half, y: c.y + stadia)); hairs.addLine(to: CGPoint(x: c.x + half, y: c.y + stadia))
                context.stroke(hairs, with: halo, lineWidth: 2)
                context.stroke(hairs, with: ink, lineWidth: 0.9)
            }
        }
    }
}

struct TelescopeMeasurementPanel: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let scene = model.scene
        let readout = scene.readout
        let unit = scene.angleUnit
        VStack(spacing: 8) {
            HStack {
                ReadoutCell(label: "Hz", value: GeodeticMath.format(readout.angles?.hz, unit: unit))
                if readout.isAutomaticLevel {
                    ReadoutCell(label: "Lať", value: GeodeticMath.formatDistance(readout.rod?.reading), unit: "m")
                } else {
                    ReadoutCell(label: "Zenitový úhel", value: GeodeticMath.format(readout.angles?.v, unit: unit))
                }
                ReadoutCell(label: "Azimut (síť)", value: GeodeticMath.format(readout.gridAzimuth, unit: unit, decimals: 2))
            }
            HStack {
                ReadoutCell(label: readout.isAutomaticLevel ? "Dálka (rysky)" : "SD", value: GeodeticMath.formatDistance(readout.distance?.slope), unit: "m")
                if let rod = readout.rod {
                    ReadoutCell(label: "Horní / dolní", value: String(format: "%.3f / %.3f", rod.upperStadia, rod.lowerStadia))
                } else {
                    ReadoutCell(label: "HD", value: GeodeticMath.formatDistance(readout.horizontalDistance), unit: "m")
                }
                ReadoutCell(label: "Ostření", value: String(format: "%.1f", scene.focusDistance), unit: "m")
            }
            if let angles = readout.angles, angles.levelState == .outOfRange, angles.compensatorEnabled {
                Label("Sklon mimo rozsah kompenzátoru – zhorizontujte přístroj", systemImage: "exclamationmark.triangle.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.surveyRed)
            }
        }
        .padding(12)
        .glass(cornerRadius: 18)
    }
}

/// Jog wheels for the fine drives and focus, with a zoom slider.
struct TelescopeDriveControls: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var optics = model.scene.optics
        let scene = model.scene
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                JogWheel(title: "Hz ustanovka", systemImage: "arrow.left.and.right") { scene.jog(.horizontalTangent, turns: $0) }
                if !scene.isLevelInstrument {
                    JogWheel(title: "V drive", systemImage: "arrow.up.and.down") { scene.jog(.verticalTangent, turns: $0) }
                }
                JogWheel(title: "Ostření", systemImage: "camera.metering.center.weighted") { scene.jog(.focusKnob, turns: $0) }
            }
            HStack {
                Image(systemName: "plus.magnifyingglass")
                Slider(value: $optics.zoomFactor, in: optics.zoomRange, step: 1)
                    .tint(Color.surveyAccent)
                Text("\(Int(optics.zoomFactor))×")
                    .font(.caption.monospacedDigit())
                    .frame(width: 34)
                Button("AF") { scene.autoFocus() }
                    .font(.caption.weight(.bold))
                    .buttonStyle(.bordered)
            }
        }
        .padding(12)
        .glass(cornerRadius: 18)
    }
}

/// Horizontal drag strip acting as an endless knob: 120 pt of drag = 1 revolution.
struct JogWheel: View {
    let title: String
    let systemImage: String
    let onTurn: (Double) -> Void

    @State private var lastTranslation: CGFloat = 0
    @State private var phase: CGFloat = 0

    var body: some View {
        VStack(spacing: 4) {
            Label(title, systemImage: systemImage)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            Canvas { context, size in
                // Knurled wheel texture that scrolls with the drag.
                let spacing: CGFloat = 7
                var x = phase.truncatingRemainder(dividingBy: spacing)
                while x < size.width {
                    let t: Double = Double(abs(x - size.width / 2) / (size.width / 2))
                    var line = Path()
                    line.move(to: CGPoint(x: x, y: 4))
                    line.addLine(to: CGPoint(x: x, y: size.height - 4))
                    let alpha: Double = 0.55 * (1 - t * 0.8)
                    context.stroke(line, with: .color(Color.white.opacity(alpha)), lineWidth: 1.5)
                    x += spacing
                }
            }
            .frame(height: 38)
            .background(RoundedRectangle(cornerRadius: 10).fill(Color(white: 0.12)))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(.white.opacity(0.2)))
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        let delta = value.translation.width - lastTranslation
                        lastTranslation = value.translation.width
                        phase += delta
                        onTurn(Double(delta) / 120)
                    }
                    .onEnded { _ in lastTranslation = 0 }
            )
            .accessibilityElement()
            .accessibilityLabel(title)
            .accessibilityAdjustableAction { direction in
                onTurn(direction == .increment ? 0.04 : -0.04)
            }
        }
    }
}
