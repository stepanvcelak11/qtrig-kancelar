//
//  CatalogOverlayView.swift
//  GeoAR Pro: Surveying Simulator
//
//  Glassmorphism overlay: status HUD (level state, Hz / V / distances or GNSS
//  solution), mode toggles, instrument controls, circular level indicator and
//  the bottom equipment catalogue drawer.
//

import Foundation
import SwiftUI

struct CatalogOverlayView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let scene = model.scene
        // Landscape layout: status + instrument controls on the left, circular level
        // and the equipment catalogue on the right, the AR scene in between.
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 8) {
                StatusHUDView()
                    .frame(maxWidth: 440)
                if scene.clamps.hasInstrument {
                    ScrollView(showsIndicators: false) {
                        InstrumentControlPanel()
                            .padding(.leading, 12)
                    }
                    .transition(.move(edge: .leading).combined(with: .opacity))
                }
                Spacer(minLength: 0)
                EyepieceHint()
                    .padding(.leading, 12)
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 8) {
                if scene.level.isAvailable {
                    LevelBubbleView(state: scene.level, unit: scene.angleUnit)
                        .padding(.trailing, 12)
                        .padding(.top, 8)
                        .transition(.move(edge: .trailing).combined(with: .opacity))
                }
                Spacer(minLength: 0)
                if scene.isPlacing {
                    PlacementBar()
                        .frame(width: 380)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                } else {
                    EquipmentDrawer()
                        .frame(width: 400)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        }
        .padding(.bottom, 6)
        .animation(.spring(response: 0.4, dampingFraction: 0.85), value: scene.isPlacing)
        .animation(.spring(response: 0.4, dampingFraction: 0.85), value: scene.clamps.hasInstrument)
    }
}

// MARK: - Top HUD

struct StatusHUDView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var scene = model.scene
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(scene.activeModel?.displayName ?? "GeoAR Pro")
                        .font(.headline)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer()
                statusPill
            }

            if scene.gnss != nil {
                GNSSReadoutGrid()
            } else if scene.clamps.hasInstrument {
                InstrumentReadoutGrid()
            }

            HStack(spacing: 8) {
                Picker("Interaction", selection: $scene.interactionMode) {
                    ForEach(InteractionMode.allCases) { mode in
                        Label(mode.title, systemImage: mode.systemImage).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 170)

                Picker("Units", selection: $scene.angleUnit) {
                    ForEach(AngleUnit.allCases) { unit in Text(unit.label).tag(unit) }
                }
                .pickerStyle(.menu)
                .tint(.white)

                Spacer(minLength: 0)

                if scene.activeModel != nil {
                    Button {
                        scene.beginReposition()
                    } label: {
                        Image(systemName: "arrow.up.and.down.and.arrow.left.and.right")
                            .font(.subheadline.weight(.semibold))
                            .padding(9)
                            .background(Circle().fill(.ultraThinMaterial))
                    }
                    .accessibilityLabel("Reposition tripod")
                }
                Button {
                    model.placeSelected()
                } label: {
                    Image(systemName: "plus.viewfinder")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.black)
                        .padding(9)
                        .background(Circle().fill(Color.surveyAccent))
                }
                .accessibilityLabel("Place instrument")
            }

            if scene.showNoHandHint {
                Label("No hand detected — switch to Touch mode for manual control", systemImage: "hand.raised.slash")
                    .font(.caption)
                    .foregroundStyle(Color.surveyAmber)
                    .onTapGesture { scene.interactionMode = .touch }
            }
        }
        .padding(14)
        .glass()
        .padding(.horizontal, 12)
        .padding(.top, 8)
    }

    private var subtitle: String {
        let scene = model.scene
        if let message = scene.trackingMessage { return message }
        if let engaged = scene.engagedPart { return "Operating: \(engaged.displayName)" }
        if let hovered = scene.hoveredPart { return hovered.displayName }
        if scene.activeModel == nil { return "Pick equipment below and place it" }
        return scene.interactionMode == .handTracking
            ? "Touch the body to rotate · pinch & twist the knobs"
            : "Drag the body / telescope · drag or twist the knobs"
    }

    @ViewBuilder private var statusPill: some View {
        let scene = model.scene
        if let gnss = scene.gnss {
            pill(gnss.fix.rawValue, color: gnss.fix == .rtkFixed ? .surveyGreen : (gnss.fix == .rtkFloat ? .surveyAmber : .surveyRed))
        } else if scene.level.isAvailable {
            let state = scene.level.state
            pill(state.title, color: state == .leveled ? .surveyGreen : (state == .compensated ? .surveyAmber : .surveyRed))
        }
    }

    private func pill(_ text: String, color: Color) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(text).font(.caption.weight(.bold))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Capsule().fill(color.opacity(0.18)))
        .overlay(Capsule().strokeBorder(color.opacity(0.6), lineWidth: 1))
    }
}

struct InstrumentReadoutGrid: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let scene = model.scene
        let readout = scene.readout
        let unit = scene.angleUnit
        let angleUnitLabel = unit == .gon ? "gon" : ""
        VStack(spacing: 8) {
            HStack {
                ReadoutCell(label: "Hz", value: GeodeticMath.format(readout.angles?.hz, unit: unit), unit: angleUnitLabel, emphasized: true)
                if readout.isAutomaticLevel {
                    ReadoutCell(label: "Rod", value: GeodeticMath.formatDistance(readout.rod?.reading), unit: "m", emphasized: true)
                } else {
                    ReadoutCell(label: "V (\(readout.angles?.face.rawValue ?? "I"))", value: GeodeticMath.format(readout.angles?.v, unit: unit),
                                unit: angleUnitLabel, emphasized: true)
                }
            }
            HStack {
                ReadoutCell(label: readout.isAutomaticLevel ? "Stadia D" : "SD", value: GeodeticMath.formatDistance(readout.distance?.slope), unit: "m")
                if readout.isAutomaticLevel {
                    ReadoutCell(label: "BS", value: GeodeticMath.formatDistance(scene.levelingLog.backsight), unit: "m")
                    ReadoutCell(label: "Δh", value: scene.levelingLog.deltaH.map { String(format: "%+.4f", $0) } ?? "--", unit: "m")
                } else {
                    ReadoutCell(label: "HD", value: GeodeticMath.formatDistance(readout.horizontalDistance), unit: "m")
                    ReadoutCell(label: "ΔH", value: readout.heightDifference.map { String(format: "%+.3f", $0) } ?? "--", unit: "m")
                }
            }
            if let source = readout.distance?.source {
                Text("Target: \(source.rawValue) · hi = \(String(format: "%.3f", readout.instrumentHeight)) m")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

struct GNSSReadoutGrid: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var scene = model.scene
        if let gnss = scene.gnss {
            VStack(spacing: 8) {
                HStack {
                    ReadoutCell(label: "Northing", value: String(format: "%.3f", gnss.northing), unit: "m", emphasized: true)
                    ReadoutCell(label: "Easting", value: String(format: "%.3f", gnss.easting), unit: "m", emphasized: true)
                }
                HStack {
                    ReadoutCell(label: "Height", value: String(format: "%.3f", gnss.height), unit: "m")
                    ReadoutCell(label: "HRMS / VRMS", value: String(format: "%.3f / %.3f", gnss.hrms, gnss.vrms))
                }
                HStack {
                    ReadoutCell(label: "Sats", value: "\(gnss.satellitesUsed)/\(gnss.satellitesTracked)")
                    ReadoutCell(label: "PDOP", value: String(format: "%.1f", gnss.pdop))
                    ReadoutCell(label: "Tilt", value: String(format: "%.1f°", GeodeticMath.toDegrees(gnss.poleTilt)))
                }
                Toggle(isOn: $scene.tiltCompensationEnabled) {
                    Label(gnss.tiltCompensated ? "Tilt compensation active" : "Tilt compensation off / out of range",
                          systemImage: "gyroscope")
                        .font(.caption)
                }
                .tint(Color.surveyAccent)
            }
        }
    }
}

// MARK: - Instrument controls

struct InstrumentControlPanel: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let scene = model.scene
        let clamps = scene.clamps
        VStack(alignment: .leading, spacing: 8) {
            if !clamps.isLevel {
                GlassToggleChip(title: "Classic", systemImage: "gearshape.2", isOn: clamps.classicDrives) {
                    scene.setClassicDrives(!clamps.classicDrives)
                }
                if clamps.classicDrives {
                    GlassToggleChip(title: "Hz clamp", systemImage: clamps.horizontalClamp ? "lock.fill" : "lock.open",
                                    isOn: clamps.horizontalClamp) { scene.toggleHorizontalClamp() }
                    GlassToggleChip(title: "V clamp", systemImage: clamps.verticalClamp ? "lock.fill" : "lock.open",
                                    isOn: clamps.verticalClamp) { scene.toggleVerticalClamp() }
                }
                GlassToggleChip(title: "Hz hold", systemImage: "pause.circle", isOn: clamps.hzHold) { scene.toggleHzHold() }
            }
            GlassToggleChip(title: "Comp", systemImage: "scalemass", isOn: clamps.compensator) { scene.toggleCompensator() }
            Button {
                scene.setHzZero()
            } label: {
                Label("Hz = 0", systemImage: "0.circle")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(Capsule().fill(.ultraThinMaterial))
            }
            .buttonStyle(.plain)
            if clamps.isLevel {
                HStack(spacing: 6) {
                    Button("BS") { scene.recordBacksight() }
                    Button("FS") { scene.recordForesight() }
                }
                .font(.caption.weight(.bold))
                .buttonStyle(.borderedProminent)
                .tint(Color.surveyAccent.opacity(0.8))
            }
        }
    }
}

// MARK: - Eyepiece hint

struct EyepieceHint: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let optics = model.scene.optics
        if model.scene.hasTelescopeInstrument, let alignment = optics.alignment, alignment.distance < 0.35 {
            let angle = Double(alignment.angularDeviation) * 180 / .pi
            Label(String(format: "Eyepiece %.0f cm · %.0f° off-axis — bring the lens to the eyepiece", alignment.distance * 100, angle),
                  systemImage: "eye")
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .glass(cornerRadius: 14)
                .transition(.opacity)
        }
    }
}

// MARK: - Placement

struct PlacementBar: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let scene = model.scene
        VStack(spacing: 10) {
            Label(scene.placementReady ? "Tap Place or tap the screen to set up here"
                                       : "Aim at the ground to find a surface",
                  systemImage: scene.placementReady ? "scope" : "viewfinder")
                .font(.subheadline.weight(.semibold))
            Text(scene.placingModel?.displayName ?? "")
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack(spacing: 10) {
                GlassActionButton(title: "Cancel", systemImage: "xmark") { scene.cancelPlacement() }
                GlassActionButton(title: "Place", systemImage: "checkmark", prominent: true) { scene.confirmPlacement() }
                    .disabled(!scene.placementReady)
                    .opacity(scene.placementReady ? 1 : 0.5)
            }
        }
        .padding(16)
        .glass()
        .padding(.horizontal, 12)
        .padding(.bottom, 10)
    }
}

// MARK: - Equipment drawer

struct EquipmentDrawer: View {
    @Environment(AppModel.self) private var model
    @GestureState private var dragOffset: CGFloat = 0

    var body: some View {
        @Bindable var model = model
        VStack(spacing: 10) {
            Capsule()
                .fill(.white.opacity(0.4))
                .frame(width: 40, height: 5)
                .padding(.top, 8)
                .contentShape(Rectangle().inset(by: -12))
                .onTapGesture { toggle() }

            Picker("Category", selection: $model.selectedCategory) {
                ForEach(EquipmentCategory.allCases) { category in
                    Image(systemName: category.systemImage).tag(category)
                        .accessibilityLabel(category.title)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 14)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(EquipmentCatalog.models(in: model.selectedCategory)) { item in
                        EquipmentCard(item: item, isSelected: item.id == model.selectedModelID)
                            .onTapGesture {
                                withAnimation(.snappy) { model.select(item) }
                            }
                    }
                }
                .padding(.horizontal, 14)
            }

            if model.isDrawerExpanded {
                ScrollView {
                    EquipmentSpecSheet(item: model.selectedModel)
                }
                .frame(maxHeight: 140)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            GlassActionButton(title: placeTitle, systemImage: "scope", prominent: true) {
                model.placeSelected()
            }
            .padding(.horizontal, 14)
            .padding(.bottom, 12)
        }
        .glass(cornerRadius: 28)
        .padding(.horizontal, 8)
        .offset(y: max(dragOffset, -40))
        .gesture(
            DragGesture(minimumDistance: 12)
                .updating($dragOffset) { value, state, _ in state = value.translation.height * 0.4 }
                .onEnded { value in
                    if value.translation.height < -40 { setExpanded(true) }
                    if value.translation.height > 40 { setExpanded(false) }
                }
        )
        .animation(.spring(response: 0.4, dampingFraction: 0.85), value: model.isDrawerExpanded)
    }

    private var placeTitle: String {
        switch model.selectedModel.kind {
        case .levelingRod: "Place Rod"
        case .tripod: "Place Tripod"
        case .gnssRover: "Place Rover"
        default: "Place Instrument"
        }
    }

    private func toggle() { setExpanded(!model.isDrawerExpanded) }

    private func setExpanded(_ expanded: Bool) {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { model.isDrawerExpanded = expanded }
    }
}

struct EquipmentCard: View {
    let item: EquipmentModel
    let isSelected: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: item.systemImage)
                    .font(.title2)
                    .foregroundStyle(brandColor)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(brandColor.opacity(0.18)))
                Spacer()
                if let magnification = item.magnification {
                    Text("\(Int(magnification))×")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(.white.opacity(0.12)))
                }
            }
            Text(item.manufacturer == .generic ? "Accessory" : item.manufacturer.shortName)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(item.name)
                .font(.subheadline.weight(.bold))
                .lineLimit(1)
            Text(item.tagline)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(2, reservesSpace: true)
        }
        .padding(12)
        .frame(width: 158)
        .background {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(isSelected ? AnyShapeStyle(Color.surveyAccent.opacity(0.18)) : AnyShapeStyle(.white.opacity(0.06)))
        }
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(isSelected ? Color.surveyAccent : .white.opacity(0.15), lineWidth: isSelected ? 2 : 1)
        }
        .contentShape(RoundedRectangle(cornerRadius: 18))
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isSelected ? [.isSelected, .isButton] : .isButton)
    }

    private var brandColor: Color {
        let c = item.palette.body
        return item.manufacturer == .leica ? Color(red: 0.85, green: 0.1, blue: 0.12) : Color(red: Double(c.r), green: Double(c.g), blue: Double(c.b))
    }
}

struct EquipmentSpecSheet: View {
    let item: EquipmentModel

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(item.displayName)
                .font(.headline)
            ForEach(item.specificationRows) { row in
                HStack {
                    Text(row.label).foregroundStyle(.secondary)
                    Spacer()
                    Text(row.value).multilineTextAlignment(.trailing)
                }
                .font(.caption)
                Divider().opacity(0.3)
            }
        }
        .padding(.horizontal, 18)
    }
}
